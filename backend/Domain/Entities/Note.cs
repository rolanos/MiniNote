using MiniNote.Domain.Exceptions;

namespace MiniNote.Domain.Entities;

public sealed class Note
{
    public const int MaxTitleLength = 200;
    public const int MaxContentLength = 2_610_000;
    public const string DefaultTitle = "Без названия";

    public Guid Id { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public string Content { get; private set; } = string.Empty;
    public Guid NotebookId { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime? DeletedAt { get; private set; }
    public int? SortPosition { get; private set; }
    public long Version { get; private set; }
    public string? CreationFingerprint { get; private set; }
    public string? LastUpdateFingerprint { get; private set; }
    public Notebook Notebook { get; private set; } = null!;
    public List<Tag> Tags { get; } = [];

    private Note() { }

    public static Note Create(Guid id, string? title, string? content, DateTime utcNow, Guid notebookId)
    {
        if (id == Guid.Empty)
            throw new DomainValidationException("id", "Идентификатор запроса не может быть пустым.");
        var note = new Note
        {
            Id = id,
            NotebookId = notebookId,
            CreatedAt = DateTime.SpecifyKind(utcNow, DateTimeKind.Utc)
        };
        note.UpdateContent(title, content);
        return note;
    }

    public void UpdateContent(string? title, string? content)
    {
        if (title?.Length > MaxTitleLength)
            throw new DomainValidationException("title", $"Заголовок не должен превышать {MaxTitleLength} символов.");
        if (content?.Length > MaxContentLength)
            throw new DomainValidationException("content", $"Текст не должен превышать {MaxContentLength} символов.");

        Title = string.IsNullOrWhiteSpace(title) ? DefaultTitle : title.Trim();
        Content = content ?? string.Empty;
    }

    public void RememberCreationFingerprint(string? fingerprint) => CreationFingerprint ??= fingerprint;

    public void MoveTo(Notebook notebook)
    {
        Notebook = notebook;
        NotebookId = notebook.Id;
    }

    public void SetDeletedAt(DateTime? utcDate) => DeletedAt = utcDate;

    public void RecordSave(string? updateFingerprint)
    {
        Version++;
        LastUpdateFingerprint = updateFingerprint;
    }

    public static string NumberedTitle(string title, int number)
    {
        var suffix = FormattableString.Invariant($" ({number})");
        var length = Math.Min(title.Length, MaxTitleLength - suffix.Length);
        if (length > 0 && char.IsHighSurrogate(title[length - 1]))
            length--;
        return title[..length].TrimEnd() + suffix;
    }
}
