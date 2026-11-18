import { useRef, useState, type RefObject } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useDialogFocus } from "./useDialogFocus";

function TestDialog({
  onClose,
  fallbackFocusRef,
  onRemoveTrigger,
}: {
  onClose: () => void;
  fallbackFocusRef?: RefObject<HTMLElement>;
  onRemoveTrigger?: () => void;
}) {
  const dialogRef = useDialogFocus<HTMLDivElement>(onClose, fallbackFocusRef);
  return (
    <div ref={dialogRef} role="dialog" aria-label="Test dialog">
      <button data-dialog-initial-focus>First action</button>
      <select aria-label="Test choice">
        <option>First option</option>
        <option>Second option</option>
      </select>
      <button>Last action</button>
      {onRemoveTrigger && (
        <button onClick={onRemoveTrigger}>Remove trigger</button>
      )}
    </div>
  );
}

function DialogHarness() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <button onClick={() => setIsOpen(true)}>Open dialog</button>
      {isOpen && <TestDialog onClose={() => setIsOpen(false)} />}
    </>
  );
}

describe("useDialogFocus", () => {
  it("traps focus in the topmost dialog and closes only that dialog", async () => {
    const onParentClose = vi.fn();
    function NestedDialogs() {
      const [childOpen, setChildOpen] = useState(false);
      const parentRef = useDialogFocus<HTMLDivElement>(onParentClose);
      return (
        <div ref={parentRef} role="dialog" aria-label="Parent dialog">
          <button onClick={() => setChildOpen(true)}>Open child</button>
          {childOpen && <TestDialog onClose={() => setChildOpen(false)} />}
        </div>
      );
    }

    const user = userEvent.setup();
    render(<NestedDialogs />);
    const trigger = screen.getByRole("button", { name: "Open child" });
    await user.click(trigger);
    expect(screen.getByRole("button", { name: "First action" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Last action" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(onParentClose).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("dialog", { name: "Test dialog" }),
    ).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("moves focus into the dialog, traps tab navigation, closes on Escape, and restores focus", async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);
    const trigger = screen.getByRole("button", { name: "Open dialog" });

    await user.click(trigger);
    const first = screen.getByRole("button", { name: "First action" });
    const last = screen.getByRole("button", { name: "Last action" });

    expect(first).toHaveFocus();
    await user.tab({ shift: true });
    expect(last).toHaveFocus();
    await user.tab();
    expect(first).toHaveFocus();

    fireEvent.keyDown(first, { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("lets Escape close an open native select before closing its dialog", () => {
    const onClose = vi.fn();
    vi.stubGlobal("CSS", { supports: () => true });
    try {
      render(<TestDialog onClose={onClose} />);
      const select = screen.getByRole("combobox", { name: "Test choice" });
      const matches = vi.spyOn(select, "matches").mockReturnValue(true);
      fireEvent.keyDown(select, { key: "Escape" });
      expect(onClose).not.toHaveBeenCalled();

      matches.mockReturnValue(false);
      fireEvent.keyDown(select, { key: "Escape" });
      expect(onClose).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("closes on Escape when select-open feature detection is unavailable", () => {
    const onClose = vi.fn();
    vi.stubGlobal("CSS", {});
    try {
      render(<TestDialog onClose={onClose} />);
      fireEvent.keyDown(screen.getByRole("combobox", { name: "Test choice" }), {
        key: "Escape",
      });
      expect(onClose).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("uses a fallback when the original focus target has been removed", async () => {
    function Harness() {
      const [isOpen, setIsOpen] = useState(false);
      const [showTrigger, setShowTrigger] = useState(true);
      const fallback = useRef<HTMLButtonElement>(null);
      return (
        <>
          <button ref={fallback}>Fallback</button>
          {showTrigger && (
            <button onClick={() => setIsOpen(true)}>Open dialog</button>
          )}
          {isOpen && (
            <TestDialog
              onClose={() => setIsOpen(false)}
              fallbackFocusRef={fallback}
              onRemoveTrigger={() => setShowTrigger(false)}
            />
          )}
        </>
      );
    }

    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Open dialog" }));
    await user.click(screen.getByRole("button", { name: "Remove trigger" }));
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Fallback" })).toHaveFocus();
  });

  it("uses a fallback when the dialog opens without a focused control", async () => {
    function Harness() {
      const [isOpen, setIsOpen] = useState(true);
      const fallback = useRef<HTMLButtonElement>(null);
      return (
        <>
          <button ref={fallback}>Fallback</button>
          {isOpen && (
            <TestDialog
              onClose={() => setIsOpen(false)}
              fallbackFocusRef={fallback}
            />
          )}
        </>
      );
    }

    const user = userEvent.setup();
    render(<Harness />);
    await user.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Fallback" })).toHaveFocus();
  });
});
