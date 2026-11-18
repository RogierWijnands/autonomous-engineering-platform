using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Aep.Exceptions;
using Aep.Workflows.Issues;

namespace Aep.Integrations.Jira;

public interface IJiraIssues
{
    Task<JiraIssue> GetAsync(string key, CancellationToken cancellationToken);
}

public sealed class JiraIssues(HttpClient client) : IJiraIssues
{
    private sealed record IssueEnvelope(JiraIssue Issue);

    public async Task<JiraIssue> GetAsync(string key, CancellationToken cancellationToken)
    {
        HttpResponseMessage response;
        try
        {
            response = await client.GetAsync(
                $"issues/{Uri.EscapeDataString(key)}", cancellationToken);
        }
        catch (HttpRequestException)
        {
            throw new WorkflowRequestException(502, "The Jira API is unavailable.");
        }
        catch (TaskCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            throw new WorkflowRequestException(504, "The Jira API did not respond in time.");
        }
        using (response)
        {
            if (response.StatusCode == HttpStatusCode.NotFound)
                throw new WorkflowRequestException(404, "The Jira issue no longer exists.");
            if (!response.IsSuccessStatusCode)
                throw new WorkflowRequestException(502, "The Jira API could not return the issue.");

            IssueEnvelope? result;
            try
            {
                result = await response.Content.ReadFromJsonAsync<IssueEnvelope>(cancellationToken);
            }
            catch (JsonException)
            {
                throw new WorkflowRequestException(502, "The Jira API returned invalid issue data.");
            }
            if (result?.Issue is not { } issue ||
                issue.Key != key ||
                string.IsNullOrWhiteSpace(issue.ProjectId) ||
                string.IsNullOrWhiteSpace(issue.Summary) || issue.Summary.Length > 512 ||
                string.IsNullOrWhiteSpace(issue.Status) || issue.Status.Length > 64)
                throw new WorkflowRequestException(502, "The Jira API returned invalid issue data.");
            return issue;
        }
    }
}
