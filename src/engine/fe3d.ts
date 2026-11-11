/**
 * 3D 4-node MITC4 + Taylor/Wilson incompatible shell FE engine (`FE3D`)
 * with 6-component Jacobi rigid-body check, RCM bandwidth reduction, and
 * skyline Cholesky solver, ported faithfully from `12_fe3d_shell.js`.
 */

import type { Point3D } from './types.ts';

export interface Fe3dElementData {
  K: Float64Array;
  S: Float64Array;
  e1: number[];
  e2: number[];
  e3: number[];
  c: number[];
  area: number;
  wN: number[];
  t: number;
  tri: boolean;
  n: [number, number, number, number];
  E: number;
  nu: number;
}

export interface Fe3dStats {
  nNodes: number;
  nElems: number;
  nDof: number;
  nFree: number;
  halfBand: number;
  profile: number;
  cholFlops: number;
}

export interface Fe3dElementForce {
  Nxx: number;
  Nyy: number;
  Nxy: number;
  Mxx: number;
  Myy: number;
  Mxy: number;
  Qx: number;
  Qy: number;
  cx: number;
  cy: number;
  cz: number;
  e1: number[];
  e2: number[];
  e3: number[];
  t: number;
  area: number;
}

export interface Fe3dNodeForce {
  n: number;
  x: number;
  y: number;
  z: number;
  e1: number[];
  e2: number[];
  e3: number[];
  Nxx: number;
  Nyy: number;
  Nxy: number;
  Mxx: number;
  Myy: number;
  Mxy: number;
  Qx: number;
  Qy: number;
}

export interface Fe3dModel {
  xyz: Point3D[];
  elems: Fe3dElementData[];
  readonly nNodes: number;
  readonly nElems: number;
  stats: Fe3dStats | null;
  node: (x: number, y: number, z: number) => number;
  shell: (a: number, b: number, c: number, d: number | null | undefined, t: number, E: number, nu: number) => number;
  tri: (a: number, b: number, c: number, t: number, E: number, nu: number) => number;
  fix: (n: number, f: boolean | 'all' | ArrayLike<number | boolean>) => void;
  zeros: () => Float64Array;
  addNodal: (F: Float64Array, n: number, f: ArrayLike<number>) => void;
  addPressure: (F: Float64Array, e: number, p: ArrayLike<number>) => void;
  addBody: (F: Float64Array, e: number, g: ArrayLike<number>) => void;
  elementStiffness: (e: number) => Float64Array;
  factor: () => Fe3dStats;
  solve: (F: Float64Array) => Float64Array;
  reactions: (F: Float64Array, U: Float64Array) => Float64Array;
  forces: (U: Float64Array) => Fe3dElementForce[];
  nodeForces: (U: Float64Array, sel?: number[]) => Fe3dNodeForce[];
}

export const FE3D = (() => {
  const GP = 0.5773502691896258,
    XI = [-1, 1, 1, -1],
    ET = [-1, -1, 1, 1],
    DOFN = ['ux', 'uy', 'uz', 'rx', 'ry', 'rz'];
  const dot3 = (a: number[], b: number[]): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross3 = (a: number[], b: number[]): number[] => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const unit3 = (a: number[], tol: number): number[] | null => {
    const l = Math.hypot(a[0], a[1], a[2]);
    return l > tol ? [a[0] / l, a[1] / l, a[2] / l] : null;
  };

  function frame(P: Point3D[]) {
    const d = (i: number, j: number) => [P[j][0] - P[i][0], P[j][1] - P[i][1], P[j][2] - P[i][2]];
    const d13 = d(0, 2),
      d24 = d(1, 3),
      sc = Math.max(Math.hypot(d13[0], d13[1], d13[2]), Math.hypot(d24[0], d24[1], d24[2]));
    const e3 = unit3(cross3(d13, d24), 1e-12 * sc * sc);
    if (!e3) return null;
    let e1: number[] | null = null;
    for (const [i, j] of [
      [0, 1],
      [3, 2],
      [1, 2],
      [0, 3],
      [0, 2],
    ]) {
      const v = d(i, j),
        s = dot3(v, e3);
      e1 = unit3([v[0] - s * e3[0], v[1] - s * e3[1], v[2] - s * e3[2]], 1e-6 * sc);
      if (e1) break;
    }
    if (!e1) return null;
    const e2 = cross3(e3, e1),
      c = [0, 1, 2].map((k) => (P[0][k] + P[1][k] + P[2][k] + P[3][k]) / 4),
      x: number[] = [],
      y: number[] = [];
    for (let i = 0; i < 4; i++) {
      const r = [P[i][0] - c[0], P[i][1] - c[1], P[i][2] - c[2]];
      x.push(dot3(r, e1));
      y.push(dot3(r, e2));
    }
    return { e1, e2, e3, c, x, y };
  }

  function inv4(M: Float64Array): Float64Array {
    const A = Array.from(M),
      I = new Float64Array(16);
    for (let i = 0; i < 4; i++) I[i * 5] = 1;
    for (let c = 0; c < 4; c++) {
      let p = c;
      for (let r = c + 1; r < 4; r++) if (Math.abs(A[r * 4 + c]) > Math.abs(A[p * 4 + c])) p = r;
      if (p !== c)
        for (let k = 0; k < 4; k++) {
          let t = A[c * 4 + k];
          A[c * 4 + k] = A[p * 4 + k];
          A[p * 4 + k] = t;
          t = I[c * 4 + k];
          I[c * 4 + k] = I[p * 4 + k];
          I[p * 4 + k] = t;
        }
      const d = A[c * 4 + c];
      for (let k = 0; k < 4; k++) {
        A[c * 4 + k] /= d;
        I[c * 4 + k] /= d;
      }
      for (let r = 0; r < 4; r++)
        if (r !== c) {
          const f = A[r * 4 + c];
          if (f)
            for (let k = 0; k < 4; k++) {
              A[r * 4 + k] -= f * A[c * 4 + k];
              I[r * 4 + k] -= f * I[c * 4 + k];
            }
        }
    }
    return I;
  }

  function shellElem(P: Point3D[], t: number, E: number, nu: number, kap: number, drill: number) {
    const F = frame(P);
    if (!F) throw new Error('phần tử suy biến (diện tích = 0 hoặc nút trùng nhau)');
    const X = F.x,
      Y = F.y,
      G = E / (2 * (1 + nu));
    const geo = (xi: number, et: number) => {
      const N: number[] = [],
        Nxi: number[] = [],
        Net: number[] = [],
        Nx: number[] = [],
        Ny: number[] = [];
      let xx = 0,
        yx = 0,
        xe = 0,
        ye = 0;
      for (let i = 0; i < 4; i++) {
        const a = 1 + XI[i] * xi,
          b = 1 + ET[i] * et;
        N[i] = (a * b) / 4;
        Nxi[i] = (XI[i] * b) / 4;
        Net[i] = (ET[i] * a) / 4;
        xx += Nxi[i] * X[i];
        yx += Nxi[i] * Y[i];
        xe += Net[i] * X[i];
        ye += Net[i] * Y[i];
      }
      const det = xx * ye - yx * xe;
      for (let i = 0; i < 4; i++) {
        Nx[i] = (ye * Nxi[i] - yx * Net[i]) / det;
        Ny[i] = (xx * Net[i] - xe * Nxi[i]) / det;
      }
      return { xi, et, N, Nxi, Net, Nx, Ny, xx, yx, xe, ye, det };
    };
    const g0 = geo(0, 0),
      gp = [
        [-GP, -GP],
        [GP, -GP],
        [GP, GP],
        [-GP, GP],
      ].map((q) => geo(q[0], q[1]));
    let area = 0;
    const wN = [0, 0, 0, 0];
    for (const g of gp) {
      if (!(g.det > 0)) throw new Error('phần tử bị lật / không lồi (det J ≤ 0)');
      area += g.det;
      for (let i = 0; i < 4; i++) wN[i] += g.N[i] * g.det;
    }
    let lmin = 1e300;
    for (let i = 0; i < 4; i++)
      lmin = Math.min(lmin, (X[(i + 1) % 4] - X[i]) ** 2 + (Y[(i + 1) % 4] - Y[i]) ** 2);
    const tri = lmin < 1e-10 * area;
    const d1 = (E * t) / (1 - nu * nu),
      d2 = nu * d1,
      d3 = (d1 * (1 - nu)) / 2;
    const Kuu = new Float64Array(64),
      Kua = new Float64Array(32),
      Kaa = new Float64Array(16);
    for (const g of gp) {
      const w = g.det,
        B = new Float64Array(24),
        Ba = new Float64Array(12),
        DB = new Float64Array(24),
        DBa = new Float64Array(12);
      for (let i = 0; i < 4; i++) {
        B[2 * i] = g.Nx[i];
        B[8 + 2 * i + 1] = g.Ny[i];
        B[16 + 2 * i] = g.Ny[i];
        B[16 + 2 * i + 1] = g.Nx[i];
      }
      const a1x = (-2 * g.xi * g0.ye) / g.det,
        a1y = (2 * g.xi * g0.xe) / g.det,
        a2x = (2 * g.et * g0.yx) / g.det,
        a2y = (-2 * g.et * g0.xx) / g.det;
      Ba.set([a1x, a2x, 0, 0, 0, 0, a1y, a2y, a1y, a2y, a1x, a2x]);
      for (let j = 0; j < 8; j++) {
        DB[j] = d1 * B[j] + d2 * B[8 + j];
        DB[8 + j] = d2 * B[j] + d1 * B[8 + j];
        DB[16 + j] = d3 * B[16 + j];
      }
      for (let j = 0; j < 4; j++) {
        DBa[j] = d1 * Ba[j] + d2 * Ba[4 + j];
        DBa[4 + j] = d2 * Ba[j] + d1 * Ba[4 + j];
        DBa[8 + j] = d3 * Ba[8 + j];
      }
      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++)
          Kuu[i * 8 + j] += w * (B[i] * DB[j] + B[8 + i] * DB[8 + j] + B[16 + i] * DB[16 + j]);
        for (let j = 0; j < 4; j++)
          Kua[i * 4 + j] += w * (B[i] * DBa[j] + B[8 + i] * DBa[4 + j] + B[16 + i] * DBa[8 + j]);
      }
      for (let i = 0; i < 4; i++)
        for (let j = 0; j < 4; j++)
          Kaa[i * 4 + j] += w * (Ba[i] * DBa[j] + Ba[4 + i] * DBa[4 + j] + Ba[8 + i] * DBa[8 + j]);
    }
    let Km = Kuu;
    if (!tri) {
      const Ki = inv4(Kaa),
        T = new Float64Array(32);
      for (let i = 0; i < 8; i++)
        for (let j = 0; j < 4; j++) {
          let s = 0;
          for (let k = 0; k < 4; k++) s += Kua[i * 4 + k] * Ki[k * 4 + j];
          T[i * 4 + j] = s;
        }
      Km = Float64Array.from(Kuu);
      for (let i = 0; i < 8; i++)
        for (let j = 0; j < 8; j++) {
          let s = 0;
          for (let k = 0; k < 4; k++) s += T[i * 4 + k] * Kua[j * 4 + k];
          Km[i * 8 + j] -= s;
        }
    }
    const D = (E * t * t * t) / (12 * (1 - nu * nu)),
      b1 = D,
      b2 = nu * D,
      b3 = (D * (1 - nu)) / 2,
      cs = kap * G * t;
    const tie = (xi: number, et: number) => {
      const g = geo(xi, et),
        bx = new Float64Array(12),
        be = new Float64Array(12);
      for (let i = 0; i < 4; i++) {
        bx[3 * i] = g.Nxi[i];
        bx[3 * i + 1] = -g.yx * g.N[i];
        bx[3 * i + 2] = g.xx * g.N[i];
        be[3 * i] = g.Net[i];
        be[3 * i + 1] = -g.ye * g.N[i];
        be[3 * i + 2] = g.xe * g.N[i];
      }
      return { bx, be };
    };
    const tA = tie(0, 1),
      tB = tie(-1, 0),
      tC = tie(0, -1),
      tD = tie(1, 0);
    const Bshear = (g: ReturnType<typeof geo>) => {
      const B = new Float64Array(24);
      for (let k = 0; k < 12; k++) {
        const bx = 0.5 * (1 + g.et) * tA.bx[k] + 0.5 * (1 - g.et) * tC.bx[k],
          be = 0.5 * (1 + g.xi) * tD.be[k] + 0.5 * (1 - g.xi) * tB.be[k];
        B[k] = (g.ye * bx - g.yx * be) / g.det;
        B[12 + k] = (g.xx * be - g.xe * bx) / g.det;
      }
      return B;
    };
    const Kp = new Float64Array(144);
    for (const g of gp) {
      const w = g.det,
        B = new Float64Array(36),
        S = Bshear(g);
      for (let i = 0; i < 4; i++) {
        B[3 * i + 2] = g.Nx[i];
        B[12 + 3 * i + 1] = -g.Ny[i];
        B[24 + 3 * i + 1] = -g.Nx[i];
        B[24 + 3 * i + 2] = g.Ny[i];
      }
      for (let i = 0; i < 12; i++)
        for (let j = 0; j < 12; j++)
          Kp[i * 12 + j] +=
            w *
            (B[i] * (b1 * B[j] + b2 * B[12 + j]) +
              B[12 + i] * (b2 * B[j] + b1 * B[12 + j]) +
              B[24 + i] * b3 * B[24 + j] +
              cs * (S[i] * S[j] + S[12 + i] * S[12 + j]));
    }
    const Kl = new Float64Array(576);
    for (let i = 0; i < 4; i++)
      for (let a = 0; a < 2; a++)
        for (let j = 0; j < 4; j++)
          for (let b = 0; b < 2; b++)
            Kl[(6 * i + a) * 24 + 6 * j + b] += Km[(2 * i + a) * 8 + 2 * j + b];
    for (let i = 0; i < 4; i++)
      for (let a = 0; a < 3; a++)
        for (let j = 0; j < 4; j++)
          for (let b = 0; b < 3; b++)
            Kl[(6 * i + 2 + a) * 24 + 6 * j + 2 + b] += Kp[(3 * i + a) * 12 + 3 * j + b];
    const kd = (drill * G * t * area) / 4;
    for (let i = 0; i < 4; i++) {
      const idx: number[] = [],
        val: number[] = [];
      for (let j = 0; j < 4; j++) {
        const jp = (j + 1) % 4,
          jm = (j + 3) % 4;
        idx.push(6 * j, 6 * j + 1);
        val.push(-(X[jp] - X[jm]) / (4 * area), -(Y[jp] - Y[jm]) / (4 * area));
      }
      idx.push(6 * i + 5);
      val.push(1);
      for (let a = 0; a < idx.length; a++)
        for (let b = 0; b < idx.length; b++) Kl[idx[a] * 24 + idx[b]] += kd * val[a] * val[b];
    }
    const Sl = new Float64Array(192),
      B0 = Bshear(g0);
    for (let i = 0; i < 4; i++) {
      const nx = g0.Nx[i],
        ny = g0.Ny[i];
      Sl[6 * i] = d1 * nx;
      Sl[6 * i + 1] = d2 * ny;
      Sl[24 + 6 * i] = d2 * nx;
      Sl[24 + 6 * i + 1] = d1 * ny;
      Sl[48 + 6 * i] = d3 * ny;
      Sl[48 + 6 * i + 1] = d3 * nx;
      Sl[72 + 6 * i + 4] = b1 * nx;
      Sl[72 + 6 * i + 3] = -b2 * ny;
      Sl[96 + 6 * i + 4] = b2 * nx;
      Sl[96 + 6 * i + 3] = -b1 * ny;
      Sl[120 + 6 * i + 4] = b3 * ny;
      Sl[120 + 6 * i + 3] = -b3 * nx;
      for (let k = 0; k < 3; k++) {
        Sl[144 + 6 * i + 2 + k] = cs * B0[3 * i + k];
        Sl[168 + 6 * i + 2 + k] = cs * B0[12 + 3 * i + k];
      }
    }
    const R = [F.e1[0], F.e2[0], F.e3[0], F.e1[1], F.e2[1], F.e3[1], F.e1[2], F.e2[2], F.e3[2]];
    const K = new Float64Array(576),
      S = new Float64Array(192),
      tmp = new Float64Array(9);
    for (let I = 0; I < 8; I++)
      for (let J = 0; J < 8; J++) {
        for (let a = 0; a < 3; a++)
          for (let c = 0; c < 3; c++) {
            let s = 0;
            for (let b = 0; b < 3; b++) s += Kl[(3 * I + a) * 24 + 3 * J + b] * R[3 * c + b];
            tmp[3 * a + c] = s;
          }
        for (let a = 0; a < 3; a++)
          for (let c = 0; c < 3; c++) {
            let s = 0;
            for (let k = 0; k < 3; k++) s += R[3 * a + k] * tmp[3 * k + c];
            K[(3 * I + a) * 24 + 3 * J + c] = s;
          }
      }
    for (let r = 0; r < 8; r++)
      for (let J = 0; J < 8; J++)
        for (let c = 0; c < 3; c++) {
          let s = 0;
          for (let b = 0; b < 3; b++) s += Sl[r * 24 + 3 * J + b] * R[3 * c + b];
          S[r * 24 + 3 * J + c] = s;
        }
    return { K, S, e1: F.e1, e2: F.e2, e3: F.e3, c: F.c, area, wN, t, tri };
  }

  function rcm(nN: number, conn: number[][]): number[] {
    const adj = Array.from({ length: nN }, () => new Set<number>());
    for (const c of conn) for (const a of c) for (const b of c) if (a !== b) adj[a].add(b);
    const nb = adj.map((s) => Array.from(s)),
      deg = nb.map((a) => a.length),
      stamp = new Int32Array(nN).fill(-1),
      lev = new Int32Array(nN),
      comp = new Int32Array(nN).fill(-1);
    const pos = new Int32Array(nN),
      fN = new Int32Array(nN);
    let sid = 0;
    const levels = (r: number) => {
      const id = ++sid,
        q = [r];
      stamp[r] = id;
      lev[r] = 0;
      for (let h = 0; h < q.length; h++) {
        const v = q[h];
        for (const w of nb[v])
          if (stamp[w] !== id) {
            stamp[w] = id;
            lev[w] = lev[v] + 1;
            q.push(w);
          }
      }
      return q;
    };
    const periph = (s0: number) => {
      let q = levels(s0),
        r = q[0];
      for (const v of q) if (deg[v] < deg[r]) r = v;
      q = levels(r);
      let e = lev[q[q.length - 1]];
      for (let it = 0; it < 20; it++) {
        let c = q[q.length - 1];
        for (let k = q.length - 1; k >= 0 && lev[q[k]] === e; k--) if (deg[q[k]] < deg[c]) c = q[k];
        const q2 = levels(c),
          e2 = lev[q2[q2.length - 1]];
        if (e2 <= e) break;
        r = c;
        q = q2;
        e = e2;
      }
      return r;
    };
    const cm = (r: number) => {
      const id = ++sid,
        out = [r];
      stamp[r] = id;
      for (let h = 0; h < out.length; h++) {
        const cand: number[] = [];
        for (const w of nb[out[h]])
          if (stamp[w] !== id) {
            stamp[w] = id;
            cand.push(w);
          }
        cand.sort((a, b) => deg[a] - deg[b]);
        for (const w of cand) out.push(w);
      }
      return out;
    };
    const cost = (ord: number[], els: number[][]) => {
      const len = ord.length;
      ord.forEach((n, k) => {
        pos[n] = k;
      });
      for (let k = 0; k < len; k++) fN[k] = k;
      for (const c of els) {
        let mn = len;
        for (const n of c) if (pos[n] < mn) mn = pos[n];
        for (const n of c) if (fN[pos[n]] > mn) fN[pos[n]] = mn;
      }
      let s = 0;
      for (let i = 0; i < len; i++)
        for (let j = fN[i]; j < i; j++) s += i - (fN[j] > fN[i] ? fN[j] : fN[i]);
      return s;
    };
    const comps: number[][] = [];
    for (let s0 = 0; s0 < nN; s0++)
      if (comp[s0] < 0) {
        const q = levels(s0);
        q.forEach((v) => {
          comp[v] = comps.length;
        });
        comps.push(q);
      }
    const elOf: number[][][] = comps.map(() => []);
    for (const c of conn) elOf[comp[c[0]]].push(c);
    const order: number[] = [];
    comps.forEach((q0, ic) => {
      const tried = new Set<number>();
      let best: { c: number; o: number[] } | null = null;
      const tryStart = (r: number) => {
        if (tried.has(r)) return;
        tried.add(r);
        const o = cm(r).reverse(),
          c = q0.length < 40 ? 0 : cost(o, elOf[ic]);
        if (!best || c < best.c) best = { c, o };
      };
      tryStart(periph(q0[0]));
      if (q0.length >= 40)
        for (let t = 0; t < 24; t++) {
          const s = q0[Math.floor(((t + 0.5) * q0.length) / 24)];
          tryStart(s);
          tryStart(periph(s));
        }
      for (const v of best!.o) order.push(v);
    });
    return order;
  }

  function skyChol(
    nf: number,
    f: Int32Array,
    ptr: Int32Array,
    A: Float64Array,
    inv: Float64Array,
    dg: Float64Array,
  ): number {
    for (let i = 0; i < nf; ) {
      const fi = f[i],
        pi = ptr[i] - fi,
        two = i + 1 < nf && f[i + 1] === fi,
        qi = two ? ptr[i + 1] - fi : 0;
      for (let j = fi; j < i; ) {
        const fj = f[j],
          pj = ptr[j] - fj,
          k0 = fi > fj ? fi : fj;
        if (two && j + 1 < i && f[j + 1] === fj) {
          const pj1 = ptr[j + 1] - fj;
          let s11 = A[pi + j],
            s12 = A[pi + j + 1],
            s21 = A[qi + j],
            s22 = A[qi + j + 1];
          for (let k = k0; k < j; k++) {
            const a1 = A[pi + k],
              a2 = A[qi + k],
              b1 = A[pj + k],
              b2 = A[pj1 + k];
            s11 -= a1 * b1;
            s12 -= a1 * b2;
            s21 -= a2 * b1;
            s22 -= a2 * b2;
          }
          const l11 = s11 * inv[j],
            l21 = s21 * inv[j],
            t = A[pj1 + j];
          A[pi + j] = l11;
          A[qi + j] = l21;
          A[pi + j + 1] = (s12 - l11 * t) * inv[j + 1];
          A[qi + j + 1] = (s22 - l21 * t) * inv[j + 1];
          j += 2;
        } else {
          let s1 = A[pi + j],
            s2 = two ? A[qi + j] : 0;
          if (two) {
            for (let k = k0; k < j; k++) {
              const b = A[pj + k];
              s1 -= A[pi + k] * b;
              s2 -= A[qi + k] * b;
            }
            A[qi + j] = s2 * inv[j];
          } else for (let k = k0; k < j; k++) s1 -= A[pi + k] * A[pj + k];
          A[pi + j] = s1 * inv[j];
          j++;
        }
      }
      let d = A[pi + i];
      for (let k = fi; k < i; k++) d -= A[pi + k] * A[pi + k];
      if (!(d > 1e-10 * dg[i])) return i;
      const r = Math.sqrt(d);
      A[pi + i] = r;
      inv[i] = 1 / r;
      if (!two) {
        i++;
        continue;
      }
      let s = A[qi + i];
      for (let k = fi; k < i; k++) s -= A[qi + k] * A[pi + k];
      s *= inv[i];
      A[qi + i] = s;
      let d2 = A[qi + i + 1] - s * s;
      for (let k = fi; k < i; k++) d2 -= A[qi + k] * A[qi + k];
      if (!(d2 > 1e-10 * dg[i + 1])) return i + 1;
      const r2 = Math.sqrt(d2);
      A[qi + i + 1] = r2;
      inv[i + 1] = 1 / r2;
      i += 2;
    }
    return -1;
  }

  function eig6(A: Float64Array) {
    const n = 6,
      a = Float64Array.from(A),
      V = new Float64Array(36);
    for (let i = 0; i < n; i++) V[i * 7] = 1;
    for (let sw = 0; sw < 60; sw++) {
      let off = 0;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += a[i * n + j] ** 2;
      if (off < 1e-30) break;
      for (let p = 0; p < n; p++)
        for (let q = p + 1; q < n; q++) {
          const apq = a[p * n + q];
          if (Math.abs(apq) < 1e-300) continue;
          const th = (a[q * n + q] - a[p * n + p]) / (2 * apq),
            t = (th < 0 ? -1 : 1) / (Math.abs(th) + Math.sqrt(th * th + 1)),
            c = 1 / Math.sqrt(t * t + 1),
            s = t * c;
          for (let k = 0; k < n; k++) {
            const x = a[k * n + p],
              y = a[k * n + q];
            a[k * n + p] = c * x - s * y;
            a[k * n + q] = s * x + c * y;
          }
          for (let k = 0; k < n; k++) {
            const x = a[p * n + k],
              y = a[q * n + k];
            a[p * n + k] = c * x - s * y;
            a[q * n + k] = s * x + c * y;
          }
          for (let k = 0; k < n; k++) {
            const x = V[k * n + p],
              y = V[k * n + q];
            V[k * n + p] = c * x - s * y;
            V[k * n + q] = s * x + c * y;
          }
        }
    }
    return { w: Array.from({ length: n }, (_, i) => a[i * n + i]), V };
  }

  function rigidCheck(xyz: Point3D[], fixd: Uint8Array[], el: Fe3dElementData[]): string | null {
    const nN = xyz.length,
      par = Int32Array.from({ length: nN }, (_, i) => i),
      used = new Uint8Array(nN),
      groups = new Map<number, number[]>();
    const find = (a: number) => {
      while (par[a] !== a) {
        par[a] = par[par[a]];
        a = par[a];
      }
      return a;
    };
    for (const e of el)
      for (let i = 0; i < 4; i++) {
        used[e.n[i]] = 1;
        par[find(e.n[i])] = find(e.n[0]);
      }
    for (let n = 0; n < nN; n++)
      if (used[n]) {
        const r = find(n);
        if (!groups.has(r)) groups.set(r, []);
        groups.get(r)!.push(n);
      }
    for (const nodes of groups.values()) {
      const c = [0, 1, 2].map((k) => nodes.reduce((s, n) => s + xyz[n][k], 0) / nodes.length);
      let L = 0;
      for (const n of nodes)
        L = Math.max(L, Math.hypot(xyz[n][0] - c[0], xyz[n][1] - c[1], xyz[n][2] - c[2]));
      if (!(L > 0)) L = 1;
      const G = new Float64Array(36);
      for (const n of nodes) {
        const r = [(xyz[n][0] - c[0]) / L, (xyz[n][1] - c[1]) / L, (xyz[n][2] - c[2]) / L],
          X = [
            [0, -r[2], r[1]],
            [r[2], 0, -r[0]],
            [-r[1], r[0], 0],
          ];
        for (let d = 0; d < 6; d++)
          if (fixd[n][d]) {
            const row = [0, 0, 0, 0, 0, 0];
            if (d < 3) {
              row[d] = 1;
              for (let k = 0; k < 3; k++) row[3 + k] = X[k][d];
            } else row[d] = 1;
            for (let a = 0; a < 6; a++)
              if (row[a]) for (let b = 0; b < 6; b++) G[a * 6 + b] += row[a] * row[b];
          }
      }
      const { w, V } = eig6(G);
      let k = 0;
      for (let i = 1; i < 6; i++) if (w[i] < w[k]) k = i;
      if (!(w[k] > 1e-10 * Math.max(...w))) {
        const v = [0, 1, 2, 3, 4, 5].map((a) => V[a * 6 + k]),
          f = (a: number) => +a.toFixed(2) + '';
        return (
          'FE3D: kết cấu chưa đủ liên kết để khử chuyển động thể rắn (khối ' +
          nodes.length +
          ' nút). Còn tự do: tịnh tiến (x,y,z) = (' +
          [0, 1, 2].map((i) => f(v[i])).join(', ') +
          '), xoay (quanh trục x,y,z) = (' +
          [3, 4, 5].map((i) => f(v[i])).join(', ') +
          ') [tỷ lệ tương đối] – thêm gối tựa / kiểm tra điều kiện biên (not enough supports: rigid-body mode remains)'
        );
      }
    }
    return null;
  }

  function model(opt?: { kappa?: number; drill?: number }): Fe3dModel {
    const o = opt || {};
    const kap = o.kappa === undefined ? 5 / 6 : o.kappa,
      drill = o.drill === undefined ? 0.001 : o.drill;
    const xyz: Point3D[] = [],
      fixd: Uint8Array[] = [],
      el: Fe3dElementData[] = [];
    let fac: {
      nf: number;
      eq: Int32Array;
      f: Int32Array;
      ptr: Int32Array;
      A: Float64Array;
      inv: Float64Array;
    } | null = null;
    const chkN = (n: number) => {
      if (!(n >= 0 && n < xyz.length && Number.isInteger(n)))
        throw new Error('FE3D: chỉ số nút không hợp lệ: ' + n);
    };
    const chkE = (e: number) => {
      if (!(e >= 0 && e < el.length && Number.isInteger(e)))
        throw new Error('FE3D: chỉ số phần tử không hợp lệ: ' + e);
    };
    const m: Fe3dModel = {
      xyz,
      elems: el,
      get nNodes() {
        return xyz.length;
      },
      get nElems() {
        return el.length;
      },
      stats: null,
      node(x, y, z) {
        fac = null;
        xyz.push([x, y, z]);
        fixd.push(new Uint8Array(6));
        return xyz.length - 1;
      },
      shell(a, b, c, d, t, E, nu) {
        const dNode = d === undefined || d === null ? c : d;
        [a, b, c, dNode].forEach(chkN);
        if (!(t > 0 && E > 0 && nu > -1 && nu < 0.5))
          throw new Error('FE3D: t, E > 0 và -1 < ν < 0.5');
        fac = null;
        let r: Omit<Fe3dElementData, 'n' | 'E' | 'nu'>;
        try {
          r = shellElem([xyz[a], xyz[b], xyz[c], xyz[dNode]], t, E, nu, kap, drill);
        } catch (err) {
          throw new Error(
            'FE3D: phần tử #' +
              el.length +
              ' (nút ' +
              [a, b, c, dNode] +
              '): ' +
              (err as Error).message,
          );
        }
        const elem: Fe3dElementData = Object.assign(r, {
          n: [a, b, c, dNode] as [number, number, number, number],
          E,
          nu,
        });
        el.push(elem);
        return el.length - 1;
      },
      tri(a, b, c, t, E, nu) {
        return m.shell(a, b, c, c, t, E, nu);
      },
      fix(n, f) {
        chkN(n);
        fac = null;
        for (let d = 0; d < 6; d++)
          if (f === true || f === 'all' || (typeof f === 'object' && f && f[d])) fixd[n][d] = 1;
      },
      zeros() {
        return new Float64Array(6 * xyz.length);
      },
      addNodal(F, n, f) {
        chkN(n);
        for (let d = 0; d < 6; d++) F[6 * n + d] += f[d] || 0;
      },
      addPressure(F, e, p) {
        chkE(e);
        const E = el[e];
        for (let i = 0; i < 4; i++) for (let a = 0; a < 3; a++) F[6 * E.n[i] + a] += E.wN[i] * p[a];
      },
      addBody(F, e, g) {
        chkE(e);
        m.addPressure(F, e, [g[0] * el[e].t, g[1] * el[e].t, g[2] * el[e].t]);
      },
      elementStiffness(e) {
        chkE(e);
        return Float64Array.from(el[e].K);
      },
      factor() {
        const nN = xyz.length;
        if (!el.length) throw new Error('FE3D: chưa có phần tử nào');
        const used = new Uint8Array(nN);
        for (const e of el) for (const n of e.n) used[n] = 1;
        const rb = rigidCheck(xyz, fixd, el);
        if (rb) throw new Error(rb);
        const order = rcm(
            nN,
            el.map((e) => e.n),
          ),
          eq = new Int32Array(6 * nN).fill(-1),
          dofOf: number[] = [];
        let nf = 0;
        for (const n of order)
          if (used[n])
            for (let d = 0; d < 6; d++)
              if (!fixd[n][d]) {
                eq[6 * n + d] = nf++;
                dofOf.push(6 * n + d);
              }
        if (!nf) throw new Error('FE3D: mọi bậc tự do đều bị khóa');
        const f = new Int32Array(nf),
          ge = el.map((e) => {
            const q = new Int32Array(24);
            for (let i = 0; i < 4; i++)
              for (let d = 0; d < 6; d++) q[6 * i + d] = eq[6 * e.n[i] + d];
            return q;
          });
        for (let i = 0; i < nf; i++) f[i] = i;
        for (const q of ge) {
          let mn = nf;
          for (let k = 0; k < 24; k++) if (q[k] >= 0 && q[k] < mn) mn = q[k];
          for (let k = 0; k < 24; k++) if (q[k] >= 0 && f[q[k]] > mn) f[q[k]] = mn;
        }
        const ptr = new Int32Array(nf + 1);
        let hb = 0,
          flop = 0;
        for (let i = 0; i < nf; i++) {
          ptr[i + 1] = ptr[i] + i - f[i] + 1;
          if (i - f[i] > hb) hb = i - f[i];
        }
        const A = new Float64Array(ptr[nf]);
        el.forEach((e, ie) => {
          const q = ge[ie],
            K = e.K;
          for (let a = 0; a < 24; a++) {
            const ia = q[a];
            if (ia < 0) continue;
            const base = ptr[ia] - f[ia];
            for (let b = 0; b < 24; b++) {
              const ib = q[b];
              if (ib >= 0 && ib <= ia) A[base + ib] += K[a * 24 + b];
            }
          }
        });
        const dg = new Float64Array(nf),
          inv = new Float64Array(nf);
        for (let i = 0; i < nf; i++) dg[i] = A[ptr[i + 1] - 1];
        const bad = skyChol(nf, f, ptr, A, inv, dg);
        if (bad >= 0) {
          const dd = dofOf[bad],
            n = (dd / 6) | 0;
          throw new Error(
            'FE3D: kết cấu bị suy biến / thiếu liên kết (cơ cấu hoặc chuyển vị thể rắn) tại nút ' +
              n +
              ' [' +
              xyz[n].map((v) => +v.toFixed(3)) +
              '], bậc tự do ' +
              DOFN[dd % 6] +
              ' – kiểm tra điều kiện biên (singular structure, rigid-body mode)',
          );
        }
        for (let i = 0; i < nf; i++)
          for (let j = f[i]; j < i; j++) flop += i - Math.max(f[i], f[j]);
        fac = { nf, eq, f, ptr, A, inv };
        m.stats = {
          nNodes: nN,
          nElems: el.length,
          nDof: 6 * nN,
          nFree: nf,
          halfBand: hb,
          profile: ptr[nf],
          cholFlops: flop,
        };
        return m.stats;
      },
      solve(F) {
        if (!fac) throw new Error('FE3D: gọi factor() trước khi solve()');
        const { nf, eq, f, ptr, A, inv } = fac,
          b = new Float64Array(nf),
          U = new Float64Array(F.length);
        for (let d = 0; d < F.length; d++) if (eq[d] >= 0) b[eq[d]] = F[d];
        for (let i = 0; i < nf; i++) {
          const fi = f[i],
            pi = ptr[i] - fi;
          let s = b[i];
          for (let k = fi; k < i; k++) s -= A[pi + k] * b[k];
          b[i] = s * inv[i];
        }
        for (let i = nf - 1; i >= 0; i--) {
          const fi = f[i],
            pi = ptr[i] - fi,
            x = b[i] * inv[i];
          b[i] = x;
          for (let k = fi; k < i; k++) b[k] -= A[pi + k] * x;
        }
        for (let d = 0; d < F.length; d++) if (eq[d] >= 0) U[d] = b[eq[d]];
        return U;
      },
      reactions(F, U) {
        if (!fac) throw new Error('FE3D: gọi factor() trước');
        const R = new Float64Array(U.length),
          u = new Float64Array(24);
        for (const e of el) {
          for (let i = 0; i < 4; i++) for (let d = 0; d < 6; d++) u[6 * i + d] = U[6 * e.n[i] + d];
          for (let a = 0; a < 24; a++) {
            let s = 0;
            for (let b = 0; b < 24; b++) s += e.K[a * 24 + b] * u[b];
            R[6 * e.n[(a / 6) | 0] + (a % 6)] += s;
          }
        }
        for (let d = 0; d < R.length; d++) R[d] = fac.eq[d] < 0 ? R[d] - F[d] : 0;
        return R;
      },
      forces(U) {
        const u = new Float64Array(24);
        return el.map((e) => {
          for (let i = 0; i < 4; i++) for (let d = 0; d < 6; d++) u[6 * i + d] = U[6 * e.n[i] + d];
          const s: number[] = [];
          for (let r = 0; r < 8; r++) {
            let v = 0;
            for (let c = 0; c < 24; c++) v += e.S[r * 24 + c] * u[c];
            s.push(v);
          }
          return {
            Nxx: s[0],
            Nyy: s[1],
            Nxy: s[2],
            Mxx: s[3],
            Myy: s[4],
            Mxy: s[5],
            Qx: s[6],
            Qy: s[7],
            cx: e.c[0],
            cy: e.c[1],
            cz: e.c[2],
            e1: e.e1.slice(),
            e2: e.e2.slice(),
            e3: e.e3.slice(),
            t: e.t,
            area: e.area,
          };
        });
      },
      nodeForces(U, sel) {
        const all = m.forces(U),
          ids = sel || all.map((_, i) => i);
        if (!ids.length) return [];
        const ref = all[ids[0]],
          acc = new Map<number, { k: number; v: Float64Array }>(),
          K = ['Nxx', 'Nyy', 'Nxy', 'Mxx', 'Myy', 'Mxy', 'Qx', 'Qy'] as const;
        for (const ie of ids) {
          const r = all[ie],
            s = dot3(r.e3, ref.e3);
          if (Math.abs(s) < 1 - 1e-6)
            throw new Error(
              'FE3D.nodeForces: các phần tử không đồng phẳng (phần tử ' +
                ie +
                ') – hãy truyền sel = các phần tử của MỘT tấm phẳng',
            );
          const C = [
            [dot3(ref.e1, r.e1), dot3(ref.e1, r.e2)],
            [dot3(ref.e2, r.e1), dot3(ref.e2, r.e2)],
          ];
          const tr = (xx: number, yy: number, xy: number) => {
            const T = [
                [xx, xy],
                [xy, yy],
              ],
              o = [0, 0, 0];
            for (let a = 0; a < 2; a++)
              for (let b = 0; b < 2; b++)
                for (let c = 0; c < 2; c++)
                  for (let d = 0; d < 2; d++) {
                    const v = C[a][c] * T[c][d] * C[b][d];
                    if (a === 0 && b === 0) o[0] += v;
                    else if (a === 1 && b === 1) o[1] += v;
                    else if (a === 0 && b === 1) o[2] += v;
                  }
            return o;
          };
          const Nn = tr(r.Nxx, r.Nyy, r.Nxy),
            Mm = tr(r.Mxx, r.Myy, r.Mxy).map((v) => v * s);
          const Qq = [C[0][0] * r.Qx + C[0][1] * r.Qy, C[1][0] * r.Qx + C[1][1] * r.Qy].map(
              (v) => v * s,
            ),
            vals = [...Nn, ...Mm, ...Qq];
          for (const n of new Set(el[ie].n)) {
            let a = acc.get(n);
            if (!a) acc.set(n, (a = { k: 0, v: new Float64Array(8) }));
            a.k++;
            for (let i = 0; i < 8; i++) a.v[i] += vals[i];
          }
        }
        const out: Fe3dNodeForce[] = [];
        for (const [n, a] of acc) {
          const o: Record<string, unknown> = {
            n,
            x: xyz[n][0],
            y: xyz[n][1],
            z: xyz[n][2],
            e1: ref.e1,
            e2: ref.e2,
            e3: ref.e3,
          };
          K.forEach((k, i) => {
            o[k] = a.v[i] / a.k;
          });
          out.push(o as unknown as Fe3dNodeForce);
        }
        return out.sort((p, q) => p.n - q.n);
      },
    };
    return m;
  }

  function inAxes(r: Fe3dElementForce, a1: number[]): Fe3dElementForce {
    const s = dot3(a1, r.e3),
      p = unit3([a1[0] - s * r.e3[0], a1[1] - s * r.e3[1], a1[2] - s * r.e3[2]], 1e-12);
    if (!p) throw new Error('FE3D.inAxes: hướng trục vuông góc với mặt phẳng phần tử');
    const c = dot3(p, r.e1),
      sn = dot3(p, r.e2),
      o = Object.assign({}, r);
    const t2 = (a: number, b: number, d: number): [number, number, number] => [
      c * c * a + 2 * c * sn * d + sn * sn * b,
      sn * sn * a - 2 * c * sn * d + c * c * b,
      (c * c - sn * sn) * d + c * sn * (b - a),
    ];
    [o.Nxx, o.Nyy, o.Nxy] = t2(r.Nxx, r.Nyy, r.Nxy);
    [o.Mxx, o.Myy, o.Mxy] = t2(r.Mxx, r.Myy, r.Mxy);
    o.Qx = c * r.Qx + sn * r.Qy;
    o.Qy = -sn * r.Qx + c * r.Qy;
    o.e1 = p;
    o.e2 = cross3(r.e3, p);
    return o;
  }

  return { model, inAxes };
})();
