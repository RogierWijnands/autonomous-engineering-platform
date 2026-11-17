import { CirclePlus } from "lucide-react";
import type { DragEvent } from "react";
import type { IssueStatus, Issue } from "../../types";
import { IssueCard } from "./IssueCard";

interface BoardColumnProps {
  status: IssueStatus;
  issues: Issue[];
  projectIssues: Issue[];
  matchingKeys: Set<string>;
  filterKey: string | null;
  expandedStoryKeys: ReadonlySet<string>;
  onExpandedChange: (issueKey: string, expanded: boolean) => void;
  isDropTarget: boolean;
  issueDropTarget: string | null;
  showDropArea: boolean;
  draggingSubtask: boolean;
  onOpenIssue: (issue: Issue) => void;
  onCreateIssue: () => void;
  onDragOver: (event: DragEvent<HTMLElement>, status: IssueStatus) => void;
  onDrop: (event: DragEvent<HTMLElement>, status: IssueStatus) => void;
  onIssueDragStart: (issue: Issue) => void;
  onIssueDragOver: (event: DragEvent<HTMLDivElement>, issueKey: string) => void;
  onIssueDrop: (event: DragEvent<HTMLDivElement>, issueKey: string) => void;
  onDragEnd: () => void;
  instructionsId: string;
  subtaskInstructionsId: string;
}

export function BoardColumn({
  status,
  issues,
  projectIssues,
  matchingKeys,
  filterKey,
  expandedStoryKeys,
  onExpandedChange,
  isDropTarget,
  issueDropTarget,
  showDropArea,
  draggingSubtask,
  onOpenIssue,
  onCreateIssue,
  onDragOver,
  onDrop,
  onIssueDragStart,
  onIssueDragOver,
  onIssueDrop,
  onDragEnd,
  instructionsId,
  subtaskInstructionsId,
}: BoardColumnProps) {
  return (
    <section
      className={`board-column${isDropTarget ? " drag-over" : ""}`}
      aria-label={`${status} issues`}
      onDragOver={(event) => onDragOver(event, status)}
      onDrop={(event) => onDrop(event, status)}
    >
      <div className="column-heading">
        <div className={`status-dot status-${status.toLowerCase().replace(" ", "-")}`} />
        <h2>{status}</h2>
        <span className="column-count">{issues.length}</span>
        <button
          className="icon-button column-add"
          type="button"
          aria-label={`Create issue in ${status}`}
          onClick={onCreateIssue}
        >
          <CirclePlus size={16} />
        </button>
      </div>
      {showDropArea && (
        <div className="column-drop-area" aria-hidden="true">
          {draggingSubtask
            ? `Drop here to make a standalone task in ${status}`
            : `Drop here to move to ${status}`}
        </div>
      )}
      <div className="issue-stack">
        {issues.map((issue) => {
          const subtasks = projectIssues.filter(
            (candidate) =>
              candidate.projectId === issue.projectId &&
              candidate.issueType === "Task" &&
              candidate.parentIssueKey === issue.key,
          );
          return <IssueCard
            key={issue.key}
            issue={issue}
            subtasks={filterKey ? subtasks.filter((subtask) => matchingKeys.has(subtask.key)) : subtasks}
            totalSubtasks={subtasks.length}
            filterKey={filterKey}
            manuallyExpanded={expandedStoryKeys.has(issue.key)}
            onExpandedChange={onExpandedChange}
            contextOnly={Boolean(filterKey && !matchingKeys.has(issue.key))}
            instructionsId={instructionsId}
            subtaskInstructionsId={subtaskInstructionsId}
            isDropTarget={issueDropTarget === issue.key}
            onOpen={onOpenIssue}
            onDragStart={onIssueDragStart}
            onDragOver={onIssueDragOver}
            onDrop={onIssueDrop}
            onDragEnd={onDragEnd}
          />;
        })}
        {issues.length === 0 && (
          <div className="empty-column">
            <span>{filterKey ? "No matching issues" : "No issues here yet"}</span>
          </div>
        )}
      </div>
    </section>
  );
}
