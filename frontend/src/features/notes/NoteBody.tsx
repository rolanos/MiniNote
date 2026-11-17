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
type LineRange = { start: number; end: number };
type TextBlock = LineRange & { kind: 'text'; text: string };

function readBlocks(lines: string[], editing: LineRange | null) {
  const blocks: (Task | TextBlock)[] = [];
  const isEditing = (index: number) => editing && index >= editing.start && index < editing.end;
  const matchTask = (index: number) => isEditing(index) ? null : taskPattern.exec(lines[index]);
  for (let start = 0; start < lines.length;) {
    const match = matchTask(start);
    let end = start + 1;
    if (match) {
      const text = [match[4]];
      while (!isEditing(end) && lines[end]?.startsWith(continuation)) {
        text.push(lines[end].slice(continuation.length));
        end++;
      }
      blocks.push({
        kind: 'task', start, end, prefix: match[1], checked: match[2] !== ' ', gap: match[3], text: text.join('\n'),
      });
    } else {
      while (end < lines.length && !matchTask(end)) end++;
      blocks.push({ kind: 'text', start, end, text: lines.slice(start, end).join('\n') });
    }
    start = end;
  }
  if (blocks.at(-1)?.kind === 'task') {
    blocks.push({ kind: 'text', start: lines.length, end: lines.length, text: '' });
  }
  return blocks;
}

function TaskRow({ task, startEditing, onToggle, onChange, onRemove, onFinish, onFocus }: {
  task: Task;
  startEditing: boolean;
  onToggle: () => void;
  onChange: (text: string) => boolean;
  onRemove: () => void;
  onFinish: () => void;
  onFocus: () => void;
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
    <div className={task.checked ? 'inline-task is-completed' : 'inline-task'} onFocus={onFocus}>
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
  const [plainEdit, setPlainEdit] = useState<LineRange | null>(null);
  const [focusedTask, setFocusedTask] = useState<number | null>(null);
  const lastText = useRef<{ start: number; field: HTMLTextAreaElement } | null>(null);
  const lines = content.split(/\r\n|\r|\n/);
  const blocks = readBlocks(lines, plainEdit);
  const hasTasks = blocks.some(block => block.kind === 'task');
  const firstText = blocks.find(block => block.kind === 'text');

  function writeLines(range: LineRange, replacement: string[]) {
    const nextLines = [...lines];
    nextLines.splice(range.start, range.end - range.start, ...replacement);
    const next = nextLines.join('\n');
    if (next.length > maxLength) return false;
    onChange(next);
    return true;
  }

  function writeText(block: TextBlock, value: string) {
    if (block.text === value) return;
    if (writeLines(block, [value])) {
      // Keep pasted or typed Markdown editable until the user leaves this text block.
      setPlainEdit({ start: block.start, end: block.start + value.split('\n').length });
    }
  }

  function insertTask() {
    const anchor = lastText.current;
    const active = anchor?.field.isConnected && blocks.find(
      block => block.kind === 'text' && block.start === anchor.start,
    );
    const start = active && anchor
      ? active.start + anchor.field.value.slice(0, anchor.field.selectionStart).split('\n').length - 1
      : lines[lines.length - 1] === '' ? lines.length - 1 : lines.length;
    const line = lines[start];
    if (!writeLines({ start, end: start + Number(line !== undefined) }, [marker + (line ?? '')])) return;

    lastText.current = null;
    setPlainEdit(null);
    setFocusedTask(start);
  }

  function writeTask(task: Task, text: string | null, checked = task.checked) {
    if (text === null) return writeLines(task, []);
    return writeLines(task, [task.prefix + (checked ? 'x' : ' ') + task.gap
      + text.replaceAll('\n', '\n' + continuation)]);
  }

  return (
    <div className="note-body">
      <div className="note-body-actions">
        <button type="button" className="text-button" onClick={insertTask} disabled={content.length > maxLength - marker.length}>
          <Icon name="plus" size={16} />Вставить чекбокс
        </button>
      </div>
      <div className="note-body-editor" role="region" aria-label="Содержимое заметки">
        {blocks.map(block => block.kind === 'text' ? (
          <div key={`text-${block.start}`} className={hasTasks ? 'note-text-block' : 'note-text-block note-text-whole'}>
            <div className="note-text-measure" aria-hidden="true">{block.text + ' '}</div>
            <textarea className="content-input" rows={1}
              aria-label={block === firstText ? 'Текст заметки' : 'Продолжение заметки'}
              placeholder={hasTasks ? block.start === lines.length ? 'Продолжить заметку…' : undefined : placeholder}
              value={block.text} maxLength={maxLength}
              onFocus={event => {
                lastText.current = { start: block.start, field: event.currentTarget };
                setPlainEdit({ start: block.start, end: block.end });
              }}
              onBlur={() => setPlainEdit(null)}
              onChange={event => writeText(block, event.currentTarget.value)} />
          </div>
        ) : (
          <TaskRow key={`task-${block.start}`} task={block} startEditing={focusedTask === block.start}
            onToggle={() => writeTask(block, block.text, !block.checked)}
            onChange={text => writeTask(block, text)} onRemove={() => writeTask(block, null)}
            onFinish={() => setFocusedTask(null)} onFocus={() => { lastText.current = null; }} />
        ))}
      </div>
    </div>
  );
}
