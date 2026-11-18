namespace Aep.Workflows.Approvals;

using Aep.Workflows.Workflows;

public sealed class Approval
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid WorkflowId { get; set; }
    public string Action { get; set; } = string.Empty;
    public ApprovalStatus Status { get; set; } = ApprovalStatus.Pending;
    public string? RequestedBy { get; set; }
    public DateTimeOffset RequestedAt { get; set; } = DateTimeOffset.UtcNow;
    public string? DecidedBy { get; set; }
    public DateTimeOffset? DecidedAt { get; set; }
    public string? ScopeHash { get; set; }
    public string? DecisionArtifactUri { get; set; }

    public Workflow Workflow { get; set; } = null!;
}

public enum ApprovalStatus
{
    Pending,
    Approved,
    Rejected,
    Expired
}
