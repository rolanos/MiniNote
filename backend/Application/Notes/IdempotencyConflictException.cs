namespace MiniNote.Application.Notes;

public sealed class IdempotencyConflictException() : Exception(
    "Этот идентификатор запроса уже использован для другой заметки. Обновите список перед созданием новой.");
