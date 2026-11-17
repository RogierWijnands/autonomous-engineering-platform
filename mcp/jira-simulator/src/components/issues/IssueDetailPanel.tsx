import { ChevronDown, Check, CirclePlus, Pencil, X } from "lucide-react";
import { useLayoutEffect, useRef, type RefObject } from "react";
import type { IssueStatus, Issue } from "../../types";
import { issueStatuses } from "../../types";
import { IssueTypeIcon } from "../common/IssueTypeIcon";
import { PriorityIcon } from "../common/PriorityIcon";
import { useDialogFocus } from "../common/useDialogFocus";

interface IssueDetailPanelProps {
  issue: Issue;
  parentIssue?: Issue;
  subtasks: Issue[];
  projectName: string;
  focusEditAction?: boolean;
  focusSubtaskAction?: boolean;
  focusStandaloneAction?: boolean;
  fallbackFocusRef?: RefObject<HTMLElement>;
  canMakeSubtask: boolean;
  onClose: () => void;
  onUpdate: (issue: Issue) => void;
  onEdit: (issue: Issue) => void;
  onMakeSubtask: (issue: Issue) => void;
  onMakeStandalone: (issue: Issue) => void;
  onCreateSubtask: (issue: Issue) => void;
  onOpenIssue: (issue: Issue) => void;
}

export function IssueDetailPanel({
  issue,
  parentIssue,
  subtasks,
  projectName,
  focusEditAction = false,
  focusSubtaskAction = false,
  focusStandaloneAction = false,
  fallbackFocusRef,
  canMakeSubtask,
  onClose,
  onUpdate,
  onEdit,
  onMakeSubtask,
  onMakeStandalone,
  onCreateSubtask,
  onOpenIssue,
}: IssueDetailPanelProps) {
  const dialogRef = useDialogFocus<HTMLElement>(onClose, fallbackFocusRef);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const wasSubtask = useRef(Boolean(issue.parentIssueKey));

  useLayoutEffect(() => {
    if (wasSubtask.current && !issue.parentIssueKey) headingRef.current?.focus();
    wasSubtask.current = Boolean(issue.parentIssueKey);
  }, [issue.parentIssueKey]);

  return (
    <div
      className="overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        className="detail-panel"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="issue-detail-title"
      >
        <div className="detail-topbar">
          <nav className="detail-breadcrumb" aria-label="Issue breadcrumb">
            {projectName} <span aria-hidden="true">/</span>{" "}
            {parentIssue && (
              <>
                <button
                  type="button"
                  className="text-button"
                  aria-label={`Open parent story ${parentIssue.key}: ${parentIssue.summary}`}
                  onClick={() => onOpenIssue(parentIssue)}
                >
                  {parentIssue.key}
                </button>{" "}
                <span aria-hidden="true">/</span>{" "}
              </>
            )}
            <strong aria-current="page">{issue.key}</strong>
          </nav>
          <button
            className="icon-button close-button"
            type="button"
            aria-label="Close issue details"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <div className="detail-content">
          <div className="detail-type">
            <IssueTypeIcon type={issue.issueType} /> {issue.issueType}
          </div>
          <h2 ref={headingRef} id="issue-detail-title" data-dialog-initial-focus={(!focusEditAction && !focusSubtaskAction && !focusStandaloneAction) || undefined} tabIndex={-1}>
            {issue.summary}
          </h2>
          <p className="detail-key">{issue.key}</p>
          <div className="detail-actions">
            <button
              type="button"
              className="secondary-button"
              data-dialog-initial-focus={focusEditAction || undefined}
              onClick={() => onEdit(issue)}
            >
              <Pencil size={14} /> Edit issue
            </button>
            {canMakeSubtask && (
              <button
                type="button"
                className="secondary-button"
                data-dialog-initial-focus={focusSubtaskAction || undefined}
                onClick={() => onMakeSubtask(issue)}
              >
                {issue.parentIssueKey ? "Move subtask" : "Make subtask"}
              </button>
            )}
            {issue.parentIssueKey && (
              <button
                type="button"
                className="secondary-button"
                data-dialog-initial-focus={focusStandaloneAction || undefined}
                onClick={() => onMakeStandalone(issue)}
              >
                Make standalone task
              </button>
            )}
            <label className="status-select">
              <span className={`status-dot status-${issue.status.toLowerCase().replace(" ", "-")}`} />
              <select
                aria-label="Change issue status"
                value={issue.status}
                onChange={(event) =>
                  onUpdate({ ...issue, status: event.target.value as IssueStatus })
                }
              >
                {issueStatuses.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              <ChevronDown size={14} />
            </label>
            <span className={`priority-pill priority-pill-${issue.priority.toLowerCase()}`}>
              <PriorityIcon priority={issue.priority} /> {issue.priority}
            </span>
          </div>

          <div className="detail-section">
            <h3>Description</h3>
            <p className="detail-description">
              {issue.description || "No description provided."}
            </p>
          </div>
          <div className="detail-section">
            <h3>
              Acceptance criteria
              <span className="criteria-count">{issue.acceptanceCriteria.length}</span>
            </h3>
            {issue.acceptanceCriteria.length > 0 ? (
              <ul className="criteria-list">
                {issue.acceptanceCriteria.map((criterion, index) => (
                  <li key={`${index}-${criterion}`}>
                    <span className="criteria-check"><Check size={12} /></span>
                    <span>{criterion}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="detail-muted">No acceptance criteria added.</p>
            )}
          </div>
          <div className="detail-section">
            <h3>Labels</h3>
            <div className="detail-labels">
              {issue.labels.length > 0
                ? issue.labels.map((label) => (
                    <span className="issue-label" key={label}>{label}</span>
                  ))
                : <span className="detail-muted">No labels</span>}
            </div>
          </div>
          {issue.issueType === "Story" && (
            <section className="detail-section subtasks-section" aria-label="Subtasks">
              <div className="subtasks-heading">
                <h3>
                  Subtasks
                  <span className="criteria-count">{subtasks.length}</span>
                </h3>
                <button
                  type="button"
                  className="secondary-button"
                  aria-label={`Add subtask to ${issue.key}`}
                  onClick={() => onCreateSubtask(issue)}
                >
                  <CirclePlus size={14} /> Add subtask
                </button>
              </div>
              {subtasks.length > 0 ? (
                <ul className="subtask-list">
                  {subtasks.map((subtask) => (
                    <li key={subtask.key}>
                      <button
                        type="button"
                        className="subtask-link"
                        aria-label={`Open subtask ${subtask.key}: ${subtask.summary} (${subtask.status})`}
                        onClick={() => onOpenIssue(subtask)}
                      >
                        <span className="subtask-key">{subtask.key}</span>
                        <span className="subtask-summary">{subtask.summary}</span>
                        <span className="subtask-status">{subtask.status}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="detail-muted">No subtasks yet.</p>
              )}
            </section>
          )}
          <div className="detail-section properties-section">
            <h3>Details</h3>
            <div className="detail-property">
              <span>Issue type</span>
              <strong><IssueTypeIcon type={issue.issueType} />{issue.issueType}</strong>
            </div>
            <div className="detail-property">
              <span>Priority</span>
              <strong><PriorityIcon priority={issue.priority} />{issue.priority}</strong>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
