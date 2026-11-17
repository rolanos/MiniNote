import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import type { Note } from '../src/api/notes';

async function seed(request: APIRequestContext, content = 'Исходный текст'): Promise<Note> {
  const response = await request.post('/api/notes', { data: { title: `Заметка ${randomUUID()}`, content } });
  expect(response.status()).toBe(201);
  return response.json();
}

async function open(page: Page, note: Note) {
  await page.getByRole('button', { name: `Открыть заметку: ${note.title}`, exact: true }).click();
  await expect(page.getByLabel('Заголовок', { exact: true })).toHaveValue(note.title);
}

async function saved(page: Page) {
  await expect(page.getByText('Сохранено', { exact: true })).toBeVisible();
}

async function nextUntitled(request: APIRequestContext) {
  const notes: Note[] = await (await request.get('/api/notes')).json();
  const titles = new Set(notes.map(note => note.title.toLowerCase()));
  const base = 'Без названия';
  let title = base;
  for (let number = 2; titles.has(title.toLowerCase()); number++) title = `${base} (${number})`;
  return title;
}

async function freezeTime(page: Page) {
  await page.clock.install({ time: new Date('2030-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2030-01-01T00:00:01Z'));
}

test('US-01: новая пустая заметка сразу появляется в списке и редакторе', async ({ page, request }) => {
  const title = await nextUntitled(request);
  await page.goto('/');
  await page.getByRole('button', { name: 'Новая заметка', exact: true }).click();
  await saved(page);
  await expect(page.locator('.note-card.is-current h3')).toHaveText(title);
  await expect(page.getByLabel('Заголовок', { exact: true })).toHaveValue(title);
  await expect(page.getByLabel('Текст заметки')).toHaveValue('');
  await expect(page.locator('.notebook-pill')).toHaveText('Личное');
});

test('US-02: пустой список объясняет состояние и позволяет создать заметку', async ({ page }) => {
  await page.route('**/api/notes', async route => {
    if (route.request().method() === 'GET') await route.fulfill({ json: [] });
    else await route.continue();
  });
  await page.goto('/');
  await expect(page.getByText('Здесь будут ваши заметки')).toBeVisible();
  await page.locator('.list-empty').getByRole('button', { name: 'Создать заметку', exact: true }).click();
  await saved(page);
  await expect(page.locator('.note-card.is-current')).toBeVisible();
});

test('US-02: открывается полный текст и чек-лист, выбор доступен с клавиатуры', async ({ page, request }) => {
  const text = 'Длинный текст. '.repeat(100);
  const first = await seed(request, text + '\n- [x] Первое дело');
  const second = await seed(request, 'Другая заметка');
  await page.goto('/');
  await page.getByRole('button', { name: `Открыть заметку: ${first.title}`, exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('region', { name: 'Текст заметки' })).toContainText(text.trim());
  await expect(page.getByRole('checkbox', { name: 'Первое дело' })).toBeChecked();
  await open(page, second);
  await expect(page.getByLabel('Текст заметки')).toHaveValue(second.content);
  await expect(page.getByRole('checkbox')).toHaveCount(0);
});

test('US-03/04: последние изменения отправляются ровно через секунду паузы', async ({ page, request }) => {
  const first = await seed(request);
  const other = await seed(request);
  await freezeTime(page);
  await page.goto('/');
  await open(page, first);
  let writes = 0;
  page.on('request', req => { if (req.method() === 'PUT') writes++; });
  const title = `Изменённая ${randomUUID()}`;
  await page.getByLabel('Заголовок', { exact: true }).fill(title);
  await page.getByLabel('Текст заметки').fill('Новые значения\nВторая строка');
  await page.clock.runFor(999);
  expect(writes).toBe(0);
  await expect(page.getByText('Сохранено', { exact: true })).not.toBeVisible();
  await page.clock.runFor(1);
  await saved(page);
  expect(writes).toBe(1);
  await expect(page.locator('.note-card.is-current h3')).toHaveText(title);
  expect(await (await request.get(`/api/notes/${other.id}`)).json()).toEqual(other);
  await page.reload();
  await open(page, { ...first, title });
  await expect(page.getByLabel('Текст заметки')).toHaveValue('Новые значения\nВторая строка');
});

test('US-04: до ответа нет «Сохранено», ввод во время запроса не теряется', async ({ page, request }) => {
  const note = await seed(request);
  await freezeTime(page);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let writes = 0;
  await page.route(`**/api/notes/${note.id}`, async route => {
    if (route.request().method() === 'PUT' && ++writes === 1) await gate;
    await route.continue();
  });
  await page.goto('/');
  await open(page, note);
  await page.getByLabel('Текст заметки').fill('Первая версия');
  await page.clock.runFor(1000);
  await expect(page.getByText('Сохраняем на сервере…')).toBeVisible();
  await expect(page.getByText('Сохранено', { exact: true })).not.toBeVisible();
  await page.getByLabel('Текст заметки').fill('Последняя версия');
  await page.clock.runFor(1000);
  release();
  await expect(page.getByText('Ожидание автосохранения…')).toBeVisible();
  await page.clock.runFor(1);
  await saved(page);
  expect((await (await request.get(`/api/notes/${note.id}`)).json()).content).toBe('Последняя версия');
});

test('US-04: переключение сохраняет немедленно, без ожидания таймера', async ({ page, request }) => {
  const first = await seed(request);
  const second = await seed(request);
  await freezeTime(page);
  await page.goto('/');
  await open(page, first);
  await page.getByLabel('Текст заметки').fill('Сохранить при переходе');
  await open(page, second);
  expect((await (await request.get(`/api/notes/${first.id}`)).json()).content).toBe('Сохранить при переходе');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('US-04: потерянный ответ не очищает ввод; повтор сохраняет ту же запись', async ({ page, request }) => {
  const note = await seed(request);
  await freezeTime(page);
  let loseResponse = true;
  let writes = 0;
  await page.route(`**/api/notes/${note.id}`, async route => {
    if (route.request().method() === 'PUT') {
      writes++;
      if (loseResponse) { loseResponse = false; await route.fetch(); await route.abort('failed'); return; }
    }
    await route.continue();
  });
  await page.goto('/');
  await open(page, note);
  await page.getByLabel('Текст заметки').fill('Сохранить после сбоя');
  await page.clock.runFor(1000);
  await expect(page.getByRole('alert')).toContainText('Не удалось подтвердить сохранение');
  await expect(page.getByLabel('Текст заметки')).toHaveValue('Сохранить после сбоя');
  await page.clock.runFor(10000);
  expect(writes).toBe(1);
  await page.getByLabel('Текст заметки').fill('Добавлено после сбоя');
  await page.getByRole('button', { name: 'Повторить сохранение', exact: true }).click();
  await saved(page);
  expect(writes).toBe(3);
  expect((await (await request.get(`/api/notes/${note.id}`)).json()).content).toBe('Добавлено после сбоя');
});

test('US-04: ошибка блокирует переход до повтора или явного отказа', async ({ page, request }) => {
  const first = await seed(request);
  const second = await seed(request);
  await page.route(`**/api/notes/${first.id}`, async route => {
    if (route.request().method() === 'PUT') await route.fulfill({ status: 503, json: { title: 'Сбой сети' } });
    else await route.continue();
  });
  await page.goto('/');
  await open(page, first);
  await page.getByLabel('Текст заметки').fill('Несохранённый текст');
  await page.getByRole('button', { name: `Открыть заметку: ${second.title}`, exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Остаться', exact: true }).click();
  await expect(page.getByLabel('Текст заметки')).toHaveValue('Несохранённый текст');
  await page.getByRole('button', { name: `Открыть заметку: ${second.title}`, exact: true }).click();
  await page.getByRole('button', { name: 'Не сохранять', exact: true }).click();
  await expect(page.getByLabel('Заголовок', { exact: true })).toHaveValue(second.title);
  expect((await (await request.get(`/api/notes/${first.id}`)).json()).content).toBe(first.content);
  await open(page, first);
  await page.getByLabel('Текст заметки').fill('Повтор перед переходом');
  await page.getByRole('button', { name: `Открыть заметку: ${second.title}`, exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.unroute(`**/api/notes/${first.id}`);
  await page.getByRole('button', { name: 'Повторить и перейти', exact: true }).click();
  await expect(page.getByLabel('Заголовок', { exact: true })).toHaveValue(second.title);
  expect((await (await request.get(`/api/notes/${first.id}`)).json()).content).toBe('Повтор перед переходом');
});

test('US-10: непустые пункты, независимые отметки, автосохранение и перезагрузка', async ({ page, request }) => {
  const note = await seed(request, '');
  await page.goto('/');
  await open(page, note);
  const insert = page.getByRole('button', { name: 'Вставить чекбокс' });
  const input = page.getByRole('textbox', { name: 'Текст пункта' });
  await insert.click();
  await input.fill('   ');
  await input.press('Enter');
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  for (const task of ['Первое дело', 'Второе дело']) {
    await insert.click();
    await input.fill(task);
    await input.press('Enter');
  }
  const first = page.getByRole('checkbox', { name: 'Первое дело', exact: true });
  const second = page.getByRole('checkbox', { name: 'Второе дело', exact: true });
  await first.check();
  await saved(page);
  await page.reload();
  await open(page, note);
  await expect(first).toBeChecked();
  await expect(second).not.toBeChecked();
  await first.uncheck();
  await second.check();
  await saved(page);
  const stored = await (await request.get(`/api/notes/${note.id}`)).json();
  expect(stored.content).toBe('- [ ] Первое дело\n- [x] Второе дело');
  expect(stored).not.toHaveProperty('checklist');
  await page.reload();
  await open(page, note);
  await expect(first).not.toBeChecked();
  await expect(second).toBeChecked();
});

test('US-01/04: повтор создания после потери ответа сохраняет введённый текст без дубля', async ({ page, request }) => {
  let loseResponse = true;
  await page.route('**/api/notes', async route => {
    if (route.request().method() === 'POST' && loseResponse) {
      loseResponse = false; await route.fetch(); await route.abort('failed');
    } else await route.continue();
  });
  const title = `Повтор ${randomUUID()}`;
  await page.goto('/');
  await page.getByRole('button', { name: 'Новая заметка', exact: true }).click();
  await page.getByLabel('Заголовок', { exact: true }).fill(title);
  await page.getByLabel('Текст заметки').fill('Ввод сохраняется');
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: 'Повторить сохранение', exact: true }).click();
  await saved(page);
  const notes = await (await request.get('/api/notes')).json();
  expect(notes.filter((item: Note) => item.title === title)).toHaveLength(1);
});

test('US-02: ошибку открытия можно повторить', async ({ page, request }) => {
  const first = await seed(request);
  const second = await seed(request);
  let fail = true;
  await page.route(`**/api/notes/${first.id}`, async route => {
    if (fail) { fail = false; await route.fulfill({ status: 503, json: { title: 'Ошибка открытия' } }); }
    else await route.continue();
  });
  await page.goto('/');
  await page.getByRole('button', { name: `Открыть заметку: ${first.title}`, exact: true }).click();
  await page.getByRole('button', { name: 'Повторить открытие', exact: true }).click();
  await expect(page.getByLabel('Текст заметки')).toHaveValue(first.content);
  await open(page, second);
  await expect(page.getByLabel('Текст заметки')).toHaveValue(second.content);
});

test('US-04: новый ввод заново отсчитывает секунду до автосохранения', async ({ page, request }) => {
  const note = await seed(request);
  await freezeTime(page);
  await page.goto('/');
  await open(page, note);
  let writes = 0;
  page.on('request', req => { if (req.method() === 'PUT') writes++; });
  await page.getByLabel('Текст заметки').fill('Начало');
  await page.clock.runFor(700);
  await page.getByLabel('Текст заметки').fill('Последний ввод');
  await page.clock.runFor(999);
  expect(writes).toBe(0);
  await page.clock.runFor(1);
  await saved(page);
  expect(writes).toBe(1);
  expect((await (await request.get(`/api/notes/${note.id}`)).json()).content).toBe('Последний ввод');
});

test('US-02: поздний ответ открытия не заменяет последнюю выбранную заметку', async ({ page, request }) => {
  const first = await seed(request);
  const second = await seed(request);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let started!: () => void;
  const requested = new Promise<void>(resolve => { started = resolve; });
  await page.route(`**/api/notes/${first.id}`, async route => {
    started();
    await gate;
    await route.fulfill({ json: first });
  });
  await page.goto('/');
  await page.getByRole('button', { name: `Открыть заметку: ${first.title}`, exact: true }).click();
  await requested;
  await open(page, second);
  release();
  await page.unrouteAll({ behavior: 'wait' });
  await expect(page.getByLabel('Заголовок', { exact: true })).toHaveValue(second.title);
  await expect(page.getByLabel('Текст заметки')).toHaveValue(second.content);
});

test('US-04: новый выбор во время повтора сохранения определяет конечный переход', async ({ page, request }) => {
  const first = await seed(request);
  const second = await seed(request);
  const third = await seed(request);
  let fail = true;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let started!: () => void;
  const requested = new Promise<void>(resolve => { started = resolve; });
  await page.route(`**/api/notes/${first.id}`, async route => {
    if (route.request().method() !== 'PUT') { await route.continue(); return; }
    if (fail) {
      fail = false;
      await route.fulfill({ status: 503, json: { title: 'Ошибка сохранения' } });
      return;
    }
    started();
    await gate;
    await route.continue();
  });
  await page.goto('/');
  await open(page, first);
  await page.getByLabel('Текст заметки').fill('Последний текст');
  await page.getByRole('button', { name: `Открыть заметку: ${second.title}`, exact: true }).click();
  await page.getByRole('button', { name: 'Повторить и перейти', exact: true }).click();
  await requested;
  await page.getByRole('button', { name: `Открыть заметку: ${third.title}`, exact: true }).click();
  release();
  await expect(page.getByLabel('Заголовок', { exact: true })).toHaveValue(third.title);
  expect((await (await request.get(`/api/notes/${first.id}`)).json()).content).toBe('Последний текст');
});

test('API: старые пункты преобразуются в текст с сохранением порядка и переносов', async ({ page, request }) => {
  const response = await request.post('/api/notes', { data: {
    title: `Старая заметка ${randomUUID()}`, content: 'Исходный текст\n- [ ] Уже в тексте',
    checklist: [
      { id: randomUUID(), text: 'Заголовок дела\r\n- [ ] Продолжение дела', isCompleted: true },
      { id: randomUUID(), text: 'Второй пункт', isCompleted: false },
    ],
  } });
  expect(response.status()).toBe(201);
  const note: Note = await response.json();
  expect(note.content).toBe('Исходный текст\n- [ ] Уже в тексте\n\n- [x] Заголовок дела\n  | - [ ] Продолжение дела\n- [ ] Второй пункт');
  expect(note).not.toHaveProperty('checklist');

  await page.goto('/');
  await open(page, note);
  await expect(page.getByRole('checkbox')).toHaveCount(3);
  await expect(page.getByRole('checkbox', { name: /Заголовок дела/ })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Второй пункт' })).not.toBeChecked();
});

test('US-04: устаревшая вкладка сохраняет черновик и не затирает текст', async ({ page, context, request }) => {
  const note = await seed(request, 'Исходный текст\n\n- [ ] Отметить дело');
  const other = await seed(request);
  const secondTab = await context.newPage();
  await Promise.all([page.goto('/'), secondTab.goto('/')]);
  await Promise.all([open(page, note), open(secondTab, note)]);

  await page.getByRole('button', { name: 'Редактировать весь текст' }).click();
  const updatedText = note.content.replace('Исходный текст', 'Сохранено в первой вкладке');
  await page.getByLabel('Текст заметки').fill(updatedText);
  await saved(page);
  const checkbox = secondTab.getByRole('checkbox', { name: 'Отметить дело' });
  const body = secondTab.getByRole('region', { name: 'Текст заметки' });
  await checkbox.check();
  await expect(secondTab.getByRole('alert')).toContainText('Конфликт версий');
  await expect(checkbox).toBeChecked();
  await expect(body.getByText('Исходный текст', { exact: true })).toBeVisible();
  const current = await (await request.get(`/api/notes/${note.id}`)).json();
  expect(current.content).toBe(updatedText);

  await secondTab.getByRole('button', { name: `Открыть заметку: ${other.title}`, exact: true }).click();
  const dialog = secondTab.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Повторить и перейти' })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Остаться', exact: true }).click();

  const reload = secondTab.getByRole('button', { name: 'Отбросить правки и обновить', exact: true });
  const url = `**/api/notes/${note.id}`;
  await secondTab.route(url, route => route.abort('failed'), { times: 1 });
  await reload.click();
  await expect(secondTab.getByRole('alert')).toContainText('Не удалось обновить заметку');
  await expect(checkbox).toBeChecked();

  await reload.click();
  await expect(body.getByText('Сохранено в первой вкладке', { exact: true })).toBeVisible();
  await expect(checkbox).not.toBeChecked();
  await checkbox.check();
  await saved(secondTab);
  expect(await (await request.get(`/api/notes/${note.id}`)).json()).toEqual({
    ...current, version: current.version + 1, content: updatedText.replace('[ ]', '[x]'),
  });
});

test('US-04: повтор создания не затирает правки, сохранённые до подтверждения', async ({ page, request }) => {
  let created!: Note;
  let first = true;
  await page.route('**/api/notes', async route => {
    if (first && route.request().method() === 'POST') {
      first = false;
      created = await (await route.fetch()).json();
      await route.abort('failed');
      return;
    }
    await route.continue();
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Новая заметка', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Не удалось подтвердить создание');
  const body = page.getByLabel('Текст заметки');
  await body.fill('Мой черновик');
  const url = `/api/notes/${created.id}`;
  const edit = await request.put(url, { data: { version: created.version, content: 'Уже сохранено' } });
  expect(edit.status()).toBe(200);

  await page.getByRole('button', { name: 'Повторить сохранение', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Конфликт версий');
  await expect(body).toHaveValue('Мой черновик');
  expect(await (await request.get(url)).json()).toEqual(await edit.json());
});

test('API: при параллельных изменениях версии сохраняется только один запрос', async ({ request }) => {
  const note = await seed(request);
  const url = `/api/notes/${note.id}`;
  expect((await request.put(url, { data: { title: 'Без версии' } })).status()).toBe(400);
  const writes = ['Первый', 'Второй'].map(label => `${label} ${randomUUID()}`).map(title => ({
    title, content: '- [ ] ' + title, version: note.version,
  }));
  const responses = await Promise.all(writes.map(data => request.put(url, { data })));
  expect(responses.map(response => response.status()).sort()).toEqual([200, 409]);
  const winner = writes[responses.findIndex(response => response.ok())];
  expect(await (await request.get(url)).json()).toEqual({ ...note, ...winner, version: note.version + 1 });
});

test('API: повтор создания сверяется с исходным запросом после редактирования', async ({ request }) => {
  const headers = { 'Idempotency-Key': randomUUID() };
  const initial = {
    title: 'Исходная заметка', content: 'Исходный текст',
    checklist: [{ id: randomUUID(), text: 'Дело', isCompleted: false }],
  };
  const creation = await request.post('/api/notes', { headers, data: initial });
  expect(creation.status()).toBe(201);
  const created: Note = await creation.json();
  const edits = { ...initial, content: 'После правки', checklist: [] };
  const saved = await request.put(`/api/notes/${created.id}`, { data: { ...edits, version: created.version } });
  expect(saved.status()).toBe(200);
  const replay = await request.post('/api/notes', { headers, data: initial });
  expect(replay.status()).toBe(200);
  expect(await replay.json()).toEqual(await saved.json());
  expect((await request.post('/api/notes', { headers, data: edits })).status()).toBe(409);
});

test('Пункт редактируется по клику и удаляется при стирании текста', async ({ page, request }) => {
  const note = await seed(request, 'Начало\n- [x] Черновой пункт\n- [ ] Лишний пункт\nКонец');
  await page.goto('/');
  await open(page, note);
  await page.getByRole('button', { name: 'Черновой пункт', exact: true }).click();
  const itemText = page.getByRole('textbox', { name: 'Текст пункта' });
  await itemText.fill('');
  await itemText.fill('Уточнённый пункт');
  await itemText.press('Enter');
  await page.getByRole('button', { name: 'Лишний пункт', exact: true }).click();
  await itemText.fill('');
  await itemText.press('Tab');
  await expect(page.getByRole('checkbox', { name: 'Лишний пункт' })).toHaveCount(0);
  await saved(page);
  await page.reload();
  await open(page, note);
  await expect(page.getByRole('checkbox', { name: 'Уточнённый пункт' })).toBeChecked();
  await expect(page.getByRole('checkbox')).toHaveCount(1);
  expect((await (await request.get(`/api/notes/${note.id}`)).json()).content).toBe('Начало\n- [x] Уточнённый пункт\nКонец');
});

test('Чекбокс вставляется в строку текста и сохраняет отметку', async ({ page, request }) => {
  const note = await seed(request, 'План на завтра\nПозвонить\nЗаметка внизу');
  await page.goto('/');
  await open(page, note);
  const text = page.getByRole('textbox', { name: 'Текст заметки' });
  await text.evaluate((element: HTMLTextAreaElement) => {
    const position = element.value.indexOf('Позвонить');
    element.focus();
    element.setSelectionRange(position, position);
  });
  await page.getByRole('button', { name: 'Вставить чекбокс' }).click();
  const task = page.getByRole('textbox', { name: 'Текст пункта' });
  await expect(task).toHaveValue('Позвонить');
  await task.press('Enter');
  const preview = page.getByRole('region', { name: 'Текст заметки' });
  await expect(preview.getByText('План на завтра')).toBeVisible();
  await expect(preview.getByText('Заметка внизу')).toBeVisible();
  await preview.getByRole('checkbox', { name: 'Позвонить' }).check();
  await saved(page);
  await page.reload();
  await open(page, note);
  await expect(preview.getByRole('checkbox', { name: 'Позвонить' })).toBeChecked();
  await page.getByRole('button', { name: 'Редактировать весь текст' }).click();
  await expect(text).toHaveValue('План на завтра\n- [x] Позвонить\nЗаметка внизу');
});

test('Занятые названия получают свободный номер при создании и переименовании', async ({ request }) => {
  const title = `Планы ${randomUUID()}`;
  const create = (name: string) => request.post('/api/notes', { data: { title: name } });
  expect((await create(title)).status()).toBe(201);
  expect((await create(`${title} (2)`)).status()).toBe(201);

  const copies = await Promise.all([create(title.toLowerCase()), create(title.toLowerCase())]);
  expect(copies.map(response => response.status())).toEqual([201, 201]);
  const titles = await Promise.all(copies.map(async response => (await response.json()).title));
  expect(titles.sort()).toEqual([`${title.toLowerCase()} (3)`, `${title.toLowerCase()} (4)`]);

  const note = await seed(request);
  const url = `/api/notes/${note.id}`;
  const data = { title: `  ${title}  `, version: note.version, content: note.content };
  const response = await request.put(url, { data });
  expect(response.status()).toBe(200);
  const renamed = await response.json();
  expect(renamed.title).toBe(`${title} (5)`);
  const retry = await request.put(url, { data });
  expect(retry.status()).toBe(200);
  expect(await retry.json()).toEqual(renamed);

  const headers = { 'Idempotency-Key': randomUUID() };
  const input = { title, content: 'Новая заметка' };
  const created = await request.post('/api/notes', { data: input, headers });
  expect(created.status()).toBe(201);
  const saved = await created.json();
  expect(saved.title).toBe(`${title} (6)`);
  const replay = await request.post('/api/notes', { data: input, headers });
  expect(replay.status()).toBe(200);
  expect(await replay.json()).toEqual(saved);
});

test('API: валидация чек-листа, пустого заголовка и изоляция заметок', async ({ request }) => {
  const first = await seed(request);
  const second = await seed(request);
  const items = [{ id: randomUUID(), text: 'Дело', isCompleted: true }];
  const title = await nextUntitled(request);
  const result = await request.put(`/api/notes/${first.id}`, { data: { title: ' ', content: '', checklist: items, version: first.version } });
  expect(result.status()).toBe(200);
  const updated = await result.json();
  expect(updated).toEqual({ ...first, title, content: '- [x] Дело', version: first.version + 1 });
  expect(await (await request.get(`/api/notes/${second.id}`)).json()).toEqual(second);
  for (const checklist of [[{ ...items[0], text: ' ' }], [items[0], items[0]], [{ ...items[0], text: 'а'.repeat(1001) }]]) {
    expect((await request.put(`/api/notes/${first.id}`, { data: { checklist, version: updated.version } })).status()).toBe(400);
  }
  expect(await (await request.get(`/api/notes/${first.id}`)).json()).toEqual(updated);
  expect((await request.put(`/api/notes/${first.id}`, { data: { title: 'а'.repeat(201), version: updated.version } })).status()).toBe(400);
  expect((await request.get(`/api/notes/${randomUUID()}`)).status()).toBe(404);
  const schema = await (await request.get(`${process.env.E2E_API_URL || 'http://127.0.0.1:5080'}/openapi/v1.json`)).json();
  expect(Object.keys(schema.paths).sort()).toEqual(['/api/notes', '/api/notes/{id}']);
  expect(Object.keys(schema.paths['/api/notes']).sort()).toEqual(['get', 'post']);
  expect(Object.keys(schema.paths['/api/notes/{id}']).sort()).toEqual(['get', 'put']);
});
