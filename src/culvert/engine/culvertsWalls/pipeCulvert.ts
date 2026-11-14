/**
 * BangTinhCauCong Web App — Reinforced Concrete Circular Pipe Culvert Solver (`CT`).
 *
 * Exact clean-room TypeScript port of:
 *  - `CT` (`11_culverts_box_and_circular.js:2294-2988, 3398-3854`)
 *    TCVN 11823-3, -5, -12:2017 (§10.4.2 direct design, §10.4.3 indirect D-load design).
 *
 * Internal units: kN, m, kPa; materials MPa; rebar mm, mm².
 */

import { CT_REBAR_AREA, type CulvertResult } from '../../types/project';
import { $, cf, cls, getVisualHooks, okc, set, sv, v } from '../context';
import {
  chFrameSolve,
  type FrameElementInput,
  type FrameLoadCase,
  type FrameNode,
  type FrameSolverInstance,
} from '../math/rcmFrame';

// ---------------------------------------------------------------------------
// 1. Constants & Lookup Tables (`11_culverts_box_and_circular.js:2298-2332, 2887-2895`)
// ---------------------------------------------------------------------------

export const CT_STEEL: Readonly<Record<string, readonly [number, number]>> = {
  'CB240-T': [240, 380],
  'CB300-T': [300, 450],
  'CB300-V': [300, 450],
  'CB400-V': [400, 570],
  'CB500-V': [500, 650],
};

/** Bảng 16 Phần 12: arching VAF / HAF coefficients by standard installation type 1..4 */
export const CT_INST: Readonly<Record<number, { VAF: number; HAF: number }>> = {
  1: { VAF: 1.35, HAF: 0.45 },
  2: { VAF: 1.4, HAF: 0.4 },
  3: { VAF: 1.4, HAF: 0.37 },
  4: { VAF: 1.45, HAF: 0.3 },
};

/** Default bedding angle ψ (deg) matching Heger reaction zone widths (Hình 8, Bảng 16) */
export const CT_PSI_DEF: Readonly<Record<number, number>> = {
  1: (2 * Math.asin(0.84) * 180) / Math.PI,
  2: (2 * Math.asin(0.8) * 180) / Math.PI,
  3: (2 * Math.asin(0.76) * 180) / Math.PI,
  4: (2 * Math.asin(0.5) * 180) / Math.PI,
};

/** Bảng 1 Phần 12: resistance factors φ */
export const CT_PHI: Readonly<{
  1: { f: number; v: number; r: number };
  o: { f: number; v: number; r: number };
}> = {
  1: { f: 0.9, v: 0.82, r: 0.82 },
  o: { f: 1.0, v: 0.9, r: 0.9 },
};

/** Bảng 18 Phần 12: earth load bedding factors BFE */
export const CT_BFE_T: Readonly<{
  d: readonly number[];
  t: Readonly<Record<number, readonly number[]>>;
}> = {
  d: [300, 600, 900, 1800, 3600],
  t: {
    1: [4.4, 4.2, 4.0, 3.8, 3.6],
    2: [3.2, 3.0, 2.9, 2.8, 2.8],
    3: [2.5, 2.4, 2.3, 2.2, 2.2],
    4: [1.7, 1.7, 1.7, 1.7, 1.7],
  },
};

export const ctBarA = (d: number): number => CT_REBAR_AREA[d] || (Math.PI * d * d) / 4;

// ---------------------------------------------------------------------------
// 2. Domain Interfaces
// ---------------------------------------------------------------------------

export interface CtCageInput {
  d: number;
  s: number;
  c: number;
}

export interface CtInput {
  D0: number;
  t: number;
  hs: number;
  hma: number;
  hmo: number;
  tm?: number;
  gma: number;
  gmo: number;
  gs: number;
  gc: number;
  fc: number;
  wc: number;
  K1: number;
  st?: string;
  fy: number;
  Es: number;
  gw: number;
  inst: number;
  psi: number;
  nl: number;
  lane: number;
  water: number;
  etaD: number;
  etaI: number;
  cages: number;
  D025: number;
  mm: string;
  phiB: number;
  fyv: number;
  sv: number;
  nlay: number;
  C1: number;
  ri: CtCageInput;
  ro: CtCageInput;
  m: number;
  nel?: number;
}

export interface CtVehicleLoad {
  nm: string;
  P: number;
  sa: number;
  Hp: number;
  pInt: boolean;
  Lw: number;
  Pw: number;
  q: number;
  bL: number;
}

export interface CtDerived {
  Ri: number;
  R: number;
  Ro: number;
  Bc: number;
  h: number;
  Hph: number;
  Hmm: number;
  Ec: number;
  n: number;
  VAF: number;
  HAF: number;
  psi: number;
  ph: { f: number; v: number; r: number };
  gsEff: number;
  PLev: number;
  PLdw: number;
  WEV: number;
  WDW: number;
  HEV: number;
  HDW: number;
  WDC: number;
  WWF: number;
  LLDF: number;
  DE: number;
  IM: number;
  Hd: number;
  thin: boolean;
  tooThin: boolean;
  Hint_t: number;
  tInt: boolean;
  Ww: number;
  veh: CtVehicleLoad[];
  vg: CtVehicleLoad;
  qlane: number;
  WLL: number;
  LLskip: boolean;
}

export interface CtRingNode extends FrameNode {
  th: number;
}

export interface CtRingMesh {
  N: number;
  nodes: CtRingNode[];
  els: FrameElementInput[];
  F: FrameSolverInstance;
}

export type CtCaseKey = 'DC' | 'EV' | 'DW' | 'WA' | 'LL';
export type CtForceTriplet = [number, number, number];

export interface CtAnalyseOut {
  DC: CtForceTriplet[];
  EV: CtForceTriplet[];
  DW: CtForceTriplet[];
  WA: CtForceTriplet[];
  LL: CtForceTriplet[];
  DC_sum: [number, number];
  EV_sum: [number, number];
  DW_sum: [number, number];
  WA_sum: [number, number];
  LL_sum: [number, number];
}

export interface CtAnalyseResult {
  o: CtDerived;
  M: CtRingMesh;
  L: Record<CtCaseKey, FrameLoadCase>;
  out: CtAnalyseOut;
}

export interface CtComboDef {
  key: 'CD' | 'SD';
  name: string;
  g: Record<CtCaseKey, number>;
  gr: Record<CtCaseKey, number>;
  eta: Record<CtCaseKey, number>;
}

export interface CtStationEnvelope {
  Mmax: CtForceTriplet;
  Mmin: CtForceTriplet;
  Vabs: CtForceTriplet;
  Nmin: CtForceTriplet;
  Nmax: CtForceTriplet;
}

export interface CtFullComboEntry {
  wa: boolean;
  r: CtForceTriplet[];
}

export interface CtEnvelopeResult {
  c: CtComboDef;
  st: CtStationEnvelope[];
  full: CtFullComboEntry[];
}

export interface CtCageDesign {
  d: number;
  s: number;
  As: number;
  c: number;
}

export interface CtFlexResult {
  d: number;
  ph: number;
  req: number;
  disc: number;
}

export interface CtCrackResult {
  d: number;
  As: number;
  tb: number;
  Sl: number;
  B1: number;
  e: number | null;
  j: number | null;
  i: number | null;
  Fcr: number;
  raw: number;
  ok: boolean;
  eOverD: number | null;
}

export interface CtRadialStirrupResult {
  sv: number;
  svMax: number;
  A: number;
  okSv: boolean;
}

export interface CtShearStirrupResult {
  sv: number;
  svMax: number;
  okSv: boolean;
  Vc: number;
  Avr: number;
  Avs: number;
}

export interface CtBookMoments {
  R: number;
  m: number;
  k: number;
  qE: number;
  qD: number;
  hE: number;
  hD: number;
  qL: number;
  qLn: number;
  gz: number;
  kb: number[];
  g: Record<CtCaseKey, number>;
  parts: Array<{ EV: number; DW: number; LL: number; DC: number }>;
  Mu: number[];
  Ms: number[];
}

export interface CtDesignRow {
  s: { id: number; nm: string; i: number };
  face: 'i' | 'o';
  Mu: number;
  Nu: number;
  Vu: number;
  Ms: number;
  Ns: number;
  F: CtFlexResult;
  As: number;
  okF: boolean;
  Amin: number;
  okMin: boolean;
  Asmax_c: number;
  okMaxC: boolean;
  Asmax_r: number | null;
  okMaxR: boolean;
  Cr: CtCrackResult;
  radial: CtRadialStirrupResult | null;
}

export interface CtShearRow {
  th: number;
  wa: boolean;
  face: 'i' | 'o';
  Vu: number;
  Mu: number;
  Mnu: number;
  Nu: number;
  d: number;
  As: number;
  rho: number;
  Fd: number;
  Fn: number;
  Fc: number;
  Vn: number;
  Vr: number;
  ok: boolean;
  zone: string;
  thv: number;
  stir: CtShearStirrupResult | null;
}

export interface CtDesignResult {
  BK: CtBookMoments;
  useB: boolean;
  warn: string[];
  fyv: number;
  rows: CtDesignRow[];
  shear: CtShearRow[];
  ci: CtCageDesign;
  co: CtCageDesign;
  Frt: number;
  rs: number;
  g: number;
  gp: number;
  Asmin_i: number;
  Asmin_o: number | null;
  Si: number;
}

export interface CtIndirectResult {
  Si: number;
  BFE: number;
  BFLL: number;
  WE: number;
  WF: number;
  WL: number;
  fac: number;
  D: number;
  P: number;
  Dp: number;
  ok: boolean | null;
}

export interface CtResult {
  A: CtAnalyseResult;
  EN: CtEnvelopeResult[];
  DS: CtDesignResult;
  IN: CtIndirectResult;
  I: CtInput;
}

// ---------------------------------------------------------------------------
// 3. Core Pure Solvers (`11_culverts_box_and_circular.js:2334-2936`)
// ---------------------------------------------------------------------------

export function ctDerive(I: CtInput): CtDerived {
  const Ri = I.D0 / 2;
  const R = Ri + I.t / 2;
  const Ro = Ri + I.t;
  const Bc = 2 * Ro;
  const h = I.t * 1000;
  const Hph = I.hma + I.hmo + I.hs;
  const Hmm = Hph * 1000;
  const Ec = 0.0017 * I.K1 * I.wc ** 2 * I.fc ** 0.33;
  const n = I.Es / Ec;
  const ins = CT_INST[I.inst] || CT_INST[1];
  const VAF = ins.VAF;
  const HAF = ins.HAF;
  const psi = I.psi > 0 ? I.psi : CT_PSI_DEF[I.inst];
  const ph = I.inst === 1 ? CT_PHI[1] : CT_PHI.o;
  const gsEff = Math.max(I.gs, (1760 * 9.81) / 1000); // 10.2.1: >= 1760 kg/m3
  const PLev = gsEff * I.hs * Bc;
  const PLdw = (I.gma * I.hma + I.gmo * I.hmo) * Bc;
  const WEV = VAF * PLev;
  const WDW = VAF * PLdw;
  const HEV = HAF * PLev;
  const HDW = HAF * PLdw;
  const WDC = I.gc * I.t * 2 * Math.PI * R;
  const WWF = I.gw * Math.PI * Ri * Ri;

  const Di = I.D0 * 1000;
  const LLDF =
    Di <= 600 ? 1.15 : Di >= 2400 ? 1.75 : 1.15 + ((1.75 - 1.15) * (Di - 600)) / (2400 - 600);
  const DE = Hmm;
  const IM = Math.max(0, 33 * (1 - 4.1e-4 * DE));
  const Hd = Hmm < 600 ? Math.max(Hmm, 300) : Hmm;
  const thin = Hmm < 600;
  const tooThin = Hmm < 300;
  const Sw = 1800;
  const wt = 510;
  const lt = 250;
  const H = thin ? 300 : Hmm;
  const Hint_t = (Sw - wt - 0.06 * Di) / LLDF;
  const tInt = H >= Hint_t;
  const Ww = tInt ? wt + Sw + LLDF * H + 0.06 * Di : wt + LLDF * H + 0.06 * Di;

  const veh: CtVehicleLoad[] = (
    [
      ['Xe tải thiết kế', 145, 4300],
      ['Xe hai trục thiết kế', 110, 1200],
    ] as const
  ).map(([nm, P, sa]) => {
    const Hp = (sa - lt) / LLDF;
    const pInt = H >= Hp;
    const Lw = pInt ? lt + sa + LLDF * H : lt + LLDF * H;
    const Pw = (pInt ? 2 : 1) * (tInt ? P : P / 2);
    const q = (Pw * (1 + IM / 100) * I.m) / ((Ww / 1000) * (Lw / 1000));
    return { nm, P, sa, Hp, pInt, Lw, Pw, q, bL: Math.min(Lw / 1000, Bc) };
  });

  const vg = veh.reduce((a, b) => (b.q * b.bL > a.q * a.bL ? b : a));
  const qlane = I.lane ? (I.m * 9.3) / 3.0 : 0;
  const WLL = vg.q * vg.bL + qlane * Bc;
  const LLskip = Hmm > 2400 && Hmm > Di;

  return {
    Ri,
    R,
    Ro,
    Bc,
    h,
    Hph,
    Hmm,
    Ec,
    n,
    VAF,
    HAF,
    psi,
    ph,
    gsEff,
    PLev,
    PLdw,
    WEV,
    WDW,
    HEV,
    HDW,
    WDC,
    WWF,
    LLDF,
    DE,
    IM,
    Hd,
    thin,
    tooThin,
    Hint_t,
    tInt,
    Ww,
    veh,
    vg,
    qlane,
    WLL,
    LLskip,
  };
}

export function ctRing(I: CtInput, o: CtDerived): CtRingMesh {
  const N = I.nel || 144;
  const R = o.R;
  const Ec = o.Ec * 1000;
  const t = I.t;
  const nodes: CtRingNode[] = [];
  const els: FrameElementInput[] = [];
  for (let k = 0; k < N; k++) {
    const th = (2 * Math.PI * k) / N;
    nodes.push({ x: R * Math.sin(th), y: R * Math.cos(th), th });
  }
  for (let k = 0; k < N; k++) {
    els.push({ i: k, j: (k + 1) % N, EA: Ec * t, EI: (Ec * t ** 3) / 12 });
  }
  const F = chFrameSolve(
    nodes,
    els,
    [],
    [
      { n: N / 2, dof: 0 },
      { n: N / 2, dof: 1 },
      { n: 0, dof: 0 },
    ],
  );
  return { N, nodes, els, F };
}

export function ctLump(
  M: CtRingMesh,
  R: number,
  fn: (th: number) => [number, number],
): FrameLoadCase {
  const N = M.N;
  const dth = (2 * Math.PI) / N;
  const sub = 12;
  const nod: Array<{ n: number; fx: number; fy: number }> = [];
  for (let k = 0; k < N; k++) {
    let fx = 0;
    let fy = 0;
    for (let s = 0; s < sub; s++) {
      const th = (2 * Math.PI * k) / N - dth / 2 + (dth * (s + 0.5)) / sub;
      const f = fn(th);
      const ds = (R * dth) / sub;
      fx += f[0] * ds;
      fy += f[1] * ds;
    }
    if (fx || fy) nod.push({ n: k, fx, fy });
  }
  return { el: [], nod };
}

export function ctCases(
  I: CtInput,
  o: CtDerived,
  M: CtRingMesh,
): Record<CtCaseKey, FrameLoadCase> {
  const R = o.R;
  const ps = (o.psi * Math.PI) / 180;
  const bed = (th: number) => Math.abs(th - Math.PI) <= ps / 2 + 1e-12;
  const rB = (W: number) => W / (2 * R * Math.sin(ps / 2));
  const top = (W: number, b: number) => {
    const q = W / b;
    return (th: number): [number, number] => {
      const x = R * Math.sin(th);
      const up = Math.cos(th) > 0;
      return up && Math.abs(x) <= b / 2 + 1e-12 ? [0, -q * Math.abs(Math.cos(th))] : [0, 0];
    };
  };
  const lat = (Hs: number) => {
    const p = Hs / (2 * R);
    return (th: number): [number, number] => [
      (Math.sin(th) < 0 ? 1 : -1) * p * Math.abs(Math.sin(th)),
      0,
    ];
  };
  const add =
    (...fs: Array<(th: number) => [number, number]>) =>
    (th: number): [number, number] =>
      fs.reduce<[number, number]>(
        (a, f) => {
          const v2 = f(th);
          return [a[0] + v2[0], a[1] + v2[1]];
        },
        [0, 0],
      );
  const bedF = (W: number) => {
    const r = rB(W);
    return (th: number): [number, number] => (bed(th) ? [0, r * Math.abs(Math.cos(th))] : [0, 0]);
  };

  const bL = Math.min((o.vg.bL * R) / o.Ro, 2 * R);
  return {
    DC: ctLump(M, R, add(() => [0, -I.gc * I.t], bedF(o.WDC))),
    EV: ctLump(M, R, add(top(o.WEV, 2 * R), lat(o.HEV), bedF(o.WEV))),
    DW: ctLump(M, R, add(top(o.WDW, 2 * R), lat(o.HDW), bedF(o.WDW))),
    WA: ctLump(
      M,
      R,
      add((th) => {
        const p = (I.gw * o.Ri * (1 - Math.cos(th)) * o.Ri) / R;
        return [p * Math.sin(th), p * Math.cos(th)];
      }, bedF(o.WWF)),
    ),
    LL: ctLump(
      M,
      R,
      add(
        top(o.vg.q * o.vg.bL, bL),
        o.qlane ? top(o.qlane * o.Bc, 2 * R) : () => [0, 0],
        bedF(o.WLL),
      ),
    ),
  };
}

export function ctAnalyse(I: CtInput): CtAnalyseResult {
  const o = ctDerive(I);
  const M = ctRing(I, o);
  const L = ctCases(I, o, M);
  const out = {} as CtAnalyseOut;
  const keys: CtCaseKey[] = ['DC', 'EV', 'DW', 'WA', 'LL'];
  for (const k of keys) {
    const r = M.F.run(L[k]);
    out[k] = M.els.map((_e, i): CtForceTriplet => {
      const q = r.R[i];
      return [q.Mi, q.Vi, q.Ni];
    });
    const sumKey = `${k}_sum` as `${CtCaseKey}_sum`;
    out[sumKey] = (L[k].nod || []).reduce<[number, number]>(
      (a, n) => [a[0] + (n.fx || 0), a[1] + (n.fy || 0)],
      [0, 0],
    );
  }
  return { o, M, L, out };
}

export function ctCombos(I: CtInput): CtComboDef[] {
  const e = I.etaD * I.etaI;
  const eE = e * 1.05;
  const eL = e * 1.0;
  return [
    {
      key: 'CD',
      name: 'Cường độ I',
      g: { DC: 1.25 * eL, DW: 1.5 * eE, EV: 1.3 * eE, WA: 1.0 * eL, LL: 1.75 * eL },
      gr: { DC: 1.25, DW: 1.5, EV: 1.3, WA: 1.0, LL: 1.75 },
      eta: { DC: eL, DW: eE, EV: eE, WA: eL, LL: eL },
    },
    {
      key: 'SD',
      name: 'Sử dụng I',
      g: { DC: 1, DW: 1, EV: 1, WA: 1, LL: 1 },
      gr: { DC: 1, DW: 1, EV: 1, WA: 1, LL: 1 },
      eta: { DC: 1, DW: 1, EV: 1, WA: 1, LL: 1 },
    },
  ];
}

export function ctEnvelope(A: CtAnalyseResult, I: CtInput): CtEnvelopeResult[] {
  const C = ctCombos(I);
  const N = A.M.N;
  const P: CtCaseKey[] = ['DC', 'DW', 'EV'];
  const T: CtCaseKey[] = I.water ? ['WA', 'LL'] : ['LL'];

  return C.map((c) => {
    const st: CtStationEnvelope[] = [];
    for (let i = 0; i < N; i++) {
      const base: CtForceTriplet = [0, 0, 0];
      P.forEach((k) => {
        for (let j = 0; j < 3; j++) base[j] += c.g[k] * A.out[k][i][j];
      });
      const pick = (j: 0 | 1 | 2, sg: 1 | -1): CtForceTriplet => {
        const r: CtForceTriplet = [base[0], base[1], base[2]];
        T.forEach((k) => {
          if (sg * A.out[k][i][j] > 0) {
            for (let q = 0; q < 3; q++) r[q] += c.g[k] * A.out[k][i][q];
          }
        });
        return r;
      };
      const va = pick(1, 1);
      const vb = pick(1, -1);
      st.push({
        Mmax: pick(0, 1),
        Mmin: pick(0, -1),
        Vabs: Math.abs(va[1]) >= Math.abs(vb[1]) ? va : vb,
        Nmin: pick(2, -1),
        Nmax: pick(2, 1),
      });
    }

    const full: CtFullComboEntry[] = [1, 0]
      .filter((w) => !w || I.water)
      .map((w) => {
        const ks: CtCaseKey[] = (['DC', 'DW', 'EV', 'LL'] as CtCaseKey[]).concat(
          w && I.water ? ['WA'] : [],
        );
        return {
          wa: !!w,
          r: Array.from({ length: N }, (_, i): CtForceTriplet => {
            const r: CtForceTriplet = [0, 0, 0];
            ks.forEach((k) => {
              for (let j = 0; j < 3; j++) r[j] += c.g[k] * A.out[k][i][j];
            });
            return r;
          }),
        };
      });

    return { c, st, full };
  });
}

export function ctDesign(
  A: CtAnalyseResult,
  I: CtInput,
  EN: CtEnvelopeResult[],
): CtDesignResult {
  const o = A.o;
  const fc = I.fc;
  const fy = I.fy;
  const h = o.h;
  const N = A.M.N;
  const CD = EN[0];
  const SD = EN[1];

  const cage = (f: 'i' | 'o'): CtCageDesign => {
    const R = f === 'i' ? I.ri : I.ro;
    return { d: R.d, s: R.s, As: ctBarA(R.d) / R.s, c: R.c };
  };
  const ci = cage('i');
  const co = cage('o');

  const dFace = (f: 'i' | 'o'): number =>
    I.cages === 2
      ? f === 'i'
        ? h - ci.c - ci.d / 2
        : h - co.c - co.d / 2
      : f === 'i'
        ? h - ci.c - ci.d / 2
        : ci.c + ci.d / 2;

  const AsFace = (f: 'i' | 'o'): number => (I.cages === 2 ? (f === 'i' ? ci.As : co.As) : ci.As);

  const sec = [
    { id: 1, nm: 'Đỉnh cống (θ = 0°)', i: 0 },
    { id: 2, nm: 'Thân cống ngang tâm (θ = 90°)', i: N / 4 },
    { id: 3, nm: 'Đáy cống (θ = 180°)', i: N / 2 },
  ];

  const g = 0.85 * fc;
  const gp = Math.min(0.85 * fc, Math.max(0.65 * fc, fc * (0.85 - 0.0073 * (fc - 28))));
  const Si = I.D0 * 1000;
  const rs = o.Ri * 1000 + ci.c + ci.d / 2;
  const Frt =
    Si <= 1830
      ? 1 + 0.000328 * (1830 - Math.max(Si, 300))
      : Si <= 3660
        ? (3660 - Si) ** 2 / 16.77e6 + 0.8
        : 0.8;

  const Asmin_i =
    I.cages === 2
      ? Math.max(0.15, (2.26e-5 * (Si + h) ** 2) / fy)
      : Math.max(0.15, (4.5e-5 * (Si + h) ** 2) / fy);
  const Asmin_o = I.cages === 2 ? Math.max(0.15, (1.36e-5 * (Si + h) ** 2) / fy) : null;

  const flex = (f: 'i' | 'o', Mu: number, Nu: number): CtFlexResult => {
    const d = dFace(f);
    const ph = o.ph.f;
    const MuN = Mu * 1000;
    const NuN = Nu;
    const disc = g * (g * (ph * d) ** 2 - NuN * (2 * ph * d - h) - 2 * MuN);
    const req = disc >= 0 ? (g * ph * d - NuN - Math.sqrt(disc)) / fy : Infinity;
    return { d, ph, req: Math.max(0, req), disc };
  };

  const crack = (f: 'i' | 'o', Ms: number, Ns: number): CtCrackResult => {
    const d = dFace(f);
    const As = AsFace(f);
    const cv = f === 'i' ? ci : I.cages === 2 ? co : ci;
    const tb = I.cages !== 2 && f === 'o' ? h - ci.c - ci.d : cv.c;
    const Sl = cv.s;
    const B1 = Math.cbrt((25.4 * tb * Sl) / (2 * I.nlay));
    const ph = o.ph.f;
    const C1 = I.C1;
    const MsN = Ms * 1000;
    const NsN = Ns;
    let e: number | null = null;
    let j: number | null = null;
    let ii: number | null = null;
    let Fcr: number;
    const base = 0.083 * C1 * h * h * Math.sqrt(fc);
    if (NsN >= 0) {
      e = NsN > 1e-9 ? MsN / NsN + d - h / 2 : Infinity;
      j = Math.min(0.9, 0.74 + (0.1 * e) / d);
      ii = isFinite(e) ? 1 / (1 - (j * d) / e) : 1;
      Fcr = ((1.9e-4 * B1) / (ph * d * As)) * ((MsN + NsN * (d - h / 2)) / (ii * j) - base);
    } else {
      Fcr = ((1.9e-4 * B1) / (ph * d * As)) * (1.1 * MsN - 0.6 * NsN * d - base);
    }
    return {
      d,
      As,
      tb,
      Sl,
      B1,
      e,
      j,
      i: ii,
      Fcr: Math.max(Fcr, 0),
      raw: Fcr,
      ok: Fcr <= 1 + 1e-9,
      eOverD: e && isFinite(e) ? e / d : null,
    };
  };

  const BK: CtBookMoments = (() => {
    const R = o.R;
    const m = Math.tan(((45 - (I.phiB || 30) / 2) * Math.PI) / 180) ** 2;
    const gs = o.gsEff;
    const qE = o.VAF * gs * I.hs;
    const qD = o.VAF * (I.gma * I.hma + I.gmo * I.hmo);
    const hE = o.HAF * gs * I.hs;
    const hD = o.HAF * (I.gma * I.hma + I.gmo * I.hmo);
    const qL = o.vg.q;
    const qLn = o.qlane;
    const gz = I.gc * I.t;
    const C = ctCombos(I)[0];
    const gr = C.g;
    const k = 0.137 * R * R * (1 - m);
    const kb = [0.304, 0.337, 0.369];
    const qv = [
      [qE, qD],
      [hE, hD],
      [qE, qD],
    ];
    const one = (i: number, gE: number, gD: number, gL: number, gC: number) =>
      k * (gE * qv[i][0] + gD * qv[i][1] + gL * (qL + qLn)) + gC * kb[i] * gz * R * R;
    const parts = [0, 1, 2].map((i) => ({
      EV: k * qv[i][0],
      DW: k * qv[i][1],
      LL: k * (qL + qLn),
      DC: kb[i] * gz * R * R,
    }));
    return {
      R,
      m,
      k,
      qE,
      qD,
      hE,
      hD,
      qL,
      qLn,
      gz,
      kb,
      g: gr,
      parts,
      Mu: [0, 1, 2].map((i) => one(i, gr.EV, gr.DW, gr.LL, gr.DC)),
      Ms: [0, 1, 2].map((i) => one(i, 1, 1, 1, 1)),
    };
  })();

  const useB = I.mm === 'S';
  const rows: CtDesignRow[] = sec.map((s) => {
    const st = CD.st[s.i];
    const sd = SD.st[s.i];
    const face: 'i' | 'o' = s.id === 2 ? 'o' : 'i';
    const sg = face === 'i' ? 1 : -1;
    const t = face === 'i' ? st.Mmax : st.Mmin;
    const ts = face === 'i' ? sd.Mmax : sd.Mmin;
    const Mu = useB ? BK.Mu[s.id - 1] : Math.max(0, sg * t[0]);
    const Nu = useB ? 0 : -t[2];
    const Ms = useB ? BK.Ms[s.id - 1] : Math.max(0, sg * ts[0]);
    const Ns = useB ? 0 : -ts[2];
    const F = flex(face, Mu, Nu);
    const As = AsFace(face);
    const Cr = crack(face, Ms, Ns);
    const Asmax_c = ((380 * gp * F.ph * F.d) / (600 + fy) - 0.75 * Nu) / fy;
    const Asmax_r =
      face === 'i' ? (0.111 * rs * 1 * Math.sqrt(fc) * (o.ph.r / o.ph.f) * Frt) / fy : null;
    const Amin = face === 'i' ? Asmin_i : Asmin_o == null ? Asmin_i : Asmin_o;
    return {
      s,
      face,
      Mu,
      Nu,
      Vu: st.Vabs[1],
      Ms,
      Ns,
      F,
      As,
      okF: As >= F.req - 1e-9,
      Amin,
      okMin: As >= Amin - 1e-9,
      Asmax_c,
      okMaxC: As <= Asmax_c + 1e-9,
      Asmax_r,
      okMaxR: Asmax_r == null || As <= Asmax_r + 1e-9,
      Cr,
      radial: null,
    };
  });

  // Critical shear section where Mnu/(Vu*d) = 3.0 (Eq. 50)
  const shearRaw: Array<Omit<CtShearRow, 'zone' | 'thv' | 'stir'>> = [];
  CD.full.forEach((fu) => {
    const r = fu.r;
    const val = (i: number) => {
      const [M, V, Nn] = r[i];
      const face: 'i' | 'o' = M >= 0 ? 'i' : 'o';
      const d = dFace(face);
      const Nu = -Nn;
      const Mnu = Math.abs(M) * 1000 - (Nu * (4 * h - d)) / 8;
      return {
        ratio: Math.abs(V) > 1e-6 ? Mnu / (Math.abs(V) * d) : Infinity,
        face,
        d,
        M,
        V,
        Nu,
        Mnu,
      };
    };
    for (let i = 0; i < N; i++) {
      const a = val(i);
      const b = val((i + 1) % N);
      if (!isFinite(a.ratio) || !isFinite(b.ratio)) continue;
      if ((a.ratio - 3) * (b.ratio - 3) <= 0 && a.face === b.face) {
        const w = (3 - a.ratio) / (b.ratio - a.ratio || 1);
        const lerp = (x: number, y: number) => x + (y - x) * w;
        const th = ((i + w) * 360) / N;
        const Vu = lerp(Math.abs(a.V), Math.abs(b.V));
        const Mu = lerp(Math.abs(a.M), Math.abs(b.M));
        const Nu = lerp(a.Nu, b.Nu);
        const face = a.face;
        const d = a.d;
        const As = AsFace(face);
        const rho = Math.min(As / d, 0.02);
        const Fd = Math.min(0.8 + 41 / d, I.cages !== 2 && Si <= 915 ? 1.4 : 1.3);
        const Fn = Nu >= 0 ? 1 + Nu / (13.8 * h) : 1 + Nu / (3.45 * h);
        const Fc = 1 + ((face === 'i' ? 1 : -1) * d) / (2 * o.R * 1000);
        const fcs = Math.min(fc, 49);
        const Vn = 5.23 * d * 1 * Math.sqrt(fcs) * (0.0175 + rho) * ((Fd * Fn) / Fc);
        const Vr = o.ph.v * Vn;
        const Mnu = lerp(a.Mnu, b.Mnu);
        shearRaw.push({
          th,
          wa: fu.wa,
          face,
          Vu,
          Mu,
          Mnu,
          Nu,
          d,
          As,
          rho,
          Fd,
          Fn,
          Fc,
          Vn,
          Vr,
          ok: Vr >= Vu - 1e-9,
        });
      }
    }
  });

  const zone = (th: number) => {
    const a = th > 180 ? 360 - th : th;
    return a < 90 ? 'Vùng đỉnh' : 'Vùng đáy';
  };
  const best: Record<string, CtShearRow> = {};
  shearRaw.forEach((x) => {
    const k = zone(x.th) + (x.wa ? ', có nước' : ', không nước');
    if (!best[k] || x.Vu / x.Vr > best[k].Vu / best[k].Vr) {
      best[k] = {
        ...x,
        zone: k,
        thv: x.th > 180 ? 360 - x.th : x.th,
        stir: null,
      };
    }
  });
  const SH = Object.values(best).sort((a, b) => (a.zone < b.zone ? -1 : 1));

  const warn: string[] = [];
  if (I.cages !== 2 && Si > 840) {
    warn.push(
      'Lồng cốt thép đơn, Si = ' +
        Si.toFixed(0) +
        ' mm > 840 mm: ngoài phạm vi PT 31 (Điều 10.4.2.4.2). Vẫn dùng PT 31 để tính As,min; nên dùng 2 lồng cốt thép.',
    );
  }
  if (I.cages !== 2 && Si > 915) {
    warn.push(
      'Lồng cốt thép đơn, Si = ' +
        Si.toFixed(0) +
        ' mm > 915 mm: Fd ≤ 1,4 (PT 46) chỉ dùng cho lồng tròn đơn có Si ≤ 915 mm (bản in TCVN 11823-12 không ghi rõ giới hạn; AASHTO LRFD Bridge Design Specifications, 7th Ed. (2014), Điều 12.10.4.2.4: "through 36 in" = 915 mm); lấy Fd ≤ 1,3 cho an toàn.',
    );
  }

  // Radial & shear stirrups (§10.4.2.6, Eq. 51–55)
  const fyv = I.fyv > 0 ? Math.min(I.fyv, fy) : fy;
  const phr = o.ph.r;
  const phv = o.ph.v;
  const svLim = (d: number) => Math.min(0.75 * phv * d, 150);
  const svOf = (d: number) => (I.sv > 0 ? I.sv : Math.floor(svLim(d)));
  const Avr = (Mu: number, Nu: number, d: number) => {
    const svVal = svOf(d);
    const areaVal = (1.1 * svVal * (Mu * 1000 - 0.45 * Nu * phr * d)) / (fyv * rs * phr * d);
    return { sv: svVal, svMax: svLim(d), A: Math.max(0, areaVal) };
  };

  rows.forEach((r) => {
    r.radial = null;
    if (r.face === 'i' && !r.okMaxR) {
      const q = Avr(r.Mu, r.Nu, r.F.d);
      r.radial = { ...q, okSv: q.sv <= q.svMax + 1e-9 };
    }
  });

  const zoneRow = (th: number) => {
    const a = th > 180 ? 360 - th : th;
    return rows[a < 90 ? 0 : 2];
  };
  SH.forEach((x) => {
    x.stir = null;
    if (x.ok) return;
    const svVal = svOf(x.d);
    const Vc = Math.min((4 * x.Vr) / (x.Mnu / (x.Vu * x.d) + 1), 0.166 * phv * x.d * Math.sqrt(fc));
    const zr = zoneRow(x.th);
    const ar = x.face === 'i' && zr.radial ? (zr.radial.A * svVal) / zr.radial.sv : 0;
    const Avs = Math.max(0, ((1.1 * svVal) / (fyv * phv * x.d)) * (x.Vu * x.Fc - Vc)) + ar;
    x.stir = {
      sv: svVal,
      svMax: svLim(x.d),
      okSv: svVal <= svLim(x.d) + 1e-9,
      Vc,
      Avr: ar,
      Avs,
    };
  });

  return { BK, useB, warn, fyv, rows, shear: SH, ci, co, Frt, rs, g, gp, Asmin_i, Asmin_o, Si };
}

export function ctIndirect(o: CtDerived, I: CtInput): CtIndirectResult {
  const Si = I.D0 * 1000;
  const lp = (x: number, xs: readonly number[], ys: readonly number[]) => {
    if (x <= xs[0]) return ys[0];
    for (let i = 1; i < xs.length; i++) {
      if (x <= xs[i]) return ys[i - 1] + ((ys[i] - ys[i - 1]) * (x - xs[i - 1])) / (xs[i] - xs[i - 1]);
    }
    return ys[ys.length - 1];
  };
  const BFE = lp(Si, CT_BFE_T.d, CT_BFE_T.t[I.inst] || CT_BFE_T.t[1]);
  const BFLL =
    o.Hmm < 600
      ? lp(Si, [300, 600, 750], [3.2, 3.2, 2.2])
      : lp(Si, [300, 600, 750], [2.4, 2.4, 2.2]);
  const WE = o.WEV + o.WDW;
  const WF = I.water ? o.WWF : 0;
  const WL = o.WLL;
  const fac = I.inst === 1 ? 1.1 : 1.0;
  const D = (1000 / Si) * ((WE + WF) / BFE + WL / BFLL) * fac;
  return {
    Si,
    BFE,
    BFLL,
    WE,
    WF,
    WL,
    fac,
    D,
    P: (D * Si) / 1000,
    Dp: I.D025 || 0,
    ok: I.D025 > 0 ? I.D025 >= D - 1e-9 : null,
  };
}

export function ctCalc(I: CtInput): CtResult {
  const A = ctAnalyse(I);
  const EN = ctEnvelope(A, I);
  const DS = ctDesign(A, I, EN);
  const IN = ctIndirect(A.o, I);
  return { A, EN, DS, IN, I };
}

export const CT = {
  calc: ctCalc,
  derive: ctDerive,
  INST: CT_INST,
  PSI_DEF: CT_PSI_DEF,
  PHI: CT_PHI,
  STEEL: CT_STEEL,
  barA: ctBarA,
  combos: ctCombos,
};

// ---------------------------------------------------------------------------
// 4. DOM / Headless Input Readers, HTML Table Updaters & Step Runner
// ---------------------------------------------------------------------------

let latestCtResult: CtResult | null = null;

export function getLatestCtResult(): CtResult | null {
  return latestCtResult;
}

export function setLatestCtResult(res: CtResult | null): void {
  latestCtResult = res;
}

const ctN = (id: string): number => {
  const e = $(id);
  if (!e) return 0;
  const parsed = parseFloat(String(e.value).replace(',', '.'));
  return isFinite(parsed) ? parsed : 0;
};

export function ctInputs(): CtInput {
  const st = v('ct_st', 'CB300-V');
  const S = CT_STEEL[st] || [300, 450];
  const nl = Math.max(1, Math.round(ctN('ct_nl')));
  return {
    D0: ctN('ct_D0'),
    t: ctN('ct_t'),
    hs: ctN('ct_hs'),
    hma: ctN('ct_hma'),
    hmo: ctN('ct_hmo'),
    tm: ctN('ct_tm'),
    gma: ctN('ct_gma'),
    gmo: ctN('ct_gmo'),
    gs: ctN('ct_gs'),
    gc: ctN('ct_gc'),
    fc: ctN('ct_fc'),
    wc: ctN('ct_wc'),
    K1: 1,
    st,
    fy: S[0],
    Es: ctN('ct_Es') || 200000,
    gw: ctN('ct_gw') || 9.81,
    inst: +v('ct_inst', '0'),
    psi: ctN('ct_psi'),
    nl,
    lane: +v('ct_lane', '0'),
    water: +v('ct_wa', '0'),
    etaD: ctN('ct_etaD') || 1,
    etaI: ctN('ct_etaI') || 1,
    cages: +v('ct_cages', '0'),
    D025: ctN('ct_D025'),
    mm: v('ct_mm', 'T') || 'T',
    phiB: ctN('ct_phiB') || 30,
    fyv: ctN('ct_fyv'),
    sv: ctN('ct_sv'),
    nlay: Math.max(1, ctN('ct_nlay')),
    C1: +v('ct_C1', '0'),
    ri: { d: ctN('ct_rid'), s: ctN('ct_ris'), c: ctN('ct_ric') },
    ro: { d: ctN('ct_rod'), s: ctN('ct_ros'), c: ctN('ct_roc') },
    m: [1.2, 1.0, 0.85, 0.65][Math.min(nl, 4) - 1],
  };
}

export function ctTables(R: CtResult): void {
  const A = R.A;
  const o = A.o;
  const I = R.I;
  const EN = R.EN;
  const D = R.DS;
  const setH = (id: string, html: string) => set(id, html);

  setH(
    'tbCtInst',
    `<tr><th>Loại lắp đặt</th><th>1</th><th>2</th><th>3</th><th>4</th></tr><tr><td class="l">VAF</td>${[1, 2, 3, 4].map((k) => `<td class="c${k === I.inst ? ' ok' : ''}">${CT_INST[k].VAF.toFixed(2)}</td>`).join('')}</tr><tr><td class="l">HAF</td>${[1, 2, 3, 4].map((k) => `<td class="c${k === I.inst ? ' ok' : ''}">${CT_INST[k].HAF.toFixed(2)}</td>`).join('')}</tr><tr><td class="l">ψ mặc định (độ)</td>${[1, 2, 3, 4].map((k) => `<td class="c${k === I.inst ? ' ok' : ''}">${cf(CT_PSI_DEF[k], 1)}</td>`).join('')}</tr>`,
  );

  const llRows: Array<[string, string, (vl: CtVehicleLoad) => string | number, string]> = [
    ['Tải trọng một trục', 'P', (vl) => vl.P, 'kN'],
    ['Cự ly trục xe', 'sa', (vl) => vl.sa, 'mm'],
    ['Chiều dày lớp phủ dùng tính phân bố', 'H', () => cf(o.thin ? 300 : o.Hmm, 0), 'mm'],
    ['Chiều sâu tương tác vuông góc hướng xe chạy', 'Hint-t', () => cf(o.Hint_t, 0), 'mm'],
    ['Bề rộng vệt tải (dọc trục ống)', 'Ww', () => cf(o.Ww, 0), 'mm'],
    ['Chiều sâu tương tác theo hướng xe chạy', 'Hint-p', (vl) => cf(vl.Hp, 0), 'mm'],
    [
      'Chiều dài vệt tải (ngang ống)',
      'Lw',
      (vl) => cf(vl.Lw, 0) + (vl.pInt ? ' (gộp 2 trục)' : ''),
      'mm',
    ],
    ['Tổng tải trọng bánh xe trên vệt', 'ΣP', (vl) => cf(vl.Pw, 1), 'kN'],
    ['Áp lực hoạt tải tại đỉnh cống (PT 10)', 'PL', (vl) => cf(vl.q), 'kPa'],
    ['Tải trọng trên 1 m ống: PL.min(Lw; Bc)', 'PL.bL', (vl) => cf(vl.q * vl.bL), 'kN/m'],
  ];

  setH(
    'tbCtLL',
    `<tr><th colspan="4">Thông số</th><th>Ký hiệu</th>${o.veh.map((vl) => `<th>${vl.nm}</th>`).join('')}<th>Đơn vị</th></tr>` +
      llRows
        .map(
          (r) =>
            `<tr><td class="l" colspan="4">${r[0]}</td><td class="c">${r[1]}</td>${o.veh.map((vl) => `<td>${r[2](vl)}</td>`).join('')}<td class="c">${r[3]}</td></tr>`,
        )
        .join('') +
      `<tr><td class="l" colspan="${o.veh.length + 6}">Xe khống chế (tải trọng trên 1 m ống lớn nhất): ${o.vg.nm.toLowerCase()}.</td></tr>`,
  );

  const loadRows: Array<[string, string, number | null]> = [
    ['Trọng lượng bản thân ống cống', 'WDC', o.WDC],
    ['Tải trọng đất đắp thẳng đứng', 'WEV', o.WEV],
    ['Tải trọng đất đắp nằm ngang, mỗi bên', 'HEV', o.HEV],
    ['Tải trọng áo đường thẳng đứng', 'WDW', o.WDW],
    ['Tải trọng áo đường nằm ngang, mỗi bên', 'HDW', o.HDW],
    ['Trọng lượng nước trong ống', 'WF', I.water ? o.WWF : null],
    ['Hoạt tải xe và tải trọng làn', 'WL', o.WLL],
  ];
  setH(
    'tbCtLoads',
    `<tr><th>Stt</th><th colspan="5">Tải trọng tác dụng (trên 1 m chiều dài ống)</th><th>Ký hiệu</th><th>Giá trị</th><th>Đơn vị</th></tr>` +
      loadRows
        .map(
          (r, i) =>
            `<tr><td class="c">${i + 1}</td><td class="l" colspan="5">${r[0]}</td><td class="c">${r[1]}</td><td>${r[2] == null ? 'không xét' : cf(r[2])}</td><td class="c">kN/m</td></tr>`,
        )
        .join(''),
  );

  const C = ctCombos(I);
  const cKeys: CtCaseKey[] = ['DC', 'DW', 'EV', 'WA', 'LL'];
  setH(
    'tbCtCmb',
    `<tr><th colspan="3">Trạng thái giới hạn</th><th>Hệ số</th><th>DC</th><th>DW</th><th>EV</th><th>WA</th><th>LL</th></tr>` +
      C.map(
        (c) =>
          `<tr><td class="l" colspan="3" rowspan="3">${c.name}</td><td class="c">γ</td>${cKeys.map((k) => `<td class="c">${c.gr[k].toFixed(2)}</td>`).join('')}</tr><tr><td class="c">η</td>${cKeys.map((k) => `<td class="c">${c.eta[k].toFixed(2)}</td>`).join('')}</tr><tr><td class="c">η.γ</td>${cKeys.map((k) => `<td class="c">${c.g[k].toFixed(3)}</td>`).join('')}</tr>`,
      ).join(''),
  );

  const N = A.M.N;
  const ix = [0, N / 4, N / 2];
  const ks: CtCaseKey[] = (['DC', 'DW', 'EV'] as CtCaseKey[])
    .concat(I.water ? ['WA'] : [])
    .concat(['LL']);
  const compRows: Array<[string, 0 | 1 | 2]> = [
    ['M (kN.m/m)', 0],
    ['N (kN/m)', 2],
    ['Q (kN/m)', 1],
  ];
  setH(
    'tbCtCase',
    `<tr><th rowspan="2">Mặt cắt</th><th rowspan="2">Nội lực</th><th colspan="${ks.length}">Trường hợp tải (chưa nhân hệ số)</th></tr><tr>${ks.map((k) => `<th>${k}</th>`).join('')}</tr>` +
      ix
        .map((i, si) =>
          compRows
            .map(
              ([nm, j], q) =>
                `<tr>${q ? '' : `<td class="c" rowspan="3">${si + 1} - ${si + 1}</td>`}<td class="l">${nm}</td>${ks.map((k) => `<td>${cf(A.out[k][i][j])}</td>`).join('')}</tr>`,
            )
            .join(''),
        )
        .join(''),
  );

  setH(
    'tbCtRes',
    `<tr><th rowspan="2">Mặt cắt</th><th colspan="3">TTGH Cường độ I</th><th colspan="3">TTGH Sử dụng I</th></tr><tr><th>M max / M min (kN.m/m)</th><th>N đồng thời (kN/m)</th><th>|Q| max (kN/m)</th><th>M max / M min (kN.m/m)</th><th>N đồng thời (kN/m)</th><th>|Q| max (kN/m)</th></tr>` +
      ix
        .map((i, si) => {
          const a = EN[0].st[i];
          const b = EN[1].st[i];
          const f = si === 1 ? 'Mmin' : 'Mmax';
          return `<tr><td class="c">${si + 1} - ${si + 1}</td><td>${cf(a.Mmax[0])} / ${cf(a.Mmin[0])}</td><td>${cf(a[f][2])}</td><td>${cf(Math.abs(a.Vabs[1]))}</td><td>${cf(b.Mmax[0])} / ${cf(b.Mmin[0])}</td><td>${cf(b[f][2])}</td><td>${cf(Math.abs(b.Vabs[1]))}</td></tr>`;
        })
        .join('') +
      `<tr><td class="l" colspan="7">Lực dọc ghi kèm mômen gây kéo mặt trong (mặt cắt 1-1, 3-3) hoặc mặt ngoài (mặt cắt 2-2).</td></tr>`,
  );

  const fn = (f: 'i' | 'o') => (f === 'i' ? 'trong' : 'ngoài');
  setH(
    'tbCtFlex',
    `<tr><th>Mặt cắt</th><th>Mặt chịu kéo</th><th>Mu (kN.m/m)</th><th>Nu (kN/m)</th><th>φf</th><th>d (mm)</th><th>As yêu cầu (mm2/mm)</th><th>As bố trí (mm2/mm)</th><th>KL</th></tr>` +
      D.rows
        .map(
          (r) =>
            `<tr><td class="c">${r.s.id} - ${r.s.id}</td><td class="c">${fn(r.face)}</td><td>${cf(r.Mu)}</td><td>${cf(r.Nu)}</td><td class="c">${cf(r.F.ph, 2)}</td><td>${cf(r.F.d, 1)}</td><td>${isFinite(r.F.req) ? cf(r.F.req, 3) : 'vượt khả năng'}</td><td>${cf(r.As, 3)}</td>${okc(r.okF)}</tr>`,
        )
        .join('') +
      `<tr><td class="l" colspan="9">Mu (kN.m/m) đổi sang N.mm/mm nhân 1000; Nu (kN/m) bằng N/mm.</td></tr>`,
  );

  const minRows: Array<[string, number, number, string]> = [
    ['trong', D.Asmin_i, D.ci.As, I.cages === 2 ? 'PT 29' : 'PT 31'],
    ...(I.cages === 2
      ? ([['ngoài', D.Asmin_o as number, D.co.As, 'PT 30']] as Array<[string, number, number, string]>)
      : []),
  ];
  setH(
    'tbCtMin',
    `<tr><th>Mặt</th><th>Si (mm)</th><th>h (mm)</th><th>Công thức</th><th>As,min (mm2/mm)</th><th>As bố trí (mm2/mm)</th><th>KL</th></tr>` +
      minRows
        .map(
          (r) =>
            `<tr><td class="c">${r[0]}</td><td>${cf(D.Si, 0)}</td><td>${cf(o.h, 0)}</td><td class="c">${r[3]}</td><td>${cf(r[1], 3)}</td><td>${cf(r[2], 3)}</td>${okc(r[2] >= r[1] - 1e-9)}</tr>`,
        )
        .join(''),
  );

  setH(
    'tbCtMax',
    `<tr><th>Mặt cắt</th><th>Mặt</th><th>rs (mm)</th><th>Frt</th><th>Rφ</th><th>As,max (PT 32)</th><th>g' (MPa)</th><th>As,max (PT 33)</th><th>As bố trí</th><th>KL</th></tr>` +
      D.rows
        .map(
          (r) =>
            `<tr><td class="c">${r.s.id} - ${r.s.id}</td><td class="c">${fn(r.face)}</td><td>${r.face === 'i' ? cf(D.rs, 1) : '-'}</td><td>${r.face === 'i' ? cf(D.Frt, 3) : '-'}</td><td>${r.face === 'i' ? cf(o.ph.r / o.ph.f, 3) : '-'}</td><td>${r.Asmax_r == null ? '-' : cf(r.Asmax_r, 3)}</td><td>${cf(D.gp, 2)}</td><td>${cf(r.Asmax_c, 3)}</td><td>${cf(r.As, 3)}</td>${okc(r.okMaxR && r.okMaxC)}</tr>`,
        )
        .join('') +
      `<tr><td class="l" colspan="10">PT 32 áp dụng cho cốt thép mặt trong chịu kéo (vùng đỉnh, đáy ống); Frp = 1,0. Đơn vị As: mm2/mm.</td></tr>` +
      D.rows
        .filter((r) => r.radial)
        .map(
          (r) =>
            `<tr><td class="l" colspan="10">Mặt cắt ${r.s.id} - ${r.s.id}: As > As,max (PT 32) nên phải bố trí cốt đai chịu kéo hướng tâm (Điều 10.4.2.6). PT 51: Avr = <b>${cf(r.radial!.A, 4)} mm2/mm</b> mỗi hàng đai, sv = ${cf(r.radial!.sv, 0)} mm (PT 52: sv ≤ ${cf(r.radial!.svMax, 0)} mm: ${r.radial!.okSv ? 'Đạt' : 'Không đạt'}); fy đai = ${cf(D.fyv, 0)} MPa.</td></tr>`,
        )
        .join(''),
  );

  setH(
    'tbCtCr',
    `<tr><th>Mặt cắt</th><th>Mặt</th><th>Ms (kN.m/m)</th><th>Ns (kN/m)</th><th>d (mm)</th><th>e (mm)</th><th>j</th><th>i</th><th>B1</th><th>Fcr</th><th>KL</th></tr>` +
      D.rows
        .map((r) => {
          const c = r.Cr;
          return `<tr><td class="c">${r.s.id} - ${r.s.id}</td><td class="c">${fn(r.face)}</td><td>${cf(r.Ms)}</td><td>${cf(r.Ns)}</td><td>${cf(c.d, 1)}</td><td>${c.e == null ? '-' : isFinite(c.e) ? cf(c.e, 0) : '∞'}</td><td>${c.j == null ? '-' : cf(c.j, 3)}</td><td>${c.i == null ? '-' : cf(c.i, 3)}</td><td>${cf(c.B1, 2)}</td><td>${cf(c.Fcr, 3)}</td>${okc(c.ok)}</tr>`;
        })
        .join('') +
      `<tr><td class="l" colspan="11">Ns dương là nén. Fcr âm (mômen chưa gây nứt) ghi bằng 0. tb, Sl: lớp bảo vệ và bước cốt thép của lồng chịu kéo; C1 = ${I.C1}; n = ${I.nlay}.</td></tr>`,
  );

  setH(
    'tbCtV',
    D.shear.length
      ? `<tr><th colspan="3">Vị trí mặt cắt nguy hiểm</th><th>θ (độ)</th><th>Mặt kéo</th><th>Vu (kN/m)</th><th>Mu (kN.m/m)</th><th>Nu (kN/m)</th><th>d (mm)</th></tr>` +
          D.shear
            .map(
              (x) =>
                `<tr><td class="l" colspan="3">${x.zone}</td><td>${cf(x.thv, 1)}</td><td class="c">${fn(x.face)}</td><td>${cf(x.Vu)}</td><td>${cf(x.Mu)}</td><td>${cf(x.Nu)}</td><td>${cf(x.d, 1)}</td></tr>`,
            )
            .join('')
      : `<tr><td class="l">Không có mặt cắt thỏa mãn Mnu/(Vu.d) = 3,0 trên chu vi ống.</td></tr>`,
  );

  const v2Body = D.shear.length
    ? `<tr><th colspan="3">Vị trí mặt cắt nguy hiểm</th><th>ρ</th><th>Fd</th><th>Fn</th><th>Fc</th><th>Vn (kN/m)</th><th>Vr (kN/m)</th><th>Vu (kN/m)</th><th>KL</th></tr>` +
      D.shear
        .map(
          (x) =>
            `<tr><td class="l" colspan="3">${x.zone}</td><td>${cf(x.rho, 4)}</td><td>${cf(x.Fd, 3)}</td><td>${cf(x.Fn, 3)}</td><td>${cf(x.Fc, 3)}</td><td>${cf(x.Vn)}</td><td>${cf(x.Vr)}</td><td>${cf(x.Vu)}</td>${okc(x.ok)}</tr>`,
        )
        .join('')
    : '';
  setH(
    'tbCtV2',
    D.useB && v2Body
      ? `<tr><td class="l" colspan="11" style="color:#b45309">⚠ Đang tính nội lực theo sổ tay: lực cắt và các bảng mục 9 lấy từ phân tích vòng ống theo TCVN, chỉ để tham khảo, không đưa vào kết luận.</td></tr>` +
          v2Body
      : v2Body,
  );

  setH(
    'tbCtStir',
    (() => {
      const st = D.shear.filter((x) => x.stir);
      const rr = D.rows.filter((r) => r.radial);
      if (!st.length && !rr.length) {
        return `<tr><td class="l">Vr ≥ Vu và As ≤ As,max (PT 32) tại mọi mặt cắt: không cần cốt đai hướng tâm.</td></tr>`;
      }
      let h = '';
      if (rr.length) {
        h +=
          `<tr><th colspan="3">Kéo hướng tâm (PT 51)</th><th>Mu (kN.m/m)</th><th>Nu (kN/m)</th><th>d (mm)</th><th>rs (mm)</th><th>sv (mm)</th><th>sv,max (mm)</th><th>Avr (mm2/mm)</th></tr>` +
          rr
            .map(
              (r) =>
                `<tr><td class="l" colspan="3">Mặt cắt ${r.s.id} - ${r.s.id}</td><td>${cf(r.Mu)}</td><td>${cf(r.Nu)}</td><td>${cf(r.F.d, 1)}</td><td>${cf(D.rs, 1)}</td><td>${cf(r.radial!.sv, 0)}</td><td class="${r.radial!.okSv ? 'ok' : 'bad'}">${cf(r.radial!.svMax, 0)}</td><td><b>${cf(r.radial!.A, 4)}</b></td></tr>`,
            )
            .join('');
      }
      if (st.length) {
        h +=
          `<tr><th colspan="3">Cắt (PT 53 - 55)</th><th>Vu.Fc (kN/m)</th><th>Mnu/(Vu.d)</th><th>Vc (kN/m)</th><th>sv (mm)</th><th>sv,max (mm)</th><th>Avr (mm2/mm)</th><th>Avs (mm2/mm)</th></tr>` +
          st
            .map(
              (x) =>
                `<tr><td class="l" colspan="3">${x.zone}</td><td>${cf(x.Vu * x.Fc)}</td><td>${cf(x.Mnu / (x.Vu * x.d), 2)}</td><td>${cf(x.stir!.Vc)}</td><td>${cf(x.stir!.sv, 0)}</td><td class="${x.stir!.okSv ? 'ok' : 'bad'}">${cf(x.stir!.svMax, 0)}</td><td>${cf(x.stir!.Avr, 4)}</td><td><b>${cf(x.stir!.Avs, 4)}</b></td></tr>`,
            )
            .join('');
      }
      return (
        h +
        `<tr><td class="l" colspan="10">Avr, Avs: diện tích cốt đai trên 1 mm chiều dài ống của mỗi hàng đai; các hàng đai cách nhau sv theo chu vi ống. fy đai = ${cf(D.fyv, 0)} MPa.</td></tr>`
      );
    })(),
  );

  {
    const B = D.BK;
    const el = $('ct_bookSec');
    if (el && el.style) el.style.display = D.useB ? '' : 'none';
    const bkRows: Array<[string, string, string, string]> = [
      ['Bán kính tính đến đường trọng tâm thành ống: R = D0/2 + t/2', 'R', cf(B.R, 3), 'm'],
      ['Hệ số áp lực ngang: m = tg²(45° - φ/2)', 'm', cf(B.m, 4), ''],
      ['Áp lực đứng do đất đắp: VAF.γs.H', 'qEV', cf(B.qE), 'kPa'],
      ['Áp lực đứng do kết cấu áo đường: VAF.(γma.hma + γmo.hmo)', 'qDW', cf(B.qD), 'kPa'],
      ['Áp lực ngang do đất đắp: HAF.γs.H', 'hEV', cf(B.hE), 'kPa'],
      ['Áp lực ngang do kết cấu áo đường', 'hDW', cf(B.hD), 'kPa'],
      ['Áp lực hoạt tải xe + tải trọng làn trên đỉnh cống (mục 4.3)', 'qLL', cf(B.qL + B.qLn), 'kPa'],
      ['Trọng lượng bản thân thành ống: γc.t', 'gz', cf(B.gz), 'kPa'],
    ];
    setH(
      'tbCtBook',
      `<tr><th colspan="3">Đại lượng</th><th>Ký hiệu</th><th>Giá trị</th><th>Đơn vị</th></tr>` +
        bkRows
          .map(
            (r) =>
              `<tr><td class="l" colspan="3">${r[0]}</td><td class="c">${r[1]}</td><td>${r[2]}</td><td class="c">${r[3]}</td></tr>`,
          )
          .join('') +
        `<tr><th colspan="2">Mặt cắt</th><th>M EV</th><th>M DW</th><th>M LL</th><th>M DC</th></tr>` +
        [0, 1, 2]
          .map(
            (i) =>
              `<tr><td class="l" colspan="2">${i + 1} - ${i + 1} ${i === 1 ? '(q lấy áp lực ngang)' : ''}</td><td>${cf(B.parts[i].EV, 3)}</td><td>${cf(B.parts[i].DW, 3)}</td><td>${cf(B.parts[i].LL, 3)}</td><td>${cf(B.parts[i].DC, 3)}</td></tr>`,
          )
          .join('') +
        `<tr><th colspan="2">Mặt cắt</th><th colspan="2">Mu, Cường độ I (kN.m/m)</th><th colspan="2">Ms, Sử dụng I (kN.m/m)</th></tr>` +
        [0, 1, 2]
          .map(
            (i) =>
              `<tr><td class="l" colspan="2">${i + 1} - ${i + 1}</td><td colspan="2"><b>${cf(B.Mu[i])}</b></td><td colspan="2">${cf(B.Ms[i])}</td></tr>`,
          )
          .join('') +
        `<tr><td class="l" colspan="6">Hệ số tải trọng như mục 5.2 (đã gồm η): EV ${cf(B.g.EV, 3)} ; DW ${cf(B.g.DW, 3)} ; LL ${cf(B.g.LL, 3)} ; DC ${cf(B.g.DC, 3)}. Lực dọc lấy N = 0. Mômen dùng kiểm toán uốn và nứt ở mục 7, 8; kiểm toán cắt (mục 9) vẫn dùng lực cắt từ phân tích vòng ống theo TCVN vì phương pháp sổ tay không cho lực cắt.</td></tr>`,
    );
  }

  {
    const NI = R.IN;
    const indRows: Array<[string, string, string, string]> = [
      ['Đường kính trong của ống', 'Si', cf(NI.Si, 0), 'mm'],
      ['Tải trọng đất và áo đường chưa nhân hệ số: WEV + WDW', 'WE', cf(NI.WE), 'N/mm'],
      ['Trọng lượng chất lỏng trong ống', 'WF', cf(NI.WF), 'N/mm'],
      ['Hoạt tải chưa nhân hệ số trên 1 mm chiều dài ống', 'WL', cf(NI.WL), 'N/mm'],
      [
        `Hệ số nền cho tải trọng đất (Bảng 18, lắp đặt loại ${I.inst}, nội suy theo Si)`,
        'BFE',
        cf(NI.BFE, 3),
        '',
      ],
      [
        `Hệ số nền cho hoạt tải (Bảng 20, lớp phủ ${o.Hmm < 600 ? '< 600' : '≥ 600'} mm)`,
        'BFLL',
        cf(NI.BFLL, 3),
        '',
      ],
      ['Hệ số lắp đặt (lắp đặt loại 1 nhân 1,10)', 'k', cf(NI.fac, 2), ''],
      ['Tải trọng D yêu cầu (vết nứt 0,25 mm), PT 56', 'D0,25', cf(NI.D, 1), 'N/m/mm'],
      ['Tải trọng thử ép 3 cạnh yêu cầu: D0,25.Si/1000', 'P0,25', cf(NI.P, 1), 'kN/m'],
      [
        'Tải trọng D0,25 của ống theo nhà sản xuất',
        'D0,25 ống',
        NI.Dp > 0 ? cf(NI.Dp, 1) : 'chưa nhập',
        'N/m/mm',
      ],
    ];
    setH(
      'tbCtInd',
      `<tr><th colspan="5">Thông số</th><th>Ký hiệu</th><th>Giá trị</th><th>Đơn vị</th></tr>` +
        indRows
          .map(
            (r) =>
              `<tr><td class="l" colspan="5">${r[0]}</td><td class="c">${r[1]}</td><td>${r[2]}</td><td class="c">${r[3]}</td></tr>`,
          )
          .join('') +
        (NI.ok == null
          ? ''
          : `<tr><td class="l" colspan="6">Kiểm tra D0,25 ống ≥ D0,25 yêu cầu</td><td colspan="2" class="c ${NI.ok ? 'ok' : 'bad'}">${NI.ok ? 'Đạt' : 'Không đạt'}</td></tr>`),
    );
  }

  {
    let all = true;
    const yes = (b: boolean) => {
      all = all && b;
      return okc(b);
    };
    if (R.IN.ok === false) all = false;
    const minOk = D.ci.As >= D.Asmin_i - 1e-9 && (I.cages !== 2 || D.co.As >= (D.Asmin_o ?? 0) - 1e-9);
    const vOkT = D.shear.every((x) => x.ok);
    const vOk = D.useB ? true : vOkT;
    const cOk =
      I.ri.c >= (o.h >= 63 ? 26 : 20) && (I.cages !== 2 || I.ro.c >= (o.h >= 63 ? 26 : 20));
    const maxAvs = D.shear.filter((x) => x.stir).map((x) => x.stir!.Avs);
    const maxAvr = D.rows.filter((r) => r.radial).map((r) => r.radial!.A);
    setH(
      'tbCtSum',
      `<tr><th>Mặt cắt</th><th colspan="3">Vị trí</th><th>Uốn (PT 27)</th><th>As max (PT 32, 33)</th><th>Nứt Fcr ≤ 1</th></tr>` +
        D.rows
          .map(
            (r) =>
              `<tr><td class="c">${r.s.id} - ${r.s.id}</td><td class="l" colspan="3">${r.s.nm}</td>${yes(r.okF)}${yes(r.okMaxR && r.okMaxC)}${yes(r.Cr.ok)}</tr>`,
          )
          .join('') +
        `<tr><td class="l" colspan="4">Cốt thép tối thiểu (PT 29 - 31)</td><td colspan="3" class="c ${minOk ? 'ok' : 'bad'}">${minOk ? 'Đạt' : 'Không đạt'}</td></tr>` +
        (D.useB
          ? `<tr><td class="l" colspan="4">Sức kháng cắt (Điều 10.4.2.5)</td><td colspan="3" class="c">Không kiểm toán: sổ tay không xác định lực cắt</td></tr>` +
            (vOkT
              ? ''
              : `<tr><td class="l" colspan="7" style="color:#b45309">⚠ Tham khảo: theo phân tích vòng ống TCVN (mục 9), Vr &lt; Vu, cần cốt đai hướng tâm Avs ≥ ${cf(Math.max(...maxAvs), 4)} mm2/mm. Hạng mục này không đưa vào kết luận khi tính theo sổ tay.</td></tr>`)
          : `<tr><td class="l" colspan="4">Sức kháng cắt không có cốt đai (Điều 10.4.2.5)</td><td colspan="3" class="c ${vOk ? 'ok' : 'bad'}">${vOk ? 'Đạt' : 'Không đạt: cần cốt đai hướng tâm Avs ≥ ' + cf(Math.max(...maxAvs), 4) + ' mm2/mm (mục 9.1)'}</td></tr>`) +
        (D.rows.some((r) => r.radial)
          ? `<tr><td class="l" colspan="4">Kéo hướng tâm (PT 32): As vượt As,max</td><td colspan="3" class="c bad">Cần cốt đai kéo hướng tâm Avr ≥ ${cf(Math.max(...maxAvr), 4)} mm2/mm (mục 9.1)</td></tr>`
          : '') +
        (D.warn || [])
          .map((w) => `<tr><td class="l" colspan="7" style="color:#b45309">⚠ ${w}</td></tr>`)
          .join('') +
        (R.IN.ok == null
          ? ''
          : `<tr><td class="l" colspan="4">Phương pháp gián tiếp: tải trọng D0,25 của ống (Điều 10.4.3)</td><td colspan="3" class="c ${R.IN.ok ? 'ok' : 'bad'}">${R.IN.ok ? 'Đạt' : 'Không đạt'}</td></tr>`) +
        `<tr><td class="l" colspan="4">Lớp bê tông bảo vệ (Điều 10.4.2.4.5)</td><td colspan="3" class="c ${cOk ? 'ok' : 'bad'}">${cOk ? 'Đạt' : 'Không đạt'}</td></tr>` +
        (D.useB
          ? `<tr><td class="l" colspan="7" style="color:#b45309">⚠ Mômen kiểm toán lấy theo sổ tay "Cống và cầu nhỏ trên đường ô tô" (M = 0,137qR²(1 - m)), KHÔNG theo phân tích vòng ống của TCVN 11823-12 Điều 10.4.2.2. Kết luận chỉ có giá trị tham khảo.</td></tr>`
          : '') +
        `<tr><td class="l" colspan="4"><b>KẾT LUẬN</b></td><td colspan="3" class="c ${all && minOk && vOk && cOk ? 'ok' : 'bad'}"><b>${all && minOk && vOk && cOk ? 'CỐNG TRÒN ĐẠT YÊU CẦU' : 'CÓ HẠNG MỤC KHÔNG ĐẠT - XEM CÁC BẢNG TRÊN'}</b></td></tr>`,
    );
  }
}

export function ctStep(opts?: { force?: boolean }): CtResult | null {
  if (!opts?.force && !$('tab18')) return null;

  let I: CtInput;
  try {
    I = ctInputs();
  } catch (e) {
    console.error(e);
    return null;
  }

  const sm = v('ct_mma', '0') || '0';
  const sn = v('ct_mmo', '0') || '0';
  const gmaEl = $('ct_gma');
  const gmoEl = $('ct_gmo');
  if (gmaEl) gmaEl.readOnly = sm !== '0';
  if (gmoEl) gmoEl.readOnly = sn !== '0';
  if (sm !== '0') sv('ct_gma', sm);
  if (sn !== '0') sv('ct_gmo', sn);
  I.gma = ctN('ct_gma');
  I.gmo = ctN('ct_gmo');

  const rRo = $('r_ct_ro');
  if (rRo && rRo.style) rRo.style.display = I.cages === 2 ? '' : 'none';

  let R: CtResult;
  try {
    R = ctCalc(I);
  } catch (e) {
    console.error(e);
    return null;
  }

  latestCtResult = R;
  const A = R.A;
  const o = A.o;

  set('o_ct_R', `${cf(o.Ri, 3)} ; ${cf(o.R, 3)} ; ${cf(o.Ro, 3)}`);
  set('o_ct_Bc', cf(o.Bc, 3));
  set('o_ct_Hph', cf(o.Hph, 3));
  set('o_ct_L1', '1.00');
  set('o_ct_gs', cf(o.gsEff, 2));
  set('o_ct_Ec', cf(o.Ec, 0));
  set('o_ct_fy', I.fy.toFixed(0));
  set('o_ct_VAF', cf(o.VAF, 2));
  set('o_ct_HAF', cf(o.HAF, 2));
  set('o_ct_psi', cf(o.psi, 1));
  set('o_ct_WDC', cf(o.WDC));
  set('o_ct_WEV', cf(o.WEV));
  set('o_ct_HEV', cf(o.HEV));
  set('o_ct_WDW', cf(o.WDW));
  set('o_ct_HDW', cf(o.HDW));
  set('o_ct_WF', I.water ? cf(o.WWF) : 'không xét');
  set('o_ct_m', cf(I.m, 2));
  set('o_ct_IM', cf(o.IM));
  set('o_ct_DE', cf(o.DE, 0));
  set('o_ct_LLDF', cf(o.LLDF, 4));
  set('o_ct_WLL', cf(o.WLL));
  set(
    'o_ct_LLmode',
    o.tooThin
      ? `Lớp phủ ${cf(o.Hmm, 0)} mm < 300 mm: phải tính bằng phương pháp chính xác hơn (TCVN 11823-3, Điều 6.1.2.6.1); bảng tính tạm lấy lớp phủ 300 mm.`
      : o.thin
        ? `Lớp phủ ${cf(o.Hmm, 0)} mm nằm trong khoảng 300 - 600 mm: thiết kế theo lớp phủ 300 mm (TCVN 11823-3, Điều 6.1.2.6.1).`
        : `Lớp phủ H = ${cf(o.Hmm, 0)} mm ≥ 600 mm: hoạt tải phân bố qua đất đắp trên diện tích chữ nhật Ww x Lw (Điều 6.1.2.6.2); H ${o.tInt ? '≥' : '<'} Hint-t nên vệt tải ${o.tInt ? 'gồm cả hai bánh xe của một trục' : 'tính cho từng bánh xe'}.`,
  );
  set(
    'o_ct_LLskip',
    o.LLskip
      ? 'Chiều dày đất đắp thỏa mãn điều kiện được phép bỏ qua hoạt tải (Điều 6.1.2.6.1); trong tính toán vẫn xét hoạt tải.'
      : '',
  );
  set(
    'o_ct_mesh',
    `Vòng ống chia ${A.M.N} phần tử (${cf(360 / A.M.N, 1)}° mỗi phần tử); bán kính tim R = ${cf(o.R, 3)} m; Ec = ${cf(o.Ec, 0)} MPa; A = ${cf(I.t, 3)} m²/m; I = ${(I.t ** 3 / 12).toExponential(3)} m⁴/m.`,
  );
  set('o_ct_fc2', cf(I.fc, 1));
  set('o_ct_fy2', I.fy.toFixed(0));
  set('o_ct_phf', cf(o.ph.f, 2));
  set('o_ct_phv', cf(o.ph.v, 2));
  set('o_ct_phr', cf(o.ph.r, 2));
  set('o_ct_Asi', cf(R.DS.ci.As, 3));
  set('o_ct_nbi', cf(1000 / I.ri.s, 1));
  set('o_ct_Aso', cf(R.DS.co.As, 3));
  set('o_ct_nbo', cf(1000 / I.ro.s, 1));

  const cmin = Math.min(I.ri.c, I.cages === 2 ? I.ro.c : 1e9);
  const creq = o.h >= 63 ? 26 : 20;
  set('o_ct_cmin', cf(cmin, 0));
  set('o_ct_cminn', cmin >= creq ? `≥ ${creq}: Đạt` : `< ${creq}: Không đạt`);
  cls('o_ct_cminn', 'note ' + (cmin >= creq ? 'ok' : 'bad'));
  set('o_ct_ttl2', `KIỂM TOÁN MẶT CẮT CỐNG TRÒN BTCT D = ${cf(I.D0, 2)} m, t = ${cf(I.t, 2)} m`);

  ctTables(R);
  try {
    const hooks = getVisualHooks();
    hooks.renderPipeCulvert?.({ result: R });
    hooks.renderMath?.();
  } catch (e) {
    console.error(e);
  }
  return R;
}

/** Map pipe culvert result to canonical `CulvertResult`. */
export function toPipeCulvertResult(R: CtResult): CulvertResult {
  const D = R.DS;
  const o = R.A.o;
  const I = R.I;
  const rowsOk = D.rows.every((r) => r.okF && r.okMaxR && r.okMaxC && r.Cr.ok);
  const minOk =
    D.ci.As >= D.Asmin_i - 1e-9 && (I.cages !== 2 || D.co.As >= (D.Asmin_o ?? 0) - 1e-9);
  const vOk = D.useB ? true : D.shear.every((x) => x.ok);
  const cOk =
    I.ri.c >= (o.h >= 63 ? 26 : 20) && (I.cages !== 2 || I.ro.c >= (o.h >= 63 ? 26 : 20));
  const indOk = R.IN.ok !== false;

  return {
    kind: 'circular',
    direct: {
      rows: D.rows as unknown as Array<Record<string, unknown>>,
      shear: D.shear as unknown as Array<Record<string, unknown>>,
      okAll: rowsOk && minOk && vOk && cOk,
    },
    indirect: {
      Si: R.IN.Si,
      BFE: R.IN.BFE,
      BFLL: R.IN.BFLL,
      D: R.IN.D,
      Dp: R.IN.Dp,
      ok: R.IN.ok,
    },
    okAll: rowsOk && minOk && vOk && cOk && indOk,
  };
}
