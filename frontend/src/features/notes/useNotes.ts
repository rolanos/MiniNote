import { useCallback, useEffect, useRef, useState } from 'react';
import { listNotes, type Note, type NoteFilter, type NoteListItem } from '../../api/notes';
import { errorMessage } from '../../utils/errors';

type ListState = { filter: NoteFilter; notes: NoteListItem[]; loading: boolean; error: string };

export function useNotes(filter: NoteFilter) {
  const [result, setResult] = useState<ListState>({ filter, notes: [], loading: true, error: '' });
  const [revision, setRevision] = useState(0);
  const sequence = useRef(0);

  const reload = useCallback(() => {
    sequence.current++;
    setRevision(value => value + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const requestId = ++sequence.current;
    setResult(current => ({
      filter, notes: current.filter === filter ? current.notes : [], loading: true, error: '',
    }));

    listNotes(filter, controller.signal)
      .then(notes => {
        if (!controller.signal.aborted && requestId === sequence.current)
          setResult({ filter, notes, loading: false, error: '' });
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted && requestId === sequence.current)
          setResult(current => ({ ...current, loading: false, error: errorMessage(cause) }));
      });

    return () => controller.abort();
  }, [filter, revision]);

  const upsert = useCallback((note: Note) => {
    const matches = Boolean(filter.trash) === Boolean(note.deletedAt)
      && (!filter.notebookId || filter.notebookId === note.notebookId)
      && (!filter.tagId || note.tags.some(tag => tag.id === filter.tagId));
    setResult(current => {
      if (current.filter !== filter || (matches && filter.query)) return current;
      const notes = current.notes.filter(existing => existing.id !== note.id);
      if (matches && !filter.query) {
        notes.push({
          id: note.id, title: note.title, notebookId: note.notebookId, notebookName: note.notebookName,
          preview: Array.from(note.content.slice(0, 320)).slice(0, 160).join(''), createdAt: note.createdAt,
          sortPosition: current.notes.find(existing => existing.id === note.id)?.sortPosition ?? note.sortPosition,
        });
        notes.sort((a, b) => (filter.trash ? 0 : (a.sortPosition ?? 0) - (b.sortPosition ?? 0))
          || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
      }
      return { ...current, notes };
    });
    reload();
  }, [filter, reload]);

  const state = result.filter === filter ? result : { notes: [], loading: true, error: '' };
  return { ...state, upsert, reload };
}
