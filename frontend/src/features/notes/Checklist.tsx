import { useState } from 'react';
import type { ChecklistItem } from '../../api/notes';
import { Icon } from '../../components/Icon';

interface ChecklistProps {
  items: ChecklistItem[];
  onAdd: (text: string) => void;
  onToggle: (id: string) => void;
  onEdit: (id: string, text: string) => void;
  onRemove: (id: string) => void;
}

export function Checklist({ items, onAdd, onToggle, onEdit, onRemove }: ChecklistProps) {
  const [text, setText] = useState('');
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);

  function saveEdit() {
    if (!editing?.text.trim()) return;
    onEdit(editing.id, editing.text);
    setEditing(null);
  }
  function add() {
    if (!text.trim() || items.length >= 500) return;
    onAdd(text);
    setText('');
  }

  return (
    <section className="checklist" aria-label="Чек-лист">
      <h2>Чек-лист</h2>
      <ul>
        {items.map(item => <li className="checklist-row" key={item.id}>
          {editing?.id === item.id ? (
            <div className="checklist-edit">
              <input aria-label="Текст пункта" value={editing.text} maxLength={1000} autoFocus
                onChange={event => setEditing({ id: item.id, text: event.target.value })}
                onKeyDown={event => {
                  if (event.key === 'Enter') { event.preventDefault(); saveEdit(); }
                  if (event.key === 'Escape') setEditing(null);
                }} />
              <button type="button" className="text-button" disabled={!editing.text.trim()} onClick={saveEdit}>Сохранить пункт</button>
              <button type="button" className="text-button" onClick={() => setEditing(null)}>Отмена</button>
            </div>
          ) : (
            <>
              <label className={item.isCompleted ? 'is-completed' : ''}>
                <input type="checkbox" checked={item.isCompleted} onChange={() => onToggle(item.id)} />
                <span>{item.text}</span>
              </label>
              <div className="checklist-row-actions">
                <button type="button" className="item-action" aria-label={`Редактировать пункт: ${item.text}`}
                  title="Редактировать пункт" onClick={() => setEditing({ id: item.id, text: item.text })}>
                  <Icon name="edit" size={16} />
                </button>
                <button type="button" className="item-action delete-item" aria-label={`Удалить пункт: ${item.text}`}
                  title="Удалить пункт" onClick={() => onRemove(item.id)}>
                  <Icon name="trash" size={16} />
                </button>
              </div>
            </>
          )}
        </li>)}
      </ul>
      <div className="checklist-add">
        <label className="visually-hidden" htmlFor="checklist-text">Новый пункт чек-листа</label>
        <input id="checklist-text" value={text} maxLength={1000} placeholder="Добавить дело…"
          onChange={event => setText(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); add(); } }} />
        <button type="button" className="text-button" disabled={!text.trim() || items.length >= 500} onClick={add}>
          <Icon name="plus" size={18} />Добавить пункт
        </button>
      </div>
    </section>
  );
}
