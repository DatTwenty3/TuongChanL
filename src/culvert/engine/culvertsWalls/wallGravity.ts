/**
 * BangTinhCauCong Web App — Gravity Retaining Wall Solver (`TC`).
 *
 * Exact clean-room TypeScript port of:
 *  - `TC` (`06_retaining_wall_gravity.js:1-715`) — TCVN 11823:2017 + TCVN 5573:2011
 *  - `TC_LIB`, `TC_LIB86` (TKĐH 86-06X), `TC_B7`, `TC_MV`, `TC_B9`, `TC_PRE`, `TC_SREF`,
 *    `TC86G`, `TC_U2T`, `tcInputs`, `tcStep`, `tcSref`, `tcSrefInit`, `tcFmatDef`,
 *    `tcMatDef`, `tc86Tab`, `tc86Row`, `tc86Inputs`, `tc86Txt`, `tcPre`, `tc86Shape`,
 *    and R12 DXF builder `tcDxf` (`06_retaining_wall_gravity.js:717-3762, 5112-5654`).
 *
 * Coordinate origin `O` at front toe bottom `(0, 0)`, `+x` into backfill, `+y` up.
 * Units: kN, m, kPa (material inputs `R`, `Rku`, `Rc`, `Rbtf`, `fRku`, `fRc`, `qu` in MPa).
 */

import type { Point2D, RetainingWallResult, TcLib86GroupCode } from '../../types/project';
import { $, cls, getVisualHooks, num, set, sv, tf, v } from '../context';

// ---------------------------------------------------------------------------
// 1. Domain Interfaces
// ---------------------------------------------------------------------------

export interface TcGeometry {
  yT: number;
  xfb: number;
  xft: number;
  xbt: number;
  xbb: number;
  B: number;
  dy: number;
  eps: number;
  Bs: number;
  C0: Point2D;
  xf: (y: number) => number;
  xb: (y: number) => number;
  base: (x: number) => number;
  foot: Point2D[];
  stem: Point2D[];
  cap: Point2D[] | null;
  A: Point2D;
  virt: boolean;
  ev: Point2D[] | null;
  T: Point2D;
  Hp: number;
}

export interface TcWedgeResult {
  P: number;
  rho: number | null;
  W: number;
  C: Point2D | null;
  Hp: number;
  L: number;
  F: [number, number];
  dP: [number, number];
  theta: number;
  Ka: number;
}

export interface TcLoadItem {
  nm: string;
  ty: 'DC' | 'EV' | 'EH' | 'ES' | 'LSh' | 'LSv';
  Fx: number;
  Fy: number;
  x: number;
  y: number;
  A?: number;
  g?: number;
  P?: number;
}

export interface TcLoadsBundle {
  L: TcLoadItem[];
  w0: TcWedgeResult;
  wq: TcWedgeResult | null;
  heq: number;
  lsOn: boolean;
  lsW: boolean;
  PLS: number;
}

export interface TcComboSpec {
  k: 'Ia' | 'Ib' | 'SD';
  nm: string;
  f: Record<'DC' | 'EV' | 'EH' | 'ES' | 'LSh' | 'LSv', number>;
  mn: Partial<Record<'DC' | 'EV' | 'EH' | 'ES' | 'LSh' | 'LSv', number>>;
  sd?: boolean;
}

export interface TcBearingTheoretical {
  F: { Nc: number; Nq: number; Ng: number };
  Df: number;
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
  H: number;
  V: number;
  given?: boolean;
}

export interface TcBearingSpt {
  spt: true;
  Df: number;
  sv: number;
  CN: number;
  Ncorr: number;
  N: number;
  Ri: number;
  Cwq: number;
  Cwg: number;
  qn: number;
  qR: number;
  Bp: number;
  given?: boolean;
}

export interface TcBearingRock {
  rockM: true;
  qu: number;
  RMR: number;
  mi: number;
  m: number;
  s: number;
  k: number;
  qn: number;
  phib: number;
  qR: number;
  given?: boolean;
}

export type TcBearingResult = TcBearingTheoretical | TcBearingSpt | TcBearingRock;

export interface TcBambooResult {
  n: number;
  D: number;
  L: number;
  V: number;
  R1: number;
  Qgh: number;
  nTab: number;
  m: number;
  F: number;
  Qct: number;
  Rct: number;
  qR: number;
}

export interface TcComboResult {
  k: 'Ia' | 'Ib' | 'SD';
  nm: string;
  sd: boolean;
  Fx: number;
  Fy: number;
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
  sigU: number;
  sigMax: number;
  sigMin: number;
  sl: { Rt: number; RR: number; ok: boolean };
  br?: TcBearingResult;
  sigB: number;
  okB0: boolean;
  okB: boolean;
  ct?: TcBambooResult;
}

export interface TcStemComboCheck {
  ok1: boolean;
  Nr: number;
  okN: boolean;
  sk: number;
  need: boolean;
  lim: number;
  okk: boolean;
}

export interface TcStemSectionResult {
  nm: string;
  ys: number;
  z: number;
  h: number;
  A: number;
  W: number;
  y: number;
  Ib: { N: number; Q: number; M: number; e0: number };
  Ia: { N: number; Q: number; M: number; e0: number };
  cIb: TcStemComboCheck;
  cIa: TcStemComboCheck;
  s0: number;
  Qr: number;
  okQ: boolean;
  Qr2: number;
  ok: boolean;
}

export interface TcFootCutResult {
  nm: string;
  x: number;
  t: number;
  Lq: number;
  Qr: number;
  Mr: number;
  Qd: number;
  Md: number;
  Q: number;
  M: number;
  W: number;
  st: number;
  tau: number;
  ok: boolean;
}

export interface TcInput {
  H: number;
  b0: number;
  n1: number;
  n2: number;
  hc: number;
  a1: number;
  a2: number;
  t1: number;
  t2: number;
  hf: number;
  m: number;
  Hs: number;
  q: number;
  LL: boolean;
  dT: number;
  dT0?: number;
  gs: number;
  phi: number;
  delta: number;
  cs: number;
  gm: number;
  gb: number;
  stemMat: 'm' | 'c' | string;
  R: number;
  Rku: number;
  Rc: number;
  gr: number;
  nsh: number;
  mu: number;
  md: number;
  phi1: number;
  Rbtf: number;
  footMat: 'm' | 'c' | string;
  gfm: number;
  gf0?: number;
  fRku: number;
  fRc: number;
  gf: number;
  phif: number;
  cf: number;
  soil: string;
  Su: number;
  Dw: number;
  rock: boolean;
  brmR: string;
  qu: number;
  RMR: number;
  rockT: string;
  phibR: number;
  phib: number;
  phit: number;
  qRu: number;
  eta: number;
  brm: string;
  Nspt: number;
  Ri: number;
  phibS: number;
  ctD: number;
  ctL: number;
  ctn: number;
  ctm: number;
  ctF: number;
}

export interface TcResult {
  I: TcInput;
  g: TcGeometry;
  Ld: TcLoadsBundle;
  C: TcComboResult[];
  Ia: TcComboResult;
  Ib: TcComboResult;
  SD: TcComboResult;
  eLim: number;
  secs: TcStemSectionResult[];
  foot: {
    sig: number;
    list: TcFootCutResult[];
    Rbt: number;
    Rsh: number;
    mas: boolean;
  };
  coul: number;
  ok: {
    brm: string;
    ct: boolean;
    br0: boolean;
    e: boolean;
    sl: boolean;
    br: boolean;
    stem: boolean;
    foot: boolean;
    all: boolean;
  };
}

// ---------------------------------------------------------------------------
// 2. Core Gravity Retaining Wall Solver (`TC` — 06_retaining_wall_gravity.js:1-715)
// ---------------------------------------------------------------------------

const rad = (d: number): number => (d * Math.PI) / 180;
const deg = (r: number): number => (r * 180) / Math.PI;

export function tcArea(P: ReadonlyArray<Point2D>): number {
  let a = 0;
  for (let i = 0; i < P.length; i++) {
    const p = P[i];
    const q = P[(i + 1) % P.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

export function tcCent(P: ReadonlyArray<Point2D>): { A: number; x: number; y: number } {
  const A = tcArea(P);
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < P.length; i++) {
    const p = P[i];
    const q = P[(i + 1) % P.length];
    const c = p[0] * q[1] - q[0] * p[1];
    cx += (p[0] + q[0]) * c;
    cy += (p[1] + q[1]) * c;
  }
  return { A: Math.abs(A), x: cx / (6 * A), y: cy / (6 * A) };
}

export function tcClipY(P: ReadonlyArray<Point2D>, yc: number, keepAbove: boolean): Point2D[] {
  const out: Point2D[] = [];
  const ins = (p: Point2D) => (keepAbove ? p[1] >= yc - 1e-12 : p[1] <= yc + 1e-12);
  for (let i = 0; i < P.length; i++) {
    const a = P[i];
    const b = P[(i + 1) % P.length];
    const ia = ins(a);
    const ib = ins(b);
    if (ia) out.push(a);
    if (ia !== ib) {
      const t = (yc - a[1]) / (b[1] - a[1]);
      out.push([a[0] + t * (b[0] - a[0]), yc]);
    }
  }
  return out;
}

export function tcNfac(phi: number): { Nc: number; Nq: number; Ng: number } {
  if (phi <= 1e-9) return { Nc: 5.14, Nq: 1, Ng: 0 };
  const t = Math.tan(rad(phi));
  const Nq = Math.exp(Math.PI * t) * Math.tan(rad(45 + phi / 2)) ** 2;
  return { Nc: (Nq - 1) / t, Nq, Ng: 2 * (Nq + 1) * t };
}

const HEQ: ReadonlyArray<readonly [number, number, number]> = [
  [1.5, 1.5, 0.6],
  [3.0, 1.05, 0.6],
  [6.0, 0.6, 0.6],
];

export function tcHeqOf(H: number, d: number): number {
  const col = (h: number, i: 1 | 2): number => {
    if (h <= HEQ[0][0]) return HEQ[0][i];
    if (h >= HEQ[2][0]) return HEQ[2][i];
    for (let k = 0; k < 2; k++) {
      const a = HEQ[k];
      const b = HEQ[k + 1];
      if (h <= b[0]) return a[i] + ((b[i] - a[i]) * (h - a[0])) / (b[0] - a[0]);
    }
    return HEQ[2][i];
  };
  const h0 = col(H, 1);
  const h3 = col(H, 2);
  return d >= 0.3 ? h3 : h0 + ((h3 - h0) * d) / 0.3;
}

function ground(I: { Hs: number; m: number }, T: Point2D): Point2D[] {
  const pts: Point2D[] = [[T[0], T[1]]];
  if (I.Hs > 1e-9) pts.push([T[0] + I.m * I.Hs, T[1] + I.Hs]);
  return pts;
}

export function tcWedge(
  A: Point2D,
  T: Point2D,
  G: ReadonlyArray<Point2D>,
  gs: number,
  phi: number,
  delta: number,
  q: number,
  x0?: number | null,
  cc?: number,
): TcWedgeResult {
  const x0Eff = x0 == null ? T[0] : x0;
  const ccEff = cc || 0;
  const Hp = T[1] - A[1];
  const L = Math.hypot(T[0] - A[0], Hp);
  const vVec: Point2D = [(T[0] - A[0]) / L, Hp / L];
  const nw: Point2D = [vVec[1], -vVec[0]];
  const dl = rad(delta);
  const ph = rad(phi);
  const dP: [number, number] = [
    Math.cos(dl) * nw[0] + Math.sin(dl) * vVec[0],
    Math.cos(dl) * nw[1] + Math.sin(dl) * vVec[1],
  ];
  const angAT = Math.atan2(Hp, T[0] - A[0]);

  const hit = (r: number): { pt: Point2D; k: number } | null => {
    const u: Point2D = [Math.cos(r), Math.sin(r)];
    for (let k = 0; k < G.length; k++) {
      const p = G[k];
      const last = k === G.length - 1;
      const p2: Point2D = last ? [p[0] + 1e6, p[1]] : G[k + 1];
      const dx = p2[0] - p[0];
      const dy = p2[1] - p[1];
      const det = u[0] * -dy - u[1] * -dx;
      if (Math.abs(det) < 1e-14) continue;
      const rx = p[0] - A[0];
      const ry = p[1] - A[1];
      const s = (rx * -dy - ry * -dx) / det;
      const t = (u[0] * ry - u[1] * rx) / det;
      if (s > 0 && t >= -1e-9 && t <= 1 + 1e-9) {
        return { pt: [A[0] + s * u[0], A[1] + s * u[1]], k };
      }
    }
    return null;
  };

  let best: { P: number; rho: number | null; W: number; C: Point2D | null } = {
    P: -Infinity,
    rho: null,
    W: 0,
    C: null,
  };

  for (let rd = phi + 0.05; rd < deg(angAT) - 0.02; rd += 0.05) {
    const r = rad(rd);
    const h = hit(r);
    if (!h) continue;
    const poly: Point2D[] = [A, T];
    for (let k = 1; k <= h.k; k++) poly.push(G[k]);
    poly.push(h.pt);
    const W = gs * Math.abs(tcArea(poly)) + q * Math.max(0, h.pt[0] - Math.max(T[0], x0Eff));
    const u: Point2D = [Math.cos(r), Math.sin(r)];
    const n: Point2D = [-Math.sin(r), Math.cos(r)];
    const dR: Point2D = [
      Math.cos(ph) * n[0] + Math.sin(ph) * u[0],
      Math.cos(ph) * n[1] + Math.sin(ph) * u[1],
    ];
    const Lf = Math.hypot(h.pt[0] - A[0], h.pt[1] - A[1]);
    const Fx = ccEff * Lf * u[0];
    const Fy = -W + ccEff * Lf * u[1];
    const det = dP[0] * dR[1] - dP[1] * dR[0];
    const P = (-Fx * dR[1] - -Fy * dR[0]) / det;
    if (P > best.P) best = { P, rho: rd, W, C: h.pt };
  }

  if (best.P < 0) best.P = 0;
  const F: [number, number] = [-best.P * dP[0], -best.P * dP[1]];
  return {
    P: best.P,
    rho: best.rho,
    W: best.W,
    C: best.C,
    Hp,
    L,
    F,
    dP,
    theta: deg(angAT),
    Ka: (2 * best.P) / (gs * Hp * Hp),
  };
}

export function tcCoulomb(theta: number, phi: number, delta: number, beta: number): number {
  const t = rad(theta);
  const f = rad(phi);
  const d = rad(delta);
  const b = rad(beta);
  if (phi - beta < 0) return NaN;
  const G =
    (1 + Math.sqrt((Math.sin(f + d) * Math.sin(f - b)) / (Math.sin(t - d) * Math.sin(t + b)))) ** 2;
  return Math.sin(t + f) ** 2 / (G * Math.sin(t) ** 2 * Math.sin(t - d));
}

export function tcGeom(I: TcInput): TcGeometry {
  const yT = I.t1 + I.H;
  const xfb = I.a1;
  const xft = I.a1 + I.n1 * I.H;
  const xbt = xft + I.b0;
  const xbb = xbt + I.n2 * I.H;
  const B = xbb + I.a2;
  const dy = I.t2 - I.t1;
  const eps = Math.atan2(dy, B);
  const Bs = B / Math.cos(eps);
  const C0: Point2D = [B / 2, -dy / 2];
  const xf = (y: number) => I.a1 + I.n1 * (y - I.t1);
  const xb = (y: number) => xbb - I.n2 * (y - I.t1);
  const base = (x: number) => (-dy * x) / B;
  const foot: Point2D[] = [
    [0, 0],
    [0, I.t1],
    [B, I.t1],
    [B, -dy],
  ];
  const yc = yT - I.hc;
  const stem: Point2D[] = [
    [xfb, I.t1],
    [xbb, I.t1],
    [xb(yc), yc],
    [xf(yc), yc],
  ];
  const cap: Point2D[] | null =
    I.hc > 1e-9
      ? [
          [xf(yc), yc],
          [xb(yc), yc],
          [xbt, yT],
          [xft, yT],
        ]
      : null;

  const A0: Point2D = [B, -dy];
  const T: Point2D = [xbt, yT];
  const xp = A0[0] + ((T[0] - A0[0]) * (I.t1 - A0[1])) / (T[1] - A0[1]);
  let A: Point2D;
  let virt: boolean;
  let ev: Point2D[] | null;

  if (xp >= xbb - 1e-9) {
    A = A0;
    virt = true;
    ev = xp > xbb + 1e-9 ? [[xbb, I.t1], [xp, I.t1], T] : null;
  } else {
    const k = (xbb - xbt) / (I.t1 - yT);
    let lo = -dy - 1;
    let hi = I.t1;
    for (let i = 0; i < 60; i++) {
      const m = (lo + hi) / 2;
      const xx = xbb + k * (m - I.t1);
      if (m > base(xx)) lo = m;
      else hi = m;
    }
    const yb = (lo + hi) / 2;
    A = [xbb + k * (yb - I.t1), yb];
    virt = false;
    ev = null;
  }

  return {
    yT,
    xfb,
    xft,
    xbt,
    xbb,
    B,
    dy,
    eps,
    Bs,
    C0,
    xf,
    xb,
    base,
    foot,
    stem,
    cap,
    A,
    virt,
    ev,
    T,
    Hp: yT - A[1],
  };
}

export function tcLoads(I: TcInput, g: TcGeometry): TcLoadsBundle {
  const L: TcLoadItem[] = [];
  const add = (
    nm: string,
    ty: TcLoadItem['ty'],
    FVec: [number, number],
    pt: Point2D,
    ex?: { A?: number; g?: number; P?: number },
  ) => L.push({ nm, ty, Fx: FVec[0], Fy: FVec[1], x: pt[0], y: pt[1], ...(ex || {}) });

  const cs = tcCent(g.stem);
  const cf = tcCent(g.foot);
  add(
    I.stemMat === 'c' ? 'Thân tường (bê tông)' : 'Thân tường (đá hộc xây)',
    'DC',
    [0, -I.gm * cs.A],
    [cs.x, cs.y],
    { A: cs.A, g: I.gm },
  );
  if (g.cap) {
    const cc = tcCent(g.cap);
    add('Mũ tường (bê tông)', 'DC', [0, -I.gb * cc.A], [cc.x, cc.y], { A: cc.A, g: I.gb });
  }
  const gf0 = I.gf0 ?? (I.footMat === 'm' ? (I.gfm > 0 ? I.gfm : I.gm) : I.gb);
  add(
    I.footMat === 'm' ? 'Móng (đá hộc xây)' : 'Móng (bê tông)',
    'DC',
    [0, -gf0 * cf.A],
    [cf.x, cf.y],
    { A: cf.A, g: gf0 },
  );
  if (g.ev) {
    const ce = tcCent(g.ev);
    add(
      'Đất đắp trên gót móng (trong mặt phẳng tính áp lực)',
      'EV',
      [0, -I.gs * ce.A],
      [ce.x, ce.y],
      { A: ce.A, g: I.gs },
    );
  }
  const G = ground(I, g.T);
  const w0 = tcWedge(g.A, g.T, G, I.gs, I.phi, I.delta, 0, null, I.cs);
  const pt = (f: number): Point2D => [g.A[0] + (g.T[0] - g.A[0]) * f, g.A[1] + g.Hp * f];
  add('Áp lực đất chủ động', 'EH', w0.F, pt(1 / 3), { P: w0.P });

  let wq: TcWedgeResult | null = null;
  if (I.q > 1e-9) {
    wq = tcWedge(g.A, g.T, G, I.gs, I.phi, I.delta, I.q, G[G.length - 1][0], I.cs);
    const dP = wq.P - w0.P;
    add('Tải trọng chất thêm đều q', 'ES', [-dP * w0.dP[0], -dP * w0.dP[1]], pt(1 / 2), { P: dP });
  }

  const heq = tcHeqOf(g.Hp, I.dT);
  const lsOn = Boolean(I.LL && I.dT <= g.Hp / 2 + 1e-9);
  const lsW = I.Hs > 1e-9;
  const PLS = !lsOn
    ? 0
    : lsW
      ? Math.max(
          0,
          tcWedge(g.A, g.T, G, I.gs, I.phi, I.delta, I.gs * heq, g.T[0] + I.dT, I.cs).P - w0.P,
        )
      : w0.Ka * I.gs * heq * g.Hp;

  if (lsOn) {
    add('Hoạt tải chất thêm LS - thành phần ngang', 'LSh', [-PLS * w0.dP[0], 0], pt(1 / 2), {
      P: PLS,
    });
    add('Hoạt tải chất thêm LS - thành phần đứng', 'LSv', [0, -PLS * w0.dP[1]], pt(1 / 2), {
      P: PLS,
    });
  }
  return { L, w0, wq, heq, lsOn, lsW, PLS };
}

export const TC_COMB: readonly TcComboSpec[] = [
  {
    k: 'Ia',
    nm: 'CĐ I-a (tải đứng min, tải ngang max)',
    f: { DC: 0.9, EV: 1.0, EH: 1.5, ES: 1.5, LSh: 1.75, LSv: 0 },
    mn: { DC: 1, EV: 1 },
  },
  {
    k: 'Ib',
    nm: 'CĐ I-b (tải trọng max)',
    f: { DC: 1.25, EV: 1.35, EH: 1.5, ES: 1.5, LSh: 1.75, LSv: 1.75 },
    mn: {},
  },
  {
    k: 'SD',
    nm: 'SD I',
    f: { DC: 1, EV: 1, EH: 1, ES: 1, LSh: 1, LSv: 1 },
    mn: {},
    sd: true,
  },
];

function combineLoads(L: readonly TcLoadItem[], g: TcGeometry, c: TcComboSpec, eta: number) {
  const f = (t: TcLoadItem['ty']) => (c.sd ? 1 : c.mn[t] ? 1 / eta : eta) * c.f[t];
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
  const se = Math.sin(g.eps);
  const ce = Math.cos(g.eps);
  const N = -(Fx * se + Fy * ce);
  const Hd = -Fx * ce + Fy * se;
  const s = -M / N;
  return {
    k: c.k,
    nm: c.nm,
    sd: Boolean(c.sd),
    Fx,
    Fy,
    V: -Fy,
    H: -Fx,
    M,
    N,
    Hd,
    s,
    e: Math.abs(s),
    toToe: s < 0,
  };
}

export interface TcBearingInputLike {
  phif: number;
  cf: number;
  gf: number;
  Dw: number;
  t1: number;
  hf: number;
  phib: number;
}

export function tcBearing(
  I: TcBearingInputLike,
  _g: unknown,
  Bp: number,
  Hsd: number,
  Vsd: number,
): TcBearingTheoretical {
  const F = tcNfac(I.phif);
  const Df = I.t1 + I.hf;
  const n = 2;
  const t = I.phif > 1e-9 ? Math.tan(rad(I.phif)) : 0;
  const den = Vsd + (I.phif > 1e-9 ? (I.cf * Bp * 1) / t : 0);
  const iq = I.phif > 1e-9 ? Math.pow(Math.max(0, 1 - Hsd / den), n) : 1;
  const ig = I.phif > 1e-9 ? Math.pow(Math.max(0, 1 - Hsd / den), n + 1) : 1;
  const ic =
    I.phif > 1e-9
      ? iq - (1 - iq) / (F.Nq - 1)
      : Math.max(0, 1 - (n * Hsd) / (Math.max(I.cf, 1e-9) * Bp * 1 * F.Nc));
  const Dw = I.Dw;
  const Cwq = Dw >= Df ? 1 : Dw <= 0 ? 0.5 : 0.5 + (0.5 * Dw) / Df;
  const Cwg = Dw <= Df ? 0.5 : Dw >= 1.5 * Bp + Df ? 1 : 0.5 + (0.5 * (Dw - Df)) / (1.5 * Bp);
  const Ncm = F.Nc * ic;
  const Nqm = F.Nq * iq;
  const Ngm = F.Ng * ig;
  const qn = I.cf * Ncm + I.gf * Df * Nqm * Cwq + 0.5 * I.gf * Bp * Ngm * Cwg;
  return {
    F,
    Df,
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
    qR: I.phib * qn,
    Bp,
    H: Hsd,
    V: Vsd,
  };
}

export interface TcBearingSptInputLike {
  t1: number;
  hf: number;
  gf: number;
  Nspt: number;
  Dw: number;
  Ri: number;
  phibS: number;
}

export function tcBearingSPT(I: TcBearingSptInputLike, _g: unknown, Bp: number): TcBearingSpt {
  const Df = I.t1 + I.hf;
  const svVal = Math.max(I.gf * Df, 1) / 1000;
  const CN = Math.min(2, 0.77 * Math.log10(1.92 / svVal));
  const Nc = CN * I.Nspt;
  const Dw = I.Dw;
  const Cwq = Dw >= Df ? 1 : Dw <= 0 ? 0.5 : 0.5 + (0.5 * Dw) / Df;
  const Cwg = Dw <= Df ? 0.5 : Dw >= 1.5 * Bp + Df ? 1 : 0.5 + (0.5 * (Dw - Df)) / (1.5 * Bp);
  const qn = 3.2e-5 * Nc * Bp * 1000 * (Cwq + (Cwg * Df) / Bp) * I.Ri * 1000;
  return {
    spt: true,
    Df,
    sv: svVal,
    CN,
    Ncorr: Nc,
    N: I.Nspt,
    Ri: I.Ri,
    Cwq,
    Cwg,
    qn,
    qR: I.phibS * qn,
    Bp,
  };
}

export const TC_MI: Readonly<Record<string, number>> = { A: 7, B: 10, C: 15, D: 17, E: 25 };

export interface TcBearingRockInputLike {
  rockT: string;
  RMR: number;
  qu: number;
  phibR: number;
}

export function tcBearingRock(I: TcBearingRockInputLike): TcBearingRock {
  const mi = TC_MI[I.rockT] || 10;
  const RMR = Math.max(0, Math.min(100, I.RMR));
  const m = mi * Math.exp((RMR - 100) / 14);
  const s = Math.exp((RMR - 100) / 6);
  const k = Math.sqrt(s) + Math.sqrt(m * Math.sqrt(s) + s);
  const qn = k * I.qu * 1000;
  return { rockM: true, qu: I.qu, RMR, mi, m, s, k, qn, phib: I.phibR, qR: I.phibR * qn };
}

export const TC_QGH: ReadonlyArray<readonly [number, number]> = [
  [16, 0.44],
  [25, 0.46],
  [36, 0.48],
  [49, 0.38],
];

function bamboo(I: TcInput, qR: number): TcBambooResult {
  const n = I.ctn;
  const row = TC_QGH.filter((r) => r[0] <= n).pop() || TC_QGH[0];
  const V = (n * Math.PI * I.ctD * I.ctD) / 4;
  const R1 = qR / (1 - V);
  const Qct = (I.ctm / I.ctF) * row[1] * 9.81;
  const Rct = R1 + n * Qct;
  return {
    n,
    D: I.ctD,
    L: I.ctL,
    V,
    R1,
    Qgh: row[1],
    nTab: row[0],
    m: I.ctm,
    F: I.ctF,
    Qct,
    Rct,
    qR,
  };
}

function stemSec(I: TcInput, g: TcGeometry, ys: number, nm: string): TcStemSectionResult {
  const top = tcClipY(g.stem, ys, true);
  const capP = g.cap ? tcClipY(g.cap, ys, true) : [];
  const h = g.xb(ys) - g.xf(ys);
  const xc = (g.xf(ys) + g.xb(ys)) / 2;
  const L: Array<{ ty: TcLoadItem['ty']; Fx: number; Fy: number; x: number; y: number }> = [];
  const cs = top.length > 2 ? tcCent(top) : null;
  if (cs) L.push({ ty: 'DC', Fx: 0, Fy: -I.gm * cs.A, x: cs.x, y: cs.y });
  if (capP.length > 2) {
    const cc = tcCent(capP);
    L.push({ ty: 'DC', Fx: 0, Fy: -I.gb * cc.A, x: cc.x, y: cc.y });
  }
  const A: Point2D = [g.xb(ys), ys];
  const G = ground(I, g.T);
  const w = tcWedge(A, g.T, G, I.gs, I.phi, I.delta, 0, null, I.cs);
  const Hs = g.yT - ys;
  const pt = (f: number): Point2D => [A[0] + (g.T[0] - A[0]) * f, ys + Hs * f];
  L.push({ ty: 'EH', Fx: w.F[0], Fy: w.F[1], x: pt(1 / 3)[0], y: pt(1 / 3)[1] });
  if (I.q > 1e-9) {
    const wq = tcWedge(A, g.T, G, I.gs, I.phi, I.delta, I.q, G[G.length - 1][0], I.cs);
    const d = wq.P - w.P;
    L.push({ ty: 'ES', Fx: -d * w.dP[0], Fy: -d * w.dP[1], x: pt(0.5)[0], y: pt(0.5)[1] });
  }
  const heq = tcHeqOf(g.Hp, I.dT);
  if (I.LL && I.dT <= g.Hp / 2 + 1e-9) {
    const P =
      I.Hs > 1e-9
        ? Math.max(
            0,
            tcWedge(A, g.T, G, I.gs, I.phi, I.delta, I.gs * heq, g.T[0] + I.dT, I.cs).P - w.P,
          )
        : w.Ka * I.gs * heq * Hs;
    L.push({ ty: 'LSh', Fx: -P * w.dP[0], Fy: 0, x: pt(0.5)[0], y: pt(0.5)[1] });
    L.push({ ty: 'LSv', Fx: 0, Fy: -P * w.dP[1], x: pt(0.5)[0], y: pt(0.5)[1] });
  }
  const res = (c: TcComboSpec) => {
    const f = (t: TcLoadItem['ty']) => (c.sd ? 1 : c.mn[t] ? 1 / I.eta : I.eta) * c.f[t];
    let N = 0;
    let Q = 0;
    let M = 0;
    for (const l of L) {
      const k = f(l.ty);
      N -= k * l.Fy;
      Q -= k * l.Fx;
      M += (l.x - xc) * k * l.Fy - (l.y - ys) * k * l.Fx;
    }
    return { N, Q, M, e0: Math.abs(M) / N };
  };

  const Ib = res(TC_COMB[1]);
  const Ia = res(TC_COMB[0]);
  const Aa = h * 1;
  const W = (h * h) / 6;
  const y = h / 2;
  const R = I.R * 1000;
  const Rku = I.Rku * 1000;
  const Rc = I.Rc * 1000;
  const chk = (s: { N: number; Q: number; M: number; e0: number }): TcStemComboCheck => {
    const ok1 = s.e0 <= 0.9 * y;
    const Nr = I.md * I.phi1 * R * Aa * Math.max(0, 1 - (2 * s.e0) / h);
    const sk = Math.abs(s.M) / W - s.N / Aa;
    const need = s.e0 > 0.7 * y;
    return {
      ok1,
      Nr,
      okN: s.N <= Nr,
      sk,
      need,
      lim: I.gr * Rku,
      okk: !need || sk <= I.gr * Rku,
    };
  };
  const cIb = chk(Ib);
  const cIa = chk(Ia);
  const s0 = Ia.N / Aa;
  const Qr = (Rc + 0.8 * I.nsh * I.mu * s0) * Aa;
  const Qr2 = (Rc + (0.8 * I.nsh * I.mu * Ib.N) / Aa) * Aa;
  return {
    nm,
    ys,
    z: g.yT - ys,
    h,
    A: Aa,
    W,
    y,
    Ib,
    Ia,
    cIb,
    cIa,
    s0,
    Qr,
    okQ: Math.abs(Ia.Q) <= Qr && Math.abs(Ib.Q) <= Qr2,
    Qr2,
    ok:
      cIb.ok1 &&
      cIa.ok1 &&
      cIb.okN &&
      cIa.okN &&
      cIb.okk &&
      cIa.okk &&
      Math.abs(Ia.Q) <= Qr &&
      Math.abs(Ib.Q) <= Qr2,
  };
}

function footSec(I: TcInput, g: TcGeometry, c: TcComboResult, Bp: number) {
  const ce = Math.cos(g.eps);
  const sig = c.N / Bp;
  const out: TcFootCutResult[] = [];
  const mas = I.footMat === 'm';
  const Rbt = mas ? I.fRku * 1000 : I.Rbtf * 1000;
  const Rsh = mas ? I.fRc * 1000 : Rbt;
  const gf0 = I.gf0 ?? (mas ? (I.gfm > 0 ? I.gfm : I.gm) : I.gb);
  const zone: [number, number] = c.toToe ? [0, Bp] : [g.Bs - Bp, g.Bs];

  const cut = (nm: string, x: number, side: -1 | 1) => {
    const sx = x / ce;
    const t = I.t1 + (g.dy * x) / g.B;
    const a = side < 0 ? 0 : sx;
    const b = side < 0 ? sx : g.Bs;
    const lo = Math.max(a, zone[0]);
    const hi = Math.min(b, zone[1]);
    const Lq = Math.max(0, hi - lo);
    const Q = sig * Lq;
    const M =
      side < 0
        ? (sig * (Math.max(0, sx - lo) ** 2 - Math.max(0, sx - hi) ** 2)) / 2
        : (sig * (Math.max(0, hi - sx) ** 2 - Math.max(0, lo - sx) ** 2)) / 2;

    const n = 60;
    const x0 = side < 0 ? 0 : x;
    const x1 = side < 0 ? x : g.B;
    const hs = side < 0 ? I.hf : g.yT - I.t1;
    const gs = side < 0 ? I.gf : I.gs;
    let Qd = 0;
    let Md = 0;
    for (let i = 0; i < n; i++) {
      const xi = x0 + ((x1 - x0) * (i + 0.5)) / n;
      const dx = (x1 - x0) / n;
      const ti = I.t1 + (g.dy * xi) / g.B;
      const w = (0.9 * gf0 * ti + 1.0 * gs * hs) * dx;
      Qd += w;
      Md += w * Math.abs(x - xi);
    }
    const Qn = Math.abs(Q - Qd);
    const Mn = Math.abs(M - Md);
    const W = (t * t) / 6;
    const st = Mn / W;
    const tau = (1.5 * Qn) / t;
    out.push({
      nm,
      x,
      t,
      Lq,
      Qr: Q,
      Mr: M,
      Qd,
      Md,
      Q: Qn,
      M: Mn,
      W,
      st,
      tau,
      ok: st <= Rbt && tau <= Rsh,
    });
  };
  cut('Mặt cắt mũi móng (mép trước thân tường)', g.xfb, -1);
  cut('Mặt cắt gót móng (mép sau thân tường)', g.xbb, 1);
  return { sig, list: out, Rbt, Rsh, mas };
}

export function tcCalc(I0: TcInput): TcResult {
  const I: TcInput = { ...I0 };
  I.footMat = I.footMat === 'm' ? 'm' : 'c';
  I.gf0 = I.footMat === 'm' ? (I.gfm > 0 ? I.gfm : I.gm) : I.gb;
  I.dT0 = I.dT;
  if (I.Hs > 1e-9) I.dT = I.m * I.Hs + I.dT0;

  const g = tcGeom(I);
  const Ld = loadsWrapper(I, g);
  const C: TcComboResult[] = TC_COMB.map((c) => {
    const baseC = combineLoads(Ld.L, g, c, I.eta);
    return {
      ...baseC,
      Bp: 0,
      okE: false,
      sigU: 0,
      sigMax: 0,
      sigMin: 0,
      sl: { Rt: 0, RR: 0, ok: false },
      sigB: 0,
      okB0: false,
      okB: false,
    };
  });
  const [Ia, Ib, SD] = C;
  const eLim = I.rock ? 0.45 * g.Bs : g.Bs / 3;
  for (const c of C) {
    c.Bp = g.Bs - 2 * c.e;
    c.okE = c.e <= eLim;
    c.sigU = c.N / Math.max(c.Bp, 1e-9);
    c.sigMax =
      c.e <= g.Bs / 6
        ? (c.N / g.Bs) * (1 + (6 * c.e) / g.Bs)
        : (2 * c.N) / (3 * (g.Bs / 2 - c.e));
    c.sigMin = c.e <= g.Bs / 6 ? (c.N / g.Bs) * (1 - (6 * c.e) / g.Bs) : 0;
  }

  const slide = (c: TcComboResult) => {
    let Rt: number;
    if (I.soil === 'd') {
      const svVal = c.N / g.Bs;
      Rt = Math.min(I.Su, 0.5 * svVal) * g.Bs;
    } else {
      Rt = c.N * Math.tan(rad(I.phif));
    }
    const RR = I.phit * Rt;
    return { Rt, RR, ok: c.Hd <= RR };
  };

  const brm = I.rock ? (I.brmR === 'kt' ? 'kt' : 'rock') : I.brm || (I.qRu > 0 ? 'kt' : 'lt');
  for (const c of C) {
    c.sl = slide(c);
    if (!c.sd) {
      c.br =
        brm === 'rock'
          ? tcBearingRock(I)
          : brm === 'spt'
            ? tcBearingSPT(I, g, c.Bp)
            : tcBearing(I, g, c.Bp, SD.Hd, SD.N);
      if (brm === 'kt') {
        c.br.given = true;
        c.br.qR = I.qRu;
      }
      c.sigB = I.rock ? c.sigMax : c.sigU;
      c.okB0 = c.sigB <= c.br.qR;
      c.okB = c.okB0;
    }
  }

  const ctNeed = !I.rock && !(Ia.okB0 && Ib.okB0);
  if (ctNeed) {
    for (const c of [Ia, Ib]) {
      c.ct = bamboo(I, c.br!.qR);
      c.okB = c.sigB <= c.ct.Rct;
    }
  }

  const secs = [
    stemSec(I, g, I.t1, 'Mặt cắt 1-1: chân thân tường (đỉnh móng)'),
    stemSec(I, g, I.t1 + I.H / 2, 'Mặt cắt 2-2: giữa chiều cao thân tường'),
  ];
  const foot = footSec(I, g, Ib, Ib.Bp);
  const coul =
    I.Hs <= 1e-9 || (I.m > 0 && deg(Math.atan(1 / I.m)) < I.phi)
      ? tcCoulomb(180 - Ld.w0.theta, I.phi, I.delta, I.Hs > 1e-9 ? deg(Math.atan(1 / I.m)) : 0)
      : NaN;

  const ok = {
    brm,
    ct: ctNeed,
    br0: Ia.okB0 && Ib.okB0,
    e: Ia.okE && Ib.okE,
    sl: Ia.sl.ok && Ib.sl.ok,
    br: Ia.okB && Ib.okB,
    stem: secs.every((s) => s.ok),
    foot: foot.list.every((f) => f.ok),
    all: false,
  };
  ok.all = ok.e && ok.sl && ok.br && ok.stem && ok.foot;
  return { I, g, Ld, C, Ia, Ib, SD, eLim, secs, foot, coul, ok };
}

function loadsWrapper(I: TcInput, g: TcGeometry): TcLoadsBundle {
  return tcLoads(I, g);
}

export const TC = {
  calc: tcCalc,
  geom: tcGeom,
  wedge: tcWedge,
  coulomb: tcCoulomb,
  heqOf: tcHeqOf,
  Nfac: tcNfac,
  COMB: TC_COMB,
  cent: tcCent,
  area: tcArea,
  clipY: tcClipY,
  bearing: tcBearing,
  bearingSPT: tcBearingSPT,
  bearingRock: tcBearingRock,
  TC_MI,
  TC_QGH,
} as const;

// ---------------------------------------------------------------------------
// 3. Standard Gravity Wall Libraries (`TC_LIB`, `TC_LIB86` — TKĐH 86-06X)
// ---------------------------------------------------------------------------

export interface TcLibRow {
  H: number;
  b0: number;
  n1: number;
  n2: number;
  hc: number;
  a1: number;
  a2: number;
  t1: number;
  t2: number;
  Hs: number;
  m: number;
}

export interface TcLibSeries {
  k: string;
  nm: string;
  mat: 'm' | 'c';
  s: readonly TcLibRow[];
}

export const TC_LIB: readonly TcLibSeries[] = [
  { k: 'td1.0', nm: 'Tường đứng (kè chân), đá hộc xây vữa M100, mái 1:1 cao H1 = 1 m', mat: 'm', s: [
    { H: 2.0, b0: 0.548, n1: 0.0, n2: 0.2258, hc: 0.2, a1: 0.75, a2: 0.4, t1: 1.0, t2: 1.13, Hs: 1.0, m: 1.001 },
    { H: 3.0, b0: 0.482, n1: 0.0, n2: 0.3725, hc: 0.2, a1: 0.75, a2: 0.4, t1: 1.0, t2: 1.23, Hs: 1.0, m: 1.001 },
    { H: 4.0, b0: 0.447, n1: 0.0, n2: 0.4507, hc: 0.2, a1: 0.8, a2: 0.4, t1: 1.0, t2: 1.38, Hs: 1.0, m: 1.001 },
    { H: 5.0, b0: 0.427, n1: 0.0, n2: 0.4945, hc: 0.2, a1: 0.8, a2: 0.4, t1: 1.0, t2: 1.53, Hs: 1.0, m: 1.001 },
    { H: 6.0, b0: 0.435, n1: 0.0, n2: 0.4775, hc: 0.2, a1: 0.8, a2: 0.4, t1: 1.0, t2: 1.58, Hs: 1.0, m: 1.001 },
  ] },
  { k: 'td2.0', nm: 'Tường đứng (kè chân), đá hộc xây vữa M100, mái 1:1 cao H1 = 2 m', mat: 'm', s: [
    { H: 2.0, b0: 0.548, n1: 0.0, n2: 0.2258, hc: 0.2, a1: 0.6, a2: 0.4, t1: 1.0, t2: 1.08, Hs: 2.0, m: 1.001 },
    { H: 3.0, b0: 0.5, n1: 0.0, n2: 0.3333, hc: 0.2, a1: 0.65, a2: 0.4, t1: 1.0, t2: 1.23, Hs: 2.0, m: 1.001 },
    { H: 4.0, b0: 0.466, n1: 0.0, n2: 0.4085, hc: 0.2, a1: 0.65, a2: 0.4, t1: 1.0, t2: 1.33, Hs: 2.0, m: 1.001 },
    { H: 5.0, b0: 0.457, n1: 0.0, n2: 0.4286, hc: 0.2, a1: 0.8, a2: 0.4, t1: 1.0, t2: 1.48, Hs: 2.0, m: 1.001 },
    { H: 6.0, b0: 0.447, n1: 0.0, n2: 0.4505, hc: 0.2, a1: 0.95, a2: 0.4, t1: 1.0, t2: 1.58, Hs: 2.0, m: 1.001 },
  ] },
  { k: 'td3.0', nm: 'Tường đứng (kè chân), đá hộc xây vữa M100, mái 1:1 cao H1 = 3 m', mat: 'm', s: [
    { H: 2.0, b0: 0.548, n1: 0.0, n2: 0.2258, hc: 0.2, a1: 0.6, a2: 0.4, t1: 1.0, t2: 1.08, Hs: 3.0, m: 1.001 },
    { H: 3.0, b0: 0.5, n1: 0.0, n2: 0.3333, hc: 0.2, a1: 0.6, a2: 0.4, t1: 1.0, t2: 1.18, Hs: 3.0, m: 1.001 },
    { H: 4.0, b0: 0.479, n1: 0.0, n2: 0.3803, hc: 0.2, a1: 0.65, a2: 0.4, t1: 1.0, t2: 1.33, Hs: 3.0, m: 1.001 },
    { H: 5.0, b0: 0.467, n1: 0.0, n2: 0.4066, hc: 0.2, a1: 0.8, a2: 0.4, t1: 1.0, t2: 1.53, Hs: 3.0, m: 1.001 },
    { H: 6.0, b0: 0.459, n1: 0.0, n2: 0.4234, hc: 0.2, a1: 0.95, a2: 0.4, t1: 1.0, t2: 1.58, Hs: 3.0, m: 1.001 },
  ] },
  { k: 'td4.0', nm: 'Tường đứng (kè chân), đá hộc xây vữa M100, mái 1:1 cao H1 = 4 m', mat: 'm', s: [
    { H: 2.0, b0: 0.548, n1: 0.0, n2: 0.2258, hc: 0.2, a1: 0.6, a2: 0.4, t1: 1.0, t2: 1.08, Hs: 4.0, m: 1.001 },
    { H: 3.0, b0: 0.5, n1: 0.0, n2: 0.3333, hc: 0.2, a1: 0.6, a2: 0.4, t1: 1.0, t2: 1.18, Hs: 4.0, m: 1.001 },
    { H: 4.0, b0: 0.485, n1: 0.0, n2: 0.3662, hc: 0.2, a1: 0.6, a2: 0.4, t1: 1.0, t2: 1.28, Hs: 4.0, m: 1.001 },
    { H: 5.0, b0: 0.472, n1: 0.0, n2: 0.3956, hc: 0.2, a1: 0.8, a2: 0.4, t1: 1.0, t2: 1.43, Hs: 4.0, m: 1.001 },
    { H: 6.0, b0: 0.468, n1: 0.0, n2: 0.4054, hc: 0.2, a1: 0.95, a2: 0.4, t1: 1.0, t2: 1.53, Hs: 4.0, m: 1.001 },
  ] },
  { k: 'td5.0', nm: 'Tường đứng (kè chân), đá hộc xây vữa M100, mái 1:1 cao H1 = 5 m', mat: 'm', s: [
    { H: 2.0, b0: 0.548, n1: 0.0, n2: 0.2258, hc: 0.2, a1: 0.6, a2: 0.4, t1: 1.0, t2: 1.08, Hs: 5.0, m: 1.001 },
    { H: 3.0, b0: 0.509, n1: 0.0, n2: 0.3137, hc: 0.2, a1: 0.6, a2: 0.4, t1: 1.0, t2: 1.18, Hs: 5.0, m: 1.001 },
    { H: 4.0, b0: 0.498, n1: 0.0, n2: 0.338, hc: 0.2, a1: 0.7, a2: 0.4, t1: 1.0, t2: 1.28, Hs: 5.0, m: 1.001 },
    { H: 5.0, b0: 0.487, n1: 0.0, n2: 0.3626, hc: 0.2, a1: 0.8, a2: 0.4, t1: 1.0, t2: 1.38, Hs: 5.0, m: 1.001 },
    { H: 6.0, b0: 0.468, n1: 0.0, n2: 0.4054, hc: 0.2, a1: 0.95, a2: 0.4, t1: 1.0, t2: 1.53, Hs: 5.0, m: 1.001 },
  ] },
  { k: 'td6.0', nm: 'Tường đứng (kè chân), đá hộc xây vữa M100, mái 1:1 cao H1 = 6 m', mat: 'm', s: [
    { H: 2.0, b0: 0.548, n1: 0.0, n2: 0.2258, hc: 0.2, a1: 0.6, a2: 0.4, t1: 1.0, t2: 1.08, Hs: 6.0, m: 1.001 },
    { H: 3.0, b0: 0.509, n1: 0.0, n2: 0.3137, hc: 0.2, a1: 0.6, a2: 0.4, t1: 1.0, t2: 1.18, Hs: 6.0, m: 1.001 },
    { H: 4.0, b0: 0.498, n1: 0.0, n2: 0.338, hc: 0.2, a1: 0.7, a2: 0.4, t1: 1.0, t2: 1.28, Hs: 6.0, m: 1.001 },
    { H: 5.0, b0: 0.487, n1: 0.0, n2: 0.3626, hc: 0.2, a1: 0.8, a2: 0.4, t1: 1.0, t2: 1.38, Hs: 6.0, m: 1.001 },
    { H: 6.0, b0: 0.468, n1: 0.0, n2: 0.4054, hc: 0.2, a1: 1.0, a2: 0.4, t1: 1.0, t2: 1.53, Hs: 6.0, m: 1.001 },
  ] },
  { k: 'td7.0', nm: 'Tường đứng (kè chân), đá hộc xây vữa M100, mái 1:1 cao H1 = 7 m', mat: 'm', s: [
    { H: 2.0, b0: 0.548, n1: 0.0, n2: 0.2258, hc: 0.2, a1: 0.6, a2: 0.4, t1: 1.0, t2: 1.08, Hs: 7.0, m: 1.001 },
    { H: 3.0, b0: 0.509, n1: 0.0, n2: 0.3137, hc: 0.2, a1: 0.6, a2: 0.4, t1: 1.0, t2: 1.18, Hs: 7.0, m: 1.001 },
    { H: 4.0, b0: 0.498, n1: 0.0, n2: 0.338, hc: 0.2, a1: 0.7, a2: 0.4, t1: 1.0, t2: 1.28, Hs: 7.0, m: 1.001 },
    { H: 5.0, b0: 0.487, n1: 0.0, n2: 0.3626, hc: 0.2, a1: 0.85, a2: 0.4, t1: 1.0, t2: 1.43, Hs: 7.0, m: 1.001 },
    { H: 6.0, b0: 0.476, n1: 0.0, n2: 0.3874, hc: 0.2, a1: 1.0, a2: 0.4, t1: 1.0, t2: 1.53, Hs: 7.0, m: 1.001 },
  ] },
  { k: 'td8.0', nm: 'Tường đứng (kè chân), đá hộc xây vữa M100, mái 1:1 cao H1 = 8 m', mat: 'm', s: [
    { H: 2.0, b0: 0.548, n1: 0.0, n2: 0.2258, hc: 0.2, a1: 0.6, a2: 0.4, t1: 1.0, t2: 1.08, Hs: 8.0, m: 1.001 },
    { H: 3.0, b0: 0.509, n1: 0.0, n2: 0.3137, hc: 0.2, a1: 0.6, a2: 0.4, t1: 1.0, t2: 1.18, Hs: 8.0, m: 1.001 },
    { H: 4.0, b0: 0.498, n1: 0.0, n2: 0.338, hc: 0.2, a1: 0.65, a2: 0.4, t1: 1.0, t2: 1.28, Hs: 8.0, m: 1.001 },
  ] },
  { k: 'kcb', nm: 'Tường đứng (kè chân) BT M150, mái 1:1 cao H1 = 4 m', mat: 'c', s: [
    { H: 2.0, b0: 0.465, n1: 0.0, n2: 0.2424, hc: 0.2, a1: 0.6, a2: 0.4, t1: 0.8, t2: 1.05, Hs: 4.0, m: 0.999 },
    { H: 3.0, b0: 0.438, n1: 0.0, n2: 0.3208, hc: 0.2, a1: 0.65, a2: 0.4, t1: 0.8, t2: 1.15, Hs: 4.0, m: 0.999 },
    { H: 4.0, b0: 0.425, n1: 0.0, n2: 0.3562, hc: 0.2, a1: 0.7, a2: 0.4, t1: 0.8, t2: 1.25, Hs: 4.0, m: 0.999 },
    { H: 5.0, b0: 0.418, n1: 0.0, n2: 0.3763, hc: 0.2, a1: 0.8, a2: 0.4, t1: 0.8, t2: 1.35, Hs: 4.0, m: 0.999 },
    { H: 6.0, b0: 0.414, n1: 0.0, n2: 0.3894, hc: 0.2, a1: 1.0, a2: 0.5, t1: 0.8, t2: 1.5, Hs: 4.0, m: 0.999 },
  ] },
  { k: 'tvd', nm: 'Tường vai thân đứng, đá hộc xây vữa XM M100', mat: 'm', s: [
    { H: 3.0, b0: 0.438, n1: 0.0, n2: 0.4706, hc: 0.2, a1: 0.2, a2: 0.5, t1: 0.8, t2: 1.3, Hs: 0, m: 0 },
    { H: 4.0, b0: 0.441, n1: 0.0, n2: 0.4648, hc: 0.2, a1: 0.2, a2: 0.5, t1: 0.8, t2: 1.4, Hs: 0, m: 0 },
    { H: 5.0, b0: 0.457, n1: 0.0, n2: 0.4286, hc: 0.2, a1: 0.2, a2: 0.5, t1: 0.8, t2: 1.45, Hs: 0, m: 0 },
    { H: 6.0, b0: 0.468, n1: 0.0, n2: 0.4054, hc: 0.2, a1: 0.2, a2: 0.5, t1: 0.8, t2: 1.5, Hs: 0, m: 0 },
  ] },
  { k: 'tvb', nm: 'Tường vai thân đứng, BT M150', mat: 'c', s: [
    { H: 2.0, b0: 0.38, n1: 0.0, n2: 0.4848, hc: 0.2, a1: 0.2, a2: 0.6, t1: 0.8, t2: 1.25, Hs: 0, m: 0 },
    { H: 3.0, b0: 0.405, n1: 0.0, n2: 0.4151, hc: 0.2, a1: 0.2, a2: 0.35, t1: 0.8, t2: 1.25, Hs: 0, m: 0 },
    { H: 4.0, b0: 0.401, n1: 0.0, n2: 0.4247, hc: 0.2, a1: 0.2, a2: 0.3, t1: 0.8, t2: 1.3, Hs: 0, m: 0 },
    { H: 5.0, b0: 0.411, n1: 0.0, n2: 0.3978, hc: 0.2, a1: 0.3, a2: 0.2, t1: 0.8, t2: 1.35, Hs: 0, m: 0 },
    { H: 6.0, b0: 0.411, n1: 0.0, n2: 0.3982, hc: 0.2, a1: 0.3, a2: 0.2, t1: 0.8, t2: 1.45, Hs: 0, m: 0 },
  ] },
  { k: 'kvd', nm: 'Tường nghiêng (kè vai), thân đá hộc xây vữa XM M100', mat: 'm', s: [
    { H: 4.0, b0: 0.492, n1: 0.2, n2: 0.2394, hc: 0.2, a1: 0.2, a2: 0.5, t1: 0.8, t2: 1.4, Hs: 0, m: 0 },
    { H: 5.0, b0: 0.506, n1: 0.2, n2: 0.2088, hc: 0.2, a1: 0.2, a2: 0.5, t1: 0.8, t2: 1.45, Hs: 0, m: 0 },
    { H: 6.0, b0: 0.511, n1: 0.2, n2: 0.1982, hc: 0.2, a1: 0.2, a2: 0.5, t1: 0.8, t2: 1.5, Hs: 0, m: 0 },
    { H: 7.0, b0: 0.507, n1: 0.2, n2: 0.2061, hc: 0.2, a1: 0.2, a2: 0.5, t1: 0.8, t2: 1.6, Hs: 0, m: 0 },
    { H: 8.0, b0: 0.517, n1: 0.2, n2: 0.1854, hc: 0.2, a1: 0.3, a2: 0.5, t1: 0.8, t2: 1.7, Hs: 0, m: 0 },
  ] },
  { k: 'kvb', nm: 'Tường nghiêng (kè vai), thân BT M150', mat: 'c', s: [
    { H: 3.0, b0: 0.421, n1: 0.2, n2: 0.2264, hc: 0.2, a1: 0.5, a2: 0.4, t1: 0.8, t2: 1.35, Hs: 0, m: 0 },
    { H: 4.0, b0: 0.428, n1: 0.2, n2: 0.2055, hc: 0.2, a1: 0.6, a2: 0.2, t1: 0.8, t2: 1.35, Hs: 0, m: 0 },
    { H: 5.0, b0: 0.432, n1: 0.2, n2: 0.1935, hc: 0.2, a1: 0.6, a2: 0.2, t1: 0.8, t2: 1.45, Hs: 0, m: 0 },
    { H: 6.0, b0: 0.438, n1: 0.2, n2: 0.177, hc: 0.2, a1: 0.6, a2: 0.2, t1: 0.8, t2: 1.5, Hs: 0, m: 0 },
    { H: 7.0, b0: 0.439, n1: 0.2, n2: 0.1729, hc: 0.2, a1: 0.6, a2: 0.35, t1: 0.8, t2: 1.6, Hs: 0, m: 0 },
    { H: 8.0, b0: 0.441, n1: 0.2, n2: 0.1698, hc: 0.2, a1: 0.6, a2: 0.35, t1: 0.8, t2: 1.7, Hs: 0, m: 0 },
  ] },
  { k: 'tn4.0', nm: 'Tường nghiêng, đá hộc xây vữa M100, mái 1:1,5 cao H1 = 4 m', mat: 'm', s: [
    { H: 2.0, b0: 0.6, n1: 0.2, n2: -0.0, hc: 0.2, a1: 0.4, a2: 0.4, t1: 0.8, t2: 1.1, Hs: 4.0, m: 1.5 },
    { H: 3.0, b0: 0.6, n1: 0.2, n2: -0.0, hc: 0.2, a1: 0.4, a2: 0.4, t1: 0.8, t2: 1.1, Hs: 4.0, m: 1.5 },
    { H: 4.0, b0: 0.562, n1: 0.2, n2: 0.0845, hc: 0.2, a1: 0.45, a2: 0.4, t1: 0.8, t2: 1.25, Hs: 4.0, m: 1.5 },
    { H: 5.0, b0: 0.546, n1: 0.2, n2: 0.1209, hc: 0.2, a1: 0.5, a2: 0.4, t1: 0.8, t2: 1.35, Hs: 4.0, m: 1.5 },
    { H: 6.0, b0: 0.531, n1: 0.2, n2: 0.1532, hc: 0.2, a1: 0.55, a2: 0.4, t1: 0.8, t2: 1.45, Hs: 4.0, m: 1.5 },
    { H: 7.0, b0: 0.524, n1: 0.2, n2: 0.1679, hc: 0.2, a1: 0.65, a2: 0.4, t1: 0.8, t2: 1.55, Hs: 4.0, m: 1.5 },
    { H: 8.0, b0: 0.517, n1: 0.2, n2: 0.1854, hc: 0.2, a1: 0.75, a2: 0.4, t1: 0.8, t2: 1.65, Hs: 4.0, m: 1.5 },
  ] },
  { k: 'tn5.0', nm: 'Tường nghiêng, đá hộc xây vữa M100, mái 1:1,5 cao H1 = 5 m', mat: 'm', s: [
    { H: 2.0, b0: 0.6, n1: 0.2, n2: -0.0, hc: 0.2, a1: 0.4, a2: 0.4, t1: 0.8, t2: 1.1, Hs: 5.0, m: 1.5 },
    { H: 3.0, b0: 0.6, n1: 0.2, n2: -0.0, hc: 0.2, a1: 0.4, a2: 0.4, t1: 0.8, t2: 1.1, Hs: 5.0, m: 1.5 },
    { H: 4.0, b0: 0.562, n1: 0.2, n2: 0.0845, hc: 0.2, a1: 0.45, a2: 0.4, t1: 0.8, t2: 1.25, Hs: 5.0, m: 1.5 },
    { H: 5.0, b0: 0.546, n1: 0.2, n2: 0.1209, hc: 0.2, a1: 0.5, a2: 0.4, t1: 0.8, t2: 1.35, Hs: 5.0, m: 1.5 },
    { H: 6.0, b0: 0.531, n1: 0.2, n2: 0.1532, hc: 0.2, a1: 0.55, a2: 0.4, t1: 0.8, t2: 1.45, Hs: 5.0, m: 1.5 },
    { H: 7.0, b0: 0.524, n1: 0.2, n2: 0.1679, hc: 0.2, a1: 0.65, a2: 0.4, t1: 0.8, t2: 1.55, Hs: 5.0, m: 1.5 },
    { H: 8.0, b0: 0.517, n1: 0.2, n2: 0.1854, hc: 0.2, a1: 0.75, a2: 0.4, t1: 0.8, t2: 1.65, Hs: 5.0, m: 1.5 },
  ] },
];

export type TcLib86RowTuple = readonly [number, number, number, number, number, number, number, number];

export interface TcLib86Table {
  g: TcLib86GroupCode;
  H1: number;
  t1: number;
  r2: readonly TcLib86RowTuple[];
  r3: readonly TcLib86RowTuple[];
}

export const TC_LIB86: readonly TcLib86Table[] = [
  { g: 'vvm', H1: 0, t1: 0.8, r2: [[0.5,0,0,65,20,45,130,105],[1,35,0,100,20,60,180,125],[2,75,0,140,20,60,220,130],[3,120,0,185,20,60,265,135],[4,165,0,230,20,60,310,140],[5,195,0,260,35,60,355,150]], r3: [[0.5,0,0,65,20,25,110,100],[1,35,0,100,20,45,165,115],[2,75,0,140,20,50,210,125],[3,120,0,185,20,50,255,130],[4,165,0,230,20,50,300,140],[5,195,0,260,20,50,330,145],[6,225,0,290,20,50,360,150]] },
  { g: 'vvc', H1: 0, t1: 0.8, r2: [[0.5,0,0,55,20,60,135,105],[1,35,0,90,20,60,170,125],[2,80,0,135,20,60,215,135],[3,110,0,165,20,60,245,135],[4,155,0,210,20,60,290,135],[5,185,0,240,20,60,320,140]], r3: [[0.5,0,0,55,20,35,110,105],[1,35,0,90,20,60,170,115],[2,80,0,135,20,60,215,125],[3,110,0,165,20,35,220,125],[4,155,0,210,20,30,260,130],[5,185,0,240,30,20,290,135],[6,225,0,280,30,20,330,145]] },
  { g: 'vnm', H1: 0, t1: 0.8, r2: [[0.5,6,64,70,20,40,130,105],[1,16,79,95,20,60,175,125],[2,36,119,155,20,60,235,135],[3,56,134,190,30,60,280,135],[4,76,149,225,40,50,315,145],[5,96,159,255,40,50,345,150],[6,116,174,290,60,50,400,160]], r3: [[0.5,6,64,70,30,20,120,105],[1,16,79,95,30,50,175,115],[2,36,119,155,30,50,235,125],[3,56,134,190,20,50,260,130],[4,76,149,225,20,50,295,140],[5,96,159,255,20,50,325,145],[6,116,174,290,20,50,360,150],[7,136,189,325,20,50,395,160],[8,156,204,360,30,50,440,170]] },
  { g: 'vnc', H1: 0, t1: 0.8, r2: [[0.5,6,54,60,30,50,140,110],[1,16,74,90,20,60,170,120],[2,36,104,140,20,60,220,140],[3,56,114,170,35,60,265,140],[4,76,129,205,45,60,310,140],[5,96,144,240,45,60,345,150],[6,116,154,270,60,60,390,160]], r3: [[0.5,6,54,60,20,50,130,105],[1,16,74,90,20,60,170,115],[2,36,104,140,20,60,220,125],[3,56,114,170,50,40,260,135],[4,76,129,205,60,20,285,135],[5,96,144,240,60,20,320,145],[6,116,154,270,60,20,350,150],[7,136,169,305,60,35,400,160]] },
  { g: 'cvm', H1: 1, t1: 1.0, r2: [[1,15,0,80,60,40,180,105],[2,35,0,100,60,60,220,110],[3,95,0,160,80,60,300,125],[4,160,0,225,95,60,380,145],[5,225,0,290,100,70,460,160]], r3: [[1,15,0,80,60,40,180,105],[2,35,0,100,75,40,215,110],[3,95,0,160,75,40,275,120],[4,160,0,225,80,40,345,135],[5,225,0,290,80,40,410,150],[6,265,0,330,80,40,450,155]] },
  { g: 'cvm', H1: 2, t1: 1.0, r2: [[1,15,0,80,60,40,180,105],[2,35,0,100,60,40,200,105],[3,95,0,160,75,40,275,120],[4,155,0,220,75,40,335,135],[5,215,0,280,100,80,460,160]], r3: [[1,15,0,80,60,40,180,105],[2,35,0,100,60,40,200,105],[3,95,0,150,65,40,255,120],[4,145,0,210,65,40,315,130],[5,195,0,260,80,40,380,145],[6,250,0,315,95,40,450,155]] },
  { g: 'cvm', H1: 3, t1: 1.0, r2: [[1,15,0,80,60,40,180,105],[2,35,0,100,60,40,200,105],[3,85,0,150,70,40,260,120],[4,135,0,200,90,40,330,135],[5,185,0,250,100,80,430,165]], r3: [[1,15,0,80,60,40,180,105],[2,35,0,100,60,40,200,105],[3,85,0,150,60,40,250,115],[4,135,0,200,65,40,305,130],[5,185,0,250,80,40,370,150],[6,235,0,300,95,40,435,155]] },
  { g: 'cvm', H1: 4, t1: 1.0, r2: [[1,15,0,80,60,40,180,105],[2,35,0,100,60,40,200,105],[3,85,0,150,70,40,260,120],[4,130,0,195,85,40,320,130],[5,180,0,245,100,80,425,150]], r3: [[1,15,0,80,60,40,180,105],[2,35,0,100,60,40,200,105],[3,85,0,150,60,40,250,115],[4,130,0,195,60,40,295,125],[5,180,0,245,80,40,365,140],[6,225,0,290,95,40,425,150]] },
  { g: 'cvm', H1: 5, t1: 1.0, r2: [[1,15,0,80,60,40,180,105],[2,35,0,100,60,40,200,105],[3,80,0,145,70,40,255,120],[4,120,0,185,90,40,315,130],[5,165,0,230,100,80,410,150]], r3: [[1,15,0,80,60,40,180,105],[2,35,0,100,60,40,200,105],[3,80,0,145,60,40,245,115],[4,120,0,185,70,40,295,125],[5,165,0,230,80,40,350,135],[6,225,0,290,95,40,425,150]] },
  { g: 'cvm', H1: 6, t1: 1.0, r2: [[1,15,0,80,60,40,180,105],[2,35,0,100,60,40,200,105],[3,80,0,145,60,40,245,115],[4,120,0,185,95,40,320,130],[5,165,0,230,100,80,410,150]], r3: [[1,15,0,80,60,40,180,105],[2,35,0,100,60,40,200,105],[3,80,0,145,60,40,245,115],[4,120,0,185,70,40,295,125],[5,165,0,230,80,40,350,135],[6,225,0,290,100,40,430,150]] },
  { g: 'cvm', H1: 7, t1: 1.0, r2: [[1,15,0,80,60,40,180,105],[2,35,0,100,60,40,200,105],[3,80,0,145,60,40,245,115],[4,120,0,185,95,45,325,135],[5,165,0,230,100,80,410,150]], r3: [[1,15,0,80,60,40,180,105],[2,35,0,100,60,40,200,105],[3,80,0,145,60,40,245,115],[4,120,0,185,70,40,295,125],[5,165,0,230,85,40,355,140],[6,215,0,280,100,40,420,150]] },
  { g: 'cvm', H1: 8, t1: 1.0, r2: [[1,15,0,80,60,40,180,105],[2,35,0,100,60,40,200,105],[3,80,0,145,60,40,245,115],[4,120,0,185,95,50,330,135],[5,165,0,230,100,80,410,150]], r3: [[1,15,0,80,60,40,180,105],[2,35,0,100,60,40,200,105],[3,80,0,145,60,40,245,115],[4,120,0,185,65,40,290,125],[5,165,0,230,85,40,355,140],[6,215,0,280,100,40,420,150]] },
  { g: 'cvm', H1: 9, t1: 1.0, r2: [[1,15,0,80,60,40,180,105],[2,35,0,100,60,40,200,105],[3,80,0,145,65,40,250,115],[4,120,0,185,95,50,330,135],[5,165,0,230,100,80,410,160]], r3: [[1,15,0,80,60,40,180,105],[2,35,0,100,60,40,200,105],[3,80,0,145,60,40,245,115],[4,120,0,185,75,40,300,125],[5,165,0,230,85,40,355,135],[6,215,0,280,100,40,420,150]] },
  { g: 'cvm', H1: 10, t1: 1.0, r2: [[1,15,0,80,60,40,180,105],[2,35,0,100,60,40,200,105],[3,80,0,145,60,40,245,115],[4,120,0,185,60,40,285,130],[5,165,0,230,100,80,410,150]], r3: [[1,15,0,80,60,40,180,105],[2,35,0,100,60,40,200,105],[3,80,0,145,60,40,245,115],[4,120,0,185,60,40,285,125],[5,165,0,230,90,40,360,140],[6,215,0,280,100,40,420,150]] },
  { g: 'cnm', H1: 1, t1: 0.8, r2: [[1,16,64,80,40,40,160,105],[2,36,64,100,40,40,180,110],[3,56,69,125,40,80,245,120],[4,76,94,170,50,70,290,130],[5,96,119,215,70,70,355,145],[6,116,149,265,70,70,405,155]], r3: [[1,16,64,80,40,40,160,105],[2,36,64,100,40,40,180,110],[3,56,69,125,40,55,220,115],[4,76,94,170,40,55,265,125],[5,96,119,215,40,55,310,135],[6,116,149,265,40,55,360,145],[7,136,174,310,40,55,405,155],[8,156,204,360,60,75,495,170]] },
  { g: 'cnm', H1: 2, t1: 0.8, r2: [[1,16,64,80,40,40,160,105],[2,36,64,100,40,40,180,110],[3,56,64,120,40,65,225,120],[4,76,94,170,40,75,285,130],[5,96,119,215,55,80,350,140],[6,116,149,265,60,80,405,155]], r3: [[1,16,64,80,40,40,160,105],[2,36,64,100,40,40,180,110],[3,56,64,120,50,40,210,115],[4,76,94,170,50,40,260,125],[5,96,119,215,50,40,305,135],[6,116,149,265,50,40,355,145],[7,136,174,310,70,40,420,155],[8,156,204,360,70,40,470,165]] },
  { g: 'cnm', H1: 3, t1: 0.8, r2: [[1,16,64,80,40,40,160,105],[2,36,64,100,40,40,180,110],[3,56,64,120,40,50,210,115],[4,76,94,170,45,65,280,130],[5,96,119,215,55,70,340,140],[6,116,149,265,80,70,415,155]], r3: [[1,16,64,80,40,40,160,105],[2,36,64,100,40,40,180,110],[3,56,64,120,50,40,210,115],[4,76,94,170,50,40,260,125],[5,96,119,215,50,40,305,135],[6,116,149,265,50,40,355,145],[7,136,174,310,65,40,415,155],[8,156,204,360,80,40,480,170]] },
  { g: 'cnm', H1: 4, t1: 0.8, r2: [[1,16,64,80,40,40,160,105],[2,36,64,100,40,40,180,110],[3,56,64,120,40,45,205,115],[4,76,94,170,55,45,270,125],[5,96,119,215,80,50,345,140],[6,116,149,265,80,75,420,155]], r3: [[1,16,64,80,40,40,160,105],[2,36,64,100,40,40,180,110],[3,56,64,120,40,40,200,110],[4,76,94,170,45,40,255,125],[5,96,119,215,50,40,305,135],[6,116,149,265,55,40,360,145],[7,136,174,310,65,40,415,155],[8,156,204,360,75,40,475,165]] },
  { g: 'cnm', H1: 5, t1: 0.8, r2: [[1,16,64,80,40,40,160,105],[2,36,64,100,40,40,180,110],[3,56,64,120,40,50,210,115],[4,76,94,170,50,50,270,125],[5,96,119,215,60,50,325,135],[6,116,149,265,80,75,420,155]], r3: [[1,16,64,80,40,40,160,105],[2,36,64,100,40,40,180,110],[3,56,64,120,40,40,200,110],[4,76,94,170,40,40,250,120],[5,96,119,215,45,40,300,130],[6,116,149,265,55,40,360,145],[7,136,174,310,65,40,415,155],[8,156,204,360,75,40,475,165]] },
  { g: 'cnm', H1: 6, t1: 0.8, r2: [[1,16,64,80,40,40,160,105],[2,36,64,100,40,40,180,110],[3,56,64,120,30,50,200,110],[4,76,94,170,60,50,280,130],[5,96,119,215,60,60,335,140],[6,116,149,265,75,80,420,155]], r3: [[1,16,64,80,40,40,160,105],[2,36,64,100,40,40,180,110],[3,56,64,120,40,40,200,110],[4,76,94,170,45,40,255,125],[5,96,119,215,45,40,300,130],[6,116,149,265,55,40,360,145],[7,136,174,310,70,40,420,155],[8,156,204,360,80,45,485,165]] },
  { g: 'cnm', H1: 7, t1: 0.8, r2: [[1,16,64,80,40,40,160,105],[2,36,64,100,40,40,180,110],[3,56,64,120,30,50,200,110],[4,76,94,170,50,45,265,125],[5,96,129,225,60,65,350,142],[6,116,159,275,80,75,430,160]], r3: [[1,16,64,80,40,40,160,105],[2,36,64,100,40,40,180,110],[3,56,64,120,40,40,200,110],[4,76,94,170,40,40,250,120],[5,96,129,225,45,40,310,135],[6,116,159,275,50,40,365,145],[7,136,194,330,60,40,430,160],[8,156,224,380,75,40,495,170]] },
  { g: 'cnm', H1: 8, t1: 0.8, r2: [[1,16,64,80,40,40,160,105],[2,36,64,100,40,40,180,110],[3,56,64,120,45,40,205,115],[4,76,94,170,50,40,260,125],[5,96,129,225,55,75,355,145],[6,116,159,275,70,75,420,155]], r3: [[1,16,64,80,40,40,160,105],[2,36,64,100,40,40,180,110],[3,56,64,120,45,40,205,115],[4,76,94,170,45,40,255,120],[5,96,129,225,45,40,310,135],[6,116,159,275,50,40,365,145],[7,136,194,330,55,40,425,155],[8,156,224,380,75,40,495,170]] },
  { g: 'cnm', H1: 9, t1: 0.8, r2: [[1,16,64,80,40,40,160,105],[2,36,64,100,40,40,180,110],[3,56,64,120,45,40,205,115],[4,76,94,170,50,40,260,125],[5,96,129,225,55,75,355,145],[6,116,159,275,70,75,420,155]], r3: [[1,16,64,80,40,40,160,105],[2,36,64,100,40,40,180,110],[3,56,64,120,40,40,200,110],[4,76,94,170,40,40,250,120],[5,96,129,225,45,40,310,135],[6,116,159,275,50,40,365,145],[7,136,194,330,60,40,430,160],[8,156,224,380,80,40,500,170]] },
  { g: 'cnm', H1: 10, t1: 0.8, r2: [[1,16,64,80,40,40,160,105],[2,36,64,100,40,40,180,110],[3,56,64,120,40,40,200,110],[4,76,104,180,45,40,265,125],[5,96,144,240,55,40,335,140],[6,116,184,300,80,55,435,160]], r3: [[1,16,64,80,40,40,160,105],[2,36,64,100,40,40,180,110],[3,56,64,120,40,40,200,110],[4,76,104,180,40,40,260,125],[5,96,144,240,40,40,320,135],[6,116,184,300,40,40,380,150],[7,136,224,360,45,40,445,160],[8,156,264,420,45,40,505,170]] },
  { g: 'cnc', H1: 1, t1: 1.0, r2: [[1,16,54,70,40,40,150,100],[2,36,54,90,40,50,180,110],[3,56,74,130,40,80,250,120],[4,76,99,175,45,80,300,130],[5,96,119,215,60,80,355,140],[6,116,144,260,75,80,415,155]], r3: [[1,16,54,70,40,40,150,100],[2,36,54,90,40,40,170,105],[3,56,74,130,50,50,230,120],[4,76,99,175,50,50,275,125],[5,96,119,215,50,50,315,135],[6,116,144,260,50,50,360,145],[7,136,164,300,80,55,435,155],[8,156,184,340,80,70,490,170]] },
  { g: 'cnc', H1: 2, t1: 1.0, r2: [[1,16,54,70,40,40,150,100],[2,36,54,90,40,40,170,105],[3,56,54,110,40,80,230,120],[4,76,79,155,70,80,305,135],[5,96,104,200,70,80,350,140],[6,116,134,250,80,80,410,155]], r3: [[1,16,54,70,40,40,150,100],[2,36,54,90,40,40,170,105],[3,56,54,110,65,40,215,115],[4,76,79,155,65,40,260,125],[5,96,104,200,65,40,305,135],[6,116,134,250,70,40,360,145],[7,136,159,295,80,40,415,155],[8,156,184,340,80,50,470,165]] },
  { g: 'cnc', H1: 3, t1: 1.0, r2: [[1,16,54,70,40,40,150,100],[2,36,54,90,40,40,170,105],[3,56,54,110,40,70,220,115],[4,76,79,155,50,80,285,130],[5,96,104,200,70,80,350,140],[6,116,134,250,70,80,400,150]], r3: [[1,16,54,70,40,40,150,100],[2,36,54,90,40,40,170,105],[3,56,54,110,60,40,210,115],[4,76,79,155,65,40,260,125],[5,96,104,200,65,45,310,130],[6,116,134,250,65,45,360,145],[7,136,159,295,70,45,410,155],[8,156,184,340,80,50,470,165]] },
  { g: 'cnc', H1: 4, t1: 1.0, r2: [[1,16,54,70,40,40,150,100],[2,36,54,90,40,40,170,105],[3,56,54,110,40,60,210,115],[4,76,79,155,50,60,265,125],[5,96,104,200,60,80,340,140],[6,116,134,250,80,80,410,160]], r3: [[1,16,54,70,40,40,150,100],[2,36,54,90,40,40,170,105],[3,56,54,110,55,40,205,110],[4,76,79,155,60,40,255,120],[5,96,104,200,65,45,310,135],[6,116,134,250,65,45,360,145],[7,136,159,295,70,45,410,155],[8,156,184,340,80,50,470,165]] },
  { g: 'cnc', H1: 5, t1: 1.0, r2: [[1,16,54,70,40,40,150,100],[2,36,54,90,40,40,170,105],[3,56,54,110,45,40,195,110],[4,76,79,155,40,70,265,125],[5,96,104,200,40,70,310,140],[6,116,134,250,80,80,410,160]], r3: [[1,16,54,70,40,40,150,100],[2,36,54,90,40,40,170,105],[3,56,54,110,45,40,195,110],[4,76,79,155,60,40,255,120],[5,96,104,200,60,40,300,130],[6,116,134,250,60,40,350,145],[7,136,159,295,70,45,410,155],[8,156,184,340,70,45,455,165]] },
  { g: 'cnc', H1: 6, t1: 1.0, r2: [[1,16,54,70,40,40,150,100],[2,36,54,90,40,40,170,105],[3,56,54,110,45,40,195,110],[4,76,89,165,40,70,275,125],[5,96,124,220,60,70,350,140],[6,116,164,280,80,70,430,155]], r3: [[1,16,54,70,40,40,150,100],[2,36,54,90,40,40,170,105],[3,56,54,110,45,40,195,110],[4,76,89,165,55,40,260,125],[5,96,124,220,55,40,315,135],[6,116,164,280,55,40,375,145],[7,136,199,335,55,40,430,155],[8,156,234,390,75,40,505,170]] },
  { g: 'cnc', H1: 7, t1: 1.0, r2: [[1,16,54,70,40,40,150,100],[2,36,54,90,40,40,170,105],[3,56,54,110,45,40,195,110],[4,76,89,165,40,70,275,125],[5,96,124,220,60,70,350,140],[6,116,164,280,80,70,430,155]], r3: [[1,16,54,70,40,40,150,100],[2,36,54,90,40,40,170,105],[3,56,54,110,50,40,200,110],[4,76,89,165,45,40,250,120],[5,96,124,220,45,40,305,130],[6,116,164,280,45,40,365,145],[7,136,199,335,55,40,430,155],[8,156,234,390,60,40,490,170]] },
  { g: 'cnc', H1: 8, t1: 1.0, r2: [[1,16,54,70,40,40,150,100],[2,36,54,90,40,40,170,105],[3,56,54,110,60,40,210,110],[4,76,89,165,60,40,265,125],[5,96,124,220,60,70,350,140],[6,116,164,280,80,70,430,155]], r3: [[1,16,54,70,40,40,150,100],[2,36,54,90,40,40,170,105],[3,56,54,110,60,40,210,110],[4,76,89,165,40,45,250,120],[5,96,124,220,45,45,310,130],[6,116,164,280,45,45,370,145],[7,136,199,335,50,45,430,155],[8,156,234,390,70,45,505,170]] },
  { g: 'cnc', H1: 9, t1: 1.0, r2: [[1,16,54,70,40,40,150,100],[2,36,54,90,40,40,170,105],[3,56,54,110,55,40,205,115],[4,76,89,165,60,40,265,125],[5,96,124,220,60,70,350,140],[6,116,164,280,70,80,430,155]], r3: [[1,16,54,70,40,40,150,100],[2,36,54,90,40,40,170,105],[3,56,54,110,55,40,205,115],[4,76,89,165,40,45,250,120],[5,96,124,220,45,45,310,135],[6,116,164,280,45,45,370,145],[7,136,199,335,50,45,430,155],[8,156,234,390,70,45,505,170]] },
  { g: 'cnc', H1: 10, t1: 1.0, r2: [[1,16,54,70,40,40,150,100],[2,36,54,90,40,40,170,105],[3,56,54,110,50,40,200,110],[4,76,89,165,50,40,255,120],[5,96,124,220,60,60,340,140],[6,116,164,280,80,70,430,155]], r3: [[1,16,54,70,40,40,150,100],[2,36,54,90,40,40,170,105],[3,56,54,110,50,40,200,110],[4,76,89,165,40,40,245,120],[5,96,124,220,40,45,305,130],[6,116,164,280,45,45,370,145],[7,136,199,335,50,45,430,155],[8,156,234,390,70,45,505,170]] },
  { g: 'cvc', H1: 1, t1: 1.0, r2: [[1,20,0,75,60,40,175,100],[2,40,0,95,65,60,220,115],[3,100,0,155,80,60,295,125],[4,160,0,215,100,60,375,140],[5,220,0,275,100,60,435,155]], r3: [] },
  { g: 'cvc', H1: 6, t1: 1.0, r2: [[1,20,0,75,60,40,175,100],[2,40,0,95,60,40,195,105],[3,85,0,140,60,40,240,115],[4,130,0,185,100,40,325,130],[5,175,0,230,100,80,410,150]], r3: [] },
  { g: 'cvc', H1: 2, t1: 1.0, r2: [[1,20,0,75,60,40,175,100],[2,40,0,95,65,40,200,110],[3,100,0,155,80,40,275,120],[4,160,0,215,95,40,350,135],[5,220,0,275,100,80,455,160]], r3: [] },
  { g: 'cvc', H1: 7, t1: 1.0, r2: [[1,20,0,75,60,40,175,100],[2,40,0,95,60,40,195,105],[3,85,0,140,65,40,245,115],[4,130,0,185,100,45,330,135],[5,175,0,230,100,80,410,150]], r3: [] },
  { g: 'cvc', H1: 3, t1: 1.0, r2: [[1,20,0,75,60,40,175,100],[2,40,0,95,60,40,195,105],[3,90,0,145,75,40,260,120],[4,145,0,200,95,40,335,135],[5,195,0,250,100,80,430,150]], r3: [] },
  { g: 'cvc', H1: 8, t1: 1.0, r2: [[1,20,0,75,60,40,175,100],[2,40,0,95,60,40,195,105],[3,85,0,140,65,40,245,115],[4,130,0,185,105,40,330,135],[5,175,0,230,100,80,410,150]], r3: [] },
  { g: 'cvc', H1: 4, t1: 1.0, r2: [[1,20,0,75,60,40,175,100],[2,40,0,95,60,40,195,105],[3,90,0,145,75,40,260,120],[4,140,0,195,85,40,320,130],[5,190,0,245,100,80,425,150]], r3: [] },
  { g: 'cvc', H1: 9, t1: 1.0, r2: [[1,20,0,75,60,40,175,100],[2,40,0,95,60,40,195,105],[3,85,0,140,80,40,260,120],[4,135,0,190,90,40,320,130],[5,185,0,240,100,80,420,150]], r3: [] },
  { g: 'cvc', H1: 5, t1: 1.0, r2: [[1,20,0,75,60,40,175,100],[2,40,0,95,60,40,195,105],[3,85,0,140,70,50,260,120],[4,130,0,185,85,50,320,130],[5,175,0,230,100,70,400,145]], r3: [] },
  { g: 'cvc', H1: 10, t1: 1.0, r2: [[1,20,0,75,60,40,175,100],[2,40,0,95,60,40,195,105],[3,85,0,140,60,40,240,115],[4,140,0,195,60,40,295,125],[5,190,0,245,100,80,425,150]], r3: [] },
];

// ---------------------------------------------------------------------------
// 4. TCVN 5573:2011 Material Tables, Soil Reference & Presets
// ---------------------------------------------------------------------------

export const TC_B7: Readonly<Record<number, readonly number[]>> = {
  1000: [2.5, 2.2, 1.8, 1.2, 0.8, 0.5, 0.4, 0.33],
  800: [2.2, 2.0, 1.6, 1.0, 0.7, 0.45, 0.33, 0.28],
  600: [2.0, 1.7, 1.4, 0.9, 0.65, 0.4, 0.3, 0.2],
  500: [1.8, 1.5, 1.3, 0.85, 0.6, 0.38, 0.27, 0.18],
  400: [1.5, 1.3, 1.1, 0.8, 0.55, 0.33, 0.23, 0.15],
  300: [1.3, 1.15, 0.95, 0.7, 0.5, 0.3, 0.2, 0.12],
  200: [1.1, 1.0, 0.8, 0.6, 0.45, 0.28, 0.18, 0.08],
  150: [0.9, 0.8, 0.7, 0.55, 0.4, 0.25, 0.17, 0.07],
  100: [0.75, 0.7, 0.6, 0.5, 0.35, 0.23, 0.15, 0.05],
  50: [NaN, NaN, 0.45, 0.35, 0.25, 0.2, 0.13, 0.03],
  35: [NaN, NaN, 0.36, 0.29, 0.22, 0.18, 0.12, 0.02],
  25: [NaN, NaN, 0.3, 0.25, 0.2, 0.15, 0.1, 0.02],
};

export const TC_MV = ['10', '7.5', '5', '2.5', '1', '0.4', '0.2', '0'] as const;

export function TC_B9(vVal: string | number): number {
  const m = +vVal;
  return m >= 5 ? 0.12 : m >= 2.5 ? 0.08 : m >= 1 ? 0.04 : m >= 0.4 ? 0.02 : m >= 0.2 ? 0.01 : 0;
}

export const TC_PRE: Readonly<Record<4 | 8, Readonly<Record<string, string>>>> = {
  8: {
    tc_H: '8.0',
    tc_b0: '0.40',
    tc_n1: '0.195',
    tc_n2: '0.205',
    tc_hc: '0.20',
    tc_a1: '0.75',
    tc_a2: '0.40',
    tc_t1: '0.80',
    tc_t2: '1.65',
    tc_hf: '0.50',
    tc_Hs: '0',
    tc_phi: '35',
    tc_delta: '23',
    tc_qRu: '0',
  },
  4: {
    tc_H: '4.0',
    tc_b0: '0.40',
    tc_n1: '0.20',
    tc_n2: '0.20',
    tc_hc: '0.20',
    tc_a1: '0.50',
    tc_a2: '0.40',
    tc_t1: '0.60',
    tc_t2: '1.00',
    tc_hf: '0.50',
    tc_Hs: '0',
    tc_phi: '35',
    tc_delta: '23',
    tc_qRu: '0',
  },
};

export interface TcSoilRefEntry {
  k: string;
  nm: string;
  soil: 'r' | 'd';
  g: number;
  phi: number;
  c: number;
  Su: number;
  N: number;
  pt: number;
}

export const TC_SREF: readonly TcSoilRefEntry[] = [
  { k: 's1', nm: 'Cát sỏi, cát thô - chặt (e ≈ 0,55)', soil: 'r', g: 19.5, phi: 40, c: 1, Su: 0, N: 30, pt: 0.8 },
  { k: 's2', nm: 'Cát hạt trung - chặt vừa (e ≈ 0,60)', soil: 'r', g: 19.0, phi: 36, c: 1, Su: 0, N: 20, pt: 0.8 },
  { k: 's3', nm: 'Cát hạt nhỏ - chặt vừa (e ≈ 0,65)', soil: 'r', g: 18.5, phi: 32, c: 2, Su: 0, N: 15, pt: 0.8 },
  { k: 's4', nm: 'Cát bụi - chặt vừa (e ≈ 0,65)', soil: 'r', g: 18.5, phi: 30, c: 4, Su: 0, N: 12, pt: 0.8 },
  { k: 's5', nm: 'Cát pha - dẻo cứng (IL ≤ 0,25 ; e ≈ 0,65)', soil: 'r', g: 19.0, phi: 27, c: 15, Su: 0, N: 15, pt: 0.8 },
  { k: 's6', nm: 'Sét pha - nửa cứng (IL ≤ 0,25 ; e ≈ 0,65)', soil: 'd', g: 19.5, phi: 24, c: 31, Su: 80, N: 18, pt: 0.85 },
  { k: 's7', nm: 'Sét pha - dẻo cứng (0,25 < IL ≤ 0,5 ; e ≈ 0,75)', soil: 'd', g: 19.0, phi: 21, c: 23, Su: 50, N: 10, pt: 0.85 },
  { k: 's8', nm: 'Sét - nửa cứng (IL ≤ 0,25 ; e ≈ 0,75)', soil: 'd', g: 19.5, phi: 19, c: 54, Su: 100, N: 20, pt: 0.85 },
  { k: 's9', nm: 'Sét - dẻo cứng (0,25 < IL ≤ 0,5 ; e ≈ 0,85)', soil: 'd', g: 18.5, phi: 16, c: 43, Su: 60, N: 12, pt: 0.85 },
];

export const TC_SREF_IDS = [
  'tc_soil',
  'tc_gf',
  'tc_phif',
  'tc_cf',
  'tc_Su',
  'tc_Nspt',
  'tc_phit',
] as const;

export interface Tc86GroupMeta {
  k: TcLib86GroupCode;
  nm: string;
  w: number;
  type: 'vai' | 'chan';
  front: 'v' | 'n';
  mat: 'm' | 'c';
}

export const TC86G: readonly Tc86GroupMeta[] = [
  { k: 'vvm', nm: 'Kè vai, thân đứng - đá xây vữa M100', w: 65 },
  { k: 'vvc', nm: 'Kè vai, thân đứng - bê tông M150', w: 55 },
  { k: 'vnm', nm: 'Kè vai, thân trước nghiêng 5:1 - đá xây vữa M100', w: 64 },
  { k: 'vnc', nm: 'Kè vai, thân trước nghiêng 5:1 - bê tông M150', w: 54 },
  { k: 'cvm', nm: 'Kè chân (trên mái dốc 1:1,5 cao H1), thân đứng - đá xây vữa M100', w: 65 },
  { k: 'cvc', nm: 'Kè chân (trên mái dốc 1:1,5 cao H1), thân đứng - bê tông M150', w: 55 },
  { k: 'cnm', nm: 'Kè chân (trên mái dốc 1:1,5 cao H1), thân trước nghiêng 5:1 - đá xây vữa M100', w: 64 },
  { k: 'cnc', nm: 'Kè chân (trên mái dốc 1:1,5 cao H1), thân trước nghiêng 5:1 - bê tông M150', w: 54 },
].map((g) => ({
  k: g.k as TcLib86GroupCode,
  nm: g.nm,
  w: g.w,
  type: g.k[0] === 'v' ? ('vai' as const) : ('chan' as const),
  front: g.k[1] as 'v' | 'n',
  mat: g.k[2] as 'm' | 'c',
}));

export const TC_U2T: Readonly<Record<string, string>> = {
  á: '¸', à: 'µ', ả: '¶', ã: '·', ạ: '¹',
  ă: '¨', ắ: '¾', ằ: '»', ẳ: '¼', ẵ: '½', ặ: 'Æ',
  â: '©', ấ: 'Ê', ầ: 'Ç', ẩ: 'È', ẫ: 'É', ậ: 'Ë',
  đ: '®',
  é: 'Ð', è: 'Ì', ẻ: 'Î', ẽ: 'Ï', ẹ: 'Ñ',
  ê: 'ª', ế: 'Õ', ề: 'Ò', ể: 'Ó', ễ: 'Ô', ệ: 'Ö',
  í: 'Ý', ì: '×', ỉ: 'Ø', ĩ: 'Ü', ị: 'Þ',
  ó: 'ã', ò: 'ß', ỏ: 'á', õ: 'â', ọ: 'ä',
  ô: '«', ố: 'è', ồ: 'å', ổ: 'æ', ỗ: 'ç', ộ: 'é',
  ơ: '¬', ớ: 'í', ờ: 'ê', ở: 'ë', ỡ: 'ì', ợ: 'î',
  ú: 'ó', ù: 'ï', ủ: 'ñ', ũ: 'ò', ụ: 'ô',
  ư: '­', ứ: 'ø', ừ: 'õ', ử: 'ö', ữ: '÷', ự: 'ù',
  ý: 'ý', ỳ: 'ú', ỷ: 'û', ỹ: 'ü', ỵ: 'þ',
  Ă: '¡', Â: '¢', Đ: '§', Ê: '£', Ô: '¤', Ơ: '¥', Ư: '¦',
};

// ---------------------------------------------------------------------------
// 5. TKĐH 86-06X Helpers & State Controls
// ---------------------------------------------------------------------------

export interface Tc86RowResult {
  G: Tc86GroupMeta;
  t1: number;
  H1: number;
  H: number;
  Rk: string;
  B1: number;
  B2: number;
  B: number;
  C1: number;
  C2: number;
  A: number;
  M: number;
  exact: boolean;
  a: TcLib86RowTuple;
  b: TcLib86RowTuple;
}

export function tc86Tab(gk: TcLib86GroupCode | string, H1: number, Rk: string) {
  const G = TC86G.find((g) => g.k === gk);
  if (!G) return null;
  const t = TC_LIB86.find((x) => x.g === gk && (G.type === 'vai' || x.H1 === H1));
  if (!t) return null;
  return { G, t, rows: Rk === '3' ? t.r3 : t.r2 };
}

export function tc86Row(
  gk: TcLib86GroupCode | string,
  H1: number,
  H: number,
  Rk: string,
): Tc86RowResult | { err: string } | null {
  const X = tc86Tab(gk, H1, Rk);
  if (!X) return null;
  const R = X.rows;
  if (!R || !R.length) return { err: 'Định hình không có bảng cho cường độ nền này' };
  const lo = R[0][0];
  const hi = R[R.length - 1][0];
  if (!(H >= lo - 1e-9 && H <= hi + 1e-9)) {
    return { err: `H ngoài phạm vi bảng (${tf(lo, 1)} ÷ ${tf(hi, 1)} m)` };
  }
  let k = 0;
  while (k < R.length - 2 && H > R[k + 1][0]) k++;
  const a = R[k];
  const b = R[k + 1] || a;
  const s = b[0] > a[0] ? (H - a[0]) / (b[0] - a[0]) : 0;
  const vArr = a.map((x, i) => x + (b[i] - x) * s);
  return {
    G: X.G,
    t1: X.t.t1,
    H1: X.G.type === 'vai' ? 0 : H1,
    H,
    Rk,
    B1: vArr[1],
    B2: vArr[2],
    B: vArr[3],
    C1: vArr[4],
    C2: vArr[5],
    A: vArr[6],
    M: vArr[7],
    exact: s < 1e-9 || s > 1 - 1e-9,
    a,
    b,
  };
}

export function tc86Inputs(r: Tc86RowResult) {
  const vai = r.G.type === 'vai';
  const H = r.H;
  const nf = r.G.front === 'n';
  const Pf = nf ? r.B1 / 100 : 0;
  const w = r.G.w / 100;
  const B = r.B / 100;
  const hs = 0.35;
  const Pb = Math.max(0, B - Pf - w);
  const n2 = H > hs + 0.05 ? Pb / (H - hs) : 0;
  const t1 = r.t1;
  return {
    tc_H: H,
    tc_b0: w - n2 * hs,
    tc_n1: H > 0 ? Pf / H : 0,
    tc_n2: n2,
    tc_hc: 0.2,
    tc_a1: r.C1 / 100,
    tc_a2: r.C2 / 100,
    tc_t1: t1,
    tc_t2: Math.max(r.M / 100, t1),
    tc_hf: vai ? 0.25 : 0.2,
    tc_Hs: vai ? 0 : r.H1,
    tc_m: 1.5,
    tc_LL: '1',
    tc_dT: 1.0,
    tc_q: 0,
    tc_gs: 18,
    tc_phi: 35,
    tc_cs: 0,
    tc_mat: r.G.mat,
  };
}

export const tc86Txt = (r: {
  B1: number;
  B2: number;
  B: number;
  C1: number;
  C2: number;
  A: number;
  M: number;
  G: { front: string };
}): string =>
  `B1 = ${tf(r.B1, 1)}${r.G.front === 'n' ? ` ; B2 = ${tf(r.B2, 1)}` : ''} ; B = ${tf(r.B, 1)} ; C1 = ${tf(r.C1, 1)} ; C2 = ${tf(r.C2, 1)} ; a = ${tf(r.A, 1)} ; m = ${tf(r.M, 1)}`;

export function tcSref(k: string): void {
  const r = TC_SREF.find((x) => x.k === k);
  if (!r) return;
  const vals: Record<string, string> = {
    tc_soil: r.soil,
    tc_gf: r.g.toFixed(1),
    tc_phif: String(r.phi),
    tc_cf: String(r.c),
    tc_Su: String(r.Su),
    tc_Nspt: String(r.N),
    tc_phit: r.pt.toFixed(2),
  };
  for (const [id, x] of Object.entries(vals)) {
    sv(id, x);
  }
}

export function tcSrefInit(): void {
  if (!$('tbTcSref')) return;
  set(
    'tbTcSref',
    `<tr><th>Loại đất, trạng thái</th><th>γ (kN/m³)</th><th>φ (độ)</th><th>c (kPa)</th><th>Su (kPa)</th><th>N (SPT)</th><th>φτ</th></tr>` +
      TC_SREF.map(
        (r) =>
          `<tr><td class="l">${r.nm}</td><td class="c">${tf(r.g, 1)}</td><td class="c">${r.phi}</td><td class="c">${r.c}</td><td class="c">${r.Su || '-'}</td><td class="c">${r.N}</td><td class="c">${tf(r.pt, 2)}</td></tr>`,
      ).join(''),
  );
}

export function tcFmatDef(m: string): void {
  sv(m === 'm' ? 'tc_gfm' : 'tc_gb', m === 'm' ? '23.54' : '21.58');
}

export function tcMatDef(mat: string): void {
  const vals: Record<string, string> =
    mat === 'c'
      ? { tc_gm: '21.58', tc_R: '6.75', tc_Rku: '0.59', tc_Rc: '0.59' }
      : { tc_gm: '23.54' };
  for (const [id, x] of Object.entries(vals)) {
    sv(id, x);
  }
}

export function tcPre(k: 4 | 8, opts?: { force?: boolean }): TcResult | null {
  for (const [id, val] of Object.entries(TC_PRE[k])) {
    sv(id, val);
  }
  return tcStep(opts);
}

// ---------------------------------------------------------------------------
// 6. DXF Section Geometry & R12 Exporter (`tc86Shape`, `tcDxf`)
// ---------------------------------------------------------------------------

export interface Tc86RecordedSpec {
  g: TcLib86GroupCode | string;
  front: 'v' | 'n' | string;
  mat: 'm' | 'c' | string;
  w: number;
  H: number;
  H1?: number;
  t1: number;
  B1: number;
  B2: number;
  B: number;
  C1: number;
  C2: number;
  A: number;
  M: number;
  Rk?: string;
}

export function tc86Shape(r: Tc86RecordedSpec) {
  const t1 = r.t1;
  const H = r.H;
  const w = r.w / 100;
  const B = r.B / 100;
  const C1 = r.C1 / 100;
  const A = r.A / 100;
  const M = r.M / 100;
  const Pf = r.front === 'n' ? r.B1 / 100 : 0;
  const x0 = C1;
  const yt = t1 + H;
  const xft = x0 + Pf;
  return {
    t1,
    H,
    yt,
    A,
    M,
    C1,
    C2: r.C2 / 100,
    B,
    Pf,
    w,
    x0,
    xft,
    foot: [
      [0, 0],
      [0, t1],
      [A, t1],
      [A, t1 - M],
    ] as Point2D[],
    stem: [
      [x0, t1],
      [x0 + B, t1],
      [xft + w, yt - 0.35],
      [xft + w - 0.15, yt - 0.2],
      [xft, yt - 0.2],
    ] as Point2D[],
    cap: [
      [xft - 0.05, yt - 0.2],
      [xft - 0.05, yt - 0.05],
      [xft, yt],
      [xft + w - 0.15, yt],
      [xft + w - 0.15, yt - 0.2],
    ] as Point2D[],
  };
}

export function tcDxf(
  R: TcResult,
  unit: 'm' | 'cm' | 'mm' = 'cm',
  font: 'tcvn3' | 'uni' = 'tcvn3',
): Uint8Array {
  const k = ({ m: 1, cm: 100, mm: 1000 } as const)[unit] || 100;
  const I = R.I;
  const g = R.g;
  const E: string[] = [];
  const tv = font !== 'uni';

  const n = (x: number): string => {
    const val = (+x * k)
      .toFixed(4)
      .replace(/(\.\d*?)0+$/, '$1')
      .replace(/\.$/, '');
    return val === '-0' ? '0' : val;
  };
  const enc = (s: unknown) => {
    const str = String(s);
    if (tv) {
      const up = str === str.toUpperCase() && /[A-ZĐ]/.test(str);
      const t = (up ? str.toLowerCase() : str)
        .split('')
        .map((c) => TC_U2T[c] || c)
        .join('');
      return { t, st: up ? 'TC_VNH' : 'TC_VN' };
    }
    return {
      t: str.replace(
        /[^\x20-\x7e]/g,
        (c) => '\\U+' + c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0'),
      ),
      st: 'TC_ARIAL',
    };
  };
  const fmt = (val: number): string => {
    const x = val * k;
    return unit === 'm'
      ? x.toFixed(2)
      : unit === 'mm'
        ? x.toFixed(0)
        : Math.abs(x - Math.round(x)) < 0.05
          ? x.toFixed(0)
          : x.toFixed(1);
  };
  const L = (ly: string, a: Point2D, b: Point2D) =>
    E.push('0', 'LINE', '8', ly, '10', n(a[0]), '20', n(a[1]), '30', '0', '11', n(b[0]), '21', n(b[1]), '31', '0');
  const PL = (ly: string, pts: ReadonlyArray<Point2D>, closed: boolean) => {
    E.push('0', 'POLYLINE', '8', ly, '66', '1', '70', closed ? '1' : '0', '10', '0', '20', '0', '30', '0');
    pts.forEach((p) => E.push('0', 'VERTEX', '8', ly, '10', n(p[0]), '20', n(p[1]), '30', '0'));
    E.push('0', 'SEQEND', '8', ly);
  };
  const TH = 0.12;
  const TX = (
    ly: string,
    p: Point2D,
    s: string,
    o?: { h?: number; ha?: number; va?: number; rot?: number },
  ) => {
    const opts = o || {};
    const h = opts.h || TH;
    const ha = opts.ha == null ? 1 : opts.ha;
    const va = opts.va == null ? 0 : opts.va;
    const e = enc(s);
    E.push(
      '0', 'TEXT', '8', ly, '7', e.st,
      '10', n(p[0]), '20', n(p[1]), '30', '0',
      '40', n(h), '1', e.t, '50', String(opts.rot || 0),
      '72', String(ha), '11', n(p[0]), '21', n(p[1]), '31', '0',
      '73', String(va),
    );
  };
  const tk = 0.035;
  const KT = 'TC-KICHTHUOC';
  const dimH = (x1: number, x2: number, y: number, yr1: number | null, yr2: number | null, txt: string) => {
    if (Math.abs(x2 - x1) < 1e-4) return;
    L(KT, [x1 - 0.05, y], [x2 + 0.05, y]);
    [x1, x2].forEach((x) => L(KT, [x - tk, y - tk], [x + tk, y + tk]));
    if (yr1 != null) L(KT, [x1, yr1 + (y > yr1 ? 0.03 : -0.03)], [x1, y + (y > yr1 ? 0.05 : -0.05)]);
    if (yr2 != null) L(KT, [x2, yr2 + (y > yr2 ? 0.03 : -0.03)], [x2, y + (y > yr2 ? 0.05 : -0.05)]);
    TX(KT, [(x1 + x2) / 2, y + 0.04], txt, { ha: 1, va: 1 });
  };
  const dimV = (y1: number, y2: number, x: number, xr1: number | null, xr2: number | null, txt: string) => {
    if (Math.abs(y2 - y1) < 1e-4) return;
    L(KT, [x, y1 - 0.05], [x, y2 + 0.05]);
    [y1, y2].forEach((y) => L(KT, [x - tk, y - tk], [x + tk, y + tk]));
    if (xr1 != null) L(KT, [xr1 + (x > xr1 ? 0.03 : -0.03), y1], [x + (x > xr1 ? 0.05 : -0.05), y1]);
    if (xr2 != null) L(KT, [xr2 + (x > xr2 ? 0.03 : -0.03), y2], [x + (x > xr2 ? 0.05 : -0.05), y2]);
    TX(KT, [x - 0.04, (y1 + y2) / 2], txt, { ha: 1, va: 1, rot: 90 });
  };

  let r86: Tc86RecordedSpec | null = null;
  try {
    r86 = JSON.parse(v('tc_src86', 'null') || 'null') as Tc86RecordedSpec | null;
  } catch {
    r86 = null;
  }
  if (
    r86 &&
    !(
      Math.abs(r86.H - I.H) < 1e-6 &&
      Math.abs(r86.C1 / 100 - I.a1) < 1e-6 &&
      Math.abs(r86.C2 / 100 - I.a2) < 1e-6 &&
      r86.mat === I.stemMat &&
      Math.abs(r86.t1 - I.t1) < 1e-6
    )
  ) {
    r86 = null;
  }

  let S: ReturnType<typeof tc86Shape> | null = null;
  let yT: number;
  let xTb: number;
  let yb0: number;
  const hfY = I.t1 + I.hf;
  let ttl = '';
  if (r86) {
    S = tc86Shape(r86);
    PL('TC-KETCAU', S.foot, true);
    PL('TC-KETCAU', S.stem, true);
    PL('TC-KETCAU', S.cap, true);
    yT = S.yt;
    xTb = S.xft + S.w - 0.15;
    yb0 = S.t1 - S.M;
  } else {
    PL('TC-KETCAU', g.foot, true);
    PL('TC-KETCAU', g.stem, true);
    if (g.cap) PL('TC-KETCAU', g.cap, true);
    yT = g.yT;
    xTb = g.xbt;
    yb0 = -g.dy;
  }

  const B = S ? S.A : g.B;
  const G: Point2D[] = [[xTb, yT]];
  if (I.Hs > 1e-9) G.push([xTb + I.m * I.Hs, yT + I.Hs]);
  const gT = G[G.length - 1][1];
  const xE = Math.max(B + 1.5, G[G.length - 1][0] + 2.0);
  const xfF = S ? S.x0 + S.Pf * Math.min(1, Math.max(0, (hfY - S.t1) / (S.H - 0.2))) : g.xf(hfY);
  PL('TC-DAT', [[-1.2, hfY], [xfF, hfY]], false);
  PL('TC-DAT', [...G, [xE, gT]], false);
  PL('TC-DAT', [[-1.2, -0.02], [0, -0.02]], false);
  PL('TC-DAT', [[B, yb0 - 0.02], [xE, yb0 - 0.02]], false);
  if (I.LL) {
    const xl = xTb + (I.Hs > 1e-9 ? I.m * I.Hs : 0) + (I.dT0 != null ? I.dT0 : I.dT);
    if (xl < xE) {
      L('TC-CHU', [xl, gT], [xl, gT + 0.3]);
      TX('TC-CHU', [xl + 0.05, gT + 0.2], 'Mép làn xe', { ha: 0, h: TH * 0.8 });
    }
  }

  const yb = yb0 - 0.45;
  if (S && r86) {
    const x0 = S.x0;
    const xb = x0 + S.B;
    dimH(0, x0, yb, 0, S.t1, fmt(S.C1));
    if (S.Pf > 1e-6) {
      dimH(x0, x0 + S.Pf, yb, S.t1, S.t1, fmt(S.Pf));
      dimH(x0 + S.Pf, xb, yb, S.t1, S.t1, fmt(S.B - S.Pf));
    } else {
      dimH(x0, xb, yb, S.t1, S.t1, fmt(S.B));
    }
    dimH(xb, S.A, yb, S.t1, yb0, fmt(S.C2));
    dimH(0, S.A, yb - 0.3, null, null, fmt(S.A));
    if (S.Pf > 1e-6) dimH(x0, xb, yb - 0.6, null, null, fmt(S.B));
    dimH(S.xft, S.xft + S.w, S.yt + 0.3, S.yt, S.yt - 0.35, fmt(S.w));
    dimV(0, S.t1, -0.45, 0, 0, fmt(S.t1));
    dimV(S.t1, S.yt, -0.45, x0, S.xft - 0.05, fmt(S.H));
    if (I.hf > 1e-6) dimV(0, hfY, -0.8, 0, -1.2, fmt(hfY));
    dimV(yb0, S.t1, S.A + 0.35, S.A, S.A, fmt(S.M));
    dimV(S.yt - 0.2, S.yt, S.xft - 0.3, S.xft - 0.05, S.xft - 0.05, fmt(0.2));
    if (S.Pf > 1e-6) TX('TC-CHU', [(x0 + S.xft) / 2 - 0.12, (S.t1 + S.yt) / 2], '5:1', { ha: 2 });
    ttl = `Theo định hình 86-06X${r86.Rk === '3' ? ', nền R ≥ 3 kg/cm2' : ', nền R = 2 kg/cm2'}${r86.H1 ? ', H1 = ' + r86.H1 + ' m' : ''}`;
  } else {
    dimH(0, g.xfb, yb, 0, I.t1, fmt(I.a1));
    dimH(g.xfb, g.xbb, yb, I.t1, I.t1, fmt(g.xbb - g.xfb));
    dimH(g.xbb, g.B, yb, I.t1, -g.dy, fmt(I.a2));
    dimH(0, g.B, yb - 0.3, null, null, fmt(g.B));
    dimH(g.xft, g.xbt, g.yT + 0.3, g.yT, g.yT, fmt(I.b0));
    dimV(0, I.t1, -0.45, 0, 0, fmt(I.t1));
    dimV(I.t1, g.yT, -0.45, g.xfb, g.xft, fmt(I.H));
    if (I.hf > 1e-6) dimV(0, hfY, -0.8, 0, -1.2, fmt(hfY));
    dimV(-g.dy, I.t1, g.B + 0.35, g.B, g.B, fmt(I.t2));
    const ym = I.t1 + I.H * 0.6;
    if (I.n1 > 1e-6) TX('TC-CHU', [g.xf(ym) - 0.08, ym], `1:${tf(I.n1, 3)}`, { ha: 2 });
    if (Math.abs(I.n2) > 1e-6) TX('TC-CHU', [g.xb(ym) + 0.08, ym], `1:${tf(I.n2, 3)}`, { ha: 0 });
  }
  if (I.Hs > 1e-9) {
    dimV(yT, gT, xE + 0.3, xTb, xE, fmt(I.Hs));
    const p: Point2D = [(G[0][0] + G[1][0]) / 2, (G[0][1] + G[1][1]) / 2];
    TX('TC-CHU', [p[0] - 0.15, p[1] + 0.1], `1:${tf(I.m, 2)}`, { ha: 2 });
  }

  const mat = I.stemMat === 'm' ? 'Đá hộc xây vữa XM M100' : 'Bê tông M150';
  const Hm = S ? S.H : I.H;
  const xm = S
    ? ((S.x0 + S.B + S.xft + S.w) / 2) * 0.5 + S.x0 * 0.5
    : (g.xf(I.t1 + I.H * 0.4) + g.xb(I.t1 + I.H * 0.4)) / 2;
  TX(
    'TC-CHU',
    [
      S ? (S.x0 + S.Pf * 0.3 + S.x0 + S.B - (S.B - S.Pf - S.w) * 0.3) / 2 : xm,
      (S ? S.t1 : I.t1) + Hm * 0.3,
    ],
    mat,
    { ha: 1, va: 2, h: TH * 0.75 },
  );
  TX(
    'TC-CHU',
    [B / 2, S ? S.t1 * 0.55 : I.t1 * 0.5 - g.dy * 0.25],
    I.footMat === 'm'
      ? 'Móng đá hộc xây vữa XM M' + Math.round((+v('tc_fmvua', '10') || 10) * 10)
      : 'Móng bê tông M150',
    { ha: 1, va: 2, h: TH * 0.9 },
  );
  if (S) TX('TC-CHU', [S.xft + S.w * 0.4, S.yt - 0.1], 'BT M150', { ha: 1, va: 2, h: TH * 0.6 });
  TX('TC-CHU', [xE - 0.1, (gT + I.t1) / 2], 'Đất đắp', { ha: 2 });
  TX('TC-CHU', [-1.1, hfY + 0.1], 'Đất nền', { ha: 0, h: TH * 0.9 });
  TX('TC-CHU', [B / 2, yb - 0.95], `MẶT CẮT NGANG TƯỜNG CHẮN H = ${tf(I.H, 2)} M`, {
    ha: 1,
    h: TH * 1.6,
  });
  TX('TC-CHU', [B / 2, yb - 1.2], `Kích thước ghi bằng ${unit}${ttl ? ' - ' + ttl : ''}`, {
    ha: 1,
    h: TH * 0.9,
  });

  const out: string[] = [];
  const xs: [number, number] = [-1.3, xE + 0.6];
  const ys: [number, number] = [yb - 1.3, gT + 0.6];
  const lay: Array<[string, number]> = [
    ['TC-KETCAU', 7],
    ['TC-DAT', 3],
    ['TC-KICHTHUOC', 4],
    ['TC-CHU', 2],
  ];
  const sty: Array<[string, string]> = [
    ['TC_ARIAL', 'arial.ttf'],
    ['TC_VN', 'vnarial.ttf'],
    ['TC_VNH', 'vnarialh.ttf'],
  ];

  out.push(
    '0', 'SECTION', '2', 'HEADER',
    '9', '$ACADVER', '1', 'AC1009',
    '9', '$DWGCODEPAGE', '3', 'ANSI_1252',
    '9', '$INSBASE', '10', '0', '20', '0', '30', '0',
    '9', '$EXTMIN', '10', n(xs[0]), '20', n(ys[0]), '30', '0',
    '9', '$EXTMAX', '10', n(xs[1]), '20', n(ys[1]), '30', '0',
    '0', 'ENDSEC',
  );
  out.push(
    '0', 'SECTION', '2', 'TABLES',
    '0', 'TABLE', '2', 'LTYPE', '70', '1',
    '0', 'LTYPE', '2', 'CONTINUOUS', '70', '0', '3', 'Solid line', '72', '65', '73', '0', '40', '0.0',
    '0', 'ENDTAB',
  );
  out.push('0', 'TABLE', '2', 'LAYER', '70', String(lay.length));
  lay.forEach(([nm, c]) => out.push('0', 'LAYER', '2', nm, '70', '0', '62', String(c), '6', 'CONTINUOUS'));
  out.push('0', 'ENDTAB');
  out.push('0', 'TABLE', '2', 'STYLE', '70', String(sty.length));
  sty.forEach(([nm, f]) =>
    out.push('0', 'STYLE', '2', nm, '70', '0', '40', '0', '41', '1', '50', '0', '71', '0', '42', n(TH), '3', f, '4', ''),
  );
  out.push('0', 'ENDTAB', '0', 'ENDSEC');
  out.push('0', 'SECTION', '2', 'ENTITIES', ...E, '0', 'ENDSEC', '0', 'EOF');
  const txt = out.join('\r\n') + '\r\n';
  const b = new Uint8Array(txt.length);
  for (let i = 0; i < txt.length; i++) {
    const c = txt.charCodeAt(i);
    b[i] = c < 256 ? c : 63;
  }
  return b;
}

// ---------------------------------------------------------------------------
// 7. Input Extraction & Step Runner (`tcInputs`, `tcStep`, `toGravityWallResult`)
// ---------------------------------------------------------------------------

let latestTcResult: TcResult | null = null;

export function getLatestTcResult(): TcResult | null {
  return latestTcResult;
}

export function setLatestTcResult(res: TcResult | null): void {
  latestTcResult = res;
}

export const tcN = (id: string): number => num(id, 0);

const tcOk = (b: boolean): string => `<span class="${b ? 'ok' : 'bad'}">${b ? 'Đạt' : 'Không đạt'}</span>`;

export function tcInputs(): TcInput {
  const mat = (v('tc_mat', 'm') || 'm') as 'm' | 'c';
  const autoVal = v('tc_auto', '');
  if (mat === 'm' && autoVal === '1') {
    const r = TC_B7[tcN('tc_mda')];
    const i = TC_MV.indexOf(v('tc_mvua', '10') as (typeof TC_MV)[number]);
    const R = r ? r[i] : NaN;
    const k = TC_B9(v('tc_mvua', '10'));
    if (Number.isFinite(R)) sv('tc_R', R.toFixed(2));
    sv('tc_Rku', k.toFixed(2));
    sv('tc_Rc', k.toFixed(2));
  }
  for (const id of ['tc_R', 'tc_Rku', 'tc_Rc']) {
    const el = $(id);
    if (el) el.readOnly = mat === 'm' && autoVal === '1';
  }
  const mBox = $('tc_mBox');
  if (mBox && mBox.style) mBox.style.display = mat === 'm' ? '' : 'none';

  const fmat = (v('tc_fmat', 'c') || 'c') as 'm' | 'c';
  const fauto = !$('tc_fauto') || v('tc_fauto', '1') === '1';
  if (fmat === 'm' && fauto && $('tc_fmvua')) {
    const k = TC_B9(v('tc_fmvua', '10'));
    sv('tc_fRku', k.toFixed(2));
    sv('tc_fRc', k.toFixed(2));
  }
  for (const id of ['tc_fRku', 'tc_fRc']) {
    const el = $(id);
    if (el) el.readOnly = fmat === 'm' && fauto;
  }

  const rowVis = (id: string, show: boolean) => {
    const e = $(id);
    const r = e?.closest?.('.row');
    if (r && r.style) r.style.display = show ? '' : 'none';
  };
  const elVis = (id: string, show: boolean) => {
    const e = $(id);
    if (e && e.style) e.style.display = show ? '' : 'none';
  };

  rowVis('tc_Rbtf', fmat !== 'm');
  ['tc_gfm', 'tc_fRku', 'tc_fRc'].forEach((id) => rowVis(id, fmat === 'm'));
  elVis('tc_fmBox', fmat === 'm');

  const soil = v('tc_soil', 'r') || 'r';
  const rock = soil === 'a';
  const brm = v('tc_brm', 'lt') || 'lt';
  const brmR = v('tc_brmR', 'ck') || 'ck';

  elVis('tc_soilBox', !rock);
  elVis('tc_rockBox', rock);
  elVis('tc_sptBox', !rock && brm === 'spt');
  rowVis('tc_phib', !rock && brm === 'lt');
  rowVis('tc_Su', soil === 'd');
  rowVis('tc_qRu', rock ? brmR === 'kt' : brm === 'kt');
  ['tc_qu', 'tc_RMR', 'tc_rockT', 'tc_phibR'].forEach((id) => rowVis(id, brmR !== 'kt'));

  const phifRow = $('tc_phif')?.closest?.('.row');
  if (phifRow?.children && phifRow.children[1]) {
    phifRow.children[1].textContent = rock
      ? `Góc ma sát giữa đáy móng ${fmat === 'm' ? 'đá hộc xây' : 'bê tông'} và đá (dùng khi tính trượt)`
      : 'Góc ma sát trong của đất nền';
  }
  const phitRow = $('tc_phit')?.closest?.('.row');
  if (phitRow?.children && phitRow.children[1]) {
    phitRow.children[1].textContent = rock
      ? 'Hệ số sức kháng trượt (Bảng 8: bê tông đổ tại chỗ trên nền đá lấy như trên cát, 0,80)'
      : 'Hệ số sức kháng trượt (Bảng 8: bê tông đổ tại chỗ trên cát 0,80; trên sét 0,85)';
  }

  return {
    H: tcN('tc_H'),
    b0: tcN('tc_b0'),
    n1: tcN('tc_n1'),
    n2: tcN('tc_n2'),
    hc: Math.min(tcN('tc_hc'), tcN('tc_H')),
    a1: tcN('tc_a1'),
    a2: tcN('tc_a2'),
    t1: tcN('tc_t1'),
    t2: Math.max(tcN('tc_t2'), tcN('tc_t1')),
    hf: tcN('tc_hf'),
    m: tcN('tc_m'),
    Hs: tcN('tc_Hs'),
    q: tcN('tc_q'),
    LL: v('tc_LL', '1') === '1',
    dT: tcN('tc_dT'),
    gs: tcN('tc_gs'),
    phi: tcN('tc_phi'),
    delta: tcN('tc_delta'),
    cs: Math.max(0, tcN('tc_cs')),
    gm: tcN('tc_gm'),
    gb: tcN('tc_gb'),
    stemMat: mat,
    R: tcN('tc_R'),
    Rku: tcN('tc_Rku'),
    Rc: tcN('tc_Rc'),
    gr: tcN('tc_gr'),
    nsh: mat === 'm' ? 0.5 : 1,
    mu: 0.7,
    md: 1,
    phi1: 1,
    Rbtf: tcN('tc_Rbtf'),
    footMat: fmat,
    gfm: tcN('tc_gfm'),
    fRku: tcN('tc_fRku'),
    fRc: tcN('tc_fRc'),
    gf: tcN('tc_gf'),
    phif: tcN('tc_phif'),
    cf: tcN('tc_cf'),
    soil: rock ? 'r' : soil,
    Su: tcN('tc_Su'),
    Dw: tcN('tc_Dw'),
    rock,
    brmR,
    qu: tcN('tc_qu'),
    RMR: tcN('tc_RMR'),
    rockT: v('tc_rockT', 'B') || 'B',
    phibR: tcN('tc_phibR') || 0.45,
    phib: tcN('tc_phib'),
    phit: tcN('tc_phit'),
    qRu: tcN('tc_qRu'),
    eta: tcN('tc_eta') || 1,
    brm,
    Nspt: tcN('tc_Nspt'),
    Ri: tcN('tc_Ri') || 1,
    phibS: tcN('tc_phibS') || 0.45,
    ctD: tcN('tc_ctD'),
    ctL: tcN('tc_ctL'),
    ctn: tcN('tc_ctn'),
    ctm: tcN('tc_ctm') || 0.8,
    ctF: tcN('tc_ctF') || 1.4,
  };
}

export function tcStep(opts?: { force?: boolean }): TcResult | null {
  if (!opts?.force && !$('tab41')) return null;

  let I: TcInput;
  let R: TcResult;
  try {
    I = tcInputs();
    R = tcCalc(I);
  } catch (e) {
    console.error(e);
    return null;
  }

  latestTcResult = R;
  const g = R.g;
  const Ld = R.Ld;
  const w = Ld.w0;

  set('o_tc_B', tf(g.B, 3));
  set('o_tc_eps', `${tf((g.eps * 180) / Math.PI, 2)} ; ${tf(g.Bs, 3)}`);
  set('o_tc_Df', tf(I.t1 + I.hf, 2));
  set('o_tc_Hp', tf(g.Hp, 3));
  set('o_tc_src', v('tc_src', '') || 'Kích thước nhập trực tiếp.');
  set('o_tc_ttl2', `KIỂM TOÁN TƯỜNG CHẮN TRỌNG LỰC H = ${tf(I.H, 2)} m, B = ${tf(g.B, 2)} m`);

  let h =
    `<tr><th>Khối</th><th>Thành phần</th><th>Loại</th><th>Diện tích (m²)</th><th>γ (kN/m³)</th><th>Trọng lượng (kN)</th><th>x (m)</th><th>y (m)</th></tr>`;
  let sDC = 0;
  let sEV = 0;
  Ld.L.filter((l) => l.ty === 'DC' || l.ty === 'EV').forEach((l, i) => {
    h += `<tr><td class="c">${i + 1}</td><td class="l">${l.nm}</td><td class="c">${l.ty}</td><td>${tf(l.A, 3)}</td><td>${tf(l.g, 2)}</td><td>${tf(-l.Fy, 2)}</td><td>${tf(l.x, 3)}</td><td>${tf(l.y, 3)}</td></tr>`;
    if (l.ty === 'DC') sDC -= l.Fy;
    else sEV -= l.Fy;
  });
  h += `<tr class="grp"><td class="l" colspan="5">Tổng DC ; tổng EV</td><td>${tf(sDC, 2)} ; ${tf(sEV, 2)}</td><td colspan="2"></td></tr>`;
  set('tbTcW', h);

  const th = 180 - w.theta;
  const beta = I.Hs > 1e-9 ? (Math.atan(1 / I.m) * 180) / Math.PI : 0;
  const coulOK = Number.isFinite(R.coul);
  set(
    'o_tc_ehm',
    I.Hs > 1e-9
      ? `Mặt đất phía sau gãy khúc (mái dốc 1:${tf(I.m, 2)} cao ${tf(I.Hs, 2)} m rồi nằm ngang): lực đẩy chủ động xác định bằng phương pháp nêm thử (thử dần mặt trượt phẳng góc ρ, lấy giá trị lớn nhất), cùng giả thiết Coulomb (TCVN 11823-3, Điều 11.5.3; AASHTO LRFD 7th Ed. (2014), C3.11.5.3).${coulOK ? '' : ` Mái dốc β = ${tf(beta, 2)}° > φ'f: công thức Coulomb (mái dốc vô hạn) không áp dụng được.`} Hệ số Ka tương đương: Ka = 2Pa/(γs.H'²).`
      : `Mặt đất phía sau nằm ngang (β = 0): dùng công thức Coulomb; kết quả nêm thử ghi để đối chứng.`,
  );

  set(
    'tbTcEH',
    `<tr><th>Đại lượng</th><th>Ký hiệu</th><th>Giá trị</th><th>Đơn vị</th></tr>` +
      [
        ['Góc mặt phẳng tính áp lực với phương ngang (phía đất đắp)', 'θ', tf(th, 2), 'độ'],
        ['Góc mái dốc đất đắp với phương ngang', 'β', tf(beta, 2), 'độ'],
        ['Góc ma sát trong đất đắp ; góc ma sát với tường', "φ'f ; δ", `${tf(I.phi, 1)} ; ${tf(I.delta, 1)}`, 'độ'],
        ['Lực dính đất đắp kể đến trên mặt trượt (nêm thử)', "c'", tf(I.cs || 0, 1), 'kPa'],
        ['Hệ số áp lực chủ động Coulomb (PT 3.11.5.3-1)', 'Ka', coulOK ? tf(R.coul, 4) : 'không áp dụng', ''],
        ['Góc mặt trượt tới hạn (nêm thử)', 'ρ', tf(w.rho, 2), 'độ'],
        ['Trọng lượng nêm trượt tới hạn', 'W', tf(w.W, 2), 'kN'],
        ['Hệ số áp lực tương đương (nêm thử)', 'Ka', tf(w.Ka, 4), ''],
        ['Chiều cao mặt phẳng tính áp lực', "H'", tf(g.Hp, 3), 'm'],
        ['Lực đẩy chủ động', 'Pa', tf(w.P, 2), 'kN'],
        ['Thành phần nằm ngang ; thẳng đứng', 'Pa,h ; Pa,v', `${tf(-w.F[0], 2)} ; ${tf(-w.F[1], 2)}`, 'kN'],
        ["Điểm đặt (cao hơn đáy gót móng H'/3)", '', tf(g.Hp / 3, 3), 'm'],
      ]
        .map((r) => `<tr><td class="l">${r[0]}</td><td class="c">${r[1]}</td><td>${r[2]}</td><td class="c">${r[3]}</td></tr>`)
        .join(''),
  );

  set(
    'tbTcHeq',
    `<tr><th rowspan="2">Chiều cao tường H (m)</th><th colspan="2">heq (m) theo khoảng cách lưng tường - mép làn xe</th></tr><tr><th>0,0 m</th><th>≥ 0,3 m</th></tr>` +
      [
        [1.5, 1.5, 0.6],
        [3.0, 1.05, 0.6],
        ['≥ 6,0', 0.6, 0.6],
      ]
        .map((r) => `<tr><td class="c">${r[0]}</td><td class="c">${r[1]}</td><td class="c">${r[2]}</td></tr>`)
        .join(''),
  );

  I = R.I;
  set(
    'o_tc_ls',
    !I.LL
      ? 'Không có hoạt tải xe phía sau tường: không xét LS.'
      : Ld.lsOn
        ? `${I.Hs > 1e-9 ? `Có mái taluy: mép làn xe cách đỉnh mái ${tf(I.dT0, 2)} m, cách lưng tường m.Hs + ${tf(I.dT0, 2)} = ${tf(I.dT, 2)} m. ` : ''}Mép làn xe cách lưng tường d = ${tf(I.dT, 2)} m ≤ H'/2 = ${tf(g.Hp / 2, 2)} m: phải xét LS (Điều 11.6.4). Nội suy Bảng 23 (TCVN 11823-3; AASHTO Bảng 3.11.6.4-2) với H' = ${tf(g.Hp, 2)} m: heq = ${tf(Ld.heq, 3)} m; ${Ld.lsW ? `mặt đất sau tường có mái dốc nên không dùng hệ số Ka tương đương của mái dốc cho LS (công thức Δp = k.γs.heq lập cho mặt đất nằm ngang): PLS xác định bằng nêm thử với tải phân bố γs.heq = ${tf(I.gs * Ld.heq, 2)} kPa đặt trên mặt đất từ mép làn xe trở ra (cùng phương pháp tính EH): PLS = ${tf(Ld.PLS, 2)} kN` : `k = Ka = ${tf(w.Ka, 4)}; Δp = ${tf(w.Ka * I.gs * Ld.heq, 3)} kPa; PLS = ${tf(Ld.PLS, 2)} kN`}, nghiêng góc δ như Pa, điểm đặt tại H'/2.`
        : `${I.Hs > 1e-9 ? `Có mái taluy: mép làn xe cách đỉnh mái ${tf(I.dT0, 2)} m, cách lưng tường m.Hs + ${tf(I.dT0, 2)} = ${tf(I.dT, 2)} m. ` : ''}Mép làn xe cách lưng tường d = ${tf(I.dT, 2)} m > H'/2 = ${tf(g.Hp / 2, 2)} m: không phải xét LS (Điều 11.6.4).`,
  );

  const C0 = g.C0;
  h = `<tr><th>Tải trọng</th><th>Loại</th><th>V (kN)</th><th>H (kN)</th><th>x (m)</th><th>y (m)</th><th>MC (kN.m)</th></tr>`;
  for (const l of Ld.L) {
    const M = (l.x - C0[0]) * l.Fy - (l.y - C0[1]) * l.Fx;
    h += `<tr><td class="l">${l.nm}</td><td class="c">${l.ty}</td><td>${tf(-l.Fy, 2)}</td><td>${tf(-l.Fx, 2)}</td><td>${tf(l.x, 3)}</td><td>${tf(l.y, 3)}</td><td>${tf(M, 2)}</td></tr>`;
  }
  set(
    'tbTcL',
    h + `<tr><td class="l" colspan="7">Tâm đáy móng C: x = ${tf(C0[0], 3)} m ; y = ${tf(C0[1], 3)} m.</td></tr>`,
  );

  const T: Array<TcLoadItem['ty']> = ['DC', 'EV', 'EH', 'ES', 'LSh', 'LSv'];
  const TN: Record<TcLoadItem['ty'], string> = {
    DC: 'DC',
    EV: 'EV',
    EH: 'EH',
    ES: 'ES',
    LSh: 'LS (ngang)',
    LSv: 'LS (đứng)',
  };
  set(
    'tbTcF',
    `<tr><th>Tổ hợp</th>${T.map((t) => `<th>${TN[t]}</th>`).join('')}</tr>` +
      TC_COMB.map(
        (c) =>
          `<tr><td class="l">${c.nm}</td>${T.map((t) => `<td class="c">${tf(c.sd ? 1 : c.mn[t] ? c.f[t] / I.eta : c.f[t] * I.eta, 2)}</td>`).join('')}</tr>`,
      ).join(''),
  );

  set(
    'tbTcC',
    `<tr><th>Tổ hợp</th><th>V (kN)</th><th>H (kN)</th><th>MC (kN.m)</th><th>N' (kN)</th><th>H' (kN)</th><th>e (m)</th></tr>` +
      R.C.map(
        (c) =>
          `<tr><td class="l">${c.nm}</td><td>${tf(c.V)}</td><td>${tf(c.H)}</td><td>${tf(c.M)}</td><td>${tf(c.N)}</td><td>${tf(c.Hd)}</td><td>${tf(c.e, 3)} ${c.toToe ? '(về mũi)' : '(về gót)'}</td></tr>`,
      ).join(''),
  );

  const S2 = R.C.filter((c) => !c.sd);
  set(
    'tbTcE',
    `<tr><th>Tổ hợp</th><th>e (m)</th><th>giới hạn ${I.rock ? '0,45B*' : 'B*/3'} (m)</th><th>Kết quả</th></tr>` +
      S2.map((c) => `<tr><td class="l">${c.nm}</td><td>${tf(c.e, 3)}</td><td>${tf(R.eLim, 3)}</td><td class="c">${tcOk(c.okE)}</td></tr>`).join(''),
  );
  set(
    'klTcE',
    `KẾT LUẬN: ${R.ok.e ? 'Độ lệch tâm của hợp lực ĐẠT YÊU CẦU.' : 'Độ lệch tâm của hợp lực KHÔNG ĐẠT - cần mở rộng móng hoặc tăng trọng lượng tường.'}`,
  );
  cls('klTcE', 'kl ' + (R.ok.e ? 'ok' : 'bad'));

  set(
    'tbTcS',
    `<tr><th>Tổ hợp</th><th>N' (kN)</th><th>${I.soil === 'd' ? "Su ; 0,5σ'v (kPa)" : 'tan φf'}</th><th>Rτ (kN)</th><th>φτ</th><th>RR (kN)</th><th>H' (kN)</th><th>Kết quả</th></tr>` +
      S2.map(
        (c) =>
          `<tr><td class="l">${c.nm}</td><td>${tf(c.N)}</td><td>${I.soil === 'd' ? `${tf(I.Su, 1)} ; ${tf((0.5 * c.N) / g.Bs, 1)}` : tf(Math.tan(rad(I.phif)), 4)}</td><td>${tf(c.sl.Rt)}</td><td>${tf(I.phit, 2)}</td><td>${tf(c.sl.RR)}</td><td>${tf(c.Hd)}</td><td class="c">${tcOk(c.sl.ok)}</td></tr>`,
      ).join(''),
  );
  set(
    'klTcS',
    `KẾT LUẬN: ${R.ok.sl ? 'Tường ĐẠT YÊU CẦU về trượt.' : 'Tường KHÔNG ĐẠT về trượt - cần tăng bề rộng, độ nghiêng đáy móng hoặc làm răng chống trượt.'}`,
  );
  cls('klTcS', 'kl ' + (R.ok.sl ? 'ok' : 'bad'));

  const HD = `<tr><th>Đại lượng</th><th>Ký hiệu</th>${S2.map((c) => `<th>${c.k === 'Ia' ? 'CĐ I-a' : 'CĐ I-b'}</th>`).join('')}<th>Đơn vị</th></tr>`;
  const rw = (lab: string, sym: string, fn: (c: TcComboResult) => string | number, u: string, d = 3) =>
    `<tr><td class="l">${lab}</td><td class="c">${sym}</td>${S2.map((c) => {
      const val = fn(c);
      return `<td>${typeof val === 'string' ? val : tf(val, d)}</td>`;
    }).join('')}<td class="c">${u}</td></tr>`;

  const bm = R.ok.brm;
  const vis8 = (id: string, show: boolean) => {
    const e = $(id);
    if (e && e.style) e.style.display = show ? '' : 'none';
  };
  vis8('tc_fSo', !I.rock);
  vis8('tc_fRo', I.rock);
  vis8('tc_fLt', bm === 'lt');
  vis8('tc_fSpt', bm === 'spt');
  vis8('tc_fRk', bm === 'rock');
  vis8('tc_fKt', bm === 'kt');
  vis8('tc_ctOut', R.ok.ct);

  set(
    'o_tc_b0',
    I.rock
      ? `Móng đặt trên nền đá: ứng suất đáy móng phân bố tuyến tính trên toàn bề rộng B*, lấy giá trị lớn nhất σmax (TCVN 11823-11, Điều 6.3.2); sức kháng đỡ ${bm === 'kt' ? 'lấy theo thí nghiệm' : 'xác định theo cường độ nén một trục qu và chỉ số RMR của khối đá (TCVN 11823-10, Điều 6.3.2.2)'}. Gia cố nền không xét.`
      : `Móng đặt trên nền đất: ứng suất đáy móng phân bố đều trên bề rộng có hiệu B' = B* − 2e (TCVN 11823-11, Điều 6.3.2); sức kháng đỡ ${bm === 'lt' ? 'tính theo phương pháp lý thuyết từ c, φ của đất (TCVN 11823-10, Điều 6.3.1.2)' : bm === 'spt' ? 'tính theo kết quả SPT (TCVN 11823-10, Điều 6.3.1.3)' : 'lấy theo thí nghiệm'}. Nếu nền tự nhiên không đạt, mục 8.4 kiểm tra giải pháp gia cố cọc tre.`,
  );

  set(
    'tbTcB1',
    HD +
      rw('Lực pháp tuyến đáy móng', "N'", (c) => c.N, 'kN', 2) +
      rw('Độ lệch tâm', 'e', (c) => c.e, 'm') +
      (I.rock
        ? rw('Bề rộng đáy móng theo phương nghiêng', 'B*', () => g.Bs, 'm') +
          rw('Ứng suất lớn nhất (phân bố tuyến tính)', 'σmax', (c) => c.sigMax, 'kPa', 2) +
          rw('Ứng suất nhỏ nhất', 'σmin', (c) => c.sigMin, 'kPa', 2)
        : rw("Bề rộng có hiệu B' = B* − 2e", "B'", (c) => c.Bp, 'm') +
          rw("Ứng suất thẳng đứng (phân bố đều trên B')", 'σV', (c) => c.sigU, 'kPa', 2)),
  );

  let hb = HD;
  if (bm === 'kt') {
    hb += rw('Sức kháng tính toán của nền theo thí nghiệm', 'qR', (c) => c.br!.qR, 'kPa', 2);
  } else if (bm === 'rock') {
    hb +=
      rw('Cường độ chịu nén một trục của đá', 'qu', (c) => (c.br as TcBearingRock).qu, 'MPa', 1) +
      rw('Chỉ số RMR ; hệ số mi (nhóm ' + I.rockT + ')', 'RMR ; mi', (c) => `${tf((c.br as TcBearingRock).RMR, 0)} ; ${tf((c.br as TcBearingRock).mi, 0)}`, '') +
      rw('Hằng số khối đá m = mi.exp((RMR − 100)/14)', 'm', (c) => (c.br as TcBearingRock).m, '', 4) +
      rw('Hằng số khối đá s = exp((RMR − 100)/6)', 's', (c) => (c.br as TcBearingRock).s.toExponential(3), '') +
      rw('Hệ số √s + √(m√s + s)', 'k', (c) => (c.br as TcBearingRock).k, '', 4) +
      rw('Sức kháng danh định qn = k.qu', 'qn', (c) => (c.br as TcBearingRock).qn, 'kPa', 1) +
      rw(`Sức kháng tính toán qR = φb.qn (φb = ${tf(I.phibR, 2)})`, 'qR', (c) => c.br!.qR, 'kPa', 1);
  } else if (bm === 'spt') {
    hb +=
      rw('Chiều sâu chôn móng', 'Df', (c) => (c.br as TcBearingSpt).Df, 'm', 2) +
      rw("Ứng suất thẳng đứng có hiệu tại đáy móng σ'v = γ.Df", "σ'v", (c) => (c.br as TcBearingSpt).sv * 1000, 'kPa', 2) +
      rw("Hệ số hiệu chỉnh CN = 0,77 log10(1,92/σ'v) ≤ 2 (σ'v tính bằng MPa)", 'CN', (c) => (c.br as TcBearingSpt).CN, '', 3) +
      rw('Số búa SPT ; số búa hiệu chỉnh Ncorr = CN.N', 'N ; Ncorr', (c) => `${tf((c.br as TcBearingSpt).N, 0)} ; ${tf((c.br as TcBearingSpt).Ncorr, 2)}`, 'búa') +
      rw('Hệ số mực nước ngầm', 'Cwq ; Cwγ', (c) => `${tf((c.br as TcBearingSpt).Cwq, 2)} ; ${tf((c.br as TcBearingSpt).Cwg, 2)}`, '') +
      rw('Hệ số chiết giảm do tải trọng nghiêng', 'Ri', (c) => (c.br as TcBearingSpt).Ri, '', 2) +
      rw('Sức kháng danh định', 'qn', (c) => (c.br as TcBearingSpt).qn, 'kPa', 2) +
      rw(`Sức kháng tính toán qR = φb.qn (φb = ${tf(I.phibS, 2)})`, 'qR', (c) => c.br!.qR, 'kPa', 2);
  } else {
    hb +=
      rw(`Hệ số khả năng chịu tải (φf = ${tf(I.phif, 1)}°)`, 'Nc ; Nq ; Nγ', (c) => {
        const b = c.br as TcBearingTheoretical;
        return `${tf(b.F.Nc, 2)} ; ${tf(b.F.Nq, 2)} ; ${tf(b.F.Ng, 2)}`;
      }, '') +
      rw('Tải trọng không hệ số SD I (H ; V)', 'H ; V', (c) => `${tf((c.br as TcBearingTheoretical).H, 2)} ; ${tf((c.br as TcBearingTheoretical).V, 2)}`, 'kN') +
      rw('Hệ số tải trọng nghiêng', 'ic ; iq ; iγ', (c) => {
        const b = c.br as TcBearingTheoretical;
        return `${tf(b.ic, 3)} ; ${tf(b.iq, 3)} ; ${tf(b.ig, 3)}`;
      }, '') +
      rw('Hệ số mực nước ngầm', 'Cwq ; Cwγ', (c) => {
        const b = c.br as TcBearingTheoretical;
        return `${tf(b.Cwq, 2)} ; ${tf(b.Cwg, 2)}`;
      }, '') +
      rw('Chiều sâu chôn móng', 'Df', (c) => (c.br as TcBearingTheoretical).Df, 'm', 2) +
      rw('Sức kháng danh định', 'qn', (c) => (c.br as TcBearingTheoretical).qn, 'kPa', 2) +
      rw(`Sức kháng tính toán qR = φb.qn (φb = ${tf(I.phib, 2)})`, 'qR', (c) => c.br!.qR, 'kPa', 2);
  }
  set('tbTcB', hb);

  const sg = I.rock ? 'σmax' : 'σV';
  set(
    'tbTcB3',
    HD +
      rw('Ứng suất đáy móng', sg, (c) => c.sigB, 'kPa', 2) +
      rw('Sức kháng đỡ tính toán của nền', 'qR', (c) => c.br!.qR, 'kPa', 2) +
      rw(`Tỷ số sử dụng ${sg}/qR`, '', (c) => c.sigB / c.br!.qR, '', 3) +
      `<tr><td class="l">Kiểm tra ${sg} ≤ qR</td><td></td>${S2.map((c) => `<td class="c">${tcOk(c.okB0)}</td>`).join('')}<td></td></tr>`,
  );

  const b0 = R.ok.br0;
  set(
    'klTcB',
    `KẾT LUẬN: ${b0 ? (I.rock ? 'Nền đá ĐẢM BẢO sức kháng đỡ.' : 'Nền đất tự nhiên ĐẢM BẢO sức chịu tải - không phải gia cố.') : I.rock ? 'Nền đá KHÔNG ĐẢM BẢO sức kháng đỡ - cần mở rộng móng hoặc hạ móng đặt vào lớp đá tốt hơn.' : 'Nền đất tự nhiên KHÔNG ĐẢM BẢO sức chịu tải - kiểm tra giải pháp gia cố cọc tre tại mục 8.4.'}`,
  );
  cls('klTcB', 'kl ' + (b0 ? 'ok' : 'bad'));

  if (R.ok.ct) {
    set(
      'tbTcCt',
      `<tr><th>Đại lượng</th><th>Ký hiệu</th>${S2.map((c) => `<th>${c.k === 'Ia' ? 'CĐ I-a' : 'CĐ I-b'}</th>`).join('')}<th>Đơn vị</th></tr>` +
        rw('Đường kính ; chiều dài cọc tre', 'D ; Lc', (c) => `${tf(c.ct!.D, 2)} ; ${tf(c.ct!.L, 2)}`, 'm') +
        rw('Mật độ cọc', 'n', (c) => tf(c.ct!.n, 0), 'cọc/m²') +
        rw('Thể tích cọc chiếm chỗ trong 1 m³ đất', 'Vct', (c) => c.ct!.V, 'm³', 4) +
        rw('Sức kháng tính toán của nền tự nhiên', 'qR', (c) => c.ct!.qR, 'kPa', 2) +
        rw('Sức chịu tải của đất nền sau khi đóng cọc R1 = qR/(1 − Vct)', 'R1', (c) => c.ct!.R1, 'kPa', 2) +
        rw(`Sức chịu tải giới hạn một cọc (tra theo ${tf(R.Ia.ct!.nTab, 0)} cọc/m²)`, 'Qgh', (c) => c.ct!.Qgh, 'T/cọc', 2) +
        rw('Hệ số đồng nhất ; hệ số an toàn', 'm ; F', (c) => `${tf(c.ct!.m, 2)} ; ${tf(c.ct!.F, 2)}`, '') +
        rw('Sức chịu tải tính toán một cọc Qct = (m/F).Qgh', 'Qct', (c) => c.ct!.Qct, 'kN/cọc', 3) +
        rw('Sức chịu tải của nền sau gia cố Rct = R1 + n.Qct', 'Rct', (c) => c.ct!.Rct, 'kPa', 2) +
        rw('Ứng suất thẳng đứng đáy móng', 'σV', (c) => c.sigB, 'kPa', 2) +
        `<tr><td class="l">Kiểm tra σV ≤ Rct</td><td></td>${S2.map((c) => `<td class="c">${tcOk(c.okB)}</td>`).join('')}<td></td></tr>`,
    );
    set(
      'klTcCt',
      `KẾT LUẬN: ${R.ok.br ? 'Nền sau khi gia cố cọc tre ĐẢM BẢO sức chịu tải.' : 'Nền sau khi gia cố cọc tre vẫn KHÔNG ĐẢM BẢO - tăng mật độ cọc, mở rộng móng hoặc chọn giải pháp gia cố khác.'}`,
    );
    cls('klTcCt', 'kl ' + (R.ok.br ? 'ok' : 'bad'));
  }

  {
    const sMax = Math.max(...S2.map((c) => c.sigB));
    const tReq = Math.max(...S2.map((c) => c.Hd / (I.phit * c.N)));
    const phiReq = (Math.atan(tReq) * 180) / Math.PI;
    const SuReq = Math.max(...S2.map((c) => c.Hd / (I.phit * g.Bs)));
    const src = v('tc_src', '');
    const R86 = /R ≥ 3 kg/.test(src) ? 294.3 : 196.2;
    const s86 = /86-06X/.test(src)
      ? ` Đối chiếu điều kiện của định hình 86-06X: ứng suất lớn nhất đáy móng ở TTGH sử dụng σmax = ${tf(R.SD.sigMax, 1)} kPa ${R.SD.sigMax <= R86 ? '≤' : '>'} R = ${R86 > 200 ? '3' : '2'} kg/cm² = ${tf(R86, 1)} kPa.`
      : '';
    set(
      'o_tc_req',
      I.rock
        ? `Để tường đạt yêu cầu, nền đá cần có sức kháng đỡ tính toán qR ≥ σmax = ${tf(sMax, 1)} kPa; góc ma sát giữa đáy móng và đá δ ≥ arctan[H'/(φτ.N')] = ${tf(phiReq, 1)}°.${s86}`
        : `Để tường đạt yêu cầu, đất nền dưới đáy móng cần có: sức kháng đỡ tính toán qR ≥ σV,max = ${tf(sMax, 1)} kPa (TTGH CĐ I) ; chống trượt: đất rời φf ≥ arctan[H'/(φτ.N')] = ${tf(phiReq, 1)}° (φτ = ${tf(I.phit, 2)}), đất dính min(Su ; 0,5σ'v) ≥ H'/(φτ.B*) = ${tf(SuReq, 1)} kPa. Đối chiếu với chỉ tiêu đất nền trong hồ sơ khảo sát địa chất của công trình.${s86}`,
    );
  }

  let hs =
    `<tr><th>Mặt cắt</th><th>Tổ hợp</th><th>h (m)</th><th>N (kN)</th><th>M (kN.m)</th><th>Q (kN)</th><th>e0 (m)</th><th>0,7y ; 0,9y (m)</th><th>Nr (kN)</th><th>σk ; γr.Rku (kPa)</th><th>Qr (kN)</th><th>Kết quả</th></tr>`;
  for (const s of R.secs) {
    (
      [
        ['CĐ I-b', s.Ib, s.cIb, s.Qr2],
        ['CĐ I-a', s.Ia, s.cIa, s.Qr],
      ] as const
    ).forEach(([nm, f, c, Qr], i) => {
      const ok = c.ok1 && c.okN && c.okk && Math.abs(f.Q) <= Qr;
      hs += `<tr>${i === 0 ? `<td class="l" rowspan="2">${s.nm}</td>` : ''}<td class="c">${nm}</td><td>${tf(s.h, 3)}</td><td>${tf(f.N)}</td><td>${tf(f.M)}</td><td>${tf(f.Q)}</td><td>${tf(f.e0, 3)}</td><td>${tf(0.7 * s.y, 3)} ; ${tf(0.9 * s.y, 3)}</td><td>${tf(c.Nr)}</td><td>${c.need ? `${tf(c.sk, 1)} ; ${tf(c.lim, 1)}` : 'e0 ≤ 0,7y: không kiểm tra'}</td><td>${tf(Qr)}</td><td class="c">${tcOk(ok)}</td></tr>`;
    });
  }
  set('tbTcSt', hs);
  set(
    'klTcSt',
    `KẾT LUẬN: ${R.ok.stem ? 'Thân tường ĐẠT YÊU CẦU về cường độ.' : 'Thân tường KHÔNG ĐẠT về cường độ - cần tăng tiết diện hoặc mác vật liệu.'}`,
  );
  cls('klTcSt', 'kl ' + (R.ok.stem ? 'ok' : 'bad'));

  const fm = R.foot.mas;
  set('o_tc_fmat1', fm ? 'đá hộc xây' : 'bê tông');
  set(
    'o_tc_h10',
    fm ? 'KIỂM TOÁN BẢN MÓNG ĐÁ HỘC XÂY - TCVN 5573:2011' : 'KIỂM TOÁN BẢN MÓNG BÊ TÔNG KHÔNG CỐT THÉP',
  );
  set('o_tc_capFt', fm ? 'Sơ đồ tính bản móng đá hộc xây' : 'Sơ đồ tính bản móng bê tông');
  set(
    'o_tc_dlb',
    fm
      ? 'Móng đá hộc xây vữa tại chỗ trực tiếp trên nền: lấy như móng đổ tại chỗ, δb = φf (Điều 6.3.4).'
      : 'Móng bê tông đổ tại chỗ: δb = φf (Điều 6.3.4).',
  );
  vis8('tc_fFc', !fm);
  vis8('tc_fFm', fm);

  set(
    'tbTcFt',
    `<tr><th>Mặt cắt</th><th>t (m)</th><th>Lq (m)</th><th>σV (kPa)</th><th>M phản lực ; M trọng lượng (kN.m)</th><th>M (kN.m)</th><th>Q (kN)</th><th>σt (kPa)</th><th>τ (kPa)</th><th>${fm ? 'Rku,f ; Rc,f (kPa)' : 'Rbt (kPa)'}</th><th>Kết quả</th></tr>` +
      R.foot.list
        .map(
          (f) =>
            `<tr><td class="l">${f.nm}</td><td>${tf(f.t, 3)}</td><td>${tf(f.Lq, 3)}</td><td>${tf(R.foot.sig)}</td><td>${tf(f.Mr)} ; ${tf(f.Md)}</td><td>${tf(f.M)}</td><td>${tf(f.Q)}</td><td>${tf(f.st, 1)}</td><td>${tf(f.tau, 1)}</td><td>${fm ? `${tf(R.foot.Rbt, 0)} ; ${tf(R.foot.Rsh, 0)}` : tf(R.foot.Rbt, 0)}</td><td class="c">${tcOk(f.ok)}</td></tr>`,
        )
        .join(''),
  );
  set(
    'klTcFt',
    `KẾT LUẬN: ${R.ok.foot ? 'Bản móng ĐẠT YÊU CẦU.' : fm ? 'Bản móng KHÔNG ĐẠT - cần tăng chiều dày móng, tăng mác vữa hoặc chuyển sang móng bê tông.' : 'Bản móng KHÔNG ĐẠT - cần tăng chiều dày móng hoặc bố trí cốt thép.'}`,
  );
  cls('klTcFt', 'kl ' + (R.ok.foot ? 'ok' : 'bad'));

  set(
    'tbTcSum',
    `<tr><th>STT</th><th>Hạng mục kiểm toán</th><th>Căn cứ</th><th>Kết quả</th></tr>` +
      (
        [
          ['Độ lệch tâm của hợp lực', 'TCVN 11823-11, Điều 6.3.3', R.ok.e],
          ['Trượt theo đáy móng', 'TCVN 11823-10, Điều 6.3.4', R.ok.sl],
          [
            R.ok.ct && !R.ok.br0 ? 'Sức chịu tải của đất nền (sau gia cố cọc tre)' : 'Sức chịu tải của đất nền',
            R.ok.brm === 'spt' ? 'TCVN 11823-10, Điều 6.3.1.3 (SPT)' : 'TCVN 11823-10, Điều 6.3.1',
            R.ok.br,
          ],
          ['Cường độ thân tường', 'TCVN 5573:2011, Điều 8.1, 9.2', R.ok.stem],
          [fm ? 'Bản móng đá hộc xây' : 'Bản móng bê tông', fm ? 'TCVN 5573:2011' : 'TCVN 5574:2018', R.ok.foot],
        ] as Array<[string, string, boolean]>
      )
        .map((r, i) => `<tr><td class="c">${i + 1}</td><td class="l">${r[0]}</td><td class="l">${r[1]}</td><td class="c">${tcOk(r[2])}</td></tr>`)
        .join(''),
  );
  set(
    'klTc',
    `KẾT LUẬN CHUNG: ${R.ok.all ? 'TƯỜNG CHẮN ĐẠT YÊU CẦU THEO TẤT CẢ CÁC HẠNG MỤC KIỂM TOÁN.' : 'TƯỜNG CHẮN KHÔNG ĐẠT - XEM CÁC HẠNG MỤC KHÔNG ĐẠT Ở BẢNG TRÊN.'}`,
  );
  cls('klTc', 'kl ' + (R.ok.all ? 'ok' : 'bad'));

  try {
    const hooks = getVisualHooks();
    hooks.renderGravityWall?.({ result: R });
    hooks.renderMath?.();
  } catch (e) {
    console.error(e);
  }
  return R;
}

export function toGravityWallResult(R: TcResult): RetainingWallResult {
  return {
    variant: 'gravity',
    eLim: R.eLim,
    brm: R.ok.brm,
    coul: R.coul,
    Ia: R.Ia as unknown as Record<string, unknown>,
    Ib: R.Ib as unknown as Record<string, unknown>,
    SD: R.SD as unknown as Record<string, unknown>,
    bambooNeeded: R.ok.ct,
    ok: {
      e: R.ok.e,
      sl: R.ok.sl,
      br: R.ok.br,
      stem: R.ok.stem,
      foot: R.ok.foot,
      all: R.ok.all,
    },
  };
}
