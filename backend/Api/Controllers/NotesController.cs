using Microsoft.AspNetCore.Mvc;
using MiniNote.Application.Notes;

namespace MiniNote.Api.Controllers;

[ApiController]
[Route("api/notes")]
[Produces("application/json")]
public sealed class NotesController(INoteService notes) : ControllerBase
{
    /// <summary>Список заметок с учётом поиска, фильтров или режима корзины.</summary>
    [HttpGet]
    [ProducesResponseType<IReadOnlyList<NoteListItemResponse>>(StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<NoteListItemResponse>>> List(
        [FromQuery] NoteFilter filter, CancellationToken cancellationToken) =>
        Ok(await notes.ListAsync(filter, cancellationToken));

    /// <summary>Открыть заголовок, полный текст и чек-лист заметки.</summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType<NoteResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<NoteResponse>> Get(Guid id, CancellationToken cancellationToken)
    {
        var note = await notes.GetAsync(id, cancellationToken);
        return note is null ? NoteNotFound() : Ok(note);
    }

    /// <summary>Сохранить заголовок, текст и чек-лист заметки.</summary>
    /// <remarks>Передайте версию из последнего ответа сервера. При конфликте версий возвращается 409.</remarks>
    [HttpPut("{id:guid}")]
    [ProducesResponseType<NoteResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<NoteResponse>> Update(
        Guid id, [FromBody] UpdateNoteRequest request, CancellationToken cancellationToken)
    {
        var note = await notes.UpdateAsync(id, request, cancellationToken);
        return note is null ? NoteNotFound() : Ok(note);
    }

    [HttpPatch("{id:guid}/organization")]
    public async Task<ActionResult<NoteResponse>> Organize(
        Guid id, ChangeOrganizationRequest request, CancellationToken cancellationToken)
    {
        var note = await notes.OrganizeAsync(id, request, cancellationToken);
        return note is null ? NoteNotFound() : Ok(note);
    }

    [HttpPatch("{id:guid}/position")]
    public async Task<IActionResult> Reorder(Guid id, ReorderRequest request, CancellationToken cancellationToken) =>
        await notes.ReorderNoteAsync(id, request, cancellationToken) ? NoContent() : NoteNotFound();

    [HttpPost("{id:guid}/trash")]
    public Task<ActionResult<NoteResponse>> Trash(Guid id, ChangeTrashRequest request, CancellationToken cancellationToken) =>
        SetDeleted(id, request, true, cancellationToken);

    [HttpPost("{id:guid}/restore")]
    public Task<ActionResult<NoteResponse>> Restore(Guid id, ChangeTrashRequest request, CancellationToken cancellationToken) =>
        SetDeleted(id, request, false, cancellationToken);

    private async Task<ActionResult<NoteResponse>> SetDeleted(
        Guid id, ChangeTrashRequest request, bool deleted, CancellationToken cancellationToken)
    {
        var note = await notes.SetDeletedAsync(id, request, deleted, cancellationToken);
        return note is null ? NoteNotFound() : Ok(note);
    }

    private NotFoundObjectResult NoteNotFound() => NotFound(new ProblemDetails
    {
        Status = StatusCodes.Status404NotFound, Title = "Заметка не найдена."
    });

    /// <summary>Создать заметку в выбранном блокноте или в блокноте «Личное».</summary>
    /// <remarks>Необязательный Idempotency-Key (UUID) позволяет безопасно повторить запрос после ошибки сети.</remarks>
    [HttpPost]
    [ProducesResponseType<NoteResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType<NoteResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<NoteResponse>> Create(
        [FromBody] CreateNoteRequest request,
        [FromHeader(Name = "Idempotency-Key")] string? idempotencyKey,
        CancellationToken cancellationToken)
    {
        var requestId = Guid.NewGuid();
        if (idempotencyKey is not null && (!Guid.TryParse(idempotencyKey, out requestId) || requestId == Guid.Empty))
        {
            ModelState.AddModelError("Idempotency-Key", "Ожидается непустой UUID.");
            return ValidationProblem(ModelState);
        }

        var result = await notes.CreateAsync(request, requestId, cancellationToken);
        return result.Created ? StatusCode(StatusCodes.Status201Created, result.Note) : Ok(result.Note);
    }
}
