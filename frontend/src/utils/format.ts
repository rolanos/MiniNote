const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
});
const notePluralRules = new Intl.PluralRules('ru');
const noteWords: Partial<Record<Intl.LDMLPluralRule, string>> = {
  one: 'заметка', few: 'заметки', many: 'заметок', other: 'заметок',
};

export function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

export function formatNoteCount(count: number) {
  return `${count} ${noteWords[notePluralRules.select(count)] ?? 'заметок'}`;
}
