using Aep.Models.Health;
using Aep.Services.Health;
using Microsoft.AspNetCore.Mvc;

namespace Aep.Controllers;

[ApiController]
[Route("health")]
public sealed class HealthController(DatabaseHealthService healthService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<HealthResponse>> Get(CancellationToken cancellationToken)
    {
        var isDatabaseAvailable =
            await healthService.IsDatabaseAvailableAsync(cancellationToken);
        var response = new HealthResponse(isDatabaseAvailable ? "healthy" : "unhealthy");

        return isDatabaseAvailable
            ? Ok(response)
            : StatusCode(StatusCodes.Status503ServiceUnavailable, response);
    }
}
