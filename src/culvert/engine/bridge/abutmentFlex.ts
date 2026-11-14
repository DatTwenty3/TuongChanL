/**
 * BangTinhCauCong Web App — Flexible Abutment (Mố dẻo) Solver (`MD`).
 *
 * Clean-room TypeScript port of `analysis-cau-cong/modules/08_flexible_abutment_md.js`
 * (excluding `MO.ext` & `MO.secZ`, which are already implemented in `./abutmentHeavy.ts`).
 *
 * Covers:
 * - Self-weight breakdown for flexible abutment on single-row piles (`MD.selfW`)
 * - Cantilever wingwall 4-node Mindlin plate FEM delegation (`MD.plate`, `MD.wing`)
 * - Elastic-beam-on-pile-springs cap distribution & live-load lever placement (`mdCapDef`, `mdCapLoad`, `mdLLsets`, `mdFlex`)
 * - Cap section checks (`mdCapStep`) and strut-and-tie deep beam checks (`mdSTM`, TCVN 11823-5 §6.3 / §8.1.1)
 * - Geometry/load/contour/envelope SVG helpers + late-binding bridge hook registration
 */

import type {
  AbutmentComboEntry,
  AbutmentResult,
  LimitStateType,
  MindlinPlateResult,
  RcMaterialProps,
  RcSectionResult,
} from '../../types/project.ts';
import {
  $,
  contextState,
  fx,
  getIDP,
  getVisualHooks,
  klDiv,
  num,
  set,
  sv,
  v,
} from '../context.ts';
import {
  MC,
  type McCapSoilInput,
  type McPileInput,
  type McRunResult,
  type McrRuntimeState,
} from '../foundations/pileGroup.ts';
import { RC, rcMat, rcRender, rcSec, type RcSectionCheckWithOk } from '../math/rc.ts';
import {
  mdPlateSolve,
  summarizeMindlinPlate,
  type MindlinPlateElementResult,
  type MindlinPlateMeshResult,
} from '../math/rcmFrame.ts';
import {
  mdP,
  mdSvgBox,
  qDH,
  qDV,
  qL,
  qT,
  qdSvg,
  type MdSvgBoxResult,
} from '../../graphics/svgPrimitives.ts';
import {
  MO,
  getLatestCapResult,
  getLatestMorResult,
  getLatestRcmResult,
  moInputs,
  registerMdBridgeHooks,
  setLatestCapResult,
  type CapRuntimeState,
  type MoCalcResult,
  type MoComboEntry,
  type MoGeo,
  type MoInput,
  type MoWeightItem,
} from './abutmentHeavy.ts';
import { SUPDIST, moXF, type SupDistResult } from './crossfall.ts';

export { moXF, mdSvgBox, mdP, type MdSvgBoxResult };

// ---------------------------------------------------------------------------
// 1. Domain & Runtime Types
// ---------------------------------------------------------------------------

export interface MdInputs {
  B5: number;
  H4: number;
}

export type MdSelfWeightAdder = (
  no: number,
  name: string,
  V: number,
  x: number,
  y: number,
  z: number,
  secStr: string,
) => MoWeightItem;

export interface MdSelfWeightParams {
  b: number;
  t: number;
  d: number;
  L: number;
  xw2: number;
  xb: number;
  ztop: number;
  wB: number;
  geo: MoGeo;
}

export interface MdWingInput {
  K: number;
  KA: { G: number; K: number };
  KAE: number;
  gs: number;
  gc: number;
  kin: number;
  geo: MoGeo;
}

export interface MdWingElementComb {
  Mx: number;
  My: number;
  Qx: number;
  Qy: number;
}

export interface MdWingPlateResult extends MindlinPlateMeshResult {
  sgn?: number;
  comb?: MdWingElementComb[][];
}

export interface MdWingComboItem {
  id: string;
  st: LimitStateType;
  g: Record<string, number>;
  M: number;
  V: number;
  at: { M: number; V: number; z: number; x?: number };
}

export interface MdWingResult {
  plate: MdWingPlateResult | null;
  H: number;
  H4: number;
  he: number;
  u: number;
  pLS: number;
  pEQ: number;
  dK: number;
  CW: Array<{ id: string; st: LimitStateType; g: Record<string, number> }>;
  sec: {
    wx: { name: string; comb: MdWingComboItem[] };
    wy: { name: string; comb: MdWingComboItem[] };
  };
  B5: number;
}

export type MdCapLoadEntry =
  | [string, string, 'q', number, [number, number]]
  | [string, string, 'p', number, number];

export interface MdCapDef {
  D: MdCapLoadEntry[];
  ys: number[];
  ng: number;
  C1: number;
  sup: SupDistResult;
}

export interface MdCapLoadResult {
  q: Array<[number, number, number]>;
  pts: Array<[number, number]>;
  Ng: number;
  Pg: number[];
}

export interface MdLanePlacement {
  g: Float64Array;
  p: Float64Array;
  k: number;
  m: number;
  u: number;
  veh: number[];
  cfg: '1' | '2';
}

export interface MdLlSets {
  s1: MdLanePlacement[];
  s2: MdLanePlacement[];
}

export interface MdFlexBeamState {
  tag: string;
  LD: MdCapLoadResult;
  uE: Float64Array;
  Rv: number[];
  Rm: number[];
  at: (y: number) => [number, number];
  Nm?: number;
  Mp?: number;
  Mn?: number;
  pl?: MdLanePlacement;
}

export interface MdFlexComboResult {
  sts: MdFlexBeamState[];
  dN: number[];
  dM: number[];
}

export interface MdFlexRuntimeState {
  ok: boolean;
  CD: MdFlexComboResult[];
  DB: MdFlexComboResult[];
  kv: number;
  kt: number;
  kvA: number[];
  ktA: number[];
  EI: number;
  Y: number[];
  pn: number[];
  PYm: number[];
}

export interface MdCapMomentExtremum {
  M: number;
  y: number;
  V: number;
}

export interface MdCapOutEntry {
  id: string;
  st: LimitStateType;
  c: MoComboEntry;
  N: number;
  Mx: number;
  Pg: number[];
  Rs: number[];
  Ms: Array<[number, number]>;
  res: number;
  mn: MdCapMomentExtremum;
  mx: MdCapMomentExtremum;
  pts: Array<[number, number]>;
  q: Array<[number, number, number]>;
  dN: number;
  dM: number;
  Vu?: number;
}

export interface MdCapRuntimeState {
  out: MdCapOutEntry[];
  ys: number[];
  piles: McPileInput[];
  PY: number[];
  C1: number;
  yy: number[];
}

export interface MdStmSegmentDetail {
  o: MdCapOutEntry;
  Mx: number;
  V: number;
  a: number;
  th: number;
  T: number;
  Cs: number;
  As: number;
  Tr: number;
  es: number;
  e1: number;
  fcu: number;
  ws: number;
  Acs: number;
  Pr: number;
  R: number;
  Rn: number;
  An: number;
  z0: number;
  top: boolean;
  ok: boolean;
  u: number;
}

export interface MdStmSegment {
  nm: string;
  k: 'c' | 's';
  a: number;
  b: number;
  sup: number[];
  r: MdStmSegmentDetail | null;
  need: boolean;
}

export interface MdStmRuntimeState {
  segs: MdStmSegment[];
  need: boolean;
  offS: boolean;
  strict: boolean;
  ok: boolean;
  okR: boolean;
  okSk: boolean;
  okSt: boolean;
  okS: boolean;
  jd: number;
  AsB: number;
  AsT: number;
  rhoH: number;
  rhoV: number;
  AskReq: number;
  AskPro: number;
  AtReq: number;
  AtPro: number;
  smx: number;
}

// ---------------------------------------------------------------------------
// 2. Module State & Accessors
// ---------------------------------------------------------------------------

let MDFLEX: MdFlexRuntimeState | null = null;
let MDCAP: MdCapRuntimeState | null = null;
let MDSTM: MdStmRuntimeState | null = null;

export function getLatestMdFlexResult(): MdFlexRuntimeState | null {
  return MDFLEX;
}

export function setLatestMdFlexResult(state: MdFlexRuntimeState | null): void {
  MDFLEX = state;
}

export function getLatestMdCapResult(): MdCapRuntimeState | null {
  return MDCAP;
}

export function setLatestMdCapResult(state: MdCapRuntimeState | null): void {
  MDCAP = state;
}

export function getLatestMdStmResult(): MdStmRuntimeState | null {
  return MDSTM;
}

export function setLatestMdStmResult(state: MdStmRuntimeState | null): void {
  MDSTM = state;
}

// ---------------------------------------------------------------------------
// 3. Mode Check, Geometry Self-Weight, Mindlin Plate & Wingwall Solver (`MD`)
// ---------------------------------------------------------------------------

/** True when flexible abutment ("deo") mode is selected on `#tq_mot`. */
export function mdOn(): boolean {
  const e = $('tq_mot');
  return Boolean(e && e.value === 'deo');
}

export function mdInputs(): MdInputs {
  return {
    B5: num('md_B5'),
    H4: num('md_H4'),
  };
}

export function mdSelfW(
  I: MoInput,
  DE: MdInputs,
  o: MdSelfWeightParams,
  el: MdSelfWeightAdder,
): void {
  const { b, t, d, L, xw2, xb, ztop, wB, geo } = o;
  const jtm = I.jtm;
  const H = ztop;

  el(1, 'Bệ mố', b * d * I.Lf, 0, 0, d / 2, 'A');
  el(2, 'Tường đỉnh', t * jtm * L, xw2 + t / 2, 0, d + jtm / 2, 'ABC');

  const h1 = I.d2 + I.d2b;
  const h2 = I.d2;
  const Ac = ((h1 + h2) / 2) * I.d9;
  const zt = ztop - I.d1;
  geo.Acb = Ac;
  geo.zcb = zt;
  geo.Af = 0;
  geo.hJ = 0;

  // Approach slab bracket sits on cap if lower than cap top, otherwise in sections A/B/C
  el(
    3,
    'Mấu đỡ bản quá độ',
    Ac * wB,
    xw2 - MO.trapX(I.d9, h1, h2),
    0,
    zt - MO.trapZ(h1, h2),
    zt - h1 >= d - 1e-6 ? 'ABC' : 'A',
  );

  const u2 = I.ut + I.up;
  const y = (I.ut * (L / 2 - I.ut / 2) - I.up * (L / 2 - I.up / 2)) / Math.max(u2, 1e-9);
  const lt = Math.max(0, I.wc - DE.B5 - t);
  const At = lt * jtm;
  const H4 = Math.max(0, Math.min(DE.H4, H));
  const Ad = (DE.B5 * (H + H4)) / 2;

  el(4, 'Tường cánh (phần thân)', At * u2, xw2 + t + lt / 2, y, d + jtm / 2, 'A');
  el(
    5,
    'Tường cánh (phần đuôi)',
    Ad * u2,
    xw2 - MO.trapX(DE.B5, H, H4),
    y,
    H - MO.trapZ(H, H4),
    'A',
  );

  geo.wingSide = At + Ad;
  geo.wingA = Ad;
  geo.lt = lt;
  geo.H4 = H4;
  geo.H3 = H - H4;

  el(
    6,
    'Gờ lan can trên tường cánh',
    2 * I.Ag * I.wc,
    xw2 + t + lt - I.wc / 2,
    0,
    ztop + I.hg / 2,
    'A',
  );

  {
    const XX = moXF(I, I.Lf);
    el(7, 'Đá kê gối', I.dkx * I.dky * XX.sumH, xb, 0, d + I.dkh / 2, 'A');
    if (XX.dV > 1e-9) {
      el(1, 'Bệ mố - phần hạ do dốc ngang mặt mũ (trừ)', -b * XX.dV, 0, 0, d, 'A');
    }
  }

  el(8, 'Ụ chống xô', I.unx * I.uny * I.unh * I.unn, xb, 0, d + I.unh / 2, 'A');

  // Shear keys / cheek walls on I-girder bridges
  {
    const lf = Math.max(0, b / 2 - (xw2 + t));
    geo.lTai = lf;
    if (I.kt > 0 && I.vt > 0 && lf > 0) {
      el(9, 'Tường tai', 2 * I.kt * I.vt * lf, xw2 + t + lf / 2, 0, d + I.kt / 2, 'A');
    }
  }
}

/** 4-node Mindlin plate FEM solver delegating directly to `mdPlateSolve`. */
export function mdPlate(
  B5: number,
  H: number,
  H4: number,
  t: number,
  cases: Array<(y: number) => number>,
  nu = 16,
  nv = 16,
): MdWingPlateResult {
  return mdPlateSolve(B5, H, H4, t, cases, nu, nv);
}

export function mdWing(I: MoInput, DE: MdInputs, o: MdWingInput): MdWingResult {
  const { K, KA, KAE, gs, gc, kin, geo } = o;
  const H = geo.ztop;
  const H4 = Math.max(0.05, Math.min(DE.H4, H));
  const u = Math.min(I.ut, I.up) || Math.max(I.ut, I.up);
  const he = MO.heq(H);
  const dK = (Number.isFinite(KAE) ? KAE : KA.K) - KA.K;
  const pLS = K * gs * he;
  const pEQ = 0.5 * gs * H * (1 - (I.kv || 0)) * Math.max(0, dK) + kin * gc * u;
  const cases: Array<(z: number) => number> = [
    (z: number) => K * gs * Math.max(0, H - z),
    () => pLS,
    () => pEQ,
  ];
  const P: MdWingPlateResult | null =
    DE.B5 > 0.05 && u > 0 ? mdPlate(DE.B5, H, H4, u, cases) : null;
  const gE = I.Kmode === '0' ? 1.35 : 1.5;
  const CW: Array<{ id: string; st: LimitStateType; g: Record<string, number> }> = [
    { id: 'CĐ I', st: 'CD', g: { EH: gE, LS: 1.75 } },
    { id: 'CĐ V', st: 'CD', g: { EH: gE, LS: 1.35 } },
    { id: 'ĐB I', st: 'DB', g: { EH: 1, LS: I.gEQ, EQ: 1 } },
    { id: 'SD I', st: 'SD', g: { EH: 1, LS: 1 } },
  ];
  const sec: MdWingResult['sec'] = {
    wx: { name: 'Mxx', comb: [] },
    wy: { name: 'Myy', comb: [] },
  };

  if (P) {
    // Sign convention: positive clamped moment tensions the backfill side
    const nu = P.nu;
    const root = P.els.map((_, k) => (k % nu === 0 ? k : -1)).filter((k) => k >= 0);
    const s0 = Math.sign(root.reduce((a, k) => a + P.res[0][k].Mx, 0)) || 1;
    const combVal = (
      g: Record<string, number>,
      k: number,
      f: keyof Pick<MindlinPlateElementResult, 'Mx' | 'My' | 'Qx' | 'Qy'>,
    ) =>
      (g.EH || 0) * P.res[0][k][f] +
      (g.LS || 0) * P.res[1][k][f] +
      (g.EQ || 0) * P.res[2][k][f];

    P.sgn = s0;
    P.comb = CW.map((c) =>
      P.els.map((_, k) => ({
        Mx: s0 * combVal(c.g, k, 'Mx'),
        My: s0 * combVal(c.g, k, 'My'),
        Qx: combVal(c.g, k, 'Qx'),
        Qy: combVal(c.g, k, 'Qy'),
      })),
    );

    CW.forEach((c, ci) => {
      const R = P.comb![ci];
      let bx = { M: 0, V: 0, z: 0 };
      for (let j = 0; j < P.nv; j++) {
        const k1 = j * nu;
        const k2 = k1 + 1;
        const x1 = P.cen[k1][0];
        const x2 = P.cen[k2][0];
        const M0 = R[k1].Mx + ((R[k1].Mx - R[k2].Mx) * x1) / (x2 - x1);
        if (Math.abs(M0) > Math.abs(bx.M)) {
          bx = { M: M0, V: Math.abs(R[k1].Qx), z: P.cen[k1][1] };
        }
      }
      let by = { M: 0, V: 0, x: 0, z: 0 };
      R.forEach((r, k) => {
        if (Math.abs(r.My) > Math.abs(by.M)) {
          by = { M: r.My, V: Math.abs(r.Qy), x: P.cen[k][0], z: P.cen[k][1] };
        }
      });
      const Vx = Math.max(...root.map((k) => Math.abs(R[k].Qx)));
      const Vy = Math.max(...R.map((r) => Math.abs(r.Qy)));
      sec.wx.comb.push({ ...c, M: bx.M, V: Vx, at: bx });
      sec.wy.comb.push({ ...c, M: by.M, V: Vy, at: by });
    });
  }

  return { plate: P, H, H4, he, u, pLS, pEQ, dK, CW, sec, B5: DE.B5 };
}

export const MD = {
  inputs: mdInputs,
  selfW: mdSelfW,
  plate: mdPlate,
  wing: mdWing,
} as const;

// ---------------------------------------------------------------------------
// 4. Transverse Cap Load Distribution & Elastic Beam on Pile Springs (`MDFLEX`)
// ---------------------------------------------------------------------------

export function mdCapDef(
  I: MoInput,
  G: MoGeo,
  morOverride?: MoCalcResult | null,
): MdCapDef {
  const MOR = morOverride ?? getLatestMorResult();
  if (!MOR) {
    throw new Error('MOR result is required for mdCapDef');
  }
  const W = MOR.W;
  const by = (n: number) => W.find((e) => e.no === n) || { P: 0 };
  const C1 = I.Lf;
  const L = I.L;
  const wB = G.wB;
  const ng = Math.max(1, Math.round(I.Ng));
  const Sg = I.Sg;
  const ys = [...Array(ng)].map((_, i) => (i - (ng - 1) / 2) * Sg);
  const yL = L / 2 - I.ut / 2;
  const yR = -(L / 2 - I.up / 2);
  const u2 = I.ut + I.up || 1;

  const D: MdCapLoadEntry[] = [
    ['Bản thân bệ mố', 'DC', 'q', by(1).P, [-C1 / 2, C1 / 2]],
    ['Tường đỉnh', 'DC', 'q', by(2).P, [-L / 2, L / 2]],
    ['Mấu đỡ bản quá độ', 'DC', 'q', by(3).P, [-wB / 2, wB / 2]],
    ['Phản lực bản quá độ', 'DC', 'q', MOR.SUP.Rqd, [-wB / 2, wB / 2]],
    ['Đất đắp trên mấu đỡ (EV)', 'EV', 'q', MOR.EV.back.V * MOR.gs, [-wB / 2, wB / 2]],
    ['Hoạt tải chất thêm trên mấu đỡ (LSv)', 'LS', 'q', MOR.LSv.N, [-wB / 2, wB / 2]],
  ];

  const wing = by(4).P + by(5).P + by(6).P;
  D.push(
    ['Tường cánh, gờ lan can (trái)', 'DC', 'p', (wing * I.ut) / u2, yL],
    ['Tường cánh, gờ lan can (phải)', 'DC', 'p', (wing * I.up) / u2, yR],
  );

  if (by(9).P > 0) {
    const yT = L / 2 - I.vt / 2;
    D.push(
      ['Tường tai (trái)', 'DC', 'p', by(9).P / 2, yT],
      ['Tường tai (phải)', 'DC', 'p', by(9).P / 2, -yT],
    );
  }

  const U = MOR.SUP;
  const gc = MOR.gc;
  const sup = SUPDIST(ys, {
    Wd: I.Wb,
    bl: I.Wpap + I.WPLp,
    br: I.Wpat + I.WPLt,
    wpA: I.WPLp,
    wpB: I.WPLt,
    DC: U.DC1,
    DCe: 0.5 * (U.Vpa * gc + U.Pra),
    DCs: 0.5 * U.Vpl * gc,
    DW: U.DW,
  });

  return { D, ys, ng, C1, sup };
}

export function mdCapLoad(
  CD0: MdCapDef,
  c: MoComboEntry,
  pl?: MdLanePlacement | null,
): MdCapLoadResult {
  const gf = (kk: string) => c.g[kk] || 0;
  const N = c.tot.N;
  const Mx = c.tot.Mx;
  const ys = CD0.ys;
  const ng = CD0.ng;
  let Nd = 0;
  let Md = 0;
  const q: Array<[number, number, number]> = [];
  const pts: Array<[number, number]> = [];

  CD0.D.forEach((r) => {
    const val = gf(r[1]) * r[3];
    Nd += val;
    if (r[2] === 'q') {
      q.push([r[4][0], r[4][1], val / (r[4][1] - r[4][0])]);
      Md += (val * (r[4][0] + r[4][1])) / 2;
    } else {
      pts.push([r[4], val]);
      Md += val * r[4];
    }
  });

  let NL = 0;
  let ML = 0;
  const cfg = pl ? pl.cfg : null;
  if (cfg) {
    (c.rows || []).forEach((r) => {
      if (r.k === 'LL' + cfg || r.k === 'IM' + cfg || r.k === 'PL' + cfg) {
        NL += r.N;
        ML += r.Mx;
      }
    });
  }

  const Ps = ys.map((_, i) => gf('DC') * CD0.sup.dc[i] + gf('DW') * CD0.sup.dw[i]);
  const Ns = Ps.reduce((a, val) => a + val, 0);
  const Ms = Ps.reduce((a, val, i) => a + val * ys[i], 0);
  const Ng = N - Nd - NL - Ns;
  const Sy2 = ys.reduce((a, y) => a + y * y, 0);
  const Pg = ys.map((y, i) => Ps[i] + Ng / ng + (Sy2 > 0 ? ((Mx - Md - ML - Ms) * y) / Sy2 : 0));

  if (cfg && pl) {
    const gL = gf('LL' + cfg);
    const gP = gf('PL' + cfg);
    ys.forEach((_, i) => {
      Pg[i] += gL * pl.g[i] + gP * pl.p[i];
    });
  }

  ys.forEach((y, i) => pts.push([y, Pg[i]]));
  return { q, pts, Ng: Ng + NL + Ns, Pg };
}

export function mdLLsets(
  I: MoInput,
  CD0: MdCapDef,
  morOverride?: MoCalcResult | null,
): MdLlSets {
  const MOR = morOverride ?? getLatestMorResult();
  const L = MOR?.LIVE;
  const ys = CD0.ys;
  const ng = ys.length;
  if (!L || !L.nL || !ng) return { s1: [], s2: [] };

  const lev = (x: number, P: number, o: Float64Array) => {
    if (ng === 1) {
      o[0] += P;
      return;
    }
    let j = 0;
    if (x <= ys[0]) j = 0;
    else if (x >= ys[ng - 1]) j = ng - 2;
    else {
      while (j < ng - 2 && x > ys[j + 1]) j++;
    }
    const a = ys[j];
    const b = ys[j + 1];
    o[j] += (P * (b - x)) / (b - a);
    o[j + 1] += (P * (x - a)) / (b - a);
  };

  const yL0 = I.Wb / 2 - I.Wpat - I.WPLt;
  const yR0 = -(I.Wb / 2 - I.Wpap - I.WPLp);
  const im = I.IMon ? I.IM : 0;
  const ax = L.Rax * (1 + im);
  const RL = L.RL;
  const p = new Float64Array(ng);

  if (L.PL > 0) {
    const PLw = I.WPLt + I.WPLp;
    (
      [
        [yL0, I.WPLt],
        [yR0 - I.WPLp, I.WPLp],
      ] as const
    ).forEach(([x0, w]) => {
      if (w > 0) {
        for (let k = 0; k < 4; k++) {
          lev(x0 + (w * (k + 0.5)) / 4, (L.PL * w) / PLw / 4, p);
        }
      }
    });
  }

  const mk = (veh: number[], m: number, k: number, u: number) => {
    const g = new Float64Array(ng);
    veh.forEach((x0) => {
      lev(x0 + 0.6, (ax * m) / 2, g);
      lev(x0 + 2.4, (ax * m) / 2, g);
      for (let q = 0; q < 6; q++) {
        lev(x0 + 0.25 + q * 0.5, (RL * m) / 6, g);
      }
    });
    return { g, p, k, m, u, veh };
  };

  const s1: MdLanePlacement[] = [];
  for (let k = 1; k <= L.nL; k++) {
    const m = MO.mL(k);
    const umax = L.WLL - (k - 1) * L.wl - 3.0;
    for (let u = 0; u <= umax + 1e-9; u += 0.25) {
      const veh: number[] = [];
      for (let i = 0; i < k; i++) veh.push(yR0 + u + i * L.wl);
      s1.push({ ...mk(veh, m, k, u), cfg: '1' });
    }
  }
  const s2: MdLanePlacement[] = [{ ...mk([yL0 - 3.0], MO.mL(1), 1, 0), cfg: '2' }];
  return { s1, s2 };
}

export function mdFlexOn(
  piles: ReadonlyArray<McPileInput> | null | undefined,
  morOverride?: MoCalcResult | null,
): boolean {
  const MOR = morOverride ?? getLatestMorResult();
  if (
    !mdOn() ||
    getIDP() !== '' ||
    v('mc_src') !== 'mo' ||
    !MOR ||
    !MOR.comb ||
    !piles ||
    piles.length < 2
  ) {
    return false;
  }
  const x0 = piles[0].x;
  return piles.every((p) => Math.abs(p.x - x0) < 0.05 && Math.abs(p.phi || 0) < 1e-6);
}

export function mdFlex(
  dd: McCapSoilInput,
  piles: McPileInput[],
  R1: McRunResult,
  R2: McRunResult,
  LC: ReadonlyArray<ReadonlyArray<number>>,
  LD: ReadonlyArray<ReadonlyArray<number>>,
  deps?: { mor?: MoCalcResult | null; inputs?: MoInput },
): void {
  MDFLEX = null;
  const MOR = deps?.mor ?? getLatestMorResult();
  if (!mdFlexOn(piles, MOR) || !MOR) return;

  const I = deps?.inputs ?? moInputs();
  const G = MOR.geo;
  const CD0 = mdCapDef(I, G, MOR);
  const C1 = CD0.C1;
  const k = 9.81;
  const cd = MOR.comb.A.filter((c) => c.st !== 'DB');
  const db = MOR.comb.A.filter((c) => c.st === 'DB');
  if (cd.length !== LC.length || db.length !== LD.length) return;

  const kvA = R1.parts.map((q) => q.PK.r1 * k);
  const ktA = R1.parts.map((q) => q.PK.Ky[1][1] * k);
  const kv = kvA.reduce((a, b) => a + b, 0) / kvA.length;
  const kt = ktA.reduce((a, b) => a + b, 0) / ktA.length;
  const M = rcMat();
  const EI = (M.Ec * 1000 * I.b * I.d ** 3) / 12;

  const PYm = piles.map((p) => -p.y);
  const pointCoords = CD0.D.filter((r): r is [string, string, 'p', number, number] => r[2] === 'p').map(
    (r) => r[4],
  );
  const distCoords = CD0.D.filter(
    (r): r is [string, string, 'q', number, [number, number]] => r[2] === 'q',
  ).flatMap((r) => r[4]);

  const pts = [-C1 / 2, C1 / 2, ...PYm, ...CD0.ys, ...pointCoords, ...distCoords]
    .filter((y) => y >= -C1 / 2 - 1e-9 && y <= C1 / 2 + 1e-9)
    .sort((a, b) => a - b);

  const X: number[] = [];
  pts.forEach((y) => {
    if (!X.length || y - X[X.length - 1] > 1e-6) X.push(y);
  });

  const Y: number[] = [X[0]];
  for (let i = 1; i < X.length; i++) {
    const h = X[i] - X[i - 1];
    const m = Math.max(1, Math.ceil(h / 0.2 - 1e-9));
    for (let j = 1; j <= m; j++) {
      Y.push(X[i - 1] + (h * j) / m);
    }
  }

  const nn = Y.length;
  const nd = 2 * nn;
  const idx = (y: number) => {
    let b = 0;
    Y.forEach((val, i) => {
      if (Math.abs(val - y) < Math.abs(Y[b] - y)) b = i;
    });
    return b;
  };
  const pn = PYm.map(idx);

  const build = (ei: number) => {
    const K = Array.from({ length: nd }, () => new Float64Array(nd));
    for (let e = 0; e < nn - 1; e++) {
      const h = Y[e + 1] - Y[e];
      const a = ei / h ** 3;
      const ke = [
        [12, 6 * h, -12, 6 * h],
        [6 * h, 4 * h * h, -6 * h, 2 * h * h],
        [-12, -6 * h, 12, -6 * h],
        [6 * h, 2 * h * h, -6 * h, 4 * h * h],
      ];
      const d = [2 * e, 2 * e + 1, 2 * e + 2, 2 * e + 3];
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          K[d[i]][d[j]] += a * ke[i][j];
        }
      }
    }
    pn.forEach((n, i) => {
      K[2 * n][2 * n] += kvA[i];
      K[2 * n + 1][2 * n + 1] += ktA[i];
    });

    const L = K;
    for (let j = 0; j < nd; j++) {
      let s = L[j][j];
      for (let q = Math.max(0, j - 3); q < j; q++) s -= L[j][q] ** 2;
      L[j][j] = Math.sqrt(s);
      for (let i = j + 1; i < Math.min(nd, j + 4); i++) {
        let val = L[i][j];
        for (let q = Math.max(0, i - 3); q < j; q++) val -= L[i][q] * L[j][q];
        L[i][j] = val / L[j][j];
      }
    }

    return (F: Float64Array) => {
      const y = new Float64Array(nd);
      for (let i = 0; i < nd; i++) {
        let val = F[i];
        for (let q = Math.max(0, i - 3); q < i; q++) val -= L[i][q] * y[q];
        y[i] = val / L[i][i];
      }
      const u = new Float64Array(nd);
      for (let i = nd - 1; i >= 0; i--) {
        let val = y[i];
        for (let q = i + 1; q < Math.min(nd, i + 4); q++) val -= L[q][i] * u[q];
        u[i] = val / L[i][i];
      }
      return u;
    };
  };

  const solE = build(EI);
  const solR = build(EI * 1e5);
  const LLS = mdLLsets(I, CD0, MOR);
  const C1h = C1 / 2;
  const NS = 240;
  const ySm = [...Array(NS + 1)].map((_, i) => -C1h + (C1 * i) / NS);

  const solveLD = (LDc: MdCapLoadResult) => {
    const F = new Float64Array(nd);
    LDc.pts.forEach(([y, P]) => {
      F[2 * idx(y)] += P;
    });
    for (let e = 0; e < nn - 1; e++) {
      const a = Y[e];
      const b = Y[e + 1];
      const h = b - a;
      let w = 0;
      LDc.q.forEach(([qa, qb, qw]) => {
        const o = Math.min(b, qb) - Math.max(a, qa);
        if (o > 1e-12) w += (qw * o) / h;
      });
      if (!w) continue;
      F[2 * e] += (w * h) / 2;
      F[2 * e + 1] += (w * h * h) / 12;
      F[2 * e + 2] += (w * h) / 2;
      F[2 * e + 3] -= (w * h * h) / 12;
    }
    return F;
  };

  const state = (LDc: MdCapLoadResult, uE: Float64Array, tag: string): MdFlexBeamState => {
    const Rv = pn.map((n, i) => kvA[i] * uE[2 * n]);
    const Rm = pn.map((n, i) => ktA[i] * uE[2 * n + 1]);
    const at = (y: number): [number, number] => {
      let Mm = 0;
      let V = 0;
      LDc.pts.forEach(([a, P]) => {
        if (a < y) {
          Mm -= P * (y - a);
          V -= P;
        }
      });
      LDc.q.forEach(([a, b, w]) => {
        if (y > a) {
          const e = Math.min(y, b);
          V -= w * (e - a);
          Mm -= w * (e - a) * (y - (a + e) / 2);
        }
      });
      PYm.forEach((a, i) => {
        if (a < y) {
          Mm += Rv[i] * (y - a);
          V += Rv[i];
          Mm -= Rm[i];
        }
      });
      return [Mm, V];
    };
    return { tag, LD: LDc, uE, Rv, Rm, at };
  };

  const one = (c: MoComboEntry): MdFlexComboResult => {
    const L0 = mdCapLoad(CD0, c);
    const F0 = solveLD(L0);
    const uR = solR(F0);
    const cfg = (['1', '2'] as const).find((key) => (c.g['LL' + key] || 0) > 0);
    let sts: MdFlexBeamState[] = [state(L0, solE(F0), '')];

    if (cfg) {
      const setList = cfg === '1' ? LLS.s1 : LLS.s2;
      let bN: MdFlexBeamState | null = null;
      let bP: MdFlexBeamState | null = null;
      let bM: MdFlexBeamState | null = null;

      setList.forEach((pl) => {
        const Lp = mdCapLoad(CD0, c, pl);
        const uE = solE(solveLD(Lp));
        const S = state(Lp, uE, '');
        let mx = -Infinity;
        let mn = Infinity;
        ySm.forEach((y) => {
          const m = S.at(y)[0];
          if (m > mx) mx = m;
          if (m < mn) mn = m;
        });
        S.Nm = Math.max(...S.Rv);
        S.Mp = mx;
        S.Mn = mn;
        S.pl = pl;
        if (!bN || S.Nm > bN.Nm!) bN = S;
        if (!bP || S.Mp > bP.Mp!) bP = S;
        if (!bM || S.Mn < bM.Mn!) bM = S;
      });

      const lab = (S: MdFlexBeamState) =>
        S.pl!.cfg === '2' ? '' : ` (${S.pl!.k} làn, u = ${fx(S.pl!.u, 2)} m)`;
      if (cfg === '2' && bN) {
        sts = [{ ...(bN as MdFlexBeamState), tag: ' (1 làn sát lề)' }];
      } else if (bN) {
        const bNs = bN as MdFlexBeamState;
        sts = [{ ...bNs, tag: ' - N cọc max' + lab(bNs) }];
        if (bP && bP !== bNs) {
          const bPs = bP as MdFlexBeamState;
          sts.push({ ...bPs, tag: ' - M⁺ max' + lab(bPs) });
        }
        if (bM && bM !== bNs && bM !== bP) {
          const bMs = bM as MdFlexBeamState;
          sts.push({ ...bMs, tag: ' - M⁻ max' + lab(bMs) });
        }
      }
    }

    const g = sts[0];
    return {
      sts,
      dN: pn.map((n, i) => kvA[i] * (g.uE[2 * n] - uR[2 * n])),
      dM: pn.map((n, i) => ktA[i] * (g.uE[2 * n + 1] - uR[2 * n + 1])),
    };
  };

  // Sign of pile-head moment M2 under longitudinal-axis cap rotation from MC.run rigid-cap benchmark
  const T = MC.run(dd, piles, [[0, 0, 0, 100, 0, 0]]).res[0].pf;
  const iy = piles.reduce((b, p, i) => (p.y > piles[b].y ? i : b), 0);
  const i0 = piles.reduce((b, p, i) => (p.y < piles[b].y ? i : b), 0);
  const a = Math.sign(T[iy].N - T[i0].N) || 1;
  const bS = Math.sign(T[iy].M2) || 1;
  const sg = -a * bS;

  const apply = (R: McRunResult, arr: MdFlexComboResult[]) => {
    R.res.forEach((r, kk) => {
      const o = arr[kk];
      r.pf.forEach((f, i) => {
        f.N += o.dN[i] / k;
        f.M2 += (sg * o.dM[i]) / k;
      });
    });
  };

  const ECD = cd.map(one);
  const EDB = db.map(one);
  apply(R1, ECD);
  apply(R2, EDB);
  MDFLEX = { ok: true, CD: ECD, DB: EDB, kv, kt, kvA, ktA, EI, Y, pn, PYm };
}

export function mdFlexTxt(): string {
  const F = MDFLEX;
  if (!F) return '';
  const f = (val: number, d?: number) => fx(val, d);
  return (
    `Bệ mố dẻo dài ${f(F.Y[F.Y.length - 1] - F.Y[0], 2)} m đặt trên một hàng ${F.pn.length} cọc không đủ cứng để coi là tuyệt đối cứng theo phương ngang cầu: lực dọc N và mômen M2 (uốn quanh trục dọc cầu) ở bảng dưới đã hiệu chỉnh theo mô hình dầm đàn hồi kê trên các gối lò xo tại đầu cọc (TCVN 11823-4, Điều 4), ` +
    `N = N<sub>bệ cứng</sub> + k<sub>v</sub>(w<sub>đàn hồi</sub> - w<sub>bệ cứng</sub>) ; M2 = M2<sub>bệ cứng</sub> + k<sub>θ</sub>(θ<sub>đàn hồi</sub> - θ<sub>bệ cứng</sub>), với EI bệ = E<sub>c</sub>I<sub>g</sub> = ${f(F.EI, 0)} kN.m², ` +
    `độ cứng dọc trục các cọc k<sub>v</sub> = ρ1 = ${F.kvA.map((val) => f(val, 0)).join(' ; ')} kN/m, độ cứng chống xoay đầu cọc k<sub>θ</sub> = ${F.ktA.map((val) => f(val, 0)).join(' ; ')} kN.m/rad (mục 2). Các thành phần khác giữ theo phương pháp bệ cứng. Nội lực bệ (sheet kiểm toán bệ) lấy theo cùng mô hình.` +
    (v('mc_Kn') !== 'T'
      ? ' <span class="bad">Phân phối lực dọc giữa các cọc phụ thuộc trực tiếp độ cứng dọc trục cọc; độ cứng đang lấy theo quy ước Kn (không phải điều khoản tiêu chuẩn hiện hành), nên chọn "Theo độ lún cọc đơn, TCVN 10304:2025, Điều 7.4.2" và nhập E0 theo hồ sơ địa chất.</span>'
      : '')
  );
}

// ---------------------------------------------------------------------------
// 5. Flexible Cap Section Check (`mdCapStep`) & Strut-and-Tie (`mdSTM`)
// ---------------------------------------------------------------------------

export interface MdCapStepDeps {
  mor?: MoCalcResult | null;
  rcm?: { M: RcMaterialProps } | null;
  mcr?: McrRuntimeState | null;
  inputs?: MoInput;
}

export function mdCapStep(deps?: MdCapStepDeps): CapRuntimeState | null {
  set('md_cap_err', '');
  ['tbMdCapL', 'tbMdCapP', 'tbMdCapF'].forEach((id) => {
    set(id, '');
    const el = $(id);
    if (el) el.innerHTML = '';
  });

  const MOR = deps?.mor !== undefined ? deps.mor : getLatestMorResult();
  const RCM = deps?.rcm !== undefined ? deps.rcm : getLatestRcmResult();
  const MCR =
    deps?.mcr !== undefined ? deps.mcr : (contextState.MCR as McrRuntimeState | null);

  if (!MOR || MOR.err.length || !RCM) {
    set('md_cap_err', 'Chưa có kết quả tính mố.');
    setLatestCapResult(null);
    MDCAP = null;
    MDSTM = null;
    return null;
  }
  if (!MCR || !MCR.piles) {
    set('md_cap_err', 'Chưa có kết quả nội lực đầu cọc.');
    setLatestCapResult(null);
    MDCAP = null;
    MDSTM = null;
    return null;
  }
  if (v('mc_src') !== 'mo') {
    set(
      'md_cap_err',
      'Cần lấy tổ hợp tải trọng ở sheet nội lực đầu cọc từ sheet tính mố (cùng hệ số tải trọng).',
    );
  }

  const I = deps?.inputs ?? moInputs();
  const G = MOR.geo;
  const k = 9.81;
  const piles = MCR.piles;
  const C1 = I.Lf;
  const CD0 = mdCapDef(I, G, MOR);
  const D = CD0.D;
  const ys = CD0.ys;
  const ng = CD0.ng;

  let t =
    '<tr><th colspan="3">Tải trọng</th><th>Ký hiệu</th><th>Phân bố</th><th>P (kN)</th><th>Vị trí y (m)</th></tr>';
  D.forEach((r) => {
    t += `<tr><td class="l" colspan="3">${r[0]}</td><td class="c">${r[1]}</td><td class="c">${
      r[2] === 'q' ? 'đều' : 'tập trung'
    }</td><td>${fx(r[3], 2)}</td><td class="c">${
      r[2] === 'q' ? `${fx(r[4][0], 2)} ÷ ${fx(r[4][1], 2)}` : fx(r[4], 2)
    }</td></tr>`;
  });
  t += `<tr><td class="l" colspan="3">Phần còn lại của tổng tải đứng (KCPT, hoạt tải, đá kê, ụ chống xô...) chia cho ${ng} vị trí gối: tĩnh tải kết cấu nhịp theo phân bố thực tế (gờ lan can, lan can tay vịn ở mép cầu, kết cấu lề trên phạm vi lề, lớp phủ trên phần xe chạy phân theo đòn bẩy; dầm chủ, bản mặt cầu chia đều), các tải trọng còn lại phân bố tuyến tính để cân bằng mômen Mx${
    MDFLEX && MDFLEX.ok
      ? ' ; riêng hoạt tải xe, xung kích, người đi bộ phân cho các gối theo nguyên tắc đòn bẩy với mọi cách xếp xe ngang cầu (1 đến ' +
        MOR.LIVE.nL +
        ' làn, dịch làn bước 0,25 m trên phần xe chạy, hệ số làn m), lấy các cách xếp gây lực dọc cọc lớn nhất, mômen dương và mômen âm lớn nhất của bệ'
      : ''
  }</td><td class="c">-</td><td class="c">tại gối</td><td>-</td><td class="c">${ys
    .map((val) => fx(val, 2))
    .join(' ; ')}</td></tr>`;
  set('tbMdCapL', t);

  const combos = [
    ...MOR.comb.A.filter((c) => c.st !== 'DB'),
    ...MOR.comb.A.filter((c) => c.st === 'DB'),
  ];
  const rowsCD = MCR.rows['TTGH CƯỜNG ĐỘ VÀ SỬ DỤNG'] || [];
  const rowsDB = MCR.rows['TTGH ĐẶC BIỆT'] || [];
  const nCD = combos.filter((c) => c.st !== 'DB').length;

  const Rp = (ci: number, pi: number) => {
    const db = ci >= nCD;
    const rows = db ? rowsDB : rowsCD;
    const th = (db ? ci - nCD : ci) + 1;
    const r = rows.find((q) => q.tc === pi + 1 && q.th === th);
    return r ? r.N * k : NaN;
  };

  // Pile Y coordinate axis is inverted relative to abutment transverse y axis (Mx = sum R * y)
  const PY = piles.map((p) => -p.y);
  const n = 480;
  const yy = [...Array(n + 1)].map((_, i) => -C1 / 2 + (C1 * i) / n);
  const Dp = num('D') / 1000 || 1;
  const out: MdCapOutEntry[] = [];

  t =
    '<tr><th colspan="2">Tổ hợp</th><th>ΣN (kN)</th><th>Mx (kN.m)</th><th>ΣP gối (kN)</th>' +
    piles.map((_, i) => `<th>R${i + 1} (kN)</th>`).join('') +
    '<th>ΣR (kN)</th><th>Đất đáy bệ (kN)</th></tr>';

  const flexState = MDFLEX;
  const FXo = Boolean(flexState && flexState.ok);
  if (FXo && flexState) {
    combos.forEach((c, ci) => {
      const F = ci < nCD ? flexState.CD[ci] : flexState.DB[ci - nCD];
      if (!F) return;
      F.sts.forEach((S) => {
        const N = S.Rv.reduce((a, val) => a + val, 0);
        const Mx = c.tot.Mx;
        const Rs = S.Rv;
        const Ms = yy.map((y) => S.at(y));
        let mn: MdCapMomentExtremum = { M: 0, y: 0, V: 0 };
        let mx: MdCapMomentExtremum = { M: 0, y: 0, V: 0 };
        Ms.forEach(([M, V], i) => {
          if (M < mn.M) mn = { M, y: yy[i], V };
          if (M > mx.M) mx = { M, y: yy[i], V };
        });
        out.push({
          id: c.id + S.tag,
          st: c.st,
          c,
          N,
          Mx,
          Pg: S.LD.Pg,
          Rs,
          Ms,
          res: 0,
          mn,
          mx,
          pts: S.LD.pts,
          q: S.LD.q,
          dN: 0,
          dM: 0,
        });
        t += `<tr><td class="l" colspan="2">${c.id + S.tag}</td><td>${fx(N, 1)}</td><td>${fx(
          Mx,
          1,
        )}</td><td>${fx(
          S.LD.Pg.reduce((a, val) => a + val, 0),
          1,
        )}</td>${Rs.map((val) => `<td>${fx(val, 1)}</td>`).join('')}<td>${fx(N, 1)}</td><td>-</td></tr>`;
      });
    });
  } else {
    combos.forEach((c, ci) => {
      const N = c.tot.N;
      const Mx = c.tot.Mx;
      const LD = mdCapLoad(CD0, c);
      const q = LD.q;
      const pts = LD.pts;
      const Ng_ = LD.Ng;
      const Pg = LD.Pg;
      const Rs = piles.map((_, i) => Rp(ci, i));
      piles.forEach((_, i) => pts.push([PY[i], -Rs[i]]));

      // Soil reaction beneath cap balancing non-pile portion in rigid pile-group run
      const dN = N - Rs.reduce((a, val) => a + val, 0);
      const dM = Mx - Rs.reduce((a, val, i) => a + val * PY[i], 0);
      const qs0 = -dN / C1;
      const qs1 = (-dM * 12) / C1 ** 3;
      for (let kk = 0; kk < 40; kk++) {
        const a = -C1 / 2 + (C1 * kk) / 40;
        const b2 = a + C1 / 40;
        const m = (a + b2) / 2;
        q.push([a, b2, qs0 + qs1 * m]);
      }

      const MV = (y: number): [number, number] => {
        let M = 0;
        let V = 0;
        pts.forEach(([a, P]) => {
          if (a < y) {
            M -= P * (y - a);
            V -= P;
          }
        });
        q.forEach(([a, b2, w]) => {
          if (y > a) {
            const e = Math.min(y, b2);
            V -= w * (e - a);
            M -= w * (e - a) * (y - (a + e) / 2);
          }
        });
        return [M, V];
      };

      const Ms = yy.map((y) => MV(y));
      const res = MV(C1 / 2 + 1e-9)[0];
      let mn: MdCapMomentExtremum = { M: 0, y: 0, V: 0 };
      let mx: MdCapMomentExtremum = { M: 0, y: 0, V: 0 };
      Ms.forEach(([M, V], i) => {
        if (M < mn.M) mn = { M, y: yy[i], V };
        if (M > mx.M) mx = { M, y: yy[i], V };
      });
      out.push({ id: c.id, st: c.st, c, N, Mx, Pg, Rs, Ms, res, mn, mx, pts, q, dN, dM });
      const sumR = Rs.reduce((a, val) => a + val, 0);
      t += `<tr><td class="l" colspan="2">${c.id}</td><td>${fx(N, 1)}</td><td>${fx(
        Mx,
        1,
      )}</td><td>${fx(Ng_, 1)}</td>${Rs.map((val) => `<td>${fx(val, 1)}</td>`).join('')}<td>${fx(
        sumR,
        1,
      )}</td><td>${fx(N - sumR, 1)}</td></tr>`;
    });
  }
  set('tbMdCapP', t);

  if (out.some((o) => o.Rs.some((val) => !Number.isFinite(val)))) {
    set('md_cap_err', 'Số tổ hợp ở sheet nội lực đầu cọc không khớp với sheet tính mố.');
    setLatestCapResult(null);
    MDCAP = null;
    MDSTM = null;
    return null;
  }

  const b = I.b * 1000;
  const h = I.d * 1000;
  const Sn = rcSec('bn', b, h);
  const Sp = rcSec('bp', b, h);
  const dvOf = (S: typeof Sn, neg: boolean) => {
    const fl = RC.flex(S, RCM.M, !neg);
    const T = neg ? S.f2 : S.f1;
    const de = S.h - T.dc;
    return Math.max(de - fl.a / 2, 0.9 * de, 0.72 * S.h) / 1000;
  };
  const dv = dvOf(Sn, true);

  const Vc = (o: MdCapOutEntry) => {
    let V = 0;
    PY.forEach((py) => {
      [py - Dp / 2 - dv, py + Dp / 2 + dv].forEach((y) => {
        if (y > -C1 / 2 && y < C1 / 2) {
          const idxY = Math.round(((y + C1 / 2) / C1) * n);
          V = Math.max(V, Math.abs(o.Ms[idxY][1]));
        }
      });
    });
    return V;
  };
  out.forEach((o) => {
    o.Vu = Vc(o);
  });

  t =
    '<tr><th colspan="2">Tổ hợp</th><th>M⁻ (kN.m)</th><th>y (m)</th><th>M⁺ (kN.m)</th><th>y (m)</th><th>Vu cách mép cọc dv (kN)</th></tr>';
  out.forEach((o) => {
    t += `<tr><td class="l" colspan="2">${o.id}</td><td>${fx(o.mn.M, 2)}</td><td>${fx(
      o.mn.y,
      2,
    )}</td><td>${fx(o.mx.M, 2)}</td><td>${fx(o.mx.y, 2)}</td><td>${fx(o.Vu ?? 0, 2)}</td></tr>`;
  });
  set('tbMdCapF', t);

  set('o_mdCapdv', fx(dv, 3));
  set('o_mdCapD', fx(Dp, 2));
  MDCAP = { out, ys, piles, PY, C1, yy };

  set(
    'o_mdFlexNote',
    MDFLEX && MDFLEX.ok
      ? 'Phản lực cọc R<sub>i</sub> lấy theo sheet nội lực đầu cọc, đã hiệu chỉnh theo dầm đàn hồi kê trên hàng cọc (EI bệ = ' +
          fx(MDFLEX.EI, 0) +
          ' kN.m² ; k<sub>v</sub> = ' +
          MDFLEX.kvA.map((val) => fx(val, 0)).join(' ; ') +
          ' kN/m ; k<sub>θ</sub> = ' +
          MDFLEX.ktA.map((val) => fx(val, 0)).join(' ; ') +
          ' kN.m/rad). Mômen, lực cắt bệ tính từ chính mô hình dầm đàn hồi (toàn bộ tải đứng do cọc chịu); cột đất đáy bệ chỉ để đối chiếu với phương pháp bệ cứng.'
      : '',
  );

  const bn = rcRender(
    'bn',
    Sn,
    RCM.M,
    out.map((o) => ({ id: o.id, st: o.st, M: o.mn.M, V: o.Vu ?? 0, N: 0 })),
    'Mặt dưới',
    'Mặt trên',
  );
  const bp = rcRender(
    'bp',
    Sp,
    RCM.M,
    out.map((o) => ({ id: o.id, st: o.st, M: o.mx.M, V: Math.abs(o.mx.V), N: 0 })),
    'Mặt dưới',
    'Mặt trên',
  );

  const capState: CapRuntimeState = {
    c1: null,
    c2: null,
    bn,
    bp,
  };
  setLatestCapResult(capState);

  try {
    mdCapDraw(I, MOR);
  } catch (e) {
    console.error(e);
  }

  let stm = true;
  try {
    stm = mdSTM({ inputs: I, rcm: RCM, cap: capState }) !== false;
  } catch (e) {
    console.error(e);
  }

  const ok = Boolean(capState.bn && capState.bp && capState.bn.ok && capState.bp.ok) && stm;
  capState.ok = ok;
  setLatestCapResult(capState);

  klDiv(
    'tab6',
    'o_capAll',
    ok,
    ok
      ? capState.stm && capState.stm.strict
        ? 'BỆ MỐ ĐẠT YÊU CẦU (uốn, cắt, mô hình chống - giằng)'
        : 'BỆ MỐ ĐẠT YÊU CẦU (uốn, cắt theo mặt cắt)'
      : 'BỆ MỐ CÓ HẠNG MỤC KHÔNG ĐẠT (xem các ô NG ở trên)',
  );

  getVisualHooks().renderAbutmentFlex?.({
    result: {
      kind: 'mdCap',
      I,
      cap: capState,
      mdCap: MDCAP,
      mdStm: MDSTM,
    },
  });

  return capState;
}

export interface MdStmDeps {
  mdCap?: MdCapRuntimeState | null;
  rcm?: { M: RcMaterialProps } | null;
  cap?: CapRuntimeState | null;
  inputs?: MoInput;
}

/**
 * Strut-and-tie check for flexible abutment pile cap (TCVN 11823-5 §6.3, §8.1.1).
 */
export function mdSTM(deps?: MdStmDeps): boolean | undefined {
  const capState = deps?.cap !== undefined ? deps.cap : getLatestCapResult();
  const capData = deps?.mdCap !== undefined ? deps.mdCap : MDCAP;
  const RCM = deps?.rcm !== undefined ? deps.rcm : getLatestRcmResult();
  if (!capData || !RCM || !capState) return undefined;

  const { out, PY, C1, yy } = capData;
  const I = deps?.inputs ?? moInputs();
  const M = RCM.M;
  const D = num('D') / 1000 || 1;
  const n = yy.length - 1;
  const Sn = rcSec('bn', I.b * 1000, I.d * 1000);
  const Sp = rcSec('bp', I.b * 1000, I.d * 1000);
  const b = I.b * 1000;
  const h = I.d * 1000;

  const Ab = RC.bar;
  const AsB = Sp.f1.n * Ab(Sp.f1.d);
  const AsT = Sn.f2.n * Ab(Sn.f2.d);
  const dB = h - Sp.f1.dc;
  const dT = h - Sn.f2.dc;
  const jd = (0.9 * Math.min(dB, dT)) / 1000;
  const iy = (y: number) => Math.max(0, Math.min(n, Math.round(((y + C1 / 2) / C1) * n)));

  const ps = [...PY].sort((a, c) => a - c);
  const segs: Array<{ nm: string; k: 'c' | 's'; a: number; b: number; sup: number[] }> = [];
  if (ps[0] - -C1 / 2 > D / 2 + 0.05) {
    segs.push({ nm: 'Hẫng trái', k: 'c', a: -C1 / 2, b: ps[0], sup: [ps[0]] });
  }
  for (let j = 0; j + 1 < ps.length; j++) {
    segs.push({
      nm: `Nhịp cọc ${j + 1} - ${j + 2}`,
      k: 's',
      a: ps[j],
      b: ps[j + 1],
      sup: [ps[j], ps[j + 1]],
    });
  }
  if (C1 / 2 - ps[ps.length - 1] > D / 2 + 0.05) {
    segs.push({
      nm: 'Hẫng phải',
      k: 'c',
      a: ps[ps.length - 1],
      b: C1 / 2,
      sup: [ps[ps.length - 1]],
    });
  }

  const U = out.filter((o) => o.st !== 'SD');
  const skd = num('md_skd') || 16;
  const sks = num('md_sks') || 200;
  const rhoH = (2 * Ab(skd)) / (b * sks);
  const rhoV = Sn.st.n > 0 ? (Sn.st.n * Ab(Sn.st.d)) / (b * Sn.st.s) : 0;
  const d2 = (2 * dB) / 1000;

  const res: MdStmSegment[] = segs.map((sg) => {
    let best: MdStmSegmentDetail | null = null;
    U.forEach((o) => {
      const i0 = iy(sg.a);
      const i1 = iy(sg.b);
      let Mx = 0;
      for (let i = i0; i <= i1; i++) {
        const m = o.Ms[i][0];
        if (sg.k === 's' ? m > Mx : Math.abs(m) > Math.abs(Mx)) {
          Mx = m;
        }
      }
      if (sg.k === 'c') {
        const ip = iy(sg.sup[0]);
        Mx = o.Ms[ip][0];
      }
      const Vs = sg.sup.map((p) => {
        const yi = p + ((sg.k === 's' ? (p === sg.a ? 1 : -1) : sg.a < p ? -1 : 1) * D) / 2;
        return Math.abs(o.Ms[iy(yi)][1]);
      });
      const V = Math.max(...Vs, 1e-6);
      const Mabs = Math.abs(Mx);
      const a = Math.max(0.2, Mabs / V);
      const th = Math.atan(jd / a);
      const T = Mabs / jd;
      const Cs = V / Math.sin(th);
      const top = sg.k === 'c' || Mx < 0;
      const As = top ? AsT : AsB;
      const dc = top ? Sn.f2.dc : Sp.f1.dc;
      const es = (T * 1e3) / (M.Es * Math.max(As, 1));
      const e1 = es + (es + 0.002) / Math.tan(th) ** 2;
      const fcu = Math.min(M.fc / (0.8 + 170 * e1), 0.85 * M.fc);
      const ws = D * 1000 * Math.sin(th) + 2 * dc * Math.cos(th);
      const Acs = ws * Math.min(b, D * 1000);
      const Pr = (0.7 * fcu * Acs) / 1e3;
      const Tr = (0.9 * M.fy * As) / 1e3;
      const R = Math.max(
        ...sg.sup.map((p) => {
          const k = PY.indexOf(p);
          return o.Rs[k] || 0;
        }),
      );
      const An = ((Math.PI * D * D) / 4) * 1e6;
      const Rn = (0.7 * 0.75 * M.fc * An) / 1e3;

      let z0 = Infinity;
      for (let i = iy(sg.a + D / 2); i < iy(sg.b - D / 2); i++) {
        if (o.Ms[i][1] * o.Ms[i + 1][1] <= 0) {
          const y = yy[i];
          z0 = Math.min(z0, ...sg.sup.map((p) => Math.max(0, Math.abs(y - p) - D / 2)));
        }
      }
      if (sg.k === 'c') {
        z0 = Math.abs((sg.a < sg.sup[0] ? sg.a : sg.b) - sg.sup[0]) - D / 2;
      }

      const r: MdStmSegmentDetail = {
        o,
        Mx,
        V,
        a,
        th: (th * 180) / Math.PI,
        T,
        Cs,
        As,
        Tr,
        es,
        e1,
        fcu,
        ws,
        Acs,
        Pr,
        R,
        Rn,
        An,
        z0,
        top,
        ok: T <= Tr && Cs <= Pr && R <= Rn && (th * 180) / Math.PI >= 25,
        u: Math.max(T / Tr, Cs / Pr, R / Rn),
      };
      if (!best || r.u > best.u) best = r;
    });

    const needSeg = Boolean(best && (best as MdStmSegmentDetail).z0 < d2);
    return { ...sg, r: best, need: needSeg };
  });

  const need = res.some((sg) => sg.need);
  const box = $('md_stm');
  const no = $('md_stmNo');
  if (box?.style) box.style.display = need ? '' : 'none';
  if (no) {
    if (no.style) no.style.display = need ? 'none' : '';
    no.textContent = need
      ? ''
      : `Tại mọi đoạn bệ, khoảng cách từ điểm lực cắt bằng 0 đến mép cọc ≥ 2d = ${fx(
          d2,
          2,
        )} m nên bệ không phải dầm cao; kiểm toán theo mặt cắt (mục 2, 3) là quyết định, không cần mô hình chống - giằng (TCVN 11823-5, Điều 8.1.1).`;
  }

  const stmm = v('md_stmm');
  const offS = stmm === 'none';
  if (offS) {
    if (box?.style) box.style.display = 'none';
    if (no?.style) no.style.display = 'none';
  }
  if (!need || offS) {
    capState.stm = { active: false, ok: true, need: false };
    MDSTM = {
      segs: res,
      need: false,
      offS,
      strict: false,
      ok: true,
      okR: true,
      okSk: true,
      okSt: true,
      okS: true,
      jd,
      AsB,
      AsT,
      rhoH,
      rhoV,
      AskReq: 0,
      AskPro: 0,
      AtReq: 0,
      AtPro: 0,
      smx: 0,
    };
    return true;
  }

  // Side face & shrinkage-temperature reinforcement (TCVN 11823-5 §7.3.4, §10.8)
  const de = dB;
  const AskReq = de > 900 ? Math.min((0.001 * (de - 760) * de) / 2, Math.max(AsB, AsT) / 4) : 0;
  const nsk = Math.floor(de / 2 / sks) + 1;
  const AskPro = nsk * Ab(skd);
  const smx = Math.min(de / 6, 300, 3 * b, 450);
  const AtReq = Math.max(0.233, Math.min(1.27, (0.75 * b * h) / (2 * (b + h) * M.fy)));
  const AtPro = Ab(skd) / sks;
  const okSk = AskPro >= AskReq - 1e-6;
  const okSt = AtPro >= AtReq - 1e-6;
  const okS = sks <= smx;
  const strict = stmm === 'stm';
  const okR = res.every((s) => !s.need || Boolean(s.r?.ok));
  const ok = okR && okSk && okS;
  const f = fx;

  let t =
    '<tr><th>Đoạn</th><th>Khoảng cách điểm V = 0 đến mép cọc (m)</th><th>2d (m)</th><th>Phương pháp</th></tr>';
  res.forEach((s) => {
    const z = s.r ? s.r.z0 : 0;
    const dd = (2 * dB) / 1000;
    t += `<tr><td class="l">${s.nm}</td><td>${
      Number.isFinite(z) ? f(z, 2) : '-'
    }</td><td>${f(dd, 2)}</td><td class="c">${
      z < dd ? 'Dầm cao: mô hình chống - giằng' : 'Mặt cắt (Điều 5.7)'
    }</td></tr>`;
  });
  set('tbMdStmA', t);

  t =
    '<tr><th>Đoạn</th><th>Tổ hợp</th><th>M (kN.m)</th><th>V (kN)</th><th>a (m)</th><th>θ (độ)</th><th>T (kN)</th><th>Tr = φfyAs (kN)</th><th>C (kN)</th><th>ε1</th><th>fcu (MPa)</th><th>Pr (kN)</th><th>R cọc (kN)</th><th>Nút (kN)</th><th>KL</th></tr>';
  res.forEach((s) => {
    const r = s.r;
    if (!r) return;
    if (!s.need) {
      t += `<tr><td class="l">${s.nm}</td><td class="c" colspan="14">Không phải vùng dầm cao: kiểm toán theo mặt cắt (mục 2, 3)</td></tr>`;
      return;
    }
    t += `<tr><td class="l">${s.nm}</td><td class="l">${r.o.id}</td><td>${f(
      r.Mx,
      1,
    )}</td><td>${f(r.V, 1)}</td><td>${f(r.a, 2)}</td><td>${f(r.th, 1)}</td><td>${f(
      r.T,
      1,
    )}</td><td>${f(r.Tr, 1)}</td><td>${f(r.Cs, 1)}</td><td>${f(r.e1, 5)}</td><td>${f(
      r.fcu,
      2,
    )}</td><td>${f(r.Pr, 1)}</td><td>${f(r.R, 1)}</td><td>${f(r.Rn, 1)}</td><td class="c ${
      r.ok ? 'ok' : 'bad'
    }">${r.ok ? 'OK' : 'NG'}</td></tr>`;
  });
  set('tbMdStm', t);

  set('o_mdStmjd', f(jd, 3));
  set('o_mdStmAsB', f(AsB, 0));
  set('o_mdStmAsT', f(AsT, 0));
  set('o_mdStmrh', `${f(rhoH, 5)} ; ${f(rhoV, 5)} (≥ 0,003 nếu không phải móng)`);
  set('o_mdStmsk', `${f(AskReq, 0)} ; ${nsk}φ${skd} = ${f(AskPro, 0)}: ${okSk ? 'OK' : 'NG'}`);
  set(
    'o_mdStmst',
    `${f(AtReq, 3)} ; φ${skd} a${sks} = ${f(AtPro, 3)}: ${
      okSt ? 'OK' : 'chưa đủ - khuyến nghị (bệ chôn trong đất)'
    }`,
  );
  set('o_mdStmsm', `${f(smx, 0)} ; sh = ${sks}: ${okS ? 'OK' : 'NG'}`);

  {
    const W = 760;
    const Hh = 300;
    const sc = Math.min(680 / C1, 170 / I.d);
    const X = (y: number) => (W - C1 * sc) / 2 + (y + C1 / 2) * sc;
    const Y = (z: number) => 60 + (I.d - z) * sc;
    const zt = I.d - (h - dB) / 1000;
    let s = '';
    s += `<rect x="${X(-C1 / 2)}" y="${Y(I.d)}" width="${C1 * sc}" height="${
      I.d * sc
    }" fill="#eef3f7" stroke="#111" stroke-width="1.3"/>`;
    ps.forEach((p) => {
      s += `<rect x="${X(p - D / 2)}" y="${Y(0)}" width="${
        D * sc
      }" height="40" fill="#eee" stroke="#111"/>`;
    });
    res.forEach((sg) => {
      const r = sg.r;
      if (!r || !sg.need) return;
      const top = r.top;
      const zT = top ? zt : I.d - zt;
      const zC = top ? I.d - zt : zt;
      if (sg.k === 's') {
        const m = (sg.a + sg.b) / 2;
        s +=
          qL(X(sg.a), Y(zT), X(sg.b), Y(zT), 'stroke="#c00000" stroke-width="3"') +
          qL(
            X(sg.a + r.a),
            Y(zC),
            X(sg.b - r.a),
            Y(zC),
            'stroke="#0050b0" stroke-width="2" stroke-dasharray="7 3"',
          );
        s +=
          qL(
            X(sg.a),
            Y(zT),
            X(sg.a + r.a),
            Y(zC),
            'stroke="#0050b0" stroke-width="2" stroke-dasharray="7 3"',
          ) +
          qL(
            X(sg.b),
            Y(zT),
            X(sg.b - r.a),
            Y(zC),
            'stroke="#0050b0" stroke-width="2" stroke-dasharray="7 3"',
          );
        s +=
          qT(X(m), Y(zT) + 16, `T = ${f(r.T, 0)} kN`, {
            a: 'middle',
            fs: 11,
            c: '#c00000',
            b: true,
          }) +
          qT(X(sg.a + r.a / 2) + 6, Y((zT + zC) / 2), `θ = ${f(r.th, 1)}°`, {
            fs: 10,
            c: '#0050b0',
          });
      } else {
        const p = sg.sup[0];
        const e = sg.a < p ? sg.a : sg.b;
        const dir = Math.sign(e - p);
        s +=
          qL(
            X(p),
            Y(zt),
            X(p + dir * Math.min(r.a, Math.abs(e - p))),
            Y(zt),
            'stroke="#c00000" stroke-width="3"',
          ) +
          qL(
            X(p),
            Y(I.d - zt),
            X(p + dir * Math.min(r.a, Math.abs(e - p))),
            Y(zt),
            'stroke="#0050b0" stroke-width="2" stroke-dasharray="7 3"',
          );
      }
    });
    ps.forEach((p) => {
      s += `<circle cx="${X(p)}" cy="${Y(I.d - zt)}" r="4" fill="#111"/>`;
    });
    s +=
      qT(W / 2, 20, 'MÔ HÌNH CHỐNG - GIẰNG BỆ MỐ (giằng: đỏ, thanh chống: xanh nét đứt)', {
        a: 'middle',
        fs: 12,
        b: true,
      }) + qDV(Y(I.d), Y(0), X(-C1 / 2) - 14, `h = ${f(I.d, 2)}`);
    qdSvg('dgMdStm', W, Hh, s);
  }

  const stmTxt =
    (strict ? 'KẾT LUẬN: ' : 'KẾT QUẢ THAM KHẢO (không đưa vào kết luận chung): ') +
    (okR ? 'Giằng, thanh chống, nút của bệ mố đạt' : 'Bệ mố chưa đạt về giằng / thanh chống / nút') +
    (!(okSk && okS) ? ' ; cốt thép mặt bên chưa đạt Điều 7.3.4' : '') +
    (!okSt
      ? ' ; cốt thép co ngót - nhiệt độ chưa đạt Điều 10.8 (bệ chôn trong đất: khuyến nghị)'
      : '') +
    '.';
  set('klMdStm', stmTxt);
  const e = $('klMdStm');
  if (e) {
    e.innerHTML = stmTxt;
    e.className = 'kl ' + (strict ? (ok ? 'ok' : 'bad') : '');
  }

  const finalOk = strict ? ok : true;
  capState.stm = { active: need && !offS, ok: finalOk, need: true, strict, raw: ok };
  MDSTM = {
    segs: res,
    need: true,
    offS,
    strict,
    ok: finalOk,
    okR,
    okSk,
    okSt,
    okS,
    jd,
    AsB,
    AsT,
    rhoH,
    rhoV,
    AskReq,
    AskPro,
    AtReq,
    AtPro,
    smx,
  };
  return finalOk;
}

// ---------------------------------------------------------------------------
// 6. Shared Field Re-Parenting, SVG Diagrams, Contours & Cap Envelopes
// ---------------------------------------------------------------------------

export const MD_SHARE: readonly string[] = [
  'mo_b',
  'mo_wc',
  'mo_t',
  'mo_g',
  'mo_d9',
  'mo_dkx',
  'mo_d',
  'mo_jtm',
  'mo_d2b',
  'mo_d2',
  'mo_d1',
  'mo_cf',
  'mo_Lf',
  'mo_L',
  'mo_ut',
  'mo_up',
  'mo_dky',
  'mo_dkh',
  'mo_dkn',
  'mo_hbg',
  'mo_unx',
  'mo_uny',
  'mo_unh',
  'mo_unn',
  'mo_hg',
  'mo_Ag',
  'mo_Lqd',
  'mo_hqd',
  'mo_kt',
  'mo_vt',
];

const MD_ORIG: Record<string, HTMLElement | null> = {};

export function mdVis(): void {
  const on = mdOn();
  if (typeof document === 'undefined') {
    if (on) sv('mo_f', '0');
    return;
  }

  document.querySelectorAll<HTMLElement>('[id^="mn_"]').forEach((e) => {
    e.style.display = on ? 'none' : '';
  });
  document.querySelectorAll<HTMLElement>('[id^="md_"]').forEach((e) => {
    if (/^(DIV|P|SPAN|H2|H3|TR)$/.test(e.tagName) && !/^md_(B5|H4|stm|stmNo)$/.test(e.id)) {
      e.style.display = on ? '' : 'none';
    }
  });
  MD_SHARE.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (!MD_ORIG[id]) MD_ORIG[id] = el.parentElement;
    const slot = document.getElementById('mds_' + id);
    const tgt = on ? slot : MD_ORIG[id];
    if (tgt && el.parentElement !== tgt) tgt.appendChild(el);
  });
  if (on) {
    const fEl = document.getElementById('mo_f') as HTMLInputElement | null;
    if (fEl) fEl.value = '0';
    sv('mo_f', '0');
  }
  const b = document.querySelector<HTMLElement>('.tab[data-t="6"]');
  if (b) b.textContent = '11. Kiểm toán bệ ' + (on ? 'mố' : 'cọc');
  const h = document.querySelector<HTMLElement>('#tab6 h1.ttl');
  if (h) h.textContent = 'KIỂM TOÁN BỆ ' + (on ? 'MỐ (MỐ DẺO)' : 'CỌC');
  const h4 = document.querySelector<HTMLElement>('#tab4 h1.ttl');
  if (h4) {
    h4.textContent = on
      ? 'KIỂM TOÁN MỐ DẺO - TẢI TRỌNG VÀ TỔ HỢP TẢI TRỌNG'
      : 'KIỂM TOÁN MỐ - TẢI TRỌNG VÀ TỔ HỢP TẢI TRỌNG';
  }
  const h5 = document.querySelector<HTMLElement>('#tab5 h1.ttl');
  if (h5) h5.textContent = on ? 'KIỂM TOÁN CÁC MẶT CẮT CỦA MỐ DẺO' : 'KIỂM TOÁN CÁC MẶT CẮT CỦA MỐ';
}

export function mdDraw(I: MoInput, R: MoCalcResult): {
  longitudinal: string;
  elevation: string;
  loads: string;
} {
  const G = R.geo;
  const d = I.d;
  const t = I.t;
  const jtm = I.jtm;
  const H = G.ztop;
  const B1 = I.b;
  const xw2 = G.xw2;
  const B5 = num('md_B5');
  const H4 = G.H4 ?? 0;
  const H3 = G.H3 ?? 0;
  const wc = I.wc;
  const D = num('D') / 1000 || 1;
  const f = (val: number, n = 2) => fx(val, n);

  // Longitudinal section
  let longitudinal = '';
  {
    const W = 760;
    const Hh = 520;
    const xb_ = xw2 - B5;
    const xf = xw2 + (wc - B5);
    const M = mdSvgBox([xb_ - 1.3, B1 / 2 + 1.4], [-1.4, H + 1.0], W, Hh, [70, 40, 30]);
    const X = M.X;
    const Y = M.Y;
    let s = '';
    const zt = H - I.d1;
    s += mdP(
      [
        [xb_, H],
        [xf, H],
        [xf, d],
        [xw2, d],
        [xw2, 0],
        [xb_, H3],
      ],
      X,
      Y,
      'fill="#f3f3f3" stroke="#555" stroke-width="1" stroke-dasharray="6 3"',
    );
    s += mdP(
      [
        [-B1 / 2, 0],
        [B1 / 2, 0],
        [B1 / 2, d],
        [-B1 / 2, d],
      ],
      X,
      Y,
      'fill="#dde6ee" stroke="#111" stroke-width="1.6"',
    );
    s += mdP(
      [
        [xw2, d],
        [xw2 + t, d],
        [xw2 + t, H],
        [xw2, H],
      ],
      X,
      Y,
      'fill="#dde6ee" stroke="#111" stroke-width="1.6"',
    );
    s += mdP(
      [
        [xw2, zt],
        [xw2 - I.d9, zt],
        [xw2 - I.d9, zt - I.d2],
        [xw2, zt - I.d2 - I.d2b],
      ],
      X,
      Y,
      'fill="#dde6ee" stroke="#111" stroke-width="1.4"',
    );
    if (I.kt > 0 && I.vt > 0 && B1 / 2 > xw2 + t) {
      s +=
        mdP(
          [
            [xw2 + t, d],
            [B1 / 2, d],
            [B1 / 2, d + I.kt],
            [xw2 + t, d + I.kt],
          ],
          X,
          Y,
          'fill="none" stroke="#333" stroke-width="1" stroke-dasharray="6 3"',
        ) +
        qT(X(B1 / 2) - 4, Math.min(Y(d) - 36, Y(d + I.kt) + 16), 'Tường tai (phía sau)', {
          a: 'end',
          fs: 10,
          i: true,
        });
    }
    const xb = G.xb;
    s += `<rect x="${X(xb - I.dkx / 2)}" y="${Y(d + I.dkh)}" width="${I.dkx * M.sc}" height="${Math.max(
      2,
      I.dkh * M.sc,
    )}" fill="#bbb" stroke="#111"/><rect x="${X(xb - 0.12)}" y="${Y(
      d + I.dkh + I.hbg,
    )}" width="${0.24 * M.sc}" height="${Math.max(2, I.hbg * M.sc)}" fill="#444"/>`;
    s +=
      `<rect x="${X(-D / 2)}" y="${Y(0)}" width="${D * M.sc}" height="${
        1.0 * M.sc
      }" fill="#eee" stroke="#111"/>` +
      qL(
        X(-D / 2) - 6,
        Y(-1.0),
        X(D / 2) + 6,
        Y(-1.0),
        'stroke="#111" stroke-dasharray="8 3 2 3"',
      ) +
      qL(
        X(0),
        Y(-1.2),
        X(0),
        Y(H + 0.6),
        'stroke="#888" stroke-width="0.6" stroke-dasharray="10 3 2 3"',
      );
    s +=
      qL(X(xw2 - 0.2), Y(H), X(B1 / 2 + 0.9), Y(H), 'stroke="#111" stroke-width="2"') +
      qT(X(B1 / 2 + 0.2), Y(H) - 6, 'Mặt đường', { fs: 10, i: true });
    const yT = Y(H) - 40;
    s +=
      qDH(X(xb_), X(xf), yT - 26, `B6 = ${f(wc)}`) +
      qDH(X(xw2 - I.d9), X(xw2), yT - 2, 'B9') +
      qDH(X(xw2), X(xw2 + t), yT + 16, `B7 = ${f(t)}`) +
      qT(X(xw2 - I.d9) - 6, yT - 6, `B9 = ${f(I.d9)}`, { a: 'end', fs: 11 });
    s +=
      qDH(X(xw2 + t), X(xb), Y(d) - 22, `B8 = ${f(I.g)}`) +
      qDH(X(-B1 / 2), X(B1 / 2), Y(d / 2), `B1 = ${f(B1)}`) +
      qDH(X(xb_), X(xw2), Y(-1.0) + 22, `B5 = ${f(B5)}`);
    const xl = X(xb_) - 18;
    s +=
      qDV(Y(H), Y(H3), xl, `H4 = ${f(H4)}`) +
      qDV(Y(H3), Y(0), xl, `H3 = ${f(H3)}`) +
      qDV(Y(H), Y(0), xl - 30, `H = ${f(H)}`);
    s +=
      qDV(Y(H), Y(zt), X(xw2 - I.d9) - 44, `H11 = ${f(I.d1)}`) +
      qDV(Y(zt), Y(zt - I.d2), X(xw2 - I.d9) - 20, 'H10') +
      qDV(Y(zt - I.d2), Y(zt - I.d2 - I.d2b), X(xw2 - I.d9) - 20, 'H9');
    const xr = X(B1 / 2) + 30;
    s += qDV(Y(H), Y(d), xr, `H7 = ${f(jtm)}`) + qDV(Y(d), Y(0), xr, `H1 = ${f(d)}`);
    for (const [z, nm] of [
      [0, 'A'],
      [d, 'C'],
    ] as const) {
      s +=
        qL(X(xb_) - 60, Y(z), X(xb_) - 40, Y(z), 'stroke="#c00000" stroke-width="1.4"') +
        qL(X(B1 / 2) + 48, Y(z), X(B1 / 2) + 74, Y(z), 'stroke="#c00000" stroke-width="1.4"') +
        qT(X(xb_) - 50, Y(z) - 5, nm, { a: 'middle', fs: 12, b: true, c: '#c00000' }) +
        qT(X(B1 / 2) + 61, Y(z) - 5, nm, { a: 'middle', fs: 12, b: true, c: '#c00000' });
    }
    s +=
      qT(X(0), Y(d * 0.72), 'Bệ mố', { a: 'middle', fs: 11, b: true }) +
      qT(X(xb_ + B5 * 0.45), Y(H3 * 0.4 + H * 0.3), 'Tường cánh', {
        a: 'middle',
        fs: 11,
        i: true,
      }) +
      qT(X(0) + (D * M.sc) / 2 + 6, Y(-0.6), 'Cọc khoan nhồi', { fs: 10, i: true });
    s += qT(W / 2, 18, 'MẶT CẮT DỌC MỐ DẺO - KÍCH THƯỚC CHUNG', { a: 'middle', fs: 13, b: true });
    longitudinal = qdSvg('dgMd', W, Hh, s);
  }

  // Front elevation
  let elevation = '';
  {
    const C1 = I.Lf;
    const C2 = I.L;
    const W = 760;
    const Hh = 360;
    const M = mdSvgBox([-C1 / 2 - 0.8, C1 / 2 + 0.8], [-1.6, H + 1.2], W, Hh, [60, 40, 40]);
    const X = M.X;
    const Y = M.Y;
    let s = '';
    const XX = moXF(I, C1);
    const dmF = XX.XF.dM;
    const yk = XX.XF.yc;
    const crn = yk > -C1 / 2 && yk < C1 / 2;
    s += mdP(
      [
        [-C1 / 2, 0],
        [C1 / 2, 0],
        [C1 / 2, d - dmF(C1 / 2)],
        ...(crn ? ([[yk, d]] as [number, number][]) : []),
        [-C1 / 2, d - dmF(-C1 / 2)],
      ],
      X,
      Y,
      'fill="#dde6ee" stroke="#111" stroke-width="1.6"',
    );
    s += mdP(
      [
        [-C2 / 2, d],
        [C2 / 2, d],
        [C2 / 2, H],
        [-C2 / 2, H],
      ],
      X,
      Y,
      'fill="#eef3f7" stroke="#111" stroke-width="1.2"',
    );
    s +=
      mdP(
        [
          [C2 / 2 - I.ut, d],
          [C2 / 2, d],
          [C2 / 2, H],
          [C2 / 2 - I.ut, H],
        ],
        X,
        Y,
        'fill="#f3f3f3" stroke="#555" stroke-dasharray="5 3"',
      ) +
      mdP(
        [
          [-C2 / 2, d],
          [-C2 / 2 + I.up, d],
          [-C2 / 2 + I.up, H],
          [-C2 / 2, H],
        ],
        X,
        Y,
        'fill="#f3f3f3" stroke="#555" stroke-dasharray="5 3"',
      );

    const ng = Math.max(1, Math.round(I.Ng));
    const ys = XX.ys.length ? XX.ys : [...Array(ng)].map((_, i) => (i - (ng - 1) / 2) * I.Sg);
    const ngk = Math.max(1, Math.round((I.nbg || ys.length) / Math.max(ys.length, 1)));
    const gw = Math.min(I.bgb > 0 ? I.bgb : 0.2, I.dky / (ngk + 0.6));
    const dsp = ngk > 1 ? Math.max(1.4 * gw, Math.min(I.Sg / ngk, (I.dky - gw) / (ngk - 1))) : 0;

    ys.forEach((y, i) => {
      const z0 = d - dmF(y);
      const hv = Math.max(XX.HK.h[i] || I.dkh, 0.05);
      s += `<rect x="${X(y - I.dky / 2)}" y="${Y(z0 + hv)}" width="${
        I.dky * M.sc
      }" height="${Math.max(3, hv * M.sc)}" fill="#bfc6cd" stroke="#111" stroke-width="0.6"/>`;
      for (let q = 0; q < ngk; q++) {
        const yo = y + (q - (ngk - 1) / 2) * dsp;
        s += `<rect x="${X(yo - gw / 2)}" y="${Y(z0 + hv) - 4}" width="${
          gw * M.sc
        }" height="4" fill="#333"/>`;
      }
      s += qL(
        X(y),
        Y(z0 + hv) - 4,
        X(y),
        Y(z0 + hv) - 20,
        'stroke="#c00000" stroke-width="1.6" marker-end="url(#dgMdTA)"',
      );
    });

    const mcr = contextState.MCR as McrRuntimeState | null;
    const piles = mcr?.piles ?? [];
    piles.forEach((p) => {
      s += `<rect x="${X(-p.y - D / 2)}" y="${Y(0)}" width="${D * M.sc}" height="${
        1.2 * M.sc
      }" fill="#eee" stroke="#111"/>`;
    });
    if (piles.length > 1) {
      const py = [...new Set(piles.map((p) => +(-p.y).toFixed(3)))].sort((a, b) => a - b);
      for (let i = 1; i < py.length; i++) {
        s += qDH(X(py[i - 1]), X(py[i]), Y(-1.2) + 18, f(py[i] - py[i - 1]));
      }
    }
    s += qL(
      X(-C1 / 2) - 10,
      Y(-1.2),
      X(C1 / 2) + 10,
      Y(-1.2),
      'stroke="#111" stroke-dasharray="8 3 2 3"',
    );
    s +=
      qDH(X(-C1 / 2), X(C1 / 2), Y(-1.2) + 44, `C1 = ${f(C1)}`) +
      qDH(X(-C2 / 2), X(C2 / 2), Y(H) - 18, `C2 = ${f(C2)}`) +
      qDH(X(C2 / 2 - I.ut), X(C2 / 2), Y(H) - 40, 'C3');
    if (ng > 1) s += qDH(X(ys[0]), X(ys[1]), Y(d) - 34, `Sg = ${f(I.Sg)}`);
    s += qDV(Y(H), Y(d), X(C1 / 2) + 24, 'H7') + qDV(Y(d), Y(0), X(C1 / 2) + 24, 'H1');
    if (I.kt > 0 && I.vt > 0) {
      (
        [
          [C2 / 2 - I.vt, C2 / 2],
          [-C2 / 2, -C2 / 2 + I.vt],
        ] as const
      ).forEach(([a, b]) => {
        s += mdP(
          [
            [a, d],
            [b, d],
            [b, d + I.kt],
            [a, d + I.kt],
          ],
          X,
          Y,
          'fill="#c8d3dd" stroke="#111" stroke-width="1.4"',
        );
        const xm = X((a + b) / 2);
        const sg = a > 0 ? -1 : 1;
        s +=
          qL(xm, Y(d + I.kt * 0.4), xm + sg * 14, Y(d) + 16, 'stroke="#111" stroke-width="0.7"') +
          qT(xm + sg * 16, Y(d) + 20, 'Tường tai', {
            a: sg < 0 ? 'end' : 'start',
            fs: 10,
            i: true,
          });
      });
      s +=
        qDH(X(C2 / 2 - I.vt), X(C2 / 2), Y(d + I.kt) - 14, `v = ${f(I.vt)}`) +
        qDV(Y(d + I.kt), Y(d), X(-C2 / 2) - 16, `k = ${f(I.kt)}`);
    }
    s +=
      qT(X(0), Y(d / 2) + 4, 'Bệ mố', { a: 'middle', fs: 11, b: true }) +
      qT(X(ng > 1 ? (ys[ng - 2] + ys[ng - 1]) / 2 : C2 / 4), Y((d + H) / 2) + 4, 'Tường đỉnh', {
        a: 'middle',
        fs: 11,
      });
    s += qT(W / 2, 18, 'MẶT CHÍNH MỐ DẺO (NHÌN TỪ PHÍA NHỊP)', { a: 'middle', fs: 13, b: true });
    elevation = qdSvg('dgMdT', W, Hh, s);
  }

  // Earth pressure & load scheme
  let loads = '';
  {
    const W = 760;
    const Hh = 420;
    const K = R.K.K;
    const gs = R.gs;
    const he = R.LSs.A.he;
    const M = mdSvgBox([xw2 - B5 - 3.2, B1 / 2 + 1.2], [-0.4, H + 1.4], W, Hh, [60, 40, 30]);
    const X = M.X;
    const Y = M.Y;
    let s = '';
    s +=
      mdP(
        [
          [-B1 / 2, 0],
          [B1 / 2, 0],
          [B1 / 2, d],
          [-B1 / 2, d],
        ],
        X,
        Y,
        'fill="#dde6ee" stroke="#111" stroke-width="1.4"',
      ) +
      mdP(
        [
          [xw2, d],
          [xw2 + t, d],
          [xw2 + t, H],
          [xw2, H],
        ],
        X,
        Y,
        'fill="#dde6ee" stroke="#111" stroke-width="1.4"',
      );
    const xp = X(xw2 - B5 - 0.4);
    const pa = K * gs * H;
    const pl = K * gs * he;
    const kp = 120 / Math.max(pa + pl, 1e-6);
    s += `<polygon points="${xp},${Y(H)} ${xp},${Y(0)} ${xp - pa * kp},${Y(
      0,
    )}" fill="rgba(0,80,176,.12)" stroke="#0050b0"/>`;
    s += `<rect x="${xp - pa * kp - pl * kp}" y="${Y(H)}" width="${pl * kp}" height="${
      Y(0) - Y(H)
    }" fill="rgba(192,0,0,.10)" stroke="#c00000"/>`;
    for (let i = 1; i < 8; i++) {
      const z = (H * i) / 8;
      const x1 = xp - (pa * (1 - i / 8) + pl) * kp;
      s += qL(
        x1,
        Y(z),
        xp - 2,
        Y(z),
        'stroke="#555" stroke-width="0.7" marker-end="url(#dgMdLdK)"',
      );
    }
    s +=
      qT(xp - (pa * kp) / 2, Y(0) + 16, `K.γs.H = ${f(pa, 2)} kPa`, {
        a: 'middle',
        fs: 11,
        c: '#0050b0',
      }) +
      qT(xp - pa * kp - (pl * kp) / 2, Y(H) - 8, `K.γs.heq = ${f(pl, 2)}`, {
        a: 'middle',
        fs: 11,
        c: '#c00000',
      });
    s +=
      `<rect x="${X(xw2 - B5 - 0.4)}" y="${Y(H) - 16}" width="${
        (B5 + 0.4 + t) * M.sc
      }" height="14" fill="url(#dgMdLdS)" stroke="#888"/>` +
      qT(X(xw2 - B5 / 2), Y(H) - 20, `hoạt tải chất thêm heq = ${f(he, 3)} m`, {
        a: 'middle',
        fs: 10,
        i: true,
      });
    s +=
      qL(
        X(G.xb),
        Y(d) - 60,
        X(G.xb),
        Y(d) - 4,
        'stroke="#c00000" stroke-width="2" marker-end="url(#dgMdLdA)"',
      ) + qT(X(G.xb) + 6, Y(d) - 48, 'DC, DW, LL (gối)', { fs: 11, c: '#c00000' });
    s +=
      qL(
        X(B1 / 2) + 50,
        Y(H + 1.8 * 0.4),
        X(B1 / 2) + 10,
        Y(H + 1.8 * 0.4),
        'stroke="#c00000" stroke-width="1.6" marker-end="url(#dgMdLdA)"',
      ) + qT(X(B1 / 2) + 54, Y(H + 0.72) + 4, 'BR (1,8 m trên mặt đường)', { fs: 10 });
    for (const [z, nm] of [
      [0, 'A'],
      [d, 'C'],
    ] as const) {
      s +=
        qL(
          X(-B1 / 2) - 20,
          Y(z),
          X(B1 / 2) + 40,
          Y(z),
          'stroke="#c00000" stroke-width="0.8" stroke-dasharray="8 4"',
        ) + qT(X(B1 / 2) + 46, Y(z) + 4, nm + '-' + nm, { fs: 11, b: true, c: '#c00000' });
    }
    s += qDV(Y(H), Y(0), X(B1 / 2) + 110, `H = ${f(H)}`) + qDV(Y(H), Y(d), X(B1 / 2) + 80, 'H7');
    s += qT(W / 2, 18, 'SƠ ĐỒ TẢI TRỌNG VÀ ÁP LỰC ĐẤT LÊN MỐ DẺO', {
      a: 'middle',
      fs: 13,
      b: true,
    });
    loads = qdSvg('dgMdLd', W, Hh, s);
  }

  return { longitudinal, elevation, loads };
}

export function mdContour(
  id: string,
  P: MdWingPlateResult,
  vals: readonly number[],
  ttl: string,
  unit: string,
): string {
  const W = 760;
  const Hh = 380;
  const M = mdSvgBox([-0.3, P.B5 + 0.3], [-0.3, P.H + 0.3], W - 180, Hh, [40, 40, 30]);
  const X = (x: number) => M.X(P.B5 - x) + 60;
  const Y = M.Y;
  let s = '';
  const mn = Math.min(...vals);
  const mx = Math.max(...vals);
  const col = (val: number) => {
    const r = mx > mn ? (val - mn) / (mx - mn) : 0.5;
    const h = (1 - r) * 240;
    return `hsl(${h.toFixed(0)},85%,55%)`;
  };
  P.els.forEach((e, k) => {
    s += `<polygon points="${e
      .map((n) => X(P.X[n]).toFixed(1) + ',' + Y(P.Y[n]).toFixed(1))
      .join(' ')}" fill="${col(vals[k])}" stroke="#fff" stroke-width="0.3"/>`;
  });
  s +=
    qL(X(0), Y(0), X(0), Y(P.H), 'stroke="#111" stroke-width="4"') +
    qT(X(0) + 16, Y(P.H / 2), 'ngàm vào bệ, tường đỉnh', { fs: 10, rot: -90, a: 'middle' });
  for (let i = 0; i <= 6; i++) {
    const val = mn + ((mx - mn) * (6 - i)) / 6;
    const y = 50 + i * 40;
    s +=
      `<rect x="${W - 110}" y="${y}" width="22" height="40" fill="${col(val)}"/>` +
      qT(W - 82, y + 6, fx(val, 1), { fs: 10 });
  }
  s +=
    qT(W - 100, 40, unit, { fs: 10, i: true }) +
    qDH(X(P.B5), X(0), Y(-0.3) + 12, `B5 = ${fx(P.B5, 2)} m`) +
    qT(W / 2 - 60, 18, ttl, { a: 'middle', fs: 13, b: true });
  return qdSvg(id, W, Hh, s);
}

export function mdWingTab(R: MoCalcResult): void {
  const W = R.WG as unknown as MdWingResult;
  const setO = (id: string, val: string | number, d = 3) => {
    set(id, typeof val === 'string' ? val : fx(val, d));
  };
  setO('o_mdWH', W.H);
  setO('o_mdWH4', W.H4);
  setO('o_mdWu', W.u);
  setO('o_mdWhe', W.he);
  setO('o_mdWpLS', W.pLS);
  setO('o_mdWpEQ', W.pEQ);
  setO('o_mdWB5', W.B5);

  let t =
    '<tr><th>TT</th><th>Tổ hợp</th><th>Hệ số tải trọng</th><th>Mxx ngàm (kN.m/m)</th><th>z (m)</th><th>Vx ngàm (kN/m)</th><th>Myy max (kN.m/m)</th><th>x ; z (m)</th><th>Vy (kN/m)</th></tr>';
  W.CW.forEach((c, i) => {
    const a = W.sec.wx.comb[i];
    const b = W.sec.wy.comb[i];
    if (!a || !b) return;
    t += `<tr><td class="c">${i + 1}</td><td class="l">${c.id}</td><td class="l">${Object.entries(c.g)
      .map(([k, val]) => fx(val, 2) + ' ' + k)
      .join(' + ')}</td><td>${fx(a.M, 2)}</td><td>${fx(a.at.z, 2)}</td><td>${fx(
      a.V,
      2,
    )}</td><td>${fx(b.M, 2)}</td><td>${fx(b.at.x ?? 0, 2)} ; ${fx(b.at.z, 2)}</td><td>${fx(
      b.V,
      2,
    )}</td></tr>`;
  });
  set('tbMoWgC', t);
  set('tbMdWg', t);

  const P = W.plate;
  if (P && P.comb) {
    const wxSvg = mdContour(
      'dgMdWx',
      P,
      P.comb[0].map((r) => r.Mx),
      'MÔMEN Mxx TRONG TƯỜNG CÁNH - TTGH CƯỜNG ĐỘ I',
      'kN.m/m',
    );
    const wySvg = mdContour(
      'dgMdWy',
      P,
      P.comb[0].map((r) => r.My),
      'MÔMEN Myy TRONG TƯỜNG CÁNH - TTGH CƯỜNG ĐỘ I',
      'kN.m/m',
    );
    getVisualHooks().renderAbutmentFlex?.({
      result: { kind: 'mdWing', wing: W, wxSvg, wySvg },
    });
  }
}

export function mdCapDraw(
  inputsOverride?: MoInput,
  morOverride?: MoCalcResult | null,
): {
  cap?: string;
  diagrams?: Record<string, string>;
} {
  if (!MDCAP) return {};
  const { out, ys, PY, C1, yy } = MDCAP;
  const I = inputsOverride ?? moInputs();
  const MOR = morOverride !== undefined ? morOverride : getLatestMorResult();
  const D = num('D') / 1000 || 1;
  const W = 760;

  let capSvg = '';
  {
    const Hh = 250;
    const M = mdSvgBox([-C1 / 2 - 0.6, C1 / 2 + 0.6], [-1.5, I.d + 1.2], W, Hh, [40, 40, 20]);
    const X = M.X;
    const Y = M.Y;
    let s = '';
    s += `<rect x="${X(-C1 / 2)}" y="${Y(I.d)}" width="${C1 * M.sc}" height="${
      I.d * M.sc
    }" fill="#dde6ee" stroke="#111" stroke-width="1.4"/>`;
    ys.forEach((y) => {
      s += qL(
        X(y),
        Y(I.d) - 36,
        X(y),
        Y(I.d) - 2,
        'stroke="#c00000" stroke-width="1.6" marker-end="url(#dgMdCapA)"',
      );
    });
    s += qT(X(ys[0]), Y(I.d) - 40, 'Pi (phản lực gối)', { fs: 10, c: '#c00000' });
    for (let i = 0; i <= 12; i++) {
      const y = -C1 / 2 + (C1 * i) / 12;
      s += qL(
        X(y),
        Y(I.d) - 14,
        X(y),
        Y(I.d) - 2,
        'stroke="#0050b0" stroke-width="0.7" marker-end="url(#dgMdCapK)"',
      );
    }
    s +=
      qL(X(-C1 / 2), Y(I.d) - 14, X(C1 / 2), Y(I.d) - 14, 'stroke="#0050b0" stroke-width="0.7"') +
      qT(X(C1 / 2) - 4, Y(I.d) - 18, 'q (bản thân, đất, BQĐ)', { a: 'end', fs: 10, c: '#0050b0' });
    PY.forEach((py, i) => {
      s +=
        `<rect x="${X(py - D / 2)}" y="${Y(0)}" width="${D * M.sc}" height="${
          1.2 * M.sc
        }" fill="#eee" stroke="#111"/>` +
        qL(
          X(py),
          Y(-1.5),
          X(py),
          Y(0) + 2,
          'stroke="#111" stroke-width="1.6" marker-end="url(#dgMdCapK)"',
        ) +
        qT(X(py) + 5, Y(-1.3), `R${i + 1}`, { fs: 10, b: true });
    });
    s += qDH(X(-C1 / 2), X(C1 / 2), Y(I.d) - 56, `C1 = ${fx(C1, 2)} m`);
    s += qT(W / 2, 16, 'SƠ ĐỒ TÍNH BỆ MỐ: DẦM KÊ TRÊN HÀNG CỌC (PHƯƠNG NGANG CẦU)', {
      a: 'middle',
      fs: 13,
      b: true,
    });
    capSvg = qdSvg('dgMdCap', W, Hh, s);
  }

  const PAL = [
    '#0000ff',
    '#0050ff',
    '#00a0ff',
    '#00e0e0',
    '#00e080',
    '#00c000',
    '#80e000',
    '#e0e000',
    '#ffc000',
    '#ff8000',
    '#ff4000',
    '#ff0000',
  ] as const;

  const env = (st: 'SD' | 'CD', k: 0 | 1) => {
    const U = out.filter((o) => (st === 'SD' ? o.st === 'SD' : o.st !== 'SD'));
    return {
      mx: yy.map((_, i) => Math.max(...U.map((o) => o.Ms[i][k]))),
      mn: yy.map((_, i) => Math.min(...U.map((o) => o.Ms[i][k]))),
    };
  };

  const dia = (id: string, st: 'SD' | 'CD', k: 0 | 1): string => {
    const E = env(st, k);
    const Wd = 760;
    const Hh = 250;
    const x0 = 20;
    const x1 = 560;
    const X = (y: number) => x0 + ((y + C1 / 2) / C1) * (x1 - x0);
    const y0 = 125;
    const all = [...E.mx, ...E.mn];
    const vmax = Math.max(...all);
    const vmin = Math.min(...all);
    const am = Math.max(Math.abs(vmax), Math.abs(vmin), 1e-6);
    const kk = 85 / am;
    const sg = k === 0 ? 1 : -1;
    const Yv = (val: number) => y0 + sg * val * kk;
    const col = (val: number) => {
      const r = vmax > vmin ? (val - vmin) / (vmax - vmin) : 0.5;
      return PAL[Math.min(11, Math.max(0, Math.round((1 - r) * 11)))];
    };

    let s = '';
    s += `<rect x="1" y="1" width="${Wd - 2}" height="${Hh - 2}" fill="#fff" stroke="#bbb"/>`;
    const step = Math.max(1, Math.round(yy.length / 150));
    for (let i = 0; i < yy.length; i += step) {
      for (const val of [E.mx[i], E.mn[i]]) {
        if (Math.abs(val) < 1e-6) continue;
        s += qL(X(yy[i]), y0, X(yy[i]), Yv(val), `stroke="${col(val)}" stroke-width="1"`);
      }
    }
    const pl = (arr: number[]) =>
      `<polyline points="${yy
        .map((y, i) => X(y).toFixed(1) + ',' + Yv(arr[i]).toFixed(1))
        .join(' ')}" fill="none" stroke="#006000" stroke-width="1.2"/>`;
    s += pl(E.mx) + pl(E.mn) + qL(x0, y0, x1, y0, 'stroke="#111" stroke-width="1.6"');
    PY.forEach((py) => {
      s += `<polygon points="${X(py)},${y0 + 2} ${X(py) - 6},${y0 + 12} ${X(py) + 6},${
        y0 + 12
      }" fill="none" stroke="#111"/>`;
    });

    const mark = (i: number, val: number, isMax: boolean) => {
      const x = X(yy[i]);
      const y = Yv(val);
      const lab = `${isMax ? 'Max' : 'Min'}: ${fx(val, 1)}`;
      const w = lab.length * 6.2;
      const right = x + 8 + w > x1 + 20;
      return (
        `<path d="M${x - 4},${y - 4}L${x + 4},${y + 4}M${x - 4},${y + 4}L${x + 4},${
          y - 4
        }" stroke="#111" stroke-width="1.5"/>` +
        qT(right ? x - 6 : x + 6, y + (sg * val >= 0 ? 14 : -6), lab, {
          fs: 10,
          b: true,
          a: right ? 'end' : 'start',
        })
      );
    };

    const ps2 = [...PY].sort((a, c) => a - c);
    const cuts = [-C1 / 2, ...ps2, C1 / 2];
    const iy = (y: number) =>
      Math.max(0, Math.min(yy.length - 1, Math.round(((y + C1 / 2) / C1) * (yy.length - 1))));

    for (let j = 0; j + 1 < cuts.length; j++) {
      const a = iy(cuts[j]);
      const b = iy(cuts[j + 1]);
      let im = -1;
      let vm = -Infinity;
      let iN = -1;
      let vN = Infinity;
      for (let i = a; i <= b; i++) {
        if (E.mx[i] > vm) {
          vm = E.mx[i];
          im = i;
        }
        if (E.mn[i] < vN) {
          vN = E.mn[i];
          iN = i;
        }
      }
      if (k === 0) {
        if (vm > 1e-3 && im > a && im < b) s += mark(im, vm, true);
      } else {
        if (vm > 1e-3) s += mark(im, vm, true);
        if (vN < -1e-3) s += mark(iN, vN, false);
      }
    }

    if (k === 0) {
      ps2.forEach((p) => {
        const i0 = iy(p - 0.6);
        const i1 = iy(p + 0.6);
        let iN = i0;
        let vN = Infinity;
        for (let i = i0; i <= i1; i++) {
          if (E.mn[i] < vN) {
            vN = E.mn[i];
            iN = i;
          }
        }
        if (vN < -1e-3) s += mark(iN, vN, false);
      });
    }

    const lx = x1 + 30;
    s +=
      `<rect x="${lx - 8}" y="8" width="${Wd - lx}" height="${Hh - 16}" fill="#fff" stroke="#888"/>` +
      qT(lx + 75, 26, 'BIỂU ĐỒ NỘI LỰC DẦM', { a: 'middle', fs: 11, b: true }) +
      qT(lx + 75, 42, k === 0 ? 'MÔMEN My' : 'LỰC CẮT Vz', { a: 'middle', fs: 11 });
    for (let j = 0; j < 12; j++) {
      const val = vmax - ((vmax - vmin) * j) / 11;
      s +=
        `<rect x="${lx}" y="${52 + j * 12}" width="18" height="12" fill="${PAL[j]}"/>` +
        qT(lx + 24, 62 + j * 12, val.toExponential(4), { fs: 9 });
    }
    s +=
      qT(lx, 214, `Bao ${st === 'SD' ? 'TTGH Sử dụng' : 'TTGH Cường độ, Đặc biệt'}`, { fs: 10 }) +
      qT(lx, 228, `Đơn vị: ${k === 0 ? 'kN.m' : 'kN'}`, { fs: 10 });
    return qdSvg(id, Wd, Hh, s);
  };

  const diagrams = {
    dgMdCapMs: dia('dgMdCapMs', 'SD', 0),
    dgMdCapVs: dia('dgMdCapVs', 'SD', 1),
    dgMdCapMu: dia('dgMdCapMu', 'CD', 0),
    dgMdCapVu: dia('dgMdCapVu', 'CD', 1),
  };

  try {
    if (MOR) mdDraw(I, MOR);
  } catch (e) {
    console.error(e);
  }

  return { cap: capSvg, diagrams };
}

// ---------------------------------------------------------------------------
// 7. Standard Flexible Template (`MD_TPL`), Pedestal Table (`moHKtab`) & Plots
// ---------------------------------------------------------------------------

export const MD_TPL: Readonly<Record<string, number | string>> = {
  mo_b: 2,
  mo_d: 3,
  mo_t: 0.4,
  mo_jtm: 0.907,
  mo_g: 0.35,
  mo_d9: 0.3,
  mo_d2: 0.3,
  mo_d2b: 0.3,
  mo_d1: 0.7,
  mo_cf: 0,
  mo_Lf: 12,
  mo_L: 12,
  mo_ut: 0.5,
  mo_up: 0.5,
  mo_wc: 3,
  md_B5: 2.3,
  md_H4: 1.5,
  mo_dkx: 0.25,
  mo_dky: 0.8,
  mo_dkh: 0.15,
  mo_unn: 0,
  mc_xy: '0 4.95\n0 1.65\n0 -1.65\n0 -4.95',
};

export function mdTpl(onRun?: () => void): void {
  const T: Record<string, number | string> = { ...MD_TPL };
  const Wb = num('mo_Wb');
  if (Wb > 2) {
    T.mo_Lf = T.mo_L = Wb;
    const e = 1.05;
    const np = Math.max(2, Math.round((Wb - 2 * e) / 3.3) + 1);
    const sp = (Wb - 2 * e) / (np - 1);
    T.mc_xy = [...Array(np)].map((_, i) => '0 ' + +(Wb / 2 - e - i * sp).toFixed(3)).join('\n');
  }
  for (const [k, val] of Object.entries(T)) {
    sv(k, String(val));
  }
  sv('md_init', '1');
  try {
    onRun?.();
  } catch (err) {
    console.error(err);
  }
}

export function bindMdDomEvents(onRun?: () => void): () => void {
  if (typeof document === 'undefined') return () => {};
  const motEl = document.getElementById('tq_mot');
  const bt = document.getElementById('mdTpl');
  const onMotChange = () => {
    mdVis();
    const initEl = document.getElementById('md_init') as HTMLInputElement | null;
    if (mdOn() && initEl && initEl.value !== '1') {
      mdTpl(onRun);
      return;
    }
    try {
      onRun?.();
    } catch (err) {
      console.error(err);
    }
  };
  const onTplClick = () => {
    const ok =
      typeof confirm === 'function'
        ? confirm(
            'Nạp kích thước mẫu mố dẻo (bệ, tường đỉnh, tường cánh, toạ độ cọc) theo bảng tính mẫu? Các giá trị đang nhập sẽ bị thay.',
          )
        : true;
    if (ok) mdTpl(onRun);
  };
  motEl?.addEventListener('change', onMotChange);
  bt?.addEventListener('click', onTplClick);
  return () => {
    motEl?.removeEventListener('change', onMotChange);
    bt?.removeEventListener('click', onTplClick);
  };
}

export function moHKtab(I: MoInput): string {
  const X = moXF(I);
  const XF = X.XF;
  const f = (val: number, d = 3) => fx(val, d);
  const modeMap: Record<string, string> = {
    theo: 'mặt mũ dốc theo mặt cầu',
    phang: 'mặt mũ phẳng 0%',
    rieng: 'mặt mũ dốc riêng',
  };
  const mode = modeMap[XF.mode] || '';
  let t =
    '<tr><th>Đá kê</th><th>y (m)</th><th>Độ hạ mặt cầu (m)</th><th>Độ hạ đáy dầm (m)</th><th>Độ hạ mặt mũ (m)</th><th>Chiều cao đá kê (m)</th></tr>';
  X.ys.forEach((y, j) => {
    t += `<tr><td class="c">${j + 1}</td><td>${f(y)}</td><td>${f(XF.dD(y))}</td><td>${f(
      X.HK.dG[j],
    )}</td><td>${f(XF.dM(y))}</td><td>${f(X.HK.h[j])}</td></tr>`;
  });
  if (XF.gpl === 'bang') {
    t += `<tr><td class="l" colspan="6">Dầm đặt bằng: đỉnh các dầm cùng cao độ, bằng đáy bản mặt cầu tại dầm biên thấp hơn ; dốc ngang tạo trên mặt trên bản mặt cầu (bản dày dần về đỉnh dốc), phần bản dày thêm A = ${f(
      X.Atd,
      4,
    )} m²/m, đã cộng vào tĩnh tải kết cấu nhịp (phản lực lên mố bằng một nửa): γc.A.Lt = ${f(
      (num('mo_gcT') || 2.5) * 9.81 * X.Atd * (I.Lt || 0),
      2,
    )} kN.</td></tr>`;
  }
  t += `<tr><td class="l" colspan="6">Dốc mặt cầu: trái ${f(XF.iL, 2)}%, phải ${f(
    XF.iR,
    2,
  )}%, đỉnh dốc y = ${f(XF.yc, 2)} m ; ${mode} (trái ${f(XF.mL, 2)}%, phải ${f(
    XF.mR,
    2,
  )}%). Chiều cao đá kê nhập (hđk) là đá kê thấp nhất ; cao độ đỉnh mố nhập tại đỉnh dốc. Trọng lượng đá kê lấy theo chiều cao từng đá kê ; phần mũ mố bị hạ do dốc ngang được trừ khỏi trọng lượng bản thân. Kiểm toán mặt cắt dùng kích thước tại đỉnh dốc.</td></tr>`;
  set('tbMoHK', t);
  return t;
}

export const MDC = {
  CD: [
    '#c00000',
    '#e0301e',
    '#ff6f4e',
    '#a83232',
    '#d9534f',
    '#8b0000',
    '#ff8c69',
    '#b22222',
    '#f08080',
  ],
  SD: ['#1b7f3b', '#2ca25f', '#66c2a4'],
  DB: ['#0050b0', '#3182bd', '#6baed6'],
} as const;

export function mdThan(R: MoCalcResult, I: MoInput): string {
  MO.ext(I, R);
  const G = R.geo;
  const DE = I.mtype === 'deo';
  const z0 = DE ? 0 : G.zct;
  const z1 = G.ztop - 0.02;
  const n = 40;
  const zs = [...Array(n + 1)].map((_, i) => z0 + ((z1 - z0) * i) / n);
  const S = zs.map((z) => MO.secZ(I, R, z));
  const CB = R.CB;
  const cols: string[] = [];
  const cnt: Record<'CD' | 'SD' | 'DB', number> = { CD: 0, SD: 0, DB: 0 };
  CB.forEach((c) => {
    cols.push(MDC[c.st][cnt[c.st]++ % MDC[c.st].length]);
  });

  const F = [
    ['N', 'N (kN)'],
    ['Hx', 'Hx (kN)'],
    ['My', 'My (kN.m)'],
    ['Hy', 'Hy (kN)'],
    ['Mx', 'Mx (kN.m)'],
  ] as const;
  const W = 760;
  const ph = 300;
  const pw = 132;
  const gap = 8;
  const x00 = 44;
  const Hh = ph + 150;
  let s = '';
  const Y = (z: number) => 40 + ((z1 - z) / (z1 - z0 || 1)) * ph;

  F.forEach(([k, lab], fi) => {
    const xl = x00 + fi * (pw + gap);
    const vals = S.flatMap((q) => q.out.map((o) => o[k]));
    const mn = Math.min(0, ...vals);
    const mx = Math.max(0, ...vals);
    const X = (val: number) => xl + 8 + ((val - mn) / (mx - mn || 1)) * (pw - 16);
    s +=
      `<rect x="${xl}" y="40" width="${pw}" height="${ph}" fill="#fafafa" stroke="#ccc"/>` +
      qL(X(0), 40, X(0), 40 + ph, 'stroke="#111" stroke-width="0.8"');
    CB.forEach((_, ci) => {
      s += `<polyline points="${S.map(
        (q) => X(q.out[ci][k]).toFixed(1) + ',' + Y(q.z).toFixed(1),
      ).join(' ')}" fill="none" stroke="${cols[ci]}" stroke-width="1.1" opacity="0.9"/>`;
    });
    s +=
      qT(xl + pw / 2, 34, lab, { a: 'middle', fs: 11, b: true }) +
      qT(xl + 2, 40 + ph + 12, fx(mn, 0), { fs: 9 }) +
      qT(xl + pw - 2, 40 + ph + 12, fx(mx, 0), { a: 'end', fs: 9 });
  });

  const lv: ReadonlyArray<readonly [number, string]> = DE
    ? [
        [0, 'A-A'],
        [I.d, 'C-C'],
      ]
    : [
        [G.zct, 'B-B'],
        [G.zwt, 'C-C'],
      ];
  lv.forEach(([z, nm]) => {
    s +=
      qL(
        x00 - 6,
        Y(z),
        x00 + 5 * (pw + gap),
        Y(z),
        'stroke="#c00000" stroke-width="0.6" stroke-dasharray="6 3"',
      ) + qT(x00 - 8, Y(z) + 4, nm, { a: 'end', fs: 10, b: true, c: '#c00000' });
  });
  s += qT(x00 - 8, Y(z1) + 4, 'đỉnh', { a: 'end', fs: 9 });

  CB.forEach((c, i) => {
    const col = i % 5;
    const row = Math.floor(i / 5);
    const x = x00 + col * 140;
    const y = 40 + ph + 30 + row * 16;
    s +=
      qL(x, y - 4, x + 18, y - 4, `stroke="${cols[i]}" stroke-width="2.4"`) +
      qT(x + 22, y, c.id, { fs: 10 });
  });

  s += qT(
    W / 2,
    18,
    `BIỂU ĐỒ NỘI LỰC ${
      DE ? 'THÂN MỐ DẺO (BỆ VÀ TƯỜNG ĐỈNH)' : 'THÂN MỐ (TƯỜNG THÂN VÀ TƯỜNG ĐỈNH)'
    } THEO CHIỀU CAO - TẤT CẢ TỔ HỢP`,
    { a: 'middle', fs: 12, b: true },
  );

  const svg = qdSvg('dgMdThan', W, Hh + 20, s);

  const ks = [0, Math.round(n / 4), Math.round(n / 2), Math.round((3 * n) / 4), n];
  let t =
    '<tr><th>Tổ hợp</th><th>z (m)</th><th>N (kN)</th><th>Hx (kN)</th><th>My (kN.m)</th><th>Hy (kN)</th><th>Mx (kN.m)</th></tr>';
  CB.forEach((c, ci) =>
    ks.forEach((k, j) => {
      const o = S[k].out[ci];
      t += `<tr>${
        j === 0 ? `<td class="l" rowspan="${ks.length}">${c.id}</td>` : ''
      }<td>${fx(S[k].z, 2)}</td><td>${fx(o.N, 1)}</td><td>${fx(o.Hx, 1)}</td><td>${fx(
        o.My,
        1,
      )}</td><td>${fx(o.Hy, 1)}</td><td>${fx(o.Mx, 1)}</td></tr>`;
    }),
  );
  set('tbMdThan', t);
  set(
    'o_mdThanNote',
    `Mặt cắt nằm ngang ở cao độ z (tính từ đáy bệ); nội lực do toàn bộ tải trọng phía trên mặt cắt, mômen lấy với trục ${
      DE
        ? 'tim bệ (z < H1) hoặc tim tường đỉnh (z ≥ H1)'
        : 'tim tường thân (dưới đỉnh tường thân) hoặc tim tường đỉnh'
    }. Tại các cao độ trùng mặt cắt ${lv
      .map((q) => q[1])
      .join(
        ', ',
      )} giá trị bằng bảng tổ hợp ở trên. Áp lực đất, hoạt tải chất thêm tích phân theo chiều cao phía trên mặt cắt.`,
  );

  getVisualHooks().renderAbutmentFlex?.({
    result: { kind: 'mdThan', I, R, svg },
  });
  return svg;
}

export function mdWingAll(R: MoCalcResult): Record<string, string> {
  const W = R.WG as unknown as MdWingResult | undefined;
  const P = W && W.plate;
  if (!W || !P || !P.comb) return {};

  const F = [
    ['Mx', 'Mxx (kN.m/m)', 'dgMdWAx'],
    ['My', 'Myy (kN.m/m)', 'dgMdWAy'],
    ['Qx', 'Qx (kN/m)', 'dgMdWAq'],
    ['Qy', 'Qy (kN/m)', 'dgMdWAr'],
  ] as const;

  const svgs: Record<string, string> = {};
  F.forEach(([k, lab, id]) => {
    const vals = P.comb!.flatMap((r) => r.map((o) => o[k]));
    const mn = Math.min(...vals);
    const mx = Math.max(...vals);
    const col = (val: number) => {
      const r = mx > mn ? (val - mn) / (mx - mn) : 0.5;
      return `hsl(${((1 - r) * 240).toFixed(0)},85%,55%)`;
    };
    const Wd = 760;
    const pw = 160;
    const Hh = 260;
    const sc = Math.min((pw - 20) / P.B5, 170 / P.H);
    let s = '';
    W.CW.forEach((c, ci) => {
      const ox = 20 + ci * (pw + 20);
      const X = (x: number) => ox + (P.B5 - x) * sc + 10;
      const Y = (z: number) => 40 + (P.H - z) * sc;
      const R2 = P.comb![ci];
      P.els.forEach((e, j) => {
        s += `<polygon points="${e
          .map((n) => X(P.X[n]).toFixed(1) + ',' + Y(P.Y[n]).toFixed(1))
          .join(' ')}" fill="${col(R2[j][k])}" stroke="none"/>`;
      });
      s += qL(X(0), Y(0), X(0), Y(P.H), 'stroke="#111" stroke-width="3"');
      const vArr = R2.map((o) => o[k]);
      const a = Math.min(...vArr);
      const b = Math.max(...vArr);
      s +=
        qT(ox + pw / 2, Y(0) + 18, c.id, { a: 'middle', fs: 11, b: true }) +
        qT(ox + pw / 2, Y(0) + 33, `${fx(a, 1)} ÷ ${fx(b, 1)}`, { a: 'middle', fs: 10 });
    });
    for (let i = 0; i <= 6; i++) {
      const val = mn + ((mx - mn) * (6 - i)) / 6;
      const y = 40 + i * 24;
      s +=
        `<rect x="${Wd - 62}" y="${y}" width="16" height="24" fill="${col(val)}"/>` +
        qT(Wd - 42, y + 6, fx(val, 1), { fs: 9 });
    }
    s += qT(Wd / 2 - 30, 18, `${lab} TRONG TƯỜNG CÁNH - CÁC TỔ HỢP (ngàm ở cạnh đậm)`, {
      a: 'middle',
      fs: 12,
      b: true,
    });
    svgs[id] = qdSvg(id, Wd, Hh, s);
  });

  getVisualHooks().renderAbutmentFlex?.({
    result: { kind: 'mdWingAll', wing: W, svgs },
  });

  return svgs;
}

// ---------------------------------------------------------------------------
// 8. Canonical Result Mapper & Bridge Hook Registration
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

export function toFlexibleAbutmentResult(
  mor: MoCalcResult | null = getLatestMorResult(),
  rcm: { M: RcMaterialProps; res: Record<string, RcSectionCheckWithOk | null | undefined>; ok?: boolean } | null = getLatestRcmResult(),
  cap: CapRuntimeState | null = getLatestCapResult(),
  mdCap: MdCapRuntimeState | null = MDCAP,
): AbutmentResult {
  if (!mor) {
    throw new Error('MOR result is required for toFlexibleAbutmentResult');
  }

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

  const primaryCapRc = cap?.bn ?? cap?.bp ?? cap?.c1 ?? cap?.c2 ?? null;
  let winklerCap:
    | { Rv: number[]; Mmax: number; Mmin: number; Vmax: number }
    | undefined;
  if (mdCap && mdCap.out.length) {
    let govRv = mdCap.out[0].Rs.slice();
    let maxR = -Infinity;
    let Mmax = -Infinity;
    let Mmin = Infinity;
    let Vmax = 0;
    for (const o of mdCap.out) {
      const localMax = o.Rs.length ? Math.max(...o.Rs) : 0;
      if (localMax > maxR) {
        maxR = localMax;
        govRv = o.Rs.slice();
      }
      if (o.mx.M > Mmax) Mmax = o.mx.M;
      if (o.mn.M < Mmin) Mmin = o.mn.M;
      Vmax = Math.max(Vmax, o.Vu ?? 0, Math.abs(o.mx.V), Math.abs(o.mn.V));
    }
    winklerCap = { Rv: govRv, Mmax, Mmin, Vmax };
  }

  const capCheck: AbutmentResult['capCheck'] = primaryCapRc
    ? {
        rc: toRcSectionResultOnly(primaryCapRc),
        winklerCap,
        stm: cap?.stm ? { active: Boolean(cap.stm.active), ok: Boolean(cap.stm.ok) } : undefined,
      }
    : undefined;

  const wingwallPlate: MindlinPlateResult | undefined = mor.WG?.plate
    ? summarizeMindlinPlate(mor.WG.plate as MindlinPlateMeshResult, 0)
    : undefined;

  const capOk = cap
    ? cap.ok !== undefined
      ? Boolean(cap.ok)
      : Boolean(cap.bn?.ok && cap.bp?.ok && (cap.stm ? cap.stm.ok : true))
    : true;
  const okAll =
    mor.err.length === 0 && (rcm ? Boolean(rcm.ok) : true) && capOk;

  return {
    variant: 'flexible',
    err: [...mor.err],
    sec: mor.sec,
    comb,
    sectionChecks: Object.keys(sectionChecks).length ? sectionChecks : undefined,
    capCheck,
    wingwallPlate,
    okAll,
  };
}

/** Register flexible abutment callbacks into `./abutmentHeavy.ts` bridge hooks. */
export function initAbutmentFlexHooks(): void {
  registerMdBridgeHooks({
    isActive: mdOn,
    inputs: () => ({ ...mdInputs() }),
    selfW: (payload) => mdSelfW(payload.I, payload.DE, payload.o ?? payload, payload.el),
    wing: (payload) => mdWing(payload.I, payload.DE, payload.o ?? payload),
    capStep: () => mdCapStep(),
    wingTab: mdWingTab,
    vis: mdVis,
    than: mdThan,
    wingAll: mdWingAll,
  });
}

// Auto-register late-binding MD hooks on module import
initAbutmentFlexHooks();
