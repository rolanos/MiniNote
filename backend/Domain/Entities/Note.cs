using MiniNote.Domain.Exceptions;

namespace MiniNote.Domain.Entities;

public sealed class Note
{
    public const int MaxTitleLength = 200;
    public const int MaxContentLength = 100_000;
    public const string DefaultTitle = "Без названия";

    public Guid Id { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public string Content { get; private set; } = string.Empty;
    public Guid NotebookId { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public long Version { get; private set; }
    public string? CreationFingerprint { get; private set; }
    public string? LastUpdateFingerprint { get; private set; }
    public Notebook Notebook { get; private set; } = null!;
    public List<ChecklistItem> Checklist { get; private set; } = [];

    private Note() { }

    public static Note Create(Guid id, string? title, string? content, DateTime utcNow)
    {
        if (id == Guid.Empty)
            throw new DomainValidationException("id", "Идентификатор запроса не может быть пустым.");
        var note = new Note
        {
            Id = id,
            NotebookId = global::MiniNote.Domain.Entities.Notebook.PersonalId,
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

    public void RecordSave(string updateFingerprint)
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

    public void ReplaceChecklist(IEnumerable<ChecklistItem> items)
    {
        var checklist = items.ToList();
        if (checklist.Count > 500 || checklist.Select(item => item.Id).Distinct().Count() != checklist.Count)
            throw new DomainValidationException("checklist", "Допустимо до 500 пунктов с уникальными идентификаторами.");
        Checklist = checklist;
    }
}
