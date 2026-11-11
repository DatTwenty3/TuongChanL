/**
 * Global slope stability solver (`SLOPE`, Simplified Bishop method)
 * ported faithfully from `08_slope_stability.js`.
 */

import type {
  EngineCalcGeomData,
  EngineCalcInputParams,
  EngineWaterResult,
  Point2D,
} from './types.ts';

export interface SlopeSoilMaterial {
  g: number;
  gs: number;
  c: number;
  phi: number;
  total?: boolean;
}

export interface SlopeModel {
  I: EngineCalcInputParams;
  g: EngineCalcGeomData;
  W: EngineWaterResult | null | undefined;
  bs: { T: number; phiR: number; level?: (x: number) => number; uFn?: (x: number, y: number) => number };
  fnd: SlopeSoilMaterial;
  bkf: SlopeSoilMaterial;
  Df: number;
  yw: (x: number) => number;
  xmin: number;
  xmax: number;
  colWeight: (x: number, yb: number) => number;
  ground: (x: number) => number;
  rock: boolean;
  cohes: boolean;
  uFn: ((x: number, y: number) => number) | null;
}

export interface SlopeSlice {
  x: number;
  yb: number;
  b: number;
  w: number;
  sinA: number;
  cosA: number;
  c: number;
  tan: number;
  u: number;
  phi: number;
}

export interface SlopeCircleResult {
  FS: number;
  xc: number;
  yc: number;
  R: number;
  xL: number;
  xR: number;
  ylow: number;
  yl?: number;
  slices?: SlopeSlice[];
  sumW?: number;
  drive?: number;
}

export interface SlopeRunResult {
  ok: boolean;
  none?: boolean;
  FS?: number;
  FSreq: number;
  phiR: number;
  xc?: number;
  yc?: number;
  R?: number;
  xL?: number;
  xR?: number;
  ylow?: number;
  slices?: SlopeSlice[];
  sumW?: number;
  drive?: number;
  M: SlopeModel;
  fnd?: SlopeSoilMaterial;
  bkf?: SlopeSoilMaterial;
  T?: number;
  Df?: number;
}

export interface SlopeInputCarrier {
  I: EngineCalcInputParams;
  g: EngineCalcGeomData;
  W?: EngineWaterResult | null;
}

export interface SlopeOptions {
  T?: number;
  phiR?: number;
  level?: ((x: number) => number) | number;
  uFn?: (x: number, y: number) => number;
}

export const SLOPE = (() => {
  const rad = (d: number) => (d * Math.PI) / 180,
    GWt = 9.81;

  function chord(poly: Point2D[], x: number): number {
    const ys: number[] = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i],
        b = poly[(i + 1) % poly.length];
      if ((a[0] <= x && b[0] > x) || (b[0] <= x && a[0] > x))
        ys.push(a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]));
    }
    ys.sort((p, q) => p - q);
    let s = 0;
    for (let i = 0; i + 1 < ys.length; i += 2) s += ys[i + 1] - ys[i];
    return s;
  }

  function topOf(poly: Point2D[], x: number): number {
    let t = -Infinity;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i],
        b = poly[(i + 1) % poly.length];
      if ((a[0] <= x && b[0] > x) || (b[0] <= x && a[0] > x))
        t = Math.max(t, a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]));
    }
    return t;
  }

  function model(R: SlopeInputCarrier, opt?: SlopeOptions): SlopeModel {
    const I = R.I,
      g = R.g,
      W = R.W,
      rock = !!I.rock,
      cohes = !rock && I.soil === 'd';
    const rawLevel = opt && opt.level;
    const levelFn =
      typeof rawLevel === 'function'
        ? rawLevel
        : typeof rawLevel === 'number'
          ? () => rawLevel
          : undefined;
    const bs = {
      T: opt && opt.T != null ? opt.T : 6,
      phiR: opt && opt.phiR != null ? opt.phiR : 0.65,
      level: levelFn,
      uFn: opt && opt.uFn,
    };
    const fnd: SlopeSoilMaterial = rock
      ? { g: I.gR, gs: I.gR, c: I.cR, phi: I.phiR }
      : cohes
        ? { g: I.gf, gs: I.gfs || I.gf, c: I.Su, phi: 0, total: true }
        : { g: I.gf, gs: I.gfs || I.gf, c: I.cf, phi: I.phif };
    const bkf: SlopeSoilMaterial = { g: I.gs, gs: I.gsat || I.gs, c: I.cs, phi: I.phi };
    const Df = I.ht + I.hf,
      hB = W ? W.hB : -1e9,
      hF = W ? W.hF : -1e9;
    const yw = !W
      ? () => -1e9
      : bs.level
        ? bs.level
        : (x: number) => (x <= 0 ? hF : x >= g.B ? hB : hF + ((hB - hF) * x) / g.B);
    const xmin = -Math.max(6, 1.2 * g.yT),
      xmax = g.B + Math.max(8, 2.2 * g.yT);
    const polys = [g.foot, g.stem],
      q = (I.q || 0) + (I.qL || 0);
    const ground = (x: number) => g.yG(x);
    const colWeight = (x: number, yb: number) => {
      let w = 0;
      const soilBand = (y0: number, y1: number, m: SlopeSoilMaterial) => {
        if (y1 <= y0) return 0;
        if (!W) return m.g * (y1 - y0);
        const yv = yw(x),
          a = Math.min(y1, Math.max(y0, yv));
        return m.gs * (a - y0) + m.g * (y1 - a);
      };
      w += soilBand(yb, 0, fnd);
      if (x < 0) {
        w += soilBand(0, Math.max(0, Df), fnd);
      } else if (x <= g.B) {
        const c = polys.reduce((s, p) => s + chord(p, x), 0);
        w += I.gc * c;
        if (x < g.xfb) {
          const t = topOf(g.foot, x);
          if (isFinite(t)) w += soilBand(t, Math.max(t, Df), fnd);
        } else if (x > g.xbt) {
          const top = Math.max(topOf(g.foot, x), topOf(g.stem, x));
          w += soilBand(top, Math.max(top, ground(x)), bkf) + q;
        }
      } else {
        w += soilBand(0, ground(x), bkf) + q;
      }
      return w;
    };
    return {
      I,
      g,
      W,
      bs,
      fnd,
      bkf,
      Df,
      yw,
      xmin,
      xmax,
      colWeight,
      ground,
      rock,
      cohes,
      uFn: W && bs.uFn ? bs.uFn : null,
    };
  }

  function circleFS(
    M: SlopeModel,
    xc: number,
    yc: number,
    Rr: number,
    keep?: boolean,
  ): SlopeCircleResult | null {
    const g = M.g,
      ylow = yc - Rr;
    if (ylow > -0.05 || ylow < -M.bs.T - 1e-9) return null;
    const arc = (x: number) => {
      const d = Rr * Rr - (x - xc) * (x - xc);
      return d < 0 ? NaN : yc - Math.sqrt(d);
    };
    const a0 = arc(0),
      aB = arc(g.B);
    if (!(a0 <= -0.02) || !(aB <= -0.02)) return null;
    const dF = yc - M.Df;
    if (dF <= 1e-6 || dF >= Rr) return null;
    const xL = xc - Math.sqrt(Rr * Rr - dF * dF);
    if (!(xL < -0.02) || xL < M.xmin) return null;
    let xR = NaN;
    {
      const xs = g.B,
        xe = xc + Rr * (1 - 1e-9),
        n = 120;
      let xa = xs,
        fa = arc(xa) - M.ground(xa);
      for (let i = 1; i <= n; i++) {
        const xb = xs + ((xe - xs) * i) / n,
          fb = arc(xb) - M.ground(xb);
        if (fa < 0 && fb >= 0) {
          let lo = xa,
            hi = xb;
          for (let k = 0; k < 40; k++) {
            const m = (lo + hi) / 2;
            if (arc(m) - M.ground(m) < 0) lo = m;
            else hi = m;
          }
          xR = (lo + hi) / 2;
          break;
        }
        xa = xb;
        fa = fb;
      }
    }
    if (!isFinite(xR) || xR > M.xmax) return null;
    const N = 48,
      b = (xR - xL) / N,
      sl: SlopeSlice[] = [];
    let sumW = 0,
      drive = 0;
    for (let i = 0; i < N; i++) {
      const x = xL + (i + 0.5) * b,
        yb = arc(x),
        w = M.colWeight(x, yb) * b,
        sinA = (x - xc) / Rr,
        cosA = Math.sqrt(Math.max(1e-9, 1 - sinA * sinA));
      const m = yb >= 0 ? (x > g.B ? M.bkf : M.fnd) : M.fnd,
        tan = Math.tan(rad(m.phi));
      const u = M.W && !m.total ? (M.uFn ? M.uFn(x, yb) : GWt * Math.max(0, M.yw(x) - yb)) : 0;
      sl.push({ x, yb, b, w, sinA, cosA, c: m.c, tan, u, phi: m.phi });
      sumW += w;
      drive += w * sinA;
    }
    if (!(drive > 1e-6)) return null;
    let FS = 1.5;
    for (let it = 0; it < 40; it++) {
      let num = 0;
      sl.forEach((s) => {
        const ma = s.cosA * (1 + ((s.sinA / s.cosA) * s.tan) / FS);
        num += (s.c * s.b + Math.max(0, s.w - s.u * s.b) * s.tan) / Math.max(ma, 0.2);
      });
      const f2 = num / drive;
      if (Math.abs(f2 - FS) < 1e-6) {
        FS = f2;
        break;
      }
      FS = f2;
    }
    if (!isFinite(FS) || FS <= 0) return null;
    const out: SlopeCircleResult = { FS, xc, yc, R: Rr, xL, xR, ylow };
    if (keep) {
      out.slices = sl;
      out.sumW = sumW;
      out.drive = drive;
    }
    return out;
  }

  function search(M: SlopeModel): SlopeCircleResult | null {
    const g = M.g,
      H = Math.max(g.yT, 2),
      T = M.bs.T;
    let best = null as (SlopeCircleResult & { yl: number }) | null;
    const tryC = (xc: number, yc: number, yl: number) => {
      const r = circleFS(M, xc, yc, yc - yl, false);
      if (r && (!best || r.FS < best.FS)) best = Object.assign(r, { yl });
    };
    const lows: number[] = [];
    for (let i = 0; i <= 6; i++) lows.push(-0.15 - ((T - 0.15) * i) / 6);
    for (let ix = 0; ix <= 22; ix++)
      for (let iy = 0; iy <= 16; iy++) {
        const xc = -0.8 * H + ((g.B + 2.6 * H) * ix) / 22,
          yc = 0.6 + (3.4 * H * iy) / 16;
        for (const yl of lows) tryC(xc, yc, yl);
      }
    const found = best as (SlopeCircleResult & { yl: number }) | null;
    if (!found) return null;
    let cur: SlopeCircleResult & { yl: number } = found;
    let sx = 0.4 * H,
      sy = 0.4 * H,
      sl = 0.5 * T;
    for (let it = 0; it < 40; it++) {
      const b0 = cur;
      let imp = false;
      [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 1, 0],
        [0, -1, 0],
        [0, 0, 1],
        [0, 0, -1],
        [1, 1, 0],
        [-1, -1, 0],
        [1, -1, 0],
        [-1, 1, 0],
      ].forEach((d) => {
        tryC(b0.xc + d[0] * sx, b0.yc + d[1] * sy, b0.yl + d[2] * sl);
      });
      cur = best!;
      if (cur.FS < b0.FS - 1e-7) imp = true;
      if (!imp) {
        sx *= 0.6;
        sy *= 0.6;
        sl *= 0.6;
        if (sx < 0.004) break;
      }
    }
    return cur;
  }

  function run(R: SlopeInputCarrier, opt?: SlopeOptions): SlopeRunResult {
    const M = model(R, opt),
      b = search(M);
    if (!b) return { ok: false, none: true, FSreq: 1 / M.bs.phiR, phiR: M.bs.phiR, M };
    const full = circleFS(M, b.xc, b.yc, b.R, true)!;
    const FSreq = 1 / M.bs.phiR;
    return {
      ok: full.FS >= FSreq - 1e-9,
      FS: full.FS,
      FSreq,
      phiR: M.bs.phiR,
      xc: full.xc,
      yc: full.yc,
      R: full.R,
      xL: full.xL,
      xR: full.xR,
      ylow: full.ylow,
      slices: full.slices,
      sumW: full.sumW,
      drive: full.drive,
      M,
      fnd: M.fnd,
      bkf: M.bkf,
      T: M.bs.T,
      Df: M.Df,
    };
  }

  return { run, circleFS, search, model, chord };
})();
