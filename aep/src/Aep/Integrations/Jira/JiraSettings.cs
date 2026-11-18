namespace Aep.Integrations.Jira;

public sealed class JiraSettings
{
    private JiraSettings(string applicationName) => ApplicationName = applicationName;

    public string ApplicationName { get; }

    public static JiraSettings FromConfiguration(IConfiguration configuration)
    {
        var name = configuration["Jira:ApplicationName"];
        if (string.IsNullOrWhiteSpace(name) || name != name.Trim() ||
            name.Length > 64 || name.Any(char.IsControl))
            throw new InvalidOperationException("Jira:ApplicationName must be 1-64 characters without surrounding whitespace or control characters.");
        return new JiraSettings(name);
    }
}
