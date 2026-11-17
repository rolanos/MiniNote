import { useState } from 'react';
import type { ChecklistItem } from '../../api/notes';
import { Icon } from '../../components/Icon';

interface ChecklistProps {
  items: ChecklistItem[];
  onAdd: (text: string) => void;
  onToggle: (id: string) => void;
}

export function Checklist({ items, onAdd, onToggle }: ChecklistProps) {
  const [text, setText] = useState('');
  function add() {
    if (!text.trim() || items.length >= 500) return;
    onAdd(text);
    setText('');
  }

  return (
    <section className="checklist" aria-label="Чек-лист">
      <h2>Чек-лист</h2>
      <ul>
        {items.map(item => <li key={item.id}>
          <label className={item.isCompleted ? 'is-completed' : ''}>
            <input type="checkbox" checked={item.isCompleted} onChange={() => onToggle(item.id)} />
            <span>{item.text}</span>
          </label>
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
