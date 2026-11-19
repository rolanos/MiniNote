using MiniNote.Domain.Exceptions;

namespace MiniNote.Domain.Entities;

public sealed class Notebook
{
    public static readonly Guid PersonalId = Guid.Parse("736cf9d1-eac5-420c-9b32-26e65f96b501");
    public const string PersonalName = "Личное";
    public const int MaxNameLength = 100;

    public Guid Id { get; private set; }
    public string Name { get; private set; } = string.Empty;

    private Notebook() { }

    public static Notebook Create(string? name)
    {
        var trimmed = name?.Trim();
        if (string.IsNullOrEmpty(trimmed) || trimmed.Length > MaxNameLength)
            throw new DomainValidationException("name", "Укажите название блокнота длиной от 1 до 100 символов.");
        return new Notebook { Id = Guid.NewGuid(), Name = trimmed };
    }
}
