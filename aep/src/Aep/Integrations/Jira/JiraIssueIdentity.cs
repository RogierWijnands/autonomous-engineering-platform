using System.Text.RegularExpressions;
using Aep.Exceptions;
using Aep.Workflows.Issues;

namespace Aep.Integrations.Jira;

public static partial class JiraIssueIdentity
{
    [GeneratedRegex(@"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$")]
    private static partial Regex ProjectIdPattern();

    public static string StableIssueId(JiraIssue issue)
    {
        var separator = issue.Key.LastIndexOf('-');
        var number = separator >= 0 ? issue.Key[(separator + 1)..] : "";
        if (!ProjectIdPattern().IsMatch(issue.ProjectId) ||
            !long.TryParse(number, out var value) ||
            value <= 0 ||
            value.ToString(System.Globalization.CultureInfo.InvariantCulture) != number)
            throw new WorkflowRequestException(502, "The Jira API returned an invalid issue identity.");
        return $"{issue.ProjectId}/{number}";
    }
}
