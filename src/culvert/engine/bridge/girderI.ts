// ============================================================================
// KẾT CẤU PHẦN TRÊN: DẦM I BTCT DƯL CĂNG SAU, LIÊN HỢP BẢN MẶT CẦU ĐỔ TẠI CHỖ
// Tiêu chuẩn: TCVN 11823:2017 (AASHTO LRFD 7th Ed.)
// Đơn vị nội bộ: mm, N, MPa ; kết quả xuất: kN, kN.m, m, MPa
// ============================================================================

import type {
  GirderBranchResult,
  GirderResult,
  GirderSystemType,
  Point2D,
} from '../../types/project.ts';
import { $, fx, getVisualHooks, num, nums } from '../context.ts';
import { DGSTY, dgDefs, dgKit } from '../../graphics/svgPrimitives.ts';
import { mathAll } from '../../graphics/texMath.ts';
import { objLinkOff, objUnlock, xfLink } from './crossfall.ts';
import {
  DAM,
  damLink,
  evalDamLimits,
  getGirderHollowHooks,
  getLatestDamResult,
  getLatestLim,
  setLatestDamResult,
  setLatestLim,
  spBRsync,
  spInputs,
  spType,
  spTypeApply,
  spV,
  type DamCompositeResult,
  type DamLimits,
  type DamSpInput,
  type GirderHollowHooks,
  type GirderHollowStepOptions,
  type LeverRuleResult,
} from './girderHollow.ts';

export { spType, spTypeApply, spBRsync, spV, damLink };

const PI = Math.PI;
const sq = Math.sqrt;
const { poly, widthAt, EcOf, wcOf, b1Of } = DAM;

// ============================================================================
// Domain Interfaces & Types
// ============================================================================

export type GiCabTuple = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

export type GiStirrupZone =
  | [number, number, number]
  | [number, number, number, number];

export type GiDiaphragmTuple = [number, number];

export interface GiAnchorInput {
  type: string;
  a: number;
  b: number;
  lc: number;
  smin: number;
  emin: number;
  fciMin: number;
  bhd: number;
  bhn: number;
  bhs: number;
  spd: number;
  spn: number;
}

export interface GiInput {
  H: number;
  b1: number;
  h1: number;
  h2: number;
  bw: number;
  h4: number;
  b3: number;
  h5: number;
  b4: number;
  h6: number;
  bwE: number;
  Le: number;
  Ltr: number;
  nstr: number;
  D: number;
  mu: number;
  K: number;
  set: number;
  cab: GiCabTuple[];
  sz: GiStirrupZone[];
  sd: number;
  sn: number;
  cd: number;
  cn: number;
  ag?: number;
  As: [number, number, number];
  AsT: [number, number, number];
  Apan: number;
  tpan?: number;
  dn: GiDiaphragmTuple[];
  idMode?: string;
  Tu?: number;
  an: GiAnchorInput;
  kind?: 'giua' | 'bien';
}

export interface GiLibEntry {
  name: string;
  sp: {
    Lt: number;
    a0: number;
    Ng: number;
    S: number;
    hs: number;
    fc: number;
    fci: number;
    fcs: number;
    Ep: number;
    fpjr: number;
    ti: number;
    td: number;
    RH: number;
    hm: string;
  };
  g: GiInput;
  gc: {
    L: number;
    W: number;
    n: number;
    hri: number;
    hc: number;
    hs: number;
    nb: number;
  };
  bm: {
    bm_dTa: number;
    bm_sTa: number;
  };
}

export interface GiShapeResult {
  P: Point2D[];
  b2: number;
  h2: number;
  h3: number;
  h4: number;
  b5: number;
  b6: number;
}

export interface GiCachedShape extends GiShapeResult {
  A: number;
  yb: number;
  I: number;
}

export interface GiLeverRuleResult extends LeverRuleResult {
  j?: number;
}

export interface GiTendon {
  i: number;
  L1: number;
  L2: number;
  L3: number;
  L4: number;
  yE: number;
  zE: number;
  yM: number;
  zM: number;
  Lx: number;
  Lp: number;
  a: number;
  y: (xc: number) => number;
  dy: (xc: number) => number;
  z: (xc: number) => number;
  dz: (xc: number) => number;
  xs: number[];
  ss: number[];
  al: number[];
  len: number;
  fF: number[];
  lset: number;
  fl: number;
  dlt: number;
  fA: number[];
  whole: boolean;
  pSet: number;
  fAnc: number;
  fAmax: number;
  fFmid: number;
  fAmid: number;
  elong: number;
}

export interface GiSectionTendonPoint {
  y: number;
  z: number;
  th: number;
  tz: number;
}

export interface GiSectionProps {
  X: number;
  x: number;
  g: GiCachedShape;
  tp: Array<GiSectionTendonPoint | null>;
  n: number;
  ycg: number;
  A1: number;
  yb1: number;
  I1: number;
  A2: number;
  yb2: number;
  I2: number;
  A3: number;
  yb3: number;
  I3: number;
  Agc: number;
  ybgc: number;
  Igc: number;
  d: number;
}

export interface GiSectionCable {
  i: number;
  y: number;
  z: number;
  th: number;
  tz: number;
  fF: number;
  fA: number;
  fpt: number;
  c: number;
  sn: number;
  fpd: number;
  fpe: number;
}

export interface GiAxlePlacement {
  a: number;
  P: number;
  y: number;
}

export interface GiVehicleEnvelope {
  v: number;
  pos: number | null;
  veh: number[][] | null;
  ax?: GiAxlePlacement[];
}

export interface GiTensCheck {
  T: number;
  Areq: number;
  Aprov: number;
  lim: number;
  reinf: boolean;
}

export interface GiFlexCableStress {
  i: number;
  dp: number;
  fps: number;
}

export interface GiSectionRes {
  x: number;
  tag: string;
  X: number;
  sc: GiSectionProps;
  cab: GiSectionCable[];
  nb: number;
  Aps: number;
  ycg: number;
  e: number;
  ec: number;
  M1: number;
  M1t: number;
  M2: number;
  M3: number;
  MW: number;
  MPL: number;
  V1: number;
  V2: number;
  V3: number;
  VW: number;
  VPL: number;
  bT: GiVehicleEnvelope;
  bD: GiVehicleEnvelope;
  MLv: number;
  MLl: number;
  MLL1: number;
  vT: GiVehicleEnvelope;
  vD: GiVehicleEnvelope;
  VLv: number;
  VLl: number;
  VLL1: number;
  MLL: number;
  VLL: number;
  Mu: number;
  Vu: number;
  fpt: number;
  fptL: number;
  dR1: number;
  Kid: number;
  fcgp: number;
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
  fpe: number;
  dT: number;
  Pt: number;
  Mpt: number;
  dPd: number;
  dPe: number;
  dMd: number;
  dMe: number;
  Pd: number;
  Pe: number;
  Mpe: number;
  Vp: number;
  s1t: number;
  s1b: number;
  tr: GiTensCheck;
  s2t: number;
  s2b: number;
  ftP: number;
  fbP: number;
  ftI: number;
  fbI: number;
  ftIII: number;
  fbIII: number;
  fdP: number;
  fdI: number;
  fdIII: number;
  Mfat: number;
  ftFat: number;
  c: number;
  a: number;
  web: boolean;
  phi: number;
  et: number;
  Mn: number;
  Mr: number;
  fps: GiFlexCableStress[];
  T: number;
  cN: number;
  MnN: number;
  MrN: number;
  MuN: number;
  phiN: number;
  fcpe: number;
  Mcr: number;
  Mmin: number;
  Scm: number;
  Snc: number;
  Mdnc: number;
  nv: number;
  de: number;
  dv: number;
  bv: number;
  ybv: number;
  es: number;
  esNeg: boolean;
  Act: number;
  beta: number;
  th: number;
  s: number;
  sxe: number;
  Vc: number;
  Vs: number;
  Vlim: number;
  Vn: number;
  Vr: number;
  Avmin: number;
  Av: number;
  hasMin: boolean;
  vu: number;
  smax: number;
  needAv: boolean;
  Treq: number;
  Tprov: number;
  esOwn: number;
  Acp: number;
  Pc3: number;
  fpc: number;
  Tcr: number;
  Tu: number;
  torOK: boolean;
  dvi: number;
  bvi: number;
  Vui: number;
  Vni: number;
  Vri: number;
  Avf: number;
  Avfmin: number;
  Pc: number;
  yt1: number;
  yt2: number;
  yt3: number;
  ysl: number;
  ftIT?: number;
  fbIIIT?: number;
  fdIT?: number;
}

export interface GiDistRange {
  S: boolean;
  ts: boolean;
  L: boolean;
  Nb: boolean;
  Kg: boolean;
  de: boolean;
}

export interface GiDistFactors {
  Kn: number;
  eg: number;
  Kg: number;
  KL: number;
  gM1: number;
  gM2: number;
  gV1: number;
  gV2: number;
  levI1: GiLeverRuleResult;
  levIn: GiLeverRuleResult;
  levE1: GiLeverRuleResult;
  levEn: GiLeverRuleResult;
  de: number;
  Nb3: boolean;
  nb2: boolean;
  range: GiDistRange;
  nL: number;
  MI: number;
  VI: number;
  eM: number;
  eV: number;
  deE: number;
  VEm?: number;
  MEm?: number;
  ME: number;
  VE: number;
  th: number;
  c1: number;
  cM: number;
  cV: number;
  levS?: boolean;
  levDe?: boolean;
  M0: number;
  V0: number;
  M: number;
  V: number;
  Mf: number;
}

export interface GiDiaphragmLoad {
  x: number;
  P: number;
}

export interface GiLoadsSummary {
  w1: number;
  Vg: number;
  wDeck: number;
  wPan: number;
  dn: GiDiaphragmLoad[];
  w2: number;
  curb: number;
  rail: number;
  side: number;
  w3: number;
  wDWs: number;
  DWu: number;
  wDW: number;
  wPL: number;
  qPLs: number;
  bdk: number;
  DC4?: number;
  DW?: number;
}

export interface GiStationPoint {
  y: number;
  z: number;
  av: number;
  ah: number;
  s: number;
  fF: number;
  fA: number;
  al: number;
}

export interface GiStation {
  xc: number;
  tc: Array<GiStationPoint | null>;
}

export interface GiThermalStress {
  dk: number;
  gt: number;
  gb: number;
  A: number;
  kap: number;
}

export interface GiAncPlane {
  h: number;
  aG: number;
  e: number;
  sA: number;
  ar: number;
  T160: number;
  d161: number;
}

export interface GiAncEqm {
  M: Point2D[];
  Mx: number;
  yMx: number;
  Mn: number;
  yMn: number;
  Tb: number;
  Ts: number;
  yc: number;
  Me: number;
}

export interface GiAncLoc {
  special: boolean;
  smin?: number;
  emin?: number;
  fciMin?: number;
  sOK?: boolean;
  eOK?: boolean;
  fOK?: boolean;
  lzW?: number;
  kA?: number;
  Aa?: number;
  Ag?: number;
  Ab?: number;
  fn?: number;
  Pr?: number;
  ok?: boolean;
}

export interface GiAncGeoCheck {
  X: number;
  ft: number;
  fb: number;
  f: number;
  bw: number;
}

export interface GiAncNode {
  i: number;
  y: number;
  z: number;
  av: number;
  ah: number;
  Pu: number;
}

export interface GiAncResult {
  fcaD: number;
  wIn: number;
  dS: number;
  bS: number;
  AS: number;
  fS: number;
  geo: GiAncGeoCheck[];
  fGeo: number;
  an: Partial<GiAnchorInput>;
  a: number;
  b: number;
  X0: number;
  Pu1: number;
  SP: number;
  AN: GiAncNode[];
  tw: number;
  Lz: number;
  yb0: number;
  yr: number;
  zr: number;
  PV: GiAncPlane;
  PH: GiAncPlane;
  EV: GiAncEqm;
  EH: GiAncEqm;
  TbV: number;
  TbH: number;
  cond: Array<[string, string, boolean]>;
  approxOK: boolean;
  aeff: number;
  beff: number;
  sV: number;
  sH: number;
  K: number;
  nK: number;
  lc: number;
  Ab: number;
  fca: number;
  fcaL: number;
  s1: number;
  nv1: number;
  LdV: number;
  LdH: number;
  nSt: number;
  AsV: number;
  AsVr: number;
  Abh: number;
  nMe: number;
  AsH: number;
  AsHr: number;
  smaxV: number;
  smaxH: number;
  close: boolean;
  Tsp: number;
  AspR: number;
  Asp: number;
  Tedge: number;
  AsL: number;
  AsLr: number;
  feT: number;
  feB: number;
  edV: number;
  edH: number;
  loc: GiAncLoc;
  ok: {
    fca: boolean;
    V: boolean;
    H: boolean;
    sp: boolean;
    edge: boolean;
    loc: boolean;
    all: boolean;
  };
  XF: number;
  P0: Point2D[];
  shF: GiCachedShape;
}

export type GiSummaryItem = [string, string | number, string, boolean];

export interface GiInterfaceParams {
  c: number;
  mu: number;
  K1: number;
  K2: number;
  t: string;
}

export interface GiCalcResult {
  rx: GiSectionRes[];
  phiW: number;
  lamW: number;
  kind: 'giua' | 'bien' | undefined;
  L: number;
  Ls: number;
  Lm: number;
  brg: number;
  H: number;
  hs: number;
  hsw: number;
  hc: number;
  beff: number;
  oh: number;
  de: number;
  Ec: number;
  Eci: number;
  Ecs: number;
  np: number;
  ncs: number;
  fpj: number;
  fpy: number;
  Ap1: number;
  Apc: number;
  Aps: number;
  nC: number;
  T: GiTendon[];
  ES: {
    P: number;
    e: number;
    A1: number;
    I1: number;
    M1: number;
    fcgp: number;
    N: number;
    dES: number;
  };
  dES: number;
  loads: GiLoadsSummary;
  DF: GiDistFactors;
  IM: number;
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
    fcsi: number;
  };
  res: GiSectionRes[];
  rv: GiSectionRes;
  xv: number;
  stations: GiStation[];
  camber: {
    dps: number;
    dsw: number;
    d0: number;
    rLT: number;
    dtd: number;
    dcr: number;
    dDk2: number;
    dDk3: number;
    dDeck: number;
    dtr: number;
    dlane: number;
    dLL1: number;
    dLL2: number;
    DFd: number;
    mL: number;
    lim: number;
    I2m: number;
    I3m: number;
  };
  TG: {
    pos: GiThermalStress;
    neg: GiThermalStress;
    g: number;
  };
  Rg: { DC: number; DW: number };
  EIc: number;
  IF: GiInterfaceParams;
  As: number;
  AsT: number;
  ys: number;
  ysT: number;
  Ab1: number;
  Avf1: number;
  fsT: number;
  ftl: number;
  secAt: (X: number) => GiSectionProps;
  shp: (X: number) => GiCachedShape;
  gm: GiCachedShape;
  Vg: number;
  vol: number;
  jointTot: number;
  lev: { xsG: number[]; xa: number; xb: number };
  anc: GiAncResult;
  dd?: Point2D[];
  items?: GiSummaryItem[];
  allOK?: boolean;
}

export interface GiCompositeResult extends Omit<DamCompositeResult, 'type' | 'g' | 'b' | 'GG' | 'G0'> {
  type: 'I';
  g: GiCalcResult;
  b: GiCalcResult;
  GG: {
    g: { dd: Point2D[]; voids: never[]; H: number; noJoint: boolean };
    b: { dd: Point2D[]; voids: never[]; H: number; noJoint: boolean; de: number };
  };
  G0: GiInput;
}

export interface GidChartSeries {
  n: string;
  x: number[];
  y: number[];
  c: string;
  mk?: string;
  dash?: boolean;
  w?: number;
}

export interface GidChartOptions {
  id: string;
  title: string;
  xt?: string;
  yt?: string;
  W?: number;
  H?: number;
  series: GidChartSeries[];
  xmin?: number;
  xmax?: number;
  ymin?: number;
  ymax?: number;
  xticks?: number[];
  xdec?: number;
}

// ============================================================================
// GI: Post-Tensioned I-Girder Solver (TCVN 11823:2017)
// ============================================================================

export const GI = (() => {
  // Suppress unused import lint if wcOf is retained purely for formula symmetry
  void wcOf;

  // ---- thư viện: dầm I33 theo hồ sơ công trình mẫu (cầu trên tuyến, dầm I BTCT DƯL L = 33 m) ----
  const LIB: Record<'33', GiLibEntry> = {
    33: {
      name: 'Dầm I BTCT DƯL căng sau L = 33 m',
      sp: {
        Lt: 33,
        a0: 0.4,
        Ng: 3,
        S: 2.4,
        hs: 0.2,
        fc: 40,
        fci: 40,
        fcs: 30,
        Ep: 197000,
        fpjr: 0.75,
        ti: 4,
        td: 90,
        RH: 85,
        hm: 'Kết cấu phần trên - dầm I BTCT DƯL L = 33 m',
      },
      g: {
        H: 1650,
        b1: 650,
        h1: 250,
        h2: 200,
        bw: 200,
        h4: 110,
        b3: 850,
        h5: 120,
        b4: 650,
        h6: 80,
        bwE: 650,
        Le: 1200,
        Ltr: 1000,
        D: 80,
        nstr: 12,
        mu: 0.25,
        K: 0.001,
        set: 6,
        cab: [
          [150, 0, 0, 0, 1340, 0, 380, 0],
          [150, 0, 0, 0, 1065, 0, 245, 0],
          [150, 0, 0, 0, 790, 0, 110, 0],
          [150, 0, 4343, 8007, 515, 0, 110, 110],
          [150, 0, 4343, 8007, 240, 0, 110, -110],
        ],
        sz: [
          [0, 5000, 100, 3],
          [5000, 10000, 300, 2],
          [10000, 16500, 300, 1],
        ],
        sd: 18,
        sn: 2,
        cd: 18,
        cn: 0,
        As: [6, 16, 50],
        AsT: [4, 14, 1600],
        Apan: 0.07,
        dn: [
          [0, 2.025],
          [8.1, 1.013],
          [16.1, 1.013],
          [24.1, 1.013],
          [32.2, 2.025],
        ],
        an: {
          type: 'S',
          a: 250,
          b: 250,
          lc: 250,
          smin: 270,
          emin: 165,
          fciMin: 0,
          bhd: 14,
          bhn: 6,
          bhs: 150,
          spd: 14,
          spn: 6,
        },
      },
      gc: { L: 350, W: 450, n: 5, hri: 10, hc: 5, hs: 3, nb: 1 },
      bm: { bm_dTa: 14, bm_sTa: 150 },
    },
  };

  // ---- hình học mặt cắt (mm): bề rộng sườn thay đổi theo khoảng cách d tới đầu dầm gần nhất ----
  function shapeOf(G: GiInput, b2: number): GiShapeResult {
    const { H, b1, h1, b3, h5, b4, h6 } = G;
    const h2 = b1 > G.bw + 1e-9 ? (G.h2 * Math.max(0, b1 - b2)) / (b1 - G.bw) : 0;
    const h4 = b3 > G.bw + 1e-9 ? (G.h4 * Math.max(0, b3 - b2)) / (b3 - G.bw) : 0;
    const yB = h1 + h2;
    const yE = H - h6;
    const yD = yE - h5;
    const yC = yD - h4;
    const h3 = yC - yB;
    const R: Point2D[] = [
      [b1 / 2, 0],
      [b1 / 2, h1],
      [b2 / 2, yB],
      [b2 / 2, yC],
      [b3 / 2, yD],
      [b3 / 2, yE],
      [b4 / 2, yE],
      [b4 / 2, H],
    ];
    const P: Point2D[] = [
      ...R.map(([x, y]): Point2D => [x, y]),
      ...R.slice()
        .reverse()
        .map(([x, y]): Point2D => [-x, y]),
    ];
    return {
      P,
      b2,
      h2,
      h3,
      h4,
      b5: Math.max(0, (b1 - b2) / 2),
      b6: Math.max(0, (b3 - b2) / 2),
    };
  }

  const bwAt = (G: Pick<GiInput, 'Le' | 'Ltr' | 'bw' | 'bwE'>, d: number): number =>
    d <= G.Le
      ? G.bwE
      : G.Ltr > 0 && d < G.Le + G.Ltr
        ? G.bwE + ((G.bw - G.bwE) * (d - G.Le)) / G.Ltr
        : G.bw;

  // ---- hệ số làn (TCVN 11823-3, Bảng 7) ----
  const mOf = (k: number): number => (k === 1 ? 1.2 : k === 2 ? 1 : k === 3 ? 0.85 : 0.65);

  // ---- quy tắc đòn bẩy (Phụ lục / Điều 6.2.2 Phần 4): xếp k xe (vệt bánh 1,8 m; bánh cách mép làn ≥ 0,6 m; làn 3,6 m) bất lợi nhất bằng quy hoạch động ----
  function leverRule(
    xs: readonly number[],
    j: number,
    xa: number,
    xb: number,
    nL: number,
    mUse: boolean,
  ): GiLeverRuleResult {
    const n = xs.length;
    const y = (x: number): number => {
      let v = 0;
      if (j > 0 && x > xs[j - 1] && x <= xs[j]) v = (x - xs[j - 1]) / (xs[j] - xs[j - 1]);
      else if (j < n - 1 && x >= xs[j] && x < xs[j + 1]) v = (xs[j + 1] - x) / (xs[j + 1] - xs[j]);
      else if (j === 0 && x < xs[0]) v = 1 + (xs[0] - x) / (n > 1 ? xs[1] - xs[0] : 1);
      else if (j === n - 1 && x > xs[n - 1])
        v = 1 + (x - xs[n - 1]) / (n > 1 ? xs[n - 1] - xs[n - 2] : 1);
      return Math.max(0, v);
    };
    // làn thiết kế rộng 3,6 m đặt bất kỳ trong phần xe chạy, không chồng lấn; trong mỗi làn vệt bánh 1,8 m cách mép làn ≥ 0,6 m (Điều 6.1.3.1 Phần 3)
    const h = 0.01;
    const lo = xa;
    const hi = xb - 3.6;
    if (hi < lo - 1e-9) return { g: 0, k: 0, pos: [] };
    const N = Math.floor((hi - lo) / h + 1e-9) + 1;
    const Ls_ = Array.from({ length: N }, (_, i) => lo + i * h);
    const du = Math.round(0.6 / h);
    const bestIn = Ls_.map((l) => {
      let b = -1;
      let bt = 0;
      for (let k = 0; k <= du; k++) {
        const t = l + 0.6 + k * h;
        const v = 0.5 * (y(t) + y(t + 1.8));
        if (v > b) {
          b = v;
          bt = t;
        }
      }
      return { v: b, t: bt };
    });
    const gap = Math.round(3.6 / h);
    let best: GiLeverRuleResult = { g: 0, k: 0, pos: [] };
    let prev = bestIn.map((o) => ({ v: o.v, p: [o.t] }));
    for (let k = 1; k <= Math.max(1, nL); k++) {
      if (k > 1) {
        const nx: Array<{ v: number; p: number[] }> = [];
        let run: { v: number; p: number[] } = { v: -1, p: [] };
        for (let i = 0; i < N; i++) {
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
      const mm = mUse ? mOf(k) : 1;
      const g = mm * top.v;
      if (g > best.g) best = { g, k, pos: top.p, R: top.v, m: mm };
    }
    return best;
  }

  // ---- mặt cắt và cáp tại vị trí X (mm, tính từ đầu dầm trái) ----
  function calc(I: DamSpInput, G: GiInput): GiCalcResult {
    const L = I.Lt * 1000;
    const brg = I.a0 * 1000;
    const Ls = L - 2 * brg;
    const Lm = Ls / 1000;
    const Ng = I.Ng;
    const S = I.S * 1000;
    const fc = I.fc;
    const fci = I.fci;
    const fcs = I.fcs;
    const Ec = EcOf(fc, I.K1);
    const Eci = EcOf(fci, I.K1);
    const Ecs = EcOf(fcs, I.K1);
    const Ep = I.Ep;
    const fpu = I.fpu;
    const fpy = I.fpyr * fpu;
    const fpj = I.fpjr * fpu;
    const Ap1 = I.Ap1;
    const fy = I.fy;
    const Es = I.Es;
    const np = Ep / Ec;
    const ncs = Ecs / Ec;
    const H = G.H;
    const hsw = I.hs * 1000;
    const hs = (I.hs - I.hwear) * 1000;
    const hc = H + hs;
    const gc = I.gc;
    const kind = G.kind;
    const ext = kind === 'bien';
    const nC = G.cab.length;
    const Apc = G.nstr * Ap1;
    const Aps = nC * Apc;
    const Dd = G.D;
    const Ad1 = (PI * Dd * Dd) / 4;
    const oh = (I.Wb * 1000) / 2 - ((Ng - 1) / 2) * S; // phần hẫng tính từ tim dầm biên
    const beff = ext ? S / 2 + oh : S; // Điều 6.2.6.1 Phần 4
    const de = oh - I.Wpa * 1000 - (I.WPL || 0) * 1000; // tim dầm biên đến mép trong gờ chắn

    // ---- cáp: phương trình tuyến (tọa độ xc tính từ giữa dầm) ----
    const T: GiTendon[] = G.cab.map((c, i) => {
      const [L1, L2, L3, L4, yE, zE, yM, zM] = c;
      const Lx = L / 2 - L1;
      const Lp = Lx - L2;
      const a = Lp > 0 ? (yE - yM) / (Lp * Lp) : 0;
      const y = (xc: number): number => yM + a * Math.max(0, xc - L2) ** 2;
      const dy = (xc: number): number => 2 * a * Math.max(0, xc - L2);
      const z = (xc: number): number =>
        xc <= L3 ? zM : L4 > 0 && xc < L3 + L4 ? zM + ((zE - zM) * (xc - L3)) / L4 : zE;
      const dz = (xc: number): number => (L4 > 0 && xc > L3 && xc < L3 + L4 ? (zE - zM) / L4 : 0);
      // rời rạc tuyến cáp từ neo (đầu kích) tới giữa dầm: chiều dài s và tổng góc chuyển hướng α (cộng véc tơ theo đường cáp, Điều 9.5.2.2.2)
      const N = Math.max(200, Math.ceil(Lx / 25));
      const xs: number[] = [];
      const ss: number[] = [];
      const al: number[] = [];
      let s = 0;
      let A = 0;
      let pv: number[] | null = null;
      let pp: [number, number, number] | null = null;
      for (let k = 0; k <= N; k++) {
        const xc = Lx * (1 - k / N);
        const p: [number, number, number] = [-xc, y(xc), z(xc)];
        if (pp) {
          const d: [number, number, number] = [p[0] - pp[0], p[1] - pp[1], p[2] - pp[2]];
          const l = Math.hypot(...d);
          const u = d.map((v) => v / l);
          s += l;
          if (pv) {
            const dot = Math.max(-1, Math.min(1, u[0] * pv[0] + u[1] * pv[1] + u[2] * pv[2]));
            A += Math.acos(dot);
          }
          pv = u;
        }
        xs.push(xc);
        ss.push(s);
        al.push(A);
        pp = p;
      }
      return {
        i: i + 1,
        L1,
        L2,
        L3,
        L4,
        yE,
        zE,
        yM,
        zM,
        Lx,
        Lp,
        a,
        y,
        dy,
        z,
        dz,
        xs,
        ss,
        al,
        len: 2 * s,
        fF: [],
        lset: 0,
        fl: 0,
        dlt: 0,
        fA: [],
        whole: false,
        pSet: 0,
        fAnc: 0,
        fAmax: 0,
        fFmid: 0,
        fAmid: 0,
        elong: 0,
      };
    });

    const mu = G.mu;
    const Kf = G.K / 1000; // K: 1/m -> 1/mm
    // ma sát (PT 123) và tụt neo (Điều 9.5.2.1): kéo căng đồng thời từ hai đầu, đối xứng
    T.forEach((t) => {
      const n = t.ss.length;
      t.fF = t.ss.map((s, k) => fpj * Math.exp(-(Kf * s + mu * t.al[k])));
      const C = [0];
      for (let k = 1; k < n; k++)
        C.push(C[k - 1] + 0.5 * (t.fF[k] + t.fF[k - 1]) * (t.ss[k] - t.ss[k - 1]));
      const EA = Ep * G.set;
      const F = (k: number): number => 2 * (C[k] - t.fF[k] * t.ss[k]) - EA;
      let kk = -1;
      for (let k = 1; k < n; k++)
        if (F(k) >= 0) {
          kk = k;
          break;
        }
      if (kk > 0) {
        const f0 = F(kk - 1);
        const f1 = F(kk);
        const r = f0 < f1 ? -f0 / (f1 - f0) : 1;
        const l = t.ss[kk - 1] + r * (t.ss[kk] - t.ss[kk - 1]);
        const fl = t.fF[kk - 1] + r * (t.fF[kk] - t.fF[kk - 1]);
        t.lset = l;
        t.fl = fl;
        t.dlt = 0;
        t.fA = t.ss.map((s, k) => (s < l ? 2 * fl - t.fF[k] : t.fF[k]));
        t.whole = false;
      } else {
        const Lh = t.ss[n - 1];
        const fh = t.fF[n - 1];
        const dlt = (EA - 2 * (C[n - 1] - fh * Lh)) / Lh;
        t.lset = Lh;
        t.fl = fh;
        t.dlt = dlt;
        t.fA = t.fF.map((f) => 2 * fh - f - dlt);
        t.whole = true;
      }
      t.pSet =
        (fpj - t.fF[Math.min(n - 1, Math.max(1, Math.round(n * 0.5)))]) /
        Math.max(1, t.ss[Math.round(n * 0.5)]); // độ dốc trung bình (MPa/mm) - tham khảo
      t.fAnc = t.fA[0];
      t.fAmax = Math.max(...t.fA);
      t.fFmid = t.fF[n - 1];
      t.fAmid = t.fA[n - 1];
      t.elong = (2 * C[n - 1]) / Ep; // độ giãn dài khi kích (hai đầu), mm
    });

    const at = (t: GiTendon, arr: readonly number[], xc: number): number | null => {
      const xs = t.xs;
      if (xc > t.Lx) return null;
      let k = 0;
      while (k < xs.length - 1 && xs[k + 1] > xc) k++;
      const k2 = Math.min(xs.length - 1, k + 1);
      const r = xs[k] === xs[k2] ? 0 : (xs[k] - xc) / (xs[k] - xs[k2]);
      return arr[k] + r * (arr[k2] - arr[k]);
    };

    // ---- đặc trưng mặt cắt tại X ----
    const shapeCache: Record<string, GiCachedShape> = {};
    const shp = (X: number): GiCachedShape => {
      const d = Math.min(X, L - X);
      const b2 = bwAt(G, d);
      const key = b2.toFixed(3);
      return (
        shapeCache[key] ||
        (shapeCache[key] = (() => {
          const sh = shapeOf(G, b2);
          const p = poly(sh.P);
          return { ...sh, A: p.A, yb: p.S / p.A, I: p.I - p.A * (p.S / p.A) ** 2 };
        })())
      );
    };

    const secAt = (X: number): GiSectionProps => {
      const g = shp(X);
      const xc = Math.abs(X - L / 2);
      const tp: Array<GiSectionTendonPoint | null> = T.map((t) =>
        xc <= t.Lx
          ? { y: t.y(xc), z: t.z(xc), th: Math.atan(t.dy(xc)), tz: Math.atan(t.dz(xc)) }
          : null,
      );
      const on = tp.filter((q): q is GiSectionTendonPoint => q !== null);
      const n = on.length;
      const ycg = n ? on.reduce((s, q) => s + q.y, 0) / n : 0;
      // GĐ1: mặt cắt giảm yếu (trừ lỗ ống ghen) ; GĐ2: ống đã bơm vữa, quy đổi cáp (n - 1)Aps ; GĐ3: liên hợp bản (quy đổi ncs)
      const A1 = g.A - n * Ad1;
      const S1 = g.A * g.yb - on.reduce((s, q) => s + Ad1 * q.y, 0);
      const I1o =
        g.I + g.A * g.yb ** 2 - on.reduce((s, q) => s + Ad1 * q.y * q.y + (PI * Dd ** 4) / 64, 0);
      const yb1 = S1 / A1;
      const I1 = I1o - A1 * yb1 ** 2;
      const At = (np - 1) * Apc;
      const A2 = g.A + n * At;
      const S2 = g.A * g.yb + on.reduce((s, q) => s + At * q.y, 0);
      const I2o = g.I + g.A * g.yb ** 2 + on.reduce((s, q) => s + At * q.y * q.y, 0);
      const yb2 = S2 / A2;
      const I2 = I2o - A2 * yb2 ** 2;
      const Ad = beff * hs * ncs;
      const yd = H + hs / 2;
      const A3 = A2 + Ad;
      const yb3 = (A2 * yb2 + Ad * yd) / A3;
      const I3 = I2 + A2 * (yb2 - yb3) ** 2 + ((beff * hs ** 3) / 12) * ncs + Ad * (yd - yb3) ** 2;
      const Agc = g.A + beff * hs * ncs;
      const ybgc = (g.A * g.yb + beff * hs * ncs * yd) / Agc;
      const Igc =
        g.I +
        g.A * (g.yb - ybgc) ** 2 +
        ((beff * hs ** 3) / 12) * ncs +
        beff * hs * ncs * (yd - ybgc) ** 2; // liên hợp nguyên (không kể cáp)
      return {
        X,
        x: X - brg,
        g,
        tp,
        n,
        ycg,
        A1,
        yb1,
        I1,
        A2,
        yb2,
        I2,
        A3,
        yb3,
        I3,
        Agc,
        ybgc,
        Igc,
        d: Math.min(X, L - X),
      };
    };

    // ---- tĩnh tải (kN/m) ----
    let Vg = 0;
    const NW = 660;
    const dXw = L / NW;
    const Wc = [0];
    const Qc = [0];
    {
      for (let i = 0; i < NW; i++) {
        const X = (i + 0.5) * dXw;
        const w = (gc * shp(X).A * 1e-6) / 1000;
        Vg += shp(X).A * dXw;
        Wc.push(Wc[i] + w * dXw);
        Qc.push(Qc[i] + w * dXw * X);
      }
    }
    Vg *= 1e-9; // m3 ; w: kN/mm
    const WQ = (X: number): [number, number] => {
      const r = Math.max(0, Math.min(NW, X / dXw));
      const i = Math.min(NW - 1, Math.floor(r));
      const f = r - i;
      return [Wc[i] + f * (Wc[i + 1] - Wc[i]), Qc[i] + f * (Qc[i + 1] - Qc[i])];
    };
    const Wtot = Wc[NW];
    // mômen (kN.m), lực cắt (kN) do trọng lượng bản thân: dầm kê trên gối (cách đầu dầm a0) ; khi căng kéo dầm kê trên bệ đúc (hai đầu dầm)
    const M1at = (X: number): number => {
      const [W, Q] = WQ(X);
      return ((Wtot / 2) * Math.max(0, X - brg) - (X * W - Q)) / 1000;
    };
    const V1at = (X: number): number => {
      const [W] = WQ(X);
      return (Wtot / 2) * (X >= brg - 1e-9 ? 1 : 0) - W;
    };
    const M1bed = (X: number): number => {
      const [W, Q] = WQ(X);
      return ((Wtot / 2) * X - (X * W - Q)) / 1000;
    };
    const w1 = (gc * Vg) / I.Lt; // DC1: trọng lượng bản thân dầm, quy về phân bố đều
    const bdk = ext ? S / 2 + oh : S;
    const wDeck = (gc * (I.hs + ((ext ? I.hsxB : I.hsxG) || 0)) * bdk) / 1000;
    const tpan = G.tpan || 0;
    const wPan =
      gc *
      (tpan > 0
        ? ext
          ? (tpan * Math.max(0, S - G.b4)) / 2 / 1000 +
            ((G.h6 / 1000) * (Math.max(0, G.b3 - G.b4) / 2 + 0.5 * Math.max(0, oh - G.b3 / 2))) /
              1000
          : (tpan * Math.max(0, S - G.b4)) / 1000
        : G.Apan || 0); // tấm đúc sẵn kê lên hai gờ dưới cánh trên (+ bê tông bản hẫng trên gờ dưới và vút ở dầm biên)
    const dnG: GiDiaphragmLoad[] = (G.dn || []).map(([x, V]) => ({
      x: x * 1000,
      P: gc * V * (ext ? 0.5 : 1),
    })); // dầm ngang: dầm giữa nhận 2 nửa, dầm biên 1 nửa
    const curb = I.Apa * gc;
    const rail = I.Pra / I.Lt / 2;
    const side = ((I.APL || 0) / 2) * gc;
    const WPL = I.WPL || 0;
    const lev = I.curbMode === 'L' && ext;
    const w3 = lev ? curb + rail + side : (2 * (curb + rail + side)) / Ng;
    const wDWs = (I.Hsu * I.gsu * (I.Wb - 2 * I.Wpa - 2 * WPL)) / Ng;
    const wDW = wDWs + I.DWu;
    const qPLs = WPL > 0.6 ? (I.qPL || 3) * WPL : 0;
    const wPL = lev ? qPLs : (2 * qPLs) / Ng;
    const w2 = wDeck + wPan;
    const loads: GiLoadsSummary = {
      w1,
      Vg,
      wDeck,
      wPan,
      dn: dnG,
      w2,
      curb,
      rail,
      side,
      w3,
      wDWs,
      DWu: I.DWu,
      wDW,
      wPL,
      qPLs,
      bdk: bdk / 1000,
    };

    const Mw = (w: number, x: number): number => (w * x * (Lm - x)) / 2;
    const Vw = (w: number, x: number): number => w * (Lm / 2 - x); // x (m) từ tim gối
    const MP = (x: number): number =>
      dnG.reduce((t, o) => {
        const a = o.x / 1000;
        if (a <= 0 || a >= Lm) return t;
        return t + (a <= x ? (o.P * a * (Lm - x)) / Lm : (o.P * x * (Lm - a)) / Lm);
      }, 0);
    const VP = (x: number): number =>
      dnG.reduce((t, o) => {
        const a = o.x / 1000;
        if (a <= 1e-9 || a >= Lm - 1e-9) return t;
        if (a <= x + 1e-9) return t - (o.P * a) / Lm;
        return t + (o.P * (Lm - a)) / Lm;
      }, 0);

    // ---- hoạt tải HL-93 (TCVN 11823-3, Điều 6.1.2) theo đường ảnh hưởng ----
    const truck = [
      [0, 35],
      [4.3, 145],
      [8.6, 145],
    ];
    const truckR = [
      [0, 145],
      [4.3, 145],
      [8.6, 35],
    ];
    const tandem = [
      [0, 110],
      [1.2, 110],
    ];
    const Mi = (x: number, a: number): number =>
      a < 0 || a > Lm ? 0 : a <= x ? (a * (Lm - x)) / Lm : (x * (Lm - a)) / Lm;
    const Vi = (x: number, a: number): number =>
      a < 0 || a > Lm ? 0 : a < x ? -a / Lm : (Lm - a) / Lm;
    const bestOf = (
      x: number,
      f: (x: number, a: number) => number,
      list: number[][][],
    ): GiVehicleEnvelope => {
      let b: GiVehicleEnvelope = { v: 0, pos: null, veh: null };
      list.forEach((veh) =>
        veh.forEach(([p0]) =>
          [-1e-6, 1e-6].forEach((eps) => {
            const pos = x - p0 + eps;
            const v = veh.reduce((t, [p, w]) => t + w * f(x, pos + p), 0);
            if (v > b.v + 1e-9) b = { v, pos, veh };
          }),
        ),
      );
      if (b.veh && b.pos != null) {
        const pos = b.pos;
        b.ax = b.veh.map(([p, w]) => ({ a: pos + p, P: w, y: f(x, pos + p) }));
      }
      return b;
    };
    const IM = I.IM;

    // ---- hệ số phân bố ngang (TCVN 11823-4, Điều 6.2.2; mặt cắt loại k theo Bảng 4) ----
    const gm = shp(L / 2);
    const Kn = Ec / Ecs;
    const eg = H - gm.yb + hs / 2;
    const Kg = Kn * (gm.I + gm.A * eg * eg);
    const Lts3 = Ls * hs ** 3;
    const KL = Kg / Lts3;
    const xsG = Array.from({ length: Ng }, (_, i) => ((i - (Ng - 1) / 2) * S) / 1000);
    const xa = -(I.Wb / 2 - I.Wpa - WPL);
    const xb = -xa;
    const jE = 0;
    const bestJ = (nl: number): GiLeverRuleResult => {
      let b: GiLeverRuleResult | null = null;
      for (let j = Ng > 2 ? 1 : 0; j <= (Ng > 2 ? Ng - 2 : 0); j++) {
        const r = leverRule(xsG, j, xa, xb, nl, true);
        r.j = j;
        if (!b || r.g > b.g) b = r;
      }
      return b!;
    };
    const levI1 = bestJ(1);
    const levIn = bestJ(I.nL);
    const levE1 = leverRule(xsG, jE, xa, xb, 1, true);
    const levEn = leverRule(xsG, jE, xa, xb, I.nL, true);
    const gM1 = 0.06 + (S / 4300) ** 0.4 * (S / Ls) ** 0.3 * KL ** 0.1;
    const gM2 = 0.075 + (S / 2900) ** 0.6 * (S / Ls) ** 0.2 * KL ** 0.1;
    const gV1 = 0.36 + S / 7600;
    const gV2 = 0.2 + S / 3600 - (S / 10700) ** 2;
    const deE = Math.max(de, -300); // Điều 6.2.2.2.3: de âm ngoài phạm vi lấy giới hạn -300 mm
    const ML2 = I.nL >= 2;
    const thSkew = Math.min(60, Math.max(0, I.skew || 0));
    const tSkew = Math.tan((thSkew * PI) / 180);
    const c1Skew = thSkew >= 30 ? 0.25 * KL ** 0.25 * (S / Ls) ** 0.5 : 0;
    const DF: GiDistFactors = {
      Kn,
      eg,
      Kg,
      KL,
      gM1,
      gM2,
      gV1,
      gV2,
      levI1,
      levIn,
      levE1,
      levEn,
      de,
      Nb3: Ng === 3,
      nb2: Ng < 3,
      range: {
        S: S >= 1100 && S <= 4900,
        ts: hs >= 110 && hs <= 300,
        L: Ls >= 6000 && Ls <= 73000,
        Nb: Ng >= 4,
        Kg: Kg >= 4e9 && Kg <= 3e12,
        de: de >= -300 && de <= 1700,
      },
      nL: I.nL,
      MI: 0,
      VI: 0,
      eM: 0.77 + deE / 2800,
      eV: 0.6 + deE / 3000,
      deE,
      ME: 0,
      VE: 0,
      th: I.skew || 0,
      c1: c1Skew,
      cM: 1 - c1Skew * tSkew ** 1.5,
      cV: 1 + 0.2 * (1 / KL) ** 0.3 * tSkew,
      M0: 0,
      V0: 0,
      M: 0,
      V: 0,
      Mf: 0,
    };

    if (Ng < 3) {
      DF.MI = levIn.g;
      DF.VI = levIn.g;
    }
    if (Ng === 3 && !(Ng < 3)) {
      DF.MI = Math.min(ML2 ? Math.max(gM1, gM2) : gM1, levIn.g);
      DF.VI = levIn.g;
    } else if (Ng > 3) {
      DF.MI = ML2 ? Math.max(gM1, gM2) : gM1;
      DF.VI = ML2 ? Math.max(gV1, gV2) : gV1;
    }
    if (Ng < 3) {
      DF.ME = levEn.g;
      DF.VE = levEn.g;
    } else {
      DF.VEm = DF.eV * gV2;
      DF.MEm = Ng === 3 ? Math.min(DF.eM * gM2, levEn.g) : DF.eM * gM2;
      DF.ME = ML2 ? Math.max(levE1.g, DF.MEm) : levE1.g;
      DF.VE = Ng === 3 ? levEn.g : ML2 ? Math.max(levE1.g, DF.VEm) : levE1.g;
    }
    // S ngoài phạm vi (Điều 6.2.2.1) hoặc de > 1700 mm (dầm biên): quy tắc đòn bẩy
    if (!DF.range.S) {
      DF.MI = Math.max(DF.MI, levIn.g, levI1.g);
      DF.VI = Math.max(DF.VI, levIn.g, levI1.g);
      DF.ME = Math.max(DF.ME, levEn.g, levE1.g);
      DF.VE = Math.max(DF.VE, levEn.g, levE1.g);
      DF.levS = true;
    }
    if (de > 1700) {
      DF.ME = Math.max(DF.ME, levEn.g);
      DF.VE = Math.max(DF.VE, levEn.g);
      DF.levDe = true;
    }
    DF.M0 = ext ? DF.ME : DF.MI;
    DF.V0 = ext ? DF.VE : DF.VI;
    DF.M = DF.M0 * DF.cM;
    DF.V = DF.V0 * DF.cV;
    // mỏi: 1 làn, không có hệ số làn (Điều 6.1.1.2 Phần 3)
    DF.Mf =
      ((ext ? (Ng >= 3 ? levE1.g : levEn.g) : Ng >= 4 ? gM1 : Math.min(gM1, levI1.g)) / 1.2) *
      DF.cM;

    // ---- co ngót, từ biến (TCVN 11823-5, Điều 4.2.3) ----
    const RH = I.RH;
    const ti = I.ti;
    const td = I.td;
    const tf = I.tf;
    const khs = 2.0 - 0.014 * RH;
    const khc = 1.56 - 0.008 * RH;
    const kfOf = (f: number): number => 35 / (7 + f);
    const ktd = (t: number, f: number): number =>
      t / ((12 * (100 - 0.58 * f)) / (0.145 * f + 20) + t);
    const perG = (() => {
      const P = gm.P;
      let s = 0;
      for (let i = 0; i < P.length; i++) {
        const a = P[i];
        const b = P[(i + 1) % P.length];
        s += Math.hypot(b[0] - a[0], b[1] - a[1]);
      }
      return s;
    })();
    const VS = gm.A / (perG - G.b4);
    const ks = Math.max(1, 1.45 - 0.0051 * VS); // mặt trên dầm tiếp xúc bản: không kể vào bề mặt khô
    const psi = (t: number, tl: number, f: number, kk: number): number =>
      1.9 * kk * khc * kfOf(f) * ktd(t, f) * tl ** -0.118;
    const esh = (t: number, f: number, kk: number): number =>
      kk * khs * kfOf(f) * ktd(t, f) * 0.48e-3;
    const psi_fi = psi(tf - ti, ti, fci, ks);
    const psi_di = psi(td - ti, ti, fci, ks);
    const psi_fd = psi(tf - td, td, fci, ks);
    const tcur = isFinite(I.tcur) && I.tcur > 0 ? I.tcur : ti;
    const kc5 = tcur < 5 ? 1.2 : 1; // Điều 4.2.3.3: để khô trước khi bảo dưỡng đủ 5 ngày thì co ngót tăng 20%
    const eps_bid = kc5 * esh(td - ti, fci, ks);
    const eps_bif = kc5 * esh(tf - ti, fci, ks);
    const eps_bdf = eps_bif - eps_bid;
    const VSd = (beff * hsw) / (2 * beff - G.b4);
    const ksd = Math.max(1, 1.45 - 0.0051 * VSd);
    const fcsi = 0.8 * fcs;
    const eps_ddf = esh(tf - td, fcsi, ksd);
    const psi_d = psi(tf - td, 1, fcsi, ksd);
    const shr = {
      tcur,
      kc5,
      khs,
      khc,
      kf: kfOf(fci),
      kfd: kfOf(fcsi),
      VS,
      ks,
      VSd,
      ksd,
      ktd_di: ktd(td - ti, fci),
      ktd_fi: ktd(tf - ti, fci),
      ktd_fd: ktd(tf - td, fci),
      ktd_d: ktd(tf - td, fcsi),
      psi_fi,
      psi_di,
      psi_fd,
      psi_d,
      eps_bid,
      eps_bif,
      eps_bdf,
      eps_ddf,
      fcsi,
    };

    // ---- co ngắn đàn hồi (PT 126): fcgp tại giữa nhịp do lực sau ma sát, tụt neo và trọng lượng bản thân ----
    const sM = secAt(L / 2);
    const PtA = T.reduce((s, t) => s + Apc * (at(t, t.fA, 0) ?? 0), 0);
    const eM = sM.yb1 - sM.ycg;
    const M1m = M1bed(L / 2) * 1e6;
    const fcgpES = PtA / sM.A1 + (PtA * eM * eM) / sM.I1 - (M1m * eM) / sM.I1;
    const dES = ((((nC - 1) / (2 * nC)) * Ep) / Eci) * fcgpES;
    const ES = {
      P: PtA / 1e3,
      e: eM,
      A1: sM.A1,
      I1: sM.I1,
      M1: M1m / 1e6,
      fcgp: fcgpES,
      N: nC,
      dES,
    };
    const KLr = 30;
    const lamW = Math.max(
      gm.h3 / G.bw,
      (G.b3 - G.bw) / 2 / Math.max(1, G.h5),
      (G.b1 - G.bw) / 2 / Math.max(1, G.h1),
    );
    const phiW = lamW <= 15 ? 1 : lamW <= 25 ? 1 - 0.025 * (lamW - 15) : 0.75; // độ mảnh bản bụng, bản cánh

    // ---- mặt cắt kiểm toán ----
    const IF_TABLE: Record<string, GiInterfaceParams> = {
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
    };
    const IF = IF_TABLE[I.ifc || 'N'] ?? IF_TABLE.N;

    const zOf = (X: number): GiStirrupZone => {
      const d = Math.min(X, L - X);
      return G.sz.find((z) => d >= z[0] - 1e-6 && d <= z[1] + 1e-6) || G.sz[G.sz.length - 1];
    };
    const sOf = (X: number): number => zOf(X)[2];
    const nvOf = (X: number): number => {
      const z = zOf(X);
      return z.length > 3 && z[3] && z[3] > 0 ? z[3] : G.sn;
    };
    const Ab1 = (PI * G.sd ** 2) / 4;
    const Avf1 = G.cn > 0 ? (G.cn * PI * G.cd ** 2) / 4 : 0;
    const As = (G.As[0] * PI * G.As[1] ** 2) / 4;
    const ys = G.As[2];
    const AsT = (G.AsT[0] * PI * G.AsT[1] ** 2) / 4;
    const ysT = G.AsT[2];
    const fsT = Math.min(0.5 * fy, 210);
    const tensCheck = (ft: number, fb: number, P: readonly Point2D[]): GiTensCheck => {
      const lim1 = Math.min(0.25 * sq(fci), 1.38);
      const lim2 = 0.63 * sq(fci);
      if (ft >= -1e-9 && fb >= -1e-9) return { T: 0, Areq: 0, Aprov: 0, lim: lim1, reinf: false };
      let Tt = 0;
      const dy = 2;
      const top = ft < 0;
      for (let y = dy / 2; y < H; y += dy) {
        const f = fb + ((ft - fb) * y) / H;
        if (f >= 0) continue;
        Tt += -f * widthAt(P, y) * dy;
      }
      const yz = Math.abs(ft - fb) > 1e-9 ? (H * fb) / (fb - ft) : 0;
      let Aprov = 0;
      if (top ? ysT > yz : ysT < yz) Aprov += AsT;
      if (top ? ys > yz : ys < yz) Aprov += As;
      const Areq = Tt / fsT;
      const reinf = Aprov >= Areq;
      return { T: Tt / 1e3, Areq, Aprov, lim: reinf ? lim2 : lim1, reinf };
    };
    const ftl = I.exp === '2' ? Math.min(0.25 * sq(fc), 2.1) : Math.min(0.5 * sq(fc), 4.1);

    const one = (xb: number, tag = '', esFix: number | null = null): GiSectionRes => {
      const x = xb / 1000;
      const X = xb + brg;
      const sc = secAt(X);
      const on = sc.tp
        .map((q, i) => (q ? { ...q, t: T[i] } : null))
        .filter((q): q is GiSectionTendonPoint & { t: GiTendon } => q !== null);
      const xc = Math.abs(X - L / 2);
      // ứng suất cáp tại mặt cắt
      const cab: GiSectionCable[] = on.map((q) => {
        const t = q.t;
        const fF = at(t, t.fF, xc) ?? 0;
        const fA = at(t, t.fA, xc) ?? 0;
        return {
          i: t.i,
          y: q.y,
          z: q.z,
          th: q.th,
          tz: q.tz,
          fF,
          fA,
          fpt: fA - dES,
          c: Math.cos(q.th) * Math.cos(q.tz),
          sn: Math.sin(q.th),
          fpd: 0,
          fpe: 0,
        };
      });
      const nb = cab.length;
      const ApsX = nb * Apc;
      const ycg = sc.ycg;
      const fpt = nb ? cab.reduce((s, q) => s + q.fpt, 0) / nb : 0;
      // nội lực tĩnh tải (N.mm)
      const M1 = M1at(X) * 1e6;
      const M1t = M1bed(X) * 1e6;
      const M2 = (Mw(w2, x) + MP(x)) * 1e6;
      const M3 = Mw(w3, x) * 1e6;
      const MW = Mw(wDW, x) * 1e6;
      const MPL = Mw(wPL, x) * 1e6;
      const V1 = V1at(X);
      const V2 = Vw(w2, x) + VP(x);
      const V3 = Vw(w3, x);
      const VW = Vw(wDW, x);
      const VPL = (wPL * (Lm - x) ** 2) / (2 * Lm);
      // hoạt tải (1 làn, chưa nhân g)
      const bT = bestOf(x, Mi, [truck, truckR]);
      const bD = bestOf(x, Mi, [tandem]);
      const MLv = Math.max(bT.v, bD.v);
      const MLl = (9.3 * x * (Lm - x)) / 2;
      const vT = bestOf(x, Vi, [truck, truckR]);
      const vD = bestOf(x, Vi, [tandem]);
      const VLv = Math.max(vT.v, vD.v);
      const VLl = (9.3 * (Lm - x) ** 2) / (2 * Lm);
      const MLL1 = (1 + IM) * MLv + MLl;
      const VLL1 = (1 + IM) * VLv + VLl;
      const MLL = DF.M * MLL1 * 1e6 + MPL;
      const VLL = DF.V * VLL1 + VPL;
      // ---- mất mát theo thời gian (Điều 9.5.4) ----
      const g = sc.g;
      const Ag = g.A;
      const Igs = g.I;
      const e = g.yb - ycg;
      const ec = sc.ybgc - ycg;
      const fptL = Math.max(fpt, 0.55 * fpy);
      const dR1 = (fptL / KLr) * (fptL / fpy - 0.55);
      const Kid = nb
        ? 1 / (1 + (Ep / Eci) * (ApsX / Ag) * (1 + (Ag * e * e) / Igs) * (1 + 0.7 * psi_fi))
        : 1;
      const Pt0 = cab.reduce((s, q) => s + Apc * q.fpt * q.c, 0);
      const fcgp = Pt0 / Ag + (Pt0 * e * e) / Igs - (M1t * e) / Igs;
      const dSR = eps_bid * Ep * Kid;
      const dCR = (Ep / Eci) * fcgp * psi_di * Kid;
      const dR1u = dR1;
      const id0 = G.idMode === 'zero';
      const dSRu = id0 ? 0 : dSR;
      const dCRu = id0 ? 0 : dCR;
      const dR1i = id0 ? 0 : dR1u;
      const Kdf = nb
        ? 1 /
          (1 +
            (Ep / Eci) * (ApsX / sc.Agc) * (1 + (sc.Agc * ec * ec) / sc.Igc) * (1 + 0.7 * psi_fi))
        : 1;
      const dSD = eps_bdf * Ep * Kdf;
      const dfcd =
        -((dSRu + dCRu + dR1i) * ApsX * (1 / Ag + (e * e) / Igs)) -
        (M2 * e) / Igs -
        ((M3 + MW) * ec) / sc.Igc;
      const dCD = (Ep / Eci) * fcgp * (psi_fi - psi_di) * Kdf + (Ep / Ec) * dfcd * psi_fd * Kdf;
      const dR2 = dR1u;
      const AdD = beff * hs;
      const ed = H + hs / 2 - sc.ybgc;
      const dfcdf = ((eps_ddf * AdD * Ecs) / (1 + 0.7 * psi_d)) * (1 / sc.Agc - (ec * ed) / sc.Igc);
      const dSS = (-Ep / Ec) * dfcdf * Kdf * (1 + 0.7 * psi_fd);
      const dLTid = dSRu + dCRu + dR1i;
      const dLTdf = dSD + dCD + dR2 - dSS;
      const dLT = dLTid + dLTdf;
      cab.forEach((q) => {
        q.fpd = q.fpt - dLTid;
        q.fpe = q.fpt - dLT;
      });
      const fpe = fpt - dLT;
      // ---- lực DƯL (thành phần dọc trục) và độ lệch tâm từng giai đoạn ----
      const Pt = cab.reduce((s, q) => s + Apc * q.fpt * q.c, 0);
      const Mpt = cab.reduce((s, q) => s + Apc * q.fpt * q.c * (sc.yb1 - q.y), 0);
      const Pd = cab.reduce((s, q) => s + Apc * q.fpd * q.c, 0);
      const Mpd = cab.reduce((s, q) => s + Apc * q.fpd * q.c * (sc.yb2 - q.y), 0);
      void Mpd;
      const Pe = cab.reduce((s, q) => s + Apc * q.fpe * q.c, 0);
      const Mpe = cab.reduce((s, q) => s + Apc * q.fpe * q.c * (sc.yb2 - q.y), 0);
      const dPd = Pd - Pt;
      const dMd = cab.reduce((s, q) => s + Apc * (q.fpd - q.fpt) * q.c * (sc.yb2 - q.y), 0);
      const dPe = Pe - Pt;
      const dMe = cab.reduce((s, q) => s + Apc * (q.fpe - q.fpt) * q.c * (sc.yb2 - q.y), 0);
      const sPS = (y: number, dP: number, dM: number): number =>
        Pt / sc.A1 + (Mpt * (sc.yb1 - y)) / sc.I1 + dP / sc.A2 + (dM * (sc.yb2 - y)) / sc.I2;
      const sG = (y: number): number => (-M1 * (sc.yb1 - y)) / sc.I1 - (M2 * (sc.yb2 - y)) / sc.I2;
      const Vp = cab.reduce((s, q) => s + Apc * q.fpe * q.sn, 0);
      // ---- ứng suất (nén +), MPa ----
      const yt1 = H - sc.yb1;
      const yt2 = H - sc.yb2;
      const yt3 = H - sc.yb3;
      const ysl = hc - sc.yb3;
      const s1t = Pt / sc.A1 - (Mpt * yt1) / sc.I1 + (M1t * yt1) / sc.I1;
      const s1b = Pt / sc.A1 + (Mpt * sc.yb1) / sc.I1 - (M1t * sc.yb1) / sc.I1;
      const tr = tensCheck(s1t, s1b, g.P);
      const s2t = sPS(H, dPd, dMd) + sG(H);
      const s2b = sPS(0, dPd, dMd) + sG(0);
      const bt = sPS(H, dPe, dMe) + sG(H);
      const bb = sPS(0, dPe, dMe) + sG(0);
      const ftP = bt + ((M3 + MW) * yt3) / sc.I3;
      const fbP = bb - ((M3 + MW) * sc.yb3) / sc.I3;
      const ftI = ftP + (MLL * yt3) / sc.I3;
      const fbI = fbP - (MLL * sc.yb3) / sc.I3;
      const ftIII = ftP + (I.gLL3 * MLL * yt3) / sc.I3;
      const fbIII = fbP - (I.gLL3 * MLL * sc.yb3) / sc.I3;
      const fdP = (((M3 + MW) * ysl) / sc.I3) * ncs;
      const fdI = (((M3 + MW + MLL) * ysl) / sc.I3) * ncs;
      const fdIII = (((M3 + MW + I.gLL3 * MLL) * ysl) / sc.I3) * ncs;
      // mỏi (Điều 5.5.3.1): 0,5(DƯL + thường xuyên) + Mỏi I
      const vf = (() => {
        let best = 0;
        const ft: Array<[number, number]> = [
          [0, 35],
          [4.3, 145],
          [13.3, 145],
        ];
        for (const veh of [ft, ft.map(([p, w]): [number, number] => [-p, w])])
          veh.forEach(([p0]) => {
            const m = veh.reduce((t, [p, w]) => t + w * Mi(x, x - p0 + p), 0);
            best = Math.max(best, m);
          });
        return best;
      })();
      const Mfat = 1.5 * DF.Mf * (1 + 0.15) * vf * 1e6;
      const ftFat = 0.5 * ftP + (Mfat * yt3) / sc.I3;

      // ---- TTGH cường độ I ----
      const Mu = 1.25 * (M1 + M2 + M3) + 1.5 * MW + 1.75 * MLL;
      const Vu = 1.25 * (V1 + V2 + V3) + 1.5 * VW + 1.75 * VLL;
      // uốn: cân bằng lực, khối ứng suất chữ nhật (Điều 7.3.2) ; vùng nén trong bản dùng f'c bản, phần trong dầm dùng f'c dầm
      const k = 2 * (1.04 - I.fpyr);
      const b1s = b1Of(fcs);
      const a1 = 0.85;
      const Tf = (cVal: number): { T: number; Tm: number; list: GiFlexCableStress[] } => {
        let Tt = 0;
        let Tm = 0;
        const list: GiFlexCableStress[] = cab.map((q) => {
          const dp = hc - q.y;
          const fps = dp > cVal ? fpu * (1 - (k * cVal) / dp) : 0;
          Tt += Apc * fps;
          Tm += Apc * fps * dp;
          return { i: q.i, dp, fps };
        });
        const dsA = hc - ys;
        Tt += As * fy;
        Tm += As * fy * dsA;
        return { T: Tt, Tm, list };
      };
      const Cf = (cVal: number): { C: number; Cm: number; a: number; web: boolean } => {
        const aVal = b1s * cVal;
        if (aVal <= hs)
          return {
            C: a1 * fcs * beff * aVal,
            Cm: (a1 * fcs * beff * aVal * aVal) / 2,
            a: aVal,
            web: false,
          };
        let C = a1 * fcs * beff * hs;
        let Cm = (C * hs) / 2;
        const dy = 1;
        for (let y = hs + dy / 2; y < aVal; y += dy) {
          const w = widthAt(g.P, hc - y);
          C += a1 * fc * w * dy;
          Cm += a1 * fc * w * dy * y;
        }
        return { C, Cm, a: aVal, web: true };
      };
      let lo = 1;
      let hi = hc;
      for (let it = 0; it < 70; it++) {
        const midC = (lo + hi) / 2;
        if (Cf(midC).C > Tf(midC).T) hi = midC;
        else lo = midC;
      }
      const c = (lo + hi) / 2;
      const FT = Tf(c);
      const CC = Cf(c);
      const Mn = (FT.Tm - CC.Cm) / 1e6;
      const dt = hc - Math.min(ys, ...cab.map((q) => q.y));
      const et = (0.003 * (dt - c)) / c;
      const phi = Math.min(1, Math.max(0.75, 0.75 + (0.25 * (et - 0.002)) / 0.003));
      const Mr = phi * Mn;

      // không liên hợp (lúc đổ bản): vùng nén ở cánh trên dầm, f'c dầm
      const Tn = (c2: number): { T: number; Tm: number } => {
        let Tt = 0;
        let Tm = 0;
        cab.forEach((q) => {
          const dp = H - q.y;
          const fps = dp > c2 ? fpu * (1 - (k * c2) / dp) : 0;
          Tt += Apc * fps;
          Tm += Apc * fps * dp;
        });
        Tt += As * fy;
        Tm += As * fy * (H - ys);
        return { T: Tt, Tm };
      };
      const Cn = (c2: number): { C: number; Cm: number; a: number } => {
        const aVal = b1Of(fc) * c2;
        let C = 0;
        let Cm = 0;
        const dy = 1;
        for (let y = dy / 2; y < aVal; y += dy) {
          const w = widthAt(g.P, H - y);
          C += a1 * fc * w * dy;
          Cm += a1 * fc * w * dy * y;
        }
        return { C, Cm, a: aVal };
      };
      let lo2 = 1;
      let hi2 = H;
      for (let it = 0; it < 60; it++) {
        const c2 = (lo2 + hi2) / 2;
        if (Cn(c2).C > Tn(c2).T) hi2 = c2;
        else lo2 = c2;
      }
      const cN = (lo2 + hi2) / 2;
      const MnN = (Tn(cN).Tm - Cn(cN).Cm) / 1e6;
      const dtN = H - Math.min(ys, ...cab.map((q) => q.y));
      const etN = (0.003 * (dtN - cN)) / cN;
      const phiN = Math.min(1, Math.max(0.75, 0.75 + (0.25 * (etN - 0.002)) / 0.003));
      const MrN = phiN * MnN;
      const MuN = (1.25 * (M1 + M2)) / 1e6;

      // cốt thép tối thiểu (Điều 7.3.3.2, PT 33)
      const fr = 0.63 * sq(fc);
      const Scm = sc.I3 / sc.yb3;
      const Snc = sc.I2 / sc.yb2;
      const fcpe = sPS(0, dPe, dMe);
      const Mdnc = M1 + M2;
      const Mcr = (I.g3 * ((I.g1 * fr + I.g2 * fcpe) * Scm - Mdnc * (Scm / Snc - 1))) / 1e6;
      const Mmin = Math.min(Mcr, (1.33 * Mu) / 1e6);

      // ---- cắt: phương pháp tổng quát (Điều 8.3.4.2) ----
      const tens = cab.filter((q) => q.y < hc / 2);
      const Tps =
        tens.reduce((s, q) => {
          const f = FT.list.find((o) => o.i === q.i);
          return s + (f ? Apc * f.fps : 0);
        }, 0) +
        As * fy;
      const de_ =
        Tps > 0
          ? (tens.reduce((s, q) => {
              const f = FT.list.find((o) => o.i === q.i);
              return s + (f ? Apc * f.fps * f.dp : 0);
            }, 0) +
              As * fy * (hc - ys)) /
            Tps
          : hc - ys;
      const a = CC.a;
      const dv = Math.max(de_ - a / 2, 0.9 * de_, 0.72 * hc);
      // bv: bề rộng bụng nhỏ nhất trong phạm vi dv, trừ 1/4 đường kính ống ghen có bơm vữa tại cao độ đó (Điều 8.2.9)
      const yLo = hc - de_;
      const yHi = Math.min(H - G.h6 - G.h5, yLo + dv);
      let bv = 1e9;
      let ybv = 0;
      for (let y = Math.max(yLo, G.h1); y <= yHi; y += 5) {
        const w = widthAt(g.P, y) - (on.filter((q) => Math.abs(q.y - y) <= Dd / 2).length * Dd) / 4;
        if (w < bv) {
          bv = w;
          ybv = y;
        }
      }
      const Mus = Math.max(Math.abs(Mu), Math.abs(Vu * 1e3 - Vp) * dv);
      const Aps_t = tens.length * Apc;
      const fpo = 0.7 * fpu;
      const VuN = Vu * 1e3;
      let es = (Mus / dv + Math.abs(VuN - Vp) - Aps_t * fpo) / (Es * As + Ep * Aps_t);
      let esNeg = false;
      let Act = 0;
      if (es < 0) {
        esNeg = true;
        let A0 = 0;
        const dy = 2;
        for (let y = dy / 2; y < hc / 2; y += dy) A0 += widthAt(g.P, y) * dy;
        Act = A0;
        es = (Mus / dv + Math.abs(VuN - Vp) - Aps_t * fpo) / (Es * As + Ep * Aps_t + Ec * Act);
        es = Math.max(es, -0.4e-3);
      }
      es = Math.min(es, 0.006);
      const esOwn = es;
      if (esFix != null) es = esFix;
      const s = sOf(X);
      const nv = nvOf(X);
      const Av = nv * Ab1;
      const Avmin = (0.083 * sq(fc) * bv * s) / fy;
      const hasMin = Av >= Avmin - 1e-9;
      const sxe = Math.max(300, Math.min(2000, (dv * 35) / ((G.ag || 19) + 16)));
      const beta = hasMin
        ? 4.8 / (1 + 750 * es)
        : ((4.8 / (1 + 750 * es)) * 1300) / (1000 + sxe);
      const th = 29 + 3500 * es;
      const Vc = 0.083 * beta * sq(fc) * bv * dv;
      const Vs = (Av * fy * dv) / Math.tan((th * PI) / 180) / s;
      const Vlim = 0.25 * fc * bv * dv + Vp;
      const Vn = Math.min(Vc + Vs + Vp, Vlim);
      const Vr = 0.9 * Vn;
      const vu = Math.abs(VuN - 0.9 * Vp) / (0.9 * bv * dv);
      const smax = vu < 0.125 * fc ? Math.min(0.8 * dv, 600) : Math.min(0.4 * dv, 300);
      const needAv = VuN > 0.5 * 0.9 * (Vc + Vp);
      const Treq =
        Math.abs(Mu) / (dv * phi) +
        (Math.abs(VuN / 0.9 - Vp) - 0.5 * Math.min(Vs, VuN / 0.9)) / Math.tan((th * PI) / 180);
      const Tprov = Tps;

      // ---- xoắn (Điều 8.2.1, PT 60, 61) ----
      const Pc3 = (() => {
        const P = g.P;
        let pSum = 0;
        for (let i = 0; i < P.length; i++) {
          const a2 = P[i];
          const b2 = P[(i + 1) % P.length];
          pSum += Math.hypot(b2[0] - a2[0], b2[1] - a2[1]);
        }
        return pSum - G.b4 + 2 * beff + 2 * hs - G.b4;
      })();
      const Acp = g.A + beff * hs;
      const fpc = sPS(Math.min(H, sc.yb3), dPe, dMe) + sG(Math.min(H, sc.yb3));
      const Tcr =
        (((0.328 * sq(fc) * Acp * Acp) / Pc3) *
          sq(Math.max(0, 1 + Math.max(0, fpc) / (0.328 * sq(fc))))) /
        1e6;
      const Tu = G.Tu || 0;
      const torOK = Tu <= 0.25 * 0.9 * Tcr;

      // ---- cắt trượt mặt tiếp xúc (Điều 8.4) ----
      const dvi = de_ - hs / 2;
      const bvi = G.b4;
      const Vui = VuN / dvi;
      const Acv = bvi;
      const Avf = (Avf1 > 0 ? Avf1 : Av) / s;
      const Pc = w2 + w3 + wDW - wPan; // Pc: lực nén thường xuyên trên mặt tiếp xúc (N/mm = kN/m)
      const fyi = Math.min(fy, 420);
      const Vni = Math.min(
        IF.c * Acv + IF.mu * (Avf * fyi + Math.max(0, Pc)),
        IF.K1 * fcs * Acv,
        IF.K2 * Acv,
      );
      const Vri = 0.9 * Vni;
      const Avfmin = (0.35 * Acv) / fyi;

      return {
        x,
        tag,
        X,
        sc,
        cab,
        nb,
        Aps: ApsX,
        ycg,
        e,
        ec,
        M1: M1 / 1e6,
        M1t: M1t / 1e6,
        M2: M2 / 1e6,
        M3: M3 / 1e6,
        MW: MW / 1e6,
        MPL: MPL / 1e6,
        V1,
        V2,
        V3,
        VW,
        VPL,
        bT,
        bD,
        MLv,
        MLl,
        MLL1,
        vT,
        vD,
        VLv,
        VLl,
        VLL1,
        MLL: MLL / 1e6,
        VLL,
        Mu: Mu / 1e6,
        Vu,
        fpt,
        fptL,
        dR1,
        Kid,
        fcgp,
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
        fpe,
        dT: dES + dLT,
        Pt: Pt / 1e3,
        Mpt: Mpt / 1e6,
        dPd: dPd / 1e3,
        dPe: dPe / 1e3,
        dMd: dMd / 1e6,
        dMe: dMe / 1e6,
        Pd: Pd / 1e3,
        Pe: Pe / 1e3,
        Mpe: Mpe / 1e6,
        Vp: Vp / 1e3,
        s1t,
        s1b,
        tr,
        s2t,
        s2b,
        ftP,
        fbP,
        ftI,
        fbI,
        ftIII,
        fbIII,
        fdP,
        fdI,
        fdIII,
        Mfat: Mfat / 1e6,
        ftFat,
        c,
        a: CC.a,
        web: CC.web,
        phi,
        et,
        Mn,
        Mr,
        fps: FT.list,
        T: FT.T / 1e3,
        cN,
        MnN,
        MrN,
        MuN,
        phiN,
        fcpe,
        Mcr,
        Mmin,
        Scm,
        Snc,
        Mdnc: Mdnc / 1e6,
        nv,
        de: de_,
        dv,
        bv,
        ybv,
        es: es * 1e3,
        esNeg,
        Act,
        beta,
        th,
        s,
        sxe,
        Vc: Vc / 1e3,
        Vs: Vs / 1e3,
        Vlim: Vlim / 1e3,
        Vn: Vn / 1e3,
        Vr: Vr / 1e3,
        Avmin,
        Av,
        hasMin,
        vu,
        smax,
        needAv,
        Treq: Treq / 1e3,
        Tprov: Tprov / 1e3,
        esOwn: esOwn * 1e3,
        Acp,
        Pc3,
        fpc,
        Tcr,
        Tu,
        torOK,
        dvi,
        bvi,
        Vui,
        Vni,
        Vri,
        Avf,
        Avfmin,
        Pc,
        yt1,
        yt2,
        yt3,
        ysl,
      };
    };

    // mặt cắt kiểm toán: tim gối, Ls/8, Ls/4, 3Ls/8, Ls/2 ; mặt cắt tới hạn về cắt cách mép gối dv (Điều 8.3.2)
    const bsup = I.bg * 1000;
    let xv = bsup / 2 + 0.72 * hc;
    for (let it = 0; it < 6; it++) {
      const r = one(xv);
      xv = bsup / 2 + r.dv;
    }
    const XS: Array<[number, string]> = [
      [0, 'Tim gối'],
      [Ls / 8, 'Ls/8'],
      [Ls / 4, 'Ls/4'],
      [(3 * Ls) / 8, '3Ls/8'],
      [Ls / 2, 'Ls/2'],
    ];
    const rv = one(xv, 'v');
    const esV = rv.esOwn / 1e3;
    const res = XS.map(([xb, t]) => one(xb, t, xb < xv - 1e-6 ? esV : null)); // mặt cắt cách gối nhỏ hơn dv: lấy εs của mặt cắt dv (Điều 8.3.4.2)

    // mặt cắt bổ sung: ngay sau chỗ đổi bước cốt đai, cuối đoạn vuốt sườn (Điều 8.3.2, 9.4) ; d tính từ đầu dầm
    const rx = (() => {
      const L2 = L / 2;
      const out: Array<{ xb: number; t: string }> = [];
      const add = (d: number, t: string): void => {
        const xb = d - brg;
        if (xb <= 1 || d >= L2 - 1) return;
        if (
          Math.abs(xb - xv) < 1 ||
          XS.some((q) => Math.abs(q[0] - xb) < 1) ||
          out.some((o) => Math.abs(o.xb - xb) < 1)
        )
          return;
        out.push({ xb, t });
      };
      G.sz.forEach((z) => {
        if (z[1] < L2 - 1)
          add(
            z[1] + 1,
            'Đai s = ' +
              (G.sz.find((q) => z[1] + 1 >= q[0] - 1e-6 && z[1] + 1 <= q[1] + 1e-6) || z)[2],
          );
      });
      if (G.Ltr > 0) add(G.Le + G.Ltr, 'Cuối đoạn vuốt sườn');
      else add(G.Le + 1, 'Sau đoạn đầu dầm');
      return out
        .sort((a, b) => a.xb - b.xb)
        .map((o) => one(o.xb, o.t, o.xb < xv - 1e-6 ? esV : null));
    })();

    // ---- tọa độ cáp tại các điểm chia (từ giữa dầm) ----
    const XI: number[] = [];
    for (let k = 0; (k * Ls) / 32 < T[0].Lx - 1e-6 && k <= 16; k++) XI.push((k * Ls) / 32);
    XI.push(Math.max(...T.map((t) => t.Lx)));
    const stations: GiStation[] = XI.map((xc) => ({
      xc,
      tc: T.map((t) =>
        xc <= t.Lx + 1e-6
          ? {
              y: t.y(Math.min(xc, t.Lx)),
              z: t.z(Math.min(xc, t.Lx)),
              av: Math.atan(2 * t.a * t.Lp) - Math.atan(t.dy(Math.min(xc, t.Lx))),
              ah:
                (at(t, t.al, Math.min(xc, t.Lx)) ?? 0) -
                (Math.atan(2 * t.a * t.Lp) - Math.atan(t.dy(Math.min(xc, t.Lx)))),
              s: at(t, t.ss, Math.min(xc, t.Lx)) ?? 0,
              fF: at(t, t.fF, Math.min(xc, t.Lx)) ?? 0,
              fA: at(t, t.fA, Math.min(xc, t.Lx)) ?? 0,
              al: at(t, t.al, Math.min(xc, t.Lx)) ?? 0,
            }
          : null,
      ),
    }));

    // ---- độ vồng, độ võng ----
    const nseg = 330;
    const dx = L / nseg;
    let dps = 0;
    let dsw = 0;
    let sumI2 = 0;
    let sumI3 = 0;
    for (let i = 0; i < nseg; i++) {
      const X = (i + 0.5) * dx;
      const sc = secAt(X);
      const xc = Math.abs(X - L / 2);
      const m = X <= L / 2 ? X / 2 : (L - X) / 2; // dầm kê trên bệ đúc (nhịp Lt) khi căng kéo
      const Mp = T.reduce((s, t) => {
        if (xc > t.Lx) return s;
        const f = (at(t, t.fA, xc) ?? 0) - dES;
        return s + Apc * f * Math.cos(Math.atan(t.dy(xc))) * (sc.yb1 - t.y(xc));
      }, 0);
      dps += (Mp / (Eci * sc.I1)) * m * dx;
      dsw += ((M1bed(X) * 1e6) / (Eci * sc.I1)) * m * dx;
      sumI2 += sc.I2;
      sumI3 += sc.I3;
    }
    const I2m = sumI2 / nseg;
    const I3m = sumI3 / nseg;
    const rm = res[res.length - 1];
    const EIc = Ec * rm.sc.I3 * 1e-9; // kN.m2 (mặt cắt liên hợp giữa nhịp)
    const dmid = (P: number, a: number, EI: number): number => {
      const aa = Math.min(a, Lm - a);
      return aa <= 0 ? 0 : (P * aa * (3 * Lm * Lm - 4 * aa * aa)) / (48 * EI);
    };
    let dtr = 0;
    for (let p0 = -9; p0 <= Lm + 9; p0 += 0.05) {
      const d = truck.reduce(
        (t, [off, P]) => t + (p0 + off >= 0 && p0 + off <= Lm ? dmid(P, p0 + off, EIc) : 0),
        0,
      );
      dtr = Math.max(dtr, d);
    }
    const nL = I.nL;
    const mL = mOf(nL);
    const DFd = (nL * mL) / Ng;
    const dlane = (5 * 9.3 * Lm ** 4) / (384 * EIc);
    const dLL1 = DFd * (1 + IM) * dtr * 1000;
    const dLL2 = DFd * (0.25 * (1 + IM) * dtr + dlane) * 1000;
    const EI2 = Ec * I2m * 1e-9;
    const EI3 = Ec * I3m * 1e-9;
    const dDk2 =
      ((5 * w2 * Lm ** 4) / (384 * EI2) +
        dnG.reduce((t, o) => t + dmid(o.P, o.x / 1000, EI2), 0)) *
      1000;
    const dDk3 = ((5 * (w3 + wDW) * Lm ** 4) / (384 * EI3)) * 1000;
    const rLT = rm.dLTid / rm.fpt;
    const d0 = dps - dsw;
    const dtd = d0 * (1 + psi_di) - dps * rLT * (1 + 0.7 * psi_di);
    const camber = {
      dps,
      dsw,
      d0,
      rLT,
      dtd,
      dcr: d0 * psi_di,
      dDk2,
      dDk3,
      dDeck: dDk2 + dDk3,
      dtr: dtr * 1000,
      dlane: dlane * 1000,
      dLL1,
      dLL2,
      DFd,
      mL,
      lim: Ls / (WPL > 0 ? Math.max(I.dlim, 1000) : I.dlim),
      I2m,
      I3m,
    };

    // ---- gradien nhiệt (TCVN 11823-3, Điều 11.3, Bảng 25) - mặt cắt giữa nhịp ----
    const TG = (() => {
      const al = I.alpha;
      const A = H + hs >= 400 ? 300 : H + hs - 100;
      const sig = (T1: number, T2: number): GiThermalStress => {
        const Tz = (d: number): number =>
          d <= 100 ? T1 + ((T2 - T1) * d) / 100 : d <= 100 + A ? (T2 * (100 + A - d)) / A : 0;
        const sl: Array<{ y: number; b: number; E: number; T: number }> = [];
        const dy = 2;
        let EA = 0;
        let ES2 = 0;
        for (let y = dy / 2; y < H + hs; y += dy) {
          let b: number;
          let E: number;
          if (y > H) {
            b = beff;
            E = Ecs;
          } else {
            b = widthAt(gm.P, y);
            E = Ec;
          }
          const Tt = Tz(H + hs - y);
          sl.push({ y, b, E, T: Tt });
          EA += E * b * dy;
          ES2 += E * b * dy * y;
        }
        const yc = ES2 / EA;
        let EI = 0;
        let N = 0;
        let M = 0;
        sl.forEach((q) => {
          EI += q.E * q.b * dy * (q.y - yc) ** 2;
          N += q.E * q.b * dy * al * q.T;
          M += q.E * q.b * dy * al * q.T * (q.y - yc);
        });
        const e0 = N / EA;
        const kk = M / EI;
        const f = (y: number, E: number, Tt: number): number => E * (al * Tt - e0 - kk * (y - yc));
        return {
          dk: f(H + hs, Ecs, Tz(0)),
          gt: f(H, Ec, Tz(hs)),
          gb: f(0, Ec, Tz(H + hs)),
          A,
          kap: kk,
        };
      };
      return { pos: sig(I.TGp[0], I.TGp[1]), neg: sig(I.TGn[0], I.TGn[1]), g: I.gTG };
    })();

    // ---- vùng neo cáp kéo sau (TCVN 11823-5, Điều 10.9 ; lực tính toán TCVN 11823-3, Điều 4.3.2) ----
    const anc: GiAncResult = (() => {
      const an: Partial<GiAnchorInput> = G.an || {};
      const a = an.a || 250;
      const b = an.b || 250;
      const X0 = Math.min(...T.map((t) => t.L1));
      const Pu1 = 1.2 * fpj * Apc;
      const sh0 = shp(X0);
      const P0 = sh0.P;
      const AN: GiAncNode[] = T.map((t) => {
        const y = t.yE;
        const z = t.zE;
        const dv = Math.atan(t.dy(t.Lx));
        const dh = Math.atan(t.dz(t.Lx));
        // góc nghiêng: dương khi lực neo hướng vào trọng tâm mặt cắt (cáp đi xuống về phía giữa nhịp)
        const sv = dv === 0 ? 0 : y > sh0.yb ? 1 : -1;
        const shz = dh === 0 ? 0 : (z - 0) * (t.zM - t.zE) < 0 ? 1 : -1;
        return { i: t.i, y, z, av: sv * Math.abs(dv), ah: shz * Math.abs(dh), Pu: Pu1 };
      });
      const SP = AN.length * Pu1;
      const H_ = G.H;
      const tw = Math.min(...AN.map((q) => widthAt(P0, q.y)));
      const Lz = Math.min(1.5 * Math.max(H_, tw), Math.max(H_, tw));
      const ysArr = AN.map((q) => q.y);
      const zsArr = AN.map((q) => q.z);
      const yr = AN.reduce((s, q) => s + q.Pu * q.y, 0) / SP;
      const zr = AN.reduce((s, q) => s + q.Pu * q.z, 0) / SP;
      // phương pháp gần đúng (Điều 10.9.6.3, PT 160, 161) cho mỗi mặt phẳng
      const plane = (
        dim: number,
        pos: number[],
        c0: number,
        ang: number[],
        ad: number,
        ctr: number,
      ): GiAncPlane => {
        const aG = Math.max(...pos) - Math.min(...pos) + ad;
        const eVal = Math.abs(ctr - c0);
        const sA = AN.reduce((s, q, k) => s + q.Pu * Math.sin(ang[k]), 0);
        const cA = AN.reduce((s, q, k) => s + q.Pu * Math.cos(ang[k]), 0);
        const ar = Math.atan2(sA, cA);
        const T160 = 0.25 * SP * Math.max(0, 1 - aG / dim) + 0.5 * Math.abs(sA);
        const d161 = 0.5 * (dim - 2 * eVal) + 5 * eVal * Math.sin(ar);
        return { h: dim, aG, e: eVal, sA, ar, T160, d161 };
      };
      const PV = plane(
        H_,
        ysArr,
        sh0.yb,
        AN.map((q) => q.av),
        a,
        yr,
      );
      const PH = plane(
        tw,
        zsArr,
        0,
        AN.map((q) => q.ah),
        b,
        zr,
      );
      // phương pháp cân bằng khối đầu dầm (mô hình phi đàn hồi dựa trên cân bằng, Điều 10.9.3.1): lực neo phân bố trên bản neo, mặt cắt cuối vùng neo chịu ứng suất tuyến tính
      const eqm = (
        dim: number,
        pos: number[],
        ad: number,
        wf: (y: number) => number,
        Fs: number[],
        levRatio: number,
      ): GiAncEqm => {
        const dy = 2;
        const N = Math.ceil(dim / dy);
        const F = Fs.reduce((s, v) => s + v, 0);
        let A = 0;
        let S1 = 0;
        let S2 = 0;
        const w: number[] = [];
        for (let k = 0; k < N; k++) {
          const y = (k + 0.5) * dy;
          const bb = wf(y);
          w.push(bb);
          A += bb * dy;
          S1 += bb * dy * y;
          S2 += bb * dy * y * y;
        }
        const yc = S1 / A;
        const Ic = S2 - A * yc * yc;
        const ya = pos.reduce((s, p, k) => s + Fs[k] * p, 0) / F;
        const Me = F * (ya - yc);
        let Ma = 0;
        let Mr = 0;
        let Fa = 0;
        let Fr = 0;
        let Mx = 0;
        let yMx = 0;
        let Mn = 0;
        let yMn = 0;
        const M: Point2D[] = [];
        for (let k = 0; k < N; k++) {
          const y = (k + 0.5) * dy;
          const qa = pos.reduce(
            (s, p, j) => s + (Math.abs(y - p) <= ad / 2 ? Fs[j] / ad : 0),
            0,
          );
          const qr = (F / A + (Me * (y - yc)) / Ic) * w[k];
          Ma += Fa * dy + (qa * dy * dy) / 2;
          Fa += qa * dy;
          Mr += Fr * dy + (qr * dy * dy) / 2;
          Fr += qr * dy;
          const m = Mr - Ma;
          M.push([y + dy / 2, m]);
          if (m > Mx) {
            Mx = m;
            yMx = y;
          }
          if (m < Mn) {
            Mn = m;
            yMn = y;
          }
        }
        return {
          M,
          Mx,
          yMx,
          Mn,
          yMn,
          Tb: Mx / (levRatio * dim),
          Ts: -Mn / (levRatio * dim),
          yc,
          Me,
        };
      };
      const XF = X0 + Lz;
      const shF = shp(Math.min(XF, L / 2));
      const EV = eqm(
        H_,
        ysArr,
        a,
        (y) => widthAt(shF.P, y),
        AN.map((q) => q.Pu * Math.cos(q.av)),
        0.5,
      );
      const EH = eqm(
        tw,
        zsArr.map((z) => z + tw / 2),
        b,
        () => 1,
        AN.map((q) => q.Pu * Math.cos(q.ah)),
        0.5,
      );
      const TbV = Math.max(PV.T160, EV.Tb);
      const TbH = Math.max(PH.T160, EH.Tb);
      // điều kiện áp dụng phương pháp gần đúng (Điều 10.9.6.1)
      const sortY = [...ysArr].sort((p, q) => p - q);
      const sV = sortY.length > 1 ? Math.min(...sortY.slice(1).map((v, k) => v - sortY[k])) : Infinity;
      const sortZ = [...new Set(zsArr.map((z) => Math.round(z)))].sort((p, q) => p - q);
      const sH = sortZ.length > 1 ? Math.min(...sortZ.slice(1).map((v, k) => v - sortZ[k])) : Infinity;
      const edV = Math.min(...ysArr.map((y) => Math.min(y, H_ - y)));
      const edH = Math.min(...zsArr.map((z) => tw / 2 - Math.abs(z)));
      const rectLen = G.bwE >= G.b1 - 1e-6 && G.Le >= Math.max(H_, tw);
      const cond: Array<[string, string, boolean]> = [
        [
          'Mặt cắt chữ nhật, chiều dài đoạn đầu dầm có mặt cắt không đổi ≥ kích thước ngang lớn hơn',
          `Lđ = ${G.Le.toFixed(0)} ; max(H, t) = ${Math.max(H_, tw).toFixed(0)} mm`,
          rectLen,
        ],
        [
          'Không thay đổi hình học đột ngột trong phạm vi hoặc trước vùng neo',
          `vuốt sườn bắt đầu cách đầu dầm ${G.Le.toFixed(0)} mm ; vùng neo dài ${Lz.toFixed(0)} mm`,
          G.Le >= X0 + Lz,
        ],
        [
          'Cự ly mép nhỏ nhất của neo trong mặt phẳng chính ≥ 1,5a',
          `${edV.toFixed(0)} ≥ ${(1.5 * a).toFixed(0)} mm`,
          edV >= 1.5 * a - 1e-6,
        ],
        [
          'Một neo hoặc một nhóm neo đặt sát nhau (cự ly tim ≤ 1,5a)',
          `s = ${isFinite(sV) ? sV.toFixed(0) : '-'} mm ; 1,5a = ${(1.5 * a).toFixed(0)} mm`,
          !(sV > 1.5 * a + 1e-6),
        ],
        [
          'Góc nghiêng bó cáp trong khoảng -5° ÷ +20°',
          `${((Math.min(...AN.map((q) => q.av)) * 180) / PI).toFixed(1)}° ÷ ${((Math.max(...AN.map((q) => q.av)) * 180) / PI).toFixed(1)}°`,
          AN.every(
            (q) =>
              (q.av * 180) / PI >= -5 &&
              (q.av * 180) / PI <= 20 &&
              (q.ah * 180) / PI >= -5 &&
              (q.ah * 180) / PI <= 20,
          ),
        ],
      ];
      const approxOK = cond.every((c) => c[2]);
      // ứng suất nén phía trước neo (PT 157 - 159), giới hạn 0,7φf'ci (Điều 10.9.3.1), φ = 0,80
      const aeff = H_ >= tw ? a : b;
      const beffAnc = H_ >= tw ? b : a;
      const sK = H_ >= tw ? sV : sH;
      const nK = H_ >= tw ? AN.length : sortZ.length;
      const K = isFinite(sK) && sK < 2 * aeff ? 1 + (2 - sK / aeff) * (0.3 + nK / 15) : 1;
      const lc = Math.min(an.lc || 0, 1.15 * Math.max(aeff, beffAnc));
      const Ab = a * b - (PI * G.D * G.D) / 4;
      const fca = (0.6 * Pu1 * K) / (Ab * (1 + lc * (1 / beffAnc - 1 / tw)));
      const fcaL = 0.7 * 0.8 * fci;
      // khi không đủ điều kiện Điều 10.9.6.1: ứng suất nén thanh chống (Điều 10.9.3.2, 10.9.4.3) và tại chỗ thay đổi hình học trong vùng neo
      const eminVal = an.emin || 0;
      const sminVal = an.smin || 0;
      const fciMinVal = an.fciMin || 0;
      const lzW = Math.min(
        an.type !== 'B' && eminVal > 0 ? 2 * eminVal : Infinity,
        isFinite(sV) ? sV : Infinity,
      );
      const wIn = isFinite(lzW) ? Math.max(a, lzW) : a; // trong mặt phẳng dầm: kích thước ngang vùng cục bộ (nút), Điều 10.9.4.2, 10.9.7.1
      const dS = Math.max(an.lc || 0, Math.min(a, b));
      const bS = b + (tw - b) * Math.min(1, dS / tw);
      const AS = wIn * bS - (PI * G.D * G.D) / 4;
      const fS = Pu1 / AS; // theo chiều dày: tăng tuyến tính đến bề rộng sườn tại khoảng cách bằng bề rộng sườn (Điều 10.9.4.3)
      const geoX = [
        ...new Set(
          [G.Le, G.Ltr > 0 ? Math.min(G.Le + G.Ltr, X0 + Lz) : G.Le].map((v) => Math.round(v)),
        ),
      ].filter((X) => X > X0 && X <= X0 + Lz + 1e-6); // đầu đoạn vuốt sườn và điểm hẹp nhất của sườn trong phạm vi vùng neo
      const geo: GiAncGeoCheck[] = geoX.map((X) => {
        const sh = shp(X);
        const N = AN.reduce((s, q) => s + q.Pu * Math.cos(q.av), 0);
        const Mg = AN.reduce((s, q) => s + q.Pu * Math.cos(q.av) * (sh.yb - q.y), 0);
        const ft = N / sh.A - (Mg * (G.H - sh.yb)) / sh.I;
        const fb = N / sh.A + (Mg * sh.yb) / sh.I;
        return { X, ft, fb, f: Math.max(ft, fb), bw: sh.b2 };
      });
      const fGeo = geo.length ? Math.max(...geo.map((o) => o.f)) : 0;
      // cốt thép chống xé vỡ (φ = 1,0): phân bố trên chiều dài min(2,5dburst ; 1,5h)
      const z1 = zOf(X0);
      const s1 = z1[2];
      const nv1 = z1.length > 3 && z1[3] && z1[3] > 0 ? z1[3] : G.sn;
      const LdV = Math.min(2.5 * PV.d161, 1.5 * H_);
      const LdH = Math.min(2.5 * PH.d161, 1.5 * tw);
      const nSt = Math.floor(LdV / s1);
      const AsV = nSt * nv1 * Ab1;
      const AsVr = TbV / (1.0 * fy);
      const Abh = (PI * (an.bhd || 14) ** 2) / 4;
      const nMe = Math.floor(LdH / (an.bhs || 150));
      const AsH = nMe * (an.bhn || 0) * Abh;
      const AsHr = TbH / (1.0 * fy);
      const smaxV = Math.min(24 * G.sd, 300);
      const smaxH = Math.min(24 * (an.bhd || 14), 300);
      // lực ép vỡ bề mặt (Điều 10.9.3.2) và kéo mép dọc (Điều 10.9.6.4)
      const close = isFinite(sV) && sV < 0.4 * H_;
      const Tsp = Math.max(close ? 0.02 * SP : 0, EV.Ts, EH.Ts);
      const AspR = Tsp / fy;
      const Asp = ((an.spn || 0) * PI * (an.spd || 14) ** 2) / 4;
      const shE = shp(Math.min(X0 + H_ / 2, L / 2));
      const Nn = SP;
      const Mn_ = SP * (sh0.yb - yr);
      const fe = (y: number): number => Nn / shE.A + (Mn_ * (shE.yb - y)) / shE.I;
      let Tedge = 0;
      {
        const dy = 2;
        for (let y = dy / 2; y < H_; y += dy) {
          const f = fe(y);
          if (f < 0) Tedge += -f * widthAt(shE.P, y) * dy;
        }
      }
      const AsL = As + AsT;
      const AsLr = Tedge / fy;
      // vùng cục bộ (Điều 10.9.7)
      const special = an.type !== 'B';
      const kA = Math.max(
        1,
        Math.min(
          isFinite(sV) ? sV / a : Infinity,
          (2 * edV) / a,
          isFinite(sH) ? sH / b : Infinity,
          (2 * edH) / b,
        ),
      );
      const AgLoc = a * b;
      const Aa = kA * kA * AgLoc;
      const fn = Math.min(0.7 * fci * sq(Aa / AgLoc), 2.25 * fci);
      const Pr = 0.7 * fn * Ab;
      const loc: GiAncLoc = special
        ? {
            special,
            smin: sminVal,
            emin: eminVal,
            fciMin: fciMinVal,
            sOK: !isFinite(sV) || sV >= sminVal - 1e-6,
            eOK: Math.min(edV, edH) >= eminVal - 1e-6,
            fOK: !(fciMinVal > 0) || fci >= fciMinVal - 1e-9,
            lzW: Math.min(2 * eminVal, isFinite(sV) ? sV : Infinity),
          }
        : { special, kA, Aa, Ag: AgLoc, Ab, fn, Pr, ok: Pr >= Pu1 - 1e-6 };
      const fcaD = approxOK ? fca : Math.max(fS, fGeo);
      const ok = {
        fca: fcaD <= fcaL + 1e-9,
        V: AsV >= AsVr - 1e-6 && s1 <= smaxV + 1e-6,
        H: AsH >= AsHr - 1e-6 && (an.bhs || 150) <= smaxH + 1e-6,
        sp: Asp >= AspR - 1e-6,
        edge: AsL >= AsLr - 1e-6,
        loc: special ? Boolean(loc.sOK && loc.eOK && loc.fOK) : Boolean(loc.ok),
        all: false,
      };
      ok.all = ok.fca && ok.V && ok.H && ok.sp && ok.edge && ok.loc;
      return {
        fcaD,
        wIn,
        dS,
        bS,
        AS,
        fS,
        geo,
        fGeo,
        an,
        a,
        b,
        X0,
        Pu1,
        SP,
        AN,
        tw,
        Lz,
        yb0: sh0.yb,
        yr,
        zr,
        PV,
        PH,
        EV,
        EH,
        TbV,
        TbH,
        cond,
        approxOK,
        aeff,
        beff: beffAnc,
        sV,
        sH,
        K,
        nK,
        lc,
        Ab,
        fca,
        fcaL,
        s1,
        nv1,
        LdV,
        LdH,
        nSt,
        AsV,
        AsVr,
        Abh,
        nMe,
        AsH,
        AsHr,
        smaxV,
        smaxH,
        close,
        Tsp,
        AspR,
        Asp,
        Tedge,
        AsL,
        AsLr,
        feT: fe(H_),
        feB: fe(0),
        edV,
        edH,
        loc,
        ok,
        XF,
        P0,
        shF,
      };
    })();

    // ---- phản lực gối 1 dầm (kN), 1 đầu ----
    const Rdn = dnG.reduce(
      (t, o) => t + (o.x <= 0 ? o.P : o.x >= Ls ? 0 : (o.P * (Ls - o.x)) / Ls),
      0,
    );
    const Rg = { DC: ((w1 + w2 + w3) * I.Lt) / 2 + Rdn, DW: (wDW * I.Lt) / 2 };

    return {
      rx,
      phiW,
      lamW,
      kind,
      L,
      Ls,
      Lm,
      brg,
      H,
      hs,
      hsw,
      hc,
      beff,
      oh,
      de,
      Ec,
      Eci,
      Ecs,
      np,
      ncs,
      fpj,
      fpy,
      Ap1,
      Apc,
      Aps,
      nC,
      T,
      ES,
      dES,
      loads,
      DF,
      IM,
      shr,
      res,
      rv,
      xv,
      stations,
      camber,
      TG,
      Rg,
      EIc,
      IF,
      As,
      AsT,
      ys,
      ysT,
      Ab1,
      Avf1,
      fsT,
      ftl,
      secAt,
      shp,
      gm,
      Vg,
      vol: Vg,
      jointTot: 0,
      lev: { xsG, xa, xb },
      anc,
    };
  }

  return { LIB, calc, shapeOf, bwAt, leverRule, mOf };
})();


// ============================================================================
// GID: Post-Tensioned I-Girder SVG Diagrams & Charts
// ============================================================================

export interface GidIlLabels {
  a?: string;
  b?: string;
  peak?: string;
  neg?: string;
  pos?: string;
}

export const GID = {
  f: (v: number | null | undefined, d = 2): string =>
    v == null || !isFinite(v) ? '' : (+v).toFixed(d),
  svg: (id: string, W: number, H: number, body: string, lbl?: string): string =>
    `<svg class="dg" id="${id}" width="${W}" height="${Math.round(H)}" viewBox="0 0 ${W} ${Math.round(H)}" role="img" aria-label="${lbl || ''}">${DGSTY}${dgDefs(id)}<rect width="${W}" height="${Math.round(H)}" fill="#fff"/>${body}</svg>`,
  kit: (id: string) => dgKit(id),

  // ---- chia vạch trục ----
  ticks: (a: number, b: number, n = 6): number[] => {
    let hi = b;
    if (!(hi > a)) {
      hi = a + 1;
    }
    const r = (hi - a) / n;
    const p = 10 ** Math.floor(Math.log10(r));
    const step = [1, 2, 2.5, 5, 10].find((k) => k * p >= r) ?? 10;
    const m = step * p;
    const s = Math.floor(a / m) * m;
    const e = Math.ceil(hi / m) * m;
    const out: number[] = [];
    for (let v = s; v <= e + m * 1e-6; v += m) out.push(+v.toFixed(10));
    return out;
  },

  // ---- biểu đồ XY (kiểu biểu đồ Excel: nền xám, lưới ngang, chú thích dưới trục) ----
  chart: (o: GidChartOptions): string => {
    const W = o.W || 740;
    const nS = o.series.length;
    const nRow = Math.ceil(nS / 2);
    const H = o.H || 300 + nRow * 18;
    const ml = 72;
    const mr = 24;
    const mt = 36;
    const mb = 58 + nRow * 18;
    const X0 = ml;
    const X1 = W - mr;
    const Y0 = mt;
    const Y1 = H - mb;
    const xs = o.series.flatMap((s) => s.x).filter(isFinite);
    const ys = o.series.flatMap((s) => s.y).filter(isFinite);
    let xmin = o.xmin ?? Math.min(...xs);
    let xmax = o.xmax ?? Math.max(...xs);
    let ymin = o.ymin ?? Math.min(0, ...ys);
    let ymax = o.ymax ?? Math.max(...ys);
    if (ymax - ymin < 1e-9) {
      ymax = ymin + 1;
    }
    const yt = GID.ticks(ymin, ymax, 6);
    ymin = Math.min(ymin, yt[0]);
    ymax = Math.max(ymax, yt[yt.length - 1]);
    const xt = o.xticks || GID.ticks(xmin, xmax, 8);
    if (!o.xticks && o.xmax == null) {
      xmax = Math.max(xmax, xt[xt.length - 1]);
    }
    if (!o.xticks && o.xmin == null) {
      xmin = Math.min(xmin, xt[0]);
    }
    const X = (x: number): number => X0 + ((x - xmin) / (xmax - xmin)) * (X1 - X0);
    const Y = (y: number): number => Y1 - ((y - ymin) / (ymax - ymin)) * (Y1 - Y0);
    let b = `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" fill="#fff" stroke="#000" stroke-width="0.8"/>`;
    b += `<text x="${W / 2}" y="20" text-anchor="middle" style="font-weight:bold;font-size:13px">${o.title}</text>`;
    b += `<rect x="${X0}" y="${Y0}" width="${X1 - X0}" height="${Y1 - Y0}" fill="#e3e3e3" stroke="#808080" stroke-width="0.8"/>`;
    const dg = Math.abs(yt[1] - yt[0]) || 1;
    const dec = dg >= 1 ? 0 : dg >= 0.1 ? 1 : dg >= 0.01 ? 2 : 3;
    yt.forEach((v) => {
      if (v < ymin - 1e-9 || v > ymax + 1e-9) return;
      const y = Y(v);
      b += `<line x1="${X0}" y1="${y.toFixed(1)}" x2="${X1}" y2="${y.toFixed(1)}" stroke="#000" stroke-width="0.5"/><text x="${X0 - 6}" y="${(y + 4).toFixed(1)}" text-anchor="end" class="s">${v.toFixed(dec)}</text>`;
    });
    const dgx = Math.abs(xt[1] - xt[0]) || 1;
    const decx = o.xdec ?? (dgx >= 1 ? 1 : dgx >= 0.1 ? 2 : 3);
    xt.forEach((v) => {
      if (v < xmin - 1e-9 || v > xmax + 1e-9) return;
      const x = X(v);
      b += `<line x1="${x.toFixed(1)}" y1="${Y1}" x2="${x.toFixed(1)}" y2="${Y1 + 4}" stroke="#000" stroke-width="0.8"/><text x="${x.toFixed(1)}" y="${Y1 + 16}" text-anchor="middle" class="s">${v.toFixed(decx)}</text>`;
    });
    if (ymin < 0 && ymax > 0)
      b += `<line x1="${X0}" y1="${Y(0).toFixed(1)}" x2="${X1}" y2="${Y(0).toFixed(1)}" stroke="#000" stroke-width="1"/>`;
    b += `<text x="${(X0 + X1) / 2}" y="${Y1 + 32}" text-anchor="middle" style="font-weight:bold">${o.xt || ''}</text>`;
    b += `<text transform="translate(16,${(Y0 + Y1) / 2}) rotate(-90)" text-anchor="middle" style="font-weight:bold">${o.yt || ''}</text>`;
    const mk = (t: string, x: number, y: number, c: string): string => {
      const s = 3.6;
      if (t === 'sq')
        return `<rect x="${(x - s).toFixed(1)}" y="${(y - s).toFixed(1)}" width="${2 * s}" height="${2 * s}" fill="${c}" stroke="${c}"/>`;
      if (t === 'tri')
        return `<polygon points="${x.toFixed(1)},${(y - s - 0.8).toFixed(1)} ${(x + s).toFixed(1)},${(y + s).toFixed(1)} ${(x - s).toFixed(1)},${(y + s).toFixed(1)}" fill="${c}"/>`;
      if (t === 'dia')
        return `<polygon points="${x.toFixed(1)},${(y - s - 1).toFixed(1)} ${(x + s + 1).toFixed(1)},${y.toFixed(1)} ${x.toFixed(1)},${(y + s + 1).toFixed(1)} ${(x - s - 1).toFixed(1)},${y.toFixed(1)}" fill="${c}"/>`;
      if (t === 'x')
        return `<path d="M${x - s} ${y - s} L${x + s} ${y + s} M${x - s} ${y + s} L${x + s} ${y - s}" stroke="${c}" stroke-width="1.4"/>`;
      if (t === 'ci')
        return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${s}" fill="${c}"/>`;
      return '';
    };
    b += `<clipPath id="cp${o.id}"><rect x="${X0}" y="${Y0 - 2}" width="${X1 - X0}" height="${Y1 - Y0 + 4}"/></clipPath><g clip-path="url(#cp${o.id})">`;
    o.series.forEach((s) => {
      const P: Point2D[] = [];
      for (let i = 0; i < s.x.length; i++) {
        if (isFinite(s.x[i]) && isFinite(s.y[i])) P.push([s.x[i], s.y[i]]);
      }
      if (!P.length) return;
      b += `<polyline points="${P.map((p) => X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ')}" fill="none" stroke="${s.c}" stroke-width="${s.w || 1.6}" ${s.dash ? 'stroke-dasharray="7,4"' : ''}/>`;
      if (s.mk) {
        const mkType = s.mk;
        P.forEach((p) => {
          b += mk(mkType, X(p[0]), Y(p[1]), s.c);
        });
      }
    });
    b += `</g>`;
    // chú thích
    const lw = (X1 - X0) / 2;
    const ly0 = Y1 + 44;
    b += `<rect x="${X0 + 10}" y="${ly0 - 6}" width="${X1 - X0 - 20}" height="${nRow * 18 + 8}" fill="#fff" stroke="#000" stroke-width="0.6"/>`;
    o.series.forEach((s, i) => {
      const cx = X0 + 20 + (i % 2) * lw;
      const cy = ly0 + 6 + Math.floor(i / 2) * 18;
      b +=
        `<line x1="${cx}" y1="${cy}" x2="${cx + 34}" y2="${cy}" stroke="${s.c}" stroke-width="${s.w || 1.6}" ${s.dash ? 'stroke-dasharray="7,4"' : ''}/>` +
        (s.mk ? mk(s.mk, cx + 17, cy, s.c) : '') +
        `<text x="${cx + 40}" y="${cy + 4}" class="s">${s.n}</text>`;
    });
    return GID.svg(o.id, W, H, b, o.title);
  },

  col: ['#000080', '#ff00ff', '#0000ff', '#ff0000', '#800080', '#999933', '#2a9df4', '#008000'],
  mks: ['dia', 'sq', 'tri', 'x', 'sq', 'ci', 'ci', 'tri'],

  // ---- 1. Mặt cắt ngang dầm I (mục II.1 của Excel) ----
  sec: (id: string, G: GiInput, R: GiCalcResult): string => {
    const W = 760;
    const d = GID.kit(id);
    const sh = GI.shapeOf(G, G.bw);
    const P = sh.P;
    const H = G.H;
    const hs = R.hs;
    const bf = R.beff;
    const k = Math.min(250 / (H + hs), 300 / Math.max(G.b3, G.b1));
    const kd = Math.min(k, 330 / bf);
    void kd;
    const x0 = 210;
    const yb = 70 + (H + hs) * k;
    const X = (x: number): number => x0 + x * k;
    const Y = (y: number): number => yb - y * k;
    // bản mặt cầu (vẽ bề rộng thu gọn quanh dầm)
    const bd = Math.min(bf, 2 * Math.max(G.b3, G.b1) * 1.6) / 2;
    d.poly(
      [
        [X(-bd), Y(H)],
        [X(bd), Y(H)],
        [X(bd), Y(H + hs)],
        [X(-bd), Y(H + hs)],
      ],
      `url(#hD${id})`,
    );
    d.poly(
      P.map(([x, y]): Point2D => [X(x), Y(y)]),
      '#f2f2f2',
    );
    d.L(X(0), Y(-20), X(0), Y(H + hs + 25), 'c');
    // ống ghen tại giữa dầm
    (R.res[R.res.length - 1].cab || []).forEach((q) => {
      d.s += `<circle class="t" cx="${X(q.z).toFixed(1)}" cy="${Y(q.y).toFixed(1)}" r="${((G.D / 2) * k).toFixed(1)}" fill="#fff"/><circle cx="${X(q.z).toFixed(1)}" cy="${Y(q.y).toFixed(1)}" r="${Math.max(2, (G.D / 4) * k).toFixed(1)}" fill="#000"/>`;
    });
    // kích thước ngang
    d.dimH(X(-G.b1 / 2), X(G.b1 / 2), Y(0) + 24, 'b1', Y(0));
    d.dimH(X(-bd), X(bd), Y(H + hs) - 34, 'b7', Y(H + hs));
    d.dimH(X(-G.b3 / 2), X(G.b3 / 2), Y(H + hs) - 16, 'b3', Y(H - G.h6));
    d.dimH(X(-G.b4 / 2), X(G.b4 / 2), Y(H) + 16, 'b4');
    const yw = G.h1 + sh.h2 + sh.h3 * 0.5;
    d.dimH(X(-G.bw / 2), X(G.bw / 2), Y(yw), 'b2');
    if (sh.b5 > 0) {
      d.dimH(X(-G.b1 / 2), X(-G.bw / 2), Y(G.h1 + sh.h2) + 2, 'b5');
    }
    if (sh.b6 > 0) {
      d.dimH(X(G.bw / 2), X(G.b3 / 2), Y(H - G.h6 - G.h5 - sh.h4) - 4, 'b6');
    }
    // kích thước đứng (bên phải)
    const xr = X(Math.max(G.b3, G.b1) / 2) + 26;
    const lv: Array<[string, number, number]> = [
      ['h1', 0, G.h1],
      ['h2', G.h1, G.h1 + sh.h2],
      ['h3', G.h1 + sh.h2, G.h1 + sh.h2 + sh.h3],
      ['h4', H - G.h6 - G.h5 - sh.h4, H - G.h6 - G.h5],
      ['h5', H - G.h6 - G.h5, H - G.h6],
      ['h6', H - G.h6, H],
      ['h7', H, H + hs],
    ];
    lv.forEach(([t, a, b]) => {
      if (b - a < 1) return;
      d.s += `<line class="t" x1="${xr}" y1="${Y(a).toFixed(1)}" x2="${xr}" y2="${Y(b).toFixed(1)}" marker-start="url(#a${id})" marker-end="url(#a${id})"/>`;
      d.L(xr - 5, Y(a), xr + 5, Y(a));
      d.L(xr - 5, Y(b), xr + 5, Y(b));
      d.T(xr + 8, (Y(a) + Y(b)) / 2 + 4, t, 'start', 'class="s"');
    });
    d.dimV(X(-Math.max(G.b3, G.b1) / 2) - 40, Y(0), Y(H), 'H', -1);
    const ycg = R.res[R.res.length - 1].sc.yb1;
    d.L(X(-G.b1 / 2) - 20, Y(ycg), X(G.b1 / 2) + 6, Y(ycg), 'd');
    d.T(X(-G.b1 / 2) - 22, Y(ycg) + 4, 'yc', 'end', 'class="s"');
    // mặt cắt chia thành phần (bên phải)
    const k2 = Math.min(230 / (H + hs), 170 / Math.max(G.b3, G.b1));
    const x2 = 600;
    const yb2 = 70 + (H + hs) * k2;
    const X2 = (x: number): number => x2 + x * k2;
    const Y2 = (y: number): number => yb2 - y * k2;
    const h2 = sh.h2;
    const h3 = sh.h3;
    const h4 = sh.h4;
    const y1 = G.h1;
    const y2 = y1 + h2;
    const y3 = y2 + h3;
    const y4 = y3 + h4;
    const y5 = y4 + G.h5;
    const parts: Point2D[][] = [
      [
        [-G.b1 / 2, 0],
        [G.b1 / 2, 0],
        [G.b1 / 2, y1],
        [-G.b1 / 2, y1],
      ],
      [
        [G.bw / 2, y1],
        [G.b1 / 2, y1],
        [G.bw / 2, y2],
      ],
      [
        [-G.bw / 2, y1],
        [G.bw / 2, y1],
        [G.bw / 2, y4],
        [-G.bw / 2, y4],
      ],
      [
        [G.bw / 2, y3],
        [G.b3 / 2, y4],
        [G.bw / 2, y4],
      ],
      [
        [-G.b3 / 2, y4],
        [G.b3 / 2, y4],
        [G.b3 / 2, y5],
        [-G.b3 / 2, y5],
      ],
      [
        [-G.b4 / 2, y5],
        [G.b4 / 2, y5],
        [G.b4 / 2, H],
        [-G.b4 / 2, H],
      ],
      [
        [-Math.max(G.b3, G.b1) * 0.75, H],
        [Math.max(G.b3, G.b1) * 0.75, H],
        [Math.max(G.b3, G.b1) * 0.75, H + hs],
        [-Math.max(G.b3, G.b1) * 0.75, H + hs],
      ],
    ];
    const fills = ['#d9d9d9', '#bfbfbf', '#ededed', '#bfbfbf', '#d9d9d9', '#c8c8c8', '#f5f0d0'];
    parts.forEach((pp, i) => {
      d.poly(
        pp.map(([x, y]): Point2D => [X2(x), Y2(y)]),
        fills[i],
      );
      if (i === 1 || i === 3)
        d.poly(
          pp.map(([x, y]): Point2D => [X2(-x), Y2(y)]),
          fills[i],
        );
    });
    const lab: Point2D[] = [
      [0, G.h1 / 2],
      [(G.bw + G.b1) / 4 + (G.b1 - G.bw) / 8, y1 + h2 / 3],
      [0, (y1 + y4) / 2],
      [(G.bw + G.b3) / 4 + (G.b3 - G.bw) / 8, y3 + h4 * 0.66],
      [0, y4 + G.h5 / 2],
      [0, y5 + G.h6 / 2],
      [0, H + hs / 2],
    ];
    lab.forEach(([x, y], i) => {
      const cx = X2(x);
      const cy = Y2(y);
      d.s += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="8" fill="#fff" stroke="#000" stroke-width="0.8"/>`;
      d.T(cx, cy + 4, String(i + 1), 'middle', 'class="s"');
      if (i === 1 || i === 3) {
        const c2 = X2(-x);
        d.s += `<circle cx="${c2.toFixed(1)}" cy="${cy.toFixed(1)}" r="8" fill="#fff" stroke="#000" stroke-width="0.8"/>`;
        d.T(c2, cy + 4, String(i + 1), 'middle', 'class="s"');
      }
    });
    const Ht = Math.max(yb, yb2) + 60;
    return GID.svg(id, W, Ht, d.s, 'Mặt cắt ngang dầm I');
  },

  // ---- 2. Bố trí cáp (mục II.2 của Excel): nửa dầm mặt đứng, mặt bằng, mặt cắt giữa dầm và đầu dầm ----
  cab: (id: string, G: GiInput, R: GiCalcResult): string => {
    const W = 760;
    const d = GID.kit(id);
    const L = R.L;
    const Lh = L / 2;
    const H = G.H;
    const T = R.T;
    const xL = 60;
    const xR = 700;
    const kx = (xR - xL) / Lh;
    const ky = Math.min(1.3 * kx * 8, 170 / H);
    const X = (x: number): number => xL + x * kx; // x tính từ đầu dầm
    // mặt đứng
    const yE = 30 + H * ky + 10;
    const Y = (y: number): number => yE - y * ky;
    d.poly(
      [
        [X(0), Y(0)],
        [X(Lh), Y(0)],
        [X(Lh), Y(H)],
        [X(0), Y(H)],
      ],
      '#ececec',
    );
    d.L(X(Lh), Y(-15), X(Lh), Y(H + 25), 'c');
    d.T(X(Lh) + 4, Y(H) - 6, 'Y', 'start');
    d.s += `<polygon points="${X(R.brg)},${Y(0)} ${X(R.brg) - 6},${Y(0) + 10} ${X(R.brg) + 6},${Y(0) + 10}" fill="#fff" stroke="#000"/>`;
    T.forEach((t, i) => {
      const pts: Point2D[] = [];
      for (let k = 0; k <= 60; k++) {
        const xc = t.Lx * (1 - k / 60);
        pts.push([X(Lh - xc), Y(t.y(xc))]);
      }
      d.s += `<polyline points="${pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')}" fill="none" stroke="${GID.col[i % 8]}" stroke-width="1.4"/>`;
      d.s += `<circle cx="${X(t.L1).toFixed(1)}" cy="${Y(t.yE).toFixed(1)}" r="2.5" fill="#000"/>`;
    });
    const t0 = T[0];
    d.dimH(X(0), X(t0.L1), Y(H) - 12, 'L1', Y(H));
    d.dimH(X(Lh - t0.L2), X(Lh), Y(H) - 12, 'L2', Y(H));
    d.T(X(Lh * 0.45), Y(t0.y(Lh * 0.55)) - 8, 'y = a.x²', 'middle', 'style="font-style:italic"');
    d.dimH(X(0), X(Lh), Y(0) + 40, 'L/2');
    d.dimH(X(R.brg), X(Lh), Y(0) + 24, 'Ls/2');
    {
      const xc = Lh * 0.5;
      const xx = X(Lh - xc);
      const yy = Y(t0.y(xc));
      d.L(xx, yy, xx, Y(0), 'g');
      d.T(xx + 4, (yy + Y(0)) / 2, 'yi', 'start', 'class="s"');
      d.dimH(xx, X(Lh), Y(0) + 8, 'xi');
    }
    d.T(X(t0.L1) + 18, Y(t0.yE) + 16, 'θ', 'start');
    // mặt bằng
    const zmax = Math.max(G.b1, G.b3) / 2;
    const kz = Math.min(ky * 1.6, 60 / zmax);
    const yP = yE + 90 + zmax * kz;
    const Z = (z: number): number => yP - z * kz;
    d.poly(
      [
        [X(0), Z(-G.b1 / 2)],
        [X(Lh), Z(-G.b1 / 2)],
        [X(Lh), Z(G.b1 / 2)],
        [X(0), Z(G.b1 / 2)],
      ],
      '#ececec',
    );
    d.L(X(0), Z(0), X(Lh) + 12, Z(0), 'c');
    d.T(X(Lh) + 14, Z(0) + 4, 'X', 'start');
    T.forEach((t, i) => {
      if (Math.abs(t.zE) < 1e-6 && Math.abs(t.zM) < 1e-6) return;
      const pts: Point2D[] = [];
      for (let k = 0; k <= 80; k++) {
        const xc = t.Lx * (1 - k / 80);
        pts.push([X(Lh - xc), Z(t.z(xc))]);
      }
      d.s += `<polyline points="${pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')}" fill="none" stroke="${GID.col[i % 8]}" stroke-width="1.4"/>`;
    });
    const tz = T.find((t) => t.L4 > 0) || T[0];
    if (tz.L4 > 0) {
      d.dimH(X(Lh - tz.L3), X(Lh), Z(-G.b1 / 2) + 16, 'L3');
      d.dimH(X(Lh - tz.L3 - tz.L4), X(Lh - tz.L3), Z(-G.b1 / 2) + 16, 'L4');
      d.T(X(Lh - tz.L3) + 4, Z(tz.zM) - 4, 'zi', 'start', 'class="s"');
    }
    // mặt cắt giữa dầm và đầu dầm
    const yS = Z(-G.b1 / 2) + 50;
    const k3 = Math.min(150 / H, 0.11);
    const drawX = (cx: number, b2: number, tt: string, which: 'm' | 'e'): void => {
      const sh = GI.shapeOf(G, b2);
      const Yb = yS + H * k3;
      d.poly(
        sh.P.map(([x, y]): Point2D => [cx + x * k3, Yb - y * k3]),
        '#f2f2f2',
      );
      d.L(cx, Yb + 8, cx, yS - 8, 'c');
      T.forEach((t) => {
        const xc = which === 'm' ? 0 : t.Lx;
        d.s += `<circle cx="${(cx + t.z(xc) * k3).toFixed(1)}" cy="${(Yb - t.y(xc) * k3).toFixed(1)}" r="${Math.max(2.5, (G.D / 2) * k3).toFixed(1)}" fill="#000"/>`;
      });
      d.T(cx, Yb + 24, tt, 'middle', 'style="font-weight:bold"');
      d.dimV(cx - (Math.max(G.b1, G.b3) / 2) * k3 - 14, Yb, Yb - H * k3, 'H', -1);
    };
    drawX(200, G.bw, 'Mặt cắt ngang giữa dầm', 'm');
    drawX(560, G.bwE, 'Mặt cắt ngang đầu dầm', 'e');
    return GID.svg(id, W, yS + H * k3 + 40, d.s, 'Bố trí cáp dự ứng lực');
  },

  // ---- 3. Xe tải thiết kế, xe hai trục, tải trọng làn (mục II.3.2 của Excel) ----
  veh: (id: string): string => {
    const W = 760;
    const d = GID.kit(id);
    // xe tải: thân xe đơn giản hóa
    const y0 = 120;
    const xs = [300, 420, 600];
    d.s += `<rect x="250" y="${y0 - 78}" width="390" height="62" fill="#fff" stroke="#000" stroke-width="1.2"/><rect x="232" y="${y0 - 60}" width="56" height="44" fill="#fff" stroke="#000"/><rect x="238" y="${y0 - 55}" width="22" height="16" fill="#ddd" stroke="#000" stroke-width="0.6"/>`;
    for (let i = 0; i < 7; i++) d.L(300, y0 - 72 + i * 8, 630, y0 - 72 + i * 8, 't');
    xs.forEach((x, i) => {
      d.s += `<circle cx="${x}" cy="${y0 - 8}" r="15" fill="#fff" stroke="#000" stroke-width="2"/><circle cx="${x}" cy="${y0 - 8}" r="5" fill="#000"/>`;
      d.A(x, y0 + 12, x, y0 + 48);
      d.T(x, y0 + 64, 'P' + (i + 1), 'middle', 'style="font-weight:bold"');
    });
    d.L(200, y0 + 8, 680, y0 + 8, 't');
    d.dimH(300, 420, y0 + 30, 'V1 = 4.3 m');
    d.dimH(420, 600, y0 + 30, 'V2 = 4.3 to 9.0 m');
    d.T(70, y0 - 40, 'Xe tải thiết kế', 'start', 'style="font-weight:bold"');
    // xe hai trục
    const y1 = y0 + 130;
    d.s += `<rect x="330" y="${y1 - 30}" width="120" height="16" fill="#fff" stroke="#000"/>`;
    [340, 420].forEach((x, i) => {
      d.A(x, y1 - 14, x, y1 + 18);
      d.T(x, y1 + 34, 'P' + (i + 4), 'middle', 'style="font-weight:bold"');
    });
    d.L(200, y1, 680, y1, 't');
    d.dimH(340, 420, y1 - 40, '1.2 m');
    d.T(70, y1 - 10, 'Xe hai trục thiết kế', 'start', 'style="font-weight:bold"');
    // tải trọng làn
    const y2 = y1 + 90;
    d.L(240, y2 - 24, 680, y2 - 24, 't');
    for (let x = 240; x <= 680; x += 20) d.A(x, y2 - 24, x, y2);
    d.L(200, y2 + 4, 700, y2 + 4, 't');
    d.T(560, y2 - 32, '9.3 kN/m', 'middle');
    d.T(70, y2 - 6, 'Tải trọng làn thiết kế', 'start', 'style="font-weight:bold"');
    return GID.svg(id, W, y2 + 24, d.s, 'Hoạt tải HL-93');
  },

  // ---- 4. Đường ảnh hưởng mômen / lực cắt tại mặt cắt, xếp xe (mục II.3.2 của Excel) ----
  il: (id: string, r: GiSectionRes, Lm: number, kind: 'M' | 'V', lbl: GidIlLabels): string => {
    const W = 740;
    const d = GID.kit(id);
    const x = r.x;
    const xL = 40;
    const xR = 700;
    const k = (xR - xL) / Lm;
    const X = (a: number): number => xL + a * k;
    const yb = 150;
    const isM = kind === 'M';
    const tr = isM ? r.bT : r.vT;
    const td = isM ? r.bD : r.vD;
    d.L(X(0), yb, X(Lm), yb, 'l');
    [0, Lm].forEach((a) => {
      d.s += `<polygon points="${X(a)},${yb} ${X(a) - 6},${yb + 10} ${X(a) + 6},${yb + 10}" fill="#fff" stroke="#000"/>`;
    });
    // đường ảnh hưởng
    const yk = isM ? 60 / Math.max(1e-6, (x * (Lm - x)) / Lm || 1) : 60;
    if (isM) {
      const h = (x * (Lm - x)) / Lm;
      d.poly(
        [
          [X(0), yb],
          [X(x), yb + h * yk],
          [X(Lm), yb],
        ],
        '#f4f4f4',
      );
      if (x > 0) d.T(X(x) + 4, yb + h * yk + 14, lbl.peak || '', 'start', 'class="s"');
    } else {
      const h1 = x / Lm;
      const h2 = (Lm - x) / Lm;
      if (x > 0) {
        d.poly(
          [
            [X(0), yb],
            [X(x), yb - h1 * yk],
            [X(x), yb],
          ],
          '#f4f4f4',
        );
        d.T(X(x) - 4, yb - h1 * yk - 4, lbl.neg || '', 'end', 'class="s"');
      }
      d.poly(
        [
          [X(x), yb],
          [X(x), yb + h2 * yk],
          [X(Lm), yb],
        ],
        '#f4f4f4',
      );
      d.T(X(x) - 4, yb + h2 * yk + 4, lbl.pos || '', 'end', 'class="s"');
    }
    if (x > 0 && x < Lm) {
      d.L(X(x), 20, X(x), yb + 70, 'g');
    }
    // kích thước
    if (x > 0) {
      d.dimH(X(0), X(x), 14, lbl.a || '');
      d.dimH(X(x), X(Lm), 14, lbl.b || '');
    } else d.dimH(X(0), X(Lm), 14, 'Ls');
    // làn
    const l0 = isM ? 0 : x;
    const l1 = Lm;
    d.s += `<rect x="${X(l0).toFixed(1)}" y="${yb - 14}" width="${(X(l1) - X(l0)).toFixed(1)}" height="10" fill="url(#hP${id})" stroke="#000" stroke-width="0.6"/>`;
    d.T(X(Lm) - 4, yb - 18, 'Tải trọng làn thiết kế', 'end', 'class="s"');
    // xe tải
    if (tr && tr.ax) {
      const sorted = tr.ax.slice();
      const names: string[] = sorted.map((o) => (o.P === 35 ? 'P1' : ''));
      let n2 = 2;
      sorted.forEach((o, i) => {
        if (o.P !== 35) names[i] = 'P' + n2++;
      });
      sorted.forEach((o, i) => {
        if (o.a < 0 || o.a > Lm) return;
        d.A(X(o.a), 40, X(o.a), 66);
        d.T(X(o.a), 36, names[i], 'middle', 'class="s"');
      });
      {
        const onAx = sorted.filter((o) => o.a >= 0 && o.a <= Lm).map((o) => o.a);
        const xm = X(Math.min(...onAx));
        d.T(
          xm > 150 ? xm - 6 : X(Math.max(...onAx)) + 8,
          56,
          'Xe tải thiết kế',
          xm > 150 ? 'end' : 'start',
          'class="s"',
        );
      }
    }
    if (td && td.ax) {
      td.ax.forEach((o, i) => {
        if (o.a < 0 || o.a > Lm) return;
        d.A(X(o.a), 84, X(o.a), yb - 18);
        d.T(X(o.a), 80, 'P' + (i === 0 ? 5 : 4), 'middle', 'class="s"');
      });
      d.L(X(td.ax[0].a), 84, X(td.ax[1].a), 84, 't');
      {
        const xm = X(Math.min(...td.ax.map((o) => o.a)));
        d.T(
          xm > 150 ? xm - 6 : X(Math.max(...td.ax.map((o) => o.a))) + 8,
          96,
          'Xe hai trục thiết kế',
          xm > 150 ? 'end' : 'start',
          'class="s"',
        );
      }
    }
    return GID.svg(id, W, yb + 80, d.s, 'Đường ảnh hưởng');
  },

  // ---- 5. Sơ đồ mất mát do tụt neo (mục II.5.2 của Excel) ----
  set: (id: string): string => {
    const d = GID.kit(id);
    const W = 420;
    const x0 = 60;
    const y0 = 40;
    const x1 = 380;
    const y1 = 200;
    d.A(x0, y1, x0, y0 - 10);
    d.A(x0, y1, x1 + 20, y1);
    d.T(x0 - 6, y0 - 14, 'Ứng suất', 'end', 'class="s"');
    d.T(x1, y1 + 30, 'Khoảng cách tới cuối bó cáp', 'end', 'class="s"');
    const fpjPt: Point2D = [x0, y0 + 10];
    const fsPt: Point2D = [x0 + 170, y0 + 90];
    const fpsPt: Point2D = [x0, y0 + 170 - 30];
    d.s += `<polygon points="${fpjPt[0]},${fpjPt[1]} ${fsPt[0]},${fsPt[1]} ${fpsPt[0]},${fpsPt[1]}" fill="url(#hD${id})" stroke="none"/>`;
    d.L(fpjPt[0], fpjPt[1], x1, y0 + 170, 'l');
    d.L(fpsPt[0], fpsPt[1], fsPt[0], fsPt[1], 'l');
    d.T(x0 + 4, fpjPt[1] - 2, 'fpj', 'start');
    d.T(x0 + 4, fpsPt[1] + 14, 'fps', 'start');
    d.T(fsPt[0] + 6, fsPt[1] - 6, 'fps1', 'start');
    d.dimH(x0, fsPt[0], y1 - 14, 'ls');
    d.T(x0 + 80, y0 + 60, 'Mất mát do tụt neo', 'middle', 'class="s"');
    return GID.svg(id, W, y1 + 40, d.s, 'Mất mát do tụt neo');
  },

  // ---- 6. Sơ đồ tính độ vồng (mục IV của Excel) ----
  cam: (id: string): string => {
    const d = GID.kit(id);
    const W = 620;
    const x0 = 80;
    const x1 = 540;
    const yt = 60;
    const yb = 110;
    for (let x = x0; x <= x1; x += 23) d.A(x, 22, x, yt - 2);
    d.L(x0, 22, x1, 22, 't');
    d.T(x1 + 14, 40, 'q', 'start');
    d.poly(
      [
        [x0, yt],
        [x1, yt],
        [x1, yb],
        [x0, yb],
      ],
      '#eee',
    );
    d.L(x0 - 10, (yt + yb) / 2 - 6, x1 + 10, (yt + yb) / 2 - 6, 'c');
    d.s += `<path d="M${x0} ${yb - 10} Q ${(x0 + x1) / 2} ${yb + 22} ${x1} ${yb - 10}" fill="none" stroke="#000" stroke-width="2"/>`;
    d.A(x0 - 46, yb - 10, x0 - 2, yb - 10);
    d.A(x1 + 46, yb - 10, x1 + 2, yb - 10);
    d.T(x0 - 50, yb - 6, 'P', 'end');
    d.T(x1 + 50, yb - 6, 'P', 'start');
    d.dimV(x0 + 16, (yt + yb) / 2 - 6, yb - 10, 'e1', 1);
    d.dimV((x0 + x1) / 2 + 10, (yt + yb) / 2 - 6, yb + 6, 'e2', 1);
    [x0 + 20, x1 - 20].forEach((x) => {
      d.s += `<polygon points="${x},${yb} ${x - 8},${yb + 12} ${x + 8},${yb + 12}" fill="#fff" stroke="#000"/>`;
    });
    return GID.svg(id, W, yb + 30, d.s, 'Sơ đồ tính độ vồng');
  },

  // ---- vùng neo đầu dầm: mặt đầu dầm (bố trí neo) và mặt đứng vùng neo ----
  anc: (id: string, G: GiInput, R: GiCalcResult): string => {
    const W = 760;
    const d = GID.kit(id);
    const A = R.anc;
    const P = A.P0;
    const H = G.H;
    const tw = A.tw;
    const k = 330 / H;
    const xc = 170;
    const yB = 400;
    const X = (x: number): number => xc + x * k;
    const Y = (y: number): number => yB - y * k;
    d.T(
      W / 2,
      18,
      'Vùng neo đầu dầm: mặt đầu dầm (trái) và mặt đứng vùng neo (phải)',
      'middle',
      'font-weight="bold"',
    );
    d.poly(
      P.map(([x, y]): Point2D => [X(x), Y(y)]),
      `url(#hC${id})`,
    );
    d.L(
      X(-Math.max(...P.map((p) => p[0])) - 20),
      Y(A.yb0),
      X(Math.max(...P.map((p) => p[0])) + 20),
      Y(A.yb0),
      'c',
    );
    d.T(X(Math.max(...P.map((p) => p[0])) + 24), Y(A.yb0) + 4, 'trọng tâm', 'start', 'class="s"');
    d.L(X(0), Y(H) - 12, X(0), Y(0) + 12, 'c');
    A.AN.forEach((q) => {
      const x1 = X(q.z - A.b / 2);
      const y1 = Y(q.y + A.a / 2);
      d.s += `<rect x="${x1.toFixed(1)}" y="${y1.toFixed(1)}" width="${(A.b * k).toFixed(1)}" height="${(A.a * k).toFixed(1)}" style="fill:#bbb;stroke:#000;stroke-width:1"/>`;
      d.s += `<circle cx="${X(q.z).toFixed(1)}" cy="${Y(q.y).toFixed(1)}" r="${((G.D / 2) * k).toFixed(1)}" style="fill:#fff;stroke:#000;stroke-width:0.8"/>`;
      d.T(X(-tw / 2) - 46, Y(q.y) + 4, 'y = ' + GID.f(q.y, 0), 'end', 'class="s"');
      d.L(X(-tw / 2) - 44, Y(q.y), X(q.z - A.b / 2), Y(q.y), 'd');
    });
    d.dimH(X(-tw / 2), X(tw / 2), Y(0) + 22, 't = ' + GID.f(tw, 0), Y(0));
    d.dimV(X(Math.max(...P.map((p) => p[0]))) + 70, Y(H), Y(0), 'H = ' + GID.f(H, 0));
    d.T(
      xc,
      Y(0) + 44,
      `${A.AN.length} neo, bản neo a × b = ${GID.f(A.a, 0)} × ${GID.f(A.b, 0)} mm`,
      'middle',
      'class="s"',
    );
    // mặt đứng
    const x0 = 420;
    const kx = 290 / (A.Lz + 300);
    const Xe = (x: number): number => x0 + x * kx;
    d.poly(
      [
        [Xe(0), Y(H)],
        [Xe(A.Lz + 300), Y(H)],
        [Xe(A.Lz + 300), Y(0)],
        [Xe(0), Y(0)],
      ],
      `url(#hC${id})`,
    );
    const LdV = A.LdV;
    const dV = A.PV.d161;
    d.s += `<rect x="${Xe(A.X0).toFixed(1)}" y="${Y(H).toFixed(1)}" width="${(Math.min(LdV, A.Lz + 300 - A.X0) * kx).toFixed(1)}" height="${(H * k).toFixed(1)}" style="fill:#ffe9a8;fill-opacity:0.6;stroke:none"/>`;
    for (let s = A.s1; s <= Math.min(LdV, A.Lz + 300 - A.X0); s += A.s1)
      d.L(Xe(A.X0 + s), Y(H) + 4, Xe(A.X0 + s), Y(0) - 4, 't');
    A.AN.forEach((q) => {
      d.s += `<rect x="${(Xe(A.X0) - 5).toFixed(1)}" y="${Y(q.y + A.a / 2).toFixed(1)}" width="5" height="${(A.a * k).toFixed(1)}" style="fill:#555"/>`;
      const lenTail = A.Lz + 300 - A.X0;
      d.L(
        Xe(A.X0),
        Y(q.y),
        Xe(A.X0 + lenTail),
        Y(q.y - Math.tan(Math.abs(q.av)) * lenTail),
        't',
      );
    });
    d.L(Xe(A.X0 + dV), Y(H) - 8, Xe(A.X0 + dV), Y(0) + 8, 'd');
    d.T(Xe(A.X0 + dV), Y(H) - 12, 'dburst = ' + GID.f(dV, 0), 'middle', 'class="s"');
    d.dimH(
      Xe(A.X0),
      Xe(A.X0 + Math.min(LdV, A.Lz + 300 - A.X0)),
      Y(0) + 22,
      'phân bố cốt đai: ' + GID.f(LdV, 0) + (LdV > A.Lz + 300 - A.X0 ? ' (vẽ một phần)' : ''),
      Y(0),
    );
    d.dimH(Xe(0), Xe(A.X0 + A.Lz), Y(H) - 30, 'L1 + vùng neo ' + GID.f(A.Lz, 0), Y(H));
    d.T(
      Xe(0) + ((A.Lz + 300) * kx) / 2,
      Y(0) + 44,
      `Vùng tô vàng: cốt đai chống xé vỡ (mặt phẳng đứng), bước ${GID.f(A.s1, 0)} mm`,
      'middle',
      'class="s"',
    );
    return GID.svg(id, W, yB + 60, d.s, 'Vùng neo đầu dầm');
  },
};


// ============================================================================
// GIR State, Inputs, Library Loader, Formatting Helpers & Anchorage Report
// ============================================================================

let latestGirResult: GiCompositeResult | null = null;

export function getLatestGirResult(): GiCompositeResult | null {
  return latestGirResult;
}

export function setLatestGirResult(result: GiCompositeResult | null): void {
  latestGirResult = result;
}

const giTxt = (id: string): string => String($(`${id}`)?.value ?? '');

export function giInputs(): GiInput {
  const v = (id: string): number => num(id);
  const rows = (id: string): number[][] => nums(giTxt(id));
  const b4Val = v('gi_b4') || 0;
  const tpVal = v('gi_tpan');
  const apanVal = tpVal > 0 ? tpVal * Math.max(0, num('sp_S') - b4Val / 1000) : 0;
  const apanEl = $('gi_Apan');
  if (apanEl) {
    const t = apanVal.toFixed(4);
    if (apanEl.value !== t) apanEl.value = t;
    apanEl.readOnly = true;
    apanEl.classList?.add('lnk');
  }
  return {
    H: v('gi_H'),
    b1: v('gi_b1'),
    h1: v('gi_h1'),
    h2: v('gi_h2'),
    bw: v('gi_bw'),
    h4: v('gi_h4'),
    b3: v('gi_b3'),
    h5: v('gi_h5'),
    b4: v('gi_b4'),
    h6: v('gi_h6'),
    bwE: v('gi_bwE'),
    Le: v('gi_Le'),
    Ltr: v('gi_Ltr'),
    nstr: Math.max(1, Math.round(v('gi_nstr'))),
    D: v('gi_D'),
    mu: v('gi_mu'),
    K: v('gi_K'),
    set: v('gi_set'),
    cab: rows('gi_cab')
      .filter((a) => a.length >= 8)
      .map((a) => a.slice(0, 8) as GiCabTuple),
    sz: rows('gi_sz')
      .filter((a) => a.length >= 3)
      .map((a) => a.slice(0, 4) as GiStirrupZone),
    sd: v('gi_sd'),
    sn: v('gi_sn'),
    cd: v('gi_cd'),
    cn: v('gi_cn'),
    ag: v('gi_ag') || 19,
    As: [v('gi_Asn'), v('gi_Asd'), v('gi_Asy')],
    AsT: [v('gi_ATn'), v('gi_ATd'), v('gi_ATy')],
    Apan: apanVal,
    tpan: tpVal,
    dn: rows('gi_dn')
      .filter((a) => a.length >= 2)
      .map((a): GiDiaphragmTuple => [a[0], a[1]]),
    idMode: giTxt('gi_id') || 'full',
    Tu: v('gi_Tu'),
    an: {
      type: giTxt('gi_anT') || 'S',
      a: v('gi_ana') || 250,
      b: v('gi_anb') || 250,
      lc: v('gi_anlc'),
      smin: v('gi_ansm'),
      emin: v('gi_anem'),
      fciMin: v('gi_anfc'),
      bhd: v('gi_bhd') || 14,
      bhn: v('gi_bhn'),
      bhs: v('gi_bhs') || 150,
      spd: v('gi_spd') || 14,
      spn: v('gi_spn'),
    },
  };
}

export function giLoadLib(options?: GirderHollowStepOptions): void {
  const L = GI.LIB['33'];
  const g = L.g;
  const setVal = (id: string, val: string | number): void => {
    const e = $(id);
    if (e) e.value = String(val);
  };
  const ln = (a: ReadonlyArray<ReadonlyArray<number>>): string =>
    a.map((r) => r.join(' ')).join('\n');
  const numKeys = [
    'H',
    'b1',
    'h1',
    'h2',
    'bw',
    'h4',
    'b3',
    'h5',
    'b4',
    'h6',
    'bwE',
    'Le',
    'Ltr',
    'nstr',
    'D',
    'mu',
    'K',
    'set',
    'sd',
    'sn',
    'cd',
    'cn',
  ] as const;
  numKeys.forEach((k) => setVal('gi_' + k, g[k]));
  setVal('gi_tpan', g.tpan != null ? g.tpan : 0.08);
  setVal('gi_cab', ln(g.cab));
  setVal('gi_sz', ln(g.sz));
  setVal('gi_dn', ln(g.dn));
  setVal('gi_Asn', g.As[0]);
  setVal('gi_Asd', g.As[1]);
  setVal('gi_Asy', g.As[2]);
  setVal('gi_ATn', g.AsT[0]);
  setVal('gi_ATd', g.AsT[1]);
  setVal('gi_ATy', g.AsT[2]);
  if (g.an) {
    const an = g.an;
    setVal('gi_anT', an.type);
    const anMap: ReadonlyArray<[string, keyof GiAnchorInput]> = [
      ['ana', 'a'],
      ['anb', 'b'],
      ['anlc', 'lc'],
      ['ansm', 'smin'],
      ['anem', 'emin'],
      ['anfc', 'fciMin'],
      ['bhd', 'bhd'],
      ['bhn', 'bhn'],
      ['bhs', 'bhs'],
      ['spd', 'spd'],
      ['spn', 'spn'],
    ];
    anMap.forEach(([i, k]) => setVal('gi_' + i, an[k]));
  }
  if (L.bm) {
    Object.entries(L.bm).forEach(([k, val]) => setVal(k, val));
  }
  if (L.gc) {
    const c = L.gc;
    setVal('gc_L', c.L);
    setVal('gc_W', c.W);
    setVal('gc_n', c.n);
    setVal('gc_hri', c.hri);
    setVal('gc_hc', c.hc);
    setVal('gc_hs', c.hs);
    setVal('gc_nb', c.nb);
  }
  const s = L.sp;
  setVal('sp_Lt', s.Lt);
  setVal('sp_a0', s.a0);
  setVal('sp_Ng', s.Ng);
  setVal('sp_S', s.S);
  setVal('sp_hs', s.hs);
  setVal('sp_fc', s.fc);
  setVal('sp_fci', s.fci);
  setVal('sp_fcs', s.fcs);
  setVal('sp_Ep', s.Ep);
  setVal('sp_fpjr', s.fpjr);
  setVal('sp_ti', s.ti);
  setVal('sp_td', s.td);
  setVal('sp_RH', s.RH);
  setVal('sp_hm', s.hm);

  const hooks: GirderHollowHooks = { ...getGirderHollowHooks(), ...options?.hooks };
  hooks.saveAll?.();
  hooks.run?.();
}

// ---------- tiện ích trình bày ----------
const giE = (s: unknown): string =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

const gF = (v: number | null | undefined, d = 2): string =>
  v == null || !isFinite(v) ? '-' : fx(v, d);

const gR = (
  l: string,
  s: string,
  v: string | number | null | undefined,
  u: string,
  nt?: [boolean, string],
): string =>
  `<div class="row"><span></span><span>${l}</span><span class="sym">${s || ''}</span><span class="val">${v ?? ''}</span><span class="unit">${u || ''}</span>${nt ? `<span class="note ${nt[0] ? 'ok' : 'bad'}">${nt[1]}</span>` : ''}</div>`;

const gT = (t: string): string => `<div class="row"><span></span><span>${t}</span></div>`;

const gN = (t: string): string => `<div class="row small"><span></span><span>${t}</span></div>`;

const gM = (
  tex: string,
  s: string,
  v: string | number | null | undefined,
  u: string,
  nt?: [boolean, string],
): string =>
  `<div class="row f"><span></span><span><span class="m" data-tex="${giE(tex)}"></span></span><span class="sym">${s || ''}</span><span class="val">${v ?? ''}</span><span class="unit">${u || ''}</span>${nt ? `<span class="note ${nt[0] ? 'ok' : 'bad'}">${nt[1]}</span>` : ''}</div>`;

const gH2 = (n: number, t: string): string => `<h2>${n}.&nbsp;&nbsp;${t}</h2>`;
const gH3 = (t: string): string => `<h3>${t}</h3>`;
const gP = (t: string): string => `<p class="small">${t}</p>`;
const gOk = (ok: boolean, t?: string): string =>
  `<td class="c ${ok ? 'ok' : 'bad'}">${t || (ok ? 'OK' : 'NG')}</td>`;
const gKL = (ok: boolean, cols: number, note?: string): string =>
  `<tr><td class="l" colspan="${cols - 2}"><b>KẾT LUẬN</b>${note ? ' ' + note : ''}</td><td class="c ${ok ? 'ok' : 'bad'}" colspan="2"><b>${ok ? 'ĐẠT' : 'KHÔNG ĐẠT'}</b></td></tr>`;
const AAx = 'AASHTO LRFD 7th Ed. (2014)';

export type GiTableRow =
  | { grp: string }
  | { ok: (r: GiSectionRes) => boolean; 0: string; 1: string; 2: string }
  | [string, string, string, (r: GiSectionRes) => number | string, number?];

// bảng đại lượng theo 5 mặt cắt (Excel: các cột Gối, Ls/8, Ls/4, 3Ls/8, Ls/2)
const gQ = (res: GiSectionRes[], head: string, rows: GiTableRow[], extra?: string): string => {
  const n = res.length;
  let h = `<table class="t dt"><tr><th colspan="3" rowspan="2">${head || 'Đại lượng'}</th><th rowspan="2">Ký hiệu</th><th rowspan="2">Đơn vị</th><th colspan="${n}">Mặt cắt ngang dầm</th></tr><tr>${res.map((r) => `<th>${r.tag === 'v' ? 'x = dv' : r.tag}</th>`).join('')}</tr>`;
  h += `<tr><td class="l" colspan="3">Khoảng cách từ tim gối</td><td class="c">x</td><td class="c">m</td>${res.map((r) => `<td>${gF(r.x, 3)}</td>`).join('')}</tr>`;
  rows.forEach((q) => {
    if ('grp' in q) {
      h += `<tr class="grp"><td colspan="${5 + n}">${q.grp}</td></tr>`;
      return;
    }
    if ('ok' in q) {
      h += `<tr><td class="l" colspan="3">${q[0]}</td><td class="c">${q[1] || ''}</td><td class="c">${q[2] || ''}</td>${res.map((r) => gOk(q.ok(r))).join('')}</tr>`;
      return;
    }
    h += `<tr><td class="l" colspan="3">${q[0]}</td><td class="c">${q[1] || ''}</td><td class="c">${q[2] || ''}</td>${res
      .map((r) => {
        const val = q[3](r);
        return `<td>${typeof val === 'string' ? val : gF(val, q[4] ?? 2)}</td>`;
      })
      .join('')}</tr>`;
  });
  return h + (extra || '') + `</table>`;
};

// trải 5 mặt cắt nửa dầm thành 9 điểm trên cả nhịp (như sheet For Diagram)
const gMir = (R: GiCalcResult, f: (r: GiSectionRes) => number): { x: number[]; y: number[] } => {
  const v = R.res.map(f);
  return {
    x: [
      ...R.res.map((r) => r.x),
      ...R.res
        .slice(0, -1)
        .reverse()
        .map((r) => R.Lm - r.x),
    ],
    y: [...v, ...v.slice(0, -1).reverse()],
  };
};

// bảng kích thước cáp (như bảng "KÍCH THƯỚC CÁP" trong Excel)
export function giCabTable(G: GiInput, R: GiCalcResult): string {
  return (
    `<table class="t dt"><tr><th rowspan="2">Cáp</th><th rowspan="2">L1</th><th rowspan="2">L2</th><th rowspan="2">L3</th><th rowspan="2">L4</th><th colspan="2">Mặt cắt đầu dầm (neo)</th><th colspan="2">Mặt cắt giữa dầm</th><th rowspan="2">a (1/m)</th></tr><tr><th>Y</th><th>Z</th><th>Y</th><th>Z</th></tr>` +
    R.T.map(
      (t) =>
        `<tr><td class="c">Cáp ${t.i}</td><td>${fx(t.L1 / 1000, 3)}</td><td>${fx(t.L2 / 1000, 3)}</td><td>${fx(t.L3 / 1000, 3)}</td><td>${fx(t.L4 / 1000, 3)}</td><td>${fx(t.yE / 1000, 3)}</td><td>${fx(t.zE / 1000, 3)}</td><td>${fx(t.yM / 1000, 3)}</td><td>${fx(t.zM / 1000, 3)}</td><td>${fx(t.a * 1000, 5)}</td></tr>`,
    ).join('') +
    `<tr><td class="l" colspan="10">Kích thước tính bằng m. Mỗi bó ${G.nstr} tao, Aps1 = ${fx(R.Apc, 1)} mm2 ; tổng ${R.nC} bó, Aps = ${fx(R.Aps, 1)} mm2 ; ống ghen Dduct = ${fx(G.D, 0)} mm.</td></tr></table>`
  );
}

// ---------- 10. VÙNG NEO CÁP DỰ ỨNG LỰC (TCVN 11823-5, Điều 10.9) ----------
export function giAncHtml(k: 'g' | 'b', R: GiCalcResult, I: DamSpInput, G: GiInput): string {
  const A = R.anc;
  const F = gF;
  const P: string[] = [];
  const kN = (v: number): string => F(v / 1e3, 1);
  const dg = (v: number): string => F((v * 180) / Math.PI, 2);
  const an = A.an;
  P.push(gH2(10, 'VÙNG NEO CÁP DỰ ỨNG LỰC (TCVN 11823-5, Điều 10.9)'));
  P.push(
    gT(
      'Neo đặt ở mặt đầu dầm, cáp kéo căng đồng thời từ hai đầu. Vùng neo gồm vùng chung (Điều 10.9.3) và vùng cục bộ (Điều 10.9.7); kiểm toán ở trạng thái giới hạn cường độ với lực kích tính toán (Điều 10.9.1). Hệ số sức kháng (Điều 5.4.2): nén trong vùng neo φ = 0,80 ; thép chịu kéo trong vùng neo φ = 1,00 ; ép tựa trên bê tông φ = 0,70.',
    ),
  );
  P.push(gH3('10.1. Lực tính toán và bố trí neo'));
  P.push(
    gM(
      'P_u = 1.2\\,f_{pj}\\,A_{ps1}\\quad (\\text{TCVN 11823-3, 4.3.2})',
      'Pu',
      kN(A.Pu1),
      'kN',
    ),
  );
  P.push(gR('Tổng lực tính toán của nhóm neo', 'ΣPu', kN(A.SP), 'kN'));
  P.push(
    `<table class="t dt"><tr><th>Neo</th><th colspan="2">y (mm)</th><th colspan="2">z (mm)</th><th colspan="2">α phương đứng (độ)</th><th colspan="2">α phương ngang (độ)</th><th colspan="2">Pu (kN)</th></tr>` +
      A.AN.map(
        (q) =>
          `<tr><td class="c">${q.i}</td><td colspan="2">${F(q.y, 0)}</td><td colspan="2">${F(q.z, 0)}</td><td colspan="2">${dg(q.av)}</td><td colspan="2">${dg(q.ah)}</td><td colspan="2">${kN(q.Pu)}</td></tr>`,
      ).join('') +
      `<tr><td class="l" colspan="11">y tính từ đáy dầm, z từ trục dầm; α dương khi lực neo hướng vào trọng tâm mặt cắt, âm khi hướng ra ngoài (Điều 10.9.6.3). Trọng tâm mặt cắt đầu dầm yb = ${F(A.yb0, 0)} mm ; hợp lực neo tại y = ${F(A.yr, 0)} mm.</td></tr></table>`,
  );
  P.push(GID.anc(`dgi${k}Anc`, G, R));
  P.push(
    gR('Chiều dày bụng dầm tại các neo', 't', F(A.tw, 0), 'mm'),
    gR(
      'Chiều dài vùng neo theo hướng bó cáp (Điều 10.9.1): max(H ; t), không quá 1,5 lần',
      'Lz',
      F(A.Lz, 0),
      'mm',
    ),
  );
  // 10.2 điều kiện áp dụng
  P.push(gH3('10.2. Điều kiện áp dụng phương pháp gần đúng (Điều 10.9.6.1)'));
  P.push(
    `<table class="t dt"><tr><th colspan="6">Điều kiện</th><th colspan="3">Trị số</th><th colspan="2">Đánh giá</th></tr>` +
      A.cond
        .map(
          (c) =>
            `<tr><td class="l" colspan="6">${c[0]}</td><td class="c" colspan="3">${c[1]}</td><td class="c ${c[2] ? 'ok' : 'bad'}" colspan="2">${c[2] ? 'thỏa' : 'không thỏa'}</td></tr>`,
        )
        .join('') +
      `</table>`,
  );
  P.push(
    gT(
      A.approxOK
        ? 'Các điều kiện đều thỏa: dùng được Phương trình 157 - 161. Lực xé vỡ thiết kế lấy giá trị lớn hơn của Phương trình 160 và phương pháp cân bằng khối đầu dầm (mục 10.4).'
        : 'Không thỏa đủ các điều kiện của Điều 10.9.6.1, nên Phương trình 157 - 161 chỉ dùng để tham khảo. Lực xé vỡ thiết kế được xác định bằng mô hình phi đàn hồi dựa trên cân bằng (Điều 10.9.3.1, phương pháp cân bằng khối đầu dầm, mục 10.4) và lấy không nhỏ hơn giá trị theo Phương trình 160.',
    ),
  );
  // 10.3 ứng suất nén
  P.push(
    gH3(
      '10.3. Ứng suất nén của bê tông phía trước neo (Điều 10.9.6.2, PT 157 - 159 ; giới hạn Điều 10.9.3.1)',
    ),
  );
  P.push(
    gM(
      'K = 1 + \\left(2 - \\dfrac{s}{a_{eff}}\\right)\\left(0.3 + \\dfrac{n}{15}\\right)\\ (a \\le s < 2a_{eff})\\ ;\\quad K = 1\\ (s \\ge 2a_{eff})\\quad (\\text{PT 158, 159})',
      'K',
      F(A.K, 3),
      '',
    ),
  );
  P.push(
    gR(
      'Kích thước diện tích ép mặt song song với cạnh lớn ; cạnh nhỏ của mặt cắt',
      'aeff ; beff',
      F(A.aeff, 0) + ' ; ' + F(A.beff, 0),
      'mm',
    ),
    gR(
      'Cự ly tim các neo ; số neo trong hàng',
      's ; n',
      (isFinite(A.sV) ? F(A.sV, 0) : '-') + ' ; ' + A.nK,
      'mm ; -',
    ),
  );
  P.push(
    gR('Chiều dài cốt thép kiềm chế, không lớn hơn 1,15.max(aeff ; beff)', 'lc', F(A.lc, 0), 'mm'),
    gR('Diện tích ép mặt có hiệu Ab = a.b - π.Dduct²/4 (trừ ống bọc)', 'Ab', F(A.Ab, 0), 'mm2'),
  );
  P.push(
    gM(
      "f_{ca} = \\dfrac{0.6\\,P_u\\,K}{A_b\\left[1 + l_c\\left(\\dfrac{1}{b_{eff}} - \\dfrac{1}{t}\\right)\\right]} \\le 0.7\\,\\varphi\\,f'_{ci}\\quad (\\text{PT 157})",
      'fca',
      F(A.fca, 2),
      'MPa',
      [A.ok.fca, (A.ok.fca ? 'OK' : 'NG') + ' ≤ ' + F(A.fcaL, 2)],
    ),
  );
  P.push(
    gN(
      'PT 157: bản in TCVN 11823-5 ghi mẫu số là Ab(1 + λc)(1/beff - 1/t), sai thứ nguyên; đúng theo ' +
        AAx +
        ', PT 5.10.9.6.2-1 là Ab[1 + lc(1/beff - 1/t)] (lc - chiều dài cốt thép kiềm chế). Giới hạn lc: bản in TCVN, Điều 10.9.6.2 ghi "1,15aeff hoặc beff"; đúng theo AASHTO là giá trị lớn hơn của 1,15aeff và 1,15beff. Bảng tính dùng dạng đúng.',
    ),
  );
  if (!A.approxOK) {
    P.push(
      gT(
        `Không đủ điều kiện áp dụng phương pháp gần đúng (mục 10.2): PT 157 chỉ để tham khảo. Ứng suất nén của bê tông phía trước neo kiểm tra theo mô hình chống - giằng (Điều 10.9.3.2, 10.9.4.3): mặt cắt nguy hiểm của thanh chống cách mặt neo dS = max(lc ; min(a, b)) = ${F(A.dS, 0)} mm; bề rộng thanh chống theo chiều dày sườn tăng tuyến tính từ b = ${F(A.b, 0)} mm ở mặt neo đến chiều dày sườn t = ${F(A.tw, 0)} mm ở khoảng cách t; trong mặt phẳng dầm lấy bằng kích thước ngang của vùng cục bộ (nút): w = max(a ; min(2.emin ; s)) = ${F(A.wIn, 0)} mm (Điều 10.9.4.2, 10.9.7.1); trừ diện tích ống ghen.`,
      ),
    );
    P.push(
      gM(
        "f_{S} = \\dfrac{P_u}{w\\,b_S - \\pi D^2/4}\\ ;\\quad b_S = b + (t - b)\\min\\left(1\\ ;\\ \\dfrac{d_S}{t}\\right) \\le 0.7\\,\\varphi\\,f'_{ci}",
        'fS',
        F(A.fS, 2),
        'MPa',
        [A.fS <= A.fcaL + 1e-9, (A.fS <= A.fcaL + 1e-9 ? 'OK' : 'NG') + ' ≤ ' + F(A.fcaL, 2)],
      ),
    );
    P.push(
      gR(
        'Bề rộng thanh chống tại mặt cắt nguy hiểm ; diện tích',
        'bS ; AS',
        F(A.bS, 0) + ' ; ' + F(A.AS, 0),
        'mm ; mm2',
      ),
    );
    if (A.geo.length) {
      P.push(
        gT(
          'Ứng suất nén tại chỗ thay đổi hình học trong phạm vi vùng neo (Điều 10.9.3.2): mặt cắt chịu tổng lực neo tính toán ΣPu và mômen do lệch tâm, phân bố tuyến tính:',
        ),
      );
      P.push(
        `<table class="t dt"><tr><th colspan="4">Mặt cắt (cách đầu dầm)</th><th colspan="2">Bề rộng sườn (mm)</th><th colspan="2">Mép trên ; mép dưới (MPa)</th><th>Giới hạn</th><th>KL</th></tr>` +
          A.geo
            .map(
              (o) =>
                `<tr><td class="l" colspan="4">X = ${F(o.X, 0)} mm</td><td colspan="2">${F(o.bw, 0)}</td><td colspan="2">${F(o.ft, 2)} ; ${F(o.fb, 2)}</td><td>${F(A.fcaL, 2)}</td>${gOk(o.f <= A.fcaL + 1e-9)}</tr>`,
            )
            .join('') +
          `</table>`,
      );
    }
  }
  // 10.4 lực xé vỡ
  P.push(gH3('10.4. Lực xé vỡ (Điều 10.9.3.2, 10.9.6.3)'));
  P.push(
    gM(
      'T_{burst} = 0.25\\sum P_u\\left(1 - \\dfrac{a}{h}\\right) + 0.5\\left|\\sum P_u\\sin\\alpha\\right|\\quad (\\text{PT 160})',
      '',
      '',
      '',
    ),
  );
  P.push(gM('d_{burst} = 0.5\\,(h - 2e) + 5e\\sin\\alpha\\quad (\\text{PT 161})', '', '', ''));
  P.push(
    gN(
      'PT 160: bản in TCVN 11823-5 thiếu dấu giá trị tuyệt đối ở số hạng 0,5Σ(Pu.sinα); đúng theo ' +
        AAx +
        ', PT 5.10.9.6.3-1 là 0,5|Σ(Pu.sinα)|. Bảng tính dùng dạng đúng.',
    ),
  );
  P.push(
    gT(
      'Phương pháp cân bằng khối đầu dầm: lực neo phân bố đều trên bản neo, mặt cắt cuối vùng neo (cách mặt neo Lz, bề rộng thực b(y) của mặt cắt) chịu ứng suất phân bố tuyến tính σ(y) = ΣPu/A + ΣPu.e.(y - yc)/I. Cắt khối đầu dầm theo mặt phẳng song song trục dầm tại cao độ y, mômen trên mặt cắt dọc M(y) do chênh lệch hai hệ lực; lực xé vỡ bằng mômen dương lớn nhất chia cánh tay đòn 0,5h, mômen âm lớn nhất cho lực ép vỡ:',
    ),
  );
  P.push(
    gM(
      'M(y) = \\int_0^{y}\\sigma(\\eta)\\,b(\\eta)\\,(y - \\eta)\\,d\\eta - \\int_0^{y}q_a(\\eta)\\,(y - \\eta)\\,d\\eta\\ ;\\quad T = \\dfrac{\\max M}{0.5\\,h}',
      '',
      '',
      '',
    ),
  );
  const row = (
    lbl: string,
    s: string,
    u: string,
    fV: string | number,
    fH: string | number,
    d = 1,
  ): string =>
    `<tr><td class="l" colspan="5">${lbl}</td><td class="c">${s}</td><td class="c">${u}</td><td colspan="2">${typeof fV === 'string' ? fV : F(fV, d)}</td><td colspan="2">${typeof fH === 'string' ? fH : F(fH, d)}</td></tr>`;
  P.push(
    `<table class="t dt"><tr><th colspan="5">Lực xé vỡ</th><th>Ký hiệu</th><th>Đơn vị</th><th colspan="2">Mặt phẳng đứng</th><th colspan="2">Mặt phẳng ngang</th></tr>` +
      row('Kích thước ngang của mặt cắt trên hướng xem xét', 'h', 'mm', A.PV.h, A.PH.h, 0) +
      row('Kích thước nhóm thiết bị neo trên hướng xem xét', 'a', 'mm', A.PV.aG, A.PH.aG, 0) +
      row('Độ lệch tâm của nhóm neo so với trọng tâm mặt cắt', 'e', 'mm', A.PV.e, A.PH.e, 0) +
      row('Σ(Pu.sinα)', '', 'kN', A.PV.sA / 1e3, A.PH.sA / 1e3) +
      row('Lực xé vỡ theo PT 160', 'Tburst', 'kN', A.PV.T160 / 1e3, A.PH.T160 / 1e3) +
      row('Vị trí lực xé vỡ theo PT 161', 'dburst', 'mm', A.PV.d161, A.PH.d161, 0) +
      row(
        'Mômen lớn nhất trên mặt cắt dọc (phương pháp cân bằng)',
        'Mmax',
        'kN.m',
        A.EV.Mx / 1e6,
        A.EH.Mx / 1e6,
      ) +
      row('Cao độ có Mmax (tính từ đáy / từ mép bụng)', 'y', 'mm', A.EV.yMx, A.EH.yMx, 0) +
      row('Lực xé vỡ theo phương pháp cân bằng', 'Tburst', 'kN', A.EV.Tb / 1e3, A.EH.Tb / 1e3) +
      `<tr class="grp"><td class="l" colspan="5"><b>Lực xé vỡ thiết kế (giá trị lớn hơn)</b></td><td class="c">Tburst</td><td class="c">kN</td><td colspan="2"><b>${F(A.TbV / 1e3, 1)}</b></td><td colspan="2"><b>${F(A.TbH / 1e3, 1)}</b></td></tr></table>`,
  );
  {
    const M = A.EV.M.filter((_, i) => i % 10 === 0);
    P.push(
      GID.chart({
        id: `dgi${k}AncM`,
        title: 'MÔMEN TRÊN MẶT CẮT DỌC KHỐI ĐẦU DẦM - MẶT PHẲNG ĐỨNG',
        xt: 'Cao độ tính từ đáy dầm (m)',
        yt: 'Mômen (kN.m)',
        series: [
          {
            n: 'M(y): dương - xé vỡ ; âm - ép vỡ',
            x: M.map((p) => p[0] / 1000),
            y: M.map((p) => p[1] / 1e6),
            c: '#0000ff',
            mk: 'none',
          },
        ],
      }),
    );
  }
  // 10.5 cốt thép chống xé vỡ
  P.push(gH3('10.5. Cốt thép chống xé vỡ (Điều 10.9.3.2)'));
  P.push(
    gT(
      'Cốt thép chịu toàn bộ lực xé vỡ, A ≥ Tburst/(φ.fy) với φ = 1,0; đặt trên chiều dài min(2,5dburst ; 1,5h) phía trước mặt neo, cự ly ≤ min(24d ; 300 mm). Mặt phẳng đứng: các nhánh cốt đai vùng đầu dầm; mặt phẳng ngang: các thanh ngang của lưới đầu dầm.',
    ),
  );
  const okV = A.ok.V;
  const okH = A.ok.H;
  P.push(
    `<table class="t dt"><tr><th colspan="3">Cốt thép chống xé vỡ</th><th>A yêu cầu (mm2)</th><th>Chiều dài bố trí (mm)</th><th colspan="2">Bố trí</th><th>A có (mm2)</th><th colspan="2">s ; smax (mm)</th><th>KL</th></tr>` +
      `<tr><td class="l" colspan="3">Mặt phẳng đứng (cốt đai)</td><td>${F(A.AsVr, 0)}</td><td>${F(A.LdV, 0)}</td><td class="c" colspan="2">${A.nSt} đai × ${A.nv1} nhánh Φ${F(G.sd, 0)}</td><td>${F(A.AsV, 0)}</td><td class="c" colspan="2">${F(A.s1, 0)} ; ${F(A.smaxV, 0)}</td>${gOk(okV)}</tr>` +
      `<tr><td class="l" colspan="3">Mặt phẳng ngang (lưới)</td><td>${F(A.AsHr, 0)}</td><td>${F(A.LdH, 0)}</td><td class="c" colspan="2">${A.nMe} lưới × ${F(an.bhn, 0)} thanh Φ${F(an.bhd, 0)}</td><td>${F(A.AsH, 0)}</td><td class="c" colspan="2">${F(an.bhs, 0)} ; ${F(A.smaxH, 0)}</td>${gOk(okH)}</tr></table>`,
  );
  // 10.6 ép vỡ, kéo mép
  P.push(gH3('10.6. Lực ép vỡ bề mặt và lực kéo ở mép (Điều 10.9.3.2, 10.9.6.4)'));
  P.push(
    gT(
      `Nhóm neo có cự ly tim ${isFinite(A.sV) ? F(A.sV, 0) : '-'} mm ${A.close ? '<' : '≥'} 0,4h = ${F(0.4 * G.H, 0)} mm: lực ép vỡ ${A.close ? 'không nhỏ hơn 2% tổng lực tính toán' : 'xác định bằng phân tích (phương pháp cân bằng)'}; lấy giá trị lớn hơn với mômen âm lớn nhất của phương pháp cân bằng:`,
    ),
  );
  P.push(
    gR('Lực ép vỡ bề mặt', 'Tsp', F(A.Tsp / 1e3, 1), 'kN'),
    gR(
      'Cốt thép yêu cầu Tsp/fy ; có (mỗi phương)',
      'As',
      F(A.AspR, 0) + ' ; ' + F(A.Asp, 0),
      'mm2',
      [A.ok.sp, A.ok.sp ? 'OK' : 'NG'],
    ),
  );
  P.push(
    gT(
      `Kéo ở mép dọc: mặt cắt cách mặt neo h/2 = ${F(G.H / 2, 0)} mm xem như dầm chịu lực dọc ΣPu và mômen ΣPu.e; ứng suất thớ trên ; thớ dưới = ${F(A.feT, 2)} ; ${F(A.feB, 2)} MPa (nén dương).`,
    ),
  );
  P.push(
    gR('Lực kéo ở mép dọc', 'Tedge', F(A.Tedge / 1e3, 1), 'kN'),
    gR(
      'Cốt thép dọc yêu cầu ; có (cốt thép dọc thường của dầm)',
      'As',
      F(A.AsLr, 0) + ' ; ' + F(A.AsL, 0),
      'mm2',
      [A.ok.edge, A.ok.edge ? 'OK' : 'NG'],
    ),
  );
  // 10.7 vùng cục bộ
  P.push(gH3('10.7. Vùng cục bộ (Điều 10.9.7)'));
  const L = A.loc;
  if (L.special) {
    P.push(
      gT(
        'Thiết bị neo đặc biệt đã thí nghiệm nghiệm thu (Điều 10.9.7.3): sức kháng vùng cục bộ, cốt thép kiềm chế do nhà cung cấp neo bảo đảm; bảng tính kiểm tra cự ly, cự ly mép và cường độ bê tông khi căng kéo không nhỏ hơn yêu cầu của nhà cung cấp (Điều 10.9.7.1).',
      ),
    );
    P.push(
      gR(
        'Cự ly tim các neo ; tối thiểu',
        's',
        (isFinite(A.sV) ? F(A.sV, 0) : '-') + ' ; ' + F(L.smin, 0),
        'mm',
        [Boolean(L.sOK), L.sOK ? 'OK' : 'NG'],
      ),
    );
    P.push(
      gR(
        'Cự ly tim neo đến mép bê tông ; tối thiểu',
        'e',
        F(Math.min(A.edV, A.edH), 0) + ' ; ' + F(L.emin, 0),
        'mm',
        [Boolean(L.eOK), L.eOK ? 'OK' : 'NG'],
      ),
    );
    if ((L.fciMin ?? 0) > 0)
      P.push(
        gR(
          'Cường độ bê tông khi căng kéo ; tối thiểu',
          "f'ci",
          F(I.fci, 1) + ' ; ' + F(L.fciMin, 1),
          'MPa',
          [Boolean(L.fOK), L.fOK ? 'OK' : 'NG'],
        ),
      );
    P.push(gR('Kích thước ngang vùng cục bộ: min(2.emin ; smin)', '', F(L.lzW, 0), 'mm'));
  } else {
    P.push(
      gM(
        "P_r = \\varphi\\,f_n\\,A_b\\ ;\\quad f_n = \\min\\left(0.7f'_{ci}\\sqrt{\\dfrac{A}{A_g}}\\ ;\\ 2.25f'_{ci}\\right)\\quad (\\text{PT 162 - 164})",
        '',
        '',
        '',
      ),
    );
    P.push(
      gR(
        'Diện tích bề mặt đỡ lớn nhất đồng dạng, đồng tâm, không lấn sang neo bên cạnh',
        'A',
        F(L.Aa, 0),
        'mm2',
      ),
      gR(
        'Diện tích bản đỡ ; diện tích thực (trừ lỗ)',
        'Ag ; Ab',
        F(L.Ag, 0) + ' ; ' + F(L.Ab, 0),
        'mm2',
      ),
    );
    P.push(
      gR('Cường độ ép tựa danh định', 'fn', F(L.fn, 2), 'MPa'),
      gR('Sức kháng ép tựa tính toán (φ = 0,70)', 'Pr', F((L.Pr ?? 0) / 1e3, 1), 'kN', [
        Boolean(L.ok),
        (L.ok ? 'OK' : 'NG') + ' ≥ Pu = ' + F(A.Pu1 / 1e3, 1),
      ]),
    );
    P.push(
      gN(
        'Áp dụng khi phần bê tông phía trước neo dài ít nhất 2 lần chiều dài vùng cục bộ và bản đệm không chảy, độ mảnh bản đệm thỏa PT 165.',
      ),
    );
  }
  const items: Array<[string, boolean]> = [
    [
      A.approxOK
        ? 'Ứng suất nén phía trước neo (PT 157)'
        : 'Ứng suất nén vùng chung (thanh chống, chỗ thay đổi hình học)',
      A.ok.fca,
    ],
    ['Cốt thép chống xé vỡ - mặt phẳng đứng', A.ok.V],
    ['Cốt thép chống xé vỡ - mặt phẳng ngang', A.ok.H],
    ['Cốt thép chống ép vỡ bề mặt', A.ok.sp],
    ['Kéo ở mép dọc', A.ok.edge],
    ['Vùng cục bộ', A.ok.loc],
  ];
  P.push(
    `<table class="t dt"><tr><th colspan="8">Kiểm toán vùng neo</th><th colspan="2">KL</th></tr>` +
      items
        .map(
          (it) =>
            `<tr><td class="l" colspan="8">${it[0]}</td>${gOk(it[1]).replace('<td class="c', '<td colspan="2" class="c')}</tr>`,
        )
        .join('') +
      gKL(A.ok.all, 10) +
      `</table>`,
  );
  return P.join('\n');
}


// ============================================================================
// Gi Summary Evaluation & Report Sections (1..5)
// ============================================================================

interface GiSummaryContext {
  RA: GiSectionRes[];
  rs: GiSectionRes[];
  tgT: number;
  tgB: number;
  tgD: number;
  tgB2: number;
  lim6: Array<[string, string, number, number]>;
  ok41: boolean;
  L5: DamLimits;
  fciL: number;
  ftl: number;
  ok51: (r: GiSectionRes) => boolean;
  ok52: (r: GiSectionRes) => boolean;
  ok53: (r: GiSectionRes) => boolean;
  ok54: (r: GiSectionRes) => boolean;
  ok55: (r: GiSectionRes) => boolean;
  ok6: (r: GiSectionRes) => boolean;
  ok6m: (r: GiSectionRes) => boolean;
  ok62: (r: GiSectionRes) => boolean;
  ok7: (r: GiSectionRes) => boolean;
  ok71: (r: GiSectionRes) => boolean;
  ok72: (r: GiSectionRes) => boolean;
  ok73: (r: GiSectionRes) => boolean;
  ok8: (r: GiSectionRes) => boolean;
  dmax: number;
  ok9: boolean;
  items: GiSummaryItem[];
}

export function evalGiSummary(R: GiCalcResult, I: DamSpInput, LIM: DamLimits): GiSummaryContext {
  const F = gF;
  const res = R.res;
  const RX = R.rx || [];
  const RA = [...res, ...RX].sort((a, b) => a.x - b.x);
  const rs = [res[0], R.rv, ...res.slice(1), ...RX].sort((a, b) => a.x - b.x);
  const TG = R.TG;
  const gTGv = TG.g;
  const tgT = gTGv * Math.max(TG.pos.gt, TG.neg.gt, 0);
  const tgB = gTGv * Math.min(TG.pos.gb, TG.neg.gb, 0);
  const tgD = gTGv * Math.max(TG.pos.dk, TG.neg.dk, 0);
  const tgB2 = gTGv * Math.max(TG.pos.gb, TG.neg.gb, 0);
  RA.forEach((r) => {
    r.ftIT = r.ftI + tgT;
    r.fbIIIT = r.fbIII + tgB;
    r.fdIT = r.fdI + tgD;
  });

  const fpu = I.fpu;
  const fpy = R.fpy;
  const fpj = R.fpj;
  const fAncMax = Math.max(...R.T.map((t) => t.fAnc));
  const fAmx = Math.max(...R.T.map((t) => t.fAmax));
  const fpeMax = Math.max(...res.flatMap((r) => r.cab.map((q) => q.fpe)));
  const lim6: Array<[string, string, number, number]> = [
    ['Trước khi chốt neo (cho phép dùng fpbt ngắn hạn)', '0,90 fpy', 0.9 * fpy, fpj],
    ['Tại neo ngay sau khi đóng neo', '0,70 fpu', 0.7 * fpu, fAncMax],
    ['Điểm bất kỳ dọc cấu kiện, cách xa neo, ngay sau đóng neo', '0,74 fpu', 0.74 * fpu, fAmx],
    ['Trạng thái giới hạn sử dụng sau toàn bộ mất mát (fpe)', '0,80 fpy', 0.8 * fpy, fpeMax],
  ];
  const ok41 = lim6.every((r) => r[3] <= r[2] + 1e-9);

  const L5: DamLimits = { ...LIM, svI: 0.6 * (R.phiW || 1) * I.fc };
  const fciL = 0.6 * I.fci;
  const ftl = R.ftl;
  const ok51 = (r: GiSectionRes): boolean =>
    Math.max(r.s1t, r.s1b) <= fciL + 1e-9 && Math.min(r.s1t, r.s1b) >= -r.tr.lim - 1e-9;
  const ok52 = (r: GiSectionRes): boolean =>
    Math.max(r.s2t, r.s2b) <= 0.45 * I.fc + 1e-9 && Math.min(r.s2t, r.s2b) >= -ftl - 1e-9;
  const ok53 = (r: GiSectionRes): boolean =>
    r.ftP <= L5.svP + 1e-9 &&
    r.fbP <= L5.svP + 1e-9 &&
    (r.ftIT ?? r.ftI) <= L5.svI + 1e-9 &&
    r.fdP <= L5.dkP + 1e-9 &&
    (r.fdIT ?? r.fdI) <= L5.dkI + 1e-9 &&
    r.fbI + tgB2 <= L5.svI + 1e-9;
  const ok54 = (r: GiSectionRes): boolean => (r.fbIIIT ?? r.fbIII) >= -ftl - 1e-9;
  const ok55 = (r: GiSectionRes): boolean => r.ftFat <= L5.fat + 1e-9;

  const ok6 = (r: GiSectionRes): boolean => r.Mr >= r.Mu - 1e-9;
  const ok6m = (r: GiSectionRes): boolean => r.x <= 0 || r.Mr >= r.Mmin - 1e-9;
  const ok62 = (r: GiSectionRes): boolean => r.MrN >= r.MuN - 1e-9;
  const ok7 = (r: GiSectionRes): boolean => r.Vr >= r.Vu - 1e-9;
  const ok71 = (r: GiSectionRes): boolean => r.Av >= r.Avmin - 1e-9 && r.s <= r.smax + 1e-9;
  const ok72 = (r: GiSectionRes): boolean => r.Tprov >= r.Treq - 1e-9;
  const ok73 = (r: GiSectionRes): boolean => r.torOK;
  const ok8 = (r: GiSectionRes): boolean =>
    r.Vri >= r.Vui - 1e-9 && r.Avf >= r.Avfmin - 1e-9 && r.s <= 600;
  const C = R.camber;
  const dmax = Math.max(C.dLL1, C.dLL2);
  const ok9 = dmax <= C.lim + 1e-9;

  const mx = (f: (r: GiSectionRes) => number): number => Math.max(...RA.map(f));
  const mn = (f: (r: GiSectionRes) => number): number => Math.min(...RA.map(f));
  const nOut = (['ts', 'L', 'Kg'] as const).filter((q) => R.DF.range[q] === false).length;
  const items: GiSummaryItem[] = [
    [
      'Hệ số phân bố gần đúng: số tham số ngoài phạm vi Bảng 6, 11 (ts, L, Kg) - ngoài phạm vi phải phân tích theo Điều 6.3 Phần 4',
      String(nOut),
      '= 0',
      nOut === 0,
    ],
    ['Ứng suất cáp dự ứng lực (Bảng 6)', '-', 'Bảng 6', ok41],
    [
      'Nén khi căng kéo (MPa)',
      mx((r) => Math.max(r.s1t, r.s1b)),
      '≤ ' + F(fciL, 2),
      RA.every((r) => Math.max(r.s1t, r.s1b) <= fciL + 1e-9),
    ],
    [
      'Kéo khi căng kéo (MPa)',
      mn((r) => Math.min(r.s1t, r.s1b)),
      'Bảng 7',
      RA.every((r) => Math.min(r.s1t, r.s1b) >= -r.tr.lim - 1e-9),
    ],
    [
      'Ứng suất khi đổ bản mặt cầu (MPa)',
      mx((r) => Math.max(r.s2t, r.s2b)),
      '≤ ' + F(0.45 * I.fc, 2),
      RA.every(ok52),
    ],
    [
      'Nén thớ trên dầm, thường xuyên (MPa)',
      mx((r) => r.ftP),
      '≤ ' + F(L5.svP, 2),
      RA.every((r) => r.ftP <= L5.svP + 1e-9 && r.fbP <= L5.svP + 1e-9),
    ],
    [
      'Nén thớ trên dầm, Sử dụng I + TG (MPa)',
      mx((r) => r.ftIT ?? r.ftI),
      '≤ ' + F(L5.svI, 2),
      RA.every((r) => (r.ftIT ?? r.ftI) <= L5.svI + 1e-9),
    ],
    [
      'Nén thớ dưới dầm, Sử dụng I + TG (MPa)',
      mx((r) => r.fbI + tgB2),
      '≤ ' + F(L5.svI, 2),
      RA.every((r) => r.fbI + tgB2 <= L5.svI + 1e-9),
    ],
    [
      'Nén bản mặt cầu, Sử dụng I + TG (MPa)',
      mx((r) => r.fdIT ?? r.fdI),
      '≤ ' + F(L5.dkI, 2),
      RA.every((r) => (r.fdIT ?? r.fdI) <= L5.dkI + 1e-9 && r.fdP <= L5.dkP + 1e-9),
    ],
    [
      'Thớ dưới dầm, Sử dụng III + TG (MPa)',
      mn((r) => r.fbIIIT ?? r.fbIII),
      '≥ ' + F(-ftl, 2),
      RA.every(ok54),
    ],
    ['Nén khi chịu mỏi (MPa)', mx((r) => r.ftFat), '≤ ' + F(L5.fat, 2), RA.every(ok55)],
    ['Mu/Mr lớn nhất', mx((r) => (r.Mr > 0 ? r.Mu / r.Mr : 0)), '≤ 1', RA.every(ok6)],
    ['Cốt thép tối thiểu (uốn)', '-', 'Mr ≥ min(Mcr; 1,33Mu)', RA.every(ok6m)],
    [
      'Dầm chưa liên hợp khi đổ bản: Mu/Mr',
      Math.max(...res.filter((r) => r.x > 0).map((r) => r.MuN / r.MrN)),
      '≤ 1',
      res.filter((r) => r.x > 0).every(ok62),
    ],
    ['Vu/Vr lớn nhất', Math.max(...rs.map((r) => r.Vu / r.Vr)), '≤ 1', rs.every(ok7)],
    ['Cốt đai tối thiểu, cự ly tối đa', '-', 'Điều 8.2.5, 8.2.7', rs.every(ok71)],
    [
      'Cốt thép dọc do cắt: yêu cầu / có',
      Math.max(...rs.map((r) => r.Treq / r.Tprov)),
      '≤ 1',
      rs.every(ok72),
    ],
    [
      'Xoắn: Tu / 0,25φTcr',
      Math.max(...rs.map((r) => r.Tu / (0.225 * r.Tcr))),
      '≤ 1',
      rs.every(ok73),
    ],
    [
      'Cắt trượt mặt tiếp xúc Vui/Vri',
      Math.max(...rs.map((r) => r.Vui / r.Vri)),
      '≤ 1',
      rs.every(ok8),
    ],
    ['Độ võng do hoạt tải (mm)', dmax, '≤ ' + F(C.lim, 2), ok9],
    [
      'Vùng neo: ứng suất nén của bê tông vùng chung (MPa)',
      R.anc.fcaD,
      '≤ ' + F(R.anc.fcaL, 2),
      R.anc.ok.fca,
    ],
    [
      'Vùng neo: cốt thép chống xé vỡ (mặt phẳng đứng ; ngang)',
      '-',
      'Điều 10.9.3.2',
      R.anc.ok.V && R.anc.ok.H,
    ],
    [
      'Vùng neo: ép vỡ bề mặt, kéo ở mép',
      '-',
      'Điều 10.9.3.2, 10.9.6.4',
      R.anc.ok.sp && R.anc.ok.edge,
    ],
    ['Vùng neo: vùng cục bộ', '-', 'Điều 10.9.7', R.anc.ok.loc],
  ];
  R.items = items;
  R.allOK = items.every((it) => it[3]);

  return {
    RA,
    rs,
    tgT,
    tgB,
    tgD,
    tgB2,
    lim6,
    ok41,
    L5,
    fciL,
    ftl,
    ok51,
    ok52,
    ok53,
    ok54,
    ok55,
    ok6,
    ok6m,
    ok62,
    ok7,
    ok71,
    ok72,
    ok73,
    ok8,
    dmax,
    ok9,
    items,
  };
}

function giRenderSections1To5(
  k: 'g' | 'b',
  R: GiCalcResult,
  I: DamSpInput,
  G: GiInput,
  RR: Partial<Record<'g' | 'b', GiCalcResult>>,
  ctx: GiSummaryContext,
  cS: (
    id: string,
    title: string,
    ser: Array<{ n: string; f: (r: GiSectionRes) => number; c: string; mk?: string }>,
    lims: Array<{ n: string; f: (r: GiSectionRes) => number; c: string }>,
  ) => string,
): string[] {
  const kn = k === 'g' ? 'dầm giữa' : 'dầm biên';
  const res = R.res;
  const nC = R.nC;
  const Lm = R.Lm;
  const P: string[] = [];
  const F = gF;
  const TG = R.TG;
  const gTGv = TG.g;
  const { RA, tgT, tgB, tgD, tgB2, lim6, ok41, L5, fciL, ftl, ok51, ok52, ok53, ok54, ok55 } = ctx;
  const RX = R.rx || [];
  const sec = (X: number): GiCachedShape => R.shp(X);

  // ======= 1, 2 (dầm biên: số liệu như dầm giữa, vẽ lại hình) =======
  if (k === 'b') {
    P.push(
      gH2(1, 'SỐ LIỆU THIẾT KẾ'),
      gP(
        'Số liệu kết cấu nhịp, vật liệu, môi trường, hệ số, kích thước dầm, cáp dự ứng lực, cốt thép lấy theo sheet kiểm toán dầm giữa, mục 1 và mục 2.',
      ),
    );
    P.push(
      gH2(2, 'MẶT CẮT DẦM VÀ BỐ TRÍ CÁP DỰ ỨNG LỰC'),
      gH3('2.1. Kích thước mặt cắt dầm'),
      GID.sec('dgib_Sec', G, R),
      gH3('2.2. Cáp dự ứng lực'),
      GID.cab('dgib_Cab', G, R),
      giCabTable(G, R),
    );
  }
  // ---- 2.6 đặc trưng hình học ----
  const n6 = k === 'g' ? '2.7' : '2.3';
  P.push(gH3(n6 + '. Đặc trưng hình học của mặt cắt'));
  P.push(
    gT(
      `Bề rộng bản cánh có hiệu (TCVN 11823-4, Điều 6.2.6.1): ${k === 'g' ? 'dầm giữa lấy bằng khoảng cách tim các dầm' : 'dầm biên lấy bằng một nửa khoảng cách tim dầm cộng toàn bộ phần hẫng của bản'}:`,
    ),
  );
  P.push(
    gM(
      k === 'g' ? 'b_7 = b_{eff} = S' : 'b_7 = b_{eff} = \\dfrac{S}{2} + d_{oh}',
      'b7',
      F(R.beff, 0),
      'mm',
    ),
  );
  if (k === 'b')
    P.push(
      gR(
        'Phần hẫng của bản tính từ tim dầm biên: doh = Wb/2 - (Nb - 1).S/2',
        'doh',
        F(R.oh, 0),
        'mm',
      ),
    );
  P.push(
    gR('Chiều dày bản mặt cầu tham gia chịu lực (không kể lớp hao mòn)', 'ts', F(R.hs, 0), 'mm'),
  );
  P.push(
    gM(
      'n_p = \\dfrac{E_p}{E_c}\\ ;\\quad n_s = \\dfrac{E_{cs}}{E_c}',
      'np ; ns',
      F(R.np, 3) + ' ; ' + F(R.ncs, 4),
      '',
    ),
  );
  const dimRows: GiTableRow[] = [
    ['Chiều rộng đáy dầm', 'b1', 'mm', () => G.b1, 0],
    ['Chiều dày sườn dầm', 'b2', 'mm', (r) => sec(r.X).b2, 0],
    ['Chiều rộng cánh trên', 'b3', 'mm', () => G.b3, 0],
    ['Chiều rộng phần trên của cánh', 'b4', 'mm', () => G.b4, 0],
    ['Chiều rộng phần dốc của đáy dầm (mỗi bên)', 'b5', 'mm', (r) => sec(r.X).b5, 0],
    ['Chiều rộng phần dốc của cánh trên (mỗi bên)', 'b6', 'mm', (r) => sec(r.X).b6, 0],
    ['Chiều rộng bản mặt cầu (có hiệu)', 'b7', 'mm', () => R.beff, 0],
    ['Chiều cao cánh dưới', 'h1', 'mm', () => G.h1, 0],
    ['Chiều cao nách dưới', 'h2', 'mm', (r) => sec(r.X).h2, 0],
    ['Chiều cao sườn dầm', 'h3', 'mm', (r) => sec(r.X).h3, 0],
    ['Chiều cao nách trên', 'h4', 'mm', (r) => sec(r.X).h4, 0],
    ['Chiều cao cánh trên', 'h5', 'mm', () => G.h5, 0],
    ['Chiều cao phần trên cánh', 'h6', 'mm', () => G.h6, 0],
    ['Chiều dày bản mặt cầu', 'h7', 'mm', () => R.hs, 0],
    ['Chiều cao dầm', 'H', 'mm', () => G.H, 0],
  ];
  const cabRows: GiTableRow[] = Array.from({ length: nC }, (_, i): GiTableRow => [
    `Cáp số ${i + 1}: khoảng cách đến đáy dầm`,
    'y' + (i + 1),
    'mm',
    (r) => {
      const q = r.cab.find((c) => c.i === i + 1);
      return q ? q.y : NaN;
    },
    0,
  ]);
  P.push(
    gQ(res, 'Số liệu kích thước', [
      { grp: 'Chiều rộng' },
      ...dimRows.slice(0, 7),
      { grp: 'Chiều cao' },
      ...dimRows.slice(7),
      { grp: 'Cáp dự ứng lực' },
      ...cabRows,
      ['Số bó cáp', 'n', 'bó', (r) => r.nb, 0],
    ]),
  );
  const cmp = (r: GiSectionRes, i: number): number => {
    const s = sec(r.X);
    return (
      [
        G.b1 * G.h1,
        s.b5 * s.h2,
        s.b2 * (s.h2 + s.h3 + s.h4),
        s.b6 * s.h4,
        G.b3 * G.h5,
        G.b4 * G.h6,
        R.beff * R.hs,
      ][i] / 1e6
    );
  };
  P.push(
    gQ(res, 'Diện tích (m2)', [
      ...[
        'Cánh dưới b1.h1',
        'Nách dưới b5.h2 (2 bên)',
        'Sườn b2.(h2 + h3 + h4)',
        'Nách trên b6.h4 (2 bên)',
        'Cánh trên b3.h5',
        'Phần trên cánh b4.h6',
        'Bản mặt cầu b7.h7 (chưa quy đổi)',
      ].map((t, i): GiTableRow => [`${i + 1} - ${t}`, 'A' + (i + 1), 'm2', (r) => cmp(r, i), 4]),
      [
        '8 - Ống ghen (trừ đi): n.π.Dduct²/4',
        'Ad',
        'm2',
        (r) => (-r.nb * Math.PI * G.D ** 2) / 4 / 1e6,
        4,
      ],
      ['9 - Cáp dự ứng lực: n.Aps1', 'Aps', 'm2', (r) => (r.nb * R.Apc) / 1e6, 5],
      ['Toàn bộ mặt cắt giai đoạn 1: A1..6 - Ad', 'A1', 'm2', (r) => r.sc.A1 / 1e6, 4],
      ['Toàn bộ mặt cắt giai đoạn 2: A1..6 + (np - 1).Aps', 'A2', 'm2', (r) => r.sc.A2 / 1e6, 4],
      ['Toàn bộ mặt cắt giai đoạn 3: A2 + ns.A7', 'A3', 'm2', (r) => r.sc.A3 / 1e6, 4],
    ]),
  );
  P.push(
    gT(
      'Giai đoạn 1 - căng kéo cáp: mặt cắt dầm giảm yếu do lỗ ống ghen (chưa bơm vữa). Giai đoạn 2 - sau khi bơm vữa: mặt cắt dầm có cáp quy đổi (np - 1).Aps. Giai đoạn 3 - khai thác: mặt cắt liên hợp dầm và bản mặt cầu quy đổi theo ns. Mômen quán tính lấy với trục trung hòa của mặt cắt, cộng các thành phần theo định lý trục song song:',
    ),
  );
  P.push(
    gM(
      'A = \\sum A_i\\ ;\\quad y_b = \\dfrac{\\sum A_i\\,y_i}{A}\\ ;\\quad I = \\sum\\left[I_{0i} + A_i\\,(y_i - y_b)^2\\right]',
      '',
      '',
      '',
    ),
  );
  P.push(
    gQ(res, 'Đặc trưng hình học tiết diện', [
      { grp: 'Giai đoạn 1' },
      ['Diện tích', 'A1', 'm2', (r) => r.sc.A1 / 1e6, 4],
      ['Khoảng cách từ trục trung hòa đến đáy dầm', 'yb1', 'mm', (r) => r.sc.yb1, 1],
      ['Khoảng cách từ trục trung hòa đến đỉnh dầm', 'yt1', 'mm', (r) => r.yt1, 1],
      ['Mômen quán tính', 'I1', 'm4', (r) => r.sc.I1 / 1e12, 5],
      ['Khoảng cách từ trọng tâm ống ghen đến đáy dầm', 'db', 'mm', (r) => r.ycg, 1],
      ['Khoảng cách từ trọng tâm ống ghen đến đỉnh dầm', 'dt', 'mm', (r) => G.H - r.ycg, 1],
      { grp: 'Giai đoạn 2' },
      ['Diện tích', 'A2', 'm2', (r) => r.sc.A2 / 1e6, 4],
      ['Khoảng cách từ trục trung hòa đến đáy dầm', 'yb2', 'mm', (r) => r.sc.yb2, 1],
      ['Khoảng cách từ trục trung hòa đến đỉnh dầm', 'yt2', 'mm', (r) => r.yt2, 1],
      ['Mômen quán tính', 'I2', 'm4', (r) => r.sc.I2 / 1e12, 5],
      { grp: 'Giai đoạn 3' },
      ['Diện tích', 'A3', 'm2', (r) => r.sc.A3 / 1e6, 4],
      ['Khoảng cách từ trục trung hòa đến đáy dầm', 'yb3', 'mm', (r) => r.sc.yb3, 1],
      ['Khoảng cách từ trục trung hòa đến đỉnh bản mặt cầu', 'ysl', 'mm', (r) => r.ysl, 1],
      ['Khoảng cách từ trục trung hòa đến đỉnh dầm', 'ytg', 'mm', (r) => r.yt3, 1],
      ['Mômen quán tính', 'I3', 'm4', (r) => r.sc.I3 / 1e12, 5],
      ['Khoảng cách từ trọng tâm cáp đến đỉnh bản', 'dp', 'mm', (r) => R.hc - r.ycg, 1],
      ['Chu vi ngoài của mặt cắt bê tông', 'pc', 'mm', (r) => r.Pc3, 0],
      ['Diện tích bao bởi chu vi ngoài của mặt cắt bê tông', 'Acp', 'm2', (r) => r.Acp / 1e6, 4],
    ]),
  );

  // ---- 2.7 tọa độ cáp ----
  const n7 = k === 'g' ? '2.8' : '2.4';
  const st = R.stations;
  P.push(gH3(n7 + '. Tọa độ, góc chuyển hướng và chiều dài cáp'));
  P.push(
    gM(
      'a = \\dfrac{y_E - y_M}{(L/2 - L_1 - L_2)^2}\\ ;\\quad y(x) = y_M + a\\,(x - L_2)^2\\ ;\\quad \\theta = \\arctan\\left[2a\\,(L/2 - L_1 - L_2)\\right]',
      '',
      '',
      '',
    ),
  );
  P.push(
    `<table class="t dt"><tr><th>Cáp</th><th>a (1/m)</th><th>θ đầu dầm (độ)</th><th>α tổng tới giữa dầm (rad)</th><th>Chiều dài 1 bó (m)</th></tr>` +
      R.T.map(
        (t) =>
          `<tr><td class="c">${t.i}</td><td>${F(t.a * 1000, 5)}</td><td>${F((Math.atan(2 * t.a * t.Lp) * 180) / Math.PI, 3)}</td><td>${F(t.al[t.al.length - 1], 4)}</td><td>${F(t.len / 1000, 3)}</td></tr>`,
      ).join('') +
      `</table>`,
  );
  P.push(
    `<table class="t dt"><tr><th rowspan="2">Xi (m)</th><th colspan="${nC}">Phương đứng y (mm)</th><th colspan="${nC}">Phương ngang z (mm)</th></tr><tr>${R.T.map((t) => `<th>Cáp ${t.i}</th>`).join('')}${R.T.map((t) => `<th>Cáp ${t.i}</th>`).join('')}</tr>` +
      st
        .map(
          (s) =>
            `<tr><td class="c">${F(s.xc / 1000, 3)}</td>${s.tc.map((q) => `<td>${q ? F(q.y, 0) : '-'}</td>`).join('')}${s.tc.map((q) => `<td>${q ? F(q.z, 0) : '-'}</td>`).join('')}</tr>`,
        )
        .join('') +
      `<tr><td class="l" colspan="${1 + 2 * nC}">Xi - khoảng cách tính từ giữa dầm ; điểm cuối là vị trí neo (L/2 - L1).</td></tr></table>`,
  );
  P.push(
    `<table class="t dt"><tr><th rowspan="2">Xi (m)</th><th colspan="${nC}">Góc chuyển hướng phương đứng αv (rad)</th><th colspan="${nC}">Góc chuyển hướng phương ngang αh (rad)</th></tr><tr>${R.T.map((t) => `<th>Cáp ${t.i}</th>`).join('')}${R.T.map((t) => `<th>Cáp ${t.i}</th>`).join('')}</tr>` +
      st
        .map(
          (s) =>
            `<tr><td class="c">${F(s.xc / 1000, 3)}</td>${s.tc.map((q) => `<td>${q ? F(q.av, 4) : '-'}</td>`).join('')}${s.tc.map((q) => `<td>${q ? F(Math.max(0, q.ah), 4) : '-'}</td>`).join('')}</tr>`,
        )
        .join('') +
      `<tr><td class="l" colspan="${1 + 2 * nC}">Góc tính từ neo (đầu kích) đến điểm đang xét. Góc tổng α dùng tính ma sát bằng tổng các góc chuyển hướng theo đường cáp trong không gian (Điều 9.5.2.2.2).</td></tr></table>`,
  );
  const stSeries = (
    idx: number,
    pick: (pt: GiStationPoint) => number,
  ): { x: number[]; y: number[] } => {
    const xs: number[] = [];
    const ys: number[] = [];
    st.forEach((s) => {
      const pt = s.tc[idx];
      if (pt) {
        xs.push(s.xc / 1000);
        ys.push(pick(pt));
      }
    });
    return { x: xs, y: ys };
  };
  P.push(
    GID.chart({
      id: `dgi${k}C1`,
      title: 'CÁP THEO PHƯƠNG NGANG',
      xt: 'Khoảng cách tới giữa dầm (m)',
      yt: 'Khoảng cách tới tim dầm (m)',
      series: R.T.map((t, i) => {
        const sPts = stSeries(i, (pt) => pt.z / 1000);
        return {
          n: 'Cáp ' + t.i,
          x: sPts.x,
          y: sPts.y,
          c: GID.col[i % 8],
          mk: GID.mks[i % 8],
        };
      }),
      xmin: 0,
    }),
  );
  P.push(
    GID.chart({
      id: `dgi${k}C2`,
      title: 'CÁP THEO PHƯƠNG ĐỨNG',
      xt: 'Khoảng cách tới giữa dầm (m)',
      yt: 'Khoảng cách tới đáy dầm (m)',
      series: R.T.map((t, i) => {
        const sPts = stSeries(i, (pt) => pt.y / 1000);
        return {
          n: 'Cáp ' + t.i,
          x: sPts.x,
          y: sPts.y,
          c: GID.col[i % 8],
          mk: GID.mks[i % 8],
        };
      }),
      xmin: 0,
      ymin: 0,
      ymax: G.H / 1000,
    }),
  );

  // ======= 3. TẢI TRỌNG VÀ NỘI LỰC =======
  const Ld = R.loads;
  P.push(
    gH2(3, 'TẢI TRỌNG VÀ NỘI LỰC'),
    gH3('3.1. Tĩnh tải tác dụng lên 1 ' + kn + ' (TCVN 11823-3, Điều 3.5.1)'),
  );
  P.push(
    gT(
      'Giai đoạn 1 - trọng lượng bản thân dầm (thể tích tính theo mặt cắt thay đổi dọc dầm, quy về tải trọng phân bố đều):',
    ),
  );
  P.push(
    gM(
      'V_g = \\int_0^{L_t} A(x)\\,dx\\ ;\\quad DC_1 = \\dfrac{\\gamma_c\\,V_g}{L_t}',
      'Vg ; DC1',
      F(Ld.Vg, 3) + ' ; ' + F(Ld.w1, 3),
      'm3 ; kN/m',
    ),
  );
  P.push(
    gT(
      'Giai đoạn 2 - tác dụng lên dầm khi chưa liên hợp: bản mặt cầu, tấm bê tông đúc sẵn, dầm ngang:',
    ),
  );
  P.push(
    gM(
      k === 'g'
        ? 'DC_{2,b} = \\gamma_c\\,t_s\\,S'
        : 'DC_{2,b} = \\gamma_c\\,t_s\\,\\left(\\dfrac{S}{2} + d_{oh}\\right)',
      'DC2,b',
      F(Ld.wDeck, 3),
      'kN/m',
    ),
  );
  P.push(gM('DC_{2,p} = \\gamma_c\\,A_{pan}', 'DC2,p', F(Ld.wPan, 3), 'kN/m'));
  if (Ld.dn.length)
    P.push(
      gR(
        `Dầm ngang (${k === 'g' ? 'dầm giữa nhận 2 nửa dầm ngang' : 'dầm biên nhận 1 nửa dầm ngang'}): lực tập trung tại x = ` +
          Ld.dn.map((o) => F(o.x / 1000, 2)).join(' ; ') +
          ' m',
        'Pdn',
        Ld.dn.map((o) => F(o.P, 2)).join(' ; '),
        'kN',
      ),
    );
  P.push(
    gT(
      'Giai đoạn 3 - tác dụng lên mặt cắt liên hợp: gờ lan can, lan can, lề đi bộ (DC), lớp phủ và tiện ích (DW):',
    ),
  );
  P.push(
    gM(
      R.loads.w3 === Ld.curb + Ld.rail + Ld.side
        ? 'DC_3 = \\gamma_c A_{pa} + \\dfrac{P_{ra}}{2L_t} + DC_{PL}'
        : 'DC_3 = \\dfrac{2}{N_b}\\left(\\gamma_c A_{pa} + \\dfrac{P_{ra}}{2L_t} + DC_{PL}\\right)',
      'DC3',
      F(Ld.w3, 3),
      'kN/m',
    ),
  );
  P.push(gM('DW = \\dfrac{\\gamma_{su}\\,H_{su}\\,W}{N_b} + DW_u', 'DW', F(Ld.wDW, 3), 'kN/m'));
  if (Ld.wPL > 0)
    P.push(
      gR(
        'Tải trọng người đi bộ phân cho 1 dầm (TCVN 11823-3, Điều 6.1.6)',
        'PL',
        F(Ld.wPL, 3),
        'kN/m',
      ),
    );
  P.push(
    gT(
      'Mômen và lực cắt của dầm giản đơn nhịp Ls: tải phân bố đều M = w.x.(Ls - x)/2 ; V = w.(Ls/2 - x) ; lực tập trung P tại a: M = P.a.(Ls - x)/Ls (a ≤ x), M = P.x.(Ls - a)/Ls (a > x).',
    ),
  );
  const dnM = (r: GiSectionRes): number => r.M2 - ((Ld.wDeck + Ld.wPan) * r.x * (Lm - r.x)) / 2;
  const dnV = (r: GiSectionRes): number => r.V2 - (Ld.wDeck + Ld.wPan) * (Lm / 2 - r.x);
  P.push(
    gQ(res, 'Mômen (kN.m)', [
      { grp: 'Giai đoạn 1' },
      ['Dầm', 'M1', 'kN.m', (r) => r.M1, 1],
      { grp: 'Giai đoạn 2' },
      ['Bản mặt cầu', '', 'kN.m', (r) => (Ld.wDeck * r.x * (Lm - r.x)) / 2, 1],
      ['Tấm bê tông đúc sẵn', '', 'kN.m', (r) => (Ld.wPan * r.x * (Lm - r.x)) / 2, 1],
      ['Dầm ngang', '', 'kN.m', dnM, 1],
      ['Tổng giai đoạn 2', 'M2', 'kN.m', (r) => r.M2, 1],
      { grp: 'Giai đoạn 3' },
      ['Gờ lan can, lan can, lề đi bộ (DC)', 'M3', 'kN.m', (r) => r.M3, 1],
      ['Lớp phủ và tiện ích (DW)', 'MDW', 'kN.m', (r) => r.MW, 1],
      ['Tổng giai đoạn 3', '', 'kN.m', (r) => r.M3 + r.MW, 1],
    ]),
  );
  P.push(
    gQ(res, 'Lực cắt (kN)', [
      { grp: 'Giai đoạn 1' },
      ['Dầm', 'V1', 'kN', (r) => r.V1, 1],
      { grp: 'Giai đoạn 2' },
      ['Bản mặt cầu', '', 'kN', (r) => Ld.wDeck * (Lm / 2 - r.x), 1],
      ['Tấm bê tông đúc sẵn', '', 'kN', (r) => Ld.wPan * (Lm / 2 - r.x), 1],
      ['Dầm ngang', '', 'kN', dnV, 1],
      ['Tổng giai đoạn 2', 'V2', 'kN', (r) => r.V2, 1],
      { grp: 'Giai đoạn 3' },
      ['Gờ lan can, lan can, lề đi bộ (DC)', 'V3', 'kN', (r) => r.V3, 1],
      ['Lớp phủ và tiện ích (DW)', 'VDW', 'kN', (r) => r.VW, 1],
      ['Tổng giai đoạn 3', '', 'kN', (r) => r.V3 + r.VW, 1],
    ]),
  );

  // ---- 3.2 hoạt tải ----
  P.push(gH3('3.2. Hoạt tải (TCVN 11823-3, Điều 6.1.2, 6.1.3)'));
  P.push(
    gT(
      'Hoạt tải xe HL-93 gồm tổ hợp của xe tải thiết kế hoặc xe hai trục thiết kế với tải trọng làn thiết kế. Lực xung kích chỉ áp dụng cho xe tải, xe hai trục (Điều 6.2.1, Bảng 10).',
    ),
  );
  P.push(
    `<table class="t dt"><tr><th colspan="2">Lực</th><th colspan="2">Giá trị</th><th colspan="3">Khoảng cách các trục bánh xe</th></tr><tr class="grp"><td colspan="7">Xe tải thiết kế</td></tr><tr><td class="c" colspan="2">P1 ; P2 ; P3</td><td colspan="2">35 ; 145 ; 145 kN</td><td class="c" colspan="3">V1 = 4,3 m ; V2 = 4,3 ÷ 9,0 m (lấy 4,3 m)</td></tr><tr class="grp"><td colspan="7">Xe hai trục thiết kế</td></tr><tr><td class="c" colspan="2">P4 ; P5</td><td colspan="2">110 ; 110 kN</td><td class="c" colspan="3">V3 = 1,2 m</td></tr><tr class="grp"><td colspan="7">Tải trọng làn thiết kế, tải trọng người</td></tr><tr><td class="c" colspan="2">WL</td><td colspan="2">9,3 kN/m</td><td class="c" colspan="3">phân bố trên bề rộng 3 m</td></tr><tr><td class="c" colspan="2">PL</td><td colspan="2">${F(I.qPL, 1)} kN/m2</td><td class="c" colspan="3">lề đi bộ rộng ${F(I.WPL || 0, 2)} m</td></tr></table>`,
  );
  P.push(
    `<table class="t dt"><tr><th colspan="5">Cấu kiện (TCVN 11823-3, Bảng 10)</th><th colspan="2">IM</th></tr><tr><td class="l" colspan="5">Mối nối bản mặt cầu - tất cả các trạng thái giới hạn</td><td colspan="2">75%</td></tr><tr><td class="l" colspan="5">Tất cả các cấu kiện khác: trạng thái giới hạn mỏi và giòn</td><td colspan="2">15%</td></tr><tr><td class="l" colspan="5">Tất cả các cấu kiện khác: tất cả các trạng thái giới hạn khác</td><td colspan="2">${F(100 * I.IM, 0)}%</td></tr></table>`,
  );
  P.push(GID.veh(`dgi${k}Veh`));

  // ---- 3.3 hệ số phân bố ----
  const D = R.DF;
  const rg = (b: boolean): string => (b ? 'áp dụng' : 'ngoài phạm vi');
  P.push(
    gH3(
      '3.3. Hệ số phân bố hoạt tải theo làn (TCVN 11823-4, Điều 6.2.2; dầm bê tông chữ I đúc sẵn, mặt cắt loại k theo Bảng 4)',
    ),
  );
  P.push(
    gM(
      'n = \\dfrac{E_c}{E_{cs}}\\ ;\\quad e_g = H - y_{b,g} + \\dfrac{t_s}{2}\\ ;\\quad K_g = n\\left(I_g + A_g\\,e_g^2\\right)\\quad(\\text{PT 14})',
      'Kg',
      (D.Kg / 1e12).toFixed(4),
      'm4',
    ),
  );
  P.push(
    gR(
      'Ig, Ag, yb,g - mặt cắt nguyên của dầm (không liên hợp) tại giữa nhịp ; n ; eg',
      '',
      F(R.gm.I / 1e12, 4) +
        ' ; ' +
        F(R.gm.A / 1e6, 4) +
        ' ; ' +
        F(R.gm.yb, 1) +
        ' ; ' +
        F(D.Kn, 4) +
        ' ; ' +
        F(D.eg, 1),
      'm4 ; m2 ; mm ; - ; mm',
    ),
  );
  P.push(gM('\\dfrac{K_g}{L\\,t_s^3}', '', F(D.KL, 4), ''));
  const rangeRows: Array<[string, string, boolean]> = [
    ['1100 ≤ S ≤ 4900 mm', F(I.S * 1000, 0), D.range.S],
    ['110 ≤ ts ≤ 300 mm', F(R.hs, 0), D.range.ts],
    ['6000 ≤ L ≤ 73000 mm', F(R.Ls, 0), D.range.L],
    ['Nb ≥ 4', String(I.Ng), D.range.Nb],
    ['4.10⁹ ≤ Kg ≤ 3.10¹² mm4', D.Kg.toExponential(3), D.range.Kg],
    ['-300 ≤ de ≤ 1700 mm (dầm biên)', F(D.de, 0), D.range.de],
  ];
  P.push(
    `<table class="t dt"><tr><th colspan="4">Phạm vi áp dụng các công thức (Bảng 6, 11)</th><th colspan="3">Giá trị</th><th colspan="2">Đánh giá</th></tr>` +
      rangeRows
        .map(
          (r) =>
            `<tr><td class="l" colspan="4">${r[0]}</td><td colspan="3">${r[1]}</td><td class="c" colspan="2">${rg(r[2])}</td></tr>`,
        )
        .join('') +
      `</table>`,
  );
  {
    const nt: string[] = [];
    if (D.levS)
      nt.push(
        'S ngoài phạm vi: hoạt tải trên mỗi dầm lấy theo quy tắc đòn bẩy (Điều 6.2.2.1); giá trị dùng tính toán không nhỏ hơn giá trị theo đòn bẩy.',
      );
    if (!D.range.de && D.de < -300)
      nt.push('de < -300 mm: trong công thức hệ số e lấy de = -300 mm (Điều 6.2.2.2.3).');
    if (D.levDe) nt.push('de > 1700 mm: dầm biên lấy theo quy tắc đòn bẩy.');
    if (!D.range.ts || !D.range.L || !D.range.Kg)
      nt.push(
        'Có tham số ngoài phạm vi Bảng 6, 11: không đủ điều kiện dùng hệ số phân bố gần đúng, phải phân tích theo Điều 6.3 Phần 4 (xem bảng tổng hợp).',
      );
    if (nt.length) P.push(gN(nt.join(' ')));
  }
  P.push(gT('Mômen, dầm giữa (Bảng 6):'));
  P.push(
    gM(
      'g_{M}^{1} = 0.06 + \\left(\\dfrac{S}{4300}\\right)^{0.4}\\left(\\dfrac{S}{L}\\right)^{0.3}\\left(\\dfrac{K_g}{L\\,t_s^3}\\right)^{0.1}',
      'gM1',
      F(D.gM1, 4),
      '',
    ),
  );
  P.push(
    gM(
      'g_{M}^{2} = 0.075 + \\left(\\dfrac{S}{2900}\\right)^{0.6}\\left(\\dfrac{S}{L}\\right)^{0.2}\\left(\\dfrac{K_g}{L\\,t_s^3}\\right)^{0.1}',
      'gM2',
      F(D.gM2, 4),
      '',
    ),
  );
  P.push(gT('Lực cắt, dầm giữa (Bảng 11):'));
  P.push(
    gM(
      'g_{V}^{1} = 0.36 + \\dfrac{S}{7600}\\ ;\\quad g_{V}^{2} = 0.2 + \\dfrac{S}{3600} - \\left(\\dfrac{S}{10700}\\right)^{2.0}',
      'gV1 ; gV2',
      F(D.gV1, 4) + ' ; ' + F(D.gV2, 4),
      '',
    ),
  );
  P.push(
    gN(
      `Bản in TCVN 11823-4, Bảng 11 (2 làn trở lên) ghi 0,2 + S/7600 - (S/10700)^2,0 là sai; đúng theo ${AAx}, Bảng 4.6.2.2.3a-1 (SI) là 0,2 + S/3600 - (S/10700)^2,0. Bảng tính dùng dạng đúng.`,
    ),
  );
  P.push(
    gT(
      `Quy tắc đòn bẩy (bản kê tự do trên các dầm, vệt bánh 1,8 m, tim bánh cách mép làn ≥ 600 mm, làn rộng 3,6 m; xếp xe bất lợi; nhân hệ số làn m theo Bảng 7 Phần 3, Điều 6.1.1.2 Phần 3):`,
    ),
  );
  const lv = (o: GiLeverRuleResult): string =>
    o && o.k ? `${F(o.g, 4)} (${o.k} làn, m = ${F(o.m, 2)}, R = ${F(o.R, 4)})` : '-';
  P.push(
    `<table class="t dt"><tr><th colspan="4">Quy tắc đòn bẩy</th><th colspan="3">1 làn chất tải</th><th colspan="3">Bất lợi nhất các trường hợp số làn</th></tr><tr><td class="l" colspan="4">Dầm giữa (dầm trong bất lợi nhất)</td><td colspan="3">${lv(D.levI1)}</td><td colspan="3">${lv(D.levIn)}</td></tr><tr><td class="l" colspan="4">Dầm biên</td><td colspan="3">${lv(D.levE1)}</td><td colspan="3">${lv(D.levEn)}</td></tr></table>`,
  );
  P.push(
    gT(
      'Dầm biên (Bảng 8, Bảng 12): 1 làn chất tải dùng quy tắc đòn bẩy; 2 làn trở lên g = e.g(dầm giữa):',
    ),
  );
  P.push(
    gM(
      'e_M = 0.77 + \\dfrac{d_e}{2800}\\ ;\\quad e_V = 0.6 + \\dfrac{d_e}{3000}',
      'eM ; eV',
      F(D.eM, 4) + ' ; ' + F(D.eV, 4),
      '',
    ),
  );
  P.push(
    gR(
      'Khoảng cách từ tim dầm biên đến mép trong gờ chắn xe' +
        (D.deE !== D.de ? ' (dùng trong công thức: ' + F(D.deE, 0) + ')' : ''),
      'de',
      F(D.de, 0),
      'mm',
    ),
  );
  if (I.Ng === 3)
    P.push(
      gN(
        `Cầu 3 dầm (Nb = 3): dầm giữa - mômen lấy giá trị nhỏ hơn của công thức (với Nb = 3) và quy tắc đòn bẩy, lực cắt theo quy tắc đòn bẩy; dầm biên - mômen 2 làn lấy giá trị nhỏ hơn của e.g và quy tắc đòn bẩy, lực cắt theo quy tắc đòn bẩy (Bảng 6, 8, 11, 12). Bản in TCVN 11823-4, Bảng 6 ghi "Dùng các giá trị lớn nhất ... với Nb = 3 hoặc theo nguyên tắc đòn bẩy" là sai; đúng theo ${AAx}, Bảng 4.6.2.2.2b-1 là "use lesser of the values" (lấy giá trị nhỏ hơn). Bảng tính dùng dạng đúng.`,
      ),
    );
  if (I.Ng < 3)
    P.push(
      gN(
        'Cầu dưới 3 dầm: các công thức gần đúng không áp dụng, hệ số phân bố lấy theo quy tắc đòn bẩy.',
      ),
    );
  P.push(
    gT(
      'Hiệu chỉnh gối chéo: mômen 1 - c1.(tanθ)^1,5 với c1 = 0,25(Kg/(L.ts³))^0,25.(S/L)^0,5 khi 30° ≤ θ ≤ 60° (Bảng 9); lực cắt 1 + 0,20(L.ts³/Kg)^0,3.tanθ (Bảng 13); θ > 60° lấy θ = 60°.',
    ),
  );
  P.push(
    gR(
      `Góc chéo θ = ${F(D.th, 1)}° : hệ số hiệu chỉnh mômen ; lực cắt`,
      '',
      F(D.cM, 4) + ' ; ' + F(D.cV, 4),
      '',
    ),
  );
  const DG = RR.g ? RR.g.DF : D;
  const DB = RR.b ? RR.b.DF : D;
  P.push(
    `<table class="t dt"><tr><th colspan="4">Bảng tổng hợp hệ số phân bố hoạt tải</th><th colspan="3">Mômen</th><th colspan="3">Lực cắt</th></tr><tr><td class="l" colspan="4">Dầm giữa</td><td colspan="3"><b>${F(DG.M, 4)}</b></td><td colspan="3"><b>${F(DG.V, 4)}</b></td></tr><tr><td class="l" colspan="4">Dầm biên</td><td colspan="3"><b>${F(DB.M, 4)}</b></td><td colspan="3"><b>${F(DB.V, 4)}</b></td></tr></table>`,
  );

  // ---- 3.4 nội lực do hoạt tải: đường ảnh hưởng ----
  P.push(gH3('3.4. Nội lực do hoạt tải theo đường ảnh hưởng (1 làn, chưa nhân hệ số phân bố)'));
  P.push(
    gT(
      'Mômen: đặt 1 trục xe tại đỉnh đường ảnh hưởng, xét xe chạy theo hai chiều; lực cắt: đặt trục nặng nhất sát bên phải mặt cắt; tải trọng làn đặt trên phần đường ảnh hưởng cùng dấu. Hoạt tải thiết kế = max(xe tải ; xe hai trục).(1 + IM) + làn.',
    ),
  );
  const lbl: Record<string, GidIlLabels> = {
    'Ls/2': { a: 'Ls/2', b: 'Ls/2', peak: 'Ls/4', neg: '0,5', pos: '0,5' },
    '3Ls/8': { a: '3Ls/8', b: '5Ls/8', peak: '15Ls/64', neg: '3/8', pos: '5/8' },
    'Ls/4': { a: 'Ls/4', b: '3Ls/4', peak: '3Ls/16', neg: '1/4', pos: '3/4' },
    'Ls/8': { a: 'Ls/8', b: '7Ls/8', peak: '7Ls/64', neg: '1/8', pos: '7/8' },
    'Tim gối': { a: '', b: '', peak: '', neg: '', pos: '1' },
  };
  const ilTab = (r: GiSectionRes, kind: 'M' | 'V'): string => {
    const isM = kind === 'M';
    const tr = isM ? r.bT : r.vT;
    const td = isM ? r.bD : r.vD;
    const u = isM ? 'kN.m' : 'kN';
    const om = isM ? (r.x * (Lm - r.x)) / 2 : (Lm - r.x) ** 2 / (2 * Lm);
    const nm = (o: GiAxlePlacement, i: number, arr: GiAxlePlacement[]): string =>
      o.P === 35 ? 'P1' : 'P' + (1 + arr.filter((q, j) => j <= i && q.P !== 35).length);
    let h = `<table class="t dt"><tr><th colspan="3">${isM ? 'Mômen' : 'Lực cắt'} - mặt cắt ${r.tag}</th><th colspan="2">yi ; Ω</th><th colspan="2">P (kN)</th><th colspan="2">${isM ? 'Mômen' : 'Lực cắt'} (${u})</th></tr>`;
    (tr.ax || []).forEach((o, i, a) => {
      h += `<tr><td class="c" colspan="3">${nm(o, i, a)}</td><td colspan="2">${F(o.y, 3)}</td><td colspan="2">${F(o.P, 0)}</td><td colspan="2">${F(o.P * o.y, 1)}</td></tr>`;
    });
    h += `<tr><td class="l" colspan="7"><b>Xe tải.(1 + IM)</b></td><td colspan="2"><b>${F((1 + I.IM) * tr.v, 1)}</b></td></tr>`;
    (td.ax || []).forEach((o, i) => {
      h += `<tr><td class="c" colspan="3">P${4 + i}</td><td colspan="2">${F(o.y, 3)}</td><td colspan="2">${F(o.P, 0)}</td><td colspan="2">${F(o.P * o.y, 1)}</td></tr>`;
    });
    h += `<tr><td class="l" colspan="7"><b>Xe hai trục.(1 + IM)</b></td><td colspan="2"><b>${F((1 + I.IM) * td.v, 1)}</b></td></tr>`;
    h += `<tr><td class="l" colspan="3"><b>Làn (WL = 9,3 kN/m)</b></td><td colspan="2">Ω = ${F(om, 3)}</td><td colspan="2"></td><td colspan="2"><b>${F(9.3 * om, 1)}</b></td></tr>`;
    h += `<tr><td class="l" colspan="7"><b>Hoạt tải thiết kế</b></td><td colspan="2"><b>${F(isM ? r.MLL1 : r.VLL1, 1)}</b></td></tr>`;
    h += `<tr><td class="l" colspan="3">Người đi bộ (1 dầm)</td><td colspan="2">Ω = ${F(om, 3)}</td><td colspan="2"></td><td colspan="2">${F(isM ? r.MPL : r.VPL, 1)}</td></tr></table>`;
    return h;
  };
  res
    .slice()
    .reverse()
    .forEach((r) => {
      P.push(
        gT(`<b>MẶT CẮT ${r.tag === 'Tim gối' ? 'TẠI TIM GỐI (x = 0)' : r.tag.toUpperCase()}</b>`),
      );
      if (r.x > 0) {
        P.push(
          GID.il(`dgi${k}IM${r.tag.replace(/\W/g, '')}`, r, Lm, 'M', lbl[r.tag] || {}),
          ilTab(r, 'M'),
        );
      }
      P.push(
        GID.il(`dgi${k}IV${r.tag.replace(/\W/g, '')}`, r, Lm, 'V', lbl[r.tag] || {}),
        ilTab(r, 'V'),
      );
    });
  P.push(
    gQ(res, 'Mômen và lực cắt do hoạt tải', [
      ['Mômen do hoạt tải xe (1 làn, kể IM)', '', 'kN.m', (r) => r.MLL1, 1],
      ['Mômen do người đi bộ (1 dầm)', '', 'kN.m', (r) => r.MPL, 1],
      ['Mômen ' + kn + ': g.M + MPL', 'MLL', 'kN.m', (r) => r.MLL, 1],
      ['Lực cắt do hoạt tải xe (1 làn, kể IM)', '', 'kN', (r) => r.VLL1, 1],
      ['Lực cắt do người đi bộ (1 dầm)', '', 'kN', (r) => r.VPL, 1],
      ['Lực cắt ' + kn + ': g.V + VPL', 'VLL', 'kN', (r) => r.VLL, 1],
    ]),
  );
  P.push(
    gT(
      'Ảnh hưởng của từ biến, co ngót của dầm và bản mặt cầu: kết cấu nhịp giản đơn tĩnh định nên từ biến, co ngót không gây nội lực thứ cấp; ảnh hưởng của co ngót bản mặt cầu và sự phân bố lại ứng suất được xét trong mất mát dự ứng suất (Điều 9.5.4.3) - mục 4.',
    ),
  );

  // ---- 3.5 tổ hợp ----
  P.push(gH3('3.5. Tổ hợp tải trọng (TCVN 11823-3, Bảng 3, Bảng 4)'));
  const comboTable: Array<[string, number, number, number, number]> = [
    ['Cường độ I', 1.25, 1.5, 1.0, 1.75],
    ['Sử dụng I', 1, 1, 1, 1],
    ['Sử dụng III', 1, 1, 1, I.gLL3],
  ];
  P.push(
    `<table class="t dt"><tr><th colspan="3" rowspan="2">Tổ hợp tải trọng</th><th colspan="4">Hệ số tải trọng γ</th><th colspan="3">Điều chỉnh tải trọng</th></tr><tr><th>DC</th><th>DW</th><th>CR, SH</th><th>LL, IM, PL</th><th>ηD</th><th>ηR</th><th>ηI</th></tr>` +
      comboTable
        .map(
          (r) =>
            `<tr><td class="l" colspan="3">${r[0]}</td><td>${F(r[1], 2)}</td><td>${F(r[2], 2)}</td><td>${F(r[3], 2)}</td><td>${F(r[4], 2)}</td><td>1,00</td><td>1,00</td><td>1,00</td></tr>`,
        )
        .join('') +
      `<tr><td class="l" colspan="10">DC - bản thân các bộ phận kết cấu ; DW - lớp phủ, tiện ích ; CR, SH - từ biến, co ngót (Bảng 4: γp = 1,0) ; LL - hoạt tải xe. η = ηD.ηR.ηI = 1,0 (TCVN 11823-1, Điều 1.3.2 - 1.3.5).</td></tr></table>`,
  );
  const cmb: Array<[string, string, (r: GiSectionRes) => number, (r: GiSectionRes) => number]> = [
    ['Giai đoạn 1', 'Cường độ I', (r) => 1.25 * r.M1, (r) => 1.25 * r.V1],
    ['', 'Sử dụng I', (r) => r.M1, (r) => r.V1],
    ['Giai đoạn 2', 'Cường độ I', (r) => 1.25 * r.M2, (r) => 1.25 * r.V2],
    ['', 'Sử dụng I', (r) => r.M2, (r) => r.V2],
    [
      'Giai đoạn 3',
      'Cường độ I',
      (r) => 1.25 * r.M3 + 1.5 * r.MW + 1.75 * r.MLL,
      (r) => 1.25 * r.V3 + 1.5 * r.VW + 1.75 * r.VLL,
    ],
    ['', 'Sử dụng I', (r) => r.M3 + r.MW + r.MLL, (r) => r.V3 + r.VW + r.VLL],
    ['', 'Sử dụng III', (r) => r.M3 + r.MW + I.gLL3 * r.MLL, (r) => r.V3 + r.VW + I.gLL3 * r.VLL],
    ['Tổng', 'Cường độ I', (r) => r.Mu, (r) => r.Vu],
  ];
  P.push(
    `<table class="t dt"><tr><th colspan="2" rowspan="2">Giai đoạn</th><th colspan="2" rowspan="2">Tổ hợp</th><th colspan="5">Mặt cắt ngang dầm</th></tr><tr>${res.map((r) => `<th>${r.tag}</th>`).join('')}</tr><tr class="grp"><td colspan="9">Mômen uốn (kN.m)</td></tr>` +
      cmb
        .map(
          (c) =>
            `<tr><td class="l" colspan="2">${c[0]}</td><td class="l" colspan="2">${c[1]}</td>${res.map((r) => `<td>${F(c[2](r), 1)}</td>`).join('')}</tr>`,
        )
        .join('') +
      `<tr class="grp"><td colspan="9">Lực cắt (kN)</td></tr>` +
      cmb
        .map(
          (c) =>
            `<tr><td class="l" colspan="2">${c[0]}</td><td class="l" colspan="2">${c[1]}</td>${res.map((r) => `<td>${F(c[3](r), 1)}</td>`).join('')}</tr>`,
        )
        .join('') +
      `</table>`,
  );

  // ======= 4. MẤT MÁT ỨNG SUẤT =======
  const fpy = R.fpy;
  const fpj = R.fpj;
  P.push(
    gH2(4, 'MẤT MÁT ỨNG SUẤT TRONG CÁP DỰ ỨNG LỰC'),
    gH3(
      '4.1. Giới hạn ứng suất cáp dự ứng lực căng sau, tao có độ tự chùng thấp (TCVN 11823-5, Điều 9.3, Bảng 6)',
    ),
  );
  P.push(
    gM(
      'f_{pj} = ' + F(I.fpjr, 3) + '\\,f_{pu}\\ ;\\quad P_j = f_{pj}\\,n_{tao}\\,A_{p1}',
      'fpj ; Pj',
      F(fpj, 1) + ' ; ' + F((fpj * R.Apc) / 1e3, 1),
      'MPa ; kN',
    ),
  );
  P.push(
    `<table class="t dt"><tr><th colspan="4">Điều kiện</th><th>Giới hạn</th><th>Trị số (MPa)</th><th>Ứng suất lớn nhất (MPa)</th><th>KL</th></tr>` +
      lim6
        .map(
          (r) =>
            `<tr><td class="l" colspan="4">${r[0]}</td><td class="c">${r[1]}</td><td>${F(r[2], 1)}</td><td>${F(r[3], 1)}</td>${gOk(r[3] <= r[2] + 1e-9)}</tr>`,
        )
        .join('') +
      gKL(ok41, 8) +
      `</table>`,
  );
  P.push(gH3('4.2. Mất mát ứng suất do ma sát (Điều 9.5.2.2.2)'));
  P.push(
    gM(
      '\\Delta f_{pF} = f_{pj}\\left[1 - e^{-(Kx + \\mu\\alpha)}\\right]\\quad(\\text{PT 123})',
      '',
      '',
      '',
    ),
  );
  P.push(
    gR(
      'Hệ số ma sát lắc ; hệ số ma sát (Bảng 10)',
      'K ; μ',
      F(G.K, 6) + ' ; ' + F(G.mu, 3),
      '1/m ; -',
    ),
  );
  P.push(
    gT(
      'x - chiều dài cáp từ đầu kích tới điểm đang xét (mm); α - tổng giá trị tuyệt đối các góc chuyển hướng của cáp từ đầu kích tới điểm đang xét (rad), cộng véc tơ các góc theo phương đứng và phương ngang. Kéo căng từ hai đầu: mỗi nửa dầm tính từ đầu kích gần hơn.',
    ),
  );
  const fT = (arr: 'fF' | 'fA', lab: string): string =>
    `<table class="t dt"><tr><th rowspan="2">Xi (m)</th><th colspan="${nC}">${lab}</th></tr><tr>${R.T.map((t) => `<th>Cáp ${t.i}</th>`).join('')}</tr>` +
    st
      .map(
        (s) =>
          `<tr><td class="c">${F(s.xc / 1000, 3)}</td>${s.tc.map((q) => `<td>${q ? F(q[arr], 1) : '-'}</td>`).join('')}</tr>`,
      )
      .join('') +
    `</table>`;
  P.push(fT('fF', 'Ứng suất trong cáp sau mất mát do ma sát fpj - ΔfpF (MPa)'));
  P.push(
    GID.chart({
      id: `dgi${k}C3`,
      title: 'MẤT MÁT ỨNG SUẤT DO MA SÁT',
      xt: 'Khoảng cách tới giữa dầm (m)',
      yt: 'Ứng suất trong cáp (MPa)',
      series: R.T.map((t, i) => {
        const sPts = stSeries(i, (pt) => pt.fF);
        return {
          n: 'Cáp ' + t.i,
          x: sPts.x,
          y: sPts.y,
          c: GID.col[i % 8],
          mk: GID.mks[i % 8],
        };
      }),
      xmin: 0,
      ymin: Math.floor((Math.min(...R.T.map((t) => t.fAnc)) - 60) / 50) * 50,
      ymax: Math.ceil((fpj + 30) / 50) * 50,
    }),
  );
  P.push(gH3('4.3. Mất mát ứng suất do tụt neo (Điều 9.5.2.1)'));
  P.push(
    gT(
      'TCVN 11823-5, Điều 9.5.2.1 không quy định công thức; mất mát do tụt neo xác định theo điều kiện biến dạng: tổng độ co ngắn của cáp trên chiều dài chịu ảnh hưởng ls bằng độ tụt neo Δset, đường ứng suất sau tụt neo đối xứng với đường ứng suất do ma sát qua điểm ứng suất tại ls (ma sát ngược):',
    ),
  );
  P.push(GID.set(`dgi${k}Set`));
  P.push(
    gM(
      '\\int_0^{l_s}\\left[f_F(x) - f_A(x)\\right]dx = E_p\\,\\Delta_{set}\\ ;\\quad f_A(x) = 2f_F(l_s) - f_F(x)\\ \\ (x < l_s)',
      'Δset',
      F(G.set, 1),
      'mm',
    ),
  );
  P.push(
    gT(
      'Khi ls lớn hơn nửa chiều dài cáp (kéo hai đầu), toàn bộ cáp chịu ảnh hưởng: fA(x) = 2fF(L/2) - fF(x) - δ, với δ xác định từ cùng điều kiện tích phân trên nửa chiều dài cáp.',
    ),
  );
  P.push(
    `<table class="t dt"><tr><th>Cáp</th><th>ls (m)</th><th>fF(ls) (MPa)</th><th>fA tại neo (MPa)</th><th>fpj - fA tại neo</th><th>fA giữa dầm (MPa)</th><th>Ghi chú</th></tr>` +
      R.T.map(
        (t) =>
          `<tr><td class="c">${t.i}</td><td>${F(t.lset / 1000, 3)}</td><td>${F(t.fl, 1)}</td><td>${F(t.fAnc, 1)}</td><td>${F(fpj - t.fAnc, 1)}</td><td>${F(t.fAmid, 1)}</td><td class="l">${t.whole ? 'ls > L/2: δ = ' + F(t.dlt, 1) + ' MPa' : ''}</td></tr>`,
      ).join('') +
      `</table>`,
  );
  P.push(fT('fA', 'Ứng suất trong cáp sau mất mát do ma sát và tụt neo (MPa)'));
  P.push(
    GID.chart({
      id: `dgi${k}C4`,
      title: 'ỨNG SUẤT SAU MẤT MÁT DO MA SÁT VÀ TỤT NEO',
      xt: 'Khoảng cách tới giữa dầm (m)',
      yt: 'Ứng suất trong cáp (MPa)',
      series: R.T.map((t, i) => {
        const sPts = stSeries(i, (pt) => pt.fA);
        return {
          n: 'Cáp ' + t.i,
          x: sPts.x,
          y: sPts.y,
          c: GID.col[i % 8],
          mk: GID.mks[i % 8],
        };
      }),
      xmin: 0,
      ymin: Math.floor((Math.min(...R.T.map((t) => t.fAnc)) - 60) / 50) * 50,
      ymax: Math.ceil((fpj + 30) / 50) * 50,
    }),
  );
  const E = R.ES;
  P.push(gH3('4.4. Mất mát ứng suất do co ngắn đàn hồi (Điều 9.5.2.3.2)'));
  P.push(
    gT(
      'fcgp lấy tại mặt cắt giữa nhịp (dầm giản đơn, cáp dính bám), lực dự ứng lực sau ma sát và tụt neo, mặt cắt giảm yếu giai đoạn 1; trị số ΔfpES dùng cho mọi mặt cắt:',
    ),
  );
  P.push(
    gR(
      'Số bó cáp giống nhau ; lực dự ứng lực tại giữa nhịp ; độ lệch tâm',
      'N ; P ; e',
      E.N + ' ; ' + F(E.P, 1) + ' ; ' + F(E.e, 1),
      '- ; kN ; mm',
    ),
  );
  P.push(
    gM(
      'f_{cgp} = \\dfrac{P}{A_1} + \\dfrac{P\\,e^2}{I_1} - \\dfrac{M_{DC1}\\,e}{I_1}',
      'fcgp',
      F(E.fcgp, 3),
      'MPa',
    ),
  );
  P.push(
    gM(
      '\\Delta f_{pES} = \\dfrac{N - 1}{2N}\\,\\dfrac{E_p}{E_{ci}}\\,f_{cgp}\\quad(\\text{PT 126})',
      'ΔfpES',
      F(E.dES, 2),
      'MPa',
    ),
  );
  const s = R.shr;
  P.push(gH3('4.5. Hệ số co ngót, từ biến (Điều 4.2.3)'));
  P.push(
    gM(
      '\\psi(t,t_i) = 1.9\\,k_s k_{hc} k_f k_{td}\\,t_i^{-0.118}\\ ;\\quad \\varepsilon_{sh} = k_s k_{hs} k_f k_{td}\\,0.48\\cdot10^{-3}\\quad(\\text{PT 1, 6})',
      '',
      '',
      '',
    ),
  );
  P.push(
    gM(
      "k_s = 1.45 - 0.0051\\dfrac{V}{S} \\ge 1.0\\ ;\\ k_{hc} = 1.56 - 0.008H\\ ;\\ k_{hs} = 2.00 - 0.014H\\ ;\\ k_f = \\dfrac{35}{7 + f'_{ci}}\\ ;\\ k_{td} = \\dfrac{t}{\\dfrac{12(100 - 0.58f'_{ci})}{0.145f'_{ci} + 20} + t}",
      '',
      '',
      '',
    ),
  );
  const shrRows: Array<[string, string, string]> = [
    ['Tỷ số thể tích/bề mặt của dầm (mặt trên tiếp xúc bản không kể)', 'V/S (mm)', F(s.VS, 1)],
    ['Hệ số ảnh hưởng V/S', 'ks', F(s.ks, 3)],
    ['Hệ số độ ẩm co ngót / từ biến', 'khs ; khc', F(s.khs, 4) + ' ; ' + F(s.khc, 4)],
    ['Hệ số cường độ bê tông dầm', 'kf', F(s.kf, 4)],
    [
      'Hệ số thời gian: (td - ti) ; (tf - ti) ; (tf - td)',
      'ktd',
      F(s.ktd_di, 4) + ' ; ' + F(s.ktd_fi, 4) + ' ; ' + F(s.ktd_fd, 4),
    ],
    ['Hệ số từ biến dầm', 'ψb(tf,ti)', F(s.psi_fi, 4)],
    ['', 'ψb(td,ti)', F(s.psi_di, 4)],
    ['', 'ψb(tf,td)', F(s.psi_fd, 4)],
    [
      'Thời gian bảo dưỡng dầm trước khi để khô (ngày) ; hệ số tăng co ngót (Điều 4.2.3.3)',
      'tc ; k',
      F(s.tcur, 0) + ' ; ' + F(s.kc5, 2),
    ],
    ['Co ngót dầm từ lúc căng kéo đến lúc đổ bản', 'εbid', s.eps_bid.toExponential(4)],
    ['Co ngót dầm từ lúc đổ bản đến thời điểm cuối', 'εbdf', s.eps_bdf.toExponential(4)],
    [
      "Bản mặt cầu: V/S ; ks ; kf (f'ci = 0,8f'cs)",
      '',
      F(s.VSd, 0) + ' ; ' + F(s.ksd, 3) + ' ; ' + F(s.kfd, 4),
    ],
    ['Co ngót bản từ lúc đổ đến thời điểm cuối', 'εddf', s.eps_ddf.toExponential(4)],
    ['Hệ số từ biến bản', 'ψd(tf,td)', F(s.psi_d, 4)],
  ];
  P.push(
    `<table class="t dt"><tr><th colspan="5">Đại lượng</th><th>Ký hiệu</th><th>Giá trị</th></tr>` +
      shrRows
        .map(
          (r) =>
            `<tr><td class="l" colspan="5">${r[0]}</td><td class="c">${r[1]}</td><td>${r[2]}</td></tr>`,
        )
        .join('') +
      `<tr><td class="l" colspan="7">ti = ${I.ti} ngày (căng kéo) ; td = ${I.td} ngày (đổ bản) ; tf = ${I.tf} ngày ; H = ${I.RH}%.</td></tr></table>`,
  );
  P.push(gH3('4.6. Mất mát ứng suất theo thời gian - phương pháp chính xác (Điều 9.5.4)'));
  P.push(
    gT(
      'Điều 9.5.3 (tính gần đúng) chỉ áp dụng cho cấu kiện đúc sẵn căng trước, nên dầm căng sau tính theo Điều 9.5.4:',
    ),
  );
  P.push(
    gM(
      '\\Delta f_{pLT} = (\\Delta f_{pSR} + \\Delta f_{pCR} + \\Delta f_{pR1})_{id} + (\\Delta f_{pSD} + \\Delta f_{pCD} + \\Delta f_{pR2} - \\Delta f_{pSS})_{df}\\quad(\\text{PT 130})',
      '',
      '',
      '',
    ),
  );
  if (G.idMode === 'zero')
    P.push(gN('Theo lựa chọn ở mục 2.6: (ΔfpSR + ΔfpCR + ΔfpR1)id = 0 (Điều 9.5.4.5).'));
  else
    P.push(
      gN(
        'Lựa chọn ở mục 2.6: tính đủ (ΔfpSR + ΔfpCR + ΔfpR1)id theo Điều 9.5.4.2. Điều 9.5.4.5 quy định với dầm căng sau không thi công phân đoạn giá trị này lấy bằng 0; mất mát lớn hơn làm ứng suất kéo bất lợi hơn nhưng ứng suất nén thuận lợi hơn, vì vậy lựa chọn này không thiên về an toàn cho kiểm toán ứng suất nén.',
      ),
    );
  P.push(
    gM(
      'K_{id} = \\dfrac{1}{1 + \\dfrac{E_p}{E_{ci}}\\dfrac{A_{ps}}{A_g}\\left(1 + \\dfrac{A_g e_{pg}^2}{I_g}\\right)\\left[1 + 0.7\\psi_b(t_f,t_i)\\right]}\\ ;\\quad \\Delta f_{pSR} = \\varepsilon_{bid}E_pK_{id}\\ ;\\quad \\Delta f_{pCR} = \\dfrac{E_p}{E_{ci}}f_{cgp}\\psi_b(t_d,t_i)K_{id}',
      '',
      '',
      '',
    ),
  );
  P.push(
    gM(
      '\\Delta f_{pR1} = \\dfrac{f_{pt}}{K_L}\\left(\\dfrac{f_{pt}}{f_{py}} - 0.55\\right)\\ ;\\quad K_L = 30\\quad(\\text{PT 134})',
      '',
      '',
      '',
    ),
  );
  P.push(
    gN(
      `PT 134: bản in TCVN 11823-5, Điều 9.5.4.2.3 ghi "fpt ... được lấy không quá 0,55fpy" là sai; đúng theo ${AAx}, Điều 5.9.5.4.2c là "taken as not less than 0.55fpy" (lấy không nhỏ hơn 0,55fpy). Bảng tính dùng dạng đúng.`,
    ),
  );
  P.push(
    gM(
      'K_{df} = \\dfrac{1}{1 + \\dfrac{E_p}{E_{ci}}\\dfrac{A_{ps}}{A_c}\\left(1 + \\dfrac{A_c e_{pc}^2}{I_c}\\right)\\left[1 + 0.7\\psi_b(t_f,t_i)\\right]}\\ ;\\quad \\Delta f_{pSD} = \\varepsilon_{bdf}E_pK_{df}\\ ;\\quad \\Delta f_{pR2} = \\Delta f_{pR1}',
      '',
      '',
      '',
    ),
  );
  P.push(
    gM(
      '\\Delta f_{pCD} = \\dfrac{E_p}{E_{ci}}f_{cgp}\\left[\\psi_b(t_f,t_i) - \\psi_b(t_d,t_i)\\right]K_{df} + \\dfrac{E_p}{E_c}\\Delta f_{cd}\\,\\psi_b(t_f,t_d)\\,K_{df}\\quad(\\text{PT 137})',
      '',
      '',
      '',
    ),
  );
  P.push(
    gM(
      '\\Delta f_{cd} = -(\\Delta f_{pSR} + \\Delta f_{pCR} + \\Delta f_{pR1})_{id}A_{ps}\\left(\\dfrac{1}{A_g} + \\dfrac{e_{pg}^2}{I_g}\\right) - \\dfrac{M_{DC2}\\,e_{pg}}{I_g} - \\dfrac{(M_{DC3} + M_{DW})\\,e_{pc}}{I_c}',
      '',
      '',
      '',
    ),
  );
  P.push(
    gM(
      '\\Delta f_{cdf} = \\dfrac{\\varepsilon_{ddf}A_dE_{cd}}{1 + 0.7\\psi_d(t_f,t_d)}\\left(\\dfrac{1}{A_c} - \\dfrac{e_{pc}e_d}{I_c}\\right)\\ ;\\quad \\Delta f_{pSS} = -\\dfrac{E_p}{E_c}\\Delta f_{cdf}K_{df}\\left[1 + 0.7\\psi_b(t_f,t_d)\\right]\\quad(\\text{PT 139, 140})',
      '',
      '',
      '',
    ),
  );
  P.push(
    gN(
      `Bản in TCVN 11823-5, Điều 9.5.4.3.2 - 9.5.4.3.4 sai ký hiệu: PT 137 ghi ψb(tf, tdi) đúng là ψb(tf, td); PT 139 ghi Δfcd đúng là Δfcdf; PT 140 ghi vế trái là Kdf và ψb(tf, td) ở mẫu số, đúng là Δfcdf và ψd(tf, td) (theo ${AAx}, PT 5.9.5.4.3d-1, 5.9.5.4.3d-2). ΔfpSS là gia tăng ứng suất trong cáp do co ngót bản mặt cầu (Δfcdf tính theo PT 140 mang dấu âm khi cáp nằm dưới trọng tâm mặt cắt liên hợp), lấy dấu để trừ khỏi tổng mất mát. Ag, Ig - mặt cắt nguyên của dầm; Ac, Ic - mặt cắt liên hợp nguyên quy đổi theo ns.`,
    ),
  );
  P.push(
    gQ(res, 'Mất mát theo thời gian (MPa)', [
      ['Ứng suất cáp sau truyền lực (trung bình)', 'fpt', 'MPa', (r) => r.fpt, 1],
      ['Ứng suất bê tông tại trọng tâm cáp khi truyền lực', 'fcgp', 'MPa', (r) => r.fcgp, 2],
      [
        'Độ lệch tâm cáp - dầm ; - mặt cắt liên hợp',
        'epg ; epc',
        'mm',
        (r) => F(r.e, 0) + ' ; ' + F(r.ec, 0),
      ],
      ['Hệ số chuyển đổi mặt cắt', 'Kid', '', (r) => r.Kid, 4],
      ['Co ngót dầm (id)', 'ΔfpSR', 'MPa', (r) => (G.idMode === 'zero' ? 0 : r.dSR), 2],
      ['Từ biến dầm (id)', 'ΔfpCR', 'MPa', (r) => (G.idMode === 'zero' ? 0 : r.dCR), 2],
      ['Tự chùng (id)', 'ΔfpR1', 'MPa', (r) => (G.idMode === 'zero' ? 0 : r.dR1), 2],
      ['Hệ số chuyển đổi mặt cắt', 'Kdf', '', (r) => r.Kdf, 4],
      ['Co ngót dầm (df)', 'ΔfpSD', 'MPa', (r) => r.dSD, 2],
      ['Thay đổi ứng suất tại trọng tâm cáp', 'Δfcd', 'MPa', (r) => r.dfcd, 3],
      ['Từ biến dầm (df)', 'ΔfpCD', 'MPa', (r) => r.dCD, 2],
      ['Tự chùng (df)', 'ΔfpR2', 'MPa', (r) => r.dR2, 2],
      ['Co ngót bản: thay đổi ứng suất tại trọng tâm cáp', 'Δfcdf', 'MPa', (r) => r.dfcdf, 3],
      ['Gia tăng ứng suất do co ngót bản', 'ΔfpSS', 'MPa', (r) => r.dSS, 2],
      ['Tổng mất mát theo thời gian', 'ΔfpLT', 'MPa', (r) => r.dLT, 2],
      ['Tổng mất mát (ES + LT, chưa kể ma sát, tụt neo)', 'ΔfpT', 'MPa', (r) => r.dT, 2],
    ]),
  );
  P.push(gH3('4.7. Ứng suất trong cáp sau các mất mát'));
  P.push(
    gQ(
      res,
      'Ứng suất cáp (MPa), lực dự ứng lực (kN)',
      [
        ...R.T.map((t): GiTableRow => [
          `Cáp ${t.i}: sau ma sát, tụt neo, co ngắn đàn hồi`,
          'fpt',
          'MPa',
          (r) => {
            const q = r.cab.find((c) => c.i === t.i);
            return q ? q.fpt : NaN;
          },
          1,
        ]),
        ...R.T.map((t): GiTableRow => [
          `Cáp ${t.i}: sau toàn bộ mất mát`,
          'fpe',
          'MPa',
          (r) => {
            const q = r.cab.find((c) => c.i === t.i);
            return q ? q.fpe : NaN;
          },
          1,
        ]),
        ['Lực dọc trục do cáp khi căng kéo (giai đoạn 1)', 'Pt', 'kN', (r) => r.Pt, 1],
        ['Lực dọc trục do cáp lúc đổ bản (giai đoạn 2)', 'Pd', 'kN', (r) => r.Pd, 1],
        ['Lực dọc trục do cáp sau toàn bộ mất mát', 'Pe', 'kN', (r) => r.Pe, 1],
        ['Thành phần thẳng đứng của lực cáp sau mất mát', 'Vp', 'kN', (r) => r.Vp, 1],
        {
          ok: (r) => r.cab.every((q) => q.fpe <= 0.8 * fpy + 1e-9),
          0: 'fpe ≤ 0,80fpy = ' + F(0.8 * fpy, 1) + ' MPa',
          1: '',
          2: '',
        },
      ],
      gKL(ok41, 10, '(giới hạn ứng suất cáp, Bảng 6)'),
    ),
  );

  // ======= 5. ỨNG SUẤT =======
  P.push(gH2(5, 'KIỂM TOÁN ỨNG SUẤT (TRẠNG THÁI GIỚI HẠN SỬ DỤNG)'));
  P.push(
    gT('Quy ước dấu: ứng suất nén mang dấu dương, kéo mang dấu âm. Ứng suất thớ trên / thớ dưới:'),
  );
  P.push(gM('f = \\dfrac{P}{A} \\mp \\dfrac{P\\,e}{I}\\,y \\pm \\dfrac{M}{I}\\,y', '', '', ''));
  P.push(gH3('5.1. Giai đoạn 1 - khi căng kéo cáp (Điều 9.4.1, Bảng 7)'));
  P.push(
    gQ(
      res,
      'Giai đoạn 1',
      [
        { grp: 'Mặt cắt giai đoạn 1' },
        ['Diện tích', 'A1', 'm2', (r) => r.sc.A1 / 1e6, 4],
        [
          'K.cách từ trục trung hòa tới mép dưới / mép trên',
          'yb1 ; yt1',
          'mm',
          (r) => F(r.sc.yb1, 0) + ' ; ' + F(r.yt1, 0),
        ],
        ['Mômen quán tính', 'I1', 'm4', (r) => r.sc.I1 / 1e12, 4],
        ['K.cách từ trọng tâm ống ghen tới mép dưới', 'db', 'mm', (r) => r.ycg, 0],
        { grp: 'Sau mất mát do ma sát, tụt neo, co ngắn đàn hồi' },
        ['Lực dọc do lực căng cáp', 'Pt', 'kN', (r) => r.Pt, 1],
        ['Mômen do lực căng cáp', 'Mp', 'kN.m', (r) => -r.Mpt, 1],
        ['Mômen do tải trọng giai đoạn 1', 'M1', 'kN.m', (r) => r.M1, 1],
        ['Ứng suất mép trên của dầm', 'f1t', 'MPa', (r) => r.s1t, 2],
        ['Ứng suất mép dưới của dầm', 'f1b', 'MPa', (r) => r.s1b, 2],
        [
          'Lực kéo trong vùng chịu kéo ; As yêu cầu ; As có',
          'T ; Areq ; As',
          'kN ; mm2',
          (r) =>
            r.tr.T > 0 ? F(r.tr.T, 1) + ' ; ' + F(r.tr.Areq, 0) + ' ; ' + F(r.tr.Aprov, 0) : '-',
        ],
        ["Ứng suất nén giới hạn 0,60f'ci", '', 'MPa', () => fciL, 2],
        ['Ứng suất kéo giới hạn (Bảng 7)', '', 'MPa', (r) => -r.tr.lim, 2],
        { ok: ok51, 0: 'Kiểm toán', 1: '', 2: '' },
      ],
      gKL(res.every(ok51), 10),
    ),
  );
  P.push(
    gT(
      `Kéo: không có cốt thép dính bám đủ chịu lực kéo thì ≥ -0,25√f'ci ≤ 1,38 MPa; có cốt thép dính bám chịu lực kéo T ở ứng suất ${F(R.fsT, 0)} MPa (0,5fy ≤ 210 MPa) thì ≥ -0,63√f'ci (Bảng 7).`,
    ),
  );
  P.push(
    cS(
      `dgi${k}C5`,
      'GIAI ĐOẠN 1 - GIỚI HẠN SỬ DỤNG I',
      [
        { n: 'Ứng suất mép trên của dầm', f: (r) => r.s1t, c: '#0000ff', mk: 'sq' },
        { n: 'Ứng suất mép dưới của dầm', f: (r) => r.s1b, c: '#ff0000', mk: 'tri' },
      ],
      [
        { n: 'Ứng suất nén giới hạn của dầm', f: () => fciL, c: '#663300' },
        { n: 'Ứng suất kéo giới hạn của dầm', f: (r) => -r.tr.lim, c: '#3333cc' },
      ],
    ),
  );
  P.push(gH3('5.2. Giai đoạn 2 - khi đổ bản mặt cầu (dầm chưa liên hợp)'));
  P.push(
    gT(
      "Lực dự ứng lực sau mất mát tức thời và mất mát theo thời gian giai đoạn id (từ lúc căng kéo đến lúc đổ bản); ống ghen đã bơm vữa (mặt cắt giai đoạn 2); trọng lượng dầm tác dụng trên mặt cắt giai đoạn 1, tải trọng giai đoạn 2 trên mặt cắt giai đoạn 2. Giới hạn: nén 0,45f'c (Bảng 8), kéo theo Bảng 9.",
    ),
  );
  P.push(
    gQ(
      res,
      'Giai đoạn 2',
      [
        { grp: 'Mặt cắt giai đoạn 2' },
        ['Diện tích', 'A2', 'm2', (r) => r.sc.A2 / 1e6, 4],
        [
          'K.cách từ trục trung hòa tới mép dưới / mép trên',
          'yb2 ; yt2',
          'mm',
          (r) => F(r.sc.yb2, 0) + ' ; ' + F(r.yt2, 0),
        ],
        ['Mômen quán tính', 'I2', 'm4', (r) => r.sc.I2 / 1e12, 4],
        { grp: 'Sau mất mát tức thời và mất mát id' },
        ['Lực dọc do lực căng cáp', 'Pd', 'kN', (r) => r.Pd, 1],
        ['Mômen do tải trọng giai đoạn 1', 'M1', 'kN.m', (r) => r.M1, 1],
        ['Mômen do tải trọng giai đoạn 2', 'M2', 'kN.m', (r) => r.M2, 1],
        ['Ứng suất mép trên của dầm', 'f2t', 'MPa', (r) => r.s2t, 2],
        ['Ứng suất mép dưới của dầm', 'f2b', 'MPa', (r) => r.s2b, 2],
        ["Ứng suất nén giới hạn 0,45f'c", '', 'MPa', () => 0.45 * I.fc, 2],
        ['Ứng suất kéo giới hạn', '', 'MPa', () => -ftl, 2],
        { ok: ok52, 0: 'Kiểm toán', 1: '', 2: '' },
      ],
      gKL(res.every(ok52), 10),
    ),
  );
  P.push(
    cS(
      `dgi${k}C6`,
      'GIAI ĐOẠN 2 - GIỚI HẠN SỬ DỤNG I',
      [
        { n: 'Ứng suất mép trên của dầm', f: (r) => r.s2t, c: '#ff0000', mk: 'sq' },
        { n: 'Ứng suất mép dưới của dầm', f: (r) => r.s2b, c: '#0000ff', mk: 'tri' },
      ],
      [
        { n: 'Ứng suất nén giới hạn của dầm', f: () => 0.45 * I.fc, c: '#663300' },
        { n: 'Ứng suất kéo giới hạn của dầm', f: () => -ftl, c: '#3333cc' },
      ],
    ),
  );
  P.push(gH3('5.3. Giai đoạn 3 - khai thác, sau toàn bộ mất mát (Bảng 8, Bảng 9)'));
  P.push(
    gT(
      `Gradien nhiệt (TCVN 11823-3, Điều 11.3, Bảng 25) tính trên mặt cắt liên hợp giữa nhịp; T3 = 0 ; ứng suất tự cân bằng cộng vào tổ hợp sử dụng với γTG = ${F(gTGv, 2)}:`,
    ),
  );
  const tgRows: Array<[string, GiThermalStress]> = [
    ['Dương (T1 = ' + F(I.TGp[0], 0) + ' ; T2 = ' + F(I.TGp[1], 0) + ' °C)', TG.pos],
    ['Âm (T1 = ' + F(I.TGn[0], 0) + ' ; T2 = ' + F(I.TGn[1], 0) + ' °C)', TG.neg],
  ];
  P.push(
    `<table class="t dt"><tr><th colspan="3">Gradien nhiệt</th><th colspan="2">Thớ trên bản (MPa)</th><th colspan="2">Thớ trên dầm (MPa)</th><th colspan="2">Thớ dưới dầm (MPa)</th></tr>` +
      tgRows
        .map(
          ([n, o]) =>
            `<tr><td class="l" colspan="3">${n}</td><td colspan="2">${F(o.dk, 3)}</td><td colspan="2">${F(o.gt, 3)}</td><td colspan="2">${F(o.gb, 3)}</td></tr>`,
        )
        .join('') +
      `<tr><td class="l" colspan="3">Giá trị bất lợi nhân γTG</td><td colspan="2">${F(tgD, 3)}</td><td colspan="2">${F(tgT, 3)}</td><td colspan="2">${F(tgB, 3)}</td></tr></table>`,
  );
  P.push(
    gQ(res, 'Giai đoạn 3 - Sử dụng I', [
      { grp: 'Mặt cắt giai đoạn 3 (liên hợp)' },
      ['Diện tích', 'A3', 'm2', (r) => r.sc.A3 / 1e6, 4],
      ['K.cách từ trục trung hòa tới mép dưới dầm', 'yb3', 'mm', (r) => r.sc.yb3, 0],
      [
        'K.cách từ trục trung hòa tới mép trên bản / mép trên dầm',
        'ysl ; ytg',
        'mm',
        (r) => F(r.ysl, 0) + ' ; ' + F(r.yt3, 0),
      ],
      ['Mômen quán tính', 'I3', 'm4', (r) => r.sc.I3 / 1e12, 4],
      { grp: 'Sau toàn bộ mất mát - Sử dụng I' },
      ['Lực dọc do lực căng cáp', 'Pe', 'kN', (r) => r.Pe, 1],
      ['Mômen do DC3 + DW (mặt cắt liên hợp)', '', 'kN.m', (r) => r.M3 + r.MW, 1],
      ['Mômen do hoạt tải', 'MLL', 'kN.m', (r) => r.MLL, 1],
      [
        'Ứng suất mép trên bản: thường xuyên ; Sử dụng I + TG',
        'fd',
        'MPa',
        (r) => F(r.fdP, 2) + ' ; ' + F(r.fdIT, 2),
      ],
      [
        'Ứng suất mép trên dầm: thường xuyên ; Sử dụng I + TG',
        'ft',
        'MPa',
        (r) => F(r.ftP, 2) + ' ; ' + F(r.ftIT, 2),
      ],
      [
        'Ứng suất mép dưới dầm: thường xuyên ; Sử dụng I',
        'fb',
        'MPa',
        (r) => F(r.fbP, 2) + ' ; ' + F(r.fbI, 2),
      ],
      [
        "Nén giới hạn bản: 0,45f'cs ; 0,60f'cs",
        '',
        'MPa',
        () => F(L5.dkP, 2) + ' ; ' + F(L5.dkI, 2),
      ],
      [
        "Nén giới hạn dầm: 0,45f'c ; 0,60φw.f'c",
        '',
        'MPa',
        () => F(L5.svP, 2) + ' ; ' + F(L5.svI, 2),
      ],
      { ok: ok53, 0: 'Kiểm toán', 1: '', 2: '' },
    ]),
  );
  P.push(
    gT(
      `0,45f'c - do dự ứng lực có hiệu và tải trọng thường xuyên ; 0,60φw.f'c - do dự ứng lực có hiệu, tải trọng thường xuyên và tải trọng nhất thời (Bảng 8). Độ mảnh lớn nhất của bản bụng, bản cánh λ = ${F(R.lamW, 2)} (chiều cao sườn h3 / bw ; phần chìa cánh / chiều dày cánh); φw = 1,0 khi λ ≤ 15, giảm tuyến tính 0,025 cho mỗi đơn vị λ từ 15 đến 25, φw = 0,75 khi λ > 25 (Điều 7.4.7.1): φw = ${F(R.phiW, 3)}.`,
    ),
  );
  P.push(
    cS(
      `dgi${k}C7`,
      'GIAI ĐOẠN 3 - GIỚI HẠN SỬ DỤNG I',
      [
        { n: 'Ứng suất ở mép trên của bản mặt cầu', f: (r) => r.fdIT ?? r.fdI, c: '#ff8080', mk: 'dia' },
        { n: 'Ứng suất ở mép trên của dầm', f: (r) => r.ftIT ?? r.ftI, c: '#ff0000', mk: 'sq' },
        { n: 'Ứng suất ở mép dưới của dầm', f: (r) => r.fbI, c: '#0000ff', mk: 'tri' },
      ],
      [
        { n: 'Ứng suất nén giới hạn của bản', f: () => L5.dkI, c: '#000000' },
        { n: 'Ứng suất nén giới hạn của dầm', f: () => L5.svI, c: '#663300' },
        { n: 'Ứng suất kéo giới hạn của dầm', f: () => -ftl, c: '#3333cc' },
      ],
    ),
  );
  P.push(gH3('5.4. Giai đoạn 3 - Sử dụng III (kiểm toán ứng suất kéo, Bảng 9)'));
  P.push(
    gQ(res, 'Giai đoạn 3 - Sử dụng III', [
      ['Mômen do hoạt tải x γLL = ' + F(I.gLL3, 2), '', 'kN.m', (r) => I.gLL3 * r.MLL, 1],
      ['Ứng suất mép trên bản', 'fd', 'MPa', (r) => r.fdIII, 2],
      ['Ứng suất mép trên dầm', 'ft', 'MPa', (r) => r.ftIII, 2],
      ['Ứng suất mép dưới dầm (+ TG)', 'fb', 'MPa', (r) => r.fbIIIT ?? r.fbIII, 2],
      [
        'Ứng suất kéo giới hạn: ' +
          (I.exp === '2'
            ? "0,25√f'c ≤ 2,1 MPa (ăn mòn nghiêm trọng)"
            : "0,50√f'c ≤ 4,1 MPa (ăn mòn thông thường)"),
        '',
        'MPa',
        () => -ftl,
        2,
      ],
      { ok: ok54, 0: 'Kiểm toán', 1: '', 2: '' },
    ]),
  );
  P.push(
    cS(
      `dgi${k}C8`,
      'GIAI ĐOẠN 3 - GIỚI HẠN SỬ DỤNG III',
      [
        { n: 'Ứng suất ở mép trên của bản mặt cầu', f: (r) => r.fdIII, c: '#ff8080', mk: 'dia' },
        { n: 'Ứng suất ở mép trên của dầm', f: (r) => r.ftIII, c: '#ff0000', mk: 'sq' },
        { n: 'Ứng suất ở mép dưới của dầm', f: (r) => r.fbIIIT ?? r.fbIII, c: '#0000ff', mk: 'tri' },
      ],
      [
        { n: 'Ứng suất nén giới hạn của bản', f: () => L5.dkI, c: '#000000' },
        { n: 'Ứng suất nén giới hạn của dầm', f: () => L5.svI, c: '#663300' },
        { n: 'Ứng suất kéo giới hạn của dầm', f: () => -ftl, c: '#3333cc' },
      ],
    ),
  );
  P.push(gH3('5.5. Ứng suất nén khi chịu mỏi (Điều 5.5.3.1)'));
  P.push(
    gM(
      "f_{c} = 0.5\\,(f_{PS} + f_{DC,DW}) + f_{Mỏi\\,I} \\le 0.40\\,f'_c\\ ;\\quad M_{Mỏi\\,I} = 1.5\\,g_{f}\\,(1 + 0.15)\\,M_{xe\\ mỏi}",
      'gf',
      F(R.DF.Mf, 4),
      '',
    ),
  );
  P.push(
    gN(
      `gf - hệ số phân bố 1 làn không kể hệ số làn: hệ số gần đúng 1 làn (đã gồm m = 1,2) chia cho 1,2 (Điều 6.1.1.2 Phần 3). Bản in TCVN 11823-3, Điều 6.1.1.2 ghi "khi dùng hệ số phân phối gần đúng của 1 làn xe ... với quy tắc đòn bẩy và phương pháp tĩnh học, ứng lực phải được chia cho 1,20" là sai; đúng theo ${AAx}, Điều 3.6.1.1.2 là "other than the lever rule and statical method" (trừ khi dùng quy tắc đòn bẩy, phương pháp tĩnh học). Xe mỏi: 35 + 145 + 145 kN, khoảng cách trục sau 9,0 m.`,
    ),
  );
  P.push(
    gQ(res, 'Mỏi', [
      ['Mômen mỏi I', 'Mf', 'kN.m', (r) => r.Mfat, 1],
      ['Ứng suất nén thớ trên dầm', 'fc', 'MPa', (r) => r.ftFat, 2],
      ["Giới hạn 0,40f'c", '', 'MPa', () => L5.fat, 2],
      { ok: ok55, 0: 'Kiểm toán', 1: '', 2: '' },
    ]),
  );
  P.push(
    gT(
      'Ứng suất kéo ở trạng thái giới hạn Sử dụng III không vượt quá giới hạn Bảng 9 (mục 5.4) nên không cần kiểm toán mỏi của cáp và cốt thép (TCVN 11823-5, Điều 5.3.1).',
    ),
  );
  if (RX.length) {
    P.push(
      gH3(
        '5.6. Ứng suất tại các mặt cắt bổ sung (ngay sau chỗ đổi bước cốt đai, cuối đoạn vuốt sườn)',
      ),
    );
    P.push(
      gQ(RX, 'Ứng suất (MPa)', [
        ['Căng kéo: mép trên ; mép dưới', 'f1', 'MPa', (r) => F(r.s1t, 2) + ' ; ' + F(r.s1b, 2)],
        { ok: ok51, 0: 'Giai đoạn 1', 1: '', 2: '' },
        ['Đổ bản: mép trên ; mép dưới', 'f2', 'MPa', (r) => F(r.s2t, 2) + ' ; ' + F(r.s2b, 2)],
        { ok: ok52, 0: 'Giai đoạn 2', 1: '', 2: '' },
        [
          'Sử dụng I + TG: bản ; trên dầm ; dưới dầm',
          'f',
          'MPa',
          (r) => F(r.fdIT, 2) + ' ; ' + F(r.ftIT, 2) + ' ; ' + F(r.fbI + tgB2, 2),
        ],
        { ok: ok53, 0: 'Sử dụng I', 1: '', 2: '' },
        ['Sử dụng III + TG: mép dưới dầm', 'fb', 'MPa', (r) => r.fbIIIT ?? r.fbIII, 2],
        { ok: ok54, 0: 'Sử dụng III', 1: '', 2: '' },
        ['Mỏi: thớ trên dầm', 'fc', 'MPa', (r) => r.ftFat, 2],
        { ok: ok55, 0: 'Mỏi', 1: '', 2: '' },
      ]),
    );
  }
  const ok5 =
    RA.every(ok51) && RA.every(ok52) && RA.every(ok53) && RA.every(ok54) && RA.every(ok55);
  const ok5Rows: Array<[string, boolean]> = [
    ['Giai đoạn 1 - căng kéo', RA.every(ok51)],
    ['Giai đoạn 2 - đổ bản mặt cầu', RA.every(ok52)],
    ['Giai đoạn 3 - Sử dụng I', RA.every(ok53)],
    ['Giai đoạn 3 - Sử dụng III', RA.every(ok54)],
    ['Mỏi', RA.every(ok55)],
  ];
  P.push(
    `<table class="t dt"><tr><th colspan="8">Kiểm toán ứng suất</th><th colspan="2">KL</th></tr>` +
      ok5Rows
        .map(
          ([t, o]) =>
            `<tr><td class="l" colspan="8">${t}</td>${gOk(o).replace('<td', '<td colspan="2"')}</tr>`,
        )
        .join('') +
      gKL(ok5, 10) +
      `</table>`,
  );
  return P;
}

function giRenderSections6To12(
  k: 'g' | 'b',
  R: GiCalcResult,
  I: DamSpInput,
  G: GiInput,
  ctx: GiSummaryContext,
): string[] {
  const P: string[] = [];
  const F = gF;
  const res = R.res;
  const Lm = R.Lm;
  const { rs, ok6, ok6m, ok62, ok7, ok71, ok72, ok73, ok8, dmax, ok9, items } = ctx;

  // ======= 6. UỐN =======
  P.push(gH2(6, 'SỨC KHÁNG UỐN (TRẠNG THÁI GIỚI HẠN CƯỜNG ĐỘ I)'));
  P.push(
    gM(
      'f_{ps} = f_{pu}\\left(1 - k\\dfrac{c}{d_p}\\right)\\ ;\\quad k = 2\\left(1.04 - \\dfrac{f_{py}}{f_{pu}}\\right)\\quad(\\text{PT 23, 24})',
      'k',
      F(2 * (1.04 - I.fpyr), 3),
      '',
    ),
  );
  P.push(
    gT(
      "c xác định từ điều kiện cân bằng lực: Σ Aps.fps + As.fy = lực nén trong khối ứng suất chữ nhật α1.f'c.a (a = β1.c); phần trong bản mặt cầu dùng f'cs, β1 của bản; nếu a > ts phần trong dầm dùng f'c dầm với bề rộng dầm tại cao độ tương ứng (Điều 7.2.2, 7.3.2.2). α1 = 0,85.",
    ),
  );
  P.push(
    gM(
      'M_n = \\sum A_{ps}f_{ps}\\left(d_p - \\dfrac{a}{2}\\right) + A_sf_y\\left(d_s - \\dfrac{a}{2}\\right) - C\\cdot\\bar{y}_C\\ ;\\quad M_r = \\varphi M_n\\quad(\\text{PT 31, 32})',
      '',
      '',
      '',
    ),
  );
  P.push(
    gM(
      '\\varphi = 0.75 + \\dfrac{0.25(\\varepsilon_t - 0.002)}{0.005 - 0.002}\\ ,\\ 0.75 \\le \\varphi \\le 1.0\\ ;\\quad \\varepsilon_t = 0.003\\dfrac{d_t - c}{c}\\quad(\\text{PT 12})',
      '',
      '',
      '',
    ),
  );
  P.push(
    gQ(res, 'Mômen thiết kế', [
      ['Chiều cao mặt cắt liên hợp', 'hc', 'mm', () => R.hc, 0],
      ['Diện tích cáp dự ứng lực', 'Aps', 'mm2', (r) => r.Aps, 0],
      ['K.cách từ mép trên bản đến trọng tâm cáp', 'dp', 'mm', (r) => R.hc - r.ycg, 0],
      [
        'Cốt thép thường chịu kéo: As ; ds',
        'As ; ds',
        'mm2 ; mm',
        () => F(R.As, 0) + ' ; ' + F(R.hc - R.ys, 0),
      ],
      [
        'Bề rộng bản cánh chịu nén ; chiều dày bản',
        'b ; hf',
        'mm',
        () => F(R.beff, 0) + ' ; ' + F(R.hs, 0),
      ],
      ['K.cách từ thớ chịu nén ngoài cùng đến trục trung hòa', 'c', 'mm', (r) => r.c, 1],
      [
        'Chiều cao khối ứng suất chữ nhật tương đương',
        'a',
        'mm',
        (r) => F(r.a, 1) + (r.web ? '*' : ''),
      ],
      [
        'Ứng suất trung bình trong cáp dự ứng lực',
        'fps',
        'MPa',
        (r) => r.fps.reduce((t, q) => t + q.fps, 0) / Math.max(1, r.fps.length),
        1,
      ],
      [
        'Biến dạng cốt thép chịu kéo ngoài cùng ; hệ số',
        'εt ; φ',
        '',
        (r) => F(r.et, 4) + ' ; ' + F(r.phi, 3),
      ],
      ['Sức kháng uốn danh định', 'Mn', 'kN.m', (r) => r.Mn, 0],
      ['Sức kháng uốn tính toán', 'Mr', 'kN.m', (r) => r.Mr, 0],
      ['Mômen tính toán', 'Mu', 'kN.m', (r) => r.Mu, 0],
      { ok: ok6, 0: 'Kiểm toán sức kháng uốn Mr ≥ Mu', 1: '', 2: '' },
    ]),
  );
  if (res.some((r) => r.web)) {
    P.push(gT('(*) a > ts: vùng nén gồm toàn bộ bản mặt cầu và phần trên của dầm.'));
  }
  P.push(
    GID.chart({
      id: `dgi${k}C9`,
      title: 'GIAI ĐOẠN 3 - SỨC KHÁNG UỐN',
      xt: 'Khoảng cách (m)',
      yt: 'Mômen (kN.m)',
      series: [
        (() => {
          const m = gMir(R, (r) => r.Mr);
          return { n: 'Sức kháng uốn', x: m.x, y: m.y, c: '#663300', mk: 'sq', dash: true };
        })(),
        (() => {
          const m = gMir(R, (r) => r.Mu);
          return { n: 'Mômen tính toán', x: m.x, y: m.y, c: '#3333cc', mk: 'tri' };
        })(),
      ],
      xmin: 0,
      xmax: Lm,
      ymin: 0,
    }),
  );
  P.push(gH3('6.1. Lượng cốt thép tối thiểu (Điều 7.3.3.2)'));
  P.push(
    gM(
      'M_{cr} = \\gamma_3\\left[(\\gamma_1 f_r + \\gamma_2 f_{cpe})S_c - M_{dnc}\\left(\\dfrac{S_c}{S_{nc}} - 1\\right)\\right]\\ ;\\quad M_r \\ge \\min(M_{cr}\\,;\\ 1.33M_u)\\quad(\\text{PT 33})',
      'γ1 ; γ2 ; γ3',
      F(I.g1, 1) + ' ; ' + F(I.g2, 1) + ' ; ' + F(I.g3, 2),
      '',
    ),
  );
  P.push(
    gN(
      `γ1 = 1,6 cho dầm I đúc sẵn (không thi công phân đoạn). Bản in TCVN 11823-5, Điều 7.3.3.2 ghi "γ1 = 1,2 cho kết cấu đúc sẵn lắp ghép" là dịch sai; đúng theo ${AAx}, Điều 5.7.3.3.2 là "1.2 for precast segmental structures" (kết cấu đúc sẵn thi công phân đoạn). γ2 = 1,1 cho cáp dính bám ; γ3 = 1,0 cho kết cấu bê tông dự ứng lực. fcpe - ứng suất nén thớ dưới do dự ứng lực có hiệu ; Mdnc - mômen do tĩnh tải trên mặt cắt không liên hợp (DC1 + DC2).`,
    ),
  );
  P.push(
    gQ(
      res.filter((r) => r.x > 0),
      'Mômen nứt',
      [
        ["Cường độ chịu kéo khi uốn fr = 0,63√f'c", 'fr', 'MPa', () => 0.63 * Math.sqrt(I.fc), 3],
        ['Ứng suất nén thớ dưới do dự ứng lực có hiệu', 'fcpe', 'MPa', (r) => r.fcpe, 2],
        ['Mômen do tĩnh tải trên mặt cắt không liên hợp', 'Mdnc', 'kN.m', (r) => r.Mdnc, 1],
        [
          'Mômen kháng uốn thớ dưới: liên hợp ; không liên hợp',
          'Sc ; Snc',
          'm3',
          (r) => F(r.Scm / 1e9, 4) + ' ; ' + F(r.Snc / 1e9, 4),
        ],
        ['Mômen nứt', 'Mcr', 'kN.m', (r) => r.Mcr, 0],
        ['1,33Mu', '', 'kN.m', (r) => 1.33 * r.Mu, 0],
        ['Sức kháng uốn tính toán', 'Mr', 'kN.m', (r) => r.Mr, 0],
        { ok: ok6m, 0: 'Kiểm toán Mr ≥ min(Mcr ; 1,33Mu)', 1: '', 2: '' },
      ],
    ),
  );
  P.push(
    gH3(
      '6.2. Dầm chưa liên hợp chịu tải trọng khi đổ bản mặt cầu (TCVN 11823-1, Điều 2.5.3 khả năng thi công)',
    ),
  );
  P.push(
    gT(
      "Vùng nén nằm trong cánh trên dầm (f'c dầm, bề rộng dầm tại cao độ tương ứng); Mu = 1,25(MDC1 + MDC2):",
    ),
  );
  P.push(
    gQ(
      res.filter((r) => r.x > 0),
      'Dầm chưa liên hợp',
      [
        ['K.cách từ thớ nén đến trục trung hòa', 'c', 'mm', (r) => r.cN, 1],
        ['Hệ số sức kháng', 'φ', '', (r) => r.phiN, 3],
        ['Sức kháng uốn tính toán', 'Mr', 'kN.m', (r) => r.MrN, 0],
        ['Mômen tính toán', 'Mu', 'kN.m', (r) => r.MuN, 0],
        { ok: ok62, 0: 'Kiểm toán', 1: '', 2: '' },
      ],
    ),
  );
  const okU = res.every(ok6) && res.every(ok6m) && res.filter((r) => r.x > 0).every(ok62);
  const okURows: Array<[string, boolean]> = [
    ['Sức kháng uốn Mr ≥ Mu', res.every(ok6)],
    ['Cốt thép tối thiểu', res.every(ok6m)],
    ['Dầm chưa liên hợp khi đổ bản', res.filter((r) => r.x > 0).every(ok62)],
  ];
  P.push(
    `<table class="t dt"><tr><th colspan="8">Kiểm toán sức kháng uốn</th><th colspan="2">KL</th></tr>` +
      okURows
        .map(
          ([t, o]) =>
            `<tr><td class="l" colspan="8">${t}</td>${gOk(o).replace('<td', '<td colspan="2"')}</tr>`,
        )
        .join('') +
      gKL(okU, 10) +
      `</table>`,
  );

  // ======= 7. CẮT VÀ XOẮN =======
  P.push(gH2(7, 'SỨC KHÁNG CẮT VÀ XOẮN (TRẠNG THÁI GIỚI HẠN CƯỜNG ĐỘ I)'));
  P.push(
    gT(
      `Mặt cắt tới hạn về cắt cách mép gối một khoảng dv (Điều 8.3.2): x = bg/2 + dv = ${F(R.xv / 1000, 3)} m. Phương pháp tổng quát (Điều 8.3.4.2), công thức cho β, θ:`,
    ),
  );
  P.push(
    gM(
      'd_e = \\dfrac{A_{ps}f_{ps}d_p + A_sf_yd_s}{A_{ps}f_{ps} + A_sf_y}\\ ;\\quad d_v = \\max\\left(d_e - \\dfrac{a}{2}\\ ;\\ 0.9d_e\\ ;\\ 0.72h\\right)\\quad(\\text{PT 71})',
      '',
      '',
      '',
    ),
  );
  P.push(
    gT(
      'bv - bề rộng bụng nhỏ nhất trong phạm vi dv, trừ 1/4 đường kính ống ghen có bơm vữa tại cao độ đó (Điều 8.2.9). Aps - cáp nằm ở nửa chịu kéo do uốn của mặt cắt.',
    ),
  );
  P.push(
    gM(
      '\\varepsilon_s = \\dfrac{\\dfrac{|M_u|}{d_v} + 0.5N_u + |V_u - V_p| - A_{ps}f_{po}}{E_sA_s + E_pA_{ps}}\\ ;\\quad |M_u| \\ge |V_u - V_p|\\,d_v\\ ;\\quad f_{po} = 0.7f_{pu}\\quad(\\text{PT 80})',
      '',
      '',
      '',
    ),
  );
  P.push(
    gN(
      `PT 80: bản in TCVN ghi 0,5|Vu - Vp| là sai; đúng theo ${AAx}, PT 5.8.3.4.2-4 là |Vu - Vp|. Khi εs < 0 tính lại với mẫu số EsAs + EpAps + EcAct, εs ≥ -0,4.10⁻³; εs ≤ 6.10⁻³.`,
    ),
  );
  P.push(
    gM(
      '\\beta = \\dfrac{4.8}{1 + 750\\varepsilon_s}\\ ;\\quad \\theta = 29 + 3500\\varepsilon_s\\quad(\\text{PT 77, 79})',
      '',
      '',
      '',
    ),
  );
  P.push(
    gM(
      "V_c = 0.083\\beta\\sqrt{f'_c}\\,b_vd_v\\ ;\\quad V_s = \\dfrac{A_vf_yd_v\\cot\\theta}{s}\\ ;\\quad V_n = \\min\\left(V_c + V_s + V_p\\ ;\\ 0.25f'_cb_vd_v + V_p\\right)\\ ;\\quad V_r = 0.9V_n\\quad(\\text{PT 72, 73, 75})",
      '',
      '',
      '',
    ),
  );
  P.push(
    gQ(rs, 'Lực cắt thiết kế', [
      ['Lực cắt tính toán', 'Vu', 'kN', (r) => r.Vu, 1],
      ['Mômen tính toán tương ứng', 'Mu', 'kN.m', (r) => r.Mu, 1],
      ['Thành phần lực cáp hữu hiệu theo phương lực cắt', 'Vp', 'kN', (r) => r.Vp, 1],
      ['Chiều cao chịu cắt có hiệu', 'dv', 'mm', (r) => r.dv, 0],
      ['Bề rộng sườn có hiệu', 'bv', 'mm', (r) => r.bv, 0],
      ['Ứng biến dọc trong cốt thép chịu kéo', 'εs.10³', '', (r) => r.es, 4],
      ['Hệ số chỉ khả năng bê tông bị nứt chéo truyền lực kéo', 'β', '', (r) => r.beta, 3],
      ['Góc nghiêng ứng suất nén chéo', 'θ', 'độ', (r) => r.th, 2],
      [
        'Cốt đai: số nhánh ; Av (mm2) ; s (mm)',
        'nv ; Av ; s',
        '',
        (r) => F(r.nv, 0) + ' ; ' + F(r.Av, 0) + ' ; ' + F(r.s, 0),
      ],
      ['Sức kháng cắt danh định của bê tông', 'Vc', 'kN', (r) => r.Vc, 0],
      ['Sức kháng cắt của cốt thép chịu cắt', 'Vs', 'kN', (r) => r.Vs, 0],
      ['Sức kháng cắt danh định', 'Vn', 'kN', (r) => r.Vn, 0],
      ['Sức kháng cắt tính toán', 'Vr', 'kN', (r) => r.Vr, 0],
      { ok: ok7, 0: 'Kiểm toán Vu ≤ Vr', 1: '', 2: '' },
    ]),
  );
  P.push(
    GID.chart({
      id: `dgi${k}C10`,
      title: 'GIAI ĐOẠN 3 - SỨC KHÁNG CẮT',
      xt: 'Khoảng cách (m)',
      yt: 'Lực cắt (kN)',
      series: [
        (() => {
          const m = gMir(R, (r) => r.Vr);
          return { n: 'Sức kháng cắt', x: m.x, y: m.y, c: '#663300', mk: 'sq', dash: true };
        })(),
        (() => {
          const m = gMir(R, (r) => r.Vu);
          return { n: 'Lực cắt tính toán', x: m.x, y: m.y, c: '#3333cc', mk: 'tri' };
        })(),
      ],
      xmin: 0,
      xmax: Lm,
      ymin: 0,
    }),
  );
  P.push(gH3('7.1. Cốt thép ngang tối thiểu, cự ly tối đa (Điều 8.2.5, 8.2.7)'));
  P.push(
    gM(
      "A_{v,min} = 0.083\\sqrt{f'_c}\\dfrac{b_v\\,s}{f_y}\\ ;\\quad v_u = \\dfrac{|V_u - \\varphi V_p|}{\\varphi\\,b_vd_v}\\ ;\\ v_u < 0.125f'_c:\\ s_{max} = 0.8d_v \\le 600\\ ;\\ v_u \\ge 0.125f'_c:\\ s_{max} = 0.4d_v \\le 300\\quad(\\text{PT 66, 68 - 70})",
      '',
      '',
      '',
    ),
  );
  P.push(
    gQ(rs, 'Cốt thép ngang', [
      ['Diện tích cốt đai trong cự ly s', 'Av', 'mm2', (r) => r.Av, 0],
      ['Diện tích cốt đai tối thiểu', 'Av,min', 'mm2', (r) => r.Avmin, 0],
      ['Ứng suất cắt', 'vu', 'MPa', (r) => r.vu, 3],
      ["0,125f'c", '', 'MPa', () => 0.125 * I.fc, 3],
      ['Cự ly cốt đai: bố trí ; tối đa', 's ; smax', 'mm', (r) => F(r.s, 0) + ' ; ' + F(r.smax, 0)],
      { ok: ok71, 0: 'Kiểm toán', 1: '', 2: '' },
    ]),
  );
  P.push(gH3('7.2. Cốt thép dọc chịu kéo do lực cắt (Điều 8.3.5)'));
  P.push(
    gM(
      'A_{ps}f_{ps} + A_sf_y \\ge \\dfrac{|M_u|}{d_v\\varphi_f} + \\left(\\left|\\dfrac{V_u}{\\varphi_v} - V_p\\right| - 0.5V_s\\right)\\cot\\theta\\quad(\\text{PT 90})',
      '',
      '',
      '',
    ),
  );
  P.push(
    gQ(rs, 'Cốt thép dọc', [
      ['Lực kéo yêu cầu', 'Treq', 'kN', (r) => r.Treq, 0],
      ['Khả năng chịu kéo ΣAps.fps + As.fy', 'Tprov', 'kN', (r) => r.Tprov, 0],
      { ok: ok72, 0: 'Kiểm toán', 1: '', 2: '' },
    ]),
  );
  P.push(gT('Cáp căng sau được neo tại đầu dầm nên phát triển đủ ứng suất ở mọi mặt cắt.'));
  P.push(gH3('7.3. Xoắn (Điều 8.2.1)'));
  P.push(
    gM(
      "T_{cr} = 0.328\\sqrt{f'_c}\\,\\dfrac{A_{cp}^2}{p_c}\\sqrt{1 + \\dfrac{f_{pc}}{0.328\\sqrt{f'_c}}}\\ ;\\quad \\text{bỏ qua xoắn khi } T_u \\le 0.25\\varphi T_{cr}\\quad(\\text{PT 60, 61})",
      'Tu',
      F(G.Tu || 0, 1),
      'kN.m',
    ),
  );
  P.push(
    gQ(rs, 'Xoắn', [
      ['Ứng suất nén tại trọng tâm mặt cắt liên hợp do dự ứng lực', 'fpc', 'MPa', (r) => r.fpc, 2],
      [
        'Diện tích bao bởi chu vi ngoài ; chu vi ngoài',
        'Acp ; pc',
        'm2 ; mm',
        (r) => F(r.Acp / 1e6, 4) + ' ; ' + F(r.Pc3, 0),
      ],
      ['Mômen nứt do xoắn', 'Tcr', 'kN.m', (r) => r.Tcr, 0],
      ['0,25φTcr', '', 'kN.m', (r) => 0.225 * r.Tcr, 0],
      ['Mômen xoắn tính toán', 'Tu', 'kN.m', (r) => r.Tu, 1],
      { ok: ok73, 0: 'Bỏ qua hiệu ứng xoắn', 1: '', 2: '' },
    ]),
  );
  P.push(
    GID.chart({
      id: `dgi${k}C11`,
      title: 'GIAI ĐOẠN 3 - SỨC KHÁNG XOẮN',
      xt: 'Khoảng cách (m)',
      yt: 'Mômen xoắn (kN.m)',
      series: [
        (() => {
          const m = gMir(R, (r) => 0.225 * r.Tcr);
          return {
            n: 'Giới hạn bỏ qua xoắn 0,25φTcr',
            x: m.x,
            y: m.y,
            c: '#663300',
            mk: 'sq',
            dash: true,
          };
        })(),
        (() => {
          const m = gMir(R, (r) => r.Tu);
          return { n: 'Mômen xoắn tính toán', x: m.x, y: m.y, c: '#3333cc', mk: 'tri' };
        })(),
      ],
      xmin: 0,
      xmax: Lm,
      ymin: 0,
    }),
  );
  if (!rs.every(ok73)) {
    P.push(
      gN(
        'Tu > 0,25φTcr: phải thiết kế cốt thép chịu xoắn theo Điều 8.3.6 (chưa có trong bảng tính này).',
      ),
    );
  }
  const okV = rs.every(ok7) && rs.every(ok71) && rs.every(ok72) && rs.every(ok73);
  const okVRows: Array<[string, boolean]> = [
    ['Sức kháng cắt Vu ≤ Vr', rs.every(ok7)],
    ['Cốt thép ngang tối thiểu, cự ly tối đa', rs.every(ok71)],
    ['Cốt thép dọc chịu kéo do cắt', rs.every(ok72)],
    ['Xoắn', rs.every(ok73)],
  ];
  P.push(
    `<table class="t dt"><tr><th colspan="8">Kiểm toán cắt và xoắn</th><th colspan="2">KL</th></tr>` +
      okVRows
        .map(
          ([t, o]) =>
            `<tr><td class="l" colspan="8">${t}</td>${gOk(o).replace('<td', '<td colspan="2"')}</tr>`,
        )
        .join('') +
      gKL(okV, 10) +
      `</table>`,
  );

  // ======= 8. CẮT TRƯỢT =======
  const IF = R.IF;
  P.push(gH2(8, 'TRUYỀN LỰC CẮT QUA MẶT TIẾP XÚC DẦM - BẢN MẶT CẦU (Điều 8.4)'));
  P.push(
    gR(
      `${IF.t} (Điều 8.4.3)`,
      'c ; μ ; K1 ; K2',
      `${F(IF.c, 2)} ; ${F(IF.mu, 1)} ; ${F(IF.K1, 1)} ; ${F(IF.K2, 1)}`,
      'MPa ; - ; - ; MPa',
    ),
  );
  P.push(
    gM(
      "V_{ui} = \\dfrac{V_u}{d_v}\\ ;\\quad V_{ni} = cA_{cv} + \\mu\\left(A_{vf}f_y + P_c\\right) \\le \\min\\left(K_1f'_{cs}A_{cv}\\ ;\\ K_2A_{cv}\\right)\\ ;\\quad V_{ri} = 0.9V_{ni} \\ge V_{ui}\\quad(\\text{PT 95 - 101})",
      '',
      '',
      '',
    ),
  );
  P.push(
    gT(
      `dv - khoảng cách từ trọng tâm cốt thép chịu kéo đến giữa chiều dày bản (Điều 8.4.2); Avf - ${G.cn > 0 ? 'cốt thép chờ ' + G.cn + ' nhánh Φ' + F(G.cd, 0) : 'các nhánh cốt đai kéo dài vào bản'} trong cự ly s; Acv = bvi = b4 = ${F(G.b4, 0)} mm trên 1 mm dài; fy ≤ 420 MPa, cự ly cốt thép qua mặt tiếp xúc ≤ 600 mm (Điều 8.4.1, 8.4.2); Pc - lực nén thường xuyên vuông góc mặt tiếp xúc (bản mặt cầu, gờ lan can, lớp phủ) = ${F(res[0].Pc, 3)} kN/m; Avf ≥ 0,35Acv/fy (PT 104).`,
    ),
  );
  P.push(
    gQ(
      rs,
      'Cắt trượt mặt tiếp xúc',
      [
        ['Lực cắt tính toán', 'Vu', 'kN', (r) => r.Vu, 1],
        ['Chiều cao có hiệu', 'dv', 'mm', (r) => r.dvi, 0],
        ['Lực cắt trên 1 đơn vị chiều dài', 'Vui', 'kN/m', (r) => r.Vui, 1],
        ['Cự ly cốt thép qua mặt tiếp xúc', 's', 'mm', (r) => r.s, 0],
        [
          'Diện tích cốt thép qua mặt tiếp xúc ; tối thiểu',
          'Avf',
          'mm2/m',
          (r) => F(r.Avf * 1000, 0) + ' ; ' + F(r.Avfmin * 1000, 0),
        ],
        ['Sức kháng cắt danh định', 'Vni', 'kN/m', (r) => r.Vni, 1],
        ['Sức kháng cắt tính toán', 'Vri', 'kN/m', (r) => r.Vri, 1],
        { ok: ok8, 0: 'Kiểm toán', 1: '', 2: '' },
      ],
      gKL(rs.every(ok8), 11),
    ),
  );

  // ======= 9. ĐỘ VỒNG, ĐỘ VÕNG =======
  const C = R.camber;
  P.push(gH2(9, 'ĐỘ VỒNG VÀ ĐỘ VÕNG'));
  P.push(GID.cam(`dgi${k}Cam`));
  P.push(
    gT(
      'Độ vồng khi căng kéo: dầm kê trên bệ đúc (nhịp Lt), tích phân độ cong dọc dầm (lực dự ứng lực sau ma sát, tụt neo, co ngắn đàn hồi; mặt cắt giai đoạn 1; mô đun Eci):',
    ),
  );
  P.push(
    gM(
      '\\delta = \\int_0^{L_t}\\dfrac{P_t(x)\\,e(x) - M_{DC1}(x)}{E_{ci}I_1(x)}\\,\\bar m(x)\\,dx',
      'δ0',
      F(C.d0, 1),
      'mm',
    ),
  );
  P.push(
    gR('Trong đó: vồng do dự ứng lực', 'δp', F(C.dps, 1), 'mm'),
    gR('võng do trọng lượng bản thân dầm', 'δg', F(C.dsw, 1), 'mm'),
  );
  P.push(
    gT(
      'Độ vồng trước khi đổ bản mặt cầu: kể từ biến bê tông dầm và phần độ vồng mất đi do mất mát dài hạn giai đoạn id, hệ số già hóa 0,7:',
    ),
  );
  P.push(
    gR('Tỷ số mất mát dài hạn trước khi đổ bản ΔfpLT,id / fpt (giữa nhịp)', 'rLT', F(C.rLT, 4), ''),
  );
  P.push(
    gM(
      '\\delta_{td} = \\delta_0\\left[1 + \\psi_b(t_d,t_i)\\right] - \\delta_p\\,\\dfrac{\\Delta f_{pLT,id}}{f_{pt}}\\left[1 + 0.7\\psi_b(t_d,t_i)\\right]',
      'δtd',
      F(C.dtd, 1),
      'mm',
    ),
  );
  P.push(
    gM(
      '\\delta_{b2} = \\dfrac{5\\,DC_2\\,L_s^4}{384\\,E_cI_2} + \\sum\\dfrac{P_{dn}a(3L_s^2 - 4a^2)}{48E_cI_2}',
      'δb2',
      F(C.dDk2, 1),
      'mm',
    ),
  );
  P.push(
    gM('\\delta_{b3} = \\dfrac{5\\,(DC_3 + DW)\\,L_s^4}{384\\,E_cI_3}', 'δb3', F(C.dDk3, 1), 'mm'),
  );
  P.push(
    gT('Độ vồng còn lại của dầm sau khi đổ bản mặt cầu và hoàn thiện (khống chế cao độ mặt cầu):'),
  );
  P.push(
    gM(
      '\\delta_f = \\delta_{td} - \\delta_{b2} - \\delta_{b3}',
      'δf',
      F(C.dtd - C.dDk2 - C.dDk3, 1),
      'mm',
    ),
  );
  P.push(
    gT(
      'Độ võng do hoạt tải (TCVN 11823-3, Điều 6.1.3.2; TCVN 11823-2, Điều 5.2.6.2): xếp tất cả các làn, các dầm võng như nhau, g = nL.m/Nb; lấy giá trị lớn hơn của xe tải thiết kế, hoặc 25% xe tải + tải trọng làn; có kể lực xung kích; mặt cắt liên hợp, Ec:',
    ),
  );
  P.push(gM('g_\\delta = \\dfrac{n_L\\,m}{N_b}', 'gδ', F(C.DFd, 4), ''));
  P.push(
    gR('Do xe tải thiết kế (kể IM)', 'δ1', F(C.dLL1, 2), 'mm'),
    gR('Do 25% xe tải + tải trọng làn', 'δ2', F(C.dLL2, 2), 'mm'),
  );
  P.push(
    gR(`Độ võng cho phép Ls/${F(I.dlim, 0)}`, '[δ]', F(C.lim, 2), 'mm', [
      ok9,
      (ok9 ? 'OK' : 'NG') + ': max = ' + F(dmax, 2),
    ]),
  );
  P.push(
    `<table class="t dt"><tr><th colspan="8">Kiểm toán độ võng do hoạt tải</th><th colspan="2">KL</th></tr>` +
      gKL(ok9, 10) +
      `</table>`,
  );

  // ======= 10. VÙNG NEO =======
  P.push(giAncHtml(k, R, I, G));

  // ======= 11. ĐỘ GIÃN DÀI =======
  P.push(gH2(11, 'ĐỘ GIÃN DÀI CỦA CÁP KHI CĂNG KÉO'));
  P.push(
    gT(
      'Độ giãn dài tính toán của bó cáp (kéo hai đầu) bằng tích phân ứng suất do ma sát dọc chiều dài cáp (trước khi đóng neo), chưa kể chiều dài tự do trong kích; dùng để kiểm soát lực căng khi thi công cùng với số đọc đồng hồ kích:',
    ),
  );
  P.push(gM('\\Delta L = \\dfrac{1}{E_p}\\int_0^{L_c} f_F(x)\\,dx', '', '', ''));
  P.push(
    `<table class="t dt"><tr><th>Cáp</th><th>Chiều dài cáp (m)</th><th>Ứng suất trung bình (MPa)</th><th>Lực kích 1 đầu (kN)</th><th>ΔL tổng (mm)</th><th>ΔL mỗi đầu (mm)</th></tr>` +
      R.T.map(
        (t) =>
          `<tr><td class="c">${t.i}</td><td>${F(t.len / 1000, 3)}</td><td>${F((t.elong * I.Ep) / t.len, 1)}</td><td>${F((R.fpj * R.Apc) / 1e3, 1)}</td><td>${F(t.elong, 1)}</td><td>${F(t.elong / 2, 1)}</td></tr>`,
      ).join('') +
      `</table>`,
  );

  // ======= 12. PHẢN LỰC GỐI, TỔNG HỢP =======
  P.push(gH2(12, 'PHẢN LỰC GỐI VÀ TỔNG HỢP KẾT QUẢ'));
  P.push(
    gR('Phản lực gối do tĩnh tải DC (1 dầm, 1 đầu)', 'RDC', F(R.Rg.DC, 1), 'kN'),
    gR('Phản lực gối do tĩnh tải DW (1 dầm, 1 đầu)', 'RDW', F(R.Rg.DW, 1), 'kN'),
    gR('Phản lực gối do hoạt tải (kể IM, g, PL)', 'RLL', F(res[0].VLL, 1), 'kN'),
  );
  P.push(
    `<table class="t dt"><tr><th colspan="5">Hạng mục kiểm toán</th><th colspan="2">Giá trị bất lợi</th><th colspan="2">Giới hạn</th><th>KL</th></tr>` +
      items
        .map(
          (it) =>
            `<tr><td class="l" colspan="5">${it[0]}</td><td colspan="2">${typeof it[1] === 'number' ? F(it[1], 3) : it[1]}</td><td class="c" colspan="2">${it[2]}</td>${gOk(it[3])}</tr>`,
        )
        .join('') +
      gKL(Boolean(R.allOK), 10) +
      `</table>`,
  );
  P.push(
    gN(
      'Chưa có trong bảng tính này: cẩu lắp dầm, bản mặt cầu phần hẫng chịu va xe (xem sheet bản mặt cầu).',
    ),
  );
  return P;
}

export function giRender(
  k: 'g' | 'b',
  R: GiCalcResult,
  I: DamSpInput,
  G: GiInput,
  LIM: DamLimits,
  RR: Partial<Record<'g' | 'b', GiCalcResult>> = {},
): string {
  const ctx = evalGiSummary(R, I, LIM);
  const cS = (
    id: string,
    title: string,
    ser: Array<{ n: string; f: (r: GiSectionRes) => number; c: string; mk?: string }>,
    lims: Array<{ n: string; f: (r: GiSectionRes) => number; c: string }>,
  ): string =>
    GID.chart({
      id,
      title,
      xt: 'Khoảng cách (m)',
      yt: 'Ứng suất (MPa)',
      series: [
        ...ser.map((o) => {
          const m = gMir(R, o.f);
          return { n: o.n, x: m.x, y: m.y, c: o.c, mk: o.mk };
        }),
        ...lims.map((o) => {
          const m = gMir(R, o.f);
          return { n: o.n, x: m.x, y: m.y, c: o.c, dash: true };
        }),
      ],
      xmin: 0,
      xmax: R.Lm,
    });
  const P = giRenderSections1To5(k, R, I, G, RR, ctx, cS);
  P.push(...giRenderSections6To12(k, R, I, G, ctx));
  return P.join('\n');
}

// ============================================================================
// DOM Mount, Orchestration Step, Abutment Link, TeX Reflow & Bridge Result Converters
// ============================================================================

export function giMount(pane: string, afterEl: Element | null, html: string): void {
  if (typeof document === 'undefined') return;
  const p = document.getElementById(pane);
  if (!p) return;
  p.querySelectorAll(':scope > .giDyn').forEach((e) => e.remove());
  const t = document.createElement('template');
  t.innerHTML = html;
  const nodes = Array.from(t.content.children) as HTMLElement[];
  nodes.forEach((n) => {
    n.classList.add('giDyn');
    n.dataset.sp = 'I';
    n.dataset.np0 = '0';
  });
  if (afterEl && afterEl.parentNode === p) {
    const ref = afterEl.nextSibling;
    nodes.forEach((n) => p.insertBefore(n, ref));
  } else {
    nodes.forEach((n) => p.appendChild(n));
  }
}

interface MathJaxLike {
  tex2svg?: (tex: string, options?: { display?: boolean }) => Element;
}

function getMathJax(): MathJaxLike | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { MathJax?: MathJaxLike }).MathJax;
}

const GIW = new Map<string, number>();

export function giTexW(t: string): number {
  const cached = GIW.get(t);
  if (cached !== undefined) return cached;
  let w = 0;
  try {
    const mj = getMathJax();
    const sv = mj?.tex2svg?.(t, { display: false }).querySelector('svg');
    w = parseFloat(sv?.getAttribute('width') || '0') || 0;
  } catch {
    w = 0;
  }
  GIW.set(t, w);
  return w;
}

export function giSplitTex(t: string): string[] {
  const seps = ['\\ ;\\quad', '\\ ;\\ ', ';\\quad', '\\ ;'];
  const out: string[] = [];
  let d = 0;
  let last = 0;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (c === '\\') {
      if (t.startsWith('\\left', i)) {
        d++;
        i += 4;
        continue;
      }
      if (t.startsWith('\\right', i)) {
        d--;
        i += 5;
        continue;
      }
      if (d === 0) {
        const sp = seps.find((x) => t.startsWith(x, i));
        if (sp) {
          out.push(t.slice(last, i));
          last = i + sp.length;
          i = last - 1;
          continue;
        }
      }
      i++;
      continue;
    }
    if (c === '{') d++;
    else if (c === '}') d--;
    if (d === 0 && c === ';' && t.startsWith(';\\quad', i)) {
      out.push(t.slice(last, i));
      last = i + 6;
      i = last - 1;
    }
  }
  out.push(t.slice(last));
  return out.map((x) => x.trim()).filter(Boolean);
}

export function giFit(): boolean {
  const mj = getMathJax();
  if (typeof document === 'undefined' || !mj?.tex2svg) return false;
  let ch = false;
  const rows = Array.from(
    document.querySelectorAll<HTMLElement>('.row.f[data-sp="I"],.row.f[data-sp="RC"]'),
  );
  rows.forEach((row) => {
    const m = row.querySelector<HTMLElement>('.m');
    if (!m || !m.dataset.tex) return;
    const fs = parseFloat(getComputedStyle(row).fontSize) || 15;
    const ex = fs * 0.459;
    const tex = m.dataset.tex;
    const w = giTexW(tex) * ex;
    const rest = Array.from(row.children).slice(2);
    const hasVal = rest.some((c) => (c.textContent ?? '').trim() !== '');
    const mk = (cls: string): HTMLDivElement => {
      const n = document.createElement('div');
      n.className = cls;
      n.dataset.sp = row.dataset.sp || 'I';
      n.dataset.np0 = '0';
      if (row.classList.contains('giDyn')) n.classList.add('giDyn');
      n.hidden = row.hidden;
      n.toggleAttribute('hidden', row.hidden);
      return n;
    };
    if (hasVal && w > 300) {
      const v = mk('row');
      v.appendChild(document.createElement('span'));
      v.appendChild(document.createElement('span'));
      rest.forEach((c) => v.appendChild(c));
      row.after(v);
      ch = true;
    } else if (!hasVal) {
      rest.forEach((c) => c.remove());
    }
    if (w <= 690) return;
    const parts = giSplitTex(tex);
    if (parts.length < 2) return;
    const lines: string[] = [];
    let cur: string[] = [];
    parts.forEach((pt) => {
      const tryT = [...cur, pt].join('\\ ;\\quad ');
      if (cur.length && giTexW(tryT) * ex > 690) {
        lines.push(cur.join('\\ ;\\quad '));
        cur = [pt];
      } else {
        cur.push(pt);
      }
    });
    if (cur.length) lines.push(cur.join('\\ ;\\quad '));
    if (lines.length < 2) return;
    m.dataset.tex = lines[0];
    m.dataset.r = '';
    let ref: Element = row;
    lines.slice(1).forEach((L) => {
      const n = mk('row f');
      n.innerHTML = `<span></span><span><span class="m" data-tex="${giE(L)}"></span></span>`;
      ref.after(n);
      ref = n;
    });
    ch = true;
  });
  return ch;
}

export function giStep(
  I?: DamSpInput,
  LIM?: DamLimits,
  options?: GirderHollowStepOptions,
): GiCompositeResult | undefined {
  const err = $('sp_err');
  if (err) err.textContent = '';

  const effI = I ?? spInputs(options);
  const effLIM = LIM ?? getLatestLim() ?? evalDamLimits(effI);
  if (!LIM) setLatestLim(effLIM);

  let G0: GiInput;
  try {
    G0 = giInputs();
  } catch (e) {
    if (err) err.textContent = 'Lỗi đọc số liệu dầm I: ' + (e as Error).message;
    return undefined;
  }
  if (!G0.cab.length || !G0.sz.length || !(G0.H > 0)) {
    if (err) err.textContent = 'Thiếu số liệu kích thước / cáp / cốt đai của dầm I.';
    return undefined;
  }

  const RR: Partial<Record<'g' | 'b', GiCalcResult>> = {};
  for (const k of ['g', 'b'] as const) {
    try {
      RR[k] = GI.calc(effI, { ...G0, kind: k === 'g' ? 'giua' : 'bien' });
    } catch (e) {
      console.error(e);
      if (err) err.textContent = 'Lỗi tính dầm I: ' + (e as Error).message;
      return undefined;
    }
  }
  const gRes = RR.g!;
  const bRes = RR.b!;

  for (const k of ['g', 'b'] as const) {
    const R = k === 'g' ? gRes : bRes;
    let h = '';
    try {
      h = giRender(k, R, effI, G0, effLIM, RR);
    } catch (e) {
      console.error(e);
      h = `<p class="small bad">Lỗi trình bày: ${giE((e as Error).message)}</p>`;
    }
    const mk8 = k === 'g' && typeof document !== 'undefined' ? document.getElementById('giMk8') : null;
    giMount(k === 'g' ? 'tab8' : 'tab9', mk8, h);
  }

  // Hình vẽ, bảng ở phần số liệu (sheet dầm giữa)
  if (typeof document !== 'undefined') {
    try {
      const sv = document.getElementById('dgiSec');
      if (sv) sv.outerHTML = GID.sec('dgiSec', G0, gRes).replace('<svg ', '<svg data-sp="I" ');
    } catch (e) {
      console.error(e);
    }
    try {
      const sv = document.getElementById('dgiCab');
      if (sv) sv.outerHTML = GID.cab('dgiCab', G0, gRes).replace('<svg ', '<svg data-sp="I" ');
    } catch (e) {
      console.error(e);
    }
  }

  const tc = $('tbiCab');
  if (tc) tc.innerHTML = giCabTable(G0, gRes).replace(/^<table[^>]*>|<\/table>$/g, '');
  const ts = $('tbiStir');
  if (ts) {
    ts.innerHTML =
      `<tr><th colspan="3">Vùng cốt đai (từ đầu dầm)</th><th colspan="2">Từ (m)</th><th colspan="2">Đến (m)</th><th>Bước s (mm)</th><th>Số nhánh</th><th>Av (mm2)</th></tr>` +
      G0.sz
        .map((z, i) => {
          const nv = z.length > 3 && (z[3] ?? 0) > 0 ? (z[3] ?? G0.sn) : G0.sn;
          return `<tr><td class="c" colspan="3">${i + 1}</td><td colspan="2">${fx(z[0] / 1000, 3)}</td><td colspan="2">${fx(z[1] / 1000, 3)}</td><td>${fx(z[2], 0)}</td><td>${fx(nv, 0)}</td><td>${fx((nv * PI * G0.sd ** 2) / 4, 0)}</td></tr>`;
        })
        .join('') +
      `<tr><td class="l" colspan="10">Cốt đai Φ${fx(G0.sd, 0)} ; cốt thép qua mặt tiếp xúc dầm - bản: ${G0.cn > 0 ? G0.cn + ' nhánh Φ' + fx(G0.cd, 0) + ', cùng bước cốt đai' : 'các nhánh cốt đai kéo dài vào bản mặt cầu'}.</td></tr>`;
  }
  const td = $('tbiDn');
  if (td) {
    td.innerHTML =
      `<tr><th colspan="3">Dầm ngang</th><th colspan="2">x (m)</th><th colspan="2">V (m3)</th><th colspan="2">P dầm giữa (kN)</th><th>P dầm biên (kN)</th></tr>` +
      G0.dn
        .map(
          (d, i) =>
            `<tr><td class="c" colspan="3">${i + 1}</td><td colspan="2">${fx(d[0], 3)}</td><td colspan="2">${fx(d[1], 3)}</td><td colspan="2">${fx(d[1] * effI.gc, 2)}</td><td>${fx((d[1] * effI.gc) / 2, 2)}</td></tr>`,
        )
        .join('');
  }

  spTypeApply(options);
  if (typeof document !== 'undefined') {
    mathAll();
    try {
      if (giFit()) mathAll();
    } catch (e) {
      console.error(e);
    }
  }

  // Tương thích với các sheet gối, bản mặt cầu, bản liên tục nhiệt, mố, trụ
  for (const R of [gRes, bRes]) {
    R.loads.DC4 = R.loads.w3;
    R.loads.DW = R.loads.wDW;
    R.dd = R.gm.P;
  }

  const GG = {
    g: { dd: gRes.gm.P, voids: [] as never[], H: G0.H, noJoint: true },
    b: { dd: bRes.gm.P, voids: [] as never[], H: G0.H, noJoint: true, de: bRes.de },
  };
  const out: GiCompositeResult = {
    I: effI,
    LIM: effLIM,
    type: 'I',
    g: gRes,
    b: bRes,
    GG,
    G0,
  };

  setLatestGirResult(out);
  setLatestDamResult(out as unknown as DamCompositeResult);
  damLink(options);

  const visualHooks = getVisualHooks();
  visualHooks.renderGirderI?.({ result: out });
  visualHooks.renderMath?.();

  return out;
}

export function giLink(): boolean {
  if (objLinkOff()) {
    objUnlock();
    return false;
  }
  try {
    xfLink();
  } catch (e) {
    console.error(e);
  }
  const damR = getLatestDamResult() ?? latestGirResult;
  if (!damR || !damR.I || !damR.g || !damR.G0) return false;
  const I = damR.I;
  const g = damR.g as GiCalcResult;
  const G0 = damR.G0 as GiInput;
  if (typeof g.Vg !== 'number' || !Array.isArray(G0.cab)) return false;

  const b4m = (G0.b4 || 0) / 1000;
  const b3m = (G0.b3 || 0) / 1000;
  const h6m = (G0.h6 || 0) / 1000;
  const tpan = G0.tpan ?? 0;
  const ohm = I.Wb / 2 - ((I.Ng - 1) * I.S) / 2;
  const Atp =
    tpan > 0
      ? tpan * (I.Ng - 1) * Math.max(0, I.S - b4m) +
        2 * h6m * (Math.max(0, b3m - b4m) / 2 + 0.5 * Math.max(0, ohm - b3m / 2))
      : (G0.Apan || 0) * I.Ng;
  const Vk = (G0.dn || []).reduce((t, d) => t + d[1], 0) * Math.max(0, I.Ng - 1) + Atp * I.Lt;
  const map: Record<string, number> = {
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
    mo_Vg: +g.Vg.toFixed(4),
    mo_Ad: +(I.Wb * I.hs).toFixed(4),
    mo_Hd: I.hs,
    mo_Hg: g.H / 1000,
    mo_Vk: +Vk.toFixed(4),
  };

  let changed = false;
  for (const [id, v] of Object.entries(map)) {
    const e = $(id);
    if (!e) continue;
    const sv = String(v);
    if (e.value !== sv) {
      e.value = sv;
      changed = true;
    }
    e.readOnly = true;
    e.classList?.add('lnk');
    e.title = 'Lấy từ sheet kiểm toán dầm (mục 1, 2 - số liệu thiết kế)';
  }
  const gt = $('mo_gtype');
  if (gt && gt.value !== 'I') {
    gt.value = 'I';
    changed = true;
  }
  const dt = $('mo_dtype');
  if (dt) {
    const v = tpan > 0 ? 'P' : I.Hsu > 0 ? 'C' : 'D';
    if (dt.value !== v) {
      dt.value = v;
      changed = true;
    }
  }
  {
    const e = $('mo_tpan');
    if (e && tpan > 0) {
      const sv = String(tpan);
      if (e.value !== sv) {
        e.value = sv;
        changed = true;
      }
      e.readOnly = true;
      e.classList?.add('lnk');
    }
  }
  const nt = $('moLnkNote');
  if (nt) {
    nt.textContent =
      'Các số liệu nền xanh nhạt được lấy tự động từ sheet kiểm toán dầm (Vg theo hình học dầm I; Vk gồm dầm ngang và tấm bê tông đúc sẵn); sửa tại sheet dầm giữa, mục 1 và 2.';
  }
  return changed;
}

export function biaInit(): void {
  // Retained purely as an explicit no-op export hook for parity with upstream global entrypoint.
}

function toNumericRecord(obj: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(obj)) {
    if (typeof val === 'number') out[k] = val;
  }
  return out;
}

export function toIGirderBranchResult(
  raw: GiCalcResult,
  dd?: Point2D[],
  I?: DamSpInput,
  LIM?: DamLimits,
): GirderBranchResult {
  if (raw.allOK == null && I) {
    evalGiSummary(raw, I, LIM ?? evalDamLimits(I));
  }
  return {
    kind: 'I',
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
    groups: {
      T: raw.T,
      nC: raw.nC,
      Ap1: raw.Ap1,
      Apc: raw.Apc,
      Aps: raw.Aps,
      ES: raw.ES,
      As: raw.As,
      AsT: raw.AsT,
    },
    res: {
      sections: raw.res,
      mid: raw.res[raw.res.length - 1],
      rv: raw.rv,
      rx: raw.rx,
      xv: raw.xv,
      TG: raw.TG,
      IF: raw.IF,
      items: raw.items,
    },
    camber: raw.camber as unknown as Record<string, unknown>,
    shr: raw.shr as unknown as Record<string, unknown>,
    anch: raw.anc as unknown as Record<string, unknown>,
    dd: dd ?? raw.dd ?? raw.gm?.P,
    okAll: raw.allOK,
  };
}

export function toIGirderResult(
  input: GiCompositeResult | DamCompositeResult | GiCalcResult,
  edgeOverride?: GiCalcResult,
): GirderResult {
  if ('g' in input && input.g) {
    const gRaw = input.g as GiCalcResult;
    const bRaw = (input.b as GiCalcResult | undefined) ?? gRaw;
    const gg = (input.GG || {}) as {
      g?: { dd?: Point2D[] };
      b?: { dd?: Point2D[] };
    };
    const gBranch = toIGirderBranchResult(gRaw, gg.g?.dd, input.I, input.LIM);
    const bBranch = toIGirderBranchResult(bRaw, gg.b?.dd, input.I, input.LIM);
    return {
      spType: 'I',
      g: gBranch,
      b: bBranch,
    };
  }
  const gRaw = input as GiCalcResult;
  const gBranch = toIGirderBranchResult(gRaw);
  const bBranch = edgeOverride ? toIGirderBranchResult(edgeOverride) : gBranch;
  return {
    spType: 'I',
    g: gBranch,
    b: bBranch,
  };
}
