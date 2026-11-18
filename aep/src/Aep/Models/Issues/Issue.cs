namespace Aep.Workflows.Issues;

using Aep.Workflows.Workflows;

public sealed class Issue
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Source { get; set; } = string.Empty;
    public string ExternalId { get; set; } = string.Empty;
    public string ExternalKey { get; set; } = string.Empty;
    public string ProjectKey { get; set; } = string.Empty;
    public string Summary { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string? Url { get; set; }
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public ICollection<Workflow> Workflows { get; set; } = new List<Workflow>();
}
