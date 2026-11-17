import { Icon } from './components/Icon';
import { NoteEditor } from './features/notes/NoteEditor';
import { NotesPanel } from './features/notes/NotesPanel';
import { useNoteEditor } from './features/notes/useNoteEditor';
import { useNotes } from './features/notes/useNotes';
import { UnsavedChangesDialog } from './features/notes/UnsavedChangesDialog';

export function App() {
  const { notes, loading, error, upsert, reload } = useNotes();
  const editor = useNoteEditor(upsert);
  const selectedNote = 'note' in editor.state ? editor.state.note : null;
  const currentNoteId = 'noteId' in editor.state ? editor.state.noteId : selectedNote?.id;
  const announcement = selectedNote ? `Открыта заметка «${selectedNote.title}».` : '';

  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="brand" href="/" aria-label="Мини-Evernote — главная">
          <span className="brand-mark"><span /><span /><span /></span>
          <span>Мини-Evernote</span>
        </a>
        <button
          className="button button-primary new-note"
          onClick={editor.start}
          disabled={editor.state.status === 'saving' && !editor.state.note}
        >
          <Icon name="plus" size={21} /> Новая заметка
        </button>
      </header>

      <main className="workspace">
        <aside className="sidebar" aria-label="Блокноты">
          <h2 className="section-title"><Icon name="notebooks" />Блокноты</h2>
          <div className="notebook-selected" aria-current="true">
            <Icon name="book" /><span>Личное</span>
            <span className="notebook-count">{loading || error ? '—' : notes.length}</span>
          </div>
          <div className="sidebar-footer"><span className="small-brand-mark" />Место для ваших мыслей</div>
        </aside>

        <NotesPanel
          notes={notes}
          loading={loading}
          error={error}
          currentNoteId={currentNoteId}
          onCreate={editor.start}
          onReload={reload}
          onSelect={editor.select}
        />

        <section className="editor-panel" aria-label="Редактор заметки">
          <NoteEditor
            state={editor.state}
            hasNotes={notes.length > 0}
            onStart={editor.start}
            onChange={editor.change}
            onSubmit={editor.submit}
            onRetryLoad={() => currentNoteId && editor.select(currentNoteId)}
            onReloadConflict={editor.reloadConflict}
            onAddItem={editor.addItem}
            onToggleItem={editor.toggleItem}
          />
        </section>
      </main>
      {editor.pendingDestination && <UnsavedChangesDialog
        onSave={editor.state.status === 'conflict' ? undefined : editor.saveAndNavigate}
        onDiscard={editor.discardAndNavigate}
        onCancel={editor.cancelNavigation}
      />}
      <div className="visually-hidden" role="status" aria-live="polite">{announcement}</div>
    </div>
  );
}
