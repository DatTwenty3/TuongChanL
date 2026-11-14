/**
 * BangTinhCauCong Web App — Shallow Foundation Solver (`SF`, `SFM`, `SFD`, `sfGrid`, `sfAnc`)
 *
 * Exact clean-room TypeScript port of TCVN 11823-10:2017 §6 & TCVN 11823-11:2017 §6.3, §6.5
 * from `analysis-cau-cong/modules/01_boot_shims_and_sf.js` (`SF`) and
 * `analysis-cau-cong/modules/14_pier_solid_dct_and_shallow_fdn_ui.js` (`SFM`/`SFD` combos,
 * rock anchor, `sfGrid`, `sfRender`, `sfPun6`, `sfCap6Txt`, `sfmStep`, `sfdStep`).
 */

import type {
  BearingPressureResult,
  LimitStateType,
  N17Factors,
  RockAnchorCheck,
  ShallowFootingComboCheck,
  ShallowFootingResult,
  ShallowFootingSettlement,
  SoilQnResult,
} from '../../types/project';
import { $, fx, getVisualHooks, num, set, v } from '../context';

// ---------------------------------------------------------------------------
// 1. Standard Code Tables & Interpolation (`T17`, `N17`, `bzRigid`, `T20`, `dqT`, `Cw`)
// ---------------------------------------------------------------------------

/** Table 17 (TCVN 11823-10:2017): φ (0..45 deg) -> [Nc, Nq, Nγ] */
export const T17: ReadonlyArray<readonly [number, number, number]> = [
  [5.14, 1.0, 0.0],
  [5.4, 1.1, 0.1],
  [5.6, 1.2, 0.2],
  [5.9, 1.3, 0.2],
  [6.2, 1.4, 0.3],
  [6.5, 1.6, 0.5],
  [6.8, 1.7, 0.6],
  [7.2, 1.9, 0.7],
  [7.5, 2.1, 0.9],
  [7.9, 2.3, 1.0],
  [8.4, 2.5, 1.2],
  [8.8, 2.7, 1.4],
  [9.3, 3.0, 1.7],
  [9.8, 3.3, 2.0],
  [10.4, 3.6, 2.3],
  [11.0, 3.9, 2.7],
  [11.6, 4.3, 3.1],
  [12.3, 4.8, 3.5],
  [13.1, 5.3, 4.1],
  [13.9, 5.8, 4.7],
  [14.8, 6.4, 5.4],
  [15.8, 7.1, 6.2],
  [16.9, 7.8, 7.1],
  [18.1, 8.7, 8.2],
  [19.3, 9.6, 9.4],
  [20.7, 10.7, 10.9],
  [22.3, 11.9, 12.5],
  [23.9, 13.2, 14.5],
  [25.8, 14.7, 16.7],
  [27.9, 16.4, 19.3],
  [30.1, 18.4, 22.4],
  [32.7, 20.6, 26.0],
  [35.5, 23.2, 30.2],
  [38.6, 26.1, 35.2],
  [42.2, 29.4, 41.1],
  [46.1, 33.3, 48.0],
  [50.6, 37.8, 56.3],
  [55.6, 42.9, 66.2],
  [61.4, 48.9, 78.0],
  [67.9, 56.0, 92.3],
  [75.3, 64.2, 109.4],
  [83.9, 73.9, 130.2],
  [93.7, 85.4, 155.6],
  [105.1, 99.0, 186.5],
  [118.4, 115.3, 224.6],
  [133.9, 134.9, 271.8],
];

export const T20: Readonly<Record<32 | 37 | 42, readonly [number, number, number, number]>> = {
  32: [1.2, 1.3, 1.35, 1.4],
  37: [1.2, 1.25, 1.3, 1.35],
  42: [1.15, 1.2, 1.25, 1.3],
};

function linPairs(x: number, P: ReadonlyArray<readonly [number, number]>): number {
  if (x <= P[0][0]) return P[0][1];
  for (let i = 1; i < P.length; i++) {
    if (x <= P[i][0]) {
      const a = P[i - 1];
      const b = P[i];
      return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
    }
  }
  return P[P.length - 1][1];
}

export function N17(phi: number): N17Factors {
  const p = Math.max(0, Math.min(45, phi));
  const i = Math.min(44, Math.floor(p));
  const t = p - i;
  const a = T17[i];
  const b = T17[i + 1];
  return {
    Nc: a[0] + t * (b[0] - a[0]),
    Nq: a[1] + t * (b[1] - a[1]),
    Ng: a[2] + t * (b[2] - a[2]),
  };
}

/** Table 13: βz for rigid footing according to L/B */
export function bzRigid(LB: number): number {
  return linPairs(Math.max(1, LB), [
    [1, 1.08],
    [2, 1.1],
    [3, 1.15],
    [5, 1.24],
    [10, 1.41],
  ]);
}

/** Table 20: depth factor dq */
export function dqT(phi: number, DfB: number): number {
  if (phi < 32 || DfB <= 0) return 1;
  const row = (f: 32 | 37 | 42) =>
    linPairs(DfB, [
      [0, 1],
      [1, T20[f][0]],
      [2, T20[f][1]],
      [4, T20[f][2]],
      [8, T20[f][3]],
    ]);
  if (phi <= 37) return row(32) + ((row(37) - row(32)) * (phi - 32)) / 5;
  if (phi <= 42) return row(37) + ((row(42) - row(37)) * (phi - 37)) / 5;
  return row(42);
}

/** Table 18: groundwater correction factors Cwq, Cwγ */
export function Cw(Dw: number, Df: number, B: number): { Cwq: number; Cwg: number } {
  const Cwq = Df <= 0 ? 1 : Dw >= Df ? 1 : 0.5 + (0.5 * Math.max(0, Dw)) / Df;
  const Cwg = Dw <= Df ? 0.5 : Dw >= 1.5 * B + Df ? 1 : 0.5 + (0.5 * (Dw - Df)) / (1.5 * B);
  return { Cwq, Cwg };
}

// ---------------------------------------------------------------------------
// 2. No-Tension Linear Bearing Stress (`press` 60x60 Newton) & Vesic `soilQn`
// ---------------------------------------------------------------------------

export interface PressResult extends BearingPressureResult {
  q?: (x: number, y: number) => number;
  qminLin?: number;
  full?: boolean;
  B?: number;
  L?: number;
  chk?: { V: number; My: number; Mx: number };
}

export function solve3(M: readonly (readonly number[])[], r: readonly number[]): number[] | null {
  const A = M.map((row, i) => [...row, r[i]]);
  for (let i = 0; i < 3; i++) {
    let p = i;
    for (let k = i + 1; k < 3; k++) {
      if (Math.abs(A[k][i]) > Math.abs(A[p][i])) p = k;
    }
    if (Math.abs(A[p][i]) < 1e-14) return null;
    [A[i], A[p]] = [A[p], A[i]];
    for (let k = 0; k < 3; k++) {
      if (k !== i) {
        const f = A[k][i] / A[i][i];
        for (let j = i; j < 4; j++) A[k][j] -= f * A[i][j];
      }
    }
  }
  return [0, 1, 2].map((i) => A[i][3] / A[i][i]);
}

export function press(
  V: number,
  My: number,
  Mx: number,
  B: number,
  L: number,
  n = 60,
): PressResult {
  const gridN = n || 60;
  const dx = B / gridN;
  const dy = L / gridN;
  const A = B * L;
  const Iy = (L * B ** 3) / 12;
  const Ix = (B * L ** 3) / 12;
  const X: number[] = [];
  const Y: number[] = [];
  for (let i = 0; i < gridN; i++) X.push(-B / 2 + (i + 0.5) * dx);
  for (let j = 0; j < gridN; j++) Y.push(-L / 2 + (j + 0.5) * dy);

  const Mt = -Mx;
  if (!(V > 0)) return { ok: false, why: 'Lực dọc ≤ 0' };
  const ex = My / V;
  const ey = Mt / V;
  if (Math.abs(ex) >= B / 2 || Math.abs(ey) >= L / 2) {
    return { ok: false, why: 'Hợp lực nằm ngoài đáy móng', ex, ey };
  }

  let a = V / A;
  let b = My / Iy;
  let c = Mt / Ix;
  const full = (6 * Math.abs(ex)) / B + (6 * Math.abs(ey)) / L <= 1 + 1e-12;

  const integ = (aa: number, bb: number, cc: number) => {
    let F = 0;
    let Fx = 0;
    let Fy = 0;
    const J = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
    let qmax = 0;
    let nc = 0;
    const dA = dx * dy;
    for (const x of X) {
      for (const y of Y) {
        const q = aa + bb * x + cc * y;
        if (q > 0) {
          F += q * dA;
          Fx += q * x * dA;
          Fy += q * y * dA;
          nc++;
          if (q > qmax) qmax = q;
          const g = [1, x, y];
          for (let r = 0; r < 3; r++) {
            for (let s = 0; s < 3; s++) J[r][s] += g[r] * g[s] * dA;
          }
        }
      }
    }
    return { F, Fx, Fy, J, qmax, ratio: nc / (gridN * gridN) };
  };

  if (!full) {
    for (let it = 0; it < 60; it++) {
      const R = integ(a, b, c);
      const r = [V - R.F, My - R.Fx, Mt - R.Fy];
      if (
        Math.abs(r[0]) < 1e-7 * V &&
        Math.abs(r[1]) < 1e-7 * V * B &&
        Math.abs(r[2]) < 1e-7 * V * L
      ) {
        break;
      }
      const d = solve3(R.J, r);
      if (!d) break;
      a += d[0];
      b += d[1];
      c += d[2];
    }
  }

  const qFn = (x: number, y: number) => Math.max(0, a + b * x + c * y);
  const cs = [
    [B / 2, L / 2],
    [B / 2, -L / 2],
    [-B / 2, L / 2],
    [-B / 2, -L / 2],
  ].map(([x, y]) => a + b * x + c * y);
  const R = integ(a, b, c);

  return {
    ok: true,
    a,
    b,
    c,
    q: qFn,
    qmax: Math.max(...cs),
    qmin: Math.max(0, Math.min(...cs)),
    qminLin: Math.min(...cs),
    full,
    fullComp: full,
    ratio: full ? 1 : R.ratio,
    ex,
    ey,
    B,
    L,
    chk: { V: R.F, My: R.Fx, Mx: -R.Fy },
  };
}

export interface ShallowSoilInput {
  c: number;
  phi: number;
  g: number;
  pun: boolean;
  dqOn: boolean;
}

export function soilQn(
  S: ShallowSoilInput,
  geo: { Bp: number; Lp: number; Df: number; Dw: number },
  unf: { V: number; Hx: number; Hy: number },
): SoilQnResult {
  let c = S.c;
  let phi = S.phi;
  if (S.pun) {
    c = 0.67 * c;
    phi = (Math.atan(0.67 * Math.tan((phi * Math.PI) / 180)) * 180) / Math.PI;
  }

  const B = Math.min(geo.Bp, geo.Lp);
  const L = Math.max(geo.Bp, geo.Lp);
  const BL = B / L;
  const F = N17(phi);
  const t = Math.tan((phi * Math.PI) / 180);
  const sc = phi > 0 ? 1 + (BL * F.Nq) / F.Nc : 1 + BL / 5;
  const sg = phi > 0 ? 1 - 0.4 * BL : 1;
  const sq = phi > 0 ? 1 + BL * t : 1;
  const dq = S.dqOn ? dqT(phi, geo.Df / B) : 1;

  const HL = geo.Lp >= geo.Bp ? Math.abs(unf.Hy) : Math.abs(unf.Hx);
  const HB = geo.Lp >= geo.Bp ? Math.abs(unf.Hx) : Math.abs(unf.Hy);
  const H = Math.hypot(unf.Hx, unf.Hy);
  const V = unf.V;
  const th = H > 0 ? Math.atan2(HB, HL) : 0;
  const LBr = L / B;
  const BLr = B / L;
  const n =
    ((2 + LBr) / (1 + LBr)) * Math.cos(th) ** 2 + ((2 + BLr) / (1 + BLr)) * Math.sin(th) ** 2;

  let iq = 1;
  let ig = 1;
  let ic = 1;
  const A = B * L;
  if (phi > 0) {
    const den = V + (c * A) / t;
    const r = den > 0 ? Math.max(0, 1 - H / den) : 0;
    iq = r ** n;
    ig = r ** (n + 1);
    ic = iq - (1 - iq) / (F.Nq - 1);
  } else {
    iq = 1;
    ig = 1;
    ic = c > 0 ? Math.max(0, 1 - (n * H) / (c * A * F.Nc)) : 0;
  }

  const W = Cw(geo.Dw, geo.Df, B);
  const Ncm = F.Nc * sc * ic;
  const Nqm = F.Nq * sq * dq * iq;
  const Ngm = F.Ng * sg * ig;
  const qn = c * Ncm + S.g * geo.Df * Nqm * W.Cwq + 0.5 * S.g * B * Ngm * W.Cwg;

  return {
    c,
    phi,
    F,
    B,
    L,
    sc,
    sg,
    sq,
    dq,
    n,
    th: (th * 180) / Math.PI,
    H,
    V,
    iq,
    ig,
    ic,
    Cwq: W.Cwq,
    Cwg: W.Cwg,
    Ncm,
    Nqm,
    Ngm,
    qn,
  };
}

export function eLim(st: LimitStateType, rock: boolean, gEQ?: number): number {
  return st === 'DB'
    ? 1 / 3 + (0.4 - 1 / 3) * Math.max(0, Math.min(1, gEQ || 0))
    : rock
      ? 0.45
      : 1 / 3;
}

// ---------------------------------------------------------------------------
// 3. Rock Anchor & Complete Footing Check (`check`, `settle`, `cells`, `reactions`)
// ---------------------------------------------------------------------------

export interface SfRockAnchorRaw extends RockAnchorCheck {
  fy: number;
  Dh: number;
  Lr: number;
  La: number;
  fg: number;
  tau: number;
  Trs: number;
  Trp: number;
  ldg: number;
  ldc: number | null;
  okG?: boolean;
  okC?: boolean;
}

export function sfAnc(a: {
  n: number;
  d: number;
  fy: number;
  Dh: number;
  Lr: number;
  La: number;
  fg: number;
  tau: number;
  mu: number;
}): SfRockAnchorRaw {
  const As = (Math.PI * a.d * a.d) / 4;
  const Trs = (0.9 * As * a.fy) / 1e3;
  const Trp = (0.5 * Math.PI * a.Dh * a.tau * a.Lr * 1000) / 1e3;
  const Tr = Math.min(Trs, Trp);
  const ld = (fc: number) => Math.max((0.02 * As * a.fy) / Math.sqrt(fc), 0.06 * a.d * a.fy);
  const ldg = ld(a.fg);
  return {
    n: a.n,
    d: a.d,
    fy: a.fy,
    Dh: a.Dh,
    Lr: a.Lr,
    La: a.La,
    fg: a.fg,
    tau: a.tau,
    mu: a.mu,
    As,
    TrSteel: Trs,
    TrBond: Trp,
    Trs,
    Trp,
    Tr,
    ldbGrout: ldg,
    ldbCap: 0,
    okLr: a.Lr * 1000 >= ldg,
    okLc: true,
    sum: a.n * Tr,
    ldg,
    ldc: null,
  };
}

export interface ShallowFootingParams {
  B: number;
  L: number;
  Df: number;
  Dw: number;
  rock: boolean;
  S: ShallowSoilInput;
  qnRock: number;
  fc: number;
  phib: number;
  phiT: number;
  slide: 'cip' | 'pc' | 'clay';
  dlt: number;
  Rep: number;
  phiEp: number;
  Es: number;
  nu: number;
  Sa: number;
  qsd: number;
  anc?: SfRockAnchorRaw | null;
}

export interface ShallowFootingComboInput {
  id: string;
  st: LimitStateType;
  V: number;
  Hx: number;
  Hy: number;
  Mx: number;
  My: number;
  unf?: { V: number; Hx: number; Hy: number };
  gEQ?: number;
  Dw?: number;
  noLL?: { V: number; Hx: number; Hy: number; Mx: number; My: number } | null;
  st0?: { V: number; My: number; Mx: number } | null;
}

export function sfCheck(
  P: ShallowFootingParams,
  combos: readonly ShallowFootingComboInput[],
): ShallowFootingComboCheck[] {
  const out: ShallowFootingComboCheck[] = [];
  for (const c of combos) {
    const r: ShallowFootingComboCheck = {
      id: c.id,
      st: c.st,
      V: c.V,
      Hx: c.Hx,
      Hy: c.Hy,
      Mx: c.Mx,
      My: c.My,
      gEQ: c.gEQ,
      Dw: c.Dw,
      ex: c.V > 0 ? c.My / c.V : NaN,
      ey: c.V > 0 ? -c.Mx / c.V : NaN,
      q: NaN,
      qOK: false,
    };

    const s0 = c.st0 && c.st0.V > 0 ? c.st0 : c;
    if (c.st !== 'SD') {
      let k = eLim(c.st, P.rock, c.gEQ);
      let ex = s0.My / s0.V;
      let ey = -s0.Mx / s0.V;
      if (c.st === 'DB' && c.noLL && c.noLL.V > 0) {
        const x0 = c.noLL.My / c.noLL.V;
        const y0 = -c.noLL.Mx / c.noLL.V;
        if (Math.hypot(x0 / P.B, y0 / P.L) > Math.hypot(ex / P.B, ey / P.L) + 1e-12) {
          ex = x0;
          ey = y0;
          k = eLim('DB', P.rock, 0);
          r.g0 = true;
        }
      }
      r.exE = ex;
      r.eyE = ey;
      r.eLk = k;
      r.eLx = k * P.B;
      r.eLy = k * P.L;
      r.eOK = c.V > 0 && Math.abs(ex) <= r.eLx + 1e-9 && Math.abs(ey) <= r.eLy + 1e-9;
    }

    const phiB = c.st === 'DB' ? 1 : c.st === 'SD' ? 1 : P.phib;
    if (c.V > 0 && Math.abs(r.ex) < P.B / 2 && Math.abs(r.ey) < P.L / 2) {
      r.Bp = P.B - 2 * Math.abs(r.ex);
      r.Lp = P.L - 2 * Math.abs(r.ey);
      r.Ap = r.Bp * r.Lp;
      if (!P.rock) {
        r.q = c.V / r.Ap;
        if (c.st !== 'SD') {
          const u = c.unf || c;
          r.br = soilQn(P.S, { Bp: r.Bp, Lp: r.Lp, Df: P.Df, Dw: c.Dw == null ? P.Dw : c.Dw }, u);
          r.qn = r.br.qn;
          r.phiB = phiB;
          r.qR = phiB * r.qn;
          r.qOK = r.q <= r.qR + 1e-9;
        }
      } else {
        const d = press(c.V, c.My, c.Mx, P.B, P.L);
        r.pr = d;
        r.q = d.ok ? (d.qmax ?? NaN) : NaN;
        if (c.st !== 'SD') {
          r.qn = P.qnRock;
          const qc = 0.7 * 0.85 * P.fc * 1000;
          r.phiB = phiB;
          r.qRr = phiB * r.qn;
          r.qRc = qc;
          r.qR = Math.min(r.qRr, qc);
          r.qOK = r.q <= r.qR + 1e-9;
        }
      }
    } else {
      r.q = NaN;
      r.qOK = false;
    }

    if (c.st !== 'SD') {
      const H = Math.hypot(c.Hx, c.Hy);
      r.H = H;
      const fT = c.st === 'DB' ? 1 : P.phiT;
      const fE = c.st === 'DB' ? 1 : P.phiEp;
      let Rt = 0;
      let tag = '';
      if (P.rock) {
        Rt = Math.max(0, s0.V) * Math.tan((P.dlt * Math.PI) / 180);
        tag = 'V.tanδ';
      } else if (P.slide === 'clay') {
        const A = r.Ap && r.Ap > 0 ? r.Ap : 0;
        const qs = A > 0 ? Math.min(P.S.c, (0.5 * c.V) / A) : 0;
        Rt = qs * A;
        r.qs = qs;
        tag = "qs.A'";
      } else {
        const t = Math.tan((P.S.phi * Math.PI) / 180) * (P.slide === 'pc' ? 0.8 : 1);
        Rt = Math.max(0, s0.V) * t;
        r.tanD = t;
        tag = 'V.tanδ';
      }
      r.Vs = s0.V;
      r.Rt = Rt;
      r.Ra = P.rock && P.anc ? P.anc.mu * P.anc.sum : 0;
      r.RR = fT * Rt + fE * (P.Rep || 0) + r.Ra;
      r.fT = fT;
      r.fE = fE;
      r.sOK = H <= r.RR + 1e-9;
      r.sTag = tag;
    }

    out.push(r);
  }
  return out;
}

export function sfSettle(
  P: Pick<ShallowFootingParams, 'B' | 'L' | 'rock' | 'Es' | 'nu' | 'Sa'>,
  c: { id: string; V: number; My: number; Mx: number } | null | undefined,
): ShallowFootingSettlement | null {
  if (!(c && c.V > 0)) return null;
  const ex = c.My / c.V;
  const ey = -c.Mx / c.V;
  const Bp = P.B - 2 * Math.abs(ex);
  const Lp = P.L - 2 * Math.abs(ey);
  if (!(Bp > 0 && Lp > 0)) return { ok: false };

  const B = Math.min(Bp, Lp);
  const L = Math.max(Bp, Lp);
  const A = Bp * Lp;
  const q0 = c.V / A / 1000;
  const bz = bzRigid(L / B);
  const E = P.Es;
  const nu = P.nu;
  let S: number;
  if (!P.rock) {
    S = (q0 * (1 - nu * nu) * Math.sqrt(A * 1e6)) / (E * bz);
  } else {
    const Ip = Math.sqrt(L / B) / bz;
    S = (q0 * (1 - nu * nu) * B * 1000 * Ip) / E;
  }

  return {
    ok: true,
    id: c.id,
    V: c.V,
    ex,
    ey,
    Bp,
    Lp,
    A,
    q0,
    bz,
    Ip: P.rock ? Math.sqrt(L / B) / bz : null,
    S,
    Sa: P.Sa,
    sOK: S <= P.Sa + 1e-9,
  };
}

export interface ShallowFootingCell {
  x: number;
  y: number;
  a: number;
  dx: number;
  dy: number;
}

export function cells(B: number, L: number, nx = 40, ny = 40): ShallowFootingCell[] {
  const out: ShallowFootingCell[] = [];
  const dx = B / nx;
  const dy = L / ny;
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      out.push({ x: -B / 2 + (i + 0.5) * dx, y: -L / 2 + (j + 0.5) * dy, a: dx * dy, dx, dy });
    }
  }
  return out;
}

export function reactions(d: PressResult | null | undefined, cl: readonly ShallowFootingCell[]): number[] {
  return cl.map((p) => (d && d.ok && d.q ? d.q(p.x, p.y) * p.a : 0));
}

export const SF = {
  T17,
  T20,
  N17,
  bzRigid,
  dqT,
  Cw,
  press,
  solve3,
  soilQn,
  eLim,
  check: sfCheck,
  settle: sfSettle,
  cells,
  reactions,
} as const;

// ---------------------------------------------------------------------------
// 4. Grid, Combos, Visibility & Step Integration (`14_pier_solid_dct_and_shallow_fdn_ui.js`)
// ---------------------------------------------------------------------------

export function sfmOn(mdOnFn?: () => boolean): boolean {
  const e = $('mo_fnd');
  const isMd = mdOnFn ? mdOnFn() : v('mo_type', '') === 'md';
  return Boolean(e && e.value === 'nong') && !isMd;
}

export function sfdOn(dcOnFn?: () => boolean): boolean {
  const e = $('dt_fnd');
  const isDc = dcOnFn ? dcOnFn() : v('td_type', '') === 'dc';
  return Boolean(e && e.value === 'nong') && isDc;
}

export function sfVis(mdOnFn?: () => boolean, dcOnFn?: () => boolean): void {
  const m = sfmOn(mdOnFn);
  const d = sfdOn(dcOnFn);
  if (typeof document !== 'undefined') {
    document.body?.classList.toggle('sfm', m);
    document.body?.classList.toggle('sfd', d);
    const md = mdOnFn ? mdOnFn() : v('mo_type', '') === 'md';
    const bt = document.querySelector('.tab[data-t="6"]');
    if (bt) bt.textContent = '11. Kiểm toán bệ ' + (md ? 'mố' : m ? 'móng' : 'cọc');
    const h = document.querySelector('#tab6 h1.ttl');
    if (h && !md) h.textContent = m ? 'KIỂM TOÁN BỆ MÓNG' : 'KIỂM TOÁN BỆ CỌC';
  }
}

function sfF(val: number | null | undefined, d = 2): string {
  return val == null || !Number.isFinite(val) ? '-' : fx(val, d);
}

function sfT(head: readonly string[], rows: readonly string[]): string {
  return '<tr>' + head.map((h) => `<th>${h}</th>`).join('') + '</tr>' + rows.join('');
}

function sfR(cellsArr: Array<string | { h: string }>): string {
  return (
    '<tr>' +
    cellsArr
      .map((c, i) =>
        typeof c === 'object' && c && c.h != null ? c.h : `<td${i === 0 ? ' class="l"' : ''}>${c}</td>`,
      )
      .join('') +
    '</tr>'
  );
}

function sfOK(ok: boolean | undefined): { h: string } {
  return { h: `<td class="c ${ok ? 'ok' : 'bad'}">${ok ? 'Đạt' : 'Không đạt'}</td>` };
}

export function sfGrid(
  B: number,
  L: number,
  cmb: readonly { id: string; V: number; My: number; Mx: number }[],
) {
  const nx = 40;
  const ny = Math.max(8, Math.round((nx * L) / B));
  const cl = SF.cells(B, L, nx, ny);
  const R: number[][] = [];
  const rows: string[] = [];
  cmb.forEach((c) => {
    const d = SF.press(c.V, c.My, c.Mx, B, L, 80);
    R.push(SF.reactions(d, cl));
    rows.push(
      sfR([
        c.id,
        sfF(c.V),
        sfF(c.My),
        sfF(c.Mx),
        d.ok ? sfF((d.qmax ?? 0) / 1000, 4) : '-',
        d.ok ? sfF((d.qmin ?? 0) / 1000, 4) : '-',
        d.ok ? sfF((d.ratio ?? 0) * 100, 1) + '%' : d.why || '-',
      ]),
    );
  });
  return {
    piles: cl,
    rows: {},
    R,
    D: B / nx,
    tbl: sfT(
      [
        'Tổ hợp',
        'V (kN)',
        'My (kN.m)',
        'Mx (kN.m)',
        'σmax (MPa)',
        'σmin (MPa)',
        'Phần đáy móng chịu nén',
      ],
      rows,
    ),
  };
}

export function sfPun6(hide: boolean): void {
  if (typeof document === 'undefined') return;
  const box = document.getElementById('mn_cap');
  if (!box) return;
  let on = false;
  [...box.children].forEach((node) => {
    const e = node as HTMLElement;
    if (e.tagName === 'H2') on = /CHỌC THỦNG/.test(e.textContent || '');
    if (on) {
      if (hide) {
        if (e.dataset.sfh == null) e.dataset.sfh = e.style.display || '';
        e.style.display = 'none';
      } else if (e.dataset.sfh != null) {
        e.style.display = e.dataset.sfh;
        delete e.dataset.sfh;
      }
    }
  });
}

export function sfCap6Txt(on: boolean): void {
  if (typeof document === 'undefined') return;
  const box = document.getElementById('mn_cap');
  if (!box) return;
  box.querySelectorAll('h3,p.small').forEach((node) => {
    const e = node as HTMLElement;
    if (e.dataset.sft == null) e.dataset.sft = e.innerHTML;
    if (!on) {
      e.innerHTML = e.dataset.sft;
      return;
    }
    if (e.id === 'o_cap_sf') return;
    let t = e.dataset.sft;
    t = t
      .replace('1.1. Vị trí mặt cắt và cọc', '1.1. Vị trí mặt cắt')
      .replace(
        '1.2. Phản lực đầu cọc (kN)',
        '1.2. Ứng suất đáy móng (phân bố tuyến tính, không chịu kéo)',
      )
      .replace(
        'Phản lực đầu cọc lấy từ sheet nội lực đầu cọc (cùng thứ tự tổ hợp tại đáy bệ).',
        'Phản lực nền tính từ tổ hợp tải trọng tại đáy bệ của sheet tính mố.',
      );
    e.innerHTML = t;
  });
}

export function sfIn(p: string): Omit<ShallowFootingParams, 'B' | 'L' | 'fc'> {
  const g = (id: string) => v(p + id, '');
  const n = (id: string) => num(p + id, 0);
  const rock = g('gnd') === 'da';
  const R = rock ? 'R' : '';
  return {
    rock,
    S: { c: n('c'), phi: n('phi'), g: n('g'), pun: g('pun') === '1', dqOn: g('dq') === '1' },
    qnRock: n('qnr') * 1000,
    phib: n('phib' + R) || 0.45,
    phiT: n('phit' + R) || 0.8,
    slide: (g('slt') as 'cip' | 'pc' | 'clay') || 'cip',
    dlt: n('dlt'),
    Rep: n('Rep'),
    phiEp: 0.5,
    anc:
      rock && g('anc') === '1'
        ? sfAnc({
            n: n('an'),
            d: n('ad'),
            fy: n('afy'),
            Dh: n('aDh'),
            Lr: n('aLr'),
            La: n('aLc'),
            fg: n('agf'),
            tau: n('atau'),
            mu: n('amu'),
          })
        : null,
    Es: n('Es' + R),
    nu: n('nu' + R),
    Sa: n('Sa') || 25,
    qsd: n('qsd') * 1000,
    Df: n('Df'),
    Dw: String(g('Dw')).trim() === '' ? 99 : n('Dw'),
  };
}

export interface ShallowFootingMeta {
  B: number;
  L: number;
  Df: number;
  fc: number;
  Dw?: number;
  Hf?: number;
  wStem?: number;
  xStem?: number;
  stem?: string;
  foot?: Array<[number, number, number, number]>;
  footName?: string;
  note?: string;
}

export interface SfRenderResult {
  P: ShallowFootingParams;
  R: ShallowFootingComboCheck[];
  S1: ShallowFootingSettlement[];
  ok: boolean;
}

export function evaluateShallowFooting(
  PInput: Omit<ShallowFootingParams, 'B' | 'L' | 'fc'> &
    Partial<Pick<ShallowFootingParams, 'B' | 'L' | 'fc'>>,
  combos: readonly ShallowFootingComboInput[],
  meta: ShallowFootingMeta,
): SfRenderResult {
  const P: ShallowFootingParams = {
    ...PInput,
    B: meta.B,
    L: meta.L,
    Df: meta.Df,
    fc: meta.fc,
    Dw: meta.Dw != null ? meta.Dw : PInput.Dw,
  };

  const R = SF.check(P, combos);
  const cd = R.filter((r) => r.st !== 'SD');
  const sd = combos.filter((c) => c.st === 'SD');

  if (P.rock && P.anc) {
    const A = P.anc;
    A.ldc = Math.max((0.02 * A.As * A.fy) / Math.sqrt(P.fc || 30), 0.06 * A.d * A.fy);
    A.ldbCap = A.ldc;
    A.okG = A.Lr * 1000 >= A.ldg;
    A.okC = A.La * 1000 >= A.ldc;
    A.okLr = A.okG;
    A.okLc = A.okC;
  }

  const S1 = sd
    .map((c) => SF.settle(P, c))
    .filter((s): s is ShallowFootingSettlement => Boolean(s && s.ok));

  const sdq = R.filter((r) => r.st === 'SD');
  let okSD = true;
  if (P.qsd > 0) {
    for (const r of sdq) {
      if (!(r.q <= P.qsd + 1e-9)) okSD = false;
    }
  }

  const okE = cd.every((r) => r.eOK);
  const okQ = cd.every((r) => r.qOK);
  const okS = cd.every((r) => r.sOK) && (!P.anc || Boolean(P.anc.okG && P.anc.okC));
  const okL = S1.length ? S1.every((s) => s.sOK) : true;
  const ok = Boolean(okE && okQ && okS && okL && okSD);

  return { P, R, S1, ok };
}

export function sfRender(
  p: string,
  PInput: Omit<ShallowFootingParams, 'B' | 'L' | 'fc'> &
    Partial<Pick<ShallowFootingParams, 'B' | 'L' | 'fc'>>,
  combos: readonly ShallowFootingComboInput[],
  meta: ShallowFootingMeta,
): SfRenderResult {
  const errEl = $(p + 'err');
  if (errEl) errEl.textContent = '';

  const res = evaluateShallowFooting(PInput, combos, meta);
  const { P, R, S1, ok } = res;
  const cd = R.filter((r) => r.st !== 'SD');

  set(p + 'oB', sfF(P.B, 3));
  set(p + 'oL', sfF(P.L, 3));
  set(p + 'oDf', sfF(P.Df, 3));
  set(p + 'oDw', P.Dw >= 90 ? 'không có' : sfF(P.Dw, 3));
  set(p + 'onote', meta.note || '');

  const sh = (id: string, on: boolean) => {
    const e = $(p + id);
    if (e?.style) e.style.display = on ? '' : 'none';
  };
  sh('bDat', !P.rock);
  sh('bDa', P.rock);
  sh('bAnc', P.rock && v(p + 'anc', '0') === '1');
  sh('anOut', Boolean(P.rock && P.anc));

  if (P.rock && P.anc) {
    const A = P.anc;
    set(
      p + 'tbAn',
      sfT(
        ['Đại lượng', 'Ký hiệu', 'Giá trị', 'Đơn vị'],
        [
          ['Diện tích một thanh neo', 'As', sfF(A.As, 1), 'mm²'],
          ['Sức kháng kéo của thanh thép φs.As.fy', 'Trs', sfF(A.Trs, 2), 'kN'],
          ['Sức kháng nhổ neo khỏi đá φp.π.Dh.τn.Lr', 'Trp', sfF(A.Trp, 2), 'kN'],
          ['Sức kháng kéo tính toán của một thanh neo', 'Tr', sfF(A.Tr, 2), 'kN'],
          ['Số thanh neo ; tổng sức kháng', 'n ; ΣTr', `${sfF(A.n, 0)} ; ${sfF(A.sum, 2)}`, '; kN'],
          [`Sức kháng trượt do neo μ.ΣTr (μ = ${sfF(A.mu, 2)})`, '', sfF(A.mu * A.sum, 2), 'kN'],
          [
            'Chiều dài phát triển trong vữa ; chiều dài neo trong đá',
            'ldb ; Lr',
            `${sfF(A.ldg, 0)} ; ${sfF(A.Lr * 1000, 0)} ${A.okG ? '- Đạt' : '- Không đạt'}`,
            'mm',
          ],
          [
            'Chiều dài phát triển trong bệ móng ; chiều dài neo trong bệ',
            'ldb ; La',
            `${sfF(A.ldc, 0)} ; ${sfF(A.La * 1000, 0)} ${A.okC ? '- Đạt' : '- Không đạt'}`,
            'mm',
          ],
        ].map((r) => sfR(r)),
      ),
    );
  }

  set(
    p + 'tbC',
    sfT(
      [
        'Tổ hợp',
        'TTGH',
        'V (kN)',
        'Hx (kN)',
        'Hy (kN)',
        'Mx (kN.m)',
        'My (kN.m)',
        'V không hệ số (kN)',
        'H không hệ số (kN)',
      ],
      combos.map((c) =>
        sfR([
          c.id,
          c.st === 'CD' ? 'Cường độ' : c.st === 'DB' ? 'Đặc biệt' : 'Sử dụng',
          sfF(c.V),
          sfF(c.Hx),
          sfF(c.Hy),
          sfF(c.Mx),
          sfF(c.My),
          c.st === 'SD' ? '-' : sfF(c.unf?.V),
          c.st === 'SD' ? '-' : sfF(c.unf ? Math.hypot(c.unf.Hx, c.unf.Hy) : undefined),
        ]),
      ),
    ),
  );

  set(
    p + 'tbE',
    sfT(
      [
        'Tổ hợp',
        'eB = My/V (m)',
        'Giới hạn theo B (m)',
        'eL = -Mx/V (m)',
        'Giới hạn theo L (m)',
        'Hệ số giới hạn',
        'Kết luận',
      ],
      cd.map((r) =>
        sfR([
          r.id + (r.g0 ? ' (γEQ = 0)' : ''),
          sfF(r.exE, 3),
          sfF(r.eLx, 3),
          sfF(r.eyE, 3),
          sfF(r.eLy, 3),
          sfF(r.eLk, 4),
          sfOK(r.eOK),
        ]),
      ),
    ),
  );

  if (!P.rock) {
    set(
      p + 'tbQ',
      sfT(
        [
          'Tổ hợp',
          "B' (m)",
          "L' (m)",
          "q = V/(B'L') (MPa)",
          'qn (MPa)',
          'φb',
          'qR (MPa)',
          'Kết luận',
        ],
        cd.map((r) =>
          sfR([
            r.id,
            sfF(r.Bp, 3),
            sfF(r.Lp, 3),
            sfF(r.q / 1000, 4),
            sfF((r.qn ?? NaN) / 1000, 4),
            sfF(r.phiB, 2),
            sfF((r.qR ?? NaN) / 1000, 4),
            sfOK(r.qOK),
          ]),
        ),
      ),
    );
    const w = cd
      .filter((r) => r.br && r.qR)
      .sort((a, b) => b.q / (b.qR || 1) - a.q / (a.qR || 1))[0];
    if (w && w.br) {
      const b = w.br;
      set(
        p + 'tbQd',
        sfT(
          ['Đại lượng', 'Ký hiệu', 'Giá trị', 'Ghi chú'],
          [
            ['Tổ hợp bất lợi nhất (q/qR lớn nhất)', '', w.id, ''],
            [
              'Kích thước có hiệu (PT 8)',
              "B' ; L'",
              `${sfF(w.Bp, 3)} ; ${sfF(w.Lp, 3)}`,
              'm ; B = min, L = max trong PT 28 - 36',
            ],
            [
              'Lực dính, góc ma sát dùng tính toán' +
                (P.S.pun ? ' (chiết giảm cắt chọc thủng, PT 37, 38)' : ''),
              'c ; φf',
              `${sfF(b.c, 2)} kPa ; ${sfF(b.phi, 2)}°`,
              '',
            ],
            [
              'Hệ số khả năng chịu ép (Bảng 17, nội suy)',
              'Nc ; Nq ; Nγ',
              `${sfF(b.F.Nc, 3)} ; ${sfF(b.F.Nq, 3)} ; ${sfF(b.F.Ng, 3)}`,
              '',
            ],
            [
              'Hệ số hình dạng (Bảng 19)',
              'sc ; sq ; sγ',
              `${sfF(b.sc, 4)} ; ${sfF(b.sq, 4)} ; ${sfF(b.sg, 4)}`,
              '',
            ],
            [
              'Hệ số độ sâu (Bảng 20)',
              'dq',
              sfF(b.dq, 3),
              P.S.dqOn ? '' : 'lấy 1,0 (đất phía trên không chắc như lớp chịu lực)',
            ],
            ['Tải trọng không hệ số', 'H ; V', `${sfF(b.H, 2)} ; ${sfF(b.V, 2)}`, 'kN'],
            [
              'Góc của H với phương L ; số mũ n (PT 36)',
              'θ ; n',
              `${sfF(b.th, 1)}° ; ${sfF(b.n, 4)}`,
              '',
            ],
            [
              'Hệ số tải trọng nghiêng (PT 32 - 35)',
              'ic ; iq ; iγ',
              `${sfF(b.ic, 4)} ; ${sfF(b.iq, 4)} ; ${sfF(b.ig, 4)}`,
              '',
            ],
            [
              'Hệ số mực nước ngầm (Bảng 18)',
              'Cwq ; Cwγ',
              `${sfF(b.Cwq, 3)} ; ${sfF(b.Cwg, 3)}`,
              `Dw = ${w.Dw != null && w.Dw >= 90 ? 'không có' : `${sfF(w.Dw, 2)} m`}`,
            ],
            [
              'Ncm = Nc.sc.ic ; Nqm = Nq.sq.dq.iq ; Nγm = Nγ.sγ.iγ (PT 29 - 31)',
              '',
              `${sfF(b.Ncm, 4)} ; ${sfF(b.Nqm, 4)} ; ${sfF(b.Ngm, 4)}`,
              '',
            ],
            [
              "qn = c.Ncm + γ.Df.Nqm.Cwq + 0,5.γ.B'.Nγm.Cwγ (PT 28)",
              'qn',
              sfF(b.qn / 1000, 4),
              'MPa',
            ],
          ].map((r) => sfR(r)),
        ),
      );
    } else set(p + 'tbQd', '');
  } else {
    set(
      p + 'tbQ',
      sfT(
        [
          'Tổ hợp',
          'σmax (MPa)',
          'σmin (MPa)',
          'Phần đáy móng chịu nén',
          'qn (MPa)',
          'φb',
          'φb.qn (MPa)',
          "0,7 × 0,85f'c (MPa)",
          'qR (MPa)',
          'Kết luận',
        ],
        cd.map((r) =>
          sfR([
            r.id,
            sfF(r.q / 1000, 4),
            r.pr && r.pr.ok ? sfF((r.pr.qmin ?? NaN) / 1000, 4) : '-',
            r.pr && r.pr.ok ? sfF((r.pr.ratio ?? 0) * 100, 1) + '%' : '-',
            sfF((r.qn ?? NaN) / 1000, 3),
            sfF(r.phiB, 2),
            sfF((r.qRr ?? NaN) / 1000, 3),
            sfF((r.qRc ?? NaN) / 1000, 3),
            sfF((r.qR ?? NaN) / 1000, 3),
            sfOK(r.qOK),
          ]),
        ),
      ),
    );
    set(p + 'tbQd', '');
  }

  set(
    p + 'tbS',
    sfT(
      [
        'Tổ hợp',
        'H = √(Hx² + Hy²) (kN)',
        'V (kN, không kể hoạt tải chất thêm đứng trên gót)',
        P.rock ? 'tanδ' : P.slide === 'clay' ? 'qs (kPa)' : 'tanδ',
        'Rτ (kN)',
        'φτ',
        'φep.Rep (kN)',
        ...(P.anc ? ['μ.ΣTr (kN)'] : []),
        'RR (kN)',
        'Kết luận',
      ],
      cd.map((r) =>
        sfR([
          r.id,
          sfF(r.H),
          sfF(r.Vs ?? r.V),
          P.rock
            ? sfF(Math.tan((P.dlt * Math.PI) / 180), 4)
            : P.slide === 'clay'
              ? sfF(r.qs, 2)
              : sfF(r.tanD, 4),
          sfF(r.Rt),
          sfF(r.fT, 2),
          sfF((r.fE ?? 0) * (P.Rep || 0)),
          ...(P.anc ? [sfF(r.Ra)] : []),
          sfF(r.RR),
          sfOK(r.sOK),
        ]),
      ),
    ),
  );

  set(
    p + 'tbL',
    sfT(
      [
        'Tổ hợp SD',
        'V (kN)',
        "B' (m)",
        "L' (m)",
        'q0 (MPa)',
        'βz (Bảng 13)',
        P.rock ? 'Ip (PT 26)' : '',
        'Độ lún (mm)',
        'Cho phép (mm)',
        'Kết luận',
      ],
      S1.map((s) =>
        sfR([
          s.id || '',
          sfF(s.V),
          sfF(s.Bp, 3),
          sfF(s.Lp, 3),
          sfF(s.q0, 4),
          sfF(s.bz, 3),
          P.rock ? sfF(s.Ip, 4) : '',
          sfF(s.S, 2),
          sfF(s.Sa, 1),
          sfOK(s.sOK),
        ]),
      ),
    ),
  );

  const sdq = R.filter((r) => r.st === 'SD');
  if (P.qsd > 0) {
    set(
      p + 'tbSD',
      sfT(
        [
          'Tổ hợp SD',
          P.rock ? 'σmax (MPa)' : "q = V/(B'L') (MPa)",
          'Giới hạn Bảng 14 (MPa)',
          'Kết luận',
        ],
        sdq.map((r) =>
          sfR([
            r.id,
            sfF(r.q / 1000, 4),
            sfF(P.qsd / 1000, 3),
            sfOK(r.q <= P.qsd + 1e-9),
          ]),
        ),
      ),
    );
  } else {
    set(p + 'tbSD', '');
  }

  const okE = cd.every((r) => r.eOK);
  const okQ = cd.every((r) => r.qOK);
  const okS = cd.every((r) => r.sOK) && (!P.anc || Boolean(P.anc.okG && P.anc.okC));
  const okL = S1.length ? S1.every((s) => s.sOK) : true;
  const okSD =
    P.qsd > 0 ? sdq.every((r) => r.q <= P.qsd + 1e-9) : true;

  const klEl = $(p + 'kl');
  const klMsg =
    'KẾT LUẬN: ' +
    (ok
      ? 'Nền móng nông ĐẠT YÊU CẦU về lệch tâm, sức kháng nén, trượt' +
        (S1.length ? ' và độ lún.' : '.')
      : 'Nền móng nông KHÔNG ĐẠT: ' +
        [
          !okE && 'lệch tâm',
          !okQ && 'sức kháng nén',
          !okS && 'trượt',
          !okL && 'độ lún',
          !okSD && 'ứng suất TTGH sử dụng',
        ]
          .filter(Boolean)
          .join(', ') +
        '.');
  if (klEl) klEl.className = `kl ${ok ? 'ok' : 'bad'}`;
  set(p + 'kl', klMsg);

  getVisualHooks().renderShallowFdnFigs?.({ prefix: p, result: { ...res, meta } });
  return res;
}

export interface SolidPierForSfdInput {
  I: {
    ELg: number;
    hx?: number;
    MNCN: number;
    MNTN: number;
    fc: number;
    name?: string;
  };
  Q: { C1: number; B1: number; H1: number; C2: number; B2: number };
  G: { ELbb: number };
  S2: Record<string, { Hz: number; Hx: number; Hy: number; Mx: number; My: number }>;
  C2: Array<{
    id: string;
    st: LimitStateType;
    p?: string;
    wH?: boolean;
    gLL?: number;
    eq?: [number, number];
    tot: { Hz: number; Hx: number; Hy: number; Mx: number; My: number };
    f?: Array<[string, number]>;
  }>;
}

export function sfdCombos(R: SolidPierForSfdInput): ShallowFootingComboInput[] {
  const { I, S2: S } = R;
  const ELs = I.ELg - (I.hx || 0);
  return R.C2.map((c) => {
    const t = c.tot;
    const u = { V: 0, Hx: 0, Hy: 0 };
    (c.f || []).forEach(([k, g]) => {
      const o = S[k];
      if (!o || !g) return;
      const w = k === 'EQx' || k === 'EQy' ? (k === 'EQx' ? c.eq?.[0] ?? 1 : c.eq?.[1] ?? 1) : 1;
      u.V += w * o.Hz;
      u.Hx += w * o.Hx;
      u.Hy += w * o.Hy;
    });
    const wl = c.p === 'min' || c.wH ? I.MNCN : I.MNTN;
    const Dw = wl >= ELs ? 0 : ELs - wl;

    let noLL: ShallowFootingComboInput['noLL'] = null;
    if (c.st === 'DB') {
      noLL = { V: t.Hz, Hx: t.Hx, Hy: t.Hy, Mx: t.Mx, My: t.My };
      (c.f || []).forEach(([k, g]) => {
        const o = S[k];
        if (!o || !g || !/^LL|^BR$|^CE$/.test(k)) return;
        noLL!.V -= g * o.Hz;
        noLL!.Hx -= g * o.Hx;
        noLL!.Hy -= g * o.Hy;
        noLL!.Mx -= g * o.Mx;
        noLL!.My -= g * o.My;
      });
    }

    return {
      id: c.id,
      st: c.st,
      V: t.Hz,
      Hx: t.Hx,
      Hy: t.Hy,
      Mx: t.Mx,
      My: t.My,
      unf: u,
      gEQ: c.st === 'DB' ? c.gLL || 0 : 0,
      Dw,
      noLL,
    };
  });
}

export interface AbutmentForSfmInput {
  I: { b: number; Lf: number; L?: number; d: number; f?: number; gEQ?: number };
  geo: { xw1: number; xw2: number; ELbot: number };
  combA: Array<{
    id: string;
    st: LimitStateType;
    tot: { N: number; Hx: number; Hy: number; Mx: number; My: number };
    rows: Array<{ k: string; g: number; N: number; Hx: number; Hy: number; Mx: number; My: number }>;
  }>;
}

export function sfmCombos(data?: AbutmentForSfmInput | null): ShallowFootingComboInput[] {
  if (!data) return [];
  const { I, combA } = data;
  return combA.map((c) => {
    const t = c.tot;
    const u = { V: 0, Hx: 0, Hy: 0 };
    c.rows.forEach((r) => {
      if (!r.g) return;
      const isEQ = /^EQ/.test(r.k);
      const w = isEQ ? 1 : 1 / r.g;
      u.V += w * r.N;
      u.Hx += w * r.Hx;
      u.Hy += w * r.Hy;
    });

    let noLL: ShallowFootingComboInput['noLL'] = null;
    if (c.st === 'DB') {
      noLL = { V: t.N, Hx: t.Hx, Hy: t.Hy, Mx: t.Mx, My: t.My };
      c.rows.forEach((r) => {
        if (!/^(LL|IM|PL|BR|CE)\d|^LSV?$/.test(r.k)) return;
        noLL!.V -= r.N;
        noLL!.Hx -= r.Hx;
        noLL!.Hy -= r.Hy;
        noLL!.Mx -= r.Mx;
        noLL!.My -= r.My;
      });
    }

    const st0 = { V: t.N, My: t.My, Mx: t.Mx };
    c.rows.forEach((r) => {
      if (r.k !== 'LSV') return;
      st0.V -= r.N;
      st0.My -= r.My;
      st0.Mx -= r.Mx;
    });

    return {
      id: c.id,
      st: c.st,
      V: t.N,
      Hx: t.Hx,
      Hy: t.Hy,
      Mx: t.Mx,
      My: t.My,
      unf: u,
      gEQ: c.st === 'DB' ? I.gEQ || 0 : 0,
      noLL,
      st0,
    };
  });
}

export function sfdStep(R: SolidPierForSfdInput | null | undefined, dcOnFn?: () => boolean): SfRenderResult | null {
  sfVis(undefined, dcOnFn);
  if (!sfdOn(dcOnFn) || !R) return null;
  const { Q, G, I } = R;
  const ELs = I.ELg - (I.hx || 0);
  const Df = Math.max(0, ELs - G.ELbb);
  const P = sfIn('sfd_');
  const nm = (I.name || '').trim().toUpperCase();
  set('o_sfd_ttl', 'KIỂM TOÁN NỀN MÓNG NÔNG TRỤ ĐẶC' + (nm ? ' ' + nm : ''));

  return sfRender('sfd_', P, sfdCombos(R), {
    B: Q.C1,
    L: Q.B1,
    Df,
    fc: I.fc,
    Hf: Q.H1,
    wStem: Q.C2,
    xStem: 0,
    stem: 'Thân trụ',
    foot: [[0, 0, Q.C2, Q.B2]],
    footName: 'Chân thân trụ (B2 x C2)',
    note: `Bệ trụ C1 × B1 = ${fx(Q.C1, 3)} × ${fx(Q.B1, 3)} m (B theo phương dọc cầu, L theo phương ngang cầu). Đáy bệ ở cao độ ${fx(G.ELbb, 3)} m, mặt đất sau xói ${fx(ELs, 3)} m: Df = ${fx(Df, 3)} m. Mực nước ngầm lấy theo mực nước của từng tổ hợp (MNTN hoặc MNCN), Dw tính từ mặt đất.`,
  });
}

export function sfmStep(
  data: AbutmentForSfmInput | null | undefined,
  mdOnFn?: () => boolean,
): SfRenderResult | null {
  sfVis(mdOnFn);
  if (!sfmOn(mdOnFn) || !data) return null;
  const { I, geo: G } = data;
  const P = sfIn('sfm_');
  const mo = v('tq_mo', '').trim();
  set('o_sfm_ttl', 'KIỂM TOÁN NỀN MÓNG NÔNG MỐ' + (mo ? ' ' + mo.toUpperCase() : ''));

  return sfRender('sfm_', P, sfmCombos(data), {
    B: I.b,
    L: I.Lf,
    Df: P.Df,
    fc: num('rc_fc') || 30,
    Hf: I.d + (I.f || 0),
    wStem: Math.max(0.3, G.xw1 - G.xw2),
    xStem: (G.xw1 + G.xw2) / 2,
    stem: 'Tường thân',
    foot: [[(G.xw1 + G.xw2) / 2, 0, Math.max(0.3, G.xw1 - G.xw2), I.L || I.Lf]],
    footName: 'Chân tường thân',
    note: `Bệ mố b × Lf = ${fx(I.b, 3)} × ${fx(I.Lf, 3)} m (B theo phương dọc cầu, L theo phương ngang cầu), đáy bệ ở cao độ ${fx(G.ELbot, 3)} m. Tổ hợp tải trọng lấy tại mặt cắt A-A (tâm đáy bệ) của sheet tải trọng mố.`,
  });
}

export function toShallowFootingResult(res: SfRenderResult): ShallowFootingResult {
  const settlement = res.S1.length ? res.S1[0] : null;
  const sortedSettle =
    res.S1.length > 1
      ? [...res.S1].sort((a, b) => (b.S ?? 0) - (a.S ?? 0))[0]
      : settlement;
  return {
    B: res.P.B,
    L: res.P.L,
    Df: res.P.Df,
    rock: res.P.rock,
    checks: res.R,
    settlement: sortedSettle,
    anchor: res.P.anc ?? null,
    okAll: res.ok,
  };
}
