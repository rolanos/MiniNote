using MiniNote.Domain.Exceptions;

namespace MiniNote.Domain.Entities;

public sealed class Tag
{
    public const int MaxNameLength = 100;
    public Guid Id { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string NormalizedName { get; private set; } = string.Empty;

    private Tag() { }

    public static Tag Create(string? name)
    {
        var trimmed = name?.Trim();
        if (string.IsNullOrEmpty(trimmed) || trimmed.Length > MaxNameLength)
            throw new DomainValidationException("tagName", "Укажите название тега длиной от 1 до 100 символов.");
        return new Tag { Id = Guid.NewGuid(), Name = trimmed, NormalizedName = trimmed.ToUpperInvariant() };
    }
}
