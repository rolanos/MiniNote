namespace MiniNote.Application.Notes;

public interface INoteService
{
    Task<IReadOnlyList<NoteListItemResponse>> ListAsync(NoteFilter filter, CancellationToken cancellationToken);
    Task<NoteResponse?> GetAsync(Guid id, CancellationToken cancellationToken);
    Task<NoteResponse?> UpdateAsync(Guid id, UpdateNoteRequest request, CancellationToken cancellationToken);
    Task<NoteResponse?> OrganizeAsync(Guid id, ChangeOrganizationRequest request, CancellationToken cancellationToken);
    Task<NoteResponse?> SetDeletedAsync(Guid id, ChangeTrashRequest request, bool deleted, CancellationToken cancellationToken);
    Task<IReadOnlyList<NotebookResponse>> ListNotebooksAsync(CancellationToken cancellationToken);
    Task<bool> ReorderNoteAsync(Guid id, ReorderRequest request, CancellationToken cancellationToken);
    Task<bool> ReorderNotebookAsync(Guid id, ReorderRequest request, CancellationToken cancellationToken);
    Task<NotebookResponse> CreateNotebookAsync(CreateNotebookRequest request, CancellationToken cancellationToken);
    Task<IReadOnlyList<TagResponse>> ListTagsAsync(CancellationToken cancellationToken);
    Task<(NoteResponse Note, bool Created)> CreateAsync(
        CreateNoteRequest request, Guid requestId, CancellationToken cancellationToken);
}
