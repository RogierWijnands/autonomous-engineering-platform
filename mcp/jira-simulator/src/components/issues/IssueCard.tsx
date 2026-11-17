import { useId, useState, type DragEvent } from "react";
import { ChevronDown } from "lucide-react";
import type { Issue } from "../../types";
import { IssueTypeIcon } from "../common/IssueTypeIcon";
import { PriorityIcon } from "../common/PriorityIcon";

interface IssueCardProps {
  issue: Issue;
  subtasks: Issue[];
  instructionsId: string;
  subtaskInstructionsId: string;
  isDropTarget: boolean;
  onOpen: (issue: Issue) => void;
  onDragStart: (issue: Issue) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>, issueKey: string) => void;
  onDrop: (event: DragEvent<HTMLDivElement>, issueKey: string) => void;
  onDragEnd: () => void;
}

export function IssueCard({
  issue,
  subtasks,
  instructionsId,
  subtaskInstructionsId,
  isDropTarget,
  onOpen,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: IssueCardProps) {
  const [expanded, setExpanded] = useState(false);
  const subtasksId = useId();
  const hasSubtasks = issue.issueType === "Story" && subtasks.length > 0;

  function startDragging(event: DragEvent<HTMLButtonElement>, draggedIssue: Issue) {
    if (draggedIssue.parentIssueKey) event.currentTarget.focus();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", draggedIssue.key);
    onDragStart(draggedIssue);
  }

  return (
    <div
      className={`issue-card-group${hasSubtasks ? " has-subtasks" : ""}${isDropTarget ? " issue-drop-target" : ""}`}
      onDragOver={(event) => onDragOver(event, issue.key)}
      onDrop={(event) => onDrop(event, issue.key)}
    >
      <button
        className="issue-card"
        type="button"
        draggable
        aria-describedby={instructionsId}
        onClick={() => onOpen(issue)}
        onDragStart={(event) => startDragging(event, issue)}
        onDragEnd={onDragEnd}
      >
        <span className="issue-card-top">
          <span className="issue-key">{issue.key}</span>
        </span>
        <span className="issue-summary">{issue.summary}</span>
        <span className="issue-card-footer">
          <span className="issue-type-label">
            <IssueTypeIcon type={issue.issueType} />
            {issue.issueType}
          </span>
          <span className={`priority-pill priority-pill-${issue.priority.toLowerCase()}`}>
            <PriorityIcon priority={issue.priority} />
            {issue.priority}
          </span>
        </span>
        {issue.labels.length > 0 && (
          <span className="issue-labels">
            {issue.labels.slice(0, 3).map((label) => (
              <span className="issue-label" key={label}>{label}</span>
            ))}
            {issue.labels.length > 3 && (
              <span className="issue-label label-overflow">
                +{issue.labels.length - 3}
              </span>
            )}
          </span>
        )}
      </button>
      {hasSubtasks && (
        <div className="card-subtasks">
          <button
            className="card-subtasks-toggle"
            type="button"
            aria-label={`Subtasks for ${issue.key}`}
            aria-expanded={expanded}
            aria-controls={subtasksId}
            onClick={() => setExpanded((current) => !current)}
          >
            <span>Subtasks <span className="card-subtasks-count">{subtasks.length}</span></span>
            <ChevronDown size={16} className={expanded ? "expanded" : ""} aria-hidden="true" />
          </button>
          <ul className="card-subtasks-list" id={subtasksId} hidden={!expanded}>
            {subtasks.map((subtask) => (
              <li key={subtask.key}>
                <button
                  className="card-subtask-link"
                  type="button"
                  draggable
                  aria-label={`Open subtask ${subtask.key}: ${subtask.summary} (${subtask.status})`}
                  aria-describedby={subtaskInstructionsId}
                  onClick={() => onOpen(subtask)}
                  onDragStart={(event) => startDragging(event, subtask)}
                  onDragEnd={onDragEnd}
                >
                  <span className="card-subtask-key">{subtask.key}</span>
                  <span className="card-subtask-status">{subtask.status}</span>
                  <span className="card-subtask-summary">{subtask.summary}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
