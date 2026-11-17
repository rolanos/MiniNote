export interface NoteListItem {
  id: string;
  title: string;
  preview: string;
  notebookName: string;
  createdAt: string;
}

export interface Note extends Omit<NoteListItem, 'preview'> {
  content: string;
  notebookId: string;
  version: number;
}

export interface NoteDraft {
  title: string;
  content: string;
}

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const timeout = AbortSignal.timeout(20_000);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  const response = await fetch(path, { ...options, signal });
  if (!response.ok) {
    const problem = await response.json().catch(() => null) as { title?: string; errors?: Record<string, string[]> } | null;
    const validation = problem?.errors ? Object.values(problem.errors).flat().join(' ') : undefined;
    throw new ApiError(response.status, validation || problem?.title || `Сервер вернул ошибку ${response.status}.`);
  }
  return response.json() as Promise<T>;
}

export function listNotes(signal?: AbortSignal): Promise<NoteListItem[]> {
  return request('/api/notes', { signal });
}

export function getNote(id: string, signal?: AbortSignal): Promise<Note> {
  return request(`/api/notes/${encodeURIComponent(id)}`, { signal });
}

export function updateNote(id: string, draft: NoteDraft, version: number): Promise<Note> {
  return request(`/api/notes/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...draft, version }),
  });
}

export function createNote(draft: NoteDraft, requestId: string): Promise<Note> {
  return request('/api/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': requestId },
    body: JSON.stringify(draft),
  });
}
