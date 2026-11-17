namespace MiniNote.Application.Notes;

public interface INoteService
{
    Task<IReadOnlyList<NoteListItemResponse>> ListAsync(CancellationToken cancellationToken);
    Task<NoteResponse?> GetAsync(Guid id, CancellationToken cancellationToken);
    Task<NoteResponse?> UpdateAsync(Guid id, UpdateNoteRequest request, CancellationToken cancellationToken);
    Task<(NoteResponse Note, bool Created)> CreateAsync(
        CreateNoteRequest request, Guid requestId, CancellationToken cancellationToken);
}
