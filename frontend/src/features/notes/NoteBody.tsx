import { useLayoutEffect, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';

const taskPattern = /^([ \t]*[-*] \[)([ xX])(\][ \t])([^\n]*)$/;
const continuation = '  | ';
const marker = '- [ ] ';
const maxLength = 2_610_000;

type Task = {
  kind: 'task';
  start: number;
  end: number;
  prefix: string;
  checked: boolean;
  gap: string;
  text: string;
};
type TextBlock = { kind: 'text'; start: number; text: string };

function readBlocks(lines: string[]) {
  const blocks: (Task | TextBlock)[] = [];
  for (let start = 0; start < lines.length;) {
    const match = taskPattern.exec(lines[start]);
    let end = start + 1;
    if (match) {
      const text = [match[4]];
      while (lines[end]?.startsWith(continuation)) {
        text.push(lines[end].slice(continuation.length));
        end++;
      }
      blocks.push({
        kind: 'task', start, end, prefix: match[1], checked: match[2] !== ' ', gap: match[3], text: text.join('\n'),
      });
    } else {
      while (end < lines.length && !taskPattern.test(lines[end])) end++;
      blocks.push({ kind: 'text', start, text: lines.slice(start, end).join('\n') });
    }
    start = end;
  }
  return blocks;
}

function TaskRow({ task, startEditing, onToggle, onChange, onRemove, onFinish }: {
  task: Task;
  startEditing: boolean;
  onToggle: () => void;
  onChange: (text: string) => boolean;
  onRemove: () => void;
  onFinish: () => void;
}) {
  const [draft, setDraft] = useState<string | null>(startEditing ? task.text : null);
  const input = useRef<HTMLTextAreaElement>(null);
  const editing = draft !== null;

  useLayoutEffect(() => {
    const field = input.current;
    if (!editing || !field) return;
    field.focus();
    field.setSelectionRange(field.value.length, field.value.length);
  }, [editing]);

  function finish(text: string) {
    if (!text.trim()) onRemove();
    setDraft(null);
    onFinish();
  }

  return (
    <div className={task.checked ? 'inline-task is-completed' : 'inline-task'}>
      <input type="checkbox" checked={task.checked}
        aria-label={task.text.trim() || 'Пункт в тексте'} onChange={onToggle} />
      {editing ? (
        <textarea ref={input} className="inline-task-text" aria-label="Текст пункта"
          placeholder="Текст пункта…" rows={draft.split('\n').length} value={draft}
          onChange={event => {
            const text = event.target.value;
            if (!text.trim() || onChange(text)) setDraft(text);
          }}
          onBlur={event => finish(event.currentTarget.value)}
          onKeyDown={event => {
            const value = event.currentTarget.value;
            if (event.key === 'Tab' && !value.trim()) {
              finish(value);
              return;
            }
            if ((event.key === 'Enter' && !event.shiftKey) || (event.key === 'Backspace' && !value)) {
              if (event.nativeEvent.isComposing) return;
              event.preventDefault();
              event.currentTarget.blur();
            }
          }} />
      ) : (
        <button type="button" className="inline-task-text" onClick={() => setDraft(task.text)}>
          {task.text || 'Текст пункта…'}
        </button>
      )}
    </div>
  );
}

export function NoteBody({ content, placeholder, onChange }: {
  content: string;
  placeholder: string;
  onChange: (content: string) => void;
}) {
  const [editSource, setEditSource] = useState(false);
  const [focusedTask, setFocusedTask] = useState<number | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const focusSource = useRef(false);
  const lines = content.split(/\r\n|\r|\n/);
  const blocks = readBlocks(lines);
  const hasTasks = blocks.some(block => block.kind === 'task');
  const editing = !hasTasks || editSource;

  useLayoutEffect(() => {
    if (!input.current || !focusSource.current) return;
    const end = input.current.value.length;
    input.current.focus();
    input.current.setSelectionRange(end, end);
    focusSource.current = false;
  }, [editing]);

  function insertTask() {
    const body = input.current?.value ?? lines.join('\n');
    const cursor = input.current?.selectionStart ?? body.length;
    const begin = cursor === 0 ? 0 : body.lastIndexOf('\n', cursor - 1) + 1;
    const nextBreak = body.indexOf('\n', cursor);
    const end = nextBreak === -1 ? body.length : nextBreak;
    const newLine = !input.current && begin !== body.length || taskPattern.test(body.slice(begin, end));
    const position = newLine ? end : begin;
    const prefix = newLine ? '\n' + marker : marker;
    if (body.length + prefix.length > maxLength) return;

    setFocusedTask(body.slice(0, position).split('\n').length - 1 + Number(newLine));
    setEditSource(false);
    onChange(body.slice(0, position) + prefix + body.slice(position));
  }

  function writeTask(task: Task, text: string | null, checked = task.checked) {
    const replacement = text === null ? '' : task.prefix + (checked ? 'x' : ' ') + task.gap
      + text.replaceAll('\n', '\n' + continuation);
    const nextLines = [...lines];
    nextLines.splice(task.start, task.end - task.start, ...(text === null ? [] : [replacement]));
    const next = nextLines.join('\n');
    if (next.length > maxLength) return false;
    onChange(next);
    return true;
  }

  return (
    <div className="note-body">
      <div className="note-body-actions">
        <button type="button" className="text-button" onClick={insertTask} disabled={content.length > maxLength - marker.length}>
          <Icon name="plus" size={16} />Вставить чекбокс
        </button>
        {hasTasks && <button type="button" className="text-button" onClick={() => {
          focusSource.current = !editing;
          setFocusedTask(null);
          setEditSource(!editing);
        }}>
          {editing ? 'Показать чекбоксы' : 'Редактировать весь текст'}
        </button>}
      </div>
      {editing ? (
        <>
          <label className="visually-hidden" htmlFor="note-content">Текст заметки</label>
          <textarea ref={input} id="note-content" className="content-input" name="content"
            placeholder={placeholder} value={content} maxLength={maxLength} onChange={event => {
              setEditSource(true);
              onChange(event.target.value);
            }} />
        </>
      ) : (
        <div className="note-body-preview" role="region" aria-label="Текст заметки">
          {blocks.map(block => block.kind === 'text' ? (
            <div key={block.start}>{block.text}{(!block.text || block.text.endsWith('\n')) && <br />}</div>
          ) : (
            <TaskRow key={block.start} task={block} startEditing={focusedTask === block.start}
              onToggle={() => writeTask(block, block.text, !block.checked)}
              onChange={text => writeTask(block, text)} onRemove={() => writeTask(block, null)}
              onFinish={() => setFocusedTask(null)} />
          ))}
        </div>
      )}
    </div>
  );
}
