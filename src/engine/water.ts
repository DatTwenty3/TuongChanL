/**
 * 2D steady seepage & uplift / piping solver (`WATER`) ported faithfully from
 * `07_water_seepage.js`.
 */

import type {
  EngineCalcGeomData,
  EngineCalcInputParams,
  EngineLoadItem,
  EngineWaterPiping,
  EngineWaterResult,
  EngineWaterSeep,
  Point2D,
} from './types.ts';

export interface SeepSolveInput {
  polys: Point2D[][];
  B: number;
  hB: number;
  hF: number;
  hFtop: number;
  Df?: number;
  Tn: number;
  kbx?: number;
  kby?: number;
  kfx?: number;
  kfy?: number;
  kb?: number;
  kf?: number;
  q?: number;
  xs: number;
  xlo?: number;
  xhi?: number;
}

export interface InternalWaterSeep extends EngineWaterSeep {
  fl: Uint8Array;
  id: Int32Array;
  nE: Int32Array;
  nW: Int32Array;
  nN: Int32Array;
  nS: Int32Array;
  gE: Float64Array;
  gW: Float64Array;
  gN: Float64Array;
  gS: Float64Array;
  gD: Float64Array;
  hD: Float64Array;
  cellOf: Int32Array;
  h: Float64Array;
  nf: number;
  it: number;
  Qf: number;
  Qb: number;
  hB: number;
  hF: number;
  hFtop: number;
  Tn: number;
  B: number;
  kbx: number;
  kby: number;
  kfx: number;
  kfy: number;
  polys: Point2D[][];
  lo: number;
  hi: number;
  cell: (x: number, y: number) => [number, number];
  _psi?: Float64Array;
  uAt: (x: number, y: number, cap?: number) => number;
  level: (x: number) => number;
}

export interface FaceForceResult {
  Fx: number;
  Fy: number;
  Mx: number;
  My: number;
  L?: number;
  F?: number;
}

export const WATER = (() => {
  const GW = 9.81;

  const inPoly = (P: Point2D[], x: number, y: number): boolean => {
    let c = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const a = P[i],
        b = P[j];
      if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
  };

  function faceForce(
    P0: Point2D,
    P1: Point2D,
    uf: (x: number, y: number) => number,
    yk?: number[],
    n?: number,
  ): FaceForceResult {
    const segN = n || 16;
    const dx = P1[0] - P0[0],
      dy = P1[1] - P0[1],
      L = Math.hypot(dx, dy),
      Z: FaceForceResult = { Fx: 0, Fy: 0, Mx: 0, My: 0, L };
    if (L < 1e-12) return Z;
    const nx = dy / L,
      ny = -dx / L,
      ts = [0, 1];
    (yk || []).forEach((y) => {
      if (Math.abs(dy) > 1e-12) {
        const t = (y - P0[1]) / dy;
        if (t > 1e-9 && t < 1 - 1e-9) ts.push(t);
      }
    });
    ts.sort((a, b) => a - b);
    const pt = (t: number): Point2D => [P0[0] + t * dx, P0[1] + t * dy],
      pf = (t: number): number => {
        const q = pt(t);
        return Math.max(0, uf(q[0], q[1]));
      };
    let F = 0,
      Mx = 0,
      My = 0;
    for (let s = 0; s + 1 < ts.length; s++) {
      const ta = ts[s],
        tb = ts[s + 1],
        m = Math.max(1, Math.ceil(segN * (tb - ta)));
      for (let k = 0; k < m; k++) {
        const t0 = ta + ((tb - ta) * k) / m,
          t1 = ta + ((tb - ta) * (k + 1)) / m,
          tm = (t0 + t1) / 2,
          h = t1 - t0;
        const p0 = pf(t0),
          pm = pf(tm),
          p1 = pf(t1),
          q0 = pt(t0),
          qm = pt(tm),
          q1 = pt(t1);
        F += ((p0 + 4 * pm + p1) / 6) * h;
        Mx += ((p0 * q0[1] + 4 * pm * qm[1] + p1 * q1[1]) / 6) * h;
        My += ((p0 * q0[0] + 4 * pm * qm[0] + p1 * q1[0]) / 6) * h;
      }
    }
    return { Fx: F * L * nx, Fy: F * L * ny, Mx: Mx * L * nx, My: My * L * ny, L, F: F * L };
  }

  const ffAdd = (a: FaceForceResult, b: FaceForceResult): FaceForceResult => ({
    Fx: a.Fx + b.Fx,
    Fy: a.Fy + b.Fy,
    Mx: a.Mx + b.Mx,
    My: a.My + b.My,
  });

  function ffLoad(nm: string, ff: FaceForceResult, xd: number, yd: number): EngineLoadItem {
    return {
      nm,
      ty: 'WA',
      Fx: ff.Fx,
      Fy: ff.Fy,
      x: Math.abs(ff.Fy) > 1e-9 ? ff.My / ff.Fy : xd,
      y: Math.abs(ff.Fx) > 1e-9 ? ff.Mx / ff.Fx : yd,
    };
  }

  function gridLines(
    imp: number[],
    extra: number[],
    lo: number,
    hi: number,
    n0: number,
    n1: number,
    h0: number,
    hmax: number,
    grow: number,
  ): number[] {
    const L: number[] = [],
      tol = 0.02,
      add = (v: number) => {
        if (v < lo - 1e-9 || v > hi + 1e-9) return;
        const vv = Math.max(lo, Math.min(hi, v));
        if (!L.some((u) => Math.abs(u - vv) < tol)) L.push(vv);
      };
    imp.forEach(add);
    [1.5, 3, 5, 8, 12, 18, 27, 40, 60, 90].forEach((d) => {
      add(n0 - d);
      add(n1 + d);
    });
    extra.forEach(add);
    L.sort((a, b) => a - b);
    const xs = [L[0]];
    for (let k = 0; k + 1 < L.length; k++) {
      const a = L[k],
        b = L[k + 1],
        m = (a + b) / 2,
        d = Math.max(0, n0 - m, m - n1),
        s = Math.min(hmax, h0 * (1 + grow * d)),
        n = Math.max(1, Math.ceil((b - a) / s - 1e-9));
      for (let i = 1; i <= n; i++) xs.push(a + ((b - a) * i) / n);
    }
    return xs;
  }

  const _seepCache = new Map<string, InternalWaterSeep>();

  function seepSolve(S: SeepSolveInput): InternalWaterSeep {
    const kbx = (S.kbx != null ? S.kbx : S.kb) as number,
      kby = S.kby != null ? S.kby : kbx,
      kfx = (S.kfx != null ? S.kfx : S.kf) as number,
      kfy = S.kfy != null ? S.kfy : kfx;
    const key = JSON.stringify([
      S.polys.map((p) => p.map((q) => [Math.round(q[0] * 1e4), Math.round(q[1] * 1e4)])),
      S.B,
      S.hB,
      S.hF,
      S.hFtop,
      S.Df,
      S.Tn,
      kbx,
      kby,
      kfx,
      kfy,
      S.q,
      S.xs,
      S.xlo,
      S.xhi,
    ]);
    if (_seepCache.has(key)) return _seepCache.get(key)!;
    const { polys, B, hB, hF, hFtop, Tn, xs } = S,
      top = Math.max(hB, hFtop),
      q = S.q || 1;
    const Lb = Math.max(12, 2.5 * (top + Tn), 1.5 * B),
      Lf = Lb,
      lo = S.xlo != null ? S.xlo : -Lf,
      hi = S.xhi != null ? S.xhi : B + Lb;
    const h0 = q === 2 ? 0.3 : 0.18,
      hmax = q === 2 ? 2.5 : 1.6,
      grow = q === 2 ? 0.45 : 0.3;
    const vx: number[] = [],
      vy: number[] = [];
    polys.forEach((p) =>
      p.forEach((v) => {
        vx.push(v[0]);
        vy.push(v[1]);
      }),
    );
    const Xarr = gridLines([0, B, S.xs, lo, hi], vx, lo, hi, -0.5, B + 0.5, h0, hmax, grow);
    const Yarr = gridLines(
      [-Tn, 0, hB, hFtop, top],
      vy.filter((v) => v >= -Tn - 1e-9 && v <= top + 1e-9),
      -Tn,
      top,
      -0.5,
      top + 0.5,
      h0,
      hmax,
      grow,
    );
    const X = Float64Array.from(Xarr),
      Y = Float64Array.from(Yarr);
    const nx = Xarr.length - 1,
      ny = Yarr.length - 1,
      xcArr: number[] = [],
      ycArr: number[] = [],
      wxArr: number[] = [],
      wyArr: number[] = [];
    for (let i = 0; i < nx; i++) {
      xcArr.push((Xarr[i] + Xarr[i + 1]) / 2);
      wxArr.push(Xarr[i + 1] - Xarr[i]);
    }
    for (let j = 0; j < ny; j++) {
      ycArr.push((Yarr[j] + Yarr[j + 1]) / 2);
      wyArr.push(Yarr[j + 1] - Yarr[j]);
    }
    const xc = Float64Array.from(xcArr),
      yc = Float64Array.from(ycArr),
      wx = Float64Array.from(wxArr),
      wy = Float64Array.from(wyArr);
    const solid = new Uint8Array(nx * ny),
      fl = new Uint8Array(nx * ny),
      id = new Int32Array(nx * ny).fill(-1);
    let nf = 0;
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < ny; j++) {
        const c = i * ny + j,
          sol = polys.some((p) => inPoly(p, xc[i], yc[j]));
        solid[c] = sol ? 1 : 0;
        const lev = xc[i] < xs ? hFtop : hB;
        if (!sol && Y[j + 1] <= lev + 1e-9) {
          fl[c] = 1;
          id[c] = nf++;
        }
      }
    const kxOf = (i: number, j: number) => (yc[j] < 0 || xc[i] < xs ? kfx : kbx),
      kyOf = (i: number, j: number) => (yc[j] < 0 || xc[i] < xs ? kfy : kby);
    const nE = new Int32Array(nf).fill(-1),
      nW = new Int32Array(nf).fill(-1),
      nN = new Int32Array(nf).fill(-1),
      nS = new Int32Array(nf).fill(-1);
    const gE = new Float64Array(nf),
      gW = new Float64Array(nf),
      gN = new Float64Array(nf),
      gS = new Float64Array(nf),
      gD = new Float64Array(nf),
      hD = new Float64Array(nf),
      dg = new Float64Array(nf);
    const cellOf = new Int32Array(nf);
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < ny; j++) {
        const c = i * ny + j,
          p = id[c];
        if (p < 0) continue;
        cellOf[p] = c;
        const kx0 = kxOf(i, j),
          ky0 = kyOf(i, j);
        if (i + 1 < nx && id[c + ny] >= 0) {
          const k1 = kxOf(i + 1, j),
            g = wy[j] / (wx[i] / (2 * kx0) + wx[i + 1] / (2 * k1));
          nE[p] = id[c + ny];
          gE[p] = g;
        }
        if (i > 0 && id[c - ny] >= 0) {
          const k1 = kxOf(i - 1, j),
            g = wy[j] / (wx[i] / (2 * kx0) + wx[i - 1] / (2 * k1));
          nW[p] = id[c - ny];
          gW[p] = g;
        }
        if (j + 1 < ny && id[c + 1] >= 0) {
          const k1 = kyOf(i, j + 1),
            g = wx[i] / (wy[j] / (2 * ky0) + wy[j + 1] / (2 * k1));
          nN[p] = id[c + 1];
          gN[p] = g;
        }
        if (j > 0 && id[c - 1] >= 0) {
          const k1 = kyOf(i, j - 1),
            g = wx[i] / (wy[j] / (2 * ky0) + wy[j - 1] / (2 * k1));
          nS[p] = id[c - 1];
          gS[p] = g;
        }
        if (j + 1 >= ny || (!solid[c + 1] && !fl[c + 1])) {
          gD[p] = (ky0 * wx[i]) / (wy[j] / 2);
          hD[p] = xc[i] < xs ? hF : hB;
        }
        dg[p] = gE[p] + gW[p] + gN[p] + gS[p] + gD[p];
      }
    const h = new Float64Array(nf),
      b = new Float64Array(nf),
      r = new Float64Array(nf),
      z = new Float64Array(nf),
      pp = new Float64Array(nf),
      Ap = new Float64Array(nf);
    let bn = 0;
    for (let p = 0; p < nf; p++) {
      b[p] = gD[p] * hD[p];
      h[p] = (hB + hF) / 2;
    }
    const mv = (x: Float64Array, y: Float64Array) => {
      for (let p = 0; p < nf; p++) {
        let s = dg[p] * x[p];
        if (nE[p] >= 0) s -= gE[p] * x[nE[p]];
        if (nW[p] >= 0) s -= gW[p] * x[nW[p]];
        if (nN[p] >= 0) s -= gN[p] * x[nN[p]];
        if (nS[p] >= 0) s -= gS[p] * x[nS[p]];
        y[p] = s;
      }
    };
    mv(h, Ap);
    let rz = 0;
    for (let p = 0; p < nf; p++) {
      r[p] = b[p] - Ap[p];
      z[p] = r[p] / dg[p];
      pp[p] = z[p];
      rz += r[p] * z[p];
      bn += b[p] * b[p];
    }
    bn = Math.sqrt(bn) || 1;
    let it = 0,
      res = Math.sqrt(rz);
    for (; it < 6e3; it++) {
      mv(pp, Ap);
      let pAp = 0;
      for (let p = 0; p < nf; p++) pAp += pp[p] * Ap[p];
      if (!(pAp > 0)) break;
      const al = rz / pAp;
      let rn = 0;
      for (let p = 0; p < nf; p++) {
        h[p] += al * pp[p];
        r[p] -= al * Ap[p];
        rn += r[p] * r[p];
      }
      res = Math.sqrt(rn);
      if (res < 1e-10 * bn) break;
      let rz2 = 0;
      for (let p = 0; p < nf; p++) {
        z[p] = r[p] / dg[p];
        rz2 += r[p] * z[p];
      }
      const be = rz2 / rz;
      rz = rz2;
      for (let p = 0; p < nf; p++) pp[p] = z[p] + be * pp[p];
    }
    const H = new Float64Array(nx * ny).fill(NaN);
    for (let p = 0; p < nf; p++) H[cellOf[p]] = h[p];
    let Qf = 0,
      Qb = 0;
    for (let p = 0; p < nf; p++)
      if (gD[p] > 0) {
        const f = gD[p] * (h[p] - hD[p]);
        if (xc[(cellOf[p] / ny) | 0] < xs) Qf += f;
        else Qb += f;
      }

    const cell = (x: number, y: number): [number, number] => {
      let a = 0,
        c = nx - 1;
      while (a < c) {
        const m = (a + c + 1) >> 1;
        if (X[m] <= x) a = m;
        else c = m - 1;
      }
      const i = a;
      a = 0;
      c = ny - 1;
      while (a < c) {
        const m = (a + c + 1) >> 1;
        if (Y[m] <= y) a = m;
        else c = m - 1;
      }
      return [i, a];
    };

    const headAt = (x: number, y: number): number => {
      x = Math.max(xc[0], Math.min(xc[nx - 1], x));
      y = Math.max(yc[0], Math.min(yc[ny - 1], y));
      let [i, j] = cell(x, y);
      if (x < xc[i] && i > 0) i--;
      if (y < yc[j] && j > 0) j--;
      const i1 = Math.min(i + 1, nx - 1),
        j1 = Math.min(j + 1, ny - 1),
        tx = i1 > i ? (x - xc[i]) / (xc[i1] - xc[i]) : 0,
        ty = j1 > j ? (y - yc[j]) / (yc[j1] - yc[j]) : 0;
      const w: [number, number, number][] = [
        [i, j, (1 - tx) * (1 - ty)],
        [i1, j, tx * (1 - ty)],
        [i, j1, (1 - tx) * ty],
        [i1, j1, tx * ty],
      ];
      let s = 0,
        ws = 0;
      w.forEach(([a, c, k]) => {
        const v = H[a * ny + c];
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
            const v = H[a * ny + c];
            if (isFinite(v)) {
              s2 += v;
              n2++;
            }
          }
        if (n2) return s2 / n2;
      }
      return NaN;
    };

    const ubx: number[] = [],
      ubv: number[] = [];
    for (let i = 0; i < nx; i++) {
      if (xc[i] < 0 || xc[i] > B) continue;
      let jj = -1;
      for (let t = ny - 1; t >= 0; t--) {
        if (yc[t] < 0 && fl[i * ny + t]) {
          jj = t;
          break;
        }
      }
      if (jj < 0) continue;
      ubx.push(xc[i]);
      ubv.push(H[i * ny + jj]);
    }

    const ubHead = (x: number): number => {
      const n = ubx.length;
      if (!n) return (hB + hF) / 2;
      if (x <= ubx[0]) return ubv[0];
      if (x >= ubx[n - 1]) return ubv[n - 1];
      let a = 0,
        c = n - 1;
      while (c - a > 1) {
        const m = (a + c) >> 1;
        if (ubx[m] <= x) a = m;
        else c = m;
      }
      return ubv[a] + ((ubv[c] - ubv[a]) * (x - ubx[a])) / (ubx[c] - ubx[a]);
    };

    const R = {
      nx,
      ny,
      X,
      Y,
      xc,
      yc,
      wx,
      wy,
      H,
      solid,
      fl,
      id,
      nE,
      nW,
      nN,
      nS,
      gE,
      gW,
      gN,
      gS,
      gD,
      hD,
      cellOf,
      h,
      nf,
      it,
      res: res / bn,
      Qf,
      Qb,
      hB,
      hF,
      hFtop,
      Tn,
      xs,
      B,
      kbx,
      kby,
      kfx,
      kfy,
      polys,
      lo,
      hi,
      cell,
      headAt,
      ubHead,
    } as unknown as InternalWaterSeep;

    R.stream = (() => {
      if (R._psi) return R._psi as unknown as ReturnType<EngineWaterSeep['stream']>;
      const psi = new Float64Array((nx + 1) * (ny + 1));
      for (let i = 0; i <= nx; i++) {
        let s = 0;
        psi[i * (ny + 1)] = 0;
        for (let j = 0; j < ny; j++) {
          let qv = 0;
          if (i > 0 && i < nx) {
            const p = id[(i - 1) * ny + j],
              p2 = id[i * ny + j];
            if (p >= 0 && p2 >= 0) qv = gE[p] * (h[p] - h[p2]);
          }
          s += qv;
          psi[i * (ny + 1) + j + 1] = s;
        }
      }
      R._psi = psi;
      return psi as unknown as ReturnType<EngineWaterSeep['stream']>;
    }) as InternalWaterSeep['stream'];

    R.level = (x: number) => (x < xs ? hFtop : hB);
    R.uAt = (x: number, y: number, cap?: number): number => {
      const L = x < xs ? hFtop : hB;
      if (!(y < L)) return 0;
      let hh = R.headAt(x, y);
      if (!isFinite(hh)) hh = L;
      if (cap != null && hh > cap) hh = cap;
      return Math.max(0, GW * (hh - y));
    };

    if (_seepCache.size >= 4) {
      const firstKey = _seepCache.keys().next().value;
      if (firstKey !== undefined) _seepCache.delete(firstKey);
    }
    _seepCache.set(key, R);
    return R;
  }

  function contourLines(
    px: ArrayLike<number>,
    py: ArrayLike<number>,
    val: (i: number, j: number) => number,
    ok: ((i: number, j: number) => boolean) | null,
    lev: number,
  ): Point2D[][] {
    const segs: [Point2D, Point2D][] = [],
      key = (a: Point2D) => Math.round(a[0] * 1e5) + ',' + Math.round(a[1] * 1e5);
    const nx = px.length - 1,
      ny = py.length - 1;
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < ny; j++) {
        if (ok && !ok(i, j)) continue;
        const v = [val(i, j), val(i + 1, j), val(i + 1, j + 1), val(i, j + 1)];
        if (v.some((t) => !isFinite(t))) continue;
        const P: Point2D[] = [
            [px[i], py[j]],
            [px[i + 1], py[j]],
            [px[i + 1], py[j + 1]],
            [px[i], py[j + 1]],
          ],
          pts: Point2D[] = [];
        for (let e = 0; e < 4; e++) {
          const a = v[e],
            b = v[(e + 1) % 4];
          if ((a - lev) * (b - lev) < 0) {
            const t = (lev - a) / (b - a),
              p0 = P[e],
              p1 = P[(e + 1) % 4];
            pts.push([p0[0] + t * (p1[0] - p0[0]), p0[1] + t * (p1[1] - p0[1])]);
          }
        }
        if (pts.length === 2) segs.push([pts[0], pts[1]]);
        else if (pts.length === 4) {
          segs.push([pts[0], pts[1]], [pts[2], pts[3]]);
        }
      }
    const map = new Map<string, [number, number][]>();
    segs.forEach((s, k) => {
      [0, 1].forEach((e) => {
        const kk = key(s[e]);
        if (!map.has(kk)) map.set(kk, []);
        map.get(kk)!.push([k, e]);
      });
    });
    const used = new Uint8Array(segs.length),
      lines: Point2D[][] = [];
    for (let k = 0; k < segs.length; k++) {
      if (used[k]) continue;
      used[k] = 1;
      const line: Point2D[] = [segs[k][0], segs[k][1]];
      for (const dir of [1, 0]) {
        for (;;) {
          const end = dir ? line[line.length - 1] : line[0],
            c = (map.get(key(end)) || []).find(([s]) => !used[s]);
          if (!c) break;
          used[c[0]] = 1;
          const other = segs[c[0]][1 - c[1]];
          if (dir) line.push(other);
          else line.unshift(other);
        }
      }
      lines.push(line);
    }
    return lines;
  }

  function pipingCheck(
    I: EngineCalcInputParams,
    g: EngineCalcGeomData,
    W: EngineWaterResult,
  ): EngineWaterPiping {
    const B = g.B,
      Df = W.Df,
      gfs = I.gfs,
      gpr = Math.max(0.1, gfs - GW),
      icr = gpr / GW,
      dH = W.hB - W.hF,
      key = g.g0 && g.g0.dn ? g.g0.dn * 0.01 : 0;
    const P: EngineWaterPiping = {
      icr,
      gpr,
      dH,
      FSreq: I.FSp,
      Df,
      kind: 'none',
      iavg: 0,
      FS: Infinity,
      ok: true,
    };
    if (I.rock) {
      P.kind = 'rock';
      P.iavg = 0;
      P.FS = Infinity;
      P.ok = true;
      return P;
    }
    if (dH <= 1e-9) {
      P.iavg = 0;
      P.FS = Infinity;
      P.ok = true;
      P.kind = 'none';
      return P;
    }
    if (W.mode === 'fd' && W.seep) {
      const S = W.seep,
        D = Math.max(Df, 0.3),
        wd = D / 2,
        N = 40;
      let sum = 0,
        cnt = 0;
      for (let k = 0; k < N; k++) {
        const x = (-wd * (k + 0.5)) / N,
          hh = S.headAt(x, 0);
        if (isFinite(hh)) {
          sum += hh - W.hF;
          cnt++;
        }
      }
      const dh = cnt ? Math.max(0, sum / cnt) : 0,
        i0 = dh / D;
      let imax = 0;
      for (let i = 0; i < S.nx; i++) {
        if (S.xc[i] > 0 || S.xc[i] < -3 * D) continue;
        for (let j = 0; j + 1 < S.ny; j++) {
          const a = S.H[i * S.ny + j],
            b = S.H[i * S.ny + j + 1];
          if (isFinite(a) && isFinite(b) && S.yc[j] >= 0)
            imax = Math.max(imax, (a - b) / ((S.wy[j] + S.wy[j + 1]) / 2));
        }
      }
      const sv = gpr * Math.min(W.hFtop, D) + I.gf * Math.max(0, D - W.hFtop);
      P.kind = 'prism';
      P.D = D;
      P.wd = wd;
      P.dh = dh;
      P.iavg = i0;
      P.imax = imax;
      P.sv = sv;
      P.Wp = sv * wd;
      P.Uex = GW * dh * wd;
      P.FS = P.Uex > 1e-9 ? P.Wp / P.Uex : Infinity;
      P.ok = P.FS >= I.FSp - 1e-9;
    } else {
      const Lc = B + 2 * key;
      P.kind = 'avg';
      P.Lc = Lc;
      P.iavg = dH / Lc;
      P.FS = P.iavg > 1e-9 ? icr / P.iavg : Infinity;
      P.ok = P.FS >= I.FSp - 1e-9;
    }
    return P;
  }

  function build(
    I: EngineCalcInputParams,
    g: EngineCalcGeomData,
    opt?: { coarse?: boolean },
  ): EngineWaterResult {
    const o = opt || {};
    const B = g.B,
      Df = I.ht + I.hf,
      hBraw = I.hB,
      hFraw = I.hF,
      hB = Math.max(0, Math.min(g.Hp, hBraw)),
      hF = Math.max(0, Math.min(g.yT, hFraw)),
      hFtop = Math.min(hF, Df);
    const W = {
      on: true,
      mode: (I.wMode === 'hs' ? 'hs' : 'fd') as 'hs' | 'fd',
      gw: GW,
      B,
      Df,
      hB,
      hF,
      hFtop,
      hBraw,
      hFraw,
      gsat: I.gsat,
      gfs: I.gfs,
      Tn: I.Tn,
      kbx: I.kbx,
      kby: I.kby,
      kfx: I.kfx,
      kfy: I.kfy,
      xs: (g.xfb + g.xbb) / 2,
      warn: [] as string[],
      dH: 0,
      seep: null as InternalWaterSeep | null,
      U: 0,
      xU: B / 2,
      L: [] as EngineLoadItem[],
    } as unknown as EngineWaterResult & {
      back: FaceForceResult;
      front: FaceForceResult;
      Tn: number;
      kbx: number;
      kby: number;
      kfx: number;
      kfy: number;
      B: number;
    };
    if (hBraw > g.Hp + 1e-9)
      W.warn.push(
        `Mực nước ngầm sau lưng ${hBraw} m cao hơn mặt đất tại mặt phẳng tính áp lực (${g.Hp.toFixed(2)} m): lấy bằng ${g.Hp.toFixed(2)} m.`,
      );
    if (hFraw > g.yT + 1e-9)
      W.warn.push(`Mực nước phía trước ${hFraw} m cao hơn đỉnh tường: lấy bằng cao độ đỉnh tường.`);
    W.dH = hB - hF;
    const seep =
      W.mode === 'fd' && !I.rock
        ? seepSolve({
            polys: [g.foot, g.stem],
            B,
            hB,
            hF,
            hFtop,
            Df,
            Tn: Math.max(1, I.Tn),
            kbx: Math.max(1e-12, I.kbx),
            kby: Math.max(1e-12, I.kby),
            kfx: Math.max(1e-12, I.kfx),
            kfy: Math.max(1e-12, I.kfy),
            xs: W.xs,
            q: o.coarse ? 2 : 1,
          })
        : null;
    W.seep = seep;
    if (W.mode === 'fd' && !seep) {
      W.mode = 'hs';
      W.warn.push(
        'Nền đá: áp lực đẩy ngược lấy theo sơ đồ thủy tĩnh (cột nước giảm tuyến tính từ gót đến mũi).',
      );
    }
    const gridH = (x: number, y: number, def: number): number => {
      const v = seep!.headAt(x, y);
      return isFinite(v) ? v : def;
    };
    W.head = (x: number, y: number, side?: string): number => {
      if (W.mode === 'hs')
        return side === 'F'
          ? hF
          : side === 'B'
            ? hB
            : hF + (hB - hF) * Math.max(0, Math.min(1, x / B));
      return gridH(
        x,
        y,
        side === 'F' ? hF : side === 'B' ? hB : hF + (hB - hF) * Math.max(0, Math.min(1, x / B)),
      );
    };
    W.u = (x: number, y: number, side?: string): number => {
      if (side === 'B') {
        if (y >= hB) return 0;
        return GW * Math.max(0, W.head(x, y, 'B') - y);
      }
      if (side === 'F') {
        if (y >= hF) return 0;
        if (y > Df) return GW * (hF - y);
        return GW * Math.max(0, W.head(x, y, 'F') - y);
      }
      return GW * Math.max(0, W.head(x, y, 'U') - y);
    };
    W.ub = (x: number): number =>
      W.mode === 'hs'
        ? GW * Math.max(0, hF + (hB - hF) * Math.max(0, Math.min(1, x / B)))
        : GW * Math.max(0, seep!.ubHead(x));
    {
      const N = 200;
      let U = 0,
        Mx = 0;
      for (let k = 0; k < N; k++) {
        const x = ((k + 0.5) * B) / N,
          u = W.ub(x);
        U += (u * B) / N;
        Mx += (u * x * B) / N;
      }
      W.U = U;
      W.xU = U > 1e-9 ? Mx / U : B / 2;
    }
    W.uB = (y: number): number => W.u(B, y, 'B');
    W.wt = { yw: hB, gsat: I.gsat, u: (x: number, y: number) => W.u(x, y, 'B') };
    const back = faceForce([B, g.Hp], [B, 0], (x, y) => W.u(x, y, 'B'), [hB], 24);
    const fr = g.front;
    let front: FaceForceResult = { Fx: 0, Fy: 0, Mx: 0, My: 0 };
    for (let s = 0; s + 1 < fr.length; s++)
      front = ffAdd(
        front,
        faceForce(fr[s], fr[s + 1], (x, y) => W.u(x, y, 'F'), [hF, Df], 24),
      );
    W.back = back;
    W.front = front;
    W.L = [];
    if (Math.abs(back.Fx) > 1e-9)
      W.L.push(
        Object.assign(
          ffLoad('Áp lực nước sau lưng (trên mặt phẳng tính áp lực)', back, B, g.Hp / 3),
          { sub: 'back' },
        ),
      );
    if (W.U > 1e-9)
      W.L.push({
        nm: 'Đẩy ngược dưới đáy bản đáy',
        ty: 'WA',
        Fx: 0,
        Fy: W.U,
        x: W.xU,
        y: 0,
        sub: 'uplift',
      });
    if (Math.abs(front.Fx) > 1e-9 || Math.abs(front.Fy) > 1e-9)
      W.L.push(
        Object.assign(
          ffLoad('Áp lực nước phía trước (mặt mũi, mặt trước tường)', front, 0, hF / 3),
          { sub: 'front' },
        ),
      );
    W.pip = pipingCheck(I, g, W);
    return W;
  }

  return {
    GW,
    build,
    faceForce,
    ffAdd,
    ffLoad,
    seepSolve,
    contourLines,
    inPoly,
    pipingCheck,
  };
})();
