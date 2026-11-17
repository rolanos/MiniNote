import { useCallback, useEffect, useRef, useState } from 'react';
import { listNotes, type Note, type NoteListItem } from '../../api/notes';
import { errorMessage } from '../../utils/errors';

export function useNotes() {
  const [notes, setNotes] = useState<NoteListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const writeVersion = useRef(0);
  const changedNotes = useRef(new Map<string, number>());

  useEffect(() => {
    const controller = new AbortController();
    const requestedVersion = writeVersion.current;
    setLoading(true);
    setError('');

    listNotes(controller.signal)
      .then(items => {
        if (controller.signal.aborted) return;
        // Preserve creates and edits completed after this list request started.
        setNotes(current => {
          const combined = new Map([...current, ...items].map(note => [note.id, note]));
          for (const note of current) {
            if ((changedNotes.current.get(note.id) ?? 0) > requestedVersion) combined.set(note.id, note);
          }
          return [...combined.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        });
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(errorMessage(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [revision]);

  const upsert = useCallback((note: Note) => {
    changedNotes.current.set(note.id, ++writeVersion.current);
    const item: NoteListItem = {
      id: note.id,
      title: note.title,
      preview: Array.from(note.content).slice(0, 160).join(''),
      notebookName: note.notebookName,
      createdAt: note.createdAt,
    };
    setNotes(current => [item, ...current.filter(existing => existing.id !== note.id)]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    setLoading(false);
  }, []);

  return { notes, loading, error, upsert, reload: () => setRevision(value => value + 1) };
}
