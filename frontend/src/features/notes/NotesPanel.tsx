import type { NoteListItem } from '../../api/notes';
import { Icon } from '../../components/Icon';
import { formatDate, formatNoteCount } from '../../utils/format';

interface NotesPanelProps {
  notes: NoteListItem[];
  loading: boolean;
  error: string;
  currentNoteId?: string;
  onCreate: () => void;
  onReload: () => void;
  onSelect: (id: string) => void;
}

export function NotesPanel({ notes, loading, error, currentNoteId, onCreate, onReload, onSelect }: NotesPanelProps) {
  const empty = notes.length === 0;

  return (
    <section className="notes-panel" aria-labelledby="notes-heading">
      <div className="notes-heading-row">
        <h2 className="section-title" id="notes-heading"><Icon name="layers" />Заметки</h2>
        <span className="count-badge">{loading || error ? '—' : notes.length}</span>
      </div>
      <p className="panel-caption">Всё важное — под рукой</p>
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
            <h3>Здесь будут ваши заметки</h3>
            <p>Создайте первую, чтобы сохранить<br />идею, мысль или важную деталь.</p>
            <button className="text-button" onClick={onCreate}>
              <Icon name="plus" size={17} />Создать заметку
            </button>
          </div>
        )}
        {!empty && (
          <ul>
            {notes.map(note => (
              <li key={note.id}>
                <button
                  type="button"
                  className={`note-card ${note.id === currentNoteId ? 'is-current' : ''}`}
                  aria-label={`Открыть заметку: ${note.title}`}
                  aria-current={note.id === currentNoteId ? 'true' : undefined}
                  onClick={() => onSelect(note.id)}
                >
                  <Icon name="note" size={25} />
                  <div className="note-card-content">
                    <h3>{note.title}</h3>
                    <p>{note.preview.trim() || 'Пустая заметка'}</p>
                    <time dateTime={note.createdAt}>{formatDate(note.createdAt)}</time>
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
    </section>
  );
}
