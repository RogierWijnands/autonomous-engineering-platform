namespace Aep.Workflows.Workflows;

using Aep.Workflows.Approvals;
using Aep.Workflows.Auditing;
using Aep.Workflows.Policies;
using Aep.Workflows.PullRequests;
using Aep.Workflows.Tickets;

public sealed class Workflow
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TicketId { get; set; }
    public WorkflowStatus Status { get; set; } = WorkflowStatus.Received;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? CompletedAt { get; set; }

    public Ticket Ticket { get; set; } = null!;
    public ICollection<WorkflowStep> Steps { get; set; } = new List<WorkflowStep>();
    public ICollection<Approval> Approvals { get; set; } = new List<Approval>();
    public ICollection<PolicyDecision> PolicyDecisions { get; set; } = new List<PolicyDecision>();
    public ICollection<PullRequest> PullRequests { get; set; } = new List<PullRequest>();
    public ICollection<AuditEvent> AuditEvents { get; set; } = new List<AuditEvent>();
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
