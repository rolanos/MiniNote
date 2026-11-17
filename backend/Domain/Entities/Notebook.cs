namespace MiniNote.Domain.Entities;

public sealed class Notebook
{
    public static readonly Guid PersonalId = Guid.Parse("736cf9d1-eac5-420c-9b32-26e65f96b501");
    public const string PersonalName = "Личное";

    public Guid Id { get; private set; }
    public string Name { get; private set; } = string.Empty;

    private Notebook() { }
}
