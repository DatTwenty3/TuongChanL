/**
 * Core geotechnical & reinforced concrete calculation kernel (`CALC`)
 * matching `09_calc_core.js` formula-for-formula and constant-for-constant.
 */

import type {
  EngineCalcGeomData,
  EngineCalcInputParams,
  EngineLoadItem,
  EngineWaterResult,
  Point2D,
} from './types.ts';
import { WATER } from './water.ts';

export interface RcFaceInput {
  n: number;
  s: number;
  d: number;
  dc: number;
  dcc?: number;
}

export interface RcSectionInput {
  b: number;
  h: number;
  f1: RcFaceInput;
  f2: RcFaceInput;
  st: { s: number; d: number; n: number };
}

export interface RcMaterialInput {
  fc: number;
  fy: number;
  Es: number;
  K1: number;
  wc: number;
  ecl: number;
  etl: number;
  ag: number;
  g1: number;
  g3: number;
  ge: number;
}

export interface RcMaterialProps extends RcMaterialInput {
  Ec: number;
  fr: number;
  b1: number;
  a1: number;
  n: number;
}

export interface RcFlexResult {
  As: number;
  ds: number;
  Asc: number;
  dsc: number;
  c: number;
  a: number;
  fs: number;
  fsc: number;
  Mn: number;
  et: number;
  phi: number;
  type: number;
  ylim: boolean;
}

export interface RcCrackResult {
  As: number;
  de: number;
  rho: number;
  k: number;
  j: number;
  fss0: number;
  fss: number;
  bs: number;
  smax: number;
  fct: number;
  sb: number;
  need: boolean;
  ok: boolean;
}

export interface RcShearResult {
  As: number;
  de: number;
  dv: number;
  Av: number;
  Avmin: number;
  hasMin: boolean;
  es: number;
  sxe: number;
  beta: number;
  th: number;
  Vc: number;
  Vs: number;
  Vlim: number;
  Vn: number;
  Vr: number;
  vu: number;
  smax: number;
  needSt: boolean;
  ok: boolean;
}

export interface RcLoadCaseInput {
  id: string;
  st: string;
  M: number;
  V: number;
  N: number;
}

export interface RcRowResult extends RcLoadCaseInput {
  fl: RcFlexResult;
  phi: number;
  Mr: number;
  rM: number;
  sh: RcShearResult;
  rV: number;
}

export interface RcMinRebarResult {
  Mcr: number;
  Mu: number;
  lim: number;
  Mr: number;
  ok: boolean;
  id: string;
}

export interface RcRunResult {
  rows: RcRowResult[];
  gM: RcRowResult | null;
  gV: RcRowResult | null;
  gS: RcRowResult | null;
  minR: RcMinRebarResult | null;
  cr: RcCrackResult | null;
  Ag: number;
  Ig: number;
  Sg: number;
}

export interface CalcLoadComboDef {
  k: string;
  nm: string;
  f: Record<string, number>;
  mn: Record<string, number>;
  sd?: boolean;
  ev?: boolean;
  noEta?: boolean;
}

export interface CalcSeismicParams {
  A: number;
  km: string;
  kh: number;
  kv: number;
  gq: number;
  phiB: number;
  phiS: number;
  eLimK: number;
}

export interface CalcWedgeResult {
  P: number;
  rho: number | null;
  W: number | undefined;
  C: Point2D | undefined;
  Hp: number;
  L: number;
  F: Point2D;
  dP: Point2D;
  theta: number;
  Ka: number;
}

export interface CalcPressResult {
  q1: number;
  q2: number;
  Lc: number;
  q: (x: number) => number;
  qmax: number;
  qmin: number;
}

export interface CalcAnchorResult {
  As: number;
  Trs: number;
  Trp: number;
  Tr: number;
  ldg: number;
  ldc: number;
  okLg: boolean;
  okLc: boolean;
  rows: { x: number; n: number }[];
  nT: number;
  sum: number;
  tv: number;
  Qn: number;
  Qd: number;
  dw: boolean;
}

export interface CalcComboEval {
  k: string;
  nm: string;
  sd: boolean;
  ev: boolean;
  f: (t: string) => number;
  V: number;
  H: number;
  M: number;
  N: number;
  Hd: number;
  s: number;
  e: number;
  toToe: boolean;
  eLim?: number;
  Bp?: number;
  okE?: boolean;
  okE0?: boolean;
  sigU?: number;
  sigMax?: number;
  sigMin?: number;
  an?: {
    act: { x: number; n: number }[];
    N: number;
    M: number;
    s: number;
    e: number;
    ok: boolean;
    p: CalcPressResult;
  };
  sl?: {
    Rt: number;
    Ra: number;
    RR: number;
    phiT: number;
    dw: boolean;
    ok: boolean;
    ok0: boolean;
  };
  br?: {
    qR: number;
    qn?: number;
    phi0?: number;
    phiE?: number;
    [key: string]: unknown;
  };
  sigB?: number;
  okB?: boolean;
}

export interface CalcSectionForce {
  N: number;
  Q: number;
  M: number;
}

export interface CalcStemSecResult {
  ys: number;
  h: number;
  xc: number;
  L: EngineLoadItem[];
  w: CalcWedgeResult;
  Hs: number;
  heq: number;
  PLS: number;
  Pw: number;
  dPE: number;
  Ib: CalcSectionForce;
  Ia: CalcSectionForce;
  Ic: CalcSectionForce;
  SD: CalcSectionForce;
  Ea?: CalcSectionForce;
  Eb?: CalcSectionForce;
  Sb?: RcSectionInput;
  UE?: CalcSectionForce;
  rc?: RcRunResult;
}

export interface CalcFootSecResult {
  side: number;
  x: number;
  h: number;
  pr: CalcPressResult;
  Qr: number;
  Mr: number;
  Qd: number;
  Md: number;
  V: number;
  M: number;
}

export interface CalcFootGroupResult {
  Ib: CalcFootSecResult;
  Ia: CalcFootSecResult;
  Ic: CalcFootSecResult;
  SD: CalcFootSecResult;
  Ea?: CalcFootSecResult;
  Eb?: CalcFootSecResult;
  UE?: CalcFootSecResult | null;
  U?: CalcFootSecResult;
  rc?: RcRunResult;
}

export interface CalcShrinkResult {
  req: number;
  As: number;
  s: number;
  smax: number;
  ok: boolean;
}

export interface CalcIfaceResult {
  T: { c: number; mu: number; K1: number; K2: number; nm: string };
  Acv: number;
  Avf: number;
  Pc: number;
  Vn1: number;
  Vl1: number;
  Vl2: number;
  Vn: number;
  Vr: number;
  Vu: number;
  Ve: number;
  Avmin: number;
  ok: boolean;
  okMin: boolean;
}

export interface CalcLoadsResult {
  L: (EngineLoadItem & Record<string, unknown>)[];
  w0: CalcWedgeResult;
  wq: CalcWedgeResult | null;
  wL: CalcWedgeResult | null;
  PqL: number;
  heq: number;
  lsOn: boolean;
  PLS: number;
  dv: number;
  xq: number;
  x0: number;
  W: EngineWaterResult | null;
  E: CalcSeismicParams | null;
  eqi: {
    we: CalcWedgeResult;
    dPE: number;
    gd: { W: number; x: number; y: number } | null;
    ge: { W: number; x: number; y: number } | null;
  } | null;
}

export interface CalcCoreResult {
  I: EngineCalcInputParams;
  g: EngineCalcGeomData;
  Ld: CalcLoadsResult;
  C: CalcComboEval[];
  Ia: CalcComboEval;
  Ib: CalcComboEval;
  Ic: CalcComboEval;
  SD: CalcComboEval;
  Ea: CalcComboEval | undefined;
  Eb: CalcComboEval | undefined;
  eLim: number;
  eLimE: number;
  an: CalcAnchorResult | null;
  brm: string;
  DwE: number;
  M: RcMaterialProps;
  st: CalcStemSecResult;
  toe: CalcFootGroupResult;
  heel: CalcFootGroupResult;
  Sf: RcSectionInput;
  ifc: CalcIfaceResult;
  shS: CalcShrinkResult;
  shF: CalcShrinkResult;
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
    pip?: boolean;
    all: boolean;
  };
  W: EngineWaterResult | null;
  E: CalcSeismicParams | null;
  CL: CalcLoadComboDef[];
  ctx: { W: EngineWaterResult | null; E: CalcSeismicParams | null; combs: CalcLoadComboDef[] };
}

export interface CalcContextInput {
  W?: EngineWaterResult | null;
  E?: CalcSeismicParams | null;
  combs?: CalcLoadComboDef[];
}

export const CALC = (() => {
  const rad = (d: number): number => (d * Math.PI) / 180;
  const deg = (r: number): number => (r * 180) / Math.PI;

  const RC = {
    mat(m: RcMaterialInput): RcMaterialProps {
      const fc = m.fc;
      const b1 = Math.min(0.85, Math.max(0.65, 0.85 - (0.05 * (fc - 28)) / 7));
      return {
        ...m,
        Ec: 0.0017 * m.K1 * m.wc * m.wc * Math.pow(fc, 0.33),
        fr: 0.63 * Math.sqrt(fc),
        b1,
        a1: 0.85,
        n: m.Es / (0.0017 * m.K1 * m.wc * m.wc * Math.pow(fc, 0.33)),
      };
    },

    bar(d: number): number {
      return (Math.PI * d * d) / 4;
    },

    flex(S: RcSectionInput, M: RcMaterialProps, pos: boolean): RcFlexResult {
      const T = pos ? S.f1 : S.f2;
      const C = pos ? S.f2 : S.f1;
      const b = S.b;
      const h = S.h;
      const As = T.n * RC.bar(T.d);
      const ds = h - T.dc;
      const Asc = C.n * RC.bar(C.d);
      const dsc = C.dc;
      const fc = M.fc;
      const fy = M.fy;
      const Es = M.Es;
      const ecu = 0.003;

      const F = (c: number) => {
        const a = Math.min(M.b1 * c, h);
        const Cc = M.a1 * fc * a * b;
        const fs = Math.max(-fy, Math.min(fy, (Es * ecu * (ds - c)) / c));
        const fsc = Math.max(-fy, Math.min(fy, (Es * ecu * (c - dsc)) / c));
        return { a, Cc, fs, fsc, R: Cc + Asc * fsc - As * fs };
      };

      let lo = 1e-6;
      let hi = h;
      for (let k = 0; k < 200; k++) {
        const mid = (lo + hi) / 2;
        if (F(mid).R > 0) hi = mid;
        else lo = mid;
      }
      const c = (lo + hi) / 2;
      const r = F(c);
      const Mn = (As * r.fs * (ds - r.a / 2) + Asc * r.fsc * (r.a / 2 - dsc)) / 1e6;
      const et = (ecu * (ds - c)) / c;
      const phi = Math.max(0.75, Math.min(0.9, 0.75 + (0.15 * (et - M.ecl)) / (M.etl - M.ecl)));
      return {
        As,
        ds,
        Asc,
        dsc,
        c,
        a: r.a,
        fs: r.fs,
        fsc: r.fsc,
        Mn,
        et,
        phi,
        type: et >= M.etl ? 3 : et <= M.ecl ? 1 : 2,
        ylim: c / ds <= 0.003 / (0.003 + M.ecl),
      };
    },

    crack(S: RcSectionInput, M: RcMaterialProps, Ms: number): RcCrackResult {
      const pos = Ms >= 0;
      const T = pos ? S.f1 : S.f2;
      const As = T.n * RC.bar(T.d);
      const de = S.h - T.dc;
      const rho = As / (S.b * de);
      const n = M.n;
      const k = Math.sqrt((rho * n) ** 2 + 2 * rho * n) - rho * n;
      const j = 1 - k / 3;
      const fss0 = (Math.abs(Ms) * 1e6) / (As * j * de);
      const fss = Math.min(fss0, 0.6 * M.fy);
      const dcc = T.dcc != null ? T.dcc : T.dc;
      const bs = 1 + dcc / (0.7 * (S.h - dcc));
      const smax = fss > 0 ? (123e3 * M.ge) / (bs * fss) - 2 * dcc : Infinity;
      const Sg = (S.b * S.h * S.h) / 6;
      const fct = (Math.abs(Ms) * 1e6) / Sg;
      return {
        As,
        de,
        rho,
        k,
        j,
        fss0,
        fss,
        bs,
        smax,
        fct,
        sb: T.s,
        need: fct > 0.8 * M.fr,
        ok: T.s <= smax,
      };
    },

    shear(
      S: RcSectionInput,
      M: RcMaterialProps,
      Mu: number,
      Vu: number,
      Nu: number,
      phiV: number,
      fl: RcFlexResult,
    ): RcShearResult {
      const T = Mu >= 0 ? S.f1 : S.f2;
      const As = T.n * RC.bar(T.d);
      const de = S.h - T.dc;
      const b = S.b;
      const h = S.h;
      const fc = M.fc;
      const dv = Math.max(de - fl.a / 2, 0.9 * de, 0.72 * h);
      const Av = S.st.n * RC.bar(S.st.d);
      const s = S.st.s;
      const Avmin = (0.083 * Math.sqrt(fc) * b * s) / M.fy;
      const V = Math.abs(Vu) * 1e3;
      const Mabs = Math.max(Math.abs(Mu) * 1e6, V * dv);
      const N = Nu * 1e3;
      let es = (Mabs / dv + 0.5 * N + V) / (M.Es * As);
      if (es < 0) es = (Mabs / dv + 0.5 * N + V) / (M.Es * As + (M.Ec * b * h) / 2);
      es = Math.max(-4e-4, Math.min(0.006, es));
      const sxe = Math.max(294, Math.min(2e3, (dv * 35) / (M.ag + 16)));
      const hasMin = Av > 0 && Av >= Avmin;
      const beta = (4.8 / (1 + 750 * es)) * (hasMin ? 1 : 1300 / (1e3 + sxe));
      const th = 29 + 3500 * es;
      const Vc = (0.083 * beta * Math.sqrt(fc) * b * dv) / 1e3;
      const Vs = Av > 0 ? (Av * M.fy * dv) / Math.tan((th * Math.PI) / 180) / s / 1e3 : 0;
      const Vlim = (0.25 * fc * b * dv) / 1e3;
      const Vn = Math.min(Vc + Vs, Vlim);
      const Vr = phiV * Vn;
      const vu = V / (phiV * b * dv);
      const smax = vu < 0.125 * fc ? Math.min(0.8 * dv, 600) : Math.min(0.4 * dv, 300);
      return {
        As,
        de,
        dv,
        Av,
        Avmin,
        hasMin,
        es,
        sxe,
        beta,
        th,
        Vc,
        Vs,
        Vlim,
        Vn,
        Vr,
        vu,
        smax,
        needSt: Math.abs(Vu) > 0.5 * phiV * Vc,
        ok: Vr >= Math.abs(Vu),
      };
    },

    run(S: RcSectionInput, M: RcMaterialProps, L: RcLoadCaseInput[]): RcRunResult {
      const rows: RcRowResult[] = L.map((l) => {
        const fl = RC.flex(S, M, l.M >= 0);
        const phi = l.st === 'DB' ? 1 : fl.phi;
        const Mr = phi * fl.Mn;
        const sh = RC.shear(S, M, l.M, l.V, -l.N, l.st === 'DB' ? 1 : 0.9, fl);
        return {
          ...l,
          fl,
          phi,
          Mr,
          rM: Math.abs(l.M) > 1e-9 ? Mr / Math.abs(l.M) : Infinity,
          sh,
          rV: Math.abs(l.V) > 1e-9 ? sh.Vr / Math.abs(l.V) : Infinity,
        };
      });
      const U = rows.filter((r) => r.st !== 'SD');
      const sv = rows.filter((r) => r.st === 'SD');
      const gM = U.reduce<RcRowResult | null>((p, q) => (!p || q.rM < p.rM ? q : p), null);
      const gV = U.reduce<RcRowResult | null>((p, q) => (!p || q.rV < p.rV ? q : p), null);
      const gS = sv.reduce<RcRowResult | null>(
        (p, q) => (!p || Math.abs(q.M) > Math.abs(p.M) ? q : p),
        null,
      );
      const Sg = (S.b * S.h * S.h) / 6;
      const Mcr = (M.g3 * M.g1 * M.fr * Sg) / 1e6;
      const gMc =
        rows
          .filter((r) => r.st === 'CD')
          .reduce<RcRowResult | null>((p, q) => (!p || q.rM < p.rM ? q : p), null) || gM;
      const minR: RcMinRebarResult | null = gMc
        ? {
            Mcr,
            Mu: Math.abs(gMc.M),
            lim: Math.min(Mcr, 1.33 * Math.abs(gMc.M)),
            Mr: gMc.Mr,
            ok: gMc.Mr >= Math.min(Mcr, 1.33 * Math.abs(gMc.M)),
            id: gMc.id,
          }
        : null;
      const cr = gS ? RC.crack(S, M, gS.M) : null;
      return {
        rows,
        gM,
        gV,
        gS,
        minR,
        cr,
        Ag: S.b * S.h,
        Ig: (S.b * S.h ** 3) / 12,
        Sg,
      };
    },
  };

  const area = (P: Point2D[]): number => {
    let a = 0;
    for (let i = 0; i < P.length; i++) {
      const p = P[i];
      const q = P[(i + 1) % P.length];
      a += p[0] * q[1] - q[0] * p[1];
    }
    return a / 2;
  };

  const cent = (P: Point2D[]): { A: number; x: number; y: number } => {
    const A = area(P);
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
  };

  function clipY(P: Point2D[], yc: number, keepAbove: boolean): Point2D[] {
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

  function Nfac(phi: number): { Nc: number; Nq: number; Ng: number } {
    if (phi <= 1e-9) return { Nc: 5.14, Nq: 1, Ng: 0 };
    const t = Math.tan(rad(phi));
    const Nq = Math.exp(Math.PI * t) * Math.tan(rad(45 + phi / 2)) ** 2;
    return { Nc: (Nq - 1) / t, Nq, Ng: 2 * (Nq + 1) * t };
  }

  const HEQ: [number, number, number][] = [
    [1.5, 1.5, 0.6],
    [3, 1.05, 0.6],
    [6, 0.6, 0.6],
  ];

  function heqOf(H: number, d: number): number {
    const col = (h: number, i: number): number => {
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

  function _ground(I: { Hs: number; m: number }, T: Point2D): Point2D[] {
    const pts: Point2D[] = [[T[0], T[1]]];
    if (I.Hs > 1e-9) pts.push([T[0] + I.m * I.Hs, T[1] + I.Hs]);
    return pts;
  }
  void _ground;

  function wedge(
    A: Point2D,
    T: Point2D,
    G: Point2D[],
    gs: number,
    phi: number,
    delta: number,
    q: number,
    x0?: number | null,
    cc?: number,
    op?: { wt?: { yw: number; gp: number }; kh?: number; kv?: number } | null,
  ): CalcWedgeResult {
    if (x0 == null) x0 = T[0];
    cc = cc || 0;
    op = op || {};
    const wt = op.wt;
    const kh = op.kh || 0;
    const kv = op.kv || 0;
    const Hp = T[1] - A[1];
    const L = Math.hypot(T[0] - A[0], Hp);
    const v: Point2D = [(T[0] - A[0]) / L, Hp / L];
    const nw: Point2D = [v[1], -v[0]];
    const dl = rad(delta);
    const ph = rad(phi);
    const dP: Point2D = [
      Math.cos(dl) * nw[0] + Math.sin(dl) * v[0],
      Math.cos(dl) * nw[1] + Math.sin(dl) * v[1],
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

    let best: { P: number; rho: number | null; W?: number; C?: Point2D } = {
      P: -Infinity,
      rho: null,
    };
    for (let rd = phi + 0.05; rd < deg(angAT) - 0.02; rd += 0.05) {
      const r = rad(rd);
      const h = hit(r);
      if (!h) continue;
      const poly: Point2D[] = [A, T];
      for (let k = 1; k <= h.k; k++) poly.push(G[k]);
      poly.push(h.pt);
      let Ws: number;
      if (wt) {
        const up = clipY(poly, wt.yw, true);
        const dn = clipY(poly, wt.yw, false);
        Ws =
          gs * (up.length > 2 ? Math.abs(area(up)) : 0) +
          wt.gp * (dn.length > 2 ? Math.abs(area(dn)) : 0);
      } else {
        Ws = gs * Math.abs(area(poly));
      }
      const Wq = q * Math.max(0, h.pt[0] - Math.max(T[0], x0));
      const W = Ws + Wq;
      const u: Point2D = [Math.cos(r), Math.sin(r)];
      const n: Point2D = [-Math.sin(r), Math.cos(r)];
      const dR: Point2D = [
        Math.cos(ph) * n[0] + Math.sin(ph) * u[0],
        Math.cos(ph) * n[1] + Math.sin(ph) * u[1],
      ];
      const Lf = Math.hypot(h.pt[0] - A[0], h.pt[1] - A[1]);
      const Fx = cc * Lf * u[0] - kh * Ws;
      const Fy = -((1 - kv) * Ws + Wq) + cc * Lf * u[1];
      const det = dP[0] * dR[1] - dP[1] * dR[0];
      const P = (-Fx * dR[1] - -Fy * dR[0]) / det;
      if (P > best.P) best = { P, rho: rd, W, C: h.pt };
    }
    if (best.P < 0) best.P = 0;
    const F: Point2D = [-best.P * dP[0], -best.P * dP[1]];
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

  function coulomb(theta: number, phi: number, delta: number, beta: number): number {
    const t = rad(theta);
    const f = rad(phi);
    const d = rad(delta);
    const b = rad(beta);
    if (phi - beta < 0) return NaN;
    const G =
      (1 + Math.sqrt((Math.sin(f + d) * Math.sin(f - b)) / (Math.sin(t - d) * Math.sin(t + b)))) **
      2;
    return Math.sin(t + f) ** 2 / (G * Math.sin(t) ** 2 * Math.sin(t - d));
  }

  const COMB: CalcLoadComboDef[] = [
    {
      k: 'Ia',
      nm: 'CĐ I-a (tải đứng min, tải ngang max)',
      f: { DC: 0.9, EV: 1, EH: 1.5, ES: 1.5, LSh: 1.75, LSv: 0, WA: 1, EQ: 0 },
      mn: { DC: 1, EV: 1 },
    },
    {
      k: 'Ib',
      nm: 'CĐ I-b (tải trọng max)',
      f: { DC: 1.25, EV: 1.35, EH: 1.5, ES: 1.5, LSh: 1.75, LSv: 1.75, WA: 1, EQ: 0 },
      mn: {},
    },
    {
      k: 'Ic',
      nm: 'CĐ I-c (tải đứng max, áp lực ngang min)',
      f: { DC: 1.25, EV: 1.35, EH: 0.9, ES: 0.75, LSh: 1.75, LSv: 1.75, WA: 1, EQ: 0 },
      mn: { EH: 1, ES: 1 },
    },
    {
      k: 'SD',
      nm: 'SD I',
      f: { DC: 1, EV: 1, EH: 1, ES: 1, LSh: 1, LSv: 1, WA: 1, EQ: 0 },
      mn: {},
      sd: true,
    },
  ];

  const CBK = (k: string, L?: CalcLoadComboDef[]): CalcLoadComboDef | undefined =>
    (L || COMB).find((c) => c.k === k);

  const GW = 9.81;

  function combList(I: { eqOn?: boolean; eqG?: number }): CalcLoadComboDef[] {
    const out = COMB.slice();
    if (I.eqOn) {
      const gq = I.eqG != null ? I.eqG : 0.5;
      out.push(
        {
          k: 'Ea',
          nm: 'CĐ ĐB I-a (động đất, tải đứng min)',
          f: { DC: 0.9, EV: 1, EH: 1.5, ES: 1.5, LSh: gq, LSv: 0, WA: 1, EQ: 1 },
          mn: { DC: 1, EV: 1 },
          ev: true,
          noEta: true,
        },
        {
          k: 'Eb',
          nm: 'CĐ ĐB I-b (động đất, tải đứng max)',
          f: { DC: 1.25, EV: 1.35, EH: 1.5, ES: 1.5, LSh: gq, LSv: gq, WA: 1, EQ: 1 },
          mn: {},
          ev: true,
          noEta: true,
        },
      );
    }
    return out;
  }

  function seismicParams(I: {
    eqA?: number;
    eqKm?: string;
    eqKh?: number;
    eqKv?: number;
    eqG?: number;
  }): CalcSeismicParams {
    const A = I.eqA || 0;
    const km = I.eqKm || 'half';
    const kh = km === 'full' ? A : km === 'tay' ? I.eqKh || 0 : 0.5 * A;
    const kv = I.eqKv || 0;
    const gq = I.eqG != null ? I.eqG : 0.5;
    return {
      A,
      km,
      kh,
      kv,
      gq,
      phiB: 0.8,
      phiS: 1,
      eLimK: 1 / 3 + (0.4 - 1 / 3) * gq,
    };
  }

  function bearing(
    I: { phif: number; cf: number; gf: number; Dw: number; t1: number; hf: number; phib: number },
    _g: unknown,
    Bp: number,
    Hsd: number,
    Vsd: number,
  ) {
    const F = Nfac(I.phif);
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

  function bearingSPT(
    I: { gf: number; t1: number; hf: number; Nspt: number; Dw: number; Ri: number; phibS: number },
    _g: unknown,
    Bp: number,
  ) {
    const Df = I.t1 + I.hf;
    const sv = Math.max(I.gf * Df, 1) / 1e3;
    const CN = Math.min(2, 0.77 * Math.log10(1.92 / sv));
    const Nc = CN * I.Nspt;
    const Dw = I.Dw;
    const Cwq = Dw >= Df ? 1 : Dw <= 0 ? 0.5 : 0.5 + (0.5 * Dw) / Df;
    const Cwg = Dw <= Df ? 0.5 : Dw >= 1.5 * Bp + Df ? 1 : 0.5 + (0.5 * (Dw - Df)) / (1.5 * Bp);
    const qn = 32e-6 * Nc * Bp * 1e3 * (Cwq + (Cwg * Df) / Bp) * I.Ri * 1e3;
    return {
      spt: true,
      Df,
      sv,
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

  const TC_MI: Record<string, number> = { A: 7, B: 10, C: 15, D: 17, E: 25 };

  function bearingRock(I: { rockT: string; RMR: number; qu: number; phibR: number }) {
    const mi = TC_MI[I.rockT] || 10;
    const RMR = Math.max(0, Math.min(100, I.RMR));
    const m = mi * Math.exp((RMR - 100) / 14);
    const s = Math.exp((RMR - 100) / 6);
    const k = Math.sqrt(s) + Math.sqrt(m * Math.sqrt(s) + s);
    const qn = k * I.qu * 1e3;
    return {
      rockM: true,
      qu: I.qu,
      RMR,
      mi,
      m,
      s,
      k,
      qn,
      phib: I.phibR,
      qR: I.phibR * qn,
    };
  }

  const rcOK = (r: RcRunResult): boolean =>
    r.rows.filter((x) => x.st !== 'SD').every((x) => x.rM >= 1 && x.rV >= 1) &&
    (!r.minR || r.minR.ok) &&
    (!r.cr || r.cr.ok);

  function geomI(I: EngineCalcInputParams): EngineCalcGeomData {
    const g = {} as EngineCalcGeomData;
    g.tb = I.t + (I.n1 + I.n2) * I.H;
    g.xfb = I.b1;
    g.xbb = I.b1 + g.tb;
    g.B = g.xbb + I.b4;
    g.yF = I.hm;
    g.yT = I.hm + I.H;
    g.xft = g.xfb + I.n1 * I.H;
    g.xbt = g.xft + I.t;
    g.xf = (y: number) => g.xfb + I.n1 * (y - g.yF);
    g.xb = (y: number) => g.xbb - I.n2 * (y - g.yF);
    g.foot = [
      [0, 0],
      [g.B, 0],
      [g.B, I.hh],
      [g.xbb, I.hm],
      [g.xfb, I.hm],
      [0, I.ht],
    ];
    g.stem = [
      [g.xfb, I.hm],
      [g.xbb, I.hm],
      [g.xbt, g.yT],
      [g.xft, g.yT],
    ];
    g.topF = (x: number) =>
      x <= g.xfb
        ? I.ht + ((I.hm - I.ht) * x) / Math.max(g.xfb, 1e-9)
        : x >= g.xbb
          ? I.hm + ((I.hh - I.hm) * (x - g.xbb)) / Math.max(I.b4, 1e-9)
          : I.hm;
    g.yG = (x: number) =>
      x <= g.xbt
        ? g.yT
        : g.yT + (I.Hs > 1e-9 ? Math.min(I.Hs, (x - g.xbt) / Math.max(I.m, 1e-9)) : 0);
    g.A = [g.B, 0];
    g.T = [g.B, g.yG(g.B)];
    g.Hp = g.T[1];
    g.Gv = [g.T];
    if (I.Hs > 1e-9 && g.xbt + I.m * I.Hs > g.B + 1e-9) {
      g.Gv.push([g.xbt + I.m * I.Hs, g.yT + I.Hs]);
    }
    g.betaV = I.Hs > 1e-9 && g.xbt + I.m * I.Hs > g.B + 1e-9 ? deg(Math.atan(1 / I.m)) : 0;
    const top: Point2D[] = [[g.B, g.T[1]]];
    if (I.Hs > 1e-9 && g.xbt + I.m * I.Hs < g.B - 1e-9) {
      top.push([g.xbt + I.m * I.Hs, g.yT + I.Hs]);
    }
    top.push([g.xbt, g.yT]);
    g.ev = [[g.xbb, I.hm], [g.B, I.hh], ...top];
    g.front = [
      [0, 0],
      [0, I.ht],
      [g.xfb, I.hm],
      [g.xft, g.yT],
    ];
    g.C0 = [g.B / 2, 0];
    g.eps = 0;
    g.Bs = g.B;
    g.Hst = I.H;
    g.tmean = (I.t + g.tb) / 2;
    return g;
  }

  function loads(I: EngineCalcInputParams, g: EngineCalcGeomData, ctx?: CalcContextInput): CalcLoadsResult {
    ctx = ctx || {};
    const Wt = ctx.W || null;
    const Eq = ctx.E || null;
    const L: (EngineLoadItem & Record<string, unknown>)[] = [];
    const add = (
      nm: string,
      ty: string,
      F: Point2D,
      pt: Point2D,
      ex?: Record<string, unknown>,
    ) =>
      L.push(Object.assign({ nm, ty, Fx: F[0], Fy: F[1], x: pt[0], y: pt[1] }, ex || {}));

    const cs = cent(g.stem);
    const cf = cent(g.foot);
    const wo = Wt ? { wt: { yw: Wt.hB, gp: Math.max(1, I.gsat - GW) } } : null;
    add('Tường đứng', 'DC', [0, -I.gc * cs.A], [cs.x, cs.y], { A: cs.A, g: I.gc });
    add('Bản đáy', 'DC', [0, -I.gc * cf.A], [cf.x, cf.y], { A: cf.A, g: I.gc });

    const evUp = Wt ? clipY(g.ev, Wt.hB, true) : null;
    const evDn = Wt ? clipY(g.ev, Wt.hB, false) : null;
    if (Wt && evDn!.length > 2 && Math.abs(area(evDn!)) > 1e-9) {
      if (evUp!.length > 2 && Math.abs(area(evUp!)) > 1e-9) {
        const c = cent(evUp!);
        add('Đất đắp trên gót bản đáy (trên mực nước ngầm)', 'EV', [0, -I.gs * c.A], [c.x, c.y], {
          A: c.A,
          g: I.gs,
        });
      }
      const c = cent(evDn!);
      add(
        'Đất đắp trên gót bản đáy (dưới mực nước ngầm, bão hòa)',
        'EV',
        [0, -I.gsat * c.A],
        [c.x, c.y],
        { A: c.A, g: I.gsat },
      );
    } else {
      const ce = cent(g.ev);
      add('Đất đắp trên gót bản đáy', 'EV', [0, -I.gs * ce.A], [ce.x, ce.y], {
        A: ce.A,
        g: I.gs,
      });
    }

    const dv = I.dvA ? g.betaV : I.dv;
    const G = g.Gv;
    const w0 = wedge(g.A, g.T, G, I.gs, I.phi, dv, 0, null, I.cs, wo);
    const pt = (f: number): Point2D => [g.B, g.Hp * f];
    add('Áp lực đất chủ động', 'EH', w0.F, pt(1 / 3), { P: w0.P });

    const xq = I.Hs > 1e-9 ? g.xbt + I.m * I.Hs : g.xbt;
    let wq: CalcWedgeResult | null = null;
    if (I.q > 1e-9) {
      wq = wedge(g.A, g.T, G, I.gs, I.phi, dv, I.q, Math.max(xq, g.B), I.cs, wo);
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

    let wL: CalcWedgeResult | null = null;
    let PqL = 0;
    if (I.qL > 1e-9) {
      wL = wedge(g.A, g.T, G, I.gs, I.phi, dv, I.qL, Math.max(xq, g.B), I.cs, wo);
      PqL = Math.max(0, wL.P - w0.P);
      add('Hoạt tải phân bố qL - thành phần ngang', 'LSh', [-PqL * w0.dP[0], 0], pt(1 / 2), {
        P: PqL,
        qL: true,
      });
      if (Math.abs(w0.dP[1]) > 1e-9) {
        add(
          'Hoạt tải phân bố qL - thành phần đứng trên mặt phẳng tính áp lực',
          'LSv',
          [0, -PqL * w0.dP[1]],
          pt(1 / 2),
          { P: PqL, qL: true },
        );
      }
      const LqL = Math.max(0, g.B - xq);
      if (LqL > 1e-9) {
        add(
          'Hoạt tải phân bố qL trên gót',
          'LSv',
          [0, -I.qL * LqL],
          [(xq + g.B) / 2, g.yG((xq + g.B) / 2)],
          { Lq: LqL, qL: true },
        );
      }
    }

    const heq = heqOf(g.Hp, I.dT);
    const lsOn = I.LL && I.dT <= g.Hp / 2 + 1e-9;
    const x0 = g.xbt + I.dT;
    let PLS = 0;
    if (lsOn) {
      PLS = Math.max(
        0,
        wedge(g.A, g.T, G, I.gs, I.phi, dv, I.gs * heq, Math.max(x0, g.B), I.cs, wo).P - w0.P,
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

    if (I.extra) I.extra.forEach((e) => L.push(Object.assign({}, e) as EngineLoadItem & Record<string, unknown>));
    if (Wt) Wt.L.forEach((l) => L.push(Object.assign({}, l) as EngineLoadItem & Record<string, unknown>));

    let eqi: CalcLoadsResult['eqi'] = null;
    if (Eq) {
      const we = wedge(
        g.A,
        g.T,
        G,
        I.gs,
        I.phi,
        dv,
        0,
        null,
        I.cs,
        Object.assign({ kh: Eq.kh, kv: Eq.kv }, wo || {}),
      );
      const dPE = Math.max(0, we.P - w0.P);
      add(
        'Gia tăng áp lực đất chủ động do động đất ΔPAE',
        'EQ',
        [-dPE * w0.dP[0], -dPE * w0.dP[1]],
        [g.B, 0.6 * g.Hp],
        { P: dPE, PAE: we.P, rho: we.rho, KAE: (2 * we.P) / (I.gs * g.Hp * g.Hp), dyn: true },
      );
      const grp = (ty: string) => {
        let Ws = 0;
        let mx = 0;
        let my = 0;
        L.forEach((l) => {
          if (l.ty === ty) {
            const w = -l.Fy;
            Ws += w;
            mx += w * l.x;
            my += w * l.y;
          }
        });
        return Ws > 1e-9 ? { W: Ws, x: mx / Ws, y: my / Ws } : null;
      };
      const gd = grp('DC');
      const ge = grp('EV');
      if (gd) {
        add(
          'Lực quán tính của tường (tường đứng, bản đáy' + (I.extra ? ', sườn' : '') + ') = kh.W',
          'EQ',
          [-Eq.kh * gd.W, Eq.kv * gd.W],
          [gd.x, gd.y],
          { W: gd.W, inert: true },
        );
      }
      if (ge) {
        add(
          'Lực quán tính của khối đất trên gót = kh.W',
          'EQ',
          [-Eq.kh * ge.W, Eq.kv * ge.W],
          [ge.x, ge.y],
          { W: ge.W, inert: true },
        );
      }
      eqi = { we, dPE, gd, ge };
    }

    return {
      L,
      w0,
      wq,
      wL,
      PqL,
      heq,
      lsOn,
      PLS,
      dv,
      xq,
      x0,
      W: Wt,
      E: Eq,
      eqi,
    };
  }

  function combine(
    L: EngineLoadItem[],
    g: { C0: Point2D },
    c: CalcLoadComboDef,
    eta: number,
  ): CalcComboEval {
    const f = (t: string) => (c.sd || c.noEta ? 1 : c.mn[t] ? 1 / eta : eta) * c.f[t];
    let Fx = 0;
    let Fy = 0;
    let M = 0;
    L.forEach((l) => {
      const k = f(l.ty);
      const fx = k * l.Fx;
      const fy = k * l.Fy;
      Fx += fx;
      Fy += fy;
      M += (l.x - g.C0[0]) * fy - (l.y - g.C0[1]) * fx;
    });
    const N = -Fy;
    const H = -Fx;
    const s = -M / N;
    return {
      k: c.k,
      nm: c.nm,
      sd: !!c.sd,
      ev: !!c.ev,
      f,
      V: N,
      H,
      M,
      N,
      Hd: H,
      s,
      e: Math.abs(s),
      toToe: s < 0,
    };
  }

  function press(N: number, s: number, B: number): CalcPressResult {
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
    const q = (x: number) =>
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

  const integ = (f: (x: number) => number, a: number, b: number, n?: number): { S: number; Sx: number } => {
    n = n || 200;
    let S = 0;
    let Sx = 0;
    const d = (b - a) / n;
    for (let i = 0; i < n; i++) {
      const x = a + (i + 0.5) * d;
      const v = f(x) * d;
      S += v;
      Sx += v * x;
    }
    return { S, Sx };
  };

  function mat(I: EngineCalcInputParams): RcMaterialProps {
    const fy = I.fy;
    const fu = ({ 300: 450, 400: 570, 500: 650 } as Record<number, number>)[fy] || fy / 0.7;
    const ecl = fy <= 420 ? 0.002 : Math.min(0.004, 0.002 + (0.002 * (fy - 420)) / 270);
    const etl = fy <= 420 ? 0.005 : Math.min(0.008, 0.005 + (0.003 * (fy - 420)) / 270);
    return RC.mat({
      fc: I.fc,
      fy,
      Es: 2e5,
      K1: 1,
      wc: (I.gc / 9.81) * 1e3,
      ecl,
      etl,
      ag: I.ag,
      g1: 1.6,
      g3: fy / fu,
      ge: I.ge,
    });
  }

  const bars = (d: number, s: number, c: number): RcFaceInput => ({
    n: s > 0 ? 1e3 / s : 0,
    s,
    d,
    dc: c + d / 2,
  });

  function stemSec(
    I: EngineCalcInputParams,
    g: EngineCalcGeomData,
    ys: number,
    ctx?: CalcContextInput,
  ): CalcStemSecResult {
    ctx = ctx || {};
    const Wt = ctx.W || null;
    const Eq = ctx.E || null;
    const CL = ctx.combs || COMB;
    const wo = Wt ? { wt: { yw: Wt.hB, gp: Math.max(1, I.gsat - GW) } } : null;
    const top = clipY(g.stem, ys, true);
    const h = g.xb(ys) - g.xf(ys);
    const xc = (g.xf(ys) + g.xb(ys)) / 2;
    const L: (EngineLoadItem & Record<string, unknown>)[] = [];
    const cs = cent(top);
    L.push({ ty: 'DC', Fx: 0, Fy: -I.gc * cs.A, x: cs.x, y: cs.y });
    const A: Point2D = [g.xb(ys), ys];
    const T: Point2D = [g.xbt, g.yT];
    const G: Point2D[] = [T];
    if (I.Hs > 1e-9) G.push([g.xbt + I.m * I.Hs, g.yT + I.Hs]);
    const w = wedge(A, T, G, I.gs, I.phi, I.dw, 0, null, I.cs, wo);
    const Hs = g.yT - ys;
    const pt = (f: number): Point2D => [A[0] + (T[0] - A[0]) * f, ys + Hs * f];
    L.push({
      ty: 'EH',
      Fx: w.F[0],
      Fy: w.F[1],
      x: pt(1 / 3)[0],
      y: pt(1 / 3)[1],
      P: w.P,
    });
    if (I.q > 1e-9) {
      const wq = wedge(A, T, G, I.gs, I.phi, I.dw, I.q, G[G.length - 1][0], I.cs, wo);
      const d = wq.P - w.P;
      L.push({
        ty: 'ES',
        Fx: -d * w.dP[0],
        Fy: -d * w.dP[1],
        x: pt(0.5)[0],
        y: pt(0.5)[1],
        P: d,
      });
    }
    if (I.qL > 1e-9) {
      const wl = wedge(A, T, G, I.gs, I.phi, I.dw, I.qL, G[G.length - 1][0], I.cs, wo);
      const d = Math.max(0, wl.P - w.P);
      L.push({
        ty: 'LSh',
        Fx: -d * w.dP[0],
        Fy: 0,
        x: pt(0.5)[0],
        y: pt(0.5)[1],
        P: d,
        qL: true,
      });
      L.push({
        ty: 'LSv',
        Fx: 0,
        Fy: -d * w.dP[1],
        x: pt(0.5)[0],
        y: pt(0.5)[1],
        P: d,
        qL: true,
      });
    }
    const heq = heqOf(Hs, I.dT);
    let PLS = 0;
    if (I.LL && I.dT <= Hs / 2 + 1e-9) {
      PLS =
        I.Hs > 1e-9
          ? Math.max(
              0,
              wedge(A, T, G, I.gs, I.phi, I.dw, I.gs * heq, g.xbt + I.dT, I.cs, wo).P - w.P,
            )
          : w.Ka * I.gs * heq * Hs;
      L.push({ ty: 'LSh', Fx: -PLS * w.dP[0], Fy: 0, x: pt(0.5)[0], y: pt(0.5)[1], P: PLS });
      L.push({ ty: 'LSv', Fx: 0, Fy: -PLS * w.dP[1], x: pt(0.5)[0], y: pt(0.5)[1], P: PLS });
    }
    let Pw = 0;
    if (Wt) {
      const yb = Math.min(Wt.hB, g.yT);
      const yf = Math.min(Wt.hF, g.yT);
      if (yb > ys + 1e-6) {
        const ff = WATER.faceForce(
          [g.xb(yb), yb],
          [g.xb(ys), ys],
          (x, y) => Wt.u(x, y, 'B'),
          [Wt.hB],
          20,
        );
        if (Math.abs(ff.Fx) + Math.abs(ff.Fy) > 1e-9) {
          const o = WATER.ffLoad('', ff, g.xb(ys), (yb + 2 * ys) / 3);
          L.push({ ty: 'WA', Fx: o.Fx, Fy: o.Fy, x: o.x, y: o.y, sub: 'back' });
          Pw += Math.abs(o.Fx);
        }
      }
      if (yf > ys + 1e-6) {
        const ff = WATER.faceForce(
          [g.xf(ys), ys],
          [g.xf(yf), yf],
          (x, y) => Wt.u(x, y, 'F'),
          [Wt.hF],
          20,
        );
        if (Math.abs(ff.Fx) + Math.abs(ff.Fy) > 1e-9) {
          const o = WATER.ffLoad('', ff, g.xf(ys), (yf + 2 * ys) / 3);
          L.push({ ty: 'WA', Fx: o.Fx, Fy: o.Fy, x: o.x, y: o.y, sub: 'front' });
        }
      }
    }
    let dPE = 0;
    if (Eq) {
      const we = wedge(
        A,
        T,
        G,
        I.gs,
        I.phi,
        I.dw,
        0,
        null,
        I.cs,
        Object.assign({ kh: Eq.kh, kv: Eq.kv }, wo || {}),
      );
      dPE = Math.max(0, we.P - w.P);
      L.push({
        ty: 'EQ',
        Fx: -dPE * w.dP[0],
        Fy: -dPE * w.dP[1],
        x: pt(0.6)[0],
        y: pt(0.6)[1],
        P: dPE,
        dyn: true,
      });
      L.push({
        ty: 'EQ',
        Fx: -Eq.kh * I.gc * cs.A,
        Fy: Eq.kv * I.gc * cs.A,
        x: cs.x,
        y: cs.y,
        inert: true,
      });
    }
    const res = (c: CalcLoadComboDef): CalcSectionForce => {
      const f = (t: string) => (c.sd || c.noEta ? 1 : c.mn[t] ? 1 / I.eta : I.eta) * c.f[t];
      let N = 0;
      let Q = 0;
      let M = 0;
      L.forEach((l) => {
        const k = f(l.ty);
        N -= k * l.Fy;
        Q -= k * l.Fx;
        M += (l.x - xc) * k * l.Fy - (l.y - ys) * k * l.Fx;
      });
      return { N, Q, M };
    };
    const out: CalcStemSecResult = {
      ys,
      h,
      xc,
      L,
      w,
      Hs,
      heq,
      PLS,
      Pw,
      dPE,
      Ib: res(CBK('Ib')!),
      Ia: res(CBK('Ia')!),
      Ic: res(CBK('Ic')!),
      SD: res(CBK('SD')!),
    };
    if (Eq) {
      out.Ea = res(CBK('Ea', CL)!);
      out.Eb = res(CBK('Eb', CL)!);
    }
    return out;
  }

  function footSec(
    I: EngineCalcInputParams,
    g: EngineCalcGeomData,
    Ld: CalcLoadsResult,
    c: CalcComboEval,
    side: number,
    ctx?: CalcContextInput,
  ): CalcFootSecResult {
    const pr = press(c.N, c.s, g.B);
    const f = c.f;
    const gc = I.gc;
    const Wt = ctx && ctx.W;
    const up = Wt ? (X: number) => f('WA') * Wt.ub(X) : () => 0;
    const qq = (X: number) => pr.q(X) + up(X);
    if (side < 0) {
      const x = g.xfb;
      const R = integ(qq, 0, x);
      const Qr = R.S;
      const Mr = x * R.S - R.Sx;
      const wt = (X: number) => 0.9 * gc * g.topF(X);
      const W = integ(wt, 0, x);
      const Qd = W.S;
      const Md = x * W.S - W.Sx;
      return { side, x, h: I.hm, pr, Qr, Mr, Qd, Md, V: Qr - Qd, M: Mr - Md };
    }
    const x = g.xbb;
    const R = integ(qq, x, g.B);
    const Qr = R.S;
    const Mr = R.Sx - x * R.S;
    let Qd = 0;
    let Md = 0;
    const add = (F: number, xx: number) => {
      Qd += F;
      Md += F * (xx - x);
    };
    {
      const W = integ((X: number) => gc * g.topF(X), x, g.B);
      add(f('DC') * W.S, W.S > 0 ? W.Sx / W.S : x);
    }
    Ld.L.forEach((l) => {
      if (l.x < x - 1e-9) return;
      if ((l.nm || '').indexOf('Đất đắp') === 0) add(f('EV') * -l.Fy, l.x);
      else if (l.ty === 'EH' || l.ty === 'ES' || l.ty === 'LSv' || (l.ty === 'EQ' && l.dyn)) {
        if (-l.Fy > 0) add(f(l.ty) * -l.Fy, Math.min(l.x, g.B));
      }
    });
    return { side, x, h: I.hm, pr, Qr, Mr, Qd, Md, V: Qd - Qr, M: -(Md - Mr) };
  }

  function shrink(
    I: { fy: number },
    bmm: number,
    hmm: number,
    As: number,
    s: number,
  ): CalcShrinkResult {
    let req = (0.75 * bmm * hmm) / (2 * (bmm + hmm) * I.fy);
    const lo = 0.233;
    const hi = 1.27;
    req = Math.min(hi, Math.max(lo, req));
    const smax = Math.min(3 * hmm, hmm > 900 ? 300 : 450);
    return { req, As, s, smax, ok: As >= req - 1e-9 && s <= smax + 1e-9 };
  }

  const IFT: Record<string, { c: number; mu: number; K1: number; K2: number; nm: string }> = {
    n: {
      c: 0.52,
      mu: 0.6,
      K1: 0.2,
      K2: 5.5,
      nm: 'bê tông đổ lên mặt bê tông đã đông cứng, sạch, không tạo nhám',
    },
    r: {
      c: 1.66,
      mu: 1,
      K1: 0.25,
      K2: 10.3,
      nm: 'bê tông đổ lên mặt bê tông đã đông cứng, sạch, tạo nhám biên độ 6 mm',
    },
    m: { c: 2.76, mu: 1.4, K1: 0.25, K2: 10.3, nm: 'bê tông đổ liền khối' },
  };

  function iface(
    I: { ift: string; fy: number; fc: number },
    g: { tb: number },
    st: CalcStemSecResult,
    Pc: number,
  ): CalcIfaceResult {
    const T = IFT[I.ift] || IFT.n;
    const Acv = g.tb * 1e6;
    const Avf = st.Sb!.f1.n * RC.bar(st.Sb!.f1.d) + st.Sb!.f2.n * RC.bar(st.Sb!.f2.d);
    const fy = I.fy;
    const Vn1 = (T.c * Acv + T.mu * (Avf * fy + Pc * 1e3)) / 1e3;
    const Vl1 = (T.K1 * I.fc * Acv) / 1e3;
    const Vl2 = (T.K2 * Acv) / 1e3;
    const Vn = Math.min(Vn1, Vl1, Vl2);
    const Vr = 0.9 * Vn;
    const Vu = Math.abs(st.Ib.Q);
    const Avmin = (0.35 * Acv) / fy;
    const Ve = st.Ea ? Math.max(Math.abs(st.Ea.Q), Math.abs(st.Eb!.Q)) : 0;
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
      Ve,
      Avmin,
      ok: Vr >= Vu && Vn >= Ve - 1e-9,
      okMin: Avf >= Avmin,
    };
  }

  function anchor(I: EngineCalcInputParams): CalcAnchorResult {
    const As = RC.bar(I.ad);
    const Trs = (I.phs * As * I.afy) / 1e3;
    const Trp = (I.php * Math.PI * I.aDh * I.atau * I.aLr * 1e3) / 1e3;
    const Tr = Math.min(Trs, Trp);
    const ldb = (fc: number, db: number) =>
      Math.max((0.02 * RC.bar(db) * I.afy) / Math.sqrt(fc), 0.06 * db * I.afy);
    const ldg = ldb(I.agf, I.ad);
    const ldc = ldb(I.fc, I.ad);
    const rows = I.aX.map((x) => ({ x, n: 1 / I.as }));
    const nT = rows.reduce((t, r) => t + r.n, 0);
    const tv = (I.aTv || 0.7) * I.afy;
    const Qn = (nT * As * tv) / 1e3;
    const Qd = I.phs * Qn;
    return {
      As,
      Trs,
      Trp,
      Tr,
      ldg,
      ldc,
      okLg: I.aLr * 1e3 >= ldg,
      okLc: I.aLc * 1e3 >= ldc,
      rows,
      nT,
      sum: nT * Tr,
      tv,
      Qn,
      Qd,
      dw: I.aSl === 'dw',
    };
  }

  function calc(I: EngineCalcInputParams, gIn?: EngineCalcGeomData): CalcCoreResult {
    I = Object.assign({}, I);
    I.dT0 = I.dT;
    if (I.Hs > 1e-9) I.dT = I.m * I.Hs + I.dT0;
    const g = gIn || geomI(I);
    const Wt = I.wOn ? WATER.build(I as Parameters<typeof WATER.build>[0], g as unknown as Parameters<typeof WATER.build>[1]) : null;
    const Eq = I.eqOn ? seismicParams(I) : null;
    const CL = combList(I);
    const ctx: { W: EngineWaterResult | null; E: CalcSeismicParams | null; combs: CalcLoadComboDef[] } = {
      W: Wt,
      E: Eq,
      combs: CL,
    };
    const Ld = loads(I, g, ctx);
    const C = CL.map((c) => combine(Ld.L, g, c, I.eta));
    const Ia = C.find((c) => c.k === 'Ia')!;
    const Ib = C.find((c) => c.k === 'Ib')!;
    const Ic = C.find((c) => c.k === 'Ic')!;
    const SD = C.find((c) => c.k === 'SD')!;
    const Ea = C.find((c) => c.k === 'Ea');
    const Eb = C.find((c) => c.k === 'Eb');
    const CD = C.filter((c) => !c.sd);
    const eLim = I.rock ? 0.45 * g.B : g.B / 3;
    const eLimE = Eq ? (I.rock ? eLim : g.B * Eq.eLimK) : eLim;
    const an = I.rock && I.anc ? anchor(I) : null;

    C.forEach((c) => {
      c.eLim = c.ev ? eLimE : eLim;
      c.Bp = g.B - 2 * c.e;
      c.okE = c.e <= c.eLim + 1e-9;
      c.sigU = c.N / Math.max(c.Bp, 1e-9);
      const p = press(c.N, c.s, g.B);
      c.sigMax = p.qmax;
      c.sigMin = p.qmin;
      if (an && I.aOT && !c.sd) {
        const act = an.rows.filter((r) => (c.toToe ? r.x > g.B / 2 : r.x < g.B / 2));
        let N = c.N;
        let M = c.M;
        act.forEach((r) => {
          const T = r.n * an.Tr;
          N += T;
          M += -(r.x - g.C0[0]) * T;
        });
        const s = -M / N;
        c.an = {
          act,
          N,
          M,
          s,
          e: Math.abs(s),
          ok: Math.abs(s) <= c.eLim + 1e-9,
          p: press(N, s, g.B),
        };
        c.okE0 = c.okE;
        c.okE = c.okE || c.an.ok;
      }
    });

    C.forEach((c) => {
      if (c.sd) return;
      let Rt: number;
      if (!I.rock && I.soil === 'd') {
        const sv = c.N / g.B;
        Rt = Math.min(I.Su, 0.5 * sv) * g.B;
      } else {
        Rt = c.N * Math.tan(rad(I.phif));
      }
      const dwm = an && an.dw;
      const phiT = c.ev ? Eq!.phiS : I.phit;
      const Ra = an ? (dwm ? (c.ev ? an.Qn : an.Qd) : I.amu * an.sum) : 0;
      const RR = dwm ? Ra : phiT * Rt + Ra;
      c.sl = {
        Rt,
        Ra,
        RR,
        phiT,
        dw: !!dwm,
        ok: c.Hd <= RR + 1e-9,
        ok0: c.Hd <= phiT * Rt + 1e-9,
      };
    });

    const DwE = Wt ? Math.max(0, I.ht + I.hf - Wt.hF) : I.Dw;
    const brm = I.rock ? (I.brmR === 'kt' ? 'kt' : I.brmR === 'cp' ? 'cp' : 'rock') : I.brm;
    const bI = {
      phif: I.phif,
      cf: I.cf,
      gf: I.gf,
      Dw: DwE,
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
    const bR = {
      phif: I.phiR,
      cf: I.cR,
      gf: I.gR,
      Dw: Wt ? DwE : 99,
      t1: I.ht + I.hf,
      hf: 0,
      phib: I.phibR,
    };
    C.forEach((c) => {
      if (c.sd) return;
      c.br =
        brm === 'rock'
          ? bearingRock(bI)
          : brm === 'spt'
            ? bearingSPT(bI, g, c.Bp!)
            : brm === 'kt'
              ? { given: true, qR: I.qRu }
              : brm === 'cp'
                ? bearing(bR, g, c.Bp!, SD.Hd, SD.N)
                : bearing(bI, g, c.Bp!, SD.Hd, SD.N);
      if (c.ev && c.br.qn != null) {
        c.br.phi0 = c.br.qR / c.br.qn;
        c.br.phiE = Eq!.phiB;
        c.br.qR = Eq!.phiB * c.br.qn;
      }
      const sm = c.an ? Math.max(c.sigMax!, c.an.p.qmax) : c.sigMax!;
      c.sigB = I.rock ? sm : c.sigU;
      c.okB = c.sigB! <= c.br.qR + 1e-9;
    });

    const M = mat(I);
    const fs = I.cov;
    const Sst: RcSectionInput = {
      b: 1e3,
      h: 0,
      f1: bars(I.sbd, I.sbs, fs),
      f2: bars(I.sfd, I.sfs, fs),
      st: { s: 1, d: 0, n: 0 },
    };
    const st = stemSec(I, g, g.yF, ctx);
    st.Sb = Object.assign({}, Sst, { h: st.h * 1e3 });
    const stL: RcLoadCaseInput[] = [
      { id: 'CĐ I', st: 'CD', M: st.Ib.M, V: st.Ib.Q, N: st.Ib.N },
      { id: 'SD I', st: 'SD', M: st.SD.M, V: st.SD.Q, N: st.SD.N },
    ];
    if (Eq) {
      const U = Math.abs(st.Eb!.M) >= Math.abs(st.Ea!.M) ? st.Eb! : st.Ea!;
      stL.splice(1, 0, {
        id: U === st.Eb ? 'CĐ ĐB I-b' : 'CĐ ĐB I-a',
        st: 'DB',
        M: U.M,
        V: U.Q,
        N: U.N,
      });
      st.UE = U;
    }
    st.rc = RC.run(st.Sb, M, stL);

    const Sf: RcSectionInput = {
      b: 1e3,
      h: I.hm * 1e3,
      f1: bars(I.fbd, I.fbs, I.covB),
      f2: bars(I.ftd, I.fts, I.covT != null ? I.covT : fs),
      st: { s: 1, d: 0, n: 0 },
    };
    const mk = (side: number): CalcFootGroupResult => {
      const o: CalcFootGroupResult = {
        Ib: footSec(I, g, Ld, Ib, side, ctx),
        Ia: footSec(I, g, Ld, Ia, side, ctx),
        Ic: footSec(I, g, Ld, Ic, side, ctx),
        SD: footSec(I, g, Ld, SD, side, ctx),
      };
      if (Eq) {
        o.Ea = footSec(I, g, Ld, Ea!, side, ctx);
        o.Eb = footSec(I, g, Ld, Eb!, side, ctx);
      }
      return o;
    };
    const toe = mk(-1);
    const heel = mk(1);
    const govF = (o: CalcFootGroupResult) =>
      [o.Ib, o.Ia, o.Ic].reduce((p, q) => (Math.abs(q.M) > Math.abs(p.M) ? q : p));
    const cdNm = (o: CalcFootGroupResult, U: CalcFootSecResult) =>
      U === o.Ib ? 'CĐ I-b' : U === o.Ia ? 'CĐ I-a' : 'CĐ I-c';
    const govE = (o: CalcFootGroupResult) =>
      o.Ea ? [o.Ea, o.Eb!].reduce((p, q) => (Math.abs(q.M) > Math.abs(p.M) ? q : p)) : null;
    const runF = (o: CalcFootGroupResult) => {
      const U = govF(o);
      const E = govE(o);
      const L: RcLoadCaseInput[] = [
        { id: cdNm(o, U), st: 'CD', M: U.M, V: U.V, N: 0 },
        { id: 'SD I', st: 'SD', M: o.SD.M, V: o.SD.V, N: 0 },
      ];
      if (E) {
        L.splice(1, 0, {
          id: E === o.Ea ? 'CĐ ĐB I-a' : 'CĐ ĐB I-b',
          st: 'DB',
          M: E.M,
          V: E.V,
          N: 0,
        });
      }
      o.UE = E;
      return RC.run(Sf, M, L);
    };
    toe.rc = runF(toe);
    heel.rc = runF(heel);
    toe.U = govF(toe);
    heel.U = govF(heel);

    const ifc = iface(I, g, st, 0.9 * I.gc * cent(g.stem).A);
    const shS = shrink(I, g.Hst * 1e3, g.tmean * 1e3, RC.bar(I.hd) / I.hs, I.hs);
    const shF = shrink(I, g.B * 1e3, I.hm * 1e3, RC.bar(I.ld) / I.ls, I.ls);
    const ok: CalcCoreResult['ok'] = {
      e: CD.every((c) => !!c.okE),
      sl: CD.every((c) => !!c.sl?.ok),
      br: CD.every((c) => !!c.okB),
      stem: rcOK(st.rc),
      toe: rcOK(toe.rc),
      heel: rcOK(heel.rc),
      ifc: ifc.ok && ifc.okMin,
      sh: shS.ok && shF.ok,
      an: !an || (an.dw && !I.aOT) || (an.okLg && an.okLc),
      all: false,
    };
    if (Wt) ok.pip = !!Wt.pip.ok;
    ok.all = Object.entries(ok)
      .filter(([key]) => key !== 'all')
      .every(([, val]) => Boolean(val));

    return {
      I,
      g,
      Ld,
      C,
      Ia,
      Ib,
      Ic,
      SD,
      Ea,
      Eb,
      eLim,
      eLimE,
      an,
      brm,
      DwE,
      M,
      st,
      toe,
      heel,
      Sf,
      ifc,
      shS,
      shF,
      ok,
      W: Wt,
      E: Eq,
      CL,
      ctx,
    };
  }

  return {
    RC,
    rcOK,
    area,
    cent,
    clipY,
    Nfac,
    heqOf,
    wedge,
    coulomb,
    bearing,
    bearingSPT,
    bearingRock,
    TC_MI,
    COMB,
    CBK,
    combList,
    seismicParams,
    GW,
    press,
    integ,
    mat,
    bars,
    stemSec,
    footSec,
    shrink,
    iface,
    IFT,
    anchor,
    loads,
    combine,
    geomI,
    calc,
    rad,
    deg,
  };
})();
