using MiniNote.Domain.Exceptions;

namespace MiniNote.Domain.Entities;

public sealed class ChecklistItem
{
    public const int MaxTextLength = 1000;
    public Guid Id { get; private set; }
    public string Text { get; private set; } = string.Empty;
    public bool IsCompleted { get; private set; }
    public int Position { get; private set; }

    private ChecklistItem() { }

    public static ChecklistItem Create(Guid id, string? text, bool isCompleted, int position)
    {
        if (id == Guid.Empty)
            throw new DomainValidationException("checklist", "Пункт должен иметь непустой идентификатор.");
        var item = new ChecklistItem { Id = id };
        item.Update(text, isCompleted, position);
        return item;
    }

    public void Update(string? text, bool isCompleted, int position)
    {
        if (string.IsNullOrWhiteSpace(text) || text.Length > MaxTextLength)
            throw new DomainValidationException("checklist", $"Текст пункта должен содержать от 1 до {MaxTextLength} символов.");
        Text = text.Trim();
        IsCompleted = isCompleted;
        Position = position;
    }
}
