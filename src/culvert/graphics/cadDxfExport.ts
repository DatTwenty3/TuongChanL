/**
 * AutoCAD R12 (`AC1009`) DXF, PLINE Command & Multi-File Uncompressed ZIP (CRC-32) Exporters
 *
 * Clean-room TypeScript port of:
 * - Module `06`: `TC_U2T`, `tc86Shape`, `tcDxf` (gravity retaining wall cross-section DXF)
 * - Module `16`: `HVD.dxf` (`hvdDxf`), `HVD.plcmd` (`hvdPlcmd`), `hdDxfFig` (`hdDxf`),
 *   `hdDxfPreviewSvg` (SVG legend/summary preview), and CRC-32 `hdZip` archiver
 */

import type { DemWatershedResult, Point2D } from '../types/project.ts';

const tf = (x: number, d = 2): string => {
  if (!Number.isFinite(x)) return '-';
  const [i, f] = (+x).toFixed(d).split('.');
  return i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (f ? '.' + f : '');
};

// ---------------------------------------------------------------------------
// 1. Module 06: Unicode -> TCVN3 Character Map & Retaining Wall R12 DXF (`tcDxf`)
// ---------------------------------------------------------------------------

export const TC_U2T: Readonly<Record<string, string>> = {
  á: '¸',
  à: 'µ',
  ả: '¶',
  ã: '·',
  ạ: '¹',
  ă: '¨',
  ắ: '¾',
  ằ: '»',
  ẳ: '¼',
  ẵ: '½',
  ặ: 'Æ',
  â: '©',
  ấ: 'Ê',
  ầ: 'Ç',
  ẩ: 'È',
  ẫ: 'É',
  ậ: 'Ë',
  đ: '®',
  é: 'Ð',
  è: 'Ì',
  ẻ: 'Î',
  ẽ: 'Ï',
  ẹ: 'Ñ',
  ê: 'ª',
  ế: 'Õ',
  ề: 'Ò',
  ể: 'Ó',
  ễ: 'Ô',
  ệ: 'Ö',
  í: 'Ý',
  ì: '×',
  ỉ: 'Ø',
  ĩ: 'Ü',
  ị: 'Þ',
  ó: 'ã',
  ò: 'ß',
  ỏ: 'á',
  õ: 'â',
  ọ: 'ä',
  ô: '«',
  ố: 'è',
  ồ: 'å',
  ổ: 'æ',
  ỗ: 'ç',
  ộ: 'é',
  ơ: '¬',
  ớ: 'í',
  ờ: 'ê',
  ở: 'ë',
  ỡ: 'ì',
  ợ: 'î',
  ú: 'ó',
  ù: 'ï',
  ủ: 'ñ',
  ũ: 'ò',
  ụ: 'ô',
  ư: '\u00ad',
  ứ: 'ø',
  ừ: 'õ',
  ử: 'ö',
  ữ: '÷',
  ự: 'ù',
  ý: 'ý',
  ỳ: 'ú',
  ỷ: 'û',
  ỹ: 'ü',
  ỵ: 'þ',
  Ă: '¡',
  Â: '¢',
  Đ: '§',
  Ê: '£',
  Ô: '¤',
  Ơ: '¥',
  Ư: '¦',
};

export interface Tc86LibraryInput {
  t1: number;
  H: number;
  w: number;
  B: number;
  C1: number;
  C2: number;
  A: number;
  M: number;
  B1: number;
  front: string;
  mat: string;
  Rk?: string;
  H1?: string | number;
}

export interface Tc86ShapeResult {
  t1: number;
  H: number;
  yt: number;
  A: number;
  M: number;
  C1: number;
  C2: number;
  B: number;
  Pf: number;
  w: number;
  x0: number;
  xft: number;
  foot: Point2D[];
  stem: Point2D[];
  cap: Point2D[];
}

export function tc86Shape(r: Tc86LibraryInput): Tc86ShapeResult {
  const t1 = r.t1;
  const H = r.H;
  const w = r.w / 100;
  const B = r.B / 100;
  const C1 = r.C1 / 100;
  const A = r.A / 100;
  const M = r.M / 100;
  const Pf = r.front === 'n' ? r.B1 / 100 : 0;
  const x0 = C1;
  const yt = t1 + H;
  const xft = x0 + Pf;
  return {
    t1,
    H,
    yt,
    A,
    M,
    C1,
    C2: r.C2 / 100,
    B,
    Pf,
    w,
    x0,
    xft,
    foot: [
      [0, 0],
      [0, t1],
      [A, t1],
      [A, t1 - M],
    ],
    stem: [
      [x0, t1],
      [x0 + B, t1],
      [xft + w, yt - 0.35],
      [xft + w - 0.15, yt - 0.2],
      [xft, yt - 0.2],
    ],
    cap: [
      [xft - 0.05, yt - 0.2],
      [xft - 0.05, yt - 0.05],
      [xft, yt],
      [xft + w - 0.15, yt],
      [xft + w - 0.15, yt - 0.2],
    ],
  };
}

export interface TcDxfInput {
  I: {
    H: number;
    b0: number;
    n1: number;
    n2: number;
    a1: number;
    a2: number;
    t1: number;
    t2: number;
    hf: number;
    m: number;
    Hs: number;
    LL?: boolean;
    dT: number;
    dT0?: number;
    stemMat: string;
    footMat: string;
  };
  g: {
    foot: Point2D[];
    stem: Point2D[];
    cap?: Point2D[] | null;
    yT: number;
    xbt: number;
    dy: number;
    B: number;
    xfb: number;
    xbb: number;
    xft: number;
    xf: (y: number) => number;
    xb: (y: number) => number;
  };
}

export type TcDxfUnit = 'm' | 'cm' | 'mm';
export type TcDxfFontMode = 'tcvn3' | 'uni';

export interface TcDxfOptions {
  r86?: Tc86LibraryInput | null;
  fmvua?: number;
}

export function unicodeToTcvn3Text(text: string): { t: string; isHeading: boolean } {
  const s = String(text);
  const up = s === s.toUpperCase() && /[A-ZĐ]/.test(s);
  const t = (up ? s.toLowerCase() : s)
    .split('')
    .map((c) => TC_U2T[c] || c)
    .join('');
  return { t, isHeading: up };
}

export function unicodeToDxfEscape(text: string): string {
  return String(text).replace(
    /[^\x20-\x7e]/g,
    (c) => '\\U+' + (c.codePointAt(0) ?? 63).toString(16).toUpperCase().padStart(4, '0'),
  );
}

export function tcDxf(
  R: TcDxfInput,
  unit: TcDxfUnit = 'cm',
  font: TcDxfFontMode = 'tcvn3',
  options?: TcDxfOptions,
): Uint8Array {
  const k = ({ m: 1, cm: 100, mm: 1000 } as const)[unit] || 100;
  const I = R.I;
  const g = R.g;
  const E: string[] = [];
  const tv = font !== 'uni';

  const n = (x: number): string => {
    const v = (+x * k)
      .toFixed(4)
      .replace(/(\.\d*?)0+$/, '$1')
      .replace(/\.$/, '');
    return v === '-0' ? '0' : v;
  };

  const enc = (s: string): { t: string; st: string } => {
    const raw = String(s);
    if (tv) {
      const { t, isHeading } = unicodeToTcvn3Text(raw);
      return { t, st: isHeading ? 'TC_VNH' : 'TC_VN' };
    }
    return {
      t: unicodeToDxfEscape(raw),
      st: 'TC_ARIAL',
    };
  };

  const fmt = (v: number): string => {
    const x = v * k;
    return unit === 'm'
      ? x.toFixed(2)
      : unit === 'mm'
        ? x.toFixed(0)
        : Math.abs(x - Math.round(x)) < 0.05
          ? x.toFixed(0)
          : x.toFixed(1);
  };

  const L = (ly: string, a: Point2D, b: Point2D) => {
    E.push(
      '0',
      'LINE',
      '8',
      ly,
      '10',
      n(a[0]),
      '20',
      n(a[1]),
      '30',
      '0',
      '11',
      n(b[0]),
      '21',
      n(b[1]),
      '31',
      '0',
    );
  };

  const PL = (ly: string, pts: readonly Point2D[], closed: boolean) => {
    E.push(
      '0',
      'POLYLINE',
      '8',
      ly,
      '66',
      '1',
      '70',
      closed ? '1' : '0',
      '10',
      '0',
      '20',
      '0',
      '30',
      '0',
    );
    pts.forEach((p) => E.push('0', 'VERTEX', '8', ly, '10', n(p[0]), '20', n(p[1]), '30', '0'));
    E.push('0', 'SEQEND', '8', ly);
  };

  const TH = 0.12;
  const TX = (
    ly: string,
    p: Point2D,
    s: string,
    o: { h?: number; ha?: number; va?: number; rot?: number } = {},
  ) => {
    const h = o.h || TH;
    const ha = o.ha == null ? 1 : o.ha;
    const va = o.va == null ? 0 : o.va;
    const e = enc(s);
    E.push(
      '0',
      'TEXT',
      '8',
      ly,
      '7',
      e.st,
      '10',
      n(p[0]),
      '20',
      n(p[1]),
      '30',
      '0',
      '40',
      n(h),
      '1',
      e.t,
      '50',
      String(o.rot || 0),
      '72',
      String(ha),
      '11',
      n(p[0]),
      '21',
      n(p[1]),
      '31',
      '0',
      '73',
      String(va),
    );
  };

  const tk = 0.035;
  const KT = 'TC-KICHTHUOC';

  const dimH = (
    x1: number,
    x2: number,
    y: number,
    yr1: number | null,
    yr2: number | null,
    txt: string,
  ) => {
    if (Math.abs(x2 - x1) < 1e-4) return;
    L(KT, [x1 - 0.05, y], [x2 + 0.05, y]);
    [x1, x2].forEach((x) => L(KT, [x - tk, y - tk], [x + tk, y + tk]));
    if (yr1 != null) L(KT, [x1, yr1 + (y > yr1 ? 0.03 : -0.03)], [x1, y + (y > yr1 ? 0.05 : -0.05)]);
    if (yr2 != null) L(KT, [x2, yr2 + (y > yr2 ? 0.03 : -0.03)], [x2, y + (y > yr2 ? 0.05 : -0.05)]);
    TX(KT, [(x1 + x2) / 2, y + 0.04], txt, { ha: 1, va: 1 });
  };

  const dimV = (
    y1: number,
    y2: number,
    x: number,
    xr1: number | null,
    xr2: number | null,
    txt: string,
  ) => {
    if (Math.abs(y2 - y1) < 1e-4) return;
    L(KT, [x, y1 - 0.05], [x, y2 + 0.05]);
    [y1, y2].forEach((y) => L(KT, [x - tk, y - tk], [x + tk, y + tk]));
    if (xr1 != null) L(KT, [xr1 + (x > xr1 ? 0.03 : -0.03), y1], [x + (x > xr1 ? 0.05 : -0.05), y1]);
    if (xr2 != null) L(KT, [xr2 + (x > xr2 ? 0.03 : -0.03), y2], [x + (x > xr2 ? 0.05 : -0.05), y2]);
    TX(KT, [x - 0.04, (y1 + y2) / 2], txt, { ha: 1, va: 1, rot: 90 });
  };

  let r86: Tc86LibraryInput | null = options?.r86 ?? null;
  if (!r86 && typeof document !== 'undefined') {
    try {
      const el = document.getElementById('tc_src86') as HTMLInputElement | null;
      r86 = JSON.parse((el && el.value) || 'null') as Tc86LibraryInput | null;
    } catch {
      r86 = null;
    }
  }
  if (
    r86 &&
    !(
      Math.abs(r86.H - I.H) < 1e-6 &&
      Math.abs(r86.C1 / 100 - I.a1) < 1e-6 &&
      Math.abs(r86.C2 / 100 - I.a2) < 1e-6 &&
      r86.mat === I.stemMat &&
      Math.abs(r86.t1 - I.t1) < 1e-6
    )
  ) {
    r86 = null;
  }

  let S: Tc86ShapeResult | null = null;
  let yT: number;
  let xTb: number;
  let yb0: number;
  const hfY = I.t1 + I.hf;
  let ttl = '';

  if (r86) {
    S = tc86Shape(r86);
    PL('TC-KETCAU', S.foot, true);
    PL('TC-KETCAU', S.stem, true);
    PL('TC-KETCAU', S.cap, true);
    yT = S.yt;
    xTb = S.xft + S.w - 0.15;
    yb0 = S.t1 - S.M;
  } else {
    PL('TC-KETCAU', g.foot, true);
    PL('TC-KETCAU', g.stem, true);
    if (g.cap) PL('TC-KETCAU', g.cap, true);
    yT = g.yT;
    xTb = g.xbt;
    yb0 = -g.dy;
  }

  const B = S ? S.A : g.B;
  const G: Point2D[] = [[xTb, yT]];
  if (I.Hs > 1e-9) G.push([xTb + I.m * I.Hs, yT + I.Hs]);
  const gT = G[G.length - 1][1];
  const xE = Math.max(B + 1.5, G[G.length - 1][0] + 2.0);
  const xfF = S
    ? S.x0 + S.Pf * Math.min(1, Math.max(0, (hfY - S.t1) / (S.H - 0.2)))
    : g.xf(hfY);

  PL(
    'TC-DAT',
    [
      [-1.2, hfY],
      [xfF, hfY],
    ],
    false,
  );
  PL('TC-DAT', [...G, [xE, gT]], false);
  PL(
    'TC-DAT',
    [
      [-1.2, -0.02],
      [0, -0.02],
    ],
    false,
  );
  PL(
    'TC-DAT',
    [
      [B, yb0 - 0.02],
      [xE, yb0 - 0.02],
    ],
    false,
  );

  if (I.LL) {
    const xl = xTb + (I.Hs > 1e-9 ? I.m * I.Hs : 0) + (I.dT0 != null ? I.dT0 : I.dT);
    if (xl < xE) {
      L('TC-CHU', [xl, gT], [xl, gT + 0.3]);
      TX('TC-CHU', [xl + 0.05, gT + 0.2], 'Mép làn xe', { ha: 0, h: TH * 0.8 });
    }
  }

  const yb = yb0 - 0.45;
  if (S && r86) {
    const x0 = S.x0;
    const xb = x0 + S.B;
    dimH(0, x0, yb, 0, S.t1, fmt(S.C1));
    if (S.Pf > 1e-6) {
      dimH(x0, x0 + S.Pf, yb, S.t1, S.t1, fmt(S.Pf));
      dimH(x0 + S.Pf, xb, yb, S.t1, S.t1, fmt(S.B - S.Pf));
    } else {
      dimH(x0, xb, yb, S.t1, S.t1, fmt(S.B));
    }
    dimH(xb, S.A, yb, S.t1, yb0, fmt(S.C2));
    dimH(0, S.A, yb - 0.3, null, null, fmt(S.A));
    if (S.Pf > 1e-6) dimH(x0, xb, yb - 0.6, null, null, fmt(S.B));
    dimH(S.xft, S.xft + S.w, S.yt + 0.3, S.yt, S.yt - 0.35, fmt(S.w));
    dimV(0, S.t1, -0.45, 0, 0, fmt(S.t1));
    dimV(S.t1, S.yt, -0.45, x0, S.xft - 0.05, fmt(S.H));
    if (I.hf > 1e-6) dimV(0, hfY, -0.8, 0, -1.2, fmt(hfY));
    dimV(yb0, S.t1, S.A + 0.35, S.A, S.A, fmt(S.M));
    dimV(S.yt - 0.2, S.yt, S.xft - 0.3, S.xft - 0.05, S.xft - 0.05, fmt(0.2));
    if (S.Pf > 1e-6) TX('TC-CHU', [(x0 + S.xft) / 2 - 0.12, (S.t1 + S.yt) / 2], '5:1', { ha: 2 });
    ttl = `Theo định hình 86-06X${r86.Rk === '3' ? ', nền R ≥ 3 kg/cm2' : ', nền R = 2 kg/cm2'}${r86.H1 ? ', H1 = ' + r86.H1 + ' m' : ''}`;
  } else {
    dimH(0, g.xfb, yb, 0, I.t1, fmt(I.a1));
    dimH(g.xfb, g.xbb, yb, I.t1, I.t1, fmt(g.xbb - g.xfb));
    dimH(g.xbb, g.B, yb, I.t1, -g.dy, fmt(I.a2));
    dimH(0, g.B, yb - 0.3, null, null, fmt(g.B));
    dimH(g.xft, g.xbt, g.yT + 0.3, g.yT, g.yT, fmt(I.b0));
    dimV(0, I.t1, -0.45, 0, 0, fmt(I.t1));
    dimV(I.t1, g.yT, -0.45, g.xfb, g.xft, fmt(I.H));
    if (I.hf > 1e-6) dimV(0, hfY, -0.8, 0, -1.2, fmt(hfY));
    dimV(-g.dy, I.t1, g.B + 0.35, g.B, g.B, fmt(I.t2));
    const ym = I.t1 + I.H * 0.6;
    if (I.n1 > 1e-6) TX('TC-CHU', [g.xf(ym) - 0.08, ym], `1:${tf(I.n1, 3)}`, { ha: 2 });
    if (Math.abs(I.n2) > 1e-6) TX('TC-CHU', [g.xb(ym) + 0.08, ym], `1:${tf(I.n2, 3)}`, { ha: 0 });
  }

  if (I.Hs > 1e-9) {
    dimV(yT, gT, xE + 0.3, xTb, xE, fmt(I.Hs));
    const p: Point2D = [(G[0][0] + G[1][0]) / 2, (G[0][1] + G[1][1]) / 2];
    TX('TC-CHU', [p[0] - 0.15, p[1] + 0.1], `1:${tf(I.m, 2)}`, { ha: 2 });
  }

  const mat = I.stemMat === 'm' ? 'Đá hộc xây vữa XM M100' : 'Bê tông M150';
  const Hm = S ? S.H : I.H;
  const xm = S
    ? ((S.x0 + S.B + S.xft + S.w) / 2) * 0.5 + S.x0 * 0.5
    : (g.xf(I.t1 + I.H * 0.4) + g.xb(I.t1 + I.H * 0.4)) / 2;

  TX(
    'TC-CHU',
    [
      S ? (S.x0 + S.Pf * 0.3 + S.x0 + S.B - (S.B - S.Pf - S.w) * 0.3) / 2 : xm,
      (S ? S.t1 : I.t1) + Hm * 0.3,
    ],
    mat,
    { ha: 1, va: 2, h: TH * 0.75 },
  );

  let fmvua = options?.fmvua;
  if (fmvua == null && typeof document !== 'undefined') {
    const fEl = document.getElementById('tc_fmvua') as HTMLInputElement | null;
    fmvua = fEl ? parseFloat(fEl.value) : 10;
  }
  const mvVal = Math.round((Number.isFinite(fmvua) ? (fmvua as number) : 10) * 10);

  TX(
    'TC-CHU',
    [B / 2, S ? S.t1 * 0.55 : I.t1 * 0.5 - g.dy * 0.25],
    I.footMat === 'm' ? 'Móng đá hộc xây vữa XM M' + mvVal : 'Móng bê tông M150',
    { ha: 1, va: 2, h: TH * 0.9 },
  );

  if (S) TX('TC-CHU', [S.xft + S.w * 0.4, S.yt - 0.1], 'BT M150', { ha: 1, va: 2, h: TH * 0.6 });
  TX('TC-CHU', [xE - 0.1, (gT + I.t1) / 2], 'Đất đắp', { ha: 2 });
  TX('TC-CHU', [-1.1, hfY + 0.1], 'Đất nền', { ha: 0, h: TH * 0.9 });
  TX('TC-CHU', [B / 2, yb - 0.95], `MẶT CẮT NGANG TƯỜNG CHẮN H = ${tf(I.H, 2)} M`, {
    ha: 1,
    h: TH * 1.6,
  });
  TX('TC-CHU', [B / 2, yb - 1.2], `Kích thước ghi bằng ${unit}${ttl ? ' - ' + ttl : ''}`, {
    ha: 1,
    h: TH * 0.9,
  });

  const out: string[] = [];
  const xs: [number, number] = [-1.3, xE + 0.6];
  const ys: [number, number] = [yb - 1.3, gT + 0.6];
  const lay: Array<[string, number]> = [
    ['TC-KETCAU', 7],
    ['TC-DAT', 3],
    ['TC-KICHTHUOC', 4],
    ['TC-CHU', 2],
  ];
  const sty: Array<[string, string]> = [
    ['TC_ARIAL', 'arial.ttf'],
    ['TC_VN', 'vnarial.ttf'],
    ['TC_VNH', 'vnarialh.ttf'],
  ];

  out.push(
    '0',
    'SECTION',
    '2',
    'HEADER',
    '9',
    '$ACADVER',
    '1',
    'AC1009',
    '9',
    '$DWGCODEPAGE',
    '3',
    'ANSI_1252',
    '9',
    '$INSBASE',
    '10',
    '0',
    '20',
    '0',
    '30',
    '0',
    '9',
    '$EXTMIN',
    '10',
    n(xs[0]),
    '20',
    n(ys[0]),
    '30',
    '0',
    '9',
    '$EXTMAX',
    '10',
    n(xs[1]),
    '20',
    n(ys[1]),
    '30',
    '0',
    '0',
    'ENDSEC',
  );
  out.push(
    '0',
    'SECTION',
    '2',
    'TABLES',
    '0',
    'TABLE',
    '2',
    'LTYPE',
    '70',
    '1',
    '0',
    'LTYPE',
    '2',
    'CONTINUOUS',
    '70',
    '0',
    '3',
    'Solid line',
    '72',
    '65',
    '73',
    '0',
    '40',
    '0.0',
    '0',
    'ENDTAB',
  );
  out.push('0', 'TABLE', '2', 'LAYER', '70', String(lay.length));
  lay.forEach(([nm, c]) =>
    out.push('0', 'LAYER', '2', nm, '70', '0', '62', String(c), '6', 'CONTINUOUS'),
  );
  out.push('0', 'ENDTAB');
  out.push('0', 'TABLE', '2', 'STYLE', '70', String(sty.length));
  sty.forEach(([nm, f]) =>
    out.push(
      '0',
      'STYLE',
      '2',
      nm,
      '70',
      '0',
      '40',
      '0',
      '41',
      '1',
      '50',
      '0',
      '71',
      '0',
      '42',
      n(TH),
      '3',
      f,
      '4',
      '',
    ),
  );
  out.push('0', 'ENDTAB', '0', 'ENDSEC');
  out.push('0', 'SECTION', '2', 'ENTITIES', ...E, '0', 'ENDSEC', '0', 'EOF');

  const txt = out.join('\r\n') + '\r\n';
  const b = new Uint8Array(txt.length);
  for (let i = 0; i < txt.length; i++) {
    const c = txt.charCodeAt(i);
    b[i] = c < 256 ? c : 63;
  }
  return b;
}

// ---------------------------------------------------------------------------
// 2. Module 16: DEM Watershed R12 DXF (`hvdDxf`, `hdDxfFig`), PLCMD & CRC-32 ZIP
// ---------------------------------------------------------------------------

const nf = (v: number): string => (Math.abs(v) < 1000 ? v.toFixed(7) : v.toFixed(3));

export interface HvdContourLine {
  z?: number;
  pts: Point2D[];
  closed?: boolean;
}

export interface HvdWatershedDxfInput
  extends Pick<DemWatershedResult, 'bnd' | 'mainP' | 'Fkm' | 'L'> {
  outVN?: Point2D;
  sl?: number;
  brP?: Point2D[][];
  brO?: Point2D[][];
  ten?: string;
  prof?: Array<[number, number]>;
  contours?: HvdContourLine[];
}

export function hvdDxf(r: HvdWatershedDxfInput): string {
  const L: string[] = [];
  const P = (ly: string, pts: readonly Point2D[], cl: boolean, col: number) => {
    if (pts.length < 2) return;
    L.push(
      '0',
      'POLYLINE',
      '8',
      ly,
      '62',
      String(col),
      '66',
      '1',
      '70',
      cl ? '1' : '0',
      '10',
      '0',
      '20',
      '0',
      '30',
      '0',
    );
    pts.forEach((p) => L.push('0', 'VERTEX', '8', ly, '10', nf(p[0]), '20', nf(p[1]), '30', '0'));
    L.push('0', 'SEQEND', '8', ly);
  };

  const hasContours = !!(r.contours && r.contours.length);
  const lay: Array<[string, number]> = [
    ['LUU_VUC', 6],
    ['SUOI_CHINH', 1],
    ['SUOI_NHANH', 5],
    ['SUOI_KHAC', 4],
    ['CUA_RA', 1],
    ['GHI_CHU', 1],
    ...(hasContours ? ([['DONG_MUC', 8]] as Array<[string, number]>) : []),
  ];

  const H: string[] = [
    '0',
    'SECTION',
    '2',
    'HEADER',
    '9',
    '$ACADVER',
    '1',
    'AC1009',
    '0',
    'ENDSEC',
    '0',
    'SECTION',
    '2',
    'TABLES',
    '0',
    'TABLE',
    '2',
    'LAYER',
    '70',
    String(lay.length),
  ];
  lay.forEach(([n, c]) =>
    H.push('0', 'LAYER', '2', n, '70', '0', '62', String(c), '6', 'CONTINUOUS'),
  );
  H.push('0', 'ENDTAB', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES');

  const bndPts =
    r.bnd.length > 2 &&
    r.bnd[0][0] === r.bnd[r.bnd.length - 1][0] &&
    r.bnd[0][1] === r.bnd[r.bnd.length - 1][1]
      ? r.bnd.slice(0, -1)
      : r.bnd;
  P('LUU_VUC', bndPts, true, 6);
  P('SUOI_CHINH', r.mainP, false, 1);
  (r.brP ?? []).forEach((p) => P('SUOI_NHANH', p, false, 5));
  (r.brO ?? []).forEach((p) => P('SUOI_KHAC', p, false, 4));
  if (r.contours) {
    r.contours.forEach((ct) => P('DONG_MUC', ct.pts, !!ct.closed, 8));
  }

  const o: Point2D = r.outVN ?? r.mainP[0] ?? r.bnd[0] ?? [0, 0];
  L.push(
    '0',
    'CIRCLE',
    '8',
    'CUA_RA',
    '10',
    nf(o[0]),
    '20',
    nf(o[1]),
    '30',
    '0',
    '40',
    Math.abs(o[0]) < 1000 ? '0.0001' : '10',
  );

  if (Math.abs(o[0]) >= 1000 && r.bnd.length) {
    const bx = r.bnd.map((p) => p[0]);
    const by = r.bnd.map((p) => p[1]);
    const x0 = Math.min(...bx);
    const x1 = Math.max(...bx);
    const y1 = Math.max(...by);
    const y0 = Math.min(...by);
    const th = Math.max(15, Math.round(Math.max(x1 - x0, y1 - y0) / 60));
    const cx = bx.reduce((a, b) => a + b, 0) / bx.length;
    const cy = by.reduce((a, b) => a + b, 0) / by.length;
    const T = (x: number, y: number, t: string, c: number) =>
      L.push(
        '0',
        'TEXT',
        '8',
        'GHI_CHU',
        '62',
        String(c || 1),
        '10',
        nf(x),
        '20',
        nf(y),
        '30',
        '0',
        '40',
        String(th),
        '1',
        t,
      );
    T(o[0] + th, o[1] + th, r.ten || 'VI TRI CONG TRINH', 1);
    T(cx - th * 6, cy, 'F = ' + r.Fkm.toFixed(2) + ' km2', 6);
    T(x1 + th * 3, y1, 'Chieu dai suoi chinh L = ' + r.L.toFixed(2) + ' km', 1);
    T(x1 + th * 3, y1 - th * 2, 'Tong chieu dai suoi nhanh = ' + (r.sl ?? 0).toFixed(2) + ' km', 5);
  }

  return [...H, ...L, '0', 'ENDSEC', '0', 'EOF'].join('\r\n');
}

export function hvdPlcmd(pts: readonly Point2D[], close = false): string {
  return (
    '_.PLINE\n' +
    pts.map((p) => '_non ' + nf(p[0]) + ',' + nf(p[1])).join('\n') +
    '\n' +
    (close ? '_C\n' : '\n')
  );
}

export interface HvdLegendLine {
  0: string; // text
  1?: string; // text color
  2?: string; // swatch line color
}

export interface HvdLegendBoxLayout {
  b: { x: number; y: number; bw: number; bh: number };
  L: Array<[string, string?, string?]>;
  sw: number;
}

export interface HvdFigureLayout {
  c0: number;
  r0: number;
  sx: number;
  sy: number;
  G: { w: number; n: number; rx: number; ry: number };
  o: { ll?: boolean; lon0: number };
  boxes: HvdLegendBoxLayout[];
  leads: Array<[number, number, number, number]>;
  dot: Point2D;
  out: Point2D;
  north: Point2D;
  r2?: { bnd: Point2D[]; mainP: Point2D[]; Fkm?: number; L?: number; src?: string } | null;
}

export function hdDxfFig(
  r: HvdWatershedDxfInput,
  lay?: HvdFigureLayout | null,
  toVN?: (lon0: number, lon: number, lat: number) => Point2D,
): string {
  if (!lay) return hvdDxf(r);
  const { c0, r0, sx, sy, G, o } = lay;
  const pv = (x: number, y: number): Point2D => {
    const c = c0 + x / sx;
    const rr = r0 + y / sy;
    const lo = G.w + c * G.rx;
    const la = G.n - rr * G.ry;
    if (o.ll || !toVN) return [lo, la];
    return toVN(o.lon0, lo, la);
  };

  const a0 = pv(0, 0);
  const a1 = pv(0, 10);
  const mpp = Math.hypot(a1[0] - a0[0], a1[1] - a0[1]) / 10;

  const aciMap: Record<string, number> = {
    '#e00000': 1,
    '#ff0000': 1,
    '#0020d0': 5,
    '#0028ff': 5,
    '#a000a0': 6,
    '#e000e0': 6,
    '#c06000': 30,
    '#ff9900': 30,
  };
  const aci = (c?: string): number => (c && aciMap[c]) || 7;
  const uni = (t: string): string =>
    [...t]
      .map((ch) => {
        const k = ch.codePointAt(0) ?? 63;
        return k < 128 ? ch : '\\U+' + k.toString(16).toUpperCase().padStart(4, '0');
      })
      .join('');

  const L: string[] = [];
  const PL = (ly: string, pts: readonly Point2D[], cl: boolean, col: number, w?: number, lt?: string) => {
    if (pts.length < 2) return;
    L.push(
      '0',
      'POLYLINE',
      '8',
      ly,
      '62',
      String(col),
      ...(lt ? ['6', lt] : []),
      '66',
      '1',
      '70',
      cl ? '1' : '0',
      '10',
      '0',
      '20',
      '0',
      '30',
      '0',
      ...(w ? ['40', nf(w), '41', nf(w)] : []),
    );
    pts.forEach((p) => L.push('0', 'VERTEX', '8', ly, '10', nf(p[0]), '20', nf(p[1]), '30', '0'));
    L.push('0', 'SEQEND', '8', ly);
  };

  const SO = (ly: string, col: number, P: [Point2D, Point2D, Point2D, Point2D]) => {
    L.push('0', 'SOLID', '8', ly, '62', String(col));
    (
      [
        [10, 20],
        [11, 21],
        [12, 22],
        [13, 23],
      ] as const
    ).forEach((k, i) =>
      L.push(String(k[0]), nf(P[i][0]), String(k[1]), nf(P[i][1]), '3' + String(k[0])[1], '0'),
    );
  };

  const TX = (ly: string, col: number, x: number, y: number, h: number, t: string, al?: number) => {
    const p = pv(x, y);
    L.push(
      '0',
      'TEXT',
      '8',
      ly,
      '62',
      String(col),
      '10',
      nf(p[0]),
      '20',
      nf(p[1]),
      '30',
      '0',
      '40',
      nf(h),
      '1',
      uni(t),
      '7',
      'ARIAL',
      '72',
      String(al || 0),
      '73',
      '2',
      '11',
      nf(p[0]),
      '21',
      nf(p[1]),
      '31',
      '0',
    );
  };

  const DOT = (ly: string, col: number, p: Point2D, rad: number) => {
    L.push(
      '0',
      'POLYLINE',
      '8',
      ly,
      '62',
      String(col),
      '66',
      '1',
      '70',
      '1',
      '40',
      nf(rad),
      '41',
      nf(rad),
      '10',
      '0',
      '20',
      '0',
      '30',
      '0',
    );
    L.push(
      '0',
      'VERTEX',
      '8',
      ly,
      '10',
      nf(p[0] - rad / 2),
      '20',
      nf(p[1]),
      '30',
      '0',
      '42',
      '1',
      '0',
      'VERTEX',
      '8',
      ly,
      '10',
      nf(p[0] + rad / 2),
      '20',
      nf(p[1]),
      '30',
      '0',
      '42',
      '1',
      '0',
      'SEQEND',
      '8',
      ly,
    );
  };

  const bnd =
    r.bnd.length > 2 &&
    r.bnd[0][0] === r.bnd[r.bnd.length - 1][0] &&
    r.bnd[0][1] === r.bnd[r.bnd.length - 1][1]
      ? r.bnd.slice(0, -1)
      : r.bnd;

  if (lay.r2) {
    PL('SO_SANH_DEM', lay.r2.bnd.slice(0, -1), true, 30, 1.6 * mpp, 'DASHED');
    PL('SO_SANH_DEM', lay.r2.mainP, false, 30, 1.4 * mpp, 'DASHED');
  }
  PL('LUU_VUC', bnd, true, 6, 2.5 * mpp);
  (r.brP ?? []).forEach((p) => PL('SUOI_NHANH', p, false, 5, 2 * mpp));
  PL('SUOI_CHINH', r.mainP, false, 1, 2.6 * mpp);
  if (r.contours) {
    r.contours.forEach((ct) => PL('DONG_MUC', ct.pts, !!ct.closed, 8));
  }

  DOT('GHI_CHU', 1, pv(lay.out[0], lay.out[1]), 12 * mpp);
  DOT('GHI_CHU', 6, pv(lay.dot[0], lay.dot[1]), 7 * mpp);
  lay.leads.forEach((l) => PL('GHI_CHU', [pv(l[0], l[1]), pv(l[2], l[3])], false, 5, 1.2 * mpp));

  const pd = 7;
  const lh = 20;
  const th = 10 * mpp;
  lay.boxes.forEach(({ b, L: lines, sw }) => {
    const P: [Point2D, Point2D, Point2D, Point2D] = [
      pv(b.x, b.y),
      pv(b.x + b.bw, b.y),
      pv(b.x + b.bw, b.y + b.bh),
      pv(b.x, b.y + b.bh),
    ];
    SO('GHI_CHU_NEN', 51, [P[0], P[1], P[3], P[2]]);
    PL('GHI_CHU', P, true, 5);
    lines.forEach((t, k) => {
      const yy = b.y + pd + k * lh + 11;
      if (t[2]) {
        PL(
          'GHI_CHU',
          [pv(b.x + pd, yy), pv(b.x + pd + sw - 10, yy)],
          false,
          aci(t[2]),
          3 * mpp,
          t[2] === '#ff9900' && lay.r2 ? 'DASHED' : undefined,
        );
      }
      TX('GHI_CHU', aci(t[1] || '#e00000'), b.x + pd + sw, yy, th, t[0], 0);
    });
  });

  const [nx0, ny0] = lay.north;
  const N1 = pv(nx0, ny0);
  const N2 = pv(nx0 - 7, ny0 + 22);
  const N3 = pv(nx0, ny0 + 17);
  const N4 = pv(nx0 + 7, ny0 + 22);
  SO('GHI_CHU', 7, [N1, N2, N3, N3]);
  PL('GHI_CHU', [N1, N4, N3], false, 7);
  TX('GHI_CHU', 7, nx0 - 4, ny0 + 36, th, 'B', 0);

  const layersTable: Array<[string, number]> = [
    ['LUU_VUC', 6],
    ['SUOI_CHINH', 1],
    ['SUOI_NHANH', 5],
    ['SO_SANH_DEM', 30],
    ['GHI_CHU', 1],
    ['GHI_CHU_NEN', 51],
    ...(r.contours && r.contours.length ? ([['DONG_MUC', 8]] as Array<[string, number]>) : []),
  ];
  const dl = 9 * mpp;
  const gp = 5 * mpp;
  const H: string[] = [
    '0',
    'SECTION',
    '2',
    'HEADER',
    '9',
    '$ACADVER',
    '1',
    'AC1009',
    '0',
    'ENDSEC',
    '0',
    'SECTION',
    '2',
    'TABLES',
    '0',
    'TABLE',
    '2',
    'LTYPE',
    '70',
    '2',
    '0',
    'LTYPE',
    '2',
    'CONTINUOUS',
    '70',
    '0',
    '3',
    'Solid line',
    '72',
    '65',
    '73',
    '0',
    '40',
    '0.0',
    '0',
    'LTYPE',
    '2',
    'DASHED',
    '70',
    '0',
    '3',
    '__ __ __',
    '72',
    '65',
    '73',
    '2',
    '40',
    nf(dl + gp),
    '49',
    nf(dl),
    '49',
    nf(-gp),
    '0',
    'ENDTAB',
    '0',
    'TABLE',
    '2',
    'STYLE',
    '70',
    '1',
    '0',
    'STYLE',
    '2',
    'ARIAL',
    '70',
    '0',
    '40',
    '0.0',
    '41',
    '1.0',
    '50',
    '0.0',
    '71',
    '0',
    '42',
    nf(th),
    '3',
    'arial.ttf',
    '4',
    '',
    '0',
    'ENDTAB',
    '0',
    'TABLE',
    '2',
    'LAYER',
    '70',
    String(layersTable.length),
  ];
  layersTable.forEach(([n, c]) =>
    H.push(
      '0',
      'LAYER',
      '2',
      n,
      '70',
      '0',
      '62',
      String(c),
      '6',
      n === 'SO_SANH_DEM' ? 'DASHED' : 'CONTINUOUS',
    ),
  );
  H.push('0', 'ENDTAB', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES');
  return [...H, ...L, '0', 'ENDSEC', '0', 'EOF'].join('\r\n');
}

export const hdDxf = hdDxfFig;

export function hdDxfPreviewSvg(
  r: HvdWatershedDxfInput,
  W = 540,
  H = 380,
): string {
  const pad = 28;
  const legW = 210;
  const drawW = W - legW - pad * 2;
  const drawH = H - pad * 2;
  const oVN: Point2D = r.outVN ?? r.mainP[0] ?? r.bnd[0] ?? [0, 0];
  const allPts: Point2D[] = [...r.bnd, ...r.mainP, ...(r.brP ?? []).flat(), oVN];
  if (!allPts.length) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"></svg>`;
  }
  const xs = allPts.map((p) => p[0]);
  const ys = allPts.map((p) => p[1]);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const sc = Math.min(drawW / (x1 - x0 || 1), drawH / (y1 - y0 || 1));
  const ox = pad + (drawW - (x1 - x0) * sc) / 2;
  const oy = pad + (drawH - (y1 - y0) * sc) / 2;
  const X = (x: number) => ox + (x - x0) * sc;
  const Y = (y: number) => H - oy - (y - y0) * sc;
  const toPts = (pts: readonly Point2D[]) =>
    pts.map((p) => X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ');

  let body = `<rect width="${W}" height="${H}" fill="#fff" stroke="#d0d4d8"/>`;
  if (r.contours) {
    r.contours.forEach((ct) => {
      if (ct.pts.length >= 2) {
        body += `<polyline points="${toPts(ct.pts)}" fill="none" stroke="#c8b090" stroke-width="0.7"/>`;
      }
    });
  }
  if (r.bnd.length >= 3) {
    body += `<polygon points="${toPts(r.bnd)}" fill="rgba(224,0,224,0.06)" stroke="#e000e0" stroke-width="2"/>`;
  }
  (r.brO ?? []).forEach((p) => {
    if (p.length >= 2) body += `<polyline points="${toPts(p)}" fill="none" stroke="#78b0e0" stroke-width="1"/>`;
  });
  (r.brP ?? []).forEach((p) => {
    if (p.length >= 2) body += `<polyline points="${toPts(p)}" fill="none" stroke="#0028ff" stroke-width="1.6"/>`;
  });
  if (r.mainP.length >= 2) {
    body += `<polyline points="${toPts(r.mainP)}" fill="none" stroke="#ff0000" stroke-width="2.2"/>`;
  }
  body += `<circle cx="${X(oVN[0]).toFixed(1)}" cy="${Y(oVN[1]).toFixed(1)}" r="4.5" fill="#ff0000" stroke="#800000" stroke-width="1.2"/>`;

  const lx = W - legW - 8;
  const ly = 14;
  body += `<rect x="${lx}" y="${ly}" width="${legW}" height="106" rx="4" fill="#ffff70" stroke="#1030c0" stroke-width="1.2"/>`;
  body += `<text x="${lx + 10}" y="${ly + 20}" font-family="Arial,sans-serif" font-size="11" font-weight="bold" fill="#a000a0">F = ${r.Fkm.toFixed(3)} km²</text>`;
  body += `<line x1="${lx + 10}" y1="${ly + 36}" x2="${lx + 34}" y2="${ly + 36}" stroke="#ff0000" stroke-width="2.5"/><text x="${lx + 40}" y="${ly + 40}" font-family="Arial,sans-serif" font-size="11" fill="#e00000">Suối chính L = ${r.L.toFixed(3)} km</text>`;
  body += `<line x1="${lx + 10}" y1="${ly + 56}" x2="${lx + 34}" y2="${ly + 56}" stroke="#0028ff" stroke-width="2"/><text x="${lx + 40}" y="${ly + 60}" font-family="Arial,sans-serif" font-size="11" fill="#0020d0">Suối nhánh Σl = ${(r.sl ?? 0).toFixed(3)} km</text>`;
  body += `<line x1="${lx + 10}" y1="${ly + 76}" x2="${lx + 34}" y2="${ly + 76}" stroke="#e000e0" stroke-width="2"/><text x="${lx + 40}" y="${ly + 80}" font-family="Arial,sans-serif" font-size="11" fill="#a000a0">Ranh giới lưu vực</text>`;
  if (r.prof && r.prof.length) {
    body += `<text x="${lx + 10}" y="${ly + 98}" font-family="Arial,sans-serif" font-size="10" fill="#333">Trắc dọc: ${r.prof.length} điểm</text>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`;
}

// ---------------------------------------------------------------------------
// 3. IEEE 802.3 CRC-32 Uncompressed Multi-File ZIP Archiver (`hdZip`)
// ---------------------------------------------------------------------------

export interface HdZipEntry {
  name: string;
  data: string | Uint8Array;
}

let _crc32Table: Uint32Array | null = null;

function getCrc32Table(): Uint32Array {
  if (_crc32Table) return _crc32Table;
  const tbl = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tbl[n] = c >>> 0;
  }
  _crc32Table = tbl;
  return tbl;
}

export function crc32Bytes(data: Uint8Array): number {
  const tbl = getCrc32Table();
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = tbl[(crc ^ data[i]) & 255] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function hdZipBytes(
  nameOrEntries: string | readonly HdZipEntry[],
  textOrData?: string | Uint8Array,
): Uint8Array {
  const enc = new TextEncoder();
  const entries: readonly HdZipEntry[] =
    typeof nameOrEntries === 'string'
      ? [{ name: nameOrEntries, data: textOrData ?? '' }]
      : nameOrEntries;

  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nm = enc.encode(entry.name);
    const d = typeof entry.data === 'string' ? enc.encode(entry.data) : entry.data;
    const crc = crc32Bytes(d);

    const lhBuf = new ArrayBuffer(30);
    const lh = new DataView(lhBuf);
    const lSpec: ReadonlyArray<readonly [number, number, 2 | 4]> = [
      [0, 0x04034b50, 4],
      [4, 20, 2],
      [6, 0x0800, 2],
      [8, 0, 2],
      [10, 0, 2],
      [12, 0x21, 2],
      [14, crc, 4],
      [18, d.length, 4],
      [22, d.length, 4],
      [26, nm.length, 2],
      [28, 0, 2],
    ];
    for (const [o, v, sz] of lSpec) {
      if (sz === 4) lh.setUint32(o, v, true);
      else lh.setUint16(o, v, true);
    }

    const chBuf = new ArrayBuffer(46);
    const ch = new DataView(chBuf);
    const cSpec: ReadonlyArray<readonly [number, number, 2 | 4]> = [
      [0, 0x02014b50, 4],
      [4, 20, 2],
      [6, 20, 2],
      [8, 0x0800, 2],
      [10, 0, 2],
      [12, 0, 2],
      [14, 0x21, 2],
      [16, crc, 4],
      [20, d.length, 4],
      [24, d.length, 4],
      [28, nm.length, 2],
      [30, 0, 2],
      [32, 0, 2],
      [34, 0, 2],
      [36, 0, 2],
      [38, 0, 4],
      [42, offset, 4],
    ];
    for (const [o, v, sz] of cSpec) {
      if (sz === 4) ch.setUint32(o, v, true);
      else ch.setUint16(o, v, true);
    }

    localParts.push(new Uint8Array(lhBuf), nm, d);
    centralParts.push(new Uint8Array(chBuf), nm);
    offset += 30 + nm.length + d.length;
  }

  const centralSize = centralParts.reduce((s, p) => s + p.length, 0);
  const edBuf = new ArrayBuffer(22);
  const ed = new DataView(edBuf);
  const eSpec: ReadonlyArray<readonly [number, number, 2 | 4]> = [
    [0, 0x06054b50, 4],
    [4, 0, 2],
    [6, 0, 2],
    [8, entries.length, 2],
    [10, entries.length, 2],
    [12, centralSize, 4],
    [16, offset, 4],
    [20, 0, 2],
  ];
  for (const [o, v, sz] of eSpec) {
    if (sz === 4) ed.setUint32(o, v, true);
    else ed.setUint16(o, v, true);
  }

  const allParts = [...localParts, ...centralParts, new Uint8Array(edBuf)];
  const totalLen = allParts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(totalLen);
  let pos = 0;
  for (const part of allParts) {
    out.set(part, pos);
    pos += part.length;
  }
  return out;
}

export function hdZip(
  nameOrEntries: string | readonly HdZipEntry[],
  textOrData?: string | Uint8Array,
): Blob {
  const bytes = hdZipBytes(nameOrEntries, textOrData);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy], { type: 'application/zip' });
}
