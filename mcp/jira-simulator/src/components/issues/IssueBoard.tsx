import { useRef, useState, type DragEvent } from "react";
import type { IssueStatus, Issue } from "../../types";
import { issueStatuses } from "../../types";
import { BoardColumn } from "./BoardColumn";

interface IssueBoardProps {
  issues: Issue[];
  projectIssues: Issue[];
  onOpenIssue: (issue: Issue) => void;
  onCreateIssue: () => void;
  onMoveIssue: (issueKey: string, status: IssueStatus) => void;
  onMakeSubtask: (issueKey: string, parentIssueKey: string) => void;
}

export function IssueBoard({
  issues,
  projectIssues,
  onOpenIssue,
  onCreateIssue,
  onMoveIssue,
  onMakeSubtask,
}: IssueBoardProps) {
  const [dropTarget, setDropTarget] = useState<IssueStatus | null>(null);
  const [issueDropTarget, setIssueDropTarget] = useState<string | null>(null);
  const [draggedIssue, setDraggedIssue] = useState<Issue | null>(null);
  const draggedIssueRef = useRef<Issue | null>(null);

  function clearDrag() {
    draggedIssueRef.current = null;
    setDraggedIssue(null);
    setDropTarget(null);
    setIssueDropTarget(null);
  }

  function handleDragOver(event: DragEvent<HTMLElement>, status: IssueStatus) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setIssueDropTarget(null);
    setDropTarget(status);
  }

  function handleDrop(event: DragEvent<HTMLElement>, status: IssueStatus) {
    event.preventDefault();
    const issueKey = event.dataTransfer.getData("text/plain");
    if (issueKey && issueKey === draggedIssueRef.current?.key) onMoveIssue(issueKey, status);
    clearDrag();
  }

  function handleIssueDragOver(event: DragEvent<HTMLDivElement>, targetKey: string) {
    const source = draggedIssueRef.current;
    if (!source) return;
    event.preventDefault();
    event.stopPropagation();
    const canLink = source.key !== targetKey && source.parentIssueKey !== targetKey;
    event.dataTransfer.dropEffect = canLink ? "move" : "none";
    setDropTarget(null);
    setIssueDropTarget(canLink ? targetKey : null);
  }

  function handleIssueDrop(event: DragEvent<HTMLDivElement>, targetKey: string) {
    event.preventDefault();
    event.stopPropagation();
    const sourceKey = event.dataTransfer.getData("text/plain");
    if (
      sourceKey &&
      sourceKey === draggedIssueRef.current?.key &&
      draggedIssueRef.current.parentIssueKey !== targetKey &&
      sourceKey !== targetKey
    ) {
      event.currentTarget.querySelector<HTMLButtonElement>(".issue-card")?.focus();
      onMakeSubtask(sourceKey, targetKey);
    }
    clearDrag();
  }

  return (
    <>
      <p className="visually-hidden" id="issue-move-instructions">
        Drag an issue to the drop area below another column heading to move it,
        or onto another issue to make it a subtask. You can also use the controls
        in issue details.
      </p>
      <p className="visually-hidden" id="subtask-move-instructions">
        Drag a subtask to a column drop area to make it a standalone task, or
        onto another issue to change its parent. You can also use the controls
        in its details.
      </p>
      <div className="board-grid">
        {issueStatuses.map((status) => (
          <BoardColumn
            key={status}
            status={status}
            issues={issues.filter((issue) => issue.status === status)}
            projectIssues={projectIssues}
            isDropTarget={dropTarget === status}
            issueDropTarget={issueDropTarget}
            showDropArea={Boolean(draggedIssue && (draggedIssue.parentIssueKey || draggedIssue.status !== status))}
            draggingSubtask={Boolean(draggedIssue?.parentIssueKey)}
            onOpenIssue={onOpenIssue}
            onCreateIssue={onCreateIssue}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onIssueDragStart={(issue) => {
              draggedIssueRef.current = issue;
              setDraggedIssue(issue);
            }}
            onIssueDragOver={handleIssueDragOver}
            onIssueDrop={handleIssueDrop}
            onDragEnd={clearDrag}
            instructionsId="issue-move-instructions"
            subtaskInstructionsId="subtask-move-instructions"
          />
        ))}
      </div>
    </>
  );
}
