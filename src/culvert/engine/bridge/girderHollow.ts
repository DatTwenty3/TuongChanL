import type {
  GirderBranchResult,
  GirderResult,
  GirderSystemType,
  Point2D,
} from '../../types/project.ts';
import { $, fx, getVisualHooks, num, nums } from '../context.ts';
import { objLinkOff, objUnlock, spXF, xfLink } from './crossfall.ts';

const PI = Math.PI;
const sq = Math.sqrt;

// ============================================================================
// Pure helpers & hook registry (zero circular imports)
// ============================================================================

export type SpSuperstructureType = 'BR' | 'RC' | 'I';
export type DamLibKey = '15' | '18' | '21' | '24';
export type RcGrvKey = '240T' | '300T' | '300V' | '400V';

/**
 * Hole definition:
 * - `[xc, yc, D]` for circular void
 * - `[xc, yc, b, h, r]` for rounded rectangular void
 */
export type DamVoid =
  | readonly [number, number, number]
  | readonly [number, number, number, number, number];

/** Strand tuple `[id, rowLabel, x, y, debondLengthMm]`. */
export type DamStrand = readonly [number, string, number, number, number];

/** Stirrup zone tuple `[xStartMm, xEndMm, spacingMm]` (or optional legs override `[xStartMm, xEndMm, spacingMm, legs]`). */
export type StirrupZone = readonly [number, number, number] | readonly [number, number, number, number];

export interface LeverRuleResult {
  g: number;
  k: number;
  pos: number[];
  R?: number;
  m?: number;
}

export type LeverRuleFn = (
  xs: readonly number[],
  j: number,
  xa: number,
  xb: number,
  nL: number,
  mUse: boolean,
) => LeverRuleResult;

const mOfMultiPresence = (k: number): number =>
  k === 1 ? 1.2 : k === 2 ? 1 : k === 3 ? 0.85 : 0.65;

/**
 * Transverse live-load distribution via lever rule (exact port of GI.leverRule).
 */
export function leverRule(
  xs: readonly number[],
  j: number,
  xa: number,
  xb: number,
  nL: number,
  mUse: boolean,
): LeverRuleResult {
  const n = xs.length;
  const y = (x: number): number => {
    let val = 0;
    if (j > 0 && x > xs[j - 1] && x <= xs[j]) {
      val = (x - xs[j - 1]) / (xs[j] - xs[j - 1]);
    } else if (j < n - 1 && x >= xs[j] && x < xs[j + 1]) {
      val = (xs[j + 1] - x) / (xs[j + 1] - xs[j]);
    } else if (j === 0 && x < xs[0]) {
      val = 1 + (xs[0] - x) / (n > 1 ? xs[1] - xs[0] : 1);
    } else if (j === n - 1 && x > xs[n - 1]) {
      val = 1 + (x - xs[n - 1]) / (n > 1 ? xs[n - 1] - xs[n - 2] : 1);
    }
    return Math.max(0, val);
  };
  const h = 0.01;
  const lo = xa;
  const hi = xb - 3.6;
  if (hi < lo - 1e-9) return { g: 0, k: 0, pos: [] };
  const count = Math.floor((hi - lo) / h + 1e-9) + 1;
  const laneStarts = Array.from({ length: count }, (_, i) => lo + i * h);
  const du = Math.round(0.6 / h);
  const bestIn = laneStarts.map((l) => {
    let bestVal = -1;
    let bestT = 0;
    for (let k = 0; k <= du; k++) {
      const t = l + 0.6 + k * h;
      const val = 0.5 * (y(t) + y(t + 1.8));
      if (val > bestVal) {
        bestVal = val;
        bestT = t;
      }
    }
    return { v: bestVal, t: bestT };
  });
  const gap = Math.round(3.6 / h);
  let best: LeverRuleResult = { g: 0, k: 0, pos: [] };
  let prev = bestIn.map((o) => ({ v: o.v, p: [o.t] }));
  for (let k = 1; k <= Math.max(1, nL); k++) {
    if (k > 1) {
      const nx: Array<{ v: number; p: number[] }> = [];
      let run: { v: number; p: number[] } = { v: -1, p: [] };
      for (let i = 0; i < count; i++) {
        const q = i - gap;
        if (q >= 0 && prev[q].v > run.v) run = prev[q];
        nx.push(
          run.v >= 0 ? { v: run.v + bestIn[i].v, p: [...run.p, bestIn[i].t] } : { v: -1, p: [] },
        );
      }
      prev = nx;
    }
    const top = prev.reduce((a, b) => (b.v > a.v ? b : a), { v: -1, p: [] as number[] });
    if (top.v < 0) break;
    const mm = mUse ? mOfMultiPresence(k) : 1;
    const g = mm * top.v;
    if (g > best.g) best = { g, k, pos: top.p, R: top.v, m: mm };
  }
  return best;
}

export interface GirderHollowHooks {
  giStep?: (I: DamSpInput, LIM: DamLimits) => void;
  giLink?: () => boolean;
  giTag?: () => void;
  giLoadLib?: () => void;
  supK?: () => boolean;
  supApply?: () => void;
  supLink?: () => boolean;
  spType?: () => SpSuperstructureType;
  spTypeApply?: () => void;
  spBRsync?: () => void;
  moLink?: () => void;
  trLink?: () => void;
  saveAll?: () => void;
  run?: () => void;
  leverRule?: LeverRuleFn;
}

export interface GirderHollowStepOptions {
  hooks?: GirderHollowHooks;
}

let registeredHooks: GirderHollowHooks = {};

export function registerGirderHollowHooks(hooks: GirderHollowHooks): void {
  registeredHooks = { ...registeredHooks, ...hooks };
}

export function getGirderHollowHooks(): GirderHollowHooks {
  return { ...registeredHooks };
}

export function clearGirderHollowHooks(): void {
  registeredHooks = {};
}

function resolveHooks(options?: GirderHollowStepOptions): GirderHollowHooks {
  return options?.hooks ? { ...registeredHooks, ...options.hooks } : registeredHooks;
}

function resolveLeverRule(options?: GirderHollowStepOptions): LeverRuleFn {
  return resolveHooks(options).leverRule ?? leverRule;
}

// ============================================================================
// Domain Interfaces
// ============================================================================

export interface DamLimits {
  trC: number;
  trT: number;
  trT2: number;
  svP: number;
  svI: number;
  svT: number;
  dkP: number;
  dkI: number;
  fat: number;
}

export interface DamLibSectionShape {
  dd: Point2D[];
  cc: Point2D[];
}

export interface DamLibEntry {
  name: string;
  Lt: number;
  a0: number;
  H: number;
  giua: DamLibSectionShape;
  bien: DamLibSectionShape;
  voids: DamVoid[];
  Lend: number;
  Lmid: number;
  solids?: Array<[number, number]>;
  strands: DamStrand[];
  stir: {
    name: string;
    d: number;
    legs: number;
    zones: Array<[number, number, number]>;
  };
  conn: {
    name: string;
    d: number;
    legs: number;
  };
  hook: number;
  anN: number;
  anD: number;
  fci?: number;
  hm: string;
}

export interface DamSpInput {
  WPL: number;
  skew: number;
  APL: number;
  qPL: number;
  Lt: number;
  a0: number;
  bg: number;
  sup: 'K' | 'G';
  bk1: number;
  bk2: number;
  tpad: number;
  Gpad: number;
  mupad: number;
  fck: number;
  Ng: number;
  S: number;
  Wb: number;
  Wpa: number;
  W: number;
  nL: number;
  Hpa: number;
  Apa: number;
  Pra: number;
  hs: number;
  hwear: number;
  Hsu: number;
  gsu: number;
  DWu: number;
  curbMode: string;
  IM: number;
  gc: number;
  K1: number;
  fc: number;
  fci: number;
  fcs: number;
  db: number;
  Ap1: number;
  fpu: number;
  fpyr: number;
  fpjr: number;
  Ep: number;
  fy: number;
  Es: number;
  RH: number;
  ti: number;
  tcur: number;
  td: number;
  tf: number;
  exp: string;
  ifc: string;
  gLL3: number;
  dlim: number;
  kps: number;
  a1: number;
  g1: number;
  g2: number;
  g3: number;
  gFat: number;
  IMf: number;
  hook: number;
  kdyn: number;
  TGp: [number, number, number];
  TGn: [number, number, number];
  gTG: number;
  alpha: number;
  ag?: number;
  XF?: unknown;
  hsxG?: number;
  hsxB?: number;
  Atd?: number;
  gpl?: string;
}

export interface DamDistFactors {
  b: number;
  k: number;
  J: number;
  IJ: number;
  Ig: number;
  tv: number;
  tt: number;
  tb: number;
  ttc: number;
  tw: number;
  b0: number;
  d0: number;
  M1: number;
  M2: number;
  V1: number;
  V2: number;
  Mi: number;
  Vi: number;
  nL: number;
  fromG?: boolean;
  de?: number;
  eM1?: number;
  eM2?: number;
  eV1?: number;
  eV2?: number;
  fb?: number;
  M1e?: number;
  M2e?: number;
  V1e?: number;
  V2e?: number;
  M: number;
  V: number;
  lev: number;
  deOutM: boolean;
  deOutV: boolean;
  levB: boolean;
  th: number;
  cM: number;
  cV: number;
  M0: number;
  V0: number;
  range: {
    b: boolean;
    L: boolean;
    Nb: boolean;
    J: boolean;
    I: boolean;
    th?: boolean;
  };
  [key: string]: number | boolean | object | undefined;
}

export interface DamGirderInput {
  kind: 'giua' | 'bien';
  H: number;
  dd: Point2D[];
  cc: Point2D[];
  voids: DamVoid[];
  Lend: number;
  Lmid: number;
  solids?: Array<[number, number]>;
  strands: DamStrand[];
  stir: {
    name: string;
    d: number;
    legs: number;
    zones: Array<[number, number, number]>;
  };
  conn: {
    name: string;
    d: number;
    legs: number;
  };
  de: number;
  anN: number;
  anD: number;
  anS?: number;
  nTop?: number;
  dTop?: number;
  ddRef?: Point2D[];
  DFg?: DamDistFactors;
}

export interface DamSectionProps {
  A: number;
  yb: number;
  I: number;
}

export interface DamStrandGroup {
  y: number;
  l0: number;
  n: number;
  ids: number[];
}

export interface DamTensCheckResult {
  T: number;
  Areq: number;
  Aprov: number;
  lim: number;
  reinf: boolean;
}

export interface DamStrandFlexDetail extends DamStrandGroup {
  f: number;
  lx: number;
  fs: number;
  dp: number;
  ld: number;
  fps?: number;
}

export interface DamSectionRes {
  x: number;
  tag: string;
  stype: string;
  hollow: boolean;
  nb: number;
  Aps: number;
  ycg: number;
  e: number;
  ec: number;
  Ag: number;
  Ig: number;
  yb: number;
  yt: number;
  Ac: number;
  Ic: number;
  ycb: number;
  yct: number;
  ysl: number;
  M1: number;
  M2: number;
  M3: number;
  MW: number;
  MLLv: number;
  MLLl: number;
  MPL: number;
  VPL: number;
  MLL: number;
  vehM: string;
  Mu: number;
  VLLv: number;
  VLLl: number;
  VLL: number;
  Vu: number;
  VDC1: number;
  VDC2: number;
  VDC3: number;
  VDW: number;
  fcgp: number;
  dES: number;
  dR1: number;
  Kid: number;
  dSR: number;
  dCR: number;
  Kdf: number;
  dSD: number;
  dfcd: number;
  dCD: number;
  dR2: number;
  dfcdf: number;
  dSS: number;
  dLTid: number;
  dLTdf: number;
  dLT: number;
  dT: number;
  fpt: number;
  fpe: number;
  Pt: number;
  Pe: number;
  ft_tr: number;
  fb_tr: number;
  trT: DamTensCheckResult;
  P: Point2D[];
  ftP: number;
  ftI: number;
  fbIII: number;
  fbP: number;
  fdP: number;
  fdI: number;
  ftIT?: number;
  fbIIIT?: number;
  fdIT?: number;
  ftFat: number;
  Mfat: number;
  c: number;
  a: number;
  web: boolean;
  phi: number;
  et: number;
  Mn: number;
  Mr: number;
  fps: DamStrandFlexDetail[];
  T: number;
  fcpe: number;
  Mcr: number;
  Mmin: number;
  Scm: number;
  Snc: number;
  Mdnc: number;
  de: number;
  dv: number;
  bv: number;
  es: number;
  esNeg: boolean;
  beta: number;
  th: number;
  s: number;
  Vc: number;
  Vs: number;
  Vlim: number;
  Vn: number;
  Vr: number;
  Avmin: number;
  Av: number;
  vu: number;
  smax: number;
  needAv: boolean;
  Treq: number;
  Tprov: number;
  dvi: number;
  esOwn: number;
  Vui: number;
  Vni: number;
  Vri: number;
  Avf: number;
  Avfmin: number;
  Acv: number;
  hasMin: boolean;
  sxe: number;
}

export interface DamLiftCase {
  nm: string;
  x: number;
  kd: number;
  M: number;
  Pt: number;
  ft: number;
  fb: number;
  tc: DamTensCheckResult;
}

export interface DamThermalGradComp {
  dk: number;
  gt: number;
  gb: number;
  A: number;
  kap: number;
}

export type DamSummaryItem = [string, string | number, string, boolean | 'star'];

export interface DamCalcResult {
  EIc: number;
  Lm: number;
  fsT: number;
  AsTop: number;
  debond: {
    n: number;
    tot: number;
    ratio: number;
    rows: Record<string, { n: number; d: number; xs: number[] }>;
    endAt: Record<number, number>;
    maxEnd: number;
    limEnd: number;
    outerOK: boolean;
    symOK: boolean;
    totOK: boolean;
    otherOK: boolean;
    ok: boolean;
  };
  lift: DamLiftCase[];
  TG: {
    pos: DamThermalGradComp;
    neg: DamThermalGradComp;
    g: number;
  };
  kind: 'giua' | 'bien';
  Ec: number;
  Eci: number;
  Ecs: number;
  ncs: number;
  S_h: DamSectionProps;
  S_s: DamSectionProps;
  S_e: DamSectionProps;
  Sc_h: DamSectionProps;
  Sc_s: DamSectionProps;
  Aavg: number;
  loads: {
    DC1: number;
    DC2: number;
    DC3: number;
    DC4: number;
    DWsu: number;
    DWu: number;
    DW: number;
    curb: number;
    rail: number;
    side: number;
    wPL: number;
    qPLs: number;
    Ajoint: number;
    Aavg: number;
  };
  DF: DamDistFactors;
  IM: number;
  groups: DamStrandGroup[];
  nstr: number;
  lt: number;
  shr: {
    tcur: number;
    kc5: number;
    khs: number;
    khc: number;
    kf: number;
    kfd: number;
    VS: number;
    ks: number;
    VSd: number;
    ksd: number;
    ktd_di: number;
    ktd_fi: number;
    ktd_fd: number;
    ktd_d: number;
    psi_fi: number;
    psi_di: number;
    psi_fd: number;
    psi_d: number;
    eps_bid: number;
    eps_bif: number;
    eps_bdf: number;
    eps_ddf: number;
  };
  res: DamSectionRes[];
  camber: {
    dps: number;
    dsw: number;
    d0: number;
    rLT: number;
    dtd: number;
    dcr: number;
    dDeck: number;
    dDk2: number;
    dDk3: number;
    dtr: number;
    dlane: number;
    dLL1: number;
    dLL2: number;
    DFd: number;
    mL: number;
    lim: number;
  };
  anch: {
    b: number;
    h4: number;
    n: number;
    d: number;
    AsL: number;
    nS: number;
    legS: number;
    dS: number;
    AsS: number;
    Asz: number;
    Pr: number;
    Pi: number;
    req: number;
  };
  IF: {
    c: number;
    mu: number;
    K1: number;
    K2: number;
    t: string;
  };
  bvi: number;
  Rg: { DC: number; DW: number };
  hs: number;
  hsw: number;
  bd: number;
  Lend: number;
  Lmid: number;
  SOL: Array<[number, number]>;
  Lh: number;
  L: number;
  Ls: number;
  brg: number;
  xv: number;
  Av: number;
  Avf1: number;
  H: number;
  vol: number;
  jointTot: number;
  items?: DamSummaryItem[];
  allOK?: boolean;
}

export interface RcBarInput {
  n: number;
  d: number;
  y: number;
  top: boolean;
}

export interface RcLib868Entry {
  sp: Record<string, string | number>;
  rc: Record<string, string | number>;
}

export interface RcInput {
  h1: number;
  h2: number;
  h3: number;
  h4: number;
  h5: number;
  H: number;
  bt: number;
  b3: number;
  bd: number;
  bdE: number;
  voids: Array<[number, number, number]>;
  bars: RcBarInput[];
  barsE: RcBarInput[];
  sbar: number;
  fy: number;
  fu: number;
  grT: string;
  fyv: number;
  fuv: number;
  grvT: string;
  sd: number;
  sn: number;
  sz: number[][];
  cd: number;
  cn: number;
  ag: number;
  ge: number;
  etaD: number;
  etaR: number;
  etaI: number;
  eta: number;
}

export interface RcGrossProps {
  A: number;
  yb: number;
  yt: number;
  I: number;
  Iy: number;
  xc: number;
  Ip: number;
  Sb: number;
  St: number;
  top: number;
}

export interface RcFiberSlice {
  y: number;
  b: number;
  fc: number;
  r: number;
}

export interface RcFiberBundle {
  F: RcFiberSlice[];
  top: number;
  dy: number;
}

export interface RcFlexResult {
  c: number;
  a: number;
  b1: number;
  a1: number;
  Cc: number;
  yC: number;
  T: number;
  de: number;
  dt: number;
  et: number;
  ecl: number;
  etl: number;
  phi: number;
  Mn: number;
  Mr: number;
  bars: Array<{
    n: number;
    d: number;
    y: number;
    A: number;
    top: boolean;
    dep: number;
    e: number;
    fs: number;
    Fb: number;
  }>;
  dvz: number;
  top: number;
}

export interface RcCrackedProps {
  x: number;
  I: number;
  top: number;
}

export interface RcSectionRes {
  x: number;
  tag: string;
  M1: number;
  M2: number;
  M3: number;
  M4: number;
  MW: number;
  MPL: number;
  V1: number;
  V2: number;
  V3: number;
  V4: number;
  VW: number;
  VPL: number;
  MLLv: number;
  MLLl: number;
  VLLv: number;
  VLLl: number;
  MLL: number;
  VLL: number;
  MDC: number;
  VDC: number;
  Mu: number;
  Vu: number;
  Ms: number;
  Vs: number;
  Mu1: number;
  Vu1: number;
  vehM: string;
  vehV: string;
  Mn: number;
  phi: number;
  Mr: number;
  Mr1: number;
  Mdnc: number;
  Mcr: number;
  Mmin: number;
  s: number;
  nv: number;
  Av: number;
  Avmin: number;
  hasMin: boolean;
  dv: number;
  es: number;
  sxe: number;
  beta: number;
  th: number;
  Vc: number;
  Vs2: number;
  Vlim: number;
  Vn: number;
  Vr: number;
  vu: number;
  smax: number;
  needSt: boolean;
  Treq: number;
  Tprov: number;
  dvi: number;
  Vui: number;
  Acv: number;
  Avf: number;
  Vni: number;
  Vri: number;
  Avfmin: number;
  fyi: number;
  Ms1: number;
  Ms2: number;
  fss: number;
  fbg: number;
  bs: number;
  smaxCr: number;
  needCr: boolean;
  Mfat: number;
  vfat: number;
  dfat: number;
  fmin: number;
  dFTH: number;
  gFat: number;
}

export type RcSummaryItem = [string, boolean, string];

export interface RcDistFactors {
  b: number;
  k: number;
  J: number;
  IJ: number;
  Ig: number;
  A: number;
  Ip: number;
  nL: number;
  M1: number;
  M2: number;
  V1: number;
  V2: number;
  Mi: number;
  Vi: number;
  levI: number;
  levE: number;
  outM: boolean;
  outV: boolean;
  de: number;
  xge: number;
  eM1: number;
  eM2: number;
  eV1: number;
  eV2: number;
  fb: number;
  M1e: number;
  M2e: number;
  V1e: number;
  V2e: number;
  deOutM: boolean;
  deOutV: boolean;
  Mf0: number;
  Vf0: number;
  M: number;
  V: number;
  th: number;
  cM: number;
  cV: number;
  M0: number;
  V0: number;
  Mf: number;
  range: {
    b: boolean;
    L: boolean;
    Nb: boolean;
    J: boolean;
    I: boolean;
  };
  [key: string]: number | boolean | object | undefined;
}

export interface RcCalcResult {
  type: 'RC';
  kind: 'giua' | 'bien';
  H: number;
  P: Point2D[];
  voids: Array<[number, number, number]>;
  hs: number;
  hsw: number;
  beff: number;
  ed: number;
  xdk: number;
  g1: RcGrossProps;
  gc: RcGrossProps;
  gG: RcGrossProps;
  Ec: number;
  Ecs: number;
  ncs: number;
  n: number;
  fy: number;
  fu: number;
  fyv: number;
  fr: number;
  g1f: number;
  g3: number;
  As: number;
  Asc: number;
  bars: Array<{ n: number; d: number; y: number; A: number; top: boolean }>;
  bot: { n: number; d: number; y: number; A?: number; top?: boolean };
  dc: number;
  sbar: number;
  yT: number;
  loads: Record<string, number>;
  DF: RcDistFactors;
  IM: number;
  IF: {
    c: number;
    mu: number;
    K1: number;
    K2: number;
    t: string;
  };
  face: number;
  xv: number;
  dv: number;
  T0: number;
  flC: RcFlexResult;
  flN: RcFlexResult;
  cr1: RcCrackedProps;
  cr2: RcCrackedProps;
  bvAt: number;
  bvi: number;
  res: RcSectionRes[];
  camber: {
    dcr: number;
    dDeck: number;
    dDL1: number;
    dDL2: number;
    lam: number;
    dLT: number;
    dtr: number;
    dlane: number;
    dLL1: number;
    dLL2: number;
    DFd: number;
    mL: number;
    lim: number;
    ie1: { Mcr: number; Ie: number; r: number };
    ie2: { Mcr: number; Ie: number; r: number };
    EI1: number;
    EIc: number;
  };
  EIc: number;
  Lm: number;
  Ls: number;
  L: number;
  a0: number;
  Rg: { DC: number; DW: number; LL: number };
  eSh: number;
  TG: {
    pos: { T1: number; T2: number; A: number; yc: number; e0: number; kap: number };
    neg: { T1: number; T2: number; A: number; yc: number; e0: number; kap: number };
    g: number;
    al: number;
  };
  shrRC: {
    VS: number;
    ks: number;
    khs: number;
    kf: number;
    fci: number;
    t0: number;
    td: number;
    tf: number;
    eSh: number;
  };
  eta: number;
  vol: number;
  jointTot: number;
  Aout: number;
  AoutG: number;
  hC: number;
  Mfat: number;
  items?: RcSummaryItem[];
  okAll?: boolean;
}

export interface DamCompositeResult {
  I: DamSpInput;
  LIM: DamLimits;
  type?: 'BR' | 'RC' | 'I' | 'PC';
  g?: DamCalcResult | RcCalcResult | Record<string, unknown>;
  b?: DamCalcResult | RcCalcResult | Record<string, unknown>;
  GG?: Record<string, unknown>;
  G0?: RcInput | Record<string, unknown>;
}

// ============================================================================
// DAM: Pre-tensioned hollow-core slab girder (TCVN 11823:2017)
// ============================================================================

const strand18: DamStrand[] = (() => {
  const L: DamStrand[] = [];
  const xa: number[] = [];
  for (let k = 0; k < 8; k++) xa.push(-420 + 50 * k);
  xa.push(0, 70);
  for (let k = 0; k < 7; k++) xa.push(120 + 50 * k);
  const deb: Record<number, number> = {
    4: 3000,
    6: 3000,
    12: 3000,
    14: 3000,
    8: 1000,
    10: 1000,
    19: 2000,
    26: 2000,
  };
  xa.forEach((x, i) => L.push([i + 1, 'A', x, 55, deb[i + 1] || 0]));
  [-420, -370, -320, -270, -220, 220, 270, 320, 370, 420].forEach((x, i) =>
    L.push([18 + i, 'B', x, 100, deb[18 + i] || 0]),
  );
  [-375, -125, 125, 375].forEach((x, i) => L.push([28 + i, 'C', x, 595, 0]));
  return L;
})();

const strand15: DamStrand[] = (() => {
  const L: DamStrand[] = [];
  const xa: number[] = [];
  for (let k = 0; k < 8; k++) xa.push(-420 + 50 * k);
  xa.push(0, 70);
  for (let k = 0; k < 7; k++) xa.push(120 + 50 * k);
  const deb: Record<number, number> = {
    4: 2500,
    6: 2500,
    12: 2500,
    14: 2500,
    8: 1000,
    10: 1000,
  };
  xa.forEach((x, i) => L.push([i + 1, 'A', x, 55, deb[i + 1] || 0]));
  [-420, -320, -220, 220, 320, 420].forEach((x, i) =>
    L.push([18 + i, 'B', x, 100, deb[18 + i] || 0]),
  );
  [-375, 0, 375].forEach((x, i) => L.push([24 + i, 'C', x, 495, 0]));
  return L;
})();

const strand21: DamStrand[] = (() => {
  const L: DamStrand[] = [];
  const xa: number[] = [];
  for (let k = 0; k < 8; k++) xa.push(-420 + 50 * k);
  xa.push(0, 70);
  for (let k = 0; k < 7; k++) xa.push(120 + 50 * k);
  const deb: Record<number, number> = {
    4: 1500,
    6: 1500,
    12: 1500,
    14: 1500,
    8: 3500,
    10: 3500,
    22: 2500,
    27: 2500,
  };
  xa.forEach((x, i) => L.push([i + 1, 'A', x, 60, deb[i + 1] || 0]));
  [-420, -370, -320, -270, -220, -170, -70, 70, 170, 220, 270, 320, 370, 420].forEach((x, i) =>
    L.push([18 + i, 'B', x, 105, deb[18 + i] || 0]),
  );
  [-384, -192, 0, 192, 384].forEach((x, i) => L.push([32 + i, 'C', x, 745, 0]));
  return L;
})();

const strand24: DamStrand[] = (() => {
  const L: DamStrand[] = [];
  const xa: number[] = [];
  for (let k = 0; k < 8; k++) xa.push(-420 + 50 * k);
  xa.push(0, 70);
  for (let k = 0; k < 7; k++) xa.push(120 + 50 * k);
  const deb: Record<number, number> = {
    4: 1000,
    6: 1000,
    12: 1000,
    14: 1000,
    8: 3000,
    10: 3000,
    22: 2000,
    24: 2000,
    28: 2000,
    30: 2000,
  };
  xa.forEach((x, i) => L.push([i + 1, 'A', x, 60, deb[i + 1] || 0]));
  xa.forEach((x, i) => L.push([18 + i, 'B', x, 105, deb[18 + i] || 0]));
  [-375, -225, -75, 75, 225, 375].forEach((x, i) => L.push([35 + i, 'C', x, 840, 0]));
  return L;
})();

const DAM_LIB: Record<DamLibKey, DamLibEntry> = {
  18: {
    name: 'Dầm bản rỗng L = 18 m',
    Lt: 18,
    a0: 0.3,
    H: 650,
    giua: {
      dd: [
        [-485, 0],
        [485, 0],
        [495, 10],
        [495, 100],
        [435, 160],
        [460, 650],
        [-460, 650],
        [-435, 160],
        [-495, 100],
        [-495, 10],
      ],
      cc: [
        [-485, 0],
        [485, 0],
        [495, 10],
        [495, 125],
        [435, 160],
        [460, 650],
        [-460, 650],
        [-435, 160],
        [-495, 125],
        [-495, 10],
      ],
    },
    bien: {
      dd: [
        [-490, 0],
        [485, 0],
        [495, 10],
        [495, 100],
        [435, 160],
        [460, 650],
        [-500, 650],
        [-500, 10],
      ],
      cc: [
        [-490, 0],
        [485, 0],
        [495, 10],
        [495, 125],
        [435, 160],
        [460, 650],
        [-500, 650],
        [-500, 10],
      ],
    },
    voids: [
      [-200, 325, 300],
      [200, 325, 300],
    ],
    Lend: 600,
    Lmid: 500,
    strands: strand18,
    stir: {
      name: 'S1',
      d: 16,
      legs: 4,
      zones: [
        [0, 600, 50],
        [600, 3600, 150],
        [3600, 8750, 300],
        [8750, 9000, 50],
      ],
    },
    conn: { name: 'C1', d: 16, legs: 4 },
    hook: 400,
    anN: 8,
    anD: 14,
    hm: 'Kết cấu phần trên - dầm bản L = 18 m',
  },
  15: {
    name: 'Dầm bản rỗng L = 15 m',
    Lt: 15,
    a0: 0.3,
    H: 550,
    giua: {
      dd: [
        [-485, 0],
        [485, 0],
        [495, 10],
        [495, 100],
        [435, 160],
        [460, 550],
        [-460, 550],
        [-435, 160],
        [-495, 100],
        [-495, 10],
      ],
      cc: [
        [-485, 0],
        [485, 0],
        [495, 10],
        [495, 125],
        [435, 160],
        [460, 550],
        [-460, 550],
        [-435, 160],
        [-495, 125],
        [-495, 10],
      ],
    },
    bien: {
      dd: [
        [-490, 0],
        [485, 0],
        [495, 10],
        [495, 100],
        [435, 160],
        [460, 550],
        [-500, 550],
        [-500, 10],
      ],
      cc: [
        [-490, 0],
        [485, 0],
        [495, 10],
        [495, 125],
        [435, 160],
        [460, 550],
        [-500, 550],
        [-500, 10],
      ],
    },
    voids: [
      [-200, 275, 250],
      [200, 275, 250],
    ],
    Lend: 600,
    Lmid: 500,
    strands: strand15,
    stir: {
      name: 'S10',
      d: 16,
      legs: 4,
      zones: [
        [0, 600, 50],
        [600, 3600, 150],
        [3600, 7200, 300],
        [7200, 7500, 50],
      ],
    },
    conn: { name: 'C8', d: 16, legs: 4 },
    hook: 400,
    anN: 7,
    anD: 14,
    fci: 36,
    hm: 'Kết cấu phần trên - dầm bản L = 15 m',
  },
  21: {
    name: 'Dầm bản rỗng L = 21 m',
    Lt: 21,
    a0: 0.3,
    H: 800,
    giua: {
      dd: [
        [-485, 0],
        [485, 0],
        [495, 10],
        [495, 200],
        [435, 260],
        [460, 800],
        [-460, 800],
        [-435, 260],
        [-495, 200],
        [-495, 10],
      ],
      cc: [
        [-485, 0],
        [485, 0],
        [495, 10],
        [495, 225],
        [435, 260],
        [460, 800],
        [-460, 800],
        [-435, 260],
        [-495, 225],
        [-495, 10],
      ],
    },
    bien: {
      dd: [
        [-490, 0],
        [485, 0],
        [495, 10],
        [495, 200],
        [435, 260],
        [460, 800],
        [-500, 800],
        [-500, 10],
      ],
      cc: [
        [-490, 0],
        [485, 0],
        [495, 10],
        [495, 225],
        [435, 260],
        [460, 800],
        [-500, 800],
        [-500, 10],
      ],
    },
    voids: [
      [-205, 400, 250, 450, 50],
      [205, 400, 250, 450, 50],
    ],
    Lend: 600,
    Lmid: 0,
    solids: [[6750, 7250]],
    strands: strand21,
    stir: {
      name: 'S1',
      d: 16,
      legs: 4,
      zones: [
        [0, 600, 50],
        [600, 3450, 150],
        [3450, 6750, 300],
        [6750, 7350, 50],
        [7350, 10500, 300],
      ],
    },
    conn: { name: 'C2', d: 16, legs: 4 },
    hook: 400,
    anN: 10,
    anD: 14,
    fci: 38,
    hm: 'Kết cấu phần trên - dầm bản L = 21 m',
  },
  24: {
    name: 'Dầm bản rỗng L = 24 m',
    Lt: 24,
    a0: 0.35,
    H: 950,
    giua: {
      dd: [
        [-485, 0],
        [485, 0],
        [495, 10],
        [495, 200],
        [435, 260],
        [460, 950],
        [-460, 950],
        [-435, 260],
        [-495, 200],
        [-495, 10],
      ],
      cc: [
        [-485, 0],
        [485, 0],
        [495, 10],
        [495, 225],
        [435, 260],
        [460, 950],
        [-460, 950],
        [-435, 260],
        [-495, 225],
        [-495, 10],
      ],
    },
    bien: {
      dd: [
        [-490, 0],
        [485, 0],
        [495, 10],
        [495, 200],
        [435, 260],
        [460, 950],
        [-500, 950],
        [-500, 10],
      ],
      cc: [
        [-490, 0],
        [485, 0],
        [495, 10],
        [495, 225],
        [435, 260],
        [460, 950],
        [-500, 950],
        [-500, 10],
      ],
    },
    voids: [
      [-205, 500, 250, 600, 50],
      [205, 500, 250, 600, 50],
    ],
    Lend: 600,
    Lmid: 0,
    solids: [[7750, 8250]],
    strands: strand24,
    stir: {
      name: 'T3',
      d: 16,
      legs: 4,
      zones: [
        [0, 1050, 50],
        [1050, 3900, 150],
        [3900, 7775, 300],
        [7775, 8225, 50],
        [8225, 12000, 300],
      ],
    },
    conn: { name: 'T7', d: 16, legs: 4 },
    hook: 400,
    anN: 8,
    anD: 14,
    fci: 38,
    hm: 'Kết cấu phần trên - dầm bản L = 24 m',
  },
};

function damPoly(P: readonly Point2D[]): { A: number; S: number; I: number } {
  let A = 0;
  let S = 0;
  let I = 0;
  const n = P.length;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = P[i];
    const [x2, y2] = P[(i + 1) % n];
    const c = x1 * y2 - x2 * y1;
    A += c;
    S += (y1 + y2) * c;
    I += (y1 * y1 + y1 * y2 + y2 * y2) * c;
  }
  A /= 2;
  S /= 6;
  I /= 12;
  if (A < 0) {
    A = -A;
    S = -S;
    I = -I;
  }
  return { A, S, I };
}

const isRectVoid = (v: DamVoid): v is readonly [number, number, number, number, number] =>
  v.length >= 5;

const damVHH = (v: DamVoid): number => (isRectVoid(v) ? v[3] / 2 : v[2] / 2);

function damVW(v: DamVoid, y: number): number {
  const d = Math.abs(y - v[1]);
  if (isRectVoid(v)) {
    const b = v[2];
    const h = v[3];
    const r = Math.min(v[4] || 0, b / 2, h / 2);
    if (d >= h / 2) return 0;
    const dy = d - (h / 2 - r);
    return dy <= 0 ? b : b - 2 * (r - sq(Math.max(0, r * r - dy * dy)));
  }
  const r = v[2] / 2;
  return d < r ? 2 * sq(r * r - d * d) : 0;
}

function damVProps(v: DamVoid): { A: number; S: number; I: number } {
  if (!isRectVoid(v)) {
    const r = v[2] / 2;
    const a = PI * r * r;
    return { A: a, S: a * v[1], I: (PI * r ** 4) / 4 + a * v[1] * v[1] };
  }
  let A = 0;
  let S = 0;
  let I = 0;
  const h = v[3];
  const n = 400;
  const dy = h / n;
  for (let i = 0; i < n; i++) {
    const y = v[1] - h / 2 + (i + 0.5) * dy;
    const w = damVW(v, y) * dy;
    A += w;
    S += w * y;
    I += w * y * y;
  }
  return { A, S, I };
}

function damSect(outer: readonly Point2D[], voids?: readonly DamVoid[]): DamSectionProps {
  const p = damPoly(outer);
  let A = p.A;
  let S = p.S;
  let I = p.I;
  (voids || []).forEach((v) => {
    const q = damVProps(v);
    A -= q.A;
    S -= q.S;
    I -= q.I;
  });
  const yb = S / A;
  return { A, yb, I: I - A * yb * yb };
}

function damPerim(P: readonly Point2D[]): number {
  let s = 0;
  for (let i = 0; i < P.length; i++) {
    const a = P[i];
    const b = P[(i + 1) % P.length];
    s += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return s;
}

function damWidthAt(P: readonly Point2D[], y: number): number {
  const xs: number[] = [];
  for (let i = 0; i < P.length; i++) {
    const [x1, y1] = P[i];
    const [x2, y2] = P[(i + 1) % P.length];
    if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
      xs.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
    }
  }
  xs.sort((a, b) => a - b);
  let w = 0;
  for (let i = 0; i + 1 < xs.length; i += 2) w += xs[i + 1] - xs[i];
  return w;
}

const damWcOf = (fc: number): number => (fc <= 35 ? 2320 : 2240 + 2.29 * fc);
const damEcOf = (fc: number, K1?: number): number =>
  0.0017 * (K1 || 1) * damWcOf(fc) ** 2 * fc ** 0.33;
const damB1Of = (f: number): number =>
  f <= 28 ? 0.85 : Math.max(0.65, 0.85 - (0.05 * (f - 28)) / 7);

function damCalc(
  I: DamSpInput,
  G: DamGirderInput,
  options?: GirderHollowStepOptions,
): DamCalcResult {
  const leverFn = resolveLeverRule(options);
  const H = G.H;
  const L = I.Lt * 1000;
  const brg = I.a0 * 1000;
  const Ls = L - 2 * brg;
  const Lm = Ls / 1000;
  const fc = I.fc;
  const fci = I.fci;
  const fcs = I.fcs;
  const Ec = damEcOf(fc, I.K1);
  const Eci = damEcOf(fci, I.K1);
  const Ecs = damEcOf(fcs, I.K1);
  const Ep = I.Ep;
  const fpu = I.fpu;
  const fpy = I.fpyr * fpu;
  const fpj = I.fpjr * fpu;
  const Ap1 = I.Ap1;
  const db = I.db;
  const fy = I.fy;
  const S_h = damSect(G.dd, G.voids);
  const S_s = damSect(G.dd, []);
  const S_e = damSect(G.cc, []);
  const Lend = G.Lend;
  const Lmid = G.Lmid || 0;
  const SOL = (G.solids || []).filter(
    (z) => z[1] > z[0] && z[0] >= Lend && z[1] <= L / 2 - Lmid / 2,
  );
  const Lsol = SOL.reduce((t, z) => t + z[1] - z[0], 0);
  const Lh = L - 2 * Lend - Lmid - 2 * Lsol;
  const Aavg = (2 * Lend * S_e.A + Lh * S_h.A + (Lmid + 2 * Lsol) * S_s.A) / L;

  const secAt = (xb: number): [DamSectionProps, string, Point2D[], boolean] => {
    let xg = xb + brg;
    xg = Math.min(xg, L - xg);
    if (xg < Lend - 1e-6) return [S_e, 'Đặc đầu dầm', G.cc, false];
    if (Lmid > 0 && xg > L / 2 - Lmid / 2 + 1e-6) return [S_s, 'Đặc giữa nhịp', G.dd, false];
    if (SOL.some((z) => xg > z[0] + 1e-6 && xg < z[1] - 1e-6)) {
      return [S_s, 'Đặc trung gian', G.dd, false];
    }
    return [S_h, 'Rỗng', G.dd, true];
  };

  const lt = 60 * db;
  const grp: Record<string, DamStrandGroup> = {};
  G.strands.forEach((s) => {
    const key = `${s[3]}|${s[4]}`;
    if (!grp[key]) grp[key] = { y: s[3], l0: s[4], n: 0, ids: [] };
    grp[key].n++;
    grp[key].ids.push(s[0]);
  });
  const groups = Object.values(grp).sort((a, b) => a.y - b.y || a.l0 - b.l0);
  const nstr = G.strands.length;
  const bonded = (xb: number): Array<DamStrandGroup & { f: number; lx: number }> => {
    let xg = xb + brg;
    xg = Math.min(xg, L - xg);
    return groups.map((gp) => ({
      ...gp,
      f: xg <= gp.l0 ? 0 : Math.min(1, (xg - gp.l0) / lt),
      lx: xg - gp.l0,
    }));
  };

  const hs = (I.hs - I.hwear) * 1000;
  const hsw = I.hs * 1000;
  const bd = I.S * 1000;
  const ncs = Ecs / Ec;
  const comp = (S: DamSectionProps): DamSectionProps => {
    const a = bd * hs * ncs;
    const yc = H + hs / 2;
    const i0 = ((bd * hs ** 3) / 12) * ncs;
    const A = S.A + a;
    const yb = (S.A * S.yb + a * yc) / A;
    return { A, yb, I: S.I + S.A * (S.yb - yb) ** 2 + i0 + a * (yc - yb) ** 2 };
  };

  // ---- loads (kN/m) ----
  const g = I.gc;
  const Ng = I.Ng;
  const Ajoint = (I.S * 1000 * H - damPoly(G.ddRef || G.dd).A) * (G.kind === 'bien' ? 0.5 : 1);
  const curb = I.Apa * g;
  const rail = I.Pra / I.Lt / 2;
  const DC1 = Aavg * 1e-6 * g;
  const DC2 =
    (bd / 1000) * (hsw / 1000 + ((G.kind === 'bien' ? I.hsxB : I.hsxG) || 0)) * g;
  const DC3 = Ajoint * 1e-6 * g;
  const WPL = I.WPL || 0;
  const side = ((I.APL || 0) / 2) * g;
  const lever = I.curbMode === 'L' && G.kind === 'bien';
  const DC4 = lever ? curb + rail + side : (2 * (curb + rail + side)) / Ng;
  const DWsu = (I.Hsu * I.gsu * (I.Wb - 2 * I.Wpa - 2 * WPL)) / Ng;
  const DWu = I.DWu;
  const DW = DWsu + DWu;
  const qPLs = WPL > 0.6 ? (I.qPL || 3) * WPL : 0;
  const wPL = lever ? qPLs : (2 * qPLs) / Ng;
  const loads = {
    DC1,
    DC2,
    DC3,
    DC4,
    DWsu,
    DWu,
    DW,
    curb,
    rail,
    side,
    wPL,
    qPLs,
    Ajoint: Ajoint * 1e-6,
    Aavg: Aavg * 1e-6,
  };

  // ---- live-load distribution factors (TCVN 11823-4) ----
  const b = Math.max(...G.dd.map((p) => p[0])) - Math.min(...G.dd.map((p) => p[0]));
  const Ig = comp(S_h).I;
  const yv = G.voids[0][1];
  const vr = G.voids[0][2] / 2;
  const tb_ = Math.min(...G.voids.map((v) => v[1] - damVHH(v)));
  const tt_ = Math.min(...G.voids.map((v) => H - v[1] - damVHH(v)));
  const tv = Math.min(tb_, tt_);
  const ttc = tt_ + hs * ncs;
  const vx = G.voids.map((v) => v[0]).sort((a, c) => a - c);
  const bwOut = damWidthAt(G.dd, yv);
  const xsL = (() => {
    const xs: number[] = [];
    const P = G.dd;
    for (let i = 0; i < P.length; i++) {
      const [x1, y1] = P[i];
      const [x2, y2] = P[(i + 1) % P.length];
      if ((y1 <= yv && y2 > yv) || (y2 <= yv && y1 > yv)) {
        xs.push(x1 + ((yv - y1) * (x2 - x1)) / (y2 - y1));
      }
    }
    return xs.sort((a, c) => a - c);
  })();
  const tw = (vx[0] - vr - xsL[0] + (xsL[xsL.length - 1] - (vx[vx.length - 1] + vr))) / 2;
  const d0 = H + hs - (tt_ + hs) / 2 - tb_ / 2;
  const b0 = bwOut - tw;
  const J = (4 * (b0 * d0) ** 2) / (b0 / ttc + b0 / tb_ + (2 * d0) / tw);
  const k = Math.max(1.5, 2.5 * Ng ** -0.2);
  const IJ = Ig / J;
  const M1 = k * (b / (2.8 * Ls)) ** 0.5 * IJ ** 0.25;
  const M2 = k * (b / 7600) ** 0.6 * (b / Ls) ** 0.2 * IJ ** 0.06;
  const V1 = 0.7 * (b / Ls) ** 0.15 * IJ ** 0.05;
  const V2 = (b / 4000) ** 0.4 * (b / Ls) ** 0.1 * IJ ** 0.05 * Math.max(1, b / 1200);
  const mL2 = I.nL >= 2;
  const range: DamDistFactors['range'] = {
    b: b >= 900 && b <= 1500,
    L: Ls >= 6000 && Ls <= 37000,
    Nb: Ng >= 5 && Ng <= 20,
    J: J >= 1e10 && J <= 2.5e11,
    I: Ig >= 1.7e10 && Ig <= 2.5e11,
  };
  const DF: DamDistFactors = {
    b,
    k,
    J,
    IJ,
    Ig,
    tv,
    tt: tt_,
    tb: tb_,
    ttc,
    tw,
    b0,
    d0,
    M1,
    M2,
    V1,
    V2,
    Mi: mL2 ? Math.max(M1, M2) : M1,
    Vi: mL2 ? Math.max(V1, V2) : V1,
    nL: I.nL,
    M: 0,
    V: 0,
    lev: 0,
    deOutM: false,
    deOutV: false,
    levB: false,
    th: 0,
    cM: 1,
    cV: 1,
    M0: 0,
    V0: 0,
    range,
  };

  if (G.kind === 'bien' && G.DFg) {
    const q = G.DFg;
    for (const kk of [
      'M1',
      'M2',
      'V1',
      'V2',
      'Mi',
      'Vi',
      'k',
      'J',
      'IJ',
      'Ig',
      'tv',
      'tt',
      'tb',
      'ttc',
      'tw',
      'b0',
      'd0',
    ]) {
      DF[kk] = q[kk];
    }
    DF.fromG = true;
  }

  if (G.kind === 'bien') {
    const de = G.de;
    DF.de = de;
    DF.eM1 = Math.max(1, 1.125 + de / 9100);
    DF.eM2 = Math.max(1, 1.04 + de / 7600);
    DF.eV1 = Math.max(1, 1.25 + de / 6100);
    const arg = (de + b - 610) / 12200;
    DF.eV2 = 1 + (arg > 0 ? sq(arg) : 0);
    DF.fb = Math.min(1, 1200 / b);
    DF.M1e = DF.M1 * DF.eM1;
    DF.M2e = DF.M2 * DF.eM2;
    DF.V1e = DF.V1 * DF.eV1;
    DF.V2e = DF.V2 * DF.eV2 * DF.fb;
    DF.M = I.nL >= 2 ? Math.max(DF.M1e, DF.M2e) : DF.M1e;
    DF.V = I.nL >= 2 ? Math.max(DF.V1e, DF.V2e) : DF.V1e;
  } else {
    DF.M = DF.Mi;
    DF.V = DF.Vi;
  }

  {
    const ext = G.kind === 'bien';
    const xsG = Array.from({ length: Ng }, (_, i) => (i - (Ng - 1) / 2) * I.S);
    const xa = -(I.Wb / 2 - I.Wpa - (I.WPL || 0));
    const xb = -xa;
    const lev = ext
      ? leverFn(xsG, 0, xa, xb, I.nL, true).g
      : Math.max(
          0,
          ...xsG.map((_, j) => (j > 0 && j < Ng - 1 ? leverFn(xsG, j, xa, xb, I.nL, true).g : 0)),
        );
    DF.lev = lev;
    DF.deOutM = ext && G.de > 600;
    DF.deOutV = ext && (G.de < 300 || G.de > 600);
    DF.levB = !range.b;
    if (DF.levB) {
      DF.M = Math.max(DF.M, lev);
      DF.V = Math.max(DF.V, lev);
    }
    if (DF.deOutM) DF.M = Math.max(DF.M, lev);
    if (DF.deOutV) DF.V = Math.max(DF.V, lev);
  }

  {
    const th = Math.min(60, Math.max(0, I.skew || 0));
    const t = Math.tan((th * PI) / 180);
    DF.th = I.skew || 0;
    DF.cM = Math.min(1, 1.05 - 0.25 * t);
    DF.cV = 1 + (Ls * sq(t)) / (90 * H);
    DF.M0 = DF.M;
    DF.V0 = DF.V;
    DF.M = DF.M0 * DF.cM;
    DF.V = DF.V0 * DF.cV;
    range.th = (I.skew || 0) <= 60;
  }
  DF.range = range;
  const IM = I.IM;

  // ---- HL-93 live load ----
  const truck: Array<[number, number]> = [
    [0, 35],
    [4.3, 145],
    [8.6, 145],
  ];
  const truckR: Array<[number, number]> = [
    [0, 145],
    [4.3, 145],
    [8.6, 35],
  ];
  const tandem: Array<[number, number]> = [
    [0, 110],
    [1.2, 110],
  ];
  const Mi = (x: number, a: number): number =>
    a < 0 || a > Lm ? 0 : a <= x ? (a * (Lm - x)) / Lm : (x * (Lm - a)) / Lm;
  const Vi = (x: number, a: number): number =>
    a < 0 || a > Lm ? 0 : a < x ? -a / Lm : (Lm - a) / Lm;

  const vehM = (x: number): { v: number; veh: string } => {
    let best = { v: 0, veh: '-' };
    const candidates: Array<[string, Array<[number, number]>]> = [
      ['Xe tải', truck],
      ['Xe tải', truckR],
      ['Xe 2 trục', tandem],
    ];
    for (const [nm, veh] of candidates) {
      veh.forEach(([p0]) => {
        const pos = x - p0;
        const m = veh.reduce((t, [p, w]) => t + w * Mi(x, pos + p), 0);
        if (m > best.v) best = { v: m, veh: nm };
      });
    }
    return best;
  };

  const vehV = (x: number): { v: number; veh: string } => {
    let best = { v: 0, veh: '-' };
    const candidates: Array<[string, Array<[number, number]>]> = [
      ['Xe tải', truck],
      ['Xe tải', truckR],
      ['Xe 2 trục', tandem],
    ];
    for (const [nm, veh] of candidates) {
      veh.forEach(([p0]) => {
        const pos = x - p0 + 1e-9;
        const vVal = veh.reduce((t, [p, w]) => t + w * Vi(x, pos + p), 0);
        if (vVal > best.v) best = { v: vVal, veh: nm };
      });
    }
    return best;
  };

  const laneM = (x: number): number => (9.3 * x * (Lm - x)) / 2;
  const laneV = (x: number): number => (9.3 * (Lm - x) ** 2) / (2 * Lm);
  const Mw = (w: number, x: number): number => (w * x * (Lm - x)) / 2;
  const Vw = (w: number, x: number): number => w * (Lm / 2 - x);

  // ---- shrinkage & creep (TCVN 11823-5, §4.2.3) ----
  const RH = I.RH;
  const ti = I.ti;
  const td = I.td;
  const tf = I.tf;
  const khs = 2.0 - 0.014 * RH;
  const khc = 1.56 - 0.008 * RH;
  const kfOf = (f: number): number => 35 / (7 + f);
  const ktd = (t: number, f: number): number =>
    t / ((12 * (100 - 0.58 * f)) / (0.145 * f + 20) + t);
  const Vol = Aavg * L;
  const Surf = damPerim(G.dd) * L + 2 * S_e.A;
  const VS = Vol / Surf;
  const ks = Math.max(1, 1.45 - 0.0051 * VS);
  const psi = (t: number, tl: number, f: number, kk: number): number =>
    1.9 * kk * khc * kfOf(f) * ktd(t, f) * tl ** -0.118;
  const esh = (t: number, f: number, kk: number): number =>
    kk * khs * kfOf(f) * ktd(t, f) * 0.48e-3;
  const psi_fi = psi(tf - ti, ti, fci, ks);
  const psi_di = psi(td - ti, ti, fci, ks);
  const psi_fd = psi(tf - td, td, fci, ks);
  const tcur = Number.isFinite(I.tcur) && I.tcur > 0 ? I.tcur : ti;
  const kc5 = tcur < 5 ? 1.2 : 1;
  const eps_bid = kc5 * esh(td - ti, fci, ks);
  const eps_bif = kc5 * esh(tf - ti, fci, ks);
  const eps_bdf = eps_bif - eps_bid;
  const VSd = hsw;
  const ksd = Math.max(1, 1.45 - 0.0051 * VSd);
  const fcsi = 0.8 * fcs;
  const eps_ddf = esh(tf - td, fcsi, ksd);
  const psi_d = psi(tf - td, 1, fcsi, ksd);
  const KL = 30;
  const shr = {
    tcur,
    kc5,
    khs,
    khc,
    kf: kfOf(fci),
    kfd: kfOf(fcs),
    VS,
    ks,
    VSd,
    ksd,
    ktd_di: ktd(td - ti, fci),
    ktd_fi: ktd(tf - ti, fci),
    ktd_fd: ktd(tf - td, fci),
    ktd_d: ktd(tf - td, fcs),
    psi_fi,
    psi_di,
    psi_fd,
    psi_d,
    eps_bid,
    eps_bif,
    eps_bdf,
    eps_ddf,
  };

  // ---- stirrups & interface ----
  const sOf = (xb: number): number => {
    let xg = xb + brg;
    xg = Math.min(xg, L - xg);
    const z =
      G.stir.zones.find((zn) => xg >= zn[0] - 1e-6 && xg <= zn[1] + 1e-6) ||
      G.stir.zones[G.stir.zones.length - 1];
    return z[2];
  };
  const Av = (G.stir.legs * PI * G.stir.d ** 2) / 4;
  const Avf1 = (G.conn.legs * PI * G.conn.d ** 2) / 4;
  const bvi = damWidthAt(G.dd, H - 0.01);
  const IF_MAP = {
    N: {
      c: 0.52,
      mu: 0.6,
      K1: 0.2,
      K2: 5.5,
      t: 'Bê tông đổ trên bê tông đã đông cứng, sạch, không tạo nhám',
    },
    R: {
      c: 1.9,
      mu: 1.0,
      K1: 0.3,
      K2: 12.4,
      t: 'Bê tông đổ trên bê tông đã đông cứng, tạo nhám biên độ 6 mm',
    },
  } as const;
  const IF = IF_MAP[(I.ifc as 'N' | 'R') || 'N'] || IF_MAP.N;

  // ---- temporary tension limit (Table 7) ----
  const fsT = Math.min(0.5 * fy, 210);
  const AsTop = ((G.nTop || 0) * PI * (G.dTop || 0) ** 2) / 4;
  const tensCheck = (
    ft: number,
    fb: number,
    P: readonly Point2D[],
    hollow: boolean,
    xb: number | null,
  ): DamTensCheckResult => {
    const lim1 = Math.min(0.25 * sq(fci), 1.38);
    const lim2 = 0.63 * sq(fci);
    if (ft >= -1e-9 && fb >= -1e-9) {
      return { T: 0, Areq: 0, Aprov: 0, lim: lim1, reinf: false };
    }
    let T = 0;
    const dy = 2;
    const top = ft < 0;
    let Aprov = AsTop * (top ? 1 : 0);
    for (let y = dy / 2; y < H; y += dy) {
      const f = fb + ((ft - fb) * y) / H;
      if (f >= 0) continue;
      let bw = damWidthAt(P, y);
      if (hollow) {
        G.voids.forEach((v) => {
          bw -= damVW(v, y);
        });
      }
      T += -f * bw * dy;
    }
    const yz = Math.abs(ft - fb) > 1e-9 ? (H * fb) / (fb - ft) : 0;
    G.strands.forEach((st) => {
      const inT = top ? st[3] > yz : st[3] < yz;
      const dE = xb == null ? Infinity : Math.min(xb + brg, L - xb - brg);
      if (inT && dE >= (st[4] || 0)) Aprov += Ap1;
    });
    const Areq = T / fsT;
    const reinf = Aprov >= Areq;
    return { T: T / 1e3, Areq, Aprov, lim: reinf ? lim2 : lim1, reinf };
  };

  // ---- section checks ----
  const hc = H + hs;
  const bsup = I.bg * 1000;
  const xs = new Set<number>([0, Lend - brg]);
  SOL.forEach((z) => {
    xs.add(z[0] - brg - 1);
    xs.add((z[0] + z[1]) / 2 - brg);
    xs.add(z[1] - brg + 1);
  });
  groups.forEach((gp) => {
    if (gp.l0 > 0) xs.add(gp.l0 + lt - brg);
  });
  G.stir.zones.forEach((z) => {
    if (z[1] < L / 2 - 1) {
      xs.add(z[1] - brg);
      xs.add(z[1] - brg + 1);
    }
  });
  [Ls / 8, Ls / 4, (3 * Ls) / 8, Ls / 2].forEach((x) => xs.add(x));

  const res: DamSectionRes[] = [];
  let XV = 0;
  let ES_V: number | null = null;

  const one = (xb: number, tag = ''): DamSectionRes => {
    const x = xb / 1000;
    const [S, stype, P, hollow] = secAt(xb);
    const Sc = comp(S);
    const bl = bonded(xb);
    const nb = bl.reduce((t, gp) => t + gp.n * gp.f, 0);
    const Aps = nb * Ap1;
    const ycg = nb > 0 ? bl.reduce((t, gp) => t + gp.n * gp.f * gp.y, 0) / nb : 0;
    const e = S.yb - ycg;
    const ec = Sc.yb - ycg;
    const Ag = S.A;
    const Igs = S.I;
    const yb = S.yb;
    const yt = H - yb;
    const M1 = Mw(DC1, x) * 1e6;
    const M2 = Mw(DC2 + DC3, x) * 1e6;
    const M3 = Mw(DC4, x) * 1e6;
    const MW = Mw(DW, x) * 1e6;
    const vm = vehM(x);
    const MLLv = vm.v;
    const MLLl = laneM(x);
    const MPL = Mw(wPL, x);
    const MLL = (DF.M * ((1 + IM) * MLLv + MLLl) + MPL) * 1e6;

    // elastic shortening loop
    let fpt = fpj;
    let fcgp = 0;
    for (let it = 0; it < 40 && Aps > 0; it++) {
      const P0 = fpt * Aps;
      fcgp = P0 / Ag + (P0 * e * e) / Igs - (M1 * e) / Igs;
      const fn = fpj - (Ep / Eci) * fcgp;
      if (Math.abs(fn - fpt) < 1e-7) {
        fpt = fn;
        break;
      }
      fpt = fn;
    }
    const dES = fpj - fpt;
    fpt = Math.max(fpt, 0.55 * fpy);
    const dR1 = (fpt / KL) * (fpt / fpy - 0.55);
    const Kid =
      Aps > 0
        ? 1 / (1 + (Ep / Eci) * (Aps / Ag) * (1 + (Ag * e * e) / Igs) * (1 + 0.7 * psi_fi))
        : 1;
    const dSR = eps_bid * Ep * Kid;
    const dCR = (Ep / Eci) * fcgp * psi_di * Kid;
    const Kdf =
      Aps > 0
        ? 1 / (1 + (Ep / Eci) * (Aps / Sc.A) * (1 + (Sc.A * ec * ec) / Sc.I) * (1 + 0.7 * psi_fi))
        : 1;
    const dSD = eps_bdf * Ep * Kdf;
    const dfcd =
      -((dSR + dCR + dR1) * Aps * (1 / Ag + (e * e) / Igs)) -
      (M2 * e) / Igs -
      ((M3 + MW) * ec) / Sc.I;
    const dCD = (Ep / Eci) * fcgp * (psi_fi - psi_di) * Kdf + (Ep / Ec) * dfcd * psi_fd * Kdf;
    const dR2 = dR1;
    const Ad = bd * hs;
    const ed = H + hs / 2 - Sc.yb;
    const dfcdf = ((eps_ddf * Ad * Ecs) / (1 + 0.7 * psi_d)) * (1 / Sc.A - (ec * ed) / Sc.I);
    const dSS = (-Ep / Ec) * dfcdf * Kdf * (1 + 0.7 * psi_fd);
    const dLTid = dSR + dCR + dR1;
    const dLTdf = dSD + dCD + dR2 - dSS;
    const dLT = dLTid + dLTdf;
    const fpe = fpj - dES - dLT;
    const Pt = fpt * Aps;
    const Pe = fpe * Aps;

    // stresses (compression +), MPa
    const ycb = Sc.yb;
    const yct = H - ycb;
    const ysl = H + hs - ycb;
    const ft_tr = Pt / Ag - (Pt * e * yt) / Igs + (M1 * yt) / Igs;
    const fb_tr = Pt / Ag + (Pt * e * yb) / Igs - (M1 * yb) / Igs;
    const trT = tensCheck(ft_tr, fb_tr, P, hollow, xb);
    const bt = Pe / Ag - (Pe * e * yt) / Igs + ((M1 + M2) * yt) / Igs;
    const bb = Pe / Ag + (Pe * e * yb) / Igs - ((M1 + M2) * yb) / Igs;
    const ftP = bt + ((M3 + MW) * yct) / Sc.I;
    const ftI = ftP + (MLL * yct) / Sc.I;
    const fbIII = bb - ((M3 + MW + I.gLL3 * MLL) * ycb) / Sc.I;
    const fbP = bb - ((M3 + MW) * ycb) / Sc.I;
    const fdP = (((M3 + MW) * ysl) / Sc.I) * ncs;
    const fdI = (((M3 + MW + MLL) * ysl) / Sc.I) * ncs;

    // fatigue (§5.5.3.1)
    const vf = (() => {
      let best = 0;
      const ft: Array<[number, number]> = [
        [0, 35],
        [4.3, 145],
        [13.3, 145],
      ];
      for (const veh of [ft, ft.map(([p, w]): [number, number] => [-p, w])]) {
        veh.forEach(([p0]) => {
          const m = veh.reduce((t, [p, w]) => t + w * Mi(x, x - p0 + p), 0);
          best = Math.max(best, m);
        });
      }
      return best;
    })();
    const Mfat =
      ((I.gFat * (G.kind === 'bien' ? DF.M1e ?? DF.M1 : DF.M1)) / 1.2) * (1 + I.IMf) * vf * 1e6;
    const ftFat = 0.5 * ftP + (Mfat * yct) / Sc.I;

    // ultimate forces
    const MuDC = 1.25 * (M1 + M2 + M3) + 1.5 * MW;
    const Mu = MuDC + 1.75 * MLL;
    const vv = vehV(x);
    const VPL = (wPL * (Ls / 1000 - x) ** 2) / ((2 * Ls) / 1000);
    const VLL = DF.V * ((1 + IM) * vv.v + laneV(x)) + VPL;
    const Vu = 1.25 * Vw(DC1 + DC2 + DC3 + DC4, x) + 1.5 * Vw(DW, x) + 1.75 * VLL;

    // flexure
    const fpsOf = (c: number) => {
      let T = 0;
      let Tm = 0;
      const list: DamStrandFlexDetail[] = [];
      bl.forEach((gp) => {
        if (!gp.f) {
          list.push({ ...gp, fs: 0, dp: hc - gp.y, ld: 0 });
          return;
        }
        const dp = hc - gp.y;
        const fps = dp > c ? fpu * (1 - (I.kps * c) / dp) : 0;
        const kap = gp.l0 > 0 ? 2.0 : H > 600 ? 1.6 : 1.0;
        const ld = kap * (0.15 * fps - 0.097 * fpe) * db;
        let fs: number;
        if (gp.lx < lt) fs = (fpe * gp.lx) / lt;
        else if (gp.lx < ld) fs = fpe + ((gp.lx - lt) / (ld - lt)) * (fps - fpe);
        else fs = fps;
        fs = Math.max(0, Math.min(fs, fps));
        T += gp.n * Ap1 * fs;
        Tm += gp.n * Ap1 * fs * dp;
        list.push({ ...gp, fs, dp, ld, fps });
      });
      return { T, Tm, list };
    };
    const Cf = (c: number) => {
      const a = damB1Of(fcs) * c;
      if (a <= hs) {
        return { C: I.a1 * fcs * bd * a, Cm: (I.a1 * fcs * bd * a * a) / 2, a, web: false };
      }
      const Cd = I.a1 * fcs * bd * hs;
      const a2 = a - hs;
      const bt =
        damWidthAt(P, H - a2 / 2) -
        (hollow ? G.voids.reduce((t, v) => t + damVW(v, H - a2 / 2), 0) : 0);
      const Cg = I.a1 * fc * bt * a2;
      return { C: Cd + Cg, Cm: (Cd * hs) / 2 + Cg * (hs + a2 / 2), a, web: true, bt };
    };

    let lo = 1;
    let hi = hc;
    for (let it = 0; it < 80; it++) {
      const mid = (lo + hi) / 2;
      if (Cf(mid).C > fpsOf(mid).T) hi = mid;
      else lo = mid;
    }
    const c = (lo + hi) / 2;
    const FT = fpsOf(c);
    const CC = Cf(c);
    const Mn = (FT.Tm - CC.Cm) / 1e6;
    const dt = hc - Math.min(...G.strands.map((st) => st[3]));
    const et = (0.003 * (dt - c)) / c;
    const phi = Math.min(1, Math.max(0.75, 0.75 + (0.25 * (et - 0.002)) / 0.003));
    const Mr = phi * Mn;
    const fr = 0.63 * sq(fc);
    const Scm = Sc.I / ycb;
    const Snc = Igs / yb;
    const fcpe = Pe / Ag + (Pe * e * yb) / Igs;
    const Mdnc = M1 + M2;
    const Mcr = (I.g3 * ((I.g1 * fr + I.g2 * fcpe) * Scm - Mdnc * (Scm / Snc - 1))) / 1e6;
    const Mmin = Math.min(Mcr, (1.33 * Mu) / 1e6);

    // MCFT shear (§8.3.4.2)
    const nbt = bl.reduce((t, gp) => t + (gp.y < hc / 2 ? gp.n * gp.f : 0), 0);
    const de =
      nbt > 0
        ? bl.reduce((t, gp) => t + (gp.y < hc / 2 ? gp.n * gp.f * (hc - gp.y) : 0), 0) / nbt
        : hc - 100;
    const a = CC.a;
    const dv = Math.max(de - a / 2, 0.9 * de, 0.72 * hc);
    const yvv = G.voids[0][1];
    const bv = damWidthAt(P, yvv) - (hollow ? G.voids.reduce((t, v) => t + v[2], 0) : 0);
    const Muv = Math.max(Math.abs(Mu), Vu * 1e3 * dv);
    let Apsf = 0;
    let Apsfpo = 0;
    FT.list.forEach((gp) => {
      if (gp.y < hc / 2 && gp.f > 0) {
        const rd = gp.ld > 0 ? Math.min(1, Math.max(0, gp.lx) / gp.ld) : 1;
        Apsf += gp.n * rd * Ap1;
        Apsfpo += gp.n * rd * Ap1 * 0.7 * fpu * gp.f;
      }
    });
    let es = Apsf > 0 ? (Muv / dv + Vu * 1e3 - Apsfpo) / (Ep * Apsf) : 0.006;
    let esNeg = false;
    if (es < 0) {
      esNeg = true;
      const Act = (damWidthAt(P, 100) * hc) / 2;
      es = (Muv / dv + Vu * 1e3 - Apsfpo) / (Ep * Apsf + Ec * Act);
      es = Math.max(es, -0.4e-3);
    }
    es = Math.min(es, 0.006);
    const esOwn = es;
    if (ES_V != null && xb < XV - 1e-6) es = ES_V;
    const s = sOf(xb);
    const hasMin = Av >= (0.083 * sq(fc) * bv * s) / fy - 1e-9;
    const sxe = Math.max(300, Math.min(2000, (dv * 35) / ((I.ag || 19) + 16)));
    const beta = (4.8 / (1 + 750 * es)) * (hasMin ? 1 : 1300 / (1000 + sxe));
    const th = 29 + 3500 * es;
    const Vc = 0.083 * beta * sq(fc) * bv * dv;
    const Vs = (Av * fy * dv) / Math.tan((th * PI) / 180) / s;
    const Vlim = 0.25 * fc * bv * dv;
    const Vn = Math.min(Vc + Vs, Vlim);
    const Vr = 0.9 * Vn;
    const Avmin = (0.083 * sq(fc) * bv * s) / fy;
    const vu = (Vu * 1e3) / (0.9 * bv * dv);
    const smax = vu < 0.125 * fc ? Math.min(0.8 * dv, 600) : Math.min(0.4 * dv, 300);
    const needAv = Vu * 1e3 > 0.5 * 0.9 * Vc;

    // longitudinal reinforcement tension (§8.3.5)
    const Treq =
      Math.abs(Mu) / (dv * phi) +
      ((Vu * 1e3) / 0.9 - 0.5 * Math.min(Vs, (Vu * 1e3) / 0.9)) / Math.tan((th * PI) / 180);
    const Tprov = FT.T;

    // interface shear (§8.4)
    const fyi = Math.min(fy, 420);
    const dvi = de - hs / 2;
    const Vui = (Vu * 1e3) / dvi;
    const Acv = bvi;
    const Avf = Avf1 / s;
    const Vni = Math.min(IF.c * Acv + IF.mu * Avf * fyi, IF.K1 * fcs * Acv, IF.K2 * Acv);
    const Vri = 0.9 * Vni;
    const Avfmin = (0.35 * Acv) / fyi;

    return {
      x,
      tag,
      stype,
      hollow,
      nb,
      Aps,
      ycg,
      e,
      ec,
      Ag,
      Ig: Igs,
      yb,
      yt,
      Ac: Sc.A,
      Ic: Sc.I,
      ycb,
      yct,
      ysl,
      M1: M1 / 1e6,
      M2: M2 / 1e6,
      M3: M3 / 1e6,
      MW: MW / 1e6,
      MLLv,
      MLLl,
      MPL,
      VPL,
      MLL: MLL / 1e6,
      vehM: vm.veh,
      Mu: Mu / 1e6,
      VLLv: vv.v,
      VLLl: laneV(x),
      VLL,
      Vu,
      VDC1: Vw(DC1, x),
      VDC2: Vw(DC2 + DC3, x),
      VDC3: Vw(DC4, x),
      VDW: Vw(DW, x),
      fcgp,
      dES,
      dR1,
      Kid,
      dSR,
      dCR,
      Kdf,
      dSD,
      dfcd,
      dCD,
      dR2,
      dfcdf,
      dSS,
      dLTid,
      dLTdf,
      dLT,
      dT: dES + dLT,
      fpt,
      fpe,
      Pt: Pt / 1e3,
      Pe: Pe / 1e3,
      ft_tr,
      fb_tr,
      trT,
      P,
      ftP,
      ftI,
      fbIII,
      fbP,
      fdP,
      fdI,
      ftFat,
      Mfat: Mfat / 1e6,
      c,
      a,
      web: CC.web,
      phi,
      et,
      Mn,
      Mr,
      fps: FT.list,
      T: FT.T / 1e3,
      fcpe,
      Mcr,
      Mmin,
      Scm,
      Snc,
      Mdnc: Mdnc / 1e6,
      de,
      dv,
      bv,
      es: es * 1e3,
      esNeg,
      beta,
      th,
      s,
      Vc: Vc / 1e3,
      Vs: Vs / 1e3,
      Vlim: Vlim / 1e3,
      Vn: Vn / 1e3,
      Vr: Vr / 1e3,
      Avmin,
      Av,
      vu,
      smax,
      needAv,
      Treq: Treq / 1e3,
      Tprov: Tprov / 1e3,
      dvi,
      esOwn: esOwn * 1e3,
      Vui,
      Vni,
      Vri,
      Avf: Avf1,
      Avfmin,
      Acv,
      hasMin,
      sxe,
    };
  };

  // critical shear section iteration
  let xv = bsup / 2 + 620;
  for (let it = 0; it < 5; it++) {
    const r = one(xv);
    xv = bsup / 2 + r.dv;
  }
  XV = xv;
  ES_V = one(xv).es / 1e3;
  xs.add(xv);
  xs.add(bsup / 2);
  [...xs]
    .filter((x) => x >= 0 && x <= Ls / 2 + 1e-6)
    .sort((a, c) => a - c)
    .forEach((x) =>
      res.push(one(x, Math.abs(x - xv) < 1e-6 ? 'v' : Math.abs(x - bsup / 2) < 1e-6 ? 'g' : '')),
    );

  // ---- camber & deflection ----
  const nseg = 360;
  const xsg = [...Array(nseg + 1).keys()].map((i) => (i * L) / nseg);
  let dps = 0;
  let dsw = 0;
  for (let i = 0; i < nseg; i++) {
    const xm = (xsg[i] + xsg[i + 1]) / 2;
    const r = one(xm - brg);
    const m = xm <= L / 2 ? xm / 2 : (L - xm) / 2;
    const dx = L / nseg;
    dps += ((r.Pt * 1e3 * r.e) / (Eci * r.Ig)) * m * dx;
    dsw += ((DC1 * xm * (L - xm)) / 2 / (Eci * r.Ig)) * m * dx;
  }
  const rm = res[res.length - 1];
  const rmH = res.filter((r) => r.hollow).pop() || rm;
  const EIc = Ec * rmH.Ic * 1e-9;
  const EIg = Ec * rmH.Ig * 1e-9;
  const dmid = (P: number, a: number): number => {
    const aa = Math.min(a, Lm - a);
    return aa <= 0 ? 0 : (P * aa * (3 * Lm * Lm - 4 * aa * aa)) / (48 * EIc);
  };
  let dtr = 0;
  for (let p0 = -9; p0 <= Lm + 9; p0 += 0.05) {
    const d = truck.reduce(
      (t, [off, P]) => t + (p0 + off >= 0 && p0 + off <= Lm ? dmid(P, p0 + off) : 0),
      0,
    );
    dtr = Math.max(dtr, d);
  }
  const nL = I.nL;
  const mL = nL === 1 ? 1.2 : nL === 2 ? 1 : nL === 3 ? 0.85 : 0.65;
  const DFd = (nL * mL) / Ng;
  const dlane = (5 * 9.3 * Lm ** 4) / (384 * EIc);
  const dLL1 = DFd * (1 + IM) * dtr * 1000;
  const dLL2 = DFd * (0.25 * (1 + IM) * dtr + dlane) * 1000;
  const dDk2 = ((5 * (DC2 + DC3) * Lm ** 4) / (384 * EIg)) * 1000;
  const dDk3 = ((5 * (DC4 + DW) * Lm ** 4) / (384 * EIc)) * 1000;
  const dDeck = dDk2 + dDk3;
  const rLT = rm.dLTid / rm.fpt;
  const dtd = (dps - dsw) * (1 + psi_di) - dps * rLT * (1 + 0.7 * psi_di);
  const camber = {
    dps,
    dsw,
    d0: dps - dsw,
    rLT,
    dtd,
    dcr: (dps - dsw) * psi_di,
    dDeck,
    dDk2,
    dDk3,
    dtr: dtr * 1000,
    dlane: dlane * 1000,
    dLL1,
    dLL2,
    DFd,
    mL,
    lim: Ls / (I.WPL > 0 ? Math.max(I.dlim, 1000) : I.dlim),
  };

  // ---- anchorage zone (§10.10.1) ----
  const bgw = damWidthAt(G.dd, 5);
  const h4 = bgw / 4;
  const AsL = ((G.anN || 0) * PI * (G.anD || 0) ** 2) / 4;
  let nS = 0;
  G.stir.zones.forEach(([a, bZone, s]) => {
    if (s > 0) for (let p = a + s; p <= bZone + 1e-6; p += s) if (p <= h4 + 1e-6) nS++;
  });
  const AsS = (nS * (G.anS || 0) * PI * G.stir.d ** 2) / 4;
  const Asz = AsL + AsS;
  const Pi = nstr * Ap1 * fpj;
  const Pr = 140 * Asz;
  const anch = {
    b: bgw,
    h4,
    n: G.anN,
    d: G.anD,
    AsL,
    nS,
    legS: G.anS || 0,
    dS: G.stir.d,
    AsS,
    Asz,
    Pr: Pr / 1e3,
    Pi: Pi / 1e3,
    req: (0.04 * Pi) / 1e3,
  };

  // ---- debonding checks (§11.4.3) ----
  const debs = G.strands.filter((s) => s[4] > 0);
  const rowsN: Record<string, { n: number; d: number; xs: number[] }> = {};
  G.strands.forEach((s) => {
    if (!rowsN[s[1]]) rowsN[s[1]] = { n: 0, d: 0, xs: [] };
    rowsN[s[1]].n++;
    if (s[4] > 0) rowsN[s[1]].d++;
    rowsN[s[1]].xs.push(s[2]);
  });
  const endAt: Record<number, number> = {};
  debs.forEach((s) => {
    endAt[s[4]] = (endAt[s[4]] || 0) + 1;
  });
  const outerOK = Object.entries(rowsN).every(([r, o]) => {
    const mn = Math.min(...o.xs);
    const mx = Math.max(...o.xs);
    return G.strands
      .filter((s) => s[1] === r && (Math.abs(s[2] - mn) < 1e-6 || Math.abs(s[2] - mx) < 1e-6))
      .every((s) => s[4] === 0);
  });
  const symOK = debs.every(
    (s) =>
      G.strands.some(
        (t) => t !== s && t[1] === s[1] && Math.abs(t[2] + s[2]) < 1e-6 && t[4] === s[4],
      ) || Math.abs(s[2]) < 1e-6,
  );
  const maxEnd = Math.max(0, ...Object.values(endAt));
  const limEnd = Math.max(0.4 * debs.length, 4);
  const debond = {
    n: debs.length,
    tot: nstr,
    ratio: debs.length / nstr,
    rows: rowsN,
    endAt,
    maxEnd,
    limEnd,
    outerOK,
    symOK,
    totOK: debs.length <= 0.25 * nstr + 1e-9,
    otherOK:
      Object.values(rowsN).every((o) => o.d <= 0.4 * o.n + 1e-9) &&
      maxEnd <= limEnd &&
      outerOK &&
      symOK,
    ok: false,
  };
  debond.ok = debond.totOK && debond.otherOK;

  // ---- lifting checks ----
  const lift = (() => {
    const a = I.hook;
    const wN = DC1;
    const out: DamLiftCase[] = [];
    const points: Array<[string, number]> = [
      ['Tại móc cẩu', a],
      ['Giữa dầm', L / 2],
    ];
    for (const [nm, xg] of points) {
      const r = one(xg - brg);
      const Mx = (kd: number): number => {
        const w = wN * kd;
        const R = ((w * L) / 2 / 1e3) * 1e3;
        let M = (-w * xg * xg) / 2;
        if (xg > a) M += R * (xg - a);
        return M;
      };
      for (const kd of [1 - I.kdyn, 1 + I.kdyn]) {
        const M = Mx(kd);
        const ft = (r.Pt * 1e3) / r.Ag - (r.Pt * 1e3 * r.e * r.yt) / r.Ig + (M * r.yt) / r.Ig;
        const fb = (r.Pt * 1e3) / r.Ag + (r.Pt * 1e3 * r.e * r.yb) / r.Ig - (M * r.yb) / r.Ig;
        out.push({
          nm,
          x: xg,
          kd,
          M: M / 1e6,
          Pt: r.Pt,
          ft,
          fb,
          tc: tensCheck(ft, fb, r.P, r.hollow, xg - brg),
        });
      }
    }
    return out;
  })();

  // ---- thermal gradient (TCVN 11823-3, §11.3, Table 25) ----
  const TG = (() => {
    const al = I.alpha;
    const A = H + hs >= 400 ? 300 : H + hs - 100;
    const sig = (T1: number, T2: number, _T3?: number): DamThermalGradComp => {
      const Tz = (d: number): number =>
        d <= 100 ? T1 + ((T2 - T1) * d) / 100 : d <= 100 + A ? (T2 * (100 + A - d)) / A : 0;
      const sl: Array<{ y: number; b: number; E: number; T: number }> = [];
      const dy = 2;
      let EA = 0;
      let ES = 0;
      for (let y = dy / 2; y < H + hs; y += dy) {
        let bw: number;
        let E: number;
        if (y > H) {
          bw = bd;
          E = Ecs;
        } else {
          bw = damWidthAt(G.dd, y);
          G.voids.forEach((v) => {
            bw -= damVW(v, y);
          });
          E = Ec;
        }
        const T = Tz(H + hs - y);
        sl.push({ y, b: bw, E, T });
        EA += E * bw * dy;
        ES += E * bw * dy * y;
      }
      const yc = ES / EA;
      let EI = 0;
      let N = 0;
      let M = 0;
      sl.forEach((q) => {
        EI += q.E * q.b * dy * (q.y - yc) ** 2;
        N += q.E * q.b * dy * al * q.T;
        M += q.E * q.b * dy * al * q.T * (q.y - yc);
      });
      const e0 = N / EA;
      const kap = M / EI;
      const f = (y: number, E: number, T: number): number => E * (al * T - e0 - kap * (y - yc));
      return {
        dk: f(H + hs, Ecs, Tz(0)),
        gt: f(H, Ec, Tz(hs)),
        gb: f(0, Ec, Tz(H + hs)),
        A,
        kap,
      };
    };
    return {
      pos: sig(I.TGp[0], I.TGp[1], I.TGp[2]),
      neg: sig(I.TGn[0], I.TGn[1], I.TGn[2]),
      g: I.gTG,
    };
  })();

  const Rg = { DC: ((DC1 + DC2 + DC3 + DC4) * Lm) / 2, DW: (DW * Lm) / 2 };

  return {
    EIc,
    Lm,
    fsT,
    AsTop,
    debond,
    lift,
    TG,
    kind: G.kind,
    Ec,
    Eci,
    Ecs,
    ncs,
    S_h,
    S_s,
    S_e,
    Sc_h: comp(S_h),
    Sc_s: comp(S_s),
    Aavg,
    loads,
    DF,
    IM,
    groups,
    nstr,
    lt,
    shr,
    res,
    camber,
    anch,
    IF,
    bvi,
    Rg,
    hs,
    hsw,
    bd,
    Lend,
    Lmid,
    SOL,
    Lh,
    L,
    Ls,
    brg,
    xv,
    Av,
    Avf1,
    H,
    vol: Aavg * L * 1e-9,
    jointTot: (I.S * 1000 * H - damPoly(G.ddRef || G.dd).A) * 1e-6,
  };
}

export const DAM = {
  LIB: DAM_LIB,
  calc: damCalc,
  poly: damPoly,
  sect: damSect,
  widthAt: damWidthAt,
  EcOf: damEcOf,
  wcOf: damWcOf,
  b1Of: damB1Of,
  vW: damVW,
  vHH: damVHH,
};

export function evalDamLimits(I: Pick<DamSpInput, 'fc' | 'fci' | 'fcs' | 'exp'>): DamLimits {
  const ftl =
    I.exp === '2' ? Math.min(0.25 * Math.sqrt(I.fc), 2.1) : Math.min(0.5 * Math.sqrt(I.fc), 4.1);
  return {
    trC: 0.6 * I.fci,
    trT: Math.min(0.25 * Math.sqrt(I.fci), 1.38),
    trT2: 0.63 * Math.sqrt(I.fci),
    svP: 0.45 * I.fc,
    svI: 0.6 * I.fc,
    svT: ftl,
    dkP: 0.45 * I.fcs,
    dkI: 0.6 * I.fcs,
    fat: 0.4 * I.fc,
  };
}

export function evalDamSummary(
  R: DamCalcResult,
  I: Pick<DamSpInput, 'fpu' | 'fpjr' | 'fpyr'>,
  LIM: DamLimits,
): { items: DamSummaryItem[]; allOK: boolean } {
  const T = R.TG;
  const gT = T.g;
  const tgT = gT * Math.max(T.pos.gt, T.neg.gt, 0);
  const tgB = gT * Math.min(T.pos.gb, T.neg.gb, 0);
  const tgD = gT * Math.max(T.pos.dk, T.neg.dk, 0);

  R.res.forEach((r) => {
    r.ftIT = r.ftI + tgT;
    r.fbIIIT = r.fbIII + tgB;
    r.fdIT = r.fdI + tgD;
  });

  const okTr = (r: DamSectionRes): boolean =>
    r.ft_tr <= LIM.trC && r.fb_tr <= LIM.trC && Math.min(r.ft_tr, r.fb_tr) >= -r.trT.lim - 1e-9;
  const okL = (o: DamLiftCase): boolean =>
    o.ft <= LIM.trC && o.fb <= LIM.trC && Math.min(o.ft, o.fb) >= -o.tc.lim - 1e-9;

  const C = R.camber;
  const dmax = Math.max(C.dLL1, C.dLL2);
  const Db = R.debond;
  const nOut = (['L', 'Nb', 'I', 'J', 'th'] as const).filter(
    (q) => R.DF.range && R.DF.range[q] === false,
  ).length;

  const bondedFpes = R.res.filter((r) => r.nb > 0).map((r) => r.fpe);
  const minFpeBonded = bondedFpes.length > 0 ? Math.min(...bondedFpes) : Infinity;

  const items: DamSummaryItem[] = [
    [
      'Hệ số phân bố gần đúng: số tham số ngoài phạm vi Bảng 6, 11 (L, Nb, I, J, θ) - ngoài phạm vi phải phân tích theo Điều 6.3 Phần 4',
      String(nOut),
      '= 0',
      nOut === 0,
    ],
    [
      'Nén khi truyền lực (MPa)',
      Math.max(...R.res.map((r) => Math.max(r.ft_tr, r.fb_tr))),
      '≤ ' + fx(LIM.trC, 2),
      Math.max(...R.res.map((r) => Math.max(r.ft_tr, r.fb_tr))) <= LIM.trC,
    ],
    [
      'Kéo khi truyền lực (MPa)',
      Math.min(...R.res.map((r) => Math.min(r.ft_tr, r.fb_tr))),
      'Bảng 7',
      R.res.every(okTr),
    ],
    [
      'Nén thớ trên dầm, Sử dụng I + TG (MPa)',
      Math.max(...R.res.map((r) => r.ftIT ?? r.ftI)),
      '≤ ' + fx(LIM.svI, 2),
      Math.max(...R.res.map((r) => r.ftIT ?? r.ftI)) <= LIM.svI,
    ],
    [
      'Nén thớ trên dầm, thường xuyên (MPa)',
      Math.max(...R.res.map((r) => r.ftP)),
      '≤ ' + fx(LIM.svP, 2),
      Math.max(...R.res.map((r) => r.ftP)) <= LIM.svP,
    ],
    [
      'Ứng suất thớ dưới dầm, Sử dụng III + TG (MPa)',
      Math.min(...R.res.map((r) => r.fbIIIT ?? r.fbIII)),
      '≥ ' + fx(-LIM.svT, 2),
      Math.min(...R.res.map((r) => r.fbIIIT ?? r.fbIII)) >= -LIM.svT - 1e-9,
    ],
    [
      'Nén bản mặt cầu, Sử dụng I + TG (MPa)',
      Math.max(...R.res.map((r) => r.fdIT ?? r.fdI)),
      '≤ ' + fx(LIM.dkI, 2),
      Math.max(...R.res.map((r) => r.fdIT ?? r.fdI)) <= LIM.dkI,
    ],
    [
      'Mu/Mr lớn nhất',
      Math.max(...R.res.map((r) => (r.Mr > 0 ? r.Mu / r.Mr : 0))),
      '≤ 1',
      Math.max(...R.res.map((r) => (r.Mr > 0 ? r.Mu / r.Mr : 0))) <= 1,
    ],
    [
      'fpe nhỏ nhất / fpu (điều kiện dùng PT 23, Điều 7.3.1.1)',
      minFpeBonded / I.fpu,
      '≥ 0,5',
      minFpeBonded >= 0.5 * I.fpu - 1e-9,
    ],
    [
      'Ứng suất kéo căng fpj / fpu (Điều 9.3, tao tự chùng thấp căng trước)',
      I.fpjr,
      '≤ 0,75',
      I.fpjr <= 0.75 + 1e-9,
    ],
    [
      'Vu/Vr lớn nhất',
      Math.max(...R.res.map((r) => r.Vu / r.Vr)),
      '≤ 1',
      Math.max(...R.res.map((r) => r.Vu / r.Vr)) <= 1,
    ],
    [
      'Cốt thép dọc chịu kéo do cắt (Điều 8.3.5): yêu cầu / có',
      Math.max(...R.res.map((r) => r.Treq / r.Tprov)),
      '≤ 1',
      Math.max(...R.res.map((r) => r.Treq / r.Tprov)) <= 1,
    ],
    [
      'Cắt trượt mặt tiếp xúc Vui/Vri ; Avf ≥ Avf,min',
      Math.max(...R.res.map((r) => r.Vui / r.Vri)),
      '≤ 1',
      Math.max(...R.res.map((r) => r.Vui / r.Vri)) <= 1 &&
        R.res.every((r) => r.Avf / r.s >= r.Avfmin - 1e-9),
    ],
    ['Độ võng do hoạt tải (mm)', dmax, '≤ ' + fx(C.lim, 2), dmax <= C.lim],
    [
      'Ứng suất cáp sau mất mát fpe lớn nhất (MPa)',
      Math.max(...R.res.map((r) => r.fpe)),
      '≤ 0,8fpy = ' + fx(0.8 * I.fpyr * I.fpu, 1),
      Math.max(...R.res.map((r) => r.fpe)) <= 0.8 * I.fpyr * I.fpu,
    ],
    [
      'Cẩu lắp: ứng suất kéo nhỏ nhất (MPa)',
      Math.min(...R.lift.map((o) => Math.min(o.ft, o.fb))),
      'Bảng 7',
      R.lift.every(okL),
    ],
    ['Vùng neo: Pr / 0,04Pi', R.anch.Pr / R.anch.req, '≥ 1', R.anch.Pr >= R.anch.req],
    [
      'Mỏi: 0,5(DƯL + thường xuyên) + Mỏi I (MPa)',
      Math.max(...R.res.map((r) => r.ftFat)),
      '≤ ' + fx(LIM.fat, 2),
      R.res.every((r) => r.ftFat <= LIM.fat),
    ],
    [
      'Nén bản mặt cầu, thường xuyên (MPa)',
      Math.max(...R.res.map((r) => r.fdP)),
      '≤ ' + fx(LIM.dkP, 2),
      R.res.every((r) => r.fdP <= LIM.dkP),
    ],
    [
      'Cốt thép tối thiểu: Mr / min(Mcr ; 1,33Mu) nhỏ nhất',
      Math.min(...R.res.filter((r) => r.x > 0).map((r) => (r.Mmin > 0 ? r.Mr / r.Mmin : 99))),
      '≥ 1',
      R.res.filter((r) => r.x > 0).every((r) => r.Mr >= r.Mmin - 1e-9),
    ],
    [
      'Cốt thép đai: Av ≥ Av,min ; s ≤ smax',
      Math.min(...R.res.map((r) => (r.Avmin > 0 ? r.Av / r.Avmin : 99))),
      '≥ 1',
      R.res.every((r) => r.Av >= r.Avmin - 1e-9 && r.s <= r.smax + 1e-9),
    ],
    ['Tao mất dính bám (Điều 11.4.3): tỷ lệ bọc ống', Db.ratio, '≤ 0,25 và các điều kiện khác', Db.ok],
  ];

  const dbStar = !Db.ok && Db.otherOK && items.slice(0, -1).every((it) => it[3] === true);
  if (dbStar) items[items.length - 1][3] = 'star';
  const allOK = items.every((it) => it[3] === true || it[3] === 'star');
  R.items = items;
  R.allOK = allOK;
  return { items, allOK };
}

// ============================================================================
// RCG: Cast-in-place non-prestressed RC slab girder (TCVN 11823:2017)
// ============================================================================

export const RC_LIB: Record<'868', RcLib868Entry> = {
  868: {
    sp: {
      sp_Lt: 8.68,
      sp_a0: 0.3,
      sp_Ng: 5,
      sp_S: 1,
      sp_hs: 0.19,
      sp_hw: 0.01,
      sp_fc: 30,
      sp_fcs: 30,
      sp_hm: 'Kết cấu phần trên - dầm bản BTCT L = 8,68 m',
    },
    rc: {
      rc_h1: 180,
      rc_h2: 0,
      rc_h3: 0,
      rc_h4: 80,
      rc_h5: 100,
      rc_bt: 900,
      rc_b3: 900,
      rc_bd: 980,
      rc_bdE: 985,
      rc_vd: '',
      rc_bars: '10 28 49',
      rc_tbars: '7 12 38',
      rc_barsE: '',
      rc_tbarsE: '',
      rc_sbar: 0,
      rc_gr: '400',
      rc_grv: '240T',
      rc_sd: 12,
      rc_sn: 2,
      rc_sz: '0 8680 150',
      rc_cd: 12,
      rc_cn: 2,
      rcg_ag: 20,
      rc_ge: '1',
      rc_etaD: 1,
      rc_etaR: 1,
      rc_etaI: 1.05,
    },
  },
};

export const RC_GRV: Record<RcGrvKey, readonly [number, number, string]> = {
  '240T': [240, 380, 'CB240-T'],
  '300T': [300, 440, 'CB300-T'],
  '300V': [300, 450, 'CB300-V'],
  '400V': [400, 570, 'CB400-V'],
};

const rcAb = (d: number): number => (PI * d * d) / 4;
const rcClamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
const rcB1Of = (fc: number): number => rcClamp(0.85 - (0.05 * (fc - 28)) / 7, 0.65, 0.85);

function rcLevels(G: Pick<RcInput, 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'bd' | 'b3' | 'bt'>): {
  H: number;
  L: Array<[number, number]>;
} {
  const H = G.h1 + G.h2 + G.h3 + G.h4 + G.h5;
  const y = [0, G.h5, G.h5 + G.h4, G.h5 + G.h4 + G.h3, G.h5 + G.h4 + G.h3 + G.h2, H];
  const w = [G.bd, G.bd, G.b3, G.b3, G.bt, G.bt];
  const L: Array<[number, number]> = [];
  y.forEach((yy, i) => {
    const q = L[L.length - 1];
    if (!q || Math.abs(q[0] - yy) > 1e-9 || Math.abs(q[1] - w[i]) > 1e-9) L.push([yy, w[i]]);
  });
  return { H, L };
}

function rcOutline(
  G: Pick<RcInput, 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'bd' | 'bdE' | 'b3' | 'bt'>,
  edge: boolean,
): Point2D[] {
  const { H, L } = rcLevels(G);
  const R: Point2D[] = L.map(([y, w]) => [w / 2, y]);
  if (!edge) {
    return [
      ...R,
      ...L.slice()
        .reverse()
        .map(([y, w]): Point2D => [-w / 2, y]),
    ];
  }
  const xo = G.bd / 2 - G.bdE;
  return [...R, [xo, H], [xo, 0]];
}

function rcPprops(P: readonly Point2D[]): {
  A: number;
  Sx: number;
  Sy: number;
  Ixx: number;
  Iyy: number;
} {
  let A = 0;
  let Sx = 0;
  let Sy = 0;
  let Ixx = 0;
  let Iyy = 0;
  const n = P.length;
  for (let i = 0; i < n; i++) {
    const [x1, y1] = P[i];
    const [x2, y2] = P[(i + 1) % n];
    const c = x1 * y2 - x2 * y1;
    A += c;
    Sx += (y1 + y2) * c;
    Sy += (x1 + x2) * c;
    Ixx += (y1 * y1 + y1 * y2 + y2 * y2) * c;
    Iyy += (x1 * x1 + x1 * x2 + x2 * x2) * c;
  }
  A /= 2;
  Sx /= 6;
  Sy /= 6;
  Ixx /= 12;
  Iyy /= 12;
  if (A < 0) {
    A = -A;
    Sx = -Sx;
    Sy = -Sy;
    Ixx = -Ixx;
    Iyy = -Iyy;
  }
  return { A, Sx, Sy, Ixx, Iyy };
}

function rcChords(P: readonly Point2D[], y: number): number[] {
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

function rcWAt(
  P: readonly Point2D[],
  voids: ReadonlyArray<readonly [number, number, number]>,
  y: number,
): number {
  const xs = rcChords(P, y);
  let w = 0;
  for (let i = 0; i + 1 < xs.length; i += 2) w += xs[i + 1] - xs[i];
  (voids || []).forEach((v) => {
    const r = v[2] / 2;
    const d = Math.abs(y - v[1]);
    if (d < r) w -= 2 * sq(r * r - d * d);
  });
  return Math.max(0, w);
}

function rcGross(
  P: readonly Point2D[],
  voids: ReadonlyArray<readonly [number, number, number]>,
  H: number,
  deck: { n: number; b: number; t: number; xc?: number } | null,
): RcGrossProps {
  const p = rcPprops(P);
  let A = p.A;
  let Sx = p.Sx;
  let Sy = p.Sy;
  let Ixx = p.Ixx;
  let Iyy = p.Iyy;
  (voids || []).forEach((v) => {
    const a = rcAb(v[2]);
    const i0 = (PI * v[2] ** 4) / 64;
    A -= a;
    Sx -= a * v[1];
    Sy -= a * v[0];
    Ixx -= i0 + a * v[1] * v[1];
    Iyy -= i0 + a * v[0] * v[0];
  });
  if (deck) {
    const a = deck.n * deck.b * deck.t;
    const yc = H + deck.t / 2;
    const xc = deck.xc || 0;
    A += a;
    Sx += a * yc;
    Sy += a * xc;
    Ixx += (deck.n * deck.b * deck.t ** 3) / 12 + a * yc * yc;
    Iyy += (deck.n * deck.t * deck.b ** 3) / 12 + a * xc * xc;
  }
  const yb = Sx / A;
  const xc = Sy / A;
  const I = Ixx - A * yb * yb;
  const Iy = Iyy - A * xc * xc;
  const top = H + (deck ? deck.t : 0);
  return { A, yb, yt: top - yb, I, Iy, xc, Ip: I + Iy, Sb: I / yb, St: I / (top - yb), top };
}

function rcFibers(
  P: readonly Point2D[],
  voids: ReadonlyArray<readonly [number, number, number]>,
  H: number,
  deck: { n: number; b: number; t: number } | null,
  fcG: number,
  fcD: number,
  dy: number,
): RcFiberBundle {
  const F: RcFiberSlice[] = [];
  const top = H + (deck ? deck.t : 0);
  for (let y = dy / 2; y < top; y += dy) {
    if (y > H && deck) F.push({ y, b: deck.b, fc: fcD, r: deck.n });
    else F.push({ y, b: rcWAt(P, voids, y), fc: fcG, r: 1 });
  }
  return { F, top, dy };
}

function rcFlex(
  FB: RcFiberBundle,
  bars: ReadonlyArray<{ n: number; d: number; y: number; A: number; top: boolean }>,
  fy: number,
  Es: number,
): RcFlexResult {
  const { F, top, dy } = FB;
  const ecu = 0.003;
  const fcT = F[F.length - 1].fc;
  const b1 = rcB1Of(fcT);
  const a1 = 0.85;
  const fcAt = (dep: number): number => F[rcClamp(Math.floor((top - dep) / dy), 0, F.length - 1)].fc;
  const st = (c: number) => {
    const a = Math.min(b1 * c, top);
    let Cc = 0;
    let Mc = 0;
    for (const f of F) {
      const dep = top - f.y;
      if (dep > a) continue;
      const q = a1 * f.fc * f.b * dy;
      Cc += q;
      Mc += q * dep;
    }
    let Fs = 0;
    let Ms = 0;
    const S = bars.map((b) => {
      const dep = top - b.y;
      const e = (ecu * (c - dep)) / c;
      const fs = rcClamp(Es * e, -fy, fy);
      const Fb = b.A * (fs - (dep < a ? a1 * fcAt(dep) : 0));
      Fs += Fb;
      Ms += Fb * dep;
      return { ...b, dep, e, fs, Fb };
    });
    return { a, Cc, Mc, Fs, Ms, S, R: Cc + Fs };
  };
  let lo = 1e-3;
  let hi = top;
  for (let k = 0; k < 70; k++) {
    const m = (lo + hi) / 2;
    if (st(m).R > 0) hi = m;
    else lo = m;
  }
  const c = (lo + hi) / 2;
  const r = st(c);
  const Mn = -(r.Mc + r.Ms);
  const Tb = r.S.filter((b) => b.Fb < 0);
  const T = -Tb.reduce((t, b) => t + b.Fb, 0);
  const de = T > 0 ? -Tb.reduce((t, b) => t + b.Fb * b.dep, 0) / T : top;
  const dt = Math.max(...bars.map((b) => top - b.y));
  const et = (ecu * (dt - c)) / c;
  const ecl = fy <= 420 ? 0.002 : Math.min(0.004, 0.002 + (0.002 * (fy - 420)) / 270);
  const etl = fy <= 420 ? 0.005 : Math.min(0.008, 0.005 + (0.003 * (fy - 420)) / 270);
  const phi = rcClamp(0.75 + (0.15 * (et - ecl)) / (etl - ecl), 0.75, 0.9);
  return {
    c,
    a: r.a,
    b1,
    a1,
    Cc: r.Cc,
    yC: r.Cc > 0 ? r.Mc / r.Cc : 0,
    T,
    de,
    dt,
    et,
    ecl,
    etl,
    phi,
    Mn: Mn / 1e6,
    Mr: (phi * Mn) / 1e6,
    bars: r.S,
    dvz: T > 0 ? Mn / T : 0,
    top,
  };
}

function rcCrk(
  FB: RcFiberBundle,
  bars: ReadonlyArray<{ n: number; d: number; y: number; A: number; top: boolean }>,
  n: number,
): RcCrackedProps {
  const { F, top, dy } = FB;
  const S1 = (x: number): number => {
    let s = 0;
    for (const f of F) {
      const dep = top - f.y;
      if (dep < x) s += f.r * f.b * dy * (x - dep);
    }
    bars.forEach((b) => {
      const dep = top - b.y;
      s += (dep < x ? n - 1 : n) * b.A * (x - dep);
    });
    return s;
  };
  let lo = 1e-3;
  let hi = top;
  for (let k = 0; k < 70; k++) {
    const m = (lo + hi) / 2;
    if (S1(m) > 0) hi = m;
    else lo = m;
  }
  const x = (lo + hi) / 2;
  let I = 0;
  for (const f of F) {
    const dep = top - f.y;
    if (dep < x) I += f.r * f.b * dy * (x - dep) ** 2;
  }
  bars.forEach((b) => {
    const dep = top - b.y;
    I += (dep < x ? n - 1 : n) * b.A * (x - dep) ** 2;
  });
  return { x, I, top };
}

function rcCalc(
  I: DamSpInput,
  G: RcInput,
  kind: 'g' | 'b',
  options?: GirderHollowStepOptions,
): RcCalcResult {
  const leverFn = resolveLeverRule(options);
  const edge = kind === 'b';
  const Ng = I.Ng;
  const S = I.S * 1000;
  const Lt = I.Lt * 1000;
  const a0 = I.a0 * 1000;
  const Ls = Lt - 2 * a0;
  const Lm = Ls / 1000;
  const fc = I.fc;
  const fcs = I.fcs;
  const K1 = I.K1 || 1;
  const Ec = DAM.EcOf(fc, K1);
  const Ecs = DAM.EcOf(fcs, K1);
  const ncs = Ecs / Ec;
  const Es = I.Es || 200000;
  const fy = G.fy;
  const fu = G.fu;
  const fyv = G.fyv;
  const n = Es / Ec;
  const { H } = rcLevels(G);
  const P = rcOutline(G, edge);
  const voids = G.voids || [];
  const hs = (I.hs - I.hwear) * 1000;
  const hsw = I.hs * 1000;
  const ed = I.Wb * 500 - ((Ng - 1) / 2) * S;
  const beff = edge ? S / 2 + ed : S;
  const xdk = edge ? (S / 2 - ed) / 2 : 0;
  const g1 = rcGross(P, voids, H, null);
  const gc = rcGross(P, voids, H, { n: ncs, b: beff, t: hs, xc: xdk });
  const Aout = rcPprops(P).A;
  const AoutG = rcPprops(rcOutline(G, false)).A;
  const bars = (edge && G.barsE && G.barsE.length ? G.barsE : G.bars).map((b) => ({
    n: b.n,
    d: b.d,
    y: b.y,
    A: b.n * rcAb(b.d),
    top: b.top,
  }));
  const As = bars.filter((b) => !b.top).reduce((t, b) => t + b.A, 0);
  const Asc = bars.filter((b) => b.top).reduce((t, b) => t + b.A, 0);
  const yT =
    As > 0 ? bars.filter((b) => !b.top).reduce((t, b) => t + b.A * b.y, 0) / As : G.h5 / 2;
  const bot = bars.filter((b) => !b.top).sort((p, q) => p.y - q.y)[0] || {
    n: 1,
    d: 0,
    y: 50,
  };
  const dc = bot.y;
  const sbar =
    G.sbar > 0 ? G.sbar : bot.n > 1 ? (rcWAt(P, voids, dc) - 2 * dc) / (bot.n - 1) : 0;

  // ---------- dead loads (kN/m) ----------
  const g = I.gc;
  const dS = edge ? I.hsxB || 0 : I.hsxG || 0;
  const DC1 = g * (Aout - voids.reduce((t, v) => t + rcAb(v[2]), 0)) * 1e-6;
  const DC2 = (g * (I.hs + dS) * beff) / 1000;
  const Aj = (edge ? 0.5 : 1) * (S * H - AoutG);
  const DC3 = g * Aj * 1e-6;
  const WPL = I.WPL || 0;
  const curb = I.Apa * g;
  const rail = I.Pra / I.Lt / 2;
  const side = ((I.APL || 0) / 2) * g;
  const lever = I.curbMode === 'L' && edge;
  const DC4 = lever ? curb + rail + side : (2 * (curb + rail + side)) / Ng;
  const DWsu = (I.Hsu * I.gsu * (I.Wb - 2 * I.Wpa - 2 * WPL)) / Ng;
  const DW = DWsu + (I.DWu || 0);
  const qPLs = WPL > 0.6 ? (I.qPL || 3) * WPL : 0;
  const wPL = lever ? qPLs : (2 * qPLs) / Ng;
  const loads: Record<string, number> = {
    DC1,
    DC2,
    DC3,
    DC4,
    DWsu,
    DWu: I.DWu || 0,
    DW,
    curb,
    rail,
    side,
    wPL,
    qPLs,
    dS,
    Aj: Aj * 1e-6,
    beff,
    ed,
  };

  // ---------- distribution factors (TCVN 11823-4) ----------
  const Pg = rcOutline(G, false);
  const gG = rcGross(Pg, voids, H, { n: ncs, b: S, t: hs, xc: 0 });
  const bDF = Math.max(...Pg.map((p) => p[0])) - Math.min(...Pg.map((p) => p[0]));
  const Ig = gG.I;
  const Ag = gG.A;
  const J = Ag ** 4 / (40 * gG.Ip);
  const IJ = Ig / J;
  const k = Math.max(1.5, 2.5 * Ng ** -0.2);
  const M1 = k * (bDF / (2.8 * Ls)) ** 0.5 * IJ ** 0.25;
  const M2 = k * (bDF / 7600) ** 0.6 * (bDF / Ls) ** 0.2 * IJ ** 0.06;
  const V1 = 0.7 * (bDF / Ls) ** 0.15 * IJ ** 0.05;
  const V2 = (bDF / 4000) ** 0.4 * (bDF / Ls) ** 0.1 * IJ ** 0.05 * Math.max(1, bDF / 1200);
  const multi = I.nL >= 2;
  const MiDF = multi ? Math.max(M1, M2) : M1;
  const ViDF = multi ? Math.max(V1, V2) : V1;
  const range = {
    b: bDF >= 900 && bDF <= 1500,
    L: Ls >= 6000 && Ls <= 37000,
    Nb: Ng >= 5 && Ng <= 20,
    J: J >= 1e10 && J <= 2.5e11,
    I: Ig >= 1.7e10 && Ig <= 2.5e11,
  };
  const xsG = Array.from({ length: Ng }, (_, i) => (i - (Ng - 1) / 2) * I.S);
  const xa = -(I.Wb / 2 - I.Wpa - WPL);
  const xb = -xa;
  const levI = Math.max(
    0,
    ...xsG.map((_, j) =>
      Ng < 3 || (j > 0 && j < Ng - 1) ? leverFn(xsG, j, xa, xb, I.nL, true).g : 0,
    ),
  );
  const levE = leverFn(xsG, 0, xa, xb, I.nL, true).g;
  const outM = !(range.b && range.L && range.Nb);
  const outV = !(range.b && range.L && range.Nb && range.J && range.I);

  const Pe = rcOutline(G, true);
  const xge = rcPprops(Pe).Sy / rcPprops(Pe).A;
  const de = ed + xge - (I.Wpa + WPL) * 1000;
  const eM1 = Math.max(1, 1.125 + de / 9100);
  const eM2 = Math.max(1, 1.04 + de / 7600);
  const eV1 = Math.max(1, 1.25 + de / 6100);
  const argEV2 = (de + bDF - 610) / 12200;
  const eV2 = Math.max(1, 1 + (argEV2 > 0 ? sq(argEV2) : 0));
  const fb = Math.min(1, 1200 / bDF);
  const M1e = M1 * eM1;
  const M2e = M2 * eM2;
  const V1e = V1 * eV1;
  const V2e = V2 * eV2 * fb;
  const deOutM = de > 600;
  const deOutV = de < 300 || de > 600;
  let Mf0: number;
  let Vf0: number;
  let dfM: number;
  let dfV: number;
  if (edge) {
    Mf0 = multi ? Math.max(M1e, M2e) : M1e;
    Vf0 = multi ? Math.max(V1e, V2e) : V1e;
    dfM = outM || deOutM ? Math.max(Mf0, levE) : Mf0;
    dfV = outV || deOutV ? Math.max(Vf0, levE) : Vf0;
  } else {
    Mf0 = MiDF;
    Vf0 = ViDF;
    dfM = outM ? Math.max(MiDF, levI) : MiDF;
    dfV = outV ? Math.max(ViDF, levI) : ViDF;
  }
  const skewClamped = Math.min(60, Math.max(0, I.skew || 0));
  const tanSkew = Math.tan((skewClamped * PI) / 180);
  const cM = Math.min(1, 1.05 - 0.25 * tanSkew);
  const cV = 1 + (Ls * sq(tanSkew)) / (90 * H);
  const M0 = dfM;
  const V0 = dfV;
  const DF: RcDistFactors = {
    b: bDF,
    k,
    J,
    IJ,
    Ig,
    A: Ag,
    Ip: gG.Ip,
    nL: I.nL,
    M1,
    M2,
    V1,
    V2,
    Mi: MiDF,
    Vi: ViDF,
    levI,
    levE,
    outM,
    outV,
    de,
    xge,
    eM1,
    eM2,
    eV1,
    eV2,
    fb,
    M1e,
    M2e,
    V1e,
    V2e,
    deOutM,
    deOutV,
    Mf0,
    Vf0,
    M: dfM * cM,
    V: dfV * cV,
    th: I.skew || 0,
    cM,
    cV,
    M0,
    V0,
    Mf: (edge ? M1e : M1) / 1.2,
    range,
  };

  // ---------- live load ----------
  const IM = I.IM;
  const truck: Array<[number, number]> = [
    [0, 35],
    [4.3, 145],
    [8.6, 145],
  ];
  const truckR: Array<[number, number]> = [
    [0, 145],
    [4.3, 145],
    [8.6, 35],
  ];
  const tandem: Array<[number, number]> = [
    [0, 110],
    [1.2, 110],
  ];
  const fat: Array<[number, number]> = [
    [0, 35],
    [4.3, 145],
    [13.3, 145],
  ];
  const fatR: Array<[number, number]> = [
    [0, 145],
    [9, 145],
    [13.3, 35],
  ];
  const Mi = (x: number, a: number): number =>
    a < 0 || a > Lm ? 0 : a <= x ? (a * (Lm - x)) / Lm : (x * (Lm - a)) / Lm;
  const Vi = (x: number, a: number): number =>
    a < 0 || a > Lm ? 0 : a < x ? -a / Lm : (Lm - a) / Lm;
  const env = (
    vehs: Array<[string, Array<[number, number]>]>,
    x: number,
    f: (x: number, a: number) => number,
  ) => {
    let best: { v: number; veh: string; p0?: number } = { v: 0, veh: '-' };
    for (const [nm, veh] of vehs) {
      for (let p0 = -14; p0 <= Lm + 0.0005; p0 += 0.005) {
        const vVal = veh.reduce((t, [p, w]) => t + w * f(x, p0 + p + (f === Vi ? 1e-9 : 0)), 0);
        if (vVal > best.v) best = { v: vVal, veh: nm, p0 };
      }
    }
    return best;
  };
  const vehs: Array<[string, Array<[number, number]>]> = [
    ['Xe tải', truck],
    ['Xe tải', truckR],
    ['Xe 2 trục', tandem],
  ];
  const laneM = (x: number): number => (9.3 * x * (Lm - x)) / 2;
  const laneV = (x: number): number => (9.3 * (Lm - x) ** 2) / (2 * Lm);
  const Mw = (w: number, x: number): number => (w * x * (Lm - x)) / 2;
  const Vw = (w: number, x: number): number => w * (Lm / 2 - x);
  const eta = G.eta > 0 ? G.eta : 1;

  // ---------- critical shear section ----------
  const face =
    I.sup === 'K' ? Math.max(0, Math.min(I.bk1, I.bk2) * 1000 - a0) : (I.bg * 1000) / 2;
  const FB1 = rcFibers(P, voids, H, null, fc, fc, 1);
  const FBc = rcFibers(P, voids, H, { b: beff, t: hs, n: ncs }, fc, fcs, 1);
  const flC = rcFlex(FBc, bars, fy, Es);
  const flN = rcFlex(FB1, bars, fy, Es);
  const hC = H + hs;
  const dvF = Math.max(flC.dvz, 0.9 * flC.de, 0.72 * hC);
  const xv = face + dvF;

  // ---------- cracked sections ----------
  const cr1 = rcCrk(FB1, bars, n);
  const cr2 = rcCrk(FBc, bars, n);

  // ---------- stirrups ----------
  const sOf = (x: number): { s: number; nv: number } => {
    const xg = Math.min(x + a0, Lt - (x + a0));
    const z = G.sz.find((zn) => xg >= zn[0] - 1e-6 && xg <= zn[1] + 1e-6) || G.sz[G.sz.length - 1];
    return { s: z[2], nv: z.length > 3 && z[3] > 0 ? z[3] : G.sn };
  };
  const bvAt = (() => {
    let m = Infinity;
    for (let y = Math.max(1, yT); y <= H - 0.5; y += 1) m = Math.min(m, rcWAt(P, voids, y));
    return Number.isFinite(m) ? m : rcWAt(P, voids, H / 2);
  })();
  const bvi = rcWAt(P, voids, H - 0.5);
  const IF_MAP = {
    N: {
      c: 0.52,
      mu: 0.6,
      K1: 0.2,
      K2: 5.5,
      t: 'Bê tông đổ trên bê tông đã đông cứng, sạch, không tạo nhám',
    },
    R: {
      c: 1.9,
      mu: 1.0,
      K1: 0.3,
      K2: 12.4,
      t: 'Bê tông đổ trên bê tông đã đông cứng, tạo nhám biên độ 6 mm',
    },
  } as const;
  const IF = IF_MAP[(I.ifc as 'N' | 'R') || 'N'] || IF_MAP.N;
  const fr = 0.63 * sq(fc);
  const g1f = I.g1 || 1.6;
  const g3 = fy / fu;
  const Mdnc0 = (x: number): number => Mw(DC1 + DC2 + DC3, x);
  const Sc = gc.Sb;
  const Snc = g1.Sb;
  const res: RcSectionRes[] = [];

  const one = (x: number, tag: string): RcSectionRes => {
    const M1 = Mw(DC1, x);
    const M2 = Mw(DC2, x);
    const M3 = Mw(DC3, x);
    const M4 = Mw(DC4, x);
    const MW = Mw(DW, x);
    const MPL = Mw(wPL, x);
    const V1 = Vw(DC1, x);
    const V2 = Vw(DC2, x);
    const V3 = Vw(DC3, x);
    const V4 = Vw(DC4, x);
    const VW = Vw(DW, x);
    const VPL = Vw(wPL, x);
    const vm = env(vehs, x, Mi);
    const vv = env(vehs, x, Vi);
    const MLLv = vm.v;
    const MLLl = laneM(x);
    const VLLv = vv.v;
    const VLLl = laneV(x);
    const MLL = DF.M * ((1 + IM) * MLLv + MLLl) + MPL;
    const VLL = DF.V * ((1 + IM) * VLLv + VLLl) + VPL;
    const MDC = M1 + M2 + M3 + M4;
    const VDC = V1 + V2 + V3 + V4;
    const Mu = eta * (1.25 * MDC + 1.5 * MW + 1.75 * MLL);
    const Vu = eta * (1.25 * VDC + 1.5 * VW + 1.75 * VLL);
    const Ms = MDC + MW + MLL;
    const Vs_ = VDC + VW + VLL;
    const Mu1 = eta * 1.25 * (M1 + M2 + M3);
    const Vu1 = eta * 1.25 * (V1 + V2 + V3);
    const Mdnc = Mdnc0(x);
    const Mcr = (g3 * (g1f * fr * Sc - Mdnc * 1e6 * (Sc / Snc - 1))) / 1e6;
    const Mmin = Math.min(Mcr, 1.33 * Mu);

    const so = sOf(x);
    const s = so.s;
    const Av = so.nv * rcAb(G.sd);
    const Avmin = (0.083 * sq(fc) * bvAt * s) / fyv;
    const hasMin = Av >= Avmin - 1e-9;
    const dv = dvF;
    const Vab = Math.abs(Vu) * 1e3;
    const Mab = Math.max(Math.abs(Mu) * 1e6, Vab * dv);
    let es = (Mab / dv + Vab) / (Es * As);
    es = Math.min(es, 0.006);
    const sxe = rcClamp((dv * 35) / ((G.ag || 20) + 16), 300, 2000);
    const beta = (4.8 / (1 + 750 * es)) * (hasMin ? 1 : 1300 / (1000 + sxe));
    const th = 29 + 3500 * es;
    const Vc = (0.083 * beta * sq(fc) * bvAt * dv) / 1e3;
    const Vs = (Av * fyv * dv) / Math.tan((th * PI) / 180) / s / 1e3;
    const Vlim = (0.25 * fc * bvAt * dv) / 1e3;
    const Vn = Math.min(Vc + Vs, Vlim);
    const Vr = 0.9 * Vn;
    const vu = Vab / (0.9 * bvAt * dv);
    const smax = vu < 0.125 * fc ? Math.min(0.8 * dv, 600) : Math.min(0.4 * dv, 300);
    const needSt = Math.abs(Vu) > 0.5 * 0.9 * Vc;

    const Treq =
      Math.abs(Mu) / (dv * 1e-3 * flC.phi) +
      Math.max(0, Math.abs(Vu) / 0.9 - 0.5 * Vs) / Math.tan((th * PI) / 180);
    const Tprov = (As * fy) / 1e3;

    const fyi = Math.min(fyv, 420);
    const dvi = flC.de - hs / 2;
    const Vui = Vab / dvi;
    const Acv = bvi;
    const Avf = G.cn > 0 ? (G.cn * rcAb(G.cd)) / s : 0;
    const Vni = Math.min(IF.c * Acv + IF.mu * Avf * fyi, IF.K1 * fcs * Acv, IF.K2 * Acv);
    const Vri = 0.9 * Vni;
    const Avfmin = (0.35 * Acv) / fyi;

    const Ms1 = M1 + M2 + M3;
    const Ms2 = M4 + MW + MLL;
    const fsOf = (b: { y: number }): number =>
      n *
      ((Ms1 * 1e6 * (cr1.top - b.y - cr1.x)) / cr1.I +
        (Ms2 * 1e6 * (cr2.top - b.y - cr2.x)) / cr2.I);
    const fss = fsOf(bot);
    const fbg = (Ms1 * 1e6 * g1.yb) / g1.I + (Ms2 * 1e6 * gc.yb) / gc.I;
    const bs = 1 + dc / (0.7 * (hC - dc));
    const smaxCr = fss > 0 ? (123000 * G.ge) / (bs * Math.min(fss, 0.6 * fy)) - 2 * dc : Infinity;
    const needCr = fbg > 0.8 * fr;

    const vf = env(
      [
        ['Xe mỏi', fat],
        ['Xe mỏi', fatR],
      ],
      x,
      Mi,
    );
    const Mfat = DF.Mf * (1 + 0.15) * vf.v;
    const dfat = (n * Mfat * 1e6 * (cr2.top - bot.y - cr2.x)) / cr2.I;
    const fmin = fsOf({ y: bot.y }) - (n * MLL * 1e6 * (cr2.top - bot.y - cr2.x)) / cr2.I;
    const fyF = rcClamp(fy, 420, 690);
    const dFTH = 166 - (138 * Math.max(0, fmin)) / fyF;

    const r: RcSectionRes = {
      x,
      tag,
      M1,
      M2,
      M3,
      M4,
      MW,
      MPL,
      V1,
      V2,
      V3,
      V4,
      VW,
      VPL,
      MLLv,
      MLLl,
      VLLv,
      VLLl,
      MLL,
      VLL,
      MDC,
      VDC,
      Mu,
      Vu,
      Ms,
      Vs: Vs_,
      Mu1,
      Vu1,
      vehM: vm.veh,
      vehV: vv.veh,
      Mn: flC.Mn,
      phi: flC.phi,
      Mr: flC.Mr,
      Mr1: flN.Mr,
      Mdnc,
      Mcr,
      Mmin,
      s,
      nv: so.nv,
      Av,
      Avmin,
      hasMin,
      dv,
      es,
      sxe,
      beta,
      th,
      Vc,
      Vs2: Vs,
      Vlim,
      Vn,
      Vr,
      vu,
      smax,
      needSt,
      Treq,
      Tprov,
      dvi,
      Vui,
      Acv,
      Avf,
      Vni,
      Vri,
      Avfmin,
      fyi,
      Ms1,
      Ms2,
      fss,
      fbg,
      bs,
      smaxCr,
      needCr,
      Mfat,
      vfat: vf.v,
      dfat,
      fmin,
      dFTH,
      gFat: I.gFat || 1.5,
    };
    res.push(r);
    return r;
  };

  const xs: Array<[number, string]> = (
    [
      [0, 'Gối'],
      [xv, 'v'],
      [Ls / 8, 'Ls/8'],
      [Ls / 4, 'Ls/4'],
      [(3 * Ls) / 8, '3Ls/8'],
      [Ls / 2, 'Ls/2'],
    ] as Array<[number, string]>
  ).sort((p, q) => p[0] - q[0]);
  xs.forEach(([xx, t]) => one(xx / 1000, t));

  const rvv = res.find((r) => r.tag === 'v');
  const T0 = rvv
    ? Math.max(0, Math.abs(rvv.Vu) / 0.9 - 0.5 * rvv.Vs2) / Math.tan((rvv.th * PI) / 180)
    : 0;

  // ---------- deflection ----------
  const rm = res[res.length - 1];
  const IeOf = (Ma: number, Igr: number, Icr: number, yt: number) => {
    const Mcr_ = (fr * Igr) / yt / 1e6;
    const r = Ma > 0 ? Math.min(1, (Mcr_ / Ma) ** 3) : 1;
    return { Mcr: Mcr_, Ie: Math.min(Igr, r * Igr + (1 - r) * Icr), r };
  };
  const ie1 = IeOf(rm.Ms1, g1.I, cr1.I, g1.yb);
  const ie2 = IeOf(rm.Ms, gc.I, cr2.I, gc.yb);
  const EI1 = Ec * ie1.Ie * 1e-9;
  const EIc = Ec * ie2.Ie * 1e-9;
  const d5 = (w: number, EI: number): number => ((5 * w * Lm ** 4) / (384 * EI)) * 1000;
  const dDL1 = d5(DC1 + DC2 + DC3, EI1);
  const dDL2 = d5(DC4 + DW, EIc);
  const lam = Math.max(1.6, 3 - 1.2 * (As > 0 ? Asc / As : 0));
  const dLT = lam * (dDL1 + dDL2);
  const dmid = (Pk: number, a: number): number => {
    const aa = Math.min(a, Lm - a);
    return aa <= 0 ? 0 : (Pk * aa * (3 * Lm * Lm - 4 * aa * aa)) / (48 * EIc);
  };
  let dtr = 0;
  for (let p0 = -9; p0 <= Lm + 9; p0 += 0.01) {
    const d = truck.reduce(
      (t, [off, Pk]) => t + (p0 + off >= 0 && p0 + off <= Lm ? dmid(Pk, p0 + off) : 0),
      0,
    );
    dtr = Math.max(dtr, d);
  }
  const DFd = (I.nL * mOfMultiPresence(I.nL)) / Ng;
  const dlane = (5 * 9.3 * Lm ** 4) / (384 * EIc);
  const dLL1 = DFd * (1 + IM) * dtr * 1000;
  const dLL2 = DFd * (0.25 * (1 + IM) * dtr + dlane) * 1000;
  const dlim = Ls / (I.WPL > 0 ? Math.max(I.dlim, 1000) : I.dlim);
  const camber = {
    dcr: 0,
    dDeck: dDL1 + dDL2,
    dDL1,
    dDL2,
    lam,
    dLT,
    dtr: dtr * 1000,
    dlane: dlane * 1000,
    dLL1,
    dLL2,
    DFd,
    mL: mOfMultiPresence(I.nL),
    lim: dlim,
    ie1,
    ie2,
    EI1,
    EIc,
  };

  // ---------- shrinkage ----------
  const fci = 0.8 * fc;
  const VS = (Aout - voids.reduce((t, v) => t + rcAb(v[2]), 0)) / (2 * H + G.bd + G.bt);
  const ks = Math.max(1, 1.45 - 0.0051 * VS);
  const khs = 2.0 - 0.014 * (I.RH || 80);
  const kf = 35 / (7 + fci);
  const ktd = (t: number): number => t / ((12 * (100 - 0.58 * fci)) / (0.145 * fci + 20) + t);
  const t0 = 7;
  const eshT = (t: number): number => ks * khs * kf * ktd(Math.max(0, t - t0)) * 0.48e-3;
  const eSh = Math.max(0, eshT(I.tf || 10950) - eshT(I.td || 60));

  // ---------- thermal gradient ----------
  const TG = (() => {
    const al = I.alpha || 10.8e-6;
    const Ht = H + hs;
    const A = Ht >= 400 ? 300 : Ht - 100;
    const Tz = (d: number, T1: number, T2: number): number =>
      d <= 100 ? T1 + ((T2 - T1) * d) / 100 : d <= 100 + A ? (T2 * (100 + A - d)) / A : 0;
    const sig = (T1: number, T2: number) => {
      const dy = 2;
      const sl: Array<{ y: number; b: number; E: number; T: number }> = [];
      let EA = 0;
      let ES = 0;
      for (let y = dy / 2; y < Ht; y += dy) {
        const dk = y > H;
        const bw = dk ? beff : rcWAt(P, voids, y);
        const E = dk ? Ecs : Ec;
        const T = Tz(Ht - y, T1, T2);
        sl.push({ y, b: bw, E, T });
        EA += E * bw * dy;
        ES += E * bw * dy * y;
      }
      const yc = ES / EA;
      let EI = 0;
      let N = 0;
      let M = 0;
      sl.forEach((q) => {
        EI += q.E * q.b * dy * (q.y - yc) ** 2;
        N += q.E * q.b * dy * al * q.T;
        M += q.E * q.b * dy * al * q.T * (q.y - yc);
      });
      return { T1, T2, A, yc, e0: N / EA, kap: M / EI };
    };
    return { pos: sig(I.TGp[0], I.TGp[1]), neg: sig(I.TGn[0], I.TGn[1]), g: I.gTG, al };
  })();

  const r0 = res[0];
  const Rg = { DC: ((DC1 + DC2 + DC3 + DC4) * Lm) / 2, DW: (DW * Lm) / 2, LL: r0.VLL };

  return {
    type: 'RC',
    kind: edge ? 'bien' : 'giua',
    H,
    P,
    voids,
    hs,
    hsw,
    beff,
    ed,
    xdk,
    g1,
    gc,
    gG,
    Ec,
    Ecs,
    ncs,
    n,
    fy,
    fu,
    fyv,
    fr,
    g1f,
    g3,
    As,
    Asc,
    bars,
    bot,
    dc,
    sbar,
    yT,
    loads,
    DF,
    IM,
    IF,
    face,
    xv,
    dv: dvF,
    T0,
    flC,
    flN,
    cr1,
    cr2,
    bvAt,
    bvi,
    res,
    camber,
    EIc,
    Lm,
    Ls,
    L: Lt,
    a0,
    Rg,
    eSh,
    TG,
    shrRC: { VS, ks, khs, kf, fci, t0, td: I.td, tf: I.tf, eSh },
    eta,
    vol: (Aout - voids.reduce((t, v) => t + rcAb(v[2]), 0)) * Lt * 1e-9,
    jointTot: (S * H - AoutG) * 1e-6,
    Aout,
    AoutG,
    hC,
    Mfat: rm.Mfat,
  };
}

export const RCG = {
  RC_LIB,
  RC_GRV,
  levels: rcLevels,
  outline: rcOutline,
  pprops: rcPprops,
  chords: rcChords,
  wAt: rcWAt,
  gross: rcGross,
  fibers: rcFibers,
  flex: rcFlex,
  crk: rcCrk,
  calc: rcCalc,
  b1Of: rcB1Of,
  mL: mOfMultiPresence,
};

export function evalRcgSummary(R: RcCalcResult): { items: RcSummaryItem[]; okAll: boolean } {
  const F = (v: number, d = 2): string => fx(v, d);
  const res = R.res;
  const resV = res.filter((r) => r.x >= R.xv / 1000 - 1e-6);
  const cr = res.filter((r) => r.x > 1e-6);
  const rm = res[res.length - 1];
  const r0 = res.find((r) => r.tag === 'v') || res[1];
  const C = R.camber;
  const dLL = Math.max(C.dLL1, C.dLL2);
  const okD = dLL <= C.lim;

  const items: RcSummaryItem[] = [
    [
      'Sức kháng uốn - giai đoạn thi công (Mr,I ≥ Mu,I)',
      cr.every((r) => r.Mr1 >= r.Mu1),
      `max Mu,I/Mr,I = ${F(Math.max(...cr.map((r) => r.Mu1 / r.Mr1)), 3)}`,
    ],
    [
      'Sức kháng uốn - giai đoạn khai thác (Mr ≥ Mu)',
      cr.every((r) => r.Mr >= r.Mu),
      `Mu = ${F(rm.Mu, 2)} ; Mr = ${F(rm.Mr, 2)} kN.m (giữa nhịp)`,
    ],
    ['Lượng cốt thép tối thiểu (Điều 7.3.3)', cr.every((r) => r.Mr >= r.Mmin - 1e-9), ''],
    [
      'Sức kháng cắt (Vr ≥ Vu), cự ly cốt đai',
      res
        .filter((r) => r.x >= R.xv / 1000 - 1e-6)
        .every((r) => r.Vr >= r.Vu && r.s <= r.smax + 1e-9),
      `tại x = dv: Vu = ${F(r0.Vu, 2)} ; Vr = ${F(r0.Vr, 2)} kN`,
    ],
    [
      'Cốt thép dọc chịu cắt và uốn (Điều 8.3.5)',
      resV.every((r) => r.Tprov >= r.Treq) && (R.As * R.fy) / 1e3 >= R.T0,
      '',
    ],
    [
      'Truyền lực cắt qua mặt tiếp xúc dầm - bản (Điều 8.4)',
      resV.every((r) => r.Vri >= r.Vui && r.Avf >= r.Avfmin - 1e-9),
      `max Vui = ${F(Math.max(...resV.map((r) => r.Vui)), 1)} ; Vri = ${F(Math.min(...resV.map((r) => r.Vri)), 1)} N/mm`,
    ],
    [
      'Kiểm soát nứt (Điều 7.3.4)',
      res.every((r) => r.fss <= 0.6 * R.fy && (!r.needCr || R.sbar <= r.smaxCr)),
      `fss = ${F(rm.fss, 1)} MPa ; s = ${F(R.sbar, 0)} ≤ smax = ${Number.isFinite(rm.smaxCr) ? F(rm.smaxCr, 0) : '-'} mm`,
    ],
    [
      'Mỏi cốt thép (Điều 5.3.2)',
      res.every((r) => r.gFat * r.dfat <= r.dFTH),
      `γ.Δf = ${F(rm.gFat * rm.dfat, 1)} ≤ ${F(rm.dFTH, 1)} MPa`,
    ],
    ['Độ võng do hoạt tải (TCVN 11823-2, Điều 5.2.6.2)', okD, `${F(dLL, 2)} ≤ ${F(C.lim, 2)} mm`],
  ];

  const okAll = items.every((i) => i[1]);
  R.items = items;
  R.okAll = okAll;
  return { items, okAll };
}

// ============================================================================
// State & Superstructure Runners / Linkers
// ============================================================================

export let DAMR: DamCompositeResult | null = null;
export let RCGR: DamCompositeResult | null = null;
export let LIMcur: DamLimits | null = null;
let GITAG = false;

export function getLatestDamResult(): DamCompositeResult | null {
  return DAMR;
}

export function setLatestDamResult(result: DamCompositeResult | null): void {
  DAMR = result;
}

export function getLatestRcgResult(): DamCompositeResult | null {
  return RCGR;
}

export function setLatestRcgResult(result: DamCompositeResult | null): void {
  RCGR = result;
}

export function getLatestLim(): DamLimits | null {
  return LIMcur;
}

export function setLatestLim(lim: DamLimits | null): void {
  LIMcur = lim;
}

export const spV = (id: string): number => num(id);

export function pair(id: string, d: readonly [number, number]): [number, number, number] {
  const el = $(id);
  const raw = el ? String(el.value ?? '') : '';
  const a = raw
    .replace(/,(?=\d)/g, '.')
    .split(/[;\s]+/)
    .map(Number)
    .filter(Number.isFinite);
  return [a[0] ?? d[0], a[1] ?? d[1], 0];
}

export function ptsOf(id: string): number[][] {
  const el = $(id);
  return nums(el ? String(el.value ?? '') : '');
}

const giTxt = (id: string): string => {
  const el = $(id);
  return el ? String(el.value ?? '') : '';
};

export function supK(options?: GirderHollowStepOptions): boolean {
  const hooks = resolveHooks(options);
  if (hooks.supK) return hooks.supK();
  const e = $('sp_sup');
  return !!e && e.value === 'K';
}

export function spType(options?: GirderHollowStepOptions): SpSuperstructureType {
  const hooks = resolveHooks(options);
  if (hooks.spType) return hooks.spType();
  const e = $('sp_type');
  return e && e.value === 'I' ? 'I' : e && e.value === 'RC' ? 'RC' : 'BR';
}

export function spBRsync(options?: GirderHollowStepOptions): void {
  const hooks = resolveHooks(options);
  if (hooks.spBRsync) {
    hooks.spBRsync();
    return;
  }
  const Ng = $('sp_Ng');
  const S = $('sp_S');
  if (!Ng || !S) return;
  const lock = (
    e: NonNullable<ReturnType<typeof $>>,
    on: boolean,
    t?: string,
  ): void => {
    e.readOnly = on;
    e.classList?.toggle('lnk', on);
    e.title = on && t ? t : '';
  };
  if (spType(options) !== 'BR') {
    lock(Ng, false);
    lock(S, false);
    return;
  }
  const ddEl = $('gg_dd');
  const xs = nums(String(ddEl?.value ?? ''))
    .filter((a) => a.length >= 2)
    .map((a) => a[0]);
  if (xs.length < 3) return;
  const w = Math.max(...xs) - Math.min(...xs);
  const Sv = (Math.round((w + 10) / 50) * 50) / 1000;
  const Wb = num('sp_Wb');
  const n = Math.max(2, Math.round(Wb / Sv));
  if (Math.abs(num('sp_S') - Sv) > 1e-9) S.value = String(Sv);
  if (+Ng.value !== n) Ng.value = String(n);
  const t =
    'Dầm bản: tự tính theo mặt cắt ngang - S = bề rộng tấm dầm giữa (kể cả khe nối), Nb = Wb/S';
  lock(Ng, true, t);
  lock(S, true, t);
  const e = $('o_spBR');
  if (e) {
    e.textContent =
      `Dầm bản: bề rộng tấm ${fx(w, 0)} mm + khe nối → S = ${fx(Sv, 2)} m ; Nb = Wb/S = ${fx(Wb, 2)}/${fx(Sv, 2)} = ${n} dầm` +
      (Math.abs(n * Sv - Wb) > 0.02
        ? ` (n.S = ${fx(n * Sv, 2)} m ≠ Wb, kiểm tra lại bề rộng cầu)`
        : '');
  }
}

export function spTypeApply(options?: GirderHollowStepOptions): void {
  const hooks = resolveHooks(options);
  if (hooks.spTypeApply) {
    hooks.spTypeApply();
    return;
  }
  const t = spType(options);
  if (typeof document !== 'undefined') {
    document.querySelectorAll<HTMLElement>('[data-sp]').forEach((e) => {
      if (e.dataset.np0 == null) e.dataset.np0 = e.classList.contains('noprint') ? '1' : '0';
      const on = String(e.dataset.sp).split(/\s+/).includes(t);
      e.hidden = !on;
      e.toggleAttribute('hidden', !on);
      e.classList.toggle('noprint', !on || e.dataset.np0 === '1');
    });
    document.body.classList.toggle('spI', t === 'I');
    document.body.classList.toggle('spRC', t === 'RC');
  }
  const h = $('sp_hm');
  if (h && t === 'I' && /dầm bản/i.test(String(h.value || ''))) {
    h.value = String(h.value)
      .replace(/dầm bản( rỗng)?/i, 'dầm I BTCT DƯL')
      .replace(/L = \d+(\.\d+)? m/, 'L = ' + (spV('sp_Lt') || 33) + ' m');
  }
}

export function giTag(options?: GirderHollowStepOptions): void {
  const hooks = resolveHooks(options);
  if (hooks.giTag) {
    hooks.giTag();
    return;
  }
  if (GITAG) return;
  GITAG = true;
  if (typeof document === 'undefined') return;
  const t8 = document.getElementById('tab8');
  const t9 = document.getElementById('tab9');
  if (t8) {
    let on = false;
    for (const e of [...t8.children]) {
      const el = e as HTMLElement;
      if (el.id === 'sp_err') break;
      if (!on && el.tagName === 'H2' && /^2\./.test((el.textContent || '').trim()) && !el.dataset.sp) {
        on = true;
      }
      if (on && !el.dataset.sp && el.id !== 'giMk8') el.dataset.sp = 'BR';
    }
  }
  if (t9) {
    [...t9.children].forEach((e) => {
      const el = e as HTMLElement;
      if (el.tagName === 'H1' || el.dataset.sp || el.classList.contains('giDyn')) return;
      el.dataset.sp = 'BR';
    });
  }
}

export function spInputs(options?: GirderHollowStepOptions): DamSpInput {
  const Wb = spV('sp_Wb');
  const Wpa = spV('sp_Wpa');
  const WPL = spV('sp_WPL') || 0;
  const W = Wb - 2 * Wpa - 2 * WPL;
  const nL = W >= 6 && W <= 7.2 ? 2 : Math.max(1, Math.floor(W / 3.6 + 1e-9));
  const useK = supK(options);
  const out: DamSpInput = {
    WPL,
    skew: spV('sp_skew') || 0,
    APL: spV('sp_APL') || 0,
    qPL: spV('sp_qPL') || 3,
    Lt: spV('sp_Lt'),
    a0: spV('sp_a0'),
    bg: useK
      ? 2 * Math.max(0, Math.min(spV('sp_bk1'), spV('sp_bk2')) - spV('sp_a0'))
      : (spV('gc_L') || 150) / 1000,
    sup: useK ? 'K' : 'G',
    bk1: spV('sp_bk1'),
    bk2: spV('sp_bk2'),
    tpad: spV('sp_tpad') || 0.02,
    Gpad: spV('sp_Gpad') || 1000,
    mupad: spV('sp_mupad') || 0.6,
    fck: spV('sp_fck') || 30,
    Ng: Math.max(1, Math.round(spV('sp_Ng'))),
    S: spV('sp_S'),
    Wb,
    Wpa,
    W,
    nL,
    Hpa: spV('sp_Hpa'),
    Apa: spV('sp_Apa'),
    Pra: spV('sp_Pra'),
    hs: spV('sp_hs'),
    hwear: spV('sp_hw'),
    Hsu: spV('sp_Hsu'),
    gsu: spV('sp_gsu'),
    DWu: spV('sp_DWu'),
    curbMode: String($('sp_curb')?.value ?? ''),
    IM: spV('sp_IM'),
    gc: spV('sp_gc'),
    K1: spV('sp_K1') || 1,
    fc: spV('sp_fc'),
    fci: spV('sp_fci'),
    fcs: spV('sp_fcs'),
    db: spV('sp_db'),
    Ap1: spV('sp_Ap1'),
    fpu: spV('sp_fpu'),
    fpyr: spV('sp_fpyr'),
    fpjr: spV('sp_fpjr'),
    Ep: spV('sp_Ep'),
    fy: spV('sp_fy'),
    Es: spV('sp_Es'),
    RH: spV('sp_RH'),
    ti: spV('sp_ti'),
    tcur: spV('sp_tcur'),
    td: spV('sp_td'),
    tf: spV('sp_tf'),
    exp: String($('sp_exp')?.value ?? ''),
    ifc: String($('sp_ifc')?.value ?? 'N'),
    gLL3: spV('sp_gLL3'),
    dlim: spV('sp_dlim') || 800,
    kps: 2 * (1.04 - spV('sp_fpyr')),
    a1: 0.85,
    g1: parseFloat(String($('sp_g1')?.value ?? '')) || 1.6,
    g2: 1.1,
    g3: 1.0,
    gFat: 1.5,
    IMf: 0.15,
    hook: spV('sp_hook'),
    kdyn: spV('sp_kdyn'),
    TGp: pair('sp_TGp', [23, 6]),
    TGn: pair('sp_TGn', [-7, -1]),
    gTG: spV('sp_gTG'),
    alpha: spV('sp_alpha') || 10.8e-6,
  };

  try {
    const X = spXF(out);
    out.XF = X.XF;
    out.hsxG = X.hsxG;
    out.hsxB = X.hsxB;
    out.Atd = X.g.Atd;
    out.gpl = X.XF.gpl;
  } catch {
    out.hsxG = 0;
    out.hsxB = 0;
  }
  return out;
}

export function girderInputs(k: 'g' | 'b'): DamGirderInput {
  const dd: Point2D[] = ptsOf(`g${k}_dd`).map((a) => [a[0], a[1]]);
  const cc: Point2D[] = ptsOf(`g${k}_cc`).map((a) => [a[0], a[1]]);
  const voids: DamVoid[] = ptsOf(`g${k}_vd`)
    .filter((a) => a.length >= 3)
    .map((a): DamVoid =>
      a.length >= 5
        ? [a[0], a[1], a[2], a[3], a[4]]
        : a.length === 4
          ? [a[0], a[1], a[2], a[3], 0]
          : [a[0], a[1], a[2]],
    );
  const stRaw = String($(`g${k}_st`)?.value ?? '');
  const st: DamStrand[] = stRaw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !/^[#\/]/.test(l))
    .map((l) => l.replace(/,(?=\d)/g, '.').split(/[\s;\t]+/))
    .filter((a) => a.length >= 5)
    .map((a): DamStrand => [+a[0], a[1], +a[2], +a[3], +a[4]])
    .filter((a) => a.every((val, i) => i === 1 || Number.isFinite(val)));
  const zones: Array<[number, number, number]> = ptsOf(`g${k}_sz`)
    .filter((a) => a.length >= 3)
    .map((a) => [a[0], a[1], a[2]]);
  const solEl = $(`g${k}_sol`);
  const solids: Array<[number, number]> = solEl
    ? nums(String(solEl.value ?? ''))
        .filter((q) => q.length >= 2)
        .map((q) => [q[0], q[1]])
    : [];

  return {
    kind: k === 'g' ? 'giua' : 'bien',
    H: spV(`g${k}_H`),
    dd,
    cc,
    voids,
    Lend: spV(`g${k}_Le`),
    Lmid: spV(`g${k}_Lm`) || 0,
    solids,
    strands: st,
    stir: { name: 'S1', d: spV(`g${k}_sd`), legs: spV(`g${k}_sn`), zones },
    conn: { name: 'C1', d: spV(`g${k}_cd`), legs: spV(`g${k}_cn`) },
    de:
      k === 'b'
        ? (spV('sp_Wb') / 2 - spV('sp_Wpa') - (spV('sp_WPL') || 0)) * 1000 -
          (((Math.max(1, Math.round(spV('sp_Ng'))) - 1) / 2) * spV('sp_S') * 1000 + spV('gb_eW'))
        : 0,
    anN: spV(`g${k}_anN`),
    anD: spV(`g${k}_anD`),
    anS: spV(`g${k}_anS`),
    nTop: spV(`g${k}_nTop`),
    dTop: spV(`g${k}_dTop`),
    ddRef: ptsOf('gg_dd').map((a) => [a[0], a[1]]),
  };
}

export function damLoadLib(
  libKeyOrOptions?: DamLibKey | GirderHollowStepOptions,
  maybeOptions?: GirderHollowStepOptions,
): void {
  const keyArg = typeof libKeyOrOptions === 'string' ? libKeyOrOptions : undefined;
  const opts = typeof libKeyOrOptions === 'object' ? libKeyOrOptions : maybeOptions;
  const hooks = resolveHooks(opts);
  const libVal = keyArg ?? (String($('sp_lib')?.value ?? '') as DamLibKey);
  const L = DAM.LIB[libVal];
  if (!L) return;
  const ln = (a: ReadonlyArray<readonly (string | number)[]>): string =>
    a.map((q) => q.join(' ')).join('\n');
  const setVal = (id: string, val: string | number): void => {
    const el = $(id);
    if (el) el.value = String(val);
  };
  setVal('sp_Lt', L.Lt);
  setVal('sp_a0', L.a0);
  if (L.hook != null) setVal('sp_hook', L.hook);
  if (L.fci != null) setVal('sp_fci', L.fci);
  if (L.hm) setVal('sp_hm', L.hm);
  for (const k of ['g', 'b'] as const) {
    if (L.anN != null) setVal(`g${k}_anN`, L.anN);
    if (L.anD != null) setVal(`g${k}_anD`, L.anD);
    const G = L[k === 'g' ? 'giua' : 'bien'];
    setVal(`g${k}_dd`, ln(G.dd));
    setVal(`g${k}_cc`, ln(G.cc));
    setVal(`g${k}_vd`, ln(L.voids));
    setVal(`g${k}_st`, ln(L.strands));
    setVal(`g${k}_sz`, ln(L.stir.zones));
    setVal(`g${k}_H`, L.H);
    setVal(`g${k}_Le`, L.Lend);
    setVal(`g${k}_Lm`, L.Lmid);
    setVal(`g${k}_sol`, (L.solids || []).map((q) => q.join(' ')).join('\n'));
    setVal(`g${k}_sd`, L.stir.d);
    setVal(`g${k}_sn`, L.stir.legs);
    setVal(`g${k}_cd`, L.conn.d);
    setVal(`g${k}_cn`, L.conn.legs);
  }
  hooks.saveAll?.();
  hooks.run?.();
}

export function damLink(options?: GirderHollowStepOptions): boolean | undefined {
  const hooks = resolveHooks(options);
  if (objLinkOff()) {
    objUnlock();
    return false;
  }
  try {
    xfLink();
  } catch (e) {
    console.error(e);
  }
  let supCh = false;
  try {
    supCh = hooks.supLink ? hooks.supLink() : false;
  } catch (e) {
    console.error(e);
  }
  if ((DAMR && DAMR.type === 'I') || (spType(options) === 'I' && !DAMR?.g)) {
    const giCh = hooks.giLink ? hooks.giLink() : false;
    const resChanged = giCh || supCh;
    if (resChanged) {
      hooks.moLink?.();
      hooks.trLink?.();
    }
    return resChanged;
  }
  if (!DAMR || !DAMR.g) return undefined;
  const I = DAMR.I;
  const g = DAMR.g as { vol: number; jointTot: number; H: number };
  const b = (DAMR.b || g) as { vol: number; jointTot: number; H: number };
  const Vg = (2 * b.vol + (I.Ng - 2) * g.vol) / Math.max(1, I.Ng);
  const Ad = I.Wb * I.hs + (I.Ng - 1) * g.jointTot;
  const map: Record<string, string | number> = {
    mo_Lt: I.Lt,
    mo_a0: I.a0,
    mo_Ng: I.Ng,
    mo_Sg: I.S,
    mo_Sb: I.S,
    mo_Wb: I.Wb,
    mo_Wpat: I.Wpa,
    mo_Wpap: I.Wpa,
    mo_WPLt: I.WPL,
    mo_WPLp: I.WPL,
    mo_APL: I.APL,
    mo_qPL: I.qPL,
    mo_Hpa: I.Hpa,
    mo_Apa: I.Apa,
    mo_Hra: spV('sp_Hra'),
    mo_Pra: I.Pra,
    mo_Hsu: I.Hsu,
    mo_gsuT: +(I.gsu / 9.81).toFixed(4),
    mo_gcT: +(I.gc / 9.81).toFixed(4),
    mo_IM: I.IM,
    mo_Vg: +Vg.toFixed(4),
    mo_Ad: +Ad.toFixed(4),
    mo_Hd: I.hs,
    mo_Hg: g.H / 1000,
    mo_Vk: 0,
  };
  let changed = false;
  for (const [id, val] of Object.entries(map)) {
    const e = $(id);
    if (!e) continue;
    const sv = String(val);
    if (e.value !== sv) {
      e.value = sv;
      changed = true;
    }
    e.readOnly = true;
    e.classList?.add('lnk');
    e.title = 'Lấy từ sheet kiểm toán dầm (mục 1 - số liệu thiết kế)';
  }
  const gtv = DAMR.type === 'RC' ? 'R' : 'B';
  const gt = $('mo_gtype');
  if (gt && gt.value !== gtv) {
    gt.value = gtv;
    changed = true;
  }
  const dt = $('mo_dtype');
  if (dt) {
    const val = I.Hsu > 0 ? 'C' : 'D';
    if (dt.value !== val) {
      dt.value = val;
      changed = true;
    }
  }
  if (typeof document !== 'undefined' && !$('moLnkNote')) {
    const h = [...document.querySelectorAll('#tab4 h3')].find((e) =>
      /Kết cấu phần trên/.test(e.textContent || ''),
    );
    if (h) {
      const d = document.createElement('p');
      d.id = 'moLnkNote';
      d.className = 'small noprint lnknote';
      d.textContent =
        'Các số liệu nền xanh nhạt được lấy tự động từ sheet kiểm toán dầm (Vg, Ad tính theo hình học dầm giữa, dầm biên và khe nối); sửa tại sheet dầm giữa, mục 1.';
      h.after(d);
    }
  }
  const outChanged = changed || supCh;
  hooks.moLink?.();
  hooks.trLink?.();
  return outChanged;
}

export function rcgInputs(): RcInput {
  const valOf = (id: string): number => num(id);
  const rows = (id: string): number[][] => nums(giTxt(id));
  const H = valOf('rc_h1') + valOf('rc_h2') + valOf('rc_h3') + valOf('rc_h4') + valOf('rc_h5');
  const gr = +(($('rc_gr')?.value as string | undefined) || 400);
  const fu = ({ 300: 450, 400: 570, 500: 650 } as Record<number, number>)[gr] || gr / 0.7;
  const grvKey = (($('rc_grv')?.value as string | undefined) || '240T') as RcGrvKey;
  const GV = RC_GRV[grvKey] || RC_GRV['240T'];
  const rd = (id: string, top: boolean): RcBarInput[] =>
    rows(id)
      .filter((a) => a.length >= 3 && a[0] > 0 && a[1] > 0)
      .map((a) => ({ n: Math.round(a[0]), d: a[1], y: top ? H - a[2] : a[2], top }));
  const bars = [...rd('rc_bars', false), ...rd('rc_tbars', true)];
  const bE = [...rd('rc_barsE', false), ...rd('rc_tbarsE', true)];
  const eD = valOf('rc_etaD') || 1;
  const eR = valOf('rc_etaR') || 1;
  const eI = valOf('rc_etaI') || 1;

  return {
    h1: valOf('rc_h1'),
    h2: valOf('rc_h2'),
    h3: valOf('rc_h3'),
    h4: valOf('rc_h4'),
    h5: valOf('rc_h5'),
    H,
    bt: valOf('rc_bt'),
    b3: valOf('rc_b3') || valOf('rc_bt'),
    bd: valOf('rc_bd'),
    bdE: valOf('rc_bdE') || valOf('rc_bd'),
    voids: rows('rc_vd')
      .filter((a) => a.length >= 3 && a[2] > 0)
      .map((a): [number, number, number] => [a[0], a[1], a[2]]),
    bars,
    barsE: bE.some((b) => !b.top) ? bE : [],
    sbar: valOf('rc_sbar'),
    fy: gr,
    fu,
    grT: 'CB' + gr + '-V',
    fyv: GV[0],
    fuv: GV[1],
    grvT: GV[2],
    sd: valOf('rc_sd'),
    sn: Math.max(1, Math.round(valOf('rc_sn'))),
    sz: rows('rc_sz').filter((a) => a.length >= 3 && a[2] > 0),
    cd: valOf('rc_cd'),
    cn: Math.max(0, Math.round(valOf('rc_cn'))),
    ag: valOf('rcg_ag') || 20,
    ge: +(($('rc_ge')?.value as string | undefined) || 1),
    etaD: eD,
    etaR: eR,
    etaI: eI,
    eta: Math.max(0.95, eD * eR * eI),
  };
}

export function rcgLoadLib(options?: GirderHollowStepOptions): void {
  const hooks = resolveHooks(options);
  const L = RC_LIB['868'];
  const setVal = (id: string, val: string | number): void => {
    const e = $(id);
    if (e) e.value = String(val);
  };
  Object.entries(L.sp).forEach(([k, val]) => setVal(k, val));
  Object.entries(L.rc).forEach(([k, val]) => setVal(k, val));
  hooks.saveAll?.();
  hooks.run?.();
}

export function rcgMount(pane: string, afterEl: Element | null, html: string): void {
  if (typeof document === 'undefined') return;
  const p = document.getElementById(pane);
  if (!p) return;
  p.querySelectorAll(':scope > .giDyn').forEach((e) => e.remove());
  const t = document.createElement('template');
  t.innerHTML = html;
  const nodes = [...t.content.children];
  nodes.forEach((n) => {
    const el = n as HTMLElement;
    el.classList.add('giDyn');
    el.dataset.sp = 'RC';
    el.dataset.np0 = '0';
  });
  if (afterEl && afterEl.parentNode === p) {
    const ref = afterEl.nextSibling;
    nodes.forEach((n) => p.insertBefore(n, ref));
  } else {
    nodes.forEach((n) => p.appendChild(n));
  }
}

export function rcgStep(
  I?: DamSpInput,
  LIM?: DamLimits,
  options?: GirderHollowStepOptions,
): DamCompositeResult | undefined {
  const err = $('sp_err');
  if (err) err.textContent = '';
  const effI = I ?? spInputs(options);
  const effLIM = LIM ?? evalDamLimits(effI);
  LIMcur = effLIM;

  let G0: RcInput;
  try {
    G0 = rcgInputs();
  } catch (e) {
    if (err) err.textContent = 'Lỗi đọc số liệu dầm bản BTCT: ' + (e as Error).message;
    return undefined;
  }
  const hOut = $('o_rc_H');
  if (hOut) hOut.textContent = fx(G0.H, 0);
  if (!(G0.H > 0) || !G0.bars.some((b) => !b.top) || !G0.sz.length || !(G0.bd > 0 && G0.bt > 0)) {
    if (err) {
      err.textContent = 'Thiếu số liệu kích thước / cốt thép dọc / cốt đai của dầm bản BTCT.';
    }
    return undefined;
  }

  const RR: Partial<Record<'g' | 'b', RcCalcResult>> = {};
  for (const k of ['g', 'b'] as const) {
    try {
      const resRc = RCG.calc(effI, G0, k, options);
      evalRcgSummary(resRc);
      RR[k] = resRc;
    } catch (e) {
      console.error(e);
      if (err) err.textContent = 'Lỗi tính dầm bản BTCT: ' + (e as Error).message;
      return undefined;
    }
  }

  const gRes = RR.g!;
  const bRes = RR.b!;
  const GG = {
    g: {
      dd: gRes.P,
      voids: gRes.voids,
      H: G0.H,
      noJoint: false,
      lbl: G0.voids.length ? 'dầm bản rỗng BTCT' : 'dầm bản BTCT',
    },
    b: {
      dd: bRes.P,
      voids: bRes.voids,
      H: G0.H,
      noJoint: false,
      de: bRes.DF.de,
    },
  };
  const out: DamCompositeResult = {
    I: effI,
    LIM: effLIM,
    type: 'RC',
    g: gRes,
    b: bRes,
    GG,
    G0,
  };
  RCGR = out;
  DAMR = out;
  spTypeApply(options);
  damLink(options);

  const visualHooks = getVisualHooks();
  visualHooks.renderGirderHollow?.({ result: out });
  visualHooks.renderMath?.();
  return out;
}

export function damStep(options?: GirderHollowStepOptions): DamCompositeResult | undefined {
  const hooks = resolveHooks(options);
  try {
    spBRsync(options);
  } catch (e) {
    console.error(e);
  }
  const err = $('sp_err');
  if (err) err.textContent = '';

  let I: DamSpInput;
  try {
    I = spInputs(options);
  } catch {
    return undefined;
  }

  {
    const e = $('o_sp_xf');
    if (e) {
      e.textContent =
        I.gpl === 'bang'
          ? `Dầm đặt bằng: đỉnh các dầm cùng cao độ (bằng đáy bản tại dầm biên thấp hơn), dốc ngang tạo trên mặt trên bản mặt cầu. Bản dày thêm trung bình trên bề rộng phụ trách: dầm giữa (bất lợi nhất) ${fx((I.hsxG || 0) * 1000, 0)} mm, dầm biên ${fx((I.hsxB || 0) * 1000, 0)} mm - đã cộng vào tĩnh tải bản mặt cầu DC2 ; tổng diện tích phần dày thêm ${fx(I.Atd || 0, 4)} m²/m. Dốc ngang, bố trí dầm liên kết sang sheet mố, trụ.`
          : 'Dầm đặt chênh cao theo dốc ngang, bản mặt cầu dày đều. Dốc ngang, bố trí dầm liên kết sang sheet mố, trụ.';
    }
  }

  const setOut = (id: string, val: number | string, d = 0): void => {
    const e = $(id);
    if (e) e.textContent = typeof val === 'number' ? fx(val, d) : val;
  };
  setOut('o_sp_Ls', I.Lt - 2 * I.a0, 2);
  setOut('o_sp_bg', I.bg, 3);
  setOut('o_sp_W', I.W, 2);
  setOut('o_sp_nL', I.nL, 0);
  const Ec = DAM.EcOf(I.fc, I.K1);
  const Eci = DAM.EcOf(I.fci, I.K1);
  const Ecs = DAM.EcOf(I.fcs, I.K1);
  setOut('o_sp_Ec', Ec, 0);
  setOut('o_sp_Eci', Eci, 0);
  setOut('o_sp_Ecs', Ecs, 0);
  setOut('o_sp_fr', 0.63 * Math.sqrt(I.fc), 2);
  setOut('o_sp_Pj', (I.fpjr * I.fpu * I.Ap1) / 1000, 2);

  const LIM = evalDamLimits(I);
  const tbSpLim = $('tbSpLim');
  if (tbSpLim) {
    tbSpLim.innerHTML =
      `<tr><th colspan="2">Giai đoạn</th><th colspan="4">Trường hợp</th><th colspan="2">Giới hạn</th><th>Trị số (MPa)</th></tr>` +
      (
        [
          ['Truyền lực', 'Ứng suất nén (Điều 9.4.1.1)', "0,60 f'ci", LIM.trC],
          [
            'Truyền lực',
            'Ứng suất kéo, không có cốt thép dính bám đủ chịu lực kéo (Bảng 7)',
            "0,25√f'ci ≤ 1,38",
            LIM.trT,
          ],
          [
            'Truyền lực',
            'Ứng suất kéo, có cốt thép dính bám chịu 0,5fy (Bảng 7)',
            "0,63√f'ci",
            LIM.trT2,
          ],
          ['Khai thác', 'Nén: DƯL + tải trọng thường xuyên (Bảng 8)', "0,45 f'c", LIM.svP],
          ['Khai thác', 'Nén: DƯL + thường xuyên + hoạt tải, Sử dụng I', "0,60 f'c", LIM.svI],
          [
            'Khai thác',
            'Kéo vùng chịu nén trước, Sử dụng III (Bảng 9)',
            I.exp === '2' ? "0,25√f'c ≤ 2,1" : "0,50√f'c ≤ 4,1",
            LIM.svT,
          ],
          ['Khai thác', "Nén bản mặt cầu: thường xuyên / Sử dụng I", "0,45 / 0,60 f'cs", LIM.dkP],
          ['Mỏi', '0,5(DƯL + thường xuyên) + Mỏi I (Điều 5.3.1)', "0,40 f'c", LIM.fat],
        ] as Array<[string, string, string, number]>
      )
        .map(
          (r) =>
            `<tr><td class="l" colspan="2">${r[0]}</td><td class="l" colspan="4">${r[1]}</td><td class="c" colspan="2">${r[2]}</td><td>${
              r[0] === 'Khai thác' && r[2].startsWith('0,45 /')
                ? fx(LIM.dkP, 2) + ' / ' + fx(LIM.dkI, 2)
                : fx(r[3], 2)
            }</td></tr>`,
        )
        .join('');
  }

  try {
    hooks.supApply?.();
  } catch (e) {
    console.error(e);
  }
  {
    const e = $('o_sp_ck');
    if (e) {
      e.textContent = fx(Math.max(0, Math.min(spV('sp_bk1'), spV('sp_bk2')) - spV('sp_a0')), 3);
    }
  }
  giTag(options);
  spTypeApply(options);

  const kind = spType(options);
  if (kind === 'I') {
    LIMcur = LIM;
    hooks.giStep?.(I, LIM);
    return undefined;
  }
  if (kind === 'RC') {
    LIMcur = LIM;
    return rcgStep(I, LIM, options);
  }

  const out: DamCompositeResult = { I, LIM };
  LIMcur = LIM;
  const GG: Record<string, DamGirderInput> = {};

  for (const k of ['g', 'b'] as const) {
    let G: DamGirderInput;
    try {
      G = girderInputs(k);
    } catch {
      continue;
    }
    if (G.dd.length < 3 || !G.strands.length || !G.voids.length || !G.stir.zones.length) {
      if (err) err.textContent = 'Thiếu số liệu hình học / cáp / cốt đai của dầm.';
      continue;
    }
    if (k === 'b' && out.g) {
      G.DFg = (out.g as DamCalcResult).DF;
    }
    let R: DamCalcResult;
    try {
      R = DAM.calc(I, G, options);
      evalDamSummary(R, I, LIM);
    } catch (e) {
      if (err) err.textContent = 'Lỗi tính dầm: ' + (e as Error).message;
      console.error(e);
      continue;
    }
    GG[k] = G;
    out[k] = R;
  }

  out.GG = GG;
  DAMR = out;
  damLink(options);

  const visualHooks = getVisualHooks();
  visualHooks.renderGirderHollow?.({ result: out });
  visualHooks.renderMath?.();
  return out;
}

export function bindGirderHollowEvents(options?: GirderHollowStepOptions): void {
  if (typeof document === 'undefined') return;
  const hooks = resolveHooks(options);
  const spLoad = document.getElementById('sp_load');
  if (spLoad) {
    spLoad.onclick = () => damLoadLib(options);
  }
  const giLoad = document.getElementById('gi_load');
  if (giLoad && hooks.giLoadLib) {
    giLoad.onclick = () => hooks.giLoadLib?.();
  }
  const spTypeEl = document.getElementById('sp_type');
  if (spTypeEl) {
    spTypeEl.addEventListener('change', () => {
      giTag(options);
      const t = spType(options);
      if (t === 'RC') {
        let f: string | null = null;
        try {
          f = localStorage.getItem('ckn_rc_init');
        } catch {
          f = null;
        }
        if (!f) {
          try {
            localStorage.setItem('ckn_rc_init', '1');
          } catch {
            // ignore storage errors
          }
          rcgLoadLib(options);
          return;
        }
      }
      if (t === 'I') {
        let f: string | null = null;
        try {
          f = localStorage.getItem('ckn_gi_init');
        } catch {
          f = null;
        }
        if (!f) {
          try {
            localStorage.setItem('ckn_gi_init', '1');
          } catch {
            // ignore storage errors
          }
          hooks.giLoadLib?.();
          return;
        }
      }
      spTypeApply(options);
      hooks.run?.();
    });
  }
}

// ============================================================================
// Canonical Result Converters (GirderBranchResult / GirderResult)
// ============================================================================

function toNumericRecord(obj: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(obj)) {
    if (typeof val === 'number') out[k] = val;
  }
  return out;
}

export function toHollowBranchResult(
  raw: DamCalcResult,
  dd?: Point2D[],
  I?: DamSpInput,
  LIM?: DamLimits,
): GirderBranchResult {
  if (raw.allOK == null && I) {
    evalDamSummary(raw, I, LIM ?? evalDamLimits(I));
  }
  return {
    kind: 'PC',
    Lm: raw.Lm,
    L: raw.L,
    Ls: raw.Ls,
    H: raw.H,
    Ec: raw.Ec,
    Eci: raw.Eci,
    Ecs: raw.Ecs,
    ncs: raw.ncs,
    vol: raw.vol,
    loads: toNumericRecord(raw.loads as unknown as Record<string, unknown>),
    DF: toNumericRecord(raw.DF as unknown as Record<string, unknown>),
    IM: raw.IM,
    Rg: { DC: raw.Rg.DC, DW: raw.Rg.DW },
    groups: { list: raw.groups, nstr: raw.nstr, lt: raw.lt },
    res: {
      sections: raw.res,
      mid: raw.res[raw.res.length - 1],
      xv: raw.xv,
      debond: raw.debond,
      lift: raw.lift,
      TG: raw.TG,
      items: raw.items,
    },
    camber: raw.camber as unknown as Record<string, unknown>,
    shr: raw.shr as unknown as Record<string, unknown>,
    anch: raw.anch as unknown as Record<string, unknown>,
    dd: dd ?? raw.res[0]?.P,
    okAll: raw.allOK,
  };
}

export function toRcBranchResult(raw: RcCalcResult): GirderBranchResult {
  if (raw.okAll == null) {
    evalRcgSummary(raw);
  }
  const fci = raw.shrRC.fci;
  const fcEst = fci > 0 ? fci / 0.8 : 30;
  const eci =
    DAM.EcOf(fcEst, 1) > 0 ? raw.Ec * (DAM.EcOf(fci, 1) / DAM.EcOf(fcEst, 1)) : DAM.EcOf(fci, 1);

  return {
    kind: 'RC',
    Lm: raw.Lm,
    L: raw.L,
    Ls: raw.Ls,
    H: raw.H,
    Ec: raw.Ec,
    Eci: eci,
    Ecs: raw.Ecs,
    ncs: raw.ncs,
    vol: raw.vol,
    loads: toNumericRecord(raw.loads),
    DF: toNumericRecord(raw.DF as unknown as Record<string, unknown>),
    IM: raw.IM,
    Rg: { DC: raw.Rg.DC, DW: raw.Rg.DW },
    groups: { bars: raw.bars, As: raw.As, Asc: raw.Asc },
    res: {
      sections: raw.res,
      mid: raw.res[raw.res.length - 1],
      xv: raw.xv,
      dv: raw.dv,
      T0: raw.T0,
      flC: raw.flC,
      flN: raw.flN,
      cr1: raw.cr1,
      cr2: raw.cr2,
      TG: raw.TG,
      items: raw.items,
    },
    camber: raw.camber as unknown as Record<string, unknown>,
    shr: raw.shrRC as unknown as Record<string, unknown>,
    dd: raw.P,
    okAll: raw.okAll,
  };
}

export function toHollowGirderResult(
  input: DamCompositeResult | DamCalcResult,
  edgeOverride?: DamCalcResult,
  spTypeOverride: GirderSystemType = 'PC',
): GirderResult {
  if ('g' in input && input.g) {
    const gRaw = input.g as DamCalcResult;
    const bRaw = (input.b as DamCalcResult | undefined) ?? gRaw;
    const gg = (input.GG || {}) as {
      g?: { dd?: Point2D[] };
      b?: { dd?: Point2D[] };
    };
    const gBranch = toHollowBranchResult(gRaw, gg.g?.dd, input.I, input.LIM);
    const bBranch = toHollowBranchResult(bRaw, gg.b?.dd, input.I, input.LIM);
    return {
      spType: spTypeOverride,
      g: gBranch,
      b: bBranch,
    };
  }
  const gRaw = input as DamCalcResult;
  const gBranch = toHollowBranchResult(gRaw);
  const bBranch = edgeOverride ? toHollowBranchResult(edgeOverride) : gBranch;
  return {
    spType: spTypeOverride,
    g: gBranch,
    b: bBranch,
  };
}

export function toRcGirderResult(
  input: DamCompositeResult | RcCalcResult,
  edgeOverride?: RcCalcResult,
): GirderResult {
  if ('g' in input && input.g) {
    const gRaw = input.g as RcCalcResult;
    const bRaw = (input.b as RcCalcResult | undefined) ?? gRaw;
    return {
      spType: 'RC',
      g: toRcBranchResult(gRaw),
      b: toRcBranchResult(bRaw),
    };
  }
  const gRaw = input as RcCalcResult;
  const gBranch = toRcBranchResult(gRaw);
  const bBranch = edgeOverride ? toRcBranchResult(edgeOverride) : gBranch;
  return {
    spType: 'RC',
    g: gBranch,
    b: bBranch,
  };
}
