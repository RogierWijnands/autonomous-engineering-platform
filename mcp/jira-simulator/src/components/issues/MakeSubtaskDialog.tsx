import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import type { Issue } from "../../types";
import { useDialogFocus } from "../common/useDialogFocus";

interface MakeSubtaskDialogProps {
  issue: Issue;
  candidates: Issue[];
  initialParentKey?: string;
  hasSubtasks: boolean;
  onConfirm: (parentKey: string) => void;
  onClose: () => void;
}

export function MakeSubtaskDialog({
  issue,
  candidates,
  initialParentKey,
  hasSubtasks,
  onConfirm,
  onClose,
}: MakeSubtaskDialogProps) {
  const dialogRef = useDialogFocus<HTMLFormElement>(onClose);
  const [parentKey, setParentKey] = useState(initialParentKey ?? "");
  const [error, setError] = useState("");
  const parent = candidates.find((candidate) => candidate.key === parentKey);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!parent) {
      setError("Select a valid parent issue.");
      return;
    }
    onConfirm(parent.key);
  }

  return (
    <div
      className="overlay modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        className="create-modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="make-subtask-title"
        aria-describedby="make-subtask-issue make-subtask-description"
        onSubmit={submit}
      >
        <div className="modal-heading">
          <div>
            <h2 id="make-subtask-title">Make issue a subtask?</h2>
            <p id="make-subtask-issue" className="modal-project-context">{issue.key}: {issue.summary}</p>
          </div>
          <button type="button" className="icon-button close-button" aria-label="Close subtask confirmation" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <p id="make-subtask-description">
          {issue.parentIssueKey
            ? `Choose a new parent issue. ${issue.key} will be moved from ${issue.parentIssueKey}. Both issues will keep their current status.`
            : "Choose a parent issue. Both issues will keep their current status."}
        </p>
        <label className="form-field">
          <span>Parent issue</span>
          <select
            data-dialog-initial-focus={!initialParentKey || undefined}
            required
            value={parentKey}
            onChange={(event) => {
              setParentKey(event.target.value);
              setError("");
            }}
          >
            <option value="">Select a parent issue</option>
            {candidates.map((candidate) => (
              <option key={candidate.key} value={candidate.key}>
                {candidate.key}: {candidate.summary} ({candidate.issueType})
              </option>
            ))}
          </select>
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        {parent && (
          <div className="form-notice" role="status">
            {issue.key} will become a Task subtask of {parent.key}.
            {parent.issueType !== "Story" && ` ${parent.key} will become a Story.`}
            {hasSubtasks && ` Existing subtasks of ${issue.key} will become standalone Tasks.`}
          </div>
        )}
        <div className="modal-footer">
          <div className="modal-buttons">
            <button type="button" className="secondary-button" data-dialog-initial-focus={Boolean(initialParentKey) || undefined} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary-button">Make subtask</button>
          </div>
        </div>
      </form>
    </div>
  );
}
