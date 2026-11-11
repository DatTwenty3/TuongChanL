import React from 'react';

/** Bộ icon nét đơn (24×24, stroke currentColor) dùng chung cho toàn giao diện. */
const PATHS: Record<string, string> = {
  open: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  save: 'M5 3h11l4 4v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M7 3v5h8V3 M7 21v-7h10v7',
  download: 'M12 3v12 M7 10l5 5 5-5 M4 20h16',
  image: 'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 10a1.5 1.5 0 1 0 0.01 0 M21 16l-5-5-9 9',
  layers: 'M12 3l9 5-9 5-9-5z M3 13l9 5 9-5 M3 17.5l9 5 9-5',
  code: 'M8 8l-4 4 4 4 M16 8l4 4-4 4 M14 5l-4 14',
  printer: 'M7 9V3h10v6 M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2 M7 14h10v7H7z',
  file: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z M14 3v5h5 M9 13h6 M9 17h6',
  table: 'M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z M3 10h18 M3 15h18 M9 5v14',
  cube: 'M12 3l8 4.5v9L12 21l-8-4.5v-9z M4 7.5l8 4.5 8-4.5 M12 12v9',
  calc: 'M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M8 7h8 M8 12h.01 M12 12h.01 M16 12h.01 M8 16h.01 M12 16h.01 M16 16h.01',
  ruler: 'M3 17L17 3l4 4L7 21z M7.5 12.5l2 2 M10.5 9.5l2 2 M13.5 6.5l2 2',
  sidebar: 'M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M9 4v16',
  fit: 'M4 9V4h5 M20 9V4h-5 M4 15v5h5 M20 15v5h-5',
  chevron: 'M6 9l6 6 6-6',
  close: 'M6 6l12 12 M18 6L6 18',
  plus: 'M12 5v14 M5 12h14',
  minus: 'M5 12h14',
  undo: 'M9 14L4 9l5-5 M4 9h10a6 6 0 0 1 0 12h-3',
  redo: 'M15 14l5-5-5-5 M20 9H10a6 6 0 0 0 0 12h3',
  history: 'M3 12a9 9 0 1 0 3-6.7 M3 4v5h5 M12 7v5l3 2',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M20 20l-4-4',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2v2 M12 20v2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M2 12h2 M20 12h2 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
  wall: 'M9 3h5v12h7v5H3v-5h6z',
  sliders: 'M4 6h10 M18 6h2 M4 12h4 M12 12h8 M4 18h12 M20 18h0 M14 4v4 M8 10v4 M16 16v4',
};

export type IconName = keyof typeof PATHS;

export const Icon: React.FC<{ name: IconName; size?: number }> = ({ name, size = 15 }) => (
  <svg
    className="ico"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {PATHS[name].split(' M').map((d, i) => (
      <path key={i} d={i === 0 ? d : 'M' + d} />
    ))}
  </svg>
);

/** Ký hiệu trạng thái: giữ nguyên ký tự trong DOM (textContent không đổi), CSS vẽ thành icon. */
const GLYPH: Record<string, { kind: string; label: string }> = {
  '\u2713': { kind: 'ok', label: 'đạt' },
  '\u2717': { kind: 'bad', label: 'không đạt' },
  '\u26A0': { kind: 'warn', label: 'cảnh báo' },
};

export const Sym: React.FC<{ ch: string; kind?: string }> = ({ ch, kind }) => {
  const g = GLYPH[ch];
  const k = kind ?? g?.kind ?? 'info';
  return (
    <span className={'g g-' + k} role="img" aria-label={g?.label ?? 'lưu ý'}>
      {ch}
    </span>
  );
};

export const Glyphs: React.FC<{ text: string }> = ({ text }) => (
  <>
    {text.split(/([\u2713\u2717\u26A0])/).map((part, i) =>
      GLYPH[part] ? <Sym key={i} ch={part} /> : part,
    )}
  </>
);

/** Biểu tượng thương hiệu: mặt cắt tường chắn chữ T ngược. */
export const BrandMark: React.FC<{ size?: number }> = ({ size = 22 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinejoin="round"
    strokeLinecap="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M9 3h5v12h7v5H3v-5h6z" fill="currentColor" fillOpacity={0.22} />
    <path d="M17.5 5.5l-2 2 M19 9l-3.5 3.5" />
  </svg>
);
