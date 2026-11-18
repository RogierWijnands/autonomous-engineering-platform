namespace Aep.Workflows.Policies;

using Aep.Workflows.Workflows;

public sealed class PolicyDecision
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid WorkflowId { get; set; }
    public string PolicyName { get; set; } = string.Empty;
    public string PolicyVersion { get; set; } = string.Empty;
    public PolicyOutcome Outcome { get; set; }
    public string ReasonCode { get; set; } = string.Empty;
    public DateTimeOffset EvaluatedAt { get; set; } = DateTimeOffset.UtcNow;
    public string InputHash { get; set; } = string.Empty;
    public string? DetailsArtifactUri { get; set; }

    public Workflow Workflow { get; set; } = null!;
}

public enum PolicyOutcome
{
    Allowed,
    RequiresApproval,
    Denied
}
