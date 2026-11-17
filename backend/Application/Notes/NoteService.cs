using System.Security.Cryptography;
using System.Text.Json;
using MiniNote.Application.Abstractions;
using MiniNote.Domain.Entities;
using MiniNote.Domain.Exceptions;

namespace MiniNote.Application.Notes;

public sealed class NoteService(INoteRepository repository, TimeProvider timeProvider) : INoteService
{
    public Task<IReadOnlyList<NoteListItemResponse>> ListAsync(CancellationToken cancellationToken) =>
        repository.ListAsync(cancellationToken);

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

        if (request.Version is null or < 0)
            throw new DomainValidationException("version", "Укажите версию заметки из последнего ответа сервера.");

        var stale = note.Version != request.Version;
        var saved = stale ? ToResponse(note) : null;
        var previousFingerprint = stale || note.CreationFingerprint is null ? ContentFingerprint(note) : null;
        var items = InlineTasks.NormalizeLegacy(request.Checklist);
        note.UpdateContent(request.Title, InlineTasks.Append(request.Content, items));
        var updateFingerprint = ContentFingerprint(note);
        if (saved is not null)
        {
            // The saved title may have acquired a suffix when this request was first applied.
            if (previousFingerprint == updateFingerprint
                || (request.Version == saved.Version - 1 && note.LastUpdateFingerprint == updateFingerprint))
                return saved;
            throw new NoteVersionConflictException();
        }

        note.RememberCreationFingerprint(previousFingerprint);
        return ToResponse(await repository.UpdateAsync(note, updateFingerprint, cancellationToken));
    }

    public async Task<(NoteResponse Note, bool Created)> CreateAsync(
        CreateNoteRequest request, Guid requestId, CancellationToken cancellationToken)
    {
        var candidate = Note.Create(requestId, request.Title, request.Content, timeProvider.GetUtcNow().UtcDateTime);
        var items = InlineTasks.NormalizeLegacy(request.Checklist);
        var fingerprint = ContentFingerprint(candidate, items);
        candidate.RememberCreationFingerprint(fingerprint);
        candidate.UpdateContent(candidate.Title, InlineTasks.Append(candidate.Content, items));
        var (saved, created) = await repository.AddOrGetAsync(candidate, cancellationToken);
        if ((saved.CreationFingerprint ?? ContentFingerprint(saved)) != fingerprint)
            throw new IdempotencyConflictException();

        return (ToResponse(saved), created);
    }

    private static NoteResponse ToResponse(Note note) => new(
        note.Id, note.Title, note.Content, note.NotebookId, Notebook.PersonalName, note.CreatedAt, note.Version);

    private static string ContentFingerprint(Note note, IReadOnlyList<ChecklistItemRequest>? legacyChecklist = null)
    {
        // Keep the original fingerprint format so pre-upgrade create requests can be replayed.
        var payload = JsonSerializer.SerializeToUtf8Bytes(new { note.Title, note.Content, Checklist = legacyChecklist ?? [] });
        return Convert.ToHexString(SHA256.HashData(payload));
    }
}
