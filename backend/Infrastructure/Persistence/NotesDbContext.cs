using Microsoft.EntityFrameworkCore;
using MiniNote.Domain.Entities;

namespace MiniNote.Infrastructure.Persistence;

public sealed class NotesDbContext(DbContextOptions<NotesDbContext> options) : DbContext(options)
{
    public DbSet<Note> Notes => Set<Note>();
    public DbSet<Notebook> Notebooks => Set<Notebook>();
    public DbSet<Tag> Tags => Set<Tag>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(NotesDbContext).Assembly);
    }
}
