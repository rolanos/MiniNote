using Microsoft.EntityFrameworkCore;
using MiniNote.Application.Abstractions;
using MiniNote.Application.Notes;
using MiniNote.Domain.Entities;
using Npgsql;

namespace MiniNote.Infrastructure.Persistence;

public sealed class NoteRepository(NotesDbContext db) : INoteRepository
{
    private const string UniqueTitleIndex = "UX_Notes_NotebookId_TitleLower";

    public async Task<IReadOnlyList<NoteListItemResponse>> ListAsync(CancellationToken cancellationToken) =>
        await db.Notes.AsNoTracking().OrderByDescending(note => note.CreatedAt)
            .ThenByDescending(note => note.Id)
            .Select(note => new NoteListItemResponse(
                note.Id, note.Title,
                note.Content.Length > 160 ? note.Content.Substring(0, 160) : note.Content,
                note.Notebook.Name, note.CreatedAt))
            .ToListAsync(cancellationToken);

    public Task<Note?> FindAsync(Guid id, CancellationToken cancellationToken) =>
        db.Notes.AsNoTracking().SingleOrDefaultAsync(note => note.Id == id, cancellationToken);

    public async Task<Note> UpdateAsync(Note note, string updateFingerprint, CancellationToken cancellationToken)
    {
        while (true)
        {
            try
            {
                return await SaveUpdateAsync(note, updateFingerprint, cancellationToken);
            }
            catch (DbUpdateException exception) when (IsUniqueViolation(exception, UniqueTitleIndex))
            {
                // Another request claimed the same title between allocation and saving.
                db.ChangeTracker.Clear();
            }
        }
    }

    private async Task<Note> SaveUpdateAsync(Note note, string updateFingerprint, CancellationToken cancellationToken)
    {
        var tracked = await db.Notes.SingleAsync(value => value.Id == note.Id, cancellationToken);
        if (tracked.Version != note.Version)
            throw new NoteVersionConflictException();

        var title = tracked.Title == note.Title ? note.Title : await FindAvailableTitleAsync(note, note.Title, cancellationToken);
        tracked.UpdateContent(title, note.Content);
        tracked.RememberCreationFingerprint(note.CreationFingerprint);
        tracked.RecordSave(updateFingerprint);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new NoteVersionConflictException();
        }
        return tracked;
    }

    public async Task<(Note Note, bool Created)> AddOrGetAsync(Note note, CancellationToken cancellationToken)
    {
        var existing = await FindAsync(note.Id, cancellationToken);
        if (existing is not null)
            return (existing, false);

        var requestedTitle = note.Title;
        while (true)
        {
            var title = await FindAvailableTitleAsync(note, requestedTitle, cancellationToken);
            note.UpdateContent(title, note.Content);
            db.Notes.Add(note);
            try
            {
                await db.SaveChangesAsync(cancellationToken);
                // Return database values, including PostgreSQL's microsecond timestamp precision.
                await db.Entry(note).ReloadAsync(cancellationToken);
                return (note, true);
            }
            catch (DbUpdateException exception) when (
                IsUniqueViolation(exception, "PK_Notes") || IsUniqueViolation(exception, UniqueTitleIndex))
            {
                db.ChangeTracker.Clear();
                // A concurrent retry can collide on the ID or the title.
                existing = await FindAsync(note.Id, cancellationToken);
                if (existing is not null)
                    return (existing, false);
                if (!IsUniqueViolation(exception, UniqueTitleIndex))
                    throw;
            }
        }
    }

    private async Task<string> FindAvailableTitleAsync(Note note, string requestedTitle, CancellationToken cancellationToken)
    {
        var title = requestedTitle;
        for (var number = 2; await TitleExistsAsync(note, title, cancellationToken); number++)
            title = Note.NumberedTitle(requestedTitle, number);
        return title;
    }

    private Task<bool> TitleExistsAsync(Note note, string title, CancellationToken cancellationToken) =>
        db.Database.SqlQuery<bool>($"""
            SELECT EXISTS (
                SELECT 1 FROM "Notes"
                WHERE "NotebookId" = {note.NotebookId} AND "Id" <> {note.Id}
                    AND lower("Title") = lower({title})
            ) AS "Value"
            """).SingleAsync(cancellationToken);

    private static bool IsUniqueViolation(DbUpdateException exception, string constraintName) =>
        exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation } cause
        && cause.ConstraintName == constraintName;
}
