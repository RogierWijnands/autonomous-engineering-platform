using Aep.Infrastructure.Database;
using Aep.Integrations.Jira;
using Aep.Middleware;
using Aep.Services.Health;
using Aep.Services.Workflows;
using Microsoft.EntityFrameworkCore;
using System.Net;

var builder = WebApplication.CreateBuilder(args);

var connectionString = PostgresConnectionString.Get(builder.Configuration);
builder.Services.AddAepDatabase(connectionString);
builder.Services.AddScoped<DatabaseHealthService>();
builder.Services.AddScoped<IWorkflowRequests, WorkflowRequestsService>();
builder.Services.AddScoped<IWorkflowDashboard, WorkflowDashboard>();
builder.Services.AddSingleton(JiraSettings.FromConfiguration(builder.Configuration));
var jiraPort = builder.Configuration.GetValue<int?>("JIRA_API_PORT") ?? 3001;
if (jiraPort is < 1 or > 65535)
    throw new InvalidOperationException("JIRA_API_PORT must be a valid port.");
builder.Services.AddHttpClient<IJiraIssues, JiraIssues>(client =>
{
    client.BaseAddress = new Uri($"http://127.0.0.1:{jiraPort}/api/");
    client.Timeout = TimeSpan.FromSeconds(10);
    client.MaxResponseContentBufferSize = 5_005_000;
}).ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false });
builder.Services.AddExceptionHandler<ApiExceptionHandler>();
builder.Services.AddProblemDetails();
builder.Services.AddControllers();

var app = builder.Build();
app.UseExceptionHandler();
app.Use(async (context, next) =>
{
    var remote = context.Connection.RemoteIpAddress;
    var host = context.Request.Host.Host;
    if (remote is null || !IPAddress.IsLoopback(remote) ||
        !(host.Equals("localhost", StringComparison.OrdinalIgnoreCase) ||
          host == "127.0.0.1" || host == "[::1]" || host == "::1"))
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        return;
    }
    context.Response.Headers.ContentSecurityPolicy =
        "default-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";
    context.Response.Headers.XContentTypeOptions = "nosniff";
    await next();
});

await using (var scope = app.Services.CreateAsyncScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<AepDbContext>();
    await dbContext.Database.MigrateAsync();
}

app.UseDefaultFiles();
app.UseStaticFiles();
app.MapControllers();

app.Run();
