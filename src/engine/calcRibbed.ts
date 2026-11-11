/**
 * Counterfort / ribbed retaining wall continuous slab + tapered T-rib
 * calculation engine (`calcRibRun`, `ribBeam`, `ribTProps`, checks & suggestions)
 * ported faithfully from `11_calc_ribbed.js`.
 */

import {
  CALC,
  type CalcCoreResult,
  type CalcSectionForce,
  type RcLoadCaseInput,
  type RcRunResult,
  type RcSectionInput,
} from './calcCore.ts';
import { dLayers, dRibDiag, geom } from './geom.ts';
import { CALC_DS, calcFindBars, clamp, distr } from './presets.ts';
import { ribCuts } from './rebar.ts';
import type {
  EngineBarDiagLine,
  EngineCalcGeomData,
  EngineCalcInputParams,
  EngineCheckItem,
  EngineGeomData,
  EngineLoadItem,
  EngineProject,
  EngineSuggestItem,
  Point2D,
} from './types.ts';

export type RibFeProvider = (y: number) => {
  Mu: number;
  Ms: number;
  Me: number;
  Vu: number;
  Vs?: number;
  Ve: number;
};

export interface RibCurBar {
  d: number;
  a?: number;
  n?: number;
}

export function ribD_lines(
  P: EngineProject,
  g0: EngineGeomData,
  d: number,
  a: number,
): EngineBarDiagLine[] {
  const rb = P.rb;
  const c = P.cover;
  const L = dLayers(P);
  const xF = g0.t + c + rb.s2.d / 20;
  const P2: EngineProject = Object.assign({}, P, {
    rb: Object.assign({}, rb, { r1: Object.assign({}, rb.r1, { d, a }) }),
  });
  return dRibDiag(P2, g0, xF, g0.B - c, L.ylo + rb.l1.d / 20 + d / 20);
}

export function ribD_r1(P: EngineProject, g0: EngineGeomData, d: number, a: number) {
  const dg = ribD_lines(P, g0, d, a);
  const ng = Math.max(1, dg.length);
  const o = P.rb.r1;
  return {
    d,
    a,
    n: 2,
    ng,
    sp: a,
    la: 15,
    on: o.on !== false,
    cuts: dg.slice(1).map((q) => Math.max(0, q.A[1] - P.tBase)),
  };
}

export function ribRbOf(P: EngineProject) {
  const rb = P.rb;
  if (P.tpl === 'D') {
    return {
      s1: rb.s1,
      s2: rb.s2,
      h1: rb.h1,
      l1: rb.l1,
      b1: rb.b1,
      b2: rb.b2,
      r1: ribD_r1(P, geom(P), rb.r1.d, rb.r1.a || 20),
      r2: rb.r2,
      r3: null,
    };
  }
  if (P.tpl === 'C') {
    return {
      s1: rb.c6,
      s2: rb.c7,
      h1: rb.c5,
      l1: rb.c2,
      b1: rb.c1,
      b2: rb.c1,
      r1: Object.assign({}, rb.c13, { n: rb.c13.n || 2 }),
      r2: rb.c12,
      r3: rb.c11,
    };
  }
  return {
    s1: rb.s1,
    s2: rb.s2,
    h1: rb.h1,
    l1: rb.l1,
    b1: rb.b1,
    b2: rb.b2,
    r1: rb.r1,
    r2: rb.r2,
    r3: rb.r3,
  };
}

export function ribPathsOf(P: EngineProject): Record<string, string | null> {
  if (P.tpl === 'D') {
    return {
      s1: 'rb.s1',
      s2: 'rb.s2',
      h1: 'rb.h1',
      l1: 'rb.l1',
      b1: 'rb.b1',
      b2: 'rb.b2',
      r1: 'rb.r1',
      r2: 'rb.r2',
      r3: null,
    };
  }
  if (P.tpl === 'C') {
    return {
      s1: 'rb.c6',
      s2: 'rb.c7',
      h1: 'rb.c5',
      l1: 'rb.c2',
      b1: 'rb.c1',
      b2: 'rb.c1',
      r1: 'rb.c13',
      r2: 'rb.c12',
      r3: 'rb.c11',
    };
  }
  return {
    s1: 'rb.s1',
    s2: 'rb.s2',
    h1: 'rb.h1',
    l1: 'rb.l1',
    b1: 'rb.b1',
    b2: 'rb.b2',
    r1: 'rb.r1',
    r2: 'rb.r2',
    r3: 'rb.r3',
  };
}

export function ribSolve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((r, i) => r.concat([b[i]]));
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(M[r][i]) > Math.abs(M[p][i])) p = r;
    if (Math.abs(M[p][i]) < 1e-14) throw new Error('Sơ đồ dầm liên tục suy biến');
    [M[i], M[p]] = [M[p], M[i]];
    for (let r = i + 1; r < n; r++) {
      const f = M[r][i] / M[i][i];
      if (f) for (let c = i; c <= n; c++) M[r][c] -= f * M[i][c];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n];
    for (let c = i + 1; c < n; c++) s -= M[i][c] * x[c];
    x[i] = s / M[i][i];
  }
  return x;
}

export interface RibBeamResult {
  nodes: number[];
  sup: number[];
  R: number[];
  Ms: number[];
  Vs: { l: number; r: number }[];
  spans: { a: number; b: number; Mmax: number; xm: number }[];
  Mpos: number;
  Mneg: number;
  Vmax: number;
  Rmax: number;
  samples: Point2D[];
  L: number;
}

export function ribBeam(sup: number[], L: number): RibBeamResult {
  const eps = 1e-6;
  const nodes = [0];
  sup.forEach((s) => {
    if (s - nodes[nodes.length - 1] > eps) nodes.push(s);
  });
  if (L - nodes[nodes.length - 1] > eps) nodes.push(L);
  const nn = nodes.length;
  const nd = 2 * nn;
  const isSup = nodes.map((x) => sup.some((s) => Math.abs(s - x) < eps));
  const K = Array.from({ length: nd }, () => new Array<number>(nd).fill(0));
  const F = new Array<number>(nd).fill(0);
  const ke: { Le: number; c: number; kk: number[][]; fe: number[]; dof: number[] }[] = [];

  for (let e = 0; e < nn - 1; e++) {
    const Le = nodes[e + 1] - nodes[e];
    const c = 1 / (Le * Le * Le);
    const kk = [
      [12, 6 * Le, -12, 6 * Le],
      [6 * Le, 4 * Le * Le, -6 * Le, 2 * Le * Le],
      [-12, -6 * Le, 12, -6 * Le],
      [6 * Le, 2 * Le * Le, -6 * Le, 4 * Le * Le],
    ];
    const fe = [-Le / 2, (-Le * Le) / 12, -Le / 2, (Le * Le) / 12];
    const dof = [2 * e, 2 * e + 1, 2 * e + 2, 2 * e + 3];
    ke.push({ Le, c, kk, fe, dof });
    for (let i = 0; i < 4; i++) {
      F[dof[i]] += fe[i];
      for (let j = 0; j < 4; j++) K[dof[i]][dof[j]] += c * kk[i][j];
    }
  }

  const fixed = new Array<boolean>(nd).fill(false);
  isSup.forEach((s, i) => {
    if (s) fixed[2 * i] = true;
  });
  if (sup.length === 1) fixed[2 * isSup.indexOf(true) + 1] = true;
  const fr: number[] = [];
  for (let i = 0; i < nd; i++) if (!fixed[i]) fr.push(i);
  const u = new Array<number>(nd).fill(0);
  if (fr.length) {
    const x = ribSolve(
      fr.map((i) => fr.map((j) => K[i][j])),
      fr.map((i) => F[i]),
    );
    fr.forEach((d, i) => {
      u[d] = x[i];
    });
  }

  const el = ke.map(({ Le, c, kk, fe, dof }, e) => {
    const ue = dof.map((d) => u[d]);
    const q = kk.map((row, i) => c * row.reduce((s, v, j) => s + v * ue[j], 0) - fe[i]);
    return { a: nodes[e], b: nodes[e + 1], Le, V1: q[0], V2: q[2], M1: q[1], M2: q[3] };
  });
  const Mb = (e: (typeof el)[number], x: number) => -e.M1 + e.V1 * x - (x * x) / 2;
  const R: number[] = [];
  const Ms: number[] = [];
  const Vs: { l: number; r: number }[] = [];
  const pos: number[] = [];
  nodes.forEach((x, i) => {
    if (!isSup[i]) return;
    const L1 = i > 0 ? el[i - 1] : null;
    const R1 = i < nn - 1 ? el[i] : null;
    R.push((L1 ? L1.V2 : 0) + (R1 ? R1.V1 : 0));
    Ms.push(L1 ? Mb(L1, L1.Le) : Mb(R1!, 0));
    Vs.push({ l: L1 ? Math.abs(L1.V1 - L1.Le) : 0, r: R1 ? Math.abs(R1.V1) : 0 });
    pos.push(x);
  });

  let Mpos = 0;
  let Mneg = 0;
  const samples: Point2D[] = [];
  const spans: { a: number; b: number; Mmax: number; xm: number }[] = [];
  el.forEach((e) => {
    let mx = -Infinity;
    let xm = 0;
    const n = 48;
    for (let i = 0; i <= n; i++) {
      const x = (e.Le * i) / n;
      const m = Mb(e, x);
      samples.push([e.a + x, m]);
      if (m > mx) {
        mx = m;
        xm = e.a + x;
      }
      Mneg = Math.max(Mneg, -m);
    }
    Mpos = Math.max(Mpos, mx);
    spans.push({ a: e.a, b: e.b, Mmax: mx, xm });
  });
  const Vmax = Math.max(...Vs.map((v) => Math.max(v.l, v.r)));
  return {
    nodes,
    sup: pos,
    R,
    Ms,
    Vs,
    spans,
    Mpos,
    Mneg,
    Vmax,
    Rmax: Math.max(...R),
    samples,
    L,
  };
}

export type RibTPropsResult = ReturnType<typeof ribTProps>;

export function ribTProps(bf: number, tf: number, bw: number, h: number) {
  tf = Math.min(tf, h);
  const hw = h - tf;
  const Aw = bw * hw;
  const Af = bf * tf;
  const A = Aw + Af;
  const zc = ((Aw * hw) / 2 + Af * (h - tf / 2)) / A;
  const I =
    (bw * hw ** 3) / 12 +
    Aw * (zc - hw / 2) ** 2 +
    (bf * tf ** 3) / 12 +
    Af * (h - tf / 2 - zc) ** 2;
  return { A, zc, I, Sc: I / zc };
}

export const ribMp = (Z: number, a: number, u: number): number =>
  (a * Z * Z * Z) / 6 + (u * Z * Z) / 2;

export const ribVp = (Z: number, a: number, u: number): number => (a * Z * Z) / 2 + u * Z;

export const ribVn = (Z: number, p: (z: number) => number): number => {
  if (Z <= 1e-9) return 0;
  const n = 2 * Math.max(8, Math.ceil(Z * 8));
  const h = Z / n;
  let S = p(0) + p(Z);
  for (let i = 1; i < n; i++) S += p(i * h) * (i % 2 ? 4 : 2);
  return (S * h) / 3;
};

export const ribMn = (Z: number, p: (z: number) => number): number => {
  if (Z <= 1e-9) return 0;
  const n = 2 * Math.max(8, Math.ceil(Z * 8));
  const h = Z / n;
  const f = (z: number) => p(z) * (Z - z);
  let S = f(0) + f(Z);
  for (let i = 1; i < n; i++) S += f(i * h) * (i % 2 ? 4 : 2);
  return (S * h) / 3;
};

export const rcUtil = (rc: RcRunResult): number => {
  const fin = (v: number) => (isFinite(v) ? v : 0);
  return Math.max(
    rc.gM ? fin(1 / rc.gM.rM) : 0,
    rc.gV ? fin(1 / rc.gV.rV) : 0,
    rc.minR ? fin(rc.minR.lim / Math.max(rc.minR.Mr, 1e-9)) : 0,
    rc.cr ? fin(rc.cr.sb / rc.cr.smax) : 0,
  );
};

const ribRange = (n: number) => Array.from({ length: n }, (_, i) => i);

export type CalcRibResult = ReturnType<typeof calcRibRun>;

export function calcRibRun(
  P: EngineProject,
  I: EngineCalcInputParams,
  g: EngineCalcGeomData,
  feProv?: RibFeProvider | null,
) {
  const FEO: { d: RibFeProvider | null } = { d: feProv || null };
  const E = CALC;
  const k = 0.01;
  const g0 = g.g0;
  const RB = ribRbOf(P);
  const tplC = P.tpl === 'C';
  const tplD = P.tpl === 'D';
  const cmm = P.cover * 10;
  const eta = I.eta || 1;
  const rt = P.rib.t * k;
  const Lu = P.Lu * k;
  const ctr = g0.ribs.map((r) => ((r.x0 + r.x1) / 2) * k);
  const nR = ctr.length;
  const S = nR > 1 ? (ctr[nR - 1] - ctr[0]) / (nR - 1) : Lu;
  const T = g0.hyp!.T.map((v) => v * k) as Point2D;
  const Eh = g0.hyp!.E.map((v) => v * k) as Point2D;
  const tri = g0.hyp!.tri.map((q): Point2D => [q[0] * k, q[1] * k]);
  const yR = g0.yR * k;
  const yb = g.yF;
  const yT = g.yT;
  const Lh = Math.hypot(Eh[0] - T[0], Eh[1] - T[1]);
  const tanB = (Eh[0] - T[0]) / (T[1] - Eh[1]);
  const cosB = (T[1] - Eh[1]) / Lh;
  const sinB = (Eh[0] - T[0]) / Lh;
  const cen = E.cent(tri);
  const psi = (nR * rt) / Lu;
  const Wr = I.gc * cen.A * psi;
  const Ws = I.gs * cen.A * psi;
  const extra: EngineLoadItem[] = [
    {
      nm: 'Sườn tăng cường (quy về 1 m dài tường)',
      ty: 'DC',
      Fx: 0,
      Fy: -Wr,
      x: cen.x,
      y: cen.y,
      A: cen.A * psi,
      g: I.gc,
    },
    {
      nm: 'Đất bị sườn chiếm chỗ (trừ khỏi EV)',
      ty: 'EV',
      Fx: 0,
      Fy: Ws,
      x: cen.x,
      y: cen.y,
      A: -cen.A * psi,
      g: I.gs,
    },
  ];
  const rg = {
    n: nR,
    rt,
    Lu,
    ctr,
    S,
    T,
    E: Eh,
    tri,
    yR,
    yb,
    Lh,
    tanB,
    cosB,
    sinB,
    Atri: cen.A,
    cx: cen.x,
    cy: cen.y,
    psi,
    Wr,
    Ws,
    eL: ctr[0],
    eR: Lu - ctr[nR - 1],
    extra,
  };
  const res = E.calc(Object.assign({}, I, { extra }), g);
  const Mat = res.M;
  const Ld = res.Ld;
  const st = res.st;
  const Hs = st.Hs;
  const sumFx = (ty: string) => -st.L.filter((l) => l.ty === ty).reduce((s, l) => s + l.Fx, 0);
  const EH = sumFx('EH');
  const ES = sumFx('ES');
  const LS = sumFx('LSh');
  const FC = E.COMB[1].f;
  const pa = (2 * EH) / (Hs * Hs);
  const pq = ES / Hs;
  const pl = LS / Hs;
  const Wt = res.W;
  const Eq = res.E;
  const GWv = E.GW;
  const FW = FC.WA;
  const Fe = Eq ? E.CBK('Eb', res.CL)!.f : null;
  const Zw = Wt ? Math.max(0, yT - Math.min(Wt.hB, yT)) : Infinity;
  const gpW = Wt ? Math.max(1, I.gsat - GWv) : I.gs;
  const sv = (Z: number) =>
    Wt ? I.gs * Math.min(Z, Zw) + gpW * Math.max(0, Z - Zw) : I.gs * Z;
  const svI = Wt
    ? (I.gs * Math.min(Hs, Zw) ** 2) / 2 +
      (Hs > Zw ? I.gs * Zw * (Hs - Zw) + (gpW * (Hs - Zw) ** 2) / 2 : 0)
    : (I.gs * Hs * Hs) / 2;
  const kEff = svI > 1e-9 ? EH / svI : 0;
  const pe0 = (Z: number) => kEff * sv(Z);
  const pw = (Z: number) =>
    Wt ? Math.max(0, GWv * Math.max(0, Z - Zw) - GWv * Math.max(0, Wt.hF - (yT - Z))) : 0;
  const dPE = Eq ? st.dPE : 0;
  const qE = Eq ? dPE / Hs : 0;
  const pdyn = (Z: number) => qE * (1.6 - (1.2 * Z) / Hs);
  const au = eta * FC.EH * pa;
  const uu = eta * (FC.ES * pq + FC.LSh * pl);
  const as_ = pa;
  const us = pq + pl;
  const pU = (Z: number) => eta * (FC.EH * pe0(Z) + FC.ES * pq + FC.LSh * pl + FW * pw(Z));
  const pS = (Z: number) => pe0(Z) + pq + pl + pw(Z);
  const tsAt0 = (y: number) => g.xb(y) - g.xf(y);
  const pE = Eq
    ? (Z: number) =>
        Fe!.EH * pe0(Z) +
        Fe!.ES * pq +
        Fe!.LSh * pl +
        Fe!.WA * pw(Z) +
        Fe!.EQ * (pdyn(Z) + Eq.kh * I.gc * tsAt0(yT - Z))
    : null;
  const bm = ribBeam(ctr, Lu);
  const rho = bm.Rmax;
  const tsAt = (y: number) => g.xb(y) - g.xf(y);
  const covFr = tplC ? cmm + RB.s2.d : cmm;
  const covBk = tplC ? cmm + RB.s1.d : cmm;
  const covVb = tplC ? cmm : cmm + RB.h1.d;
  const covVf = covVb;
  const NL = 9;
  const lvY = ribRange(NL).map((j) => yb + ((yR - yb) * j) / (NL - 1));

  const stemEval = (h: RibCurBar) => {
    const ha = h.a || 20;
    const rows = lvY.map((y) => {
      const Z = yT - y;
      const ts = tsAt(y);
      const pu = pU(Z);
      const ps = pS(Z);
      const pe = pE ? pE(Z) : 0;
      const dcF = covFr + h.d / 2;
      const dv = 0.9 * (ts - dcF / 1e3);
      const Mpu = bm.Mpos * pu;
      const Mnu = bm.Mneg * pu;
      const Mps = bm.Mpos * ps;
      const Mns = bm.Mneg * ps;
      const Mpe = bm.Mpos * pe;
      const Mne = bm.Mneg * pe;
      const dVu = Math.max(0, bm.Vmax - rt / 2 - dv);
      const Sx: RcSectionInput = {
        b: 1e3,
        h: ts * 1e3,
        f1: E.bars(h.d, ha * 10, covFr),
        f2: E.bars(h.d, ha * 10, covBk),
        st: { s: 1, d: 0, n: 0 },
      };
      const Lc: RcLoadCaseInput[] = [
        { id: 'CĐ I-b (M+)', st: 'CD', M: Mpu, V: pu * dVu, N: 0 },
        { id: 'CĐ I-b (M-)', st: 'CD', M: -Mnu, V: pu * dVu, N: 0 },
        { id: 'SD I (M-)', st: 'SD', M: -Mns, V: ps * dVu, N: 0 },
        { id: 'SD I (M+)', st: 'SD', M: Mps, V: ps * dVu, N: 0 },
      ];
      if (pE) {
        Lc.push(
          { id: 'CĐ ĐB I (M+)', st: 'DB', M: Mpe, V: pe * dVu, N: 0 },
          { id: 'CĐ ĐB I (M-)', st: 'DB', M: -Mne, V: pe * dVu, N: 0 },
        );
      }
      const rc = E.RC.run(Sx, Mat, Lc);
      return {
        y,
        Z,
        ts,
        pu,
        ps,
        pe,
        Mpu,
        Mnu,
        Mps,
        Mns,
        Mpe,
        Mne,
        Vu: pu * dVu,
        dv,
        S: Sx,
        rc,
        util: rcUtil(rc),
        ok: E.rcOK(rc),
      };
    });
    const gov = rows.reduce((a, b) => (b.util > a.util ? b : a));
    return { rows, gov, ok: rows.every((r) => r.ok), util: gov.util };
  };

  const hOvh = yT - yR;
  const shr = (d: number, a: number, b: number, h: number) =>
    E.shrink(I, b, h, E.RC.bar(d) / (a * 10), a * 10);

  const vertEval = (s1: RibCurBar, s2: RibCurBar) => {
    const s1a = s1.a || 20;
    const s2a = s2.a || 20;
    let ov: {
      Z: number;
      ts: number;
      Mu: number;
      Ms: number;
      Vu: number;
      Me: number;
      Ve: number;
      S: RcSectionInput;
      rc: RcRunResult;
      util: number;
      ok: boolean;
    } | null = null;
    if (hOvh > 0.03) {
      const Z = hOvh;
      const ts = tsAt(yR);
      const Mu = ribMn(Z, pU);
      const Ms = ribMn(Z, pS);
      const Vu = ribVn(Z, pU);
      const Vs = ribVn(Z, pS);
      const Me = pE ? ribMn(Z, pE) : 0;
      const Ve = pE ? ribVn(Z, pE) : 0;
      const Sx: RcSectionInput = {
        b: 1e3,
        h: ts * 1e3,
        f1: E.bars(s2.d, s2a * 10, covVf),
        f2: E.bars(s1.d, s1a * 10, covVb),
        st: { s: 1, d: 0, n: 0 },
      };
      const Lc: RcLoadCaseInput[] = [
        { id: 'CĐ I-b', st: 'CD', M: -Mu, V: Vu, N: 0 },
        { id: 'SD I', st: 'SD', M: -Ms, V: Vs, N: 0 },
      ];
      if (pE) Lc.splice(1, 0, { id: 'CĐ ĐB I', st: 'DB', M: -Me, V: Ve, N: 0 });
      const rc = E.RC.run(Sx, Mat, Lc);
      ov = { Z, ts, Mu, Ms, Vu, Me, Ve, S: Sx, rc, util: rcUtil(rc), ok: E.rcOK(rc) };
    }
    const b = Lu * 1e3;
    const h = g.tmean * 1e3;
    const c1 = shr(s1.d, s1a, b, h);
    const c2 = shr(s2.d, s2a, b, h);
    return { ov, c1, c2, okF: !ov || ov.ok, ok: (!ov || ov.ok) && c1.ok && c2.ok };
  };

  const xh = (y: number) => T[0] + (T[1] - y) * tanB;
  const qIr = (z: number) => (Eq ? Eq.kh * I.gc * rt * Math.max(0, xh(yT - z) - g.xb(yT - z)) : 0);

  const ribGrp = (r1: RibCurBar, r2: RibCurBar) => {
    const r1x = tplD ? ribD_r1(P, g0, r1.d, r1.a || 20) : r1;
    const d = r1x.d;
    const nb = Math.max(1, Math.round(r1x.n || 1));
    const ng = tplD ? (r1x as unknown as { ng: number }).ng : clamp(Math.round(RB.r1.ng || 1), 1, 6);
    const sp = tplD ? (r1x as unknown as { sp: number }).sp : RB.r1.sp || 10;
    const la = RB.r1.la || 15;
    const Pv: EngineProject = tplC
      ? Object.assign({}, P, { rb: Object.assign({}, P.rb, { r1: RB.r1 }) })
      : tplD
        ? Object.assign({}, P, { rb: Object.assign({}, P.rb, { r1: r1x }) })
        : P;
    const cuts = ribCuts(Pv, g0, ng);
    const o0 = P.cover + r2.d / 10 + d / 20;
    const gr: { k: number; ok: number; ys: number }[] = [];
    for (let q = 0; q < ng; q++) {
      gr.push({
        k: q,
        ok: (o0 + q * sp) * k,
        ys: (q === 0 ? g0.yR - P.cover : P.tBase + cuts[q - 1]) * k,
      });
    }
    return { d, nb, ng, sp, la, cuts, gr, on: RB.r1.on !== false };
  };

  const secAt = (y: number, w: number[], rr: ReturnType<typeof ribGrp>) => {
    const h = xh(y) - g.xf(y);
    const nq = w.reduce((s, v) => s + v, 0);
    const ts = tsAt(y);
    const dcm = nq > 0 ? w.reduce((s, v, q) => s + (v * rr.gr[q].ok) / cosB, 0) / nq : 0;
    return { y, h, dcm, d: h - dcm, ts, bf: Math.min(S, 12 * ts + rt), n: nq * rr.nb, w };
  };

  const ribEval = (r1: RibCurBar, r2: RibCurBar) => {
    const rr = ribGrp(r1, r2);
    if (!rr.on || !(rr.d > 0) || !(rr.nb > 0)) {
      return { rr, pts: [], base: null, ok: false, util: 99, off: true };
    }
    const r2a = r2.a || 20;
    const sb =
      rr.nb >= 2 ? Math.max(20, (rt * 1e3 - 2 * (cmm + r2.d + rr.d / 2)) / (rr.nb - 1)) : rt * 1e3;
    const ldb =
      Math.max((0.02 * E.RC.bar(rr.d) * I.fy) / Math.sqrt(I.fc), 0.06 * rr.d * I.fy) / 1e3;
    const ldv = ldb * cosB;
    const fr = (q: { k: number; ys: number }, y: number) =>
      q.k === 0 ? 1 : clamp((q.ys - y) / ldv, 0, 1);
    const ys0 = rr.gr[0].ys;
    const N = 48;
    const ycrit: { y: number; grp: number; end: boolean }[] = [];
    for (let i = 1; i < rr.ng; i++) {
      const q = rr.gr[i];
      [q.ys, q.ys - ldv].forEach((yc, j) => {
        if (yc > yb + 0.001 && yc < ys0) {
          ycrit.push({ y: yc + (j ? 0 : 1e-6), grp: i, end: j === 0 });
        }
      });
    }
    const ys: { y: number; grp: number; end?: boolean }[] = ribRange(N + 1)
      .map((j) => ({ y: yb + ((ys0 - yb) * j) / N, grp: -1 }))
      .concat(ycrit);

    const ptEval = (y: number) => {
      const w = rr.gr.map((q) => fr(q, y));
      const sec = secAt(y, w, rr);
      const Z = yT - y;
      let Mu = rho * ribMn(Z, pU);
      let Ms = rho * ribMn(Z, pS);
      let Vu = rho * ribVn(Z, pU);
      let Me = pE ? rho * ribMn(Z, pE) + ribMn(Z, qIr) : 0;
      let Ve = pE ? rho * ribVn(Z, pE) + ribVn(Z, qIr) : 0;
      if (FEO.d) {
        const q = FEO.d(y);
        Mu = q.Mu;
        Ms = q.Ms;
        Vu = q.Vu;
        if (pE) {
          Me = q.Me;
          Ve = q.Ve;
        }
      }
      const Sx: RcSectionInput = {
        b: sec.bf * 1e3,
        h: sec.h * 1e3,
        f1: { n: sec.n * cosB, s: sb, d: rr.d, dc: sec.dcm * 1e3 },
        f2: { n: 0, s: 0, d: 12, dc: 50 },
        st: { s: 1, d: 0, n: 0 },
      };
      const fl = E.RC.flex(Sx, Mat, true);
      const Mr = fl.phi * fl.Mn;
      const jd = fl.ds - fl.a / 2;
      const Vch = jd > 0 ? (Math.abs(Mu) * 1e3 * tanB) / jd : 0;
      const Veff = Math.max(Vu - Vch, 0);
      const Sv: RcSectionInput = Object.assign({}, Sx, {
        b: rt * 1e3,
        st: { s: r2a * 10, d: r2.d, n: 2 },
      });
      const sh = E.RC.shear(Sv, Mat, Math.max(Mu, 1e-6), Veff, 0, 0.9, fl);
      let ee: {
        Me: number;
        Ve: number;
        MrE?: number;
        Veffe?: number;
        she?: ReturnType<typeof E.RC.shear>;
        rMe: number;
        rVe: number;
      };
      if (pE) {
        const Vche = jd > 0 ? (Math.abs(Me) * 1e3 * tanB) / jd : 0;
        const Veffe = Math.max(Ve - Vche, 0);
        const she = E.RC.shear(Sv, Mat, Math.max(Me, 1e-6), Veffe, 0, 1, fl);
        const MrE = fl.Mn;
        ee = {
          Me,
          Ve,
          MrE,
          Veffe,
          she,
          rMe: Me > 1e-9 ? MrE / Me : Infinity,
          rVe: Veffe > 1e-9 ? she.Vr / Veffe : Infinity,
        };
      } else {
        ee = { Me: 0, Ve: 0, rMe: Infinity, rVe: Infinity };
      }
      return Object.assign(
        {
          y,
          Z,
          w,
          sec,
          Mu,
          Ms,
          Vu,
          Sx,
          Sv,
          fl,
          Mr,
          rM: Mu > 1e-9 ? Mr / Mu : Infinity,
          Vch,
          Veff,
          sh,
          rV: Veff > 1e-9 ? sh.Vr / Veff : Infinity,
          tOk: fl.a <= sec.ts * 1e3 + 1e-6,
          grp: -1 as number,
          end: undefined as boolean | undefined,
          util: 0,
        },
        ee,
      );
    };

    const pts = ys.map((o) => ptEval(o.y));
    pts.forEach((p, i) => {
      p.grp = ys[i].grp;
      p.end = ys[i].end;
      p.util = Math.max(
        isFinite(1 / p.rM) ? 1 / p.rM : 0,
        isFinite(1 / p.rV) ? 1 / p.rV : 0,
        isFinite(1 / p.rMe) ? 1 / p.rMe : 0,
        isFinite(1 / p.rVe) ? 1 / p.rVe : 0,
        p.tOk ? 0 : 9.99,
      );
    });
    const base = pts[0];
    const gov = pts.reduce((a, b) => (b.util > a.util ? b : a));
    const tp = ribTProps(base.sec.bf * 1e3, base.sec.ts * 1e3, rt * 1e3, base.sec.h * 1e3);
    const Mcr = (Mat.g3 * Mat.g1 * Mat.fr * tp.Sc) / 1e6;
    const minR = {
      Mcr,
      Mu: base.Mu,
      lim: Math.min(Mcr, 1.33 * base.Mu),
      Mr: base.Mr,
      ok: base.Mr >= Math.min(Mcr, 1.33 * base.Mu),
      Sc: tp.Sc,
    };
    const Sxc = Object.assign({}, base.Sx, {
      f1: Object.assign({}, base.Sx.f1, { dcc: rr.gr[0].ok * 1e3 }),
    });
    const cr = E.RC.crack(Sxc, Mat, base.Ms);
    const flex = pts.every((p) => p.rM >= 1 && p.rMe >= 1 && p.tOk);
    const shear = pts.every((p) => p.rV >= 1 && p.rVe >= 1);
    const util = Math.max(gov.util, minR.lim / Math.max(minR.Mr, 1e-9), cr.sb / cr.smax);
    return {
      rr,
      sb,
      ldb,
      ldv,
      pts,
      base,
      gov,
      ycrit,
      tp,
      minR,
      cr,
      Sxc,
      flex,
      shear,
      ok: flex && shear && minR.ok && cr.ok,
      util,
    };
  };

  const tieNum = (d: number, nl: number) => (0.9 * I.fy * nl * E.RC.bar(d)) / 1e3;
  const tie2Eval = (r2: RibCurBar) => {
    const r2a = r2.a || 20;
    const rows = distr(g0.yR - P.tBase, r2a, P.cover + 3).map((v: number) => (P.tBase + v) * k);
    const y = rows[0];
    const Z = yT - y;
    const pu = pU(Z);
    const T2 = rho * pu * r2a * k;
    const cap = tieNum(r2.d, 2);
    const pe = pE ? pE(Z) : 0;
    const Te = pE ? rho * pe * r2a * k : 0;
    const capE = cap / 0.9;
    return {
      y,
      Z,
      pu,
      pe,
      T: T2,
      Te,
      cap,
      capE,
      a: r2a,
      n: rows.length,
      ok: T2 <= cap + 1e-9 && Te <= capE + 1e-9,
      util: Math.max(T2 / Math.max(cap, 1e-9), Te / Math.max(capE, 1e-9)),
    };
  };

  const NH = 8;
  const xbbS = g.xbb;
  const xend = Math.min(g.B, Eh[0] + 1e-9);
  const heelX = ribRange(NH + 1).map((j) => xbbS + ((g.B - xbbS) * j) / NH);
  const soilAt = (x: number) => {
    const t = g.topF(x);
    const yg = g.yG(x);
    return Wt
      ? I.gs * Math.max(0, yg - Math.max(t, Wt.hB)) + I.gsat * Math.max(0, Math.min(yg, Wt.hB) - t)
      : I.gs * Math.max(0, yg - t);
  };
  const wNet = (c: (typeof res.C)[number], x: number) => {
    const pr = E.press(c.N, c.s, g.B);
    const f = c.f;
    return (
      f('DC') * I.gc * g.topF(x) +
      f('EV') * soilAt(x) +
      (I.q > 1e-9 && x >= Ld.xq ? f('ES') * I.q : 0) +
      (Ld.lsOn && x >= Ld.x0 ? f('LSv') * I.gs * Ld.heq : 0) +
      (I.qL > 1e-9 && x >= Ld.xq ? f('LSv') * I.qL : 0) -
      pr.q(x) -
      (Wt ? f('WA') * Wt.ub(x) : 0)
    );
  };
  const heelLoads = heelX.map((x) => {
    const o: { x: number; t: number; w: Record<string, number> } = { x, t: g.topF(x), w: {} };
    [res.Ia, res.Ib, res.Ic, res.SD].concat(Eq ? [res.Ea!, res.Eb!] : []).forEach((c) => {
      o.w[c.k] = wNet(c, x);
    });
    return o;
  });

  const heelEval = (l1: RibCurBar) => {
    const l1a = l1.a || 20;
    const rows = heelLoads.map((o) => {
      const dvv = 0.9 * (o.t - (cmm + RB.b1.d + l1.d / 2) / 1e3);
      const dV = Math.max(0, bm.Vmax - rt / 2 - dvv);
      let Mbot = 0;
      let Mtop = 0;
      let Vu = 0;
      let wmax = 0;
      [o.w.Ia, o.w.Ib, o.w.Ic].forEach((w) => {
        const wp = Math.max(w, 0);
        const wn = Math.max(-w, 0);
        Mbot = Math.max(Mbot, bm.Mpos * wp, bm.Mneg * wn);
        Mtop = Math.max(Mtop, bm.Mneg * wp, bm.Mpos * wn);
        Vu = Math.max(Vu, Math.abs(w) * dV);
        wmax = Math.max(wmax, wp);
      });
      let MbotE = 0;
      let MtopE = 0;
      let VuE = 0;
      if (Eq) {
        [o.w.Ea, o.w.Eb].forEach((w) => {
          const wp = Math.max(w, 0);
          const wn = Math.max(-w, 0);
          MbotE = Math.max(MbotE, bm.Mpos * wp, bm.Mneg * wn);
          MtopE = Math.max(MtopE, bm.Mneg * wp, bm.Mpos * wn);
          VuE = Math.max(VuE, Math.abs(w) * dV);
          wmax = Math.max(wmax, wp);
        });
      }
      const ws = o.w.SD;
      const wsp = Math.max(ws, 0);
      const wsn = Math.max(-ws, 0);
      const Msb = Math.max(bm.Mpos * wsp, bm.Mneg * wsn);
      const Mst = Math.max(bm.Mneg * wsp, bm.Mpos * wsn);
      const Sx: RcSectionInput = {
        b: 1e3,
        h: o.t * 1e3,
        f1: E.bars(l1.d, l1a * 10, cmm + RB.b1.d),
        f2: E.bars(l1.d, l1a * 10, cmm + RB.b2.d),
        st: { s: 1, d: 0, n: 0 },
      };
      const Lc: RcLoadCaseInput[] = [
        { id: 'CĐ (căng thớ dưới)', st: 'CD', M: Mbot, V: Vu, N: 0 },
        { id: 'CĐ (căng thớ trên)', st: 'CD', M: -Mtop, V: Vu, N: 0 },
        { id: 'SD I (thớ dưới)', st: 'SD', M: Msb, V: Vu, N: 0 },
        { id: 'SD I (thớ trên)', st: 'SD', M: -Mst, V: Vu, N: 0 },
      ];
      if (Eq) {
        Lc.push(
          { id: 'CĐ ĐB I (căng thớ dưới)', st: 'DB', M: MbotE, V: VuE, N: 0 },
          { id: 'CĐ ĐB I (căng thớ trên)', st: 'DB', M: -MtopE, V: VuE, N: 0 },
        );
      }
      const rc = E.RC.run(Sx, Mat, Lc);
      return {
        x: o.x,
        t: o.t,
        w: o.w,
        wmax,
        Mbot,
        Mtop,
        Vu,
        MbotE,
        MtopE,
        VuE,
        Msb,
        Mst,
        S: Sx,
        rc,
        util: rcUtil(rc),
        ok: E.rcOK(rc),
      };
    });
    const gov = rows.reduce((a, b) => (b.util > a.util ? b : a));
    return {
      rows,
      gov,
      ok: rows.every((r) => r.ok),
      util: gov.util,
      wmax: Math.max(...rows.filter((r) => r.x <= xend + 1e-9).map((r) => r.wmax), 0),
    };
  };

  const tie3Eval = (r3: RibCurBar | null, wmax: number) => {
    if (!r3) return { w: wmax, T: 0, cap: 1, a: 0, ok: true, util: 0, na: true };
    const r3a = r3.a || 20;
    const T3 = rho * wmax * r3a * k;
    const cap = tieNum(r3.d, 2);
    return {
      w: wmax,
      T: T3,
      cap,
      a: r3a,
      ok: T3 <= cap + 1e-9,
      util: T3 / Math.max(cap, 1e-9),
    };
  };

  const toeEval = (fb: RibCurBar, ft: RibCurBar) => {
    const Sx: RcSectionInput = Object.assign({}, res.Sf, {
      f1: E.bars(fb.d, (fb.a || 20) * 10, I.covB),
      f2: E.bars(ft.d, (ft.a || 20) * 10, I.covT != null ? I.covT : I.cov),
    });
    const o = res.toe;
    const Lc: RcLoadCaseInput[] = [
      {
        id: o.U === o.Ib ? 'CĐ I-b' : o.U === o.Ia ? 'CĐ I-a' : 'CĐ I-c',
        st: 'CD',
        M: o.U!.M,
        V: o.U!.V,
        N: 0,
      },
      { id: 'SD I', st: 'SD', M: o.SD.M, V: o.SD.V, N: 0 },
    ];
    if (o.UE) {
      Lc.splice(1, 0, {
        id: o.UE === o.Ea ? 'CĐ ĐB I-a' : 'CĐ ĐB I-b',
        st: 'DB',
        M: o.UE.M,
        V: o.UE.V,
        N: 0,
      });
    }
    const rc = E.RC.run(Sx, Mat, Lc);
    return { rc, Sx, ok: E.rcOK(rc), util: rcUtil(rc) };
  };

  const shrinkAll = (
    h1: RibCurBar,
    s1: RibCurBar,
    s2: RibCurBar,
    l1: RibCurBar,
    b2: RibCurBar,
  ) => ({
    h1: shr(h1.d, h1.a || 20, g.Hst * 1e3, g.tmean * 1e3),
    s1: shr(s1.d, s1.a || 20, Lu * 1e3, g.tmean * 1e3),
    s2: shr(s2.d, s2.a || 20, Lu * 1e3, g.tmean * 1e3),
    l1: shr(l1.d, l1.a || 20, g.B * 1e3, I.hm * 1e3),
    b2: shr(b2.d, b2.a || 20, Lu * 1e3, I.hm * 1e3),
  });

  const cur = (o: { d: number; a?: number; n?: number } | null | undefined): RibCurBar | null =>
    o ? { d: o.d, a: o.a, n: o.n } : null;

  const stem = stemEval(cur(RB.h1)!);
  const vert = vertEval(cur(RB.s1)!, cur(RB.s2)!);
  const rib = ribEval(cur(RB.r1)!, cur(RB.r2)!);
  const tie2 = tie2Eval(cur(RB.r2)!);
  const heel = heelEval(cur(RB.l1)!);
  const tie3 = tie3Eval(cur(RB.r3), heel.wmax);
  const toe = toeEval(cur(RB.b1)!, cur(RB.b2)!);
  const shk = shrinkAll(
    cur(RB.h1)!,
    cur(RB.s1)!,
    cur(RB.s2)!,
    cur(RB.l1)!,
    cur(RB.b2)!,
  );
  const shOk = Object.values(shk).every((v) => v.ok);
  const ok: CalcCoreResult['ok'] & { rib: boolean; tie: boolean } = {
    e: res.ok.e,
    sl: res.ok.sl,
    br: res.ok.br,
    an: res.ok.an,
    stem: stem.ok && vert.okF,
    rib: rib.ok,
    tie: tie2.ok && tie3.ok,
    toe: toe.ok,
    heel: heel.ok,
    sh: shOk,
    ifc: res.ok.ifc,
    all: false,
  };
  if (res.ok.pip != null) ok.pip = res.ok.pip;
  // Wait: match 11_calc_ribbed.js#L887-900 exact ok keys (note: rib model checks omit `ifc`, match exactly!):
  const ribOk: {
    e: boolean;
    sl: boolean;
    br: boolean;
    an: boolean;
    stem: boolean;
    rib: boolean;
    tie: boolean;
    toe: boolean;
    heel: boolean;
    sh: boolean;
    pip?: boolean;
    all: boolean;
  } = {
    e: res.ok.e,
    sl: res.ok.sl,
    br: res.ok.br,
    an: res.ok.an,
    stem: stem.ok && vert.okF,
    rib: rib.ok,
    tie: tie2.ok && tie3.ok,
    toe: toe.ok,
    heel: heel.ok,
    sh: shOk,
    all: false,
  };
  if (res.ok.pip != null) ribOk.pip = res.ok.pip;
  ribOk.all = Object.entries(ribOk)
    .filter(([key]) => key !== 'all')
    .every(([, val]) => Boolean(val));
  void ok;

  const X = {
    stemEval,
    vertEval,
    ribEval,
    tie2Eval,
    heelEval,
    tie3Eval,
    toeEval,
    shrinkAll,
    shr,
    heelWmax: heel.wmax,
    cur,
    RB,
    feo: FEO,
  };

  const R = Object.assign({}, res, {
    model: 'rib' as const,
    P,
    ok: ribOk,
    rg,
    bm,
    rho,
    stem,
    vert,
    rib,
    tie2,
    tie3,
    heel,
    toe2: toe,
    shk,
    press: {
      pa,
      pq,
      pl,
      au,
      uu,
      as_,
      us,
      EH,
      ES,
      LS,
      Hs,
      pU,
      pS,
      pE,
      pe0,
      pw,
      pdyn,
      kEff,
      Zw,
      dPE,
      qE,
      qIr,
      FW,
      Fe,
    },
    lvY,
    hOvh,
    RB,
    cov: { covFr, covBk, covVb, covVf },
    geo: { yR, yb, yT, xh, tsAt, secAt },
    X,
    feBasis: (FEO.d ? 'fe' : 'hand') as 'fe' | 'hand',
    checks: [] as EngineCheckItem[],
  });
  R.checks = calcRibChecks(R);
  return R;
}

export interface CalcGlobalChecksInput {
  I: { aOT: boolean; aLr: number; aLc: number };
  C: ReadonlyArray<{
    sd?: boolean;
    an?: { e: number } | null;
    e: number;
    eLim?: number;
    Hd: number;
    sl?: { RR: number } | null;
    sigB?: number;
    br?: { qR: number } | null;
  }>;
  ok: {
    e: boolean;
    sl: boolean;
    br: boolean;
    an: boolean;
    pip?: boolean;
  };
  an?: { dw?: boolean; ldg?: number; ldc?: number } | Record<string, unknown> | null;
  W?: { pip: { FS: number; FSreq: number } } | null;
}

export function calcGlobalChecks(R: CalcGlobalChecksInput): EngineCheckItem[] {
  const I = R.I;
  const S = R.C.filter((c) => !c.sd);
  const mx = (f: (c: (typeof S)[number]) => number) => Math.max(...S.map(f));
  const L: EngineCheckItem[] = [
    {
      id: 'e',
      t: 'Lệch tâm',
      v: mx((c) => (c.an && I.aOT ? Math.min(c.e, c.an.e) : c.e) / c.eLim!),
      ok: R.ok.e,
    },
    { id: 'sl', t: 'Trượt', v: mx((c) => c.Hd / Math.max(c.sl!.RR, 1e-9)), ok: R.ok.sl },
    { id: 'br', t: 'Sức kháng nền', v: mx((c) => c.sigB! / Math.max(c.br!.qR, 1e-9)), ok: R.ok.br },
  ];
  const an = R.an as { dw?: boolean; ldg: number; ldc: number } | null | undefined;
  if (an && !an.dw) {
    L.push({
      id: 'an',
      t: 'Neo vào đá',
      v: Math.max(an.ldg / (I.aLr * 1e3), an.ldc / (I.aLc * 1e3)),
      ok: R.ok.an,
    });
  }
  if (R.W) {
    L.push({
      id: 'pip',
      t: 'Xói ngầm',
      v: isFinite(R.W.pip.FS) && R.W.pip.FS > 0 ? R.W.pip.FSreq / R.W.pip.FS : 0,
      ok: Boolean(R.ok.pip),
    });
  }
  return L;
}

export function calcRibChecks(R: CalcRibResult): EngineCheckItem[] {
  const L = calcGlobalChecks(R);
  const sh = R.shk;
  const fin = (v: number) => (isFinite(v) ? v : 0);
  const shv = Math.max(
    ...Object.values(sh).map((v) => Math.max(v.req / Math.max(v.As, 1e-9), v.s / v.smax)),
  );
  L.push(
    {
      id: 'stem',
      t: 'Bản mặt tường',
      v: Math.max(R.stem.util, R.vert.ov ? R.vert.ov.util : 0),
      ok: R.ok.stem,
    },
    { id: 'rib', t: 'Sườn – thép chủ', v: fin(R.rib.util), ok: R.ok.rib },
    { id: 'tie', t: 'Sườn – thép giằng', v: Math.max(R.tie2.util, R.tie3.util), ok: R.ok.tie },
    { id: 'toe', t: 'Bản đáy – mũi', v: R.toe2.util, ok: R.ok.toe },
    { id: 'heel', t: 'Bản đáy – gót', v: R.heel.util, ok: R.ok.heel },
    { id: 'sh', t: 'Cốt thép co ngót', v: shv, ok: R.ok.sh },
  );
  return L;
}

export function calcSuggestRib(P: EngineProject, R: CalcRibResult): EngineSuggestItem[] {
  const X = R.X;
  const RB = X.RB;
  const paths = ribPathsOf(P);
  const tplC = P.tpl === 'C';
  const tplD = P.tpl === 'D';
  const cur = X.cur;
  const items: EngineSuggestItem[] = [];
  const b = (o: { d: number; a?: number; n?: number } | null | undefined) => cur(o);
  const mk = (
    id: string,
    title: string,
    path: string | null,
    c: RibCurBar,
    ok: boolean,
    sug: EngineSuggestItem['sug'],
    why: string,
  ) =>
    items.push({
      id,
      title,
      path,
      cur: { d: c.d, a: c.a, n: c.n },
      ok,
      sug: ok ? null : sug,
      why: ok ? '' : sug ? '' : why,
    });
  const g = R.g;
  const I = R.I;
  const Lu = R.rg.Lu;
  const shr = X.shr;
  const h1 = b(RB.h1)!;
  const s1 = b(RB.s1)!;
  const s2 = b(RB.s2)!;
  const l1 = b(RB.l1)!;
  const b1 = b(RB.b1)!;
  const b2 = b(RB.b2)!;
  const r1 = b(RB.r1)!;
  const r2 = b(RB.r2)!;
  const r3 = b(RB.r3);

  const shH = (c: RibCurBar) => shr(c.d, c.a || 20, g.Hst * 1e3, g.tmean * 1e3);
  {
    const f = (c: RibCurBar) => X.stemEval(c).ok && shH(c).ok;
    const ok = f(h1);
    mk(
      'h1',
      'Thân tường – thép ngang (uốn giữa các sườn)',
      paths.h1,
      h1,
      ok,
      ok ? null : calcFindBars({ d: h1.d, a: h1.a || 20 }, f),
      'Không đạt dù tăng cốt thép: cần tăng bề dày thân tường hoặc giảm khoảng cách giữa các sườn.',
    );
  }
  {
    const f1 = (c: RibCurBar) => {
      const v = X.vertEval(c, s2);
      return v.okF && v.c1.ok;
    };
    const ok1 = f1(s1);
    const sg1 = ok1 ? null : calcFindBars({ d: s1.d, a: s1.a || 20 }, f1);
    mk(
      's1',
      'Thân tường – thép đứng mặt sau',
      paths.s1,
      s1,
      ok1,
      sg1,
      'Không xác định được phương án.',
    );
    const s1u = sg1 || s1;
    const f2 = (c: RibCurBar) => {
      const v = X.vertEval(s1u, c);
      return v.okF && v.c2.ok;
    };
    const ok2 = f2(s2);
    mk(
      's2',
      'Thân tường – thép đứng mặt trước',
      paths.s2,
      s2,
      ok2,
      ok2 ? null : calcFindBars({ d: s2.d, a: s2.a || 20 }, f2),
      'Không xác định được phương án.',
    );
  }
  {
    const shB = (c: RibCurBar) => shr(c.d, c.a || 20, Lu * 1e3, I.hm * 1e3);
    const fb = (c: RibCurBar) => X.toeEval(c, tplC ? c : b2).ok && (!tplC || shB(c).ok);
    const ok = fb(b1);
    mk(
      'b1',
      tplC ? 'Bản đáy – thép ngang (2 lớp)' : 'Bản đáy – lớp dưới (mũi)',
      paths.b1,
      b1,
      ok,
      ok ? null : calcFindBars({ d: b1.d, a: b1.a || 20 }, fb),
      'Không đạt dù tăng cốt thép: cần tăng bề dày bản đáy.',
    );
    if (!tplC) {
      const f = (c: RibCurBar) => shB(c).ok;
      const ok2 = f(b2);
      mk(
        'b2',
        'Bản đáy – lớp trên (theo phương ngang)',
        paths.b2,
        b2,
        ok2,
        ok2 ? null : calcFindBars({ d: b2.d, a: b2.a || 20 }, f),
        'Không xác định được phương án.',
      );
    }
  }
  {
    const f = (c: RibCurBar) => X.heelEval(c).ok && shr(c.d, c.a || 20, g.B * 1e3, I.hm * 1e3).ok;
    const ok = f(l1);
    mk(
      'l1',
      'Bản đáy – thép dọc (gót, giữa các sườn)',
      paths.l1,
      l1,
      ok,
      ok ? null : calcFindBars({ d: l1.d, a: l1.a || 20 }, f),
      'Không đạt dù tăng cốt thép: cần tăng bề dày bản đáy hoặc giảm khoảng cách giữa các sườn.',
    );
  }

  let r1u: RibCurBar = r1;
  if (tplD) {
    const f = (c: RibCurBar) => {
      const e = X.ribEval(c, r2);
      return !!(e.flex && e.minR && e.minR.ok && e.cr && e.cr.ok);
    };
    const ok = f(r1);
    const sug = ok ? null : calcFindBars({ d: r1.d, a: r1.a || 20 }, f);
    if (sug) r1u = { d: sug.d, a: sug.a, n: 2 };
    mk(
      'r1',
      'Sườn – thép xiên (Φ, khoảng cách các đường)',
      paths.r1,
      r1,
      ok,
      sug,
      'Không đạt dù tăng cốt thép: cần tăng bề dày sườn.',
    );
  } else {
    const f = (c: RibCurBar) => {
      const e = X.ribEval(c, r2);
      return !!(e.flex && e.minR && e.minR.ok && e.cr && e.cr.ok);
    };
    const ok = f(r1);
    let sug: { d: number; n: number } | null = null;
    if (!ok) {
      for (let n = Math.max(1, r1.n || 1); n <= 6 && !sug; n++) {
        for (const d of CALC_DS) {
          if (n === r1.n && d <= r1.d) continue;
          if (f({ d, n })) {
            sug = { d, n };
            break;
          }
        }
      }
    }
    if (sug) r1u = { d: sug.d, a: r1.a, n: sug.n };
    mk(
      'r1',
      'Sườn – thép chủ (Φ, số thanh mỗi nhóm)',
      paths.r1,
      r1,
      ok,
      sug,
      'Không đạt dù tăng cốt thép: cần tăng bề dày sườn hoặc bố trí thêm nhóm thép.',
    );
  }

  {
    const f = (c: RibCurBar) => X.tie2Eval(c).ok && Boolean(X.ribEval(r1u, c).shear);
    const ok = f(r2);
    mk(
      'r2',
      'Sườn – thép ngang (giằng, chịu cắt)',
      paths.r2,
      r2,
      ok,
      ok ? null : calcFindBars({ d: r2.d, a: r2.a || 20 }, f),
      'Không xác định được phương án.',
    );
  }
  if (r3) {
    const f = (c: RibCurBar) => X.tie3Eval(c, X.heelWmax).ok;
    const ok = f(r3);
    mk(
      'r3',
      'Sườn – thép đứng (treo bản đáy)',
      paths.r3,
      r3,
      ok,
      ok ? null : calcFindBars({ d: r3.d, a: r3.a || 20 }, f),
      'Không xác định được phương án.',
    );
  }
  return items;
}

export type { CalcSectionForce };
