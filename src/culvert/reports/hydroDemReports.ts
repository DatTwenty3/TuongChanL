/**
 * Clean-Room Hydrology & Offline DEM Visual Report Generators & Hook Registration
 *
 * Verbatim TypeScript port of SVG / Canvas visual generators from:
 * - `analysis-cau-cong/modules/15_bridge_hydrology_data_and_calc.js`:
 *   `hvLab`, `erfHv`, `hvFigFq`, `hvFigHQ`, `hvFigMC`, `hvFigSec`, `hvStMap`
 * - `analysis-cau-cong/modules/16_dem_watershed_ocr_dxf_import.js`:
 *   offline DEM / watershed canvas & SVG preview (`hdDraw`, `hvLV`, `hdDxfPreviewSvg`)
 * - `analysis-cau-cong/modules/17_culvert_hydrology_and_dxftools.js`:
 *   `tvcFig`, `tvcMap`
 *
 * Bridges `VisualReportHooks` in `src/engine/context.ts` for both `'bridge'` (`#tab54`)
 * and `'culvert'` (`#tab70`) hydrology workflows while guarding all DOM / `<canvas>`
 * APIs safely for headless Node & `jsdom` execution.
 */

import {
  fx,
  getContextValue,
  registerVisualHooks,
  setOutputValue,
  type VisualReportHooks,
} from '../engine/context.ts';
import type { DemSourceKind, Point2D } from '../types/project.ts';
import {
  DGSTY,
  dgKit,
  dgPut,
  hvDimV,
  hvFrame,
  hvGround,
  hvHatch,
  hvWater,
  type DgKitInstance,
} from '../graphics/svgPrimitives.ts';
import { hdDxfPreviewSvg } from '../graphics/cadDxfExport.ts';
import {
  HV,
  getLatestHvResult,
  hvCapNum,
  hvCoef,
  hvF,
  hvStRows,
  type HvCalcResult,
  type HvInput,
  type HvStRowEntry,
  type HvStRowsResult,
} from '../engine/hydrology/bridgeHydro.ts';
import { HVMAP } from '../engine/hydrology/stationsDb.ts';
import {
  HDSRC,
  HVD,
  hdDraw,
  hvLV,
  type HvdRunResult,
} from '../engine/hydrology/demWatershed.ts';
import {
  getLatestTvcResult,
  tvmGeo,
  tvxContours,
  type TvcCalcResult,
  type TvcCulvertOutcome,
  type TvxSavedGeo,
} from '../engine/hydrology/culvertHydro.ts';

// ---------------------------------------------------------------------------
// 1. Internal Safe DOM, Formatting & Collision Helpers
// ---------------------------------------------------------------------------

interface LabelBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface AbutSketch {
  k: number;
  s: number;
  x: number;
  zg: number;
  xt: number;
  wall?: [number, number, number, number];
  cap?: [number, number, number, number];
  bw: [number, number, number, number];
  foot?: [number, number, number, number];
  piles: number[];
  pb: number;
}

interface PierSketch {
  x: number;
  a: number;
  D: number;
  cap: [number, number, number, number];
  shaft?: [number, number, number, number];
  foot?: [number, number, number, number];
  piles: number[];
  pb: number;
}

function escSvg(raw: string | number | null | undefined): string {
  return String(raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getRealElement(id: string): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.getElementById(id);
}

function resolveRealSvg(
  target: SVGElement | string | null | undefined,
  defaultId: string,
): SVGElement | null {
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

// ---------------------------------------------------------------------------
// 2. Bridge Hydrology Mathematical & Label Helpers (`erfHv`, `hvLab`)
// ---------------------------------------------------------------------------

/** Error function approximation used for normal-probability grid plotting (`15` line 5722). */
export function erfHv(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-x * x);
  return x >= 0 ? y : -y;
}

/** Collision-avoiding boxed label placement helper for hydrology SVG figures (`15` line 5610). */
export function hvLab(
  d: DgKitInstance,
  boxes: LabelBox[],
  x: number,
  y: number,
  t: string,
  anc?: string,
  col?: string,
  fs?: number,
): number {
  const fontSize = fs || 11;
  const w = t.length * fontSize * 0.56 + 6;
  const h = fontSize + 4;
  const x0 = anc === 'end' ? x - w : anc === 'middle' ? x - w / 2 : x;
  let yy = y;
  for (let k = 0; k < 12; k++) {
    const hit = boxes.find(
      (b) => x0 < b.x + b.w && x0 + w > b.x && yy - h + 3 < b.y + 3 && yy + 3 > b.y - b.h + 3,
    );
    if (!hit) break;
    yy = hit.y - hit.h - 1;
  }
  boxes.push({ x: x0, y: yy, w, h });
  d.s += `<rect x="${(x0 - 1).toFixed(1)}" y="${(yy - h + 4).toFixed(1)}" width="${w.toFixed(1)}" height="${h}" fill="#fff" opacity="0.85"/>`;
  d.T(x, yy, escSvg(t), anc, `class="s"${col ? ` style="fill:${col}"` : ''}`);
  return yy;
}

// ---------------------------------------------------------------------------
// 3. Bridge Hydrology Frequency, Rating, Cross-Section & Scour SVGs
// ---------------------------------------------------------------------------

/** Plot daily rainfall frequency curve on normal-quantile probability paper (`#hv_dgFq`). */
export function hvFigFq(
  R: HvCalcResult | null | undefined,
  target?: SVGElement | string | null,
): string {
  if (!R || typeof R.Hp !== 'function') {
    if (target === undefined) clearSvgElement('hv_dgFq');
    return '';
  }
  const sv = resolveRealSvg(target, 'hv_dgFq');
  const id = 'hvFq';
  const d = dgKit(id);
  const W = 760;
  const Hh = 470;
  const x0 = 62;
  const x1 = W - 14;
  const y0 = 420;
  const y1 = 44;

  const zP = (P: number): number => HV.nInv(1 - P / 100);
  const zl = zP(0.01);
  const zr = zP(99.99);
  const X = (P: number): number => x0 + ((zP(P) - zl) / (zr - zl)) * (x1 - x0);

  const pts = (R.st?.emp ?? []).filter(
    (p): p is { y: number; x: number; P: number } =>
      p.P != null && Number.isFinite(p.P) && Number.isFinite(p.x),
  );
  const hp01 = R.Hp(0.01);
  const hp99 = R.Hp(99.99);
  const vmax = Math.max(
    Number.isFinite(hp01) ? hp01 : 0,
    ...pts.map((p) => p.x),
  );
  const vminRaw = Math.min(
    Number.isFinite(hp99) ? hp99 : vmax,
    ...pts.map((p) => p.x),
  );
  const vmin = Number.isFinite(vminRaw) ? vminRaw : 0;
  const bot = Math.max(0, Math.floor(vmin / 10) * 10);
  const top = Math.max(bot + 50, bot + Math.ceil((vmax - bot) / 50) * 50);
  const Y = (v: number): number => y0 - ((v - bot) / (top - bot)) * (y0 - y1);

  const minor: number[] = [];
  const bands: ReadonlyArray<readonly [number, number, number]> = [
    [0.01, 0.1, 0.01],
    [0.1, 1, 0.1],
    [1, 10, 0.5],
    [10, 90, 1],
    [90, 99, 0.5],
    [99, 99.9, 0.1],
    [99.9, 99.99, 0.01],
  ];
  for (const [a, b, s] of bands) {
    for (let p = a; p < b - 1e-9; p += s) minor.push(+p.toFixed(4));
  }
  for (const P of minor) {
    d.s += `<line x1="${X(P).toFixed(1)}" y1="${y1}" x2="${X(P).toFixed(1)}" y2="${y0}" stroke="#c8c8c8" stroke-width="0.4"/>`;
  }
  for (let v = bot; v <= top + 1e-9; v += 10) {
    const isMaj = (v - bot) % 50 === 0;
    d.s += `<line x1="${x0}" y1="${Y(v).toFixed(1)}" x2="${x1}" y2="${Y(v).toFixed(1)}" stroke="${isMaj ? '#808080' : '#c8c8c8'}" stroke-width="${isMaj ? 0.8 : 0.4}"/>`;
  }
  const maj = [0.01, 0.1, 1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 99, 99.9, 99.99];
  for (const P of maj) {
    d.s += `<line x1="${X(P).toFixed(1)}" y1="${y1}" x2="${X(P).toFixed(1)}" y2="${y0}" stroke="#808080" stroke-width="0.8"/>`;
    d.T(X(P), y0 + 14, String(P).replace('.', ','), 'middle', 'class="s"');
  }
  for (let v = bot; v <= top + 1e-9; v += 50) {
    d.T(x0 - 5, Y(v) + 4, String(v), 'end', 'class="s"');
  }
  d.s += `<rect x="${x0}" y="${y1}" width="${x1 - x0}" height="${y0 - y1}" fill="none" stroke="#404040" stroke-width="1"/>`;
  d.T(
    (x0 + x1) / 2,
    y1 - 12,
    `ĐƯỜNG TẦN SUẤT LƯỢNG MƯA 1 NGÀY LỚN NHẤT - TRẠM ${escSvg(String(R.I?.st || '').toUpperCase())}`,
    'middle',
    'style="font-size:12px"',
  );
  d.T((x0 + x1) / 2, y0 + 34, 'Tần suất, P(%)', 'middle', 'class="s"');
  d.T(
    16,
    (y0 + y1) / 2,
    'Lượng mưa, mm',
    'middle',
    `class="s" transform="rotate(-90 16 ${(y0 + y1) / 2})"`,
  );

  let pl = '';
  for (let k = 0; k <= 160; k++) {
    const z = zl + ((zr - zl) * k) / 160;
    const P = (1 - 0.5 * (1 + erfHv(z / Math.SQRT2))) * 100;
    const val = R.Hp(P);
    if (Number.isFinite(val)) {
      pl += (pl ? 'L' : 'M') + X(P).toFixed(1) + ',' + Y(val).toFixed(1);
    }
  }
  if (pl) {
    d.s += `<path d="${pl}" fill="none" stroke="#ff00ff" stroke-width="1.4"/>`;
  }
  for (const p of pts) {
    d.s += `<circle cx="${X(p.P).toFixed(1)}" cy="${Y(p.x).toFixed(1)}" r="2.6" fill="#ffc000" stroke="#c55a11" stroke-width="0.6"/>`;
  }

  const lx = x1 - 250;
  const ly = y1 + 10;
  const par = `TB=${fx(R.Xm, 2)}, Cv=${fx(R.Cv, 2)}, Cs=${fx(R.Cs, 2)}`;
  const par0 = R.st ? `TB=${fx(R.st.mean, 2)}, Cv=${fx(R.st.Cv, 2)}, Cs=${fx(R.st.Cs, 2)}` : par;
  d.s += `<rect x="${lx}" y="${ly}" width="242" height="62" fill="#fff" stroke="#404040" stroke-width="0.8"/>`;
  if (pts.length) {
    d.s += `<circle cx="${lx + 20}" cy="${ly + 14}" r="2.6" fill="#ffc000" stroke="#c55a11" stroke-width="0.6"/>`;
    d.T(lx + 44, ly + 17, 'Đường tần suất kinh nghiệm', 'start', 'class="s"');
    d.T(lx + 44, ly + 30, par0, 'start', 'class="s"');
  }
  d.s += `<line x1="${lx + 8}" y1="${ly + 41}" x2="${lx + 36}" y2="${ly + 41}" stroke="#ff00ff" stroke-width="1.4"/>`;
  d.T(
    lx + 44,
    ly + 44,
    'Đường tần suất lý luận (' + (R.dist === 'km' ? 'Kritski - Menkel' : 'Pearson III') + ')',
    'start',
    'class="s"',
  );
  d.T(lx + 44, ly + 57, par, 'start', 'class="s"');

  const svg = dgPut(sv, W, Hh, d.s, id);
  if (target === undefined) setOutputValue('hv_dgFq', svg);
  return svg;
}

/** Plot stage-discharge rating curve H = f(Q) (`#hv_dgHQ`). */
export function hvFigHQ(
  R: HvCalcResult | null | undefined,
  target?: SVGElement | string | null,
): string {
  const hq = R?.HQ ?? [];
  if (!R || !hq.length) {
    if (target === undefined) clearSvgElement('hv_dgHQ');
    return '';
  }
  const sv = resolveRealSvg(target, 'hv_dgHQ');
  const id = 'hvHQ';
  const d = dgKit(id);
  const W = 760;
  const Hh = 360;
  const x0 = 70;
  const x1 = W - 30;
  const y0 = 310;
  const y1 = 70;
  const bx: LabelBox[] = [];

  const qRawMax = Math.max(
    ...hq.map((o) => o.Q),
    ...R.Ps.map((P) => R.Q[P]?.Q ?? 0),
    ...R.hist.map((h) => h.Q),
  );
  const qm = qRawMax > 0 && Number.isFinite(qRawMax) ? qRawMax * 1.05 : 1;
  const hmin = R.S.zmin;
  const hmaxRaw = Math.max(...hq.map((o) => o.H), ...R.hist.map((h) => h.h));
  const spanH = hmaxRaw - hmin > 1e-6 ? hmaxRaw - hmin : 1;
  const hmax = hmin + spanH;

  const X = (q: number): number => x0 + (q / qm) * (x1 - x0);
  const Y = (h: number): number => y0 - ((h - hmin) / spanH) * (y0 - y1);
  const st = qm > 400 ? 100 : qm > 200 ? 50 : qm > 80 ? 20 : 10;

  for (let q = 0; q <= qm; q += st) {
    d.L(X(q), y0, X(q), y1, 'g');
    d.T(X(q), y0 + 15, String(q), 'middle', 'class="s"');
  }
  for (let h = Math.ceil(hmin * 2) / 2; h <= hmax + 1e-9; h += 0.5) {
    d.L(x0, Y(h), x1, Y(h), 'g');
    d.T(x0 - 6, Y(h) + 4, fx(h, 1), 'end', 'class="s"');
  }
  d.L(x0, y0, x1, y0);
  d.L(x0, y0, x0, 20);
  d.T((x0 + x1) / 2, y0 + 32, 'Q (m³/s)');
  d.T(16, (y0 + y1) / 2, 'H (m)', 'middle', `transform="rotate(-90 16 ${(y0 + y1) / 2})"`);

  let pl = '';
  for (let k = 0; k <= 80; k++) {
    const h = hmin + 0.02 + ((hmax - hmin - 0.02) * k) / 80;
    pl += (k ? 'L' : 'M') + X(R.S.at(h).Q).toFixed(1) + ',' + Y(h).toFixed(1);
  }
  d.s += `<path d="${pl}" fill="none" stroke="#1f4e79" stroke-width="1.6"/>`;
  for (const o of hq.filter((pt) => pt.Q > 0)) {
    d.s += `<circle cx="${X(o.Q).toFixed(1)}" cy="${Y(o.H).toFixed(1)}" r="3" fill="#fff" stroke="#1f4e79" stroke-width="1.2"/>`;
  }

  const ft = R.fitHQ;
  if (ft) {
    let tl = '';
    for (let k = 0; k <= 60; k++) {
      const q = ft.x1 + ((ft.x2 - ft.x1) * k) / 60;
      tl += (k ? 'L' : 'M') + X(q).toFixed(1) + ',' + Y(ft.f(q)).toFixed(1);
    }
    d.s += `<path d="${tl}" fill="none" stroke="#000" stroke-width="1.2" stroke-dasharray="6 3"/>`;
    const eq = `H = ${hvCoef(ft.a)}.Q² ${ft.b < 0 ? '-' : '+'} ${hvCoef(Math.abs(ft.b))}.Q ${ft.c < 0 ? '-' : '+'} ${hvCoef(Math.abs(ft.c))}`;
    const r2 = `R² = ${ft.R2.toFixed(4)}`;
    const bw = Math.max(eq.length, r2.length) * 6.4 + 16;
    d.s += `<rect x="${(x1 - bw - 10).toFixed(1)}" y="${y0 - 62}" width="${bw.toFixed(1)}" height="44" fill="#fff" stroke="#808080" stroke-width="0.6"/>`;
    d.T(x1 - bw - 2, y0 - 44, eq, 'start', 'class="s"');
    d.T(x1 - bw - 2, y0 - 26, r2, 'start', 'class="s"');
  }

  const mk: Array<{ q: number; h: number; t: string; c: string; sq: 0 | 1 }> = [];
  for (const P of R.Ps) {
    const qp = R.Q[P]?.Q;
    const hp = R.H[P];
    if (qp == null || hp == null) continue;
    mk.push({
      q: qp,
      h: hp,
      t: `P = ${String(P).replace('.', ',')}%: Q = ${fx(qp, 1)} ; H = ${fx(hp, 2)}`,
      c: '#c00000',
      sq: 0,
    });
  }
  for (const h of R.hist) {
    mk.push({
      q: h.Q,
      h: h.h,
      t: `Lũ ${h.y}: H = ${fx(h.h, 2)} ; Q = ${fx(h.Q, 1)}`,
      c: '#548235',
      sq: 1,
    });
  }
  for (const m of mk) {
    d.s += m.sq
      ? `<rect x="${(X(m.q) - 3).toFixed(1)}" y="${(Y(m.h) - 3).toFixed(1)}" width="6" height="6" fill="${m.c}"/>`
      : `<circle cx="${X(m.q).toFixed(1)}" cy="${Y(m.h).toFixed(1)}" r="3.5" fill="${m.c}"/>`;
  }
  mk.sort((a, b) => a.h - b.h);
  for (const m of mk) {
    const yy = hvLab(d, bx, X(m.q) - 14, Y(m.h) - 8, m.t, 'end', m.c);
    d.L(X(m.q), Y(m.h), X(m.q) - 12, yy - 4, 't');
  }

  const svg = dgPut(sv, W, Hh, d.s, id);
  if (target === undefined) setOutputValue('hv_dgHQ', svg);
  return svg;
}

/** Plot natural river cross-section & design flood levels at the bridge axis (`#hv_dgMC`). */
export function hvFigMC(
  R: HvCalcResult | null | undefined,
  target?: SVGElement | string | null,
): string {
  const pts = R?.S?.pts;
  if (!R || !pts?.length) {
    if (target === undefined) clearSvgElement('hv_dgMC');
    return '';
  }
  const sv = resolveRealSvg(target, 'hv_dgMC');
  const id = 'hvMC';
  const d = dgKit(id);
  const W = 760;
  const I = R.I;
  const S = R.S;
  const p = pts.slice().sort((a, b) => a[0] - b[0]);
  const bx: LabelBox[] = [];
  const xmin = p[0][0];
  const xmax = p[p.length - 1][0];
  const lv = [
    ...R.Ps.map((P) => R.H[P]).filter((v): v is number => Number.isFinite(v)),
    ...R.hist.map((h) => h.h),
    ...(Number.isFinite(I.MNHT) ? [I.MNHT] : []),
  ];
  const zhi = Math.ceil(Math.max(...p.map((q) => q[1]), ...lv) + 0.6);
  const zlo = Math.floor(S.zmin - 0.5);
  d.s += hvHatch(id);

  const nl = R.Ps.length + R.hist.length + (Number.isFinite(I.MNHT) ? 1 : 0);
  const F = hvFrame(d, xmin, xmax, zlo, zhi, {
    L: 50,
    Wd: 590,
    T: Math.max(40, 16 * nl + 24),
    Hmax: 400,
  });
  hvWater(d, F, p, R.Htk, '#cfe2f3');
  hvGround(d, F, p, zlo, id);
  for (const q of p) {
    d.s += `<circle cx="${F.X(q[0]).toFixed(1)}" cy="${F.Y(q[1]).toFixed(1)}" r="2.2" fill="#5a3d1a"/>`;
  }
  for (const x of [I.xL, I.xR]) {
    d.s += `<line x1="${F.X(x).toFixed(1)}" y1="${F.T}" x2="${F.X(x).toFixed(1)}" y2="${(F.T + F.H).toFixed(1)}" stroke="#7f7f7f" stroke-dasharray="5 3"/>`;
  }
  const zones: ReadonlyArray<readonly [number, number, string]> = [
    [xmin, I.xL, 'BÃI TRÁI'],
    [I.xL, I.xR, 'LÒNG CHỦ'],
    [I.xR, xmax, 'BÃI PHẢI'],
  ];
  for (const [a, b, t] of zones) {
    if (b > a) d.T((F.X(a) + F.X(b)) / 2, F.T - 8, t, 'middle', 'class="s"');
  }

  const lev: Array<[number, string, string, string]> = [
    ...R.Ps.filter((P) => Number.isFinite(R.H[P])).map(
      (P): [number, string, string, string] => [
        R.H[P],
        `MNTK H${String(P).replace('.', ',')}% = ${fx(R.H[P], 2)}`,
        P === R.Pd ? '#1f4e79' : '#2e75b6',
        P === R.Pd ? '0' : '7 3',
      ],
    ),
    ...R.hist.map((h): [number, string, string, string] => [
      h.h,
      `MNLL ${h.y} = ${fx(h.h, 2)}`,
      '#548235',
      '3 3',
    ]),
    ...(Number.isFinite(I.MNHT)
      ? ([[I.MNHT, `MNHT = ${fx(I.MNHT, 2)}`, '#7f7f7f', '5 3']] as Array<
          [number, string, string, string]
        >)
      : []),
  ];
  const scratchKit = dgKit('hvMCtmp');
  for (const [z, _t, c, da] of lev) {
    const ww = hvWater(scratchKit, F, p, z, 'none');
    const x1 = ww.length ? ww[0][0] : xmin;
    d.s += `<line x1="${F.X(x1).toFixed(1)}" y1="${F.Y(z).toFixed(1)}" x2="${F.xr.toFixed(1)}" y2="${F.Y(z).toFixed(1)}" stroke="${c}" stroke-dasharray="${da === '0' ? 'none' : da}" stroke-width="1"/>`;
  }
  lev.sort((a, b) => a[0] - b[0]);
  for (const [z, t, c] of lev) {
    const yy = hvLab(d, bx, F.xr + 10, F.Y(z) + 4, t, 'start', c);
    d.L(F.xr, F.Y(z), F.xr + 8, yy - 4, 't');
  }
  const xm = (I.xL + I.xR) / 2;
  const ym = F.Y(R.Htk);
  d.s += `<polygon points="${F.X(xm)},${ym} ${F.X(xm) - 5},${ym - 8} ${F.X(xm) + 5},${ym - 8}" fill="none" stroke="#1f4e79"/>`;

  const svg = dgPut(sv, W, F.bot + 6, d.s, id);
  if (target === undefined) setOutputValue('hv_dgMC', svg);
  return svg;
}

/** Plot bridge opening, design water levels, general scour and local scour cross-section (`#hv_dgSec`). */
export function hvFigSec(
  R: HvCalcResult | null | undefined,
  target?: SVGElement | string | null,
): string {
  if (!R || !R.S?.pts?.length || !R.X || !R.op) {
    if (target === undefined) clearSvgElement('hv_dgSec');
    return '';
  }
  const sv = resolveRealSvg(target, 'hv_dgSec');
  const id = 'hvSec';
  const d = dgKit(id);
  const W = 760;
  const I = R.I;
  const S = R.S;
  const X0 = R.X;
  const p = S.pts.slice().sort((a, b) => a[0] - b[0]);
  const bx: LabelBox[] = [];
  const ELd = R.C && Number.isFinite(R.C.ddMin) ? R.C.ddMin : R.Hd + 1;
  const zA = (x: number): number => R.op.zAt(x);
  const xb1 = I.xA1 - 5.5;
  const xb2 = I.xA2 + 5.5;
  const mg = 1;
  const xmin = Math.max(p[0][0], xb1 - mg);
  const xmax = Math.min(p[p.length - 1][0], xb2 + mg);
  const pp: Point2D[] = [
    [xmin, zA(xmin)],
    ...p.filter((q) => q[0] > xmin && q[0] < xmax),
    [xmax, zA(xmax)],
  ];

  const hb = 0.9;
  const mty = I.mty || 'nang';
  const pty = I.pty || 'deo';
  const G: AbutSketch[] = [];
  [I.xA1, I.xA2].forEach((x, k) => {
    const s = k ? 1 : -1;
    const zg = zA(x);
    const xt = x;
    if (mty === 'deo') {
      G.push({
        k,
        s,
        x,
        zg,
        xt,
        cap: [xt, xt + s * 1.6, ELd - 1.2, ELd],
        bw: [xt + s * 1.2, xt + s * 1.6, ELd, ELd + hb],
        piles: [xt + s * 0.8],
        pb: ELd - 1.2,
      });
    } else {
      const tt = 1.5;
      const zbt = Math.min(zg, zA(xt + (s * tt) / 2)) - Math.max(0.5, X0.vmax.z - X0.elG + 0.2);
      G.push({
        k,
        s,
        x,
        zg,
        xt,
        wall: [xt, xt + s * tt, zbt, ELd],
        bw: [xt + s * (tt - 0.5), xt + s * tt, ELd, ELd + hb],
        foot: [xt - s * 2.0, xt + s * (tt + 2.0), zbt - 1.8, zbt],
        piles: [xt - s * 1.2, xt + s * (tt + 1.2)],
        pb: zbt - 1.8,
      });
    }
  });

  const PG: PierSketch[] = I.pier.map((q) => {
    const zg = zA(q.x);
    if (pty === 'dac') {
      const bm = q.a + 0.6;
      const zbt = Math.min(zg - (X0.vmax.z - X0.elG), zg - 0.5);
      const Bb = Math.max(q.a + 3, 5);
      return {
        x: q.x,
        a: q.a,
        cap: [q.x - bm / 2, q.x + bm / 2, ELd - 1.0, ELd],
        shaft: [q.x - q.a / 2, q.x + q.a / 2, zbt, ELd - 1.0],
        foot: [q.x - Bb / 2, q.x + Bb / 2, zbt - 2.0, zbt],
        piles: [q.x - Bb / 2 + 0.9, q.x + Bb / 2 - 0.9],
        D: 1.0,
        pb: zbt - 2.0,
      };
    }
    const bm = Math.max(q.a + 0.6, 1.6);
    return {
      x: q.x,
      a: q.a,
      cap: [q.x - bm / 2, q.x + bm / 2, ELd - 1.2, ELd],
      piles: [q.x],
      D: q.a,
      pb: ELd - 1.2,
    };
  });

  const els = [
    ...X0.piers.map((q) => q.el),
    ...X0.abut.map((a) => a.el),
    X0.elG,
    ...G.filter((o) => o.foot).map((o) => o.foot![2]),
    ...PG.filter((o) => o.foot).map((o) => o.foot![2]),
  ].filter(Number.isFinite);
  const zlo = Math.floor(Math.min(...els, ...pp.map((q) => q[1])) - 3);
  const zhi = Math.ceil(ELd + 1.5);
  d.s += hvHatch(id);

  const F = hvFrame(d, xmin, xmax, zlo, zhi, { L: 50, Wd: 590, T: 44, Hmax: 620 });
  const XY = (q: Point2D): string => F.X(q[0]).toFixed(1) + ',' + F.Y(q[1]).toFixed(1);
  const mk = (x: number, z: number, t: string, col: string, an?: string, dn?: number | boolean) => {
    const X = F.X(x);
    const Y = F.Y(z);
    d.s += `<polygon points="${X},${Y} ${X - 5},${Y - 9} ${X + 5},${Y - 9}" fill="none" stroke="${col}" stroke-width="1"/>`;
    hvLab(
      d,
      bx,
      X + (dn ? 0 : an === 'end' ? -8 : 8),
      dn ? Y + 16 : Y - 10,
      t,
      dn ? 'middle' : an || 'start',
      col,
    );
  };

  hvWater(d, F, pp, R.Htk, '#dbe9f6');
  const V = X0.V;
  const hxc = X0.vmax.z - X0.elG;
  const sc: Point2D[] = V.map((v) => [v.x, v.z - hxc]);
  const lineZ = (x: number): number => zA(x) - hxc;

  hvGround(
    d,
    F,
    [...pp.filter((q) => q[0] < I.xA1), ...sc, ...pp.filter((q) => q[0] > I.xA2)],
    zlo,
    id,
  );
  d.s += `<polygon points="${[...V.map((v): Point2D => [v.x, v.z]), ...sc.slice().reverse()].map(XY).join(' ')}" fill="url(#hx${id})" stroke="none"/>`;
  d.s += `<polyline points="${V.map((v) => XY([v.x, v.z])).join(' ')}" fill="none" stroke="#5a3d1a" stroke-width="1.2" stroke-dasharray="4 2"/>`;
  d.s += `<polyline points="${sc.map(XY).join(' ')}" fill="none" stroke="#c000c0" stroke-width="1.5"/>`;

  const box = (b: [number, number, number, number], fill?: string) => {
    const x1 = Math.min(b[0], b[1]);
    const x2 = Math.max(b[0], b[1]);
    const z1 = b[2];
    const z2 = b[3];
    const poly: Point2D[] = [
      [x1, z1],
      [x2, z1],
      [x2, z2],
      [x1, z2],
    ];
    d.s += `<polygon points="${poly.map(XY).join(' ')}" fill="${fill || '#e7e6e6'}" stroke="#404040" stroke-width="1"/>`;
  };
  const pile = (xc: number, D: number, zt: number) => {
    const zb = zlo + 0.6;
    box([xc - D / 2, xc + D / 2, zb, zt], '#ededed');
    const y = F.Y(zb);
    const x1 = F.X(xc - D / 2) - 3;
    const x2 = F.X(xc + D / 2) + 3;
    const w = (x2 - x1) / 4;
    d.s += `<polyline points="${x1.toFixed(1)},${y.toFixed(1)} ${(x1 + w).toFixed(1)},${(y - 4).toFixed(1)} ${(x1 + 2 * w).toFixed(1)},${(y + 4).toFixed(1)} ${(x1 + 3 * w).toFixed(1)},${(y - 4).toFixed(1)} ${x2.toFixed(1)},${y.toFixed(1)}" fill="none" stroke="#404040" stroke-width="0.8"/>`;
  };

  for (const o of G) {
    for (const xc of o.piles) pile(xc, 1.0, o.pb);
    if (o.foot) box(o.foot);
    if (o.wall) box(o.wall);
    if (o.cap) box(o.cap);
    box(o.bw);
  }
  for (const o of PG) {
    for (const xc of o.piles) pile(xc, o.D, o.pb);
    if (o.foot) box(o.foot);
    if (o.shaft) box(o.shaft);
    box(o.cap);
  }
  if (G.length >= 2) {
    const a1 = G[0].bw[0];
    const a2 = G[1].bw[0];
    box([a1, a2, ELd, ELd + hb], '#bfbfbf');
  }

  const bed = (x: number): number => {
    if (x <= I.xA1 || x >= I.xA2) return zA(x);
    for (let k = 1; k < sc.length; k++) {
      if (x <= sc[k][0]) {
        const dx = sc[k][0] - sc[k - 1][0] || 1;
        return sc[k - 1][1] + ((sc[k][1] - sc[k - 1][1]) * (x - sc[k - 1][0])) / dx;
      }
    }
    return zA(x);
  };
  const FS = [...G, ...PG]
    .map((o) =>
      o.foot ? ([Math.min(o.foot[0], o.foot[1]), Math.max(o.foot[0], o.foot[1]), o.foot[2]] as const) : null,
    )
    .filter((item): item is readonly [number, number, number] => item !== null);
  const ceil = (x: number): number => {
    let c = bed(x);
    for (const fItem of FS) {
      if (x > fItem[0] && x < fItem[1]) c = Math.min(c, fItem[2]);
    }
    return c;
  };
  const xf = G.map((o) => {
    const fr = o.foot ? Math.abs(o.foot[0] - o.x) : 0.5;
    return o.x - o.s * (fr + 1.0);
  });
  const side = (x0: number, zb: number, ys: number, s: number): Point2D[] => {
    const k = 1 / Math.max(ys, 0.05);
    const segPts: Point2D[] = [[x0, zb]];
    for (let t = 0.1; t < 20 * ys + 20; t += 0.1) {
      const x = x0 + s * t;
      const z = zb + k * t * t;
      const cz = ceil(x);
      if (cz < -1e8) break;
      segPts.push([x, Math.min(z, cz)]);
      if (z >= cz) break;
    }
    return segPts;
  };
  const bowl = (x1: number, x2: number, zb: number, ys: number, dir: number) => {
    let bPts: Point2D[] = [];
    if (dir >= 0 || dir === 0) bPts = bPts.concat(side(x2, zb, ys, 1));
    const leftPts = dir <= 0 ? side(x1, zb, ys, -1).reverse() : [];
    bPts = dir === 0 ? [...leftPts, ...bPts] : dir > 0 ? [[x1, zb], ...bPts] : leftPts;
    d.s += `<polyline points="${bPts.map(XY).join(' ')}" fill="none" stroke="#00a000" stroke-width="1.3" stroke-dasharray="6 3"/>`;
  };
  for (const q of X0.piers) {
    if (q.ys > 0) bowl(q.x - q.a / 2, q.x + q.a / 2, lineZ(q.x) - q.ys, q.ys, 0);
  }

  const xcA = G.map((o) => {
    const si = -o.s;
    const fr = o.foot ? Math.abs(o.foot[0] - o.x) : 0.5;
    return o.x + si * (fr + 1.0);
  });
  const zvA = G.map((o) => {
    const zt = lineZ(o.x);
    return o.foot ? Math.min(o.foot[2] - 0.6, zt - 1.2) : zt - 1.2;
  });
  X0.abut.forEach((a, k) => {
    if (!(a.ys > 0) || !G[k]) return;
    const o = G[k];
    const si = -o.s;
    const x0 = o.x;
    const zt0 = lineZ(x0);
    const xc = xcA[k];
    const zb = zvA[k];
    const kk = (zt0 - zb) / ((xc - x0) ** 2 || 1);
    const P: Point2D[] = [];
    for (let t = 0; t <= 1.0001; t += 0.02) {
      const x = x0 + (xc - x0) * t;
      P.push([x, zb + kk * (x - xc) ** 2]);
    }
    for (let t = 0.05; t < 40; t += 0.05) {
      const x = xc + si * t;
      const z = zb + kk * t * t;
      const b = bed(x);
      P.push([x, Math.min(z, b)]);
      if (z >= b) break;
    }
    d.s += `<polyline points="${P.map(XY).join(' ')}" fill="none" stroke="#00a000" stroke-width="1.6" stroke-dasharray="7 3"/>`;
  });

  const lev: Array<[number, string, string, string]> = [
    [R.Hd, `Hd = ${fx(R.Hd, 2)}`, '#c00000', '6 3'],
    [R.Htk, `MNTK H${String(R.Pd).replace('.', ',')}% = ${fx(R.Htk, 2)}`, '#1f4e79', '0'],
    ...(Number.isFinite(I.MNHT) && I.MNHT > zlo
      ? ([[I.MNHT, `MNHT = ${fx(I.MNHT, 2)}`, '#7f7f7f', '5 3']] as Array<
          [number, string, string, string]
        >)
      : []),
    [ELd, `Đáy dầm = ${fx(ELd, 2)}`, '#404040', ''],
  ];
  const scratchKit = dgKit('hvSectmp');
  for (const [z, _t, c, da] of lev) {
    if (da === '') continue;
    const ww = hvWater(scratchKit, F, pp, z, 'none');
    if (!ww.length) continue;
    d.s += `<line x1="${F.X(ww[0][0]).toFixed(1)}" y1="${F.Y(z).toFixed(1)}" x2="${F.xr.toFixed(1)}" y2="${F.Y(z).toFixed(1)}" stroke="${c}" stroke-dasharray="${da === '0' ? 'none' : da}" stroke-width="1"/>`;
  }
  lev.sort((a, b) => a[0] - b[0]);
  for (const [z, t, c] of lev) {
    const yy = hvLab(d, bx, F.xr + 10, F.Y(z) + 4, t, 'start', c);
    d.L(F.xr, F.Y(z), F.xr + 8, yy - 4, 't');
  }

  {
    const xm = X0.vmax.x;
    const z0 = zA(xm);
    const xx = F.X(xm);
    const dxc = X0.vmax.dx;
    const dl = X0.dl;
    hvDimV(d, xx, F.Y(z0), F.Y(z0 - hxc), '', 1, '#c000c0');
    const yy = hvLab(
      d,
      bx,
      xx - 60,
      F.Y(z0 - hxc) + 18,
      `Xói chung hxc = ${fx(dxc, 2)} m ; Δ = ${fx(dl, 2)} m`,
      'start',
      '#c000c0',
    );
    hvLab(
      d,
      bx,
      xx - 60,
      yy + 15,
      `Đường xói chung tính toán ∇${fx(X0.elG, 2)}`,
      'start',
      '#c000c0',
    );
  }
  for (const q of X0.piers) {
    const zt = lineZ(q.x);
    const zb = zt - q.ys;
    mk(q.x, zb, `Hxcb = ${fx(q.el, 2)}`, '#00a000', 'start', 1);
    const xx = F.X(q.x + q.a / 2) + 6;
    hvDimV(d, xx, F.Y(zt), F.Y(zb), '', 1, '#00a000');
    hvLab(
      d,
      bx,
      xx + 4,
      (F.Y(zt) + F.Y(zb)) / 2 + 4,
      `hcb = ${fx(q.ys, 2)}`,
      'start',
      '#00a000',
    );
  }
  X0.abut.forEach((a, k) => {
    if (!(a.ys > 0)) return;
    const s = k ? -1 : 1;
    const zt = lineZ(a.x);
    const zb = zvA[k] ?? zt - 1.2;
    mk(xf[k] ?? a.x, zb, `Hxcb = ${fx(a.el, 2)}`, '#00a000', s > 0 ? 'start' : 'end', 1);
    const xx = F.X(a.x) + s * (F.kx * 0.3 + 4);
    hvDimV(d, xx, F.Y(zt), F.Y(zb), '', 1, '#00a000');
    hvLab(
      d,
      bx,
      xx + s * 5,
      (F.Y(zt) + F.Y(zb)) / 2 + 4,
      `hcb = ${fx(a.ys, 2)}`,
      s > 0 ? 'start' : 'end',
      '#00a000',
    );
  });

  let ly = F.bot + 18;
  const lg: ReadonlyArray<readonly [string, string, string]> = [
    ['#5a3d1a', '4 2', 'Đáy tự nhiên'],
    ['#c000c0', '0', 'Đường xói chung tính toán; gạch đỏ: phần xói chung'],
    ['#00a000', '6 3', 'Hố xói cục bộ, đáy hố Hxcb'],
  ];
  for (const [c, da, t] of lg) {
    d.s += `<line x1="70" y1="${ly - 4}" x2="104" y2="${ly - 4}" stroke="${c}" stroke-dasharray="${da === '0' ? 'none' : da}" stroke-width="1.5"/>`;
    d.T(110, ly, t, 'start', 'class="s"');
    ly += 16;
  }

  const svg = dgPut(sv, W, ly + 4, d.s, id);
  if (target === undefined) setOutputValue('hv_dgSec', svg);
  return svg;
}

// ---------------------------------------------------------------------------
// 4. Bridge Station & Project Location Schematic Map (`hvStMap`)
// ---------------------------------------------------------------------------

/** Generate pure SVG markup for Thanh Hóa hydro-meteorological station & project map. */
export function hvStMapSvg(I: HvInput, T: HvStRowsResult): string {
  const M = HVMAP;
  const W = 760;
  const mg = 14;
  const E0 = 4330;
  const E1 = 6170;
  const N0 = 21300;
  const N1 = 22900;
  const k = (W - 2 * mg) / (E1 - E0);
  const H = Math.round((N1 - N0) * k + 2 * mg);
  const X = (e: number): number => mg + (e / 100 - E0) * k;
  const Y = (n: number): number => mg + (N1 - n / 100) * k;
  const x = (e: number): number => mg + (e - E0) * k;
  const y = (n: number): number => mg + (N1 - n) * k;
  const f = (v: number): string => v.toFixed(1);

  const d = {
    s: '',
    T(X1: number, Y1: number, t: string, a = 'middle', ex = '') {
      d.s += `<text x="${f(X1)}" y="${f(Y1)}" text-anchor="${a}" ${ex}>${t}</text>`;
    },
  };
  const bx: LabelBox[] = [];
  const pth = (P: readonly [number, number][]): string =>
    P.map((p, i) => (i ? 'L' : 'M') + f(x(p[0])) + ',' + f(y(p[1]))).join('');

  d.s += `<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" fill="#fff" stroke="#000" stroke-width="1"/>`;
  d.s += `<path d="${pth(M.b)}Z" fill="#fbf8ec" stroke="#8b3fa8" stroke-width="1.6" stroke-dasharray="10,3,2,3"/>`;

  M.r
    .slice()
    .sort((a, b) => a.a - b.a)
    .forEach((r) => {
      d.s += `<path d="${pth(r.p)}" fill="none" stroke="#2f7fd0" stroke-width="${f(Math.min(2.6, 0.6 + r.a / 2500))}" stroke-linejoin="round"/>`;
    });

  for (const rawLbl of M.lb ?? []) {
    const l = rawLbl as readonly [string, number, number, number?, number?, string?];
    d.T(
      x(l[1]),
      y(l[2]),
      escSvg(l[0]),
      'middle',
      `style="font-size:${l[4] || 12}px;font-style:italic;fill:${l[5] || '#1d5fa8'}"${l[3] ? ` transform="rotate(${l[3]} ${f(x(l[1]))} ${f(y(l[2]))})"` : ''}`,
    );
  }

  const sel = I.st;
  const mk = (r: { n: string; lo?: string }, px: number, py: number) => {
    const c = r.n === sel ? '#d00000' : '#fff';
    const sw = r.n === sel ? 1.6 : 1.1;
    const sc = r.n === sel ? '#d00000' : '#0b3d91';
    const lo = r.lo ?? '';
    if (r.n === sel) {
      d.s += `<circle cx="${f(px)}" cy="${f(py)}" r="9" fill="none" stroke="#d00000" stroke-width="1"/>`;
    }
    if (lo === 'M') {
      d.s += `<circle cx="${f(px)}" cy="${f(py)}" r="3.6" fill="${c}" stroke="${sc}" stroke-width="${sw}"/>`;
    } else if (/KT/.test(lo) && /TV/.test(lo)) {
      d.s += `<rect x="${f(px - 4.5)}" y="${f(py - 4.5)}" width="9" height="9" fill="${c}" stroke="${sc}" stroke-width="${sw}"/><line x1="${f(px - 4.5)}" y1="${f(py + 4.5)}" x2="${f(px + 4.5)}" y2="${f(py - 4.5)}" stroke="${r.n === sel ? '#fff' : sc}" stroke-width="1"/>`;
    } else if (/KT/.test(lo)) {
      d.s += `<rect x="${f(px - 4.2)}" y="${f(py - 4.2)}" width="8.4" height="8.4" fill="${c}" stroke="${sc}" stroke-width="${sw}"/>`;
    } else {
      d.s += `<path d="M${f(px)},${f(py - 5.5)}L${f(px + 5)},${f(py + 3.5)}L${f(px - 5)},${f(py + 3.5)}Z" fill="${c}" stroke="${sc}" stroke-width="${sw}"/>`;
    }
    const q = r.n === sel ? 10 : 6;
    bx.push({ x: px - q, y: py - q, w: 2 * q, h: 2 * q });
  };

  const halo = (st: string): string =>
    /style="/.test(st)
      ? st.replace('style="', 'style="stroke:#fff;stroke-width:3px;stroke-linejoin:round;fill:#fff;')
      : st + ' style="stroke:#fff;stroke-width:3px;stroke-linejoin:round;fill:#fff"';

  const lab = (px: number, py: number, t: string, st: string, fs: number, o?: number) => {
    const off = o || 7;
    const w = t.length * fs * 0.56 + 2;
    const h = fs + 2;
    const candidates: ReadonlyArray<readonly [number, number, string]> = [
      [px + off, py + fs * 0.35, 'start'],
      [px - off, py + fs * 0.35, 'end'],
      [px, py - off - 1, 'middle'],
      [px, py + fs + off - 1, 'middle'],
      [px + off - 1, py - off + 1, 'start'],
      [px - off + 1, py - off + 1, 'end'],
      [px + off - 1, py + fs + off - 4, 'start'],
      [px - off + 1, py + fs + off - 4, 'end'],
    ];
    const put = (tx: number, ty: number, a: string) => {
      const safe = escSvg(t);
      d.T(tx, ty, safe, a, halo(st));
      d.T(tx, ty, safe, a, st);
    };
    let best: { ov: number; tx: number; ty: number; a: string; b: LabelBox } | null = null;
    for (const [tx, ty, a] of candidates) {
      const x0 = a === 'end' ? tx - w : a === 'middle' ? tx - w / 2 : tx;
      const b: LabelBox = { x: x0, y: ty - fs, w, h };
      if (x0 < 3 || x0 + w > W - 3 || b.y < 3 || b.y + h > H - 3) continue;
      const ov = bx.reduce(
        (m, q) =>
          m +
          Math.max(0, Math.min(b.x + b.w, q.x + q.w) - Math.max(b.x, q.x)) *
            Math.max(0, Math.min(b.y + b.h, q.y + q.h) - Math.max(b.y, q.y)),
        0,
      );
      if (!best || ov < best.ov) best = { ov, tx, ty, a, b };
      if (ov === 0) break;
    }
    if (!best) {
      best = {
        ov: 0,
        tx: candidates[0][0],
        ty: candidates[0][1],
        a: 'start',
        b: { x: candidates[0][0], y: candidates[0][1] - fs, w, h },
      };
    }
    bx.push(best.b);
    put(best.tx, best.ty, best.a);
  };

  const neighbors: ReadonlyArray<readonly [string, number, number]> = [
    ['NƯỚC CHDCND LÀO', 4640, 22120],
    ['TỈNH SƠN LA', 4520, 22850],
    ['TỈNH PHÚ THỌ', 5400, 22830],
    ['TỈNH NINH BÌNH', 6020, 22480],
    ['TỈNH NGHỆ AN', 5300, 21420],
    ['BIỂN ĐÔNG', 6060, 21650],
  ];
  for (const [t, e, n] of neighbors) {
    d.T(x(e), y(n), t, 'middle', 'style="font-size:11px;fill:#666;letter-spacing:1px"');
    const w = t.length * 7;
    bx.push({ x: x(e) - w / 2, y: y(n) - 11, w, h: 13 });
  }
  d.T(
    x(5250),
    y(22335),
    'TỈNH THANH HÓA',
    'middle',
    'style="font-size:13px;font-weight:bold;fill:#8b3fa8;letter-spacing:2px;opacity:0.6"',
  );
  bx.push({ x: x(5250) - 62, y: y(22335) - 13, w: 124, h: 16 });

  const R = T.rows.filter(
    (r): r is HvStRowEntry & { E: number; N: number } =>
      r.E != null && r.N != null && Number.isFinite(r.E) && Number.isFinite(r.N),
  );
  const s0 = d.s;
  d.s = '';
  for (const r of R) mk(r, X(r.E), Y(r.N));
  const pE = T.has ? X(T.E) : NaN;
  const pN = T.has ? Y(T.N) : NaN;
  const rs = R.find((r) => r.n === sel);
  if (T.has && rs && Number.isFinite(pE) && Number.isFinite(pN)) {
    d.s =
      `<line x1="${f(pE)}" y1="${f(pN)}" x2="${f(X(rs.E))}" y2="${f(Y(rs.N))}" stroke="#d00000" stroke-width="1" stroke-dasharray="5,3"/>` +
      d.s;
  }
  if (T.has && Number.isFinite(pE) && Number.isFinite(pN)) {
    const stPts = Array.from({ length: 10 }, (_, i) => {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? 4.2 : 10;
      return f(pE + rr * Math.cos(a)) + ',' + f(pN + rr * Math.sin(a));
    }).join(' ');
    d.s += `<polygon points="${stPts}" fill="#ffd400" stroke="#d00000" stroke-width="1.3"/>`;
    bx.push({ x: pE - 10, y: pN - 10, w: 20, h: 20 });
  }
  const top = d.s;
  d.s = s0;

  if (T.has && Number.isFinite(pE) && Number.isFinite(pN)) {
    const projName = (getContextValue('hv_dten') || '').trim() || 'VỊ TRÍ CÔNG TRÌNH';
    lab(
      pE,
      pN,
      projName.toUpperCase(),
      'style="font-size:11px;font-weight:bold;fill:#d00000"',
      11,
      12,
    );
  }
  R.slice()
    .sort((a, b) => Number(b.n === sel) - Number(a.n === sel))
    .forEach((r) =>
      lab(
        X(r.E),
        Y(r.N),
        r.n + (r.gd ? '*' : ''),
        `class="s"${r.n === sel ? ' style="fill:#d00000;font-weight:bold"' : ''}`,
        10,
        r.n === sel ? 11 : 7,
      ),
    );
  if (
    T.has &&
    rs &&
    Number.isFinite(pE) &&
    Number.isFinite(pN) &&
    Number.isFinite(rs.d) &&
    Math.hypot(pE - X(rs.E), pN - Y(rs.N)) > 110
  ) {
    const mx = (pE + X(rs.E)) / 2;
    const my = (pN + Y(rs.N)) / 2;
    lab(mx, my, hvF(rs.d, 1) + ' km', 'class="s" style="fill:#d00000"', 10);
  }
  d.s += top;

  const ax = W - 40;
  const ay = 40;
  d.s += `<path d="M${ax},${ay - 24}L${ax + 8},${ay + 6}L${ax},${ay}Z" fill="#000"/><path d="M${ax},${ay - 24}L${ax - 8},${ay + 6}L${ax},${ay}Z" fill="#fff" stroke="#000" stroke-width="0.8"/>`;
  d.T(ax, ay + 20, 'B', 'middle', 'style="font-weight:bold"');

  const sx = W - 230;
  const sy = H - 24;
  const km = k * 100;
  for (let i = 0; i < 4; i++) {
    d.s += `<rect x="${f(sx + i * km)}" y="${sy}" width="${f(km)}" height="5" fill="${i % 2 ? '#fff' : '#000'}" stroke="#000" stroke-width="0.6"/>`;
  }
  for (let i = 0; i <= 4; i++) {
    d.T(sx + i * km, sy - 4, String(i * 10), 'middle', 'class="s"');
  }
  d.T(sx + 4 * km + 6, sy + 5, 'km', 'start', 'class="s"');

  const lx = mg + 8;
  const ly = H - 135;
  const rw = 262;
  d.s += `<rect x="${lx}" y="${ly}" width="${rw}" height="125" fill="#fff" stroke="#000" stroke-width="0.8"/>`;
  d.T(lx + rw / 2, ly + 15, 'CHÚ GIẢI', 'middle', 'style="font-weight:bold"');

  const starPoly: ReadonlyArray<Point2D> = [
    [0, -8],
    [2.4, -2.5],
    [8, -2.5],
    [3.4, 1],
    [5, 7],
    [0, 3.5],
    [-5, 7],
    [-3.4, 1],
    [-8, -2.5],
    [-2.4, -2.5],
  ];
  const lg: ReadonlyArray<readonly [(r: [number, number]) => void, string]> = [
    [
      (pt) => {
        d.s += `<polygon points="${starPoly.map((p) => f(pt[0] + p[0]) + ',' + f(pt[1] + p[1])).join(' ')}" fill="#ffd400" stroke="#d00000" stroke-width="1.2"/>`;
      },
      'Vị trí công trình',
    ],
    [(pt) => mk({ n: '_', lo: 'KT' }, pt[0], pt[1]), 'Trạm khí tượng (KT)'],
    [(pt) => mk({ n: '_', lo: 'TV' }, pt[0], pt[1]), 'Trạm thủy văn (TV)'],
    [(pt) => mk({ n: '_', lo: 'KT, TV' }, pt[0], pt[1]), 'Trạm khí tượng và thủy văn'],
    [(pt) => mk({ n: '_', lo: 'M' }, pt[0], pt[1]), 'Điểm đo mưa'],
    [
      (pt) => {
        d.s += `<circle cx="${f(pt[0])}" cy="${f(pt[1])}" r="7" fill="none" stroke="#d00000" stroke-width="1.2"/>`;
      },
      'Trạm mưa được chọn',
    ],
  ];
  lg.forEach(([drawMark, text], i) => {
    const yy = ly + 32 + i * 15;
    drawMark([lx + 16, yy - 3]);
    d.T(lx + 32, yy + 1, text, 'start', 'class="s"');
  });

  return `<svg class="dg" id="hv_dgStM" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Sơ đồ vị trí công trình và các trạm">${DGSTY}${d.s}</svg>`;
}

/** Generate Thanh Hóa station map SVG plus numbered figure caption (`15` line 8568). */
export function hvStMap(I: HvInput, T: HvStRowsResult): string {
  const html =
    hvStMapSvg(I, T) +
    '<p class="cap">Hình 1 - Sơ đồ vị trí công trình và các trạm khí tượng, thủy văn, đo mưa trên địa bàn tỉnh Thanh Hóa</p>';
  setOutputValue('hv_stMap', html);
  return html;
}

// ---------------------------------------------------------------------------
// 5. Culvert Sizing & DEM Contour/Catchment Map SVGs (`tvcFig`, `tvcMap`)
// ---------------------------------------------------------------------------

/** Draw longitudinal culvert hydraulic & downstream scour-protection SVG (`#tvc_dg`, `17` line 1470). */
export function tvcFig(
  o?: TvcCulvertOutcome | null,
  target?: SVGElement | string | null,
): string {
  const sv = resolveRealSvg(target, 'tvc_dg');
  const D = o
    ? o.S && Number.isFinite(o.S.h)
      ? o.S.h
      : o.Hmin != null && Number.isFinite(o.Hmin)
        ? o.Hmin
        : 1
    : 1;
  const Hd = o && o.Hd != null && Number.isFinite(o.Hd) ? o.Hd : 1.3;
  const lg = o && o.lgc != null && Number.isFinite(o.lgc) ? o.lgc : 3;
  const hx = o && o.hx != null && Number.isFinite(o.hx) ? o.hx : 0.9;
  const ht = o && o.ht != null && Number.isFinite(o.ht) ? o.ht : 1.4;
  const L = Math.max(6, 4 * D + 2);
  const up = 2.2;
  const dn = 4.2;
  const span = up + L + lg + dn;
  const top = Math.max(Hd, D) + 0.4;
  const W = 760;
  const k = Math.min(600 / span, 200 / (top + ht + 0.3));
  const x0 = 120;
  const yb = 34 + top * k;
  const H = Math.round(yb + (ht + 0.3) * k + 66);
  const X = (x: number): number => x0 + (x + up) * k;
  const Y = (z: number): number => yb - z * k;
  const xc0 = 0;
  const xc1 = L;
  const xg = L + lg;
  const tw = 0.35;

  let g = `<style>text{font-family:"Times New Roman",Times,serif;font-size:13px;fill:#111}</style><rect width="${W}" height="${H}" fill="#fff"/>`;
  const ln = (a: number, b: number, c: number, d: number, st: string, w = 1, da?: string) =>
    `<line x1="${X(a)}" y1="${Y(b)}" x2="${X(c)}" y2="${Y(d)}" stroke="${st}" stroke-width="${w}"${da ? ` stroke-dasharray="${da}"` : ''}/>`;

  g += ln(-up, 0, xc0, 0, '#7a5a3a', 1.5) + ln(xg + tw, 0, xg + dn, 0, '#7a5a3a', 1.5);
  g += `<rect x="${X(xc0)}" y="${Y(D)}" width="${L * k}" height="${D * k}" fill="#eef2f6" stroke="#111" stroke-width="1.6"/>`;
  g += ln(xc0, D + 0.3, xc0, -0.3, '#111', 3) + ln(xc1, D + 0.3, xc1, -0.3, '#111', 3);
  g += `<rect x="${X(xc1)}" y="${Y(0)}" width="${lg * k}" height="${0.25 * k}" fill="#d0d0d0" stroke="#111"/><rect x="${X(xg)}" y="${Y(0)}" width="${tw * k}" height="${ht * k}" fill="#d0d0d0" stroke="#111"/>`;
  g += `<path d="M${X(xg + tw)},${Y(-hx)} C${X(xg + 1.6)},${Y(-hx)} ${X(xg + 2.6)},${Y(-hx * 0.4)} ${X(xg + dn - 0.2)},${Y(0)}" stroke="#c00000" stroke-width="1.2" stroke-dasharray="6 4" fill="none"/>`;
  g +=
    ln(-up, Hd, xc0, Hd, '#1f6fb2', 1.6) +
    `<path d="M${X(xc0)},${Y(Math.min(Hd, D))} Q${X(L * 0.35)},${Y(D * 0.62)} ${X(xc1)},${Y(D * 0.5)}" stroke="#1f6fb2" stroke-width="1.4" fill="none"/>` +
    `<path d="M${X(-up + 0.3)},${Y(Hd) + 1} l6,-9 l6,9 z" fill="#1f6fb2"/>`;

  const R = '#c00000';
  const tk = (x: number, z: number) =>
    `<line x1="${X(x) - 4}" y1="${Y(z)}" x2="${X(x) + 4}" y2="${Y(z)}" stroke="${R}"/>`;
  const tkv = (x: number, z: number) =>
    `<line x1="${X(x)}" y1="${Y(z) - 4}" x2="${X(x)}" y2="${Y(z) + 4}" stroke="${R}"/>`;

  g +=
    ln(-up + 1.2, 0, -up + 1.2, Hd, R) +
    tk(-up + 1.2, 0) +
    tk(-up + 1.2, Hd) +
    `<text x="${X(-up + 1.2) - 6}" y="${(Y(0) + Y(Hd)) / 2 + 4}" text-anchor="end" style="fill:${R}">Hd = ${fx(Hd, 2)} m</text>`;
  g +=
    ln(xc1, 0.45, xg, 0.45, R) +
    tkv(xc1, 0.45) +
    tkv(xg, 0.45) +
    `<text x="${(X(xc1) + X(xg)) / 2}" y="${Y(0.45) - 5}" text-anchor="middle" style="fill:${R}">lgc = ${fx(lg, 2)} m</text>`;
  g +=
    ln(xg + tw + 0.3, 0, xg + tw + 0.3, -ht, R) +
    tk(xg + tw + 0.3, 0) +
    tk(xg + tw + 0.3, -ht) +
    `<text x="${X(xg + tw + 0.3) + 5}" y="${Y(-ht) + 2}" style="fill:${R}">ht = ${fx(ht, 2)} m</text>`;
  g +=
    ln(xg + 2.3, 0, xg + 2.3, -hx, R) +
    tk(xg + 2.3, 0) +
    tk(xg + 2.3, -hx) +
    `<text x="${X(xg + 2.3) + 6}" y="${Y(-hx / 2) + 4}" style="fill:${R}">hx = ${fx(hx, 2)} m</text>`;

  const sizeLabel = o
    ? o.typ === 'hop'
      ? 'Cống hộp ' + escSvg(o.d)
      : o.typ === 'ban'
        ? `Cống bản L0 = ${fx(parseFloat(String(o.d ?? '0')) / 100, 2)} m, h = ${fx(D * 100, 0)}`
        : 'Cống tròn Φ' + escSvg(o.d)
    : 'Cống';
  g += `<text x="${(X(xc0) + X(xc1)) / 2}" y="${Y(D) - 8}" text-anchor="middle">${sizeLabel} cm</text><text x="${(X(xc1) + X(xg)) / 2}" y="${Y(-0.25) + 15}" text-anchor="middle">Gia cố sau cống</text><text x="${X(xg + tw / 2)}" y="${Y(-ht) + 18}" text-anchor="middle">Tường chống xói</text>`;
  g += `<text x="${W / 2}" y="${H - 10}" text-anchor="middle">${o ? 'Cống ' + escSvg(o.name) + (o.km ? ' - lý trình ' + escSvg(o.km) : '') : ''}</text>`;

  if (sv) {
    sv.setAttribute('viewBox', `0 0 ${W} ${H}`);
    sv.setAttribute('height', String(H));
    sv.innerHTML = g;
  }
  const fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${g}</svg>`;
  if (target === undefined) setOutputValue('tvc_dg', fullSvg);
  return fullSvg;
}

function buildCulvertMapNoteHtml(G: TvxSavedGeo): string {
  const hd = G.bas.some((b) => b.src !== 'td');
  const ht = G.bas.some((b) => b.src === 'td');
  const dn = HDSRC[(G.src || 'cop') as DemSourceKind] || '';
  return (
    (hd
      ? `Lưu vực ${
          ht
            ? 'các cống ' +
              G.bas
                .filter((b) => b.src !== 'td')
                .map((b) => escSvg(b.km))
                .join(', ') +
              ' '
            : ''
        }khoanh trên bản đồ địa hình: F đo theo đường bao, L là chiều dài lòng suối chính, Σl là tổng chiều dài suối nhánh vẽ trên bản đồ; độ dốc lòng suối Jls tính theo TCVN 9845:2013 PT 4 với cao độ dọc lòng suối chính lấy trên mô hình số độ cao ${dn} (ô lưới 30 m); độ dốc sườn dốc Jsd là trung bình độ dốc mặt đất trong đường bao. `
      : '') +
    (ht
      ? `Lưu vực ${
          hd
            ? 'các cống ' +
              G.bas
                .filter((b) => b.src === 'td')
                .map((b) => escSvg(b.km))
                .join(', ') +
              ' '
            : ''
        }khoanh tự động từ vị trí cống trên mô hình số độ cao ${dn} (hướng dòng chảy D8): F, L, Σl, Jls (TCVN 9845:2013 PT 4), Jsd đo trên lưu vực khoanh được.`
      : '')
  );
}

function renderDemHillshadePng(
  D: NonNullable<TvxSavedGeo['dem']>,
  zmin: number,
  zmax: number,
): string | null {
  if (typeof document === 'undefined' || !D.nx || !D.ny) return null;
  try {
    const cv = document.createElement('canvas');
    cv.width = D.nx;
    cv.height = D.ny;
    const cx2 = cv.getContext?.('2d');
    if (!cx2 || typeof cx2.createImageData !== 'function' || typeof cx2.putImageData !== 'function') {
      return null;
    }
    const im = cx2.createImageData(D.nx, D.ny);
    const { nx, ny, d, z } = D;
    const Zf = (i: number, j: number): number => {
      const v = z[Math.max(0, Math.min(ny - 1, j)) * nx + Math.max(0, Math.min(nx - 1, i))];
      return v == null || !Number.isFinite(v) ? NaN : v;
    };
    const az = (315 * Math.PI) / 180;
    const alt = (45 * Math.PI) / 180;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const k = (j * nx + i) * 4;
        const v = Zf(i, j);
        if (Number.isNaN(v)) {
          im.data[k + 3] = 0;
          continue;
        }
        const Zn = (a: number, b: number): number => {
          const u = Zf(a, b);
          return Number.isNaN(u) ? v : u;
        };
        const dzdx =
          (Zn(i + 1, j - 1) +
            2 * Zn(i + 1, j) +
            Zn(i + 1, j + 1) -
            (Zn(i - 1, j - 1) + 2 * Zn(i - 1, j) + Zn(i - 1, j + 1))) /
          (8 * d);
        const dzdy =
          (Zn(i - 1, j + 1) +
            2 * Zn(i, j + 1) +
            Zn(i + 1, j + 1) -
            (Zn(i - 1, j - 1) + 2 * Zn(i, j - 1) + Zn(i + 1, j - 1))) /
          (8 * d);
        const sl = Math.atan(Math.hypot(dzdx, dzdy));
        const asp = Math.atan2(dzdy, -dzdx);
        const hs = Math.max(
          0,
          Math.cos(alt) * Math.cos(sl) +
            Math.sin(alt) * Math.sin(sl) * Math.cos(az - Math.PI / 2 - asp),
        );
        const t = (v - zmin) / Math.max(1, zmax - zmin);
        const r0 = Math.round(215 + 30 * t);
        const g0 = Math.round(225 - 20 * t);
        const b0 = Math.round(190 - 40 * t);
        const factor = 0.55 + 0.45 * hs;
        im.data[k] = Math.min(255, r0 * factor);
        im.data[k + 1] = Math.min(255, g0 * factor);
        im.data[k + 2] = Math.min(255, b0 * factor);
        im.data[k + 3] = 255;
      }
    }
    cx2.putImageData(im, 0, 0);
    if (typeof cv.toDataURL !== 'function') return null;
    const url = cv.toDataURL('image/png');
    return url && url.startsWith('data:image/') ? url : null;
  } catch {
    return null;
  }
}

/**
 * Draw multi-culvert watershed, route & DEM hillshade/contour overview SVG (`#tvc_map`, `17` line 2507).
 */
export function tvcMap(
  geoArg?: TvxSavedGeo | null,
  calcResultArg?: TvcCalcResult | null,
  target?: SVGElement | string | null,
): string {
  const sv = resolveRealSvg(target, 'tvc_map');
  const box = target === undefined ? getRealElement('tvc_mapBox') : null;
  const G = geoArg !== undefined ? geoArg : tvmGeo();

  if (!G || !G.bas || !G.bas.length) {
    if (sv) sv.innerHTML = '';
    if (box) box.style.display = 'none';
    if (target === undefined) {
      setOutputValue('tvc_map', '');
      setOutputValue('o_tvc_mapNote', '');
    }
    return '';
  }
  if (box) box.style.display = '';

  const all: Point2D[] = [
    ...G.bas.flatMap((b) => b.bnd),
    ...(G.route || []),
    ...(G.ends || []).map((e) => e.p),
  ];
  if (!all.length) return '';

  let x0 = Math.min(...all.map((p) => p[0]));
  let x1 = Math.max(...all.map((p) => p[0]));
  let y0 = Math.min(...all.map((p) => p[1]));
  let y1 = Math.max(...all.map((p) => p[1]));
  const pad = Math.max(x1 - x0, y1 - y0) * 0.12 + 60;
  x0 -= pad;
  x1 += pad;
  y0 -= pad;
  y1 += pad;
  {
    const k0 = Math.min(740 / (x1 - x0 || 1), 620 / (y1 - y0 || 1));
    const m = 150 / k0;
    x0 -= m;
    x1 += m;
  }
  const W = 760;
  const k = Math.min((W - 20) / (x1 - x0 || 1), 620 / (y1 - y0 || 1));
  const H = Math.round((y1 - y0) * k) + 40;
  const ox = (W - (x1 - x0) * k) / 2;
  const X = (x: number): number => ox + (x - x0) * k;
  const Y = (y: number): number => 20 + (y1 - y) * k;
  const pl = (P: readonly Point2D[], st: string, w: number, fill = '', da = ''): string =>
    P.length
      ? `<path d="M${P.map((p) => X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' L')}" stroke="${st}" stroke-width="${w}" fill="${fill || 'none'}"${da ? ` stroke-dasharray="${da}"` : ''}/>`
      : '';

  const COL = [
    '#d62728',
    '#1f77b4',
    '#2ca02c',
    '#9467bd',
    '#ff7f0e',
    '#8c564b',
    '#e377c2',
    '#17becf',
  ];
  let g = `<style>text{font-family:"Times New Roman",Times,serif;font-size:12px;fill:#111;paint-order:stroke;stroke:#fff;stroke-width:3px;stroke-linejoin:round}</style><rect width="${W}" height="${H}" fill="#fff"/>`;

  if (G.dem && G.dem.z) {
    try {
      const D = G.dem;
      const contours = tvxContours(D);
      if (Number.isFinite(contours.zmin) && Number.isFinite(contours.zmax)) {
        const hsUrl = renderDemHillshadePng(D, contours.zmin, contours.zmax);
        if (hsUrl) {
          g += `<image href="${hsUrl}" x="${X(D.x0 - D.d / 2)}" y="${Y(D.y1 + D.d / 2)}" width="${D.nx * D.d * k}" height="${D.ny * D.d * k}" preserveAspectRatio="none" opacity="0.85"/>`;
        }
        const layers: ReadonlyArray<readonly ['n' | 'm', readonly Point2D[], number]> = [
          ['n', contours.n, 0.45],
          ['m', contours.m, 0.9],
        ];
        for (const [_kind, segPts, sw] of layers) {
          let pth = '';
          for (let q = 0; q + 1 < segPts.length; q += 2) {
            const A = segPts[q];
            const B = segPts[q + 1];
            pth += `M${X(A[0]).toFixed(1)},${Y(A[1]).toFixed(1)}L${X(B[0]).toFixed(1)},${Y(B[1]).toFixed(1)}`;
          }
          if (pth) {
            g += `<path d="${pth}" stroke="#a0703c" stroke-width="${sw}" fill="none" opacity="0.8"/>`;
          }
        }
        D._ci = contours.interval;
        (G as TvxSavedGeo & { _ci?: number })._ci = contours.interval;
      }
    } catch (e) {
      console.error(e);
    }
  }

  if (G.route && G.route.length > 1) {
    g += pl(G.route, '#c00000', 2.2, '', '8 4');
  }
  const activeRes = calcResultArg !== undefined ? calcResultArg : getLatestTvcResult();
  const O = activeRes ? activeRes.out : [];
  const LB: Array<{
    px: number;
    py: number;
    cx?: number;
    cy?: number;
    L: Array<[string, string]>;
  }> = [];

  for (const e of G.ends || []) {
    g += `<circle cx="${X(e.p[0])}" cy="${Y(e.p[1])}" r="5.5" fill="#c00000" stroke="#fff" stroke-width="1.2"/>`;
  }

  G.bas.forEach((b, i) => {
    const c = COL[i % COL.length];
    g += pl(b.bnd, c, 2, c + '10');
    for (const q of b.br || []) g += pl(q, '#5b9bd5', 0.8);
    g += pl(b.main, '#1f6fb2', 1.8);
    const len = b.bnd.length || 1;
    const cx = b.bnd.reduce((a, p) => a + p[0], 0) / len;
    const cy = b.bnd.reduce((a, p) => a + p[1], 0) / len;
    const o = (b.km ? O.find((q) => q.km === b.km) : null) || O[i];
    g += `<circle cx="${X(b.out[0])}" cy="${Y(b.out[1])}" r="4" fill="#c00000"/>`;
    LB.push({
      px: X(b.out[0]),
      py: Y(b.out[1]),
      cx: X(cx),
      cy: Y(cy),
      L: [
        [`${o?.name || ''}${b.km ? ' - ' + b.km : ''}`, '#111'],
        [`F = ${fx(o?.F != null ? o.F : 0, 3)} km²`, c],
      ],
    });
  });

  for (const e of G.ends || []) {
    LB.push({
      px: X(e.p[0]),
      py: Y(e.p[1]),
      L: [[(e.dau ? 'Đầu tuyến' : 'Cuối tuyến') + (e.km ? ' ' + e.km : ''), '#c00000']],
    });
  }

  {
    const boxes: Array<[number, number, number, number]> = [];
    const pts = LB.map((l) => [l.px, l.py] as const);
    const overlaps = (a: [number, number, number, number], b: [number, number, number, number]) =>
      a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];

    for (const l of LB) {
      const w = Math.max(...l.L.map((t) => t[0].length)) * 6.4 + 6;
      const h = l.L.length * 14 + 2;
      let best: { bx: [number, number, number, number]; r: number } | null = null;
      const pref =
        l.cx != null && l.cy != null ? Math.atan2(l.py - l.cy, l.px - l.cx) : -Math.PI / 4;
      for (const r of [10, 24, 40, 60, 85, 115]) {
        for (let step = 0; step < 16; step++) {
          const an = pref + ((step % 2 ? 1 : -1) * Math.ceil(step / 2) * Math.PI) / 8;
          const dx = Math.cos(an) * r;
          const dy = Math.sin(an) * r;
          const bx0 = dx >= 0 ? l.px + dx : l.px + dx - w;
          const by0 = dy >= 0 ? l.py + dy : l.py + dy - h;
          const cand: [number, number, number, number] = [bx0, by0, bx0 + w, by0 + h];
          if (cand[0] < 2 || cand[2] > W - 2 || cand[1] < 2 || cand[3] > H - 2) continue;
          if (boxes.some((q) => overlaps(q, cand))) continue;
          if (
            pts.some(
              (p) =>
                p[0] > cand[0] - 4 && p[0] < cand[2] + 4 && p[1] > cand[1] - 4 && p[1] < cand[3] + 4,
            )
          ) {
            continue;
          }
          best = { bx: cand, r };
          break;
        }
        if (best) break;
      }
      if (!best) {
        const bx0 = l.px + 8;
        const by0 = l.py + 8;
        best = { bx: [bx0, by0, bx0 + w, by0 + h], r: 10 };
      }
      boxes.push(best.bx);
      const [bx0, by0] = best.bx;
      if (best.r > 24) {
        const tx = Math.max(bx0, Math.min(bx0 + w, l.px));
        const ty = Math.max(by0, Math.min(by0 + h, l.py));
        g += `<line x1="${l.px}" y1="${l.py}" x2="${tx}" y2="${ty}" stroke="#333" stroke-width="0.7"/>`;
      }
      l.L.forEach((t, j) => {
        g += `<text x="${bx0 + 3}" y="${by0 + 12 + 14 * j}" style="font-weight:bold;fill:${t[1]}">${escSvg(t[0])}</text>`;
      });
    }
  }

  const sb = [50, 100, 200, 250, 500, 1000, 2000].reduce((b, v) => (v * k <= 160 ? v : b), 50);
  g += `<path d="M20,${H - 14} h${sb * k} M20,${H - 18} v8 M${20 + sb * k},${H - 18} v8" stroke="#111"/><text x="${20 + (sb * k) / 2}" y="${H - 20}" text-anchor="middle">${sb} m</text>`;
  g += `<path d="M${W - 30},${H - 40} l6,16 l-6,-5 l-6,5 z" fill="#111"/><text x="${W - 30}" y="${H - 44}" text-anchor="middle">B</text>`;

  if (sv) {
    sv.setAttribute('viewBox', `0 0 ${W} ${H}`);
    sv.setAttribute('height', String(H));
    sv.innerHTML = g;
  }

  const noteHtml = buildCulvertMapNoteHtml(G);
  if (target === undefined) {
    const nt = getRealElement('o_tvc_mapNote');
    if (nt) nt.innerHTML = noteHtml;
    setOutputValue('o_tvc_mapNote', noteHtml);
  }

  const fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${g}</svg>`;
  if (target === undefined) setOutputValue('tvc_map', fullSvg);
  return fullSvg;
}

// ---------------------------------------------------------------------------
// 6. Standalone Visual Orchestrators & VisualReportHooks Registration
// ---------------------------------------------------------------------------

export interface DemVisualRenderOptions {
  width?: number;
  height?: number;
  hydroInput?: { F: number; L: number; sl: number };
  drawCanvas?: boolean;
}

export interface DemWatershedVisualResult {
  previewSvg: string;
  canvasPng: string | null;
  lvHtml: string;
  renderedCanvas: boolean;
}

/** Generate clean vector SVG preview for an extracted DEM watershed (`16` / `cadDxfExport`). */
export function renderDemPreviewSvg(
  result: HvdRunResult | null | undefined,
  width = 540,
  height = 380,
): string {
  if (!result) return '';
  return hdDxfPreviewSvg(result, width, height);
}

/**
 * Render DEM / watershed visuals (`#hd_cv` hillshade canvas when available, standalone vector
 * SVG preview via `hdDxfPreviewSvg`, and Vietnamese watershed report block via `hvLV`).
 */
export function renderDemWatershedVisuals(
  resultArg?: HvdRunResult | null,
  options: DemVisualRenderOptions = {},
): DemWatershedVisualResult {
  const result = resultArg ?? HVD.S.res;
  if (!result) {
    return { previewSvg: '', canvasPng: null, lvHtml: '', renderedCanvas: false };
  }

  const width = options.width ?? 540;
  const height = options.height ?? 380;
  const previewSvg = hdDxfPreviewSvg(result, width, height);

  let renderedCanvas = false;
  let canvasPng: string | null = null;
  if (options.drawCanvas !== false && typeof document !== 'undefined') {
    const cv = document.getElementById('hd_cv') as HTMLCanvasElement | null;
    if (cv && typeof cv.getContext === 'function') {
      try {
        const ctx = cv.getContext('2d');
        if (ctx && typeof ctx.createImageData === 'function') {
          hdDraw(result);
          renderedCanvas = true;
          if (typeof cv.toDataURL === 'function') {
            const url = cv.toDataURL('image/png');
            if (url && url.startsWith('data:image/')) canvasPng = url;
          }
        }
      } catch {
        renderedCanvas = false;
      }
    }
  }

  let lvHtml = '';
  try {
    const hydroIn = options.hydroInput ?? {
      F: Number(result.Fkm.toFixed(3)),
      L: Number(result.L.toFixed(3)),
      sl: Number(result.sl.toFixed(3)),
    };
    lvHtml = hvLV(hydroIn);
  } catch {
    lvHtml = '';
  }

  return { previewSvg, canvasPng, lvHtml, renderedCanvas };
}

export interface BridgeHydroVisualResult {
  stationMapHtml: string;
  freqSvg: string;
  mcSvg: string;
  hqSvg: string;
  secSvg: string;
  rendered: boolean;
}

/**
 * Render all bridge hydrology SVG figures (`#hv_stMap`, `#hv_dgFq`, `#hv_dgMC`, `#hv_dgHQ`,
 * `#hv_dgSec`) and renumber visible captions cleanly.
 */
export function renderBridgeHydroVisuals(
  resultArg?: HvCalcResult | null,
): BridgeHydroVisualResult {
  const R = resultArg ?? getLatestHvResult();
  if (!R || (R.err && R.err.length)) {
    clearSvgElement('hv_dgFq');
    clearSvgElement('hv_dgMC');
    clearSvgElement('hv_dgHQ');
    clearSvgElement('hv_dgSec');
    return {
      stationMapHtml: '',
      freqSvg: '',
      mcSvg: '',
      hqSvg: '',
      secSvg: '',
      rendered: false,
    };
  }

  const stationMapHtml = hvStMap(R.I, hvStRows(R.I, R.Pd));
  const stMapEl = getRealElement('hv_stMap');
  if (stMapEl) stMapEl.innerHTML = stationMapHtml;

  let freqSvg = '';
  if (!R.noRain) {
    freqSvg = hvFigFq(R);
  } else {
    clearSvgElement('hv_dgFq');
  }

  const mcSvg = hvFigMC(R);
  const hqSvg = hvFigHQ(R);
  const secSvg = hvFigSec(R);

  try {
    hvCapNum();
  } catch {
    // ignore missing caption container in headless mode
  }

  return {
    stationMapHtml,
    freqSvg,
    mcSvg,
    hqSvg,
    secSvg,
    rendered: true,
  };
}

export interface CulvertHydroVisualResult {
  figSvg: string;
  mapSvg: string;
  mapNoteHtml: string;
  selectedCulvert: TvcCulvertOutcome | null;
  rendered: boolean;
}

/**
 * Render all culvert hydrology SVG diagrams (`#tvc_map`, `#tvc_dg`) and catchment map note
 * (`#o_tvc_mapNote`), safely guarding headless DOM / `<canvas>` environments.
 */
export function renderCulvertHydroVisuals(
  resultArg?: TvcCalcResult | null,
  geoArg?: TvxSavedGeo | null,
): CulvertHydroVisualResult {
  const R = resultArg ?? getLatestTvcResult();
  const G = geoArg !== undefined ? geoArg : tvmGeo();

  let mapSvg = '';
  let mapNoteHtml = '';
  try {
    mapSvg = tvcMap(G, R);
    if (G && G.bas?.length) mapNoteHtml = buildCulvertMapNoteHtml(G);
  } catch (e) {
    console.error(e);
  }

  const outcomes = R?.out ?? [];
  const selectedCulvert = outcomes.find((o) => o.hx != null) ?? null;
  const figSvg = tvcFig(selectedCulvert);

  return {
    figSvg,
    mapSvg,
    mapNoteHtml,
    selectedCulvert,
    rendered: Boolean(R || mapSvg),
  };
}

/**
 * Extended `VisualReportHooks` bundle including `renderHydrology` (`'bridge' | 'culvert'`)
 * and `renderBridgeStationMap` consumed by `src/engine/hydrology/bridgeHydro.ts`.
 */
export interface HydroDemReportHooks extends Partial<VisualReportHooks> {
  renderBridgeStationMap?: (input: HvInput, table: HvStRowsResult) => string;
}

/** Return visual hook callbacks matching `VisualReportHooks` in `src/engine/context.ts`. */
export function getHydroDemReportHooks(): Partial<VisualReportHooks> {
  return {
    renderHydrology({ mode, result }) {
      if (mode === 'bridge') {
        renderBridgeHydroVisuals(result as HvCalcResult | null);
        return;
      }
      if (mode === 'culvert') {
        renderCulvertHydroVisuals(result as TvcCalcResult | null);
      }
    },
  };
}

/** Register hydrology & offline DEM visual report hooks globally in `context.ts`. */
export function registerHydroDemVisualHooks(): void {
  const hooks: HydroDemReportHooks = {
    ...getHydroDemReportHooks(),
    renderBridgeStationMap: hvStMap,
  };
  registerVisualHooks(hooks);
}
