namespace Aep.Workflows.Workflows;

using Aep.Workflows.History;
using Aep.Workflows.Issues;

public sealed class Workflow
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid IssueId { get; set; }
    public WorkflowStatus Status { get; set; } = WorkflowStatus.Received;
    public string Repository { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? CompletedAt { get; set; }

    public Issue Issue { get; set; } = null!;
    public ICollection<WorkflowStep> Steps { get; set; } = new List<WorkflowStep>();
    public ICollection<EventHistory> EventHistory { get; set; } = new List<EventHistory>();
}

public enum WorkflowStatus
{
    Received,
    Running,
    Paused,
    Completed,
    Failed,
    Cancelled
}
