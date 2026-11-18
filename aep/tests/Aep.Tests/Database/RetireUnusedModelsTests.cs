using Aep.Infrastructure.Database;
using Aep.Services.Workflows;
using Aep.Tests.Workflows;
using Aep.Workflows.Issues;
using Aep.Workflows.Workflows;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql;

namespace Aep.Tests.Database;

public sealed class RetireUnusedModelsTests
{
    [PostgreSqlFact]
    public async Task MigrationPreservesLegacyRowsAndSupportsRollback()
    {
        var connectionString = Environment.GetEnvironmentVariable("AEP_TEST_POSTGRES")!;
        var schema = $"cleanup_test_{Guid.NewGuid():N}";
        await using var admin = new NpgsqlConnection(connectionString);
        await admin.OpenAsync();
        await using (var create = new NpgsqlCommand($"CREATE SCHEMA \"{schema}\"", admin))
            await create.ExecuteNonQueryAsync();

        try
        {
            var isolatedConnection = new NpgsqlConnectionStringBuilder(connectionString)
            {
                SearchPath = schema
            }.ConnectionString;
            var options = new DbContextOptionsBuilder<AepDbContext>().UseNpgsql(isolatedConnection).Options;
            await using var db = new AepDbContext(options);
            var migrator = db.GetService<IMigrator>();
            const string previousMigration = "20261118154203_QueueJiraWorkflows";
            await migrator.MigrateAsync(previousMigration);

            var issue = new Issue
            {
                Source = "synthetic",
                ExternalId = "test/1",
                ExternalKey = "TEST-1",
                ProjectKey = "test",
                Summary = "Synthetic",
                Status = "In Progress"
            };
            var workflow = new Workflow
            {
                Issue = issue,
                Repository = "owner/repo",
                Steps = [new WorkflowStep { Name = "Analyst", Sequence = 0 }]
            };
            db.Workflows.Add(workflow);
            await db.SaveChangesAsync();
            var stepId = workflow.Steps.Single().Id;
            var historyId = Guid.NewGuid();
            var occurredAt = new DateTimeOffset(2026, 1, 2, 3, 4, 5, TimeSpan.Zero);
            await db.Database.ExecuteSqlInterpolatedAsync($"""
                INSERT INTO "AuditEvents" ("Id", "WorkflowId", "EventType", "Actor", "OccurredAt", "DataHash", "MetadataArtifactUri")
                VALUES ({historyId}, {workflow.Id}, 'workflow.queued', 'synthetic-jira', {occurredAt}, 'synthetic-hash', 'synthetic://metadata');
                INSERT INTO "AgentExecutions" ("Id", "WorkflowStepId", "AgentName", "Attempt", "Status", "StartedAt")
                VALUES ({Guid.NewGuid()}, {stepId}, 'Synthetic', 1, 'Running', CURRENT_TIMESTAMP);
                INSERT INTO "Approvals" ("Id", "WorkflowId", "Action", "Status", "RequestedAt")
                VALUES ({Guid.NewGuid()}, {workflow.Id}, 'Synthetic', 'Pending', CURRENT_TIMESTAMP);
                INSERT INTO "PolicyDecisions" ("Id", "WorkflowId", "PolicyName", "PolicyVersion", "Outcome", "ReasonCode", "EvaluatedAt", "InputHash")
                VALUES ({Guid.NewGuid()}, {workflow.Id}, 'Synthetic', '1', 'Allowed', 'test', CURRENT_TIMESTAMP, 'test');
                INSERT INTO "PullRequests" ("Id", "WorkflowId", "Provider", "Repository", "Number", "Url", "Branch", "Status", "CreatedAt", "UpdatedAt")
                VALUES ({Guid.NewGuid()}, {workflow.Id}, 'Synthetic', 'owner/repo', 1, 'https://example.test', 'test', 'Draft', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
                """);

            async Task AssertLegacyRows()
            {
                foreach (var table in new[] { "AgentExecutions", "Approvals", "PolicyDecisions", "PullRequests" })
                {
                    await using var connection = new NpgsqlConnection(isolatedConnection);
                    await connection.OpenAsync();
                    await using var count = new NpgsqlCommand($"SELECT COUNT(*) FROM \"{table}\"", connection);
                    Assert.Equal(1L, await count.ExecuteScalarAsync());
                }
                Assert.Equal(1, await db.Workflows.CountAsync());
            }

            async Task AssertRenamedHistory()
            {
                var history = await db.EventHistory.AsNoTracking().SingleAsync(item => item.Id == historyId);
                Assert.Equal(workflow.Id, history.WorkflowId);
                Assert.Equal("workflow.queued", history.EventType);
                Assert.Equal("synthetic-jira", history.Actor);
                Assert.Equal(occurredAt, history.OccurredAt);
                Assert.Equal("synthetic-hash", history.DataHash);
                Assert.Equal("synthetic://metadata", history.MetadataArtifactUri);
                var displayed = Assert.Single(await new WorkflowDashboard(db).GetAsync(CancellationToken.None));
                Assert.Equal("workflow.queued", Assert.Single(displayed.Events).EventType);
            }

            await migrator.MigrateAsync();
            Assert.False(db.Database.HasPendingModelChanges());
            await AssertLegacyRows();
            await AssertRenamedHistory();
            await migrator.MigrateAsync(previousMigration);
            await AssertLegacyRows();
            await using (var connection = new NpgsqlConnection(isolatedConnection))
            {
                await connection.OpenAsync();
                await using var command = new NpgsqlCommand(
                    """SELECT COUNT(*) FROM "AuditEvents" WHERE "Id" = @id AND "EventType" = 'workflow.queued' AND "Actor" = 'synthetic-jira' AND "DataHash" = 'synthetic-hash' AND "MetadataArtifactUri" = 'synthetic://metadata'""",
                    connection);
                command.Parameters.AddWithValue("id", historyId);
                Assert.Equal(1L, await command.ExecuteScalarAsync());
            }
            await migrator.MigrateAsync();
            await AssertLegacyRows();
            await AssertRenamedHistory();
        }
        finally
        {
            await using var drop = new NpgsqlCommand($"DROP SCHEMA \"{schema}\" CASCADE", admin);
            await drop.ExecuteNonQueryAsync();
        }
    }
}
