using MiniNote.Application.Notes;
using MiniNote.Domain.Entities;

namespace MiniNote.Application.Abstractions;

public interface INoteRepository
{
    Task<IReadOnlyList<NoteListItemResponse>> ListAsync(NoteFilter filter, CancellationToken cancellationToken);
    Task<Note?> FindAsync(Guid id, CancellationToken cancellationToken);
    Task<Note> UpdateAsync(Note note, string updateFingerprint, CancellationToken cancellationToken);
    Task<Note?> OrganizeAsync(Guid id, long version, ChangeOrganizationRequest request, Tag? newTag,
        CancellationToken cancellationToken);
    Task<Note?> SetDeletedAsync(Guid id, long version, DateTime? deletedAt, CancellationToken cancellationToken);
    Task<IReadOnlyList<NotebookResponse>> ListNotebooksAsync(CancellationToken cancellationToken);
    Task AddNotebookAsync(Notebook notebook, CancellationToken cancellationToken);
    Task<IReadOnlyList<TagResponse>> ListTagsAsync(CancellationToken cancellationToken);
    // Returns the existing note when the same creation request is retried.
    Task<(Note Note, bool Created)> AddOrGetAsync(Note note, CancellationToken cancellationToken);
}
