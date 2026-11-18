import { X } from "lucide-react";
import { useDialogFocus } from "./useDialogFocus";

interface DeleteDialogProps {
  kind: "project" | "issue";
  name: string;
  relatedCount: number;
  requestError?: string;
  onConfirm: () => void;
  onClose: () => void;
}

export function DeleteDialog({
  kind,
  name,
  relatedCount,
  requestError,
  onConfirm,
  onClose,
}: DeleteDialogProps) {
  const dialogRef = useDialogFocus<HTMLDivElement>(onClose);
  const related = kind === "project" ? "issue" : "subtask";
  return (
    <div
      className="overlay modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="create-modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-title"
        aria-describedby="delete-description"
      >
        {requestError && (
          <p className="form-error" role="alert">
            {requestError}
          </p>
        )}
        <div className="modal-heading">
          <h2 id="delete-title">Delete {kind}?</h2>
          <button
            type="button"
            className="icon-button close-button"
            aria-label="Close delete confirmation"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <p id="delete-description">
          Permanently delete <strong>{name}</strong>?
          {relatedCount > 0 &&
            ` This will also delete ${relatedCount} ${related}${relatedCount === 1 ? "" : "s"}.`}{" "}
          This cannot be undone.
        </p>
        <div className="modal-footer">
          <div className="modal-buttons">
            <button
              type="button"
              className="secondary-button"
              data-dialog-initial-focus
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="button" className="danger-button" onClick={onConfirm}>
              Delete {kind}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
