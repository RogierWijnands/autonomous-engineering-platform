using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Aep.Controllers;
using Aep.Exceptions;
using Aep.Infrastructure.Database;
using Aep.Integrations.GitHub;
using Aep.Integrations.Jira;
using Aep.Services.Workflows;
using Aep.Workflows.Issues;
using Aep.Workflows.Workflows;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace Aep.Tests.Workflows;

public sealed class WorkflowTests
{
    private const string Secret = "synthetic-webhook-test-secret-123456";
    private static readonly JiraIssue Issue = new("DEMO-1001", "project-1", "Example", "In Progress");

    [Fact]
    public void ValidatesRepositoryFromWebhookAndStableIssueIdentity()
    {
        Assert.Equal("owner/project", RepositoryMapping.ValidateRepository("owner/project"));
        Assert.Equal("project-1/1001", JiraIssueIdentity.StableIssueId(Issue with { Key = "RENAMED-1001" }));
        foreach (var invalid in new[] { null, "", "../bad", "owner/.", "owner/repo.git", "https://example.com/repo", "owner/repo\n" })
            Assert.Throws<WorkflowRequestException>(() => RepositoryMapping.ValidateRepository(invalid));
    }

    [Fact]
    public void ValidatesConfiguredJiraApplicationName()
    {
        foreach (var invalid in new[] { null, "", " ", " padded ", "line\nbreak", new string('a', 65) })
            Assert.Throws<InvalidOperationException>(() =>
                JiraSettings.FromConfiguration(Config(new() { ["Jira:ApplicationName"] = invalid })));
        Assert.Equal("jira-simulator", DefaultSettings().ApplicationName);
        Assert.Equal(new string('a', 64), JiraSettings.FromConfiguration(
            Config(new() { ["Jira:ApplicationName"] = new string('a', 64) })).ApplicationName);
    }

    [PostgreSqlFact]
    public async Task DefaultSourcePreservesExistingIssueIdentity()
    {
        var options = new DbContextOptionsBuilder<AepDbContext>()
            .UseNpgsql(Environment.GetEnvironmentVariable("AEP_TEST_POSTGRES")!).Options;
        await using (var setup = new AepDbContext(options)) await setup.Database.MigrateAsync();
        var issue = new JiraIssue("TEST-1001", $"test-{Guid.NewGuid():N}", "Synthetic", "In Progress");
        var settings = DefaultSettings();
        async Task<WorkflowAcceptanceResponse> Accept()
        {
            await using var db = new AepDbContext(options);
            return await new WorkflowRequestsService(db, new FakeJira(issue), settings)
                .AcceptAsync(new("issue.execution_requested", Guid.NewGuid(), issue.Key, "owner/repo"), "HASH", CancellationToken.None);
        }
        var first = await Accept();
        var second = await Accept();
        Assert.True(second.AlreadyQueued);
        Assert.Equal(first.WorkflowId, second.WorkflowId);
        await using var check = new AepDbContext(options);
        var persisted = await check.Workflows.Include(item => item.Issue)
            .Include(item => item.EventHistory).SingleAsync(item => item.Id == first.WorkflowId);
        Assert.Equal("jira-simulator", persisted.Issue.Source);
        Assert.Equal("jira-simulator", Assert.Single(persisted.EventHistory).Actor);
    }

    [Fact]
    public async Task WebhookRequiresValidSignatureAndPayloadBeforeDispatch()
    {
        var fake = new RecordingRequests();
        var controller = new JiraWebhookController(fake, Config(new Dictionary<string, string?> { ["AEP_WEBHOOK_SECRET"] = Secret }));
        var body = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new
        {
            Event = "issue.execution_requested",
            EventId = Guid.NewGuid(),
            IssueKey = Issue.Key,
            Repository = "owner/project"
        }));
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };
        controller.Request.ContentType = "application/json";
        controller.Request.Body = new MemoryStream(body);
        controller.Request.Headers["X-Aep-Signature"] = "sha256=" + new string('0', 64);
        var invalid = await controller.Receive(CancellationToken.None);
        Assert.Equal(401, Assert.IsType<ObjectResult>(invalid.Result).StatusCode);
        Assert.Equal(0, fake.Calls);

        controller.Request.Body = new MemoryStream(body);
        controller.Request.Headers["X-Aep-Signature"] =
            "sha256=" + Convert.ToHexString(HMACSHA256.HashData(Encoding.UTF8.GetBytes(Secret), body));
        var valid = await controller.Receive(CancellationToken.None);
        Assert.Equal(202, Assert.IsType<AcceptedResult>(valid.Result).StatusCode);
        Assert.Equal(1, fake.Calls);
        Assert.Equal("owner/project", fake.LastRequest?.Repository);
        controller.Request.Body = new MemoryStream(Encoding.UTF8.GetBytes(
            Encoding.UTF8.GetString(body).Replace("owner/project", "other/repo")));
        Assert.Equal(401, Assert.IsType<ObjectResult>((await controller.Receive(CancellationToken.None)).Result).StatusCode);
        Assert.Equal(1, fake.Calls);

        var malformed = Encoding.UTF8.GetBytes("{");
        controller.Request.Body = new MemoryStream(malformed);
        controller.Request.Headers["X-Aep-Signature"] =
            "sha256=" + Convert.ToHexString(HMACSHA256.HashData(Encoding.UTF8.GetBytes(Secret), malformed));
        Assert.Equal(400, Assert.IsType<ObjectResult>((await controller.Receive(CancellationToken.None)).Result).StatusCode);
        Assert.Equal(1, fake.Calls);
        var unknown = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new
        {
            Event = "issue.other",
            EventId = Guid.NewGuid(),
            IssueKey = Issue.Key
        }));
        controller.Request.Body = new MemoryStream(unknown);
        controller.Request.Headers["X-Aep-Signature"] =
            "sha256=" + Convert.ToHexString(HMACSHA256.HashData(Encoding.UTF8.GetBytes(Secret), unknown));
        Assert.Equal(400, Assert.IsType<ObjectResult>((await controller.Receive(CancellationToken.None)).Result).StatusCode);
        Assert.Equal(1, fake.Calls);
    }

    [Fact]
    public async Task DashboardRejectsMissingOrIncorrectCredentials()
    {
        var dashboard = new RecordingDashboard();
        var controller = new WorkflowsController(dashboard, Config(new Dictionary<string, string?> { ["AEP_DASHBOARD_TOKEN"] = Secret }));
        controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };
        Assert.Equal(401, Assert.IsType<ObjectResult>((await controller.Get(CancellationToken.None)).Result).StatusCode);
        controller.Request.Headers.Authorization = "Bearer incorrect";
        Assert.Equal(401, Assert.IsType<ObjectResult>((await controller.Get(CancellationToken.None)).Result).StatusCode);
        Assert.Equal(0, dashboard.Calls);
        controller.Request.Headers.Authorization = $"Bearer {Secret}";
        Assert.IsType<OkObjectResult>((await controller.Get(CancellationToken.None)).Result);
        Assert.Equal(1, dashboard.Calls);
    }

    [PostgreSqlFact]
    public async Task ConcurrentRequestsAreDurableAndTerminalWorkCanBeRequestedAgain()
    {
        var connection = Environment.GetEnvironmentVariable("AEP_TEST_POSTGRES")!;
        var options = new DbContextOptionsBuilder<AepDbContext>().UseNpgsql(connection).Options;
        await using (var setup = new AepDbContext(options)) await setup.Database.MigrateAsync();
        var testIssue = new JiraIssue("TEST-1001", $"test-{Guid.NewGuid():N}", "Synthetic", "In Progress");
        var firstEvent = Guid.NewGuid();
        var settings = JiraSettings.FromConfiguration(Config(new() { ["Jira:ApplicationName"] = "synthetic-jira" }));

        async Task<WorkflowAcceptanceResponse> Accept(Guid eventId, string hash = "HASH", string? repository = "owner/project")
        {
            await using var db = new AepDbContext(options);
            return await new WorkflowRequestsService(db, new FakeJira(testIssue), settings)
                .AcceptAsync(new("issue.execution_requested", eventId, testIssue.Key, repository), hash, CancellationToken.None);
        }

        var sameEvent = await Task.WhenAll(Enumerable.Range(0, 5).Select(_ => Accept(firstEvent)));
        Assert.Single(sameEvent.Select(result => result.WorkflowId).Distinct());
        var differentEvents = await Task.WhenAll(Enumerable.Range(0, 5).Select(_ => Accept(Guid.NewGuid())));
        Assert.All(differentEvents, result =>
        {
            Assert.True(result.AlreadyQueued);
            Assert.Equal(sameEvent[0].WorkflowId, result.WorkflowId);
        });
        Assert.Equal(sameEvent[0].WorkflowId, (await Accept(Guid.NewGuid(), repository: null)).WorkflowId);
        Assert.Equal(sameEvent[0].WorkflowId, (await Accept(Guid.NewGuid(), repository: "other/changed")).WorkflowId);
        await Assert.ThrowsAsync<WorkflowRequestException>(() => Accept(firstEvent, "OTHER"));
        await using (var db = new AepDbContext(options))
        {
            var workflow = await db.Workflows.Include(item => item.Steps).Include(item => item.Issue)
                .Include(item => item.EventHistory).SingleAsync(item => item.Id == sameEvent[0].WorkflowId);
            Assert.Equal(7, workflow.Steps.Count);
            Assert.Equal("synthetic-jira", workflow.Issue.Source);
            Assert.Equal("synthetic-jira", Assert.Single(workflow.EventHistory).Actor);
            Assert.Equal("owner/project", workflow.Repository);
            Assert.All(workflow.Steps, step => Assert.Equal(WorkflowStepStatus.Pending, step.Status));
            workflow.Status = WorkflowStatus.Completed;
            await db.SaveChangesAsync();
        }
        await Assert.ThrowsAsync<WorkflowRequestException>(() => Accept(Guid.NewGuid(), repository: null));
        var retry = await Accept(Guid.NewGuid(), repository: "other/override");
        Assert.False(retry.AlreadyQueued);
        Assert.NotEqual(sameEvent[0].WorkflowId, retry.WorkflowId);
        Assert.Equal(sameEvent[0].WorkflowId, (await Accept(firstEvent)).WorkflowId);
        await using (var db = new AepDbContext(options))
        {
            var failed = await db.Workflows.SingleAsync(item => item.Id == retry.WorkflowId);
            Assert.Equal("other/override", failed.Repository);
            failed.Status = WorkflowStatus.Failed;
            await db.SaveChangesAsync();
        }
        Assert.False((await Accept(Guid.NewGuid())).AlreadyQueued);
        await using var check = new AepDbContext(options);
        Assert.Equal(3, await check.Workflows.CountAsync(item => item.Issue.ExternalId == $"{testIssue.ProjectId}/1001"));
    }

    private static IConfiguration Config(Dictionary<string, string?> values) =>
        new ConfigurationBuilder().AddInMemoryCollection(values).Build();

    private static JiraSettings DefaultSettings() =>
        JiraSettings.FromConfiguration(new ConfigurationBuilder()
            .SetBasePath(AppContext.BaseDirectory).AddJsonFile("appsettings.json").Build());

    private sealed class FakeJira(JiraIssue issue) : IJiraIssues
    {
        public Task<JiraIssue> GetAsync(string key, CancellationToken cancellationToken) => Task.FromResult(issue);
    }

    private sealed class RecordingRequests : IWorkflowRequests
    {
        public int Calls { get; private set; }
        public CreateWorkflowRequest? LastRequest { get; private set; }
        public Task<WorkflowAcceptanceResponse> AcceptAsync(CreateWorkflowRequest request, string hash, CancellationToken cancellationToken)
        {
            Calls++;
            LastRequest = request;
            return Task.FromResult(new WorkflowAcceptanceResponse(Guid.NewGuid(), false));
        }
    }

    private sealed class RecordingDashboard : IWorkflowDashboard
    {
        public int Calls { get; private set; }
        public Task<IReadOnlyList<WorkflowResponse>> GetAsync(CancellationToken cancellationToken)
        {
            Calls++;
            return Task.FromResult<IReadOnlyList<WorkflowResponse>>([]);
        }
    }
}

public sealed class PostgreSqlFactAttribute : FactAttribute
{
    public PostgreSqlFactAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("AEP_TEST_POSTGRES")))
            Skip = "Set AEP_TEST_POSTGRES to an isolated empty test database to run PostgreSQL integration tests.";
    }
}
