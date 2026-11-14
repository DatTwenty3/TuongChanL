/**
 * BangTinhCauCong Web App — Flexible Pier Frame & Piles Solver (`TR`).
 *
 * Clean-room 100% numerically exact TypeScript port of:
 *  - `analysis-cau-cong/modules/13_pier_flexible_tr.js` lines 189-6067
 *    (crossfall / superstructure distribution helpers lines 1-188 live in `./crossfall.ts`).
 *
 * Units: m, kN, kPa, MPa, deg (internal RC checks convert to N, mm, MPa via `../math/rc.ts`).
 * Axes (3D pier / frame):
 *  - X_frame / Y_3D: transverse along pier cap (-Lc/2 .. +Lc/2)
 *  - X_3D: longitudinal along bridge (- toward left span, + toward right span)
 *  - Z_frame / Z_3D: elevation (m), positive upward.
 */

import type {
  ForceVector5,
  LimitStateType,
  PierResult,
  RcMaterialProps,
  RcSectionResult,
  TabId,
} from '../../types/project.ts';
import {
  $,
  contextState,
  fx,
  getVisualHooks,
  num,
  sct2Run,
  sctNm,
  sctSep,
  set,
  sv,
  v,
  withCtx,
} from '../context.ts';
import {
  RC,
  curve,
  interp,
  phiMnAt,
  rcRender,
  rcSec,
  section,
  tab3Step,
  type RcLoadInput,
  type RcSectionCheckWithOk,
} from '../math/rc.ts';
import {
  chFrameSolve,
  type FrameElementInput,
  type FrameFixity,
  type FrameNode,
  type FrameSolverInstance,
  type FrameSpring,
} from '../math/rcmFrame.ts';
import { PILE, RK, type PileAxialResult, type PilePmResult } from '../foundations/pileGroup.ts';
import { sctCheck, sctStep, type SctCalcOutput } from '../foundations/drilledShaft.ts';
import { dgKit, dgPut } from '../../graphics/svgPrimitives.ts';
import { mathAll } from '../../graphics/texMath.ts';
import {
  IPAN,
  ITOP,
  SUPDIST,
  XFmk,
  itOffSet,
  objLinkOff,
  objUnlock,
  type CrossfallModel,
  type PedestalHeightResult,
} from './crossfall.ts';
import { MO, getLatestMorResult } from './abutmentHeavy.ts';
import { getLatestDamResult, spV, supK } from './girderHollow.ts';

// ---------------------------------------------------------------------------
// 1. Late-Binding Hooks (Zero Circular Imports with Unfinished/UI Modules)
// ---------------------------------------------------------------------------

export interface PierFlexHooks {
  saveAll?: () => void;
  setActiveTab?: (tabId: TabId | number) => void;
}

export interface PierSolidBridgeHooks {
  dcOn?: () => boolean;
  dcVis?: () => void;
  dcStep?: () => unknown;
}

let pierFlexHooks: Partial<PierFlexHooks> = {};
let pierSolidBridgeHooks: Partial<PierSolidBridgeHooks> = {};

export function registerPierFlexHooks(hooks: Partial<PierFlexHooks>): void {
  pierFlexHooks = { ...pierFlexHooks, ...hooks };
}

export function clearPierFlexHooks(): void {
  pierFlexHooks = {};
}

export function registerPierSolidBridgeHooks(hooks: Partial<PierSolidBridgeHooks>): void {
  pierSolidBridgeHooks = { ...pierSolidBridgeHooks, ...hooks };
}

export function clearPierSolidBridgeHooks(): void {
  pierSolidBridgeHooks = {};
}

// ---------------------------------------------------------------------------
// 2. HTML Default Seed Table (`td_*` from `shell.html` for Headless Execution)
// ---------------------------------------------------------------------------

export const TD_STR_KEYS: ReadonlySet<string> = new Set([
  'tip',
  'tie',
  'name',
  'lcv',
  'dk',
  'dc',
  'dside',
  'ixm',
  'gpl',
]);

export const TD_DEFAULTS: Readonly<Record<string, string>> = {
  br: '0',
  name: 'T1',
  Wd: '8.0',
  bl: '0.5',
  br2: '0.5',
  wp: '0',
  L1: '24',
  L2: '24',
  a0: '0.3',
  nb: '8',
  sg: '1.0',
  Hgd: '0.95',
  hs: '0.18',
  tpd: '0',
  Hsu: '0.07',
  Hra: '0.5',
  Hrl: '0.61',
  hb: '0.078',
  e: '0.325',
  icL: '2',
  icR: '2',
  icy: '0',
  ixm: 'theo',
  ixL: '2',
  ixR: '2',
  gpl: 'doc',
  Lc: '7',
  b: '1.6',
  h: '1.2',
  he: '0.6',
  lt: '0.3',
  vtai: '0',
  ktai: '0',
  n: '3',
  s: '2.5',
  D: '1',
  ELb: '89.656',
  bbb: '1.0',
  hbb: '1.0',
  MNCN: '19.36',
  MNTN: '15.1',
  ELg: '14.372',
  hx: '0',
  ELt: '20.072',
  fc: '30',
  wc: '2320',
  gc: '24.5',
  K1: '1',
  fy: '400',
  Es: '200000',
  ag: '20',
  ge: '0.75',
  DC1: '2118.7',
  DC2: '2118.7',
  DCe1: '0',
  DCe2: '0',
  DCs1: '0',
  DCs2: '0',
  DW1: '258.1',
  DW2: '258.1',
  IM: '33',
  brt: '1',
  Vce: '80',
  Rce: '0',
  Vw: '1.64',
  CD: '0.7',
  thw: '0',
  VB: '45',
  S: '1.09',
  V25: '25',
  Cd1: '1.3',
  Cd2: '0.85',
  Cdc: '1.573',
  Cdx: '1.573',
  Tmax: '40',
  Tmin: '5',
  Tlo: '20',
  Thi: '35',
  al: '0.00001',
  ecs: '300',
  Gb: '1000',
  ga: '0.25',
  gb2: '0.15',
  hrt: '0.035',
  nbg: '2',
  Lct: '0',
  A: '0.054',
  soil: '3',
  R: '1.5',
  gEQ: '0.5',
  PCT: '0',
  PCVn: '0',
  PCVd: '0',
  zCV: '94',
  eta: '1.0',
  lcv: '',
  dk: 'M',
  dc: '',
  dside: 'both',
  secM: '0',
};

// ---------------------------------------------------------------------------
// 3. Domain Interfaces & Types
// ---------------------------------------------------------------------------

export interface TrInput {
  [key: string]: any;
  name: string;
  br: number;
  brt: number;
  Wd: number;
  bl: number;
  br2: number;
  wp: number;
  L1: number;
  L2: number;
  a0: number;
  nb: number;
  nbg: number;
  sg: number;
  Hgd: number;
  hs: number;
  tpd: number;
  Hsu: number;
  Hra: number;
  Hrl: number;
  hb: number;
  e: number;
  icL: number;
  icR: number;
  icy: number;
  ixm: string;
  ixL: number;
  ixR: number;
  gpl: string;
  Lc: number;
  b: number;
  h: number;
  he: number;
  lt: number;
  vtai: number;
  ktai: number;
  n: number;
  s: number;
  D: number;
  ELb: number;
  bbb: number;
  hbb: number;
  MNCN: number;
  MNTN: number;
  ELg: number;
  hx: number;
  ELt: number;
  fc: number;
  wc: number;
  gc: number;
  K1: number;
  fy: number;
  Es: number;
  ag: number;
  ge: number;
  DC1: number;
  DC2: number;
  DCe1: number;
  DCe2: number;
  DCs1: number;
  DCs2: number;
  DW1: number;
  DW2: number;
  IM: number;
  Vce: number;
  Rce: number;
  Vw: number;
  CD: number;
  thw: number;
  VB: number;
  S: number;
  V25: number;
  Cd1: number;
  Cd2: number;
  Cdc: number;
  Cdx: number;
  Tmax: number;
  Tmin: number;
  Tlo: number;
  Thi: number;
  al: number;
  ecs: number;
  Gb: number;
  ga: number;
  gb2: number;
  hrt: number;
  Lct: number;
  A: number;
  soil: number;
  R: number;
  gEQ: number;
  PCT: number;
  PCVn: number;
  PCVd: number;
  zCV: number;
  eta: number;
  lcv: string;
  dk: string;
  dc: string;
  dside: string;
  secM: number;
  kBR: number;
  pH: number;
  pm: number;
  pBp: number;
  pEp: number;
  pkt: number;
  pkh: number;
  pkr: number;
  pAlT: number[] | null;
  pAlL: number;
  pAlLc: number[] | null;
  pktC: number[] | null;
  pSoilSrc: string;
  pKz: ((z: number) => number) | null;
  pAx: PileAxialResult | null;
  pPmT: PilePmResult | null;
  pPmL: PilePmResult | null;
  pRock: boolean;
  pNote: string;
}

export interface TrGeomResult {
  XF: CrossfallModel;
  HK: PedestalHeightResult;
  brNote: string;
  n: number;
  xs: number[];
  xL: number;
  xR: number;
  L: number;
  ELt: number;
  ELcb: number;
  yc: number;
  ELs: number;
  hAt: (x: number) => number;
  brace: boolean;
  ELbt: number;
  ELbb: number;
  yb: number;
  nb: number;
  xg: number[];
  ngb: number;
  dgb: number;
  gOff: number[];
  xb: number[];
  zBr: number;
  zGt: number;
  zDeck: number;
  zRoad: number;
  Hc: number;
  pile: boolean;
  ELtip: number;
  err: string[];
}

export interface TrLongCandidate {
  nm: string;
  k: number;
  R1: number;
  R2: number;
  a1: number;
  a2: number;
}

export interface TrLongCase {
  cand: TrLongCandidate[];
  best: TrLongCandidate;
  ln: { R1: number; R2: number };
  R: number;
  ax: number;
  axNoIM: number;
  lane: number;
  dR: number;
}

export interface TrLongResult {
  [key: string]: any;
  A: TrLongCase;
  B: TrLongCase;
  BR1: number;
  Ls1: number;
  Ls2: number;
  im: number;
}

export interface TrPlacement {
  k: number;
  m: number;
  u: number;
  veh: number[];
  yc: number;
  gA: Float64Array;
  gB: Float64Array;
  RA: number;
  RB: number;
  dRA: number;
  dRB: number;
  BR: number;
}

export interface TrPlacementsResult {
  P: TrPlacement[];
  nL: number;
  wl: number;
  w: number;
  xr0: number;
  PLA: Float64Array;
  PLB: Float64Array;
  PLt: [number, number];
}

export interface TrFrameElement extends FrameElementInput {
  kind: 'cap' | 'rig' | 'col' | 'pile' | 'brace';
  h?: number;
  xa?: number;
  xb?: number;
  c?: number;
  ytop?: number;
  ybot?: number;
  span?: number;
}

export interface TrModelColumn {
  x: number;
  c: number;
  nd: number[];
  ys: number[];
  seg: number[];
  base: number;
  gi: number;
  gs: number;
}

export interface TrModel3D {
  nodes: FrameNode[];
  els: TrFrameElement[];
  springs: FrameSpring[];
  fix: FrameFixity[];
  capN: number[];
  capE: number[];
  xc: number[];
  cols: TrModelColumn[];
  brE: number[][];
  Ec: number;
  Ac: number;
  Icol: number;
  zl: number[];
  zp: number[];
  Ep: number;
  nodeAtX: (x: number) => number;
}

export interface TrModelL {
  nodes: FrameNode[];
  els: TrFrameElement[];
  springs: FrameSpring[];
  fix: FrameFixity[];
  ng: number;
  kg: number;
}

export interface TrLoadPoint {
  y: number;
  x: number;
  z: number;
  FX?: number;
  FY?: number;
  FZ?: number;
  kind: string;
  c?: number;
}

export interface TrLoadsResult {
  C: Record<string, TrLoadPoint[]>;
  info: Record<string, any>;
}

export interface TrLoadCombination {
  id: string;
  st: LimitStateType;
  p: 'max' | 'min' | 'IV' | 'IVb' | 'one';
  gLL: number;
  TU: number;
  CS?: number;
  wH?: number;
  w?: { V: string; g: number; WL: number; WV: number };
  eq?: [number, number];
  ct?: boolean;
  desc?: string;
}

export interface TrVariant {
  cb: TrLoadCombination;
  sx: number;
  sy: number;
  wd?: 'n' | 'd';
  cd?: 'n' | 'd';
  lab: string;
  name: string;
  t?: Float64Array;
  tp?: Float64Array;
  l?: Float64Array;
  lp?: Float64Array;
  tb?: Float64Array;
  lb?: Float64Array;
  teq?: Float64Array;
  leq?: Float64Array;
  gLL?: number;
}

export interface TrLiveLoadState {
  id: string;
  T: Float64Array | null;
  cs?: 'A' | 'B';
  p?: TrPlacement;
  ip?: number;
  Ml?: number;
  BR?: number;
  yBR?: number;
  CE?: number;
  Rt?: number;
}

export interface TrCalcResult {
  err?: string[];
  G: TrGeomResult;
  I: TrInput;
  M?: RcMaterialProps;
  LO?: TrLongResult;
  PL?: TrPlacementsResult;
  MD?: TrModel3D;
  LD?: TrLoadsResult;
  C3?: Record<string, TrLoadPoint[]>;
  F?: FrameSolverInstance;
  FL?: FrameSolverInstance;
  ML?: TrModelL;
  FLs?: FrameSolverInstance[];
  MLs?: TrModelL[];
  ALc?: number[];
  EL?: number[];
  ELi?: Int32Array;
  NE?: number;
  NO?: number;
  NL?: number;
  NL0?: number;
  LS?: Array<{ k: number; end: 'i' | 'j'; y: number }>;
  kUx?: number;
  kUy?: number;
  NP?: number;
  kP0?: number;
  TT?: Record<string, Float64Array>;
  LL?: Record<string, Float64Array>;
  UH?: Float64Array;
  UM?: Float64Array;
  UZ?: Float64Array;
  K3?: Float64Array[];
  CEunit?: Float64Array;
  runT?: (arr: TrLoadPoint[]) => Float64Array;
  runL?: (arr: TrLoadPoint[], Mz0?: number) => Float64Array;
  qg?: number;
  Ug?: Float64Array[];
  LLS?: TrLiveLoadState[];
  CB?: TrLoadCombination[];
  VAR?: TrVariant[];
  armBR?: number;
  sg?: { V: number; M: number; Vl: number; Ml: number };
  EQ?: Record<string, any>;
}

export interface TrBuckResult {
  ok: boolean;
  why?: string;
  lam: number;
  b0: number;
  nd?: number;
}

export interface TrStateVector {
  t: Float64Array;
  l: Float64Array;
  tb: Float64Array;
  lb: Float64Array;
  ll: TrLiveLoadState;
  v: TrVariant;
  Ncols: number[];
  Nsum: number;
}

export interface TrPileStation {
  z: number;
  depth: number;
  Mmin: number;
  Mmax: number;
  Vmin: number;
  Vmax: number;
  Nmin: number;
  Nmax: number;
  Umin: number;
  Umax: number;
  MLmin: number;
  MLmax: number;
  VLmin: number;
  VLmax: number;
  ULmin: number;
  ULmax: number;
}

export interface TrCheckResult {
  SL: {
    luT: number;
    luL: number;
    r: number;
    lamT: number[];
    lamTb: number[];
    lamL: number[][];
    lamLb: number[][];
    KluT: number;
    KluL: number;
    Kt: number;
    Kl: number;
    lt: number;
    ll: number;
    EIc: (bd: number) => number;
    EIp: (bd: number) => number;
    PeT: (bd: number) => number;
    PeTb: (bd: number) => number;
    PeL: (c: number, bd: number) => number;
    PeLb: (c: number, bd: number) => number;
    ok: boolean;
    magT: boolean;
    magL: boolean;
    over: boolean;
    cmb: Record<string, any>;
  };
  ENV: Record<
    string,
    { mx: Float64Array; mn: Float64Array; lmx: Float64Array; lmn: Float64Array }
  >;
  cand: any[];
  brC: any[];
  capE: Record<string, any[]>;
  brE: Record<string, any[]>;
  iA: number;
  iB: number;
  gA: number;
  gB: number;
  colRec: { CD: Record<string, any>; DB: Record<string, any> };
  pileRows: Record<string, Array<{ M: any; N: any }>>;
  pileTab: any[];
  grpN: { CD: number; DB: number };
  nStates: number;
  PSt: any[][] | null;
  PE: Record<string, any[][]>;
  pileRec: { CD: Record<string, any>; DB: Record<string, any> };
}

// ---------------------------------------------------------------------------
// 4. Core Solver Namespace (`TR` — Part 1: Geometry, Materials, Loads, FEM)
// ---------------------------------------------------------------------------

const g = 9.81;
const PI = Math.PI;

export const trMultiPresence = (n: number): number =>
  n <= 1 ? 1.2 : n === 2 ? 1.0 : n === 3 ? 0.85 : 0.65; // TCVN 11823-3 Bảng 7

export const trFlowAngleCoeff = (th: number): number => {
  const a = Math.abs(th);
  return a <= 0
    ? 0
    : a <= 5
      ? (0.5 * a) / 5
      : a <= 10
        ? 0.5 + (0.2 * (a - 5)) / 5
        : a <= 20
          ? 0.7 + (0.2 * (a - 10)) / 10
          : a < 30
            ? 0.9 + (0.1 * (a - 20)) / 10
            : 1.0;
}; // Bảng 12

export const trWindPressure = (V: number, At: number, Cd: number): number =>
  At > 0 ? Math.max(0.0006 * V * V * At * Cd, 1.8 * At) : 0; // PT 17

export function trGeom(I: TrInput): TrGeomResult {
  const n = Math.max(1, Math.round(I.n));
  const s = I.s;
  const xs: number[] = [];
  for (let i = 0; i < n; i++) xs.push((i - (n - 1) / 2) * s);
  const L = I.Lc;
  const xL = -L / 2;
  const xR = L / 2;
  const ELt = I.ELt;
  const ELcb = ELt - I.h;
  const yc = ELt - I.h / 2;
  const ELs = I.ELg - I.hx;
  const XF = XFmk({
    iL: I.icL,
    iR: I.icR,
    yc: I.icy,
    mode: I.ixm,
    mL: I.ixL,
    mR: I.ixR,
    gpl: I.gpl,
  });
  const hAt = (x: number): number => {
    const d = Math.min(x - xL, xR - x);
    const h0 = I.lt <= 0 || d >= I.lt ? I.h : I.he + ((I.h - I.he) * Math.max(0, d)) / I.lt;
    return Math.max(0.05, h0 - XF.dM(x));
  };
  const ELs0 = I.ELg - I.hx;
  const ELcb0 = ELt - I.h;
  const brIn = I.ELb < ELcb0 - 0.1 && I.ELb - I.hbb > ELs0 + 0.1;
  const ELb = !!I.br && !brIn && ELcb0 - ELs0 > I.hbb + 0.3 ? (ELcb0 + ELs0) / 2 + I.hbb / 2 : I.ELb;
  const brace = !!I.br && n > 1;
  const ELbt = ELb;
  const ELbb = ELb - I.hbb;
  const yb = ELb - I.hbb / 2;
  const brNote =
    brace && !brIn
      ? 'Cao độ đỉnh giằng nhập ' +
        I.ELb +
        ' m nằm ngoài khoảng giữa đáy xà mũ (' +
        ELcb0.toFixed(3) +
        ' m) và mặt đất sau xói (' +
        ELs0.toFixed(3) +
        ' m): tạm đặt giằng ở giữa, đỉnh giằng ' +
        ELb.toFixed(3) +
        ' m. Nhập lại cao độ đỉnh giằng.'
      : !!I.br && n <= 1
        ? 'Trụ một cột: không bố trí được giằng ngang, tính như trụ không giằng.'
        : '';
  const nb = Math.max(1, Math.round(I.nb));
  const xg: number[] = [];
  for (let j = 0; j < nb; j++) xg.push((j - (nb - 1) / 2) * I.sg);
  const ngb = Math.max(1, Math.round(I.nbg || 1));
  const dgb = I.sg / ngb;
  const gOff: number[] = [];
  for (let k = 0; k < ngb; k++) gOff.push((k - (ngb - 1) / 2) * dgb);
  const xb: number[] = [];
  xg.forEach((y) => gOff.forEach((o) => xb.push(y + o)));
  const HK = XF.hk(xg, 0);
  const zBr = ELt + I.hb - HK.m;
  const zGt = zBr + I.Hgd;
  const zDeck = zGt + I.hs;
  const zRoad = zDeck + I.Hsu; // đỉnh đá kê gối, đỉnh dầm, mặt bản, mặt đường
  const Hc = ELcb - ELs;
  const err: string[] = [];
  if (!(Hc > 0.5)) err.push('Cao độ đáy xà mũ phải cao hơn mặt đất sau xói ít nhất 0,5 m');
  if (brace && !(ELbt < ELcb - 0.1 && ELbb > ELs + 0.1)) {
    err.push('Giằng phải nằm giữa đáy xà mũ và mặt đất sau xói');
  }
  if (xs[0] - I.D / 2 < xL - 1e-9 || xs[n - 1] + I.D / 2 > xR + 1e-9) {
    err.push('Cọc biên vượt ra ngoài đầu xà mũ');
  }
  if (xb[0] < xL || xb[xb.length - 1] > xR) err.push('Gối dầm biên nằm ngoài xà mũ');
  if (I.Wd - I.bl - I.br2 <= 0) err.push('Bề rộng phần xe chạy ≤ 0');
  const pile = I.pH > 0 && (I.pm > 0 || Boolean(I.pKz)) && I.pEp > 0;
  const ELtip = pile ? ELs - I.pH : ELs;
  return {
    XF,
    HK,
    brNote,
    n,
    xs,
    xL,
    xR,
    L,
    ELt,
    ELcb,
    yc,
    ELs,
    hAt,
    brace,
    ELbt,
    ELbb,
    yb,
    nb,
    xg,
    ngb,
    dgb,
    gOff,
    xb,
    zBr,
    zGt,
    zDeck,
    zRoad,
    Hc,
    pile,
    ELtip,
    err,
  };
}

export function trMat(I: Pick<TrInput, 'fc' | 'fy' | 'K1' | 'wc' | 'ag' | 'ge'>): RcMaterialProps {
  const fy = I.fy;
  const fu = ({ 300: 450, 400: 570, 500: 650 } as Record<number, number>)[fy] || fy / 0.7;
  return RC.mat({
    fc: I.fc,
    fy,
    Es: 200000,
    K1: I.K1 || 1,
    wc: I.wc,
    ecl: fy <= 420 ? 0.002 : Math.min(0.004, 0.002 + (0.002 * (fy - 420)) / 270),
    etl: fy <= 420 ? 0.005 : Math.min(0.008, 0.005 + (0.003 * (fy - 420)) / 270),
    ag: I.ag,
    g1: 1.6,
    g3: fy / fu,
    ge: I.ge,
  });
}

// ---------- hoạt tải phương dọc cầu: phản lực 1 làn lên trụ ----------
export function trLlLong(I: TrInput): TrLongResult {
  const e = I.e;
  const L1 = I.L1 - 2 * I.a0;
  const L2 = I.L2 - 2 * I.a0;
  // dầm giản đơn có đoạn đầu dầm a0 ngoài tim gối: tung độ phản lực gối trụ kéo dài tuyến tính trên đoạn đầu dầm (phía trụ > 1 ; phía mố < 0)
  const a0 = I.a0 || 0;
  const r = (s: number): [number, number] => {
    let R1 = 0;
    let R2 = 0;
    if (s >= -e - L1 - a0 && s <= -e + a0) R1 = (s + e + L1) / L1;
    if (s >= e - a0 && s <= e + L2 + a0) R2 = (e + L2 - s) / L2;
    return [R1, R2];
  };
  const veh = (ax: Array<[number, number]>, obj: (a: number, b: number) => number) => {
    let best: { v: number; R1: number; R2: number; s0: number } | null = null;
    const span = ax[ax.length - 1][0];
    for (let s0 = -e - L1 - a0 - span; s0 <= e + L2 + a0; s0 += 0.05) {
      let R1 = 0;
      let R2 = 0;
      for (const [d, P] of ax) {
        const q = r(s0 + d);
        R1 += P * q[0];
        R2 += P * q[1];
      }
      const val = obj(R1, R2);
      if (!best || val > best.v) best = { v: val, R1, R2, s0 };
    }
    return best!;
  };
  const T1: Array<[number, number]> = [
    [0, 35],
    [4.3, 145],
    [8.6, 145],
  ];
  const T2: Array<[number, number]> = [
    [0, 145],
    [4.3, 145],
    [8.6, 35],
  ];
  const TD: Array<[number, number]> = [
    [0, 110],
    [1.2, 110],
  ];
  const lane = (on1: number, on2: number) => ({
    R1: on1 ? (9.3 * (L1 + a0) ** 2) / (2 * L1) : 0,
    R2: on2 ? (9.3 * (L2 + a0) ** 2) / (2 * L2) : 0,
  }); // chỉ chất tải phần tung độ dương
  const im = 1 + I.IM / 100;
  const out: Record<string, any> = {};
  for (const cs of ['A', 'B'] as const) {
    const obj = cs === 'A' ? (a: number, b: number) => a + b : (a: number, b: number) => b - a;
    const ln = cs === 'A' ? lane(1, 1) : lane(0, 1);
    const tk = [veh(T1, obj), veh(T2, obj)].reduce((p, q) => (q.v > p.v ? q : p));
    const td = veh(TD, obj);
    let dbl: { v: number; R1: number; R2: number; s0: number; gap: number } | null = null;
    if (cs === 'A') {
      for (let gp = 15; gp <= L1 + L2 + 2 * e + 1; gp += 0.5) {
        const ax: Array<[number, number]> = [
          ...T1,
          ...T1.map(([d, P]): [number, number] => [8.6 + gp + d, P]),
        ];
        const b = veh(ax, obj);
        if (!dbl || b.v > dbl.v) dbl = { ...b, gap: gp };
      }
    }
    const cand: TrLongCandidate[] = [
      {
        nm: 'Xe tải thiết kế + tải trọng làn',
        k: 1,
        R1: tk.R1 * im + ln.R1,
        R2: tk.R2 * im + ln.R2,
        a1: tk.R1,
        a2: tk.R2,
      },
      {
        nm: 'Xe hai trục thiết kế + tải trọng làn',
        k: 1,
        R1: td.R1 * im + ln.R1,
        R2: td.R2 * im + ln.R2,
        a1: td.R1,
        a2: td.R2,
      },
    ];
    if (dbl) {
      cand.push({
        nm: '90% (2 xe tải cách nhau ≥ 15 m + tải trọng làn)',
        k: 0.9,
        R1: 0.9 * (dbl.R1 * im + ln.R1),
        R2: 0.9 * (dbl.R2 * im + ln.R2),
        a1: 0.9 * dbl.R1,
        a2: 0.9 * dbl.R2,
      });
    }
    const b = cand.reduce((p, q) => (obj(q.R1, q.R2) > obj(p.R1, p.R2) ? q : p));
    out[cs] = {
      cand,
      best: b,
      ln,
      R: b.R1 + b.R2,
      ax: (b.a1 + b.a2) * im,
      axNoIM: b.a1 + b.a2,
      lane: b.k * (ln.R1 + ln.R2),
      dR: b.R2 - b.R1,
    };
  }
  const Lb = I.L1 + I.L2;
  out.BR1 = Math.max(0.25 * 325, 0.25 * 220, 0.05 * (325 + 9.3 * Lb), 0.05 * (220 + 9.3 * Lb));
  out.Ls1 = L1;
  out.Ls2 = L2;
  out.im = im;
  return out as TrLongResult;
}

export function trLever(xg: readonly number[], x: number, P: number, out: Float64Array | number[]): void {
  const nb = xg.length;
  if (nb === 1) {
    out[0] += P;
    return;
  }
  let j = 0;
  if (x <= xg[0]) j = 0;
  else if (x >= xg[nb - 1]) j = nb - 2;
  else {
    while (j < nb - 2 && x > xg[j + 1]) j++;
  }
  const a = xg[j];
  const b = xg[j + 1];
  const s = b - a;
  out[j] += (P * (b - x)) / s;
  out[j + 1] += (P * (x - a)) / s;
}

// ---------- xếp xe theo phương ngang (dịch chuyển các làn trên phần xe chạy, bước 0,1 m) ----------
export function trPlacements(
  I: Pick<TrInput, 'Wd' | 'bl' | 'br2' | 'wp'>,
  G: { nb: number; xg: number[] },
  LO: TrLongResult,
): TrPlacementsResult {
  const Wd = I.Wd;
  const xr0 = -Wd / 2 + I.bl;
  const w = Wd - I.bl - I.br2;
  let nL = Math.floor(w / 3.6 + 1e-9);
  if (w >= 6 && w <= 7.2) nL = 2;
  nL = Math.max(1, nL);
  const wl = Math.min(w / nL, 3.6);
  const P: TrPlacement[] = [];
  for (let k = 1; k <= nL; k++) {
    const m = trMultiPresence(k);
    const umax = w - (k - 1) * wl - 3.0;
    for (let u = 0; u <= umax + 1e-9; u += 0.1) {
      const veh: number[] = [];
      for (let i = 0; i < k; i++) veh.push(xr0 + u + i * wl);
      const gA = new Float64Array(G.nb);
      const gB = new Float64Array(G.nb);
      for (const x0 of veh) {
        for (const [cs, arr] of [
          ['A', gA],
          ['B', gB],
        ] as const) {
          const o = LO[cs];
          const ax = (o.ax / 2) * m;
          const ln = o.lane * m;
          trLever(G.xg, x0 + 0.6, ax, arr);
          trLever(G.xg, x0 + 2.4, ax, arr);
          for (let q = 0; q < 6; q++) trLever(G.xg, x0 + 0.25 + q * 0.5, ln / 6, arr);
        }
      }
      const yc = veh.reduce((t, x) => t + x + 1.5, 0) / k;
      P.push({
        k,
        m,
        u,
        veh,
        yc,
        gA,
        gB,
        RA: k * m * LO.A.R,
        RB: k * m * LO.B.R,
        dRA: k * m * LO.A.dR,
        dRB: k * m * LO.B.dR,
        BR: k * m * LO.BR1,
      });
    }
  }
  const PLA = new Float64Array(G.nb);
  const PLB = new Float64Array(G.nb);
  let PLt: [number, number] = [0, 0];
  if (I.wp > 0) {
    const qA = (3 * (LO.Ls1 + LO.Ls2)) / 2;
    const qB = (3 * LO.Ls2) / 2;
    for (const x0 of [-Wd / 2 + I.bl - I.wp, Wd / 2 - I.br2]) {
      for (let q = 0; q < 4; q++) {
        const x = x0 + (I.wp * (q + 0.5)) / 4;
        trLever(G.xg, x, (qA * I.wp) / 4, PLA);
        trLever(G.xg, x, (qB * I.wp) / 4, PLB);
      }
    }
    PLt = [2 * qA * I.wp, 2 * qB * I.wp];
  }
  return { P, nL, wl, w, xr0, PLA, PLB, PLt };
}

// lò xo ngang nút cọc: tích phân k(x) trên phần cọc thuộc nút [z - a, z + b] ; đất: k = m.bp.x ; đá: I.pRK
const trKh = (I: TrInput, z: number, a: number, b: number, al?: number | null): number =>
  (I.pKz ? I.pKz(z) * (a + b) : I.pm * I.pBp * (z * (a + b) + (b * b - a * a) / 2)) *
  (al == null ? 1 : al);

// ---------- mô hình khung ngang cầu (ngàm tại mặt đất sau xói) ----------
export function trModel(I: TrInput, G: TrGeomResult, M: RcMaterialProps): TrModel3D {
  const Ec = M.Ec * 1000;
  const D = I.D;
  const Ac = (PI * D * D) / 4;
  const Icol = (PI * D ** 4) / 64;
  const b = I.b;
  const nodes: FrameNode[] = [];
  const els: TrFrameElement[] = [];
  const springs: FrameSpring[] = [];
  const fix: FrameFixity[] = [];
  const add = (x: number, y: number): number => {
    nodes.push({ x, y });
    return nodes.length - 1;
  };
  const xk = new Set<number>([G.xL, G.xR, 0]);
  G.xs.forEach((x) => {
    xk.add(x);
    const a = 0.443 * D;
    xk.add(x - a);
    xk.add(x + a);
  });
  G.xb.forEach((x) => xk.add(x));
  for (let i = 0; i + 1 < G.xs.length; i++) xk.add((G.xs[i] + G.xs[i + 1]) / 2);
  if (I.lt > 0) {
    xk.add(G.xL + I.lt);
    xk.add(G.xR - I.lt);
  }
  let xc = [...xk]
    .map((val) => Math.round(val * 1e4) / 1e4)
    .sort((a, c) => a - c)
    .filter((val, i, arr) => i === 0 || val - arr[i - 1] > 1e-4);
  const fine: number[] = [];
  for (let i = 0; i < xc.length; i++) {
    fine.push(xc[i]);
    if (i + 1 < xc.length) {
      const d = xc[i + 1] - xc[i];
      const k = Math.ceil(d / 0.25);
      for (let j = 1; j < k; j++) fine.push(xc[i] + (d * j) / k);
    }
  }
  xc = fine;
  const capN = xc.map((x) => add(x, G.yc));
  const capE: number[] = [];
  for (let i = 0; i + 1 < capN.length; i++) {
    const xm = (xc[i] + xc[i + 1]) / 2;
    const h = G.hAt(xm);
    capE.push(els.length);
    els.push({
      i: capN[i],
      j: capN[i + 1],
      EA: Ec * b * h,
      EI: (Ec * b * h ** 3) / 12,
      kind: 'cap',
      h,
      xa: xc[i],
      xb: xc[i + 1],
    });
  }
  const nodeAtX = (x: number): number => capN[xc.findIndex((val) => Math.abs(val - x) < 1e-3)];
  const marks: number[] = [G.ELcb, G.ELs];
  if (G.brace) marks.push(G.ELbt, G.ELbb, G.yb);
  [I.MNCN, I.ELg, I.ELg + 1.2].forEach((val) => {
    if (val < G.ELcb && val > G.ELs) marks.push(val);
  });
  const ms = [...new Set(marks.map((val) => Math.round(val * 1e4) / 1e4))].sort((a, c) => c - a);
  const zl: number[] = [];
  for (let i = 0; i < ms.length; i++) {
    zl.push(ms[i]);
    if (i + 1 < ms.length) {
      const d = ms[i] - ms[i + 1];
      const k = Math.max(1, Math.ceil(d / 0.5));
      for (let j = 1; j < k; j++) zl.push(ms[i] - (d * j) / k);
    }
  }
  const Ep = (I.pEp || Ec / 1000) * 1000;
  const zp: number[] = [G.ELs];
  if (G.pile) {
    let z = 0;
    while (z < I.pH - 1e-6) {
      const st = 0.25;
      z = Math.min(I.pH, z + st);
      if (I.pH - z < st * 0.3) z = I.pH;
      zp.push(G.ELs - z);
    }
  }
  const cols: TrModelColumn[] = G.xs.map((x, c) => {
    const top = nodeAtX(x);
    const rig = add(x, G.ELcb);
    const nd = [top, rig];
    const ys = [G.yc, G.ELcb];
    const seg = [els.length];
    els.push({ i: top, j: rig, EA: Ec * Ac * 100, EI: Ec * Icol * 100, kind: 'rig', c });
    for (let k = 1; k < zl.length; k++) {
      const nn = add(x, zl[k]);
      seg.push(els.length);
      els.push({
        i: nd[nd.length - 1],
        j: nn,
        EA: Ec * Ac,
        EI: Ec * Icol,
        kind: 'col',
        c,
        ytop: zl[k - 1],
        ybot: zl[k],
      });
      nd.push(nn);
      ys.push(zl[k]);
    }
    const gi = nd.length - 1;
    const gs = seg.length - 1;
    if (G.pile) {
      for (let k = 1; k < zp.length; k++) {
        const nn = add(x, zp[k]);
        seg.push(els.length);
        els.push({
          i: nd[nd.length - 1],
          j: nn,
          EA: Ep * Ac,
          EI: Ep * Icol,
          kind: 'pile',
          c,
          ytop: zp[k - 1],
          ybot: zp[k],
        });
        nd.push(nn);
        ys.push(zp[k]);
      }
      zp.forEach((y, k) => {
        if (k === 0) return;
        const z = G.ELs - y;
        const a = (zp[k - 1] - y) / 2;
        const b2 = k + 1 < zp.length ? (y - zp[k + 1]) / 2 : 0;
        const kh = trKh(I, z, a, b2, I.pAlT ? I.pAlT[c] : 1);
        if (kh > 0) springs.push({ n: nd[gi + k], dof: 0, k: kh });
      });
      const tip = nd[nd.length - 1];
      springs.push(
        { n: tip, dof: 0, k: I.pkh || 0 },
        { n: tip, dof: 1, k: I.pktC && I.pktC[c] > 0 ? I.pktC[c] : I.pkt },
        { n: tip, dof: 2, k: I.pkr || 0 },
      );
    } else {
      ([0, 1, 2] as const).forEach((dof) => fix.push({ n: nd[gi], dof }));
    }
    return { x, c, nd, ys, seg, base: nd[gi], gi, gs };
  });
  const brE: number[][] = [];
  if (G.brace) {
    const yb = G.yb;
    const bb = I.bbb;
    const hb = I.hbb;
    const colNode = (c: number) => cols[c].nd[cols[c].ys.findIndex((y) => Math.abs(y - yb) < 1e-3)];
    for (let c = 0; c + 1 < cols.length; c++) {
      const x1 = G.xs[c];
      const x2 = G.xs[c + 1];
      const a1 = x1 + D / 2;
      const a2 = x2 - D / 2;
      const pts = [x1, a1];
      const k = Math.max(2, Math.ceil((a2 - a1) / 0.25));
      for (let j = 1; j < k; j++) pts.push(a1 + ((a2 - a1) * j) / k);
      pts.push(a2, x2);
      let prev = colNode(c);
      const seg: number[] = [];
      for (let j = 1; j < pts.length; j++) {
        const nd = j === pts.length - 1 ? colNode(c + 1) : add(pts[j], yb);
        const rigid = j === 1 || j === pts.length - 1;
        seg.push(els.length);
        els.push({
          i: prev,
          j: nd,
          EA: Ec * bb * hb * (rigid ? 100 : 1),
          EI: ((Ec * bb * hb ** 3) / 12) * (rigid ? 100 : 1),
          kind: rigid ? 'rig' : 'brace',
          span: c,
          xa: pts[j - 1],
          xb: pts[j],
        });
        prev = nd;
      }
      brE.push(seg);
    }
  }
  return {
    nodes,
    els,
    springs,
    fix,
    capN,
    capE,
    xc,
    cols,
    brE,
    Ec,
    Ac,
    Icol,
    zl,
    zp,
    Ep,
    nodeAtX,
  };
}

export function trModelL(I: TrInput, G: TrGeomResult, MD: TrModel3D, alL?: number | null): TrModelL {
  const zs = [...MD.zl, ...(G.pile ? MD.zp.slice(1) : [])];
  const nodes: FrameNode[] = zs.map((y) => ({ x: 0, y }));
  const els: TrFrameElement[] = [];
  const fix: FrameFixity[] = [];
  const springs: FrameSpring[] = [];
  const ng = MD.zl.length - 1;
  for (let k = 0; k + 1 < nodes.length; k++) {
    const p = k >= ng;
    els.push({
      i: k,
      j: k + 1,
      EA: (p ? MD.Ep : MD.Ec) * MD.Ac,
      EI: (p ? MD.Ep : MD.Ec) * MD.Icol,
      kind: p ? 'pile' : 'col',
    });
  }
  if (G.pile) {
    const zp = MD.zp;
    zp.forEach((y, k) => {
      if (k === 0) return;
      const z = G.ELs - y;
      const a = (zp[k - 1] - y) / 2;
      const b2 = k + 1 < zp.length ? (y - zp[k + 1]) / 2 : 0;
      const kh = trKh(I, z, a, b2, alL == null ? I.pAlL : alL);
      if (kh > 0) springs.push({ n: ng + k, dof: 0, k: kh });
    });
    const t = nodes.length - 1;
    springs.push(
      { n: t, dof: 0, k: I.pkh || 0 },
      { n: t, dof: 1, k: I.pkt },
      { n: t, dof: 2, k: I.pkr || 0 },
    );
  } else {
    ([0, 1, 2] as const).forEach((dof) => fix.push({ n: ng, dof }));
  }
  return { nodes, els, springs, fix, ng, kg: ng - 1 };
}

// ---------- tải trọng: mỗi trường hợp là danh sách lực điểm 3D {y, x, z, FX (dọc), FY (ngang), FZ (đứng, xuống +), kind, c} ----------
// kind: "g" = qua gối dầm (y = vị trí dầm) ; "s" = lực ngang lên kết cấu nhịp (truyền qua gối, kèm cặp lực chống lật) ; "n" = tại nút xà mũ ; "c" = trên cột c
export function trLoads(
  I: TrInput,
  G: TrGeomResult,
  MD: TrModel3D,
  _LO: TrLongResult,
  _PL: TrPlacementsResult,
): TrLoadsResult {
  const gc = I.gc;
  const D = I.D;
  const Ac = (PI * D * D) / 4;
  const xg = G.xg;
  const Lt = (I.L1 + I.L2) / 2;
  const V = I.VB * I.S;
  const V25 = I.V25;
  const C: Record<string, TrLoadPoint[]> = {};
  const info: Record<string, any> = {};
  // DC kết cấu nhịp, DW: chia đều các dầm (lực tập trung tại gối)
  C.DW = [];
  C.DC = [];
  {
    const S1 = SUPDIST(xg, {
      Wd: I.Wd,
      bl: I.bl,
      br: I.br2,
      wp: I.wp,
      DC: I.DC1,
      DCe: I.DCe1,
      DCs: I.DCs1,
      DW: I.DW1,
    });
    const S2 = SUPDIST(xg, {
      Wd: I.Wd,
      bl: I.bl,
      br: I.br2,
      wp: I.wp,
      DC: I.DC2,
      DCe: I.DCe2,
      DCs: I.DCs2,
      DW: I.DW2,
    });
    xg.forEach((y, j) => {
      C.DC.push(
        { y, x: -I.e, z: G.zBr, FZ: S1.dc[j], kind: 'g' },
        { y, x: I.e, z: G.zBr, FZ: S2.dc[j], kind: 'g' },
      );
      C.DW.push(
        { y, x: -I.e, z: G.zBr, FZ: S1.dw[j], kind: 'g' },
        { y, x: I.e, z: G.zBr, FZ: S2.dw[j], kind: 'g' },
      );
    });
  }
  // DC bản thân trụ: xà mũ (theo nút), giằng, thân cột
  C.DCp = [];
  let Wcap = 0;
  MD.capE.forEach((k) => {
    const e = MD.els[k];
    const xa = e.xa ?? 0;
    const xb = e.xb ?? 0;
    const h = e.h ?? I.h;
    const w = gc * I.b * h * (xb - xa);
    Wcap += w;
    C.DCp.push(
      { y: xa, x: 0, z: G.yc, FZ: w / 2, kind: 'n' },
      { y: xb, x: 0, z: G.yc, FZ: w / 2, kind: 'n' },
    );
  });
  // tường tai hai đầu xà mũ (dày vtai, cao ktai, rộng bằng bề rộng xà mũ): lực tập trung tại hai đầu xà
  {
    const vt = I.vtai || 0;
    const kt = I.ktai || 0;
    if (vt > 0 && kt > 0) {
      const w = gc * I.b * vt * kt;
      Wcap += 2 * w;
      info.Wtai = 2 * w;
      C.DCp.push(
        { y: G.xL, x: 0, z: G.yc, FZ: w, kind: 'n' },
        { y: G.xR, x: 0, z: G.yc, FZ: w, kind: 'n' },
      );
    }
  }
  let Wbr = 0;
  if (G.brace) {
    MD.els.forEach((e) => {
      if (e.span != null) {
        const xa = e.xa ?? 0;
        const xb = e.xb ?? 0;
        const w = gc * I.bbb * I.hbb * Math.abs(xb - xa);
        Wbr += w;
        C.DCp.push(
          { y: xa, x: 0, z: G.yb, FZ: w / 2, kind: 'b' },
          { y: xb, x: 0, z: G.yb, FZ: w / 2, kind: 'b' },
        );
      }
    });
  }
  const colPts = (
    arr: TrLoadPoint[],
    fn: (y1: number, y2: number, c: number) => { FX?: number; FY?: number; FZ?: number } | null,
  ) =>
    MD.cols.forEach((o) => {
      for (let i = 1; i + 1 < o.ys.length; i++) {
        const y1 = o.ys[i];
        const y2 = o.ys[i + 1];
        if (y2 < G.ELs - 1e-6) break;
        const f = fn(y1, y2, o.c);
        if (!f) continue;
        [y1, y2].forEach((z) =>
          arr.push({
            y: o.x,
            x: 0,
            z,
            FX: (f.FX || 0) / 2,
            FY: (f.FY || 0) / 2,
            FZ: (f.FZ || 0) / 2,
            kind: 'c',
            c: o.c,
          }),
        );
      }
    });
  colPts(C.DCp, (y1, y2) => ({ FZ: gc * Ac * (y1 - y2) }));
  const Wcol = G.n * gc * Ac * G.Hc;
  info.W = { Wcap, Wbr, Wcol, Vcap: Wcap / gc, Vbr: Wbr / gc, Vcol: Wcol / gc };
  // lực hãm (P3, 6.4): đặt cao 1,8 m trên mặt đường, phương dọc cầu
  const zBR = G.zRoad + 1.8;
  info.zBR = zBR;
  // lực ly tâm (P3, 6.3): CE = C.ΣP, C = 4v²/(3gR), đặt cao 1,8 m trên mặt đường, phương ngang cầu
  const vce = I.Vce / 3.6;
  const Cce = I.Rce > 0 ? (4 * vce * vce) / (3 * g * I.Rce) : 0;
  info.Cce = Cce;
  // áp lực nước (P3, 7): đẩy nổi WA2, dòng chảy WA3 (dọc trụ: theo phương xà mũ ; ngang: theo phương dọc cầu)
  const wet = (y1: number, y2: number) => Math.max(0, Math.min(y1, I.MNCN) - Math.max(y2, G.ELs));
  const hw = Math.max(0, Math.min(I.MNCN, G.ELcb) - G.ELs);
  const pD = 5.14e-4 * I.CD * I.Vw ** 2 * 1000;
  const pL = 5.14e-4 * trFlowAngleCoeff(I.thw) * I.Vw ** 2 * 1000;
  C.WA2 = [];
  colPts(C.WA2, (y1, y2) => {
    const l = wet(y1, y2);
    return l > 0 ? { FZ: -9.81 * Ac * l } : null;
  });
  C.WA3 = [];
  colPts(C.WA3, (y1, y2) => {
    const l = wet(y1, y2);
    return l > 0 ? { FY: pD * D * l, FX: pL * D * l } : null;
  });
  // mực nước thấp (MNTN): đẩy nổi nhỏ nhất, dùng cho tổ hợp có hệ số tải trọng thường xuyên lớn nhất
  const wetL = (y1: number, y2: number) => Math.max(0, Math.min(y1, I.MNTN) - Math.max(y2, G.ELs));
  const hwL = Math.max(0, Math.min(I.MNTN, G.ELcb) - G.ELs);
  C.WA2L = [];
  colPts(C.WA2L, (y1, y2) => {
    const l = wetL(y1, y2);
    return l > 0 ? { FZ: -9.81 * Ac * l } : null;
  });
  // phần xà mũ ngập dưới MNCN: đẩy nổi và lực dòng chảy lên mặt đầu xà mũ
  const hcw = Math.max(0, Math.min(I.MNCN, G.ELt) - G.ELcb);
  const Lcw = Math.max(0, I.Lc - 2 * (I.lt || 0));
  const Fbc = 9.81 * I.b * Lcw * hcw;
  const Fdc = pD * I.b * hcw;
  if (hcw > 0) {
    C.WA2.push({ y: 0, x: 0, z: G.ELcb + hcw / 2, FY: 0, FZ: -Fbc, kind: 'n' });
    C.WA3.push({ y: 0, x: 0, z: G.ELcb + hcw / 2, FY: Fdc, FZ: 0, kind: 'n' });
  }
  const hcwL = Math.max(0, Math.min(I.MNTN, G.ELt) - G.ELcb);
  const FbcL = 9.81 * I.b * Lcw * hcwL;
  if (hcwL > 0) C.WA2L.push({ y: 0, x: 0, z: G.ELcb + hcwL / 2, FY: 0, FZ: -FbcL, kind: 'n' });
  info.WA = {
    hw,
    hwL,
    pD,
    pL,
    FD: pD * D * hw,
    FL: pL * D * hw,
    Fb: 9.81 * Ac * hw,
    FbL: 9.81 * Ac * hwL,
    hcw,
    Fbc,
    Fdc,
    FbcL,
    CLv: trFlowAngleCoeff(I.thw),
  };
  // gió (P3, 8): ngang lên KCN + lan can + xà mũ + cột ; dọc = 0,25 KCN + mặt bên xà mũ, cột ; thẳng đứng Pv tại B/4 phía đón gió
  const At1 = (I.Hgd + I.hs + I.Hsu + I.Hra) * Lt;
  const At2 = I.Hrl * Lt;
  const zs1 = G.zBr + (I.Hgd + I.hs + I.Hsu + I.Hra) / 2;
  const zs2 = G.zRoad + I.Hra + I.Hrl / 2;
  const hav = (I.h + I.he) / 2;
  const colWindLen = Math.max(0, G.ELcb - Math.max(I.ELg, I.MNTN || -1e9));
  const wind = (VV: number, dir: 'n' | 'd') => {
    const arr: TrLoadPoint[] = [];
    const sup1 = trWindPressure(VV, At1, I.Cd1);
    const sup2 = trWindPressure(VV, At2, I.Cd2);
    const pc = trWindPressure(VV, 1, I.Cdc);
    const px = trWindPressure(VV, 1, I.Cdx);
    const low = Math.max(I.ELg, I.MNTN || -1e9);
    if (dir === 'n') {
      arr.push(
        { y: 0, x: 0, z: zs1, FY: sup1, kind: 's' },
        { y: 0, x: 0, z: zs2, FY: sup2, kind: 's' },
        { y: G.xL, x: 0, z: G.yc, FY: px * I.b * I.h, kind: 'n' },
      );
      colPts(arr, (y1, y2) => {
        const l = Math.max(0, Math.min(y1, G.ELcb) - Math.max(y2, low));
        return l > 0 ? { FY: pc * D * l } : null;
      });
    } else {
      arr.push(
        { y: 0, x: 0, z: zs1, FX: 0.25 * sup1, kind: 's' },
        { y: 0, x: 0, z: zs2, FX: 0.25 * sup2, kind: 's' },
        { y: 0, x: 0, z: G.yc, FX: px * I.Lc * I.h, kind: 'n' },
      );
      colPts(arr, (y1, y2) => {
        const l = Math.max(0, Math.min(y1, G.ELcb) - Math.max(y2, low));
        return l > 0 ? { FX: pc * D * l } : null;
      });
    }
    return { arr, sup1, sup2, pc, px };
  };
  const wn = wind(V, 'n');
  const wd = wind(V, 'd');
  const wn25 = wind(V25, 'n');
  const wd25 = wind(V25, 'd');
  C.WSn = wn.arr;
  C.WSd = wd.arr;
  C.WSn25 = wn25.arr;
  C.WSd25 = wd25.arr;
  const Av = I.Wd * Lt;
  const Pv = 0.00045 * V * V * Av;
  C.WVp = [{ y: -I.Wd / 4, x: 0, z: G.zBr, FZ: -Pv, kind: 'gl' }];
  C.WVm = [{ y: I.Wd / 4, x: 0, z: G.zBr, FZ: -Pv, kind: 'gl' }];
  const zWL = G.zRoad + 1.8;
  C.WLn = [{ y: 0, x: 0, z: zWL, FY: 1.46 * Lt, kind: 's' }];
  C.WLd = [{ y: 0, x: 0, z: zWL, FX: 0.55 * Lt, kind: 's' }];
  info.wind = {
    V,
    V25,
    At1,
    At2,
    zs1,
    zs2,
    hav,
    colWindLen,
    wn,
    wd,
    wn25,
    wd25,
    Av,
    Pv,
    zWL,
    WLy: 1.46 * Lt,
    WLx: 0.55 * Lt,
    Lt,
  };
  // nhiệt độ TU và co ngót, từ biến CR-SH: lực cắt gối hai nhịp ngược chiều, lấy chênh lệch (P3, 12.2 ; P14)
  const dT = Math.max(I.Tmax - I.Tlo, I.Thi - I.Tmin);
  const nbr = G.nb * Math.max(1, Math.round(I.nbg));
  const Ab = I.ga * I.gb2;
  const kb = (nbr * I.Gb * Ab) / Math.max(I.hrt, 1e-6);
  const dTU = [(I.al * dT * I.L1) / 2, (I.al * dT * I.L2) / 2];
  const FTU = dTU.map((d) => kb * d);
  const dCS = [(I.ecs * 1e-6 * I.L1) / 2, (I.ecs * 1e-6 * I.L2) / 2];
  const FCS = dCS.map((d) => kb * d);
  info.TU = {
    dT,
    nbr,
    Ab,
    kb,
    dTU,
    FTU,
    net: Math.abs(FTU[0] - FTU[1]),
    dCS,
    FCS,
    netCS: Math.abs(FCS[0] - FCS[1]),
  };
  // nhịp nối liên tục nhiệt: trụ chuyển vị cùng chiều với kết cấu nhịp, Δ = α.ΔT.Lct ; lực = (gối hai đầu nhịp trên trụ).k.Δ
  if ((I.Lct || 0) > 0) {
    const Lc = I.Lct;
    info.TU.cont = { Lc, dTU: I.al * dT * Lc, dCS: I.ecs * 1e-6 * Lc };
    info.TU.net = 2 * kb * info.TU.cont.dTU;
    info.TU.netCS = 2 * kb * info.TU.cont.dCS;
  }
  if (I.brt === 2) {
    const T = info.TU;
    const muK = spV('sp_mupad') || 0.6;
    const c1 = muK * ((I.DC1 || 0) + (I.DW1 || 0));
    const c2 = muK * ((I.DC2 || 0) + (I.DW2 || 0));
    T.muK = muK;
    T.Nk = (I.DC1 || 0) + (I.DW1 || 0) + (I.DC2 || 0) + (I.DW2 || 0);
    T.cap = c1 + c2; // kê trực tiếp qua lớp đệm: lực ngang không lớn hơn lực ma sát
    if (T.cont) {
      T.net = Math.min(T.net, T.cap);
      T.netCS = Math.min(T.netCS, Math.max(0, T.cap - T.net));
    } else {
      T.FTU = [Math.min(T.FTU[0], c1), Math.min(T.FTU[1], c2)];
      T.FCS = [
        Math.min(T.FCS[0], Math.max(0, c1 - T.FTU[0])),
        Math.min(T.FCS[1], Math.max(0, c2 - T.FTU[1])),
      ];
      T.net = Math.abs(T.FTU[0] - T.FTU[1]);
      T.netCS = Math.abs(T.FCS[0] - T.FCS[1]);
    }
  }
  C.TU = [{ y: 0, x: 0, z: G.zBr, FX: info.TU.net, kind: 's' }];
  C.CS = [{ y: 0, x: 0, z: G.zBr, FX: info.TU.netCS, kind: 's' }];
  // va xe CT (P3, 6.5): lực ngang đặt cao 1,2 m trên mặt đất (vào cột biên) ; va tàu CV: lực nhập tại cao độ cho trước
  const zCT = I.ELg + 1.2;
  C.CTn = I.PCT > 0 ? [{ y: G.xs[0], x: 0, z: zCT, FY: I.PCT, kind: 'c', c: 0 }] : [];
  C.CTd = I.PCT > 0 ? [{ y: G.xs[0], x: 0, z: zCT, FX: I.PCT, kind: 'c', c: 0 }] : [];
  C.CVn = I.PCVn > 0 ? [{ y: G.xs[0], x: 0, z: I.zCV, FY: I.PCVn, kind: 'c', c: 0 }] : [];
  C.CVd = I.PCVd > 0 ? [{ y: G.xs[0], x: 0, z: I.zCV, FX: I.PCVd, kind: 'c', c: 0 }] : [];
  info.zCT = zCT;
  return { C, info };
}

// ---------- tổng hợp lực tại mặt cắt cao độ z0 (gốc tại tâm trụ) ----------
export function trResAt(
  arr: readonly TrLoadPoint[] | null | undefined,
  z0: number,
): { Hx: number; Hy: number; Hz: number; Mx: number; My: number; Mz: number } {
  const o = { Hx: 0, Hy: 0, Hz: 0, Mx: 0, My: 0, Mz: 0 };
  (arr || []).forEach((p) => {
    if (p.z < z0 - 1e-6) return;
    const FX = p.FX || 0;
    const FY = p.FY || 0;
    const FZ = p.FZ || 0;
    o.Hx += FX;
    o.Hy += FY;
    o.Hz += FZ;
    o.My += FZ * p.x + FX * (p.z - z0);
    o.Mx += FZ * p.y + FY * (p.z - z0);
    o.Mz += FY * p.x - FX * p.y;
  });
  return o;
}

// ---------------------------------------------------------------------------
// 5. Core Solver Namespace (`TR` — Part 2: Frame Calc, Buckling, State)
// ---------------------------------------------------------------------------

export function trCalc(I: TrInput): TrCalcResult {
  const G = trGeom(I);
  if (G.err.length) return { err: G.err, G, I };
  const M = trMat(I);
  const LO = trLlLong(I);
  const PL = trPlacements(I, G, LO);
  const MD = trModel(I, G, M);
  const LDo = trLoads(I, G, MD, LO, PL);
  const C3 = LDo.C;
  const n = G.n;
  const nb = G.nb;
  const F = chFrameSolve(MD.nodes, MD.els, MD.springs, MD.fix);
  // dọc cầu: mỗi cột (cọc) một mô hình riêng với hệ số nhóm αi riêng ; các đỉnh cột (đáy xà mũ) cùng chuyển vị và góc xoay (xà mũ cứng)
  const ALc = MD.cols.map((_o, c) =>
    I.pAlLc && I.pAlLc[c] != null ? I.pAlLc[c] : I.pAlL == null ? 1 : I.pAlL,
  );
  const MLs = ALc.map((a) => trModelL(I, G, MD, a));
  const ML = MLs[0];
  const FLs = MLs.map((m) => chFrameSolve(m.nodes, m.els, m.springs, m.fix));
  const FL = FLs[0];
  // ---- véc tơ kết quả: nội lực hai đầu mọi phần tử không cứng + chuyển vị đỉnh ----
  const EL: number[] = [];
  MD.els.forEach((e, k) => {
    if (e.kind !== 'rig') EL.push(k);
  });
  const ELi = new Int32Array(MD.els.length).fill(-1);
  EL.forEach((k, q) => (ELi[k] = q));
  const NE = EL.length;
  const kUx = 6 * NE;
  const kUy = 6 * NE + 1;
  const NP = G.pile ? MD.zp.length : 0;
  const kP0 = 6 * NE + 2;
  const NO = kP0 + 2 * G.n * NP; // [Ni,Vi,Mi,Nj,Vj,Mj] mỗi phần tử
  const capC = MD.capN[MD.xc.findIndex((val) => Math.abs(val) < 1e-3)];
  const ext = (r: { u: Float64Array; R: Array<{ Ni: number; Vi: number; Mi: number; Nj: number; Vj: number; Mj: number }> }) => {
    const out = new Float64Array(NO);
    EL.forEach((k, q) => {
      const f = r.R[k];
      const o = 6 * q;
      out[o] = f.Ni;
      out[o + 1] = f.Vi;
      out[o + 2] = f.Mi;
      out[o + 3] = f.Nj;
      out[o + 4] = f.Vj;
      out[o + 5] = f.Mj;
    });
    out[kUx] = r.u[3 * capC];
    out[kUy] = r.u[3 * capC + 1];
    if (NP) {
      MD.cols.forEach((o, c) => {
        for (let k = 0; k < NP; k++) {
          const nd = o.nd[o.gi + k];
          const q = kP0 + 2 * (c * NP + k);
          out[q] = r.u[3 * nd];
          out[q + 1] = r.u[3 * nd + 1];
        }
      });
    }
    return out;
  };
  const capNode = (y: number) =>
    MD.capN[MD.xc.reduce((b, val, i) => (Math.abs(val - y) < Math.abs(MD.xc[b] - y) ? i : b), 0)];
  const brNode = (y: number) => {
    let b = -1;
    let d = 1e9;
    MD.nodes.forEach((nd, i) => {
      if (Math.abs(nd.y - G.yb) < 1e-3 && Math.abs(nd.x - y) < d) {
        d = Math.abs(nd.x - y);
        b = i;
      }
    });
    return b;
  };
  const colNode = (c: number, z: number) => {
    const o = MD.cols[c];
    let b = 1;
    o.ys.forEach((y, i) => {
      if (i >= 1 && Math.abs(y - z) < Math.abs(o.ys[b] - z)) b = i;
    });
    return o.nd[b];
  };
  const sxb2 = G.xb.reduce((t, x) => t + x * x, 0) || 1;
  const gB = (lc: { nod: Array<{ n: number; fx?: number; fy?: number; m?: number }> }, y: number, P: number) =>
    G.gOff.forEach((o) => lc.nod.push({ n: capNode(y + o), fy: -P / G.ngb }));
  const toT = (arr: readonly TrLoadPoint[] | undefined) => {
    const lc: { nod: Array<{ n: number; fx?: number; fy?: number; m?: number }> } = { nod: [] };
    (arr || []).forEach((p) => {
      const FY = p.FY || 0;
      const FZ = p.FZ || 0;
      if (p.kind === 'g') {
        if (FZ) gB(lc, p.y, FZ);
      } else if (p.kind === 'gl') {
        const w = new Float64Array(nb);
        trLever(G.xg, p.y, FZ, w);
        w.forEach((P, j) => {
          if (P) gB(lc, G.xg[j], P);
        });
      } else if (p.kind === 's') {
        if (FY) {
          const nB = G.xb.length;
          G.xb.forEach((x) => lc.nod.push({ n: capNode(x), fx: FY / nB }));
          const Mo = FY * (p.z - G.yc);
          if (nB > 1) G.xb.forEach((x) => lc.nod.push({ n: capNode(x), fy: (-Mo * x) / sxb2 }));
          else lc.nod.push({ n: capNode(G.xb[0]), m: -Mo });
        }
        if (FZ) gB(lc, p.y, FZ);
      } else if (p.kind === 'n') {
        lc.nod.push({ n: capNode(p.y), fx: FY, fy: -FZ, m: -FY * (p.z - G.yc) });
      } else if (p.kind === 'b') {
        const nd = brNode(p.y);
        if (nd >= 0) lc.nod.push({ n: nd, fx: FY, fy: -FZ });
      } else if (p.kind === 'c') {
        lc.nod.push({ n: colNode(p.c || 0, p.z), fx: FY, fy: -FZ });
      }
    });
    return lc;
  };
  const LS: Array<{ k: number; end: 'i' | 'j'; y: number }> = [];
  ML.els.forEach((e, k) => {
    for (const end of ['i', 'j'] as const) LS.push({ k, end, y: ML.nodes[end === 'i' ? e.i : e.j].y });
  });
  const NL0 = 2 * LS.length + 1 + ML.nodes.length;
  const NL = n * NL0;
  const extL = (r: { u: Float64Array; R: Array<{ Vi: number; Mi: number; Vj: number; Mj: number }> }) => {
    const out = new Float64Array(NL0);
    LS.forEach((s, q) => {
      const f = r.R[s.k];
      out[2 * q] = s.end === 'i' ? f.Vi : f.Vj;
      out[2 * q + 1] = s.end === 'i' ? f.Mi : f.Mj;
    });
    const o = 2 * LS.length;
    out[o] = r.u[0];
    ML.nodes.forEach((_nd, k) => (out[o + 1 + k] = r.u[3 * k]));
    return out;
  };
  const lNode = (z: number) => {
    let b = 0;
    ML.nodes.forEach((nd, i) => {
      if (Math.abs(nd.y - z) < Math.abs(ML.nodes[b].y - z)) b = i;
    });
    return b;
  };
  const ycs = G.xs;
  const levC = (y: number, P: number, w: Float64Array) => {
    if (n === 1) {
      w[0] += P;
      return;
    }
    trLever(ycs, Math.max(ycs[0], Math.min(ycs[n - 1], y)), P, w);
  }; // mômen xoắn tại vị trí y: tải nút tương đương của phần tử xoắn (ngoài cột biên: vào cột biên)
  const toL = (arr: readonly TrLoadPoint[] | undefined) => {
    const lcs: Array<{ nod: Array<{ n: number; fx?: number; fy?: number; m?: number }> }> = MLs.map(() => ({
      nod: [],
    }));
    const mt = new Float64Array(n);
    let H = 0;
    let Mt = 0;
    let Mz = 0;
    (arr || []).forEach((p) => {
      const FX = p.FX || 0;
      const FZ = p.FZ || 0;
      if (p.kind === 'c') {
        if (FX) lcs[p.c || 0].nod.push({ n: lNode(p.z), fx: FX });
      } else {
        H += FX;
        const m = FX * (p.z - G.ELcb) + FZ * (p.x || 0);
        Mt += m;
        Mz += FX * (p.y || 0);
        if (m) {
          if (p.kind === 's') {
            const nB = G.xb.length;
            G.xb.forEach((x) => levC(x, m / nB, mt));
          } else levC(p.y || 0, m, mt);
        }
      }
    });
    return { lcs, F: [H, -Mt, Mz] as [number, number, number], mt };
  };
  const RHc = FLs.map((f) => f.run({ nod: [{ n: 0, fx: 1 }] }));
  const RMc = FLs.map((f) => f.run({ nod: [{ n: 0, m: 1 }] }));
  const eH = RHc.map(extL);
  const eM = RMc.map(extL);
  const inv2 = (a: [[number, number], [number, number]]): [[number, number], [number, number]] => {
    const d = a[0][0] * a[1][1] - a[0][1] * a[1][0];
    return [
      [a[1][1] / d, -a[0][1] / d],
      [-a[1][0] / d, a[0][0] / d],
    ];
  };
  const Kc = RHc.map((rh, c) =>
    inv2([
      [rh.u[0], RMc[c].u[0]],
      [rh.u[2], RMc[c].u[2]],
    ]),
  );
  const Ks: [[number, number], [number, number]] = [
    [0, 0],
    [0, 0],
  ];
  Kc.forEach((K) => {
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) Ks[i][j] += K[i][j];
  });
  const KsI = inv2(Ks);
  // xà mũ cứng trong mặt bằng (uốn ngang), xoắn đàn hồi GJ: đỉnh cột c chuyển vị dọc cầu d + θ.y_c, góc xoay φ_c riêng từng cột, nối bằng GJ/s
  const N3 = 2 + n;
  const Gc = (M.Ec * 1000) / 2.4;
  const capJ = (() => {
    const a = Math.max(I.b, I.h);
    const c = Math.min(I.b, I.h);
    return a * c ** 3 * (1 / 3 - ((0.21 * c) / a) * (1 - c ** 4 / (12 * a ** 4)));
  })();
  const K3 = [...Array(N3)].map(() => new Float64Array(N3));
  const TT3 = MD.cols.map((_o, c) => {
    const t = [...Array(N3)].map(() => [0, 0]);
    t[0][0] = 1;
    t[1][0] = ycs[c];
    t[2 + c][1] = 1;
    return t;
  });
  Kc.forEach((K, c) => {
    const t = TT3[c];
    for (let i = 0; i < N3; i++) {
      for (let j = 0; j < N3; j++) {
        K3[i][j] +=
          t[i][0] * (K[0][0] * t[j][0] + K[0][1] * t[j][1]) +
          t[i][1] * (K[1][0] * t[j][0] + K[1][1] * t[j][1]);
      }
    }
  });
  for (let c = 0; c + 1 < n; c++) {
    const kt = (Gc * capJ) / Math.max(ycs[c + 1] - ycs[c], 1e-6);
    K3[2 + c][2 + c] += kt;
    K3[3 + c][3 + c] += kt;
    K3[2 + c][3 + c] -= kt;
    K3[3 + c][2 + c] -= kt;
  }
  if (n === 1) K3[1][1] += 1;
  const sol3 = (b: Float64Array): number[] => {
    const A = K3.map((r, i) => [...r, b[i]]);
    for (let i = 0; i < N3; i++) {
      let p = i;
      for (let r = i + 1; r < N3; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
      [A[i], A[p]] = [A[p], A[i]];
      for (let r = 0; r < N3; r++) {
        if (r === i) continue;
        const f = A[r][i] / A[i][i];
        for (let c = i; c <= N3; c++) A[r][c] -= f * A[i][c];
      }
    }
    return A.map((r, i) => r[N3] / r[i]);
  };
  const runL = (arr: TrLoadPoint[], Mz0?: number) => {
    const { lcs, F: Ft, mt } = toL(arr);
    const out = new Float64Array(NL);
    const rs = lcs.map((lc, c) => FLs[c].run(lc));
    const d0 = rs.map((r) => [r.u[0], r.u[2]]);
    const rhs = new Float64Array(N3);
    rhs[0] = Ft[0];
    rhs[1] = Ft[2] + (Mz0 || 0);
    for (let c = 0; c < n; c++) rhs[2 + c] = -mt[c];
    Kc.forEach((K, c) => {
      const a = K[0][0] * d0[c][0] + K[0][1] * d0[c][1];
      const b = K[1][0] * d0[c][0] + K[1][1] * d0[c][1];
      const t = TT3[c];
      for (let r = 0; r < N3; r++) rhs[r] += t[r][0] * a + t[r][1] * b;
    });
    const X = sol3(rhs);
    rs.forEach((r, c) => {
      const e = extL(r);
      const K = Kc[c];
      const dd = [X[0] + X[1] * ycs[c] - d0[c][0], X[2 + c] - d0[c][1]];
      const fH = K[0][0] * dd[0] + K[0][1] * dd[1];
      const fM = K[1][0] * dd[0] + K[1][1] * dd[1];
      const o = c * NL0;
      for (let q = 0; q < NL0; q++) out[o + q] = e[q] + fH * eH[c][q] + fM * eM[c][q];
    });
    return out;
  };
  {
    const T = LDo.info && LDo.info.TU;
    if (T && T.cont) {
      const { F: Ft, mt } = toL([{ y: 0, x: 0, z: G.zBr, FX: 1, kind: 's' }]);
      const rhs = new Float64Array(N3);
      rhs[0] = Ft[0];
      rhs[1] = Ft[2];
      for (let c = 0; c < n; c++) rhs[2 + c] = -mt[c];
      const X = sol3(rhs);
      const dB = rhs.reduce((t, val, i) => t + val * X[i], 0);
      if (dB > 0 && isFinite(dB)) {
        const Kp = 1 / dB;
        const Kd = 2 * T.kb;
        const Ke = 1 / (1 / Kd + 1 / Kp);
        Object.assign(T, { Kp, Kd, Ke });
        const tu = Ke * T.cont.dTU;
        const cs = Ke * T.cont.dCS;
        T.net = T.cap != null ? Math.min(tu, T.cap) : tu;
        T.netCS = T.cap != null ? Math.min(cs, Math.max(0, T.cap - T.net)) : cs;
        (C3.TU || []).forEach((p) => (p.FX = T.net));
        (C3.CS || []).forEach((p) => (p.FX = T.netCS));
      }
    }
  }
  const runT = (arr: TrLoadPoint[]) => ext(F.run(toT(arr)));
  const TT: Record<string, Float64Array> = {};
  const LL: Record<string, Float64Array> = {};
  const keysT = [
    'DC',
    'DCp',
    'DW',
    'WA2',
    'WA2L',
    'WA3',
    'WSn',
    'WSn25',
    'WVp',
    'WVm',
    'WLn',
    'CTn',
    'CVn',
  ] as const;
  const keysL = ['DC', 'DCp', 'DW', 'WA3', 'WSd', 'WSd25', 'WLd', 'TU', 'CS', 'CTd', 'CVd'] as const;
  keysT.forEach((k) => (TT[k] = runT(C3[k])));
  keysL.forEach((k) => (LL[k] = runL(C3[k])));
  const UH = runL([{ y: 0, x: 0, z: G.ELcb, FX: n, kind: 's' }]);
  const UM = runL([{ y: 0, x: 1, z: G.ELcb, FZ: n, kind: 's' }]);
  const UZ = runL([], 1); // mômen xoắn mặt bằng 1 kN.m (lực dọc cầu lệch tâm ngang cầu)
  const Ug = G.xg.map((y) => runT([{ y, x: 0, z: G.zBr, FZ: 1, kind: 'g' }]));
  const UHt = runT([{ y: 0, x: 0, z: G.yc, FY: 1, kind: 'n' }]);
  // ---- hiệu chỉnh dấu lực chân cột (lực của cột lên đầu cọc, mômen cùng chiều mômen do lực ngang đặt phía trên) ----
  const baseQ = (o: TrModelColumn) => ELi[o.seg[o.gs]];
  const sgV = Math.sign(MD.cols.reduce((t, o) => t + UHt[6 * baseQ(o) + 4], 0)) || 1;
  const sgM = Math.sign(MD.cols.reduce((t, o) => t + UHt[6 * baseQ(o) + 5], 0)) || 1;
  const qb = 2 * ML.kg + 1;
  const sgVl = Math.sign(UH[2 * qb]) || 1;
  const sgMl = Math.sign(UH[2 * qb + 1]) || 1;
  // ---- động đất (P3, 9): đơn mode; độ cứng ngang từ mô hình ----
  const Wsup = I.DC1 + I.DC2 + I.DW1 + I.DW2;
  const W = LDo.info.W;
  const Wm = Wsup + W.Wcap + W.Wbr + 0.24 * W.Wcol;
  const zSupM = G.zBr + I.Hgd / 2;
  const zK = G.zBr;
  const Kt = (() => {
    const r = F.run(toT([{ y: 0, x: 0, z: zK, FY: 1, kind: 's' }]));
    const u = r.u[3 * capC] - r.u[3 * capC + 2] * (zK - G.yc);
    return 1 / Math.max(Math.abs(u), 1e-12);
  })();
  const Kl = (() => {
    const h = zK - G.ELcb;
    const d = [KsI[0][0] * 1 + KsI[0][1] * -h, KsI[1][0] * 1 + KsI[1][1] * -h];
    const u = d[0] - d[1] * h;
    return 1 / Math.max(Math.abs(u), 1e-12);
  })();
  const Tt = 2 * Math.PI * Math.sqrt(Wm / (g * Kt));
  const Tl = 2 * Math.PI * Math.sqrt(Wm / (g * Kl));
  const S = [1, 1.2, 1.5, 2][I.soil - 1] || 1.2;
  const Ct = MO.csm(I.A, S, I.soil, Tt);
  const Cl = MO.csm(I.A, S, I.soil, Tl);
  const R = I.R;
  const fR = 1;
  const zone = I.A <= 0.09 ? 1 : I.A <= 0.19 ? 2 : I.A <= 0.29 ? 3 : 4;
  const kmin = zone === 1 ? (I.A < 0.025 && I.soil <= 2 ? 0.1 : 0.2) : 0;
  const eqArr = (Cs: number, dir: 'n' | 'd') => {
    const k = Cs / R;
    const arr: TrLoadPoint[] = [];
    const key = dir === 'n' ? 'FY' : 'FX';
    arr.push({ y: 0, x: 0, z: zSupM, [key]: k * Wsup, kind: 's' } as TrLoadPoint);
    C3.DCp.forEach((p) => {
      if ((p.FZ || 0) > 0) {
        arr.push({ y: p.y, x: 0, z: p.z, [key]: k * (p.FZ || 0), kind: p.kind, c: p.c } as TrLoadPoint);
      }
    });
    return { k, arr, Fsup: k * Wsup, Fcap: k * W.Wcap, Fbr: k * W.Wbr, Fcol: k * W.Wcol };
  };
  const EQn = eqArr(Ct, 'n');
  const EQd = eqArr(Cl, 'd');
  C3.EQn = EQn.arr;
  C3.EQd = EQd.arr;
  TT.EQn = runT(EQn.arr);
  LL.EQd = runL(EQd.arr);
  // ---- hoạt tải theo từng cách xếp xe ----
  const comb = (arr: Float64Array[], w: Float64Array) => {
    const out = new Float64Array(NO);
    arr.forEach((u, j) => {
      const c = w[j];
      if (!c) return;
      for (let q = 0; q < NO; q++) out[q] += c * u[q];
    });
    return out;
  };
  const PLvA = comb(Ug, PL.PLA);
  const PLvB = comb(Ug, PL.PLB);
  const zBR = LDo.info.zBR as number;
  const armBR = zBR - G.ELcb;
  const CEunit = runT([{ y: 0, x: 0, z: zBR, FY: 1, kind: 's' }]);
  const LLS: TrLiveLoadState[] = [{ id: 'none', T: null }];
  PL.P.forEach((p, ip) => {
    for (const cs of ['A', 'B'] as const) {
      const out = comb(Ug, cs === 'A' ? p.gA : p.gB);
      const pl = cs === 'A' ? PLvA : PLvB;
      for (let q = 0; q < NO; q++) out[q] += pl[q];
      const ce = (LDo.info.Cce as number) * p.k * p.m * LO[cs].axNoIM;
      if (ce) for (let q = 0; q < NO; q++) out[q] += ce * CEunit[q];
      const dR = (cs === 'A' ? p.dRA : p.dRB) + (cs === 'A' ? 0 : PL.PLt[1]);
      LLS.push({
        id: ip + cs,
        cs,
        p,
        ip,
        T: out,
        Ml: (dR * I.e) / n,
        BR: I.kBR * p.BR,
        yBR: p.yc,
        CE: ce,
        Rt: cs === 'A' ? p.RA + PL.PLt[0] : p.RB + PL.PLt[1],
      });
    }
  });
  // ---- tổ hợp (P3, Bảng 3, Bảng 4) ----
  const PP = {
    max: { DC: 1.25, DW: 1.5 },
    min: { DC: 0.9, DW: 0.65 },
    IV: { DC: 1.5, DW: 1.5 },
    IVb: { DC: 0.9, DW: 0.65 },
    one: { DC: 1, DW: 1 },
  } as const;
  const hasCT = C3.CTn.length || C3.CVn.length || C3.CVd.length;
  const CB: TrLoadCombination[] = [
    { id: 'SD I', st: 'SD', p: 'one', gLL: 1, TU: 1, w: { V: '', g: 0.3, WL: 1, WV: 0 } },
    { id: 'CĐ Ia', st: 'CD', p: 'max', gLL: 1.75, TU: 0.5 },
    { id: 'CĐ Ib', st: 'CD', p: 'min', gLL: 1.75, TU: 0.5 },
    { id: 'CĐ IIIa', st: 'CD', p: 'max', gLL: 0, TU: 0.5, w: { V: '', g: 1.4, WL: 0, WV: 1.4 } },
    { id: 'CĐ IIIb', st: 'CD', p: 'min', gLL: 0, TU: 0.5, w: { V: '', g: 1.4, WL: 0, WV: 1.4 } },
    { id: 'CĐ IVa', st: 'CD', p: 'IV', gLL: 0, TU: 0.5 },
    { id: 'CĐ IVb', st: 'CD', p: 'IVb', gLL: 0, TU: 0.5 },
    { id: 'CĐ Va', st: 'CD', p: 'max', gLL: 1.35, TU: 0.5, w: { V: '', g: 0.4, WL: 1, WV: 0 } },
    { id: 'CĐ Vb', st: 'CD', p: 'min', gLL: 1.35, TU: 0.5, w: { V: '', g: 0.4, WL: 1, WV: 0 } },
    {
      id: 'ĐB Ia',
      st: 'DB',
      p: 'one',
      gLL: I.gEQ,
      TU: 0,
      eq: [1, 0.3],
      desc: '1,0EQx + 0,3EQy ; MNTN',
      CS: 0.5,
    },
    {
      id: 'ĐB Ib',
      st: 'DB',
      p: 'one',
      gLL: I.gEQ,
      TU: 0,
      eq: [0.3, 1],
      desc: '0,3EQx + 1,0EQy ; MNTN',
      CS: 0.5,
    },
    {
      id: "ĐB Ia'",
      st: 'DB',
      p: 'one',
      wH: 1,
      gLL: I.gEQ,
      TU: 0,
      eq: [1, 0.3],
      desc: '1,0EQx + 0,3EQy ; MNCN',
      CS: 0.5,
    },
    {
      id: "ĐB Ib'",
      st: 'DB',
      p: 'one',
      wH: 1,
      gLL: I.gEQ,
      TU: 0,
      eq: [0.3, 1],
      desc: '0,3EQx + 1,0EQy ; MNCN',
      CS: 0.5,
    },
  ];
  if (hasCT) {
    CB.push(
      {
        id: 'ĐB IIa',
        st: 'DB',
        p: 'max',
        gLL: 0.5,
        TU: 0,
        CS: 0.5,
        ct: true,
        desc: 'va xe CT / va tàu CV ; γp max',
      },
      {
        id: 'ĐB IIb',
        st: 'DB',
        p: 'min',
        gLL: 0.5,
        TU: 0,
        CS: 0.5,
        ct: true,
        desc: 'va xe CT / va tàu CV ; γp min',
      },
    );
  }
  const VAR: TrVariant[] = [];
  CB.forEach((cb) => {
    const dirs: Array<{ sx: number; sy: number; wd?: 'n' | 'd'; cd?: 'n' | 'd'; lab: string }> = [];
    if (cb.w) {
      for (const sy of [1, -1]) {
        for (const sx of [1, -1]) {
          dirs.push({
            sx,
            sy,
            wd: 'n',
            lab: `gió ngang ${sy > 0 ? '+Y' : '-Y'} (${sx > 0 ? '+X' : '-X'})`,
          });
        }
      }
      for (const sx of [1, -1]) {
        for (const sy of [1, -1]) {
          dirs.push({
            sx,
            sy,
            wd: 'd',
            lab: `gió dọc ${sx > 0 ? '+X' : '-X'} (${sy > 0 ? '+Y' : '-Y'})`,
          });
        }
      }
    } else if (cb.ct) {
      for (const d of ['n', 'd'] as const) {
        for (const sx of [1, -1]) {
          for (const sy of [1, -1]) {
            dirs.push({
              sx,
              sy,
              cd: d,
              lab: `${d === 'n' ? 'va ngang cầu' : 'va dọc cầu'} (${sx > 0 ? '+X' : '-X'},${sy > 0 ? '+Y' : '-Y'})`,
            });
          }
        }
      }
    } else {
      for (const sx of [1, -1]) {
        for (const sy of [1, -1]) {
          dirs.push({ sx, sy, lab: `(${sx > 0 ? '+X' : '-X'},${sy > 0 ? '+Y' : '-Y'})` });
        }
      }
    }
    dirs.forEach((d) => VAR.push({ cb, ...d, name: cb.id }));
  });
  VAR.forEach((vr) => {
    const cb = vr.cb;
    const e = cb.st === 'SD' ? 1 : I.eta;
    const gP = PP[cb.p];
    const t = new Float64Array(NO);
    const tp = new Float64Array(NO);
    const l = new Float64Array(NL);
    const lp = new Float64Array(NL);
    const teq = new Float64Array(NO);
    const leq = new Float64Array(NL);
    const add = (dst: Float64Array, src: Float64Array | undefined, c: number) => {
      if (!c || !src) return;
      for (let q = 0; q < dst.length; q++) dst[q] += c * src[q];
    };
    const eP = cb.p === 'min' || cb.p === 'IVb' ? 1 / e : e; // γ nhỏ nhất dùng 1/η (Phần 1, PT 3)
    for (const [k, gk] of [
      ['DC', 'DC'],
      ['DCp', 'DC'],
      ['DW', 'DW'],
    ] as const) {
      add(t, TT[k], eP * gP[gk]);
      add(tp, TT[k], eP * gP[gk]);
      add(l, LL[k], eP * gP[gk]);
      add(lp, LL[k], eP * gP[gk]);
    }
    const tb = Float64Array.from(tp);
    const lb = Float64Array.from(lp); // phần do tải trọng trọng lực (đứng) → M2b (TCVN 11823-4, Điều 5.3.2.2.2)
    add(t, cb.p === 'min' || cb.p === 'IVb' || cb.wH ? TT.WA2 : TT.WA2L, e);
    add(tb, cb.p === 'min' || cb.p === 'IVb' || cb.wH ? TT.WA2 : TT.WA2L, e);
    add(t, TT.WA3, e * vr.sy);
    add(l, LL.WA3, e * vr.sx);
    add(l, LL.TU, e * cb.TU * vr.sx);
    add(l, LL.CS, e * (cb.CS != null ? cb.CS : cb.TU) * vr.sx);
    if (cb.w) {
      const s = cb.w.V;
      if (vr.wd === 'n') {
        add(t, TT['WSn' + s], e * cb.w.g * vr.sy);
        add(t, TT.WLn, e * cb.w.WL * vr.sy);
        if (cb.w.WV) {
          add(t, vr.sy > 0 ? TT.WVp : TT.WVm, e * cb.w.WV);
          add(tb, vr.sy > 0 ? TT.WVp : TT.WVm, e * cb.w.WV);
        }
      } else {
        add(l, LL['WSd' + s], e * cb.w.g * vr.sx);
        add(l, LL.WLd, e * cb.w.WL * vr.sx);
        add(t, TT.WLn, (e * cb.w.WL * vr.sy * 0.5) / 1.46);
      }
    }
    if (cb.eq) {
      add(t, TT.EQn, e * cb.eq[1] * vr.sy);
      add(l, LL.EQd, e * cb.eq[0] * vr.sx);
      add(teq, TT.EQn, e * cb.eq[1] * vr.sy);
      add(leq, LL.EQd, e * cb.eq[0] * vr.sx);
    }
    if (cb.ct) {
      if (vr.cd === 'n') {
        add(t, TT.CTn, e * vr.sy);
        add(t, TT.CVn, e * vr.sy);
      } else {
        add(l, LL.CTd, e * vr.sx);
        add(l, LL.CVd, e * vr.sx);
      }
    }
    vr.t = t;
    vr.tp = tp;
    vr.l = l;
    vr.lp = lp;
    vr.tb = tb;
    vr.lb = lb;
    vr.teq = teq;
    vr.leq = leq;
    vr.gLL = e * cb.gLL;
  });
  return {
    UZ,
    K3,
    CEunit,
    runT,
    runL,
    qg: qb,
    I,
    G,
    M,
    LO,
    PL,
    MD,
    LD: LDo,
    C3,
    F,
    FL,
    ML,
    FLs,
    MLs,
    ALc,
    EL,
    ELi,
    NE,
    NO,
    NL,
    NL0,
    LS,
    kUx,
    kUy,
    NP,
    kP0,
    TT,
    LL,
    UH,
    UM,
    Ug,
    LLS,
    CB,
    VAR,
    armBR,
    sg: { V: sgV, M: sgM, Vl: sgVl, Ml: sgMl },
    EQ: { Wsup, Wm, W, Kt, Kl, Tt, Tl, S, Ct, Cl, R, fR, zone, kmin, zSupM, EQn, EQd },
  };
}

// ================= ỔN ĐỊNH ĐÀN HỒI (tải tới hạn) CỦA KHUNG CÓ LÒ XO ĐẤT =================
// (K - λ.Kg).u = 0 ; Kg: ma trận độ cứng hình học phần tử dầm 2D (Przemieniecki), lực nén P(e) trong phần tử ; λ nhỏ nhất bằng lặp nghịch đảo
export function trBuck(
  nodes: readonly FrameNode[],
  els: readonly TrFrameElement[],
  springs: readonly FrameSpring[],
  fix: readonly FrameFixity[],
  EIof: (e: TrFrameElement) => number,
  Pof: (e: TrFrameElement) => number,
): number {
  const nn = nodes.length;
  const adj: number[][] = [...Array(nn)].map(() => []);
  els.forEach((e) => {
    adj[e.i].push(e.j);
    adj[e.j].push(e.i);
  });
  const perm = new Int32Array(nn).fill(-1);
  const order: number[] = [];
  const deg = (i: number) => adj[i].length;
  while (order.length < nn) {
    let st = -1;
    for (let i = 0; i < nn; i++) if (perm[i] < 0 && (st < 0 || deg(i) < deg(st))) st = i;
    const Q = [st];
    perm[st] = 0;
    order.push(st);
    for (let h = 0; h < Q.length; h++) {
      const u = Q[h];
      adj[u]
        .filter((w) => perm[w] < 0)
        .sort((x, y) => deg(x) - deg(y))
        .forEach((w) => {
          perm[w] = 0;
          order.push(w);
          Q.push(w);
        });
    }
  }
  order.reverse();
  order.forEach((u, i) => (perm[u] = i));
  const nd = 3 * nn;
  const D = (n: number, d: number) => 3 * perm[n] + d;
  let bw = 2;
  els.forEach((e) => {
    bw = Math.max(bw, Math.abs(perm[e.i] - perm[e.j]) * 3 + 2);
  });
  const B = bw + 1;
  const K = new Float64Array(nd * B);
  const G = new Map<number, number>();
  const addK = (i: number, j: number, val: number) => {
    if (j > i) return;
    K[i * B + (i - j)] += val;
  };
  const addG = (i: number, j: number, val: number) => {
    const k = i * nd + j;
    G.set(k, (G.get(k) || 0) + val);
  };
  const asm = (add: (i: number, j: number, val: number) => void, e: TrFrameElement, kl: number[][]) => {
    const a = nodes[e.i];
    const b = nodes[e.j];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const L = Math.hypot(dx, dy);
    const c = dx / L;
    const sn = dy / L;
    const T = [
      [c, sn, 0, 0, 0, 0],
      [-sn, c, 0, 0, 0, 0],
      [0, 0, 1, 0, 0, 0],
      [0, 0, 0, c, sn, 0],
      [0, 0, 0, -sn, c, 0],
      [0, 0, 0, 0, 0, 1],
    ];
    const dof = [D(e.i, 0), D(e.i, 1), D(e.i, 2), D(e.j, 0), D(e.j, 1), D(e.j, 2)];
    for (let p = 0; p < 6; p++) {
      for (let q = 0; q < 6; q++) {
        let val = 0;
        for (let r = 0; r < 6; r++) {
          const tr = T[r][p];
          if (!tr) continue;
          for (let t = 0; t < 6; t++) val += tr * kl[r][t] * T[t][q];
        }
        if (val) add(dof[p], dof[q], val);
      }
    }
  };
  els.forEach((e) => {
    const a = nodes[e.i];
    const b = nodes[e.j];
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    const EI = EIof(e);
    const EA = e.EA / L;
    const k1 = (12 * EI) / L ** 3;
    const k2 = (6 * EI) / L ** 2;
    const k3 = (4 * EI) / L;
    const k4 = (2 * EI) / L;
    asm(addK, e, [
      [EA, 0, 0, -EA, 0, 0],
      [0, k1, k2, 0, -k1, k2],
      [0, k2, k3, 0, -k2, k4],
      [-EA, 0, 0, EA, 0, 0],
      [0, -k1, -k2, 0, k1, -k2],
      [0, k2, k4, 0, -k2, k3],
    ]);
    const P = Pof(e);
    if (P > 0) {
      const f = P / L;
      const g1 = (6 / 5) * f;
      const g2 = (L / 10) * f;
      const g3 = ((2 * L * L) / 15) * f;
      const g4 = ((-L * L) / 30) * f;
      asm(addG, e, [
        [0, 0, 0, 0, 0, 0],
        [0, g1, g2, 0, -g1, g2],
        [0, g2, g3, 0, -g2, g4],
        [0, 0, 0, 0, 0, 0],
        [0, -g1, -g2, 0, g1, -g2],
        [0, g2, g4, 0, -g2, g3],
      ]);
    }
  });
  springs.forEach((sp) => addK(D(sp.n, sp.dof), D(sp.n, sp.dof), sp.k));
  fix.forEach((f) => addK(D(f.n, f.dof), D(f.n, f.dof), 1e14));
  // Cholesky dạng băng
  for (let j = 0; j < nd; j++) {
    let d = K[j * B];
    for (let k = Math.max(0, j - bw); k < j; k++) {
      const l = K[j * B + (j - k)];
      d -= l * l;
    }
    if (d <= 0) return NaN;
    d = Math.sqrt(d);
    K[j * B] = d;
    for (let i = j + 1; i <= Math.min(nd - 1, j + bw); i++) {
      let val = K[i * B + (i - j)];
      for (let k = Math.max(0, i - bw); k < j; k++) val -= K[i * B + (i - k)] * K[j * B + (j - k)];
      K[i * B + (i - j)] = val / d;
    }
  }
  const solve = (F: Float64Array) => {
    const y = new Float64Array(nd);
    for (let i = 0; i < nd; i++) {
      let val = F[i];
      for (let k = Math.max(0, i - bw); k < i; k++) val -= K[i * B + (i - k)] * y[k];
      y[i] = val / K[i * B];
    }
    const u = new Float64Array(nd);
    for (let i = nd - 1; i >= 0; i--) {
      let val = y[i];
      for (let k = i + 1; k <= Math.min(nd - 1, i + bw); k++) val -= K[k * B + (k - i)] * u[k];
      u[i] = val / K[i * B];
    }
    return u;
  };
  const GI: number[] = [];
  const GJ: number[] = [];
  const GV: number[] = [];
  G.forEach((val, k) => {
    if (val) {
      GI.push(Math.floor(k / nd));
      GJ.push(k % nd);
      GV.push(val);
    }
  });
  const Gx = (x: Float64Array) => {
    const r = new Float64Array(nd);
    for (let q = 0; q < GV.length; q++) r[GI[q]] += GV[q] * x[GJ[q]];
    return r;
  };
  let x = new Float64Array(nd);
  for (let i = 0; i < nn; i++) x[D(i, 0)] = 1 + (3 * i) / nd;
  let lam = NaN;
  for (let it = 0; it < 500; it++) {
    const gx = Gx(x);
    const y = solve(gx);
    let numV = 0;
    let den = 0;
    for (let i = 0; i < nd; i++) {
      numV += x[i] * gx[i];
      den += y[i] * gx[i];
    }
    const l2 = den > 0 ? numV / den : NaN;
    let nr = 0;
    for (let i = 0; i < nd; i++) nr = Math.max(nr, Math.abs(y[i]));
    if (!(nr > 0)) return NaN;
    for (let i = 0; i < nd; i++) x[i] = y[i] / nr;
    if (it > 5 && Math.abs(l2 - lam) < 1e-7 * Math.abs(l2)) {
      lam = l2;
      break;
    }
    lam = l2;
  }
  return lam;
}

// tái tạo nội lực một trạng thái
export function trState(
  R: TrCalcResult,
  iv: number,
  is?: number,
): { t: Float64Array; l: Float64Array; v: TrVariant; s: TrLiveLoadState } {
  const vr = R.VAR![iv];
  const s = (vr.gLL! > 0 ? R.LLS! : [R.LLS![0]])[is || 0];
  const t = Float64Array.from(vr.t!);
  const l = Float64Array.from(vr.l!);
  const n = R.G.n;
  if (s && s.T) {
    for (let q = 0; q < R.NO!; q++) t[q] += vr.gLL! * s.T[q];
    const cM = vr.gLL! * vr.sx * ((s.Ml || 0) + ((s.BR || 0) / n) * R.armBR!);
    const cH = (vr.gLL! * vr.sx * (s.BR || 0)) / n;
    const cZ = vr.gLL! * vr.sx * (s.BR || 0) * (s.yBR || 0);
    for (let q = 0; q < R.NL!; q++) l[q] += cM * R.UM![q] + cH * R.UH![q] + cZ * R.UZ![q];
  }
  return { t, l, v: vr, s };
}

// ---------------------------------------------------------------------------
// 6. Core Solver Namespace (`TR` — Part 3: Check, Fast PM, Namespace Export)
// ---------------------------------------------------------------------------

export function trCheck(
  R: TrCalcResult,
  PM: { CD: any; DB: any; pCD?: any; pDB?: any } | null,
  SLI: { EIg: number; EsIs: number; EpIg: number; EsIsP: number },
): TrCheckResult {
  const { I, G } = R;
  const VAR = R.VAR!;
  const LLS = R.LLS!;
  const NO = R.NO!;
  const NL = R.NL!;
  const NL0 = R.NL0!;
  const LS = R.LS!;
  const ELi = R.ELi!;
  const MD = R.MD!;
  const UH = R.UH!;
  const UM = R.UM!;
  const UZ = R.UZ!;
  const armBR = R.armBR!;
  const n = G.n;
  const CB = R.CB!;
  const ids = CB.map((c) => c.id);
  const grp = (st: LimitStateType): 'SD' | 'DB' | 'CD' =>
    st === 'SD' ? 'SD' : st === 'DB' ? 'DB' : 'CD';

  // ---- độ mảnh (TCVN 11823-4, Điều 5.3.2.2.2 ; TCVN 11823-5, Điều 7.4.3) ----
  const PI2 = Math.PI ** 2;
  const luT = G.brace ? Math.max(G.ELcb - G.ELbt, G.ELbb - G.ELs) : G.ELcb - G.ELs;
  const luL = G.ELcb - G.ELs;
  const r = I.D / 4;
  const EIc = (bd: number) => Math.max(SLI.EIg / 5 + SLI.EsIs, SLI.EIg / 2.5) / (1 + bd);
  const EIp = (bd: number) => Math.max(SLI.EpIg / 5 + SLI.EsIsP, SLI.EpIg / 2.5) / (1 + bd);
  const capC = MD.capN[MD.xc.findIndex((val) => Math.abs(val) < 1e-3)];
  const BD = [0, 0.5, 1] as const;
  const isC = (e: TrFrameElement) => e.kind === 'col' || e.kind === 'pile';
  const eiOf = (bd: number) => (e: TrFrameElement) =>
    e.kind === 'col' ? EIc(bd) : e.kind === 'pile' ? EIp(bd) : e.EI;
  const pOf = (e: TrFrameElement | { kind: string }) => (isC(e as TrFrameElement) || e.kind === 'link' ? 1 : 0);
  const lamT = BD.map((bd) => trBuck(MD.nodes, MD.els, MD.springs, MD.fix, eiOf(bd), pOf));
  const lamTb = BD.map((bd) =>
    trBuck(MD.nodes, MD.els, MD.springs, [...MD.fix, { n: capC, dof: 0 }], eiOf(bd), pOf),
  );
  const Lmod = R.MLs!.map((m) => {
    const N = m.nodes.length;
    const nodes = [...m.nodes, { x: 0, y: G.zBr }];
    const els: any[] = [
      ...m.els,
      { i: N, j: 0, EA: m.els[0].EA * 100, EI: m.els[0].EI * 100, kind: 'link' },
    ];
    return { nodes, els, springs: m.springs, fix: m.fix, top: N };
  });
  const lamL = Lmod.map((m) =>
    BD.map((bd) => trBuck(m.nodes, m.els, m.springs, m.fix, eiOf(bd) as any, pOf as any)),
  );
  const lamLb = Lmod.map((m) =>
    BD.map((bd) =>
      trBuck(m.nodes, m.els, m.springs, [...m.fix, { n: m.top, dof: 0 }], eiOf(bd) as any, pOf as any),
    ),
  );
  const itp = (a: readonly number[], bd: number) => {
    const x = Math.max(0, Math.min(1, bd));
    return (
      (a[0] * (x - 0.5) * (x - 1)) / 0.5 +
      (a[1] * x * (1 - x)) / 0.25 +
      (a[2] * x * (x - 0.5)) / 0.5
    );
  };
  const PeT = (bd: number) => Math.min(itp(lamT, bd), (PI2 * EIc(bd)) / luT ** 2);
  const PeTb = (bd: number) => itp(lamTb, bd);
  const PeL = (c: number, bd: number) => Math.min(itp(lamL[c], bd), (PI2 * EIc(bd)) / luL ** 2);
  const PeLb = (c: number, bd: number) => itp(lamLb[c], bd);
  const KluT = Math.PI * Math.sqrt(EIc(0) / PeT(0));
  const KluL = Math.PI * Math.sqrt(EIc(0) / (MD.cols.reduce((t, _o, c) => t + PeL(c, 0), 0) / n));
  const SL: any = {
    luT,
    luL,
    r,
    lamT,
    lamTb,
    lamL,
    lamLb,
    KluT,
    KluL,
    Kt: KluT / luT,
    Kl: KluL / luL,
    lt: KluT / r,
    ll: KluL / r,
    EIc,
    EIp,
    PeT,
    PeTb,
    PeL,
    PeLb,
    ok: [...lamT, ...lamTb, ...lamL.flat(), ...lamLb.flat()].every((x) => x > 0),
  };
  SL.magT = SL.lt >= 22;
  SL.magL = SL.ll >= 22;
  SL.over = SL.lt > 100 || SL.ll > 100;
  SL.cmb = {};
  const dlt = (Pu: number, sumP: number, sumPe: number, Peb: number) => {
    const a = 1 - sumP / (0.75 * sumPe);
    const b = 1 - Pu / (0.75 * Peb);
    return {
      ds: a > 0 ? 1 / a : Infinity,
      db: Math.max(1, b > 0 ? 1 / b : Infinity),
      sumP,
      sumPe,
      Peb,
    };
  };
  const mcf = (M: number, Mb: number, o: { ds: number; db: number }, sw: boolean) => {
    const sg0 = M < 0 ? -1 : 1;
    return sw ? sg0 * o.ds * Math.abs(M) : sg0 * (o.db * Math.abs(Mb) + o.ds * Math.abs(M - Mb));
  };
  // ---- mặt cắt xà mũ, giằng: chỉ số mẫu ----
  const capAt = (x: number) => {
    let qi = -1;
    let qj = -1;
    MD.capE.forEach((k) => {
      const e = MD.els[k];
      if (Math.abs((e.xa ?? 0) - x) < 1e-3) qi = ELi[k];
      if (Math.abs((e.xb ?? 0) - x) < 1e-3) qj = ELi[k];
    });
    return { qi, qj };
  };
  const ax = !+I.secM;
  const a = ax ? 0 : 0.443 * I.D;
  const cand: any[] = [];
  const W = ax ? 'tim cột' : 'mép cột';
  const Wc = ax ? 'Tim cột' : 'Mép cột';
  cand.push({ nm: `Hẫng trái (${W} 1)`, x: G.xs[0] - a, kind: 'neg', side: 'L' });
  for (let c = 0; c + 1 < n; c++) {
    cand.push(
      { nm: `${Wc} ${c + 1} - phía phải`, x: G.xs[c] + a, kind: 'neg', side: 'R' },
      { nm: `Giữa nhịp cột ${c + 1} - ${c + 2}`, x: (G.xs[c] + G.xs[c + 1]) / 2, kind: 'pos' },
      { nm: `${Wc} ${c + 2} - phía trái`, x: G.xs[c + 1] - a, kind: 'neg', side: 'L' },
    );
    MD.xc.forEach((xx) => {
      const xm = (G.xs[c] + G.xs[c + 1]) / 2;
      if (
        xx > G.xs[c] + 0.443 * I.D + 1e-6 &&
        xx < G.xs[c + 1] - 0.443 * I.D - 1e-6 &&
        Math.abs(xx - xm) > 1e-6
      ) {
        cand.push({ nm: `Nhịp cột ${c + 1} - ${c + 2}, x = ${fx(xx, 2)} m`, x: xx, kind: 'pos' });
      }
    });
  }
  cand.push({ nm: `Hẫng phải (${W} ${n})`, x: G.xs[n - 1] + a, kind: 'neg', side: 'R' });
  const snap = (x: number) => MD.xc.reduce((b, val) => (Math.abs(val - x) < Math.abs(b - x) ? val : b), MD.xc[0]);
  cand.forEach((s) => {
    s.xs = snap(s.x);
    Object.assign(s, capAt(s.xs));
    if (ax && s.side === 'L') s.qi = -1;
    if (ax && s.side === 'R') s.qj = -1;
    s.h = G.hAt(s.xs);
  });
  const brC: any[] = [];
  if (G.brace) {
    MD.brE.forEach((seg, sp) => {
      const els = seg.filter((k) => MD.els[k].kind === 'brace');
      if (!els.length) return;
      const mid = els[Math.floor(els.length / 2)];
      const oa = ax ? I.D / 2 : 0;
      brC.push(
        { nm: `Giằng nhịp ${sp + 1} - ${W} ${sp + 1}`, qi: ELi[els[0]], qj: -1, off: oa, kind: 'neg', sp },
        { nm: `Giằng nhịp ${sp + 1} - giữa nhịp`, qi: ELi[mid], qj: -1, kind: 'pos', sp },
        {
          nm: `Giằng nhịp ${sp + 1} - ${W} ${sp + 2}`,
          qi: -1,
          qj: ELi[els[els.length - 1]],
          off: oa,
          kind: 'neg',
          sp,
        },
      );
    });
  }
  const secVal = (tv: Float64Array, s: { qi: number; qj: number; off?: number }) => {
    const qi = s.qi;
    const qj = s.qj;
    const f = s.off || 0;
    const M = qi >= 0 ? tv[6 * qi + 2] - f * tv[6 * qi + 1] : tv[6 * qj + 5] + f * tv[6 * qj + 4];
    const N = -(qi >= 0 ? tv[6 * qi] : tv[6 * qj + 3]);
    const V1 = qi >= 0 ? tv[6 * qi + 1] : 0;
    const V2 = qj >= 0 ? tv[6 * qj + 4] : 0;
    return { M, N, V: Math.abs(V1) >= Math.abs(V2) ? V1 : V2 };
  };
  const SE: Record<string, { cap: any[]; br: any[] }> = {};
  ids.forEach((id) => {
    SE[id] = {
      cap: cand.map(() => ({ mx: null, mn: null, v: null })),
      br: brC.map(() => ({ mx: null, mn: null, v: null })),
    };
  });
  // ---- bao nội lực (khung ngang: mọi đầu phần tử ; dọc cầu: thân cột) ----
  const mk = () => ({
    mx: new Float64Array(NO).fill(-Infinity),
    mn: new Float64Array(NO).fill(Infinity),
    lmx: new Float64Array(NL).fill(-Infinity),
    lmn: new Float64Array(NL).fill(Infinity),
  });
  const ENV: Record<string, any> = { CD: mk(), SD: mk(), DB: mk() };
  ids.forEach((id) => (ENV[id] = mk()));
  // ---- thân cột: chỉ số mẫu (đầu i, j các phần tử cột) ----
  const CS = MD.cols.map((o) => {
    const q: Array<{ e: number; end: 'i' | 'j'; y: number; lq: number }> = [];
    for (let s = 1; s <= o.gs; s++) {
      const e = ELi[o.seg[s]];
      q.push(
        { e, end: 'i', y: MD.els[o.seg[s]].ytop!, lq: 2 * (s - 1) },
        { e, end: 'j', y: MD.els[o.seg[s]].ybot!, lq: 2 * (s - 1) + 1 },
      );
    }
    return q;
  });
  const colRec: { CD: Record<string, any>; DB: Record<string, any> } = { CD: {}, DB: {} };
  const keyBest = (o: Record<string, any>, key: string, val: number, rec: any) => {
    if (!o[key] || val > o[key].val) o[key] = { val, ...rec };
  };
  const pileRows: Record<string, Array<{ M: any; N: any }>> = {};
  ids.forEach((id) => (pileRows[id] = MD.cols.map(() => ({ M: null, N: null }))));
  const pileTab: any[] = [];
  const grpN = { CD: -Infinity, DB: -Infinity };
  let nStates = 0;
  // ---- cọc dưới mặt đất sau xói ----
  const PSt = G.pile
    ? MD.cols.map((o) => {
        const q: any[] = [];
        for (let s = o.gs + 1; s < o.seg.length; s++) {
          const el = MD.els[o.seg[s]];
          const k = s - o.gs;
          q.push(
            { e: ELi[o.seg[s]], end: 'i', y: el.ytop, lq: 2 * (s - 1), k: k - 1 },
            { e: ELi[o.seg[s]], end: 'j', y: el.ybot, lq: 2 * (s - 1) + 1, k },
          );
        }
        const zK = Math.max(10, 10 * I.D);
        return q.filter(
          (sm, i) => G.ELs - sm.y <= zK + 1e-6 || i % 8 === 0 || i % 8 === 1 || i >= q.length - 2,
        );
      })
    : null;
  const NPn = R.NP || 0;
  const oL = 2 * LS.length + 1 + (MD.zl.length - 1);
  const pileRec: { CD: Record<string, any>; DB: Record<string, any> } = { CD: {}, DB: {} };
  const PE: Record<string, any> = {};
  const peMk = () =>
    PSt!.map((q) =>
      q.map(() => ({
        Nmx: -Infinity,
        Nmn: Infinity,
        M2: 0,
        M3: 0,
        M: 0,
        Q2: 0,
        Q3: 0,
        uT: 0,
        uL: 0,
        uZ: 0,
        pT: 0,
        pL: 0,
      })),
    );
  const PKEYS = ['Nmax', 'Nmin', 'Q2max', 'Q3max', 'M3max', 'M2max', 'M1max'] as const;
  const peUpd = (
    E: any,
    P: number,
    aM3: number,
    aM2: number,
    Mu: number,
    aVt: number,
    aVl: number,
    auT: number,
    auL: number,
    auZ: number,
    apT: number,
    apL: number,
  ) => {
    if (P > E.Nmx) E.Nmx = P;
    if (P < E.Nmn) E.Nmn = P;
    if (aM3 > E.M3) E.M3 = aM3;
    if (aM2 > E.M2) E.M2 = aM2;
    if (Mu > E.M) E.M = Mu;
    if (aVt > E.Q2) E.Q2 = aVt;
    if (aVl > E.Q3) E.Q3 = aVl;
    if (auT > E.uT) E.uT = auT;
    if (auL > E.uL) E.uL = auL;
    if (auZ > E.uZ) E.uZ = auZ;
    if (apT > E.pT) E.pT = apT;
    if (apL > E.pL) E.pL = apL;
  };
  if (PSt) {
    (['CD', 'SD', 'DB'] as const).forEach((g0) => (PE[g0] = peMk()));
    ids.forEach((id) => (PE[id] = peMk()));
  }
  const t = new Float64Array(NO);
  const l = new Float64Array(NL);
  const sg = R.sg!;
  const qb = R.qg!;
  const fRm = (R.EQ?.fR ?? 1) - 1;
  if (PSt) {
    PSt.forEach((q, c) =>
      q.forEach((sm) => {
        sm.o = 6 * sm.e + (sm.end === 'i' ? 0 : 3);
        sm.iV = c * NL0 + 2 * sm.lq;
        sm.qn = R.kP0! + 2 * (c * NPn + sm.k);
        sm.iU = c * NL0 + oL + sm.k;
        sm.z = G.ELs - sm.y;
        sm.kz = I.pKz ? I.pKz(sm.z) : 0;
      }),
    );
  }
  const IT = (() => {
    const S = new Set<number>();
    const a3 = (o: number) => {
      S.add(o);
      S.add(o + 1);
      S.add(o + 2);
    };
    [...cand, ...brC].forEach((c) => {
      if (c.qi >= 0) a3(6 * c.qi);
      if (c.qj >= 0) a3(6 * c.qj + 3);
    });
    CS.forEach((q) => q.forEach((sm) => a3(6 * sm.e + (sm.end === 'i' ? 0 : 3))));
    if (PSt) {
      PSt.forEach((q, c) =>
        q.forEach((sm) => {
          a3(6 * sm.e + (sm.end === 'i' ? 0 : 3));
          const qn = R.kP0! + 2 * (c * NPn + sm.k);
          S.add(qn);
          S.add(qn + 1);
        }),
      );
    }
    S.add(R.kUx!);
    S.add(R.kUy!);
    return Int32Array.from([...S].filter((q) => q >= 0 && q < NO));
  })();
  const IL = (() => {
    const S = new Set<number>([1, 2 * LS.length]);
    CS.forEach((q, c) => {
      q.forEach((sm) => {
        S.add(c * NL0 + 2 * sm.lq);
        S.add(c * NL0 + 2 * sm.lq + 1);
      });
      S.add(c * NL0 + 2 * qb);
      S.add(c * NL0 + 2 * qb + 1);
      S.add(c * NL0 + 2 * LS.length);
    });
    if (PSt) {
      PSt.forEach((q, c) =>
        q.forEach((sm) => {
          S.add(c * NL0 + 2 * sm.lq);
          S.add(c * NL0 + 2 * sm.lq + 1);
          S.add(c * NL0 + oL + sm.k);
        }),
      );
    }
    return Int32Array.from([...S].filter((q) => q >= 0 && q < NL));
  })();
  const LLX = (() => {
    const TX = new Float64Array(NO).fill(-Infinity);
    const TN = new Float64Array(NO).fill(Infinity);
    const LX = new Float64Array(NL).fill(-Infinity);
    const LN = new Float64Array(NL).fill(Infinity);
    LLS.forEach((s) => {
      if (s.T) {
        for (let q = 0; q < NO; q++) {
          const x = s.T[q];
          if (x > TX[q]) TX[q] = x;
          if (x < TN[q]) TN[q] = x;
        }
        const cM = (s.Ml || 0) + ((s.BR || 0) / n) * armBR;
        const cH = (s.BR || 0) / n;
        const cZ = (s.BR || 0) * (s.yBR || 0);
        for (let q = 0; q < NL; q++) {
          const x = cM * UM[q] + cH * UH[q] + cZ * UZ[q];
          if (x > LX[q]) LX[q] = x;
          if (x < LN[q]) LN[q] = x;
        }
      } else {
        for (let q = 0; q < NO; q++) {
          if (0 > TX[q]) TX[q] = 0;
          if (0 < TN[q]) TN[q] = 0;
        }
        for (let q = 0; q < NL; q++) {
          if (0 > LX[q]) LX[q] = 0;
          if (0 < LN[q]) LN[q] = 0;
        }
      }
    });
    for (let q = 0; q < NO; q++) {
      if (!isFinite(TX[q])) {
        TX[q] = 0;
        TN[q] = 0;
      }
    }
    for (let q = 0; q < NL; q++) {
      if (!isFinite(LX[q])) {
        LX[q] = 0;
        LN[q] = 0;
      }
    }
    return { TX, TN, LX, LN };
  })();
  VAR.forEach((vr, iv) => {
    const sets = vr.gLL! > 0 ? LLS : [LLS[0]];
    const st = vr.cb.st;
    const G2 = grp(st);
    const E1 = ENV[G2];
    const E2 = ENV[vr.cb.id];
    const T = PM ? PM[st === 'DB' ? 'DB' : 'CD'] : null;
    const SEv = SE[vr.cb.id];
    const vmaxN = MD.cols.map(() => -Infinity);
    const vminN = MD.cols.map(() => Infinity);
    let vDisp: [number, number, number] | null = null;
    sets.forEach((s, is) => {
      nStates++;
      if (s.T) {
        const gl = vr.gLL!;
        const cM = gl * vr.sx * ((s.Ml || 0) + ((s.BR || 0) / n) * armBR);
        const cH = (gl * vr.sx * (s.BR || 0)) / n;
        const cZ = gl * vr.sx * (s.BR || 0) * (s.yBR || 0);
        for (let k = 0; k < IT.length; k++) {
          const q = IT[k];
          t[q] = vr.t![q] + gl * s.T[q];
        }
        for (let k = 0; k < IL.length; k++) {
          const q = IL[k];
          l[q] = vr.l![q] + cM * UM[q] + cH * UH[q] + cZ * UZ[q];
        }
      } else {
        for (let k = 0; k < IT.length; k++) {
          const q = IT[k];
          t[q] = vr.t![q];
        }
        for (let k = 0; k < IL.length; k++) {
          const q = IL[k];
          l[q] = vr.l![q];
        }
      }
      const tag = { iv, is };
      cand.forEach((c, i) => {
        const o = secVal(t, c);
        const e = SEv.cap[i];
        if (!e.mx || o.M > e.mx.M) e.mx = { ...o, ...tag };
        if (!e.mn || o.M < e.mn.M) e.mn = { ...o, ...tag };
        if (!e.v || Math.abs(o.V) > Math.abs(e.v.V)) e.v = { ...o, ...tag };
      });
      brC.forEach((c, i) => {
        const o = secVal(t, c);
        const e = SEv.br[i];
        if (!e.mx || o.M > e.mx.M) e.mx = { ...o, ...tag };
        if (!e.mn || o.M < e.mn.M) e.mn = { ...o, ...tag };
        if (!e.v || Math.abs(o.V) > Math.abs(e.v.V)) e.v = { ...o, ...tag };
      });
      const Pu = CS.map((q) => -t[6 * q[0].e]);
      const sumP = Pu.reduce((x, y) => x + y, 0);
      let ic = 0;
      CS.forEach((q, c) => {
        if (Math.abs(t[6 * q[0].e + 2]) > Math.abs(t[6 * CS[ic][0].e + 2])) ic = c;
      });
      const mT = t[6 * CS[ic][0].e + 2];
      const mTp = vr.tp![6 * CS[ic][0].e + 2];
      const bdT = Math.abs(mT) > 1e-9 ? Math.min(1, Math.abs(mTp / mT)) : 0;
      const bdL = Math.abs(l[1]) > 1e-9 ? Math.min(1, Math.abs(vr.lp![1] / l[1])) : 0;
      const gl = vr.gLL!;
      const tbA = (o: number) => vr.tb![o] + (s.T ? gl * (s.T[o] - (s.CE || 0) * R.CEunit![o]) : 0);
      const lbA = (q: number) => vr.lb![q] + (s.T ? gl * vr.sx * (s.Ml || 0) * UM[q] : 0);
      const swT = Math.abs(tbA(R.kUx!)) > luT / 1500;
      const sPu = Math.max(sumP, 0);
      const sPeT = n * PeT(bdT);
      const sPeL = MD.cols.reduce((a0, _o, c) => a0 + PeL(c, bdL), 0);
      let sPb = 0;
      CS.forEach((q, c) => {
        const Pc = Math.max(Pu[c], 0);
        const dT: any = SL.magT ? dlt(Pc, sPu, sPeT, PeTb(bdT)) : { ds: 1, db: 1, sumP: sPu, sumPe: sPeT };
        const dL: any = SL.magL
          ? dlt(Pc, sPu, sPeL, PeLb(c, bdL))
          : { ds: 1, db: 1, sumP: sPu, sumPe: sPeL };
        const oTop = c * NL0 + 2 * LS.length;
        const swL = Math.abs(lbA(oTop)) > luL / 1500;
        dT.sw = swT;
        dL.sw = swL;
        dT.d = Math.max(dT.ds, dT.db);
        dL.d = Math.max(dL.ds, dL.db);
        if (c === 0 && st !== 'SD') {
          const o = SL.cmb[vr.cb.id];
          if (!o || sPu > o.sumP) {
            SL.cmb[vr.cb.id] = {
              sumP: sPu,
              bdT,
              bdL,
              sPeT,
              sPeL,
              dsT: dT.ds,
              dsL: dL.ds,
              swT,
              swL,
              iv,
              is,
            };
          }
        }
        if (Pu[c] > vmaxN[c]) vmaxN[c] = Pu[c];
        if (Pu[c] < vminN[c]) vminN[c] = Pu[c];
        q.forEach((sm) => {
          const o = 6 * sm.e + (sm.end === 'i' ? 0 : 3);
          const P = -t[o];
          const Vt = t[o + 1];
          const Mt = t[o + 2];
          const Vl = l[c * NL0 + 2 * sm.lq];
          const Ml = l[c * NL0 + 2 * sm.lq + 1];
          const M3 = mcf(Mt, tbA(o + 2), dT, swT);
          const M2 = mcf(Ml, lbA(c * NL0 + 2 * sm.lq + 1), dL, swL);
          const Mu = Math.sqrt(M3 * M3 + M2 * M2);
          if (st === 'SD') return;
          let rat = 0;
          if (T) {
            if (P > T.P1) rat = P / T.P1;
            else if (P < T.P0) rat = 1 + P / T.P0;
            else {
              const f = (P - T.P0) * T.k;
              const idx = f >= T.N ? T.N - 1 : f | 0;
              const m = T.tab[idx] + (T.tab[idx + 1] - T.tab[idx]) * (f - idx);
              rat = m > 1e-9 ? Mu / m : Mu > 1e-9 ? 99 : 0;
            }
          }
          const rec = {
            c,
            y: sm.y,
            P,
            Q2: Vt,
            Q3: Vl,
            M2,
            M3,
            Mt,
            Ml,
            Mtb: tbA(o + 2),
            Mlb: lbA(c * NL0 + 2 * sm.lq + 1),
            dT: Math.abs(Mt) > 1e-9 ? Math.abs(M3 / Mt) : 1,
            dL: Math.abs(Ml) > 1e-9 ? Math.abs(M2 / Ml) : 1,
            dTo: dT,
            dLo: dL,
            bdT,
            bdL,
            rat,
            iv,
            is,
          };
          const CR = colRec[st === 'DB' ? 'DB' : 'CD'];
          keyBest(CR, 'Nmax', P, rec);
          keyBest(CR, 'Nmin', -P, rec);
          keyBest(CR, 'Q2max', Math.abs(Vt), rec);
          keyBest(CR, 'Q3max', Math.abs(Vl), rec);
          keyBest(CR, 'M3max', Math.abs(M3), rec);
          keyBest(CR, 'M2max', Math.abs(M2), rec);
          keyBest(CR, 'M1max', rat, rec);
        });
        const qe = CS[c][CS[c].length - 1].e;
        const o = 6 * qe + 3;
        const eq = st === 'DB' && fRm > 0;
        const Pb = -(t[o] + (eq ? fRm * vr.teq![o] : 0));
        const Hy = sg.V * (t[o + 1] + (eq ? fRm * vr.teq![o + 1] : 0));
        const Mx = sg.M * (t[o + 2] + (eq ? fRm * vr.teq![o + 2] : 0));
        const Hx = sg.Vl * (l[c * NL0 + 2 * qb] + (eq ? fRm * vr.leq![c * NL0 + 2 * qb] : 0));
        const My = sg.Ml * (l[c * NL0 + 2 * qb + 1] + (eq ? fRm * vr.leq![c * NL0 + 2 * qb + 1] : 0));
        sPb += Pb;
        const pr = pileRows[vr.cb.id][c];
        const Mr = Math.hypot(Mx, My);
        const row = { Hx, Hy, P: Pb, Mx, My, Mr, iv, is };
        if (!pr.M || Mr > pr.M.Mr) pr.M = row;
        if (!pr.N || Pb > pr.N.P) pr.N = row;
        if (PSt) {
          const Tp = PM && PM.pCD ? (st === 'DB' ? PM.pDB : PM.pCD) : null;
          const PR = pileRec[st === 'DB' ? 'DB' : 'CD'];
          const A0 = PE[G2][c];
          const B0 = PE[vr.cb.id][c];
          const xFn = (arr: Float64Array, ea: Float64Array, qq: number) => arr[qq] + (eq ? fRm * ea[qq] : 0);
          const aT = I.pAlT ? I.pAlT[c] : 1;
          const aL = R.ALc![c];
          PSt[c].forEach((sm, j) => {
            const oo = sm.o;
            const iV = sm.iV;
            const P = -xFn(t, vr.teq!, oo);
            const Vt = xFn(t, vr.teq!, oo + 1);
            const Mt0 = xFn(t, vr.teq!, oo + 2);
            const Vl = xFn(l, vr.leq!, iV);
            const Ml0 = xFn(l, vr.leq!, iV + 1);
            const M3 = mcf(Mt0, tbA(oo + 2), dT, swT);
            const M2 = mcf(Ml0, lbA(iV + 1), dL, swL);
            const Mu = Math.sqrt(M3 * M3 + M2 * M2);
            const qn = sm.qn;
            const uT = xFn(t, vr.teq!, qn);
            const uZ = xFn(t, vr.teq!, qn + 1);
            const uL = xFn(l, vr.leq!, sm.iU);
            const z = sm.z;
            const kz = sm.kz;
            const pT = kz * aT * uT;
            const pL = kz * aL * uL;
            const aM3 = M3 < 0 ? -M3 : M3;
            const aM2 = M2 < 0 ? -M2 : M2;
            const aVt = Vt < 0 ? -Vt : Vt;
            const aVl = Vl < 0 ? -Vl : Vl;
            const auT = uT < 0 ? -uT : uT;
            const auL = uL < 0 ? -uL : uL;
            const auZ = uZ < 0 ? -uZ : uZ;
            const apT = pT < 0 ? -pT : pT;
            const apL = pL < 0 ? -pL : pL;
            peUpd(A0[j], P, aM3, aM2, Mu, aVt, aVl, auT, auL, auZ, apT, apL);
            peUpd(B0[j], P, aM3, aM2, Mu, aVt, aVl, auT, auL, auZ, apT, apL);
            if (st === 'SD') return;
            let rat = 0;
            if (Tp) {
              if (P > Tp.P1) rat = P / Tp.P1;
              else if (P < Tp.P0) rat = 1 + P / Tp.P0;
              else {
                const f = (P - Tp.P0) * Tp.k;
                const idx = f >= Tp.N ? Tp.N - 1 : f | 0;
                const m = Tp.tab[idx] + (Tp.tab[idx + 1] - Tp.tab[idx]) * (f - idx);
                rat = m > 1e-9 ? Mu / m : Mu > 1e-9 ? 99 : 0;
              }
            }
            const m1 = Tp ? rat : Mu;
            const gt = (k: string, val: number) => {
              const o2 = PR[k];
              return !o2 || val > o2.val;
            };
            if (
              !(
                gt('Nmax', P) ||
                gt('Nmin', -P) ||
                gt('Q2max', aVt) ||
                gt('Q3max', aVl) ||
                gt('M3max', aM3) ||
                gt('M2max', aM2) ||
                gt('M1max', m1)
              )
            ) {
              return;
            }
            const V7 = [P, -P, aVt, aVl, aM3, aM2, m1];
            const rec = {
              c,
              y: sm.y,
              z,
              P,
              Q2: Vt,
              Q3: Vl,
              M2,
              M3,
              Mt: Mt0,
              Ml: Ml0,
              dT: Math.abs(Mt0) > 1e-9 ? Math.abs(M3 / Mt0) : 1,
              dL: Math.abs(Ml0) > 1e-9 ? Math.abs(M2 / Ml0) : 1,
              dTo: dT,
              dLo: dL,
              rat,
              iv,
              is,
            };
            for (let q = 0; q < 7; q++) keyBest(PR, PKEYS[q], V7[q], rec);
          });
        }
      });
      {
        const g0 = st === 'DB' ? 'DB' : 'CD';
        if (sPb > grpN[g0]) grpN[g0] = sPb;
      }
      const ux = l[2 * LS.length];
      const uy = t[R.kUx!];
      const uz = t[R.kUy!];
      if (!vDisp || Math.hypot(ux, uy) > Math.hypot(vDisp[0], vDisp[1])) vDisp = [ux, uy, uz];
    });
    {
      const gl = vr.gLL! > 0 ? vr.gLL! : 0;
      const cL = gl * vr.sx;
      for (const E of [E1, E2]) {
        for (let q = 0; q < NO; q++) {
          const a0 = vr.t![q];
          const hi = a0 + (gl ? gl * LLX.TX[q] : 0);
          const lo = a0 + (gl ? gl * LLX.TN[q] : 0);
          if (hi > E.mx[q]) E.mx[q] = hi;
          if (lo < E.mn[q]) E.mn[q] = lo;
        }
        for (let q = 0; q < NL; q++) {
          const a0 = vr.l![q];
          const u1 = gl ? cL * LLX.LX[q] : 0;
          const u2 = gl ? cL * LLX.LN[q] : 0;
          const hi = a0 + Math.max(u1, u2);
          const lo = a0 + Math.min(u1, u2);
          if (hi > E.lmx[q]) E.lmx[q] = hi;
          if (lo < E.lmn[q]) E.lmn[q] = lo;
        }
      }
    }
    pileTab.push({
      iv,
      name: vr.name,
      lab: vr.lab,
      st: vr.cb.st,
      maxN: vmaxN,
      minN: vminN,
      disp: vDisp,
    });
  });
  const pickSec = (list: any[], E: Record<string, any[]>, kind: 'neg' | 'pos') => {
    let best = -1;
    let bv = 0;
    list.forEach((_s, i) => {
      ids.forEach((id) => {
        if (CB.find((c) => c.id === id)!.st === 'SD') return;
        const e = E[id][i];
        if (!e || !e.mx) return;
        const val = kind === 'neg' ? -e.mn.M : e.mx.M;
        if (val > bv) {
          bv = val;
          best = i;
        }
      });
    });
    return best;
  };
  const capE: Record<string, any[]> = {};
  const brE: Record<string, any[]> = {};
  ids.forEach((id) => {
    capE[id] = SE[id].cap;
    brE[id] = SE[id].br;
  });
  const iA = pickSec(cand, capE, 'neg');
  const iB = pickSec(cand, capE, 'pos');
  const gA = pickSec(brC, brE, 'neg');
  const gB = pickSec(brC, brE, 'pos');
  return {
    SL,
    ENV,
    cand,
    brC,
    capE,
    brE,
    iA,
    iB,
    gA,
    gB,
    colRec,
    pileRows,
    pileTab,
    grpN,
    nStates,
    PSt,
    PE,
    pileRec,
  } as unknown as TrCheckResult;
}

export function trFast(C: { pts: Array<{ P: number }>; cap: number }) {
  const P0 = C.pts[0].P;
  const P1 = C.cap;
  const N = 800;
  const tab = new Float64Array(N + 1);
  for (let i = 0; i <= N; i++) tab[i] = phiMnAt(C as any, P0 + ((P1 - P0) * i) / N);
  return { P0, P1, N, tab, k: N / (P1 - P0) };
}

export const TR = {
  g,
  geom: trGeom,
  mat: trMat,
  llLong: trLlLong,
  lever: trLever,
  placements: trPlacements,
  model: trModel,
  modelL: trModelL,
  loads: trLoads,
  resAt: trResAt,
  mL: trMultiPresence,
  CL: trFlowAngleCoeff,
  PD: trWindPressure,
  calc: trCalc,
  buck: trBuck,
  state: trState,
  check: trCheck,
  fast: trFast,
} as const;

// ---------------------------------------------------------------------------
// 7. Runtime State, Lifecycle, Linking & Pile-Soil Helpers
// ---------------------------------------------------------------------------

export let TRR: TrCalcResult | null = null;
export let TRC: TrCheckResult | null = null;
export let TRLK: { CD: any[]; DB: any[] } | null = null;
export let TRXY: Array<[number, number]> | null = null;
export let TRROWS: { CD: any[]; DB: any[] } | null = null;
export let TRSHOW: Record<string, any> = {};
let trTimer: ReturnType<typeof setTimeout> | null = null;
let latestTrEq: Record<string, boolean> = {};
let latestRkBr: { ok: boolean; u: number; lim: number } | null = null;
let latestConfOK: Record<string, boolean> = {};

const syncWindowGlobals = () => {
  if (typeof window !== 'undefined') {
    const w = window as any;
    w.TRR = TRR;
    w.TRC = TRC;
    w.TRLK = TRLK;
    w.TRXY = TRXY;
    w.TRROWS = TRROWS;
    w.TRSHOW = TRSHOW;
  }
};

export function trOn(): boolean {
  return v('tq_kn', '') === 'n' && v('tq_tru', '') === 'deo';
}

function igOnTru(): boolean {
  const off = itOffSet();
  return ['ttt', 'tnl', 'txm', 'tth', 'tnc', 'tsc', 'tvl'].some((k) => !off.has(k));
}

export function trVis(): void {
  if (typeof document !== 'undefined' && document.body) {
    document.body.classList.toggle('hastd', trOn());
  }
  try {
    pierSolidBridgeHooks.dcVis?.();
  } catch {
    // optional solid pier hook
  }
}

export function trSchedule(): void {
  if (trTimer != null) clearTimeout(trTimer);
  if (!igOnTru()) return;
  trTimer = setTimeout(() => {
    try {
      if (pierSolidBridgeHooks.dcOn?.()) pierSolidBridgeHooks.dcStep?.();
      else trStep();
    } catch (e) {
      console.error(e);
    }
  }, 350);
}

const TR_STR: Readonly<Record<string, 1>> = {
  tip: 1,
  tie: 1,
  name: 1,
  lcv: 1,
  dk: 1,
  dc: 1,
  dside: 1,
  ixm: 1,
  gpl: 1,
};

export function trLink(): void {
  if (objLinkOff()) {
    objUnlock();
    return;
  }
  const setLnk = (id: string, val: unknown) => {
    const numVal = Number(val);
    if (val == null || !isFinite(numVal)) return;
    const s = String(+numVal.toFixed(6));
    const e = $(id);
    if (e) {
      if (e.value !== s) e.value = s;
      e.readOnly = true;
      e.classList?.add('lnk');
      e.title = 'Lấy tự động từ sheet dầm, gối, tải trọng mố';
    } else {
      sv(id, s);
    }
  };
  const DAMR = getLatestDamResult() as any;
  if (DAMR && DAMR.I && DAMR.g) {
    const I = DAMR.I;
    const g0 = DAMR.g;
    setLnk('td_L1', I.Lt);
    setLnk('td_L2', I.Lt);
    setLnk('td_a0', I.a0);
    setLnk('td_nb', I.Ng);
    setLnk('td_sg', I.S);
    setLnk('td_Wd', I.Wb);
    setLnk('td_bl', I.Wpa + (I.WPL || 0));
    setLnk('td_br2', I.Wpa + (I.WPL || 0));
    setLnk('td_wp', I.WPL || 0);
    setLnk('td_Hgd', g0.H / 1000);
    setLnk('td_hs', I.hs);
    setLnk('td_tpd', v('sp_type', '') === 'I' ? num('gi_tpan') || 0 : 0);
    setLnk('td_Hsu', I.Hsu);
    setLnk('td_Hra', I.Hpa);
    setLnk('td_Hrl', num('sp_Hra'));
    setLnk('td_IM', I.IM * 100);
  }
  const gRaw = (id: string): string | null => {
    const e = $(id);
    return e ? e.value : null;
  };
  const nm = (id: string): number | null => {
    const raw = gRaw(id);
    if (raw == null) return null;
    const parsed = parseFloat(String(raw).replace(',', '.'));
    return isFinite(parsed) ? parsed : null;
  };
  const gcNb = nm('gc_nb');
  if (gcNb != null && !supK()) {
    setLnk('td_nbg', gcNb);
    setLnk('td_Gb', (nm('gc_G') || 0) * 1000);
    setLnk('td_ga', (nm('gc_L') || 0) / 1000);
    setLnk('td_gb2', (nm('gc_W') || 0) / 1000);
    setLnk('td_hrt', ((nm('gc_n') || 0) * (nm('gc_hri') || 0) + 2 * (nm('gc_hc') || 0)) / 1000);
  }
  if (nm('mo_S') != null) {
    setLnk('td_Vce', nm('mo_Vce'));
    setLnk('td_Rce', nm('mo_Rce'));
    setLnk('td_VB', [38, 45, 53, 59][(Number(gRaw('mo_wz')) || 2) - 1]);
    setLnk('td_S', nm('mo_S'));
    setLnk('td_V25', nm('mo_V25'));
    setLnk('td_Cd1', nm('mo_Cd1'));
    setLnk('td_Cd2', nm('mo_Cd2'));
    setLnk('td_A', nm('mo_A'));
    setLnk('td_gEQ', nm('mo_gEQ'));
    setLnk('td_Tmax', nm('mo_Tmax'));
    setLnk('td_Tmin', nm('mo_Tmin'));
    setLnk('td_Tlo', nm('mo_Tset'));
    setLnk('td_Thi', nm('mo_Tset'));
    const so = $('td_soil');
    const moSoil = gRaw('mo_soil');
    if (so && moSoil) {
      so.value = moSoil;
      so.disabled = true;
      so.classList?.add('lnk');
    }
  }
  const MOR = getLatestMorResult() as any;
  if (MOR && MOR.SUP) {
    setLnk('td_DC1', MOR.SUP.DC1);
    setLnk('td_DC2', MOR.SUP.DC1);
    {
      const U = MOR.SUP;
      const gc = MOR.gc;
      const e = 0.5 * (U.Vpa * gc + U.Pra);
      const sw = 0.5 * U.Vpl * gc;
      setLnk('td_DCe1', e);
      setLnk('td_DCe2', e);
      setLnk('td_DCs1', sw);
      setLnk('td_DCs2', sw);
    }
    setLnk('td_DW1', MOR.SUP.DW);
    setLnk('td_DW2', MOR.SUP.DW);
  }
}

// ---------- cọc dưới mặt đất: lò xo đất theo phương pháp hệ số nền m (số liệu ở trang "Nội lực cọc trụ") ----------
export function trPileSoil(I: TrInput): Partial<TrInput> {
  let P: Partial<TrInput> | null = null;
  withCtx('T_', () => {
    const D = I.D;
    const gN = (id: string) => num(id);
    const F = (Math.PI * D * D) / 4;
    const Ip = (Math.PI * D ** 4) / 64;
    const H = gN('mc_H');
    const Ec = trMat(I).Ec;
    const Ek = Ec * 1000;
    const sp = (id: string) =>
      v(id, '')
        .split(';')
        .map((x) => parseFloat(x));
    const S0 = RK.make(I.ELg - (I.hx || 0), D, Ek * Ip, sp('mc_Kov'), sp('mc_GSIov'), sp('mc_EmTN'));
    const nP0 = Math.max(1, Math.round(I.n));
    const AX = PILE.axialK({
      rows: S0.rows,
      ELtop: I.ELg - (I.hx || 0),
      H,
      D,
      Ec,
      pts: Array.from({ length: nP0 }, (_, i) => [0, (i - (nP0 - 1) / 2) * I.s] as [number, number]),
      E0s: gN('mc_E0s'),
      E01: gN('mc_E01'),
      E02: gN('mc_E02'),
      nu1: gN('mc_nu1') || 0.3,
      nu2: gN('mc_nu2') || 0.3,
      ktU: gN('mc_ktU'),
    });
    const { E01, E02, e1, e2, nu1, nu2, G1, G2, kv, kv1, kk, how, bt, kw, sdl, ktU, note } = AX;
    const ktC = AX.ktRaw;
    const EAk = Ek * F;
    const comp = /PT 30/.test(how || '') && !(ktU > 0);
    const noE0 = !(kw > 0) && !(ktU > 0);
    const ktA = AX.kt.map((val) => (noE0 || !comp ? val : 1 / Math.max(1 / val - H / EAk, 1e-10)));
    const kt = ktA.reduce((a, b) => a + b, 0) / ktA.length;
    const Kov = sp('mc_Kov');
    const nP = Math.max(1, Math.round(I.n));
    const S = RK.make(I.ELg - (I.hx || 0), D, Ek * Ip, Kov, sp('mc_GSIov'), sp('mc_EmTN'));
    const ysP = Array.from({ length: nP }, (_, i) => (i - (nP - 1) / 2) * I.s);
    const al = v('mc_grp', 'pm') === 'a6' ? RK.alpha(ysP, D, 1.0) : RK.pm(ysP, D, I.s);
    let ksum = 0;
    if (H > 0 && S.ok) for (let z = 0.125; z < H; z += 0.25) ksum += S.f(z);
    const noSoil = H > 0 && S.ok && !(ksum > 0);
    P = {
      pH: H > 0 && S.ok && !noSoil ? H : 0,
      noSoil,
      pm: 0,
      pBp: S.bp,
      pEp: Ec,
      pkt: kt,
      pktC: ktA,
      pkr: 0,
      pkh: 0,
      pKz: S.f,
      pAlT: al.T,
      pAlL: al.Lm,
      pAlLc: al.L,
      pS: S,
      pAl: al,
      pInfo: {
        H,
        Bp: S.bp,
        Ec,
        F,
        Ip,
        E01,
        E02,
        e1,
        e2,
        nu1,
        nu2,
        G1,
        G2,
        kv,
        kv1,
        kk,
        how,
        bt,
        kw,
        sdl,
        ktC,
        ktU,
        note,
        ELp: AX.ELp,
        EAk,
        comp,
        noE0,
        ktAx: AX.kt,
      },
      pNoE0: noE0,
    };
  });
  return P || { pH: 0 };
}

export function trInputs(): TrInput {
  const I: Record<string, any> = {};
  for (const [k, def] of Object.entries(TD_DEFAULTS)) {
    const id = 'td_' + k;
    const raw = v(id, def);
    if (TR_STR[k] || TD_STR_KEYS.has(k)) I[k] = raw;
    else {
      const n = parseFloat(String(raw).replace(',', '.'));
      I[k] = isFinite(n) ? n : 0;
    }
  }
  if (typeof document !== 'undefined') {
    document.querySelectorAll('[id^="td_"]').forEach((e) => {
      if (!/^(INPUT|SELECT)$/.test(e.tagName)) return;
      const k = e.id.slice(3);
      I[k] = TR_STR[k] ? (e as HTMLInputElement | HTMLSelectElement).value : num(e.id);
    });
  }
  I.br = v('td_br', TD_DEFAULTS.br) === '1' ? 1 : 0;
  I.soil = Number(v('td_soil', TD_DEFAULTS.soil)) || 3;
  I.R = ({ 1.5: 1.5, 3.5: 2.0, 5: 3.0 } as Record<number, number>)[Number(v('td_R', TD_DEFAULTS.R))] || 1.5;
  I.kBR = v('td_brt', TD_DEFAULTS.brt) === '0' ? 0 : 1;
  return I as TrInput;
}

const trF = (val: unknown, d = 1): string =>
  val == null || !isFinite(Number(val)) ? '-' : fx(Number(val), d);
const trOK = (ok: boolean, txt?: string): string =>
  `<td class="c ${ok ? 'ok' : 'bad'}">${txt || (ok ? 'OK' : 'NG')}</td>`;

// ---------- bước tính chính ----------
export function trStep(): TrCalcResult | undefined {
  if (!trOn()) return undefined;
  trVis();
  trLink();
  const I = trInputs();
  const brSecEl = $('td_brSec');
  if (brSecEl?.style) brSecEl.style.display = I.br ? '' : 'none';
  const bs = $('td_brChk');
  if (bs?.style) bs.style.display = I.br ? '' : 'none';
  const nm = (I.name || '').trim();
  ['o_td_ttl1', 'o_td_ttl2', 'o_td_ttl3'].forEach((id, i) =>
    set(
      id,
      [
        'TẢI TRỌNG VÀ TỔ HỢP TẢI TRỌNG TRỤ',
        'NỘI LỰC TRỤ - MÔ HÌNH KHUNG',
        'KIỂM TOÁN XÀ MŨ, GIẰNG VÀ THÂN TRỤ',
      ][i] + (nm ? ' ' + nm.toUpperCase() : ''),
    ),
  );
  let PM: any = null;
  let Is = 0;
  let IsP = 0;
  const Dmm = I.D * 1000;
  const Hc = I.ELt - I.h - (I.ELg - I.hx);
  withCtx('C_', () => {
    const sFn = (id: string, val: unknown) => {
      sv(id, String(val));
      const e = $(id);
      if (e) {
        e.readOnly = true;
        e.classList?.add('lnk');
      }
    };
    sFn('D', Math.round(Dmm));
    sFn('fc', I.fc);
    sFn('L0', Math.round(Hc * 1000));
    const zone = I.A <= 0.09 ? 1 : I.A <= 0.19 ? 2 : 3;
    sFn('phicE', zone >= 2 ? '0.9' : '1');
    sFn('phitE', zone >= 2 ? '0.9' : '1');
    {
      const rm = Math.min((0.135 * I.fc) / (num('fy') || 400), 0.015) * 100;
      sFn('rmin', (zone >= 3 ? Math.max(rm, 1) : rm).toFixed(2));
      sFn('rmax', zone >= 3 ? '4' : '8');
    }
    const S = section();
    PM = {
      CD: trFast(curve(S, num('phic', 0.75), num('phit', 0.9))),
      DB: trFast(curve(S, num('phicE', 0.9), num('phitE', 0.9))),
    };
    Is = S.bars.reduce((t, b) => t + b.a * b.y * b.y, 0) * 1e-12;
  });
  withCtx('T_', () => {
    const sFn = (id: string, val: unknown) => {
      sv(id, String(val));
      const e = $(id);
      if (e) {
        e.readOnly = true;
        e.classList?.add('lnk');
      }
    };
    sFn('D', Math.round(Dmm));
    sFn('fc', I.fc);
    {
      const zone = I.A <= 0.09 ? 1 : I.A <= 0.19 ? 2 : 3;
      sFn('phicE', zone >= 2 ? '0.9' : '1');
      sFn('phitE', zone >= 2 ? '0.9' : '1');
      if (zone >= 3) {
        sFn('rmin', Math.max(num('rmin'), 1));
        sFn('rmax', '4');
      } else {
        for (const [id, val] of [
          ['rmin', '0.5'],
          ['rmax', '8'],
        ] as const) {
          const e = $(id);
          if (e && e.classList?.contains('lnk')) {
            e.readOnly = false;
            e.classList.remove('lnk');
            e.value = val;
          }
        }
      }
    }
    try {
      const S = section();
      if (S.bars.length) {
        PM.pCD = trFast(curve(S, num('phic', 0.75), num('phit', 0.9)));
        PM.pDB = trFast(curve(S, num('phicE', 0.9), num('phitE', 0.9)));
        IsP = S.bars.reduce((t, b) => t + b.a * b.y * b.y, 0) * 1e-12;
      }
    } catch (e) {
      console.error(e);
    }
  });
  Object.assign(I, trPileSoil(I));
  let R: TrCalcResult;
  try {
    R = trCalc(I);
  } catch (e: any) {
    console.error(e);
    set('o_td_sum', `<p class="bad">Lỗi tính toán trụ: ${e?.message || e}</p>`);
    set('o_td_err', 'Lỗi tính toán trụ: ' + (e?.message || e));
    set('o_td_err2', 'Lỗi tính toán trụ: ' + (e?.message || e) + '. Các hình vẽ, bảng chưa được cập nhật.');
    return undefined;
  }
  {
    const e = $('o_td_brNote');
    if (e) e.textContent = (R.G && R.G.brNote) || '';
  }
  if (R.err) {
    set('o_td_sum', `<p class="bad">${R.err.join('<br>')}</p>`);
    set(
      'o_td_err',
      R.err.join('<br>') + '<br>Các hình vẽ, bảng chưa được cập nhật cho đến khi sửa số liệu.',
    );
    set('o_td_err2', R.err.join('<br>') + '<br>Các hình vẽ, bảng chưa được cập nhật.');
    TRR = null;
    syncWindowGlobals();
    return R;
  }
  set('o_td_err', '');
  set('o_td_err2', '');
  const C = trCheck(R, PM, {
    EIg: R.MD!.Ec * R.MD!.Icol,
    EsIs: 2e8 * Is,
    EpIg: R.MD!.Ep * R.MD!.Icol,
    EsIsP: 2e8 * IsP,
  });
  TRR = R;
  TRC = C;
  syncWindowGlobals();
  try {
    trXFtab(R.G.XF, R.G.xg, R.G.HK, 'Chiều cao gối + đá kê', I.hb);
  } catch (e) {
    console.error(e);
  }
  try {
    trRender20(R, C);
  } catch (e) {
    console.error(e);
  }
  try {
    trRender21(R, C);
  } catch (e) {
    console.error(e);
  }
  try {
    trRender22(R, C);
  } catch (e) {
    console.error(e);
  }
  trFeedColumn(R, C);
  trFeedPile(R, C);
  try {
    trEq(R, C);
  } catch (e) {
    console.error(e);
  }
  try {
    trSummary(R, C);
  } catch (e) {
    console.error(e);
  }
  mathAll();
  const hooks = getVisualHooks();
  hooks.renderPierFlex?.({ result: toFlexiblePierResult(R, C) });
  hooks.renderMath?.();
  return R;
}

// ---------- 11. khớp dẻo thân trụ (vùng động đất 3, 4) và mô hình chống - giằng xà mũ ----------
export function trEq(R: TrCalcResult, C: TrCheckResult): void {
  const box = $('o_td_eq');
  const I = R.I;
  const G = R.G;
  const EQ = R.EQ!;
  const zone = EQ.zone;
  const out: Record<string, boolean> = {};
  const row = (a: string, sym: string, val: string, u?: string, cl?: string) =>
    `<div class="row"><span></span><span>${a}</span><span class="sym">${sym || ''}</span><span class="val${cl ? ' ' + cl : ''}">${val}</span><span class="unit">${u || ''}</span></div>`;
  let h = `<h2>11.&nbsp;&nbsp;KHỚP DẺO THÂN TRỤ VÀ MÔ HÌNH CHỐNG - GIẰNG XÀ MŨ</h2>`;
  h += `<h3>11.1. Lực cắt do khớp dẻo, vùng đầu cột (TCVN 11823-3, Điều 9.9.4.3 ; TCVN 11823-5, Điều 10.11.4.1.3)</h3>`;
  if (zone < 3) {
    h += row(
      'Vùng động đất ' + zone + ' (A = ' + fx(I.A, 2) + ' ≤ 0,19): không yêu cầu tính lực do khớp dẻo',
      '',
      '-',
    );
  } else {
    const DB = C.colRec.DB || {};
    const Pmax = DB.Nmax ? DB.Nmax.P : 0;
    const Pmin = DB.Nmin ? DB.Nmin.P : 0;
    let Sc: any = null;
    let Mc = [0, 0];
    let Mp = [0, 0];
    const fc = I.fc;
    let Dv = 0;
    let nv = 0;
    let s = 0;
    let fyt = 0;
    const phiv = 0.9;
    withCtx('C_', () => {
      Sc = section();
      const cv = curve(Sc, 1, 1);
      Mc = [Pmin, Pmax].map((P) => interp(cv.pts as unknown as readonly Record<string, number>[], 'Pn', 'Mn', P) || 0);
      Dv = num('Dv');
      nv = num('nv');
      s = num('s');
      fyt = num('fyt');
    });
    withCtx('T_', () => {
      try {
        const Sp = section();
        if (Sp.bars.length) {
          const cv = curve(Sp, 1, 1);
          Mp = [Pmin, Pmax].map((P) => interp(cv.pts as unknown as readonly Record<string, number>[], 'Pn', 'Mn', P) || 0);
        } else Mp = Mc.slice();
      } catch {
        Mp = Mc.slice();
      }
    });
    const Mnc = Math.max(...Mc);
    const Mnp = G.pile ? Math.max(...Mp) : Mnc;
    const Mtop = 1.3 * Mnc;
    const Mbot = 1.3 * Mnp;
    const rec = [
      C.pileRec && (C.pileRec as any).DB && (C.pileRec as any).DB.M2max,
      C.pileRec && (C.pileRec as any).CD && (C.pileRec as any).CD.M2max,
    ].filter(Boolean);
    const zm = G.pile && rec.length ? Math.max(...rec.map((r: any) => r.z)) : 0;
    const LhL = G.Hc + zm;
    const LhT = G.brace ? Math.min(G.ELcb - G.ELbt, G.ELbb - G.ELs + zm) : G.Hc + zm;
    const nC = G.n;
    const VpT = nC > 1 ? (Mtop + Mbot) / LhT : Mbot / LhT;
    const VpL = Mbot / LhL;
    const Rr = EQ.R || 1;
    const VeT = Rr * Math.abs(DB.Q2max ? DB.Q2max.Q2 : 0);
    const VeL = Rr * Math.abs(DB.Q3max ? DB.Q3max.Q3 : 0);
    const VuT = VeT > 0 ? Math.min(VpT, VeT) : VpT;
    const VuL = VeL > 0 ? Math.min(VpL, VeL) : VpL;
    const Vu = Math.max(VuT, VuL);
    const D = Sc.D;
    const Ag = (Math.PI * D * D) / 4;
    const de = D / 2 + Sc.Dr / Math.PI;
    const dv = Math.max(0.9 * de, 0.72 * D);
    const bv = D;
    const Pc = Math.max(0, Pmin);
    const kP = Pc >= (0.1 * fc * Ag) / 1000 ? 1 : Pc / ((0.1 * fc * Ag) / 1000);
    const Vc = ((0.083 * 2 * Math.sqrt(fc) * bv * dv) / 1000) * kP;
    const Av = (nv * Math.PI * Dv * Dv) / 4;
    const Vs = s > 0 ? (Av * fyt * dv) / s / 1000 : 0;
    const Vlim = (0.25 * fc * bv * dv) / 1000;
    const Vn = Math.min(Vc + Vs, Vlim);
    const Vr = phiv * Vn;
    const ok = Vr >= Vu;
    const Lend = Math.max(D, (G.Hc * 1000) / 6, 450);
    h +=
      row(
        'Vùng động đất ' +
          zone +
          ' (A = ' +
          fx(I.A, 2) +
          '): lực thiết kế thân trụ và lực cắt cột lấy theo khớp dẻo, không lớn hơn lực đàn hồi (R = 1)',
        '',
        '',
      ) +
      row('Lực dọc thân cột ở TTGH Đặc biệt (nhỏ nhất ; lớn nhất)', 'Pu', fx(Pmin, 0) + ' ; ' + fx(Pmax, 0), 'kN') +
      row('Sức kháng uốn danh định cột tại Pu (φ = 1), lấy giá trị lớn hơn', 'Mn,c', fx(Mnc, 0), 'kN.m') +
      (G.pile
        ? row('Sức kháng uốn danh định cọc tại Pu (φ = 1), lấy giá trị lớn hơn', 'Mn,p', fx(Mnp, 0), 'kN.m')
        : '') +
      row(
        'Mômen quá cường độ đầu cột Mpo = 1,3.Mn (Điều 9.9.4.3.1, cấu kiện bê tông cốt thép)',
        'Mpo',
        fx(Mtop, 0) + (G.pile ? ' ; ' + fx(Mbot, 0) : ''),
        'kN.m',
      ) +
      (G.pile
        ? row('Khớp dẻo dưới đặt tại độ sâu mômen lớn nhất của cọc dưới mặt đất sau xói', 'zm', fx(zm, 2), 'm')
        : '') +
      row(
        'Chiều dài giữa hai khớp, ngang cầu' +
          (G.brace ? ' (đoạn ngắn nhất giữa xà mũ, giằng, khớp dưới)' : ''),
        'Lh,T',
        fx(LhT, 2),
        'm',
      ) +
      row('Chiều dài công xôn dọc cầu (khớp dưới đến đáy xà mũ)', 'Lh,L', fx(LhL, 2), 'm') +
      row(
        nC > 1 ? 'Lực cắt khớp dẻo ngang cầu Vp = (Mpo,trên + Mpo,dưới)/Lh,T' : 'Lực cắt khớp dẻo ngang cầu (một cột) Vp = Mpo/Lh,T',
        'Vp,T',
        fx(VpT, 0),
        'kN',
      ) +
      row('Lực cắt khớp dẻo dọc cầu Vp = Mpo,dưới/Lh,L', 'Vp,L', fx(VpL, 0), 'kN') +
      row(
        'Lực cắt đàn hồi (R = 1) = R × lực cắt TTGH Đặc biệt, R = ' + fx(Rr, 2) + ' (ngang ; dọc)',
        'Ve',
        fx(VeT, 0) + ' ; ' + fx(VeL, 0),
        'kN',
      ) +
      row('Lực cắt thiết kế = min(Vp ; Ve), lấy phương bất lợi', 'Vu', fx(Vu, 0), 'kN') +
      row('Phạm vi vùng đầu cột max(D ; Hc/6 ; 450 mm)', '', fx(Lend, 0), 'mm') +
      row('dv = max(0,9de ; 0,72D), de = D/2 + Dr/π ; bv = D', 'dv', fx(dv, 0), 'mm') +
      row(
        'Hệ số giảm Vc trong vùng đầu cột: Pu,min ≥ 0,10f\'c.Ag thì lấy 1, nhỏ hơn thì giảm tuyến tính về 0 khi Pu = 0',
        'kP',
        fx(kP, 3),
        '',
      ) +
      row('Vc = 0,083.β.√f\'c.bv.dv.kP ; β = 2,0, θ = 45° (Điều 8.3.4.1)', 'Vc', fx(Vc, 0), 'kN') +
      row(
        'Vs = Av.fy.dv/s ; Av = ' + fx(nv, 0) + ' × π.' + fx(Dv, 0) + '²/4, s = ' + fx(s, 0) + ' mm',
        'Vs',
        fx(Vs, 0),
        'kN',
      ) +
      row('Vn = min(Vc + Vs ; 0,25f\'c.bv.dv)', 'Vn', fx(Vn, 0), 'kN') +
      row('Vr = φ.Vn, φ = 0,90 (vùng động đất 3, 4: Điều 10.11.4.1.2)', 'Vr', fx(Vr, 0), 'kN') +
      `<div class="row"><span></span><span><b>Kết luận</b> Vr ${ok ? '≥' : '<'} Vu</span><span></span><span class="val ${ok ? 'ok' : 'bad'}">${ok ? 'ĐẠT' : 'KHÔNG ĐẠT'}</span><span></span></div>`;
    if (!ok) {
      h += `<p class="small bad">Tăng cốt xoắn trong vùng đầu cột (giảm bước hoặc tăng đường kính) để Vr ≥ Vu.</p>`;
    }
    out.hOK = ok;
  }
  h += `<h3>11.2. Mô hình chống - giằng xà mũ (TCVN 11823-5, Điều 8.1.1 ; 6.3)</h3>`;
  const Sx = rcSec('xa', I.b * 1000, 1000);
  const fc = I.fc;
  const fy = I.fy;
  const b = I.b * 1000;
  const Ast = (Sx.f2.n * Math.PI * Sx.f2.d ** 2) / 4;
  const Avs = (Sx.st.n * Math.PI * Sx.st.d ** 2) / 4;
  const rv = Avs / (b * Sx.st.s);
  const Dm = 0.886 * I.D * 1000;
  const pc = 0.7;
  const pt = 0.9;
  let t = `<tr><th>Mặt cắt</th><th>Mu (kN.m)</th><th>Vu (kN)</th><th>a (m)</th><th>d (mm)</th><th>a/d</th><th>α (độ)</th><th>T (kN)</th><th>φfyAs (kN)</th><th>Cu (kN)</th><th>fcu (MPa)</th><th>φPn (kN)</th><th>Nút cột (MPa)</th><th>Kết luận</th></tr>`;
  let nS = 0;
  let allOK = true;
  C.cand.forEach((cd, i) => {
    if (cd.kind !== 'neg') return;
    const rows = trRCrows(C.capE, i).filter((r) => r.st !== 'SD');
    if (!rows.length) return;
    const gRow = rows.reduce((a0, r) => (Math.abs(r.V) > Math.abs(a0.V) ? r : a0), rows[0]);
    const Mu = Math.abs(gRow.M);
    const Vu = Math.abs(gRow.V);
    if (!(Vu > 1)) return;
    const d = cd.h * 1000 - Sx.f2.dc;
    const a = Mu / Vu;
    const ad = (a * 1000) / d;
    if (ad >= 2) return;
    nS++;
    const jd = 0.9 * d;
    const al = Math.atan(jd / Math.max(a * 1000, 50));
    const T = (Mu * 1e3) / jd;
    const Tr = (pt * fy * Ast) / 1000;
    const Cu = Vu / Math.sin(al);
    const es = (T * 1e3) / (200000 * Math.max(Ast, 1));
    const e1 = es + (es + 0.002) / Math.tan(al) ** 2;
    const fcu = Math.min(fc / (0.8 + 170 * e1), 0.85 * fc);
    const ws = Dm * Math.sin(al) + 2 * Sx.f1.dc * Math.cos(al);
    const Pr = (pc * fcu * ws * b) / 1000;
    const fn = (Vu * 1000) / (Dm * b);
    const fnl = 0.85 * pc * fc;
    const ok = Tr >= T && Pr >= Cu && fn <= fnl;
    allOK = allOK && ok;
    t += `<tr><td class="l">${cd.nm}</td><td>${fx(Mu, 0)}</td><td>${fx(Vu, 0)}</td><td>${fx(a, 3)}</td><td>${fx(d, 0)}</td><td>${fx(ad, 2)}</td><td>${fx((al * 180) / Math.PI, 1)}</td><td>${fx(T, 0)}</td><td>${fx(Tr, 0)}</td><td>${fx(Cu, 0)}</td><td>${fx(fcu, 2)}</td><td>${fx(Pr, 0)}</td><td>${fx(fn, 2)} / ${fx(fnl, 2)}</td><td class="c ${ok ? 'ok' : 'bad'}">${ok ? 'OK' : 'NG'}</td></tr>`;
  });
  if (nS) {
    const okR = rv >= 0.003;
    allOK = allOK && okR;
    h +=
      `<p class="small">Tại các mặt cắt mômen âm có nhịp cắt a = Mu/Vu nhỏ hơn 2d, gối dầm truyền tải trực tiếp xuống cột qua thanh chống: xà mũ là vùng không liên tục và được kiểm toán thêm theo mô hình chống - giằng. Giằng là cốt thép mặt trên (As = ${fx(Ast, 0)} mm²), cánh tay đòn jd = 0,9d, thanh chống nghiêng góc α = arctan(jd/a) tựa lên nút trên cột (bề rộng quy đổi 0,886D = ${fx(Dm, 0)} mm). fcu = f'c/(0,8 + 170ε1) ≤ 0,85f'c, ε1 = εs + (εs + 0,002)cot²α ; bề rộng thanh chống ws = 0,886D.sinα + 2dc.cosα ; φ thanh chống, nút = 0,70 ; φ giằng = 0,90 ; ứng suất nút nén (CCC) ≤ 0,85φf'c.</p><table class="t dt">${t}</table>` +
      row(
        'Cốt thép phân bố chống nứt: ρv = Av/(b.s) ≥ 0,003 (Điều 6.3.6), Av = ' +
          Sx.st.n +
          ' nhánh Φ' +
          fx(Sx.st.d, 0) +
          ', s = ' +
          fx(Sx.st.s, 0) +
          ' mm',
        'ρv',
        fx(rv, 4),
        '',
        okR ? 'ok' : 'bad',
      ) +
      `<div class="row"><span></span><span><b>Kết luận</b></span><span></span><span class="val ${allOK ? 'ok' : 'bad'}">${allOK ? 'ĐẠT' : 'KHÔNG ĐẠT'}</span><span></span></div>`;
    out.sOK = allOK;
  } else {
    h += row(
      'Mọi mặt cắt mômen âm có nhịp cắt a = Mu/Vu ≥ 2d: xà mũ làm việc như dầm, không cần mô hình chống - giằng',
      '',
      '-',
    );
  }
  if (box) box.innerHTML = h;
  else set('o_td_eq', h);
  latestTrEq = out;
  if (typeof window !== 'undefined') (window as any).__trEq = out;
}

// ---------- cốt thép ngang bó lõi cột / cọc trụ khung ----------
export function trConf(R: TrCalcResult, C: TrCheckResult, kind: 'C' | 'T'): void {
  const box = $('trConf');
  const zone = R.EQ!.zone;
  const D = num('D');
  const d1 = num('d1');
  const c1 = num('c1');
  const Dv = num('Dv');
  const s = num('s');
  const fc = num('fc');
  const fy = num('fy');
  const G = R.G;
  const I = R.I;
  if (!(D > 0 && Dv > 0 && s > 0 && c1 > 0)) {
    if (box) box.innerHTML = '';
    return;
  }
  const Dc = D - 2 * (c1 - d1 / 2 - Dv);
  const Ag = (Math.PI * D * D) / 4;
  const Ac = (Math.PI * Dc * Dc) / 4;
  const Asp = (Math.PI * Dv * Dv) / 4;
  const rs = (4 * Asp) / (Dc * s);
  const fyh = Math.min(num('fyt') || fy, 690);
  const r49 = (0.45 * (Ag / Ac - 1) * fc) / fyh;
  const r167 = (0.12 * fc) / fyh;
  const req = zone >= 2 ? Math.max(r49, r167) : r49;
  const sMax = zone >= 2 ? Math.min(D / 4, 6 * d1, 105) : null;
  const ok = rs >= req && (sMax == null || s <= sMax);
  const row = (a: string, sym: string, val: string, u?: string) =>
    `<div class="row"><span></span><span>${a}</span><span class="sym">${sym || ''}</span><span class="val">${val}</span><span class="unit">${u || ''}</span></div>`;
  let h =
    `<h2>6.&nbsp;&nbsp;CỐT THÉP NGANG BÓ LÕI (TCVN 11823-5, Điều 7.4.6${zone >= 2 ? ' ; vùng động đất ' + zone + ': Điều 10.11.3, 10.11.4.1.4, 10.11.4.1.5' : ''})</h2>` +
    row('Vùng động đất (TCVN 11823-3, Bảng 16; A = ' + fx(I.A, 2) + ')', '', String(zone)) +
    row('Đường kính lõi tính đến mép ngoài cốt xoắn Dc = D - 2(dc - d1/2 - Dv)', 'Dc', fx(Dc, 0), 'mm') +
    row(
      'Tỷ lệ thể tích cốt xoắn bố trí ρs = 4Asp/(Dc.s) ; Dv = ' + fx(Dv, 0) + ' mm, s = ' + fx(s, 0) + ' mm',
      'ρs',
      fx(rs, 4),
      '',
    ) +
    row(
      "PT 49: ρs ≥ 0,45(Ag/Ac - 1)f'c/fyh ; fyh - giới hạn chảy cốt xoắn = " + fx(fyh, 0) + ' MPa (≤ 690 MPa)',
      '',
      fx(r49, 4),
      '',
    ) +
    (zone >= 2 ? row("PT 167: ρs ≥ 0,12f'c/fyh", '', fx(r167, 4), '') : '') +
    row('Yêu cầu', 'ρs,yc', fx(req, 4), '') +
    (zone >= 2
      ? row('Cự ly cốt thép ngang bó ≤ min(D/4 ; 6d1 ; 105 mm) (Điều 10.11.4.1.5)', 'smax', fx(sMax!, 0), 'mm')
      : '');
  if (zone >= 2) {
    if (kind === 'C') {
      h += row(
        'Phạm vi bó ở đỉnh và chân cột: max(D ; H/6 ; 450 mm), H = ' + fx(G.Hc, 2) + ' m',
        '',
        fx(Math.max(D, (G.Hc * 1000) / 6, 450), 0),
        'mm',
      );
    } else {
      const rec = [
        C.pileRec && (C.pileRec as any).CD && (C.pileRec as any).CD.M2max,
        C.pileRec && (C.pileRec as any).DB && (C.pileRec as any).DB.M2max,
      ].filter(Boolean);
      const zm = rec.length ? Math.max(...rec.map((r: any) => r.z)) : 0;
      h += row(
        'Phạm vi bó trong cọc trụ khung: từ 3D dưới điểm mômen lớn nhất (z = ' +
          fx(zm, 2) +
          ' m dưới mặt đất sau xói) đến max(D ; 450 mm) trên mặt đất',
        '',
        fx(zm + (3 * D) / 1000, 2) + ' m dưới ; ' + fx(Math.max(D, 450), 0) + ' mm trên',
        '',
      );
    }
  }
  h += `<div class="row"><span></span><span><b>Kết luận</b></span><span></span><span class="val ${ok ? 'ok' : 'bad'}">${ok ? 'ĐẠT' : 'KHÔNG ĐẠT'}</span><span></span></div>`;
  if (!ok) {
    h += `<p class="small bad">ρs = ${fx(rs, 4)} ${rs < req ? '< ' + fx(req, 4) : ''}${sMax != null && s > sMax ? ' ; s = ' + fx(s, 0) + ' > ' + fx(sMax, 0) + ' mm' : ''}: tăng đường kính hoặc giảm bước cốt xoắn trong phạm vi bó.</p>`;
  }
  if (box) box.innerHTML = h;
  else set('trConf', h);
  latestConfOK[kind] = ok;
  if (typeof window !== 'undefined') {
    (window as any).__confOK = (window as any).__confOK || {};
    (window as any).__confOK[kind] = ok;
  }
  const oa = $('o_all');
  if (oa && !ok) {
    oa.innerHTML =
      `<span class="bad">KHÔNG ĐẠT: CỐT THÉP NGANG BÓ LÕI (mục 6)</span>` +
      (/KHÔNG ĐẠT|CÓ HẠNG MỤC/.test(oa.textContent || '') ? ` <span class="bad">; ${oa.textContent}</span>` : '');
  }
}

// ---------------------------------------------------------------------------
// 8. Column & Pile Feeders and Pile Envelope Outputs
// ---------------------------------------------------------------------------

export function trFeedColumn(R: TrCalcResult, C: TrCheckResult): void {
  const k = 9.81;
  const L = (rec: any, key: string, th: number) =>
    rec
      ? `${key}  ${rec.c + 1}  ${th}  ${(rec.P / k).toFixed(3)}  ${(rec.Q2 / k).toFixed(3)}  ${(rec.Q3 / k).toFixed(3)}  0  ${(rec.M2 / k).toFixed(3)}  ${(rec.M3 / k).toFixed(3)}`
      : '';
  const txt = (st: 'CD' | 'DB') => {
    const o = C.colRec[st];
    return ['Nmax', 'Nmin', 'Q2max', 'Q3max', 'M1max', 'M2max', 'M3max']
      .map((key) => {
        const r = o[key];
        return r ? L(r, key, r.iv + 1) : '';
      })
      .filter(Boolean)
      .join('\n');
  };
  withCtx('C_', () => {
    const mcr = { txtCD: txt('CD'), txtDB: txt('DB') };
    contextState.MCR = mcr as any;
    if (typeof window !== 'undefined') (window as any).MCR = mcr;
    sv('src', 'calc');
    try {
      tab3Step({ MCR: mcr, TRC: C as any });
    } catch (e) {
      console.error(e);
    }
    try {
      trConf(R, C, 'C');
    } catch (e) {
      console.error(e);
    }
  });
}

export function trFeedPile(R: TrCalcResult, C: TrCheckResult): void {
  const k = 9.81;
  const rowsCD: any[] = [];
  const rowsDB: any[] = [];
  R.CB!.forEach((cb) => {
    const dst = cb.st === 'DB' ? rowsDB : rowsCD;
    C.pileRows[cb.id].forEach((pr, c) => {
      if (pr.M) dst.push({ ...pr.M, c, id: cb.id, kind: 'M' });
      if (pr.N && (!pr.M || pr.N.iv !== pr.M.iv || pr.N.is !== pr.M.is)) {
        dst.push({ ...pr.N, c, id: cb.id, kind: 'N' });
      }
    });
  });
  TRROWS = { CD: rowsCD, DB: rowsDB };
  TRXY = R.G.xs.map((x) => [0, x] as [number, number]);
  syncWindowGlobals();
  const sumP = (st: 'CD' | 'DB') => (C.grpN && isFinite(C.grpN[st]) ? C.grpN[st] : 0);
  const piles = R.G.xs.map((x) => ({ x: 0, y: x }));
  const lab = ['TTGH CƯỜNG ĐỘ VÀ SỬ DỤNG', 'TTGH ĐẶC BIỆT'] as const;
  const rows = (arr: any[]) =>
    arr.map((r, i) => ({
      tc: r.c + 1,
      th: i + 1 + ' (' + r.id + ')',
      N: r.P / k,
      Q2: r.Hy / k,
      Q3: r.Hx / k,
      M1: 0,
      M2: r.My / k,
      M3: r.Mx / k,
    }));
  let U: [number, number, number] = [0, 0, 0];
  if (C.PE && C.PE.CD) {
    (['SD'] as const).forEach((g0) =>
      C.PE[g0].forEach((q: any[]) => {
        const e = q[0];
        U = [Math.max(U[0], e.uL), Math.max(U[1], e.uT), Math.max(U[2], e.uZ)];
      }),
    );
  }
  const txt = (st: 'CD' | 'DB') => {
    const o = C.pileRec ? C.pileRec[st] : {};
    return ['Nmax', 'Nmin', 'Q2max', 'Q3max', 'M1max', 'M2max', 'M3max']
      .map((key) => {
        const r = o[key];
        return r
          ? `${key}  ${r.c + 1}  ${r.iv + 1}  ${(r.P / k).toFixed(3)}  ${(r.Q2 / k).toFixed(3)}  ${(r.Q3 / k).toFixed(3)}  0  ${(r.M2 / k).toFixed(3)}  ${(r.M3 / k).toFixed(3)}`
          : '';
      })
      .filter(Boolean)
      .join('\n');
  };
  withCtx('T_', () => {
    const sFn = (id: string, val: unknown, ro = true) => {
      sv(id, String(val));
      const e = $(id);
      if (e && ro) {
        e.readOnly = true;
        e.classList?.add('lnk');
      }
    };
    sFn('D', Math.round(R.I.D * 1000));
    sFn('fc', R.I.fc);
    sFn('mc_Lo', '0');
    sFn('s2_ELcap', R.G.ELs.toFixed(3));
    sFn('s2_ELgs', R.G.ELs.toFixed(3));
    sFn('L0', '0');
    sFn('s2_gc', R.I.gc);
    sv('src', 'calc');
    let sctRes: SctCalcOutput | null = contextState.SCTR as SctCalcOutput | null;
    try {
      const r0 = sctStep({ TRXY: TRXY ?? undefined, TRR: R });
      if (r0 && !('err' in r0)) {
        sctRes = r0;
        contextState.SCTR = r0;
      }
    } catch (e) {
      console.error(e);
    }
    const xr = (st: 'CD' | 'DB', arr: any[]) => {
      const o = rows(arr);
      const P = C.pileRec && C.pileRec[st];
      if (P) {
        for (const [key, nm] of [
          ['Nmax', 'N max'],
          ['Nmin', 'N min'],
        ] as const) {
          const r = P[key];
          if (r) {
            const vr = R.VAR![r.iv];
            o.push({
              tc: r.c + 1,
              th: nm + ' (' + vr.name + ' ' + (vr.lab || '') + ')',
              N: r.P / k,
              Q2: r.Q2 / k,
              Q3: r.Q3 / k,
              M1: 0,
              M2: r.M2 / k,
              M3: r.M3 / k,
            });
          }
        }
      }
      return o;
    };
    const mcr = {
      rows: { [lab[0]]: xr('CD', rowsCD), [lab[1]]: xr('DB', rowsDB) },
      U1: [U],
      piles,
      grp: { piles, LC: [[0, 0, sumP('CD') / k, 0, 0, 0]], LD: [[0, 0, sumP('DB') / k, 0, 0, 0]] },
      LC: [],
      LD: [],
      txtCD: txt('CD'),
      txtDB: txt('DB'),
    };
    contextState.MCR = mcr as any;
    if (typeof window !== 'undefined') (window as any).MCR = mcr;
    try {
      trPileOut(R, C);
    } catch (e) {
      console.error(e);
    }
    try {
      sctCheck({ MCR: mcr, SCTR: sctRes });
    } catch (e) {
      console.error(e);
    }
    try {
      tab3Step({ MCR: mcr, TRC: C as any });
    } catch (e) {
      console.error(e);
    }
    try {
      trConf(R, C, 'T');
    } catch (e) {
      console.error(e);
    }
  });
  try {
    sct2Run('T_', 'U_');
  } catch (e) {
    console.error(e);
  }
}

export function trPileSt(R: TrCalcResult, C: TrCheckResult, c: number) {
  const G = R.G;
  const st = C.PSt![c];
  const out: Array<{ z: number; el: number; js: number[] }> = [];
  st.forEach((sm: any, j: number) => {
    const z = +(G.ELs - sm.y).toFixed(4);
    let o = out.find((q) => Math.abs(q.z - z) < 1e-6);
    if (!o) {
      o = { z, el: sm.y, js: [] };
      out.push(o);
    }
    o.js.push(j);
  });
  return out;
}

export function trPileEnv(R: TrCalcResult, C: TrCheckResult, key: string, cs: number[]) {
  const base = trPileSt(R, C, 0);
  return base.map((b) => {
    const o: Record<string, number> = {
      z: b.z,
      el: b.el,
      Nmx: -Infinity,
      Nmn: Infinity,
      M3: 0,
      M2: 0,
      M: 0,
      Q2: 0,
      Q3: 0,
      uT: 0,
      uL: 0,
      uZ: 0,
      pT: 0,
      pL: 0,
    };
    cs.forEach((c) => {
      const found = trPileSt(R, C, c).find((q) => Math.abs(q.z - b.z) < 1e-6);
      if (!found) return;
      found.js.forEach((j) => {
        const e = C.PE[key as LimitStateType][c][j];
        o.Nmx = Math.max(o.Nmx, e.Nmx);
        o.Nmn = Math.min(o.Nmn, e.Nmn);
        for (const f of ['M3', 'M2', 'M', 'Q2', 'Q3', 'uT', 'uL', 'uZ', 'pT', 'pL']) {
          o[f] = Math.max(o[f], e[f]);
        }
      });
    });
    return o;
  });
}

export function trPileDraw(svg: any, E: Array<Record<string, number>>, title: string): void {
  if (!svg || !E.length) return;
  const W = 700;
  const H = 460;
  const top = 54;
  const bot = H - 30;
  const x0 = 54;
  const pw = 112;
  const gap = 16;
  const zmax = E[E.length - 1].z || 1;
  const st = zmax > 20 ? 5 : zmax > 8 ? 2 : 1;
  const Y = (z: number) => top + (z / zmax) * (bot - top);
  const PN: Array<[string, Array<[string, string, number?]>]> = [
    [
      'N (kN)',
      [
        ['Nmx', '#1f4e79'],
        ['Nmn', '#c55a11'],
      ],
    ],
    [
      'u (mm)',
      [
        ['uT', '#1f4e79', 1000],
        ['uL', '#c55a11', 1000],
      ],
    ],
    [
      'M (kN.m)',
      [
        ['M3', '#1f4e79'],
        ['M2', '#c55a11'],
      ],
    ],
    [
      'V (kN)',
      [
        ['Q2', '#1f4e79'],
        ['Q3', '#c55a11'],
      ],
    ],
    [
      'p (kN/m)',
      [
        ['pT', '#1f4e79'],
        ['pL', '#c55a11'],
      ],
    ],
  ];
  const tk = (val: number) => {
    const a = Math.abs(val);
    return (a >= 100 ? val.toFixed(0) : a >= 10 ? val.toFixed(1) : val.toFixed(2)).replace('.', ',');
  };
  let s = `<style>text{font-family:"Times New Roman",serif;font-size:11px;fill:#000}</style><text x="${W / 2}" y="14" text-anchor="middle" font-weight="bold">${title}</text>`;
  for (let z = 0; z <= zmax + 1e-9; z += st) {
    s += `<text x="${x0 - 6}" y="${Y(z) + 4}" text-anchor="end">${z}</text>`;
  }
  s += `<text x="13" y="${(top + bot) / 2}" transform="rotate(-90 13 ${(top + bot) / 2})" text-anchor="middle">z (m) - tính từ mặt đất sau xói</text>`;
  PN.forEach(([lab, ser], i) => {
    const X0 = x0 + i * (pw + gap);
    let mn = 0;
    let mx = 0;
    ser.forEach(([f, , k]) =>
      E.forEach((r) => {
        const val = r[f] * (k || 1);
        if (isFinite(val)) {
          mn = Math.min(mn, val);
          mx = Math.max(mx, val);
        }
      }),
    );
    if (mx - mn < 1e-9) mx = mn + 1;
    const pad = (mx - mn) * 0.06;
    const a = mn - pad;
    const b = mx + pad;
    const X = (val: number) => X0 + ((val - a) / (b - a)) * pw;
    s += `<rect x="${X0}" y="${top}" width="${pw}" height="${bot - top}" fill="none" stroke="#999"/>`;
    for (let z = 0; z <= zmax + 1e-9; z += st) {
      s += `<line x1="${X0}" x2="${X0 + pw}" y1="${Y(z)}" y2="${Y(z)}" stroke="#e5e5e5"/>`;
    }
    s += `<line x1="${X(0)}" x2="${X(0)}" y1="${top}" y2="${bot}" stroke="#000"/><text x="${X0 + pw / 2}" y="${top - 24}" text-anchor="middle" font-weight="bold">${lab}</text><text x="${X0}" y="${top - 8}">${tk(mn)}</text><text x="${X0 + pw}" y="${top - 8}" text-anchor="end">${tk(mx)}</text>`;
    ser.forEach(([f, col, k]) => {
      s += `<polyline fill="none" stroke="${col}" stroke-width="1.6" points="${E.map((r) => X(r[f] * (k || 1)).toFixed(1) + ',' + Y(r.z).toFixed(1)).join(' ')}"/>`;
      const e = E.reduce((p, q) => (Math.abs(q[f]) > Math.abs(p[f]) ? q : p));
      s += `<circle cx="${X(e[f] * (k || 1))}" cy="${Y(e.z)}" r="2.6" fill="${col}"/>`;
    });
  });
  s += `<text x="${W / 2}" y="${H - 8}" text-anchor="middle"><tspan fill="#1f4e79">━ N max ; ngang cầu (u, M, V, p)</tspan> &#160; <tspan fill="#c55a11">━ N min ; dọc cầu (u, M, V, p)</tspan> ; u, M, V, p: giá trị tuyệt đối lớn nhất</text>`;
  svg.innerHTML = s;
}

export function trPileTab(E: Array<Record<string, number>>, every: number): string {
  const pick = E.filter(
    (r, i) => i === 0 || i === E.length - 1 || Math.abs(r.z / every - Math.round(r.z / every)) < 1e-6,
  );
  const ext = (f: string) => E.reduce((p, q) => (Math.abs(q[f]) > Math.abs(p[f]) ? q : p));
  ['M3', 'M2', 'M', 'Q2', 'Q3', 'uT', 'uL', 'pT', 'pL'].forEach((f) => {
    const r = ext(f);
    if (!pick.includes(r)) pick.push(r);
  });
  pick.sort((a, b) => a.z - b.z);
  const mx = (f: string) => Math.max(...E.map((r) => Math.abs(r[f])));
  const b = (val: number, f: string) =>
    Math.abs(Math.abs(val) - mx(f)) < 1e-9 && mx(f) > 0 ? ` style="font-weight:bold"` : '';
  let t = `<tr><th rowspan="2">z (m)</th><th rowspan="2">Cao độ (m)</th><th colspan="2">N (kN)</th><th colspan="3">M (kN.m)</th><th colspan="2">V (kN)</th><th colspan="2">u (mm)</th><th colspan="2">p (kN/m)</th></tr><tr><th>max</th><th>min</th><th>ngang</th><th>dọc</th><th>tổng</th><th>ngang</th><th>dọc</th><th>ngang</th><th>dọc</th><th>ngang</th><th>dọc</th></tr>`;
  pick.forEach(
    (r) =>
      (t += `<tr><td>${fx(r.z, 2)}</td><td>${fx(r.el, 3)}</td><td>${fx(r.Nmx, 1)}</td><td>${fx(r.Nmn, 1)}</td><td${b(r.M3, 'M3')}>${fx(r.M3, 1)}</td><td${b(r.M2, 'M2')}>${fx(r.M2, 1)}</td><td${b(r.M, 'M')}>${fx(r.M, 1)}</td><td${b(r.Q2, 'Q2')}>${fx(r.Q2, 1)}</td><td${b(r.Q3, 'Q3')}>${fx(r.Q3, 1)}</td><td>${fx(r.uT * 1000, 2)}</td><td>${fx(r.uL * 1000, 2)}</td><td>${fx(r.pT, 1)}</td><td>${fx(r.pL, 1)}</td></tr>`),
  );
  return t;
}

export function trPileDiag(R: TrCalcResult, C: TrCheckResult): void {
  withCtx('T_', () => {
    const gs = $('pd2_g') as any;
    const cs = $('pd2_c') as any;
    if (!gs || !C.PE || !C.PE.CD) return;
    const n = R.G.n;
    if (!gs._b && typeof gs.addEventListener === 'function') {
      gs._b = 1;
      const f = () => {
        if (TRR && TRC) trPileDiag(TRR, TRC);
      };
      gs.addEventListener('change', f);
      cs?.addEventListener('change', f);
    }
    const keep = (sel: any, opts: Array<[string | number, string]>) => {
      const val = sel.value;
      sel.innerHTML = opts.map(([a, b]) => `<option value="${a}">${b}</option>`).join('');
      if (opts.some((o) => String(o[0]) === val)) sel.value = val;
    };
    keep(gs, [
      ['CD', 'Bao TTGH Cường độ'],
      ['SD', 'Bao TTGH Sử dụng'],
      ['DB', 'Bao TTGH Đặc biệt'],
      ...R.CB!.map((c): [string, string] => [c.id, c.id]),
    ]);
    keep(cs, [
      ['A', 'Bao các cọc'],
      ...R.G.xs.map((x, i): [number, string] => [i, 'Cọc ' + (i + 1) + ' (y = ' + fx(x, 2) + ' m)']),
    ]);
    const all = [...Array(n).keys()];
    const E = trPileEnv(R, C, gs.value, cs.value === 'A' ? all : [+cs.value]);
    const gTxt = gs.selectedOptions?.[0]?.text || gs.value;
    const cTxt = cs.selectedOptions?.[0]?.text || cs.value;
    trPileDraw($('dgPEV'), E, gTxt + ' - ' + cTxt);
    const tbPEV = $('tbPEV');
    if (tbPEV) tbPEV.innerHTML = trPileTab(E, 1);
  });
}

const PM_TXT = (s: string) => s;

export function trPileOut(R: TrCalcResult, C: TrCheckResult): void {
  const I = R.I;
  const G = R.G;
  const k = 9.81;
  const S = I.pS;
  const al = I.pAl;
  const pi = I.pInfo || {};
  const nm = (I.name || '').trim();
  set('o_pttl', 'BẢNG TÍNH NỘI LỰC CỌC TRỤ' + (nm ? ' ' + nm.toUpperCase() : ''));
  if (!G.pile || !C.PE || !C.PE.CD) {
    set(
      'o_pnote',
      `<span class="bad">Chưa có phần cọc trong mô hình (kiểm tra chiều dài cọc h và số liệu địa chất ở trang sức chịu tải cọc trụ).</span>`,
    );
    ['tbKs', 'tbAl', 'tbPH', 'tbPU', 'tbPECD', 'tbPEDB', 'tbPS', 'tbPEV'].forEach((i) => set(i, ''));
    ['dgPECD', 'dgPEDB', 'dgPEV'].forEach((i) => set(i, ''));
    return;
  }
  {
    const top = S.rows.length ? Math.max(...S.rows.map((r: any) => r.top)) : -Infinity;
    set(
      'o_pnote',
      top < G.ELs - 0.01
        ? `<span class="bad">Số liệu địa chất (trang sức chịu tải cọc trụ) bắt đầu từ cao độ ${fx(top, 3)}, thấp hơn mặt đất sau xói ${fx(G.ELs, 3)}: đoạn cọc phía trên không có lò xo đất. Kiểm tra cao độ đỉnh lỗ khoan và bảng địa chất.</span>`
        : '',
    );
  }
  set('o_pD', fx(I.D, 3));
  set('o_pn', G.n + ' cọc ; khoảng cách ' + fx(I.s, 2));
  set('o_pELs', fx(G.ELs, 3));
  set('o_pELt', fx(G.ELtip, 3));
  set('o_pEp', fx(I.pEp, 1));
  set('o_pbp', fx(S.bp, 3));
  let t = `<tr><th>Lớp</th><th>Cao độ<br>đỉnh - đáy (m)</th><th>Loại</th><th>N</th><th>Cơ sở</th><th>K tra<br>(kN/m⁴)</th><th>K nhập<br>(kN/m⁴)</th><th>Em<br>(MPa)</th><th>k đá<br>(kN/m²)</th></tr>`;
  S.rows.forEach((r: any) => {
    t += `<tr><td class="c">${r.name}</td><td class="c">${fx(r.top, 3)} - ${fx(r.bot, 3)}</td><td class="c">${r.type}</td><td>${r.rock ? '-' : fx(r.N, 0)}</td>`;
    if (r.rock) {
      t += `<td class="l" style="white-space:normal;min-width:180px">qu = ${fx(r.qu, 1)} MPa ; GSI <input class="gsio" data-r="${r.row}" value="${r.gsiOv ? r.gsi : ''}" placeholder="${fx(r.gsi, 0)}" style="width:44px"> ; Em thí nghiệm <input class="etn" data-r="${r.row}" value="${r.etn || ''}" style="width:60px"> MPa ; Bảng 5: Em = ${fx(r.E5, 0)} MPa</td><td class="c">-</td><td class="c">-</td><td>${fx(r.Em, 0)}</td><td>${fx(r.k, 0)}</td></tr>`;
    } else {
      t += `<td class="l" style="white-space:normal;min-width:180px">${r.arow ? 'Bảng A.1 dòng ' + r.arow + ' ; ' + r.how : '-'}</td><td>${fx(r.Ka, 0)}</td><td><input class="kov" data-r="${r.row}" value="${r.Kov ? r.Kov : ''}" style="width:70px"></td><td class="c">-</td><td class="c">-</td></tr>`;
    }
  });
  if (S.rows.some((r: any) => !r.rock && r.arow)) {
    t += `<tr><td class="l" colspan="9" style="white-space:normal">Bảng A.1: ${RK.A1T.map((x, i) => i + 1 + '. ' + x + ': ' + fx(RK.A1[i][0], 0) + ' ÷ ' + fx(RK.A1[i][1], 0)).join(' ; ')}</td></tr>`;
  }
  set('tbKs', t);
  const tb = $('tbKs') as any;
  if (tb && !tb._kov && typeof tb.addEventListener === 'function') {
    tb._kov = 1;
    tb.addEventListener('change', (e: any) => {
      const x = e.target;
      const cl = x?.classList;
      const id = cl?.contains('kov')
        ? 'mc_Kov'
        : cl?.contains('gsio')
          ? 'mc_GSIov'
          : cl?.contains('etn')
            ? 'mc_EmTN'
            : null;
      if (!id) return;
      withCtx('T_', () => {
        const h = $(id);
        if (!h) return;
        const a = String(h.value || '').split(';');
        a[+x.dataset.r] = x.value.trim();
        h.value = a.join(';');
        try {
          pierFlexHooks.saveAll?.();
        } catch {
          // optional saveAll hook
        }
      });
      trSchedule();
    });
  }
  {
    const pmK = al.kind === 'pm';
    const nmAl = pmK ? 'Pm' : 'αi';
    t = `<tr><th>Cọc</th><th>y (m)</th><th>${nmAl} ngang cầu, tải +Y</th><th>${nmAl} ngang cầu, tải -Y</th><th>${nmAl} ngang cầu dùng (min)</th><th>${nmAl} dọc cầu</th></tr>`;
  }
  G.xs.forEach(
    (y, i) =>
      (t += `<tr><td class="c">${i + 1}</td><td>${fx(y, 2)}</td><td>${fx(al.Tp[i], 3)}</td><td>${fx(al.Tm[i], 3)}</td><td>${fx(al.T[i], 3)}</td><td>${fx(al.L[i], 3)}</td></tr>`),
  );
  if (al.kind === 'pm' && G.xs.length > 1 && al.r < 3) {
    t += `<tr><td colspan="6">s/D = ${fx(al.r, 2)}: thỏa khoảng cách tối thiểu 2,5D (Điều 7.1.2). Bảng 21 chỉ có giá trị Pm tại 3B và 5B, không có giá trị dưới 3B; lấy Pm tại 3B (không ngoại suy).</td></tr>`;
  }
  set('tbAl', t);
  {
    const B = pi.bt || {};
    set(
      'o_pE01',
      fx(pi.E01, 1) +
        (pi.e1 && pi.e1.miss && !(num('T_mc_E01') > 0) ? ' <span class="bad">thiếu E0</span>' : ''),
    );
    set('o_pE02', fx(pi.E02, 1));
    set('o_pG', fx(pi.G1, 1) + ' ; ' + fx(pi.G2, 1));
    set('o_pkv', fx(pi.kv, 3) + ' ; ' + fx(pi.kv1, 3));
    set('o_pkk', fx(pi.kk, 3) + ' ; L/d = ' + fx(pi.H / I.D, 2));
    set('o_pHow', pi.how || '-');
    set(
      'o_pBt',
      pi.bt && pi.bt.beta != null
        ? `χ = ${fx(B.chi, 4)} ; λ1 = ${fx(B.l1, 4)} ; β' = ${fx(B.b1, 4)} ; α' = ${fx(B.a1, 4)} ; β = ${fx(B.beta, 4)}`
        : pi.bt && pi.bt.zt != null
          ? `ζ0 = ${fx(B.z0, 4)} ; mν = ${fx(B.mv, 3)} ; ζ' = ${fx(B.zt, 4)}`
          : '-',
    );
    set('o_pkw', fx(pi.kw, 0));
    {
      let tKt = `<tr><th>Cọc</th><th>Σδ (PT 37)</th><th>kt đầu cọc (kN/m)</th><th>L/(Ep.Ap) (m/kN)</th><th>kt,mh gối mũi trong mô hình (kN/m)</th></tr>`;
      (pi.ktC || []).forEach(
        (_val: number, i: number) =>
          (tKt += `<tr><td class="c">${i + 1}</td><td>${fx(pi.sdl[i], 4)}</td><td>${pi.noE0 ? '-' : fx(pi.ktAx[i], 0)}</td><td>${pi.comp ? (pi.H / pi.EAk).toExponential(3) : '-'}</td><td>${pi.noE0 ? '-' : fx(I.pktC![i], 0)}</td></tr>`),
      );
      tKt += `<tr><td class="l" colspan="5" style="white-space:normal">${pi.noE0 ? '<span class="bad">Chưa có mô đun biến dạng E0 của đất: chưa xác định được độ cứng dọc trục cọc theo TCVN 10304:2025, Điều 7.4.2. Mô hình tạm coi mũi cọc không lún và thân cọc chịu nén trên toàn chiều dài (không kể ma sát thân cọc), phân phối lực dọc giữa các cọc chưa đúng; nhập E0 các lớp đất (hoặc E0,1 ; E0,2) hoặc độ cứng kt nhập trực tiếp. Kết luận trụ ghi "chưa đủ số liệu".</span>' : pi.comp ? 'Độ cứng cọc đơn theo PT 30 là độ cứng đầu cọc, đã kể biến dạng dọc trục thân cọc. Mô hình khung có phần tử cọc chịu nén trên chiều dài L nên gối mũi lấy 1/kt,mh = 1/kt - L/(Ep.Ap), để độ cứng đầu cọc của mô hình bằng kt (không tính biến dạng thân cọc hai lần).' : 'Cọc ngắn (PT 34) hoặc kt nhập trực tiếp: gối mũi lấy bằng kt.'}</td></tr>`;
      set('tbKtP', tKt);
      set('o_pktNote', pi.noE0 ? '' : pi.note || '');
    }
  }
  t = `<tr><th>T.T</th><th>Tổ hợp</th><th>Cọc</th><th>Trạng thái chọn</th><th>Hx (dọc)</th><th>Hy (ngang)</th><th>N</th><th>Mx (ngang)</th><th>My (dọc)</th><th>M = √(Mx² + My²)</th></tr>`;
  for (const [lab, arr] of [
    ['TTGH CƯỜNG ĐỘ VÀ SỬ DỤNG', TRROWS!.CD],
    ['TTGH ĐẶC BIỆT', TRROWS!.DB],
  ] as const) {
    t += `<tr class="grp"><td colspan="10">${lab}</td></tr>`;
    arr.forEach(
      (r, i) =>
        (t += `<tr><td class="c">${i + 1}</td><td class="l">${r.id}</td><td class="c">${r.c + 1}</td><td class="c">${r.kind === 'M' ? 'M max' : 'N max'}</td><td>${fx(r.Hx, 1)}</td><td>${fx(r.Hy, 1)}</td><td>${fx(r.P, 1)}</td><td>${fx(r.Mx, 1)}</td><td>${fx(r.My, 1)}</td><td>${fx(r.Mr, 1)}</td></tr>`),
    );
  }
  set('tbPH', t);
  t = `<tr><th>Trạng thái giới hạn</th><th>Cọc</th><th>u dọc cầu (mm)</th><th>u ngang cầu (mm)</th><th>Lún (mm)</th></tr>`;
  (
    [
      ['CD', 'Cường độ'],
      ['SD', 'Sử dụng'],
      ['DB', 'Đặc biệt'],
    ] as const
  ).forEach(([g0, lab]) =>
    G.xs.forEach((_x, c) => {
      const e = C.PE[g0][c][0];
      t += `<tr>${c === 0 ? `<td class="l" rowspan="${G.n}">${lab}</td>` : ''}<td class="c">${c + 1}</td><td>${fx(e.uL * 1000, 2)}</td><td>${fx(e.uT * 1000, 2)}</td><td>${fx(e.uZ * 1000, 2)}</td></tr>`;
    }),
  );
  latestRkBr = null;
  if (typeof window !== 'undefined') (window as any).__rkBr = null;
  {
    const rk = S.rows.filter((r: any) => r.rock);
    const lim = 0.0004 * I.D * 1000;
    if (rk.length) {
      const zr = Math.max(0, G.ELs - Math.max(...rk.map((r: any) => r.top)));
      if (zr > I.pH + 1e-9) {
        t += `<tr class="grp"><td colspan="5">Cọc không tới mặt đá (mặt đá ở cao độ ${fx(G.ELs - zr, 3)} m, dưới mũi cọc): không áp dụng TCVN 11823-10, Điều 8.2.3</td></tr>`;
      } else {
        t += `<tr class="grp"><td colspan="5">Chuyển vị ngang của cọc tại mặt đá (cao độ ${fx(G.ELs - zr, 3)}, z = ${fx(zr, 2)} m) so với 0,0004b = ${fx(lim, 2)} mm (TCVN 11823-10, Điều 8.2.3)</td></tr>`;
        (
          [
            ['SD', 'Sử dụng'],
            ['CD', 'Cường độ'],
            ['DB', 'Đặc biệt'],
          ] as const
        ).forEach(([g0, lab]) => {
          const E = trPileEnv(R, C, g0, [...Array(G.n).keys()]);
          const r = E.reduce((p, q) => (Math.abs(q.z - zr) < Math.abs(p.z - zr) ? q : p));
          const u = Math.hypot(r.uT, r.uL) * 1000;
          const ok = u <= lim;
          if (g0 === 'SD') {
            latestRkBr = { ok, u, lim };
            if (typeof window !== 'undefined') (window as any).__rkBr = latestRkBr;
          }
          t += `<tr><td class="l">${lab}</td><td class="c">bao</td><td colspan="2">${fx(u, 2)} mm</td><td class="c ${ok ? 'ok' : 'bad'}">${ok ? '≤ 0,0004b' : '> 0,0004b: phải xét nguy cơ đá nứt giòn'}</td></tr>`;
        });
      }
    }
  }
  set('tbPU', t);
  const all = [...Array(G.n).keys()];
  for (const [g0, lab] of [
    ['CD', 'Bao TTGH Cường độ'],
    ['DB', 'Bao TTGH Đặc biệt'],
  ] as const) {
    const E = trPileEnv(R, C, g0, all);
    trPileDraw($('dgPE' + g0), E, lab + ' - bao các cọc');
    set('tbPE' + g0, trPileTab(E, 1));
  }
  trPileDiag(R, C);
  const KN: Array<[string, string]> = [
    ['Nmax', 'Lực dọc lớn nhất'],
    ['Nmin', 'Lực dọc nhỏ nhất'],
    ['Q2max', 'Lực cắt ngang cầu lớn nhất'],
    ['Q3max', 'Lực cắt dọc cầu lớn nhất'],
    ['M3max', 'Mômen ngang cầu lớn nhất'],
    ['M2max', 'Mômen dọc cầu lớn nhất'],
    ['M1max', PM_TXT('Bất lợi nhất theo biểu đồ tương tác (Mu/φMn lớn nhất)')],
  ];
  t = `<tr><th>Nội lực</th><th>Nội dung</th><th>Cọc</th><th>z (m)</th><th>Cao độ</th><th>Trạng thái</th><th>N (kN)</th><th>V ngang</th><th>V dọc</th><th>M ngang</th><th>M dọc</th><th>δ ngang ; δ dọc</th></tr>`;
  for (const [g0, lab] of [
    ['CD', 'TTGH CƯỜNG ĐỘ'],
    ['DB', 'TTGH ĐẶC BIỆT'],
  ] as const) {
    t += `<tr class="grp"><td colspan="12">${lab}</td></tr>`;
    const o = C.pileRec[g0];
    KN.forEach(([key, txtLabel]) => {
      const r = o[key];
      if (!r) return;
      const vr = R.VAR![r.iv];
      t += `<tr><td class="l">${key}</td><td class="l">${txtLabel}</td><td class="c">${r.c + 1}</td><td>${fx(r.z, 2)}</td><td>${fx(r.y, 3)}</td><td class="l">${vr.name} ${vr.lab || ''}</td><td>${fx(r.P, 1)}</td><td>${fx(r.Q2, 1)}</td><td>${fx(r.Q3, 1)}</td><td>${fx(r.M3, 1)}</td><td>${fx(r.M2, 1)}</td><td>${fx(r.dT, 3)} ; ${fx(r.dL, 3)}</td></tr>`;
    });
  }
  set('tbPS', t);
}

// ---------------------------------------------------------------------------
// 9. Tab 20 Loads & Combinations Renderer and Shared Superstructure Drawing
// ---------------------------------------------------------------------------

const trR = (val: unknown) => `<td>${trF(val, 2)}</td>`;

export function trRender20(R: TrCalcResult, _C: TrCheckResult): void {
  const I = R.I;
  const G = R.G;
  const LO = R.LO!;
  const PL = R.PL!;
  const info = R.LD!.info;
  set('o_td_Bxe', fx(PL.w, 3));
  set('o_td_nL', String(PL.nL));
  set('o_td_Ls1', fx(LO.Ls1, 2));
  set('o_td_Ls2', fx(LO.Ls2, 2));
  set('o_td_ELs', fx(G.ELs, 3));
  set('o_td_ELcb', fx(G.ELcb, 3));
  set('o_td_Hc', fx(G.Hc, 3));
  set('o_td_Ec', fx(R.M!.Ec, 1));
  set('o_td_V', fx(I.VB * I.S, 2));
  set('o_td_Cce', fx(info.Cce, 4));
  trFigEl(R);
  let t = `<tr><th rowspan="2">Hạng mục</th><th colspan="3">Nhịp trái</th><th colspan="3">Nhịp phải</th></tr><tr><th>Hz (kN)</th><th>x (m)</th><th>My (kN.m)</th><th>Hz (kN)</th><th>x (m)</th><th>My (kN.m)</th></tr>`;
  const r6 = (nm: string, a: number, b: number, bold?: number) =>
    `<tr${bold ? ' class="grp"' : ''}><td class="l">${nm}</td><td>${fx(a, 2)}</td><td>${fx(-I.e, 3)}</td><td>${fx(-a * I.e, 2)}</td><td>${fx(b, 2)}</td><td>${fx(I.e, 3)}</td><td>${fx(b * I.e, 2)}</td></tr>`;
  const MOR = getLatestMorResult() as any;
  if (MOR && MOR.SUP) {
    const S = MOR.SUP;
    const gc = MOR.gc || 24.5;
    [
      ['Dầm chủ', 0.5 * S.Vg * gc],
      ['Dầm ngang', 0.5 * (S.Vk || 0) * gc],
      ['Bản mặt cầu, mối nối', 0.5 * S.Vd * gc],
      ['Gờ lan can', 0.5 * S.Vpa * gc],
      ['Lề người đi bộ', 0.5 * (S.Vpl || 0) * gc],
      ['Lan can', 0.5 * (S.Pra || 0)],
    ].forEach(([nm, val]) => {
      if ((val as number) > 0) t += r6(nm as string, val as number, val as number);
    });
  }
  t +=
    r6('Tổng cộng DC', I.DC1, I.DC2, 1) + r6('Tổng cộng DW (lớp phủ, tiện ích)', I.DW1, I.DW2, 1);
  set('tbTdDC', t);
  const W = info.W;
  t =
    `<tr><th>Hạng mục</th><th>Thể tích (m³)</th><th>Trọng lượng (kN)</th><th>Mặt cắt đáy xà mũ Fv (kN)</th><th>Mặt cắt chân trụ Fv (kN)</th></tr>` +
    `<tr><td class="l">Xà mũ</td><td>${fx(W.Vcap, 3)}</td><td>${fx(W.Wcap, 2)}</td><td>${fx(W.Wcap, 2)}</td><td>${fx(W.Wcap, 2)}</td></tr>` +
    (G.brace
      ? `<tr><td class="l">Giằng</td><td>${fx(W.Vbr, 3)}</td><td>${fx(W.Wbr, 2)}</td><td>0</td><td>${fx(W.Wbr, 2)}</td></tr>`
      : '') +
    `<tr><td class="l">Thân trụ (${G.n} cột D = ${fx(I.D, 2)} m, dài ${fx(G.Hc, 3)} m)</td><td>${fx(W.Vcol, 3)}</td><td>${fx(W.Wcol, 2)}</td><td>0</td><td>${fx(W.Wcol, 2)}</td></tr>` +
    `<tr class="grp"><td class="l">Tổng cộng</td><td>${fx(W.Vcap + W.Vbr + W.Vcol, 3)}</td><td>${fx(W.Wcap + W.Wbr + W.Wcol, 2)}</td><td>${fx(W.Wcap, 2)}</td><td>${fx(W.Wcap + W.Wbr + W.Wcol, 2)}</td></tr>`;
  set('tbTdDCp', t);
  t = `<tr><th rowspan="2">Trường hợp xếp xe (1 làn; trục xe đã nhân 1 + IM)</th><th colspan="3">Phản lực lên trụ (kN)</th></tr><tr><th>Nhịp trái R1</th><th>Nhịp phải R2</th><th>R1 + R2</th></tr>`;
  for (const [cs, lab] of [
    ['A', 'a) Phản lực lớn nhất: xếp xe trên hai nhịp (Ls = ' + fx(LO.Ls1, 2) + ' ; ' + fx(LO.Ls2, 2) + ' m)'],
    ['B', 'b) Mômen dọc cầu lớn nhất: xếp xe trên nhịp phải'],
  ] as const) {
    t += `<tr class="grp"><td colspan="4">${lab}</td></tr>`;
    LO[cs].cand.forEach((c) => {
      const b = c === LO[cs].best;
      t += `<tr><td class="l">${c.nm}${b ? ' <b>(chọn)</b>' : ''}</td><td>${fx(c.R1, 2)}</td><td>${fx(c.R2, 2)}</td><td>${fx(c.R1 + c.R2, 2)}</td></tr>`;
    });
  }
  set('tbTdLL', t);
  trFigIL(R);
  t = `<tr><th>Tải trọng</th><th>Hx (kN)</th><th>Hy (kN)</th><th>Hz (kN)</th><th>Mx (kN.m)</th><th>My (kN.m)</th></tr>`;
  for (let k = PL.nL; k >= 1; k--) {
    const m = trMultiPresence(k);
    const p = PL.P.find((q) => q.k === k && q.u < 1e-9);
    if (!p) continue;
    const yc = p.yc;
    const A = LO.A;
    const lane = k * m * A.lane;
    const ax = k * m * A.axNoIM;
    const im = k * m * A.axNoIM * (LO.im - 1);
    const PLz = PL.PLt[0];
    const My = k * m * (A.best.R2 - A.best.R1) * I.e;
    t +=
      `<tr class="grp"><td colspan="6">${String.fromCharCode(96 + PL.nL - k + 1)}) ${k} làn xe, hệ số làn m = ${fx(m, 2)}, tâm các làn cách tim cầu Yt = ${fx(yc, 3)} m</td></tr>` +
      `<tr><td class="l">Tải trọng làn</td><td>0</td><td>0</td>${trR(lane)}${trR(lane * yc)}${trR(k * m * A.best.k * (A.ln.R2 - A.ln.R1) * I.e)}</tr>` +
      `<tr><td class="l">Max (xe tải, xe hai trục) - chưa có IM</td><td>0</td><td>0</td>${trR(ax)}${trR(ax * yc)}${trR(k * m * (A.best.a2 - A.best.a1) * I.e)}</tr>` +
      `<tr><td class="l">Xung kích IM = ${fx(I.IM, 0)}%</td><td>0</td><td>0</td>${trR(im)}${trR(im * yc)}${trR(k * m * (A.best.a2 - A.best.a1) * (LO.im - 1) * I.e)}</tr>` +
      (PLz ? `<tr><td class="l">Người đi bộ</td><td>0</td><td>0</td>${trR(PLz)}<td>0</td><td>0</td></tr>` : '') +
      `<tr><td class="l"><b>Cộng</b></td><td>0</td><td>0</td>${trR(lane + ax + im + PLz)}${trR((lane + ax + im) * yc)}${trR(My)}</tr>`;
  }
  set('tbTdLLc', t);
  trFigLane(R);
  t = `<tr><th>Nội dung</th><th>Giá trị</th><th>Đơn vị</th></tr><tr><td class="l">BR 1 làn = max(25%·325 ; 25%·220 ; 5%·(325 + 9,3·(L1+L2)) ; 5%·(220 + 9,3·(L1+L2)))</td><td>${fx(LO.BR1, 2)}</td><td class="c">kN</td></tr>`;
  for (let k = 1; k <= PL.nL; k++) {
    t += `<tr><td class="l">BR ${k} làn × m = ${fx(trMultiPresence(k), 2)}${I.kBR ? '' : ' (gối di động: không truyền)'}</td><td>${fx(I.kBR * k * trMultiPresence(k) * LO.BR1, 2)}</td><td class="c">kN</td></tr>`;
  }
  t += `<tr><td class="l">Điểm đặt: cao 1,8 m trên mặt đường, cao độ</td><td>${fx(info.zBR, 3)}</td><td class="c">m</td></tr>`;
  set('tbTdBR', t);
  const WA = info.WA;
  t =
    `<tr><th>Nội dung</th><th>Ký hiệu</th><th>Giá trị</th><th>Đơn vị</th></tr>` +
    `<tr><td class="l">Áp lực nước tĩnh (trụ thân cột: các thành phần ngang cân bằng)</td><td class="c">WA1</td><td>0</td><td class="c">kN</td></tr>` +
    `<tr><td class="l">Chiều sâu nước tác dụng lên cột: MNCN - MĐSX (không quá đáy xà mũ)</td><td class="c">h</td><td>${fx(WA.hw, 3)}</td><td class="c">m</td></tr>` +
    `<tr><td class="l">Lực đẩy nổi mỗi cột γw·A·h ở MNCN (tổ hợp có γp nhỏ nhất)</td><td class="c">WA2</td><td>${fx(WA.Fb, 2)}</td><td class="c">kN</td></tr>` +
    `<tr><td class="l">Lực đẩy nổi mỗi cột ở MNTN (các tổ hợp còn lại)</td><td class="c">WA2</td><td>${fx(WA.FbL, 2)}</td><td class="c">kN</td></tr>` +
    (WA.hcw > 0
      ? `<tr><td class="l">Xà mũ ngập ${fx(WA.hcw, 3)} m dưới MNCN: đẩy nổi γw·b·(Lxm - 2lv)·h ; lực dòng chảy lên mặt đầu xà mũ p·b·h</td><td class="c">WA2 ; WA3</td><td>${fx(WA.Fbc, 2)} ; ${fx(WA.Fdc, 2)}</td><td class="c">kN</td></tr>`
      : '') +
    `<tr><td class="l">Áp lực dòng chảy theo phương dọc trụ p = 5,14·10⁻⁴·CD·V² (PT 14)</td><td class="c">p</td><td>${fx(WA.pD, 4)}</td><td class="c">kN/m²</td></tr>` +
    `<tr><td class="l">Lực cản dọc trụ trên mỗi cột p·D·h (theo phương xà mũ), điểm đặt cách mặt đất h/2</td><td class="c">WA3</td><td>${fx(WA.FD, 2)}</td><td class="c">kN</td></tr>` +
    `<tr><td class="l">Áp lực ngang pL = 5,14·10⁻⁴·CL·V² (PT 15), CL = ${fx(WA.CLv, 2)} (Bảng 12)</td><td class="c">pL</td><td>${fx(WA.pL, 4)}</td><td class="c">kN/m²</td></tr>` +
    `<tr><td class="l">Lực cản ngang trên mỗi cột (theo phương dọc cầu)</td><td class="c">WA3</td><td>${fx(WA.FL, 2)}</td><td class="c">kN</td></tr>`;
  set('tbTdWA', t);
  const w = info.wind;
  t = `<tr><th>Bộ phận</th><th>At (m²)</th><th>Cd</th><th>1,8At</th><th>0,0006V²AtCd</th><th>PD (kN)</th><th>z (m)</th><th>Mx tại chân trụ (kN.m)</th></tr>`;
  const ws = (lab: string, VV: number, At: number, Cd: number, z: number, k = 1) => {
    const a = 0.0006 * VV * VV * At * Cd;
    const P = Math.max(a, 1.8 * At) * k;
    return `<tr><td class="l">${lab}</td><td>${fx(At, 3)}</td><td>${fx(Cd, 3)}</td><td>${fx(1.8 * At, 2)}</td><td>${fx(a, 2)}</td><td>${fx(P, 2)}</td><td>${fx(z - G.ELs, 3)}</td><td>${fx(P * (z - G.ELs), 2)}</td></tr>`;
  };
  for (const [VV, lab] of [[w.V, 'a) Gió ngang, V = ' + fx(w.V, 2) + ' m/s']] as const) {
    t +=
      `<tr class="grp"><td colspan="8">${lab}</td></tr>` +
      ws('Kết cấu nhịp (dầm + bản + lớp phủ + gờ), dài (L1+L2)/2', VV, w.At1, I.Cd1, w.zs1) +
      ws('Lan can', VV, w.At2, I.Cd2, w.zs2) +
      ws('Xà mũ (mặt đầu, hình chiếu b × h)', VV, I.b * I.h, I.Cdx, G.yc) +
      G.xs
        .map((_x, c) =>
          ws(`Thân trụ ${c + 1} (dài ${fx(w.colWindLen, 2)} m)`, VV, I.D * w.colWindLen, I.Cdc, G.ELcb - w.colWindLen / 2),
        )
        .join('');
  }
  for (const [VV, lab] of [
    [w.V, 'b) Gió dọc, V = ' + fx(w.V, 2) + ' m/s (kết cấu nhịp lấy 0,25 gió ngang)'],
  ] as const) {
    t +=
      `<tr class="grp"><td colspan="8">${lab}</td></tr>` +
      ws('Kết cấu nhịp (0,25 PD ngang)', VV, w.At1, I.Cd1, w.zs1, 0.25) +
      ws('Lan can (0,25 PD ngang)', VV, w.At2, I.Cd2, w.zs2, 0.25) +
      ws('Xà mũ (mặt bên)', VV, I.Lc * I.h, I.Cdx, G.yc) +
      G.xs
        .map((_x, c) => ws(`Thân trụ ${c + 1}`, VV, I.D * w.colWindLen, I.Cdc, G.ELcb - w.colWindLen / 2))
        .join('');
  }
  t += `<tr class="grp"><td colspan="8">c) Gió thẳng đứng Pv = 0,00045V²Av, Av = B·(L1+L2)/2 = ${fx(w.Av, 2)} m², đặt tại B/4 phía đón gió</td></tr><tr><td class="l">V = ${fx(w.V, 2)} m/s</td><td colspan="4"></td><td>${fx(w.Pv, 2)}</td><td colspan="2"></td></tr>`;
  t += `<tr class="grp"><td colspan="8">d) Gió lên hoạt tải (Bảng 15): gió ngang 1,46 kN/m ; gió dọc 0,55 kN/m kèm thành phần vuông góc 0,50 kN/m (góc 60°), cao 1,8 m trên mặt đường (cao độ ${fx(w.zWL, 3)})</td></tr><tr><td class="l">WL ngang / dọc</td><td colspan="4"></td><td>${fx(w.WLy, 2)} / ${fx(w.WLx, 2)}</td><td>${fx(w.zWL - G.ELs, 3)}</td><td>${fx(w.WLy * (w.zWL - G.ELs), 2)}</td></tr>`;
  set('tbTdWS', t);
  const TU = info.TU;
  const isPad = +I.brt === 2;
  const gw = isPad ? 'lớp đệm' : 'gối';
  t =
    `<tr><th>Nội dung</th><th>Nhịp trái</th><th>Nhịp phải</th><th>Đơn vị</th></tr>` +
    `<tr><td class="l">Biên độ nhiệt độ ΔT = max(Tmax - Tlắp,min ; Tlắp,max - Tmin)</td><td colspan="2">${fx(TU.dT, 1)}</td><td class="c">°C</td></tr>` +
    (TU.cont
      ? ''
      : `<tr><td class="l">Chuyển vị tại gối Δ = α·ΔT·L/2 (điểm cố định giữa nhịp, gối cao su hai đầu)</td><td>${fx(TU.dTU[0] * 1000, 2)}</td><td>${fx(TU.dTU[1] * 1000, 2)}</td><td class="c">mm</td></tr>`) +
    (isPad
      ? `<tr><td class="l">Độ cứng chống cắt của lớp đệm dưới các dầm trên một đầu nhịp k = n·Gđ·A/tđ (n = ${TU.nbr} dầm)</td><td colspan="2">${fx(TU.kb, 1)}</td><td class="c">kN/m</td></tr>`
      : `<tr><td class="l">Độ cứng các gối trên một đầu nhịp k = n·G·A/hrt (n = ${TU.nbr} gối)</td><td colspan="2">${fx(TU.kb, 1)}</td><td class="c">kN/m</td></tr>`) +
    (TU.cont
      ? ''
      : `<tr><td class="l">Lực ngang tại gối do TU: H = k·Δ</td><td>${fx(TU.FTU[0], 2)}</td><td>${fx(TU.FTU[1], 2)}</td><td class="c">kN</td></tr>` +
        `<tr><td class="l">Lực truyền vào trụ (hai nhịp ngược chiều): |H1 - H2|</td><td colspan="2">${fx(TU.net, 2)}</td><td class="c">kN</td></tr>` +
        `<tr><td class="l">Chuyển vị do co ngót, từ biến Δ = εcs·L/2 ; lực H = k·Δ</td><td>${fx(TU.dCS[0] * 1000, 2)} mm ; ${fx(TU.FCS[0], 2)}</td><td>${fx(TU.dCS[1] * 1000, 2)} mm ; ${fx(TU.FCS[1], 2)}</td><td class="c">kN</td></tr>` +
        `<tr><td class="l">Lực CR-SH truyền vào trụ: |H1 - H2|</td><td colspan="2">${fx(TU.netCS, 2)}</td><td class="c">kN</td></tr>`);
  if (TU.cont) {
    t += `<tr><td class="l">Nhịp nối liên tục nhiệt qua trụ, điểm cố định cách tim trụ Lct = ${fx(TU.cont.Lc, 2)} m: chuyển vị cưỡng bức của kết cấu nhịp tại trụ Δ = α·ΔT·Lct</td><td colspan="2">${fx(TU.cont.dTU * 1000, 3)}</td><td class="c">mm</td></tr>`;
    if (TU.Ke != null) {
      t +=
        `<tr><td class="l">Độ cứng ${gw} hai đầu nhịp trên trụ (cùng chuyển vị): kđ = 2k</td><td colspan="2">${fx(TU.Kd, 1)}</td><td class="c">kN/m</td></tr>` +
        `<tr><td class="l">Độ cứng ngang của trụ tại cao độ ${isPad ? 'đáy dầm' : 'đặt gối'}: Ktr = 1/δ, δ - chuyển vị tại đó do lực ngang 1 kN (mô hình khung trụ, cọc trong đất mục 15)</td><td colspan="2">${fx(TU.Kp, 1)}</td><td class="c">kN/m</td></tr>` +
        `<tr><td class="l">Độ cứng tương đương (${gw} nối tiếp trụ): K = 1/(1/kđ + 1/Ktr)</td><td colspan="2">${fx(TU.Ke, 1)}</td><td class="c">kN/m</td></tr>` +
        `<tr><td class="l">Lực vào trụ do nhiệt độ TU = K·Δ${TU.cap != null ? ' ≤ lực ma sát (dưới)' : ''}</td><td colspan="2">${fx(TU.net, 2)}</td><td class="c">kN</td></tr>` +
        `<tr><td class="l">Co ngót, từ biến: Δ = εcs·Lct = ${fx(TU.cont.dCS * 1000, 3)} mm ; lực vào trụ CR-SH = K·Δ${TU.cap != null ? ' ≤ lực ma sát còn lại sau TU' : ''}</td><td colspan="2">${fx(TU.netCS, 2)}</td><td class="c">kN</td></tr>`;
    } else {
      t +=
        `<tr><td class="l">Lực vào trụ 2k·Δ (gối hai đầu nhịp cùng chuyển vị)</td><td colspan="2">${fx(TU.net, 2)}</td><td class="c">kN</td></tr>` +
        `<tr><td class="l">Co ngót, từ biến: Δ = εcs·Lct = ${fx(TU.cont.dCS * 1000, 2)} mm ; lực vào trụ 2k·Δ</td><td colspan="2">${fx(TU.netCS, 2)}</td><td class="c">kN</td></tr>`;
    }
  }
  if (TU.cap != null) {
    t += `<tr><td class="l">Dầm kê trực tiếp qua lớp đệm: tổng lực ngang do nhiệt độ, co ngót, từ biến truyền vào trụ không lớn hơn lực ma sát TU + CR-SH ≤ μđ.(DC + DW) = ${fx(TU.muK, 2)} × ${fx(TU.Nk, 2)} = ${fx(TU.cap, 2)} kN ; lấy TU = ${fx(TU.net, 2)} kN ; CR-SH = ${fx(TU.netCS, 2)} kN</td><td colspan="2">${fx(TU.cap, 2)}</td><td class="c">kN</td></tr>`;
  }
  set('tbTdTU', t);
  const E = R.EQ!;
  t = `<tr><th>Thông số</th><th>Ký hiệu</th><th>Dọc cầu</th><th>Ngang cầu</th><th>Đơn vị</th></tr>`;
  const e2 = (a: string, b: string, x: unknown, y: unknown, u: string, d = 3) =>
    `<tr><td class="l">${a}</td><td class="c">${b}</td><td>${trF(x, d)}</td><td>${trF(y, d)}</td><td class="c">${u}</td></tr>`;
  t +=
    e2('Vùng động đất (Bảng 16) / hệ số thực địa S (Bảng 17)', '', E.zone, E.S, '', 2) +
    e2('Trọng lượng kết cấu nhịp', 'Q1', E.Wsup, E.Wsup, 'kN', 1) +
    e2('Trọng lượng xà mũ + giằng', 'Q2', W.Wcap + W.Wbr, W.Wcap + W.Wbr, 'kN', 1) +
    e2('Trọng lượng thân trụ (mặt đất sau xói - đáy xà mũ)', 'Q3', W.Wcol, W.Wcol, 'kN', 1) +
    e2('Trọng lượng tham gia dao động W = Q1 + Q2 + 0,24·Q3', 'W', E.Wm, E.Wm, 'kN', 1) +
    e2('Độ cứng ngang của trụ tại cao độ gối (mô hình khung gồm cọc và lò xo đất)', 'K', E.Kl, E.Kt, 'kN/m', 0) +
    e2('Chu kỳ dao động T = 2π√(W/(g·K))', 'Tm', E.Tl, E.Tt, 's') +
    e2('Hệ số đáp ứng đàn hồi (PT 19, 21; Điều 9.6.2)', 'Csm', E.Cl, E.Ct, '', 4) +
    e2('Hệ số điều chỉnh ứng xử (Bảng 18) ; trụ khung cọc: phần cọc cũng dùng R (Điều 9.9.3)', 'R', E.R, E.R, '', 2);
  set('tbTdEQ', t);
  t = `<tr><th rowspan="2">Bộ phận</th><th rowspan="2">Khối lượng (kN)</th><th colspan="3">Dọc cầu</th><th colspan="3">Ngang cầu</th></tr><tr><th>Hx (kN)</th><th>z (m)</th><th>My (kN.m)</th><th>Hy (kN)</th><th>z (m)</th><th>Mx (kN.m)</th></tr>`;
  const zq = (z: number) => z - G.ELs;
  const eqr = (nm: string, Wq: number, z: number) =>
    `<tr><td class="l">${nm}</td><td>${fx(Wq, 1)}</td><td>${fx(E.EQd.k * Wq, 2)}</td><td>${fx(zq(z), 3)}</td><td>${fx(E.EQd.k * Wq * zq(z), 2)}</td><td>${fx(E.EQn.k * Wq, 2)}</td><td>${fx(zq(z), 3)}</td><td>${fx(E.EQn.k * Wq * zq(z), 2)}</td></tr>`;
  t +=
    eqr('Kết cấu nhịp', E.Wsup, E.zSupM) +
    eqr('Xà mũ', W.Wcap, G.yc) +
    (G.brace ? eqr('Giằng', W.Wbr, G.yb) : '') +
    eqr('Thân trụ', W.Wcol, G.ELs + G.Hc / 2);
  const totEq = (k: number) => k * (E.Wsup + W.Wcap + W.Wbr + W.Wcol);
  t += `<tr class="grp"><td class="l">Tổng cộng (mặt cắt chân trụ), hệ số Csm/R: dọc ${fx(E.EQd.k, 4)} ; ngang ${fx(E.EQn.k, 4)}</td><td></td><td>${fx(totEq(E.EQd.k), 2)}</td><td></td><td>${fx(trResAt(R.C3!.EQd, G.ELs).My, 2)}</td><td>${fx(totEq(E.EQn.k), 2)}</td><td></td><td>${fx(trResAt(R.C3!.EQn, G.ELs).Mx, 2)}</td></tr>`;
  if (E.zone >= 3) {
    t += `<tr><td class="l bad" colspan="8">Vùng động đất ${E.zone} (A > 0,19): lực thiết kế mỗi bộ phận lấy giá trị nhỏ hơn của lực điều chỉnh (Điều 9.9.4.2, móng R = 1,0) và lực khớp dẻo (Điều 9.9.4.3); bảng tính dùng lực điều chỉnh với R của trụ cho cả cọc trụ. Lực khớp dẻo và các yêu cầu cấu tạo, lực cắt vùng đầu cột của Điều 10.11.4 Phần 5 phải kiểm toán bổ sung.</td></tr>`;
  }
  if (E.zone === 1) {
    t += `<tr><td class="l" colspan="8">Vùng 1: lực liên kết tối thiểu theo phương bị kiềm chế (Điều 9.9.2) = ${fx(E.kmin, 1)} × phản lực tĩnh tải = ${fx(E.kmin * E.Wsup, 1)} kN dùng thiết kế gối và liên kết.</td></tr>`;
  }
  set('tbTdEQF', t);
  const LLrep = trLLrep(R);
  const rows: Array<[string, string, string | null]> = [
    ['Trọng lượng lớp phủ mặt cầu', 'DW', 'DW'],
    ['Trọng lượng kết cấu phần trên', 'DC', 'DC'],
    ['Trọng lượng bản thân trụ', 'DC', 'DCp'],
    ['Hoạt tải I (' + PL.nL + ' làn)', 'LL+IM', 'LL1'],
    ['Hoạt tải II (1 làn lệch tâm)', 'LL+IM', 'LL2'],
    ['Lực hãm xe', 'BR', 'BR'],
    ['Lực ly tâm', 'CE', 'CE'],
    ['Áp lực nước tĩnh', 'WA1', null],
    ['Áp lực đẩy nổi (MNCN)', 'WA2', 'WA2'],
    ['Áp lực đẩy nổi (MNTN)', 'WA2', 'WA2L'],
    ['Áp lực dòng chảy', 'WA3', 'WA3'],
    ['Áp lực đất thẳng đứng', 'EV', null],
    ['Gió dọc lên kết cấu, V = ' + fx(w.V, 1) + ' m/s', 'WS', 'WSd'],
    ['Gió ngang lên kết cấu, V = ' + fx(w.V, 1) + ' m/s', 'WS', 'WSn'],
    ['Gió thẳng đứng, V = ' + fx(w.V, 1) + ' m/s', 'WS', 'WVp'],
    ['Gió dọc lên hoạt tải', 'WL', 'WLd'],
    ['Gió ngang lên hoạt tải', 'WL', 'WLn'],
    ['Động đất phương ngang', 'EQ', 'EQn'],
    ['Động đất phương dọc', 'EQ', 'EQd'],
    ['Va tàu phương ngang', 'CV', 'CVn'],
    ['Va tàu phương dọc', 'CV', 'CVd'],
    ['Va xe phương ngang', 'CT', 'CTn'],
    ['Va xe phương dọc', 'CT', 'CTd'],
    ['Nhiệt độ đều', 'TU', 'TU'],
    ['Co ngót, từ biến', 'CR-SH', 'CS'],
  ];
  const C3: Record<string, TrLoadPoint[]> = { ...R.C3!, ...LLrep };
  for (const [id, z0] of [
    ['tbTdR1', G.ELcb],
    ['tbTdR2', G.ELs],
  ] as const) {
    t = `<tr><th>Tải trọng</th><th>Ký hiệu</th><th>Hx (kN)</th><th>Hy (kN)</th><th>Hz (kN)</th><th>Mx (kN.m)</th><th>My (kN.m)</th><th>Mz (kN.m)</th></tr>`;
    rows.forEach(([nm, sym, k]) => {
      const o = k ? trResAt(C3[k], z0) : { Hx: 0, Hy: 0, Hz: 0, Mx: 0, My: 0, Mz: 0 };
      t += `<tr><td class="l">${nm}</td><td class="c">${sym}</td>${(['Hx', 'Hy', 'Hz', 'Mx', 'My', 'Mz'] as const).map((q) => trR(o[q])).join('')}</tr>`;
    });
    set(id, t);
  }
  const PP = {
    max: ['1,25', '1,50'],
    min: ['0,90', '0,65'],
    IV: ['1,50', '1,50'],
    IVb: ['0,90', '0,65'],
    one: ['1,00', '1,00'],
  } as const;
  t = `<tr><th>Tổ hợp</th><th>DC</th><th>DW</th><th>LL, IM, BR, CE, PL</th><th>WA</th><th>WS</th><th>WL</th><th>TU, CR, SH</th><th>EQ, CT, CV</th></tr>`;
  R.CB!.forEach((c) => {
    t += `<tr><td class="l">${c.id}${c.desc ? ' (' + c.desc + ')' : ''}</td><td class="c">${PP[c.p][0]}</td><td class="c">${PP[c.p][1]}</td><td class="c">${c.gLL ? fx(c.gLL, 2) : '-'}</td><td class="c">1,00</td><td class="c">${c.w ? fx(c.w.g, 2) + (c.w.V === '25' ? ' (V = ' + fx(w.V25, 0) + ')' : '') : '-'}</td><td class="c">${c.w && c.w.WL ? fx(c.w.WL, 2) : '-'}</td><td class="c">${c.TU ? fx(c.TU, 2) : '-'}</td><td class="c">${c.eq || c.ct ? '1,00' : '-'}</td></tr>`;
  });
  set('tbTdCmb', t);
  for (const [id, z0] of [
    ['tbTdC1', G.ELcb],
    ['tbTdC2', G.ELs],
  ] as const) {
    t = `<tr><th>TTGH</th><th>Hoạt tải</th><th>Hx (kN)</th><th>Hy (kN)</th><th>Hz (kN)</th><th>Mx (kN.m)</th><th>My (kN.m)</th><th>Mz (kN.m)</th></tr>`;
    const B: Record<string, { Hx: number; Hy: number; Hz: number; Mx: number; My: number; Mz: number }> = {};
    Object.keys(C3).forEach((k) => (B[k] = trResAt(C3[k], z0)));
    R.CB!.forEach((cb) => {
      const P = PP[cb.p].map((s) => +s.replace(',', '.'));
      const e = cb.st === 'SD' ? 1 : I.eta;
      for (const ll of cb.gLL ? ['LL1', 'LL2'] : [null]) {
        for (const wd of cb.w ? ['n', 'd'] : [null]) {
          const o: Record<string, number> = { Hx: 0, Hy: 0, Hz: 0, Mx: 0, My: 0, Mz: 0 };
          const ad = (k: string | null, g0: number) => {
            if (!k || !B[k] || !g0) return;
            for (const q in o) o[q] += e * g0 * B[k][q as keyof typeof B[string]];
          };
          ad('DC', P[0]);
          ad('DCp', P[0]);
          ad('DW', P[1]);
          ad(cb.p === 'min' || cb.p === 'IVb' || cb.wH ? 'WA2' : 'WA2L', 1);
          ad('WA3', 1);
          if (ll) {
            ad(ll, cb.gLL);
            ad('BR', cb.gLL);
            ad('CE', cb.gLL);
          }
          if (cb.w) {
            if (wd === 'n') {
              ad('WS' + (cb.w.V === '25' ? 'n25' : 'n'), cb.w.g);
              ad('WLn', cb.w.WL);
              if (cb.w.WV) ad('WVp', cb.w.WV);
            } else {
              ad('WS' + (cb.w.V === '25' ? 'd25' : 'd'), cb.w.g);
              ad('WLd', cb.w.WL);
              ad('WLn', (cb.w.WL * 0.5) / 1.46);
            }
          }
          ad('TU', cb.TU);
          ad('CS', cb.TU);
          if (cb.eq) {
            ad('EQd', cb.eq[0]);
            ad('EQn', cb.eq[1]);
          }
          if (cb.ct) {
            ad('CTn', 1);
            ad('CVn', 1);
          }
          t += `<tr><td class="l">${cb.id}${wd ? (wd === 'n' ? ' - gió ngang' : ' - gió dọc') : ''}</td><td class="c">${ll === 'LL1' ? 'I' : ll === 'LL2' ? 'II' : '-'}</td>${(['Hx', 'Hy', 'Hz', 'Mx', 'My', 'Mz'] as const).map((q) => trR(o[q])).join('')}</tr>`;
        }
      }
    });
    set(id, t);
  }
}

export function trLLrep(R: TrCalcResult): { LL1: TrLoadPoint[]; LL2: TrLoadPoint[]; BR: TrLoadPoint[]; CE: TrLoadPoint[] } {
  const I = R.I;
  const G = R.G;
  const PL = R.PL!;
  const LO = R.LO!;
  const mk = (k: number): TrLoadPoint[] => {
    const p = PL.P.find((q) => q.k === k && q.u < 1e-9);
    if (!p) return [];
    const arr: TrLoadPoint[] = [];
    G.xg.forEach((y, j) => {
      const val = p.gA[j] + PL.PLA[j];
      if (val) arr.push({ y, x: 0, z: G.zBr, FZ: val, kind: 'g' });
    });
    const My = p.dRA * I.e;
    if (My) {
      arr.push(
        { y: 0, x: 1, z: G.zBr, FZ: My, kind: 's' },
        { y: 0, x: 0, z: G.zBr, FZ: -My, kind: 's' },
      );
    }
    return arr;
  };
  const BR = I.kBR * PL.nL * trMultiPresence(PL.nL) * LO.BR1;
  const ce = (R.LD!.info.Cce as number) * PL.nL * trMultiPresence(PL.nL) * LO.A.axNoIM;
  return {
    LL1: mk(PL.nL),
    LL2: mk(1),
    BR: [{ y: 0, x: 0, z: R.LD!.info.zBR, FX: BR, kind: 's' }],
    CE: ce ? [{ y: 0, x: 0, z: R.LD!.info.zBR, FY: ce, kind: 's' }] : [],
  };
}

export function trDrawSuper(
  d: any,
  X: (y: number) => number,
  Y: (z: number) => number,
  k: number,
  R: TrCalcResult,
  id: string,
): number {
  const I = R.I;
  const G: any = R.G;
  const zb = G.zBr;
  const D = getLatestDamResult() as any;
  const XF = G.XF;
  const dD = XF ? XF.dD : () => 0;
  const dM = XF ? XF.dM : () => 0;
  const GGm = D && D.GG ? D.GG : null;
  const Ng = G.nb;
  const H = I.Hgd;
  const hs = I.hs;
  const Wb = I.Wd;
  const Wpa = I.bl - I.wp;
  const WPL = I.wp;
  const Hpa = I.Hra;
  const Hra = I.Hrl;
  const Hsu = I.Hsu;
  const mir = (P: number[][]) => P.map(([x, y]) => [-x, y]).reverse();
  const tg = G.tg != null ? G.tg : Math.min(0.06, 0.4 * I.hb);
  const ELt = G.ELt;
  G.xg.forEach((xc: number, i: number) => {
    let P: number[][];
    let vd: number[][] = [];
    let bw = Math.min(I.sg * 0.9, 0.6);
    if (GGm && GGm.g && GGm.g.dd) {
      const ed = (i === 0 || i === Ng - 1) && Ng > 1;
      const Gm = ed ? GGm.b || GGm.g : GGm.g;
      P = Gm.dd;
      if (i === Ng - 1 && Ng > 1) P = mir(P);
      vd = (Gm.voids || []).map((v0: number[]) => [i === Ng - 1 && Ng > 1 ? -v0[0] : v0[0], ...v0.slice(1)]);
      const xs0 = P.filter((p) => p[1] < 1).map((p) => p[0]);
      if (xs0.length > 1) bw = (Math.max(...xs0) - Math.min(...xs0)) / 1000;
    } else {
      P = [
        [-bw * 500, 0],
        [bw * 500, 0],
        [bw * 500, H * 1000],
        [-bw * 500, H * 1000],
      ];
    }
    const z0 = zb - (G.HK && G.HK.dG && G.HK.dG[i] != null ? G.HK.dG[i] : dD(xc));
    d.poly(
      P.map(([x, y]) => [X(xc + x / 1000), Y(z0 + y / 1000)]),
      `url(#hC${id})`,
    );
    vd.forEach((v0) => {
      const cx = X(xc + v0[0] / 1000);
      const cy = Y(z0 + v0[1] / 1000);
      if (v0.length >= 5) {
        const vw = (v0[2] / 1000) * k;
        const vh = (v0[3] / 1000) * k;
        d.s += `<rect class="l" x="${(cx - vw / 2).toFixed(1)}" y="${(cy - vh / 2).toFixed(1)}" width="${vw.toFixed(1)}" height="${vh.toFixed(1)}" rx="${(((v0[4] || 0) / 1000) * k).toFixed(1)}" style="fill:#fff"/>`;
      } else {
        d.s += `<circle class="l" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${((v0[2] / 2000) * k).toFixed(1)}" style="fill:#fff"/>`;
      }
    });
    if (+I.brt === 2) {
      d.s += `<rect x="${X(xc - bw / 2).toFixed(1)}" y="${Y(z0).toFixed(1)}" width="${(bw * k).toFixed(1)}" height="${Math.max(1.5, (I.hb || 0.02) * k).toFixed(1)}" fill="#333"/>`;
      return;
    }
    if (ELt != null) {
      const wk = G.dkw || Math.min(bw * 0.9, 0.9 * I.sg);
      const zt = ELt - dM(xc);
      const zk = z0 - tg;
      if (zk > zt + 1e-4) {
        d.s += `<rect x="${X(xc - wk / 2).toFixed(1)}" y="${Y(zk).toFixed(1)}" width="${(wk * k).toFixed(1)}" height="${((zk - zt) * k).toFixed(1)}" fill="#bfc6cd" stroke="#333" stroke-width="0.6"/>`;
      }
    }
    const gb = Math.min(I.gb2 > 0 ? I.gb2 : 0.2, 0.7 * G.dgb, 0.45 * (G.dkw || bw));
    G.gOff.forEach((o: number) => {
      d.s += `<rect x="${(X(xc + o) - (gb / 2) * k).toFixed(1)}" y="${Y(z0).toFixed(1)}" width="${(gb * k).toFixed(1)}" height="${Math.max(2, tg * k).toFixed(1)}" fill="#333"/>`;
    });
  });
  const isI = !!(GGm && GGm.g && GGm.g.noJoint);
  const tpI = isI ? (I.tpd > 0 ? I.tpd : num('gi_tpan') || 0) : 0;
  const IG = isI
    ? [GGm.g, GGm.b || GGm.g].map((q: any) => {
        const t = ITOP(q.dd, q.H || H * 1000);
        return { a: t.a / 1000, c: t.c / 1000, h6: t.h6 / 1000 };
      })
    : [];
  const geoI = (i: number) => IG[(i === 0 || i === Ng - 1) && Ng > 1 ? 1 : 0];
  const HT = H + (isI && tpI > 0 ? Math.max(0, tpI - IG[0].h6) : 0);
  const bng = G.HK && G.HK.dGc != null;
  const zsb = (y: number) => (bng ? zb + HT - G.HK.dGc : zb + HT - dD(y));
  const zgt = (i: number) => zb - (G.HK && G.HK.dG && G.HK.dG[i] != null ? G.HK.dG[i] : dD(G.xg[i])) + H;
  if (isI && tpI > 0 && Ng >= 1) {
    IPAN({
      xg: G.xg,
      geo: G.xg.map((_: unknown, i: number) => geoI(i)),
      tp: tpI,
      zgt,
      zsb,
      xL: -Wb / 2,
      xR: Wb / 2,
      P: (x, z) => [X(x), Y(z)],
      poly: (p, f) => d.poly(p, f),
      fp: '#c9d6e3',
      fd: `url(#hD${id})`,
    });
  }
  const ys = [-Wb / 2, ...(XF && XF.yc > -Wb / 2 && XF.yc < Wb / 2 ? [XF.yc] : []), Wb / 2];
  const prof = (y1: number, y2: number, za: number, zb2: number) => {
    const p = ys.filter((y) => y >= y1 - 1e-9 && y <= y2 + 1e-9);
    if (p[0] > y1) p.unshift(y1);
    if (p[p.length - 1] < y2) p.push(y2);
    const up = p.map((y) => [X(y), Y(za - dD(y))]);
    const dn = p
      .slice()
      .reverse()
      .map((y) => [X(y), Y(zb2 - dD(y))]);
    return [...up, ...dn];
  };
  if (G.HK && G.HK.dGc != null) {
    const zg = zb + HT - G.HK.dGc;
    const p = ys.slice();
    d.poly(
      [...p.map((y) => [X(y), Y(zb + HT + hs - dD(y))]), [X(Wb / 2), Y(zg)], [X(-Wb / 2), Y(zg)]],
      `url(#hD${id})`,
    );
  } else {
    d.poly(prof(-Wb / 2, Wb / 2, zb + HT + hs, zb + HT), `url(#hD${id})`);
  }
  if (Hsu > 0) {
    d.poly(
      prof(-Wb / 2 + Wpa + WPL, Wb / 2 - Wpa - WPL, zb + HT + hs + Hsu, zb + HT + hs),
      '#bbb',
      't',
    );
  }
  const yb = zb + HT + hs;
  const top = yb + Hpa + Hra;
  [-1, 1].forEach((sg) => {
    const xo = (sg * Wb) / 2;
    const xi = sg * (Wb / 2 - Wpa);
    const wt = Math.min(Wpa, 0.2);
    const m = -sg;
    const dz = dD(xo);
    d.poly(
      [
        [xo, yb],
        [xo, yb + Hpa],
        [xo + m * wt, yb + Hpa],
        [xo + m * (wt + 0.06), yb + Hpa * 0.55],
        [xi, yb + Hpa * 0.12],
        [xi, yb],
      ].map(([x, y]) => [X(x), Y(y - dz)]),
      `url(#hD${id})`,
    );
    if (Hra > 0) {
      const xp = X(xo + m * wt * 0.5);
      d.s += `<rect class="l" x="${(xp - 3).toFixed(1)}" y="${Y(yb + Hpa + Hra - dz).toFixed(1)}" width="6" height="${(Hra * k).toFixed(1)}" style="fill:#fff"/>`;
    }
  });
  if (XF && (XF.iL || XF.iR)) {
    [-1, 1].forEach((sg) => {
      const y = (XF.yc + (sg * Wb) / 2) / 2;
      const z = yb + Hsu - dD(y) + 0.15;
      const ii = sg < 0 ? XF.iL : XF.iR;
      d.T(X(y), Y(z), fx(ii, 1) + '%', 'middle', 'class="s"');
    });
  }
  return top;
}

export function trCapPoly(R: { G: TrGeomResult; I: { he: number; lt: number } }): Array<[number, number]> {
  const G = R.G;
  const I = R.I;
  const dm = G.XF ? G.XF.dM : () => 0;
  const yc = G.XF ? G.XF.yc : 0;
  const P: Array<[number, number]> = [
    [G.xL, G.ELt - dm(G.xL)],
    ...(yc > G.xL && yc < G.xR ? [[yc, G.ELt] as [number, number]] : []),
    [G.xR, G.ELt - dm(G.xR)],
    [G.xR, G.ELt - I.he],
  ];
  if (I.lt > 0) P.push([G.xR - I.lt, G.ELcb]);
  P.push([G.xL + (I.lt > 0 ? I.lt : 0), G.ELcb]);
  P.push([G.xL, G.ELt - I.he]);
  return P;
}

export function trFigEl(R: TrCalcResult): void {
  const svEl = $('dgTdEl');
  if (!svEl) return;
  const I = R.I;
  const G = R.G;
  const id = 'TdEl';
  const d = dgKit(id);
  const W = 760;
  const top = G.zRoad + I.Hra + I.Hrl + 0.4;
  const bot = G.ELs - 0.8;
  const span = Math.max(I.Wd, I.Lc) + 2.2;
  const k = Math.min((W - 200) / span, 470 / (top - bot));
  const cx = W / 2 - 50;
  const X = (y: number) => cx + y * k;
  const Y = (z: number) => 40 + (top - z) * k;
  const ytop = trDrawSuper(d, X, Y, k, R, id);
  {
    const cp = trCapPoly(R);
    d.poly(
      cp.map(([y, z]) => [X(y), Y(z)]),
      '#e8edf2',
    );
    if (I.vtai > 0 && I.ktai > 0) {
      const zt = (y0: number) =>
        Math.max(...cp.filter((p) => Math.abs(p[0] - y0) < 1e-6).map((p) => p[1]), G.ELt - 1);
      [
        [G.xL, G.xL + I.vtai, G.xL],
        [G.xR - I.vtai, G.xR, G.xR],
      ].forEach(([a, b, e]) => {
        const z0 = zt(e);
        d.poly(
          [
            [X(a), Y(z0)],
            [X(b), Y(z0)],
            [X(b), Y(z0 + I.ktai)],
            [X(a), Y(z0 + I.ktai)],
          ],
          '#d5dde5',
        );
        if (e === G.xL) {
          const xm = X((a + b) / 2);
          const ym = Y(z0 + I.ktai * 0.6);
          d.L(xm, ym, X(a) - 24, ym - 14);
          d.T(X(a) - 26, ym - 18, 'Tường tai', 'end', 'class="s"');
          d.T(X(a) - 26, ym - 4, 'v = ' + fx(I.vtai * 1000, 0), 'end', 'class="s"');
        }
      });
      const z1 = zt(G.xR);
      d.dimV(X(G.xR) + 14, Y(z1 + I.ktai), Y(z1), fx(I.ktai * 1000, 0), 1);
    }
  }
  G.xs.forEach((x) => {
    d.poly(
      [
        [X(x - I.D / 2), Y(G.ELcb)],
        [X(x + I.D / 2), Y(G.ELcb)],
        [X(x + I.D / 2), Y(bot)],
        [X(x - I.D / 2), Y(bot)],
      ],
      '#f4f4f4',
    );
    d.L(X(x), Y(G.ELt + 0.1), X(x), Y(bot) + 6, 'c');
  });
  if (G.brace) {
    for (let c = 0; c + 1 < G.n; c++) {
      d.poly(
        [
          [X(G.xs[c] + I.D / 2), Y(G.ELbt)],
          [X(G.xs[c + 1] - I.D / 2), Y(G.ELbt)],
          [X(G.xs[c + 1] - I.D / 2), Y(G.ELbb)],
          [X(G.xs[c] + I.D / 2), Y(G.ELbb)],
        ],
        '#e8edf2',
      );
    }
  }
  const xa = X(-span / 2);
  const xb = X(span / 2);
  d.L(xa, Y(I.ELg), xb, Y(I.ELg), 't');
  d.L(xa, Y(G.ELs), xb, Y(G.ELs), 'd');
  [
    [I.MNCN, '#2a6db0'],
    [I.MNTN, '#2a6db0'],
  ].forEach(([z, c]) => {
    if ((z as number) > bot && (z as number) < G.ELt) {
      d.s += `<line x1="${xa}" y1="${Y(z as number).toFixed(1)}" x2="${xb}" y2="${Y(z as number).toFixed(1)}" stroke="${c}" stroke-width="1" stroke-dasharray="8,3"/>`;
    }
  });
  const labs: Array<[number, string, string]> = [
    [G.zRoad, 'Mặt đường', '#000'],
    [G.ELt, 'Đỉnh xà mũ', '#000'],
    [G.ELcb, 'Đáy xà mũ', '#000'],
  ];
  if (G.brace) labs.push([G.ELbt, 'Đỉnh giằng', '#000']);
  if (I.MNCN > bot) labs.push([I.MNCN, 'MNCN', '#2a6db0']);
  if (I.MNTN > bot) labs.push([I.MNTN, 'MNTN', '#2a6db0']);
  labs.push([I.ELg, 'MĐTN', '#000'], [G.ELs, 'MĐ sau xói', '#000']);
  labs.sort((a, b) => b[0] - a[0]);
  let ly = -1e9;
  const xx = xb + 6;
  labs.forEach(([z, t2, c]) => {
    const yy = Math.max(Y(z), ly + 15);
    ly = yy;
    d.L(xx - 6, Y(z), xx + 4, Y(z));
    d.L(xx + 4, Y(z), xx + 10, yy);
    d.T(xx + 12, yy + 4, t2 + ' ' + fx(z, 3), 'start', `style="fill:${c}"`);
  });
  d.dimH(X(G.xL), X(G.xR), Y(G.ELcb) + 30, fx(I.Lc * 1000, 0));
  const xsA = [G.xL, ...G.xs, G.xR];
  for (let i = 0; i + 1 < xsA.length; i++) {
    d.dimH(X(xsA[i]), X(xsA[i + 1]), Y(bot) + 16, fx((xsA[i + 1] - xsA[i]) * 1000, 0), Y(bot));
  }
  d.dimV(X(G.xL) - 20, Y(G.ELt), Y(G.ELcb), fx(I.h * 1000, 0), -1);
  d.dimH(X(-I.Wd / 2), X(I.Wd / 2), Y(ytop) - 12, 'B = ' + fx(I.Wd * 1000, 0));
  d.T(
    W / 2 - 40,
    Y(bot) + 40,
    `Mặt chính trụ ${I.name || ''}: ${G.n} cọc khoan nhồi D = ${fx(I.D * 1000, 0)} mm${G.brace ? ', có giằng ngang' : ', không giằng'} ; ${G.nb} dầm khoảng cách ${fx(I.sg * 1000, 0)} mm (hình dạng dầm theo sheet kiểm toán dầm)`,
    'middle',
    'class="s"',
  );
  dgPut(svEl as unknown as SVGElement, W, Y(bot) + 52, d.s, id);
}

export function trFigIL(R: { I: { e: number; a0?: number }; LO?: TrLongResult }): void {
  const svEl = $('dgTdIL');
  const LO = R.LO;
  if (!svEl || !LO) return;
  const I = R.I;
  const id = 'TdIL';
  const d = dgKit(id);
  const W = 760;
  const e = I.e;
  const L1 = LO.Ls1;
  const L2 = LO.Ls2;
  const Lt = L1 + L2 + 2 * e;
  const k = (W - 80) / Lt;
  const X = (s: number) => 40 + (s + e + L1) * k;
  const y0 = 150;
  const hy = 90;
  d.L(X(-e - L1), y0, X(e + L2), y0, 'l');
  d.poly(
    [
      [X(-e - L1), y0],
      [X(-e), y0 - hy],
      [X(-e), y0],
    ],
    'rgba(31,78,121,.08)',
  );
  d.poly(
    [
      [X(e), y0],
      [X(e), y0 - hy],
      [X(e + L2), y0],
    ],
    'rgba(31,78,121,.08)',
  );
  d.L(X(-e - L1), y0, X(-e), y0 - hy);
  d.L(X(e), y0 - hy, X(e + L2), y0);
  d.L(X(-e), y0 - hy, X(-e), y0);
  d.L(X(e), y0 - hy, X(e), y0);
  [-e - L1, -e, e, e + L2].forEach(
    (s) =>
      (d.s += `<polygon points="${X(s)},${y0} ${X(s) - 6},${y0 + 10} ${X(s) + 6},${y0 + 10}" fill="#fff" stroke="#000"/>`),
  );
  {
    const a0 = I.a0 || 0;
    const h1 = hy * (1 + a0 / L1);
    const h2 = hy * (1 + a0 / L2);
    if (a0 > 0) {
      d.poly(
        [
          [X(-e), y0],
          [X(-e), y0 - hy],
          [X(-e + a0), y0 - h1],
          [X(-e + a0), y0],
        ],
        'rgba(31,78,121,.08)',
      );
      d.L(X(-e), y0 - hy, X(-e + a0), y0 - h1);
      d.L(X(-e + a0), y0 - h1, X(-e + a0), y0);
      d.poly(
        [
          [X(e - a0), y0],
          [X(e - a0), y0 - h2],
          [X(e), y0 - hy],
          [X(e), y0],
        ],
        'rgba(31,78,121,.08)',
      );
      d.L(X(e - a0), y0 - h2, X(e), y0 - hy);
      d.L(X(e - a0), y0 - h2, X(e - a0), y0);
    }
  }
  d.T(X(-e), y0 - hy - 6, '1,0', 'end');
  d.T(X(e), y0 - hy - 6, '1,0', 'start');
  d.L(X(0), y0 + 20, X(0), y0 - hy - 20, 'c');
  d.T(X(0), y0 + 34, 'Tim trụ', 'middle');
  d.dimH(X(-e - L1), X(-e), y0 + 48, 'Ls1 = ' + fx(L1, 2) + ' m');
  d.dimH(X(e), X(e + L2), y0 + 48, 'Ls2 = ' + fx(L2, 2) + ' m');
  d.T(
    W / 2,
    20,
    'Đường ảnh hưởng phản lực trụ (tổng hai gối) - xếp xe bằng cách dịch chuyển trục xe với bước 0,05 m',
    'middle',
    'class="s"',
  );
  dgPut(svEl as unknown as SVGElement, W, 230, d.s, id);
}

export function trFigLane(R: TrCalcResult): void {
  const svEl = $('dgTdLane');
  if (!svEl) return;
  const I = R.I;
  const G = R.G;
  const PL = R.PL!;
  const id = 'TdLn';
  const d = dgKit(id);
  const W = 760;
  const k = (W - 120) / I.Wd;
  const X = (y: number) => W / 2 + y * k;
  const z0 = G.zBr;
  const Y = (z: number) => 210 - (z - z0) * k;
  trDrawSuper(d, X, Y, k, R, id);
  const yr = G.zRoad;
  for (let i = 0; i <= PL.nL; i++) {
    const x = PL.xr0 + i * PL.wl;
    d.L(X(x), Y(yr) - 70, X(x), Y(yr), 'g');
  }
  for (let i = 0; i < PL.nL; i++) {
    const x0 = PL.xr0 + i * PL.wl;
    d.T(X(x0 + PL.wl / 2), Y(yr) - 76, 'Làn ' + (i + 1), 'middle');
    [0.6, 2.4].forEach((a) => d.A(X(x0 + a), Y(yr) - 50, X(x0 + a), Y(yr) - 2));
    d.s += `<rect x="${X(x0)}" y="${Y(yr) - 14}" width="${3 * k}" height="10" fill="rgba(192,0,0,.12)" stroke="#c00000" stroke-width=".6"/>`;
  }
  d.dimH(
    X(PL.xr0),
    X(PL.xr0 + PL.w),
    Y(yr) - 96,
    'w = ' + fx(PL.w * 1000, 0) + ' mm (' + PL.nL + ' làn thiết kế)',
    Y(yr) - 70,
  );
  d.T(
    W / 2,
    256,
    'Các làn sát lề trái (trường hợp đại diện); khi tính, các làn dịch chuyển trên toàn bộ phần xe chạy, bước 0,1 m.',
    'middle',
    'class="s"',
  );
  dgPut(svEl as unknown as SVGElement, W, 270, d.s, id);
}

// ---------------------------------------------------------------------------
// 10. Frame Map, Diagrams, Section Checks, Conclusion & Result Accessors
// ---------------------------------------------------------------------------

export function trMap(R: TrCalcResult, W: number, Hh: number, pad: number) {
  const MD = R.MD!;
  const ys = MD.nodes.map((n) => n.y);
  const xs = MD.nodes.map((n) => n.x);
  const top = Math.max(...ys);
  const bot = Math.min(...ys);
  const L = Math.max(...xs) - Math.min(...xs);
  const k = Math.min((W - 2 * pad - 170) / L, (Hh - 2 * pad) / (top - bot));
  const cx = (W - 170) / 2;
  const X = (x: number) => cx + x * k;
  const Y = (y: number) => pad + (top - y) * k;
  return { X, Y, k, top, bot, Hd: (top - bot) * k + 2 * pad };
}

export function trFigMod(R: TrCalcResult): void {
  const svEl = $('dgTdMod');
  if (!svEl) return;
  const MD = R.MD!;
  const G = R.G;
  const d = dgKit('TdMod');
  const W = 760;
  const H = G.pile ? 900 : 600;
  const M = trMap(R, W, H - 60, 70);
  const X = M.X;
  const Y = M.Y;
  MD.els.forEach((e) => {
    const a = MD.nodes[e.i];
    const b = MD.nodes[e.j];
    d.s += `<line x1="${X(a.x).toFixed(1)}" y1="${Y(a.y).toFixed(1)}" x2="${X(b.x).toFixed(1)}" y2="${Y(b.y).toFixed(1)}" stroke="${e.kind === 'rig' ? '#c00000' : '#1f4e79'}" stroke-width="${e.kind === 'rig' ? 3 : 1.6}"/>`;
  });
  MD.nodes.forEach(
    (n) =>
      (d.s += `<circle cx="${X(n.x).toFixed(1)}" cy="${Y(n.y).toFixed(1)}" r="1.6" fill="#1f4e79"/>`),
  );
  // số hiệu phần tử : mỗi phần tử không cứng, ghi thưa
  R.EL!.forEach((k, q) => {
    const e = MD.els[k];
    const a = MD.nodes[e.i];
    const b = MD.nodes[e.j];
    const hz = Math.abs(a.y - b.y) < 1e-6;
    if (q % 2 && hz) return;
    if (!hz && q % 2) return;
    const xm = (X(a.x) + X(b.x)) / 2;
    const ym = (Y(a.y) + Y(b.y)) / 2;
    d.T(
      xm + (hz ? 0 : -4),
      ym + (hz ? -5 : 3),
      String(q + 1),
      hz ? 'middle' : 'end',
      'style="font-size:8px;fill:#7a3db8"',
    );
  });
  if (G.pile) {
    MD.springs.forEach((sp) => {
      if (sp.dof !== 0) return;
      const n = MD.nodes[sp.n];
      const x = X(n.x);
      const y = Y(n.y);
      d.s += `<path d="M${x} ${y} l3 -2 l3 4 l3 -4 l3 4 l3 -2 l6 0" fill="none" stroke="#2e7d32" stroke-width=".8"/>`;
    });
    MD.cols.forEach((o) => {
      const n = MD.nodes[o.nd[o.nd.length - 1]];
      const x = X(n.x);
      const y = Y(n.y);
      d.s += `<path d="M${x} ${y} l0 4 l-3 2 l6 3 l-6 3 l6 3 l-3 2 l0 4" fill="none" stroke="#2e7d32" stroke-width="1"/><line x1="${x - 8}" y1="${y + 22}" x2="${x + 8}" y2="${y + 22}" stroke="#000"/>`;
    });
    const ng = MD.nodes[MD.cols[0].base];
    d.s += `<line x1="${X(G.xL) - 30}" y1="${Y(ng.y)}" x2="${X(G.xR) + 10}" y2="${Y(ng.y)}" stroke="#8a6d3b" stroke-dasharray="6 3"/>`;
  } else {
    MD.cols.forEach((o) => {
      const n = MD.nodes[o.base];
      const x = X(n.x);
      const y = Y(n.y);
      d.s += `<rect x="${x - 9}" y="${y}" width="18" height="5" fill="url(#hDTdMod)" stroke="#000" stroke-width=".8"/>`;
    });
  }
  G.xb.forEach((x) => d.A(X(x), Y(G.yc) - 30, X(x), Y(G.yc) - 3));
  d.T(X(0), Y(G.yc) - 36, 'Vị trí gối (tải trọng kết cấu nhịp, hoạt tải)', 'middle', 'class="s"');
  const xr = X(G.xR) + 20;
  (
    [
      [G.yc, 'Trục xà mũ'],
      [G.ELcb, 'Đáy xà mũ'],
      [G.ELs, G.pile ? 'MĐ sau xói' : 'Ngàm - MĐ sau xói'],
    ] as Array<[number, string]>
  )
    .concat(G.pile ? [[G.ELtip, 'Mũi cọc']] : [])
    .concat(G.brace ? [[G.yb, 'Trục giằng']] : [])
    .forEach(([z, t]) => {
      d.L(xr - 8, Y(z), xr, Y(z));
      d.T(xr + 4, Y(z) + 4, t + ' ' + fx(z, 3), 'start', 'class="s"');
    });
  const Hf = M.Hd + 20;
  d.T(
    W / 2 - 60,
    Hf - 6,
    `Đỏ: phần tử cứng ; số tím: số hiệu phần tử ; ${G.pile ? 'xanh lá: lò xo đất ; ' : ''}${MD.nodes.length} nút, ${R.EL!.length} phần tử`,
    'middle',
    'class="s"',
  );
  dgPut(svEl as unknown as SVGElement, W, Hf, d.s, 'TdMod');
}

export function trFigLoad(R: TrCalcResult, key: string): void {
  const svEl = $('dgTdLoad');
  if (!svEl) return;
  const G = R.G;
  const I = R.I;
  const d = dgKit('TdLd');
  const W = 760;
  // hình chiếu trục đo xiên: y ngang cầu sang phải, x dọc cầu lùi ra sau - lên trên (góc 35°, hệ số 0,7), z thẳng đứng
  const ca = Math.cos((35 * Math.PI) / 180) * 0.7;
  const sa = Math.sin((35 * Math.PI) / 180) * 0.7;
  const zTop = G.zBr + 0.2;
  const zBot = G.ELs - 1.2;
  const bx = I.b / 2 + 0.4;
  const span = G.xR - G.xL + 2 * bx * ca;
  const k = Math.min((W - 140) / span, 430 / (zTop - zBot + 2 * bx * sa));
  const ox = 70 + (-G.xL + bx * ca) * k;
  const oy = 95 + bx * sa * k;
  const P = (y: number, x: number, z: number): [number, number] => [
    ox + (y + x * ca) * k,
    oy + (zTop - z - x * sa) * k,
  ];
  const pt = (a: [number, number]) => a.map((val) => val.toFixed(1)).join(',');
  const face = (pts: [number, number][], fill: string, op = 1, stroke = '#2a4b8d') =>
    (d.s += `<polygon points="${pts.map(pt).join(' ')}" fill="${fill}" fill-opacity="${op}" stroke="${stroke}" stroke-width=".8"/>`);
  const box = (
    y1: number,
    y2: number,
    z1: number,
    z2: number,
    x1: number,
    x2: number,
    fill: string,
  ) => {
    face([P(y1, x2, z2), P(y2, x2, z2), P(y2, x1, z2), P(y1, x1, z2)], '#dfe8f1');
    face([P(y2, x1, z1), P(y2, x2, z1), P(y2, x2, z2), P(y2, x1, z2)], '#b9cbe0');
    face([P(y1, x1, z1), P(y2, x1, z1), P(y2, x1, z2), P(y1, x1, z2)], fill);
  };
  const cyl = (y: number, z1: number, z2: number) => {
    const r = I.D / 2;
    const el = (z: number) => {
      const a: [number, number][] = [];
      for (let i = 0; i <= 24; i++) {
        const t = (2 * Math.PI * i) / 24;
        a.push(P(y + r * Math.cos(t), r * Math.sin(t), z));
      }
      return a;
    };
    const L = P(y - r, 0, z2);
    const Rr = P(y + r, 0, z2);
    const L2 = P(y - r, 0, z1);
    const R2 = P(y + r, 0, z1);
    face([L, Rr, R2, L2], '#c9d9ea', 1, 'none');
    d.s += `<polyline points="${el(z1)
      .filter((_, i) => i >= 12)
      .map(pt)
      .join(' ')}" fill="none" stroke="#2a4b8d" stroke-width=".8"/>`;
    d.s += `<line x1="${L[0]}" y1="${L[1]}" x2="${L2[0]}" y2="${L2[1]}" stroke="#2a4b8d" stroke-width=".8"/><line x1="${Rr[0]}" y1="${Rr[1]}" x2="${R2[0]}" y2="${R2[1]}" stroke="#2a4b8d" stroke-width=".8"/>`;
    for (let z = z1 + 1; z < z2; z += 1) {
      const e = el(z).filter((_, i) => i >= 12);
      d.s += `<polyline points="${e.map(pt).join(' ')}" fill="none" stroke="#7d97b8" stroke-width=".5"/>`;
    }
  };
  // mặt đất
  const zg = G.ELs;
  const gx = G.xL - 0.8;
  const gy = G.xR + 0.8;
  d.s += `<polygon points="${[P(gx, -bx - 0.6, zg), P(gy, -bx - 0.6, zg), P(gy, bx + 0.6, zg), P(gx, bx + 0.6, zg)].map(pt).join(' ')}" fill="#efe6d6" fill-opacity=".5" stroke="#8a6d3b" stroke-dasharray="5 3" stroke-width=".8"/>`;
  G.xs.forEach((y) => cyl(y, zBot, G.ELcb));
  if (G.brace) {
    for (let c = 0; c + 1 < G.n; c++) {
      box(
        G.xs[c] + I.D / 2,
        G.xs[c + 1] - I.D / 2,
        G.ELbb,
        G.ELbt,
        -I.bbb / 2,
        I.bbb / 2,
        '#d7e3f0',
      );
    }
  }
  // xà mũ: mặt sau, mặt trên, mặt đầu phải, mặt trước
  const cp = trCapPoly(R);
  const xb = I.b / 2;
  const xf = -I.b / 2;
  face(
    cp.map(([y, z]) => P(y, xb, z)),
    '#cfdcea',
    1,
  );
  face(
    [P(G.xL, xf, G.ELt), P(G.xR, xf, G.ELt), P(G.xR, xb, G.ELt), P(G.xL, xb, G.ELt)],
    '#e6eef6',
  );
  face(
    [P(G.xR, xf, G.ELt), P(G.xR, xb, G.ELt), P(G.xR, xb, G.ELt - I.he), P(G.xR, xf, G.ELt - I.he)],
    '#b9cbe0',
  );
  if (I.lt > 0) {
    face(
      [
        P(G.xR, xf, G.ELt - I.he),
        P(G.xR, xb, G.ELt - I.he),
        P(G.xR - I.lt, xb, G.ELcb),
        P(G.xR - I.lt, xf, G.ELcb),
      ],
      '#a9bdd6',
    );
  }
  face(
    cp.map(([y, z]) => P(y, xf, z)),
    '#d9e4ef',
    1,
  );
  // gối
  [-I.e, I.e].forEach((x) =>
    G.xb.forEach((y) => {
      const a = P(y - 0.08, x, G.ELt);
      const b = P(y + 0.08, x, G.ELt + Math.max(I.hb, 0.04));
      d.s += `<rect x="${Math.min(a[0], b[0]).toFixed(1)}" y="${Math.min(a[1], b[1]).toFixed(1)}" width="${Math.abs(b[0] - a[0]).toFixed(1)}" height="${Math.max(2, Math.abs(b[1] - a[1])).toFixed(1)}" fill="#555"/>`;
    }),
  );
  // tải trọng
  interface AggLoad {
    kind: string;
    y: number;
    x: number;
    z: number;
    FX: number;
    FY: number;
    FZ: number;
  }
  const C3: Record<string, TrLoadPoint[]> = { ...(R.C3 || {}), ...trLLrep(R) };
  const raw = C3[key] || [];
  const agg = new Map<string, AggLoad>();
  const txt: string[] = [];
  const pos = (p: TrLoadPoint) => {
    if (p.kind === 'g') {
      return G.gOff.map((o) => ({ y: p.y + o, x: p.x || 0, z: G.zBr, f: 1 / G.ngb }));
    }
    if (p.kind === 's') return [{ y: 0, x: p.x || 0, z: p.z, f: 1 }];
    return [{ y: p.y, x: p.x || 0, z: p.z, f: 1 }];
  };
  raw.forEach((p) =>
    pos(p).forEach((q) => {
      const kk = [
        p.kind,
        Math.round(q.y * 1000),
        Math.round(q.x * 1000),
        Math.round(q.z * 1000),
      ].join('|');
      const o = agg.get(kk) || { kind: p.kind, y: q.y, x: q.x, z: q.z, FX: 0, FY: 0, FZ: 0 };
      o.FX += (p.FX || 0) * q.f;
      o.FY += (p.FY || 0) * q.f;
      o.FZ += (p.FZ || 0) * q.f;
      agg.set(kk, o);
    }),
  );
  const arr = [...agg.values()];
  if (key === 'DCp') {
    txt.push(
      'Tải trọng bản thân xà mũ, giằng, thân trụ (γc = ' +
        fx(I.gc, 2) +
        ' kN/m³), quy về lực tập trung tại nút',
    );
  }
  const S =
    55 / Math.max(1e-9, ...arr.map((p) => Math.max(Math.abs(p.FZ), Math.abs(p.FY), Math.abs(p.FX))));
  const lab = (x: number, y: number, val: number, rot: boolean) =>
    d.T(
      x,
      y,
      fx(val, 1),
      rot ? 'start' : 'middle',
      `style="font-size:8px;fill:#8b0000"${rot ? ` transform="rotate(-90 ${x.toFixed(1)} ${y.toFixed(1)})"` : ''}`,
    );
  const arrow = (a: [number, number], b: [number, number], col: string) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const L = Math.hypot(dx, dy) || 1;
    const ux = dx / L;
    const uy = dy / L;
    const h = 5;
    d.s += `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="${col}" stroke-width=".9"/><path d="M${b[0].toFixed(1)} ${b[1].toFixed(1)} L${(b[0] - h * ux - h * 0.45 * uy).toFixed(1)} ${(b[1] - h * uy + h * 0.45 * ux).toFixed(1)} L${(b[0] - h * ux + h * 0.45 * uy).toFixed(1)} ${(b[1] - h * uy - h * 0.45 * ux).toFixed(1)}Z" fill="${col}"/>`;
  };
  const zOf = (p: AggLoad) => (p.kind === 'n' ? p.z : p.z);
  const dup = (p: AggLoad) =>
    p.x > 1e-9 &&
    arr.some(
      (q) =>
        q !== p &&
        q.x < -1e-9 &&
        Math.abs(q.y - p.y) < 1e-6 &&
        Math.abs(q.z - p.z) < 1e-6 &&
        Math.abs(q.FZ - p.FZ) < 0.05 &&
        Math.abs(q.FY - p.FY) < 0.05 &&
        Math.abs(q.FX - p.FX) < 0.05,
    );
  arr.forEach((p) => {
    const b = P(p.y, p.x, zOf(p));
    const sh = !dup(p);
    if (Math.abs(p.FZ) > 1e-9) {
      const l = Math.max(12, Math.abs(p.FZ) * S);
      const up = p.FZ < 0;
      const a: [number, number] = up ? [b[0], b[1]] : [b[0], b[1] - l];
      const e: [number, number] = up ? [b[0], b[1] - l] : [b[0], b[1] - 1];
      arrow(a, e, '#0f6e6e');
      if (sh) lab(b[0] + 2, b[1] - l - 3, -p.FZ, true);
    }
    if (Math.abs(p.FY) > 1e-9) {
      const l = Math.max(14, Math.abs(p.FY) * S);
      const s = Math.sign(p.FY);
      arrow([b[0] - s * l, b[1]], [b[0], b[1]], '#0f6e6e');
      if (sh) lab(b[0] - s * l, b[1] - 4, p.FY, false);
    }
    if (Math.abs(p.FX) > 1e-9) {
      const l = Math.max(14, Math.abs(p.FX) * S) / k;
      const s = Math.sign(p.FX);
      const a = P(p.y, p.x - s * l, zOf(p));
      arrow(a, b, '#0f6e6e');
      if (sh) lab(a[0], a[1] - 4, p.FX, false);
    }
  });
  // trục toạ độ
  const o0: [number, number] = [30, oy + (zTop - zBot) * k + 10];
  arrow(o0, [o0[0] + 35, o0[1]], '#000');
  d.T(o0[0] + 40, o0[1] + 4, 'Y', 'start', 'class="s"');
  arrow(o0, [o0[0] + (25 * ca) / 0.7, o0[1] - (25 * sa) / 0.7], '#000');
  d.T(o0[0] + (28 * ca) / 0.7, o0[1] - (28 * sa) / 0.7, 'X', 'start', 'class="s"');
  arrow(o0, [o0[0], o0[1] - 35], '#000');
  d.T(o0[0], o0[1] - 40, 'Z', 'middle', 'class="s"');
  const res = TR.resAt(raw, G.ELs);
  txt.push(
    `Tổng tại mặt đất sau xói: Hx = ${fx(res.Hx, 1)} ; Hy = ${fx(res.Hy, 1)} ; Hz = ${fx(res.Hz, 1)} kN ; Mx = ${fx(res.Mx, 1)} ; My = ${fx(res.My, 1)} kN.m`,
  );
  txt.push(
    'Đơn vị: kN. Hai hàng gối cùng giá trị chỉ ghi số ở hàng trước; lực ngang lên kết cấu nhịp vẽ tại tim trụ.',
  );
  const H = oy + (zTop - zBot) * k + 30 + txt.length * 13;
  txt.forEach((t, i) => d.T(W / 2, H - 8 - (txt.length - 1 - i) * 13, t, 'middle', 'class="s"'));
  dgPut(svEl as unknown as SVGElement, W, H, d.s, 'TdLd');
  // biểu đồ mômen của trường hợp tải đang xem
  const sm = $('dgTdLdM');
  const sl = $('dgTdLdML');
  if (sm || sl) {
    let T = R.TT![key];
    let L = R.LL![key];
    if (!T && raw.length) T = R.runT!(raw);
    if (!L && raw.length) L = R.runL!(raw);
    if (sm) trBeam(sm, R, 'M', [T || new Float64Array(R.NO!)], key, 'kN*m');
    const hasL = !!(L && Array.from(L).some((val) => Math.abs(val) > 1e-6));
    if (sl) {
      if (sl.style) sl.style.display = hasL ? '' : 'none';
      if (hasL && L) trBeam(sl, R, 'ML', [L], key, 'kN*m');
    }
  }
}

export const TR_PAL = [
  '#0000ff',
  '#0055ff',
  '#00aaff',
  '#00e5ff',
  '#00ffaa',
  '#00ff00',
  '#aaff00',
  '#ffff00',
  '#ffcc00',
  '#ff8800',
  '#ff4400',
  '#ff0000',
] as const;

export function trBeam(
  svEl: any,
  R: TrCalcResult,
  kind: string,
  data: ArrayLike<number>[],
  cbName: string,
  unit: string,
): void {
  if (!svEl) return;
  const MD = R.MD!;
  const G = R.G;
  const id = (svEl as { id?: string }).id || 'TdBm';
  const d = dgKit(id);
  const W = 760;
  const M = trMap(R, W, G.pile ? 860 : 600, 70);
  const H = Math.max(M.Hd + 30, 470);
  const X = M.X;
  const Y = M.Y;
  const long = kind === 'ML' || kind === 'VL';
  MD.els.forEach((e) => {
    const a = MD.nodes[e.i];
    const b = MD.nodes[e.j];
    if (long && MD.els.indexOf(e) < 0) return;
    d.s += `<line x1="${X(a.x).toFixed(1)}" y1="${Y(a.y).toFixed(1)}" x2="${X(b.x).toFixed(1)}" y2="${Y(b.y).toFixed(1)}" stroke="#2a4b8d" stroke-width="1"/>`;
  });
  interface BeamSeg {
    a: { x: number; y: number };
    b: { x: number; y: number };
    vi: number;
    vj: number;
    el: number;
    hz: boolean;
    pi?: [number, number];
    pj?: [number, number];
  }
  const segs: BeamSeg[] = [];
  const off = kind === 'M' ? 2 : kind === 'V' ? 1 : 0;
  if (!long) {
    R.EL!.forEach((k, q) => {
      const e = MD.els[k];
      const a = MD.nodes[e.i];
      const b = MD.nodes[e.j];
      for (const arr of data) {
        const vi = arr[6 * q + off];
        const vj = arr[6 * q + 3 + off];
        if (!isFinite(vi) || !isFinite(vj)) continue;
        segs.push({
          a,
          b,
          vi: off === 0 ? -vi : vi,
          vj: off === 0 ? -vj : vj,
          el: q + 1,
          hz: Math.abs(a.y - b.y) < 1e-6,
        });
      }
    });
  } else {
    const o = kind === 'ML' ? 1 : 0;
    MD.cols.forEach((col, c) => {
      R.LS!.forEach((s, q) => {
        if (s.end !== 'i') return;
        const e = R.ML!.els[s.k];
        const ya = R.ML!.nodes[e.i].y;
        const yb = R.ML!.nodes[e.j].y;
        for (const arr of data) {
          segs.push({
            a: { x: col.x, y: ya },
            b: { x: col.x, y: yb },
            vi: arr[c * (R.NL0 || 0) + 2 * q + o],
            vj: arr[c * (R.NL0 || 0) + 2 * q + 2 + o],
            el: q + 1,
            hz: false,
          });
        }
      });
    });
  }
  const vals = segs.flatMap((s) => [s.vi, s.vj]);
  if (!vals.length) {
    dgPut(svEl as unknown as SVGElement, W, H, d.s, id);
    return;
  }
  const vmax = Math.max(...vals);
  const vmin = Math.min(...vals);
  const am = Math.max(Math.abs(vmax), Math.abs(vmin), 1e-9);
  const sc = 55 / am;
  const col = (val: number) => {
    const t = (val - vmin) / (vmax - vmin || 1);
    return TR_PAL[Math.max(0, Math.min(11, Math.floor(t * 12 - 1e-9)))];
  };
  segs.forEach((s) => {
    const ax = X(s.a.x);
    const ay = Y(s.a.y);
    const bx = X(s.b.x);
    const by = Y(s.b.y);
    const dx = bx - ax;
    const dy = by - ay;
    let nx: number;
    let ny: number;
    if (s.hz) {
      nx = 0;
      ny = 1;
    } else {
      nx = -1;
      ny = 0;
    }
    if (kind !== 'M' && !s.hz) {
      nx = 1;
    }
    const pi: [number, number] = [ax + nx * s.vi * sc, ay + ny * s.vi * sc];
    const pj: [number, number] = [bx + nx * s.vj * sc, by + ny * s.vj * sc];
    for (let f = 0; f <= 1.0001; f += 0.5) {
      const val = s.vi + (s.vj - s.vi) * f;
      const px = ax + dx * f;
      const py = ay + dy * f;
      d.s += `<line x1="${px.toFixed(1)}" y1="${py.toFixed(1)}" x2="${(px + nx * val * sc).toFixed(1)}" y2="${(py + ny * val * sc).toFixed(1)}" stroke="${col(val)}" stroke-width="1"/>`;
    }
    d.s += `<line x1="${pi[0].toFixed(1)}" y1="${pi[1].toFixed(1)}" x2="${pj[0].toFixed(1)}" y2="${pj[1].toFixed(1)}" stroke="${col((s.vi + s.vj) / 2)}" stroke-width="1.4"/>`;
    s.pi = pi;
    s.pj = pj;
  });
  const mxS = segs.reduce((a, s) => (Math.max(s.vi, s.vj) > Math.max(a.vi, a.vj) ? s : a));
  const mnS = segs.reduce((a, s) => (Math.min(s.vi, s.vj) < Math.min(a.vi, a.vj) ? s : a));
  const mark = (s: BeamSeg, isMax: boolean) => {
    const p = ((isMax ? s.vi >= s.vj : s.vi <= s.vj) ? s.pi : s.pj)!;
    const val = isMax ? Math.max(s.vi, s.vj) : Math.min(s.vi, s.vj);
    d.s += `<path d="M${p[0] - 4} ${p[1] - 4} L${p[0] + 4} ${p[1] + 4} M${p[0] - 4} ${p[1] + 4} L${p[0] + 4} ${p[1] - 4}" stroke="#8b0000" stroke-width="1.6"/>`;
    d.T(
      p[0] + 6,
      p[1] + (isMax ? -6 : 14),
      (isMax ? 'Max: ' : 'Min: ') + fx(val, 1),
      'start',
      'style="font-size:11px;fill:#8b0000"',
    );
  };
  mark(mxS, true);
  mark(mnS, false);
  const lx = W - 165;
  const ly = 24;
  d.s += `<rect x="${lx - 6}" y="${ly - 18}" width="166" height="${70 + 12 * 22 + 20 + 70 + 18}" fill="#fff" stroke="#000" stroke-width=".8"/>`;
  const kindLabel =
    (
      {
        M: 'MOMENT (ngang cầu)',
        V: 'SHEAR (ngang cầu)',
        N: 'AXIAL',
        ML: 'MOMENT (dọc cầu)',
        VL: 'SHEAR (dọc cầu)',
      } as Record<string, string>
    )[kind] || '';
  (
    [
      ['CHƯƠNG TRÌNH TÍNH TRỤ', ly - 4],
      ['POST-PROCESSOR', ly + 10],
      ['BEAM DIAGRAM', ly + 30],
      [kindLabel, ly + 50],
    ] as Array<[string, number]>
  ).forEach(([t, y]) => d.T(lx + 77, y, t, 'middle', 'style="font-size:11px"'));
  d.L(lx - 6, ly + 16, lx + 160, ly + 16);
  d.L(lx - 6, ly + 36, lx + 160, ly + 36);
  d.L(lx - 6, ly + 56, lx + 160, ly + 56);
  for (let i = 0; i < 12; i++) {
    const val = vmax - ((vmax - vmin) * i) / 11;
    const y = ly + 70 + i * 22;
    d.s += `<rect x="${lx}" y="${y}" width="18" height="22" fill="${TR_PAL[11 - i]}" stroke="#555" stroke-width=".4"/>`;
    d.T(
      lx + 24,
      y + 15,
      val
        .toExponential(5)
        .replace(/e([+-])(\d)$/, 'e$10$2')
        .replace(/e([+-])(\d\d)$/, 'e$10$2'),
      'start',
      'style="font-size:10px"',
    );
  }
  const yb = ly + 70 + 12 * 22 + 20;
  d.L(lx - 6, yb, lx + 160, yb);
  d.T(lx, yb + 16, 'CB: ' + cbName, 'start', 'style="font-size:10px"');
  d.T(lx, yb + 32, 'MAX : ' + mxS.el, 'start', 'style="font-size:10px"');
  d.T(lx, yb + 46, 'MIN : ' + mnS.el, 'start', 'style="font-size:10px"');
  d.T(lx, yb + 62, 'UNIT: ' + unit, 'start', 'style="font-size:10px"');
  if (long) {
    d.T(
      W / 2 - 80,
      H - 12,
      'Phương dọc cầu: mỗi thân trụ một sơ đồ công xôn, đỉnh các thân trụ cùng chuyển vị và góc xoay (xà mũ cứng)',
      'middle',
      'class="s"',
    );
  }
  dgPut(svEl as unknown as SVGElement, W, H, d.s, id);
}

export function trDiagData(
  R: TrCalcResult,
  C: TrCheckResult,
  sel: string,
): { T: Float64Array[]; L: Float64Array[] } {
  const NO = R.NO!;
  const NL = R.NL!;
  const Cany = C as any;
  if (sel.startsWith('E:')) {
    const E = Cany.ENV[sel.slice(2)];
    return { T: [E.mx, E.mn], L: [E.lmx, E.lmn] };
  }
  if (sel.startsWith('L:')) {
    const k = sel.slice(2);
    const T = R.TT![k] || null;
    const L = R.LL![k] || null;
    return { T: [T || new Float64Array(NO)], L: [L || new Float64Array(NL)] };
  }
  return { T: [new Float64Array(NO)], L: [new Float64Array(NL)] };
}

export const TR_DSEL = [
  ['E:SD', 'Bao TTGH Sử dụng (SD-BAO)'],
  ['E:CD', 'Bao TTGH Cường độ (CD-BAO)'],
  ['E:DB', 'Bao TTGH Đặc biệt (DB-BAO)'],
] as const;

export function trRender21(R: TrCalcResult, C: TrCheckResult): void {
  const MD = R.MD!;
  const I = R.I;
  const G = R.G;
  const Cany = C as any;
  trFigMod(R);
  let t = `<tr><th>Thông số</th><th>Giá trị</th><th>Đơn vị</th></tr>`;
  const r1 = (a: string, val: string, u: string) =>
    `<tr><td class="l">${a}</td><td>${val}</td><td class="c">${u}</td></tr>`;
  t +=
    r1('Số nút / số phần tử (không kể phần tử cứng)', MD.nodes.length + ' / ' + R.EL!.length, '') +
    r1('Mô đun đàn hồi bê tông Ec', fx(R.M!.Ec, 1), 'MPa') +
    r1('Thân trụ: A / I', fx(MD.Ac, 4) + ' / ' + fx(MD.Icol, 5), 'm² ; m⁴') +
    r1('Xà mũ: b × h (đầu hẫng h = ' + fx(I.he, 2) + ' m)', fx(I.b, 2) + ' × ' + fx(I.h, 2), 'm') +
    (G.brace ? r1('Giằng: b × h', fx(I.bbb, 2) + ' × ' + fx(I.hbb, 2), 'm') : '') +
    (G.pile
      ? r1(
          'Cọc dưới mặt đất sau xói (cao độ ' + fx(G.ELs, 3) + ' m): dài h / mũi cọc',
          fx(I.pH, 2) + ' / ' + fx(G.ELtip, 3),
          'm',
        ) +
        r1('Mô đun đàn hồi bê tông cọc Ep (cùng bê tông thân trụ)', fx(I.pEp, 1), 'MPa') +
        r1(
          'Lò xo ngang tại nút cọc (bước nút 0,25 m): C = c(z)·bp·h·αi ; đất c(z) = K·z (TCVN 10304:2025, A.4, A.5) ; đá k theo Em (trang nội lực cọc trụ)',
          'bp = ' + fx(I.pBp, 2) + ' m',
          '',
        ) +
        r1(
          (I.pAl && I.pAl.kind === 'pm'
            ? 'Hệ số nhóm Pm (TCVN 11823-10, Bảng 21)'
            : 'Hệ số giảm do nhóm cọc αi (TCVN 10304, A.6)') + ': ngang cầu, từng cọc ; dọc cầu',
          (I.pAlT || []).map((val: number) => fx(val, 3)).join(' ; ') + ' ; ' + fx(I.pAlL, 3),
          '',
        ) +
        r1(
          'Gối mũi cọc (TCVN 10304:2025, Hình A.2b): lò xo thẳng đứng theo 7.4.3.1, từng cọc ; không có lò xo ngang, xoay',
          (I.pktC || [I.pkt]).map((val: number) => fx(val, 0)).join(' ; '),
          'kN/m',
        ) +
        (I.pInfo && I.pInfo.note ? `<tr><td class="l bad" colspan="3">${I.pInfo.note}</td></tr>` : '')
      : r1('Liên kết chân cột', 'Ngàm tại cao độ ' + fx(G.ELs, 3), 'm') +
        (I.noSoil
          ? `<tr><td class="l bad" colspan="3">Dọc chiều dài cọc không có lò xo đất (mặt đất sau xói nằm ngoài phạm vi số liệu địa chất hoặc K = 0): chưa mô hình được cọc, tạm ngàm chân cột tại mặt đất. Kiểm tra cao độ mặt đất và bảng địa chất.</td></tr>`
          : ''));
  set('tbTdMod', t);
  const lc = $('td_lcv') as HTMLSelectElement | null;
  const opts = [
    ['DC', 'DC - kết cấu nhịp'],
    ['DCp', 'DC - bản thân trụ'],
    ['DW', 'DW - lớp phủ'],
    ['LL1', 'LL - hoạt tải I (đại diện)'],
    ['LL2', 'LL - hoạt tải II (đại diện)'],
    ['BR', 'BR - lực hãm'],
    ['WA3', 'WA - dòng chảy'],
    ['WA2', 'WA - đẩy nổi'],
    ['WSn', 'WS - gió ngang'],
    ['WSd', 'WS - gió dọc'],
    ['WLn', 'WL - gió ngang lên xe'],
    ['WLd', 'WL - gió dọc lên xe'],
    ['WVp', 'WS - gió thẳng đứng'],
    ['EQn', 'EQ - động đất ngang cầu'],
    ['EQd', 'EQ - động đất dọc cầu'],
    ['TU', 'TU - nhiệt độ'],
    ['CS', 'CR, SH'],
  ];
  if (lc) {
    const cur = lc.value || 'DC';
    lc.innerHTML = opts.map(([a, b]) => `<option value="${a}">${b}</option>`).join('');
    lc.value = opts.some((o) => o[0] === cur) ? cur : 'DC';
  }
  trFigLoad(R, lc ? lc.value : 'DC');
  const dc = $('td_dc') as HTMLSelectElement | null;
  if (dc) {
    const cur = dc.value || 'E:CD';
    const o = [
      ...TR_DSEL,
      ...R.CB!.map((c) => ['E:' + c.id, 'Bao tổ hợp ' + c.id]),
      ['L:DC', 'Tải trọng DC kết cấu nhịp'],
      ['L:DCp', 'Tải trọng bản thân trụ'],
      ['L:DW', 'Tải trọng DW'],
      ['L:WSn', 'Gió ngang'],
      ['L:EQn', 'Động đất ngang cầu'],
      ['L:WSd', 'Gió dọc (phương dọc)'],
      ['L:EQd', 'Động đất dọc cầu (phương dọc)'],
    ];
    dc.innerHTML = o.map(([a, b]) => `<option value="${a}">${b}</option>`).join('');
    dc.value = o.some((x) => x[0] === cur) ? cur : 'E:CD';
  }
  trDiagView(R, C);
  const P: Array<[string, string, string, string, string]> = [];
  for (const [st, nm, lab] of [
    ['SD', 'SD-BAO', 'TTGH Sử dụng'],
    ['CD', 'CD-BAO', 'TTGH Cường độ'],
    ['DB', 'DB-BAO', 'TTGH Đặc biệt'],
  ] as const) {
    P.push(
      ['M', 'E:' + st, nm, 'kN*m', 'Mômen uốn ngang cầu (trong mặt phẳng khung) - bao ' + lab],
      ['ML', 'E:' + st, nm, 'kN*m', 'Mômen uốn dọc cầu (thân trụ, cọc) - bao ' + lab],
    );
    if (st !== 'SD') {
      P.push(
        ['V', 'E:' + st, nm, 'kN', 'Lực cắt ngang cầu - bao ' + lab],
        ['VL', 'E:' + st, nm, 'kN', 'Lực cắt dọc cầu - bao ' + lab],
        ['N', 'E:' + st, nm, 'kN', 'Lực dọc - bao ' + lab + ' (dương là nén)'],
      );
    }
  }
  const box = $('td_dgPrint');
  if (box) {
    box.innerHTML = P.map(
      (p, i) =>
        `<p class="cap">${p[4]}</p><svg class="dg" id="dgTdP${i}" width="760" height="520" role="img" aria-label="${p[4]}"></svg>`,
    ).join('');
    P.forEach((p, i) => {
      const D = trDiagData(R, C, p[1]);
      trBeam($('dgTdP' + i), R, p[0], trSide(p[0].endsWith('L') ? D.L : D.T), p[2], p[3]);
    });
  }
  trFigSec(R, C);
  const grpOf = (id: string) => {
    const st = R.CB!.find((c) => c.id === id)!.st;
    return st === 'SD' ? 'SD' : st === 'DB' ? 'DB' : 'CD';
  };
  const ids = R.CB!.map((c) => c.id);
  const envM = (arr: Record<string, any[]>, i: number, grp: string, kind: string) => {
    let b: number | null = null;
    let bid = '';
    ids.forEach((id) => {
      if (grpOf(id) !== grp) return;
      const e = arr[id][i];
      if (!e || !e.mx) return;
      const val =
        kind === 'neg'
          ? e.mn.M
          : kind === 'pos'
            ? e.mx.M
            : Math.abs(e.mn.M) > Math.abs(e.mx.M)
              ? e.mn.M
              : e.mx.M;
      if (
        b === null ||
        (kind === 'neg' ? val < b : kind === 'pos' ? val > b : Math.abs(val) > Math.abs(b))
      ) {
        b = val;
        bid = id;
      }
    });
    return b === null ? '-' : fx(b, 1) + (grp !== 'SD' ? ` <span class="small">(${bid})</span>` : '');
  };
  const envV = (arr: Record<string, any[]>, i: number, grp: string) => {
    let b: number | null = null;
    let bid = '';
    ids.forEach((id) => {
      if (grpOf(id) !== grp) return;
      const e = arr[id][i];
      if (!e || !e.v) return;
      const val = Math.abs(e.v.V);
      if (b === null || val > b) {
        b = val;
        bid = id;
      }
    });
    return b === null ? '-' : fx(b, 1) + ` <span class="small">(${bid})</span>`;
  };
  const hd = `<tr><th rowspan="2">Mặt cắt</th><th colspan="3">Mômen M (kN.m)</th><th colspan="2">Lực cắt |V| (kN)</th></tr><tr><th>Sử dụng</th><th>Cường độ (tổ hợp)</th><th>Đặc biệt (tổ hợp)</th><th>Cường độ (tổ hợp)</th><th>Đặc biệt (tổ hợp)</th></tr>`;
  t =
    `<tr class="grp"><td colspan="6">a) Xà mũ: M min tại các mặt cắt mômen âm, M max tại mặt cắt mômen dương</td></tr>` +
    hd;
  Cany.cand.forEach(
    (c: any, i: number) =>
      (t += `<tr><td class="l">${c.nm + (i === Cany.iA ? ' ← A-A' : i === Cany.iB ? ' ← B-B' : '')}</td>${['SD', 'CD', 'DB'].map((grp) => `<td>${envM(Cany.capE, i, grp, c.kind)}</td>`).join('')}${['CD', 'DB'].map((grp) => `<td>${envV(Cany.capE, i, grp)}</td>`).join('')}</tr>`),
  );
  set('tbTdCapF', t);
  if (G.brace && Cany.brC.length) {
    t = `<tr class="grp"><td colspan="6">b) Giằng: M có trị tuyệt đối lớn nhất</td></tr>` + hd;
    Cany.brC.forEach(
      (c: any, i: number) =>
        (t += `<tr><td class="l">${c.nm}</td>${['SD', 'CD', 'DB'].map((grp) => `<td>${envM(Cany.brE, i, grp, 'abs')}</td>`).join('')}${['CD', 'DB'].map((grp) => `<td>${envV(Cany.brE, i, grp)}</td>`).join('')}</tr>`),
    );
    set('tbTdBrF', t);
  } else set('tbTdBrF', '');
  // 5.5 thân trụ
  t = `<tr><th>Đại lượng (TTGH CĐ, SD)</th><th>Cột</th><th>Cao độ (m)</th><th>P (kN)</th><th>Qngang (kN)</th><th>Qdọc (kN)</th><th>Mngang δt·Mt (kN.m)</th><th>Mdọc δl·Ml (kN.m)</th><th>δt / δl</th><th>Tổ hợp</th></tr>`;
  for (const st of ['CD', 'DB'] as const) {
    t += `<tr class="grp"><td colspan="10">${st === 'CD' ? 'TTGH Cường độ và Sử dụng' : 'TTGH Đặc biệt'}</td></tr>`;
    ['Nmax', 'Nmin', 'Q2max', 'Q3max', 'M3max', 'M2max', 'M1max'].forEach((key) => {
      const r = Cany.colRec[st][key];
      if (!r) return;
      const vr = R.VAR![r.iv];
      const label =
        (
          {
            Nmax: 'N max',
            Nmin: 'N min',
            Q2max: 'Q ngang max',
            Q3max: 'Q dọc max',
            M3max: 'M ngang max',
            M2max: 'M dọc max',
            M1max: 'Bất lợi nhất (Mu/φMn lớn nhất)',
          } as Record<string, string>
        )[key] || key;
      t += `<tr><td class="l">${label}</td><td class="c">${r.c + 1}</td><td>${fx(r.y, 2)}</td><td>${fx(r.P, 1)}</td><td>${fx(r.Q2, 1)}</td><td>${fx(r.Q3, 1)}</td><td>${fx(r.M3, 1)}</td><td>${fx(r.M2, 1)}</td><td>${fx(r.dT, 3)} / ${fx(r.dL, 3)}</td><td class="l">${r.iv + 1}: ${vr.name} ${vr.lab}</td></tr>`;
    });
  }
  set('tbTdColF', t);
  // 5.6 lực chân cột
  t = `<tr><th>TT</th><th>Tổ hợp - cọc</th><th>Hx (kN)</th><th>Hy (kN)</th><th>P (kN)</th><th>Mx (kN.m)</th><th>My (kN.m)</th><th>Trạng thái</th></tr>`;
  let n = 0;
  for (const [lab, st] of [
    ['TTGH CƯỜNG ĐỘ VÀ SỬ DỤNG', 'CD'],
    ['TTGH ĐẶC BIỆT', 'DB'],
  ] as const) {
    t += `<tr class="grp"><td colspan="8">${lab}</td></tr>`;
    n = 0;
    R.CB!.filter((c) => (c.st === 'DB') === (st === 'DB')).forEach((cb) =>
      Cany.pileRows[cb.id].forEach((pr: any, c: number) => {
        (
          [
            ['M', pr.M],
            ['N', pr.N],
          ] as const
        ).forEach(([kd, r], j) => {
          if (!r || (j === 1 && pr.M && r.iv === pr.M.iv && r.is === pr.M.is)) return;
          n++;
          const vr = R.VAR![r.iv];
          t += `<tr><td class="c">${n}</td><td class="l">${cb.id} - cọc ${c + 1} (${kd === 'M' ? 'M max' : 'N max'})</td>${[r.Hx, r.Hy, r.P, r.Mx, r.My].map((x) => `<td>${fx(x, 2)}</td>`).join('')}<td class="l small">${vr.lab}</td></tr>`;
        });
      }),
    );
  }
  set('tbTdPileF', t);
}

export function trSide(D: Float64Array[]): Float64Array[] {
  const el = $('td_dside') as HTMLSelectElement | null;
  const o = (el && el.value) || 'both';
  if (D.length !== 2 || o === 'both') return D;
  const [a, b] = D;
  if (o === 'max') return [a];
  if (o === 'min') return [b];
  const c = new Float64Array(a.length);
  for (let i = 0; i < a.length; i++) c[i] = Math.abs(a[i]) >= Math.abs(b[i]) ? a[i] : b[i];
  return [c];
}

export function trDiagView(R: TrCalcResult, C: TrCheckResult): void {
  const k = $('td_dk') as HTMLSelectElement | null;
  const s = $('td_dc') as HTMLSelectElement | null;
  if (!k || !s) return;
  const kind = k.value;
  const sel = s.value;
  const D = trDiagData(R, C, sel);
  const nm = sel.startsWith('E:')
    ? sel === 'E:SD'
      ? 'SD-BAO'
      : sel === 'E:CD'
        ? 'CD-BAO'
        : sel === 'E:DB'
          ? 'DB-BAO'
          : sel.slice(2) + '-BAO'
    : sel.slice(2);
  trBeam(
    $('dgTdDv'),
    R,
    kind,
    trSide(kind.endsWith('L') ? D.L : D.T),
    nm,
    kind.startsWith('M') ? 'kN*m' : 'kN',
  );
}

export function trFigSec(R: TrCalcResult, C: TrCheckResult): void {
  const svEl = $('dgTdSec');
  if (!svEl) return;
  const I = R.I;
  const G = R.G;
  const Cany = C as any;
  const id = 'TdSc';
  const d = dgKit(id);
  const W = 760;
  const k = (W - 120) / I.Lc;
  const X = (y: number) => W / 2 + y * k;
  const Y = (z: number) => 40 + (G.ELt - z) * k;
  d.poly(
    trCapPoly(R).map(([y, z]) => [X(y), Y(z)]),
    '#e8edf2',
  );
  const yb = G.brace ? G.ELbb - 0.6 : G.ELcb - 1.2;
  G.xs.forEach((x) => {
    d.poly(
      [
        [X(x - I.D / 2), Y(G.ELcb)],
        [X(x + I.D / 2), Y(G.ELcb)],
        [X(x + I.D / 2), Y(yb)],
        [X(x - I.D / 2), Y(yb)],
      ],
      '#f4f4f4',
    );
  });
  if (G.brace) {
    for (let c = 0; c + 1 < G.n; c++) {
      d.poly(
        [
          [X(G.xs[c] + I.D / 2), Y(G.ELbt)],
          [X(G.xs[c + 1] - I.D / 2), Y(G.ELbt)],
          [X(G.xs[c + 1] - I.D / 2), Y(G.ELbb)],
          [X(G.xs[c] + I.D / 2), Y(G.ELbb)],
        ],
        '#e8edf2',
      );
    }
  }
  const cut = (x: number, lab: string, z1: number, z2: number, col: string, low?: boolean) => {
    d.s += `<line x1="${X(x)}" y1="${Y(z1) - 10}" x2="${X(x)}" y2="${Y(z2) + 10}" stroke="${col}" stroke-width="1.6" stroke-dasharray="8,3"/>`;
    d.T(X(x), low ? Y(z2) + 24 : Y(z1) - 14, lab, 'middle', `style="font-weight:bold;fill:${col}"`);
  };
  if (Cany.iA >= 0) cut(Cany.cand[Cany.iA].xs, 'A-A', G.ELt, G.ELcb, '#c00000');
  if (Cany.iB >= 0) cut(Cany.cand[Cany.iB].xs, 'B-B', G.ELt, G.ELcb, '#1f4e79');
  const bx = (c: any) =>
    c.kind === 'pos'
      ? (G.xs[c.sp] + G.xs[c.sp + 1]) / 2
      : c.qi >= 0
        ? G.xs[c.sp] + (c.off || 0)
        : G.xs[c.sp + 1] - (c.off || 0);
  if (G.brace) {
    if (Cany.gA >= 0 && Cany.brC[Cany.gA]) cut(bx(Cany.brC[Cany.gA]), 'C-C', G.ELbt, G.ELbb, '#c00000');
    if (Cany.gB >= 0 && Cany.brC[Cany.gB])
      cut(bx(Cany.brC[Cany.gB]), 'D-D', G.ELbt, G.ELbb, '#1f4e79', true);
  }
  const H = Math.max(Y(yb) + 40, 140);
  d.T(
    W / 2,
    H - 10,
    'A-A, B-B: mặt cắt xà mũ có mômen âm, dương lớn nhất' +
      (G.brace ? ' ; C-C, D-D: mặt cắt giằng có mômen âm, dương lớn nhất' : '') +
      ' (theo bao TTGH Cường độ, Đặc biệt)',
    'middle',
    'class="s"',
  );
  dgPut(svEl as unknown as SVGElement, W, H, d.s, id);
}

export function trRCrows(E: Record<string, any[]>, i: number): RcLoadInput[] {
  const L: RcLoadInput[] = [];
  if (i < 0) return L;
  Object.keys(E).forEach((id) => {
    const e = E[id][i];
    const st = (TRR?.CB?.find((c) => c.id === id)?.st || 'CD') as LimitStateType;
    if (!e || !e.mx) return;
    L.push(
      { id: id + ' (M max)', st, M: e.mx.M, V: e.mx.V, N: e.mx.N },
      { id: id + ' (M min)', st, M: e.mn.M, V: e.mn.V, N: e.mn.N },
      { id: id + ' (|V| max)', st, M: e.v.M, V: e.v.V, N: e.v.N },
    );
  });
  return L;
}

export function trRender22(R: TrCalcResult, C: TrCheckResult): void {
  const I = R.I;
  const M = R.M!;
  const Cany = C as any;
  const mirror = (src: string, dst: string) =>
    ['1s', '1a', '1d', '1c', '2s', '2a', '2d', '2c', 'ss', 'sd', 'sn'].forEach((q) => {
      const svVal = v('rc_' + src + q, '');
      if (svVal !== '') sv('rc_' + dst + q, svVal);
      const a = $('rc_' + src + q) as HTMLInputElement | HTMLSelectElement | null;
      const b = $('rc_' + dst + q) as HTMLInputElement | HTMLSelectElement | null;
      if (a && b) {
        b.value = a.value;
        if ('readOnly' in b) (b as HTMLInputElement).readOnly = true;
        b.classList.add('lnk');
      }
    });
  mirror('xa', 'xb');
  mirror('ga', 'gb');
  TRSHOW.res = {};
  syncWindowGlobals();
  const S = (pf: string, h: number) => rcSec(pf, I.b * 1000, h * 1000);
  const Sg = (pf: string) => rcSec(pf, I.bbb * 1000, I.hbb * 1000);
  if (Cany.iA >= 0) {
    TRSHOW.res.xa = rcRender(
      'xa',
      S('xa', Cany.cand[Cany.iA].h),
      M,
      trRCrows(Cany.capE, Cany.iA),
      'Mặt dưới',
      'Mặt trên',
    );
  }
  if (Cany.iB >= 0) {
    TRSHOW.res.xb = rcRender(
      'xb',
      S('xb', Cany.cand[Cany.iB].h),
      M,
      trRCrows(Cany.capE, Cany.iB),
      'Mặt dưới',
      'Mặt trên',
    );
  }
  if (R.G.brace) {
    if (Cany.gA >= 0) {
      TRSHOW.res.ga = rcRender('ga', Sg('ga'), M, trRCrows(Cany.brE, Cany.gA), 'Mặt dưới', 'Mặt trên');
    }
    if (Cany.gB >= 0) {
      TRSHOW.res.gb = rcRender('gb', Sg('gb'), M, trRCrows(Cany.brE, Cany.gB), 'Mặt dưới', 'Mặt trên');
    }
  }
  (['xa', 'xb', 'ga', 'gb'] as const).forEach((pf) => {
    const e = $('o_rc' + pf + 'pos');
    const c =
      pf[0] === 'x' ? Cany.cand[pf === 'xa' ? Cany.iA : Cany.iB] : Cany.brC[pf === 'ga' ? Cany.gA : Cany.gB];
    const txt = c ? c.nm + (c.xs != null ? ' (y = ' + fx(c.xs, 2) + ' m)' : '') : '-';
    if (e) e.textContent = txt;
    else set('o_rc' + pf + 'pos', txt);
  });
  const SL = Cany.SL;
  const gRow = Cany.colRec.CD.M1max;
  let t = `<tr><th>Đại lượng</th><th>Ngang cầu</th><th>Dọc cầu</th><th>Đơn vị</th></tr>`;
  const r = (a: string, x: unknown, y: unknown, u: string, d = 3) =>
    `<tr><td class="l">${a}</td><td>${typeof x === 'string' ? x : trF(x, d)}</td><td>${typeof y === 'string' ? y : trF(y, d)}</td><td class="c">${u || ''}</td></tr>`;
  const nC = R.G.n;
  const avg = (fn: (c: number) => number) =>
    R.MD!.cols.reduce((acc, _o, c) => acc + fn(c), 0) / nC;
  t +=
    r(
      'Chiều dài không giằng ℓu (đáy xà mũ đến mặt đất sau xói' +
        (R.G.brace ? ' ; ngang cầu: đoạn dài nhất giữa xà mũ, giằng, mặt đất' : '') +
        ')',
      SL.luT,
      SL.luL,
      'm',
    ) +
    r('EI cột, βd = 0 (TCVN 11823-5, PT 41, 42)', SL.EIc(0), SL.EIc(0), 'kN.m²', 0) +
    r('EI cọc, βd = 0 (PT 41, 42, cốt thép cọc)', SL.EIp(0), SL.EIp(0), 'kN.m²', 0) +
    r(
      'Pe mỗi cột, khung lệch được (phân tích ổn định, βd = 0)',
      SL.PeT(0),
      avg((c) => SL.PeL(c, 0)),
      'kN',
      0,
    ) +
    r(
      'Pe,b mỗi cột, đỉnh bị giữ chuyển vị ngang (βd = 0)',
      SL.PeTb(0),
      avg((c) => SL.PeLb(c, 0)),
      'kN',
      0,
    ) +
    r('Chiều dài hữu hiệu K·ℓu = π·√(EI/Pe)', SL.KluT, SL.KluL, 'm') +
    r('Hệ số chiều dài hữu hiệu tương đương K = K·ℓu/ℓu (≥ 1, Điều 7.4.3)', SL.Kt, SL.Kl, '', 2) +
    r('Bán kính quán tính r = D/4', SL.r, SL.r, 'm') +
    r('Độ mảnh K·ℓu/r', SL.lt, SL.ll, '', 1) +
    r(
      'Bỏ qua hiệu ứng độ mảnh khi K·ℓu/r &lt; 22 (khung không giằng)',
      SL.magT ? 'Phải xét' : 'Bỏ qua',
      SL.magL ? 'Phải xét' : 'Bỏ qua',
      '',
    ) +
    r(
      'Phương pháp khuếch đại mômen dùng khi K·ℓu/r &lt; 100',
      SL.lt < 100 ? 'Thỏa mãn' : 'Vượt',
      SL.ll < 100 ? 'Thỏa mãn' : 'Vượt',
      '',
    );
  if (gRow && gRow.dTo) {
    const vr = R.VAR![gRow.iv];
    const a = gRow.dTo;
    const b = gRow.dLo;
    t +=
      `<tr class="grp"><td colspan="4">Trạng thái bất lợi nhất của thân trụ: ${vr.name} ${vr.lab} - cột ${gRow.c + 1}, cao độ ${fx(gRow.y, 2)}</td></tr>` +
      r('βd', gRow.bdT, gRow.bdL, '') +
      r('ΣPu (tổng lực nén các cột)', a.sumP, b.sumP, 'kN', 0) +
      r('ΣPe (tổng các cột, theo βd)', a.sumPe, b.sumPe, 'kN', 0) +
      r('δs = 1/(1 - ΣPu/(φK.ΣPe)) (PT 4)', a.ds, b.ds, '') +
      r('Pe,b của cột (theo βd)', a.Peb, b.Peb, 'kN', 0) +
      r('δb = Cm/(1 - Pu/(φK.Pe,b)) ≥ 1, Cm = 1 (PT 3)', a.db, b.db, '') +
      r(
        'Chuyển vị ngang do tải trọng trọng lực Δ &gt; ℓu/1500 (khi đó mômen trọng lực tính vào M2s)',
        a.sw ? 'Có' : 'Không',
        b.sw ? 'Có' : 'Không',
        '',
      ) +
      r('M2b (tải trọng trọng lực)', Math.abs(gRow.Mtb), Math.abs(gRow.Mlb), 'kN.m', 1) +
      r('M2s (còn lại)', Math.abs(gRow.Mt - gRow.Mtb), Math.abs(gRow.Ml - gRow.Mlb), 'kN.m', 1) +
      r('Mc = δb.M2b + δs.M2s (PT 1)', Math.abs(gRow.M3), Math.abs(gRow.M2), 'kN.m', 1);
  }
  set('tbTdSL', t);
  let u = `<tr><th>Tổ hợp</th><th>ΣPu max (kN)</th><th>βd ngang</th><th>ΣPe ngang (kN)</th><th>δs ngang</th><th>βd dọc</th><th>ΣPe dọc (kN)</th><th>δs dọc</th></tr>`;
  Object.entries(SL.cmb).forEach(([id, o]: [string, any]) => {
    u += `<tr><td class="l">${id}</td><td>${fx(o.sumP, 0)}</td><td>${fx(o.bdT, 3)}</td><td>${fx(o.sPeT, 0)}</td><td>${fx(o.dsT, 3)}</td><td>${fx(o.bdL, 3)}</td><td>${fx(o.sPeL, 0)}</td><td>${fx(o.dsL, 3)}</td></tr>`;
  });
  set('tbTdSLc', u);
  set(
    'o_td_slNote',
    (SL.ok ? '' : `<span class="bad">Phân tích ổn định không hội tụ: kiểm tra mô hình. </span>`) +
      (SL.over
        ? `<span class="bad">K·ℓu/r vượt 100: theo TCVN 11823-5 Điều 7.4.1 phải phân tích chính xác hơn (bậc hai P-Δ); kết quả khuếch đại mômen chỉ để tham khảo. </span>`
        : '') +
      'Mômen tại mọi mặt cắt cột và cọc, từng trạng thái, từng phương: Mc = δb.|M2b| + δs.|M2s| (lấy dấu của M). δs tính cho cả nhóm cột (ΣPu, ΣPe) vì các cột nối cứng với cùng xà mũ. Bản in TCVN 11823-4, Điều 5.3.2.2.2 ghi ký hiệu PT 4 là δb là sai; đúng theo AASHTO LRFD Bridge Design Specifications, 7th Ed. (2014), PT 4.5.3.2.2b-4 là δs (hệ số khuếch đại cho khung lệch được, tính với ΣPu, ΣPe).',
  );
}

const ikOn = (k: string): boolean => !itOffSet().has(String(k));
let latestSummaryOkAll = true;

export function trSummary(R: TrCalcResult, C: TrCheckResult): void {
  const rows: string[] = [];
  const st: string[] = [];
  const add = (a: string, ok: boolean, ref?: string, val?: string, warn?: boolean) => {
    st.push(ok ? 'P' : warn ? 'W' : 'F');
    rows.push(
      `<tr><td class="l">${a}</td><td class="l">${val || ''}</td>${ok ? trOK(true, 'Đạt') : warn ? `<td class="c" style="color:#b26b00">Cần xem xét</td>` : trOK(false, 'Không đạt')}<td class="l small">${ref || ''}</td></tr>`,
    );
  };
  const rc = TRSHOW.res || {};
  (
    [
      ['xa', 'Xà mũ - mặt cắt A-A (mômen âm)'],
      ['xb', 'Xà mũ - mặt cắt B-B (mômen dương)'],
      ['ga', 'Giằng - mặt cắt mômen âm'],
      ['gb', 'Giằng - mặt cắt mômen dương'],
    ] as const
  ).forEach(([pf, nm]) => {
    const o = rc[pf];
    if (!o) return;
    add(
      nm + ': uốn, cốt thép tối thiểu, nứt, cắt',
      !!o.ok,
      'TCVN 11823-5, 7.3, 8.3',
      o.gM ? 'Mr/Mu = ' + fx(o.gM.rM, 2) : '',
    );
  });
  const sl = (C as any).SL;
  add(
    'Độ mảnh thân trụ K·ℓu/r < 100 (dùng phương pháp khuếch đại mômen)',
    !sl.over,
    'TCVN 11823-5, 7.4.1',
    'ngang ' + fx(sl.lt, 1) + ' ; dọc ' + fx(sl.ll, 1),
  );
  const w = typeof window !== 'undefined' ? (window as any) : null;
  const M: Record<string, boolean> = { ...contextState.matOK, ...(w?.__matOK || {}) };
  const cf: Record<string, boolean> = { ...latestConfOK, ...(w?.__confOK || {}) };
  const sc: Record<string, boolean> = { ...contextState.sctOK, ...(w?.__sctOK || {}) };
  const q: Record<string, boolean> = { ...latestTrEq, ...(w?.__trEq || {}) };
  const rb: { ok: boolean; u: number; lim: number } | null = latestRkBr || w?.__rkBr || null;
  if (ikOn('tth')) {
    add(
      'Thân trụ theo vật liệu: P-M, cắt, cốt thép, độ mảnh',
      M.C_ === true,
      'TCVN 11823-5',
      'trang kiểm toán thân trụ theo vật liệu',
    );
  }
  if (q.hOK != null) {
    add(
      'Thân trụ - lực cắt do khớp dẻo trong vùng đầu cột',
      !!q.hOK,
      'TCVN 11823-3, 9.9.4.3 ; TCVN 11823-5, 10.11.4.1.3',
      'mục 11.1',
    );
  }
  if (q.sOK != null) {
    add('Xà mũ - mô hình chống - giằng tại cột', !!q.sOK, 'TCVN 11823-5, 8.1.1 ; 6.3', 'mục 11.2');
  }
  if (cf.C != null && ikOn('tth')) {
    add(
      'Cốt thép ngang bó lõi thân trụ',
      !!cf.C,
      'TCVN 11823-5, 7.4.6' + (R.EQ!.zone >= 2 ? ' ; 10.11.4.1.4' : ''),
      'trang kiểm toán thân trụ, mục 6',
    );
  }
  if (R.G.pile) {
    if (ikOn('tvl')) {
      add(
        'Cọc theo vật liệu: P-M, cắt, cốt thép',
        M.T_ === true,
        'TCVN 11823-5',
        'trang kiểm toán cọc trụ theo vật liệu',
      );
    }
    if (cf.T != null && ikOn('tvl')) {
      add(
        'Cốt thép ngang bó lõi cọc trụ',
        !!cf.T,
        'TCVN 11823-5, 7.4.6' + (R.EQ!.zone >= 2 ? ' ; 10.11.4.1.4' : ''),
        'trang kiểm toán cọc trụ, mục 6',
      );
    }
    const al = R.I.pAl;
    if (al && al.kind === 'pm' && R.G.xs.length > 1 && al.r < 3 && ikOn('tnc')) {
      add(
        'Hệ số nhóm Pm khi khoảng cách cọc s &lt; 3B: Bảng 21 không có giá trị, đang lấy theo 3B',
        false,
        'TCVN 11823-10, 7.3.12, Bảng 21',
        's/B = ' + fx(al.r, 2),
        true,
      );
    }
    if (ikOn('tsc')) {
      const two = sctSep() && sc.U_ != null;
      const n = sctNm('td_name', ['T1', 'T2']);
      add(
        'Sức chịu tải cọc theo đất nền: nén, nhổ, nhóm cọc, chuyển vị' + (two ? ' - trụ ' + n[0] : ''),
        sc.T_ === true,
        'TCVN 11823-10',
        'trang sức chịu tải cọc trụ' + (two ? ' ' + n[0] : ''),
      );
      if (two) {
        add(
          'Sức chịu tải cọc theo đất nền: nén, nhổ, nhóm cọc, chuyển vị - trụ ' + n[1],
          sc.U_ === true,
          'TCVN 11823-10',
          'trang sức chịu tải cọc trụ ' + n[1],
        );
      }
    }
    if (rb && ikOn('tnc')) {
      add(
        'Chuyển vị ngang tại mặt đá, TTGH sử dụng ≤ 0,0004b',
        !!rb.ok,
        'TCVN 11823-10, 8.2.3',
        fx(rb.u, 2) + ' mm ; 0,0004b = ' + fx(rb.lim, 2) + ' mm',
        true,
      );
    }
    if (R.I.pNoE0) {
      st.push('N');
      rows.push(
        `<tr><td class="l">Độ cứng dọc trục cọc (mô đun biến dạng E0 của đất)</td><td class="l">chưa có E0</td><td class="c bad">Chưa đủ số liệu</td><td class="l small">TCVN 10304:2025, 7.4.2</td></tr>`,
      );
    }
  }
  const nod = st.includes('N');
  const fail = st.includes('F');
  const warn = st.includes('W');
  latestSummaryOkAll = !nod && !fail;
  const fin = nod
    ? `<span class="bad">CHƯA ĐỦ SỐ LIỆU ĐỂ KẾT LUẬN (thiếu mô đun biến dạng E0 của đất, xem trang nội lực cọc trụ mục 3)</span>`
    : fail
      ? `<span class="bad">TRỤ KHÔNG ĐẠT YÊU CẦU (có hạng mục bắt buộc không đạt)</span>`
      : warn
        ? `<span class="ok">TRỤ ĐẠT YÊU CẦU</span> <span style="color:#b26b00">- có hạng mục cần xem xét thêm</span>`
        : `<span class="ok">TRỤ ĐẠT YÊU CẦU</span>`;
  set(
    'o_td_sum',
    `<h2>12.&nbsp;&nbsp;KẾT LUẬN</h2><table class="t dt"><tr><th>Hạng mục</th><th>Giá trị</th><th>Kết luận</th><th>Căn cứ</th></tr>${rows.join('')}<tr><td class="l" colspan="2"><b>KẾT LUẬN CHUNG</b></td><td class="c" colspan="2"><b>${fin}</b></td></tr></table>`,
  );
}

// bảng chiều cao đá kê theo dốc ngang (dùng chung trụ dẻo, trụ đặc)
export function trXFtab(
  XF: CrossfallModel | null | undefined,
  ys: number[],
  HK: { dG: number[]; Atd?: number; h: number[] },
  lab: string,
  h0?: number,
): void {
  if (!XF) return;
  const f = (val: number, d = 3) => fx(val, d);
  const mode =
    (
      {
        theo: 'mặt xà mũ dốc theo mặt cầu',
        phang: 'mặt xà mũ phẳng 0%',
        rieng: 'mặt xà mũ dốc riêng',
      } as Record<string, string>
    )[XF.mode] || '';
  let t = `<tr><th>Dầm</th><th>y (m)</th><th>Độ hạ mặt cầu (m)</th><th>Độ hạ đáy dầm (m)</th><th>Độ hạ mặt xà mũ (m)</th><th>${lab} (m)</th></tr>`;
  ys.forEach(
    (y, j) =>
      (t += `<tr><td class="c">${j + 1}</td><td>${f(y, 3)}</td><td>${f(XF.dD(y))}</td><td>${f(HK.dG[j])}</td><td>${f(XF.dM(y))}</td><td>${f(HK.h[j] + (h0 || 0))}</td></tr>`),
  );
  if (XF.gpl === 'bang') {
    const I = trInputs();
    const gc = I.gc || 24.5;
    t += `<tr><td class="l" colspan="6">Dầm đặt bằng: đỉnh các dầm cùng cao độ, bằng đáy bản mặt cầu tại dầm biên thấp hơn ; dốc ngang tạo trên mặt trên bản mặt cầu (bản dày dần về đỉnh dốc), phần bản dày thêm A = ${f(HK.Atd || 0, 4)} m²/m ; trọng lượng phần dày thêm tác dụng lên trụ từ hai nhịp γc.A.(L1 + L2)/2 = ${f((gc * (HK.Atd || 0) * ((I.L1 || 0) + (I.L2 || 0))) / 2, 2)} kN - phải có trong tĩnh tải DC của kết cấu nhịp (tự có khi DC lấy từ sheet mố và mố cũng chọn dầm đặt bằng).</td></tr>`;
  }
  t += `<tr><td class="l" colspan="6">Dốc mặt cầu: trái ${f(XF.iL, 2)}%, phải ${f(XF.iR, 2)}%, đỉnh dốc tại y = ${f(XF.yc, 2)} m ; ${mode} (trái ${f(XF.mL, 2)}%, phải ${f(XF.mR, 2)}%). Chiều cao tại dầm j = h thấp nhất + [độ hạ mặt xà mũ - độ hạ đáy dầm] - min(...).</td></tr>`;
  set('tbTdHK', t);
}

// ---------------------------------------------------------------------------
// 11. Typed State Accessors & Contract Result Adapter
// ---------------------------------------------------------------------------

export function getLatestTrResult(): TrCalcResult | null {
  return TRR;
}

export function setLatestTrResult(r: TrCalcResult | null): void {
  TRR = r;
  syncWindowGlobals();
}

export function getLatestTrCheck(): TrCheckResult | null {
  return TRC;
}

export function setLatestTrCheck(c: TrCheckResult | null): void {
  TRC = c;
  syncWindowGlobals();
}

export function getLatestTrConf(): Record<string, boolean> {
  return { ...latestConfOK };
}

export function getLatestTrEq(): Record<string, boolean> {
  return { ...latestTrEq };
}

export function getLatestTrShow(): Record<string, any> {
  return TRSHOW;
}

export function getLatestTrRows(): { CD: any[]; DB: any[] } | null {
  return TRROWS;
}

export function getLatestTrXy(): Array<[number, number]> | null {
  return TRXY;
}

export function getLatestTrSummaryOk(): boolean {
  return latestSummaryOkAll;
}

function toRcSectionResult(r: RcSectionCheckWithOk | null | undefined): RcSectionResult | undefined {
  if (!r) return undefined;
  return {
    rows: r.rows,
    gM: r.gM,
    gV: r.gV,
    gS: r.gS,
    minR: r.minR,
    cr: r.cr,
    Ag: r.Ag,
    Ig: r.Ig,
    Sg: r.Sg,
    circular: r.circular,
  };
}

export function toFlexiblePierResult(
  R: TrCalcResult | null = TRR,
  C: TrCheckResult | null = TRC,
): PierResult | null {
  if (!R) return null;
  const G = R.G;
  const I = R.I;
  const geom: Record<string, number> = {
    Lc: I.Lc,
    b: I.b,
    h: I.h,
    he: I.he,
    n: G.n,
    s: I.s,
    D: I.D,
    Hc: G.Hc,
    ELt: G.ELt,
    ELcb: G.ELcb,
    ELs: G.ELs,
    ELtip: G.ELtip,
  };
  if (R.err && R.err.length) {
    return { variant: 'flexible', geom, combos: [], okAll: false };
  }
  const combos: Array<{ id: string; st: LimitStateType; tot: ForceVector5 }> = [];
  if (R.CB && R.C3) {
    const PP: Record<string, readonly [number, number]> = {
      max: [1.25, 1.5],
      min: [0.9, 0.65],
      IV: [1.5, 1.5],
      IVb: [0.9, 0.65],
      one: [1.0, 1.0],
    };
    const C3: Record<string, TrLoadPoint[]> = { ...R.C3, ...trLLrep(R) };
    const B: Record<string, { Hx: number; Hy: number; Hz: number; Mx: number; My: number; Mz: number }> = {};
    Object.keys(C3).forEach((k) => {
      B[k] = trResAt(C3[k], G.ELs);
    });
    R.CB.forEach((cb) => {
      const pf = PP[cb.p] || PP.one;
      const e = cb.st === 'SD' ? 1 : I.eta;
      for (const ll of cb.gLL ? ['LL1', 'LL2'] : [null]) {
        for (const wd of cb.w ? (['n', 'd'] as const) : ([null] as const)) {
          const o = { Hx: 0, Hy: 0, Hz: 0, Mx: 0, My: 0 };
          const ad = (k: string | null, g0: number) => {
            if (!k || !B[k] || !g0) return;
            o.Hx += e * g0 * B[k].Hx;
            o.Hy += e * g0 * B[k].Hy;
            o.Hz += e * g0 * B[k].Hz;
            o.Mx += e * g0 * B[k].Mx;
            o.My += e * g0 * B[k].My;
          };
          ad('DC', pf[0]);
          ad('DCp', pf[0]);
          ad('DW', pf[1]);
          ad(cb.p === 'min' || cb.p === 'IVb' || cb.wH ? 'WA2' : 'WA2L', 1);
          ad('WA3', 1);
          if (ll) {
            ad(ll, cb.gLL);
            ad('BR', cb.gLL);
            ad('CE', cb.gLL);
          }
          if (cb.w) {
            if (wd === 'n') {
              ad('WS' + (cb.w.V === '25' ? 'n25' : 'n'), cb.w.g);
              ad('WLn', cb.w.WL);
              if (cb.w.WV) ad('WVp', cb.w.WV);
            } else {
              ad('WS' + (cb.w.V === '25' ? 'd25' : 'd'), cb.w.g);
              ad('WLd', cb.w.WL);
              ad('WLn', (cb.w.WL * 0.5) / 1.46);
            }
          }
          ad('TU', cb.TU);
          ad('CS', cb.TU);
          if (cb.eq) {
            ad('EQd', cb.eq[0]);
            ad('EQn', cb.eq[1]);
          }
          if (cb.ct) {
            ad('CTn', 1);
            ad('CVn', 1);
          }
          const suffix =
            (wd ? (wd === 'n' ? ' - gió ngang' : ' - gió dọc') : '') +
            (ll ? (ll === 'LL1' ? ' (LL I)' : ' (LL II)') : '');
          combos.push({
            id: cb.id + suffix,
            st: cb.st,
            tot: { N: o.Hz, Hx: o.Hx, My: o.My, Hy: o.Hy, Mx: o.Mx },
          });
        }
      }
    });
  }
  const Cany = C as any;
  const SL = Cany?.SL;
  const nC = Math.max(1, G.n);
  const avg = (fn: (c: number) => number) =>
    R.MD && R.MD.cols.length ? R.MD.cols.reduce((acc, _o, c) => acc + fn(c), 0) / nC : 0;
  const buckling = SL
    ? {
        PeT: SL.PeT(0),
        PeL: avg((c) => SL.PeL(c, 0)),
        PeTb: SL.PeTb(0),
        PeLb: avg((c) => SL.PeLb(c, 0)),
        slenderMax: Math.max(SL.lt, SL.ll),
        swayFlag: Boolean(SL.magT || SL.magL),
      }
    : undefined;
  const capRes = (TRSHOW.res?.xa || TRSHOW.res?.xb) as RcSectionCheckWithOk | undefined;
  const seismic = R.EQ
    ? {
        T: Math.max(R.EQ.Tt || 0, R.EQ.Tl || 0),
        Cms: Math.max(R.EQ.CsT || R.EQ.Ct || 0, R.EQ.CsL || R.EQ.Cl || 0),
        zone: R.EQ.zone || 1,
        plasticHingeOk: latestTrEq.hOK,
        confinementOk: latestConfOK.C,
      }
    : undefined;
  return {
    variant: 'flexible',
    geom,
    combos,
    buckling,
    capCheck: toRcSectionResult(capRes),
    seismic,
    okAll: latestSummaryOkAll,
  };
}
