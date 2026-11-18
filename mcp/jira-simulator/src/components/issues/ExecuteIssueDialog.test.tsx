import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError, request } from "../../utils/api";
import { ExecuteIssueDialog } from "./ExecuteIssueDialog";

vi.mock("../../utils/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../utils/api")>()),
  request: vi.fn(),
}));

function Harness() {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <div role="dialog" aria-label="Issue details">
      <button ref={trigger} onClick={() => setOpen(true)}>
        Execute
      </button>
      {open && (
        <ExecuteIssueDialog
          issueKey="DEMO-1001"
          triggerRef={trigger}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

beforeEach(() => {
  vi.mocked(request).mockReset();
});

describe("ExecuteIssueDialog", () => {
  it("explains deduplication and cancels without sending", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Execute" });
    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Execute issue?" });
    expect(dialog).toHaveAccessibleDescription(
      /DEMO-1001.*at most one queued or active/s,
    );
    expect(screen.getByRole("dialog", { name: "Issue details" }).inert).toBe(
      true,
    );
    expect(
      within(dialog).getByRole("button", { name: "Cancel" }),
    ).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Execute issue?" })).toBeNull();
    expect(trigger).toHaveFocus();
    expect(request).not.toHaveBeenCalled();
  });

  it("sends once while pending, then reports acceptance without claiming execution started", async () => {
    const user = userEvent.setup();
    let resolveRequest: (value: {
      delivered: true;
      alreadyQueued: false;
    }) => void = () => {
      throw new Error("Request was not created.");
    };
    vi.mocked(request).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Execute" }));
    const confirm = screen.getByRole("button", { name: "Execute issue" });
    await user.click(confirm);
    expect(screen.getByRole("status")).toHaveFocus();
    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);
    await user.keyboard("{Escape}");
    expect(
      screen.getByRole("dialog", { name: "Execute issue?" }),
    ).toBeVisible();
    expect(request).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledWith(
      "issues/execute",
      { key: "DEMO-1001" },
      expect.stringMatching(/may have started/i),
    );

    await act(async () =>
      resolveRequest({ delivered: true, alreadyQueued: false }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "does not confirm that execution has started",
    );
    expect(screen.getByRole("button", { name: "Done" })).toHaveFocus();
    expect(screen.queryByRole("button", { name: "Execute issue" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.getByRole("button", { name: "Execute" })).toHaveFocus();
  });

  it("reports when an execution is already queued", async () => {
    const user = userEvent.setup();
    vi.mocked(request).mockResolvedValue({
      delivered: true,
      alreadyQueued: true,
    });
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Execute" }));
    await user.click(screen.getByRole("button", { name: "Execute issue" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "No duplicate execution was created",
    );
  });

  it("announces delivery errors and keeps the confirmation open", async () => {
    const user = userEvent.setup();
    vi.mocked(request).mockRejectedValue(
      new Error("Execution may have started; check AEP before trying again."),
    );
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Execute" }));
    await user.click(screen.getByRole("button", { name: "Execute issue" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("check AEP before trying again");
    expect(alert).toHaveFocus();
    expect(screen.getByRole("button", { name: "Execute issue" })).toBeEnabled();
    expect(request).toHaveBeenCalledOnce();
  });

  it("reports a rejected request without suggesting it may have started", async () => {
    const user = userEvent.setup();
    vi.mocked(request).mockRejectedValue(
      new ApiRequestError("Set the project's default GitHub repository.", 409),
    );
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Execute" }));
    await user.click(screen.getByRole("button", { name: "Execute issue" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Set the project's default GitHub repository.",
    );
    expect(alert).not.toHaveTextContent("Execution may have started");
    expect(alert).toHaveFocus();
  });

  it("does not claim delivery for an unexpected API response", async () => {
    const user = userEvent.setup();
    vi.mocked(request).mockResolvedValue({});
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Execute" }));
    await user.click(screen.getByRole("button", { name: "Execute issue" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Execution may have started",
    );
    expect(screen.queryByRole("button", { name: "Done" })).toBeNull();
  });

  it("warns about an uncertain outcome for unexpected API errors", async () => {
    const user = userEvent.setup();
    vi.mocked(request).mockRejectedValue(new Error("Request failed (500)."));
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Execute" }));
    await user.click(screen.getByRole("button", { name: "Execute issue" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Request failed (500).");
    expect(alert).toHaveTextContent("Execution may have started");
  });
});
