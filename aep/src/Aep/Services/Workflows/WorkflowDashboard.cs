using Aep.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace Aep.Services.Workflows;

/// <summary>Shows a single planned or completed agent step.</summary>
public sealed record WorkflowStepResponse(string Name, string Status);

/// <summary>Shows a persisted workflow event without exposing agent output.</summary>
public sealed record WorkflowEventResponse(string EventType, DateTimeOffset OccurredAt);

/// <summary>Shows the current state and history of an execution request.</summary>
public sealed record WorkflowResponse(
    Guid Id, string IssueKey, string Summary, string Repository, string Status,
    DateTimeOffset CreatedAt, IReadOnlyList<WorkflowStepResponse> Steps,
    IReadOnlyList<WorkflowEventResponse> Events);

public interface IWorkflowDashboard
{
    Task<IReadOnlyList<WorkflowResponse>> GetAsync(CancellationToken cancellationToken);
}

public sealed class WorkflowDashboard(AepDbContext database) : IWorkflowDashboard
{
    public async Task<IReadOnlyList<WorkflowResponse>> GetAsync(CancellationToken cancellationToken)
    {
        var workflows = await database.Workflows.AsNoTracking()
            .Include(workflow => workflow.Issue)
            .Include(workflow => workflow.Steps)
            .Include(workflow => workflow.EventHistory)
            .OrderByDescending(workflow => workflow.CreatedAt)
            .Take(100)
            .AsSplitQuery()
            .ToListAsync(cancellationToken);
        return workflows.Select(workflow => new WorkflowResponse(
            workflow.Id,
            workflow.Issue.ExternalKey,
            workflow.Issue.Summary,
            workflow.Repository,
            workflow.Status.ToString(),
            workflow.CreatedAt,
            workflow.Steps.OrderBy(step => step.Sequence)
                .Select(step => new WorkflowStepResponse(step.Name, step.Status.ToString()))
                .ToArray(),
            workflow.EventHistory.OrderBy(item => item.OccurredAt)
                .Select(item => new WorkflowEventResponse(item.EventType, item.OccurredAt))
                .ToArray()
        )).ToArray();
    }
}
