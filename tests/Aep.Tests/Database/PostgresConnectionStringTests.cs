using Aep.Infrastructure.Database;
using Microsoft.Extensions.Configuration;
using Npgsql;

namespace Aep.Tests.Database;

public sealed class PostgresConnectionStringTests
{
    [Fact]
    public void Get_PrefersExplicitConnectionString()
    {
        const string connectionString = "Host=database.example;Database=aep";
        var configuration = BuildConfiguration(new Dictionary<string, string?>
        {
            ["ConnectionStrings:Aep"] = connectionString
        });

        var result = PostgresConnectionString.Get(configuration);

        Assert.Equal(connectionString, result);
    }

    [Fact]
    public void Get_ComposesSettingsAndPreservesSpecialCharactersInPassword()
    {
        const string password = "test;password=with delimiters";
        var configuration = BuildConfiguration(new Dictionary<string, string?>
        {
            ["POSTGRES_PASSWORD"] = password,
            ["Postgres:Host"] = "127.0.0.1",
            ["Postgres:Port"] = "5432",
            ["Postgres:Database"] = "aep_test",
            ["Postgres:Username"] = "aep_test_user"
        });

        var connectionString = PostgresConnectionString.Get(configuration);
        var parsed = new NpgsqlConnectionStringBuilder(connectionString);

        Assert.Equal("127.0.0.1", parsed.Host);
        Assert.Equal(5432, parsed.Port);
        Assert.Equal("aep_test", parsed.Database);
        Assert.Equal("aep_test_user", parsed.Username);
        Assert.Equal(password, parsed.Password);
    }

    [Fact]
    public void Get_RejectsMissingPasswordWithoutExposingAValue()
    {
        var configuration = BuildConfiguration(new Dictionary<string, string?>());

        var exception = Assert.Throws<InvalidOperationException>(
            () => PostgresConnectionString.Get(configuration));

        Assert.Contains("POSTGRES_PASSWORD", exception.Message);
    }

    [Fact]
    public void Get_RejectsIncompleteSettingsWithoutExposingPassword()
    {
        const string password = "test-only-password";
        var configuration = BuildConfiguration(new Dictionary<string, string?>
        {
            ["POSTGRES_PASSWORD"] = password,
            ["Postgres:Port"] = "5432",
            ["Postgres:Database"] = "aep_test",
            ["Postgres:Username"] = "aep_test_user"
        });

        var exception = Assert.Throws<InvalidOperationException>(
            () => PostgresConnectionString.Get(configuration));

        Assert.Contains("Postgres:Host", exception.Message);
        Assert.DoesNotContain(password, exception.Message);
    }

    private static IConfiguration BuildConfiguration(
        IDictionary<string, string?> values) =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(values)
            .Build();
}
