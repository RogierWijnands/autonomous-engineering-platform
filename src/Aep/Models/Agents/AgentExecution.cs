namespace Aep.Workflows.Agents;

using Aep.Workflows.Workflows;

public sealed class AgentExecution
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid WorkflowStepId { get; set; }
    public string AgentName { get; set; } = string.Empty;
    public int Attempt { get; set; }
    public AgentExecutionStatus Status { get; set; } = AgentExecutionStatus.Running;
    public DateTimeOffset StartedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? CompletedAt { get; set; }
    public string? InputHash { get; set; }
    public string? OutputHash { get; set; }
    public string? OutputArtifactUri { get; set; }
    public string? ToolResultsArtifactUri { get; set; }
    public string? ErrorCode { get; set; }

    public WorkflowStep WorkflowStep { get; set; } = null!;
}

public enum AgentExecutionStatus
{
    Running,
    Succeeded,
    Failed,
    Cancelled
}
