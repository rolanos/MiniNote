namespace MiniNote.Application.Notes;

public sealed record ChecklistItemRequest(Guid Id, string? Text, bool IsCompleted = false);

public sealed record ChecklistItemResponse(Guid Id, string Text, bool IsCompleted);

public sealed record CreateNoteRequest(string? Title = null, string? Content = null,
    IReadOnlyList<ChecklistItemRequest>? Checklist = null);

public sealed record UpdateNoteRequest(string? Title = null, string? Content = null,
    IReadOnlyList<ChecklistItemRequest>? Checklist = null);

public sealed record NoteResponse(
    Guid Id, string Title, string Content, Guid NotebookId, string NotebookName, DateTime CreatedAt,
    IReadOnlyList<ChecklistItemResponse> Checklist);

public sealed record NoteListItemResponse(
    Guid Id, string Title, string Preview, string NotebookName, DateTime CreatedAt);
