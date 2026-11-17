using Microsoft.EntityFrameworkCore;
using MiniNote.Application.Abstractions;
using MiniNote.Application.Notes;
using MiniNote.Domain.Entities;
using Npgsql;

namespace MiniNote.Infrastructure.Persistence;

public sealed class NoteRepository(NotesDbContext db) : INoteRepository
{
    public async Task<IReadOnlyList<NoteListItemResponse>> ListAsync(CancellationToken cancellationToken) =>
        await db.Notes.AsNoTracking().OrderByDescending(note => note.CreatedAt)
            .ThenByDescending(note => note.Id)
            .Select(note => new NoteListItemResponse(
                note.Id, note.Title,
                note.Content.Length > 160 ? note.Content.Substring(0, 160) : note.Content,
                note.Notebook.Name, note.CreatedAt))
            .ToListAsync(cancellationToken);

    public Task<Note?> FindAsync(Guid id, CancellationToken cancellationToken) =>
        db.Notes.AsNoTracking().Include(note => note.Checklist.OrderBy(item => item.Position))
            .SingleOrDefaultAsync(note => note.Id == id, cancellationToken);

    public async Task<Note> UpdateAsync(Note note, CancellationToken cancellationToken)
    {
        var tracked = await db.Notes.Include(value => value.Checklist)
            .SingleAsync(value => value.Id == note.Id, cancellationToken);
        tracked.UpdateContent(note.Title, note.Content);
        var incoming = note.Checklist.ToDictionary(item => item.Id);
        foreach (var item in tracked.Checklist.Where(item => !incoming.ContainsKey(item.Id)).ToArray())
        {
            tracked.Checklist.Remove(item);
            db.Remove(item);
        }
        foreach (var item in note.Checklist)
        {
            var existing = tracked.Checklist.SingleOrDefault(value => value.Id == item.Id);
            if (existing is null) tracked.Checklist.Add(item);
            else existing.Update(item.Text, item.IsCompleted, item.Position);
        }
        await db.SaveChangesAsync(cancellationToken);
        return tracked;
    }

    public async Task<(Note Note, bool Created)> AddOrGetAsync(Note note, CancellationToken cancellationToken)
    {
        var existing = await FindAsync(note.Id, cancellationToken);
        if (existing is not null)
            return (existing, false);

        db.Notes.Add(note);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
            // Return database values, including PostgreSQL's microsecond timestamp precision.
            await db.Entry(note).ReloadAsync(cancellationToken);
            return (note, true);
        }
        catch (DbUpdateException exception) when (
            exception.InnerException is PostgresException
            {
                SqlState: PostgresErrorCodes.UniqueViolation,
                ConstraintName: "PK_Notes"
            })
        {
            // A concurrent retry may have committed this request first.
            db.Entry(note).State = EntityState.Detached;
            existing = await FindAsync(note.Id, cancellationToken);
            if (existing is not null)
                return (existing, false);
            throw;
        }
    }
}
