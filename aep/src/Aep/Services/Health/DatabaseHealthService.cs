using Aep.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace Aep.Services.Health;

public sealed class DatabaseHealthService(AepDbContext dbContext)
{
    public Task<bool> IsDatabaseAvailableAsync(CancellationToken cancellationToken = default) =>
        dbContext.Database.CanConnectAsync(cancellationToken);
}
