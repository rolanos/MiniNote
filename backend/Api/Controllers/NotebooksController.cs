using Microsoft.AspNetCore.Mvc;
using MiniNote.Application.Notes;

namespace MiniNote.Api.Controllers;

[ApiController]
[Route("api/notebooks")]
public sealed class NotebooksController(INoteService notes) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<NotebookResponse>>> List(CancellationToken cancellationToken) =>
        Ok(await notes.ListNotebooksAsync(cancellationToken));

    [HttpPatch("{id:guid}/position")]
    public async Task<IActionResult> Reorder(Guid id, ReorderRequest request, CancellationToken cancellationToken) =>
        await notes.ReorderNotebookAsync(id, request, cancellationToken) ? NoContent() : NotFound(new ProblemDetails
        {
            Status = StatusCodes.Status404NotFound, Title = "Блокнот не найден."
        });

    [HttpPost]
    public async Task<ActionResult<NotebookResponse>> Create(CreateNotebookRequest request, CancellationToken cancellationToken) =>
        StatusCode(StatusCodes.Status201Created, await notes.CreateNotebookAsync(request, cancellationToken));
}
