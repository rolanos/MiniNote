namespace MiniNote.Application.Notes;

public sealed class NoteVersionConflictException() : Exception("Заметка уже изменена в другой вкладке.");
