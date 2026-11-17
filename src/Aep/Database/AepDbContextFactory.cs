using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Aep.Infrastructure.Database;

public sealed class AepDbContextFactory : IDesignTimeDbContextFactory<AepDbContext>
{
    public AepDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__Aep");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                "Set the ConnectionStrings__Aep environment variable to run EF Core tooling.");
        }

        var options = new DbContextOptionsBuilder<AepDbContext>()
            .UseNpgsql(connectionString)
            .Options;

        return new AepDbContext(options);
    }
}
