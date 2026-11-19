using Microsoft.EntityFrameworkCore;
using MiniNote.Application.Abstractions;
using MiniNote.Application.Notes;
using MiniNote.Domain.Entities;
using MiniNote.Domain.Exceptions;
using Npgsql;

namespace MiniNote.Infrastructure.Persistence;

public sealed class NoteRepository(NotesDbContext db) : INoteRepository
{
    private const string UniqueTitleIndex = "UX_Notes_NotebookId_TitleLower";

    public async Task<IReadOnlyList<NoteListItemResponse>> ListAsync(NoteFilter filter, CancellationToken cancellationToken)
    {
        var notes = db.Notes.AsNoTracking().Where(note => filter.Trash ? note.DeletedAt != null : note.DeletedAt == null);
        if (!filter.Trash && filter.NotebookId is Guid notebookId)
            notes = notes.Where(note => note.NotebookId == notebookId);
        if (!filter.Trash && filter.TagId is Guid tagId)
            notes = notes.Where(note => note.Tags.Any(tag => tag.Id == tagId));
        if (!filter.Trash && !string.IsNullOrWhiteSpace(filter.Query))
        {
            var escaped = filter.Query.Trim().Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_");
            var pattern = "%" + escaped + "%";
            notes = notes.Where(note => EF.Functions.ILike(note.Title, pattern, "\\")
                || EF.Functions.ILike(note.Content, pattern, "\\"));
        }

        var ordered = filter.Trash ? notes.OrderByDescending(note => note.CreatedAt).ThenByDescending(note => note.Id)
            : OrderNotes(notes);
        return await ordered
            .Select(note => new NoteListItemResponse(
                note.Id, note.Title,
                note.Content.Length > 160 ? note.Content.Substring(0, 160) : note.Content,
                note.NotebookId, note.Notebook.Name, note.CreatedAt, note.SortPosition))
            .ToListAsync(cancellationToken);
    }

    private static IOrderedQueryable<Note> OrderNotes(IQueryable<Note> notes) =>
        notes.OrderBy(note => note.SortPosition != null).ThenBy(note => note.SortPosition)
            .ThenByDescending(note => note.CreatedAt).ThenByDescending(note => note.Id);

    public Task<Note?> FindAsync(Guid id, CancellationToken cancellationToken) =>
        WithOrganization().AsNoTracking().SingleOrDefaultAsync(note => note.Id == id, cancellationToken);

    private IQueryable<Note> WithOrganization() => db.Notes.Include(note => note.Notebook).Include(note => note.Tags);

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
        var tracked = await WithOrganization().SingleAsync(value => value.Id == note.Id, cancellationToken);
        RequireActiveVersion(tracked, note.Version);

        var title = tracked.Title == note.Title ? note.Title : await FindAvailableTitleAsync(note, note.Title, cancellationToken);
        tracked.UpdateContent(title, note.Content);
        tracked.RememberCreationFingerprint(note.CreationFingerprint);
        tracked.RecordSave(updateFingerprint);
        await SaveVersionedAsync(cancellationToken);
        return tracked;
    }

    public async Task<Note?> OrganizeAsync(Guid id, long version, ChangeOrganizationRequest request, Tag? newTag,
        CancellationToken cancellationToken)
    {
        while (true)
        {
            var note = await WithOrganization().SingleOrDefaultAsync(value => value.Id == id, cancellationToken);
            if (note is null) return null;
            RequireActiveVersion(note, version);

            if (request.NotebookId is Guid notebookId && note.NotebookId != notebookId)
            {
                note.MoveTo(await RequireNotebookAsync(notebookId, cancellationToken));
                note.UpdateContent(await FindAvailableTitleAsync(note, note.Title, cancellationToken), note.Content);
            }

            if (request.RemoveTagId is Guid removeTagId)
                note.Tags.RemoveAll(tag => tag.Id == removeTagId);
            var tagToAdd = request.TagId is Guid tagId
                ? await db.Tags.FindAsync([tagId], cancellationToken)
                    ?? throw new DomainValidationException("tagId", "Тег не найден.")
                : null;
            if (newTag is not null)
            {
                tagToAdd = await db.Tags.SingleOrDefaultAsync(tag => tag.NormalizedName == newTag.NormalizedName, cancellationToken);
                if (tagToAdd is null)
                {
                    db.Tags.Add(newTag);
                    tagToAdd = newTag;
                }
            }
            if (tagToAdd is not null && !note.Tags.Any(tag => tag.Id == tagToAdd.Id))
                note.Tags.Add(tagToAdd);

            note.RecordSave(null);
            try
            {
                await SaveVersionedAsync(cancellationToken);
                return note;
            }
            catch (DbUpdateException exception) when (IsUniqueViolation(exception, UniqueTitleIndex)
                || IsUniqueViolation(exception, "IX_Tags_NormalizedName"))
            {
                db.ChangeTracker.Clear();
            }
        }
    }

    public async Task<Note?> SetDeletedAsync(Guid id, long version, DateTime? deletedAt, CancellationToken cancellationToken)
    {
        var note = await WithOrganization().SingleOrDefaultAsync(value => value.Id == id, cancellationToken);
        if (note is null || (note.DeletedAt is null) == (deletedAt is null))
            return note;
        if (note.Version != version)
            throw new NoteVersionConflictException();

        note.SetDeletedAt(deletedAt);
        note.RecordSave(null);
        await SaveVersionedAsync(cancellationToken);
        return note;
    }

    public async Task<IReadOnlyList<NotebookResponse>> ListNotebooksAsync(CancellationToken cancellationToken) =>
        await OrderedNotebooks()
            .Select(notebook => new NotebookResponse(notebook.Id, notebook.Name)).ToListAsync(cancellationToken);

    private IOrderedQueryable<Notebook> OrderedNotebooks() =>
        db.Notebooks.AsNoTracking().OrderBy(notebook => notebook.SortPosition == null).ThenBy(notebook => notebook.SortPosition)
            .ThenByDescending(notebook => notebook.Id == Notebook.PersonalId)
            .ThenBy(notebook => notebook.Name).ThenBy(notebook => notebook.Id);

    public Task<bool> ReorderNoteAsync(Guid id, Guid targetId, bool before, CancellationToken cancellationToken) =>
        ReorderAsync(id, targetId, before, OrderNotes(db.Notes.AsNoTracking())
            .Select(note => new ReorderItem(note.Id, note.DeletedAt == null)),
            "LOCK TABLE \"Notes\" IN SHARE ROW EXCLUSIVE MODE",
            order => $"""
                UPDATE "Notes" AS item SET "SortPosition" = ordered.position::int
                FROM unnest({order}::uuid[]) WITH ORDINALITY AS ordered(id, position)
                WHERE item."Id" = ordered.id AND item."SortPosition" IS DISTINCT FROM ordered.position::int
                """, cancellationToken);

    public Task<bool> ReorderNotebookAsync(Guid id, Guid targetId, bool before, CancellationToken cancellationToken) =>
        ReorderAsync(id, targetId, before, OrderedNotebooks().Select(notebook => new ReorderItem(notebook.Id, true)),
            "LOCK TABLE \"Notebooks\" IN SHARE ROW EXCLUSIVE MODE",
            order => $"""
                UPDATE "Notebooks" AS item SET "SortPosition" = ordered.position::int
                FROM unnest({order}::uuid[]) WITH ORDINALITY AS ordered(id, position)
                WHERE item."Id" = ordered.id AND item."SortPosition" IS DISTINCT FROM ordered.position::int
                """, cancellationToken);

    private sealed record ReorderItem(Guid Id, bool Active);

    private Task<bool> ReorderAsync(Guid id, Guid targetId, bool before, IQueryable<ReorderItem> query,
        string lockCommand, Func<Guid[], FormattableString> updateCommand, CancellationToken cancellationToken) =>
        db.Database.CreateExecutionStrategy().ExecuteAsync(async token =>
        {
            // Serialize changes from other tabs with the snapshot used to compute positions.
            await using var transaction = await db.Database.BeginTransactionAsync(token);
            await db.Database.ExecuteSqlRawAsync(lockCommand, token);
            var items = await query.ToListAsync(token);
            if (!items.Any(item => item.Id == id && item.Active) || !items.Any(item => item.Id == targetId && item.Active))
                return false;

            var order = items.Select(item => item.Id).Where(itemId => itemId != id).ToList();
            var targetIndex = order.IndexOf(targetId);
            order.Insert(before ? targetIndex : targetIndex + 1, id);
            await db.Database.ExecuteSqlInterpolatedAsync(updateCommand(order.ToArray()), token);
            await transaction.CommitAsync(token);
            return true;
        }, cancellationToken);

    public async Task AddNotebookAsync(Notebook notebook, CancellationToken cancellationToken)
    {
        db.Notebooks.Add(notebook);
        await db.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<TagResponse>> ListTagsAsync(CancellationToken cancellationToken)
    {
        var activeTagIds = db.Notes.Where(note => note.DeletedAt == null)
            .SelectMany(note => note.Tags).Select(tag => tag.Id);
        return await db.Tags.AsNoTracking().Where(tag => activeTagIds.Contains(tag.Id)).OrderBy(tag => tag.Name)
            .Select(tag => new TagResponse(tag.Id, tag.Name)).ToListAsync(cancellationToken);
    }

    public async Task<(Note Note, bool Created)> AddOrGetAsync(Note note, CancellationToken cancellationToken)
    {
        var existing = await FindAsync(note.Id, cancellationToken);
        if (existing is not null)
            return (existing, false);

        var requestedTitle = note.Title;
        while (true)
        {
            // A retry clears tracking, so bind the note to this attempt's tracked notebook.
            note.MoveTo(await RequireNotebookAsync(note.NotebookId, cancellationToken));
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

    private async Task<Notebook> RequireNotebookAsync(Guid id, CancellationToken cancellationToken) =>
        await db.Notebooks.FindAsync([id], cancellationToken)
            ?? throw new DomainValidationException("notebookId", "Блокнот не найден.");

    private static void RequireActiveVersion(Note note, long version)
    {
        if (note.Version != version || note.DeletedAt is not null)
            throw new NoteVersionConflictException();
    }

    private async Task SaveVersionedAsync(CancellationToken cancellationToken)
    {
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException exception) when (exception is DbUpdateConcurrencyException
            || IsUniqueViolation(exception, "PK_NoteTags"))
        {
            throw new NoteVersionConflictException();
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
