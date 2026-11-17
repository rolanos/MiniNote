using MiniNote.Application.Abstractions;
using MiniNote.Domain.Entities;

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

        note.UpdateContent(request.Title, request.Content);
        if (request.Checklist is not null) note.ReplaceChecklist(ToChecklist(request.Checklist));
        return ToResponse(await repository.UpdateAsync(note, cancellationToken));
    }

    public async Task<(NoteResponse Note, bool Created)> CreateAsync(
        CreateNoteRequest request, Guid requestId, CancellationToken cancellationToken)
    {
        var candidate = Note.Create(requestId, request.Title, request.Content, timeProvider.GetUtcNow().UtcDateTime);
        candidate.ReplaceChecklist(ToChecklist(request.Checklist ?? []));
        var (saved, created) = await repository.AddOrGetAsync(candidate, cancellationToken);
        if (saved.Title != candidate.Title || saved.Content != candidate.Content
            || !saved.Checklist.OrderBy(item => item.Position).Select(ToChecklistResponse)
                .SequenceEqual(candidate.Checklist.Select(ToChecklistResponse)))
            throw new IdempotencyConflictException();

        return (ToResponse(saved), created);
    }

    private static NoteResponse ToResponse(Note note) => new(
        note.Id, note.Title, note.Content, note.NotebookId, Notebook.PersonalName, note.CreatedAt,
        note.Checklist.OrderBy(item => item.Position).Select(ToChecklistResponse).ToArray());

    private static IEnumerable<ChecklistItem> ToChecklist(IReadOnlyList<ChecklistItemRequest> items) =>
        items.Select((item, position) => ChecklistItem.Create(item.Id, item.Text, item.IsCompleted, position));

    private static ChecklistItemResponse ToChecklistResponse(ChecklistItem item) =>
        new(item.Id, item.Text, item.IsCompleted);
}
