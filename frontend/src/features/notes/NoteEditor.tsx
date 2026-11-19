import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Icon } from '../../components/Icon';
import { formatDate } from '../../utils/format';
import { hasDraftChanges, type EditorState } from './useNoteEditor';
import { NoteBody } from './NoteBody';

interface NoteEditorProps {
  state: EditorState;
  hasNotes: boolean;
  onStart: () => void;
  onChange: (field: 'title' | 'content', value: string) => void;
  onSubmit: () => Promise<boolean>;
  onRetryLoad: () => void;
  onReloadConflict: () => void;
  organization?: ReactNode;
  organizationError?: string;
  organizing?: boolean;
  trashView?: boolean;
}

export function NoteEditor({ state, hasNotes, onStart, onChange, onSubmit, onRetryLoad, onReloadConflict,
  organization, organizationError, organizing, trashView }: NoteEditorProps) {
  const titleInput = useRef<HTMLInputElement>(null);
  const requestId = 'requestId' in state ? state.requestId : null;

  useEffect(() => {
    if (requestId) titleInput.current?.focus();
  }, [requestId]);

  if (state.status === 'empty') {
    if (trashView) return <div className="editor-message">Выберите заметку, чтобы просмотреть или восстановить её.</div>;
    return (
      <div className="welcome">
        <div className="welcome-art"><img src="/notebook.png" alt="Мятный блокнот с карандашом" /></div>
        <span className="eyebrow">МЫСЛИ СТАНОВЯТСЯ ЗАМЕТКАМИ</span>
        <h1>Сохраните то, что важно</h1>
        <p>Идея, которая пришла внезапно. Планы на завтра.<br />Пара слов, к которым хочется вернуться.</p>
        <button className="button button-primary" onClick={onStart}>
          <Icon name="plus" size={20} />
          {hasNotes ? 'Создать заметку' : 'Создать первую заметку'}
          <Icon name="arrow" size={18} />
        </button>
      </div>
    );
  }

  if (state.status === 'loading') {
    return <div className="editor-message" role="status"><span className="spinner" />Открываем заметку…</div>;
  }

  if (state.status === 'loadFailed') {
    return <div className="editor-message list-error" role="alert">
      <Icon name="alert" /><p>{state.error}</p>
      <button className="text-button" onClick={onRetryLoad}><Icon name="refresh" size={17} />Повторить открытие</button>
    </div>;
  }

  const values = state.draft;
  const savedNote = state.note;
  const dirty = hasDraftChanges(state);
  const saving = state.status === 'saving';
  const failed = state.status === 'failed';
  const conflict = state.status === 'conflict';
  const trashed = Boolean(savedNote?.deletedAt);
  const saved = Boolean(savedNote) && !dirty && !saving && !failed && !conflict && !trashed;
  const hint = saving ? 'Сохраняем на сервере…'
    : failed || conflict ? 'Не удалось сохранить изменения' : 'Ожидание автосохранения…';

  return (
    <form className="note-form" onSubmit={event => event.preventDefault()}>
      <div className="editor-toolbar">
        <span className="notebook-pill"><Icon name="book" size={20} />{savedNote?.notebookName ?? 'Личное'}</span>
        <span className="editor-mode">{trashed ? 'Только просмотр' : 'Автосохранение'}</span>
      </div>
      {organization}
      {organizationError && <p className="inline-error" role="alert">{organizationError}</p>}
      <fieldset className="note-fields" disabled={trashed || organizing}>
        <label className="visually-hidden" htmlFor="note-title">Заголовок</label>
        <input
        ref={titleInput}
        id="note-title"
        className="title-input"
        name="title"
        placeholder="Без названия"
        value={values.title}
        onChange={event => onChange('title', event.target.value)}
        maxLength={200}
        autoComplete="off"
        />
        <div className="editor-divider" />
        <NoteBody key={requestId} content={values.content}
          placeholder={savedNote ? 'В этой заметке нет текста.' : 'Начните писать здесь…'}
          onChange={content => onChange('content', content)} />
      </fieldset>
      {state.status === 'failed' && (
        <div className="save-error" role="alert">
          <Icon name="alert" size={21} />
          <div>
            <strong>{savedNote ? 'Не удалось подтвердить сохранение' : 'Не удалось подтвердить создание'}</strong>
            <p>{state.error}</p>
            <p>Текст остался в редакторе. Повторный запрос не создаст дубликат.</p>
          </div>
        </div>
      )}
      {conflict && (
        <div className="save-error" role="alert">
          <Icon name="alert" size={21} />
          <div>
            <strong>Конфликт версий</strong>
            <p>{state.error}</p>
            <p>Черновик остался в редакторе. Скопируйте нужные правки перед загрузкой сохранённой версии.</p>
          </div>
        </div>
      )}
      <footer className="editor-footer">
        <div className="editor-save-status">
          {saved ? (
            <>
              <span className="saved-status"><Icon name="check" size={22} />Сохранено</span>
              {savedNote && <time dateTime={savedNote.createdAt}>{formatDate(savedNote.createdAt)}</time>}
            </>
          ) : (
            <span className="draft-hint">{organizing ? 'Применяем изменения…' : trashed ? 'Заметка в корзине' : hint}</span>
          )}
        </div>
        {saving && <span className="spinner" aria-hidden="true" />}
        {conflict && <button type="button" className="button button-primary" onClick={onReloadConflict}>
          <Icon name="refresh" size={19} />Отбросить правки и обновить
        </button>}
        {failed && <button type="button" className="button button-primary" onClick={() => void onSubmit()}>
          <Icon name="refresh" size={19} />Повторить сохранение
        </button>}
      </footer>
    </form>
  );
}
