/**
 * BangTinhCauCong Web App — Reinforced Concrete Box Culvert (1–3 Cells) &
 * Foundation Bearing / Settlement Solver (`CH` & `CHN`).
 *
 * Exact clean-room TypeScript port of:
 *  - `CH` (`11_culverts_box_and_circular.js:6-2291`) — TCVN 11823-3, -5, -12:2017
 *  - `CHN` (`07_approach_slab_and_culvert_soil.js:1482-2217`) — TCVN 11823-10:2017 & TCVN 9362:2012
 *
 * Internal units: kN, m, kPa; materials MPa; rebar mm, mm².
 */

import { CH_REBAR_AREA, STORAGE_KEYS, type CulvertResult } from '../../types/project';
import { $, cf, getVisualHooks, num, okc, qf, set, sv, v } from '../context';
import {
  chFrameSolve,
  type FrameElementInput,
  type FrameLoadCase,
  type FrameNode,
  type FrameSpring,
} from '../math/rcmFrame';

// ---------------------------------------------------------------------------
// 1. Box Culvert Structural Constants & Types (`CH`)
// ---------------------------------------------------------------------------

export const CH_STEEL: Readonly<Record<string, readonly [number, number]>> = {
  'CB300-V': [300, 450],
  'CB400-V': [400, 570],
  'CB500-V': [500, 650],
  'CB240-T': [240, 380],
  'CB300-T': [300, 450],
};

export interface ChRebarFaceSpec {
  d: number;
  s: number;
}

export interface ChStirrupSpec {
  d: number;
  s: number;
  nl: number;
}

export interface ChSectionRebarInput {
  p?: ChRebarFaceSpec;
  n?: ChRebarFaceSpec;
  c: number;
  v?: ChStirrupSpec;
}

export interface ChInputOverrides {
  LLDF?: number;
  EH?: [number, number];
  WAv?: boolean;
  LLu?: number;
}

export interface ChInput {
  n: number;
  H: number;
  B: number;
  tt: number;
  tw: number;
  twi: number;
  tb: number;
  tv: number;
  hma: number;
  gma: number;
  hmo: number;
  gmo: number;
  hs: number;
  gs: number;
  phi: number;
  gw: number;
  wc: number;
  K1: number;
  gc: number;
  fc: number;
  st?: string;
  fy: number;
  fu?: number;
  Es: number;
  Fecap: number;
  nl: number;
  lane: number;
  ehmin: number;
  soil: string;
  k03: number;
  Lc: number;
  kUser: number;
  etaD: number;
  etaR?: number;
  etaI: number;
  eta?: number;
  g3: number;
  ge: number;
  ag: number;
  dl: ChRebarFaceSpec;
  water: number;
  m: number;
  noLL?: boolean;
  X?: ChInputOverrides;
  reb: Record<number | string, ChSectionRebarInput>;
}

export interface ChCellGeom {
  xL: number;
  xR: number;
}

export interface ChGeom {
  n: number;
  xs: number[];
  X: number;
  Yc: number;
  yB: number;
  yT: number;
  Bc: number;
  cells: ChCellGeom[];
  t: (k: number) => number;
}

export interface ChSectionDef {
  id: number;
  mem: string;
  x?: number;
  y?: number;
  w: string;
  k?: number;
  kind: 'top' | 'bot' | 'wo' | 'wi';
  h: number;
  el: number;
  end: 'i' | 'j';
}

export interface ChMesh {
  nodes: FrameNode[];
  els: Array<FrameElementInput & { mem: string }>;
  top: number[];
  bot: number[];
  walls: number[][];
  mem: Record<string, number[]>;
  xs: number[];
  ys: number[];
  S: ChSectionDef[];
}

export interface ChDerived {
  G: ChGeom;
  Hph: number;
  Hdm: number;
  Bc: number;
  Ec: number;
  n: number;
  fr: number;
  b1: number;
  k0: number;
  Fe0: number;
  Fe: number;
  EV: number;
  DWp: number;
  DW: number;
  sv: (z: number) => number;
  pt: number;
  pb: number;
  heq: number;
  LS: number;
  WA: number;
  DE: number;
  IM: number;
  strip: boolean;
  LLDF: number;
  Hint_t?: number;
  tInt?: boolean;
  Ww?: number;
  Pk: number;
  Lw0: number;
  Hint_p?: (sa: number) => number;
  width: number;
  E?: number;
  Espan?: number;
  mf: number;
  kLL: number;
  qlane: number;
  LLskip: boolean;
}

export interface ChVehicleDef {
  key: 'truck' | 'truckR' | 'tandem';
  name: string;
  ax: Array<[number, number]>;
}

export interface ChSpringSpec {
  B: number;
  L: number;
  ks: number;
  kr: number;
  k: number;
}

export interface ChStationRef {
  m: string;
  el: number;
  end: 'i' | 'j';
  s: number;
}

export type ForceTriplet = [number, number, number];
export type ChPatchTuple = [number, number, number];

export interface ChLlTag {
  x0: number;
  veh: string;
  P: ChPatchTuple[];
}

export type ForceWithTag = [number, number, number, ChLlTag | null];

export interface ChLlSecEnvelope {
  Mmax: ForceWithTag;
  Mmin: ForceWithTag;
  Vmax: ForceWithTag;
  Vmin: ForceWithTag;
  Nmax: ForceWithTag;
  Nmin: ForceWithTag;
}

export interface ChLlStEnvelope {
  max: ForceTriplet;
  min: ForceTriplet;
  Vmax: number;
  Vmin: number;
  Nmax: number;
  Nmin: number;
}

export interface ChAnalyseResult {
  o: ChDerived;
  G: ChGeom;
  Ms: ChMesh;
  SP: ChSpringSpec;
  springs: Array<FrameSpring & { trib: number; x: number }>;
  stations: ChStationRef[];
  S: ChSectionDef[];
  out: Record<string, { st: ForceTriplet[]; sec: ForceTriplet[] }>;
  LL: {
    st: ChLlStEnvelope[];
    sec: ChLlSecEnvelope[];
    pos: number;
  };
  reac: Record<string, number[]>;
  nodes: FrameNode[];
  els: Array<FrameElementInput & { mem: string }>;
  mem: Record<string, number[]>;
}

export interface ChComboDef {
  key: 'IA' | 'IB' | 'IC' | 'SD';
  name: string;
  note: string;
  g: Record<'DC' | 'DW' | 'EV' | 'EH' | 'LL' | 'LS' | 'WA', number>;
}

export interface ChSectionEnvelopeRow {
  Mmax: ForceTriplet;
  Mmin: ForceTriplet;
  Vmax: ForceTriplet;
  Vmin: ForceTriplet;
  Nmax: ForceTriplet;
  Nmin: ForceTriplet;
}

export interface ChEnvelopeResult {
  C: ChComboDef[];
  sec: Array<{ c: ChComboDef; r: ChSectionEnvelopeRow[] }>;
  st: Array<{ c: ChComboDef; r: ChSectionEnvelopeRow[] }>;
}

export interface ChFlexResult {
  Mn: number;
  a: number;
  c: number;
  et: number;
  phi: number;
}

export interface ChFaceDesignResult extends ChFlexResult {
  d: number;
  s: number;
  As: number;
  dd: number;
  Mu: number;
  Nu: number;
  Vu: number;
  cb: string | null;
  Mr: number;
  S: number;
  Mcr: number;
  Mmin: number;
  okM: boolean;
  okMin: boolean;
  Ms: number;
  Ns: number;
  rho: number;
  k: number;
  j: number;
  fss: number;
  fssc: number;
  dc: number;
  bs: number;
  smax: number;
  smax2: number;
  okCr: boolean;
}

export interface ChShearDesignResult {
  Vu: number;
  Mv: number;
  Nv: number;
  cb: string | null;
  As: number;
  de: number;
  dv: number;
  meth: '14.5.3' | '8.3.4.1' | '8.3.4.2a';
  beta: number | null;
  theta: number;
  Vc: number;
  Av: number;
  sv: number;
  Avmin: number;
  Vs: number;
  Vn2: number;
  Vn: number;
  Vr: number;
  ok: boolean;
  vu: number;
  smaxV: number;
  okS: boolean;
  needS: boolean;
  hasMin: boolean;
  es: number | null;
  sxe: number | null;
}

export interface ChDesignRow {
  s: ChSectionDef;
  R: ChSectionRebarInput;
  P: ChFaceDesignResult | null;
  N: ChFaceDesignResult | null;
  V: ChShearDesignResult;
}

export interface ChShrinkRow {
  nm: string;
  h: number;
  req: number;
  raw: number;
  As: number;
  smax: number;
  ok: boolean;
}

export interface ChResult {
  A: ChAnalyseResult;
  EN: ChEnvelopeResult;
  DS: ChDesignRow[];
  SH: ChShrinkRow[];
  I: ChInput;
}

// ---------------------------------------------------------------------------
// 2. Box Culvert Core Math (`CH`)
// ---------------------------------------------------------------------------

export function chBarA(d: number): number {
  return CH_REBAR_AREA[d] || (Math.PI * d * d) / 4;
}

export function chLerp(x: number, xs: readonly number[], ys: readonly number[]): number {
  if (x <= xs[0]) return ys[0];
  for (let i = 1; i < xs.length; i++) {
    if (x <= xs[i]) {
      return ys[i - 1] + ((ys[i] - ys[i - 1]) * (x - xs[i - 1])) / (xs[i] - xs[i - 1]);
    }
  }
  return ys[ys.length - 1];
}

export function chGeom(I: Pick<ChInput, 'n' | 'tw' | 'twi' | 'B' | 'tb' | 'H' | 'tt'>): ChGeom {
  const n = I.n;
  const tw = I.tw;
  const twi = n > 1 ? I.twi : I.tw;
  const t = (k: number) => (k === 0 || k === n ? tw : twi);
  const xs = [0];
  for (let k = 1; k <= n; k++) {
    xs.push(xs[k - 1] + t(k - 1) / 2 + I.B + t(k) / 2);
  }
  const X = xs[n];
  const Yc = I.tb / 2 + I.H + I.tt / 2;
  const yB = I.tb / 2;
  const yT = I.tb / 2 + I.H;
  const Bc = n * I.B + 2 * tw + (n - 1) * twi;
  const cells: ChCellGeom[] = [...Array(n)].map((_, j) => ({
    xL: xs[j] + t(j) / 2,
    xR: xs[j + 1] - t(j + 1) / 2,
  }));
  return { n, xs, X, Yc, yB, yT, Bc, cells, t };
}

export function chSections(
  I: Pick<ChInput, 'n' | 'tv' | 'tt' | 'tb' | 'tw' | 'twi'>,
  G: ChGeom,
): ChSectionDef[] {
  const tv = I.tv;
  const c = G.cells;
  const n = I.n;
  const mid = (j: number) => (c[j].xL + c[j].xR) / 2;
  const yM = (G.yB + G.yT) / 2;
  const S: ChSectionDef[] = [];

  const T = (id: number, x: number, w: string) =>
    S.push({ id, mem: 'top', x, w, kind: 'top', h: 0, el: 0, end: 'i' });
  const Bt = (id: number, x: number, w: string) =>
    S.push({ id, mem: 'bot', x, w, kind: 'bot', h: 0, el: 0, end: 'i' });
  const W = (id: number, k: number, y: number, w: string) =>
    S.push({ id, mem: 'w' + k, y, w, k, kind: 'wo', h: 0, el: 0, end: 'i' });

  if (n === 1) {
    T(1, mid(0), 'Bản nắp - giữa nhịp');
    T(2, c[0].xR - tv, 'Bản nắp - đầu vút, sát tường');
    Bt(3, c[0].xR - tv, 'Bản đáy - đầu vút, sát tường');
    Bt(4, mid(0), 'Bản đáy - giữa nhịp');
    W(5, 1, G.yT - tv, 'Tường biên - đầu vút trên');
    W(6, 1, yM, 'Tường biên - giữa chiều cao');
    W(7, 1, G.yB + tv, 'Tường biên - đầu vút dưới');
  } else if (n === 2) {
    T(1, c[1].xL + tv, 'Bản nắp - đầu vút, sát tường giữa');
    T(2, mid(1), 'Bản nắp - giữa nhịp');
    T(3, c[1].xR - tv, 'Bản nắp - đầu vút, sát tường biên');
    Bt(4, c[1].xR - tv, 'Bản đáy - đầu vút, sát tường biên');
    Bt(5, mid(1), 'Bản đáy - giữa nhịp');
    Bt(6, c[1].xL + tv, 'Bản đáy - đầu vút, sát tường giữa');
    W(7, 2, G.yT - tv, 'Tường biên - đầu vút trên');
    W(8, 2, yM, 'Tường biên - giữa chiều cao');
    W(9, 2, G.yB + tv, 'Tường biên - đầu vút dưới');
    W(10, 1, G.yT - tv, 'Tường giữa - đầu vút trên');
    W(11, 1, yM, 'Tường giữa - giữa chiều cao');
    W(12, 1, G.yB + tv, 'Tường giữa - đầu vút dưới');
  } else {
    T(1, c[0].xR - tv, 'Bản nắp ngăn biên - đầu vút, sát tường giữa');
    T(2, mid(0), 'Bản nắp ngăn biên - giữa nhịp');
    T(3, c[0].xL + tv, 'Bản nắp ngăn biên - đầu vút, sát tường biên');
    Bt(4, c[0].xL + tv, 'Bản đáy ngăn biên - đầu vút, sát tường biên');
    Bt(5, mid(0), 'Bản đáy ngăn biên - giữa nhịp');
    Bt(6, c[0].xR - tv, 'Bản đáy ngăn biên - đầu vút, sát tường giữa');
    W(7, 0, G.yT - tv, 'Tường biên - đầu vút trên');
    W(8, 0, yM, 'Tường biên - giữa chiều cao');
    W(9, 0, G.yB + tv, 'Tường biên - đầu vút dưới');
    W(10, 1, yM, 'Tường giữa - giữa chiều cao');
    T(11, c[1].xL + tv, 'Bản nắp ngăn giữa - đầu vút, sát tường giữa');
    T(12, mid(1), 'Bản nắp ngăn giữa - giữa nhịp');
    Bt(13, c[1].xL + tv, 'Bản đáy ngăn giữa - đầu vút, sát tường giữa');
    Bt(14, mid(1), 'Bản đáy ngăn giữa - giữa nhịp');
    W(15, 1, G.yT - tv, 'Tường giữa - đầu vút trên');
    W(16, 1, G.yB + tv, 'Tường giữa - đầu vút dưới');
  }

  for (const s of S) {
    s.kind =
      s.mem === 'top'
        ? 'top'
        : s.mem === 'bot'
          ? 'bot'
          : s.k === 0 || s.k === n
            ? 'wo'
            : 'wi';
    s.h =
      1000 *
      (s.kind === 'top' ? I.tt : s.kind === 'bot' ? I.tb : s.kind === 'wo' ? I.tw : I.twi);
  }
  return S;
}

export function chMesh(I: ChInput, G: ChGeom, E: number): ChMesh {
  const uniq = (a: number[]) =>
    [...new Set(a.map((val) => Math.round(val * 1e6) / 1e6))].sort((p, q) => p - q);
  const S = chSections(I, G);
  const nx = Math.max(12, Math.round(I.B / 0.1));
  const ny = Math.max(12, Math.round(I.H / 0.12));

  let xs = [...G.xs];
  for (const c of G.cells) {
    xs.push(c.xL, c.xR, c.xL + I.tv, c.xR - I.tv, (c.xL + c.xR) / 2);
    for (let i = 1; i < nx; i++) xs.push(c.xL + ((c.xR - c.xL) * i) / nx);
  }
  xs = uniq(xs.filter((x) => x >= 0 && x <= G.X));

  let ys = [0, G.Yc, G.yB, G.yT, G.yB + I.tv, G.yT - I.tv, (G.yB + G.yT) / 2];
  for (let i = 1; i < ny; i++) ys.push(G.yB + (I.H * i) / ny);
  ys = uniq(ys.filter((y) => y >= 0 && y <= G.Yc));

  const nodes: FrameNode[] = [];
  const top: number[] = [];
  const bot: number[] = [];
  const walls: number[][] = G.xs.map(() => []);

  for (const x of xs) {
    top.push(nodes.length);
    nodes.push({ x, y: G.Yc });
  }
  for (const x of xs) {
    bot.push(nodes.length);
    nodes.push({ x, y: 0 });
  }
  const idx = (arr: number[], x: number) => arr[xs.findIndex((val) => Math.abs(val - x) < 1e-6)];

  G.xs.forEach((x, k) => {
    walls[k].push(idx(bot, x));
    for (const y of ys.slice(1, -1)) {
      walls[k].push(nodes.length);
      nodes.push({ x, y });
    }
    walls[k].push(idx(top, x));
  });

  const els: Array<FrameElementInput & { mem: string }> = [];
  const mem: Record<string, number[]> = { top: [], bot: [] };
  const Ec = E * 1000;
  const add = (i: number, j: number, t: number, m: string) => {
    els.push({ i, j, EA: Ec * t, EI: (Ec * t ** 3) / 12, mem: m });
    return els.length - 1;
  };

  for (let i = 0; i < top.length - 1; i++) mem.top.push(add(top[i], top[i + 1], I.tt, 'top'));
  for (let i = 0; i < bot.length - 1; i++) mem.bot.push(add(bot[i], bot[i + 1], I.tb, 'bot'));
  walls.forEach((w, k) => {
    mem['w' + k] = [];
    for (let i = 0; i < w.length - 1; i++) {
      mem['w' + k].push(add(w[i], w[i + 1], G.t(k), 'w' + k));
    }
  });

  return { nodes, els, top, bot, walls, mem, xs, ys, S };
}

export function chDerive(I: ChInput): ChDerived {
  const G = chGeom(I);
  const Hph = I.hma + I.hmo + I.hs;
  const Hdm = Hph + I.tt + I.H + I.tb;
  const Bc = G.Bc;
  const Ec = 0.0017 * I.K1 * I.wc ** 2 * I.fc ** 0.33;
  const n = I.Es / Ec;
  const fr = 0.63 * Math.sqrt(I.fc);
  const b1 = I.fc <= 28 ? 0.85 : Math.max(0.65, 0.85 - (0.05 * (I.fc - 28)) / 7);
  const k0 = 1 - Math.sin((I.phi * Math.PI) / 180);
  const Fe0 = 1 + (0.2 * Hph) / Bc;
  const Fe = Math.min(Fe0, I.Fecap);
  const EV = Fe * I.gs * I.hs;
  const DWp = I.gma * I.hma + I.gmo * I.hmo;
  const DW = Fe * DWp;
  const svFn = (z: number) =>
    z <= I.hma
      ? I.gma * z
      : z <= I.hma + I.hmo
        ? I.gma * I.hma + I.gmo * (z - I.hma)
        : DWp + I.gs * (z - I.hma - I.hmo);
  const pt = k0 * svFn(Hph);
  const pb = k0 * svFn(Hdm);
  const heq = chLerp(Hdm * 1000, [1500, 3000, 6000], [1200, 900, 600]) / 1000;
  const LS = k0 * I.gs * heq;
  const WA = I.gw * I.H;

  const DE = Hph * 1000;
  const IM = Math.max(0, 33 * (1 - 4.1e-4 * DE));
  const strip = Hph * 1000 < 600;
  const LLDF = (I.X && I.X.LLDF) || 1.15;
  const H = Hph * 1000;
  const Di = I.B * 1000;
  const Sw = 1800;
  const wt = 510;
  const lt = 250;

  let Hint_t: number | undefined;
  let tInt: boolean | undefined;
  let Ww: number | undefined;
  let Pk: number;
  let Lw0: number;
  let Hint_p: ((sa: number) => number) | undefined;
  let width: number;
  let E: number | undefined;
  let Espan: number | undefined;

  if (!strip) {
    Hint_t = (Sw - wt - 0.06 * Di) / LLDF;
    tInt = H >= Hint_t;
    Ww = tInt ? wt + Sw + LLDF * H + 0.06 * Di : wt + LLDF * H + 0.06 * Di;
    Pk = tInt ? 1 : 0.5;
    Lw0 = lt + LLDF * H;
    Hint_p = (sa: number) => (sa - lt) / LLDF;
    width = Ww;
  } else {
    E = 2440 + 0.12 * Di;
    Espan = lt + LLDF * H;
    Lw0 = Espan;
    Pk = 1;
    width = E;
  }

  const mf = I.m;
  const kLL = mf * (1 + IM / 100);
  const qlane = I.lane ? (mf * 9.3) / 3.0 : 0;
  const LLskip = I.n === 1 ? H > 2400 && H > Di : H > (G.cells[I.n - 1].xR - G.cells[0].xL) * 1000;

  return {
    G,
    Hph,
    Hdm,
    Bc,
    Ec,
    n,
    fr,
    b1,
    k0,
    Fe0,
    Fe,
    EV,
    DWp,
    DW,
    sv: svFn,
    pt,
    pb,
    heq,
    LS,
    WA,
    DE,
    IM,
    strip,
    LLDF,
    Hint_t,
    tInt,
    Ww,
    Pk,
    Lw0,
    Hint_p,
    width,
    E,
    Espan,
    mf,
    kLL,
    qlane,
    LLskip,
  };
}

export const CH_VEH: ChVehicleDef[] = [
  {
    key: 'truck',
    name: 'Xe tải thiết kế',
    ax: [
      [0, 35],
      [4.3, 145],
      [8.6, 145],
    ],
  },
  {
    key: 'truckR',
    name: 'Xe tải thiết kế (chiều ngược lại)',
    ax: [
      [0, 145],
      [4.3, 145],
      [8.6, 35],
    ],
  },
  {
    key: 'tandem',
    name: 'Xe hai trục thiết kế',
    ax: [
      [0, 110],
      [1.2, 110],
    ],
  },
];

export function chPatches(o: ChDerived, veh: ChVehicleDef, x0: number): ChPatchTuple[] {
  const half = o.Lw0 / 1000 / 2;
  const P = veh.ax.map(([d, p]) => ({ a: x0 + d - half, b: x0 + d + half, P: p }));
  if (o.strip) {
    return P.map((p) => [p.a, p.b, (o.kLL * p.P) / ((o.width / 1000) * (p.b - p.a))]);
  }
  P.sort((p, q) => p.a - q.a);
  const M: Array<{ a: number; b: number; P: number }> = [];
  for (const p of P) {
    const L = M[M.length - 1];
    if (L && p.a < L.b - 1e-9) {
      L.b = Math.max(L.b, p.b);
      L.P += p.P;
    } else {
      M.push({ ...p });
    }
  }
  return M.map((p) => [p.a, p.b, (o.kLL * o.Pk * p.P) / (((o.Ww || o.width) / 1000) * (p.b - p.a))]);
}

export function chSpring(I: Pick<ChInput, 'Lc' | 'soil' | 'k03' | 'kUser'>, o: Pick<ChDerived, 'Bc'>): ChSpringSpec {
  const B = o.Bc;
  const L = Math.max(I.Lc, B);
  const ks =
    I.soil === 'Sét'
      ? I.k03 * 1000 * (0.3 / B)
      : I.k03 * 1000 * ((B + 0.3) / (2 * B)) ** 2;
  const kr = (ks * (1 + (0.5 * B) / L)) / 1.5;
  return { B, L, ks, kr, k: I.kUser > 0 ? I.kUser : kr };
}

export function chAnalyse(I: ChInput): ChAnalyseResult {
  const o = chDerive(I);
  const G = o.G;
  const Ms = chMesh(I, G, o.Ec);
  const SP = chSpring(I, o);
  const { nodes, els, top, bot, walls, mem, xs } = Ms;

  const springs: Array<FrameSpring & { trib: number; x: number }> = bot.map((n, i) => {
    const xl = i ? (xs[i] + xs[i - 1]) / 2 : -G.t(0) / 2;
    const xr = i < xs.length - 1 ? (xs[i] + xs[i + 1]) / 2 : G.X + G.t(I.n) / 2;
    return { n, dof: 1 as const, k: SP.k * (xr - xl), trib: xr - xl, x: xs[i] };
  });

  const fix = [{ n: bot[Math.floor(bot.length / 2)], dof: 0 as const }];
  const F = chFrameSolve(nodes, els, springs, fix);
  const elTop = mem.top;
  const elBot = mem.bot;

  const vert = (
    LC: Required<FrameLoadCase>,
    list: number[],
    ids: number[],
    x1: number,
    x2: number,
    q: number,
    over: boolean,
  ) => {
    for (const k of ids) {
      const e = els[k];
      const xa = nodes[e.i].x;
      const xb = nodes[e.j].x;
      const a = Math.max(x1, xa);
      const b = Math.min(x2, xb);
      if (b > a) LC.el.push({ e: k, t: 't', a: a - xa, b: b - xa, q1: -q, q2: -q });
    }
    if (over) {
      const nL = list[0];
      const nR = list[list.length - 1];
      const l1 = Math.max(0, Math.min(0, x2) - x1);
      const l2 = Math.max(0, x2 - Math.max(G.X, x1));
      if (l1 > 0) {
        const c = Math.min(0, x2) - l1 / 2;
        LC.nod.push({ n: nL, fy: -q * l1, m: q * l1 * -c });
      }
      if (l2 > 0) {
        const c = Math.max(G.X, x1) + l2 / 2;
        LC.nod.push({ n: nR, fy: -q * l2, m: -q * l2 * (c - G.X) });
      }
    }
  };

  const horiz = (
    LC: Required<FrameLoadCase>,
    k: number,
    y1: number,
    y2: number,
    p1: number,
    p2: number,
    dir: number,
  ) => {
    const ids = mem['w' + k];
    const pf = (y: number) => p1 + ((p2 - p1) * (y - y1)) / (y2 - y1);
    for (const id of ids) {
      const e = els[id];
      const ya = nodes[e.i].y;
      const yb = nodes[e.j].y;
      const a = Math.max(y1, ya);
      const b = Math.min(y2, yb);
      if (b > a) {
        LC.el.push({ e: id, t: 't', a: a - ya, b: b - ya, q1: -dir * pf(a), q2: -dir * pf(b) });
      }
    }
    const w = walls[k];
    if (y1 < 0) {
      const b = Math.min(0, y2);
      LC.nod.push({ n: w[0], fx: ((dir * (pf(y1) + pf(b))) / 2) * (b - y1) });
    }
    if (y2 > G.Yc) {
      const a = Math.max(G.Yc, y1);
      LC.nod.push({ n: w[w.length - 1], fx: ((dir * (pf(a) + pf(y2))) / 2) * (y2 - a) });
    }
  };

  const LCs: Record<string, Required<FrameLoadCase>> = {};
  {
    const LC: Required<FrameLoadCase> = { el: [], nod: [] };
    const gc = I.gc;
    vert(LC, top, elTop, -G.t(0) / 2, G.X + G.t(I.n) / 2, gc * I.tt, true);
    vert(LC, bot, elBot, -G.t(0) / 2, G.X + G.t(I.n) / 2, gc * I.tb, true);
    G.xs.forEach((_x, k) => {
      const w = (gc * G.t(k) * I.H) / G.Yc;
      for (const id of mem['w' + k]) {
        LC.el.push({ e: id, t: 'a', a: 0, b: F.els[id].L, q1: -w, q2: -w });
      }
    });
    const hv = (gc * I.tv) / 2;
    for (const c of G.cells) {
      for (const [a, b] of [
        [c.xL, c.xL + I.tv],
        [c.xR - I.tv, c.xR],
      ]) {
        vert(LC, top, elTop, a, b, hv, false);
        vert(LC, bot, elBot, a, b, hv, false);
      }
    }
    LCs.DC = LC;
  }
  {
    const LC: Required<FrameLoadCase> = { el: [], nod: [] };
    vert(LC, top, elTop, -G.t(0) / 2, G.X + G.t(I.n) / 2, o.DW, true);
    LCs.DW = LC;
  }
  {
    const LC: Required<FrameLoadCase> = { el: [], nod: [] };
    vert(LC, top, elTop, -G.t(0) / 2, G.X + G.t(I.n) / 2, o.EV, true);
    LCs.EV = LC;
  }
  {
    const LC: Required<FrameLoadCase> = { el: [], nod: [] };
    const z = (y: number) => o.Hdm - I.tb / 2 - y;
    const y1 = -I.tb / 2;
    const y2 = G.Yc + I.tt / 2;
    const pa = I.X && I.X.EH ? I.X.EH[1] : o.k0 * o.sv(z(y1));
    const pb2 = I.X && I.X.EH ? I.X.EH[0] : o.k0 * o.sv(z(y2));
    horiz(LC, 0, y1, y2, pa, pb2, +1);
    horiz(LC, I.n, y1, y2, pa, pb2, -1);
    LCs.EH = LC;
  }
  {
    const LC: Required<FrameLoadCase> = { el: [], nod: [] };
    const y1 = -I.tb / 2;
    const y2 = G.Yc + I.tt / 2;
    horiz(LC, 0, y1, y2, o.LS, o.LS, +1);
    horiz(LC, I.n, y1, y2, o.LS, o.LS, -1);
    LCs.LS = LC;
  }
  {
    const LC: Required<FrameLoadCase> = { el: [], nod: [] };
    for (const c of G.cells) vert(LC, bot, elBot, c.xL, c.xR, o.WA, false);
    if (!(I.X && I.X.WAv)) {
      horiz(LC, 0, G.yB, G.yT, I.gw * I.H, 0, -1);
      horiz(LC, I.n, G.yB, G.yT, I.gw * I.H, 0, +1);
    }
    LCs.WA = LC;
  }
  if (o.qlane > 0) {
    const LC: Required<FrameLoadCase> = { el: [], nod: [] };
    vert(LC, top, elTop, -G.t(0) / 2, G.X + G.t(I.n) / 2, o.qlane, true);
    LCs.LN = LC;
  }

  const stations: ChStationRef[] = [];
  const addSt = (m: string, ids: number[], coord: (p: FrameNode) => number) => {
    ids.forEach((id, i) => {
      const e = els[id];
      stations.push({ m, el: id, end: 'i', s: coord(nodes[e.i]) });
      if (i === ids.length - 1) stations.push({ m, el: id, end: 'j', s: coord(nodes[e.j]) });
    });
  };
  addSt('top', elTop, (p) => p.x);
  addSt('bot', elBot, (p) => p.x);
  G.xs.forEach((_x, k) => addSt('w' + k, mem['w' + k], (p) => p.y));

  const S = Ms.S;
  for (const sc of S) {
    const ids = mem[sc.mem];
    const key: 'x' | 'y' = sc.mem === 'top' || sc.mem === 'bot' ? 'x' : 'y';
    const val = sc[key]!;
    let best: { el: number; end: 'i' | 'j' } | null = null;
    for (const id of ids) {
      const e = els[id];
      const a = nodes[e.i][key];
      const b = nodes[e.j][key];
      if (Math.abs(a - val) < 1e-6) best = best || { el: id, end: 'i' };
      if (Math.abs(b - val) < 1e-6 && !best) best = { el: id, end: 'j' };
    }
    const cellMid =
      key === 'x'
        ? (() => {
            const c = G.cells.find((cl) => val >= cl.xL - 1e-9 && val <= cl.xR + 1e-9);
            return c ? (c.xL + c.xR) / 2 : val;
          })()
        : (G.yB + G.yT) / 2;
    if (val > cellMid + 1e-6) {
      for (const id of ids) {
        const e = els[id];
        if (Math.abs(nodes[e.j][key] - val) < 1e-6) best = { el: id, end: 'j' };
      }
    }
    sc.el = best!.el;
    sc.end = best!.end;
  }

  const pick = (R: ReturnType<typeof F.run>['R'], st: { el: number; end: 'i' | 'j' }): ForceTriplet => {
    const r = R[st.el];
    return st.end === 'i' ? [r.Mi, r.Vi, r.Ni] : [r.Mj, r.Vj, r.Nj];
  };
  const sgnM = (m: string) =>
    m === 'top' ? 1 : m === 'bot' ? -1 : m === 'w0' ? 1 : m === 'w' + I.n ? -1 : 1;

  const res = (R: ReturnType<typeof F.run>['R']) => ({
    st: stations.map((st): ForceTriplet => {
      const [M, V, N] = pick(R, st);
      return [sgnM(st.m) * M, V, N];
    }),
    sec: S.map((sc): ForceTriplet => {
      const [M, V, N] = pick(R, sc);
      return [sgnM(sc.mem) * M, V, N];
    }),
  });

  const out: Record<string, { st: ForceTriplet[]; sec: ForceTriplet[] }> = {};
  const reac: Record<string, number[]> = {};
  for (const k in LCs) {
    const r = F.run(LCs[k]);
    out[k] = res(r.R);
    reac[k] = springs.map((sp) => (sp.k * -r.u[3 * sp.n + 1]) / sp.trib);
  }

  const LL: {
    st: ChLlStEnvelope[];
    sec: Array<{
      Mmax: ForceWithTag | null;
      Mmin: ForceWithTag | null;
      Vmax: ForceWithTag | null;
      Vmin: ForceWithTag | null;
      Nmax: ForceWithTag | null;
      Nmin: ForceWithTag | null;
    }>;
    pos: number;
  } = {
    st: stations.map(() => ({
      max: [-1e9, 0, 0],
      min: [1e9, 0, 0],
      Vmax: -1e9,
      Vmin: 1e9,
      Nmax: -1e9,
      Nmin: 1e9,
    })),
    sec: S.map(() => ({
      Mmax: null,
      Mmin: null,
      Vmax: null,
      Vmin: null,
      Nmax: null,
      Nmin: null,
    })),
    pos: 0,
  };

  if (I.X && I.X.LLu != null) {
    const LC: Required<FrameLoadCase> = { el: [], nod: [] };
    vert(LC, top, elTop, -G.t(0) / 2, G.X + G.t(I.n) / 2, I.X.LLu, true);
    const rr = res(F.run(LC).R);
    rr.st.forEach((t, i) => {
      const e = LL.st[i];
      e.max = t;
      e.min = t;
      e.Vmax = t[1];
      e.Vmin = t[1];
      e.Nmax = t[2];
      e.Nmin = t[2];
    });
    rr.sec.forEach((t, i) => {
      LL.sec[i] = {
        Mmax: [...t, null],
        Mmin: [...t, null],
        Vmax: [...t, null],
        Vmin: [...t, null],
        Nmax: [...t, null],
        Nmin: [...t, null],
      };
    });
  } else if (!I.noLL) {
    const xmin = -G.t(0) / 2;
    const xmax = G.X + G.t(I.n) / 2;
    const half = o.Lw0 / 1000 / 2;
    const dx = 0.1;
    for (const veh of CH_VEH) {
      const len = veh.ax[veh.ax.length - 1][0];
      for (let x0 = xmin - len - half + dx / 2; x0 <= xmax + half; x0 += dx) {
        const P = chPatches(o, veh, x0).filter(([a, b]) => b > xmin && a < xmax);
        if (!P.length) continue;
        const LC: Required<FrameLoadCase> = { el: [], nod: [] };
        for (const [a, b, q] of P) {
          vert(LC, top, elTop, Math.max(a, xmin), Math.min(b, xmax), q, true);
        }
        const r = F.run(LC);
        const rr = res(r.R);
        LL.pos++;
        rr.st.forEach((t, i) => {
          const e = LL.st[i];
          if (t[0] > e.max[0]) e.max = t;
          if (t[0] < e.min[0]) e.min = t;
          e.Vmax = Math.max(e.Vmax, t[1]);
          e.Vmin = Math.min(e.Vmin, t[1]);
          e.Nmax = Math.max(e.Nmax, t[2]);
          e.Nmin = Math.min(e.Nmin, t[2]);
        });
        rr.sec.forEach((t, i) => {
          const e = LL.sec[i];
          const tag: ChLlTag = { x0, veh: veh.key, P };
          if (!e.Mmax || t[0] > e.Mmax[0]) e.Mmax = [...t, tag];
          if (!e.Mmin || t[0] < e.Mmin[0]) e.Mmin = [...t, tag];
          if (!e.Vmax || t[1] > e.Vmax[1]) e.Vmax = [...t, tag];
          if (!e.Vmin || t[1] < e.Vmin[1]) e.Vmin = [...t, tag];
          if (!e.Nmax || t[2] > e.Nmax[2]) e.Nmax = [...t, tag];
          if (!e.Nmin || t[2] < e.Nmin[2]) e.Nmin = [...t, tag];
        });
      }
    }
  }

  if (out.LN) {
    LL.st.forEach((e, i) => {
      const t = out.LN.st[i];
      e.max = e.max.map((val, j) => val + t[j]) as ForceTriplet;
      e.min = e.min.map((val, j) => val + t[j]) as ForceTriplet;
      e.Vmax += t[1];
      e.Vmin += t[1];
      e.Nmax += t[2];
      e.Nmin += t[2];
    });
    LL.sec.forEach((e, i) => {
      const t = out.LN.sec[i];
      (['Mmax', 'Mmin', 'Vmax', 'Vmin', 'Nmax', 'Nmin'] as const).forEach((k) => {
        const cur = e[k];
        if (cur) {
          cur[0] += t[0];
          cur[1] += t[1];
          cur[2] += t[2];
        } else {
          e[k] = [...t, null];
        }
      });
    });
  }

  for (const e of LL.sec) {
    (['Mmax', 'Mmin', 'Vmax', 'Vmin', 'Nmax', 'Nmin'] as const).forEach((k) => {
      if (!e[k]) e[k] = [0, 0, 0, null];
    });
  }
  for (const e of LL.st) {
    if (e.max[0] < -1e8) {
      e.max = [0, 0, 0];
      e.min = [0, 0, 0];
      e.Vmax = 0;
      e.Vmin = 0;
      e.Nmax = 0;
      e.Nmin = 0;
    }
  }

  return {
    o,
    G,
    Ms,
    SP,
    springs,
    stations,
    S,
    out,
    LL: { st: LL.st, sec: LL.sec as ChLlSecEnvelope[], pos: LL.pos },
    reac,
    nodes,
    els,
    mem,
  };
}

export function chCombos(I: Pick<ChInput, 'ehmin'>): ChComboDef[] {
  return [
    {
      key: 'IA',
      name: 'Cường độ I-A',
      note: 'tải đứng lớn nhất, tải ngang lớn nhất',
      g: { DC: 1.25, DW: 1.5, EV: 1.3, EH: 1.35, LL: 1.75, LS: 1.75, WA: 1.0 },
    },
    {
      key: 'IB',
      name: 'Cường độ I-B',
      note: 'tải đứng lớn nhất, tải ngang nhỏ nhất',
      g: { DC: 1.25, DW: 1.5, EV: 1.3, EH: I.ehmin, LL: 1.75, LS: 1.75, WA: 1.0 },
    },
    {
      key: 'IC',
      name: 'Cường độ I-C',
      note: 'tĩnh tải DC, DW nhỏ nhất, tải ngang lớn nhất; EV luôn lấy hệ số lớn nhất (Điều 6.1 Phần 12)',
      g: { DC: 0.9, DW: 0.65, EV: 1.3, EH: 1.35, LL: 1.75, LS: 1.75, WA: 1.0 },
    },
    {
      key: 'SD',
      name: 'Sử dụng I',
      note: '',
      g: { DC: 1, DW: 1, EV: 1, EH: 1, LL: 1, LS: 1, WA: 1 },
    },
  ];
}

export function chEtaOf(
  I: Pick<ChInput, 'etaD' | 'etaI'>,
  c: Pick<ChComboDef, 'key'>,
  k: string,
): number {
  if (c.key === 'SD') return 1;
  return Math.max(
    0.95,
    (I.etaD || 1) * (I.etaI || 1) * (k === 'EV' || k === 'EH' || k === 'DW' ? 1.05 : 1.0),
  );
}

export function chEnvelope(A: ChAnalyseResult, I: ChInput): ChEnvelopeResult {
  const C = chCombos(I);
  const P = ['DC', 'DW', 'EV', 'EH'] as const;
  const T = (I.water === 0 ? ['LS'] : ['LS', 'WA']) as Array<'LS' | 'WA'>;
  const E = (c: ChComboDef, k: string) => chEtaOf(I, c, k);
  const G = (c: ChComboDef, k: keyof ChComboDef['g']) => c.g[k] * E(c, k);

  const one = (
    c: ChComboDef,
    getP: (k: 'DC' | 'DW' | 'EV' | 'EH' | 'LS' | 'WA', i: number) => ForceTriplet,
    getLL: (i: number) => ChLlSecEnvelope,
    i: number,
  ): ChSectionEnvelopeRow => {
    const base: ForceTriplet = [0, 0, 0];
    for (const k of P) {
      const t = getP(k, i);
      for (let j = 0; j < 3; j++) base[j] += G(c, k) * t[j];
    }
    const pickT = (j: 0 | 1 | 2, sign: 1 | -1): ForceTriplet => {
      const r: ForceTriplet = [...base];
      for (const k of T) {
        const t = getP(k, i);
        if (sign * G(c, k) * t[j] > 0) {
          for (let q = 0; q < 3; q++) r[q] += G(c, k) * t[q];
        }
      }
      return r;
    };
    const add = (r: ForceTriplet, t: ForceWithTag | null, j: 0 | 1 | 2, sign: 1 | -1): ForceTriplet => {
      if (t && sign * G(c, 'LL') * t[j] > 0) {
        r[0] += G(c, 'LL') * t[0];
        r[1] += G(c, 'LL') * t[1];
        r[2] += G(c, 'LL') * t[2];
      }
      return r;
    };
    const L = getLL(i);
    return {
      Mmax: add(pickT(0, 1), L.Mmax, 0, 1),
      Mmin: add(pickT(0, -1), L.Mmin, 0, -1),
      Vmax: add(pickT(1, 1), L.Vmax, 1, 1),
      Vmin: add(pickT(1, -1), L.Vmin, 1, -1),
      Nmax: add(pickT(2, 1), L.Nmax, 2, 1),
      Nmin: add(pickT(2, -1), L.Nmin, 2, -1),
    };
  };

  const sec = C.map((c) => ({
    c,
    r: A.S.map((_s, i) =>
      one(
        c,
        (k, idx) => A.out[k].sec[idx],
        (idx) => A.LL.sec[idx],
        i,
      ),
    ),
  }));

  const st = C.map((c) => ({
    c,
    r: A.stations.map((_s, i) => {
      const L = A.LL.st[i];
      return one(
        c,
        (k, idx) => A.out[k].st[idx],
        () => ({
          Mmax: [...L.max, null],
          Mmin: [...L.min, null],
          Vmax: [0, L.Vmax, 0, null],
          Vmin: [0, L.Vmin, 0, null],
          Nmax: [0, 0, L.Nmax, null],
          Nmin: [0, 0, L.Nmin, null],
        }),
        i,
      );
    }),
  }));

  return { C, sec, st };
}

export function chFlex(
  As: number,
  d: number,
  h: number,
  fc: number,
  fy: number,
  b1: number,
  Nt: number,
): ChFlexResult {
  const T = As * fy - Nt;
  if (T <= 0) return { Mn: 0, a: 0, c: 0, et: 0, phi: 0.9 };
  const a = T / (0.85 * fc * 1000);
  const c = a / b1;
  const et = (0.003 * (d - c)) / c;
  const ecl = fy / 200000;
  const phi =
    et >= 0.005 ? 0.9 : et <= ecl ? 0.75 : 0.75 + (0.15 * (et - ecl)) / (0.005 - ecl);
  return { Mn: T * (d - a / 2) + Nt * (d - h / 2), a, c, et, phi };
}

export function chDesign(A: ChAnalyseResult, I: ChInput, EN: ChEnvelopeResult): ChDesignRow[] {
  const o = A.o;
  const fc = I.fc;
  const fy = I.fy;
  const b = 1000;
  const SDi = EN.sec.find((x) => x.c.key === 'SD')!;
  const ST = EN.sec.filter((x) => x.c.key !== 'SD');

  return A.S.map((s, i) => {
    const R: ChSectionRebarInput = I.reb[s.id] || { c: 50 };
    const h = s.h;

    const face = (sign: 1 | -1): ChFaceDesignResult | null => {
      const f = sign > 0 ? R.p : R.n;
      if (!f || !f.d || !f.s) return null;
      const As = (chBarA(f.d) * 1000) / f.s;
      const d = h - R.c - f.d / 2;
      let Mu = 0;
      let Nu = 0;
      let Vu = 0;
      let cb: string | null = null;
      for (const x of ST) {
        const r = x.r[i];
        const t = sign > 0 ? r.Mmax : r.Mmin;
        if (sign * t[0] > Mu) {
          Mu = sign * t[0];
          Nu = t[2];
          Vu = t[1];
          cb = x.c.name;
        }
      }
      const Nt = Math.max(0, Nu) * 1000;
      const F = chFlex(As, d, h, fc, fy, o.b1, Nt);
      const Mr = (F.phi * F.Mn) / 1e6;
      const S = (b * h * h) / 6;
      const Mcr = (I.g3 * 1.6 * o.fr * S) / 1e6;
      const Mmin = Math.min(1.33 * Mu, Mcr);

      const rs = SDi.r[i];
      const msRow = sign > 0 ? rs.Mmax : rs.Mmin;
      const Ms = Math.max(0, sign * msRow[0]);
      const Ns = msRow[2];
      const rho = As / (b * d);
      const nn = o.n;
      const k = Math.sqrt((rho * nn) ** 2 + 2 * rho * nn) - rho * nn;
      const j = 1 - k / 3;
      const fss = (Ms * 1e6) / (As * j * d) + (Math.max(0, Ns) * 1000) / As;
      const fssc = Math.min(fss, 0.6 * fy);
      const dc = R.c + f.d / 2;
      const bs = 1 + dc / (0.7 * (h - dc));
      const smax = fssc > 0 ? (123000 * I.ge) / (bs * fssc) - 2 * dc : Infinity;
      const smax2 = Math.min(1.5 * h, 450);

      return {
        d: f.d,
        s: f.s,
        As,
        dd: d,
        Mu,
        Nu,
        Vu,
        cb,
        ...F,
        Mr,
        S,
        Mcr,
        Mmin,
        okM: Mr >= Mu - 1e-9,
        okMin: Mr >= Mmin - 1e-9,
        Ms,
        Ns,
        rho,
        k,
        j,
        fss,
        fssc,
        dc,
        bs,
        smax,
        smax2,
        okCr: f.s <= smax + 1e-9 && f.s <= smax2,
      };
    };

    const P = face(1);
    const N = face(-1);

    let Vu = 0;
    let Mv = 0;
    let Nv = 0;
    let cbv: string | null = null;
    for (const x of ST) {
      for (const t of [x.r[i].Vmax, x.r[i].Vmin]) {
        if (Math.abs(t[1]) > Vu) {
          Vu = Math.abs(t[1]);
          Mv = t[0];
          Nv = t[2];
          cbv = x.c.name;
        }
      }
    }

    const fT = Mv >= 0 ? R.p : R.n;
    const As = fT && fT.d ? (chBarA(fT.d) * 1000) / fT.s : 0;
    const de = h - R.c - (fT && fT.d ? fT.d / 2 : 8);
    const Ftt = chFlex(As, de, h, fc, fy, o.b1, 0);
    const dv = Math.max(de - Ftt.a / 2, 0.9 * de, 0.72 * h);
    const slab = s.kind === 'top' || s.kind === 'bot';
    const fill = o.Hph * 1000 >= 600;
    const Av = R.v && R.v.d && R.v.s ? chBarA(R.v.d) * (R.v.nl || 0) : 0;
    const svSt = Av > 0 && R.v?.s ? R.v.s : 0;
    const Avmin = svSt ? (0.083 * Math.sqrt(fc) * b * svSt) / fy : 0;
    const vu = (Vu * 1000) / (0.9 * b * dv);
    const smaxV = vu < 0.125 * fc ? Math.min(0.8 * dv, 600) : Math.min(0.4 * dv, 300);
    const hasMin = Av > 0 && Av >= Avmin - 1e-9 && svSt <= smaxV + 1e-9;

    let meth: '14.5.3' | '8.3.4.1' | '8.3.4.2a';
    let beta: number | null;
    let theta: number;
    let Vc: number;
    let es: number | null = null;
    let sxe: number | null = null;

    if (slab && fill) {
      meth = '14.5.3';
      const r = Math.min(1, (Vu * de) / Math.max(Math.abs(Mv) * 1000, 1e-9));
      Vc = ((0.178 * Math.sqrt(fc) + ((32 * As) / (b * de)) * r) * b * de) / 1000;
      const cap = (0.332 * Math.sqrt(fc) * b * de) / 1000;
      const lo = I.n === 1 ? (0.25 * Math.sqrt(fc) * b * de) / 1000 : 0;
      Vc = Math.max(Math.min(Vc, cap), lo);
      theta = 45;
      beta = null;
      es = r;
    } else if (Nv <= 0 && (h < 400 || hasMin)) {
      meth = '8.3.4.1';
      beta = 2;
      theta = 45;
      Vc = (0.083 * beta * Math.sqrt(fc) * b * dv) / 1000;
    } else {
      meth = '8.3.4.2a';
      const Mu = Math.max(Math.abs(Mv) * 1e6, Vu * 1000 * dv);
      es = (Mu / dv + 0.5 * Nv * 1000 + Vu * 1000) / (I.Es * Math.max(As, 1));
      if (es < 0) es = 0;
      es = Math.min(es, 0.006);
      if (hasMin) {
        beta = 4.8 / (1 + 750 * es);
      } else {
        sxe = Math.min(2000, Math.max(300, (dv * 35) / (I.ag + 16)));
        beta = ((4.8 / (1 + 750 * es)) * 1300) / (1000 + sxe);
      }
      theta = 29 + 3500 * es;
      Vc = (0.083 * beta * Math.sqrt(fc) * b * dv) / 1000;
    }

    const Vs = hasMin ? (Av * fy * dv) / Math.tan((theta * Math.PI) / 180) / svSt / 1000 : 0;
    const Vn2 = (0.25 * fc * b * dv) / 1000;
    const Vn = Math.min(Vc + Vs, Vn2);
    const Vr = 0.9 * Vn;
    const needS = Vu > 0.9 * Math.min(Vc, Vn2) + 1e-9;

    return {
      s,
      R,
      P,
      N,
      V: {
        Vu,
        Mv,
        Nv,
        cb: cbv,
        As,
        de,
        dv,
        meth,
        beta,
        theta,
        Vc,
        Av,
        sv: svSt,
        Avmin,
        Vs,
        Vn2,
        Vn,
        Vr,
        ok: Vr >= Vu - 1e-9,
        vu,
        smaxV,
        okS: hasMin,
        needS,
        hasMin,
        es,
        sxe,
      },
    };
  });
}

export function chShrink(I: Pick<ChInput, 'Lc' | 'tt' | 'tb' | 'tw' | 'twi' | 'n' | 'fy' | 'dl'>): ChShrinkRow[] {
  const out: ChShrinkRow[] = [];
  const L = Math.max(I.Lc, 1) * 1000;
  const rows: Array<[string, number]> = [
    ['Bản nắp', I.tt],
    ['Bản đáy', I.tb],
    ['Tường biên', I.tw],
  ];
  if (I.n > 1) rows.push(['Tường giữa', I.twi]);

  for (const [nm, t] of rows) {
    const h = t * 1000;
    const raw = (0.75 * L * h) / (2 * (L + h) * I.fy);
    const req = Math.max(0.233, Math.min(1.27, raw));
    const As = I.dl.d && I.dl.s ? chBarA(I.dl.d) / I.dl.s : 0;
    const smax = Math.min(3 * h, 450);
    out.push({
      nm,
      h,
      req,
      raw,
      As,
      smax,
      ok: As >= req - 1e-9 && I.dl.s <= smax,
    });
  }
  return out;
}

export function chCalc(I: ChInput): ChResult {
  const A = chAnalyse(I);
  const EN = chEnvelope(A, I);
  const DS = chDesign(A, I, EN);
  const SH = chShrink(I);
  return { A, EN, DS, SH, I };
}

export const CH = {
  calc: chCalc,
  derive: chDerive,
  geom: chGeom,
  sections: chSections,
  patches: chPatches,
  VEH: CH_VEH,
  barA: chBarA,
  STEEL: CH_STEEL,
  AREA: CH_REBAR_AREA,
  spring: chSpring,
  Frame: chFrameSolve,
  combos: chCombos,
  lerp: chLerp,
  etaOf: chEtaOf,
} as const;

// ---------------------------------------------------------------------------
// 3. Box Culvert Rebar Defaults, Inputs, Tables & Runner (`chStep`)
// ---------------------------------------------------------------------------

export type ChReb8Tuple = [number, number, number, number, number, number, number, number];
export type ChRebStoreMap = Record<number, Record<number, ChReb8Tuple>>;

export const CHREB_DEF: Readonly<Record<1 | 2 | 3, Readonly<Record<number, readonly [number, number, number, number, number]>>>> = {
  1: {
    1: [18, 125, 18, 150, 200],
    2: [18, 125, 18, 125, 200],
    3: [18, 125, 18, 125, 200],
    4: [18, 125, 18, 200, 200],
    5: [18, 150, 18, 125, 200],
    6: [18, 125, 18, 250, 200],
    7: [18, 150, 18, 125, 200],
  },
  2: {
    1: [18, 150, 20, 115, 170],
    2: [20, 125, 18, 150, 200],
    3: [18, 125, 20, 125, 170],
    4: [18, 200, 18, 125, 170],
    5: [18, 125, 18, 150, 200],
    6: [18, 250, 18, 125, 170],
    7: [18, 150, 18, 125, 200],
    8: [18, 125, 18, 150, 200],
    9: [18, 250, 18, 125, 200],
    10: [18, 125, 18, 150, 200],
    11: [18, 125, 18, 150, 200],
    12: [18, 125, 18, 150, 200],
  },
  3: {
    1: [18, 150, 20, 75, 170],
    2: [20, 125, 18, 150, 200],
    3: [18, 125, 20, 115, 170],
    4: [18, 200, 18, 125, 170],
    5: [18, 125, 18, 150, 200],
    6: [18, 250, 18, 125, 170],
    7: [18, 150, 18, 115, 200],
    8: [18, 125, 18, 150, 200],
    9: [18, 250, 18, 125, 200],
    10: [18, 125, 18, 150, 200],
    11: [18, 150, 20, 115, 170],
    12: [18, 125, 18, 150, 200],
    13: [18, 250, 18, 125, 170],
    14: [18, 125, 18, 250, 200],
    15: [18, 125, 18, 125, 200],
    16: [18, 125, 18, 125, 200],
  },
};

let chRebState: ChRebStoreMap | null = null;
let latestChResult: ChResult | null = null;
let chRebTimer: ReturnType<typeof setTimeout> | null = null;

export function getLatestChResult(): ChResult | null {
  return latestChResult;
}

export function setLatestChResult(res: ChResult | null): void {
  latestChResult = res;
}

export function chRebLoad(): ChRebStoreMap {
  if (chRebState) return chRebState;
  let parsed: ChRebStoreMap | null = null;
  if (typeof localStorage !== 'undefined') {
    try {
      parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.boxCulvertRebar) || 'null');
    } catch {
      parsed = null;
    }
  }
  const map: ChRebStoreMap = parsed && typeof parsed === 'object' ? parsed : {};
  for (const n of [1, 2, 3] as const) {
    map[n] = map[n] || {};
    for (const idStr of Object.keys(CHREB_DEF[n])) {
      const id = Number(idStr);
      if (!map[n][id]) {
        const d = CHREB_DEF[n][id];
        map[n][id] = [d[0], d[1], d[2], d[3], 50, 0, d[4], Math.ceil(1000 / d[4])];
      }
    }
  }
  chRebState = map;
  return map;
}

export function chRebSave(): void {
  if (!chRebState || typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEYS.boxCulvertRebar, JSON.stringify(chRebState));
  } catch {
    // ignore storage quota errors
  }
}

export function getChRebState(): ChRebStoreMap {
  return chRebLoad();
}

export function setChRebState(next: ChRebStoreMap): void {
  chRebState = next;
}

const chN = (id: string, fallback = 0): number => num(id, fallback);

export function chInputs(): ChInput {
  const rebStore = chRebLoad();
  const n = Math.max(1, Math.min(3, Math.round(chN('ch_n', 1)))) as 1 | 2 | 3;
  const st = v('ch_st', 'CB400-V') || 'CB400-V';
  const S = CH_STEEL[st] || [400, 570];
  const nl = Math.max(1, Math.round(chN('ch_nl', 1)));
  const etaD = chN('ch_etaD') || 1;
  const etaR = 1;
  const etaI = chN('ch_etaI') || 1;

  const I: ChInput = {
    n,
    H: chN('ch_H'),
    B: chN('ch_B'),
    tt: chN('ch_tt'),
    tw: chN('ch_tw'),
    twi: n > 1 ? chN('ch_twi') : chN('ch_tw'),
    tb: chN('ch_tb'),
    tv: Math.max(0, chN('ch_tv')),
    hma: chN('ch_hma'),
    gma: chN('ch_gma'),
    hmo: chN('ch_hmo'),
    gmo: chN('ch_gmo'),
    hs: chN('ch_hs'),
    gs: chN('ch_gs'),
    phi: chN('ch_phi'),
    gw: chN('ch_gw'),
    wc: chN('ch_wc'),
    K1: 1,
    gc: chN('ch_gc'),
    fc: chN('ch_fc'),
    st,
    fy: S[0],
    fu: S[1],
    Es: chN('ch_Es') || 200000,
    Fecap: chN('ch_cmp', 1),
    nl,
    lane: chN('ch_lane', 1),
    ehmin: chN('ch_ehmin', 0.5),
    soil: v('ch_soil', 'Sét') || 'Sét',
    k03: chN('ch_k03'),
    Lc: chN('ch_Lc'),
    kUser: chN('ch_kU'),
    etaD,
    etaR,
    etaI,
    eta: etaD * etaR * etaI,
    g3: S[0] / S[1],
    ge: chN('ch_ge', 1),
    ag: chN('ch_ag') || 20,
    dl: { d: chN('ch_dld'), s: chN('ch_dls') },
    water: chN('ch_wa', 1),
    m: [1.2, 1.0, 0.85, 0.65][Math.min(nl, 4) - 1],
    reb: {},
  };

  const R = rebStore[n];
  for (const id of Object.keys(R)) {
    const a = R[Number(id)];
    I.reb[id] = {
      p: { d: a[0], s: a[1] },
      n: { d: a[2], s: a[3] },
      c: a[4],
      v: { d: a[5], s: a[6], nl: a[7] },
    };
  }
  return I;
}

export function chRebTable(I: ChInput, S: ChSectionDef[]): void {
  const rebStore = chRebLoad();
  const R = rebStore[I.n];
  const el = $('tbChReb');
  if (!el) return;
  const cell = (id: number, k: number, w?: number) =>
    `<td class="c"><input class="in rb" data-id="${id}" data-k="${k}" value="${R[id][k]}" style="width:${w || 46}px"></td>`;
  let h =
    '<tr><th rowspan="2">Mặt cắt</th><th rowspan="2">h<br>(mm)</th><th colspan="2">Thép mặt (+)</th><th colspan="2">Thép mặt (−)</th><th rowspan="2">Lớp BV<br>(mm)</th><th colspan="3">Cốt đai</th></tr>' +
    '<tr><th>Φ</th><th>bước</th><th>Φ</th><th>bước</th><th>Φ</th><th>bước</th><th>nhánh/m</th></tr>';
  for (const s of S) {
    h += `<tr><td class="c">${s.id} - ${s.id}</td><td class="c">${s.h.toFixed(0)}</td>${cell(s.id, 0, 40)}${cell(s.id, 1)}${cell(s.id, 2, 40)}${cell(s.id, 3)}${cell(s.id, 4)}${cell(s.id, 5, 40)}${cell(s.id, 6)}${cell(s.id, 7, 40)}</tr>`;
  }
  set('tbChReb', h);
  if (typeof document !== 'undefined') {
    const domEl = document.getElementById('tbChReb');
    if (domEl) {
      domEl.querySelectorAll('input.rb').forEach((node) => {
        const inp = node as HTMLInputElement;
        inp.addEventListener('change', () => {
          const val = parseFloat(String(inp.value).replace(',', '.'));
          const id = Number(inp.dataset.id);
          const k = Number(inp.dataset.k);
          rebStore[I.n][id][k] = Number.isFinite(val) ? val : 0;
          chRebSave();
          if (chRebTimer) clearTimeout(chRebTimer);
          chRebTimer = setTimeout(() => {
            chStep();
          }, 120);
        });
      });
    }
  }
}

export function chTables(R: ChResult): void {
  const A = R.A;
  const o = A.o;
  const I = R.I;
  const EN = R.EN;
  const S = A.S;

  {
    let h = '';
    if (!o.strip) {
      const rows: Array<[string, string, string, string, string]> = [
        ['Cự ly bánh xe trên 1 trục', 'Sw', '1800', '1800', 'mm'],
        ['Cự ly trục xe (hai trục liền kề)', 'sa', '4300', '1200', 'mm'],
        [
          'Chiều sâu tương tác theo phương vuông góc nhịp',
          'Hint-t',
          cf(o.Hint_t, 0),
          cf(o.Hint_t, 0),
          'mm',
        ],
        [
          'Chiều sâu tương tác theo phương song song nhịp',
          'Hint-p',
          cf(o.Hint_p!(4300), 0),
          cf(o.Hint_p!(1200), 0),
          'mm',
        ],
        ['Chiều dày lớp phủ', 'H', cf(o.Hph * 1000, 0), cf(o.Hph * 1000, 0), 'mm'],
        ['Bề rộng vệt tải (vuông góc nhịp)', 'Ww', cf(o.Ww, 0), cf(o.Ww, 0), 'mm'],
        [
          'Tải trọng trong bề rộng Ww',
          o.tInt ? 'P (1 trục)' : 'P (1 bánh)',
          o.tInt ? '145' : '72.5',
          o.tInt ? '110' : '55',
          'kN',
        ],
      ];
      const mt = o.Hph * 1000 >= o.Hint_p!(4300);
      const mn = o.Hph * 1000 >= o.Hint_p!(1200);
      const Lt = mt ? o.Lw0 + 4300 : o.Lw0;
      const Ln = mn ? o.Lw0 + 1200 : o.Lw0;
      const Pt = (mt ? 2 : 1) * (o.tInt ? 145 : 72.5);
      const Pn = (mn ? 2 : 1) * (o.tInt ? 110 : 55);
      const WwVal = o.Ww || o.width;
      rows.push(
        [
          'Chiều dài vệt tải (song song nhịp)',
          'Lw',
          cf(Lt, 0) + (mt ? ' (gộp 2 trục)' : ''),
          cf(Ln, 0) + (mn ? ' (gộp 2 trục)' : ''),
          'mm',
        ],
        ['Tổng tải trọng trên vệt', 'P', cf(Pt, 1), cf(Pn, 1), 'kN'],
        [
          'Áp lực hoạt tải trên đỉnh cống: PL = P(1+IM/100)m/(Ww.Lw)',
          'PL',
          cf((o.kLL * Pt) / (((WwVal / 1000) * Lt) / 1000)),
          cf((o.kLL * Pn) / (((WwVal / 1000) * Ln) / 1000)),
          'kPa',
        ],
      );
      h =
        '<tr><th colspan="4">Thông số</th><th>Ký hiệu</th><th>Xe tải (2 trục 145 kN)</th><th>Xe hai trục</th><th>Đơn vị</th></tr>' +
        rows
          .map(
            (r) =>
              `<tr><td class="l" colspan="4">${r[0]}</td><td class="c">${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td class="c">${r[4]}</td></tr>`,
          )
          .join('');
    } else {
      const EVal = o.E || o.width;
      const Esp = o.Espan || o.Lw0;
      const rows: Array<[string, string, string, string]> = [
        ['Nhịp tịnh của bản nắp', 'S', cf(I.B * 1000, 0), 'mm'],
        ['Bề rộng dải tương đương: E = 2440 + 0,12S', 'E', cf(EVal, 0), 'mm'],
        [
          'Chiều dài phân bố theo nhịp: Espan = LT + LLDF.H (LT = 250 mm)',
          'Espan',
          cf(Esp, 0),
          'mm',
        ],
        [
          'Áp lực do 1 trục xe tải 145 kN',
          'PL',
          cf((o.kLL * 145) / (((EVal / 1000) * Esp) / 1000)),
          'kPa',
        ],
        [
          'Áp lực do 1 trục xe hai trục 110 kN',
          'PL',
          cf((o.kLL * 110) / (((EVal / 1000) * Esp) / 1000)),
          'kPa',
        ],
        [
          'Áp lực do trục trước xe tải 35 kN',
          'PL',
          cf((o.kLL * 35) / (((EVal / 1000) * Esp) / 1000)),
          'kPa',
        ],
      ];
      h =
        '<tr><th colspan="5">Thông số</th><th>Ký hiệu</th><th>Giá trị</th><th>Đơn vị</th></tr>' +
        rows
          .map(
            (r) =>
              `<tr><td class="l" colspan="5">${r[0]}</td><td class="c">${r[1]}</td><td>${r[2]}</td><td class="c">${r[3]}</td></tr>`,
          )
          .join('');
    }
    set('tbChLL', h);
  }

  {
    const L: Array<[string, string, string, string]> = [
      ['Tĩnh tải bản thân cống', 'DC', 'mô hình', ''],
      ['Áp lực nước trong cống', 'WA', I.water ? cf(o.WA) : 'không xét', 'kPa'],
      ['Áp lực thẳng đứng do đất đắp', 'EV', cf(o.EV), 'kPa'],
      ['Áp lực thẳng đứng do kết cấu áo đường', 'DW', cf(o.DW), 'kPa'],
      [
        'Hoạt tải xe thiết kế (vệt tải di động, giá trị lớn nhất)',
        'LLxe',
        cf(Math.max(...CH_VEH.map((veh) => Math.max(...chPatches(o, veh, 0).map((p) => p[2]))))),
        'kPa',
      ],
      ['Tải trọng làn thiết kế', 'LLlàn', I.lane ? cf(o.qlane) : 'không xét', 'kPa'],
      ['Áp lực ngang do đất đắp tại đỉnh cống', 'EHt', cf(o.pt), 'kPa'],
      ['Áp lực ngang do đất đắp tại đáy cống', 'EHb', cf(o.pb), 'kPa'],
      ['Áp lực ngang do hoạt tải chất thêm', 'LS', cf(o.LS), 'kPa'],
    ];
    set(
      'tbChLoads',
      '<tr><th>Stt</th><th colspan="5">Tải trọng tác dụng</th><th>Ký hiệu</th><th>Giá trị</th><th>Đơn vị</th></tr>' +
        L.map(
          (r, i) =>
            `<tr><td class="c">${i + 1}</td><td class="l" colspan="5">${r[0]}</td><td class="c">${r[1]}</td><td>${r[2]}</td><td class="c">${r[3]}</td></tr>`,
        ).join(''),
    );
  }

  {
    const C = chCombos(I);
    const keys = ['DC', 'DW', 'EV', 'EH', 'LL', 'LS', 'WA'] as const;
    set(
      'tbChCmb',
      '<tr><th colspan="3">Trạng thái giới hạn</th><th>DC</th><th>DW</th><th>EV</th><th>EH</th><th>LL</th><th>LS</th><th>WA</th></tr>' +
        C.map(
          (c) =>
            `<tr><td class="l" colspan="3">${c.name}${c.note ? ' (' + c.note + ')' : ''}</td>${keys.map((k) => `<td class="c">${c.g[k].toFixed(k === 'EH' && c.g[k] === 0.675 ? 3 : 2)}</td>`).join('')}</tr>` +
            `<tr><td class="l" colspan="3">&nbsp;&nbsp;η</td>${keys.map((k) => `<td class="c">${chEtaOf(I, c, k).toFixed(3)}</td>`).join('')}</tr>`,
        ).join(''),
    );
  }

  set(
    'tbChSec',
    '<tr><th>Mặt cắt</th><th colspan="4">Vị trí</th><th>Toạ độ (m)</th><th>h (mm)</th></tr>' +
      S.map(
        (s) =>
          `<tr><td class="c">${s.id} - ${s.id}</td><td class="l" colspan="4">${s.w}</td><td class="c">${s.mem === 'top' || s.mem === 'bot' ? 'x = ' + cf(s.x, 3) : 'y = ' + cf(s.y, 3)}</td><td class="c">${s.h.toFixed(0)}</td></tr>`,
      ).join('') +
      '<tr><td class="l" colspan="7">x: từ tim tường biên trái theo phương ngang; y: từ tim bản đáy theo phương đứng (toạ độ trên mô hình tim).</td></tr>',
  );

  {
    const ks = ['DC', 'DW', 'EV', 'EH', 'LS'].concat(I.water ? ['WA'] : []);
    let h = `<tr><th rowspan="2">Mặt cắt</th><th colspan="${ks.length + 2}">Mômen M chưa nhân hệ số (kN.m/m)</th></tr><tr>${ks.map((k) => `<th>${k}</th>`).join('')}<th>LL max</th><th>LL min</th></tr>`;
    S.forEach((s, i) => {
      h += `<tr><td class="c">${s.id} - ${s.id}</td>${ks.map((k) => `<td>${cf(A.out[k].sec[i][0])}</td>`).join('')}<td>${cf(A.LL.sec[i].Mmax[0])}</td><td>${cf(A.LL.sec[i].Mmin[0])}</td></tr>`;
    });
    set('tbChCase', h);
  }

  {
    const chunks = [S.slice(0, 7), S.slice(7, 14), S.slice(14)];
    chunks.forEach((ch, ci) => {
      const id = 'tbChRes' + (ci + 1);
      if (!ch.length) {
        set(id, '');
        return;
      }
      let h = `<tr><th colspan="2">Tổ hợp tải trọng</th><th colspan="${ch.length}">Mặt cắt tính toán</th></tr><tr><th>Tổ hợp</th><th>Nội lực</th>${ch.map((s) => `<th>${s.id} - ${s.id}</th>`).join('')}</tr>`;
      EN.sec.forEach((x) => {
        const rows: Array<[string, (r: ChSectionEnvelopeRow) => number]> = [
          ['M max (kN.m/m)', (r) => r.Mmax[0]],
          ['M min (kN.m/m)', (r) => r.Mmin[0]],
          ['Q (kN/m)', (r) => (Math.abs(r.Vmax[1]) >= Math.abs(r.Vmin[1]) ? r.Vmax[1] : r.Vmin[1])],
          ['N (kN/m)', (r) => (Math.abs(r.Mmax[0]) >= Math.abs(r.Mmin[0]) ? r.Mmax[2] : r.Mmin[2])],
        ];
        rows.forEach((rw, k) => {
          h += `<tr>${k ? '' : `<td class="c" rowspan="4">${x.c.name}</td>`}<td class="l">${rw[0]}</td>${ch.map((s) => `<td>${cf(rw[1](x.r[S.indexOf(s)]))}</td>`).join('')}</tr>`;
        });
      });
      if (ci === 0) {
        h += `<tr><td class="l" colspan="${ch.length + 2}">M max, M min: mômen lớn nhất, nhỏ nhất (dương căng mặt trong); Q: lực cắt có trị tuyệt đối lớn nhất; N: lực dọc đồng thời với mômen có trị tuyệt đối lớn hơn.</td></tr>`;
      }
      set(id, h);
    });
  }

  const D = R.DS;
  const fl = (s: ChSectionDef, f: ChFaceDesignResult | null, face: string) =>
    f
      ? `<tr><td class="c">${s.id}-${s.id} ${face}</td><td class="c">Φ${f.d}/${f.s}</td><td>${cf(f.As, 0)}</td><td>${cf(f.dd, 0)}</td><td>${cf(f.Mu)}</td><td>${cf(f.a, 1)}</td><td>${cf(f.et, 4)}</td><td>${cf(f.phi, 3)}</td><td>${cf(f.Mr)}</td>${okc(f.okM)}</tr>`
      : '';
  set(
    'tbChFlex',
    '<tr><th>Mặt cắt, mặt</th><th>Cốt thép</th><th>As (mm2)</th><th>ds (mm)</th><th>Mu (kN.m)</th><th>a (mm)</th><th>εt</th><th>φ</th><th>Mr (kN.m)</th><th>KL</th></tr>' +
      D.map((d) => fl(d.s, d.P, '(+)') + fl(d.s, d.N, '(−)')).join(''),
  );

  set(
    'tbChMin',
    '<tr><th>Mặt cắt, mặt</th><th>Mu (kN.m)</th><th>1,33Mu</th><th>Sc (mm3)</th><th>Mcr (kN.m)</th><th>min(1,33Mu; Mcr)</th><th>Mr (kN.m)</th><th>KL</th></tr>' +
      D.map((d) =>
        (
          [
            ['(+)', d.P],
            ['(−)', d.N],
          ] as Array<[string, ChFaceDesignResult | null]>
        )
          .filter((x): x is [string, ChFaceDesignResult] => Boolean(x[1]))
          .map(
            ([fcLabel, f]) =>
              `<tr><td class="c">${d.s.id}-${d.s.id} ${fcLabel}</td><td>${cf(f.Mu)}</td><td>${cf(1.33 * f.Mu)}</td><td>${(f.S / 1e6).toFixed(1)}E+06</td><td>${cf(f.Mcr)}</td><td>${cf(f.Mmin)}</td><td>${cf(f.Mr)}</td>${okc(f.okMin)}</tr>`,
          )
          .join(''),
      ).join(''),
  );

  set(
    'tbChCr',
    '<tr><th>Mặt cắt, mặt</th><th>Ms (kN.m)</th><th>k</th><th>j</th><th>fss (MPa)</th><th>dc (mm)</th><th>βs</th><th>smax (mm)</th><th>s (mm)</th><th>KL</th></tr>' +
      D.map((d) =>
        (
          [
            ['(+)', d.P],
            ['(−)', d.N],
          ] as Array<[string, ChFaceDesignResult | null]>
        )
          .filter((x): x is [string, ChFaceDesignResult] => Boolean(x[1]))
          .map(
            ([fcLabel, f]) =>
              `<tr><td class="c">${d.s.id}-${d.s.id} ${fcLabel}</td><td>${cf(f.Ms)}</td><td>${cf(f.k, 4)}</td><td>${cf(f.j, 4)}</td><td>${cf(f.fssc, 1)}</td><td>${cf(f.dc, 0)}</td><td>${cf(f.bs, 3)}</td><td>${Number.isFinite(f.smax) ? cf(Math.min(f.smax, f.smax2), 0) : cf(f.smax2, 0)}</td><td>${f.s}</td>${okc(f.okCr)}</tr>`,
          )
          .join(''),
      ).join('') +
      '<tr><td class="l" colspan="10">smax lấy nhỏ hơn giữa PT 34 và cự ly tối đa của cốt thép chủ 1,5h ≤ 450 mm (TCVN 11823-5, Điều 10.3.2). fss ≤ 0,6fy.</td></tr>',
  );

  set(
    'tbChV',
    '<tr><th>Mặt cắt</th><th>Vu (kN)</th><th>Mu đồng thời (kN.m)</th><th>Nu đồng thời (kN)</th><th>Tổ hợp</th><th>de (mm)</th><th>dv (mm)</th><th>Phương pháp (Điều)</th></tr>' +
      D.map((d) => {
        const vv = d.V;
        return `<tr><td class="c">${d.s.id} - ${d.s.id}</td><td>${cf(vv.Vu)}</td><td>${cf(vv.Mv)}</td><td>${cf(vv.Nv)}</td><td class="c">${(vv.cb || '-').replace('Cường độ ', 'CĐ ')}</td><td>${cf(vv.de, 0)}</td><td>${cf(vv.dv, 0)}</td><td class="c">${vv.meth === '8.3.4.2a' ? '8.3.4.2 (a)' : vv.meth}</td></tr>`;
      }).join('') +
      '<tr><td class="l" colspan="8">Nu dương là kéo, âm là nén. Vu là lực cắt có trị tuyệt đối lớn nhất trong các tổ hợp Cường độ I.</td></tr>',
  );

  set(
    'tbChV2',
    '<tr><th>Mặt cắt</th><th>Vud/Mu hoặc εs</th><th>β</th><th>θ (độ)</th><th>Vc (kN)</th><th>Vs (kN)</th><th>Vn (kN)</th><th>Vr = φVn (kN)</th><th>Vu (kN)</th><th>KL</th></tr>' +
      D.map((d) => {
        const vv = d.V;
        return `<tr><td class="c">${d.s.id} - ${d.s.id}</td><td>${vv.meth === '14.5.3' ? cf(vv.es, 3) : vv.meth === '8.3.4.1' ? '-' : cf((vv.es || 0) * 1000, 3) + 'E-3'}</td><td>${vv.beta == null ? '-' : cf(vv.beta, 3)}</td><td>${cf(vv.theta, 1)}</td><td>${cf(vv.Vc)}</td><td>${cf(vv.Vs)}</td><td>${cf(vv.Vn)}</td><td>${cf(vv.Vr)}</td><td>${cf(vv.Vu)}</td>${okc(vv.ok)}</tr>`;
      }).join('') +
      '<tr><td class="l" colspan="10">Điều 14.5.3: cột thứ hai ghi tỷ số Vu.de/Mu (≤ 1). Điều 8.3.4.1: β = 2, θ = 45°. Điều 8.3.4.2 (a): cột thứ hai ghi εs. Vn = min(Vc + Vs ; 0,25f\'c.bv.dv).</td></tr>',
  );

  {
    const rows = D.filter((d) => d.V.Av > 0);
    set(
      'tbChAv',
      rows.length
        ? '<tr><th>Mặt cắt</th><th>Cốt đai</th><th>Av (mm2/m)</th><th>s (mm)</th><th>Av,min (mm2)</th><th>vu (MPa)</th><th>0,125f\'c</th><th>smax (mm)</th><th>KL</th></tr>' +
            rows
              .map((d) => {
                const vv = d.V;
                return `<tr><td class="c">${d.s.id} - ${d.s.id}</td><td>${d.R.v?.nl || 0} nhánh Φ${d.R.v?.d || 0}</td><td>${cf(vv.Av, 0)}</td><td>${vv.sv}</td><td>${cf(vv.Avmin, 1)}</td><td>${cf(vv.vu, 3)}</td><td>${cf(0.125 * I.fc, 3)}</td><td>${cf(vv.smaxV, 0)}</td>${vv.hasMin ? '<td class="c ok">Đạt</td>' : vv.needS ? '<td class="c bad">Không đạt</td>' : '<td class="c">Không kể Vs</td>'}</tr>`;
              })
              .join('') +
            '<tr><td class="l" colspan="9">"Không kể Vs": cốt đai bố trí chưa thoả Av,min hoặc smax nên không được kể vào sức kháng cắt (Vs = 0); mặt cắt vẫn đạt vì Vu ≤ φVc (bê tông đủ chịu cắt, cống không bắt buộc cốt đai - Điều 8.2.4).</td></tr>'
        : '<tr><td class="l" colspan="9">Không tính cốt đai: sức kháng cắt chỉ do bê tông (Vs = 0); cống không bắt buộc bố trí cốt thép ngang (Điều 8.2.4).</td></tr>',
    );
  }

  set(
    'tbChSh',
    '<tr><th>Bộ phận</th><th>h (mm)</th><th>0,75bh/[2(b+h)fy]</th><th>As yêu cầu (mm2/mm)</th><th>As bố trí (mm2/mm)</th><th>s max (mm)</th><th>KL</th></tr>' +
      R.SH.map(
        (x) =>
          `<tr><td class="l">${x.nm}</td><td class="c">${x.h.toFixed(0)}</td><td>${cf(x.raw, 3)}</td><td>${cf(x.req, 3)}</td><td>${cf(x.As, 3)}</td><td>${cf(x.smax, 0)}</td>${okc(x.ok)}</tr>`,
      ).join(''),
  );

  {
    let all = true;
    const yes = (b: boolean) => {
      all = all && b;
      return okc(b);
    };
    const shOk = R.SH.every((x) => x.ok);
    set(
      'tbChSum',
      '<tr><th>Mặt cắt</th><th colspan="3">Vị trí</th><th>Uốn mặt (+)</th><th>Uốn mặt (−)</th><th>Cốt thép tối thiểu</th><th>Nứt</th><th>Cắt</th></tr>' +
        D.map(
          (d) =>
            `<tr><td class="c">${d.s.id} - ${d.s.id}</td><td class="l" colspan="3">${d.s.w}</td>${d.P ? yes(d.P.okM) : "<td class='c'>-</td>"}${d.N ? yes(d.N.okM) : "<td class='c'>-</td>"}${yes((!d.P || d.P.okMin) && (!d.N || d.N.okMin))}${yes((!d.P || d.P.okCr) && (!d.N || d.N.okCr))}${yes(d.V.ok)}</tr>`,
        ).join('') +
        `<tr><td class="l" colspan="4">Cốt thép co ngót, nhiệt độ</td><td colspan="5" class="c ${shOk ? 'ok' : 'bad'}">${shOk ? 'Đạt' : 'Không đạt'}</td></tr>` +
        `<tr><td class="l" colspan="4"><b>KẾT LUẬN</b></td><td colspan="5" class="c ${all && shOk ? 'ok' : 'bad'}"><b>${all && shOk ? 'CỐNG HỘP ĐẠT YÊU CẦU' : 'CÓ HẠNG MỤC KHÔNG ĐẠT - XEM CÁC BẢNG TRÊN'}</b></td></tr>`,
    );
  }

  {
    const g: Record<string, { n: number; t: number; k: number }> = {};
    for (const sp of A.springs) {
      const key = cf(sp.trib, 3);
      g[key] = g[key] || { n: 0, t: sp.trib, k: sp.k };
      g[key].n++;
    }
    set(
      'tbChSpr',
      '<tr><th>Diện chịu tải của nút (m x 1 m)</th><th>Số nút</th><th>Độ cứng lò xo K (kN/m)</th></tr>' +
        Object.values(g)
          .sort((a, b) => a.t - b.t)
          .map(
            (x) =>
              `<tr><td class="c">${cf(x.t, 3)}</td><td class="c">${x.n}</td><td>${cf(x.k, 1)}</td></tr>`,
          )
          .join('') +
        `<tr><td class="l" colspan="3">Tổng số lò xo: ${A.springs.length}; tổng bề rộng chịu tải ${cf(
          A.springs.reduce((t, s) => t + s.trib, 0),
          3,
        )} m = Bc.</td></tr>`,
    );
  }
}

export function chStep(opts?: { force?: boolean }): ChResult | null {
  if (!$('tab15') && !opts?.force) return null;
  let I: ChInput;
  try {
    I = chInputs();
  } catch (e) {
    console.error(e);
    return null;
  }

  const rTwi = $('r_ch_twi');
  if (rTwi && rTwi.style) rTwi.style.display = I.n > 1 ? '' : 'none';

  const nmc = I.n === 1 ? 'ĐƠN' : I.n + ' NGĂN';
  set(
    'o_ch_ttl',
    `TÍNH TOÁN KẾT CẤU CỐNG HỘP ${nmc} BTCT THOÁT NƯỚC THEO TIÊU CHUẨN THIẾT KẾ CẦU ĐƯỜNG BỘ TCVN 11823:2017`,
  );
  set(
    'o_ch_ttl2',
    `KIỂM TOÁN MẶT CẮT CỐNG HỘP ${I.n === 1 ? '' : I.n + ' x '}(${cf(I.B, 2)} x ${cf(I.H, 2)}) m`,
  );

  const sm = v('ch_mma', '0') || '0';
  const sn = v('ch_mmo', '0') || '0';
  const elGma = $('ch_gma');
  const elGmo = $('ch_gmo');
  if (elGma) elGma.readOnly = sm !== '0';
  if (elGmo) elGmo.readOnly = sn !== '0';
  if (sm !== '0') sv('ch_gma', sm);
  if (sn !== '0') sv('ch_gmo', sn);
  I.gma = chN('ch_gma');
  I.gmo = chN('ch_gmo');

  let R: ChResult;
  try {
    R = chCalc(I);
  } catch (e) {
    console.error(e);
    return null;
  }
  latestChResult = R;

  const A = R.A;
  const o = A.o;
  const setTxt = (id: string, val: string) => set(id, val);

  setTxt('o_ch_Bc', cf(o.Bc, 3));
  setTxt('o_ch_Hph', cf(o.Hph, 3));
  setTxt('o_ch_Hdm', cf(o.Hdm, 3));
  setTxt('o_ch_L1', '1.00');
  setTxt('o_ch_Ec', cf(o.Ec, 0));
  setTxt('o_ch_fr', cf(o.fr, 3));
  setTxt('o_ch_b1', cf(o.b1, 3));
  setTxt('o_ch_fy', I.fy.toFixed(0));
  setTxt('o_ch_k0', cf(o.k0, 4));
  setTxt('o_ch_heq', cf(o.heq, 3));
  setTxt('o_ch_m', cf(I.m, 2));
  setTxt('o_ch_qDCt', cf(I.gc * I.tt));
  setTxt('o_ch_qDCb', cf(I.gc * I.tb));
  setTxt('o_ch_qDCw', cf(I.gc * I.tw) + (I.n > 1 ? ' ; ' + cf(I.gc * I.twi) : ''));
  setTxt('o_ch_WA', cf(o.WA));
  setTxt('o_ch_Fe', cf(o.Fe, 4));
  setTxt(
    'o_ch_Fen',
    o.Fe0 > I.Fecap ? 'lấy Fe = ' + I.Fecap.toFixed(2) : '< ' + I.Fecap.toFixed(2),
  );
  setTxt('o_ch_EV', cf(o.EV));
  setTxt('o_ch_DW', cf(o.DW));
  setTxt('o_ch_IM', cf(o.IM));
  setTxt('o_ch_DE', cf(o.DE, 0));
  setTxt(
    'o_ch_LLmode',
    o.strip
      ? `Lớp phủ Hphủ = ${cf(o.Hph * 1000, 0)} mm < 600 mm → hoạt tải phân bố theo dải tương đương của bản nắp (TCVN 11823-3 Điều 6.1.2.6.1 → TCVN 11823-4 Điều 6.2.10).`
      : `Lớp phủ Hphủ = ${cf(o.Hph * 1000, 0)} mm ≥ 600 mm → hoạt tải phân bố qua đất đắp (TCVN 11823-3 Điều 6.1.2.6.2); H ${o.tInt ? '≥' : '<'} Hint-t = ${cf(o.Hint_t, 0)} mm nên vệt tải ${o.tInt ? 'gồm cả hai bánh xe của một trục' : 'tính cho từng bánh xe'}.`,
  );

  const elFill = $('ch_ll_fill');
  if (elFill && elFill.style) elFill.style.display = o.strip ? 'none' : '';
  const elStrip = $('ch_ll_strip');
  if (elStrip && elStrip.style) elStrip.style.display = o.strip ? '' : 'none';

  setTxt(
    'o_ch_LLskip',
    o.LLskip
      ? 'Chiều dày đất đắp thỏa mãn điều kiện được phép bỏ qua hoạt tải (Điều 6.1.2.6.1); trong tính toán vẫn xét hoạt tải.'
      : '',
  );
  setTxt('o_ch_pt', cf(o.pt));
  setTxt('o_ch_pb', cf(o.pb));
  setTxt('o_ch_LS', cf(o.LS));
  setTxt(
    'o_ch_eta',
    cf(Math.max(0.95, I.etaD * I.etaI * 1.05), 3) +
      ' / ' +
      cf(Math.max(0.95, I.etaD * I.etaI), 3),
  );
  setTxt('o_ch_k', cf(A.SP.k, 0));
  const ks = A.springs.map((s) => s.k);
  setTxt('o_ch_K', cf(ks[Math.floor(ks.length / 2)], 1));
  setTxt('o_ch_K0', cf(ks[0], 1));
  setTxt(
    'o_ch_mesh',
    `Lưới phần tử: ${A.nodes.length} nút, ${A.els.length} phần tử thanh (bản chia ≈ ${cf(I.B / Math.max(12, Math.round(I.B / 0.1)), 3)} m, tường ≈ ${cf(I.H / Math.max(12, Math.round(I.H / 0.12)), 3)} m); E = Ec, A = t x 1 m, I = t³/12 x 1 m; ${A.springs.length} lò xo đứng; hoạt tải xe: ${A.LL.pos} vị trí xếp xe.`,
  );
  setTxt('o_ch_fc2', cf(I.fc, 1));
  setTxt('o_ch_Ec2', cf(o.Ec, 0));
  setTxt('o_ch_fy2', I.fy.toFixed(0));
  setTxt('o_ch_Es2', cf(I.Es, 0));
  setTxt('o_ch_n2', cf(o.n, 3));
  setTxt('o_ch_g1', '1.6');
  setTxt('o_ch_g3', cf(I.g3, 3));

  const cmin = Math.min(
    ...Object.values(I.reb)
      .slice(0, A.S.length)
      .map((r) => r.c),
  );
  setTxt('o_ch_cmin', cf(cmin, 0));
  setTxt('o_ch_cminn', cmin >= 50 ? '≥ 50: Đạt' : '< 50: Không đạt');
  const cminEl = $('o_ch_cminn');
  if (cminEl) cminEl.className = 'note ' + (cmin >= 50 ? 'ok' : 'bad');

  setTxt('o_ch_kB', cf(o.Bc, 3));
  setTxt('o_ch_ks', cf(A.SP.ks, 1));
  setTxt('o_ch_kr', cf(A.SP.kr, 1));
  setTxt('o_ch_k1', cf(A.SP.k, 1));

  chRebTable(I, A.S);
  chTables(R);

  try {
    chnStep(opts);
  } catch (e) {
    console.error(e);
  }
  try {
    getVisualHooks().renderBoxCulvert?.({ result: R });
  } catch (e) {
    console.error(e);
  }
  try {
    getVisualHooks().renderMath?.();
  } catch (e) {
    console.error(e);
  }
  return R;
}

// ---------------------------------------------------------------------------
// 4. Box Culvert Foundation Bearing & Settlement (`CHN` — Module 07)
// ---------------------------------------------------------------------------

export const CHN_N17: readonly (readonly [number, number, number, number])[] = [
  [0, 5.14, 1, 0],
  [1, 5.4, 1.1, 0.1],
  [2, 5.6, 1.2, 0.2],
  [3, 5.9, 1.3, 0.2],
  [4, 6.2, 1.4, 0.3],
  [5, 6.5, 1.6, 0.5],
  [6, 6.8, 1.7, 0.6],
  [7, 7.2, 1.9, 0.7],
  [8, 7.5, 2.1, 0.9],
  [9, 7.9, 2.3, 1],
  [10, 8.4, 2.5, 1.2],
  [11, 8.8, 2.7, 1.4],
  [12, 9.3, 3, 1.7],
  [13, 9.8, 3.3, 2],
  [14, 10.4, 3.6, 2.3],
  [15, 11, 3.9, 2.7],
  [16, 11.6, 4.3, 3.1],
  [17, 12.3, 4.8, 3.5],
  [18, 13.1, 5.3, 4.1],
  [19, 13.9, 5.8, 4.7],
  [20, 14.8, 6.4, 5.4],
  [21, 15.8, 7.1, 6.2],
  [22, 16.9, 7.8, 7.1],
  [23, 18.1, 8.7, 8.2],
  [24, 19.3, 9.6, 9.4],
  [25, 20.7, 10.7, 10.9],
  [26, 22.3, 11.9, 12.5],
  [27, 23.9, 13.2, 14.5],
  [28, 25.8, 14.7, 16.7],
  [29, 27.9, 16.4, 19.3],
  [30, 30.1, 18.4, 22.4],
  [31, 32.7, 20.6, 26],
  [32, 35.5, 23.2, 30.2],
  [33, 38.6, 26.1, 35.2],
  [34, 42.2, 29.4, 41.1],
  [35, 46.1, 33.3, 48],
  [36, 50.6, 37.8, 56.3],
  [37, 55.6, 42.9, 66.2],
  [38, 61.4, 48.9, 78],
  [39, 67.9, 56, 92.3],
  [40, 75.3, 64.2, 109.4],
  [41, 83.9, 73.9, 130.2],
  [42, 93.7, 85.4, 155.6],
  [43, 105.1, 99, 186.5],
  [44, 118.4, 115.3, 224.6],
  [45, 133.9, 134.9, 271.8],
];

export const CHN_KL = [1, 1.4, 1.8, 2.4, 3.2, 5, 10] as const;

export const CHN_KZ = [
  0, 0.4, 0.8, 1.2, 1.6, 2, 2.4, 2.8, 3.2, 3.6, 4, 4.4, 4.8, 5.2, 5.6, 6, 6.4, 6.8, 7.2, 7.6, 8,
  8.4, 8.8, 9.2, 9.6, 10, 11, 12,
] as const;

export const CHN_KT: readonly (readonly number[])[] = [
  [1, 1, 1, 1, 1, 1, 1],
  [0.96, 0.972, 0.975, 0.976, 0.977, 0.977, 0.977],
  [0.8, 0.848, 0.866, 0.875, 0.879, 0.881, 0.881],
  [0.606, 0.682, 0.717, 0.74, 0.749, 0.754, 0.755],
  [0.449, 0.532, 0.578, 0.612, 0.63, 0.639, 0.642],
  [0.336, 0.414, 0.463, 0.505, 0.529, 0.545, 0.55],
  [0.257, 0.325, 0.374, 0.419, 0.449, 0.47, 0.477],
  [0.201, 0.26, 0.304, 0.35, 0.383, 0.41, 0.42],
  [0.16, 0.21, 0.251, 0.294, 0.329, 0.36, 0.374],
  [0.13, 0.173, 0.209, 0.25, 0.283, 0.32, 0.337],
  [0.108, 0.145, 0.176, 0.214, 0.248, 0.285, 0.306],
  [0.091, 0.122, 0.15, 0.185, 0.218, 0.256, 0.28],
  [0.077, 0.105, 0.13, 0.161, 0.192, 0.23, 0.258],
  [0.066, 0.091, 0.112, 0.141, 0.17, 0.208, 0.239],
  [0.058, 0.079, 0.099, 0.124, 0.152, 0.189, 0.223],
  [0.051, 0.07, 0.087, 0.11, 0.136, 0.172, 0.208],
  [0.045, 0.062, 0.077, 0.098, 0.122, 0.158, 0.196],
  [0.04, 0.055, 0.069, 0.088, 0.11, 0.144, 0.185],
  [0.036, 0.049, 0.062, 0.08, 0.1, 0.133, 0.175],
  [0.032, 0.044, 0.056, 0.072, 0.091, 0.123, 0.166],
  [0.029, 0.04, 0.051, 0.066, 0.084, 0.113, 0.158],
  [0.026, 0.037, 0.046, 0.06, 0.077, 0.105, 0.15],
  [0.024, 0.034, 0.042, 0.055, 0.07, 0.098, 0.143],
  [0.022, 0.031, 0.039, 0.051, 0.065, 0.091, 0.137],
  [0.02, 0.028, 0.036, 0.047, 0.06, 0.085, 0.132],
  [0.019, 0.026, 0.033, 0.044, 0.056, 0.079, 0.126],
  [0.017, 0.023, 0.029, 0.037, 0.046, 0.067, 0.114],
  [0.015, 0.02, 0.023, 0.031, 0.04, 0.06, 0.104],
];

export const CHN_MI: Readonly<Record<string, number>> = { A: 7, B: 10, C: 15, D: 17, E: 25 };

export interface ChnSoilInput {
  rock: boolean;
  c: number;
  phi: number;
  g: number;
  Dw: number;
  phib: number;
  theta: number;
  qu: number;
  RMR: number;
  rockT: string;
  phibR: number;
  Df: number;
  Scp: number;
  gtb: number;
  g1: number;
  h1: number;
  g2: number;
  EP: Array<[number, number]>;
}

export interface ChnLoadItem {
  k: 'DC' | 'WA' | 'EV' | 'DW' | 'LL' | 'LN' | 'EH' | 'LS';
  nm: string;
  V: number;
  H: number;
  M: number;
  pos: string;
  p: number;
  u: string;
  veh?: { V: number; M: number; s?: number; x0?: number; veh?: string; P: ChPatchTuple[] };
}

export interface ChnBearingSoilResult {
  rock?: false;
  F: { Nc: number; Nq: number; Ng: number };
  BL: number;
  sc: number;
  sq: number;
  sg: number;
  dq: number;
  n: number;
  iq: number;
  ig: number;
  ic: number;
  Cwq: number;
  Cwg: number;
  Ncm: number;
  Nqm: number;
  Ngm: number;
  qn: number;
  qR: number;
  Bp: number;
  Lp: number;
  Df: number;
  Hs: number;
  Vs: number;
}

export interface ChnBearingRockResult {
  rock: true;
  mi: number;
  RMR: number;
  m: number;
  s: number;
  k: number;
  qn: number;
  qR: number;
}

export interface ChnSettleResult {
  Ptb: number;
  Pgl: number;
  hi: number;
  LB: number;
  pts: Array<{
    i: number;
    z: number;
    g: number;
    sz: number;
    LB: number;
    z2B: number;
    k: number;
    dz: number;
    stop: boolean;
  }>;
  el: Array<{
    i: number;
    h: number;
    p1: number;
    e1: number;
    d: number;
    p2: number;
    e2: number;
    s: number;
    a: ChnSettleResult['pts'][number];
    b: ChnSettleResult['pts'][number];
  }>;
  Hn: number;
  St: number;
  Scm: number;
  ok: boolean;
}

export interface ChnResult {
  LD: {
    L: ChnLoadItem[];
    best: { s?: number; V: number; M: number; x0?: number; veh?: string; P: ChPatchTuple[] };
    bestV: { V: number; M: number; x0?: number; veh?: string; P: ChPatchTuple[] };
    Bc: number;
    Ht: number;
    xc: number;
  };
  rows: Array<ChnLoadItem & { g: number; Vu: number; Hu: number; Mu: number }>;
  T: { V: number; H: number; M: number; Vu: number; Hu: number; Mu: number };
  eB: number;
  Bp: number;
  Lc: number;
  Lp: number;
  sig: number;
  Df: number;
  BR: ChnBearingSoilResult | ChnBearingRockResult;
  okB: boolean;
  okE: boolean;
  Vsd: number;
  ST: ChnSettleResult | null;
  ok: boolean;
  Bc: number;
  o: ChDerived;
  G: ChGeom;
  I: ChInput;
  S: ChnSoilInput;
}

const radChn = (d: number) => (d * Math.PI) / 180;

export function chnNf(phi: number): { Nc: number; Nq: number; Ng: number } {
  const clamped = Math.max(0, Math.min(45, phi));
  const i = Math.min(44, Math.floor(clamped));
  const a = CHN_N17[i];
  const b = CHN_N17[i + 1];
  const t = clamped - a[0];
  return {
    Nc: a[1] + (b[1] - a[1]) * t,
    Nq: a[2] + (b[2] - a[2]) * t,
    Ng: a[3] + (b[3] - a[3]) * t,
  };
}

export function chnK0(LB: number, z2B: number): number {
  const ip = (x: number, xs: readonly number[]): [number, number] => {
    if (x <= xs[0]) return [0, 0];
    for (let i = 1; i < xs.length; i++) {
      if (x <= xs[i]) return [i - 1, (x - xs[i - 1]) / (xs[i] - xs[i - 1])];
    }
    return [xs.length - 2, 1];
  };
  const [i, t] = ip(Math.min(LB, 10), CHN_KL);
  const [j, u] = ip(Math.min(z2B, 12), CHN_KZ);
  const f = (r: number, c: number) => CHN_KT[r][c];
  const a = f(j, i) + (f(j, i + 1) - f(j, i)) * t;
  const b = f(j + 1, i) + (f(j + 1, i + 1) - f(j + 1, i)) * t;
  return a + (b - a) * u;
}

export function chnEOf(p: number, EP: ReadonlyArray<readonly [number, number]>): number {
  const P = EP.map((r) => r[0]);
  const E = EP.map((r) => r[1]);
  let i = P.length - 2;
  for (let k = 1; k < P.length; k++) {
    if (p <= P[k]) {
      i = k - 1;
      break;
    }
  }
  if (p < P[0]) i = 0;
  return E[i] + ((E[i + 1] - E[i]) * (p - P[i])) / (P[i + 1] - P[i]);
}

export function chnLoads(
  I: ChInput,
  o: ChDerived,
  G: ChGeom,
  chRef: Pick<typeof CH, 'VEH' | 'patches'> = CH,
) {
  const Bc = G.Bc;
  const Ht = I.tt + I.H + I.tb;
  const L: ChnLoadItem[] = [];
  const Ac = Bc * Ht - I.n * I.B * I.H + (I.n * 4 * I.tv * I.tv) / 2;
  L.push({
    k: 'DC',
    nm: 'Tĩnh tải bản thân cống',
    V: I.gc * Ac,
    H: 0,
    M: 0,
    pos: '(toàn bộ MCN cống)',
    p: I.gc * Ac,
    u: 'kN',
  });
  L.push({
    k: 'WA',
    nm: 'Trọng lượng nước trong lòng cống',
    V: I.water ? I.gw * I.H * I.B * I.n : 0,
    H: 0,
    M: 0,
    pos: '(bản đáy)',
    p: I.water ? o.WA : 0,
    u: 'kN/m²',
  });
  L.push({
    k: 'EV',
    nm: 'Áp lực thẳng đứng do đất đắp',
    V: o.EV * Bc,
    H: 0,
    M: 0,
    pos: '(bản nắp)',
    p: o.EV,
    u: 'kN/m²',
  });
  L.push({
    k: 'DW',
    nm: 'Áp lực thẳng đứng do kết cấu áo đường',
    V: o.DW * Bc,
    H: 0,
    M: 0,
    pos: '(bản nắp)',
    p: o.DW,
    u: 'kN/m²',
  });

  const xmin = -G.t(0) / 2;
  const xmax = G.X + G.t(I.n) / 2;
  const xc = (xmin + xmax) / 2;
  let best: { s: number; V: number; M: number; x0: number; veh: string; P: ChPatchTuple[] } | null = null;
  let bestV: { V: number; M: number; x0: number; veh: string; P: ChPatchTuple[] } | null = null;
  const gp = { DC: 1.25, DW: 1.5, EV: 1.3, WA: 1, LL: 1.75, LS: 1.75 } as const;
  const eta = I.eta || 1;
  const perm = L.reduce((a, l) => a + gp[l.k as keyof typeof gp] * l.V, 0);
  const HLS = o.LS * Ht;
  const MLS = (HLS * Ht) / 2;
  const qL = o.qlane * Bc;

  for (const veh of chRef.VEH) {
    const len = veh.ax[veh.ax.length - 1][0];
    const half = o.Lw0 / 1000 / 2;
    for (let x0 = xmin - len - half; x0 <= xmax + half; x0 += 0.05) {
      const P = chRef
        .patches(o, veh, x0)
        .map(([a, b, q]): ChPatchTuple => [Math.max(a, xmin), Math.min(b, xmax), q])
        .filter(([a, b]) => b > a);
      if (!P.length) continue;
      let V = 0;
      let M = 0;
      for (const [a, b, q] of P) {
        V += q * (b - a);
        M += q * (b - a) * ((a + b) / 2 - xc);
      }
      const Vu = eta * (perm + 1.75 * (V + qL));
      const Mu = eta * 1.75 * (Math.abs(M) + MLS);
      const e = Mu / Vu;
      const s = Vu / Math.max(1e-6, Bc - 2 * e);
      if (!best || s > best.s) best = { s, V, M: Math.abs(M), x0, veh: veh.name, P };
      if (!bestV || V > bestV.V) bestV = { V, M: Math.abs(M), x0, veh: veh.name, P };
    }
  }

  const finalBest = best || { V: 0, M: 0, P: [] as ChPatchTuple[] };
  const finalBestV = bestV || { V: 0, M: 0, P: [] as ChPatchTuple[] };

  L.push({
    k: 'LL',
    nm: 'Hoạt tải do xe thiết kế',
    V: finalBest.V,
    H: 0,
    M: finalBest.M,
    pos: '(bản nắp)',
    p: finalBest.V / Bc,
    u: 'kN/m²',
    veh: finalBest,
  });
  L.push({
    k: 'LN',
    nm: 'Hoạt tải do tải trọng làn thiết kế',
    V: qL,
    H: 0,
    M: 0,
    pos: '(bản nắp)',
    p: o.qlane,
    u: 'kN/m²',
  });
  L.push({
    k: 'EH',
    nm: 'Áp lực ngang do đất đắp (hai bên tường, tự cân bằng)',
    V: 0,
    H: 0,
    M: 0,
    pos: '(tường biên)',
    p: o.pb,
    u: 'kN/m²',
  });
  L.push({
    k: 'LS',
    nm: 'Áp lực ngang do hoạt tải chất thêm (một bên)',
    V: 0,
    H: HLS,
    M: MLS,
    pos: '(tường biên)',
    p: o.LS,
    u: 'kN/m²',
  });

  return { L, best: finalBest, bestV: finalBestV, Bc, Ht, xc };
}

export function chnBearing(
  S: ChnSoilInput,
  Bp: number,
  Lp: number,
  Df: number,
  Hs: number,
  Vs: number,
): ChnBearingSoilResult {
  const F = chnNf(S.phi);
  const t = S.phi > 0 ? Math.tan(radChn(S.phi)) : 0;
  const BL = Math.min(1, Bp / Lp);
  const sc = S.phi > 0 ? 1 + (BL * F.Nq) / F.Nc : 1 + BL / 5;
  const sq = S.phi > 0 ? 1 + BL * t : 1;
  const sg = S.phi > 0 ? 1 - 0.4 * BL : 1;
  const dq = 1;
  const th = S.theta;
  const n =
    ((2 + 1 / BL) / (1 + 1 / BL)) * Math.cos(radChn(th)) ** 2 +
    ((2 + BL) / (1 + BL)) * Math.sin(radChn(th)) ** 2;
  let iq = 1;
  let ig = 1;
  let ic = 1;
  if (S.phi > 0) {
    const den = Vs + (S.c * Bp * Lp) / t;
    iq = Math.pow(Math.max(0, 1 - Hs / den), n);
    ig = Math.pow(Math.max(0, 1 - Hs / den), n + 1);
    ic = iq - (1 - iq) / (F.Nq - 1);
  } else {
    ic = Math.max(0, 1 - (n * Hs) / (Math.max(S.c, 1e-9) * Bp * Lp * F.Nc));
  }
  const Dw = S.Dw;
  const Cwq = Dw >= Df ? 1 : Dw <= 0 ? 0.5 : 0.5 + (0.5 * Dw) / Df;
  const Cwg = Dw <= Df ? 0.5 : Dw >= 1.5 * Bp + Df ? 1 : 0.5 + (0.5 * (Dw - Df)) / (1.5 * Bp);
  const Ncm = F.Nc * sc * ic;
  const Nqm = F.Nq * sq * dq * iq;
  const Ngm = F.Ng * sg * ig;
  const qn = S.c * Ncm + S.g * Df * Nqm * Cwq + 0.5 * S.g * Bp * Ngm * Cwg;
  return {
    F,
    BL,
    sc,
    sq,
    sg,
    dq,
    n,
    iq,
    ig,
    ic,
    Cwq,
    Cwg,
    Ncm,
    Nqm,
    Ngm,
    qn,
    qR: S.phib * qn,
    Bp,
    Lp,
    Df,
    Hs,
    Vs,
  };
}

export function chnBearingRock(S: ChnSoilInput): ChnBearingRockResult {
  const mi = CHN_MI[S.rockT] || 10;
  const RMR = Math.max(0, Math.min(100, S.RMR));
  const m = mi * Math.exp((RMR - 100) / 14);
  const s = Math.exp((RMR - 100) / 6);
  const k = Math.sqrt(s) + Math.sqrt(m * Math.sqrt(s) + s);
  const qn = k * S.qu * 1000;
  return { rock: true, mi, RMR, m, s, k, qn, qR: S.phibR * qn };
}

export function chnSettle(
  S: ChnSoilInput,
  Vsd: number,
  Bc: number,
  Lc: number,
  Df: number,
): ChnSettleResult {
  const Ptb = Vsd / Bc;
  const Pgl = Ptb - S.gtb * Df;
  const hi = Math.min(Bc / 4, 0.25);
  const LB = Lc / Bc;
  const pts: ChnSettleResult['pts'] = [];
  const gAt = (z: number) => (z < S.h1 ? S.g1 : S.g2);
  let sz = S.gtb * Df;
  let z = 0;

  for (let i = 0; i <= 60; i++) {
    if (i > 0) {
      const g = gAt(z + hi / 2);
      sz += g * hi;
      z += hi;
    }
    const k = chnK0(LB, (2 * z) / Bc);
    const dz = k * Math.max(0, Pgl);
    pts.push({ i, z, g: gAt(z), sz, LB, z2B: (2 * z) / Bc, k, dz, stop: sz >= 5 * dz });
    if (sz >= 5 * dz) break;
  }

  const el: ChnSettleResult['el'] = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const p1 = (a.sz + b.sz) / 2;
    const d = (a.dz + b.dz) / 2;
    const p2 = p1 + d;
    const e1 = chnEOf(p1, S.EP);
    const e2 = chnEOf(p2, S.EP);
    el.push({
      i,
      h: b.z - a.z,
      p1,
      e1,
      d,
      p2,
      e2,
      s: Pgl > 0 ? ((e1 - e2) * (b.z - a.z)) / (1 + e1) : 0,
      a,
      b,
    });
  }
  const St = el.reduce((a, r) => a + r.s, 0);
  return {
    Ptb,
    Pgl,
    hi,
    LB,
    pts,
    el,
    Hn: pts[pts.length - 1].z,
    St,
    Scm: St * 100,
    ok: St * 100 <= S.Scp,
  };
}

export function chnCalc(
  I: ChInput,
  R: ChResult,
  S: ChnSoilInput,
  chRef: Pick<typeof CH, 'VEH' | 'patches'> = CH,
): ChnResult {
  const o = R.A.o;
  const G = R.A.G;
  const LD = chnLoads(I, o, G, chRef);
  const Bc = LD.Bc;
  const eta = I.eta || 1;
  const gMap: Record<ChnLoadItem['k'], number> = {
    DC: 1.25,
    WA: 1,
    EV: 1.3,
    DW: 1.5,
    LL: 1.75,
    LN: 1.75,
    EH: 1.35,
    LS: 1.75,
  };
  const rows = LD.L.map((l) => ({
    ...l,
    g: gMap[l.k],
    Vu: eta * gMap[l.k] * l.V,
    Hu: eta * gMap[l.k] * l.H,
    Mu: eta * gMap[l.k] * l.M,
  }));
  const sum = (k: 'V' | 'H' | 'M' | 'Vu' | 'Hu' | 'Mu') => rows.reduce((a, r) => a + r[k], 0);
  const T = {
    V: sum('V'),
    H: sum('H'),
    M: sum('M'),
    Vu: sum('Vu'),
    Hu: sum('Hu'),
    Mu: sum('Mu'),
  };
  const eB = T.Mu / T.Vu;
  const Bp = Bc - 2 * eB;
  const Lc = Math.max(I.Lc || Bc, Bc);
  const Lp = Lc;
  const sig = T.Vu / (Bp * 1);
  const Df = S.Df > 0 ? S.Df : o.Hdm;
  const BR = S.rock ? chnBearingRock(S) : chnBearing(S, Bp, Lp, Df, T.H, T.V);
  const okB = sig <= BR.qR;
  const okE = eB <= (S.rock ? 0.45 : 1 / 3) * Bc;
  const Vsd = LD.L.reduce((a, l) => a + (l.k === 'LL' ? LD.bestV.V : l.V), 0);
  const ST = S.rock ? null : chnSettle(S, Vsd, Bc, Lc, Df);

  return {
    LD,
    rows,
    T,
    eB,
    Bp,
    Lc,
    Lp,
    sig,
    Df,
    BR,
    okB,
    okE,
    Vsd,
    ST,
    ok: okB && okE && (!ST || ST.ok),
    Bc,
    o,
    G,
    I,
    S,
  };
}

export const CHN = {
  calc: chnCalc,
  Nf: chnNf,
  k0: chnK0,
  eOf: chnEOf,
  N17: CHN_N17,
  KT: CHN_KT,
  KL: CHN_KL,
  KZ: CHN_KZ,
} as const;

let latestChnResult: ChnResult | null = null;

export function getLatestChnResult(): ChnResult | null {
  return latestChnResult;
}

export function setLatestChnResult(res: ChnResult | null): void {
  latestChnResult = res;
}

export function chnInputs(I: ChInput): ChnSoilInput {
  const n = (id: string) => num(id);
  const rock = v('chn_soil', '') === 'a';
  const dwEl = $('chn_Dw');
  return {
    rock,
    c: n('chn_c'),
    phi: n('chn_phi'),
    g: n('chn_g') || 18,
    Dw: dwEl && dwEl.value !== '' ? n('chn_Dw') : 99,
    phib: n('chn_phib') || 0.5,
    theta: 90,
    qu: n('chn_qu'),
    RMR: n('chn_RMR'),
    rockT: v('chn_rockT', 'C') || 'C',
    phibR: n('chn_phibR') || 0.45,
    Df: n('chn_Df'),
    Scp: n('chn_Scp') || 8,
    gtb: n('chn_gtb') || I.gs,
    g1: n('chn_g1') || 18,
    h1: n('chn_h1'),
    g2: n('chn_g2') || n('chn_g1') || 18,
    EP: [0, 1, 2, 3, 4]
      .map((i): [number, number] => [n('chn_p' + i), n('chn_e' + i)])
      .filter((r) => Number.isFinite(r[0]))
      .sort((a, b) => a[0] - b[0]),
  };
}

export function chnSpan(id: string, w: number[]): void {
  if (typeof document === 'undefined') return;
  const t = document.getElementById(id) as HTMLTableElement | null;
  if (!t || !t.rows) return;
  const occ: Record<string, 1> = {};
  [...t.rows].forEach((tr, ri) => {
    let ci = 0;
    [...tr.cells].forEach((td) => {
      while (occ[ri + ',' + ci]) ci++;
      const rs = td.rowSpan || 1;
      const cs = +(td.dataset.cs || td.colSpan || 1);
      td.dataset.cs = String(cs);
      for (let a = 0; a < rs; a++) {
        for (let b = 0; b < cs; b++) occ[ri + a + ',' + (ci + b)] = 1;
      }
      let nSpan = 0;
      for (let b = 0; b < cs; b++) nSpan += w[ci + b] || 1;
      td.colSpan = nSpan;
      ci += cs;
    });
  });
}

const chnOkSpan = (b: boolean): string =>
  `<span class="${b ? 'ok' : 'bad'}">${b ? 'Đạt' : 'Không đạt'}</span>`;

export function chnStep(opts?: { force?: boolean; chResult?: ChResult | null }): ChnResult | null {
  const chR = opts?.chResult ?? latestChResult;
  if ((!$ ('tab44') && !opts?.force) || !chR) return null;
  let R: ChnResult;
  const I = chR.I;
  try {
    const S = chnInputs(I);
    R = chnCalc(I, chR, S, CH);
  } catch (e) {
    console.error(e);
    return null;
  }
  latestChnResult = R;
  const S = R.S;
  const sh = (id: string, vis: boolean) => {
    const e = $(id);
    if (e && e.style) e.style.display = vis ? '' : 'none';
  };
  const kl = (id: string, ok: boolean, t1: string, t2: string) => {
    set(id, 'KẾT LUẬN: ' + (ok ? t1 : t2));
    const e = $(id);
    if (e) e.className = 'kl ' + (ok ? 'ok' : 'bad');
  };
  const f = qf;
  const nm = `${I.n > 1 ? I.n + ' x ' : ''}${f(I.B, 2)}m x ${f(I.H, 2)}m`;
  set('o_chn_ttl', `KIỂM TRA ĐẤT NỀN DƯỚI ĐÁY CỐNG HỘP ${nm}`);
  set('o_chn_h8', `8.&nbsp;&nbsp;KIỂM TRA ĐẤT NỀN DƯỚI CỐNG HỘP ${nm}`);
  sh('chn_soilBox', !S.rock);
  sh('chn_rockBox', S.rock);
  sh('chn_fSo', !S.rock);
  sh('chn_fRo', S.rock);
  sh('chn_stBox', !S.rock);
  set('o_chn_Df', f(R.Df, 3));

  set(
    'tbChnL',
    '<tr><th>Stt</th><th>Tải trọng tác dụng</th><th>Vị trí</th><th>Ký hiệu</th><th>Giá trị</th><th>Đơn vị</th></tr>' +
      R.LD.L.map(
        (l, i) =>
          `<tr><td>${i + 1}</td><td class="l">${l.nm}</td><td class="c">${l.pos}</td><td class="c">${l.k === 'LL' ? 'LLxe' : l.k === 'LN' ? 'LLlàn' : l.k}</td><td>${f(l.p, 3)}</td><td class="c">${l.u}</td></tr>`,
      ).join(''),
  );

  const bv = R.LD.best;
  set(
    'o_chn_ll',
    `Hoạt tải xe: cho ${bv.veh ? bv.veh.toLowerCase() : 'xe'} chạy ngang qua cống (bước 0,05 m), vị trí bất lợi cho ứng suất đáy móng có tổng tải đứng LLxe = ${f(bv.V, 2)} kN, mô men với tim đáy móng ${f(bv.M, 2)} kN.m (đã gồm hệ số làn m và lực xung kích IM). Tải trọng làn ${I.lane ? 'phân bố trên toàn bề rộng cống' : 'không xét (theo chọn ở sheet 1)'}.`,
  );

  {
    let h = `<tr><th rowspan="2">Stt</th><th rowspan="2">Tải trọng tác dụng</th><th rowspan="2">Ký hiệu</th><th colspan="3">Chưa nhân hệ số</th><th rowspan="2">γ (CĐ I)</th><th colspan="3">TTGH CĐ I (đã nhân η = ${f(I.eta || 1, 3)})</th></tr><tr><th>ΣH (kN)</th><th>ΣV (kN)</th><th>ΣM (kN.m)</th><th>ΣH (kN)</th><th>ΣV (kN)</th><th>ΣM (kN.m)</th></tr>`;
    R.rows.forEach((r, i) => {
      h += `<tr><td>${i + 1}</td><td class="l">${r.nm}</td><td class="c">${r.k === 'LL' ? 'LLxe' : r.k === 'LN' ? 'LLlàn' : r.k}</td><td>${f(r.H, 3)}</td><td>${f(r.V, 3)}</td><td>${f(r.M, 3)}</td><td>${f(r.g, 2)}</td><td>${f(r.Hu, 3)}</td><td>${f(r.Vu, 3)}</td><td>${f(r.Mu, 3)}</td></tr>`;
    });
    h += `<tr><td></td><td class="l"><b>Tổng hợp tải trọng đáy móng</b></td><td></td><td><b>${f(R.T.H, 3)}</b></td><td><b>${f(R.T.V, 3)}</b></td><td><b>${f(R.T.M, 3)}</b></td><td></td><td><b>${f(R.T.Hu, 3)}</b></td><td><b>${f(R.T.Vu, 3)}</b></td><td><b>${f(R.T.Mu, 3)}</b></td></tr>`;
    set('tbChnT', h);
  }

  const eL = (S.rock ? 0.45 : 1 / 3) * R.Bc;
  set(
    'tbChnE',
    '<tr><th>Đại lượng</th><th>Ký hiệu</th><th>Công thức</th><th>Giá trị</th><th>Đơn vị</th></tr>' +
      [
        ['Bề rộng đáy móng cống', 'B', 'Bc', f(R.Bc, 3), 'm'],
        ['Chiều dài tính toán (dải)', 'L', '', f(1, 3), 'm'],
        ['Độ lệch tâm theo phương B', 'eB', `ΣM/ΣV = ${f(R.T.Mu, 2)}/${f(R.T.Vu, 2)}`, f(R.eB, 4), 'm'],
        ['Giới hạn độ lệch tâm', 'e<sub>gh</sub>', S.rock ? '0,45.B' : 'B/3', f(eL, 4), 'm'],
        ['Bề rộng có hiệu', "B'", `B − 2eB = ${f(R.Bc, 3)} − 2 × ${f(R.eB, 4)}`, f(R.Bp, 4), 'm'],
        ['Diện tích có hiệu (dải 1 m)', "A'", "B' × 1", f(R.Bp, 4), 'm²'],
        ['Ứng suất lớn nhất đáy móng', 'σmax', "ΣV/A'", f(R.sig, 3), 'kN/m²'],
      ]
        .map(
          (r) =>
            `<tr><td class="l">${r[0]}</td><td class="c">${r[1]}</td><td class="l">${r[2]}</td><td>${r[3]}</td><td class="c">${r[4]}</td></tr>`,
        )
        .join(''),
  );
  kl(
    'klChnE',
    R.okE,
    `eB = ${f(R.eB, 3)} m ≤ ${f(eL, 3)} m - ĐẠT điều kiện độ lệch tâm.`,
    `eB = ${f(R.eB, 3)} m > ${f(eL, 3)} m - KHÔNG ĐẠT điều kiện độ lệch tâm.`,
  );

  {
    let rows: Array<[string, string, string, string]>;
    if (S.rock) {
      const B = R.BR as ChnBearingRockResult;
      rows = [
        ['Cường độ nén một trục', 'qu', f(S.qu, 2), 'MPa'],
        ['Chỉ số khối đá', 'RMR', f(B.RMR, 0), ''],
        ['Hằng số vật liệu đá (nhóm ' + S.rockT + ')', 'mi', f(B.mi, 0), ''],
        ['m = mi.exp((RMR − 100)/14)', 'm', f(B.m, 4), ''],
        ['s = exp((RMR − 100)/6)', 's', f(B.s, 5), ''],
        ['√s + √(m√s + s)', 'k', f(B.k, 4), ''],
        ['Sức kháng danh định', 'qn', f(B.qn, 1), 'kN/m²'],
        ['Hệ số sức kháng', 'φb', f(S.phibR, 2), ''],
        ['Sức kháng tính toán qR = φb.qn', 'qR', f(B.qR, 1), 'kN/m²'],
      ];
    } else {
      const B = R.BR as ChnBearingSoilResult;
      rows = [
        ['Lực dính', 'c', f(S.c, 2), 'kPa'],
        ['Góc nội ma sát', 'φf', f(S.phi, 2), 'độ'],
        ['Trọng lượng riêng đất nền', 'γ', f(S.g, 2), 'kN/m3'],
        ['Chiều sâu đặt móng', 'Df', f(R.Df, 3), 'm'],
        ['Bề rộng có hiệu', "B'", f(B.Bp, 3), 'm'],
        ['Chiều dài có hiệu (chiều dài cống)', "L'", f(B.Lp, 3), 'm'],
        ["Tỷ số B'/L'", "B'/L'", f(B.BL, 4), ''],
        [
          'Hệ số khả năng chịu tải (Bảng 6.3.1.2a-1)',
          'Nc ; Nq ; Nγ',
          `${f(B.F.Nc, 2)} ; ${f(B.F.Nq, 2)} ; ${f(B.F.Ng, 2)}`,
          '',
        ],
        ['Hệ số hình dạng', 'sc ; sq ; sγ', `${f(B.sc, 4)} ; ${f(B.sq, 4)} ; ${f(B.sg, 4)}`, ''],
        ['Hệ số độ sâu', 'dq', f(B.dq, 2), ''],
        ['Tải trọng không hệ số (TTGH SD I)', 'H ; V', `${f(B.Hs, 2)} ; ${f(B.Vs, 2)}`, 'kN'],
        ["Số mũ n = (2 + B'/L')/(1 + B'/L')", 'n', f(B.n, 4), ''],
        ['Hệ số tải trọng nghiêng', 'ic ; iq ; iγ', `${f(B.ic, 4)} ; ${f(B.iq, 4)} ; ${f(B.ig, 4)}`, ''],
        ['Chiều sâu mực nước ngầm', 'Dw', S.Dw >= 90 ? 'không có' : f(S.Dw, 2), 'm'],
        ['Hệ số mực nước ngầm', 'Cwq ; Cwγ', `${f(B.Cwq, 3)} ; ${f(B.Cwg, 3)}`, ''],
        ['Ncm = Nc.sc.ic', 'Ncm', f(B.Ncm, 4), ''],
        ['Nqm = Nq.sq.dq.iq', 'Nqm', f(B.Nqm, 4), ''],
        ['Nγm = Nγ.sγ.iγ', 'Nγm', f(B.Ngm, 4), ''],
        ['Sức kháng danh định qn', 'qn', f(B.qn, 2), 'kN/m²'],
        ['Hệ số sức kháng', 'φb', f(S.phib, 2), ''],
        ['Sức kháng tính toán qR = φb.qn', 'qR', f(B.qR, 2), 'kN/m²'],
      ];
    }
    set(
      'tbChnR',
      '<tr><th>Đại lượng</th><th>Ký hiệu</th><th>Giá trị</th><th>Đơn vị</th></tr>' +
        rows
          .map(
            (r) =>
              `<tr><td class="l">${r[0]}</td><td class="c">${r[1]}</td><td>${r[2]}</td><td class="c">${r[3]}</td></tr>`,
          )
          .join(''),
    );
  }

  set(
    'tbChnC',
    `<tr><th>Hạng mục</th><th>Ký hiệu</th><th>Giá trị (kN/m²)</th><th>So sánh</th><th>Kết luận</th></tr><tr><td class="l">Ứng suất lớn nhất đáy móng cống (CĐ I)</td><td class="c">σmax</td><td>${f(R.sig, 2)}</td><td rowspan="2" class="c">σmax ${R.sig <= R.BR.qR ? '≤' : '>'} qR</td><td rowspan="2" class="c">${chnOkSpan(R.okB)}</td></tr><tr><td class="l">Sức kháng tính toán của ${S.rock ? 'nền đá' : 'đất nền'}</td><td class="c">qR</td><td>${f(R.BR.qR, 2)}</td></tr>`,
  );
  kl(
    'klChnB',
    R.okB,
    `${S.rock ? 'NỀN ĐÁ' : 'ĐẤT NỀN'} MÓNG CỐNG ĐẢM BẢO ĐIỀU KIỆN ỨNG SUẤT (σmax = ${f(R.sig, 1)} ≤ qR = ${f(R.BR.qR, 1)} kN/m²).`,
    `ĐẤT NỀN MÓNG CỐNG KHÔNG ĐẢM BẢO ĐIỀU KIỆN ỨNG SUẤT (σmax = ${f(R.sig, 1)} > qR = ${f(R.BR.qR, 1)} kN/m²) - CẦN CÓ BIỆN PHÁP GIA CỐ NỀN (thay đất, cọc tre, cọc cát, cọc BTCT...) hoặc mở rộng bản đáy.`,
  );

  if (R.ST) {
    const T = R.ST;
    set(
      'tbChnP',
      '<tr><th>Đại lượng</th><th>Ký hiệu</th><th>Công thức</th><th>Giá trị</th><th>Đơn vị</th></tr>' +
        [
          ['Tổng tải trọng đứng TTGH SD I (hoạt tải ở vị trí ΣV lớn nhất)', 'ΣVtc', '', f(R.Vsd, 3), 'kN'],
          [
            'Áp lực trung bình tiêu chuẩn dưới đáy móng',
            'Ptb',
            `ΣVtc/(B × 1) = ${f(R.Vsd, 2)}/${f(R.Bc, 3)}`,
            f(T.Ptb, 3),
            'kN/m²',
          ],
          ['Trọng lượng thể tích trung bình đất từ đáy móng lên mặt đất', 'γtb', '', f(S.gtb, 2), 'kN/m3'],
          ['Chiều sâu chôn móng', 'hm = Df', '', f(R.Df, 3), 'm'],
          ['Áp lực gây lún', 'Pgl', 'Ptb − γtb.hm', f(T.Pgl, 3), 'kN/m²'],
          ['Chiều dày phân tố', 'hi', 'min(B/4 ; 0,25 m)', f(T.hi, 3), 'm'],
          ['Tỷ số L/B (L = chiều dài cống)', 'L/B', `${f(R.Lc, 2)}/${f(R.Bc, 3)}`, f(T.LB, 3), ''],
        ]
          .map(
            (r) =>
              `<tr><td class="l">${r[0]}</td><td class="c">${r[1]}</td><td class="l">${r[2]}</td><td>${r[3]}</td><td class="c">${r[4]}</td></tr>`,
          )
          .join(''),
    );
    set(
      'tbChnZ',
      "<tr><th>Điểm</th><th>γ (kN/m3)</th><th>z (m)</th><th>σ'z (kN/m²)</th><th>L/B</th><th>2z/B</th><th>k0</th><th>Δσz (kN/m²)</th><th>5Δσz</th><th>Điều kiện</th></tr>" +
        T.pts
          .map(
            (p) =>
              `<tr><td>${p.i}</td><td>${f(p.g, 2)}</td><td>${f(p.z, 3)}</td><td>${f(p.sz, 3)}</td><td>${f(p.LB, 3)}</td><td>${f(p.z2B, 3)}</td><td>${f(p.k, 4)}</td><td>${f(p.dz, 3)}</td><td>${f(5 * p.dz, 3)}</td><td class="c">${p.stop ? "Dừng (σ'z ≥ 5Δσz)" : 'Xét tiếp'}</td></tr>`,
          )
          .join(''),
    );
    set(
      'tbChnS',
      '<tr><th colspan="8">BẢNG TÍNH TOÁN ĐỘ LÚN</th></tr><tr><th>Phân tố</th><th>hi (m)</th><th>p1i (kN/m²)</th><th>e1i</th><th>Δσz,tb (kN/m²)</th><th>p2i (kN/m²)</th><th>e2i</th><th>si (m)</th></tr>' +
        T.el
          .map(
            (r) =>
              `<tr><td>${r.i}</td><td>${f(r.h, 3)}</td><td>${f(r.p1, 3)}</td><td>${f(r.e1, 4)}</td><td>${f(r.d, 3)}</td><td>${f(r.p2, 3)}</td><td>${f(r.e2, 4)}</td><td>${f(r.s, 5)}</td></tr>`,
          )
          .join('') +
        `<tr><td colspan="7" class="l"><b>ĐỘ LÚN TỔNG CỘNG S = Σsi</b> (chiều dày vùng chịu nén Hn = ${f(T.Hn, 2)} m)</td><td><b>${f(T.St, 4)}</b></td></tr>`,
    );
    set(
      'tbChnSC',
      `<tr><th>Hạng mục</th><th>Ký hiệu</th><th>Giá trị (cm)</th><th>So sánh</th><th>Kết luận</th></tr><tr><td class="l">Độ lún tính toán</td><td class="c">S</td><td>${f(T.Scm, 2)}</td><td rowspan="2" class="c">S ${T.ok ? '≤' : '>'} [S]</td><td rowspan="2" class="c">${chnOkSpan(T.ok)}</td></tr><tr><td class="l">Độ lún giới hạn cho phép</td><td class="c">[S]</td><td>${f(S.Scp, 2)}</td></tr>`,
    );
    kl(
      'klChnS',
      T.ok,
      `ĐẤT NỀN MÓNG CỐNG ĐẢM BẢO ĐIỀU KIỆN ĐỘ LÚN (S = ${f(T.Scm, 2)} cm ≤ [S] = ${f(S.Scp, 2)} cm).`,
      `ĐẤT NỀN MÓNG CỐNG KHÔNG ĐẢM BẢO ĐIỀU KIỆN ĐỘ LÚN (S = ${f(T.Scm, 2)} cm > [S] = ${f(S.Scp, 2)} cm) - CẦN CÓ BIỆN PHÁP GIA CỐ NỀN.`,
    );
  }

  kl(
    'klChnAll',
    R.ok,
    `${S.rock ? 'Nền đá' : 'Đất nền'} dưới đáy cống hộp ${nm} ĐẠT YÊU CẦU về ứng suất, độ lệch tâm${S.rock ? '' : ' và độ lún'}.`,
    `Nền dưới đáy cống hộp ${nm} KHÔNG ĐẠT: ${[!R.okB ? 'ứng suất' : '', !R.okE ? 'độ lệch tâm' : '', R.ST && !R.ST.ok ? 'độ lún' : ''].filter(Boolean).join(', ')} - cần gia cố nền hoặc điều chỉnh kết cấu.`,
  );

  (
    [
      ['tbChnL', [1, 4, 2, 1, 1, 1]],
      ['tbChnT', [1, 2]],
      ['tbChnE', [3, 1, 3, 1, 1]],
      ['tbChnR', [5, 2, 2, 1]],
      ['tbChnC', [4, 1, 2, 2, 2]],
      ['tbChnP', [3, 1, 3, 1, 1]],
      ['tbChnSC', [4, 1, 2, 2, 2]],
    ] as Array<[string, number[]]>
  ).forEach(([id, w]) => chnSpan(id, w));

  try {
    getVisualHooks().renderChn?.({ result: R });
  } catch (e) {
    console.error(e);
  }
  try {
    getVisualHooks().renderMath?.();
  } catch (e) {
    console.error(e);
  }
  return R;
}

export function toBoxCulvertResult(R: ChResult, chnR?: ChnResult | null): CulvertResult {
  const shOk = R.SH.every((x) => x.ok);
  const dsOk = R.DS.every(
    (d) =>
      (!d.P || (d.P.okM && d.P.okMin && d.P.okCr)) &&
      (!d.N || (d.N.okM && d.N.okMin && d.N.okCr)) &&
      d.V.ok,
  );
  return {
    kind: 'box',
    cells: R.I.n as 1 | 2 | 3,
    stationsCount: R.A.S.length,
    direct: {
      rows: R.DS.map((d) => ({ ...d })),
      okAll: dsOk,
    },
    soilSettlement: chnR
      ? {
          Bp: chnR.Bp,
          qMax: chnR.sig,
          qR: chnR.BR.qR,
          StMm: chnR.ST ? chnR.ST.Scm * 10 : 0,
          okBearing: chnR.okB && chnR.okE,
          okSettle: chnR.ST ? chnR.ST.ok : true,
        }
      : undefined,
    shrinkageOk: shOk,
    okAll: dsOk && shOk && (!chnR || chnR.ok),
  };
}
