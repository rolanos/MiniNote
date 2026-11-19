export interface NoteListItem {
  id: string;
  title: string;
  preview: string;
  notebookId: string;
  notebookName: string;
  createdAt: string;
}

export interface Note extends Omit<NoteListItem, 'preview'> {
  content: string;
  version: number;
  deletedAt: string | null;
  tags: Tag[];
}

export interface Notebook {
  id: string;
  name: string;
}

export type Tag = Notebook;

export interface NoteFilter {
  notebookId?: string;
  tagId?: string;
  query?: string;
  trash?: boolean;
}

export interface OrganizationChange {
  notebookId?: string;
  tagName?: string;
  removeTagId?: string;
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

export function listNotes(filter: NoteFilter, signal?: AbortSignal): Promise<NoteListItem[]> {
  const params = new URLSearchParams();
  if (filter.trash) params.set('trash', 'true');
  if (filter.notebookId) params.set('notebookId', filter.notebookId);
  if (filter.tagId) params.set('tagId', filter.tagId);
  if (filter.query) params.set('query', filter.query);
  const query = params.toString();
  return request(query ? `/api/notes?${query}` : '/api/notes', { signal });
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

export function createNote(draft: NoteDraft, requestId: string, notebookId?: string): Promise<Note> {
  return request('/api/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': requestId },
    body: JSON.stringify({ ...draft, notebookId }),
  });
}

export function listNotebooks(signal: AbortSignal): Promise<Notebook[]> {
  return request('/api/notebooks', { signal });
}

export function listTags(signal: AbortSignal): Promise<Tag[]> {
  return request('/api/tags', { signal });
}

export function createNotebook(name: string): Promise<Notebook> {
  return request('/api/notebooks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}

export function organizeNote(note: Note, change: OrganizationChange): Promise<Note> {
  return request(`/api/notes/${encodeURIComponent(note.id)}/organization`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...change, version: note.version }),
  });
}

export function setNoteInTrash(note: Note, trash: boolean): Promise<Note> {
  return request(`/api/notes/${encodeURIComponent(note.id)}/${trash ? 'trash' : 'restore'}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ version: note.version }),
  });
}
