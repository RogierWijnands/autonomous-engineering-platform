namespace Aep.Workflows.Issues;

/// <summary>Describes an issue returned by the Jira integration.</summary>
public sealed record JiraIssue(string Key, string ProjectId, string Summary, string Status);
