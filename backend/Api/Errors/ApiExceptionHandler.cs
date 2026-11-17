using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using MiniNote.Application.Notes;
using MiniNote.Domain.Exceptions;

namespace MiniNote.Api.Errors;

public sealed class ApiExceptionHandler(IProblemDetailsService problemDetailsService) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken cancellationToken)
    {
        ProblemDetails problem = exception switch
        {
            DomainValidationException validation => new ValidationProblemDetails(
                new Dictionary<string, string[]> { [validation.Field] = [validation.Message] })
            {
                Status = StatusCodes.Status400BadRequest, Title = "Проверьте поля заметки."
            },
            IdempotencyConflictException => new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict, Title = "Повторный запрос содержит другие данные.",
                Detail = exception.Message
            },
            NoteVersionConflictException => new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict, Title = exception.Message
            },
            _ => new ProblemDetails
            {
                Status = StatusCodes.Status500InternalServerError,
                Title = "Не удалось выполнить запрос. Попробуйте ещё раз."
            }
        };
        context.Response.StatusCode = problem.Status!.Value;
        return await problemDetailsService.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = context, ProblemDetails = problem, Exception = exception
        });
    }
}
