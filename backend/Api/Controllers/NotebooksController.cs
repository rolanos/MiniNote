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

    [HttpPost]
    public async Task<ActionResult<NotebookResponse>> Create(CreateNotebookRequest request, CancellationToken cancellationToken) =>
        StatusCode(StatusCodes.Status201Created, await notes.CreateNotebookAsync(request, cancellationToken));
}
