import type { Issue } from "../../types";

interface ProjectSummaryProps {
  issues: Issue[];
}

export function ProjectSummary({ issues }: ProjectSummaryProps) {
  const inProgressCount = issues.filter(
    (issue) => issue.status === "In Progress",
  ).length;
  const completedCount = issues.filter(
    (issue) => issue.status === "Done",
  ).length;
  const progress = issues.length
    ? Math.round((completedCount / issues.length) * 100)
    : 0;

  return (
    <section className="project-summary" aria-label="Project overview">
      <div className="summary-stat">
        <span className="stat-label">Total issues</span>
        <strong>{issues.length}</strong>
      </div>
      <div className="summary-stat">
        <span className="stat-label">In progress</span>
        <strong>{inProgressCount}</strong>
      </div>
      <div className="summary-stat">
        <span className="stat-label">Completed</span>
        <strong>{completedCount}</strong>
      </div>
      <div className="summary-progress">
        <div className="progress-caption">
          <span>Project progress</span>
          <strong>{progress}%</strong>
        </div>
        <div
          className="progress-track"
          role="progressbar"
          aria-label="Project progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <span aria-hidden="true" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </section>
  );
}
