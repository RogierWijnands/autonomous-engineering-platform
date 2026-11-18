using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Aep.Infrastructure.Database;

public sealed class AepDbContextFactory : IDesignTimeDbContextFactory<AepDbContext>
{
    public AepDbContext CreateDbContext(string[] args)
    {
        var configuration = new ConfigurationBuilder()
            .SetBasePath(AppContext.BaseDirectory)
            .AddJsonFile("appsettings.json")
            .AddEnvironmentVariables()
            .Build();
        var connectionString = PostgresConnectionString.Get(configuration);

        var options = new DbContextOptionsBuilder<AepDbContext>()
            .UseNpgsql(connectionString)
            .Options;

        return new AepDbContext(options);
    }
}
