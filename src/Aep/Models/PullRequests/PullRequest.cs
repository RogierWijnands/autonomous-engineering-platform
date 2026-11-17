namespace Aep.Workflows.PullRequests;

using Aep.Workflows.Workflows;

public sealed class PullRequest
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid WorkflowId { get; set; }
    public string Provider { get; set; } = string.Empty;
    public string Repository { get; set; } = string.Empty;
    public int Number { get; set; }
    public string Url { get; set; } = string.Empty;
    public string Branch { get; set; } = string.Empty;
    public PullRequestStatus Status { get; set; } = PullRequestStatus.Draft;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public Workflow Workflow { get; set; } = null!;
}

public enum PullRequestStatus
{
    Draft,
    Open,
    Closed,
    Merged
}
