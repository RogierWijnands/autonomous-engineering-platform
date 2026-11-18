using System.Security.Cryptography;
using System.Text;
using Aep.Services.Workflows;
using Microsoft.AspNetCore.Mvc;

namespace Aep.Controllers;

[ApiController]
[Route("api/workflows")]
public sealed class WorkflowsController(
    IWorkflowDashboard dashboard, IConfiguration configuration) : ControllerBase
{
    /// <summary>Returns recent workflows for the authenticated local dashboard.</summary>
    [HttpGet]
    [ProducesResponseType<IReadOnlyList<WorkflowResponse>>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<ActionResult<IReadOnlyList<WorkflowResponse>>> Get(CancellationToken cancellationToken)
    {
        var expected = configuration["AEP_DASHBOARD_TOKEN"];
        if (string.IsNullOrWhiteSpace(expected) || Encoding.UTF8.GetByteCount(expected) < 32)
            return Problem(statusCode: 503, title: "Dashboard authentication is not configured.");
        var header = Request.Headers.Authorization.ToString();
        if (!header.StartsWith("Bearer ", StringComparison.Ordinal))
            return Problem(statusCode: 401, title: "Dashboard authentication is required.");
        var supplied = header["Bearer ".Length..];
        if (!CryptographicOperations.FixedTimeEquals(
                SHA256.HashData(Encoding.UTF8.GetBytes(expected)),
                SHA256.HashData(Encoding.UTF8.GetBytes(supplied))))
            return Problem(statusCode: 401, title: "Dashboard authentication failed.");

        Response.Headers.CacheControl = "no-store";
        return Ok(await dashboard.GetAsync(cancellationToken));
    }
}
