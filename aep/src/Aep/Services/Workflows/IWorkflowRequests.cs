using Aep.Workflows.Workflows;

namespace Aep.Services.Workflows;

public interface IWorkflowRequests
{
    Task<WorkflowAcceptanceResponse> AcceptAsync(
        CreateWorkflowRequest request, string payloadHash, CancellationToken cancellationToken);
}
