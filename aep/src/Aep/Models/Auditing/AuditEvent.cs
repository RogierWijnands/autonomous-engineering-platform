namespace Aep.Workflows.Auditing;

using Aep.Workflows.Workflows;

public sealed class AuditEvent
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid WorkflowId { get; init; }
    public string EventType { get; init; } = string.Empty;
    public string Actor { get; init; } = string.Empty;
    public DateTimeOffset OccurredAt { get; init; } = DateTimeOffset.UtcNow;
    public string? DataHash { get; init; }
    public string? MetadataArtifactUri { get; init; }

    public Workflow Workflow { get; init; } = null!;
}
