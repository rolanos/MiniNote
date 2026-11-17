import type { ReactNode } from 'react';

type IconName = 'plus' | 'book' | 'notebooks' | 'layers' | 'note' | 'check' | 'arrow' | 'alert' | 'refresh' | 'edit' | 'trash';

const paths: Record<IconName, ReactNode> = {
  edit: <path d="m14 5 5 5M4 20l4-.8L20 7l-3-3L5 16l-1 4Z" />,
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7m4-7v7" />,
  plus: <path d="M12 5v14M5 12h14" />,
  book: <><path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Z" /><path d="M12 5v15" /></>,
  notebooks: <><rect x="5" y="3" width="15" height="16" rx="3" /><path d="M5 15h12M5 8H3M5 12H3M5 16H3M8 19v2h12" /></>,
  layers: <><path d="m12 3 10 5-10 5L2 8l10-5ZM2 12l10 5 10-5M2 16l10 5 10-5" /></>,
  note: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Z" /><path d="M14 3v6h6M8 13h8M8 17h5" /></>,
  check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>,
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  alert: <><circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 17h.01" /></>,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M6.1 7a7 7 0 0 1 11.5-1L20 9M4 15l2.4 3A7 7 0 0 0 18 17" /></>,
};

export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

