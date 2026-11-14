/**
 * BangTinhCauCong Web App — Matrix & FEM Linear Solvers:
 *  1. Banded Cuthill-McKee Cholesky 2D Frame Solver (`CH.Frame` from Module 11)
 *  2. Q4 Selective-Reduced-Integration Mindlin Plate Solver (`MD.plate` from Module 08)
 *  3. Dense Gaussian Elimination (`MC.solve`), Dense Symmetric Cholesky & Banded SPD Solvers
 *
 * Strictly reproduces floating-point operations, assembly order, sign conventions,
 * and Gauss quadrature rules of `analysis-cau-cong/modules/{08,11,12}`.
 */

import type { MindlinPlateResult } from '../../types/project';

// ---------------------------------------------------------------------------
// 1. General Dense & Banded Linear Solvers
// ---------------------------------------------------------------------------

/**
 * Dense Gaussian elimination with partial pivoting for `A * X = B` (`nrhs` columns).
 * Matches `MC.solve` in `12_piles_geotech_mcoc_and_pm3d.js`.
 */
export function solveDenseLinear(
  A: readonly (readonly number[])[],
  B: readonly (readonly number[])[],
): number[][] {
  const n = A.length;
  const k = B[0]?.length ?? 0;
  const M = A.map((r, i) => [...r, ...B[i]]);

  for (let i = 0; i < n; i++) {
    let p = i;
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(M[j][i]) > Math.abs(M[p][i])) p = j;
    }
    if (Math.abs(M[p][i]) < 1e-12) {
      throw new Error('Hệ suy biến');
    }
    if (p !== i) {
      [M[i], M[p]] = [M[p], M[i]];
    }
    const piv = M[i][i];
    for (let j = i; j < n + k; j++) M[i][j] /= piv;
    for (let r = 0; r < n; r++) {
      if (r !== i && M[r][i]) {
        const f = M[r][i];
        for (let j = i; j < n + k; j++) M[r][j] -= f * M[i][j];
      }
    }
  }
  return M.map((r) => r.slice(n));
}

/**
 * Dense lower-triangular Cholesky `L * L^T = A` with flat row-major storage (`m x m`),
 * supporting multiple right-hand-side vectors cleanly without mutating caller inputs.
 */
export function solveDenseSymCholesky(
  A: Float64Array | readonly number[],
  m: number,
  rhsList: readonly (Float64Array | readonly number[])[],
): Float64Array[] {
  const L = new Float64Array(m * m);
  for (let i = 0; i < m * m; i++) L[i] = A[i];

  for (let k = 0; k < m; k++) {
    let s = L[k * m + k];
    for (let p = 0; p < k; p++) s -= L[k * m + p] ** 2;
    if (s <= 0) {
      throw new Error('Ma trận đối xứng không xác định dương (Cholesky)');
    }
    const lk = Math.sqrt(s);
    L[k * m + k] = lk;
    for (let i = k + 1; i < m; i++) {
      let q = L[i * m + k];
      for (let p = 0; p < k; p++) q -= L[i * m + p] * L[k * m + p];
      L[i * m + k] = q / lk;
    }
  }

  return rhsList.map((b) => {
    const y = new Float64Array(m);
    for (let i = 0; i < m; i++) {
      let q = b[i];
      for (let p = 0; p < i; p++) q -= L[i * m + p] * y[p];
      y[i] = q / L[i * m + i];
    }
    for (let i = m - 1; i >= 0; i--) {
      let q = y[i];
      for (let p = i + 1; p < m; p++) q -= L[p * m + i] * y[p];
      y[i] = q / L[i * m + i];
    }
    return y;
  });
}

/**
 * Symmetric banded Cholesky solver (`nd x (bw + 1)` lower-band storage `Lb[i*(bw+1) + (i-j)]`),
 * used by Winkler / continuous beam solvers.
 */
export function solveBandedSym(
  nd: number,
  bw: number,
  K: Float64Array,
  rhs: Float64Array | readonly number[],
): Float64Array {
  const B = bw + 1;
  const Lb = new Float64Array(nd * B);
  for (let i = 0; i < nd; i++) {
    for (let j = Math.max(0, i - bw); j <= i; j++) {
      Lb[i * B + (i - j)] = K[i * nd + j];
    }
  }
  for (let j = 0; j < nd; j++) {
    let d = Lb[j * B];
    for (let k = Math.max(0, j - bw); k < j; k++) {
      const l = Lb[j * B + (j - k)];
      d -= l * l;
    }
    if (d <= 0) {
      throw new Error('Ma trận độ cứng suy biến (kiểm tra liên kết)');
    }
    d = Math.sqrt(d);
    Lb[j * B] = d;
    for (let i = j + 1; i <= Math.min(nd - 1, j + bw); i++) {
      let v = Lb[i * B + (i - j)];
      for (let k = Math.max(0, i - bw); k < j; k++) {
        v -= Lb[i * B + (i - k)] * Lb[j * B + (j - k)];
      }
      Lb[i * B + (i - j)] = v / d;
    }
  }
  const y = new Float64Array(nd);
  for (let i = 0; i < nd; i++) {
    let v = rhs[i];
    for (let k = Math.max(0, i - bw); k < i; k++) v -= Lb[i * B + (i - k)] * y[k];
    y[i] = v / Lb[i * B];
  }
  const u = new Float64Array(nd);
  for (let i = nd - 1; i >= 0; i--) {
    let v = y[i];
    for (let k = i + 1; k <= Math.min(nd - 1, i + bw); k++) v -= Lb[k * B + (k - i)] * u[k];
    u[i] = v / Lb[i * B];
  }
  return u;
}

// ---------------------------------------------------------------------------
// 2. 2D Plane Frame Solver (`CH.Frame` from Module 11)
// ---------------------------------------------------------------------------

export interface FrameNode {
  x: number;
  y: number;
  th?: number;
}

export interface FrameElementInput {
  i: number;
  j: number;
  EA: number;
  EI: number;
  mem?: string;
}

export interface FrameElementInternal extends FrameElementInput {
  L: number;
  c: number;
  s: number;
  kl: number[][];
  T: number[][];
  dof: number[];
}

export interface FrameSpring {
  n: number;
  dof: 0 | 1 | 2;
  k: number;
  trib?: number;
  x?: number;
}

export interface FrameFixity {
  n: number;
  dof: 0 | 1 | 2;
}

export interface FrameElementLoad {
  e: number;
  t: 't' | 'a';
  a: number;
  b: number;
  q1: number;
  q2: number;
}

export interface FrameNodalLoad {
  n: number;
  fx?: number;
  fy?: number;
  m?: number;
}

export interface FrameLoadCase {
  el?: FrameElementLoad[];
  nod?: FrameNodalLoad[];
}

export interface FrameEndForces {
  Ni: number;
  Vi: number;
  Mi: number;
  Nj: number;
  Vj: number;
  Mj: number;
}

export interface FrameSolveResult {
  u: Float64Array;
  R: FrameEndForces[];
}

export interface FrameSolverInstance {
  run: (lc: FrameLoadCase) => FrameSolveResult;
  els: FrameElementInternal[];
  nodes: FrameNode[];
  nd: number;
}

/**
 * Exact TypeScript port of `CH.Frame(nodes, els, springs, fix)`
 * (`11_culverts_box_and_circular.js:41-236`):
 * - Reverse Cuthill-McKee nodal reordering
 * - Banded Cholesky factorization (`big = 1e14` penalty fixities)
 * - 3-point Gauss equivalent nodal forces for trapezoidal transverse/axial loads
 * - Beam sign convention: `{ Ni: -f[0], Vi: f[1], Mi: -f[2], Nj: f[3], Vj: -f[4], Mj: f[5] }`
 */
export function chFrameSolve(
  nodes: FrameNode[],
  elsIn: FrameElementInput[],
  springs: FrameSpring[] = [],
  fix: FrameFixity[] = [],
): FrameSolverInstance {
  const nd = 3 * nodes.length;
  const K = new Float64Array(nd * nd);
  const els: FrameElementInternal[] = elsIn.map((raw) => {
    const a = nodes[raw.i];
    const b = nodes[raw.j];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const L = Math.hypot(dx, dy);
    const c = dx / L;
    const s = dy / L;
    const EA = raw.EA / L;
    const k1 = (12 * raw.EI) / L ** 3;
    const k2 = (6 * raw.EI) / L ** 2;
    const k3 = (4 * raw.EI) / L;
    const k4 = (2 * raw.EI) / L;
    const kl = [
      [EA, 0, 0, -EA, 0, 0],
      [0, k1, k2, 0, -k1, k2],
      [0, k2, k3, 0, -k2, k4],
      [-EA, 0, 0, EA, 0, 0],
      [0, -k1, -k2, 0, k1, -k2],
      [0, k2, k4, 0, -k2, k3],
    ];
    const T = [
      [c, s, 0, 0, 0, 0],
      [-s, c, 0, 0, 0, 0],
      [0, 0, 1, 0, 0, 0],
      [0, 0, 0, c, s, 0],
      [0, 0, 0, -s, c, 0],
      [0, 0, 0, 0, 0, 1],
    ];
    const dof = [3 * raw.i, 3 * raw.i + 1, 3 * raw.i + 2, 3 * raw.j, 3 * raw.j + 1, 3 * raw.j + 2];
    for (let p = 0; p < 6; p++) {
      for (let q = 0; q < 6; q++) {
        let v = 0;
        for (let r = 0; r < 6; r++) {
          for (let t = 0; t < 6; t++) v += T[r][p] * kl[r][t] * T[t][q];
        }
        K[dof[p] * nd + dof[q]] += v;
      }
    }
    return { ...raw, L, c, s, kl, T, dof };
  });

  for (const sp of springs) {
    K[(3 * sp.n + sp.dof) * (nd + 1)] += sp.k;
  }
  const big = 1e14;
  for (const fx of fix) {
    K[(3 * fx.n + fx.dof) * (nd + 1)] += big;
  }

  // Reverse Cuthill-McKee ordering
  const nn = nodes.length;
  const adj: number[][] = Array.from({ length: nn }, () => []);
  for (const e of els) {
    adj[e.i].push(e.j);
    adj[e.j].push(e.i);
  }
  const perm = new Int32Array(nn).fill(-1);
  const ord: number[] = [];
  const deg = (i: number) => adj[i].length;
  while (ord.length < nn) {
    let st = -1;
    for (let i = 0; i < nn; i++) {
      if (perm[i] < 0 && (st < 0 || deg(i) < deg(st))) st = i;
    }
    const Q = [st];
    perm[st] = 0;
    ord.push(st);
    for (let h = 0; h < Q.length; h++) {
      const next = adj[Q[h]]
        .filter((w) => perm[w] < 0)
        .sort((x, y) => deg(x) - deg(y));
      for (const w of next) {
        perm[w] = 0;
        ord.push(w);
        Q.push(w);
      }
    }
  }
  ord.reverse();
  ord.forEach((v, idx) => {
    perm[v] = idx;
  });

  const pd = (i: number) => 3 * perm[Math.floor(i / 3)] + (i % 3);
  const P = new Int32Array(nd);
  for (let i = 0; i < nd; i++) P[i] = pd(i);

  let bw = 2;
  for (const e of els) {
    bw = Math.max(bw, 3 * Math.abs(perm[e.i] - perm[e.j]) + 2);
  }
  bw = Math.min(bw, nd - 1);

  const B = bw + 1;
  const Lb = new Float64Array(nd * B);
  for (let i = 0; i < nd; i++) {
    const o = i * nd;
    const pi = P[i];
    for (let j = 0; j < nd; j++) {
      const v = K[o + j];
      if (!v) continue;
      const pj = P[j];
      if (pj <= pi) Lb[pi * B + (pi - pj)] = v;
    }
  }

  for (let j = 0; j < nd; j++) {
    let d = Lb[j * B];
    for (let k = Math.max(0, j - bw); k < j; k++) {
      const l = Lb[j * B + (j - k)];
      d -= l * l;
    }
    if (d <= 0) throw new Error('Ma trận độ cứng suy biến (kiểm tra liên kết)');
    d = Math.sqrt(d);
    Lb[j * B] = d;
    for (let i = j + 1; i <= Math.min(nd - 1, j + bw); i++) {
      let v = Lb[i * B + (i - j)];
      for (let k = Math.max(0, i - bw); k < j; k++) {
        v -= Lb[i * B + (i - k)] * Lb[j * B + (j - k)];
      }
      Lb[i * B + (i - j)] = v / d;
    }
  }

  const solvePermuted = (F0: Float64Array): Float64Array => {
    const F = new Float64Array(nd);
    for (let i = 0; i < nd; i++) F[P[i]] = F0[i];
    const y = new Float64Array(nd);
    for (let i = 0; i < nd; i++) {
      let v = F[i];
      for (let k = Math.max(0, i - bw); k < i; k++) v -= Lb[i * B + (i - k)] * y[k];
      y[i] = v / Lb[i * B];
    }
    const w = new Float64Array(nd);
    for (let i = nd - 1; i >= 0; i--) {
      let v = y[i];
      for (let k = i + 1; k <= Math.min(nd - 1, i + bw); k++) v -= Lb[k * B + (k - i)] * w[k];
      w[i] = v / Lb[i * B];
    }
    const u = new Float64Array(nd);
    for (let i = 0; i < nd; i++) u[i] = w[P[i]];
    return u;
  };

  const GP: Array<[number, number]> = [
    [-Math.sqrt(0.6), 5 / 9],
    [0, 8 / 9],
    [Math.sqrt(0.6), 5 / 9],
  ];

  const enl = (e: FrameElementInternal, ld: FrameElementLoad): number[] => {
    const L = e.L;
    const f = [0, 0, 0, 0, 0, 0];
    const a = Math.max(0, ld.a);
    const b = Math.min(L, ld.b);
    if (b <= a) return f;
    const h = (b - a) / 2;
    for (const [g, w] of GP) {
      const x = a + h * (1 + g);
      const xi = x / L;
      const q = ld.q1 + (ld.q2 - ld.q1) * ((x - ld.a) / (ld.b - ld.a || 1));
      const W = w * h * q;
      if (ld.t === 't') {
        f[1] += W * (1 - 3 * xi * xi + 2 * xi ** 3);
        f[2] += W * L * (xi - 2 * xi * xi + xi ** 3);
        f[4] += W * (3 * xi * xi - 2 * xi ** 3);
        f[5] += W * L * (-xi * xi + xi ** 3);
      } else {
        f[0] += W * (1 - xi);
        f[3] += W * xi;
      }
    }
    return f;
  };

  const run = (LC: FrameLoadCase): FrameSolveResult => {
    const F = new Float64Array(nd);
    const EN = els.map(() => [0, 0, 0, 0, 0, 0]);
    for (const ld of LC.el || []) {
      const e = els[ld.e];
      const f = enl(e, ld);
      for (let p = 0; p < 6; p++) EN[ld.e][p] += f[p];
    }
    els.forEach((e, k) => {
      const f = EN[k];
      for (let p = 0; p < 6; p++) {
        let v = 0;
        for (let r = 0; r < 6; r++) v += e.T[r][p] * f[r];
        F[e.dof[p]] += v;
      }
    });
    for (const o of LC.nod || []) {
      F[3 * o.n] += o.fx || 0;
      F[3 * o.n + 1] += o.fy || 0;
      F[3 * o.n + 2] += o.m || 0;
    }
    const u = solvePermuted(F);
    const R = els.map((e, k) => {
      const ug = e.dof.map((d) => u[d]);
      const ul = e.T.map((row) => row.reduce((t, v, idx) => t + v * ug[idx], 0));
      const f = e.kl.map((row, p) => row.reduce((t, v, idx) => t + v * ul[idx], 0) - EN[k][p]);
      return {
        Ni: -f[0],
        Vi: f[1],
        Mi: -f[2],
        Nj: f[3],
        Vj: -f[4],
        Mj: f[5],
      };
    });
    return { u, R };
  };

  return { run, els, nodes, nd };
}

// ---------------------------------------------------------------------------
// 3. Q4 Mindlin Plate Solver (`MD.plate` from Module 08)
// ---------------------------------------------------------------------------

export interface MindlinPlateElementResult {
  Mx: number;
  My: number;
  Mxy: number;
  Qx: number;
  Qy: number;
}

export interface MindlinPlateMeshResult {
  X: number[];
  Y: number[];
  els: number[][];
  cen: Array<[number, number]>;
  res: MindlinPlateElementResult[][];
  nu: number;
  nv: number;
  B5: number;
  H: number;
  H4: number;
  t: number;
}

/**
 * Exact TypeScript port of `MD.plate(B5, H, H4, t, cases, nu=16, nv=16)`
 * (`08_flexible_abutment_md.js:105-280`):
 * - `E = 3.0e7 kPa`, `v = 0.2`, shear correction factor `k = 5/6`
 * - `2x2` Gauss integration for bending + load vector; `1x1` reduced Gauss at `(0,0)` for shear
 * - Clamped along vertical root edge `i = 0` (`3*(nv+1)` DOFs fixed)
 */
export function mdPlateSolve(
  B5: number,
  H: number,
  H4: number,
  t: number,
  cases: Array<(y: number) => number>,
  nu = 16,
  nv = 16,
): MindlinPlateMeshResult {
  const E = 3.0e7;
  const v = 0.2;
  const Db = (E * t ** 3) / (12 * (1 - v * v));
  const Ds = (((5 / 6) * E) / (2 * (1 + v))) * t;

  const zb = (u: number) => ((H - H4) * u) / B5;
  const X: number[] = [];
  const Y: number[] = [];
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++) {
      const u = (B5 * i) / nu;
      X.push(u);
      Y.push(zb(u) + ((H - zb(u)) * j) / nv);
    }
  }

  const nid = (i: number, j: number) => j * (nu + 1) + i;
  const nn = X.length;
  const nd = 3 * nn;
  const els: number[][] = [];
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      els.push([nid(i, j), nid(i + 1, j), nid(i + 1, j + 1), nid(i, j + 1)]);
    }
  }

  const xi = [-1, 1, 1, -1];
  const et = [-1, -1, 1, 1];
  const g = 1 / Math.sqrt(3);

  const shp = (r: number, s: number, e: number[]) => {
    const N: number[] = [];
    const dr: number[] = [];
    const ds: number[] = [];
    for (let k = 0; k < 4; k++) {
      N.push(((1 + r * xi[k]) * (1 + s * et[k])) / 4);
      dr.push((xi[k] * (1 + s * et[k])) / 4);
      ds.push((et[k] * (1 + r * xi[k])) / 4);
    }
    let j11 = 0;
    let j12 = 0;
    let j21 = 0;
    let j22 = 0;
    for (let k = 0; k < 4; k++) {
      j11 += dr[k] * X[e[k]];
      j12 += dr[k] * Y[e[k]];
      j21 += ds[k] * X[e[k]];
      j22 += ds[k] * Y[e[k]];
    }
    const dJ = j11 * j22 - j12 * j21;
    const dx: number[] = [];
    const dy: number[] = [];
    for (let k = 0; k < 4; k++) {
      dx.push((j22 * dr[k] - j12 * ds[k]) / dJ);
      dy.push((-j21 * dr[k] + j11 * ds[k]) / dJ);
    }
    return { N, dx, dy, dJ };
  };

  const K = new Float64Array(nd * nd);
  const F = cases.map(() => new Float64Array(nd));
  const D = [
    [Db, v * Db, 0],
    [v * Db, Db, 0],
    [0, 0, ((1 - v) / 2) * Db],
  ];

  for (const e of els) {
    const ke = Array.from({ length: 12 }, () => new Float64Array(12));
    for (const r of [-g, g]) {
      for (const s of [-g, g]) {
        const S = shp(r, s, e);
        const B = [new Float64Array(12), new Float64Array(12), new Float64Array(12)];
        for (let k = 0; k < 4; k++) {
          B[0][3 * k + 1] = S.dx[k];
          B[1][3 * k + 2] = S.dy[k];
          B[2][3 * k + 1] = S.dy[k];
          B[2][3 * k + 2] = S.dx[k];
        }
        for (let a = 0; a < 12; a++) {
          for (let c = 0; c < 12; c++) {
            let q = 0;
            for (let m = 0; m < 3; m++) {
              for (let n = 0; n < 3; n++) q += B[m][a] * D[m][n] * B[n][c];
            }
            ke[a][c] += q * S.dJ;
          }
        }
        const yg = S.N.reduce((p, Nk, k) => p + Nk * Y[e[k]], 0);
        cases.forEach((pFn, ci) => {
          const pv = pFn(yg);
          for (let k = 0; k < 4; k++) F[ci][3 * e[k]] += S.N[k] * pv * S.dJ;
        });
      }
    }
    // 1x1 reduced shear integration
    {
      const S = shp(0, 0, e);
      const Bs = [new Float64Array(12), new Float64Array(12)];
      for (let k = 0; k < 4; k++) {
        Bs[0][3 * k] = S.dx[k];
        Bs[0][3 * k + 1] = -S.N[k];
        Bs[1][3 * k] = S.dy[k];
        Bs[1][3 * k + 2] = -S.N[k];
      }
      for (let a = 0; a < 12; a++) {
        for (let c = 0; c < 12; c++) {
          ke[a][c] += (Bs[0][a] * Bs[0][c] + Bs[1][a] * Bs[1][c]) * Ds * S.dJ * 4;
        }
      }
    }
    const dofs: number[] = [];
    for (const n of e) dofs.push(3 * n, 3 * n + 1, 3 * n + 2);
    for (let a = 0; a < 12; a++) {
      for (let c = 0; c < 12; c++) {
        K[dofs[a] * nd + dofs[c]] += ke[a][c];
      }
    }
  }

  const fixed = new Uint8Array(nd);
  for (let j = 0; j <= nv; j++) {
    const n = nid(0, j);
    fixed[3 * n] = 1;
    fixed[3 * n + 1] = 1;
    fixed[3 * n + 2] = 1;
  }
  const free: number[] = [];
  for (let q = 0; q < nd; q++) if (!fixed[q]) free.push(q);

  const m = free.length;
  const A = new Float64Array(m * m);
  const Bm = cases.map(() => new Float64Array(m));
  for (let a = 0; a < m; a++) {
    for (let c = 0; c < m; c++) A[a * m + c] = K[free[a] * nd + free[c]];
    cases.forEach((_, ci) => {
      Bm[ci][a] = F[ci][free[a]];
    });
  }

  const Ym = solveDenseSymCholesky(A, m, Bm);
  const U = Ym.map((y) => {
    const u = new Float64Array(nd);
    free.forEach((q, a) => {
      u[q] = y[a];
    });
    return u;
  });

  const res: MindlinPlateElementResult[][] = U.map((u) =>
    els.map((e) => {
      const S = shp(0, 0, e);
      let kx = 0;
      let ky = 0;
      let kxy = 0;
      let gx = 0;
      let gy = 0;
      e.forEach((n, k) => {
        kx += S.dx[k] * u[3 * n + 1];
        ky += S.dy[k] * u[3 * n + 2];
        kxy += S.dy[k] * u[3 * n + 1] + S.dx[k] * u[3 * n + 2];
        gx += S.dx[k] * u[3 * n] - S.N[k] * u[3 * n + 1];
        gy += S.dy[k] * u[3 * n] - S.N[k] * u[3 * n + 2];
      });
      return {
        Mx: Db * (kx + v * ky),
        My: Db * (v * kx + ky),
        Mxy: ((1 - v) / 2) * Db * kxy,
        Qx: Ds * gx,
        Qy: Ds * gy,
      };
    }),
  );

  const cen: Array<[number, number]> = els.map((e) => [
    e.reduce((p, n) => p + X[n], 0) / 4,
    e.reduce((p, n) => p + Y[n], 0) / 4,
  ]);

  return { X, Y, els, cen, res, nu, nv, B5, H, H4, t };
}

/** Convenience wrapper producing domain summary `MindlinPlateResult`. */
export function summarizeMindlinPlate(
  mesh: MindlinPlateMeshResult,
  caseIndex = 0,
): MindlinPlateResult {
  const rows = mesh.res[caseIndex] || [];
  let maxMxx = 0;
  let maxMyy = 0;
  let maxQx = 0;
  let maxQy = 0;
  for (const r of rows) {
    maxMxx = Math.max(maxMxx, Math.abs(r.Mx));
    maxMyy = Math.max(maxMyy, Math.abs(r.My));
    maxQx = Math.max(maxQx, Math.abs(r.Qx));
    maxQy = Math.max(maxQy, Math.abs(r.Qy));
  }
  return {
    nx: mesh.nu,
    ny: mesh.nv,
    t: mesh.t,
    B5: mesh.B5,
    H: mesh.H,
    H4: mesh.H4,
    maxMxx,
    maxMyy,
    maxQx,
    maxQy,
    ok: rows.length > 0,
  };
}
