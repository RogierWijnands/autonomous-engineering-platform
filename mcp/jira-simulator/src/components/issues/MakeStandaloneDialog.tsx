import { useState, type FormEvent, type RefObject } from "react";
import { X } from "lucide-react";
import { issueStatuses, type Issue, type IssueStatus } from "../../types";
import { useDialogFocus } from "../common/useDialogFocus";

interface MakeStandaloneDialogProps {
  issue: Issue;
  initialStatus: IssueStatus;
  fallbackFocusRef?: RefObject<HTMLElement>;
  onConfirm: (status: IssueStatus) => void;
  onClose: () => void;
}

export function MakeStandaloneDialog({
  issue,
  initialStatus,
  fallbackFocusRef,
  onConfirm,
  onClose,
}: MakeStandaloneDialogProps) {
  const dialogRef = useDialogFocus<HTMLFormElement>(onClose, fallbackFocusRef);
  const [status, setStatus] = useState(initialStatus);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onConfirm(status);
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
        aria-labelledby="standalone-title"
        aria-describedby="standalone-issue standalone-description"
        onSubmit={submit}
      >
        <div className="modal-heading">
          <div>
            <h2 id="standalone-title">Make subtask standalone?</h2>
            <p id="standalone-issue" className="modal-project-context">{issue.key}: {issue.summary}</p>
          </div>
          <button type="button" className="icon-button close-button" aria-label="Close standalone confirmation" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <p id="standalone-description">
          This will remove the subtask from {issue.parentIssueKey} and make it a standalone Task.
        </p>
        <label className="form-field">
          <span>Destination column</span>
          <select
            value={status}
            onChange={(event) => {
              const nextStatus = issueStatuses.find((candidate) => candidate === event.target.value);
              if (!nextStatus) throw new Error("Invalid destination column.");
              setStatus(nextStatus);
            }}
          >
            {issueStatuses.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
        <div className="modal-footer">
          <div className="modal-buttons">
            <button type="button" className="secondary-button" data-dialog-initial-focus onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary-button">Make standalone task</button>
          </div>
        </div>
      </form>
    </div>
  );
}
