import { useLayoutEffect, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';

const taskPattern = /^([ \t]*[-*] \[)([ xX])(\][ \t])([^\n]*)$/;
const maxLength = 100000;

export function NoteBody({ content, placeholder, onChange }: {
  content: string;
  placeholder: string;
  onChange: (content: string) => void;
}) {
  const [mode, setMode] = useState<'edit' | 'preview' | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const nextCaret = useRef<number | null>(null);
  const lines = content.split('\n');
  const hasTasks = lines.some(line => taskPattern.test(line));
  const editing = !hasTasks || mode === 'edit';

  useLayoutEffect(() => {
    if (!input.current || nextCaret.current === null) return;
    input.current.focus();
    input.current.setSelectionRange(nextCaret.current, nextCaret.current);
    nextCaret.current = null;
  }, [editing, content]);

  function insertTask() {
    const marker = '- [ ] ';
    const cursor = input.current?.selectionStart ?? content.length;
    const lineStart = cursor === 0 ? 0 : content.lastIndexOf('\n', cursor - 1) + 1;
    const nextNewline = content.indexOf('\n', cursor);
    const lineEnd = nextNewline === -1 ? content.length : nextNewline;
    const newLine = (input.current === null && lineStart !== content.length)
      || taskPattern.test(content.slice(lineStart, lineEnd));
    const position = newLine ? lineEnd : lineStart;
    const prefix = newLine ? '\n' + marker : marker;
    if (content.length + prefix.length > maxLength) return;

    nextCaret.current = newLine ? position + prefix.length : cursor + marker.length;
    setMode('edit');
    onChange(content.slice(0, position) + prefix + content.slice(position));
  }

  return (
    <div className="note-body">
      <div className="note-body-actions">
        <button type="button" className="text-button" onClick={insertTask} disabled={content.length > maxLength - 7}>
          <Icon name="plus" size={16} />Вставить чекбокс
        </button>
        {hasTasks && <button type="button" className="text-button" onClick={() => {
          if (!editing) nextCaret.current = content.length;
          setMode(editing ? 'preview' : 'edit');
        }}>
          {editing ? 'Показать текст с чекбоксами' : 'Редактировать текст'}
        </button>}
      </div>
      {editing ? (
        <>
          <label className="visually-hidden" htmlFor="note-content">Текст заметки</label>
          <textarea ref={input} id="note-content" className="content-input" name="content"
            placeholder={placeholder} value={content} maxLength={maxLength} onChange={event => {
              setMode('edit');
              onChange(event.target.value);
            }} />
        </>
      ) : (
        <div className="note-body-preview" role="region" aria-label="Текст заметки">
          {lines.map((line, index) => {
            const task = taskPattern.exec(line);
            if (!task) return <div key={index}>{line || <br />}</div>;
            const completed = task[2] !== ' ';
            return (
              <label key={index} className={completed ? 'inline-task is-completed' : 'inline-task'}>
                <input type="checkbox" checked={completed}
                  aria-label={task[4].trim() || 'Пункт в тексте'} onChange={() => {
                    const updated = [...lines];
                    updated[index] = task[1] + (completed ? ' ' : 'x') + task[3] + task[4];
                    onChange(updated.join('\n'));
                  }} />
                <span>{task[4]}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
