/**
 * Clean-Room Culverts & Retaining Walls Visual Report Generators & Hook Registration
 *
 * Exact clean-room TypeScript port of SVG figure generators from:
 * - `analysis-cau-cong/modules/11_culverts_box_and_circular.js`:
 *   `chFigSec`, `chFigLoad`, `chFigLL`, `chFigMod`, `chFigDiag`,
 *   `ctFigSec`, `ctFigLL`, `ctFigLoad`, `ctFigMod`, `ctFigDiag`, `ctFigReb`
 * - `analysis-cau-cong/modules/07_approach_slab_and_culvert_soil.js`:
 *   `chnBox`, `chnFigs` (`dgChnF`, `dgChnE`, `dgChnS`)
 * - `analysis-cau-cong/modules/06_retaining_wall_gravity.js`:
 *   `TCF` (`dgTcSec`, `dgTcW`, `dgTcCoul`, `dgTcP`, `dgTcF`, `dgTcE`, `dgTcS`, `dgTcB`,
 *          `dgTcCt`, `dgTcStm`, `dgTcFt`)
 * - `analysis-cau-cong/modules/09_retaining_wall_cantilever_l.js`:
 *   `TLF` (`dgTlSec`, `dgTlW`, `dgTlP`, `dgTlB`, `dgTlAn`, `dgTlRC`)
 *
 * Bridges `VisualReportHooks` in `src/engine/context.ts` for `renderBoxCulvert`,
 * `renderChn`, `renderPipeCulvert`, `renderGravityWall`, `renderCantileverWall`,
 * and `renderMath`, while guarding all DOM APIs safely for headless Node & `jsdom`.
 */

import {
  qf,
  registerVisualHooks,
  setOutputValue,
  tf,
  type VisualReportHooks,
} from '../engine/context.ts';
import type { Point2D } from '../types/project.ts';
import {
  TCF_COLORS,
  arrowH,
  arrowV,
  cf,
  createTcfPlotter,
  dimH,
  dimV,
  qDH,
  qDV,
  qL,
  qT,
  qdSvg,
  svgL,
  svgP,
  svgPl,
  svgT,
  type TcfPlotter,
} from '../graphics/svgPrimitives.ts';
import { mathAll } from '../graphics/texMath.ts';
import {
  CH_VEH,
  chPatches,
  getLatestChResult,
  getLatestChnResult,
  type ChAnalyseResult,
  type ChDerived,
  type ChEnvelopeResult,
  type ChGeom,
  type ChInput,
  type ChResult,
  type ChnResult,
} from '../engine/culvertsWalls/boxCulvert.ts';
import {
  getLatestCtResult,
  type CtAnalyseResult,
  type CtDerived,
  type CtEnvelopeResult,
  type CtInput,
  type CtResult,
} from '../engine/culvertsWalls/pipeCulvert.ts';
import {
  getLatestTcResult,
  tcCent,
  type TcComboResult,
  type TcResult,
} from '../engine/culvertsWalls/wallGravity.ts';
import {
  getLatestTlResult,
  tlPress,
  type TlResult,
} from '../engine/culvertsWalls/wallCantilever.ts';

// ---------------------------------------------------------------------------
// 1. Safe DOM / Headless SVG Helpers & Visual Output Interfaces
// ---------------------------------------------------------------------------

export type SvgTarget = SVGElement | string | null | undefined;

export interface BoxCulvertVisualResult {
  sec: string;
  load: string;
  ll: string;
  mod: string;
  mCd: string;
  vCd: string;
  nCd: string;
  mSd: string;
  rendered: boolean;
}

export interface ChnVisualResult {
  force: string;
  ecc: string;
  settle: string;
  rendered: boolean;
}

export interface PipeCulvertVisualResult {
  sec: string;
  ll: string;
  load: string;
  mod: string;
  m: string;
  n: string;
  v: string;
  reb: string;
  rendered: boolean;
}

export interface GravityWallVisualResult {
  sec: string;
  weight: string;
  coulomb: string;
  pressure: string;
  force: string;
  ecc: string;
  slide: string;
  bearing: string;
  bamboo: string;
  stem: string;
  foot: string;
  rendered: boolean;
}

export interface CantileverWallVisualResult {
  sec: string;
  weight: string;
  pressure: string;
  bearing: string;
  anchor: string;
  rc: string;
  rendered: boolean;
}

function escSvgText(raw: string | number | null | undefined): string {
  return String(raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getRealElement(id: string): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.getElementById(id);
}

function resolveRealSvg(target: SvgTarget, defaultId: string): SVGElement | null {
  if (target === null) return null;
  if (target !== undefined) {
    if (typeof target !== 'string') return target;
    const el = getRealElement(target);
    return el && typeof el.setAttribute === 'function' ? (el as unknown as SVGElement) : null;
  }
  const el = getRealElement(defaultId);
  return el && typeof el.setAttribute === 'function' ? (el as unknown as SVGElement) : null;
}

function clearSvgElement(id: string): void {
  const el = getRealElement(id);
  if (el) el.innerHTML = '';
  setOutputValue(id, '');
}

function applyCulvertSvg(
  target: SvgTarget,
  defaultId: string,
  W: number,
  H: number,
  body: string,
): string {
  const sv = resolveRealSvg(target, defaultId);
  if (sv) {
    sv.innerHTML = body;
  }
  const fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${body}</svg>`;
  if (target === undefined) {
    setOutputValue(defaultId, fullSvg);
  } else if (typeof target === 'string') {
    setOutputValue(target, fullSvg);
  }
  return fullSvg;
}

function finalizeTcfSvg(
  target: SvgTarget,
  defaultId: string,
  W: number,
  H: number,
  drawFn: (D: TcfPlotter) => void,
): string {
  const resolvedId = typeof target === 'string' ? target : defaultId;
  const targetArg = target === undefined ? defaultId : target;
  const D = createTcfPlotter(targetArg, W, H, resolvedId);
  drawFn(D);
  const svg = D.done();
  if (target === undefined) {
    setOutputValue(defaultId, svg);
  } else if (typeof target === 'string') {
    setOutputValue(target, svg);
  }
  return svg;
}

// ---------------------------------------------------------------------------
// 2. Box Culvert (`CH`) SVG Visual Generators (`11:1364-1859`)
// ---------------------------------------------------------------------------

/** Compute chamfered polygon points for cell `j` of a box culvert cross-section. */
export function chCellPoly(
  G: ChGeom,
  I: Pick<ChInput, 'tv'>,
  j: number,
  map: (x: number, y: number) => Point2D,
): Point2D[] {
  const c = G.cells[j];
  if (!c) return [];
  const tv = I.tv;
  const yB = G.yB;
  const yT = G.yT;
  const pts: Point2D[] = [
    [c.xL + tv, yB],
    [c.xR - tv, yB],
    [c.xR, yB + tv],
    [c.xR, yT - tv],
    [c.xR - tv, yT],
    [c.xL + tv, yT],
    [c.xL, yT - tv],
    [c.xL, yB + tv],
  ];
  return pts.map(([x, y]) => map(x, y));
}

/** Figure 1: Box culvert transverse cross-section & pavement/fill layers (`#dgChSec`). */
export function chFigSec(
  o: ChDerived | null | undefined,
  I: ChInput | null | undefined,
  target?: SvgTarget,
): string {
  if (!o || !I) {
    if (target === undefined) clearSvgElement('dgChSec');
    return '';
  }
  const W = 760;
  const H = 330;
  const G = o.G;
  const tw = I.tw;
  const Bc = o.Bc;
  const sc = Math.min((W - 290) / (Bc + 1.6), (H - 60) / Math.max(o.Hdm + 0.3, 0.3));
  const ox = 200 + 0.8 * sc;
  const oy = 20;
  const X = (x: number) => ox + x * sc;
  const Z = (z: number) => oy + z * sc;
  const xg = (x: number) => x + tw / 2;
  const zg = (y: number) => o.Hdm - I.tb / 2 - y;

  let s =
    '<defs>' +
    '<pattern id="hpv" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0,6 L6,0" stroke="#9aa3a9" stroke-width="0.7"/></pattern>' +
    '<pattern id="hso" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="0.8" fill="#b08d57"/><circle cx="6" cy="6" r="0.8" fill="#b08d57"/></pattern>' +
    '</defs>';

  const xl = -0.8;
  const xr = Bc + 0.8;
  s += `<rect x="${X(xl).toFixed(1)}" y="${Z(0).toFixed(1)}" width="${((xr - xl) * sc).toFixed(1)}" height="${(I.hma * sc).toFixed(1)}" fill="#cfd4d8" stroke="#555" stroke-width="0.6"/>`;
  s += `<rect x="${X(xl).toFixed(1)}" y="${Z(I.hma).toFixed(1)}" width="${((xr - xl) * sc).toFixed(1)}" height="${(I.hmo * sc).toFixed(1)}" fill="url(#hpv)" stroke="#555" stroke-width="0.6"/>`;
  s += `<rect x="${X(xl).toFixed(1)}" y="${Z(I.hma + I.hmo).toFixed(1)}" width="${((xr - xl) * sc).toFixed(1)}" height="${(Math.max(0, o.Hdm - I.hma - I.hmo) * sc).toFixed(1)}" fill="url(#hso)" stroke="none"/>`;
  s += `<rect x="${X(0).toFixed(1)}" y="${Z(o.Hph).toFixed(1)}" width="${(Bc * sc).toFixed(1)}" height="${(Math.max(0, o.Hdm - o.Hph) * sc).toFixed(1)}" fill="#d9d9d9" stroke="#1d1d1f" stroke-width="1.4"/>`;

  G.cells.forEach((_c, j) => {
    s += svgP(
      chCellPoly(G, I, j, (x, y) => [X(xg(x)), Z(zg(y))]),
      '#fff',
      '#1d1d1f',
      1.2,
    );
  });

  s +=
    svgL(X(xl), Z(0), X(xr), Z(0), '#1d1d1f', 1.4) +
    svgT(X(xr) - 2, Z(0) - 4, 'Mặt đường', { a: 'end', s: 11 });

  const xd = X(xl) - 10;
  let z = 0;
  let ylast = -99;
  const vLayers: ReadonlyArray<readonly [string, number]> = [
    ['hmaad', I.hma],
    ['hmoad', I.hmo],
    ['hs', I.hs],
    ['tt', I.tt],
    ['H', I.H],
    ['tb', I.tb],
  ];
  for (const [t, val] of vLayers) {
    if (val > 0) {
      const y1 = Z(z);
      const y2 = Z(z + val);
      const ty = Math.max((y1 + y2) / 2 + 4, ylast + 12);
      ylast = ty;
      s +=
        svgL(xd, y1, xd, y2, '#1d1d1f', 0.8) +
        svgL(xd - 4, y1, xd + 4, y1, '#1d1d1f', 0.8) +
        svgL(xd - 4, y2, xd + 4, y2, '#1d1d1f', 0.8) +
        svgT(xd - 6, ty, `${t} = ${val.toFixed(2)}`, { a: 'end', s: 11 });
    }
    z += val;
  }

  s += dimV(Z(0), Z(o.Hdm), xd - 92, 'Hdm = ' + o.Hdm.toFixed(2));
  for (const c of G.cells) {
    s += dimH(X(xg(c.xL)), X(xg(c.xR)), Z(zg(G.yB + I.H * 0.3)), 'B = ' + I.B.toFixed(2));
  }
  s += dimH(X(0), X(tw), Z(o.Hph) - 8, 'tw');
  if (I.n > 1) {
    for (let k = 1; k < I.n; k++) {
      const x = xg(G.xs[k]);
      s += dimH(X(x - I.twi / 2), X(x + I.twi / 2), Z(o.Hph) - 8, 'twi');
    }
  }
  s += dimH(X(0), X(Bc), Z(o.Hdm) + 16, 'Bc = ' + Bc.toFixed(2));

  const c0 = G.cells[0];
  if (c0) {
    s += dimV(Z(zg(G.yT)), Z(zg(G.yB)), X(xg(c0.xL)) + 10, 'H = ' + I.H.toFixed(2), '#1d1d1f', 1);
  }
  s +=
    svgT(X(xr) - 4, Z(I.hma + I.hmo + I.hs / 2) + 4, 'Đất đắp', { a: 'end', s: 11 }) +
    svgT(X(xl / 2), Z(o.Hph + I.tt + I.H / 2), 'Đất đắp', { a: 'middle', s: 11, r: -90 });

  return applyCulvertSvg(target, 'dgChSec', W, H, s);
}

/** Figure 2: Box culvert load diagram (`#dgChLoad`). */
export function chFigLoad(
  o: ChDerived | null | undefined,
  I: ChInput | null | undefined,
  springK?: number,
  target?: SvgTarget,
): string {
  if (!o || !I) {
    if (target === undefined) clearSvgElement('dgChLoad');
    return '';
  }
  const W = 760;
  const H = 360;
  const G = o.G;
  const Bc = o.Bc;
  const Ht = I.tt + I.H + I.tb;
  const sc = Math.min((W - 330) / Math.max(Bc, 0.1), (H - 120) / Math.max(Ht, 0.1));
  const ox = (W - Bc * sc) / 2;
  const oy = 70;
  const X = (x: number) => ox + x * sc;
  const Y = (z: number) => oy + z * sc;
  const xg = (x: number) => x + I.tw / 2;
  const zg = (y: number) => Ht - I.tb / 2 - y;

  let s = `<rect x="${X(0).toFixed(1)}" y="${Y(0).toFixed(1)}" width="${(Bc * sc).toFixed(1)}" height="${(Ht * sc).toFixed(1)}" fill="#d9d9d9" stroke="#1d1d1f" stroke-width="1.4"/>`;
  G.cells.forEach((_c, j) => {
    s += svgP(
      chCellPoly(G, I, j, (x, y) => [X(xg(x)), Y(zg(y))]),
      '#fff',
      '#1d1d1f',
      1.2,
    );
  });

  const n = Math.max(8, Math.round((Bc * sc) / 22));
  for (let i = 0; i <= n; i++) {
    const x = X((Bc * i) / n);
    s += arrowV(x, Y(0) - 2, 26, '#1f4e79');
  }
  s +=
    svgL(X(0), Y(0) - 28, X(Bc), Y(0) - 28, '#1f4e79', 1) +
    svgT(
      X(Bc / 2),
      Y(0) - 34,
      `EV = ${cf(o.EV)} ; DW = ${cf(o.DW)} ; LL (vệt bánh xe di động) ; kPa`,
      { a: 'middle', s: 11, c: '#1f4e79' },
    );

  const k = 70 / Math.max(o.pb + o.LS, 1);
  const sides: ReadonlyArray<readonly [number, number]> = [
    [-1, X(0)],
    [1, X(Bc)],
  ];
  for (const [sd, xw] of sides) {
    const p1 = o.pt * k;
    const p2 = o.pb * k;
    const ls = o.LS * k;
    s += svgP(
      [
        [xw, Y(0)],
        [xw + sd * p1, Y(0)],
        [xw + sd * p2, Y(Ht)],
        [xw, Y(Ht)],
      ],
      '#f5e6cc',
      '#8a5a00',
      1,
    );
    s += svgP(
      [
        [xw + sd * p1, Y(0)],
        [xw + sd * (p1 + ls), Y(0)],
        [xw + sd * (p2 + ls), Y(Ht)],
        [xw + sd * p2, Y(Ht)],
      ],
      '#e8f0e0',
      '#4a7a2a',
      1,
    );
    for (let i = 0; i <= 5; i++) {
      const z = (Ht * i) / 5;
      const L = (o.pt + ((o.pb - o.pt) * i) / 5) * k;
      s += arrowH(xw + sd * (L + o.LS * k), Y(z), L + o.LS * k - 2, -sd, '#8a5a00');
    }
    s += svgT(xw + sd * (p1 + ls + 6), Y(0) + 4, 'EHt = ' + cf(o.pt), {
      a: sd < 0 ? 'end' : 'start',
      s: 11,
    });
    s += svgT(xw + sd * (p2 + ls + 6), Y(Ht), 'EHb = ' + cf(o.pb), {
      a: sd < 0 ? 'end' : 'start',
      s: 11,
    });
    s += svgT(xw + sd * (p2 + ls + 6), Y(Ht) - 16, 'LS = ' + cf(o.LS), {
      a: sd < 0 ? 'end' : 'start',
      s: 11,
      c: '#4a7a2a',
    });
  }

  if (I.water && G.cells.length > 0) {
    for (const c of G.cells) {
      const x1 = X(xg(c.xL));
      const x2 = X(xg(c.xR));
      const yb = Y(zg(G.yB));
      const yt = Y(zg(G.yT));
      s += `<rect x="${(x1 + 1).toFixed(1)}" y="${(yt + 1).toFixed(1)}" width="${Math.max(0, x2 - x1 - 2).toFixed(1)}" height="${Math.max(0, yb - yt - 2).toFixed(1)}" fill="#dbeaf7" fill-opacity="0.7" stroke="none"/>`;
    }
    const c = G.cells[0];
    s += svgT(X(xg((c.xL + c.xR) / 2)), Y(zg((G.yB + G.yT) / 2)) + 4, 'WA = ' + cf(o.WA), {
      a: 'middle',
      s: 11,
      c: '#1f4e79',
    });
  }

  const ns = Math.max(6, Math.round((Bc * sc) / 28));
  for (let i = 0; i <= ns; i++) {
    const x = X((Bc * i) / ns);
    const y0 = Y(Ht);
    let d = `M${x.toFixed(1)},${y0.toFixed(1)} `;
    for (let q = 1; q <= 6; q++) d += `L${(x + (q % 2 ? 5 : -5)).toFixed(1)},${(y0 + q * 3.5).toFixed(1)} `;
    d += `L${x.toFixed(1)},${(y0 + 24).toFixed(1)}`;
    s +=
      `<path d="${d}" fill="none" stroke="#555" stroke-width="0.9"/>` +
      svgL(x - 6, y0 + 25, x + 6, y0 + 25, '#555', 1);
  }
  const kVal = springK ?? getLatestChResult()?.A?.SP?.k ?? 0;
  s += svgT(X(Bc / 2), Y(Ht) + 42, 'Nền đàn hồi: k = ' + cf(kVal, 0) + ' kN/m3', {
    a: 'middle',
    s: 11,
  });

  return applyCulvertSvg(target, 'dgChLoad', W, H, s);
}

/** Figure 3: Box culvert live load distribution through soil fill (`#dgChLL`). */
export function chFigLL(
  o: ChDerived | null | undefined,
  _I?: ChInput | null,
  target?: SvgTarget,
): string {
  if (!o) {
    if (target === undefined) clearSvgElement('dgChLL');
    return '';
  }
  const W = 760;
  const H = 250;
  const Hm = o.Hph;
  const v = CH_VEH[2];
  const half = o.Lw0 / 2000;
  const span = Math.max(1.2 + 2 * half + 1.2, 4);
  const sc = Math.min((W - 120) / span, (H - 80) / Math.max(Hm, 0.3));
  const ox = (W - span * sc) / 2 + 0.6 * sc;
  const oy = 60;
  const X = (x: number) => ox + x * sc;
  const Y = (z: number) => oy + z * sc;

  let s = '';
  s +=
    svgL(X(-0.6), Y(0), X(span - 0.6), Y(0), '#1d1d1f', 1.4) +
    svgT(X(span - 0.6), Y(0) - 6, 'Mặt đường', { a: 'end', s: 11 });
  s +=
    `<rect x="${X(-0.6).toFixed(1)}" y="${Y(Hm).toFixed(1)}" width="${(span * sc).toFixed(1)}" height="18" fill="#d9d9d9" stroke="#1d1d1f"/>` +
    svgT(X(span - 0.6) - 4, Y(Hm) + 13, 'Bản nắp cống', { a: 'end', s: 11 });

  const P = chPatches(o, v, 0);
  for (const [d, p] of v.ax) {
    const x = X(d);
    s +=
      `<circle cx="${x.toFixed(1)}" cy="${(Y(0) - 16).toFixed(1)}" r="13" fill="#fff" stroke="#1d1d1f" stroke-width="1.2"/>` +
      svgT(x, Y(0) - 36, p + ' kN', { a: 'middle', s: 11 });
    const a = d - 0.125;
    const b = d + 0.125;
    const e = (o.LLDF * Hm) / 2;
    s +=
      svgL(X(a), Y(0), X(a - e), Y(Hm), '#c0392b', 0.9, '4 2') +
      svgL(X(b), Y(0), X(b + e), Y(Hm), '#c0392b', 0.9, '4 2');
  }
  for (const [a, b, q] of P) {
    s +=
      `<rect x="${X(a).toFixed(1)}" y="${(Y(Hm) - 7).toFixed(1)}" width="${((b - a) * sc).toFixed(1)}" height="7" fill="#f2b8b0" stroke="#c0392b"/>` +
      svgT(X((a + b) / 2), Y(Hm) - 11, `PL = ${cf(q)} kPa ; Lw = ${cf((b - a) * 1000, 0)} mm`, {
        a: 'middle',
        s: 11,
        c: '#c0392b',
      });
  }
  s += dimV(Y(0), Y(Hm), X(-0.6) + 8, 'H = ' + cf(Hm * 1000, 0) + ' mm', '#1d1d1f', 1);
  s += svgT(
    X(span / 2 - 0.6),
    H - 8,
    `Xe hai trục thiết kế: dốc phân bố LLDF = ${o.LLDF} (H/1 phía = ${cf(o.LLDF / 2, 3)}); ${o.strip ? 'dải tương đương E = ' + cf(o.E, 0) + ' mm' : 'bề rộng vệt Ww = ' + cf(o.Ww, 0) + ' mm'}`,
    { a: 'middle', s: 11 },
  );

  return applyCulvertSvg(target, 'dgChLL', W, H, s);
}

function chFrameMap(A: ChAnalyseResult, W: number, H: number, pad: number) {
  const G = A.G;
  const sc = Math.min((W - 2 * pad) / Math.max(G.X, 0.1), (H - 2 * pad - 30) / Math.max(G.Yc, 0.1));
  const ox = (W - G.X * sc) / 2;
  const oy = H - pad - 20;
  return { sc, X: (x: number) => ox + x * sc, Y: (y: number) => oy - y * sc };
}

/** Figure 4: Box culvert centerline frame model & section numbering (`#dgChMod`). */
export function chFigMod(
  A: ChAnalyseResult | null | undefined,
  I: ChInput | null | undefined,
  target?: SvgTarget,
): string {
  if (!A || !I) {
    if (target === undefined) clearSvgElement('dgChMod');
    return '';
  }
  const W = 760;
  const H = 380;
  const M = chFrameMap(A, W, H, 70);
  const G = A.G;
  const { X, Y } = M;

  let s =
    svgL(X(0), Y(G.Yc), X(G.X), Y(G.Yc), '#1f4e79', 2) +
    svgL(X(0), Y(0), X(G.X), Y(0), '#1f4e79', 2);
  for (const x of G.xs) {
    s += svgL(X(x), Y(0), X(x), Y(G.Yc), '#1f4e79', 2);
  }
  for (const p of A.nodes) {
    s += `<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="1.4" fill="#1f4e79"/>`;
  }
  A.springs.forEach((sp, i) => {
    if (i % 2 && i !== A.springs.length - 1) return;
    const x = X(sp.x);
    const y0 = Y(0);
    let d = `M${x.toFixed(1)},${y0.toFixed(1)} `;
    for (let q = 1; q <= 6; q++) d += `L${(x + (q % 2 ? 4 : -4)).toFixed(1)},${(y0 + q * 3).toFixed(1)} `;
    d += `L${x.toFixed(1)},${(y0 + 21).toFixed(1)}`;
    s += `<path d="${d}" fill="none" stroke="#555" stroke-width="0.8"/>` + svgL(x - 5, y0 + 22, x + 5, y0 + 22, '#555', 1);
  });

  const botList = A.Ms.bot;
  const fxNode = botList.length > 0 ? A.nodes[botList[Math.floor(botList.length / 2)]] : A.nodes[0];
  if (fxNode) {
    s +=
      svgP(
        [
          [X(fxNode.x), Y(0) + 24],
          [X(fxNode.x) - 8, Y(0) + 32],
          [X(fxNode.x) - 8, Y(0) + 16],
        ],
        'none',
        '#c0392b',
        1,
      ) +
      svgT(X(fxNode.x), Y(0) + 56, '(liên kết ngang chống chuyển vị cứng)', {
        a: 'middle',
        s: 10,
        c: '#c0392b',
      });
  }

  for (const sc0 of A.S) {
    const isS = sc0.mem === 'top' || sc0.mem === 'bot';
    if (isS) {
      const x = X(sc0.x ?? 0);
      const top = sc0.mem === 'top';
      const y = Y(top ? G.Yc : 0);
      s +=
        svgL(x, y - 10, x, y + 10, '#c0392b', 1.6) +
        svgT(x, top ? y - 14 : y + 40, String(sc0.id), { a: 'middle', s: 12, c: '#c0392b', w: 'bold' });
    } else {
      const k = sc0.k ?? 0;
      const x = X(G.xs[k] ?? 0);
      const y = Y(sc0.y ?? 0);
      const dx = k === I.n ? -1 : 1;
      s +=
        svgL(x - 10, y, x + 10, y, '#c0392b', 1.6) +
        svgT(x + dx * 22, y + 4, String(sc0.id), { a: 'middle', s: 12, c: '#c0392b', w: 'bold' });
    }
  }

  s += svgT(
    W / 2,
    16,
    `Khung tim: nhịp tim tường ${G.xs
      .slice(1)
      .map((x, k) => cf(x - G.xs[k], 2))
      .join(
        ' + ',
      )} m ; chiều cao tim ${cf(G.Yc, 2)} m ; ${A.nodes.length} nút, ${A.els.length} phần tử, ${A.springs.length} lò xo`,
    { a: 'middle', s: 11 },
  );

  return applyCulvertSvg(target, 'dgChMod', W, H, s);
}

/** Figure 5: Box culvert internal force envelope diagrams M / V / N (`#dgChM`, `#dgChV`, `#dgChN`, `#dgChMs`). */
export function chFigDiag(
  target: SvgTarget,
  A: ChAnalyseResult | null | undefined,
  EN: ChEnvelopeResult | null | undefined,
  kind: 'M' | 'V' | 'N',
  cmb: 'CD' | 'SD',
): string {
  const defaultId =
    typeof target === 'string'
      ? target
      : kind === 'M'
        ? cmb === 'SD'
          ? 'dgChMs'
          : 'dgChM'
        : kind === 'V'
          ? 'dgChV'
          : 'dgChN';
  if (!A || !EN) {
    if (target === undefined || typeof target === 'string') clearSvgElement(defaultId);
    return '';
  }

  const W = 760;
  const H = 420;
  const M = chFrameMap(A, W, H, 95);
  const G = A.G;
  const { X, Y } = M;
  let s = '';

  const sel = EN.st.filter((x) => (cmb === 'SD' ? x.c.key === 'SD' : x.c.key !== 'SD'));
  const j = kind === 'M' ? 0 : kind === 'V' ? 1 : 2;
  const kmx = kind === 'M' ? 'Mmax' : kind === 'V' ? 'Vmax' : 'Nmax';
  const kmn = kind === 'M' ? 'Mmin' : kind === 'V' ? 'Vmin' : 'Nmin';

  const vals: Array<[number, number]> = A.stations.map((_st, i) => {
    let mx = -1e9;
    let mn = 1e9;
    for (const x of sel) {
      const row = x.r[i];
      if (!row) continue;
      mx = Math.max(mx, row[kmx][j]);
      mn = Math.min(mn, row[kmn][j]);
    }
    if (mx < -1e8) mx = 0;
    if (mn > 1e8) mn = 0;
    return [mx, mn];
  });

  const amax = Math.max(1e-6, ...vals.map((v) => Math.max(Math.abs(v[0]), Math.abs(v[1]))));
  const k = (Math.min(G.X, G.Yc) * M.sc * 0.24) / amax;
  const nrm = (m: string): [number, number] =>
    m === 'top' ? [0, -1] : m === 'bot' ? [0, 1] : m === 'w0' ? [1, 0] : m === 'w' + G.n ? [-1, 0] : [1, 0];

  s += svgL(X(0), Y(G.Yc), X(G.X), Y(G.Yc), '#888', 1.2) + svgL(X(0), Y(0), X(G.X), Y(0), '#888', 1.2);
  for (const x of G.xs) {
    s += svgL(X(x), Y(0), X(x), Y(G.Yc), '#888', 1.2);
  }

  const mems = [...new Set(A.stations.map((st) => st.m))];
  for (const m of mems) {
    const idx = A.stations
      .map((st, i) => [st, i] as const)
      .filter(([st]) => st.m === m);
    if (!idx.length) continue;
    const nv = nrm(m);
    const wx = m.startsWith('w') ? G.xs[+m.slice(1)] ?? 0 : 0;
    const base = (st: (typeof A.stations)[number]): Point2D =>
      m === 'top' ? [X(st.s), Y(G.Yc)] : m === 'bot' ? [X(st.s), Y(0)] : [X(wx), Y(st.s)];
    const bands: ReadonlyArray<readonly [0 | 1, string, string]> = [
      [0, '#c0392b', '#f6d5d0'],
      [1, '#1f4e79', '#d6e3f0'],
    ];
    for (const [q, c, f] of bands) {
      const pts2: Point2D[] = idx.map(([st, i]) => {
        const [bx, by] = base(st);
        const v = vals[i][q];
        return [bx + nv[0] * v * k, by - nv[1] * v * k];
      });
      const poly: Point2D[] = [base(idx[0][0]), ...pts2, base(idx[idx.length - 1][0])];
      s +=
        svgP(poly, f, 'none', 0).replace('<polygon', '<polygon fill-opacity="0.55"') +
        svgPl(pts2, c, 1.3);
    }
  }

  for (const sc0 of A.S) {
    const targetS = sc0.mem === 'top' || sc0.mem === 'bot' ? (sc0.x ?? 0) : (sc0.y ?? 0);
    const i = A.stations.findIndex((st) => st.m === sc0.mem && Math.abs(st.s - targetS) < 1e-6);
    if (i < 0) continue;
    const nv = nrm(sc0.mem);
    const [bx, by] =
      sc0.mem === 'top'
        ? [X(sc0.x ?? 0), Y(G.Yc)]
        : sc0.mem === 'bot'
          ? [X(sc0.x ?? 0), Y(0)]
          : [X(G.xs[sc0.k ?? 0] ?? 0), Y(sc0.y ?? 0)];
    for (const q of [0, 1] as const) {
      const v = vals[i][q];
      if (Math.abs(v) < 0.04 * amax && q === 1 && Math.abs(vals[i][0] - v) < 1e-6) continue;
      const px = bx + nv[0] * v * k;
      const py = by - nv[1] * v * k;
      const off = v >= 0 ? 1 : -1;
      s += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="2" fill="${q ? '#1f4e79' : '#c0392b'}"/>`;
      const tx = px + nv[0] * off * 14 + (nv[0] === 0 ? (q ? -2 : 2) : 0);
      const ty = py - nv[1] * off * 12 + (nv[1] === 0 ? (q ? 12 : -4) : 4);
      s += svgT(tx, ty, cf(v, 1), {
        a: nv[0] === 0 ? (q ? 'end' : 'start') : nv[0] * off > 0 ? 'start' : 'end',
        s: 10,
        c: q ? '#1f4e79' : '#c0392b',
      });
    }
    const isT = sc0.mem === 'top';
    const isB = sc0.mem === 'bot';
    const secK = sc0.k ?? 0;
    const inner = !isT && !isB && secK > 0 && secK < G.n;
    if (inner) {
      s += svgL(bx - 5, by, bx + 5, by, '#555', 1);
      continue;
    }
    s +=
      svgL(
        bx - (isT || isB ? 0 : 5),
        by - (isT || isB ? 5 : 0),
        bx + (isT || isB ? 0 : 5),
        by + (isT || isB ? 5 : 0),
        '#555',
        1,
      ) +
      svgT(
        isT || isB ? bx : bx - nv[0] * (amax * k + 24),
        isT ? Y(G.Yc) - amax * k - 8 : isB ? Y(0) + amax * k + 16 : by + 4,
        '[' + sc0.id + ']',
        { a: 'middle', s: 10, c: '#555' },
      );
  }

  const ttl = { M: 'Mômen M (kN.m/m)', V: 'Lực cắt Q (kN/m)', N: 'Lực dọc N (kN/m), âm là nén' }[kind];
  s += svgT(
    W / 2,
    16,
    (cmb === 'SD' ? 'TTGH Sử dụng I - ' : 'Bao TTGH Cường độ I (I-A, I-B, I-C) - ') + ttl,
    { a: 'middle', s: 12, w: 'bold' },
  );
  s +=
    svgL(W / 2 - 200, 30, W / 2 - 180, 30, '#c0392b', 2) +
    svgT(W / 2 - 176, 34, 'giá trị lớn nhất', { s: 11 }) +
    svgL(W / 2 + 20, 30, W / 2 + 40, 30, '#1f4e79', 2) +
    svgT(W / 2 + 44, 34, 'giá trị nhỏ nhất', { s: 11 });
  if (kind === 'M') {
    s += svgT(
      W / 2,
      H - 6,
      'Mômen dương căng mặt trong lòng cống (tường giữa: mặt phải), vẽ về phía thớ chịu kéo',
      { a: 'middle', s: 10, c: '#555' },
    );
  }

  return applyCulvertSvg(target, defaultId, W, H, s);
}

/** Render all 8 box culvert visual SVG diagrams (`#dgChSec`..`#dgChMs`). */
export function renderBoxCulvertVisuals(resultArg?: ChResult | null): BoxCulvertVisualResult {
  const R = resultArg ?? getLatestChResult();
  if (!R || !R.A || !R.EN || !R.I) {
    return {
      sec: '',
      load: '',
      ll: '',
      mod: '',
      mCd: '',
      vCd: '',
      nCd: '',
      mSd: '',
      rendered: false,
    };
  }
  const { A, EN, I } = R;
  const o = A.o;
  const sec = chFigSec(o, I);
  const load = chFigLoad(o, I, A.SP.k);
  const ll = chFigLL(o, I);
  const mod = chFigMod(A, I);
  const mCd = chFigDiag('dgChM', A, EN, 'M', 'CD');
  const vCd = chFigDiag('dgChV', A, EN, 'V', 'CD');
  const nCd = chFigDiag('dgChN', A, EN, 'N', 'CD');
  const mSd = chFigDiag('dgChMs', A, EN, 'M', 'SD');
  return { sec, load, ll, mod, mCd, vCd, nCd, mSd, rendered: true };
}

// ---------------------------------------------------------------------------
// 3. Box Culvert Soil Bearing & Settlement (`CHN`) Visuals (`07:2219-2440`)
// ---------------------------------------------------------------------------

/** Draw box culvert cross-section outline inside soil bearing/settlement figures. */
export function chnBox(
  X: (x: number) => number,
  Y: (y: number) => number,
  I: Pick<ChInput, 'n' | 'tt' | 'H' | 'tb' | 'tw' | 'twi' | 'B' | 'tv'>,
  G: Pick<ChGeom, 'Bc'>,
  fill?: string,
): string {
  const Bc = G.Bc;
  const Ht = I.tt + I.H + I.tb;
  let s = `<rect x="${X(0).toFixed(1)}" y="${Y(Ht).toFixed(1)}" width="${(X(Bc) - X(0)).toFixed(1)}" height="${(Y(0) - Y(Ht)).toFixed(1)}" fill="${fill || '#d9d9d9'}" stroke="#222" stroke-width="1.4"/>`;
  let x = I.tw;
  for (let k = 0; k < I.n; k++) {
    const a = x;
    const b = x + I.B;
    const v = Math.min(I.tv, I.B / 4, I.H / 4);
    const poly: Point2D[] = [
      [a + v, I.tb],
      [b - v, I.tb],
      [b, I.tb + v],
      [b, I.tb + I.H - v],
      [b - v, I.tb + I.H],
      [a + v, I.tb + I.H],
      [a, I.tb + I.H - v],
      [a, I.tb + v],
    ];
    s += `<polygon points="${poly.map((p) => X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ')}" fill="#fff" stroke="#222" stroke-width="1.2"/>`;
    x = b + I.twi;
  }
  return s;
}

/** Render box culvert foundation bearing & settlement SVGs (`#dgChnF`, `#dgChnE`, `#dgChnS`). */
export function chnFigs(
  R: ChnResult | null | undefined,
  targets?: Partial<Record<'F' | 'E' | 'S', SvgTarget>>,
): ChnVisualResult {
  if (!R || !R.I || !R.G) {
    if (!targets) {
      clearSvgElement('dgChnF');
      clearSvgElement('dgChnE');
      clearSvgElement('dgChnS');
    }
    return { force: '', ecc: '', settle: '', rendered: false };
  }

  const I = R.I;
  const G = R.G;
  const Bc = R.Bc;
  const Ht = I.tt + I.H + I.tb;
  const fix = (id: string, body: string) =>
    body
      .replace(/__A/g, id + 'A')
      .replace(/__H/g, id + 'H')
      .replace(/__S/g, id + 'S')
      .replace(/__K/g, id + 'K');

  // Figure 8.1: Footing base resultant loads
  let force = '';
  {
    const id = 'dgChnF';
    const W = 760;
    const H = 300;
    const sc = Math.min(300 / Math.max(Bc, 0.1), 170 / Math.max(Ht, 0.1));
    const x0 = 380 - (Bc * sc) / 2;
    const yb = 220;
    const X = (x: number) => x0 + x * sc;
    const Y = (y: number) => yb - y * sc;
    let s =
      `<rect x="80" y="${yb}" width="600" height="50" fill="url(#__S)" stroke="none"/>` +
      qL(80, yb, 680, yb, 'stroke="#222" stroke-width="1"') +
      qT(620, yb + 34, 'Đất nền', { fs: 12, i: true }) +
      chnBox(X, Y, I, G) +
      qT(X(Bc) + 12, Y(Ht / 2), 'Móng cống', { fs: 12 });
    const xc = X(Bc / 2);
    const ym = yb - 10;
    s +=
      qL(xc, ym - 120, xc, ym - 4, 'stroke="#0050b0" stroke-width="2.4" marker-end="url(#__K)"') +
      qT(xc + 8, ym - 112, 'ΣV', { fs: 14, b: true, c: '#0050b0' }) +
      qL(xc + 70, ym, xc + 6, ym, 'stroke="#0050b0" stroke-width="2.4" marker-end="url(#__K)"') +
      qT(xc + 74, ym + 4, 'ΣH', { fs: 14, b: true, c: '#0050b0' }) +
      `<path d="M${(xc - 40).toFixed(1)},${ym} A40,34 0 1 1 ${(xc + 40).toFixed(1)},${ym}" fill="none" stroke="#0050b0" stroke-width="2"/>` +
      qL(xc - 40, ym - 6, xc - 40, ym - 1, 'stroke="#0050b0" stroke-width="2" marker-end="url(#__K)"') +
      qT(xc - 44, ym - 30, 'ΣM', { a: 'end', fs: 14, b: true, c: '#0050b0' }) +
      `<circle cx="${xc.toFixed(1)}" cy="${ym}" r="5" fill="#fff" stroke="#222"/>` +
      qDH(X(0), X(Bc), yb + 18, `B = ${qf(Bc, 3)} m`) +
      qT(W / 2, 20, 'TẢI TRỌNG TÁC DỤNG TẠI ĐÁY MÓNG CỐNG', { a: 'middle', fs: 13, b: true });

    const tgt = targets?.F !== undefined ? targets.F : id;
    force = qdSvg(tgt, W, H, fix(id, s), id);
    if (targets?.F === undefined) setOutputValue(id, force);
  }

  // Figure 8.2: Eccentric footing + effective area plan
  let ecc = '';
  {
    const id = 'dgChnE';
    const W = 760;
    const H = 320;
    const sc = 260 / Math.max(Bc, 0.1);
    const x0 = 60;
    const X = (x: number) => x0 + x * sc;
    const yT = 90;
    const e = R.eB;
    const Bp = R.Bp;
    let s = `<rect x="${X(0).toFixed(1)}" y="${yT}" width="${(Bc * sc).toFixed(1)}" height="36" fill="url(#__S)" stroke="#222" stroke-width="1.3"/>`;
    const xc = X(Bc / 2);
    const xr = X(Bc / 2 - e);
    s +=
      qL(xr, yT - 50, xr, yT + 18, 'stroke="#0050b0" stroke-width="2.2" marker-end="url(#__K)"') +
      qT(xr + 6, yT - 40, 'ΣV', { fs: 13, b: true, c: '#0050b0' }) +
      qL(xc + 70, yT + 18, xc + 6, yT + 18, 'stroke="#0050b0" stroke-width="2" marker-end="url(#__K)"') +
      qT(xc + 74, yT + 22, 'ΣH', { fs: 12, b: true, c: '#0050b0' }) +
      `<path d="M${(xc - 46).toFixed(1)},${yT + 18} A46,40 0 1 1 ${(xc + 46).toFixed(1)},${yT + 18}" fill="none" stroke="#0050b0" stroke-width="1.8"/>` +
      qT(xc - 52, yT - 8, 'ΣM', { a: 'end', fs: 12, b: true, c: '#0050b0' }) +
      `<circle cx="${xc.toFixed(1)}" cy="${yT + 18}" r="4" fill="#fff" stroke="#222"/>`;

    const yq = yT + 92;
    s += qL(X(0), yq, X(Bp), yq, 'stroke="#222"');
    for (let i = 0; i <= 12; i++) {
      const x = X((Bp * i) / 12);
      s += qL(x, yq, x, yT + 40, 'stroke="#222" stroke-width="0.9" marker-end="url(#__K)"');
    }
    s += qT(X(Bp) + 8, yq - 20, `σmax = ${qf(R.sig, 1)} kN/m²`, { fs: 11 });
    s +=
      qL(xr, yq + 48, xr, yq + 2, 'stroke="#c00000" stroke-width="2" marker-end="url(#__A)"') +
      qT(xr - 6, yq + 46, 'ΣV', { a: 'end', fs: 12, b: true, c: '#c00000' }) +
      qL(xr - 4, yq + 28, xc + 4, yq + 28, 'stroke="#333" stroke-width="0.7"') +
      [xr, xc].map((x) => qL(x - 3.5, yq + 31.5, x + 3.5, yq + 24.5, 'stroke="#222" stroke-width="1.1"')).join('') +
      qT(xc + 8, yq + 32, `e = ${qf(e, 3)} m`, { fs: 11 }) +
      qDH(X(0), X(Bp), yq + 64, `B' = B − 2e = ${qf(Bp, 3)} m`) +
      qDH(X(Bp), X(Bc), yq + 64, '2e') +
      qL(xc, yT + 40, xc, yq + 30, 'stroke="#999" stroke-width="0.6" stroke-dasharray="4 3"');

    const px = 450;
    const pw = 250;
    const ph = 150;
    const py = 70;
    const sp = pw / Math.max(Bc, 0.1);
    s +=
      `<rect x="${px}" y="${py}" width="${pw}" height="${ph}" fill="url(#__S)" stroke="#222" stroke-width="1.4"/>` +
      `<rect x="${px}" y="${py}" width="${(Bp * sp).toFixed(1)}" height="${ph}" fill="rgba(0,80,176,.10)" stroke="none"/>` +
      qL(px + Bp * sp, py, px + Bp * sp, py + ph, 'stroke="#222" stroke-width="2" stroke-dasharray="7 4"') +
      qDH(px, px + pw, py - 16, `B = ${qf(Bc, 3)} m`) +
      qDV(py, py + ph, px - 16, 'L') +
      qDH(px, px + Bp * sp, py + ph + 22, `B' = B − 2eB`) +
      qT(px + pw / 2, py + ph + 48, `(dải tính L = 1 m ; L' = chiều dài cống = ${qf(R.Lc, 2)} m khi tính sức kháng)`, {
        a: 'middle',
        fs: 10,
        i: true,
        c: '#555',
      }) +
      qT(W / 2, 20, 'MÓNG CHỊU TẢI LỆCH TÂM - KÍCH THƯỚC CÓ HIỆU', { a: 'middle', fs: 13, b: true });

    const tgt = targets?.E !== undefined ? targets.E : id;
    ecc = qdSvg(tgt, W, H, fix(id, s), id);
    if (targets?.E === undefined) setOutputValue(id, ecc);
  }

  // Figure 8.3: Effective overburden & settlement stress depth profile
  let settle = '';
  if (R.ST && R.ST.pts.length > 0) {
    const id = 'dgChnS';
    const T = R.ST;
    const W = 760;
    const Hn = Math.max(T.Hn, 0.1);
    const Df = R.Df;
    const top = 56;
    const sc = Math.min(170 / Math.max(Bc, 0.1), 150 / Math.max(Ht, 0.1));
    const dfp = Math.max(Ht * sc + 20, Math.min(Df * sc, 230));
    const yb = top + dfp;
    const xc = 330;
    const X = (x: number) => xc + (x - Bc / 2) * sc;
    const Y = (y: number) => yb - y * sc;
    const s2 = 260 / Hn;
    const Yz = (z: number) => yb + z * s2;
    const H = Yz(Hn) + 60;

    let s =
      qL(60, top, 690, top, 'stroke="#222"') +
      qT(64, top - 6, Df * sc > 230 ? 'Mặt đất (vẽ không theo tỷ lệ)' : 'Mặt đất', { fs: 11, i: true }) +
      chnBox(X, Y, I, G, '#e6e6e6') +
      qL(X(-0.15), yb, X(Bc + 0.15), yb, 'stroke="#222" stroke-width="3"') +
      qDV(top, yb, 680, `Df = ${qf(Df, 2)} m`) +
      qDV(yb, Yz(Hn), 680, `Hn = ${qf(Hn, 2)} m`) +
      qT(704, (yb + Yz(Hn)) / 2, 'Vùng chịu nén', { a: 'middle', fs: 10, rot: -90, c: '#555' });

    const mx = Math.max(...T.pts.map((p) => p.sz), 1e-9);
    const md = Math.max(...T.pts.map((p) => p.dz), 1e-9);
    const ks = 170 / mx;
    const kd = 170 / Math.max(md, mx / 3);
    const ax = xc;

    s += qL(ax, yb, ax, Yz(Hn) + 10, 'stroke="#222" stroke-width="0.9"');
    s += `<polyline points="${T.pts.map((p) => (ax - p.sz * ks).toFixed(1) + ',' + Yz(p.z).toFixed(1)).join(' ')}" fill="none" stroke="#0050b0" stroke-width="1.6"/>`;
    s += `<polyline points="${T.pts.map((p) => (ax + p.dz * kd).toFixed(1) + ',' + Yz(p.z).toFixed(1)).join(' ')}" fill="none" stroke="#c00000" stroke-width="1.6"/>`;

    const st = Math.max(1, Math.ceil(T.pts.length / 12));
    T.pts.forEach((p, i) => {
      const y = Yz(p.z);
      if (i > 0) s += qL(90, y, 660, y, 'stroke="#888" stroke-width="0.6" stroke-dasharray="6 4"');
      if (i % st === 0 || i === T.pts.length - 1) {
        s +=
          qT(ax + 4, y + 12, String(p.i), { fs: 10 }) +
          qT(ax - p.sz * ks - 4, y - 3, qf(p.sz, 1), { a: 'end', fs: 10, c: '#0050b0' }) +
          qT(ax + p.dz * kd + 4, y - 3, qf(p.dz, 1), { fs: 10, c: '#c00000' });
      }
    });

    const yl = Yz(Hn) + 34;
    s +=
      qT(ax - 100, yl, "σ'z (kN/m²)", { a: 'middle', fs: 12, b: true, c: '#0050b0' }) +
      qT(ax + 100, yl, 'Δσz (kN/m²)', { a: 'middle', fs: 12, b: true, c: '#c00000' }) +
      qT(W / 2, 20, "BIỂU ĐỒ ỨNG SUẤT BẢN THÂN σ'z VÀ ỨNG SUẤT GÂY LÚN Δσz", {
        a: 'middle',
        fs: 13,
        b: true,
      });

    const tgt = targets?.S !== undefined ? targets.S : id;
    settle = qdSvg(tgt, W, H, fix(id, s), id);
    if (targets?.S === undefined) setOutputValue(id, settle);
  } else if (targets?.S === undefined) {
    clearSvgElement('dgChnS');
  }

  return { force, ecc, settle, rendered: true };
}

/** Render box culvert foundation bearing & settlement SVGs using latest result if omitted. */
export function renderChnVisuals(resultArg?: ChnResult | null): ChnVisualResult {
  return chnFigs(resultArg ?? getLatestChnResult());
}

// ---------------------------------------------------------------------------
// 4. Circular Pipe Culvert (`CT`) SVG Visual Generators (`11:2990-3396`)
// ---------------------------------------------------------------------------

/** Figure 1: Circular pipe culvert cross-section & bedding cradle (`#dgCtSec`). */
export function ctFigSec(
  o: CtDerived | null | undefined,
  I: CtInput | null | undefined,
  target?: SvgTarget,
): string {
  if (!o || !I) {
    if (target === undefined) clearSvgElement('dgCtSec');
    return '';
  }
  const W = 760;
  const H = 380;
  const tm = I.tm ?? 0;
  const tot = o.Hph + 2 * o.Ro + tm + 0.3;
  const wid = 2 * o.Ro + 2.6;
  const sc = Math.min((W - 300) / Math.max(wid, 0.1), (H - 40) / Math.max(tot, 0.1));
  const cx = W / 2 + 40;
  const oy = 24;
  const Y = (z: number) => oy + z * sc;
  const X = (x: number) => cx + x * sc;
  const xl = -o.Ro - 1.3;
  const xr = o.Ro + 1.3;
  const zc = o.Hph + o.Ro;

  let s =
    '<defs>' +
    '<pattern id="ctp1" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0,6 L6,0" stroke="#9aa3a9" stroke-width="0.7"/></pattern>' +
    '<pattern id="ctp2" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="0.8" fill="#b08d57"/><circle cx="6" cy="6" r="0.8" fill="#b08d57"/></pattern>' +
    '</defs>';
  s += `<rect x="${X(xl).toFixed(1)}" y="${Y(0).toFixed(1)}" width="${((xr - xl) * sc).toFixed(1)}" height="${(I.hma * sc).toFixed(1)}" fill="#cfd4d8" stroke="#555" stroke-width="0.6"/>`;
  s += `<rect x="${X(xl).toFixed(1)}" y="${Y(I.hma).toFixed(1)}" width="${((xr - xl) * sc).toFixed(1)}" height="${(I.hmo * sc).toFixed(1)}" fill="url(#ctp1)" stroke="#555" stroke-width="0.6"/>`;
  s += `<rect x="${X(xl).toFixed(1)}" y="${Y(I.hma + I.hmo).toFixed(1)}" width="${((xr - xl) * sc).toFixed(1)}" height="${(Math.max(0, zc + o.Ro + tm - I.hma - I.hmo) * sc).toFixed(1)}" fill="url(#ctp2)"/>`;

  const bw = 2 * o.Ro * 0.9;
  s += `<path d="M${X(-bw / 2 - 0.15).toFixed(1)},${Y(zc + o.Ro + tm).toFixed(1)} L${X(bw / 2 + 0.15).toFixed(1)},${Y(zc + o.Ro + tm).toFixed(1)} L${X(bw / 2 + 0.15).toFixed(1)},${Y(zc + 0.25 * o.Ro).toFixed(1)} L${X(-bw / 2 - 0.15).toFixed(1)},${Y(zc + 0.25 * o.Ro).toFixed(1)} Z" fill="#e0e0e0" stroke="#1d1d1f" stroke-width="1"/>`;
  s += `<circle cx="${X(0).toFixed(1)}" cy="${Y(zc).toFixed(1)}" r="${(o.Ro * sc).toFixed(1)}" fill="#bfbfbf" stroke="#1d1d1f" stroke-width="1.4"/><circle cx="${X(0).toFixed(1)}" cy="${Y(zc).toFixed(1)}" r="${(o.Ri * sc).toFixed(1)}" fill="#fff" stroke="#1d1d1f" stroke-width="1.2"/>`;
  s +=
    svgL(X(xl), Y(0), X(xr), Y(0), '#1d1d1f', 1.4) +
    svgT(X(xr) - 2, Y(0) - 4, 'Mặt đường', { a: 'end', s: 11 });

  const xd = X(xl) - 10;
  let z = 0;
  let yl = -99;
  const vLayers: ReadonlyArray<readonly [string, number]> = [
    ['ts', I.hma],
    ['tb', I.hmo],
    ['H', I.hs],
  ];
  for (const [t, val] of vLayers) {
    if (val > 0) {
      const y1 = Y(z);
      const y2 = Y(z + val);
      const ty = Math.max((y1 + y2) / 2 + 4, yl + 12);
      yl = ty;
      s +=
        svgL(xd, y1, xd, y2, '#1d1d1f', 0.8) +
        svgL(xd - 4, y1, xd + 4, y1, '#1d1d1f', 0.8) +
        svgL(xd - 4, y2, xd + 4, y2, '#1d1d1f', 0.8) +
        svgT(xd - 6, ty, `${t} = ${val.toFixed(2)}`, { a: 'end', s: 11 });
    }
    z += val;
  }

  s += dimV(Y(0), Y(o.Hph), xd - 78, 'Hphủ = ' + o.Hph.toFixed(2));
  s += dimH(X(-o.Ri), X(o.Ri), Y(zc) + 4, 'D0 = ' + I.D0.toFixed(2));
  s += dimH(X(-o.Ro), X(o.Ro), Y(zc + o.Ro + tm) + 16, 'Bc = ' + o.Bc.toFixed(2));
  s +=
    svgL(X(o.Ri), Y(zc) - 30, X(o.Ro), Y(zc) - 30, '#1d1d1f', 0.8) +
    svgT(X(o.Ro) + 4, Y(zc) - 26, 't = ' + I.t.toFixed(2), { s: 11 });
  s += dimV(
    Y(zc + o.Ro + 0.25 * o.Ro - o.Ro),
    Y(zc + o.Ro + tm),
    X(xr) + 12,
    'tm = ' + tm.toFixed(2),
    '#1d1d1f',
    1,
  );
  s +=
    svgT(X(xr) - 4, Y(I.hma + I.hmo + I.hs / 2) + 4, 'Đất đắp', { a: 'end', s: 11 }) +
    svgT(X(xl) + 4, Y(I.hma / 2) + 4, 'Tầng mặt', { s: 10 }) +
    svgT(X(xl) + 4, Y(I.hma + I.hmo / 2) + 4, 'Tầng móng', { s: 10 });

  return applyCulvertSvg(target, 'dgCtSec', W, H, s);
}

/** Figure 2: Circular pipe culvert 2-way wheel load distribution (`#dgCtLL`). */
export function ctFigLL(
  o: CtDerived | null | undefined,
  I: CtInput | null | undefined,
  target?: SvgTarget,
): string {
  if (!o || !I || !o.vg) {
    if (target === undefined) clearSvgElement('dgCtLL');
    return '';
  }
  const W = 760;
  const H = 300;
  const Hm = o.thin ? 0.3 : o.Hph;
  const v = o.vg;
  let s = '';

  const panel = (
    x0: number,
    w: number,
    title: string,
    len: number,
    load: Array<[number, string]>,
    bw: number,
    lbl: string,
    ex = 0,
  ) => {
    const span = Math.max(len + 1.2, 2.5);
    const sc = Math.min((w - 40) / span, (H - 110) / Math.max(Hm, 0.3));
    const X = (x: number) => x0 + w / 2 + x * sc;
    const Y = (z: number) => 64 + z * sc;
    s += svgT(x0 + w / 2, 16, title, { a: 'middle', s: 11, w: 'bold' });
    s += svgL(X(-span / 2), Y(0), X(span / 2), Y(0), '#1d1d1f', 1.3);
    for (const [d, P] of load) {
      const x = X(d);
      s +=
        `<circle cx="${x.toFixed(1)}" cy="${(Y(0) - 13).toFixed(1)}" r="11" fill="#fff" stroke="#1d1d1f"/>` +
        svgT(x, Y(0) - 30, P, { a: 'middle', s: 10 });
      const a = d - bw / 2;
      const b = d + bw / 2;
      const e = (o.LLDF * Hm) / 2 + ex;
      s +=
        svgL(X(a), Y(0), X(a - e), Y(Hm), '#c0392b', 0.9, '4 2') +
        svgL(X(b), Y(0), X(b + e), Y(Hm), '#c0392b', 0.9, '4 2');
    }
    const xs = load.map((l) => l[0]);
    const a = Math.min(...xs) - bw / 2 - (o.LLDF * Hm) / 2 - ex;
    const b = Math.max(...xs) + bw / 2 + (o.LLDF * Hm) / 2 + ex;
    s +=
      `<rect x="${X(a).toFixed(1)}" y="${Y(Hm).toFixed(1)}" width="${((b - a) * sc).toFixed(1)}" height="6" fill="#f2b8b0" stroke="#c0392b"/>` +
      svgT(X((a + b) / 2), Y(Hm) + 20, lbl, { a: 'middle', s: 10, c: '#c0392b' });
    s +=
      svgL(X(-span / 2), Y(Hm), X(span / 2), Y(Hm), '#555', 0.8, '6 3') +
      svgT(X(span / 2), Y(Hm) - 4, 'Đỉnh cống', { a: 'end', s: 10 });
    s += dimV(Y(0), Y(Hm), X(-span / 2) + 6, 'H = ' + cf(Hm * 1000, 0), '#1d1d1f', 1);
  };

  panel(
    10,
    360,
    'Phương dọc trục ống (vuông góc hướng xe chạy)',
    o.tInt ? 1.8 : 0.6,
    o.tInt
      ? [
          [-0.9, v.P / 2 + ' kN'],
          [0.9, v.P / 2 + ' kN'],
        ]
      : [[0, v.P / 2 + ' kN']],
    0.51,
    'Ww = ' + cf(o.Ww, 0) + ' mm',
    0.03 * I.D0,
  );
  const ax: Array<[number, string]> = v.pInt
    ? [
        [-v.sa / 2000, v.P + ' kN'],
        [v.sa / 2000, v.P + ' kN'],
      ]
    : [[0, v.P + ' kN']];
  panel(
    390,
    360,
    'Phương ngang ống (theo hướng xe chạy) - ' + escSvgText(v.nm.toLowerCase()),
    v.pInt ? v.sa / 1000 : 0.4,
    ax,
    0.25,
    'Lw = ' + cf(v.Lw, 0) + ' mm',
  );
  s += svgT(
    W / 2,
    H - 8,
    `LLDF = ${cf(o.LLDF, 3)} ; vệt tải tại đỉnh cống Ww x Lw = ${cf(o.Ww, 0)} x ${cf(v.Lw, 0)} mm ; PL = ${cf(v.q)} kPa`,
    { a: 'middle', s: 11 },
  );

  return applyCulvertSvg(target, 'dgCtLL', W, H, s);
}

/** Figure 3: Circular pipe culvert Heger pressure distribution diagram (`#dgCtLoad`). */
export function ctFigLoad(
  o: CtDerived | null | undefined,
  I: CtInput | null | undefined,
  target?: SvgTarget,
): string {
  if (!o || !I) {
    if (target === undefined) clearSvgElement('dgCtLoad');
    return '';
  }
  const W = 760;
  const H = 420;
  const R = Math.max(o.R, 1e-6);
  const sc = 110 / R;
  const cx = W / 2;
  const cy = 205;
  const X = (x: number) => cx + x * sc;
  const Y = (y: number) => cy - y * sc;

  let s = `<circle cx="${cx}" cy="${cy}" r="${(o.Ro * sc).toFixed(1)}" fill="#d9d9d9" stroke="#1d1d1f" stroke-width="1.3"/><circle cx="${cx}" cy="${cy}" r="${(o.Ri * sc).toFixed(1)}" fill="${I.water ? '#dbeaf7' : '#fff'}" stroke="#1d1d1f" stroke-width="1.1"/>`;
  const q = (o.WEV + o.WDW) / o.Bc;
  const top = Y(o.Ro) - 14;
  for (let i = 0; i <= 12; i++) {
    const x = -o.Ro + (2 * o.Ro * i) / 12;
    const yt = Y(Math.sqrt(Math.max(0, o.Ro * o.Ro - x * x)));
    s += arrowV(X(x), yt - 1, Math.max(10, yt - top + 10), '#1f4e79');
  }
  s +=
    svgL(X(-o.Ro), top - 10, X(o.Ro), top - 10, '#1f4e79', 1) +
    svgT(cx, top - 16, `(VAF.PL)/Bc = ${cf(q)} kPa (EV + DW) ; hoạt tải ${cf(o.WLL / o.Bc)} kPa`, {
      a: 'middle',
      s: 11,
      c: '#1f4e79',
    });

  const ph = (o.HEV + o.HDW) / o.Bc;
  for (const sd of [-1, 1]) {
    const xo = X(sd * o.Ro) + sd * 46;
    s += svgL(xo, Y(o.Ro), xo, Y(-o.Ro), '#8a5a00', 1);
    for (let i = 0; i <= 8; i++) {
      const y = -o.Ro + (2 * o.Ro * i) / 8;
      const xs = Math.sqrt(Math.max(0, o.Ro * o.Ro - y * y));
      s += arrowH(xo, Y(y), Math.abs(xo - X(sd * xs)) - 1, -sd, '#8a5a00');
    }
    s += svgT(xo + sd * 6, Y(0) + 4, `(HAF.PL)/Bc = ${cf(ph)} kPa`, {
      a: sd < 0 ? 'end' : 'start',
      s: 11,
      c: '#8a5a00',
    });
  }

  const ps = (o.psi * Math.PI) / 180;
  const bw = o.Ro * Math.sin(ps / 2);
  const yb = Y(-o.Ro) + 46;
  for (let i = 0; i <= 8; i++) {
    const x = -bw + (2 * bw * i) / 8;
    const yy = Y(-Math.sqrt(Math.max(0, o.Ro * o.Ro - x * x)));
    s +=
      svgL(X(x), yb, X(x), yy + 7, '#4a7a2a', 1) +
      svgP(
        [
          [X(x), yy + 1],
          [X(x) - 3, yy + 7],
          [X(x) + 3, yy + 7],
        ],
        '#4a7a2a',
        '#4a7a2a',
      );
  }
  s +=
    svgL(X(-bw), yb, X(bw), yb, '#4a7a2a', 1) +
    svgT(cx, yb + 16, `Phản lực nền trên cung tựa ψ = ${cf(o.psi, 1)}°`, {
      a: 'middle',
      s: 11,
      c: '#4a7a2a',
    });
  s +=
    svgL(cx, cy, X(-o.Ro * Math.sin(ps / 2)), Y(-o.Ro * Math.cos(ps / 2)), '#4a7a2a', 0.8, '4 3') +
    svgL(cx, cy, X(o.Ro * Math.sin(ps / 2)), Y(-o.Ro * Math.cos(ps / 2)), '#4a7a2a', 0.8, '4 3') +
    svgT(cx, cy + 40, 'ψ', { a: 'middle', s: 12, c: '#4a7a2a' });
  if (I.water) s += svgT(cx, cy - 8, 'WF: nước đầy ống', { a: 'middle', s: 11, c: '#1f4e79' });

  return applyCulvertSvg(target, 'dgCtLoad', W, H, s);
}

/** Figure 4: Circular pipe ring frame model & critical sections (`#dgCtMod`). */
export function ctFigMod(
  A: CtAnalyseResult | null | undefined,
  _I?: CtInput | null,
  target?: SvgTarget,
): string {
  if (!A || !A.M || !A.o) {
    if (target === undefined) clearSvgElement('dgCtMod');
    return '';
  }
  const W = 760;
  const H = 380;
  const R = Math.max(A.o.R, 1e-6);
  const sc = 130 / R;
  const cx = W / 2;
  const cy = 190;
  const X = (x: number) => cx + x * sc;
  const Y = (y: number) => cy - y * sc;

  let s = `<circle cx="${cx}" cy="${cy}" r="${(R * sc).toFixed(1)}" fill="none" stroke="#1f4e79" stroke-width="2"/>`;
  A.M.nodes.forEach((p, k) => {
    if (k % 4 === 0) s += `<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="1.6" fill="#1f4e79"/>`;
  });

  const marks: ReadonlyArray<readonly [number, number]> = [
    [1, 0],
    [2, Math.PI / 2],
    [3, Math.PI],
  ];
  for (const [id, th] of marks) {
    const x = R * Math.sin(th);
    const y = R * Math.cos(th);
    const nx = Math.sin(th);
    const ny = Math.cos(th);
    s +=
      svgL(X(x - nx * 0.12 * R), Y(y - ny * 0.12 * R), X(x + nx * 0.12 * R), Y(y + ny * 0.12 * R), '#c0392b', 2) +
      svgT(X(x + nx * 0.24 * R) + (id === 2 ? 10 : 0), Y(y + ny * 0.24 * R) + 4, `${id} - ${id}`, {
        a: 'middle',
        s: 12,
        c: '#c0392b',
        w: 'bold',
      });
  }

  s +=
    svgL(cx, cy, X(0), Y(R), '#888', 0.6, '3 3') +
    svgL(cx, cy, X(R * Math.sin(0.6)), Y(R * Math.cos(0.6)), '#888', 0.6, '3 3') +
    svgT(X(0.18 * R), Y(0.55 * R), 'θ', { s: 12 }) +
    svgT(cx, cy + 4, `R = ${cf(R, 3)} m`, { a: 'middle', s: 11 }) +
    svgT(W / 2, 16, `Vòng tim thành ống: ${A.M.N} phần tử, mỗi phần tử ${cf(360 / Math.max(A.M.N, 1), 1)}°`, {
      a: 'middle',
      s: 11,
    }) +
    svgT(W / 2, H - 6, '1-1: đỉnh cống ; 2-2: thân cống ngang tâm ; 3-3: đáy cống', {
      a: 'middle',
      s: 11,
    });

  return applyCulvertSvg(target, 'dgCtMod', W, H, s);
}

/** Figure 5: Circular pipe ring internal force diagrams M / N / V (`#dgCtM`, `#dgCtN`, `#dgCtV`). */
export function ctFigDiag(
  target: SvgTarget,
  A: CtAnalyseResult | null | undefined,
  EN: CtEnvelopeResult[] | null | undefined,
  kind: 'M' | 'N' | 'V',
): string {
  const defaultId = typeof target === 'string' ? target : `dgCt${kind}`;
  if (!A || !EN || EN.length < 2 || !A.M.N) {
    if (target === undefined || typeof target === 'string') clearSvgElement(defaultId);
    return '';
  }

  const W = 760;
  const H = 430;
  const R = Math.max(A.o.R, 1e-6);
  const sc = 120 / R;
  const cx = W / 2;
  const cy = 222;
  const N = A.M.N;
  const CD = EN[0];
  const SD = EN[1];

  const series: Array<readonly [number[], string, string | null, string]> =
    kind === 'M'
      ? [
          [CD.st.map((t) => t.Mmax[0]), '#c0392b', '#f6d5d0', 'CĐ I - lớn nhất'],
          [CD.st.map((t) => t.Mmin[0]), '#1f4e79', '#d6e3f0', 'CĐ I - nhỏ nhất'],
          [SD.st.map((t) => t.Mmax[0]), '#2e7d32', null, 'Sử dụng I'],
        ]
      : kind === 'N'
        ? [
            [CD.st.map((t) => t.Nmin[2]), '#1f4e79', '#d6e3f0', 'CĐ I - nén lớn nhất'],
            [CD.st.map((t) => t.Nmax[2]), '#c0392b', null, 'CĐ I - nén nhỏ nhất'],
          ]
        : [[CD.st.map((t) => t.Vabs[1]), '#c0392b', '#f6d5d0', 'CĐ I - trị tuyệt đối lớn nhất']];

  const amax = Math.max(1e-6, ...series.flatMap((sr) => sr[0].map((val) => Math.abs(val))));
  const k = (0.42 * R * sc) / amax;
  let s = `<circle cx="${cx}" cy="${cy}" r="${(R * sc).toFixed(1)}" fill="none" stroke="#888" stroke-width="1.2"/>`;

  const pt = (i: number, v: number): Point2D => {
    const th = (2 * Math.PI * i) / N;
    const nx = Math.sin(th);
    const ny = Math.cos(th);
    const r = R * sc + (kind === 'M' ? -v : v) * k;
    return [cx + nx * r, cy - ny * r];
  };

  for (const [vals, c, f] of series) {
    const pts = vals.map((v, i) => pt(i, v));
    if (pts.length) pts.push(pts[0]);
    if (f && pts.length) {
      const base = [...Array(N + 1)].map((_, i) => pt(i % N, 0));
      s += `<path d="M${pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' L')} L${base
        .reverse()
        .map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1))
        .join(' L')} Z" fill="${f}" fill-opacity="0.5" stroke="none" fill-rule="evenodd"/>`;
    }
    s += svgPl(pts, c, 1.4);
  }

  const keyIndices = [0, 1, 2, 3, 4, 5, 6, 7].map((q) => Math.round((q * N) / 8) % N);
  for (const i of keyIndices) {
    series.slice(0, kind === 'M' ? 2 : 1).forEach(([vals, c], q) => {
      const v = vals[i] ?? 0;
      const [px, py] = pt(i, v);
      const th = (2 * Math.PI * i) / N;
      const nx = Math.sin(th);
      const ny = Math.cos(th);
      const out = (kind === 'M' ? -v : v) >= 0 ? 1 : -1;
      const tx = px + nx * out * 16;
      const ty = py - ny * out * 14 + (q ? 12 : 0) + 4;
      s +=
        `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="2" fill="${c}"/>` +
        svgT(tx, ty, cf(v, 1), {
          a: Math.abs(nx) < 0.2 ? 'middle' : nx * out > 0 ? 'start' : 'end',
          s: 10,
          c,
        });
    });
  }

  const ttl = {
    M: 'Mômen M (kN.m/m) - mômen dương căng mặt trong, vẽ về phía thớ chịu kéo',
    N: 'Lực dọc N (kN/m), âm là nén',
    V: 'Lực cắt Q (kN/m)',
  }[kind];
  s += svgT(W / 2, 16, ttl, { a: 'middle', s: 12, w: 'bold' });
  series.forEach(([, c, , nm], q) => {
    const x = W / 2 - 260 + q * 190;
    s += svgL(x, 32, x + 20, 32, c, 2) + svgT(x + 24, 36, nm, { s: 11 });
  });
  s +=
    svgT(cx, cy - R * sc - 6, '1', { a: 'middle', s: 11, c: '#555' }) +
    svgT(cx + R * sc + 8, cy + 4, '2', { s: 11, c: '#555' }) +
    svgT(cx, cy + R * sc + 16, '3', { a: 'middle', s: 11, c: '#555' });

  return applyCulvertSvg(target, defaultId, W, H, s);
}

/** Figure 6: Circular pipe longitudinal wall rebar cage arrangement (`#dgCtReb`). */
export function ctFigReb(
  o: CtDerived | null | undefined,
  I: CtInput | null | undefined,
  target?: SvgTarget,
): string {
  if (!o || !I) {
    if (target === undefined) clearSvgElement('dgCtReb');
    return '';
  }
  const W = 760;
  const H = 230;
  const h = Math.max(o.h, 1);
  const sc = Math.min(1.1, 150 / h);
  const x0 = 200;
  const y0 = 40;
  const w = 360;

  let s = `<rect x="${x0}" y="${y0}" width="${w}" height="${(h * sc).toFixed(1)}" fill="#e6e6e6" stroke="#1d1d1f" stroke-width="1.2"/>`;
  s +=
    svgT(x0 - 6, y0 + 4, 'Mặt ngoài', { a: 'end', s: 11 }) +
    svgT(x0 - 6, y0 + h * sc, 'Mặt trong', { a: 'end', s: 11 });

  const bars = (c: number, d: number, sp: number, fromIn: boolean, col: string): number => {
    const y = fromIn ? y0 + h * sc - (c + d / 2) * sc : y0 + (c + d / 2) * sc;
    s += svgL(x0, y, x0 + w, y, col, 1, '5 3');
    const step = Math.max(14, Math.max(sp, 10) * sc * 0.3);
    for (let x = x0 + Math.max(sp, 10) * sc * 0.3; x < x0 + w; x += step) {
      s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${Math.max(2.5, (d * sc) / 2).toFixed(1)}" fill="${col}"/>`;
    }
    return y;
  };

  const yi = bars(I.ri.c, I.ri.d, I.ri.s, true, '#c0392b');
  s += svgT(x0 + w + 8, yi + 4, `Lồng trong Φ${I.ri.d} a${I.ri.s}`, { s: 11, c: '#c0392b' });
  if (I.cages === 2) {
    const yo = bars(I.ro.c, I.ro.d, I.ro.s, false, '#1f4e79');
    s += svgT(x0 + w + 8, yo + 4, `Lồng ngoài Φ${I.ro.d} a${I.ro.s}`, { s: 11, c: '#1f4e79' });
  }
  s += dimV(y0, y0 + h * sc, x0 - 80, 'h = ' + cf(h, 0), '#1d1d1f', -1);
  s += svgT(
    W / 2,
    y0 + h * sc + 40,
    'Mặt cắt dọc thành ống (b = 1000 mm). Khoảng cách các thanh vẽ minh họa.',
    { a: 'middle', s: 11 },
  );

  return applyCulvertSvg(target, 'dgCtReb', W, H, s);
}

/** Render all 8 circular pipe culvert SVG diagrams (`#dgCtSec`..`#dgCtReb`). */
export function renderPipeCulvertVisuals(resultArg?: CtResult | null): PipeCulvertVisualResult {
  const R = resultArg ?? getLatestCtResult();
  if (!R || !R.A || !R.EN || !R.I) {
    return {
      sec: '',
      ll: '',
      load: '',
      mod: '',
      m: '',
      n: '',
      v: '',
      reb: '',
      rendered: false,
    };
  }
  const { A, EN, I } = R;
  const o = A.o;
  const sec = ctFigSec(o, I);
  const ll = ctFigLL(o, I);
  const load = ctFigLoad(o, I);
  const mod = ctFigMod(A, I);
  const m = ctFigDiag('dgCtM', A, EN, 'M');
  const n = ctFigDiag('dgCtN', A, EN, 'N');
  const v = ctFigDiag('dgCtV', A, EN, 'V');
  const reb = ctFigReb(o, I);
  return { sec, ll, load, mod, m, n, v, reb, rendered: true };
}


// ---------------------------------------------------------------------------
// 5. Gravity Retaining Wall (`TCF`) SVG Visual Generators (`06:4085-5110`)
// ---------------------------------------------------------------------------

const TCF_DEG = Math.PI / 180;

function tcfFmt(x: number, d = 2): string {
  return tf(x, d);
}

/** Draw gravity retaining wall structure (foot, stem, optional cap or cut break line). */
export function tcDrawStruct(
  D: TcfPlotter,
  R: TcResult,
  o?: { light?: boolean; cutY?: number },
): void {
  const opt = o ?? {};
  const g = R.g;
  const I = R.I;
  const id = D.id;
  const lt = Boolean(opt.light);

  D.poly(
    g.foot,
    I.footMat === 'm' && !lt
      ? `fill="url(#${id}H)" stroke="#222" stroke-width="1.4"`
      : `fill="${lt ? '#efefef' : '#d9d9d9'}" stroke="${lt ? '#888' : '#222'}" stroke-width="${lt ? 1 : 1.4}"`,
  );

  const stem: Point2D[] =
    opt.cutY != null
      ? [
          [g.xfb, I.t1],
          [g.xbb, I.t1],
          [g.xb(opt.cutY), opt.cutY],
          [g.xf(opt.cutY), opt.cutY],
        ]
      : g.stem;

  D.poly(
    stem,
    lt
      ? 'fill="#f4f4f4" stroke="#888" stroke-width="1"'
      : `fill="url(#${id}H)" stroke="#222" stroke-width="1.4"`,
  );

  if (opt.cutY != null) {
    const cy = opt.cutY;
    D.ln([g.xf(cy) - 0.05, cy], [g.xb(cy) + 0.05, cy], 'stroke="#fff" stroke-width="3"');
    const a = g.xf(cy);
    const b = g.xb(cy);
    const m = (a + b) / 2;
    const h = 0.06;
    D.pl(
      [
        [a - 0.05, cy],
        [m - 0.08, cy],
        [m - 0.03, cy + h],
        [m + 0.03, cy - h],
        [m + 0.08, cy],
        [b + 0.05, cy],
      ],
      'stroke="#222" stroke-width="0.9"',
    );
  } else if (g.cap) {
    D.poly(
      g.cap,
      `fill="${lt ? '#f4f4f4' : '#c8c8c8'}" stroke="${lt ? '#888' : '#222'}" stroke-width="${lt ? 1 : 1.4}"`,
    );
  }
}

function tcGndPts(R: TcResult): Point2D[] {
  const I = R.I;
  const g = R.g;
  const G: Point2D[] = [g.T];
  if (I.Hs > 1e-9) G.push([g.T[0] + I.m * I.Hs, g.T[1] + I.Hs]);
  return G;
}

/** Render gravity retaining wall geometry & computational model (`#dgTcSec`). */
export function tcFigSec(R: TcResult | null | undefined, target?: SvgTarget): string {
  if (!R || !R.g || !R.I || !R.Ld) {
    if (target === undefined || typeof target === 'string') {
      clearSvgElement(target ?? 'dgTcSec');
    }
    return '';
  }
  return finalizeTcfSvg(target, 'dgTcSec', 760, 610, (D) => {
    const I = R.I;
    const g = R.g;
    const Ld = R.Ld;
    const G = tcGndPts(R);
    const gT = G[G.length - 1][1];
    const xL = I.LL ? g.T[0] + I.dT : null;
    const xE = Math.max(g.B + 1.0, G[G.length - 1][0] + 1.2, xL != null ? xL + 1.6 : 0);
    const xm = -1.0;
    const lsH = Ld.lsOn ? Ld.heq : 0;
    const top = Math.max(g.yT, gT) + Math.max(lsH, I.q > 0 ? 0.45 : 0) + 0.25;
    const bot = -g.dy - 0.4;

    D.view([xm, xE, bot, top], { x: 92, y: 66, w: 760 - 92 - 96, h: 610 - 66 - 78 });
    D.title('MÔ HÌNH TÍNH TOÁN VÀ KÍCH THƯỚC TƯỜNG CHẮN');
    const id = D.id;
    const yF = I.t1 + I.hf;

    D.poly(
      [
        [xm, 0],
        [0, 0],
        [g.B, -g.dy],
        [xE, -g.dy],
        [xE, bot],
        [xm, bot],
      ],
      `fill="url(#${id}S)" stroke="none"`,
    );
    D.poly(
      [
        [xm, yF],
        [g.xf(yF), yF],
        [g.xfb, I.t1],
        [0, I.t1],
        [0, 0],
        [xm, 0],
      ],
      'fill="#efe4cc" stroke="none"',
    );
    D.poly(
      [
        [g.xbb, I.t1],
        g.T,
        ...G.slice(1),
        [xE, gT],
        [xE, -g.dy],
        [g.B, -g.dy],
        [g.B, I.t1],
      ],
      'fill="#efe4cc" stroke="none"',
    );
    D.gnd([
      [xm, yF],
      [g.xf(yF), yF],
    ]);
    D.gnd([g.T, ...G.slice(1), [xE, gT]]);
    tcDrawStruct(D, R);

    D.t([Math.min(xE - 0.1, g.B + 0.15), (bot - g.dy) / 2 - 0.05], 'Đất nền', {
      fs: 11,
      i: true,
    });
    D.t([xE - 0.15, (gT + I.t1) / 2], 'Đất đắp', { a: 'end', fs: 11, i: true });
    {
      const ym = I.t1 + I.H * 0.42;
      const xm2 = (g.xf(ym) + g.xb(ym)) / 2;
      D.t([xm2, ym], I.stemMat === 'm' ? 'Đá hộc xây' : 'Bê tông', { a: 'middle', fs: 11 });
    }
    D.t([g.B * 0.5, I.t1 * 0.72], I.footMat === 'm' ? 'Móng đá hộc xây' : 'Móng bê tông', {
      a: 'middle',
      fs: 11,
      hc: '#d9d9d9',
    });

    // Pressure reference plane AT
    D.ln(g.A, g.T, `stroke="${TCF_COLORS.r}" stroke-width="1.2" stroke-dasharray="7 4"`);

    // Surcharge & live load
    if (I.q > 0) {
      const x1 = G[G.length - 1][0] + 0.1;
      const n = Math.max(4, Math.round(((xE - 0.15 - x1) * D.sc) / 26));
      for (let k = 0; k <= n; k++) {
        const x = x1 + ((xE - 0.15 - x1) * k) / n;
        D.arTo([x, gT], [0, -1], 26, 'b', 1.2);
      }
      D.lp(
        D.X(x1),
        D.Y(gT) - 26,
        D.X(xE - 0.15),
        D.Y(gT) - 26,
        `stroke="${TCF_COLORS.b}" stroke-width="1.2"`,
      );
      D.t([xE - 0.15, gT], `q = ${tcfFmt(I.q, 1)} kPa`, { a: 'end', dy: -31, c: 'b', fs: 11 });
    }
    if (I.LL && xL != null) {
      const yl = gT;
      if (Ld.lsOn) {
        D.poly(
          [
            [xL, yl],
            [xE, yl],
            [xE, yl + lsH],
            [xL, yl + lsH],
          ],
          `fill="rgba(0,80,176,.10)" stroke="${TCF_COLORS.b}" stroke-dasharray="5 3"`,
        );
        D.t([(xL + xE) / 2, yl + lsH / 2], `LS: heq = ${tcfFmt(Ld.heq, 3)} m`, {
          a: 'middle',
          dy: 4,
          c: 'b',
          fs: 11,
        });
      }
      D.lp(D.X(xL), D.Y(yl), D.X(xL), D.Y(yl + lsH) - 10, 'stroke="#222" stroke-width="1.2"');
      const yd = D.Y(Math.max(g.yT, gT) + lsH) - 30;
      D.dimH(g.T[0], xL, yd, `d = ${tcfFmt(I.dT, 2)}`, [g.T[1], yl]);
      D.tp(D.X(xL) + 6, yd + 4, 'Mép làn xe', { fs: 11 });
    }

    // Slopes
    {
      const y1 = I.t1 + I.H * 0.62;
      if (I.n1 > 1e-6) D.t([g.xf(y1), y1], `1:${tcfFmt(I.n1, 2)}`, { a: 'end', dx: -6, fs: 11 });
      if (Math.abs(I.n2) > 1e-6) D.t([g.xb(y1), y1], `1:${tcfFmt(I.n2, 2)}`, { dx: 7, fs: 11 });
    }
    if (I.Hs > 1e-9 && G.length > 1) {
      const p: Point2D = [(g.T[0] + G[1][0]) / 2, (g.T[1] + G[1][1]) / 2];
      D.t(p, `1:${tcfFmt(I.m, 2)}`, { dx: -34, dy: -4, fs: 11 });
      D.lp(
        D.X(g.T[0]),
        D.Y(g.T[1]),
        D.X(g.T[0]) + 46,
        D.Y(g.T[1]),
        'stroke="#666" stroke-width="0.6" stroke-dasharray="3 2"',
      );
      const betaDeg = (Math.abs(I.m) > 1e-9 ? Math.atan(1 / I.m) : Math.PI / 2) / TCF_DEG;
      D.arc(g.T, 40, 0, betaDeg, 'β');
    }

    // Base tilt angle eps
    if (g.dy > 1e-6) {
      D.lp(
        D.X(0),
        D.Y(0),
        D.X(0) + 70,
        D.Y(0),
        'stroke="#666" stroke-width="0.6" stroke-dasharray="3 2"',
      );
      D.arc([0, 0], 60, -g.eps / TCF_DEG, 0, '');
      D.t([0, 0], `ε = ${tcfFmt(g.eps / TCF_DEG, 2)}°`, {
        dx: 74,
        dy: -4,
        fs: 11,
        hc: '#d9d9d9',
      });
    }

    // Key points
    D.dot([0, 0]);
    D.t([0, 0], 'O', { dx: -12, dy: 14, b: true });
    D.dot(g.C0, 'b');
    D.t(g.C0, 'C', { dx: 4, dy: 15, c: 'b', b: true });
    D.dot(g.A, 'r', 2.6);
    D.t(g.A, 'A', { dx: 5, dy: 14, c: 'r', b: true });
    D.dot(g.T, 'r', 2.6);
    D.t(g.T, 'T', { dx: 6, dy: 15, c: 'r', b: true });

    // Bottom / top horizontal dimensions
    const yb1 = D.Y(bot) + 20;
    const yb2 = yb1 + 24;
    D.dimH(0, g.xfb, yb1, `a1 = ${tcfFmt(I.a1)}`, [0, I.t1]);
    D.dimH(g.xfb, g.xbb, yb1, `${tcfFmt(g.xbb - g.xfb)}`, [I.t1, I.t1]);
    D.dimH(g.xbb, g.B, yb1, `a2 = ${tcfFmt(I.a2)}`, [I.t1, -g.dy]);
    D.dimH(0, g.B, yb2, `B = ${tcfFmt(g.B)}`);
    D.dimH(g.xft, g.xbt, D.Y(g.yT) - 14, `b0 = ${tcfFmt(I.b0)}`, [g.yT, g.yT]);

    // Left vertical dimensions
    const xl1 = D.X(xm) - 14;
    const xl2 = xl1 - 26;
    D.dimV(0, I.t1, xl1, `t1 = ${tcfFmt(I.t1)}`, [0, 0]);
    D.dimV(I.t1, g.yT, xl1, `H = ${tcfFmt(I.H)}`, [g.xfb, g.xft]);
    if (I.hf > 1e-6) D.dimV(0, yF, xl2, `Df = ${tcfFmt(yF)}`, [xm, xm]);
    if (I.hc > 1e-6) D.dimV(g.yT - I.hc, g.yT, D.X(g.xft) - 22, 'hc', [g.xft, g.xft], { fs: 10 });

    // Right vertical dimensions
    const xr1 = D.X(xE) + 16;
    const xr2 = xr1 + 26;
    D.dimV(-g.dy, I.t1, D.X(g.B) + 14, `t2 = ${tcfFmt(I.t2)}`);
    D.dimV(g.A[1], g.yT, xr1, `H' = ${tcfFmt(g.Hp, 3)}`, [g.A[0], g.T[0]]);
    if (I.Hs > 1e-9 && G.length > 1) {
      D.dimV(g.yT, gT, xr2, `Hs = ${tcfFmt(I.Hs)}`, [g.T[0], G[1][0]]);
    }
    D.t(
      [g.A[0] + (g.T[0] - g.A[0]) * 0.55, g.A[1] + g.Hp * 0.55],
      'mặt phẳng tính áp lực',
      { dx: 8, fs: 10, c: 'r', i: true },
    );
  });
}

/** Render gravity retaining wall weight decomposition diagram (DC / EV) (`#dgTcW`). */
export function tcFigW(R: TcResult | null | undefined, target?: SvgTarget): string {
  if (!R || !R.g || !R.I || !R.Ld) {
    if (target === undefined || typeof target === 'string') {
      clearSvgElement(target ?? 'dgTcW');
    }
    return '';
  }
  return finalizeTcfSvg(target, 'dgTcW', 760, 430, (D) => {
    const I = R.I;
    const g = R.g;
    const Ld = R.Ld;
    const xm = -0.5;
    const xM = Math.max(g.B, g.T[0]) + 0.6;
    D.view([xm, xM, -g.dy - 0.2, g.yT + 0.35], { x: 40, y: 32, w: 760 - 80, h: 430 - 32 - 30 });
    D.title('SƠ ĐỒ CHIA KHỐI TÍNH TRỌNG LƯỢNG BẢN THÂN (DC) VÀ ĐẤT ĐẮP (EV)');

    const parts: Array<{ P: Point2D[]; c: string }> = [{ P: g.stem, c: '#cfe0f5' }];
    if (g.cap) parts.push({ P: g.cap, c: '#e6d2f2' });
    parts.push({ P: g.foot, c: '#dcdcdc' });
    if (g.ev) parts.push({ P: g.ev, c: '#f2e3c2' });

    const L = Ld.L.filter((l) => l.ty === 'DC' || l.ty === 'EV');
    parts.forEach((p) => D.poly(p.P, `fill="${p.c}" stroke="#222" stroke-width="1.3"`));
    D.ln(g.A, g.T, `stroke="${TCF_COLORS.r}" stroke-width="1" stroke-dasharray="7 4"`);

    L.forEach((l, i) => {
      const p: Point2D = [l.x, l.y];
      D.dot(p, 'k', 2.8);
      const e = D.arFr(p, [0, -1], Math.min(40, 0.3 * D.sc + 16), 'r', 1.4);
      const lf = l.ty === 'DC' && l.y > I.t1;
      D.tp(e[0] + (lf ? -4 : 4), e[1] - 2, `G${i + 1} = ${tcfFmt(-l.Fy, 1)} kN`, {
        fs: 11,
        c: 'r',
        a: lf ? 'end' : 'start',
      });
      D.num(p, String(i + 1), l.ty === 'EV' ? 'o' : 'b');
    });

    // Coordinate axes
    D.dot([0, 0]);
    D.t([0, 0], 'O', { dx: -14, dy: 14, b: true });
    D.arFr([0, 0], [1, 0], 48, 'k', 1);
    D.arFr([0, 0], [0, 1], 48, 'k', 1);
    D.tp(D.X(0) + 50, D.Y(0) + 4, 'x', { fs: 11, i: true });
    D.tp(D.X(0) - 4, D.Y(0) - 52, 'y', { fs: 11, i: true, a: 'end' });
    D.t([g.A[0], g.A[1]], 'A', { dx: 5, dy: 14, c: 'r', b: true });
    D.t(g.T, 'T', { dx: -14, dy: -4, c: 'r', b: true });
    D.tp(
      760 - 40,
      430 - 12,
      'Số hiệu khối ứng với cột "Khối" trong bảng ; tọa độ trọng tâm x, y tính từ gốc O',
      { a: 'end', fs: 10, i: true },
    );
  });
}

/** Render gravity retaining wall active Coulomb wedge search diagram (`#dgTcCoul`). */
export function tcFigCoul(R: TcResult | null | undefined, target?: SvgTarget): string {
  if (!R || !R.g || !R.I || !R.Ld?.w0) {
    if (target === undefined || typeof target === 'string') {
      clearSvgElement(target ?? 'dgTcCoul');
    }
    return '';
  }
  return finalizeTcfSvg(target, 'dgTcCoul', 760, 470, (D) => {
    const I = R.I;
    const g = R.g;
    const w = R.Ld.w0;
    const G = tcGndPts(R);
    const C: Point2D = w.C ?? [g.A[0] + g.Hp, g.yT];
    const rhoDeg = w.rho ?? 45;
    const wLen = Math.max(w.L, 1e-9);
    const Hp = Math.max(g.Hp, 1e-9);
    const gE = Math.max(C[0], G[G.length - 1][0]) + 0.8;
    const ytop = Math.max(g.yT, G[G.length - 1][1], C[1]) + 0.3;

    D.view([g.xfb - 0.4, gE, Math.min(g.A[1], -g.dy) - 0.1, ytop], {
      x: 40,
      y: 30,
      w: 760 - 80,
      h: 470 - 30 - 34,
    });
    D.title('SƠ ĐỒ NÊM TRƯỢT ĐẤT CHỦ ĐỘNG (GIẢ THIẾT COULOMB - PHƯƠNG PHÁP NÊM THỬ)');

    const Gx: Point2D[] = [g.T, ...G.slice(1), [gE, G[G.length - 1][1]]];
    D.poly(
      [[g.xbb, I.t1], g.T, ...Gx.slice(1), [gE, g.A[1]], g.A, [g.B, I.t1]],
      'fill="#f3ebd9" stroke="none"',
    );
    tcDrawStruct(D, R, { light: true });
    D.gnd(Gx);

    const wd: Point2D[] = [g.A, g.T, ...G.slice(1).filter((p) => p[0] < C[0] - 1e-9), C];
    D.poly(wd, `fill="rgba(230,140,40,.30)" stroke="${TCF_COLORS.o}" stroke-width="1"`);
    D.ln(g.A, g.T, `stroke="${TCF_COLORS.r}" stroke-width="2"`);
    D.ln(g.A, C, `stroke="${TCF_COLORS.o}" stroke-width="1.6" stroke-dasharray="8 4"`);

    // Wedge self-weight W
    const cw = tcCent(wd);
    D.dot([cw.x, cw.y], 'k', 2.6);
    const e = D.arFr([cw.x, cw.y], [0, -1], 55, 'k', 1.8);
    D.tp(e[0] - 6, e[1] - 4, `W = ${tcfFmt(w.W, 1)} kN`, { fs: 12, b: true, a: 'end' });

    // Pa at H'/3
    const pa: Point2D = [g.A[0] + (g.T[0] - g.A[0]) / 3, g.A[1] + Hp / 3];
    const v: Point2D = [(g.T[0] - g.A[0]) / wLen, Hp / wLen];
    const nw: Point2D = [v[1], -v[0]];
    D.lp(
      D.X(pa[0]),
      D.Y(pa[1]),
      D.X(pa[0]) + nw[0] * 80,
      D.Y(pa[1]) - nw[1] * 80,
      'stroke="#666" stroke-width="0.7" stroke-dasharray="4 3"',
    );
    const tl = D.arTo(pa, w.F, 100, 'r', 2.2);
    D.tp(tl[0] + 4, tl[1] - 6, `Pa = ${tcfFmt(w.P, 1)} kN`, { fs: 12, b: true, c: 'r' });
    const aN = Math.atan2(nw[1], nw[0]) / TCF_DEG;
    const aF = Math.atan2(-w.F[1], -w.F[0]) / TCF_DEG;
    D.arc(pa, 40, Math.min(aN, aF), Math.max(aN, aF), `δ = ${tcfFmt(I.delta, 1)}°`, {
      c: 'r',
      tr: 30,
    });

    // Reaction R along slip plane AE
    const rho = rhoDeg * TCF_DEG;
    const u: Point2D = [Math.cos(rho), Math.sin(rho)];
    const n: Point2D = [-Math.sin(rho), Math.cos(rho)];
    const ph = I.phi * TCF_DEG;
    const dR: Point2D = [
      Math.cos(ph) * n[0] + Math.sin(ph) * u[0],
      Math.cos(ph) * n[1] + Math.sin(ph) * u[1],
    ];
    const qp: Point2D = [g.A[0] + (C[0] - g.A[0]) * 0.45, g.A[1] + (C[1] - g.A[1]) * 0.45];
    D.lp(
      D.X(qp[0]),
      D.Y(qp[1]),
      D.X(qp[0]) - n[0] * 80,
      D.Y(qp[1]) + n[1] * 80,
      'stroke="#666" stroke-width="0.7" stroke-dasharray="4 3"',
    );
    const tr = D.arTo(qp, dR, 72, 'g', 2.2);
    D.tp(tr[0] + 6, tr[1] + 4, 'R', { fs: 12, b: true, c: 'g' });
    const a1 = Math.atan2(-n[1], -n[0]) / TCF_DEG;
    const a2 = Math.atan2(-dR[1], -dR[0]) / TCF_DEG;
    D.arc(qp, 44, Math.min(a1, a2), Math.max(a1, a2), `φ'f = ${tcfFmt(I.phi, 1)}°`, {
      c: 'g',
      tr: 20,
    });

    // Angles rho, theta, beta
    D.lp(
      D.X(g.A[0]),
      D.Y(g.A[1]),
      D.X(g.A[0]) + 120,
      D.Y(g.A[1]),
      'stroke="#666" stroke-width="0.7" stroke-dasharray="4 3"',
    );
    D.arc(g.A, 92, 0, rhoDeg, `ρ = ${tcfFmt(rhoDeg, 2)}°`, { c: 'o', tr: 26 });
    D.lp(
      D.X(g.A[0]),
      D.Y(g.A[1]),
      D.X(g.A[0]) - 60,
      D.Y(g.A[1]),
      'stroke="#666" stroke-width="0.7" stroke-dasharray="4 3"',
    );
    D.arc(g.A, 30, w.theta, 180, `θ = ${tcfFmt(180 - w.theta, 2)}°`, { c: 'k', tr: 14 });
    if (I.Hs > 1e-9) {
      D.lp(
        D.X(g.T[0]),
        D.Y(g.T[1]),
        D.X(g.T[0]) + 60,
        D.Y(g.T[1]),
        'stroke="#666" stroke-width="0.7" stroke-dasharray="3 2"',
      );
      const betaDeg = (Math.abs(I.m) > 1e-9 ? Math.atan(1 / I.m) : Math.PI / 2) / TCF_DEG;
      D.arc(g.T, 50, 0, betaDeg, `β = ${tcfFmt(betaDeg, 1)}°`, { tr: 22 });
    }

    D.dimV(g.A[1], pa[1], D.X(Math.min(g.A[0], g.T[0])) - 46, "H'/3", [g.A[0], pa[0]], { fs: 10 });
    D.t(g.A, 'A', { dx: 6, dy: 15, c: 'r', b: true });
    D.t(g.T, 'T', { dx: -16, dy: -4, c: 'r', b: true });
    D.t(C, 'E', { dx: 4, dy: -6, c: 'o', b: true });
    D.tp(
      46,
      D.H - 10,
      `Mặt trượt tới hạn AE: ρ = ${tcfFmt(rhoDeg, 2)}° ; H' = ${tcfFmt(g.Hp, 3)} m ; Ka = 2Pa/(γs.H'²) = ${tcfFmt(w.Ka, 4)}`,
      { fs: 11 },
    );
  });
}

/** Render gravity retaining wall unfactored earth/surcharge pressure diagram (`#dgTcP`). */
export function tcFigP(R: TcResult | null | undefined, target?: SvgTarget): string {
  if (!R || !R.g || !R.I || !R.Ld?.w0) {
    if (target === undefined || typeof target === 'string') {
      clearSvgElement(target ?? 'dgTcP');
    }
    return '';
  }
  return finalizeTcfSvg(target, 'dgTcP', 760, 480, (D) => {
    const I = R.I;
    const g = R.g;
    const Ld = R.Ld;
    const w = Ld.w0;
    const G = tcGndPts(R);
    const Hp = Math.max(g.Hp, 1e-9);
    const wLen = Math.max(w.L, 1e-9);

    const pa = (2 * w.P) / Hp;
    const pes = Ld.wq ? (Ld.wq.P - w.P) / Hp : 0;
    const pls = Ld.lsOn ? Ld.PLS / Hp : 0;
    const tot = pa + pes + pls;
    const k = 1.5 / Math.max(tot, 1e-9);
    const v: Point2D = [(g.T[0] - g.A[0]) / wLen, Hp / wLen];
    const n: Point2D = [v[1], -v[0]];
    const off = (p: Point2D, d: number): Point2D => [p[0] + n[0] * d * k, p[1] + n[1] * d * k];
    const xM = Math.max(off(g.A, tot)[0], off(g.T, pes + pls)[0], G[G.length - 1][0]) + 1.0;

    D.view(
      [-0.3, xM, -g.dy - 0.3, Math.max(g.yT, G[G.length - 1][1]) + (Ld.lsOn ? Ld.heq : 0) + 0.3],
      { x: 30, y: 30, w: 760 - 30 - 110, h: 480 - 30 - 36 },
    );
    D.title('BIỂU ĐỒ ÁP LỰC ĐẤT TÁC DỤNG LÊN TƯỜNG (CHƯA NHÂN HỆ SỐ)');
    tcDrawStruct(D, R, { light: true });
    D.gnd([g.T, ...G.slice(1), [xM, G[G.length - 1][1]]]);
    D.ln(g.A, g.T, `stroke="${TCF_COLORS.r}" stroke-width="2"`);
    D.poly([g.T, g.A, off(g.A, pa)], `fill="rgba(192,0,0,.16)" stroke="${TCF_COLORS.r}" stroke-width="1"`);

    if (pes > 0) {
      D.poly(
        [g.T, off(g.A, pa), off(g.A, pa + pes), off(g.T, pes)],
        `fill="rgba(192,96,0,.16)" stroke="${TCF_COLORS.o}" stroke-width="1"`,
      );
    }
    if (pls > 0) {
      D.poly(
        [off(g.T, pes), off(g.A, pa + pes), off(g.A, pa + pes + pls), off(g.T, pes + pls)],
        `fill="rgba(0,80,176,.14)" stroke="${TCF_COLORS.b}" stroke-width="1"`,
      );
    }
    if (Ld.lsOn) {
      const gT = G[G.length - 1][1];
      const x0 = g.T[0] + I.dT;
      D.poly(
        [
          [x0, gT],
          [xM, gT],
          [xM, gT + Ld.heq],
          [x0, gT + Ld.heq],
        ],
        `fill="rgba(0,80,176,.10)" stroke="${TCF_COLORS.b}" stroke-dasharray="5 3"`,
      );
      D.t([(x0 + xM) / 2, gT + Ld.heq / 2], `heq = ${tcfFmt(Ld.heq, 3)} m`, {
        a: 'middle',
        dy: 4,
        c: 'b',
        fs: 11,
      });
    }
    if (I.q > 0) {
      const gT = G[G.length - 1][1];
      D.t([xM - 0.1, gT], `q = ${tcfFmt(I.q, 1)} kPa`, { a: 'end', dy: -8, c: 'o', fs: 11 });
    }

    const p3: Point2D = [g.A[0] + (g.T[0] - g.A[0]) / 3, g.A[1] + Hp / 3];
    const p2: Point2D = [g.A[0] + (g.T[0] - g.A[0]) / 2, g.A[1] + Hp / 2];
    let t = D.arTo(p3, w.F, 80, 'r', 2.2);
    D.tp(t[0] + 4, t[1] + 14, `Pa = ${tcfFmt(w.P, 2)} kN`, { fs: 12, b: true, c: 'r' });
    let yy = 0;
    if (pes > 0) {
      t = D.arTo(p2, w.F, 80, 'o', 2);
      D.tp(t[0] + 4, t[1] - 6, `PES = ${tcfFmt(pes * Hp, 2)} kN`, { fs: 12, b: true, c: 'o' });
      yy = -16;
    }
    if (pls > 0) {
      t = D.arTo(p2, w.F, 80, 'b', 2);
      D.tp(t[0] + 4, t[1] - 6 + yy, `PLS = ${tcfFmt(Ld.PLS, 2)} kN`, { fs: 12, b: true, c: 'b' });
    }

    const pb = off(g.A, tot);
    const yv = D.Y(g.A[1]) + 18;
    D.tp(D.X(off(g.A, pa)[0]) + 4, yv, `pa = Ka.γs.H' = ${tcfFmt(pa, 2)} kPa`, {
      fs: 11,
      c: 'r',
    });
    if (pes > 0) {
      D.tp(D.X(pb[0]) + 4, D.Y(g.A[1]) - 12, `PES/H' = ${tcfFmt(pes, 2)} kPa`, {
        fs: 11,
        c: 'o',
      });
    }
    if (pls > 0) {
      D.tp(
        D.X(pb[0]) + 4,
        D.Y(g.A[1]) + (pes > 0 ? -28 : -12),
        Ld.lsW ? `PLS/H' = ${tcfFmt(pls, 2)} kPa` : `Ka.γs.heq = ${tcfFmt(pls, 2)} kPa`,
        { fs: 11, c: 'b' },
      );
    }

    const xd = D.X(xM) + 18;
    D.dimV(g.A[1], g.yT, xd, `H' = ${tcfFmt(g.Hp, 3)}`, [g.A[0], g.T[0]]);
    D.dimV(g.A[1], p3[1], xd + 28, `H'/3 = ${tcfFmt(g.Hp / 3, 3)}`, null, { fs: 10 });
    if (pes + pls > 0) {
      D.dimV(g.A[1], p2[1], xd + 56, `H'/2 = ${tcfFmt(g.Hp / 2, 3)}`, null, { fs: 10 });
    }
    D.tp(
      36,
      52,
      `Ka = ${tcfFmt(w.Ka, 4)} ; lực nghiêng góc δ = ${tcfFmt(I.delta, 1)}° so với pháp tuyến mặt phẳng AT`,
      { fs: 11 },
    );
    D.t(g.A, 'A', { dx: -14, dy: 14, c: 'r', b: true });
    D.t(g.T, 'T', { dx: -16, dy: -4, c: 'r', b: true });
  });
}

/** Render gravity retaining wall base resultant forces at centroid C (`#dgTcF`). */
export function tcFigF(R: TcResult | null | undefined, target?: SvgTarget): string {
  if (!R || !R.g || !R.I || !R.Ia) {
    if (target === undefined || typeof target === 'string') {
      clearSvgElement(target ?? 'dgTcF');
    }
    return '';
  }
  return finalizeTcfSvg(target, 'dgTcF', 760, 360, (D) => {
    const I = R.I;
    const g = R.g;
    const c = R.Ia;
    const e = g.eps;
    const yc = Math.min(g.yT, I.t1 + 0.7);
    const box0: [number, number, number, number] = [-0.8, g.B + 0.8, -g.dy - 1.3, yc + 0.9];

    const draw = (dx: number, part: 1 | 2): void => {
      D.view(box0, { x: dx, y: 44, w: 370, h: 360 - 44 - 20 });
      D.poly(
        [
          [-0.8, 0],
          [0, 0],
          [g.B, -g.dy],
          [g.B + 0.8, -g.dy],
          [g.B + 0.8, -g.dy - 0.35],
          [-0.8, -0.35],
        ],
        `fill="url(#${D.id}S)" stroke="none"`,
      );
      tcDrawStruct(D, R, { cutY: yc });
      const C = g.C0;
      D.dot(C, 'b');
      D.t(C, 'C', { dx: 6, dy: 16, c: 'b', b: true });
      if (part === 1) {
        let t = D.arTo(C, [0, -1], 80, 'k', 2.2);
        D.tp(t[0] + 5, t[1] + 12, `V = ${tcfFmt(c.V)} kN`, { fs: 12, b: true });
        t = D.arTo(C, [-1, 0], 80, 'r', 2.2);
        D.tp(t[0] - 4, t[1] - 6, `H = ${tcfFmt(c.H)} kN`, {
          fs: 12,
          b: true,
          c: 'r',
          a: 'end',
        });
        const ccw = c.M > 0;
        D.arc(C, 30, ccw ? 200 : 340, ccw ? 340 : 200, '', { c: 'm', w: 1.6, ar: true });
        D.t(C, `MC = ${tcfFmt(c.M)} kN.m`, {
          dx: -36,
          dy: 40,
          fs: 12,
          b: true,
          c: 'm',
          a: 'end',
        });
      } else {
        const n: Point2D = [-Math.sin(e), -Math.cos(e)];
        const u: Point2D = [Math.cos(e), -Math.sin(e)];
        let t = D.arTo(C, n, 90, 'b', 2.2);
        D.tp(t[0] + 8, t[1] - 2, `N' = ${tcfFmt(c.N)} kN`, { fs: 12, b: true, c: 'b' });
        t = D.arTo(C, [-u[0], -u[1]], 90, 'g', 2.2);
        D.tp(t[0] - 2, t[1] - 8, `H' = ${tcfFmt(c.Hd)} kN`, {
          fs: 12,
          b: true,
          c: 'g',
          a: 'end',
        });
        if (e > 1e-6) {
          D.lp(
            D.X(0),
            D.Y(0),
            D.X(0) + 60,
            D.Y(0),
            'stroke="#777" stroke-width="0.6" stroke-dasharray="3 2"',
          );
          D.arc([0, 0], 52, -e / TCF_DEG, 0, '');
          D.t([0, 0], `ε = ${tcfFmt(e / TCF_DEG, 2)}°`, {
            dx: 58,
            dy: -6,
            fs: 11,
            hc: '#d9d9d9',
          });
        }
      }
      D.dot([0, 0]);
      D.t([0, 0], 'O', { dx: -12, dy: 14, b: true });
    };

    draw(10, 1);
    draw(380, 2);
    D.title('LỰC TÁC DỤNG TẠI TÂM ĐÁY MÓNG C - TỔ HỢP CĐ I-a');
    D.tp(195, 40, 'a) Theo phương đứng, ngang', { a: 'middle', fs: 11, i: true });
    D.tp(565, 40, 'b) Theo phương pháp tuyến, tiếp tuyến đáy móng', {
      a: 'middle',
      fs: 11,
      i: true,
    });
    D.lp(378, 40, 378, 350, 'stroke="#bbb" stroke-width="0.8"');
  });
}

/** Render gravity retaining wall base eccentricity check diagram (`#dgTcE`). */
export function tcFigE(R: TcResult | null | undefined, target?: SvgTarget): string {
  if (!R || !R.g || !R.I || !R.Ia || !R.Ib) {
    if (target === undefined || typeof target === 'string') {
      clearSvgElement(target ?? 'dgTcE');
    }
    return '';
  }
  return finalizeTcfSvg(target, 'dgTcE', 760, 300, (D) => {
    const g = R.g;
    const Bs = g.Bs;
    const L = R.eLim;
    const I = R.I;
    D.view([-0.1 * Bs, 1.1 * Bs, 0, 1], { x: 60, y: 40, w: 640, h: 240 });
    D.title('VỊ TRÍ HỢP LỰC TRÊN ĐÁY MÓNG - KIỂM TOÁN ĐỘ LỆCH TÂM');
    const yb = 200;
    const X = D.X;
    const xc = Bs / 2;

    D.rp(
      X(Math.max(0, xc - L)),
      yb - 16,
      X(Math.min(Bs, xc + L)) - X(Math.max(0, xc - L)),
      16,
      'fill="rgba(27,122,42,.18)" stroke="none"',
    );
    D.rp(X(0), yb - 16, X(Bs) - X(0), 16, 'fill="none" stroke="#222" stroke-width="1.4"');
    D.rp(X(0), yb, X(Bs) - X(0), 12, `fill="url(#${D.id}S)" stroke="none"`);
    D.lp(
      X(xc),
      yb - 30,
      X(xc),
      yb + 6,
      'stroke="#222" stroke-width="0.8" stroke-dasharray="6 3 2 3"',
    );
    D.tp(X(xc), yb - 34, 'C', { a: 'middle', b: true, c: 'b' });
    [xc - Bs / 6, xc + Bs / 6].forEach((x) =>
      D.lp(X(x), yb - 22, X(x), yb, 'stroke="#666" stroke-width="0.8" stroke-dasharray="3 2"'),
    );
    [xc - L, xc + L].forEach((x) =>
      D.lp(X(x), yb - 26, X(x), yb + 4, `stroke="${TCF_COLORS.g}" stroke-width="1.6"`),
    );
    D.tp(X(0), yb + 28, 'Mũi móng (phía trước)', { fs: 11 });
    D.tp(X(Bs), yb + 28, 'Gót móng (phía đất đắp)', { fs: 11, a: 'end' });

    const combos: Array<[TcComboResult, 'r' | 'b', number]> = [
      [R.Ia, 'r', 120],
      [R.Ib, 'b', 80],
    ];
    combos.forEach(([c, cl, h]) => {
      const x = xc + c.s;
      D.arp(X(x), yb - h, X(x), yb - 17, cl, 2.2);
      D.tp(
        X(x) + 6,
        yb - h + 4,
        `${c.k === 'Ia' ? 'CĐ I-a' : 'CĐ I-b'}: N' = ${tcfFmt(c.N, 1)} kN ; e = ${tcfFmt(c.e, 3)} m ${c.okE ? '≤' : '>'} ${tcfFmt(L, 3)} m`,
        { fs: 11, c: cl, b: true },
      );
    });

    D.dimH(0, Bs, yb + 48, `B* = ${tcfFmt(Bs, 3)} m`);
    D.dimH(
      xc - L,
      xc + L,
      yb + 70,
      `vùng cho phép: ${I.rock ? '0,9B*' : '2B*/3'} (e ≤ ${I.rock ? '0,45B*' : 'B*/3'} = ${tcfFmt(L, 3)} m)`,
      null,
      { c: 'g' },
    );
    D.tp(X(xc + Bs / 6) + 3, yb - 24, 'lõi B*/6', { fs: 10, i: true });
  });
}

/** Render gravity retaining wall base sliding check diagram (`#dgTcS`). */
export function tcFigS(R: TcResult | null | undefined, target?: SvgTarget): string {
  if (!R || !R.g || !R.I || !R.Ia) {
    if (target === undefined || typeof target === 'string') {
      clearSvgElement(target ?? 'dgTcS');
    }
    return '';
  }
  return finalizeTcfSvg(target, 'dgTcS', 760, 330, (D) => {
    const I = R.I;
    const g = R.g;
    const c = R.Ia;
    const e = g.eps;
    const yc = Math.min(g.yT, I.t1 + 0.6);

    D.view([-1.0, g.B + 1.0, -g.dy - 1.2, yc + 0.7], {
      x: 40,
      y: 30,
      w: 680,
      h: 330 - 30 - 14,
    });
    D.title('SƠ ĐỒ KIỂM TOÁN TRƯỢT THEO ĐÁY MÓNG - TỔ HỢP CĐ I-a');
    D.poly(
      [
        [-1.0, 0],
        [0, 0],
        [g.B, -g.dy],
        [g.B + 1.0, -g.dy],
        [g.B + 1.0, -g.dy - 0.5],
        [-1.0, -0.5],
      ],
      `fill="url(#${D.id}S)" stroke="none"`,
    );
    tcDrawStruct(D, R, { cutY: yc });

    const C = g.C0;
    const n: Point2D = [-Math.sin(e), -Math.cos(e)];
    const u: Point2D = [Math.cos(e), -Math.sin(e)];
    let t = D.arTo(C, n, 80, 'b', 2.2);
    D.tp(t[0] + 6, t[1] + 12, `N' = ${tcfFmt(c.N)} kN`, { fs: 12, b: true, c: 'b' });

    const o = 14 / Math.max(D.sc, 1e-9);
    const pH: Point2D = [C[0] - n[0] * o, C[1] - n[1] * o];
    const pR: Point2D = [C[0] + n[0] * o, C[1] + n[1] * o];
    t = D.arTo(pH, [-u[0], -u[1]], 120, 'r', 2.4);
    D.tp(t[0] + 4, t[1] - 10, `H' = ${tcfFmt(c.Hd)} kN`, { fs: 12, b: true, c: 'r' });
    t = D.arTo(pR, u, 120, 'g', 2.4);
    D.tp(
      t[0] - 6,
      t[1] + 20,
      `RR = φτ.Rτ = ${tcfFmt(I.phit, 2)} × ${tcfFmt(c.sl.Rt)} = ${tcfFmt(c.sl.RR)} kN`,
      { fs: 12, b: true, c: 'g', a: 'end' },
    );

    D.dot(C, 'b');
    D.t(C, 'C', { dx: 8, dy: 22, c: 'b', b: true });
    D.tp(
      46,
      52,
      `Kiểm tra: H' = ${tcfFmt(c.Hd)} kN ${c.sl.ok ? '≤' : '>'} RR = ${tcfFmt(c.sl.RR)} kN → ${c.sl.ok ? 'Đạt' : 'Không đạt'}`,
      { fs: 12, b: true, c: c.sl.ok ? 'g' : 'r' },
    );
  });
}

/** Render gravity retaining wall base contact stress / effective width diagram (`#dgTcB`). */
export function tcFigB(R: TcResult | null | undefined, target?: SvgTarget): string {
  if (!R || !R.g || !R.I || !R.Ib) {
    if (target === undefined || typeof target === 'string') {
      clearSvgElement(target ?? 'dgTcB');
    }
    return '';
  }
  return finalizeTcfSvg(target, 'dgTcB', 760, 350, (D) => {
    const g = R.g;
    const c = R.Ib;
    const Bs = g.Bs;
    const Bp = Math.max(c.Bp, 0);

    if (R.I.rock) {
      D.title(
        'ỨNG SUẤT ĐÁY MÓNG TRÊN NỀN ĐÁ - PHÂN BỐ TUYẾN TÍNH (TCVN 11823-11, ĐIỀU 6.3.2) - TỔ HỢP CĐ I-b',
      );
      D.view([-0.12 * Bs, 1.12 * Bs, 0, 1], { x: 60, y: 40, w: 640, h: 250 });
      const X = D.X;
      const yb = 150;
      const xc = Bs / 2;
      const xr = xc + c.s;
      const toe = c.toToe;

      D.rp(X(0), yb - 46, X(Bs) - X(0), 46, 'fill="#d9d9d9" stroke="#222" stroke-width="1.4"');
      D.tp(X(xc), yb - 26, 'Đáy móng (theo phương nghiêng B*)', {
        a: 'middle',
        fs: 11,
        hc: '#d9d9d9',
      });
      D.rp(X(-0.1 * Bs), yb, X(1.1 * Bs) - X(-0.1 * Bs), 10, `fill="url(#${D.id}R)" stroke="none"`);
      D.arp(X(xr), yb - 104, X(xr), yb - 48, 'b', 2.4);
      D.tp(X(xr) + 6, yb - 90, `N' = ${tcfFmt(c.N)} kN`, { fs: 12, b: true, c: 'b' });

      const sMax = c.sigMax;
      const sMin = c.sigMin;
      const hs = (val: number): number => 8 + (70 * val) / Math.max(sMax, 1e-9);
      const Lc = c.e <= Bs / 6 ? Bs : 3 * (Bs / 2 - c.e);
      const xa = toe ? 0 : Bs;
      const xb = toe ? Lc : Bs - Lc;
      const xo = toe ? Bs : 0;
      const P: Point2D[] =
        c.e <= Bs / 6
          ? [
              [X(xa), yb],
              [X(xa), yb + hs(sMax)],
              [X(xo), yb + hs(sMin)],
              [X(xo), yb],
            ]
          : [
              [X(xa), yb],
              [X(xa), yb + hs(sMax)],
              [X(xb), yb],
            ];
      D.s += `<polygon points="${P.map((p) => p.map((val) => val.toFixed(1)).join(',')).join(' ')}" fill="rgba(192,0,0,.15)" stroke="${TCF_COLORS.r}" stroke-width="1"/>`;

      for (let k = 0; k <= 8; k++) {
        const t = k / 8;
        const x = c.e <= Bs / 6 ? xa + (xo - xa) * t : xa + (xb - xa) * t;
        const hv = c.e <= Bs / 6 ? hs(sMax) + (hs(sMin) - hs(sMax)) * t : hs(sMax) * (1 - t);
        if (hv > 6) D.arp(X(x), yb + hv, X(x), yb + 2, 'r', 1.1);
      }

      D.tp(X(xa) + (toe ? 4 : -4), yb + hs(sMax) + 16, `σmax = ${tcfFmt(sMax, 1)} kPa`, {
        fs: 12,
        b: true,
        c: 'r',
        a: toe ? 'start' : 'end',
      });
      if (c.e <= Bs / 6) {
        D.tp(X(xo) + (toe ? -4 : 4), yb + hs(sMin) + 16, `σmin = ${tcfFmt(sMin, 1)} kPa`, {
          fs: 12,
          b: true,
          c: 'r',
          a: toe ? 'end' : 'start',
        });
      }
      D.lp(
        X(xc),
        yb - 60,
        X(xc),
        yb + 4,
        'stroke="#222" stroke-width="0.8" stroke-dasharray="6 3 2 3"',
      );
      D.tp(X(xc), yb - 62, 'C', { a: 'middle', b: true, c: 'b', fs: 11 });
      D.dimH(Math.min(xc, xr), Math.max(xc, xr), yb - 112, `e = ${tcfFmt(c.e, 3)}`);
      D.dimH(0, Bs, yb + 120, `B* = ${tcfFmt(Bs, 3)} m`);
      if (c.e > Bs / 6) {
        D.dimH(Math.min(xa, xb), Math.max(xa, xb), yb + 100, `3(B*/2 − e) = ${tcfFmt(Lc, 3)} m`, null, {
          c: 'r',
        });
      }
      return;
    }

    D.title('ỨNG SUẤT ĐÁY MÓNG VÀ KÍCH THƯỚC CÓ HIỆU (TCVN 11823-10, ĐIỀU 6.3.1.1) - TỔ HỢP CĐ I-b');
    // a) Elevation (equivalent horizontal base)
    D.view([-0.15 * Bs, 1.15 * Bs, 0, 1], { x: 20, y: 40, w: 440, h: 250 });
    let X = D.X;
    const yb = 176;
    const xc = Bs / 2;
    const xr = xc + c.s;
    const z: [number, number] = c.toToe ? [0, Bp] : [Bs - Bp, Bs];

    D.rp(X(0), yb - 46, X(Bs) - X(0), 46, 'fill="#d9d9d9" stroke="#222" stroke-width="1.4"');
    D.tp(X(xc), yb - 26, 'Đáy móng (theo phương nghiêng B*)', {
      a: 'middle',
      fs: 11,
      hc: '#d9d9d9',
    });
    D.arp(X(xr), yb - 104, X(xr), yb - 48, 'b', 2.4);
    D.tp(X(xr) + 6, yb - 90, `N' = ${tcfFmt(c.N)} kN`, { fs: 12, b: true, c: 'b' });

    const h = Math.min(60, 24 + c.sigU / 5);
    D.rp(
      X(z[0]),
      yb,
      X(z[1]) - X(z[0]),
      h,
      `fill="rgba(192,0,0,.15)" stroke="${TCF_COLORS.r}" stroke-width="1"`,
    );
    const na = Math.max(3, Math.round((X(z[1]) - X(z[0])) / 28));
    for (let k = 0; k <= na; k++) {
      const x = X(z[0]) + ((X(z[1]) - X(z[0])) * k) / na;
      D.arp(x, yb + h, x, yb + 2, 'r', 1.1);
    }
    D.tp(X((z[0] + z[1]) / 2), yb + h + 16, `σV = N'/B' = ${tcfFmt(c.sigU, 2)} kPa`, {
      a: 'middle',
      fs: 12,
      b: true,
      c: 'r',
    });
    D.lp(
      X(xc),
      yb - 60,
      X(xc),
      yb + 4,
      'stroke="#222" stroke-width="0.8" stroke-dasharray="6 3 2 3"',
    );
    D.tp(X(xc), yb - 62, 'C', { a: 'middle', b: true, c: 'b', fs: 11 });
    D.dimH(Math.min(xc, xr), Math.max(xc, xr), yb - 112, `e = ${tcfFmt(c.e, 3)}`);
    D.dimH(0, Bs, yb + h + 44, `B* = ${tcfFmt(Bs, 3)} m`);
    D.dimH(z[0], z[1], yb + h + 70, `B' = B* − 2e = ${tcfFmt(Bp, 3)} m`, null, { c: 'r' });
    D.tp(240, 40, 'a) Mặt đứng', { a: 'middle', fs: 11, i: true });

    // b) Plan view
    D.view([-0.1 * Bs, 1.2 * Bs, -0.2, 1.0], { x: 480, y: 56, w: 270, h: 200 });
    X = D.X;
    const Y = D.Y;
    const Lb = 0.6;
    D.poly(
      [
        [0, 0],
        [Bs, 0],
        [Bs, Lb],
        [0, Lb],
      ],
      'fill="#f2f2f2" stroke="#222" stroke-width="1.2"',
    );
    D.poly(
      [
        [z[0], 0],
        [z[1], 0],
        [z[1], Lb],
        [z[0], Lb],
      ],
      `fill="rgba(192,0,0,.15)" stroke="${TCF_COLORS.r}" stroke-dasharray="5 3"`,
    );
    D.t([(z[0] + z[1]) / 2, Lb / 2], "B' × L", { a: 'middle', dy: 4, fs: 11, c: 'r', b: true });
    D.dimH(0, Bs, Y(Lb) - 12, `B* = ${tcfFmt(Bs, 3)}`);
    D.dimH(z[0], z[1], Y(0) + 18, `B' = ${tcfFmt(Bp, 3)}`, null, { c: 'r' });
    D.dimV(0, Lb, X(Bs) + 16, 'L = 1 m', null, { fs: 10 });
    D.tp(615, 40, 'b) Mặt bằng đáy móng', { a: 'middle', fs: 11, i: true });
    D.lp(470, 40, 470, 320, 'stroke="#bbb" stroke-width="0.8"');
  });
}

/** Render gravity retaining wall bamboo-pile soil reinforcement diagram (`#dgTcCt`). */
export function tcFigCt(R: TcResult | null | undefined, target?: SvgTarget): string {
  if (!R || !R.g || !R.I || !R.ok?.ct) {
    if (target === undefined || typeof target === 'string') {
      clearSvgElement(target ?? 'dgTcCt');
    }
    return '';
  }
  return finalizeTcfSvg(target, 'dgTcCt', 760, 340, (D) => {
    const I = R.I;
    const g = R.g;
    const n = Math.max(1, I.ctn);
    const k = Math.max(1, Math.round(Math.sqrt(n)));
    const a = 1 / k;

    D.title('BỐ TRÍ CỌC TRE GIA CỐ NỀN DƯỚI ĐÁY MÓNG');
    // a) Section view
    D.view([-0.5, g.B + 0.5, -g.dy - I.ctL - 0.3, I.t1 + 0.6], { x: 20, y: 40, w: 400, h: 280 });
    D.poly(
      [
        [-0.5, 0],
        [0, 0],
        [g.B, -g.dy],
        [g.B + 0.5, -g.dy],
        [g.B + 0.5, -g.dy - I.ctL - 0.3],
        [-0.5, -I.ctL - 0.3],
      ],
      `fill="url(#${D.id}S)" stroke="none"`,
    );
    tcDrawStruct(D, R, { cutY: Math.min(g.yT, I.t1 + 0.5) });
    const m = Math.max(2, Math.round(g.B / a));
    for (let i = 0; i <= m; i++) {
      const x = Math.min(g.B - 0.04, Math.max(0.04, (i * g.B) / m));
      const yt = g.base(x);
      D.ln(
        [x, yt],
        [x, yt - I.ctL],
        `stroke="#8b5a00" stroke-width="${Math.max(2, I.ctD * D.sc)}"`,
      );
    }
    D.dimV(-g.dy, -g.dy - I.ctL, D.X(g.B + 0.5) + 10, `Lc = ${tcfFmt(I.ctL)} m`);
    D.tp(220, 40, 'a) Mặt cắt ngang', { a: 'middle', fs: 11, i: true });

    // b) 1 m² plan grid
    D.view([-0.2, 1.25, -0.25, 1.1], { x: 450, y: 66, w: 300, h: 260 });
    D.poly(
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
      'fill="#fbf6ea" stroke="#222" stroke-width="1.2"',
    );
    for (let i = 0; i < k; i++) {
      for (let j = 0; j < k; j++) {
        const x = a / 2 + i * a;
        const y = a / 2 + j * a;
        D.s += `<circle cx="${D.X(x).toFixed(1)}" cy="${D.Y(y).toFixed(1)}" r="${Math.max(2.5, (I.ctD / 2) * D.sc).toFixed(1)}" fill="#c89640" stroke="#7a5000" stroke-width="0.8"/>`;
      }
    }
    D.dimH(0, 1, D.Y(1) - 12, '1,00 m');
    D.dimV(0, 1, D.X(0) - 14, '1,00 m');
    D.dimH(a / 2, a / 2 + a, D.Y(0) + 18, `a = ${tcfFmt(a, 2)} m`);
    D.tp(600, 40, `b) Mặt bằng 1 m²: n = ${tcfFmt(n, 0)} cọc/m², D = ${tcfFmt(I.ctD * 100, 0)} cm`, {
      a: 'middle',
      fs: 11,
      i: true,
    });
    D.lp(440, 40, 440, 330, 'stroke="#bbb" stroke-width="0.8"');
  });
}

/** Render gravity retaining wall stem check sections & internal forces (`#dgTcStm`). */
export function tcFigStm(R: TcResult | null | undefined, target?: SvgTarget): string {
  if (!R || !R.g || !Array.isArray(R.secs)) {
    if (target === undefined || typeof target === 'string') {
      clearSvgElement(target ?? 'dgTcStm');
    }
    return '';
  }
  return finalizeTcfSvg(target, 'dgTcStm', 760, 440, (D) => {
    const g = R.g;
    D.view([-0.6, g.B + 0.6, -g.dy - 0.2, g.yT + 0.3], {
      x: 20,
      y: 30,
      w: 400,
      h: 440 - 30 - 16,
    });
    D.title('VỊ TRÍ CÁC MẶT CẮT KIỂM TOÁN THÂN TƯỜNG VÀ NỘI LỰC (CĐ I-b)');
    tcDrawStruct(D, R);

    let yt = 70;
    R.secs.forEach((s, i) => {
      const a = g.xf(s.ys) - 0.35;
      const b = g.xb(s.ys) + 0.35;
      const xc = (g.xf(s.ys) + g.xb(s.ys)) / 2;
      const nm = String(i + 1);
      D.ln(
        [a, s.ys],
        [b, s.ys],
        `stroke="${TCF_COLORS.m}" stroke-width="1.3" stroke-dasharray="10 3 2 3"`,
      );
      D.t([a, s.ys], nm, { a: 'end', dx: -3, dy: 4, b: true, c: 'm' });
      D.t([b, s.ys], nm, { dx: 3, dy: 4, b: true, c: 'm' });
      D.dot([xc, s.ys], 'm', 2.5);
      D.arTo([xc, s.ys], [0, -1], 34, 'b', 1.6);
      D.arTo([xc, s.ys], [-1, 0], 34, 'r', 1.6);
      D.dimH(g.xf(s.ys), g.xb(s.ys), D.Y(s.ys) + 16, `h = ${tcfFmt(s.h, 2)}`, null, { fs: 10 });

      const F1 = s.Ib;
      const x0 = 440;
      D.tp(
        x0,
        yt,
        `Mặt cắt ${nm}-${nm}: ${i === 0 ? 'chân thân tường (đỉnh móng)' : 'giữa chiều cao thân tường'}`,
        { fs: 12, b: true, c: 'm' },
      );
      D.tp(x0 + 12, yt + 18, `cách đỉnh tường z = ${tcfFmt(s.z, 2)} m ; h = ${tcfFmt(s.h, 3)} m`, {
        fs: 11,
      });
      D.tp(
        x0 + 12,
        yt + 36,
        `N = ${tcfFmt(F1.N)} kN ; M = ${tcfFmt(F1.M)} kN.m ; Q = ${tcfFmt(F1.Q)} kN`,
        { fs: 11 },
      );
      D.tp(
        x0 + 12,
        yt + 54,
        `e0 = M/N = ${tcfFmt(F1.e0, 3)} m ; 0,9y = ${tcfFmt(0.9 * s.y, 3)} m`,
        { fs: 11 },
      );
      yt += 92;
    });

    D.tp(440, yt, 'Quy ước: N - lực dọc (nén), Q - lực cắt, M - mômen', { fs: 11, i: true });
    D.tp(440, yt + 16, 'đối với trọng tâm mặt cắt; tính cho phần tường phía trên mặt cắt.', {
      fs: 11,
      i: true,
    });
  });
}

/** Render gravity retaining wall footing cantilever diagram (`#dgTcFt`). */
export function tcFigFt(R: TcResult | null | undefined, target?: SvgTarget): string {
  if (!R || !R.g || !R.I || !R.Ib || !R.foot?.list) {
    if (target === undefined || typeof target === 'string') {
      clearSvgElement(target ?? 'dgTcFt');
    }
    return '';
  }
  return finalizeTcfSvg(target, 'dgTcFt', 760, 330, (D) => {
    const I = R.I;
    const g = R.g;
    const c = R.Ib;
    const e = g.eps;
    const ce = Math.cos(e);
    const Bp = Math.max(c.Bp, 0);
    const z: [number, number] = c.toToe ? [0, Bp] : [g.Bs - Bp, g.Bs];
    const yc = Math.min(g.yT, I.t1 + 0.6);

    D.view([-0.6, g.B + 0.6, -g.dy - 0.9, yc + 0.4], { x: 30, y: 36, w: 700, h: 330 - 36 - 40 });
    D.title('SƠ ĐỒ TÍNH BẢN MÓNG (CĐ I-b): CÔNG XÔN MŨI VÀ GÓT CHỊU PHẢN LỰC NỀN');
    tcDrawStruct(D, R, { cutY: yc });

    const nIn: Point2D = [Math.sin(e), Math.cos(e)];
    const na = Math.max(4, Math.round(((z[1] - z[0]) * D.sc) / 30));
    for (let k = 0; k <= na; k++) {
      const s = z[0] + ((z[1] - z[0]) * k) / na;
      const x = s * ce;
      const p: Point2D = [x, g.base(x)];
      D.arTo(p, nIn, 32, 'r', 1.1);
    }

    const p0: Point2D = [z[0] * ce, g.base(z[0] * ce)];
    const p1: Point2D = [z[1] * ce, g.base(z[1] * ce)];
    D.lp(
      D.X(p0[0]) - nIn[0] * 32,
      D.Y(p0[1]) + nIn[1] * 32,
      D.X(p1[0]) - nIn[0] * 32,
      D.Y(p1[1]) + nIn[1] * 32,
      `stroke="${TCF_COLORS.r}" stroke-width="1"`,
    );
    D.t(
      [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2],
      `σV = ${tcfFmt(R.foot.sig, 2)} kPa (trên B' = ${tcfFmt(Bp, 3)} m)`,
      { a: 'middle', dy: 50, fs: 12, b: true, c: 'r' },
    );

    R.foot.list.forEach((s, i) => {
      const yb = g.base(s.x);
      const nm = i === 0 ? 'I' : 'II';
      D.ln(
        [s.x, yb - 38 / Math.max(D.sc, 1e-9)],
        [s.x, I.t1 + 0.45],
        `stroke="${TCF_COLORS.m}" stroke-width="1.3" stroke-dasharray="10 3 2 3"`,
      );
      D.t([s.x, yb], `${nm}-${nm}`, { a: 'middle', dy: 50, b: true, c: 'm' });
      D.dimV(yb, I.t1, D.X(s.x) + (i === 0 ? -10 : 10), `t = ${tcfFmt(s.t, 2)}`, null, { fs: 10 });
      D.t([s.x, I.t1 + 0.45], `M = ${tcfFmt(s.M)} kN.m ; Q = ${tcfFmt(s.Q)} kN`, {
        a: i === 0 ? 'end' : 'start',
        dx: i === 0 ? -24 : 24,
        dy: -4,
        fs: 11,
        c: 'm',
      });
    });

    D.dimH(0, g.xfb, D.Y(I.t1) - 14, 'mũi', [I.t1, I.t1], { fs: 10 });
    D.dimH(g.xbb, g.B, D.Y(I.t1) - 14, 'gót', [I.t1, I.t1], { fs: 10 });
    D.dot([0, 0]);
    D.t([0, 0], 'O', { dx: -12, dy: 14, b: true });
  });
}

/** Render all 11 gravity retaining wall SVG diagrams (`#dgTcSec`..`#dgTcFt`). */
export function renderGravityWallVisuals(resultArg?: TcResult | null): GravityWallVisualResult {
  const R = resultArg ?? getLatestTcResult();
  if (!R || !R.g || !R.I) {
    return {
      sec: '',
      weight: '',
      coulomb: '',
      pressure: '',
      force: '',
      ecc: '',
      slide: '',
      bearing: '',
      bamboo: '',
      stem: '',
      foot: '',
      rendered: false,
    };
  }
  const runSafely = (fn: (res: TcResult) => string): string => {
    try {
      return fn(R);
    } catch (e) {
      console.error(fn.name, e);
      return '';
    }
  };
  return {
    sec: runSafely(tcFigSec),
    weight: runSafely(tcFigW),
    coulomb: runSafely(tcFigCoul),
    pressure: runSafely(tcFigP),
    force: runSafely(tcFigF),
    ecc: runSafely(tcFigE),
    slide: runSafely(tcFigS),
    bearing: runSafely(tcFigB),
    bamboo: runSafely(tcFigCt),
    stem: runSafely(tcFigStm),
    foot: runSafely(tcFigFt),
    rendered: true,
  };
}


// ---------------------------------------------------------------------------
// 6. Cantilever L-Shaped Retaining Wall (`TLF`) SVG Visuals (`09:1419-1800`)
// ---------------------------------------------------------------------------

function tlFigBox(R: TlResult, pad: number): [number, number, number, number] {
  const g = R.g;
  const I = R.I;
  const xs = [0, g.B, g.xbt + (I.Hs > 1e-9 ? I.m * I.Hs : 0)];
  const ys = [-(R.an ? I.aLr : 0), g.yT + Math.max(I.Hs, 0)];
  return [
    Math.min(...xs) - pad,
    Math.max(...xs, g.B + 0.6) + pad,
    Math.min(...ys) - pad,
    Math.max(...ys) + pad,
  ];
}

function tlFigGline(R: TlResult): Point2D[] {
  const g = R.g;
  const I = R.I;
  const P: Point2D[] = [[g.xbt, g.yT]];
  if (I.Hs > 1e-9) P.push([g.xbt + I.m * I.Hs, g.yT + I.Hs]);
  const xe = Math.max(g.B + 1.2, P[P.length - 1][0] + 0.8);
  P.push([xe, P[P.length - 1][1]]);
  return P;
}

function tlDrawBody(D: TcfPlotter, R: TlResult, o?: { deep?: number }): void {
  const opt = o ?? {};
  const g = R.g;
  const id = D.id;
  const I = R.I;
  const G = tlFigGline(R);

  // Backfill behind wall
  D.poly(
    [[g.xbb, I.hm], [g.xbt, g.yT], ...G.slice(1), [G[G.length - 1][0], 0], [g.B, 0], [g.B, I.hh]],
    `fill="url(#${id}S)" stroke="none"`,
  );
  D.gnd(G);

  // Foundation soil/rock
  const xl = -0.8;
  const xr = G[G.length - 1][0];
  const yb = -(opt.deep ?? 0.8);
  D.poly(
    [
      [xl, 0],
      [xr, 0],
      [xr, yb],
      [xl, yb],
    ],
    `fill="url(#${id}${I.rock ? 'R' : 'S'})" stroke="none"`,
  );
  D.ln([xl, 0], [xr, 0], 'stroke="#8a6d3b" stroke-width="1"');

  // Front fill
  if (I.hf > 1e-9) {
    const yf = I.ht + I.hf;
    D.poly(
      [
        [xl, 0],
        [0, 0],
        [0, I.ht],
        [g.xfb, I.hm],
        [g.xfb, Math.max(yf, I.hm)],
        [xl, yf],
      ],
      `fill="url(#${id}S)" stroke="none"`,
    );
    D.gnd([
      [xl, yf],
      [g.xfb, yf],
    ]);
  }

  D.poly(g.foot, 'fill="#d9d9d9" stroke="#222" stroke-width="1.4"');
  D.poly(g.stem, 'fill="#d9d9d9" stroke="#222" stroke-width="1.4"');
}

/** Render cantilever retaining wall cross-section & geometry (`#dgTlSec`). */
export function tlFigSec(R: TlResult | null | undefined, target?: SvgTarget): string {
  if (!R || !R.g || !R.I) {
    if (target === undefined || typeof target === 'string') {
      clearSvgElement(target ?? 'dgTlSec');
    }
    return '';
  }
  return finalizeTcfSvg(target, 'dgTlSec', 760, 620, (D) => {
    const g = R.g;
    const I = R.I;
    D.view(tlFigBox(R, 0.9), { x: 70, y: 40, w: 640, h: 520 });
    tlDrawBody(D, R, { deep: R.an ? I.aLr + 0.4 : 0.8 });

    // Pressure reference plane AT
    D.ln(g.A, g.T, 'stroke="#c00000" stroke-width="1.2" stroke-dasharray="7,4"');
    D.t(g.A, 'A', { dx: 6, dy: 14, b: true, c: 'r' });
    D.t(g.T, 'T', { dx: 6, dy: -6, b: true, c: 'r' });
    D.dot([0, 0]);
    D.t([0, 0], 'O', { dx: -14, dy: 14, b: true });
    D.dot(g.C0, 'b');
    D.t(g.C0, 'C', { dx: -4, dy: 16, b: true, c: 'b' });

    if (R.an && R.an.rows.length > 0) {
      R.an.rows.forEach((r) => {
        D.ln(
          [r.x, Math.min(I.aLc, I.hm - 0.05)],
          [r.x, -I.aLr],
          'stroke="#c06000" stroke-width="2.2"',
        );
      });
    }

    const Y0 = D.Y(0) + 26;
    const Y1 = Y0 + 22;
    D.dimH(0, g.xfb, Y0, `b1 = ${tcfFmt(I.b1)}`, [0, 0]);
    D.dimH(g.xfb, g.xbb, Y0, `tb = ${tcfFmt(g.tb)}`, [I.hm, I.hm]);
    D.dimH(g.xbb, g.B, Y0, `b4 = ${tcfFmt(I.b4)}`, [0, 0]);
    D.dimH(0, g.B, Y1, `B = ${tcfFmt(g.B)}`, [0, 0]);
    D.dimH(g.xft, g.xbt, D.Y(g.yT) - 14, `t = ${tcfFmt(I.t)}`, [g.yT, g.yT]);

    const XL = D.X(0) - 30;
    D.dimV(0, I.hm, XL, `hm = ${tcfFmt(I.hm)}`, [0, 0]);
    D.dimV(I.hm, g.yT, XL, `H = ${tcfFmt(I.H)}`, [g.xfb, g.xft]);
    D.dimV(0, g.Hp, D.X(g.B) + 28, `H' = ${tcfFmt(g.Hp, 3)}`, [g.B, g.B]);

    if (I.ht < I.hm - 1e-9) D.t([0, I.ht], `ht = ${tcfFmt(I.ht)}`, { dx: -8, dy: -6, a: 'end', fs: 11 });
    if (I.hh < I.hm - 1e-9) D.t([g.B, I.hh], `hh = ${tcfFmt(I.hh)}`, { dx: 8, dy: -6, fs: 11 });
    if (I.Hs > 1e-9) {
      D.t([g.xbt + (I.m * I.Hs) / 2, g.yT + I.Hs / 2], `1 : ${tcfFmt(I.m)}`, {
        dx: -10,
        dy: -8,
        a: 'end',
        fs: 11,
        i: true,
      });
    }
    if (R.an && R.an.rows.length > 0) {
      D.t([R.an.rows[0].x, -I.aLr / 2], `neo Φ${tcfFmt(I.ad, 0)}, Lr = ${tcfFmt(I.aLr)} m`, {
        dx: 8,
        fs: 11,
        c: 'o',
      });
    }
  });
}

/** Render cantilever retaining wall weight blocks DC & EV (`#dgTlW`). */
export function tlFigW(R: TlResult | null | undefined, target?: SvgTarget): string {
  if (!R || !R.g || !R.I || !R.Ld) {
    if (target === undefined || typeof target === 'string') {
      clearSvgElement(target ?? 'dgTlW');
    }
    return '';
  }
  return finalizeTcfSvg(target, 'dgTlW', 760, 420, (D) => {
    const g = R.g;
    D.view(tlFigBox(R, 0.5), { x: 60, y: 30, w: 640, h: 360 });
    D.poly(g.foot, 'fill="#e8e8e8" stroke="#222"');
    D.poly(g.stem, 'fill="#e8e8e8" stroke="#222"');
    if (g.ev.length > 0) {
      D.poly(g.ev, 'fill="#f3ead8" stroke="#8a6d3b" stroke-dasharray="5,3"');
    }
    const L = R.Ld.L.filter((l) => l.ty === 'DC' || l.ty === 'EV');
    L.forEach((l, i) => {
      D.num([l.x, l.y], String(i + 1), l.ty === 'EV' ? 'o' : 'k');
    });
    D.ln(g.A, g.T, 'stroke="#c00000" stroke-dasharray="7,4"');
  });
}

/** Render cantilever retaining wall horizontal earth & surcharge pressures (`#dgTlP`). */
export function tlFigP(R: TlResult | null | undefined, target?: SvgTarget): string {
  if (!R || !R.g || !R.I || !R.Ld?.w0 || !R.st?.w) {
    if (target === undefined || typeof target === 'string') {
      clearSvgElement(target ?? 'dgTlP');
    }
    return '';
  }
  return finalizeTcfSvg(target, 'dgTlP', 760, 460, (D) => {
    const g = R.g;
    const I = R.I;
    const Ld = R.Ld;
    const st = R.st;
    D.view([-0.6, g.B + 2.6, -0.4, g.yT + 0.6 + Math.max(0, I.Hs)], {
      x: 40,
      y: 30,
      w: 680,
      h: 400,
    });
    D.poly(g.foot, 'fill="#e8e8e8" stroke="#222"');
    D.poly(g.stem, 'fill="#e8e8e8" stroke="#222"');
    D.ln(g.A, g.T, 'stroke="#c00000" stroke-dasharray="7,4"');

    // Pressure diagram on virtual plane AT (horizontal component)
    const Hp = Math.max(g.Hp, 1e-9);
    const ph = (-Ld.w0.F[0] * 2) / Hp;
    const sc = 1.6 / Math.max(ph, 1e-6);
    D.poly(
      [
        [g.B, Hp],
        [g.B, 0],
        [g.B + ph * sc, 0],
      ],
      'fill="rgba(192,0,0,0.12)" stroke="#c00000"',
    );
    D.t([g.B + ph * sc, 0], `${tcfFmt(ph, 1)} kPa`, { dx: 4, dy: -4, c: 'r', fs: 11 });
    D.arTo([g.B, Hp / 3], [-1, 0], 60, 'r');
    D.t([g.B + 0.2, Hp / 3], `Pa,h = ${tcfFmt(-Ld.w0.F[0])}`, { dx: 8, dy: -6, c: 'r', fs: 11 });

    if (Ld.PLS > 0) {
      const pl = Ld.PLS / Hp;
      const x0 = g.B + ph * sc + 0.15;
      D.poly(
        [
          [x0, Hp],
          [x0, 0],
          [x0 + pl * sc, 0],
          [x0 + pl * sc, Hp],
        ],
        'fill="rgba(0,80,176,0.10)" stroke="#0050b0"',
      );
      D.t([g.B + ph * sc + 0.15 + pl * sc, Hp / 2], `LS: ${tcfFmt(pl, 2)} kPa`, {
        dx: 4,
        c: 'b',
        fs: 11,
      });
    }

    // Earth pressure on back face of stem
    const xb = g.xbb;
    const yb = g.yF;
    if (st.Hs > 1e-9) {
      const ps = (-st.w.F[0] * 2) / st.Hs;
      const s2 = 1.0 / Math.max(ps, 1e-6);
      D.poly(
        [
          [g.xbt, g.yT],
          [xb, yb],
          [xb + ps * s2, yb],
        ],
        'fill="rgba(138,43,226,0.10)" stroke="#8a2be2"',
      );
      D.t([xb + ps * s2, yb], `${tcfFmt(ps, 1)} kPa`, { dx: 4, dy: -6, c: 'm', fs: 11 });
    }
    D.t([g.xbb + 0.15, yb + st.Hs * 0.75], 'áp lực trên lưng tường đứng', {
      c: 'm',
      fs: 11,
      i: true,
    });
    D.t(g.T, 'mặt phẳng AT', { dx: 6, dy: -6, c: 'r', fs: 11, i: true });
  });
}

/** Render cantilever retaining wall base bearing pressure distributions (`#dgTlB`). */
export function tlFigB(R: TlResult | null | undefined, target?: SvgTarget): string {
  if (!R || !R.g || !R.I || !Array.isArray(R.C)) {
    if (target === undefined || typeof target === 'string') {
      clearSvgElement(target ?? 'dgTlB');
    }
    return '';
  }
  const S = R.C.filter((c) => !c.sd);
  if (S.length === 0) {
    if (target === undefined || typeof target === 'string') {
      clearSvgElement(target ?? 'dgTlB');
    }
    return '';
  }
  return finalizeTcfSvg(target, 'dgTlB', 760, 330, (D) => {
    const g = R.g;
    const I = R.I;
    D.view([-0.4, g.B + 0.4, -2.6, 0.9], { x: 50, y: 20, w: 660, h: 290 });
    D.rp(D.X(0), D.Y(I.hm), D.X(g.B) - D.X(0), D.Y(0) - D.Y(I.hm), 'fill="#e8e8e8" stroke="#222"');

    const qm = Math.max(...S.map((c) => tlPress(c.N, c.s, g.B).qmax), 1);
    const sc = 1.0 / qm;

    S.forEach((c, k) => {
      const p = tlPress(c.N, c.s, g.B);
      const y0 = -0.15 - k * 1.2;
      const P: Point2D[] = [];
      for (let i = 0; i <= 40; i++) {
        const x = (g.B * i) / 40;
        P.push([x, y0 - p.q(x) * sc]);
      }
      D.poly(
        [[0, y0], ...P, [g.B, y0]],
        `fill="${k ? 'rgba(0,80,176,0.12)' : 'rgba(192,0,0,0.12)'}" stroke="${k ? '#0050b0' : '#c00000'}"`,
      );
      D.t([0, y0 - p.q1 * sc], tcfFmt(p.q1, 1), {
        dx: -4,
        a: 'end',
        fs: 11,
        c: k ? 'b' : 'r',
      });
      D.t([g.B, y0 - p.q2 * sc], tcfFmt(p.q2, 1), { dx: 4, fs: 11, c: k ? 'b' : 'r' });
      D.t([g.B / 2, y0], `${c.k === 'Ia' ? 'CĐ I-a' : 'CĐ I-b'} (kPa)`, {
        dy: 14,
        a: 'middle',
        fs: 11,
      });
    });
  });
}

/** Render cantilever retaining wall rock-socketed anchor layout (`#dgTlAn`). */
export function tlFigAn(R: TlResult | null | undefined, target?: SvgTarget): string {
  if (!R || !R.g || !R.I || !R.an || R.an.rows.length === 0) {
    if (target === undefined || typeof target === 'string') {
      clearSvgElement(target ?? 'dgTlAn');
    }
    return '';
  }
  return finalizeTcfSvg(target, 'dgTlAn', 760, 360, (D) => {
    const g = R.g;
    const I = R.I;
    const rows = R.an!.rows;
    D.view([-0.5, g.B + 0.5, -I.aLr - 0.5, I.hm + 0.6], { x: 50, y: 20, w: 660, h: 320 });
    D.poly(
      [
        [-0.5, 0],
        [g.B + 0.5, 0],
        [g.B + 0.5, -I.aLr - 0.5],
        [-0.5, -I.aLr - 0.5],
      ],
      `fill="url(#${D.id}R)" stroke="none"`,
    );
    D.ln([-0.5, 0], [g.B + 0.5, 0], 'stroke="#8a6d3b"');
    D.poly(g.foot, 'fill="#e0e0e0" stroke="#222" stroke-width="1.3"');

    rows.forEach((r, i) => {
      const hw = I.aDh / 2000;
      D.poly(
        [
          [r.x - hw, 0],
          [r.x + hw, 0],
          [r.x + hw, -I.aLr],
          [r.x - hw, -I.aLr],
        ],
        'fill="#bdbdbd" stroke="#666"',
      );
      D.ln(
        [r.x, I.aLc > 0 ? Math.min(I.aLc, I.hm - 0.05) : 0],
        [r.x, -I.aLr],
        'stroke="#c06000" stroke-width="2.4"',
      );
      D.dimH(0, r.x, D.Y(I.hm) - 14 - 16 * i, `x = ${tcfFmt(r.x)}`, [I.hm, I.hm], { fs: 10 });
    });

    const r0 = rows[0];
    D.dimV(-I.aLr, 0, D.X(r0.x) - 34, `Lr = ${tcfFmt(I.aLr)}`, [r0.x, r0.x], { fs: 10 });
    D.dimV(0, Math.min(I.aLc, I.hm), D.X(r0.x) + 30, `La = ${tcfFmt(I.aLc)}`, [r0.x, r0.x], {
      fs: 10,
    });
    D.t([r0.x, -I.aLr / 2], `Φ${tcfFmt(I.ad, 0)} trong lỗ khoan D${tcfFmt(I.aDh, 0)}`, {
      dx: 12,
      fs: 11,
      c: 'o',
    });
  });
}

/** Render cantilever retaining wall reinforcement & critical sections (`#dgTlRC`). */
export function tlFigRC(R: TlResult | null | undefined, target?: SvgTarget): string {
  if (!R || !R.g || !R.I) {
    if (target === undefined || typeof target === 'string') {
      clearSvgElement(target ?? 'dgTlRC');
    }
    return '';
  }
  return finalizeTcfSvg(target, 'dgTlRC', 760, 440, (D) => {
    const g = R.g;
    const I = R.I;
    D.view([-0.5, g.B + 0.5, -0.5, g.yT + 0.4], { x: 50, y: 20, w: 660, h: 400 });
    D.poly(g.foot, 'fill="#efefef" stroke="#222"');
    D.poly(g.stem, 'fill="#efefef" stroke="#222"');

    const c = I.cov / 1000;
    const cb = I.covB / 1000;
    D.pl(
      [
        [g.xbb - c, g.yT - c],
        [g.xbb - c, cb + 0.03],
        [g.B - c, cb + 0.03],
      ],
      'stroke="#c00000" stroke-width="1.6"',
    );
    D.pl(
      [
        [g.xft + c, g.yT - c],
        [g.xfb + c, cb + 0.03],
        [c, cb + 0.03],
      ],
      'stroke="#0050b0" stroke-width="1.4"',
    );
    D.pl(
      [
        [c, cb],
        [g.B - c, cb],
      ],
      'stroke="#0050b0" stroke-width="1.6"',
    );
    D.pl(
      [
        [c, I.ht - c],
        [g.xfb, I.hm - c],
        [g.xbb, I.hm - c],
        [g.B - c, I.hh - c],
      ],
      'stroke="#c00000" stroke-width="1.6"',
    );

    const cut = (a: Point2D, b: Point2D, t: string): void => {
      D.ln(a, b, 'stroke="#1b7a2a" stroke-width="1.2" stroke-dasharray="8,3,2,3"');
      D.t(a, t, { dx: -6, dy: 4, a: 'end', b: true, c: 'g' });
      D.t(b, t, { dx: 6, dy: 4, b: true, c: 'g' });
    };
    cut([g.xfb - 0.25, g.yF], [g.xbb + 0.25, g.yF], '1');
    cut([g.xfb, -0.25], [g.xfb, I.hm + 0.25], '2');
    cut([g.xbb, -0.25], [g.xbb, I.hm + 0.25], '3');

    D.t([g.xbb, g.yF + I.H * 0.55], `Φ${tcfFmt(I.sbd, 0)} a ${tcfFmt(I.sbs, 0)}`, {
      dx: 8,
      c: 'r',
      fs: 11,
    });
    D.t([g.xfb, g.yF + I.H * 0.55], `Φ${tcfFmt(I.sfd, 0)} a ${tcfFmt(I.sfs, 0)}`, {
      dx: -8,
      a: 'end',
      c: 'b',
      fs: 11,
    });
    D.t([(g.xbb + g.B) / 2, I.hm], `Φ${tcfFmt(I.ftd, 0)} a ${tcfFmt(I.fts, 0)}`, {
      dy: -8,
      a: 'middle',
      c: 'r',
      fs: 11,
    });
    D.t([g.xfb / 2, 0], `Φ${tcfFmt(I.fbd, 0)} a ${tcfFmt(I.fbs, 0)}`, {
      dy: 16,
      a: 'middle',
      c: 'b',
      fs: 11,
    });
  });
}

/** Render all 6 cantilever L-shaped retaining wall SVG diagrams (`#dgTlSec`..`#dgTlRC`). */
export function renderCantileverWallVisuals(
  resultArg?: TlResult | null,
): CantileverWallVisualResult {
  const R = resultArg ?? getLatestTlResult();
  if (!R || !R.g || !R.I) {
    return {
      sec: '',
      weight: '',
      pressure: '',
      bearing: '',
      anchor: '',
      rc: '',
      rendered: false,
    };
  }
  const runSafely = (fn: (res: TlResult) => string): string => {
    try {
      return fn(R);
    } catch (e) {
      console.error(fn.name, e);
      return '';
    }
  };
  return {
    sec: runSafely(tlFigSec),
    weight: runSafely(tlFigW),
    pressure: runSafely(tlFigP),
    bearing: runSafely(tlFigB),
    anchor: runSafely(tlFigAn),
    rc: runSafely(tlFigRC),
    rendered: true,
  };
}

// ---------------------------------------------------------------------------
// 7. VisualReportHooks Bundle & Registration
// ---------------------------------------------------------------------------

/** Build partial `VisualReportHooks` covering culverts, retaining walls, and TeX math. */
export function getCulvertWallReportHooks(): Partial<VisualReportHooks> {
  return {
    renderMath: () => {
      mathAll();
    },
    renderBoxCulvert: ({ result }) => {
      renderBoxCulvertVisuals((result as ChResult | null | undefined) ?? getLatestChResult());
    },
    renderChn: ({ result }) => {
      renderChnVisuals((result as ChnResult | null | undefined) ?? getLatestChnResult());
    },
    renderPipeCulvert: ({ result }) => {
      renderPipeCulvertVisuals((result as CtResult | null | undefined) ?? getLatestCtResult());
    },
    renderGravityWall: ({ result }) => {
      renderGravityWallVisuals((result as TcResult | null | undefined) ?? getLatestTcResult());
    },
    renderCantileverWall: ({ result }) => {
      renderCantileverWallVisuals((result as TlResult | null | undefined) ?? getLatestTlResult());
    },
  };
}

/** Register culvert & retaining wall SVG visual render hooks into `src/engine/context.ts`. */
export function registerCulvertWallVisualHooks(): void {
  registerVisualHooks(getCulvertWallReportHooks());
}
