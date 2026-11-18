import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { DeleteDialog } from "./DeleteDialog";

it("starts on cancel and only confirms when the delete action is chosen", async () => {
  const user = userEvent.setup();
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  render(
    <DeleteDialog
      kind="issue"
      name="DEMO-1001"
      relatedCount={1}
      onConfirm={onConfirm}
      onClose={onClose}
    />,
  );
  expect(
    screen.getByRole("dialog", { name: "Delete issue?" }),
  ).toHaveAccessibleDescription(
    "Permanently delete DEMO-1001? This will also delete 1 subtask. This cannot be undone.",
  );
  expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  await user.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalledOnce();
  expect(onConfirm).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Delete issue" }));
  expect(onConfirm).toHaveBeenCalledOnce();
});
