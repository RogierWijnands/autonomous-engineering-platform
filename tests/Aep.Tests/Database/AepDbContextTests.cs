using Aep.Infrastructure.Database;
using Aep.Workflows.Auditing;
using Aep.Workflows.Issues;
using Aep.Workflows.Workflows;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;

namespace Aep.Tests.Database;

public sealed class AepDbContextTests
{
    [Fact]
    public void Model_UsesIssueTerminologyForPersistence()
    {
        using var context = CreateContext();

        Assert.Equal(
            "Issues",
            context.Model.FindEntityType(typeof(Issue))?.GetTableName());
        Assert.Equal(
            "IssueId",
            context.Model.FindEntityType(typeof(Workflow))?
                .FindProperty(nameof(Workflow.IssueId))?
                .GetColumnName(StoreObjectIdentifier.Table("Workflows", null)));
        Assert.Equal(
            typeof(Issue),
            context.Model.FindEntityType(typeof(Workflow))?
                .FindNavigation(nameof(Workflow.Issue))?
                .TargetEntityType.ClrType);
    }

    [Theory]
    [InlineData(EntityState.Modified)]
    [InlineData(EntityState.Deleted)]
    public void SaveChanges_RejectsChangesToAuditEvents(EntityState state)
    {
        using var context = CreateContext();
        context.Attach(new AuditEvent());
        context.Entry(context.AuditEvents.Local.Single()).State = state;

        var exception = Assert.Throws<InvalidOperationException>(
            () => context.SaveChanges());

        Assert.Contains("append-only", exception.Message);
    }

    [Theory]
    [InlineData(EntityState.Modified)]
    [InlineData(EntityState.Deleted)]
    public async Task SaveChangesAsync_RejectsChangesToAuditEvents(EntityState state)
    {
        await using var context = CreateContext();
        context.Attach(new AuditEvent());
        context.Entry(context.AuditEvents.Local.Single()).State = state;

        var exception = await Assert.ThrowsAsync<InvalidOperationException>(
            () => context.SaveChangesAsync());

        Assert.Contains("append-only", exception.Message);
    }

    private static AepDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<AepDbContext>()
            .UseNpgsql("Host=127.0.0.1;Database=aep_test;Username=aep_test_user")
            .Options;

        return new AepDbContext(options);
    }
}
