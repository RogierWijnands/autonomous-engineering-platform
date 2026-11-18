import { useState, type FormEvent } from "react";
import { CirclePlus, X } from "lucide-react";
import type {
  IssueType,
  Priority,
  Project,
  Issue,
  IssueDraft,
  IssueStatus,
} from "../../types";
import { useDialogFocus } from "../common/useDialogFocus";

const issueTypes: IssueType[] = ["Story", "Task", "Bug"];
const priorities: Priority[] = ["Highest", "High", "Medium", "Low"];

interface IssueDialogProps {
  project: Project;
  parentIssue?: Issue;
  issue?: Issue;
  initialStatus?: IssueStatus;
  hasSubtasks?: boolean;
  requestError?: string;
  onSave: (draft: IssueDraft) => void;
  onClose: () => void;
}

function formValue(formData: FormData, name: string) {
  return String(formData.get(name) ?? "");
}

export function IssueDialog({
  project,
  parentIssue,
  issue,
  initialStatus,
  hasSubtasks = false,
  requestError,
  onSave,
  onClose,
}: IssueDialogProps) {
  const dialogRef = useDialogFocus<HTMLFormElement>(onClose);
  const [issueType, setIssueType] = useState<IssueType>(
    issue?.issueType ?? "Story",
  );
  const [summaryError, setSummaryError] = useState(false);
  const isSubtask = Boolean(parentIssue || issue?.parentIssueKey);
  const title = issue
    ? "Edit issue"
    : parentIssue
      ? "Create a subtask"
      : "Create an issue";

  function submitIssue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const summary = formValue(formData, "summary").trim();
    if (!summary) {
      setSummaryError(true);
      event.currentTarget
        .querySelector<HTMLInputElement>('[name="summary"]')
        ?.focus();
      return;
    }
    onSave({
      summary,
      description: formValue(formData, "description").trim(),
      issueType: isSubtask ? "Task" : issueType,
      priority: formValue(formData, "priority") as Priority,
      labels: formValue(formData, "labels")
        .split(",")
        .map((label) => label.trim())
        .filter(Boolean),
      acceptanceCriteria: formValue(formData, "acceptanceCriteria")
        .split("\n")
        .map((criterion) => criterion.trim())
        .filter(Boolean),
    });
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
        aria-labelledby="issue-dialog-title"
        aria-describedby="issue-dialog-context"
        onSubmit={submitIssue}
      >
        {requestError && (
          <p className="form-error" role="alert">
            {requestError}
          </p>
        )}
        <div className="modal-heading">
          <div>
            <h2 id="issue-dialog-title">{title}</h2>
            <p id="issue-dialog-context" className="modal-project-context">
              {issue
                ? `${issue.key} · ${project.name}`
                : parentIssue
                  ? `Subtask of ${parentIssue.key}`
                  : `Project: ${project.name}${initialStatus ? ` · Status: ${initialStatus}` : ""}`}
            </p>
          </div>
          <button
            type="button"
            className="icon-button close-button"
            aria-label={
              issue ? "Close edit issue form" : "Close create issue form"
            }
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <label className="form-field">
          <span>
            Summary <i aria-hidden="true">*</i>
          </span>
          <input
            data-dialog-initial-focus
            required
            name="summary"
            placeholder="What needs to get done?"
            maxLength={120}
            defaultValue={issue?.summary}
            aria-invalid={summaryError || undefined}
            aria-describedby={summaryError ? "issue-summary-error" : undefined}
            onChange={() => setSummaryError(false)}
          />
          {summaryError && (
            <small id="issue-summary-error" className="form-error" role="alert">
              Enter a summary.
            </small>
          )}
        </label>
        <label className="form-field">
          <span>Description</span>
          <textarea
            name="description"
            rows={3}
            placeholder="Add a little more context..."
            maxLength={1000}
            defaultValue={issue?.description}
          />
        </label>
        <div className="form-row">
          {isSubtask ? (
            <div className="form-field">
              <span>Issue type</span>
              <span className="locked-field-value">Task</span>
            </div>
          ) : (
            <label className="form-field">
              <span>Issue type</span>
              <select
                name="issueType"
                value={issueType}
                onChange={(event) =>
                  setIssueType(event.target.value as IssueType)
                }
              >
                {issueTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="form-field">
            <span>Priority</span>
            <select name="priority" defaultValue={issue?.priority ?? "Medium"}>
              {priorities.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </label>
        </div>
        {hasSubtasks && issueType !== "Story" && (
          <p className="form-notice" role="status">
            Saving this type change will detach the subtasks and make them
            standalone Tasks.
          </p>
        )}
        <label className="form-field">
          <span>
            Labels <small>comma separated</small>
          </span>
          <input
            name="labels"
            placeholder="e.g. backend, demo"
            defaultValue={issue?.labels.join(", ")}
          />
        </label>
        <label className="form-field">
          <span>
            Acceptance criteria <small>one per line</small>
          </span>
          <textarea
            name="acceptanceCriteria"
            rows={3}
            placeholder={
              "The change works as expected\nTests cover the key cases"
            }
            defaultValue={issue?.acceptanceCriteria.join("\n")}
          />
        </label>
        <div className="modal-footer">
          <div className="modal-buttons">
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="submit" className="primary-button">
              {!issue && <CirclePlus size={16} />}{" "}
              {issue
                ? "Save changes"
                : parentIssue
                  ? "Create subtask"
                  : "Create issue"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
