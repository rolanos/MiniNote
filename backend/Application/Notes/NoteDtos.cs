namespace MiniNote.Application.Notes;

public sealed record ChecklistItemRequest(Guid Id, string? Text, bool IsCompleted = false);

public sealed record CreateNoteRequest(string? Title = null, string? Content = null,
    IReadOnlyList<ChecklistItemRequest>? Checklist = null, Guid? NotebookId = null);

public sealed record UpdateNoteRequest(string? Title = null, string? Content = null,
    IReadOnlyList<ChecklistItemRequest>? Checklist = null, long? Version = null);

public sealed record NoteFilter(Guid? NotebookId = null, Guid? TagId = null, string? Query = null, bool Trash = false);
public sealed record ChangeOrganizationRequest(long? Version, Guid? NotebookId = null,
    Guid? TagId = null, string? TagName = null, Guid? RemoveTagId = null);
public sealed record ChangeTrashRequest(long? Version);
public sealed record CreateNotebookRequest(string? Name);
public sealed record NotebookResponse(Guid Id, string Name);
public sealed record TagResponse(Guid Id, string Name);

public sealed record NoteResponse(
    Guid Id, string Title, string Content, Guid NotebookId, string NotebookName, DateTime CreatedAt, long Version,
    DateTime? DeletedAt, IReadOnlyList<TagResponse> Tags);

public sealed record NoteListItemResponse(
    Guid Id, string Title, string Preview, Guid NotebookId, string NotebookName, DateTime CreatedAt);
