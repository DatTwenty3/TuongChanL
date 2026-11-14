/**
 * Shared SVG Drawing Primitives & Collision-Avoiding Label Placement
 *
 * Clean-room TypeScript port of the shared SVG helpers from modules:
 * - `03` (`svgKit`)
 * - `04` (`DGSTY`, `dgDefs`, `dgKit`, `vSvg`, `dgPut`, `xEdges`, `dgChart`)
 * - `06` (`TCF` plotter `createTcfPlotter` & collision-avoiding label placer `placeTcfLabels`)
 * - `07` (`qdSvg`, `qT`, `qL`, `qDH`, `qDV`, `qDVh`, `qAr`, `qHat`, `qPin`, `qRol`, `qSlab`, `qCorbel`, `qGround`)
 * - `08` (`mdSvgBox`, `mdP`)
 * - `11` (`cf`, `okc`, `svgT`, `svgL`, `svgP`, `svgPl`, `arrowH`, `arrowV`, `dimH`, `dimV`)
 * - `14` (`sfHatch`, `sfArrow`, `sfKit`)
 * - `15` (`hvFrame`, `hvHatch`, `hvGround`, `hvWater`, `hvDimV`)
 */

import type { Point2D } from '../types/project.ts';

const fx = (x: number, d = 1): string => (x == null || !Number.isFinite(x) ? '' : x.toFixed(d));

function resolveSvgElement(target: SVGElement | string | null | undefined): SVGElement | null {
  if (!target) return null;
  if (typeof target !== 'string') return target;
  if (typeof document === 'undefined') return null;
  const el = document.getElementById(target);
  return el instanceof SVGElement || (el && typeof el.setAttribute === 'function')
    ? (el as unknown as SVGElement)
    : null;
}

// ---------------------------------------------------------------------------
// 1. Module 03: Abutment Hatch & Arrowhead Defs (`svgKit`)
// ---------------------------------------------------------------------------

export function svgKit(id: string): { head: string } {
  return {
    head:
      `<defs><marker id="ar${id}" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 2 L10 5 L0 8 z" fill="#333"/></marker>` +
      `<pattern id="hc${id}" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" stroke="#9db3c8" stroke-width="0.8"/></pattern></defs>`,
  };
}

// ---------------------------------------------------------------------------
// 2. Module 04: Girder / Shared CAD Diagram Kit (`DGSTY`, `dgDefs`, `dgKit`, `dgChart`)
// ---------------------------------------------------------------------------

export const DGSTY =
  '<style>text{font-family:Arial,sans-serif;font-size:12px;fill:#000}.s{font-size:10px}.l{stroke:#000;fill:none;stroke-width:1.3}.t{stroke:#000;fill:none;stroke-width:0.8}.d{stroke:#000;fill:none;stroke-width:1;stroke-dasharray:6,4}.c{stroke:#555;fill:none;stroke-width:0.8;stroke-dasharray:10,3,2,3}.g{stroke:#bbb;fill:none;stroke-width:0.6;stroke-dasharray:3,3}</style>';

export function dgDefs(id: string): string {
  return (
    `<defs><marker id="a${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 1 L10 5 L0 9 z" fill="#000"/></marker>` +
    `<pattern id="hC${id}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="#c00000" stroke-width="0.8"/></pattern>` +
    `<pattern id="hD${id}" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><line x1="0" y1="0" x2="0" y2="7" stroke="#d4b100" stroke-width="0.8"/></pattern>` +
    `<pattern id="hP${id}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="#c000c0" stroke-width="0.8"/></pattern></defs>`
  );
}

export interface DgKitInstance {
  id: string;
  s: string;
  L: (x1: number, y1: number, x2: number, y2: number, cls?: string) => string;
  T: (x: number, y: number, t: string, anchor?: string, extraAttr?: string) => string;
  A: (x1: number, y1: number, x2: number, y2: number) => string;
  dimH: (xa: number, xb: number, y: number, t: string, ext?: number | null) => void;
  dimV: (x: number, ya: number, yb: number, t: string, side?: number) => void;
  poly: (pts: readonly Point2D[], fill?: string | null, cls?: string) => string;
}

export function dgKit(id: string): DgKitInstance {
  const o: DgKitInstance = {
    id,
    s: '',
    L(x1, y1, x2, y2, c = 't') {
      o.s += `<line class="${c}" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
      return o.s;
    },
    T(x, y, t, a = 'middle', ex = '') {
      o.s += `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${a}" ${ex}>${t}</text>`;
      return o.s;
    },
    A(x1, y1, x2, y2) {
      o.s += `<line class="t" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" marker-end="url(#a${id})"/>`;
      return o.s;
    },
    dimH(xa, xb, y, t, ext) {
      if (Math.abs(xb - xa) < 0.5) return;
      o.s += `<line class="t" x1="${xa.toFixed(1)}" y1="${y}" x2="${xb.toFixed(1)}" y2="${y}" marker-start="url(#a${id})" marker-end="url(#a${id})"/>`;
      if (ext != null) {
        o.L(xa, ext, xa, y + 4);
        o.L(xb, ext, xb, y + 4);
      }
      const w = Math.abs(xb - xa);
      o.T((xa + xb) / 2, y - 4, t, 'middle', w < t.length * 6.2 ? 'class="s"' : '');
    },
    dimV(x, ya, yb, t, side = 1) {
      if (Math.abs(yb - ya) < 0.5) return;
      o.s += `<line class="t" x1="${x}" y1="${ya.toFixed(1)}" x2="${x}" y2="${yb.toFixed(1)}" marker-start="url(#a${id})" marker-end="url(#a${id})"/>`;
      o.L(x - 6, ya, x + 6, ya);
      o.L(x - 6, yb, x + 6, yb);
      o.T(x + side * 8, (ya + yb) / 2 + 4, t, side > 0 ? 'start' : 'end');
    },
    poly(P, fill, cls = 'l') {
      o.s += `<polygon class="${cls}" points="${P.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')}" ${fill ? `style="fill:${fill}"` : ''}/>`;
      return o.s;
    },
  };
  return o;
}

export function vSvg(
  v: readonly number[],
  X: (val: number) => number,
  Y: (val: number) => number,
  k: number,
): string {
  if (v.length >= 5) {
    const b = v[2] * k;
    const h = v[3] * k;
    const r = (v[4] || 0) * k;
    return `<rect class="l" x="${(X(v[0]) - b / 2).toFixed(1)}" y="${(Y(v[1]) - h / 2).toFixed(1)}" width="${b.toFixed(1)}" height="${h.toFixed(1)}" rx="${r.toFixed(1)}" style="fill:#fff"/>`;
  }
  return `<circle class="l" cx="${X(v[0]).toFixed(1)}" cy="${Y(v[1]).toFixed(1)}" r="${((v[2] / 2) * k).toFixed(1)}" style="fill:#fff"/>`;
}

export function dgPut(
  target: SVGElement | string | null | undefined,
  W: number,
  H: number,
  body: string,
  id: string,
): string {
  const hr = Math.round(H);
  const inner = DGSTY + dgDefs(id) + `<rect width="${W}" height="${hr}" fill="#fff"/>` + body;
  const sv = resolveSvgElement(target);
  if (sv) {
    sv.setAttribute('width', String(W));
    sv.setAttribute('height', String(hr));
    sv.setAttribute('viewBox', `0 0 ${W} ${hr}`);
    sv.innerHTML = inner;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${hr}" viewBox="0 0 ${W} ${hr}">${inner}</svg>`;
}

export function xEdges(P: readonly Point2D[], y: number): number[] {
  const xs: number[] = [];
  for (let i = 0; i < P.length; i++) {
    const [x1, y1] = P[i];
    const [x2, y2] = P[(i + 1) % P.length];
    if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
      xs.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
    }
  }
  return xs.sort((a, b) => a - b);
}

export interface DgChartSeries {
  n: string;
  c: string;
  da?: string;
  w?: number;
  pts: Point2D[];
}

export interface DgChartHLine {
  n: string;
  y: number;
  c?: string;
  da?: string;
}

export interface DgChartOptions {
  Ls: number;
  series: DgChartSeries[];
  hl?: DgChartHLine[];
  yl: string;
  xl: string;
  title: string;
  note?: string;
}

export function dgChart(
  target: SVGElement | string | null | undefined,
  id: string,
  o: DgChartOptions,
): string {
  const W = 700;
  const Hc = 230;
  const m = { l: 70, r: 24, t: 40, b: 58 };
  const d = dgKit(id);
  const Ls = o.Ls;

  const full = (pts: readonly Point2D[]): Point2D[] => {
    const a = pts.slice().sort((p, q) => p[0] - q[0]);
    const b: Point2D[] = a
      .filter((p) => p[0] < Ls / 2 - 1e-6)
      .map((p) => [Ls - p[0], p[1]] as Point2D)
      .reverse();
    return a.concat(b);
  };

  const S: DgChartSeries[] = o.series.map((s) => ({ ...s, pts: full(s.pts) }));
  const ys = S.flatMap((s) => s.pts.map((p) => p[1]))
    .concat((o.hl || []).map((h) => h.y))
    .concat([0]);
  let ya = Math.min(...ys);
  let yb = Math.max(...ys);

  const nice = (v: number): number => {
    const p = 10 ** Math.floor(Math.log10(Math.abs(v) || 1));
    const r = v / p;
    return (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * p;
  };
  const st = nice((yb - ya) / 7 || 1);
  ya = Math.floor(ya / st - 1e-9) * st;
  yb = Math.ceil(yb / st + 1e-9) * st;
  if (yb - ya < st * 3) yb = ya + st * 3;

  const X = (x: number) => m.l + (x / (Ls || 1)) * (W - m.l - m.r);
  const Y = (y: number) => m.t + ((yb - y) / (yb - ya)) * Hc;

  d.s += `<rect x="${m.l}" y="${m.t}" width="${W - m.l - m.r}" height="${Hc}" style="fill:#c0c0c0;stroke:#808080;stroke-width:0.8"/>`;
  const dec = st < 1 ? 1 : 0;
  for (let y = ya; y <= yb + 1e-9; y += st) {
    d.L(m.l - 4, Y(y), m.l, Y(y));
    d.T(m.l - 7, Y(y) + 4, fx(y, dec), 'end', 'class="s"');
  }
  const sx = Ls > 30 ? 5 : 2;
  for (let x = 0; x <= Ls + 1e-9; x += sx) {
    d.L(X(x), Y(ya), X(x), Y(ya) + 4);
    d.T(X(x), Y(ya) + 15, fx(x, 1), 'middle', 'class="s"');
  }
  if (ya < 0 && yb > 0) d.L(m.l, Y(0), W - m.r, Y(0));
  d.L(m.l, m.t, m.l, m.t + Hc);
  d.L(m.l, m.t + Hc, W - m.r, m.t + Hc);

  const all: DgChartSeries[] = [
    ...(o.hl || []).map((h) => ({
      n: h.n,
      c: h.c || '#993300',
      da: h.da || '4,3',
      w: 1.6,
      pts: [
        [0, h.y] as Point2D,
        [Ls, h.y] as Point2D,
      ],
    })),
    ...S,
  ];
  all.forEach((s) => {
    d.s += `<polyline points="${s.pts.map((p) => X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ')}" fill="none" stroke="${s.c}" stroke-width="${s.w || 2}" ${s.da ? `stroke-dasharray="${s.da}"` : ''} stroke-linejoin="round"/>`;
  });

  d.T(
    m.l - 48,
    m.t + Hc / 2,
    o.yl,
    'middle',
    `font-weight="bold" class="s" transform="rotate(-90 ${m.l - 48} ${m.t + Hc / 2})"`,
  );
  d.T((m.l + W - m.r) / 2, Y(ya) + 30, o.xl, 'middle', 'font-weight="bold" class="s"');
  d.T((m.l + W - m.r) / 2, 24, o.title, 'middle', 'font-weight="bold"');

  const ly = m.t + Hc + 40;
  const n = Math.max(1, all.length);
  const lw = (W - 40) / n;
  d.s += `<rect class="t" x="20" y="${ly}" width="${W - 40}" height="22" style="fill:#fff"/>`;
  all.forEach((s, i) => {
    const x = 24 + i * lw;
    d.s += `<line x1="${x}" y1="${ly + 11}" x2="${x + 28}" y2="${ly + 11}" stroke="${s.c}" stroke-width="${s.w || 2}" ${s.da ? `stroke-dasharray="${s.da}"` : ''}/>`;
    d.T(x + 32, ly + 15, s.n, 'start', 'class="s"');
  });

  let Hp = ly + 30;
  if (o.note) {
    d.T(W / 2, Hp + 12, o.note, 'middle', 'font-style="italic" class="s"');
    Hp += 18;
  }
  d.s += `<rect x="1" y="1" width="${W - 2}" height="${Hp - 2}" style="fill:none;stroke:#000;stroke-width:1.5"/>`;
  return dgPut(target, W, Hp, d.s, id);
}

// ---------------------------------------------------------------------------
// 3. Module 11: Culvert `ch` / `ct` SVG Helpers
// ---------------------------------------------------------------------------

export const cf = (x: number | null | undefined, d = 2): string =>
  x == null || !Number.isFinite(x) ? '-' : x.toFixed(d);

export const okc = (b: boolean): string =>
  b ? '<td class="c ok">Đạt</td>' : '<td class="c bad">Không đạt</td>';

export interface SvgTextOpt {
  a?: string;
  s?: number;
  c?: string;
  w?: string | number;
  r?: number;
}

export const svgT = (x: number, y: number, t: string, o: SvgTextOpt = {}): string =>
  `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}"${o.a ? ` text-anchor="${o.a}"` : ''}${o.s ? ` font-size="${o.s}"` : ''}${o.c ? ` fill="${o.c}"` : ''}${o.w ? ` font-weight="${o.w}"` : ''}${o.r ? ` transform="rotate(${o.r} ${x.toFixed(1)} ${y.toFixed(1)})"` : ''}>${t}</text>`;

export const svgL = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  c = '#1d1d1f',
  w = 1,
  d = '',
): string =>
  `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${c}" stroke-width="${w}"${d ? ` stroke-dasharray="${d}"` : ''}/>`;

export const svgP = (pts: readonly Point2D[], f = 'none', c = '#1d1d1f', w = 1): string =>
  `<polygon points="${pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')}" fill="${f}" stroke="${c}" stroke-width="${w}"/>`;

export const svgPl = (pts: readonly Point2D[], c = '#1d1d1f', w = 1, d = ''): string =>
  `<polyline points="${pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')}" fill="none" stroke="${c}" stroke-width="${w}"${d ? ` stroke-dasharray="${d}"` : ''}/>`;

export const arrowH = (x: number, y: number, len: number, dir: number, c = '#1d1d1f'): string => {
  const x2 = x + dir * len;
  return (
    svgL(x, y, x2, y, c, 1) +
    svgP(
      [
        [x2, y],
        [x2 - dir * 6, y - 3],
        [x2 - dir * 6, y + 3],
      ],
      c,
      c,
      1,
    )
  );
};

export const arrowV = (x: number, y: number, len: number, c = '#1d1d1f'): string =>
  svgL(x, y - len, x, y, c, 1) +
  svgP(
    [
      [x, y],
      [x - 3, y - 6],
      [x + 3, y - 6],
    ],
    c,
    c,
    1,
  );

export const dimH = (x1: number, x2: number, y: number, t: string, c = '#1d1d1f'): string =>
  svgL(x1, y, x2, y, c, 0.8) +
  svgL(x1, y - 4, x1, y + 4, c, 0.8) +
  svgL(x2, y - 4, x2, y + 4, c, 0.8) +
  svgT((x1 + x2) / 2, y - 3, t, { a: 'middle', s: 11 });

export const dimV = (
  y1: number,
  y2: number,
  x: number,
  t: string,
  c = '#1d1d1f',
  side = -1,
): string =>
  svgL(x, y1, x, y2, c, 0.8) +
  svgL(x - 4, y1, x + 4, y1, c, 0.8) +
  svgL(x - 4, y2, x + 4, y2, c, 0.8) +
  svgT(x + side * 4, (y1 + y2) / 2 + 4, t, { a: side < 0 ? 'end' : 'start', s: 11 });

// ---------------------------------------------------------------------------
// 4. Module 07: Approach Slab (`qd`) SVG Primitives
// ---------------------------------------------------------------------------

export function qdSvg(
  target: SVGElement | string | null | undefined,
  W: number,
  H: number,
  body: string,
  defsId?: string,
): string {
  const id = defsId ?? (typeof target === 'string' ? target : 'qd');
  const inner =
    `<defs><marker id="${id}A" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,1.5 L10,5 L0,8.5 z" fill="#c00000"/></marker><marker id="${id}K" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,1.5 L10,5 L0,8.5 z" fill="#222"/></marker><pattern id="${id}H" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M0,7 L7,0" stroke="#8a8a8a" stroke-width="0.6"/></pattern><pattern id="${id}S" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="0.9" fill="#a08050"/><circle cx="9" cy="9" r="0.9" fill="#a08050"/></pattern></defs>` +
    body;
  const sv = resolveSvgElement(target);
  if (sv) {
    sv.setAttribute('viewBox', `0 0 ${W} ${H}`);
    sv.setAttribute('width', String(W));
    sv.setAttribute('height', String(H));
    sv.innerHTML = inner;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${inner}</svg>`;
}

export interface QdTextOpt {
  fs?: number;
  a?: string;
  c?: string;
  b?: boolean;
  i?: boolean;
  rot?: number;
}

export const qT = (x: number, y: number, t: string, o?: QdTextOpt): string => {
  const opt = o || {};
  return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${opt.fs || 12}"${opt.a ? ` text-anchor="${opt.a}"` : ''} fill="${opt.c || '#111'}"${opt.b ? ' font-weight="bold"' : ''}${opt.i ? ' font-style="italic"' : ''}${opt.rot ? ` transform="rotate(${opt.rot} ${x.toFixed(1)} ${y.toFixed(1)})"` : ''} style="paint-order:stroke" stroke="#fff" stroke-width="3" stroke-linejoin="round">${t}</text>`;
};

export const qL = (x1: number, y1: number, x2: number, y2: number, st?: string): string =>
  `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" ${st || 'stroke="#222" stroke-width="1"'}/>`;

export const qDH = (x1: number, x2: number, y: number, t: string): string =>
  qL(x1 - 4, y, x2 + 4, y, 'stroke="#333" stroke-width="0.7"') +
  [x1, x2]
    .map((x) => qL(x - 3.5, y + 3.5, x + 3.5, y - 3.5, 'stroke="#222" stroke-width="1.1"'))
    .join('') +
  qT((x1 + x2) / 2, y - 4, t, { a: 'middle', fs: 11 });

export const qDV = (y1: number, y2: number, x: number, t: string): string =>
  qL(x, y1 - 4, x, y2 + 4, 'stroke="#333" stroke-width="0.7"') +
  [y1, y2]
    .map((y) => qL(x - 3.5, y + 3.5, x + 3.5, y - 3.5, 'stroke="#222" stroke-width="1.1"'))
    .join('') +
  qT(x - 5, (y1 + y2) / 2, t, { a: 'middle', fs: 11, rot: -90 });

export const qDVh = (
  y1: number,
  y2: number,
  x: number,
  t: string,
  side?: 'l' | 'r',
): string => {
  const r = side === 'r';
  return (
    qL(x, y1 - 4, x, y2 + 4, 'stroke="#333" stroke-width="0.7"') +
    [y1, y2]
      .map((y) => qL(x - 3.5, y + 3.5, x + 3.5, y - 3.5, 'stroke="#222" stroke-width="1.1"'))
      .join('') +
    qL(x - 12, y1, x + 12, y1, 'stroke="#999" stroke-width="0.5"') +
    qL(x - 12, y2, x + 12, y2, 'stroke="#999" stroke-width="0.5"') +
    qT(r ? x + 8 : x - 8, (y1 + y2) / 2 + 4, t, { a: r ? 'start' : 'end', fs: 11 })
  );
};

export const qAr = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  c?: string,
  w?: number,
): string =>
  qL(
    x1,
    y1,
    x2,
    y2,
    `stroke="${c || '#c00000'}" stroke-width="${w || 1}" marker-end="url(#${c && c !== '#c00000' ? '__K' : '__A'})"`,
  );

export function qHat(
  X: (x: number) => number,
  xa: number,
  xb: number,
  y0: number,
  f: (x: number) => number,
  k: number,
  col: string,
): string {
  let s = '';
  const n = 80;
  const pts: string[] = [];
  for (let i = 0; i <= n; i++) {
    const x = xa + ((xb - xa) * i) / n;
    pts.push(X(x).toFixed(1) + ',' + (y0 + f(x) * k).toFixed(1));
  }
  const N = Math.max(4, Math.round((X(xb) - X(xa)) / 9));
  for (let i = 0; i <= N; i++) {
    const x = xa + ((xb - xa) * i) / N;
    s += qL(X(x), y0, X(x), y0 + f(x) * k, `stroke="${col}" stroke-width="0.6"`);
  }
  return (
    s +
    `<polyline points="${pts.join(' ')}" fill="none" stroke="${col}" stroke-width="1.4"/>` +
    qL(X(xa), y0, X(xb), y0, 'stroke="#222" stroke-width="0.9"')
  );
}

export const qPin = (x: number, y: number): string =>
  `<polygon points="${x},${y} ${x - 8},${y + 13} ${x + 8},${y + 13}" fill="#fff" stroke="#222" stroke-width="1.1"/>` +
  qL(x - 13, y + 14, x + 13, y + 14, 'stroke="#222"') +
  [0, 1, 2, 3, 4, 5]
    .map((i) => qL(x - 12 + i * 5, y + 14, x - 15 + i * 5, y + 18, 'stroke="#222" stroke-width="0.6"'))
    .join('');

export const qRol = (x: number, y: number): string =>
  `<circle cx="${x}" cy="${y + 7}" r="7" fill="#fff" stroke="#222" stroke-width="1.1"/>` +
  qL(x - 13, y + 14, x + 13, y + 14, 'stroke="#222"') +
  [0, 1, 2, 3, 4, 5]
    .map((i) => qL(x - 12 + i * 5, y + 14, x - 15 + i * 5, y + 18, 'stroke="#222" stroke-width="0.6"'))
    .join('');

export interface QdSlabGeom {
  L: number;
  Lc: number;
  L1: number;
  L2: number;
}

export function qSlab(
  X: (x: number) => number,
  yS: number,
  ts: number,
  Hh: number,
  G: QdSlabGeom,
  fill?: string,
): string {
  const L = G.L;
  const xa = X(L - G.L2 - G.L1);
  const xb = X(L - G.L2);
  const th = Hh > ts + 1;
  const pts: Point2D[] = th
    ? [
        [X(0), yS],
        [X(L), yS],
        [X(L), yS + Hh],
        [xb, yS + Hh],
        [xa, yS + ts],
        [X(0), yS + ts],
      ]
    : [
        [X(0), yS],
        [X(L), yS],
        [X(L), yS + ts],
        [X(0), yS + ts],
      ];
  return `<polygon points="${pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')}" fill="${fill || 'url(#__H)'}" stroke="#222" stroke-width="1.4"/>`;
}

export function qCorbel(
  X: (x: number) => number,
  yS: number,
  ts: number,
  G: QdSlabGeom,
  yEnd: number,
): string {
  const xc = X(G.Lc);
  const y1 = yS + ts;
  return `<polyline points="${xc},${y1} ${xc},${y1 + 18} ${X(0)},${y1 + 44} ${X(0)},${yEnd}" fill="none" stroke="#222" stroke-width="1.3"/>`;
}

export const qGround = (x: number, y: number): string =>
  [0, 1, 2, 3, 4]
    .map((i) => qL(x + i * 8, y + 10, x + i * 8 + 9, y, 'stroke="#444" stroke-width="0.8"'))
    .join('');

// ---------------------------------------------------------------------------
// 5. Module 08: Flexible Abutment (`md`) SVG Helpers
// ---------------------------------------------------------------------------

export interface MdSvgBoxResult {
  sc: number;
  X: (x: number) => number;
  Y: (z: number) => number;
}

export function mdSvgBox(
  xs: readonly number[],
  zs: readonly number[],
  W: number,
  H: number,
  pad: readonly [number, number, number],
): MdSvgBoxResult {
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const z0 = Math.min(...zs);
  const z1 = Math.max(...zs);
  const dx = x1 - x0 || 1;
  const dz = z1 - z0 || 1;
  const sc = Math.min((W - 2 * pad[0]) / dx, (H - pad[1] - pad[2]) / dz);
  const ox = (W - dx * sc) / 2 - x0 * sc;
  return { sc, X: (x) => ox + x * sc, Y: (z) => H - pad[2] - (z - z0) * sc };
}

export const mdP = (
  pts: readonly Point2D[],
  X: (x: number) => number,
  Y: (z: number) => number,
  st: string,
): string => `<polygon points="${pts.map((p) => X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ')}" ${st}/>`;

// ---------------------------------------------------------------------------
// 6. Module 14: Shallow Foundation (`sf`) SVG Helpers
// ---------------------------------------------------------------------------

export function sfHatch(
  d: DgKitInstance,
  x1: number,
  x2: number,
  y: number,
  h: number,
  rock: boolean,
): void {
  d.poly(
    [
      [x1, y],
      [x2, y],
      [x2, y + h],
      [x1, y + h],
    ],
    rock ? '#ece6dc' : '#f3efe6',
    't',
  );
  const st = rock ? 14 : 9;
  for (let x = x1 - h; x < x2; x += st) {
    const a = Math.max(x, x1);
    const b = Math.min(x + h, x2);
    if (b > a) d.L(a, y + h - (a - x), b, y + h - (b - x), 't');
  }
}

export const sfArrow = (
  d: DgKitInstance,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  c?: string,
): void => {
  d.s += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${c || '#c00000'}" stroke-width="1.6" marker-end="url(#a${d.id})"/>`;
};

export function sfKit(id: string): DgKitInstance {
  const d = dgKit(id);
  d.id = id;
  return d;
}

// ---------------------------------------------------------------------------
// 7. Module 15: Bridge Hydrology (`hv`) SVG Section Helpers
// ---------------------------------------------------------------------------

export interface HvFrameOptions {
  L?: number;
  Wd?: number;
  T?: number;
  Hmax?: number;
}

export interface HvFrameResult {
  X: (x: number) => number;
  Y: (z: number) => number;
  kx: number;
  ky: number;
  n: number;
  L: number;
  T: number;
  H: number;
  bot: number;
  xr: number;
}

export function hvFrame(
  d: DgKitInstance,
  xmin: number,
  xmax: number,
  zlo: number,
  zhi: number,
  o: HvFrameOptions = {},
): HvFrameResult {
  const L = o.L || 70;
  const Wd = o.Wd || 560;
  const spanX = xmax - xmin || 1;
  const spanZ = zhi - zlo || 1;
  let kx = Wd / spanX;
  const hmax = o.Hmax || 540;
  if (spanZ * kx > hmax) kx = hmax / spanZ;
  const ky = kx;
  const T = o.T || 30;
  const X = (x: number) => L + (x - xmin) * kx;
  const Y = (z: number) => T + (zhi - z) * ky;
  const H = spanZ * ky;

  const dz = [0.5, 1, 2, 5, 10].find((v) => v * ky >= 16) || 10;
  const dx = [1, 2, 5, 10, 20, 25, 50, 100].find((v) => v * kx >= 40) || 100;

  for (let z = Math.ceil(zlo / dz) * dz; z <= zhi + 1e-9; z += dz) {
    d.s += `<line x1="${L}" y1="${Y(z).toFixed(1)}" x2="${X(xmax).toFixed(1)}" y2="${Y(z).toFixed(1)}" stroke="#e3e3e3" stroke-width="0.5"/>`;
    d.L(L - 5, Y(z), L, Y(z));
    d.T(L - 8, Y(z) + 4, fx(z, dz < 1 ? 1 : 0), 'end', 'class="s"');
  }
  for (let x = Math.ceil(xmin / dx) * dx; x <= xmax + 1e-9; x += dx) {
    d.s += `<line x1="${X(x).toFixed(1)}" y1="${T}" x2="${X(x).toFixed(1)}" y2="${(T + H).toFixed(1)}" stroke="#e3e3e3" stroke-width="0.5"/>`;
    d.L(X(x), T + H, X(x), T + H + 4);
    d.T(X(x), T + H + 16, String(x), 'middle', 'class="s"');
  }
  d.L(L, T, L, T + H);
  d.L(L, T + H, X(xmax), T + H);
  d.T(L - 8, T - 10, 'Cao độ (m)', 'start', 'class="s"');
  d.T(X(xmax), T + H + 30, 'Lý trình (m)', 'end', 'class="s"');
  return { X, Y, kx, ky, n: 1, L, T, H, bot: T + H + 34, xr: X(xmax) };
}

export const hvHatch = (id: string): string =>
  `<defs><pattern id="hd${id}" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" stroke="#a08050" stroke-width="0.8"/></pattern>` +
  `<pattern id="hx${id}" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><line x1="0" y1="0" x2="0" y2="5" stroke="#c00000" stroke-width="0.7"/></pattern></defs>`;

export function hvGround(
  d: DgKitInstance,
  F: Pick<HvFrameResult, 'X' | 'Y'>,
  p: readonly Point2D[],
  zb: number,
  id: string,
): void {
  if (!p.length) return;
  const pts = [
    ...p.map((q) => [F.X(q[0]), F.Y(q[1])] as Point2D),
    [F.X(p[p.length - 1][0]), F.Y(zb)] as Point2D,
    [F.X(p[0][0]), F.Y(zb)] as Point2D,
  ];
  d.s += `<polygon points="${pts.map((q) => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' ')}" fill="url(#hd${id})" stroke="none"/>`;
  d.s += `<polyline points="${p.map((q) => F.X(q[0]).toFixed(1) + ',' + F.Y(q[1]).toFixed(1)).join(' ')}" fill="none" stroke="#5a3d1a" stroke-width="1.8"/>`;
}

export function hvWater(
  d: DgKitInstance,
  F: Pick<HvFrameResult, 'X' | 'Y'>,
  p: readonly Point2D[],
  H: number,
  fill: string,
): Point2D[] {
  const wp: Point2D[] = [];
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1];
    const b = p[i];
    if (a[1] < H) wp.push(a);
    if ((a[1] - H) * (b[1] - H) < 0) {
      wp.push([a[0] + ((H - a[1]) / (b[1] - a[1])) * (b[0] - a[0]), H]);
    }
  }
  if (p.length && p[p.length - 1][1] < H) wp.push(p[p.length - 1]);
  if (wp.length > 1) {
    const pts: Point2D[] = [[wp[0][0], H], ...wp, [wp[wp.length - 1][0], H]];
    d.s += `<polygon points="${pts.map((q) => F.X(q[0]).toFixed(1) + ',' + F.Y(q[1]).toFixed(1)).join(' ')}" fill="${fill}" stroke="none"/>`;
  }
  return wp;
}

export function hvDimV(
  d: DgKitInstance,
  x: number,
  y1: number,
  y2: number,
  _t?: string,
  _side?: number,
  col?: string,
): void {
  if (Math.abs(y2 - y1) < 3) return;
  const c = col || '#000';
  d.s += `<line x1="${x.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${c}" stroke-width="0.8"/>`;
  for (const [y, s] of [
    [y1, 1],
    [y2, -1],
  ] as const) {
    d.s += `<polygon points="${x},${y} ${x - 2.5},${y + s * 6} ${x + 2.5},${y + s * 6}" fill="${c}"/>`;
  }
}

// ---------------------------------------------------------------------------
// 8. Module 06: `TCF` Collision-Avoiding Label Placer & SVG Canvas Builder
// ---------------------------------------------------------------------------

export const TCF_COLORS: Readonly<Record<string, string>> = {
  r: '#c00000',
  b: '#0050b0',
  g: '#1b7a2a',
  k: '#222222',
  o: '#c06000',
  m: '#8a2be2',
};

export interface TcfLabelOptions {
  fs?: number;
  a?: 'start' | 'middle' | 'end';
  c?: string;
  b?: boolean;
  i?: boolean;
  h?: boolean;
  hc?: string;
  rot?: number;
  dx?: number;
  dy?: number;
  free?: boolean;
  title?: boolean;
}

export interface TcfLabelItem {
  x: number;
  y: number;
  t: string;
  o: TcfLabelOptions;
}

export type TcfBox = [number, number, number, number];
export type TcfSegment = [number, number, number, number];

let _tcfMeasureCtx: CanvasRenderingContext2D | null | undefined;

function measureTcfTextWidth(t: string, o: TcfLabelOptions): number {
  const plain = String(t).replace(/<[^>]+>/g, '');
  const fs = o.fs || 12;
  if (_tcfMeasureCtx === undefined && typeof document !== 'undefined') {
    try {
      const cv = document.createElement('canvas');
      _tcfMeasureCtx = cv && typeof cv.getContext === 'function' ? cv.getContext('2d') : null;
    } catch {
      _tcfMeasureCtx = null;
    }
  }
  if (_tcfMeasureCtx) {
    _tcfMeasureCtx.font = `${o.i ? 'italic ' : ''}${o.b ? 'bold ' : ''}${fs}px "Times New Roman",Times,"Liberation Serif",serif`;
    return _tcfMeasureCtx.measureText(plain).width * 1.08;
  }
  return plain.length * fs * 0.56;
}

export function tcfLabelBox(L: TcfLabelItem, dx = 0, dy = 0): TcfBox {
  const o = L.o;
  const fs = o.fs || 12;
  const w = measureTcfTextWidth(L.t, o);
  const x = L.x + dx;
  const y = L.y + dy;
  const a = o.a || 'start';
  if (o.rot) {
    const y0 = a === 'middle' ? y - w / 2 : a === 'end' ? y : y - w;
    return [x - 0.9 * fs, y0, x + 0.4 * fs, y0 + w];
  }
  const x0 = a === 'middle' ? x - w / 2 : a === 'end' ? x - w : x;
  return [x0, y - 0.78 * fs, x0 + w, y + 0.24 * fs];
}

function boxesOverlapArea(a: TcfBox, b: TcfBox): number {
  return (
    Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) *
    Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]))
  );
}

function segmentHitCount(b: TcfBox, s: TcfSegment): number {
  const [x1, y1, x2, y2] = s;
  const n = Math.max(2, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 3));
  let k = 0;
  for (let i = 0; i <= n; i++) {
    const x = x1 + ((x2 - x1) * i) / n;
    const y = y1 + ((y2 - y1) * i) / n;
    if (x > b[0] && x < b[2] && y > b[1] && y < b[3]) k++;
  }
  return k;
}

export interface TcfPlacementCanvas {
  W: number;
  H: number;
  lab: TcfLabelItem[];
  obs: TcfBox[];
  seg: TcfSegment[];
}

export function placeTcfLabels(D: TcfPlacementCanvas): TcfBox[] {
  const done: TcfBox[] = [];
  const P = 2.5;
  D.lab
    .sort((a, b) => (b.o.title ? 1 : 0) - (a.o.title ? 1 : 0))
    .forEach((L) => {
      const fs = L.o.fs || 12;
      const k = fs * 1.05;
      const w = measureTcfTextWidth(L.t, L.o);
      const rot = !!L.o.rot;
      const C: Array<[number, number]> = [[0, 0]];
      for (let m = 1; m <= 6; m++) {
        C.push(rot ? [-m * k, 0] : [0, -m * k]);
        C.push(rot ? [m * k, 0] : [0, m * k]);
        if (m <= 2) {
          C.push(rot ? [0, -m * w * 0.35] : [-m * w * 0.35, 0]);
          C.push(rot ? [0, m * w * 0.35] : [m * w * 0.35, 0]);
        }
      }
      let best: { sc: number; dx: number; dy: number; b: TcfBox } | null = null;
      for (const [dx, dy] of C) {
        const b = tcfLabelBox(L, dx, dy);
        const bp: TcfBox = [b[0] - P, b[1] - P, b[2] + P, b[3] + P];
        let sc = 0;
        done.forEach((q) => {
          sc += boxesOverlapArea(bp, q) * 10;
        });
        D.obs.forEach((q) => {
          sc += boxesOverlapArea(bp, q) * 10;
        });
        if (!L.o.free) {
          D.seg.forEach((sg) => {
            sc += segmentHitCount(b, sg) * 12;
          });
        }
        sc +=
          (Math.max(0, 2 - b[0]) +
            Math.max(0, b[2] - (D.W - 2)) +
            Math.max(0, (L.o.title ? 0 : 24) - b[1]) +
            Math.max(0, b[3] - (D.H - 2))) *
          40;
        sc += Math.hypot(dx, dy) * 0.02;
        if (!best || sc < best.sc) best = { sc, dx, dy, b };
        if (sc <= Math.hypot(dx, dy) * 0.02 + 1e-9) break;
      }
      if (best) {
        L.x += best.dx;
        L.y += best.dy;
        done.push(best.b);
      }
    });
  return done;
}

export interface TcfPlotter extends TcfPlacementCanvas {
  sv: SVGElement | null;
  id: string;
  s: string;
  sc: number;
  X: (x: number) => number;
  Y: (y: number) => number;
  view: (box: [number, number, number, number], rect: { x: number; y: number; w: number; h: number }) => void;
  P: (a: readonly Point2D[]) => string;
  poly: (pts: readonly Point2D[], st?: string) => void;
  pl: (pts: readonly Point2D[], st?: string) => void;
  ln: (a: Point2D, b: Point2D, st?: string) => void;
  lp: (x1: number, y1: number, x2: number, y2: number, st?: string) => void;
  rp: (x: number, y: number, w: number, h: number, st?: string) => void;
  tp: (x: number, y: number, t: string, o?: TcfLabelOptions) => void;
  t: (p: Point2D, t: string, o?: TcfLabelOptions) => void;
  arp: (x1: number, y1: number, x2: number, y2: number, c?: string, w?: number, dash?: string) => void;
  arTo: (p: Point2D, u: Point2D, L: number, c?: string, w?: number) => Point2D;
  arFr: (p: Point2D, u: Point2D, L: number, c?: string, w?: number) => Point2D;
  dimH: (
    x1: number,
    x2: number,
    ypx: number,
    t?: string,
    ext?: [number, number] | null,
    o?: TcfLabelOptions,
  ) => void;
  dimV: (
    y1: number,
    y2: number,
    xpx: number,
    t?: string,
    ext?: [number, number] | null,
    o?: TcfLabelOptions,
  ) => void;
  arc: (
    c: Point2D,
    r: number,
    a1: number,
    a2: number,
    t?: string,
    o?: { c?: string; w?: number; ar?: boolean; tr?: number; fs?: number },
  ) => void;
  gnd: (pts: readonly Point2D[], c?: string) => void;
  dot: (p: Point2D, c?: string, r?: number) => void;
  num: (p: Point2D, t: string, c?: string) => void;
  title: (t: string) => void;
  done: () => string;
}

export function createTcfPlotter(
  target: SVGElement | string | null | undefined,
  W: number,
  H: number,
  defsPrefix?: string,
): TcfPlotter {
  const DG = Math.PI / 180;
  const sv = resolveSvgElement(target);
  const id = defsPrefix ?? (typeof target === 'string' ? target : 'tcf');

  const D: TcfPlotter = {
    sv,
    W,
    H,
    id,
    s:
      `<defs><pattern id="${id}H" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M0,7 L7,0" stroke="#8a8a8a" stroke-width="0.6"/></pattern>` +
      `<pattern id="${id}S" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="0.9" fill="#a08050"/><circle cx="9" cy="9" r="0.9" fill="#a08050"/><path d="M7,2 L10,2" stroke="#a08050" stroke-width="0.6"/></pattern>` +
      `<pattern id="${id}R" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M0,10 L10,0 M-2,2 L2,-2 M8,12 L12,8" stroke="#a08050" stroke-width="0.6"/></pattern>` +
      Object.entries(TCF_COLORS)
        .map(
          ([k, c]) =>
            `<marker id="${id}M${k}" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,1.5 L10,5 L0,8.5 z" fill="${c}"/></marker>`,
        )
        .join('') +
      '</defs>',
    sc: 1,
    X: (x) => x,
    Y: (y) => y,
    lab: [],
    obs: [],
    seg: [],
    view(box, rect) {
      const [x0, x1, y0, y1] = box;
      const sc = Math.min(rect.w / (x1 - x0 || 1), rect.h / (y1 - y0 || 1));
      const ox = rect.x + (rect.w - (x1 - x0) * sc) / 2;
      const oy = rect.y + (rect.h - (y1 - y0) * sc) / 2;
      D.sc = sc;
      D.X = (x) => ox + (x - x0) * sc;
      D.Y = (y) => oy + (y1 - y) * sc;
    },
    P: (a) => a.map((q) => D.X(q[0]).toFixed(1) + ',' + D.Y(q[1]).toFixed(1)).join(' '),
    poly(pts, st) {
      if (pts && pts.length > 2) {
        D.s += `<polygon points="${D.P(pts)}" ${st || 'fill="none" stroke="#222"'}/>`;
      }
    },
    pl(pts, st) {
      D.s += `<polyline points="${D.P(pts)}" fill="none" ${st || 'stroke="#222"'}/>`;
    },
    ln(a, b, st) {
      D.s += `<line x1="${D.X(a[0]).toFixed(1)}" y1="${D.Y(a[1]).toFixed(1)}" x2="${D.X(b[0]).toFixed(1)}" y2="${D.Y(b[1]).toFixed(1)}" ${st || 'stroke="#222"'}/>`;
    },
    lp(x1, y1, x2, y2, st) {
      D.s += `<line x1="${(+x1).toFixed(1)}" y1="${(+y1).toFixed(1)}" x2="${(+x2).toFixed(1)}" y2="${(+y2).toFixed(1)}" ${st || 'stroke="#333" stroke-width="0.7"'}/>`;
    },
    rp(x, y, w, h, st) {
      D.s += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" ${st || 'fill="none" stroke="#222"'}/>`;
    },
    tp(x, y, t, o) {
      D.lab.push({ x, y, t, o: o || {} });
    },
    t(p, t, o) {
      const opt = o || {};
      D.tp(D.X(p[0]) + (opt.dx || 0), D.Y(p[1]) + (opt.dy || 0), t, opt);
    },
    arp(x1, y1, x2, y2, c, w, dash) {
      D.seg.push([x1, y1, x2, y2]);
      D.s += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${TCF_COLORS[c || 'r'] || c || '#c00000'}" stroke-width="${w || 1.8}"${dash ? ` stroke-dasharray="${dash}"` : ''} marker-end="url(#${id}M${c || 'r'})"/>`;
    },
    arTo(p, u, L, c, w) {
      const n = Math.hypot(u[0], u[1]) || 1;
      const px = D.X(p[0]);
      const py = D.Y(p[1]);
      const ux = u[0] / n;
      const uy = -u[1] / n;
      D.arp(px - ux * L, py - uy * L, px, py, c, w);
      return [px - ux * L, py - uy * L];
    },
    arFr(p, u, L, c, w) {
      const n = Math.hypot(u[0], u[1]) || 1;
      const px = D.X(p[0]);
      const py = D.Y(p[1]);
      const ux = u[0] / n;
      const uy = -u[1] / n;
      D.arp(px, py, px + ux * L, py + uy * L, c, w);
      return [px + ux * L, py + uy * L];
    },
    dimH(x1, x2, ypx, t, ext, o) {
      const a = D.X(x1);
      const b = D.X(x2);
      if (ext) {
        D.lp(a, D.Y(ext[0]), a, ypx + 4, 'stroke="#999" stroke-width="0.5"');
        D.lp(b, D.Y(ext[1]), b, ypx + 4, 'stroke="#999" stroke-width="0.5"');
      }
      D.lp(a - 4, ypx, b + 4, ypx);
      D.lp(a - 3.5, ypx + 3.5, a + 3.5, ypx - 3.5, 'stroke="#222" stroke-width="1.1"');
      D.lp(b - 3.5, ypx + 3.5, b + 3.5, ypx - 3.5, 'stroke="#222" stroke-width="1.1"');
      if (t) D.tp((a + b) / 2, ypx - 4, t, { a: 'middle', fs: 11, ...(o || {}) });
    },
    dimV(y1, y2, xpx, t, ext, o) {
      const a = D.Y(y1);
      const b = D.Y(y2);
      if (ext) {
        D.lp(
          D.X(ext[0]),
          a,
          xpx + 4 * Math.sign(xpx - D.X(ext[0]) || 1),
          a,
          'stroke="#999" stroke-width="0.5"',
        );
        D.lp(
          D.X(ext[1]),
          b,
          xpx + 4 * Math.sign(xpx - D.X(ext[1]) || 1),
          b,
          'stroke="#999" stroke-width="0.5"',
        );
      }
      D.lp(xpx, a + 4, xpx, b - 4);
      D.lp(xpx - 3.5, a + 3.5, xpx + 3.5, a - 3.5, 'stroke="#222" stroke-width="1.1"');
      D.lp(xpx - 3.5, b + 3.5, xpx + 3.5, b - 3.5, 'stroke="#222" stroke-width="1.1"');
      if (t) D.tp(xpx - 4, (a + b) / 2, t, { a: 'middle', fs: 11, rot: -90, ...(o || {}) });
    },
    arc(c, r, a1, a2, t, o) {
      const opt = o || {};
      const cx = D.X(c[0]);
      const cy = D.Y(c[1]);
      const pt = (a: number): Point2D => [cx + r * Math.cos(a * DG), cy - r * Math.sin(a * DG)];
      const A = pt(a1);
      const B = pt(a2);
      const lg = Math.abs(a2 - a1) > 180 ? 1 : 0;
      const sw = a2 > a1 ? 0 : 1;
      D.s += `<path d="M${A[0].toFixed(1)},${A[1].toFixed(1)} A${r},${r} 0 ${lg} ${sw} ${B[0].toFixed(1)},${B[1].toFixed(1)}" fill="none" stroke="${(opt.c && TCF_COLORS[opt.c]) || opt.c || '#333'}" stroke-width="${opt.w || 0.9}"${opt.ar ? ` marker-end="url(#${id}M${opt.c || 'k'})"` : ''}/>`;
      if (t) {
        const am = (a1 + a2) / 2;
        const rr = r + (opt.tr || 11);
        D.tp(cx + rr * Math.cos(am * DG), cy - rr * Math.sin(am * DG) + 4, t, {
          a: 'middle',
          fs: opt.fs || 11,
          c: opt.c,
          i: true,
        });
      }
    },
    gnd(pts, c) {
      D.pl(pts, `stroke="${c || '#3a7d2a'}" stroke-width="1.6"`);
      for (let i = 0; i < pts.length - 1; i++) {
        const a: Point2D = [D.X(pts[i][0]), D.Y(pts[i][1])];
        const b: Point2D = [D.X(pts[i + 1][0]), D.Y(pts[i + 1][1])];
        const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const n = Math.floor(L / 14);
        for (let k = 1; k < n; k++) {
          const x = a[0] + ((b[0] - a[0]) * k) / n;
          const y = a[1] + ((b[1] - a[1]) * k) / n;
          D.lp(x, y, x - 5, y + 6, `stroke="${c || '#3a7d2a'}" stroke-width="0.7"`);
        }
      }
    },
    dot(p, c, r) {
      D.s += `<circle cx="${D.X(p[0]).toFixed(1)}" cy="${D.Y(p[1]).toFixed(1)}" r="${r || 3.2}" fill="${(c && TCF_COLORS[c]) || c || '#222'}"/>`;
    },
    num(p, t, c) {
      const x = D.X(p[0]);
      const y = D.Y(p[1]);
      D.obs.push([x - 10, y - 10, x + 10, y + 10]);
      D.s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="9" fill="#fff" stroke="${(c && TCF_COLORS[c]) || '#222'}" stroke-width="1.2"/>`;
      emitLabel({ x, y: y + 4, t, o: { a: 'middle', fs: 11, b: true, c, h: false } });
    },
    title(t) {
      D.tp(D.W / 2, 18, t, { a: 'middle', fs: 13, b: true, free: true, title: true });
    },
    done() {
      placeTcfLabels(D);
      D.lab.forEach(emitLabel);
      D.lab = [];
      if (D.sv) {
        D.sv.setAttribute('viewBox', `0 0 ${D.W} ${D.H}`);
        D.sv.setAttribute('width', String(D.W));
        D.sv.setAttribute('height', String(D.H));
        D.sv.innerHTML = D.s;
      }
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${D.W} ${D.H}" width="${D.W}" height="${D.H}">${D.s}</svg>`;
    },
  };

  function emitLabel(L: TcfLabelItem): void {
    const { x, y, t, o } = L;
    const rot = o.rot ? ` transform="rotate(${o.rot} ${x.toFixed(1)} ${y.toFixed(1)})"` : '';
    const fillCol = o.c ? TCF_COLORS[o.c] || o.c : '#111';
    D.s += `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${o.fs || 12}"${o.a ? ` text-anchor="${o.a}"` : ''} fill="${fillCol}"${o.b ? ' font-weight="bold"' : ''}${o.i ? ' font-style="italic"' : ''}${o.h === false ? '' : ` style="paint-order:stroke" stroke="${o.hc || '#fff'}" stroke-width="3" stroke-linejoin="round"`}${rot}>${t}</text>`;
  }

  return D;
}
