/**
 * BangTinhCauCong Web App — Cantilever L-Shaped Reinforced Concrete Retaining Wall Solver (`TL`).
 *
 * Exact clean-room TypeScript port of `TL`, `TLR`, `TL_TAU`, `tlInputs`, `tlOk`, `tlRow`,
 * `tlTx`, `tlF`, `tlTab`, `tlKL`, `tlSv`, `tlH2`, `tlH3`, `tlRC`, and `tlStep` from
 * `analysis-cau-cong/modules/09_retaining_wall_cantilever_l.js` (lines 1–1418).
 *
 * Coordinate system: Origin `O` at front toe bottom `(0, 0)`, `+x` into backfill, `+y` upwards;
 * flat base `y = 0`.
 * Units: kN, m, kPa (per 1 m wall length); RC section checks in mm, MPa.
 */

import type {
  Point2D,
  RcMaterialProps,
  RcSectionInput,
  RcSectionResult,
  RetainingWallResult,
} from '../../types/project';
import { $, getVisualHooks, num, set, sv, tf, v } from '../context';
import { RC } from '../math/rc';
import {
  TC,
  type TcBearingResult,
  type TcBearingRock,
  type TcBearingSpt,
  type TcBearingTheoretical,
  type TcComboSpec,
  type TcLoadItem,
  type TcWedgeResult,
} from './wallGravity';

// ---------------------------------------------------------------------------
// 1. Domain Interfaces
// ---------------------------------------------------------------------------

export interface TlGeometry {
  tb: number;
  xfb: number;
  xbb: number;
  B: number;
  yF: number;
  yT: number;
  xft: number;
  xbt: number;
  xf: (y: number) => number;
  xb: (y: number) => number;
  foot: Point2D[];
  stem: Point2D[];
  topF: (x: number) => number;
  yG: (x: number) => number;
  A: Point2D;
  T: Point2D;
  Hp: number;
  Gv: Point2D[];
  betaV: number;
  ev: Point2D[];
  C0: Point2D;
  eps: number;
  Bs: number;
}

export interface TlLoadItem extends TcLoadItem {
  Lq?: number;
  Ll?: number;
}

export interface TlLoadsBundle {
  L: TlLoadItem[];
  w0: TcWedgeResult;
  wq: TcWedgeResult | null;
  heq: number;
  lsOn: boolean;
  PLS: number;
  dv: number;
  xq: number;
  x0: number;
}

export interface TlPressResult {
  q1: number;
  q2: number;
  Lc: number;
  q: (x: number) => number;
  qmax: number;
  qmin: number;
}

export interface TlAnchorRow {
  x: number;
  n: number;
}

export interface TlAnchorResult {
  As: number;
  Trs: number;
  Trp: number;
  Tr: number;
  ldg: number;
  ldc: number;
  okLg: boolean;
  okLc: boolean;
  rows: TlAnchorRow[];
  nT: number;
  sum: number;
}

export interface TlComboAnchorOverturn {
  act: TlAnchorRow[];
  N: number;
  M: number;
  s: number;
  e: number;
  ok: boolean;
  p: TlPressResult;
}

export interface TlComboSlideCheck {
  Rt: number;
  Ra: number;
  RR: number;
  ok: boolean;
  ok0: boolean;
}

export interface TlComboResult {
  k: 'Ia' | 'Ib' | 'SD';
  nm: string;
  sd: boolean;
  f: (t: TlLoadItem['ty']) => number;
  V: number;
  H: number;
  M: number;
  N: number;
  Hd: number;
  s: number;
  e: number;
  toToe: boolean;
  Bp: number;
  okE: boolean;
  okE0?: boolean;
  sigU: number;
  sigMax: number;
  sigMin: number;
  an?: TlComboAnchorOverturn;
  sl?: TlComboSlideCheck;
  br?: TcBearingResult;
  sigB?: number;
  okB?: boolean;
}

export interface TlStemSectionForce {
  N: number;
  Q: number;
  M: number;
}

export interface TlStemResult {
  ys: number;
  h: number;
  xc: number;
  L: Array<{
    ty: TlLoadItem['ty'];
    Fx: number;
    Fy: number;
    x: number;
    y: number;
    P?: number;
  }>;
  w: TcWedgeResult;
  Hs: number;
  heq: number;
  PLS: number;
  Ib: TlStemSectionForce;
  Ia: TlStemSectionForce;
  SD: TlStemSectionForce;
  Sb: RcSectionInput;
  rc: RcSectionResult;
}

export interface TlFootCutCombo {
  side: -1 | 1;
  x: number;
  h: number;
  pr: TlPressResult;
  Qr: number;
  Mr: number;
  Qd: number;
  Md: number;
  V: number;
  M: number;
}

export interface TlFootBranchResult {
  Ib: TlFootCutCombo;
  Ia: TlFootCutCombo;
  SD: TlFootCutCombo;
  rc: RcSectionResult;
  U: TlFootCutCombo;
}

export interface TlShrinkCheckResult {
  req: number;
  As: number;
  s: number;
  smax: number;
  ok: boolean;
}

export interface TlInterfaceSpec {
  c: number;
  mu: number;
  K1: number;
  K2: number;
  nm: string;
}

export interface TlInterfaceResult {
  T: TlInterfaceSpec;
  Acv: number;
  Avf: number;
  Pc: number;
  Vn1: number;
  Vl1: number;
  Vl2: number;
  Vn: number;
  Vr: number;
  Vu: number;
  Avmin: number;
  ok: boolean;
  okMin: boolean;
}

export interface TlInput {
  H: number;
  t: number;
  n1: number;
  n2: number;
  b1: number;
  b4: number;
  hm: number;
  ht: number;
  hh: number;
  hf: number;
  Hs: number;
  m: number;
  q: number;
  LL: boolean;
  dT: number;
  dT0?: number;
  gs: number;
  phi: number;
  dw: number;
  dvA: boolean;
  dv: number;
  cs: number;
  gc: number;
  fc: number;
  fy: number;
  ag: number;
  ge: number;
  cov: number;
  covB: number;
  sbd: number;
  sbs: number;
  sfd: number;
  sfs: number;
  fbd: number;
  fbs: number;
  ftd: number;
  fts: number;
  hd: number;
  hs: number;
  ld: number;
  ls: number;
  ift: 'n' | 'r' | 'm' | string;
  soil: string;
  rock: boolean;
  gf: number;
  phif: number;
  cf: number;
  Su: number;
  Dw: number;
  brm: string;
  phib: number;
  Nspt: number;
  Ri: number;
  phibS: number;
  brmR: string;
  qu: number;
  RMR: number;
  rockT: string;
  phibR: number;
  qRu: number;
  phit: number;
  eta: number;
  anc: boolean;
  aOT: boolean;
  ad: number;
  afy: number;
  aDh: number;
  atau: number;
  aLr: number;
  aLc: number;
  agf: number;
  as: number;
  aX: number[];
  amu: number;
  phs: number;
  php: number;
}

export interface TlResult {
  I: TlInput;
  g: TlGeometry;
  Ld: TlLoadsBundle;
  C: TlComboResult[];
  Ia: TlComboResult;
  Ib: TlComboResult;
  SD: TlComboResult;
  eLim: number;
  an: TlAnchorResult | null;
  brm: string;
  M: RcMaterialProps;
  st: TlStemResult;
  toe: TlFootBranchResult;
  heel: TlFootBranchResult;
  Sf: RcSectionInput;
  ifc: TlInterfaceResult;
  shS: TlShrinkCheckResult;
  shF: TlShrinkCheckResult;
  ok: {
    e: boolean;
    sl: boolean;
    br: boolean;
    stem: boolean;
    toe: boolean;
    heel: boolean;
    ifc: boolean;
    sh: boolean;
    an: boolean;
    all: boolean;
  };
}

// ---------------------------------------------------------------------------
// 2. Cantilever L-Wall Core Solver (`TL`)
// ---------------------------------------------------------------------------

const rad = (d: number): number => (d * Math.PI) / 180;
const deg = (r: number): number => (r * 180) / Math.PI;

export function tlGeom(I: TlInput): TlGeometry {
  const tb = I.t + (I.n1 + I.n2) * I.H;
  const xfb = I.b1;
  const xbb = I.b1 + tb;
  const B = xbb + I.b4;
  const yF = I.hm;
  const yT = I.hm + I.H;
  const xft = xfb + I.n1 * I.H;
  const xbt = xft + I.t;
  const xf = (y: number): number => xfb + I.n1 * (y - yF);
  const xb = (y: number): number => xbb - I.n2 * (y - yF);
  const foot: Point2D[] = [
    [0, 0],
    [B, 0],
    [B, I.hh],
    [xbb, I.hm],
    [xfb, I.hm],
    [0, I.ht],
  ];
  const stem: Point2D[] = [
    [xfb, I.hm],
    [xbb, I.hm],
    [xbt, yT],
    [xft, yT],
  ];
  const topF = (x: number): number =>
    x <= xfb
      ? I.ht + ((I.hm - I.ht) * x) / Math.max(xfb, 1e-9)
      : x >= xbb
        ? I.hm + ((I.hh - I.hm) * (x - xbb)) / Math.max(I.b4, 1e-9)
        : I.hm;
  const yG = (x: number): number =>
    x <= xbt ? yT : yT + (I.Hs > 1e-9 ? Math.min(I.Hs, (x - xbt) / Math.max(I.m, 1e-9)) : 0);
  const A: Point2D = [B, 0];
  const T: Point2D = [B, yG(B)];
  const Hp = T[1];
  const Gv: Point2D[] = [T];
  if (I.Hs > 1e-9 && xbt + I.m * I.Hs > B + 1e-9) {
    Gv.push([xbt + I.m * I.Hs, yT + I.Hs]);
  }
  const betaV = I.Hs > 1e-9 && xbt + I.m * I.Hs > B + 1e-9 ? deg(Math.atan(1 / I.m)) : 0;

  const top: Point2D[] = [[B, T[1]]];
  if (I.Hs > 1e-9 && xbt + I.m * I.Hs < B - 1e-9) {
    top.push([xbt + I.m * I.Hs, yT + I.Hs]);
  }
  top.push([xbt, yT]);
  const ev: Point2D[] = [[xbb, I.hm], [B, I.hh], ...top];
  const C0: Point2D = [B / 2, 0];

  return {
    tb,
    xfb,
    xbb,
    B,
    yF,
    yT,
    xft,
    xbt,
    xf,
    xb,
    foot,
    stem,
    topF,
    yG,
    A,
    T,
    Hp,
    Gv,
    betaV,
    ev,
    C0,
    eps: 0,
    Bs: B,
  };
}

export function tlLoads(I: TlInput, g: TlGeometry): TlLoadsBundle {
  const L: TlLoadItem[] = [];
  const add = (
    nm: string,
    ty: TlLoadItem['ty'],
    F: [number, number],
    pt: Point2D,
    ex?: Partial<Pick<TlLoadItem, 'A' | 'g' | 'P' | 'Lq' | 'Ll'>>,
  ) => {
    L.push({ nm, ty, Fx: F[0], Fy: F[1], x: pt[0], y: pt[1], ...(ex || {}) });
  };

  const cs = TC.cent(g.stem);
  const cf = TC.cent(g.foot);
  const ce = TC.cent(g.ev);
  add('Tường đứng', 'DC', [0, -I.gc * cs.A], [cs.x, cs.y], { A: cs.A, g: I.gc });
  add('Bản đáy', 'DC', [0, -I.gc * cf.A], [cf.x, cf.y], { A: cf.A, g: I.gc });
  add('Đất đắp trên gót bản đáy', 'EV', [0, -I.gs * ce.A], [ce.x, ce.y], { A: ce.A, g: I.gs });

  const dv = I.dvA ? g.betaV : I.dv;
  const G = g.Gv;
  const w0 = TC.wedge(g.A, g.T, G, I.gs, I.phi, dv, 0, null, I.cs);
  const pt = (f: number): Point2D => [g.B, g.Hp * f];
  add('Áp lực đất chủ động', 'EH', w0.F, pt(1 / 3), { P: w0.P });

  const xq = I.Hs > 1e-9 ? g.xbt + I.m * I.Hs : g.xbt;
  let wq: TcWedgeResult | null = null;
  if (I.q > 1e-9) {
    wq = TC.wedge(g.A, g.T, G, I.gs, I.phi, dv, I.q, Math.max(xq, g.B), I.cs);
    const dP = wq.P - w0.P;
    add('Tải chất thêm q - áp lực ngang', 'ES', [-dP * w0.dP[0], -dP * w0.dP[1]], pt(1 / 2), {
      P: dP,
    });
    const Lq = Math.max(0, g.B - xq);
    if (Lq > 1e-9) {
      add(
        'Tải chất thêm q trên gót',
        'ES',
        [0, -I.q * Lq],
        [(xq + g.B) / 2, g.yG((xq + g.B) / 2)],
        { Lq },
      );
    }
  }

  const heq = TC.heqOf(g.Hp, I.dT);
  const lsOn = Boolean(I.LL && I.dT <= g.Hp / 2 + 1e-9);
  const x0 = g.xbt + I.dT;
  let PLS = 0;
  if (lsOn) {
    PLS = Math.max(
      0,
      TC.wedge(g.A, g.T, G, I.gs, I.phi, dv, I.gs * heq, Math.max(x0, g.B), I.cs).P - w0.P,
    );
    add('Hoạt tải chất thêm LS - thành phần ngang', 'LSh', [-PLS * w0.dP[0], 0], pt(1 / 2), {
      P: PLS,
    });
    if (Math.abs(w0.dP[1]) > 1e-9) {
      add(
        'Hoạt tải chất thêm LS - thành phần đứng trên mặt phẳng tính áp lực',
        'LSv',
        [0, -PLS * w0.dP[1]],
        pt(1 / 2),
        { P: PLS },
      );
    }
    const Ll = Math.max(0, g.B - x0);
    if (Ll > 1e-9) {
      add(
        'Hoạt tải chất thêm LS trên gót',
        'LSv',
        [0, -I.gs * heq * Ll],
        [(x0 + g.B) / 2, g.yG((x0 + g.B) / 2)],
        { Ll },
      );
    }
  }

  return { L, w0, wq, heq, lsOn, PLS, dv, xq, x0 };
}

export const TL_COMB: readonly TcComboSpec[] = TC.COMB;

export function tlCombine(
  L: readonly TlLoadItem[],
  g: TlGeometry,
  c: TcComboSpec,
  eta: number,
): TlComboResult {
  const f = (t: TlLoadItem['ty']): number => (c.sd ? 1 : c.mn[t] ? 1 / eta : eta) * c.f[t];
  let Fx = 0;
  let Fy = 0;
  let M = 0;
  for (const l of L) {
    const k = f(l.ty);
    const fx = k * l.Fx;
    const fy = k * l.Fy;
    Fx += fx;
    Fy += fy;
    M += (l.x - g.C0[0]) * fy - (l.y - g.C0[1]) * fx;
  }
  const N = -Fy;
  const H = -Fx;
  const s = -M / N;
  return {
    k: c.k,
    nm: c.nm,
    sd: Boolean(c.sd),
    f,
    V: N,
    H,
    M,
    N,
    Hd: H,
    s,
    e: Math.abs(s),
    toToe: s < 0,
    Bp: 0,
    okE: false,
    sigU: 0,
    sigMax: 0,
    sigMin: 0,
  };
}

export function tlPress(N: number, s: number, B: number): TlPressResult {
  const e = Math.abs(s);
  let q1: number;
  let q2: number;
  let Lc: number;
  if (e <= B / 6) {
    const qm = N / B;
    q1 = qm * (1 - (6 * s) / B);
    q2 = qm * (1 + (6 * s) / B);
    Lc = B;
  } else {
    Lc = 3 * (B / 2 - e);
    const qx = (2 * N) / Lc;
    if (s < 0) {
      q1 = qx;
      q2 = 0;
    } else {
      q1 = 0;
      q2 = qx;
    }
  }
  const q = (x: number): number =>
    e <= B / 6
      ? q1 + ((q2 - q1) * x) / B
      : s < 0
        ? Math.max(0, q1 * (1 - x / Lc))
        : Math.max(0, q2 * (1 - (B - x) / Lc));
  return {
    q1,
    q2,
    Lc,
    q,
    qmax: Math.max(q1, q2),
    qmin: e <= B / 6 ? Math.min(q1, q2) : 0,
  };
}

export function tlInteg(
  f: (x: number) => number,
  a: number,
  b: number,
  n = 200,
): { S: number; Sx: number } {
  const steps = n || 200;
  let S = 0;
  let Sx = 0;
  const d = (b - a) / steps;
  for (let i = 0; i < steps; i++) {
    const x = a + (i + 0.5) * d;
    const vVal = f(x) * d;
    S += vVal;
    Sx += vVal * x;
  }
  return { S, Sx };
}

export function tlMat(I: Pick<TlInput, 'fc' | 'fy' | 'gc' | 'ag' | 'ge'>): RcMaterialProps {
  const fy = I.fy;
  const fuMap: Record<number, number> = { 300: 450, 400: 570, 500: 650 };
  const fu = fuMap[fy] || fy / 0.7;
  const ecl = fy <= 420 ? 0.002 : Math.min(0.004, 0.002 + (0.002 * (fy - 420)) / 270);
  const etl = fy <= 420 ? 0.005 : Math.min(0.008, 0.005 + (0.003 * (fy - 420)) / 270);
  return RC.mat({
    fc: I.fc,
    fy,
    Es: 200000,
    K1: 1,
    wc: (I.gc / 9.81) * 1000,
    ecl,
    etl,
    ag: I.ag,
    g1: 1.6,
    g3: fy / fu,
    ge: I.ge,
  });
}

export const tlBars = (
  d: number,
  s: number,
  c: number,
): { n: number; s: number; d: number; dc: number } => ({
  n: s > 0 ? 1000 / s : 0,
  s,
  d,
  dc: c + d / 2,
});

export function tlStemSec(
  I: TlInput,
  g: TlGeometry,
  ys: number,
): Omit<TlStemResult, 'Sb' | 'rc'> {
  const top = TC.clipY(g.stem, ys, true);
  const h = g.xb(ys) - g.xf(ys);
  const xc = (g.xf(ys) + g.xb(ys)) / 2;
  const L: TlStemResult['L'] = [];
  const cs = TC.cent(top);
  L.push({ ty: 'DC', Fx: 0, Fy: -I.gc * cs.A, x: cs.x, y: cs.y });

  const A: Point2D = [g.xb(ys), ys];
  const T: Point2D = [g.xbt, g.yT];
  const G: Point2D[] = [T];
  if (I.Hs > 1e-9) G.push([g.xbt + I.m * I.Hs, g.yT + I.Hs]);

  const w = TC.wedge(A, T, G, I.gs, I.phi, I.dw, 0, null, I.cs);
  const Hs = g.yT - ys;
  const pt = (f: number): Point2D => [A[0] + (T[0] - A[0]) * f, ys + Hs * f];
  L.push({ ty: 'EH', Fx: w.F[0], Fy: w.F[1], x: pt(1 / 3)[0], y: pt(1 / 3)[1], P: w.P });

  if (I.q > 1e-9) {
    const wq = TC.wedge(A, T, G, I.gs, I.phi, I.dw, I.q, G[G.length - 1][0], I.cs);
    const d = wq.P - w.P;
    L.push({ ty: 'ES', Fx: -d * w.dP[0], Fy: -d * w.dP[1], x: pt(0.5)[0], y: pt(0.5)[1], P: d });
  }

  const heq = TC.heqOf(Hs, I.dT);
  let PLS = 0;
  if (I.LL && I.dT <= Hs / 2 + 1e-9) {
    PLS =
      I.Hs > 1e-9
        ? Math.max(
            0,
            TC.wedge(A, T, G, I.gs, I.phi, I.dw, I.gs * heq, g.xbt + I.dT, I.cs).P - w.P,
          )
        : w.Ka * I.gs * heq * Hs;
    L.push({ ty: 'LSh', Fx: -PLS * w.dP[0], Fy: 0, x: pt(0.5)[0], y: pt(0.5)[1], P: PLS });
    L.push({ ty: 'LSv', Fx: 0, Fy: -PLS * w.dP[1], x: pt(0.5)[0], y: pt(0.5)[1], P: PLS });
  }

  const res = (c: TcComboSpec): TlStemSectionForce => {
    const f = (t: TlLoadItem['ty']) => (c.sd ? 1 : c.mn[t] ? 1 / I.eta : I.eta) * c.f[t];
    let N = 0;
    let Q = 0;
    let M = 0;
    for (const l of L) {
      const k = f(l.ty);
      N -= k * l.Fy;
      Q -= k * l.Fx;
      M += (l.x - xc) * k * l.Fy - (l.y - ys) * k * l.Fx;
    }
    return { N, Q, M };
  };

  return {
    ys,
    h,
    xc,
    L,
    w,
    Hs,
    heq,
    PLS,
    Ib: res(TL_COMB[1]),
    Ia: res(TL_COMB[0]),
    SD: res(TL_COMB[2]),
  };
}

export function tlFootSec(
  I: TlInput,
  g: TlGeometry,
  Ld: TlLoadsBundle,
  c: TlComboResult,
  side: -1 | 1,
): TlFootCutCombo {
  const pr = tlPress(c.N, c.s, g.B);
  const f = c.f;
  const gc = I.gc;

  if (side < 0) {
    const x = g.xfb;
    const R = tlInteg(pr.q, 0, x);
    const Qr = R.S;
    const Mr = x * R.S - R.Sx;
    const wt = (X: number) => 0.9 * gc * g.topF(X);
    const W = tlInteg(wt, 0, x);
    const Qd = W.S;
    const Md = x * W.S - W.Sx;
    return { side, x, h: I.hm, pr, Qr, Mr, Qd, Md, V: Qr - Qd, M: Mr - Md };
  }

  const x = g.xbb;
  const R = tlInteg(pr.q, x, g.B);
  const Qr = R.S;
  const Mr = R.Sx - x * R.S;

  let Qd = 0;
  let Md = 0;
  const add = (F: number, xx: number) => {
    Qd += F;
    Md += F * (xx - x);
  };
  {
    const W = tlInteg((X: number) => gc * g.topF(X), x, g.B);
    add(f('DC') * W.S, W.S > 0 ? W.Sx / W.S : x);
  }
  for (const l of Ld.L) {
    if (l.x < x - 1e-9) continue;
    if (l.nm.indexOf('Đất đắp') === 0) {
      add(f('EV') * -l.Fy, l.x);
    } else if (l.ty === 'EH' || l.ty === 'ES' || l.ty === 'LSv') {
      if (-l.Fy > 0) add(f(l.ty) * -l.Fy, Math.min(l.x, g.B));
    }
  }
  return { side, x, h: I.hm, pr, Qr, Mr, Qd, Md, V: Qd - Qr, M: -(Md - Mr) };
}

export function tlShrink(
  I: Pick<TlInput, 'fy'>,
  bmm: number,
  hmm: number,
  As: number,
  s: number,
): TlShrinkCheckResult {
  let req = (0.75 * bmm * hmm) / (2 * (bmm + hmm) * I.fy);
  const lo = 0.233;
  const hi = 1.27;
  req = Math.min(hi, Math.max(lo, req));
  const smax = Math.min(3 * hmm, hmm > 900 ? 300 : 450);
  return { req, As, s, smax, ok: As >= req - 1e-9 && s <= smax + 1e-9 };
}

export const TL_IFT: Readonly<Record<'n' | 'r' | 'm', TlInterfaceSpec>> = {
  n: {
    c: 0.52,
    mu: 0.6,
    K1: 0.2,
    K2: 5.5,
    nm: 'bê tông đổ lên mặt bê tông đã đông cứng, sạch, không tạo nhám',
  },
  r: {
    c: 1.66,
    mu: 1.0,
    K1: 0.25,
    K2: 10.3,
    nm: 'bê tông đổ lên mặt bê tông đã đông cứng, sạch, tạo nhám biên độ 6 mm',
  },
  m: {
    c: 2.76,
    mu: 1.4,
    K1: 0.25,
    K2: 10.3,
    nm: 'bê tông đổ liền khối',
  },
};

export function tlIface(
  I: Pick<TlInput, 'ift' | 'fy' | 'fc'>,
  g: Pick<TlGeometry, 'tb'>,
  st: Pick<TlStemResult, 'Sb' | 'Ib'>,
  Pc: number,
): TlInterfaceResult {
  const T = TL_IFT[I.ift as 'n' | 'r' | 'm'] || TL_IFT.n;
  const Acv = g.tb * 1e6;
  const Avf = st.Sb.f1.n * RC.bar(st.Sb.f1.d) + st.Sb.f2.n * RC.bar(st.Sb.f2.d);
  const fy = I.fy;
  const Vn1 = (T.c * Acv + T.mu * (Avf * fy + Pc * 1e3)) / 1e3;
  const Vl1 = (T.K1 * I.fc * Acv) / 1e3;
  const Vl2 = (T.K2 * Acv) / 1e3;
  const Vn = Math.min(Vn1, Vl1, Vl2);
  const Vr = 0.9 * Vn;
  const Vu = Math.abs(st.Ib.Q);
  const Avmin = (0.35 * Acv) / fy;
  return {
    T,
    Acv,
    Avf,
    Pc,
    Vn1,
    Vl1,
    Vl2,
    Vn,
    Vr,
    Vu,
    Avmin,
    ok: Vr >= Vu,
    okMin: Avf >= Avmin,
  };
}

export function tlAnchor(
  I: Pick<
    TlInput,
    'ad' | 'phs' | 'afy' | 'php' | 'aDh' | 'atau' | 'aLr' | 'aLc' | 'agf' | 'fc' | 'aX' | 'as'
  >,
): TlAnchorResult {
  const As = RC.bar(I.ad);
  const Trs = (I.phs * As * I.afy) / 1e3;
  const Trp = (I.php * Math.PI * I.aDh * I.atau * I.aLr * 1000) / 1e3;
  const Tr = Math.min(Trs, Trp);
  const ldb = (fc: number, db: number) =>
    Math.max((0.02 * RC.bar(db) * I.afy) / Math.sqrt(fc), 0.06 * db * I.afy);
  const ldg = ldb(I.agf, I.ad);
  const ldc = ldb(I.fc, I.ad);
  const rows = I.aX.map((x) => ({ x, n: 1 / I.as }));
  const nT = rows.reduce((t, r) => t + r.n, 0);
  return {
    As,
    Trs,
    Trp,
    Tr,
    ldg,
    ldc,
    okLg: I.aLr * 1000 >= ldg,
    okLc: I.aLc * 1000 >= ldc,
    rows,
    nT,
    sum: nT * Tr,
  };
}

export function tlCalc(I0: TlInput): TlResult {
  const I: TlInput = { ...I0 };
  I.dT0 = I.dT;
  if (I.Hs > 1e-9) I.dT = I.m * I.Hs + I.dT0;

  const g = tlGeom(I);
  const Ld = tlLoads(I, g);
  const C = TL_COMB.map((c) => tlCombine(Ld.L, g, c, I.eta));
  const [Ia, Ib, SD] = C;
  const eLim = I.rock ? 0.45 * g.B : g.B / 3;
  const an = I.rock && I.anc ? tlAnchor(I) : null;

  for (const c of C) {
    c.Bp = g.B - 2 * c.e;
    c.okE = c.e <= eLim + 1e-9;
    c.sigU = c.N / Math.max(c.Bp, 1e-9);
    const p = tlPress(c.N, c.s, g.B);
    c.sigMax = p.qmax;
    c.sigMin = p.qmin;
    if (an && I.aOT && !c.sd) {
      const act = an.rows.filter((r) => (c.toToe ? r.x > g.B / 2 : r.x < g.B / 2));
      let N = c.N;
      let M = c.M;
      for (const r of act) {
        const T = r.n * an.Tr;
        N += T;
        M += -(r.x - g.C0[0]) * T;
      }
      const s = -M / N;
      c.an = {
        act,
        N,
        M,
        s,
        e: Math.abs(s),
        ok: Math.abs(s) <= eLim + 1e-9,
        p: tlPress(N, s, g.B),
      };
      c.okE0 = c.okE;
      c.okE = c.okE || c.an.ok;
    }
  }

  for (const c of C) {
    if (c.sd) continue;
    let Rt: number;
    if (!I.rock && I.soil === 'd') {
      const svVal = c.N / g.B;
      Rt = Math.min(I.Su, 0.5 * svVal) * g.B;
    } else {
      Rt = c.N * Math.tan(rad(I.phif));
    }
    const Ra = an ? I.amu * an.sum : 0;
    const RR = I.phit * Rt + Ra;
    c.sl = { Rt, Ra, RR, ok: c.Hd <= RR + 1e-9, ok0: c.Hd <= I.phit * Rt + 1e-9 };
  }

  const brm = I.rock ? (I.brmR === 'kt' ? 'kt' : 'rock') : I.brm;
  const bI = {
    phif: I.phif,
    cf: I.cf,
    gf: I.gf,
    Dw: I.Dw,
    t1: I.ht + I.hf,
    hf: 0,
    phib: I.phib,
    Nspt: I.Nspt,
    Ri: I.Ri,
    phibS: I.phibS,
    rockT: I.rockT,
    RMR: I.RMR,
    qu: I.qu,
    phibR: I.phibR,
  };
  for (const c of C) {
    if (c.sd) continue;
    c.br =
      brm === 'rock'
        ? TC.bearingRock(bI)
        : brm === 'spt'
          ? TC.bearingSPT(bI, g, c.Bp)
          : brm === 'kt'
            ? ({ given: true, qR: I.qRu } as TcBearingResult)
            : TC.bearing(bI, g, c.Bp, SD.Hd, SD.N);
    const sm = c.an ? Math.max(c.sigMax, c.an.p.qmax) : c.sigMax;
    c.sigB = I.rock ? sm : c.sigU;
    c.okB = c.sigB <= c.br.qR + 1e-9;
  }

  const M = tlMat(I);
  const fs = I.cov;
  const Sst: RcSectionInput = {
    b: 1000,
    h: 0,
    f1: tlBars(I.sbd, I.sbs, fs),
    f2: tlBars(I.sfd, I.sfs, fs),
    st: { s: 1, d: 0, n: 0 },
  };
  const stBase = tlStemSec(I, g, g.yF);
  const Sb: RcSectionInput = { ...Sst, h: stBase.h * 1000 };
  const stRc = RC.run(Sb, M, [
    { id: 'CĐ I', st: 'CD', M: stBase.Ib.M, V: stBase.Ib.Q, N: stBase.Ib.N },
    { id: 'SD I', st: 'SD', M: stBase.SD.M, V: stBase.SD.Q, N: stBase.SD.N },
  ]);
  const st: TlStemResult = { ...stBase, Sb, rc: stRc };

  const Sf: RcSectionInput = {
    b: 1000,
    h: I.hm * 1000,
    f1: tlBars(I.fbd, I.fbs, I.covB),
    f2: tlBars(I.ftd, I.fts, fs),
    st: { s: 1, d: 0, n: 0 },
  };
  const toeCombos = {
    Ib: tlFootSec(I, g, Ld, Ib, -1),
    Ia: tlFootSec(I, g, Ld, Ia, -1),
    SD: tlFootSec(I, g, Ld, SD, -1),
  };
  const heelCombos = {
    Ib: tlFootSec(I, g, Ld, Ib, 1),
    Ia: tlFootSec(I, g, Ld, Ia, 1),
    SD: tlFootSec(I, g, Ld, SD, 1),
  };
  const runF = (o: { Ib: TlFootCutCombo; Ia: TlFootCutCombo; SD: TlFootCutCombo }) => {
    const U = [o.Ib, o.Ia].reduce((p, q) => (Math.abs(q.M) > Math.abs(p.M) ? q : p));
    return RC.run(Sf, M, [
      { id: U === o.Ib ? 'CĐ I-b' : 'CĐ I-a', st: 'CD', M: U.M, V: U.V, N: 0 },
      { id: 'SD I', st: 'SD', M: o.SD.M, V: o.SD.V, N: 0 },
    ]);
  };
  const toe: TlFootBranchResult = {
    ...toeCombos,
    rc: runF(toeCombos),
    U: Math.abs(toeCombos.Ib.M) >= Math.abs(toeCombos.Ia.M) ? toeCombos.Ib : toeCombos.Ia,
  };
  const heel: TlFootBranchResult = {
    ...heelCombos,
    rc: runF(heelCombos),
    U: Math.abs(heelCombos.Ib.M) >= Math.abs(heelCombos.Ia.M) ? heelCombos.Ib : heelCombos.Ia,
  };

  const ifc = tlIface(I, g, st, 0.9 * I.gc * TC.cent(g.stem).A);
  const shS = tlShrink(I, I.H * 1000, ((I.t + g.tb) / 2) * 1000, RC.bar(I.hd) / I.hs, I.hs);
  const shF = tlShrink(I, g.B * 1000, I.hm * 1000, RC.bar(I.ld) / I.ls, I.ls);

  const rcOK = (r: RcSectionResult): boolean =>
    r.rows.filter((x) => x.st !== 'SD').every((x) => x.rM >= 1 && x.rV >= 1) &&
    (!r.minR || r.minR.ok) &&
    (!r.cr || r.cr.ok);

  const ok = {
    e: Ia.okE && Ib.okE,
    sl: Boolean(Ia.sl?.ok && Ib.sl?.ok),
    br: Boolean(Ia.okB && Ib.okB),
    stem: rcOK(st.rc),
    toe: rcOK(toe.rc),
    heel: rcOK(heel.rc),
    ifc: ifc.ok && ifc.okMin,
    sh: shS.ok && shF.ok,
    an: !an || (an.okLg && an.okLc),
    all: false,
  };
  ok.all = ok.e && ok.sl && ok.br && ok.stem && ok.toe && ok.heel && ok.ifc && ok.sh && ok.an;

  return { I, g, Ld, C, Ia, Ib, SD, eLim, an, brm, M, st, toe, heel, Sf, ifc, shS, shF, ok };
}

export const TL = {
  calc: tlCalc,
  geom: tlGeom,
  loads: tlLoads,
  comb: tlCombine,
  combine: tlCombine,
  COMB: TL_COMB,
  press: tlPress,
  integ: tlInteg,
  mat: tlMat,
  bars: tlBars,
  stem: tlStemSec,
  stemSec: tlStemSec,
  footSec: tlFootSec,
  toe: (I: TlInput, g: TlGeometry, Ld: TlLoadsBundle, c: TlComboResult) =>
    tlFootSec(I, g, Ld, c, -1),
  heel: (I: TlInput, g: TlGeometry, Ld: TlLoadsBundle, c: TlComboResult) =>
    tlFootSec(I, g, Ld, c, 1),
  shr: tlShrink,
  shrink: tlShrink,
  IFT: TL_IFT,
  iface: tlIface,
  anc: tlAnchor,
  anchor: tlAnchor,
} as const;

// ---------------------------------------------------------------------------
// 3. UI State, Input Reader & HTML Report Generators (`09:538-1416`)
// ---------------------------------------------------------------------------

export let TLR: TlResult | null = null;

export function getLatestTlResult(): TlResult | null {
  return TLR;
}

export function setLatestTlResult(res: TlResult | null): void {
  TLR = res;
}

/** Reference grout-rock bond strength τn (MPa) by rock group A..E (AASHTO Table C11.9.4.2-1) */
export const TL_TAU: Readonly<Record<string, number>> = {
  A: 1.0,
  B: 0.8,
  C: 0.8,
  D: 1.7,
  E: 1.7,
};

export function tlInputs(): TlInput {
  const n = (id: string) => num(`tl_${id}`, 0);
  const val = (id: string) => v(`tl_${id}`, '');
  const soil = val('soil');
  const rock = soil === 'a';
  const brm = val('brm') || 'lt';
  const brmR = val('brmR') || 'ck';
  const anc = rock && val('anc') === '1';
  const dvA = val('dvm') !== 'tay';

  const vis = (id: string, show: boolean) => {
    const e = $(id);
    if (e && e.style) e.style.display = show ? '' : 'none';
  };
  const row = (id: string, show: boolean) => {
    const e = $(`tl_${id}`);
    const r = e?.closest?.('.row');
    if (r && r.style) r.style.display = show ? '' : 'none';
  };

  vis('tl_soilBox', !rock);
  vis('tl_soilBox2', !rock);
  vis('tl_rockBox', rock);
  vis('tl_sptBox', !rock && brm === 'spt');
  vis('tl_ancBox', anc);
  row('anc', rock);
  row('phib', !rock && brm === 'lt');
  row('Su', soil === 'd');
  row('qRu', rock ? brmR === 'kt' : brm === 'kt');
  for (const id of ['qu', 'RMR', 'rockT', 'phibR']) {
    row(id, brmR !== 'kt');
  }
  row('dv', !dvA);

  {
    const phifEl = $('tl_phif');
    const r = phifEl?.closest?.('.row');
    if (r?.children?.[1]) {
      r.children[1].textContent = rock
        ? 'Góc ma sát giữa đáy bản đáy bê tông và đá (dùng khi tính trượt)'
        : 'Góc ma sát trong của đất nền';
    }
  }
  if (rock && val('tauA') !== 'tay') {
    const tauVal = TL_TAU[val('rockT')] || 0.8;
    sv('tl_atau', tauVal);
  }
  {
    const e = $('tl_atau');
    if (e) e.readOnly = val('tauA') !== 'tay';
  }

  const aX = String(val('aX'))
    .split(/[;\s]+/)
    .map((s) => parseFloat(s.replace(',', '.')))
    .filter(Number.isFinite);

  return {
    H: n('H'),
    t: n('t'),
    n1: n('n1'),
    n2: n('n2'),
    b1: n('b1'),
    b4: n('b4'),
    hm: n('hm'),
    ht: Math.min(n('ht') || n('hm'), n('hm')),
    hh: Math.min(n('hh') || n('hm'), n('hm')),
    hf: n('hf'),
    Hs: n('Hs'),
    m: n('m'),
    q: n('q'),
    LL: val('LL') === '1',
    dT: n('dT'),
    gs: n('gs'),
    phi: n('phi'),
    dw: n('dw'),
    dvA,
    dv: n('dv'),
    cs: Math.max(0, n('cs')),
    gc: n('gc'),
    fc: n('fc'),
    fy: +val('fy') || 400,
    ag: n('ag') || 20,
    ge: +val('ge') || 0.75,
    cov: n('cov'),
    covB: n('covB'),
    sbd: n('sbd'),
    sbs: n('sbs'),
    sfd: n('sfd'),
    sfs: n('sfs'),
    fbd: n('fbd'),
    fbs: n('fbs'),
    ftd: n('ftd'),
    fts: n('fts'),
    hd: n('hd'),
    hs: n('hs'),
    ld: n('ld'),
    ls: n('ls'),
    ift: val('ift') || 'n',
    soil: rock ? 'r' : soil,
    rock,
    gf: n('gf'),
    phif: n('phif'),
    cf: n('cf'),
    Su: n('Su'),
    Dw: n('Dw'),
    brm,
    phib: n('phib'),
    Nspt: n('Nspt'),
    Ri: n('Ri') || 1,
    phibS: n('phibS') || 0.45,
    brmR,
    qu: n('qu'),
    RMR: n('RMR'),
    rockT: val('rockT') || 'B',
    phibR: n('phibR') || 0.45,
    qRu: n('qRu'),
    phit: n('phit'),
    eta: n('eta') || 1,
    anc,
    aOT: val('aOT') === '1',
    ad: n('ad'),
    afy: n('afy'),
    aDh: n('aDh'),
    atau: n('atau'),
    aLr: n('aLr'),
    aLc: n('aLc'),
    agf: n('agf'),
    as: n('as') || 1,
    aX: aX.length ? aX : [n('b1') / 2],
    amu: n('amu'),
    phs: 0.9,
    php: 0.5,
  };
}

export const tlOk = (b: boolean): string =>
  `<span class="${b ? 'ok' : 'bad'}">${b ? 'Đạt' : 'Không đạt'}</span>`;

export const tlRow = (
  lab: string,
  sym?: string,
  val?: string | number | null,
  unit?: string,
  note?: string,
): string =>
  `<div class="row"><span></span><span>${lab}</span><span class="sym">${sym || ''}</span><span class="val">${val == null ? '' : val}</span><span class="unit">${unit || ''}</span><span class="note">${note || ''}</span></div>`;

export const tlTx = (t: string): string => `<div class="row"><span></span><span>${t}</span></div>`;

export const tlF = (tex: string): string =>
  `<div class="row f"><span></span><span><span class="m" data-tex="${String(tex).replace(/"/g, '&quot;')}"></span></span></div>`;

export const tlTab = (head: readonly string[], rows: ReadonlyArray<readonly (string | number)[]>): string =>
  '<table class="t dt"><tr>' +
  head.map((h) => `<th>${h}</th>`).join('') +
  '</tr>' +
  rows
    .map(
      (r) =>
        '<tr>' + r.map((c, i) => `<td${i === 0 ? ' class="l"' : ''}>${c}</td>`).join('') + '</tr>',
    )
    .join('') +
  '</table>';

export const tlKL = (ok: boolean, t1: string, t2: string): string =>
  `<p class="kl ${ok ? 'ok' : 'bad'}">KẾT LUẬN: ${ok ? t1 : t2}</p>`;

export const tlSv = (id: string, h: number, cap: string): string =>
  `<svg class="dg" id="${id}" width="760" height="${h}" role="img" aria-label="${cap}"></svg>\n<p class="small cap">${cap}</p>`;

export const tlH2 = (t: string): string => `<h2>${t}</h2>`;
export const tlH3 = (t: string): string => `<h3>${t}</h3>`;

export function tlRC(
  _nm: string,
  S: RcSectionInput,
  M: RcMaterialProps,
  rc: RcSectionResult,
  face: readonly [string, string],
  extra?: string,
): string {
  const g = rc.gM!;
  const sh = rc.gV!.sh;
  const fl = g.fl;
  const T = g.M >= 0 ? S.f1 : S.f2;
  const mr = rc.minR;
  const cr = rc.cr;

  let h = tlTab(
    ['Tổ hợp', 'TTGH', 'M (kN.m)', 'V (kN)', 'N (kN)'],
    rc.rows.map((r) => [
      r.id,
      r.st === 'SD' ? 'Sử dụng' : 'Cường độ',
      tf(r.M),
      tf(r.V),
      tf(r.N),
    ]),
  );
  h += tlTx(
    `<b>a) Sức kháng uốn</b> (TCVN 11823-5, Điều 7.3.2 ; hệ số sức kháng φ theo Điều 5.4.2). Cốt thép chịu kéo ${face[g.M >= 0 ? 0 : 1]}: Φ${tf(T.d, 0)} a ${tf(T.s, 0)} mm.`,
  );
  h += tlF(
    String.raw`a = \dfrac{A_s f_y}{0.85\,f'_c\,b}\ ;\quad M_n = A_s f_y\left(d_s - \dfrac{a}{2}\right)\ ;\quad M_r = \phi\,M_n \ge M_u`,
  );
  h +=
    tlRow('Bề rộng ; chiều cao mặt cắt', 'b ; h', tf(S.b, 0) + ' ; ' + tf(S.h, 0), 'mm') +
    tlRow('Diện tích cốt thép chịu kéo trên 1 m', 'As', tf(fl.As, 1), 'mm²') +
    tlRow('Chiều cao có hiệu', 'ds', tf(fl.ds, 1), 'mm') +
    tlRow(
      'Chiều cao vùng nén ; chiều cao khối ứng suất chữ nhật',
      'c ; a',
      tf(fl.c, 1) + ' ; ' + tf(fl.a, 1),
      'mm',
    ) +
    tlRow(
      'Biến dạng cốt thép chịu kéo ; hệ số sức kháng',
      'εt ; φ',
      tf(fl.et, 4) + ' ; ' + tf(g.phi, 3),
      '',
    ) +
    tlRow(
      'Sức kháng uốn danh định ; tính toán',
      'Mn ; Mr',
      tf(fl.Mn, 2) + ' ; ' + tf(g.Mr, 2),
      'kN.m',
    ) +
    tlRow('Mômen tính toán (' + g.id + ')', 'Mu', tf(Math.abs(g.M), 2), 'kN.m') +
    tlRow('Kiểm tra Mr ≥ Mu', '', '', '', tlOk(g.rM >= 1));

  if (mr) {
    h += tlTx(
      '<b>b) Lượng cốt thép tối thiểu</b> (TCVN 11823-5, Điều 7.3.3.2): Mr ≥ min(Mcr ; 1,33Mu).',
    );
    h += tlF(
      String.raw`M_{cr} = \gamma_3\,\gamma_1\,f_r\,S_c\ ;\quad f_r = 0.63\sqrt{f'_c}\ ;\quad \gamma_1 = 1.6\ ;\ \gamma_3 = f_y/f_u`,
    );
    h +=
      tlRow(
        'Mô đun chống uốn mặt cắt ; cường độ chịu kéo khi uốn',
        'Sc ; fr',
        ((S.b * S.h * S.h) / 6).toExponential(3) + ' ; ' + tf(M.fr, 3),
        'mm³ ; MPa',
      ) +
      tlRow(
        'Mômen nứt ; 1,33Mu',
        'Mcr ; 1,33Mu',
        tf(mr.Mcr, 2) + ' ; ' + tf(1.33 * mr.Mu, 2),
        'kN.m',
      ) +
      tlRow('Kiểm tra Mr ≥ min(Mcr ; 1,33Mu)', '', '', '', tlOk(mr.ok));
  }

  if (cr && rc.gS) {
    h += tlTx(
      `<b>c) Kiểm soát nứt</b> (TCVN 11823-5, Điều 7.3.4 ; TTGH Sử dụng I, M = ${tf(Math.abs(rc.gS.M), 2)} kN.m ; điều kiện tiếp xúc loại ${M.ge >= 1 ? '1' : '2'}, γe = ${tf(M.ge, 2)}).`,
    );
    h += tlF(
      String.raw`s \le \dfrac{123000\,\gamma_e}{\beta_s\,f_{ss}} - 2\,d_c\ ;\quad \beta_s = 1 + \dfrac{d_c}{0.7\,(h - d_c)}\ ;\quad f_{ss} = \dfrac{M_s}{A_s\,j\,d_s} \le 0.6\,f_y`,
    );
    h +=
      tlRow(
        'Ứng suất kéo thớ biên khi chưa nứt ; 0,8fr',
        'fct ; 0,8fr',
        tf(cr.fct, 3) + ' ; ' + tf(0.8 * M.fr, 3),
        'MPa',
      ) +
      tlRow('Khoảng cách từ thớ chịu kéo đến tâm cốt thép', 'dc', tf(T.dc, 1), 'mm') +
      tlRow('Hệ số k ; j', 'k ; j', tf(cr.k, 4) + ' ; ' + tf(cr.j, 4), '') +
      tlRow('Ứng suất cốt thép khi sử dụng', 'fss', tf(cr.fss, 2), 'MPa') +
      tlRow('Hệ số βs', 'βs', tf(cr.bs, 4), '') +
      tlRow(
        'Khoảng cách cốt thép lớn nhất ; bố trí',
        'smax ; s',
        tf(cr.smax, 0) + ' ; ' + tf(cr.sb, 0),
        'mm',
      ) +
      tlRow('Kiểm tra s ≤ smax', '', '', '', tlOk(cr.ok));
  }

  h += tlTx(
    '<b>d) Sức kháng cắt</b> (TCVN 11823-5, Điều 8.3.3, 8.3.4.2 ; không bố trí cốt thép đai ; φv = 0,90).',
  );
  h += tlF(
    String.raw`V_r = \phi_v V_c\ ;\quad V_c = 0.083\,\beta\sqrt{f'_c}\,b_v\,d_v\ ;\quad \beta = \dfrac{4.8}{1 + 750\,\varepsilon_s}\cdot\dfrac{1300}{1000 + s_{xe}}\ ;\quad \varepsilon_s = \dfrac{|M_u|/d_v + |V_u|}{E_s A_s}`,
  );
  h +=
    tlRow('Chiều cao chịu cắt có hiệu', 'dv', tf(sh.dv, 1), 'mm') +
    tlRow(
      'Biến dạng dọc cốt thép chịu kéo ; tham số khoảng cách vết nứt',
      'εs ; sxe',
      tf(sh.es * 1000, 4) + '‰ ; ' + tf(sh.sxe, 1),
      '; mm',
    ) +
    tlRow('Hệ số β ; góc θ', 'β ; θ', tf(sh.beta, 3) + ' ; ' + tf(sh.th, 1), '; độ') +
    tlRow(
      'Sức kháng cắt của bê tông ; tính toán',
      'Vc ; Vr',
      tf(sh.Vc, 2) + ' ; ' + tf(sh.Vr, 2),
      'kN',
    ) +
    tlRow('Lực cắt tính toán (' + rc.gV!.id + ')', 'Vu', tf(Math.abs(rc.gV!.V), 2), 'kN') +
    tlRow('Kiểm tra Vr ≥ Vu', '', '', '', tlOk(rc.gV!.rV >= 1));

  return h + (extra || '');
}

export function tlStep(opts?: { force?: boolean }): TlResult | null {
  if (!opts?.force && !$('tab61')) return null;

  let I: TlInput;
  let R: TlResult;
  try {
    I = tlInputs();
    R = TL.calc(I);
  } catch (e) {
    console.error(e);
    return null;
  }

  TLR = R;
  const g = R.g;
  const Ld = R.Ld;
  const w = Ld.w0;
  I = R.I;

  set(
    'o_tl_ttl2',
    `KIỂM TOÁN TƯỜNG CHẮN CHỮ L BTCT H = ${tf(I.H + I.hm, 2)} m, B = ${tf(g.B, 2)} m`,
  );
  set(
    'o_tl_geo',
    tlRow('Bề dày chân tường đứng tb = t + (n1 + n2).H', 'tb', tf(g.tb, 3), 'm') +
      tlRow('Bề rộng bản đáy B = b1 + tb + b4', 'B', tf(g.B, 3), 'm') +
      tlRow('Chiều cao toàn tường (từ đáy bản đáy đến đỉnh tường)', 'H + hm', tf(g.yT, 3), 'm') +
      tlRow('Chiều sâu chôn móng (tại mũi) Df = ht + hf', 'Df', tf(I.ht + I.hf, 3), 'm') +
      tlRow(
        'Chiều cao mặt phẳng tính áp lực đất (mặt phẳng thẳng đứng qua mép gót)',
        "H'",
        tf(g.Hp, 3),
        'm',
      ),
  );

  let sDC = 0;
  let sEV = 0;
  const W = Ld.L.filter((l) => l.ty === 'DC' || l.ty === 'EV').map((l, i) => {
    if (l.ty === 'DC') sDC -= l.Fy;
    else sEV -= l.Fy;
    return [
      `${i + 1}. ${l.nm}`,
      l.ty,
      tf(l.A, 3),
      tf(l.g, 2),
      tf(-l.Fy, 2),
      tf(l.x, 3),
      tf(l.y, 3),
    ];
  });
  W.push(['Tổng DC ; tổng EV', '', '', '', tf(sDC, 2) + ' ; ' + tf(sEV, 2), '', '']);

  let a =
    tlH3('4.1. Trọng lượng bản thân (DC) và đất đắp trên gót (EV)') +
    tlTx(
      'Trọng lượng từng phần bằng diện tích nhân trọng lượng riêng, đặt tại trọng tâm; tọa độ x, y tính từ gốc O (mép trước đáy bản đáy). Đất phủ phía trên mũi không kể đến (có lợi cho ổn định).',
    ) +
    tlSv('dgTlW', 420, 'Hình 2. Sơ đồ chia khối tính trọng lượng') +
    tlTab(
      ['Thành phần', 'Loại', 'Diện tích (m²)', 'γ (kN/m³)', 'Trọng lượng (kN)', 'x (m)', 'y (m)'],
      W,
    );

  const coul = I.Hs <= 1e-9 || g.betaV < I.phi ? TC.coulomb(90, I.phi, Ld.dv, g.betaV) : NaN;
  a +=
    tlH3('4.2. Áp lực đất chủ động (EH) - TCVN 11823-3, Điều 11.5.3') +
    tlTx(
      `Ổn định tường và sức kháng nền: áp lực đất tính trên mặt phẳng thẳng đứng đi qua mép gót bản đáy (AT), khối đất giữa mặt phẳng này và lưng tường đứng tính vào EV. Góc ma sát trên mặt phẳng AT lấy ${I.dvA ? 'bằng góc dốc mặt đất tại mặt phẳng tính áp lực' : 'theo số liệu nhập'}: δ = ${tf(Ld.dv, 1)}°.`,
    ) +
    tlTx(
      I.Hs > 1e-9
        ? `Mặt đất phía sau gãy khúc (mái dốc 1:${tf(I.m, 2)} cao ${tf(I.Hs, 2)} m rồi nằm ngang): lực đẩy chủ động xác định bằng phương pháp nêm thử (thử dần mặt trượt phẳng góc ρ, lấy giá trị lớn nhất), cùng giả thiết của lý thuyết Coulomb.`
        : 'Mặt đất nằm ngang: lực đẩy chủ động theo Coulomb; kết quả được kiểm tra lại bằng phương pháp nêm thử.',
    ) +
    tlF(
      String.raw`K_a = \dfrac{\sin^2(\theta + \phi'_f)}{\Gamma\,\sin^2\theta\,\sin(\theta - \delta)}\ ;\quad \Gamma = \left[1 + \sqrt{\dfrac{\sin(\phi'_f + \delta)\,\sin(\phi'_f - \beta)}{\sin(\theta - \delta)\,\sin(\theta + \beta)}}\right]^2\quad (\text{PT 3.11.5.3-1, -2})`,
    ) +
    tlF(String.raw`P_a = \tfrac12\,K_a\,\gamma_s\,H'^2`) +
    tlTab(
      ['Đại lượng', 'Ký hiệu', 'Giá trị', 'Đơn vị'],
      [
        ['Góc mặt phẳng tính áp lực với phương ngang', 'θ', '90,00', 'độ'],
        ['Góc mặt đất tại mặt phẳng tính áp lực', 'β', tf(g.betaV, 2), 'độ'],
        [
          'Góc ma sát trong đất đắp ; góc ma sát trên mặt phẳng AT',
          "φ'f ; δ",
          tf(I.phi, 1) + ' ; ' + tf(Ld.dv, 1),
          'độ',
        ],
        [
          'Hệ số áp lực chủ động Coulomb',
          'Ka',
          Number.isFinite(coul) ? tf(coul, 4) : 'không áp dụng',
          '',
        ],
        ['Góc mặt trượt tới hạn (nêm thử)', 'ρ', tf(w.rho, 2), 'độ'],
        ['Hệ số áp lực tương đương (nêm thử)', 'Ka', tf(w.Ka, 4), ''],
        ['Chiều cao mặt phẳng tính áp lực', "H'", tf(g.Hp, 3), 'm'],
        ['Lực đẩy chủ động', 'Pa', tf(w.P, 2), 'kN'],
        [
          'Thành phần nằm ngang ; thẳng đứng',
          'Pa,h ; Pa,v',
          tf(-w.F[0], 2) + ' ; ' + tf(-w.F[1], 2),
          'kN',
        ],
        ["Điểm đặt (cao hơn đáy bản đáy H'/3)", '', tf(g.Hp / 3, 3), 'm'],
      ],
    );

  a +=
    tlH3(
      '4.3. Tải trọng chất thêm (ES) và hoạt tải chất thêm (LS) - TCVN 11823-3, Điều 11.6.1, 11.6.4',
    ) +
    tlTx(
      I.q > 1e-9
        ? `Tải chất thêm phân bố đều q = ${tf(I.q, 2)} kPa trên mặt đất từ ${I.Hs > 1e-9 ? 'đỉnh mái taluy' : 'mép sau đỉnh tường'}: phần nằm trên gót tác dụng thẳng đứng lên gót; phần ngoài mặt phẳng AT gây áp lực ngang, tính bằng nêm thử có kể q.`
        : 'Không có tải chất thêm phân bố đều (q = 0).',
    ) +
    tlF(
      String.raw`\Delta p = K_a\,\gamma_s\,h_{eq}\ ;\quad P_{LS} = \Delta p\,H'\quad (\text{PT 3.11.6.4-1})`,
    ) +
    tlTx(
      !I.LL
        ? 'Không có hoạt tải xe phía sau tường: không xét LS.'
        : Ld.lsOn
          ? `Mép làn xe cách lưng tường d = ${tf(I.dT, 2)} m ≤ H'/2: chiều cao đất tương đương heq = ${tf(Ld.heq, 3)} m (Bảng 3.11.6.4-2, nội suy theo H' và d). Lực ngang PLS = ${tf(Ld.PLS, 2)} kN đặt tại H'/2; phần hoạt tải nằm trên gót (từ x = ${tf(Ld.x0, 2)} m đến mép gót) tác dụng thẳng đứng lên gót, chỉ kể khi kiểm tra sức kháng nền và kết cấu (CĐ I-b), không kể khi kiểm tra lệch tâm, trượt (CĐ I-a).`
          : `Mép làn xe cách lưng tường d = ${tf(I.dT, 2)} m > H'/2: không xét LS (Điều 11.6.4).`,
    ) +
    tlSv('dgTlP', 460, 'Hình 3. Áp lực đất trên mặt phẳng tính áp lực AT và trên lưng tường đứng');

  const C0 = g.C0;
  a +=
    tlH3('4.4. Tổng hợp tải trọng chưa nhân hệ số (đối với tâm đáy bản đáy C)') +
    tlTx('C là trung điểm đáy bản đáy. Mômen dương khi làm tường lật về phía trước (phía mũi).') +
    tlTab(
      ['Tải trọng', 'Loại', 'V (kN)', 'H (kN)', 'x (m)', 'y (m)', 'MC (kN.m)'],
      Ld.L.map((l) => [
        l.nm,
        l.ty,
        tf(-l.Fy, 2),
        tf(-l.Fx, 2),
        tf(l.x, 3),
        tf(l.y, 3),
        tf((l.x - C0[0]) * l.Fy - (l.y - C0[1]) * l.Fx, 2),
      ]),
    );

  const TKeys = ['DC', 'EV', 'EH', 'ES', 'LSh', 'LSv'] as const;
  const TN: Record<(typeof TKeys)[number], string> = {
    DC: 'DC',
    EV: 'EV',
    EH: 'EH',
    ES: 'ES',
    LSh: 'LS (ngang)',
    LSv: 'LS (đứng)',
  };
  a +=
    tlH2('5.&nbsp;&nbsp;TỔ HỢP TẢI TRỌNG - TCVN 11823-3, BẢNG 3, BẢNG 4') +
    tlTx(
      'CĐ I-a: tải trọng thẳng đứng lấy hệ số nhỏ nhất, tải trọng ngang lớn nhất (kiểm tra lệch tâm, trượt; không kể thành phần đứng của LS). CĐ I-b: các hệ số lớn nhất (kiểm tra sức kháng nền, kết cấu). SD I: hệ số 1,0 (kiểm soát nứt; tải trọng không hệ số khi tính hệ số tải trọng nghiêng).',
    ) +
    tlTab(
      ['Tổ hợp', ...TKeys.map((t) => TN[t])],
      TC.COMB.map((c) => [
        c.nm,
        ...TKeys.map((t) => tf(c.sd ? 1 : c.mn[t] ? c.f[t] / I.eta : c.f[t] * I.eta, 2)),
      ]),
    ) +
    tlTab(
      ['Tổ hợp', 'V (kN)', 'H (kN)', 'MC (kN.m)', 'e (m)'],
      R.C.map((c) => [
        c.nm,
        tf(c.V),
        tf(c.H),
        tf(c.M),
        tf(c.e, 3) + (c.toToe ? ' (phía mũi)' : ' (phía gót)'),
      ]),
    );
  set('o_tl_A', a);

  const S2 = R.C.filter((c) => !c.sd);
  const HD = ['Đại lượng', 'Ký hiệu', ...S2.map((c) => (c.k === 'Ia' ? 'CĐ I-a' : 'CĐ I-b')), 'Đơn vị'];
  const rw = (
    lab: string,
    sym: string,
    fn: (c: TlComboResult) => string | number | undefined,
    u: string,
    d = 3,
  ): string[] => [
    lab,
    sym,
    ...S2.map((c) => {
      const val = fn(c);
      return typeof val === 'string' ? val : tf(val, d);
    }),
    u,
  ];

  let b =
    tlH2('6.&nbsp;&nbsp;KIỂM TOÁN ĐỘ LỆCH TÂM - TCVN 11823-11, ĐIỀU 6.3.3') +
    tlTx(
      `Móng trên nền ${I.rock ? 'đá: hợp lực nằm trong 9/10 bề rộng đáy (e ≤ 0,45B)' : 'đất: hợp lực nằm trong 2/3 bề rộng đáy (e ≤ B/3)'}.`,
    );
  const an = R.an;
  const aOT = Boolean(an && I.aOT);
  if (aOT) {
    b += tlTx(
      'Kể đến lực neo chống lật: các hàng neo nằm ở nửa đáy móng phía đối diện với hợp lực làm việc chịu kéo với sức kháng tính toán Tr (mục 9); lực neo cộng vào lực thẳng đứng tại vị trí hàng neo.',
    );
  }
  b +=
    tlTab(HD, [
      rw('Lực thẳng đứng', 'V', (c) => c.N, 'kN', 2),
      rw('Mômen đối với tâm C', 'MC', (c) => c.M, 'kN.m', 2),
      rw('Độ lệch tâm e = |MC|/V', 'e', (c) => c.e, 'm'),
      ...(aOT
        ? [
            rw('Lực neo chống lật ΣTr', 'ΣTr', (c) => (c.an ? c.an.N - c.N : 0), 'kN', 2),
            rw('Độ lệch tâm khi kể lực neo', "e'", (c) => (c.an ? c.an.e : c.e), 'm'),
          ]
        : []),
      rw('Giới hạn lệch tâm', I.rock ? '0,45B' : 'B/3', () => R.eLim, 'm'),
      rw('Kiểm tra', '', (c) => tlOk(c.okE), ''),
    ]) +
    tlKL(
      R.ok.e,
      'Độ lệch tâm của hợp lực ĐẠT YÊU CẦU.',
      'Độ lệch tâm của hợp lực KHÔNG ĐẠT - cần tăng bề rộng gót hoặc bố trí neo chống lật.',
    );

  b +=
    tlH2('7.&nbsp;&nbsp;KIỂM TOÁN TRƯỢT - TCVN 11823-10, ĐIỀU 6.3.4') +
    tlF(
      String.raw`H \le R_R = \phi_\tau R_\tau${an ? String.raw` + \mu\,\Sigma T_r` : ''}\quad (\text{PT 10.6.3.4-1})`,
    ) +
    (I.rock
      ? tlTx('Nền đá: Rτ = V.tanδ, δ - góc ma sát giữa đáy bản đáy bê tông và đá.')
      : I.soil === 'd'
        ? tlF(
            String.raw`R_\tau = \min\left(S_u;\ 0.5\,\sigma'_v\right) B\ ;\quad \sigma'_v = V/B\quad (\text{PT 10.6.3.4-3, -4})`,
          )
        : tlF(
            String.raw`R_\tau = V\tan\delta_b\ ;\quad \tan\delta_b = \tan\phi_f\quad (\text{PT 10.6.3.4-2})`,
          )) +
    (an
      ? tlTx(
          `Neo thép khoan vào đá cắt qua mặt tiếp xúc đáy móng - đá tạo lực kẹp ép mặt tiếp xúc; phần sức kháng trượt do neo lấy theo cơ chế ma sát cắt (TCVN 11823-5, Điều 8.4.1): μ.ΣTr, trong đó ΣTr là tổng sức kháng kéo tính toán của các thanh neo trên 1 m dài tường (mục 9), μ = ${tf(I.amu, 2)} hệ số ma sát (Điều 8.4.3).`,
        )
      : '') +
    tlTx('Bỏ qua sức kháng bị động của đất phía trước mũi (thiên về an toàn).') +
    tlTab(HD, [
      rw('Lực thẳng đứng', 'V', (c) => c.N, 'kN', 2),
      rw(
        I.rock || I.soil !== 'd' ? 'tanδ' : "Su ; 0,5σ'v",
        I.rock || I.soil !== 'd' ? 'tanδ' : '',
        (c) =>
          I.rock || I.soil !== 'd'
            ? Math.tan((I.phif * Math.PI) / 180)
            : tf(I.Su, 1) + ' ; ' + tf((0.5 * c.N) / g.B, 1),
        I.soil === 'd' && !I.rock ? 'kPa' : '',
        4,
      ),
      rw('Sức kháng trượt danh định', 'Rτ', (c) => c.sl!.Rt, 'kN', 2),
      rw('Hệ số sức kháng trượt', 'φτ', () => I.phit, '', 2),
      ...(an ? [rw('Sức kháng trượt do neo μ.ΣTr', '', (c) => c.sl!.Ra, 'kN', 2)] : []),
      rw('Sức kháng trượt tính toán', 'RR', (c) => c.sl!.RR, 'kN', 2),
      rw('Lực ngang tính toán', 'H', (c) => c.Hd, 'kN', 2),
      rw('Kiểm tra H ≤ RR', '', (c) => tlOk(c.sl!.ok), ''),
    ]) +
    tlKL(
      R.ok.sl,
      'Tường ĐẠT YÊU CẦU về trượt.',
      I.rock
        ? 'Tường KHÔNG ĐẠT về trượt - cần tăng số lượng, đường kính neo hoặc làm răng chống trượt.'
        : 'Tường KHÔNG ĐẠT về trượt - cần tăng bề rộng bản đáy hoặc làm răng chống trượt.',
    );

  const bm = R.brm;
  b +=
    tlH2(
      '8.&nbsp;&nbsp;KIỂM TOÁN SỨC KHÁNG ĐỠ CỦA NỀN - TCVN 11823-10, ĐIỀU 6.3.1 (NỀN ĐẤT), ĐIỀU 6.3.2 (NỀN ĐÁ)',
    ) +
    tlTx(
      I.rock
        ? 'Móng trên nền đá: ứng suất đáy móng phân bố tuyến tính trên toàn bề rộng B, lấy giá trị lớn nhất σmax (TCVN 11823-11, Điều 6.3.2).'
        : "Móng trên nền đất: ứng suất đáy móng phân bố đều trên bề rộng có hiệu B' = B − 2e (TCVN 11823-11, Điều 6.3.2).",
    ) +
    (I.rock
      ? tlF(
          String.raw`e \le \dfrac{B}{6}:\ \sigma_{max} = \dfrac{V}{B}\left(1 + \dfrac{6e}{B}\right)\ ;\quad e > \dfrac{B}{6}:\ \sigma_{max} = \dfrac{2V}{3\,(B/2 - e)}\quad (\text{PT 11.6.3.2-2, -3})`,
        )
      : tlF(String.raw`\sigma_V = \dfrac{V}{B'}\ ;\quad B' = B - 2e\quad (\text{PT 11.6.3.2-1})`)) +
    tlSv('dgTlB', 330, 'Hình 4. Phân bố ứng suất đáy móng (CĐ I-a, CĐ I-b)');

  if (bm === 'rock') {
    b += tlF(
      String.raw`q_R = \phi_b\,q_n\ ;\quad q_n = \left[\sqrt{s} + \sqrt{m\sqrt{s} + s}\right]q_u\ ;\quad m = m_i\,e^{(RMR - 100)/14}\ ;\quad s = e^{(RMR - 100)/6}\quad (\text{Điều 10.6.3.2.2 ; Bảng 10.4.6.4-4})`,
    );
  } else if (bm === 'lt') {
    b +=
      tlF(
        String.raw`q_R = \phi_b\,q_n\ ;\quad q_n = c\,N_{cm} + \gamma\,D_f\,N_{qm}\,C_{wq} + 0.5\,\gamma\,B'\,N_{\gamma m}\,C_{w\gamma}\quad (\text{PT 10.6.3.1.2a-1})`,
      ) +
      tlTx(
        'Móng băng (L ≫ B): Sc = Sq = Sγ = 1; tải trọng nghiêng theo phương B: n = 2; dq = 1; H, V là tải trọng không hệ số (SD I).',
      );
  } else if (bm === 'spt') {
    b += tlF(
      String.raw`q_R = \phi_b\,q_n\ ;\quad q_n = 3.2\cdot10^{-5}\,N_{corr}\,B'\left(C_{wq} + C_{w\gamma}\dfrac{D_f}{B'}\right)R_i\ (\text{MPa})\quad (\text{PT 10.6.3.1.3-1})`,
    );
  } else {
    b += tlTx('Sức kháng đỡ tính toán của nền lấy theo kết quả thí nghiệm.');
  }

  const rows8: string[][] = [
    rw('Lực thẳng đứng', 'V', (c) => c.N, 'kN', 2),
    rw('Độ lệch tâm', 'e', (c) => c.e, 'm'),
    ...(I.rock
      ? [rw('Ứng suất lớn nhất (phân bố tuyến tính)', 'σmax', (c) => c.sigB, 'kPa', 2)]
      : [
          rw('Bề rộng có hiệu', "B'", (c) => c.Bp, 'm'),
          rw("Ứng suất thẳng đứng (phân bố đều trên B')", 'σV', (c) => c.sigU, 'kPa', 2),
        ]),
  ];

  if (bm === 'rock') {
    const brR = (c: TlComboResult) => c.br as TcBearingRock;
    rows8.push(
      rw(
        'Cường độ nén một trục của đá ; RMR ; mi (nhóm ' + I.rockT + ')',
        'qu ; RMR ; mi',
        (c) => tf(brR(c).qu, 1) + ' ; ' + tf(brR(c).RMR, 0) + ' ; ' + tf(brR(c).mi, 0),
        'MPa ; ; ',
      ),
      rw(
        'Hằng số khối đá',
        'm ; s',
        (c) => tf(brR(c).m, 4) + ' ; ' + brR(c).s.toExponential(3),
        '',
      ),
      rw('Sức kháng danh định', 'qn', (c) => brR(c).qn, 'kPa', 1),
    );
  } else if (bm === 'lt') {
    const brT = (c: TlComboResult) => c.br as TcBearingTheoretical;
    rows8.push(
      rw(
        'Hệ số khả năng chịu tải (φf = ' + tf(I.phif, 1) + '°)',
        'Nc ; Nq ; Nγ',
        (c) => tf(brT(c).F.Nc, 2) + ' ; ' + tf(brT(c).F.Nq, 2) + ' ; ' + tf(brT(c).F.Ng, 2),
        '',
      ),
      rw(
        'Hệ số tải trọng nghiêng',
        'ic ; iq ; iγ',
        (c) => tf(brT(c).ic, 3) + ' ; ' + tf(brT(c).iq, 3) + ' ; ' + tf(brT(c).ig, 3),
        '',
      ),
      rw(
        'Hệ số mực nước ngầm',
        'Cwq ; Cwγ',
        (c) => tf(brT(c).Cwq, 2) + ' ; ' + tf(brT(c).Cwg, 2),
        '',
      ),
      rw('Sức kháng danh định', 'qn', (c) => brT(c).qn, 'kPa', 2),
    );
  } else if (bm === 'spt') {
    const brS = (c: TlComboResult) => c.br as TcBearingSpt;
    rows8.push(
      rw(
        'Số búa SPT ; số búa hiệu chỉnh',
        'N ; Ncorr',
        (c) => tf(brS(c).N, 0) + ' ; ' + tf(brS(c).Ncorr, 2),
        'búa',
      ),
      rw('Sức kháng danh định', 'qn', (c) => brS(c).qn, 'kPa', 2),
    );
  }
  rows8.push(
    rw(
      'Hệ số sức kháng',
      'φb',
      () => (bm === 'rock' ? I.phibR : bm === 'spt' ? I.phibS : bm === 'lt' ? I.phib : '-'),
      '',
      2,
    ),
    rw('Sức kháng đỡ tính toán', 'qR', (c) => c.br!.qR, 'kPa', 2),
    rw('Kiểm tra ' + (I.rock ? 'σmax' : 'σV') + ' ≤ qR', '', (c) => tlOk(Boolean(c.okB)), ''),
  );
  b +=
    tlTab(HD, rows8) +
    tlKL(
      R.ok.br,
      I.rock ? 'Nền đá ĐẢM BẢO sức kháng đỡ.' : 'Nền đất ĐẢM BẢO sức kháng đỡ.',
      I.rock
        ? 'Nền đá KHÔNG ĐẢM BẢO sức kháng đỡ.'
        : 'Nền đất KHÔNG ĐẢM BẢO sức kháng đỡ - cần mở rộng bản đáy hoặc gia cố nền.',
    );

  let sec = 9;
  if (an) {
    const tauMode = v('tl_tauA', '');
    b +=
      tlH2(`${sec}.&nbsp;&nbsp;KIỂM TOÁN NEO THÉP KHOAN VÀO NỀN ĐÁ`) +
      tlTx(
        `Thanh neo cốt thép Φ${tf(I.ad, 0)} (fy = ${tf(I.afy, 0)} MPa) đặt trong lỗ khoan đường kính Dh = ${tf(I.aDh, 0)} mm, bơm vữa xi măng cường độ f'c = ${tf(I.agf, 0)} MPa; chiều dài neo trong đá Lr = ${tf(I.aLr, 2)} m, chiều dài neo trong bản đáy La = ${tf(I.aLc, 2)} m. Bố trí ${an.rows.length} hàng neo tại x = ${an.rows.map((r) => tf(r.x, 2)).join(' ; ')} m, khoảng cách theo chiều dài tường ${tf(I.as, 2)} m.`,
      ) +
      tlSv('dgTlAn', 360, 'Hình 5. Bố trí neo thép khoan vào nền đá') +
      tlTx(
        '<b>a) Sức kháng kéo tính toán của một thanh neo</b> (TCVN 11823-11, Điều 9.4.2 ; hệ số sức kháng theo Điều 5.7: kéo thanh thép thường φs = 0,90; nhổ neo khỏi đá, giá trị dính bám tham khảo φp = 0,50).',
      ) +
      tlF(String.raw`T_r = \min\left(\phi_s\,A_s\,f_y\ ;\ \phi_p\,\pi\,D_h\,\tau_n\,L_r\right)`) +
      tlRow('Diện tích một thanh neo', 'As', tf(an.As, 1), 'mm²') +
      tlRow('Sức kháng kéo của thanh thép φs.As.fy', 'Trs', tf(an.Trs, 2), 'kN') +
      tlRow(
        'Cường độ dính bám danh định vữa - đá' +
          (tauMode === 'tay'
            ? ' (theo thí nghiệm)'
            : ' (tham khảo Bảng C11.9.4.2-1, cận dưới theo loại đá)'),
        'τn',
        tf(I.atau, 2),
        'MPa',
      ) +
      tlRow('Sức kháng nhổ neo khỏi đá φp.π.Dh.τn.Lr', 'Trp', tf(an.Trp, 2), 'kN') +
      tlRow('Sức kháng kéo tính toán của một thanh neo', 'Tr', tf(an.Tr, 2), 'kN') +
      tlRow(
        'Số thanh neo trên 1 m dài tường ; tổng sức kháng',
        'n ; ΣTr',
        tf(an.nT, 3) + ' ; ' + tf(an.sum, 2),
        '; kN',
      ) +
      tlTx(
        '<b>b) Chiều dài phát triển của thanh neo</b> (TCVN 11823-5, Điều 11.2.1.1): đoạn neo trong vữa và trong bản đáy không nhỏ hơn chiều dài phát triển cơ bản.',
      ) +
      tlF(
        String.raw`l_{db} = \max\left(\dfrac{0.02\,A_b\,f_y}{\sqrt{f'_c}}\ ;\ 0.06\,d_b\,f_y\right)`,
      ) +
      tlRow(
        "Chiều dài phát triển trong vữa (f'c = " +
          tf(I.agf, 0) +
          ' MPa) ; chiều dài neo trong đá',
        'ldb ; Lr',
        tf(an.ldg, 0) + ' ; ' + tf(I.aLr * 1000, 0),
        'mm',
        tlOk(an.okLg),
      ) +
      tlRow(
        "Chiều dài phát triển trong bản đáy (f'c = " +
          tf(I.fc, 0) +
          ' MPa) ; chiều dài neo trong bản đáy',
        'ldb ; La',
        tf(an.ldc, 0) + ' ; ' + tf(I.aLc * 1000, 0),
        'mm',
        tlOk(an.okLc),
      ) +
      tlKL(
        R.ok.an,
        'Neo thép ĐẠT YÊU CẦU về chiều dài neo.',
        'Neo thép KHÔNG ĐẠT về chiều dài neo - cần tăng chiều dài neo.',
      );
    sec++;
  }

  const M = R.M;
  const st = R.st;
  const Sf = R.Sf;
  b +=
    tlH2(`${sec}.&nbsp;&nbsp;KIỂM TOÁN TƯỜNG ĐỨNG BTCT - TCVN 11823-5`) +
    tlTx(
      `Bê tông f'c = ${tf(I.fc, 1)} MPa, Ec = ${tf(M.Ec, 1)} MPa, β1 = ${tf(M.b1, 3)}; cốt thép fy = ${tf(I.fy, 0)} MPa, Es = 200000 MPa. Tường đứng tính như công xôn ngàm tại đỉnh bản đáy; áp lực đất tác dụng lên lưng tường đứng (mặt phẳng từ chân đến đỉnh lưng tường, góc ma sát đất - tường δ = ${tf(I.dw, 1)}°) tính bằng nêm thử như mục 4.2.`,
    ) +
    tlSv('dgTlRC', 440, 'Hình 6. Vị trí các mặt cắt kiểm toán và bố trí cốt thép') +
    tlH3(`${sec}.1. Mặt cắt 1-1: chân tường đứng (h = ${tf(st.h * 1000, 0)} mm)`) +
    tlTx(
      `Lực đẩy chủ động trên lưng tường đứng Pa = ${tf(st.w.P, 2)} kN (Ka = ${tf(st.w.Ka, 4)}, cao ${tf(st.Hs, 3)} m)${st.PLS > 0 ? `; hoạt tải chất thêm PLS = ${tf(st.PLS, 2)} kN (heq = ${tf(st.heq, 3)} m)` : ''}. Mômen dương gây kéo mặt sau (phía đất đắp).`,
    ) +
    tlRC('1-1', st.Sb, M, st.rc, ['mặt sau (phía đất đắp)', 'mặt trước']);

  const fc = R.ifc;
  b +=
    tlH3(
      `${sec}.2. Ma sát cắt tại mối nối thi công chân tường đứng - đỉnh bản đáy (TCVN 11823-5, Điều 8.4)`,
    ) +
    tlF(
      String.raw`V_{ri} = \phi\,V_{ni} \ge V_u\ ;\quad V_{ni} = c\,A_{cv} + \mu\left(A_{vf} f_y + P_c\right) \le \min\left(K_1 f'_c A_{cv}\ ;\ K_2 A_{cv}\right)\quad (\text{PT 8.4.1-1, -2, -3})`,
    ) +
    tlTx(
      `Mặt tiếp xúc: ${fc.T.nm} - c = ${tf(fc.T.c, 2)} MPa, μ = ${tf(fc.T.mu, 1)}, K1 = ${tf(fc.T.K1, 2)}, K2 = ${tf(fc.T.K2, 1)} MPa (Điều 8.4.3). Avf: cốt thép đứng hai mặt tường đi qua mối nối; Pc: trọng lượng tường đứng (hệ số 0,9); φ = 0,90.`,
    ) +
    tlRow(
      'Diện tích mặt tiếp xúc ; diện tích cốt thép qua mối nối',
      'Acv ; Avf',
      tf(fc.Acv, 0) + ' ; ' + tf(fc.Avf, 1),
      'mm²',
    ) +
    tlRow('Lực nén thường xuyên vuông góc mặt tiếp xúc', 'Pc', tf(fc.Pc, 2), 'kN') +
    tlRow(
      "c.Acv + μ(Avf.fy + Pc) ; K1.f'c.Acv ; K2.Acv",
      'Vni',
      tf(fc.Vn1, 1) + ' ; ' + tf(fc.Vl1, 1) + ' ; ' + tf(fc.Vl2, 1),
      'kN',
    ) +
    tlRow(
      'Sức kháng cắt tính toán ; lực cắt tính toán',
      'Vri ; Vu',
      tf(fc.Vr, 2) + ' ; ' + tf(fc.Vu, 2),
      'kN',
      tlOk(fc.ok),
    ) +
    tlRow(
      'Cốt thép tối thiểu qua mối nối Avf ≥ 0,35.Acv/fy (Điều 8.4.4)',
      'Avf,min',
      tf(fc.Avmin, 1),
      'mm²',
      tlOk(fc.okMin),
    ) +
    tlKL(
      R.ok.stem && R.ok.ifc,
      'Tường đứng ĐẠT YÊU CẦU.',
      'Tường đứng KHÔNG ĐẠT - cần tăng chiều dày hoặc cốt thép.',
    );

  sec++;
  const fs = R.toe;
  const hs = R.heel;
  const desc = (o: TlFootBranchResult) =>
    tlTx(
      `Phản lực nền phân bố tuyến tính theo tải trọng tính toán (TCVN 11823-10, Điều 6.5): CĐ I-b q mũi = ${tf(o.Ib.pr.q1, 1)} kPa, q gót = ${tf(o.Ib.pr.q2, 1)} kPa; CĐ I-a q mũi = ${tf(o.Ia.pr.q1, 1)} kPa, q gót = ${tf(o.Ia.pr.q2, 1)} kPa.`,
    );
  b +=
    tlH2(`${sec}.&nbsp;&nbsp;KIỂM TOÁN BẢN ĐÁY BTCT - TCVN 11823-5`) +
    desc(fs) +
    tlH3(
      `${sec}.1. Mặt cắt 2-2: mũi bản đáy tại mép trước tường đứng (h = ${tf(I.hm * 1000, 0)} mm)`,
    ) +
    tlTx(
      `Phản lực nền trên mũi trừ trọng lượng bản thân mũi (hệ số 0,9 - có lợi): CĐ I-b M = ${tf(fs.Ib.Mr, 2)} − ${tf(fs.Ib.Md, 2)} = ${tf(fs.Ib.M, 2)} kN.m; V = ${tf(fs.Ib.V, 2)} kN (lấy tại mép tường, thiên về an toàn). Mômen dương gây kéo thớ dưới.`,
    ) +
    tlRC('2-2', Sf, M, fs.rc, ['thớ dưới', 'thớ trên']) +
    tlH3(
      `${sec}.2. Mặt cắt 3-3: gót bản đáy tại mép sau tường đứng (h = ${tf(I.hm * 1000, 0)} mm)`,
    ) +
    tlTx(
      `Tải trọng trên gót (bản thân, đất đắp, tải chất thêm, hoạt tải và thành phần đứng của áp lực đất tại mép gót) trừ phản lực nền dưới gót: CĐ I-b M = ${tf(-hs.Ib.M, 2)} kN.m, V = ${tf(hs.Ib.V, 2)} kN; CĐ I-a M = ${tf(-hs.Ia.M, 2)} kN.m, V = ${tf(hs.Ia.V, 2)} kN. Mômen âm gây kéo thớ trên.`,
    ) +
    tlRC('3-3', Sf, M, hs.rc, ['thớ dưới', 'thớ trên']) +
    tlKL(
      R.ok.toe && R.ok.heel,
      'Bản đáy ĐẠT YÊU CẦU.',
      'Bản đáy KHÔNG ĐẠT - cần tăng chiều dày hoặc cốt thép.',
    );

  sec++;
  const sS = R.shS;
  const sF = R.shF;
  b +=
    tlH2(`${sec}.&nbsp;&nbsp;CỐT THÉP CHỐNG CO NGÓT VÀ NHIỆT ĐỘ - TCVN 11823-5, ĐIỀU 10.8`) +
    tlF(
      String.raw`A_s \ge \dfrac{0.75\,b\,h}{2\,(b + h)\,f_y}\ ;\quad 0.233 \le A_s \le 1.27\ (\text{mm}^2/\text{mm})\ ;\quad s \le \min(3h\ ;\ 450\ \text{mm})`,
    ) +
    tlTab(
      [
        'Bộ phận',
        'b ; h (mm)',
        'Cốt thép mỗi mặt',
        'As (mm²/mm)',
        'As yêu cầu (mm²/mm)',
        's ; smax (mm)',
        'Kết quả',
      ],
      [
        [
          'Tường đứng - cốt thép nằm ngang',
          tf(I.H * 1000, 0) + ' ; ' + tf(((I.t + g.tb) / 2) * 1000, 0),
          `Φ${tf(I.hd, 0)} a ${tf(I.hs, 0)}`,
          tf(sS.As, 3),
          tf(sS.req, 3),
          tf(sS.s, 0) + ' ; ' + tf(sS.smax, 0),
          tlOk(sS.ok),
        ],
        [
          'Bản đáy - cốt thép dọc tường',
          tf(g.B * 1000, 0) + ' ; ' + tf(I.hm * 1000, 0),
          `Φ${tf(I.ld, 0)} a ${tf(I.ls, 0)}`,
          tf(sF.As, 3),
          tf(sF.req, 3),
          tf(sF.s, 0) + ' ; ' + tf(sF.smax, 0),
          tlOk(sF.ok),
        ],
      ],
    ) +
    tlKL(
      R.ok.sh,
      'Cốt thép phân bố ĐẠT YÊU CẦU.',
      'Cốt thép phân bố KHÔNG ĐẠT - cần tăng đường kính hoặc giảm khoảng cách.',
    );

  sec++;
  b +=
    tlH2(`${sec}.&nbsp;&nbsp;CÁC KIỂM TRA KHÁC`) +
    tlTx(
      '- Ổn định tổng thể (TCVN 11823-11, Điều 6.3.4 dẫn Điều 6.2.3): kiểm tra bằng phân tích ổn định mái dốc khi tường đặt trên sườn dốc hoặc nền yếu.',
    ) +
    tlTx(
      I.rock
        ? '- Nền đá có khe nứt nghiêng về phía mặt tự do phải kiểm tra thêm ổn định trượt theo mặt yếu.'
        : '- Lún (TTGH sử dụng, TCVN 11823-10, Điều 6.2): tính riêng khi nền đất dính hoặc có lớp đất yếu.',
    ) +
    tlTx(
      '- Động đất: chưa xét (bổ sung theo TCVN 11823-11, Điều 6.5 và Phụ lục A khi công trình yêu cầu).',
    );

  sec++;
  const SUM: Array<[string, string, boolean]> = [
    ['Độ lệch tâm của hợp lực', 'TCVN 11823-11, Điều 6.3.3', R.ok.e],
    ['Trượt theo đáy móng', 'TCVN 11823-10, Điều 6.3.4', R.ok.sl],
    ['Sức kháng đỡ của nền', 'TCVN 11823-10, Điều 6.3.1, 6.3.2', R.ok.br],
    ...(an ? ([['Chiều dài neo thép vào đá', 'TCVN 11823-5, Điều 11.2.1.1', R.ok.an]] as Array<[string, string, boolean]>) : []),
    ['Tường đứng: uốn, cốt thép tối thiểu, nứt, cắt', 'TCVN 11823-5, Điều 7.3, 8.3', R.ok.stem],
    ['Ma sát cắt mối nối chân tường', 'TCVN 11823-5, Điều 8.4', R.ok.ifc],
    ['Bản đáy - mũi: uốn, cốt thép tối thiểu, nứt, cắt', 'TCVN 11823-5, Điều 7.3, 8.3', R.ok.toe],
    ['Bản đáy - gót: uốn, cốt thép tối thiểu, nứt, cắt', 'TCVN 11823-5, Điều 7.3, 8.3', R.ok.heel],
    ['Cốt thép co ngót và nhiệt độ', 'TCVN 11823-5, Điều 10.8', R.ok.sh],
  ];
  b +=
    tlH2(`${sec}.&nbsp;&nbsp;TỔNG HỢP KẾT QUẢ KIỂM TOÁN`) +
    tlTab(
      ['STT', 'Hạng mục kiểm toán', 'Căn cứ', 'Kết quả'],
      SUM.map((r, i) => [String(i + 1), r[0], r[1], tlOk(r[2])]),
    ) +
    `<p class="kl ${R.ok.all ? 'ok' : 'bad'}">KẾT LUẬN CHUNG: ${R.ok.all ? 'TƯỜNG CHẮN ĐẠT YÊU CẦU THEO TẤT CẢ CÁC HẠNG MỤC KIỂM TOÁN.' : 'TƯỜNG CHẮN KHÔNG ĐẠT - XEM CÁC HẠNG MỤC KHÔNG ĐẠT Ở BẢNG TRÊN.'}</p>`;
  set('o_tl_B', b);

  try {
    const hooks = getVisualHooks();
    hooks.renderCantileverWall?.({ result: R });
    hooks.renderMath?.();
  } catch (e) {
    console.error(e);
  }
  return R;
}

export function toCantileverWallResult(R: TlResult): RetainingWallResult {
  return {
    variant: 'cantilever-l',
    eLim: R.eLim,
    brm: R.brm,
    Ia: R.Ia as unknown as Record<string, unknown>,
    Ib: R.Ib as unknown as Record<string, unknown>,
    SD: R.SD as unknown as Record<string, unknown>,
    anchor: R.an
      ? {
          n: R.an.nT,
          d: R.I.ad,
          As: R.an.As,
          TrSteel: R.an.Trs,
          TrBond: R.an.Trp,
          Tr: R.an.Tr,
          ldbGrout: R.an.ldg,
          ldbCap: R.an.ldc,
          okLr: R.an.okLg,
          okLc: R.an.okLc,
          mu: R.I.amu,
          sum: R.an.sum,
        }
      : null,
    iface: {
      Vr: R.ifc.Vr,
      Vu: R.ifc.Vu,
      Avf: R.ifc.Avf,
      AvfMin: R.ifc.Avmin,
      ok: R.ifc.ok,
      okMin: R.ifc.okMin,
    },
    ok: {
      e: R.ok.e,
      sl: R.ok.sl,
      br: R.ok.br,
      stem: R.ok.stem,
      toe: R.ok.toe,
      heel: R.ok.heel,
      ifc: R.ok.ifc,
      sh: R.ok.sh,
      an: R.ok.an,
      all: R.ok.all,
    },
  };
}
