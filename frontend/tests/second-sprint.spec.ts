import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import type { Note, NoteListItem, Notebook, Tag } from '../src/api/notes';

async function createNotebook(request: APIRequestContext, name = `Блокнот ${randomUUID()}`): Promise<Notebook> {
  const response = await request.post('/api/notebooks', { data: { name } });
  expect(response.status()).toBe(201);
  return response.json();
}

async function createNote(request: APIRequestContext, content: string, notebookId?: string,
  title = `Запись ${randomUUID()}`): Promise<Note> {
  const response = await request.post('/api/notes', { data: { title, content, notebookId } });
  expect(response.status()).toBe(201);
  return response.json();
}

async function addTag(request: APIRequestContext, note: Note, tagName: string): Promise<Note> {
  const response = await request.patch(`/api/notes/${note.id}/organization`, {
    data: { version: note.version, tagName },
  });
  expect(response.status()).toBe(200);
  return response.json();
}

const noteCard = (page: Page, title: string) =>
  page.getByRole('button', { name: `Открыть заметку: ${title}`, exact: true });

const view = (page: Page, name: string) =>
  page.getByRole('navigation', { name: 'Разделы заметок' }).getByRole('button', { name, exact: true });

test('US-07: создание в выбранном блокноте и перенос сохраняют введённый текст', async ({ page, request }) => {
  const source = await createNotebook(request);
  const original = await createNote(request, 'До переноса', source.id);
  const name = `Учёба ${randomUUID()}`;
  await page.goto('/');
  await page.getByRole('button', { name: 'Новый блокнот' }).click();
  await page.getByLabel('Название блокнота').fill(name);
  await page.getByRole('button', { name: 'Создать блокнот', exact: true }).click();
  await expect(view(page, name)).toHaveAttribute('aria-current', 'page');
  await expect(noteCard(page, original.title)).toHaveCount(0);

  await page.getByRole('button', { name: 'Новая заметка', exact: true }).click();
  await expect(page.locator('.notebook-pill')).toHaveText(name);
  const createdTitle = `Конспект ${randomUUID()}`;
  await page.getByLabel('Заголовок').fill(createdTitle);
  await expect(noteCard(page, createdTitle)).toBeVisible();

  await view(page, source.name).click();
  await expect(noteCard(page, createdTitle)).toHaveCount(0);
  await noteCard(page, original.title).click();
  await expect(page.getByLabel('Заголовок')).toHaveValue(original.title);
  await page.getByLabel('Текст заметки').fill('Черновик непосредственно перед переносом');
  await noteCard(page, original.title).locator('h3').dragTo(view(page, name));
  await expect(page.locator('.notebook-pill')).toHaveText(name);
  await expect(noteCard(page, original.title)).toHaveCount(0);
  await view(page, name).click();
  await noteCard(page, original.title).click();
  await expect(page.getByLabel('Текст заметки')).toHaveValue('Черновик непосредственно перед переносом');
  expect(await (await request.get(`/api/notes/${original.id}`)).json()).toMatchObject({ notebookName: name });
});

test('Карточка переносится без открытия, а выбранную заметку можно перенести с клавиатуры', async ({ page, request }) => {
  const source = await createNotebook(request);
  const target = await createNotebook(request);
  const dragged = await addTag(request, await createNote(request, 'Эту заметку переносим мышью', source.id),
    `Тег переноса ${randomUUID()}`);
  const open = await createNote(request, 'Текст открытой заметки', source.id);
  await page.goto('/');
  await view(page, source.name).click();
  await noteCard(page, open.title).click();
  await page.getByLabel('Текст заметки').fill('Сохранить этот черновик');
  await noteCard(page, dragged.title).dragTo(view(page, target.name));
  await expect(page.getByRole('status').filter({ hasText: 'Заметка перенесена' })).toBeVisible();
  await expect(noteCard(page, dragged.title)).toHaveCount(0);
  await expect(page.getByLabel('Заголовок')).toHaveValue(open.title);
  await expect(page.getByLabel('Текст заметки')).toHaveValue('Сохранить этот черновик');
  expect(await (await request.get(`/api/notes/${dragged.id}`)).json())
    .toMatchObject({ notebookId: target.id, tags: dragged.tags });

  await page.getByRole('button', { name: 'Перенести в блокнот', exact: true }).press('Enter');
  await expect(view(page, target.name)).toHaveAttribute('data-move-target', '');
  await view(page, target.name).press('Enter');
  await expect(page.locator('.notebook-pill')).toHaveText(target.name);
  await view(page, target.name).click();
  await expect(noteCard(page, dragged.title)).toBeVisible();
  await expect(noteCard(page, open.title)).toBeVisible();
  expect(await (await request.get(`/api/notes/${open.id}`)).json())
    .toMatchObject({ notebookId: target.id, content: 'Сохранить этот черновик' });
});

test('US-08 и US-09: фильтры работают вместе, тег можно назначить и снять', async ({ page, request }) => {
  const notebook = await createNotebook(request);
  const needle = `Задача_${randomUUID()}`;
  const tag = `Важное-${randomUUID()}`;
  const included = await addTag(request, await createNote(request, `Текст\n- [ ] ${needle}`, notebook.id), tag);
  const withoutTag = await createNote(request, needle, notebook.id);
  const otherNotebook = await addTag(request, await createNote(request, needle), tag.toUpperCase());
  expect(included.tags[0].id).toBe(otherNotebook.tags[0].id);
  const similar = await createNote(request, needle.replace('_', 'X'), notebook.id);
  const titleMatch = await createNote(request, 'Другой текст', notebook.id, needle);
  const matches: NoteListItem[] = await (await request.get('/api/notes', {
    params: { query: needle.toUpperCase(), notebookId: notebook.id },
  })).json();
  expect(matches.map(item => item.id).sort()).toEqual([included.id, withoutTag.id, titleMatch.id].sort());
  expect(matches.some(item => item.id === similar.id)).toBe(false);

  await page.goto('/');
  await view(page, notebook.name).click();
  await page.getByLabel('Фильтр по тегу').selectOption({ label: tag });
  const search = page.getByRole('searchbox', { name: 'Поиск заметок' });
  await search.fill(needle.toUpperCase());
  await expect(noteCard(page, included.title)).toBeVisible();
  await expect(noteCard(page, withoutTag.title)).toHaveCount(0);
  await expect(noteCard(page, otherNotebook.title)).toHaveCount(0);
  await search.fill(needle.replace('_', 'X'));
  await expect(page.getByText('Ничего не найдено')).toBeVisible();
  await search.clear();
  await noteCard(page, included.title).click();
  await page.getByRole('button', { name: `Снять тег: ${tag}` }).click();
  await expect(page.getByText('Ничего не найдено')).toBeVisible();
  await page.getByLabel('Фильтр по тегу').selectOption('');
  await expect(noteCard(page, withoutTag.title)).toBeVisible();
  await page.getByLabel('Добавить тег', { exact: true }).fill(tag.toUpperCase());
  await page.getByRole('button', { name: 'Добавить тег', exact: true }).click();
  await expect(page.getByRole('button', { name: `Снять тег: ${tag}` })).toBeVisible();
  const updated: Note = await (await request.get(`/api/notes/${included.id}`)).json();
  expect(updated.tags).toEqual(included.tags);
});

test('US-05 и US-06: корзина переживает перезагрузку и восстанавливает содержимое', async ({ page, request }) => {
  const notebook = await createNotebook(request);
  const tag = `Корзина-${randomUUID()}`;
  const original = await addTag(request, await createNote(request, 'Важное\n- [x] Проверено', notebook.id), tag);
  const untouched = await createNote(request, 'Не переносить', notebook.id);

  await page.goto('/');
  await view(page, notebook.name).click();
  await noteCard(page, original.title).click();
  await expect(page.getByRole('checkbox', { name: 'Проверено' })).toBeChecked();
  await page.getByRole('button', { name: 'В корзину', exact: true }).click();
  await expect(noteCard(page, original.title)).toHaveCount(0);
  await expect(noteCard(page, untouched.title)).toBeVisible();
  const activeSearch: NoteListItem[] = await (await request.get('/api/notes', {
    params: { query: 'Важное', notebookId: notebook.id, tagId: original.tags[0].id },
  })).json();
  expect(activeSearch).toEqual([]);

  await page.reload();
  await view(page, 'Корзина').click();
  await noteCard(page, original.title).click();
  await expect(page.getByLabel('Заголовок')).toBeDisabled();
  await expect(page.getByRole('checkbox', { name: 'Проверено' })).toBeChecked();
  await page.getByRole('button', { name: 'Восстановить заметку' }).click();
  await expect(noteCard(page, original.title)).toHaveCount(0);
  await view(page, notebook.name).click();
  await noteCard(page, original.title).click();
  await expect(page.getByRole('checkbox', { name: 'Проверено' })).toBeChecked();
  await expect(page.getByRole('button', { name: `Снять тег: ${tag}` })).toBeVisible();
  const restored: Note = await (await request.get(`/api/notes/${original.id}`)).json();
  expect(restored).toEqual({ ...original, deletedAt: null, version: original.version + 2 });
  expect(await (await request.get(`/api/notes/${untouched.id}`)).json()).toEqual(untouched);
});

test('API: создание, перенос и теги сохраняют уникальность при конкурирующих запросах', async ({ request }) => {
  expect((await request.post('/api/notebooks', { data: { name: '   ' } })).status()).toBe(400);
  const source = await createNotebook(request);
  const target = await createNotebook(request);
  const title = 'Общий заголовок';
  const first = await createNote(request, 'Первая', source.id, title);
  await createNote(request, 'Вторая', target.id, title);
  const headers = { 'Idempotency-Key': randomUUID() };
  const initial = { title: 'Повтор', notebookId: source.id };
  const original = await request.post('/api/notes', { headers, data: initial });
  const replay = await request.post('/api/notes', { headers, data: initial });
  expect(original.status()).toBe(201);
  expect(replay.status()).toBe(200);
  expect(await replay.json()).toEqual(await original.json());
  expect((await request.post('/api/notes', { headers, data: { ...initial, notebookId: target.id } })).status()).toBe(409);
  const tagName = `Тег-${randomUUID()}`;
  const note = await createNote(request, 'Другая');
  const [moved, tagged] = await Promise.all([
    request.patch(`/api/notes/${first.id}/organization`, {
      data: { version: first.version, notebookId: target.id, tagName },
    }),
    addTag(request, note, tagName.toUpperCase()),
  ]);
  expect(moved.status()).toBe(200);
  const result: Note = await moved.json();
  expect(result).toMatchObject({ title: title + ' (2)', notebookId: target.id });
  expect(result.tags[0].id).toBe(tagged.tags[0].id);
  const tags: Tag[] = await (await request.get('/api/tags')).json();
  expect(tags.filter(tag => tag.name.toUpperCase() === tagName.toUpperCase())).toHaveLength(1);
  expect((await request.post(`/api/notes/${first.id}/trash`, { data: { version: first.version } })).status()).toBe(409);
});
