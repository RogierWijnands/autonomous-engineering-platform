import { createRef } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EvidenceImageDialog } from "./EvidenceImageDialog";

const png = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aZkAAAAASUVORK5CYII=",
  ),
  (character) => character.charCodeAt(0),
);

describe("EvidenceImageDialog", () => {
  it("validates the image and sends the description with valid data", async () => {
    const user = userEvent.setup();
    const onInsert = vi.fn().mockReturnValue(null);
    const onClose = vi.fn();
    render(
      <EvidenceImageDialog
        triggerRef={createRef()}
        onInsert={onInsert}
        onClose={onClose}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Insert Image" });
    const file = within(dialog).getByLabelText("Image file");
    const description = within(dialog).getByLabelText(/Image description/);
    expect(file).toHaveFocus();
    expect(
      file.compareDocumentPosition(description) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    await user.click(
      within(dialog).getByRole("button", { name: "Insert Image" }),
    );
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Choose an image first",
    );
    expect(file).toHaveAttribute("aria-invalid", "true");
    expect(file).toHaveAttribute("aria-describedby", "image-dialog-error");
    await user.upload(
      file,
      new File(["invalid"], "bad.png", { type: "image/png" }),
    );
    await user.type(description, "Screenshot");
    await user.click(
      within(dialog).getByRole("button", { name: "Insert Image" }),
    );
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "static PNG",
    );
    expect(onInsert).not.toHaveBeenCalled();

    await user.upload(
      file,
      new File([png], "result.png", { type: "image/png" }),
    );
    await user.clear(description);
    await user.type(description, "  Test result  ");
    await user.click(
      within(dialog).getByRole("button", { name: "Insert Image" }),
    );
    await waitFor(() =>
      expect(onInsert).toHaveBeenCalledWith(
        expect.stringMatching(/^data:image\/png;base64,/),
        "Test result",
      ),
    );
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("inserts a valid image with an empty optional description", async () => {
    const user = userEvent.setup();
    const onInsert = vi.fn().mockReturnValue(null);
    const onClose = vi.fn();
    render(
      <EvidenceImageDialog
        triggerRef={createRef()}
        onInsert={onInsert}
        onClose={onClose}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "Insert Image" });
    expect(
      within(dialog).getByLabelText(/Image description/),
    ).not.toBeRequired();
    await user.upload(
      within(dialog).getByLabelText("Image file"),
      new File([png], "result.png", { type: "image/png" }),
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Insert Image" }),
    );
    await waitFor(() =>
      expect(onInsert).toHaveBeenCalledWith(
        expect.stringMatching(/^data:image\/png;base64,/),
        "",
      ),
    );
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps the dialog open when the editor rejects an insertion", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <EvidenceImageDialog
        triggerRef={createRef()}
        onInsert={() => "Evidence exceeds its limits."}
        onClose={onClose}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "Insert Image" });
    await user.upload(
      within(dialog).getByLabelText("Image file"),
      new File([png], "result.png", { type: "image/png" }),
    );
    await user.type(
      within(dialog).getByLabelText(/Image description/),
      "Result",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Insert Image" }),
    );
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Evidence exceeds its limits",
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("aborts an in-progress read when cancelled", async () => {
    const readers: DeferredReader[] = [];
    class DeferredReader {
      static LOADING = 1;
      readyState = DeferredReader.LOADING;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onloadend: (() => void) | null = null;
      readAsDataURL = vi.fn();
      abort = vi.fn();
      constructor() {
        readers.push(this);
      }
    }
    vi.stubGlobal("FileReader", DeferredReader);
    try {
      const user = userEvent.setup();
      const onInsert = vi.fn().mockReturnValue(null);
      const onClose = vi.fn();
      render(
        <EvidenceImageDialog
          triggerRef={createRef()}
          onInsert={onInsert}
          onClose={onClose}
        />,
      );
      const dialog = screen.getByRole("dialog", { name: "Insert Image" });
      await user.upload(
        within(dialog).getByLabelText("Image file"),
        new File([png], "result.png", { type: "image/png" }),
      );
      await user.type(
        within(dialog).getByLabelText(/Image description/),
        "Result",
      );
      await user.click(
        within(dialog).getByRole("button", { name: "Insert Image" }),
      );
      expect(readers).toHaveLength(1);
      await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
      expect(readers[0].abort).toHaveBeenCalledOnce();
      expect(readers[0].onload).toBeNull();
      expect(onInsert).not.toHaveBeenCalled();
      expect(onClose).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
