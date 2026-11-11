/**
 * Continuous 3D shell FE model builder, TCVN 11823 load-combination solver,
 * sectional force integrator, and RC capacity verifier (`CFE`) ported
 * faithfully from `13_cfe_continuous.js`.
 */

import {
  CALC,
  type CalcComboEval,
  type CalcCoreResult,
  type CalcPressResult,
  type RcLoadCaseInput,
  type RcRunResult,
  type RcSectionInput,
} from './calcCore.ts';
import type { CalcRibResult } from './calcRibbed.ts';
import { FE3D, type Fe3dElementForce, type Fe3dModel } from './fe3d.ts';
import type { EngineGeomData, EngineWaterResult, Point2D } from './types.ts';

export type CfeWallResult = (CalcCoreResult | CalcRibResult) & {
  rg?: CalcRibResult['rg'] | null;
  hand?: { rib?: CalcRibResult['rib']; ok?: CalcRibResult['ok'] };
  rib?: CalcRibResult['rib'];
  RB?: CalcRibResult['RB'];
  cov?: CalcRibResult['cov'];
  geo?: CalcRibResult['geo'];
};

export interface CfeOptions {
  hx?: number;
  hy?: number;
  hz?: number;
  hxr?: number;
}

export interface CfeElMeta {
  kind: 'stem' | 'slab' | 'rib';
  t: number;
  e: number;
  j?: number;
  k?: number;
  i?: number;
  r?: number;
  a?: number;
  xc: number;
  yc?: number;
  zc: number;
  own: boolean;
  dx?: number;
  dz?: number;
  sl?: number;
  yTop?: number;
  ya?: number;
  yb?: number;
}

export interface CfeModelData {
  m: Fe3dModel;
  EL: CfeElMeta[];
  Y: number[];
  Z: number[];
  X: number[];
  stemEl: number[][];
  slabEl: number[][];
  ribEl: number[][][];
  ribRows: number[];
  ym: number;
  th: number;
  B: number;
  yT: number;
  yF: number;
  Lu: number;
  strip: boolean;
  rt: number;
  E: number;
  nu: number;
  xm: (y: number) => number;
  xb: (y: number) => number;
  xf: (y: number) => number;
  tS: (y: number) => number;
  xh: (y: number) => number;
  ribX: (y: number, i: number) => number;
  yE: number;
  xE: number;
  xT: number;
  yR: number;
  nxr: number;
  xj: number;
  nodeMap: Map<string, number>;
  pins?: number[];
}

export interface CfeComboResult {
  k: string;
  nm: string;
  sd: boolean;
  ev: boolean;
  N: number;
  H: number;
  s: number;
  e: number;
  Lc: number;
  x0: number;
  tau: number;
  pr: CalcPressResult | null;
  U: Float64Array;
  Rpin: number;
  force: Fe3dElementForce[];
  rf?: (CfeLocalForce | null)[];
}

export interface CfeLocalForce {
  Nxx: number;
  Nyy: number;
  Nxy: number;
  Mxx: number;
  Myy: number;
  Mxy: number;
  Qx: number;
  Qy: number;
}

export interface CfeSectionPer {
  M?: number;
  V?: number;
  N?: number;
  y?: number;
  x?: number;
  T?: number;
  Cc?: number;
  z?: number;
  r?: number;
}

export interface CfeSectionHand {
  M: number;
  V: number;
  N?: number;
  sd: number;
  Mr?: number;
  note?: string;
}

export interface CfeSection {
  id: string;
  name: string;
  where: string;
  per: Record<string, CfeSectionPer>;
  rcS?: string;
  sgn?: number;
  y?: number;
  rib?: boolean;
  cd?: CfeSectionPer & { k: string };
  sd?: CfeSectionPer & { k: string };
  ee?: CfeSectionPer & { k: string };
  hand?: CfeSectionHand | null;
  S?: RcSectionInput;
  rc?: RcRunResult;
  cap?: number;
  util?: number;
  ok?: boolean;
}

export interface CfeRibProfile {
  y: number[];
  Mu: number[];
  Ms: number[];
  Me: number[];
  Vu: number[];
  Vs: number[];
  Ve: number[];
  Nu: number[];
  Ns: number[];
  Ne: number[];
}

export interface CfeProfKEntry {
  M: number[];
  V: number[];
  N: number[];
  z: number[];
  T: number[];
  C: number[];
}

export type CfeSectionsArray = CfeSection[] & {
  prof?: CfeRibProfile;
  profK?: Record<string, CfeProfKEntry>;
};

export interface CfeLoadCasesData {
  cases: Record<string, Float64Array>;
  prof: Record<string, { Fx: number[]; Fy: number[] }>;
  heel: { ty: string; xa: number; q: number }[];
  keys: ({ A: number; x: number } | null)[];
}

export interface CfeSolveResult {
  ok?: boolean;
  err?: string;
  ribbed?: boolean;
  mesh?: {
    nodes: number;
    elems: number;
    nz: number;
    ny: number;
    Lu: number;
    dof: number;
  };
  combos?: {
    k: string;
    nm: string;
    sd: boolean;
    ev: boolean;
    N: number;
    H: number;
    s: number;
    e: number;
    Lc: number;
    Rpin: number;
    q1: number;
    q2: number;
  }[];
  secRaw?: CfeSectionsArray;
  prof?: CfeRibProfile | null;
  profK?: Record<string, CfeProfKEntry> | null;
  kfe?: number;
  ms?: number;
  M?: CfeModelData;
  res?: CfeComboResult[];
  LC?: CfeLoadCasesData;
  sec?: CfeSection[];
  util?: number;
  basis?: 'fe' | 'hand';
}

export const CFE = (() => {
  const uniq = (a: number[]): number[] => {
    const s = a.map((v) => Math.round(v * 1e7) / 1e7).sort((u, v) => u - v);
    const o: number[] = [];
    s.forEach((v) => {
      if (!o.length || v - o[o.length - 1] > 1e-6) o.push(v);
    });
    return o;
  };

  const fill = (pts: number[], h: number): number[] => {
    const a = uniq(pts);
    const o = [a[0]];
    for (let i = 1; i < a.length; i++) {
      const L = a[i] - a[i - 1];
      const n = Math.max(1, Math.ceil(L / h - 1e-9));
      for (let k = 1; k <= n; k++) o.push(a[i - 1] + (L * k) / n);
    }
    return o;
  };

  const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));

  function belowZero(poly: Point2D[], xa: number, xb: number): { A: number; x: number } | null {
    const cl = (P: Point2D[], fn: (p: Point2D) => number): Point2D[] => {
      const o: Point2D[] = [];
      for (let i = 0; i < P.length; i++) {
        const a = P[i];
        const b = P[(i + 1) % P.length];
        const fa = fn(a);
        const fb = fn(b);
        if (fa <= 0) o.push(a);
        if ((fa < 0 && fb > 0) || (fa > 0 && fb < 0)) {
          const t = fa / (fa - fb);
          o.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
        }
      }
      return o;
    };
    let P = cl(poly, (p) => p[1] - 0);
    P = cl(P, (p) => xa - p[0]);
    P = cl(P, (p) => p[0] - xb);
    if (P.length < 3) return null;
    let A = 0;
    let cx = 0;
    for (let i = 0; i < P.length; i++) {
      const a = P[i];
      const b = P[(i + 1) % P.length];
      const c = a[0] * b[1] - b[0] * a[1];
      A += c;
      cx += (a[0] + b[0]) * c;
    }
    A /= 2;
    if (Math.abs(A) < 1e-9) return null;
    return { A: Math.abs(A), x: cx / (6 * A) };
  }

  function build(R: CfeWallResult, opt?: CfeOptions): CfeModelData {
    opt = opt || {};
    const g = R.g;
    const rg = R.rg || null;
    const E = R.M.Ec * 1e3;
    const nu = 0.2;
    const strip = !rg;
    const Lu = rg ? rg.Lu : 1;
    const B = g.B;
    const yT = g.yT;
    const yF = g.yF;
    const th = g.topF(B);
    const ym = th / 2;
    const rt = rg ? rg.rt : 0;
    const m = FE3D.model({ kappa: 5 / 6, drill: 0.001 });
    const EL: CfeElMeta[] = [];
    const xf = (y: number) => g.xf(clamp(y, yF, yT));
    const xb = (y: number) => g.xb(clamp(y, yF, yT));
    const xm = (y: number) => 0.5 * (xf(y) + xb(y));
    const tS = (y: number) => Math.max(0.05, xb(y) - xf(y));
    const nodeMap = new Map<string, number>();
    const N = (x: number, y: number, z: number): number => {
      const k = Math.round(x * 1e5) + '|' + Math.round(y * 1e5) + '|' + Math.round(z * 1e5);
      let i = nodeMap.get(k);
      if (i == null) {
        i = m.node(x, y, z);
        nodeMap.set(k, i);
      }
      return i;
    };
    const sy = [ym, yF, yT];
    (g.stem || []).forEach((p) => {
      if (p[1] > yF + 1e-6 && p[1] < yT - 1e-6) sy.push(p[1]);
    });
    let yE = 0;
    let xE = 0;
    let xT = 0;
    let yR = 0;
    let nxr = 0;
    if (rg) {
      yE = rg.E[1];
      xE = rg.E[0];
      xT = rg.T[0];
      yR = rg.T[1];
      sy.push(yR, yE);
      nxr = Math.max(4, Math.ceil((xE - xb(yF)) / (opt.hxr || 0.5)) + 1);
    }
    const hy = opt.hy || Math.min(0.5, Math.max(0.25, (yT - yF) / 14));
    const Y = fill(sy, hy);
    let Z: number[];
    if (strip) Z = [0, 1];
    else {
      const pts = [0, Lu];
      rg.ctr.forEach((c) => pts.push(c - rt / 2, c, c + rt / 2));
      Z = fill(pts, opt.hz || 0.45);
    }
    const xj = xm(yF);
    const sx = [0, B, xj, xf(yF), xb(yF)];
    const xh = (y: number) =>
      y <= yE ? xE : xE + ((xT - xE) * (y - yE)) / Math.max(yR - yE, 1e-9);
    const ribX = (y: number, i: number) =>
      i === 0 ? xm(y) : i === 1 ? xb(y) : xb(y) + ((xh(y) - xb(y)) * (i - 1)) / (nxr - 1);
    if (rg) for (let i = 0; i <= nxr; i++) sx.push(ribX(ym, i));
    const X = fill(sx, opt.hx || 0.5);
    const stemEl: number[][] = [];
    const slabEl: number[][] = [];
    const ribEl: number[][][] = [];
    const addEl = (
      kind: 'stem' | 'slab' | 'rib',
      ns: [number, number, number, number],
      t: number,
      meta: Omit<CfeElMeta, 'kind' | 't' | 'e'>,
    ): number => {
      const e =
        ns[2] === ns[3]
          ? m.tri(ns[0], ns[1], ns[2], t, E, nu)
          : m.shell(ns[0], ns[1], ns[2], ns[3], t, E, nu);
      EL[e] = Object.assign({ kind, t, e }, meta);
      return e;
    };
    for (let j = 0; j + 1 < Y.length; j++) {
      stemEl[j] = [];
      const ya = Y[j];
      const yb = Y[j + 1];
      const yc = (ya + yb) / 2;
      for (let k = 0; k + 1 < Z.length; k++) {
        const ns: [number, number, number, number] = [
          N(xm(ya), ya, Z[k]),
          N(xm(yb), yb, Z[k]),
          N(xm(yb), yb, Z[k + 1]),
          N(xm(ya), ya, Z[k + 1]),
        ];
        stemEl[j][k] = addEl('stem', ns, tS(yc), {
          j,
          k,
          yc,
          zc: (Z[k] + Z[k + 1]) / 2,
          xc: xm(yc),
          own: yc >= yF - 1e-9,
          dz: Z[k + 1] - Z[k],
          sl: Math.hypot(yb - ya, xm(yb) - xm(ya)),
        });
      }
    }
    for (let i = 0; i + 1 < X.length; i++) {
      slabEl[i] = [];
      const xa = X[i];
      const xbb = X[i + 1];
      const xc = (xa + xbb) / 2;
      for (let k = 0; k + 1 < Z.length; k++) {
        const ns: [number, number, number, number] = [
          N(xa, ym, Z[k]),
          N(xbb, ym, Z[k]),
          N(xbb, ym, Z[k + 1]),
          N(xa, ym, Z[k + 1]),
        ];
        slabEl[i][k] = addEl('slab', ns, Math.max(0.05, g.topF(xc)), {
          i,
          k,
          xc,
          zc: (Z[k] + Z[k + 1]) / 2,
          own: true,
          dx: xbb - xa,
          dz: Z[k + 1] - Z[k],
          yTop: g.topF(xc),
        });
      }
    }
    const ribRows = Y.map((_, j) => j).filter((j) => Y[j] >= ym - 1e-9 && Y[j] <= yR + 1e-9);
    if (rg) {
      rg.ctr.forEach((zk, r) => {
        ribEl[r] = [];
        for (let a = 0; a + 1 < ribRows.length; a++) {
          const j = ribRows[a];
          const ya = Y[j];
          const yb = Y[j + 1];
          const yc = (ya + yb) / 2;
          ribEl[r][a] = [];
          for (let i = 0; i < nxr; i++) {
            const p1: Point2D = [ribX(ya, i), ya];
            const p2: Point2D = [ribX(ya, i + 1), ya];
            const p3: Point2D = [ribX(yb, i + 1), yb];
            const p4: Point2D = [ribX(yb, i), yb];
            const ns: [number, number, number, number] = [
              N(p1[0], p1[1], zk),
              N(p2[0], p2[1], zk),
              N(p3[0], p3[1], zk),
              N(p4[0], p4[1], zk),
            ];
            if (ns[0] === ns[1]) continue;
            const xc = (p1[0] + p2[0] + p3[0] + p4[0]) / 4;
            const own = i >= 1 && yc >= yE - 1e-9 && yc > g.topF(xc);
            ribEl[r][a][i] = addEl('rib', ns, rt, {
              r,
              a,
              i,
              yc,
              xc,
              zc: zk,
              own,
              ya,
              yb,
            });
          }
        }
      });
    }
    return {
      m,
      EL,
      Y,
      Z,
      X,
      stemEl,
      slabEl,
      ribEl,
      ribRows,
      ym,
      th,
      B,
      yT,
      yF,
      Lu,
      strip,
      rt,
      E,
      nu,
      xm,
      xb,
      xf,
      tS,
      xh,
      ribX,
      yE,
      xE,
      xT,
      yR,
      nxr,
      xj,
      nodeMap,
    };
  }

  function stemProfile(
    R: CfeWallResult,
    Yl: number[],
  ): Record<string, { Fx: number[]; Fy: number[] }> {
    const out: Record<string, { Fx: number[]; Fy: number[] }> = {};
    const key = (l: { ty: string; sub?: string; dyn?: boolean }): string | null =>
      l.ty === 'WA'
        ? l.sub === 'front'
          ? 'WAF'
          : 'WAB'
        : l.ty === 'EQ'
          ? l.dyn
            ? 'EQd'
            : null
          : l.ty === 'DC'
            ? null
            : l.ty;
    const z = () => ({ Fx: Yl.map(() => 0), Fy: Yl.map(() => 0) });
    Yl.forEach((y, j) => {
      if (y >= R.g.yT - 1e-9) return;
      const st = CALC.stemSec(R.I, R.g, y, R.ctx);
      st.L.forEach((l) => {
        const k = key(l);
        if (!k) return;
        const o = out[k] || (out[k] = z());
        o.Fx[j] += l.Fx;
        o.Fy[j] += l.Fy;
      });
    });
    return out;
  }

  function loadCases(R: CfeWallResult, M: CfeModelData): CfeLoadCasesData {
    const { m, EL, Y, Z, X, stemEl, slabEl, ribEl, ribRows } = M;
    const I = R.I;
    const g = R.g;
    const rg = R.rg || null;
    const Wt: EngineWaterResult | null = R.W || null;
    const Eq = R.E || null;
    const gc = I.gc;
    const cases: Record<string, Float64Array> = {
      DC: m.zeros(),
      EV: m.zeros(),
      EH: m.zeros(),
      ES: m.zeros(),
      LSh: m.zeros(),
      LSv: m.zeros(),
      WA: m.zeros(),
      EQ: m.zeros(),
    };
    const hB = Wt ? Wt.hB : -1e9;
    const soilW = (x: number, ya: number): number => {
      const yg = g.yG(x);
      const tot = Math.max(0, yg - ya);
      const wet = Wt ? Math.max(0, Math.min(yg, hB) - ya) : 0;
      return I.gs * (tot - wet) + (Wt ? I.gsat || I.gs : I.gs) * wet;
    };
    const heel: { ty: string; xa: number; q: number }[] = [];
    R.Ld.L.forEach((l) => {
      const Lh = l.Lq != null ? (l.Lq as number) : (l.Ll as number | undefined);
      if ((l.ty === 'ES' || l.ty === 'LSv') && Lh != null && Lh > 1e-9)
        heel.push({ ty: l.ty, xa: g.B - Lh, q: -l.Fy / Lh });
    });
    const qOf = (ty: string, x: number): number =>
      heel.reduce((s, h) => s + (h.ty === ty && x >= h.xa - 1e-9 ? h.q : 0), 0);
    const mzAdd = (F: Float64Array, e: number, Mz: number): void => {
      const E = m.elems[e];
      const w = E.wN.reduce((a, b) => a + b, 0);
      for (let i = 0; i < 4; i++) F[6 * E.n[i] + 5] += (Mz * E.wN[i]) / w;
    };
    const rt2 = (rg ? rg.rt : 0) / 2;
    const inFoot = (x: number, z: number): boolean => {
      if (!rg || x < M.xb(M.yF) - 1e-9 || x > M.xE + 1e-9) return false;
      return rg.ctr.some((zk) => Math.abs(z - zk) <= rt2 + 1e-9);
    };
    const body = (F: Float64Array, ax: number, ay: number): void => {
      EL.forEach((E, e) => {
        if (!E || !E.own) return;
        const f = E.kind === 'stem' ? (Y[E.j! + 1] - Y[E.j!]) / E.sl! : 1;
        m.addBody(F, e, [ax * gc * f, ay * gc * f, 0]);
      });
    };
    body(cases.DC, 0, -1);
    if (Eq) body(cases.EQ, -Eq.kh, Eq.kv);
    const keys = [belowZero(g.foot, -1e9, g.B / 2), belowZero(g.foot, g.B / 2, 1e9)].filter(
      (k): k is { A: number; x: number } => Boolean(k),
    );
    const Zw = Z.map((_, k) =>
      k === 0
        ? (Z[1] - Z[0]) / 2
        : k === Z.length - 1
          ? (Z[k] - Z[k - 1]) / 2
          : (Z[k + 1] - Z[k - 1]) / 2,
    );
    const lineLoad = (F: Float64Array, x: number, wy: number, wx: number): void => {
      let i = 0;
      while (i + 2 < X.length && X[i + 1] < x) i++;
      const f1 = clamp((X[i + 1] - x) / (X[i + 1] - X[i]), 0, 1);
      Z.forEach((z, k) =>
        (
          [
            [X[i], f1],
            [X[i + 1], 1 - f1],
          ] as [number, number][]
        ).forEach(([xx, f]) => {
          const n = M.nodeMap.get(
            Math.round(xx * 1e5) + '|' + Math.round(M.ym * 1e5) + '|' + Math.round(z * 1e5),
          );
          if (n != null) m.addNodal(F, n, [wx * f * Zw[k], wy * f * Zw[k], 0, 0, 0, 0]);
        }),
      );
    };
    keys.forEach((k) => {
      const w = gc * k.A;
      lineLoad(cases.DC, k.x, -w, 0);
      if (Eq) lineLoad(cases.EQ, k.x, Eq.kv * w, -Eq.kh * w);
    });
    const Yst = Y.filter((y) => y >= g.yF - 1e-9);
    const prof = stemProfile(R, Yst);
    const face: Record<string, 'B' | 'F'> = {
      EH: 'B',
      ES: 'B',
      LSh: 'B',
      LSv: 'B',
      EQd: 'B',
      WAB: 'B',
      WAF: 'F',
    };
    const tgt: Record<string, string> = {
      EH: 'EH',
      ES: 'ES',
      LSh: 'LSh',
      LSv: 'LSv',
      EQd: 'EQ',
      WAB: 'WA',
      WAF: 'WA',
    };
    Object.keys(prof).forEach((kk) => {
      if (!tgt[kk]) return;
      const F = cases[tgt[kk]];
      const P = prof[kk];
      for (let jj = 0; jj + 1 < Yst.length; jj++) {
        const j = Y.indexOf(Yst[jj]);
        const dFx = P.Fx[jj] - P.Fx[jj + 1];
        const dFy = P.Fy[jj] - P.Fy[jj + 1];
        if (Math.abs(dFx) + Math.abs(dFy) < 1e-12) continue;
        const yc = (Yst[jj] + Yst[jj + 1]) / 2;
        const ecc = (face[kk] === 'B' ? 0.5 : -0.5) * M.tS(yc);
        stemEl[j].forEach((e) => {
          const E = EL[e];
          m.addPressure(F, e, [dFx / E.sl!, dFy / E.sl!, 0]);
          mzAdd(F, e, ecc * dFy * E.dz!);
        });
      }
    });
    const vcol: Record<string, (x: number, y: number) => number> = {
      EV: (x, y) => soilW(x, y),
      ES: (x) => qOf('ES', x),
      LSv: (x) => qOf('LSv', x),
    };
    (['EV', 'ES', 'LSv'] as const).forEach((ty) => {
      const F = cases[ty];
      const col = vcol[ty];
      slabEl.forEach((row) =>
        row.forEach((e) => {
          const E = EL[e];
          if (E.xc < M.xb(M.yF) - 1e-9 || inFoot(E.xc, E.zc)) return;
          const p = col(E.xc, E.yTop!);
          if (p > 1e-12) m.addPressure(F, e, [0, -p, 0]);
        }),
      );
      if (rg) {
        rg.ctr.forEach((zk, r) => {
          for (let a = 0; a + 1 < ribRows.length; a++) {
            const ya = Y[ribRows[a]];
            const yb = Y[ribRows[a] + 1];
            if (ya < M.yE - 1e-9) continue;
            const dx = M.xh(ya) - M.xh(yb);
            if (dx <= 1e-9) continue;
            const xc = (M.xh(ya) + M.xh(yb)) / 2;
            const p = col(xc, (ya + yb) / 2);
            if (p < 1e-12) continue;
            const w = (-p * rg.rt * dx) / 2;
            void (ribEl[r] && ribEl[r][a]);
            [
              M.nodeMap.get(
                Math.round(M.ribX(ya, M.nxr) * 1e5) +
                  '|' +
                  Math.round(ya * 1e5) +
                  '|' +
                  Math.round(zk * 1e5),
              ),
              M.nodeMap.get(
                Math.round(M.ribX(yb, M.nxr) * 1e5) +
                  '|' +
                  Math.round(yb * 1e5) +
                  '|' +
                  Math.round(zk * 1e5),
              ),
            ].forEach((nn) => {
              if (nn != null) m.addNodal(F, nn, [0, w, 0, 0, 0, 0]);
            });
          }
        });
      }
    });
    if (Wt && Wt.ub) {
      slabEl.forEach((row) =>
        row.forEach((e) => {
          const E = EL[e];
          const u = Wt.ub(E.xc);
          if (Math.abs(u) > 1e-12) m.addPressure(cases.WA, e, [0, u, 0]);
        }),
      );
    }
    return { cases, prof, heel, keys };
  }

  function supports(M: CfeModelData): void {
    const { m, nodeMap } = M;
    const nd = (x: number, y: number, z: number) =>
      nodeMap.get(Math.round(x * 1e5) + '|' + Math.round(y * 1e5) + '|' + Math.round(z * 1e5));
    const fl: number[][] = [];
    for (let n = 0; n < m.nNodes; n++)
      fl[n] = [0, 0, M.strip ? 1 : 0, M.strip ? 1 : 0, M.strip ? 1 : 0, 0];
    const set = (n: number | undefined, a: number[]) => {
      if (n == null) throw new Error('không tìm thấy nút gối');
      a.forEach((v, i) => {
        if (v) fl[n][i] = 1;
      });
    };
    set(nd(0, M.ym, 0), [1, 1, 1, 0, 0, 0]);
    set(nd(M.B, M.ym, 0), [0, 1, 0, 0, 0, 0]);
    if (!M.strip) set(nd(0, M.ym, M.Lu), [1, 1, 0, 0, 0, 0]);
    fl.forEach((a, n) => {
      if (a.some((v) => v)) m.fix(n, a);
    });
    M.pins = [nd(0, M.ym, 0)!, nd(M.B, M.ym, 0)!].concat(M.strip ? [] : [nd(0, M.ym, M.Lu)!]);
  }

  function solveAll(R: CfeWallResult, M: CfeModelData, LC: CfeLoadCasesData): CfeComboResult[] {
    const { m, EL, slabEl } = M;
    const B = M.B;
    const Lu = M.Lu;
    const xyz = m.xyz;
    const T = ['DC', 'EV', 'EH', 'ES', 'LSh', 'LSv', 'WA', 'EQ'] as const;
    const res: CfeComboResult[] = [];
    supports(M);
    m.factor();
    R.C.forEach((c: CalcComboEval) => {
      const F = m.zeros();
      T.forEach((t) => {
        const f = c.f(t);
        if (Math.abs(f) < 1e-12) return;
        const V = LC.cases[t];
        for (let i = 0; i < F.length; i++) F[i] += f * V[i];
      });
      let Fx = 0;
      let Fy = 0;
      let Mz = 0;
      for (let n = 0; n < xyz.length; n++) {
        const fx = F[6 * n];
        const fy = F[6 * n + 1];
        Fx += fx;
        Fy += fy;
        Mz += (xyz[n][0] - B / 2) * fy - xyz[n][1] * fx + F[6 * n + 5];
      }
      const Nm = -Fy / Lu;
      const Hm = -Fx / Lu;
      const s = -Mz / Lu / Nm;
      const ok = Nm > 1e-6;
      const pr = ok ? CALC.press(Nm, s, B) : null;
      const e = Math.abs(s);
      const Lc = !ok ? B : e <= B / 6 ? B : pr!.Lc;
      const x0 = !ok ? 0 : e <= B / 6 ? 0 : s < 0 ? 0 : B - Lc;
      const tau = Hm / Math.max(Lc, 1e-9);
      const Fb = m.zeros();
      if (ok && pr) {
        slabEl.forEach((row) =>
          row.forEach((ee) => {
            const E = EL[ee];
            const xa = E.xc - E.dx! / 2;
            const xb = E.xc + E.dx! / 2;
            const q = (pr.q(xa) + 4 * pr.q(E.xc) + pr.q(xb)) / 6;
            if (q > 1e-12) m.addPressure(Fb, ee, [0, q, 0]);
            const cov = Math.max(0, Math.min(xb, x0 + Lc) - Math.max(xa, x0)) / E.dx!;
            if (cov > 1e-9 && Math.abs(tau) > 1e-12) {
              m.addPressure(Fb, ee, [tau * cov, 0, 0]);
              const E2 = m.elems[ee];
              for (let i = 0; i < 4; i++) Fb[6 * E2.n[i] + 5] += M.ym * tau * cov * E2.wN[i];
            }
          }),
        );
      }
      for (let i = 0; i < F.length; i++) F[i] += Fb[i];
      const U = m.solve(F);
      const Rr = m.reactions(F, U);
      let rs = 0;
      (M.pins || []).forEach((n) => {
        rs += Math.hypot(Rr[6 * n], Rr[6 * n + 1], Rr[6 * n + 2]);
      });
      res.push({
        k: c.k,
        nm: c.nm,
        sd: !!c.sd,
        ev: !!c.ev,
        N: Nm,
        H: Hm,
        s,
        e,
        Lc,
        x0,
        tau,
        pr,
        U,
        Rpin: rs,
        force: m.forces(U),
      });
    });
    return res;
  }

  const avgF = (list: (CfeLocalForce | null | undefined)[]): CfeLocalForce => {
    const o: CfeLocalForce = { Nxx: 0, Nyy: 0, Nxy: 0, Mxx: 0, Myy: 0, Mxy: 0, Qx: 0, Qy: 0 };
    const n = list.length;
    list.forEach((r) => {
      if (!r) return;
      (Object.keys(o) as (keyof CfeLocalForce)[]).forEach((k) => {
        o[k] += r[k] / n;
      });
    });
    return o;
  };

  function rotate(M: CfeModelData, c: CfeComboResult): void {
    c.rf = c.force.map((r, e) => {
      const E = M.EL[e];
      return E ? FE3D.inAxes(r, E.kind === 'slab' ? [1, 0, 0] : [0, 1, 0]) : null;
    });
  }

  const stemLine = (M: CfeModelData, c: CfeComboResult, j: number, k: number): CfeLocalForce => {
    const L: (CfeLocalForce | null)[] = [];
    [j - 1, j].forEach((jj) => {
      if (M.stemEl[jj] && M.stemEl[jj][k] != null && c.rf) L.push(c.rf[M.stemEl[jj][k]]);
    });
    return avgF(L);
  };

  function zCols(M: CfeModelData, rg: CalcRibResult['rg'] | null | undefined) {
    const nz = M.Z.length - 1;
    const axis: number[] = [];
    const span: number[] = [];
    if (!rg) {
      for (let k = 0; k < nz; k++) {
        axis.push(k);
        span.push(k);
      }
      return { axis, span };
    }
    rg.ctr.forEach((zk) => {
      for (let k = 0; k < nz; k++)
        if (Math.abs(M.Z[k + 1] - zk) < 1e-6 || Math.abs(M.Z[k] - zk) < 1e-6) axis.push(k);
    });
    for (let r = 0; r + 1 < rg.ctr.length; r++) {
      const zm = (rg.ctr[r] + rg.ctr[r + 1]) / 2;
      let best = 0;
      let bd = 1e9;
      for (let k = 0; k < nz; k++) {
        const d = Math.abs((M.Z[k] + M.Z[k + 1]) / 2 - zm);
        if (d < bd) {
          bd = d;
          best = k;
        }
      }
      span.push(best);
    }
    return { axis, span };
  }

  const worst = <T extends Record<string, unknown>>(items: T[], key: keyof T): T | null =>
    items.reduce<T | null>(
      (a, b) => (!a || Math.abs(Number(b[key])) > Math.abs(Number(a[key])) ? b : a),
      null,
    );

  function ribWeb(
    M: CfeModelData,
    c: CfeComboResult,
    r: number,
    a: number,
    o?: { xref?: number; i0?: number; bend?: boolean },
  ) {
    o = o || {};
    const j = M.ribRows[a];
    const y = M.Y[j];
    const row = [a - 1, a].filter((q) => q >= 0 && q < M.ribEl[r].length);
    const cols: { i: number; w: number; N: number; V: number }[] = [];
    let Fy = 0;
    let Fx = 0;
    let Mm = 0;
    const xref = o.xref != null ? o.xref : (M.xf(y) + M.xh(y)) / 2;
    for (let i = o.i0 || 0; i < M.nxr; i++) {
      const L = row
        .map((q) =>
          M.ribEl[r][q] && M.ribEl[r][q][i] != null && c.rf ? c.rf[M.ribEl[r][q][i]] : null,
        )
        .filter((x): x is CfeLocalForce => Boolean(x));
      if (!L.length) continue;
      const f = avgF(L);
      const xa = M.ribX(y, i);
      const xb = M.ribX(y, i + 1);
      const w = xb - xa;
      Fy += f.Nxx * w;
      Fx += -f.Nxy * w;
      Mm += f.Nxx * w * ((xa + xb) / 2 - xref) + (o.bend ? f.Mxx * 0 : 0);
      cols.push({ i, w, N: f.Nxx, V: -f.Nxy });
    }
    return { y, N: Fy, V: Fx, M: Mm, xref, cols };
  }

  const KFE = 1.1;
  const rcU = (rc: RcRunResult): number => {
    const f = (v: number) => (isFinite(v) ? v : 0);
    return Math.max(
      rc.gM ? f(1 / rc.gM.rM) : 0,
      rc.gV ? f(1 / rc.gV.rV) : 0,
      rc.minR ? f(rc.minR.lim / Math.max(rc.minR.Mr, 1e-9)) : 0,
      rc.cr ? f(rc.cr.sb / rc.cr.smax) : 0,
    );
  };

  function slabLine(
    M: CfeModelData,
    c: CfeComboResult,
    iLine: number,
    k: number,
    side: number,
  ): CfeLocalForce {
    const i1 = side < 0 ? iLine - 1 : iLine;
    const i2 = side < 0 ? iLine - 2 : iLine + 1;
    const E1 = M.slabEl[i1] && M.slabEl[i1][k];
    const E2 = M.slabEl[i2] && M.slabEl[i2][k];
    const r1 = c.rf![E1]!;
    if (E2 == null) return r1;
    const r2 = c.rf![E2]!;
    const d1 = M.EL[E1].dx! / 2;
    const d2 = M.EL[E1].dx! + M.EL[E2].dx! / 2;
    const o: CfeLocalForce = { Nxx: 0, Nyy: 0, Nxy: 0, Mxx: 0, Myy: 0, Mxy: 0, Qx: 0, Qy: 0 };
    (['Nxx', 'Nyy', 'Mxx', 'Myy', 'Qx', 'Qy'] as const).forEach((q) => {
      o[q] = r1[q] + ((r1[q] - r2[q]) * d1) / (d2 - d1);
    });
    return o;
  }

  function sections(R: CfeWallResult, M: CfeModelData, res: CfeComboResult[]): CfeSectionsArray {
    const rg = R.rg || null;
    const zc = zCols(M, rg);
    const j0 = M.Y.findIndex((y) => Math.abs(y - M.yF) < 1e-6);
    const iF = M.X.findIndex((x) => Math.abs(x - M.xf(M.yF)) < 1e-6);
    const iB = M.X.findIndex((x) => Math.abs(x - M.xb(M.yF)) < 1e-6);
    const secs = [] as unknown as CfeSectionsArray;
    const mx = (items: CfeLocalForce[], key: keyof CfeLocalForce): CfeLocalForce =>
      worst(items as unknown as Record<string, unknown>[], key as string) as unknown as CfeLocalForce;
    const ks = rg ? null : [0];
    const add = (
      id: string,
      name: string,
      where: string,
      fn: (c: CfeComboResult) => CfeSectionPer,
      o?: Partial<CfeSection>,
    ): CfeSection => {
      const per: Record<string, CfeSectionPer> = {};
      res.forEach((c) => {
        per[c.k] = fn(c);
      });
      const sec = Object.assign({ id, name, where, per }, o || {});
      secs.push(sec);
      return secs[secs.length - 1];
    };
    const stemBase = (cols: number[]) => (c: CfeComboResult): CfeSectionPer => {
      const f = mx(
        cols.map((k) => stemLine(M, c, j0, k)),
        'Mxx',
      );
      return { M: f.Mxx, V: Math.abs(f.Qx), N: -f.Nxx };
    };
    add(
      'S1',
      rg
        ? 'Thân tường – chân thân, uốn đứng tại trục sườn'
        : 'Thân tường – chân thân (mặt cắt trên mặt bản đáy)',
      'y = ' + M.yF.toFixed(2) + ' m',
      stemBase(zc.axis),
      { rcS: 'stem', sgn: 1 },
    );
    if (rg) {
      add(
        'S2',
        'Thân tường – chân thân, uốn đứng giữa nhịp (giữa hai sườn)',
        'y = ' + M.yF.toFixed(2) + ' m',
        stemBase(zc.span),
        { rcS: 'stem', sgn: 1 },
      );
    } else {
      const ym2 = M.yF + (M.yT - M.yF) / 2;
      const jm = M.Y.reduce(
        (b, _, j) => (Math.abs(M.Y[j] - ym2) < Math.abs(M.Y[b] - ym2) ? j : b),
        0,
      );
      add(
        'S2',
        'Thân tường – giữa chiều cao',
        'y = ' + M.Y[jm].toFixed(2) + ' m',
        (c) => {
          const f = stemLine(M, c, jm, 0);
          return { M: f.Mxx, V: Math.abs(f.Qx), N: -f.Nxx };
        },
        { rcS: 'stemMid', sgn: 1, y: M.Y[jm] },
      );
    }
    if (rg) {
      const hor = (cols: number[]) => (c: CfeComboResult): CfeSectionPer => {
        let best: (CfeLocalForce & { y: number }) | null = null;
        for (let j = j0; j < M.stemEl.length; j++) {
          cols.forEach((k) => {
            const f = c.rf![M.stemEl[j][k]]!;
            if (!best || Math.abs(f.Myy) > Math.abs(best.Myy))
              best = Object.assign({ y: M.EL[M.stemEl[j][k]].yc! }, f);
          });
        }
        return { M: best!.Myy, V: Math.abs(best!.Qy), N: -best!.Nyy, y: best!.y };
      };
      add(
        'S3',
        'Thân tường – uốn ngang tại gối (trục sườn)',
        'dải lớn nhất theo chiều cao',
        hor(zc.axis),
        { rcS: 'hor', sgn: -1 },
      );
      add('S4', 'Thân tường – uốn ngang giữa nhịp', 'dải lớn nhất theo chiều cao', hor(zc.span), {
        rcS: 'hor',
        sgn: -1,
      });
      const heel = (cols: number[]) => (c: CfeComboResult): CfeSectionPer => {
        let best: (CfeLocalForce & { x: number }) | null = null;
        M.slabEl.forEach((row) =>
          cols.forEach((k) => {
            const E = M.EL[row[k]];
            if (E.xc < M.xb(M.yF) - 1e-9 || E.xc > M.xE) return;
            const f = c.rf![row[k]]!;
            if (!best || Math.abs(f.Myy) > Math.abs(best.Myy))
              best = Object.assign({ x: E.xc }, f);
          }),
        );
        return { M: best!.Myy, V: Math.abs(best!.Qy), N: -best!.Nyy, x: best!.x };
      };
      add(
        'S5',
        'Bản đáy (gót) – uốn theo phương dọc tường tại trục sườn',
        'dải lớn nhất theo bề rộng gót',
        heel(zc.axis),
        { rcS: 'heel', sgn: 1 },
      );
      add(
        'S6',
        'Bản đáy (gót) – uốn theo phương dọc tường giữa nhịp',
        'dải lớn nhất theo bề rộng gót',
        heel(zc.span),
        { rcS: 'heel', sgn: 1 },
      );
    }
    const toeF = (cols: number[]) => (c: CfeComboResult): CfeSectionPer => {
      const f = mx(
        cols.map((k) => slabLine(M, c, iF, k, -1)),
        'Mxx',
      );
      return { M: f.Mxx, V: Math.abs(f.Qx), N: -f.Nxx };
    };
    add(
      rg ? 'S7' : 'S3',
      'Bản đáy – mũi, mép trước thân',
      'x = ' + M.xf(M.yF).toFixed(2) + ' m',
      toeF(rg ? zc.axis.concat(zc.span) : ks!),
      { rcS: 'toe', sgn: 1 },
    );
    if (!rg) {
      const heelF = (c: CfeComboResult): CfeSectionPer => {
        const f = slabLine(M, c, iB, 0, 1);
        return { M: f.Mxx, V: Math.abs(f.Qx), N: -f.Nxx };
      };
      add('S4', 'Bản đáy – gót, mép sau thân', 'x = ' + M.xb(M.yF).toFixed(2) + ' m', heelF, {
        rcS: 'toe',
        sgn: 1,
      });
    }
    if (rg) {
      const a0 = M.ribRows.findIndex((j) => Math.abs(M.Y[j] - rg.yb) < 1e-6);
      const nA = M.ribRows.length;
      const cut = (a: number, c: CfeComboResult, r: number): CfeSectionPer => {
        const w = ribWeb(M, c, r, a);
        const y = w.y;
        const jj = M.ribRows[a];
        const bf = Math.min(rg.S, 12 * M.tS(y) + rg.rt);
        const zk = rg.ctr[r];
        const F: { F: number; x: number }[] = [];
        w.cols.forEach((q) =>
          F.push({ F: q.N * q.w, x: (M.ribX(y, q.i) + M.ribX(y, q.i + 1)) / 2 }),
        );
        for (let k = 0; k + 1 < M.Z.length; k++) {
          const zcMid = (M.Z[k] + M.Z[k + 1]) / 2;
          if (Math.abs(zcMid - zk) > bf / 2 + 1e-9) continue;
          F.push({ F: stemLine(M, c, jj, k).Nxx * (M.Z[k + 1] - M.Z[k]), x: M.xm(y) });
        }
        let T = 0;
        let xT2 = 0;
        let Cc = 0;
        let xC = 0;
        let Ns = 0;
        F.forEach((q) => {
          Ns += q.F;
          if (q.F > 0) {
            T += q.F;
            xT2 += q.F * q.x;
          } else {
            Cc -= q.F;
            xC -= q.F * q.x;
          }
        });
        const h = M.xh(y) - M.xf(y);
        const z = T > 1e-6 && Cc > 1e-6 ? xT2 / T - xC / Cc : 0.5 * h;
        return { T, Cc, z, M: T * Math.max(z, 0), V: Math.abs(w.V), N: -Ns, y };
      };
      const rib = (a: number) => (c: CfeComboResult): CfeSectionPer => {
        let best: CfeSectionPer | null = null;
        rg.ctr.forEach((_, r) => {
          const q = cut(a, c, r);
          if (!best || (q.M || 0) > (best.M || 0)) best = Object.assign({ r }, q);
        });
        return best!;
      };
      const am = a0 + Math.max(1, Math.round((nA - 1 - a0) / 2));
      add(
        'S8',
        'Sườn – chân sườn (mặt trên bản đáy)',
        'y = ' + M.Y[M.ribRows[a0]].toFixed(2) + ' m',
        rib(a0),
        { rcS: 'rib', rib: true, y: M.Y[M.ribRows[a0]] },
      );
      add('S9', 'Sườn – giữa chiều cao', 'y = ' + M.Y[M.ribRows[am]].toFixed(2) + ' m', rib(am), {
        rcS: 'rib',
        rib: true,
        y: M.Y[M.ribRows[am]],
      });
      const prof: CfeRibProfile = {
        y: [],
        Mu: [],
        Ms: [],
        Me: [],
        Vu: [],
        Vs: [],
        Ve: [],
        Nu: [],
        Ns: [],
        Ne: [],
      };
      const profK: Record<string, CfeProfKEntry> = {};
      res.forEach((c) => {
        profK[c.k] = { M: [], V: [], N: [], z: [], T: [], C: [] };
      });
      for (let a = a0; a < nA; a++) {
        const f = rib(a);
        const Q: Record<string, CfeSectionPer> = {};
        res.forEach((c) => {
          Q[c.k] = f(c);
        });
        const pick = (ks2: string[], key: 'M' | 'V') =>
          Math.max(0, ...ks2.filter((k) => Q[k]).map((k) => Q[k][key] || 0));
        const pickN = (ks2: string[]) =>
          ks2
            .filter((k) => Q[k])
            .reduce((b, k) => (Math.abs(Q[k].N || 0) > Math.abs(b) ? Q[k].N || 0 : b), 0);
        prof.y.push(M.Y[M.ribRows[a]]);
        prof.Mu.push(KFE * pick(['Ia', 'Ib', 'Ic'], 'M'));
        prof.Ms.push(KFE * pick(['SD'], 'M'));
        prof.Me.push(KFE * pick(['Ea', 'Eb'], 'M'));
        prof.Vu.push(KFE * pick(['Ia', 'Ib', 'Ic'], 'V'));
        prof.Vs.push(KFE * pick(['SD'], 'V'));
        prof.Ve.push(KFE * pick(['Ea', 'Eb'], 'V'));
        prof.Nu.push(pickN(['Ia', 'Ib', 'Ic']));
        prof.Ns.push(pickN(['SD']));
        prof.Ne.push(pickN(['Ea', 'Eb']));
        res.forEach((c) => {
          const q = Q[c.k];
          profK[c.k].M.push(KFE * (q.M || 0));
          profK[c.k].V.push(KFE * (q.V || 0));
          profK[c.k].N.push(q.N || 0);
          profK[c.k].z.push(q.z || 0);
          profK[c.k].T.push(q.T || 0);
          profK[c.k].C.push(q.Cc || 0);
        });
      }
      secs.prof = prof;
      secs.profK = profK;
    }
    const grp: Record<string, string[]> = { cd: ['Ia', 'Ib', 'Ic'], sd: ['SD'], ee: ['Ea', 'Eb'] };
    secs.forEach((S) => {
      (Object.keys(grp) as ('cd' | 'sd' | 'ee')[]).forEach((gname) => {
        const L = grp[gname]
          .filter((k) => S.per[k])
          .map((k) => Object.assign({ k }, S.per[k]));
        if (!L.length) return;
        S[gname] = L.reduce(
          (a, b) =>
            Math.abs((b.M != null ? b.M : b.T) || 0) > Math.abs((a.M != null ? a.M : a.T) || 0)
              ? b
              : a,
          L[0],
        );
      });
    });
    return secs;
  }

  function handOf(R: CfeWallResult, S: CfeSection): CfeSectionHand | null {
    const cdM = <T extends { M: number }>(L: T[]) =>
      L.reduce((a, b) => (Math.abs(b.M) > Math.abs(a.M) ? b : a));
    const st = R.st;
    const ribbed = !!R.rg;
    if (S.id === 'S1' && !ribbed) {
      const q = cdM([st.Ia, st.Ib, st.Ic]);
      return { M: Math.abs(q.M), V: Math.abs(q.Q), N: q.N, sd: Math.abs(st.SD.M) };
    }
    if (S.id === 'S1' && ribbed) {
      const q = cdM([st.Ia, st.Ib, st.Ic]);
      return {
        M: Math.abs(q.M),
        V: Math.abs(q.Q),
        N: q.N,
        sd: Math.abs(st.SD.M),
        note: 'dải 1 m công xôn',
      };
    }
    const toe = R.toe;
    const U = toe && toe.U;
    if (((S.id === 'S3' && !ribbed) || S.id === 'S7') && U)
      return { M: Math.abs(U.M), V: Math.abs(U.V), sd: Math.abs(toe.SD.M) };
    if (S.id === 'S4' && !ribbed && R.heel && R.heel.U)
      return { M: Math.abs(R.heel.U.M), V: Math.abs(R.heel.U.V), sd: Math.abs(R.heel.SD.M) };
    if (S.id === 'S8' && R.rib && R.rib.base) {
      const b = ((R.hand && R.hand.rib) || R.rib).base;
      if (!b) return null;
      return { V: b.Vu, M: Math.abs(b.Mu), sd: Math.abs(b.Ms), Mr: b.Mr };
    }
    return null;
  }

  function capOf(R: CfeWallResult, S: CfeSection): RcSectionInput | null {
    const E = CALC;
    const I = R.I;
    const RB = R.RB;
    const c = R.cov;
    const cmm = I.cov;
    if (S.rcS === 'stem' && R.st && R.st.Sb) return R.st.Sb;
    if (S.rcS === 'stemMid' && R.st && R.st.Sb)
      return Object.assign({}, R.st.Sb, {
        h: R.g.tmean * 1e3 * 0 + (R.g.xb(S.y!) - R.g.xf(S.y!)) * 1e3,
      });
    if (S.rcS === 'hor' && RB && RB.h1 && c) {
      const ts = R.geo ? R.geo.tsAt(S.cd && S.cd.y != null ? S.cd.y : R.g.yF + 0.5) : R.g.tb;
      return {
        b: 1e3,
        h: ts * 1e3,
        f1: E.bars(RB.h1.d, (RB.h1.a || 20) * 10, c.covFr),
        f2: E.bars(RB.h1.d, (RB.h1.a || 20) * 10, c.covBk),
        st: { s: 1, d: 0, n: 0 },
      };
    }
    if (S.rcS === 'heel' && RB && RB.l1)
      return {
        b: 1e3,
        h: R.g.topF(R.g.B) * 1e3,
        f1: E.bars(RB.l1.d, (RB.l1.a || 20) * 10, cmm + RB.b1.d),
        f2: E.bars(RB.l1.d, (RB.l1.a || 20) * 10, cmm + RB.b2.d),
        st: { s: 1, d: 0, n: 0 },
      };
    if (S.rcS === 'toe' && R.Sf) return R.Sf;
    return null;
  }

  function checkSection(R: CfeWallResult, S: CfeSection): void {
    if (S.rib) {
      const pts = R.rib && R.rib.pts;
      if (!pts || !pts.length) return;
      const b = pts.reduce((a, p) => (Math.abs(p.y - S.y!) < Math.abs(a.y - S.y!) ? p : a), pts[0]);
      const Mr = b.Mr;
      const MrE = b.fl ? b.fl.Mn : Mr;
      const q: Partial<CfeSectionPer> = S.cd || {};
      const uCD = (KFE * (q.M || 0)) / Math.max(Mr, 1e-9);
      const uEE = S.ee ? (KFE * (S.ee.M || 0)) / Math.max(MrE, 1e-9) : 0;
      S.cap = Mr;
      S.util = Math.max(uCD, uEE);
      S.ok = S.util <= 1 + 1e-9;
      return;
    }
    const Sx = capOf(R, S);
    if (!Sx) return;
    const rows: RcLoadCaseInput[] = [];
    ['Ia', 'Ib', 'Ic'].forEach((k) => {
      const q = S.per[k];
      if (q) rows.push({ id: 'CĐ ' + k, st: 'CD', M: S.sgn! * q.M!, V: q.V!, N: q.N! });
    });
    if (S.per.SD)
      rows.push({
        id: 'SD I',
        st: 'SD',
        M: S.sgn! * S.per.SD.M!,
        V: S.per.SD.V!,
        N: S.per.SD.N!,
      });
    ['Ea', 'Eb'].forEach((k) => {
      const q = S.per[k];
      if (q) rows.push({ id: 'ĐB ' + k, st: 'DB', M: S.sgn! * q.M!, V: q.V!, N: q.N! });
    });
    S.S = Sx;
    S.rc = CALC.RC.run(Sx, R.M, rows);
    S.util = rcU(S.rc);
    S.ok = CALC.rcOK(S.rc);
  }

  function ribProvider(prof: CfeRibProfile) {
    const at = (arr: number[], y: number): number => {
      const Y = prof.y;
      if (y <= Y[0]) return arr[0];
      for (let i = 1; i < Y.length; i++)
        if (y <= Y[i])
          return arr[i - 1] + ((arr[i] - arr[i - 1]) * (y - Y[i - 1])) / (Y[i] - Y[i - 1]);
      return arr[arr.length - 1];
    };
    return (y: number) => ({
      Mu: at(prof.Mu, y),
      Ms: at(prof.Ms, y),
      Me: at(prof.Me, y),
      Vu: at(prof.Vu, y),
      Vs: at(prof.Vs, y),
      Ve: at(prof.Ve, y),
    });
  }

  function solve(R: CfeWallResult | null | undefined, opt?: CfeOptions): CfeSolveResult {
    if (!R || !R.C || (R as { error?: string }).error || (R as { unsupported?: boolean }).unsupported)
      return { err: 'Chưa có kết quả tính toán.' };
    const t0 = Date.now();
    try {
      const M = build(R, opt);
      const LC = loadCases(R, M);
      const res = solveAll(R, M, LC);
      res.forEach((c) => rotate(M, c));
      const secRaw = sections(R, M, res);
      return {
        ok: true,
        ribbed: !!R.rg,
        mesh: {
          nodes: M.m.nNodes,
          elems: M.m.nElems,
          nz: M.Z.length - 1,
          ny: M.Y.length - 1,
          Lu: M.Lu,
          dof: M.m.stats ? M.m.stats.nDof : 0,
        },
        combos: res.map((c) => ({
          k: c.k,
          nm: c.nm,
          sd: c.sd,
          ev: c.ev,
          N: c.N,
          H: c.H,
          s: c.s,
          e: c.e,
          Lc: c.Lc,
          Rpin: c.Rpin,
          q1: c.pr ? c.pr.q1 : 0,
          q2: c.pr ? c.pr.q2 : 0,
        })),
        secRaw,
        prof: secRaw.prof || null,
        profK: secRaw.profK || null,
        kfe: KFE,
        ms: Date.now() - t0,
        M,
        res,
        LC,
      };
    } catch (e: unknown) {
      return { err: String((e && (e as Error).message) || e) };
    }
  }

  function check(R: CfeWallResult, fe: CfeSolveResult): CfeSolveResult {
    if (!fe || fe.err || !fe.secRaw) return fe;
    const sec = fe.secRaw.map((S) => {
      const T = Object.assign({}, S);
      T.hand = handOf(R, T);
      checkSection(R, T);
      return T;
    });
    const us = sec.map((S) => S.util!).filter((v) => isFinite(v));
    return Object.assign({}, fe, {
      sec,
      ok: sec.every((S) => S.ok !== false),
      util: us.length ? Math.max(...us) : 0,
    });
  }

  function run(R: CfeWallResult | null | undefined, opt?: CfeOptions): CfeSolveResult {
    const f = solve(R, opt);
    return f.err || !R ? f : check(R, f);
  }

  const abm = (a: number, b: number) => (Math.abs(a) >= Math.abs(b) ? a : b);
  const FQ: Record<
    string,
    { t: string; s: string; u: string; f: (r: CfeLocalForce) => number }
  > = {
    M: {
      t: 'Mômen uốn lớn nhất Mmax (theo |Mxx|, |Myy|)',
      s: 'Mmax',
      u: 'kN.m/m',
      f: (r) => abm(r.Mxx, r.Myy),
    },
    Mxx: { t: 'Mômen Mxx (uốn theo trục 1)', s: 'Mxx', u: 'kN.m/m', f: (r) => r.Mxx },
    Myy: { t: 'Mômen Myy (uốn theo trục 2)', s: 'Myy', u: 'kN.m/m', f: (r) => r.Myy },
    Mxy: { t: 'Mômen xoắn Mxy', s: 'Mxy', u: 'kN.m/m', f: (r) => r.Mxy },
    V: {
      t: 'Lực cắt lớn nhất Vmax (theo |Qx|, |Qy|)',
      s: 'Vmax',
      u: 'kN/m',
      f: (r) => abm(r.Qx, r.Qy),
    },
    Qx: { t: 'Lực cắt Qx (trục 1)', s: 'Qx', u: 'kN/m', f: (r) => r.Qx },
    Qy: { t: 'Lực cắt Qy (trục 2)', s: 'Qy', u: 'kN/m', f: (r) => r.Qy },
    N: {
      t: 'Lực dọc màng lớn nhất Nmax (theo |Nxx|, |Nyy|)',
      s: 'Nmax',
      u: 'kN/m',
      f: (r) => abm(r.Nxx, r.Nyy),
    },
    Nxx: { t: 'Lực dọc màng Nxx (trục 1)', s: 'Nxx', u: 'kN/m', f: (r) => r.Nxx },
    Nyy: { t: 'Lực dọc màng Nyy (trục 2)', s: 'Nyy', u: 'kN/m', f: (r) => r.Nyy },
    Nxy: { t: 'Lực cắt màng Nxy', s: 'Nxy', u: 'kN/m', f: (r) => r.Nxy },
  };
  const FK: Record<string, string[]> = { bao: ['Ia', 'Ib', 'Ic'], baoE: ['Ea', 'Eb'] };

  function fieldOf(fe: CfeSolveResult, k: string, q: string): Float64Array | null {
    const M = fe.M!;
    const ks = FK[k] || [k];
    const L = (fe.res || []).filter((c) => ks.includes(c.k));
    const fq = FQ[q];
    if (!L.length || !fq) return null;
    const v = new Float64Array(M.EL.length).fill(NaN);
    M.EL.forEach((E, e) => {
      if (!E) return;
      let b: number | null = null;
      L.forEach((c) => {
        const x = fq.f(c.rf![e]!);
        if (b === null || Math.abs(x) > Math.abs(b)) b = x;
      });
      v[e] = b!;
    });
    return v;
  }

  function fieldStat(
    M: CfeModelData,
    v: Float64Array,
    pred?: (E: CfeElMeta) => boolean,
  ): { min: number; max: number; imin: number; imax: number } | null {
    let mn = Infinity;
    let mx = -Infinity;
    let imn = -1;
    let imx = -1;
    M.EL.forEach((E, e) => {
      if (!E || !isFinite(v[e]) || (pred && !pred(E))) return;
      if (v[e] < mn) {
        mn = v[e];
        imn = e;
      }
      if (v[e] > mx) {
        mx = v[e];
        imx = e;
      }
    });
    return imn < 0 ? null : { min: mn, max: mx, imin: imn, imax: imx };
  }

  function elemVals(fe: CfeSolveResult, k: string, e: number): CfeLocalForce {
    const ks = FK[k] || [k];
    const L = (fe.res || []).filter((c) => ks.includes(c.k));
    const o = {} as CfeLocalForce;
    (['Mxx', 'Myy', 'Mxy', 'Qx', 'Qy', 'Nxx', 'Nyy', 'Nxy'] as const).forEach((q) => {
      let b: number | null = null;
      L.forEach((c) => {
        const x = c.rf![e]![q];
        if (b === null || Math.abs(x) > Math.abs(b)) b = x;
      });
      o[q] = b!;
    });
    return o;
  }

  function reactOf(fe: CfeSolveResult, k: string) {
    const ks = FK[k] || [k];
    const L = (fe.res || []).filter((c) => ks.includes(c.k) && c.pr);
    if (!L.length) return null;
    const c = L.reduce((a, b) => (b.pr!.qmax > a.pr!.qmax ? b : a), L[0]);
    return {
      k: c.k,
      nm: c.nm,
      N: c.N,
      H: c.H,
      e: c.e,
      s: c.s,
      Lc: c.Lc,
      x0: c.x0,
      tau: c.tau,
      q1: c.pr!.q1,
      q2: c.pr!.q2,
      qmax: c.pr!.qmax,
      qmin: c.pr!.qmin,
      pr: c.pr!,
    };
  }

  return {
    build,
    solve,
    check,
    run,
    sections,
    handOf,
    checkSection,
    ribProvider,
    KFE,
    avgF,
    rotate,
    stemLine,
    zCols,
    worst,
    ribWeb,
    supports,
    solveAll,
    loadCases,
    stemProfile,
    belowZero,
    fill,
    uniq,
    clamp,
    FQ,
    FK,
    fieldOf,
    fieldStat,
    reactOf,
    elemVals,
  };
})();
export type { EngineGeomData };
