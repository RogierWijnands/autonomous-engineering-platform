using Aep.Workflows.History;
using Aep.Workflows.Issues;
using Aep.Workflows.Workflows;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;

namespace Aep.Infrastructure.Database;

public sealed class AepDbContext(DbContextOptions<AepDbContext> options) : DbContext(options)
{
    public DbSet<Workflow> Workflows => Set<Workflow>();
    public DbSet<WorkflowStep> WorkflowSteps => Set<WorkflowStep>();
    public DbSet<WebhookReceipt> WebhookReceipts => Set<WebhookReceipt>();
    public DbSet<Issue> Issues => Set<Issue>();
    public DbSet<EventHistory> EventHistory => Set<EventHistory>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Issue>(entity =>
        {
            entity.HasKey(issue => issue.Id);
            entity.Property(issue => issue.Source).HasMaxLength(64).IsRequired();
            entity.Property(issue => issue.ExternalId).HasMaxLength(128).IsRequired();
            entity.Property(issue => issue.ExternalKey).HasMaxLength(128).IsRequired();
            entity.Property(issue => issue.ProjectKey).HasMaxLength(64).IsRequired();
            entity.Property(issue => issue.Summary).HasMaxLength(512).IsRequired();
            entity.Property(issue => issue.Status).HasMaxLength(64).IsRequired();
            entity.Property(issue => issue.Url).HasMaxLength(2048);
            entity.HasIndex(issue => new { issue.Source, issue.ExternalId }).IsUnique();
        });

        modelBuilder.Entity<Workflow>(entity =>
        {
            entity.HasKey(workflow => workflow.Id);
            entity.Property(workflow => workflow.Status).HasConversion<string>().HasMaxLength(32);
            entity.Property(workflow => workflow.Repository).HasMaxLength(201).IsRequired();
            entity.HasOne(workflow => workflow.Issue)
                .WithMany(issue => issue.Workflows)
                .HasForeignKey(workflow => workflow.IssueId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasIndex(workflow => workflow.Status);
            entity.HasIndex(workflow => workflow.CreatedAt);
            entity.HasIndex(workflow => workflow.IssueId)
                .HasDatabaseName("IX_Workflows_ActiveIssue")
                .IsUnique()
                .HasFilter("\"Status\" IN ('Received', 'Running', 'Paused')");
        });

        modelBuilder.Entity<WebhookReceipt>(entity =>
        {
            entity.HasKey(receipt => receipt.EventId);
            entity.Property(receipt => receipt.PayloadHash).HasMaxLength(64).IsRequired();
            entity.HasOne(receipt => receipt.Workflow)
                .WithMany()
                .HasForeignKey(receipt => receipt.WorkflowId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<WorkflowStep>(entity =>
        {
            entity.HasKey(step => step.Id);
            entity.Property(step => step.Name).HasMaxLength(128).IsRequired();
            entity.Property(step => step.Status).HasConversion<string>().HasMaxLength(32);
            entity.Property(step => step.InputHash).HasMaxLength(64);
            entity.Property(step => step.OutputHash).HasMaxLength(64);
            entity.Property(step => step.ArtifactUri).HasMaxLength(2048);
            entity.Property(step => step.ErrorCode).HasMaxLength(128);
            entity.HasOne(step => step.Workflow)
                .WithMany(workflow => workflow.Steps)
                .HasForeignKey(step => step.WorkflowId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(step => new { step.WorkflowId, step.Sequence }).IsUnique();
        });

        modelBuilder.Entity<EventHistory>(entity =>
        {
            entity.HasKey(history => history.Id);
            entity.Property(history => history.EventType).HasMaxLength(128).IsRequired();
            entity.Property(history => history.Actor).HasMaxLength(256).IsRequired();
            entity.Property(history => history.DataHash).HasMaxLength(64);
            entity.Property(history => history.MetadataArtifactUri).HasMaxLength(2048);
            entity.HasOne(history => history.Workflow)
                .WithMany(workflow => workflow.EventHistory)
                .HasForeignKey(history => history.WorkflowId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasIndex(history => new { history.WorkflowId, history.OccurredAt });
        });
    }

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        EnsureEventHistoryIsAppendOnly();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override Task<int> SaveChangesAsync(
        bool acceptAllChangesOnSuccess,
        CancellationToken cancellationToken = default)
    {
        EnsureEventHistoryIsAppendOnly();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    private void EnsureEventHistoryIsAppendOnly()
    {
        // Reject edits before persistence so the audit trail cannot be rewritten.
        var changedHistory = ChangeTracker.Entries<EventHistory>()
            .Where(entry => entry.State is EntityState.Modified or EntityState.Deleted)
            .Select(entry => entry.Entity.Id)
            .ToArray();

        if (changedHistory.Length > 0)
        {
            throw new InvalidOperationException(
                $"Event history is append-only and cannot be changed or deleted: {string.Join(", ", changedHistory)}");
        }
    }
}
