/**
 * Bridge Hydrology, Hydraulics & Scour Engine (TCVN 9845:2013, TCVN 11823-2, TCVN 4054:2005)
 *
 * Clean-room 100% numerically exact TypeScript port of:
 * - `analysis-cau-cong/modules/15_bridge_hydrology_data_and_calc.js`:
 *   `HV`, `HVKM`, `HVM`, `hvCalc`, `hvScour`, `HVHC`, `HVDZ`, `hvHcSlide`, `hvHcFit`,
 *   `hvDzFit`, `hvAllFit`, `hvStSel`, `hvStRe`, `hvStWhyFill`, `hvSecShift`, `hvPierEx`,
 *   `hvPreset`, `hvRender`, `hvLink`, `hvStep`, `hvStRows`, `hvStWhyAuto`, `hvStSec`
 * - `analysis-cau-cong/modules/16_dem_watershed_ocr_dxf_import.js`:
 *   Cowan roughness helpers `NCW`, `NCL`, `ncSel`, `ncVal`, `ncUpd`, `ncSet`, `ncCal`, `ncCalSet`, `ncSens`
 *
 * Zero licensing code, zero external CDN URLs. Visual/SVG chart rendering is
 * delegated cleanly through `getVisualHooks().renderHydrology?.({ mode: 'bridge', result })`.
 */

import type { HydrologyResult, Point2D } from '../../types/project';
import {
  $,
  cf,
  fx,
  getVisualHooks,
  num,
  set,
  setOutputValue,
  sv,
  v,
  type ContextElementLike,
  type VisualReportHooks,
} from '../context';
import {
  HVD,
  hdLoad,
  hdZst,
  hvLV,
  hvLVok,
  setDemStepHook,
} from './demWatershed';
import {
  HVMAP,
  HVST,
  HVSTL,
  HVTAB,
  HVWL,
  HVZL,
  HVZONE,
  TM_DB,
  hvRegAt,
  hvRegAuto,
  hvTMinv,
  setStationDomHooks,
  tmAdd,
  tmLabel,
  tmParse,
  tmSave,
  tmSlug,
} from './stationsDb';

// Suppress unused import lint when imported strictly for canonical station contract parity
void HVZONE;
void HVZL;
void hvTMinv;
void hvRegAt;
void TM_DB;
void tmSlug;
void tmLabel;
void tmAdd;
void tmSave;
void HVMAP;
void v;
void set;
void num;
void cf;

// ============================================================================
// 1. Canonical Bridge Hydrology Interfaces
// ============================================================================

export type SoilTypeKey = 'II' | 'III' | 'IV' | 'V' | 'VI';
export type DistType = 'p3' | 'km';
export type ApplicabilityPair = [0 | 1 | boolean, string];

export interface RainObsPoint {
  y: number;
  x: number;
  m?: number;
  P?: number;
}

export interface HvStatsResult {
  n: number;
  mean: number;
  Cv: number;
  Cs: number;
  Kmin: number;
  lo: number;
  hi: number;
  csOK: boolean;
  emp: RainObsPoint[];
  min: number;
  max: number;
}

export interface PhiA1Result {
  phi: number;
  col: number;
  auto: boolean;
  cand: number[];
  row: (number | null)[];
  ri: number;
  lab: string;
  grp: string;
}

export interface TauA2Result {
  tau: number;
  out: boolean;
  lo: number;
  hi: number;
}

export interface ApA3SusCell {
  tau: number;
  phl: number;
  v: number;
}

export interface ApA3Result {
  ap: number;
  tauOut: boolean;
  phlOut: boolean;
  t: number;
  p: number;
  sus: ApA3SusCell[];
}

export interface HvQpResult {
  Hp: number;
  warn: string[];
  B: number;
  k: number;
  Lsd: number;
  A1: PhiA1Result;
  phi: number;
  phisd: number;
  tau: number;
  noCh: boolean;
  phils: number;
  A3: ApA3Result;
  Ap: number;
  delta: number;
  Q: number;
  q: number;
}

export interface HvSecPartSpec {
  k: 'b1' | 'ch' | 'b2';
  n: string;
  x1: number;
  x2: number;
  nn: number;
  gm: number;
}

export interface HvSecPartResult extends HvSecPartSpec {
  A: number;
  B: number;
  P: number;
  h: number;
  R: number;
  useR: boolean;
  hr: number;
  V: number;
  Q: number;
}

export interface HvSecSnapshot {
  H: number;
  parts: HvSecPartResult[];
  Q: number;
  A: number;
  B: number;
  V: number;
  ch: HvSecPartResult;
  Qb: number;
}

export interface HvSecConfig {
  pts: Point2D[];
  xL: number;
  xR: number;
  nch: number;
  nb: number;
  gch: number;
  gb: number;
  hf: string;
  i: number;
}

export interface HvSecModel {
  pts: Point2D[];
  x0: number;
  x9: number;
  zmin: number;
  ztop: number;
  at: (H: number) => HvSecSnapshot;
  hOf: (Q: number) => number;
  S: HvSecConfig;
}

export interface HvSmallBridgeResult {
  k1: number;
  N: number;
  M: number;
  s: number;
  H0: number;
  H: number;
  reg: 'tự do' | 'ngập';
  kng: number | null;
  ht: number;
  Vt: number;
  i8: number;
  n: number;
  over: boolean;
}

export interface HvKmEntry {
  r: number;
  cv: number[];
  K: number[][];
}

export interface HvFitResult {
  Cv: number;
  Cs: number;
  e: number;
  rmse: number;
  rmse0: number;
}

export interface HvDhxdResult {
  Lsd: number;
  isd: number;
  f: number;
  tc: number;
  psi: number | null;
  ap: number;
  alpha: number;
  phi: number;
  delta: number;
  Q: number;
  tcOut: boolean;
}

export interface HvHistFlood {
  y: number;
  h: number;
  N: number;
  Q?: number;
  M?: number;
  Pi?: number;
  Ki?: number;
  Qp?: number;
  P?: number;
}

export interface HvHtResult {
  fl: Array<HvHistFlood & { Q: number; M: number; Pi: number; Ki: number; Qp: number }>;
  Cv: number;
  Cs: number;
  Kp: number;
  fitted: boolean;
  Q: number;
}

export interface HvFormulaResult {
  y: number;
  tex: string;
  p: string;
}

export interface HvPierScourInput {
  h: number;
  h2: number;
  v: number;
  b: number;
  B1: number;
  Kx: number;
  L: number;
  al: number;
  nose: string;
  chu: boolean;
}

export interface HvSoilProps {
  d50: number;
  d90: number;
  coh: boolean;
  cty: string;
  Ka?: number;
  Kf?: number;
}

export interface HvAbutScourInput {
  Lp: number;
  ya: number;
  Vc: number;
  Fr: number;
  h1: number;
  al?: number;
  v?: number;
}

export interface HvAbutSoilProps extends HvSoilProps {
  abut: string;
  abn: string;
  tha: number;
  mta: number;
  chu?: boolean;
}

export interface HvPBangResult {
  P: number;
  Pt: number;
  Lc: number;
  loai: string;
  capN: string;
  auto: boolean;
}

export interface HvSecTrimResult {
  pts: Point2D[];
  cut: boolean;
  a?: number;
  b?: number;
  man?: boolean;
  Zc?: number;
}

export interface HvPierSpec {
  x: number;
  a: number;
  L: number;
}

export interface HvInput {
  P: number;
  PB: HvPBangResult;
  capd: string;
  Pwhy: string;
  Px: number;
  pxm: string;
  Pa: number;
  st: string;
  stvt: string;
  lv: string;
  stWhy: string;
  rs: string;
  rain: RainObsPoint[];
  Csu: number;
  Xm: number;
  Cvp: number;
  Csp: number;
  rm: string;
  rd: string;
  F: number;
  L: number;
  sl: number;
  two: boolean;
  jm: string;
  Jls: number;
  prof: number[][];
  Jsd: number;
  msd: number;
  mls: number;
  noCh: boolean;
  cls: string;
  phiCol: number | null;
  reg: string;
  regAuto: boolean;
  fao: number;
  aoPos: string;
  qm: string;
  htr: number;
  sec: Point2D[];
  secT: HvSecTrimResult;
  xL: number;
  xR: number;
  xlm: string;
  hf: string;
  nch: number;
  nb: number;
  gch: number;
  gb: number;
  i: number;
  hist: HvHistFlood[];
  MNHT: number;
  tcOn: string;
  dTC: number;
  tcm: string;
  xA1: number;
  xA2: number;
  pier: HvPierSpec[];
  nose: string;
  mty: string;
  pty: string;
  th: number;
  abut: string;
  abn: string;
  tha: number;
  mta: number;
  LpL: number;
  LpR: number;
  lpm: string;
  sdn: string;
  km: string;
  kmAuto: boolean;
  Pt: string;
  lxm: string;
  v0m: string;
  mum: string;
  qsrc: string;
  qtl: number[][];
  qtlsrc: string;
  bctm: string;
  dzcp: number;
  Qcong: number;
  wlst: string;
  wlser: RainObsPoint[];
  wlday: number[][];
  m: number;
  Vcp: number;
  zm: string;
  etm: string;
  soil: string;
  coh: boolean;
  cty: string;
  d50: number;
  gd: number;
  d90: number;
  xm: string;
  pm: string;
  am: string;
  Ka: number;
  Kf: number;
  dlt: number;
  ELdd: number;
  ELkg: number;
  vt: boolean;
  lnk: boolean;
  kmAll?: boolean;
  zmAll?: boolean;
  xmAll?: boolean;
  pmAll?: boolean;
  amAll?: boolean;
  [extra: string]: unknown;
}

export interface HvQEntry {
  Hp: number;
  t: HvQpResult | null;
  d: HvDhxdResult | null;
  h: HvHtResult | null;
  Q: number;
  m: 'tl' | 'dhxd' | 'ht' | 'tcvn';
}

export interface HvOpeningSnapshot {
  A: number;
  B: number;
  Ap: number;
  Bp: number;
  Bg: number;
  htb: number;
  zAt: (x: number) => number;
}

export interface HvOpeningResult {
  Vch: number;
  Lo: number;
  mu41: number;
  mu: number;
  q: number;
  Pq: number;
  Ps: number;
  Pn: number;
  P: number;
  msr: number;
  m: Record<string, number>;
  w: number;
  chB: number;
  chOK: boolean;
  zb: number;
  Lo0: number;
  hh: number;
  V0n: number;
  sb: HvSmallBridgeResult;
  sbOK: boolean;
  Hup: number;
  app: Record<string, ApplicabilityPair>;
  ok: boolean;
  wc?: number;
  htb?: number;
  wc0?: number;
  Bct?: number;
  bch?: number;
  wch?: number;
  hb?: number;
  Bct2?: number;
  hch?: number;
  Bct3?: number;
  Lct?: number;
  Lreq?: number;
}

export interface HvVerticalPoint {
  x: number;
  z: number;
  h: number;
  ch: boolean;
  q: number;
  h2: number;
  dx: number;
}

export interface HvPierScourItem {
  x: number;
  a: number;
  L: number;
  z: number;
  h0: number;
  y1: number;
  V1: number;
  qn: number;
  shape: { K: number; B1: number; type: string };
  all: Array<HvFormulaResult & { k: string; n: string; src: string; app: ApplicabilityPair }>;
  cur: HvFormulaResult & { k: string; n: string; src: string; app: ApplicabilityPair };
  ys: number;
  el: number;
  dxc: number;
}

export interface HvAbutScourItem {
  n: string;
  man: boolean;
  mode: string;
  x: number;
  h0: number;
  Lp: number;
  dxa: number;
  bai: boolean;
  Ac?: number;
  Qc?: number;
  ya?: number;
  Vc?: number;
  Fr?: number;
  h1?: number;
  all: Array<HvFormulaResult & { k: string; n: string; src: string; app: ApplicabilityPair }>;
  cur: (HvFormulaResult & { k: string; n: string; src: string; app: ApplicabilityPair }) | null;
  ys: number;
  el: number;
  hire?: boolean;
}

export interface HvScourResult {
  P: number;
  Q: number;
  H: number;
  op: HvOpeningSnapshot;
  Lc: number;
  htb: number;
  M: {
    lis: {
      a: number;
      bp: number;
      y: number;
      al: number;
      tb: boolean;
      Hst: number;
      dxt: number;
      h2: number[];
    };
    lau: {
      Vc: number;
      live: boolean;
      w: number;
      us: number;
      uw: number;
      k1: number;
      y2l: number;
      Dm: number;
      y2c: number;
      y2: number;
      y0: number;
      yx: number;
      y1: number;
      Q1: number;
      W1: number;
      V1: number;
      h2: number[];
    };
    p: { P: number; h2: number[] };
    and: {
      Qch: number;
      Qbc: number;
      vbc: number;
      B0: number;
      l0: number;
      beta: number;
      tau: number;
      eta: number;
      aa: number;
      Fq: number;
      bch: number;
      bb: number;
      lam: number;
      h2: number[];
    };
  };
  app: Record<string, ApplicabilityPair>;
  sel: string;
  V: HvVerticalPoint[];
  vmax: HvVerticalPoint;
  dl: number;
  elG: number;
  cmp: Array<{ k: string; hmax: number; x: number; el: number }>;
  Vu: number;
  piers: HvPierScourItem[];
  abut: HvAbutScourItem[];
}

export interface HvBackwaterResult {
  fb: number;
  etaA: number;
  eta1: number;
  Qc: number;
  Qz: number;
  Vtr: number;
  wsx: number;
  Psx: number;
  xsel: string;
  Vsx: number;
  Vc: number;
  V0c: number;
  V0: number;
  Vtb: number;
  B0: number;
  Lc: number;
  Lng: number;
  Fr: number;
  Fri: number;
  QQc: number;
  a: number;
  Kk: number;
  eta2: number;
  x0: number;
  beta: number;
  Kg: number;
  Kpg: number;
  m: Record<'s1' | 's2' | 'an' | 'gr', number>;
  app?: Record<string, ApplicabilityPair>;
  sel: string;
  dz: number;
  Hd: number;
  dzcp: number | null;
  okDZ: boolean;
  TL?: number;
  HTL?: number;
}

export interface HvPoly2Result {
  a: number;
  b: number;
  c: number;
  R2: number;
  f: (x: number) => number;
  pts: Point2D[];
  x1: number;
  x2: number;
}

export interface HvConstructionWaterResult {
  st: HvStatsResult;
  Cv: number;
  Cs: number;
  Hp: (P: number) => number;
  Pd: number;
  Hcau: number;
  Htr: number;
  DH: number;
  day: number[][];
  H5d?: number;
  Htt?: number;
}

export interface HvCalcResult {
  I: HvInput;
  warn: string[];
  err: string[];
  TL: boolean;
  Pd: number;
  Px: number;
  dist: DistType;
  noRain?: boolean;
  Xm: number;
  Cv: number;
  Cs: number;
  pm: 'par' | 'fit' | 'mom';
  st?: HvStatsResult;
  fitR?: HvFitResult;
  CsUser?: boolean;
  Hp: (P: number) => number;
  Jls: number;
  Jp?: { J: number; L: number };
  S: HvSecModel;
  qTL: (P: number) => number;
  Qall: (P: number) => HvQEntry;
  Pa: number | null;
  Ps: number[];
  Q: Record<number, HvQEntry>;
  htr: number;
  H: Record<number, number>;
  hy: Record<number, HvSecSnapshot>;
  Htk: number;
  o: HvSecSnapshot;
  HQ: HvSecSnapshot[];
  fitHQ: HvPoly2Result | null;
  hist: Array<HvHistFlood & { Q: number; P: number }>;
  histMax: (HvHistFlood & { Q: number; P: number }) | null;
  op: HvOpeningSnapshot;
  qn: { Q: number; A: number };
  V0: number;
  K: HvOpeningResult;
  Z: HvBackwaterResult;
  Hd: number;
  C: { cl: number; ddMin: number; kgMin: number; okD: boolean; okK: boolean };
  X: HvScourResult;
  W?: HvConstructionWaterResult;
  Q10: HvQEntry;
  H10: number;
  MNTC: number;
}

export interface HvStRowEntry {
  n: string;
  lo?: string;
  E?: number;
  N?: number;
  vt: string;
  cu?: string;
  gd?: number;
  d: number;
  dir: string;
  z: { z: number | null; zm: number; zx: number; zn: number } | null | undefined;
}

export interface HvStRowsResult {
  rows: HvStRowEntry[];
  has: boolean;
  E: number;
  N: number;
  zc: { z: number | null; zm: number; zx: number; zn: number } | null | undefined;
  src: string | null | undefined;
}

export interface HvAllFitCandidate {
  set: Partial<Record<'i' | 'Jls' | 'Jsd' | 'lc', number>>;
  H: number;
  dz: number;
  Lct: number;
  Lo: number;
  okH: boolean;
  okZ: boolean;
  okK: boolean;
}

export interface HvAllFitEval {
  q0: HvAllFitCandidate | null;
  best: HvAllFitCandidate | null;
  near: { q: HvAllFitCandidate; sc: number } | null;
}

export interface HvSegGroup {
  n: string;
  rows: Array<{
    a: number;
    b: number;
    za: number;
    zb: number;
    ha: number;
    hb: number;
    w: number;
    x: number;
  }>;
  A: number;
  P: number;
  B: number;
}

// ============================================================================
// 2. Internal Safe Event Dispatcher & Formatting Helpers
// ============================================================================

function dispatchElEvents(el: ContextElementLike | null, names: string[]): void {
  if (!el) return;
  const target = el as unknown as { dispatchEvent?: (evt: Event) => boolean };
  if (typeof Event === 'undefined' || typeof target.dispatchEvent !== 'function') return;
  for (const name of names) {
    target.dispatchEvent(new Event(name, { bubbles: true }));
  }
}

export const hvF = (val: number | null | undefined, d = 2): string =>
  val == null || !isFinite(val) ? '-' : fx(val, d);

export const hvM = (t: string): string =>
  `<span class="m" data-tex="${String(t).replace(/"/g, '&quot;')}"></span>`;

export const hvOK = (ok: boolean): string =>
  ok ? '<b class="ok">Đạt</b>' : '<b class="bad">Không đạt</b>';

export const clampHv = (x: number, a: number, b: number): number => Math.max(a, Math.min(b, x));

// ============================================================================
// 3. `HV` — Core Hydrology & Hydraulic Math Engine (TCVN 9845:2013 & Sổ tay)
// ============================================================================

export const HV = (function () {
  const g = 9.81;
  const T = HVTAB;
  const clamp = (x: number, a: number, b: number): number => Math.max(a, Math.min(b, x));

  function interp(xs: number[], ys: number[], x: number): number {
    // nội suy tuyến tính, ngoài khoảng lấy giá trị đầu mút
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

  // ---------- hàm gamma, phân phối Pearson III ----------
  function lgam(z: number): number {
    const c = [
      676.5203681218851,
      -1259.1392167224028,
      771.32342877765313,
      -176.61502916214059,
      12.507343278686905,
      -0.13857109526572012,
      9.9843695780195716e-6,
      1.5056327351493116e-7,
    ];
    if (z < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * z))) - lgam(1 - z);
    z -= 1;
    let x = 0.99999999999980993;
    for (let i = 0; i < 8; i++) x += c[i] / (z + i + 1);
    const t = z + 7.5;
    return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
  }

  function gP(a: number, x: number): number {
    // hàm gamma không đầy đủ chuẩn hoá P(a,x)
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
    // phân vị chuẩn (Acklam)
    const a = [
      -39.69683028665376,
      220.9460984245205,
      -275.9285104469687,
      138.357751867269,
      -30.66479806614716,
      2.506628277459239,
    ];
    const b = [
      -54.47609879822406,
      161.5858368580409,
      -155.6989798598866,
      66.80131188771972,
      -13.28068155288572,
    ];
    const c = [
      -0.007784894002430293,
      -0.3223964580411365,
      -2.400758277161838,
      -2.549732539343734,
      4.374664141464968,
      2.938163982698783,
    ];
    const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
    const pl = 0.02425;
    let q: number;
    let r: number;
    if (p < pl) {
      q = Math.sqrt(-2 * Math.log(p));
      return (
        (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
      );
    }
    if (p > 1 - pl) {
      q = Math.sqrt(-2 * Math.log(1 - p));
      return (
        -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
      );
    }
    q = p - 0.5;
    r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  }

  // Φ(P, Cs) của đường Pearson III (Sổ tay, Phụ lục 2-1: XP = X(1 + ΦP.Cv)); P tính bằng %
  function phiP(P: number, Cs: number): number {
    const p = P / 100;
    if (Math.abs(Cs) < 1e-6) return nInv(1 - p);
    const s = Math.abs(Cs);
    const a = 4 / (s * s);
    const y = Cs > 0 ? gPinv(a, 1 - p) : gPinv(a, p);
    const f = (s / 2) * y - 2 / s;
    return Cs > 0 ? f : -f;
  }

  // ---------- thống kê chuỗi (Sổ tay mục 2.2.1: PT 2-1 đến 2-5) ----------
  function stats(arr: RainObsPoint[]): HvStatsResult | null {
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
    const srt = arr.map((o) => ({ ...o })).sort((a, b) => b.x - a.x);
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

  const xP = (mean: number, Cv: number, Cs: number, P: number): number =>
    mean * (1 + phiP(P, Cs) * Cv);

  // ---------- TCVN 9845 - Bảng A.1: hệ số dòng chảy lũ φ ----------
  const FG: ReadonlyArray<[number, number, string]> = [
    [0, 4, 'F < 0,1'],
    [5, 6, '0,1 < F < 1,0'],
    [7, 9, '1,0 < F < 10'],
    [10, 11, '10 < F < 100'],
    [12, 12, 'F > 100'],
  ];

  function fGroup(F: number): number {
    return F < 0.1 ? 0 : F < 1 ? 1 : F < 10 ? 2 : F < 100 ? 3 : 4;
  }

  function phiA1(
    cls: string,
    Hp: number,
    F: number,
    col: number | null,
  ): PhiA1Result | null {
    const tb = T.A1[cls as SoilTypeKey];
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
      c = cand.reduce((b, x) => ((row[x] as number) > (row[b] as number) ? x : b), cand[0]);
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

  // Bảng A.2: τsd theo φsd và vùng mưa
  function tauA2(reg: string, phs: number): TauA2Result {
    const xs = T.A2.phi;
    const ys = T.A2.v[reg];
    const xx: number[] = [];
    const yy: number[] = [];
    xs.forEach((x, i) => {
      if (ys[i] != null) {
        xx.push(x);
        yy.push(ys[i] as number);
      }
    });
    return {
      tau: interp(xx, yy, phs),
      out: phs < xx[0] || phs > xx[xx.length - 1],
      lo: xx[0],
      hi: xx[xx.length - 1],
    };
  }

  // Bảng A.3: Ap theo vùng mưa, τsd, φls (nội suy hai chiều)
  function apA3(reg: string, tau: number, phl: number): ApA3Result {
    const tv = T.A3.tau;
    const pv = T.A3.phi;
    const V = T.A3.v[reg];
    const t = clamp(tau, tv[0], tv[4]);
    const p = clamp(phl, pv[0], pv[pv.length - 1]);
    const col = V.map((r) => interp(pv, r, p));
    const ap = interp(tv, col, t);
    // các ô dùng để nội suy
    const ti = Math.max(
      1,
      tv.findIndex((x) => x >= t),
    );
    const pi = Math.max(
      1,
      pv.findIndex((x) => x >= p),
    );
    const cells: [number, number][] = [
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

  // Bảng 6: δ theo tỷ lệ diện tích hồ ao, đầm lầy (%) và vị trí
  const B6 = {
    f: [0, 2, 4, 6, 8, 10, 15, 20, 30, 40, 50],
    h: [1, 0.85, 0.75, 0.65, 0.55, 0.5, 0.4, 0.35, 0.2, 0.15, 0.1],
    t: [1, 0.95, 0.9, 0.85, 0.8, 0.75, 0.65, 0.55, 0.45, 0.35, 0.25],
  };
  const delta6 = (fa: number, pos: string): number =>
    fa <= 0 ? 1 : interp(B6.f, pos === 'h' ? B6.h : B6.t, fa);

  // ---------- TCVN 9845 Điều 4.5, 5.2: lưu lượng đỉnh lũ theo công thức cường độ giới hạn ----------
  function qp(I: HvInput, Hp: number): HvQpResult | null {
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
    return { Hp, warn, B, k, Lsd, A1: A, phi, phisd, tau, noCh, phils, A3: a, Ap, delta, Q, q };
  }

  // TCVN 9845 PT 4: độ dốc bình quân lòng chính từ trắc dọc (khoảng cách tính từ công trình, km; cao độ, m) -> ‰
  function jls(pr: number[][] | null | undefined): { J: number; L: number } | null {
    if (!pr || pr.length < 2) return null;
    const p = pr.slice().sort((a, b) => a[0] - b[0]);
    const z0 = p[0][1];
    const L = p[p.length - 1][0] - p[0][0];
    let s = 0;
    for (let i = 1; i < p.length; i++) {
      const h1 = p[i - 1][1] - z0;
      const h2 = p[i][1] - z0;
      s += (h1 + h2) * (p[i][0] - p[i - 1][0]);
    }
    return { J: s / (L * L), L };
  }

  // ---------- thủy lực mặt cắt (Sổ tay PT 2-37, 2-39; Manning) ----------
  function geo(pts: Point2D[], H: number, x1: number, x2: number): { A: number; B: number; P: number } {
    let A = 0;
    let B = 0;
    let P = 0;
    for (let i = 1; i < pts.length; i++) {
      let [xa, za] = pts[i - 1];
      let [xb, zb] = pts[i];
      if (xb <= x1 || xa >= x2) continue;
      const cl = (x: number): number => za + ((zb - za) * (x - xa)) / (xb - xa);
      if (xa < x1) {
        za = cl(x1);
        xa = x1;
      }
      if (xb > x2) {
        const zz = za + ((zb - za) * (x2 - xa)) / (xb - xa);
        zb = zz;
        xb = x2;
      }
      const da = H - za;
      const db = H - zb;
      if (da <= 0 && db <= 0) continue;
      const w = xb - xa;
      let ya = za;
      let yb = zb;
      let xs = xa;
      let xe = xb;
      if (da < 0) {
        const t = da / (da - db);
        xs = xa + t * w;
        ya = H;
      }
      if (db < 0) {
        const t = da / (da - db);
        xe = xa + t * w;
        yb = H;
      }
      const ww = xe - xs;
      A += (ww * (H - ya + (H - yb))) / 2;
      B += ww;
      P += Math.hypot(ww, yb - ya);
    }
    return { A, B, P };
  }

  function secMake(S: HvSecConfig): HvSecModel {
    // S: {pts, xL, xR, nch, nb, i}
    const pts = S.pts.slice().sort((a, b) => a[0] - b[0]);
    const x0 = pts[0][0];
    const x9 = pts[pts.length - 1][0];
    const zmin = Math.min(...pts.map((p) => p[1]));
    const ztop = Math.min(pts[0][1], pts[pts.length - 1][1]);
    const parts: HvSecPartSpec[] = (
      [
        { k: 'b1' as const, n: 'Bãi trái', x1: x0, x2: S.xL, nn: S.nb, gm: S.gb },
        { k: 'ch' as const, n: 'Lòng chủ', x1: S.xL, x2: S.xR, nn: S.nch, gm: S.gch },
        { k: 'b2' as const, n: 'Bãi phải', x1: S.xR, x2: x9, nn: S.nb, gm: S.gb },
      ] as HvSecPartSpec[]
    ).filter((p) => p.x2 > p.x1 + 1e-9);

    function at(H: number): HvSecSnapshot {
      const partResults: HvSecPartResult[] = [];
      let Q = 0;
      let A = 0;
      let B = 0;
      parts.forEach((p) => {
        const G = geo(pts, H, p.x1, p.x2);
        const h = G.B > 0 ? G.A / G.B : 0;
        const R = G.P > 0 ? G.A / G.P : 0;
        const useR = G.B < 10 * h;
        const hr = useR ? R : h;
        const V =
          G.A > 0
            ? S.hf === 'bad'
              ? (87 * Math.sqrt(hr * S.i)) / (1 + p.gm / Math.sqrt(hr))
              : (Math.pow(hr, 2 / 3) * Math.sqrt(S.i)) / p.nn
            : 0;
        /* Manning PT 2-37 ; Sêdi - Badanh PT 2-38 */
        const q: HvSecPartResult = {
          ...p,
          ...G,
          h,
          R,
          useR,
          hr,
          V,
          Q: V * G.A,
        };
        partResults.push(q);
        Q += q.Q;
        A += G.A;
        B += G.B;
      });
      const V = A > 0 ? Q / A : 0;
      const ch = partResults.find((p) => p.k === 'ch') || partResults[0];
      const Qb = Q - (ch ? ch.Q : 0);
      return { H, parts: partResults, Q, A, B, V, ch, Qb };
    }

    function hOf(Q: number): number {
      let lo = zmin + 1e-4;
      let hi = ztop;
      if (at(hi).Q < Q) {
        let k = 0;
        while (at(hi).Q < Q && k < 60) {
          hi += 0.5;
          k++;
        }
      }
      for (let k = 0; k < 100; k++) {
        const m = (lo + hi) / 2;
        if (at(m).Q < Q) lo = m;
        else hi = m;
      }
      return (lo + hi) / 2;
    }

    return { pts, x0, x9, zmin, ztop, at, hOf, S };
  }

  // ---------- Sổ tay Bảng 4-1, 4-2 ----------
  const B41 = {
    L: [10, 13, 16, 18, 21, 25, 30, 42, 52, 63, 106, 124, 200],
    V: [1, 1.5, 2, 2.5, 3, 3.5, 4],
    v: [
      [0.96, 0.97, 0.98, 0.98, 0.99, 0.99, 0.99, 1, 1, 1, 1, 1, 1],
      [0.94, 0.96, 0.97, 0.97, 0.97, 0.98, 0.99, 0.99, 0.99, 0.99, 1, 1, 1],
      [0.93, 0.94, 0.95, 0.96, 0.97, 0.97, 0.98, 0.98, 0.99, 0.99, 0.99, 0.99, 1],
      [0.9, 0.93, 0.94, 0.95, 0.96, 0.96, 0.97, 0.98, 0.98, 0.99, 0.99, 0.99, 1],
      [0.89, 0.91, 0.93, 0.94, 0.95, 0.96, 0.96, 0.97, 0.98, 0.98, 0.99, 0.99, 0.99],
      [0.87, 0.9, 0.92, 0.93, 0.94, 0.95, 0.96, 0.97, 0.98, 0.98, 0.99, 0.99, 0.99],
      [0.85, 0.88, 0.91, 0.92, 0.93, 0.94, 0.95, 0.96, 0.97, 0.98, 0.99, 0.99, 0.99],
    ],
  };

  function mu41(V: number, L: number): number {
    if (V < 1) return 1;
    const col = B41.v.map((r) => interp(B41.L, r, L));
    return interp(B41.V, col, V);
  }

  const B42 = { q: [2, 3, 5, 10, 15, 20], P: [2.2, 2.1, 1.7, 1.4, 1.3, 1.25] };
  const P42 = (q: number): number => interp(B42.q, B42.P, q);

  // ---------- TCVN 9845 Bảng 8, 9 (cầu nhỏ) ----------
  const B8 = {
    m: [0.32, 0.33, 0.34, 0.35, 0.36],
    k1: [0.45, 0.47, 0.49, 0.52, 0.54],
    N: [0.84, 0.83, 0.81, 0.8, 0.78],
    psi: [0.76, 0.78, 0.81, 0.83, 0.84],
  };

  const B9: Record<number, { n: number[]; s: number[]; k: number[] }> = {
    // n -> [σng, Kng] cho từng m (Bảng 9)
    0.32: {
      n: [0.84, 0.86, 0.88, 0.9, 0.92, 0.94, 0.96, 0.98, 0.99],
      s: [1, 0.96, 0.9, 0.84, 0.76, 0.67, 0.56, 0.4, 0.28],
      k: [0.59, 0.64, 0.69, 0.74, 0.8, 0.85, 0.9, 0.95, 0.97],
    },
    0.33: {
      n: [0.83, 0.84, 0.86, 0.88, 0.9, 0.92, 0.94, 0.96, 0.98, 0.99],
      s: [1, 0.98, 0.93, 0.88, 0.82, 0.75, 0.66, 0.55, 0.39, 0.28],
      k: [0.6, 0.62, 0.67, 0.72, 0.76, 0.81, 0.86, 0.91, 0.95, 0.98],
    },
    0.34: {
      n: [0.81, 0.82, 0.83, 0.84, 0.86, 0.88, 0.9, 0.92, 0.94, 0.96, 0.98, 0.99],
      s: [1, 0.98, 0.96, 0.94, 0.9, 0.85, 0.79, 0.72, 0.64, 0.53, 0.38, 0.27],
      k: [0.61, 0.63, 0.65, 0.67, 0.71, 0.75, 0.8, 0.84, 0.88, 0.92, 0.96, 0.98],
    },
    0.35: {
      n: [0.8, 0.82, 0.84, 0.86, 0.88, 0.9, 0.92, 0.94, 0.96, 0.98, 0.99],
      s: [1, 0.97, 0.93, 0.89, 0.84, 0.78, 0.71, 0.62, 0.52, 0.37, 0.27],
      k: [0.63, 0.67, 0.7, 0.74, 0.78, 0.82, 0.85, 0.89, 0.93, 0.96, 0.98],
    },
    0.36: {
      n: [0.78, 0.8, 0.82, 0.84, 0.86, 0.88, 0.9, 0.92, 0.94, 0.96, 0.98, 0.99],
      s: [1, 0.97, 0.94, 0.91, 0.86, 0.81, 0.75, 0.69, 0.6, 0.51, 0.36, 0.26],
      k: [0.64, 0.67, 0.71, 0.74, 0.77, 0.81, 0.84, 0.87, 0.9, 0.93, 0.97, 0.98],
    },
  };

  function b9(m: number, n: number): { m: number; s: number; k: number; out: boolean } {
    const keys = Object.keys(B9).map(Number);
    const mk = keys.reduce((b, x) => (Math.abs(x - m) < Math.abs(b - m) ? x : b), keys[0]);
    const t = B9[mk];
    return { m: mk, s: interp(t.n, t.s, n), k: interp(t.n, t.k, n), out: n > t.n[t.n.length - 1] };
  }

  // cầu nhỏ, kiểm tra với khẩu độ thực L0 (TCVN 9845 Điều 6.2, PT 40 - 42; Phụ lục C, bài toán 1)
  function smallBr(
    Q: number,
    L0: number,
    m: number,
    hh: number,
    V0: number,
    alpha: number,
  ): HvSmallBridgeResult {
    const i8 = B8.m.reduce((b, x, i) => (Math.abs(x - m) < Math.abs(B8.m[b] - m) ? i : b), 0);
    const k1 = B8.k1[i8];
    const N = B8.N[i8];
    const M = m * Math.sqrt(2 * g);
    const hv = (alpha * V0 * V0) / (2 * g);
    const H0f = (s: number): number => Math.pow(Q / (s * M * L0), 2 / 3);
    let s = 1;
    let H0 = H0f(1);
    let H = H0 - hv;
    let reg: 'tự do' | 'ngập' = 'tự do';
    let kng: number | null = null;
    let n = hh / H;
    let over = false;
    if (hh > N * H) {
      reg = 'ngập';
      const keys = Object.keys(B9).map(Number);
      const mk = keys.reduce((b, x) => (Math.abs(x - m) < Math.abs(b - m) ? x : b), keys[0]);
      const nmax = B9[mk].n[B9[mk].n.length - 1];
      // Q = σng(hh/H).m.√(2g).L0.(H + αV0²/2g)^1,5 tăng theo H: giải bằng chia đôi trong miền N.H ≤ hh ≤ nmax.H
      const f = (Hx: number): number => b9(m, hh / Hx).s * M * L0 * Math.pow(Hx + hv, 1.5);
      let lo = hh / nmax;
      let hi = hh / N;
      if (f(lo) >= Q) {
        over = true;
        H = lo;
      } else {
        for (let k = 0; k < 80; k++) {
          const md = (lo + hi) / 2;
          if (f(md) < Q) lo = md;
          else hi = md;
        }
        H = (lo + hi) / 2;
      }
      n = hh / H;
      const bb = b9(m, n);
      s = bb.s;
      kng = bb.k;
      H0 = H + hv;
    }
    const ht = reg === 'tự do' ? k1 * H : (kng as number) * H;
    const Vt = Q / (ht * L0);
    return { k1, N, M, s, H0, H, reg, kng, ht, Vt, i8, n, over };
  }

  // ---------- xói chung theo Listvan (TKĐ3, PT 3-7, 3-9; Bảng 3-4) ----------
  const BETA = {
    P: [0.33, 1, 2, 4, 10, 20, 30, 40, 50, 60, 70],
    b: [1.07, 1, 0.97, 0.92, 0.86, 0.84, 0.77, 0.74, 0.72, 0.69, 0.67],
  };
  const T34 = {
    d: [
      0.05, 0.15, 0.5, 1, 1.5, 2.5, 4, 6, 8, 11, 15, 20, 25, 40, 60, 90, 140, 190, 250, 310, 370,
      450, 510, 750, 1000,
    ],
    y: [
      0.7, 0.7, 0.71, 0.71, 0.72, 0.72, 0.73, 0.74, 0.74, 0.75, 0.75, 0.76, 0.76, 0.77, 0.78, 0.78,
      0.79, 0.79, 0.8, 0.81, 0.81, 0.83, 0.83, 0.83, 0.84,
    ],
    g: [
      0.8, 0.83, 0.86, 0.88, 0.9, 0.93, 0.96, 0.98, 1.0, 1.04, 1.08, 1.12, 1.16, 1.2, 1.24, 1.28,
      1.34, 1.4, 1.46, 1.52, 1.58, 1.64, 1.71, 1.8, 1.89,
    ],
    yc: [
      0.66, 0.66, 0.67, 0.67, 0.67, 0.68, 0.68, 0.69, 0.69, 0.7, 0.7, 0.71, 0.71, 0.72, 0.72, 0.73,
      0.74, 0.74, 0.75, 0.75, 0.76, 0.76, 0.77, 0.78, 0.78,
    ],
  };
  const betaP = (P: number): number => interp(BETA.P, BETA.b, P);

  // ---------- xói cục bộ (Sổ tay 4.5) ----------
  const K1PIER: Record<string, number> = { vuong: 1.1, tron: 1.0, trutron: 1.0, nhomtru: 1.0, nhon: 0.9 };
  const K1ABUT: Record<string, number> = { dung: 1.0, canh: 0.82, xien: 0.55 };
  const csu = (
    K1: number,
    K2: number,
    K3: number,
    K4: number,
    a: number,
    y1: number,
    Fr: number,
  ): number => 2.0 * K1 * K2 * K3 * K4 * Math.pow(a, 0.65) * Math.pow(y1, 0.35) * Math.pow(Fr, 0.43);
  const froeh = (K1: number, K2: number, L: number, ya: number, Fr: number): number =>
    2.27 * K1 * K2 * Math.pow(L, 0.43) * Math.pow(ya, 0.57) * Math.pow(Fr, 0.61) + ya;

  return {
    lgam,
    phiP,
    xP,
    stats,
    phiA1,
    tauA2,
    apA3,
    qp,
    jls,
    secMake,
    geo,
    mu41,
    P42,
    B41,
    B42,
    smallBr,
    B8,
    b9,
    betaP,
    T34,
    interp,
    csu,
    froeh,
    K1PIER,
    K1ABUT,
    FG,
    delta6,
    nInv,
    gP,
    gPinv,
  };
})();

// ============================================================================
// 4. `HVKM` — Kritski–Menkel Frequency Factor Tables ([ST] Phụ lục 2-2)
// ============================================================================

export const HVKM: { P: number[]; T: HvKmEntry[] } = {
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
          11.5, 8.9, 7.85, 6.57, 5.0, 4.38, 3.63, 2.6, 2.2, 1.73, 1.32, 1.2, 1.1, 0.94, 0.82, 0.72,
          0.63, 0.58, 0.53, 0.43, 0.37, 0.33, 0.28, 0.25, 0.24, 0.21,
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
};

// ============================================================================
// 5. `HVM` — Multiple Hydrologic & Scour Formula Methods (17 Pier + 5 Abut)
// ============================================================================

export const HVM = (function () {
  const g = 9.81;
  const I1 = HV.interp;
  const cl = (x: number, a: number, b: number): number => Math.max(a, Math.min(b, x));

  // ---------- Kritski - Menkel: tra Phụ lục 2-2 [ST], nội suy theo Cv, Cs/Cv và P (P theo phân vị chuẩn) ----------
  const KMT = HVKM;
  function kmK(P: number, Cv: number, Cs: number): number {
    const r = Cs / Cv;
    const T = KMT.T;
    const zs = KMT.P.map((p) => HV.nInv(1 - p / 100));
    const z = HV.nInv(1 - P / 100);
    const atT = (t: HvKmEntry): number => {
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

  const kmRange = (Cv: number, Cs: number): { rOut: boolean; cvOut: boolean } => {
    const r = Cs / Cv;
    const T = KMT.T;
    return {
      rOut: r < T[0].r || r > T[T.length - 1].r,
      cvOut: Cv < 0.1 || (Cv > T[0].cv[T[0].cv.length - 1] && r < 1.5) || Cv > 1.2,
    };
  };

  function KP(dist: string, P: number, Cv: number, Cs: number): number {
    return dist === 'km' ? kmK(P, Cv, Cs) : 1 + HV.phiP(P, Cs) * Cv;
  }

  // ---------- phương pháp thích hợp: Cv, Cs để đường lý luận khớp nhất các điểm kinh nghiệm (tổng bình phương sai số nhỏ nhất) [ST] mục 2.2.1b bước 8 ----------
  function fit(st: HvStatsResult, dist: string): HvFitResult {
    const xs = st.emp;
    const m = st.mean;
    const err = (Cv: number, Cs: number): number =>
      xs.reduce((s, o) => {
        const k = KP(dist, o.P as number, Cv, Cs);
        return s + (m * k - o.x) ** 2;
      }, 0);
    let best = { Cv: st.Cv, Cs: st.Cs, e: err(st.Cv, st.Cs) };
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
    const rmse = Math.sqrt(best.e / xs.length);
    const rmse0 = Math.sqrt(err(st.Cv, st.Cs) / xs.length);
    return { ...best, rmse, rmse0 };
  }

  // ---------- Lưu lượng theo cường độ mưa giới hạn của ĐH Xây dựng Hà Nội ([ST] PT 2-25 - 2-27 ; [TKĐ3] PT 9-22 - 9-24) ----------
  const B28 = {
    i: [2, 5, 10, 30, 60, 80, 100, 400, 800],
    v: [15.4, 15.2, 14.7, 13.3, 12.0, 11.4, 10.8, 8.2, 7.6],
  };
  const B29 = {
    F: [
      0.0001, 0.001, 0.005, 0.01, 0.05, 0.1, 0.3, 0.5, 0.6, 1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 10, 15,
      30, 50, 60, 100, 300, 500, 1000, 10000, 100000,
    ],
    a: [
      0.98, 0.91, 0.86, 0.81, 0.75, 0.69, 0.66, 0.63, 0.62, 0.53, 0.5, 0.47, 0.44, 0.42, 0.4, 0.33,
      0.31, 0.27, 0.24, 0.22, 0.19, 0.16, 0.14, 0.12, 0.08, 0.05,
    ],
  };
  const LF = (x: number): number => Math.log(x);

  function psiA4(reg: string, t: number): number | null {
    const r = HVTAB.A4[reg];
    if (!r) return null;
    return I1(HVTAB.A4.t.map(LF), r, LF(cl(t, 10, 1440)));
  }

  function qDHXD(I: HvInput, Hp: number, phi: number, delta: number): HvDhxdResult {
    const Lsd = (1000 * I.F) / ((I.two ? 1.8 : 0.9) * (I.L + I.sl));
    const isd = I.Jsd / 10; // ‰ -> %
    const f = I1(B28.i.map(LF), B28.v, LF(cl(isd, 2, 800)));
    const tc = (f * Math.pow(Lsd, 0.4)) / Math.pow(100 * I.msd, 0.4);
    const psi = psiA4(I.reg, tc);
    const ap = ((psi as number) * Hp) / tc;
    const alpha = I1(B29.F.map(LF), B29.a, LF(I.F));
    const Q = 16.67 * ap * I.F * delta * phi * alpha;
    const tcOut = tc < 10 || tc > 1440;
    return { Lsd, isd, f, tc, psi, ap, alpha, phi, delta, Q, tcOut };
  }

  // ---------- Lưu lượng theo phương pháp hình thái - lũ lịch sử ([ST] PT 2-39, 2-40) ----------
  // fl: [{y,h,N,Q}] ; P mỗi trận = M/(N+1) (PT 2-6) ; Cv chọn để các trận thỏa KiQj = KjQi ; Cs = r.Cv
  function qHT(
    fl: HvHistFlood[],
    dist: string,
    ratio: number,
    Cv0: number,
    P: number,
  ): HvHtResult | null {
    const f = fl.filter((o) => o.N > 0 && (o.Q ?? 0) > 0).sort((a, b) => (b.Q as number) - (a.Q as number));
    if (!f.length) return null;
    f.forEach((o) => {
      o.M = 1;
      o.Pi = (100 * o.M) / (o.N + 1);
    });
    let Cv = Cv0;
    let fitted = false;
    if (f.length >= 2) {
      let best: { cv: number; e: number } | null = null;
      for (let cv = 0.05; cv <= 1.5; cv += 0.001) {
        const ks = f.map((o) => KP(dist, o.Pi as number, cv, ratio * cv));
        const qm = f.map((o, i) => (o.Q as number) / ks[i]);
        const mu = qm.reduce((s, x) => s + x, 0) / qm.length;
        const e = qm.reduce((s, x) => s + (x / mu - 1) ** 2, 0);
        if (!best || e < best.e) best = { cv, e };
      }
      Cv = (best as { cv: number; e: number }).cv;
      fitted = true;
    }
    if (!(Cv > 0)) return null;
    const Kp = KP(dist, P, Cv, ratio * Cv);
    const est = f.map((o) => {
      const Ki = KP(dist, o.Pi as number, Cv, ratio * Cv);
      return {
        ...o,
        Q: o.Q as number,
        M: o.M as number,
        Pi: o.Pi as number,
        Ki,
        Qp: ((o.Q as number) * Kp) / Ki,
      };
    });
    return {
      fl: est,
      Cv,
      Cs: ratio * Cv,
      Kp,
      fitted,
      Q: est.reduce((s, o) => s + o.Qp, 0) / est.length,
    };
  }

  // ---------- tốc độ cho phép không xói vox ([TKĐ3] Bảng 3-6, 3-7 ; [ST] Phụ lục 4-1 Bảng 1, 2) ----------
  const T36 = {
    d: [0.05, 1.0, 2.5, 5, 10, 15, 25, 40, 75, 100, 150, 200, 300, 400],
    r: [0.65, 0.65, 0.7, 0.85, 1.1, 1.2, 1.5, 1.7, 2.1, 2.35, 2.6, 2.95, 3.35, 3.7],
  };
  const T37: { h: number[]; v: Record<string, number[]> } = {
    h: [0.4, 1, 2, 3],
    v: {
      sa1: [0.35, 0.4, 0.45, 0.5],
      sa2: [0.7, 0.85, 0.95, 1.1],
      sa3: [1.0, 1.2, 1.4, 1.5],
      sa4: [1.4, 1.7, 1.9, 2.1],
      bo2: [0.6, 0.7, 0.8, 0.85],
      bo3: [0.8, 1.0, 1.2, 1.3],
      bo4: [1.1, 1.3, 1.5, 1.7],
    },
  };

  function vox(S: Pick<HvSoilProps, 'coh' | 'cty' | 'd50'>, h: number): number {
    if (S.coh) return I1(T37.h, T37.v[S.cty] || T37.v.sa2, cl(h, 0.4, 3));
    return Math.pow(Math.max(h, 0.01), 1 / 6) * I1(T36.d.map(LF), T36.r, LF(cl(S.d50, 0.05, 400)));
  }

  // độ thô thuỷ lực ω (cm/s) theo d (mm) [TKĐ3] Bảng 4-5
  const T45 = {
    d: [
      0.01, 0.03, 0.05, 0.08, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.8, 1.0, 1.5, 2.0, 2.5,
      3.0, 3.5, 4.0, 5.0, 7, 10, 15, 20, 25, 30, 40, 50, 60, 80, 100, 120, 140, 160, 180, 200, 250,
      300, 350, 400, 500,
    ],
    w: [
      0.007, 0.062, 0.178, 0.443, 0.692, 1.557, 2.16, 2.7, 3.21, 4.32, 5.4, 6.48, 8.07, 9.14, 12.6,
      15.3, 17.7, 19.3, 20.9, 22.3, 24.9, 29.7, 35.2, 43.0, 49.2, 54.8, 60.0, 68.9, 76.9, 84.2,
      96.9, 108, 119, 128, 137, 145, 152, 170, 186, 201, 215, 240,
    ],
  };
  const omega = (d: number): number => I1(T45.d.map(LF), T45.w, LF(cl(d, 0.01, 500))) / 100; // m/s

  // ---------- hệ số hình dạng trụ Kξ và chiều rộng tính toán B1 ([TKĐ3] Phụ lục 4: loại 3, 4, 5, 6) ----------
  function pierShape(t: string, B: number, L: number, al: number): { K: number; B1: number; type: string } {
    const s = Math.sin((al * Math.PI) / 180);
    const c = Math.cos((al * Math.PI) / 180);
    if (t === 'vuong') return { K: 12.4, B1: al > 0 ? L * s + B * c : B, type: '4 - mũi vuông' };
    if (t === 'nhon60' || t === 'nhon90' || t === 'nhon120') {
      return {
        K: ({ nhon60: 7.3, nhon90: 10.0, nhon120: 12.2 } as Record<string, number>)[t],
        B1: al > 0 ? (L - B) * s + B : B,
        type: '5 - mũi nhọn góc ' + t.slice(4) + '°',
      };
    }
    if (t === 'cot') return { K: 10.0, B1: B, type: '6 - trụ tròn (cột)' };
    return {
      K: I1([0, 10, 20, 30, 40], [8.5, 8.9, 9.0, 10.2, 11.3], cl(al, 0, 40)),
      B1: al > 0 ? (L - B) * s + B : B,
      type: '3 - mũi tròn',
    };
  }

  const CSUK1: Record<string, number> = { tron: 1.0, cot: 1.0, vuong: 1.1, nhon60: 0.9, nhon90: 0.9, nhon120: 0.9 };
  // Hình 4-4a [TKĐ3]: Kv theo v²/(gB1) (đọc từ đồ thị)
  const KVX = [0.001, 0.01, 0.05, 0.1, 0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const KVY = [
    0.9, 0.839, 0.788, 0.752, 0.586, 0.521, 0.411, 0.369, 0.34, 0.318, 0.296, 0.282, 0.269, 0.259,
    0.245,
  ];
  const Kv = (x: number): number => I1(KVX.map(LF), KVY, LF(cl(x, 0.001, 10)));

  // Hình 4-5 [TKĐ3]: f theo góc α và L/B (đọc từ đồ thị)
  const F45 = {
    a: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90],
    L: [3, 4, 6, 8, 12],
    f: [
      [0, 0.3, 0.6, 0.85, 1.0, 1.05, 1.0, 0.85, 0.6, 0.25],
      [0, 0.35, 0.8, 1.15, 1.45, 1.6, 1.65, 1.6, 1.55, 1.5],
      [0, 0.45, 1.0, 1.5, 1.9, 2.2, 2.35, 2.4, 2.4, 2.35],
      [0, 0.5, 1.2, 1.8, 2.3, 2.65, 2.85, 3.0, 3.05, 3.05],
      [0, 0.6, 1.5, 2.3, 3.0, 3.6, 4.1, 4.4, 4.6, 4.7],
    ],
  };
  const f45 = (al: number, LB: number): number => {
    const c = F45.f.map((r) => I1(F45.a, r, cl(al, 0, 90)));
    return I1(F45.L, c, cl(LB, 3, 12));
  };

  const Y43 = {
    r: [20, 40, 60, 80, 100, 200, 400, 600, 800, 1000, 2000],
    y: [0.198, 0.181, 0.173, 0.167, 0.163, 0.152, 0.143, 0.139, 0.137, 0.134, 0.125],
  };

  // ---------- xói cục bộ trụ: tất cả các công thức (17) ----------
  const PIER: Array<{
    k: string;
    n: string;
    src: string;
    f: (q: HvPierScourInput, S: HvSoilProps, X?: HvScourResult) => HvFormulaResult;
  }> = [
    {
      k: 'csu',
      n: 'CSU - Richardson (1990)',
      src: '[ST] mục 4.5.1, PT 4-9, 4-10; Bảng 4-5 - 4-8',
      f: (q, S) => {
        const K1 = q.al > 5 ? 1 : CSUK1[q.nose] || 1;
        const th = (q.al * Math.PI) / 180;
        const K2 = Math.pow(Math.cos(th) + (q.L / q.b) * Math.sin(th), 0.65);
        const K3 = 1.1;
        let K4 = 1;
        if (S.d50 >= 60 && S.d90 > 0) {
          const D50 = S.d50 / 1000;
          const D90 = S.d90 / 1000;
          const Vc50 = 6.19 * Math.pow(q.h, 1 / 6) * Math.pow(D50, 1 / 3);
          const Vc90 = 6.19 * Math.pow(q.h, 1 / 6) * Math.pow(D90, 1 / 3);
          const Vi = 0.645 * Math.pow(D50 / q.b, 0.053) * Vc50;
          const VR = (q.v - Vi) / (Vc90 - Vi);
          K4 = VR > 1 ? 1 : Math.max(0.7, Math.sqrt(Math.max(0, 1 - 0.89 * (1 - VR) ** 2)));
        }
        const Fr = q.v / Math.sqrt(g * q.h);
        const y =
          2.0 *
          K1 *
          K2 *
          K3 *
          K4 *
          Math.pow(q.b, 0.65) *
          Math.pow(q.h, 0.35) *
          Math.pow(Fr, 0.43);
        return {
          y,
          tex: 'y_{xcb}=2.0K_1K_2K_3K_4a^{0.65}y_1^{0.35}Fr_1^{0.43}',
          p: `K1 = ${fx(K1, 2)} ; K2 = ${fx(K2, 3)} ; K3 = 1,1 ; K4 = ${fx(K4, 3)} ; a = ${fx(q.b, 2)} ; y1 = ${fx(q.h, 3)} ; Fr1 = ${fx(Fr, 3)}`,
        };
      },
    },
    {
      k: 'dhxd',
      n: 'ĐH Xây dựng Hà Nội (Nguyễn Xuân Trục - Nguyễn Hữu Khải, 1982)',
      src: '[TKĐ3] mục 4.3, PT 4-1, 4-2; [ST] Phụ lục 4-1 mục 2a',
      f: (q, S) => {
        const Kd = 0.1 * q.Kx;
        const vo = vox(S, q.h);
        const r = q.v / vo;
        const y =
          r < 1
            ? 0.97 * Kd * Math.pow(q.B1, 0.83) * Math.pow(q.h, 0.17) * Math.pow(r, 1.04)
            : 0.52 * Kd * Math.pow(q.B1, 0.88) * Math.pow(q.h, 0.12) * Math.pow(r, 1.16);
        return {
          y,
          tex:
            r < 1
              ? 'h_{cb}=0.97K_d b^{0.83}h^{0.17}(v/v_{ox})^{1.04}'
              : 'h_{cb}=0.52K_d b^{0.88}h^{0.12}(v/v_{ox})^{1.16}',
          p: `Kd = 0,1Kξ = ${fx(Kd, 3)} ; b = ${fx(q.B1, 2)} ; h = ${fx(q.h, 3)} ; v = ${fx(q.v, 3)} ; vox = ${fx(vo, 3)} (${r < 1 ? 'v < vox: PT 4-1' : 'v ≥ vox: PT 4-2'})`,
        };
      },
    },
    {
      k: 'tdn',
      n: 'Trần Đình Nghiên',
      src: '[ST] Phụ lục 4-1 mục 2b',
      f: (q, S) => {
        const d = S.d50 / 1000;
        const w = omega(S.d50);
        const Vng = Math.cbrt(g * w * q.h) * Math.pow(q.h / d, 0.06);
        const Vo = 3.6 * Math.pow(q.h * d, 0.25);
        const tu = q.v > Vo && q.v / Vng > 1;
        const K = tu ? 1.11 : 1.24;
        const n = tu ? 1 : 0.77;
        const Ka = S.Ka ?? 1;
        const Kf = S.Kf ?? 1;
        const y = K * Math.sqrt(q.h * q.h2) * Math.pow(q.v / Vng, n) * Ka * Kf;
        return {
          y,
          tex: 'h_{cb}=K\\sqrt{h\\,h_x}\\,(V/V_{ng})^nK_\\alpha K_\\varphi\\ ;\\ V_{ng}=\\sqrt[3]{g\\omega h}\\,(h/d)^{0.06}\\ ;\\ V_o=3.6\\sqrt[4]{hd}',
          p: `ω = ${fx(w, 4)} m/s ; Vng = ${fx(Vng, 3)} ; Vo = ${fx(Vo, 3)} ; ${tu ? 'xói nước đục: K = 1,11, n = 1' : 'xói nước trong: K = 1,24, n = 0,77'} ; h = ${fx(q.h, 3)} ; hx = ${fx(q.h2, 3)} ; Kα = ${fx(Ka, 2)} ; Kφ = ${fx(Kf, 2)}`,
        };
      },
    },
    {
      k: 'zur',
      n: 'M.M. Zuravlev (Viện nghiên cứu đường bộ Liên Xô cũ)',
      src: '[TKĐ3] mục 4.4, PT 4-3, 4-4; Bảng 4-5',
      f: (q, S) => {
        const Kd = 0.1 * q.Kx;
        const w = omega(S.d50);
        const vB = Math.cbrt(g * w * q.h);
        const r = q.v / vB;
        const n = r > 1 ? 0.75 : 2 / 3;
        const y = Math.pow(q.B1, 2 / 3) * Math.pow(q.h, 3 / 5) * Math.pow(r, n) * Kd;
        return {
          y,
          tex: 'h_{cb}=b^{2/3}h^{3/5}\\left(\\dfrac{v}{v_B}\\right)^nK_d\\ ;\\ v_B=\\sqrt[3]{g\\omega h}',
          p: `Kd = ${fx(Kd, 3)} ; ω = ${fx(w, 4)} m/s ; vB = ${fx(vB, 3)} ; n = ${r > 1 ? '3/4' : '2/3'}`,
        };
      },
    },
    {
      k: 'lat',
      n: 'A.M. Latusenkov (1960)',
      src: '[TKĐ3] mục 4.4, PT 4-5, 4-6',
      f: (q, S) => {
        const Kd = 0.1 * q.Kx;
        const vo = vox(S, q.h);
        const y =
          q.v > 1.3 * vo
            ? 0.7 * Kd * Math.sqrt(q.B1 * vo)
            : 0.52 * Kd * q.v * Math.sqrt(q.B1 / vo);
        return {
          y,
          tex: q.v > 1.3 * vo ? 'h_{cb}=0.7K_d\\sqrt{b\\,v_{ox}}' : 'h_{cb}=0.52K_dv\\sqrt{b/v_{ox}}',
          p: `Kd = ${fx(Kd, 3)} ; vox = ${fx(vo, 3)} ; v ${q.v > 1.3 * vo ? '>' : '≤'} 1,3vox`,
        };
      },
    },
    {
      k: 'iar',
      n: 'I.A. Iaratslasev (1953)',
      src: '[TKĐ3] mục 4.5, PT 4-7, 4-8, Hình 4-4',
      f: (q, S) => {
        const kv = Kv((q.v * q.v) / (g * q.B1));
        const KH = Math.pow(10, 0.17 - (0.35 * q.h) / q.B1);
        const t = q.chu ? 0.6 : 1;
        const vo = vox(S, q.h);
        const tail = S.coh ? (6 * vo * vo) / g : (30 * S.d50) / 1000;
        const y = (q.Kx * kv * (KH + t) * q.v * q.v) / g - tail;
        return {
          y: Math.max(0, y),
          tex:
            'h_{cb}=K_\\xi K_v(K_H+t)\\dfrac{v^2}{g}-' +
            (S.coh ? '6\\dfrac{v_{ox}^2}{g}' : '30d') +
            '\\ ;\\ \\lg K_H=0.17-0.35H/B_1',
          p: `Kξ = ${fx(q.Kx, 2)} ; v²/(gB1) = ${fx((q.v * q.v) / (g * q.B1), 3)} ⇒ Kv = ${fx(kv, 3)} (Hình 4-4a) ; KH = ${fx(KH, 3)} ; t = ${t}`,
        };
      },
    },
    {
      k: 'bcn',
      n: 'Tiêu chuẩn BCN 62-69 (Liên Xô cũ)',
      src: '[TKĐ3] mục 4.6, PT 4-9 - 4-17; Bảng 4-3 - 4-5; Hình 4-5',
      f: (q, S) => {
        const Kd = q.Kx / 10;
        const x = 0.18 * Math.pow(q.B1 / q.h, 0.867);
        const K =
          q.al <= 10
            ? 1
            : 1 +
              (1.22 - 1.22 / Math.sqrt(Math.pow(q.h / q.B1 + 0.75, 3))) * f45(q.al, q.L / q.B1);
        if (S.coh) {
          const vo = vox(S, q.h);
          const dtd = (5.95 * Math.pow(vo, 4)) / q.h;
          const w = omega(dtd);
          const y =
            ((6.2 * q.h) / Math.pow(vo / w, x)) *
            Math.pow(Math.max(0, (2 * q.v) / vo - 1), 0.75) *
            Kd *
            K;
          return {
            y,
            tex: 'h_{cb}=\\dfrac{6.2H}{(v_{ox}/\\omega)^x}\\left(2\\dfrac{v}{v_{ox}}-1\\right)^{0.75}K_dK\\ ;\\ d_{td}=\\dfrac{5.95}{H}v_{ox}^4',
            p: `đất dính (PT 4-17, 4-19): vox = ${fx(vo, 3)} ; dtđ = ${fx(dtd, 3)} mm ; ω = ${fx(w, 4)} ; x = ${fx(x, 4)} ; Kd = ${fx(Kd, 3)} ; K = ${fx(K, 3)}`,
          };
        }
        const d = S.d50 / 1000;
        const w = omega(S.d50);
        const vo = 3.6 * Math.pow(q.h * d, 0.25);
        const h0 = (6.2 * x * q.h) / Math.pow(vo / w, x);
        if (q.v > vo) {
          const y = (h0 + ((0.014 * (q.v - vo)) / w) * q.B1) * Kd * K;
          return {
            y,
            tex: 'h_{cb}=\\left(h_o+0.014\\dfrac{v-v_{ox}}{\\omega}b\\right)K_dK\\ ;\\ h_o=\\dfrac{6.2xH}{(v_{ox}/\\omega)^x}\\ ;\\ v_{ox}=3.6\\sqrt[4]{hd}',
            p: `dòng nước đục (v > vox): vox = ${fx(vo, 3)} ; ω = ${fx(w, 4)} ; x = 0,18(b/H)^0,867 = ${fx(x, 4)} ; ho = ${fx(h0, 3)} ; Kd = Kξ/10 = ${fx(Kd, 3)} ; K = ${fx(K, 3)}`,
          };
        }
        const yy = I1(Y43.r.map(LF), Y43.y, LF(cl(q.h / d, 20, 2000)));
        const vH = vo * Math.pow(d / q.h, yy);
        const y = q.v > vH ? h0 * Math.pow((q.v - vH) / (vo - vH), 0.75) * Kd * K : 0;
        return {
          y,
          tex: 'h_{cb}=h_o\\left(\\dfrac{v-v_H}{v_{ox}-v_H}\\right)^{3/4}K_dK\\ ;\\ v_H=v_{ox}\\left(\\dfrac{d}{h}\\right)^y',
          p: `dòng nước trong (v ≤ vox): vox = ${fx(vo, 3)} ; y = ${fx(yy, 3)} (Bảng 4-3) ; vH = ${fx(vH, 3)} ; ho = ${fx(h0, 3)} ; Kd = ${fx(Kd, 3)} ; K = ${fx(K, 3)}`,
        };
      },
    },
    {
      k: 'lau2',
      n: 'E.M. Laursen (theo TKĐ3)',
      src: '[TKĐ3] mục 4.6.3, PT 4-20',
      f: (q) => ({
        y: 1.5 * 0.1 * q.Kx * q.B1 * Math.pow(q.h / q.B1, 0.35),
        tex: 'h_{cb}=1.5K_db(H/b)^{0.35}',
        p: `Kd = ${fx(0.1 * q.Kx, 3)}`,
      }),
    },
    {
      k: 'nein',
      n: 'Nein',
      src: '[TKĐ3] mục 4.6.3, PT 4-21',
      f: (q) => ({
        y: 0.1 * q.Kx * q.B1,
        tex: 'h_{cb}=K_dB',
        p: `Kd = ${fx(0.1 * q.Kx, 3)}`,
      }),
    },
    {
      k: 'ind',
      n: 'Ấn Độ - Pakistan',
      src: '[TKĐ3] mục 4.6.3, PT 4-22',
      f: (q) => ({
        y: 0.565 * 0.1 * q.Kx * Math.pow(q.h * q.v, 0.25) * Math.pow(q.B1, 0.22),
        tex: 'h_{cb}=0.565K_d(HV)^{0.25}B^{0.22}',
        p: `Kd = ${fx(0.1 * q.Kx, 3)}`,
      }),
    },
    {
      k: 'lara',
      n: 'Z. Lara',
      src: '[TKĐ3] mục 4.6.3',
      f: (q) => ({
        y: 3.33 * 0.1 * q.Kx * Math.pow(q.B1, 0.75),
        tex: 'h_{cb}=3.33K_dB^{0.75}',
        p: `Kd = ${fx(0.1 * q.Kx, 3)}`,
      }),
    },
    {
      k: 'khu',
      n: 'S. Khunko',
      src: '[TKĐ3] mục 4.6.3, PT 4-23, 4-24',
      f: (q, S) => {
        const vo = vox(S, q.h);
        const Kd = 0.1 * q.Kx;
        const c = Math.cbrt((vo * vo) / (g * q.B1));
        const y =
          q.v > vo
            ? 2.42 * q.B1 * Kd * c
            : 2.42 * q.B1 * Kd * Math.max(0, (2 * q.v) / vo - 1) * c;
        return {
          y,
          tex:
            q.v > vo
              ? 'h_{cb}=2.42bK_d\\left(\\dfrac{v_{ox}^2}{gb}\\right)^{1/3}'
              : 'h_{cb}=2.42bK_d\\left(\\dfrac{2v}{v_{ox}}-1\\right)\\left(\\dfrac{v_{ox}^2}{gb}\\right)^{1/3}',
          p: `vox = ${fx(vo, 3)} ; Kd = ${fx(Kd, 3)}`,
        };
      },
    },
    {
      k: 'shen1',
      n: 'Shen I (nước trong, đáy cát)',
      src: '[ST] Phụ lục 4-1, Bảng 3',
      f: (q) => ({
        y: 1.17 * Math.pow(q.v, 0.62) * Math.pow(q.b, 0.62),
        tex: 'h_{xcb}=1.17U_o^{0.62}b^{0.62}',
        p: '',
      }),
    },
    {
      k: 'shen2',
      n: 'Shen II (mang bùn cát, đáy cát, Fr > 0,5)',
      src: '[ST] Phụ lục 4-1, Bảng 3',
      f: (q) => ({
        y: 1.59 * Math.pow(q.v, 0.67) * Math.pow(q.b, 0.67),
        tex: 'h_{xcb}=1.59U_o^{0.67}b^{0.67}',
        p: `Fr = ${fx(q.v / Math.sqrt(g * q.h), 3)}`,
      }),
    },
    {
      k: 'lau3',
      n: 'Laursen (mang bùn cát, đáy cát, Fr < 0,5)',
      src: '[ST] Phụ lục 4-1, Bảng 3',
      f: (q) => ({
        y: 1.11 * Math.sqrt(q.h * q.b),
        tex: 'h_{xcb}=1.11y_o^{0.5}b^{0.5}',
        p: `Fr = ${fx(q.v / Math.sqrt(g * q.h), 3)}`,
      }),
    },
    {
      k: 'blench',
      n: 'Blench (đáy cát 0,001 < D50 < 0,004 m, Fr < 0,3)',
      src: '[ST] Phụ lục 4-1, Bảng 3',
      f: (q) => ({
        y: Math.max(0, 1.8 * Math.pow(q.h, 0.75) * Math.pow(q.b, 0.25) - q.h),
        tex: 'h_{xcb}=1.8y_o^{0.75}b^{0.25}-y_o',
        p: '',
      }),
    },
    {
      k: 'dinh',
      n: 'Đất dính - theo hình dạng trụ',
      src: '[ST] Phụ lục 4-1, Bảng 4',
      f: (q) => {
        const k = ({ tron: 1.5, cot: 1.5, vuong: 2.0 } as Record<string, number>)[q.nose] || 1.5;
        return {
          y: k * q.b,
          tex: 'h_{xcb}=k\\,b',
          p: `k = ${fx(k, 1)} (${q.nose === 'vuong' ? 'chữ nhật' : 'tròn / mũi nửa tròn'}, mặt trụ thẳng đứng)`,
        };
      },
    },
  ];

  // ---------- xói cục bộ mố (5 công thức) ----------
  const ABUT: Array<{
    k: string;
    n: string;
    src: string;
    f: (a: HvAbutScourInput, S: HvAbutSoilProps) => HvFormulaResult;
  }> = [
    {
      k: 'fro',
      n: 'Froehlich',
      src: '[ST] mục 4.5.2a, PT 4-15; Bảng 4-9',
      f: (a, S) => {
        const K1 = ({ dung: 1.0, canh: 0.82, xien: 0.55 } as Record<string, number>)[S.abut] || 1;
        const K2 = Math.pow(S.tha / 90, 0.13);
        const y =
          2.27 * K1 * K2 * Math.pow(a.Lp, 0.43) * Math.pow(a.ya, 0.57) * Math.pow(a.Fr, 0.61) +
          a.ya;
        return {
          y,
          tex: "y_x=2.27K_1K_2(L')^{0.43}y_a^{0.57}Fr^{0.61}+y_a",
          p: `K1 = ${fx(K1, 2)} ; K2 = (θ/90)^0,13 = ${fx(K2, 3)} ; L' = ${fx(a.Lp, 2)} ; ya = ${fx(a.ya, 3)} ; Fr = ${fx(a.Fr, 3)}`,
        };
      },
    },
    {
      k: 'hire',
      n: "HIRE (L'/y1 > 25)",
      src: '[ST] mục 4.5.2b',
      f: (a, S) => {
        const K1 = ({ dung: 1.0, canh: 0.82, xien: 0.55 } as Record<string, number>)[S.abut] || 1;
        const K2 = Math.pow(S.tha / 90, 0.13);
        const av = a.v ?? a.Vc;
        const Fr = av / Math.sqrt(g * a.h1);
        const y = 4 * a.h1 * (K1 / 0.55) * Math.pow(Fr, 0.33) * K2;
        return {
          y,
          tex: 'y_x=4y_1\\dfrac{K_1}{0.55}Fr^{0.33}K_2',
          p: `y1 = ${fx(a.h1, 3)} ; Fr = ${fx(Fr, 3)} ; K1 = ${fx(K1, 2)} ; K2 = ${fx(K2, 3)} ; L'/y1 = ${fx(a.Lp / a.h1, 1)}`,
        };
      },
    },
    {
      k: 'tdn',
      n: 'Trần Đình Nghiên',
      src: '[ST] Phụ lục 4-1 mục 2b',
      f: (a, S) => {
        const r = a.Lp / a.h1;
        const t = S.abn;
        let y: number;
        let tex: string;
        if (t === 'vuong') {
          y = 1.38 * a.h1 * Math.pow(r, 0.63);
          tex = 'h_c=1.38h_{th}(L_m/h_{th})^{0.63}';
        } else if (t === 'tron') {
          y = 1.18 * a.h1 * Math.pow(r, 0.52);
          tex = 'h_c=1.18h_{th}(L_m/h_{th})^{0.52}';
        } else if (t === 'canh') {
          if (r <= 20) {
            y = 1.03 * a.h1 * Math.pow(r, 0.59);
            tex = 'h_c=1.03h_{th}(L_m/h_{th})^{0.59}';
          } else {
            y = 0.078 * a.h1 * r + 4.26;
            tex = 'h_c=0.078h_{th}(L_m/h_{th})+4.26';
          }
        } else {
          y = 0.25 * a.h1 * r + 0.64;
          tex = 'h_c=0.25h_{th}(L_m/h_{th})+0.64';
        }
        return {
          y,
          tex,
          p: `hth = ${fx(a.h1, 3)} ; Lm = ${fx(a.Lp, 2)} ; Lm/hth = ${fx(r, 2)} ; dạng mố: ${({ vuong: 'thẳng đứng vuông đầu', tron: 'thẳng đứng tròn đầu', canh: 'tường cánh', non: 'có 1/4 nón' } as Record<string, string>)[t]}`,
        };
      },
    },
    {
      k: 'iar',
      n: 'I.I. Iaratslasev (đầu kè, 1/4 nón mố)',
      src: '[TKĐ3] mục 4.9.1 PT 4-25; mục 6.7 PT 6-18',
      f: (a, S) => {
        const vo = vox(S, a.h1);
        const al = a.al || 90;
        const av = a.v ?? a.Vc;
        const y =
          (23 * av * av * Math.tan((al * Math.PI) / 360)) / (g * Math.sqrt(1 + S.mta * S.mta)) -
          (S.coh ? (6 * vo * vo) / g : (30 * S.d50) / 1000);
        return {
          y: Math.max(0, y),
          tex:
            'h_{cb}=\\dfrac{23v_c^2\\,tg\\frac{\\alpha}{2}}{g\\sqrt{1+m^2}}-' +
            (S.coh ? '6\\dfrac{v_{ox}^2}{g}' : '30d'),
          p: `m = ${fx(S.mta, 2)} ; α = ${fx(al, 0)}° (góc giữa hướng dòng chảy và pháp tuyến 1/4 nón) ; vc = ${fx(av, 3)} m/s - tốc độ bình quân dưới cầu trước xói`,
        };
      },
    },
    {
      k: 'khong',
      n: 'Không xét xói cục bộ mố (mố đặt trên bãi, không choán dòng chủ)',
      src: '',
      f: () => ({ y: 0, tex: '', p: '' }),
    },
  ];

  return {
    kmK,
    kmRange,
    KP,
    fit,
    qDHXD,
    psiA4,
    qHT,
    vox,
    omega,
    pierShape,
    PIER,
    ABUT,
    Kv,
    f45,
    B28,
    B29,
  };
})();

// ============================================================================
// 6. Bridge Hydrology Input, Hydraulics, Opening, Backwater & Scour Solvers
// ============================================================================

export let HVR: HvCalcResult | null = null;

export function getLatestHvResult(): HvCalcResult | null {
  return HVR;
}

export function setLatestHvResult(result: HvCalcResult | null): void {
  HVR = result;
}

export function toBridgeHydrologyResult(R: HvCalcResult): HydrologyResult {
  const qMap: HydrologyResult['Q'] = {};
  for (const [k, entry] of Object.entries(R.Q || {})) {
    const P = Number(k);
    qMap[P] = {
      Q: entry.Q,
      ...(Number.isFinite(entry.Hp) ? { Hp: entry.Hp } : {}),
      ...(entry.t ? { phi: entry.t.phi, Ap: entry.t.Ap } : {}),
    };
  }
  const qsrc: HydrologyResult['qsrc'] = R.TL
    ? 'tl'
    : R.I.qm === 'dhxd'
      ? 'dhxd'
      : R.I.qm === 'ht'
        ? 'ht'
        : 'rain';
  return {
    mode: 'bridge',
    station: R.I.st,
    P: R.Pd,
    Px: R.Px,
    qsrc,
    ...(R.st
      ? {
          stats: {
            n: R.st.n,
            mean: R.st.mean,
            Cv: R.Cv,
            Cs: R.Cs,
            csOK: R.st.csOK,
          },
        }
      : {}),
    Q: qMap,
    H: { ...R.H },
    ...(R.X
      ? {
          scour: {
            P: R.X.P,
            Q: R.X.Q,
            H: R.X.H,
            generalEg: R.X.elG,
            maxGeneralDepth: R.X.vmax ? R.X.vmax.dx : 0,
            piers: R.X.piers.map((q) => ({
              ys: q.ys,
              el: q.el,
              method: q.cur ? q.cur.k : '',
            })),
            abut: R.X.abut.map((a) => ({
              n: a.n,
              ys: a.ys,
              el: a.el,
              mode: a.cur ? a.cur.k : a.mode,
            })),
          },
        }
      : {}),
  };
}

// lý trình dạng Km1+234.56 hoặc 1+234.56 -> m
export function hvKm(val: string | number | null | undefined): number {
  const t = String(val == null ? '' : val)
    .trim()
    .replace(/,/g, '.');
  const m = t.match(/^(?:km\s*)?(\d+)\s*\+\s*(\d+(?:\.\d+)?)$/i);
  if (m) return +m[1] * 1000 + +m[2];
  const x = parseFloat(t.replace(/^km\s*/i, ''));
  return isFinite(x) ? x : NaN;
}

export function hvKmF(x: number): string {
  if (!isFinite(x)) return '';
  const k = Math.floor(x / 1000 + 1e-9);
  const r = x - 1000 * k;
  return 'Km' + k + '+' + (r < 10 ? '00' : r < 100 ? '0' : '') + r.toFixed(2);
}

// mặt cắt dài (cả tuyến): chỉ lấy đoạn liên tục quanh lạch sâu dưới cầu, giới hạn tới điểm đầu tiên hai bên cao hơn mực nước lũ điều tra lớn nhất 1,5 m
export function hvSecTrim(
  P: Point2D[],
  o: { rng: number[] | null; lv: number[]; x1: number; x2: number },
): HvSecTrimResult {
  P = P.slice().sort((a, b) => a[0] - b[0]);
  const r: HvSecTrimResult = { pts: P, cut: false };
  if (P.length < 3) return r;
  const R2 = o.rng;
  if (R2 && isFinite(R2[0]) && isFinite(R2[1]) && R2[1] > R2[0]) {
    const q = P.filter((p) => p[0] >= R2[0] - 1e-6 && p[0] <= R2[1] + 1e-6);
    if (q.length >= 3) {
      return { pts: q, cut: q.length < P.length, a: q[0][0], b: q[q.length - 1][0], man: true };
    }
  }
  const zs = o.lv.filter(isFinite);
  if (!zs.length) return r;
  const Zc = Math.max(...zs) + 1.5;
  let it = -1;
  if (isFinite(o.x1) && isFinite(o.x2) && o.x2 > o.x1) {
    P.forEach((p, i) => {
      if (p[0] >= o.x1 && p[0] <= o.x2 && (it < 0 || p[1] < P[it][1])) it = i;
    });
  }
  if (it < 0) it = P.map((p) => p[1]).indexOf(Math.min(...P.map((p) => p[1])));
  let a = it;
  while (a > 0 && !(P[a][1] >= Zc && a < it && !(isFinite(o.x1) && P[a][0] > o.x1))) a--;
  let b = it;
  while (b < P.length - 1 && !(P[b][1] >= Zc && b > it && !(isFinite(o.x2) && P[b][0] < o.x2))) b++;
  if (a === 0 && b === P.length - 1) return r;
  const q = P.slice(a, b + 1);
  return { pts: q, cut: true, a: q[0][0], b: q[q.length - 1][0], Zc };
}

export function hvPairs(txt: string | null | undefined): number[][] {
  return String(txt || '')
    .split(/\r?\n/)
    .map((l) => {
      l = l
        .trim()
        .replace(/(?<![\d.])(?:km\s*)?(\d+)\+(\d+(?:[.,]\d+)?)/gi, (_m, a, b) =>
          String(+a * 1000 + +b.replace(',', '.')),
        );
      l = /\d\.\d/.test(l) ? l.replace(/,/g, ' ') : l.replace(/,/g, '.');
      return l
        .split(/[\s;\t]+/)
        .filter(Boolean)
        .map(Number);
    })
    .filter((a) => a.length >= 2 && a.every(isFinite));
}

// Bảng tra A.1..T.30 tần suất lũ thiết kế cầu theo TCVN 4054:2005 Bảng 30
export function hvPBang(): HvPBangResult {
  const rv = (x: string): number => parseFloat(String(($('hv_' + x) || {}).value || '').replace(',', '.'));
  const pm = ($('hv_P') || {}).value || 'auto';
  const cap = ($('hv_capd') || {}).value || '36';
  const pw = hvPairs(($('hv_piers') || {}).value || '').reduce((a, q) => a + (q[1] || 0), 0);
  const Lc = rv('xA2') - rv('xA1') - pw;
  const loai = !isFinite(Lc) ? '' : Lc >= 100 ? 'cầu lớn' : Lc >= 25 ? 'cầu trung' : 'cầu nhỏ';
  const capN =
    ({ ct: 'đường cao tốc', 12: 'đường cấp I, II', 36: 'đường cấp III đến VI' } as Record<string, string>)[
      cap
    ] || 'đường cấp III đến VI';
  const Pt =
    loai === 'cầu nhỏ' ? ({ ct: 1, 12: 2, 36: 4 } as Record<string, number>)[cap] ?? 4 : 1;
  const P = pm === 'auto' ? Pt : +pm;
  return { P, Pt, Lc, loai, capN, auto: pm === 'auto' };
}

export function hvPInfo(): void {
  const e = $('hv_Pinfo');
  if (!e) return;
  const B = hvPBang();
  const txt = isFinite(B.Lc)
    ? `Khẩu độ tĩnh không thoát nước Lc = ${hvF(B.Lc, 2)} m (xA2 - xA1 trừ bề rộng trụ) → ${B.loai} (TCVN 4054:2005 Bảng 30, chú thích 4: cầu lớn Lc ≥ 100 m, cầu trung 25 m ≤ Lc < 100 m, cầu nhỏ Lc < 25 m); ${B.capN} → tần suất theo Bảng 30 P = ${B.Pt}%` +
      (B.auto ? '.' : `; đang chọn P = ${B.P}%.`)
    : 'Nhập lý trình mép trong hai mố để xác định loại cầu.';
  e.textContent = txt;
  if (e.style) e.style.color = !B.auto && B.P > B.Pt ? '#c00000' : '#555';
}

// ranh giới lòng chủ - bãi theo mặt cắt ngang: mép bờ (điểm gãy độ dốc) hoặc giao điểm mực nước đặc trưng
export function hvXLR(
  P: Point2D[],
  mnk: string,
  mode: string,
  xL0: number,
  xR0: number,
  xa: number,
  xb: number,
): { xL: number; xR: number; xlm: string } {
  const out = { xL: xL0, xR: xR0, xlm: mode };
  const e = $('hv_xlInfo');
  if (!P || P.length < 3) {
    if (e) e.textContent = '';
    return out;
  }
  P = P.slice().sort((a, b) => a[0] - b[0]);
  const zs = P.map((p) => p[1]);
  const f = (val: number): string => (+val).toFixed(2);
  let it = -1;
  if (isFinite(xa) && isFinite(xb) && xb > xa) {
    P.forEach((p, i) => {
      if (p[0] >= xa && p[0] <= xb && (it < 0 || p[1] < P[it][1])) it = i;
    });
  }
  if (it < 0) it = zs.indexOf(Math.min(...zs));
  const bank = (dir: number): number => {
    for (let i = it + dir; i + dir >= 0 && i + dir < P.length; i += dir) {
      const a = P[i - dir];
      const b = P[i];
      const c = P[i + dir];
      const s1 = (b[1] - a[1]) / Math.abs(b[0] - a[0] || 1e-9);
      const s2 = (c[1] - b[1]) / Math.abs(c[0] - b[0] || 1e-9);
      if (s1 > 0 && s2 < 0.85 * s1) return b[0];
    }
    return P[dir < 0 ? 0 : P.length - 1][0];
  };
  const cut = (dir: number, Z: number): number => {
    for (let i = it; i + dir >= 0 && i + dir < P.length; i += dir) {
      const a = P[i];
      const b = P[i + dir];
      if (b[1] >= Z) return a[0] + ((Z - a[1]) * (b[0] - a[0])) / (b[1] - a[1]);
    }
    return P[dir < 0 ? 0 : P.length - 1][0];
  };
  const mn = String(mnk || '')
    .split(/\r?\n/)
    .map((l) => l.trim().match(/^(.*?)[\s:=]+\+?(-?\d+(?:[.,]\d+)?)\s*m?$/))
    .filter((m): m is RegExpMatchArray => Boolean(m))
    .map((m) => ({ n: m[1].trim(), v: +m[2].replace(',', '.') }));
  const lv =
    mn.find((q) => /^MNLTBHN/i.test(q.n.replace(/\s/g, ''))) ||
    mn.find((q) => /^MNTX/i.test(q.n.replace(/\s/g, '')));
  const b1 = bank(-1);
  const b2 = bank(1);
  const m1 = lv ? cut(-1, lv.v) : NaN;
  const m2 = lv ? cut(1, lv.v) : NaN;
  if (mode === 'bank') {
    out.xL = b1;
    out.xR = b2;
  } else if (mode === 'mn' && lv) {
    out.xL = m1;
    out.xR = m2;
  }
  if (mode !== 'tay') {
    const a = $('hv_xL');
    const b = $('hv_xR');
    const activeEl = typeof document !== 'undefined' ? document.activeElement : null;
    if (a && activeEl !== (a as unknown)) a.value = f(out.xL);
    if (b && activeEl !== (b as unknown)) b.value = f(out.xR);
  }
  if (e) {
    e.textContent =
      `Mép bờ lòng suối: ${f(b1)} - ${f(b2)} m (rộng ${f(b2 - b1)} m)` +
      (lv
        ? ` ; giao điểm ${lv.n} = ${f(lv.v)} m: ${f(m1)} - ${f(m2)} m (rộng ${f(m2 - m1)} m)`
        : ' ; chưa nhập MNLTBHN/MNTX') +
      (mode === 'mn' && !lv ? ' - không có mực nước đặc trưng, giữ giá trị đang nhập.' : '.');
  }
  return out;
}

export function hvIn(): HvInput {
  const g = (id: string): string => {
    const e = $('hv_' + id);
    return e ? e.value : '';
  };
  const n = (id: string): number => {
    const val = parseFloat(String(g(id)).replace(',', '.'));
    return isFinite(val) ? val : NaN;
  };
  const nk = (id: string): number => hvKm(g(id));

  const ST = hvSecTrim(
    hvPairs(g('sec')).map((a) => [a[0], a[1]] as Point2D),
    {
      x1: nk('xA1'),
      x2: nk('xA2'),
      rng: String(g('secR')).trim()
        ? String(g('secR'))
            .trim()
            .split(/\s*(?:-|–|;|\s)\s*(?=(?:km)?\d)/i)
            .map(hvKm)
        : null,
      lv: hvPairs(g('hist'))
        .map((a) => a[1])
        .concat([n('MNHT')]),
    },
  );
  const PB = hvPBang();
  const dE = n('dE');
  const dN = n('dN');
  const regAutoLookup = (): ReturnType<typeof hvRegAuto> =>
    isFinite(dE) && isFinite(dN)
      ? hvRegAuto({
          E: dE,
          N: dN,
          dcs: g('dcs') || 'vn',
          dk0: isFinite(n('dk0')) ? n('dk0') : 105,
        })
      : hvRegAuto();

  const I: HvInput = {
    P: PB.P,
    PB,
    capd: g('capd'),
    Pwhy: g('Pwhy'),
    Px: g('pxm') === 'u' ? n('Px') : PB.P,
    pxm: g('pxm'),
    Pa: n('Pa'),
    st: g('st') === 'khac' ? g('stn').trim() || 'Trạm khác' : g('st'),
    stvt: g('stvt').trim(),
    lv: g('lv').trim(),
    stWhy: g('stWhy').trim(),
    rs: g('rs'),
    rain: hvPairs(g('rain')).map((a) => ({ y: a[0], x: a[1] })),
    Csu: n('Csu'),
    Xm: n('Xm'),
    Cvp: n('Cvp'),
    Csp: n('Csp'),
    rm: g('rm'),
    rd: g('rd'),
    F: n('F'),
    L: n('L'),
    sl: n('sl') || 0,
    two: g('two') === '2',
    jm: g('jm'),
    Jls: n('Jls'),
    prof: hvPairs(g('prof')),
    Jsd: n('Jsd'),
    msd: n('msd'),
    mls: n('mls'),
    noCh: g('noCh') === '1',
    cls: g('cls'),
    phiCol: g('phc') === '' ? null : +g('phc'),
    reg: (() => {
      const A0 = g('regm') === 'tay' ? null : regAutoLookup();
      const A = A0 && !A0.near ? A0 : null;
      const e = $('hv_regInfo');
      if (e) {
        e.textContent =
          g('regm') === 'tay'
            ? ''
            : A0
              ? `Vị trí công trình (${A0.lon.toFixed(4)}°E ; ${A0.lat.toFixed(4)}°N) thuộc vùng mưa ${A0.z} trên Bản đồ phân vùng mưa rào Việt Nam (Sổ tay Phụ lục 2-3), cách ranh giới vùng ${A0.bl} khoảng ${A0.dm.toFixed(1)} km` +
                (A0.near
                  ? ': sát ranh giới, bản đồ tỷ lệ 1:7.000.000 không đủ chính xác để phân định - dùng vùng mưa chọn ở trên.'
                  : '.')
              : 'Chưa có tọa độ công trình (phần khoanh lưu vực) hoặc vị trí ngoài phạm vi bản đồ đã số hóa (Thanh Hóa): dùng vùng mưa chọn ở trên.';
      }
      if (A) {
        const r = $('hv_reg');
        if (r) r.value = A.z;
      }
      return A ? A.z : g('reg');
    })(),
    regAuto: (() => {
      const A = g('regm') === 'tay' ? null : regAutoLookup();
      return !!(A && !A.near);
    })(),
    fao: n('fao') || 0,
    aoPos: g('aoPos'),
    qm: g('qm'),
    htr: n('htr'),
    sec: ST.pts,
    secT: ST,
    ...hvXLR(ST.pts, g('mnk'), g('xlm') || 'bank', nk('xL'), nk('xR'), nk('xA1'), nk('xA2')),
    hf: g('hf'),
    nch: n('nch'),
    nb: n('nb'),
    gch: n('gch'),
    gb: n('gb'),
    i: n('i') / 1000,
    hist: hvPairs(g('hist')).map((a) => ({ y: a[0], h: a[1], N: a[2] || 0 })),
    MNHT: n('MNHT'),
    tcOn: g('tcOn'),
    dTC: n('dTC') || 0,
    tcm: g('tcm'),
    xA1: nk('xA1'),
    xA2: nk('xA2'),
    pier: hvPairs(g('piers')).map((a) => ({ x: a[0], a: a[1], L: a[2] || a[1] })),
    nose: g('nose'),
    mty: g('mty'),
    pty: g('pty'),
    th: n('th') || 0,
    abut: g('abut'),
    abn: g('abn'),
    tha: n('tha') || 90,
    mta: n('mta') || 1.5,
    LpL: n('LpL'),
    LpR: n('LpR'),
    lpm: g('lpm') || 'non',
    sdn: (g('sdn') || '').trim(),
    km: g('km') === 'auto' ? (isFinite(PB.Lc) && PB.Lc <= 10 ? 'nho' : 'bel') : g('km'),
    kmAuto: g('km') === 'auto',
    Pt: g('Pt'),
    lxm: g('lxm') || 'max',
    v0m: g('v0m') || 'cau',
    mum: g('mum') || '1',
    qsrc: g('qsrc') || 'tcvn',
    qtl: hvPairs(g('qtl'))
      .filter((a) => a.length >= 2 && a[0] > 0 && a[1] > 0)
      .sort((a, b) => a[0] - b[0]),
    qtlsrc: (g('qtlsrc') || '').trim(),
    bctm: g('bctm') || 'htb',
    dzcp: n('dzcp'),
    Qcong: n('Qcong') || 0,
    wlst: g('wlst') || '',
    wlser: hvPairs(g('wlser'))
      .filter((a) => a.length >= 2)
      .map((a) => ({ y: a[0], x: a[1] })),
    wlday: hvPairs(g('wlday')).filter((a) => a.length >= 2),
    m: n('m'),
    Vcp: n('Vcp'),
    zm: g('zm'),
    etm: g('etm') || '0.05',
    soil: g('soil'),
    coh: g('coh') === '1',
    cty: g('cty'),
    d50: n('d50'),
    gd: n('gd'),
    d90: n('d90'),
    xm: g('xm'),
    pm: g('pm'),
    am: g('am'),
    Ka: n('Ka') || 1,
    Kf: n('Kf') || 1,
    dlt: n('dlt') || 0,
    ELdd: n('ELdd'),
    ELkg: n('ELkg'),
    vt: g('vt') === '1',
    lnk: g('lnk') === '1',
  };

  (
    [
      ['km', 'bel'],
      ['zm', 's1'],
      ['xm', 'lis'],
      ['pm', 'dhxd'],
      ['am', 'tdn'],
    ] as const
  ).forEach(([k, d]) => {
    I[k + 'All'] = g(k) === 'all';
    if (I[k + 'All']) I[k] = d;
  });

  return I;
}

// ---------- hình học dưới cầu ----------
export function hvZ(S: HvSecModel): (x: number) => number {
  return (x: number): number => {
    const p = S.pts;
    if (x <= p[0][0]) return p[0][1];
    for (let i = 1; i < p.length; i++) {
      if (x <= p[i][0]) {
        return (
          p[i - 1][1] + ((p[i][1] - p[i - 1][1]) * (x - p[i - 1][0])) / (p[i][0] - p[i - 1][0])
        );
      }
    }
    return p[p.length - 1][1];
  };
}

export function hvOpen(S: HvSecModel, I: HvInput, H: number): HvOpeningSnapshot {
  const G = HV.geo(S.pts, H, I.xA1, I.xA2);
  const zAt = hvZ(S);
  let Ap = 0;
  let Bp = 0;
  I.pier.forEach((q) => {
    const h = Math.max(0, H - zAt(q.x));
    Ap += q.a * h;
    if (h > 0) Bp += q.a;
  });
  const A = G.A - Ap;
  const B = G.B - Bp;
  return { A, B, Ap, Bp, Bg: G.B, htb: B > 0 ? A / B : 0, zAt };
}

// lưu lượng tự nhiên chảy qua phạm vi [x1, x2] (vận tốc từng bộ phận)
export function hvQin(
  S: HvSecModel,
  o: HvSecSnapshot,
  H: number,
  x1: number,
  x2: number,
  only?: (p: HvSecPartResult) => boolean,
): { Q: number; A: number } {
  let Q = 0;
  let A = 0;
  o.parts.forEach((p) => {
    if (only && !only(p)) return;
    const a = Math.max(p.x1, x1);
    const b = Math.min(p.x2, x2);
    if (b <= a) return;
    const G = HV.geo(S.pts, H, a, b);
    Q += G.A * p.V;
    A += G.A;
  });
  return { Q, A };
}

// mép nước tại mực nước H
export function hvEdge(S: HvSecModel, H: number, side: number): number {
  const p = S.pts;
  if (side < 0) {
    for (let i = 1; i < p.length; i++) {
      if (p[i][1] < H) {
        const a = p[i - 1];
        const b = p[i];
        return a[1] <= H ? a[0] : a[0] + ((a[1] - H) / (a[1] - b[1])) * (b[0] - a[0]);
      }
    }
    return p[0][0];
  }
  for (let i = p.length - 1; i > 0; i--) {
    if (p[i - 1][1] < H) {
      const a = p[i - 1];
      const b = p[i];
      return b[1] <= H ? b[0] : a[0] + ((H - a[1]) / (b[1] - a[1])) * (b[0] - a[0]);
    }
  }
  return p[p.length - 1][0];
}

// Bảng 3-1 [TKĐ3]: hệ số xói cho phép theo chiều sâu trước xói
export const HV31 = {
  h: [3, 4, 5, 6, 8, 10, 10.001],
  s: [2.0, 1.8, 1.7, 1.6, 1.5, 1.45, 1.4],
  n: [1.5, 1.4, 1.35, 1.3, 1.25, 1.2, 1.2],
};

// Bảng 4-11 [ST]: hệ số a
export const HV411 = {
  fr: [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5],
  q: [1.25, 1.5, 2.0, 2.5, 3.0, 4.0],
  a: [
    [1.14, 1.21, 1.36, 1.51, 1.66, 2.28],
    [1.07, 1.12, 1.24, 1.39, 1.54, 2.0],
    [1.02, 1.05, 1.13, 1.28, 1.42, 1.72],
    [0.98, 1.01, 1.08, 1.19, 1.3, 1.48],
    [0.94, 0.97, 1.04, 1.11, 1.18, 1.26],
    [0.9, 0.92, 0.97, 1.03, 1.09, 1.08],
    [0.81, 0.82, 0.86, 0.88, 0.9, 0.83],
    [0.73, 0.74, 0.74, 0.73, 0.72, 0.51],
  ],
};

export function hv411(fr: number, qq: number): number {
  const c = HV411.a.map((r) => HV.interp(HV411.q, r, clampHv(qq, 1.25, 4)));
  return HV.interp(HV411.fr, c, clampHv(fr, 0.05, 0.5));
}

// ---- điều kiện áp dụng các công thức (theo nguồn) ----
export function hvAppZ(Z: Pick<HvBackwaterResult, 'B0' | 'Lc'>): Record<string, ApplicabilityPair> {
  const b = Z.B0 > Z.Lc + 0.01;
  return {
    s1: [1, ''],
    s2: [1, ''],
    an: [b, b ? '' : 'dòng chảy không bị nền đắp đầu cầu thu hẹp (B0 ≤ Lc)'],
    gr: [b, b ? '' : 'dòng chảy không bị nền đắp đầu cầu thu hẹp (B0 ≤ Lc)'],
  };
}

export function hvAppX(I: Pick<HvInput, 'coh'>): Record<string, ApplicabilityPair> {
  return {
    lis: [1, ''],
    lau: [!I.coh, I.coh ? 'công thức cho đất rời (theo D50), lòng sông là đất dính' : ''],
    p: [1, ''],
    and: [1, ''],
  };
}

export function hvAppP(
  k: string,
  q: Pick<HvPierScourInput, 'h' | 'v'>,
  S: HvSoilProps,
): ApplicabilityPair {
  const sand = !S.coh && S.d50 < 2;
  const Fr = q.h > 0 ? q.v / Math.sqrt(9.81 * q.h) : 0;
  const vo = HVM.vox(S, q.h);
  if (k === 'shen1') {
    return sand && q.v <= vo
      ? [1, '']
      : [0, !sand ? 'chỉ áp dụng cho đáy cát' : 'không phải xói nước trong (v > vox)'];
  }
  if (k === 'shen2') {
    return sand && Fr > 0.5
      ? [1, '']
      : [0, !sand ? 'chỉ áp dụng cho đáy cát' : 'Fr = ' + Fr.toFixed(2) + ' ≤ 0,5'];
  }
  if (k === 'lau3') {
    return sand && Fr < 0.5
      ? [1, '']
      : [0, !sand ? 'chỉ áp dụng cho đáy cát' : 'Fr = ' + Fr.toFixed(2) + ' ≥ 0,5'];
  }
  if (k === 'blench') {
    return !S.coh && S.d50 > 1 && S.d50 < 4 && Fr < 0.3
      ? [1, '']
      : [0, 'áp dụng cho 0,001 < D50 < 0,004 m và Fr < 0,3'];
  }
  if (k === 'dinh') return S.coh ? [1, ''] : [0, 'chỉ áp dụng cho đất dính'];
  return [1, ''];
}

export function hvAppA(
  k: string,
  a: Pick<HvAbutScourInput, 'h1' | 'Lp'>,
  S: Pick<HvAbutSoilProps, 'abn'>,
): ApplicabilityPair {
  const r = a.h1 > 0 ? a.Lp / a.h1 : 0;
  if (k === 'hire') {
    return r > 25 ? [1, ''] : [0, "L'/y1 = " + r.toFixed(1) + ' ≤ 25 ([ST] mục 4.5.2b)'];
  }
  if (k === 'iar') return S.abn === 'non' ? [1, ''] : [0, 'công thức cho đầu kè, mố có 1/4 nón'];
  return [1, ''];
}

// hồi quy đa thức bậc 2 y = a.x^2 + b.x + c (bình phương nhỏ nhất), R^2
export function hvPoly2(P: Point2D[]): HvPoly2Result | null {
  if (P.length < 3) return null;
  const S = [0, 0, 0, 0, 0];
  const T = [0, 0, 0];
  P.forEach(([x, y]) => {
    let xp = 1;
    for (let k = 0; k < 5; k++) {
      S[k] += xp;
      if (k < 3) T[k] += xp * y;
      xp *= x;
    }
  });
  const M = [
    [S[4], S[3], S[2], T[2]],
    [S[3], S[2], S[1], T[1]],
    [S[2], S[1], S[0], T[0]],
  ];
  for (let i = 0; i < 3; i++) {
    let mx = i;
    for (let r = i + 1; r < 3; r++) if (Math.abs(M[r][i]) > Math.abs(M[mx][i])) mx = r;
    [M[i], M[mx]] = [M[mx], M[i]];
    for (let r = 0; r < 3; r++) {
      if (r !== i) {
        const f = M[r][i] / M[i][i];
        for (let c = i; c < 4; c++) M[r][c] -= f * M[i][c];
      }
    }
  }
  const a = M[0][3] / M[0][0];
  const b = M[1][3] / M[1][1];
  const c = M[2][3] / M[2][2];
  const f = (x: number): number => a * x * x + b * x + c;
  const ym = P.reduce((t, q) => t + q[1], 0) / P.length;
  const ss = P.reduce((t, q) => t + (q[1] - f(q[0])) ** 2, 0);
  const st = P.reduce((t, q) => t + (q[1] - ym) ** 2, 0);
  return {
    a,
    b,
    c,
    R2: st > 0 ? 1 - ss / st : 1,
    f,
    pts: P,
    x1: Math.min(...P.map((q) => q[0])),
    x2: Math.max(...P.map((q) => q[0])),
  };
}

export const hvCoef = (val: number): string => {
  if (!isFinite(val)) return '-';
  const e = Math.floor(Math.log10(Math.abs(val) || 1));
  return Math.abs(e) >= 4
    ? (val / 10 ** e).toFixed(4) + 'E' + (e < 0 ? '-' : '+') + String(Math.abs(e)).padStart(2, '0')
    : val.toPrecision(5).replace(/\.?0+$/, '');
};

export function hvScour(R: HvCalcResult, I: HvInput, S: HvSecModel, P: number): HvScourResult {
  const Q = R.Q[P].Q;
  const H = R.H[P];
  const o = R.hy[P];
  const op = hvOpen(S, I, H);
  const K = R.K;

  const xs = [
    ...new Set([
      I.xA1,
      ...S.pts.map((p) => p[0]).filter((x) => x > I.xA1 && x < I.xA2),
      ...I.pier.map((q) => q.x),
      I.xA2,
    ]),
  ].sort((a, b) => a - b);

  const V: HvVerticalPoint[] = xs.map((x) => ({
    x,
    z: op.zAt(x),
    h: Math.max(0, H - op.zAt(x)),
    ch: x >= I.xL - 1e-9 && x <= I.xR + 1e-9,
    q: 0,
    h2: 0,
    dx: 0,
  }));

  const Lc = op.B;
  const htb = op.htb;
  const SL: HvSoilProps = { d50: I.d50, d90: I.d90, coh: I.coh, cty: I.cty };

  // lưu lượng nguyên tố tự nhiên tại thủy trực (phân bố theo h^(5/3), TKĐ3 mục 3.2.4)
  let s53 = 0;
  for (let i = 1; i < V.length; i++) {
    s53 += ((Math.pow(V[i - 1].h, 5 / 3) + Math.pow(V[i].h, 5 / 3)) / 2) * (V[i].x - V[i - 1].x);
  }
  s53 -= I.pier.reduce((s, q) => s + q.a * Math.pow(Math.max(0, H - op.zAt(q.x)), 5 / 3), 0);
  V.forEach((pt) => {
    pt.q = s53 > 0 ? (Q * Math.pow(pt.h, 5 / 3)) / s53 : 0;
  });

  // (1) Listvan [TKĐ3] mục 3.2.4
  const lisBlock = (() => {
    const a = I.coh ? 0.6 * Math.pow(I.gd, 1.18) : 0.68 * Math.pow(I.d50, 0.28);
    const bp = HV.betaP(P);
    const y = I.coh ? HV.interp(HV.T34.g, HV.T34.yc, I.gd) : HV.interp(HV.T34.d, HV.T34.y, I.d50);
    const al = Q / (Math.pow(htb, 5 / 3) * Lc);
    const Hst = Math.pow((al * Math.pow(htb, 5 / 3)) / (a * bp), y);
    const dxt = Math.max(0, Hst - htb);
    return {
      a,
      bp,
      y,
      al,
      tb: I.lxm === 'tb',
      Hst,
      dxt,
      h2:
        I.lxm === 'tb'
          ? V.map((pt) => (pt.h > 0 ? pt.h + dxt : 0))
          : V.map((pt) => (pt.h > 0 ? Math.pow((al * Math.pow(pt.h, 5 / 3)) / (a * bp), y) : 0)),
    };
  })();

  // (2) Laursen [ST] mục 4.4
  const lauBlock = (() => {
    const D = Math.max(I.d50, 0.001) / 1000;
    const ch = o.ch;
    const Vc = 6.19 * Math.pow(ch.h, 1 / 6) * Math.pow(D, 1 / 3);
    const live = ch.V > Vc;
    const w = HVM.omega(I.d50);
    const us = Math.sqrt(9.81 * ch.h * I.i);
    const uw = us / w;
    const k1 = uw < 0.5 ? 0.59 : uw <= 2 ? 0.64 : 0.69;
    const y2l = ch.h * Math.pow(Q / ch.Q, 6 / 7) * Math.pow(ch.B / Lc, k1);
    const Dm = 1.25 * D;
    const y2c = Math.pow((0.025 * Q * Q) / (Math.pow(Dm, 2 / 3) * Lc * Lc), 3 / 7);
    const y2 = live ? Math.min(y2l, y2c) : y2c;
    const yx = Math.max(0, y2 - htb);
    return {
      Vc,
      live,
      w,
      us,
      uw,
      k1,
      y2l,
      Dm,
      y2c,
      y2,
      y0: htb,
      yx,
      y1: ch.h,
      Q1: ch.Q,
      W1: ch.B,
      V1: ch.V,
      h2: V.map((pt) => (pt.h > 0 ? pt.h + yx : 0)),
    };
  })();

  // (3) Hệ số xói P (Belleliutsky) [TKĐ3] PT 3-2, 3-3
  const pBlock = { P: K.P, h2: V.map((pt) => pt.h * K.P) };

  // (4) Andreev [TKĐ3] mục 3.2.5, 5.1.1 ; [ST] Phụ lục 4-1 mục 1
  const andBlock = (() => {
    const ch = o.ch;
    const qn = hvQin(S, o, H, I.xA1, I.xA2);
    const qbc = hvQin(S, o, H, I.xA1, I.xA2, (p) => p.k !== 'ch');
    const Qch = ch.Q;
    const Qbc = qbc.Q;
    const vbc = qbc.A > 0 ? Qbc / qbc.A : 0;
    const B0 = o.B;
    const Lb = I.xA2 - I.xA1;
    const l0 = Math.max(0, B0 - op.Bg);
    const beta = qn.Q > 0 ? Q / qn.Q : 1;
    const tau = Qch / Q;
    const eta = vbc > 0 ? ch.V / vbc : 1;
    const aa = l0 > 0 ? (1.1 * ch.V * ch.V) / (9.81 * I.i * l0) : 0;
    const Fq = aa > 0 && eta > 1 ? (aa * (eta * eta - 1)) / (eta * eta + aa) : 0;
    let bch = beta;
    let bb = beta;
    if (Qbc > 0) {
      bch = 0.98 * beta;
      for (let k = 0; k < 100; k++) {
        bb = Math.sqrt(Math.max(0, bch * bch + (bch * bch - 1) * Fq));
        const nx = bb - (bb / beta - 1) / tau;
        if (Math.abs(nx - bch) < 1e-7) {
          bch = nx;
          break;
        }
        bch = nx;
      }
    }
    const lam = I.pier.length ? I.pier.reduce((s, q) => s + q.a, 0) / Lb : 0;
    const hbOf = (hb: number): number => {
      if (!(vbc > 0)) return hb;
      if (!(bb > ((1 - lam) * HVM.vox(SL, hb)) / vbc)) return hb;
      let h = hb;
      for (let k = 0; k < 40; k++) h = (hb * bb * vbc) / ((1 - lam) * HVM.vox(SL, h));
      return Math.max(hb, h);
    };
    const h2 = V.map((pt) => (pt.h <= 0 ? 0 : pt.ch ? pt.h * Math.pow(bch, 8 / 9) : hbOf(pt.h)));
    return { Qch, Qbc, vbc, B0, l0, beta, tau, eta, aa, Fq, bch, bb, lam, h2 };
  })();

  const M: HvScourResult['M'] = {
    lis: lisBlock,
    lau: lauBlock,
    p: pBlock,
    and: andBlock,
  };

  const app = hvAppX(I);
  if (I.xmAll) I.xm = ['lis', 'lau', 'and', 'p'].find((k) => app[k][0]) || 'lis';
  const sel = (M as Record<string, { h2: number[] }>)[I.xm] ? I.xm : 'lis';
  const chosenH2 = (M as Record<string, { h2: number[] }>)[sel].h2;
  V.forEach((pt, idx) => {
    pt.h2 = chosenH2[idx];
    pt.dx = Math.max(0, pt.h2 - pt.h);
  });

  const vm = V.reduce((b, pt) => (pt.h2 > b.h2 ? pt : b), V[0]);
  const dl = I.dlt * vm.h2;
  const elG = H - (vm.h2 + dl);
  const cmp = Object.keys(M).map((k) => {
    const h2 = (M as Record<string, { h2: number[] }>)[k].h2;
    const j = h2.reduce((b, x, idx) => (x > h2[b] ? idx : b), 0);
    return { k, hmax: h2[j], x: V[j].x, el: H - h2[j] * (1 + I.dlt) };
  });

  const Vu = op.A > 0 ? Q / op.A : 0;

  const X: HvScourResult = {
    P,
    Q,
    H,
    op,
    Lc,
    htb,
    M,
    app,
    sel,
    V,
    vmax: vm,
    dl,
    elG,
    cmp,
    Vu,
    piers: [],
    abut: [],
  };

  // xói cục bộ trụ - tất cả các công thức
  X.piers = I.pier.map((q) => {
    const i = V.findIndex((w) => Math.abs(w.x - q.x) < 1e-9);
    const pt = V[i];
    const h = pt.h2;
    const vv = h > 0 ? pt.q / h : 0;
    const sh = HVM.pierShape(I.nose, q.a, q.L, I.th);
    const qq: HvPierScourInput = {
      h,
      h2: pt.h2,
      v: vv,
      b: q.a,
      B1: sh.B1,
      Kx: sh.K,
      L: q.L,
      al: I.th,
      nose: I.nose,
      chu: pt.ch,
    };
    const S2: HvSoilProps = { ...SL, Ka: I.Ka, Kf: I.Kf };
    const all = HVM.PIER.map((m) => {
      let r: HvFormulaResult;
      try {
        r = m.f(qq, S2, X);
      } catch (e) {
        r = { y: NaN, tex: '', p: 'lỗi: ' + (e instanceof Error ? e.message : String(e)) };
      }
      return { k: m.k, n: m.n, src: m.src, ...r, app: hvAppP(m.k, qq, SL) };
    });
    const cur = I.pmAll
      ? [all.find((a) => a.k === 'dhxd'), ...all].find((a) => a && a.app[0] && isFinite(a.y)) ||
        all[0]
      : all.find((a) => a.k === I.pm) || all[0];
    const ys = Math.max(0, cur.y || 0);
    const el = H - (vm.h2 + dl + ys);
    return {
      ...q,
      z: pt.z,
      h0: pt.h,
      y1: h,
      V1: vv,
      qn: pt.q,
      shape: sh,
      all,
      cur,
      ys,
      el,
      dxc: pt.dx,
    };
  });

  // xói cục bộ mố - tất cả các công thức
  const abutSpecs: Array<[number, string, number, number]> = [
    [-1, 'Mố trái', I.xA1, I.LpL],
    [1, 'Mố phải', I.xA2, I.LpR],
  ];
  X.abut = abutSpecs.map(([sd, n, xa, Lman]) => {
    const vt = V.find((pt) => Math.abs(pt.x - xa) < 1e-9) || { dx: 0, h: 0, h2: 0, q: 0 };
    const h0 = Math.max(0, H - op.zAt(xa));
    const man = Lman > 0;
    const xw = hvEdge(S, H, sd);
    let Lp: number;
    let mode: string;
    if (man) {
      Lp = Lman;
      mode = 'man';
    } else if (I.lpm === 'bai') {
      Lp = Math.max(0, sd < 0 ? xa - xw : xw - xa);
      mode = 'bai';
    } else {
      Lp = h0 > 0 ? I.mta * h0 : 0;
      mode = 'non';
    }
    const base = {
      n,
      man,
      mode,
      x: xa,
      h0,
      Lp,
      dxa: vt.dx,
      bai: !(xa > I.xL - 0.01 && xa < I.xR + 0.01),
    };
    if (!(Lp > 0.01) || (!(h0 > 0.005) && mode !== 'bai')) {
      return { ...base, Lp: 0, ys: 0, el: op.zAt(xa) - vt.dx, all: [], cur: null };
    }
    let Ac: number;
    let Qc: number;
    let ya: number;
    let Vc: number;
    if (mode === 'bai' || (man && (sd < 0 ? xw < xa - 0.01 : xw > xa + 0.01))) {
      const x1 = sd < 0 ? xa - Lp : xa;
      const x2 = sd < 0 ? xa : xa + Lp;
      const qq = hvQin(S, o, H, x1, x2);
      Ac = qq.A;
      Qc = qq.Q;
      ya = Lp > 0 ? Ac / Lp : 0;
      Vc = Ac > 0 ? Qc / Ac : 0;
    } else {
      ya = Math.max(vt.h2, h0);
      Vc = vt.h2 > 0 ? vt.q / vt.h2 : 0;
      Ac = ya * Lp;
      Qc = Vc * Ac;
    }
    const Fr = ya > 0 ? Vc / Math.sqrt(9.81 * ya) : 0;
    const h1 = Math.max(vt.h2, 0.05);
    const a: HvAbutScourInput = { Lp, ya, Vc, Fr, h1, al: 90 + (I.th || 0) };
    const S2: HvAbutSoilProps = {
      ...SL,
      abut: I.abut,
      abn: I.abn,
      tha: I.tha,
      mta: I.mta,
      chu: I.xA1 < I.xL - 0.01 || I.xA2 > I.xR + 0.01,
    };
    const all = HVM.ABUT.map((m) => {
      const aa = { ...a, v: m.k === 'iar' ? Vu : Vc };
      let r: HvFormulaResult;
      try {
        r = m.f(aa, S2);
      } catch {
        r = { y: NaN, tex: '', p: 'lỗi' };
      }
      return { k: m.k, n: m.n, src: m.src, ...r, app: hvAppA(m.k, a, S2) };
    });
    const cur =
      I.am === 'auto'
        ? all.find((x) => x.k === (base.bai ? 'khong' : 'tdn')) || all[0]
        : I.amAll
          ? ['tdn', a.Lp / a.h1 > 25 ? 'hire' : 'fro', 'iar']
              .map((k) => all.find((x) => x.k === k))
              .find((x) => x && x.app[0] && isFinite(x.y)) || all[0]
          : all.find((x) => x.k === I.am) || all[0];
    const ys = Math.max(0, cur.y || 0);
    return {
      ...base,
      Ac,
      Qc,
      ya,
      Vc,
      Fr,
      h1,
      all,
      cur,
      ys,
      el: op.zAt(xa) - vt.dx - ys,
      hire: ya > 0 && Lp / ya > 25,
      bai: !(xa > I.xL - 0.01 && xa < I.xR + 0.01),
    };
  });

  return X;
}

export function hvCalc(I: HvInput): HvCalcResult {
  const warn: string[] = [];
  const err: string[] = [];
  const TL = I.qsrc === 'tl';
  if (TL && !I.qtl.length) {
    err.push('Nhập lưu lượng theo tài liệu: mỗi dòng "tần suất P (%)  lưu lượng Q (m³/s)".');
  }
  if (!TL && !(I.F > 0 && I.L > 0)) {
    err.push('Nhập diện tích lưu vực F và chiều dài lòng chính L.');
  }
  if (!TL && I.F >= 100) {
    warn.push(
      'F ≥ 100 km²: TCVN 9845 Điều 5.1 quy định tính theo công thức triết giảm (Điều 5.3); module này áp dụng cho F < 100 km².',
    );
  }
  if (I.sec.length < 3) err.push('Nhập mặt cắt ngang lòng sông (ít nhất 3 điểm).');

  const R = { I, warn, err, TL } as HvCalcResult;
  if (err.length) return R;

  R.Pd = I.P;
  R.Px = Math.max(I.Px || 1, 1);
  if (I.Px < 1) {
    warn.push(
      'Lũ thiết kế xói lấy không hiếm hơn lũ 100 năm (TCVN 11823-2 Điều 2.7): dùng Px = 1%.',
    );
  }

  // ---- mưa ----
  const dist: DistType = I.rd === 'km' ? 'km' : 'p3';
  R.dist = dist;
  if (TL && (!(I.F > 0 && I.L > 0) || (I.rs === 'ser' && !HV.stats(I.rain)))) {
    R.noRain = true;
    R.Xm = NaN;
    R.Cv = NaN;
    R.Cs = NaN;
    R.pm = 'par';
  } else if (I.rs === 'ser') {
    const st = HV.stats(I.rain);
    if (!st) {
      err.push('Chuỗi mưa cần ít nhất 3 năm.');
      return R;
    }
    R.st = st;
    R.Xm = st.mean;
    if (st.n < 20) {
      warn.push(
        `Chuỗi mưa chỉ có ${st.n} năm (< 20 năm, Sổ tay mục 2.2.1a): cần phân tích tính đại biểu so với trạm có chuỗi dài.`,
      );
    }
    R.fitR = HVM.fit(st, dist);
    if (I.rm === 'fit') {
      R.Cv = R.fitR.Cv;
      R.Cs = R.fitR.Cs;
      R.pm = 'fit';
    } else {
      R.Cv = st.Cv;
      R.Cs = isFinite(I.Csu) ? I.Csu : st.Cs;
      R.CsUser = isFinite(I.Csu);
      R.pm = 'mom';
      if (!st.csOK && !R.CsUser) {
        warn.push(
          'Cs tính theo PT 2-4 không thỏa 2Cv ≤ Cs ≤ 2Cv/(1 - Kmin) (Sổ tay bước 5): nhập Cs chọn theo Cv.',
        );
      }
    }
  } else {
    R.Xm = I.Xm;
    R.Cv = I.Cvp;
    R.Cs = I.Csp;
    R.pm = 'par';
  }

  if (dist === 'km') {
    const k = HVM.kmRange(R.Cv, R.Cs);
    if (k.rOut || k.cvOut) {
      warn.push(
        `Cv = ${fx(R.Cv, 3)}, Cs/Cv = ${fx(R.Cs / R.Cv, 2)} ngoài phạm vi Phụ lục 2-2 (Cs/Cv = 1 - 6; Cv ≤ 0,9 - 1,2): lấy theo giới hạn bảng.`,
      );
    }
  }
  const Hp = (P: number): number => R.Xm * HVM.KP(dist, P, R.Cv, R.Cs);
  R.Hp = Hp;

  // ---- trắc dọc ----
  R.Jls = I.Jls;
  if (I.jm === 'p') {
    const j = HV.jls(I.prof);
    if (j) {
      R.Jls = j.J;
      R.Jp = j;
      if (Math.abs(j.L - I.L) > 0.05 * I.L) {
        warn.push(
          `Chiều dài trắc dọc (${fx(j.L, 2)} km) khác chiều dài lòng chính L = ${fx(I.L, 2)} km.`,
        );
      }
    }
  }
  const Iq: HvInput = { ...I, Jls: R.Jls };

  // ---- mặt cắt ----
  if (!(I.xL < I.xR)) err.push('Ranh giới lòng chủ: lý trình bờ trái phải nhỏ hơn bờ phải.');
  if (!(I.i > 0)) err.push('Nhập độ dốc mặt nước i > 0.');
  if (err.length) return R;

  const S = HV.secMake({
    pts: I.sec,
    xL: I.xL,
    xR: I.xR,
    nch: I.nch,
    nb: I.nb,
    gch: I.gch,
    gb: I.gb,
    hf: I.hf,
    i: I.i,
  });
  R.S = S;

  // ---- lưu lượng các cách ----
  const hist: Array<HvHistFlood & { Q: number }> = I.hist.map((o) => ({
    ...o,
    Q: S.at(o.h).Q,
  }));
  const htr = isFinite(I.htr) && I.htr > 0 ? I.htr : R.Cs / R.Cv;

  const qTL = (P: number): number => {
    const T = I.qtl;
    if (!T.length) return NaN;
    const e = T.find((a) => Math.abs(a[0] - P) < 1e-9);
    if (e) return e[1];
    if (T.length === 1) return T[0][1];
    let i = T.findIndex((a) => a[0] > P);
    if (i <= 0) i = i < 0 ? T.length - 1 : 1;
    const [p1, q1] = T[i - 1];
    const [p2, q2] = T[i];
    return q1 + ((q2 - q1) * (Math.log(P) - Math.log(p1))) / (Math.log(p2) - Math.log(p1));
  };
  R.qTL = qTL;

  const Qall = (P: number): HvQEntry => {
    if (TL && R.noRain) {
      return { Hp: NaN, t: null, d: null, h: null, Q: qTL(P), m: 'tl' };
    }
    const hp = Hp(P);
    const t = HV.qp(Iq, hp);
    const d = t ? HVM.qDHXD(Iq, hp, t.phi, t.delta) : null;
    const h = HVM.qHT(
      hist.map((o) => ({ ...o })),
      dist,
      htr,
      R.Cv,
      P,
    );
    const sel = TL ? qTL(P) : I.qm === 'dhxd' && d ? d.Q : I.qm === 'ht' && h ? h.Q : t ? t.Q : NaN;
    return {
      Hp: hp,
      t,
      d,
      h,
      Q: sel,
      m: TL ? 'tl' : I.qm === 'dhxd' && d ? 'dhxd' : I.qm === 'ht' && h ? 'ht' : 'tcvn',
    };
  };
  R.Qall = Qall;

  R.Pa = I.Pa > 0 && I.Pa !== R.Pd ? I.Pa : null;
  const Ps = [...new Set([R.Pd, R.Px, ...(R.Pa ? [R.Pa] : [])])];
  R.Ps = Ps;
  R.Q = {};
  Ps.forEach((P) => {
    R.Q[P] = Qall(P);
  });

  if (!TL && !R.Q[R.Pd].t) {
    err.push('Không tra được Bảng A.1.');
    return R;
  }
  if (I.qm === 'ht' && !R.Q[R.Pd].h) {
    warn.push(
      'Chưa đủ số liệu lũ lịch sử (năm, cao độ, thời kỳ N) để tính theo phương pháp hình thái: dùng TCVN 9845.',
    );
  }
  if (I.qm === 'dhxd' && I.F > 30) {
    warn.push(
      'Công thức cường độ giới hạn ĐH Xây dựng áp dụng cho lưu vực F ≤ 30 km² (Sổ tay mục 2.2.3a).',
    );
  }

  R.htr = htr;
  R.H = {};
  R.hy = {};
  Ps.forEach((P) => {
    const H = S.hOf(R.Q[P].Q);
    R.H[P] = H;
    R.hy[P] = S.at(H);
  });

  {
    const zE = Math.min(S.pts[0][1], S.pts[S.pts.length - 1][1]);
    const Hm = Math.max(...Ps.map((P) => R.H[P]));
    if (Hm > zE + 1e-6) {
      warn.push(
        `Mực nước tính toán ${fx(Hm, 3)} m cao hơn điểm đầu hoặc cuối mặt cắt (${fx(zE, 3)} m): mở rộng phạm vi mặt cắt ngang.`,
      );
    }
  }
  if (Math.max(...Ps.map((P) => R.H[P])) > S.ztop) {
    warn.push('Mực nước tính toán cao hơn đầu mút mặt cắt khảo sát: cần đo rộng thêm mặt cắt.');
  }

  const Htk = R.H[R.Pd];
  const o = R.hy[R.Pd];
  R.Htk = Htk;
  R.o = o;

  const hs: HvSecSnapshot[] = [];
  const zlo = Math.ceil((S.zmin + 0.25) * 2) / 2;
  const zhi = Math.max(S.ztop, ...Ps.map((P) => R.H[P] + 0.5), ...I.hist.map((ho) => ho.h + 0.3));
  const stp = Math.max(0.5, Math.round(((zhi - zlo) / 8) * 2) / 2);
  for (let h = zlo; h <= zhi + 1e-9; h += stp) hs.push(S.at(h));
  R.HQ = hs;

  {
    const Hm = Math.min(...Ps.map((P) => R.H[P])) - 1.5;
    let pt = hs.filter((q) => q.Q > 0 && q.H >= Hm);
    if (pt.length < 5) pt = hs.filter((q) => q.Q > 0).slice(-5);
    R.fitHQ = hvPoly2(pt.map((q) => [q.Q, q.H] as Point2D));
  }

  R.hist = hist.map((x) => {
    let lo = 0.01;
    let hi = 99;
    let P: number;
    const f = (Px: number): number => Qall(Px).Q;
    if (x.Q >= f(lo)) P = -1;
    else if (x.Q <= f(hi)) P = 100;
    else {
      for (let k = 0; k < 50; k++) {
        const m = Math.sqrt(lo * hi);
        if (f(m) > x.Q) lo = m;
        else hi = m;
      }
      P = Math.sqrt(lo * hi);
    }
    return { ...x, P };
  });
  R.histMax = R.hist.reduce<(HvHistFlood & { Q: number; P: number }) | null>(
    (b, x) => (!b || x.h > b.h ? x : b),
    null,
  );

  // ---- khẩu độ ----
  if (!(I.xA2 > I.xA1)) {
    err.push('Nhập lý trình mép trong hai mố (mố trái < mố phải).');
    return R;
  }

  const Q = R.Q[R.Pd].Q;
  const op = hvOpen(S, I, Htk);
  R.op = op;
  const Vch = o.ch.V;
  const al = (I.th * Math.PI) / 180;
  const qn = hvQin(S, o, Htk, I.xA1, I.xA2);
  R.qn = qn;
  R.V0 = qn.A > 0 ? qn.Q / qn.A : 0;

  const chA = o.ch.A;
  const bp = o.parts.filter((p) => p.k !== 'ch');
  const msr = I.coh ? 0.85 : I.d50 >= 2 ? 0.85 : I.d50 >= 0.05 ? 0.9 : 0.95;

  const mu41Val = HV.mu41(Vch, op.B);
  const muVal = I.mum === 'b41' ? mu41Val : 1;
  const qUnit = Q / op.B;
  const Pq = HV.P42(qUnit);
  const PsVal = HV.interp(HV31.h, HV31.s, op.htb);
  const PnVal = HV.interp(HV31.h, HV31.n, op.htb);
  const PVal = I.Pt === 'hs' ? PsVal : I.Pt === 'hn' ? PnVal : Pq;

  const mMap: Record<string, number> = {
    bel: Q / (muVal * PVal * Vch),
    kas:
      (chA +
        bp.reduce(
          (s, p) =>
            s +
            p.A *
              (p.A > 0
                ? (((I.gch + Math.sqrt(o.ch.h)) / (I.gb + Math.sqrt(p.h))) * p.h) / o.ch.h
                : 0),
          0,
        )) /
      (muVal * PVal),
    sri:
      (msr *
        (chA +
          bp.reduce(
            (s, p) =>
              s +
              p.A *
                (p.A > 0 ? (I.nch * Math.pow(p.h, 2 / 3)) / (I.nb * Math.pow(o.ch.h, 2 / 3)) : 0),
            0,
          ))) /
      (muVal * PVal),
  };
  Object.keys(mMap).forEach((k) => {
    mMap[k] /= Math.cos(al);
  });

  const zb = Math.min(
    ...S.pts.filter((p) => p[0] >= I.xA1 && p[0] <= I.xA2).map((p) => p[1]),
    op.zAt(I.xA1),
    op.zAt(I.xA2),
  );
  const Lo0 = I.xA2 - I.xA1 - I.pier.reduce((s, q) => s + q.a, 0);
  const hh = Htk - zb;
  const V0n = o.Q / o.A;
  const sb = HV.smallBr(Q, Lo0, I.m, hh, V0n, 1);
  const sbOK = sb.Vt <= I.Vcp + 1e-9;
  const Hup = zb + sb.H;

  const K: HvOpeningResult = {
    Vch,
    Lo: op.B,
    mu41: mu41Val,
    mu: muVal,
    q: qUnit,
    Pq,
    Ps: PsVal,
    Pn: PnVal,
    P: PVal,
    msr,
    m: mMap,
    w: op.A,
    chB: o.ch.B,
    chOK: !(I.xA1 > I.xL + 1e-6 || I.xA2 < I.xR - 1e-6),
    zb,
    Lo0,
    hh,
    V0n,
    sb,
    sbOK,
    Hup,
    app: { bel: [1, ''], kas: [1, ''], sri: [1, ''] },
    ok: false,
  };
  R.K = K;

  if (I.km === 'nho') {
    K.ok = K.sbOK;
  } else {
    K.wc = K.m[I.km] || K.m.bel;
    K.htb = K.Lo > 0 ? op.A / K.Lo : 0;
    K.wc0 = K.wc * Math.cos(al);
    K.Bct = K.htb > 0 ? K.wc0 / K.htb : Infinity;
    {
      const ch = o.ch;
      const bp2 = o.parts.filter((p) => p.k !== 'ch');
      const wb = bp2.reduce((t, p) => t + p.A, 0);
      const bb = bp2.reduce((t, p) => t + p.B, 0);
      K.bch = ch.B;
      K.wch = ch.A;
      K.hb = bb > 0 ? wb / bb : NaN;
      K.Bct2 = K.wc0 <= ch.A || !(K.hb > 0) ? (ch.B * K.wc0) / ch.A : ch.B + (K.wc0 - ch.A) / K.hb;
      K.hch = ch.B > 0 ? ch.A / ch.B : NaN;
      K.Bct3 = K.wc0 / K.hch;
      if (I.bctm === 'bai') K.Bct = K.Bct2;
      if (I.bctm === 'hch') K.Bct = K.Bct3;
    }
    K.Lct = (K.Bct as number) / Math.cos(al);
    K.Lreq = K.Lct;
    K.ok = K.Lo >= K.Lct - 1e-9;
  }

  // ---- nước dềnh: tất cả các cách ----
  const fb = o.Qb / Q;
  const etaA = fb <= 0.1 ? 0.05 : fb <= 0.3 ? 0.07 : fb <= 0.5 ? 0.1 : 0.15;
  const eta1 = parseFloat(I.etm) > 0 ? parseFloat(I.etm) : etaA;
  const Qc = Math.max(0, I.Qcong || 0);
  const Qz = Q - Qc;
  const Vtr = Qz / op.A;

  const Xd = hvScour(R, I, S, R.Pd);
  let dA = 0;
  const Vd = Xd.V;
  for (let i = 1; i < Vd.length; i++) {
    dA += ((Vd[i - 1].dx + Vd[i].dx) / 2) * (Vd[i].x - Vd[i - 1].x);
  }
  dA -= I.pier.reduce(
    (t, q) => t + q.a * (Vd.find((vp) => Math.abs(vp.x - q.x) < 1e-9) || { dx: 0 }).dx,
    0,
  );
  const wsx = op.A + Math.max(0, dA);
  const Psx = wsx / op.A;
  const xsel = Xd.sel;
  const Vsx = Qz / wsx;
  const Vc = I.soil === 'mem' ? Vsx : I.soil === 'tb' ? (Vsx * 2 * Psx) / (Psx + 1) : Vtr;
  const V0c = R.V0;
  const V0 = I.v0m === 'tm' ? Qz / o.A : R.V0;
  const Vtb = o.V;
  const B0 = o.B;
  const LcZ = I.xA2 - I.xA1;
  const xLw = hvEdge(S, Htk, -1);
  const xRw = hvEdge(S, Htk, 1);
  const twoSides = xLw < I.xA1 - 0.01 && xRw > I.xA2 + 0.01;
  const Lng = twoSides ? B0 / 2 : B0;
  const Fr = (Vtb * Vtb) / (9.81 * Lng);
  const Fri = Fr / I.i;
  const QQc = qn.Q > 0 ? Qz / qn.Q : 1;
  const aVal = hv411(Fri, QQc);
  const Kk = 1 + ((Vtb / Math.max(V0, 1e-6)) ** 2 * aVal) / Math.sqrt(Fri);
  const eta2 = Kk / (2 * 9.81);
  const x0 = aVal * Lng * Math.sqrt(Fri);
  const beta = qn.Q > 0 ? Qz / qn.Q : 1;
  const Kg = beta > 1.4 ? 1 - 0.14 * Math.sqrt(beta - 1.4) : 1;
  const Kpg = 0.25 * (2 - K.P) ** 2 + 0.75;

  const mZ: Record<'s1' | 's2' | 'an' | 'gr', number> = {
    s1: Math.max(0, eta1 * (Vc * Vc - V0 * V0)),
    s2: Math.max(0, eta2 * (Vc * Vc - V0 * V0)),
    an: Math.max(0, 1.5 * (B0 - LcZ) * I.i * (beta * beta - 1)),
    gr: Math.max(0, 1.5 * (B0 - LcZ) * I.i * Kg * (Kpg * beta * beta - 1)),
  };

  const Z: HvBackwaterResult = {
    fb,
    etaA,
    eta1,
    Qc,
    Qz,
    Vtr,
    wsx,
    Psx,
    xsel,
    Vsx,
    Vc,
    V0c,
    V0,
    Vtb,
    B0,
    Lc: LcZ,
    Lng,
    Fr,
    Fri,
    QQc,
    a: aVal,
    Kk,
    eta2,
    x0,
    beta,
    Kg,
    Kpg,
    m: mZ,
    sel: 's1',
    dz: 0,
    Hd: Htk,
    dzcp: I.dzcp > 0 ? I.dzcp : null,
    okDZ: true,
  };
  R.Z = Z;

  if (I.km === 'nho') {
    Z.sel = 'nho';
    Z.dz = Math.max(0, K.Hup - Htk);
  } else {
    Z.app = hvAppZ(Z);
    if (I.zmAll) I.zm = (['s1', 's2', 'an', 'gr'] as const).find((k) => Z.app![k][0]) || 's1';
    Z.sel = Z.m[I.zm as 's1' | 's2' | 'an' | 'gr'] != null ? I.zm : 's1';
    Z.dz = Z.m[Z.sel as 's1' | 's2' | 'an' | 'gr'];
  }
  Z.Hd = Htk + Z.dz;
  R.Hd = Z.Hd;
  Z.okDZ = Z.dzcp == null || Z.dz <= Z.dzcp + 1e-9;
  if (I.km !== 'nho') {
    Z.TL = Z.dz + Z.x0 * I.i + (Z.Vtb * Z.Vtb) / 9.81;
    Z.HTL = Htk + Z.TL;
  }

  // ---- khổ giới hạn ----
  const cl = I.vt ? 1.0 : 0.5;
  R.C = {
    cl,
    ddMin: R.Hd + cl,
    kgMin: R.Hd + 0.25,
    okD: true,
    okK: true,
  };

  // ---- xói (lũ thiết kế xói) ----
  R.X = hvScour(R, I, S, R.Px);

  // ---- mực nước thi công ----
  if (I.wlst && I.wlser.length >= 3) {
    const stWl = HV.stats(I.wlser);
    if (stWl) {
      const HpWl = (P: number): number => (stWl.mean * HVM.KP('p3', P, stWl.Cv, stWl.Cs)) / 100;
      const Hcau = R.H[R.Pd];
      const Htr = HpWl(R.Pd);
      const DH = Hcau - Htr;
      const D = I.wlday.slice().sort((a, b) => a[1] - b[1]);
      const W: HvConstructionWaterResult = {
        st: stWl,
        Cv: stWl.Cv,
        Cs: stWl.Cs,
        Hp: HpWl,
        Pd: R.Pd,
        Hcau,
        Htr,
        DH,
        day: D,
      };
      if (D.length >= 2) {
        const p = 5;
        let j = D.findIndex((a) => a[1] >= p);
        if (j <= 0) j = j < 0 ? D.length - 1 : 1;
        const [h1, c1] = D[j - 1];
        const [h2, c2] = D[j];
        W.H5d = (h1 + ((h2 - h1) * (p - c1)) / (c2 - c1 || 1)) / 100;
        W.Htt = W.H5d + W.DH;
      }
      R.W = W;
    }
  }

  R.Q10 = Qall(10);
  R.H10 = S.hOf(R.Q10.Q);
  R.MNTC = I.tcm === 'p10' ? R.H10 : I.MNHT + I.dTC;
  return R;
}

// ============================================================================
// 7. Rain Station Management, Pier Presets, Applicability & A.1 Table UI
// ============================================================================

export function hvStInfo(): void {
  const s = $('hv_st');
  const e = $('hv_stInfo');
  if (!s || !e) return;
  const D = HVST[s.value];
  const r = $('hv_stn');
  const rb = $('hv_stRe');
  if (rb && rb.style) rb.style.display = D ? '' : 'none';
  const rTr = r?.closest?.('tr') as ContextElementLike | null | undefined;
  if (rTr?.style) rTr.style.display = s.value === 'khac' ? '' : 'none';
  if (!D) {
    e.textContent =
      s.value === 'khac'
        ? 'Nhập tên trạm và chuỗi lượng mưa ngày lớn nhất năm của trạm vào ô bên dưới.'
        : `Thư viện chưa có số liệu mưa của trạm ${s.value}: nhập chuỗi lượng mưa ngày lớn nhất năm của trạm vào ô bên dưới.`;
    return;
  }
  const y = D.ser.map((a) => a[0]);
  const how =
    D.tg === 'rx'
      ? 'theo bảng lượng mưa 1 ngày lớn nhất năm của trạm'
      : D.tg === 'd'
        ? 'lấy lượng mưa ngày lớn nhất từng năm từ số liệu mưa ngày của trạm'
        : 'chuỗi mưa ngày lớn nhất năm của trạm';
  e.textContent =
    `Trạm ${s.value}: ${D.ser.length} năm (${Math.min(...y)} - ${Math.max(...y)}), ${how}.` +
    (D.note ? ' ' + D.note : '') +
    ' Chuỗi đã nạp vào ô bên dưới, sửa hoặc bổ sung năm mới được.';
}

export function hvStSel(): void {
  const s = $('hv_st');
  const D = s ? HVST[s.value] : undefined;
  const ta = $('hv_rain');
  hvStInfo();
  if (!ta) return;
  if (!D) {
    const cur = ta.value.trim();
    if (
      cur &&
      Object.values(HVST).some((X) => X.ser.map((a) => a[0] + ' ' + a[1]).join('\n') === cur)
    ) {
      ta.value = '';
      dispatchElEvents(ta, ['input', 'change']);
    }
    return;
  }
  ta.value = D.ser.map((a) => a[0] + ' ' + a[1]).join('\n');
  const rs = $('hv_rs');
  if (rs && rs.value !== 'ser') {
    rs.value = 'ser';
    dispatchElEvents(rs, ['change']);
  }
  dispatchElEvents(ta, ['input', 'change']);
}

export const HVST_OLD: Record<string, number[][]> = { 'Ngọc Lặc': [[2022]] };

export function hvSerOld(nm: string, txt: string): boolean {
  const D = HVST[nm];
  const O = HVST_OLD[nm];
  if (!D || !O) return false;
  const cur = tmParse(txt)
    .map((a) => a[0] + ' ' + a[1])
    .join('\n');
  return (
    !!cur &&
    O.some(
      (dr) =>
        D.ser
          .filter((a) => !dr.includes(a[0]))
          .map((a) => a[0] + ' ' + a[1])
          .join('\n') === cur,
    )
  );
}

export function hvStRe(ta?: ContextElementLike | null, nm?: string): void {
  const targetTa = ta || $('hv_rain');
  const name = nm || $('hv_st')?.value || '';
  const D = HVST[name];
  if (!targetTa || !D) return;
  targetTa.value = D.ser.map((a) => a[0] + ' ' + a[1]).join('\n');
  dispatchElEvents(targetTa, ['input', 'change']);
}

export function hvPierInfo(): void {
  const e = $('hv_pierInfo');
  const t = $('hv_piers');
  if (!e || !t) return;
  const P = hvPairs(t.value);
  const a1 = parseFloat(String(($('hv_xA1') || {}).value).replace(',', '.'));
  const a2 = parseFloat(String(($('hv_xA2') || {}).value).replace(',', '.'));
  const bad = String(t.value)
    .split(/\r?\n/)
    .filter((l) => l.trim() && !hvPairs(l).length).length;
  if (!P.length && !bad) {
    e.textContent = t.value.trim() ? '' : 'Chưa nhập trụ: tính như cầu một nhịp.';
    if (e.style) e.style.color = '#555';
    return;
  }
  const out = P.filter(
    (q) => isFinite(a1) && isFinite(a2) && (q[0] <= Math.min(a1, a2) || q[0] >= Math.max(a1, a2)),
  );
  e.textContent =
    `Đã đọc ${P.length} trụ: ` +
    P.map((q) => `lý trình ${q[0]} m (a = ${q[1]} m, L = ${q[2] || q[1]} m)`).join('; ') +
    (bad ? ` - có ${bad} dòng không đọc được, kiểm tra lại` : '') +
    (out.length
      ? ` - trụ lý trình ${out.map((q) => q[0]).join(', ')} nằm ngoài khoảng mép trong mố xA1 - xA2`
      : '') +
    '.';
  if (e.style) e.style.color = bad || out.length ? '#c00000' : '#006100';
}

export function hvPierEx(): void {
  const t = $('hv_piers');
  if (!t) return;
  const a1 = parseFloat(String(($('hv_xA1') || {}).value).replace(',', '.'));
  const a2 = parseFloat(String(($('hv_xA2') || {}).value).replace(',', '.'));
  if (!isFinite(a1) || !isFinite(a2) || a2 <= a1) {
    t.value = '50.0 1.5 9\n55.0 1.5 9';
  } else {
    const L = a2 - a1;
    const x1 = a1 + L / 3;
    const x2 = a1 + (2 * L) / 3;
    t.value = `${x1.toFixed(1)} 1.5 9\n${x2.toFixed(1)} 1.5 9`;
  }
  dispatchElEvents(t, ['input', 'change']);
}

export function hvPxShow(): void {
  const s = $('hv_pxm');
  const r = $('hv_Px');
  const tr = r?.closest?.('tr') as ContextElementLike | null | undefined;
  if (s && tr?.style) tr.style.display = s.value === 'u' ? '' : 'none';
}

export function hvA1Ref(R?: HvCalcResult | null): void {
  const box = $('hv_A1ref');
  if (!box || !HVTAB) return;
  const I = (R && R.I) || hvIn();
  const cls = I.cls;
  const tb = HVTAB.A1[cls as SoilTypeKey];
  if (!tb) {
    box.innerHTML = '<p class="small">Không có bảng cho cấp đất ' + cls + '.</p>';
    return;
  }
  const FGr: ReadonlyArray<[number, number, string]> = [
    [0, 4, 'F < 0,1'],
    [5, 6, '0,1 < F < 1,0'],
    [7, 9, '1,0 < F < 10'],
    [10, 11, '10 < F < 100'],
    [12, 12, 'F > 100'],
  ];
  const F = I.F;
  const gi = F < 0.1 ? 0 : F < 1 ? 1 : F < 10 ? 2 : F < 100 ? 3 : 4;
  const qd = R && R.Q && R.Pd != null && R.Q[R.Pd] ? R.Q[R.Pd].t : null;
  const A = qd && qd.A1;
  const ri = A ? A.ri : -1;
  const cs = A ? A.col : -1;
  const Hp = qd ? qd.Hp : NaN;
  const fm = (val: number | null): string =>
    val == null ? '-' : String(+val.toFixed(3)).replace('.', ',');
  let h =
    '<p class="small">Cấp đất ' +
    cls +
    (isFinite(Hp) ? '; HP = ' + hvF(Hp, 1) + ' mm' : '') +
    (isFinite(F) ? '; F = ' + hvF(F, 3) + ' km² (nhóm ' + FGr[gi][2] + ')' : '') +
    '. Hàng, nhóm tô màu là hàng và nhóm đang áp dụng; ô in đậm là giá trị đang dùng. Chỉ chọn được các cột thuộc nhóm diện tích của lưu vực; Bảng A.1 không phân định phạm vi diện tích của từng cột trong cùng một nhóm.</p>';
  h +=
    '<table class="t dt"><tr><th rowspan="2">HP (mm)</th>' +
    FGr.map(
      (g, k) =>
        `<th colspan="${g[1] - g[0] + 1}"${k === gi ? ' style="background:#fff2cc"' : ''}>${g[2]}</th>`,
    ).join('') +
    '</tr><tr>' +
    Array.from(
      { length: 13 },
      (_, c) =>
        `<th${c >= FGr[gi][0] && c <= FGr[gi][1] ? ' style="background:#fff2cc"' : ''}>${c + 3}</th>`,
    ).join('') +
    '</tr>';
  tb.v.forEach((row, r) => {
    h +=
      `<tr${r === ri ? ' style="background:#fff2cc"' : ''}><td class="l">${cls === 'VI' ? '-' : tb.lab?.[r] ?? '-'}</td>` +
      row
        .map((val, c) =>
          val == null
            ? '<td>-</td>'
            : !(c >= FGr[gi][0] && c <= FGr[gi][1])
              ? `<td style="color:#888">${fm(val)}</td>`
              : `<td class="pk" data-hvset="phc=${c}" style="cursor:pointer${c === cs && r === ri ? ';font-weight:bold;outline:2px solid #c00000' : c >= FGr[gi][0] && c <= FGr[gi][1] && r === ri ? ';background:#ffe08a' : ''}">${fm(val)}</td>`,
        )
        .join('') +
      '</tr>';
  });
  box.innerHTML = h + '</table>';
}

export function hvPreset(): void {
  const vals: Record<string, string> = {
    coh: '0',
    km: 'bel',
    mum: '1',
    Pt: 'hs',
    bctm: 'htb',
    v0m: 'cau',
    lxm: 'max',
    etm: 'auto',
    dlt: '0',
    zm: 's2',
    soil: 'cung',
    xm: 'lis',
    pm: 'dhxd',
    am: 'auto',
    lpm: 'non',
  };
  let last: ContextElementLike | null = null;
  Object.keys(vals).forEach((k) => {
    const e = $('hv_' + k);
    if (e) {
      e.value = vals[k];
      last = e;
    } else {
      sv('hv_' + k, vals[k]);
    }
  });
  if (last) dispatchElEvents(last, ['change']);
}

// ============================================================================
// 8. Calibration (`HVHC`, `HVDZ`, `hvHcFit`, `hvDzFit`, `hvAllFit`) & Shift
// ============================================================================

export const HVHC: Record<'i' | 'Jls' | 'Jsd' | 'lc', [number, number]> = {
  i: [0.05, 30],
  Jls: [1, 500],
  Jsd: [5, 1000],
  lc: [1, 500],
};

export const HVHCN: Record<'i' | 'Jls' | 'Jsd' | 'lc', string> = {
  i: 'i',
  Jls: 'Jls',
  Jsd: 'Jsd',
  lc: 'Bề rộng lòng chủ',
};

type HcParamKey = keyof typeof HVHC;

const hvHcP = (): HcParamKey => {
  const p = ($('hv_hcp') || {}).value || 'i';
  return p in HVHC ? (p as HcParamKey) : 'i';
};

function hvHcNum(id: string): number {
  return parseFloat(String(($('hv_' + id) || {}).value || '').replace(',', '.'));
}

function hvHcLc(): void {
  const P = hvPairs(($('hv_sec') || {}).value || '');
  if (P.length < 2) return;
  const xs = P.map((q) => q[0]);
  HVHC.lc = [1, Math.max(2, Math.max(...xs) - Math.min(...xs))];
}

export function hvHcGet(p: HcParamKey): number {
  if (p === 'lc') return hvHcNum('xR') - hvHcNum('xL');
  return parseFloat(String(($('hv_' + p) || {}).value || '').replace(',', '.'));
}

export function hvHcSet(p: HcParamKey, val: number): void {
  if (p === 'lc') {
    const c = (hvHcNum('xL') + hvHcNum('xR')) / 2;
    const m = $('hv_xlm');
    const a = $('hv_xL');
    const b = $('hv_xR');
    if (m) m.value = 'tay';
    if (a && b) {
      a.value = (c - val / 2).toFixed(2);
      b.value = (c + val / 2).toFixed(2);
      dispatchElEvents(a, ['change']);
    } else {
      sv('hv_xL', (c - val / 2).toFixed(2));
      sv('hv_xR', (c + val / 2).toFixed(2));
    }
    return;
  }
  const e = $('hv_' + p);
  if (!e) {
    sv('hv_' + p, (+val).toFixed(p === 'i' ? 3 : 1));
    return;
  }
  if (p === 'Jls') {
    const j = $('hv_jm');
    if (j) j.value = 'v';
  }
  e.value = (+val).toFixed(p === 'i' ? 3 : 1);
  dispatchElEvents(e, ['change']);
}

export function hvHcSlide(t: number): void {
  hvHcLc();
  const p = hvHcP();
  const [lo, hi] = HVHC[p];
  hvHcSet(p, lo * Math.pow(hi / lo, t / 1000));
}

function hvHcRng(
  hist: HvHistFlood[],
): { hi: HvHistFlood; lo: HvHistFlood | null; k: '1' | '12' | '23' } | null {
  const so = hist
    .filter((o) => isFinite(o.h))
    .slice()
    .sort((a, b) => b.h - a.h);
  const m = ($('hv_hct') || {}).value || '12';
  if (!so.length) return null;
  if (m === '23' && so.length >= 3) return { hi: so[1], lo: so[2], k: '23' };
  if (so.length >= 2) return { hi: so[0], lo: so[1], k: '12' };
  return { hi: so[0], lo: null, k: '1' };
}

export function hvHcShow(R: HvCalcResult): void {
  hvHcLc();
  const e = $('hv_hcInfo');
  const sl = $('hv_hcs');
  const p = hvHcP();
  const [lo, hi] = HVHC[p];
  const val = p === 'Jls' && R && R.Jls ? R.Jls : hvHcGet(p);
  if (sl && isFinite(val) && val > 0) {
    sl.value = String(Math.round((1000 * Math.log(val / lo)) / Math.log(hi / lo)));
  }
  if (!e || !R || !R.I) return;
  const hs = R.I.hist.filter((o) => isFinite(o.h));
  const nm =
    p === 'lc'
      ? `Lòng chủ ${hvF(R.I.xL, 2)} - ${hvF(R.I.xR, 2)} m (rộng ${hvF(val, 2)} m)`
      : `${HVHCN[p]} = ${hvF(val, p === 'i' ? 3 : 1)} ‰`;
  const G = hvHcRng(hs);
  if (!G) {
    const txt = `${nm}: H${pP(R.Pd)} = ${hvF(R.Htk, 3)} m. Chưa nhập mực nước lũ lịch sử điều tra để so sánh.`;
    e.textContent = txt;
    setOutputValue('hv_hcInfo', txt);
    return;
  }
  const H = R.Htk;
  const w =
    ($('hv_hct') || {}).value === '23' && G.k !== '23'
      ? ' (chưa đủ 3 mực nước lũ lịch sử, xét theo hai lũ cao nhất)'
      : '';
  const html =
    `${nm}: Q${pP(R.Pd)} = ${hvF(R.Q[R.Pd].Q, 2)} m³/s ; H${pP(R.Pd)} = <b>${hvF(H, 3)} m</b> ; các lũ điều tra: ${hs.map((o) => o.y + ': ' + hvF(o.h, 2)).join(', ')} m ⇒ ` +
    (H > G.hi.h + 1e-9
      ? `<b class="bad">cao hơn lũ năm ${G.hi.y} (${hvF(G.hi.h, 2)} m) ${hvF(H - G.hi.h, 2)} m</b>`
      : G.lo && H < G.lo.h - 1e-9
        ? `<b class="bad">thấp hơn lũ năm ${G.lo.y} (${hvF(G.lo.h, 2)} m) ${hvF(G.lo.h - H, 2)} m</b>`
        : `<b class="ok">nằm ${G.lo ? 'trong khoảng lũ năm ' + G.lo.y + ' - ' + G.hi.y + ' (' + hvF(G.lo.h, 2) + ' - ' + hvF(G.hi.h, 2) + ' m)' : 'dưới lũ năm ' + G.hi.y + ' (' + hvF(G.hi.h, 2) + ' m)'}</b>`) +
    w;
  e.innerHTML = html;
  setOutputValue('hv_hcInfo', html);
  hvDzShow(R);
}

export function hvHcFit(): void {
  const I = hvIn();
  const R = hvCalc(I);
  const e = $('hv_hcInfo');
  if (R.err.length || !R.Q || !R.Q[R.Pd]) {
    if (e) e.textContent = R.err.join(' ');
    return;
  }
  const hs = I.hist.filter((o) => isFinite(o.h));
  if (!hs.length) {
    if (e) e.textContent = 'Nhập mực nước lũ lịch sử điều tra trước.';
    return;
  }
  const G = hvHcRng(hs)!;
  const tg = G.lo ? (G.hi.h + G.lo.h) / 2 : G.hi.h;
  const p = hvHcP();
  hvHcLc();
  const c = (I.xL + I.xR) / 2;
  const Hof = (val: number): number => {
    const J: HvInput = { ...I };
    if (p === 'i') J.i = val / 1000;
    else if (p === 'Jls') {
      J.Jls = val;
      J.jm = 'v';
    } else if (p === 'lc') {
      J.xL = c - val / 2;
      J.xR = c + val / 2;
    } else J.Jsd = val;
    const r = hvCalc(J);
    return r.err.length ? NaN : r.Htk;
  };
  let [lo, hi] = HVHC[p];
  const hl = Hof(lo);
  const hh = Hof(hi);
  const inc = hh > hl;
  if (!isFinite(hl) || !isFinite(hh) || (hl - tg) * (hh - tg) > 0) {
    if (e) {
      e.textContent =
        'Trong phạm vi thử, ' +
        HVHCN[p] +
        ' không đưa được mực nước thiết kế vào khoảng lũ lịch sử: chọn giá trị khác để thử.';
    }
    return;
  }
  for (let k = 0; k < 40; k++) {
    const m = Math.sqrt(lo * hi);
    const d = Hof(m) - tg;
    if (d > 0 === inc) hi = m;
    else lo = m;
  }
  hvHcSet(p, Math.sqrt(lo * hi));
}

export const HVDZ: { msg?: string } = {};

export function hvDzShow(R: HvCalcResult): void {
  const e = $('hv_dzInfo');
  if (!e || !R || !R.Z) return;
  const t = parseFloat(String(($('hv_dzt') || {}).value || '0.10').replace(',', '.'));
  const html =
    `Hiện tại: ΔZ = <b>${hvF(R.Z.dz, 3)} m</b> ` +
    (R.Z.dz <= t + 5e-4
      ? `<b class="ok">(không vượt ${hvF(t, 2)} m)</b>`
      : `<b class="bad">(vượt ${hvF(t, 2)} m)</b>`) +
    (R.K && R.K.Lct != null && isFinite(R.K.Lct)
      ? ` ; Lct = ${hvF(R.K.Lct, 2)} m ` +
        (R.K.ok
          ? `<b class="ok">≤ L0 = ${hvF(R.K.Lo, 2)} m</b>`
          : `<b class="bad">> L0 = ${hvF(R.K.Lo, 2)} m</b>`)
      : '') +
    (HVDZ.msg ? ' ; ' + HVDZ.msg : '');
  e.innerHTML = html;
  setOutputValue('hv_dzInfo', html);
}

const dzOk = <T,>(L: T[]): boolean => L.length > 0;

export function hvDzFit(): void {
  const I = hvIn();
  const e = $('hv_dzInfo');
  const t = parseFloat(String(($('hv_dzt') || {}).value || '0.10').replace(',', '.'));
  HVDZ.msg = '';
  const R0 = hvCalc(I);
  if (R0.err.length) {
    if (e) e.textContent = R0.err.join(' ');
    return;
  }
  hvHcLc();
  const p = hvHcP();
  const [lo, hi] = HVHC[p];
  const c = (I.xL + I.xR) / 2;
  const v0 = p === 'lc' ? I.xR - I.xL : p === 'i' ? I.i * 1000 : p === 'Jls' ? R0.Jls : I.Jsd;
  const G = hvHcRng(I.hist);

  interface DzSample {
    v: number;
    dz: number;
    H: number;
    okH: boolean;
  }
  const run = (val: number): DzSample | null => {
    const J: HvInput = { ...I };
    if (p === 'i') J.i = val / 1000;
    else if (p === 'Jls') {
      J.Jls = val;
      J.jm = 'v';
    } else if (p === 'lc') {
      J.xL = c - val / 2;
      J.xR = c + val / 2;
    } else J.Jsd = val;
    const r = hvCalc(J);
    if (r.err.length) return null;
    const H = r.Htk;
    return { v: val, dz: r.Z.dz, H, okH: !G || (H <= G.hi.h + 1e-9 && (!G.lo || H >= G.lo.h - 1e-9)) };
  };
  {
    const r0 = run(v0);
    if (r0 && r0.dz <= t + 5e-4 && r0.okH) {
      HVDZ.msg = 'giá trị đang nhập đã thỏa cả ΔZ và mực nước theo lũ điều tra.';
      hvDzShow(R0);
      return;
    }
  }
  const N = 40;
  const pts: DzSample[] = [];
  for (let k = 0; k <= N; k++) {
    const r = run(lo * Math.pow(hi / lo, k / N));
    if (r) pts.push(r);
  }
  const both = pts.filter((q) => q.dz <= t && q.okH);
  const dzok = pts.filter((q) => q.dz <= t);
  const nm = HVHCN[p];
  const u = p === 'lc' ? ' m' : ' ‰';
  const fv = (val: number): string => hvF(val, p === 'i' ? 3 : p === 'lc' ? 2 : 1) + u;
  const pick = (L: DzSample[]): DzSample =>
    L.reduce((b, q) => (Math.abs(Math.log(q.v / v0)) < Math.abs(Math.log(b.v / v0)) ? q : b), L[0]);
  if (both.length) {
    const q = pick(both);
    HVDZ.msg = `${nm} thỏa cả ΔZ ≤ ${hvF(t, 2)} m và mực nước theo lũ điều tra trong khoảng ${fv(Math.min(...both.map((x) => x.v)))} - ${fv(Math.max(...both.map((x) => x.v)))}; đã lấy ${fv(q.v)} (gần giá trị đang nhập nhất): ΔZ = ${hvF(q.dz, 3)} m, H = ${hvF(q.H, 3)} m.`;
    hvHcSet(p, q.v);
    return;
  }
  if (dzOk(dzok)) {
    const q = pick(dzok);
    HVDZ.msg = `${nm} = ${fv(q.v)} cho ΔZ = ${hvF(q.dz, 3)} m nhưng mực nước thiết kế H = ${hvF(q.H, 3)} m không còn thỏa tiêu chí so với lũ điều tra: không có giá trị ${nm} thỏa cả hai, chọn giá trị khác để thử.`;
  } else {
    const q = pts.reduce((b, x) => (x.dz < b.dz ? x : b), pts[0]);
    HVDZ.msg = q
      ? `trong phạm vi thử ${nm}, ΔZ nhỏ nhất ${hvF(q.dz, 3)} m (tại ${fv(q.v)}), chưa đạt ${hvF(t, 2)} m: chọn giá trị khác để thử.`
      : 'không tính được.';
  }
  hvDzShow(R0);
}

export async function hvAllFit(): Promise<void> {
  const e = $('hv_dzInfo');
  const I = hvIn();
  const t = parseFloat(String(($('hv_dzt') || {}).value || '0.10').replace(',', '.'));
  const R0 = hvCalc(I);
  if (R0.err.length) {
    if (e) e.textContent = R0.err.join(' ');
    return;
  }
  hvHcLc();
  const G = hvHcRng(I.hist);
  const c = (I.xL + I.xR) / 2;
  const cur: Record<HcParamKey, number> = {
    i: I.i * 1000,
    Jls: R0.Jls,
    Jsd: I.Jsd,
    lc: I.xR - I.xL,
  };
  const app = (J: HvInput, p: HcParamKey, val: number): void => {
    if (p === 'i') J.i = val / 1000;
    else if (p === 'Jls') {
      J.Jls = val;
      J.jm = 'v';
    } else if (p === 'lc') {
      J.xL = c - val / 2;
      J.xR = c + val / 2;
    } else J.Jsd = val;
  };
  const ev = (setCfg: Partial<Record<HcParamKey, number>>): HvAllFitCandidate | null => {
    const J: HvInput = { ...I };
    for (const p of Object.keys(setCfg) as HcParamKey[]) {
      const val = setCfg[p];
      if (val != null) app(J, p, val);
    }
    const r = hvCalc(J);
    if (r.err.length) return null;
    const H = r.Htk;
    return {
      set: setCfg,
      H,
      dz: r.Z.dz,
      Lct: r.K.Lct ?? NaN,
      Lo: r.K.Lo,
      okH: !G || (H <= G.hi.h + 1e-9 && (!G.lo || H >= G.lo.h - 1e-9)),
      okZ: r.Z.dz <= t + 5e-4,
      okK: !!r.K.ok,
    };
  };
  const all = (q: HvAllFitCandidate | null): q is HvAllFitCandidate =>
    Boolean(q && q.okH && q.okZ && q.okK);
  const cost = (setCfg: Partial<Record<HcParamKey, number>>): number =>
    (Object.keys(setCfg) as HcParamKey[]).reduce(
      (a, p) => a + Math.abs(Math.log((setCfg[p] as number) / cur[p])),
      0,
    );
  const fv = (p: HcParamKey, val: number): string =>
    p === 'lc' ? hvF(val, 2) + ' m' : hvF(val, p === 'i' ? 3 : 1) + ' ‰';
  const nm: Record<HcParamKey, string> = {
    i: 'i',
    Jls: 'Jls',
    Jsd: 'Jsd',
    lc: 'bề rộng lòng chủ',
  };
  const q0 = ev({});
  if (all(q0)) {
    HVDZ.msg = '<b class="ok">số liệu đang nhập đã thỏa cả ba điều kiện.</b>';
    hvDzShow(R0);
    return;
  }
  const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
  const grid = (p: HcParamKey, n: number): number[] => {
    const lo = Math.max(HVHC[p][0], cur[p] / 2);
    const hi = Math.min(HVHC[p][1], cur[p] * 2);
    const a: number[] = [];
    for (let k = 0; k <= n; k++) a.push(lo * Math.pow(hi / lo, k / n));
    return a;
  };
  let best: HvAllFitCandidate | null = null;
  let near: { q: HvAllFitCandidate; sc: number } | null = null;
  const P: HcParamKey[] = ['i', 'Jls', 'Jsd', 'lc'];
  const take = (q: HvAllFitCandidate | null): void => {
    if (!q) return;
    if (all(q) && (!best || cost(q.set) < cost(best.set))) best = q;
    const sc = (q.okH ? 0 : 1) + (q.okZ ? 0 : 1) + (q.okK ? 0 : 1);
    if (!near || sc < near.sc || (sc === near.sc && q.dz < near.q.dz)) near = { q, sc };
  };
  for (const p of P) {
    if (e) e.textContent = 'Đang thử ' + nm[p] + '...';
    await tick();
    for (const val of grid(p, 16)) take(ev({ [p]: val }));
  }
  if (!best) {
    const pairs: Array<[HcParamKey, HcParamKey]> = [
      ['i', 'Jls'],
      ['i', 'Jsd'],
      ['i', 'lc'],
    ];
    for (const [a, b] of pairs) {
      if (e) e.textContent = 'Đang thử kết hợp ' + nm[a] + ' và ' + nm[b] + '...';
      await tick();
      for (const u of grid(a, 8)) for (const w of grid(b, 8)) take(ev({ [a]: u, [b]: w }));
    }
  }
  const foundBest = best as HvAllFitCandidate | null;
  if (foundBest) {
    HVDZ.msg =
      `<b class="ok">đã tìm được:</b> ` +
      (Object.keys(foundBest.set) as HcParamKey[])
        .map((p) => `${nm[p]} = ${fv(p, foundBest.set[p] as number)} (đang nhập ${fv(p, cur[p])})`)
        .join(' ; ') +
      ` ⇒ H = ${hvF(foundBest.H, 3)} m ; ΔZ = ${hvF(foundBest.dz, 3)} m ; Lct = ${hvF(foundBest.Lct, 2)} m ≤ L0 = ${hvF(foundBest.Lo, 2)} m.`;
    for (const p of Object.keys(foundBest.set) as HcParamKey[]) {
      const val = foundBest.set[p];
      if (val != null) hvHcSet(p, val);
    }
    return;
  }
  const nearEntry = near as { q: HvAllFitCandidate; sc: number } | null;
  const q = nearEntry && nearEntry.q;
  HVDZ.msg =
    `<b class="bad">trong phạm vi độ dốc, ranh giới lòng chủ bằng 0,5 - 2 lần giá trị đo, không có giá trị nào thỏa cả ba điều kiện.</b>` +
    (q
      ? ' Gần nhất: ' +
        ((Object.keys(q.set) as HcParamKey[])
          .map((p) => nm[p] + ' = ' + fv(p, q.set[p] as number))
          .join(' ; ') || 'số liệu đang nhập') +
        ` ⇒ H = ${hvF(q.H, 3)} m (${q.okH ? 'đạt' : 'không đạt'} tiêu chí lũ điều tra) ; ΔZ = ${hvF(q.dz, 3)} m (${q.okZ ? 'không vượt' : 'vượt'} ${hvF(t, 2)} m) ; Lct = ${hvF(q.Lct, 2)} m (${q.okK ? '≤' : '>'} L0 = ${hvF(q.Lo, 2)} m).`
      : '') +
    ' Cần chọn mức dềnh lớn hơn, bố trí cống trên bãi hoặc tăng khẩu độ.';
  hvDzShow(R0);
}

// dời lý trình mặt cắt và các số liệu cùng gốc (mép mố, ranh giới lòng chủ, trụ) theo lý trình điểm đầu
export function hvSecShift(x0?: number, quiet?: boolean | number): void {
  const ta = $('hv_sec');
  if (!ta) return;
  const targetX0 = x0 !== undefined && isFinite(x0) ? x0 : hvKm(($('hv_sx0') || {}).value);
  const P = hvPairs(ta.value).sort((a, b) => a[0] - b[0]);
  const e = $('hv_sxInfo');
  if (!isFinite(targetX0) || P.length < 2) {
    if (e && !quiet) e.textContent = 'Nhập lý trình điểm đầu (ví dụ Km0+450 hoặc 450).';
    return;
  }
  const d = targetX0 - P[0][0];
  if (Math.abs(d) < 1e-9) {
    if (e && !quiet) e.textContent = 'Mặt cắt đã bắt đầu tại lý trình này.';
    return;
  }
  const f = (val: number): string => (+val).toFixed(2);
  const setInput = (id: string, val: string): void => {
    const q = $('hv_' + id);
    if (q) {
      q.value = val;
      dispatchElEvents(q, ['input', 'change']);
    }
  };
  ta.value = P.map((p) => `${f(p[0] + d)} ${p[1]}`).join('\n');
  ['xA1', 'xA2', 'xL', 'xR'].forEach((id) => {
    const q = $('hv_' + id);
    if (q && String(q.value).trim() !== '') {
      const val = hvKm(q.value);
      if (isFinite(val)) q.value = f(val + d);
    }
  });
  const pq = $('hv_piers');
  if (pq && pq.value.trim()) {
    pq.value = hvPairs(pq.value)
      .map((a) => [f(a[0] + d), ...a.slice(1)].join(' '))
      .join('\n');
  }
  const sr = $('hv_secR');
  if (sr && sr.value.trim()) sr.value = '';
  setInput('sec', ta.value);
  if (e) {
    e.textContent = `Đã dời lý trình ${d > 0 ? '+' : ''}${f(d)} m: mặt cắt bắt đầu tại ${hvKmF(targetX0)}; mép mố, ranh giới lòng chủ, trụ dời theo.`;
  }
}

// ============================================================================
// 9. Cowan Roughness Components & Historical Flood Calibration (`NCW`/`NCL`)
// ============================================================================

export type NcKey = 'n0' | 'n1' | 'n2' | 'n3' | 'n4' | 'm5';
export type NcSide = 'ch' | 'b';

export const NCW: Record<NcKey, Array<[string, number]>> = {
  n0: [
    ['Đất', 0.02],
    ['Đá đẽo', 0.025],
    ['Sỏi mịn', 0.024],
    ['Sỏi thô, cuội', 0.028],
  ],
  n1: [
    ['Nhẵn', 0],
    ['Ít gồ ghề', 0.005],
    ['Gồ ghề vừa', 0.01],
    ['Rất gồ ghề', 0.02],
  ],
  n2: [
    ['Mặt cắt thay đổi dần', 0],
    ['Thay đổi thỉnh thoảng', 0.005],
    ['Thay đổi thường xuyên', 0.0125],
  ],
  n3: [
    ['Vật cản không đáng kể', 0],
    ['Vật cản ít', 0.0125],
    ['Vật cản đáng kể', 0.025],
    ['Vật cản nhiều', 0.05],
  ],
  n4: [
    ['Cây cỏ thấp', 0.0075],
    ['Cây cỏ trung bình', 0.0175],
    ['Cây cỏ cao', 0.0375],
    ['Cây cỏ rất cao, rậm', 0.075],
  ],
  m5: [
    ['Uốn khúc ít', 1.0],
    ['Uốn khúc vừa', 1.15],
    ['Uốn khúc nhiều', 1.3],
  ],
};

export const NCL: Record<NcKey, string> = {
  n0: 'n0 - vật liệu lòng',
  n1: 'n1 - mức gồ ghề',
  n2: 'n2 - thay đổi mặt cắt',
  n3: 'n3 - vật cản',
  n4: 'n4 - cây cỏ',
  m5: 'm5 - uốn khúc',
};

export function ncSel(p: NcSide | string, k: NcKey, d: number): string {
  return (
    `<select class="in" id="nc_${p}_${k}" style="width:150px">` +
    NCW[k]
      .map(
        (o, i) =>
          `<option value="${o[1]}"${i === d ? ' selected' : ''}>${o[0]} (${String(o[1]).replace('.', ',')})</option>`,
      )
      .join('') +
    '</select>'
  );
}

export function ncVal(p: NcSide | string): number {
  const g = (k: NcKey): number => +(($(`nc_${p}_${k}`) || {}).value || 0);
  return (g('n0') + g('n1') + g('n2') + g('n3') + g('n4')) * g('m5');
}

export function ncUpd(): void {
  (['ch', 'b'] as const).forEach((p) => {
    const e = $('nc_' + p + '_v');
    const txt = ncVal(p).toFixed(3).replace('.', ',');
    if (e) e.textContent = txt;
    setOutputValue('nc_' + p + '_v', txt);
  });
}

export function ncSet(p: NcSide | string): void {
  const valStr = ncVal(p).toFixed(3);
  const id = p === 'ch' ? 'hv_nch' : 'hv_nb';
  const e = $(id);
  if (!e) {
    sv(id, valStr);
    return;
  }
  e.value = valStr;
  dispatchElEvents(e, ['input', 'change']);
}

// hiệu chỉnh theo lũ lịch sử
export function ncCal(): void {
  const out = $('nc_cal');
  if (!out) return;
  const I0 = hvIn();
  const H = I0.hist.filter((o) => o.N > 1);
  if (!H.length) {
    const msg =
      '<span style="color:#c00000">Chưa có lũ lịch sử nào ghi chu kỳ lặp lại N (năm). Ghi thêm cột thứ 3 vào ô lũ lịch sử, ví dụ "2025 39.27 50" nếu lũ 2025 ước khoảng 50 năm mới gặp một lần.</span>';
    out.innerHTML = msg;
    setOutputValue('nc_cal', msg);
    return;
  }
  const res = H.map((o) => {
    const Pa = 100 / o.N;
    const Hof = (k: number): number => {
      const R = hvCalc({ ...I0, nch: I0.nch * k, nb: I0.nb * k, Pa });
      return R.H && R.H[Pa] != null ? R.H[Pa] : NaN;
    };
    let a = 0.3;
    let b = 3;
    let fa = Hof(a) - o.h;
    const fb = Hof(b) - o.h;
    if (!(fa * fb < 0)) return { o, Pa, k: NaN, H1: Hof(1) };
    for (let i = 0; i < 30 && b - a > 1e-4; i++) {
      const m = (a + b) / 2;
      const fm = Hof(m) - o.h;
      if (fa * fm <= 0) {
        b = m;
      } else {
        a = m;
        fa = fm;
      }
    }
    return { o, Pa, k: (a + b) / 2, H1: Hof(1) };
  });
  const ks = res.map((r) => r.k).filter(isFinite);
  const km = ks.length ? ks.reduce((x, y) => x + y, 0) / ks.length : NaN;
  const html =
    '<table class="t dt"><tr><th>Lũ</th><th>N (năm) ; P (%)</th><th>Mực nước điều tra (m)</th><th>H tính với n hiện tại (m)</th><th>Hệ số điều chỉnh n</th><th>nch ; nb sau hiệu chỉnh</th></tr>' +
    res
      .map(
        (r) =>
          `<tr><td>${r.o.y}</td><td>${r.o.N} ; ${hvF(r.Pa, 2)}</td><td>${hvF(r.o.h, 2)}</td><td>${hvF(r.H1, 2)}</td><td>${isFinite(r.k) ? hvF(r.k, 3) : 'không tìm được'}</td><td>${isFinite(r.k) ? hvF(I0.nch * r.k, 3) + ' ; ' + hvF(I0.nb * r.k, 3) : '-'}</td></tr>`,
      )
      .join('') +
    '</table>' +
    (isFinite(km)
      ? `<p class="small">Trung bình hệ số điều chỉnh ${hvF(km, 3)} → nch = ${hvF(I0.nch * km, 3)}, nb = ${hvF(I0.nb * km, 3)}. <button type="button" class="btn2" data-nccalset="${km}">Gán n đã hiệu chỉnh</button> Kết quả chỉ tin cậy khi chu kỳ lũ điều tra được đánh giá có cơ sở (hỏi dân, đối chiếu trạm thủy văn lân cận).</p>`
      : '<p class="small" style="color:#c00000">Không tìm được hệ số n phù hợp trong khoảng 0,3 - 3 lần n hiện tại: kiểm tra lại chu kỳ lũ hoặc mặt cắt.</p>');
  out.innerHTML = html;
  setOutputValue('nc_cal', html);
}

export function ncCalSet(k: number): void {
  const I0 = hvIn();
  (
    [
      ['hv_nch', I0.nch * k],
      ['hv_nb', I0.nb * k],
    ] as const
  ).forEach(([id, val]) => {
    const e = $(id);
    if (e) {
      e.value = val.toFixed(3);
      dispatchElEvents(e, ['input', 'change']);
    } else {
      sv(id, val.toFixed(3));
    }
  });
  ncCal();
}

// độ nhạy: mực nước thiết kế khi n thay đổi
export function ncSens(): void {
  const out = $('nc_sens');
  if (!out) return;
  const I0 = hvIn();
  const rows = [0.8, 0.9, 1, 1.1, 1.2].map((k) => {
    const R = hvCalc({ ...I0, nch: I0.nch * k, nb: I0.nb * k });
    return [k, I0.nch * k, I0.nb * k, R.Htk] as const;
  });
  const html =
    '<table class="t dt"><tr><th>n so với hiện tại</th><th>nch</th><th>nb</th><th>Mực nước thiết kế (m)</th></tr>' +
    rows
      .map(
        (r) =>
          `<tr${r[0] === 1 ? ' style="background:#fff2cc"' : ''}><td>${Math.round(r[0] * 100)}%</td><td>${hvF(r[1], 3)}</td><td>${hvF(r[2], 3)}</td><td>${hvF(r[3], 3)}</td></tr>`,
      )
      .join('') +
    '</table>';
  out.innerHTML = html;
  setOutputValue('nc_sens', html);
}

// ============================================================================
// 10. Station Reasoning (`hvStRows`, `hvStWhyAuto`, `hvStSec`, `hvStWhyFill`)
// ============================================================================

export const HVSTC: Record<string, unknown> = {};

export function hvStRows(I: HvInput, _Pd?: number): HvStRowsResult {
  const cs = ($('hv_dcs') || {}).value;
  const k0 = parseFloat(($('hv_dk0') || {}).value || '') || 105;
  const E0 = parseFloat(String(($('hv_dE') || {}).value).replace(',', '.'));
  const N0 = parseFloat(String(($('hv_dN') || {}).value).replace(',', '.'));
  let E = E0;
  let N = N0;
  try {
    if (cs === 'll' && isFinite(E0) && isFinite(N0)) {
      [E, N] = HVD.toVN(105, E0, N0);
    } else if (k0 !== 105 && isFinite(E0) && isFinite(N0)) {
      const [a, b] = HVD.fromVN(k0, E0, N0);
      [E, N] = HVD.toVN(105, a, b);
    }
  } catch {
    // preserve raw coordinates if projection throws in partial test inputs
  }
  const has = isFinite(E) && isFinite(N);
  const Z = HVD.S.zst || {};
  const dirs = ['Bắc', 'Đông Bắc', 'Đông', 'Đông Nam', 'Nam', 'Tây Nam', 'Tây', 'Tây Bắc'];
  const rows: HvStRowEntry[] = HVSTL.map((s) => {
    const dx = s.E - E;
    const dy = s.N - N;
    const d = has ? Math.hypot(dx, dy) / 1000 : NaN;
    const az = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
    return { ...s, d, dir: has ? dirs[Math.round(az / 45) % 8] : '', z: Z[s.n] };
  });
  if (I.st && !rows.some((r) => r.n === I.st)) {
    rows.push({ n: I.st, vt: '', d: NaN, dir: '', z: null });
  }
  rows.sort((a, b) => (isFinite(a.d) ? a.d : 1e9) - (isFinite(b.d) ? b.d : 1e9));
  return { rows, has, E, N, zc: Z._ct, src: HVD.S.zsrc };
}

export const hvStLoc = (r: HvStRowEntry): string =>
  r.vt ? (r.cu ? `${r.vt} (trước đây: ${r.cu})` : r.vt) : r.cu || '';

export const hvStNm = (r: HvStRowEntry): string =>
  r.lo ? `${r.n} (${r.lo === 'M' ? 'ĐM' : r.lo})` : r.n;

export const hvTerr = (q: { zm: number; zx: number; zn: number } | null | undefined): string =>
  !q
    ? ''
    : q.zm >= 300 || q.zx - q.zn >= 400
      ? 'miền núi'
      : q.zm >= 100 || q.zx - q.zn >= 150
        ? 'đồi núi thấp, trung du'
        : 'đồng bằng';

export function hvStWhyAuto(I: HvInput, T: HvStRowsResult): string {
  const r = T.rows.find((x) => x.n === I.st);
  const st = I.st || '…';
  const tr = T.zc ? hvTerr(T.zc) : '';
  const dd =
    tr === 'miền núi'
      ? 'đồi núi cao, bị chia cắt mạnh bởi các khe, suối tự nhiên'
      : tr === 'đồng bằng'
        ? 'tương đối bằng phẳng, có hệ thống kênh mương, sông suối tự nhiên'
        : 'đồi núi thấp, bị chia cắt bởi các khe, suối tự nhiên';
  return (
    `Khu vực nghiên cứu thuộc ${I.stvt || '…'}. Qua xem xét vị trí địa lý, đặc điểm địa hình, điều kiện khí hậu và phạm vi lưu vực, trạm mưa ${st} được lựa chọn làm trạm đại diện để tính toán thủy văn. ` +
    `Khu vực công trình có đặc điểm địa hình ${dd}, điều kiện địa hình và chế độ mưa tương đồng với khu vực đặt trạm ${st}. ` +
    `Đồng thời, khoảng cách từ trạm đến khu vực nghiên cứu tương đối gần${r && isFinite(r.d) ? ` (khoảng ${hvF(r.d, 1)} km)` : ''}, bảo đảm tính đại diện của số liệu mưa. ` +
    `Vì vậy, số liệu mưa của trạm ${st} được sử dụng làm cơ sở tính toán thủy văn; số liệu của các trạm lân cận được sử dụng để kiểm tra và đối chiếu khi cần thiết.`
  );
}

export function hvStSec(I: HvInput, Pd: number): string {
  const T = hvStRows(I, Pd);
  let h = '<p><b>a) Cơ sở lựa chọn trạm mưa</b></p>';
  const near = T.rows
    .filter((r) => isFinite(r.d))
    .slice(0, 5)
    .map((r) => r.n);
  const show = T.rows.filter((r) => r.n === I.st || near.includes(r.n));
  h += hvTab(
    [
      'Trạm',
      'Vị trí trạm (từ 01/7/2025)',
      'Trước sắp xếp',
      'Cách công trình (km)',
      'Hướng',
      'Cao độ địa hình bán kính 5 km (m)',
    ],
    show.map((r) => ({
      sel: r.n === I.st,
      c: [
        `<span style="white-space:nowrap">${hvStNm(r) + (r.gd ? '*' : '')}</span>`,
        r.vt || '-',
        (r.cu || '-')
          .replace(/thị trấn /g, 'TT ')
          .replace(/thị xã /g, 'TX ')
          .replace(/huyện /g, 'H. ')
          .replace(/phường /g, 'P. '),
        isFinite(r.d) ? hvF(r.d, 1) : '-',
        r.dir || '-',
        r.z ? hvF(r.z.zn, 0) + ' - ' + hvF(r.z.zx, 0) : '-',
      ],
    })),
  );
  const nt: string[] = [];
  if (!T.has) {
    nt.push('chưa nhập tọa độ công trình (phần khoanh lưu vực) nên chưa tính được khoảng cách');
  }
  if (!T.zc) nt.push('cao độ địa hình lấy từ mô hình số độ cao sau khi khoanh lưu vực');
  void nt;
  h += hvP('KT - trạm khí tượng, TV - trạm thủy văn, ĐM - điểm đo mưa.');

  const hooks = getVisualHooks() as VisualReportHooks & {
    renderBridgeStationMap?: (input: HvInput, table: HvStRowsResult) => string;
  };
  const globalStMap = (
    globalThis as { hvStMap?: (input: HvInput, table: HvStRowsResult) => string }
  ).hvStMap;
  if (typeof hooks.renderBridgeStationMap === 'function') {
    h += hooks.renderBridgeStationMap(I, T);
  } else if (typeof globalStMap === 'function') {
    h += globalStMap(I, T);
  } else {
    h += '<div id="hv_stMap"></div>';
  }

  h += `<p>${(I.stWhy || hvStWhyAuto(I, T)).replace(/</g, '&lt;').replace(/\n/g, '<br>')}</p><p><b>b) Thống kê lượng mưa ngày lớn nhất trạm đại diện</b></p>`;
  return h;
}

export async function hvStWhyFill(): Promise<void> {
  const ta = $('hv_stWhy');
  if (!ta) return;
  try {
    if (!HVD.S.zst) {
      await HVD.libs();
      await hdLoad('cop');
      await hdZst();
    }
  } catch {
    // ignore offline DEM absence
  }
  const I = hvIn();
  const R = hvCalc(I);
  ta.value = hvStWhyAuto(I, hvStRows(I, R.Pd));
  dispatchElEvents(ta, ['input']);
}

// ============================================================================
// 11. HTML Calculation Sheet Formatting, `hvRender`, `hvLink`, `hvStep`
// ============================================================================

export const hvLong = (val: string | number | null | undefined): boolean => {
  const t = String(val == null ? '' : val).replace(/<[^>]+>/g, '');
  return t.length > 16 && !/^[-\d.,; ]+$/.test(t);
};

export function hvRow(
  lab: string,
  sym: string,
  val: string | number | null | undefined,
  unit: string,
  note: string,
  f?: number | boolean,
): string {
  return `<div class="row${f ? ' f' : ''}"><span></span><span>${lab}</span><span class="sym">${sym || ''}</span><span class="val">${val == null ? '' : val}</span><span class="unit">${unit || ''}</span><span class="note">${note || ''}</span></div>`;
}

export const hvHead = (t: string): string => `<div class="row"><span></span><span>${t}</span></div>`;
export const hvSrc = (s?: string): string => (s ? ` <i>(${s})</i>` : '');

type StepTuple = [string, string, string, string, string, string];
type StepItem = StepTuple | { grp: string };

// bảng các bước: [nội dung, công thức (TeX), ký hiệu, giá trị, đơn vị, căn cứ] ; {grp} dòng tiêu đề nhóm
export function hvStepT(rows: StepItem[]): string {
  return rows
    .flatMap((r): StepItem[] => {
      if ('grp' in r || !/ ; /.test(r[2] || '')) return [r];
      const L = r[0].split(' ; ');
      const S = r[2].split(' ; ');
      const V = String(r[3]).split(' ; ');
      if (S.length === V.length && !r[1]) {
        return S.map((sy, k): StepTuple => [
          L.length === S.length ? L[k].charAt(0).toUpperCase() + L[k].slice(1) : r[0],
          '',
          sy,
          V[k],
          r[4],
          k === S.length - 1 ? r[5] : '',
        ]);
      }
      return [[r[0] + ' ' + r[2] + ' = ' + r[3] + (r[4] ? ' ' + r[4] : ''), r[1], '', '', '', r[5]]];
    })
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

export interface HvMethItem {
  n: string;
  src?: string;
  tex?: string;
  p?: string;
  sym: string;
  val: string;
  unit: string;
  note?: string;
  sel?: boolean;
}

export function hvMeth(list: HvMethItem[]): string {
  return list
    .map((m, i) => {
      const nm = `${String.fromCharCode(97 + i)}) ${m.sel ? '<b>' : ''}${m.n}${m.sel ? ' (chọn)</b>' : ''}${hvSrc(m.src)}`;
      if (!m.tex) return hvRow(nm + (m.p ? '; ' + m.p : ''), m.sym, m.val, m.unit, m.note || '');
      return (
        hvHead(nm + (m.p ? '; ' + m.p : '')) +
        hvRow(hvM(m.tex), m.sym, m.val, m.unit, m.note || '', 1)
      );
    })
    .join('');
}

export const hvTab = (
  head: string[],
  rows: Array<string[] | { sel?: boolean; c: string[] }>,
): string =>
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
  '</table>';

export const hvP = (t: string): string => `<p class="small">${t}</p>`;
export const hvApC = (a?: ApplicabilityPair | null): string =>
  !a || a[0] ? 'Thỏa mãn' : 'Không thỏa mãn: ' + a[1];
export const hvApW = (n: string, a?: ApplicabilityPair | null): string =>
  a && !a[0]
    ? hvP(`<span class="bad">Điều kiện áp dụng của ${n} không thỏa mãn: ${a[1]}.</span>`)
    : '';
export const hvAllT = (n: string): string => hvP(`<b>Kết quả lấy theo ${n}</b>.`);
export const hvSel = (t: string): string => `<p><b>Chọn kết quả tính theo ${t}.</b></p>`;
export const pP = (P: number): string => String(+P.toFixed(4)).replace('.', ',') + '%';

export function hvSegs(S: HvSecModel, H: number, parts: HvSecPartResult[]): HvSegGroup[] {
  const p = S.pts;
  const z = (x: number): number => {
    if (x <= p[0][0]) return p[0][1];
    for (let i = 1; i < p.length; i++) {
      if (x <= p[i][0]) {
        return (
          p[i - 1][1] + ((p[i][1] - p[i - 1][1]) * (x - p[i - 1][0])) / (p[i][0] - p[i - 1][0])
        );
      }
    }
    return p[p.length - 1][1];
  };
  return parts
    .filter((q) => q.A > 0)
    .map((q) => {
      let xs = [q.x1, ...p.map((a) => a[0]).filter((x) => x > q.x1 && x < q.x2), q.x2];
      const cr: number[] = [];
      for (let i = 1; i < xs.length; i++) {
        const a = xs[i - 1];
        const b = xs[i];
        const za = z(a);
        const zb = z(b);
        if ((za - H) * (zb - H) < 0) cr.push(a + ((H - za) / (zb - za)) * (b - a));
      }
      xs = [...xs, ...cr].sort((a, b) => a - b);
      const rows: HvSegGroup['rows'] = [];
      let A = 0;
      let P = 0;
      let B = 0;
      for (let i = 1; i < xs.length; i++) {
        const a = xs[i - 1];
        const b = xs[i];
        if (b - a < 1e-6) continue;
        const za = z(a);
        const zb = z(b);
        const ha = Math.max(0, H - za);
        const hb = Math.max(0, H - zb);
        if (ha <= 1e-9 && hb <= 1e-9) continue;
        const w = ((ha + hb) / 2) * (b - a);
        const x = Math.hypot(b - a, zb - za);
        rows.push({ a, b, za, zb, ha, hb, w, x });
        A += w;
        P += x;
        B += b - a;
      }
      return { n: q.n, rows, A, P, B };
    });
}

// đánh số lại tên hình theo thứ tự xuất hiện (bỏ qua hình đang ẩn)
export function hvCapNum(): void {
  if (typeof document === 'undefined') return;
  const a = $('hv_oQ') as unknown as HTMLElement | null;
  if (!a || typeof a.closest !== 'function') return;
  const root: Document | Element = a.closest('.pane') || document;
  let k = 0;
  root.querySelectorAll('p.cap').forEach((p) => {
    const tcEl = document.getElementById('hv_secTC');
    const hd = p.closest('[hidden]') || (p.closest('#hv_secTC') && tcEl && tcEl.style.display === 'none');
    if (!/^Hình \d+[a-z]? - /.test(p.textContent || '') || hd) return;
    k++;
    p.textContent = (p.textContent || '').replace(/^Hình \d+[a-z]? - /, 'Hình ' + k + ' - ');
  });
}

export function hvRender(R: HvCalcResult): void {
  const setHv = (id: string, html: string): void => {
    const e = $('hv_' + id);
    if (e) e.innerHTML = html;
    setOutputValue('hv_' + id, html);
  };
  const errEl = $('hv_err');
  const errHtml = R.err.concat(R.warn).join('<br>');
  if (errEl) errEl.innerHTML = errHtml;
  setOutputValue('hv_err', errHtml);

  if (R.err.length) {
    [
      'oP',
      'oRain',
      'tbHp',
      'oQ',
      'oMC',
      'oHQ',
      'oH',
      'oV',
      'oK',
      'oZ',
      'oC',
      'oX',
      'oXc',
      'oTC',
      'tbSum',
      'kl',
    ].forEach((i) => setHv(i, ''));
    return;
  }

  const I = R.I;
  const Pd = R.Pd;
  const qa = R.Q[Pd];
  const qd = qa.t;
  const o = R.o;

  // 2. tần suất
  setHv(
    'oP',
    hvP(
      'Ký hiệu tài liệu viện dẫn: [TCVN 11823-2] TCVN 11823-2:2017 ; [TCVN 9845] TCVN 9845:2013 ; [TCVN 4054] TCVN 4054:2005 ; [ST] Sổ tay tính toán thuỷ văn, thuỷ lực cầu đường (2006) ; [TKĐ3] Nguyễn Xuân Trục, Thiết kế đường ô tô tập 3 - Công trình vượt sông (2004).',
    ) +
      hvStepT([
        ...(I.PB && isFinite(I.PB.Lc)
          ? ([
              [
                'Dự kiến thiết kế cầu ' +
                  (I.pier.length + 1) +
                  ' nhịp' +
                  (I.sdn ? ' (sơ đồ ' + I.sdn + ')' : '') +
                  ' có khẩu độ thoát nước là',
                '',
                'Lc',
                hvF(I.PB.Lc, 2),
                'm',
                '',
              ],
              [
                'Loại cầu theo khẩu độ ; cấp đường',
                '',
                '',
                I.PB.loai + ' ; ' + I.PB.capN,
                '',
                '[TCVN 4054] Bảng 30, chú thích 4',
              ],
            ] as StepTuple[])
          : []),
        [
          'Lũ thiết kế cầu (khẩu độ, khổ giới hạn thẳng đứng)',
          '',
          'P',
          pP(Pd),
          '',
          I.PB && I.PB.auto
            ? '[TCVN 4054] Bảng 30; [TCVN 11823-2] Điều 6.4.3'
            : '[TCVN 11823-2] Điều 6.4.3',
        ],
        [
          'Lũ thiết kế xói (xói chung, xói cục bộ)',
          '',
          'Px',
          pP(R.Px),
          '',
          I.pxm === 'u'
            ? '[TCVN 11823-2] Điều 2.7, 6.4.4.2'
            : '[TCVN 11823-2] Điều 6.4.4.2: lấy bằng lũ thiết kế cầu',
        ],
      ]),
  );

  let h = '';
  if (R.noRain) {
    setHv('oRain', '');
    setHv('tbHp', '');
  } else {
    // 3. mưa
    h += hvStSec(I, Pd);
    if (R.st) {
      const s = R.st;
      const fitR = R.fitR!;
      h += hvP(
        `Trạm đại diện: ${I.st}; chuỗi ${s.n} năm (${Math.min(...s.emp.map((e) => e.y))} - ${Math.max(...s.emp.map((e) => e.y))}). Tần suất kinh nghiệm theo công thức kỳ vọng P = m/(n+1) [ST] PT 2-1.` +
          (HVST[I.st] && HVST[I.st].note ? ' ' + HVST[I.st].note : ''),
      );
      const byY = s.emp.slice().sort((a, b) => a.y - b.y);
      const half = Math.ceil(s.n / 2);
      const rows: string[][] = [];
      for (let i = 0; i < half; i++) {
        const a = byY[i];
        const b = byY[i + half];
        rows.push([
          String(i + 1),
          String(a.y),
          hvF(a.x, 1),
          hvF(a.P, 2),
          String(a.m),
          b ? String(i + half + 1) : '',
          b ? String(b.y) : '',
          b ? hvF(b.x, 1) : '',
          b ? hvF(b.P, 2) : '',
          b ? String(b.m) : '',
        ]);
      }
      h += hvTab(
        [
          'TT',
          'Năm',
          'X (mm)',
          'P (%)',
          'Thứ hạng m',
          'TT',
          'Năm',
          'X (mm)',
          'P (%)',
          'Thứ hạng m',
        ],
        rows,
      );
      h += hvStepT([
        { grp: 'Tham số thống kê theo phương pháp mô men' },
        [
          'Lượng mưa trung bình',
          '\\bar X=\\dfrac{\\sum X_i}{n}',
          'X̄',
          hvF(s.mean, 2),
          'mm',
          '[ST] PT 2-2',
        ],
        [
          'Hệ số phân tán',
          'C_v=\\sqrt{\\dfrac{\\sum (K_i-1)^2}{n-1}}\\ ;\\ K_i=\\dfrac{X_i}{\\bar X}',
          'Cv',
          hvF(s.Cv, 4),
          '',
          '[ST] PT 2-3',
        ],
        [
          'Hệ số thiên lệch',
          'C_s=\\dfrac{\\sum (K_i-1)^3}{(n-3)\\,C_v^3}',
          'Cs',
          hvF(s.Cs, 4),
          '',
          '[ST] PT 2-4',
        ],
        [
          'Kiểm tra điều kiện của Cs: ' + (s.csOK ? 'thỏa mãn' : 'không thỏa mãn'),
          '2C_v \\le C_s \\le \\dfrac{2C_v}{1-K_{min}}',
          '',
          `${hvF(s.lo, 3)} ≤ ${hvF(s.Cs, 3)} ≤ ${hvF(s.hi, 3)}`,
          '',
          '[ST] mục 2.2.1b',
        ],
        {
          grp: 'Tham số thống kê theo phương pháp thích hợp - tổng bình phương sai số giữa đường lý luận và các điểm kinh nghiệm nhỏ nhất ([ST] mục 2.2.1b)',
        },
        [
          'Hệ số phân tán ; hệ số thiên lệch',
          '',
          'Cv ; Cs',
          hvF(fitR.Cv, 4) + ' ; ' + hvF(fitR.Cs, 4),
          '',
          '',
        ],
        [
          'Sai số bình phương trung bình của phương pháp thích hợp ; phương pháp mô men',
          '',
          '',
          hvF(fitR.rmse, 2) + ' ; ' + hvF(fitR.rmse0, 2),
          'mm',
          '',
        ],
      ]);
      const dists: Array<[DistType, string]> = [
        ['p3', 'Pearson III: XP = X̄(1 + ΦP.Cv), ΦP theo [ST] Phụ lục 2-1'],
        ['km', 'Kritski - Menkel: XP = X̄.KP, KP theo [ST] Phụ lục 2-2'],
      ];
      const cmb: Array<{ sel: boolean; c: string[] }> = [];
      (
        [
          ['mom', 'Mô men', s.Cv, R.CsUser ? R.Cs : s.Cs],
          ['fit', 'Thích hợp', fitR.Cv, fitR.Cs],
        ] as const
      ).forEach(([pm, pn, cv, cs]) =>
        dists.forEach(([dk, dn]) => {
          const hp = (P: number): number => s.mean * HVM.KP(dk, P, cv, cs);
          cmb.push({
            sel: pm === R.pm && dk === R.dist,
            c: [
              pn,
              dn,
              hvF(cv, 3),
              hvF(cs, 3),
              ...[...new Set([Pd, R.Px])].map((P) => hvF(hp(P), 1)),
            ],
          });
        }),
      );
      h +=
        hvP('Bảng so sánh lượng mưa ngày lớn nhất thiết kế theo các phương pháp:') +
        hvTab(
          [
            'Tham số',
            'Dạng đường tần suất',
            'Cv',
            'Cs',
            ...[...new Set([Pd, R.Px])].map((P) => `H${pP(P)} (mm)`),
          ],
          cmb,
        );
    } else {
      h += hvP(
        `Trạm đại diện: ${I.st}. Tham số thống kê đã có: X̄ = ${hvF(R.Xm, 2)} mm ; Cv = ${hvF(R.Cv, 3)} ; Cs = ${hvF(R.Cs, 3)}; dạng đường tần suất ${R.dist === 'km' ? 'Kritski - Menkel ([ST] Phụ lục 2-2)' : 'Pearson III ([ST] PT 2-5, Phụ lục 2-1)'}.`,
      );
    }
    h += hvSel(
      (R.pm === 'fit'
        ? 'phương pháp thích hợp'
        : R.pm === 'mom'
          ? 'phương pháp mô men'
          : 'tham số đã có') +
        ' ; đường ' +
        (R.dist === 'km' ? 'Kritski - Menkel' : 'Pearson III') +
        ` (X̄ = ${hvF(R.Xm, 2)} ; Cv = ${hvF(R.Cv, 3)} ; Cs = ${hvF(R.Cs, 3)})`,
    );
    setHv('oRain', h);
    const PL = [
      0.01, 0.1, 0.2, 0.33, 0.5, 1, 1.5, 2, 3, 4, 5, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 85, 90,
      95, 97, 99, 99.9, 99.99,
    ];
    setHv(
      'tbHp',
      '<tr><th>TT</th><th>P (%)</th><th>KP</th><th>X (mm)</th><th>Thời gian lặp lại (năm)</th><th>TT</th><th>P (%)</th><th>KP</th><th>X (mm)</th><th>Thời gian lặp lại (năm)</th></tr>' +
        Array.from({ length: PL.length / 2 }, (_, i) => {
          const r = (P: number): string => {
            const k = HVM.KP(R.dist, P, R.Cv, R.Cs);
            return `<td>${String(P).replace('.', ',')}</td><td>${hvF(k, 3)}</td><td>${hvF(R.Xm * k, 1)}</td><td>${hvF(100 / P, P < 1 ? 0 : 2)}</td>`;
          };
          return `<tr><td>${i + 1}</td>${r(PL[i])}<td>${i + 1 + PL.length / 2}</td>${r(PL[i + PL.length / 2])}</tr>`;
        }).join(''),
    );
  }

  const Ps = R.Ps;
  if (R.TL) {
    const T = I.qtl;
    h =
      hvP(
        `Lưu lượng thiết kế tại vị trí cầu lấy theo tài liệu${I.qtlsrc ? ': ' + I.qtlsrc : ''}.` +
          (I.F >= 100
            ? ` Lưu vực F = ${hvF(I.F, 1)} km² ≥ 100 km² nằm ngoài phạm vi công thức cường độ giới hạn ([TCVN 9845] Điều 5.1).`
            : ''),
      ) +
      hvTab(
        ['Tần suất P (%)', 'Lưu lượng Q (m³/s)'],
        T.map((a) => [pP(a[0]), hvF(a[1], 2)]),
      ) +
      (Ps.some((P) => !T.some((a) => Math.abs(a[0] - P) < 1e-9))
        ? hvP('Lưu lượng ứng với tần suất không có trong tài liệu nội suy tuyến tính theo lgP:') +
          hvTab(
            ['Tần suất P (%)', 'Lưu lượng Q (m³/s)'],
            Ps.map((P) => ({ sel: P === Pd, c: [pP(P), hvF(R.Q[P].Q, 2)] })),
          )
        : '') +
      hvStepT([['Lưu lượng thiết kế', '', 'Q' + pP(Pd), `<b>${hvF(qa.Q, 2)}</b>`, 'm³/s', '']]);
  } else if (qd) {
    const LVs = hvLVok(I) ? 'Mục 1.3.1' : '';
    const A = qd.A1;
    h = hvP(
      `Lưu vực F = ${hvF(I.F, 3)} km² < 100 km²: lưu lượng đỉnh lũ tính theo công thức cường độ giới hạn ([TCVN 9845] Điều 5.1, 5.2).`,
    );
    h += hvStepT([
      { grp: 'CƠ SỞ THIẾT KẾ' },
      [
        'Vùng mưa',
        '',
        '',
        I.reg,
        '',
        I.regAuto
          ? '[TCVN 9845] Bảng 3; vị trí công trình trên bản đồ phân vùng mưa rào [ST] Phụ lục 2-3'
          : '[TCVN 9845] Bảng 3',
      ],
      ['Cấp đất', '', '', I.cls, '', '[TCVN 9845] Bảng 1, 2'],
      ['Tần suất thiết kế', '', 'p', pP(Pd), '', 'Mục 1.1'],
      ['Tên trạm khí tượng', '', '', I.st, '', ''],
      { grp: 'CÁC ĐẶC TRƯNG CỦA LƯU VỰC ([TCVN 9845] Điều 4.5)' },
      ['Diện tích lưu vực (≤ 100 km²)', '', 'F', hvF(I.F, 3), 'km²', LVs || 'Bản đồ'],
      ['Chiều dài sông chính hoặc suối chính', '', 'L', hvF(I.L, 3), 'km', LVs],
      ['Tổng chiều dài các sông nhánh hoặc suối nhánh', '', 'Σl', hvF(I.sl, 3), 'km', LVs],
      [
        'Độ dốc trung bình của lòng sông chính hoặc suối chính',
        R.Jp ? 'J_{ls}=\\dfrac{h_1 l_1+(h_1+h_2)l_2+...+(h_{n-1}+h_n)l_n}{L^2}' : '',
        'Jls',
        hvF(R.Jls, 2),
        '‰',
        R.Jp ? '[TCVN 9845] PT 4' : '',
      ],
      [
        'Độ dốc trung bình của sườn dốc lưu vực',
        '',
        'Jsd',
        hvF(I.Jsd, 1),
        '‰',
        '[TCVN 9845] Điều 4.5',
      ],
      ['Loại lưu vực', '', '', I.two ? 'Lưu vực hai sườn dốc' : 'Lưu vực một sườn dốc', '', ''],
      ['Tỉ lệ hồ ao, đầm lầy', '', 'fao', hvF(I.fao, 1), '%', ''],
      ['Vị trí hồ ao hoặc đầm lầy', '', '', I.aoPos === 'h' ? 'Ở hạ lưu' : 'Ở thượng lưu', '', ''],
      { grp: 'CÁC GIÁ TRỊ TRA BẢNG' },
      [
        'Lượng mưa ngày lớn nhất ứng với tần suất thiết kế',
        'H_P=\\bar X\\,K_P',
        'HP',
        hvF(qd.Hp, 1),
        'mm',
        'Mục 1.2',
      ],
      [
        'Hệ số dòng chảy lũ thiết kế (cấp đất ' +
          I.cls +
          ', HP ' +
          A.lab +
          ' mm, ' +
          A.grp +
          ' km²)',
        '',
        'φ',
        hvF(qd.phi, 3),
        '',
        '[TCVN 9845] Bảng A.1, cột ' + (A.col + 3),
      ],
      ['Thông số tập trung nước trên sườn dốc', '', 'msd', hvF(I.msd, 2), '', '[TCVN 9845] Bảng 4'],
      [
        'Thông số tập trung nước trong lòng sông',
        '',
        'mls',
        hvF(I.mls, 0),
        '',
        '[TCVN 9845] Bảng 5',
      ],
      [
        'Hệ số chiết giảm dòng chảy do ao hồ, đầm lầy',
        '',
        'δ',
        hvF(qd.delta, 3),
        '',
        '[TCVN 9845] Bảng 6',
      ],
      { grp: 'CÁC GIÁ TRỊ CẦN TÍNH TOÁN' },
      [
        'Chiều rộng bình quân lưu vực',
        I.two ? 'B=\\dfrac{F}{2L}' : 'B=\\dfrac{F}{L}',
        'B',
        hvF(qd.B, 3),
        'km',
        I.two ? '[TCVN 9845] PT 2' : '[TCVN 9845] PT 3',
      ],
      [
        'Chiều dài trung bình sườn dốc lưu vực',
        `L_{sd}=\\dfrac{1000F}{${I.two ? '1.8' : '0.9'}(L+\\sum l)}`,
        'Lsd',
        hvF(qd.Lsd, 1),
        'm',
        '[TCVN 9845] PT 1',
      ],
      [
        'Đặc trưng địa mạo của sườn dốc',
        '\\varphi_{sd}=\\dfrac{L_{sd}^{0.6}}{m_{sd}J_{sd}^{0.3}(\\varphi H_P)^{0.4}}',
        'φsd',
        hvF(qd.phisd, 3),
        '',
        '[TCVN 9845] PT 9',
      ],
      [
        'Thời gian tập trung nước trên sườn dốc (vùng ' + I.reg + ', nội suy theo φsd)',
        '',
        'τsd',
        hvF(qd.tau, 2),
        'phút',
        '[TCVN 9845] Bảng A.2',
      ],
      [
        'Đặc trưng địa mạo của lòng sông',
        qd.noCh
          ? '\\varphi_{ls}=0'
          : '\\varphi_{ls}=\\dfrac{1000L}{m_{ls}J_{ls}^{1/3}F^{1/4}(\\varphi H_P)^{1/4}}',
        'φls',
        hvF(qd.phils, 3),
        '',
        qd.noCh ? '[TCVN 9845] Điều 5.2.3' : '[TCVN 9845] PT 10',
      ],
      [
        'Mô đun đỉnh lũ ứng với tần suất thiết kế (vùng ' + I.reg + ', nội suy theo τsd, φls)',
        '',
        'Ap',
        hvF(qd.Ap, 5),
        '',
        '[TCVN 9845] Bảng A.3',
      ],
      [
        'Lưu lượng lớn nhất ứng với tần suất thiết kế',
        'Q_P=A_P\\,\\varphi\\,H_P\\,F\\,\\delta',
        'Q' + pP(Pd),
        `<b>${hvF(qd.Q, 2)}</b>`,
        'm³/s',
        '[TCVN 9845] PT 8',
      ],
    ]);

    if (Ps.length > 1) {
      h +=
        hvP('Bảng kết quả tính lưu lượng theo các tần suất:') +
        hvTab(
          ['Tần suất', 'HP (mm)', 'φ', 'φsd', 'τsd (phút)', 'φls', 'Ap', 'QP (m³/s)'],
          Ps.map((P) => {
            const t = R.Q[P].t;
            return t
              ? [
                  pP(P),
                  hvF(t.Hp, 1),
                  hvF(t.phi, 3),
                  hvF(t.phisd, 3),
                  hvF(t.tau, 2),
                  hvF(t.phils, 3),
                  hvF(t.Ap, 5),
                  hvF(t.Q, 2),
                ]
              : [pP(P), '-', '-', '-', '-', '-', '-', '-'];
          }),
        );
    }
    const qw = [...new Set(Object.values(R.Q).flatMap((x) => (x.t ? x.t.warn : [])))];
    if (qw.length) h += `<p class="bad small">${qw.join('<br>')}</p>`;
  }
  setHv('oQ', h);
  setHv('oLV', hvLV(I));

  // 2. mực nước theo tần suất thiết kế
  const bad = I.hf === 'bad';
  const pn = (x: number): string => (x < I.xL ? 'Bãi trái' : x > I.xR ? 'Bãi phải' : 'Lòng chủ');
  h =
    hvP(
      `Mực nước thiết kế được xác định theo phương pháp hình thái mặt cắt tại mặt cắt tim cầu ([ST] mục 2.2.3c, 2.3.3): lưu lượng ứng với các mực nước giả định Q = Σω.V ([ST] PT 2-39); tốc độ theo ${bad ? 'Sêdi - Badanh V = 87√(hi)/(1 + γ/√h) ([ST] PT 2-38)' : 'Sêdi - Maninh V = (1/n).h^(2/3).i^(1/2) ([ST] PT 2-37)'}; bộ phận có B < 10h dùng h = R = ω/χ. Các thông số:`,
    ) +
    hvStepT([
      ['Độ dốc dọc đáy dòng chảy tại vị trí công trình', '', 'i', hvF(I.i * 1000, 3), '‰', ''],
      ...(bad
        ? ([
            ['Hệ số Badanh dòng chủ', '', 'γch', hvF(I.gch, 2), '', '[ST] Bảng 2-11'],
            ['Hệ số Badanh dòng bãi', '', 'γb', hvF(I.gb, 2), '', '[ST] Bảng 2-11'],
          ] as StepTuple[])
        : ([
            ['Hệ số nhám dòng chủ', '', 'nch', hvF(I.nch, 3), '', '[ST] Bảng 2-11'],
            ['Hệ số nhám dòng bãi', '', 'nb', hvF(I.nb, 3), '', '[ST] Bảng 2-11'],
          ] as StepTuple[])),
      [
        'Ranh giới bãi trái - lòng chủ ; lòng chủ - bãi phải (lý trình)',
        '',
        '',
        hvF(I.xL, 2) + ' ; ' + hvF(I.xR, 2),
        'm',
        '',
      ],
    ]);
  {
    const mk = String(($('hv_mnk') || {}).value || '')
      .split(/\r?\n/)
      .map((l) => l.trim().match(/^(.*?)[\s:=]+\+?(-?\d+(?:[.,]\d+)?)\s*m?$/))
      .filter((m): m is RegExpMatchArray => Boolean(m));
    const rw: Array<[string, number]> = [
      ...I.hist
        .filter((oItem) => isFinite(oItem.h))
        .map((oItem): [string, number] => ['Mực nước lũ lịch sử năm ' + oItem.y + ' (MNLS)', oItem.h]),
      ...mk.map((m): [string, number] => [m[1].trim(), +m[2].replace(',', '.')]),
      ...(isFinite(I.MNHT) ? ([['Mực nước hiện tại đo khi khảo sát (MNHT)', I.MNHT]] as [string, number][]) : []),
    ];
    if (rw.length) {
      h +=
        hvP('Các mực nước đặc trưng theo hồ sơ khảo sát:') +
        hvTab(
          ['Mực nước', 'Cao độ (m)'],
          rw.map((r) => [r[0], hvF(r[1], 2)]),
        );
    }
  }
  {
    const pt = I.sec.slice().sort((a, b) => a[0] - b[0]);
    const n = pt.length;
    const hf = n > 14 ? Math.ceil(n / 2) : n;
    const rows: string[][] = [];
    const km = pt[n - 1][0] >= 1000;
    const lx = (x: number): string => (km ? hvKmF(x) : hvF(x, 2));
    for (let i = 0; i < hf; i++) {
      const a = pt[i];
      const b = hf < n ? pt[i + hf] : null;
      rows.push([
        String(i + 1),
        lx(a[0]),
        hvF(a[1], 2),
        pn(a[0]),
        ...(hf < n
          ? [
              b ? String(i + hf + 1) : '',
              b ? lx(b[0]) : '',
              b ? hvF(b[1], 2) : '',
              b ? pn(b[0]) : '',
            ]
          : []),
      ]);
    }
    h +=
      hvP(
        'Mô tả mặt cắt ngang tự nhiên của lòng sông (suối) tại vị trí xây dựng công trình' +
          (I.secT && I.secT.cut
            ? ` (đoạn từ lý trình ${lx(I.secT.a as number)} đến ${lx(I.secT.b as number)}${km ? '' : ' m'})`
            : '') +
          ':',
      ) +
      hvTab(
        ((L: string) =>
          hf < n
            ? ['STT', L, 'Cao độ (m)', 'Bộ phận', 'STT', L, 'Cao độ (m)', 'Bộ phận']
            : ['STT', L, 'Cao độ (m)', 'Bộ phận'])(km ? 'Lý trình' : 'Lý trình (m)'),
        rows,
      );
  }
  setHv('oMC', h);

  h =
    hvP('Tính lưu lượng ứng với các mực nước giả định:') +
    '<table class="t dt"><tr><th>Mực nước (m)</th><th>Bộ phận</th><th>Độ dốc i</th><th>' +
    (bad ? 'γ' : '1/n') +
    '</th><th>ω (m²)</th><th>χ (m)</th><th>R (m)</th><th>V (m/s)</th><th>Q (m³/s)</th></tr>' +
    R.HQ.map((x) => {
      const ps = x.parts.filter((p) => p.A > 0);
      if (!ps.length) return '';
      return (
        ps
          .map(
            (p, j) =>
              `<tr>${j ? '' : `<td rowspan="${ps.length + 1}">${hvF(x.H, 2)}</td>`}<td class="l">${p.n}</td><td>${hvF(I.i, 4)}</td><td>${bad ? hvF(p.gm, 2) : hvF(1 / p.nn, 2)}</td><td>${hvF(p.A, 2)}</td><td>${hvF(p.P, 2)}</td><td>${hvF(p.R, 3)}</td><td>${hvF(p.V, 3)}</td><td>${hvF(p.Q, 2)}</td></tr>`,
          )
          .join('') +
        `<tr><td class="l"><b>Mặt cắt</b></td><td></td><td></td><td>${hvF(x.A, 2)}</td><td></td><td></td><td>${hvF(x.V, 3)}</td><td><b>${hvF(x.Q, 2)}</b></td></tr>`
      );
    }).join('') +
    '</table>';
  if (R.fitHQ) {
    const f = R.fitHQ;
    h +=
      hvP(
        `Đường quan hệ H = f(Q) thể hiện trên hình xấp xỉ bằng đa thức bậc 2 theo phương pháp bình phương nhỏ nhất qua ${f.pts.length} điểm tính toán (mực nước từ ${hvF(Math.min(...f.pts.map((q) => q[1])), 2)} m đến ${hvF(Math.max(...f.pts.map((q) => q[1])), 2)} m):`,
      ) +
      hvStepT([
        [
          'Phương trình quan hệ mực nước - lưu lượng',
          `H=${hvCoef(f.a).replace(/E([-+])0*(\d+)/, (_m, sg, d) => '\\times10^{' + (sg === '-' ? '-' : '') + d + '}')}\\,Q^2${f.b < 0 ? '-' : '+'}${hvCoef(Math.abs(f.b))}\\,Q${f.c < 0 ? '-' : '+'}${hvCoef(Math.abs(f.c))}`,
          '',
          '',
          '',
          '',
        ],
        [
          'Hệ số xác định',
          'R^2=1-\\dfrac{\\sum(H_i-\\hat H_i)^2}{\\sum(H_i-\\bar H)^2}',
          'R²',
          f.R2.toFixed(4),
          '',
          '',
        ],
      ]);
  }
  setHv('oHQ', h);

  const oM = (S2: string) => {
    const x = HV.secMake({ ...R.S.S, hf: S2 });
    return (P: number): number => x.hOf(R.Q[P].Q);
  };
  const hM = oM('man');
  const hB = oM('bad');
  h =
    hvP(
      'Mực nước ứng với lưu lượng thiết kế giải trực tiếp từ phương trình Q = Σω.V trên mặt cắt:',
    ) +
    hvTab(
      ['Tần suất', 'Q (m³/s)', 'H - Maninh (m)', 'H - Badanh (m)', 'H chọn (m)'],
      Ps.map((P) => ({
        sel: P === Pd,
        c: [pP(P), hvF(R.Q[P].Q, 2), hvF(hM(P), 3), hvF(hB(P), 3), '<b>' + hvF(R.H[P], 3) + '</b>'],
      })),
    ) +
    hvSel((bad ? 'Sêdi - Badanh' : 'Sêdi - Maninh') + `: H${pP(Pd)} = ${hvF(R.Htk, 3)} m`);
  if (R.hist.length) {
    h +=
      hvP('Mực nước lũ lịch sử điều tra và tần suất tương ứng ([ST] mục 3.5.1):') +
      hvTab(
        ['Năm', 'Mực nước (m)', 'Q (m³/s)', 'Tần suất tương ứng P (%)'],
        R.hist.map((x) => [
          String(x.y),
          hvF(x.h, 2),
          hvF(x.Q, 2),
          x.P < 0 ? '< 0,01' : x.P >= 100 ? '> 99' : hvF(x.P, 2),
        ]),
      );
  }
  if (R.W) {
    const W = R.W;
    const st = W.st;
    const nm = I.wlst === 'khac' ? 'trạm thủy văn' : 'trạm thủy văn ' + I.wlst;
    const PL = [1, 2, 4, 5, 10];
    if (!PL.includes(Pd)) PL.unshift(Pd);
    h +=
      hvP(
        `<b>Mực nước theo số liệu quan trắc ${nm}</b> (${HVWL[I.wlst] ? HVWL[I.wlst].song + '; ' : ''}mực nước lớn nhất năm ${st.n} năm, ${Math.min(...I.wlser.map((oItem) => oItem.y))} - ${Math.max(...I.wlser.map((oItem) => oItem.y))}). Đường tần suất Pearson III, tham số thống kê theo phương pháp mô men ([ST] PT 2-2 - 2-4):`,
      ) +
      hvStepT([
        ['Mực nước lớn nhất năm trung bình', '', 'H̄', hvF(st.mean, 2), 'cm', ''],
        [
          'Hệ số phân tán ; hệ số thiên lệch',
          '',
          'Cv ; Cs',
          hvF(W.Cv, 3) + ' ; ' + hvF(W.Cs, 3),
          '',
          '',
        ],
      ]) +
      hvTab(
        ['Tần suất P (%)', ...PL.map(pP)],
        [['Mực nước tại trạm (m)', ...PL.map((P) => hvF(W.Hp(P), 2))]],
      ) +
      hvStepT([
        ['Mực nước thiết kế tại cầu', '', 'H' + pP(Pd) + 'cầu', hvF(W.Hcau, 3), 'm', 'Mục 2'],
        ['Mực nước cùng tần suất tại trạm', '', 'H' + pP(Pd) + 'trạm', hvF(W.Htr, 3), 'm', ''],
        [
          'Chênh cao mực nước giữa cầu và trạm',
          '\\Delta H=H_{P,cau}-H_{P,tram}',
          'ΔH',
          hvF(W.DH, 3),
          'm',
          '',
        ],
      ]);
    if (isFinite(W.H5d as number)) {
      h += hvStepT([
        [
          'Mực nước trung bình ngày tại trạm có lũy tích tần suất 5% (nội suy bảng lũy tích tần suất mực nước ngày)',
          '',
          'H5%ngày',
          hvF(W.H5d, 3),
          'm',
          '[ST] mục 4.8.2',
        ],
        [
          'Mực nước thông thuyền tại cầu',
          'H_{TT}=H_{5\\%,tram}+\\Delta H',
          'HTT',
          '<b>' + hvF(W.Htt, 3) + '</b>',
          'm',
          '',
        ],
      ]);
    }
  }
  setHv('oH', h);
  hvHcShow(R);

  // 3. lưu tốc thiết kế
  const sg = hvSegs(R.S, R.Htk, o.parts);
  h = hvStepT([
    [
      'Hệ số phân phối lưu lượng cho dòng chủ',
      '\\alpha_{ch}=\\dfrac{\\omega_{ch}V_{ch}}{\\sum\\omega_iV_i}',
      'αch',
      hvF(o.ch.Q / o.Q, 4),
      '',
      '[ST] PT 2-39',
    ],
    [
      'Lưu lượng dòng chủ ứng với mực nước thiết kế',
      'Q_{ch}=\\alpha_{ch}Q_P',
      'Qch',
      hvF((o.ch.Q / o.Q) * qa.Q, 2),
      'm³/s',
      '',
    ],
    [
      'Lưu tốc thiết kế dòng chủ',
      'V_{ch}=Q_{ch}/\\omega_{ch}',
      'Vch',
      '<b>' + hvF(o.ch.V, 3) + '</b>',
      'm/s',
      '',
    ],
    ['Lưu tốc bình quân toàn mặt cắt', 'V=Q_P/\\omega', 'V', hvF(o.V, 3), 'm/s', ''],
  ]);
  h +=
    hvP(`Bảng tính đặc trưng mặt cắt ứng với mực nước thiết kế H${pP(Pd)} = ${hvF(R.Htk, 3)} m:`) +
    '<table class="t dt"><tr><th>Bộ phận</th><th>Lý trình (m)</th><th>Cao độ tn (m)</th><th>h (m)</th><th>Cự ly lẻ (m)</th><th>htb (m)</th><th>ω (m²)</th><th>χ (m)</th></tr>' +
    sg
      .map(
        (g) =>
          g.rows
            .map(
              (r, j) =>
                `<tr>${j ? '' : `<td class="l" rowspan="${g.rows.length + 1}">${g.n}</td>`}<td>${hvF(r.a, 2)} - ${hvF(r.b, 2)}</td><td>${hvF(r.za, 2)} - ${hvF(r.zb, 2)}</td><td>${hvF(r.ha, 3)} - ${hvF(r.hb, 3)}</td><td>${hvF(r.b - r.a, 2)}</td><td>${hvF((r.ha + r.hb) / 2, 3)}</td><td>${hvF(r.w, 3)}</td><td>${hvF(r.x, 3)}</td></tr>`,
            )
            .join('') +
          `<tr><td class="l" colspan="3"><b>Cộng ${g.n.toLowerCase()}</b></td><td>${hvF(g.B, 2)}</td><td></td><td><b>${hvF(g.A, 3)}</b></td><td><b>${hvF(g.P, 3)}</b></td></tr>`,
      )
      .join('') +
    '</table>';
  h += hvTab(
    [
      'Bộ phận',
      'ω (m²)',
      'B (m)',
      'χ (m)',
      'h = ω/B (m)',
      'R = ω/χ (m)',
      'h dùng tính (m)',
      bad ? 'γ' : 'n',
      'V (m/s)',
      'Q (m³/s)',
    ],
    o.parts
      .map((p) => [
        p.n,
        hvF(p.A, 2),
        hvF(p.B, 2),
        hvF(p.P, 2),
        hvF(p.h, 3),
        hvF(p.R, 3),
        hvF(p.hr, 3) + (p.useR ? ' (R)' : ''),
        bad ? hvF(p.gm, 2) : hvF(p.nn, 3),
        hvF(p.V, 3),
        hvF(p.Q, 2),
      ])
      .concat([
        ['Toàn mặt cắt', hvF(o.A, 2), hvF(o.B, 2), '', '', '', '', '', hvF(o.V, 3), hvF(o.Q, 2)],
      ]),
  );
  setHv('oV', h);

  // 6. khẩu độ
  const K = R.K;
  const op = R.op;
  const Q = qa.Q;
  const kmN: Record<string, string> = {
    bel: 'Belleliutsky - hệ số xói P',
    kas: 'A.A. Kasin - cân bằng thủy lực',
    sri: 'M.F. Sripnưi',
    nho: 'Cầu nhỏ có gia cố lòng',
  };
  const nho = I.km === 'nho';
  h = '';
  if (!nho) {
    const cs = Math.cos((I.th * Math.PI) / 180);
    const alf = 90 - (I.th || 0);
    const wN: Record<string, string> = {
      bel: '\\omega_{ct}=\\dfrac{Q}{\\mu V_{ch}P}',
      kas: '\\omega_{ct}=\\dfrac{1}{\\mu P}\\left(\\omega_{ch}+\\sum\\omega_b\\dfrac{v_b}{v_{ch}}\\right)\\ ;\\ \\dfrac{v_b}{v_{ch}}=\\dfrac{\\gamma_{ch}+\\sqrt{h_{ch}}}{\\gamma_b+\\sqrt{h_b}}\\cdot\\dfrac{h_b}{h_{ch}}',
      sri: `\\omega_{ct}=\\dfrac{m}{\\mu P}\\left(\\omega_{ch}+\\sum\\omega_b\\dfrac{n_{ch}h_b^{2/3}}{n_bh_{ch}^{2/3}}\\right)\\ ;\\ m=${fx(K.msr, 2)}`,
    };
    const wS: Record<string, string> = {
      bel: '[ST] PT 4-1, 4-2; [TKĐ3] PT 3-2',
      kas: '[TKĐ3] PT 3-4, 3-5',
      sri: '[TKĐ3] PT 3-6',
    };
    const PtN: Record<string, string> = {
      q: `theo lưu lượng đơn vị dưới cầu q = Q/L0 = ${hvF(K.q, 3)} m³/s/m`,
      hs: `theo chiều sâu trung bình trước xói htb = ${hvF(op.htb, 2)} m, móng sâu`,
      hn: `theo chiều sâu trung bình trước xói htb = ${hvF(op.htb, 2)} m, móng nông`,
    };
    const PtS: Record<string, string> = {
      q: '[ST] Bảng 4-2; [TKĐ3] Bảng 3-2',
      hs: '[TKĐ3] mục 3.2.1, Bảng 3-1',
      hn: '[TKĐ3] Bảng 3-1',
    };
    h =
      '<h3>4.1. Tính khẩu độ cầu</h3>' +
      hvP(
        'Khẩu độ cầu xác định theo diện tích thoát nước cần thiết dưới cầu trước khi xói ứng với mực nước thiết kế.',
      ) +
      hvP('<b>a) Diện tích thoát nước cần thiết</b>') +
      hvStepT([
        ['Lưu lượng thiết kế', '', 'Q', hvF(Q, 2), 'm³/s', ''],
        [
          'Tốc độ trung bình lòng chủ lúc tự nhiên ứng với lũ thiết kế',
          'V_{ch}=Q_{ch}/\\omega_{ch}',
          'Vch',
          hvF(K.Vch, 3),
          'm/s',
          'Mục 3',
        ],
        I.mum === 'b41'
          ? [
              'Hệ số thu hẹp dòng chảy do mố, trụ (nội suy theo Vch và khẩu độ)',
              '',
              'μ',
              hvF(K.mu, 3),
              '',
              '[ST] Bảng 4-1',
            ]
          : ['Hệ số thu hẹp dòng chảy do trụ cầu', '', 'μ', '1', '', '[TKĐ3] mục 3.2.1'],
        [
          'Hệ số xói cho phép ' + (PtN[I.Pt] || PtN.q),
          '',
          'P',
          '<b>' + hvF(K.P, 3) + '</b>',
          '',
          PtS[I.Pt] || PtS.q,
        ],
        [
          'Diện tích thoát nước cần thiết dưới cầu (' + (kmN[I.km] || kmN.bel) + ')',
          wN[I.km] || wN.bel,
          'ωct',
          '<b>' + hvF(K.wc0, 2) + '</b>',
          'm²',
          wS[I.km] || wS.bel,
        ],
      ]) +
      hvP('<b>b) Khẩu độ thoát nước cần thiết</b>') +
      hvStepT([
        [
          'Diện tích thoát nước dưới cầu ứng với mực nước thiết kế (giữa mép trong hai mố, trừ trụ)',
          '',
          'ω',
          hvF(K.w, 2),
          'm²',
          '',
        ],
        [
          'Khẩu độ thoát nước thiết kế (chiều rộng mặt nước giữa mép trong hai mố, trừ bề rộng trụ)',
          '',
          'L0',
          hvF(K.Lo, 2),
          'm',
          '',
        ],
        ['Chiều sâu trung bình dưới cầu', 'h_{tb}=\\omega/L_0', 'htb', hvF(K.htb, 3), 'm', ''],
        ...(I.bctm === 'bai'
          ? ([
              ['Chiều rộng lòng chủ ứng với mực nước thiết kế', '', 'bch', hvF(K.bch, 2), 'm', ''],
              ['Diện tích lòng chủ ứng với mực nước thiết kế', '', 'ωch', hvF(K.wch, 2), 'm²', ''],
              [
                'Chiều sâu bình quân phần bãi',
                'h_b=\\sum\\omega_b/\\sum b_b',
                'hb',
                hvF(K.hb, 3),
                'm',
                '',
              ],
              [
                'Chiều rộng thoát nước ứng với diện tích thoát nước cần thiết',
                (K.wc0 ?? 0) <= (K.wch ?? 0)
                  ? 'B_{ct}=b_{ch}\\,\\omega_{ct}/\\omega_{ch}'
                  : 'B_{ct}=b_{ch}+\\dfrac{\\omega_{ct}-\\omega_{ch}}{h_b}',
                'Bct',
                hvF(K.Bct, 2),
                'm',
                '',
              ],
            ] as StepTuple[])
          : I.bctm === 'hch'
            ? ([
                [
                  'Chiều sâu trung bình lòng chủ ứng với mực nước thiết kế',
                  'h_{ch}=\\omega_{ch}/b_{ch}',
                  'hch',
                  hvF(K.hch, 3),
                  'm',
                  '',
                ],
                [
                  'Chiều rộng thoát nước ứng với diện tích thoát nước cần thiết',
                  'B_{ct}=\\omega_{ct}/h_{ch}',
                  'Bct',
                  hvF(K.Bct, 2),
                  'm',
                  '',
                ],
              ] as StepTuple[])
            : ([
                [
                  'Chiều rộng thoát nước ứng với diện tích thoát nước cần thiết',
                  'B_{ct}=\\omega_{ct}/h_{tb}',
                  'Bct',
                  hvF(K.Bct, 2),
                  'm',
                  '',
                ],
              ] as StepTuple[])),
        ['Góc tạo bởi hướng dòng chảy với tim cầu', '', 'α', hvF(alf, 0), 'độ', ''],
        [
          'Khẩu độ thoát nước cần thiết',
          'L_{ct}=\\dfrac{B_{ct}}{\\sin\\alpha}',
          'Lct',
          '<b>' + hvF(K.Lct, 2) + '</b>',
          'm',
          '',
        ],
        [
          'Kiểm tra khẩu độ thiết kế' + (I.sdn ? ' (sơ đồ nhịp ' + I.sdn + ')' : ''),
          'L_0 \\ge L_{ct}',
          '',
          hvOK(K.ok),
          '',
          '',
        ],
      ]) +
      hvP(
        `${I.sdn ? 'Sơ đồ nhịp ' + I.sdn + ': k' : 'K'}hẩu độ thoát nước L0 = ${hvF(K.Lo, 2)} m ${K.ok ? '≥' : '<'} Lct = ${hvF(K.Lct, 2)} m ⇒ <b>${K.ok ? 'Đảm bảo' : 'Không đảm bảo, cần tăng khẩu độ cầu'}</b>.`,
      ) +
      (I.kmAll
        ? hvP('Tính theo các cách và so sánh:') +
          hvMeth(
            ['bel', 'kas', 'sri'].map((k) => ({
              sel: I.km === k,
              n: kmN[k],
              src: wS[k],
              tex: wN[k],
              sym: 'ωct',
              val: hvF(K.m[k] * cs, 2),
              unit: 'm²',
            })),
          ) +
          hvTab(
            ['Cách tính', 'ωct (m²)', 'Lct (m)'],
            ['bel', 'kas', 'sri'].map((k) => ({
              sel: I.km === k,
              c: [
                kmN[k] + hvSrc(wS[k]),
                hvF(K.m[k] * cs, 2),
                hvF((K.htb ?? 0) > 0 ? K.m[k] / (K.htb as number) : NaN, 2),
              ],
            })),
          ) +
          hvAllT(kmN[I.km])
        : '');
  }
  if (I.kmAuto) {
    h += hvP(
      I.km === 'nho'
        ? `Khẩu độ thoát nước L0 = ${hvF(I.PB.Lc, 2)} m ≤ 10 m: dùng biện pháp gia cố lòng suối dưới cầu, khẩu độ tính theo điều kiện lưu tốc dưới cầu không vượt lưu tốc cho phép của vật liệu gia cố ([TKĐ3] mục 10.4.2; [TCVN 9845] Phụ lục C).`
        : `Khẩu độ thoát nước L0 = ${hvF(I.PB.Lc, 2)} m > 10 m: theo kinh nghiệm chỉ nên gia cố lòng suối dưới cầu khi khẩu độ dưới 10 m; khẩu độ và xói tính như đối với cầu trung và lớn ([TKĐ3] mục 10.4.2, 10.4.3).`,
    );
  }
  if (nho) {
    const r = K.sb;
    h +=
      '<h3>4.1. Khẩu độ cầu nhỏ - [TCVN 9845] Điều 6.2, Phụ lục C bài toán 1</h3>' +
      hvStepT([
        ['Khẩu độ thoát nước thực', '', 'L0c', hvF(K.Lo0, 2), 'm', ''],
        ['Hệ số lưu lượng', '', 'm', hvF(I.m, 2), '', '[TCVN 9845] Bảng 7'],
        [
          'Thông số theo m',
          '',
          'k1 ; N',
          hvF(r.k1, 2) + ' ; ' + hvF(r.N, 2),
          '',
          '[TCVN 9845] Bảng 8',
        ],
        ['Cao độ đáy lòng dưới cầu (thấp nhất)', '', 'zđ', hvF(K.zb, 3), 'm', ''],
        [
          'Chiều sâu hạ lưu (dòng chảy đều lúc tự nhiên)',
          'h_h=H_{tk}-z_đ',
          'hh',
          hvF(K.hh, 3),
          'm',
          '[TCVN 9845] Điều 6.2',
        ],
        ['Tốc độ dòng chảy đến cầu', '', 'V0', hvF(K.V0n, 3), 'm/s', ''],
        [
          'Cột nước dâng toàn phần trước cầu',
          'H_0=\\left(\\dfrac{Q}{\\sigma_{ng}m\\sqrt{2g}L_{0c}}\\right)^{2/3}',
          'H0',
          hvF(r.H0, 3),
          'm',
          '[TCVN 9845] PT 40',
        ],
        [
          'Cột nước tĩnh trước cầu',
          'H=H_0-\\dfrac{\\alpha V_0^2}{2g}',
          'H',
          hvF(r.H, 3),
          'm',
          '[TCVN 9845] PT 40',
        ],
        [
          'Chế độ chảy',
          'h_h \\le N.H',
          '',
          r.reg === 'tự do'
            ? 'Chảy tự do (σng = 1)'
            : `Chảy ngập (n = hh/H = ${hvF(r.n, 3)}; σng = ${hvF(r.s, 3)}; kng = ${hvF(r.kng, 3)})` +
              (r.over
                ? ' - n vượt phạm vi Bảng 9: cầu không thu hẹp dòng chảy đáng kể, sơ đồ đập tràn không phù hợp'
                : ''),
          '',
          '[TCVN 9845] Bảng 8, 9',
        ],
        [
          'Chiều sâu tính toán dưới cầu',
          r.reg === 'tự do' ? 'h_t=k_1 H' : 'h_t=k_{ng}H',
          'ht',
          hvF(r.ht, 3),
          'm',
          '[TCVN 9845] PT 41, 42',
        ],
        [
          'Lưu tốc tính toán',
          'V_t=\\dfrac{Q}{h_t L_{0c}}',
          'Vt',
          hvF(r.Vt, 3),
          'm/s',
          '[TCVN 9845] PT C.2',
        ],
        [
          'Lưu tốc cho phép của gia cố (không nội suy)',
          '',
          'Vcp',
          hvF(I.Vcp, 2),
          'm/s',
          '[TCVN 9845] Bảng 10',
        ],
        ['Kiểm tra', 'V_{cp} \\ge V_t', '', hvOK(K.sbOK), '', ''],
        ['Mực nước trước cầu', 'z_đ+H', '', hvF(K.Hup, 3), 'm', ''],
      ]);
  }
  setHv('oK', h);

  // 7. nước dềnh
  const Z = R.Z;
  const zN: Record<string, string> = {
    s1: 'Sổ tay - η tra Bảng 4-10',
    s2: 'Sổ tay - η theo PT 4-20 - 4-22',
    an: 'O.V. Andreev',
    gr: 'Grinich (Andreev có xét xói)',
    nho: 'Cầu nhỏ - cột nước trước cầu',
  };
  if (nho) {
    h =
      '<h3>4.2. Mực nước trước cầu - [TCVN 9845] Điều 6.2</h3>' +
      hvStepT([
        ['Mực nước trước cầu', 'z_đ+H', '', hvF(K.Hup, 3), 'm', '[TCVN 9845] PT 40'],
        [
          'Chiều cao nước dâng so với mực nước thiết kế',
          '\\Delta Z=z_đ+H-H_{tk}',
          'ΔZ',
          hvF(Z.dz, 3),
          'm',
          '',
        ],
        [
          'Mực nước trước cầu dùng tính khổ giới hạn',
          'H_d=H_{tk}+\\Delta Z',
          'Hd',
          '<b>' + hvF(Z.Hd, 3) + '</b>',
          'm',
          '',
        ],
      ]);
    setHv('oZ', h);
  } else {
    const eT: Record<number, string> = {
      0.05: 'sông vùng núi có bãi nhỏ, ΣQb ≤ 10%QTK',
      0.07: 'sông vùng đồi, bãi nhỏ, ΣQb ≤ 30%QTK',
      0.1: 'sông đồng bằng, có hai bãi vừa, ΣQb ≤ 50%QTK',
      0.15: 'sông vùng đất trũng, bãi rất lớn, ΣQb > 50%QTK',
    };
    const eN = eT[+Z.eta1.toFixed(2)] || 'chọn';
    const vN =
      (
        {
          mem: ['đất mềm: tốc độ bình quân dưới cầu sau xói', 'V_\\mu=\\dfrac{Q}{\\omega_{sx}}'],
          tb: [
            'đất trung bình: tốc độ dưới cầu khi xói đạt 50%',
            'V_\\mu=\\dfrac{Q}{\\omega_{sx}}\\cdot\\dfrac{2P}{P+1}\\ ;\\ P=\\omega_{sx}/\\omega',
          ],
          cung: ['đất cứng: tốc độ bình quân dưới cầu trước xói', 'V_\\mu=\\dfrac{Q}{\\omega}'],
        } as Record<string, [string, string]>
      )[I.soil] || ['', 'V_\\mu=Q/\\omega'];
    h =
      '<h3>4.2. Tính độ dềnh trước cầu</h3>' +
      hvP('Độ dềnh trước cầu tính theo công thức kinh nghiệm ([ST] mục 4.7.2, PT 4-19):') +
      hvStepT([
        ['Tỷ lệ lưu lượng chảy trên bãi', '\\sum Q_b/Q', '', hvF(Z.fb * 100, 1) + '%', '', ''],
        ...(Z.sel === 's1' || I.zmAll
          ? [['Hệ số η (' + eN + ')', '', 'η', hvF(Z.eta1, 2), '', '[ST] Bảng 4-10'] as StepTuple]
          : []),
        I.v0m === 'tm'
          ? [
              'Tốc độ bình quân toàn mặt cắt khi chưa làm cầu',
              'V_o=Q/\\omega_{tn}',
              'Vo',
              hvF(Z.V0, 3),
              'm/s',
              '',
            ]
          : [
              'Tốc độ bình quân ở phần mặt cắt thực dưới cầu khi dòng chảy chưa bị thu hẹp',
              'V_o=Q_{cau,o}/\\omega_{cau,o}',
              'Vo',
              hvF(Z.V0, 3),
              'm/s',
              '[ST] mục 4.7.2',
            ],
        ...(Z.Qc > 0
          ? ([
              ['Lưu lượng thoát qua cống trên bãi sông', '', 'Qc', hvF(Z.Qc, 2), 'm³/s', ''],
              ['Lưu lượng thoát qua cầu', 'Q_{cau}=Q-Q_c', 'Qcầu', hvF(Z.Qz, 2), 'm³/s', ''],
            ] as StepTuple[])
          : []),
        [
          'Diện tích thoát nước dưới cầu sau khi làm cầu ứng với mực nước thiết kế (trừ mố, trụ)',
          '',
          'ω',
          hvF(op.A, 2),
          'm²',
          '',
        ],
        ...(I.soil === 'cung'
          ? []
          : ([
              [
                'Diện tích thoát nước dưới cầu sau xói chung (theo chiều sâu sau xói chung tại các thủy trực ở phần tính xói chung, ứng với lũ thiết kế)',
                '',
                'ωsx',
                hvF(Z.wsx, 2),
                'm²',
                '',
              ],
              [
                'Tỷ số diện tích (chiều sâu trung bình) sau xói và trước xói',
                'P=\\omega_{sx}/\\omega',
                'P',
                hvF(Z.Psx, 3),
                '',
                '',
              ],
            ] as StepTuple[])),
        [
          'Tốc độ bình quân dưới cầu khi lưu lượng thoát qua (' + vN[0] + ')',
          vN[1],
          'Vμ',
          hvF(Z.Vc, 3),
          'm/s',
          '[ST] mục 4.7.2',
        ],
        ...(Z.sel === 's1' || I.zmAll
          ? ([
              [
                'Độ dềnh trước cầu',
                '\\Delta Z=\\eta(V_\\mu^2-V_o^2)',
                'ΔZ',
                hvF(Z.m.s1, 3),
                'm',
                '[ST] PT 4-19',
              ],
            ] as StepTuple[])
          : []),
      ]);
    if (Z.sel === 's2' && !I.zmAll) {
      h +=
        hvP('Hệ số η xác định theo [ST] PT 4-20 - 4-22:') +
        hvStepT([
          [
            'Tốc độ trung bình toàn mặt cắt thực khi chưa có cầu',
            'V_{tb}=Q/\\omega_{tn}',
            'Vtb',
            hvF(Z.Vtb, 3),
            'm/s',
            '',
          ],
          [
            'Chiều rộng ngập tính toán (' +
              (Z.Lng < Z.B0 ? 'thu hẹp hai phía: B0/2' : 'thu hẹp một phía: B0') +
              ')',
            '',
            'Lngập',
            hvF(Z.Lng, 2),
            'm',
            '',
          ],
          ['Số Froude', 'Fr=\\dfrac{V_{tb}^2}{gL_{ngap}}', 'Fr', hvF(Z.Fr, 5), '', '[ST] PT 4-22'],
          ['Độ dốc mặt nước khi dòng chảy chưa bị thu hẹp', '', 'io', hvF(I.i, 5), '', ''],
          [
            'Hệ số a (QTK/QC = ' + hvF(Z.QQc, 3) + '; Fr/io = ' + hvF(Z.Fri, 3) + ')',
            '',
            'a',
            hvF(Z.a, 3),
            '',
            '[ST] Bảng 4-11',
          ],
          [
            'Hệ số K',
            'K=1+\\left(\\dfrac{V_{tb}}{V_o}\\right)^2\\dfrac{a}{(Fr/i_o)^{0.5}}',
            'K',
            hvF(Z.Kk, 3),
            '',
            '[ST] PT 4-21',
          ],
          ['Hệ số η', '\\eta=K/2g', 'η', hvF(Z.eta2, 4), '', '[ST] PT 4-20'],
          [
            'Độ dềnh trước cầu',
            '\\Delta Z=\\eta(V_\\mu^2-V_o^2)',
            'ΔZ',
            hvF(Z.m.s2, 3),
            'm',
            '[ST] PT 4-19',
          ],
        ]);
    } else if (Z.sel !== 's1' || I.zmAll) {
      h +=
        hvP(
          I.zmAll
            ? 'Tính theo các cách khác và so sánh:'
            : Z.sel === 's2'
              ? 'Hệ số η xác định theo [ST] PT 4-20 - 4-22:'
              : 'Độ dềnh theo ' + zN[Z.sel] + ':',
        ) +
        hvStepT([
          ['Tốc độ bình quân toàn mặt cắt', '', 'Vtb', hvF(Z.Vtb, 3), 'm/s', ''],
          ['Chiều rộng mặt nước', '', 'B0', hvF(Z.B0, 2), 'm', ''],
          ['Khẩu độ cầu kể cả trụ', '', 'Lc', hvF(Z.Lc, 2), 'm', ''],
          [
            'Hệ số tăng lưu lượng trung bình dưới cầu',
            '\\beta=\\dfrac{Q}{Q_{ch}+Q_{bc}}',
            'β',
            hvF(Z.beta, 3),
            '',
            '[TKĐ3] PT 5-4',
          ],
          [
            'Chiều rộng ngập tính toán (' +
              (Z.Lng < Z.B0 ? 'thu hẹp hai phía: B0/2' : 'thu hẹp một phía: B0') +
              ')',
            '',
            'Lngập',
            hvF(Z.Lng, 2),
            'm',
            '',
          ],
          ['Số Froude', 'Fr=\\dfrac{V_{tb}^2}{gL_{ngap}}', 'Fr', hvF(Z.Fr, 5), '', '[ST] PT 4-22'],
          [
            'Hệ số a (QTK/QC = ' + hvF(Z.QQc, 3) + '; Fr/io = ' + hvF(Z.Fri, 3) + ')',
            '',
            'a',
            hvF(Z.a, 3),
            '',
            '[ST] Bảng 4-11',
          ],
          [
            'Hệ số K',
            'K=1+\\left(\\dfrac{V_{tb}}{V_o}\\right)^2\\dfrac{a}{(Fr/i_o)^{0.5}}',
            'K',
            hvF(Z.Kk, 3),
            '',
            '[ST] PT 4-21',
          ],
        ]) +
        hvMeth(
          (
            [
              {
                k: 's2' as const,
                n: zN.s2,
                src: '[ST] PT 4-19 - 4-21',
                tex: '\\Delta Z=\\eta(V_\\mu^2-V_o^2)\\ ;\\ \\eta=\\dfrac{K}{2g}=' + fx(Z.eta2, 4),
              },
              {
                k: 'an' as const,
                n: zN.an,
                src: '[TKĐ3] PT 5-25',
                tex: '\\Delta Z=\\dfrac{3}{2}\\dfrac{B_0-L_C}{\\theta}I(1+x)(\\beta^2-1)\\ ;\\ \\theta=tg45^o=1\\ ;\\ x=0',
              },
              {
                k: 'gr' as const,
                n: zN.gr,
                src: '[TKĐ3] PT 5-26 - 5-28',
                tex: `\\Delta Z=\\dfrac{3}{2}\\dfrac{B_0-L_C}{\\theta}IK(K_p\\beta^2-1)(1+x)\\ ;\\ K=${fx(Z.Kg, 3)}\\ ;\\ K_p=0.25(2-P)^2+0.75=${fx(Z.Kpg, 3)}`,
              },
            ]
          )
            .filter((m) => I.zmAll || m.k === Z.sel)
            .map((m) => ({
              ...m,
              sel: m.k === Z.sel,
              sym: 'ΔZ',
              val: hvF(Z.m[m.k], 3),
              unit: 'm',
            })),
        );
    }
    h +=
      hvStepT([
        [
          'Mực nước dềnh trước cầu',
          'H_d=H_{tk}+\\Delta Z',
          'Hd',
          '<b>' + hvF(Z.Hd, 3) + '</b>',
          'm',
          '',
        ],
        ...(Z.dzcp != null
          ? ([
              [
                'Kiểm tra chiều cao nước dâng trước cầu không vượt giá trị cho phép [ΔZ] = ' +
                  hvF(Z.dzcp, 2) +
                  ' m (không ảnh hưởng đê điều, dân sinh phía thượng lưu)',
                '\\Delta Z \\le [\\Delta Z]',
                '',
                hvOK(Z.okDZ),
                '',
                '',
              ],
            ] as StepTuple[])
          : []),
      ]) +
      hvP(
        'Khoảng cách từ cầu đến nơi có độ dềnh lớn nhất và độ dềnh lớn nhất ở mái dốc đường dẫn lên cầu ([ST] mục 4.7.2b, c):',
      ) +
      hvStepT(
        (
          [
            [
              'Tốc độ trung bình toàn mặt cắt thực khi chưa có cầu',
              'V_{tb}=Q/\\omega_{tn}',
              'Vtb',
              hvF(Z.Vtb, 3),
              'm/s',
              '',
            ],
            [
              'Chiều rộng ngập tính toán (' +
                (Z.Lng < Z.B0 ? 'thu hẹp hai phía: B0/2' : 'thu hẹp một phía: B0') +
                ')',
              '',
              'Lngập',
              hvF(Z.Lng, 2),
              'm',
              '',
            ],
            ['Số Froude', 'Fr=\\dfrac{V_{tb}^2}{gL_{ngap}}', 'Fr', hvF(Z.Fr, 5), '', '[ST] PT 4-22'],
            [
              'Hệ số a (QTK/QC = ' + hvF(Z.QQc, 3) + '; Fr/io = ' + hvF(Z.Fri, 3) + ')',
              '',
              'a',
              hvF(Z.a, 3),
              '',
              '[ST] Bảng 4-11',
            ],
            [
              'Khoảng cách từ cầu đến nơi có độ dềnh lớn nhất',
              'x_o=aL_{ngap}(Fr/i_o)^{0.5}',
              'xo',
              hvF(Z.x0, 1),
              'm',
              '[ST] PT 4-23',
            ],
            ['Độ dốc mặt nước khi dòng chảy chưa bị thu hẹp', '', 'io', hvF(I.i, 5), '', ''],
            [
              'Độ dềnh lớn nhất ở mái dốc đường dẫn lên cầu',
              '\\Delta h_{TL}=\\Delta h_{d,max}+x_oi_o+\\dfrac{V_{tb}^2}{g}',
              'ΔhTL',
              '<b>' + hvF(Z.TL, 3) + '</b>',
              'm',
              '[ST] PT 4-24; Phụ lục 4-4',
            ],
            [
              'Mực nước dềnh lớn nhất ở mái dốc đường dẫn',
              'H_{TL}=H_{tk}+\\Delta h_{TL}',
              'HTL',
              '<b>' + hvF(Z.HTL, 3) + '</b>',
              'm',
              '',
            ],
          ] as StepTuple[]
        ).filter(
          (r) => !(Z.sel === 's2' && !I.zmAll && ['Vtb', 'Lngập', 'Fr', 'a', 'io'].includes(r[2])),
        ),
      ) +
      hvP(
        `Vậy mực nước dềnh trước cầu Hd = ${hvF(Z.Hd, 3)} m ; mực nước dềnh lớn nhất ở mái dốc đường dẫn lên cầu HTL = ${hvF(Z.HTL, 3)} m.`,
      ) +
      (I.zmAll
        ? hvP('So sánh các cách tính độ dềnh:') +
          hvTab(
            ['Cách tính', 'ΔZ (m)', 'Điều kiện áp dụng'],
            (['s1', 's2', 'an', 'gr'] as const).map((k) => ({
              sel: Z.sel === k,
              c: [zN[k], hvF(Z.m[k], 3), hvApC(Z.app?.[k])],
            })),
          ) +
          hvAllT(zN[Z.sel])
        : hvApW(zN[Z.sel], Z.app?.[Z.sel]));
    if (I.soil === 'tb') {
      h += hvP(
        '[ST] mục 4.7.2 ghi hai biểu thức VC = Vsx.2P/(P+1) hoặc VC = Vsx.(P+1)/2 cho đất trung bình; biểu thức thứ hai không ứng với diện tích khi xói đạt 50% (ω(P+1)/2) nên dùng biểu thức thứ nhất.',
      );
    }
    setHv('oZ', h);
  }

  // 8. khổ giới hạn
  const C = R.C;
  setHv(
    'oC',
    hvStepT([
      [
        'Mực nước ứng với lũ thiết kế khẩu độ (lấy mực nước dềnh trước cầu)',
        '',
        'Hd',
        hvF(R.Hd, 3),
        'm',
        '',
      ],
      [
        'Khổ giới hạn đến đáy kết cấu phần trên (' +
          (I.vt ? 'dòng lũ mang nhiều vật trôi, bùn đá' : 'trường hợp khác') +
          ')',
        '',
        '',
        hvF(C.cl, 2),
        'm',
        '[TCVN 11823-2] Điều 6.4.3',
      ],
      [
        'Cao độ đáy dầm tối thiểu',
        'H_d+' + fx(C.cl, 1),
        '',
        '<b>' + hvF(C.ddMin, 3) + '</b>',
        'm',
        '',
      ],
      [
        'Cao độ đỉnh đá kê gối tối thiểu',
        'H_d+0.25',
        '',
        '<b>' + hvF(C.kgMin, 3) + '</b>',
        'm',
        '[TCVN 11823-2] Điều 6.4.3',
      ],
    ]) +
      hvP(
        `Cao độ đáy dầm thiết kế lấy không thấp hơn ${hvF(C.ddMin, 3)} m; cao độ đỉnh đá kê gối thiết kế lấy không thấp hơn ${hvF(C.kgMin, 3)} m.`,
      ),
  );

  // 9. xói
  const X = R.X;
  const M = X.M;
  const xN: Record<string, string> = {
    lis: 'L.L. Listvan',
    lau: 'Laursen',
    p: 'Belleliutsky - hệ số xói P',
    and: 'O.V. Andreev',
  };
  h = hvP(
    `Xói tính với lũ thiết kế xói P = ${pP(X.P)} ([TCVN 11823-2] Điều 6.4.4.2): Q = ${hvF(X.Q, 2)} m³/s ; H = ${hvF(X.H, 3)} m. Xói tự nhiên lấy bằng 0.`,
  );
  const XL = [
    { k: 'lis', n: xN.lis, src: '[TKĐ3] mục 3.2.4, PT 3-7 - 3-9, Bảng 3-4' },
    {
      k: 'lau',
      n: xN.lau + (M.lau.live ? ' - nước đục' : ' - nước trong'),
      src: '[ST] mục 4.4, PT 4-4 - 4-8, Bảng 4-4',
      tex: M.lau.live
        ? '\\dfrac{y_2}{y_1}=\\left(\\dfrac{Q_2}{Q_1}\\right)^{6/7}\\left(\\dfrac{W_1}{W_2}\\right)^{k_1}'
        : 'y_2=\\left(\\dfrac{0.025Q^2}{D_m^{2/3}W^2}\\right)^{3/7}',
      p: `Vc = 6,19y1^(1/6)D50^(1/3) = ${hvF(M.lau.Vc, 3)} m/s ; V = ${hvF(M.lau.V1, 3)} m/s ; ω = ${hvF(M.lau.w, 4)} m/s ([TKĐ3] Bảng 4-5) ; k1 = ${hvF(M.lau.k1, 2)} ; y2 nước đục / trong = ${hvF(M.lau.y2l, 3)} / ${hvF(M.lau.y2c, 3)} m ; yx = ${hvF(M.lau.yx, 3)} m`,
    },
    {
      k: 'p',
      n: xN.p,
      src: '[TKĐ3] PT 3-3',
      tex: "h'_c=P.h_c",
      p: `P = ${hvF(M.p.P, 3)} (mục 4.1)`,
    },
    {
      k: 'and',
      n: xN.and,
      src: '[TKĐ3] PT 3-21, 3-27, 5-1 - 5-6; [ST] Phụ lục 4-1 mục 1',
      tex: "h'_{ch}=h_{ch}\\beta_{ch}^{8/9}\\left(\\dfrac{B_{ch}}{B'_{ch}}\\right)^{2/3}\\ ;\\ h'_b=h_b\\dfrac{\\beta_bv_{bc}}{(1-\\lambda)v_{ox}}",
      p: `β = ${hvF(M.and.beta, 3)} ; τ = ${hvF(M.and.tau, 3)} ; η = ${hvF(M.and.eta, 3)} ; a = ${hvF(M.and.aa, 3)} ; F = ${hvF(M.and.Fq, 4)} ; βch = ${hvF(M.and.bch, 3)} ; βb = ${hvF(M.and.bb, 3)} ; λ = ${hvF(M.and.lam, 3)} ; B'ch = Bch`,
    },
  ];
  const vm = X.vmax;
  const xs = XL.find((m) => m.k === X.sel) || XL[0];
  if (X.sel === 'lis') {
    const L = M.lis;
    h +=
      hvP(
        `Tính xói chung theo lưu tốc dòng chảy cho phép, công thức L.L. Listvan ${hvSrc(xs.src)}: chiều sâu dòng chảy tại thủy trực tính toán có xét đến chiều sâu xói thêm.`,
      ) +
      hvStepT([
        ['Lưu lượng tính toán', '', 'Qp', hvF(X.Q, 2), 'm³/s', ''],
        ['Khẩu độ cầu tĩnh không (không kể trụ)', '', 'Lc', hvF(X.Lc, 2), 'm', ''],
        [
          'Chiều sâu trung bình trên chiều dài làm việc dưới cầu trước xói',
          'h_{tb}=\\omega/L_c',
          'htb',
          hvF(X.htb, 3),
          'm',
          '',
        ],
        [
          'Hệ số thắt hẹp dòng chảy',
          '\\alpha_p=\\dfrac{Q_p}{L_c h_{tb}^{5/3}}',
          'αp',
          hvF(L.al, 4),
          '',
          '',
        ],
        L.tb
          ? [
              'Chiều sâu nước chảy tại thủy trực tính toán trước khi xói (lấy bằng chiều sâu trung bình dưới cầu)',
              '',
              'htx',
              hvF(X.htb, 3),
              'm',
              '',
            ]
          : [
              'Chiều sâu nước chảy tại thủy trực tính toán (sâu nhất, lý trình ' +
                hvF(vm.x, 2) +
                ') trước khi xói',
              '',
              'htx',
              hvF(vm.h, 3),
              'm',
              '',
            ],
        [
          I.coh
            ? 'Hệ số phụ thuộc dung trọng khô của đất dính (γ = ' + hvF(I.gd, 2) + ' T/m³)'
            : 'Hệ số phụ thuộc kích thước hạt (d = ' + hvF(I.d50, 2) + ' mm)',
          I.coh ? 'a=0.60\\gamma^{1.18}' : 'a=0.68d^{0.28}',
          'a',
          hvF(L.a, 4),
          '',
          '',
        ],
        [
          'Hệ số phụ thuộc tần suất lũ tính toán (P = ' + pP(X.P) + ')',
          '',
          'βp',
          hvF(L.bp, 3),
          '',
          '[TKĐ3] mục 3.2.4',
        ],
        ['Hệ số chiết giảm', '', 'y', hvF(L.y, 3), '', '[TKĐ3] Bảng 3-4'],
        [
          'Chiều sâu sau xói chung tại thủy trực tính toán',
          'H_{sx}=\\left(\\dfrac{\\alpha_p h_{tx}^{5/3}}{a\\beta_p}\\right)^y',
          'Hsx',
          hvF(L.tb ? L.Hst : vm.h2, 3),
          'm',
          '[TKĐ3] PT 3-7',
        ],
        [
          'Chiều sâu xói chung' +
            (L.tb ? ' (áp dụng cho các thủy trực dưới cầu)' : ' tại thủy trực tính toán'),
          'h_{xc}=H_{sx}-h_{tx}',
          'hxc',
          '<b>' + hvF(L.tb ? L.dxt : vm.dx, 3) + '</b>',
          'm',
          '',
        ],
        ...X.abut.map(
          (a): StepTuple => [
            'Chiều sâu xói chung tại mép ' + a.n.toLowerCase() + ' (lý trình ' + hvF(a.x, 2) + ')',
            '',
            'hxc',
            hvF(a.dxa, 3),
            'm',
            '',
          ],
        ),
        ...X.piers.map(
          (q): StepTuple => [
            'Chiều sâu xói chung tại trụ lý trình ' + hvF(q.x, 2),
            '',
            'hxc',
            hvF(q.dxc, 3),
            'm',
            '',
          ],
        ),
      ]) +
      hvP(
        vm.dx > 0.005
          ? '<b>Đất lòng sông bị xói</b> (Hsx > htx).'
          : '<b>Đất lòng sông không bị xói</b> (Hsx ≤ htx): lấy hxc = 0.',
      );
  } else {
    h +=
      hvMeth([{ ...xs, sel: true, sym: "h'max", val: hvF(vm.h2, 3), unit: 'm' }]) +
      hvStepT([
        [
          'Chiều sâu trước xói tại thủy trực sâu nhất (lý trình ' + hvF(vm.x, 2) + ')',
          '',
          'htx',
          hvF(vm.h, 3),
          'm',
          '',
        ],
        ['Chiều sâu lớn nhất sau xói chung', '', 'Hsx', hvF(vm.h2, 3), 'm', ''],
        [
          'Chiều sâu xói chung',
          'h_{xc}=H_{sx}-h_{tx}',
          'hxc',
          '<b>' + hvF(vm.dx, 3) + '</b>',
          'm',
          '',
        ],
      ]);
  }
  if (X.P < 0.33 && X.sel === 'lis') {
    h += hvP('Bảng βp ([TKĐ3] mục 3.2.4) bắt đầu từ P = 0,33%: lấy βp = 1,07.');
  }
  h += hvStepT(
    I.dlt > 0
      ? [
          [
            'Sai số khi xác định chiều sâu sau xói chung',
            '\\Delta=' + fx(I.dlt, 2) + 'H_{sx}',
            'Δ',
            hvF(X.dl, 3),
            'm',
            '[ST] PT 4-17; [TKĐ3] PT 4-31',
          ],
          [
            'Cao độ đường xói chung tính toán',
            X.sel === 'lis' && M.lis.tb ? 'z_{min}-(h_{xc}+\\Delta)' : 'H-(H_{sx}+\\Delta)',
            '∇',
            hvF(X.elG, 3),
            'm',
            '[ST] PT 4-17',
          ],
        ]
      : [
          [
            'Cao độ đường xói chung tính toán' +
              (X.sel === 'lis' && M.lis.tb
                ? ' (zmin = ' + hvF(vm.z, 2) + ' m cao độ đáy thấp nhất dưới cầu)'
                : ''),
            X.sel === 'lis' && M.lis.tb ? 'z_{min}-h_{xc}' : 'H-H_{sx}',
            '∇',
            hvF(X.elG, 3),
            'm',
            '',
          ],
        ],
  );
  h +=
    hvP('Chiều sâu sau xói chung tại các thủy trực dưới cầu:') +
    hvTab(
      [
        'Lý trình (m)',
        'Cao độ đáy (m)',
        'h trước xói (m)',
        'q tự nhiên (m³/s/m)',
        "h' sau xói chung (m)",
        'Xói chung (m)',
        'Cao độ sau xói chung (m)',
      ],
      X.V.filter((vp) => vp.h > 0).map((vp) => [
        hvF(vp.x, 2),
        hvF(vp.z, 2),
        hvF(vp.h, 3),
        hvF(vp.q, 3),
        hvF(vp.h2, 3),
        hvF(vp.dx, 3),
        hvF(vp.z - vp.dx, 3),
      ]),
    );
  if (I.xmAll) {
    h +=
      hvP('Tính theo các cách khác và so sánh:') +
      hvMeth(
        XL.map((m, i) => ({ ...m, i }))
          .filter((m) => (m.k !== X.sel && m.k !== 'lis') || (m.k === 'lis' && X.sel !== 'lis'))
          .map((m) => ({
            ...m,
            tex: m.tex || "h'_{ch}=\\left(\\dfrac{\\alpha h_{ch}^{5/3}}{a\\beta_p}\\right)^y",
            p:
              m.p ||
              `α = ${hvF(M.lis.al, 4)} ; a = ${hvF(M.lis.a, 4)} ; βp = ${hvF(M.lis.bp, 3)} ; y = ${hvF(M.lis.y, 3)}`,
            sym: 'Hsx',
            val: hvF(X.cmp[m.i].hmax, 3),
            unit: 'm',
          })),
      ) +
      hvP('So sánh các cách tính xói chung:') +
      hvTab(
        ['Cách tính', 'Hsx (m)', 'hxc (m)', 'Cao độ đường xói chung (m)', 'Điều kiện áp dụng'],
        XL.map((m, i) => ({
          sel: X.sel === m.k,
          c: [
            m.n + hvSrc(m.src),
            hvF(X.cmp[i].hmax, 3),
            hvF(Math.max(0, X.cmp[i].hmax - (X.V.find((vp) => vp.x === X.cmp[i].x) || vm).h), 3),
            hvF(X.cmp[i].el, 3),
            hvApC(X.app[m.k]),
          ],
        })),
      ) +
      hvAllT(xs.n);
  } else h += hvApW(xs.n, X.app[X.sel]);
  setHv('oX', h);

  h = '';
  if (X.piers.length) {
    h +=
      '<h3>6.1. Xói cục bộ trụ</h3>' +
      hvP(
        "Thông số dòng chảy tại trụ lấy sau xói chung: chiều sâu h = h' tại tim trụ; tốc độ v = q/h' với q là lưu lượng nguyên tố tự nhiên tại thủy trực (phân bố theo h^(5/3)). Hệ số hình dạng Kξ và chiều rộng tính toán B1 theo [TKĐ3] Phụ lục 4; Kd = 0,1Kξ; vox theo [TKĐ3] Bảng 3-6, 3-7.",
      );
    X.piers.forEach((q) => {
      h +=
        hvP(
          `<b>Trụ lý trình ${hvF(q.x, 2)}</b>: a = ${hvF(q.a, 2)} m ; L = ${hvF(q.L, 2)} m ; loại trụ ${q.shape.type} ⇒ Kξ = ${hvF(q.shape.K, 2)} ; B1 = ${hvF(q.shape.B1, 2)} m ; h = ${hvF(q.y1, 3)} m ; v = ${hvF(q.V1, 3)} m/s ; vox = ${hvF(HVM.vox({ d50: I.d50, coh: I.coh, cty: I.cty }, q.y1), 3)} m/s.`,
        ) +
        hvMeth(
          q.all
            .filter((a) => I.pmAll || a.k === q.cur.k)
            .map((a) => ({
              sel: a.k === q.cur.k,
              n: a.n,
              src: a.src,
              tex: a.tex,
              p: a.p,
              sym: 'hcb',
              val: hvF(a.y, 3),
              unit: 'm',
            })),
        );
      h +=
        hvStepT([
          [
            'Chiều sâu xói cục bộ chọn tính toán (' + q.cur.n + ')',
            '',
            'hcb',
            hvF(q.ys, 3),
            'm',
            '',
          ],
          [
            'Cao độ đáy xói tại trụ',
            I.dlt > 0
              ? "\\nabla_{dx}=H-[(h'_{ch,max}+\\Delta)+h_{cb}]"
              : "\\nabla_{dx}=H-(h'_{ch,max}+h_{cb})",
            '∇đx',
            '<b>' + hvF(q.el, 3) + '</b>',
            'm',
            '[ST] PT 4-17; [TKĐ3] PT 4-31',
          ],
        ]) +
        (I.pmAll
          ? hvP('So sánh các công thức xói cục bộ trụ:') +
            hvTab(
              ['Công thức', 'hcb (m)', 'Điều kiện áp dụng'],
              q.all.map((x) => ({
                sel: x.k === q.cur.k,
                c: [x.n + hvSrc(x.src), hvF(x.y, 3), hvApC(x.app)],
              })),
            ) +
            hvAllT(q.cur.n)
          : hvApW(q.cur.n, q.cur.app));
    });
  }

  h += `<h3>6.${X.piers.length ? 2 : 1}. Xói cục bộ mố</h3>`;
  const lpN: Record<string, string> = {
    non: `L' - chiều dài phần 1/4 nón mố nhô ra giao với dòng chảy: L' = m.h, m = ${hvF(I.mta, 2)} hệ số mái 1/4 nón, h chiều sâu nước tại mép mố`,
    bai: "L' - chiều dài mố và nền đường đầu cầu nhô ra giao với dòng chảy, tính từ mép nước ứng với mực nước lũ thiết kế xói đến mép mố",
    man: "L' - chiều dài mố và nền đường đầu cầu nhô ra giao với dòng chảy, lấy theo bố trí thực tế",
  };
  const kx = (a: HvAbutScourItem): boolean =>
    I.am === 'khong' || !!(a.cur && a.cur.k === 'khong');
  X.abut.filter(kx).forEach((a) => {
    h += hvP(
      a.bai
        ? `<b>${a.n}</b>: do mố cầu đặt trên bãi, không choán dòng chủ nên không xét xói cục bộ tại mố.`
        : `<b>${a.n}</b>: <span class="bad">mép mố nằm trong phạm vi lòng chủ, cần xét xói cục bộ (chọn công thức tính)</span>; cao độ đáy tại mép mố sau xói chung ${hvF(a.el, 3)} m.`,
    );
  });
  X.abut
    .filter((a) => !kx(a))
    .forEach((a) => {
      if (!(a.Lp > 0)) {
        h += hvP(
          `<b>${a.n}</b>: mép mố nằm ngoài dòng chảy (L' = 0), không có xói cục bộ; cao độ đáy tại mép mố sau xói chung ${hvF(a.el, 3)} m.`,
        );
        return;
      }
      const c = a.cur!;
      h +=
        hvP(`<b>${a.n}</b> (lý trình ${hvF(a.x, 2)}${a.bai ? ', mố đặt trên bãi' : ''}):`) +
        hvStepT([
          [
            'Chiều sâu dòng chảy tại mép mố trước lúc xói cục bộ (sau xói chung)',
            '',
            'hth',
            hvF(a.h1, 3),
            'm',
            '',
          ],
          [lpN[a.mode], '', "L'", hvF(a.Lp, 2), 'm', ''],
          ['Chiều sâu trung bình dòng chảy tiến vào mố', '', 'ya', hvF(a.ya, 3), 'm', ''],
          ['Tốc độ dòng chảy tiến vào mố', '', 'Vc', hvF(a.Vc, 3), 'm/s', ''],
          ['Số Froude', 'Fr=V_c/\\sqrt{g y_a}', 'Fr', hvF(a.Fr, 3), '', ''],
        ]) +
        hvMeth([
          {
            sel: true,
            n: c.n,
            src: c.src,
            tex: c.tex,
            p: c.p,
            sym: 'hcb',
            val: hvF(c.y, 3),
            unit: 'm',
          },
        ]) +
        hvStepT([
          ['Chiều sâu xói cục bộ tại mố', '', 'hcb', '<b>' + hvF(a.ys, 3) + '</b>', 'm', ''],
          [
            'Cao độ đáy xói tại mố (đáy tại mép mố - xói chung - xói cục bộ)',
            '',
            '',
            '<b>' + hvF(a.el, 3) + '</b>',
            'm',
            '',
          ],
        ]) +
        (I.amAll
          ? hvP('Tính theo các công thức khác và so sánh:') +
            hvMeth(
              a.all
                .filter((x) => x.k !== 'khong' && x.k !== c.k)
                .map((x) => ({
                  n: x.n,
                  src: x.src,
                  tex: x.tex,
                  p: x.p,
                  sym: 'hcb',
                  val: hvF(x.y, 3),
                  unit: 'm',
                })),
            ) +
            hvTab(
              ['Công thức', 'hcb (m)', 'Điều kiện áp dụng'],
              a.all
                .filter((x) => x.k !== 'khong')
                .map((x) => ({
                  sel: x.k === c.k,
                  c: [x.n + hvSrc(x.src), hvF(x.y, 3), hvApC(x.app)],
                })),
            ) +
            hvAllT(c.n)
          : hvApW(c.n, c.app));
    });
  h +=
    `<h3>6.${X.piers.length ? 3 : 2}. Yêu cầu đặt móng</h3>` +
    hvP(
      'Theo [TCVN 11823-2] Điều 6.4.4.2: móng nông trên đất hoặc đá dễ xói đặt đáy dưới cao độ xói; đỉnh bệ móng sâu (bệ cọc) thấp hơn mức xói chung tính toán. Chiều sâu chôn móng tối thiểu dưới đường xói (ΔK + ΔH) ≥ 2,5 m khi chiều sâu móng tính từ mực nước mùa kiệt ≤ 10 m, ≥ 5 m khi lớn hơn; cọc chôn trong đất sau xói ≥ 4 m ([ST] mục 4.6, PT 4-16; [TKĐ3] PT 4-30).',
    );
  h += hvTab(
    ['Yêu cầu', 'Cao độ giới hạn (m)'],
    [
      ...(X.piers.length
        ? [['Đỉnh bệ cọc trụ thấp hơn mức xói chung tính toán', hvF(X.elG, 3)]]
        : []),
      ...X.piers.map((q) => [`Trụ lý trình ${hvF(q.x, 2)}: cao độ đáy xói `, hvF(q.el, 3)]),
      ...X.abut.map((a) => [`${a.n}: cao độ đáy xói`, hvF(a.el, 3)]),
    ],
  );
  setHv('oXc', h);

  // 10. mực nước thi công
  const tcOn = I.tcOn !== '0';
  const sTC = $('hv_secTC');
  if (sTC?.style) sTC.style.display = tcOn ? '' : 'none';
  const hS = $('hv_hSum');
  const hSumHtml = (tcOn ? 8 : 7) + '.&nbsp;&nbsp;TỔNG HỢP KẾT QUẢ';
  if (hS) hS.innerHTML = hSumHtml;
  setOutputValue('hv_hSum', hSumHtml);

  const tcHt = (): string => {
    const ten = (($('hv_tenCT') || {}).value || '').trim() || 'công trình';
    const zb = Math.min(...I.sec.map((p) => p[1]));
    const dh = I.MNHT - zb;
    const d = hvF(I.dTC, 2);
    return (
      `<p>- Mực nước thi công được xác định trên cơ sở mực nước hiện tại (mực nước kiệt) tại vị trí công trình. Do tại vị trí ${ten} không có trạm quan trắc thủy văn nên không có số liệu mực nước thực đo nhiều năm. Qua khảo sát thực địa, mực nước hiện tại đo được là H = +${hvF(I.MNHT, 2)} m${isFinite(dh) && dh > 0 ? `, cao hơn đáy suối khoảng ${hvF(dh, 2)} m` : ''}.</p>` +
      `<p>- Công trình được triển khai thi công chủ yếu trong mùa khô với thời gian thi công ngắn. Tuy nhiên, trong quá trình thi công, mực nước tại vị trí cầu vẫn có thể biến động do mưa cục bộ trong lưu vực, dòng chảy từ thượng lưu hoặc các yếu tố thủy văn khác. Để bảo đảm an toàn cho công tác thi công móng, đắp đảo, bố trí thiết bị và hạn chế nguy cơ ngập hố móng, đồng thời vẫn đảm bảo tính kinh tế của phương án thi công, tư vấn thiết kế kiến nghị lựa chọn mực nước thi công cao hơn mực nước hiện tại ${d} m.</p>` +
      `<p>- Theo đó, mực nước thi công được xác định như sau:</p><p style="text-align:center"><b>MNTC = MNHT + ${d} = ${hvF(I.MNHT, 2)} + ${d} = +${hvF(R.MNTC, 2)} m</b></p>` +
      `<p>- Giá trị dự phòng ${d} m được lựa chọn trên cơ sở kinh nghiệm thiết kế, tổ chức thi công các công trình cầu có điều kiện thủy văn tương tự và phù hợp với điều kiện thi công trong mùa khô.</p>`
    );
  };
  if (tcOn && I.tcm !== 'p10') {
    setHv('oTC', tcHt());
  } else {
    setHv(
      'oTC',
      !tcOn
        ? ''
        : hvP(
            'Mực nước thi công được xác định theo chỉ tiêu an toàn của công trình ([ST] mục 2.5.2), thường lấy mực nước ứng với P = 10%; khi không có số liệu thực đo có thể căn cứ vào mực nước điều tra. Công trình thi công chủ yếu trong mùa khô.',
          ) +
            hvTab(
              ['Cách xác định', 'Căn cứ', 'MNTC (m)'],
              [
                {
                  sel: I.tcm !== 'p10',
                  c: [
                    'Mực nước hiện tại đo khi khảo sát + khoảng dự phòng: ' +
                      hvF(I.MNHT, 2) +
                      ' + ' +
                      hvF(I.dTC, 2),
                    '[ST] mục 2.5.2b (theo mực nước điều tra)',
                    hvF(I.MNHT + I.dTC, 2),
                  ],
                },
                {
                  sel: I.tcm === 'p10',
                  c: [
                    `Mực nước ứng với lũ P = 10% (Q10% = ${hvF(R.Q10.Q, 2)} m³/s, tra quan hệ Q = f(H))`,
                    '[ST] mục 2.5.2',
                    hvF(R.H10, 2),
                  ],
                },
              ],
            ) +
            hvP(
              I.tcm === 'p10'
                ? `<b>Chọn mực nước thi công MNTC = H10% = ${hvF(R.MNTC, 2)} m.</b>`
                : `<b>Chọn mực nước thi công MNTC = MNHT + ${hvF(I.dTC, 2)} = ${hvF(I.MNHT, 2)} + ${hvF(I.dTC, 2)} = ${hvF(R.MNTC, 2)} m.</b> Giá trị dự phòng ${hvF(I.dTC, 2)} m lựa chọn trên cơ sở kinh nghiệm thiết kế, thi công các công trình tương tự.`,
            ),
    );
  }

  // 11. tổng hợp
  const sm: Array<[string, string, string]> = [
    ...(isFinite(qa.Hp) ? ([['Lượng mưa ngày lớn nhất H' + pP(Pd), 'mm', hvF(qa.Hp, 1)]] as [string, string, string][]) : []),
    ['Lưu lượng thiết kế Q' + pP(Pd), 'm³/s', hvF(qa.Q, 2)],
    ['Mực nước thiết kế H' + pP(Pd), 'm', hvF(R.Htk, 3)],
    ...(R.Pa
      ? ([
          [
            'Lưu lượng Q' + pP(R.Pa) + ' ; mực nước H' + pP(R.Pa),
            'm³/s ; m',
            hvF(R.Q[R.Pa].Q, 2) + ' ; ' + hvF(R.H[R.Pa], 3),
          ],
        ] as [string, string, string][])
      : []),
    ['Tốc độ lòng chủ lúc tự nhiên', 'm/s', hvF(o.ch.V, 3)],
    ['Độ dềnh trước cầu ΔZ (' + zN[R.Z.sel] + ')', 'm', hvF(R.Z.dz, 3)],
    ['Mực nước dềnh trước cầu Hd', 'm', hvF(R.Hd, 3)],
    ...(R.Z.dzcp != null
      ? ([['Kiểm tra ΔZ ≤ [ΔZ] = ' + hvF(R.Z.dzcp, 2) + ' m', '', R.Z.okDZ ? 'Đạt' : 'Không đạt']] as [
          string,
          string,
          string,
        ][])
      : []),
    ...(R.W && isFinite(R.W.Htt as number)
      ? ([
          [
            'Mực nước thông thuyền H5% tại cầu (chuyển từ trạm ' + I.wlst + ')',
            'm',
            hvF(R.W.Htt, 2),
          ],
        ] as [string, string, string][])
      : []),
    ...(R.Z.HTL != null
      ? ([['Mực nước dềnh ở mái dốc đường dẫn lên cầu HTL', 'm', hvF(R.Z.HTL, 3)]] as [
          string,
          string,
          string,
        ][])
      : []),
    ['Cao độ đáy dầm tối thiểu', 'm', hvF(C.ddMin, 3)],
    ['Cao độ đỉnh đá kê gối tối thiểu', 'm', hvF(C.kgMin, 3)],
    ...(I.km === 'nho'
      ? ([
          [
            'Khẩu độ (' + kmN.nho + '): Vt / Vcp',
            '',
            hvF(K.sb.Vt, 2) + ' / ' + hvF(I.Vcp, 2) + ' m/s',
          ],
          ['Khẩu độ thoát nước cần thiết (cầu nhỏ) L0c', 'm', hvF(K.Lo0, 2)],
        ] as [string, string, string][])
      : ([
          [
            'Khẩu độ thoát nước cần thiết Lct (' + (kmN[I.km] || kmN.bel) + ')',
            'm',
            '<b>' + hvF(K.Lct, 2) + '</b>',
          ],
          [
            'Khẩu độ thoát nước thiết kế L0 - kiểm tra L0 ≥ Lct',
            'm',
            hvF(K.Lo, 2) + ' - ' + (K.ok ? 'Đạt' : '<b class="bad">Không đạt</b>'),
          ],
        ] as [string, string, string][])),
    ['Lưu lượng lũ thiết kế xói Q' + pP(R.Px), 'm³/s', hvF(X.Q, 2)],
    I.dlt > 0
      ? [
          'Chiều sâu xói chung lớn nhất hxc (' + xN[X.sel] + ') ; sai số Δ',
          'm',
          hvF(X.vmax.dx, 2) + ' ; ' + hvF(X.dl, 2),
        ]
      : ['Chiều sâu xói chung lớn nhất hxc (' + xN[X.sel] + ')', 'm', hvF(X.vmax.dx, 2)],
    ...X.abut.map((a): [string, string, string] => [
      'Chiều sâu xói chung tại mép ' + a.n.toLowerCase(),
      'm',
      hvF(a.dxa, 2),
    ]),
    ...X.piers.map((q): [string, string, string] => [
      'Chiều sâu xói chung tại trụ lý trình ' + hvF(q.x, 2),
      'm',
      hvF(q.dxc, 2),
    ]),
    [
      I.dlt > 0 ? 'Cao độ đường xói chung tính toán (kể cả Δ)' : 'Cao độ đường xói chung tính toán',
      'm',
      hvF(X.elG, 3),
    ],
    ...X.piers.map((q): [string, string, string] => [`Cao độ đáy xói trụ ${hvF(q.x, 1)}`, 'm', hvF(q.el, 3)]),
    ...X.abut.map((a): [string, string, string] => [`Cao độ đáy xói ${a.n.toLowerCase()}`, 'm', hvF(a.el, 3)]),
    ...(tcOn ? ([['Mực nước thi công', 'm', hvF(R.MNTC, 2)]] as [string, string, string][]) : []),
  ];
  setHv(
    'tbSum',
    '<tr><th>Thông số</th><th>Đơn vị</th><th>Giá trị</th></tr>' +
      sm
        .map((r) => `<tr><td class="l">${r[0]}</td><td class="c">${r[1]}</td><td>${r[2]}</td></tr>`)
        .join(''),
  );
  const ok = K.ok && R.Z.okDZ !== false;
  const notes = [...(I.km !== 'nho' && !K.chOK ? ['mố lấn vào lòng chủ'] : [])];
  setHv(
    'kl',
    `<p class="${ok ? 'ok' : 'bad'}"><b>${ok ? 'KẾT LUẬN: KHẨU ĐỘ CẦU ĐẠT YÊU CẦU THỦY VĂN, THỦY LỰC; CAO ĐỘ ĐÁY DẦM ≥ ' + hvF(C.ddMin, 3) + ' m, ĐỈNH ĐÁ KÊ GỐI ≥ ' + hvF(C.kgMin, 3) + ' m' : 'KẾT LUẬN: KHÔNG ĐẠT - ' + [...(!K.ok ? [I.km === 'nho' ? 'lưu tốc dưới cầu vượt lưu tốc cho phép' : 'khẩu độ thoát nước thiết kế nhỏ hơn khẩu độ thoát nước cần thiết'] : []), ...(R.Z.okDZ === false ? ['chiều cao nước dâng trước cầu ΔZ = ' + hvF(R.Z.dz, 2) + ' m vượt giá trị cho phép ' + hvF(R.Z.dzcp, 2) + ' m, cần tăng khẩu độ'] : [])].join('; ').toUpperCase()}</b></p>` +
      (notes.length ? `<p class="small">Ghi chú: ${notes.join('; ')}.</p>` : ''),
  );
  hvCapNum();
}

// ---------- liên kết sang trụ ----------
export function hvLink(R: HvCalcResult | null): void {
  if (!R || R.err.length || !R.I.lnk) return;
  const X = R.X;
  if (!X || !X.piers.length) return;
  const q = X.piers.reduce((b, x) => (x.el < b.el ? x : b), X.piers[0]);
  const setv = (id: string, val: number): void => {
    if (!isFinite(val)) return;
    const s = val.toFixed(3);
    const e = $(id);
    if (!e) {
      sv(id, s);
      return;
    }
    if (e.value !== s) {
      e.value = s;
      e.classList?.add('lnk');
      e.title = 'Lấy từ trang thủy văn';
      dispatchElEvents(e, ['input']);
    }
  };
  setv('td_MNCN', R.Hd);
  setv('td_ELg', q.z);
  setv('td_hx', Math.max(0, q.z - q.el));
}

export function hvStep(): HvCalcResult | null {
  try {
    hvPierInfo();
    hvPxShow();
    hvPInfo();
    const I = hvIn();
    const R = hvCalc(I);
    HVR = R;
    hvRender(R);
    hvLink(R);
    try {
      hvA1Ref(R);
    } catch {
      // ignore missing reference box
    }
    try {
      const hooks = getVisualHooks();
      hooks.renderHydrology?.({ mode: 'bridge', result: R });
      hvCapNum();
      hooks.renderMath?.();
    } catch (e) {
      console.error(e);
    }
    return R;
  } catch (e) {
    console.error(e);
    const msg = 'Lỗi tính thủy văn: ' + (e instanceof Error ? e.message : String(e));
    const er = $('hv_err');
    if (er) er.textContent = msg;
    setOutputValue('hv_err', msg);
    return null;
  }
}

// ============================================================================
// 12. Declarative DOM Initializer (No Top-Level Side Effects on Import)
// ============================================================================

export function initBridgeHydroDom(): () => void {
  setStationDomHooks({
    onWlStep: () => {
      hvStep();
    },
    onHvStInfo: () => {
      hvStInfo();
    },
  });
  setDemStepHook(() => {
    hvStep();
  });

  if (typeof document === 'undefined') {
    return () => {
      setDemStepHook(null);
    };
  }

  // Init station select, Cowan roughness panel, and legacy series migration
  const s = $('hv_st');
  if (s && !s.value) s.value = 'khac';
  hvStInfo();

  try {
    const ta = $('hv_rain');
    if (s && ta && hvSerOld(s.value, ta.value)) hvStRe(ta, s.value);
    const s2 = $('tvc_st2');
    const t2 = $('tvc_rain');
    if (s2 && t2 && hvSerOld(s2.value, t2.value)) hvStRe(t2, s2.value);
  } catch (e) {
    console.error(e);
  }

  hvPierInfo();
  hvPxShow();

  const td = $('hv_nTool');
  const cleanups: Array<() => void> = [];
  if (td) {
    const blk = (p: NcSide, t: string, d: number[]): string =>
      `<p><b>${t}</b>: ` +
      (Object.keys(NCW) as NcKey[])
        .map((k, i) => `${NCL[k]} ${ncSel(p, k, d[i])}`)
        .join(' ') +
      ` → n = <b id="nc_${p}_v"></b> <button type="button" class="btn2" data-ncset="${p}">Gán vào ô ${p === 'ch' ? 'nch' : 'nb'}</button></p>`;
    td.innerHTML =
      '<details class="hvref"><summary>Công cụ chọn hệ số nhám n cho sát (bấm để mở)</summary>' +
      '<p class="small"><b>1. Cộng thành phần (Cowan; V.T. Chow 1959, Bảng 5-5)</b>: n = (n0 + n1 + n2 + n3 + n4).m5, chọn theo hiện trạng khảo sát từng thành phần rồi đối chiếu với mô tả ở Sổ tay Bảng 2-11.</p>' +
      blk('ch', 'Lòng chủ', [0, 1, 0, 0, 0, 0]) +
      blk('b', 'Bãi sông', [0, 1, 0, 1, 1, 0]) +
      '<p class="small"><b>2. Hiệu chỉnh theo lũ lịch sử</b>: lũ điều tra có ước được chu kỳ lặp lại N (ghi cột thứ 3 trong ô lũ lịch sử) thì tìm n để mực nước tính với Q(P = 100/N) trùng mực nước điều tra (nch, nb nhân cùng một hệ số). <button type="button" class="btn2" data-nccal="1">Tính hiệu chỉnh</button></p><div id="nc_cal"></div>' +
      '<p class="small"><b>3. Độ nhạy</b>: mực nước thiết kế khi n thay đổi ±20%. <button type="button" class="btn2" data-ncsens="1">Tính</button></p><div id="nc_sens"></div></details>';

    const selectChangeHandler = (e: Event): void => {
      e.stopPropagation();
      ncUpd();
    };
    const selNodes = Array.from((td as unknown as HTMLElement).querySelectorAll?.('select') ?? []);
    for (const sel of selNodes) {
      sel.addEventListener('change', selectChangeHandler);
      cleanups.push(() => sel.removeEventListener('change', selectChangeHandler));
    }
    ncUpd();
  }

  const onChange = (e: Event): void => {
    const id = (e.target as HTMLElement | null)?.id;
    if (id === 'hv_st') hvStSel();
    else if (id === 'hv_pxm') hvPxShow();
  };
  const onInput = (e: Event): void => {
    const id = (e.target as HTMLElement | null)?.id;
    if (id === 'hv_piers' || id === 'hv_xA1' || id === 'hv_xA2') hvPierInfo();
  };
  const onClick = (e: Event): void => {
    const target = e.target as HTMLElement | null;
    if (!target || typeof target.closest !== 'function') return;

    const hvSetEl = target.closest('[data-hvset]') as HTMLElement | null;
    if (hvSetEl?.dataset.hvset) {
      hvSetEl.dataset.hvset.split(';').forEach((kv) => {
        const [id, val] = kv.split('=');
        const el = $('hv_' + id);
        if (!el) return;
        el.value = val;
        dispatchElEvents(el, ['input', 'change']);
      });
    }

    const ncSetEl = target.closest('[data-ncset]') as HTMLElement | null;
    if (ncSetEl?.dataset.ncset) ncSet(ncSetEl.dataset.ncset);

    if (target.closest('[data-nccal]')) ncCal();

    const ncCalSetEl = target.closest('[data-nccalset]') as HTMLElement | null;
    if (ncCalSetEl?.dataset.nccalset) {
      const k = parseFloat(ncCalSetEl.dataset.nccalset);
      if (isFinite(k)) ncCalSet(k);
    }

    if (target.closest('[data-ncsens]')) ncSens();
  };

  document.addEventListener('change', onChange);
  document.addEventListener('input', onInput);
  document.addEventListener('click', onClick);

  return () => {
    document.removeEventListener('change', onChange);
    document.removeEventListener('input', onInput);
    document.removeEventListener('click', onClick);
    cleanups.forEach((fn) => fn());
    setDemStepHook(null);
  };
}
