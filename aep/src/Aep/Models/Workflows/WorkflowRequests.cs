namespace Aep.Workflows.Workflows;

/// <summary>Identifies a Jira execution request.</summary>
public sealed record CreateWorkflowRequest(string Event, Guid EventId, string IssueKey, string? Repository);

/// <summary>Describes a durably accepted execution request.</summary>
public sealed record WorkflowAcceptanceResponse(Guid WorkflowId, bool AlreadyQueued);
