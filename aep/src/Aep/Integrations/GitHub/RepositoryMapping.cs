using System.Text.RegularExpressions;
using Aep.Exceptions;

namespace Aep.Integrations.GitHub;

public static partial class RepositoryMapping
{
    [GeneratedRegex(@"^[A-Za-z0-9][A-Za-z0-9-]{0,38}/[A-Za-z0-9_.-]{1,100}$")]
    private static partial Regex RepositoryPattern();

    public static string ValidateRepository(string? repository)
    {
        if (string.IsNullOrWhiteSpace(repository))
            throw new WorkflowRequestException(409, "No GitHub repository is configured for this issue or project.");
        if (repository != repository.Trim() || !RepositoryPattern().IsMatch(repository) || repository.Contains("..") ||
            repository.EndsWith("/.") ||
            repository.EndsWith(".git", StringComparison.OrdinalIgnoreCase))
            throw new WorkflowRequestException(409, "The configured GitHub repository is invalid.");
        return repository;
    }
}
