/**
 * BangTinhCauCong Web App — Heavy Abutment Loads, Combinations, Section & Cap Checks
 * (`MO`, `moInputs`, `moStep`, `moLink`, `rcStep`, `capStep`, `punchStep`).
 *
 * Exact clean-room TypeScript port of:
 *  - `analysis-cau-cong/modules/03_abutment_loads_and_rc.js` lines 1-1272 & 2472-3089
 *  - `analysis-cau-cong/modules/08_flexible_abutment_md.js` lines 2175-2417 (`MO.ext`, `MO.secZ`)
 *
 * Units: kN, m (internal RC checks convert to N, mm, MPa via `../math/rc.ts`).
 * Axis convention: +X along bridge toward span, +Y transverse left, +Z upward from cap bottom.
 * My = sum(N * ex) + sum(Hx * ez), Mx = sum(N * ey) + sum(Hy * ez).
 */

import type {
  AbutmentComboEntry,
  AbutmentResult,
  ForceVector5,
  LimitStateType,
  RcMaterialProps,
  RcSectionResult,
} from '../../types/project.ts';
import {
  $,
  contextState,
  fx,
  getVisualHooks,
  klDiv,
  num,
  set,
  sv,
  v,
} from '../context.ts';
import type { McrRuntimeState } from '../foundations/pileGroup.ts';
import { sfCap6Txt, sfGrid, sfmOn, sfPun6 } from '../foundations/shallowFdn.ts';
import {
  RC,
  rcMat,
  rcRender,
  rcSec,
  type RcLoadInput,
  type RcSectionCheckWithOk,
} from '../math/rc.ts';
import { moXF } from './crossfall.ts';
import { getLatestDamResult } from './girderHollow.ts';

// ---------------------------------------------------------------------------
// 1. Late-Binding Flexible Abutment (`MD`) Hook Registry (Zero Circular Imports)
// ---------------------------------------------------------------------------

export interface MdBridgeHooks {
  isActive: () => boolean;
  inputs?: () => Record<string, unknown>;
  selfW?: (I: Record<string, any>) => any;
  wing?: (I: Record<string, any>) => any;
  capStep?: () => unknown;
  wingTab?: (R: any) => void;
  vis?: () => void;
  than?: (R: any, I: any) => void;
  wingAll?: (R: any) => void;
}

let mdHooks: Partial<MdBridgeHooks> = {};

export function registerMdBridgeHooks(hooks: Partial<MdBridgeHooks>): void {
  mdHooks = { ...mdHooks, ...hooks };
}

export function clearMdBridgeHooks(): void {
  mdHooks = {};
}

export function mdOn(): boolean {
  return Boolean(mdHooks.isActive?.());
}

// ---------------------------------------------------------------------------
// 2. Domain Types & Constants
// ---------------------------------------------------------------------------

export const MO_STR: Readonly<Record<string, 1>> = {
  wOn: 1,
  fnd: 1,
  goi: 1,
  Kmode: 1,
  eqm: 1,
  gtype: 1,
  dtype: 1,
  ixm: 1,
  gpl: 1,
};

export interface MoInput {
  [key: string]: any;
  wOn: string;
  fnd: string;
  goi: string;
  Kmode: string;
  eqm: string;
  gtype: string;
  dtype: string;
  ixm: string;
  gpl: string;
  kd: number;
  sa: number;
  ELmc: number;
  ELbe: number;
  b: number;
  b1: number;
  Lf: number;
  d: number;
  f: number;
  cf: number;
  a: number;
  L: number;
  b9: number;
  t: number;
  jtm: number;
  kt: number;
  vt: number;
  d1: number;
  d2: number;
  d2b: number;
  d9: number;
  wc: number;
  ut: number;
  up: number;
  d4: number;
  d5: number;
  b3: number;
  hpav: number;
  hg: number;
  Ag: number;
  dkx: number;
  dky: number;
  dkh: number;
  dkn: number;
  hbg: number;
  unx: number;
  uny: number;
  unh: number;
  unn: number;
  g: number;
  Lqd: number;
  hqd: number;
  Lt: number;
  a0: number;
  Ng: number;
  Sg: number;
  Sb: number;
  icr: number;
  icrR: number;
  icy: number;
  ix: number;
  ixR: number;
  tpan: number;
  Vg: number;
  Vk: number;
  Hg: number;
  Ad: number;
  Hd: number;
  Wb: number;
  Wpat: number;
  Wpap: number;
  Hpa: number;
  Apa: number;
  Hra: number;
  Pra: number;
  WPLt: number;
  WPLp: number;
  APL: number;
  Hsu: number;
  gsuT: number;
  qPL: number;
  IM: number;
  IMon: number;
  Rce: number;
  Vce: number;
  gcT: number;
  gsT: number;
  phi: number;
  del: number;
  beta: number;
  theta: number;
  EHv: number;
  mu: number;
  Tmax: number;
  Tmin: number;
  Tset: number;
  Gb: number;
  bga: number;
  bgb: number;
  hrt: number;
  nbg: number;
  eCS: number;
  wz: number;
  S: number;
  V25: number;
  Cd1: number;
  Cd2: number;
  Cd3: number;
  WSlong: number;
  A: number;
  soil: number;
  khk: number;
  kv: number;
  Tm: number;
  Rpd: number;
  Rlk: number;
  eta: number;
  ELw: number;
  gEQ: number;
  VB: number;
  dT: number;
  alT: number;
  Lb: number;
  Ab: number;
  Wsu: number;
  mtype: 'deo' | 'nang';
  MD: Record<string, any> | null;
}

const MO_NUM_DEFAULTS: Readonly<Record<string, number>> = {
  kd: 0.5,
  sa: 90,
  ELmc: 20.93,
  ELbe: 15.881,
  b: 5,
  b1: 1.7,
  Lf: 7,
  d: 1.8,
  f: 0,
  cf: 0,
  a: 1.4,
  L: 7,
  b9: 0.3,
  t: 0.5,
  jtm: 0.961,
  kt: 0,
  vt: 0,
  d1: 0.7,
  d2: 0.3,
  d2b: 0.3,
  d9: 0.3,
  wc: 5,
  ut: 0.5,
  up: 0.5,
  d4: 1,
  d5: 1.6,
  b3: 1.9,
  hpav: 0.22,
  hg: 0.6,
  Ag: 0.218,
  dkx: 0.25,
  dky: 0.8,
  dkh: 0.03,
  dkn: 7,
  hbg: 0.035,
  unx: 0,
  uny: 0,
  unh: 0,
  unn: 0,
  g: 0.55,
  Lqd: 0,
  hqd: 0.3,
  Lt: 18,
  a0: 0.3,
  Ng: 7,
  Sg: 1,
  Sb: 1,
  icr: 2,
  icrR: 2,
  icy: 0,
  ix: 2,
  ixR: 2,
  tpan: 0.08,
  Vg: 8.50857,
  Vk: 0,
  Hg: 0.65,
  Ad: 1.59,
  Hd: 0.18,
  Wb: 7,
  Wpat: 0.5,
  Wpap: 0.5,
  Hpa: 0.6,
  Apa: 0.218,
  Hra: 0.61,
  Pra: 13.134,
  WPLt: 0,
  WPLp: 0,
  APL: 0,
  Hsu: 0,
  gsuT: 2.25,
  qPL: 3,
  IM: 0.33,
  IMon: 1,
  Rce: 0,
  Vce: 40,
  gcT: 2.5,
  gsT: 1.8,
  phi: 35,
  del: 20,
  beta: 0,
  theta: 90,
  EHv: 0,
  mu: 0.3,
  Tmax: 47,
  Tmin: 5,
  Tset: 25,
  Gb: 1000,
  bga: 0.15,
  bgb: 0.2,
  hrt: 0.018,
  nbg: 14,
  eCS: 0,
  wz: 2,
  S: 1.09,
  V25: 25,
  Cd1: 1.2,
  Cd2: 0.8,
  Cd3: 1,
  WSlong: 0,
  A: 0.12,
  soil: 3,
  khk: 1,
  kv: 0,
  Tm: 0.3,
  Rpd: 1.5,
  Rlk: 0.8,
  eta: 1,
  ELw: 0,
  gEQ: 0.5,
};

const MO_STR_DEFAULTS: Readonly<Record<string, string>> = {
  wOn: '0',
  fnd: 'coc',
  goi: 'F',
  Kmode: 'A',
  eqm: 'R',
  gtype: 'B',
  dtype: 'C',
  ixm: 'theo',
  gpl: 'doc',
};

const MO_TEXT_META_KEYS = ['qm', 'kho', 'ts', 'tt', 'hm', 'lkc', 'lm', 'tc', 'sd'] as const;

export interface MoWeightItem {
  no: number;
  name: string;
  V: number;
  P: number;
  x: number;
  y: number;
  z: number;
  sec: string;
  z0?: number;
  z1?: number;
}

export interface MoGeo {
  b2: number;
  n: number;
  xw1: number;
  xw2: number;
  xb: number;
  ELbot: number;
  htm: number;
  zct: number;
  zwt: number;
  ztop: number;
  hav: number;
  hEdge: number;
  hct: number;
  zseat: number;
  zbg: number;
  wB: number;
  b4: number;
  d3: number;
  H: Record<'A' | 'B' | 'C', number>;
  ref: Record<'A' | 'B' | 'C', { x: number; z: number }>;
  Acb: number;
  zcb: number;
  wingA: number;
  Af: number;
  hJ: number;
  wingSide?: number;
  lt?: number;
  H4?: number;
  H3?: number;
  lTai?: number;
}

export interface MoLaneCase {
  n: number;
  m: number;
  ey: number;
  LL: number;
  IM: number;
  BR: number;
  CE: number;
}

export interface MoWindItem {
  name: string;
  Cd: number;
  At: number;
  P: number;
  z: number;
  sec: string;
}

export interface MoWingSectionResult {
  EH: { V: number; M: number };
  LS: { V: number; M: number };
  EQ: { V: number; M: number };
  A: number;
  b: number;
  name: string;
  comb: Array<{ id: string; st: LimitStateType; g: Record<string, number>; V: number; M: number }>;
}

export interface MoComboSpec {
  id: string;
  st: LimitStateType;
  lim: string;
  desc: string;
  p: string;
  f: Record<string, number>;
  g: Record<string, number>;
}

export interface MoComboEntry extends MoComboSpec {
  rows: Array<ForceVector5 & { k: string; g: number }>;
  tot: ForceVector5;
}

export interface MoLinkPayload {
  CD: Array<{ id: string; v: number[] }>;
  DB: Array<{ id: string; v: number[] }>;
}

export interface MoCalcResult {
  err: string[];
  geo: MoGeo;
  W: MoWeightItem[];
  SUP: {
    Vg: number;
    Vk: number;
    Vd: number;
    Vpa: number;
    Vpl: number;
    Pra: number;
    DC1: number;
    DW: number;
    Rqd: number;
  };
  LIVE: {
    WLL: number;
    nL: number;
    wl: number;
    Ls: number;
    yT: number[];
    yD: number[];
    RT: number;
    RD: number;
    RL: number;
    useT: boolean;
    Rax: number;
    BR1: number;
    lanes: MoLaneCase[];
    best: MoLaneCase;
    one: MoLaneCase;
    PL: number;
    yPL: number;
    C_ce: number;
    kL: number;
    sumAx: number;
  };
  WG: {
    plate?: any;
    H: number;
    he: number;
    u: number;
    pLS: number;
    pEQ: number;
    dK: number;
    CW: Array<{ id: string; st: LimitStateType; g: Record<string, number> }>;
    sec: Record<string, any>;
    B5?: number;
    H4?: number;
  };
  K: {
    KA: { G: number; K: number };
    K0: number;
    K: number;
    cH: number;
    sH: number;
  };
  EV: {
    front: { V: number; x: number };
    back: { V: number; x: number };
    N: number;
    My: number;
  };
  EHs: Record<'A' | 'B' | 'C', { H: number; w: number; P: number; E: number; K: number; Hx: number; Nv: number; z: number }>;
  LSs: Record<'A' | 'B' | 'C', { H: number; w: number; he: number; dp: number; Hx: number; z: number }>;
  LSv: { he: number; dp: number; N: number; x: number };
  WIND: {
    V: number;
    V25: number;
    HST: number;
    sets: { V: MoWindItem[]; V25: MoWindItem[] };
    long: { V: { At: number; P: number; z: number }; V25: { At: number; P: number; z: number } };
    WLy: number;
    WLx: number;
    zWL: number;
  };
  EQ: {
    A: number;
    S: number;
    Csm: number;
    kh: number;
    kv: number;
    psi: number;
    KAE: number;
    kin: number;
    ksup: number;
    Wsup: number;
    Fx: number;
    Fy: number;
    klk: number;
    Flx: number;
    Fly: number;
    zsup: number;
    MO: Record<'A' | 'B' | 'C', { H: number; w: number; EAE: number; EA: number; dH: number; dM: number }>;
  };
  FR: number;
  FRn: number;
  TU: number;
  dU: number;
  CS: number;
  eCS: number;
  WAu: number;
  sec: Record<'A' | 'B' | 'C', Record<string, ForceVector5>>;
  CB: MoComboSpec[];
  comb: Record<'A' | 'B' | 'C', MoComboEntry[]>;
  gc: number;
  gs: number;
  gsu: number;
  Lw: Record<'A' | 'B' | 'C', number>;
  s: number;
  c: number;
  link?: MoLinkPayload;
}

export interface RcMRuntimeState {
  M: RcMaterialProps;
  res: Record<string, RcSectionCheckWithOk | null | undefined>;
  ok?: boolean;
}

export interface PunchCheckUnit {
  u: number[];
  len: number;
  pts: Array<[[number, number], [number, number]]>;
}

export interface PunchCheckResult {
  ok: boolean;
  ratios: number[];
  worstRatio: number;
  groups: number;
  units: PunchCheckUnit[];
}

export interface CapComboInternalForce {
  id: string;
  st: LimitStateType;
  g: Record<string, number>;
  VI: number;
  MI: number;
  VII: number;
  MII: number;
  dvI?: number;
  dvII?: number;
  VcI?: number;
  VcII?: number;
}

export interface CapRuntimeState {
  c1: RcSectionCheckWithOk | null;
  c2: RcSectionCheckWithOk | null;
  bn?: RcSectionCheckWithOk | null;
  bp?: RcSectionCheckWithOk | null;
  stm?: { active?: boolean; ok: boolean; need?: boolean; strict?: boolean; raw?: boolean };
  punching?: { ok: boolean; ratios: number[] };
  out?: CapComboInternalForce[];
  sfgActive?: boolean;
  ok?: boolean;
}

export const MOKEYS: ReadonlyArray<readonly [string, string]> = [
  ['DC', 'Tĩnh tải KCPT và mố'],
  ['DW', 'Lớp phủ, tiện ích'],
  ['EV', 'Áp lực đất thẳng đứng'],
  ['EH', 'Áp lực đất nằm ngang'],
  ['LS', 'Hoạt tải chất thêm'],
  ['LL1', 'Hoạt tải xe (1)'],
  ['IM1', 'Lực xung kích (1)'],
  ['PL1', 'Người đi bộ (1)'],
  ['BR1', 'Lực hãm xe (1)'],
  ['CE1', 'Lực ly tâm (1)'],
  ['LL2', 'Hoạt tải xe (2)'],
  ['IM2', 'Lực xung kích (2)'],
  ['PL2', 'Người đi bộ (2)'],
  ['BR2', 'Lực hãm xe (2)'],
  ['CE2', 'Lực ly tâm (2)'],
  ['WSV', 'Gió lên kết cấu, V'],
  ['WSV25', 'Gió lên kết cấu, V2'],
  ['WL', 'Gió lên xe cộ'],
  ['EQx', 'Động đất dọc cầu'],
  ['EQy', 'Động đất ngang cầu'],
  ['FR', 'Ma sát gối'],
  ['TU', 'Nhiệt độ đều'],
  ['CS', 'Co ngót, từ biến dầm'],
  ['WA', 'Đẩy nổi'],
];

const MOSYM_MAP: Readonly<Record<string, string>> = {
  LL1: 'LL',
  IM1: 'IM',
  PL1: 'PL',
  BR1: 'BR',
  CE1: 'CE',
  LL2: 'LL',
  IM2: 'IM',
  PL2: 'PL',
  BR2: 'BR',
  CE2: 'CE',
  WSV: 'WS',
  WSV25: 'WS',
  EQx: 'EQ',
  EQy: 'EQ',
};

export const MOSYM = (k: string): string => MOSYM_MAP[k] || k;

// ---------------------------------------------------------------------------
// 3. Module Runtime State & Getters / Setters
// ---------------------------------------------------------------------------

let MOR: MoCalcResult | null = null;
let RCM: RcMRuntimeState | null = null;
let CAPR: CapRuntimeState | null = null;
let latestCapStmOk = true;
let latestPunOk = true;

export function getLatestMorResult(): MoCalcResult | null {
  return MOR;
}

export function setLatestMorResult(result: MoCalcResult | null): void {
  MOR = result;
}

export function getLatestRcmResult(): RcMRuntimeState | null {
  return RCM;
}

export function setLatestRcmResult(result: RcMRuntimeState | null): void {
  RCM = result;
}

export function getLatestCapResult(): CapRuntimeState | null {
  return CAPR;
}

export function setLatestCapResult(result: CapRuntimeState | null): void {
  CAPR = result;
}

// ---------------------------------------------------------------------------
// 4. Heavy Abutment Core Solver (`MO` — TCVN 11823-3:2017 & 11823-11:2017)
// ---------------------------------------------------------------------------

const moDegToRad = (d: number): number => (d * Math.PI) / 180;

const moMultiPresence = (n: number): number =>
  n <= 1 ? 1.2 : n === 2 ? 1.0 : n === 3 ? 0.85 : 0.65; // Table 7

const moHeq = (H: number): number =>
  H <= 1.5
    ? 1.2
    : H <= 3
      ? 1.2 - ((H - 1.5) / 1.5) * 0.3
      : H <= 6
        ? 0.9 - ((H - 3) / 3) * 0.3
        : 0.6; // Table 22 (abutment perpendicular to traffic)

const moCoulomb = (
  phi: number,
  del: number,
  beta: number,
  theta: number,
): { G: number; K: number } => {
  const r = moDegToRad;
  const G =
    (1 +
      Math.sqrt(
        (Math.sin(r(phi + del)) * Math.sin(r(phi - beta))) /
          (Math.sin(r(theta - del)) * Math.sin(r(theta + beta))),
      )) **
    2;
  return {
    G,
    K: Math.sin(r(theta + phi)) ** 2 / (G * Math.sin(r(theta)) ** 2 * Math.sin(r(theta - del))),
  };
};

// Mononobe-Okabe: psi = arctan(kh/(1-kv)), bw = wall back angle from vertical, i = backfill slope
const moKae = (phi: number, del: number, i: number, bw: number, psi: number): number => {
  const r = moDegToRad;
  const s = Math.sin(r(phi + del)) * Math.sin(r(phi - psi - i));
  if (s < 0) return NaN;
  return (
    (Math.cos(r(phi - psi - bw)) ** 2 /
      (Math.cos(r(psi)) * Math.cos(r(bw)) ** 2 * Math.cos(r(del + bw + psi)))) *
    (1 + Math.sqrt(s / (Math.cos(r(del + bw + psi)) * Math.cos(r(i - bw))))) ** -2
  );
};

// Elastic seismic response coefficient Csm (TCVN 11823-3, Art. 9.6)
const moCsm = (A: number, S: number, soil: number, T: number): number => {
  const tEff = Math.max(T, 1e-3);
  if (tEff > 4) return (3 * A * S) / Math.pow(tEff, 4 / 3);
  let c = Math.min((1.2 * A * S) / Math.pow(tEff, 2 / 3), 2.5 * A);
  if (soil === 3 && A >= 0.3) c = Math.min(c, 2.0 * A);
  return c;
};

const moTrapX = (w: number, h1: number, h2: number): number =>
  h1 + h2 > 0 ? (w * (h1 + 2 * h2)) / (3 * (h1 + h2)) : 0;

const moTrapZ = (h1: number, h2: number): number =>
  h1 + h2 > 0 ? (h1 * h1 + h1 * h2 + h2 * h2) / (3 * (h1 + h2)) : 0;

function computeRigidWingWall(
  I: MoInput,
  hct: number,
  b3: number,
  b4: number,
  K: number,
  KA: { G: number; K: number },
  KAE: number,
  gs: number,
  gc: number,
  kin: number,
): MoCalcResult['WG'] {
  const H = hct;
  const he = MO.heq(H);
  const u = Math.min(I.ut, I.up) || Math.max(I.ut, I.up);
  const dK = (Number.isFinite(KAE) ? KAE : KA.K) - KA.K;
  const pEH = (z: number) => K * gs * Math.max(0, H - z);
  const pLS = K * gs * he;
  const pEQ = 0.5 * gs * H * (1 - I.kv) * Math.max(0, dK) + kin * gc * u;

  const acc = () => ({
    EH: { V: 0, M: 0 },
    LS: { V: 0, M: 0 },
    EQ: { V: 0, M: 0 },
    A: 0,
  });
  const E = acc();
  const F = acc();
  const Gg = acc();
  const st = 0.01;
  const put = (o: { V: number; M: number }, p: number, dA: number, arm: number) => {
    o.V += p * dA;
    o.M += p * dA * arm;
  };

  // Cantilever portion beyond heel: s from b3 to b3+b4
  for (let s = b3 + st / 2; s < b3 + b4; s += st) {
    const zb = H - I.d4 - I.d5 + (I.d5 * (s - b3)) / Math.max(b4, 1e-9);
    for (let z = Math.max(0, zb) + st / 2; z < H; z += st) {
      const dA = st * st;
      E.A += dA;
      put(E.EH, pEH(z), dA, s - b3);
      put(E.LS, pLS, dA, s - b3);
      put(E.EQ, pEQ, dA, s - b3);
    }
  }
  // Portion over heel: split along 45-deg line from stem-cap corner
  for (let s = st / 2; s < b3; s += st) {
    for (let z = st / 2; z < H; z += st) {
      const dA = st * st;
      if (z >= s) {
        F.A += dA;
        put(F.EH, pEH(z), dA, s);
        put(F.LS, pLS, dA, s);
        put(F.EQ, pEQ, dA, s);
      } else {
        Gg.A += dA;
        put(Gg.EH, pEH(z), dA, z);
        put(Gg.LS, pLS, dA, z);
        put(Gg.EQ, pEQ, dA, z);
      }
    }
  }
  for (const k of ['EH', 'LS', 'EQ'] as const) {
    F[k].V += E[k].V;
    F[k].M += E[k].M + E[k].V * b3;
  }

  const gE = I.Kmode === '0' ? 1.35 : 1.5;
  const CW: Array<{ id: string; st: LimitStateType; g: Record<string, number> }> = [
    { id: 'CĐ I', st: 'CD', g: { EH: gE, LS: 1.75 } },
    { id: 'CĐ V', st: 'CD', g: { EH: gE, LS: 1.35 } },
    { id: 'ĐB I', st: 'DB', g: { EH: 1, LS: I.gEQ, EQ: 1 } },
    { id: 'SD I', st: 'SD', g: { EH: 1, LS: 1 } },
  ];
  const sec: Record<string, MoWingSectionResult> = {
    E: { ...E, b: I.d4 + I.d5, name: 'E-E', comb: [] },
    F: { ...F, b: H, name: 'F-F', comb: [] },
    G: { ...Gg, b: b3, name: 'G-G', comb: [] },
  };
  for (const k of Object.keys(sec)) {
    const o = sec[k];
    o.comb = CW.map((c) => {
      let V = 0;
      let M = 0;
      for (const [q, g] of Object.entries(c.g)) {
        const comp = o[q as 'EH' | 'LS' | 'EQ'];
        if (comp) {
          V += g * comp.V;
          M += g * comp.M;
        }
      }
      return { ...c, V, M };
    });
  }
  return { H, he, u, pLS, pEQ, dK, CW, sec };
}

function moCalc(I: MoInput): MoCalcResult {
  const W: MoWeightItem[] = [];
  const err: string[] = [];
  const s = Math.sin(moDegToRad(I.sa || 90));
  const c = Math.abs(I.sa - 90) < 1e-9 ? 0 : Math.cos(moDegToRad(I.sa));
  const gc = I.gcT * MO.G;
  const gs = I.gsT * MO.G;
  const gsu = I.gsuT * MO.G;
  const DE = I.mtype === 'deo' ? I.MD : null;

  // ---------- geometry ----------
  const b = I.b;
  const t = I.t;
  const a = DE ? I.t : I.a;
  const b1 = DE ? I.b - I.t : I.b1;
  const d = I.d;
  const f = DE ? 0 : I.f;
  const L = I.L;
  const Lf = I.Lf;
  const b2 = DE ? 0 : b - b1 - a;
  const n = a - t;
  if (!DE && b2 <= 0) err.push('Bề rộng gót bệ b2 = b - b1 - a phải > 0');
  if (n < 0) err.push('Bề dày tường đỉnh t không được lớn hơn bề dày tường thân a');

  const xw1 = b / 2 - b1;
  const xw2 = xw1 - a;
  const xb = DE ? xw1 + I.g : xw1 - I.g;
  const ELbot = DE ? I.ELmc - I.jtm - d : I.ELbe - d - f;
  const htm = DE ? 0 : I.ELmc - I.jtm - I.ELbe;
  if (!DE && htm <= 0) err.push('Cao độ đỉnh bệ phải thấp hơn cao độ đỉnh tường thân');

  const zct = d + f;
  const zwt = zct + htm;
  const ztop = zwt + I.jtm;
  const ix = I.ix / 100;
  const hav = DE ? 0 : htm - (L * ix) / 4;
  const hEdge = DE ? I.jtm : htm + I.jtm - (L / 2) * ix;
  const hct = DE ? I.jtm : hEdge - I.hpav;
  const zseat = zwt + I.dkh;
  const zbg = zseat + I.hbg;
  const wB = L - I.ut - I.up;
  const b3 = DE ? 0 : I.b3;
  const b4 = DE ? 0 : I.wc - b3 - t;
  if (DE && DE && I.wc < (DE.B5 || 0) + t) {
    err.push('Mố dẻo: chiều dài tường cánh phần trên B6 phải ≥ B5 + B7');
  }
  if (DE && (DE.H4 || 0) > ztop) {
    err.push('Mố dẻo: chiều cao đầu tường cánh H4 phải ≤ H = H1 + H7');
  }
  if (!DE && b4 < 0) err.push('Chiều dài tường cánh wc phải ≥ b3 + t');
  const d3 = htm + I.jtm - I.d1 - I.d2 - I.d2b;

  const geo: MoGeo = {
    b2,
    n,
    xw1,
    xw2,
    xb,
    ELbot,
    htm,
    zct,
    zwt,
    ztop,
    hav,
    hEdge,
    hct,
    zseat,
    zbg,
    wB,
    b4,
    d3,
    H: { A: ztop, B: DE ? I.jtm : ztop - zct, C: I.jtm },
    ref: {
      A: { x: 0, z: 0 },
      B: DE ? { x: xw2 + t / 2, z: zwt } : { x: xw1 - a / 2, z: zct },
      C: { x: xw2 + t / 2, z: zwt },
    },
    Acb: 0,
    zcb: 0,
    wingA: 0,
    Af: 0,
    hJ: 0,
  };

  // ---------- abutment self-weight (DC2) ----------
  const el = (no: number, name: string, V: number, x: number, y: number, z: number, secStr: string) => {
    const P = V * gc;
    const item: MoWeightItem = { no, name, V, P, x, y, z, sec: secStr };
    W.push(item);
    return item;
  };

  if (DE) {
    mdHooks.selfW?.({
      I,
      DE,
      o: { b, t, d, L, xw2, xb, ztop, wB, geo },
      b,
      t,
      d,
      L,
      xw2,
      xb,
      ztop,
      wB,
      geo,
      el,
    });
  } else {
    {
      // Cap: toe (chamfer f), under stem, heel
      const A1 = (d + f / 2) * b1;
      const A2 = (d + f) * a;
      const A3 = (d + f / 2) * b2;
      const x1 = xw1 + moTrapX(b1, d + f, d);
      const x2 = xw1 - a / 2;
      const x3 = xw2 - moTrapX(b2, d + f, d);
      const z1 = ((b1 * d * d) / 2 + ((b1 * f) / 2) * (d + f / 3)) / Math.max(A1, 1e-9);
      const z2 = (d + f) / 2;
      const z3 = ((b2 * d * d) / 2 + ((b2 * f) / 2) * (d + f / 3)) / Math.max(A3, 1e-9);
      const A = A1 + A2 + A3;
      el(
        1,
        'Bệ',
        A * Lf,
        (A1 * x1 + A2 * x2 + A3 * x3) / A,
        0,
        (A1 * z1 + A2 * z2 + A3 * z3) / A,
        'A',
      );
    }
    el(2, 'Tường thân', a * L * hav, xw1 - a / 2, 0, zct + hav / 2, 'AB');
    el(3, 'Tường đỉnh', t * I.jtm * L, xw2 + t / 2, 0, zwt + I.jtm / 2, 'ABC');
    {
      const h1 = I.d2 + I.d2b;
      const h2 = I.d2;
      const Ac = ((h1 + h2) / 2) * I.d9;
      const zt = ztop - I.d1;
      geo.Acb = Ac;
      geo.zcb = zt;
      el(4, 'Vai kê', Ac * wB, xw2 - moTrapX(I.d9, h1, h2), 0, zt - moTrapZ(h1, h2), 'ABC');
    }
    {
      const hw = hct;
      const A1 = b3 * hw;
      const h1 = I.d4 + I.d5;
      const h2 = I.d4;
      const A2 = ((h1 + h2) / 2) * b4;
      const A = A1 + A2;
      const xr = xw2 - b3 / 2;
      const xg = xw2 - b3 - moTrapX(b4, h1, h2);
      const zr = zct + hw / 2;
      const zg = zct + hw - moTrapZ(h1, h2);
      const xw = A > 0 ? (A1 * xr + A2 * xg) / A : 0;
      const zw = A > 0 ? (A1 * zr + A2 * zg) / A : 0;
      const V = A * (I.ut + I.up);
      const y = (I.ut * (L / 2 - I.ut / 2) - I.up * (L / 2 - I.up / 2)) / Math.max(I.ut + I.up, 1e-9);
      geo.wingA = A;
      el(5, 'Tường cánh', V, xw, y, zw, 'A');
    }
    el(
      6,
      'Gờ lan can trên tường cánh',
      2 * I.Ag * I.wc,
      xw2 + t - I.wc / 2,
      0,
      zct + hct + I.hg / 2,
      'A',
    );
    {
      const Af = (I.b9 * I.d9) / 2;
      const hJ = d3 + I.d2b / 2;
      const nf = (I.ut > 0 ? 1 : 0) + (I.up > 0 ? 1 : 0);
      geo.Af = Af;
      geo.hJ = hJ;
      el(7, 'Vát tường thân', nf * Af * hJ, xw2 - I.d9 / 3, 0, zct + hJ / 2, 'A');
    }
    el(8, 'Tường tai', 2 * I.kt * n * I.vt, xw1 - n / 2, 0, zwt + I.kt / 2, 'AB');
    {
      const XX = moXF(I);
      el(9, 'Đá kê gối', I.dkx * I.dky * XX.sumH, xb, 0, zwt + I.dkh / 2, 'AB');
      if (XX.dV > 1e-9) {
        el(
          2,
          'Tường thân - phần hạ do dốc ngang mặt mũ (trừ)',
          -a * XX.dV,
          xw1 - a / 2,
          0,
          zwt,
          'AB',
        );
      }
    }
    el(10, 'Ụ neo dầm', I.unx * I.uny * I.unh * I.unn, xb, 0, zwt + I.unh / 2, 'AB');
  }

  // ---------- superstructure dead loads ----------
  const Vg = I.Ng * I.Vg;
  const Vd = I.Ad * I.Lt + (I.gpl === 'bang' ? moXF(I).Atd * I.Lt : 0);
  const Vpa = 2 * I.Apa * I.Lt;
  const Vpl = I.APL * I.Lt;
  const SUP = {
    Vg,
    Vk: I.Vk,
    Vd,
    Vpa,
    Vpl,
    Pra: I.Pra,
    DC1: 0.5 * (Vg + I.Vk + Vd + Vpa + Vpl) * gc + 0.5 * I.Pra,
    DW: 0.5 * gsu * I.Hsu * I.Wsu * I.Lt,
    Rqd: 0.5 * gc * I.hqd * I.Lqd * wB, // Approach slab reaction on corbel
  };

  // ---------- vehicular live load ----------
  const WLL = I.Wb - I.Wpat - I.Wpap - I.WPLt - I.WPLp;
  let nL = Math.floor(WLL / 3.6 + 1e-9);
  if (WLL >= 6 && WLL <= 7.2) nL = 2;
  nL = Math.max(nL, WLL > 0 ? 1 : 0);
  const wl = nL ? WLL / nL : 0;
  const Ls = I.Lt - 2 * I.a0;
  const yT = [0, 4.3, 8.6].map((x) => Math.max(0, (Ls - x) / Ls));
  const yD = [0, 1.2].map((x) => Math.max(0, (Ls - x) / Ls));
  const truck = [145, 145, 35];
  const tandem = [110, 110];
  const qL = 9.3;
  const RT = truck.reduce((tot, P, i) => tot + P * yT[i], 0);
  const RD = tandem.reduce((tot, P, i) => tot + P * yD[i], 0);
  const RL = (qL * Ls) / 2;
  const useT = RT >= RD;
  const Rax = useT ? RT : RD;
  const sumAx = useT ? 325 : 220;
  const BR1 = Math.max(
    0.25 * 325,
    0.25 * 220,
    0.05 * (325 + qL * I.Lt),
    0.05 * (220 + qL * I.Lt),
  );
  const yCurb = I.Wb / 2 - I.Wpat - I.WPLt;
  const lanes: MoLaneCase[] = [];
  for (let k = 1; k <= nL; k++) {
    const m = moMultiPresence(k);
    const ey = yCurb - (1.5 + ((k - 1) * wl) / 2);
    lanes.push({
      n: k,
      m,
      ey,
      LL: k * m * (Rax + RL),
      IM: I.IMon ? I.IM * k * m * Rax : 0,
      BR: k * m * BR1,
      CE: 0,
    });
  }
  const C_ce = I.Rce > 0 ? (4 * (I.Vce / 3.6) ** 2) / (3 * 9.81 * I.Rce) : 0;
  lanes.forEach((l) => {
    l.CE = C_ce * l.n * l.m * sumAx;
  });
  const best =
    lanes.reduce<MoLaneCase | null>((p, q) => (!p || q.LL > p.LL + 1e-9 ? q : p), null) || {
      n: 0,
      m: 0,
      ey: 0,
      LL: 0,
      IM: 0,
      BR: 0,
      CE: 0,
    };
  const one = lanes[0] || best;
  const PLw = I.WPLt + I.WPLp;
  const PL = (I.qPL * PLw * Ls) / 2;
  const yPL =
    PLw > 0
      ? (I.WPLt * (I.Wb / 2 - I.Wpat - I.WPLt / 2) - I.WPLp * (I.Wb / 2 - I.Wpap - I.WPLp / 2)) /
        PLw
      : 0;
  const kL = I.goi === 'F' || I.goi === 'K' ? 1 : I.goi === 'E' ? I.kd : 0;
  const LIVE = {
    WLL,
    nL,
    wl,
    Ls,
    yT,
    yD,
    RT,
    RD,
    RL,
    useT,
    Rax,
    BR1,
    lanes,
    best,
    one,
    PL,
    yPL,
    C_ce,
    kL,
    sumAx,
  };

  // ---------- backfill & earth pressure ----------
  const KA = moCoulomb(I.phi, I.del, I.beta, I.theta);
  const K0 = 1 - Math.sin(moDegToRad(I.phi));
  const K = I.Kmode === '0' ? K0 : KA.K;
  const dEH = I.Kmode === '0' ? 0 : I.del;
  const cH = I.EHv ? Math.cos(moDegToRad(dEH)) : 1;
  const sH = I.EHv ? Math.sin(moDegToRad(dEH)) : 0;
  const EVf = { V: (I.cf + f / 2) * b1 * Lf, x: xw1 + b1 / 2 };
  const Vbk = DE
    ? I.d1 * I.d9 * wB
    : Math.max(
        0,
        ((hct + f / 2) * b2 - geo.Acb) * wB -
          2 * geo.Af * geo.hJ * (I.ut > 0 && I.up > 0 ? 1 : 0.5),
      );
  const EVb = { V: Vbk, x: DE ? xw2 - I.d9 / 2 : xw2 - b2 / 2 };
  const EV = {
    front: EVf,
    back: EVb,
    N: (EVf.V + EVb.V) * gs,
    My: EVf.V * gs * EVf.x + EVb.V * gs * EVb.x,
  };
  const KAa = moCoulomb(I.phi, I.beta, I.beta, 90);
  const KA_ = (S: 'A' | 'B' | 'C') => (S === 'A' && I.Kmode !== '0' ? KAa.K : K);
  const cHS = (S: 'A' | 'B' | 'C') =>
    S === 'A' && I.Kmode !== '0' ? (I.EHv ? Math.cos(moDegToRad(I.beta)) : 1) : cH;
  const sHS = (S: 'A' | 'B' | 'C') =>
    S === 'A' && I.Kmode !== '0' ? (I.EHv ? Math.sin(moDegToRad(I.beta)) : 0) : sH;

  const EHs = {} as MoCalcResult['EHs'];
  const LSs = {} as MoCalcResult['LSs'];
  const Lw = { A: Lf / s, B: wB / s, C: wB / s };
  for (const S of ['A', 'B', 'C'] as const) {
    const H = geo.H[S];
    const w = Lw[S];
    const KS = KA_(S);
    const P = KS * gs * H;
    const E = 0.5 * P * H * w;
    EHs[S] = { H, w, P, E, K: KS, Hx: E * cHS(S), Nv: E * sHS(S), z: H / 3 };
    const he = moHeq(H);
    const dp = KS * gs * he;
    LSs[S] = { H, w, he, dp, Hx: dp * H * w, z: H / 2 };
  }
  const heA = moHeq(geo.H.A);
  const LSv = {
    he: heA,
    dp: gs * heA,
    N: gs * heA * (DE ? I.d9 : b2) * wB,
    x: DE ? xw2 - I.d9 / 2 : xw2 - b2 / 2,
  };

  // ---------- wind ----------
  const HST = I.Hg + I.Hd + I.Hpa;
  const PD = (V: number, At: number, Cd: number) => Math.max(0.0006 * V * V * At * Cd, 1.8 * At);
  const WSitems = (V: number): MoWindItem[] => {
    const zs = zbg + HST / 2;
    const zr = zbg + HST + I.Hra / 2;
    const At1 = (HST * I.Lt) / 2;
    const At2 = (I.Hra * I.Lt) / 2;
    const At2w = I.Hra * I.wc;
    const At3 = DE
      ? b * d + (geo.wingSide ?? 0) + I.hg * I.wc
      : a * htm + t * I.jtm + I.hg * I.wc;
    return [
      { name: 'Kết cấu nhịp', Cd: I.Cd1, At: At1, P: PD(V, At1, I.Cd1), z: zs, sec: 'AB' },
      { name: 'Lan can trên nhịp', Cd: I.Cd2, At: At2, P: PD(V, At2, I.Cd2), z: zr, sec: 'AB' },
      {
        name: 'Lan can trên tường cánh',
        Cd: I.Cd2,
        At: At2w,
        P: At2w > 0 ? PD(V, At2w, I.Cd2) : 0,
        z: zct + hct + I.hg + I.Hra / 2,
        sec: 'A',
      },
      {
        name: 'Mố (mặt bên)',
        Cd: I.Cd3,
        At: At3,
        P: PD(V, At3, I.Cd3),
        z: DE ? ztop / 2 : zct + (htm + I.jtm) / 2,
        sec: 'A',
      },
    ];
  };
  const WSL = (V: number) => {
    const At = DE ? d * Lf : htm * L;
    const zL = DE ? d / 2 : zct + htm / 2;
    return I.WSlong ? { At, P: PD(V, At, 1.0), z: zL } : { At, P: 0, z: zL };
  };
  const WIND = {
    V: I.VB * I.S,
    V25: I.V25,
    HST,
    sets: { V: WSitems(I.VB * I.S), V25: WSitems(I.V25) },
    long: { V: WSL(I.VB * I.S), V25: WSL(I.V25) },
    WLy: (1.46 * I.Lt) / 2,
    WLx: 0.55 * I.Lt * kL,
    zWL: ztop + 1.8,
  };

  // ---------- seismic ----------
  const A = I.A;
  const Ssoil = [1, 1.2, 1.5, 2][I.soil - 1] || 1;
  const Csm = moCsm(A, Ssoil, I.soil, I.Tm);
  const kh = I.khk * A;
  const kv = I.kv;
  const psi = (Math.atan(kh / (1 - kv)) * 180) / Math.PI;
  const KAE = moKae(I.phi, I.del, I.beta, 90 - I.theta, psi);
  if (!Number.isFinite(KAE)) {
    err.push(
      'Không tính được KAE (φ - ψ - i < 0): góc ma sát trong quá nhỏ so với gia tốc động đất',
    );
  }
  const kin = I.eqm === 'R' ? Csm / I.Rpd : kh;
  const ksup = I.eqm === 'R' ? Csm / I.Rpd : A * Ssoil;
  const klk = I.eqm === 'R' ? Math.max(Csm / I.Rlk, A * Ssoil) : A * Ssoil;
  const Wsup = SUP.DC1 + SUP.DW;
  const EQ: MoCalcResult['EQ'] = {
    A,
    S: Ssoil,
    Csm,
    kh,
    kv,
    psi,
    KAE,
    kin,
    ksup,
    Wsup,
    Fx: ksup * Wsup * (I.goi === 'F' || I.goi === 'K' ? 2 : I.goi === 'E' ? 2 * I.kd : 0),
    Fy: ksup * Wsup,
    klk,
    Flx: klk * Wsup * (I.goi === 'F' || I.goi === 'K' ? 2 : I.goi === 'E' ? 2 * I.kd : 0),
    Fly: klk * Wsup,
    zsup: zbg + (I.Hg + I.Hd) / 2,
    MO: {} as MoCalcResult['EQ']['MO'],
  };
  const KAEa = moKae(I.phi, I.beta, I.beta, 0, psi);
  for (const S of ['A', 'B', 'C'] as const) {
    const H = geo.H[S];
    const w = Lw[S];
    const kae = S === 'A' ? KAEa : KAE;
    const ka = S === 'A' ? KAa.K : KA.K;
    const EAE = 0.5 * gs * H * H * (1 - kv) * (Number.isFinite(kae) ? kae : 0) * w;
    const EA = 0.5 * ka * gs * H * H * w;
    EQ.MO[S] = { H, w, EAE, EA, dH: EAE - EA, dM: EAE * 0.5 * H - (EA * H) / 3 };
  }

  // ---------- wingwall earth pressure at E-E, F-F, G-G ----------
  const WG =
    (DE
      ? mdHooks.wing?.({
          I,
          DE,
          o: { K, KA, KAE, gs, gc, kin, geo },
          K,
          KA,
          KAE,
          gs,
          gc,
          kin,
          geo,
        })
      : undefined) || computeRigidWingWall(I, hct, b3, b4, K, KA, KAE, gs, gc, kin);

  // ---------- bearing friction & thermal / shrinkage-creep ----------
  const FRn = I.goi === 'S' ? SUP.DC1 + SUP.DW + best.LL : 0;
  const FR = I.mu * FRn;
  const dU = I.alT * I.dT * I.Lb;
  const FRk = I.goi === 'K' ? I.mu * (SUP.DC1 + SUP.DW) : Infinity;
  const TU =
    I.goi === 'E'
      ? (I.nbg * I.Gb * I.Ab * dU) / I.hrt
      : I.goi === 'K'
        ? Math.min((I.nbg * I.Gb * I.Ab * dU) / I.hrt, FRk)
        : 0;
  const eCS =
    I.eCS > 0
      ? I.eCS * 1e-6
      : (() => {
          try {
            const damr = getLatestDamResult() as Record<string, any> | null;
            const G = damr?.g;
            if (G && !G.shr && G.eSh != null) return Number(G.eSh) || 0;
            if (!G || !G.shr) return 0;
            if (G.shr.eps_bdf == null) return 0;
            const r = (Array.isArray(G.res) && G.res[G.res.length - 1]) || G.mid || {};
            return (
              G.shr.eps_bdf +
              ((r.fcgp || 0) / (G.Eci || 1)) * ((G.shr.psi_fi || 0) - (G.shr.psi_di || 0))
            );
          } catch {
            return 0;
          }
        })();
  const CS =
    I.goi === 'E'
      ? (I.nbg * I.Gb * I.Ab * eCS * I.Lb) / I.hrt
      : I.goi === 'K'
        ? Math.min((I.nbg * I.Gb * I.Ab * eCS * I.Lb) / I.hrt, Math.max(0, FRk - TU))
        : 0;
  const WAu = I.wOn === '1' ? Math.max(0, I.ELw - geo.ELbot) * 9.81 * I.b * I.Lf : 0;

  // ---------- unfactored section forces ----------
  const R = geo.ref;
  const sec = {} as Record<'A' | 'B' | 'C', Record<string, ForceVector5>>;
  for (const S of ['A', 'B', 'C'] as const) {
    const x0 = R[S].x;
    const z0 = R[S].z;
    const it: Record<string, ForceVector5> = {};
    const add = (
      k: string,
      N: number,
      x: number,
      y: number,
      Hx: number,
      Hy: number,
      z: number,
    ) => {
      const o = it[k] || (it[k] = { N: 0, Hx: 0, My: 0, Hy: 0, Mx: 0 });
      o.N += N;
      o.Hx += Hx;
      o.Hy += Hy;
      o.My += N * (x - x0) + Hx * (z - z0);
      o.Mx += N * y + Hy * (z - z0);
    };
    if (S !== 'C') add('DC', SUP.DC1, xb, 0, 0, 0, 0);
    W.filter((e) => e.sec.includes(S)).forEach((e) => add('DC', e.P, e.x, e.y, 0, 0, e.z));
    if (SUP.Rqd > 0 && (S === 'A' || geo.zcb > R[S].z + 1e-9)) {
      add('DC', SUP.Rqd, xw2 - I.d9 / 2, 0, 0, 0, geo.zcb);
    }
    if (S !== 'C') add('DW', SUP.DW, xb, 0, 0, 0, 0);
    if (S === 'A') {
      add('EV', EVf.V * gs, EVf.x, 0, 0, 0, 0);
      add('EV', EVb.V * gs, EVb.x, 0, 0, 0, 0);
    }
    const xBack = S === 'A' ? -b / 2 : xw2;
    add('EH', EHs[S].Nv, xBack, 0, EHs[S].Hx * s, EHs[S].Hx * c, z0 + EHs[S].z);
    add('LS', 0, 0, 0, LSs[S].Hx * s, LSs[S].Hx * c, z0 + LSs[S].z);
    if (S === 'A') add('LSV', LSv.N, LSv.x, 0, 0, 0, 0);

    for (const [key, l] of [
      ['1', best],
      ['2', one],
    ] as const) {
      if (S !== 'C') {
        add('LL' + key, l.LL, xb, l.ey, 0, 0, 0);
        add('IM' + key, l.IM, xb, l.ey, 0, 0, 0);
        add('PL' + key, PL, xb, yPL, 0, 0, 0);
        add('BR' + key, 0, 0, 0, l.BR * kL * s, l.BR * kL * c, ztop + 1.8);
        add('CE' + key, 0, 0, 0, 0, l.CE, ztop + 1.8);
      }
    }
    for (const VV of ['V', 'V25'] as const) {
      const k = 'WS' + VV;
      WIND.sets[VV]
        .filter((w) => w.sec.includes(S) && S !== 'C')
        .forEach((w) => add(k, 0, 0, 0, -w.P * c, w.P * s, w.z));
      if (S !== 'C') {
        const wl_ = WIND.long[VV];
        if (wl_.P > 0) add(k, 0, 0, 0, -wl_.P * s, 0, wl_.z > z0 ? wl_.z : z0);
      }
      it[k] = it[k] || { N: 0, Hx: 0, My: 0, Hy: 0, Mx: 0 };
    }
    if (S !== 'C') add('WL', 0, 0, 0, WIND.WLx * s, WIND.WLy * s, WIND.zWL);
    else it.WL = { N: 0, Hx: 0, My: 0, Hy: 0, Mx: 0 };

    const ex: ForceVector5 = { N: 0, Hx: 0, My: 0, Hy: 0, Mx: 0 };
    const ey: ForceVector5 = { N: 0, Hx: 0, My: 0, Hy: 0, Mx: 0 };
    W.filter((e) => e.sec.includes(S)).forEach((e) => {
      const F = kin * e.P;
      ex.Hx += F;
      ex.My += F * (e.z - z0);
      ey.Hy += F;
      ey.Mx += F * (e.z - z0);
    });
    if (S !== 'C') {
      ex.Hx += EQ.Fx;
      ex.My += EQ.Fx * (EQ.zsup - z0);
      ey.Hy += EQ.Fy;
      ey.Mx += EQ.Fy * (EQ.zsup - z0);
    }
    if (SUP.Rqd > 0 && (S === 'A' || geo.zcb > R[S].z + 1e-9)) {
      const F = kin * SUP.Rqd;
      ex.Hx += F;
      ex.My += F * (geo.zcb - z0);
      ey.Hy += F;
      ey.Mx += F * (geo.zcb - z0);
    }
    const mo = EQ.MO[S];
    ex.Hx += mo.dH;
    ex.My += mo.dM;
    it.EQx = ex;
    it.EQy = ey;

    if (S !== 'C') {
      add('FR', 0, 0, 0, FR * s, FR * c, zbg);
      add('TU', 0, 0, 0, TU * s, TU * c, zbg);
      add('CS', 0, 0, 0, CS * s, CS * c, zbg);
    }
    if (S === 'A' && WAu > 0) add('WA', -WAu, x0, 0, 0, 0, 0);
    ['FR', 'TU', 'CS', 'WA', 'CE1', 'CE2', 'BR1', 'BR2', 'EV', 'LS', 'LSV'].forEach((k) => {
      it[k] = it[k] || { N: 0, Hx: 0, My: 0, Hy: 0, Mx: 0 };
    });
    sec[S] = it;
  }

  // ---------- load combinations ----------
  const gEH = I.Kmode === '0' ? [1.35, 0.9] : [1.5, 0.9];
  const P: Record<string, Record<string, number>> = {
    max: { DC: 1.25, DW: 1.5, EV: 1.35, EH: gEH[0] },
    min: { DC: 0.9, DW: 0.65, EV: 1.0, EH: gEH[0] },
    IV: { DC: 1.5, DW: 1.5, EV: 1.35, EH: gEH[0] },
    IVm: { DC: 1.5, DW: 1.5, EV: 1.35, EH: gEH[1] },
    maxE: { DC: 1.25, DW: 1.5, EV: 1.35, EH: gEH[1] },
    one: { DC: 1, DW: 1, EV: 1, EH: 1 },
    dbx: { DC: 1.25, DW: 1.5, EV: 1.35, EH: gEH[0] },
    dbn: { DC: 0.9, DW: 0.65, EV: 1.0, EH: gEH[0] },
  };
  const live = (cfg: string, g: number): Record<string, number> =>
    cfg === '3'
      ? { LS: g, LSV: g }
      : {
          ['LL' + cfg]: g,
          ['IM' + cfg]: g,
          ['PL' + cfg]: g,
          ['BR' + cfg]: g,
          ['CE' + cfg]: g,
          LS: g,
          LSV: g,
        };

  const CB: MoComboSpec[] = [
    {
      id: 'CĐ I-1',
      st: 'CD',
      lim: 'Cường độ I',
      desc: 'Hoạt tải ' + best.n + ' làn trên nhịp + hoạt tải chất thêm sau mố',
      p: 'max',
      f: { ...live('1', 1.75), FR: 1, TU: 0.5 },
      g: {},
    },
    {
      id: 'CĐ I-2',
      st: 'CD',
      lim: 'Cường độ I',
      desc: 'Lệch tâm ngang: 1 làn xe sát lề + hoạt tải chất thêm sau mố',
      p: 'max',
      f: { ...live('2', 1.75), FR: 1, TU: 0.5 },
      g: {},
    },
    {
      id: 'CĐ I-3',
      st: 'CD',
      lim: 'Cường độ I',
      desc: 'Hoạt tải chất thêm sau mố, không có xe trên nhịp; tĩnh tải lấy hệ số nhỏ',
      p: 'min',
      f: { ...live('3', 1.75), FR: 1, TU: 0.5 },
      g: {},
    },
    {
      id: 'CĐ III-1',
      st: 'CD',
      lim: 'Cường độ III',
      desc: 'Gió V = ' + (I.VB * I.S).toFixed(2) + ' m/s; tĩnh tải lấy hệ số lớn',
      p: 'max',
      f: { WSV: 1.4, FR: 1, TU: 0.5 },
      g: {},
    },
    {
      id: 'CĐ III-2',
      st: 'CD',
      lim: 'Cường độ III',
      desc: 'Gió V = ' + (I.VB * I.S).toFixed(2) + ' m/s; tĩnh tải lấy hệ số nhỏ',
      p: 'min',
      f: { WSV: 1.4, FR: 1, TU: 0.5 },
      g: {},
    },
    {
      id: 'CĐ IV',
      st: 'CD',
      lim: 'Cường độ IV',
      desc: 'Tĩnh tải lớn, không có hoạt tải',
      p: 'IV',
      f: { FR: 1, TU: 0.5 },
      g: {},
    },
    {
      id: 'CĐ IV-2',
      st: 'CD',
      lim: 'Cường độ IV',
      desc: 'Tĩnh tải lớn, áp lực đất ngang lấy hệ số nhỏ γEH = 0,9',
      p: 'IVm',
      f: { FR: 1, TU: 0.5 },
      g: {},
    },
    {
      id: 'CĐ I-4',
      st: 'CD',
      lim: 'Cường độ I',
      desc:
        'Hoạt tải ' +
        best.n +
        ' làn trên nhịp, không có hoạt tải chất thêm; áp lực đất ngang lấy hệ số nhỏ γEH = 0,9',
      p: 'maxE',
      f: { ...live('1', 1.75), LS: 0, LSV: 0, FR: 1, TU: 0.5 },
      g: {},
    },
    {
      id: 'CĐ V-1',
      st: 'CD',
      lim: 'Cường độ V',
      desc: 'Hoạt tải ' + best.n + ' làn + gió V = ' + I.V25 + ' m/s',
      p: 'max',
      f: { ...live('1', 1.35), WSV25: 0.4, WL: 1, FR: 1, TU: 0.5 },
      g: {},
    },
    {
      id: 'CĐ V-2',
      st: 'CD',
      lim: 'Cường độ V',
      desc: 'Lệch tâm ngang 1 làn + gió V = ' + I.V25 + ' m/s',
      p: 'max',
      f: { ...live('2', 1.35), WSV25: 0.4, WL: 1, FR: 1, TU: 0.5 },
      g: {},
    },
    {
      id: 'CĐ V-3',
      st: 'CD',
      lim: 'Cường độ V',
      desc: 'Hoạt tải chất thêm sau mố + gió; tĩnh tải lấy hệ số nhỏ',
      p: 'min',
      f: { ...live('3', 1.35), WSV25: 0.4, FR: 1, TU: 0.5 },
      g: {},
    },
    {
      id: 'SD I-1',
      st: 'SD',
      lim: 'Sử dụng I',
      desc: 'Hoạt tải ' + best.n + ' làn + gió V = ' + I.V25 + ' m/s',
      p: 'one',
      f: { ...live('1', 1), WSV25: 0.3, WL: 1, FR: 1, TU: 1 },
      g: {},
    },
    {
      id: 'SD I-2',
      st: 'SD',
      lim: 'Sử dụng I',
      desc: 'Lệch tâm ngang 1 làn + gió V = ' + I.V25 + ' m/s',
      p: 'one',
      f: { ...live('2', 1), WSV25: 0.3, WL: 1, FR: 1, TU: 1 },
      g: {},
    },
    {
      id: 'SD I-3',
      st: 'SD',
      lim: 'Sử dụng I',
      desc: 'Hoạt tải chất thêm sau mố + gió V = ' + I.V25 + ' m/s',
      p: 'one',
      f: { ...live('3', 1), WSV25: 0.3, FR: 1, TU: 1 },
      g: {},
    },
    ...(
      [
        ['a', 'dbx', 'tĩnh tải lấy hệ số lớn'],
        ['b', 'dbn', 'tĩnh tải lấy hệ số nhỏ'],
      ] as const
    ).flatMap(([sx, pp, tx]): MoComboSpec[] => [
      {
        id: 'ĐB I-1' + sx,
        st: 'DB',
        lim: 'Đặc biệt I',
        desc: '100% EQ dọc + 30% EQ ngang; hoạt tải ' + best.n + ' làn; ' + tx,
        p: pp,
        f: { ...live('1', I.gEQ), EQx: 1, EQy: 0.3, FR: 1 },
        g: {},
      },
      {
        id: 'ĐB I-2' + sx,
        st: 'DB',
        lim: 'Đặc biệt I',
        desc: '30% EQ dọc + 100% EQ ngang; lệch tâm ngang 1 làn; ' + tx,
        p: pp,
        f: { ...live('2', I.gEQ), EQx: 0.3, EQy: 1, FR: 1 },
        g: {},
      },
      {
        id: 'ĐB I-3' + sx,
        st: 'DB',
        lim: 'Đặc biệt I',
        desc: '100% EQ dọc + 30% EQ ngang; hoạt tải chất thêm sau mố, không có xe trên nhịp; ' + tx,
        p: pp,
        f: { ...live('3', I.gEQ), EQx: 1, EQy: 0.3, FR: 1 },
        g: {},
      },
    ]),
  ];

  const eta = I.eta > 0 ? I.eta : 1;
  CB.forEach((cb) => {
    cb.g = { ...P[cb.p], ...cb.f };
    if (cb.f.TU != null) cb.g.CS = cb.f.TU;
    if (['min', 'dbn', 'IVm'].includes(cb.p)) cb.g.WA = 1;
    if (cb.st !== 'SD' && eta !== 1) {
      for (const k of Object.keys(cb.g)) {
        const g = cb.g[k];
        if (!g) continue;
        cb.g[k] =
          ['DC', 'DW', 'EV', 'EH'].includes(k) && g < 1 ? g / eta : k === 'WA' ? g : g * eta;
      }
    }
  });

  const comb = {} as Record<'A' | 'B' | 'C', MoComboEntry[]>;
  for (const S of ['A', 'B', 'C'] as const) {
    comb[S] = CB.map((cb) => {
      const tot: ForceVector5 = { N: 0, Hx: 0, My: 0, Hy: 0, Mx: 0 };
      const rows: Array<ForceVector5 & { k: string; g: number }> = [];
      for (const [k, g] of Object.entries(cb.g)) {
        const o = sec[S][k];
        if (!o || !g) continue;
        const r = {
          k,
          g,
          N: g * o.N,
          Hx: g * o.Hx,
          My: g * o.My,
          Hy: g * o.Hy,
          Mx: g * o.Mx,
        };
        rows.push(r);
        for (const q of ['N', 'Hx', 'My', 'Hy', 'Mx'] as const) tot[q] += r[q];
      }
      return { ...cb, rows, tot };
    });
  }

  return {
    err,
    geo,
    W,
    SUP,
    LIVE,
    WG,
    K: { KA, K0, K, cH, sH },
    EV,
    EHs,
    LSs,
    LSv,
    WIND,
    EQ,
    FR,
    FRn,
    TU,
    dU,
    CS,
    eCS,
    WAu,
    sec,
    CB,
    comb,
    gc,
    gs,
    gsu,
    Lw,
    s,
    c,
  };
}

/** Internal forces at horizontal elevation `z` from cap bottom (`08_flexible_abutment_md.js:2175`). */
function moExt(I: MoInput, R: MoCalcResult): void {
  const G = R.geo;
  const d = I.d;
  const DE = I.mtype === 'deo';
  R.W.forEach((e) => {
    let z0 = e.z;
    let z1 = e.z;
    if (DE) {
      const H = G.ztop;
      if (e.no === 1) {
        z0 = 0;
        z1 = d;
      } else if (e.no === 2) {
        z0 = d;
        z1 = H;
      } else if (e.no === 3) {
        z1 = G.zcb;
        z0 = G.zcb - (I.d2 + I.d2b);
      } else if (e.no === 4) {
        z0 = d;
        z1 = H;
      } else if (e.no === 5) {
        z0 = 0;
        z1 = H;
      } else if (e.no === 9) {
        z0 = d;
        z1 = d + I.kt;
      }
    } else {
      if (e.no === 1) {
        z0 = 0;
        z1 = G.zct;
      } else if (e.no === 2) {
        z0 = G.zct;
        z1 = G.zwt;
      } else if (e.no === 3) {
        z0 = G.zwt;
        z1 = G.ztop;
      } else if (e.no === 4) {
        z1 = G.zcb;
        z0 = G.zcb - (I.d2 + I.d2b);
      } else if (e.no === 5 || e.no === 7) {
        z0 = G.zct;
        z1 = G.zct + G.hct;
      } else if (e.no === 8) {
        z0 = G.zwt;
        z1 = G.zwt + I.kt;
      }
    }
    e.z0 = z0;
    e.z1 = z1;
  });
}

function moSecZ(I: MoInput, R: MoCalcResult, z: number) {
  const G = R.geo;
  const DE = I.mtype === 'deo';
  const s = R.s;
  const c = R.c;
  const L = R.LIVE;
  const gs = R.gs;
  const K = R.K.K;
  const cH = R.K.cH;
  const sH = R.K.sH;
  const kin = R.EQ.kin;
  const H = G.ztop - z;
  const top = DE ? z >= I.d - 1e-9 : z >= G.zwt - 1e-9;
  const x0 = top ? G.xw2 + I.t / 2 : DE ? 0 : G.xw1 - I.a / 2;
  const it: Record<string, ForceVector5> = {};
  const add = (
    k: string,
    N: number,
    x: number,
    y: number,
    Hx: number,
    Hy: number,
    zz: number,
  ) => {
    const o = it[k] || (it[k] = { N: 0, Hx: 0, My: 0, Hy: 0, Mx: 0 });
    o.N += N;
    o.Hx += Hx;
    o.Hy += Hy;
    o.My += N * (x - x0) + Hx * (zz - z);
    o.Mx += N * y + Hy * (zz - z);
  };
  const memb = (e: MoWeightItem) => {
    if (DE) return top ? e.no === 2 || e.no === 3 : true;
    return top ? e.no === 3 || e.no === 4 : e.sec.includes('B');
  };
  const vk = (e: MoWeightItem) => (DE ? e.no === 3 : e.no === 4);
  const part = (e: MoWeightItem) => {
    if (!memb(e)) return 0;
    if (vk(e)) return z < (e.z1 ?? e.z) - 1e-9 ? 1 : 0;
    const z0e = e.z0 ?? e.z;
    const z1e = e.z1 ?? e.z;
    if (z1e - z0e < 1e-9) return e.z > z - 1e-9 ? 1 : 0;
    return Math.max(0, Math.min(1, (z1e - Math.max(z, z0e)) / (z1e - z0e)));
  };
  const zp = (e: MoWeightItem) => {
    const z0e = e.z0 ?? e.z;
    const z1e = e.z1 ?? e.z;
    if (vk(e) || z <= z0e + 1e-9) return e.z;
    const a = Math.max(z, z0e);
    return z1e - z0e < 1e-9 ? e.z : (a + z1e) / 2;
  };
  const supOn = DE ? !top : z < G.zwt - 1e-9;
  const SUP = R.SUP;
  if (supOn) {
    add('DC', SUP.DC1, G.xb, 0, 0, 0, 0 + z);
    add('DW', SUP.DW, G.xb, 0, 0, 0, z);
  }
  R.W.forEach((e) => {
    const f = part(e);
    if (f > 0) add('DC', f * e.P, e.x, e.y, 0, 0, zp(e));
  });
  if (SUP.Rqd > 0 && G.zcb > z) add('DC', SUP.Rqd, G.xw2 - I.d9 / 2, 0, 0, 0, G.zcb);
  if (DE && G.zcb > z) {
    add('EV', R.EV.back.V * gs, R.EV.back.x, 0, 0, 0, G.zcb);
    add('LS', R.LSv.N, R.LSv.x, 0, 0, 0, G.zcb);
  }

  const w = () => (DE ? (top ? G.wB : I.Lf) / s : G.wB / s);
  const he = moHeq(Math.max(H, 0.01));
  const n = 60;
  let Eh = 0;
  let Me = 0;
  let Ls = 0;
  let Ml = 0;
  for (let i = 0; i < n; i++) {
    const zz = z + ((i + 0.5) * H) / n;
    const dz = H / n;
    const ww = w();
    const pe = K * gs * (G.ztop - zz);
    const pl = K * gs * he;
    Eh += pe * ww * dz;
    Me += pe * ww * dz * (zz - z);
    Ls += pl * ww * dz;
    Ml += pl * ww * dz * (zz - z);
  }
  {
    const o = (it.EH = it.EH || { N: 0, Hx: 0, My: 0, Hy: 0, Mx: 0 });
    o.Hx += Eh * cH * s;
    o.Hy += Eh * cH * c;
    o.My += Me * cH * s;
    o.Mx += Me * cH * c;
    const xB = top ? G.xw2 : DE ? -I.b / 2 : G.xw2;
    o.N += Eh * sH;
    o.My += Eh * sH * (xB - x0);
  }
  {
    const o = (it.LS = it.LS || { N: 0, Hx: 0, My: 0, Hy: 0, Mx: 0 });
    o.Hx += Ls * s;
    o.Hy += Ls * c;
    o.My += Ml * s;
    o.Mx += Ml * c;
  }
  for (const [key, l] of [
    ['1', L.best],
    ['2', L.one],
  ] as const) {
    if (supOn) {
      add('LL' + key, l.LL, G.xb, l.ey, 0, 0, z);
      add('IM' + key, l.IM, G.xb, l.ey, 0, 0, z);
      add('PL' + key, L.PL, G.xb, L.yPL, 0, 0, z);
      add('BR' + key, 0, 0, 0, l.BR * L.kL * s, l.BR * L.kL * c, G.ztop + 1.8);
      add('CE' + key, 0, 0, 0, 0, l.CE, G.ztop + 1.8);
    }
  }
  for (const VV of ['V', 'V25'] as const) {
    const k = 'WS' + VV;
    it[k] = it[k] || { N: 0, Hx: 0, My: 0, Hy: 0, Mx: 0 };
    if (supOn) {
      R.WIND.sets[VV]
        .filter((wItem) => DE || wItem.sec.includes('B'))
        .forEach((wItem) => {
          if (wItem.z > z) add(k, 0, 0, 0, -wItem.P * c, wItem.P * s, wItem.z);
        });
      const wl_ = R.WIND.long[VV];
      if (wl_.P > 0) add(k, 0, 0, 0, -wl_.P * s, 0, Math.max(wl_.z, z));
    }
  }
  if (supOn) add('WL', 0, 0, 0, R.WIND.WLx * s, R.WIND.WLy * s, R.WIND.zWL);
  if (supOn) {
    add('FR', 0, 0, 0, R.FR * s, R.FR * c, G.zbg);
    add('TU', 0, 0, 0, R.TU * s, R.TU * c, G.zbg);
  }
  const ex: ForceVector5 = { N: 0, Hx: 0, My: 0, Hy: 0, Mx: 0 };
  const ey: ForceVector5 = { N: 0, Hx: 0, My: 0, Hy: 0, Mx: 0 };
  R.W.forEach((e) => {
    const f = part(e);
    if (f > 0) {
      const F = kin * f * e.P;
      const zz = zp(e);
      ex.Hx += F;
      ex.My += F * (zz - z);
      ey.Hy += F;
      ey.Mx += F * (zz - z);
    }
  });
  if (supOn) {
    const E = R.EQ;
    ex.Hx += E.Fx;
    ex.My += E.Fx * (E.zsup - z);
    ey.Hy += E.Fy;
    ey.Mx += E.Fy * (E.zsup - z);
  }
  if (SUP.Rqd > 0 && G.zcb > z) {
    const F = kin * SUP.Rqd;
    ex.Hx += F;
    ex.My += F * (G.zcb - z);
    ey.Hy += F;
    ey.Mx += F * (G.zcb - z);
  }
  {
    const KA = R.K.KA.K;
    const KAE = R.EQ.KAE;
    const kv = I.kv || 0;
    const wm = w();
    const EAE = 0.5 * gs * H * H * (1 - kv) * (Number.isFinite(KAE) ? KAE : 0) * wm;
    const EA = 0.5 * KA * gs * H * H * wm;
    ex.Hx += EAE - EA;
    ex.My += EAE * 0.5 * H - (EA * H) / 3;
  }
  it.EQx = ex;
  it.EQy = ey;
  [
    'FR',
    'TU',
    'CE1',
    'CE2',
    'BR1',
    'BR2',
    'EV',
    'LS',
    'WL',
    'DW',
    'IM1',
    'IM2',
    'LL1',
    'LL2',
    'PL1',
    'PL2',
  ].forEach((k) => {
    it[k] = it[k] || { N: 0, Hx: 0, My: 0, Hy: 0, Mx: 0 };
  });

  const out = R.CB.map((cb) => {
    const tot: ForceVector5 = { N: 0, Hx: 0, My: 0, Hy: 0, Mx: 0 };
    for (const [k, g] of Object.entries(cb.g)) {
      const o = it[k];
      if (!o || !g) continue;
      for (const q of ['N', 'Hx', 'My', 'Hy', 'Mx'] as const) tot[q] += g * o[q];
    }
    return tot;
  });
  return { z, top, x0, it, out };
}

export const MO = {
  G: 9.81,
  r: moDegToRad,
  mL: moMultiPresence,
  heq: moHeq,
  coulomb: moCoulomb,
  kae: moKae,
  csm: moCsm,
  trapX: moTrapX,
  trapZ: moTrapZ,
  calc: moCalc,
  ext: moExt,
  secZ: moSecZ,
} as const;

// ---------------------------------------------------------------------------
// 5. Input Reader, Step Runners & Pile-Group Link (`moInputs`, `moStep`, `moLink`)
// ---------------------------------------------------------------------------

function ltnNLocal(): number {
  return Math.max(1, Math.round(num('ln_n') || 1));
}

function ltnLexpLocal(I: { Lt: number }): number | null {
  const bltnEl = $('tq_bltn');
  if (!bltnEl || bltnEl.value !== '1' || ltnNLocal() < 2) return null;
  const n = ltnNLocal();
  const g = num('ln_gap') || 0;
  return (n * I.Lt * 1000 + (n - 1) * g) / 2;
}

export function moInputs(): MoInput {
  const raw: Record<string, any> = {};

  for (const k of Object.keys(MO_STR_DEFAULTS)) {
    const el = $('mo_' + k);
    raw[k] = el ? String(el.value ?? '') : MO_STR_DEFAULTS[k];
  }
  for (const k of Object.keys(MO_NUM_DEFAULTS)) {
    const el = $('mo_' + k);
    if (el) {
      const val = parseFloat(String(el.value ?? '').replace(',', '.'));
      raw[k] = Number.isFinite(val) ? val : 0;
    } else {
      raw[k] = MO_NUM_DEFAULTS[k];
    }
  }
  for (const k of MO_TEXT_META_KEYS) {
    const el = $('mo_' + k);
    if (el) {
      const val = parseFloat(String(el.value ?? '').replace(',', '.'));
      raw[k] = Number.isFinite(val) ? val : 0;
    } else {
      raw[k] = 0;
    }
  }

  if (typeof document !== 'undefined') {
    document.querySelectorAll('[id^="mo_"]').forEach((node) => {
      if (!/^(INPUT|SELECT)$/.test(node.tagName)) return;
      const e = node as HTMLInputElement | HTMLSelectElement;
      const k = e.id.slice(3);
      if (MO_STR[k]) {
        raw[k] = String(e.value ?? '');
      } else {
        const val = parseFloat(String(e.value ?? '').replace(',', '.'));
        raw[k] = Number.isFinite(val) ? val : 0;
      }
    });
  }

  const I = raw as MoInput;
  I.VB = [38, 45, 53, 59][(I.wz || 2) - 1] ?? 45;
  I.dT = Math.max(I.Tmax - I.Tset, I.Tset - I.Tmin, 0);
  I.alT = 10.8e-6;
  I.Lb = (() => {
    try {
      const Lx = ltnLexpLocal({ Lt: I.Lt });
      if (Lx) return Lx / 1000 - I.a0;
    } catch {
      // fallback to simple span half-length
    }
    return (I.Lt - 2 * I.a0) / 2;
  })();

  {
    const t = $('o_moLbT');
    if (t) {
      const ch = I.Lb > (I.Lt - 2 * I.a0) / 2 + 1e-9;
      const w = ch
        ? 'Khoảng cách từ điểm cố định nhiệt đến tim kê dầm trên mố: chuỗi ' +
          ltnNLocal() +
          ' nhịp nối liên tục nhiệt (bản liên tục nhiệt trên trụ), điểm cố định ở giữa chuỗi, Lb = (n.Lt + (n - 1).g)/2 - a0'
        : 'Khoảng cách từ điểm cố định nhiệt đến gối trên mố: nhịp giản đơn, điểm cố định ở giữa nhịp, Lb = Ls/2';
      if (t.textContent !== w) t.textContent = w;
    }
  }

  I.Ab = I.bga * I.bgb;
  I.Wsu = I.Wb - I.Wpat - I.Wpap - I.WPLt - I.WPLp;
  I.mtype = mdOn() ? 'deo' : 'nang';
  I.MD = mdHooks.inputs ? mdHooks.inputs() : { B5: num('md_B5'), H4: num('md_H4') };
  if (I.mtype === 'deo') I.f = 0;
  I.d1 = 0.7;

  {
    const e = $('mo_d1');
    if (e) {
      if (e.value !== '0.70') e.value = '0.70';
      e.readOnly = true;
      if (e.style) e.style.background = '#eee';
      e.title = 'Đỉnh gờ kê bản quá độ cố định 0,70 m dưới đỉnh tường đỉnh';
    }
  }

  return I;
}

export const moTxt = (arr: ReadonlyArray<{ id?: string; v: readonly number[] }>): string =>
  arr
    .map((r) =>
      r.v.map((val) => (Math.abs(val) < 5e-3 ? 0 : val).toFixed(2).padStart(10)).join(''),
    )
    .join('\n');

export function moLink(): void {
  const srcEl = $('mc_src');
  const on = Boolean(srcEl && srcEl.value === 'mo' && MOR && !MOR.err.length);
  ['mc_LCD', 'mc_LDB', 'mc_Ax', 'mc_By', 'mc_Cz'].forEach((id) => {
    const el = $(id);
    if (el) el.readOnly = on;
  });
  if (!on || !MOR || !MOR.link) return;
  sv('mc_LCD', moTxt(MOR.link.CD));
  sv('mc_LDB', moTxt(MOR.link.DB));
  const b = $('mo_b') ? num('mo_b') : MO_NUM_DEFAULTS.b;
  const Lf = $('mo_Lf') ? num('mo_Lf') : MO_NUM_DEFAULTS.Lf;
  const d = $('mo_d') ? num('mo_d') : MO_NUM_DEFAULTS.d;
  const f = $('mo_f') ? num('mo_f') : MO_NUM_DEFAULTS.f;
  sv('mc_Ax', String(+b.toFixed(3)));
  sv('mc_By', String(+Lf.toFixed(3)));
  sv('mc_Cz', String(+(d + (mdOn() ? 0 : f)).toFixed(3)));
}

export function moStep(): MoCalcResult | null {
  const I = moInputs();
  let R: MoCalcResult;
  const setO = (id: string, val: string | number, dg = 3) => {
    set('o_mo' + id, typeof val === 'string' ? val : fx(val, dg));
  };

  try {
    R = MO.calc(I);
  } catch (e) {
    MOR = null;
    set('mo_err', 'Lỗi tính mố: ' + (e instanceof Error ? e.message : String(e)));
    return null;
  }
  MOR = R;
  set('mo_err', R.err.join(' ; '));

  const G = R.geo;
  const L = R.LIVE;
  setO('htm', G.htm);
  setO('htm2', G.htm);
  setO('VB', I.VB, 0);
  setO('dT', I.dT, 1);
  setO('alT', I.alT.toExponential(2));
  setO('Lb', I.Lb, 3);
  setO('Ab', I.Ab, 4);
  setO('Wsu', I.Wsu, 2);
  setO('bd', I.Wb / Math.max(I.Hg + I.Hd + I.Hpa, 1e-6), 2);
  setO('ELbot', G.ELbot);
  setO('b2', G.b2);
  setO('n', G.n);
  setO('d3', G.d3);
  setO('hct', G.hct);
  setO('b4', G.b4);
  setO('Ls', L.Ls);
  setO('DC1', R.SUP.DC1, 2);
  setO('DW', R.SUP.DW, 2);
  setO('Rqd', R.SUP.Rqd, 2);
  setO('WLL', L.WLL, 2);
  setO('nL', String(L.nL));
  setO('PL', L.PL, 2);
  setO('BR1', L.BR1, 2);
  setO('kL', L.kL, 2);
  setO('Cce', L.C_ce, 4);
  setO('Gam', R.K.KA.G, 4);
  setO('Ka', R.K.KA.K, 4);
  setO('K0', R.K.K0, 4);
  setO('LSv', R.LSv.N, 2);
  setO('Vw', R.WIND.V, 2);
  setO('WLo', R.WIND.WLy, 2);
  setO('psi', R.EQ.psi, 3);
  setO('Csm', R.EQ.Csm, 4);
  setO('KAE', R.EQ.KAE, 4);
  setO('kin', R.EQ.kin, 4);
  setO('Fsup', R.EQ.Fx, 2);
  setO('Flk', fx(R.EQ.Flx, 2) + ' ; ' + fx(R.EQ.Fly, 2));
  setO('FR', R.FR, 2);
  setO('TU', R.TU, 2);
  setO('CS', R.CS, 2);
  set('o_moeCSa', fx(R.eCS * 1e6, 1));

  // Self-weight table
  let t =
    '<tr><th>TT</th><th colspan="2">Hạng mục</th><th>V (m3)</th><th>P (kN)</th><th>x (m)</th><th>y (m)</th><th>z (m)</th><th>Mặt cắt</th></tr>';
  let sV = 0;
  let sP = 0;
  let sx = 0;
  let sy = 0;
  let sz = 0;
  R.W.forEach((e) => {
    sV += e.V;
    sP += e.P;
    sx += e.P * e.x;
    sy += e.P * e.y;
    sz += e.P * e.z;
    t += `<tr><td class="c">${e.no}</td><td class="l" colspan="2">${e.name}</td><td>${fx(e.V, 3)}</td><td>${fx(e.P, 2)}</td><td>${fx(e.x, 3)}</td><td>${fx(e.y, 3)}</td><td>${fx(e.z, 3)}</td><td class="c">${e.sec
      .split('')
      .map((ch) => ch + '-' + ch)
      .join(', ')}</td></tr>`;
  });
  t += `<tr class="grp"><td colspan="3">Tổng (DC2)</td><td style="text-align:right">${fx(sV, 3)}</td><td style="text-align:right">${fx(sP, 2)}</td><td style="text-align:right">${fx(sx / sP, 3)}</td><td style="text-align:right">${fx(sy / sP, 3)}</td><td style="text-align:right">${fx(sz / sP, 3)}</td><td></td></tr>`;
  set('tbMoW', t);

  // Single-lane live load table
  t = '<tr><th>Tải trọng</th><th>Trục</th><th>P (kN)</th><th>x (m)</th><th>y</th><th>P.y (kN)</th></tr>';
  [145, 145, 35].forEach((P, i) => {
    t += `<tr><td class="l">${i ? '' : 'Xe tải thiết kế'}</td><td class="c">P${i + 1}</td><td>${fx(P, 1)}</td><td>${fx(i * 4.3, 2)}</td><td>${fx(L.yT[i], 4)}</td><td>${fx(P * L.yT[i], 2)}</td></tr>`;
  });
  t += `<tr><td class="l" colspan="5">Cộng: R xe tải</td><td>${fx(L.RT, 2)}</td></tr>`;
  [110, 110].forEach((P, i) => {
    t += `<tr><td class="l">${i ? '' : 'Xe hai trục'}</td><td class="c">P${i + 1}</td><td>${fx(P, 1)}</td><td>${fx(i * 1.2, 2)}</td><td>${fx(L.yD[i], 4)}</td><td>${fx(P * L.yD[i], 2)}</td></tr>`;
  });
  t += `<tr><td class="l" colspan="5">Cộng: R xe hai trục</td><td>${fx(L.RD, 2)}</td></tr>`;
  t += `<tr><td class="l">Tải trọng làn</td><td class="c">q = 9,3</td><td colspan="3" class="c">ω = Ls/2 = ${fx(L.Ls / 2, 3)} m</td><td>${fx(L.RL, 2)}</td></tr>`;
  t += `<tr class="grp"><td colspan="5">Dùng ${L.useT ? 'xe tải' : 'xe hai trục'}: R xe = ${fx(L.Rax, 2)} kN ; R làn = ${fx(L.RL, 2)} kN</td><td></td></tr>`;
  set('tbMoLL', t);

  t =
    '<tr><th>Số làn n</th><th>mL</th><th>ey (m)</th><th>LL (kN)</th><th>IM (kN)</th><th>BR (kN)</th><th>CE (kN)</th><th>Dùng cho</th></tr>';
  L.lanes.forEach((l) => {
    t += `<tr><td class="c">${l.n}</td><td>${fx(l.m, 2)}</td><td>${fx(l.ey, 3)}</td><td>${fx(l.LL, 2)}</td><td>${fx(l.IM, 2)}</td><td>${fx(l.BR, 2)}</td><td>${fx(l.CE, 2)}</td><td class="c">${[l === L.best ? '(1)' : '', l === L.one ? '(2)' : ''].filter(Boolean).join(' ')}</td></tr>`;
  });
  set('tbMoLn', t);

  // EV
  const gs = R.gs;
  const EV = R.EV;
  const isMd = mdOn();
  t = '<tr><th colspan="2">Hạng mục</th><th>V (m3)</th><th>N (kN)</th><th>x (m)</th><th>My (kN.m)</th></tr>';
  t += `<tr><td class="l" colspan="2">${isMd ? 'Đất đắp trên đỉnh bệ (trước tường đỉnh)' : 'Đất đắp trên mũi bệ'}</td><td>${fx(EV.front.V, 3)}</td><td>${fx(EV.front.V * gs, 2)}</td><td>${fx(EV.front.x, 3)}</td><td>${fx(EV.front.V * gs * EV.front.x, 2)}</td></tr>`;
  t += `<tr><td class="l" colspan="2">${isMd ? 'Đất đắp trên mấu đỡ bản quá độ' : 'Đất đắp trên gót bệ'}</td><td>${fx(EV.back.V, 3)}</td><td>${fx(EV.back.V * gs, 2)}</td><td>${fx(EV.back.x, 3)}</td><td>${fx(EV.back.V * gs * EV.back.x, 2)}</td></tr>`;
  t += `<tr class="grp"><td colspan="2">Tổng EV</td><td style="text-align:right">${fx(EV.front.V + EV.back.V, 3)}</td><td style="text-align:right">${fx(EV.N, 2)}</td><td></td><td style="text-align:right">${fx(EV.My, 2)}</td></tr>`;
  set('tbMoEV', t);

  const SN: Readonly<Record<'A' | 'B' | 'C', string>> = { A: 'A-A', B: 'B-B', C: 'C-C' };
  const secsLoop: Array<'A' | 'B' | 'C'> = isMd ? ['A', 'C'] : ['A', 'B', 'C'];

  t =
    '<tr><th>Mặt cắt</th><th>H (m)</th><th>w (m)</th><th>K</th><th>p (kPa)</th><th>EH (kN)</th><th>ez (m)</th><th>M (kN.m)</th></tr>';
  for (const S of secsLoop) {
    const e = R.EHs[S];
    t += `<tr><td class="c">${SN[S]}</td><td>${fx(e.H, 3)}</td><td>${fx(e.w, 2)}</td><td>${fx(R.K.K, 4)}</td><td>${fx(e.P, 2)}</td><td>${fx(e.E, 2)}</td><td>${fx(e.z, 3)}</td><td>${fx(e.Hx * e.z, 2)}</td></tr>`;
  }
  set('tbMoEH', t);

  t =
    '<tr><th>Mặt cắt</th><th>H (m)</th><th>heq (m)</th><th>Δp (kPa)</th><th>w (m)</th><th>LS (kN)</th><th>ez (m)</th><th>M (kN.m)</th></tr>';
  for (const S of secsLoop) {
    const e = R.LSs[S];
    t += `<tr><td class="c">${SN[S]}</td><td>${fx(e.H, 3)}</td><td>${fx(e.he, 3)}</td><td>${fx(e.dp, 3)}</td><td>${fx(e.w, 2)}</td><td>${fx(e.Hx, 2)}</td><td>${fx(e.z, 3)}</td><td>${fx(e.Hx * e.z, 2)}</td></tr>`;
  }
  set('tbMoLS', t);

  t = `<tr><th colspan="2">Hạng mục</th><th>Cd</th><th>At (m2)</th><th>PD, V = ${fx(R.WIND.V, 2)} (kN)</th><th>PD, V2 = ${fx(R.WIND.V25, 1)} (kN)</th><th>z (m)</th></tr>`;
  R.WIND.sets.V.forEach((w, i) => {
    const w2 = R.WIND.sets.V25[i];
    t += `<tr><td class="l" colspan="2">${w.name}</td><td>${fx(w.Cd, 2)}</td><td>${fx(w.At, 3)}</td><td>${fx(w.P, 2)}</td><td>${fx(w2.P, 2)}</td><td>${fx(w.z, 3)}</td></tr>`;
  });
  if (R.WIND.long.V.P > 0) {
    t += `<tr><td class="l" colspan="2">Gió dọc lên mặt trước tường thân</td><td>1.00</td><td>${fx(R.WIND.long.V.At, 3)}</td><td>${fx(-R.WIND.long.V.P, 2)}</td><td>${fx(-R.WIND.long.V25.P, 2)}</td><td>${fx(R.WIND.long.V.z, 3)}</td></tr>`;
  }
  set('tbMoWS', t);

  t =
    '<tr><th>Mặt cắt</th><th>H (m)</th><th>w (m)</th><th>EAE (kN)</th><th>EA (kN)</th><th>ΔE (kN)</th><th>ΔM (kN.m)</th></tr>';
  for (const S of secsLoop) {
    const e = R.EQ.MO[S];
    t += `<tr><td class="c">${SN[S]}</td><td>${fx(e.H, 3)}</td><td>${fx(e.w, 2)}</td><td>${fx(e.EAE, 2)}</td><td>${fx(e.EA, 2)}</td><td>${fx(e.dH, 2)}</td><td>${fx(e.dM, 2)}</td></tr>`;
  }
  set('tbMoMO', t);

  // Unfactored section summary tables
  for (const S of ['A', 'B', 'C'] as const) {
    t =
      '<tr><th colspan="3">Tải trọng</th><th>Ký hiệu</th><th>N (kN)</th><th>Hx (kN)</th><th>My (kN.m)</th><th>Hy (kN)</th><th>Mx (kN.m)</th></tr>';
    MOKEYS.forEach(([k, nm]) => {
      const o = R.sec[S][k];
      if (!o) return;
      if (S === 'C' && /^(LL|IM|PL|DW|FR|TU|WL|WS|BR|CE)/.test(k) && !o.N && !o.Hx && !o.Hy) {
        return;
      }
      t += `<tr><td class="l" colspan="3">${nm}</td><td class="c">${MOSYM(k)}</td><td>${fx(o.N, 2)}</td><td>${fx(o.Hx, 2)}</td><td>${fx(o.My, 2)}</td><td>${fx(o.Hy, 2)}</td><td>${fx(o.Mx, 2)}</td></tr>`;
    });
    set('tbMoS' + S, t);
  }

  // Load factors table
  const gv = (cb: MoComboSpec, k: string) => cb.g[k] || 0;
  const f2 = (val: number) => (val ? fx(val, 2) : '-');
  t =
    '<tr><th colspan="2">Tổ hợp</th><th>DC ; DW</th><th>EV ; EH</th><th>LL, IM, PL, BR, CE</th><th>LS</th><th>WS</th><th>WL</th><th>EQ (X ; Y)</th><th>FR ; TU</th></tr>';
  R.CB.forEach((cb, i) => {
    const lv = gv(cb, 'LL1')
      ? f2(gv(cb, 'LL1')) + ' (1)'
      : gv(cb, 'LL2')
        ? f2(gv(cb, 'LL2')) + ' (2)'
        : '-';
    const ws = gv(cb, 'WSV')
      ? f2(gv(cb, 'WSV')) + ' (V)'
      : gv(cb, 'WSV25')
        ? f2(gv(cb, 'WSV25')) + ' (V2)'
        : '-';
    const eq =
      gv(cb, 'EQx') || gv(cb, 'EQy') ? f2(gv(cb, 'EQx')) + ' ; ' + f2(gv(cb, 'EQy')) : '-';
    t += `<tr><td class="l" colspan="2">${i + 1}. ${cb.id}</td><td class="c">${f2(gv(cb, 'DC'))} ; ${f2(gv(cb, 'DW'))}</td><td class="c">${f2(gv(cb, 'EV'))} ; ${f2(gv(cb, 'EH'))}</td><td class="c">${lv}</td><td class="c">${f2(gv(cb, 'LS'))}</td><td class="c">${ws}</td><td class="c">${f2(gv(cb, 'WL'))}</td><td class="c">${eq}</td><td class="c">${f2(gv(cb, 'FR'))} ; ${f2(gv(cb, 'TU'))}</td></tr>`;
  });
  set('tbMoG', t);

  // Combination results tables
  const head =
    '<tr><th>TT</th><th>Tổ hợp</th><th>N (kN)</th><th>Hx (kN)</th><th>My (kN.m)</th><th>Hy (kN)</th><th>Mx (kN.m)</th></tr>';
  for (const S of ['A', 'B', 'C'] as const) {
    t = head;
    let st = '';
    R.comb[S].forEach((cb, i) => {
      if (cb.st !== st) {
        st = cb.st;
        t += `<tr class="grp"><td colspan="7">${st === 'CD' ? 'TTGH CƯỜNG ĐỘ' : st === 'SD' ? 'TTGH SỬ DỤNG' : 'TTGH ĐẶC BIỆT'}</td></tr>`;
      }
      const o = cb.tot;
      t += `<tr><td class="c">${i + 1}</td><td class="l">${cb.id}</td><td>${fx(o.N, 2)}</td><td>${fx(o.Hx, 2)}</td><td>${fx(o.My, 2)}</td><td>${fx(o.Hy, 2)}</td><td>${fx(o.Mx, 2)}</td></tr>`;
    });
    set('tbMoC' + S, t);
  }

  const NM = Object.fromEntries(MOKEYS);
  R.comb.A.forEach((cb, i) => {
    let td = `<tr class="grp"><td colspan="9">${i + 1}. ${cb.id} (${cb.lim}): ${cb.desc}</td></tr><tr><th colspan="3">Tải trọng</th><th>γ</th><th>N (kN)</th><th>Hx (kN)</th><th>My (kN.m)</th><th>Hy (kN)</th><th>Mx (kN.m)</th></tr>`;
    cb.rows.forEach((r) => {
      td += `<tr><td class="l" colspan="3">${NM[r.k] || r.k}</td><td>${fx(r.g, 2)}</td><td>${fx(r.N, 2)}</td><td>${fx(r.Hx, 2)}</td><td>${fx(r.My, 2)}</td><td>${fx(r.Hy, 2)}</td><td>${fx(r.Mx, 2)}</td></tr>`;
    });
    const o = cb.tot;
    td += `<tr><td class="l" colspan="3"><b>Tổng</b></td><td></td><td><b>${fx(o.N, 2)}</b></td><td><b>${fx(o.Hx, 2)}</b></td><td><b>${fx(o.My, 2)}</b></td><td><b>${fx(o.Hy, 2)}</b></td><td><b>${fx(o.Mx, 2)}</b></td></tr>`;
    set('tbMoD' + (i + 1), td);
  });

  // Link to pile head forces sheet (T, T.m)
  const k = 9.81;
  const row = (o: ForceVector5) => [o.Hx / k, o.Hy / k, o.N / k, o.Mx / k, o.My / k, 0];
  const cd = R.comb.A.filter((cb) => cb.st !== 'DB');
  const db = R.comb.A.filter((cb) => cb.st === 'DB');
  R.link = {
    CD: cd.map((cb) => ({ id: cb.id, v: row(cb.tot) })),
    DB: db.map((cb) => ({ id: cb.id, v: row(cb.tot) })),
  };
  t =
    '<tr><th>TT</th><th>Tổ hợp</th><th>Hx (T)</th><th>Hy (T)</th><th>P (T)</th><th>Mx (T.m)</th><th>My (T.m)</th><th>Mz (T.m)</th></tr>';
  for (const [lab, arr] of [
    ['TTGH CƯỜNG ĐỘ VÀ SỬ DỤNG', R.link.CD],
    ['TTGH ĐẶC BIỆT', R.link.DB],
  ] as const) {
    t += `<tr class="grp"><td colspan="8">${lab}</td></tr>`;
    arr.forEach((r, i) => {
      t += `<tr><td class="c">${i + 1}</td><td class="l">${r.id}</td>${r.v.map((val) => `<td>${fx(val, 2)}</td>`).join('')}</tr>`;
    });
  }
  set('tbMoLk', t);

  // Seismic intensity class & wingwall tables
  setO('cap', 'Cấp ' + (I.A <= 0.08 ? 6 : I.A <= 0.19 ? 7 : 8) + ' (A = ' + fx(I.A, 2) + ')');
  if (R.WG.plate !== undefined) {
    mdHooks.wingTab?.(R);
  } else {
    const W = R.WG;
    setO('WH', W.H);
    setO('Wu', W.u);
    setO('Whe', W.he);
    setO('WpLS', W.pLS, 3);
    setO('WpEQ', W.pEQ, 3);
    let tw =
      '<tr><th>Mặt cắt</th><th>b (m)</th><th>A tải (m2)</th><th>V EH (kN)</th><th>M EH (kN.m)</th><th>V LS (kN)</th><th>M LS (kN.m)</th><th>V EQ (kN)</th><th>M EQ (kN.m)</th></tr>';
    for (const key of ['E', 'F', 'G'] as const) {
      const o = W.sec[key] as MoWingSectionResult;
      tw += `<tr><td class="c">${o.name}</td><td>${fx(o.b, 3)}</td><td>${fx(o.A, 3)}</td><td>${fx(o.EH.V, 2)}</td><td>${fx(o.EH.M, 2)}</td><td>${fx(o.LS.V, 2)}</td><td>${fx(o.LS.M, 2)}</td><td>${fx(o.EQ.V, 2)}</td><td>${fx(o.EQ.M, 2)}</td></tr>`;
    }
    set('tbMoWg', tw);
    tw =
      '<tr><th>TT</th><th>Tổ hợp</th><th>V E-E (kN)</th><th>M E-E (kN.m)</th><th>V F-F (kN)</th><th>M F-F (kN.m)</th><th>V G-G (kN)</th><th>M G-G (kN.m)</th></tr>';
    W.CW.forEach((cb, i) => {
      tw +=
        `<tr><td class="c">${i + 1}</td><td class="l">${cb.id}</td>` +
        (['E', 'F', 'G'] as const)
          .map((key) => {
            const q = (W.sec[key] as MoWingSectionResult).comb[i];
            return `<td>${fx(q.V, 2)}</td><td>${fx(q.M, 2)}</td>`;
          })
          .join('') +
        '</tr>';
    });
    set('tbMoWgC', tw);
  }

  try {
    mdHooks.vis?.();
  } catch {
    // optional MD visibility hook
  }
  try {
    mdHooks.than?.(R, I);
    mdHooks.wingAll?.(R);
  } catch (e) {
    console.error(e);
  }

  const hooks = getVisualHooks();
  if (isMd) {
    try {
      hooks.renderAbutmentFlex?.({ result: { kind: 'mo', I, R } });
      set('o_mdEL2', fx(I.ELmc - I.jtm, 3));
      set('o_mdH', fx(G.ztop, 3));
      set('o_mdH3', fx(G.H3 ?? 0, 3));
      set('o_moLSv2', fx(R.LSv.N, 2));
    } catch (e) {
      console.error(e);
    }
  }
  hooks.renderAbutmentHeavy?.({ result: { kind: 'mo', I, R, md: isMd } });
  moLink();
  return R;
}

// ---------------------------------------------------------------------------
// 6. Abutment Section RC Checks (`rcStep` — Module 03:2472-2550)
// ---------------------------------------------------------------------------

export function rcStep(): RcMRuntimeState {
  const M = rcMat();
  const rcm: RcMRuntimeState = { M, res: {} };
  RCM = rcm;
  if (!MOR || MOR.err.length) return rcm;

  const I = moInputs();
  const W = MOR.WG;
  const fromComb = (
    arr: readonly MoComboEntry[],
    km: keyof ForceVector5,
    kv: keyof ForceVector5,
  ): RcLoadInput[] =>
    arr.map((cb) => ({
      id: cb.id,
      st: cb.st,
      M: cb.tot[km],
      V: cb.tot[kv],
      N: cb.tot.N,
    }));

  rcm.res.cc = rcRender(
    'cc',
    rcSec('cc', I.L * 1000, I.t * 1000),
    M,
    fromComb(MOR.comb.C, 'My', 'Hx'),
    'Mặt sau',
    'Mặt trước',
  );

  if (mdOn()) {
    for (const pf of ['wy', 'wx'] as const) {
      const sc = W.sec[pf];
      if (!sc) continue;
      rcm.res[pf] = rcRender(
        pf,
        rcSec(pf, 1000, W.u * 1000),
        M,
        (sc.comb as Array<{ id: string; st: LimitStateType; M: number; V: number }>).map((cb) => ({
          id: cb.id,
          st: cb.st,
          M: cb.M,
          V: cb.V,
          N: 0,
        })),
        'Mặt trong (phía đất đắp)',
        'Mặt ngoài',
      );
      set(
        'o_rc' + pf + 'pos',
        pf === 'wx'
          ? 'Tường cánh tại mép ngàm vào bệ, tường đỉnh (dải cao 1 m)'
          : 'Tường cánh, vị trí Myy lớn nhất (dải rộng 1 m)',
      );
    }
  } else {
    rcm.res.bx = rcRender(
      'bx',
      rcSec('bx', I.L * 1000, I.a * 1000),
      M,
      fromComb(MOR.comb.B, 'My', 'Hx'),
      'Mặt sau',
      'Mặt trước',
    );
    rcm.res.by = rcRender(
      'by',
      rcSec('by', I.a * 1000, I.L * 1000),
      M,
      fromComb(MOR.comb.B, 'Mx', 'Hy'),
      'Mặt phải',
      'Mặt trái',
    );
    for (const [pf, k] of [
      ['ee', 'E'],
      ['ff', 'F'],
      ['gg', 'G'],
    ] as const) {
      const s = W.sec[k] as MoWingSectionResult;
      if (!s) continue;
      rcm.res[pf] = rcRender(
        pf,
        rcSec(pf, s.b * 1000, W.u * 1000),
        M,
        s.comb.map((cb) => ({ id: cb.id, st: cb.st, M: cb.M, V: cb.V, N: 0 })),
        'Mặt trong',
        'Mặt ngoài',
      );
    }
  }

  const vals = Object.values(rcm.res).filter((o): o is RcSectionCheckWithOk => Boolean(o));
  const ok = vals.length > 0 && vals.every((o) => o.ok);
  rcm.ok = ok;
  klDiv(
    'tab5',
    'o_rcAll',
    ok,
    ok ? 'CÁC MẶT CẮT MỐ ĐẠT YÊU CẦU' : 'CÓ MẶT CẮT KHÔNG ĐẠT (xem các ô NG ở trên)',
  );
  getVisualHooks().renderAbutmentHeavy?.({ result: { kind: 'rc', rcm, mor: MOR } });
  return rcm;
}

// ---------------------------------------------------------------------------
// 7. Pile-Cap Bending, Shear, STM & Punching (`capStep`, `punchStep`)
// ---------------------------------------------------------------------------

export function punchStep(
  I: MoInput,
  piles: ReadonlyArray<{ x: number; y: number }>,
  out: ReadonlyArray<CapComboInternalForce>,
  R: (ci: number, pi: number) => number,
  S1: { h: number; f1: { dc: number } },
  dv: number,
  Dp: number,
): PunchCheckResult {
  const fc = RCM!.M.fc;
  const bx = I.b;
  const by = I.Lf;
  const rc = (Dp + dv) / 2;

  set('pu_fc', fc, 1);
  set('pu_D', Dp * 1000, 0);
  set('pu_de', S1.h - S1.f1.dc, 0);
  set('pu_dv', dv * 1000, 0);
  set('pu_rc', rc * 1000, 0);

  const eps = 1e-7;
  const P = piles.map((p) => {
    const ex = bx / 2 - Math.abs(p.x);
    const ey = by / 2 - Math.abs(p.y);
    return {
      x: p.x,
      y: p.y,
      ex,
      ey,
      nx: ex < rc ? Math.sign(p.x) || 1 : 0,
      ny: ey < rc ? Math.sign(p.y) || 1 : 0,
    };
  });
  type PunchPileInfo = (typeof P)[number];

  const inReg = (p: PunchPileInfo, q: readonly [number, number]) => {
    const dx = q[0] - p.x;
    const dy = q[1] - p.y;
    if (Math.hypot(dx, dy) < rc - eps) return true;
    if (p.nx && p.ny) {
      return (
        (dx * p.nx > eps && dy * p.ny > -rc + eps) ||
        (dy * p.ny > eps && dx * p.nx > -rc + eps)
      );
    }
    if (p.nx) return dx * p.nx > eps && Math.abs(dy) < rc - eps;
    if (p.ny) return dy * p.ny > eps && Math.abs(dx) < rc - eps;
    return false;
  };
  const inCap = (q: readonly [number, number]) =>
    Math.abs(q[0]) < bx / 2 - eps && Math.abs(q[1]) < by / 2 - eps;

  type PunchSegment = [[number, number], [number, number], [number, number]?];
  const segs = (p: PunchPileInfo): PunchSegment[] => {
    const L: PunchSegment[] = [];
    const n = 720;
    for (let k = 0; k < n; k++) {
      const a = (2 * Math.PI * k) / n;
      const b = (2 * Math.PI * (k + 1)) / n;
      const m = (a + b) / 2;
      L.push([
        [p.x + rc * Math.cos(a), p.y + rc * Math.sin(a)],
        [p.x + rc * Math.cos(b), p.y + rc * Math.sin(b)],
        [p.x + rc * Math.cos(m), p.y + rc * Math.sin(m)],
      ]);
    }
    const line = (a: [number, number], b: [number, number], m = 200) => {
      for (let k = 0; k < m; k++) {
        L.push([
          [a[0] + ((b[0] - a[0]) * k) / m, a[1] + ((b[1] - a[1]) * k) / m],
          [a[0] + ((b[0] - a[0]) * (k + 1)) / m, a[1] + ((b[1] - a[1]) * (k + 1)) / m],
        ]);
      }
    };
    if (p.nx) {
      const X = (p.nx * bx) / 2;
      for (const s of [-1, 1]) line([p.x, p.y + s * rc], [X, p.y + s * rc]);
    }
    if (p.ny) {
      const Y = (p.ny * by) / 2;
      for (const s of [-1, 1]) line([p.x + s * rc, p.y], [p.x + s * rc, Y]);
    }
    return L;
  };

  const SG = P.map(segs);
  const keep = (ids: number[]) => {
    const pts: Array<[[number, number], [number, number]]> = [];
    let len = 0;
    ids.forEach((i) =>
      SG[i].forEach(([a, b, mm]) => {
        const m: [number, number] = mm || [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        if (!inCap(m) || ids.some((j) => inReg(P[j], m))) return;
        len += Math.hypot(b[0] - a[0], b[1] - a[1]);
        pts.push([a, b]);
      }),
    );
    return { len, pts };
  };

  // Group piles with overlapping critical punching perimeters
  const par = P.map((_, i) => i);
  const fd = (i: number): number => (par[i] === i ? i : (par[i] = fd(par[i])));
  P.forEach((p, i) =>
    P.forEach((q, j) => {
      if (j <= i) return;
      if (SG[i].some(([a]) => inReg(q, a)) || SG[j].some(([a]) => inReg(p, a))) {
        par[fd(i)] = fd(j);
      }
    }),
  );
  const grp: Record<number, number[]> = {};
  P.forEach((_, i) => {
    const root = fd(i);
    (grp[root] = grp[root] || []).push(i);
  });
  const units = P.map((_, i) => [i]).concat(Object.values(grp).filter((g) => g.length > 1));
  const pos = (p: PunchPileInfo) => (p.nx && p.ny ? 'Góc bệ' : p.nx || p.ny ? 'Mép bệ' : 'Giữa bệ');
  const b0f = (p: PunchPileInfo) =>
    p.nx && p.ny ? 'π.rc/2 + ex + ey' : p.nx ? 'π.rc + 2.ex' : p.ny ? 'π.rc + 2.ey' : '2π.rc';

  let t =
    '<tr><th>Cọc</th><th>x (m)</th><th>y (m)</th><th>ex (m)</th><th>ey (m)</th><th colspan="2">Vị trí</th><th colspan="2">Công thức b0</th><th>b0 (m)</th></tr>';
  const res: PunchCheckUnit[] = units.map((u) => ({ u, ...keep(u) }));
  res
    .filter((r) => r.u.length === 1)
    .forEach((r) => {
      const i = r.u[0];
      const p = P[i];
      t += `<tr><td class="c">${i + 1}</td><td>${fx(p.x, 3)}</td><td>${fx(p.y, 3)}</td><td>${fx(p.ex, 3)}</td><td>${fx(p.ey, 3)}</td><td class="c" colspan="2">${pos(p)}</td><td class="c" colspan="2">${b0f(p)}</td><td>${fx(r.len, 3)}</td></tr>`;
    });
  res
    .filter((r) => r.u.length > 1)
    .forEach((r) => {
      t += `<tr><td class="c" colspan="5">Nhóm cọc ${r.u.map((i) => i + 1).join(', ')}</td><td class="c" colspan="2">Chồng lấn</td><td class="c" colspan="2">Chu vi bao chung</td><td>${fx(r.len, 3)}</td></tr>`;
    });
  set('tbPunG', t);

  const ng = res.filter((r) => r.u.length > 1).length;
  set(
    'pu_grp',
    ng
      ? `Có ${ng} nhóm cọc có chu vi tới hạn chồng nhau, kiểm tra thêm theo nhóm.`
      : 'Chu vi tới hạn của các cọc không chồng lên nhau, kiểm tra riêng từng cọc.',
  );

  const Vn = (b0: number) =>
    (Math.min((0.17 + 0.33 / 1) * Math.sqrt(fc), 0.33 * Math.sqrt(fc)) * b0 * 1000 * dv * 1000) /
    1000;
  const ixs = (st: 'CD' | 'DB') =>
    out
      .map((o, ci) => [o, ci] as const)
      .filter(([o]) => (st === 'DB' ? o.st === 'DB' : o.st !== 'DB' && o.st !== 'SD'));

  t =
    '<tr><th colspan="2">Cọc / nhóm</th><th>b0 (m)</th><th>Vn (kN)</th><th>Tổ hợp CĐ</th><th>Vu CĐ (kN)</th><th>φVn CĐ (kN)</th><th>Tổ hợp ĐB</th><th>Vu ĐB (kN)</th><th>φVn ĐB (kN)</th><th>KL</th></tr>';
  let allOk = true;
  let worst: {
    k: number;
    r: PunchCheckUnit;
    c: { v: number; id: string };
    d: { v: number; id: string };
    vn: number;
  } | null = null;
  const ratios: number[] = [];

  res.forEach((r) => {
    const vn = Vn(r.len);
    const mx = (st: 'CD' | 'DB') => {
      let best: { v: number; id: string } | null = null;
      ixs(st).forEach(([o, ci]) => {
        const val = r.u.reduce((sum, i) => sum + R(ci, i), 0);
        if (!best || val > best.v) best = { v: val, id: o.id };
      });
      return best || { v: 0, id: '-' };
    };
    const c = mx('CD');
    const d = mx('DB');
    const rC = 0.9 * vn;
    const rD = 1.0 * vn;
    const ok = c.v <= rC && d.v <= rD;
    allOk = allOk && ok;
    const k = Math.max(c.v / rC, d.v / rD);
    ratios.push(k);
    if (!worst || k > worst.k) worst = { k, r, c, d, vn };
    t += `<tr><td class="l" colspan="2">${r.u.length > 1 ? 'Nhóm ' + r.u.map((i) => i + 1).join(', ') : 'Cọc ' + (r.u[0] + 1)}</td><td>${fx(r.len, 3)}</td><td>${fx(vn, 1)}</td><td class="c">${c.id}</td><td>${fx(c.v, 1)}</td><td>${fx(rC, 1)}</td><td class="c">${d.id}</td><td>${fx(d.v, 1)}</td><td>${fx(rD, 1)}</td><td class="c ${ok ? 'ok' : 'bad'}">${ok ? 'OK' : 'NG'}</td></tr>`;
  });
  set('tbPun', t);

  latestPunOk = allOk;
  if (typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>).__punOK = allOk;
  }

  if (worst) {
    const wItem = worst as { k: number; r: PunchCheckUnit };
    const klText = `Bất lợi nhất: ${wItem.r.u.length > 1 ? 'nhóm cọc ' + wItem.r.u.map((i) => i + 1).join(', ') : 'cọc ' + (wItem.r.u[0] + 1)}, Vu/φVn = ${fx(wItem.k, 3)} ⇒ ${allOk ? 'Bệ đủ khả năng chống chọc thủng.' : 'Bệ KHÔNG đủ khả năng chống chọc thủng, cần tăng chiều dày bệ hoặc cường độ bê tông.'}`;
    set('pu_kl', klText);
    const e = $('pu_kl');
    if (e) e.className = 'small ' + (allOk ? 'ok' : 'bad');
  }

  // Critical punching perimeter plan diagram
  const sv = $('dgPunch');
  if (sv) {
    const W = 640;
    const pad = 60;
    const k = Math.min((W - 2 * pad) / bx, 420 / by);
    const H = Math.round(by * k + 2 * pad);
    const X = (x: number) => W / 2 + x * k;
    const Y = (y: number) => pad + (by / 2 - y) * k;
    let s = `<rect width="${W}" height="${H}" fill="#fff"/><rect x="${X(-bx / 2)}" y="${Y(by / 2)}" width="${bx * k}" height="${by * k}" fill="#eef3f8" stroke="#1f4e79" stroke-width="1.5"/>`;
    res.forEach((r) => {
      let dPath = '';
      r.pts.forEach(([a, b]) => {
        dPath += `M${X(a[0]).toFixed(1)} ${Y(a[1]).toFixed(1)}L${X(b[0]).toFixed(1)} ${Y(b[1]).toFixed(1)}`;
      });
      s += `<path d="${dPath}" stroke="${r.u.length > 1 ? '#2a7a2a' : '#c0392b'}" stroke-width="1.6" fill="none"/>`;
    });
    P.forEach((p, i) => {
      s += `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="${(Dp / 2) * k}" fill="#d9d9d9" stroke="#333" stroke-width="1.2"/><text x="${X(p.x)}" y="${Y(p.y) + 5}" font-size="14" text-anchor="middle" font-family="Times New Roman">C${i + 1}</text>`;
    });
    const tx = (x: number, y: number, str: string, a = 'middle', rot = 0) => {
      s += `<text x="${x}" y="${y}" font-size="13" text-anchor="${a}" font-family="Times New Roman"${rot ? ` transform="rotate(${rot} ${x} ${y})"` : ''}>${str}</text>`;
    };
    tx(W / 2, Y(-by / 2) + 22, `b = ${fx(bx * 1000, 0)} mm (dọc cầu)`);
    tx(X(-bx / 2) - 14, H / 2, `Lf = ${fx(by * 1000, 0)} mm (ngang cầu)`, 'middle', -90);
    tx(W / 2, 22, `Chu vi tới hạn chọc thủng (cách mép cọc dv/2 = ${fx(dv * 500, 0)} mm)`);
    sv.setAttribute?.('viewBox', `0 0 ${W} ${H}`);
    sv.setAttribute?.('height', String(H));
    sv.innerHTML = s;
  }

  return {
    ok: allOk,
    ratios,
    worstRatio: worst ? (worst as { k: number }).k : 0,
    groups: ng,
    units: res,
  };
}

export function capStep(): CapRuntimeState | null | unknown {
  if (mdOn()) {
    try {
      return mdHooks.capStep?.();
    } catch (e) {
      console.error(e);
    }
    return undefined;
  }

  set('cap_err', '');
  ['tbCapG', 'tbCapP', 'tbCapL', 'tbCapF', 'tbCapV', 'tbPunG', 'tbPun'].forEach((id) => {
    set(id, '');
    const el = $(id);
    if (el) el.innerHTML = '';
  });
  const dgP = $('dgPunch');
  if (dgP) dgP.innerHTML = '';

  if (!MOR || MOR.err.length || !RCM) {
    CAPR = null;
    set('cap_err', 'Chưa có kết quả tính mố.');
    return null;
  }

  const I = moInputs();
  const SFG = sfmOn(mdOn)
    ? sfGrid(
        I.b,
        I.Lf,
        [
          ...MOR.comb.A.filter((c) => c.st !== 'DB'),
          ...MOR.comb.A.filter((c) => c.st === 'DB'),
        ].map((c) => ({ id: c.id, V: c.tot.N, My: c.tot.My, Mx: c.tot.Mx })),
      )
    : null;

  {
    const nt = $('o_cap_sf');
    if (nt?.style) nt.style.display = SFG ? '' : 'none';
  }

  const MCR = contextState.MCR as McrRuntimeState | null;
  if (!MCR && !SFG) {
    CAPR = null;
    set('cap_err', 'Chưa có kết quả nội lực đầu cọc.');
    return null;
  }
  if (!SFG && v('mc_src') !== 'mo') {
    set(
      'cap_err',
      'Kiểm toán bệ cọc cần tổ hợp tải trọng ở sheet nội lực đầu cọc lấy từ sheet tính mố (cùng hệ số tải trọng).',
    );
  }

  const G = MOR.geo;
  const gc = MOR.gc;
  const gs = MOR.gs;
  const d = I.d;
  const f = I.f;
  const b1 = I.b1;
  const b2 = G.b2;
  const Lf = I.Lf;
  const k = 9.81;
  const piles: ReadonlyArray<{ x: number; y: number }> = SFG ? SFG.piles : MCR!.piles;
  const xI = G.xw1;
  const xII = G.xw2;

  const wToe = gc * (d + f / 2) * b1 * Lf;
  const eToe = moTrapX(b1, d + f, d);
  const wHeel = gc * (d + f / 2) * b2 * Lf;
  const eHeel = moTrapX(b2, d + f, d);
  const ev = MOR.EV;
  const wing = MOR.W.filter((e) => e.no === 5 || e.no === 6 || e.no === 7);

  type CapLoadTerm = readonly [string, string, number, number];
  const LI: CapLoadTerm[] = [
    ['Bản thân mũi bệ', 'DC', wToe, eToe],
    ['Đất đắp trên mũi bệ', 'EV', ev.front.V * gs, b1 / 2],
  ];
  const LII: CapLoadTerm[] = [
    ['Bản thân gót bệ', 'DC', wHeel, eHeel],
    ...wing.map((e): CapLoadTerm => [e.name, 'DC', e.P, xII - e.x]),
    ['Đất đắp trên gót bệ', 'EV', ev.back.V * gs, xII - ev.back.x],
    ['Hoạt tải chất thêm trên gót', 'LS', MOR.LSv.N, xII - MOR.LSv.x],
  ];

  let t = '<tr><th colspan="2">Hạng mục</th><th>x (m)</th><th>Thuộc</th><th>Tay đòn (m)</th></tr>';
  t += `<tr><td class="l" colspan="2">Mặt cắt I-I (mép trước tường thân)</td><td>${fx(xI, 3)}</td><td class="c">-</td><td class="c">-</td></tr><tr><td class="l" colspan="2">Mặt cắt II-II (mép sau tường thân)</td><td>${fx(xII, 3)}</td><td class="c">-</td><td class="c">-</td></tr>`;
  (SFG ? [] : piles).forEach((p, i) => {
    const z = p.x > xI + 1e-9 ? 'I-I' : p.x < xII - 1e-9 ? 'II-II' : 'giữa';
    t += `<tr><td class="l" colspan="2">Cọc ${i + 1} (y = ${fx(p.y, 2)})</td><td>${fx(p.x, 3)}</td><td class="c">${z}</td><td>${z === 'I-I' ? fx(p.x - xI, 3) : z === 'II-II' ? fx(xII - p.x, 3) : '-'}</td></tr>`;
  });
  set('tbCapG', t);

  t =
    '<tr><th colspan="2">Mặt cắt</th><th colspan="2">Tải trọng</th><th>Ký hiệu</th><th>P (kN)</th><th>e (m)</th><th>P.e (kN.m)</th></tr>';
  for (const [nm, arr] of [
    ['I-I', LI],
    ['II-II', LII],
  ] as const) {
    arr.forEach((r) => {
      t += `<tr><td class="c" colspan="2">${nm}</td><td class="l" colspan="2">${r[0]}</td><td class="c">${r[1]}</td><td>${fx(r[2], 2)}</td><td>${fx(r[3], 3)}</td><td>${fx(r[2] * r[3], 2)}</td></tr>`;
    });
  }
  set('tbCapL', t);

  const combos = [
    ...MOR.comb.A.filter((c) => c.st !== 'DB'),
    ...MOR.comb.A.filter((c) => c.st === 'DB'),
  ];
  const rowsCD = SFG ? [] : MCR?.rows['TTGH CƯỜNG ĐỘ VÀ SỬ DỤNG'] || [];
  const rowsDB = SFG ? [] : MCR?.rows['TTGH ĐẶC BIỆT'] || [];
  const nCD = combos.filter((c) => c.st !== 'DB').length;

  const R = (ci: number, pi: number): number => {
    if (SFG) return SFG.R[ci][pi];
    const db = ci >= nCD;
    const rows = db ? rowsDB : rowsCD;
    const th = (db ? ci - nCD : ci) + 1;
    const r = rows.find((q) => q.tc === pi + 1 && q.th === th);
    return r ? r.N * k : NaN;
  };

  t = SFG
    ? ''
    : '<tr><th colspan="2">Tổ hợp</th>' +
      piles.map((_, i) => `<th>Cọc ${i + 1}</th>`).join('') +
      '<th>ΣR (I-I)</th><th>ΣR (II-II)</th></tr>';

  const out: CapComboInternalForce[] = [];
  combos.forEach((c, ci) => {
    const Rs = piles.map((_, i) => R(ci, i));
    let VI = 0;
    let MI = 0;
    let VII = 0;
    let MII = 0;
    piles.forEach((p, i) => {
      if (p.x > xI + 1e-9) {
        VI += Rs[i];
        MI += Rs[i] * (p.x - xI);
      } else if (p.x < xII - 1e-9) {
        VII += Rs[i];
        MII += Rs[i] * (xII - p.x);
      }
    });
    const sI = VI;
    const sII = VII;
    const gf = (key: string) => c.g[key] || 0;
    LI.forEach((r) => {
      VI -= gf(r[1]) * r[2];
      MI -= gf(r[1]) * r[2] * r[3];
    });
    LII.forEach((r) => {
      VII -= gf(r[1]) * r[2];
      MII -= gf(r[1]) * r[2] * r[3];
    });
    out.push({ id: c.id, st: c.st, g: c.g, VI, MI, VII, MII });
    if (!SFG) {
      t += `<tr><td class="l" colspan="2">${c.id}</td>${Rs.map((val) => `<td>${fx(val, 1)}</td>`).join('')}<td>${fx(sI, 1)}</td><td>${fx(sII, 1)}</td></tr>`;
    }
  });
  set('tbCapP', SFG ? SFG.tbl : t);

  if (out.some((o) => !Number.isFinite(o.VI))) {
    CAPR = null;
    set('cap_err', 'Số tổ hợp ở sheet nội lực đầu cọc không khớp với sheet tính mố.');
    return null;
  }

  t =
    '<tr><th colspan="2">Tổ hợp</th><th>γDC</th><th>γEV</th><th>γLS</th><th>V mép I-I (kN)</th><th>M I-I (kN.m)</th><th>V mép II-II (kN)</th><th>M II-II (kN.m)</th></tr>';
  out.forEach((o) => {
    t += `<tr><td class="l" colspan="2">${o.id}</td><td>${fx(o.g.DC || 0, 2)}</td><td>${fx(o.g.EV || 0, 2)}</td><td>${fx(o.g.LS || 0, 2)}</td><td>${fx(o.VI, 2)}</td><td>${fx(o.MI, 2)}</td><td>${fx(o.VII, 2)}</td><td>${fx(o.MII, 2)}</td></tr>`;
  });
  set('tbCapF', t);

  const b = Lf * 1000;
  const h = (d + f) * 1000;
  const S1 = rcSec('c1', b, h);
  const S2 = rcSec('c2', b, h);
  const Dp = SFG ? SFG.D : num('D') / 1000 || 1;

  // Critical shear section at dv from stem face (TCVN 11823-5, Art. 13.3.6.1)
  const dvOf = (S: typeof S1, Mf: number) => {
    const fl = RC.flex(S, RCM!.M, Mf >= 0);
    const T = Mf >= 0 ? S.f1 : S.f2;
    const de = S.h - T.dc;
    return Math.max(de - fl.a / 2, 0.9 * de, 0.72 * S.h) / 1000;
  };
  const frac = (e: number, dv: number) => Math.max(0, Math.min(1, (e - dv) / Dp + 0.5));

  out.forEach((o, ci) => {
    const Rs = piles.map((_, i) => R(ci, i));
    const dvI = dvOf(S1, o.MI);
    const dvII = dvOf(S2, o.MII);
    o.dvI = dvI;
    o.dvII = dvII;
    let vI = 0;
    let vII = 0;
    const gf = (key: string) => o.g[key] || 0;
    piles.forEach((p, i) => {
      if (p.x > xI + 1e-9) vI += frac(p.x - xI, dvI) * Rs[i];
      else if (p.x < xII - 1e-9) vII += frac(xII - p.x, dvII) * Rs[i];
    });
    const part = (r: CapLoadTerm, len: number, dv: number) =>
      r[0].startsWith('Bản thân') || r[0].startsWith('Đất đắp') || r[0].startsWith('Hoạt tải')
        ? Math.max(0, (len - dv) / len)
        : r[3] > dv
          ? 1
          : 0;
    LI.forEach((r) => {
      vI -= gf(r[1]) * r[2] * part(r, b1, dvI);
    });
    LII.forEach((r) => {
      vII -= gf(r[1]) * r[2] * part(r, b2, dvII);
    });
    o.VcI = vI;
    o.VcII = vII;
  });

  let t2 =
    '<tr><th colspan="2">Tổ hợp</th><th>dv I-I (m)</th><th>Vu I-I (kN)</th><th>dv II-II (m)</th><th>Vu II-II (kN)</th></tr>';
  out.forEach((o) => {
    t2 += `<tr><td class="l" colspan="2">${o.id}</td><td>${fx(o.dvI, 3)}</td><td>${fx(o.VcI, 2)}</td><td>${fx(o.dvII, 3)}</td><td>${fx(o.VcII, 2)}</td></tr>`;
  });
  set('tbCapV', t2);

  const c1Res = rcRender(
    'c1',
    S1,
    RCM.M,
    out.map((o) => ({ id: o.id, st: o.st, M: o.MI, V: o.VcI ?? 0, N: 0 })),
    'Mặt dưới',
    'Mặt trên',
  );
  const c2Res = rcRender(
    'c2',
    S2,
    RCM.M,
    out.map((o) => ({ id: o.id, st: o.st, M: o.MII, V: o.VcII ?? 0, N: 0 })),
    'Mặt dưới',
    'Mặt trên',
  );
  const capState: CapRuntimeState = {
    c1: c1Res,
    c2: c2Res,
    out,
    sfgActive: Boolean(SFG),
  };
  CAPR = capState;

  {
    const sv = $('dgSfCap6');
    if (sv?.style) sv.style.display = SFG ? '' : 'none';
    if (SFG) {
      const i = out.reduce((bestIdx, o, j) => (o.MI > out[bestIdx].MI ? j : bestIdx), 0);
      const combMax = combos[i];
      getVisualHooks().renderAbutmentHeavy?.({
        result: {
          kind: 'cap',
          sfCapFig: {
            svId: 'dgSfCap6',
            m: { B: I.b, L: Lf, h: d + f, s1: xII, s2: xI, sName: 'Tường thân' },
            c: { id: combMax.id, V: combMax.tot.N, My: combMax.tot.My, Mx: combMax.tot.Mx },
            lab: ['b1', 'a', 'b2'],
          },
          I,
          capState,
        },
      });
    }
  }

  // Deep-cap Strut-and-Tie check when piles lie within 2d from stem face
  latestCapStmOk = true;
  if (typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>).__capStmOK = true;
  }
  {
    const tb = $('tbCapStm');
    if (tb) tb.innerHTML = '';
    set('o_capStmT', '');
    if (SFG) {
      set(
        'o_capStmT',
        'Móng nông: phản lực nền phân bố trên toàn đáy bệ, kiểm toán theo mặt cắt (mục 2, 3).',
      );
      capState.stm = { active: false, ok: true };
    } else {
      const M = RCM.M;
      const Ab = RC.bar;
      const aw = Math.max(0.3, G.xw1 - G.xw2);
      const xn1 = xI - aw / 4;
      const xn2 = xII + aw / 4;
      const Dm = Dp * 1000;
      const An = (Math.PI * Dm * Dm) / 4;
      const AsB = S1.f1.n * Ab(S1.f1.d);
      const dB = S1.h - S1.f1.dc;
      const jd1 = (0.9 * dB) / 1000;
      const AsT = S2.f2.n * Ab(S2.f2.d);
      const dT = S2.h - S2.f2.dc;
      const jd2 = (0.9 * dT) / 1000;
      const deep = piles.some(
        (p) =>
          (p.x > xI + 1e-9 && p.x - xI < (2 * dB) / 1000) ||
          (p.x < xII - 1e-9 && xII - p.x < (2 * dT) / 1000),
      );
      const strut = (fc: number, es: number, th: number) => {
        const e1 = es + (es + 0.002) / Math.tan(th) ** 2;
        return { e1, fcu: Math.min(fc / (0.8 + 170 * e1), 0.85 * fc) };
      };
      if (!deep) {
        set(
          'o_capStmT',
          'Các cọc nằm ngoài phạm vi 2d tính từ mép tường thân: bệ làm việc như dầm, kiểm toán theo mặt cắt (mục 2, 3).',
        );
        capState.stm = { active: false, ok: true };
      } else {
        const rows: string[] = [];
        let stmOk = true;
        combos.forEach((c, ci) => {
          if (c.st === 'SD') return;
          const Rs = piles.map((_, i) => R(ci, i));
          const ph = c.st === 'DB' ? 1.0 : 0.9;
          const pc = c.st === 'DB' ? 1.0 : 0.7;
          let T1 = 0;
          let T2 = 0;
          let worst: {
            i: number;
            r: number;
            th: number;
            C: number;
            Pr: number;
            Rn: number;
            u: number;
            fcu: number;
          } | null = null;
          piles.forEach((p, i) => {
            const r = Rs[i];
            if (!(r > 0)) return;
            if (p.x > xI + 1e-9) T1 += (r * (p.x - xn1)) / jd1;
            else if (p.x < xII - 1e-9) T2 += (r * (xn2 - p.x)) / jd2;
          });
          piles.forEach((p, i) => {
            const r = Rs[i];
            if (!(r > 0) || (p.x <= xI + 1e-9 && p.x >= xII - 1e-9)) return;
            const front = p.x > xI;
            const len = front ? p.x - xn1 : xn2 - p.x;
            const jd = front ? jd1 : jd2;
            const th = Math.atan(jd / Math.max(len, 0.05));
            const C = r / Math.sin(th);
            const es = front ? (T1 * 1e3) / (200000 * AsB) : (T2 * 1e3) / (200000 * AsT);
            const st = strut(M.fc, es, th);
            const dc = front ? S1.f1.dc : S2.f2.dc;
            const Acs = (Dm * Math.sin(th) + 2 * dc * Math.cos(th)) * Dm;
            const Pr = (pc * st.fcu * Acs) / 1e3;
            const Rn = (0.75 * pc * M.fc * An) / 1e3;
            const u = Math.max(C / Pr, r / Rn, (th * 180) / Math.PI < 25 ? 9 : 0);
            if (!worst || u > worst.u) {
              worst = { i, r, th: (th * 180) / Math.PI, C, Pr, Rn, u, fcu: st.fcu };
            }
          });
          const TrB_ = (ph * M.fy * AsB) / 1e3;
          const TrT_ = (ph * M.fy * AsT) / 1e3;
          const okc =
            T1 <= TrB_ + 1e-6 && T2 <= TrT_ + 1e-6 && (!worst || (worst as { u: number }).u <= 1 + 1e-9);
          stmOk = stmOk && okc;
          const wDesc = worst
            ? (() => {
                const w = worst as { i: number; th: number; C: number; Pr: number; Rn: number };
                return (
                  'Cọc ' +
                  (w.i + 1) +
                  ': θ = ' +
                  fx(w.th, 1) +
                  '° ; C = ' +
                  fx(w.C, 1) +
                  ' ≤ Pr = ' +
                  fx(w.Pr, 1) +
                  ' ; R ≤ ' +
                  fx(w.Rn, 1)
                );
              })()
            : '-';
          rows.push(
            `<tr><td class="l" colspan="2">${c.id}</td><td>${fx(T1, 1)}</td><td>${fx(TrB_, 1)}</td><td>${fx(T2, 1)}</td><td>${fx(TrT_, 1)}</td><td>${wDesc}</td><td class="c ${okc ? 'ok' : 'bad'}">${okc ? 'OK' : 'NG'}</td></tr>`,
          );
        });
        set(
          'o_capStmT',
          `Có cọc nằm trong phạm vi 2d tính từ mép tường thân: bệ là cấu kiện cao, lực cắt tại mặt cắt tới hạn của mục 1.5 không phản ánh đúng sự làm việc nên kiểm toán thêm theo mô hình chống - giằng. Nút lực tường thân cách mép tường a/4 (x = ${fx(xn1, 3)} ; ${fx(xn2, 3)} m); cánh tay đòn jd = 0,9d (${fx(jd1, 3)} ; ${fx(jd2, 3)} m); giằng mũi bệ là cốt thép lớp dưới As = ${fx(AsB, 0)} mm², giằng gót bệ là cốt thép lớp trên As = ${fx(AsT, 0)} mm²; thanh chống từ nút tường tới đầu cọc chịu nén, ứng suất giới hạn fcu = f'c/(0,8 + 170ε1) ≤ 0,85f'c (Điều 6.3.3.3), nút cọc 0,75φf'c (Điều 6.3.5); φ = 0,9 giằng, 0,7 chống - nút (ĐB: 1,0).`,
        );
        set(
          'tbCapStm',
          '<tr><th colspan="2">Tổ hợp</th><th>Giằng mũi T1 (kN)</th><th>φfyAs (kN)</th><th>Giằng gót T2 (kN)</th><th>φfyAs (kN)</th><th>Thanh chống, nút bất lợi nhất (kN)</th><th>KL</th></tr>' +
            rows.join(''),
        );
        latestCapStmOk = stmOk;
        if (typeof window !== 'undefined') {
          (window as unknown as Record<string, unknown>).__capStmOK = stmOk;
        }
        capState.stm = { active: true, ok: stmOk };
      }
    }
  }

  latestPunOk = true;
  if (typeof window !== 'undefined') {
    (window as unknown as Record<string, unknown>).__punOK = true;
  }
  sfPun6(Boolean(SFG));
  sfCap6Txt(Boolean(SFG));

  if (!SFG) {
    try {
      const punchRes = punchStep(I, piles, out, R, S1, dvOf(S1, 1), Dp);
      capState.punching = { ok: punchRes.ok, ratios: punchRes.ratios };
    } catch (e) {
      console.error(e);
    }
  }

  {
    const ok = Boolean(capState.c1?.ok && capState.c2?.ok && latestPunOk && latestCapStmOk);
    capState.ok = ok;
    klDiv(
      'tab6',
      'o_capAll',
      ok,
      SFG
        ? ok
          ? 'BỆ MÓNG ĐẠT YÊU CẦU (uốn, cắt)'
          : 'BỆ MÓNG CÓ HẠNG MỤC KHÔNG ĐẠT (xem các ô NG ở trên)'
        : ok
          ? 'BỆ CỌC ĐẠT YÊU CẦU (uốn, cắt, chọc thủng)'
          : 'BỆ CỌC CÓ HẠNG MỤC KHÔNG ĐẠT (xem các ô NG ở trên)',
    );
  }
  return capState;
}

// ---------------------------------------------------------------------------
// 8. Canonical Result Mapper (`toHeavyAbutmentResult`)
// ---------------------------------------------------------------------------

function toRcSectionResultOnly(r: RcSectionCheckWithOk): RcSectionResult {
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

export function toHeavyAbutmentResult(
  mor: MoCalcResult,
  rcm: RcMRuntimeState | null = RCM,
  cap: CapRuntimeState | null = CAPR,
): AbutmentResult {
  const sectionChecks: Record<string, RcSectionResult> = {};
  if (rcm?.res) {
    for (const [key, val] of Object.entries(rcm.res)) {
      if (val) sectionChecks[key] = toRcSectionResultOnly(val);
    }
  }

  const comb = {} as Record<'A' | 'B' | 'C', AbutmentComboEntry[]>;
  for (const S of ['A', 'B', 'C'] as const) {
    comb[S] = mor.comb[S].map((cb) => ({
      id: cb.id,
      st: cb.st,
      lim: cb.lim,
      desc: cb.desc,
      tot: { ...cb.tot },
      rows: cb.rows.map((r) => ({ ...r })),
    }));
  }

  const primaryCapRc = cap?.c1 ?? cap?.c2 ?? null;
  const capCheck: AbutmentResult['capCheck'] = primaryCapRc
    ? {
        rc: toRcSectionResultOnly(primaryCapRc),
        punching: cap?.punching,
        stm: cap?.stm ? { active: Boolean(cap.stm.active), ok: Boolean(cap.stm.ok) } : undefined,
      }
    : undefined;

  const okAll =
    mor.err.length === 0 &&
    (rcm ? Boolean(rcm.ok) : true) &&
    (cap ? Boolean(cap.ok) : true);

  return {
    variant: 'heavy',
    err: [...mor.err],
    sec: mor.sec,
    comb,
    sectionChecks: Object.keys(sectionChecks).length ? sectionChecks : undefined,
    capCheck,
    okAll,
  };
}
