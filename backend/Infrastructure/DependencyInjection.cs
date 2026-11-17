using Microsoft.EntityFrameworkCore;
using MiniNote.Application.Abstractions;
using MiniNote.Infrastructure.Persistence;

namespace MiniNote.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<NotesDbContext>(options => options.UseNpgsql(
            configuration.GetConnectionString("Notes")
            ?? throw new InvalidOperationException("ConnectionStrings:Notes is required."),
            postgres => postgres.EnableRetryOnFailure(3)));
        services.AddScoped<INoteRepository, NoteRepository>();
        return services;
    }
}
