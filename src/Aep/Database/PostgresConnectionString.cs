using Npgsql;

namespace Aep.Infrastructure.Database;

public static class PostgresConnectionString
{
    public static string Get(IConfiguration configuration)
    {
        var configuredConnectionString = configuration.GetConnectionString("Aep");
        if (!string.IsNullOrWhiteSpace(configuredConnectionString))
        {
            return configuredConnectionString;
        }

        var password = configuration["POSTGRES_PASSWORD"];
        if (string.IsNullOrWhiteSpace(password))
        {
            throw new InvalidOperationException(
                "Set POSTGRES_PASSWORD or provide ConnectionStrings__Aep.");
        }

        var host = configuration["Postgres:Host"];
        var port = configuration.GetValue<int?>("Postgres:Port");
        var database = configuration["Postgres:Database"];
        var username = configuration["Postgres:Username"];
        if (string.IsNullOrWhiteSpace(host) ||
            port is null or <= 0 ||
            string.IsNullOrWhiteSpace(database) ||
            string.IsNullOrWhiteSpace(username))
        {
            throw new InvalidOperationException(
                "Configure Postgres:Host, Postgres:Port, Postgres:Database, and Postgres:Username in appsettings.json.");
        }

        return new NpgsqlConnectionStringBuilder
        {
            Host = host,
            Port = port.Value,
            Database = database,
            Username = username,
            Password = password
        }.ConnectionString;
    }
}
