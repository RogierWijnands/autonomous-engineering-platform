namespace Aep.Exceptions;

public sealed class WorkflowRequestException(int statusCode, string message) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
}
