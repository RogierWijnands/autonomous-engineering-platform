using Aep.Workflows.Agents;
using Aep.Workflows.Approvals;
using Aep.Workflows.Auditing;
using Aep.Workflows.Policies;
using Aep.Workflows.PullRequests;
using Aep.Workflows.Issues;
using Aep.Workflows.Workflows;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;

namespace Aep.Infrastructure.Database;

public sealed class AepDbContext(DbContextOptions<AepDbContext> options) : DbContext(options)
{
    public DbSet<Workflow> Workflows => Set<Workflow>();
    public DbSet<WorkflowStep> WorkflowSteps => Set<WorkflowStep>();
    public DbSet<AgentExecution> AgentExecutions => Set<AgentExecution>();
    public DbSet<Issue> Issues => Set<Issue>();
    public DbSet<Approval> Approvals => Set<Approval>();
    public DbSet<PolicyDecision> PolicyDecisions => Set<PolicyDecision>();
    public DbSet<PullRequest> PullRequests => Set<PullRequest>();
    public DbSet<AuditEvent> AuditEvents => Set<AuditEvent>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Issue>(entity =>
        {
            entity.HasKey(issue => issue.Id);
            entity.Property(issue => issue.Source).HasMaxLength(64).IsRequired();
            entity.Property(issue => issue.ExternalId).HasMaxLength(128).IsRequired();
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
            entity.HasOne(workflow => workflow.Issue)
                .WithMany(issue => issue.Workflows)
                .HasForeignKey(workflow => workflow.IssueId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasIndex(workflow => workflow.Status);
            entity.HasIndex(workflow => workflow.CreatedAt);
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

        modelBuilder.Entity<AgentExecution>(entity =>
        {
            entity.HasKey(execution => execution.Id);
            entity.Property(execution => execution.AgentName).HasMaxLength(128).IsRequired();
            entity.Property(execution => execution.Status).HasConversion<string>().HasMaxLength(32);
            entity.Property(execution => execution.InputHash).HasMaxLength(64);
            entity.Property(execution => execution.OutputHash).HasMaxLength(64);
            entity.Property(execution => execution.OutputArtifactUri).HasMaxLength(2048);
            entity.Property(execution => execution.ToolResultsArtifactUri).HasMaxLength(2048);
            entity.Property(execution => execution.ErrorCode).HasMaxLength(128);
            entity.HasOne(execution => execution.WorkflowStep)
                .WithMany(step => step.AgentExecutions)
                .HasForeignKey(execution => execution.WorkflowStepId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(execution => new { execution.WorkflowStepId, execution.Attempt }).IsUnique();
        });

        modelBuilder.Entity<Approval>(entity =>
        {
            entity.HasKey(approval => approval.Id);
            entity.Property(approval => approval.Action).HasMaxLength(128).IsRequired();
            entity.Property(approval => approval.Status).HasConversion<string>().HasMaxLength(32);
            entity.Property(approval => approval.RequestedBy).HasMaxLength(256);
            entity.Property(approval => approval.DecidedBy).HasMaxLength(256);
            entity.Property(approval => approval.ScopeHash).HasMaxLength(64);
            entity.Property(approval => approval.DecisionArtifactUri).HasMaxLength(2048);
            entity.HasOne(approval => approval.Workflow)
                .WithMany(workflow => workflow.Approvals)
                .HasForeignKey(approval => approval.WorkflowId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(approval => new { approval.WorkflowId, approval.Status });
        });

        modelBuilder.Entity<PolicyDecision>(entity =>
        {
            entity.HasKey(decision => decision.Id);
            entity.Property(decision => decision.PolicyName).HasMaxLength(128).IsRequired();
            entity.Property(decision => decision.PolicyVersion).HasMaxLength(64).IsRequired();
            entity.Property(decision => decision.Outcome).HasConversion<string>().HasMaxLength(32);
            entity.Property(decision => decision.ReasonCode).HasMaxLength(128).IsRequired();
            entity.Property(decision => decision.InputHash).HasMaxLength(64).IsRequired();
            entity.Property(decision => decision.DetailsArtifactUri).HasMaxLength(2048);
            entity.HasOne(decision => decision.Workflow)
                .WithMany(workflow => workflow.PolicyDecisions)
                .HasForeignKey(decision => decision.WorkflowId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(decision => new { decision.WorkflowId, decision.EvaluatedAt });
        });

        modelBuilder.Entity<PullRequest>(entity =>
        {
            entity.HasKey(pullRequest => pullRequest.Id);
            entity.Property(pullRequest => pullRequest.Provider).HasMaxLength(64).IsRequired();
            entity.Property(pullRequest => pullRequest.Repository).HasMaxLength(256).IsRequired();
            entity.Property(pullRequest => pullRequest.Url).HasMaxLength(2048).IsRequired();
            entity.Property(pullRequest => pullRequest.Branch).HasMaxLength(256).IsRequired();
            entity.Property(pullRequest => pullRequest.Status).HasConversion<string>().HasMaxLength(32);
            entity.HasOne(pullRequest => pullRequest.Workflow)
                .WithMany(workflow => workflow.PullRequests)
                .HasForeignKey(pullRequest => pullRequest.WorkflowId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasIndex(pullRequest => new
            {
                pullRequest.Provider,
                pullRequest.Repository,
                pullRequest.Number
            }).IsUnique();
        });

        modelBuilder.Entity<AuditEvent>(entity =>
        {
            entity.HasKey(auditEvent => auditEvent.Id);
            entity.Property(auditEvent => auditEvent.EventType).HasMaxLength(128).IsRequired();
            entity.Property(auditEvent => auditEvent.Actor).HasMaxLength(256).IsRequired();
            entity.Property(auditEvent => auditEvent.DataHash).HasMaxLength(64);
            entity.Property(auditEvent => auditEvent.MetadataArtifactUri).HasMaxLength(2048);
            entity.HasOne(auditEvent => auditEvent.Workflow)
                .WithMany(workflow => workflow.AuditEvents)
                .HasForeignKey(auditEvent => auditEvent.WorkflowId)
                .OnDelete(DeleteBehavior.Restrict);
            entity.HasIndex(auditEvent => new { auditEvent.WorkflowId, auditEvent.OccurredAt });
        });
    }

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        EnsureAuditEventsAreAppendOnly();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override Task<int> SaveChangesAsync(
        bool acceptAllChangesOnSuccess,
        CancellationToken cancellationToken = default)
    {
        EnsureAuditEventsAreAppendOnly();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    private void EnsureAuditEventsAreAppendOnly()
    {
        // Reject edits before persistence so the audit trail cannot be rewritten.
        var changedAuditEvents = ChangeTracker.Entries<AuditEvent>()
            .Where(entry => entry.State is EntityState.Modified or EntityState.Deleted)
            .Select(entry => entry.Entity.Id)
            .ToArray();

        if (changedAuditEvents.Length > 0)
        {
            throw new InvalidOperationException(
                $"Audit events are append-only and cannot be changed or deleted: {string.Join(", ", changedAuditEvents)}");
        }
    }
}
