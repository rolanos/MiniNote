import { useEffect, useState } from 'react';
import { createNotebook, type Notebook, type NoteListItem } from '../../api/notes';
import { Icon } from '../../components/Icon';
import { errorMessage } from '../../utils/errors';
import { noteDragType, notebookDragType, useReorderDrop, type Reorder } from './useReorderDrop';

export type NoteView = { kind: 'active'; notebookId?: string } | { kind: 'trash' };
export type NoteMove = Pick<NoteListItem, 'id' | 'notebookId'>;

export function NotebookSidebar({ notebooks, view, onSelect, onCreated, disabled,
  move, onMove, moveStatus, onReorder }: {
  notebooks: Notebook[];
  view: NoteView;
  onSelect: (view: NoteView) => void;
  onCreated: (notebook: Notebook) => void;
  disabled: boolean;
  move: NoteMove | null;
  onMove: (notebook: Notebook) => void;
  moveStatus: string;
  onReorder?: Reorder;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [hovered, setHovered] = useState<string | null>(null);
  const reorder = useReorderDrop(notebookDragType, onReorder);
  const canDrag = Boolean(onReorder && !move && !disabled && notebooks.length > 1);

  useEffect(() => setHovered(null), [move]);

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
        {notebooks.map(notebook => {
          const eligible = move !== null && move.notebookId !== notebook.id && !disabled;
          const drop = reorder.dropProps(notebook.id);
          return (
            <button type="button" key={notebook.id} className="notebook-link"
              disabled={disabled}
              data-move-target={eligible ? '' : undefined}
              data-drop-hover={eligible && hovered === notebook.id ? '' : undefined}
              data-reorder-edge={drop['data-reorder-edge']}
              aria-current={view.kind === 'active' && view.notebookId === notebook.id ? 'page' : undefined}
              draggable={canDrag}
              onDragStart={event => {
                if (!canDrag) { event.preventDefault(); return; }
                event.dataTransfer.setData(notebookDragType, notebook.id);
                event.dataTransfer.effectAllowed = 'move';
                reorder.start(notebook.id);
              }}
              onDragEnd={reorder.clear}
              onClick={() => onSelect({ kind: 'active', notebookId: notebook.id })}
              onDragOver={event => {
                drop.onDragOver?.(event);
                if (!eligible || !event.dataTransfer.types.includes(noteDragType)) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                setHovered(notebook.id);
              }}
              onDragLeave={event => {
                drop.onDragLeave?.(event);
                const next = event.relatedTarget;
                if (!(next instanceof Node) || !event.currentTarget.contains(next))
                  setHovered(current => current === notebook.id ? null : current);
              }}
              onDrop={event => {
                drop.onDrop?.(event);
                if (!eligible || event.dataTransfer.getData(noteDragType) !== move.id) return;
                event.preventDefault();
                onMove(notebook);
              }}>
              <Icon name="book" size={19} /><span>{notebook.name}</span>
            </button>
          );
        })}
        <button type="button" className="notebook-link trash-link" disabled={disabled}
          aria-current={view.kind === 'trash' ? 'page' : undefined} onClick={() => onSelect({ kind: 'trash' })}>
          <Icon name="trash" size={19} /><span>Корзина</span>
        </button>
      </nav>
      <div className={moveStatus ? 'move-feedback' : 'visually-hidden'} role="status">{moveStatus}</div>
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
