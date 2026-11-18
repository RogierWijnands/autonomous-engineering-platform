using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Aep.Constants;
using Aep.Services.Workflows;
using Aep.Workflows.Workflows;
using Microsoft.AspNetCore.Mvc;

namespace Aep.Controllers;

[ApiController]
[Route("api/webhooks/jira")]
public sealed partial class JiraWebhookController(
    IWorkflowRequests workflows, IConfiguration configuration) : ControllerBase
{
    [GeneratedRegex(@"^[A-Z][A-Z0-9]{1,9}-[1-9][0-9]{0,17}$")]
    private static partial Regex IssueKeyPattern();

    /// <summary>Authenticates and durably queues a Jira execution request.</summary>
    [HttpPost]
    [RequestSizeLimit(8192)]
    [ProducesResponseType<WorkflowAcceptanceResponse>(StatusCodes.Status202Accepted)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<ActionResult<WorkflowAcceptanceResponse>> Receive(CancellationToken cancellationToken)
    {
        var secret = configuration["AEP_WEBHOOK_SECRET"];
        if (string.IsNullOrWhiteSpace(secret) || Encoding.UTF8.GetByteCount(secret) < 32)
            return Problem(statusCode: 503, title: "Webhook authentication is not configured.");
        if (!Request.HasJsonContentType())
            return Problem(statusCode: 415, title: "Expected application/json.");

        await using var buffer = new MemoryStream();
        await Request.Body.CopyToAsync(buffer, cancellationToken);
        var body = buffer.ToArray();
        var signature = Request.Headers["X-Aep-Signature"].ToString();
        if (!IsValidSignature(secret, body, signature))
            return Problem(statusCode: 401, title: "Invalid webhook authentication.");

        CreateWorkflowRequest? request;
        try
        {
            request = JsonSerializer.Deserialize<CreateWorkflowRequest>(
                body, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        }
        catch (JsonException)
        {
            return Problem(statusCode: 400, title: "Invalid webhook payload.");
        }
        if (request is null || request.Event != JiraWebhookEvents.ExecutionRequested ||
            request.EventId == Guid.Empty || request.IssueKey is null ||
            !IssueKeyPattern().IsMatch(request.IssueKey))
            return Problem(statusCode: 400, title: "Invalid webhook payload.");

        var hash = Convert.ToHexString(SHA256.HashData(body));
        var response = await workflows.AcceptAsync(request, hash, cancellationToken);
        return Accepted(response);
    }

    private static bool IsValidSignature(string secret, byte[] body, string signature)
    {
        if (!signature.StartsWith("sha256=", StringComparison.Ordinal) || signature.Length != 71)
            return false;
        byte[] supplied;
        try
        {
            supplied = Convert.FromHexString(signature[7..]);
        }
        catch (FormatException)
        {
            return false;
        }
        var expected = HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), body);
        return CryptographicOperations.FixedTimeEquals(expected, supplied);
    }
}
