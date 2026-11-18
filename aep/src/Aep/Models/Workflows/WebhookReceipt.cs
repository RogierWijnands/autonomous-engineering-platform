namespace Aep.Workflows.Workflows;

public sealed class WebhookReceipt
{
    public Guid EventId { get; set; }
    public Guid WorkflowId { get; set; }
    public string PayloadHash { get; set; } = string.Empty;
    public Workflow Workflow { get; set; } = null!;
}
