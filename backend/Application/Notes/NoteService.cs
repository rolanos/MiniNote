using System.Security.Cryptography;
using System.Text.Json;
using MiniNote.Application.Abstractions;
using MiniNote.Domain.Entities;
using MiniNote.Domain.Exceptions;

namespace MiniNote.Application.Notes;

public sealed class NoteService(INoteRepository repository, TimeProvider timeProvider) : INoteService
{
    public Task<IReadOnlyList<NoteListItemResponse>> ListAsync(NoteFilter filter, CancellationToken cancellationToken) =>
        repository.ListAsync(filter, cancellationToken);

    public async Task<NoteResponse?> GetAsync(Guid id, CancellationToken cancellationToken)
    {
        var note = await repository.FindAsync(id, cancellationToken);
        return note is null ? null : ToResponse(note);
    }

    public async Task<NoteResponse?> UpdateAsync(Guid id, UpdateNoteRequest request, CancellationToken cancellationToken)
    {
        var note = await repository.FindAsync(id, cancellationToken);
        if (note is null)
            return null;

        var version = RequireVersion(request.Version);
        if (note.DeletedAt is not null)
            throw new NoteVersionConflictException();

        var stale = note.Version != version;
        var saved = stale ? ToResponse(note) : null;
        var previousFingerprint = stale || note.CreationFingerprint is null ? ContentFingerprint(note) : null;
        var items = InlineTasks.NormalizeLegacy(request.Checklist);
        note.UpdateContent(request.Title, InlineTasks.Append(request.Content, items));
        var updateFingerprint = ContentFingerprint(note);
        if (saved is not null)
        {
            // The saved title may have acquired a suffix when this request was first applied.
            if (previousFingerprint == updateFingerprint
                || (version == saved.Version - 1 && note.LastUpdateFingerprint == updateFingerprint))
                return saved;
            throw new NoteVersionConflictException();
        }

        note.RememberCreationFingerprint(previousFingerprint);
        return ToResponse(await repository.UpdateAsync(note, updateFingerprint, cancellationToken));
    }

    public async Task<(NoteResponse Note, bool Created)> CreateAsync(
        CreateNoteRequest request, Guid requestId, CancellationToken cancellationToken)
    {
        var notebookId = request.NotebookId ?? Notebook.PersonalId;
        var candidate = Note.Create(requestId, request.Title, request.Content, timeProvider.GetUtcNow().UtcDateTime, notebookId);
        var items = InlineTasks.NormalizeLegacy(request.Checklist);
        var fingerprint = ContentFingerprint(candidate, items);
        if (notebookId != Notebook.PersonalId)
            fingerprint = Convert.ToHexString(SHA256.HashData(JsonSerializer.SerializeToUtf8Bytes(new { fingerprint, notebookId })));
        candidate.RememberCreationFingerprint(fingerprint);
        candidate.UpdateContent(candidate.Title, InlineTasks.Append(candidate.Content, items));
        var (saved, created) = await repository.AddOrGetAsync(candidate, cancellationToken);
        if ((saved.CreationFingerprint ?? ContentFingerprint(saved)) != fingerprint)
            throw new IdempotencyConflictException();

        return (ToResponse(saved), created);
    }

    public async Task<NoteResponse?> OrganizeAsync(Guid id, ChangeOrganizationRequest request, CancellationToken cancellationToken)
    {
        var version = RequireVersion(request.Version);
        if (request.TagId.HasValue && request.TagName is not null)
            throw new DomainValidationException("tagName", "Выберите существующий тег или введите новый.");
        var newTag = request.TagName is null ? null : Tag.Create(request.TagName);
        var note = await repository.OrganizeAsync(id, version, request, newTag, cancellationToken);
        return note is null ? null : ToResponse(note);
    }

    public async Task<NoteResponse?> SetDeletedAsync(Guid id, ChangeTrashRequest request, bool deleted, CancellationToken cancellationToken)
    {
        var deletedAt = deleted ? timeProvider.GetUtcNow().UtcDateTime : (DateTime?)null;
        var note = await repository.SetDeletedAsync(id, RequireVersion(request.Version), deletedAt, cancellationToken);
        return note is null ? null : ToResponse(note);
    }

    public Task<IReadOnlyList<NotebookResponse>> ListNotebooksAsync(CancellationToken cancellationToken) =>
        repository.ListNotebooksAsync(cancellationToken);

    public Task<bool> ReorderNoteAsync(Guid id, ReorderRequest request, CancellationToken cancellationToken) =>
        repository.ReorderNoteAsync(id, request.TargetId, RequirePlacement(id, request), cancellationToken);

    public Task<bool> ReorderNotebookAsync(Guid id, ReorderRequest request, CancellationToken cancellationToken) =>
        repository.ReorderNotebookAsync(id, request.TargetId, RequirePlacement(id, request), cancellationToken);

    public async Task<NotebookResponse> CreateNotebookAsync(CreateNotebookRequest request, CancellationToken cancellationToken)
    {
        var notebook = Notebook.Create(request.Name);
        await repository.AddNotebookAsync(notebook, cancellationToken);
        return new NotebookResponse(notebook.Id, notebook.Name);
    }

    public Task<IReadOnlyList<TagResponse>> ListTagsAsync(CancellationToken cancellationToken) =>
        repository.ListTagsAsync(cancellationToken);

    private static NoteResponse ToResponse(Note note) => new(
        note.Id, note.Title, note.Content, note.NotebookId, note.Notebook.Name, note.CreatedAt, note.Version,
        note.DeletedAt, note.Tags.OrderBy(tag => tag.Name).Select(tag => new TagResponse(tag.Id, tag.Name)).ToArray(),
        note.SortPosition);

    private static bool RequirePlacement(Guid id, ReorderRequest request)
    {
        if (request.TargetId == Guid.Empty || request.TargetId == id)
            throw new DomainValidationException("targetId", "Выберите соседний элемент для перестановки.");
        return request.Before ?? throw new DomainValidationException("before", "Укажите сторону вставки.");
    }

    private static long RequireVersion(long? version) =>
        version is >= 0 ? version.Value
            : throw new DomainValidationException("version", "Укажите версию заметки из последнего ответа сервера.");

    private static string ContentFingerprint(Note note, IReadOnlyList<ChecklistItemRequest>? legacyChecklist = null)
    {
        // Keep the original fingerprint format so pre-upgrade create requests can be replayed.
        var payload = JsonSerializer.SerializeToUtf8Bytes(new { note.Title, note.Content, Checklist = legacyChecklist ?? [] });
        return Convert.ToHexString(SHA256.HashData(payload));
    }
}
