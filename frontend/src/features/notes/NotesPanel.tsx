import { useRef, type DragEvent } from 'react';
import type { NoteListItem, Tag } from '../../api/notes';
import { Icon } from '../../components/Icon';
import { formatDate, formatNoteCount } from '../../utils/format';
import { noteDragType, useReorderDrop, type Reorder } from './useReorderDrop';

interface NotesPanelProps {
  notes: NoteListItem[];
  loading: boolean;
  error: string;
  currentNoteId?: string;
  onCreate: () => void;
  onReload: () => void;
  onSelect: (id: string) => void;
  trash: boolean;
  query: string;
  tagId: string;
  tags: Tag[];
  onQuery: (value: string) => void;
  onTag: (id: string) => void;
  disabled: boolean;
  canDrag: boolean;
  onReorder?: Reorder;
  onDragStart: (event: DragEvent<HTMLButtonElement>, note: NoteListItem) => void;
  onDragEnd: () => void;
}

export function NotesPanel({ notes, loading, error, currentNoteId, onCreate, onReload, onSelect,
  trash, query, tagId, tags, onQuery, onTag, disabled, canDrag, onReorder, onDragStart, onDragEnd }: NotesPanelProps) {
  const empty = notes.length === 0;
  const filtered = Boolean(query.trim() || tagId);
  const dragPreview = useRef<HTMLDivElement>(null);
  const dragPreviewTitle = useRef<HTMLSpanElement>(null);
  const reorder = useReorderDrop(noteDragType, onReorder);

  function startDrag(event: DragEvent<HTMLButtonElement>, note: NoteListItem) {
    onDragStart(event, note);
    if (event.defaultPrevented) return;
    reorder.start(note.id);
    if (!dragPreview.current || !dragPreviewTitle.current) return;
    dragPreviewTitle.current.textContent = note.title;
    event.dataTransfer.setDragImage(dragPreview.current, 20, 21);
  }

  return (
    <section className="notes-panel" aria-labelledby="notes-heading">
      <div className="notes-heading-row">
        <h2 className="section-title" id="notes-heading"><Icon name={trash ? 'trash' : 'layers'} />{trash ? 'Корзина' : 'Заметки'}</h2>
        <span className="count-badge">{loading || error ? '—' : notes.length}</span>
      </div>
      {!trash && (
        <div className="notes-filters">
          <input type="search" className="control" placeholder="Поиск заметок" aria-label="Поиск заметок"
            value={query} disabled={disabled} onChange={event => onQuery(event.target.value)} />
          <select className="control" aria-label="Фильтр по тегу" value={tagId} disabled={disabled}
            onChange={event => onTag(event.target.value)}>
            <option value="">Все теги</option>
            {tags.map(tag => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
          </select>
        </div>
      )}
      <div className="notes-list" aria-busy={loading}>
        {error && (
          <div className="list-error" role="alert">
            <Icon name="alert" />
            <p>{error}</p>
            <button className="text-button" onClick={onReload}>
              <Icon name="refresh" size={17} />Повторить загрузку
            </button>
          </div>
        )}
        {loading && empty && (
          <div className="list-message" role="status"><span className="spinner" />Загружаем заметки…</div>
        )}
        {!loading && !error && empty && (
          <div className="list-empty">
            <div className="empty-icon"><Icon name="note" size={27} /></div>
            <h3>{trash ? 'Корзина пуста' : filtered ? 'Ничего не найдено' : 'Здесь будут ваши заметки'}</h3>
            {!trash && !filtered && (
              <button className="text-button" disabled={disabled} onClick={onCreate}>
                <Icon name="plus" size={17} />Создать заметку
              </button>
            )}
          </div>
        )}
        {!empty && (
          <ul>
            {notes.map(note => (
              <li key={note.id} {...reorder.dropProps(note.id)}>
                <button
                  type="button"
                  className={`note-card ${note.id === currentNoteId ? 'is-current' : ''}`}
                  aria-label={`Открыть заметку: ${note.title}`}
                  aria-current={note.id === currentNoteId ? 'true' : undefined}
                  disabled={disabled}
                  draggable={canDrag && !disabled}
                  onDragStart={event => startDrag(event, note)}
                  onDragEnd={() => { reorder.clear(); onDragEnd(); }}
                  onClick={() => onSelect(note.id)}
                >
                  <Icon name="note" size={25} />
                  <div className="note-card-content">
                    <h3>{note.title}</h3>
                    <p>{note.preview.trim() || 'Пустая заметка'}</p>
                    <div className="card-meta"><span>{note.notebookName}</span>
                      <time dateTime={note.createdAt}>{formatDate(note.createdAt)}</time></div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <footer className="notes-footer">
        {loading ? 'Загрузка…' : error ? 'Список недоступен' : formatNoteCount(notes.length)}
      </footer>
      <div ref={dragPreview} className="note-drag-preview" aria-hidden="true">
        <span className="note-drag-preview-icon"><Icon name="note" size={16} /></span>
        <span ref={dragPreviewTitle} className="note-drag-preview-title" />
      </div>
    </section>
  );
}
