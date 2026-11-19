import { useEffect, useMemo, useState } from 'react';
import { listNotebooks, listTags, organizeNote, reorderItem, setNoteInTrash, type Notebook, type OrganizationChange, type Tag } from './api/notes';
import { Icon } from './components/Icon';
import { NoteEditor } from './features/notes/NoteEditor';
import { NoteOrganization } from './features/notes/NoteOrganization';
import { NotebookSidebar, type NoteMove, type NoteView } from './features/notes/NotebookSidebar';
import { NotesPanel } from './features/notes/NotesPanel';
import { useNoteEditor } from './features/notes/useNoteEditor';
import { useNotes } from './features/notes/useNotes';
import { noteDragType } from './features/notes/useReorderDrop';
import { UnsavedChangesDialog } from './features/notes/UnsavedChangesDialog';
import { errorMessage } from './utils/errors';

export function App() {
  const [view, setView] = useState<NoteView>({ kind: 'active' });
  const [query, setQuery] = useState('');
  const [tagId, setTagId] = useState('');
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [catalogError, setCatalogError] = useState('');
  const [catalogRevision, setCatalogRevision] = useState(0);
  const [move, setMove] = useState<NoteMove | null>(null);
  const [moveStatus, setMoveStatus] = useState('');
  const [reordering, setReordering] = useState(false);
  const [reorderError, setReorderError] = useState('');
  const trash = view.kind === 'trash';
  const notebookId = view.kind === 'active' ? view.notebookId : undefined;
  const search = query.trim();
  const filter = useMemo(() => trash ? { trash: true } : { notebookId, tagId, query: search },
    [trash, notebookId, tagId, search]);
  const { notes, loading, error, upsert, reload } = useNotes(filter);
  const editor = useNoteEditor(upsert);
  const selectedNote = 'note' in editor.state ? editor.state.note : null;
  const currentNoteId = 'noteId' in editor.state ? editor.state.noteId : selectedNote?.id;
  const announcement = selectedNote ? `Открыта заметка «${selectedNote.title}».` : '';
  const canReorderNotes = !trash && !error && !editor.organizing && !reordering && notes.length > 1;
  const canDragNote = !trash && !editor.organizing && !reordering && editor.state.status !== 'loading'
    && (canReorderNotes || notebooks.length > 1);

  useEffect(() => {
    const controller = new AbortController();
    setCatalogError('');
    Promise.all([listNotebooks(controller.signal), listTags(controller.signal)])
      .then(([nextNotebooks, nextTags]) => {
        if (controller.signal.aborted) return;
        setNotebooks(current => Array.from(new Map([...nextNotebooks, ...current].map(item => [item.id, item])).values()));
        setTags(nextTags);
        setTagId(current => nextTags.some(tag => tag.id === current) ? current : '');
      })
      .catch(cause => {
        if (!controller.signal.aborted) setCatalogError(errorMessage(cause));
      });
    return () => controller.abort();
  }, [catalogRevision]);

  function selectView(next: NoteView) {
    setMove(null);
    setMoveStatus('');
    if (next.kind === view.kind && (next.kind === 'trash' || next.notebookId === notebookId)) return;
    editor.switchView(() => setView(next));
  }

  const start = () => {
    setMove(null);
    editor.start(notebookId);
  };

  async function moveNote(notebook: Notebook) {
    if (!move || notebook.id === move.notebookId || trash) return;
    const sourceId = move.id;
    setMove(null);
    setMoveStatus('');
    const success = await editor.changeOrganization(note => note.notebookId === notebook.id
      ? Promise.resolve(note) : organizeNote(note, { notebookId: notebook.id }), false, sourceId);
    if (success) setMoveStatus(`Заметка перенесена в «${notebook.name}».`);
  }

  async function changeTags(change: OrganizationChange) {
    const saved = await editor.changeOrganization(note => organizeNote(note, change));
    if (saved) refreshCatalog();
    return saved;
  }

  async function toggleTrash() {
    const saved = await editor.changeOrganization(note => setNoteInTrash(note, !note.deletedAt), true);
    if (saved) refreshCatalog();
  }

  function refreshCatalog() {
    setCatalogRevision(current => current + 1);
  }

  async function reorder(list: 'notes' | 'notebooks', id: string, targetId: string, before: boolean) {
    setReordering(true);
    setReorderError('');
    try {
      await reorderItem(list, id, targetId, before);
    } catch (cause) {
      setReorderError(`Не удалось сохранить порядок. ${errorMessage(cause)}`);
    } finally {
      if (list === 'notes') reload();
      else refreshCatalog();
      setReordering(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="brand" href="/" aria-label="Мини-Evernote — главная">
          <span className="brand-mark"><span /><span /><span /></span>
          <span>Мини-Evernote</span>
        </a>
        <button
          className="button button-primary new-note"
          onClick={start}
          disabled={trash || editor.organizing || (editor.state.status === 'saving' && !editor.state.note)}
        >
          <Icon name="plus" size={21} /> Новая заметка
        </button>
      </header>
      {editor.organizationError && <div className="catalog-error" role="alert">{editor.organizationError}</div>}
      {reorderError && <div className="catalog-error" role="alert">{reorderError}</div>}

      <main className="workspace">
        <NotebookSidebar notebooks={notebooks} view={view} disabled={editor.organizing} onSelect={selectView}
          move={move} onMove={notebook => void moveNote(notebook)} moveStatus={moveStatus}
          onReorder={!reordering ? (id, targetId, before) => void reorder('notebooks', id, targetId, before) : undefined}
          onCreated={notebook => {
            setNotebooks(current => [...current.filter(item => item.id !== notebook.id), notebook]);
            selectView({ kind: 'active', notebookId: notebook.id });
          }} />

        <NotesPanel
          notes={notes}
          loading={loading}
          error={error}
          currentNoteId={currentNoteId}
          onCreate={start}
          onReload={reload}
          onSelect={id => {
            setMove(null);
            editor.select(id);
          }}
          trash={trash}
          query={query}
          onQuery={setQuery}
          tagId={tagId}
          onTag={setTagId}
          tags={tags}
          disabled={editor.organizing}
          canDrag={canDragNote}
          onReorder={canReorderNotes ? (id, targetId, before) => void reorder('notes', id, targetId, before) : undefined}
          onDragStart={(event, note) => {
            if (!canDragNote) {
              event.preventDefault();
              return;
            }
            event.dataTransfer.setData(noteDragType, note.id);
            event.dataTransfer.effectAllowed = 'move';
            setMoveStatus('');
            setMove(note);
          }}
          onDragEnd={() => setMove(null)}
        />

        <section className="editor-panel" aria-label="Редактор заметки">
          <NoteEditor
            state={editor.state}
            hasNotes={notes.length > 0}
            onStart={start}
            onChange={editor.change}
            onSubmit={editor.submit}
            onRetryLoad={() => currentNoteId && editor.select(currentNoteId)}
            onReloadConflict={editor.reloadConflict}
            onTrash={() => void toggleTrash()}
            trashView={trash}
            organizing={editor.organizing}
            organization={selectedNote && <NoteOrganization key={selectedNote.id}
              note={selectedNote} tags={tags}
              disabled={editor.organizing || editor.state.status === 'conflict'}
              onChange={changeTags}
              onRestore={() => void toggleTrash()} />}
          />
        </section>
      </main>
      {catalogError && <div className="catalog-error" role="alert">
        <span>{catalogError}</span>
        <button type="button" className="text-button" onClick={refreshCatalog}>
          Повторить загрузку блокнотов и тегов
        </button>
      </div>}
      {editor.pendingDestination && <UnsavedChangesDialog
        onSave={editor.state.status === 'conflict' ? undefined : editor.saveAndNavigate}
        onDiscard={editor.discardAndNavigate}
        onCancel={editor.cancelNavigation}
      />}
      <div className="visually-hidden" role="status" aria-live="polite">{announcement}</div>
    </div>
  );
}
