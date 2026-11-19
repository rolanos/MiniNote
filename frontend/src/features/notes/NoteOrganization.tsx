import { useState } from 'react';
import type { Note, OrganizationChange, Tag } from '../../api/notes';
import { Icon } from '../../components/Icon';

export function NoteOrganization({ note, tags, disabled, canMove, onMove, onChange, onTrash }: {
  note: Note;
  tags: Tag[];
  disabled: boolean;
  canMove: boolean;
  onMove: () => void;
  onChange: (change: OrganizationChange) => Promise<boolean>;
  onTrash: () => void;
}) {
  const [tagName, setTagName] = useState('');

  async function addTag() {
    if (disabled || !tagName.trim()) return;
    if (await onChange({ tagName: tagName.trim() })) setTagName('');
  }

  if (note.deletedAt) {
    return <div className="organization-controls">
      <div className="organization-actions">
        <span className="editor-mode">В корзине · {note.notebookName}</span>
        <button type="button" className="button button-secondary" disabled={disabled} onClick={onTrash}>
          <Icon name="refresh" size={17} />Восстановить заметку
        </button>
      </div>
      {note.tags.length > 0 && <div className="note-tags">
        {note.tags.map(tag => <span className="tag-chip" key={tag.id}>{tag.name}</span>)}
      </div>}
    </div>;
  }

  return (
    <div className="organization-controls">
      <div className="organization-actions">
        <button type="button" className="text-button" disabled={disabled || !canMove} onClick={onMove}>
          <Icon name="arrow" size={17} />Перенести в блокнот
        </button>
        <button type="button" className="text-button danger-action" disabled={disabled} onClick={onTrash}>
          <Icon name="trash" size={17} />В корзину
        </button>
      </div>
      <div className="note-tags">
        {note.tags.map(tag => (
          <span className="tag-chip" key={tag.id}>
            <span>{tag.name}</span>
            <button type="button" aria-label={`Снять тег: ${tag.name}`} disabled={disabled}
              onClick={() => void onChange({ removeTagId: tag.id })}>×</button>
          </span>
        ))}
        <div className="tag-entry">
          <input className="control" aria-label="Добавить тег" placeholder="Название тега" list="existing-tags"
            maxLength={100} value={tagName} disabled={disabled} onChange={event => setTagName(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void addTag();
              }
            }} />
          <datalist id="existing-tags">
            {tags.filter(tag => !note.tags.some(existing => existing.id === tag.id))
              .map(tag => <option key={tag.id} value={tag.name} />)}
          </datalist>
          <button type="button" className="text-button" disabled={disabled || !tagName.trim()} onClick={() => void addTag()}>
            <Icon name="plus" size={16} />Добавить тег
          </button>
        </div>
      </div>
    </div>
  );
}
