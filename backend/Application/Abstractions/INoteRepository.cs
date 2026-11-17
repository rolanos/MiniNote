using MiniNote.Application.Notes;
using MiniNote.Domain.Entities;

namespace MiniNote.Application.Abstractions;

public interface INoteRepository
{
    Task<IReadOnlyList<NoteListItemResponse>> ListAsync(CancellationToken cancellationToken);
    Task<Note?> FindAsync(Guid id, CancellationToken cancellationToken);
    Task<Note> UpdateAsync(Note note, CancellationToken cancellationToken);
    // Returns the existing note when the same creation request is retried.
    Task<(Note Note, bool Created)> AddOrGetAsync(Note note, CancellationToken cancellationToken);
}
