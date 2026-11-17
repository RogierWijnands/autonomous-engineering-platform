using Aep.Infrastructure.Database;
using Aep.Services.Health;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("Aep");
if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException(
        "Set the ConnectionStrings__Aep environment variable before starting the AEP application.");
}

builder.Services.AddAepDatabase(connectionString);
builder.Services.AddScoped<DatabaseHealthService>();
builder.Services.AddControllers();

var app = builder.Build();

await using (var scope = app.Services.CreateAsyncScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<AepDbContext>();
    await dbContext.Database.MigrateAsync();
}

app.MapControllers();

app.Run();
