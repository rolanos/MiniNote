using Microsoft.AspNetCore.Mvc;
using MiniNote.Application.Notes;

namespace MiniNote.Api.Controllers;

[ApiController]
[Route("api/tags")]
public sealed class TagsController(INoteService notes) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<TagResponse>>> List(CancellationToken cancellationToken) =>
        Ok(await notes.ListTagsAsync(cancellationToken));
}
