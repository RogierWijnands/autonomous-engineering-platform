using Aep.Exceptions;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace Aep.Middleware;

public sealed class ApiExceptionHandler(ILogger<ApiExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext context, Exception exception, CancellationToken cancellationToken)
    {
        if (exception is not WorkflowRequestException error)
            return false;

        logger.LogWarning("Workflow request rejected with status {StatusCode}", error.StatusCode);
        context.Response.StatusCode = error.StatusCode;
        await context.Response.WriteAsJsonAsync(new ProblemDetails
        {
            Status = error.StatusCode,
            Title = error.Message
        }, cancellationToken);
        return true;
    }
}
