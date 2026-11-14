/**
 * Clean-Room Culvert Hydrology, Hydraulic Sizing & DXF+DEM Catchment Processor
 *
 * Verbatim TypeScript port of `analysis-cau-cong/modules/17_culvert_hydrology_and_dxftools.js`
 * (`TVC_Q`, `tvcSize`, `tvcHV`, `tvcRows`, `tvcSave`, `TVC_BAN`, `TVC_COLS`, `tvcEditor`,
 * `tvcSched`, `tvcStFill`, `tvcSer`, `tvcStLoad`, `tvcHp`, `tvcCalc`, `tvcStep`, `TVCR`,
 * `TVX`, `tvmGeo`, `tvmKm`, `tvmSort`, `tvmSaveGeo`, `tvmXY`, `tvxDemBg`, `tvxOne`,
 * `tvxFile`, `tvxRun`, and marching-squares `tvxContours`), plus internal clean-room copies
 * of TCVN 9845:2013 & Pearson III / Kritski-Menkel helpers (`HV`, `HVKM`, `HVM`, `hvStepT`,
 * `hvTab`) from `15_bridge_hydrology_data_and_calc.js`.
 *
 * Zero licensing code, zero external CDN URLs. Visual SVG/map rendering in `tvcStep`
 * is cleanly delegated to `getVisualHooks().renderHydrology?.({ mode: 'culvert', result })`.
 */

import {
  TVC_ST,
  TM_DB,
  tmSlug,
  tmParse,
  tmLabel,
  tmAdd,
  tmSave,
  HVST,
  HVTAB,
  type TvcStationRow,
  type RainSeriesEntry,
} from './stationsDb';
import { HVD, hdLoad, type HvdRunResult } from './demWatershed';
import {
  tvxArea,
  tvxIn,
  tvxKm,
  tvxLen,
  tvxGap,
  tvxDseg,
  tvxDpoly,
  parseCulvertDxfText,
  decodeDxfBuffer,
  dxsTxt,
  type CulvertDxfParsedState,
  type CulvertDxfEndMarker,
  type DxfParseResult,
  type DxfPolyline,
} from '../importers/dxfParser';
import { $, v, set, num, cf, fx, getVisualHooks } from '../context';
import type { DemSourceKind, HydrologyResult, Point2D } from '../../types/project';

type CulvertDxfBasin = CulvertDxfParsedState['bas'][number];
type CulvertDxfKmLabel = CulvertDxfParsedState['kms'][number];
type CulvertDxfAreaLabel = CulvertDxfParsedState['FL'][number];
type CulvertDxfDot = CulvertDxfParsedState['dots'][number];
type CulvertDxfRoute = CulvertDxfParsedState['routes'][number];

// Re-export shared station & DXF geometry symbols imported above for caller convenience.
export {
  TVC_ST,
  TM_DB,
  tmSlug,
  tmParse,
  tmLabel,
  tmAdd,
  tmSave,
  tvxArea,
  tvxIn,
  tvxKm,
  tvxLen,
  tvxGap,
  tvxDseg,
  tvxDpoly,
  parseCulvertDxfText,
};

// ============================================================================
// 1. Domain Interfaces & Types
// ============================================================================

export interface TvcDischargeRow {
  s: string;
  Q: number;
  r: ReadonlyArray<readonly [number, number, number]>;
}

export interface TvcSizeSpec {
  b: number;
  h: number;
  key: string;
}

export interface TvcHvLookupResult {
  H?: number;
  V?: number;
  lo?: boolean;
  out?: boolean;
  qmax?: number;
  a?: readonly [number, number, number];
  b?: readonly [number, number, number];
}

export interface TvcRowInput {
  km?: string;
  name?: string;
  F?: string | number;
  L?: string | number;
  sl?: string | number;
  Jls?: string | number;
  Jsd?: string | number;
  two?: string | number;
  typ?: 'tron' | 'hop' | 'ban' | string;
  d?: string | number;
  n?: string | number;
  h?: string | number;
  zd?: string | number;
  i?: string | number;
  zr?: string | number;
  src?: 'dxf' | 'td' | string;
  [key: string]: unknown;
}

export type TvcColKind = 't' | 's2' | 'st' | 'sd';

export type TvcColDef =
  | readonly [keyof TvcRowInput & string, string, number]
  | readonly [keyof TvcRowInput & string, string, number, TvcColKind];

export interface TvcSerSummary {
  nm: string;
  n: number;
  y0: number;
  y1: number;
  Xm: number;
  Cv: number;
  Cs: number;
  KP: number;
  pm: 'mom' | 'fit';
  dist: 'p3' | 'km' | string;
  csOK?: boolean;
}

export interface TvcHpInput {
  hps?: 'ser' | 'tram' | 'tay';
  st?: number | string;
  st2?: string;
  stn?: string;
  rain?: string;
  ser?: Array<{ y: number; x: number }>;
  rm?: 'mom' | 'fit';
  rd?: 'p3' | 'km';
  Hp?: number;
}

export interface TvcHpResult {
  Hp: number;
  how?: string;
  warn?: string;
  ser?: TvcSerSummary;
}

export interface TvcCalcCommon {
  P: number;
  Hp: number;
  how?: string;
  hwarn?: string;
  ser?: TvcSerSummary;
  reg: string;
  cls: string;
  msd: number;
  mls: number;
  fao: number;
  aoPos: string;
  kgc: number;
  phi: number;
  nc: number;
  xoi: boolean;
  hd: number;
}

export interface TvcQpDetail {
  Hp: number;
  warn: string[];
  B: number;
  k: number;
  Lsd: number;
  A1: unknown;
  phi: number;
  phisd: number;
  tau: number;
  noCh: boolean;
  phils: number;
  A3: unknown;
  Ap: number;
  delta: number;
  Q: number;
  q: number;
}

export interface TvcSlabHydraulics {
  qd: number;
  hk: number;
  hc: number;
  w: number;
  Vc: number;
  H0: number;
  hn: number | null;
  ho: number;
  Vra: number;
}

export interface TvcCulvertOutcome {
  i: number;
  r: TvcRowInput;
  km: string;
  name: string;
  F: number;
  L: number;
  sl: number;
  Jls: number;
  Jsd: number;
  two: boolean;
  typ: 'tron' | 'hop' | 'ban';
  d: string | number | undefined;
  n: number;
  err: string[];
  q?: TvcQpDetail;
  Q?: number;
  S?: TvcSizeSpec;
  Q1?: number;
  zd?: number;
  iSlope?: number;
  zr?: number;
  rc?: TvcSlabHydraulics;
  QA?: number | null;
  qOK?: boolean;
  qt?: number;
  hv?: TvcHvLookupResult | null;
  Hd?: number;
  V?: number;
  Hmin?: number;
  reg?: string;
  regOK?: boolean;
  hFree?: number;
  MN?: number;
  dz?: number;
  zOK?: boolean;
  lgc?: number;
  B?: number;
  hx?: number;
  ht?: number;
  ok?: boolean;
}

export interface TvcCalcInput {
  P?: number;
  hp?: TvcHpInput;
  Hp?: number;
  reg?: string;
  cls?: string;
  msd?: number;
  mls?: number;
  fao?: number;
  aoPos?: string;
  kgc?: number;
  phi?: number;
  nc?: number;
  xoi?: boolean;
  hd?: number;
  rows?: TvcRowInput[];
}

export interface TvcCalcResult {
  C: TvcCalcCommon;
  out: TvcCulvertOutcome[];
}

export interface TvxDemGrid {
  x0: number;
  y1: number;
  d: number;
  nx: number;
  ny: number;
  z: ArrayLike<number | null | undefined>;
}

export interface TvxContourSegment {
  level: number;
  major: boolean;
  a: Point2D;
  b: Point2D;
  gridA: Point2D;
  gridB: Point2D;
}

export interface TvxContoursOptions {
  /** Contour interval in meters. Defaults to adaptive module-17 tier (50/20/10/5); pass `10` for fixed 10 m contours. */
  interval?: number;
  /** Major index contour multiplier (defaults to `5`, so every `5 * interval` m is marked major `'m'`). */
  majorMult?: number;
}

export interface TvxContoursResult {
  interval: number;
  zmin: number;
  zmax: number;
  /** Major contour flat segment endpoint pairs `[a0, b0, a1, b1, ...]` in world `(E, N)` coordinates. */
  m: Point2D[];
  /** Minor contour flat segment endpoint pairs `[a0, b0, a1, b1, ...]` in world `(E, N)` coordinates. */
  n: Point2D[];
  /** Grid-index contour endpoint pairs matching `17_culvert_hydrology_and_dxftools.js` lines 2648-2650. */
  gridSegments: {
    m: Point2D[];
    n: Point2D[];
  };
  segments: TvxContourSegment[];
}

export interface TvxCatchmentMeasurement {
  F: number;
  L: number;
  sl: number;
  Jls: number;
  Jsd: number;
  bnd: Point2D[];
  main: Point2D[];
  brs: Point2D[][];
  out: Point2D;
  z0: number;
  z1: number;
  hasDot: boolean;
  hasSt: boolean;
  demL: boolean;
  st: Point2D[][];
  km?: { v: number; t: string; tim?: number; tip?: Point2D; x?: number; y?: number };
  kmT?: number;
  Flab?: number | null;
}

export interface TvxSavedBasin {
  km: string;
  src?: 'dxf' | 'td' | string;
  bnd: Point2D[];
  main: Point2D[];
  br: Point2D[][];
  out: Point2D;
  z0?: number;
  z1?: number;
  Flab?: number | null;
  demL?: boolean;
}

export interface TvxSavedGeo {
  src?: DemSourceKind | string;
  lon0?: number;
  user?: number;
  route?: Point2D[] | null;
  ends?: Array<{ dau: boolean; p: Point2D; km: string }>;
  bas: TvxSavedBasin[];
  dem?: TvxDemGrid & { _ci?: number };
}

export interface TvxState {
  T: DxfParseResult | null;
  polys: CulvertDxfBasin[];
  bas: CulvertDxfBasin[];
  kms: CulvertDxfKmLabel[];
  FL: CulvertDxfAreaLabel[];
  dots: CulvertDxfDot[];
  opens: DxfPolyline[];
  routes: CulvertDxfRoute[];
  tim: DxfPolyline | null;
  E0?: CulvertDxfEndMarker;
  E1?: CulvertDxfEndMarker;
  route: DxfPolyline | null;
}

export interface TvxRunOptions {
  state?: Partial<CulvertDxfParsedState>;
  layer?: string;
  lon0?: number;
  src?: DemSourceKind;
  skipDemLoad?: boolean;
  skipUiUpdate?: boolean;
  skipBgDem?: boolean;
  yieldBetweenBasins?: boolean;
}

export interface TvxRunResult {
  res: TvxCatchmentMeasurement[];
  rows: TvcRowInput[];
  geo: TvxSavedGeo;
  lk: string[];
  nk: number;
  nd: number;
  ns: number;
  chk: string[];
}

export interface TvmXyOptions {
  text?: string;
  lon0?: number;
  src?: DemSourceKind;
  snap?: number;
  thr?: number;
  skipDemLoad?: boolean;
  skipUiUpdate?: boolean;
}

// ============================================================================
// 2. Internal TCVN 9845:2013 & Pearson-III / Kritski-Menkel Engine (Module 15)
// ============================================================================

interface EmpiricalItem {
  y: number;
  x: number;
  m?: number;
  P?: number;
}

interface StatsResult {
  n: number;
  mean: number;
  Cv: number;
  Cs: number;
  Kmin: number;
  lo: number;
  hi: number;
  csOK: boolean;
  emp: EmpiricalItem[];
  min: number;
  max: number;
}

interface FitResult {
  Cv: number;
  Cs: number;
  e: number;
  rmse?: number;
  rmse0?: number;
}

const HV = (function () {
  const T = HVTAB;
  const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

  function interp(xs: readonly number[], ys: readonly number[], x: number): number {
    if (x <= xs[0]) return ys[0];
    const n = xs.length;
    if (x >= xs[n - 1]) return ys[n - 1];
    for (let i = 1; i < n; i++) {
      if (x <= xs[i]) {
        const t = (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
        return ys[i - 1] + t * (ys[i] - ys[i - 1]);
      }
    }
    return ys[n - 1];
  }

  function lgam(z: number): number {
    const c = [
      676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
      12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
    ];
    if (z < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * z))) - lgam(1 - z);
    z -= 1;
    let x = 0.99999999999980993;
    for (let i = 0; i < 8; i++) x += c[i] / (z + i + 1);
    const t = z + 7.5;
    return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
  }

  function gP(a: number, x: number): number {
    if (x <= 0) return 0;
    const gl = lgam(a);
    if (x < a + 1) {
      let s = 1 / a;
      let d = s;
      let ap = a;
      for (let i = 0; i < 500; i++) {
        ap++;
        d *= x / ap;
        s += d;
        if (Math.abs(d) < Math.abs(s) * 1e-15) break;
      }
      return s * Math.exp(-x + a * Math.log(x) - gl);
    }
    let b = x + 1 - a;
    let c = 1 / 1e-300;
    let d = 1 / b;
    let h = d;
    for (let i = 1; i < 500; i++) {
      const an = -i * (i - a);
      b += 2;
      d = an * d + b;
      if (Math.abs(d) < 1e-300) d = 1e-300;
      c = b + an / c;
      if (Math.abs(c) < 1e-300) c = 1e-300;
      d = 1 / d;
      const de = d * c;
      h *= de;
      if (Math.abs(de - 1) < 1e-15) break;
    }
    return 1 - Math.exp(-x + a * Math.log(x) - gl) * h;
  }

  let GPI: Record<string, number> = {};
  let GPN = 0;
  function gPinv(a: number, p: number): number {
    const key = a + '|' + p;
    if (GPI[key] != null) return GPI[key];
    let lo = 0;
    let hi = Math.max(10, a * 10);
    while (gP(a, hi) < p) hi *= 2;
    for (let i = 0; i < 200 && hi - lo > 1e-13 * Math.max(1, hi); i++) {
      const m = (lo + hi) / 2;
      if (gP(a, m) < p) lo = m;
      else hi = m;
    }
    const r = (lo + hi) / 2;
    if (++GPN > 50000) {
      GPI = {};
      GPN = 0;
    }
    return (GPI[key] = r);
  }

  function nInv(p: number): number {
    const a = [
      -39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269,
      -30.66479806614716, 2.506628277459239,
    ];
    const b = [
      -54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972,
      -13.28068155288572,
    ];
    const c = [
      -0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734,
      4.374664141464968, 2.938163982698783,
    ];
    const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
    const pl = 0.02425;
    if (p < pl) {
      const q = Math.sqrt(-2 * Math.log(p));
      return (
        (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
      );
    }
    if (p > 1 - pl) {
      const q = Math.sqrt(-2 * Math.log(1 - p));
      return -(
        (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
      );
    }
    const q = p - 0.5;
    const r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  }

  function phiP(P: number, Cs: number): number {
    const p = P / 100;
    if (Math.abs(Cs) < 1e-6) return nInv(1 - p);
    const s = Math.abs(Cs);
    const a = 4 / (s * s);
    const y = Cs > 0 ? gPinv(a, 1 - p) : gPinv(a, p);
    const f = (s / 2) * y - 2 / s;
    return Cs > 0 ? f : -f;
  }

  function stats(arr: ReadonlyArray<{ y: number; x: number }>): StatsResult | null {
    const xs = arr.map((o) => o.x);
    const n = xs.length;
    if (n < 3) return null;
    const mean = xs.reduce((s, x) => s + x, 0) / n;
    const K = xs.map((x) => x / mean);
    const Cv = Math.sqrt(K.reduce((s, k) => s + (k - 1) ** 2, 0) / (n - 1));
    const Cs = K.reduce((s, k) => s + (k - 1) ** 3, 0) / ((n - 3) * Cv ** 3);
    const Kmin = Math.min(...K);
    const lo = 2 * Cv;
    const hi = (2 * Cv) / (1 - Kmin);
    const srt: EmpiricalItem[] = arr.map((o) => ({ ...o })).sort((a, b) => b.x - a.x);
    srt.forEach((o, i) => {
      o.m = i + 1;
      o.P = ((i + 1) / (n + 1)) * 100;
    });
    return {
      n,
      mean,
      Cv,
      Cs,
      Kmin,
      lo,
      hi,
      csOK: Cs >= lo - 1e-9 && Cs <= hi + 1e-9,
      emp: srt,
      min: Math.min(...xs),
      max: Math.max(...xs),
    };
  }

  const FG: ReadonlyArray<readonly [number, number, string]> = [
    [0, 4, 'F < 0,1'],
    [5, 6, '0,1 < F < 1,0'],
    [7, 9, '1,0 < F < 10'],
    [10, 11, '10 < F < 100'],
    [12, 12, 'F > 100'],
  ];

  function fGroup(F: number): number {
    return F < 0.1 ? 0 : F < 1 ? 1 : F < 10 ? 2 : F < 100 ? 3 : 4;
  }

  function phiA1(cls: string, Hp: number, F: number, col?: number) {
    const tb = T.A1[cls as keyof typeof T.A1];
    if (!tb) return null;
    let ri = 0;
    if (cls !== 'VI' && tb.hi) {
      ri = tb.hi.findIndex((h) => Hp <= h + 1e-9);
      if (ri < 0) ri = tb.hi.length - 1;
    }
    const row = tb.v[ri];
    const gi = fGroup(F);
    const [c0, c1] = FG[gi];
    const cand: number[] = [];
    for (let c = c0; c <= c1; c++) if (row[c] != null) cand.push(c);
    let c = col != null && col >= c0 && col <= c1 && row[col] != null ? col : null;
    let auto = false;
    if (c == null) {
      auto = true;
      c = cand.reduce((b, x) => ((row[x] ?? -Infinity) > (row[b] ?? -Infinity) ? x : b), cand[0]);
    }
    return {
      phi: row[c] as number,
      col: c,
      auto,
      cand,
      row,
      ri,
      lab: cls === 'VI' ? '-' : tb.lab ? tb.lab[ri] : '-',
      grp: FG[gi][2],
    };
  }

  function tauA2(reg: string, phs: number) {
    const xs = T.A2.phi;
    const ys = T.A2.v[reg];
    if (!ys) return { tau: NaN, out: true, lo: xs[0], hi: xs[xs.length - 1] };
    const xx: number[] = [];
    const yy: number[] = [];
    xs.forEach((x, i) => {
      const yv = ys[i];
      if (yv != null) {
        xx.push(x);
        yy.push(yv);
      }
    });
    return {
      tau: interp(xx, yy, phs),
      out: phs < xx[0] || phs > xx[xx.length - 1],
      lo: xx[0],
      hi: xx[xx.length - 1],
    };
  }

  function apA3(reg: string, tau: number, phl: number) {
    const tv = T.A3.tau;
    const pv = T.A3.phi;
    const V = T.A3.v[reg];
    const t = clamp(tau, tv[0], tv[4]);
    const p = clamp(phl, pv[0], pv[pv.length - 1]);
    const col = V.map((r) => interp(pv, r, p));
    const ap = interp(tv, col, t);
    const ti = Math.max(
      1,
      tv.findIndex((x) => x >= t),
    );
    const pi = Math.max(
      1,
      pv.findIndex((x) => x >= p),
    );
    const cells: Array<[number, number]> = [
      [ti - 1, pi - 1],
      [ti - 1, pi],
      [ti, pi - 1],
      [ti, pi],
    ];
    const sus = cells.filter(([a, b]) => {
      const r = V[a];
      return (
        (b > 0 && r[b] > r[b - 1] + 1e-9) ||
        (b < r.length - 1 && r[b + 1] > r[b] + 1e-9) ||
        (a > 0 && V[a][b] > V[a - 1][b] + 1e-9) ||
        (a < 4 && V[a + 1][b] > V[a][b] + 1e-9)
      );
    });
    return {
      ap,
      tauOut: tau < tv[0] || tau > tv[4],
      phlOut: phl > pv[pv.length - 1],
      t,
      p,
      sus: sus.map(([a, b]) => ({ tau: tv[a], phl: pv[b], v: V[a][b] })),
    };
  }

  const B6 = {
    f: [0, 2, 4, 6, 8, 10, 15, 20, 30, 40, 50],
    h: [1, 0.85, 0.75, 0.65, 0.55, 0.5, 0.4, 0.35, 0.2, 0.15, 0.1],
    t: [1, 0.95, 0.9, 0.85, 0.8, 0.75, 0.65, 0.55, 0.45, 0.35, 0.25],
  };

  const delta6 = (fa: number, pos: string): number =>
    fa <= 0 ? 1 : interp(B6.f, pos === 'h' ? B6.h : B6.t, fa);

  function qp(
    I: {
      F: number;
      L: number;
      sl: number;
      two: boolean;
      Jls: number;
      Jsd: number;
      msd: number;
      mls: number;
      cls: string;
      reg: string;
      fao: number;
      aoPos: string;
      phiCol?: number;
      noCh?: boolean;
    },
    Hp: number,
  ): TvcQpDetail | null {
    const warn: string[] = [];
    const k = I.two ? 1.8 : 0.9;
    const B = I.two ? I.F / (2 * I.L) : I.F / I.L;
    const Lsd = (1000 * I.F) / (k * (I.L + I.sl));
    const A = phiA1(I.cls, Hp, I.F, I.phiCol);
    if (!A) return null;
    const phi = A.phi;
    const phisd = Math.pow(Lsd, 0.6) / (I.msd * Math.pow(I.Jsd, 0.3) * Math.pow(phi * Hp, 0.4));
    const tt = tauA2(I.reg, phisd);
    const tau = tt.tau;
    if (tt.out) {
      warn.push(
        `φsd = ${phisd.toFixed(2)} ngoài phạm vi Bảng A.2 (${tt.lo} - ${tt.hi}): lấy τsd tại đầu mút bảng.`,
      );
    }
    const noCh = !!I.noCh;
    const phils = noCh
      ? 0
      : (1000 * I.L) /
        (I.mls * Math.pow(I.Jls, 1 / 3) * Math.pow(I.F, 0.25) * Math.pow(phi * Hp, 0.25));
    const a = apA3(I.reg, tau, phils);
    const Ap = a.ap;
    if (a.tauOut) {
      warn.push(
        `τsd = ${tau.toFixed(1)} phút ngoài phạm vi Bảng A.3 (20 - 180 phút): tra Ap tại τsd = ${a.t} phút.`,
      );
    }
    if (a.phlOut) warn.push(`φls = ${phils.toFixed(1)} > 220: tra Ap tại φls = 220.`);
    if (a.sus.length) {
      warn.push(
        'Ô Bảng A.3 dùng để nội suy có trị số không đơn điệu so với ô lân cận (nghi in sai): ' +
          a.sus.map((s) => `τsd = ${s.tau}, φls = ${s.phl}: ${s.v}`).join('; ') +
          '. Tính theo bản in TCVN.',
      );
    }
    const delta = delta6(I.fao, I.aoPos);
    const Q = Ap * phi * Hp * I.F * delta;
    const q = Q / I.F;
    return {
      Hp,
      warn,
      B,
      k,
      Lsd,
      A1: A,
      phi,
      phisd,
      tau,
      noCh,
      phils,
      A3: a,
      Ap,
      delta,
      Q,
      q,
    };
  }

  return { interp, lgam, gP, gPinv, nInv, phiP, stats, delta6, qp };
})();

const HVKM = {
  P: [
    0.01, 0.03, 0.05, 0.1, 0.3, 0.5, 1, 3, 5, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 95, 97,
    99, 99.5, 99.7, 99.9,
  ],
  T: [
    {
      r: 1.0,
      cv: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9],
      K: [
        [
          1.4, 1.36, 1.34, 1.32, 1.29, 1.27, 1.24, 1.19, 1.17, 1.13, 1.08, 1.06, 1.05, 1.02, 1.0,
          0.97, 0.95, 0.93, 0.91, 0.88, 0.84, 0.82, 0.78, 0.76, 0.74, 0.7,
        ],
        [
          1.81, 1.74, 1.71, 1.67, 1.59, 1.55, 1.49, 1.39, 1.34, 1.26, 1.17, 1.13, 1.1, 1.04, 0.99,
          0.94, 0.89, 0.86, 0.83, 0.75, 0.68, 0.64, 0.57, 0.53, 0.5, 0.45,
        ],
        [
          2.25, 2.15, 2.11, 2.03, 1.9, 1.84, 1.75, 1.59, 1.52, 1.39, 1.25, 1.19, 1.15, 1.06, 0.99,
          0.9, 0.83, 0.78, 0.74, 0.63, 0.53, 0.48, 0.38, 0.34, 0.31, 0.25,
        ],
        [
          2.7, 2.56, 2.49, 2.39, 2.23, 2.15, 2.03, 1.81, 1.7, 1.53, 1.34, 1.26, 1.2, 1.08, 0.97,
          0.87, 0.77, 0.71, 0.65, 0.5, 0.38, 0.33, 0.23, 0.18, 0.15, 0.11,
        ],
        [
          3.15, 2.97, 2.89, 2.77, 2.55, 2.45, 2.31, 2.03, 1.9, 1.68, 1.42, 1.33, 1.24, 1.09, 0.96,
          0.83, 0.7, 0.62, 0.55, 0.38, 0.26, 0.21, 0.12, 0.09, 0.07, 0.04,
        ],
        [
          3.57, 3.37, 3.27, 3.14, 2.89, 2.76, 2.59, 2.27, 2.1, 1.83, 1.51, 1.41, 1.29, 1.1, 0.93,
          0.79, 0.62, 0.53, 0.45, 0.26, 0.15, 0.11, 0.05, 0.03, 0.02, 0.01,
        ],
        [
          3.94, 3.74, 3.62, 3.48, 3.21, 3.06, 2.87, 2.51, 2.31, 1.99, 1.59, 1.47, 1.34, 1.1, 0.89,
          0.71, 0.51, 0.42, 0.35, 0.17, 0.08, 0.05, 0.01, 0.0, 0.0, 0.0,
        ],
        [
          4.31, 4.11, 3.98, 3.82, 3.53, 3.37, 3.15, 2.75, 2.52, 2.16, 1.69, 1.52, 1.38, 1.1, 0.83,
          0.61, 0.41, 0.31, 0.24, 0.09, 0.04, 0.02, 0.0, 0.0, 0.0, 0.0,
        ],
        [
          4.63, 4.44, 4.3, 4.13, 3.85, 3.68, 3.45, 3.02, 2.76, 2.35, 1.78, 1.58, 1.4, 1.05, 0.76,
          0.51, 0.3, 0.21, 0.15, 0.04, 0.01, 0.0, 0.0, 0.0, 0.0, 0.0,
        ],
      ],
    },
    {
      r: 1.5,
      cv: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2],
      K: [
        [
          1.39, 1.36, 1.35, 1.33, 1.28, 1.27, 1.24, 1.19, 1.17, 1.13, 1.1, 1.07, 1.05, 1.03, 1.0,
          0.97, 0.95, 0.93, 0.91, 0.87, 0.84, 0.82, 0.78, 0.76, 0.74, 0.72,
        ],
        [
          1.86, 1.79, 1.75, 1.7, 1.61, 1.57, 1.51, 1.4, 1.34, 1.26, 1.17, 1.13, 1.1, 1.04, 0.99,
          0.94, 0.89, 0.86, 0.83, 0.75, 0.69, 0.65, 0.58, 0.55, 0.52, 0.47,
        ],
        [
          2.39, 2.25, 2.19, 2.11, 1.96, 1.9, 1.79, 1.62, 1.53, 1.4, 1.25, 1.19, 1.14, 1.07, 0.98,
          0.9, 0.83, 0.78, 0.74, 0.63, 0.55, 0.5, 0.41, 0.36, 0.33, 0.28,
        ],
        [
          2.94, 2.75, 2.67, 2.54, 2.34, 2.24, 2.09, 1.85, 1.72, 1.54, 1.32, 1.25, 1.18, 1.06, 0.96,
          0.86, 0.76, 0.74, 0.65, 0.52, 0.42, 0.36, 0.27, 0.22, 0.2, 0.15,
        ],
        [
          3.55, 3.31, 3.17, 3.02, 2.74, 2.6, 2.41, 2.1, 1.92, 1.69, 1.41, 1.3, 1.2, 1.06, 0.93,
          0.81, 0.69, 0.63, 0.57, 0.41, 0.31, 0.25, 0.16, 0.12, 0.11, 0.07,
        ],
        [
          4.2, 3.89, 3.74, 3.53, 3.17, 3.0, 2.76, 2.34, 2.13, 1.82, 1.48, 1.35, 1.24, 1.06, 0.9,
          0.76, 0.62, 0.55, 0.47, 0.31, 0.21, 0.15, 0.08, 0.06, 0.04, 0.02,
        ],
        [
          4.87, 4.52, 4.32, 4.05, 3.62, 3.42, 3.11, 2.61, 2.35, 1.96, 1.55, 1.4, 1.26, 1.05, 0.86,
          0.7, 0.55, 0.46, 0.39, 0.22, 0.14, 0.09, 0.04, 0.02, 0.02, 0.0,
        ],
        [
          5.59, 5.14, 4.93, 4.6, 4.08, 3.85, 3.49, 2.87, 2.56, 2.11, 1.61, 1.43, 1.28, 1.03, 0.81,
          0.63, 0.46, 0.38, 0.3, 0.15, 0.08, 0.04, 0.02, 0.01, 0.0, 0.0,
        ],
        [
          6.37, 5.83, 5.58, 5.21, 4.61, 4.32, 3.9, 3.17, 2.8, 2.27, 1.67, 1.46, 1.3, 1.0, 0.76,
          0.56, 0.38, 0.3, 0.23, 0.09, 0.04, 0.02, 0.01, 0.0, 0.0, 0.0,
        ],
        [
          7.19, 6.54, 6.25, 5.82, 5.15, 4.79, 4.32, 3.47, 3.05, 2.42, 1.72, 1.49, 1.29, 0.95, 0.7,
          0.48, 0.3, 0.22, 0.16, 0.05, 0.02, 0.01, 0.0, 0.0, 0.0, 0.0,
        ],
        [
          8.01, 7.32, 6.95, 6.58, 5.7, 5.3, 4.73, 3.8, 3.28, 2.56, 1.75, 1.48, 1.26, 0.9, 0.62, 0.4,
          0.23, 0.16, 0.11, 0.03, 0.01, 0.0, 0.0, 0.0, 0.0, 0.0,
        ],
        [
          8.82, 8.11, 7.68, 7.12, 6.23, 5.81, 5.16, 4.1, 3.54, 2.7, 1.77, 1.47, 1.25, 0.84, 0.54,
          0.34, 0.17, 0.11, 0.07, 0.01, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
        ],
      ],
    },
    {
      r: 2.0,
      cv: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2],
      K: [
        [
          1.42, 1.38, 1.36, 1.34, 1.3, 1.28, 1.25, 1.2, 1.17, 1.13, 1.08, 1.07, 1.05, 1.02, 1.0,
          0.97, 0.95, 0.93, 0.92, 0.87, 0.84, 0.82, 0.78, 0.76, 0.75, 0.72,
        ],
        [
          1.92, 1.83, 1.79, 1.73, 1.64, 1.59, 1.52, 1.41, 1.35, 1.26, 1.16, 1.13, 1.09, 1.04, 0.99,
          0.94, 0.89, 0.86, 0.83, 0.75, 0.7, 0.66, 0.59, 0.56, 0.54, 0.49,
        ],
        [
          2.51, 2.36, 2.29, 2.19, 2.02, 1.94, 1.83, 1.64, 1.54, 1.4, 1.24, 1.18, 1.13, 1.05, 0.97,
          0.9, 0.82, 0.78, 0.75, 0.64, 0.56, 0.52, 0.44, 0.4, 0.37, 0.32,
        ],
        [
          3.2, 2.96, 2.85, 2.7, 2.45, 2.33, 2.16, 1.88, 1.74, 1.53, 1.31, 1.23, 1.17, 1.05, 0.95,
          0.85, 0.76, 0.71, 0.66, 0.53, 0.45, 0.39, 0.31, 0.27, 0.24, 0.19,
        ],
        [
          3.98, 3.64, 3.48, 3.27, 2.91, 2.74, 2.51, 2.13, 1.94, 1.67, 1.38, 1.28, 1.19, 1.04, 0.92,
          0.8, 0.69, 0.63, 0.57, 0.44, 0.34, 0.29, 0.21, 0.17, 0.15, 0.11,
        ],
        [
          4.85, 4.39, 4.18, 3.89, 3.42, 3.2, 2.89, 2.39, 2.15, 1.81, 1.44, 1.31, 1.21, 1.03, 0.88,
          0.75, 0.62, 0.56, 0.49, 0.35, 0.25, 0.2, 0.13, 0.1, 0.08, 0.05,
        ],
        [
          5.81, 5.22, 4.95, 4.57, 3.96, 3.68, 3.29, 2.66, 2.36, 1.94, 1.5, 1.34, 1.22, 1.01, 0.84,
          0.69, 0.55, 0.49, 0.42, 0.27, 0.18, 0.14, 0.08, 0.05, 0.04, 0.02,
        ],
        [
          6.85, 6.11, 5.77, 5.3, 4.55, 4.19, 3.71, 2.94, 2.57, 2.06, 1.54, 1.37, 1.22, 0.99, 0.8,
          0.63, 0.49, 0.42, 0.35, 0.21, 0.13, 0.09, 0.04, 0.03, 0.02, 0.01,
        ],
        [
          7.89, 7.08, 6.66, 6.08, 5.16, 4.73, 4.15, 3.22, 2.78, 2.19, 1.58, 1.38, 1.22, 0.96, 0.75,
          0.57, 0.42, 0.35, 0.28, 0.15, 0.08, 0.05, 0.02, 0.01, 0.01, 0.0,
        ],
        [
          9.21, 8.11, 7.6, 6.91, 5.81, 5.3, 4.61, 3.51, 3.0, 2.3, 1.61, 1.39, 1.2, 0.92, 0.69, 0.51,
          0.36, 0.29, 0.22, 0.11, 0.05, 0.03, 0.01, 0.01, 0.0, 0.0,
        ],
        [
          10.48, 9.17, 8.61, 7.76, 6.47, 5.88, 5.06, 3.79, 3.21, 2.41, 1.62, 1.37, 1.18, 0.87, 0.64,
          0.45, 0.31, 0.24, 0.17, 0.07, 0.03, 0.02, 0.0, 0.0, 0.0, 0.0,
        ],
        [
          11.8, 10.26, 9.65, 8.65, 7.1, 6.5, 5.5, 4.05, 3.45, 2.5, 1.62, 1.34, 1.13, 0.81, 0.58,
          0.4, 0.26, 0.19, 0.13, 0.05, 0.02, 0.01, 0.0, 0.0, 0.0, 0.0,
        ],
      ],
    },
    {
      r: 3.0,
      cv: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2],
      K: [
        [
          1.42, 1.39, 1.36, 1.35, 1.31, 1.29, 1.25, 1.21, 1.17, 1.14, 1.09, 1.07, 1.05, 1.02, 0.99,
          0.97, 0.94, 0.93, 0.91, 0.87, 0.84, 0.83, 0.79, 0.77, 0.76, 0.73,
        ],
        [
          2.06, 1.99, 1.88, 1.8, 1.69, 1.63, 1.55, 1.42, 1.36, 1.26, 1.16, 1.12, 1.09, 1.03, 0.98,
          0.93, 0.88, 0.86, 0.83, 0.76, 0.71, 0.68, 0.62, 0.59, 0.57, 0.53,
        ],
        [
          2.86, 2.62, 2.5, 2.36, 2.12, 2.02, 1.88, 1.67, 1.54, 1.39, 1.23, 1.17, 1.12, 1.03, 0.96,
          0.89, 0.82, 0.79, 0.75, 0.66, 0.59, 0.55, 0.48, 0.45, 0.43, 0.38,
        ],
        [
          3.78, 3.41, 3.23, 3.0, 2.64, 2.48, 2.25, 1.91, 1.75, 1.52, 1.29, 1.21, 1.14, 1.03, 0.93,
          0.84, 0.76, 0.72, 0.67, 0.57, 0.49, 0.45, 0.37, 0.34, 0.31, 0.27,
        ],
        [
          5.0, 4.34, 4.1, 3.75, 3.22, 3.0, 2.66, 2.17, 1.94, 1.63, 1.33, 1.23, 1.15, 1.01, 0.9,
          0.79, 0.7, 0.65, 0.6, 0.48, 0.41, 0.36, 0.29, 0.25, 0.23, 0.19,
        ],
        [
          6.28, 5.48, 5.06, 4.58, 3.82, 3.5, 3.07, 2.42, 2.14, 1.76, 1.38, 1.26, 1.15, 1.0, 0.86,
          0.74, 0.64, 0.58, 0.53, 0.41, 0.33, 0.28, 0.21, 0.18, 0.16, 0.13,
        ],
        [
          7.7, 6.59, 6.07, 5.43, 4.44, 4.0, 3.49, 2.7, 2.35, 1.87, 1.42, 1.27, 1.16, 0.97, 0.82,
          0.69, 0.58, 0.52, 0.47, 0.34, 0.26, 0.22, 0.16, 0.12, 0.12, 0.09,
        ],
        [
          9.21, 7.74, 7.11, 6.31, 5.11, 4.58, 3.92, 2.94, 2.51, 1.97, 1.45, 1.29, 1.15, 0.95, 0.78,
          0.65, 0.53, 0.47, 0.41, 0.29, 0.21, 0.17, 0.12, 0.09, 0.08, 0.06,
        ],
        [
          11.0, 9.14, 8.32, 7.33, 5.84, 5.21, 4.4, 3.22, 2.7, 2.09, 1.47, 1.28, 1.14, 0.91, 0.74,
          0.6, 0.47, 0.41, 0.36, 0.24, 0.17, 0.13, 0.08, 0.06, 0.05, 0.03,
        ],
        [
          12.89, 10.64, 9.66, 8.43, 6.62, 5.85, 4.8, 3.47, 2.89, 2.15, 1.49, 1.28, 1.13, 0.88, 0.7,
          0.55, 0.42, 0.36, 0.31, 0.19, 0.13, 0.1, 0.06, 0.04, 0.03, 0.02,
        ],
        [
          14.85, 12.24, 11.02, 9.54, 7.4, 6.5, 5.37, 3.74, 3.05, 2.24, 1.49, 1.27, 1.11, 0.85, 0.66,
          0.5, 0.37, 0.31, 0.26, 0.16, 0.1, 0.07, 0.04, 0.03, 0.02, 0.01,
        ],
        [
          16.86, 13.83, 12.43, 10.68, 8.21, 7.16, 5.85, 3.99, 3.23, 2.31, 1.5, 1.27, 1.08, 0.81,
          0.61, 0.46, 0.33, 0.27, 0.22, 0.12, 0.07, 0.05, 0.03, 0.02, 0.01, 0.01,
        ],
      ],
    },
    {
      r: 4.0,
      cv: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2],
      K: [
        [
          1.51, 1.45, 1.4, 1.38, 1.34, 1.3, 1.25, 1.19, 1.17, 1.11, 1.08, 1.06, 1.05, 1.02, 0.99,
          0.97, 0.94, 0.93, 0.91, 0.88, 0.85, 0.83, 0.8, 0.78, 0.77, 0.75,
        ],
        [
          2.2, 2.05, 1.97, 1.87, 1.73, 1.67, 1.58, 1.43, 1.36, 1.26, 1.15, 1.11, 1.08, 1.03, 0.98,
          0.93, 0.88, 0.86, 0.83, 0.77, 0.72, 0.69, 0.64, 0.61, 0.6, 0.56,
        ],
        [
          3.15, 2.87, 2.72, 2.53, 2.23, 2.1, 1.94, 1.67, 1.55, 1.38, 1.21, 1.15, 1.1, 1.02, 0.95,
          0.89, 0.82, 0.79, 0.75, 0.67, 0.61, 0.58, 0.52, 0.49, 0.47, 0.43,
        ],
        [
          4.35, 3.85, 3.6, 3.29, 2.81, 2.6, 2.34, 1.92, 1.75, 1.51, 1.26, 1.19, 1.12, 1.01, 0.92,
          0.84, 0.76, 0.72, 0.68, 0.59, 0.52, 0.48, 0.42, 0.39, 0.37, 0.33,
        ],
        [
          5.9, 5.05, 4.7, 4.2, 3.45, 3.13, 2.77, 2.18, 1.93, 1.61, 1.31, 1.21, 1.13, 0.99, 0.89,
          0.79, 0.71, 0.66, 0.61, 0.51, 0.44, 0.4, 0.34, 0.3, 0.29, 0.25,
        ],
        [
          7.7, 6.35, 5.75, 5.07, 4.09, 3.69, 3.17, 2.44, 2.11, 1.72, 1.34, 1.23, 1.13, 0.97, 0.85,
          0.75, 0.65, 0.6, 0.55, 0.44, 0.37, 0.33, 0.27, 0.24, 0.22, 0.19,
        ],
        [
          9.57, 7.81, 7.0, 6.05, 4.76, 4.25, 3.59, 2.67, 2.28, 1.82, 1.37, 1.23, 1.12, 0.95, 0.82,
          0.7, 0.6, 0.55, 0.5, 0.38, 0.32, 0.27, 0.22, 0.19, 0.17, 0.14,
        ],
        [
          11.4, 9.15, 8.2, 7.02, 5.46, 4.81, 4.01, 2.9, 2.45, 1.9, 1.4, 1.24, 1.12, 0.93, 0.78,
          0.66, 0.55, 0.5, 0.45, 0.33, 0.26, 0.23, 0.17, 0.15, 0.13, 0.1,
        ],
        [
          13.55, 10.7, 9.46, 8.12, 6.18, 5.38, 4.43, 3.12, 2.6, 2.0, 1.41, 1.25, 1.1, 0.9, 0.75,
          0.62, 0.5, 0.45, 0.4, 0.29, 0.22, 0.18, 0.14, 0.11, 0.1, 0.08,
        ],
        [
          15.6, 12.25, 10.9, 9.25, 6.94, 6.02, 4.96, 3.35, 2.77, 2.05, 1.42, 1.24, 1.09, 0.87, 0.71,
          0.57, 0.46, 0.4, 0.36, 0.25, 0.18, 0.15, 0.11, 0.08, 0.07, 0.05,
        ],
        [
          17.65, 13.7, 12.1, 10.42, 7.71, 6.65, 5.35, 3.6, 2.92, 2.12, 1.43, 1.24, 1.07, 0.85, 0.67,
          0.53, 0.42, 0.37, 0.31, 0.21, 0.15, 0.12, 0.08, 0.06, 0.05, 0.04,
        ],
        [
          20.71, 15.99, 13.99, 11.65, 8.53, 7.31, 5.82, 3.84, 3.07, 2.18, 1.43, 1.22, 1.06, 0.81,
          0.63, 0.49, 0.38, 0.32, 0.27, 0.18, 0.12, 0.1, 0.06, 0.05, 0.04, 0.03,
        ],
      ],
    },
    {
      r: 5.0,
      cv: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2],
      K: [
        [
          1.54, 1.47, 1.43, 1.4, 1.34, 1.31, 1.27, 1.2, 1.17, 1.13, 1.08, 1.06, 1.05, 1.02, 0.99,
          0.97, 0.94, 0.93, 0.91, 0.88, 0.84, 0.82, 0.78, 0.76, 0.75, 0.73,
        ],
        [
          2.34, 2.15, 2.06, 1.95, 1.78, 1.7, 1.61, 1.44, 1.36, 1.26, 1.15, 1.11, 1.08, 1.02, 0.97,
          0.93, 0.88, 0.86, 0.83, 0.77, 0.73, 0.7, 0.66, 0.63, 0.62, 0.59,
        ],
        [
          3.43, 3.07, 2.87, 2.66, 2.31, 2.16, 1.98, 1.67, 1.55, 1.37, 1.21, 1.15, 1.09, 1.01, 0.94,
          0.88, 0.82, 0.79, 0.75, 0.68, 0.63, 0.6, 0.55, 0.52, 0.51, 0.47,
        ],
        [
          4.91, 4.23, 3.9, 3.51, 2.92, 2.69, 2.38, 1.93, 1.74, 1.49, 1.25, 1.17, 1.1, 1.0, 0.92,
          0.84, 0.77, 0.73, 0.69, 0.61, 0.55, 0.51, 0.45, 0.42, 0.41, 0.37,
        ],
        [
          6.65, 5.5, 5.05, 4.44, 3.52, 3.21, 2.79, 2.17, 1.9, 1.6, 1.3, 1.2, 1.1, 0.98, 0.88, 0.79,
          0.71, 0.67, 0.63, 0.53, 0.47, 0.43, 0.37, 0.34, 0.32, 0.29,
        ],
        [
          8.7, 6.95, 6.24, 5.4, 4.22, 3.77, 3.21, 2.42, 2.08, 1.7, 1.32, 1.2, 1.11, 0.97, 0.85,
          0.75, 0.66, 0.62, 0.57, 0.47, 0.4, 0.36, 0.31, 0.28, 0.26, 0.23,
        ],
        [
          10.7, 8.43, 7.51, 6.43, 4.91, 4.34, 3.65, 2.62, 2.22, 1.79, 1.34, 1.2, 1.1, 0.94, 0.82,
          0.71, 0.61, 0.56, 0.52, 0.41, 0.34, 0.31, 0.25, 0.23, 0.21, 0.18,
        ],
        [
          12.71, 9.96, 8.82, 7.54, 5.69, 4.93, 4.06, 2.88, 2.41, 1.86, 1.36, 1.22, 1.1, 0.92, 0.78,
          0.67, 0.56, 0.51, 0.47, 0.36, 0.29, 0.26, 0.2, 0.18, 0.16, 0.14,
        ],
        [
          15.05, 11.6, 10.25, 8.64, 6.41, 5.52, 4.5, 3.1, 2.54, 1.94, 1.36, 1.22, 1.09, 0.9, 0.75,
          0.63, 0.52, 0.47, 0.42, 0.32, 0.25, 0.22, 0.16, 0.14, 0.12, 0.1,
        ],
        [
          17.41, 13.3, 11.71, 9.83, 7.15, 6.17, 4.94, 3.33, 2.71, 2.0, 1.39, 1.22, 1.08, 0.87, 0.71,
          0.58, 0.48, 0.42, 0.37, 0.27, 0.21, 0.18, 0.13, 0.11, 0.1, 0.08,
        ],
        [
          20.0, 15.2, 13.25, 10.96, 7.9, 6.85, 5.33, 3.52, 2.85, 2.05, 1.4, 1.2, 1.06, 0.84, 0.68,
          0.55, 0.44, 0.39, 0.34, 0.24, 0.18, 0.15, 0.1, 0.09, 0.08, 0.06,
        ],
        [
          22.71, 17.17, 14.81, 12.14, 8.63, 7.35, 5.75, 3.75, 2.98, 2.11, 1.41, 1.2, 1.04, 0.81,
          0.65, 0.51, 0.41, 0.36, 0.31, 0.21, 0.15, 0.12, 0.08, 0.07, 0.06, 0.04,
        ],
      ],
    },
    {
      r: 6.0,
      cv: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2],
      K: [
        [
          1.6, 1.52, 1.47, 1.41, 1.35, 1.32, 1.29, 1.21, 1.18, 1.14, 1.08, 1.07, 1.04, 1.02, 0.99,
          0.96, 0.94, 0.93, 0.91, 0.88, 0.85, 0.83, 0.8, 0.78, 0.76, 0.75,
        ],
        [
          2.48, 2.25, 2.15, 2.02, 1.83, 1.74, 1.63, 1.45, 1.37, 1.26, 1.14, 1.1, 1.07, 1.02, 0.97,
          0.92, 0.88, 0.86, 0.84, 0.78, 0.74, 0.72, 0.67, 0.65, 0.64, 0.61,
        ],
        [
          3.75, 3.25, 3.05, 2.8, 2.38, 2.22, 2.01, 1.68, 1.55, 1.37, 1.19, 1.13, 1.08, 1.01, 0.94,
          0.88, 0.83, 0.8, 0.77, 0.7, 0.65, 0.62, 0.57, 0.55, 0.53, 0.5,
        ],
        [
          5.48, 4.54, 4.15, 3.68, 2.98, 2.73, 2.4, 1.92, 1.73, 1.47, 1.23, 1.16, 1.1, 0.99, 0.91,
          0.84, 0.77, 0.74, 0.7, 0.62, 0.56, 0.53, 0.48, 0.45, 0.43, 0.4,
        ],
        [
          7.3, 5.9, 5.25, 4.58, 3.64, 3.26, 2.81, 2.14, 1.89, 1.56, 1.27, 1.18, 1.1, 0.98, 0.88,
          0.8, 0.72, 0.68, 0.64, 0.55, 0.49, 0.46, 0.4, 0.37, 0.36, 0.33,
        ],
        [
          9.39, 7.37, 6.57, 5.54, 4.31, 3.82, 3.22, 2.38, 2.05, 1.66, 1.3, 1.19, 1.1, 0.96, 0.85,
          0.76, 0.67, 0.63, 0.58, 0.49, 0.43, 0.39, 0.33, 0.31, 0.29, 0.26,
        ],
        [
          11.5, 8.9, 7.85, 6.57, 5.0, 4.38, 3.63, 2.6, 2.2, 1.73, 1.32, 1.2, 1.1, 0.94, 0.82,
          0.72, 0.63, 0.58, 0.53, 0.43, 0.37, 0.33, 0.28, 0.25, 0.24, 0.21,
        ],
        [
          13.8, 10.5, 9.26, 7.63, 5.66, 4.93, 4.03, 2.82, 2.36, 1.82, 1.34, 1.21, 1.09, 0.92, 0.79,
          0.68, 0.58, 0.53, 0.48, 0.38, 0.32, 0.28, 0.23, 0.2, 0.19, 0.16,
        ],
        [
          16.4, 12.3, 10.7, 8.79, 6.38, 5.51, 4.44, 3.04, 2.51, 1.9, 1.36, 1.2, 1.08, 0.89, 0.75,
          0.64, 0.54, 0.49, 0.44, 0.33, 0.27, 0.24, 0.19, 0.17, 0.15, 0.12,
        ],
        [
          18.9, 14.1, 12.1, 10.0, 7.16, 6.11, 4.86, 3.26, 2.66, 1.96, 1.37, 1.2, 1.07, 0.87, 0.72,
          0.6, 0.49, 0.44, 0.39, 0.29, 0.23, 0.2, 0.15, 0.13, 0.12, 0.09,
        ],
        [
          21.5, 16.0, 13.7, 11.18, 7.91, 6.71, 5.27, 3.46, 2.8, 2.03, 1.37, 1.2, 1.05, 0.85, 0.68,
          0.56, 0.45, 0.4, 0.35, 0.26, 0.2, 0.17, 0.12, 0.1, 0.09, 0.08,
        ],
        [
          24.0, 17.8, 15.4, 12.39, 8.67, 7.31, 5.69, 3.67, 2.9, 2.08, 1.38, 1.19, 1.04, 0.82, 0.66,
          0.53, 0.42, 0.37, 0.32, 0.22, 0.17, 0.14, 0.1, 0.08, 0.07, 0.06,
        ],
      ],
    },
  ],
} as const;

const HVM = (function () {
  const I1 = HV.interp;
  const cl = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
  const KMT = HVKM;

  function kmK(P: number, Cv: number, Cs: number): number {
    const r = Cs / Cv;
    const T = KMT.T;
    const zs = KMT.P.map((p) => HV.nInv(1 - p / 100));
    const z = HV.nInv(1 - P / 100);
    const atT = (t: (typeof KMT.T)[number]): number => {
      const c = cl(Cv, t.cv[0], t.cv[t.cv.length - 1]);
      const col = KMT.P.map((_, j) =>
        I1(
          t.cv,
          t.K.map((k) => k[j]),
          c,
        ),
      );
      return I1(zs.slice().reverse(), col.slice().reverse(), z);
    };
    const rs = T.map((t) => t.r);
    const rr = cl(r, rs[0], rs[rs.length - 1]);
    const i = rs.findIndex((x) => x >= rr);
    if (i <= 0) return atT(T[0]);
    const a = atT(T[i - 1]);
    const b = atT(T[i]);
    return a + ((b - a) * (rr - rs[i - 1])) / (rs[i] - rs[i - 1]);
  }

  function KP(dist: string, P: number, Cv: number, Cs: number): number {
    return dist === 'km' ? kmK(P, Cv, Cs) : 1 + HV.phiP(P, Cs) * Cv;
  }

  function fit(st: StatsResult, dist: string): FitResult {
    const xs = st.emp;
    const m = st.mean;
    const err = (Cv: number, Cs: number) =>
      xs.reduce((s, o) => {
        const k = KP(dist, o.P ?? 50, Cv, Cs);
        return s + (m * k - o.x) ** 2;
      }, 0);
    let best: FitResult = { Cv: st.Cv, Cs: st.Cs, e: err(st.Cv, st.Cs) };
    for (let cv = Math.max(0.05, st.Cv * 0.7); cv <= st.Cv * 1.4; cv += 0.01) {
      for (let r = 1; r <= 6.0001; r += 0.25) {
        const cs = r * cv;
        const e = err(cv, cs);
        if (e < best.e) best = { Cv: cv, Cs: cs, e };
      }
    }
    for (let it = 0; it < 2; it++) {
      const c0 = { ...best };
      for (let cv = c0.Cv - 0.01; cv <= c0.Cv + 0.01 + 1e-9; cv += 0.001) {
        for (let cs = Math.max(cv, c0.Cs - 0.25); cs <= c0.Cs + 0.25 + 1e-9; cs += 0.01) {
          const e = err(cv, cs);
          if (e < best.e) best = { Cv: cv, Cs: cs, e };
        }
      }
    }
    best.rmse = Math.sqrt(best.e / xs.length);
    best.rmse0 = Math.sqrt(err(st.Cv, st.Cs) / xs.length);
    return best;
  }

  return { kmK, KP, fit };
})();

type HvStepRow =
  | { grp: string }
  | [string, string, string, string, string, string];

const hvM = (t: string) => `<span class="m" data-tex="${String(t).replace(/"/g, '&quot;')}"></span>`;
const hvLong = (val: unknown): boolean => {
  const t = String(val == null ? '' : val).replace(/<[^>]+>/g, '');
  return t.length > 16 && !/^[-\d.,; ]+$/.test(t);
};
function hvRow(lab: string, sym: string, val: string, unit: string, note: string, f?: number): string {
  return `<div class="row${f ? ' f' : ''}"><span></span><span>${lab}</span><span class="sym">${sym || ''}</span><span class="val">${val == null ? '' : val}</span><span class="unit">${unit || ''}</span><span class="note">${note || ''}</span></div>`;
}
const hvHead = (t: string) => `<div class="row"><span></span><span>${t}</span></div>`;
const hvSrc = (s: string) => (s ? ` <i>(${s})</i>` : '');

function hvStepT(rows: HvStepRow[]): string {
  const expanded: HvStepRow[] = rows.flatMap((r): HvStepRow[] => {
    if ('grp' in r) return [r];
    if (!/ ; /.test(r[2] || '')) return [r];
    const L = r[0].split(' ; ');
    const S = r[2].split(' ; ');
    const V = String(r[3]).split(' ; ');
    if (S.length === V.length && !r[1]) {
      return S.map((sy, k): HvStepRow => [
        L.length === S.length ? L[k].charAt(0).toUpperCase() + L[k].slice(1) : r[0],
        '',
        sy,
        V[k],
        r[4],
        k === S.length - 1 ? r[5] : '',
      ]);
    }
    return [[r[0] + ' ' + r[2] + ' = ' + r[3] + (r[4] ? ' ' + r[4] : ''), r[1], '', '', '', r[5]]];
  });
  return expanded
    .map((r) => {
      if ('grp' in r) return hvHead(`<b>${r.grp}</b>`);
      const [lab, tex, sym, val, unit, src] = r;
      const ok = /class="(ok|bad)"/.test(String(val));
      if (tex) {
        return (
          hvHead(lab + hvSrc(src)) + hvRow(hvM(tex), sym, ok ? '' : val, unit, ok ? val : '', 1)
        );
      }
      if (ok) return hvRow(lab + hvSrc(src), sym, '', unit, val);
      if (hvLong(val) || / ; /.test(String(val))) {
        return hvHead(
          lab +
            hvSrc(src) +
            ': ' +
            (sym && / ; /.test(String(val)) ? sym + ' = ' : '') +
            val +
            (unit && / ; /.test(String(val)) ? ' ' + unit : ''),
        );
      }
      return hvRow(lab + hvSrc(src), sym, val, unit, '');
    })
    .join('');
}

function hvTab(head: string[], rows: Array<string[] | { c: string[]; sel?: boolean }>): string {
  return (
    '<table class="t dt"><tr>' +
    head.map((h) => `<th>${h}</th>`).join('') +
    '</tr>' +
    rows
      .map((r) => {
        const sel = !Array.isArray(r) && r.sel;
        const cells = Array.isArray(r) ? r : r.c;
        return (
          `<tr${sel ? ' style="background:#fff2cc"' : ''}>` +
          cells.map((c, i) => `<td${i === 0 ? ' class="l"' : ''}>${c}</td>`).join('') +
          '</tr>'
        );
      })
      .join('') +
    '</table>'
  );
}

// ============================================================================
// 3. Hydraulic Discharge Lookup Tables (`TVC_Q`, `TVC_BAN`, `TVC_COLS`)
// ============================================================================

export const TVC_Q: {
  R: TvcDischargeRow[];
  B: TvcDischargeRow[];
  QA: {
    tron: Record<string, number>;
    hop: Record<string, number>;
  };
} = {
  R: [
    {
      s: '75',
      Q: 2,
      r: [
        [0.4, 0.6, 1.71],
        [0.6, 0.77, 2.12],
        [0.8, 1.02, 2.83],
        [0.9, 1.2, 3.25],
        [1, 1.32, 3.51],
        [1.1, 1.44, 3.74],
        [1.2, 1.72, 4.23],
        [1.4, 2.17, 4.95],
        [1.6, 2.7, 5.63],
        [1.8, 3.3, 6.35],
        [2, 3.97, 7.05],
      ],
    },
    {
      s: '90',
      Q: 4,
      r: [
        [0.4, 0.56, 1.6],
        [0.6, 0.71, 1.85],
        [0.8, 0.83, 2.07],
        [0.9, 0.9, 2.2],
        [1, 0.96, 2.43],
        [1.1, 1.01, 2.58],
        [1.2, 1.14, 2.91],
        [1.4, 1.36, 3.4],
        [1.6, 1.52, 3.88],
        [1.8, 1.89, 4.37],
        [2, 2.22, 4.85],
        [2.2, 2.55, 5.35],
        [2.5, 3.15, 6.07],
        [3, 4.29, 7.29],
      ],
    },
    {
      s: '100',
      Q: 6,
      r: [
        [0.4, 0.54, 1.57],
        [0.6, 0.67, 1.77],
        [0.8, 0.79, 1.96],
        [0.9, 0.86, 2.08],
        [1, 0.9, 2.14],
        [1.1, 0.94, 2.2],
        [1.2, 1, 2.32],
        [1.4, 1.13, 2.74],
        [1.6, 1.29, 3.12],
        [1.8, 1.47, 3.51],
        [2, 1.68, 3.91],
        [2.2, 1.94, 4.35],
        [2.5, 2.29, 4.88],
        [3, 3.04, 5.86],
        [3.3, 3.49, 6.38],
        [3.5, 3.92, 6.85],
        [3.8, 4.7, 7.61],
      ],
    },
    {
      s: '125',
      Q: 8,
      r: [
        [0.4, 0.49, 1.5],
        [0.6, 0.63, 1.75],
        [0.8, 0.73, 1.83],
        [0.9, 0.79, 1.91],
        [1, 0.82, 1.95],
        [1.1, 0.85, 2],
        [1.2, 0.91, 2.1],
        [1.4, 0.99, 2.2],
        [1.6, 1.06, 2.3],
        [1.8, 1.14, 2.42],
        [2, 1.22, 2.55],
        [2.2, 1.31, 2.8],
        [2.5, 1.45, 3.14],
        [3, 1.76, 3.78],
        [3.3, 1.95, 4.12],
        [3.5, 2.11, 4.41],
        [3.8, 2.45, 4.9],
        [4, 2.55, 5.04],
        [4.5, 3.03, 5.66],
        [4.8, 3.38, 6.05],
        [5, 3.56, 6.3],
        [5.5, 4.16, 6.93],
        [6, 4.8, 7.56],
      ],
    },
    {
      s: '150',
      Q: 10,
      r: [
        [0.4, 0.48, 1.43],
        [0.6, 0.59, 1.65],
        [0.8, 0.69, 1.78],
        [0.9, 0.73, 1.83],
        [1, 0.77, 1.86],
        [1.1, 0.8, 1.9],
        [1.2, 0.85, 1.97],
        [1.4, 0.91, 2.06],
        [1.6, 0.99, 2.14],
        [1.8, 1.06, 2.25],
        [2, 1.12, 2.33],
        [2.2, 1.2, 2.41],
        [2.5, 1.28, 2.52],
        [3, 1.42, 2.73],
        [3.3, 1.5, 2.84],
        [3.5, 1.56, 3.06],
        [3.8, 1.67, 3.38],
        [4, 1.77, 3.5],
        [4.5, 2, 3.94],
        [4.8, 2.16, 4.21],
        [5, 2.25, 4.37],
        [5.5, 2.57, 4.81],
        [6, 2.84, 5.25],
        [6.1, 2.88, 5.3],
        [6.5, 3.2, 5.68],
        [6.7, 3.34, 5.86],
        [7, 3.56, 6.12],
        [7.5, 3.96, 6.56],
        [8, 4.32, 6.95],
        [8.5, 4.82, 7.45],
      ],
    },
    {
      s: '175',
      Q: 12,
      r: [
        [0.4, 0.44, 1.36],
        [0.6, 0.54, 1.53],
        [0.8, 0.63, 1.68],
        [0.9, 0.7, 1.8],
        [1, 0.73, 1.83],
        [1.1, 0.76, 1.86],
        [1.2, 0.8, 1.91],
        [1.4, 0.89, 2.01],
        [1.6, 0.95, 2.08],
        [1.8, 1, 2.14],
        [2, 1.07, 2.19],
        [2.2, 1.13, 2.28],
        [2.5, 1.21, 2.38],
        [3, 1.31, 2.51],
        [3.3, 1.38, 2.58],
        [3.5, 1.43, 2.66],
        [3.8, 1.53, 2.77],
        [4, 1.56, 2.8],
        [4.5, 1.68, 2.97],
        [4.8, 1.75, 3.06],
        [5, 1.78, 3.24],
        [5.5, 1.94, 3.56],
        [6, 2.11, 3.88],
        [6.1, 2.13, 3.91],
        [6.5, 2.3, 4.2],
        [6.7, 2.39, 4.35],
        [7, 2.5, 4.53],
        [7.5, 2.72, 4.85],
        [8, 2.94, 5.18],
        [8.5, 3.18, 5.5],
        [9, 3.45, 5.83],
        [9.5, 3.73, 6.15],
        [10, 4, 6.46],
        [11, 4.63, 7.1],
      ],
    },
    {
      s: '200',
      Q: 14,
      r: [
        [0.4, 0.42, 1.34],
        [0.6, 0.52, 1.48],
        [0.8, 0.58, 1.58],
        [0.9, 0.64, 1.66],
        [1, 0.68, 1.74],
        [1.1, 0.72, 1.79],
        [1.2, 0.78, 1.8],
        [1.4, 0.84, 1.96],
        [1.6, 0.9, 2.03],
        [1.8, 0.96, 2.08],
        [2, 1.02, 2.14],
        [2.2, 1.07, 2.2],
        [2.5, 1.14, 2.28],
        [3, 1.26, 2.41],
        [3.3, 1.32, 2.48],
        [3.5, 1.38, 2.54],
        [3.8, 1.46, 2.62],
        [4, 1.48, 2.65],
        [4.5, 1.58, 2.76],
        [4.8, 1.64, 2.84],
        [5, 1.67, 2.86],
        [5.5, 1.77, 2.97],
        [6, 1.86, 3.08],
        [6.1, 1.88, 3.11],
        [6.5, 1.96, 3.21],
        [6.7, 2, 3.27],
        [7, 2.07, 3.42],
        [7.5, 2.16, 3.66],
        [8, 2.28, 3.9],
        [8.5, 2.42, 4.14],
        [9, 2.58, 4.4],
        [9.5, 2.73, 4.64],
        [10, 2.9, 4.88],
        [11, 3.24, 5.35],
        [12, 3.64, 5.86],
        [13, 4.06, 6.34],
        [14, 4.51, 6.84],
        [15, 5, 7.3],
      ],
    },
  ],
  B: [
    {
      s: '100x100',
      Q: 2,
      r: [
        [0.4, 0.43, 1.58],
        [0.6, 0.56, 1.81],
        [0.8, 0.63, 1.98],
        [1, 0.79, 2.14],
        [1.2, 0.89, 2.26],
        [1.4, 0.99, 2.39],
        [1.6, 1.08, 2.48],
        [1.8, 1.2, 2.79],
        [2, 1.32, 3.08],
        [2.5, 1.7, 3.85],
        [2.6, 1.78, 3.98],
        [3, 2.17, 4.64],
        [3.5, 2.71, 5.4],
        [4, 3.35, 6.16],
        [4.5, 4.06, 6.94],
      ],
    },
    {
      s: '150x150',
      Q: 4,
      r: [
        [0.4, 0.43, 1.58],
        [0.6, 0.56, 1.81],
        [0.8, 0.68, 1.98],
        [1, 0.79, 2.14],
        [1.2, 0.89, 2.26],
        [1.4, 0.99, 2.39],
        [1.6, 1.08, 2.5],
        [1.8, 1.16, 2.59],
        [2, 1.26, 2.7],
        [2.5, 1.45, 2.9],
        [2.6, 1.5, 2.95],
        [3, 1.64, 3.04],
        [3.5, 1.87, 3.55],
        [4, 2.15, 4.06],
        [4.5, 2.46, 4.56],
        [5, 2.8, 5.07],
        [5.5, 3.19, 5.59],
        [6, 3.61, 6.1],
        [6.5, 4.06, 6.58],
        [7, 4.55, 7.1],
      ],
    },
    {
      s: '200x200',
      Q: 6,
      r: [
        [0.4, 0.43, 1.58],
        [0.6, 0.56, 1.81],
        [0.8, 0.68, 1.98],
        [1, 0.79, 2.14],
        [1.2, 0.89, 2.26],
        [1.4, 0.99, 2.39],
        [1.6, 1.08, 2.5],
        [1.8, 1.16, 2.59],
        [2, 1.26, 2.7],
        [2.5, 1.45, 2.9],
        [2.6, 1.5, 2.95],
        [3, 1.64, 3.08],
        [3.5, 1.83, 3.25],
        [4, 2.02, 3.39],
        [4.5, 2.11, 3.4],
        [5, 2.3, 3.76],
        [5.5, 2.51, 4.14],
        [6, 2.74, 4.52],
        [6.5, 2.99, 4.89],
        [7, 3.26, 5.26],
        [7.5, 3.55, 5.65],
        [8, 3.96, 6.02],
        [8.5, 4.19, 6.4],
        [9, 4.54, 6.78],
        [9.3, 4.76, 6.99],
        [9.5, 4.91, 7.15],
      ],
    },
    {
      s: '250x250',
      Q: 8,
      r: [
        [0.4, 0.43, 1.58],
        [0.6, 0.56, 1.81],
        [0.8, 0.68, 1.98],
        [1, 0.79, 2.14],
        [1.2, 0.89, 2.26],
        [1.4, 0.99, 2.39],
        [1.6, 1.08, 2.5],
        [1.8, 1.16, 2.59],
        [2, 1.26, 2.7],
        [2.5, 1.45, 2.9],
        [2.6, 1.5, 2.95],
        [3, 1.64, 3.08],
        [3.5, 1.83, 3.25],
        [4, 2.05, 3.4],
        [4.5, 2.16, 3.53],
        [5, 2.32, 3.66],
        [5.5, 2.46, 3.78],
        [6, 2.54, 3.84],
        [6.5, 2.7, 3.91],
        [7, 2.88, 4.21],
        [7.5, 3.06, 4.51],
        [8, 3.26, 4.81],
        [8.5, 3.47, 5.11],
        [9, 3.7, 5.41],
        [9.3, 3.82, 5.6],
        [9.5, 3.98, 5.71],
        [10, 4.18, 6.01],
        [11, 4.72, 6.6],
        [12, 5.32, 7.2],
      ],
    },
    {
      s: '300x300',
      Q: 10,
      r: [
        [0.4, 0.43, 1.58],
        [0.6, 0.56, 1.84],
        [0.8, 0.68, 1.98],
        [1, 0.79, 2.11],
        [1.2, 0.89, 2.26],
        [1.4, 0.99, 2.39],
        [1.6, 1.08, 2.5],
        [1.8, 1.16, 2.59],
        [2, 1.26, 2.7],
        [2.5, 1.45, 2.9],
        [2.6, 1.5, 2.95],
        [3, 1.64, 3.08],
        [3.5, 1.83, 3.25],
        [4, 2.05, 3.4],
        [4.5, 2.16, 3.53],
        [5, 2.32, 3.66],
        [5.5, 2.46, 3.78],
        [6, 2.61, 3.9],
        [6.5, 2.76, 3.99],
        [7, 2.88, 4.08],
        [7.5, 3.03, 4.18],
        [8, 3.21, 4.21],
        [8.5, 3.37, 4.17],
        [9, 3.51, 4.74],
        [9.3, 3.64, 4.88],
        [9.5, 3.72, 5],
        [10, 3.91, 5.26],
        [11, 4.32, 5.89],
        [12, 5.26, 6.82],
        [13, 5.79, 7.36],
      ],
    },
    {
      s: '350x350',
      Q: 12,
      r: [
        [0.4, 0.43, 1.58],
        [0.6, 0.56, 1.84],
        [0.8, 0.68, 1.98],
        [1, 0.79, 2.11],
        [1.2, 0.89, 2.26],
        [1.4, 0.99, 2.39],
        [1.6, 1.08, 2.5],
        [1.8, 1.16, 2.59],
        [2, 1.26, 2.7],
        [2.5, 1.45, 2.9],
        [2.6, 1.5, 2.95],
        [3, 1.64, 3.08],
        [3.5, 1.83, 3.25],
        [4, 2.05, 3.4],
        [4.5, 2.16, 3.53],
        [5, 2.32, 3.66],
        [5.5, 2.46, 3.78],
        [6, 2.61, 3.9],
        [6.5, 2.76, 3.99],
        [7, 2.88, 4.08],
        [7.5, 3.02, 4.18],
        [8, 3.16, 4.28],
        [8.5, 3.28, 4.36],
        [9, 3.42, 4.45],
        [9.3, 3.5, 4.5],
        [9.5, 3.53, 4.51],
        [10, 3.71, 4.52],
        [11, 3.91, 4.9],
        [12, 4.27, 5.35],
        [13, 4.93, 5.8],
        [14, 5.02, 6.25],
        [15, 5.14, 6.7],
        [16, 5.87, 7.15],
      ],
    },
    {
      s: '400x400',
      Q: 14,
      r: [
        [0.4, 0.43, 1.58],
        [0.6, 0.56, 1.84],
        [0.8, 0.68, 1.98],
        [1, 0.79, 2.11],
        [1.2, 0.89, 2.26],
        [1.4, 0.99, 2.39],
        [1.6, 1.08, 2.5],
        [1.8, 1.16, 2.59],
        [2, 1.26, 2.7],
        [2.5, 1.45, 2.9],
        [2.6, 1.5, 2.95],
        [3, 1.64, 3.08],
        [3.5, 1.83, 3.25],
        [4, 2.05, 3.4],
        [4.5, 2.16, 3.53],
        [5, 2.32, 3.66],
        [5.5, 2.46, 3.78],
        [6, 2.61, 3.9],
        [6.5, 2.76, 3.99],
        [7, 2.88, 4.08],
        [7.5, 3.02, 4.18],
        [8, 3.16, 4.28],
        [8.5, 3.28, 4.36],
        [9, 3.42, 4.45],
        [9.3, 3.5, 4.5],
        [9.5, 3.56, 4.54],
        [10, 3.68, 4.62],
        [11, 3.9, 4.75],
        [12, 4.04, 4.82],
        [13, 4.29, 4.89],
        [14, 4.56, 5.26],
        [15, 4.85, 5.61],
        [16, 5.16, 6.02],
        [17, 5.49, 6.4],
        [18, 5.84, 6.76],
        [19, 6.21, 7.15],
      ],
    },
  ],
  QA: {
    tron: { 75: 0.6, 90: 0.9, 100: 1.2, 125: 2, 150: 3.3, 175: 4.8, 200: 6.7 },
    hop: {
      '100x100': 1.4,
      '150x150': 2.6,
      '200x200': 4,
      '250x250': 6,
      '300x300': 7.5,
      '350x350': 9.3,
      '400x400': 11,
    },
  },
};

export const TVC_BAN: readonly string[] = ['75', '100', '150', '240', '340', '440', '540'];

export const TVC_COLS: readonly TvcColDef[] = [
  ['km', 'Lý trình', 66, 't'],
  ['name', 'Tên cống', 40, 't'],
  ['F', 'F (km²)', 46],
  ['L', 'L (km)', 40],
  ['sl', 'Σl (km)', 36],
  ['Jls', 'Jls (‰)', 40],
  ['Jsd', 'Jsd (‰)', 40],
  ['two', 'Số sườn', 60, 's2'],
  ['typ', 'Loại cống', 78, 'st'],
  ['d', 'Khẩu độ (cm)', 70, 'sd'],
  ['n', 'Số cửa', 30],
  ['h', 'H (cm), nếu đã chọn', 56],
  ['zd', 'Cao độ đáy (m)', 50],
  ['i', 'Độ dốc i', 42],
  ['zr', 'Mép nền (m)', 50],
];

// ============================================================================
// 4. Sizing, Lookup & Row Management (`tvcSize`, `tvcHV`, `tvcRows`, ...)
// ============================================================================

export function tvcSize(typ: string, d: string | number | undefined): TvcSizeSpec {
  const s = String(d ?? '').trim();
  if (typ === 'hop') {
    const m = s.match(/(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)/);
    if (m) {
      return {
        b: +m[1] / 100,
        h: +m[2] / 100,
        key: s.replace(/\s/g, '').replace(/[X×]/g, 'x'),
      };
    }
    const val = parseFloat(s);
    return { b: val / 100, h: val / 100, key: val + 'x' + val };
  }
  const val = parseFloat(s);
  return { b: val / 100, h: val / 100, key: String(val) };
}

export function tvcHV(typ: string, key: string, q: number): TvcHvLookupResult | null {
  const T = (typ === 'hop' ? TVC_Q.B : TVC_Q.R).find((c) => c.s === key);
  if (!T) return null;
  const r = T.r;
  if (!r.length) return null;
  if (q < r[0][0]) return { H: r[0][1], V: r[0][2], lo: true };
  if (q > r[r.length - 1][0] + 1e-9) return { out: true, qmax: r[r.length - 1][0] };
  for (let i = 1; i < r.length; i++) {
    if (q <= r[i][0] + 1e-12) {
      const a = r[i - 1];
      const b = r[i];
      const t = (q - a[0]) / (b[0] - a[0]);
      return { H: a[1] + t * (b[1] - a[1]), V: a[2] + t * (b[2] - a[2]), a, b };
    }
  }
  return null;
}

export function tvcRows(): TvcRowInput[] {
  try {
    const parsed = JSON.parse(v('tvc_rows', '[]') || '[]');
    return Array.isArray(parsed) ? (parsed as TvcRowInput[]) : [];
  } catch {
    return [];
  }
}

export function tvcSave(rows: TvcRowInput[]): void {
  const e = $('tvc_rows');
  if (!e) return;
  e.value = JSON.stringify(rows);
  if (typeof Event !== 'undefined' && typeof (e as unknown as EventTarget).dispatchEvent === 'function') {
    (e as unknown as EventTarget).dispatchEvent(new Event('input', { bubbles: true }));
  }
}

export function tvcEditor(): void {
  const box = $('tvc_ed');
  if (!box) return;
  const rows = tvcRows();
  const sizes = (t?: string) =>
    t === 'ban' ? [...TVC_BAN] : Object.keys(TVC_Q.QA[t === 'hop' ? 'hop' : 'tron']);
  let h = `<table class="t" id="tvc_tbIn"><tr><th>TT</th>${TVC_COLS.map((c) => `<th>${c[1]}</th>`).join('')}<th></th></tr>`;
  rows.forEach((r, i) => {
    h +=
      `<tr data-i="${i}"><td class="c">${i + 1}</td>` +
      TVC_COLS.map(([k, , w, t]) => {
        const val = r[k] == null ? '' : r[k];
        if (t === 's2') {
          return `<td><select class="tvcE" data-k="${k}" style="width:${w}px"><option value="2"${String(val) !== '1' ? ' selected' : ''}>2 sườn</option><option value="1"${String(val) === '1' ? ' selected' : ''}>1 sườn</option></select></td>`;
        }
        if (t === 'st') {
          return `<td><select class="tvcE" data-k="${k}" style="width:${w}px"><option value="tron"${val !== 'hop' && val !== 'ban' ? ' selected' : ''}>Cống tròn</option><option value="hop"${val === 'hop' ? ' selected' : ''}>Cống hộp</option><option value="ban"${val === 'ban' ? ' selected' : ''}>Cống bản</option></select></td>`;
        }
        if (t === 'sd') {
          return `<td><select class="tvcE" data-k="${k}" style="width:${w}px">${sizes(String(r.typ ?? 'tron'))
            .map((s) => `<option value="${s}"${String(val) === s ? ' selected' : ''}>${s}</option>`)
            .join('')}</select></td>`;
        }
        return `<td><input class="tvcE" data-k="${k}" value="${String(val).replace(/"/g, '&quot;')}" style="width:${w}px"${t ? '' : ' inputmode="decimal"'}></td>`;
      }).join('') +
      `<td><button type="button" class="btn2 tvcDel" title="Xóa cống">✕</button></td></tr>`;
  });
  h += `</table><div class="row"><span></span><span><button type="button" class="btn2" id="tvc_add">Thêm cống</button> <span class="small">Dán nhiều dòng từ Excel vào ô đầu tiên của một dòng: các cột theo đúng thứ tự trên.</span></span></div>`;
  box.innerHTML = h;

  if (!box.querySelectorAll) return;

  box.querySelectorAll('.tvcE').forEach((rawEl) => {
    const el = rawEl as unknown as HTMLInputElement | HTMLSelectElement;
    const f = () => {
      const R = tvcRows();
      const tr = el.closest('tr') as HTMLElement | null;
      const i = tr ? Number(tr.dataset.i) : -1;
      const k = el.dataset.k;
      if (i < 0 || !R[i] || !k) return;
      R[i][k] = el.value;
      if (k === 'typ') {
        R[i].d =
          el.value === 'ban'
            ? TVC_BAN[3]
            : Object.keys(TVC_Q.QA[el.value === 'hop' ? 'hop' : 'tron'])[0];
        tvcSave(R);
        tvcEditor();
      } else {
        tvcSave(R);
      }
      tvcSched();
    };
    el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', f);
    if (el.tagName === 'INPUT') {
      el.addEventListener('paste', (rawEv) => {
        const ev = rawEv as ClipboardEvent;
        const winClip =
          typeof window !== 'undefined'
            ? (window as unknown as { clipboardData?: DataTransfer }).clipboardData
            : undefined;
        const txt = (ev.clipboardData || winClip)?.getData('text') || '';
        if (!/[\t\n]/.test(txt)) return;
        ev.preventDefault();
        const R = tvcRows();
        const tr = el.closest('tr') as HTMLElement | null;
        const i0 = tr ? Number(tr.dataset.i) : 0;
        const c0 = TVC_COLS.findIndex((c) => c[0] === el.dataset.k);
        txt
          .replace(/\r/g, '')
          .split('\n')
          .filter((l) => l.trim())
          .forEach((l, j) => {
            const a = l.split('\t');
            const r = R[i0 + j] || (R[i0 + j] = { two: '2', typ: 'tron', d: '100', n: '1' });
            a.forEach((rawVal, k) => {
              const col = TVC_COLS[c0 + k];
              if (!col) return;
              let val = rawVal.trim();
              if (col[0] === 'two') val = /1/.test(val) ? '1' : '2';
              else if (col[0] === 'typ') {
                val = /b[ảa]n/i.test(val) ? 'ban' : /h[ộo]p|vu[ôo]ng/i.test(val) ? 'hop' : 'tron';
              } else if (!col[3]) val = val.replace(',', '.');
              r[col[0]] = val;
            });
          });
        tvcSave(R);
        tvcEditor();
        tvcSched();
      });
    }
  });

  box.querySelectorAll('.tvcDel').forEach((rawBtn) => {
    const b = rawBtn as unknown as HTMLButtonElement;
    b.onclick = () => {
      const R = tvcRows();
      const tr = b.closest('tr') as HTMLElement | null;
      if (!tr) return;
      R.splice(Number(tr.dataset.i), 1);
      tvcSave(R);
      tvcEditor();
      tvcSched();
    };
  });

  const addBtn = $('tvc_add') as unknown as HTMLButtonElement | null;
  if (addBtn) {
    addBtn.onclick = () => {
      const R = tvcRows();
      const last = R[R.length - 1] || {};
      R.push({
        km: '',
        name: 'C' + (R.length + 1),
        F: '',
        L: '',
        sl: '0',
        Jls: '',
        Jsd: '',
        two: last.two || '2',
        typ: last.typ || 'tron',
        d: last.d || '100',
        n: '1',
      });
      tvcSave(R);
      tvcEditor();
    };
  }
}

let tvcT: ReturnType<typeof setTimeout> | null = null;
export function tvcSched(): void {
  if (tvcT !== null) clearTimeout(tvcT);
  tvcT = setTimeout(() => {
    try {
      tvcStep();
    } catch (e) {
      console.error(e);
    }
  }, 250);
}

export function tvcStFill(): void {
  const s = $('tvc_st');
  if (!s || (s.options && s.options.length)) return;
  let g = '';
  let h = '';
  TVC_ST.forEach((r: TvcStationRow, i: number) => {
    if (r[0] !== g) {
      if (g) h += '</optgroup>';
      g = r[0];
      h += `<optgroup label="${g}">`;
    }
    h += `<option value="${i}">${r[1]}</option>`;
  });
  s.innerHTML = h + '</optgroup>';
  const dv = s.dataset?.v;
  if (dv != null && dv !== '') s.value = dv;
}

export function tvcSer(rawText?: string): Array<{ y: number; x: number }> {
  const srcText = rawText != null ? rawText : v('tvc_rain', '');
  return String(srcText || '')
    .split(/\r?\n/)
    .map((l) =>
      l
        .trim()
        .replace(/,(?=\d)/g, '.')
        .split(/[\s;\t]+/)
        .map(Number),
    )
    .filter((a) => a.length >= 2 && a.every(Number.isFinite))
    .map((a) => ({ y: a[0], x: a[1] }));
}

export function tvcStLoad(force: boolean): void {
  const s = $('tvc_st2');
  const ta = $('tvc_rain');
  if (!s || !ta || typeof HVST === 'undefined') return;
  const D = HVST[s.value];
  if (D && (force || !ta.value.trim())) {
    ta.value = D.ser.map((a: RainSeriesEntry) => a[0] + ' ' + a[1]).join('\n');
    if (typeof Event !== 'undefined' && typeof (ta as unknown as EventTarget).dispatchEvent === 'function') {
      (ta as unknown as EventTarget).dispatchEvent(new Event('input', { bubbles: true }));
    }
  } else if (!D && force) {
    const cur = ta.value.trim();
    if (
      cur &&
      Object.values(HVST).some((X) => X.ser.map((a) => a[0] + ' ' + a[1]).join('\n') === cur)
    ) {
      ta.value = '';
      if (typeof Event !== 'undefined' && typeof (ta as unknown as EventTarget).dispatchEvent === 'function') {
        (ta as unknown as EventTarget).dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  }
  const n = $('tvc_stn');
  const row = n?.closest?.('.row');
  if (row?.style) row.style.display = s.value === 'khac' ? '' : 'none';
  const rb = $('tvc_stRe');
  if (rb?.style) rb.style.display = D ? '' : 'none';
}

// ============================================================================
// 5. Rainfall Design Depth & Hydraulic Calculation (`tvcHp`, `tvcCalc`, `tvcStep`)
// ============================================================================

export function tvcHp(P: number, options?: TvcHpInput): TvcHpResult {
  const src = options?.hps ?? v('tvc_hps', 'tram');
  const PI = ({ 1: 2, 2: 3, 4: 4, 10: 5 } as Record<number, number>)[P];
  if (src === 'ser') {
    const st2Val = options?.st2 ?? v('tvc_st2', '');
    const stnVal = options?.stn ?? v('tvc_stn', '');
    const nm = st2Val === 'khac' ? String(stnVal || '').trim() : st2Val;
    const ser = options?.ser ? options.ser : tvcSer(options?.rain);
    const st = HV.stats(ser);
    const dist = options?.rd ?? (v('tvc_rd', 'p3') || 'p3');
    if (!st) {
      return {
        Hp: NaN,
        how: `Trạm ${nm}: chưa có chuỗi lượng mưa ngày lớn nhất năm (cần ít nhất 3 năm)`,
      };
    }
    let Cv = st.Cv;
    let Cs = st.Cs;
    let pm: 'mom' | 'fit' = 'mom';
    const warn: string[] = [];
    const rm = options?.rm ?? v('tvc_rm', 'mom');
    if (rm === 'fit') {
      const f = HVM.fit(st, dist);
      Cv = f.Cv;
      Cs = f.Cs;
      pm = 'fit';
    } else if (!st.csOK) {
      warn.push(
        'Cs tính theo mô men không thỏa 2Cv ≤ Cs ≤ 2Cv/(1 - Kmin) (Sổ tay bước 5): nên dùng phương pháp thích hợp.',
      );
    }
    if (st.n < 20) warn.push(`Chuỗi mưa chỉ có ${st.n} năm (< 20 năm, Sổ tay mục 2.2.1a).`);
    const KP = HVM.KP(dist, P, Cv, Cs);
    const ys = ser.map((o) => o.y);
    return {
      Hp: st.mean * KP,
      ser: {
        nm,
        n: st.n,
        y0: Math.min(...ys),
        y1: Math.max(...ys),
        Xm: st.mean,
        Cv,
        Cs,
        KP,
        pm,
        dist,
        csOK: st.csOK,
      },
      how: `Trạm ${nm}, phân tích tần suất chuỗi lượng mưa ngày lớn nhất năm`,
      warn: warn.join(' '),
    };
  }
  if (src === 'tram') {
    const stRaw = options?.st !== undefined ? options.st : v('tvc_st', '0');
    const r = TVC_ST[+stRaw];
    if (!r) return { Hp: NaN };
    const mono = r[2] >= r[3] && r[3] >= r[4] && r[4] >= r[5];
    const hpVal = PI != null ? (r[PI] as number) : NaN;
    return {
      Hp: hpVal,
      how: `Trạm ${r[1]} (${r[0]}), H${P}% theo 22TCN 220-95 Phụ lục 1`,
      warn: mono
        ? ''
        : `Số liệu trạm ${r[1]} trong bảng tra không giảm dần theo tần suất (H1% = ${r[2]}, H2% = ${r[3]}, H4% = ${r[4]}, H10% = ${r[5]} mm): kiểm tra lại bản gốc.`,
    };
  }
  const hpManual = options?.Hp !== undefined ? options.Hp : num('tvc_Hp');
  return { Hp: hpManual, how: 'Nhập theo tài liệu khí tượng của dự án' };
}

export function tvcCalc(options?: TvcCalcInput): TvcCalcResult {
  const P = options?.P !== undefined ? options.P : +v('tvc_P', '2');
  const H: TvcHpResult =
    options?.Hp !== undefined
      ? { Hp: options.Hp, how: 'Nhập trực tiếp' }
      : tvcHp(P, options?.hp);
  const C: TvcCalcCommon = {
    P,
    Hp: H.Hp,
    how: H.how,
    hwarn: H.warn,
    ser: H.ser,
    reg: options?.reg ?? v('tvc_reg', 'I'),
    cls: options?.cls ?? v('tvc_cls', 'II'),
    msd: options?.msd ?? num('tvc_msd'),
    mls: options?.mls ?? num('tvc_mls'),
    fao: options?.fao ?? num('tvc_fao'),
    aoPos: options?.aoPos ?? v('tvc_aoPos', 'h'),
    kgc: (options?.kgc ?? num('tvc_kgc')) || 3,
    phi: (options?.phi ?? num('tvc_phi')) || 1,
    nc: (options?.nc ?? num('tvc_nc')) || 0.013,
    xoi: options?.xoi !== undefined ? options.xoi : v('tvc_xoi', '1') !== '0',
    hd: (options?.hd ?? num('tvc_hd')) || 0.5,
  };

  const rows = options?.rows ?? tvcRows();
  const out: TvcCulvertOutcome[] = rows.map((r, i) => {
    const o: TvcCulvertOutcome = {
      i,
      r,
      km: r.km || '',
      name: r.name || 'C' + (i + 1),
      F: +(r.F ?? NaN),
      L: +(r.L ?? NaN),
      sl: +(r.sl ?? 0) || 0,
      Jls: +(r.Jls ?? NaN),
      Jsd: +(r.Jsd ?? NaN),
      two: String(r.two) !== '1',
      typ: r.typ === 'hop' ? 'hop' : r.typ === 'ban' ? 'ban' : 'tron',
      d: r.d,
      n: Math.max(1, Math.round(+(r.n ?? 1) || 1)),
      err: [],
    };
    if (!(o.F > 0) || !(o.L > 0) || !(o.Jls > 0) || !(o.Jsd > 0)) {
      o.err.push('thiếu F, L, Jls hoặc Jsd');
      return o;
    }
    if (o.F >= 100) o.err.push('F ≥ 100 km²: không thuộc phạm vi công thức cường độ giới hạn');
    if (!(C.Hp > 0)) {
      o.err.push('chưa có HP');
      return o;
    }
    const q = HV.qp(
      {
        F: o.F,
        L: o.L,
        sl: o.sl,
        two: o.two,
        Jls: o.Jls,
        Jsd: o.Jsd,
        msd: C.msd,
        mls: C.mls,
        cls: C.cls,
        reg: C.reg,
        fao: C.fao,
        aoPos: C.aoPos,
      },
      C.Hp,
    );
    if (!q) {
      o.err.push('không tra được Bảng A.1');
      return o;
    }
    o.q = q;
    o.Q = q.Q;
    const S0 =
      o.typ === 'ban'
        ? { b: parseFloat(String(o.d)) / 100, h: NaN, key: String(o.d) }
        : tvcSize(o.typ, o.d);
    const hu = parseFloat(String(r.h || '').replace(',', '.'));
    const S: TvcSizeSpec = { ...S0, h: o.typ === 'tron' ? S0.h : hu > 0 ? hu / 100 : S0.h };
    o.S = S;
    o.Q1 = o.Q / o.n;
    o.zd = parseFloat(String(r.zd || '').replace(',', '.'));
    o.i = parseFloat(String(r.i || '').replace(',', '.'));
    o.iSlope = o.i;
    o.zr = parseFloat(String(r.zr || '').replace(',', '.'));

    if (o.typ === 'ban') {
      // Cống bản / chữ nhật chảy không áp (TKĐ tập 3, Mục 10.1):
      // hk = cbrt(q^2 / g), hc = 0.9*hk, H0 = hc + Vc^2/(2*g*phi^2), 100-step Manning bisection
      const g = 9.81;
      const qd = o.Q1 / S.b;
      const hk = Math.cbrt((qd * qd) / g);
      const hc = 0.9 * hk;
      const w = S.b * hc;
      const Vc = o.Q1 / w;
      const H0 = hc + (Vc * Vc) / (2 * g * C.phi * C.phi);
      let ho = hk;
      let hn: number | null = null;
      if (o.iSlope > 0) {
        const f = (h: number) => {
          const A = S.b * h;
          const R = A / (S.b + 2 * h);
          return (A * Math.pow(R, 2 / 3) * Math.sqrt(o.iSlope!)) / C.nc - o.Q1!;
        };
        let lo = 1e-4;
        let hi = Math.max(5 * hk, 0.5);
        for (let k = 0; k < 100; k++) {
          const m = (lo + hi) / 2;
          if (f(m) < 0) lo = m;
          else hi = m;
        }
        hn = (lo + hi) / 2;
        ho = Math.min(hn, hk);
      }
      o.rc = { qd, hk, hc, w, Vc, H0, hn, ho, Vra: o.Q1 / (S.b * ho) };
      o.QA = null;
      o.qOK = true;
      o.hv = { H: H0, V: o.rc.Vra };
    } else {
      o.QA = TVC_Q.QA[o.typ][S0.key];
      o.qOK = o.QA != null && o.Q1 <= o.QA + 1e-9;
      o.qt = o.typ === 'hop' ? o.Q1 / S.b : o.Q1;
      o.hv = tvcHV(o.typ, S0.key, o.qt);
    }

    if (o.hv && !o.hv.out && o.hv.H != null && o.hv.V != null) {
      o.Hd = o.hv.H;
      o.V = o.hv.V;
      o.Hmin = o.Hd / 1.2;
      if (Number.isFinite(S.h)) {
        o.reg =
          o.Hd <= 1.2 * S.h + 1e-9
            ? 'Chảy không áp'
            : o.Hd > 1.4 * S.h
              ? 'Chảy có áp'
              : 'Chảy bán áp';
        o.regOK = o.reg === 'Chảy không áp';
      } else {
        o.reg = 'Chảy không áp khi H ≥ ' + fx(o.Hmin, 2) + ' m';
        o.regOK = true;
        o.hFree = 1;
      }
      if (Number.isFinite(o.zd)) {
        o.MN = o.zd! + o.Hd;
        if (Number.isFinite(o.zr)) {
          o.dz = o.zr! - o.MN;
          o.zOK = o.dz >= 0.5 - 1e-9;
        }
      }
      o.lgc = C.kgc * S.b;
      o.B = o.n * S.b;
      o.hx = 2 * o.Hd * Math.sqrt(o.B / (o.B + 2.5 * o.lgc));
      o.ht = o.hx + C.hd;
    }
    o.ok = Boolean(o.qOK && o.hv && !o.hv.out && o.regOK && o.zOK !== false);
    return o;
  });

  return { C, out };
}

export let TVCR: TvcCalcResult | null = null;

export function getLatestTvcResult(): TvcCalcResult | null {
  return TVCR;
}

export function setLatestTvcResult(result: TvcCalcResult | null): void {
  TVCR = result;
}

export function tvcStep(): TvcCalcResult | undefined {
  const hasTab70 = Boolean($('tab70'));
  const hasHeadlessTvc = typeof document === 'undefined' && Boolean($('tvc_rows') || $('tvc_P'));
  if (!hasTab70 && !hasHeadlessTvc) return undefined;

  tvcStFill();
  {
    const s = v('tvc_hps', 'tram');
    const rStn = $('tvc_rStn');
    if (rStn?.style) rStn.style.display = s === 'tram' ? '' : 'none';
    const rHp = $('tvc_rHp');
    if (rHp?.style) rHp.style.display = s === 'tay' ? '' : 'none';
    if (typeof document !== 'undefined') {
      document.querySelectorAll('.tvcSer').forEach((e) => {
        (e as HTMLElement).style.display = s === 'ser' ? '' : 'none';
      });
    }
    if (s === 'ser') {
      const n = $('tvc_stn');
      const row = n?.closest?.('.row');
      if (row?.style) row.style.display = v('tvc_st2') === 'khac' ? '' : 'none';
    }
  }
  if (!$('tvc_tbIn')) tvcEditor();
  tvcStLoad(false);

  const R = tvcCalc();
  const C = R.C;
  const O = R.out;
  const F = (val: number | null | undefined, d = 2) => cf(val, d);
  const ok = (val: boolean) => `<span class="${val ? 'ok' : 'bad'}">${val ? 'Đạt' : 'Không đạt'}</span>`;
  const pP = (P: number) => P + '%';
  TVCR = R;

  // 2. Thông số chung
  set(
    'o_tvc_gen',
    hvStepT([
      { grp: 'CƠ SỞ TÍNH TOÁN' },
      [
        'Tần suất lũ thiết kế cống (TCVN 4054:2005, Bảng 30, theo cấp đường)',
        '',
        'P',
        pP(C.P),
        '',
        '',
      ],
      ['Vùng mưa', '', '', C.reg, '', 'TCVN 9845:2013, Bảng 3'],
      ...(C.ser
        ? ([
            [
              'Trạm đo mưa ; số năm quan trắc: ' +
                C.ser.nm +
                ' ; ' +
                C.ser.n +
                ' năm (' +
                C.ser.y0 +
                ' - ' +
                C.ser.y1 +
                ')',
              '',
              '',
              '',
              '',
              '',
            ],
            [
              'Trị số trung bình chuỗi lượng mưa ngày lớn nhất năm',
              '',
              'X̄',
              F(C.ser.Xm, 1),
              'mm',
              'Sổ tay PT 2-2',
            ],
            [
              'Hệ số biến đổi ; hệ số thiên lệch (' +
                (C.ser.pm === 'fit' ? 'phương pháp thích hợp' : 'phương pháp mô men') +
                ')',
              '',
              'Cv ; Cs',
              F(C.ser.Cv, 3) + ' ; ' + F(C.ser.Cs, 3),
              '',
              C.ser.pm === 'fit' ? 'Sổ tay mục 2.2.2' : 'Sổ tay PT 2-3, 2-4',
            ],
            [
              'Hệ số mô đun ứng với tần suất P (' +
                (C.ser.dist === 'km' ? 'Kritski - Menkel' : 'Pearson III') +
                ')',
              '',
              'KP',
              F(C.ser.KP, 3),
              '',
              C.ser.dist === 'km' ? 'Sổ tay Phụ lục 2-2' : 'Sổ tay PT 2-5, Phụ lục 2-1',
            ],
            [
              'Lượng mưa ngày lớn nhất ứng với tần suất thiết kế',
              'H_P=\\bar X\\,K_P',
              'HP',
              F(C.Hp, 1),
              'mm',
              '',
            ],
          ] as HvStepRow[])
        : ([
            [
              'Lượng mưa ngày lớn nhất ứng với tần suất thiết kế: ' + (C.how || ''),
              '',
              'HP',
              F(C.Hp, 1),
              'mm',
              '',
            ],
          ] as HvStepRow[])),
      ['Cấp đất của lưu vực', '', '', C.cls, '', 'TCVN 9845:2013, Bảng 1, 2'],
      [
        'Thông số tập trung nước trên sườn dốc',
        '',
        'msd',
        F(C.msd, 2),
        '',
        'TCVN 9845:2013, Bảng 4',
      ],
      [
        'Thông số tập trung nước trong lòng sông',
        '',
        'mls',
        F(C.mls, 0),
        '',
        'TCVN 9845:2013, Bảng 5',
      ],
      [
        'Tỉ lệ diện tích ao hồ, đầm lầy ; vị trí: ' + (C.aoPos === 'h' ? 'ở hạ lưu' : 'ở thượng lưu'),
        '',
        'fao',
        F(C.fao, 1),
        '%',
        '',
      ],
      [
        'Hệ số chiết giảm dòng chảy do ao hồ, đầm lầy',
        '',
        'δ',
        F(HV.delta6(C.fao, C.aoPos), 3),
        '',
        'TCVN 9845:2013, Bảng 6',
      ],
    ]) + (C.hwarn ? `<p class="small bad noprint">${C.hwarn}</p>` : ''),
  );

  // 3. Số liệu lưu vực các cống
  set(
    'o_tvc_in',
    hvTab(
      [
        'TT',
        'Lý trình',
        'Tên cống',
        'F (km²)',
        'L (km)',
        'Σl (km)',
        'Jls (‰)',
        'Jsd (‰)',
        'Lưu vực',
      ],
      O.map((o, i) => [
        String(i + 1),
        o.km,
        o.name,
        F(o.F, 3),
        F(o.L, 3),
        F(o.sl, 3),
        F(o.Jls, 1),
        F(o.Jsd, 1),
        o.two ? 'Hai sườn' : 'Một sườn',
      ]),
    ),
  );

  // 4. Lưu lượng
  set(
    'o_tvc_Q',
    hvTab(
      [
        'TT',
        'Tên cống',
        'φ',
        'Lsd (m)',
        'φsd',
        'τsd (phút)',
        'φls',
        'Ap',
        'Q' + pP(C.P) + ' (m³/s)',
      ],
      O.map((o, i) =>
        o.q
          ? [
              String(i + 1),
              o.name,
              F(o.q.phi, 3),
              F(o.q.Lsd, 1),
              F(o.q.phisd, 3),
              F(o.q.tau, 2),
              F(o.q.phils, 3),
              F(o.q.Ap, 5),
              `<b>${F(o.Q, 3)}</b>`,
            ]
          : [
              String(i + 1),
              o.name,
              `<span class="bad">${o.err.join('; ')}</span>`,
              '',
              '',
              '',
              '',
              '',
              '',
            ],
      ),
    ) +
      (() => {
        const w = [
          ...new Set(O.flatMap((o) => (o.q ? o.q.warn.map((t) => o.name + ': ' + t) : []))),
        ];
        return w.length ? `<p class="small bad noprint">${w.join('<br>')}</p>` : '';
      })(),
  );

  // 5. Khẩu độ, chế độ chảy
  const tn = (o: TvcCulvertOutcome) =>
    o.typ === 'hop' ? 'Cống hộp' : o.typ === 'ban' ? 'Cống bản' : 'Cống tròn';
  const kd = (o: TvcCulvertOutcome) =>
    o.typ === 'ban'
      ? fx(parseFloat(String(o.d)) / 100, 2) + ' m'
      : o.typ === 'hop'
        ? o.d + ' cm'
        : 'Φ' + o.d + ' cm';

  set(
    'o_tvc_K',
    hvTab(
      [
        'TT',
        'Tên cống',
        'Loại cống',
        'Khẩu độ',
        'Số cửa n',
        'H (m)',
        'Q1 = Q/n (m³/s)',
        '[Q] (m³/s)',
        'Hd (m)',
        'V (m/s)',
        'Chế độ chảy',
      ],
      O.map((o, i) =>
        o.q
          ? [
              String(i + 1),
              o.name,
              tn(o),
              kd(o),
              String(o.n),
              o.hFree ? '≥ ' + F(o.Hmin, 2) : F(o.S?.h, 2),
              F(o.Q1, 3),
              o.typ === 'ban'
                ? '-'
                : `${F(o.QA, 2)} ${o.qOK ? '' : '<span class="bad">(nhỏ hơn Q1)</span>'}`,
              o.hv && !o.hv.out ? F(o.Hd, 3) : `<span class="bad">vượt bảng</span>`,
              o.hv && !o.hv.out ? F(o.V, 3) : '-',
              o.reg ? `<span class="${o.regOK ? 'ok' : 'bad'}">${o.reg}</span>` : '-',
            ]
          : [String(i + 1), o.name, '', '', '', '', '', '', '', '', ''],
      ),
    ) +
      `<p class="small">Cống hộp: Hd, V tra theo lưu lượng đơn vị q = Q1/b (b - bề rộng một cửa); cống tròn: tra theo lưu lượng một cửa Q1. Giá trị nằm giữa hai dòng của bảng tra lấy nội suy tuyến tính. H - chiều cao tịnh cửa cống (cống tròn H = D). Cống bản chưa chọn chiều cao: chảy không áp khi H0 ≤ 1,2H, nên chiều cao tịnh tối thiểu Hmin = H0/1,2; chiều cao chọn khi thiết kế cống theo địa hình và cao độ đường đỏ, không nhỏ hơn Hmin.</p>` +
      (O.some((o) => o.rc)
        ? `<p class="small">Cống bản chảy không áp (Thiết kế đường ô tô - Tập 3, Mục 10.1): lưu lượng đơn vị q = Q1/B ; chiều sâu phân giới hk = ∛(q²/g) ; chiều sâu tại mặt cắt co hẹp hc = 0,9hk ; diện tích ω = B.hc ; chiều sâu nước dâng trước cống H0 = hc + Vc²/(2gφ²), Vc = Q1/ω, φ = ${F(C.phi, 2)} ; chiều sâu dòng chảy ở cửa ra lấy bằng chiều sâu dòng đều (Manning, n = ${F(C.nc, 3)}, độ dốc cống i) nhưng không lớn hơn hk ; lưu tốc cửa ra Vra = Q1/(B.h).</p>`
        : '') +
      `<p class="small">Cao độ mép nền đường cao hơn mực nước dâng trước cống ít nhất 0,5 m (TCVN 4054:2005).</p>`,
  );

  // Bảng tổng hợp thủy lực từng cống (gom 4 cống/bảng)
  {
    const L = O.filter((o) => o.q && o.hv && !o.hv.out);
    const rowsDef: Array<[string, string, string, (o: TvcCulvertOutcome) => string]> = [
      ['Lưu lượng thiết kế', 'Q', 'm³/s', (o) => F(o.Q, 2)],
      ['Lưu lượng đơn vị', 'q', 'm³/s.m', (o) => (o.rc ? F(o.rc.qd, 2) : '-')],
      ['Loại cống', '', '', (o) => tn(o).replace('Cống ', '')],
      ['Khẩu độ cống', 'B', 'm', (o) => F(o.S?.b, 2)],
      ['Chiều cao cống', 'H', 'm', (o) => (o.hFree ? '≥ ' + F(o.Hmin, 2) : F(o.S?.h, 2))],
      ['Số cửa cống', 'N', '', (o) => String(o.n)],
      ['Chiều sâu phân giới', 'hk', 'm', (o) => (o.rc ? F(o.rc.hk, 2) : '-')],
      [
        'Chế độ chảy trong cống',
        '',
        '',
        (o) =>
          o.hFree
            ? 'Không áp'
            : (o.reg || '-').replace('Chảy ', '').replace(/^./, (c) => c.toUpperCase()),
      ],
      ['Hệ số lưu tốc', 'φ', '', (o) => (o.rc ? F(C.phi, 2) : '-')],
      ['Chiều sâu tại mặt cắt co hẹp', 'hc', 'm', (o) => (o.rc ? F(o.rc.hc, 2) : '-')],
      ['Diện tích tại mặt cắt co hẹp', 'ω', 'm²', (o) => (o.rc ? F(o.rc.w, 2) : '-')],
      ['Chiều sâu nước dâng trước cống', 'H0', 'm', (o) => F(o.Hd, 2)],
      ['Tỷ số H0/H', 'H0/H', '', (o) => (o.hFree || !o.S || o.Hd == null ? '-' : F(o.Hd / o.S.h, 2))],
      ['Lưu tốc cửa ra', 'Vra', 'm/s', (o) => F(o.V, 2)],
      ['Cao độ đáy cống', 'Hđáy', 'm', (o) => F(o.zd, 2)],
      ['Mực nước dâng trước cống (không xét biến đổi khí hậu)', 'Hdâng', 'm', (o) => F(o.MN, 2)],
      ['Chiều sâu dòng chảy ở cửa ra', 'h', 'm', (o) => (o.rc ? F(o.rc.ho, 2) : '-')],
      [
        'Độ đầy của cống',
        'h/H',
        '',
        (o) => (o.rc && !o.hFree && o.S ? F(o.rc.ho / o.S.h, 2) : '-'),
      ],
      ['Độ dốc cống', 'i', '', (o) => (o.iSlope != null && Number.isFinite(o.iSlope) ? String(o.iSlope) : '-')],
      ['Cao độ mép nền đường', 'Hnền', 'm', (o) => F(o.zr, 2)],
      [
        'Hnền - Hdâng ≥ 0,5 m',
        '',
        'm',
        (o) =>
          o.dz != null ? `<span class="${o.zOK ? 'ok' : 'bad'}">${F(o.dz, 2)}</span>` : '-',
      ],
    ];
    const RD = rowsDef.filter(([, , , f]) =>
      L.some((o) => {
        const val = String(f(o))
          .replace(/<[^>]*>/g, '')
          .trim();
        return val !== '' && val !== '-';
      }),
    );
    let h = '';
    for (let k = 0; k < L.length; k += 4) {
      const G = L.slice(k, k + 4);
      const tot = 52 + 11 * G.length;
      const pc = (val: number) => ((100 * val) / tot).toFixed(2) + '%';
      h +=
        `<table class="t dt" style="table-layout:fixed;width:${tot}%"><colgroup><col style="width:${pc(36)}"><col style="width:${pc(8)}">${G.map(() => `<col style="width:${pc(11)}">`).join('')}<col style="width:${pc(8)}"></colgroup><tr><th>Thông số</th><th>Ký hiệu</th>${G.map((o) => `<th>${o.name}<br>${o.km}</th>`).join('')}<th>Đơn vị</th></tr>` +
        RD.map(
          ([a, sy, u, f]) =>
            `<tr><td class="l">${a}</td><td class="c">${sy}</td>${G.map((o) => `<td>${f(o)}</td>`).join('')}<td class="c">${u}</td></tr>`,
        ).join('') +
        '</table>';
    }
    set(
      'o_tvc_T',
      L.length
        ? `<p class="cap">Bảng tổng hợp khẩu độ, mực nước dâng trước cống (tần suất ${pP(C.P)})</p>` + h
        : '',
    );
  }

  // 6. Xói, gia cố
  {
    const w = $('tvc_secX');
    if (w?.style) w.style.display = C.xoi ? '' : 'none';
    const h7 = $('tvc_h7');
    if (h7) h7.innerHTML = (C.xoi ? '7' : '6') + '.&nbsp;&nbsp;KẾT LUẬN';
  }
  set(
    'o_tvc_X',
    hvTab(
      [
        'TT',
        'Tên cống',
        'b = n.D (m)',
        'lgc = ' + F(C.kgc, 0) + 'D (m)',
        'hx (m)',
        'ht = hx + ' + F(C.hd, 1) + ' (m)',
        'V ra (m/s)',
      ],
      O.map((o, i) =>
        o.hx != null
          ? [
              String(i + 1),
              o.name,
              F(o.B, 2),
              F(o.lgc, 2),
              F(o.hx, 3),
              `<b>${F(o.ht, 2)}</b>`,
              F(o.V, 2),
            ]
          : [String(i + 1), o.name, '-', '-', '-', '-', '-'],
      ),
    ),
  );

  // 7. Kết luận
  const all = O.length > 0 && O.every((o) => o.ok);
  const why = (o: TvcCulvertOutcome) =>
    !o.qOK
      ? 'Q1 &gt; [Q]: tăng khẩu độ hoặc số cửa'
      : o.hv && o.hv.out
        ? 'vượt bảng tra'
        : !o.regOK
          ? 'Hd &gt; 1,2H'
          : 'mép nền thấp hơn Hdâng + 0,5 m';
  const hasZ = O.some((o) => o.MN != null);
  set(
    'o_tvc_KL',
    hvTab(
      [
        'TT',
        'Lý trình',
        'Tên cống',
        'Q' + pP(C.P) + ' (m³/s)',
        'Cống chọn',
        'Chiều sâu nước dâng H0 (m)',
        'V (m/s)',
        ...(hasZ ? ['Cao độ mực nước dâng (m)'] : []),
        ...(C.xoi ? ['lgc (m)', 'ht (m)'] : []),
        'Kết luận',
      ],
      O.map((o, i) => [
        String(i + 1),
        o.km,
        o.name,
        F(o.Q, 3),
        o.q && o.S
          ? o.typ === 'ban'
            ? `${o.n} × bản ${fx(o.S.b, 2)} m, H ${o.hFree ? '≥ ' + F(o.Hmin, 2) : '= ' + F(o.S.h, 2)} m`
            : `${o.n} × ${o.typ === 'hop' ? 'hộp ' + o.d : 'Φ' + o.d} cm`
          : '-',
        F(o.Hd, 2),
        F(o.V, 2),
        ...(hasZ ? [F(o.MN, 2)] : []),
        ...(C.xoi ? [F(o.lgc, 2), F(o.ht, 2)] : []),
        o.q
          ? o.ok
            ? ok(true)
            : `<span class="bad">${why(o)}</span>`
          : `<span class="bad">${o.err.join('; ')}</span>`,
      ]),
    ) +
      `<p class="small"><b>${O.length ? (all ? '<span class="ok">CÁC CỐNG ĐỦ KHẢ NĂNG THOÁT NƯỚC Ở CHẾ ĐỘ CHẢY KHÔNG ÁP</span>' : '<span class="bad">CÓ CỐNG CHƯA ĐẠT YÊU CẦU</span>') : ''}</b></p>`,
  );

  // Delegate SVG/map & KaTeX rendering via VisualReportHooks
  const hooks = getVisualHooks();
  try {
    hooks.renderHydrology?.({ mode: 'culvert', result: R });
  } catch (e) {
    console.error(e);
  }
  try {
    hooks.renderMath?.();
  } catch (e) {
    console.error(e);
  }
  return R;
}

export function toCulvertHydrologyResult(result?: TvcCalcResult | null): HydrologyResult {
  const r = result ?? TVCR;
  if (!r) {
    return {
      mode: 'culvert',
      station: '',
      P: 1,
      Q: {},
      H: {},
      culvertSizing: [],
    };
  }
  const { C, out } = r;
  const rep = out.find((o) => o.q && Number.isFinite(o.Q)) ?? out[0];
  const station =
    C.ser?.nm ||
    (C.how ? C.how.replace(/^Trạm\s+/i, '').split(',')[0].trim() : '') ||
    '';

  const Q: HydrologyResult['Q'] = {
    [C.P]: {
      Q: rep?.Q != null && Number.isFinite(rep.Q) ? rep.Q : 0,
      Hp: Number.isFinite(C.Hp) ? C.Hp : undefined,
      phi: rep?.q?.phi,
      Ap: rep?.q?.Ap,
    },
  };

  const H: HydrologyResult['H'] = {};
  if (rep && (rep.MN != null || rep.Hd != null)) {
    const wl = rep.MN != null && Number.isFinite(rep.MN) ? rep.MN : rep.Hd;
    if (wl != null && Number.isFinite(wl)) H[C.P] = wl;
  }

  return {
    mode: 'culvert',
    station,
    P: C.P,
    stats: C.ser
      ? {
          n: C.ser.n,
          mean: C.ser.Xm,
          Cv: C.ser.Cv,
          Cs: C.ser.Cs,
          csOK: C.ser.csOK !== false,
        }
      : undefined,
    Q,
    H,
    culvertSizing: out.map((o) => ({
      name: o.name,
      km: o.km,
      Fkm: Number.isFinite(o.F) ? o.F : 0,
      Q: o.Q != null && Number.isFinite(o.Q) ? o.Q : 0,
      kind: o.typ,
      nBarrels: o.n,
      size: String(o.d ?? ''),
      Hd: o.Hd != null && Number.isFinite(o.Hd) ? o.Hd : 0,
      Vra: o.V != null && Number.isFinite(o.V) ? o.V : 0,
      hx: o.hx != null && Number.isFinite(o.hx) ? o.hx : 0,
      okClearance: o.zOK !== false,
    })),
  };
}

// ============================================================================
// 6. DXF + DEM Batch Catchment Processor & Marching-Squares Contours (`TVX`)
// ============================================================================

export const TVX: TvxState = {
  T: null,
  polys: [],
  bas: [],
  kms: [],
  FL: [],
  dots: [],
  opens: [],
  routes: [],
  tim: null,
  E0: undefined,
  E1: undefined,
  route: null,
};

export function tvxMsg(t: string, bad?: boolean | number): void {
  const e = $('tvc_dxmsg');
  if (e) {
    e.innerHTML = t;
    e.className = 'small' + (bad ? ' bad' : '');
  }
}

export function tvmMsg(t: string, bad?: boolean | number): void {
  const e = $('tvc_xymsg');
  if (e) {
    e.innerHTML = t;
    e.className = 'small' + (bad ? ' bad' : '');
  }
}

export function tvmGeo(): TvxSavedGeo | null {
  try {
    return JSON.parse(v('tvc_geo', 'null') || 'null') as TvxSavedGeo | null;
  } catch {
    return null;
  }
}

export function tvmKm(t: string): { v: number; t: string } | null {
  const s = String(t || '');
  return tvxKm(/^K/i.test(s) ? s : 'KM' + s);
}

export function tvmSort<T extends { km?: string }>(R: T[]): T[] {
  return R.sort((a, b) => {
    const ka = tvmKm(a.km || '');
    const kb = tvmKm(b.km || '');
    return (ka ? ka.v : 1e12) - (kb ? kb.v : 1e12);
  });
}

export async function tvxDemBg(
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  lon0: number,
  src: DemSourceKind,
): Promise<TvxDemGrid> {
  const w = x1 - x0;
  const h = y1 - y0;
  const m = Math.max(w, h) * 0.45 + 400;
  x0 -= m;
  x1 += m;
  y0 -= m;
  y1 += m;
  const d = Math.max(10, Math.max(x1 - x0, y1 - y0) / 260);
  const nx = Math.ceil((x1 - x0) / d) + 1;
  const ny = Math.ceil((y1 - y0) / d) + 1;
  const [lc, ac] = HVD.fromVN(lon0, (x0 + x1) / 2, (y0 + y1) / 2);
  const R = Math.hypot(x1 - x0, y1 - y0) / 2000 + 0.2;
  const G = await HVD.grid(lc, ac, R, src);
  const zz: Array<number | null> = new Array(nx * ny);
  const Z = (r: number, c: number) => G.z[r * G.nx + c];

  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const [lo, la] = HVD.fromVN(lon0, x0 + i * d, y1 - j * d);
      const fc = (lo - G.w) / G.rx - 0.5;
      const fr = (G.n - la) / G.ry - 0.5;
      const c0 = Math.floor(fc);
      const r0 = Math.floor(fr);
      if (c0 < 0 || r0 < 0 || c0 >= G.nx - 1 || r0 >= G.ny - 1) {
        zz[j * nx + i] = null;
        continue;
      }
      const tx = fc - c0;
      const ty = fr - r0;
      const val =
        (Z(r0, c0) * (1 - tx) + Z(r0, c0 + 1) * tx) * (1 - ty) +
        (Z(r0 + 1, c0) * (1 - tx) + Z(r0 + 1, c0 + 1) * tx) * ty;
      zz[j * nx + i] = Number.isNaN(val) ? null : Math.round(val * 10) / 10;
    }
  }
  return { x0, y1, d, nx, ny, z: zz };
}

/**
 * Pure marching-squares contour generator over a VN-2000 DEM grid (`tvxDemBg` / `G.dem`).
 * Defaults to the exact adaptive interval from `17_culvert_hydrology_and_dxftools.js`
 * (`rel > 800 ? 50 : rel > 400 ? 20 : rel > 150 ? 10 : 5`), or accepts an explicit interval
 * (e.g. `10` for 10 m contours).
 */
export function tvxContours(
  dem: TvxDemGrid,
  options?: number | TvxContoursOptions,
): TvxContoursResult {
  const opts: TvxContoursOptions = typeof options === 'number' ? { interval: options } : options || {};
  const { nx, ny, d, x0, y1, z } = dem;
  const majorMult = opts.majorMult ?? 5;
  const Zf = (i: number, j: number): number => {
    const r = Math.max(0, Math.min(ny - 1, j));
    const c = Math.max(0, Math.min(nx - 1, i));
    const val = z[r * nx + c];
    return val == null || !Number.isFinite(val) ? NaN : val;
  };

  let zmin = Infinity;
  let zmax = -Infinity;
  const len = nx * ny;
  for (let idx = 0; idx < len; idx++) {
    const val = z[idx];
    if (val != null && Number.isFinite(val)) {
      if (val < zmin) zmin = val;
      if (val > zmax) zmax = val;
    }
  }
  if (!Number.isFinite(zmin) || !Number.isFinite(zmax)) {
    return {
      interval: opts.interval ?? 10,
      zmin: NaN,
      zmax: NaN,
      m: [],
      n: [],
      gridSegments: { m: [], n: [] },
      segments: [],
    };
  }

  const rel = zmax - zmin;
  const ci = opts.interval ?? (rel > 800 ? 50 : rel > 400 ? 20 : rel > 150 ? 10 : 5);
  const gridM: Point2D[] = [];
  const gridN: Point2D[] = [];
  const worldM: Point2D[] = [];
  const worldN: Point2D[] = [];
  const segments: TvxContourSegment[] = [];
  const toWorld = (p: Point2D): Point2D => [x0 + p[0] * d, y1 - p[1] * d];

  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = Zf(i, j);
      const b = Zf(i + 1, j);
      const c = Zf(i + 1, j + 1);
      const e = Zf(i, j + 1);
      if (Number.isNaN(a) || Number.isNaN(b) || Number.isNaN(c) || Number.isNaN(e)) continue;
      const lo = Math.min(a, b, c, e);
      const hi = Math.max(a, b, c, e);
      for (let lv = Math.ceil(lo / ci) * ci; lv <= hi; lv += ci) {
        const P: Point2D[] = [];
        const ed = (z1: number, z2: number, x1: number, y1c: number, x2: number, y2c: number) => {
          if (z1 < lv !== z2 < lv) {
            const t = (lv - z1) / (z2 - z1);
            P.push([x1 + (x2 - x1) * t, y1c + (y2c - y1c) * t]);
          }
        };
        ed(a, b, i, j, i + 1, j);
        ed(b, c, i + 1, j, i + 1, j + 1);
        ed(c, e, i + 1, j + 1, i, j + 1);
        ed(e, a, i, j + 1, i, j);
        if (P.length >= 2) {
          const major = Math.abs(lv % (ci * majorMult)) < 1e-9;
          const pushPair = (ga: Point2D, gb: Point2D) => {
            const wa = toWorld(ga);
            const wb = toWorld(gb);
            if (major) {
              gridM.push(ga, gb);
              worldM.push(wa, wb);
            } else {
              gridN.push(ga, gb);
              worldN.push(wa, wb);
            }
            segments.push({ level: lv, major, a: wa, b: wb, gridA: ga, gridB: gb });
          };
          pushPair(P[0], P[1]);
          if (P.length === 4) pushPair(P[2], P[3]);
        }
      }
    }
  }

  return {
    interval: ci,
    zmin,
    zmax,
    m: worldM,
    n: worldN,
    gridSegments: { m: gridM, n: gridN },
    segments,
  };
}

export async function tvmSaveGeo(geo: TvxSavedGeo, lon0: number, src: DemSourceKind): Promise<void> {
  const ex = [
    ...geo.bas.flatMap((b) => b.bnd),
    ...(geo.route || []),
    ...(geo.ends || []).map((e) => e.p),
  ];
  delete geo.dem;
  if (ex.length) {
    const x0 = Math.min(...ex.map((p) => p[0]));
    const x1 = Math.max(...ex.map((p) => p[0]));
    const y0 = Math.min(...ex.map((p) => p[1]));
    const y1 = Math.max(...ex.map((p) => p[1]));
    try {
      geo.dem = await tvxDemBg(x0, x1, y0, y1, lon0, src);
    } catch (e) {
      console.error(e);
    }
  }
  geo.src = src;
  geo.lon0 = lon0;
  const g = $('tvc_geo');
  if (g) {
    g.value = JSON.stringify(geo);
    if (typeof Event !== 'undefined' && typeof (g as unknown as EventTarget).dispatchEvent === 'function') {
      (g as unknown as EventTarget).dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
}

export async function tvxOne(
  P: ReadonlyArray<Point2D>,
  lon0: number,
  src: DemSourceKind,
  out: Point2D | null,
  st: ReadonlyArray<{ q: DxfPolyline; L: number }>,
): Promise<TvxCatchmentMeasurement> {
  const LL = P.map((p) => HVD.fromVN(lon0, p[0], p[1]));
  const cx = LL.reduce((a, p) => a + p[0], 0) / LL.length;
  const cy = LL.reduce((a, p) => a + p[1], 0) / LL.length;
  const Rkm =
    Math.max(
      ...LL.map((p) =>
        Math.hypot((p[0] - cx) * 111.32 * Math.cos((cy * Math.PI) / 180), (p[1] - cy) * 111.32),
      ),
    ) + 0.4;
  const G = await HVD.grid(cx, cy, Rkm, src);
  const { nx, ny, z } = G;
  const N = nx * ny;
  const M = new Uint8Array(N);

  for (let r = 0; r < ny; r++) {
    for (let c = 0; c < nx; c++) {
      const i = r * nx + c;
      if (Number.isNaN(z[i])) continue;
      if (tvxIn(LL, G.w + (c + 0.5) * G.rx, G.n - (r + 0.5) * G.ry)) {
        M[i] = 1;
      }
    }
  }

  const zAt = (E: number, Nn: number): number => {
    const [lo, la] = HVD.fromVN(lon0, E, Nn);
    const fc = (lo - G.w) / G.rx - 0.5;
    const fr = (G.n - la) / G.ry - 0.5;
    const c0 = Math.max(0, Math.min(nx - 2, Math.floor(fc)));
    const r0 = Math.max(0, Math.min(ny - 2, Math.floor(fr)));
    const tx = Math.max(0, Math.min(1, fc - c0));
    const ty = Math.max(0, Math.min(1, fr - r0));
    const Z = (r: number, c: number) => z[r * nx + c];
    return (
      (Z(r0, c0) * (1 - tx) + Z(r0, c0 + 1) * tx) * (1 - ty) +
      (Z(r0 + 1, c0) * (1 - tx) + Z(r0 + 1, c0 + 1) * tx) * ty
    );
  };

  // Độ dốc sườn dốc: trung bình độ dốc ô (Horn) trong đường bao
  let sj = 0;
  let nj = 0;
  for (let i = 0; i < N; i++) {
    if (!M[i]) continue;
    const r = (i / nx) | 0;
    const c = i - r * nx;
    if (r < 1 || c < 1 || r >= ny - 1 || c >= nx - 1) continue;
    const Z = (a: number, b: number) => {
      const val = z[(r + a) * nx + c + b];
      return Number.isNaN(val) ? z[i] : val;
    };
    const gx =
      (Z(-1, 1) + 2 * Z(0, 1) + Z(1, 1) - (Z(-1, -1) + 2 * Z(0, -1) + Z(1, -1))) / (8 * G.dx);
    const gy =
      (Z(1, -1) + 2 * Z(1, 0) + Z(1, 1) - (Z(-1, -1) + 2 * Z(-1, 0) + Z(-1, 1))) / (8 * G.dy);
    sj += Math.hypot(gx, gy);
    nj++;
  }
  const Jsd = nj ? (sj / nj) * 1000 : NaN;

  // Cửa ra: chấm cống; không có thì điểm thấp nhất trên đường bao
  let o: Point2D | null = out ? [out[0], out[1]] : null;
  const hasDot = Boolean(out);
  if (!o) {
    let zb = Infinity;
    P.forEach((p) => {
      const val = zAt(p[0], p[1]);
      if (val < zb) {
        zb = val;
        o = [p[0], p[1]];
      }
    });
    if (!o) o = P[0];
  }

  let main: Point2D[];
  let brs: Point2D[][] = [];
  let L: number;
  let sl = 0;
  const hasSt = st.length > 0;
  let demL = false;

  if (hasSt) {
    main = st[0].q.slice();
    const d0 = Math.hypot(main[0][0] - o[0], main[0][1] - o[1]);
    const d1 = Math.hypot(main[main.length - 1][0] - o[0], main[main.length - 1][1] - o[1]);
    if (d1 < d0) main.reverse();
    L = st[0].L / 1000;
    brs = st.slice(1).map((s) => s.q);
    sl = st.slice(1).reduce((a, s) => a + s.L, 0) / 1000;
  } else {
    demL = true;
    const f = HVD.fill(G);
    const F = HVD.flow(G, f);
    const acc = new Float64Array(N);
    for (let i = 0; i < N; i++) if (M[i]) acc[i] = 1;
    for (let k = 0; k < F.ord.length; k++) {
      const i = F.ord[k];
      if (!M[i]) continue;
      const j = F.dir[i];
      if (j >= 0 && M[j]) acc[j] += acc[i];
    }
    const [lo, la] = HVD.fromVN(lon0, o[0], o[1]);
    let oi = -1;
    let bd = Infinity;
    for (let i = 0; i < N; i++) {
      if (!M[i]) continue;
      const r = (i / nx) | 0;
      const c = i - r * nx;
      const d =
        Math.hypot((G.w + (c + 0.5) * G.rx - lo) / G.rx, (G.n - (r + 0.5) * G.ry - la) / G.ry) -
        acc[i] * 1e-6;
      if (d < bd) {
        bd = d;
        oi = i;
      }
    }
    const up = new Float64Array(N);
    const upn = new Int32Array(N).fill(-1);
    for (let k = 0; k < F.ord.length; k++) {
      const i = F.ord[k];
      if (!M[i]) continue;
      const j = F.dir[i];
      if (j >= 0 && M[j]) {
        const l = up[i] + HVD.stepLen(G, i, j);
        if (l > up[j]) {
          up[j] = l;
          upn[j] = i;
        }
      }
    }
    const ix = oi >= 0 ? [oi] : [];
    if (oi >= 0) {
      let i = oi;
      while (upn[i] >= 0) {
        i = upn[i];
        ix.push(i);
      }
    }
    main = [
      o,
      ...ix.slice(1).map((i) => {
        const r = (i / nx) | 0;
        const c = i - r * nx;
        return HVD.toVN(lon0, G.w + (c + 0.5) * G.rx, G.n - (r + 0.5) * G.ry);
      }),
    ];
    L = oi >= 0 ? up[oi] / 1000 : 0;
  }

  // Trắc dọc lòng chính theo DEM, điểm cách đều <= 15 m, từ cửa ra lên nguồn
  const prof: Point2D[] = [];
  let s0 = 0;
  for (let k = 0; k < main.length; k++) {
    if (k) {
      const a = main[k - 1];
      const b = main[k];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const n = Math.max(1, Math.ceil(l / 15));
      for (let j = 1; j <= n; j++) {
        const p: Point2D = [a[0] + ((b[0] - a[0]) * j) / n, a[1] + ((b[1] - a[1]) * j) / n];
        prof.push([(s0 + (l * j) / n) / 1000, zAt(p[0], p[1])]);
      }
      s0 += l;
    } else {
      prof.push([0, zAt(main[0][0], main[0][1])]);
    }
  }
  const Lp = s0 / 1000;
  const zo = prof[0][1];
  let Js = 0;
  for (let k = 1; k < prof.length; k++) {
    Js += (prof[k - 1][1] - zo + (prof[k][1] - zo)) * (prof[k][0] - prof[k - 1][0]);
  }
  const Jls = Lp > 0 ? Math.max(0, Js / (Lp * Lp)) : NaN;

  return {
    F: tvxArea(P) / 1e6,
    L,
    sl,
    Jls,
    Jsd,
    bnd: P.slice(),
    main,
    brs,
    out: o,
    z0: zo,
    z1: prof[prof.length - 1][1],
    hasDot,
    hasSt,
    demL,
    st: st.map((s) => s.q),
  };
}

function applyParsedDxfToState(parsed: CulvertDxfParsedState): void {
  Object.assign(TVX, {
    T: parsed.T,
    polys: parsed.bas,
    bas: parsed.bas,
    kms: parsed.kms,
    FL: parsed.FL,
    dots: parsed.dots,
    opens: parsed.opens,
    routes: parsed.routes,
    tim: parsed.tim,
    E0: parsed.E0,
    E1: parsed.E1,
    route: parsed.tim,
  });
}

export async function tvxFile(
  input: File | ArrayBuffer | ArrayBufferView | string | null | undefined,
): Promise<CulvertDxfParsedState | null> {
  if (!input) return null;
  if (typeof input !== 'string' && 'name' in input && /\.dwg$/i.test(input.name)) {
    tvxMsg(
      'Tệp DWG không đọc trực tiếp được: trong CAD dùng lệnh SAVEAS chọn kiểu DXF rồi chọn lại tệp.',
      1,
    );
    return null;
  }
  try {
    let txt: string;
    if (typeof input === 'string') {
      if (/^AutoCAD Binary DXF/.test(input)) {
        tvxMsg('DXF dạng nhị phân: lưu lại DXF dạng chữ (ASCII).', 1);
        return null;
      }
      txt = input;
    } else {
      const buf =
        input instanceof ArrayBuffer || ArrayBuffer.isView(input)
          ? input
          : await (input as File).arrayBuffer();
      const dec = decodeDxfBuffer(buf);
      if (dec.isBinary) {
        tvxMsg('DXF dạng nhị phân: lưu lại DXF dạng chữ (ASCII).', 1);
        return null;
      }
      txt = dec.text;
    }

    const parsed = parseCulvertDxfText(txt);
    applyParsedDxfToState(parsed);

    const sel = $('tvc_dxly');
    if (sel) {
      sel.innerHTML =
        `<option value="*"${parsed.autoLayer ? '' : ' selected'}>Tất cả các lớp (${parsed.bas.length} đường bao)</option>` +
        parsed.layers
          .map(
            (l) =>
              `<option value="${l}"${l === parsed.autoLayer ? ' selected' : ''}>${dxsTxt(l)} (${parsed.bas.filter((o) => o.ly === l).length} đường bao)</option>`,
          )
          .join('');
    }
    const dxRow = $('tvc_dxRow');
    if (dxRow?.style) dxRow.style.display = '';

    const opensCount = parsed.routes.length;
    tvxMsg(
      `Đọc được ${parsed.bas.length} đường bao lưu vực, ${parsed.dots.length} chấm vị trí cống,${
        parsed.tim
          ? ` tim tuyến dài ${fx(tvxLen(parsed.tim) / 1000, 3)} km` +
            (parsed.E0 ? ' (đầu tuyến ' + (parsed.E0.km ? parsed.E0.km.t : '') + ')' : '') +
            (parsed.E1 ? ' (cuối tuyến ' + (parsed.E1.km ? parsed.E1.km.t : '') + ')' : '') +
            ','
          : ''
      } ${parsed.kms.length} chữ lý trình, ${parsed.FL.length} chữ diện tích, ${opensCount} đường hở. Chọn lớp đường bao rồi bấm "Đo trên DEM".`,
    );
    return parsed;
  } catch (e) {
    console.error(e);
    tvxMsg('Lỗi đọc bản vẽ: ' + ((e as Error).message || String(e)), 1);
    return null;
  }
}

export async function tvxRun(options?: TvxRunOptions): Promise<TvxRunResult | null> {
  const srcState = options?.state;
  const basList = srcState?.bas ?? TVX.bas;
  const dotsList = srcState?.dots ?? TVX.dots;
  const opensList = srcState?.opens ?? TVX.opens;
  const kmsList = srcState?.kms ?? TVX.kms;
  const flList = srcState?.FL ?? TVX.FL;
  const routesList = srcState?.routes ?? TVX.routes;
  const timLine = srcState?.tim !== undefined ? srcState.tim : TVX.tim;
  const E0 = srcState?.E0 !== undefined ? srcState.E0 : TVX.E0;
  const E1 = srcState?.E1 !== undefined ? srcState.E1 : TVX.E1;

  const sel = $('tvc_dxly');
  const layer = options?.layer ?? (sel ? sel.value : '*');
  if (!basList || (!options?.state && !options?.layer && !sel)) return null;
  const polys = basList.filter((o) => layer === '*' || o.ly === layer);
  if (!polys.length) {
    tvxMsg('Không có đường bao lưu vực.', 1);
    return null;
  }

  const lon0 = options?.lon0 ?? (+v('tvc_k0', '105') || 105);
  const src = (options?.src ?? (v('tvc_dsrc', 'cop') as DemSourceKind)) || 'cop';
  const yieldStep = options?.yieldBetweenBasins !== false && !options?.skipUiUpdate;

  try {
    if (!options?.skipUiUpdate) tvxMsg('Đang nạp DEM và đo…');
    if (!options?.skipDemLoad) {
      await HVD.libs();
      await hdLoad(src);
    }
    if (!HVD.S.tiles.some((t) => t.src === src)) {
      if (!options?.skipUiUpdate) tvxMsg('Chưa có DEM.', 1);
      return null;
    }

    const res: TvxCatchmentMeasurement[] = [];
    for (const po of polys) {
      if (yieldStep) await new Promise((r) => setTimeout(r, 10));
      const P = po.P;
      const dot = dotsList
        .map((d) => ({ d, e: tvxDpoly(P, [d.x, d.y]) }))
        .sort((a, b) => a.e - b.e)[0];
      const out: Point2D | null =
        dot && dot.e < Math.max(60, 3 * (dot.d.r || 0)) ? [dot.d.x, dot.d.y] : null;

      const st = opensList
        .filter((q) => {
          let a = 0;
          let b = 0;
          for (let i = 1; i < q.length; i++) {
            const m = [(q[i][0] + q[i - 1][0]) / 2, (q[i][1] + q[i - 1][1]) / 2];
            const l = Math.hypot(q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1]);
            b += l;
            if (tvxIn(P, m[0], m[1])) a += l;
          }
          return b > 0 && a >= 0.7 * b;
        })
        .map((q) => ({ q, L: tvxLen(q) }))
        .sort((a, b) => b.L - a.L);

      res.push(await tvxOne(P, lon0, src, out, st));
    }

    // Lý trình: mũi chỉ khung chữ lý trình gần cống nhất
    const pairs: Array<[number, number, number]> = [];
    res.forEach((r, i) => {
      kmsList.forEach((t, j) => {
        pairs.push([
          Math.min(
            Math.hypot(t.tip[0] - r.out[0], t.tip[1] - r.out[1]),
            Math.hypot(t.x - r.out[0], t.y - r.out[1]) + 1e6 * 0,
          ),
          i,
          j,
        ]);
      });
    });
    pairs.sort((a, b) => a[0] - b[0]);
    const ui = new Set<number>();
    const uj = new Set<number>();
    pairs.forEach(([, i, j]) => {
      if (ui.has(i) || uj.has(j)) return;
      ui.add(i);
      uj.add(j);
      res[i].km = kmsList[j];
    });

    res.forEach((r) => {
      const l = flList
        .map((t) => ({ t, e: tvxDpoly(r.bnd, t.tip) }))
        .sort((a, b) => a.e - b.e)[0];
      r.Flab = l && l.e < 200 ? l.t.v : null;
    });

    const st0 = E0 && E0.km ? E0.km.v : 0;
    const prj = (p: Point2D) => {
      const q = timLine;
      if (!q || !E0 || !E0.km) return null;
      let best: { d: number; s: number } | null = null;
      let acc = 0;
      for (let i = 1; i < q.length; i++) {
        const a = q[i - 1];
        const b = q[i];
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const l = Math.hypot(dx, dy);
        if (!l) continue;
        const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (l * l)));
        const d = Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
        if (!best || d < best.d) best = { d, s: acc + t * l };
        acc += l;
      }
      return best;
    };
    const kmT = (val: number) => {
      const k = Math.floor(val / 1000 + 1e-9);
      const d = val - 1000 * k;
      return 'Km' + k + '+' + (d < 100 ? (d < 10 ? '00' : '0') : '') + d.toFixed(2);
    };

    const lk: string[] = [];
    res.forEach((r) => {
      const b = prj(r.out);
      if (!b || b.d > 150) return;
      r.kmT = st0 + b.s;
      if (!r.km) r.km = { v: r.kmT, t: kmT(r.kmT), tim: 1 };
      else if (Math.abs(r.km.v - r.kmT) > 5) lk.push(`${r.km.t} (tim tuyến: ${kmT(r.kmT)})`);
    });
    res.sort((a, b) => (a.km ? a.km.v : 1e12) - (b.km ? b.km.v : 1e12));

    const old = options?.skipUiUpdate ? [] : tvcRows();
    const rows: TvcRowInput[] = res.map((r, i) => {
      const o: TvcRowInput = old.find((q) => r.km && q.km === r.km.t) || {};
      return {
        ...o,
        km: r.km ? r.km.t : '',
        name: o.name || 'C' + (i + 1),
        F: (+r.F.toFixed(4)).toString(),
        L: (+r.L.toFixed(3)).toString(),
        sl: (+r.sl.toFixed(3)).toString(),
        Jls: (+r.Jls.toFixed(1)).toString(),
        Jsd: (+r.Jsd.toFixed(1)).toString(),
        two: o.two || '2',
        typ: o.typ || 'tron',
        d: o.d || '100',
        n: o.n || '1',
        src: 'dxf',
      };
    });

    const route = timLine
      ? { q: timLine }
      : (routesList || [])
          .filter((o) => !res.some((r) => r.st.includes(o.q)))
          .reduce<CulvertDxfRoute | null>((b, o) => (!b || o.L > b.L ? o : b), null);
    const R1 = (p: Point2D): Point2D => [+p[0].toFixed(1), +p[1].toFixed(1)];
    const geo: TvxSavedGeo = {
      src,
      lon0,
      user: 1,
      route: route ? route.q.map(R1) : null,
      ends: [E0, E1]
        .filter((e): e is CulvertDxfEndMarker => Boolean(e && e.p))
        .map((e) => ({ dau: e.dau, p: R1(e.p!), km: e.km ? e.km.t : '' })),
      bas: res.map((r) => ({
        km: r.km ? r.km.t : '',
        src: 'dxf',
        bnd: r.bnd.map(R1),
        main: r.main.map(R1),
        br: r.brs.map((b) => b.map(R1)),
        out: R1(r.out),
        z0: r.z0,
        z1: r.z1,
        Flab: r.Flab,
        demL: r.demL,
      })),
    };

    const nk = res.filter((r) => !r.km).length;
    const nd = res.filter((r) => !r.hasDot).length;
    const ns = res.filter((r) => !r.hasSt).length;
    const chk = res
      .filter((r) => r.Flab != null && Math.abs(r.Flab - r.F) > Math.max(0.1 * r.Flab, 0.006))
      .map(
        (r) => `${r.km ? r.km.t : '?'}: đường bao ${fx(r.F, 3)} km², chữ ghi ${fx(r.Flab, 3)} km²`,
      );

    if (!options?.skipUiUpdate) {
      tvcSave(
        tvmSort([
          ...old.filter((q) => q.src !== 'dxf' && !rows.some((r) => r.km && r.km === q.km)),
          ...rows,
        ]),
      );
      const G0 = tvmGeo();
      geo.bas = [
        ...((G0 && G0.bas) || []).filter(
          (b) => b.src === 'td' && !geo.bas.some((q) => q.km && q.km === b.km),
        ),
        ...geo.bas,
      ];
      await tvmSaveGeo(geo, lon0, src);
      tvcEditor();
      tvcStep();
      tvxMsg(
        `Đã đo ${res.length} lưu vực: ${res.map((r) => (r.km ? r.km.t + (r.km.tim ? ' (theo tim tuyến)' : '') : '?') + ' F = ' + fx(r.F, 3) + ' km², L = ' + fx(r.L, 3) + ' km').join(' ; ')}.` +
          (lk.length
            ? ` <b class="bad">Lý trình ghi trên bản vẽ khác lý trình đo theo tim tuyến (lệch &gt; 5 m): ${lk.join(' ; ')}.</b>`
            : '') +
          (nk
            ? ` <b class="bad">${nk} lưu vực không ghép được chữ lý trình: nhập lý trình vào bảng.</b>`
            : '') +
          (nd
            ? ` <b class="bad">${nd} lưu vực không có chấm vị trí cống sát đường bao: cửa ra lấy điểm thấp nhất trên đường bao theo DEM.</b>`
            : '') +
          (ns
            ? ` <b class="bad">${ns} lưu vực không có đường suối vẽ trong đường bao: L lấy theo đường dòng chảy dài nhất trên DEM.</b>`
            : '') +
          (chk.length
            ? ` <b class="bad">Diện tích đường bao khác chữ ghi: ${chk.join(' ; ')}. Kiểm tra bản vẽ có đúng tỷ lệ 1 đơn vị = 1 m.</b>`
            : ''),
      );
    } else if (!options?.skipBgDem) {
      const ex = [
        ...geo.bas.flatMap((b) => b.bnd),
        ...(geo.route || []),
        ...(geo.ends || []).map((e) => e.p),
      ];
      if (ex.length) {
        const x0 = Math.min(...ex.map((p) => p[0]));
        const x1 = Math.max(...ex.map((p) => p[0]));
        const y0 = Math.min(...ex.map((p) => p[1]));
        const y1 = Math.max(...ex.map((p) => p[1]));
        try {
          geo.dem = await tvxDemBg(x0, x1, y0, y1, lon0, src);
        } catch (e) {
          console.error(e);
        }
      }
    }

    return { res, rows, geo, lk, nk, nd, ns, chk };
  } catch (e) {
    console.error(e);
    if (!options?.skipUiUpdate) tvxMsg('Lỗi: ' + ((e as Error).message || String(e)), 1);
    return null;
  }
}

export async function tvmXY(options?: TvmXyOptions): Promise<{
  res: Array<{ p: { km: { v: number; t: string }; x: number; y: number; name: string }; r: HvdRunResult }>;
  bad: string[];
  rows: TvcRowInput[];
  geo: TvxSavedGeo;
} | null> {
  const lines = String(options?.text ?? v('tvc_xy', ''))
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const P: Array<{ km: { v: number; t: string }; x: number; y: number; name: string }> = [];
  lines.forEach((l) => {
    const a = l.split(/[\s;\t]+/);
    const km = tvmKm(a[0]);
    const x = parseFloat((a[1] || '').replace(',', '.'));
    const y = parseFloat((a[2] || '').replace(',', '.'));
    if (km && Number.isFinite(x) && Number.isFinite(y)) P.push({ km, x, y, name: a[3] || '' });
  });
  if (!P.length) {
    if (!options?.skipUiUpdate) tvmMsg('Nhập mỗi dòng: lý trình  x  y (tọa độ VN-2000 vị trí cống, như trong CAD).', 1);
    return null;
  }

  const lon0 = options?.lon0 ?? (+v('tvc_k0', '105') || 105);
  const src = (options?.src ?? (v('tvc_dsrc', 'cop') as DemSourceKind)) || 'cop';
  const snap = options?.snap ?? (num('tvc_snap') || 60);
  const thr = options?.thr ?? (num('tvc_thr2') || 0.01);

  try {
    if (!options?.skipUiUpdate) tvmMsg('Đang nạp DEM và khoanh lưu vực…');
    if (!options?.skipDemLoad) {
      await HVD.libs();
      await hdLoad(src);
    }
    if (!HVD.S.tiles.some((t) => t.src === src)) {
      if (!options?.skipUiUpdate) tvmMsg('Chưa có DEM.', 1);
      return null;
    }

    const res: Array<{
      p: { km: { v: number; t: string }; x: number; y: number; name: string };
      r: HvdRunResult;
    }> = [];
    const bad: string[] = [];

    for (const p of P) {
      if (!options?.skipUiUpdate) await new Promise((r) => setTimeout(r, 10));
      try {
        const r = await HVD.run({
          ll: false,
          lon0,
          E: p.x,
          N: p.y,
          R: 4,
          thr,
          snap,
          two: true,
          mm: 'dai',
          src,
        });
        res.push({ p, r });
      } catch (e) {
        bad.push(p.km.t + ': ' + ((e as Error).message || String(e)));
      }
    }

    const old = options?.skipUiUpdate ? [] : tvcRows();
    const R1 = (q: Point2D): Point2D => [+q[0].toFixed(1), +q[1].toFixed(1)];
    const rows: TvcRowInput[] = res.map(({ p, r }, i) => {
      const o: TvcRowInput = old.find((q) => q.km === p.km.t) || {};
      return {
        ...o,
        km: p.km.t,
        name: p.name || o.name || 'C' + (old.length + i + 1),
        F: (+r.Fkm.toFixed(4)).toString(),
        L: (+r.L.toFixed(3)).toString(),
        sl: (+r.sl.toFixed(3)).toString(),
        Jls: (+r.Jls.toFixed(1)).toString(),
        Jsd: (+r.Jsd.toFixed(1)).toString(),
        two: o.two || '2',
        typ: o.typ || 'tron',
        d: o.d || '100',
        n: o.n || '1',
        src: 'td',
      };
    });

    const G0 = (options?.skipUiUpdate ? null : tvmGeo()) || { bas: [] };
    const nb: TvxSavedBasin[] = res.map(({ p, r }) => ({
      km: p.km.t,
      src: 'td',
      bnd: r.bnd.map(R1),
      main: r.mainP.map(R1),
      br: r.brP.map((b) => b.map(R1)),
      out: R1(r.outVN),
    }));
    const geo: TvxSavedGeo = {
      ...G0,
      user: 1,
      bas: [...(G0.bas || []).filter((b) => !nb.some((q) => q.km === b.km)), ...nb],
    };

    if (!options?.skipUiUpdate) {
      tvcSave(tvmSort([...old.filter((q) => !rows.some((r) => r.km === q.km)), ...rows]));
      await tvmSaveGeo(geo, lon0, src);
      tvcEditor();
      tvcStep();
      tvmMsg(
        `Đã khoanh ${res.length} lưu vực: ${res.map(({ p, r }) => p.km.t + ' F = ' + fx(r.Fkm, 3) + ' km²' + (r.edge ? ' (chạm biên vùng tính)' : '')).join(' ; ')}.` +
          (bad.length ? ` <b class="bad">Không khoanh được: ${bad.join(' ; ')}.</b>` : ''),
      );
    }

    return { res, bad, rows, geo };
  } catch (e) {
    console.error(e);
    if (!options?.skipUiUpdate) tvmMsg('Lỗi: ' + ((e as Error).message || String(e)), 1);
    return null;
  }
}

// ============================================================================
// 7. Opt-in DOM Event Wiring (`initCulvertHydroDom`)
// ============================================================================

export function initCulvertHydroDom(): () => void {
  if (typeof document === 'undefined') return () => {};
  const cleanups: Array<() => void> = [];
  const ids = [
    'tvc_xoi',
    'tvc_phi',
    'tvc_nc',
    'tvc_P',
    'tvc_hps',
    'tvc_st',
    'tvc_st2',
    'tvc_stn',
    'tvc_rain',
    'tvc_rm',
    'tvc_rd',
    'tvc_Hp',
    'tvc_reg',
    'tvc_cls',
    'tvc_msd',
    'tvc_mls',
    'tvc_fao',
    'tvc_aoPos',
    'tvc_kgc',
    'tvc_hd',
  ];

  ids.forEach((id) => {
    const raw = $(id);
    if (!raw || !raw.addEventListener) return;
    const el = raw as unknown as HTMLInputElement | HTMLSelectElement;
    const evName = el.tagName === 'SELECT' ? 'change' : 'input';
    const handler = () => {
      if (id === 'tvc_st') el.dataset.v = el.value;
      if (id === 'tvc_st2') tvcStLoad(true);
      if (id === 'tvc_rain') tmSave('tvc_st2', 'tvc_rain');
      tvcSched();
    };
    el.addEventListener(evName, handler);
    cleanups.push(() => el.removeEventListener(evName, handler));
  });

  const dxfEl = $('tvc_dxf') as unknown as HTMLInputElement | null;
  if (dxfEl) {
    const onDxf = (ev: Event) => {
      const target = ev.target as HTMLInputElement;
      const file = target.files?.[0];
      if (file) void tvxFile(file);
      target.value = '';
    };
    dxfEl.addEventListener('change', onDxf);
    cleanups.push(() => dxfEl.removeEventListener('change', onDxf));
  }

  const dxGo = $('tvc_dxgo') as unknown as HTMLButtonElement | null;
  if (dxGo) {
    const onGo = () => {
      void tvxRun();
    };
    dxGo.addEventListener('click', onGo);
    cleanups.push(() => dxGo.removeEventListener('click', onGo));
  }

  const xyGo = $('tvc_xygo') as unknown as HTMLButtonElement | null;
  if (xyGo) {
    const onXy = () => {
      void tvmXY();
    };
    xyGo.addEventListener('click', onXy);
    cleanups.push(() => xyGo.removeEventListener('click', onXy));
  }

  return () => {
    cleanups.forEach((fn) => fn());
  };
}
