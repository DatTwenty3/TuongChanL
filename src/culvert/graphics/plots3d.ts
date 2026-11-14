import { resolveScopedIdCandidates, type ContextPrefix } from '../types/project.ts';
import '../types/ambient.d.ts';

export interface PlotlyTrace {
  type?: string;
  mode?: string;
  name?: string;
  x?: unknown[];
  y?: unknown[];
  z?: unknown[];
  text?: string | string[];
  opacity?: number;
  colorscale?: unknown;
  showscale?: boolean;
  contours?: Record<string, unknown>;
  marker?: Record<string, unknown>;
  line?: Record<string, unknown>;
  hovertemplate?: string;
  [key: string]: unknown;
}

export interface PlotlyLayout {
  title?: string | Record<string, unknown>;
  margin?: { l?: number; r?: number; t?: number; b?: number };
  scene?: Record<string, unknown>;
  showlegend?: boolean;
  legend?: Record<string, unknown>;
  autosize?: boolean;
  width?: number;
  height?: number;
  [key: string]: unknown;
}

export interface PlotlyModule {
  react: (
    root: HTMLElement | string,
    data: PlotlyTrace[],
    layout?: PlotlyLayout,
    config?: Record<string, unknown>,
  ) => Promise<unknown>;
  toImage: (
    root: HTMLElement | string,
    opts: { format: 'png' | 'jpeg' | 'webp' | 'svg'; width?: number; height?: number; scale?: number },
  ) => Promise<string>;
  Plots: {
    resize: (root: HTMLElement | string) => unknown;
  };
}

/**
 * Exact neutral-axis ratio sweep (`c / D`) from `02_core_utils_and_column_pm.js:187-194`.
 */
export const CDL: readonly number[] = (() => {
  const ratios: number[] = [];
  for (let x = 0.002; x < 0.02; x += 0.002) ratios.push(x);
  for (let x = 0.02; x < 0.1; x += 0.005) ratios.push(x);
  for (let x = 0.1; x < 1.0001; x += 0.01) ratios.push(x);
  for (let x = 1.05; x <= 3.0001; x += 0.05) ratios.push(x);
  return ratios;
})();

export interface Pm3dBar {
  x: number;
  y: number;
  a: number;
  d?: number;
  L?: number;
  i?: number;
}

export interface Pm3dSectionInput {
  D: number;
  R: number;
  bars: readonly Pm3dBar[];
  As: number;
  fc: number;
  fy: number;
  Es: number;
  a1: number;
  b1: number;
  ecl: number;
  etl: number;
  kP: number;
  Po: number;
}

export interface Pm3dPoint {
  P: number;
  Mx: number;
  My: number;
  M: number;
}

export interface Pm3dLoadInput {
  nm: string;
  key?: string;
  P: number;
  Mx: number;
  My: number;
  M: number;
}

export interface Pm3dLoadResult extends Pm3dLoadInput {
  phiM3: number;
  ratio3: number;
}

export type Pm3dLimitState = 'CD' | 'DB';

export interface Pm3dSurfaceState {
  X: number[][];
  Y: number[][];
  Z: number[][];
  cap: number;
  loads: Pm3dLoadResult[];
}

export type Pm3dStateStore = Record<Pm3dLimitState, Pm3dSurfaceState>;

export interface Pm3dPhiParams {
  phic?: number;
  phit?: number;
  phicE?: number;
  phitE?: number;
}

export interface Render3Options {
  st3: Pm3dStateStore | null;
  cur3?: Pm3dLimitState;
  prefix?: ContextPrefix;
  root?: ParentNode | null;
  usePlotly?: boolean;
  onSelectState?: (next: Pm3dLimitState) => void;
}

export interface Render3Result {
  ok: boolean;
  minRatio: number;
  count: number;
  usedPlotly: boolean;
  tableHtml: string;
  summaryHtml: string;
}

let cachedPlotly: PlotlyModule | null = null;
let loadingPlotlyPromise: Promise<PlotlyModule | null> | null = null;

function escHtml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fx(x: number, digits = 1): string {
  return x == null || !Number.isFinite(x) ? '' : x.toFixed(digits);
}

function resolveElement(
  id: string,
  prefix: ContextPrefix = '',
  root?: ParentNode | null,
): HTMLElement | null {
  const doc = root ?? (typeof document !== 'undefined' ? document : null);
  if (!doc) return null;
  const candidates = resolveScopedIdCandidates(id, prefix);
  for (const cand of candidates) {
    const found =
      'getElementById' in doc && typeof doc.getElementById === 'function'
        ? doc.getElementById(cand)
        : doc.querySelector(`[id="${cand}"]`);
    if (found instanceof HTMLElement) return found;
  }
  return null;
}

function readNum(id: string, fallback: number, prefix: ContextPrefix = '', root?: ParentNode | null): number {
  const el = resolveElement(id, prefix, root);
  if (!el || !('value' in el)) return fallback;
  const parsed = parseFloat(String((el as HTMLInputElement).value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Single point `(phiPn, phiMx, phiMy, phiM_dir)` on the 3D interaction surface at
 * neutral-axis angle `al` and neutral-axis depth `c`.
 */
export function pt3(S: Pm3dSectionInput, al: number, c: number, phc: number, pht: number): Pm3dPoint {
  const ca = Math.cos(al);
  const sa = Math.sin(al);
  const R = S.R;
  const a = Math.min(S.b1 * c, S.D);
  const th = 2 * Math.acos(Math.max(-1, Math.min(1, (R - a) / R)));
  const Mc = ((S.a1 * S.fc * 2) / 3) * R ** 3 * Math.sin(th / 2) ** 3;
  let P = (S.a1 * S.fc * R * R * (th - Math.sin(th))) / 2;
  let Mx = Mc * sa;
  let My = Mc * ca;
  let dt = 0;

  for (const b of S.bars) {
    const d = R - (b.x * ca + b.y * sa);
    if (d > dt) dt = d;
    const e = (0.003 * (c - d)) / c;
    let fs = Math.max(-S.fy, Math.min(S.fy, S.Es * e));
    if (d < a && e > 0) fs -= S.a1 * S.fc;
    const F = fs * b.a;
    P += F;
    Mx += F * b.y;
    My += F * b.x;
  }

  const et = (0.003 * (dt - c)) / c;
  const denom = S.etl - S.ecl;
  const rawPhi = Math.abs(denom) > 1e-12 ? phc + ((pht - phc) * (et - S.ecl)) / denom : phc;
  const phi = Math.min(pht, Math.max(phc, rawPhi));

  return {
    P: (phi * P) / 1000,
    Mx: (phi * Mx) / 1e6,
    My: (phi * My) / 1e6,
    M: (phi * (Mx * sa + My * ca)) / 1e6,
  };
}

/**
 * Full meridian along neutral-axis angle `al`.
 */
export function mer3(S: Pm3dSectionInput, al: number, phc: number, pht: number): Pm3dPoint[] {
  const pts: Pm3dPoint[] = [{ P: (-pht * S.fy * S.As) / 1000, Mx: 0, My: 0, M: 0 }];
  for (const r of CDL) {
    pts.push(pt3(S, al, r * S.D, phc, pht));
  }
  return pts;
}

/**
 * Interpolate minimum flexural capacity vector `(Mx, My, M)` along a meridian at axial load `P`.
 */
export function atP(m: readonly Pm3dPoint[], P: number): { Mx: number; My: number; M: number } | null {
  let best: { Mx: number; My: number; M: number } | null = null;
  for (let i = 0; i < m.length - 1; i++) {
    const a = m[i];
    const b = m[i + 1];
    const lo = Math.min(a.P, b.P);
    const hi = Math.max(a.P, b.P);
    if (P >= lo && P <= hi && hi > lo) {
      const t = (P - a.P) / (b.P - a.P);
      const Mx = a.Mx + t * (b.Mx - a.Mx);
      const My = a.My + t * (b.My - a.My);
      const M = Math.hypot(Mx, My);
      if (!best || M < best.M) {
        best = { Mx, My, M };
      }
    }
  }
  return best;
}

/**
 * Biaxial flexural resistance `phiMn` at axial force `P` aligned to load moment angle `th`
 * via iterative neutral-axis angle refinement (`<= 8` steps).
 */
export function capDir(
  S: Pm3dSectionInput,
  th: number,
  P: number,
  phc: number,
  pht: number,
  cap: number,
): number {
  if (P > cap + 1e-9 || P < (-pht * S.fy * S.As) / 1000 - 1e-9) return 0;
  let al = th;
  let q: { Mx: number; My: number; M: number } | null = null;
  for (let iter = 0; iter < 8; iter++) {
    q = atP(mer3(S, al, phc, pht), P);
    if (!q || q.M < 1e-9) break;
    let d = th - Math.atan2(q.Mx, q.My);
    d = Math.atan2(Math.sin(d), Math.cos(d));
    if (Math.abs(d) < 1e-5) break;
    al += d;
  }
  return q ? q.M : 0;
}

/**
 * Compute 3D P-M-M interaction surface grids (`72` meridians) and capacity ratios for `CD` and `DB`.
 */
export function compute3(
  S: Pm3dSectionInput,
  LCD: readonly Pm3dLoadInput[],
  LDB: readonly Pm3dLoadInput[],
  phiParams?: Pm3dPhiParams,
  prefix: ContextPrefix = '',
  root?: ParentNode | null,
): Pm3dStateStore {
  const phic = phiParams?.phic ?? readNum('phic', 0.75, prefix, root);
  const phit = phiParams?.phit ?? readNum('phit', 0.9, prefix, root);
  const phicE = phiParams?.phicE ?? readNum('phicE', 1.0, prefix, root);
  const phitE = phiParams?.phitE ?? readNum('phitE', 1.0, prefix, root);

  const sets: Record<Pm3dLimitState, [number, number, readonly Pm3dLoadInput[]]> = {
    CD: [phic, phit, LCD],
    DB: [phicE, phitE, LDB],
  };

  const out = {} as Pm3dStateStore;
  for (const st of ['CD', 'DB'] as const) {
    const [phc, pht, loadsIn] = sets[st];
    const cap = phc * S.kP * S.Po;
    const NA = 72;
    const X: number[][] = [];
    const Y: number[][] = [];
    const Z: number[][] = [];
    const mers: Pm3dPoint[][] = [];

    for (let j = 0; j <= NA; j++) {
      mers.push(mer3(S, (2 * Math.PI * j) / NA, phc, pht));
    }
    for (let i = 0; i < mers[0].length; i++) {
      const xr: number[] = [];
      const yr: number[] = [];
      const zr: number[] = [];
      for (let j = 0; j <= NA; j++) {
        const q = mers[j][i];
        xr.push(q.Mx);
        yr.push(q.My);
        zr.push(Math.min(q.P, cap));
      }
      X.push(xr);
      Y.push(yr);
      Z.push(zr);
    }
    X.push(Array<number>(NA + 1).fill(0));
    Y.push(Array<number>(NA + 1).fill(0));
    Z.push(Array<number>(NA + 1).fill(cap));

    const loads: Pm3dLoadResult[] = loadsIn.map((l) => {
      const th = l.M > 1e-9 ? Math.atan2(l.Mx, l.My) : Math.PI / 2;
      const pm = capDir(S, th, l.P, phc, pht, cap);
      return {
        ...l,
        phiM3: pm,
        ratio3: l.M > 1e-9 ? (pm > 0 ? pm / l.M : 0) : Infinity,
      };
    });

    out[st] = { X, Y, Z, cap, loads };
  }

  return out;
}

/**
 * Build Plotly traces and layout for either `CD` or `DB` 3D interaction surface.
 */
export function fig3(
  st3: Pm3dStateStore,
  st: Pm3dLimitState = 'CD',
): { data: PlotlyTrace[]; layout: PlotlyLayout } {
  const d = st3[st];
  const L = d.loads;
  const startZ = d.Z.length && d.Z[0].length ? Math.floor(d.Z[0][0] / 2000) * 2000 : 0;

  return {
    data: [
      {
        type: 'surface',
        x: d.X,
        y: d.Y,
        z: d.Z,
        opacity: 0.5,
        showscale: false,
        colorscale: [
          [0, '#2f7fb0'],
          [1, '#2f7fb0'],
        ],
        contours: {
          z: {
            show: true,
            usecolormap: false,
            color: '#1f4e79',
            width: 1,
            start: startZ,
            end: d.cap,
            size: 2000,
          },
        },
        hovertemplate: 'φMx %{x:.0f}<br>φMy %{y:.0f}<br>φPn %{z:.0f}<extra></extra>',
      },
      {
        type: 'scatter3d',
        mode: 'markers+text',
        x: L.map((l) => l.Mx),
        y: L.map((l) => l.My),
        z: L.map((l) => l.P),
        text: L.map((_, i) => String(i + 1)),
        textposition: 'top center',
        textfont: { color: '#c00000', size: 13, family: 'Times New Roman' },
        marker: { size: 5, color: L.map((l) => (l.ratio3 >= 1 ? '#006b2d' : '#c00000')) },
        customdata: L.map((l) => l.nm),
        hovertemplate: '%{customdata}<br>Mx %{x:.1f} · My %{y:.1f}<br>Pu %{z:.1f}<extra></extra>',
      },
    ],
    layout: {
      paper_bgcolor: '#fff',
      font: { family: 'Times New Roman, serif', size: 12, color: '#111' },
      margin: { l: 0, r: 0, t: 24, b: 0 },
      showlegend: false,
      title: {
        text: st === 'CD' ? 'TTGH Cường độ và Sử dụng' : 'TTGH Đặc biệt',
        font: { size: 14 },
      },
      scene: {
        xaxis: { title: { text: 'φMx (kN.m)' }, gridcolor: '#d0d4d8' },
        yaxis: { title: { text: 'φMy (kN.m)' }, gridcolor: '#d0d4d8' },
        zaxis: { title: { text: 'φPn (kN)' }, gridcolor: '#d0d4d8' },
        aspectmode: 'manual',
        aspectratio: { x: 1, y: 1, z: 1.1 },
        camera: { eye: { x: 1.6, y: 1.6, z: 0.85 } },
      },
    },
  };
}

/**
 * Runtime check for WebGL capability (returns `false` in Node/jsdom).
 */
export function hasWebGlSupport(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    if (typeof canvas.getContext !== 'function') return false;
    return !!(
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')
    );
  } catch {
    return false;
  }
}

/**
 * Lazy-load bundled `plotly.js-dist-min` without external network calls.
 */
export async function loadPlotly(): Promise<PlotlyModule | null> {
  if (cachedPlotly) return cachedPlotly;
  if (!loadingPlotlyPromise) {
    // @ts-ignore -- `plotly.js-dist-min` has no bundled `.d.ts` and `ambient.d.ts` contains top-level exports
    loadingPlotlyPromise = import('plotly.js-dist-min')
      .then((mod) => {
        const resolved = ((mod as { default?: PlotlyModule }).default ?? mod) as PlotlyModule;
        cachedPlotly = resolved;
        return resolved;
      })
      .catch(() => null);
  }
  return loadingPlotlyPromise;
}

/**
 * Isometric / axial-moment 2D SVG fallback rendered inside `#p3d` whenever WebGL is unavailable
 * (e.g., jsdom or software-restricted browsers).
 */
export function render3FallbackSvg(st3: Pm3dStateStore, st: Pm3dLimitState = 'CD'): string {
  const d = st3[st];
  const W = 560;
  const H = 380;
  const ml = 62;
  const mr = 20;
  const mt = 32;
  const mb = 44;

  // Pick 0° (My) and 90° (Mx) meridian slices as symmetric 2D envelope + load projection
  const mer0: Array<{ M: number; P: number }> = [];
  for (let i = 0; i < d.X.length; i++) {
    const mx = d.X[i][0] ?? 0;
    const my = d.Y[i][0] ?? 0;
    const p = d.Z[i][0] ?? 0;
    mer0.push({ M: Math.hypot(mx, my), P: Math.min(p, d.cap) });
  }
  const poly = [
    ...mer0,
    { M: 0, P: d.cap },
    ...mer0
      .slice()
      .reverse()
      .map((pt) => ({ M: -pt.M, P: pt.P })),
  ];

  const ms = [...poly.map((p) => p.M), ...d.loads.map((l) => (l.Mx < 0 ? -l.M : l.M)), 1];
  const ps = [...poly.map((p) => p.P), ...d.loads.map((l) => l.P), 1];
  const mMin = Math.min(...ms);
  const mMax = Math.max(...ms);
  const pMin = Math.min(...ps);
  const pMax = Math.max(...ps);
  const mSpan = Math.max(1e-3, mMax - mMin);
  const pSpan = Math.max(1e-3, pMax - pMin);

  const sx = (m: number): number => ml + ((m - mMin) / mSpan) * (W - ml - mr);
  const sy = (p: number): number => H - mb - ((p - pMin) / pSpan) * (H - mt - mb);

  const polyPts = poly.map((p) => `${sx(p.M).toFixed(1)},${sy(p.P).toFixed(1)}`).join(' ');
  const dots = d.loads
    .map((l, idx) => {
      const signedM = l.Mx < 0 ? -l.M : l.M;
      const fill = l.ratio3 >= 1 ? '#006b2d' : '#c00000';
      return (
        `<circle cx="${sx(signedM).toFixed(1)}" cy="${sy(l.P).toFixed(1)}" r="4.2" fill="${fill}"/>` +
        `<text x="${(sx(signedM) + 6).toFixed(1)}" y="${(sy(l.P) - 5).toFixed(1)}" fill="${fill}" font-weight="bold" font-size="11">${idx + 1}</text>`
      );
    })
    .join('');

  const title = st === 'CD' ? 'TTGH Cường độ và Sử dụng (mặt cắt tổng hợp 2D)' : 'TTGH Đặc biệt (mặt cắt tổng hợp 2D)';
  return (
    `<svg class="p3d-fallback" xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>` +
    `<text x="${W / 2}" y="19" text-anchor="middle" font-family="Times New Roman, serif" font-size="13" font-weight="bold" fill="#111">${escHtml(title)}</text>` +
    `<rect x="${ml}" y="${mt}" width="${W - ml - mr}" height="${H - mt - mb}" fill="none" stroke="#9aa3a9" stroke-width="1"/>` +
    `<line x1="${sx(0).toFixed(1)}" y1="${mt}" x2="${sx(0).toFixed(1)}" y2="${H - mb}" stroke="#d0d4d8" stroke-dasharray="4 3"/>` +
    `<line x1="${ml}" y1="${sy(0).toFixed(1)}" x2="${W - mr}" y2="${sy(0).toFixed(1)}" stroke="#d0d4d8" stroke-dasharray="4 3"/>` +
    `<polygon points="${polyPts}" fill="rgba(47,127,176,0.16)" stroke="#1f4e79" stroke-width="1.8"/>` +
    dots +
    `<text x="${(ml + W - mr) / 2}" y="${H - 10}" text-anchor="middle" font-family="Times New Roman, serif" font-size="12" fill="#111">±φM (kN.m)</text>` +
    `<text transform="translate(15,${(mt + H - mb) / 2}) rotate(-90)" text-anchor="middle" font-family="Times New Roman, serif" font-size="12" fill="#111">φPn (kN)</text>` +
    `</svg>`
  );
}

/**
 * Build biaxial verification HTML table & status conclusion string matching `12_piles_geotech_mcoc_and_pm3d.js:3882-3894`.
 */
export function buildBiAxialTableHtml(st3: Pm3dStateStore): {
  tableHtml: string;
  summaryHtml: string;
  minRatio: number;
  count: number;
  ok: boolean;
} {
  let tableHtml =
    '<tr><th>No.</th><th>TTGH</th><th>COMBINATION</th><th>Pu<br>kN</th><th>Mx<br>kN-m</th><th>My<br>kN-m</th><th>Mxy<br>kN-m</th><th>φMn<br>kN-m</th><th>φMn/Mu</th></tr>';
  let minRatio = Infinity;
  let count = 0;

  for (const st of ['CD', 'DB'] as const) {
    for (const l of st3[st].loads) {
      minRatio = Math.min(minRatio, l.ratio3);
      count += 1;
      tableHtml +=
        `<tr><td class="c">${count}</td><td class="c">${st === 'CD' ? 'CĐ' : 'ĐB'}</td>` +
        `<td class="l">${escHtml(l.nm)}</td><td>${fx(l.P, 1)}</td><td>${fx(l.Mx, 1)}</td>` +
        `<td>${fx(l.My, 1)}</td><td>${fx(l.M, 1)}</td><td>${fx(l.phiM3, 1)}</td>` +
        `<td class="${l.ratio3 >= 1 ? 'ok' : 'bad'}">${Number.isFinite(l.ratio3) ? fx(l.ratio3, 3) : '∞'}</td></tr>`;
    }
  }

  const ok = count > 0 && minRatio >= 1;
  const summaryHtml = count
    ? `Min φMn/Mu (uốn hai phương) = ${Number.isFinite(minRatio) ? fx(minRatio, 3) : '∞'} → <span class="${minRatio >= 1 ? 'ok' : 'bad'}">${minRatio >= 1 ? 'ĐẠT' : 'KHÔNG ĐẠT'}</span>`
    : '';

  return { tableHtml, summaryHtml, minRatio, count, ok };
}

function applyRenderOutputs(
  options: Render3Options,
  st3: Pm3dStateStore,
  cur3: Pm3dLimitState,
  usedPlotly: boolean,
): Render3Result {
  const prefix = options.prefix ?? '';
  const root = options.root;

  const btnCD = resolveElement('b3CD', prefix, root);
  const btnDB = resolveElement('b3DB', prefix, root);
  if (btnCD) btnCD.setAttribute('aria-pressed', String(cur3 === 'CD'));
  if (btnDB) btnDB.setAttribute('aria-pressed', String(cur3 === 'DB'));

  if (options.onSelectState) {
    if (btnCD) btnCD.onclick = () => options.onSelectState?.('CD');
    if (btnDB) btnDB.onclick = () => options.onSelectState?.('DB');
  }

  const summary = buildBiAxialTableHtml(st3);
  const tbBi = resolveElement('tbBi', prefix, root);
  if (tbBi) tbBi.innerHTML = summary.tableHtml;
  const klBi = resolveElement('klBi', prefix, root);
  if (klBi) klBi.innerHTML = summary.summaryHtml;

  if (typeof window !== 'undefined') {
    const key = prefix || '_root';
    window.__biOK = window.__biOK ?? {};
    window.__biOK[key] = summary.ok;
  }

  return {
    ok: summary.ok,
    minRatio: summary.minRatio,
    count: summary.count,
    usedPlotly,
    tableHtml: summary.tableHtml,
    summaryHtml: summary.summaryHtml,
  };
}

/**
 * Synchronous render helper matching legacy `render3()` call sites: renders Plotly immediately
 * when preloaded + WebGL is active, lazily upgrades from the 2D SVG fallback if needed, and
 * stays 100% crash-free in jsdom.
 */
export function render3(options: Render3Options): Render3Result | null {
  const { st3, cur3 = 'CD', prefix = '', root, usePlotly = true } = options;
  if (!st3) return null;

  const gd = resolveElement('p3d', prefix, root) as
    | (HTMLElement & {
        layout?: PlotlyLayout & { scene?: Record<string, unknown> };
        _st?: Pm3dLimitState;
      })
    | null;

  let usedPlotly = false;
  if (gd) {
    const canPlotly = usePlotly && hasWebGlSupport();
    if (canPlotly && cachedPlotly) {
      try {
        const f = fig3(st3, cur3);
        if (gd.layout?.scene && gd._st === cur3 && f.layout.scene) {
          (f.layout.scene as Record<string, unknown>).camera = gd.layout.scene.camera;
        }
        void cachedPlotly.react(gd, f.data, f.layout, {
          displaylogo: false,
          modeBarButtonsToRemove: ['toImage'],
        });
        gd._st = cur3;
        usedPlotly = true;
      } catch {
        gd.innerHTML = render3FallbackSvg(st3, cur3);
      }
    } else {
      gd.innerHTML = render3FallbackSvg(st3, cur3);
      if (canPlotly && !cachedPlotly) {
        void loadPlotly().then((plotly) => {
          if (!plotly) return;
          try {
            const f = fig3(st3, cur3);
            gd.innerHTML = '';
            void plotly.react(gd, f.data, f.layout, {
              displaylogo: false,
              modeBarButtonsToRemove: ['toImage'],
            });
            gd._st = cur3;
          } catch {
            // Retain clean SVG fallback if WebGL initialization fails
          }
        });
      }
    }
  }

  return applyRenderOutputs(options, st3, cur3, usedPlotly);
}

/**
 * Async variant awaiting lazy Plotly load so interactive tabs and automated tests can wait
 * deterministically for rendering completion.
 */
export async function render3Async(options: Render3Options): Promise<Render3Result | null> {
  const { st3, cur3 = 'CD', prefix = '', root, usePlotly = true } = options;
  if (!st3) return null;

  const gd = resolveElement('p3d', prefix, root) as
    | (HTMLElement & {
        layout?: PlotlyLayout & { scene?: Record<string, unknown> };
        _st?: Pm3dLimitState;
      })
    | null;

  let usedPlotly = false;
  if (gd) {
    const canPlotly = usePlotly && hasWebGlSupport();
    const plotly = canPlotly ? await loadPlotly() : null;
    if (plotly) {
      try {
        const f = fig3(st3, cur3);
        if (gd.layout?.scene && gd._st === cur3 && f.layout.scene) {
          (f.layout.scene as Record<string, unknown>).camera = gd.layout.scene.camera;
        }
        gd.innerHTML = '';
        await plotly.react(gd, f.data, f.layout, {
          displaylogo: false,
          modeBarButtonsToRemove: ['toImage'],
        });
        gd._st = cur3;
        usedPlotly = true;
      } catch {
        gd.innerHTML = render3FallbackSvg(st3, cur3);
      }
    } else {
      gd.innerHTML = render3FallbackSvg(st3, cur3);
    }
  }

  return applyRenderOutputs(options, st3, cur3, usedPlotly);
}

/**
 * Resize the active Plotly 3D container on tab switches (`{ 3: '', 25: 'T_', 26: 'C_', 51: 'P_' }`).
 */
export function resize3(tabId: number, root?: ParentNode | null): void {
  const prefixMap: Readonly<Record<number, ContextPrefix>> = {
    3: '',
    25: 'T_',
    26: 'C_',
    51: 'P_',
  };
  const prefix = prefixMap[tabId];
  if (prefix == null || !cachedPlotly) return;
  const gd = resolveElement('p3d', prefix, root) as (HTMLElement & { data?: unknown }) | null;
  if (gd && gd.data) {
    try {
      cachedPlotly.Plots.resize(gd);
    } catch {
      // Ignore resize failures when element is hidden
    }
  }
}

/**
 * Render a 600×450 2× PNG image of a 3D interaction surface via bundled Plotly (for Excel/PDF export).
 */
export async function exportPlot3dPng(
  st3: Pm3dStateStore,
  st: Pm3dLimitState,
  width = 600,
  height = 450,
  scale = 2,
): Promise<string> {
  const plotly = await loadPlotly();
  if (!plotly) {
    throw new Error('Không tải được thư viện vẽ 3D.');
  }
  const f = fig3(st3, st);
  f.layout.width = width;
  f.layout.height = height;
  return plotly.toImage({ data: f.data, layout: f.layout } as unknown as HTMLElement, {
    format: 'png',
    width,
    height,
    scale,
  });
}
