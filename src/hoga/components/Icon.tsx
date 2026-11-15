type Name = 'manhole' | 'undo' | 'redo' | 'open' | 'save' | 'export' | 'sun' | 'moon' | 'plus' | 'copy' | 'trash' | 'warn' | 'zoomIn' | 'zoomOut' | 'fit';

const PATHS: Record<Name, string> = {
  manhole: 'M4 4h16v16H4z M8 8h8v8H8z M12 12m-1.6 0a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0 -3.2 0',
  undo: 'M9 14L4 9l5-5 M4 9h10a6 6 0 0 1 0 12h-3',
  redo: 'M15 14l5-5-5-5 M20 9H10a6 6 0 0 0 0 12h3',
  open: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  save: 'M5 3h11l4 4v14H5z M8 3v6h8V3 M8 21v-7h8v7',
  export: 'M12 3v12 M7 10l5 5 5-5 M4 20h16',
  sun: 'M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0 M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1.5 1.5 M17.5 17.5L19 19 M5 19l1.5-1.5 M17.5 6.5L19 5',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z',
  plus: 'M12 5v14 M5 12h14',
  copy: 'M9 9h11v11H9z M5 15V5h10',
  trash: 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13',
  warn: 'M12 3l10 18H2z M12 10v5 M12 18v.5',
  zoomIn: 'M11 11m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0 M21 21l-5-5 M8 11h6 M11 8v6',
  zoomOut: 'M11 11m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0 M21 21l-5-5 M8 11h6',
  fit: 'M4 9V4h5 M20 9V4h-5 M4 15v5h5 M20 15v5h-5',
};

export function Icon({ name, size = 16 }: { name: Name; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  );
}
