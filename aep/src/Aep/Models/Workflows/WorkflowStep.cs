namespace Aep.Workflows.Workflows;

public sealed class WorkflowStep
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid WorkflowId { get; set; }
    public string Name { get; set; } = string.Empty;
    public int Sequence { get; set; }
    public WorkflowStepStatus Status { get; set; } = WorkflowStepStatus.Pending;
    public DateTimeOffset? StartedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public string? InputHash { get; set; }
    public string? OutputHash { get; set; }
    public string? ArtifactUri { get; set; }
    public string? ErrorCode { get; set; }

    public Workflow Workflow { get; set; } = null!;
}

public enum WorkflowStepStatus
{
    Pending,
    Running,
    Succeeded,
    Failed,
    Skipped
}
