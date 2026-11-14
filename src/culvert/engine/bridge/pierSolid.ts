/**
 * BangTinhCauCong Web App — Solid Wall Pier Solver & UI Pipeline (`DCT`)
 *
 * Clean-room 100% numerically exact TypeScript port of TCVN 11823:2017 solid pier
 * calculations (`DCT`, `dcOn`, `dcInputs`, `dcVis`, `dcStep`, `dcRender20`,
 * `dcRender46`, `dcRender47`, `dcRender48`, `dcFig*`, `dcSTMx`, `dcSTMb`,
 * `dcPiles`, `dcFeedPile`, `toSolidPierResult`) from
 * `analysis-cau-cong/modules/14_pier_solid_dct_and_shallow_fdn_ui.js` lines 1–3345.
 *
 * Reuses all shallow foundation solvers/UI helpers (`sfdOn`, `sfdStep`, `sfGrid`, `sfVis`)
 * from `../foundations/shallowFdn.ts` without duplicating them.
 */

import type {
  ForceVector5,
  LimitStateType,
  PierResult,
  RcMaterialProps,
  RcSectionInput,
  RcSectionResult,
} from '../../types/project.ts';
import {
  $,
  contextState,
  fx,
  getVisualHooks,
  num,
  nums,
  sct2Run,
  set,
  sv,
  v,
  withCtx,
} from '../context.ts';
import {
  RC,
  STN,
  rcRender,
  rcSec,
  tab3Step,
  type RcLoadInput,
  type RcSectionCheckWithOk,
} from '../math/rc.ts';
import { mcocStep, type McrRuntimeState } from '../foundations/pileGroup.ts';
import { sctCheck, sctStep } from '../foundations/drilledShaft.ts';
import {
  sfdOn,
  sfdStep,
  sfGrid,
  sfVis,
  type SfRenderResult,
  type SolidPierForSfdInput,
} from '../foundations/shallowFdn.ts';
import { dgKit, dgPut } from '../../graphics/svgPrimitives.ts';
import { mathAll } from '../../graphics/texMath.ts';
import {
  SUPDIST,
  XFmk,
  type CrossfallModel,
  type PedestalHeightResult,
} from './crossfall.ts';
import { moTxt } from './abutmentHeavy.ts';
import { spV } from './girderHollow.ts';
import {
  TR,
  registerPierSolidBridgeHooks,
  trDrawSuper,
  trFigIL,
  trInputs,
  trLink,
  trXFtab,
  type TrCalcResult,
  type TrInput,
  type TrLoadPoint,
  type TrLongResult,
  type TrPlacementsResult,
} from './pierFlex.ts';

// ---------------------------------------------------------------------------
// 1. HTML Default Seed Tables (`dt_*` & `rc_d*` from `shell.html`)
// ---------------------------------------------------------------------------

export const DT_STR_KEYS: ReadonlySet<string> = new Set([
  'fnd',
  'nose',
  'Rimp',
  'stmx',
  'stmb',
]);

export const DT_DEFAULTS: Readonly<Record<string, string>> = {
  B: '7.0',
  B5: '1.55',
  H4: '0.6',
  H5: '0.8',
  C5: '1.8',
  B6: '0',
  H6: '0',
  B2: '3.5',
  C2: '1.2',
  H2: '3.8',
  nose: 'r',
  H3: '0',
  B3: '0',
  B4: '0.2',
  C3: '0',
  C4: '0.3',
  fnd: 'coc',
  B1: '6.0',
  C1: '5.0',
  H1: '1.8',
  dka: '0.31',
  dkb: '0.86',
  dkh: '0.05',
  gs: '18.88',
  Cpn: '1.02',
  Cpd: '1.26',
  Rimp: '1',
  eta: '1.0',
  stmx: 'ref',
  xskd: '16',
  xsks: '150',
  nb: '58',
  db: '32',
  dc: '100',
  vd: '20',
  vs: '150',
  vnx: '4',
  vny: '4',
  K: '2.1',
  stmb: 'ref',
  bskd: '16',
  bsks: '200',
};

export const RC_DC_DEFAULTS: Readonly<Record<string, string>> = {
  rc_dx1s: '135',
  rc_dx1a: '90',
  rc_dx1d: '22',
  rc_dx1c: '86',
  rc_dx2s: '135',
  rc_dx2a: '90',
  rc_dx2d: '32',
  rc_dx2c: '91',
  rc_dxss: '150',
  rc_dxsd: '16',
  rc_dxsn: '4',
  rc_db11s: '150',
  rc_db11a: '100',
  rc_db11d: '28',
  rc_db11c: '160',
  rc_db12s: '200',
  rc_db12a: '100',
  rc_db12d: '20',
  rc_db12c: '80',
  rc_db1ss: '450',
  rc_db1sd: '16',
  rc_db1sn: '0',
  rc_db21s: '150',
  rc_db21a: '100',
  rc_db21d: '28',
  rc_db21c: '160',
  rc_db22s: '200',
  rc_db22a: '100',
  rc_db22d: '20',
  rc_db22c: '80',
  rc_db2ss: '450',
  rc_db2sd: '16',
  rc_db2sn: '0',
};

/** Seeds solid-pier RC reinforcement defaults only when keys are absent from DOM/virtual store. */
export function seedSolidRcDefaults(): void {
  Object.entries(RC_DC_DEFAULTS).forEach(([k, val]) => {
    if (!$(k)) sv(k, val);
  });
}

// ---------------------------------------------------------------------------
// 2. Domain Interfaces & Types
// ---------------------------------------------------------------------------

export interface DcInput {
  [key: string]: number | string;
  B: number;
  B5: number;
  H4: number;
  H5: number;
  C5: number;
  B6: number;
  H6: number;
  B2: number;
  C2: number;
  H2: number;
  nose: string;
  H3: number;
  B3: number;
  B4: number;
  C3: number;
  C4: number;
  fnd: string;
  B1: number;
  C1: number;
  H1: number;
  dka: number;
  dkb: number;
  dkh: number;
  gs: number;
  Cpn: number;
  Cpd: number;
  Rimp: string;
  eta: number;
  stmx: string;
  xskd: number;
  xsks: number;
  nb: number;
  db: number;
  dc: number;
  vd: number;
  vs: number;
  vnx: number;
  vny: number;
  K: number;
  stmb: string;
  bskd: number;
  bsks: number;
}

export interface DcGeomResult {
  XF: CrossfallModel;
  HK: PedestalHeightResult;
  hAt0: (y: number) => number;
  err: string[];
  hx: number;
  ELt: number;
  ELcb: number;
  ELm: number;
  ELtb: number;
  ELbb: number;
  rnd: boolean;
  Rn: number;
  a: number;
  Ath: number;
  Beq: number;
  Ix: number;
  Iy: number;
  Bu: number;
  Cu: number;
  Ru: number;
  Au: number;
  nb: number;
  xg: number[];
  zBr: number;
  zGt: number;
  zDeck: number;
  zRoad: number;
  ELs: number;
  hAt: (y: number) => number;
}

export interface DcLoadPoint {
  x: number;
  y: number;
  z: number;
  FX?: number;
  FY?: number;
  FZ?: number;
  nm?: string;
}

export interface DcSecForces {
  Hx: number;
  Hy: number;
  Hz: number;
  Mx: number;
  My: number;
  Mz: number;
}

export interface DcWeightPart {
  nm: string;
  V: number;
  z: number;
  P?: number;
}

export interface DcWetPart {
  nm: string;
  V: number;
  z: number;
}

export interface DcFlowPart {
  nm: string;
  h: number;
  z: number;
  FY: number;
  FX: number;
}

export interface DcWindRow {
  nm: string;
  At: number;
  Cd: number | null;
  z: number;
  F: number;
}

export interface DcLiveLoadCase {
  k: number;
  m: number;
  cs: 'A' | 'B';
  yc: number;
  R1: number;
  R2: number;
  N: number;
  Mx: number;
  My: number;
  ax: number;
  BR: number;
  nm: string;
}

export interface DcEqDir {
  I: number;
  K: number;
  T: number;
  c: number;
  R: number;
  Rf: number;
}

export interface DcEqMass {
  nm: string;
  W: number;
  z: number;
  base?: boolean;
}

export interface DcLoadsInfo {
  W: Array<Required<DcWeightPart>>;
  Vcap: number;
  zcap: number;
  EV: {
    hd: number;
    Aev: number;
    EV: number;
    EVH: number;
    hwL: number;
    hwH: number;
  };
  WB: {
    wH: DcWetPart[];
    wL: DcWetPart[];
  };
  WA: {
    pD: number;
    pL: number;
    CL: number;
    fl: DcFlowPart[];
  };
  WS: {
    V: number;
    Lt: number;
    At1: number;
    At2: number;
    zs1: number;
    zs2: number;
    Lw: number;
    low: number;
    WSn: DcWindRow[];
    WSd: DcWindRow[];
    Av: number;
    Pv: number;
    zWL: number;
  };
  LL: {
    LO: TrLongResult;
    nL: number;
    wl: number;
    llk: DcLiveLoadCase[];
    LLa: DcLiveLoadCase;
    LLb: DcLiveLoadCase;
    LLc: DcLiveLoadCase;
    BRmax: number;
    zBR: number;
    Cce: number;
    CE: number;
    PLt: [number, number];
  };
  TU: {
    dT: number;
    nbr: number;
    Ab: number;
    kb: number;
    FTU: [number, number];
    FCS: [number, number];
    TUn: number;
    CSn: number;
    cont: { Lc: number; dTU: number; dCS: number } | null;
    cap: number | null;
  };
  EQ: {
    Wsup: number;
    Wcap: number;
    Wth: number;
    Wbe: number;
    Weff: number;
    zsup: number;
    Hm: number;
    S: number;
    soil: number;
    imp: number;
    dx: DcEqDir;
    dy: DcEqDir;
    masses: DcEqMass[];
    weakX: boolean;
    Ec: number;
  };
}

export interface DcLoadsResult {
  C: Record<string, DcLoadPoint[]>;
  info: DcLoadsInfo;
}

export interface DcComboDef {
  id: string;
  st: LimitStateType;
  p: 'max' | 'min' | 'IV' | 'one';
  gLL: number;
  ll: 'LLa' | 'LLb' | 'LLc' | null;
  TU: number;
  CS: number;
  wd?: 'n' | 'd';
  w?: { g: number; WL: number; WV?: number } | null;
  eq?: [number, number];
  wH?: number;
  ct?: 'n' | 'd';
  d: string;
}

export type DcFactorEntry = [string, number, '' | 'P' | 'E'];

export interface DcComboRow extends DcComboDef {
  f: DcFactorEntry[];
  tot: DcSecForces;
  perm: DcSecForces;
}

export interface DcPmGridInput {
  cells: Array<{ x: number; y: number; a: number }>;
  bars: Array<{ x: number; y: number; a: number }>;
  Ag: number;
  Ast: number;
}

export interface DcColSec extends DcPmGridInput {
  Ab: number;
  n: number;
  sp: number;
  Isx: number;
  Isy: number;
  B: number;
  Cc: number;
  R: number;
  dc: number;
  cs: number;
  inside: (x: number, y: number) => boolean;
}

export interface DcPmPoint {
  c: number;
  P: number;
  Mx: number;
  My: number;
  et: number;
  phi: number;
}

export interface DcPmTable {
  T: Array<{ al: number; pts: DcPmPoint[] }>;
  Pn0: number;
  Prmax: number;
  phiDB: number;
}

export interface DcPmCapResult {
  ok: boolean;
  over?: boolean;
  Pr: number;
  ratio: number;
  Mr: number;
  Mu?: number;
  c?: number;
  phi?: number;
  et?: number;
}

export interface DcPmCurvePoint {
  P: number;
  M: number;
  Pn: number;
  Mn: number;
}

export interface DcCapAaGirder {
  y: number;
  arm: number;
  DC: number;
  DW: number;
  dk: number;
}

export interface DcCapAaRow {
  id: string;
  st: LimitStateType;
  g: [number, number, number];
  V: number;
  M: number;
  N: number;
}

export interface DcCapAaResult {
  yA: number;
  hA: number;
  sw: { W: number; M: number };
  tai: { W: number; arm: number };
  gir: DcCapAaGirder[];
  best: { M: number; V: number; p: TrPlacementsResult['P'][number] } | null;
  DC: { V: number; M: number };
  DW: { V: number; M: number };
  LL: { V: number; M: number };
  PL: { V: number; M: number };
  rows: DcCapAaRow[];
  PLn: TrPlacementsResult;
}

export interface DcStmXBest {
  r: DcCapAaRow;
  Mu: number;
  Vu: number;
  a: number;
  thd: number;
  T: number;
  Tr: number;
  C: number;
  Pr: number;
  es: number;
  e1: number;
  fcu: number;
  ws: number;
  bs: number;
  Rb: number;
  Rn: number;
  ok: boolean;
  u: number;
}

export interface DcStmXResult {
  ok: boolean;
  need: boolean;
  off?: boolean;
  strict?: boolean;
  best?: DcStmXBest | null;
  rh?: number;
  rv?: number;
  raw?: boolean;
}

export interface DcStmBStrutRow {
  v: DcComboRow;
  i: number;
  R: number;
  ex: number;
  ey: number;
  thd: number;
  C: number;
  e1: number;
  fcu: number;
  Pr: number;
  Rn: number;
  ok: boolean;
  u: number;
}

export interface DcStmBResult {
  ok: boolean;
  need: boolean;
  off?: boolean;
  strict?: boolean;
  raw?: boolean;
}

export interface DcSfCapFigDescriptor {
  svId: string;
  m: { B: number; L: number; h: number; s1: number; s2: number; sName: string };
  c: { id: string; V: number; My: number; Mx: number };
  lab: [string, string, string];
}

export interface DcCalcResult {
  err?: string[];
  I: TrInput;
  Q: DcInput;
  G: DcGeomResult;
  M?: RcMaterialProps;
  LD?: DcLoadsResult;
  CB?: DcComboDef[];
  S1?: Record<string, DcSecForces>;
  S2?: Record<string, DcSecForces>;
  C1?: DcComboRow[];
  C2?: DcComboRow[];
  AA?: DcCapAaResult;
  MCR?: McrRuntimeState | null;
  capCheck?: RcSectionCheckWithOk | null;
  stmX?: DcStmXResult;
  capOK?: boolean;
  col?: { S: DcColSec; PT: DcPmTable; maxRatio: number; okPM: boolean };
  colOK?: boolean;
  footRcX?: RcSectionCheckWithOk | null;
  footRcY?: RcSectionCheckWithOk | null;
  footPunOk?: boolean;
  stmB?: DcStmBResult | null;
  beOK?: boolean;
  sfCapFig?: DcSfCapFigDescriptor | null;
}

export interface DcLinkEntry {
  id: string;
  v: [number, number, number, number, number, number];
}

export interface DcLinkData {
  CD: DcLinkEntry[];
  DB: DcLinkEntry[];
}

// ---------------------------------------------------------------------------
// 3. Core `DCT` Solver Namespace (TCVN 11823:2017 Solid Pier)
// ---------------------------------------------------------------------------

const gGravity = 9.81;
const PI = Math.PI;
const PI2 = Math.PI * Math.PI;
const gw = 9.81;

export const DC_PP = {
  max: { DC: 1.25, DW: 1.5, EV: 1.35 },
  min: { DC: 0.9, DW: 0.65, EV: 1.0 },
  IV: { DC: 1.5, DW: 1.5, EV: 1.35 },
  one: { DC: 1, DW: 1, EV: 1 },
} as const;

export function dcCapInt(
  G: Pick<DcGeomResult, 'hAt'>,
  _Q: DcInput,
  y1: number,
  y2: number,
  f: (y: number, h: number) => number,
  n = 200,
): number {
  let s = 0;
  const d = (y2 - y1) / n;
  for (let i = 0; i < n; i++) {
    const y = y1 + (i + 0.5) * d;
    s += f(y, G.hAt(y)) * d;
  }
  return s;
}

export function dcGeom(I: TrInput, Q: DcInput): DcGeomResult {
  const err: string[] = [];
  const hx = Q.H4 + Q.H5;
  const ELt = I.ELt;
  const ELcb = ELt - hx;
  const ELm = ELcb - (Q.H3 > 0 ? Q.H3 : 0);
  const ELtb = ELm - Q.H2;
  const ELbb = ELtb - Q.H1;

  const rnd = Q.nose !== 's';
  const Rn = rnd ? Q.C2 / 2 : 0;
  const a = Q.B2 - 2 * Rn;
  const Ath = Q.B2 * Q.C2 - (4 - PI) * Rn * Rn;
  const Beq = Ath / Q.C2;
  const Ix = rnd
    ? (Q.C2 * a ** 3) / 12 +
      2 * (((a / 2) ** 2 * PI * Rn * Rn) / 2 + (a * 2 * Rn ** 3) / 3 + (PI * Rn ** 4) / 8)
    : (Q.C2 * Q.B2 ** 3) / 12;
  const Iy = rnd ? (a * Q.C2 ** 3) / 12 + (PI * Rn ** 4) / 4 : (Q.B2 * Q.C2 ** 3) / 12;

  const Bu = Q.H3 > 0 ? Q.B3 + 2 * Q.B4 : 0;
  const Cu = Q.H3 > 0 ? Q.C3 + 2 * Q.C4 : 0;
  const Ru = rnd && Bu >= Cu ? Cu / 2 : 0;
  const Au = Bu * Cu - (4 - PI) * Ru * Ru;

  const nb = Math.max(1, Math.round(I.nb));
  const xg: number[] = [];
  for (let j = 0; j < nb; j++) xg.push((j - (nb - 1) / 2) * I.sg);

  const XF = XFmk({
    iL: I.icL,
    iR: I.icR,
    yc: I.icy,
    mode: I.ixm,
    mL: I.ixL,
    mR: I.ixR,
    gpl: I.gpl,
  });
  const HK = XF.hk(xg, Q.dkh);
  const zBr = ELt + I.hb - HK.m;
  const zGt = zBr + I.Hgd;
  const zDeck = zGt + I.hs;
  const zRoad = zDeck + I.Hsu;
  const ELs = I.ELg - I.hx;

  const hAt0 = (y: number): number => {
    const u = Math.abs(y);
    const yv = Q.B / 2 - Q.B5;
    if (u <= yv || Q.B5 <= 0) return hx;
    return Q.H5 + (Q.H4 * Math.max(0, Q.B / 2 - u)) / Q.B5;
  };
  const hAt = (y: number): number => Math.max(0.05, hAt0(y) - (XF ? XF.dM(y) : 0));

  if (!(Q.B > 0 && Q.C5 > 0 && hx > 0)) err.push('Kích thước xà mũ B, C5, H4 + H5 phải > 0');
  if (!(Q.B2 > 0 && Q.C2 > 0 && Q.H2 > 0)) err.push('Kích thước thân trụ B2, C2, H2 phải > 0');
  if (!(Q.B1 > 0 && Q.C1 > 0 && Q.H1 > 0)) err.push('Kích thước bệ B1, C1, H1 phải > 0');
  if (Q.B5 > Q.B / 2) err.push('Đoạn vát B5 phải ≤ B/2');
  if (Q.B2 > Q.B + 1e-9) err.push('Bề rộng thân trụ B2 lớn hơn chiều dài xà mũ B');
  if (Q.B2 > Q.B1 + 1e-9 || Q.C2 > Q.C1 + 1e-9) err.push('Thân trụ lớn hơn bệ');
  if (rnd && Q.B2 < Q.C2) err.push('Thân trụ đầu tròn: B2 phải ≥ C2');
  if (xg[0] < -Q.B / 2 || xg[nb - 1] > Q.B / 2) err.push('Gối dầm biên nằm ngoài xà mũ');
  if (I.Wd - I.bl - I.br2 <= 0) err.push('Bề rộng phần xe chạy ≤ 0');

  return {
    XF,
    HK,
    hAt0,
    err,
    hx,
    ELt,
    ELcb,
    ELm,
    ELtb,
    ELbb,
    rnd,
    Rn,
    a,
    Ath,
    Beq,
    Ix,
    Iy,
    Bu,
    Cu,
    Ru,
    Au,
    nb,
    xg,
    zBr,
    zGt,
    zDeck,
    zRoad,
    ELs,
    hAt,
  };
}

/** Seismic coefficient Cms per TCVN 11823-3 §9.6.1 & §9.6.2 (Eq. 19 & Eq. 21). */
export function dcCms(A: number, S: number, soil: number, T: number): number {
  if (T > 4) return (3 * A * S) / T ** (4 / 3);
  let c = Math.min((1.2 * A * S) / T ** (2 / 3), 2.5 * A);
  if (soil === 3 && A >= 0.3) c = Math.min(c, 2.0 * A);
  return c;
}

export function dcLoads(
  I: TrInput,
  Q: DcInput,
  G: DcGeomResult,
  M: RcMaterialProps,
): DcLoadsResult {
  const C: Record<string, DcLoadPoint[]> = {};
  const gc = I.gc;
  const Lt = (I.L1 + I.L2) / 2;
  const e = I.e;

  // Superstructure dead loads
  C.DCs = [
    { x: -e, y: 0, z: G.zBr, FZ: I.DC1, nm: 'Nhịp trái' },
    { x: e, y: 0, z: G.zBr, FZ: I.DC2, nm: 'Nhịp phải' },
  ];
  C.DW = [
    { x: -e, y: 0, z: G.zBr, FZ: I.DW1, nm: 'Nhịp trái' },
    { x: e, y: 0, z: G.zBr, FZ: I.DW2, nm: 'Nhịp phải' },
  ];

  // Pier self-weight
  const Vcap = Q.C5 * dcCapInt(G, Q, -Q.B / 2, Q.B / 2, (_y, h) => h);
  const zcap =
    Vcap > 0
      ? (Q.C5 *
          dcCapInt(G, Q, -Q.B / 2, Q.B / 2, (y, h) => h * (G.ELt - G.hAt0(y) + h / 2))) /
        Vcap
      : G.ELt;
  const Vtai = 2 * Q.B6 * Q.H6 * Q.C5;
  const Vdk = 2 * Q.dka * Q.dkb * G.HK.h.reduce((t, h) => t + h, 0);
  const Vth = G.Ath * Q.H2;
  const Vtu = G.Au * (Q.H3 > 0 ? Q.H3 : 0);
  const Vbe = Q.B1 * Q.C1 * Q.H1;

  const rawW: DcWeightPart[] = [
    { nm: 'Xà mũ', V: Vcap, z: zcap },
    { nm: 'Tường tai', V: Vtai, z: G.ELt + Q.H6 / 2 },
    { nm: 'Đá kê gối', V: Vdk, z: G.ELt + Q.dkh / 2 },
    { nm: 'Thân trụ (đoạn trên)', V: Vtu, z: G.ELcb - Q.H3 / 2 },
    { nm: 'Thân trụ', V: Vth, z: G.ELtb + Q.H2 / 2 },
    { nm: 'Bệ trụ', V: Vbe, z: G.ELbb + Q.H1 / 2 },
  ].filter((w) => w.V > 1e-9);

  const W: Array<Required<DcWeightPart>> = rawW.map((w) => ({
    ...w,
    P: gc * w.V,
  }));
  C.DCp = W.map((w) => ({ x: 0, y: 0, z: w.z, FZ: w.P, nm: w.nm }));

  // Vertical soil load on footing (EV with MNTN, EVH with MNCN)
  const hd = Math.max(0, I.ELg - G.ELtb);
  const Aev = Q.B1 * Q.C1 - G.Ath;
  const hwL = Math.max(0, Math.min(I.MNTN, I.ELg) - G.ELtb);
  const hwH = Math.max(0, Math.min(I.MNCN, I.ELg) - G.ELtb);
  const EV = Aev * (Q.gs * hd - gw * hwL);
  const EVH = Aev * (Q.gs * hd - gw * hwH);
  C.EV = EV > 0 ? [{ x: 0, y: 0, z: G.ELtb + hd / 2, FZ: EV, nm: 'Đất trên bệ' }] : [];
  C.EVH = EVH > 0 ? [{ x: 0, y: 0, z: G.ELtb + hd / 2, FZ: EVH, nm: 'Đất trên bệ' }] : [];

  // Buoyancy on submerged concrete at MNCN (H) & MNTN (L)
  const wet = (MN: number): DcWetPart[] => {
    const parts: DcWetPart[] = [];
    const seg = (nm: string, top: number, bot: number, A: number) => {
      const h = Math.max(0, Math.min(MN, top) - bot);
      if (h > 1e-9) parts.push({ nm, V: A * h, z: bot + h / 2 });
    };
    seg('Bệ trụ', G.ELtb, G.ELbb, Q.B1 * Q.C1);
    seg('Thân trụ', G.ELtb + Q.H2, G.ELtb, G.Ath);
    if (Q.H3 > 0) seg('Thân trụ (đoạn trên)', G.ELcb, G.ELm, G.Au);
    const Vc =
      Q.C5 *
      dcCapInt(G, Q, -Q.B / 2, Q.B / 2, (y, h) => {
        const bt = G.ELt - G.hAt0(y);
        return Math.max(0, Math.min(MN, bt + h) - bt);
      });
    if (Vc > 1e-9) {
      const zb = G.ELt - G.hx;
      parts.push({ nm: 'Xà mũ', V: Vc, z: zb + (Math.min(MN, G.ELt) - zb) / 2 });
    }
    return parts;
  };
  const wH = wet(I.MNCN);
  const wL = wet(I.MNTN);
  C.WBH = wH.map((p) => ({ x: 0, y: 0, z: p.z, FZ: -gw * p.V, nm: p.nm }));
  C.WBL = wL.map((p) => ({ x: 0, y: 0, z: p.z, FZ: -gw * p.V, nm: p.nm }));

  // Stream flow pressure (TCVN 11823-3 §7.3)
  const pD = 5.14e-4 * I.CD * I.Vw ** 2 * 1000;
  const pL = 5.14e-4 * TR.CL(I.thw) * I.Vw ** 2 * 1000;
  const bed = Math.max(I.ELg - I.hx, G.ELbb);
  const fl: DcFlowPart[] = [];
  const fseg = (nm: string, top: number, bot: number, wY: number, wX: number) => {
    const t = Math.min(I.MNCN, top);
    const b = Math.max(bed, bot);
    const h = t - b;
    if (h > 1e-9) fl.push({ nm, h, z: (t + b) / 2, FY: pD * wY * h, FX: pL * wX * h });
  };
  fseg('Bệ trụ', G.ELtb, G.ELbb, Q.C1, Q.B1);
  fseg('Thân trụ', G.ELtb + Q.H2, G.ELtb, Q.C2, Q.B2);
  if (Q.H3 > 0) fseg('Thân trụ (đoạn trên)', G.ELcb, G.ELm, G.Cu, G.Bu);
  fseg('Xà mũ', G.ELt, G.ELcb, Q.C5, Q.B);
  C.WA = fl.map((f) => ({ x: 0, y: 0, z: f.z, FX: f.FX, FY: f.FY, nm: f.nm }));

  // Wind loads (TCVN 11823-3 §8)
  const V = I.VB * I.S;
  const PD = TR.PD;
  const At1 = (I.Hgd + I.hs + I.Hsu + I.Hra) * Lt;
  const At2 = I.Hrl * Lt;
  const zs1 = G.zBr + (I.Hgd + I.hs + I.Hsu + I.Hra) / 2;
  const zs2 = G.zRoad + I.Hra + I.Hrl / 2;
  const low = Math.max(I.ELg, I.MNTN, G.ELtb);
  const Lw = Math.max(0, G.ELcb - low);
  const zw = low + Lw / 2;
  const zcp = G.ELt - G.hx / 2;

  const WSn: DcWindRow[] = [
    { nm: 'Kết cấu nhịp', At: At1, Cd: I.Cd1, z: zs1 },
    { nm: 'Lan can', At: At2, Cd: I.Cd2, z: zs2 },
    { nm: 'Xà mũ', At: G.hx * Q.C5, Cd: Q.Cpn, z: zcp },
    { nm: 'Thân trụ', At: Q.C2 * Lw, Cd: Q.Cpn, z: zw },
  ].map((r) => ({ ...r, F: PD(V, r.At, r.Cd) }));

  const WSd: DcWindRow[] = [
    {
      nm: 'Kết cấu nhịp (0,25 gió ngang)',
      At: At1 + At2,
      Cd: null as number | null,
      z: (WSn[0].F * zs1 + WSn[1].F * zs2) / Math.max(WSn[0].F + WSn[1].F, 1e-9),
      F: 0.25 * (WSn[0].F + WSn[1].F),
    },
    { nm: 'Xà mũ', At: Q.B * G.hx, Cd: Q.Cpd as number | null, z: zcp, F: 0 },
    { nm: 'Thân trụ', At: Q.B2 * Lw, Cd: Q.Cpd as number | null, z: zw, F: 0 },
  ].map((r) => (r.Cd == null ? r : { ...r, F: PD(V, r.At, r.Cd) }));

  C.WSn = WSn.filter((r) => r.F > 0).map((r) => ({ x: 0, y: 0, z: r.z, FY: r.F, nm: r.nm }));
  C.WSd = WSd.filter((r) => r.F > 0).map((r) => ({ x: 0, y: 0, z: r.z, FX: r.F, nm: r.nm }));

  const Av = I.Wd * Lt;
  const Pv = 0.00045 * V * V * Av;
  C.WV = [{ x: 0, y: -I.Wd / 4, z: G.zDeck, FZ: -Pv, nm: 'Gió thẳng đứng (hướng lên)' }];
  const zWL = G.zRoad + 1.8;
  C.WLn = [{ x: 0, y: 0, z: zWL, FY: 1.46 * Lt, nm: 'Gió ngang lên xe' }];
  C.WLd = [{ x: 0, y: 0, z: zWL, FX: 0.55 * Lt, FY: 0.5 * Lt, nm: 'Gió dọc lên xe (góc 60°)' }];

  // Live loads
  const LO = TR.llLong(I);
  const wr = I.Wd - I.bl - I.br2;
  const xr0 = -I.Wd / 2 + I.bl;
  let nL = Math.floor(wr / 3.6 + 1e-9);
  if (wr >= 6 && wr <= 7.2) nL = 2;
  nL = Math.max(1, nL);
  const wl = Math.min(wr / nL, 3.6);
  const PLt: [number, number] =
    I.wp > 0
      ? [((2 * 3 * (LO.Ls1 + LO.Ls2)) / 2) * I.wp, ((2 * 3 * LO.Ls2) / 2) * I.wp]
      : [0, 0];

  const llk: DcLiveLoadCase[] = [];
  for (let k = 1; k <= nL; k++) {
    const m = TR.mL(k);
    const yc = Math.abs(xr0 + ((k - 1) * wl) / 2 + 1.5);
    for (const cs of ['A', 'B'] as const) {
      const b = LO[cs].best;
      const R1 = k * m * b.R1 + (cs === 'A' ? PLt[0] / 2 : 0);
      const R2 = k * m * b.R2 + (cs === 'A' ? PLt[0] / 2 : PLt[1]);
      const N = R1 + R2;
      llk.push({
        k,
        m,
        cs,
        yc,
        R1,
        R2,
        N,
        Mx: k * m * (b.R1 + b.R2) * yc,
        My: (R2 - R1) * e,
        ax: k * m * LO[cs].axNoIM,
        BR: k * m * LO.BR1,
        nm: `${k} làn, ${cs === 'A' ? 'hai nhịp' : 'một nhịp phải'}`,
      });
    }
  }
  const pick = (f: (o: DcLiveLoadCase) => number) =>
    llk.reduce((p, q) => (f(q) > f(p) ? q : p));
  const LLa = pick((o) => o.N);
  const LLb = pick((o) => o.Mx);
  const LLc = pick((o) => o.My);
  const llPts = (o: DcLiveLoadCase): DcLoadPoint[] => [
    { x: -e, y: o.yc, z: G.zBr, FZ: o.R1, nm: 'Nhịp trái' },
    { x: e, y: o.yc, z: G.zBr, FZ: o.R2, nm: 'Nhịp phải' },
  ];
  C.LLa = llPts(LLa);
  C.LLb = llPts(LLb);
  C.LLc = llPts(LLc);

  const BRmax = llk.reduce((p, q) => Math.max(p, q.BR), 0) * (+I.brt ? 1 : 0);
  const zBR = G.zRoad + 1.8;
  C.BR = BRmax > 0 ? [{ x: 0, y: 0, z: zBR, FX: BRmax, nm: 'Lực hãm' }] : [];
  const vce = I.Vce / 3.6;
  const Cce = I.Rce > 0 ? (4 * vce * vce) / (3 * gGravity * I.Rce) : 0;
  const CE = Cce * llk.reduce((p, q) => Math.max(p, q.ax), 0);
  C.CE = CE > 0 ? [{ x: 0, y: 0, z: zBR, FY: CE, nm: 'Lực ly tâm' }] : [];

  // Temperature, creep & shrinkage
  const dT = Math.max(I.Tmax - I.Tlo, I.Thi - I.Tmin);
  const nbr = G.nb * Math.max(1, Math.round(I.nbg));
  const Ab = I.ga * I.gb2;
  const kb = (nbr * I.Gb * Ab) / Math.max(I.hrt, 1e-6);
  const FTU: [number, number] = [((I.al * dT * I.L1) / 2) * kb, ((I.al * dT * I.L2) / 2) * kb];
  const FCS: [number, number] = [
    ((I.ecs * 1e-6 * I.L1) / 2) * kb,
    ((I.ecs * 1e-6 * I.L2) / 2) * kb,
  ];
  const TUn0 = Math.abs(FTU[0] - FTU[1]);
  const CSn0 = Math.abs(FCS[0] - FCS[1]);
  const Lc = (I.Lct || 0) > 0 ? I.Lct : 0;
  const cont = Lc > 0 ? { Lc, dTU: I.al * dT * Lc, dCS: I.ecs * 1e-6 * Lc } : null;
  const TUn = cont ? 2 * kb * cont.dTU : TUn0;
  const CSn = cont ? 2 * kb * cont.dCS : CSn0;
  const capK =
    I.brt === 2
      ? (spV('sp_mupad') || 0.6) * ((I.DC1 || 0) + (I.DC2 || 0) + (I.DW1 || 0) + (I.DW2 || 0))
      : null;
  const TUk = capK != null ? Math.min(TUn, capK) : TUn;
  const CSk = capK != null ? Math.min(CSn, Math.max(0, capK - TUk)) : CSn;
  C.TU = TUk > 0 ? [{ x: 0, y: 0, z: G.zBr, FX: TUk, nm: 'Nhiệt độ' }] : [];
  C.CS = CSk > 0 ? [{ x: 0, y: 0, z: G.zBr, FX: CSk, nm: 'Co ngót, từ biến' }] : [];

  // Seismic single-mode spectral analysis
  const Ec = M.Ec * 1000;
  const Wsup = I.DC1 + I.DC2 + I.DW1 + I.DW2;
  const zsup = G.zBr + (I.Hgd + I.hs) / 2;
  const Hm = zsup - G.ELtb;
  const Wpart = (nm: string) => W.filter((w) => w.nm === nm).reduce((s, w) => s + w.P, 0);
  const Wcap = Wpart('Xà mũ') + Wpart('Tường tai') + Wpart('Đá kê gối');
  const Wth = Wpart('Thân trụ') + Wpart('Thân trụ (đoạn trên)');
  const Wbe = Wpart('Bệ trụ');
  const Weff = Wsup + Wcap + 0.25 * Wth;
  const soil = +I.soil || 3;
  const S = [1, 1.2, 1.5, 2.0][soil - 1];
  const imp = +Q.Rimp || 1;
  const Rc = [1.5, 2, 3][imp - 1];
  const Rw = [1.5, 1.5, 2][imp - 1];
  const weakX = Q.C2 <= Q.B2;
  const Rx = weakX ? Rc : Rw;
  const Ry = weakX ? Rw : Rc;
  const dir = (I0: number, R: number): DcEqDir => {
    const K = (3 * Ec * I0) / Hm ** 3;
    const T = 2 * PI * Math.sqrt(Weff / (gGravity * K));
    const c = dcCms(I.A, S, soil, T);
    return { I: I0, K, T, c, R, Rf: I.A > 0.19 ? 1 : Math.max(1, R / 2) };
  };
  const dx = dir(G.Iy, Rx);
  const dy = dir(G.Ix, Ry);
  const masses: DcEqMass[] = [
    { nm: 'Kết cấu nhịp', W: Wsup, z: zsup },
    { nm: 'Xà mũ, tường tai, đá kê', W: Wcap, z: zcap },
    { nm: 'Thân trụ', W: Wth, z: G.ELtb + (Q.H2 + (Q.H3 > 0 ? Q.H3 : 0)) / 2 },
    { nm: 'Bệ trụ', W: Wbe, z: G.ELbb + Q.H1 / 2, base: true },
  ];
  C.EQx = masses.map((m) => ({ x: 0, y: 0, z: m.z, FX: dx.c * m.W, nm: m.nm }));
  C.EQy = masses.map((m) => ({ x: 0, y: 0, z: m.z, FY: dy.c * m.W, nm: m.nm }));

  // Vehicle & vessel collision
  C.CTn = I.PCT > 0 ? [{ x: 0, y: 0, z: I.ELg + 1.2, FY: I.PCT, nm: 'Va xe ngang cầu' }] : [];
  C.CTd = I.PCT > 0 ? [{ x: 0, y: 0, z: I.ELg + 1.2, FX: I.PCT, nm: 'Va xe dọc cầu' }] : [];
  C.CVn = I.PCVn > 0 ? [{ x: 0, y: 0, z: I.zCV, FY: I.PCVn, nm: 'Va tàu ngang cầu' }] : [];
  C.CVd = I.PCVd > 0 ? [{ x: 0, y: 0, z: I.zCV, FX: I.PCVd, nm: 'Va tàu dọc cầu' }] : [];

  return {
    C,
    info: {
      W,
      Vcap,
      zcap,
      EV: { hd, Aev, EV, EVH, hwL, hwH },
      WB: { wH, wL },
      WA: { pD, pL, CL: TR.CL(I.thw), fl },
      WS: { V, Lt, At1, At2, zs1, zs2, Lw, low, WSn, WSd, Av, Pv, zWL },
      LL: { LO, nL, wl, llk, LLa, LLb, LLc, BRmax, zBR, Cce, CE, PLt },
      TU: { dT, nbr, Ab, kb, FTU, FCS, TUn: TUk, CSn: CSk, cont, cap: capK },
      EQ: { Wsup, Wcap, Wth, Wbe, Weff, zsup, Hm, S, soil, imp, dx, dy, masses, weakX, Ec },
    },
  };
}

const zeroSec = (): DcSecForces => ({ Hx: 0, Hy: 0, Hz: 0, Mx: 0, My: 0, Mz: 0 });
const addSec = (a: DcSecForces, b: DcSecForces, k: number): void => {
  for (const q of ['Hx', 'Hy', 'Hz', 'Mx', 'My', 'Mz'] as const) a[q] += k * (b[q] || 0);
};

export function dcCombos(I: TrInput, LD: DcLoadsResult): DcComboDef[] {
  const C = LD.C;
  const hasCT = C.CTn.length + C.CVn.length + C.CVd.length > 0;
  const gE = I.gEQ;
  const L: DcComboDef[] = [];

  const lls = (
    id: string,
    st: LimitStateType,
    gLL: number,
    TU: number,
    w: { g: number; WL: number; WV?: number } | null,
  ): DcComboDef[] =>
    (
      [
        {
          id: id + 'a',
          p: 'max',
          ll: 'LLa',
          wd: 'n',
          d: 'γp max ; hoạt tải cho lực dọc lớn nhất',
        },
        {
          id: id + 'b',
          p: 'min',
          ll: 'LLb',
          wd: 'n',
          d: 'γp min ; hoạt tải lệch tâm (Mx lớn nhất)',
        },
        {
          id: id + 'c',
          p: 'max',
          ll: 'LLc',
          wd: 'd',
          d: 'γp max ; hoạt tải một nhịp (My lớn nhất)',
        },
        {
          id: id + 'd',
          p: 'min',
          ll: 'LLc',
          wd: 'd',
          d: 'γp min ; hoạt tải một nhịp (My lớn nhất)',
        },
      ] as const
    ).map((v0) => ({ ...v0, st, gLL, TU, CS: TU, w }));

  lls('SD I', 'SD', 1, 1, { g: 0.3, WL: 1 })
    .slice(0, 3)
    .forEach((v0) => {
      v0.p = 'one';
      L.push(v0);
    });
  lls('CĐ I', 'CD', 1.75, 0.5, null).forEach((v0) => L.push(v0));

  (
    [
      { id: 'CĐ IIIa', p: 'max', wd: 'n', d: 'γp max ; gió ngang + gió thẳng đứng' },
      { id: 'CĐ IIIb', p: 'min', wd: 'n', d: 'γp min ; gió ngang + gió thẳng đứng' },
      { id: 'CĐ IIIc', p: 'max', wd: 'd', d: 'γp max ; gió dọc' },
      { id: 'CĐ IIId', p: 'min', wd: 'd', d: 'γp min ; gió dọc' },
    ] as const
  ).forEach((v0) =>
    L.push({
      ...v0,
      st: 'CD',
      gLL: 0,
      ll: null,
      TU: 0.5,
      CS: 0.5,
      w: { g: 1.4, WL: 0, WV: 1.4 },
    }),
  );

  L.push(
    {
      id: 'CĐ IVa',
      st: 'CD',
      p: 'IV',
      gLL: 0,
      ll: null,
      TU: 0.5,
      CS: 0.5,
      d: 'γp DC = 1,50',
    },
    {
      id: 'CĐ IVb',
      st: 'CD',
      p: 'min',
      gLL: 0,
      ll: null,
      TU: 0.5,
      CS: 0.5,
      d: 'γp min',
    },
  );
  lls('CĐ V', 'CD', 1.35, 0.5, { g: 0.4, WL: 1 }).forEach((v0) => L.push(v0));

  (
    [
      { id: 'ĐB Ia', eq: [1, 0.3] as [number, number], wH: 0, d: '1,0EQx + 0,3EQy ; MNTN' },
      { id: 'ĐB Ib', eq: [0.3, 1] as [number, number], wH: 0, d: '0,3EQx + 1,0EQy ; MNTN' },
      { id: 'ĐB Ic', eq: [1, 0.3] as [number, number], wH: 1, d: '1,0EQx + 0,3EQy ; MNCN' },
      { id: 'ĐB Id', eq: [0.3, 1] as [number, number], wH: 1, d: '0,3EQx + 1,0EQy ; MNCN' },
    ] as const
  ).forEach((v0) =>
    L.push({ ...v0, st: 'DB', p: 'one', gLL: gE, ll: 'LLa', TU: 0, CS: 0.5 }),
  );

  if (hasCT) {
    L.push(
      {
        id: 'ĐB IIa',
        st: 'DB',
        p: 'max',
        gLL: 0.5,
        ll: 'LLa',
        TU: 0,
        CS: 0.5,
        ct: 'n',
        d: 'va xe / va tàu ngang cầu ; γp max',
      },
      {
        id: 'ĐB IIb',
        st: 'DB',
        p: 'max',
        gLL: 0.5,
        ll: 'LLa',
        TU: 0,
        CS: 0.5,
        ct: 'd',
        d: 'va xe / va tàu dọc cầu ; γp max',
      },
      {
        id: 'ĐB IIc',
        st: 'DB',
        p: 'min',
        gLL: 0.5,
        ll: 'LLa',
        TU: 0,
        CS: 0.5,
        ct: 'n',
        d: 'va xe / va tàu ngang cầu ; γp min',
      },
      {
        id: 'ĐB IId',
        st: 'DB',
        p: 'min',
        gLL: 0.5,
        ll: 'LLa',
        TU: 0,
        CS: 0.5,
        ct: 'd',
        d: 'va xe / va tàu dọc cầu ; γp min',
      },
    );
  }

  L.forEach((v0) => {
    if (v0.ll == null) v0.ll = v0.gLL > 0 ? 'LLa' : null;
    if (v0.CS == null) v0.CS = v0.TU;
  });
  return L;
}

export function dcFactors(I: TrInput, v0: DcComboDef): DcFactorEntry[] {
  const e = v0.st === 'SD' ? 1 : I.eta;
  const gp = DC_PP[v0.p];
  const f: DcFactorEntry[] = [];
  const eP = v0.p === 'min' ? 1 / e : e;
  f.push(
    ['DCs', eP * gp.DC, 'P'],
    ['DCp', eP * gp.DC, 'P'],
    ['DW', eP * gp.DW, 'P'],
    [v0.p === 'min' || v0.wH ? 'EVH' : 'EV', eP * gp.EV, 'P'],
  );
  f.push([v0.p === 'min' || v0.wH ? 'WBH' : 'WBL', e, 'P'], ['WA', e, '']);
  if (v0.ll && v0.gLL > 0) {
    f.push([v0.ll, e * v0.gLL, ''], ['BR', e * v0.gLL, ''], ['CE', e * v0.gLL, '']);
  }
  if (v0.TU) f.push(['TU', e * v0.TU, '']);
  if (v0.CS) f.push(['CS', e * v0.CS, '']);
  if (v0.w) {
    if (v0.wd === 'n') {
      f.push(['WSn', e * v0.w.g, '']);
      if (v0.w.WL) f.push(['WLn', e * v0.w.WL, '']);
      if (v0.w.WV) f.push(['WV', e * v0.w.WV, '']);
    } else {
      f.push(['WSd', e * v0.w.g, '']);
      if (v0.w.WL) f.push(['WLd', e * v0.w.WL, '']);
    }
  }
  if (v0.eq) {
    f.push(['EQx', e * v0.eq[0], 'E'], ['EQy', e * v0.eq[1], 'E']);
  }
  if (v0.ct) {
    if (v0.ct === 'n') {
      f.push(['CTn', e, ''], ['CVn', e, '']);
    } else {
      f.push(['CTd', e, ''], ['CVd', e, '']);
    }
  }
  return f;
}

export function dcAtSec(
  LD: DcLoadsResult,
  z0: number,
  base: boolean,
): Record<string, DcSecForces> {
  const C = LD.C;
  const EQ = LD.info.EQ;
  const out: Record<string, DcSecForces> = {};
  for (const k of Object.keys(C)) {
    let arr = C[k];
    if (!base && (k === 'EV' || k === 'EVH')) arr = [];
    if (k === 'EQx' || k === 'EQy') {
      const d = k === 'EQx' ? EQ.dx : EQ.dy;
      const R = base ? d.Rf : d.R;
      arr = arr
        .filter((p) => base || !/^Bệ/.test(p.nm || ''))
        .map((p) => ({ ...p, FX: (p.FX || 0) / R, FY: (p.FY || 0) / R }));
    }
    out[k] = TR.resAt(arr as unknown as TrLoadPoint[], z0);
  }
  return out;
}

export function dcCombine(
  I: TrInput,
  CB: readonly DcComboDef[],
  S: Record<string, DcSecForces>,
): DcComboRow[] {
  return CB.map((v0) => {
    const tot = zeroSec();
    const perm = zeroSec();
    const f = dcFactors(I, v0);
    f.forEach(([k, gk, grp]) => {
      const r = S[k];
      if (!r) return;
      addSec(tot, r, gk);
      if (grp === 'P') addSec(perm, r, gk);
    });
    return { ...v0, f, tot, perm };
  });
}

export function dcColSec(Q: DcInput, G: DcGeomResult, _M?: RcMaterialProps): DcColSec {
  const B = Q.B2 * 1000;
  const Cc = Q.C2 * 1000;
  const R = G.Rn * 1000;
  const dc = Q.dc;
  const n = Math.max(4, Math.round(Q.nb));
  const Ab = (PI * Q.db * Q.db) / 4;

  const inside = (x: number, y: number): boolean => {
    const ax = Math.abs(x);
    const ay = Math.abs(y);
    if (ax > Cc / 2 || ay > B / 2) return false;
    if (R <= 0) return true;
    const yc = B / 2 - R;
    if (ay <= yc) return true;
    return (ay - yc) ** 2 + ax * ax <= R * R;
  };

  const cs = Math.max(20, Math.min(B, Cc) / 28);
  const cells: Array<{ x: number; y: number; a: number }> = [];
  for (let x = -Cc / 2 + cs / 2; x < Cc / 2; x += cs) {
    for (let y = -B / 2 + cs / 2; y < B / 2; y += cs) {
      if (inside(x, y)) cells.push({ x, y, a: cs * cs });
    }
  }
  const Ag = cells.reduce((s, c) => s + c.a, 0);
  const bars: Array<{ x: number; y: number; a: number }> = [];

  const ri = Math.max(0, R - dc);
  const ai = R > 0 ? B - 2 * R : B - 2 * dc;
  const ci = Cc - 2 * dc;

  const fin = (sp: number): DcColSec => {
    const Ast = bars.reduce((s, b) => s + b.a, 0);
    const Isx = bars.reduce((s, b) => s + b.a * b.y * b.y, 0);
    const Isy = bars.reduce((s, b) => s + b.a * b.x * b.x, 0);
    return { cells, bars, Ag, Ast, Ab, n, sp, Isx, Isy, B, Cc, R, dc, cs, inside };
  };

  if (R > 0) {
    const Lp = 2 * ai + 2 * PI * ri;
    for (let i = 0; i < n; i++) {
      let s = ((i + 0.5) * Lp) / n;
      let x = 0;
      let y = 0;
      if (s < ai) {
        x = ri;
        y = -ai / 2 + s;
      } else if ((s -= ai) < PI * ri) {
        const th = s / ri;
        x = ri * Math.cos(th);
        y = ai / 2 + ri * Math.sin(th);
      } else if ((s -= PI * ri) < ai) {
        x = -ri;
        y = ai / 2 - s;
      } else {
        s -= ai;
        const th = s / ri;
        x = -ri * Math.cos(th);
        y = -ai / 2 - ri * Math.sin(th);
      }
      bars.push({ x, y, a: Ab });
    }
    return fin(Lp / n);
  }

  const Lp = 2 * ai + 2 * ci;
  for (let i = 0; i < n; i++) {
    let s = (i * Lp) / n;
    let x = 0;
    let y = 0;
    if (s < ai) {
      x = ci / 2;
      y = -ai / 2 + s;
    } else if ((s -= ai) < ci) {
      x = ci / 2 - s;
      y = ai / 2;
    } else if ((s -= ci) < ai) {
      x = -ci / 2;
      y = ai / 2 - s;
    } else {
      s -= ai;
      x = -ci / 2 + s;
      y = -ai / 2;
    }
    bars.push({ x, y, a: Ab });
  }
  return fin(Lp / n);
}

/** 72-direction P-M interaction table for biaxial bending + axial compression. */
export function dcPmTable(S: DcPmGridInput, M: RcMaterialProps, phiDB: number): DcPmTable {
  const fc = M.fc;
  const fy = M.fy;
  const Es = M.Es;
  const b1 = M.b1;
  const out: Array<{ al: number; pts: DcPmPoint[] }> = [];
  const Pn0 = 0.85 * fc * (S.Ag - S.Ast) + fy * S.Ast;

  for (let k = 0; k < 72; k++) {
    const al = (k * 5 * PI) / 180;
    const ca = Math.cos(al);
    const sa = Math.sin(al);
    let pm = -1e18;
    S.cells.forEach((c) => {
      const p = c.x * ca + c.y * sa;
      if (p > pm) pm = p;
    });
    const dbar = S.bars.map((b) => pm - (b.x * ca + b.y * sa));
    const dt = Math.max(...dbar);
    const hmax = pm - Math.min(...S.cells.map((c) => c.x * ca + c.y * sa));
    const pts: DcPmPoint[] = [];

    const at = (c: number): DcPmPoint => {
      const a = Math.min(b1 * c, hmax);
      let P = 0;
      let Mx = 0;
      let My = 0;
      S.cells.forEach((q) => {
        const d = pm - (q.x * ca + q.y * sa);
        if (d <= a) {
          const F = 0.85 * fc * q.a;
          P += F;
          Mx += F * q.y;
          My += F * q.x;
        }
      });
      S.bars.forEach((b, i) => {
        const d = dbar[i];
        const es = (0.003 * (c - d)) / c;
        let s = Math.max(-fy, Math.min(fy, Es * es));
        if (d <= a) s -= 0.85 * fc;
        const F = s * b.a;
        P += F;
        Mx += F * b.y;
        My += F * b.x;
      });
      const et = (0.003 * (dt - c)) / c;
      const phi = Math.max(
        0.75,
        Math.min(0.9, 0.75 + (0.15 * (et - M.ecl)) / (M.etl - M.ecl)),
      );
      return { c, P: P / 1e3, Mx: Mx / 1e6, My: My / 1e6, et, phi };
    };

    const cs: number[] = [];
    for (let i = 0; i <= 70; i++) cs.push(hmax * Math.pow(10, -2.3 + i * (3.3 / 70)));
    cs.forEach((c) => pts.push(at(c)));
    out.push({ al, pts });
  }

  return { T: out, Pn0, Prmax: (0.8 * Pn0) / 1e3, phiDB };
}

export function dcPmCap(
  PT: DcPmTable,
  Pu: number,
  Mux: number,
  Muy: number,
  st: LimitStateType,
): DcPmCapResult {
  const ph = (p: DcPmPoint) => (st === 'DB' ? PT.phiDB : p.phi);
  const cand: Array<{ Mx: number; My: number; c: number; phi: number; et: number }> = [];
  const Pr = (st === 'DB' ? PT.phiDB : 0.75) * PT.Prmax;
  if (Pu > Pr) return { ok: false, over: true, Pr, ratio: Infinity, Mr: 0 };

  for (const t of PT.T) {
    const P = t.pts;
    let found: { Mx: number; My: number; c: number; phi: number; et: number } | null = null;
    for (let i = 0; i + 1 < P.length; i++) {
      const a = ph(P[i]) * P[i].P;
      const b = ph(P[i + 1]) * P[i + 1].P;
      if ((a - Pu) * (b - Pu) <= 0 && a !== b) {
        const r = (Pu - a) / (b - a);
        const f = (q: DcPmPoint): [number, number] => [ph(q) * q.Mx, ph(q) * q.My];
        const A = f(P[i]);
        const B = f(P[i + 1]);
        found = {
          Mx: A[0] + r * (B[0] - A[0]),
          My: A[1] + r * (B[1] - A[1]),
          c: P[i].c + r * (P[i + 1].c - P[i].c),
          phi: ph(P[i]) + r * (ph(P[i + 1]) - ph(P[i])),
          et: P[i].et + r * (P[i + 1].et - P[i].et),
        };
        break;
      }
    }
    if (found) cand.push(found);
  }

  if (!cand.length) return { ok: false, ratio: Infinity, Mr: 0, Pr };
  const Mu = Math.hypot(Mux, Muy);
  if (Mu < 1e-9) {
    const m = cand.reduce((p, q) => (Math.hypot(q.Mx, q.My) < Math.hypot(p.Mx, p.My) ? q : p));
    return {
      ok: true,
      ratio: 0,
      Mr: Math.hypot(m.Mx, m.My),
      Mu: 0,
      c: m.c,
      phi: m.phi,
      et: m.et,
      Pr,
    };
  }

  const bt = Math.atan2(Muy, Mux);
  let best: { M: number; c: number; phi: number; et: number } | null = null;
  for (let i = 0; i < cand.length; i++) {
    const A = cand[i];
    const B = cand[(i + 1) % cand.length];
    const a1 = Math.atan2(A.My, A.Mx);
    const a2 = Math.atan2(B.My, B.Mx);
    let d = a2 - a1;
    while (d > PI) d -= 2 * PI;
    while (d < -PI) d += 2 * PI;
    let t = bt - a1;
    while (t > PI) t -= 2 * PI;
    while (t < -PI) t += 2 * PI;
    if (Math.abs(d) > 1e-12 && t / d >= -1e-9 && t / d <= 1 + 1e-9) {
      const r = t / d;
      const Mx = A.Mx + r * (B.Mx - A.Mx);
      const My = A.My + r * (B.My - A.My);
      const M = Math.hypot(Mx, My);
      if (!best || M < best.M) {
        best = {
          M,
          c: A.c + r * (B.c - A.c),
          phi: A.phi + r * (B.phi - A.phi),
          et: A.et + r * (B.et - A.et),
        };
      }
    }
  }

  if (!best) {
    const m = cand.reduce((p, q) =>
      Math.abs(Math.atan2(q.My, q.Mx) - bt) < Math.abs(Math.atan2(p.My, p.Mx) - bt) ? q : p,
    );
    best = { M: Math.hypot(m.Mx, m.My), c: m.c, phi: m.phi, et: m.et };
  }

  return {
    ok: best.M >= Mu,
    ratio: Mu / best.M,
    Mr: best.M,
    Mu,
    c: best.c,
    phi: best.phi,
    et: best.et,
    Pr,
  };
}

export function dcPmCurve(
  PT: DcPmTable,
  k: number,
  st: LimitStateType,
  comp?: 'Mx' | 'My',
): DcPmCurvePoint[] {
  const ph = (p: DcPmPoint) => (st === 'DB' ? PT.phiDB : p.phi);
  const t = PT.T[k];
  const Pr = (st === 'DB' ? PT.phiDB : 0.75) * PT.Prmax;
  const c: 'Mx' | 'My' = comp || (k === 18 ? 'Mx' : 'My');
  return t.pts.map((p) => ({
    P: Math.min(ph(p) * p.P, Pr),
    M: ph(p) * p[c],
    Pn: p.P,
    Mn: p[c],
  }));
}

export function dcCapAA(
  I: TrInput,
  Q: DcInput,
  G: DcGeomResult,
  LD: DcLoadsResult,
): DcCapAaResult {
  const yA = G.Beq / 2;
  const side = G.xg.filter((y) => y > yA + 1e-9);
  const gc = I.gc;
  const nb = G.nb;
  const LO = LD.info.LL.LO;

  const swR = {
    W: gc * Q.C5 * dcCapInt(G, Q, yA, Q.B / 2, (_y, h) => h),
    M: gc * Q.C5 * dcCapInt(G, Q, yA, Q.B / 2, (y, h) => h * (y - yA)),
  };
  const swL = {
    W: gc * Q.C5 * dcCapInt(G, Q, -Q.B / 2, -yA, (_y, h) => h),
    M: gc * Q.C5 * dcCapInt(G, Q, -Q.B / 2, -yA, (y, h) => h * (-y - yA)),
  };
  const sw = swL.M > swR.M ? swL : swR;
  const tai =
    Q.B6 > 0 && Q.H6 > 0
      ? { W: gc * Q.B6 * Q.H6 * Q.C5, arm: Q.B / 2 - Q.B6 / 2 - yA }
      : { W: 0, arm: 0 };

  const dkj = (y: number): number => {
    const j = G.xg.findIndex((val) => Math.abs(val - y) < 1e-6);
    return gc * 2 * Q.dka * Q.dkb * (j >= 0 ? G.HK.h[j] : Q.dkh);
  };

  const S1 = SUPDIST(G.xg, {
    Wd: I.Wd,
    bl: I.bl,
    br: I.br2,
    wp: I.wp,
    DC: I.DC1,
    DCe: I.DCe1,
    DCs: I.DCs1,
    DW: I.DW1,
  });
  const S2 = SUPDIST(G.xg, {
    Wd: I.Wd,
    bl: I.bl,
    br: I.br2,
    wp: I.wp,
    DC: I.DC2,
    DCe: I.DCe2,
    DCs: I.DCs2,
    DW: I.DW2,
  });

  const jOf = (y: number) => G.xg.findIndex((val) => Math.abs(val - y) < 1e-6);
  const sd = (y: number): [number, number] => {
    const a = jOf(y);
    const b = jOf(-y);
    const f = (j: number) => (j >= 0 ? S1.dc[j] + S2.dc[j] : 0);
    const gFn = (j: number) => (j >= 0 ? S1.dw[j] + S2.dw[j] : 0);
    return f(a) + gFn(a) >= f(b) + gFn(b) ? [f(a), gFn(a)] : [f(b), gFn(b)];
  };

  const gir: DcCapAaGirder[] = side.map((y) => {
    const q = sd(y);
    return { y, arm: y - yA, DC: q[0], DW: q[1], dk: Math.max(dkj(y), dkj(-y)) };
  });

  const PL = TR.placements(I, { nb, xg: G.xg }, LO);
  let best: { M: number; V: number; p: TrPlacementsResult['P'][number] } | null = null;
  PL.P.forEach((p) => {
    let Ml = 0;
    let Vl = 0;
    G.xg.forEach((y, j) => {
      if (y > yA + 1e-9) {
        Ml += p.gA[j] * (y - yA);
        Vl += p.gA[j];
      }
    });
    let Mr = 0;
    let Vr = 0;
    G.xg.forEach((y, j) => {
      if (-y > yA + 1e-9) {
        Mr += p.gA[j] * (-y - yA);
        Vr += p.gA[j];
      }
    });
    const o = Mr > Ml ? { M: Mr, V: Vr } : { M: Ml, V: Vl };
    if (!best || o.M > best.M) best = { ...o, p };
  });

  let PLM = 0;
  let PLV = 0;
  if (I.wp > 0) {
    G.xg.forEach((y, j) => {
      if (y > yA + 1e-9) {
        PLM += PL.PLA[j] * (y - yA);
        PLV += PL.PLA[j];
      }
    });
  }

  const DC = {
    V: sw.W + tai.W + gir.reduce((s, q) => s + q.DC + q.dk, 0),
    M: sw.M + tai.W * tai.arm + gir.reduce((s, q) => s + (q.DC + q.dk) * q.arm, 0),
  };
  const DW = {
    V: gir.reduce((s, q) => s + q.DW, 0),
    M: gir.reduce((s, q) => s + q.DW * q.arm, 0),
  };
  const LL = {
    V: best ? (best as { V: number; M: number }).V : 0,
    M: best ? (best as { V: number; M: number }).M : 0,
  };
  const PLr = { V: PLV, M: PLM };

  const e = I.eta;
  const CB: ReadonlyArray<{ id: string; st: LimitStateType; g: [number, number, number] }> = [
    { id: 'SD I', st: 'SD', g: [1, 1, 1] },
    { id: 'CĐ I', st: 'CD', g: [1.25 * e, 1.5 * e, 1.75 * e] },
    { id: 'CĐ IV', st: 'CD', g: [1.5 * e, 1.5 * e, 0] },
    { id: 'CĐ V', st: 'CD', g: [1.25 * e, 1.5 * e, 1.35 * e] },
  ];

  const rows: DcCapAaRow[] = CB.map((c) => ({
    id: c.id,
    st: c.st,
    g: c.g,
    V: c.g[0] * DC.V + c.g[1] * DW.V + c.g[2] * (LL.V + PLr.V),
    M: -(c.g[0] * DC.M + c.g[1] * DW.M + c.g[2] * (LL.M + PLr.M)),
    N: 0,
  }));

  return {
    yA,
    hA: Math.min(G.hAt(yA), G.hAt(-yA)),
    sw,
    tai,
    gir,
    best,
    DC,
    DW,
    LL,
    PL: PLr,
    rows,
    PLn: PL,
  };
}

export function dcCalc(I: TrInput, Q: DcInput): DcCalcResult {
  const G = dcGeom(I, Q);
  if (G.err.length) return { err: G.err, G, I, Q };
  const M = TR.mat(I);
  const LD = dcLoads(I, Q, G, M);
  const CB = dcCombos(I, LD);
  const S1 = dcAtSec(LD, G.ELtb, false);
  const S2 = dcAtSec(LD, G.ELbb, true);
  const C1 = dcCombine(I, CB, S1);
  const C2 = dcCombine(I, CB, S2);
  const AA = dcCapAA(I, Q, G, LD);
  return { I, Q, G, M, LD, CB, S1, S2, C1, C2, AA };
}

export const DCT = {
  geom: dcGeom,
  loads: dcLoads,
  combos: dcCombos,
  factors: dcFactors,
  atSec: dcAtSec,
  combine: dcCombine,
  colSec: dcColSec,
  pmTable: dcPmTable,
  pmCap: dcPmCap,
  pmCurve: dcPmCurve,
  capAA: dcCapAA,
  calc: dcCalc,
  Cms: dcCms,
  capInt: dcCapInt,
  PP: DC_PP,
} as const;

// ---------------------------------------------------------------------------
// 4. Runtime State & Input/Visibility Helpers
// ---------------------------------------------------------------------------

let latestDcResult: DcCalcResult | null = null;
let latestDcLink: DcLinkData | null = null;
let latestDcSfdResult: SfRenderResult | null = null;

export function getLatestDcResult(): DcCalcResult | null {
  return latestDcResult;
}

export function setLatestDcResult(r: DcCalcResult | null): void {
  latestDcResult = r;
}

export function getLatestDcLink(): DcLinkData | null {
  return latestDcLink;
}

export function setLatestDcLink(link: DcLinkData | null): void {
  latestDcLink = link;
}

export function getLatestDcSfdResult(): SfRenderResult | null {
  return latestDcSfdResult;
}

export function dcOn(): boolean {
  const a = $('tq_kn');
  const b = $('tq_tru');
  return !!(a && b && a.value === 'n' && b.value === 'dac');
}

export const DC_STR: Readonly<Record<string, 1>> = {
  fnd: 1,
  nose: 1,
  Rimp: 1,
  stmx: 1,
  stmb: 1,
};

export function dcInputs(): DcInput {
  const Q: Record<string, number | string> = {};
  for (const [k, defVal] of Object.entries(DT_DEFAULTS)) {
    const id = 'dt_' + k;
    Q[k] = DC_STR[k] ? v(id, defVal) : num(id, parseFloat(defVal));
  }
  if (typeof document !== 'undefined') {
    document.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[id^="dt_"]').forEach((e) => {
      if (!/^(INPUT|SELECT)$/.test(e.tagName)) return;
      const k = e.id.slice(3);
      Q[k] = DC_STR[k] ? e.value : num(e.id);
    });
  }
  return Q as DcInput;
}

export const dcF = (val: number | null | undefined, d = 2): string =>
  val == null || !isFinite(val) ? '-' : fx(val, d);

export const dcOK = (ok: boolean, t?: string): string =>
  `<td class="c ${ok ? 'ok' : 'bad'}">${t || (ok ? 'OK' : 'NG')}</td>`;

export const dcT = (head: readonly string[], rows: readonly string[]): string =>
  '<tr>' + head.map((h) => `<th>${h}</th>`).join('') + '</tr>' + rows.join('');

export type DcCell = string | number | { h: string };

export const dcRow = (cells: readonly DcCell[]): string =>
  '<tr>' +
  cells
    .map((c, i) =>
      typeof c === 'object' && c !== null && c.h != null
        ? c.h
        : `<td${i === 0 ? ' class="l"' : ''}>${c}</td>`,
    )
    .join('') +
  '</tr>';

export const DCN: Readonly<Record<string, readonly [string, string]>> = {
  DCs: ['Trọng lượng kết cấu nhịp', 'DC'],
  DW: ['Lớp phủ mặt cầu, tiện ích', 'DW'],
  DCp: ['Trọng lượng bản thân trụ', 'DC'],
  EV: ['Áp lực đất thẳng đứng trên bệ - MNTN', 'EV'],
  EVH: ['Áp lực đất thẳng đứng trên bệ - MNCN', 'EV'],
  WBL: ['Đẩy nổi - MNTN', 'WA'],
  WBH: ['Đẩy nổi - MNCN', 'WA'],
  WA: ['Áp lực dòng chảy (MNCN)', 'WA'],
  LLa: ['Hoạt tải - trường hợp a (lực dọc lớn nhất)', 'LL+IM'],
  LLb: ['Hoạt tải - trường hợp b (lệch tâm, Mx lớn nhất)', 'LL+IM'],
  LLc: ['Hoạt tải - trường hợp c (một nhịp, My lớn nhất)', 'LL+IM'],
  BR: ['Lực hãm xe', 'BR'],
  CE: ['Lực ly tâm', 'CE'],
  WSn: ['Gió ngang lên kết cấu', 'WS'],
  WSd: ['Gió dọc lên kết cấu', 'WS'],
  WV: ['Gió thẳng đứng (hướng lên)', 'WS'],
  WLn: ['Gió ngang lên xe', 'WL'],
  WLd: ['Gió dọc lên xe', 'WL'],
  TU: ['Nhiệt độ đều', 'TU'],
  CS: ['Co ngót, từ biến', 'CR+SH'],
  EQx: ['Động đất dọc cầu', 'EQ'],
  EQy: ['Động đất ngang cầu', 'EQ'],
  CTn: ['Va xe ngang cầu', 'CT'],
  CTd: ['Va xe dọc cầu', 'CT'],
  CVn: ['Va tàu ngang cầu', 'CV'],
  CVd: ['Va tàu dọc cầu', 'CV'],
};

const gw9 = (V: number): number => 9.81 * V;

export function dcVis(): void {
  const on = dcOn();
  if (typeof document !== 'undefined') {
    document.body?.classList?.toggle('hasdc', on);
  }
  try {
    sfVis(undefined, dcOn);
  } catch {
    // ignore headless visibility error
  }
  if (typeof document !== 'undefined') {
    document.querySelectorAll<HTMLElement>('[id^="tdo_"]').forEach((e) => {
      e.style.display = on ? 'none' : '';
    });
    document.querySelectorAll<HTMLElement>('[id^="dc_"]').forEach((e) => {
      if (e.tagName === 'DIV') e.style.display = on ? '' : 'none';
    });
  }
}

// ---------------------------------------------------------------------------
// 5. Renderers & Diagrams (tab20, Elevation, tab46 Cap, tab47 Column)
// ---------------------------------------------------------------------------

export function dcRender20(R: DcCalcResult): void {
  const I = R.I;
  const G = R.G;
  const LD = R.LD;
  if (!LD || !R.S1 || !R.S2 || !R.C1 || !R.C2) return;
  const inf = LD.info;
  const e = I.e;

  set(
    'tbDcDC',
    dcT(
      [
        'Hạng mục',
        'Hz nhịp trái (kN)',
        'x (m)',
        'My (kN.m)',
        'Hz nhịp phải (kN)',
        'x (m)',
        'My (kN.m)',
      ],
      (
        [
          ['Tĩnh tải kết cấu nhịp DC', I.DC1, I.DC2],
          ['Lớp phủ, tiện ích DW', I.DW1, I.DW2],
        ] as const
      ).map((r) =>
        dcRow([
          r[0],
          dcF(r[1]),
          dcF(-e, 3),
          dcF(-r[1] * e),
          dcF(r[2]),
          dcF(e, 3),
          dcF(r[2] * e),
        ]),
      ),
    ),
  );

  set(
    'tbDcW',
    dcT(
      ['Bộ phận', 'Thể tích (m3)', 'γc (kN/m3)', 'Trọng lượng (kN)', 'Cao độ trọng tâm (m)'],
      inf.W.map((w) => dcRow([w.nm, dcF(w.V, 3), dcF(I.gc, 2), dcF(w.P), dcF(w.z, 3)])).concat([
        dcRow([
          '<b>Tổng cộng</b>',
          dcF(
            inf.W.reduce((s, w) => s + w.V, 0),
            3,
          ),
          '',
          `<b>${dcF(inf.W.reduce((s, w) => s + w.P, 0))}</b>`,
          '',
        ]),
      ]),
    ),
  );

  set(
    'tbDcWs',
    dcT(
      ['Bộ phận', 'Mặt cắt đỉnh bệ Fv (kN)', 'Mặt cắt đáy bệ Fv (kN)'],
      inf.W.map((w) => dcRow([w.nm, w.z > G.ELtb ? dcF(w.P) : '-', dcF(w.P)])).concat([
        dcRow(['<b>Tổng cộng</b>', `<b>${dcF(R.S1.DCp.Hz)}</b>`, `<b>${dcF(R.S2.DCp.Hz)}</b>`]),
      ]),
    ),
  );

  const LL = inf.LL;
  const LO = LL.LO;
  set(
    'tbDcLLc',
    dcT(
      [
        'Phản lực một làn xe lên trụ',
        'Hai nhịp: nhịp trái R1 (kN)',
        'Hai nhịp: nhịp phải R2 (kN)',
        'Một nhịp: R2 (kN)',
      ],
      LO.A.cand
        .map((c, i) => {
          const b = LO.B.cand[i];
          return dcRow([c.nm, dcF(c.R1), dcF(c.R2), b ? dcF(b.R2) : '-']);
        })
        .concat([
          dcRow([
            '<b>Giá trị quyết định (đã gồm IM cho xe)</b>',
            `<b>${dcF(LO.A.best.R1)}</b>`,
            `<b>${dcF(LO.A.best.R2)}</b>`,
            `<b>${dcF(LO.B.best.R2)}</b>`,
          ]),
        ]),
    ),
  );

  set(
    'tbDcLL',
    dcT(
      ['Trường hợp xếp xe', 'm', 'Lệch tâm y (m)', 'N (kN)', 'Mx (kN.m)', 'My (kN.m)', 'Dùng cho'],
      LL.llk.map((o) =>
        dcRow([
          o.nm,
          dcF(o.m, 2),
          dcF(o.yc, 3),
          dcF(o.N),
          dcF(o.Mx),
          dcF(o.My),
          [o === LL.LLa ? 'a' : '', o === LL.LLb ? 'b' : '', o === LL.LLc ? 'c' : '']
            .filter(Boolean)
            .join(', ') || '-',
        ]),
      ),
    ),
  );

  set(
    'tbDcBR',
    dcT(
      ['Thông số', 'Giá trị'],
      [
        dcRow([
          'Lực hãm một làn: max(25% xe tải ; 25% xe hai trục ; 5%(xe tải + làn) ; 5%(xe hai trục + làn)) (kN)',
          dcF(LO.BR1),
        ]),
        dcRow(['Lực hãm tổng BR = max(k.m.BR1) (kN)', dcF(LL.BRmax)]),
        dcRow(['Cao độ điểm đặt (1,8 m trên mặt đường) (m)', dcF(LL.zBR, 3)]),
      ],
    ),
  );
  set('o_dt_CE', dcF(LL.CE));

  const wb = inf.WB;
  set(
    'tbDcWA',
    dcT(
      ['Bộ phận ngập nước', 'V (MNCN) (m3)', 'WA (MNCN) (kN)', 'V (MNTN) (m3)', 'WA (MNTN) (kN)'],
      [...new Set([...wb.wH, ...wb.wL].map((p) => p.nm))].map((n) => {
        const a = wb.wH.find((p) => p.nm === n);
        const b = wb.wL.find((p) => p.nm === n);
        return dcRow([
          n,
          a ? dcF(a.V, 3) : '-',
          a ? dcF(-gw9(a.V)) : '-',
          b ? dcF(b.V, 3) : '-',
          b ? dcF(-gw9(b.V)) : '-',
        ]);
      }),
    ) +
      dcT(
        [
          'Áp lực dòng chảy (V = ' + dcF(I.Vw, 2) + ' m/s)',
          'Chiều cao ngập (m)',
          'Hy = p.CD (kN)',
          'Hx = p.CL (kN)',
          'z (m)',
        ],
        inf.WA.fl.map((f) => dcRow([f.nm, dcF(f.h, 3), dcF(f.FY), dcF(f.FX), dcF(f.z, 3)])),
      ),
  );

  set(
    'tbDcEV',
    dcT(
      ['Thông số', 'Giá trị'],
      [
        dcRow(['Chiều cao đất từ đỉnh bệ đến mặt đất tự nhiên hd (m)', dcF(inf.EV.hd, 3)]),
        dcRow(['Diện tích đất trên bệ (m2)', dcF(inf.EV.Aev, 3)]),
        dcRow([
          'Chiều dày đất dưới MNTN / dưới MNCN (m)',
          dcF(inf.EV.hwL, 3) + ' / ' + dcF(inf.EV.hwH, 3),
        ]),
        dcRow(['EV = A.(γs.hd - γw.hw), MNTN (kN)', dcF(inf.EV.EV)]),
        dcRow(['EV = A.(γs.hd - γw.hw), MNCN (kN)', dcF(inf.EV.EVH)]),
      ],
    ),
  );

  const ws = inf.WS;
  const rowW = (r: DcWindRow): string => {
    const F = r.F;
    const m1 = F * (r.z - G.ELtb);
    const m2 = F * (r.z - G.ELbb);
    return dcRow([
      r.nm,
      dcF(r.At, 3),
      r.Cd != null ? dcF(r.Cd, 3) : '-',
      r.Cd != null ? dcF(1.8 * r.At) : '-',
      r.Cd != null ? dcF(0.0006 * ws.V ** 2 * r.At * r.Cd) : '-',
      dcF(F),
      dcF(r.z, 3),
      dcF(m1),
      dcF(m2),
    ]);
  };
  const hW = [
    'Bộ phận',
    'At (m2)',
    'Cd',
    '1,8At',
    '0,0006V²AtCd',
    'PD (kN)',
    'z (m)',
    'M đỉnh bệ (kN.m)',
    'M đáy bệ (kN.m)',
  ];
  set(
    'tbDcWSn',
    dcT(
      hW,
      ws.WSn.map((r) => rowW(r)),
    ),
  );
  set(
    'tbDcWSd',
    dcT(
      hW,
      ws.WSd.map((r) => rowW(r)),
    ),
  );
  set(
    'tbDcWV',
    dcT(
      ['Diện tích mặt cầu Av (m2)', 'Pv = 0,00045V²Av (kN)', 'Vị trí y (m)', 'Mx (kN.m)'],
      [dcRow([dcF(ws.Av, 2), dcF(ws.Pv), dcF(-I.Wd / 4, 3), dcF((ws.Pv * I.Wd) / 4)])],
    ),
  );
  set(
    'tbDcWL',
    dcT(
      ['Trường hợp', 'Hx (kN)', 'Hy (kN)', 'z (m)', 'My đáy bệ (kN.m)', 'Mx đáy bệ (kN.m)'],
      (
        [
          ['Gió ngang lên xe (1,46 kN/m)', 0, 1.46 * ws.Lt],
          ['Gió dọc lên xe, góc 60° (0,55 ; 0,50 kN/m)', 0.55 * ws.Lt, 0.5 * ws.Lt],
        ] as const
      ).map((r) =>
        dcRow([
          r[0],
          dcF(r[1]),
          dcF(r[2]),
          dcF(ws.zWL, 3),
          dcF(r[1] * (ws.zWL - G.ELbb)),
          dcF(r[2] * (ws.zWL - G.ELbb)),
        ]),
      ),
    ),
  );

  const tu = inf.TU;
  set(
    'tbDcTU',
    dcT(
      ['Thông số', 'Nhịp trái', 'Nhịp phải', 'Lực truyền vào trụ (kN)'],
      [
        dcRow(['Độ cứng gối một đầu nhịp k = n.G.A/hrt (kN/m)', dcF(tu.kb, 1), dcF(tu.kb, 1), '']),
        dcRow([
          `Nhiệt độ ΔT = ${dcF(tu.dT, 1)}°C: F = k.α.ΔT.L/2 (kN)`,
          dcF(tu.FTU[0]),
          dcF(tu.FTU[1]),
          tu.cont ? '-' : dcF(tu.TUn),
        ]),
        dcRow([
          'Co ngót, từ biến: F = k.εcs.L/2 (kN)',
          dcF(tu.FCS[0]),
          dcF(tu.FCS[1]),
          tu.cont ? '-' : dcF(tu.CSn),
        ]),
      ]
        .concat(
          tu.cont
            ? [
                dcRow([
                  `Nhịp nối liên tục nhiệt qua trụ, điểm cố định cách tim trụ Lct = ${dcF(tu.cont.Lc, 2)} m: Δ = α.ΔT.Lct = ${dcF(tu.cont.dTU * 1000, 2)} mm ; F = 2k.Δ (gối hai đầu nhịp trên trụ chuyển vị cùng chiều)`,
                  '',
                  '',
                  dcF(tu.TUn),
                ]),
                dcRow([
                  `Co ngót, từ biến: Δ = εcs.Lct = ${dcF(tu.cont.dCS * 1000, 2)} mm ; F = 2k.Δ`,
                  '',
                  '',
                  dcF(tu.CSn),
                ]),
              ]
            : [],
        )
        .concat(
          tu.cap != null
            ? [
                dcRow([
                  `Dầm kê trực tiếp qua lớp đệm: lực ngang vào trụ không lớn hơn lực ma sát μđ.(DC + DW) = ${dcF(tu.cap, 2)} kN`,
                  '',
                  '',
                  dcF(tu.cap),
                ]),
              ]
            : [],
        ),
    ),
  );

  const q = inf.EQ;
  const dr = (d: DcEqDir, lab: string) =>
    dcRow([
      lab,
      dcF(d.I, 4),
      dcF(q.Hm, 3),
      dcF(d.K, 0),
      dcF(d.T, 3),
      dcF(d.c, 4),
      dcF(d.R, 2),
      dcF(d.Rf, 2),
    ]);
  set(
    'tbDcEQ',
    dcT(
      [
        'Phương',
        'I (m4)',
        'H (m)',
        'K = 3EcI/H³ (kN/m)',
        'Tm (s)',
        'Cms',
        'R (thân trụ)',
        'R/2 ≥ 1 (móng)',
      ],
      [dr(q.dx, 'Dọc cầu'), dr(q.dy, 'Ngang cầu')],
    ) +
      `<tr><td class="l" colspan="8">Tải trọng tham gia dao động W = KCN + xà mũ + 0,25.thân trụ = ${dcF(q.Weff)} kN ; A = ${dcF(I.A, 3)} ; S = ${dcF(q.S, 2)} ; Tm = 2π√(W/(gK)). Cms theo PT 19 cho dạng dao động cơ bản (≤ 2,5A; đất loại III và A ≥ 0,30: ≤ 2,0A), PT 21 khi Tm > 4 s (Điều 9.6.1, 9.6.2). Móng: R/2 ≥ 1,0 với vùng động đất 2 (Điều 9.9.3); R = 1,0 với vùng 3, 4 (Điều 9.9.4.2).</td></tr>` +
      (I.A > 0.19
        ? `<tr><td class="l bad" colspan="8">Vùng động đất ${I.A > 0.29 ? 4 : 3} (A > 0,19): lực thiết kế mỗi bộ phận lấy giá trị nhỏ hơn của lực điều chỉnh (Điều 9.9.4.2) và lực khớp dẻo (Điều 9.9.4.3); bảng tính dùng lực điều chỉnh. Các yêu cầu cấu tạo, lực cắt vùng đầu cột của Điều 10.11.4 Phần 5 phải kiểm toán bổ sung.</td></tr>`
        : ''),
  );

  set(
    'tbDcEQF',
    dcT(
      [
        'Khối lượng',
        'W (kN)',
        'z (m)',
        'Hx = Cms.W (kN)',
        'Hy = Cms.W (kN)',
        'Hx đỉnh bệ (÷R)',
        'Hy đỉnh bệ (÷R)',
        'Hx đáy bệ (÷R/2)',
        'Hy đáy bệ (÷R/2)',
      ],
      q.masses.map((m) =>
        dcRow([
          m.nm,
          dcF(m.W),
          dcF(m.z, 3),
          dcF(q.dx.c * m.W),
          dcF(q.dy.c * m.W),
          m.base ? '-' : dcF((q.dx.c * m.W) / q.dx.R),
          m.base ? '-' : dcF((q.dy.c * m.W) / q.dy.R),
          dcF((q.dx.c * m.W) / q.dx.Rf),
          dcF((q.dy.c * m.W) / q.dy.Rf),
        ]),
      ),
    ),
  );

  const keys = Object.keys(DCN).filter(
    (k) => R.S2![k] && (['Hx', 'Hy', 'Hz', 'Mx', 'My'] as const).some((c) => Math.abs(R.S2![k][c]) > 1e-6),
  );
  const tbS = (S: Record<string, DcSecForces>): string =>
    dcT(
      ['Tải trọng', 'Ký hiệu', 'Hx (kN)', 'Hy (kN)', 'Hz (kN)', 'Mx (kN.m)', 'My (kN.m)'],
      keys.map((k) => {
        const r = S[k];
        return dcRow([DCN[k][0], DCN[k][1], dcF(r.Hx), dcF(r.Hy), dcF(r.Hz), dcF(r.Mx), dcF(r.My)]);
      }),
    );
  set('tbDcR1', tbS(R.S1));
  set('tbDcR2', tbS(R.S2));

  const gk = (v0: DcComboRow, keyset: readonly string[]): string => {
    const f = v0.f.find((x) => keyset.includes(x[0]));
    return f ? dcF(f[1], 2) : '-';
  };
  set(
    'tbDcCmb',
    dcT(
      [
        'Tổ hợp',
        'DC',
        'DW',
        'EV',
        'LL, IM, BR, CE',
        'WA',
        'WS',
        'WL',
        'TU',
        'CR, SH',
        'EQ',
        'CT, CV',
        'Ghi chú',
      ],
      R.C2.map((v0) =>
        dcRow([
          v0.id,
          gk(v0, ['DCs']),
          gk(v0, ['DW']),
          gk(v0, ['EV']),
          v0.ll && v0.gLL > 0
            ? dcF(v0.f.find((x) => x[0] === v0.ll)?.[1], 2) + ' (' + v0.ll.slice(2) + ')'
            : '-',
          gk(v0, ['WA']),
          gk(v0, ['WSn', 'WSd']),
          gk(v0, ['WLn', 'WLd']),
          gk(v0, ['TU']),
          gk(v0, ['CS']),
          v0.eq ? dcF(v0.eq[0], 1) + 'x ; ' + dcF(v0.eq[1], 1) + 'y' : '-',
          gk(v0, ['CTn', 'CTd']),
          { h: `<td class="l small">${v0.d || ''}</td>` },
        ]),
      ),
    ),
  );

  const tbC = (C: readonly DcComboRow[]): string =>
    dcT(
      ['TTGH', 'Tổ hợp', 'Hx (kN)', 'Hy (kN)', 'Hz (kN)', 'Mx (kN.m)', 'My (kN.m)'],
      C.map((v0) => {
        const o = v0.tot;
        return dcRow([STN[v0.st], v0.id, dcF(o.Hx), dcF(o.Hy), dcF(o.Hz), dcF(o.Mx), dcF(o.My)]);
      }),
    );
  set('tbDcC1', tbC(R.C1));
  set('tbDcC2', tbC(R.C2));
}

export function dcPiles(): Array<{ x: number; y: number }> {
  let xy: Array<{ x: number; y: number }> = [];
  withCtx('P_', () => {
    const t = $('mc_xy');
    if (t) {
      xy = nums(t.value)
        .filter((a) => a.length >= 2)
        .map((a) => ({ x: a[0], y: a[1] }));
    }
  });
  return xy;
}

export function dcFigEl(R: DcCalcResult): void {
  const sv = $('dgDcEl');
  if (!sv) return;
  const I = R.I;
  const Q = R.Q;
  const G = R.G;
  const id = 'DcEl';
  const d = dgKit(id);
  const W = 760;
  const top = G.zRoad + I.Hra + I.Hrl + 0.3;
  const bot = G.ELbb - 1.2;
  const span = Math.max(I.Wd, Q.B, Q.B1) + 1.0;
  const k = Math.min(430 / span, 500 / (top - bot));
  const cx = (Q.B6 > 0 && Q.H6 > 0 ? 72 : 40) + (span * k) / 2;
  const X = (y: number) => cx + y * k;
  const Y = (z: number) => 36 + (top - z) * k;

  const ngb = Math.max(1, Math.round(I.nbg || 1));
  const dgb = I.sg / ngb;
  const gOff: number[] = [];
  for (let q = 0; q < ngb; q++) gOff.push((q - (ngb - 1) / 2) * dgb);

  const fake = {
    I,
    G: {
      zBr: G.zBr,
      nb: G.nb,
      xg: G.xg,
      gOff,
      dgb,
      XF: G.XF,
      ELt: G.ELt,
      tg: Math.max(0.02, I.hb - Q.dkh),
      dkw: Q.dkb,
    },
  };
  trDrawSuper(d, X, Y, k, fake as unknown as TrCalcResult, id);

  const cap: Array<[number, number]> = [];
  const ctop: Array<[number, number]> = [];
  for (let i = 0; i <= 40; i++) {
    const y = -Q.B / 2 + (Q.B * i) / 40;
    cap.push([X(y), Y(G.ELt - G.hAt0(y))]);
    ctop.push([X(y), Y(G.ELt - G.XF.dM(y))]);
  }
  d.poly([...ctop, ...cap.reverse()], '#e8edf2');

  const TAI = Q.B6 > 0 && Q.H6 > 0;
  if (TAI) {
    (
      [
        [-Q.B / 2, -Q.B / 2 + Q.B6],
        [Q.B / 2 - Q.B6, Q.B / 2],
      ] as const
    ).forEach(([a, b], j) => {
      d.poly(
        [
          [X(a), Y(G.ELt - G.XF.dM(a))],
          [X(b), Y(G.ELt - G.XF.dM(b))],
          [X(b), Y(G.ELt + Q.H6)],
          [X(a), Y(G.ELt + Q.H6)],
        ],
        '#d5dde5',
      );
      if (j === 0) {
        const xm = X((a + b) / 2);
        const ym = Y(G.ELt + Q.H6 * 0.6);
        d.L(xm, ym, X(a) - 24, ym - 14);
        d.T(X(a) - 26, ym - 18, 'Tường tai', 'end', 'class="s"');
        d.T(X(a) - 26, ym - 4, 'B6 = ' + fx(Q.B6 * 1000, 0), 'end', 'class="s"');
      }
    });
  }
  if (TAI) d.dimV(X(Q.B / 2) + 14, Y(G.ELt + Q.H6), Y(G.ELt), 'H6 = ' + fx(Q.H6 * 1000, 0), 1);

  d.poly(
    [
      [X(-Q.B2 / 2), Y(G.ELcb)],
      [X(Q.B2 / 2), Y(G.ELcb)],
      [X(Q.B2 / 2), Y(G.ELtb)],
      [X(-Q.B2 / 2), Y(G.ELtb)],
    ],
    '#eef2f6',
  );
  d.poly(
    [
      [X(-Q.B1 / 2), Y(G.ELtb)],
      [X(Q.B1 / 2), Y(G.ELtb)],
      [X(Q.B1 / 2), Y(G.ELbb)],
      [X(-Q.B1 / 2), Y(G.ELbb)],
    ],
    '#e8edf2',
  );

  const xa = X(-span / 2);
  const xb = X(span / 2);
  d.L(xa, Y(I.ELg), xb, Y(I.ELg), 't');
  (
    [
      [I.MNCN, 'MNCN'],
      [I.MNTN, 'MNTN'],
    ] as const
  ).forEach(([z]) => {
    if (z > bot && z < top) {
      d.s += `<line x1="${xa}" y1="${Y(z).toFixed(1)}" x2="${xb}" y2="${Y(z).toFixed(1)}" stroke="#2a6db0" stroke-width="1" stroke-dasharray="8,3"/>`;
    }
  });

  const piles = sfdOn(dcOn) ? [] : dcPiles();
  if (!piles.length) {
    const xa2 = X(-Q.B1 / 2) - 10;
    const xb2 = X(Q.B1 / 2) + 10;
    for (let xh = xa2; xh < xb2; xh += 12) d.L(xh, Y(G.ELbb) + 10, xh + 8, Y(G.ELbb) + 2);
  }
  [...new Set(piles.map((p) => p.y))].forEach((y) => {
    d.poly(
      [
        [X(y - 0.5), Y(G.ELbb)],
        [X(y + 0.5), Y(G.ELbb)],
        [X(y + 0.5), Y(bot + 0.2)],
        [X(y - 0.5), Y(bot + 0.2)],
      ],
      '#f4f4f4',
    );
    d.L(X(y), Y(G.ELbb) + 2, X(y), Y(bot + 0.2), 'c');
  });

  const labs: Array<[number, string]> = [
    [G.zRoad, 'Mặt đường'],
    [G.ELt, 'Đỉnh xà mũ'],
    [G.ELcb, 'Đáy xà mũ'],
    [G.ELtb, 'Đỉnh bệ'],
    [G.ELbb, 'Đáy bệ'],
    [I.ELg, 'MĐTN'],
  ];
  if (I.MNCN > bot) labs.push([I.MNCN, 'MNCN']);
  if (I.MNTN > bot) labs.push([I.MNTN, 'MNTN']);
  labs.sort((a, b) => b[0] - a[0]);
  let ly = -1e9;
  const xx = xb + 6;
  labs.forEach(([z, t2]) => {
    const yy = Math.max(Y(z), ly + 14);
    ly = yy;
    d.L(xx - 6, Y(z), xx + 4, Y(z));
    d.L(xx + 4, Y(z), xx + 10, yy);
    d.T(xx + 12, yy + 4, t2 + ' ' + fx(z, 3), 'start', 'class="s"');
  });

  d.dimH(
    X(-Q.B / 2),
    X(Q.B / 2),
    Y(G.ELt) - (G.zBr - G.ELt) * k - (I.Hgd + I.hs + I.Hsu + I.Hra + I.Hrl) * k - 14,
    'B = ' + fx(Q.B * 1000, 0),
  );
  d.dimH(X(-Q.B2 / 2), X(Q.B2 / 2), Y((G.ELcb + G.ELtb) / 2), 'B2 = ' + fx(Q.B2 * 1000, 0));
  d.dimH(X(-Q.B1 / 2), X(Q.B1 / 2), Y(G.ELbb) + 16, 'B1 = ' + fx(Q.B1 * 1000, 0));
  d.dimV(X(-Q.B / 2) - 14, Y(G.ELt), Y(G.ELt - Q.H5), 'H5', -1);
  if (Q.H4 > 0) d.dimV(X(-Q.B / 2 + Q.B5) - 14, Y(G.ELt - Q.H5), Y(G.ELcb), 'H4', -1);
  d.dimV(X(-Q.B1 / 2) - 14, Y(G.ELcb), Y(G.ELtb), 'H2 = ' + fx(Q.H2 * 1000, 0), -1);
  d.dimV(X(-Q.B1 / 2) - 14, Y(G.ELtb), Y(G.ELbb), 'H1 = ' + fx(Q.H1 * 1000, 0), -1);
  d.T(X(0), Y(bot) + 18, 'MẶT CHÍNH TRỤ (ngang cầu)', 'middle', 'style="font-weight:bold"');

  // Side view (longitudinal)
  const k2 = Math.min(k, 150 / Math.max(Q.C1, Q.C5));
  const cx2 = W - 110;
  const X2 = (x: number) => cx2 + x * k2;
  const Y2 = (z: number) => 36 + (top - z) * k;

  d.poly(
    [
      [X2(-Q.C5 / 2), Y2(G.ELt)],
      [X2(Q.C5 / 2), Y2(G.ELt)],
      [X2(Q.C5 / 2), Y2(G.ELcb)],
      [X2(-Q.C5 / 2), Y2(G.ELcb)],
    ],
    '#e8edf2',
  );
  d.poly(
    [
      [X2(-Q.C2 / 2), Y2(G.ELcb)],
      [X2(Q.C2 / 2), Y2(G.ELcb)],
      [X2(Q.C2 / 2), Y2(G.ELtb)],
      [X2(-Q.C2 / 2), Y2(G.ELtb)],
    ],
    '#eef2f6',
  );
  d.poly(
    [
      [X2(-Q.C1 / 2), Y2(G.ELtb)],
      [X2(Q.C1 / 2), Y2(G.ELtb)],
      [X2(Q.C1 / 2), Y2(G.ELbb)],
      [X2(-Q.C1 / 2), Y2(G.ELbb)],
    ],
    '#e8edf2',
  );
  [...new Set(piles.map((p) => p.x))].forEach((x) =>
    d.poly(
      [
        [X2(x - 0.5), Y2(G.ELbb)],
        [X2(x + 0.5), Y2(G.ELbb)],
        [X2(x + 0.5), Y2(bot + 0.2)],
        [X2(x - 0.5), Y2(bot + 0.2)],
      ],
      '#f4f4f4',
    ),
  );
  if (TAI) {
    d.poly(
      [
        [X2(-Q.C5 / 2), Y2(G.ELt + Q.H6)],
        [X2(Q.C5 / 2), Y2(G.ELt + Q.H6)],
        [X2(Q.C5 / 2), Y2(G.ELt)],
        [X2(-Q.C5 / 2), Y2(G.ELt)],
      ],
      '#d5dde5',
    );
    d.T(X2(0), Y2(G.ELt + Q.H6 / 2) + 4, 'Tường tai', 'middle', 'class="s"');
  }
  d.dimH(
    X2(-Q.C5 / 2),
    X2(Q.C5 / 2),
    Y2(TAI ? G.ELt + Q.H6 : G.ELt) - 10,
    'C5 = ' + fx(Q.C5 * 1000, 0),
  );
  d.dimH(X2(-Q.C2 / 2), X2(Q.C2 / 2), Y2((G.ELcb + G.ELtb) / 2), 'C2');
  d.dimH(X2(-Q.C1 / 2), X2(Q.C1 / 2), Y2(G.ELbb) + 16, 'C1 = ' + fx(Q.C1 * 1000, 0));
  d.T(cx2, Y(bot) + 18, 'MẶT BÊN (dọc cầu)', 'middle', 'style="font-weight:bold"');
  dgPut(sv as unknown as SVGElement, W, Y(bot) + 30, d.s, id);
}

export function dcFigAA(R: DcCalcResult): void {
  const sv = $('dgDxAA');
  const A = R.AA;
  if (!sv || !A) return;
  const Q = R.Q;
  const G = R.G;
  const id = 'DxAA';
  const d = dgKit(id);
  const W = 760;
  const k = Math.min(560 / (Q.B / 2 + 0.5), 220 / (G.hx + 1.2));
  const X = (y: number) => 80 + (y + 0.3) * k;
  const Y = (z: number) => 60 + (G.ELt + 0.6 - z) * k;

  const cap: Array<[number, number]> = [];
  const ctop: Array<[number, number]> = [[X(-0.3), Y(G.ELt - G.XF.dM(-0.3))]];
  for (let i = 0; i <= 40; i++) {
    const y = ((Q.B / 2) * i) / 40;
    cap.push([X(y), Y(G.ELt - G.hAt0(y))]);
    ctop.push([X(y), Y(G.ELt - G.XF.dM(y))]);
  }
  d.poly([...ctop, ...cap.reverse(), [X(-0.3), Y(G.ELcb)]], '#e8edf2');
  d.poly(
    [
      [X(-0.3), Y(G.ELcb)],
      [X(Q.B2 / 2), Y(G.ELcb)],
      [X(Q.B2 / 2), Y(G.ELcb - 0.8)],
      [X(-0.3), Y(G.ELcb - 0.8)],
    ],
    '#eef2f6',
  );
  d.L(X(0), Y(G.ELt + 0.5), X(0), Y(G.ELcb - 0.9), 'c');
  d.T(X(0) + 4, Y(G.ELt + 0.5) - 4, 'Tim trụ', 'start');
  d.s += `<line x1="${X(A.yA)}" y1="${Y(G.ELt) - 20}" x2="${X(A.yA)}" y2="${Y(G.ELcb) + 20}" stroke="#c00" stroke-width="1.6" stroke-dasharray="6,3"/>`;
  d.T(X(A.yA), Y(G.ELt) - 24, 'A', 'middle', 'style="fill:#c00;font-weight:bold"');
  d.T(X(A.yA), Y(G.ELcb) + 34, 'A', 'middle', 'style="fill:#c00;font-weight:bold"');
  G.xg
    .filter((y) => y >= 0)
    .forEach((y) => {
      d.s += `<rect x="${(X(y) - 0.15 * k).toFixed(1)}" y="${(Y(G.ELt) - Q.dkh * k - 3).toFixed(1)}" width="${(0.3 * k).toFixed(1)}" height="${(Q.dkh * k + 3).toFixed(1)}" fill="#555"/>`;
      if (y > A.yA) {
        d.A(X(y), Y(G.ELt) - 46, X(y), Y(G.ELt) - 8);
        d.T(X(y), Y(G.ELt) - 50, 'P (y = ' + fx(y, 2) + ')', 'middle', 'class="s"');
      }
    });
  d.dimH(X(0), X(A.yA), Y(G.ELcb) + 50, 'yA = ' + fx(A.yA * 1000, 0));
  d.dimH(X(A.yA), X(Q.B / 2), Y(G.ELcb) + 50, fx((Q.B / 2 - A.yA) * 1000, 0));
  d.dimV(X(A.yA) + 10, Y(G.ELt - G.XF.dM(A.yA)), Y(G.ELcb), 'hA = ' + fx(A.hA * 1000, 0));
  d.T(
    W / 2,
    Y(G.ELcb - 0.9) + 10,
    `Bề rộng tương đương thân trụ Beq = Ath/C2 = ${fx(G.Beq, 3)} m`,
    'middle',
    'class="s"',
  );
  dgPut(sv as unknown as SVGElement, W, Y(G.ELcb - 0.9) + 24, d.s, id);
}

export function dcRender46(R: DcCalcResult): void {
  const Q = R.Q;
  const G = R.G;
  const A = R.AA;
  if (!A || !R.M) return;

  set('o_dt_yA', dcF(A.yA, 3));
  set('o_dt_hA', dcF(A.hA, 3));
  const gA = A.best ? A.best.p.gA : null;

  set(
    'tbDxG',
    dcT(
      [
        'Gối dưới dầm',
        'y (m)',
        'Cánh tay đòn tới A-A (m)',
        'DC (kN)',
        'Đá kê (kN)',
        'DW (kN)',
        'LL+IM (kN)',
      ],
      A.gir.map((q) => {
        const j = G.xg.findIndex((y) => Math.abs(y - q.y) < 1e-6);
        const jm = G.xg.findIndex((y) => Math.abs(y + q.y) < 1e-6);
        const ll = gA ? Math.max(gA[j] || 0, gA[jm] || 0) : 0;
        return dcRow([
          'Dầm tại y = ' + dcF(q.y, 2),
          dcF(q.y, 3),
          dcF(q.arm, 3),
          dcF(q.DC),
          dcF(q.dk),
          dcF(q.DW),
          dcF(ll),
        ]);
      }),
    ),
  );

  const L: Array<[string, string, number, number]> = (
    [
      ['Trọng lượng bản thân đầu hẫng xà mũ', 'DC', A.sw.W, A.sw.M],
      ['Tường tai', 'DC', A.tai.W, A.tai.W * A.tai.arm],
      [
        'Kết cấu nhịp + đá kê',
        'DC',
        A.gir.reduce((s, q) => s + q.DC + q.dk, 0),
        A.gir.reduce((s, q) => s + (q.DC + q.dk) * q.arm, 0),
      ],
      ['Lớp phủ, tiện ích', 'DW', A.DW.V, A.DW.M],
      ['Hoạt tải xe + làn (đòn bẩy, bất lợi nhất)', 'LL+IM', A.LL.V, A.LL.M],
      ['Người đi bộ', 'PL', A.PL.V, A.PL.M],
    ] as Array<[string, string, number, number]>
  ).filter((r) => Math.abs(r[2]) > 1e-6);

  set(
    'tbDxF',
    dcT(
      ['Tải trọng', 'Ký hiệu', 'V (kN)', 'M (kN.m)'],
      L.map((r) => dcRow([r[0], r[1], dcF(r[2]), dcF(r[3])])),
    ) +
      dcT(
        ['Tổ hợp', 'γDC', 'γDW', 'γLL', 'Vu (kN)', 'Mu (kN.m)'],
        A.rows.map((r) =>
          dcRow([r.id, dcF(r.g[0], 2), dcF(r.g[1], 2), dcF(r.g[2], 2), dcF(r.V), dcF(r.M)]),
        ),
      ),
  );

  dcFigAA(R);
  const S = rcSec('dx', Q.C5 * 1000, A.hA * 1000);
  const posEl = $('o_rcdxpos');
  if (posEl) {
    posEl.textContent = `Mặt cắt A-A tại mép thân trụ, cách tim trụ ${fx(A.yA, 3)} m ; h = ${fx(A.hA * 1000, 0)} mm ; b = C5 = ${fx(Q.C5 * 1000, 0)} mm`;
  }
  const loads: RcLoadInput[] = A.rows.map((r) => ({ id: r.id, st: r.st, M: r.M, V: r.V, N: 0 }));
  const out = rcRender('dx', S, R.M, loads, 'Lớp dưới', 'Lớp trên');
  R.capCheck = out;

  const a = A.gir.length ? A.gir[A.gir.length - 1].arm : 0;
  const dv = out && out.gV ? out.gV.sh.dv / 1000 : 0.9 * A.hA;
  const deep = a > 0 && a < 2 * dv;
  try {
    dcSTMx(R, deep);
  } catch (err) {
    console.error(err);
  }
  R.capOK = (out ? out.ok : false) && (!R.stmX || R.stmX.ok);

  const kl = $('o_dc_kl46');
  if (kl) {
    kl.className = 'kl ' + (R.capOK ? 'ok' : 'bad');
    kl.innerHTML =
      'KẾT LUẬN: ' +
      (R.capOK
        ? 'Xà mũ ĐẠT YÊU CẦU về sức kháng uốn, cốt thép tối thiểu, khống chế nứt, sức kháng cắt tại mặt cắt A-A' +
          (R.stmX && R.stmX.need && R.stmX.strict ? ' và theo mô hình chống - giằng.' : '.')
        : 'Xà mũ KHÔNG ĐẠT - xem các hạng mục NG ở trên.') +
      (deep && Q.stmx !== 'none'
        ? ` <span class="small">Khoảng cách từ gối dầm ngoài cùng đến mặt cắt A-A (${fx(a, 3)} m) nhỏ hơn 2dv (${fx(2 * dv, 3)} m): đầu hẫng là cấu kiện cao, kết quả mô hình chống - giằng ở mục 3.</span>`
        : '');
  }
}

export function dcFigSec(_R: DcCalcResult, S: DcColSec): void {
  const sv = $('dgDtSec');
  if (!sv) return;
  const id = 'DtSc';
  const d = dgKit(id);
  const W = 760;
  const k = Math.min(600 / S.B, 220 / S.Cc);
  const X = (y: number) => W / 2 + y * k;
  const Y = (x: number) => 150 - x * k;
  const P: Array<[number, number]> = [];
  const n = 60;
  if (S.R > 0) {
    const yc = S.B / 2 - S.R;
    for (let i = 0; i <= n; i++) {
      const t = -Math.PI / 2 + (Math.PI * i) / n;
      P.push([yc + S.R * Math.cos(t), S.R * Math.sin(t)]);
    }
    for (let i = 0; i <= n; i++) {
      const t = Math.PI / 2 + (Math.PI * i) / n;
      P.push([-yc + S.R * Math.cos(t), S.R * Math.sin(t)]);
    }
  } else {
    P.push(
      [S.B / 2, -S.Cc / 2],
      [S.B / 2, S.Cc / 2],
      [-S.B / 2, S.Cc / 2],
      [-S.B / 2, -S.Cc / 2],
    );
  }
  d.poly(
    P.map(([y, x]) => [X(y), Y(x)]),
    '#eef2f6',
  );
  S.bars.forEach((b) => {
    d.s += `<circle cx="${X(b.y).toFixed(1)}" cy="${Y(b.x).toFixed(1)}" r="${Math.max(2, Math.sqrt(b.a / Math.PI) * k).toFixed(1)}" fill="#c00"/>`;
  });
  d.dimH(X(-S.B / 2), X(S.B / 2), Y(S.Cc / 2) - 14, 'B2 = ' + fx(S.B, 0));
  d.dimV(X(S.B / 2) + 14, Y(S.Cc / 2), Y(-S.Cc / 2), 'C2 = ' + fx(S.Cc, 0));
  d.L(X(-S.B / 2) - 20, Y(0), X(S.B / 2) + 40, Y(0), 'c');
  d.L(X(0), Y(S.Cc / 2) + 30, X(0), Y(-S.Cc / 2) - 20, 'c');
  d.T(X(S.B / 2) + 46, Y(0) + 4, 'y (ngang cầu)', 'start', 'class="s"');
  d.T(X(0) + 4, Y(-S.Cc / 2) - 24, 'x (dọc cầu)', 'start', 'class="s"');
  d.T(
    W / 2,
    Y(-S.Cc / 2) + 40,
    `${S.n} thanh φ${Math.sqrt((S.Ab * 4) / Math.PI).toFixed(0)}, khoảng cách ${fx(S.sp, 0)} mm, dc = ${fx(S.dc, 0)} mm`,
    'middle',
    'class="s"',
  );
  dgPut(sv as unknown as SVGElement, W, Y(-S.Cc / 2) + 56, d.s, id);
}

interface DcColumnRowDiag {
  v: DcComboRow;
  o: DcSecForces;
  Mux: number;
  Muy: number;
}

export function dcFigPM(
  svid: string,
  PT: DcPmTable,
  k: number,
  rows: readonly DcColumnRowDiag[],
  key: 'Mux' | 'Muy',
  title: string,
): void {
  const sv = $(svid);
  if (!sv) return;
  const id = svid.slice(2);
  const d = dgKit(id);
  const W = 760;
  const H = 380;
  const cp: 'Mx' | 'My' = k === 18 ? 'Mx' : 'My';
  const cd = dcPmCurve(PT, k, 'CD', cp);
  const cn = PT.T[k].pts.map((p) => ({ P: p.P, M: p[cp] }));
  const ck = dcPmCurve(PT, (k + 36) % 72, 'CD', cp);
  const Pmax = Math.max(...cn.map((p) => p.P));
  const Pmin = Math.min(...cn.map((p) => p.P));
  const Mm =
    Math.max(...cn.map((p) => Math.abs(p.M)), ...rows.map((r) => Math.abs(r[key]))) * 1.05 || 1;
  const X = (m: number) => 80 + (m / Mm) * 300 + 300;
  const Y = (p: number) => 30 + ((Pmax - p) / Math.max(Pmax - Pmin, 1e-9)) * (H - 70);

  d.L(X(-Mm), Y(0), X(Mm), Y(0), 't');
  d.L(X(0), Y(Pmax), X(0), Y(Pmin), 't');
  const pl = (arr: ReadonlyArray<{ M: number; P: number }>, st: string) => {
    d.s += `<polyline points="${arr.map((p) => X(p.M).toFixed(1) + ',' + Y(p.P).toFixed(1)).join(' ')}" fill="none" ${st}/>`;
  };
  pl(
    cn.concat(PT.T[(k + 36) % 72].pts.map((p) => ({ P: p.P, M: p[cp] })).reverse()),
    'stroke="#999" stroke-dasharray="5,3"',
  );
  pl(cd.concat(ck.slice().reverse()), 'stroke="#0050b0" stroke-width="1.6"');
  rows.forEach((r) => {
    if (r.v.st === 'SD') return;
    d.s += `<circle cx="${X(Math.abs(r[key])).toFixed(1)}" cy="${Y(r.o.Hz).toFixed(1)}" r="3" fill="${r.v.st === 'DB' ? '#c06000' : '#c00'}"/>`;
  });
  d.T(
    X(0),
    18,
    title + ' ; nét đứt: Pn - Mn ; nét liền: φPn - φMn (TTGH Cường độ) ; điểm: tổ hợp tính toán',
    'middle',
    'class="s"',
  );
  d.T(X(Mm), Y(0) - 4, 'M (kN.m)', 'end', 'class="s"');
  d.T(X(0) + 4, Y(Pmax) + 10, 'P (kN)', 'start', 'class="s"');
  [0.25, 0.5, 0.75, 1].forEach((f) => {
    d.T(X(f * Mm), Y(0) + 14, fx(f * Mm, 0), 'middle', 'class="s"');
    d.T(X(-f * Mm), Y(0) + 14, fx(-f * Mm, 0), 'middle', 'class="s"');
  });
  [Pmax, Pmax / 2, Pmin].forEach((p) => d.T(X(0) - 4, Y(p) + 4, fx(p, 0), 'end', 'class="s"'));
  dgPut(sv as unknown as SVGElement, W, H, d.s, id);
}

export function dcRender47(R: DcCalcResult): void {
  const I = R.I;
  const Q = R.Q;
  const G = R.G;
  const M = R.M;
  if (!M || !R.C1) return;

  const S = dcColSec(Q, G, M);
  const zone = I.A <= 0.09 ? 1 : I.A <= 0.19 ? 2 : 3;
  const phiDB = zone >= 2 ? 0.9 : 1.0;
  const PT = dcPmTable(S, M, phiDB);

  const rho = S.Ast / S.Ag;
  const rmin = (0.135 * M.fc) / M.fy;
  const rx = Math.sqrt(G.Ix / G.Ath);
  const ry = Math.sqrt(G.Iy / G.Ath);

  set(
    'tbDtSec',
    dcT(
      ['Đặc trưng', 'Ký hiệu', 'Giá trị', 'Đơn vị'],
      (
        [
          ['Diện tích mặt cắt', 'Ag', dcF(G.Ath, 4), 'm2'],
          ['Mômen quán tính (uốn ngang cầu, Mx)', 'Ix', dcF(G.Ix, 4), 'm4'],
          ['Mômen quán tính (uốn dọc cầu, My)', 'Iy', dcF(G.Iy, 4), 'm4'],
          ['Bán kính quán tính', 'rx ; ry', dcF(rx, 3) + ' ; ' + dcF(ry, 3), 'm'],
          ['Diện tích cốt thép dọc (' + S.n + 'φ' + Q.db + ')', 'Ast', dcF(S.Ast, 0), 'mm2'],
          ['Hàm lượng cốt thép ρ = Ast/Ag', 'ρ', dcF(rho * 100, 3), '%'],
          [
            "Giới hạn: 0,135f'c/fy ≤ ρ ≤ 8%",
            '',
            dcF(rmin * 100, 3) + ' ÷ 8',
            { h: dcOK(rho >= rmin && rho <= 0.08) },
          ],
          ['Khoảng cách tim cốt thép dọc theo chu vi', 's', dcF(S.sp, 0), 'mm'],
          [
            "Sức kháng nén lớn nhất Pr,max = 0,80φ[0,85f'c(Ag - Ast) + fy.Ast] (φ = 0,75)",
            'Pr',
            dcF(0.75 * PT.Prmax, 0),
            'kN',
          ],
        ] as DcCell[][]
      ).map((r) => dcRow(r)),
    ),
  );
  dcFigSec(R, S);

  const lu = Q.H2 + (Q.H3 > 0 ? Q.H3 : 0);
  const K = Q.K || 2.1;
  const Ec = M.Ec * 1000;
  const Es = 2e8;
  const dir = [
    { nm: 'Ngang cầu (Mx)', I: G.Ix, r: rx, Is: S.Isx * 1e-12, key: 'Mx' as const, sl: 0, need: false },
    { nm: 'Dọc cầu (My)', I: G.Iy, r: ry, Is: S.Isy * 1e-12, key: 'My' as const, sl: 0, need: false },
  ];
  dir.forEach((o) => {
    o.sl = (K * lu) / o.r;
    o.need = o.sl >= 22;
  });

  set(
    'tbDtSL',
    dcT(
      ['Phương uốn', 'K', 'lu (m)', 'r (m)', 'K.lu/r', 'Hiệu ứng độ mảnh'],
      dir.map((o) =>
        dcRow([
          o.nm,
          dcF(K, 2),
          dcF(lu, 3),
          dcF(o.r, 3),
          dcF(o.sl, 2),
          o.need ? 'Phải xét (≥ 22)' : 'Bỏ qua (< 22)',
        ]),
      ),
    ),
  );

  const rows = R.C1.map((v0) => {
    const o = v0.tot;
    const dd: Record<'Mx' | 'My', { dl: number; Pe: number; EI: number }> = {
      Mx: { dl: 1, Pe: NaN, EI: NaN },
      My: { dl: 1, Pe: NaN, EI: NaN },
    };
    dir.forEach((q) => {
      let dl = 1;
      let Pe = NaN;
      let EI = NaN;
      if (q.need) {
        const bd =
          Math.abs(o[q.key]) > 1e-9 ? Math.min(1, Math.abs(v0.perm[q.key]) / Math.abs(o[q.key])) : 0;
        EI = Math.max(((Ec * q.I) / 5 + Es * q.Is) / (1 + bd), (Ec * q.I) / 2.5 / (1 + bd));
        Pe = (PI2 * EI) / (K * lu) ** 2;
        dl = Math.max(1, 1 / (1 - o.Hz / (0.75 * Pe)));
      }
      dd[q.key] = { dl, Pe, EI };
    });
    const Mux = o.Mx * dd.Mx.dl;
    const Muy = o.My * dd.My.dl;
    const c = dcPmCap(PT, o.Hz, Mux, Muy, v0.st);
    return { v: v0, o, dd, Mux, Muy, c };
  });

  const anyNeed = dir.some((o) => o.need);
  set(
    'tbDtSLc',
    anyNeed
      ? dcT(
          ['Tổ hợp', 'Pu (kN)', 'δ ngang cầu', 'δ dọc cầu'],
          rows.map((r) => dcRow([r.v.id, dcF(r.o.Hz), dcF(r.dd.Mx.dl, 3), dcF(r.dd.My.dl, 3)])),
        )
      : `<tr><td class="l">Cả hai phương K.lu/r &lt; 22: không cần khuếch đại mômen (δ = 1).</td></tr>`,
  );

  let okPM = true;
  let maxRatio = 0;
  const pmRows = rows
    .filter((r) => r.v.st !== 'SD')
    .map((r) => {
      const ok = r.c.ok && isFinite(r.c.ratio);
      okPM = okPM && ok;
      if (r.c.ratio > maxRatio) maxRatio = r.c.ratio;
      return dcRow([
        r.v.id,
        dcF(r.o.Hz),
        dcF(r.Mux),
        dcF(r.Muy),
        dcF(Math.hypot(r.Mux, r.Muy)),
        dcF(r.c.c, 0),
        dcF(r.c.phi, 3),
        dcF(r.c.Mr),
        isFinite(r.c.ratio) ? dcF(r.c.ratio, 3) : '&gt; 1',
        { h: dcOK(ok) },
      ]);
    });
  R.col = { S, PT, maxRatio, okPM };

  set(
    'tbDtPM',
    dcT(
      [
        'Tổ hợp',
        'Pu (kN)',
        'Mux (kN.m)',
        'Muy (kN.m)',
        'Mu (kN.m)',
        'c (mm)',
        'φ',
        'φMn (kN.m)',
        'Mu/φMn',
        'Kết luận',
      ],
      pmRows,
    ),
  );
  dcFigPM('dgDtPMx', PT, 18, rows, 'Mux', 'P - Mx (uốn ngang cầu)');
  dcFigPM('dgDtPMy', PT, 0, rows, 'Muy', 'P - My (uốn dọc cầu)');

  const nh = Math.floor(S.n / 2);
  const Sx: RcSectionInput = {
    b: G.Beq * 1000,
    h: Q.C2 * 1000,
    f1: { n: nh, s: S.sp, d: Q.db, dc: Q.dc },
    f2: { n: nh, s: S.sp, d: Q.db, dc: Q.dc },
    st: { s: Q.vs, d: Q.vd, n: Q.vnx },
  };
  const Sy: RcSectionInput = {
    b: Q.C2 * 1000,
    h: Q.B2 * 1000,
    f1: { n: nh, s: S.sp, d: Q.db, dc: Q.dc },
    f2: { n: nh, s: S.sp, d: Q.db, dc: Q.dc },
    st: { s: Q.vs, d: Q.vd, n: Q.vny },
  };

  let okV = true;
  const vr: string[] = [];
  (
    [
      ['Dọc cầu (Hx, My)', Sx, 'Hx', 'My'],
      ['Ngang cầu (Hy, Mx)', Sy, 'Hy', 'Mx'],
    ] as const
  ).forEach(([nm, SS, kv, km]) => {
    const fl = RC.flex(SS, M, true);
    let gBest: {
      r: (typeof rows)[number];
      sh: ReturnType<typeof RC.shear>;
      q: number;
    } | null = null;
    for (const r of rows) {
      if (r.v.st === 'SD') continue;
      const sh = RC.shear(
        SS,
        M,
        Math.abs(r.o[km]),
        Math.abs(r.o[kv]),
        -r.o.Hz,
        r.v.st === 'DB' ? 1 : 0.9,
        fl,
      );
      const q = Math.abs(r.o[kv]) / sh.Vr;
      if (!gBest || q > gBest.q) gBest = { r, sh, q };
    }
    if (!gBest) return;
    const h = gBest.sh;
    const ok = h.ok && (!h.needSt || h.hasMin) && SS.st.s <= h.smax;
    okV = okV && ok;
    vr.push(
      dcRow([
        nm,
        gBest.r.v.id,
        dcF(Math.abs(gBest.r.o[kv])),
        dcF(gBest.r.o.Hz),
        dcF(SS.b, 0) + ' × ' + dcF(h.dv, 0),
        dcF(h.beta, 2) + ' ; ' + dcF(h.th, 1),
        dcF(h.Vc, 0),
        dcF(h.Vs, 0),
        dcF(h.Vr, 0),
        dcF(h.Av, 0) + ' / ' + dcF(h.Avmin, 0),
        dcF(SS.st.s, 0) + ' / ' + dcF(h.smax, 0),
        { h: dcOK(ok) },
      ]),
    );
  });

  set(
    'tbDtV',
    dcT(
      [
        'Phương',
        'Tổ hợp',
        'Vu (kN)',
        'Nu nén (kN)',
        'bv × dv (mm)',
        'β ; θ (độ)',
        'Vc (kN)',
        'Vs (kN)',
        'Vr (kN)',
        'Av / Av,min (mm2)',
        's / smax (mm)',
        'Kết luận',
      ],
      vr,
    ),
  );

  let okC = true;
  const cr: string[] = [];
  const sd = rows.filter((r) => r.v.st === 'SD');
  (
    [
      ['Ngang cầu (Mx)', Sy, 'Mx', G.Ix, Q.B2 / 2],
      ['Dọc cầu (My)', Sx, 'My', G.Iy, Q.C2 / 2],
    ] as const
  ).forEach(([nm, SS, km, In, yt]) => {
    let gBest: { r: (typeof rows)[number]; fct: number } | null = null;
    for (const r of sd) {
      const fct = ((Math.abs(r.o[km]) * yt) / In - r.o.Hz / G.Ath) / 1000;
      if (!gBest || fct > gBest.fct) gBest = { r, fct };
    }
    if (!gBest) return;
    const need = gBest.fct > 0.8 * M.fr;
    const c = need ? RC.crack(SS, M, Math.abs(gBest.r.o[km])) : null;
    const ok = !need || Boolean(c && c.ok);
    okC = okC && ok;
    cr.push(
      dcRow([
        nm,
        gBest.r.v.id,
        dcF(Math.abs(gBest.r.o[km])),
        dcF(gBest.r.o.Hz),
        dcF(gBest.fct, 3),
        dcF(0.8 * M.fr, 3),
        need ? 'Nứt - kiểm tra' : 'Không nứt',
        c ? dcF(c.fss, 1) : '-',
        c && isFinite(c.smax) ? dcF(c.smax, 0) : '-',
        dcF(S.sp, 0),
        { h: dcOK(ok) },
      ]),
    );
  });

  set(
    'tbDtCr',
    dcT(
      [
        'Phương',
        'Tổ hợp',
        'Ms (kN.m)',
        'N (kN)',
        'fct = M/S - N/A (MPa)',
        '0,8fr (MPa)',
        'Trạng thái',
        'fss (MPa)',
        'smax (mm)',
        's (mm)',
        'Kết luận',
      ],
      cr,
    ),
  );

  R.colOK = okPM && okV && okC && rho >= rmin && rho <= 0.08;
  const kl = $('o_dc_kl47');
  if (kl) {
    kl.className = 'kl ' + (R.colOK ? 'ok' : 'bad');
    kl.innerHTML =
      'KẾT LUẬN: ' +
      (R.colOK
        ? 'Thân trụ ĐẠT YÊU CẦU về hàm lượng cốt thép, sức kháng nén uốn hai phương, sức kháng cắt và khống chế nứt.'
        : 'Thân trụ KHÔNG ĐẠT - xem các hạng mục NG ở trên.');
  }
}

// ---------------------------------------------------------------------------
// 6. Pile Cap Feed, Footing Check (tab48) & Strut-and-Tie Models (`STMx`, `STMb`)
// ---------------------------------------------------------------------------

export function dcFeedPile(R: DcCalcResult): void {
  const k = 9.81;
  const G = R.G;
  const Q = R.Q;
  const I = R.I;
  if (!R.C2) return;

  const row = (o: DcSecForces): [number, number, number, number, number, number] => [
    o.Hx / k,
    o.Hy / k,
    o.Hz / k,
    o.Mx / k,
    o.My / k,
    0,
  ];
  const cd = R.C2.filter((v0) => v0.st !== 'DB');
  const db = R.C2.filter((v0) => v0.st === 'DB');

  latestDcLink = {
    CD: cd.map((v0) => ({ id: v0.id, v: row(v0.tot) })),
    DB: db.map((v0) => ({ id: v0.id, v: row(v0.tot) })),
  };

  withCtx('P_', () => {
    const s = (id: string, val: string | number, ro = true) => {
      const strVal = String(val);
      const e = $(id);
      if (e) {
        e.value = strVal;
        if (ro) {
          e.readOnly = true;
          e.classList?.add?.('lnk');
        }
      } else {
        sv(id, strVal);
      }
    };
    const src = $('mc_src');
    if (src) src.value = 'tay';
    else sv('mc_src', 'tay');
    const sr = $('src');
    if (sr) sr.value = 'calc';
    else sv('src', 'calc');

    s('mc_LCD', moTxt(latestDcLink!.CD));
    s('mc_LDB', moTxt(latestDcLink!.DB));
    s('mc_Ax', +Q.C1.toFixed(3));
    s('mc_By', +Q.B1.toFixed(3));
    s('mc_Cz', +Q.H1.toFixed(3));
    s('mc_Lo', +Math.max(0, G.ELbb - G.ELs).toFixed(3));
    s('s2_ELcap', G.ELbb.toFixed(3));
    s('s2_ELgs', Math.min(G.ELs, G.ELbb).toFixed(3));
    s('s2_gc', I.gc);

    try {
      sctStep();
    } catch (e) {
      console.error(e);
    }
    try {
      mcocStep();
    } catch (e) {
      console.error(e);
    }
    try {
      sctCheck();
    } catch (e) {
      console.error(e);
    }
    try {
      tab3Step();
    } catch (e) {
      console.error(e);
    }
    R.MCR = contextState.MCR as McrRuntimeState | null | undefined;
  });

  try {
    sct2Run('P_', 'W_', {
      sctStep: () => sctStep(),
      sctCheck: () => sctCheck(),
    });
  } catch (e) {
    console.error(e);
  }
}

export function dcFigPlan(
  R: DcCalcResult,
  piles: ReadonlyArray<{ x: number; y: number }>,
  D: number,
): void {
  const svEl = $('dgDbPlan');
  if (!svEl) return;
  const Q = R.Q;
  const G = R.G;
  const id = 'DbPl';
  const d = dgKit(id);
  const W = 760;
  const k = Math.min(560 / Q.B1, 300 / Q.C1);
  const X = (y: number) => W / 2 + y * k;
  const Y = (x: number) => 40 + (Q.C1 / 2 - x) * k;

  d.poly(
    [
      [X(-Q.B1 / 2), Y(Q.C1 / 2)],
      [X(Q.B1 / 2), Y(Q.C1 / 2)],
      [X(Q.B1 / 2), Y(-Q.C1 / 2)],
      [X(-Q.B1 / 2), Y(-Q.C1 / 2)],
    ],
    '#f4f6f8',
  );

  const Rn = G.Rn;
  const yc = Q.B2 / 2 - Rn;
  if (G.rnd) {
    const P: Array<[number, number]> = [];
    for (let i = 0; i <= 30; i++) {
      const t = -Math.PI / 2 + (Math.PI * i) / 30;
      P.push([yc + Rn * Math.cos(t), Rn * Math.sin(t)]);
    }
    for (let i = 0; i <= 30; i++) {
      const t = Math.PI / 2 + (Math.PI * i) / 30;
      P.push([-yc + Rn * Math.cos(t), Rn * Math.sin(t)]);
    }
    d.poly(
      P.map(([y, x]) => [X(y), Y(x)]),
      '#dfe6ee',
    );
  } else {
    d.poly(
      [
        [X(-Q.B2 / 2), Y(Q.C2 / 2)],
        [X(Q.B2 / 2), Y(Q.C2 / 2)],
        [X(Q.B2 / 2), Y(-Q.C2 / 2)],
        [X(-Q.B2 / 2), Y(-Q.C2 / 2)],
      ],
      '#dfe6ee',
    );
  }

  piles.forEach((p, i) => {
    d.s += `<circle class="l" cx="${X(p.y).toFixed(1)}" cy="${Y(p.x).toFixed(1)}" r="${((D / 2) * k).toFixed(1)}" style="fill:#fff"/>`;
    d.T(X(p.y), Y(p.x) + 4, String(i + 1));
  });

  const red = (x1: number, y1: number, x2: number, y2: number) => {
    d.s += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#c00" stroke-width="1.4" stroke-dasharray="7,3"/>`;
  };
  [1, -1].forEach((s) => {
    red(X(-Q.B1 / 2) - 10, Y((s * Q.C2) / 2), X(Q.B1 / 2) + 10, Y((s * Q.C2) / 2));
    red(X((s * G.Beq) / 2), Y(Q.C1 / 2) + 10, X((s * G.Beq) / 2), Y(-Q.C1 / 2) - 10);
  });
  d.T(X(Q.B1 / 2) + 14, Y(Q.C2 / 2) + 4, 'I', 'start', 'style="fill:#c00;font-weight:bold"');
  d.T(X(G.Beq / 2), Y(-Q.C1 / 2) + 24, 'II', 'middle', 'style="fill:#c00;font-weight:bold"');
  d.dimH(X(-Q.B1 / 2), X(Q.B1 / 2), Y(Q.C1 / 2) - 12, 'B1 = ' + fx(Q.B1 * 1000, 0));
  d.dimV(X(-Q.B1 / 2) - 24, Y(Q.C1 / 2), Y(-Q.C1 / 2), 'C1 = ' + fx(Q.C1 * 1000, 0), -1);
  d.T(
    W / 2,
    Y(-Q.C1 / 2) + 44,
    'Mặt bằng bệ (trục x dọc cầu hướng lên, y ngang cầu), ' +
      (piles.length ? 'vị trí cọc và ' : '') +
      'mặt cắt kiểm toán',
    'middle',
    'class="s"',
  );
  dgPut(svEl as unknown as SVGElement, W, Y(-Q.C1 / 2) + 56, d.s, id);
}

export const dcStrut = (fc: number, es: number, th: number): { e1: number; fcu: number } => {
  const e1 = es + (es + 0.002) / Math.tan(th) ** 2;
  return { e1, fcu: Math.min(fc / (0.8 + 170 * e1), 0.85 * fc) };
};

export function dcSTMx(R: DcCalcResult, deep: boolean): void {
  const box = $('dc_stmx');
  const off = R.Q.stmx === 'none';
  if (box?.style) box.style.display = deep && !off ? '' : 'none';
  if (!deep || off) {
    R.stmX = { ok: true, need: false, off };
    return;
  }
  const Q = R.Q;
  const A = R.AA;
  const M = R.M;
  if (!A || !M) return;

  const S = rcSec('dx', Q.C5 * 1000, A.hA * 1000);
  const Ab = RC.bar;
  const h = A.hA * 1000;
  const b = Q.C5 * 1000;
  const As = S.f2.n * Ab(S.f2.d);
  const dct = S.f2.dc;
  const d = h - dct;
  const jd = (0.9 * d) / 1000;
  const rows: string[] = [];
  let ok = true;
  let best: DcStmXBest | null = null;

  A.rows
    .filter((r) => r.st !== 'SD')
    .forEach((r) => {
      const Mu = Math.abs(r.M);
      const Vu = Math.abs(r.V);
      if (Vu <= 0) return;
      const a = Math.max(0.1, Mu / Vu);
      const th = Math.atan(jd / a);
      const T = Mu / jd;
      const C = Vu / Math.sin(th);
      const es = (T * 1e3) / (M.Es * Math.max(As, 1));
      const st = dcStrut(M.fc, es, th);
      const lb = Q.dkb * 1000;
      const ha = 2 * dct;
      const ws = lb * Math.sin(th) + ha * Math.cos(th);
      const bs = Math.min(b, 2 * Q.dka * 1000 + 2 * ha);
      const Acs = ws * bs;
      const Pr = (0.7 * st.fcu * Acs) / 1e3;
      const Tr = (0.9 * M.fy * As) / 1e3;
      const nG = A.gir.length || 1;
      const Rb = Vu / nG / 2;
      const Rn = (0.75 * 0.7 * M.fc * Q.dka * Q.dkb * 1e6) / 1e3;
      const thd = (th * 180) / Math.PI;
      const o: DcStmXBest = {
        r,
        Mu,
        Vu,
        a,
        thd,
        T,
        Tr,
        C,
        Pr,
        es,
        e1: st.e1,
        fcu: st.fcu,
        ws,
        bs,
        Rb,
        Rn,
        ok: T <= Tr && C <= Pr && Rb <= Rn && thd >= 25,
        u: 0,
      };
      o.u = Math.max(T / Tr, C / Pr, Rb / Rn);
      if (!best || o.u > best.u) best = o;
      ok = ok && o.ok;
      rows.push(
        dcRow([
          r.id,
          dcF(Mu),
          dcF(Vu),
          dcF(a, 3),
          dcF(thd, 1),
          dcF(T),
          dcF(Tr),
          dcF(C),
          dcF(st.e1, 5),
          dcF(st.fcu, 2),
          dcF(ws, 0) + ' × ' + dcF(bs, 0),
          dcF(Pr),
          dcF(Rb) + ' / ' + dcF(Rn),
          { h: dcOK(o.ok) },
        ]),
      );
    });

  set(
    'tbDxStm',
    dcT(
      [
        'Tổ hợp',
        'Mu (kN.m)',
        'Vu (kN)',
        'a (m)',
        'θ (độ)',
        'T (kN)',
        'Tr (kN)',
        'C (kN)',
        'ε1',
        'fcu (MPa)',
        'Acs = ws × bs (mm)',
        'Pr (kN)',
        "Nút gối Ru / 0,75φf'cAb (kN)",
        'KL',
      ],
      rows,
    ) +
      `<tr><td class="l" colspan="14">jd = 0,9d = ${fx(jd, 3)} m (d = ${fx(d, 0)} mm) ; giằng trên As = ${S.f2.n}φ${S.f2.d} = ${fx(As, 0)} mm² ; ℓb = bề rộng đá kê ngang cầu ${fx(Q.dkb * 1000, 0)} mm ; bs = min(C5 ; 2a + 2ha) với a là kích thước đá kê dọc cầu.</td></tr>`,
  );

  const skd = Q.xskd || 16;
  const sks = Q.xsks || 150;
  const rh = (2 * Ab(skd)) / (b * sks);
  const rv = S.st.n > 0 ? (S.st.n * Ab(S.st.d)) / (b * S.st.s) : 0;
  const sm = Math.min(d / 4, 300);
  const okh = rh >= 0.003;
  const okv = rv >= 0.003;
  const oks = sks <= sm && S.st.s <= sm;

  set(
    'tbDxStm2',
    dcT(
      ['Phương', 'Bố trí', 'ρ', 'ρ yêu cầu', 's (mm)', 'smax = min(d/4 ; 300)', 'KL'],
      [
        dcRow([
          'Ngang (cốt thép dọc mặt bên, hai mặt)',
          `2 × φ${skd} a${sks}`,
          dcF(rh, 5),
          '0.003',
          dcF(sks, 0),
          dcF(sm, 0),
          { h: dcOK(okh && sks <= sm) },
        ]),
        dcRow([
          'Đứng (đai)',
          `${S.st.n} nhánh φ${S.st.d} a${S.st.s}`,
          dcF(rv, 5),
          '0.003',
          dcF(S.st.s, 0),
          dcF(sm, 0),
          { h: dcOK(okv && S.st.s <= sm) },
        ]),
      ],
    ),
  );

  const all = ok && okh && okv && oks;
  const strict = Q.stmx === 'stm';
  R.stmX = { ok: strict ? all : true, need: true, strict, best, rh, rv, raw: all };

  const kl = $('o_dc_klstmx');
  if (kl) {
    kl.className = 'kl ' + (strict ? (all ? 'ok' : 'bad') : '');
    kl.innerHTML =
      (strict ? 'KẾT LUẬN: ' : 'KẾT QUẢ THAM KHẢO (không đưa vào kết luận chung): ') +
      (all
        ? 'Đầu hẫng xà mũ ĐẠT theo mô hình chống - giằng (giằng, thanh chống, nút) và lưới cốt thép khống chế nứt.'
        : (ok
            ? 'Giằng, thanh chống, nút của đầu hẫng xà mũ đạt'
            : 'Đầu hẫng xà mũ chưa đạt về giằng / thanh chống / nút') +
          (!(okh && okv && oks)
            ? (ok ? ' ; ' : ' - ') +
              'lưới cốt thép chưa đạt ρ ≥ 0,003 mỗi phương' +
              (strict
                ? ' - tăng cốt thép phân bố mặt bên hoặc số nhánh đai'
                : ' (chỉ bắt buộc khi thiết kế theo chống - giằng)')
            : '') +
          '.');
  }
  dcFigStmX(R, best, jd);
}

export function dcFigStmX(R: DcCalcResult, o: DcStmXBest | null, jd: number): void {
  const svEl = $('dgDxStm');
  const A = R.AA;
  if (!svEl || !o || !A) return;
  const Q = R.Q;
  const G = R.G;
  const id = 'DxSt';
  const d = dgKit(id);
  const W = 760;
  const k = Math.min(520 / (Q.B / 2 - A.yA + 1.2), 200 / G.hx);
  const X = (y: number) => 120 + (y - A.yA + 0.8) * k;
  const Y = (z: number) => 80 + (G.ELt - z) * k;

  const cap: Array<[number, number]> = [];
  const ctop: Array<[number, number]> = [];
  for (let i = 0; i <= 30; i++) {
    const y = A.yA - 0.8 + ((Q.B / 2 - A.yA + 0.8) * i) / 30;
    cap.push([X(y), Y(G.ELt - G.hAt0(y))]);
    ctop.push([X(y), Y(G.ELt - G.XF.dM(y))]);
  }
  d.poly([...ctop, ...cap.reverse()], '#eef2f6');
  d.poly(
    [
      [X(A.yA - 0.8), Y(G.ELcb)],
      [X(A.yA), Y(G.ELcb)],
      [X(A.yA), Y(G.ELcb - 0.5)],
      [X(A.yA - 0.8), Y(G.ELcb - 0.5)],
    ],
    '#e4e9ef',
  );

  const yL = A.yA + o.a;
  const zT = G.ELt - 0.1;
  const zB = zT - jd;
  const yTip = Math.min(yL, Q.B / 2 - 0.05);

  d.s += `<line x1="${X(A.yA - 0.6)}" y1="${Y(zT)}" x2="${X(yTip)}" y2="${Y(zT)}" stroke="#c00" stroke-width="3"/>`;
  d.s += `<line x1="${X(yTip)}" y1="${Y(zT)}" x2="${X(A.yA)}" y2="${Y(zB)}" stroke="#0050b0" stroke-width="3" stroke-dasharray="9,4"/>`;
  d.s += `<line x1="${X(A.yA)}" y1="${Y(zB)}" x2="${X(A.yA - 0.6)}" y2="${Y(zB)}" stroke="#0050b0" stroke-width="3" stroke-dasharray="9,4"/>`;
  (
    [
      [yL, zT],
      [A.yA, zB],
    ] as const
  ).forEach(([y, z]) => {
    d.s += `<circle cx="${X(Math.min(y, Q.B / 2 - 0.05))}" cy="${Y(z)}" r="5" fill="#333"/>`;
  });
  d.A(X(yTip), Y(G.ELt) - 50, X(yTip), Y(G.ELt) - 4);
  d.T(X(yTip), Y(G.ELt) - 54, `Vu = ${fx(o.Vu, 0)} kN`);
  d.T(X(A.yA + 0.1), Y(zT) - 6, `Giằng T = ${fx(o.T, 0)} kN`, 'start', 'style="fill:#c00"');
  d.T(
    (X(yL) + X(A.yA)) / 2 + 8,
    (Y(zT) + Y(zB)) / 2,
    `Chống C = ${fx(o.C, 0)} kN ; θ = ${fx(o.thd, 1)}°`,
    'start',
    'style="fill:#0050b0"',
  );
  d.dimH(X(A.yA), X(yTip), Y(G.ELcb) + 26, 'a = ' + fx(o.a * 1000, 0));
  d.dimV(X(A.yA) - 14, Y(zT), Y(zB), 'jd = ' + fx(jd * 1000, 0), -1);
  d.T(X(A.yA), Y(G.ELcb - 0.5) + 16, 'A-A (mép thân trụ)', 'middle', 'class="s"');
  dgPut(svEl as unknown as SVGElement, W, Y(G.ELcb - 0.5) + 28, d.s, id);
}

export function dcFigStmB(
  R: DcCalcResult,
  piles: ReadonlyArray<{ x: number; y: number }>,
  D: number,
  xc: number,
  yc: number,
  jd: number,
  _rS?: DcStmBStrutRow[],
): void {
  const svEl = $('dgDbStm');
  if (!svEl) return;
  const Q = R.Q;
  const id = 'DbSt';
  const d = dgKit(id);
  const W = 760;
  const k = Math.min(330 / Q.B1, 240 / Q.C1);
  const X = (y: number) => 30 + (y + Q.B1 / 2) * k;
  const Y = (x: number) => 40 + (Q.C1 / 2 - x) * k;

  d.poly(
    [
      [X(-Q.B1 / 2), Y(Q.C1 / 2)],
      [X(Q.B1 / 2), Y(Q.C1 / 2)],
      [X(Q.B1 / 2), Y(-Q.C1 / 2)],
      [X(-Q.B1 / 2), Y(-Q.C1 / 2)],
    ],
    '#f4f6f8',
  );
  piles.forEach((p, i) => {
    d.s += `<circle class="l" cx="${X(p.y).toFixed(1)}" cy="${Y(p.x).toFixed(1)}" r="${((D / 2) * k).toFixed(1)}" style="fill:#fff"/>`;
    const nx = Math.sign(p.x) * xc;
    const ny = Math.sign(p.y) * yc;
    d.s += `<line x1="${X(ny)}" y1="${Y(nx)}" x2="${X(p.y)}" y2="${Y(p.x)}" stroke="#0050b0" stroke-width="2.5" stroke-dasharray="8,4"/>`;
    d.T(X(p.y), Y(p.x) + 4, String(i + 1));
  });

  const xs = [...new Set(piles.map((p) => p.x))];
  const ys = [...new Set(piles.map((p) => p.y))];
  if (ys.length) {
    xs.forEach((x) => {
      d.s += `<line x1="${X(Math.min(...ys))}" y1="${Y(x)}" x2="${X(Math.max(...ys))}" y2="${Y(x)}" stroke="#c00" stroke-width="3"/>`;
    });
  }
  if (xs.length) {
    ys.forEach((y) => {
      d.s += `<line x1="${X(y)}" y1="${Y(Math.min(...xs))}" x2="${X(y)}" y2="${Y(Math.max(...xs))}" stroke="#c00" stroke-width="3"/>`;
    });
  }
  (
    [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ] as const
  ).forEach(([a, b]) => {
    d.s += `<circle cx="${X(b * yc)}" cy="${Y(a * xc)}" r="4" fill="#333"/>`;
  });
  d.T(
    X(0),
    Y(-Q.C1 / 2) + 18,
    'Mặt bằng: giằng đáy (đỏ), thanh chống (xanh, hình chiếu)',
    'middle',
    'class="s"',
  );

  // Longitudinal elevation
  const x0 = 420;
  const k2 = Math.min(300 / Q.C1, 200 / Q.H1);
  const X2 = (x: number) => x0 + (x + Q.C1 / 2) * k2;
  const Y2 = (z: number) => 80 + (Q.H1 - z) * k2;
  const zt = Q.H1 - 0.1;

  d.poly(
    [
      [X2(-Q.C1 / 2), Y2(Q.H1)],
      [X2(Q.C1 / 2), Y2(Q.H1)],
      [X2(Q.C1 / 2), Y2(0)],
      [X2(-Q.C1 / 2), Y2(0)],
    ],
    '#f4f6f8',
  );
  d.poly(
    [
      [X2(-Q.C2 / 2), Y2(Q.H1 + 0.8)],
      [X2(Q.C2 / 2), Y2(Q.H1 + 0.8)],
      [X2(Q.C2 / 2), Y2(Q.H1)],
      [X2(-Q.C2 / 2), Y2(Q.H1)],
    ],
    '#e4e9ef',
  );
  xs.forEach((x) => {
    d.poly(
      [
        [X2(x - D / 2), Y2(0)],
        [X2(x + D / 2), Y2(0)],
        [X2(x + D / 2), Y2(-0.6)],
        [X2(x - D / 2), Y2(-0.6)],
      ],
      '#fff',
    );
    d.s += `<line x1="${X2(Math.sign(x) * xc)}" y1="${Y2(zt)}" x2="${X2(x)}" y2="${Y2(zt - jd)}" stroke="#0050b0" stroke-width="2.5" stroke-dasharray="8,4"/>`;
  });
  if (xs.length) {
    d.s += `<line x1="${X2(Math.min(...xs))}" y1="${Y2(zt - jd)}" x2="${X2(Math.max(...xs))}" y2="${Y2(zt - jd)}" stroke="#c00" stroke-width="3"/>`;
  }
  d.s += `<line x1="${X2(-xc)}" y1="${Y2(zt)}" x2="${X2(xc)}" y2="${Y2(zt)}" stroke="#0050b0" stroke-width="2.5" stroke-dasharray="8,4"/>`;
  d.dimV(X2(Q.C1 / 2) + 14, Y2(zt), Y2(zt - jd), 'jd = ' + fx(jd * 1000, 0));
  d.T(X2(0), Y2(-0.6) + 18, 'Mặt đứng dọc cầu', 'middle', 'class="s"');
  dgPut(svEl as unknown as SVGElement, W, Math.max(Y(-Q.C1 / 2) + 30, Y2(-0.6) + 30), d.s, id);
}

export function dcSTMb(
  R: DcCalcResult,
  piles: ReadonlyArray<{ x: number; y: number }>,
  P: ReadonlyArray<{ id: string; st: LimitStateType; Rs: number[] }>,
  combos: ReadonlyArray<DcComboRow>,
  deep: boolean,
  D: number,
): void {
  const box = $('dc_stmbe');
  const off = R.Q.stmb === 'none';
  if (box?.style) box.style.display = deep && !off ? '' : 'none';
  if (!deep || off) {
    R.stmB = { ok: true, need: false, off };
    return;
  }

  const Q = R.Q;
  const G = R.G;
  const M = R.M;
  if (!M || !R.C1) return;

  const Ab = RC.bar;
  const h = Q.H1 * 1000;
  const SI = rcSec('db1', Q.B1 * 1000, h);
  const SII = rcSec('db2', Q.C1 * 1000, h);
  const AsX = SI.f1.n * Ab(SI.f1.d);
  const AsY = SII.f1.n * Ab(SII.f1.d);
  const dX = h - SI.f1.dc;
  const dY = h - SII.f1.dc;
  const jd = (0.9 * Math.min(dX, dY)) / 1000;
  const xc = Q.C2 / 4;
  const yc = G.Beq / 4;
  const TrX = (0.9 * M.fy * AsX) / 1e3;
  const TrY = (0.9 * M.fy * AsY) / 1e3;
  const Acol = G.Ath * 1e6;
  const An = (Math.PI * (D * 1000) ** 2) / 4;

  let ok = true;
  const rT: string[] = [];
  const rS: DcStmBStrutRow[] = [];
  let gT: { Tx: number; Ty: number; id: string } | null = null;

  combos.forEach((v0, ci) => {
    if (v0.st === 'SD') return;
    const Rs = P[ci].Rs;
    let best: { Tx: number; Ty: number } | null = null;
    for (const sx of [1, -1]) {
      for (const sy of [1, -1]) {
        let Tx = 0;
        let Ty = 0;
        piles.forEach((p, i) => {
          if (sx * p.x > 0) Tx += (Rs[i] * Math.max(0, Math.abs(p.x) - xc)) / jd;
          if (sy * p.y > 0) Ty += (Rs[i] * Math.max(0, Math.abs(p.y) - yc)) / jd;
        });
        const o = { Tx, Ty };
        if (!best || Math.max(Tx / TrX, Ty / TrY) > Math.max(best.Tx / TrX, best.Ty / TrY)) {
          best = o;
        }
      }
    }
    const chosen = best || { Tx: 0, Ty: 0 };
    const colEntry = R.C1!.find((c) => c.id === v0.id);
    const Ncol = colEntry ? colEntry.tot.Hz : 0;
    const Rcol = (0.85 * 0.7 * M.fc * Acol) / 1e3;
    const okT = chosen.Tx <= TrX && chosen.Ty <= TrY && Ncol <= Rcol;
    ok = ok && okT;
    rT.push(
      dcRow([
        v0.id,
        dcF(chosen.Tx),
        dcF(TrX),
        dcF(chosen.Ty),
        dcF(TrY),
        dcF(Ncol),
        dcF(Rcol),
        { h: dcOK(okT) },
      ]),
    );

    piles.forEach((p, i) => {
      const ex = Math.abs(p.x) - xc;
      const ey = Math.abs(p.y) - yc;
      const Lh = Math.hypot(Math.max(ex, 0), Math.max(ey, 0));
      const th = Math.atan(jd / Math.max(Lh, 0.05));
      const C = Rs[i] / Math.sin(th);
      const es = Math.max((chosen.Tx * 1e3) / (M.Es * AsX), (chosen.Ty * 1e3) / (M.Es * AsY));
      const st = dcStrut(M.fc, es, th);
      const Acs = (D * 1000 * Math.sin(th) + 2 * SI.f1.dc * Math.cos(th)) * D * 1000;
      const Pr = (0.7 * st.fcu * Acs) / 1e3;
      const Rn = (0.75 * 0.7 * M.fc * An) / 1e3;
      const thd = (th * 180) / Math.PI;
      const o: DcStmBStrutRow = {
        v: v0,
        i,
        R: Rs[i],
        ex,
        ey,
        thd,
        C,
        e1: st.e1,
        fcu: st.fcu,
        Pr,
        Rn,
        ok: C <= Pr && Rs[i] <= Rn && thd >= 25,
        u: 0,
      };
      o.u = Math.max(C / Pr, Rs[i] / Rn, thd < 25 ? 9 : 0);
      if (!rS[i] || o.u > rS[i].u) rS[i] = o;
    });

    if (!gT || chosen.Tx / TrX > gT.Tx / TrX) gT = { ...chosen, id: v0.id };
  });

  rS.forEach((o) => {
    ok = ok && o.ok;
  });

  set(
    'tbDbStmT',
    dcT(
      [
        'Tổ hợp',
        'Giằng dọc cầu Tx (kN)',
        'Tr,x = φfyAs (kN)',
        'Giằng ngang cầu Ty (kN)',
        'Tr,y (kN)',
        'Lực thân trụ N (kN)',
        "Nút thân trụ 0,85φf'cAg (kN)",
        'KL',
      ],
      rT,
    ) +
      `<tr><td class="l" colspan="8">jd = ${fx(jd, 3)} m ; nút lực thân trụ tại x = ±C2/4 = ±${fx(xc, 3)} m, y = ±Beq/4 = ±${fx(yc, 3)} m ; As dọc cầu (đáy, mặt cắt I-I) = ${fx(AsX, 0)} mm² ; As ngang cầu (đáy, mặt cắt II-II) = ${fx(AsY, 0)} mm².</td></tr>`,
  );

  set(
    'tbDbStm',
    dcT(
      [
        'Cọc',
        'Tổ hợp',
        'R (kN)',
        'ex ; ey (m)',
        'θ (độ)',
        'C (kN)',
        'ε1',
        'fcu (MPa)',
        'Pr (kN)',
        "Nút cọc 0,75φf'cAp (kN)",
        'KL',
      ],
      rS.map((o) =>
        dcRow([
          'Cọc ' + (o.i + 1),
          o.v.id,
          dcF(o.R),
          dcF(o.ex, 3) + ' ; ' + dcF(o.ey, 3),
          dcF(o.thd, 1),
          dcF(o.C),
          dcF(o.e1, 5),
          dcF(o.fcu, 2),
          dcF(o.Pr),
          dcF(o.Rn),
          { h: dcOK(o.ok) },
        ]),
      ),
    ),
  );

  const skd = Q.bskd || 16;
  const sks = Q.bsks || 200;
  const de = Math.min(dX, dY);
  const AsM = Math.max(AsX, AsY);
  const AskReq = de > 900 ? Math.min((0.001 * (de - 760) * de) / 2, AsM / 4) : 0;
  const nsk = Math.floor(de / 2 / sks) + 1;
  const AskPro = nsk * Ab(skd);
  const bb = Math.min(Q.B1, Q.C1) * 1000;
  const AtReq = Math.max(0.233, Math.min(1.27, (0.75 * bb * h) / (2 * (bb + h) * M.fy)));
  const AtPro = Ab(skd) / sks;
  const smx = Math.min(de / 6, 300, 3 * h, 450);
  const rh = (2 * Ab(skd)) / (bb * sks);
  const okSk = AskPro >= AskReq - 1e-6;
  const okSt = AtPro >= AtReq - 1e-6;
  const okS = sks <= smx;

  set(
    'tbDbStm2',
    dcT(
      ['Hạng mục', 'Yêu cầu', 'Bố trí', 'KL'],
      [
        dcRow([
          'a) Lưới Điều 6.3.6: ρh = 2Ab/(b.sh) (tham khảo, móng không bắt buộc)',
          '0.003',
          dcF(rh, 5),
          '-',
        ]),
        dcRow([
          'b) Cốt thép mặt bên Điều 7.3.4, mỗi mặt trên de/2 (mm²)',
          dcF(AskReq, 0),
          `${nsk}φ${skd} = ${dcF(AskPro, 0)}`,
          { h: dcOK(okSk) },
        ]),
        dcRow([
          'c) Co ngót, nhiệt độ Điều 10.8 mỗi mặt (mm²/mm)' +
            (G.ELtb <= R.I.ELg + 1e-6 ? ' - bệ chôn trong đất: khuyến nghị' : ''),
          dcF(AtReq, 3),
          `φ${skd} a${sks} = ${dcF(AtPro, 3)}`,
          {
            h: okSt
              ? dcOK(true)
              : G.ELtb <= R.I.ELg + 1e-6
                ? '<td class="c">Khuyến nghị</td>'
                : dcOK(false),
          },
        ]),
        dcRow([
          'Bước lớn nhất min(de/6 ; 300 ; 3h ; 450) (mm)',
          dcF(smx, 0),
          dcF(sks, 0),
          { h: dcOK(okS) },
        ]),
      ],
    ),
  );

  const buried = G.ELtb <= R.I.ELg + 1e-6;
  const strict = Q.stmb === 'stm';
  const all = ok && okSk && (okSt || buried) && okS;
  R.stmB = { ok: strict ? all : true, need: true, strict, raw: all };

  const kl = $('o_dc_klstmb');
  if (kl) {
    kl.className = 'kl ' + (strict ? (all ? 'ok' : 'bad') : '');
    kl.innerHTML =
      (strict ? 'KẾT LUẬN: ' : 'KẾT QUẢ THAM KHẢO (không đưa vào kết luận chung): ') +
      (all
        ? 'Bệ trụ ĐẠT theo mô hình chống - giằng (giằng đáy hai phương, thanh chống, nút cọc, nút thân trụ) và cốt thép phân bố mặt bên.'
        : (ok
            ? 'Giằng đáy, thanh chống, nút của bệ trụ đạt'
            : 'Bệ trụ chưa đạt về giằng / thanh chống / nút') +
          (!okSk || !okS ? ' ; cốt thép mặt bên chưa đạt Điều 7.3.4' : '') +
          (!okSt
            ? ' ; cốt thép co ngót - nhiệt độ chưa đạt Điều 10.8' +
              (buried ? ' (bệ chôn trong đất: chỉ khuyến nghị)' : '')
            : '') +
          '.');
  }
  dcFigStmB(R, piles, D, xc, yc, jd, rS);
}

export function dcRender48(R: DcCalcResult): void {
  const I = R.I;
  const Q = R.Q;
  const G = R.G;
  const M = R.M;
  if (!M || !R.LD || !R.C1 || !R.C2) return;

  const k = 9.81;
  const errEl = $('o_dc_err48');
  if (errEl) errEl.textContent = '';

  const SFG = sfdOn(dcOn)
    ? sfGrid(
        Q.C1,
        Q.B1,
        [...R.C2.filter((v0) => v0.st !== 'DB'), ...R.C2.filter((v0) => v0.st === 'DB')].map(
          (v0) => ({
            id: v0.id,
            V: v0.tot.Hz,
            My: v0.tot.My,
            Mx: v0.tot.Mx,
          }),
        ),
      )
    : null;

  const nt = $('o_dc_sf48');
  if (nt?.style) nt.style.display = SFG ? '' : 'none';
  const pc = $('o_dc_pc48');
  if (pc?.style) pc.style.display = SFG ? 'none' : '';

  const MC = SFG || R.MCR;
  if (!MC || !MC.piles || !MC.rows) {
    if (errEl) errEl.textContent = 'Chưa có kết quả nội lực đầu cọc (trang Nội lực đầu cọc trụ).';
    return;
  }

  const piles = MC.piles;
  const D = SFG ? SFG.D : num('P_D') / 1000 || 1;
  const xI = Q.C2 / 2;
  const yII = G.Beq / 2;
  const hd = R.LD.info.EV.hd;
  const wA = I.gc * Q.H1 + Q.gs * hd;
  const combos = [
    ...R.C2.filter((v0) => v0.st !== 'DB'),
    ...R.C2.filter((v0) => v0.st === 'DB'),
  ];
  const nCD = R.C2.filter((v0) => v0.st !== 'DB').length;

  const mcrRows = !SFG ? (MC as McrRuntimeState).rows : null;
  const rowsCD = mcrRows ? mcrRows['TTGH CƯỜNG ĐỘ VÀ SỬ DỤNG'] || [] : [];
  const rowsDB = mcrRows ? mcrRows['TTGH ĐẶC BIỆT'] || [] : [];

  const Rp = (ci: number, pi: number): number => {
    if (SFG) return SFG.R[ci][pi];
    const dbb = ci >= nCD;
    const rArr = dbb ? rowsDB : rowsCD;
    const th = (dbb ? ci - nCD : ci) + 1;
    const r = rArr.find((q) => q.tc === pi + 1 && q.th === th);
    return r ? r.N * k : NaN;
  };

  set(
    'tbDbP',
    SFG
      ? SFG.tbl
      : dcT(
          [
            'Cọc',
            'x (m)',
            'y (m)',
            'Khoảng cách tới mặt cắt I-I (m)',
            'Khoảng cách tới mặt cắt II-II (m)',
          ],
          piles.map((p, i) =>
            dcRow([
              'Cọc ' + (i + 1),
              dcF(p.x, 3),
              dcF(p.y, 3),
              Math.abs(p.x) > xI ? dcF(Math.abs(p.x) - xI, 3) : 'trong',
              Math.abs(p.y) > yII ? dcF(Math.abs(p.y) - yII, 3) : 'trong',
            ]),
          ),
        ),
  );

  const dvI = (0.9 * (Q.H1 * 1000 - num('rc_db11c'))) / 1000;
  const dvII = (0.9 * (Q.H1 * 1000 - num('rc_db21c'))) / 1000;
  const out: {
    I: Array<{ id: string; st: LimitStateType; sg: number; M: number; V: number; Vd: number }>;
    II: Array<{ id: string; st: LimitStateType; sg: number; M: number; V: number; Vd: number }>;
  } = { I: [], II: [] };
  const P: Array<{ id: string; st: LimitStateType; Rs: number[] }> = [];

  combos.forEach((v0, ci) => {
    const Rs = piles.map((_p, i) => Rp(ci, i));
    const gW = v0.st === 'SD' ? 1 : 0.9;
    const specs: ReadonlyArray<
      ['I' | 'II', (p: { x: number; y: number }) => number, number, number, number, number]
    > = [
      ['I', (p) => p.x, xI, Q.B1, Q.C1 / 2, dvI],
      ['II', (p) => p.y, yII, Q.C1, Q.B1 / 2, dvII],
    ];
    for (const [sec, crd, lim, wid, L2, dvv] of specs) {
      let best: { sg: number; M: number; V: number; Vd: number } | null = null;
      for (const sg of [1, -1]) {
        let Mm = 0;
        let V = 0;
        let Vd = 0;
        piles.forEach((p, i) => {
          const t = sg * crd(p);
          if (t > lim + 1e-9) {
            Mm += Rs[i] * (t - lim);
            V += Rs[i];
          }
          const sdv = t - (lim + dvv);
          const f = sdv >= D / 2 ? 1 : sdv <= -D / 2 ? 0 : (sdv + D / 2) / D;
          Vd += f * Rs[i];
        });
        const L = L2 - lim;
        const Ww = gW * wA * wid * L;
        const Wd = gW * wA * wid * Math.max(0, L - dvv);
        Mm -= (Ww * L) / 2;
        V -= Ww;
        Vd = Math.max(0, Vd - Wd);
        const o = { sg, M: Mm, V, Vd };
        if (!best || o.M > best.M) best = o;
      }
      out[sec].push({ id: v0.id, st: v0.st, ...best! });
    }
    P.push({ id: v0.id, st: v0.st, Rs });
  });

  set(
    'tbDbF',
    SFG
      ? dcT(
          ['Tổ hợp', 'MI (kN.m)', 'VI tại dv (kN)', 'MII (kN.m)', 'VII tại dv (kN)'],
          combos.map((v0, ci) =>
            dcRow([
              v0.id,
              dcF(out.I[ci].M),
              dcF(out.I[ci].Vd),
              dcF(out.II[ci].M),
              dcF(out.II[ci].Vd),
            ]),
          ),
        )
      : dcT(
          [
            'Tổ hợp',
            ...piles.map((_p, i) => 'R cọc ' + (i + 1) + ' (kN)'),
            'MI (kN.m)',
            'VI tại dv (kN)',
            'MII (kN.m)',
            'VII tại dv (kN)',
          ],
          combos.map((v0, ci) =>
            dcRow([
              v0.id,
              ...P[ci].Rs.map((r) => dcF(r)),
              dcF(out.I[ci].M),
              dcF(out.I[ci].Vd),
              dcF(out.II[ci].M),
              dcF(out.II[ci].Vd),
            ]),
          ),
        ),
  );

  dcFigPlan(R, SFG ? [] : piles, D);
  if (SFG) {
    const iMax = out.I.reduce((bestIdx, o, j) => (o.M > out.I[bestIdx].M ? j : bestIdx), 0);
    const c = combos[iMax];
    R.sfCapFig = {
      svId: 'dgSfCap48',
      m: { B: Q.C1, L: Q.B1, h: Q.H1, s1: -Q.C2 / 2, s2: Q.C2 / 2, sName: 'Thân trụ' },
      c: { id: c.id, V: c.tot.Hz, My: c.tot.My, Mx: c.tot.Mx },
      lab: ['L1', 'C2', 'L2'],
    };
  } else {
    R.sfCapFig = null;
  }
  const sfCapEl = $('dgSfCap48');
  if (sfCapEl?.style) sfCapEl.style.display = SFG ? '' : 'none';

  const SI = rcSec('db1', Q.B1 * 1000, Q.H1 * 1000);
  const SII = rcSec('db2', Q.C1 * 1000, Q.H1 * 1000);
  const posI = $('o_rcdb1pos');
  if (posI) {
    posI.textContent = `Mặt cắt I-I tại mép thân trụ (x = ±${fx(xI, 3)} m), b = B1 = ${fx(Q.B1 * 1000, 0)} mm, h = H1 = ${fx(Q.H1 * 1000, 0)} mm`;
  }
  const posII = $('o_rcdb2pos');
  if (posII) {
    posII.textContent = `Mặt cắt II-II tại mép thân trụ quy đổi (y = ±${fx(yII, 3)} m), b = C1 = ${fx(Q.C1 * 1000, 0)} mm, h = H1 = ${fx(Q.H1 * 1000, 0)} mm`;
  }

  const a = rcRender(
    'db1',
    SI,
    M,
    out.I.map((o) => ({ id: o.id, st: o.st, M: o.M, V: o.Vd, N: 0 })),
    'Lớp dưới',
    'Lớp trên',
  );
  const b = rcRender(
    'db2',
    SII,
    M,
    out.II.map((o) => ({ id: o.id, st: o.st, M: o.M, V: o.Vd, N: 0 })),
    'Lớp dưới',
    'Lớp trên',
  );
  R.footRcX = a;
  R.footRcY = b;

  // Punching shear
  const fc = M.fc;
  const dc1 = num('rc_db11c');
  const dvp = a && a.gV ? a.gV.sh.dv : Math.max(0.9 * (Q.H1 * 1000 - dc1), 0.72 * Q.H1 * 1000);
  const r = (D * 1000 + dvp) / 2;
  const rows: string[] = [];
  let okP = true;
  const vn = (b0: number) =>
    (Math.min((0.17 + 0.33 / 1) * Math.sqrt(fc), 0.33 * Math.sqrt(fc)) * b0 * dvp) / 1e3;

  (SFG ? [] : piles).forEach((p, i) => {
    const ex = (Q.C1 / 2 - Math.abs(p.x)) * 1000;
    const ey = (Q.B1 / 2 - Math.abs(p.y)) * 1000;
    const nx = ex < r;
    const ny = ey < r;
    const b0 =
      nx && ny
        ? (Math.PI * r) / 2 + ex + ey
        : nx
          ? Math.PI * r + 2 * ex
          : ny
            ? Math.PI * r + 2 * ey
            : 2 * Math.PI * r;
    let Vu = 0;
    let cid = '';
    P.forEach((q) => {
      if (q.st === 'SD') return;
      if (q.Rs[i] > Vu) {
        Vu = q.Rs[i];
        cid = q.id;
      }
    });
    const Vr = 0.9 * vn(b0);
    const ok = Vu <= Vr;
    okP = okP && ok;
    rows.push(
      dcRow([
        'Cọc ' + (i + 1) + (nx && ny ? ' (góc)' : nx || ny ? ' (biên)' : ''),
        cid,
        dcF(dvp, 0),
        dcF(b0, 0),
        dcF(vn(b0)),
        dcF(Vr),
        dcF(Vu),
        { h: dcOK(ok) },
      ]),
    );
  });

  {
    const off = dvp / 2 / 1000;
    const b0 = G.rnd
      ? 2 * (Q.B2 - Q.C2) * 1000 + Math.PI * (Q.C2 * 1000 + dvp)
      : 2 * (Q.B2 * 1000 + dvp) + 2 * (Q.C2 * 1000 + dvp);
    let Vu = 0;
    let cid = '';
    R.C1.forEach((v0) => {
      if (v0.st === 'SD') return;
      const cj = combos.findIndex((c) => c.id === v0.id);
      const Rs = P[cj].Rs;
      let inn = 0;
      piles.forEach((p, i) => {
        const ax = Math.abs(p.x);
        const ay = Math.abs(p.y);
        if (ax <= Q.C2 / 2 + off && ay <= Q.B2 / 2 + off) inn += Rs[i];
      });
      const u = v0.tot.Hz - inn;
      if (u > Vu) {
        Vu = u;
        cid = v0.id;
      }
    });
    const Vr = 0.9 * vn(b0);
    const ok = Vu <= Vr;
    okP = okP && ok;
    rows.push(
      dcRow([
        SFG
          ? 'Thân trụ (trừ phản lực nền trong chu vi tới hạn)'
          : 'Thân trụ (trừ phản lực cọc trong chu vi tới hạn)',
        cid,
        dcF(dvp, 0),
        dcF(b0, 0),
        dcF(vn(b0)),
        dcF(Vr),
        dcF(Vu),
        { h: dcOK(ok) },
      ]),
    );
  }
  R.footPunOk = okP;

  set(
    'tbDbPun',
    dcT(
      [
        'Vị trí',
        'Tổ hợp',
        'dv (mm)',
        'b0 (mm)',
        'Vn (kN)',
        'Vr = 0,9Vn (kN)',
        'Vu (kN)',
        'Kết luận',
      ],
      rows,
    ),
  );

  const deepB =
    !SFG &&
    piles.some(
      (p) =>
        (Math.abs(p.x) > xI && Math.abs(p.x) - xI < (2 * dvp) / 1000) ||
        (Math.abs(p.y) > yII && Math.abs(p.y) - yII < (2 * dvp) / 1000),
    );
  try {
    if (SFG) {
      R.stmB = null;
      const e = $('dc_stmbe');
      if (e?.style) e.style.display = 'none';
    } else {
      const e = $('dc_stmbe');
      if (e?.style) e.style.display = '';
      dcSTMb(R, piles, P, combos, deepB, D);
    }
  } catch (e) {
    console.error(e);
  }

  R.beOK = okP && Boolean(a && a.ok) && Boolean(b && b.ok) && (!R.stmB || R.stmB.ok);
  const kl = $('o_dc_kl48');
  if (kl) {
    kl.className = 'kl ' + (R.beOK ? 'ok' : 'bad');
    kl.innerHTML =
      'KẾT LUẬN: ' +
      (R.beOK
        ? 'Bệ trụ ĐẠT YÊU CẦU về chọc thủng, sức kháng uốn, cốt thép tối thiểu, khống chế nứt, sức kháng cắt tại các mặt cắt I-I, II-II' +
          (R.stmB && R.stmB.need && R.stmB.strict ? ' và theo mô hình chống - giằng.' : '.')
        : 'Bệ trụ KHÔNG ĐẠT - xem các hạng mục NG ở trên.') +
      (deepB && Q.stmb !== 'none'
        ? ` <span class="small">Có cọc cách mép thân trụ nhỏ hơn 2dv: bệ là cấu kiện cao, kết quả mô hình chống - giằng ở mục 6.</span>`
        : '');
  }
}

// ---------------------------------------------------------------------------
// 7. Orchestrator (`dcStep`), Canonical Result Adapter & Bridge Hook Wiring
// ---------------------------------------------------------------------------

export function toSolidPierResult(R: DcCalcResult | null | undefined = latestDcResult): PierResult | null {
  if (!R || (R.err && R.err.length)) return null;
  const Q = R.Q;
  const G = R.G;
  const I = R.I;

  let buckling: PierResult['buckling'] = undefined;
  if (R.M && R.col?.S) {
    const lu = Q.H2 + (Q.H3 > 0 ? Q.H3 : 0);
    const K = Q.K || 2.1;
    const rx = Math.sqrt(G.Ix / G.Ath);
    const ry = Math.sqrt(G.Iy / G.Ath);
    const slT = (K * lu) / rx;
    const slL = (K * lu) / ry;
    const Ec = R.M.Ec * 1000;
    const Es = 2e8;
    const EI0T = (Ec * G.Ix) / 5 + Es * (R.col.S.Isx * 1e-12);
    const EI0L = (Ec * G.Iy) / 5 + Es * (R.col.S.Isy * 1e-12);
    const PeT = (PI2 * EI0T) / (K * lu) ** 2;
    const PeL = (PI2 * EI0L) / (K * lu) ** 2;
    buckling = {
      PeT,
      PeL,
      PeTb: PeT,
      PeLb: PeL,
      slenderMax: Math.max(slT, slL),
      swayFlag: false,
    };
  }

  let seismic: PierResult['seismic'] = undefined;
  const eq = R.LD?.info?.EQ;
  if (eq) {
    seismic = {
      T: Math.max(eq.dx.T, eq.dy.T),
      Cms: Math.max(eq.dx.c, eq.dy.c),
      zone: I.A <= 0.09 ? 1 : I.A <= 0.19 ? 2 : I.A <= 0.29 ? 3 : 4,
    };
  }

  return {
    variant: 'solid',
    geom: {
      B: Q.B,
      C5: Q.C5,
      B2: Q.B2,
      C2: Q.C2,
      H2: Q.H2,
      B1: Q.B1,
      C1: Q.C1,
      H1: Q.H1,
      ELt: G.ELt,
      ELcb: G.ELcb,
      ELtb: G.ELtb,
      ELbb: G.ELbb,
      Ath: G.Ath,
      Ix: G.Ix,
      Iy: G.Iy,
    },
    combos: (R.C2 || []).map((c) => ({
      id: c.id,
      st: c.st,
      tot: {
        N: c.tot.Hz,
        Hx: c.tot.Hx,
        My: c.tot.My,
        Hy: c.tot.Hy,
        Mx: c.tot.Mx,
      } satisfies ForceVector5,
    })),
    buckling,
    capCheck: R.capCheck ? (R.capCheck as RcSectionResult) : undefined,
    stemCheck: {
      pmBiaxial: R.col
        ? {
            angles: R.col.PT.T.length,
            depths: R.col.PT.T[0]?.pts.length ?? 0,
            maxUtilRatio: R.col.maxRatio,
            ok: R.col.okPM,
          }
        : undefined,
    },
    footingCheck: {
      rcX: R.footRcX ? (R.footRcX as RcSectionResult) : undefined,
      rcY: R.footRcY ? (R.footRcY as RcSectionResult) : undefined,
      punchingOk: R.footPunOk,
      stmActive: Boolean(R.stmB?.need),
      stmOk: R.stmB?.ok,
    },
    seismic,
    okAll: Boolean(
      R.capOK && R.colOK && R.beOK && (!latestDcSfdResult || latestDcSfdResult.ok),
    ),
  };
}

export function dcStep(): DcCalcResult | null {
  if (!dcOn()) return null;
  dcVis();
  seedSolidRcDefaults();

  try {
    trLink();
  } catch (e) {
    console.error(e);
  }

  const I = trInputs();
  const Q = dcInputs();
  I.eta = Number(Q.eta) || 1;
  const nm = (I.name || '').trim().toUpperCase();
  set('o_td_ttl1', 'TẢI TRỌNG VÀ TỔ HỢP TẢI TRỌNG TRỤ ĐẶC' + (nm ? ' ' + nm : ''));
  (
    [
      ['o_dc_ttl46', 'KIỂM TOÁN XÀ MŨ TRỤ ĐẶC'],
      ['o_dc_ttl47', 'KIỂM TOÁN THÂN TRỤ ĐẶC THEO VẬT LIỆU'],
      ['o_dc_ttl48', 'KIỂM TOÁN BỆ TRỤ ĐẶC'],
    ] as const
  ).forEach(([id, t]) => set(id, t + (nm ? ' ' + nm : '')));

  let R: DcCalcResult;
  try {
    R = dcCalc(I, Q);
  } catch (e) {
    console.error(e);
    set('o_dt_err', 'Lỗi tính toán trụ: ' + (e instanceof Error ? e.message : String(e)));
    return null;
  }

  set('o_dt_err', R.err ? R.err.join('<br>') : '');
  set('o_td_err', R.err ? R.err.join('<br>') : '');
  if (R.err && R.err.length) {
    latestDcResult = null;
    return R;
  }
  latestDcResult = R;

  const G = R.G;
  try {
    trXFtab(G.XF, G.xg, G.HK, 'Chiều cao đá kê', 0);
  } catch (e) {
    console.error(e);
  }

  set('o_dt_Ath', dcF(G.Ath, 4));
  set('o_dt_ELcb', dcF(G.ELcb, 3));
  set('o_dt_ELtb', dcF(G.ELtb, 3));
  set('o_dt_ELbb', dcF(G.ELbb, 3));

  {
    const setText = (id: string, val: string | number) => {
      const e = $(id);
      if (e) e.textContent = String(val);
    };
    setText('o_td_V', fx(I.VB * I.S, 2));
    setText('o_td_Bxe', fx(I.Wd - I.bl - I.br2, 3));
    if (R.LD) setText('o_td_nL', R.LD.info.LL.nL);
    ([1, 2] as const).forEach((k) => {
      setText('o_td_Ls' + k, fx(Number(I['L' + k]) - 2 * I.a0, 3));
    });
    if (R.M) setText('o_td_Ec', fx(R.M.Ec, 1));
    setText('o_td_ELs', fx(G.ELs, 3));
    if (R.LD) setText('o_td_Cce', fx(R.LD.info.LL.Cce, 4));
  }

  try {
    dcRender20(R);
  } catch (e) {
    console.error(e);
  }
  try {
    if (R.LD) trFigIL({ I: R.I, LO: R.LD.info.LL.LO });
  } catch (e) {
    console.error(e);
  }
  try {
    dcFigEl(R);
  } catch (e) {
    console.error(e);
  }
  try {
    dcRender46(R);
  } catch (e) {
    console.error(e);
  }
  try {
    dcRender47(R);
  } catch (e) {
    console.error(e);
  }
  try {
    dcFeedPile(R);
  } catch (e) {
    console.error(e);
  }
  try {
    latestDcSfdResult = sfdStep(R as unknown as SolidPierForSfdInput, dcOn);
  } catch (e) {
    console.error(e);
    latestDcSfdResult = null;
  }
  try {
    dcRender48(R);
  } catch (e) {
    console.error(e);
  }

  if (typeof document !== 'undefined') {
    mathAll();
  }

  const hooks = getVisualHooks();
  hooks.renderPierSolid?.({
    result: {
      raw: R,
      summary: toSolidPierResult(R),
      sfd: latestDcSfdResult,
      sfCapFig: R.sfCapFig ?? null,
    },
  });
  hooks.renderMath?.();

  return R;
}

export function registerSolidPierHooks(): void {
  registerPierSolidBridgeHooks({
    dcOn,
    dcVis,
    dcStep,
  });
}

registerSolidPierHooks();
