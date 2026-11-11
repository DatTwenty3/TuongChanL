/**
 * 2D plane-strain T6 Mohr-Coulomb elasto-plastic staged construction + SRM FEM
 * solver (`FEM2D_MAKE` / `FEM2D`), ported faithfully from `14_fem2d_worker.js`.
 *
 * Level 0 module — zero DOM dependencies, safe to execute inside Web Workers,
 * Vite browsers, or Node/Vitest environments.
 */

import type { EngineCalcInputParams, EngineWaterResult, Point2D } from './types.ts';

export interface Fem2dMcMaterial {
  E: number;
  nu: number;
  psi: number;
  gam: number;
  gsat?: number;
  el: boolean;
  c: number;
  phi: number;
  c0: number;
  phi0: number;
  K0: number;
  G: number;
  lam: number;
  D: [number, number, number];
  N: Float64Array;
  K: Float64Array;
  CM: Float64Array;
  A: Float64Array;
  sinP: number;
  cosP: number;
}

export interface Fem2dMeshSpec {
  kx: number[];
  ky: number[];
  polys?: Point2D[][];
  slopes?: [number, number, number, number][];
  classify: (x: number, y: number) => number;
  hx: (x: number) => number;
  hy: (y: number) => number;
}

export interface Fem2dRawMesh {
  nn: number;
  ne: number;
  X: Float64Array;
  Y: Float64Array;
  T: Int32Array;
  mat: Int8Array;
  nx: number;
  ny: number;
  isMid: Uint8Array;
}

export interface Fem2dWaterInput {
  X: number[];
  Y: number[];
  H: number[];
  gw: number;
  xs: number;
  hB: number;
  hF: number;
  hFtop: number;
  Tn: number;
}

export interface Fem2dWaterPackSummary {
  hB: number;
  hF: number;
  hFtop: number;
  Tn: number;
  k?: number[];
  g?: number[];
}

export interface Fem2dRunOptions {
  coarse?: boolean;
  elems?: number;
  lifts?: number;
  waterSteps?: number;
  psi?: number;
  cMin?: number;
  noSrm?: boolean;
  srmEq?: boolean;
  Fmax?: number;
  srmIt?: number;
  E?: { back?: number; found?: number; wall?: number };
  raw?: boolean;
  debug?: boolean;
  win?: [number, number, number, number];
  width?: number;
  water?: Fem2dWaterInput | null;
}

export interface Fem2dPackOptions extends Omit<Fem2dRunOptions, 'water'> {
  water?: Fem2dWaterInput | Fem2dWaterPackSummary | null;
}

export interface Fem2dPackInput {
  I: Partial<EngineCalcInputParams>;
  g: {
    yT: number;
    yF: number;
    B: number;
    xfb: number;
    xft: number;
    xbb: number;
    xbt: number;
    foot: Point2D[];
    stem: Point2D[];
  };
  Ec: number;
  E: { kh: number; kv: number } | null;
  opt: Fem2dPackOptions;
}

export interface Fem2dStageSummary {
  name: string;
  uTop: Point2D;
  uToe: number;
  uHeel: number;
  pBase: [number, number][];
  thrust: number;
  pBack: [number, number][];
  nPlastic: number;
  Vbase: number;
}

export interface Fem2dJobOutput {
  ok: boolean;
  FSsrm: number | null;
  stages: Fem2dStageSummary[];
  time_ms: number;
  notes: string[];
  warn: string[];
  mech: { w: number; h: number; local: boolean } | null;
  umax: { v: number; x: number; y: number };
  mats: {
    E: number;
    nu: number;
    c: number;
    phi: number;
    psi: number;
    gam: number;
    K0: number;
    el: boolean;
  }[];
  model: {
    rock: boolean;
    clay: boolean;
    H: number;
    B: number;
    Df: number;
    Lf: number;
    Lb: number;
    Dd: number;
    kh: number;
    kv: number;
    q: number;
  };
  info: {
    ne: number;
    nn: number;
    neq: number;
    nfac: number;
    hw: number;
    srmTrials: number;
    srmIt: number;
    Dd: number;
    Lf: number;
  };
  nPlastic: number;
  figs: { plastic: string } | null;
  opt: Record<string, unknown>;
  water: {
    hB: number;
    hF: number;
    hFtop: number;
    xs: number;
    nSat: number;
    pmax: number;
    clay: boolean;
  } | null;
  raw?: {
    mesh: { nodes: Point2D[]; tris: number[][]; mat: number[]; nx: number; ny: number };
    u: Point2D[];
    uT: Point2D[];
    plastic: Point2D[];
    uSRM: Point2D[];
    lvl: number[];
    lvg: number[];
  };
}

export interface Fem2dEngineInstance {
  mesh: Fem2dRawMesh;
  mats: Fem2dMcMaterial[];
  nn: number;
  ne: number;
  nd: number;
  T: Int32Array;
  X: Float64Array;
  Y: Float64Array;
  mat: Int8Array;
  dNx: Float64Array;
  dNy: Float64Array;
  wg: Float64Array;
  gx: Float64Array;
  gy: Float64Array;
  fixd: Uint8Array;
  u: Float64Array;
  sig: Float64Array;
  sig0: Float64Array;
  yld: Uint8Array;
  act: Uint8Array;
  u0: Float64Array;
  du: Float64Array;
  eq: Int32Array;
  neq: number;
  fac: { L: Float64Array; ptr: Int32Array; first: Int32Array; n: number } | null;
  nfac: number;
  nPlastic?: number;
  work?: Float64Array;
  ctrl?: Uint8Array;
  pw?: Float64Array;
  pw0?: Float64Array;
  gamG?: Float64Array;
  setActive: (mask: Uint8Array) => void;
  solve: (r: Float64Array, du: Float64Array) => void;
  stress: () => void;
  fint: (sig: Float64Array, F: Float64Array, mask: Uint8Array) => void;
  body: (mask: Uint8Array, F: Float64Array, fxk: number, fyk: number) => void;
  bodyG: (F: Float64Array, fxk: number, fyk: number, arr: Float64Array) => void;
  norm: (v: Float64Array) => number;
  sum1: (v: Float64Array) => number;
  commit: () => void;
  newton: (
    fext: Float64Array,
    o2?: {
      maxIt?: number;
      tol?: number;
      m?: number;
      ls?: boolean;
      ref?: number;
      duTol?: number;
      umax?: number;
    },
  ) => { conv: boolean; it: number; rn: number; div?: boolean };
}

export interface Fem2dRLike {
  I: Partial<EngineCalcInputParams>;
  g: {
    yT: number;
    yF: number;
    B: number;
    xfb: number;
    xft: number;
    xbb: number;
    xbt: number;
    foot: Point2D[];
    stem: Point2D[];
    yG: (x: number) => number;
  };
  M?: { Ec?: number } | null;
  E?: { kh?: number; kv?: number } | null;
  W?: EngineWaterResult | null;
}

export const FEM2D_MAKE = () => {
  const rad = (d: number): number => (d * Math.PI) / 180;

  function inPoly(P: Point2D[], x: number, y: number): boolean {
    let c = false;
    for (let i = 0, n = P.length, j = n - 1; i < n; j = i++) {
      const a = P[i],
        b = P[j];
      if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
  }

  function polyMaxX(P: Point2D[], y: number): number {
    let mx = -Infinity;
    for (let i = 0, n = P.length; i < n; i++) {
      const a = P[i],
        b = P[(i + 1) % n];
      if ((a[1] <= y && b[1] >= y) || (b[1] <= y && a[1] >= y)) {
        const dy = b[1] - a[1],
          x =
            Math.abs(dy) < 1e-12 ? Math.max(a[0], b[0]) : a[0] + ((b[0] - a[0]) * (y - a[1])) / dy;
        if (x > mx) mx = x;
      }
    }
    return mx;
  }

  function mcSet(m: Fem2dMcMaterial, c: number, phiDeg: number): void {
    m.c = c;
    m.phi = phiDeg;
    const sp = Math.sin(rad(phiDeg)),
      cp = Math.cos(rad(phiDeg)),
      ss = Math.sin(rad(m.psi));
    const N = (m.N = new Float64Array(27)),
      Mm = new Float64Array(27),
      K = (m.K = new Float64Array(9)),
      CM = (m.CM = new Float64Array(27)),
      A = (m.A = new Float64Array(81));
    let p = 0;
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++)
        if (i !== j) {
          N[3 * p + i] = 1 - sp;
          N[3 * p + j] = -1 - sp;
          Mm[3 * p + i] = 1 - ss;
          Mm[3 * p + j] = -1 - ss;
          K[p] = 2 * c * cp;
          p++;
        }
    for (let k = 0; k < 3; k++) {
      N[3 * p + k] = -1;
      Mm[3 * p + k] = -1;
      K[p] = 0;
      p++;
    }
    for (p = 0; p < 9; p++) {
      const tr = Mm[3 * p] + Mm[3 * p + 1] + Mm[3 * p + 2];
      for (let k = 0; k < 3; k++) CM[3 * p + k] = m.lam * tr + 2 * m.G * Mm[3 * p + k];
    }
    for (p = 0; p < 9; p++)
      for (let q = 0; q < 9; q++)
        A[9 * p + q] =
          N[3 * p] * CM[3 * q] + N[3 * p + 1] * CM[3 * q + 1] + N[3 * p + 2] * CM[3 * q + 2];
    m.sinP = sp;
    m.cosP = cp;
  }

  function mcMake(
    E: number,
    nu: number,
    c: number,
    phi: number,
    psi: number,
    gam: number,
    el = false,
  ): Fem2dMcMaterial {
    const m = {
      E,
      nu,
      psi: psi || 0,
      gam,
      el: !!el,
      c,
      phi,
      c0: c,
      phi0: phi,
      K0: 0,
      G: E / (2 * (1 + nu)),
      lam: (E * nu) / ((1 + nu) * (1 - 2 * nu)),
      D: [0, 0, 0] as [number, number, number],
      N: new Float64Array(27),
      K: new Float64Array(9),
      CM: new Float64Array(27),
      A: new Float64Array(81),
      sinP: 0,
      cosP: 1,
    };
    m.D = [m.lam + 2 * m.G, m.lam, m.G];
    mcSet(m, c, phi);
    m.c0 = c;
    m.phi0 = phi;
    return m;
  }

  const ST = new Float64Array(4),
    SV = new Float64Array(3),
    FT = new Float64Array(9),
    DL = new Float64Array(3),
    ACT = new Int32Array(3),
    MS = new Float64Array(9),
    RH = new Float64Array(3);

  function mcRet(m: Fem2dMcMaterial, TOL: number): number {
    const N = m.N,
      K = m.K,
      A = m.A,
      CM = m.CM;
    const t0 = SV[0],
      t1 = SV[1],
      t2 = SV[2];
    let fm = -1e300,
      pm = -1;
    for (let p = 0; p < 9; p++) {
      const f = N[3 * p] * t0 + N[3 * p + 1] * t1 + N[3 * p + 2] * t2 - K[p];
      FT[p] = f;
      if (f > fm) {
        fm = f;
        pm = p;
      }
    }
    if (fm <= TOL) return 0;
    let na = 1;
    ACT[0] = pm;
    for (let it = 0; it < 9; it++) {
      for (let a = 0; a < na; a++) {
        RH[a] = FT[ACT[a]];
        for (let b = 0; b < na; b++) MS[3 * a + b] = A[9 * ACT[a] + ACT[b]];
      }
      let sing = false;
      for (let k = 0; k < na && !sing; k++) {
        let pv = k,
          mx = Math.abs(MS[3 * k + k]);
        for (let r = k + 1; r < na; r++) {
          const v = Math.abs(MS[3 * r + k]);
          if (v > mx) {
            mx = v;
            pv = r;
          }
        }
        if (mx < 1e-9 * (m.G + 1)) {
          sing = true;
          break;
        }
        if (pv !== k) {
          for (let c = 0; c < na; c++) {
            const t = MS[3 * k + c];
            MS[3 * k + c] = MS[3 * pv + c];
            MS[3 * pv + c] = t;
          }
          const t = RH[k];
          RH[k] = RH[pv];
          RH[pv] = t;
        }
        for (let r = k + 1; r < na; r++) {
          const fct = MS[3 * r + k] / MS[3 * k + k];
          for (let c = k; c < na; c++) MS[3 * r + c] -= fct * MS[3 * k + c];
          RH[r] -= fct * RH[k];
        }
      }
      if (sing) break;
      for (let k = na - 1; k >= 0; k--) {
        let s = RH[k];
        for (let c = k + 1; c < na; c++) s -= MS[3 * k + c] * DL[c];
        DL[k] = s / MS[3 * k + k];
      }
      let neg = -1,
        mn = -1e-12;
      for (let a = 0; a < na; a++)
        if (DL[a] < mn) {
          mn = DL[a];
          neg = a;
        }
      if (neg >= 0) {
        for (let a = neg; a < na - 1; a++) ACT[a] = ACT[a + 1];
        na--;
        if (na === 0) break;
        continue;
      }
      let s0 = t0,
        s1 = t1,
        s2 = t2;
      for (let a = 0; a < na; a++) {
        const q = 3 * ACT[a];
        s0 -= DL[a] * CM[q];
        s1 -= DL[a] * CM[q + 1];
        s2 -= DL[a] * CM[q + 2];
      }
      let fv = TOL,
        pv = -1;
      for (let p = 0; p < 9; p++) {
        const f = N[3 * p] * s0 + N[3 * p + 1] * s1 + N[3 * p + 2] * s2 - K[p];
        if (f > fv) {
          let in_ = false;
          for (let a = 0; a < na; a++) if (ACT[a] === p) in_ = true;
          if (!in_) {
            fv = f;
            pv = p;
          }
        }
      }
      if (pv < 0) {
        SV[0] = s0;
        SV[1] = s1;
        SV[2] = s2;
        return 1;
      }
      if (na >= 3) break;
      ACT[na++] = pv;
    }
    const pm2 = Math.max(0, (t0 + t1 + t2) / 3);
    SV[0] = SV[1] = SV[2] = pm2;
    return 1;
  }

  function mcUpd(m: Fem2dMcMaterial): number {
    if (m.el) return 0;
    const sxx = ST[0],
      syy = ST[1],
      txy = ST[2],
      szz = ST[3];
    const p = 0.5 * (sxx + syy),
      d = 0.5 * (sxx - syy),
      r = Math.sqrt(d * d + txy * txy);
    const a = -(p + r),
      b = -(p - r),
      c = -szz;
    const mx = Math.max(a, b, c),
      mn = Math.min(a, b, c);
    const TOL = 1e-7 + 1e-9 * Math.abs(mx);
    if (mn >= -TOL && mx - mn - (mx + mn) * m.sinP - 2 * m.c * m.cosP <= TOL) return 0;
    SV[0] = a;
    SV[1] = b;
    SV[2] = c;
    if (!mcRet(m, TOL)) return 0;
    const c2 = r > 1e-12 ? d / r : 1,
      s2 = r > 1e-12 ? txy / r : 0;
    const pp = -0.5 * (SV[0] + SV[1]),
      rr = 0.5 * (SV[1] - SV[0]);
    ST[0] = pp + rr * c2;
    ST[1] = pp - rr * c2;
    ST[2] = rr * s2;
    ST[3] = -SV[2];
    return 1;
  }

  function gradedLines(keys: number[], hf: (v: number) => number): number[] {
    const ks = keys
        .slice()
        .sort((a, b) => a - b)
        .filter((v, i, a) => i === 0 || v - a[i - 1] > 1e-9),
      out = [ks[0]];
    for (let k = 0; k + 1 < ks.length; k++) {
      const a = ks[k],
        b = ks[k + 1],
        ns = 48,
        I = [0];
      for (let i = 0; i < ns; i++) {
        const t0 = a + ((b - a) * i) / ns,
          t1 = a + ((b - a) * (i + 1)) / ns;
        I.push(I[i] + (t1 - t0) * 0.5 * (1 / hf(t0) + 1 / hf(t1)));
      }
      const n = Math.max(1, Math.round(I[ns]));
      for (let j = 1; j <= n; j++) {
        const tg = (I[ns] * j) / n;
        let s = 0;
        while (s < ns - 1 && I[s + 1] < tg) s++;
        const f = (tg - I[s]) / Math.max(I[s + 1] - I[s], 1e-12);
        out.push(j === n ? b : a + ((b - a) * (s + f)) / ns);
      }
    }
    return out;
  }

  function buildMesh(sp: Fem2dMeshSpec): Fem2dRawMesh {
    const X = gradedLines(sp.kx, sp.hx),
      Y = gradedLines(sp.ky, sp.hy),
      nx = X.length - 1,
      ny = Y.length - 1,
      W = ny + 1;
    const GX = new Float64Array((nx + 1) * W),
      GY = new Float64Array((nx + 1) * W),
      EID = new Int32Array((nx + 1) * W).fill(-1);
    for (let i = 0; i <= nx; i++)
      for (let j = 0; j <= ny; j++) {
        GX[i * W + j] = X[i];
        GY[i * W + j] = Y[j];
      }
    const edges: [number, number, number, number][] = [],
      seen: Record<string, number> = {};
    const addE = (ax: number, ay: number, bx: number, by: number) => {
      const dx = bx - ax,
        dy = by - ay;
      if (Math.abs(dx) < 1e-9 || Math.abs(dy) < 1e-9) return;
      const k = [ax, ay, bx, by].map((v) => v.toFixed(6)).join(),
        k2 = [bx, by, ax, ay].map((v) => v.toFixed(6)).join();
      if (seen[k] || seen[k2]) return;
      seen[k] = 1;
      edges.push([ax, ay, bx, by]);
    };
    (sp.polys || []).forEach((P) =>
      P.forEach((a, i) => {
        const b = P[(i + 1) % P.length];
        addE(a[0], a[1], b[0], b[1]);
      }),
    );
    (sp.slopes || []).forEach((e) => addE(e[0], e[1], e[2], e[3]));
    const near = (A: number[], v: number) => {
      let lo = 0,
        hi = A.length - 1;
      while (hi - lo > 1) {
        const m = (lo + hi) >> 1;
        if (A[m] <= v) lo = m;
        else hi = m;
      }
      return Math.abs(A[lo] - v) <= Math.abs(A[hi] - v) ? lo : hi;
    };
    edges.forEach((e, k) => {
      const [ax, ay, bx, by] = e,
        dx = bx - ax,
        dy = by - ay;
      if (Math.abs(dy) >= Math.abs(dx)) {
        for (let j = 0; j <= ny; j++)
          if (Y[j] > Math.min(ay, by) + 1e-9 && Y[j] < Math.max(ay, by) - 1e-9) {
            const xe = ax + (dx * (Y[j] - ay)) / dy,
              i = near(X, xe);
            GX[i * W + j] = xe;
            EID[i * W + j] = k;
          }
      } else {
        for (let i = 0; i <= nx; i++)
          if (X[i] > Math.min(ax, bx) + 1e-9 && X[i] < Math.max(ax, bx) - 1e-9) {
            const ye = ay + (dy * (X[i] - ax)) / dx,
              j = near(Y, ye);
            GY[i * W + j] = ye;
            EID[i * W + j] = k;
          }
      }
    });
    const tri: [number, number, number][] = [],
      mat: number[] = [];
    const cls = (a: number, b: number, c: number) =>
      sp.classify((GX[a] + GX[b] + GX[c]) / 3, (GY[a] + GY[b] + GY[c]) / 3);
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < ny; j++) {
        const n00 = i * W + j,
          n10 = (i + 1) * W + j,
          n11 = (i + 1) * W + j + 1,
          n01 = i * W + j + 1;
        const d1 = EID[n00] >= 0 && EID[n00] === EID[n11],
          d2 = EID[n10] >= 0 && EID[n10] === EID[n01];
        const l1 = Math.hypot(GX[n00] - GX[n11], GY[n00] - GY[n11]),
          l2 = Math.hypot(GX[n10] - GX[n01], GY[n10] - GY[n01]);
        const useD1 = d1 ? true : d2 ? false : l1 <= l2;
        const T: [number, number, number][] = useD1
          ? [
              [n00, n10, n11],
              [n00, n11, n01],
            ]
          : [
              [n00, n10, n01],
              [n10, n11, n01],
            ];
        T.forEach((t) => {
          const id = cls(t[0], t[1], t[2]);
          if (id >= 0) {
            tri.push(t);
            mat.push(id);
          }
        });
      }
    const cid = new Map<number, number>(),
      cx: number[] = [],
      cy: number[] = [],
      ck: number[] = [];
    const getC = (n: number): number => {
      let v = cid.get(n);
      if (v === undefined) {
        v = cx.length;
        cid.set(n, v);
        cx.push(GX[n]);
        cy.push(GY[n]);
        ck.push(2 * Math.floor(n / W));
      }
      return v;
    };
    const mid = new Map<number, number>(),
      mx: number[] = [],
      my: number[] = [];
    const getM = (a: number, b: number): number => {
      const key = a < b ? a * 4194304 + b : b * 4194304 + a;
      let v = mid.get(key);
      if (v === undefined) {
        v = mx.length;
        mid.set(key, v);
        mx.push(0.5 * (cx[a] + cx[b]));
        my.push(0.5 * (cy[a] + cy[b]));
      }
      return v;
    };
    const E: [number, number, number][] = [];
    tri.forEach((t) => {
      let a = getC(t[0]),
        b = getC(t[1]),
        c = getC(t[2]);
      const ar = (cx[b] - cx[a]) * (cy[c] - cy[a]) - (cx[c] - cx[a]) * (cy[b] - cy[a]);
      if (ar < 0) {
        const s = b;
        b = c;
        c = s;
      }
      E.push([a, b, c]);
    });
    const nc = cx.length,
      M = E.map((e): [number, number, number] => [
        getM(e[0], e[1]),
        getM(e[1], e[2]),
        getM(e[2], e[0]),
      ]);
    const nn = nc + mx.length,
      xs = new Float64Array(nn),
      ys = new Float64Array(nn),
      key = new Float64Array(nn);
    for (let i = 0; i < nc; i++) {
      xs[i] = cx[i];
      ys[i] = cy[i];
      key[i] = ck[i];
    }
    const mkey = (a: number, b: number) => (ck[a] + ck[b]) / 2;
    mid.forEach((v, kk) => {
      const b = kk % 4194304,
        a = (kk - b) / 4194304;
      xs[nc + v] = mx[v];
      ys[nc + v] = my[v];
      key[nc + v] = mkey(a, b);
    });
    const ord = new Int32Array(nn);
    for (let i = 0; i < nn; i++) ord[i] = i;
    const ordA = Array.from(ord).sort((p, q) => key[p] - key[q] || ys[p] - ys[q] || xs[p] - xs[q]),
      inv = new Int32Array(nn);
    ordA.forEach((o, n) => {
      inv[o] = n;
    });
    const X2 = new Float64Array(nn),
      Y2 = new Float64Array(nn);
    for (let i = 0; i < nn; i++) {
      X2[inv[i]] = xs[i];
      Y2[inv[i]] = ys[i];
    }
    const ne = E.length,
      T6 = new Int32Array(ne * 6);
    for (let e = 0; e < ne; e++) {
      const a = E[e],
        m = M[e];
      T6[6 * e] = inv[a[0]];
      T6[6 * e + 1] = inv[a[1]];
      T6[6 * e + 2] = inv[a[2]];
      T6[6 * e + 3] = inv[nc + m[0]];
      T6[6 * e + 4] = inv[nc + m[1]];
      T6[6 * e + 5] = inv[nc + m[2]];
    }
    const isMid = new Uint8Array(nn);
    for (let i = nc; i < nn; i++) isMid[inv[i]] = 1;
    return { nn, ne, X: X2, Y: Y2, T: T6, mat: Int8Array.from(mat), nx, ny, isMid };
  }

  function domain(
    R: { g: { yT: number; B: number }; I: { rock?: boolean } },
    Tn?: number,
  ): { Lf: number; Lb: number; Dd0: number; Dd: number } {
    const H = R.g.yT,
      B = R.g.B,
      rock = !!R.I.rock,
      Lf = Math.max(2.5 * H, 12),
      Dd0 = rock ? Math.max(1 * B, 3) : Math.max(1.5 * H, 10);
    return { Lf, Lb: Lf, Dd0, Dd: Math.max(Dd0, Tn || 0) };
  }

  function mkWater(w: Fem2dWaterInput) {
    const X = w.X,
      Y = w.Y,
      nx = X.length - 1,
      ny = Y.length - 1,
      H = w.H,
      gw = w.gw,
      xs = w.xs,
      hB = w.hB,
      hFtop = w.hFtop,
      xc = new Float64Array(nx),
      yc = new Float64Array(ny);
    for (let i = 0; i < nx; i++) xc[i] = 0.5 * (X[i] + X[i + 1]);
    for (let j = 0; j < ny; j++) yc[j] = 0.5 * (Y[j] + Y[j + 1]);
    const idx = (A: number[], n: number, v: number) => {
      let a = 0,
        c = n - 1;
      while (a < c) {
        const m = (a + c + 1) >> 1;
        if (A[m] <= v) a = m;
        else c = m - 1;
      }
      return a;
    };
    const val = (i: number, j: number) => {
      const v = H[i * ny + j];
      return v < 1e8 ? v : NaN;
    };
    const headAt = (x: number, y: number) => {
      x = Math.max(xc[0], Math.min(xc[nx - 1], x));
      y = Math.max(yc[0], Math.min(yc[ny - 1], y));
      let i = idx(X, nx, x),
        j = idx(Y, ny, y);
      if (x < xc[i] && i > 0) i--;
      if (y < yc[j] && j > 0) j--;
      const i1 = Math.min(i + 1, nx - 1),
        j1 = Math.min(j + 1, ny - 1),
        tx = i1 > i ? (x - xc[i]) / (xc[i1] - xc[i]) : 0,
        ty = j1 > j ? (y - yc[j]) / (yc[j1] - yc[j]) : 0;
      let s = 0,
        ws = 0;
      (
        [
          [i, j, (1 - tx) * (1 - ty)],
          [i1, j, tx * (1 - ty)],
          [i, j1, (1 - tx) * ty],
          [i1, j1, tx * ty],
        ] as [number, number, number][]
      ).forEach(([a, c, k]) => {
        const v = val(a, c);
        if (isFinite(v) && k > 0) {
          s += v * k;
          ws += k;
        }
      });
      if (ws > 1e-9) return s / ws;
      for (let rr = 1; rr <= 4; rr++) {
        let s2 = 0,
          n2 = 0;
        for (let a = i - rr; a <= i + rr + 1; a++)
          for (let c = j - rr; c <= j + rr + 1; c++) {
            if (a < 0 || c < 0 || a >= nx || c >= ny) continue;
            const v = val(a, c);
            if (isFinite(v)) {
              s2 += v;
              n2++;
            }
          }
        if (n2) return s2 / n2;
      }
      return NaN;
    };
    const lv = (x: number) => (x < xs ? hFtop : hB);
    const u = (x: number, y: number, cap?: number) => {
      const L = lv(x);
      if (!(y < L)) return 0;
      let h = headAt(x, y);
      if (!isFinite(h)) h = L;
      if (cap != null && h > cap) h = cap;
      return Math.max(0, gw * (h - y));
    };
    return { u, lv, gw, xs, hB, hFtop, headAt };
  }

  function modelFromR(R: Fem2dRLike, opt: Fem2dRunOptions) {
    const I = R.I,
      g = R.g,
      H = g.yT,
      B = g.B,
      rock = !!I.rock,
      clay = !rock && I.soil === 'd';
    const dm = domain({ g, I }, opt.water ? opt.water.Tn : 0),
      Lf = dm.Lf,
      Lb = dm.Lb,
      Dd = dm.Dd;
    const Df = (I.ht || 0) + (I.hf || 0),
      Hs = I.Hs && I.Hs > 1e-9 ? I.Hs : 0,
      ymax = Math.max(g.yT + Hs, Df, g.yT);
    const xc = 0.5 * (g.xfb + g.xbb),
      polys: Point2D[][] = [g.foot, g.stem],
      E = Object.assign({}, opt.E || {});
    const nu = { back: 0.3, found: rock ? 0.25 : 0.3, wall: 0.2 };
    const Eb = E.back != null ? E.back : 3e4,
      Ef = E.found != null ? E.found : rock ? 1e6 : clay ? 2e4 : 5e4,
      Ew = E.wall != null ? E.wall : R.M && R.M.Ec ? R.M.Ec * 1e3 : 3e7;
    const psi = opt.psi || 0;
    const soilF = clay ? { c: I.Su ?? 0, phi: 0 } : { c: I.cf ?? 0, phi: I.phif ?? 0 };
    const mats = [
      mcMake(Ew, nu.wall, 1e9, 0, 0, I.gc ?? 24.5, true),
      mcMake(Eb, nu.back, Math.max(I.cs || 0, opt.cMin || 0), I.phi ?? 30, psi, I.gs ?? 18),
      rock
        ? mcMake(Ef, nu.found, I.cR ?? 0, I.phiR ?? 0, psi, I.gR ?? 25)
        : mcMake(Ef, nu.found, soilF.c, soilF.phi, psi, I.gf ?? 19),
      mcMake(rock ? 5e4 : Ef, 0.3, soilF.c, soilF.phi, psi, I.gf ?? 19),
    ];
    mats.forEach((m, k) => {
      m.K0 = k === 0 ? 0.5 : k === 2 && rock ? 0.5 : 1 - Math.sin(rad(k === 1 ? 30 : m.phi));
    });
    mats[1].gsat = I.gsat || I.gs;
    mats[2].gsat = rock ? I.gR : clay ? I.gf : I.gfs || I.gf;
    mats[3].gsat = clay ? I.gf : I.gfs || I.gf;
    const midAt = (cy: number) => {
      if (cy >= g.yT - 1e-9) return g.xbt;
      let lo = Infinity,
        hi = -Infinity;
      [g.foot, g.stem].forEach((P) => {
        for (let i = 0; i < P.length; i++) {
          const a = P[i],
            b = P[(i + 1) % P.length];
          if ((a[1] <= cy && b[1] > cy) || (b[1] <= cy && a[1] > cy)) {
            const x = a[0] + ((b[0] - a[0]) * (cy - a[1])) / (b[1] - a[1]);
            if (x < lo) lo = x;
            if (x > hi) hi = x;
          }
        }
      });
      return lo <= hi ? 0.5 * (lo + hi) : xc;
    };
    const classify = (cx: number, cy: number) => {
      if (cy >= 0 && (inPoly(g.foot, cx, cy) || inPoly(g.stem, cx, cy))) return 0;
      if (cx < midAt(cy)) return cy > Df + 1e-9 ? -1 : cy < 0 ? 2 : 3;
      return cy > g.yG(cx) + 1e-9 ? -1 : cy < 0 ? 2 : 1;
    };
    const kx = [-Lf, B + Lb, 0, B, g.xfb, g.xft, g.xbb, g.xbt],
      ky = [-Dd, 0, Df, ymax, g.yT, g.yF];
    polys.forEach((P) =>
      P.forEach((p) => {
        kx.push(p[0]);
        ky.push(p[1]);
      }),
    );
    const slopes: [number, number, number, number][] = [];
    if (Hs) {
      kx.push(g.xbt + (I.m || 0) * Hs);
      slopes.push([g.xbt, g.yT, g.xbt + (I.m || 0) * Hs, g.yT + Hs]);
    }
    const xa = -0.4,
      xb = B + 0.4,
      gr = 0.3;
    const mk = (hw: number): Fem2dMeshSpec => ({
      kx,
      ky,
      polys,
      slopes,
      classify,
      hx: (x) => Math.min(2.5, hw + gr * (x < xa ? xa - x : x > xb ? x - xb : 0)),
      hy: (y) => Math.min(3, hw + gr * (y < 0 ? -y : y > g.yT ? y - g.yT : 0)),
    });
    const count = (hw: number) => {
      const sp = mk(hw),
        X = gradedLines(kx, sp.hx),
        Y = gradedLines(ky, sp.hy);
      let n = 0;
      for (let i = 0; i + 1 < X.length; i++)
        for (let j = 0; j + 1 < Y.length; j++)
          if (classify(0.5 * (X[i] + X[i + 1]), 0.5 * (Y[j] + Y[j + 1])) >= 0) n += 2;
      return n;
    };
    const target = opt.elems || (opt.coarse ? 1e3 : 3e3);
    let lo = 0.05,
      hi = 2;
    for (let it = 0; it < 16; it++) {
      const mid = Math.sqrt(lo * hi);
      if (count(mid) > target) lo = mid;
      else hi = mid;
    }
    const hw = hi;
    return {
      I,
      g,
      R,
      mats,
      spec: mk(hw),
      hw,
      B,
      H,
      Df,
      Lf,
      Lb,
      Dd,
      xc,
      ymax,
      rock,
      clay,
      E: R.E || null,
      polys,
    };
  }

  const GPL = [
    [1 / 6, 1 / 6, 2 / 3],
    [1 / 6, 2 / 3, 1 / 6],
    [2 / 3, 1 / 6, 1 / 6],
  ];
  const NGP = GPL.map((L) => [
    L[0] * (2 * L[0] - 1),
    L[1] * (2 * L[1] - 1),
    L[2] * (2 * L[2] - 1),
    4 * L[0] * L[1],
    4 * L[1] * L[2],
    4 * L[2] * L[0],
  ]);

  function Engine(mesh: Fem2dRawMesh, mats: Fem2dMcMaterial[], _o?: unknown): Fem2dEngineInstance {
    const nn = mesh.nn,
      ne = mesh.ne,
      T = mesh.T,
      X = mesh.X,
      Y = mesh.Y,
      mat = mesh.mat,
      nd = 2 * nn;
    const dNx = new Float64Array(ne * 18),
      dNy = new Float64Array(ne * 18),
      wg = new Float64Array(ne * 3),
      gx = new Float64Array(ne * 3),
      gy = new Float64Array(ne * 3);
    for (let e = 0; e < ne; e++) {
      const n1 = T[6 * e],
        n2 = T[6 * e + 1],
        n3 = T[6 * e + 2];
      const x1 = X[n1],
        x2 = X[n2],
        x3 = X[n3],
        y1 = Y[n1],
        y2 = Y[n2],
        y3 = Y[n3],
        A2 = (x2 - x1) * (y3 - y1) - (x3 - x1) * (y2 - y1);
      const b = [y2 - y3, y3 - y1, y1 - y2],
        c = [x3 - x2, x1 - x3, x2 - x1];
      for (let g = 0; g < 3; g++) {
        const L = GPL[g],
          d = [
            [4 * L[0] - 1, 0, 0],
            [0, 4 * L[1] - 1, 0],
            [0, 0, 4 * L[2] - 1],
            [4 * L[1], 4 * L[0], 0],
            [0, 4 * L[2], 4 * L[1]],
            [4 * L[2], 0, 4 * L[0]],
          ];
        for (let a = 0; a < 6; a++) {
          dNx[e * 18 + g * 6 + a] = (d[a][0] * b[0] + d[a][1] * b[1] + d[a][2] * b[2]) / A2;
          dNy[e * 18 + g * 6 + a] = (d[a][0] * c[0] + d[a][1] * c[1] + d[a][2] * c[2]) / A2;
        }
        wg[3 * e + g] = A2 / 6;
        gx[3 * e + g] = L[0] * x1 + L[1] * x2 + L[2] * x3;
        gy[3 * e + g] = L[0] * y1 + L[1] * y2 + L[2] * y3;
      }
    }
    let xmin = Infinity,
      xmax = -Infinity,
      ymin = Infinity;
    for (let i = 0; i < nn; i++) {
      if (X[i] < xmin) xmin = X[i];
      if (X[i] > xmax) xmax = X[i];
      if (Y[i] < ymin) ymin = Y[i];
    }
    const fixd = new Uint8Array(nd);
    for (let i = 0; i < nn; i++) {
      if (Math.abs(X[i] - xmin) < 1e-7 || Math.abs(X[i] - xmax) < 1e-7) fixd[2 * i] = 1;
      if (Math.abs(Y[i] - ymin) < 1e-7) fixd[2 * i] = fixd[2 * i + 1] = 1;
    }
    const S: Fem2dEngineInstance = {
      mesh,
      mats,
      nn,
      ne,
      nd,
      T,
      X,
      Y,
      mat,
      dNx,
      dNy,
      wg,
      gx,
      gy,
      fixd,
      u: new Float64Array(nd),
      sig: new Float64Array(ne * 12),
      sig0: new Float64Array(ne * 12),
      yld: new Uint8Array(ne * 3),
      act: new Uint8Array(ne),
      u0: new Float64Array(nd),
      du: new Float64Array(nd),
      eq: new Int32Array(nd),
      neq: 0,
      fac: null,
      nfac: 0,
      setActive: () => {},
      solve: () => {},
      stress: () => {},
      fint: () => {},
      body: () => {},
      bodyG: () => {},
      norm: () => 0,
      sum1: () => 0,
      commit: () => {},
      newton: () => ({ conv: true, it: 0, rn: 0 }),
    };
    const eIdx = new Int32Array(12);
    S.setActive = function (mask: Uint8Array) {
      S.act = mask;
      const eq = S.eq;
      eq.fill(-1);
      const na = new Uint8Array(nn);
      for (let e = 0; e < ne; e++) if (mask[e]) for (let a = 0; a < 6; a++) na[T[6 * e + a]] = 1;
      let n = 0;
      for (let i = 0; i < nn; i++)
        if (na[i]) {
          for (let k = 0; k < 2; k++) if (!fixd[2 * i + k]) eq[2 * i + k] = n++;
        }
      S.neq = n;
      const first = new Int32Array(n);
      for (let i = 0; i < n; i++) first[i] = i;
      for (let e = 0; e < ne; e++)
        if (mask[e]) {
          let mn = 1e9,
            c = 0;
          for (let a = 0; a < 6; a++)
            for (let k = 0; k < 2; k++) {
              const q = eq[2 * T[6 * e + a] + k];
              eIdx[c++] = q;
              if (q >= 0 && q < mn) mn = q;
            }
          for (let a = 0; a < 12; a++) {
            const q = eIdx[a];
            if (q >= 0 && mn < first[q]) first[q] = mn;
          }
        }
      const ptr = new Int32Array(n + 1);
      for (let i = 0; i < n; i++) ptr[i + 1] = ptr[i] + (i - first[i] + 1);
      const L = new Float64Array(ptr[n]),
        Ke = new Float64Array(144);
      for (let e = 0; e < ne; e++)
        if (mask[e]) {
          const m = mats[mat[e]],
            l2g = m.D[0],
            lam = m.D[1],
            G = m.D[2];
          Ke.fill(0);
          for (let g = 0; g < 3; g++) {
            const w = wg[3 * e + g],
              o6 = e * 18 + g * 6;
            for (let a = 0; a < 6; a++)
              for (let b = 0; b < 6; b++) {
                const ax = dNx[o6 + a],
                  ay = dNy[o6 + a],
                  bx = dNx[o6 + b],
                  by = dNy[o6 + b];
                Ke[2 * a * 12 + 2 * b] += w * (l2g * ax * bx + G * ay * by);
                Ke[2 * a * 12 + 2 * b + 1] += w * (lam * ax * by + G * ay * bx);
                Ke[(2 * a + 1) * 12 + 2 * b] += w * (lam * ay * bx + G * ax * by);
                Ke[(2 * a + 1) * 12 + 2 * b + 1] += w * (l2g * ay * by + G * ax * bx);
              }
          }
          for (let a = 0; a < 12; a++) eIdx[a] = eq[2 * T[6 * e + (a >> 1)] + (a & 1)];
          for (let a = 0; a < 12; a++) {
            const i = eIdx[a];
            if (i < 0) continue;
            for (let b = 0; b < 12; b++) {
              const j = eIdx[b];
              if (j >= 0 && j <= i) L[ptr[i] + j - first[i]] += Ke[a * 12 + b];
            }
          }
        }
      for (let i = 0; i < n; i++) {
        const fi = first[i],
          pi = ptr[i];
        for (let j = fi; j <= i; j++) {
          const fj = first[j],
            pj = ptr[j],
            k0 = fi > fj ? fi : fj;
          let s = L[pi + j - fi],
            s1 = 0,
            ai = pi + k0 - fi,
            aj = pj + k0 - fj,
            k = k0;
          for (; k + 3 < j; k += 4, ai += 4, aj += 4) {
            s -= L[ai] * L[aj] + L[ai + 1] * L[aj + 1];
            s1 -= L[ai + 2] * L[aj + 2] + L[ai + 3] * L[aj + 3];
          }
          for (; k < j; k++) s -= L[ai++] * L[aj++];
          s += s1;
          if (j < i) L[pi + j - fi] = s / L[pj + j - fj];
          else {
            if (!(s > 1e-12)) s = 1e-12;
            L[pi + i - fi] = Math.sqrt(s);
          }
        }
      }
      S.fac = { L, ptr, first, n };
      S.nfac++;
      S.work = new Float64Array(n);
    };
    S.solve = function (r: Float64Array, du: Float64Array) {
      const { L, ptr, first, n } = S.fac!,
        y = S.work!,
        eq = S.eq;
      for (let d = 0; d < nd; d++) {
        const q = eq[d];
        if (q >= 0) y[q] = r[d];
      }
      for (let i = 0; i < n; i++) {
        const fi = first[i],
          pi = ptr[i];
        let s = y[i],
          s1 = 0,
          s2 = 0,
          s3 = 0,
          k = fi,
          a = pi;
        for (; k + 3 < i; k += 4, a += 4) {
          s -= L[a] * y[k];
          s1 -= L[a + 1] * y[k + 1];
          s2 -= L[a + 2] * y[k + 2];
          s3 -= L[a + 3] * y[k + 3];
        }
        for (; k < i; k++, a++) s -= L[a] * y[k];
        y[i] = (s + s1 + s2 + s3) / L[pi + i - fi];
      }
      for (let i = n - 1; i >= 0; i--) {
        const fi = first[i],
          pi = ptr[i],
          xi = y[i] / L[pi + i - fi];
        y[i] = xi;
        for (let k = fi, a = pi; k < i; k++, a++) y[k] -= L[a] * xi;
      }
      for (let d = 0; d < nd; d++) {
        const q = eq[d];
        du[d] = q >= 0 ? y[q] : 0;
      }
    };
    S.stress = function () {
      const { sig, sig0, u, u0, act, yld } = S,
        du = S.du;
      let np = 0;
      for (let d = 0; d < nd; d++) du[d] = u[d] - u0[d];
      for (let e = 0; e < ne; e++) {
        if (!act[e]) continue;
        const m = mats[mat[e]],
          D0 = m.D[0],
          D1 = m.D[1],
          D2 = m.D[2];
        for (let g = 0; g < 3; g++) {
          let ex = 0,
            ey = 0,
            gxy = 0;
          const o6 = e * 18 + g * 6;
          for (let a = 0; a < 6; a++) {
            const n = T[6 * e + a],
              dx = du[2 * n],
              dy = du[2 * n + 1],
              bx = dNx[o6 + a],
              by = dNy[o6 + a];
            ex += bx * dx;
            ey += by * dy;
            gxy += by * dx + bx * dy;
          }
          const o = e * 12 + g * 4;
          if (S.pw && S.pw0) {
            const p0 = S.pw0[3 * e + g],
              p1 = S.pw[3 * e + g];
            ST[0] = sig0[o] + p0 + D0 * ex + D1 * ey;
            ST[1] = sig0[o + 1] + p0 + D1 * ex + D0 * ey;
            ST[2] = sig0[o + 2] + D2 * gxy;
            ST[3] = sig0[o + 3] + p0 + D1 * (ex + ey);
            const pl = mcUpd(m);
            yld[3 * e + g] = pl;
            np += pl;
            sig[o] = ST[0] - p1;
            sig[o + 1] = ST[1] - p1;
            sig[o + 2] = ST[2];
            sig[o + 3] = ST[3] - p1;
            continue;
          }
          ST[0] = sig0[o] + D0 * ex + D1 * ey;
          ST[1] = sig0[o + 1] + D1 * ex + D0 * ey;
          ST[2] = sig0[o + 2] + D2 * gxy;
          ST[3] = sig0[o + 3] + D1 * (ex + ey);
          const pl = mcUpd(m);
          yld[3 * e + g] = pl;
          np += pl;
          sig[o] = ST[0];
          sig[o + 1] = ST[1];
          sig[o + 2] = ST[2];
          sig[o + 3] = ST[3];
        }
      }
      S.nPlastic = np;
    };
    S.fint = function (sig: Float64Array, F: Float64Array, mask: Uint8Array) {
      for (let e = 0; e < ne; e++) {
        if (!mask[e]) continue;
        for (let g = 0; g < 3; g++) {
          const o = e * 12 + g * 4,
            w = wg[3 * e + g],
            sx = sig[o] * w,
            sy = sig[o + 1] * w,
            sxy = sig[o + 2] * w,
            o6 = e * 18 + g * 6;
          for (let a = 0; a < 6; a++) {
            const n = T[6 * e + a];
            F[2 * n] += dNx[o6 + a] * sx + dNy[o6 + a] * sxy;
            F[2 * n + 1] += dNy[o6 + a] * sy + dNx[o6 + a] * sxy;
          }
        }
      }
    };
    S.body = function (mask: Uint8Array, F: Float64Array, fxk: number, fyk: number) {
      for (let e = 0; e < ne; e++) {
        if (!mask[e]) continue;
        const gm0 = mats[mat[e]].gam;
        for (let g = 0; g < 3; g++) {
          const w = wg[3 * e + g] * (S.gamG ? S.gamG[3 * e + g] : gm0);
          for (let a = 0; a < 6; a++) {
            const n = T[6 * e + a],
              v = w * NGP[g][a];
            F[2 * n] += fxk * v;
            F[2 * n + 1] += fyk * v;
          }
        }
      }
    };
    S.bodyG = function (F: Float64Array, fxk: number, fyk: number, arr: Float64Array) {
      for (let e = 0; e < ne; e++)
        for (let g = 0; g < 3; g++) {
          const gm = arr[3 * e + g];
          if (!gm) continue;
          const w = wg[3 * e + g] * gm;
          for (let a = 0; a < 6; a++) {
            const n = T[6 * e + a],
              v = w * NGP[g][a];
            F[2 * n] += fxk * v;
            F[2 * n + 1] += fyk * v;
          }
        }
    };
    S.norm = (v: Float64Array) => {
      let s = 0;
      const eq = S.eq;
      for (let d = 0; d < nd; d++) if (eq[d] >= 0) s += v[d] * v[d];
      return Math.sqrt(s);
    };
    S.sum1 = (v: Float64Array) => {
      let s = 0;
      const eq = S.eq;
      for (let d = 0; d < nd; d++) if (eq[d] >= 0) s += Math.abs(v[d]);
      return s;
    };
    S.commit = function () {
      S.sig0.set(S.sig);
      S.u0.set(S.u);
      if (S.pw && S.pw0) S.pw0.set(S.pw);
    };
    S.newton = function (fext, o2) {
      o2 = o2 || {};
      const maxIt = o2.maxIt || 60,
        tol = o2.tol || 0.001,
        mq = o2.m || 0,
        F = new Float64Array(nd),
        p = new Float64Array(nd);
      let r = new Float64Array(nd),
        r1 = new Float64Array(nd);
      const ref = Math.max(o2.ref || S.sum1(fext), 1e-9),
        Ss: Float64Array[] = [],
        Ys: Float64Array[] = [],
        rho: number[] = [],
        al: number[] = [],
        dot = (a: Float64Array, b: Float64Array) => {
          let t = 0;
          for (let d = 0; d < nd; d++) t += a[d] * b[d];
          return t;
        };
      const ev = (rr: Float64Array) => {
        S.stress();
        F.fill(0);
        S.fint(S.sig, F, S.act);
        for (let d = 0; d < nd; d++) rr[d] = S.eq[d] >= 0 ? fext[d] - F[d] : 0;
        return S.norm(rr) / ref;
      };
      const ctl = S.ctrl;
      let it = 0,
        rn = ev(r),
        rn0 = rn,
        lastStep = 0;
      const uS = S.u.slice();
      for (;;) {
        if (!(rn === rn) || rn > 1e3 * Math.max(rn0, 0.001))
          return { conv: false, it, rn, div: true };
        let ratio = 0;
        if (o2.duTol && it > 0) {
          let U = 0;
          for (let d = 0; d < nd; d++) {
            if (ctl && !ctl[d >> 1]) continue;
            const v = Math.abs(S.u[d] - uS[d]);
            if (v > U) U = v;
          }
          ratio = lastStep / (U + 1e-9);
        }
        if (rn <= tol && ratio <= (o2.duTol || 1)) return { conv: true, it, rn };
        if (it >= maxIt || (o2.duTol && it >= 30 && ratio > 4 * o2.duTol))
          return { conv: false, it, rn, div: true };
        for (let d = 0; d < nd; d++) p[d] = -r[d];
        for (let i = Ss.length - 1; i >= 0; i--) {
          const a = rho[i] * dot(Ss[i], p);
          al[i] = a;
          const y = Ys[i];
          for (let d = 0; d < nd; d++) p[d] -= a * y[d];
        }
        S.solve(p, p);
        for (let i = 0; i < Ss.length; i++) {
          const c = al[i] - rho[i] * dot(Ys[i], p),
            s = Ss[i];
          for (let d = 0; d < nd; d++) p[d] += c * s[d];
        }
        for (let d = 0; d < nd; d++) p[d] = -p[d];
        const uo = S.u.slice(),
          G0 = dot(p, r);
        let eta = 1;
        lastStep = 0;
        for (let d = 0; d < nd; d++) {
          if (ctl && !ctl[d >> 1]) continue;
          const v = Math.abs(p[d]);
          if (v > lastStep) lastStep = v;
        }
        for (let d = 0; d < nd; d++) S.u[d] = uo[d] + p[d];
        let rn1 = ev(r1);
        const G1 = dot(p, r1);
        if (o2.ls && G0 > 0 && Math.abs(G1) > 0.5 * G0) {
          eta = Math.max(0.1, Math.min(2.5, G0 / (G0 - G1)));
          if (Math.abs(eta - 1) > 0.05) {
            for (let d = 0; d < nd; d++) S.u[d] = uo[d] + eta * p[d];
            rn1 = ev(r1);
          }
        }
        if (mq > 0) {
          const s = new Float64Array(nd),
            y = new Float64Array(nd);
          for (let d = 0; d < nd; d++) {
            s[d] = S.u[d] - uo[d];
            y[d] = r[d] - r1[d];
          }
          const sy = dot(s, y);
          if (rn1 > 2 * rn) {
            Ss.length = Ys.length = rho.length = 0;
          } else if (sy > 1e-14 * Math.sqrt(dot(s, s) * dot(y, y))) {
            Ss.push(s);
            Ys.push(y);
            rho.push(1 / sy);
            if (Ss.length > mq) {
              Ss.shift();
              Ys.shift();
              rho.shift();
            }
          }
        }
        const t = r;
        r = r1;
        r1 = t;
        rn = rn1;
        it++;
        if (o2.umax) {
          let m = 0;
          for (let d = 0; d < nd; d++) {
            const v = Math.abs(S.u[d] - S.u0[d]);
            if (v > m) m = v;
          }
          if (m > o2.umax) return { conv: false, it, rn, div: true };
        }
      }
    };
    return S;
  }

  function hatProfile(items: [number, number][], a: number, b: number, K: number): [number, number][] {
    const d = (b - a) / (K - 1),
      Fk = new Float64Array(K);
    items.forEach(([s, f]) => {
      let t = (s - a) / d;
      t = Math.max(0, Math.min(K - 1 - 1e-9, t));
      const k = Math.floor(t),
        fr = t - k;
      Fk[k] += f * (1 - fr);
      Fk[k + 1] += f * fr;
    });
    return Array.from(Fk, (v, k) => [a + k * d, v / (d * (k === 0 || k === K - 1 ? 0.5 : 1))]);
  }

  function edgeLoad(
    S: Fem2dEngineInstance,
    mask: Uint8Array,
    q: number,
    sel: (x1: number, y1: number, x2: number, y2: number) => boolean,
  ): Float64Array {
    const { T, X, Y, ne, nd } = S,
      F = new Float64Array(nd),
      cnt = new Map<number, number>(),
      list: [number, number, number, number][] = [];
    for (let e = 0; e < ne; e++)
      if (mask[e])
        for (let k = 0; k < 3; k++) {
          const a = T[6 * e + k],
            b = T[6 * e + ((k + 1) % 3)],
            m = T[6 * e + 3 + k],
            key = a < b ? a * 4194304 + b : b * 4194304 + a;
          cnt.set(key, (cnt.get(key) || 0) + 1);
          list.push([key, a, b, m]);
        }
    list.forEach(([key, a, b, m]) => {
      if (cnt.get(key) !== 1 || !sel(X[a], Y[a], X[b], Y[b])) return;
      const dx = Math.abs(X[b] - X[a]) * q;
      F[2 * a + 1] -= dx / 6;
      F[2 * b + 1] -= dx / 6;
      F[2 * m + 1] -= (dx * 4) / 6;
    });
    return F;
  }

  function edgeP(
    S: Fem2dEngineInstance,
    mask: Uint8Array,
    pf: (x: number, y: number, nx: number, ny: number) => number,
  ): Float64Array {
    const { T, X, Y, ne, nd } = S,
      F = new Float64Array(nd),
      cnt = new Map<number, number>(),
      list: [number, number, number, number, number][] = [];
    for (let e = 0; e < ne; e++)
      if (mask[e])
        for (let k = 0; k < 3; k++) {
          const a = T[6 * e + k],
            b = T[6 * e + ((k + 1) % 3)],
            c = T[6 * e + ((k + 2) % 3)],
            m = T[6 * e + 3 + k],
            key = a < b ? a * 4194304 + b : b * 4194304 + a;
          cnt.set(key, (cnt.get(key) || 0) + 1);
          list.push([key, a, b, m, c]);
        }
    list.forEach(([key, a, b, m, c]) => {
      if (cnt.get(key) !== 1) return;
      const dx = X[b] - X[a],
        dy = Y[b] - Y[a],
        L = Math.hypot(dx, dy);
      if (L < 1e-12) return;
      let nx = dy / L,
        ny = -dx / L;
      if ((X[m] - X[c]) * nx + (Y[m] - Y[c]) * ny < 0) {
        nx = -nx;
        ny = -ny;
      }
      (
        [
          [a, 1 / 6],
          [m, 4 / 6],
          [b, 1 / 6],
        ] as [number, number][]
      ).forEach(([n, w]) => {
        const p = pf(X[n], Y[n], nx, ny);
        if (p) {
          F[2 * n] -= p * nx * L * w;
          F[2 * n + 1] -= p * ny * L * w;
        }
      });
    });
    return F;
  }

  function srm(
    S: Fem2dEngineInstance,
    mats: Fem2dMcMaterial[],
    from: { u: Float64Array; sig: Float64Array },
    fext: Float64Array,
    o: {
      umax: number;
      Fmax: number;
      maxIt?: number;
      tol?: number;
      duTol?: number;
      m?: number;
      ls?: boolean;
      step?: number;
      nbis?: number;
    },
  ) {
    const nd = S.nd,
      soil = mats.filter((m) => !m.el);
    const setF = (F: number) =>
      soil.forEach((m) =>
        mcSet(m, m.c0 / F, (Math.atan(Math.tan(rad(m.phi0)) / F) * 180) / Math.PI),
      );
    let ok = { u: from.u.slice(), sig: from.sig.slice() },
      trials = 0,
      its = 0;
    const once = (
      F: number,
      st: { u: Float64Array; sig: Float64Array },
      m: number,
      ls: boolean,
      maxIt: number,
    ) => {
      S.u.set(st.u);
      S.u0.set(st.u);
      S.sig0.set(st.sig);
      S.sig.set(st.sig);
      setF(F);
      const r = S.newton(fext, {
        maxIt,
        tol: o.tol || 0.001,
        duTol: o.duTol === undefined ? 0.005 : o.duTol,
        umax: o.umax,
        m,
        ls,
      });
      its += r.it;
      return r;
    };
    let failU: Float64Array | null = null,
      pref = 0;
    const trial = (F: number, st: { u: Float64Array; sig: Float64Array }) => {
      trials++;
      const A: [number, boolean, number][] = [
        [o.m || 0, !!o.ls, o.maxIt || 60],
        [8, true, 40],
      ];
      let r: { conv: boolean; it: number; rn: number; div?: boolean } = {
          conv: false,
          it: 0,
          rn: 0,
        },
        u1: Float64Array | null = null;
      for (let k = 0; k < (o.m == null ? 2 : 1); k++) {
        const a = A[k ^ pref];
        r = once(F, st, a[0], a[1], a[2]);
        if (r.conv) {
          if (o.m == null) pref = k ^ pref;
          return r;
        }
        if (k === 0) u1 = S.u.slice();
      }
      failU = u1;
      return r;
    };
    const keep = () => ({ u: S.u.slice(), sig: S.sig.slice() });
    let FS: number | null = null,
      r = trial(1, ok);
    if (r.conv) {
      ok = keep();
      FS = 1;
      let Ff: number | null = null;
      const dF = o.step || 0.25;
      for (let F = 1 + dF; F <= o.Fmax + 1e-9; F += dF) {
        r = trial(F, ok);
        if (r.conv) {
          FS = F;
          ok = keep();
        } else {
          Ff = F;
          break;
        }
      }
      if (Ff != null)
        for (let k = 0; k < (o.nbis || 4); k++) {
          const lo: number = FS;
          const hi: number = Ff;
          const Fm: number = 0.5 * (lo + hi);
          r = trial(Fm, ok);
          if (r.conv) {
            FS = Fm;
            ok = keep();
          } else Ff = Fm;
        }
    }
    soil.forEach((m) => mcSet(m, m.c0, m.phi0));
    const du = new Float64Array(nd),
      uf = failU || ok.u;
    for (let d = 0; d < nd; d++) du[d] = uf[d] - from.u[d];
    return { FS, du, trials, its };
  }

  function viewOf(
    res: { mesh: { nodes: Point2D[]; tris: number[][]; mat: number[] } },
    opt?: { win?: [number, number, number, number] },
  ): [number, number, number, number] {
    const N = res.mesh.nodes;
    let x0 = Infinity,
      x1 = -Infinity,
      y0 = Infinity,
      y1 = -Infinity,
      wx0 = Infinity,
      wx1 = -Infinity,
      wy1 = -Infinity;
    N.forEach((p) => {
      x0 = Math.min(x0, p[0]);
      x1 = Math.max(x1, p[0]);
      y0 = Math.min(y0, p[1]);
      y1 = Math.max(y1, p[1]);
    });
    res.mesh.tris.forEach((t, e) => {
      if (res.mesh.mat[e] === 0)
        for (let a = 0; a < 3; a++) {
          const p = N[t[a]];
          wx0 = Math.min(wx0, p[0]);
          wx1 = Math.max(wx1, p[0]);
          wy1 = Math.max(wy1, p[1]);
        }
    });
    const H = Math.max(wy1, 2),
      w: [number, number, number, number] = (opt && opt.win) || [
        Math.max(x0, wx0 - 1.6 * H),
        Math.min(x1, wx1 + 3 * H),
        Math.max(y0, -1.3 * H),
        y1,
      ];
    return w;
  }

  const svgHead = (W: number, Hh: number) =>
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' +
    W +
    ' ' +
    Hh +
    '" width="' +
    W +
    '" height="' +
    Hh +
    '" font-family="Segoe UI,Arial,sans-serif" font-size="11"><rect width="' +
    W +
    '" height="' +
    Hh +
    '" fill="#fff"/>';

  function svgPlastic(
    res: { mesh: { nodes: Point2D[]; tris: number[][]; mat: number[] }; plastic: Point2D[] },
    opt?: { width?: number; win?: [number, number, number, number] },
  ): string {
    opt = opt || {};
    const N = res.mesh.nodes,
      TR = res.mesh.tris,
      MT = res.mesh.mat,
      W = opt.width || 760,
      pad = 10,
      win = viewOf(res, opt);
    const sc = (W - 2 * pad) / (win[1] - win[0]),
      Hh = Math.round((win[3] - win[2]) * sc + 2 * pad),
      f1 = (v: number) => (Math.round(v * 10) / 10).toString();
    const X = (x: number) => f1((x - win[0]) * sc + pad),
      Y = (y: number) => f1(Hh - pad - (y - win[2]) * sc),
      seen: Record<string, [number, number, number, number]> = {};
    let ed = '',
      wd = '',
      wf = '';
    TR.forEach((t, e) => {
      const c = (N[t[0]][0] + N[t[1]][0] + N[t[2]][0]) / 3;
      if (c < win[0] - 2 || c > win[1] + 2) return;
      for (let k = 0; k < 3; k++) {
        const a = t[k],
          b = t[(k + 1) % 3],
          key = a < b ? a + '_' + b : b + '_' + a;
        if (seen[key] === undefined) seen[key] = [a, b, t[3 + k], MT[e] === 0 ? 1 : 0];
        else seen[key][3] += MT[e] === 0 ? 1 : 0;
      }
      if (MT[e] === 0)
        wf +=
          'M' +
          X(N[t[0]][0]) +
          ' ' +
          Y(N[t[0]][1]) +
          'L' +
          X(N[t[1]][0]) +
          ' ' +
          Y(N[t[1]][1]) +
          'L' +
          X(N[t[2]][0]) +
          ' ' +
          Y(N[t[2]][1]) +
          'Z';
    });
    Object.keys(seen).forEach((k) => {
      const v = seen[k],
        A = N[v[0]],
        Bn = N[v[1]],
        d = 'M' + X(A[0]) + ' ' + Y(A[1]) + 'L' + X(Bn[0]) + ' ' + Y(Bn[1]);
      if (v[3] === 1) wd += d;
      else if (v[3] === 0) ed += d;
    });
    let dots = '';
    res.plastic.forEach((p) => {
      if (p[0] >= win[0] && p[0] <= win[1] && p[1] >= win[2] && p[1] <= win[3])
        dots += 'M' + X(p[0]) + ' ' + Y(p[1]) + 'h0';
    });
    return (
      svgHead(W, Hh) +
      '<path d="' +
      ed +
      '" fill="none" stroke="#c9c9c9" stroke-width="0.5"/><path d="' +
      wf +
      '" fill="#555" stroke="#555" stroke-width="0.5"/><path d="' +
      wd +
      '" fill="none" stroke="#000" stroke-width="1.2"/>' +
      '<path d="' +
      dots +
      '" stroke="#d62728" stroke-width="2.6" stroke-linecap="round"/><circle cx="' +
      (pad + 5) +
      '" cy="' +
      (pad + 6) +
      '" r="1.6" fill="#d62728"/><text x="' +
      (pad + 12) +
      '" y="' +
      (pad + 10) +
      '" fill="#222">điểm Gauss dẻo (' +
      res.plastic.length +
      ')</text></svg>'
    );
  }

  function run(R: Fem2dRLike, opt?: Fem2dRunOptions) {
    opt = opt || {};
    const T0 = Date.now(),
      M = modelFromR(R, opt),
      mesh = buildMesh(M.spec),
      S = Engine(mesh, M.mats);
    const { g, B, Df } = M,
      ne = mesh.ne,
      nn = mesh.nn,
      nd = S.nd,
      mat = mesh.mat,
      Tn = mesh.T,
      X = mesh.X,
      Y = mesh.Y,
      mats = M.mats;
    const notes = [
      'Biến dạng phẳng, dải 1 m ; phần tử tam giác 6 nút (3 điểm Gauss) ; đất Mohr-Coulomb đàn dẻo lý tưởng (góc giãn nở ψ = ' +
        (opt.psi || 0) +
        '°, cắt kéo = 0) ; bê tông đàn hồi.',
      'Tiếp xúc tường–đất, bản đáy–nền là DÍNH KẾT (không có phần tử mặt tiếp xúc ; rInter bị bỏ qua) – lực cắt mặt tiếp xúc không bị giới hạn bởi ma sát.',
      'Đơn vị : m, kN, kPa ; uTop/uToe/uHeel trong stages tính bằng mm, u và uSRM (nút) bằng m ; thrust dương = đẩy tường về phía mũi.',
      'FSsrm (giảm cường độ, sai số bước ≈ 0,03) phụ thuộc lưới và giới hạn số lần lặp (60) : chỉ mang tính tham khảo, uSRM = chuyển vị ở lần thử thất bại gần nhất.',
    ];
    const WT = opt.water ? mkWater(opt.water) : null;
    let PWd: { A: Float64Array; B: Float64Array } | null = null;
    const warn: string[] = [],
      stages: Fem2dStageSummary[] = [],
      cxA = new Float64Array(ne),
      cyA = new Float64Array(ne);
    for (let e = 0; e < ne; e++) {
      cxA[e] = (X[Tn[6 * e]] + X[Tn[6 * e + 1]] + X[Tn[6 * e + 2]]) / 3;
      cyA[e] = (Y[Tn[6 * e]] + Y[Tn[6 * e + 1]] + Y[Tn[6 * e + 2]]) / 3;
    }
    const sel = (f: (e: number) => boolean) => {
      const m = new Uint8Array(ne);
      for (let e = 0; e < ne; e++) m[e] = f(e) ? 1 : 0;
      return m;
    };
    const uni = (a: Uint8Array, b: Uint8Array) => {
      const o = new Uint8Array(ne);
      for (let e = 0; e < ne; e++) o[e] = a[e] | b[e];
      return o;
    };
    const mW = sel((e) => mat[e] === 0),
      mB = sel((e) => mat[e] === 1),
      mWB = uni(mW, mB);
    const m0 = sel((e) => mat[e] === 2),
      m1 = sel((e) => mat[e] === 0 || mat[e] === 3);
    const nodeIn = (k: number) => {
      const f = new Uint8Array(nn);
      for (let e = 0; e < ne; e++)
        if (mat[e] === k) for (let a = 0; a < 6; a++) f[Tn[6 * e + a]] = 1;
      return f;
    };
    const nW = nodeIn(0),
      nF = nodeIn(2),
      nB = nodeIn(1);
    S.ctrl = nW;
    let allOk = true;
    const setPW = (lam: number) => {
      if (!PWd || !S.pw) return;
      const A = PWd.A,
        Bq = PWd.B,
        P = S.pw;
      for (let i = 0; i < P.length; i++) P[i] = A[i] + lam * (Bq[i] - A[i]);
    };
    const fext = new Float64Array(nd);
    const step = (
      nm: string,
      prevF?: Float64Array,
      depth?: number,
      l0?: number,
      l1?: number,
    ): { conv: boolean; it: number; rn: number; div?: boolean } => {
      depth = depth || 0;
      l0 = l0 || 0;
      l1 = l1 == null ? 1 : l1;
      setPW(l1);
      let r = S.newton(fext, { maxIt: 100, tol: 0.001 });
      if (!r.conv) r = S.newton(fext, { maxIt: 60, tol: 0.001, m: 8, ls: true });
      if (!r.conv && prevF && depth < 3) {
        const tgt = fext.slice(),
          lm = 0.5 * (l0 + l1);
        S.u.set(S.u0);
        for (let d = 0; d < nd; d++) fext[d] = 0.5 * (prevF[d] + tgt[d]);
        const mid = fext.slice();
        step(nm, prevF, depth + 1, l0, lm);
        fext.set(tgt);
        return step(nm, mid, depth + 1, lm, l1);
      }
      if (!r.conv) {
        allOk = false;
        warn.push(
          nm +
            ': Newton không hội tụ sau ' +
            r.it +
            ' lần lặp (‖r‖/‖f‖ = ' +
            r.rn.toExponential(1) +
            ')',
        );
      }
      S.commit();
      return r;
    };
    const nearest = (x: number, y: number) => {
      let b = 0,
        bd = 1e30;
      for (let i = 0; i < nn; i++) {
        const d = (X[i] - x) ** 2 + (Y[i] - y) ** 2;
        if (d < bd) {
          bd = d;
          b = i;
        }
      }
      return b;
    };
    const iTop = nearest(0.5 * (g.xft + g.xbt), g.yT),
      iToe = nearest(0, 0),
      iHeel = nearest(B, 0);
    const rec = (name: string, kh: number, kv: number) => {
      const FI = new Float64Array(nd),
        FB = new Float64Array(nd);
      S.fint(S.sig, FI, mW);
      S.body(mW, FB, -kh, -1 + kv);
      const ib: [number, number][] = [],
        ik: [number, number][] = [];
      let thrust = 0;
      for (let i = 0; i < nn; i++) {
        if (!nW[i]) continue;
        const px = FI[2 * i] - FB[2 * i],
          py = FI[2 * i + 1] - FB[2 * i + 1];
        if (nF[i] && X[i] > -1e-9 && X[i] < B + 1e-9) ib.push([X[i], py]);
        if (
          nB[i] &&
          Y[i] > g.yF - 1e-6 &&
          Y[i] < g.yT + 1e-6 &&
          Math.abs(X[i] - polyMaxX(g.stem, Y[i])) < 1e-5
        ) {
          ik.push([Y[i], -px]);
          thrust -= px;
        }
      }
      const mm = (i: number): Point2D => [S.u[2 * i] * 1e3, S.u[2 * i + 1] * 1e3];
      stages.push({
        name,
        uTop: mm(iTop),
        uToe: S.u[2 * iToe + 1] * 1e3,
        uHeel: S.u[2 * iHeel + 1] * 1e3,
        pBase: hatProfile(ib, 0, B, 21),
        thrust,
        pBack: hatProfile(ik, g.yF, g.yT, 12),
        nPlastic: S.nPlastic || 0,
        Vbase: ib.reduce((s, v) => s + v[1], 0),
      });
    };
    for (let e = 0; e < ne; e++)
      if (mat[e] === 2 || mat[e] === 3) {
        const m = mats[mat[e]];
        for (let k = 0; k < 3; k++) {
          const y = S.gy[3 * e + k],
            o = e * 12 + 4 * k,
            sy = mat[e] === 3 ? -m.gam * (Df - y) : m.gam * y;
          S.sig0[o + 1] = sy;
          S.sig0[o] = S.sig0[o + 3] = m.K0 * sy;
        }
      }
    S.sig.set(S.sig0);
    S.setActive(m0);
    S.body(m0, fext, 0, -1);
    step('S0');
    S.u.fill(0);
    S.u0.fill(0);
    S.setActive(uni(m0, m1));
    S.body(m1, fext, 0, -1);
    step('S1');
    rec('S1 – thi công tường', 0, 0);
    let ytop = 0;
    for (let e = 0; e < ne; e++)
      if (mat[e] === 1) for (let a = 0; a < 3; a++) ytop = Math.max(ytop, Y[Tn[6 * e + a]]);
    const nl = Math.max(1, opt.lifts || 5);
    let act = uni(m0, m1);
    const off = new Float64Array(2 * nn),
      nodesOf = (mk: Uint8Array) => {
        const f = new Uint8Array(nn);
        for (let e = 0; e < ne; e++) if (mk[e]) for (let a = 0; a < 6; a++) f[Tn[6 * e + a]] = 1;
        return f;
      };
    let nAct = nodesOf(act);
    for (let k = 1; k <= nl; k++) {
      const lo = (ytop * (k - 1)) / nl,
        hi = (ytop * k) / nl,
        lift = sel((e) => mat[e] === 1 && cyA[e] > lo - (k === 1 ? 1e9 : 0) && cyA[e] <= hi + 1e-9);
      const prevN = nAct;
      act = uni(act, lift);
      nAct = nodesOf(act);
      for (let i = 0; i < nn; i++) {
        if (!nAct[i] || prevN[i]) continue;
        let bj = -1,
          bd = 1e30;
        for (let j = 0; j < nn; j++) {
          if (!prevN[j] || Y[j] > Y[i] + 1e-9) continue;
          const d = (X[j] - X[i]) ** 2 + 0.02 * (Y[i] - Y[j]) ** 2;
          if (d < bd) {
            bd = d;
            bj = j;
          }
        }
        if (bj >= 0) {
          off[2 * i] = S.u[2 * bj] + off[2 * bj];
          off[2 * i + 1] = S.u[2 * bj + 1] + off[2 * bj + 1];
        }
      }
      S.setActive(act);
      const pF = fext.slice();
      S.body(lift, fext, 0, -1);
      step('S2 lớp ' + k, pF);
    }
    rec('S2 – đắp đất sau lưng', 0, 0);
    let wInfo: Fem2dJobOutput['water'] = null;
    if (WT && opt.water) {
      const gwv = WT.gw,
        hFv = opt.water.hF,
        nG = 3 * ne,
        pwB = new Float64Array(nG),
        gamG = new Float64Array(nG),
        dgam = new Float64Array(nG);
      let xmn = Infinity;
      for (let i = 0; i < nn; i++) if (X[i] < xmn) xmn = X[i];
      let nSat = 0,
        pmax = 0;
      for (let e = 0; e < ne; e++) {
        const k = mat[e],
          m = mats[k];
        for (let q = 0; q < 3; q++) {
          const i3 = 3 * e + q,
            x = S.gx[i3],
            y = S.gy[i3];
          gamG[i3] = m.gam;
          if (k === 0 || !S.act[e] || !(y < WT.lv(x) - 1e-9)) continue;
          gamG[i3] = m.gsat || m.gam;
          dgam[i3] = (m.gsat || m.gam) - m.gam;
          nSat++;
          if (!(M.clay && (k === 2 || k === 3))) {
            const p = WT.u(x, y);
            pwB[i3] = p;
            if (p > pmax) pmax = p;
          }
        }
      }
      S.gamG = gamG;
      S.pw = new Float64Array(nG);
      S.pw0 = new Float64Array(nG);
      PWd = { A: new Float64Array(nG), B: pwB };
      const dF = new Float64Array(nd);
      S.bodyG(dF, 0, -1, dgam);
      if (hFv > Df + 1e-6) {
        const fw = edgeP(S, act, (x, y) =>
          x < WT.xs && x > xmn + 1e-6 && y >= Df - 1e-6 && y < hFv - 1e-9 ? gwv * (hFv - y) : 0,
        );
        for (let d = 0; d < nd; d++) dF[d] += fw[d];
      }
      const nw = Math.max(1, opt.waterSteps || 3),
        f0 = fext.slice();
      for (let k = 1; k <= nw; k++) {
        const pF = fext.slice();
        for (let d = 0; d < nd; d++) fext[d] = f0[d] + (dF[d] * k) / nw;
        step('S2w bước ' + k, pF, 0, (k - 1) / nw, k / nw);
      }
      rec('S2w – mực nước ngầm', 0, 0);
      wInfo = {
        hB: opt.water.hB,
        hF: hFv,
        hFtop: opt.water.hFtop,
        xs: WT.xs,
        nSat,
        pmax,
        clay: !!M.clay,
      };
      notes.push(
        'Nước ngầm đưa vào sau khi thi công xong : áp lực nước lỗ rỗng lấy từ lời giải thấm 2D ổn định (mực nước sau lưng ' +
          opt.water.hB.toFixed(2) +
          ' m, phía trước ' +
          opt.water.hF.toFixed(2) +
          ' m so với đáy bản đáy) ; ứng suất lưu là ứng suất TỔNG, điều kiện chảy dẻo Mohr-Coulomb kiểm tra trên ứng suất có hiệu σ\' = σ + u ; đất dưới mực nước dùng trọng lượng bão hòa ; áp lực nước lên tường và đẩy ngược dưới đáy bản đáy nằm sẵn trong ứng suất tổng của đất kề tường.' +
          (M.clay
            ? ' Nền sét : ứng suất tổng (Su, φu = 0), không đưa áp lực nước lỗ rỗng vào nền.'
            : ''),
      );
    }
    const qq = (R.I.q || 0) + (R.I.qL || 0);
    if (qq > 0) {
      const fq = edgeLoad(
        S,
        act,
        qq,
        (xa, ya, xb, yb) =>
          Math.min(xa, xb) >= g.xbt - 1e-6 &&
          Math.abs(ya - g.yG(xa)) < 1e-6 &&
          Math.abs(yb - g.yG(xb)) < 1e-6,
      );
      for (let k = 1; k <= 3; k++) {
        const pF = fext.slice();
        for (let d = 0; d < nd; d++) fext[d] += fq[d] / 3;
        step('S3 bước ' + k, pF);
      }
    }
    rec(qq > 0 ? 'S3 – tải trọng q' : 'S3 – không có tải q (giữ nguyên S2)', 0, 0);
    const fext3 = fext.slice(),
      base3 = { u: S.u.slice(), sig: S.sig0.slice() };
    const EQ = M.E;
    let kh = 0,
      kv = 0;
    if (EQ && (EQ.kh || EQ.kv)) {
      kh = EQ.kh || 0;
      kv = EQ.kv || 0;
      const dF = new Float64Array(nd);
      S.body(mWB, dF, -kh, kv);
      for (let k = 1; k <= 2; k++) {
        const pF = fext.slice();
        for (let d = 0; d < nd; d++) fext[d] += dF[d] / 2;
        step('S4 bước ' + k, pF);
      }
      rec('S4 – động đất giả tĩnh', kh, kv);
      notes.push(
        'Động đất giả tĩnh : kh = ' +
          kh.toFixed(3) +
          ' (về phía mũi), kv = ' +
          kv.toFixed(3) +
          ' (hướng lên) tác dụng lên tường + đất đắp.',
      );
    }
    const lvl = new Float32Array(ne),
      lvg = new Float32Array(3 * ne);
    for (let e = 0; e < ne; e++) {
      const m = mats[mat[e]];
      if (m.el || !S.act[e]) {
        lvl[e] = -1;
        lvg[3 * e] = lvg[3 * e + 1] = lvg[3 * e + 2] = -1;
        continue;
      }
      let sm = 0;
      for (let q = 0; q < 3; q++) {
        const o = e * 12 + q * 4,
          pp = S.pw ? S.pw[3 * e + q] : 0,
          sx = S.sig[o] + pp,
          sy = S.sig[o + 1] + pp,
          tx = S.sig[o + 2],
          sz = S.sig[o + 3] + pp;
        const pc = 0.5 * (sx + sy),
          dd = 0.5 * (sx - sy),
          rr = Math.sqrt(dd * dd + tx * tx),
          a = -(pc + rr),
          b = -(pc - rr),
          c = -sz,
          s1 = Math.max(a, b, c),
          s3 = Math.min(a, b, c);
        const den = (s1 + s3) * m.sinP + 2 * m.c * m.cosP;
        let v = den > 1e-9 ? (s1 - s3) / den : s1 - s3 > 1e-9 ? 1 : 0;
        if (S.yld[3 * e + q] || s3 < -1e-7) v = 1;
        v = Math.max(0, Math.min(1, v));
        sm += v;
        lvg[3 * e + q] = v;
      }
      lvl[e] = sm / 3;
    }
    const uOut: Point2D[] = [],
      uTr: Point2D[] = [],
      plastic: Point2D[] = [];
    for (let i = 0; i < nn; i++) {
      uOut.push([S.u[2 * i], S.u[2 * i + 1]]);
      uTr.push([S.u[2 * i] + off[2 * i], S.u[2 * i + 1] + off[2 * i + 1]]);
    }
    for (let i = 0; i < 3 * ne; i++)
      if (S.yld[i] && S.act[(i / 3) | 0]) plastic.push([S.gx[i], S.gy[i]]);
    const last = { u: S.u.slice(), sig: S.sig0.slice() };
    const S5 = opt.noSrm
      ? { FS: null, du: new Float64Array(nd), trials: 0, its: 0, skipped: true }
      : Object.assign(
          srm(
            S,
            mats,
            opt.srmEq && kh + kv > 0 ? last : base3,
            opt.srmEq && kh + kv > 0 ? fext : fext3,
            { umax: 0.3 * Math.max(M.H, 3), Fmax: opt.Fmax || 6, maxIt: opt.srmIt || 60 },
          ),
          { skipped: false },
        );
    if (S5.FS == null && !S5.skipped)
      warn.push(
        'SRM: không hội tụ ngay cả với F = 1 (hệ số an toàn < 1 hoặc giai đoạn cuối chưa cân bằng).',
      );
    if (S5.skipped) notes.pop();
    const uS: Point2D[] = [];
    for (let i = 0; i < nn; i++) uS.push([S5.du[2 * i], S5.du[2 * i + 1]]);
    let mech: { w: number; h: number; local: boolean } | null = null;
    if (S5.FS != null) {
      let mx = 0;
      const mg = uS.map((v) => Math.hypot(v[0], v[1]));
      mg.forEach((v) => {
        if (v > mx) mx = v;
      });
      let x0 = 1e9,
        x1 = -1e9,
        y0 = 1e9,
        y1 = -1e9;
      mg.forEach((v, i) => {
        if (v >= 0.5 * mx && mx > 0) {
          x0 = Math.min(x0, X[i]);
          x1 = Math.max(x1, X[i]);
          y0 = Math.min(y0, Y[i]);
          y1 = Math.max(y1, Y[i]);
        }
      });
      if (mx > 0) {
        const w = x1 - x0,
          h = y1 - y0;
        mech = { w, h, local: Math.max(w, h) < 0.3 * M.H };
      }
    }
    let um = 0,
      ux = 0,
      uy = 0,
      ui = 0;
    for (let i = 0; i < nn; i++) {
      const v = Math.hypot(uOut[i][0], uOut[i][1]);
      if (v > um) {
        um = v;
        ui = i;
      }
    }
    ux = X[ui];
    uy = Y[ui];
    const nodes: Point2D[] = [],
      tris: number[][] = [];
    for (let i = 0; i < nn; i++) nodes.push([X[i], Y[i]]);
    for (let e = 0; e < ne; e++) tris.push(Array.from(Tn.subarray(6 * e, 6 * e + 6)));
    return {
      ok: allOk && stages.every((s) => isFinite(s.thrust) && isFinite(s.uTop[0])),
      FSsrm: S5.FS,
      stages,
      mesh: { nodes, tris, mat: Array.from(mat), nx: mesh.nx, ny: mesh.ny },
      u: uOut,
      uT: uTr,
      plastic,
      uSRM: uS,
      lvl: Array.from(lvl, (v) => Math.round(v * 1e3) / 1e3),
      lvg: Array.from(lvg, (v) => Math.round(v * 1e3) / 1e3),
      water: wInfo,
      time_ms: Date.now() - T0,
      notes,
      warn,
      mech,
      umax: { v: um * 1e3, x: ux, y: uy },
      mats: mats.map((m) => ({
        E: m.E,
        nu: m.nu,
        c: m.c0,
        phi: m.phi0,
        psi: m.psi,
        gam: m.gam,
        K0: m.K0,
        el: !!m.el,
      })),
      model: {
        rock: M.rock,
        clay: M.clay,
        H: M.H,
        B,
        Df,
        Lf: M.Lf,
        Lb: M.Lb,
        Dd: M.Dd,
        kh,
        kv,
        q: qq,
      },
      info: {
        ne,
        nn,
        neq: S.neq,
        nfac: S.nfac,
        hw: M.hw,
        srmTrials: S5.trials,
        srmIt: S5.its,
        Dd: M.Dd,
        Lf: M.Lf,
      },
      dbg: opt.debug
        ? {
            sig: S.sig0.slice(),
            pw: S.pw ? S.pw.slice() : null,
            gx: S.gx,
            gy: S.gy,
            mat: Array.from(mat),
            ne,
            yld: S.yld.slice(),
            u: S.u.slice(),
            X,
            Y,
            T: Tn,
          }
        : undefined,
    };
  }

  const PK_I: (keyof EngineCalcInputParams)[] = [
    'rock',
    'soil',
    'Su',
    'ht',
    'hf',
    'Hs',
    'm',
    'cf',
    'phif',
    'cs',
    'phi',
    'gs',
    'gc',
    'cR',
    'phiR',
    'gR',
    'gf',
    'gsat',
    'gfs',
    'q',
    'qL',
  ];
  const PK_G = ['yT', 'yF', 'B', 'xfb', 'xft', 'xbb', 'xbt'] as const;

  function pack(R: Fem2dRLike, opt?: Fem2dPackOptions): Fem2dPackInput {
    const I: Record<string, unknown> = {},
      g: Record<string, unknown> = {};
    PK_I.forEach((k) => {
      I[k as string] = R.I[k];
    });
    PK_G.forEach((k) => {
      g[k] = R.g[k];
    });
    g.foot = R.g.foot.map((p): Point2D => [p[0], p[1]]);
    g.stem = R.g.stem.map((p): Point2D => [p[0], p[1]]);
    return {
      I: I as Partial<EngineCalcInputParams>,
      g: g as Fem2dPackInput['g'],
      Ec: R.M && R.M.Ec ? R.M.Ec : 0,
      E: R.E ? { kh: R.E.kh || 0, kv: R.E.kv || 0 } : null,
      opt: Object.assign({}, opt || {}),
    };
  }

  function unpack(m: Fem2dPackInput): Fem2dRLike {
    const I = m.I,
      yG = (x: number) =>
        x <= m.g.xbt
          ? m.g.yT
          : m.g.yT +
            (I.Hs && I.Hs > 1e-9 ? Math.min(I.Hs, (x - m.g.xbt) / Math.max(I.m || 0, 1e-9)) : 0);
    return {
      I,
      g: Object.assign({}, m.g, { yG }),
      M: m.Ec ? { Ec: m.Ec } : null,
      E: m.E,
    };
  }

  function job(m: Fem2dPackInput): Fem2dJobOutput {
    const res = run(unpack(m), m.opt as Fem2dRunOptions),
      fo = { width: 760 },
      figs = m.opt.raw ? null : { plastic: svgPlastic(res, fo) };
    const opt: Record<string, unknown> = { ...(m.opt as object) };
    delete opt.water;
    if (m.opt.water)
      opt.water = { hB: m.opt.water.hB, hF: m.opt.water.hF, Tn: m.opt.water.Tn };
    const out: Fem2dJobOutput = {
      ok: res.ok,
      FSsrm: res.FSsrm,
      stages: res.stages,
      time_ms: res.time_ms,
      notes: res.notes,
      warn: res.warn,
      mech: res.mech,
      umax: res.umax,
      mats: res.mats,
      model: res.model,
      info: res.info,
      nPlastic: res.plastic.length,
      figs,
      opt,
      water: res.water,
    };
    if (m.opt.raw)
      out.raw = {
        mesh: res.mesh,
        u: res.u,
        uT: res.uT,
        plastic: res.plastic,
        uSRM: res.uSRM,
        lvl: res.lvl,
        lvg: res.lvg,
      };
    return out;
  }

  return {
    run,
    job,
    pack,
    unpack,
    srm,
    svgPlastic,
    buildMesh,
    Engine,
    mcMake,
    mcSet,
    mcUpd,
    modelFromR,
    edgeLoad,
    edgeP,
    hatProfile,
    inPoly,
    gradedLines,
    domain,
    mkWater,
    ST,
  };
};

export const FEM2D = FEM2D_MAKE();
export type Fem2dApi = ReturnType<typeof FEM2D_MAKE>;
