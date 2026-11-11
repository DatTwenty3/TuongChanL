import {
  CALC,
  FEM2D,
  WATER,
  calcFemOut,
  calcFemStale,
  calcGsOut,
  calcGsRows,
  calcGsStale,
  getFemCache,
  setCalcDec as setEngineCalcDec,
  type CantiCalcResult,
  type Fem2dJobOutput,
  type Fem2dRawMesh,
  type GsRow,
  type GsRunResult,
  type RibCalcResult,
} from '../engine';
import type { EngineCalcGeomData, EngineProject, EngineWaterSeep } from '../engine/types';
import type { Point2D } from '../types/project';
import {
  CFig,
  CF_CL,
  cnf,
  resetReportFigCounter,
  setCalcDec as setReportDec,
  setFemSecNo,
  setGsSecNo,
} from './cfig';
import { sF, sFig, sH2, sH3, sOk, sRow, sTab, sTx } from './reportHelpers';

export type GsFemReportResult = CantiCalcResult | RibCalcResult;

interface GsRawFields {
  mesh: Fem2dRawMesh;
  u: Point2D[];
  uT: Point2D[];
  plastic: Point2D[];
  uSRM: Point2D[];
  lvl: number[];
  lvg: number[];
}

type FemOutputExt = Fem2dJobOutput & {
  opt?: { lifts?: number; coarse?: boolean };
  figs?: { plastic?: string } | null;
  raw?: GsRawFields;
  mech?: { w: number; h: number; local: boolean } | null;
};

interface GsTickSet {
  st: number;
  v: number[];
  dec: number;
}

interface GsFrame {
  W: number;
  H: number;
  ml: number;
  mt: number;
  aw: number;
  ah: number;
  sc: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  X: (x: number) => number;
  Y: (y: number) => number;
}

interface GsFlatMesh {
  X: Float64Array;
  Y: Float64Array;
  T: Int32Array;
  mat: Uint8Array | Int8Array | number[];
  ne: number;
  nn: number;
}

export interface GsChartLegendItem {
  t: string;
  c: string;
  dash?: string;
  x?: boolean;
}

export interface GsChartOptions {
  W?: number;
  dom: { x0: number; x1: number; y0: number; y1: number };
  title: string;
  field?: {
    make: (F: GsFrame) => string | null;
    vec: (F: GsFrame) => string;
  };
  bar?: {
    label: string;
    vmin: number;
    vmax: number;
    ext?: boolean;
    ticks?: GsTickSet;
  };
  over?: (F: GsFrame) => string;
  legend?: GsChartLegendItem[];
}

export function cfFemChart(R: GsFemReportResult, o: Fem2dJobOutput): string {
  const st = o.stages.find((s) => s.name.startsWith('S3')) || o.stages[o.stages.length - 1];
  const B = R.g.B;
  const SD = R.SD;
  const pr = SD && SD.N > 0 ? CALC.press(SD.N, SD.s, B) : null;
  const eng: Point2D[] = pr ? Array.from({ length: 41 }, (_, i) => [(B * i) / 40, pr.q((B * i) / 40)]) : [];
  const W = 760;
  const ml = 74;
  const mr = 24;
  const mt = 30;
  const mb = 46;
  const hh = 260;
  const H = hh + mt + mb;
  const D = CFig(W, H);
  const pw = W - ml - mr;
  const mx = Math.max(...st.pBase.map((p) => p[1]), ...eng.map((p) => p[1]), 1) * 1.1;
  const X = (x: number) => ml + (x / B) * pw;
  const Y = (v: number) => mt + hh - (v / mx) * hh;
  const nice = (() => {
    const t = mx / 5;
    const e = Math.pow(10, Math.floor(Math.log10(t)));
    const f = t / e;
    return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * e;
  })();

  for (let v = 0; v <= mx + 1e-9; v += nice) {
    D.lp(ml, Y(v), ml + pw, Y(v), 'stroke="#ddd" stroke-width="0.6"');
    D.tp(ml - 6, Y(v) + 4, cnf(v, 0), { a: 'end', fs: 11, free: true });
  }
  const sx = B > 6 ? 1 : 0.5;
  for (let x = 0; x <= B + 1e-9; x += sx) {
    D.lp(X(x), mt, X(x), mt + hh, 'stroke="#eee" stroke-width="0.6"');
    D.tp(X(x), mt + hh + 15, cnf(x, sx < 1 ? 1 : 0), { a: 'middle', fs: 11, free: true });
  }
  D.lp(ml, mt, ml, mt + hh, 'stroke="#222" stroke-width="1"');
  D.lp(ml, mt + hh, ml + pw, mt + hh, 'stroke="#222" stroke-width="1"');
  const poly = (L: Point2D[], c: string, w: number, dash?: string) => {
    D.s += `<polyline fill="none" stroke="${c}" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ''} points="${L.map((p) => X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ')}"/>`;
  };
  if (eng.length) poly(eng, CF_CL.r, 1.8, '7,3');
  poly(st.pBase, CF_CL.g, 2.2);
  const pf = st.pBase[Math.round(st.pBase.length * 0.62)];
  const pe = eng.length ? eng[Math.round(eng.length * 0.3)] : null;
  D.tp(X(pf[0]) + 6, Y(pf[1]) - 10, 'phần tử hữu hạn (S3)', { c: 'g', fs: 12, b: true });
  if (pe) {
    D.tp(X(pe[0]) + 8, Y(pe[1]) - 12, 'lõi tính (tuyến tính, TTGH Sử dụng I)', {
      c: 'r',
      fs: 12,
      b: true,
    });
  }
  D.tp(ml + pw / 2, H - 6, 'Khoảng cách từ mép mũi x (m)', { a: 'middle', fs: 12, free: true });
  D.tp(16, mt + hh / 2, 'Áp lực đáy (kPa)', { a: 'middle', fs: 12, rot: -90, free: true });
  return D.svg();
}

const cfFemImg = (s: string) => String(s).replace('<svg ', '<svg class="dg" ');

const cfGsRaw = (o: FemOutputExt) => ({
  mesh: o.raw!.mesh,
  u: o.raw!.u,
  uT: o.raw!.uT,
  plastic: o.raw!.plastic,
  uSRM: o.raw!.uSRM,
  lvl: o.raw!.lvl,
  lvg: o.raw!.lvg,
});

export const gsSup = (n: number | string): string =>
  String(n)
    .replace(/-/g, '⁻')
    .replace(/[0-9]/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]);

export const gsK = (v: number): string => {
  if (!(v > 0)) return '-';
  const e = Math.floor(Math.log10(v) + 1e-9);
  const m = v / Math.pow(10, e);
  return cnf(m, 1) + '×10' + gsSup(e);
};

const GS_JET: Array<Array<[number, number]>> = [
  [
    [0, 0],
    [0.35, 0],
    [0.66, 1],
    [0.89, 1],
    [1, 0.5],
  ],
  [
    [0, 0],
    [0.125, 0],
    [0.375, 1],
    [0.64, 1],
    [0.91, 0],
    [1, 0],
  ],
  [
    [0, 0.5],
    [0.11, 1],
    [0.34, 1],
    [0.65, 0],
    [1, 0],
  ],
];

const gsLerp = (A: Array<[number, number]>, t: number): number => {
  for (let i = 1; i < A.length; i++) {
    if (t <= A[i][0]) {
      return A[i - 1][1] + ((A[i][1] - A[i - 1][1]) * (t - A[i - 1][0])) / (A[i][0] - A[i - 1][0]);
    }
  }
  return A[A.length - 1][1];
};

const gsJet = (t: number): number[] => {
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  return GS_JET.map((A) => Math.round(255 * gsLerp(A, clamped)));
};

const gsHex = (c: number[]): string => '#' + c.map((v) => (v + 256).toString(16).slice(1)).join('');

let _gsLut: Uint32Array | null = null;
export const gsLut = (): Uint32Array =>
  _gsLut ||
  (_gsLut = Uint32Array.from({ length: 256 }, (_, i) => {
    const c = gsJet(i / 255);
    return ((255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0;
  }));

const gsEsc = (t: unknown): string => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const gsN = (v: number, d: number): string => cnf(v, d).replace('-', '−');
const GS_ST_AX = [1, 2, 2.5, 5, 10];
const GS_ST_BAR = [1, 2, 2.5, 3, 4, 5, 6, 8, 10];

function gsTicks(lo: number, hi: number, nb: number, steps?: number[]): GsTickSet {
  const span = hi - lo;
  if (!(span > 1e-12)) return { st: 1, v: [lo], dec: 0 };
  const p0 = Math.floor(Math.log10(span / nb)) - 1;
  let st = 0;
  let bd = 1e9;
  for (let k = 0; k < 4; k++) {
    for (const m of steps || GS_ST_AX) {
      const t = m * Math.pow(10, p0 + k);
      const cnt = Math.floor(hi / t + 1e-9) - Math.ceil(lo / t - 1e-9) + 1;
      const d = Math.abs(cnt - nb) + (cnt < 3 ? 50 : 0);
      if (d < bd - 1e-9 || (Math.abs(d - bd) <= 1e-9 && t > st)) {
        bd = d;
        st = t;
      }
    }
  }
  const v: number[] = [];
  for (let k = Math.ceil(lo / st - 1e-9); k * st <= hi + 1e-9; k++) {
    v.push(Math.round(k * st * 1e9) / 1e9);
  }
  let dec = 0;
  while (dec < 4 && Math.abs(st * Math.pow(10, dec) - Math.round(st * Math.pow(10, dec))) > 1e-6) {
    dec++;
  }
  return { st, v, dec };
}

function gsFrame(o: {
  W?: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  bar?: boolean;
}): GsFrame {
  const W = o.W || 760;
  const ml = 64;
  const mt = 38;
  const mb = 50;
  const mr = o.bar ? 112 : 16;
  const aw = W - ml - mr;
  const sc = aw / (o.x1 - o.x0);
  const ah = (o.y1 - o.y0) * sc;
  return {
    W,
    H: Math.round(ah + mt + mb),
    ml,
    mt,
    aw,
    ah,
    sc,
    x0: o.x0,
    x1: o.x1,
    y0: o.y0,
    y1: o.y1,
    X: (x) => ml + (x - o.x0) * sc,
    Y: (y) => mt + ah - (y - o.y0) * sc,
  };
}

const _gsMeshCache = new WeakMap<object, GsFlatMesh>();
const _gsMemo = new WeakMap<object, Map<string, unknown>>();

function gsMeshOf(
  m: Fem2dRawMesh | { X: Float64Array; Y: Float64Array; T: Int32Array; mat: Uint8Array | Int8Array; ne: number; nn: number },
): GsFlatMesh {
  const cached = _gsMeshCache.get(m);
  if (cached) return cached;
  let r: GsFlatMesh;
  if ('nodes' in m && m.nodes) {
    const raw = m as Fem2dRawMesh & {
      nodes: Point2D[];
      tris: number[][];
      mat: Uint8Array | Int8Array | number[];
    };
    const nn = raw.nodes.length;
    const ne = raw.tris.length;
    const X = new Float64Array(nn);
    const Y = new Float64Array(nn);
    const T = new Int32Array(6 * ne);
    raw.nodes.forEach((p, i) => {
      X[i] = p[0];
      Y[i] = p[1];
    });
    raw.tris.forEach((t, e) => {
      for (let a = 0; a < 6; a++) T[6 * e + a] = t[a];
    });
    r = { X, Y, T, mat: raw.mat, ne, nn };
  } else {
    const flat = m as GsFlatMesh;
    r = { X: flat.X, Y: flat.Y, T: flat.T, mat: flat.mat, ne: flat.ne, nn: flat.nn };
  }
  _gsMeshCache.set(m, r);
  return r;
}

function gsMemo<T>(obj: object, key: string, fn: () => T): T {
  let m = _gsMemo.get(obj);
  if (!m) {
    m = new Map();
    _gsMemo.set(obj, m);
  }
  if (!m.has(key)) m.set(key, fn());
  return m.get(key) as T;
}

function gsTri(
  buf: Uint32Array,
  w: number,
  h: number,
  lut: Uint32Array,
  a: [number, number, number],
  b: [number, number, number],
  c: [number, number, number],
): void {
  const xa = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]) - 0.5));
  const xb = Math.min(w - 1, Math.ceil(Math.max(a[0], b[0], c[0]) - 0.5));
  const ya = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]) - 0.5));
  const yb = Math.min(h - 1, Math.ceil(Math.max(a[1], b[1], c[1]) - 0.5));
  const d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
  if (Math.abs(d) < 1e-9) return;
  const id = 1 / d;
  for (let y = ya; y <= yb; y++) {
    for (let x = xa; x <= xb; x++) {
      const px = x + 0.5 - c[0];
      const py = y + 0.5 - c[1];
      const l1 = ((b[1] - c[1]) * px + (c[0] - b[0]) * py) * id;
      const l2 = ((c[1] - a[1]) * px + (a[0] - c[0]) * py) * id;
      const l3 = 1 - l1 - l2;
      if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
      const v = l1 * a[2] + l2 * b[2] + l3 * c[2];
      buf[y * w + x] = lut[v < 0 ? 0 : v > 255 ? 255 : (v + 0.5) | 0];
    }
  }
}

const GS_SUB: Array<[number, number, number]> = [
  [0, 3, 5],
  [3, 1, 4],
  [5, 4, 2],
  [3, 4, 5],
];

export function gsRaster(
  M: GsFlatMesh,
  val: Float64Array,
  vmin: number,
  vmax: number,
  F: GsFrame,
  o: { mag?: number; U?: Point2D[]; lines?: boolean },
): string | null {
  if (typeof document === 'undefined') return null;
  try {
    const w = Math.round(2 * F.aw);
    const h = Math.round(2 * F.ah);
    const rs = 2 * F.sc;
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const cx = cv.getContext('2d');
    if (!cx) return null;
    const im = cx.createImageData(w, h);
    const buf = new Uint32Array(im.data.buffer);
    const lut = gsLut();
    const mag = o.mag || 0;
    const U = o.U || [];
    const k = 255 / (vmax - vmin || 1);
    const PX = new Float64Array(M.nn);
    const PY = new Float64Array(M.nn);
    const PV = new Float64Array(M.nn);
    buf.fill(4294967295);
    for (let i = 0; i < M.nn; i++) {
      PX[i] = (M.X[i] + (mag ? mag * U[i][0] : 0) - F.x0) * rs;
      PY[i] = (F.y1 - M.Y[i] - (mag ? mag * U[i][1] : 0)) * rs;
      PV[i] = (val[i] - vmin) * k;
    }
    for (let e = 0; e < M.ne; e++) {
      if (M.mat[e] === 0) continue;
      for (const s of GS_SUB) {
        const a = M.T[6 * e + s[0]];
        const b = M.T[6 * e + s[1]];
        const c = M.T[6 * e + s[2]];
        gsTri(buf, w, h, lut, [PX[a], PY[a], PV[a]], [PX[b], PY[b], PV[b]], [PX[c], PY[c], PV[c]]);
      }
    }
    cx.putImageData(im, 0, 0);
    if (o.lines) {
      cx.strokeStyle = 'rgba(0,0,0,0.32)';
      cx.lineWidth = 1;
      cx.beginPath();
      const seen = new Set<number>();
      for (let e = 0; e < M.ne; e++) {
        if (M.mat[e] === 0) continue;
        for (let q = 0; q < 3; q++) {
          const a = M.T[6 * e + q];
          const b = M.T[6 * e + ((q + 1) % 3)];
          const m = M.T[6 * e + 3 + q];
          const key = a < b ? a * 1048576 + b : b * 1048576 + a;
          if (seen.has(key)) continue;
          seen.add(key);
          if (Math.hypot(PX[a] - PX[b], PY[a] - PY[b]) < 7) continue;
          cx.moveTo(PX[a], PY[a]);
          cx.lineTo(PX[m], PY[m]);
          cx.lineTo(PX[b], PY[b]);
        }
      }
      cx.stroke();
    }
    return cv.toDataURL('image/jpeg', 0.92);
  } catch {
    return null;
  }
}

export function gsVec(
  M: GsFlatMesh,
  val: Float64Array,
  vmin: number,
  vmax: number,
  F: GsFrame,
  o: { mag?: number; U?: Point2D[] },
): string {
  const nb = 48;
  const paths = new Array<string>(nb).fill('');
  const mag = o.mag || 0;
  const U = o.U || [];
  const f1 = (v: number) => Math.round(v * 10) / 10;
  const P = (i: number) =>
    f1(F.X(M.X[i] + (mag ? mag * U[i][0] : 0))) +
    ' ' +
    f1(F.Y(M.Y[i] + (mag ? mag * U[i][1] : 0)));
  for (let e = 0; e < M.ne; e++) {
    if (M.mat[e] === 0) continue;
    for (const s of GS_SUB) {
      const a = M.T[6 * e + s[0]];
      const b = M.T[6 * e + s[1]];
      const c = M.T[6 * e + s[2]];
      const t = ((val[a] + val[b] + val[c]) / 3 - vmin) / (vmax - vmin || 1);
      paths[Math.max(0, Math.min(nb - 1, Math.floor(t * nb)))] +=
        'M' + P(a) + 'L' + P(b) + 'L' + P(c) + 'Z';
    }
  }
  return paths
    .map((d, k) => {
      if (!d) return '';
      const c = gsHex(gsJet((k + 0.5) / nb));
      return `<path d="${d}" fill="${c}" stroke="${c}" stroke-width="0.5"/>`;
    })
    .join('');
}

let _gsId = 0;
export function gsChart(o: GsChartOptions): string {
  const D = o.dom;
  const F = gsFrame({ W: o.W, x0: D.x0, x1: D.x1, y0: D.y0, y1: D.y1, bar: !!o.bar });
  const X = F.X;
  const Y = F.Y;
  const f1 = (v: number) => Math.round(v * 10) / 10;
  const id = 'gc' + ++_gsId;
  const bx0 = F.ml;
  const by0 = F.mt;
  const bw = f1(F.aw);
  const bh = f1(F.ah);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${F.W} ${F.H}" width="${F.W}" height="${F.H}" font-family="DejaVu Sans,Segoe UI,Arial,sans-serif" font-size="10.5"><rect width="${F.W}" height="${F.H}" fill="#fff"/>`;
  s += `<defs><clipPath id="${id}c"><rect x="${bx0}" y="${by0}" width="${bw}" height="${bh}"/></clipPath>`;
  if (o.bar) {
    s += `<linearGradient id="${id}g" x1="0" y1="1" x2="0" y2="0">${[0, 0.11, 0.125, 0.34, 0.35, 0.375, 0.64, 0.65, 0.66, 0.89, 0.91, 1]
      .map((t) => `<stop offset="${t}" stop-color="${gsHex(gsJet(t))}"/>`)
      .join('')}</linearGradient>`;
  }
  s += '</defs>';
  if (o.field) {
    const url = o.field.make(F);
    s += url
      ? `<image x="${bx0}" y="${by0}" width="${bw}" height="${bh}" preserveAspectRatio="none" href="${url}"/>`
      : `<g clip-path="url(#${id}c)">${o.field.vec(F)}</g>`;
  }
  const gx = gsTicks(F.x0, F.x1, 6);
  const gy = gsTicks(F.y0, F.y1, 9);
  s += `<g clip-path="url(#${id}c)" stroke="#8a8a8a" stroke-width="0.7" stroke-dasharray="1.2 2.4" opacity="0.6">${gx.v
    .map((v) => `<line x1="${f1(X(v))}" y1="${by0}" x2="${f1(X(v))}" y2="${f1(by0 + F.ah)}"/>`)
    .join('')}${gy.v
    .map((v) => `<line x1="${bx0}" y1="${f1(Y(v))}" x2="${f1(bx0 + F.aw)}" y2="${f1(Y(v))}"/>`)
    .join('')}</g>`;
  if (o.over) s += `<g clip-path="url(#${id}c)">${o.over(F)}</g>`;
  s += `<rect x="${bx0}" y="${by0}" width="${bw}" height="${bh}" fill="none" stroke="#000" stroke-width="0.9"/>`;
  gx.v.forEach((v) => {
    s += `<line x1="${f1(X(v))}" y1="${f1(by0 + F.ah)}" x2="${f1(X(v))}" y2="${f1(by0 + F.ah + 4)}" stroke="#000" stroke-width="0.8"/><text x="${f1(X(v))}" y="${f1(by0 + F.ah + 17)}" text-anchor="middle">${gsN(v, gx.dec)}</text>`;
  });
  gy.v.forEach((v) => {
    s += `<line x1="${bx0 - 4}" y1="${f1(Y(v))}" x2="${bx0}" y2="${f1(Y(v))}" stroke="#000" stroke-width="0.8"/><text x="${bx0 - 7}" y="${f1(Y(v) + 3.7)}" text-anchor="end">${gsN(v, gy.dec)}</text>`;
  });
  s += `<text x="${f1(bx0 + F.aw / 2)}" y="${f1(by0 + F.ah + 38)}" text-anchor="middle" font-weight="bold" font-size="11">Khoảng cách (m)</text><text transform="translate(13 ${f1(by0 + F.ah / 2)}) rotate(-90)" text-anchor="middle" font-weight="bold" font-size="11">Cao độ (m)</text>`;
  s += `<text x="${f1(bx0 + F.aw / 2)}" y="23" text-anchor="middle" font-size="12">${gsEsc(o.title)}</text>`;
  if (o.bar) {
    const b = o.bar;
    const cx0 = bx0 + F.aw + 16;
    const cw = 20;
    const ex = b.ext ? Math.min(0.06 * F.ah, 16) : 0;
    const ct = by0 + ex;
    const ch = F.ah - 2 * ex;
    const ty = (v: number) => ct + ch - ((v - b.vmin) / (b.vmax - b.vmin || 1)) * ch;
    const tk = b.ticks || gsTicks(b.vmin, b.vmax, 10, GS_ST_BAR);
    s += `<rect x="${cx0}" y="${f1(ct)}" width="${cw}" height="${f1(ch)}" fill="url(#${id}g)"/>`;
    if (ex) {
      s += `<polygon points="${cx0},${f1(ct)} ${cx0 + cw},${f1(ct)} ${cx0 + cw / 2},${f1(by0)}" fill="${gsHex(gsJet(1))}"/><polygon points="${cx0},${f1(ct + ch)} ${cx0 + cw},${f1(ct + ch)} ${cx0 + cw / 2},${f1(by0 + F.ah)}" fill="${gsHex(gsJet(0))}"/><polygon points="${cx0},${f1(ct)} ${cx0 + cw / 2},${f1(by0)} ${cx0 + cw},${f1(ct)} ${cx0 + cw},${f1(ct + ch)} ${cx0 + cw / 2},${f1(by0 + F.ah)} ${cx0},${f1(ct + ch)}" fill="none" stroke="#000" stroke-width="0.8"/>`;
    } else {
      s += `<rect x="${cx0}" y="${f1(ct)}" width="${cw}" height="${f1(ch)}" fill="none" stroke="#000" stroke-width="0.8"/>`;
    }
    let tw = 0;
    tk.v.forEach((v) => {
      const t = gsN(v, tk.dec);
      tw = Math.max(tw, t.length);
      s += `<line x1="${cx0 + cw}" y1="${f1(ty(v))}" x2="${cx0 + cw + 3.5}" y2="${f1(ty(v))}" stroke="#000" stroke-width="0.8"/><text x="${cx0 + cw + 7}" y="${f1(ty(v) + 3.7)}">${t}</text>`;
    });
    s += `<text transform="translate(${f1(cx0 + cw + 12 + tw * 6.1 + 11)} ${f1(by0 + F.ah / 2)}) rotate(-90)" text-anchor="middle" font-size="11">${gsEsc(b.label)}</text>`;
  }
  if (o.legend && o.legend.length) {
    const lw = Math.round(o.legend.reduce((m, e) => Math.max(m, e.t.length), 0) * 5.5 + 46);
    const lh = 9 + o.legend.length * 15.5;
    const lx = bx0 + F.aw - lw - 7;
    const ly = by0 + 7;
    s += `<rect x="${f1(lx)}" y="${ly}" width="${lw}" height="${lh}" rx="2.5" fill="#fff" fill-opacity="0.85" stroke="#cfcfcf" stroke-width="0.8"/>`;
    o.legend.forEach((e, i) => {
      const yy = ly + 14.5 + i * 15.5;
      s +=
        (e.x
          ? `<path d="M${f1(lx + 14)} ${f1(yy - 8.3)}l7 7m0 -7l-7 7" stroke="${e.c}" stroke-width="1.5" fill="none"/>`
          : `<line x1="${f1(lx + 8)}" y1="${f1(yy - 4)}" x2="${f1(lx + 28)}" y2="${f1(yy - 4)}" stroke="${e.c}" stroke-width="2"${e.dash ? ` stroke-dasharray="${e.dash}"` : ''}/>`) +
        `<text x="${f1(lx + 35)}" y="${f1(yy)}" font-size="9.5">${gsEsc(e.t)}</text>`;
    });
  }
  return s + '</svg>';
}

const gsPts = (P: Point2D[], F: GsFrame): string =>
  P.map((p) => Math.round(F.X(p[0]) * 10) / 10 + ',' + Math.round(F.Y(p[1]) * 10) / 10).join(' ');

function gsWallSvg(R: GsFemReportResult, F: GsFrame): string {
  const g = R.g;
  return (
    [g.foot, g.stem]
      .map((P) => `<polygon points="${gsPts(P, F)}" fill="none" stroke="#000" stroke-width="4.6"/>`)
      .join('') +
    [g.foot, g.stem]
      .map((P) => `<polygon points="${gsPts(P, F)}" fill="#fff" stroke="none"/>`)
      .join('')
  );
}

export function gsKeyPolys(g: EngineCalcGeomData): Point2D[][] {
  const P = g.foot;
  const n = P ? P.length : 0;
  const res: Point2D[][] = [];
  if (n < 3) return res;
  const neg = P.map((p) => p[1] < -1e-6);
  if (!neg.some(Boolean) || neg.every(Boolean)) return res;
  const cut = (a: Point2D, b: Point2D): Point2D => {
    const t = (0 - a[1]) / (b[1] - a[1]);
    return [a[0] + t * (b[0] - a[0]), 0];
  };
  for (let i = 0; i < n; i++) {
    if (!(neg[i] && !neg[(i + n - 1) % n])) continue;
    const pr = P[(i + n - 1) % n];
    const run: Point2D[] = [cut(pr, P[i])];
    let j = i;
    while (neg[j]) {
      run.push([P[j][0], P[j][1]]);
      j = (j + 1) % n;
    }
    run.push(cut(P[(j + n - 1) % n], P[j]));
    res.push(run);
  }
  return res;
}

function gsDispAt(M: GsFlatMesh, U: Point2D[], x: number, y: number): Point2D {
  for (let e = 0; e < M.ne; e++) {
    const a = M.T[6 * e];
    const b = M.T[6 * e + 1];
    const c = M.T[6 * e + 2];
    const x1 = M.X[a];
    const y1 = M.Y[a];
    const x2 = M.X[b];
    const y2 = M.Y[b];
    const x3 = M.X[c];
    const y3 = M.Y[c];
    if (
      x < Math.min(x1, x2, x3) - 1e-9 ||
      x > Math.max(x1, x2, x3) + 1e-9 ||
      y < Math.min(y1, y2, y3) - 1e-9 ||
      y > Math.max(y1, y2, y3) + 1e-9
    ) {
      continue;
    }
    const d = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3);
    if (Math.abs(d) < 1e-14) continue;
    const l1 = ((y2 - y3) * (x - x3) + (x3 - x2) * (y - y3)) / d;
    const l2 = ((y3 - y1) * (x - x3) + (x1 - x3) * (y - y3)) / d;
    const l3 = 1 - l1 - l2;
    if (l1 >= -1e-9 && l2 >= -1e-9 && l3 >= -1e-9) {
      return [
        l1 * U[a][0] + l2 * U[b][0] + l3 * U[c][0],
        l1 * U[a][1] + l2 * U[b][1] + l3 * U[c][1],
      ];
    }
  }
  return [0, 0];
}

function gsWallDef(
  M: GsFlatMesh,
  U: Point2D[],
  mag: number,
  F: GsFrame,
  R: GsFemReportResult,
): string {
  const f1 = (v: number) => Math.round(v * 10) / 10;
  const P = (i: number) =>
    f1(F.X(M.X[i] + (mag ? mag * U[i][0] : 0))) +
    ' ' +
    f1(F.Y(M.Y[i] + (mag ? mag * U[i][1] : 0)));
  const edges = new Map<number, [number, number, number] | null>();
  let fill = '';
  for (let e = 0; e < M.ne; e++) {
    if (M.mat[e] !== 0) continue;
    const t = M.T.subarray(6 * e, 6 * e + 6);
    fill += 'M' + P(t[0]) + 'L' + P(t[1]) + 'L' + P(t[2]) + 'Z';
    for (let q = 0; q < 3; q++) {
      const a = t[q];
      const b = t[(q + 1) % 3];
      const key = a < b ? a * 1048576 + b : b * 1048576 + a;
      edges.set(key, edges.has(key) ? null : [a, t[3 + q], b]);
    }
  }
  const keys = R && R.g ? gsKeyPolys(R.g) : [];
  const kr = keys.map((K) => [Math.min(...K.map((q) => q[0])), Math.max(...K.map((q) => q[0]))]);
  const onKeyTop = (v: [number, number, number]) =>
    kr.length > 0 &&
    [v[0], v[1], v[2]].every((i) => Math.abs(M.Y[i]) < 1e-9) &&
    kr.some(
      (r) =>
        Math.min(M.X[v[0]], M.X[v[2]]) >= r[0] - 1e-6 &&
        Math.max(M.X[v[0]], M.X[v[2]]) <= r[1] + 1e-6,
    );
  let ol = '';
  edges.forEach((v) => {
    if (v && !onKeyTop(v)) ol += 'M' + P(v[0]) + 'L' + P(v[1]) + 'L' + P(v[2]);
  });
  let kf = '';
  let ko = '';
  keys.forEach((K) => {
    const D: Point2D[] = [];
    for (let i = 0; i + 1 < K.length; i++) {
      const a = K[i];
      const b = K[i + 1];
      const n = Math.max(1, Math.min(24, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.08)));
      for (let k = 0; k < n; k++) {
        D.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
      }
    }
    D.push(K[K.length - 1]);
    const Q = D.map((p) => {
      const u = mag ? gsDispAt(M, U, p[0], p[1]) : [0, 0];
      return f1(F.X(p[0] + mag * u[0])) + ' ' + f1(F.Y(p[1] + mag * u[1]));
    });
    kf += 'M' + Q.join('L') + 'Z';
    ko += 'M' + Q.join('L');
  });
  return `<path d="${fill}${kf}" fill="#fff" stroke="#fff" stroke-width="0.8"/><path d="${ol}${ko}" fill="none" stroke="#000" stroke-width="2.3" stroke-linejoin="round"/>`;
}

const GS_CF = '#00e5ff';
const GS_CB = '#00008b';
const GS_MB = '#0000ff';
const gsGW = WATER.GW;
const gsIn = (P: Point2D[], x: number, y: number): boolean => WATER.inPoly(P, x, y);

const gsWallX = (g: EngineCalcGeomData, y: number, side: number): number | null => {
  let r: number | null = null;
  [g.foot, g.stem].forEach((P) => {
    for (let i = 0; i < P.length; i++) {
      const a = P[i];
      const b = P[(i + 1) % P.length];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
        const x = a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]);
        if (r === null || (side < 0 ? x < r : x > r)) r = x;
      }
    }
  });
  return r;
};

function gsPhreatic(R: GsFemReportResult, S: EngineWaterSeep): Point2D[] {
  return gsMemo(S, 'phr', () => {
    const g = R.g;
    const L = S.hB;
    const pts: Point2D[] = [];
    if (!(L > 1e-6)) return pts;
    const x0 = gsWallX(g, L, 1);
    const x1 = S.X[S.nx];
    if (x0 == null) return pts;
    const inW = (x: number, y: number) => gsIn(g.stem, x, y) || gsIn(g.foot, x, y);
    const gf = (x: number, y: number) => {
      const v = S.headAt(x, y);
      return (isFinite(v) ? v : L) - y;
    };
    for (let k = 0; k <= 140; k++) {
      const x = x0 + (x1 - x0) * Math.pow(k / 140, 1.7);
      let lo = 0;
      let hi = L;
      let y: number;
      if (gf(x, hi) >= 0) y = hi;
      else if (gf(x, lo) <= 0) continue;
      else {
        for (let it = 0; it < 40; it++) {
          const m = 0.5 * (lo + hi);
          if (gf(x, m) > 0) lo = m;
          else hi = m;
        }
        y = 0.5 * (lo + hi);
      }
      if (!inW(x, y)) pts.push([x, y]);
    }
    if (pts.length) {
      const xf = gsWallX(g, pts[0][1], 1);
      if (xf != null && xf < pts[0][0] - 1e-6) pts.unshift([xf, pts[0][1]]);
    }
    return pts;
  });
}

const gsPhrSvg = (
  R: GsFemReportResult,
  F: GsFrame,
  S: EngineWaterSeep | null | undefined,
  col: string,
  dash: string,
  w: number,
  skipFlat?: boolean,
): string => {
  let P = S ? gsPhreatic(R, S) : [];
  if (skipFlat && P.length && Math.max(...P.map((q) => S!.hB - q[1])) < 0.05) P = [];
  return P.length > 1
    ? `<polyline points="${gsPts(P, F)}" fill="none" stroke="${col}" stroke-width="${w || 1.7}"${dash ? ` stroke-dasharray="${dash}"` : ''} stroke-linejoin="round"/>`
    : '';
};

function gsWaterSvg(
  R: GsFemReportResult,
  F: GsFrame,
  S?: EngineWaterSeep | null,
): string {
  const W = R.W;
  if (!W) return '';
  const g = R.g;
  const f1 = (v: number) => Math.round(v * 10) / 10;
  const X = F.X;
  const Y = F.Y;
  const xf = gsWallX(g, W.hF, -1);
  const xb = gsWallX(g, W.hB, 1);
  const xe = xf == null ? 0 : xf;
  const xs = xb == null ? g.xbt : xb;
  const mk = (x: number, y: number, c: string) =>
    `<polygon points="${f1(X(x) - 4.8)},${f1(Y(y) - 4.3)} ${f1(X(x) + 4.8)},${f1(Y(y) - 4.3)} ${f1(X(x))},${f1(Y(y) + 4.8)}" fill="${c}"/>`;
  return (
    `<line x1="${f1(X(F.x0))}" y1="${f1(Y(W.hF))}" x2="${f1(X(xe))}" y2="${f1(Y(W.hF))}" stroke="${GS_CF}" stroke-width="1.7" stroke-dasharray="7 3"/>` +
    mk(F.x0 + 0.6 * (xe - F.x0), W.hF, GS_CF) +
    `<line x1="${f1(X(xs))}" y1="${f1(Y(W.hB))}" x2="${f1(X(F.x1))}" y2="${f1(Y(W.hB))}" stroke="${GS_CB}" stroke-width="1.7" stroke-dasharray="7 3"/>` +
    mk(xs + 0.47 * (F.x1 - xs), W.hB, GS_MB) +
    gsPhrSvg(R, F, S, GS_CF, '7 3', 1.7, true)
  );
}

const GS_LEG_W: GsChartLegendItem[] = [
  { t: 'MN thượng lưu', c: GS_CB, dash: '7 3' },
  { t: 'MN hạ lưu', c: GS_CF, dash: '7 3' },
];

function gsDom(
  R: GsFemReportResult,
  fo: { model?: { Lf: number; Lb: number; Dd: number } } | null,
): { x0: number; x1: number; y0: number; y1: number } {
  const g = R.g;
  const I = R.I;
  const H = g.yT;
  const top = g.yT + Math.max(0, I.Hs || 0);
  const m = fo && fo.model ? fo.model : FEM2D.domain(R, I.wOn ? Math.max(1, I.Tn || 0) : 0);
  return { x0: -m.Lf, x1: g.B + m.Lb, y0: -m.Dd, y1: top + Math.max(1.4 * H, 4) };
}

const gsSoil = (M: GsFlatMesh, f: (i: number) => number): { lo: number; hi: number } => {
  const m = new Uint8Array(M.nn);
  for (let e = 0; e < M.ne; e++) {
    if (M.mat[e] !== 0) for (let a = 0; a < 6; a++) m[M.T[6 * e + a]] = 1;
  }
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < M.nn; i++) {
    if (m[i]) {
      const v = f(i);
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  return { lo, hi };
};

export function cfGsPore(R: GsFemReportResult, S: EngineWaterSeep, Wd?: number): string {
  const I = R.I;
  const mm = gsMemo(S, 'mesh', () => {
    const M = FEM2D.modelFromR(R, { coarse: false, water: { Tn: Math.max(1, I.Tn || 0) } as never });
    return { M, mesh: gsMeshOf(FEM2D.buildMesh(M.spec)) };
  });
  const M = mm.mesh;
  const val = gsMemo(S, 'u', () => {
    const v = new Float64Array(M.nn);
    for (let i = 0; i < M.nn; i++) {
      const x = M.X[i];
      const y = M.Y[i];
      const L = S.level(x);
      let hh = y < L ? S.headAt(x, y) : L;
      if (!isFinite(hh)) hh = L;
      v[i] = gsGW * (hh - y);
    }
    return v;
  });
  const rg = gsSoil(M, (i) => val[i]);
  if (!(rg.hi > 1e-6)) return '';
  const vmin = rg.lo < -0.05 ? rg.lo : 0;
  const dom = gsDom(R, { model: mm.M });
  return gsChart({
    W: Wd || 760,
    dom,
    title: 'Bản đồ Phân bố Áp lực nước lỗ rỗng (Pore Water Pressure Contour)',
    field: {
      make: (F) => gsMemo(S, 'png|' + F.W, () => gsRaster(M, val, vmin, rg.hi, F, {})),
      vec: (F) => gsVec(M, val, vmin, rg.hi, F, {}),
    },
    bar: {
      label: 'Áp lực nước lỗ rỗng / Pore Pressure u (kPa)',
      vmin,
      vmax: rg.hi,
      ext: false,
    },
    over: (F) => gsWallSvg(R, F) + gsWaterSvg(R, F) + gsPhrSvg(R, F, S, GS_CB, '', 1.5),
    legend: GS_LEG_W,
  });
}

function gsSmooth(M: GsFlatMesh, val: Float64Array, sg: number): Float64Array {
  const ok = new Uint8Array(M.nn);
  for (let e = 0; e < M.ne; e++) {
    if (M.mat[e] !== 0) for (let a = 0; a < 6; a++) ok[M.T[6 * e + a]] = 1;
  }
  const cs = 2.5 * sg;
  const inv = 1 / cs;
  const key = (i: number, j: number) => i * 100003 + j;
  const bk = new Map<number, number[]>();
  const out = new Float64Array(M.nn);
  const s2 = 1 / (2 * sg * sg);
  for (let n = 0; n < M.nn; n++) {
    if (ok[n]) {
      const k = key(Math.floor(M.X[n] * inv), Math.floor(M.Y[n] * inv));
      let L = bk.get(k);
      if (!L) bk.set(k, (L = []));
      L.push(n);
    }
  }
  for (let n = 0; n < M.nn; n++) {
    if (!ok[n]) {
      out[n] = val[n];
      continue;
    }
    const ci = Math.floor(M.X[n] * inv);
    const cj = Math.floor(M.Y[n] * inv);
    let sw = 0;
    let sv = 0;
    for (let a = ci - 1; a <= ci + 1; a++) {
      for (let b = cj - 1; b <= cj + 1; b++) {
        const L = bk.get(key(a, b));
        if (!L) continue;
        for (const m of L) {
          const dx = M.X[m] - M.X[n];
          const dy = M.Y[m] - M.Y[n];
          const d2 = dx * dx + dy * dy;
          if (d2 > cs * cs) continue;
          const w = Math.exp(-d2 * s2);
          sw += w;
          sv += w * val[m];
        }
      }
    }
    out[n] = sw > 0 ? sv / sw : val[n];
  }
  return out;
}

function gsLevelNodal(M: GsFlatMesh, raw: GsRawFields, nl?: number): Float64Array {
  const sum = new Float64Array(M.nn);
  const cnt = new Float64Array(M.nn);
  const lg = raw.lvg;
  const lv = raw.lvl;
  const cl = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
  let ytop = 0;
  for (let e = 0; e < M.ne; e++) {
    if (M.mat[e] === 0) continue;
    let c0: number;
    let c1: number;
    let c2: number;
    if (M.mat[e] === 1) for (let a = 0; a < 3; a++) ytop = Math.max(ytop, M.Y[M.T[6 * e + a]]);
    if (lg) {
      const g0 = lg[3 * e];
      const g1 = lg[3 * e + 1];
      const g2 = lg[3 * e + 2];
      const m = (g0 + g1 + g2) / 3;
      c0 = cl(2 * g2 - m);
      c1 = cl(2 * g1 - m);
      c2 = cl(2 * g0 - m);
    } else {
      c0 = c1 = c2 = cl(lv[e]);
    }
    const v = [c0, c1, c2, (c0 + c1) / 2, (c1 + c2) / 2, (c2 + c0) / 2];
    for (let a = 0; a < 6; a++) {
      const n = M.T[6 * e + a];
      sum[n] += v[a];
      cnt[n]++;
    }
  }
  const nod = Float64Array.from(sum, (s, i) => (cnt[i] ? s / cnt[i] : 0));
  const sg = Math.max(0.15, Math.min(0.6, (0.4 * ytop) / Math.max(1, nl || 5)));
  return gsSmooth(M, nod, sg);
}

export function cfGsYield(
  R: GsFemReportResult,
  fo: FemOutputExt,
  Wd: number,
  Fs: number,
  S?: EngineWaterSeep | null,
): string {
  const M = gsMeshOf(fo.raw!.mesh);
  const val = gsMemo(fo, 'lvn', () => gsLevelNodal(M, fo.raw!, fo.opt && fo.opt.lifts));
  return gsChart({
    W: Wd || 760,
    dom: gsDom(R, fo),
    title:
      'Bản đồ Trạng thái Ứng suất & Vùng chảy dẻo (Plastic Yield Zone' +
      (Fs > 0 ? ' - Fs_fem ≈ ' + cnf(Fs, 2) : '') +
      ')',
    field: {
      make: (F) => gsMemo(fo, 'png-y|' + F.W, () => gsRaster(M, val, 0, 1, F, {})),
      vec: (F) => gsVec(M, val, 0, 1, F, {}),
    },
    bar: { label: 'Mức độ chảy dẻo / Yield Level', vmin: 0, vmax: 1, ext: true },
    over: (F) => gsWallSvg(R, F) + gsWaterSvg(R, F, S),
  });
}

export function cfGsDisp(
  R: GsFemReportResult,
  fo: FemOutputExt,
  Wd?: number,
): { svg: string; mag: number; max: number } {
  const M = gsMeshOf(fo.raw!.mesh);
  const U = fo.raw!.uT || fo.raw!.u;
  const val = gsMemo(fo, 'un', () => {
    const v = new Float64Array(M.nn);
    for (let i = 0; i < M.nn; i++) v[i] = 1e3 * Math.hypot(U[i][0], U[i][1]);
    return v;
  });
  const rg = gsSoil(M, (i) => val[i]);
  const dom = gsDom(R, fo);
  const mag =
    rg.hi > 1e-9
      ? Math.max(1, Math.min(1e3, Math.round((0.012 * (dom.x1 - dom.x0)) / (rg.hi / 1e3))))
      : 1;
  const vmax = Math.max(rg.hi, 1e-6);
  const fig = gsChart({
    W: Wd || 760,
    dom,
    title: 'Bản đồ Chuyển vị và Lưới biến dạng (Total Displacements & Deformed Mesh)',
    field: {
      make: (F) =>
        gsMemo(fo, 'png-d|' + F.W, () => gsRaster(M, val, 0, vmax, F, { mag, U, lines: true })),
      vec: (F) => gsVec(M, val, 0, vmax, F, { mag, U }),
    },
    bar: { label: 'Chuyển vị tổng / Total Displacement (mm)', vmin: 0, vmax, ext: false },
    over: (F) => gsWallDef(M, U, mag, F, R) + gsWaterSvg(R, F),
  });
  return { svg: fig, mag, max: rg.hi };
}

export function cfGsMech(R: GsFemReportResult, fo: FemOutputExt, Wd?: number): string {
  const M = gsMeshOf(fo.raw!.mesh);
  const U = fo.raw!.uSRM;
  const val = gsMemo(fo, 'mech', () => {
    const v = new Float64Array(M.nn);
    for (let i = 0; i < M.nn; i++) v[i] = 1e3 * Math.hypot(U[i][0], U[i][1]);
    return v;
  });
  const rg = gsSoil(M, (i) => val[i]);
  const vmax = Math.max(rg.hi, 1e-6);
  return gsChart({
    W: Wd || 760,
    dom: gsDom(R, fo),
    title: 'Cơ chế phá hoại giảm cường độ (Failure Mechanism - Strength Reduction)',
    field: {
      make: (F) => gsMemo(fo, 'png-m|' + F.W, () => gsRaster(M, val, 0, vmax, F, {})),
      vec: (F) => gsVec(M, val, 0, vmax, F, {}),
    },
    bar: {
      label: 'Chuyển vị gia tăng / Incremental Displacement (mm)',
      vmin: 0,
      vmax,
      ext: false,
    },
    over: (F) => gsWallSvg(R, F) + gsWaterSvg(R, F),
  });
}

type SlopeBishop = NonNullable<GsRunResult['bishop']>;

export function cfGsBishop(
  R: GsFemReportResult,
  b: SlopeBishop,
  Wd?: number,
  S?: EngineWaterSeep | null,
): string {
  const g = R.g;
  const I = R.I;
  const M = b.M;
  const Df = b.Df ?? 0;
  const xc = b.xc ?? 0;
  const yc = b.yc ?? 0;
  const Rr = b.R ?? 0;
  const xL = b.xL ?? 0;
  const xR = b.xR ?? 0;
  const f1 = (v: number) => Math.round(v * 10) / 10;
  const dom = gsDom(R, null);
  dom.y1 = Math.max(dom.y1, yc + 0.07 * (dom.y1 - dom.y0));
  const topOf = (P: Point2D[], x: number) => {
    let t = -Infinity;
    for (let i = 0; i < P.length; i++) {
      const a = P[i];
      const c = P[(i + 1) % P.length];
      if ((a[0] <= x && c[0] > x) || (c[0] <= x && a[0] > x)) {
        t = Math.max(t, a[1] + ((c[1] - a[1]) * (x - a[0])) / (c[0] - a[0]));
      }
    }
    return t;
  };
  const top = (x: number) => {
    if (x < 0) return Df;
    const w = Math.max(topOf(g.foot, x), topOf(g.stem, x));
    if (x > g.B) return M.ground(x);
    return Math.max(isFinite(w) ? w : 0, x > g.xbt ? M.ground(x) : x < g.xfb ? Df : 0);
  };
  const arc = (x: number) => yc - Math.sqrt(Math.max(0, Rr * Rr - (x - xc) * (x - xc)));
  const over = (F: GsFrame) => {
    const X = F.X;
    const Y = F.Y;
    const N = (b.slices || []).length || 1;
    const bW = (xR - xL) / N;
    let s = '';
    const GL: Point2D[] = [[g.xbt, g.yT]];
    if (I.Hs > 1e-9) GL.push([g.xbt + I.m * I.Hs, g.yT + I.Hs]);
    GL.push([F.x1, GL[GL.length - 1][1]]);
    for (let i = 0; i <= N; i++) {
      const x = xL + i * bW;
      s += `M${f1(X(x))} ${f1(Y(arc(x)))}V${f1(Y(top(x)))}`;
    }
    const sl = `<path d="${s}" stroke="#000" stroke-width="0.55" fill="none"/>`;
    s = '';
    const xw = (() => {
      let r: number | null = null;
      [g.foot, g.stem].forEach((P) => {
        for (let i = 0; i < P.length; i++) {
          const a = P[i];
          const c = P[(i + 1) % P.length];
          if ((a[1] <= Df && c[1] > Df) || (c[1] <= Df && a[1] > Df)) {
            const x = a[0] + ((c[0] - a[0]) * (Df - a[1])) / (c[1] - a[1]);
            if (r === null || x < r) r = x;
          }
        }
      });
      return r == null ? 0 : r;
    })();
    s += gsWallSvg(R, F) + sl + gsWaterSvg(R, F, S);
    s += `<polyline points="${gsPts(
      [
        [F.x0, Df],
        [xw, Df],
      ],
      F,
    )}" fill="none" stroke="#008000" stroke-width="2.2"/><polyline points="${gsPts(GL, F)}" fill="none" stroke="#008000" stroke-width="2.2"/>`;
    const A: Point2D[] = [];
    for (let i = 0; i <= 90; i++) {
      const x = xL + ((xR - xL) * i) / 90;
      A.push([x, arc(x)]);
    }
    s += `<polyline points="${gsPts(A, F)}" fill="none" stroke="#e31a1c" stroke-width="2.2"/><path d="M${f1(X(xc) - 5.5)} ${f1(Y(yc) - 5.5)}l11 11m0 -11l-11 11" stroke="#e31a1c" stroke-width="1.7" fill="none"/>`;
    return s;
  };
  return gsChart({
    W: Wd || 760,
    dom,
    title:
      "Mặt trượt tới hạn theo phương pháp Bishop (Bishop's Critical Slip Surface - Fs_bishop = " +
      cnf(b.FS, 2) +
      ')',
    over,
    legend: [
      { t: 'Mặt đất', c: '#008000' },
      { t: 'Cung trượt tới hạn', c: '#e31a1c' },
      { t: 'Tâm trượt', c: '#e31a1c', x: true },
    ],
  });
}

export function calcFemSheet(
  P: EngineProject,
  R: GsFemReportResult | null | undefined,
  sec: number,
): { h: string; sec: number } {
  const c = P.calc;
  const o = calcFemOut(P) as FemOutputExt | null;
  if (!c || !c.femOn || !o || !R || !R.g || !R.I) return { h: '', sec };
  setFemSecNo(sec);
  const tf = cnf;
  const n1 = (v: number) => tf(v, 1);
  const M = o.model;
  const I = R.I;
  const g = R.g;
  const mt = o.mats;
  const stale = calcFemStale(P);
  const op = o.opt || {};
  const st = o.stages;
  const s2 = st.find((s) => s.name.startsWith('S2'));
  const s3 = st.find((s) => s.name.startsWith('S3')) || st[st.length - 1];
  const rib = R.model === 'rib';
  const ne = o.info.ne;
  const nn = o.info.nn;
  let h = sH2(`${sec}.&nbsp;&nbsp;PHÂN TÍCH PHẦN TỬ HỮU HẠN 2D ĐẤT - TƯỜNG (THAM KHẢO)`);
  if (stale) {
    h +=
      '<p class="kl bad">LƯU Ý: số liệu tường, đất hoặc tải trọng đã thay đổi sau lần chạy này. Các kết quả trong mục này là của lần chạy trước - phần mềm tự chạy lại khi số liệu đứng yên.</p>';
  }
  const E = mt[0].E / 1e3;
  const wat = !!o.water;
  h +=
    sH3(`${sec}.1. Mô hình và giả thiết`) +
    sTx(
      `Mặt cắt ngang của tường cùng đất đắp và đất nền được phân tích ở trạng thái biến dạng phẳng (dải rộng 1 m). Miền tính rộng ${n1(M.Lf + M.B + M.Lb)} m (mỗi phía cách tường ${n1(M.Lf)} m), sâu ${n1(M.Dd)} m dưới đáy bản đáy, chia thành ${ne} phần tử tam giác 6 nút (${nn} nút), lưới mịn dần về phía tường. Đáy miền được cố định; hai biên bên chỉ cho phép chuyển vị theo phương đứng.`,
    ) +
    sTx(
      `Tường bê tông đàn hồi tuyến tính (E = ${tf(E, 0)} MPa, hệ số Poisson ν = ${tf(mt[0].nu, 2)}). Đất là vật liệu đàn dẻo lý tưởng Mohr-Coulomb (cắt kéo bằng 0), góc giãn nở ψ = ${tf(mt[1].psi, 0)}°. Ứng suất ban đầu của nền theo K0 (σy = γ.z, σx = K0.σy; K0 = 1 − sinφ, nền đá lấy K0 = 0,5). Số liệu đất, nền, bê tông lấy đúng các mục nhập ở phần trên; mô đun đàn hồi của đất đắp và nền là số liệu nhập riêng cho mục này.${M.rock ? ' Khối đá nền dùng lực dính c, góc ma sát φ và trọng lượng riêng γ của khối đá nhập ở mục nền dưới đáy móng.' : ''}`,
    ) +
    sTab(
      ['Vật liệu', 'E (MPa)', 'ν', 'γ (kN/m³)', 'c (kPa)', 'φ (độ)', 'ψ (độ)', 'K0'],
      [
        ['Tường bê tông (đàn hồi)', tf(E, 0), tf(mt[0].nu, 2), tf(mt[0].gam, 1), '-', '-', '-', '-'],
        [
          'Đất đắp sau lưng tường',
          tf(mt[1].E / 1e3, 0),
          tf(mt[1].nu, 2),
          tf(mt[1].gam, 1),
          tf(mt[1].c, 1),
          tf(mt[1].phi, 1),
          tf(mt[1].psi, 0),
          'xây theo lớp',
        ],
        [
          M.rock ? 'Nền đá (khối đá)' : M.clay ? 'Nền đất dính (c = Su, φ = 0)' : 'Nền đất',
          tf(mt[2].E / 1e3, 0),
          tf(mt[2].nu, 2),
          tf(mt[2].gam, 1),
          tf(mt[2].c, 1),
          tf(mt[2].phi, 1),
          tf(mt[2].psi, 0),
          tf(mt[2].K0, 2),
        ],
        ...(I.hf > 1e-9 || I.ht > 1e-9
          ? [
              [
                'Đất phủ trước mũi',
                tf(mt[3].E / 1e3, 0),
                tf(mt[3].nu, 2),
                tf(mt[3].gam, 1),
                tf(mt[3].c, 1),
                tf(mt[3].phi, 1),
                tf(mt[3].psi, 0),
                tf(mt[3].K0, 2),
              ],
            ]
          : []),
      ],
      ['l', '', '', '', '', '', '', ''],
    ) +
    sTx(
      `Trình tự thi công mô phỏng: S0 - ứng suất ban đầu của nền; S1 - thi công tường (trọng lượng bê tông) và đất phủ trước mũi; S2 - đắp đất sau lưng tường ${op.lifts || 5} lớp; ${wat ? 'S2w - mực nước ngầm xuất hiện (sau khi thi công xong); ' : ''}S3 - tải trọng q + qL = ${tf((I.q || 0) + (I.qL || 0), 1)} kPa trên mặt đất đắp${M.kh || M.kv ? `; S4 - động đất giả tĩnh kh = ${tf(M.kh, 3)}, kv = ${tf(M.kv, 3)} (kh.W về phía mũi, kv.W hướng lên) tác dụng lên tường và đất đắp` : ''}. Mỗi bước tải giải bằng phương pháp Newton cải biên với sai số lực dư không vượt quá 0,1 %.`,
    );
  if (wat && o.water) {
    h += sTx(
      `<b>Nước ngầm:</b> mực nước sau lưng hB = ${tf(o.water.hB, 2)} m, phía trước hF = ${tf(o.water.hF, 2)} m (đo từ đáy bản đáy). Áp lực nước lỗ rỗng u lấy từ lời giải thấm ổn định hai chiều trên đúng miền của mô hình${calcGsOut(P) ? ' (mục ' + (sec + 1) + ')' : ''}. Ở giai đoạn S2w, ứng suất lưu là ứng suất <i>tổng</i>; điều kiện chảy dẻo Mohr-Coulomb kiểm tra trên ứng suất có hiệu σ' = σ + u; đất dưới mực nước dùng trọng lượng riêng bão hòa. Áp lực nước lên tường và lực đẩy ngược dưới đáy bản đáy nằm sẵn trong ứng suất tổng của đất kề tường và kề đáy móng, nên phản lực đáy và lực đẩy ngang nêu dưới đây là giá trị <i>tổng</i> (gồm nước).${M.clay ? ' Nền đất dính được phân tích theo ứng suất tổng (Su, φ = 0), không đưa áp lực nước lỗ rỗng vào nền.' : ''}`,
    );
  }
  h +=
    sH3(`${sec}.2. Chuyển vị và lực theo từng giai đoạn`) +
    sTx(
      'Chuyển vị tính từ lúc kích hoạt tường (sau S0): ux dương theo chiều từ mũi sang gót (về phía đất đắp), uy dương hướng lên (âm là lún). Lực đẩy ngang là tổng phản lực ngang của đất lên mặt lưng thân tường; phản lực đáy là tổng lực thẳng đứng truyền xuống nền qua đáy bản đáy. Điểm Gauss dẻo là số điểm tích phân của đất đang ở trạng thái chảy dẻo (Mohr-Coulomb).',
    ) +
    sTab(
      [
        'Giai đoạn',
        'Đỉnh tường ux (mm)',
        'Đỉnh tường uy (mm)',
        'Mũi bản đáy uy (mm)',
        'Gót bản đáy uy (mm)',
        'Lực đẩy ngang (kN/m)',
        'Phản lực đáy ΣV (kN/m)',
        'Điểm Gauss dẻo',
      ],
      st.map((s) => [
        s.name,
        tf(s.uTop[0], 2),
        tf(s.uTop[1], 2),
        tf(s.uToe, 2),
        tf(s.uHeel, 2),
        tf(s.thrust, 1),
        tf(s.Vbase, 1),
        String(s.nPlastic),
      ]),
      ['l', '', '', '', '', '', '', ''],
    );
  const w = R.st && R.st.w;
  const Fx = w && w.F ? Math.abs(w.F[0]) : 0;
  const SDv = R.SD ? R.SD.V : 0;
  const cmp: string[] = [];
  if (s2 && Fx > 1e-9) {
    cmp.push(
      `Hợp lực ngang lên lưng thân tường sau khi đắp đất (S2): phần tử hữu hạn ${tf(s2.thrust, 1)} kN/m; lõi tính (thành phần ngang của áp lực đất chủ động theo nêm trượt trên lưng thân tường) ${tf(Fx, 1)} kN/m; tỷ số ${tf(s2.thrust / Fx, 2)}.`,
    );
  }
  if (s3 && SDv > 1e-9) {
    cmp.push(
      `Tổng phản lực đáy ở S3: phần tử hữu hạn ${tf(s3.Vbase, 1)} kN/m; lõi tính (TTGH Sử dụng I) ${tf(SDv, 1)} kN/m; chênh lệch ${tf(100 * (s3.Vbase / SDv - 1), 1)} %.`,
    );
  }
  if (cmp.length) {
    h += sTx(
      '<b>Đối chiếu với lõi tính:</b> ' +
        cmp.join(' ') +
        ' Chênh lệch phản ánh sự khác nhau về cách xác lập tải trọng của hai mô hình (lõi tính dùng nêm trượt và mặt phẳng thẳng đứng qua mép gót' +
        (I.LL ? ', có kể hoạt tải xe quy đổi' : '') +
        '; mô hình phần tử hữu hạn dùng đất đắp thật theo lớp, tiếp xúc dính kết và chỉ kể tải q, qL).',
    );
  }
  h +=
    sH3(`${sec}.3. Áp lực đáy bản đáy`) +
    sTx(
      'Phân bố áp lực thẳng đứng dưới đáy bản đáy ở giai đoạn S3 (tải thường xuyên và tải chất thêm) so với phân bố tuyến tính không chịu kéo của lõi tính ở TTGH Sử dụng I. Phân bố từ phần tử hữu hạn kể đến độ cứng của bản đáy và nền nên có dạng cong. Đỉnh áp lực ở mép mũi và mép gót là hiện tượng kỳ dị ứng suất ở góc của mô hình tiếp xúc dính kết, không dùng làm áp lực thiết kế; so sánh nên dựa vào hợp lực và vị trí hợp lực.',
    ) +
    sFig(cfFemChart(R, o), 'Áp lực đáy bản đáy: phần tử hữu hạn và lõi tính');
  const gsNo = calcGsOut(P) ? sec + 1 : 0;
  h +=
    sH3(`${sec}.4. Điểm Gauss chảy dẻo`) +
    sTx(
      `Vị trí các điểm Gauss của đất ở trạng thái chảy dẻo Mohr-Coulomb ở giai đoạn ${s3 ? s3.name.split(' ')[0] : 'cuối'}${M.kh || M.kv ? ' và động đất' : ''}.${gsNo ? ' Bản đồ chuyển vị tổng, lưới biến dạng và bản đồ mức độ chảy dẻo của đất trình bày ở mục ' + gsNo + ' (Ổn định tổng thể).' : ''}`,
    ) +
    sFig(
      cfFemImg(
        o.raw ? FEM2D.svgPlastic(cfGsRaw(o) as never, { width: 760 }) : o.figs?.plastic || '',
      ),
      'Các điểm Gauss ở trạng thái chảy dẻo (chấm đỏ) và lưới phần tử; tường tô xám; hình đúng tỷ lệ 1 : 1',
    );
  let nx = 5;
  if (o.FSsrm != null) {
    const me = o.mech;
    const go = calcGsOut(P);
    const bs =
      go && go.bishop && go.bishop.FS != null && go.bishop.FS > 0
        ? go.bishop.FS
        : R.slope && R.slope.FS != null && R.slope.FS > 0
          ? R.slope.FS
          : null;
    h +=
      sH3(`${sec}.5. Hệ số an toàn theo phương pháp giảm cường độ (tham khảo)`) +
      sTx(
        'Giảm đồng thời lực dính và tanφ của đất theo hệ số F (c/F ; tanφ/F) cho đến khi không còn tìm được trạng thái cân bằng; hệ số F lớn nhất còn cân bằng lấy làm hệ số an toàn của mô hình. Sai số của hệ số F khoảng 0,03 và còn phụ thuộc vào lưới phần tử.',
      ) +
      sTab(
        [
          'Hệ số an toàn giảm cường độ',
          'Cung trượt Bishop (mục ổn định tổng thể)',
          'Vùng chuyển vị lớn (rộng × cao)',
          'Dạng cơ chế',
        ],
        [
          [
            tf(o.FSsrm, 2),
            bs ? tf(bs, 2) : 'không xét',
            me ? tf(me.w, 1) + ' × ' + tf(me.h, 1) + ' m' : '-',
            me ? (me.local ? 'cục bộ' : 'tổng thể') : '-',
          ],
        ],
        ['c', 'c', 'c', 'c'],
      ) +
      (o.raw
        ? sFig(
            cfFemImg(cfGsMech(R, o, 760)),
            'Cơ chế phá hoại ở lần thử thất bại gần hệ số an toàn nhất (chuyển vị gia tăng, mm, theo thang màu); hình đúng tỷ lệ 1 : 1',
          )
        : '') +
      sTx(
        me && me.local
          ? '<b>Nhận xét:</b> vùng chuyển vị lớn nhỏ so với chiều cao tường (cơ chế cục bộ gần đỉnh tường: đất đắp rời, không dính, ít bị nén chặt và tiếp xúc dính kết với tường). Hệ số này bị chi phối bởi vùng cục bộ đó, <b>không đại diện cho ổn định tổng thể</b> của tường; ổn định tổng thể kiểm tra bằng cung trượt tròn.'
          : '<b>Nhận xét:</b> cơ chế phá hoại phát triển trên vùng rộng so với chiều cao tường. Kết quả nhạy với lưới phần tử và chỉ mang tính tham khảo (có thể chênh vài chục phần trăm giữa lưới thô và lưới mịn); ổn định tổng thể vẫn kiểm tra bằng cung trượt tròn.',
      );
    nx = 6;
  }
  h +=
    sH3(`${sec}.${nx}. Giới hạn của phân tích này`) +
    sTx(
      '- Tiếp xúc tường - đất và bản đáy - nền là dính kết hoàn toàn (không có phần tử mặt tiếp xúc): mô hình không thể hiện trượt, hở khe hay lật; lực cắt ở mặt tiếp xúc không bị giới hạn bởi ma sát. Các kiểm tra trượt, lệch tâm và sức kháng đỡ của nền lấy theo các mục kiểm toán ở phần trên (TCVN 11823-10, TCVN 11823-11).',
    ) +
    sTx(
      rib
        ? '- Tường có sườn: mô hình dùng mặt cắt thân tường và bản đáy ở dải 1 m, không có sườn; độ cứng và trọng lượng của sườn chưa được kể nên chuyển vị của tường thật sẽ khác kết quả này.'
        : '- Mô hình là dải 1 m biến dạng phẳng, không phản ánh sự làm việc theo chiều dài tường.',
    ) +
    sTx(
      '- Chưa đưa vào mô hình: ' +
        (wat ? '' : 'nước ngầm (áp lực nước, đẩy ngược, thấm), ') +
        'neo thép, chốt chịu cắt, khoá chống trượt' +
        (gsKeyPolys(g).length
          ? ' / chân khay (phần nằm dưới cao độ đáy bản đáy được coi là đất nền, không có phần tử bê tông riêng)'
          : '') +
        ', bê tông lót' +
        (I.LL ? ', hoạt tải xe quy đổi' : '') +
        (M.kh || M.kv
          ? wat
            ? ', áp lực nước động (động đất chỉ kể lực quán tính của tường và đất bão hòa)'
            : ', áp lực nước động'
          : '') +
        '. Đất không kể cố kết, từ biến, đầm nén.' +
        (wat
          ? ' Nước ngầm kể bằng trường áp lực lỗ rỗng của dòng thấm ổn định (không kể sự thay đổi áp lực lỗ rỗng do biến dạng của đất).'
          : ''),
    ) +
    sTx(
      '- Chuyển vị phụ thuộc mô đun đàn hồi nhập cho đất đắp và nền; khi chưa có thí nghiệm, chỉ nên dùng để so sánh các phương án và xem vùng chảy dẻo, không dùng làm giá trị tuyệt đối.',
    ) +
    (o.warn && o.warn.length
      ? sTx(
          '- <b>Cảnh báo hội tụ:</b> ' +
            [...new Set(o.warn)].slice(0, 4).join('; ') +
            '. Kết quả của các bước này kém tin cậy.',
        )
      : '') +
    sTx(
      'Kết quả phân tích phần tử hữu hạn 2D ở mục này chỉ để tham khảo, không tính vào kết luận chung của bảng tính.',
    );
  return { h, sec: sec + 1 };
}

type GsRowsSummary = ReturnType<typeof calcGsRows>;

export function calcGsSummary(
  P: EngineProject,
  _R: GsFemReportResult,
  G: GsRowsSummary,
): string {
  const tf = cnf;
  const fsT = (v: number | null) => (v == null ? 'chưa chạy' : v > 99 ? '> 99' : tf(v, 2));
  let h = sTab(
    ['STT', 'Hạng mục', 'Phương pháp', 'Fs', 'Fs yêu cầu', 'Kết quả'],
    G.rows.map((r: GsRow, i: number) => [
      String(i + 1),
      r.nm,
      r.how + (r.note ? ' – ' + r.note : ''),
      fsT(r.fs),
      '≥\u00a0' + tf(r.req, 2),
      r.ok == null ? '-' : r.info ? 'tham khảo' : sOk(r.ok),
    ]),
    ['c', 'l', 'l', 'c', 'c', 'c'],
  );
  if (G.ok != null) {
    h += `<p class="kl ${G.ok ? 'ok' : 'bad'}">TRẠNG THÁI: ${G.ok ? 'ỔN ĐỊNH' : 'KHÔNG ỔN ĐỊNH'}${G.complete ? '' : ' (mới xét các hạng mục đã tính)'}</p>`;
  }
  if (G.miss.length) {
    const fc = getFemCache();
    const femErr = fc.err && fc.tpl === P.tpl ? fc.err : '';
    const why = (r: GsRow) =>
      r.id === 'bs'
        ? G.go && G.go.err
          ? 'không tính được: ' + G.go.err
          : 'đang tính, kết quả tự cập nhật sau giây lát'
        : r.id === 'srm'
          ? femErr
            ? 'FEM 2D không chạy được: ' + femErr
            : 'FEM 2D đang tính, kết quả tự cập nhật sau giây lát'
          : '';
    h += sTx(
      'Chưa có kết quả: ' +
        G.miss.map((r: GsRow) => r.nm + (why(r) ? ' (' + why(r) + ')' : '')).join('; ') +
        '.',
    );
  }
  return h;
}

export function calcGsParts(
  P: EngineProject,
  R: GsFemReportResult,
  G: GsRowsSummary,
  sec: number | '',
): string {
  const c = P.calc!;
  const I = R.I;
  const tf = cnf;
  const cl = G.cl;
  const go = G.go;
  const fo = G.fo as FemOutputExt | null;
  const W = R.W;
  let n = 1;
  let h = '';
  const hd = (t: string) => sH3(sec ? `${sec}.${n++}. ${t}` : (n++, t));
  if (cl) {
    h +=
      hd('Hệ số an toàn trượt phẳng và lật quanh mũi (tải trọng tiêu chuẩn)') +
      sTx(
        'Các lực lấy ở trạng thái tiêu chuẩn (hệ số tải trọng 1,0): trọng lượng bản thân, đất đắp, tải chất thêm, hoạt tải, áp lực đất chủ động' +
          (W ? ', áp lực nước và lực đẩy ngược' : '') +
          (R.E ? ', lực động đất giả tĩnh (hoạt tải nhân γEQ)' : '') +
          '. Bỏ qua áp lực bị động của đất phủ trước mũi và lực neo chống lật (thiên về an toàn). Mômen xét quanh mép mũi; mỗi thành phần lực được xếp vào nhóm giữ hay lật theo chiều quay của chính nó.',
      ) +
      sF(
        String.raw`F_{s,tr} = \dfrac{R_\tau}{H}\ ;\quad R_\tau = N\tan\phi_f\ \ (\text{đất rời, đá})\ ;\ \ R_\tau = \min(S_u\ ;\ 0.5\,N/B)\,B\ \ (\text{đất dính})\ ;\quad F_{s,l} = \dfrac{\sum M_{giữ}}{\sum M_{lật}}`,
      );
    const rowC = (nm: string, k: NonNullable<typeof cl.sd>) => [
      nm,
      tf(k.N, 1),
      tf(k.H, 1),
      tf(k.RR, 1),
      k.Fsl > 99 ? '> 99' : tf(k.Fsl, 2),
      tf(k.Mr, 1),
      tf(k.Mo, 1),
      k.Fot > 99 ? '> 99' : tf(k.Fot, 2),
    ];
    h += sTab(
      [
        'Tổ hợp',
        'N (kN/m)',
        'H (kN/m)',
        'Sức kháng trượt (kN/m)',
        'Fs trượt',
        'ΣM giữ (kN.m/m)',
        'ΣM lật (kN.m/m)',
        'Fs lật',
      ],
      [rowC('Tiêu chuẩn (không động đất)', cl.sd), ...(cl.eq ? [rowC('Có động đất', cl.eq)] : [])],
      ['l', '', '', '', '', '', '', ''],
    );
  }
  if (W && go && go.seep) {
    const S = go.seep;
    const pf = cfGsPore(R, S);
    h +=
      hd('Áp lực nước lỗ rỗng – thấm ổn định hai chiều') +
      sTx(
        `Cột nước h(x, y) giải từ phương trình thấm ổn định hai chiều (phương pháp thể tích hữu hạn, đất bất đẳng hướng Kx, Ky) trên đúng miền của mô hình phần tử hữu hạn (rộng ${tf(S.X[S.nx] - S.X[0], 1)} m, lớp thấm dày ${tf(I.Tn, 1)} m dưới đáy bản đáy, đáy lớp không thấm; tường và bản đáy không thấm). Mực nước sau lưng hB và phía trước hF là biên cột nước không đổi. Áp lực nước lỗ rỗng u = γw.(h − y) dùng chung cho cung trượt Bishop (ở đáy các thớ) và cho phân tích phần tử hữu hạn.`,
      ) +
      sTab(
        ['Đại lượng', 'Ký hiệu', 'Giá trị', 'Đơn vị'],
        [
          [
            'Mực nước sau lưng ; phía trước (từ đáy bản đáy)',
            'hB ; hF',
            tf(W.hB, 2) + ' ; ' + tf(W.hF, 2),
            'm',
          ],
          ['Chiều dày lớp thấm', 'Tn', tf(I.Tn, 2), 'm'],
          ['Hệ số thấm đất đắp: ngang ; đứng', 'Kx ; Ky', gsK(I.kbx) + ' ; ' + gsK(I.kby), 'm/s'],
          [
            I.rock ? 'Hệ số thấm khối đá nền: ngang ; đứng' : 'Hệ số thấm đất nền: ngang ; đứng',
            'Kx ; Ky',
            gsK(I.kfx) + ' ; ' + gsK(I.kfy),
            'm/s',
          ],
          [
            'Trọng lượng riêng bão hòa: đất đắp ; ' + (I.rock ? 'khối đá' : 'đất nền'),
            'γsat',
            tf(I.gsat, 1) + ' ; ' + tf(I.rock ? I.gR : I.soil === 'd' ? I.gf : I.gfs, 1),
            'kN/m³',
          ],
        ],
        ['l', '', '', ''],
      ) +
      (pf
        ? sFig(
            cfFemImg(pf),
            'Bản đồ phân bố áp lực nước lỗ rỗng u (kPa) theo lời giải thấm 2D, u = γw.(h − y); đất phía trên mực nước u = 0. Nét đứt xanh thẫm: mực nước sau lưng (thượng lưu), nét đứt lam nhạt: mực nước trước mũi (hạ lưu); hình đúng tỷ lệ 1 : 1',
          )
        : sTx('Mực nước nằm dưới đáy miền tính: áp lực nước lỗ rỗng u = 0 trong toàn miền.'));
  } else if (go && !W) {
    h +=
      hd('Áp lực nước lỗ rỗng') +
      sTx(
        'Không xét nước ngầm (mục 4 của bảng nhập chưa bật): áp lực nước lỗ rỗng u = 0 trong toàn miền nên không có bản đồ áp lực nước lỗ rỗng; khi bật mục 4 và nhập mực nước sau lưng, trước mũi thì bản đồ này được dựng từ lời giải thấm 2D.',
      );
  }
  const fc = getFemCache();
  const femErr = fc.err && fc.tpl === P.tpl ? fc.err : '';
  if (fo && fo.raw) {
    const op = fo.opt || {};
    const FSf = fo.FSsrm != null && !(fo.mech && fo.mech.local) ? fo.FSsrm : 0;
    const Eb = fo.mats && fo.mats[1] ? fo.mats[1].E / 1e3 : 0;
    h +=
      hd('Phần tử hữu hạn 2D – trạng thái ứng suất và vùng chảy dẻo') +
      sTx(
        `Mặt cắt đất – tường phân tích ở trạng thái biến dạng phẳng (dải rộng 1 m, phần tử tam giác 6 nút, đất Mohr-Coulomb đàn dẻo lý tưởng, tường bê tông đàn hồi) theo trình tự thi công: tường và đất phủ trước mũi, đắp đất sau lưng ${op.lifts || 5} lớp${fo.water ? ', xuất hiện mực nước ngầm (ứng suất có hiệu; áp lực nước lỗ rỗng theo lời giải thấm ở trên)' : ''}, tải trọng q + qL${fo.model && (fo.model.kh || fo.model.kv) ? ', động đất giả tĩnh' : ''}. Mô đun đàn hồi của đất đắp (${tf(Eb, 0)} MPa) và của nền là số liệu nhập ở mục 8 của bảng nhập.`,
      ) +
      sTx(
        'Mức độ chảy dẻo = (σ1 − σ3) / [(σ1 + σ3).sinφ + 2c.cosφ] tại các điểm Gauss của đất ở cuối giai đoạn tải' +
          (fo.water ? ' (ứng suất có hiệu)' : '') +
          '; bằng 1 (đỏ sẫm) là đất đạt điều kiện chảy dẻo Mohr-Coulomb. Phần tường (nền trắng, viền đen) làm việc đàn hồi nên không xét. Giá trị ở điểm Gauss được nội suy ra nút lưới và làm trơn nhẹ (bán kính khoảng 0,4 chiều dày một lớp đắp) để bỏ các vân ngang tại ranh giới giữa các lớp đắp.',
      ) +
      sFig(
        cfFemImg(cfGsYield(R, fo, 760, FSf, go && go.seep)),
        'Bản đồ mức độ chảy dẻo của đất (0: chưa huy động cường độ chống cắt; 1: đạt điều kiện chảy dẻo Mohr-Coulomb)' +
          (FSf > 0 ? '; Fs_fem là hệ số an toàn theo phương pháp giảm cường độ' : '') +
          '; hình đúng tỷ lệ 1 : 1',
      );
  } else if (go) {
    h +=
      hd('Phần tử hữu hạn 2D – trạng thái ứng suất, vùng chảy dẻo và chuyển vị') +
      sTx(
        femErr
          ? 'Phân tích phần tử hữu hạn 2D không chạy được: ' + femErr + '.'
          : 'Phân tích phần tử hữu hạn 2D đang chạy ở luồng nền (vài giây); bản đồ chảy dẻo và chuyển vị tự hiện khi chạy xong.',
      );
  }
  if (go && go.bishop) {
    const b = go.bishop;
    h += hd('Cung trượt tròn – phương pháp Bishop đơn giản hóa (TCVN 11823-11, Điều 6.2.3)');
    if (b.none || !b.slices) {
      h += sTx(
        'Không tìm được cung trượt hợp lệ trong miền khảo sát: kiểm tra lại bề dày lớp nền T và số liệu địa chất.',
      );
    } else {
      const bFS = b.FS ?? 0;
      h +=
        sTx(
          `Cung trượt đi dưới đáy bản đáy trong lớp nền dày T = ${tf(c.bsT, 1)} m, thoát lên mặt đất phía trước mũi; tường là vật thể cứng; tải ở trạng thái tiêu chuẩn.${W ? ' Áp lực nước lỗ rỗng ở đáy từng thớ lấy theo lời giải thấm 2D ở trên.' : ' Đất khô (không xét nước ngầm).'}`,
        ) +
        sFig(
          cfFemImg(cfGsBishop(R, b, 760, go && go.seep)),
          'Mặt trượt tới hạn theo phương pháp Bishop: mặt đất (xanh lục), cung trượt nguy hiểm nhất (đỏ), tâm trượt (×) và các thớ chia (nét đen mảnh); nét đứt là mực nước; hình đúng tỷ lệ 1 : 1',
        ) +
        sRow(
          'Tâm cung trượt (gốc O ở mép mũi, đáy bản đáy)',
          'xc ; yc',
          tf(b.xc, 3) + ' ; ' + tf(b.yc, 3),
          'm',
        ) +
        sRow('Bán kính ; cao độ đáy cung', 'R ; ymin', tf(b.R, 3) + ' ; ' + tf(b.ylow, 3), 'm') +
        sRow(
          'Hệ số an toàn nhỏ nhất ; yêu cầu',
          'Fs ; Fs,min',
          tf(bFS, 3) + ' ; ' + tf(c.fsGs, 2),
          '',
          sOk(bFS >= c.fsGs - 1e-9),
        );
    }
  }
  if (fo && fo.raw) {
    const cd = cfGsDisp(R, fo, 760);
    h +=
      hd('Phần tử hữu hạn 2D – chuyển vị tổng, lưới biến dạng và hệ số an toàn giảm cường độ') +
      sTx(
        `Chuyển vị tổng của đất và tường tính từ lúc kích hoạt tường (sau trạng thái ứng suất ban đầu), cực đại ${tf(cd.max, 1)} mm. Lưới phần tử vẽ ở vị trí đã biến dạng, phóng đại ×${cd.mag} để nhìn thấy. Chuyển vị phụ thuộc mô đun đàn hồi nhập cho đất (khi chưa có thí nghiệm chỉ dùng để so sánh các phương án).`,
      ) +
      sFig(
        cfFemImg(cd.svg),
        `Chuyển vị tổng (mm) và lưới biến dạng phóng đại ×${cd.mag}; hình đúng tỷ lệ 1 : 1 (trước khi phóng đại)`,
      );
    if (fo.FSsrm != null) {
      h +=
        sRow(
          'Hệ số an toàn giảm cường độ ; yêu cầu',
          'Fs ; Fs,min',
          tf(fo.FSsrm, 2) + ' ; ' + tf(c.fsGs, 2),
          '',
          fo.mech && fo.mech.local
            ? '<span class="small">tham khảo</span>'
            : sOk(fo.FSsrm >= c.fsGs - 1e-9),
        ) +
        sTx(
          fo.mech && fo.mech.local
            ? 'Vùng chuyển vị lớn nhỏ so với chiều cao tường (cơ chế cục bộ gần đỉnh tường): hệ số này bị chi phối bởi vùng cục bộ nên <b>không đại diện</b> cho ổn định tổng thể và không dùng để kết luận (vì vậy không ghi vào tiêu đề bản đồ chảy dẻo).'
            : 'Sai số của hệ số Fs khoảng 0,03 và phụ thuộc lưới, mô đun đàn hồi nhập cho đất.',
        );
    } else if (c.femSrm) {
      h += sTx('Không tìm được trạng thái cân bằng ngay cả khi F = 1: Fs < 1 hoặc mô hình chưa cân bằng.');
    }
    if (fo.warn && fo.warn.length) {
      h += sTx(
        '<b>Cảnh báo hội tụ:</b> ' +
          [...new Set(fo.warn)].slice(0, 3).join('; ') +
          '. Kết quả của các bước này kém tin cậy.',
      );
    }
  }
  return h;
}

export function calcGsView(P: EngineProject, R: GsFemReportResult): string {
  const dec = (P.calc && P.calc.dec) === ',' ? ',' : '.';
  setReportDec(dec);
  setEngineCalcDec(dec);
  resetReportFigCounter(0);
  const G = calcGsRows(P, R);
  let h = '';
  if (calcGsStale(P) || calcFemStale(P)) {
    h +=
      '<p class="kl bad">LƯU Ý: số liệu đã thay đổi sau lần tính trước - các kết quả Bishop / FEM bên dưới là của lần tính trước và đang được tính lại.</p>';
  }
  h += sH2('ỔN ĐỊNH TỔNG THỂ') + calcGsSummary(P, R, G) + calcGsParts(P, R, G, '');
  h += sTx(
    'Hệ số an toàn yêu cầu là giá trị tham khảo theo phương pháp ứng suất cho phép do người dùng nhập ở mục 6; không phải giới hạn của tiêu chuẩn và không tính vào kết luận chung của bảng tính.',
  );
  return h;
}

export function calcGsSheet(
  P: EngineProject,
  R: GsFemReportResult | null | undefined,
  sec: number,
): { h: string; sec: number } {
  const c = P.calc;
  if (!c || !R || !R.g || !R.I || !calcGsOut(P)) return { h: '', sec };
  setGsSecNo(sec);
  const G = calcGsRows(P, R);
  let h = sH2(`${sec}.&nbsp;&nbsp;PHÂN TÍCH ỔN ĐỊNH TỔNG THỂ (THAM KHẢO)`);
  if (calcGsStale(P) || calcFemStale(P)) {
    h +=
      '<p class="kl bad">LƯU Ý: số liệu đã thay đổi sau lần tính - các kết quả Bishop / FEM trong mục này là của lần tính trước và chưa được tính lại.</p>';
  }
  h += calcGsParts(P, R, G, sec);
  const nsub = (h.match(/<h3>/g) || []).length + 1;
  h +=
    sH3(`${sec}.${nsub}. Tổng hợp hệ số an toàn`) +
    calcGsSummary(P, R, G) +
    sTx(
      'Hệ số an toàn yêu cầu là giá trị tham khảo theo phương pháp ứng suất cho phép, do người dùng nhập; không phải giới hạn của tiêu chuẩn. Mục này không tính vào kết luận chung của bảng tính.',
    );
  return { h, sec: sec + 1 };
}
