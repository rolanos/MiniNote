using MiniNote.Domain.Exceptions;

namespace MiniNote.Application.Notes;

internal static class InlineTasks
{
    // Older API clients can still submit a separate array. It is folded into the body on write.
    public static IReadOnlyList<ChecklistItemRequest> NormalizeLegacy(IReadOnlyList<ChecklistItemRequest>? checklist)
    {
        if (checklist is null or { Count: 0 })
            return [];

        if (checklist.Count > 500 || checklist.Any(item => item is null || item.Id == Guid.Empty)
            || checklist.Select(item => item.Id).Distinct().Count() != checklist.Count)
            throw new DomainValidationException("checklist", "Допустимо до 500 пунктов с уникальными идентификаторами.");

        if (checklist.Any(item => string.IsNullOrWhiteSpace(item.Text) || item.Text.Length > 1000))
            throw new DomainValidationException("checklist", "Текст пункта должен содержать от 1 до 1000 символов.");

        return checklist.Select(item => item with { Text = item.Text!.Trim() }).ToArray();
    }

    public static string Append(string? content, IReadOnlyList<ChecklistItemRequest> items)
    {
        if (items.Count == 0)
            return content ?? string.Empty;

        var tasks = string.Join("\n", items.Select(item =>
            (item.IsCompleted ? "- [x] " : "- [ ] ") + item.Text!.Replace("\r\n", "\n").Replace('\r', '\n').Replace("\n", "\n  | ")));
        return string.IsNullOrEmpty(content) ? tasks : content + "\n\n" + tasks;
    }
}
