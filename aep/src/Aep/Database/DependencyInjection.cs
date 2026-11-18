using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Aep.Infrastructure.Database;

public static class DependencyInjection
{
    public static IServiceCollection AddAepDatabase(
        this IServiceCollection services,
        string connectionString)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(connectionString);
        services.AddDbContext<AepDbContext>(options => options.UseNpgsql(connectionString));
        return services;
    }
}
