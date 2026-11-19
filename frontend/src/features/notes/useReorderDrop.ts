import { useRef, useState, type DragEvent } from 'react';

export const noteDragType = 'application/x-mininote-note';
export const notebookDragType = 'application/x-mininote-notebook';
export type Reorder = (id: string, targetId: string, before: boolean) => void;

function dropEdge(event: DragEvent<HTMLElement>) {
  const item = event.currentTarget;
  const bounds = item.getBoundingClientRect();
  const inline = getComputedStyle(item).getPropertyValue('--reorder-axis').trim() === 'inline';
  const before = inline ? event.clientX < bounds.left + bounds.width / 2
    : event.clientY < bounds.top + bounds.height / 2;
  return before ? 'before' : 'after';
}

export function useReorderDrop(type: string, onReorder?: Reorder) {
  const source = useRef<string | undefined>(undefined);
  const [target, setTarget] = useState<{ id: string; edge: 'before' | 'after' } | null>(null);

  function dropProps(id: string) {
    if (!onReorder) return {};
    return {
      'data-reorder-edge': target?.id === id ? target.edge : undefined,
      onDragOver(event: DragEvent<HTMLElement>) {
        if (!source.current || source.current === id || !event.dataTransfer.types.includes(type)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        const edge = dropEdge(event);
        setTarget(current => current?.id === id && current.edge === edge ? current : { id, edge });
      },
      onDragLeave(event: DragEvent<HTMLElement>) {
        if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
        setTarget(current => current?.id === id ? null : current);
      },
      onDrop(event: DragEvent<HTMLElement>) {
        const sourceId = source.current;
        if (!sourceId || sourceId === id || event.dataTransfer.getData(type) !== sourceId) return;
        event.preventDefault();
        setTarget(null);
        onReorder(sourceId, id, dropEdge(event) === 'before');
      },
    };
  }

  return {
    dropProps,
    start: (id: string) => { source.current = id; },
    clear: () => { source.current = undefined; setTarget(null); },
  };
}
