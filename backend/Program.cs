using Microsoft.EntityFrameworkCore;
using MiniNote.Api.Errors;
using MiniNote.Application.Notes;
using MiniNote.Infrastructure;
using MiniNote.Infrastructure.Persistence;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();
builder.Services.AddOpenApi();
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ApiExceptionHandler>();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddScoped<INoteService, NoteService>();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddHealthChecks().AddCheck<DatabaseHealthCheck>("database");

var app = builder.Build();
app.UseExceptionHandler();
app.UseStatusCodePages();

// Local single-instance deployment: apply versioned migrations before serving requests.
await using (var scope = app.Services.CreateAsyncScope())
{
    var db = scope.ServiceProvider.GetRequiredService<NotesDbContext>();
    await db.Database.MigrateAsync();
}

app.MapOpenApi();
app.UseSwaggerUI(options =>
{
    options.SwaggerEndpoint("/openapi/v1.json", "MiniNote API v1 — US-01–04, US-10");
    options.DocumentTitle = "MiniNote — Swagger";
});
app.MapControllers();
app.MapHealthChecks("/health");
app.Run();
