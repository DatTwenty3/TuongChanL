/**
 * BangTinhCauCong Web App — Foundation, Circular P-M & 3D P-M-M Visual Report Hooks
 *
 * Clean-room TypeScript implementation of Step 5.6 (part 1) connecting `VisualReportHooks`
 * in `src/engine/context.ts` to SVG, HTML table, MathJax, and Plotly 3D outputs for:
 *  - Circular column P-M interaction (`dgCD`, `dgDB`, `dgSec`, `tbBar`) — Mod 02 & 12
 *  - Interactive 3D P-M-M biaxial surface (`p3d`, `b3CD`, `b3DB`, `tbBi`, `klBi`) — `plots3d.ts`
 *  - Shallow foundation diagrams & cap pressure (`dgEl`, `dgPl`, `dgSl`, `dgSfCap*`) — Mod 14
 *  - Pile group plan & soil-interaction depth profiles (`dgPlan`, `dgPD*`, `tbPD*`) — Mod 12
 *  - Drilled shaft group block & capacity/displacement reports (`dgGrp`, `dgB1`, `tbCmp`, `tbDsp`, `s2grp`, `tbGrp`) — Mod 12
 *
 * Every DOM/SVG/canvas/Plotly call is strictly null-safe and jsdom-safe.
 */

import type {
  CircularPmCurveResult,
  ContextPrefix,
  ShallowFootingComboCheck,
} from '../types/project';
import {
  FR,
  contextState,
  fx,
  registerVisualHooks,
  resolveScopedIdCandidates,
  set,
  num,
  v,
  withCtx,
  type VisualReportHooks,
} from '../engine/context';
import { dgKit, dgPut, sfArrow, sfHatch, sfKit } from '../graphics/svgPrimitives';
import {
  render3 as render3Plot,
  type Pm3dLimitState,
  type Pm3dStateStore,
  type Render3Result,
} from '../graphics/plots3d';
import { mathAll } from '../graphics/texMath';
import type { CircularComboLoad, CircularSection, St3StateMap } from '../engine/math/rc';
import {
  press,
  type ShallowFootingMeta,
  type ShallowFootingParams,
  type SfRenderResult,
} from '../engine/foundations/shallowFdn';

type CircularPmLoadCase = Pick<CircularComboLoad, 'P' | 'M'> & Partial<CircularComboLoad>;
import {
  pdProf,
  type McCapSoilInput,
  type McPileInput,
  type McRunResult,
  type McrRuntimeState,
} from '../engine/foundations/pileGroup';
import {
  b1curve,
  type SctCalcOutput,
  type SctGroupCheckDetailed,
} from '../engine/foundations/drilledShaft';

// ---------------------------------------------------------------------------
// 0. Null-Safe & jsdom-Safe DOM / SVG Helpers
// ---------------------------------------------------------------------------

function hasDom(): boolean {
  return typeof document !== 'undefined';
}

function getTargetCandidates(id: string, prefix: ContextPrefix | string = ''): string[] {
  if (!prefix) return [id];
  if (
    prefix === 'Q_' ||
    prefix === 'T_' ||
    prefix === 'U_' ||
    prefix === 'C_' ||
    prefix === 'P_' ||
    prefix === 'W_'
  ) {
    return resolveScopedIdCandidates(id, prefix);
  }
  return [prefix + id];
}

function resolveDomElement(
  id: string,
  prefix: ContextPrefix | string = '',
  exactFirst = true,
): Element | null {
  if (!hasDom()) return null;
  if (exactFirst && prefix) {
    const exact = document.getElementById(prefix + id);
    if (exact) return exact;
  }
  for (const cand of getTargetCandidates(id, prefix)) {
    const el = document.getElementById(cand);
    if (el) return el;
  }
  return null;
}

function writeHtmlTarget(
  id: string,
  html: string,
  prefix: ContextPrefix | string = '',
): void {
  const domEl = resolveDomElement(id, prefix, true);
  if (domEl) {
    domEl.innerHTML = html;
  }
  set(id, html);
}

function writeTextTarget(
  id: string,
  text: string,
  prefix: ContextPrefix | string = '',
): void {
  const domEl = resolveDomElement(id, prefix, true);
  if (domEl) {
    domEl.textContent = text;
  }
  set(id, text);
}

function renderInlineSvg(
  id: string,
  width: number,
  height: number,
  innerMarkup: string,
  prefix: ContextPrefix | string = '',
): string {
  const hr = Math.max(1, Math.round(height));
  const wr = Math.max(1, Math.round(width));
  const fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${wr}" height="${hr}" viewBox="0 0 ${wr} ${hr}">${innerMarkup}</svg>`;
  const el = resolveDomElement(id, prefix, true);
  if (el) {
    el.setAttribute('width', String(wr));
    el.setAttribute('height', String(hr));
    el.setAttribute('viewBox', `0 0 ${wr} ${hr}`);
    el.innerHTML = innerMarkup;
  }
  return fullSvg;
}

function runMathSafe(targetId?: string, prefix: ContextPrefix | string = ''): void {
  if (!hasDom()) return;
  try {
    const root = targetId ? resolveDomElement(targetId, prefix, true) : null;
    mathAll((root as ParentNode | null) ?? document);
  } catch {
    // Keep non-blocking in partial/headless test environments
  }
}

function niceAxisBounds(loIn: number, hiIn: number): [number, number, number] {
  let lo = Number.isFinite(loIn) ? loIn : -1;
  let hi = Number.isFinite(hiIn) ? hiIn : 1;
  if (hi - lo <= 1e-6) {
    const pad = Math.max(1, Math.abs(lo) * 0.25);
    lo -= pad;
    hi += pad;
  }
  const s = Math.pow(10, Math.floor(Math.log10((hi - lo) / 5)));
  const st =
    [1, 2, 2.5, 5, 10].map((k) => k * s).find((k) => (hi - lo) / k <= 7) ?? 10 * s;
  return [Math.floor(lo / st) * st, Math.ceil(hi / st) * st, st];
}

// ---------------------------------------------------------------------------
// 1. Circular P-M Diagram & Cross-Section (`dgCD`, `dgDB`, `dgSec`, `tbBar`)
// ---------------------------------------------------------------------------

export interface CircularPmDrawOptions {
  prefix?: ContextPrefix;
  state?: 'CD' | 'DB';
  targetId?: string;
}

export interface CircularSectionDrawOptions {
  prefix?: ContextPrefix;
  targetId?: string;
  tableId?: string;
}

const lastCircularSectionTracker = new Map<
  ContextPrefix,
  { sectionRef: unknown; lastState: 'CD' | 'DB' }
>();

function inferCircularLimitState(
  prefix: ContextPrefix,
  curve: CircularPmCurveResult | null | undefined,
  loads: readonly CircularPmLoadCase[],
  section: CircularSection | null | undefined,
  explicitState?: 'CD' | 'DB',
): 'CD' | 'DB' {
  if (explicitState === 'CD' || explicitState === 'DB') return explicitState;

  const phic = num('phic', 0.75);
  const phicE = num('phicE', 1.0);
  if (
    curve &&
    section &&
    Number.isFinite(curve.cap) &&
    Number.isFinite(section.kP) &&
    Number.isFinite(section.Po) &&
    Math.abs(phic - phicE) > 1e-6
  ) {
    const capCd = phic * section.kP * section.Po;
    const capDb = phicE * section.kP * section.Po;
    return Math.abs(curve.cap - capCd) <= Math.abs(curve.cap - capDb) ? 'CD' : 'DB';
  }

  const phit = num('phit', 0.9);
  const phitE = num('phitE', 1.0);
  const firstPhi = curve?.pts?.[0]?.phi;
  if (typeof firstPhi === 'number' && Number.isFinite(firstPhi) && Math.abs(phit - phitE) > 1e-6) {
    return Math.abs(firstPhi - phit) <= Math.abs(firstPhi - phitE) ? 'CD' : 'DB';
  }

  const st3 = contextState.ST3 as St3StateMap | null;
  if (st3?.CD?.loads && st3?.DB?.loads && loads.length) {
    const sameLoads = (cand: ReadonlyArray<{ nm: string; P: number; M: number }>) =>
      cand.length === loads.length &&
      cand.every(
        (c, idx) =>
          c.nm === loads[idx]?.nm &&
          Math.abs(c.P - (loads[idx]?.P ?? 0)) < 1e-6 &&
          Math.abs(c.M - (loads[idx]?.M ?? 0)) < 1e-6,
      );
    const hitCd = sameLoads(st3.CD.loads);
    const hitDb = sameLoads(st3.DB.loads);
    if (hitCd !== hitDb) return hitCd ? 'CD' : 'DB';
  }

  const prev = lastCircularSectionTracker.get(prefix);
  const nextState: 'CD' | 'DB' =
    prev && prev.sectionRef === section && prev.lastState === 'CD' ? 'DB' : 'CD';
  lastCircularSectionTracker.set(prefix, { sectionRef: section, lastState: nextState });
  return nextState;
}

/**
 * Draw 2D circular column `φPn - φMn` interaction diagram into `#dgCD` or `#dgDB`.
 * Exact port of `draw(svg, C, loads)` (`02_core_utils_and_column_pm.js:243-282`).
 */
export function drawCircularPmSvg(
  curve: CircularPmCurveResult | null | undefined,
  loads: readonly CircularPmLoadCase[] = [],
  options: CircularPmDrawOptions = {},
): string {
  const prefix = options.prefix ?? '';
  const targetId = options.targetId ?? (options.state === 'DB' ? 'dgDB' : 'dgCD');
  const W = 560;
  const H = 380;

  if (!curve || !Array.isArray(curve.pts) || curve.pts.length === 0) {
    const el = resolveDomElement(targetId, prefix, true);
    if (el) el.innerHTML = '';
    return '';
  }

  const ml = 62;
  const mr = 16;
  const mt = 14;
  const mb = 40;
  const cap = Number.isFinite(curve.cap) ? curve.cap : 0;
  const side = curve.pts.map((p) => ({
    x: Number.isFinite(p.M) ? p.M : 0,
    y: Math.min(Number.isFinite(p.P) ? p.P : 0, cap),
  }));
  const poly = [
    ...side,
    { x: 0, y: cap },
    ...side
      .slice()
      .reverse()
      .map((p) => ({ x: -p.x, y: p.y })),
  ];

  const validLoads = loads.filter((l) => Number.isFinite(l?.M) && Number.isFinite(l?.P));
  const xs = [...poly.map((p) => p.x), ...validLoads.map((l) => l.M)];
  const ys = [...poly.map((p) => p.y), ...validLoads.map((l) => l.P)];

  const [x0, x1, sx] = niceAxisBounds(Math.min(...xs), Math.max(...xs));
  const [y0, y1, sy] = niceAxisBounds(Math.min(...ys), Math.max(...ys));
  const X = (val: number) => ml + ((val - x0) / (x1 - x0 || 1)) * (W - ml - mr);
  const Y = (val: number) => H - mb - ((val - y0) / (y1 - y0 || 1)) * (H - mt - mb);

  let g = `<style>text{font-family:"Times New Roman",Times,serif;font-size:12px;fill:#111}</style><rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>`;
  for (let xv = x0; xv <= x1 + 1e-6; xv += sx) {
    const isZero = Math.abs(xv) < 1e-6;
    const xx = X(xv);
    g += `<line x1="${xx.toFixed(2)}" x2="${xx.toFixed(2)}" y1="${mt}" y2="${H - mb}" stroke="${isZero ? '#666' : '#d0d4d8'}" stroke-width="${isZero ? 1.4 : 0.6}"/><text x="${xx.toFixed(2)}" y="${H - mb + 15}" text-anchor="middle">${Math.round(xv)}</text>`;
  }
  for (let yv = y0; yv <= y1 + 1e-6; yv += sy) {
    const isZero = Math.abs(yv) < 1e-6;
    const yy = Y(yv);
    g += `<line x1="${ml}" x2="${W - mr}" y1="${yy.toFixed(2)}" y2="${yy.toFixed(2)}" stroke="${isZero ? '#666' : '#d0d4d8'}" stroke-width="${isZero ? 1.4 : 0.6}"/><text x="${ml - 6}" y="${(yy + 4).toFixed(2)}" text-anchor="end">${Math.round(yv)}</text>`;
  }
  g += `<polygon points="${poly.map((p) => `${X(p.x).toFixed(2)},${Y(p.y).toFixed(2)}`).join(' ')}" fill="rgba(31,78,121,.06)" stroke="#1f4e79" stroke-width="2"/>`;
  validLoads.forEach((l, i) => {
    const cx = X(l.M);
    const cy = Y(l.P);
    g += `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="4" fill="#c00000"/><text x="${(cx + 7).toFixed(2)}" y="${(cy - 6).toFixed(2)}" style="fill:#c00000;font-weight:bold">${i + 1}</text>`;
  });
  g += `<text x="${(ml + W - mr) / 2}" y="${H - 6}" text-anchor="middle">φMn (kN.m)</text><text transform="translate(14,${(mt + H - mb) / 2}) rotate(-90)" text-anchor="middle">φPn (kN)</text>`;
  g += `<rect x="${ml}" y="${mt}" width="${W - ml - mr}" height="${H - mt - mb}" fill="none" stroke="#666" stroke-width=".8"/>`;

  return renderInlineSvg(targetId, W, H, g, prefix);
}

/**
 * Draw circular cross-section (`#dgSec`) and populate rebar coordinate table (`#tbBar`).
 * Exact port of `drawSection(S)` (`12_piles_geotech_mcoc_and_pm3d.js:3593-3658`).
 */
export function drawCircularSectionSvg(
  section: CircularSection | null | undefined,
  options: CircularSectionDrawOptions = {},
): { svg: string; tableHtml: string } {
  const prefix = options.prefix ?? '';
  const targetId = options.targetId ?? 'dgSec';
  const tableId = options.tableId ?? 'tbBar';
  const W = 440;
  const H = 440;

  if (!section || !(section.R > 0)) {
    const el = resolveDomElement(targetId, prefix, true);
    if (el) el.innerHTML = '';
    writeHtmlTarget(tableId, '', prefix);
    return { svg: '', tableHtml: '' };
  }

  return withCtx(prefix, () => {
    const cx = W / 2;
    const cy = 205;
    const R = section.R;
    const sc = 165 / R;
    const X = (xv: number) => cx + xv * sc;
    const Y = (yv: number) => cy - yv * sc;
    const dsp = num('Dv', 0);
    const sp = num('s', 0);
    const L1 = section.layers[0];
    const layerColors = ['#1a1a1a', '#7a2a00', '#00507a'];

    let g = `<style>text{font-family:"Times New Roman",Times,serif;font-size:12px;fill:#111}</style><rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>`;
    g += `<line x1="${cx - R * sc - 18}" x2="${cx + R * sc + 18}" y1="${cy}" y2="${cy}" stroke="#888" stroke-width=".7" stroke-dasharray="10 3 2 3"/>`;
    g += `<line y1="${cy - R * sc - 18}" y2="${cy + R * sc + 18}" x1="${cx}" x2="${cx}" stroke="#888" stroke-width=".7" stroke-dasharray="10 3 2 3"/>`;
    g += `<circle cx="${cx}" cy="${cy}" r="${(R * sc).toFixed(2)}" fill="#e9ecef" stroke="#111" stroke-width="1.6"/>`;

    if (L1 && dsp > 0) {
      const rs = R - L1.c + L1.d / 2 + dsp / 2;
      if (rs > 0) {
        g += `<circle cx="${cx}" cy="${cy}" r="${(rs * sc).toFixed(2)}" fill="none" stroke="#2f7fb0" stroke-width="${Math.max(1, dsp * sc).toFixed(2)}" />`;
      }
    }

    section.layers.forEach((Ly) => {
      const rLayer = Math.max(0, R - Ly.c);
      g += `<circle cx="${cx}" cy="${cy}" r="${(rLayer * sc).toFixed(2)}" fill="none" stroke="#999" stroke-width=".6" stroke-dasharray="3 3"/>`;
    });

    const showNum = section.bars.length <= 60;
    for (const b of section.bars) {
      const color = layerColors[b.L - 1] ?? '#1a1a1a';
      g += `<circle cx="${X(b.x).toFixed(2)}" cy="${Y(b.y).toFixed(2)}" r="${Math.max(2, (b.d / 2) * sc).toFixed(2)}" fill="${color}"/>`;
      if (showNum && b.L === 1 && L1) {
        const rr = R - L1.c - b.d / 2 - 14 / sc;
        const ang = Math.atan2(b.y, b.x);
        g += `<text x="${X(rr * Math.cos(ang)).toFixed(2)}" y="${(Y(rr * Math.sin(ang)) + 4).toFixed(2)}" text-anchor="middle" style="font-size:10px">${b.i}</text>`;
      }
    }

    const yb = cy + R * sc + 28;
    g += `<line x1="${X(-R).toFixed(2)}" x2="${X(R).toFixed(2)}" y1="${yb.toFixed(2)}" y2="${yb.toFixed(2)}" stroke="#111" stroke-width=".8"/>`;
    for (const xv of [-R, R]) {
      g += `<line x1="${X(xv).toFixed(2)}" x2="${X(xv).toFixed(2)}" y1="${(yb - 6).toFixed(2)}" y2="${(yb + 6).toFixed(2)}" stroke="#111" stroke-width=".8"/><line x1="${X(xv).toFixed(2)}" x2="${X(xv).toFixed(2)}" y1="${cy}" y2="${(yb + 6).toFixed(2)}" stroke="#aaa" stroke-width=".5"/>`;
    }
    g += `<text x="${cx}" y="${(yb - 4).toFixed(2)}" text-anchor="middle" style="font-weight:bold">D = ${fx(section.D, 0)}</text>`;

    if (L1) {
      const rr = Math.max(0, R - L1.c) * sc;
      g += `<line x1="${cx}" y1="${cy}" x2="${(cx + rr * Math.cos(-Math.PI / 4)).toFixed(2)}" y2="${(cy + rr * Math.sin(Math.PI / 4)).toFixed(2)}" stroke="#c00000" stroke-width=".8"/><text x="${(cx + rr * 0.22).toFixed(2)}" y="${(cy + rr * 0.4).toFixed(2)}" text-anchor="end" style="fill:#c00000">Rb = ${fx(R - L1.c, 0)}</text>`;
      g += `<text x="${(cx - R * sc).toFixed(2)}" y="${(Y(R) - 10).toFixed(2)}" text-anchor="start">a = ${fx(L1.c, 0)} (tim thép → mép)</text>`;
    }

    const lab = section.layers.map((Ly, k) => `Lớp ${k + 1}: ${Ly.n}Ø${Ly.d}`).join(' ; ');
    g += `<text x="${cx}" y="${H - 24}" text-anchor="middle" style="font-weight:bold">${lab}${dsp > 0 ? ` ; Cốt xoắn Ø${dsp} a${fx(sp, 0)}` : ''}</text>`;
    const rhoPct = section.Ac > 0 ? (section.As / section.Ac) * 100 : 0;
    g += `<text x="${cx}" y="${H - 8}" text-anchor="middle">As = ${fx(section.As, 0)} mm² ; ρ = ${fx(rhoPct, 3)}% ; Dr = ${fx(section.Dr, 0)} mm</text>`;

    const svg = renderInlineSvg(targetId, W, H, g, prefix);

    const bars = section.bars;
    const per = Math.ceil(bars.length / 2);
    let t = '<tr>' + '<th>Thanh</th><th>Lớp</th><th>x (mm)</th><th>y (mm)</th>'.repeat(2) + '</tr>';
    for (let i = 0; i < per; i++) {
      t += '<tr>';
      for (let k = 0; k < 2; k++) {
        const b = bars[i + k * per];
        t += b
          ? `<td class="c">${b.i}</td><td class="c">${b.L}</td><td>${fx(Math.abs(b.x) < 1e-6 ? 0 : b.x, 1)}</td><td>${fx(Math.abs(b.y) < 1e-6 ? 0 : b.y, 1)}</td>`
          : '<td></td><td></td><td></td><td></td>';
      }
      t += '</tr>';
    }
    writeHtmlTarget(tableId, t, prefix);
    return { svg, tableHtml: t };
  });
}

/**
 * Engine hook handler for `VisualReportHooks.renderCircularPm`.
 */
export function renderCircularPmHook(payload: {
  prefix: ContextPrefix;
  curve: unknown;
  loads: unknown[];
  section: unknown;
  state?: 'CD' | 'DB';
}): { state: 'CD' | 'DB'; pmSvg: string; sectionSvg: string; tableHtml: string } | null {
  const curve = payload.curve as CircularPmCurveResult | null | undefined;
  const loads = Array.isArray(payload.loads) ? (payload.loads as CircularPmLoadCase[]) : [];
  const section = payload.section as CircularSection | null | undefined;
  if (!curve) return null;

  return withCtx(payload.prefix, () => {
    const state = inferCircularLimitState(payload.prefix, curve, loads, section, payload.state);
    const pmSvg = drawCircularPmSvg(curve, loads, {
      prefix: payload.prefix,
      state,
      targetId: state === 'DB' ? 'dgDB' : 'dgCD',
    });
    const secRes = section
      ? drawCircularSectionSvg(section, { prefix: payload.prefix })
      : { svg: '', tableHtml: '' };
    runMathSafe(undefined, payload.prefix);
    return {
      state,
      pmSvg,
      sectionSvg: secRes.svg,
      tableHtml: secRes.tableHtml,
    };
  });
}

// ---------------------------------------------------------------------------
// 2. Interactive 3D P-M-M Surface (`p3d`, `b3CD`, `b3DB`, `tbBi`, `klBi`)
// ---------------------------------------------------------------------------

/**
 * Engine hook handler for `VisualReportHooks.renderPm3d`.
 * Safely delegates to `plots3d.ts#render3`, skipping WebGL/Plotly if DOM is missing
 * or container `clientWidth === 0` (rendering deterministic 2D SVG fallback instead).
 */
export function renderPm3dHook(payload: {
  prefix: ContextPrefix;
  state: Pm3dLimitState;
  st3: unknown;
}): Render3Result | null {
  const st3 = payload.st3 as Pm3dStateStore | null | undefined;
  if (!st3 || (!st3.CD && !st3.DB)) return null;

  const cur3: Pm3dLimitState = payload.state === 'DB' ? 'DB' : 'CD';
  return withCtx(payload.prefix, () => {
    contextState.cur3 = cur3;
    if (!hasDom()) {
      return render3Plot({
        st3,
        cur3,
        prefix: payload.prefix,
        usePlotly: false,
      });
    }

    const gd = resolveDomElement('p3d', payload.prefix, true) as HTMLElement | null;
    const canMountPlotly = Boolean(gd && gd.clientWidth > 0);
    return render3Plot({
      st3,
      cur3,
      prefix: payload.prefix,
      usePlotly: canMountPlotly,
      onSelectState: (next) => {
        renderPm3dHook({ prefix: payload.prefix, state: next, st3 });
      },
    });
  });
}

// ---------------------------------------------------------------------------
// 3. Shallow Foundation Diagrams & Cap Stress (`sfFigEl/Pl/Sl`, `sfCapFig`)
// ---------------------------------------------------------------------------

export interface ShallowCapMetaInput {
  B: number;
  L: number;
  h: number;
  s1: number;
  s2: number;
  sName: string;
}

export interface ShallowCapLoadInput {
  id: string;
  V: number;
  My: number;
  Mx: number;
}

/**
 * Figure 1: Elevation schematic, governing bearing pressure, and force diagram (`{p}dgEl`).
 * Exact port of `sfFigEl` (`14_pier_solid_dct_and_shallow_fdn_ui.js:4094-4249`).
 */
export function sfFigEl(
  p: string,
  P: ShallowFootingParams,
  r: ShallowFootingComboCheck | null | undefined,
  meta: ShallowFootingMeta,
): string {
  const targetId = p + 'dgEl';
  const sv = hasDom() ? (document.getElementById(targetId) as unknown as SVGElement | null) : null;
  const id = p + 'El';
  const d = sfKit(id);
  const W = 760;

  if (!r || !(P.B > 0) || !(P.L > 0)) {
    return dgPut(sv, W, 40, '', id);
  }

  const B = P.B;
  const Hf = meta.Hf || 1.5;
  const Df = Math.max(P.Df, 0);
  const k = Math.min(420 / B, 150 / (Hf + Df + 1.2));
  const x0 = W / 2;
  const X = (x: number) => x0 + x * k;
  const yG = 70;
  const yT = yG + Math.max(Df - Hf, 0) * k;
  const yB = yT + Hf * k;

  if (Df > 0) {
    d.poly(
      [
        [X(-B / 2) - 40, yG],
        [X(B / 2) + 40, yG],
        [X(B / 2) + 40, yB],
        [X(-B / 2) - 40, yB],
      ],
      '#f6f2ea',
      't',
    );
    d.L(X(-B / 2) - 60, yG, X(B / 2) + 60, yG, 't');
    d.T(X(B / 2) + 62, yG + 4, 'MĐTN', 'start', 'class="s"');
  }

  d.poly(
    [
      [X(-B / 2), yT],
      [X(B / 2), yT],
      [X(B / 2), yB],
      [X(-B / 2), yB],
    ],
    '#e8edf2',
  );

  const wb = meta.wStem || 0.3 * B;
  const ws = meta.xStem || 0;
  d.poly(
    [
      [X(ws - wb / 2), yG - 48],
      [X(ws + wb / 2), yG - 48],
      [X(ws + wb / 2), yT],
      [X(ws - wb / 2), yT],
    ],
    '#eef2f6',
  );
  d.T(X(ws), yG - 52, meta.stem || 'Thân', 'middle', 'class="s"');
  sfHatch(d, X(-B / 2) - 60, X(B / 2) + 60, yB, 16, P.rock);
  if (Df > 0) d.dimV(X(-B / 2) - 30, yG, yB, 'Df = ' + fx(Df, 2), -1);

  const e = r.exE != null ? r.exE : r.ex;
  const xe = X(Math.max(-B / 2, Math.min(B / 2, Number.isFinite(e) ? e : 0)));
  sfArrow(d, xe, yG - 40, xe, yT - 2);
  d.T(xe + 6, yG - 30, 'ΣV = ' + fx(r.V, 0) + ' kN', 'start', 'style="fill:#c00000"');
  sfArrow(d, X(-B / 2) - 70, yB - 6, X(-B / 2) - 8, yB - 6);
  d.T(
    X(-B / 2) - 72,
    yB - 10,
    'ΣH = ' + fx(Math.hypot(r.Hx, r.Hy), 0),
    'end',
    'style="fill:#c00000"',
  );

  {
    const cx = X(0);
    const cy = yT - 22;
    const R = 16;
    d.s += `<path d="M${cx - R},${cy} A${R},${R} 0 1,1 ${cx},${cy + R}" fill="none" stroke="#c00000" stroke-width="1.4" marker-end="url(#a${id})"/>`;
    d.T(cx - R - 4, cy - 8, 'ΣM = ' + fx(Math.abs(r.My), 0), 'end', 'style="fill:#c00000"');
  }
  d.L(X(0), yG - 60, X(0), yB + 60, 'c');

  const yq = yB + 16;
  const sc = 60 / Math.max(1, r.q || 1);
  if (!P.rock) {
    const Bp = r.Bp ?? 0;
    const s = Math.sign(e) || 1;
    const xa = s > 0 ? B / 2 - Bp : -B / 2;
    const xb = xa + Bp;
    const h = Math.max(0, (r.q || 0) * sc);
    if (Bp > 0) {
      d.poly(
        [
          [X(xa), yq],
          [X(xb), yq],
          [X(xb), yq + h],
          [X(xa), yq + h],
        ],
        '#fde9e7',
      );
      const step = Bp / 10;
      for (let x = xa; x <= xb + 1e-9; x += step) {
        sfArrow(d, X(x), yq + h, X(x), yq + 2, '#c00000');
      }
      d.T(X((xa + xb) / 2), yq + h + 16, "q = ΣV/(B'.L') = " + fx(r.q / 1000, 4) + ' MPa', 'middle');
      d.dimH(X(xa), X(xb), yq + h + 34, "B' = B - 2e = " + fx(Bp, 3) + ' m');
    }
    d.dimH(X(0), xe, yq + h + 52, 'e = ' + fx(Math.abs(e), 3));
    d.dimH(X(-B / 2), X(B / 2), yq + h + 70, 'B = ' + fx(B, 3) + ' m');
    return dgPut(sv, W, yq + h + 82, d.s, id);
  }

  const dd = (r.pr ?? press(r.V, r.My, r.Mx, P.B, P.L)) as ReturnType<typeof press> & {
    c?: number;
  };
  if (!dd || !dd.ok || typeof dd.q !== 'function') {
    return dgPut(sv, W, yq + 20, d.s, id);
  }
  const yE = (Math.sign(dd.c || 0) * P.L) / 2;
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= 60; i++) {
    const x = -B / 2 + (B * i) / 60;
    pts.push([x, dd.q(x, yE)]);
  }
  const qm = Math.max(...pts.map((q) => q[1]));
  const s2 = 60 / Math.max(qm, 1e-9);
  d.poly(
    [[X(-B / 2), yq], ...pts.map(([x, q]) => [X(x), yq + q * s2] as [number, number]), [X(B / 2), yq]],
    '#fde9e7',
  );
  pts
    .filter((_, i) => i % 6 === 0)
    .forEach(([x, q]) => {
      if (q * s2 > 6) sfArrow(d, X(x), yq + q * s2, X(x), yq + 2, '#c00000');
    });
  const a = pts[0][1];
  const b = pts[pts.length - 1][1];
  if (a > 1e-6) d.T(X(-B / 2) - 4, yq + a * s2 + 4, fx(a / 1000, 3), 'end', 'class="s"');
  if (b > 1e-6) d.T(X(B / 2) + 4, yq + b * s2 + 4, fx(b / 1000, 3), 'start', 'class="s"');
  d.T(
    X(0),
    yq + qm * s2 + 18,
    `σmax = ${fx((dd.qmax ?? 0) / 1000, 4)} MPa ; σmin = ${fx((dd.qmin ?? 0) / 1000, 4)} MPa ; phần đáy chịu nén ${fx((dd.ratio ?? 0) * 100, 1)}%`,
    'middle',
  );
  d.dimH(X(0), xe, yq + qm * s2 + 36, 'e = ' + fx(Math.abs(e), 3));
  d.dimH(X(-B / 2), X(0), yq + qm * s2 + 54, 'B/2');
  d.dimH(X(0), X(B / 2), yq + qm * s2 + 54, 'B/2');
  d.T(
    X(0),
    yq + qm * s2 + 72,
    `Ứng suất dọc mép móng chịu nén lớn nhất (y = ${yE >= 0 ? '+' : '-'}L/2), đơn vị MPa`,
    'middle',
    'class="s"',
  );
  return dgPut(sv, W, yq + qm * s2 + 80, d.s, id);
}

/**
 * Figure 2: Plan view showing effective area `B' x L'` and eccentricity limit zone (`{p}dgPl`).
 * Exact port of `sfFigPl` (`14_pier_solid_dct_and_shallow_fdn_ui.js:4251-4333`).
 */
export function sfFigPl(
  p: string,
  P: ShallowFootingParams,
  R: readonly ShallowFootingComboCheck[],
  r: ShallowFootingComboCheck | null | undefined,
  meta: ShallowFootingMeta,
): string {
  const sv = hasDom() ? (document.getElementById(p + 'dgPl') as unknown as SVGElement | null) : null;
  const id = p + 'Pl';
  const d = sfKit(id);
  const W = 760;
  const B = P.B;
  const L = P.L;

  if (!(B > 0) || !(L > 0)) {
    return dgPut(sv, W, 40, '', id);
  }

  const k = Math.min(300 / B, 300 / L);
  const X0 = 130 + (B / 2) * k;
  const Y0 = 40 + (L / 2) * k;
  const X = (x: number) => X0 + x * k;
  const Y = (y: number) => Y0 - y * k;

  d.poly(
    [
      [X(-B / 2), Y(L / 2)],
      [X(B / 2), Y(L / 2)],
      [X(B / 2), Y(-L / 2)],
      [X(-B / 2), Y(-L / 2)],
    ],
    '#f4f6f8',
  );

  if (meta.foot) {
    meta.foot.forEach((f) => {
      d.s += `<rect x="${X(f[0] - f[2] / 2).toFixed(1)}" y="${Y(f[1] + f[3] / 2).toFixed(1)}" width="${(f[2] * k).toFixed(1)}" height="${(f[3] * k).toFixed(1)}" fill="none" stroke="#555" stroke-dasharray="5,3"/>`;
    });
  }

  if (r && !P.rock && r.Bp && r.Bp > 0 && r.Lp && r.Lp > 0) {
    const ex = r.exE != null ? r.exE : r.ex;
    const ey = r.eyE != null ? r.eyE : r.ey;
    const sx = Math.sign(ex) || 1;
    const sy = Math.sign(ey) || 1;
    const xa = sx > 0 ? B / 2 - r.Bp : -B / 2;
    const ya = sy > 0 ? L / 2 - r.Lp : -L / 2;
    d.s += `<rect x="${X(xa).toFixed(1)}" y="${Y(ya + r.Lp).toFixed(1)}" width="${(r.Bp * k).toFixed(1)}" height="${(r.Lp * k).toFixed(1)}" fill="#fde9e7" stroke="#c00000"/>`;
    d.T(
      X(xa + r.Bp / 2),
      Y(ya + r.Lp / 2) + 40,
      "A' = B'.L' = " + fx(r.Bp * r.Lp, 2) + ' m²',
      'middle',
      'class="s"',
    );
    d.dimH(X(xa), X(xa + r.Bp), Y(-L / 2) + 18, "B' = " + fx(r.Bp, 3));
    d.dimV(X(B / 2) + 18, Y(ya + r.Lp), Y(ya), "L' = " + fx(r.Lp, 3), 1);
  }

  const kC = P.rock ? 0.45 : 1 / 3;
  d.s += `<rect x="${X(-kC * B).toFixed(1)}" y="${Y(kC * L).toFixed(1)}" width="${(2 * kC * B * k).toFixed(1)}" height="${(2 * kC * L * k).toFixed(1)}" fill="none" stroke="#2a6db0" stroke-dasharray="7,3"/>`;
  d.L(X(-B / 2), Y(0), X(B / 2), Y(0), 'c');
  d.L(X(0), Y(-L / 2), X(0), Y(L / 2), 'c');

  R.filter((q) => q.st !== 'SD').forEach((q) => {
    const ex = q.exE != null ? q.exE : q.ex;
    const ey = q.eyE != null ? q.eyE : q.ey;
    if (!Number.isFinite(ex) || !Number.isFinite(ey)) return;
    d.s += `<circle cx="${X(ex).toFixed(1)}" cy="${Y(ey).toFixed(1)}" r="3" fill="${q.eOK ? '#2e7d32' : '#c00000'}"/>`;
  });

  d.dimH(X(-B / 2), X(B / 2), Y(L / 2) - 14, 'B = ' + fx(B, 3) + ' m (dọc cầu)');
  d.dimV(X(-B / 2) - 18, Y(L / 2), Y(-L / 2), 'L = ' + fx(L, 3) + ' m', -1);

  const lx = X(B / 2) + 70;
  let ly = 60;
  const lg = (c: string, t: string, dash: boolean) => {
    d.s += dash
      ? `<line x1="${lx}" y1="${ly - 4}" x2="${lx + 26}" y2="${ly - 4}" stroke="${c}" stroke-dasharray="7,3"/>`
      : `<rect x="${lx}" y="${ly - 10}" width="26" height="12" fill="${c}" stroke="#c00000"/>`;
    d.T(lx + 32, ly, t, 'start', 'class="s"');
    ly += 20;
  };
  lg(
    '#2a6db0',
    'Giới hạn lệch tâm TTGH cường độ: ' + (P.rock ? '0,45B ; 0,45L (đá)' : 'B/3 ; L/3 (đất)'),
    true,
  );
  if (!P.rock) lg('#fde9e7', "Diện tích có hiệu B' x L' (tổ hợp " + (r ? r.id : '') + ')', false);
  d.s += `<circle cx="${lx + 13}" cy="${ly - 4}" r="3" fill="#2e7d32"/>`;
  d.T(lx + 32, ly, 'Vị trí hợp lực các tổ hợp (đạt)', 'start', 'class="s"');
  ly += 20;
  d.s += `<circle cx="${lx + 13}" cy="${ly - 4}" r="3" fill="#c00000"/>`;
  d.T(lx + 32, ly, 'Vị trí hợp lực vượt giới hạn', 'start', 'class="s"');
  ly += 20;
  d.s += `<rect x="${lx}" y="${ly - 10}" width="26" height="12" fill="none" stroke="#555" stroke-dasharray="5,3"/>`;
  d.T(lx + 32, ly, meta.footName || 'Chân thân trụ / tường', 'start', 'class="s"');

  return dgPut(sv, W, Y(-L / 2) + 40, d.s, id);
}

/**
 * Figure 3: Base sliding force diagram (`{p}dgSl`).
 * Exact port of `sfFigSl` (`14_pier_solid_dct_and_shallow_fdn_ui.js:4335-4375`).
 */
export function sfFigSl(
  p: string,
  P: ShallowFootingParams,
  r: ShallowFootingComboCheck | null | undefined,
): string {
  const sv = hasDom() ? (document.getElementById(p + 'dgSl') as unknown as SVGElement | null) : null;
  const id = p + 'Sl';
  const d = sfKit(id);
  const W = 760;
  if (!r) {
    return dgPut(sv, W, 30, '', id);
  }
  const x1 = 230;
  const x2 = 530;
  const y1 = 50;
  const y2 = 110;
  d.poly(
    [
      [x1, y1],
      [x2, y1],
      [x2, y2],
      [x1, y2],
    ],
    '#e8edf2',
  );
  sfHatch(d, x1 - 80, x2 + 80, y2, 16, P.rock);
  sfArrow(d, (x1 + x2) / 2, 10, (x1 + x2) / 2, y1 - 2);
  d.T((x1 + x2) / 2 + 6, 22, 'V = ' + fx(r.V, 0) + ' kN', 'start', 'style="fill:#c00000"');
  sfArrow(d, x1 - 110, y2 - 10, x1 - 4, y2 - 10);
  d.T(x1 - 112, y2 - 14, 'H = ' + fx(r.H ?? 0, 0) + ' kN', 'end', 'style="fill:#c00000"');
  sfArrow(d, x2 + 4, y2 + 6, x1 + 40, y2 + 6, '#2e7d32');
  d.T(
    (x1 + x2) / 2,
    y2 + 34,
    'RR = φτ.Rτ + φep.Rep = ' +
      fx(r.RR ?? 0, 0) +
      ' kN' +
      (P.rock ? ' ; Rτ = V.tanδ' : P.slide === 'clay' ? " ; Rτ = qs.A'" : ' ; Rτ = V.tanδ'),
    'middle',
    'style="fill:#2e7d32"',
  );
  return dgPut(sv, W, y2 + 44, d.s, id);
}

/**
 * Footing cap longitudinal section & I-I / II-II soil reaction figure (`dgSfCap6` / `dgSfCap48`).
 * Exact port of `sfCapFig` (`14_pier_solid_dct_and_shallow_fdn_ui.js:4406-4501`).
 */
export function sfCapFig(
  svId: string,
  m: ShallowCapMetaInput,
  c: ShallowCapLoadInput | null | undefined,
  lab: readonly [string, string, string],
): string {
  const sv = hasDom() ? (document.getElementById(svId) as unknown as SVGElement | null) : null;
  if (!c || !(m.B > 0) || !(m.L > 0) || !(m.h > 0)) {
    if (sv) sv.innerHTML = '';
    return '';
  }
  const d0 = press(c.V, c.My, c.Mx, m.B, m.L, 80);
  if (!d0.ok || typeof d0.q !== 'function') {
    if (sv) sv.innerHTML = '';
    return '';
  }

  const id = 'SFC' + svId;
  const d = dgKit(id);
  d.id = id;
  const W = 760;
  const k = Math.min(480 / m.B, 90 / m.h);
  const Hs = Math.min(1.6, 1.2 * m.h);
  const cx = W / 2;
  const yb = 96 + (m.h + Hs) * k;
  const X = (x: number) => cx + x * k;
  const Yz = (z: number) => yb - z * k;

  d.poly(
    [
      [X(m.s1), Yz(m.h + Hs)],
      [X(m.s2), Yz(m.h + Hs)],
      [X(m.s2), Yz(m.h)],
      [X(m.s1), Yz(m.h)],
    ],
    '#eef2f6',
  );
  d.T(X((m.s1 + m.s2) / 2), Yz(m.h + Hs) - 6, m.sName, 'middle', 'class="s"');
  d.poly(
    [
      [X(-m.B / 2), Yz(m.h)],
      [X(m.B / 2), Yz(m.h)],
      [X(m.B / 2), Yz(0)],
      [X(-m.B / 2), Yz(0)],
    ],
    '#e8edf2',
  );
  (
    [
      [m.s2, 'I'],
      [m.s1, 'II'],
    ] as const
  ).forEach(([x, t]) => {
    d.L(X(x), Yz(m.h + Hs) - 22, X(x), Yz(0) + 110, 'd');
    d.T(X(x), Yz(m.h + Hs) - 26, `${t} - ${t}`, 'middle', 'style="font-weight:bold"');
  });

  const y0 = Yz(0) + 16;
  const N = 40;
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= N; i++) {
    const x = -m.B / 2 + (m.B * i) / N;
    let s = 0;
    for (let j = 0; j <= 10; j++) s += d0.q(x, -m.L / 2 + (m.L * j) / 10);
    pts.push([x, s / 11]);
  }
  const qm = Math.max(1, ...pts.map((pt) => pt[1]));
  const kq = 60 / qm;
  d.poly(
    [[X(-m.B / 2), y0], ...pts.map(([x, q]) => [X(x), y0 + q * kq] as [number, number]), [X(m.B / 2), y0]],
    '#fde9d9',
  );
  pts.forEach(([x, q], i) => {
    if (i % 4 === 0 && q * kq > 4) d.A(X(x), y0 + q * kq, X(x), y0 + 1);
  });
  if (pts[0][1] > 1e-6) {
    d.T(X(-m.B / 2) - 6, y0 + pts[0][1] * kq + 4, fx(pts[0][1] / 1000, 3), 'end', 'class="s"');
  }
  d.T(
    X(m.B / 2) + 6,
    y0 + pts[N][1] * kq + 4,
    fx(pts[N][1] / 1000, 3) + ' MPa',
    'start',
    'class="s"',
  );

  const yd = Yz(m.h) - Hs * k - 40;
  d.dimH(X(m.s2), X(m.B / 2), yd, lab[0] + ' = ' + fx(m.B / 2 - m.s2, 3), Yz(m.h));
  d.dimH(X(m.s1), X(m.s2), yd, lab[1] + ' = ' + fx(m.s2 - m.s1, 3), Yz(m.h + Hs));
  d.dimH(X(-m.B / 2), X(m.s1), yd, lab[2] + ' = ' + fx(m.s1 + m.B / 2, 3), Yz(m.h));
  d.dimV(X(-m.B / 2) - 12, Yz(m.h), Yz(0), 'h = ' + fx(m.h, 2), -1);
  d.T(
    X(0),
    y0 + qm * kq + 18,
    'Phản lực nền trung bình theo bề rộng L (phân bố tuyến tính, không chịu kéo) - ' + c.id,
    'middle',
    'class="s"',
  );
  d.T(W / 2, 16, 'SƠ ĐỒ TÍNH BỆ MÓNG - MẶT CẮT THEO PHƯƠNG DỌC CẦU', 'middle', 'style="font-weight:bold"');
  return dgPut(sv, W, y0 + qm * kq + 30, d.s, id);
}

/**
 * Engine hook handler for `VisualReportHooks.renderShallowFdnFigs`.
 */
export function renderShallowFdnFigsHook(payload: {
  prefix: string;
  result: unknown;
}): { elSvg: string; plSvg: string; slSvg: string } | null {
  const res = payload.result as (SfRenderResult & { meta?: ShallowFootingMeta }) | null | undefined;
  if (!res || !res.P || !Array.isArray(res.R)) return null;

  const p = payload.prefix || '';
  const meta: ShallowFootingMeta = res.meta ?? {
    B: res.P.B,
    L: res.P.L,
    Df: res.P.Df,
    fc: res.P.fc,
  };
  const R = res.R;
  const g = R
    .filter((q) => q.st !== 'SD' && (q.qR ?? 0) > 0 && Number.isFinite(q.q))
    .slice()
    .sort((a, b) => b.q / (b.qR || 1) - a.q / (a.qR || 1))[0];
  const gs = R
    .filter((q) => q.st !== 'SD' && (q.RR ?? 0) > 0)
    .slice()
    .sort((a, b) => (b.H ?? 0) / (b.RR || 1) - (a.H ?? 0) / (a.RR || 1))[0];

  let elSvg = '';
  let plSvg = '';
  let slSvg = '';
  try {
    elSvg = sfFigEl(p, res.P, g, meta);
  } catch {
    elSvg = '';
  }
  try {
    plSvg = sfFigPl(p, res.P, R, g, meta);
  } catch {
    plSvg = '';
  }
  try {
    slSvg = sfFigSl(p, res.P, gs);
  } catch {
    slSvg = '';
  }

  writeTextTarget(
    p + 'capEl',
    g ? `Hình 1 - Sơ đồ lực và ứng suất đáy móng, tổ hợp bất lợi nhất về sức kháng nén: ${g.id}` : '',
    '',
  );
  writeTextTarget(
    p + 'capSl',
    gs ? `Hình 3 - Sơ đồ kiểm toán trượt, tổ hợp bất lợi nhất: ${gs.id}` : '',
    '',
  );
  runMathSafe(undefined, '');
  return { elSvg, plSvg, slSvg };
}

// ---------------------------------------------------------------------------
// 4. Pile Group Plan & Soil-Interaction Depth Profiles (`dgPlan`, `dgPD*`)
// ---------------------------------------------------------------------------

export interface PilePlanDrawOptions {
  prefix?: ContextPrefix;
  targetId?: string;
}

export interface PileDepthDrawOptions {
  prefix?: ContextPrefix;
  mcr?: McrRuntimeState | null;
  sctr?: SctCalcOutput | null;
}

const activePileGroupCache = new Map<
  ContextPrefix,
  { mcr: McrRuntimeState; sctr: SctCalcOutput | null }
>();

/**
 * Draw pile cap plan layout into `#dgPlan`.
 * Exact port of `drawPlan(piles, dd, D)` (`12_piles_geotech_mcoc_and_pm3d.js:3559-3590`).
 */
export function drawPilePlanSvg(
  piles: readonly McPileInput[],
  dd: McCapSoilInput | undefined,
  D: number,
  options: PilePlanDrawOptions = {},
): string {
  const prefix = options.prefix ?? '';
  const targetId = options.targetId ?? 'dgPlan';
  const W = 440;
  const H = 350;

  if (!piles.length) {
    const el = resolveDomElement(targetId, prefix, true);
    if (el) el.innerHTML = '';
    return '';
  }

  const xs = piles.map((p) => p.x);
  const ys = piles.map((p) => p.y);
  const axVal = dd && dd.Ax > 0 ? dd.Ax / 2 : 0;
  const byVal = dd && dd.By > 0 ? dd.By / 2 : 0;
  const dSafe = D > 0 ? D : 1;

  const x0 = Math.min(-axVal, ...xs.map((xv) => xv - dSafe));
  const x1 = Math.max(axVal, ...xs.map((xv) => xv + dSafe));
  const y0 = Math.min(-byVal, ...ys.map((yv) => yv - dSafe));
  const y1 = Math.max(byVal, ...ys.map((yv) => yv + dSafe));
  const sc = Math.min((W - 90) / (x1 - x0 || 1), (H - 90) / (y1 - y0 || 1));
  const cx = W / 2 - ((x0 + x1) / 2) * sc;
  const cy = (H - 40) / 2 - ((y0 + y1) / 2) * sc;
  const X = (xv: number) => cx + xv * sc;
  const Y = (yv: number) => cy + yv * sc;

  let g = `<style>text{font-family:"Times New Roman",Times,serif;font-size:12px;fill:#111}</style><rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>`;
  if (axVal > 0 && byVal > 0 && dd) {
    g += `<rect x="${X(-axVal).toFixed(2)}" y="${Y(-byVal).toFixed(2)}" width="${(2 * axVal * sc).toFixed(2)}" height="${(2 * byVal * sc).toFixed(2)}" fill="#eef1f3" stroke="#111" stroke-width="1.4"/>`;
  }
  g += `<line x1="${(X(x0) - 15).toFixed(2)}" x2="${(X(x1) + 25).toFixed(2)}" y1="${Y(0).toFixed(2)}" y2="${Y(0).toFixed(2)}" stroke="#888" stroke-dasharray="10 3 2 3"/>`;
  g += `<line x1="${X(0).toFixed(2)}" x2="${X(0).toFixed(2)}" y1="${(Y(y0) - 15).toFixed(2)}" y2="${(Y(y1) + 25).toFixed(2)}" stroke="#888" stroke-dasharray="10 3 2 3"/>`;
  g += `<text x="${(X(x1) + 28).toFixed(2)}" y="${(Y(0) + 4).toFixed(2)}" style="font-weight:bold">X</text>`;
  g += `<text x="${(X(0) + 6).toFixed(2)}" y="${(Y(y1) + 24).toFixed(2)}" style="font-weight:bold">Y</text>`;

  piles.forEach((p, i) => {
    const rPx = Math.max(4, (dSafe / 2) * sc);
    g += `<circle cx="${X(p.x).toFixed(2)}" cy="${Y(p.y).toFixed(2)}" r="${rPx.toFixed(2)}" fill="#fff" stroke="#1f4e79" stroke-width="1.6"/>`;
    g += `<text x="${X(p.x).toFixed(2)}" y="${(Y(p.y) + 4).toFixed(2)}" text-anchor="middle" style="font-weight:bold;fill:#1f4e79">${i + 1}</text>`;
  });
  const capDim = dd && dd.Ax > 0 && dd.By > 0 ? `Bệ ${fx(dd.Ax, 2)} x ${fx(dd.By, 2)} m ; ` : '';
  g += `<text x="${W / 2}" y="${H - 6}" text-anchor="middle">${capDim}${piles.length} cọc D = ${fx(dSafe, 2)} m</text>`;

  return renderInlineSvg(targetId, W, H, g, prefix);
}

/**
 * Draw 5-panel depth profile (`N, u, M, Q, p`) SVG and extreme-value HTML table (`#dgPD*`, `#tbPD*`).
 * Exact port of `pdDraw` (`12_piles_geotech_mcoc_and_pm3d.js:3376-3502`).
 */
export function drawPileDepthProfile(
  svgId: string,
  tbId: string,
  R: McRunResult | null | undefined,
  ks: readonly number[],
  is: readonly number[],
  dir: '2' | '3' | 'R' | string,
  options: PileDepthDrawOptions = {},
): { svg: string; tableHtml: string } {
  const prefix = options.prefix ?? '';
  const mcr = options.mcr ?? (contextState.MCR as McrRuntimeState | null);
  const sctr = options.sctr ?? (contextState.SCTR as SctCalcOutput | null);

  if (!R || !R.res?.length || !R.parts?.length || !ks.length || !is.length) {
    const svgEl = resolveDomElement(svgId, prefix, true);
    if (svgEl) svgEl.innerHTML = '';
    writeHtmlTarget(tbId, '', prefix);
    return { svg: '', tableHtml: '' };
  }

  type SeriesRow = { z: number; N: number; u: number; M: number; Q: number; p: number };
  type MetricKey = 'N' | 'u' | 'M' | 'Q' | 'p';

  const pick = (r: ReturnType<typeof pdProf>[number]): Omit<SeriesRow, 'z'> =>
    dir === '2'
      ? { N: r.N, u: r.u2 * 1000, M: r.M3, Q: r.Q2, p: r.p2 }
      : dir === '3'
        ? { N: r.N, u: r.u3 * 1000, M: r.M2, Q: r.Q3, p: r.p3 }
        : {
            N: r.N,
            u: Math.hypot(r.u2, r.u3) * 1000,
            M: Math.hypot(r.M2, r.M3),
            Q: Math.hypot(r.Q2, r.Q3),
            p: Math.hypot(r.p2, r.p3),
          };

  const C: Array<{ i: number; k: number; d: SeriesRow[] }> = [];
  for (const i of is) {
    if (i < 0 || i >= R.parts.length) continue;
    for (const k of ks) {
      if (k < 0 || k >= R.res.length) continue;
      const prof = pdProf(R, i, k, mcr, sctr);
      if (!prof.length) continue;
      C.push({ i, k, d: prof.map((row) => ({ z: row.z, ...pick(row) })) });
    }
  }

  if (!C.length) {
    const svgEl = resolveDomElement(svgId, prefix, true);
    if (svgEl) svgEl.innerHTML = '';
    writeHtmlTarget(tbId, '', prefix);
    return { svg: '', tableHtml: '' };
  }

  let gov = C[0];
  let gM = -1;
  C.forEach((c) => {
    c.d.forEach((row) => {
      if (Math.abs(row.M) > gM) {
        gM = Math.abs(row.M);
        gov = c;
      }
    });
  });

  let gN = C[0];
  let nM = -Infinity;
  C.forEach((c) => {
    if (c.d[0].N > nM) {
      nM = c.d[0].N;
      gN = c;
    }
  });

  const zmax = C[0].d[C[0].d.length - 1].z || 1;
  const l0 = mcr?.piles?.[0]?.Lo ?? 0;
  const st = zmax > 20 ? 5 : zmax > 8 ? 2 : 1;
  const W = 640;
  const H = 440;
  const top = 50;
  const bot = H - 34;
  const pw = 100;
  const gap = 18;
  const x0 = 50;
  const Y = (z: number) => top + (z / zmax) * (bot - top);

  const panels: ReadonlyArray<[MetricKey, string]> = [
    ['N', 'Lực dọc N (T)'],
    ['u', 'Chuyển vị u (mm)'],
    ['M', 'Mômen M (T.m)'],
    ['Q', 'Lực cắt Q (T)'],
    ['p', 'Phản lực đất p (T/m)'],
  ];

  const tick = (val: number) => {
    const a = Math.abs(val);
    return (
      a >= 100 ? val.toFixed(0) : a >= 10 ? val.toFixed(1) : a >= 1 ? val.toFixed(2) : val.toFixed(3)
    ).replace('.', ',');
  };

  let g = `<style>text{font-family:"Times New Roman",serif;font-size:11px;fill:#000}</style>`;
  for (let z = 0; z <= zmax + 1e-9; z += st) {
    g += `<text x="${x0 - 6}" y="${(Y(z) + 4).toFixed(1)}" text-anchor="end">${z}</text>`;
  }
  g += `<text x="13" y="${(top + bot) / 2}" transform="rotate(-90 13 ${(top + bot) / 2})" text-anchor="middle">z (m) - tính từ đáy bệ</text>`;

  panels.forEach(([key, lab], j) => {
    const X0 = x0 + j * (pw + gap);
    let mn = 0;
    let mx = 0;
    C.forEach((c) => {
      c.d.forEach((r) => {
        mn = Math.min(mn, r[key]);
        mx = Math.max(mx, r[key]);
      });
    });
    if (mx - mn < 1e-12) mx = mn + 1;
    const pad = (mx - mn) * 0.08;
    const a = mn - pad;
    const b = mx + pad;
    const X = (val: number) => X0 + ((val - a) / (b - a)) * pw;
    const G = key === 'N' ? gN : gov;

    g += `<rect x="${X0}" y="${top}" width="${pw}" height="${bot - top}" fill="none" stroke="#999"/>`;
    for (let z = 0; z <= zmax + 1e-9; z += st) {
      g += `<line x1="${X0}" x2="${X0 + pw}" y1="${Y(z).toFixed(1)}" y2="${Y(z).toFixed(1)}" stroke="#e3e3e3"/>`;
    }
    if (l0 > 0) {
      g += `<line x1="${X0}" x2="${X0 + pw}" y1="${Y(l0).toFixed(1)}" y2="${Y(l0).toFixed(1)}" stroke="#8a6d3b" stroke-dasharray="5 3"/>`;
    }
    g += `<line x1="${X(0).toFixed(1)}" x2="${X(0).toFixed(1)}" y1="${top}" y2="${bot}" stroke="#000"/>`;
    g += `<text x="${X0 + pw / 2}" y="${top - 28}" text-anchor="middle" font-weight="bold">${lab}</text><text x="${X0}" y="${top - 8}">${tick(mn)}</text><text x="${X0 + pw}" y="${top - 8}" text-anchor="end">${tick(mx)}</text>`;

    C.forEach((c) => {
      if (c === G) return;
      g += `<polyline fill="none" stroke="#b8c4d0" stroke-width="0.8" points="${c.d.map((r) => `${X(r[key]).toFixed(1)},${Y(r.z).toFixed(1)}`).join(' ')}"/>`;
    });
    g += `<polyline fill="none" stroke="#1f4e79" stroke-width="1.8" points="${G.d.map((r) => `${X(r[key]).toFixed(1)},${Y(r.z).toFixed(1)}`).join(' ')}"/>`;
    const extRow = G.d.reduce((p, q) => (Math.abs(q[key]) > Math.abs(p[key]) ? q : p));
    g += `<circle cx="${X(extRow[key]).toFixed(1)}" cy="${Y(extRow.z).toFixed(1)}" r="3" fill="#c00000"/>`;
  });

  g += `<text x="${W / 2}" y="${H - 18}" text-anchor="middle">Đường đậm: N - cọc ${gN.i + 1}, tổ hợp ${gN.k + 1} (N lớn nhất) ; u, M, Q, p - cọc ${gov.i + 1}, tổ hợp ${gov.k + 1} (|M| lớn nhất)</text>`;
  if (C.length > 1 || l0 > 0) {
    g += `<text x="${W / 2}" y="${H - 5}" text-anchor="middle">${C.length > 1 ? 'Đường mảnh: các cọc, tổ hợp còn lại' : ''}${C.length > 1 && l0 > 0 ? ' ; ' : ''}${l0 > 0 ? 'nét đứt: mặt đất tính toán' : ''}</text>`;
  }

  const svg = renderInlineSvg(svgId, W, H, g, prefix);

  const findExt = (key: MetricKey, c: { d: SeriesRow[] }, sg?: 1 | -1): SeriesRow =>
    c.d.reduce((p, q) =>
      (sg ? sg * q[key] > sg * p[key] : Math.abs(q[key]) > Math.abs(p[key])) ? q : p,
    );

  let tbHtml =
    '<tr><th colspan="3">Đại lượng</th><th>Giá trị</th><th>Đơn vị</th><th>z (m)</th><th>Cọc</th><th>T.H</th></tr>';
  const rowsSpec: ReadonlyArray<[MetricKey, string, string, 1 | -1 | undefined]> = [
    ['N', 'Lực dọc lớn nhất (nén)', 'T', 1],
    ['N', 'Lực dọc nhỏ nhất', 'T', -1],
    ['u', 'Chuyển vị ngang lớn nhất', 'mm', undefined],
    ['M', 'Mômen lớn nhất', 'T.m', undefined],
    ['Q', 'Lực cắt lớn nhất', 'T', undefined],
    ['p', 'Phản lực đất lớn nhất', 'T/m', undefined],
  ];
  for (const [key, lab, unit, sg] of rowsSpec) {
    let best: { r: SeriesRow; c: { i: number; k: number; d: SeriesRow[] } } | null = null;
    C.forEach((c) => {
      const r = findExt(key, c, sg);
      if (
        !best ||
        (sg ? sg * r[key] > sg * best.r[key] : Math.abs(r[key]) > Math.abs(best.r[key]))
      ) {
        best = { r, c };
      }
    });
    if (best) {
      const b = best as { r: SeriesRow; c: { i: number; k: number } };
      tbHtml += `<tr><td class="l" colspan="3">${lab}</td><td>${fx(b.r[key], key === 'u' ? 2 : 3)}</td><td class="c">${unit}</td><td>${fx(b.r.z, 2)}</td><td class="c">${b.c.i + 1}</td><td class="c">${b.c.k + 1}</td></tr>`;
    }
  }
  const z0 = gov.d.find(
    (r, j) => j > 0 && gov.d[0].M !== 0 && Math.sign(r.M) !== Math.sign(gov.d[0].M),
  );
  tbHtml += `<tr><td class="l" colspan="3">Độ sâu mômen đổi dấu</td><td>${z0 ? fx(z0.z, 2) : '-'}</td><td class="c">m</td><td></td><td class="c">${gov.i + 1}</td><td class="c">${gov.k + 1}</td></tr>`;

  writeHtmlTarget(tbId, tbHtml, prefix);
  return { svg, tableHtml: tbHtml };
}

function syncSelectOptions(
  selectId: string,
  options: ReadonlyArray<[string | number, string]>,
  prefix: ContextPrefix,
): string {
  const domSel = resolveDomElement(selectId, prefix, true) as HTMLSelectElement | null;
  if (!domSel) {
    const val = v(selectId, 'A');
    return options.some(([k]) => String(k) === val) ? val : String(options[0]?.[0] ?? 'A');
  }
  const prev = domSel.value;
  domSel.innerHTML = options.map(([val, label]) => `<option value="${val}">${label}</option>`).join('');
  if (options.some(([val]) => String(val) === prev)) {
    domSel.value = prev;
  }
  return domSel.value || String(options[0]?.[0] ?? 'A');
}

/**
 * Re-render interactive depth-profile view (`#dgPDV` + `#tbPDV`) from current selectors.
 */
export function updateInteractivePileDepthView(
  prefix: ContextPrefix = '',
): { svg: string; tableHtml: string } | null {
  return withCtx(prefix, () => {
    const cached = activePileGroupCache.get(prefix);
    const mcr = cached?.mcr ?? (contextState.MCR as McrRuntimeState | null);
    const sctr = cached?.sctr ?? (contextState.SCTR as SctCalcOutput | null);
    if (!mcr || !mcr.R1) return null;

    const stVal = v('pd_st', 'CD');
    const isDb = stVal === 'DB';
    const R = isDb ? mcr.R2 : mcr.R1;
    const combos = isDb ? mcr.LD : mcr.LC;
    const linkNames = mcr.lk ? (isDb ? mcr.lk.DB : mcr.lk.CD) : null;

    const comboOpts: Array<[string | number, string]> = [
      ['A', 'Bao tất cả tổ hợp'],
      ...combos.map(
        (_, k): [number, string] => [k, `${k + 1}${linkNames?.[k]?.id ? ` - ${linkNames[k].id}` : ''}`],
      ),
    ];
    const pileOpts: Array<[string | number, string]> = [
      ['A', 'Bao tất cả cọc'],
      ...mcr.piles.map((_, i): [number, string] => [i, `Cọc ${i + 1}`]),
    ];

    const skVal = syncSelectOptions('pd_th', comboOpts, prefix);
    const spVal = syncSelectOptions('pd_tc', pileOpts, prefix);
    const dirVal = v('pd_dir', '2') || '2';

    const ks = skVal === 'A' ? R.res.map((_, k) => k) : [Math.max(0, Number(skVal) || 0)];
    const is = spVal === 'A' ? mcr.piles.map((_, i) => i) : [Math.max(0, Number(spVal) || 0)];
    return drawPileDepthProfile('dgPDV', 'tbPDV', R, ks, is, dirVal, { prefix, mcr, sctr });
  });
}

/**
 * Engine hook handler for `VisualReportHooks.renderPileGroup`.
 */
export function renderPileGroupHook(payload: {
  prefix: ContextPrefix;
  mcResult: unknown;
  depthProfile?: unknown;
}): void {
  const mcr = payload.mcResult as McrRuntimeState | null | undefined;
  if (!mcr) return;

  withCtx(payload.prefix, () => {
    const sctr = (contextState.SCTR as SctCalcOutput | null) ?? null;
    activePileGroupCache.set(payload.prefix, { mcr, sctr });

    drawPilePlanSvg(mcr.piles || [], mcr.dd, mcr.D || 1, {
      prefix: payload.prefix,
      targetId: 'dgPlan',
    });

    if (!mcr.R1) return;
    const pl = (mcr.piles || []).map((_, i) => i);
    for (const [st, R] of [
      ['CD', mcr.R1],
      ['DB', mcr.R2],
    ] as const) {
      if (!R?.res?.length) continue;
      const ks = R.res.map((_, k) => k);
      for (const d of ['2', '3'] as const) {
        drawPileDepthProfile(`dgPD${st}${d}`, `tbPD${st}${d}`, R, ks, pl, d, {
          prefix: payload.prefix,
          mcr,
          sctr,
        });
      }
    }

    updateInteractivePileDepthView(payload.prefix);

    if (hasDom()) {
      for (const selId of ['pd_st', 'pd_th', 'pd_tc', 'pd_dir']) {
        const el = resolveDomElement(selId, payload.prefix, true) as HTMLSelectElement | null;
        if (el) {
          el.onchange = () => {
            updateInteractivePileDepthView(payload.prefix);
          };
        }
      }
    }
  });
}

// ---------------------------------------------------------------------------
// 5. Drilled Shaft Group Block & Capacity/Displacement Reports (`dgGrp`, `s2grp`)
// ---------------------------------------------------------------------------

export interface DrilledShaftSvgOptions {
  prefix?: ContextPrefix;
  targetId?: string;
}

type McrGroupExt = McrRuntimeState & {
  grp?: {
    piles?: McPileInput[];
    LC?: number[][];
    LD?: number[][];
  };
};

/**
 * Draw isometric 3D equivalent pier group block diagram into `#dgGrp`.
 * Exact port of `drawGrp(P, D, R, Lx, Ly, Z)` (`12_piles_geotech_mcoc_and_pm3d.js:2279-2439`).
 */
export function drawDrilledShaftGroupSvg(
  P: ReadonlyArray<{ x: number; y: number }>,
  D: number,
  R: SctCalcOutput,
  Lx: number,
  Ly: number,
  Z: number,
  options: DrilledShaftSvgOptions = {},
): string {
  const prefix = options.prefix ?? '';
  const targetId = options.targetId ?? 'dgGrp';
  const W = 520;
  const H = 430;

  if (!P.length || !R) {
    const el = resolveDomElement(targetId, prefix, true);
    if (el) el.innerHTML = '';
    return '';
  }

  return withCtx(prefix, () => {
    const ELc = Number.isFinite(R.ELcap) ? R.ELcap : num('s2_ELcap', 0);
    const L = Math.max(1e-6, ELc - R.EL3);
    const xs = P.map((q) => q.x);
    const ys = P.map((q) => q.y);
    const dSafe = D > 0 ? D : 1;
    const x0 = Math.min(...xs) - dSafe / 2;
    const x1 = Math.max(...xs) + dSafe / 2;
    const y0 = Math.min(...ys) - dSafe / 2;
    const y1 = Math.max(...ys) + dSafe / 2;
    const c30 = Math.cos(Math.PI / 6);
    const span = Math.max(1e-6, x1 - x0 + y1 - y0);
    const s = Math.min(250 / (span * c30), 170 / (span * 0.5));
    const Hp = Math.min(210, Math.max(120, L * 14));
    const sz = Hp / L;
    const xm = (x0 + x1) / 2;
    const ym = (y0 + y1) / 2;
    const cx = W / 2 + 10;

    const pr = (x: number, y: number, z: number): [number, number] => [
      cx + (x - xm - (y - ym)) * c30 * s,
      40 + (x - x0 + (y - y0)) * 0.5 * s + z * sz,
    ];
    const pt = (a: readonly [number, number]) => `${a[0].toFixed(1)},${a[1].toFixed(1)}`;
    const poly = (
      arr: ReadonlyArray<readonly [number, number]>,
      fill: string,
      st: string,
      extra = '',
    ) => `<polygon points="${arr.map(pt).join(' ')}" fill="${fill}" stroke="${st}" ${extra}/>`;
    const ln = (
      a: readonly [number, number],
      b: readonly [number, number],
      st: string,
      w: number,
      da?: string,
    ) =>
      `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="${st}" stroke-width="${w}" ${da ? `stroke-dasharray="${da}"` : ''}/>`;
    const tx = (
      p: readonly [number, number],
      t: string,
      anc = 'middle',
      ex = '',
    ) => `<text x="${p[0].toFixed(1)}" y="${p[1].toFixed(1)}" text-anchor="${anc}" ${ex}>${t}</text>`;

    let g = `<style>text{font-family:"Times New Roman",Times,serif;font-size:13px;fill:#111}</style><rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>`;
    const A: [number, number] = [x0, y0];
    const B: [number, number] = [x1, y0];
    const C: [number, number] = [x1, y1];
    const E: [number, number] = [x0, y1];

    g +=
      ln(pr(...A, 0), pr(...A, L), '#777', 1, '5 4') +
      ln(pr(...A, L), pr(...B, L), '#777', 1, '5 4') +
      ln(pr(...A, L), pr(...E, L), '#777', 1, '5 4');

    const rx = (dSafe / 2) * s * c30 * 1.41;
    const ry = (dSafe / 2) * s * 0.5 * 1.41;
    P.slice()
      .sort((a, b) => a.x + a.y - (b.x + b.y))
      .forEach((q) => {
        const t = pr(q.x, q.y, 0);
        const b = pr(q.x, q.y, L);
        g +=
          `<rect x="${(t[0] - rx).toFixed(1)}" y="${t[1].toFixed(1)}" width="${(2 * rx).toFixed(1)}" height="${(b[1] - t[1]).toFixed(1)}" fill="#d5dbe1" stroke="none"/>` +
          ln([t[0] - rx, t[1]], [b[0] - rx, b[1]], '#5b6770', 0.9) +
          ln([t[0] + rx, t[1]], [b[0] + rx, b[1]], '#5b6770', 0.9) +
          `<ellipse cx="${b[0].toFixed(1)}" cy="${b[1].toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="#c3cbd3" stroke="#5b6770" stroke-width=".9"/>`;
      });

    for (const S of (R.slices || []).filter((sl) => sl.type === 'Sét')) {
      const za = ELc - S.zt;
      const zb = ELc - S.zb;
      g +=
        poly(
          [pr(...B, za), pr(...C, za), pr(...C, zb), pr(...B, zb)],
          'rgba(166,124,82,.28)',
          'none',
        ) +
        poly(
          [pr(...C, za), pr(...E, za), pr(...E, zb), pr(...C, zb)],
          'rgba(166,124,82,.38)',
          'none',
        );
    }

    g +=
      poly(
        [pr(...B, 0), pr(...C, 0), pr(...C, L), pr(...B, L)],
        'rgba(31,78,121,.06)',
        '#111',
        'stroke-width="1.4"',
      ) +
      poly(
        [pr(...C, 0), pr(...E, 0), pr(...E, L), pr(...C, L)],
        'rgba(31,78,121,.10)',
        '#111',
        'stroke-width="1.4"',
      ) +
      poly(
        [pr(...A, 0), pr(...B, 0), pr(...C, 0), pr(...E, 0)],
        'rgba(31,78,121,.08)',
        '#111',
        'stroke-width="1.4"',
      );

    P.forEach((q) => {
      const t = pr(q.x, q.y, 0);
      g += `<ellipse cx="${t[0].toFixed(1)}" cy="${t[1].toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="#fff" stroke="#111" stroke-width="1"/>`;
    });

    const off = (a: [number, number], dx: number, dy: number): [number, number] => [
      a[0] + dx,
      a[1] + dy,
    ];
    const tk = (a: [number, number]) => ln([a[0], a[1] - 5], [a[0], a[1] + 5], '#c00000', 1);
    const dXa = pr(...E, L);
    const dXb = pr(...C, L);
    const dYa = pr(...C, L);
    const dYb = pr(...B, L);

    g +=
      ln(off(dXa, 0, 22), off(dXb, 0, 22), '#c00000', 1) +
      tk(off(dXa, 0, 22)) +
      tk(off(dXb, 0, 22)) +
      tx(
        [(dXa[0] + dXb[0]) / 2 - 6, (dXa[1] + dXb[1]) / 2 + 38],
        `${Lx <= Ly ? 'X' : 'Y'} = ${fx(x1 - x0, 2)} m`,
        'end',
        'style="fill:#c00000;font-weight:bold"',
      );

    g +=
      ln(off(dYa, 0, 22), off(dYb, 0, 22), '#c00000', 1) +
      tk(off(dYb, 0, 22)) +
      tx(
        [(dYa[0] + dYb[0]) / 2 + 6, (dYa[1] + dYb[1]) / 2 + 38],
        `${Lx <= Ly ? 'Y' : 'X'} = ${fx(y1 - y0, 2)} m`,
        'start',
        'style="fill:#c00000;font-weight:bold"',
      );

    const vA = pr(...E, 0);
    const vB = pr(...E, L);
    g +=
      ln([vA[0] - 16, vA[1]], [vB[0] - 16, vB[1]], '#c00000', 1) +
      ln([vA[0] - 21, vA[1]], [vA[0] - 11, vA[1]], '#c00000', 1) +
      ln([vB[0] - 21, vB[1]], [vB[0] - 11, vB[1]], '#c00000', 1) +
      tx(
        [vA[0] - 22, (vA[1] + vB[1]) / 2],
        `L = ${fx(L, 2)} m`,
        'end',
        'style="fill:#c00000;font-weight:bold"',
      );

    g +=
      tx(
        [pr(...B, 0)[0] + 8, pr(...B, 0)[1] - 4],
        'Phương dọc cầu',
        'start',
        'style="font-style:italic"',
      ) +
      tx(
        [pr(...E, 0)[0] - 8, pr(...E, 0)[1] - 4],
        'Phương ngang cầu',
        'end',
        'style="font-style:italic"',
      );

    g += tx(
      [W / 2, H - 26],
      `Đáy bệ EL2 = ${fx(ELc, 3)} m ; mũi cọc EL3 = ${fx(R.EL3, 3)} m ; ${P.length} cọc D = ${fx(dSafe, 2)} m`,
    );
    g +=
      `<rect x="${W / 2 - 120}" y="${H - 16}" width="14" height="10" fill="rgba(166,124,82,.45)"/>` +
      tx([W / 2 - 100, H - 7], `Đất dính trong phạm vi khối: Z = ${fx(Z, 2)} m`, 'start');

    return renderInlineSvg(targetId, W, H, g, prefix);
  });
}

/**
 * Draw Figure 5-20 `α` side-resistance reduction curves for IGM (`qu` vs `α`, optional `#dgB1`).
 * Exact port of `drawB1(R)` (`12_piles_geotech_mcoc_and_pm3d.js:2440-2485`).
 */
export function drawB1CurveSvg(
  R: SctCalcOutput | null | undefined,
  options: DrilledShaftSvgOptions = {},
): string {
  const prefix = options.prefix ?? '';
  const targetId = options.targetId ?? 'dgB1';
  const W = 520;
  const H = 400;
  const ml = 58;
  const mr = 20;
  const mt = 18;
  const mb = 46;
  const X = (q: number) => ml + (q / 5) * (W - ml - mr);
  const Y = (a: number) => H - mb - (a / 0.5) * (H - mt - mb);

  let g = `<style>text{font-family:"Times New Roman",Times,serif;font-size:12px;fill:#111}</style><rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>`;
  for (let q = 0; q <= 5; q++) {
    g += `<line x1="${X(q)}" x2="${X(q)}" y1="${mt}" y2="${H - mb}" stroke="#d0d4d8" stroke-width=".7"/><text x="${X(q)}" y="${H - mb + 16}" text-anchor="middle">${q}</text>`;
  }
  for (let k = 0; k <= 5; k++) {
    const a = k / 10;
    g += `<line x1="${ml}" x2="${W - mr}" y1="${Y(a)}" y2="${Y(a)}" stroke="#d0d4d8" stroke-width=".7"/><text x="${ml - 6}" y="${Y(a) + 4}" text-anchor="end">${a.toFixed(1)}</text>`;
  }
  g += `<rect x="${ml}" y="${mt}" width="${W - ml - mr}" height="${H - mt - mb}" fill="none" stroke="#111" stroke-width="1"/>`;

  for (let k = 0; k < 7; k++) {
    const pts: Array<[number, number]> = [];
    for (let q = 0.5; q <= 5.0001; q += 0.05) {
      const a = b1curve(k, q);
      if (a < 0.4999) pts.push([q, a]);
    }
    if (pts.length) {
      g += `<polyline points="${pts.map((p) => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(' ')}" fill="none" stroke="#111" stroke-width="1.6"/>`;
    }
  }
  for (let k = 0; k < 7; k++) {
    const q = 1.62;
    const a = b1curve(k, q);
    g += `<rect x="${(X(q) - 5).toFixed(1)}" y="${(Y(a) - 6).toFixed(1)}" width="10" height="12" fill="#fff"/><text x="${X(q).toFixed(1)}" y="${(Y(a) + 4).toFixed(1)}" text-anchor="middle" style="font-size:11px;font-weight:bold">${k + 1}</text>`;
  }

  g += `<text x="${X(2.3).toFixed(1)}" y="${Y(0.46).toFixed(1)}" style="font-size:12px">φrc = 30° ; 115 &lt; Em/qu &lt; 500 ; wt = 25 mm</text><text x="${X(2.3).toFixed(1)}" y="${Y(0.43).toFixed(1)}" style="font-size:12px">Số trên đường cong: σn/pa</text>`;
  g += `<text x="${(ml + W - mr) / 2}" y="${H - 8}" text-anchor="middle" style="font-weight:bold">qu (MPa)</text><text transform="translate(16,${(mt + H - mb) / 2}) rotate(-90)" text-anchor="middle" style="font-weight:bold">α</text>`;

  ((R && R.slices) || [])
    .filter((S) => S.type === 'IGM' && (S.igc ?? 0) > 1 && (S.alB ?? 0) > 0)
    .forEach((S) => {
      const q = Math.min(5, Math.max(0.5, S.l.qu));
      g += `<circle cx="${X(q).toFixed(1)}" cy="${Y(Math.min(S.alB ?? 0, 0.5)).toFixed(1)}" r="3.5" fill="#c00000"/>`;
    });

  return renderInlineSvg(targetId, W, H, g, prefix);
}

/**
 * Engine hook handler for `VisualReportHooks.renderDrilledShaft`.
 * Renders `#dgB1` (if mounted) for `sctStep`, and populates `#tbCmp`, `#tbGrp`,
 * `#tbDsp`, `#s2grp`, `#dgGrp` + runs `mathAll()` when `groupSvgData` is supplied by `sctCheck`.
 */
export function renderDrilledShaftHook(payload: {
  prefix: ContextPrefix;
  shaftResult: unknown;
  groupSvgData?: unknown;
}): void {
  const R = payload.shaftResult as SctCalcOutput | null | undefined;
  if (!R) return;

  withCtx(payload.prefix, () => {
    if (resolveDomElement('dgB1', payload.prefix, true)) {
      drawB1CurveSvg(R, { prefix: payload.prefix, targetId: 'dgB1' });
    }

    const chk = payload.groupSvgData as SctGroupCheckDetailed | null | undefined;
    if (!chk) {
      runMathSafe(undefined, payload.prefix);
      return;
    }

    const M = contextState.MCR as McrGroupExt | null;
    const k = 9.81;
    const PW = R.PW / k;
    const W = R.W / k;
    const P = (M?.grp ? M.grp.piles : M?.piles) || [];
    const n = P.length;
    const D = R.D;

    const rowsMap = (M?.rows || {}) as Record<
      string,
      Array<{ tc: number; th: number | string; N: number }>
    >;
    const C = rowsMap['TTGH CƯỜNG ĐỘ VÀ SỬ DỤNG'] || [];
    const B = rowsMap['TTGH ĐẶC BIỆT'] || [];
    const Lc = (M?.grp ? M.grp.LC : M?.LC) || [];
    const Ld = (M?.grp ? M.grp.LD : M?.LD) || [];

    const ext = <T extends { N: number }>(rows: T[], sg: number) =>
      rows.reduce((a, r) => (sg * r.N > sg * a.N ? r : a), rows[0]);
    const mC = C.length ? ext(C, 1) : null;
    const mB = B.length ? ext(B, 1) : null;
    const nC = C.length ? ext(C, -1) : null;
    const nB = B.length ? ext(B, -1) : null;

    const cell = (val: number | null | undefined, d = 2) =>
      `<td colspan="2">${val == null || !Number.isFinite(val) ? '-' : fx(val, d)}</td>`;
    const verdict = (a: number | null | undefined, b: number | null | undefined) => {
      if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b)) {
        return '<td class="c" colspan="2">-</td>';
      }
      const g = a >= b;
      return `<td class="c ${g ? 'ok' : 'bad'}" colspan="2">${g ? 'OK' : 'NG'}</td>`;
    };

    // 1. Single-pile compression & uplift table (#tbCmp)
    const QC = R.QRcd / k;
    const QB = R.QRdb / k;
    const NC = mC ? mC.N + PW : null;
    const NB = mB ? mB.N + PW : null;
    let cmpHtml =
      '<tr><th colspan="5">Nội dung</th><th>Đơn vị</th><th colspan="2">TTGH CĐ VÀ SD</th><th colspan="2">TTGH ĐẶC BIỆT</th></tr><tr class="grp"><td colspan="10">a) Chịu nén</td></tr>' +
      `<tr><td class="l" colspan="5">Sức chịu tải theo đất nền QR</td><td class="c">T</td>${cell(QC)}${cell(QB)}</tr>` +
      `<tr><td class="l" colspan="5">Lực dọc lớn nhất đầu cọc Nmax</td><td class="c">T</td>${cell(mC?.N)}${cell(mB?.N)}</tr>` +
      `<tr><td class="l" colspan="5">Vị trí: cọc / tổ hợp</td><td></td><td class="c" colspan="2">${mC ? `${mC.tc} / ${mC.th}` : '-'}</td><td class="c" colspan="2">${mB ? `${mB.tc} / ${mB.th}` : '-'}</td></tr>` +
      `<tr><td class="l" colspan="5">Trọng lượng cọc PW = γp.γc.As.L</td><td class="c">T</td>${cell(PW)}${cell(PW)}</tr>` +
      `<tr><td class="l" colspan="5">Tổng lực tác dụng Nmax + PW</td><td class="c">T</td>${cell(NC)}${cell(NB)}</tr>` +
      `<tr><td class="l" colspan="5">Tỷ số QR / (Nmax + PW)</td><td class="c">-</td>${cell(NC ? QC / NC : null, 3)}${cell(NB ? QB / NB : null, 3)}</tr>` +
      `<tr><td class="l" colspan="5">Kiểm tra QR ≥ Nmax + PW</td><td></td>${verdict(QC, NC)}${verdict(QB, NB)}</tr>`;

    const wlStr = v('s2_WL', '').trim();
    const wl = wlStr === '' ? Infinity : num('s2_WL', Infinity);
    const Wu = Number.isFinite(wl) && R.A > 0 && R.L > 0
      ? (() => {
          const top = R.ELcap;
          const L = R.L;
          const Lw = Math.max(0, Math.min(L, wl - (top - L)));
          return (R.A * ((R.W / (R.A * L)) * (L - Lw) + (R.W / (R.A * L) - 9.81) * Lw)) / k;
        })()
      : W;
    const tC = nC && nC.N < 0 ? -nC.N : null;
    const tB = nB && nB.N < 0 ? -nB.N : null;
    const UC = R.QupCD / k + 0.9 * Wu;
    const UB = R.QupDB / k + 0.9 * Wu;
    cmpHtml += '<tr class="grp"><td colspan="10">b) Chịu nhổ</td></tr>';
    if (tC == null && tB == null) {
      cmpHtml +=
        `<tr><td class="l" colspan="5">Lực dọc nhỏ nhất đầu cọc Nmin</td><td class="c">T</td>${cell(nC?.N)}${cell(nB?.N)}</tr>` +
        '<tr><td class="l" colspan="5">Kiểm tra</td><td></td><td class="c ok" colspan="4">Không có cọc chịu nhổ</td></tr>';
    } else {
      cmpHtml +=
        `<tr><td class="l" colspan="5">Lực nhổ lớn nhất |Nmin|</td><td class="c">T</td>${cell(tC)}${cell(tB)}</tr>` +
        `<tr><td class="l" colspan="5">Sức kháng nhổ QR,nhổ + 0.9.W (γp,min = 0.9 ; TCVN 11823-3:2017, Điều 4.1); W là trọng lượng cọc có xét đẩy nổi dưới mực nước</td><td class="c">T</td>${cell(UC)}${cell(UB)}</tr>` +
        `<tr><td class="l" colspan="5">Kiểm tra QR,nhổ + 0.9.W ≥ |Nmin|</td><td></td>${tC != null ? verdict(UC, tC) : '<td class="c" colspan="2">-</td>'}${tB != null ? verdict(UB, tB) : '<td class="c" colspan="2">-</td>'}</tr>`;
    }
    writeHtmlTarget('tbCmp', cmpHtml, payload.prefix);

    // 2. Equivalent block geometry, formulas, settlement, negative friction, uplift & punching (#s2grp, #dgGrp, #tbGrp)
    const xs = P.map((q) => q.x);
    const ys = P.map((q) => q.y);
    const Lx = n ? Math.max(...xs) - Math.min(...xs) + D : 0;
    const Ly = n ? Math.max(...ys) - Math.min(...ys) + D : 0;
    const X = Math.min(Lx, Ly);
    const Y = Math.max(Lx, Ly);
    const cl = (R.slices || []).filter((S) => S.type === 'Sét');
    const Z = cl.reduce((a, S) => a + S.dz, 0);
    const Sbar = Z > 0 ? cl.reduce((a, S) => a + (S.Su || 0) * S.dz, 0) / Z : 0;
    const tipClay = R.tip.type === 'Sét';
    const Sub = tipClay ? R.tip.Su || 0 : 0;
    const useBlock = tipClay && n > 1;
    const phig = num('s2_phig', 0.6);
    const Nc = chk.blockNc ?? (X > 0 && Y > 0 ? (Z / X <= 2.5 ? 5 * (1 + X / (5 * Y)) * (1 + Z / (5 * X)) : 7.5 * (1 + X / (5 * Y))) : 0);
    const Qg = chk.Qg ?? (2 * X + 2 * Y) * Z * Sbar + X * Y * Nc * Sub;

    const RW = (lab: string, sym = '', val = '', unit = '', ck?: [boolean, string]) =>
      `<div class="row"><span></span><span>${lab}</span><span class="sym">${sym}</span><span class="val">${val}</span><span class="unit">${unit}</span>${ck ? `<span class="note ${ck[0] ? 'ok' : 'bad'}">${ck[1]}</span>` : ''}</div>`;
    const HB = (t: string) =>
      `<div class="row"><span></span><span><b>${t}</b></span><span class="sym">-</span><span class="val">-</span><span class="unit"></span></div>`;
    const fr = (tex: string, sym = '', val = '', unit = '') =>
      FR(tex, `<span class="sym">${sym}</span><span class="val">${val}</span><span class="unit">${unit}</span>`);

    let s2Html =
      RW('Số lượng cọc trong móng', 'n', String(n), 'cọc') +
      RW('Kích thước khối móng tương đương (mép ngoài các cọc biên): X - cạnh ngắn, Y - cạnh dài') +
      fr(String.raw`X = \min\left(L_x,\,L_y\right)`, 'X', fx(X, 3), 'm') +
      fr(String.raw`Y = \max\left(L_x,\,L_y\right)`, 'Y', fx(Y, 3), 'm') +
      RW('Chiều dài cọc nằm trong đất dính', 'Z', fx(Z, 3), 'm');

    if (useBlock) {
      s2Html +=
        RW('Cường độ kháng cắt không thoát nước trung bình dọc mặt bên khối móng', 'S̄u', fx(Sbar, 1), 'kPa') +
        RW('Cường độ kháng cắt không thoát nước tại đáy khối móng', 'Su', fx(Sub, 1), 'kPa') +
        RW('Hệ số sức chịu tải của khối móng (TCVN 11823-10:2017, Điều 7.3.9 không nêu công thức ; lấy theo AASHTO LRFD, Điều 10.7.3.9)') +
        fr(
          String.raw`N_c = \begin{cases} 5\left(1 + \dfrac{X}{5Y}\right)\left(1 + \dfrac{Z}{5X}\right) & Z/X \le 2.5 \\ 7.5\left(1 + \dfrac{X}{5Y}\right) & Z/X > 2.5 \end{cases}`,
          'Nc',
          fx(Nc, 3),
        ) +
        RW('Sức kháng danh định phá hoại khối móng (Điều 7.3.9)') +
        fr(String.raw`Q_g = \left(2X + 2Y\right)Z\,\bar{S}_u + X\,Y\,N_c\,S_u`, 'Qg', fx(Qg, 1), 'kN');
    } else {
      s2Html += RW(
        n > 1
          ? 'Mũi cọc không nằm trong đất dính: không xảy ra phá hoại khối, sức kháng nhóm bằng tổng sức kháng các cọc đơn.'
          : 'Móng một cọc: không kiểm tra nhóm cọc.',
      );
    }
    s2Html +=
      RW('Sức kháng nhóm cọc') +
      fr(
        useBlock
          ? String.raw`Q_{Rg} = \min\left(n\,Q_R \;;\; \varphi_g\,Q_g\right)`
          : String.raw`Q_{Rg} = n\,Q_R`,
      );

    drawDrilledShaftGroupSvg(P, D, R, Lx, Ly, Z, { prefix: payload.prefix, targetId: 'dgGrp' });

    const Pc = Lc.length ? Math.max(...Lc.map((a) => a[2])) : null;
    const Pd = Ld.length ? Math.max(...Ld.map((a) => a[2])) : null;
    const sC = (n * R.QRcd) / k;
    const sD = (n * R.QRdb) / k;
    const bC = useBlock ? (phig * Qg) / k : null;
    const bD = useBlock ? Qg / k : null;
    const gC = chk.QRgCD ?? (useBlock && bC != null ? Math.min(sC, bC) : sC);
    const gD = chk.QRgDB ?? (useBlock && bD != null ? Math.min(sD, bD) : sD);
    const nPW = n * PW;
    const NC2 = Pc != null ? Pc + nPW : null;
    const ND2 = Pd != null ? Pd + nPW : null;
    const L5 = (lab: string) => `<td class="l" colspan="5">${lab}</td>`;
    const grpHtml =
      `<tr><th colspan="5">Nội dung</th><th>Đơn vị</th><th colspan="2">TTGH CĐ VÀ SD</th><th colspan="2">TTGH ĐẶC BIỆT</th></tr>` +
      `<tr>${L5('Tổng sức kháng các cọc đơn n.QR')}<td class="c">T</td>${cell(sC)}${cell(sD)}</tr>` +
      (useBlock ? `<tr>${L5('Sức kháng phá hoại khối φg.Qg (ĐB: φg = 1)')}<td class="c">T</td>${cell(bC)}${cell(bD)}</tr>` : '') +
      `<tr>${L5('Sức kháng nhóm cọc QRg')}<td class="c">T</td>${cell(gC)}${cell(gD)}</tr>` +
      `<tr>${L5('Lực thẳng đứng lớn nhất tại đáy bệ Pmax')}<td class="c">T</td>${cell(Pc)}${cell(Pd)}</tr>` +
      `<tr>${L5('Trọng lượng các cọc n.PW')}<td class="c">T</td>${cell(nPW)}${cell(nPW)}</tr>` +
      `<tr>${L5('Tổng lực tác dụng Pmax + n.PW')}<td class="c">T</td>${cell(NC2)}${cell(ND2)}</tr>` +
      `<tr>${L5('Tỷ số QRg / (Pmax + n.PW)')}<td class="c">-</td>${cell(NC2 ? gC / NC2 : null, 3)}${cell(ND2 ? gD / ND2 : null, 3)}</tr>` +
      `<tr>${L5('Kiểm tra QRg ≥ Pmax + n.PW')}<td></td>${verdict(gC, NC2)}${verdict(gD, ND2)}</tr>`;
    writeHtmlTarget('tbGrp', n > 1 ? grpHtml : '', payload.prefix);

    // 3. Displacements table (#tbDsp)
    const U = M?.U1 || [];
    const lh = num('s2_dhL', 25);
    const lz = num('s2_dzL', 50);
    if (U.length) {
      const mxIdx = (fn: (u: number[]) => number) =>
        U.reduce((best, u, idx) => (fn(u) > fn(U[best]) ? idx : best), 0);
      const iX = mxIdx((u) => Math.abs(u[0]));
      const iY = mxIdx((u) => Math.abs(u[1]));
      const ih = mxIdx((u) => Math.hypot(u[0], u[1]));
      const iz = mxIdx((u) => Math.abs(u[2]));
      const vX = Math.abs(U[iX][0]) * 1000;
      const vY = Math.abs(U[iY][1]) * 1000;
      const dh = Math.hypot(U[ih][0], U[ih][1]) * 1000;
      const dz = Math.abs(U[iz][2]) * 1000;
      const tr = (lab: string, idx: number, val: number, lim: number) => {
        const g = val <= lim;
        return `<tr><td class="l" colspan="4">${lab}</td><td class="c">${idx + 1}</td><td>${fx(val, 2)}</td><td>${fx(lim, 1)}</td><td class="c ${g ? 'ok' : 'bad'}">${g ? 'OK' : 'NG'}</td></tr>`;
      };
      const ok1 = dz <= lz;
      const ok2 = dz <= 101.6;
      const dspHtml =
        '<tr><th colspan="4">Chuyển vị</th><th>T.H</th><th>Giá trị (mm)</th><th>Giới hạn (mm)</th><th>Kết luận</th></tr>' +
        tr('Chuyển vị ngang theo phương dọc cầu dX', iX, vX, lh) +
        tr('Chuyển vị ngang theo phương ngang cầu dY', iY, vY, lh) +
        tr('Chuyển vị ngang tổng hợp dh = √(dX² + dY²)', ih, dh, lh) +
        `<tr><td class="l" colspan="4">Chuyển vị đứng (lún) dZ</td><td class="c">${iz + 1}</td><td>${fx(dz, 2)}</td><td>${fx(lz, 1)}</td><td class="c ${ok1 ? 'ok' : 'bad'}">${ok1 ? 'OK' : ok2 ? 'Cần chứng minh' : 'Cần Bộ GTVT chấp thuận'}</td></tr>`;
      writeHtmlTarget('tbDsp', dspHtml, payload.prefix);
    }

    // 4. Equivalent raft settlement + negative skin friction + group uplift + weak clay punching (#s2grp append)
    if (n >= 1 && R.layers?.length && R.slices?.length) {
      const tipL =
        R.layers.find((l) => l.bot < R.EL3 + 1e-9 && (l.top == null || l.top >= R.EL3 - 1e-9)) ||
        R.layers[R.layers.length - 1];
      const zTopB = Math.min(tipL.top != null ? tipL.top : R.top, R.top);
      const Db = Math.max(0, zTopB - R.EL3);
      const zEF = zTopB - (2 * Db) / 3;
      const z2 = zEF - X;
      const gran = (t: string) => t === 'Cát' || t === 'Cuội';
      const cover = R.layers.filter((l) => (l.top != null ? l.top : 1e9) > z2 && l.bot < zEF);
      const ER = num('s2_ER', 60) || 60;
      const sl = R.slices;
      const svT = sl.length ? sl[sl.length - 1].sv : 0;
      const rowsSD = C.filter((r) => /SD|Sử dụng/.test(String(r.th || '')));
      const byC: Record<string, number> = {};
      rowsSD.forEach((r) => {
        const key = String(r.th);
        byC[key] = (byC[key] || 0) + r.N;
      });
      const Psd = Math.max(0, ...Object.values(byC)) * k;

      s2Html +=
        '<div class="row"><span></span><span><b>Lún nhóm cọc theo móng tương đương (TCVN 11823-10, Điều 8.2.2.4 ; 7.2.3)</b></span></div>' +
        RW(
          `Móng tương đương đặt ở độ sâu 2Db/3 trong lớp chịu lực ${tipL.name} (Hình 15, 16): Db - chiều dài cọc trong lớp chịu lực ; cao độ móng tương đương`,
          'Db ; zEF',
          `${fx(Db, 3)} ; ${fx(zEF, 3)}`,
          'm',
        ) +
        RW('Kích thước móng tương đương (mép ngoài các cọc biên)', 'B ; Y', `${fx(X, 3)} ; ${fx(Y, 3)}`, 'm');

      if (tipL.type === 'Đá' || tipL.type === 'IGM') {
        s2Html += RW(
          `Mũi cọc trong ${tipL.type === 'Đá' ? 'đá' : 'vật liệu trung gian IGM'}: độ lún nhóm cọc do biến dạng nền dưới móng tương đương không đáng kể; độ lún cọc đơn đã kể trong chuyển vị đứng dZ ở trên.`,
        );
      } else if (cover.some((l) => !gran(l.type))) {
        s2Html += RW(
          "Trong phạm vi B dưới móng tương đương có lớp đất dính: độ lún nhóm cọc phải tính theo phương pháp móng nông trong đất dính (Điều 7.2.3.2, 6.2.4.3 - lún cố kết), cần số liệu thí nghiệm cố kết Cc, Cr, e0, σ'p; bảng tính chưa tính, phải kiểm toán bổ sung.",
          'ρ',
          'chưa tính',
        );
      } else {
        let sN = 0;
        let sZ = 0;
        const dz = 0.1;
        for (let z = zEF - dz / 2; z > z2; z -= dz) {
          const s = sl.find((q) => z <= q.zt && z >= q.zb);
          let N1: number;
          if (s) {
            N1 = s.N160 != null ? s.N160 : s.N60;
          } else {
            const l = R.layers.find((q) => q.bot <= z && (q.top == null || q.top >= z));
            if (!l) continue;
            const sv = (svT + 9 * (R.EL3 - z)) / 1000;
            const CN = Math.min(2, Math.max(0, 0.77 * Math.log10(1.92 / Math.max(sv, 1e-4))));
            N1 = (CN * l.N * ER) / 60;
          }
          if (N1 > 0) {
            sN += N1 * dz;
            sZ += dz;
          }
        }
        const N160 = sZ > 0 ? sN / sZ : 0;
        const q = X > 0 && Y > 0 ? Psd / 1000 / (X * Y) : 0;
        const Iq = X > 0 ? Math.max(0.5, 1 - (0.125 * ((2 * Db) / 3)) / X) : 0.5;
        const rho = chk.settleMm ?? (N160 > 0 ? (30 * q * Iq * Math.sqrt(X * 1000)) / N160 : Infinity);
        const okS = rho <= lz + 1e-9;
        s2Html +=
          RW('Tải trọng sử dụng lớn nhất tác dụng lên nhóm cọc (tổng lực dọc các cọc, tổ hợp Sử dụng; kể cả hoạt tải - thiên về an toàn)', 'P', fx(Psd, 1), 'kN') +
          RW('Áp lực tịnh trên móng tương đương q = P/(B.Y)', 'q', fx(q, 4), 'MPa') +
          RW('Số búa SPT hiệu chỉnh trung bình trong phạm vi B dưới móng tương đương (Điều 4.6.2.4)', 'N1,60', fx(N160, 1), 'búa/300 mm') +
          RW("Hệ số ảnh hưởng chiều sâu I = 1 - 0,125.D'/B ≥ 0,5 ; D' = 2Db/3 (PT 54)", 'I', fx(Iq, 3)) +
          RW('Độ lún nhóm cọc ρ = 30.q.I.√B / N1,60 (B tính bằng mm, PT 52)', 'ρ', fx(rho, 2), 'mm', [
            okS,
            `${okS ? 'OK' : 'NG'} ≤ ${fx(lz, 1)} mm`,
          ]);
      }

      const ddN = v('s2_ddL', '')
        .split(/[;,]/)
        .map((x) => x.trim())
        .filter(Boolean);
      if (chk.negFriction || ddN.length) {
        const SS = R.slices.filter((S) => ddN.includes(String(S.name)));
        const nf = chk.negFriction;
        const DDn = nf?.DDn ?? SS.reduce((a, S) => a + S.Rn, 0) / k;
        const QRpCD = nf?.QRpCD ?? R.QRcd / k;
        const QRpDB = nf?.QRpDB ?? R.QRdb / k;
        const nuCD = nf?.nuCD ?? (mC ? mC.N + PW + 1.25 * DDn : null);
        const nuDB = nf?.nuDB ?? (mB ? mB.N + PW + 1.25 * DDn : null);
        const nfOk = nf?.ok ?? ((nuCD == null || QRpCD >= nuCD) && (nuDB == null || QRpDB >= nuDB));
        s2Html +=
          HB("Ma sát âm (TCVN 11823-3, Điều 11.8 ; TCVN 11823-10, Điều 8.3.4)") +
          RW(
            `Lớp gây ma sát âm: ${ddN.join(' ; ')}${SS.length ? '' : ' (không khớp tên lớp trong bảng địa chất)'}`,
            'Lt',
            fx(SS.reduce((a, S) => a + S.Lt, 0), 2),
            'm',
          ) +
          RW('Lực kéo xuống danh định DD = tổng sức kháng thân cọc danh định của các lớp này (cùng phương pháp tính ma sát dương)', 'DD', fx(DDn, 2), 'T') +
          RW("Hệ số tải trọng ma sát âm γp,DD (Bảng 4, cọc khoan nhồi, phương pháp O'Neill - Reese)", 'γDD', fx(1.25, 2)) +
          RW('Sức chịu tải nén không kể ma sát dương của các lớp này: CĐ ; ĐB', "QR'", `${fx(QRpCD, 2)} ; ${fx(QRpDB, 2)}`, 'T') +
          RW(
            'Nmax + PW + γDD.DD: CĐ ; ĐB',
            'Nu',
            `${nuCD == null ? '-' : fx(nuCD, 2)} ; ${nuDB == null ? '-' : fx(nuDB, 2)}`,
            'T',
            [nfOk, nfOk ? 'OK' : 'NG'],
          );
      } else {
        s2Html += RW('Ma sát âm: không khai báo lớp đất cố kết, lún quanh cọc', 'DD', '0', 'T');
      }

      if (n > 1) {
        const minP = [...Lc, ...Ld].reduce((a, r) => Math.min(a, r[2]), Infinity);
        if (chk.groupUplift || minP < 0) {
          const gu = chk.groupUplift;
          const Pug = gu?.Pug ?? -minP;
          const WgT = gu?.Wg ?? 0;
          const QugT = gu?.Qug ?? 0;
          const phiQug = gu?.phiQug ?? 0.45 * QugT;
          const okU = gu?.ok ?? phiQug >= Pug;
          s2Html +=
            HB('Nhổ nhóm cọc (TCVN 11823-10, Điều 8.3.7.3 ; φug theo Bảng 10)') +
            RW('Lực nhổ lớn nhất tác dụng lên toàn nhóm tại đáy bệ', 'Pug', fx(Pug, 2), 'T') +
            RW(
              `Trọng lượng khối đất và cọc trong phạm vi nhóm X.Y.Σγ'.Lt, X = ${fx(X, 2)} m, Y = ${fx(Y, 2)} m`,
              'Wg',
              fx(WgT, 2),
              'T',
            ) +
            RW(`Sức kháng nhổ danh định Qug = (2X + 2Y).Z.S̄u + Wg (đất dính Z = ${fx(Z, 2)} m)`, 'Qug', fx(QugT, 2), 'T') +
            RW('Sức kháng nhổ nhóm tính toán φug.Qug, φug = 0,45', 'φQug', fx(phiQug, 2), 'T', [
              okU,
              okU ? 'OK' : 'NG',
            ]);
        } else {
          s2Html += RW(
            'Nhổ nhóm cọc: lực thẳng đứng tại đáy bệ không âm ở mọi tổ hợp, không xảy ra nhổ nhóm',
            'Pmin',
            fx(minP, 2),
            'T',
          );
        }
      }

      const weakList = chk.weakClay ?? [];
      if (weakList.length) {
        const Pk = n > 1 ? (Pc ?? 0) + n * PW : mC ? mC.N + PW : 0;
        const sc = Y > 0 ? 1 + X / (5 * Y) : 1;
        const weakRows = weakList
          .map((w) => {
            const l = (R.layers || []).find((ly) => ly.name === w.name && ly.type === 'Sét');
            const N60 = (((l?.N || 0) * ER) / 60);
            const Su = Math.min((num('s2_kSu', 5) || 5) * N60, 250);
            return RW(
              `Lớp ${w.name} (đất dính), đỉnh lớp thấp hơn mũi cọc z = ${fx(w.z, 2)} m: q = P/[(B + z)(L + z)] ; qR = 0,5 × 5,14.sc.Su, Su = ${fx(Su, 1)} kPa, sc = ${fx(sc, 3)}`,
              'q / qR',
              `${fx(w.q, 1)} / ${fx(w.qr, 1)}`,
              'kPa',
              [w.ok, w.ok ? 'OK' : 'NG'],
            );
          })
          .join('');
        s2Html +=
          HB('Nhóm cọc trên lớp đất dính yếu hơn (TCVN 11823-10, Điều 8.3.6.4 ; sức kháng đỡ theo Điều 6.3.1.2)') +
          RW(
            `Tải trọng phân bố 2V:1H từ mũi cọc${n > 1 ? ` (khối móng tương đương B = ${fx(X, 2)} m, L = ${fx(Y, 2)} m)` : ' (cọc đơn, B = L = D)'}, tải trọng thẳng đứng TTGH Cường độ`,
            'P',
            fx(Pk, 2),
            'T',
          ) +
          weakRows;
      } else {
        s2Html += RW(
          'Dưới mũi cọc không có lớp đất dính trong bảng địa chất: không kiểm tra chọc thủng lớp yếu',
          '-',
          '-',
        );
      }
    }

    writeHtmlTarget('s2grp', s2Html, payload.prefix);
    runMathSafe('s2grp', payload.prefix);
  });
}

// ---------------------------------------------------------------------------
// 6. Hook Registry Adapters
// ---------------------------------------------------------------------------

/**
 * Return the foundation & circular/3D column `VisualReportHooks` slice.
 */
export function getFoundationReportHooks(): Partial<VisualReportHooks> {
  return {
    renderMath: () => {
      runMathSafe();
    },
    renderCircularPm: renderCircularPmHook,
    renderPm3d: renderPm3dHook,
    renderShallowFdnFigs: renderShallowFdnFigsHook,
    renderPileGroup: renderPileGroupHook,
    renderDrilledShaft: renderDrilledShaftHook,
  };
}

/**
 * Register all foundation, circular P-M, and 3D P-M-M report hooks on the engine.
 */
export function registerFoundationVisualHooks(): void {
  registerVisualHooks(getFoundationReportHooks());
}
