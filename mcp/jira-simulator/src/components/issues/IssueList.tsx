import type { Issue } from "../../types";
import { IssueTypeIcon } from "../common/IssueTypeIcon";
import { PriorityIcon } from "../common/PriorityIcon";

interface IssueListProps {
  issues: Issue[];
  hasSubtasks: boolean;
  onOpenIssue: (issue: Issue) => void;
}

export function IssueList({ issues, hasSubtasks, onOpenIssue }: IssueListProps) {
  return (
    <>
      <p className="table-scroll-hint" aria-hidden="true">Scroll horizontally to see all columns.</p>
      <div className="issue-table-wrap" role="region" aria-label="Issue list, scroll horizontally if needed" tabIndex={0}>
        <table className="issue-table" aria-label="Issues">
          <thead>
            <tr>
              <th scope="col">Issue</th>
              {hasSubtasks && <th scope="col">Subtask of</th>}
              <th className="table-type-column" scope="col">Type</th>
              <th scope="col">Status</th>
              <th scope="col">Priority</th>
              <th className="table-label-column" scope="col">Labels</th>
            </tr>
          </thead>
          <tbody>
            {issues.map((issue) => (
              <tr key={issue.key}>
                <td>
                  <button
                    type="button"
                    className="table-issue-button"
                    aria-label={`Open issue ${issue.key}: ${issue.summary}`}
                    onClick={() => onOpenIssue(issue)}
                  >
                    <span className="table-issue">
                      <IssueTypeIcon type={issue.issueType} />
                      <span>
                        <span className="table-key">{issue.key}</span>
                        {issue.summary}
                      </span>
                    </span>
                  </button>
                </td>
                {hasSubtasks && <td>{issue.parentIssueKey ?? "—"}</td>}
                <td className="table-type-column">{issue.issueType}</td>
                <td>
                  <span className={`table-status status-text-${issue.status.toLowerCase().replace(" ", "-")}`}>
                    <span className={`status-dot status-${issue.status.toLowerCase().replace(" ", "-")}`} />
                    {issue.status}
                  </span>
                </td>
                <td>
                  <span className="table-priority">
                    <PriorityIcon priority={issue.priority} />
                    {issue.priority}
                  </span>
                </td>
                <td className="table-label-column">
                  <span className="table-labels">{issue.labels.join(", ") || "—"}</span>
                </td>
              </tr>
            ))}
            {issues.length === 0 && (
              <tr>
                <td className="empty-table" colSpan={hasSubtasks ? 6 : 5}>No issues match your search.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
