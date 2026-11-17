import { useEffect, useRef, useState } from 'react';
import { createNote, getNote, updateNote, type Note, type NoteDraft } from '../../api/notes';
import { errorMessage } from '../../utils/errors';

type EditableNote = { requestId: string; draft: NoteDraft; note: Note | null };
type Destination = { kind: 'new' } | { kind: 'note'; id: string };
export type EditorState =
  | { status: 'empty' }
  | { status: 'loading'; noteId: string }
  | { status: 'loadFailed'; noteId: string; error: string }
  | ({ status: 'ready' | 'saving' } & EditableNote)
  | ({ status: 'failed'; error: string } & EditableNote);

const emptyDraft = (): NoteDraft => ({ title: '', content: '', checklist: [] });
const toDraft = (note: Note): NoteDraft => ({ title: note.title, content: note.content, checklist: note.checklist });
const equal = (left: NoteDraft, right: NoteDraft) => JSON.stringify(left) === JSON.stringify(right);

export function hasDraftChanges(state: EditorState) {
  return 'draft' in state && (!state.note || !equal(state.draft, toDraft(state.note)));
}

export function useNoteEditor(onSaved: (note: Note) => void) {
  const [state, setState] = useState<EditorState>({ status: 'empty' });
  const current = useRef<EditorState>(state);
  const [pendingDestination, setPendingDestination] = useState<Destination | null>(null);
  const inFlight = useRef<Promise<Note | null> | null>(null);
  const loadController = useRef<AbortController | null>(null);
  const navigationVersion = useRef(0);
  const lastChangedAt = useRef(0);

  function commit(next: EditorState) {
    current.current = next;
    setState(next);
  }

  useEffect(() => () => loadController.current?.abort(), []);

  const unsaved = hasDraftChanges(state) || state.status === 'saving' || state.status === 'failed';
  useEffect(() => {
    if (!unsaved) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsaved]);

  // One write at a time; input remains editable while the server is responding.
  function saveOnce(): Promise<Note | null> {
    if (inFlight.current) return inFlight.current;
    const snapshot = current.current;
    if (!('draft' in snapshot)) return Promise.resolve(null);
    if (!hasDraftChanges(snapshot) && snapshot.status !== 'failed') return Promise.resolve(snapshot.note);
    // Always retry creation with the same empty payload, even if input has advanced.
    // Once creation is confirmed, current input is saved with PUT on the same ID.
    const submitted = snapshot.note ? snapshot.draft : emptyDraft();
    commit({ status: 'saving', requestId: snapshot.requestId, draft: snapshot.draft, note: snapshot.note });
    const operation = (async () => {
      try {
        const saved = snapshot.note
          ? await updateNote(snapshot.note.id, submitted)
          : await createNote(submitted, snapshot.requestId);
        onSaved(saved);
        const latest = current.current;
        if ('draft' in latest && latest.requestId === snapshot.requestId) {
          commit({ status: 'ready', requestId: saved.id, note: saved,
            draft: equal(latest.draft, submitted) ? toDraft(saved) : latest.draft });
        }
        return saved;
      } catch (cause) {
        const latest = current.current;
        if ('draft' in latest) commit({ ...latest, status: 'failed', error: errorMessage(cause) });
        return null;
      } finally {
        inFlight.current = null;
      }
    })();
    inFlight.current = operation;
    return operation;
  }

  // Navigation and an explicit retry drain all latest edits before proceeding.
  async function flush(): Promise<boolean> {
    while ('draft' in current.current) {
      if (!hasDraftChanges(current.current) && !inFlight.current && current.current.status !== 'failed') return true;
      if (!await saveOnce()) return false;
    }
    return true;
  }

  useEffect(() => {
    if (state.status !== 'ready' || !hasDraftChanges(state)) return;
    const delay = Math.max(0, 1000 - (Date.now() - lastChangedAt.current));
    const timer = window.setTimeout(() => { void saveOnce(); }, delay);
    return () => window.clearTimeout(timer);
  }, [state]);

  async function navigate(destination: Destination) {
    loadController.current?.abort();
    if (destination.kind === 'new') {
      commit({ status: 'ready', note: null, requestId: crypto.randomUUID(), draft: emptyDraft() });
      await saveOnce();
      return;
    }
    const controller = new AbortController();
    loadController.current = controller;
    commit({ status: 'loading', noteId: destination.id });
    try {
      const note = await getNote(destination.id, controller.signal);
      if (!controller.signal.aborted) {
        onSaved(note);
        commit({ status: 'ready', note, requestId: note.id, draft: toDraft(note) });
      }
    } catch (cause) {
      if (!controller.signal.aborted) commit({ status: 'loadFailed', noteId: destination.id, error: errorMessage(cause) });
    }
  }

  async function requestNavigation(destination: Destination) {
    const latest = current.current;
    if (destination.kind === 'note' && 'note' in latest && latest.note?.id === destination.id) return;
    const version = ++navigationVersion.current;
    if (latest.status === 'failed') {
      setPendingDestination(destination);
      return;
    }
    if (!await flush()) {
      if (version === navigationVersion.current) setPendingDestination(destination);
      return;
    }
    if (version === navigationVersion.current) await navigate(destination);
  }

  function editDraft(update: (draft: NoteDraft) => NoteDraft) {
    const latest = current.current;
    if (!('draft' in latest)) return;
    lastChangedAt.current = Date.now();
    commit({ ...latest, draft: update(latest.draft) });
  }

  async function resolveNavigation(save: boolean) {
    const destination = pendingDestination;
    const version = ++navigationVersion.current;
    setPendingDestination(null);
    if (!destination) return;
    const canNavigate = !save || await flush();
    if (version !== navigationVersion.current) return;
    if (canNavigate) await navigate(destination);
    else setPendingDestination(destination);
  }

  return {
    state, pendingDestination,
    start: () => { void requestNavigation({ kind: 'new' }); },
    select: (id: string) => { void requestNavigation({ kind: 'note', id }); },
    change: (field: 'title' | 'content', value: string) => editDraft(draft => ({ ...draft, [field]: value })),
    addItem: (text: string) => {
      if (text.trim()) editDraft(draft => ({ ...draft, checklist: [...draft.checklist,
        { id: crypto.randomUUID(), text: text.trim(), isCompleted: false }] }));
    },
    toggleItem: (id: string) => editDraft(draft => ({ ...draft,
      checklist: draft.checklist.map(item => item.id === id ? { ...item, isCompleted: !item.isCompleted } : item) })),
    submit: flush,
    cancelNavigation: () => setPendingDestination(null),
    saveAndNavigate: () => resolveNavigation(true),
    discardAndNavigate: () => resolveNavigation(false),
  };
}
