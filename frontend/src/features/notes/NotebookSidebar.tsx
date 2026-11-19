import { useState } from 'react';
import { createNotebook, type Notebook } from '../../api/notes';
import { Icon } from '../../components/Icon';
import { errorMessage } from '../../utils/errors';

export type NoteView = { kind: 'active'; notebookId?: string } | { kind: 'trash' };

export function NotebookSidebar({ notebooks, view, onSelect, onCreated, disabled }: {
  notebooks: Notebook[];
  view: NoteView;
  onSelect: (view: NoteView) => void;
  onCreated: (notebook: Notebook) => void;
  disabled: boolean;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function addNotebook() {
    if (pending || !name.trim()) return;
    setPending(true);
    setError('');
    try {
      const notebook = await createNotebook(name.trim());
      setName('');
      setCreating(false);
      onCreated(notebook);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <aside className="sidebar" aria-label="Блокноты">
      <h2 className="section-title"><Icon name="notebooks" />Блокноты</h2>
      <nav className="notebook-nav" aria-label="Разделы заметок">
        <button type="button" className="notebook-link" disabled={disabled}
          aria-current={view.kind === 'active' && !view.notebookId ? 'page' : undefined}
          onClick={() => onSelect({ kind: 'active' })}>
          <Icon name="layers" size={19} /><span>Все заметки</span>
        </button>
        {notebooks.map(notebook => (
          <button type="button" key={notebook.id} className="notebook-link" disabled={disabled}
            aria-current={view.kind === 'active' && view.notebookId === notebook.id ? 'page' : undefined}
            onClick={() => onSelect({ kind: 'active', notebookId: notebook.id })}>
            <Icon name="book" size={19} /><span>{notebook.name}</span>
          </button>
        ))}
        <button type="button" className="notebook-link trash-link" disabled={disabled}
          aria-current={view.kind === 'trash' ? 'page' : undefined} onClick={() => onSelect({ kind: 'trash' })}>
          <Icon name="trash" size={19} /><span>Корзина</span>
        </button>
      </nav>
      {creating ? (
        <form className="notebook-create" onSubmit={event => { event.preventDefault(); void addNotebook(); }}>
          <label htmlFor="new-notebook-name">Название блокнота</label>
          <input id="new-notebook-name" className="control" maxLength={100} autoFocus value={name}
            onChange={event => setName(event.target.value)} disabled={pending} />
          <div className="inline-actions">
            <button className="text-button" type="submit" disabled={disabled || pending || !name.trim()}>Создать блокнот</button>
            <button className="text-button" type="button" disabled={pending} onClick={() => { setCreating(false); setError(''); }}>Отмена</button>
          </div>
          {error && <p className="inline-error" role="alert">{error}</p>}
        </form>
      ) : (
        <button type="button" className="text-button add-notebook" disabled={disabled} onClick={() => setCreating(true)}>
          <Icon name="plus" size={17} />Новый блокнот
        </button>
      )}
    </aside>
  );
}
