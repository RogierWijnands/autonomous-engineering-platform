using Aep.Constants;
using Aep.Exceptions;
using Aep.Infrastructure.Database;
using Aep.Integrations.GitHub;
using Aep.Integrations.Jira;
using Aep.Workflows.History;
using Aep.Workflows.Issues;
using Aep.Workflows.Workflows;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Aep.Services.Workflows;

public sealed class WorkflowRequestsService(
    AepDbContext database,
    IJiraIssues jira, JiraSettings settings) : IWorkflowRequests
{
    private static readonly string[] AgentStages =
    [
        WorkflowStepNames.Analyst, WorkflowStepNames.Architect, WorkflowStepNames.UiUxDesign,
        WorkflowStepNames.Developer, WorkflowStepNames.UiUxReview,
        WorkflowStepNames.Tester, WorkflowStepNames.Reviewer
    ];

    public async Task<WorkflowAcceptanceResponse> AcceptAsync(
        CreateWorkflowRequest request, string payloadHash, CancellationToken cancellationToken)
    {
        var previous = await database.WebhookReceipts.AsNoTracking()
            .SingleOrDefaultAsync(item => item.EventId == request.EventId, cancellationToken);
        if (previous is not null)
            return ReceiptResult(previous, payloadHash);

        var source = await jira.GetAsync(request.IssueKey, cancellationToken);
        var issueId = JiraIssueIdentity.StableIssueId(source);
        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken);

        // The upsert locks the stable issue row, serializing concurrent requests for it.
        var proposedId = Guid.NewGuid();
        await database.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO "Issues" ("Id", "Source", "ExternalId", "ExternalKey", "ProjectKey",
                "Summary", "Status", "UpdatedAt")
            VALUES ({proposedId}, {settings.ApplicationName}, {issueId}, {source.Key}, {source.ProjectId},
                {source.Summary}, {source.Status}, {DateTimeOffset.UtcNow})
            ON CONFLICT ("Source", "ExternalId") DO UPDATE SET
                "ExternalKey" = EXCLUDED."ExternalKey", "Summary" = EXCLUDED."Summary",
                "Status" = EXCLUDED."Status", "UpdatedAt" = EXCLUDED."UpdatedAt"
            """, cancellationToken);
        var issue = await database.Issues.SingleAsync(
            item => item.Source == settings.ApplicationName && item.ExternalId == issueId, cancellationToken);
        var existing = await database.Workflows.SingleOrDefaultAsync(
            item => item.IssueId == issue.Id &&
                (item.Status == WorkflowStatus.Received ||
                 item.Status == WorkflowStatus.Running ||
                 item.Status == WorkflowStatus.Paused), cancellationToken);
        var workflow = existing ?? new Workflow
        {
            IssueId = issue.Id,
            Repository = RepositoryMapping.ValidateRepository(request.Repository),
            Steps = AgentStages.Select((name, sequence) => new WorkflowStep
            {
                Name = name,
                Sequence = sequence
            }).ToList(),
            EventHistory =
            [
                new EventHistory { EventType = EventTypes.WorkflowQueued, Actor = settings.ApplicationName }
            ]
        };
        if (existing is null)
            database.Workflows.Add(workflow);
        database.WebhookReceipts.Add(new WebhookReceipt
        {
            EventId = request.EventId,
            Workflow = workflow,
            PayloadHash = payloadHash
        });

        try
        {
            await database.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
        catch (DbUpdateException error) when (
            error.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            await transaction.RollbackAsync(cancellationToken);
            database.ChangeTracker.Clear();
            var receipt = await database.WebhookReceipts.AsNoTracking()
                .SingleOrDefaultAsync(item => item.EventId == request.EventId, cancellationToken);
            if (receipt is null) throw;
            return ReceiptResult(receipt, payloadHash);
        }

        return new WorkflowAcceptanceResponse(workflow.Id, existing is not null);
    }

    private static WorkflowAcceptanceResponse ReceiptResult(WebhookReceipt receipt, string payloadHash)
    {
        if (receipt.PayloadHash != payloadHash)
            throw new WorkflowRequestException(409, "The event ID was already used for a different request.");
        return new WorkflowAcceptanceResponse(receipt.WorkflowId, true);
    }
}
