import {
  CFE,
  type CfeModelData,
  type CfeSection,
  type CfeSectionPer,
  type CfeSolveResult,
  type CantiCalcResult,
  type RibCalcResult,
} from '../engine';
import type { EngineProject } from '../engine/types';
import type { Point2D } from '../types/project';
import { CD_LAB, CFig, CF_CL, cfNew, cnf, getCalcDec } from './cfig';
import { sF, sFig, sH2, sH3, sKL, sOk, sTab, sTx } from './reportHelpers';

export type FeReportResult = CantiCalcResult | RibCalcResult;

export interface FeContourOptions {
  q?: string | null;
  k?: string;
  az?: number;
  el?: number;
  W?: number;
  ribs?: 'grey' | 'color' | 'hide';
  data?: boolean;
  marks?: Array<{ x: number; y: number; z: number; t: string }>;
  nolab?: boolean;
}

export interface FeInteractiveState {
  q: string;
  k: string;
  az: number;
  el: number;
  ribs: 'grey' | 'color' | 'hide';
}

export const FE_VIEWS: Array<[string, number, number]> = [
  ['Mặt sau (phía đất)', 24, 20],
  ['Mặt trước', 204, 20],
  ['Mặt cắt ngang', 90, 4],
  ['Mặt bằng', 0, 88],
];

export const FE_COL: Record<string, string> = {
  stem: '#cfd5db',
  slab: '#e6e0cf',
  rib: '#cfe0f3',
};

export const FE_KLAB: Record<string, string> = {
  bao: 'TTGH Cường độ I (bao)',
  Ia: 'TTGH Cường độ I-a',
  Ib: 'TTGH Cường độ I-b',
  Ic: 'TTGH Cường độ I-c',
  SD: 'TTGH Sử dụng I',
  baoE: 'TTGH Đặc biệt (bao)',
  Ea: 'TTGH Đặc biệt I-a',
  Eb: 'TTGH Đặc biệt I-b',
};

export const FE_KSHORT: Record<string, string> = {
  bao: 'CĐ I-bao',
  Ia: 'CĐ I-a',
  Ib: 'CĐ I-b',
  Ic: 'CĐ I-c',
  SD: 'SD',
  baoE: 'ĐB bao',
  Ea: 'ĐB I-a',
  Eb: 'ĐB I-b',
};

export const feSecNo = (id: string): string => {
  const n = String(id).replace(/\D/g, '');
  return n + '-' + n;
};

const feT = (
  x: number,
  y: number,
  t: string,
  o: { fs?: number; a?: string; b?: number | boolean; i?: number | boolean; c?: string } = {},
) =>
  `<text x="${(+x).toFixed(1)}" y="${(+y).toFixed(1)}" font-size="${o.fs || 11}"${o.a ? ` text-anchor="${o.a}"` : ''}${o.b ? ' font-weight="bold"' : ''}${o.i ? ' font-style="italic"' : ''} fill="${o.c || '#111'}">${t}</text>`;

const feF1 = (v: number): string => (+v).toFixed(1);
export const feV = (v: number): string => cnf(v, Math.abs(v) >= 100 ? 1 : Math.abs(v) >= 10 ? 1 : 2);
export const feAbs = (v: number | null | undefined): number => Math.abs(v == null ? 0 : v);

const _feFigC = new WeakMap<object, Map<string, string>>();
function feCached(R: FeReportResult, sig: string, fn: () => string): string {
  const key = R.fe && (R.fe.res || (R.fe as object));
  if (!key) return fn();
  let m = _feFigC.get(key);
  if (!m) _feFigC.set(key, (m = new Map()));
  const fullSig = sig + '|' + getCalcDec();
  if (!m.has(fullSig)) m.set(fullSig, fn());
  return m.get(fullSig)!;
}

export const FE_RAMP = [
  '#0066ff',
  '#00ffff',
  '#00ff99',
  '#00ff00',
  '#44ff00',
  '#aaff00',
  '#ccff00',
  '#ffff00',
  '#ffcd00',
  '#ff7f00',
  '#ff0000',
];

const feHex = (c: string): number[] => [1, 3, 5].map((i) => parseInt(c.substr(i, 2), 16));

function feRamp(t: number): string {
  const cl = Math.min(1, Math.max(0, t));
  const n = FE_RAMP.length - 1;
  const f = cl * n;
  const i = Math.min(n - 1, Math.floor(f));
  const u = f - i;
  const a = feHex(FE_RAMP[i]);
  const b = feHex(FE_RAMP[i + 1]);
  return (
    '#' +
    a
      .map((v, j) =>
        Math.round(v + (b[j] - v) * u)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}

interface FeBands {
  lo: number;
  st: number;
  n: number;
  cols: string[];
}

function feBands(vmin: number, vmax: number): FeBands {
  const span = vmax - vmin;
  const sc = Math.max(1e-9, Math.abs(vmin), Math.abs(vmax));
  if (!(span > 1e-7 * sc)) {
    const st = Math.max(sc, 1e-6) * 0.1;
    return { lo: vmin - st / 2, st, n: 1, cols: [feRamp(0.5)] };
  }
  const raw = span / 10;
  const e = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / e;
  const st = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * e;
  const lo = Math.floor(vmin / st + 1e-7) * st;
  const hi = Math.ceil(vmax / st - 1e-7) * st;
  const n = Math.max(1, Math.round((hi - lo) / st));
  return {
    lo,
    st,
    n,
    cols: Array.from({ length: n }, (_, i) => feRamp(n === 1 ? 0.5 : i / (n - 1))),
  };
}

const feCol = (v: number, B: FeBands): string =>
  B.cols[Math.min(B.n - 1, Math.max(0, Math.floor((v - B.lo) / B.st + 1e-9)))];

const feDec = (st: number): number => {
  for (let d = 0; d <= 4; d++) {
    const v = st * Math.pow(10, d);
    if (Math.abs(v - Math.round(v)) < 1e-6 * Math.max(1, Math.abs(v))) return d;
  }
  return 3;
};

function feLegend(
  B: FeBands,
  x: number,
  y0: number,
  o: {
    title: string;
    sub?: string;
    unit: string;
    stat?: { imax: number; max: number; imin: number; min: number } | null;
  },
): { s: string; h: number } {
  const n = B.n;
  const bh = Math.min(22, 300 / n);
  const dec = feDec(B.st);
  let s = feT(x, y0, o.title, { b: 1, fs: 12 });
  let yb = y0 + 8;
  if (o.sub) {
    s += feT(x, y0 + 15, o.sub, { fs: 11 });
    yb += 15;
  }
  yb += 8;
  for (let i = 0; i < n; i++) {
    s += `<rect x="${x}" y="${feF1(yb + i * bh)}" width="22" height="${feF1(bh)}" fill="${B.cols[n - 1 - i]}" stroke="#444" stroke-width="0.6"/>`;
  }
  for (let j = 0; j <= n; j++) {
    s += feT(x + 28, yb + j * bh + 3.5, cnf(B.lo + (n - j) * B.st, dec), { fs: 10.5 });
  }
  let y = yb + n * bh + 20;
  s += feT(x, y, 'Đơn vị: ' + o.unit, { fs: 11 });
  if (o.stat) {
    y += 16;
    s +=
      feT(x, y, 'MAX: phần tử ' + (o.stat.imax + 1), { fs: 11 }) +
      feT(x + 8, y + 13, '= ' + feV(o.stat.max), { fs: 11 });
    y += 28;
    s +=
      feT(x, y, 'MIN: phần tử ' + (o.stat.imin + 1), { fs: 11 }) +
      feT(x + 8, y + 13, '= ' + feV(o.stat.min), { fs: 11 });
    y += 14;
  }
  return { s, h: y + 12 };
}

const feSvg = (W: number, H: number, inner: string, cls: string) =>
  `<svg class="dg${cls ? ' ' + cls : ''}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="'Times New Roman',Times,'Liberation Serif',serif">${inner}</svg>`;

function feView(az: number, el: number) {
  const a = (az * Math.PI) / 180;
  const e = (el * Math.PI) / 180;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const ce = Math.cos(e);
  const se = Math.sin(e);
  return {
    pr: (x: number, y: number, z: number): Point2D => [
      x * sa - z * ca,
      -x * se * ca + y * ce - z * se * sa,
    ],
    dp: (x: number, y: number, z: number): number => x * ce * ca + y * se + z * ce * sa,
    ax: [
      [sa, -se * ca],
      [0, ce],
      [-ca, -se * sa],
    ] as Point2D[],
  };
}

export function cfFe3D(R: FeReportResult, o: FeContourOptions): string {
  const fe = R.fe!;
  const M = fe.M!;
  const m = M.m;
  const xyz = m.xyz;
  const V = feView(o.az ?? 24, o.el ?? 20);
  const q = o.q || null;
  const k = o.k || 'bao';
  const vals = q ? CFE.fieldOf(fe, k, q as keyof typeof CFE.FQ) : null;
  const colRib = o.ribs === 'color';
  const fq = q ? CFE.FQ[q as keyof typeof CFE.FQ] : null;
  const inScope = (E: (typeof M.EL)[number]) => E.kind !== 'rib' || colRib;
  const st = vals ? CFE.fieldStat(M, vals, inScope)! : null;
  const Bd = st ? feBands(st.min, st.max) : null;
  const els: Array<{ e: number; E: (typeof M.EL)[number]; P: Point2D[]; d: number }> = [];
  M.EL.forEach((E, e) => {
    if (!E || (E.kind === 'rib' && o.ribs === 'hide')) return;
    const n = m.elems[e].n;
    const ids = n[2] === n[3] ? [n[0], n[1], n[2]] : n;
    let d = 0;
    const P = ids.map((i) => {
      const p = xyz[i];
      d += V.dp(p[0], p[1], p[2]);
      return V.pr(p[0], p[1], p[2]);
    });
    els.push({ e, E, P, d: d / ids.length });
  });
  let u0 = 1e9;
  let u1 = -1e9;
  let v0 = 1e9;
  let v1 = -1e9;
  els.forEach((t) =>
    t.P.forEach((p) => {
      u0 = Math.min(u0, p[0]);
      u1 = Math.max(u1, p[0]);
      v0 = Math.min(v0, p[1]);
      v1 = Math.max(v1, p[1]);
    }),
  );
  const W = o.W ?? 780;
  const legW = Bd ? 176 : 0;
  const top = 16;
  const bot = 30;
  const aw = W - legW - 18;
  const sc = Math.min(aw / (u1 - u0 || 1), 520 / (v1 - v0 || 1));
  const ox = 8 + (aw - (u1 - u0) * sc) / 2;
  const lg =
    Bd && fq
      ? feLegend(Bd, W - legW + 4, 22, {
          title: fq.s + ' (' + fq.u + ')',
          sub: FE_KSHORT[k] || k,
          unit: fq.u,
          stat: st!,
        })
      : null;
  const H = Math.max(Math.round((v1 - v0) * sc + top + bot), lg ? Math.round(lg.h) : 0, 220);
  const oy = top + (H - top - bot - (v1 - v0) * sc) / 2;
  const X = (u: number) => ox + (u - u0) * sc;
  const Y = (v: number) => oy + (v1 - v) * sc;
  const pts = (P: Point2D[]) => P.map((p) => feF1(X(p[0])) + ',' + feF1(Y(p[1]))).join(' ');
  els.sort((a, b) => a.d - b.d);
  let s = '<g stroke="#4a5560" stroke-width="0.35" stroke-opacity="0.7" stroke-linejoin="round">';
  els.forEach((t) => {
    const col =
      vals && Bd && inScope(t.E) && isFinite(vals[t.e])
        ? feCol(vals[t.e], Bd)
        : FE_COL[t.E.kind];
    s += `<polygon points="${pts(t.P)}" fill="${col}"${o.data ? ` data-e="${t.e}"` : ''}/>`;
  });
  s += '</g>';
  const rg = (R as RibCalcResult).rg;
  if (!q && !o.nolab) {
    const tag = (x: number, y: number, z: number, t: string, dx: number, dy: number, a?: string) => {
      const p = V.pr(x, y, z);
      return `<text x="${feF1(X(p[0]) + dx)}" y="${feF1(Y(p[1]) + dy)}" font-size="12" font-weight="bold" text-anchor="${a || 'start'}" fill="#111" style="paint-order:stroke" stroke="#fff" stroke-width="3" stroke-linejoin="round">${t}</text>`;
    };
    s +=
      tag(M.xm(M.yT), M.yT, M.Lu / 2, 'thân tường', 0, -6, 'middle') +
      tag(M.B * 0.5, M.ym, M.Lu, 'bản đáy', 0, 18, 'middle');
    if (rg) {
      const r0 = rg.ctr[0];
      const ym = (M.yE + M.yR) / 2;
      s += tag(M.xh(ym), ym, r0, 'sườn', 8, 4, 'start');
    }
    (M.pins || []).forEach((n) => {
      const p = xyz[n];
      const c = V.pr(p[0], p[1], p[2]);
      const x = X(c[0]);
      const y = Y(c[1]);
      s += `<path d="M${feF1(x)},${feF1(y)} l-5,9 h10 z" fill="#c00000" stroke="#600" stroke-width="0.6"/>`;
    });
    s += feT(10, H - 8, 'Gối cố định (tam giác đỏ) chỉ khử chuyển vị thể rắn', {
      fs: 11,
      c: '#a00000',
    });
  }
  (o.marks || []).forEach((mk) => {
    const c = V.pr(mk.x, mk.y, mk.z);
    const x = X(c[0]);
    const y = Y(c[1]);
    s +=
      `<circle cx="${feF1(x)}" cy="${feF1(y)}" r="9.5" fill="#fff" stroke="#c00000" stroke-width="1.5"/>` +
      feT(x, y + 4, mk.t, { fs: 11, b: 1, a: 'middle', c: '#c00000' });
  });
  const ox0 = 46;
  const oy0 = H - 30;
  const tri: Array<[string, Point2D]> = [
    ['x', V.ax[0]],
    ['y', V.ax[1]],
    ['z', V.ax[2]],
  ];
  tri.forEach(([nm, a]) => {
    const L = 22;
    const x1 = ox0 + a[0] * L;
    const y1 = oy0 - a[1] * L;
    s += `<line x1="${ox0}" y1="${oy0}" x2="${feF1(x1)}" y2="${feF1(y1)}" stroke="#555" stroke-width="1.2"/>${feT(x1 + (a[0] >= 0 ? 3 : -9), y1 + (a[1] >= 0 ? -2 : 9), nm, { fs: 11, i: 1, c: '#444' })}`;
  });
  if (lg) s += lg.s;
  return feSvg(W, H, s, o.data ? 'fe3d' : '');
}

export function cfFeStrip(R: FeReportResult, o: FeContourOptions): string {
  const fe = R.fe!;
  const M = fe.M!;
  const g = R.g;
  const q = o.q || 'M';
  const k = o.k || 'bao';
  const fq = CFE.FQ[q as keyof typeof CFE.FQ];
  const vals = CFE.fieldOf(fe, k, q as keyof typeof CFE.FQ)!;
  const stem: Array<{ t: number; v: number }> = [];
  const slab: Array<{ t: number; v: number }> = [];
  M.EL.forEach((E, e) => {
    if (!E || !isFinite(vals[e])) return;
    if (E.kind === 'stem' && E.own) stem.push({ t: E.yc!, v: vals[e] });
    else if (E.kind === 'slab') slab.push({ t: E.xc, v: vals[e] });
  });
  stem.sort((a, b) => a.t - b.t);
  slab.sort((a, b) => a.t - b.t);
  const st = CFE.fieldStat(M, vals, (E) => E.kind === 'slab' || E.own)!;
  const Bd = feBands(st.min, st.max);
  const amax = Math.max(Math.abs(st.min), Math.abs(st.max), 1e-9);
  const dm = Math.max(0.9, 0.3 * (M.yT - M.yF));
  const ks = dm / amax;
  const W = o.W ?? 780;
  const legW = 176;
  const lg = feLegend(Bd, W - legW + 4, 22, {
    title: fq.s + ' (' + fq.u + ')',
    sub: FE_KSHORT[k] || k,
    unit: fq.u,
    stat: st,
  });
  const pos = (a: Array<{ v: number }>) => a.some((p) => p.v > 1e-9);
  const neg = (a: Array<{ v: number }>) => a.some((p) => p.v < -1e-9);
  const xr = Math.max(g.B, M.xm(M.yT) + (pos(stem) ? dm : 0)) + 0.5;
  const xl = Math.min(0, M.xm(M.yT) - (neg(stem) ? dm : 0)) - 0.4;
  const yb = Math.min(0, M.ym - (pos(slab) ? dm : 0)) - 0.3;
  const yt = M.yT + 0.45;
  const aw = W - legW - 18;
  const sc = Math.min(aw / (xr - xl), 470 / (yt - yb));
  const hh = (yt - yb) * sc;
  const H = Math.max(Math.round(hh + 40), Math.round(lg.h));
  const D = CFig(W, H);
  D.view([xl, xr, yb, yt], { x: 8, y: 14, w: aw, h: Math.max(hh, H - 40) });
  D.poly(g.foot, 'fill="#eceff1" stroke="#222" stroke-width="1.2"');
  D.poly(g.stem, 'fill="#eceff1" stroke="#222" stroke-width="1.2"');
  const sub = (a: Array<{ t: number; v: number }>, t0: number, t1: number) => {
    const L = [{ t: t0, v: a[0].v }, ...a, { t: t1, v: a[a.length - 1].v }];
    const o2: Array<[{ t: number; v: number }, { t: number; v: number }]> = [];
    for (let i = 0; i + 1 < L.length; i++) {
      for (let kk = 0; kk < 4; kk++) {
        const f0 = kk / 4;
        const f1 = (kk + 1) / 4;
        const A = {
          t: L[i].t + (L[i + 1].t - L[i].t) * f0,
          v: L[i].v + (L[i + 1].v - L[i].v) * f0,
        };
        const B = {
          t: L[i].t + (L[i + 1].t - L[i].t) * f1,
          v: L[i].v + (L[i + 1].v - L[i].v) * f1,
        };
        o2.push([A, B]);
      }
    }
    return o2;
  };
  const edge: Point2D[] = [];
  const edge2: Point2D[] = [];
  sub(stem, M.yF, M.yT).forEach(([A, B]) => {
    const xa = M.xm(A.t);
    const xb = M.xm(B.t);
    D.poly(
      [
        [xa, A.t],
        [xa + A.v * ks, A.t],
        [xb + B.v * ks, B.t],
        [xb, B.t],
      ],
      `fill="${feCol((A.v + B.v) / 2, Bd)}" stroke="${feCol((A.v + B.v) / 2, Bd)}" stroke-width="0.4"`,
    );
    edge.push([xa + A.v * ks, A.t], [xb + B.v * ks, B.t]);
  });
  sub(slab, 0, M.B).forEach(([A, B]) => {
    D.poly(
      [
        [A.t, M.ym],
        [A.t, M.ym - A.v * ks],
        [B.t, M.ym - B.v * ks],
        [B.t, M.ym],
      ],
      `fill="${feCol((A.v + B.v) / 2, Bd)}" stroke="${feCol((A.v + B.v) / 2, Bd)}" stroke-width="0.4"`,
    );
    edge2.push([A.t, M.ym - A.v * ks], [B.t, M.ym - B.v * ks]);
  });
  D.pl(edge, 'stroke="#222" stroke-width="1"');
  D.pl(edge2, 'stroke="#222" stroke-width="1"');
  D.ln([M.xm(M.yF), M.yF], [M.xm(M.yT), M.yT], 'stroke="#222" stroke-width="0.8" stroke-dasharray="5,3"');
  D.ln([0, M.ym], [M.B, M.ym], 'stroke="#222" stroke-width="0.8" stroke-dasharray="5,3"');
  const mark = (a: Array<{ t: number; v: number }>, at: (p: { t: number; v: number }) => void) => {
    const idx = new Set([0, a.length - 1]);
    let im = 0;
    a.forEach((p, i) => {
      if (Math.abs(p.v) > Math.abs(a[im].v)) im = i;
    });
    idx.add(im);
    const out: Array<{ t: number; v: number }> = [];
    [...idx]
      .sort((u, v) => a[u].t - a[v].t)
      .forEach((i) => {
        if (out.length && Math.abs(a[i].t - out[out.length - 1].t) < 0.9) return;
        out.push(a[i]);
      });
    out.forEach((p) => at(p));
  };
  mark(stem, (p) => {
    const P: Point2D = [M.xm(p.t) + p.v * ks, p.t];
    D.t(P, feV(p.v), {
      fs: 11,
      b: true,
      dx: p.v >= 0 ? 6 : -6,
      dy: 4,
      a: p.v >= 0 ? 'start' : 'end',
    });
    D.dot(P, '#222', 2.2);
  });
  mark(slab, (p) => {
    const P: Point2D = [p.t, M.ym - p.v * ks];
    D.t(P, feV(p.v), { fs: 11, b: true, dx: 0, dy: p.v >= 0 ? 15 : -7, a: 'middle' });
    D.dot(P, '#222', 2.2);
  });
  let s = D.svg()
    .replace(/^<svg[^>]*>/, '')
    .replace(/<\/svg>$/, '');
  s +=
    lg.s +
    feT(
      10,
      H - 8,
      'Dương: ' +
        (q.charAt(0) === 'N' ? 'kéo' : 'căng mặt sau thân / thớ dưới bản đáy') +
        (q.charAt(0) === 'M' ? '' : '; vẽ về phía +e3'),
      { fs: 11, i: 1, c: '#444' },
    );
  return feSvg(W, H, s, o.data ? 'fe3d' : '');
}

export function cfFeContour(R: FeReportResult, o?: FeContourOptions): string {
  const opt: Required<Pick<FeContourOptions, 'q' | 'k' | 'az' | 'el' | 'W' | 'ribs' | 'data'>> &
    FeContourOptions = Object.assign(
    { q: 'M', k: 'bao', az: 24, el: 20, W: 780, ribs: 'grey' as const, data: false },
    o || {},
  );
  const mk = () => (R.fe!.M!.strip ? cfFeStrip(R, opt) : cfFe3D(R, opt));
  return opt.data
    ? mk()
    : feCached(R, 'c|' + opt.q + '|' + opt.k + '|' + opt.az + '|' + opt.el + '|' + opt.W + '|' + opt.ribs, mk);
}

export function cfFeMesh(R: FeReportResult): string {
  const fe = R.fe!;
  const M = fe.M!;
  const W = 760;
  if (M.strip) {
    const g = R.g;
    const D = cfNew([-0.5, g.B + 0.5, -0.25, g.yT + 0.45], W, 470, 430, 22, 14);
    const ln = 'stroke="#0050b0" stroke-width="2"';
    D.poly(g.foot, 'fill="#eceff1" stroke="#222" stroke-width="1.2"');
    D.poly(g.stem, 'fill="#eceff1" stroke="#222" stroke-width="1.2"');
    D.pl(
      M.Y.filter((y) => y >= M.yF - 1e-9).map((y): Point2D => [M.xm(y), y]),
      ln,
    );
    D.pl(
      M.X.map((x): Point2D => [x, M.ym]),
      ln,
    );
    M.Y.filter((y) => y >= M.yF - 1e-9).forEach((y) => D.dot([M.xm(y), y], 'b', 2.4));
    M.X.forEach((x) => D.dot([x, M.ym], 'b', 2.4));
    D.t([M.xm(M.yT), M.yT], 'phần tử tấm thân (mặt giữa)', { c: 'b', fs: 11, dx: 8, dy: -6 });
    D.t([M.B, M.ym], 'phần tử tấm bản đáy (mặt giữa)', {
      c: 'b',
      fs: 11,
      dx: -8,
      dy: -12,
      a: 'end',
    });
    D.dot([0, M.ym], 'r', 3.6);
    D.dot([M.B, M.ym], 'r', 3.6);
    D.t([0, M.ym], 'gối cố định (chống chuyển vị thể rắn)', { c: 'r', fs: 11, dx: 2, dy: 20 });
    return D.svg();
  }
  return feCached(R, 'mesh', () =>
    cfFe3D(R, { q: null, k: 'bao', az: 24, el: 20, W, ribs: 'grey', data: false }),
  );
}

export function cfFeSecPos(R: FeReportResult): string {
  return feCached(R, 'secpos', () => {
    const fe = R.fe!;
    const M = fe.M!;
    const S = fe.sec!;
    const g = R.g;
    const get = (id: string) => S.find((s) => s.id === id);
    const num = (s: CfeSection) => feSecNo(s.id).charAt(0);
    if (M.strip) {
      const W = 760;
      const D = cfNew([-0.5, g.B + 0.5, -0.25, g.yT + 0.45], W, 470, 430, 22, 14);
      const yv = M.yF + (M.yT - M.yF) / 2;
      const s2 = get('S2');
      D.poly(g.foot, 'fill="#eceff1" stroke="#222" stroke-width="1.2"');
      D.poly(g.stem, 'fill="#eceff1" stroke="#222" stroke-width="1.2"');
      const at = (id: string, p: Point2D) => {
        const s = get(id);
        if (s) D.num(p, num(s), 'r');
      };
      at('S1', [M.xm(M.yF), M.yF + 0.05]);
      at('S2', [M.xm(s2 && s2.y != null ? s2.y : yv), s2 && s2.y != null ? s2.y : yv]);
      at('S3', [M.xf(M.yF), M.ym]);
      at('S4', [M.xb(M.yF), M.ym]);
      return D.svg();
    }
    const rg = (R as RibCalcResult).rg!;
    const nr = rg.ctr.length;
    const r0 = nr >> 1;
    const zA = rg.ctr[r0];
    const zB = nr > 1 ? (rg.ctr[r0] + rg.ctr[Math.min(r0 + 1, nr - 1)]) / 2 : zA + 0.25 * rg.S;
    const yk = (id: string) => {
      const s = get(id);
      return s && s.cd && s.cd.y != null ? s.cd.y : M.yF + 0.3 * (M.yT - M.yF);
    };
    const xk = (id: string) => {
      const s = get(id);
      return s && s.cd && s.cd.x != null ? s.cd.x : (M.xb(M.yF) + M.xE) / 2;
    };
    const ribPt = (id: string) => {
      const s = get(id);
      if (!s) return null;
      const y = s.y != null ? s.y : (M.yE + M.yR) / 2;
      const zr = rg.ctr[s.cd && s.cd.r != null ? s.cd.r : r0];
      return { x: 0.5 * (M.xb(y) + M.xh(y)), y, z: zr, t: num(s) };
    };
    const marks: Array<{ x: number; y: number; z: number; t: string }> = [];
    const add = (id: string, x: number, y: number, z: number) => {
      const s = get(id);
      if (s) marks.push({ x, y, z, t: num(s) });
    };
    add('S1', M.xm(M.yF), M.yF, zA);
    add('S2', M.xm(M.yF), M.yF, zB);
    add('S3', M.xm(yk('S3')), yk('S3'), zA);
    add('S4', M.xm(yk('S4')), yk('S4'), zB);
    add('S5', xk('S5'), M.ym, zA);
    add('S6', xk('S6'), M.ym, zB);
    add('S7', M.xf(M.yF), M.ym, zA);
    ['S8', 'S9'].forEach((id) => {
      const p = ribPt(id);
      if (p) marks.push(p);
    });
    return cfFe3D(R, {
      q: null,
      k: 'bao',
      az: 24,
      el: 20,
      W: 760,
      ribs: 'grey',
      data: false,
      marks,
      nolab: true,
    });
  });
}

export function cfFeChart(R: RibCalcResult): string {
  const fe = R.fe!;
  const r = R.rg;
  const pr = fe.prof!;
  const rib = R.rib;
  const hand = (R.hand ? R.hand.rib : rib).pts.slice().sort((a, b) => a.y - b.y);
  const act = rib.pts.slice().sort((a, b) => a.y - b.y);
  const W = 760;
  const ml = 74;
  const mr = 24;
  const mt = 30;
  const mb = 46;
  const hh = 340;
  const H = hh + mt + mb;
  const D = CFig(W, H);
  const y0 = r.yb;
  const y1 = r.yR;
  const pw = W - ml - mr;
  const feP = pr.y.map((y, i) => ({ y, Mu: pr.Mu[i] })).filter((p) => p.y <= y1 + 1e-9);
  const mx =
    Math.max(...feP.map((p) => p.Mu), ...hand.map((p) => p.Mu), ...act.map((p) => p.Mr), 1) *
    1.06;
  const X = (m: number) => ml + (m / mx) * pw;
  const Y = (y: number) => mt + ((y1 - y) / (y1 - y0)) * hh;
  const nice = (() => {
    const t = mx / 6;
    const e = Math.pow(10, Math.floor(Math.log10(t)));
    const f = t / e;
    return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * e;
  })();
  for (let m = 0; m <= mx + 1e-9; m += nice) {
    D.lp(X(m), mt, X(m), mt + hh, 'stroke="#ddd" stroke-width="0.6"');
    D.tp(X(m), mt + hh + 15, cnf(m, m < 10 ? 1 : 0), { a: 'middle', fs: 11, free: true });
  }
  const sy = y1 - y0 > 6 ? 2 : 1;
  for (let y = Math.ceil(y0 / sy) * sy; y <= y1 + 1e-9; y += sy) {
    D.lp(ml, Y(y), ml + pw, Y(y), 'stroke="#ddd" stroke-width="0.6"');
    D.tp(ml - 6, Y(y) + 4, cnf(y, 1), { a: 'end', fs: 11, free: true });
  }
  D.lp(ml, mt, ml, mt + hh, 'stroke="#222" stroke-width="1"');
  D.lp(ml, mt + hh, ml + pw, mt + hh, 'stroke="#222" stroke-width="1"');
  const poly = <T extends { y: number }>(
    L: T[],
    k: keyof T,
    c: string,
    w: number,
    dash?: string,
  ) => {
    D.s += `<polyline fill="none" stroke="${c}" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ''} points="${L.map((p) => X(Number(p[k])).toFixed(1) + ',' + Y(p.y).toFixed(1)).join(' ')}"/>`;
  };
  poly(hand, 'Mu', CF_CL.r, 1.6, '7,3');
  poly(feP, 'Mu', CF_CL.g, 2.2);
  poly(act, 'Mr', CF_CL.b, 2);
  const at = <T extends { y: number }>(L: T[], f: number) =>
    L.reduce((a, p) =>
      Math.abs(p.y - (y0 + f * (y1 - y0))) < Math.abs(a.y - (y0 + f * (y1 - y0))) ? p : a,
    );
  const pf = at(feP, 0.45);
  const ph = at(hand, 0.2);
  const pm = at(act, 0.85);
  D.tp(X(pf.Mu) + 9, Y(pf.y) + 4, 'Mu theo mô hình FE', { c: 'g', fs: 12, b: true });
  D.tp(X(ph.Mu) + 9, Y(ph.y) + 4, 'Mu tính tay (công xôn)', { c: 'r', fs: 12, b: true });
  D.tp(X(pm.Mr) + 9, Y(pm.y) + 4, 'Mr = φMn (khả năng)', { c: 'b', fs: 12, b: true });
  D.tp(ml + pw / 2, H - 6, 'Mômen M tại mặt cắt nằm ngang của sườn (kN.m)', {
    a: 'middle',
    fs: 12,
    free: true,
  });
  D.tp(14, mt + hh / 2, 'Cao độ y (m)', { a: 'middle', fs: 12, rot: -90, free: true });
  return D.svg();
}

function feRibPanel(
  D: ReturnType<typeof CFig>,
  x0: number,
  y0: number,
  w: number,
  h: number,
  ys: number[],
  vs: number[],
  title: string,
  unitNote?: string,
): void {
  const ml = 56;
  const mr = 74;
  const mt = 48;
  const mb = 16;
  const W = w - ml - mr;
  const Hh = h - mt - mb;
  const ya = ys[0];
  const yb = ys[ys.length - 1];
  const vmn = Math.min(0, ...vs);
  const vmx = Math.max(0, ...vs);
  const B = feBands(vmn, vmx);
  const span = Math.max(vmx - vmn, 1e-9);
  const xa = x0 + ml + (W * -vmn) / span;
  const kx = W / span;
  const Yp = (y: number) => y0 + mt + ((yb - y) / Math.max(yb - ya, 1e-9)) * Hh;
  D.tp(x0 + w / 2, y0 + 17, title, { a: 'middle', b: true, fs: 12, free: true });
  D.tp(x0 + 11, y0 + mt + Hh / 2, 'Cao độ y (m)', { a: 'middle', fs: 10.5, rot: -90, free: true });
  const sy = yb - ya > 6 ? 2 : 1;
  for (let y = Math.ceil(ya / sy) * sy; y <= yb + 1e-9; y += sy) {
    D.lp(x0 + ml - 4, Yp(y), x0 + ml, Yp(y), 'stroke="#555" stroke-width="0.8"');
    D.tp(x0 + ml - 6, Yp(y) + 4, cnf(y, 1), { a: 'end', fs: 10.5, free: true });
  }
  D.lp(x0 + ml, Yp(ya), x0 + ml, Yp(yb), 'stroke="#555" stroke-width="0.8"');
  const pieces: Array<[number, number, number, number]> = [];
  for (let i = 0; i + 1 < ys.length; i++) {
    for (let k = 0; k < 4; k++) {
      const f0 = k / 4;
      const f1 = (k + 1) / 4;
      const ya1 = ys[i] + (ys[i + 1] - ys[i]) * f0;
      const ya2 = ys[i] + (ys[i + 1] - ys[i]) * f1;
      const v1 = vs[i] + (vs[i + 1] - vs[i]) * f0;
      const v2 = vs[i] + (vs[i + 1] - vs[i]) * f1;
      pieces.push([ya1, v1, ya2, v2]);
    }
  }
  pieces.forEach(([y1, v1, y2, v2]) => {
    const c = feCol((v1 + v2) / 2, B);
    D.s += `<polygon points="${feF1(xa)},${feF1(Yp(y1))} ${feF1(xa + v1 * kx)},${feF1(Yp(y1))} ${feF1(xa + v2 * kx)},${feF1(Yp(y2))} ${feF1(xa)},${feF1(Yp(y2))}" fill="${c}" stroke="${c}" stroke-width="0.4"/>`;
  });
  D.s += `<polyline fill="none" stroke="#222" stroke-width="1" points="${ys.map((y, i) => feF1(xa + vs[i] * kx) + ',' + feF1(Yp(y))).join(' ')}"/><line x1="${feF1(xa)}" y1="${feF1(Yp(ya))}" x2="${feF1(xa)}" y2="${feF1(Yp(yb))}" stroke="#222" stroke-width="1.2"/>`;
  const idx = new Set([0, ys.length - 1]);
  let im = 0;
  vs.forEach((v, i) => {
    if (Math.abs(v) > Math.abs(vs[im])) im = i;
  });
  idx.add(im);
  const out: number[] = [];
  [...idx]
    .sort((p, q) => ys[p] - ys[q])
    .forEach((i) => {
      if (out.length && Math.abs(Yp(ys[i]) - Yp(ys[out[out.length - 1]])) < 16) return;
      out.push(i);
    });
  out.forEach((i) => {
    const px = xa + vs[i] * kx;
    const py = Yp(ys[i]);
    D.s += `<circle cx="${feF1(px)}" cy="${feF1(py)}" r="2.2" fill="#222"/>`;
    D.tp(px + (vs[i] >= 0 ? 6 : -6), py + 4, cnf(vs[i], Math.abs(vs[i]) >= 100 ? 0 : 1), {
      fs: 11,
      b: true,
      a: vs[i] >= 0 ? 'start' : 'end',
    });
  });
  const bx = x0 + w - mr + 16;
  const bh = Math.min(20, Hh / B.n);
  const dec = feDec(B.st);
  const by = y0 + mt;
  for (let i = 0; i < B.n; i++) {
    D.s += `<rect x="${bx}" y="${feF1(by + i * bh)}" width="10" height="${feF1(bh)}" fill="${B.cols[B.n - 1 - i]}" stroke="#555" stroke-width="0.5"/>`;
  }
  [0, Math.round(B.n / 2), B.n].forEach((j) => {
    D.s += feT(bx + 14, by + j * bh + 3.5, cnf(B.lo + (B.n - j) * B.st, dec), { fs: 10 });
  });
  D.s += feT(x0 + ml, y0 + h - 2, unitNote || '', { fs: 10.5, i: 1, c: '#444' });
}

export function cfFeRibDiag(R: FeReportResult): string {
  return feCached(R, 'rib', () => {
    const fe = R.fe!;
    const pr = fe.prof!;
    const W = 780;
    const pw = 390;
    const ph = 330;
    const H = 2 * ph;
    const D = CFig(W, H);
    const ys = pr.y;
    feRibPanel(D, 0, 0, pw, ph, ys, pr.Mu, 'Mômen M (kN.m) – TTGH Cường độ I (bao)');
    feRibPanel(D, pw, 0, pw, ph, ys, pr.Vu, 'Lực cắt V (kN) – TTGH Cường độ I (bao)');
    feRibPanel(D, 0, ph, pw, ph, ys, pr.Nu, 'Lực dọc N (kN) – TTGH Cường độ I (bao), + nén');
    feRibPanel(D, pw, ph, pw, ph, ys, pr.Ms, 'Mômen M (kN.m) – TTGH Sử dụng I');
    return D.svg();
  });
}

export function cfFeReact(R: FeReportResult, k: string): string {
  return feCached(R, 'react|' + k, () => {
    const fe = R.fe!;
    const g = R.g;
    const r = CFE.reactOf(fe, k);
    if (!r) return '';
    const B = g.B;
    const yT = g.yT;
    const dm = Math.max(0.8, 0.14 * yT);
    const ks = dm / Math.max(r.qmax, 1e-9);
    const W = 780;
    const txtW = 250;
    const aw = W - txtW - 18;
    const bx: [number, number, number, number] = [-0.8, B + 0.8, -dm - 0.9, yT + 0.35];
    const sc = Math.min(aw / (bx[1] - bx[0]), 400 / (bx[3] - bx[2]));
    const hh = (bx[3] - bx[2]) * sc;
    const H = Math.round(hh + 36);
    const D = CFig(W, H);
    D.view(bx, { x: 8, y: 14, w: aw, h: hh });
    D.poly(g.foot, 'fill="#eceff1" stroke="#222" stroke-width="1.2"');
    D.poly(g.stem, 'fill="#eceff1" stroke="#222" stroke-width="1.2"');
    const n = 40;
    const P: Point2D[] = [[0, 0]];
    for (let i = 0; i <= n; i++) {
      const x = (B * i) / n;
      P.push([x, -r.pr.q(x) * ks]);
    }
    P.push([B, 0]);
    D.poly(P, 'fill="#f6c9c9" fill-opacity="0.8" stroke="#c00000" stroke-width="1.4"');
    for (let i = 0; i < 9; i++) {
      const x = (B * (i + 0.5)) / 9;
      const qv = r.pr.q(x) * ks;
      if (qv > 0.04 * dm) D.arp(D.X(x), D.Y(-qv), D.X(x), D.Y(0) + 1, 'r', 1.1);
    }
    const xN = Math.min(B, Math.max(0, B / 2 + r.s));
    D.arp(D.X(xN), D.Y(-dm * 1.15), D.X(xN), D.Y(-dm * 0.02), 'b', 2.4);
    D.tp(D.X(xN) + 6, D.Y(-dm * 1.15) + 12, 'N', { c: 'b', fs: 13, b: true });
    const dir = r.H >= 0 ? 1 : -1;
    const xh = dir > 0 ? Math.max(0, xN - 1.3) : Math.min(B, xN + 1.3);
    D.arp(D.X(xh), D.Y(0) - 8, D.X(xh) + dir * 42, D.Y(0) - 8, 'g', 2.2);
    D.tp(D.X(xh) + dir * 46, D.Y(0) - 4, 'H', {
      c: 'g',
      fs: 13,
      b: true,
      a: dir > 0 ? 'start' : 'end',
    });
    D.t([0, -r.pr.q(0) * ks], feV(r.pr.q(0)) + ' kPa', {
      c: 'r',
      fs: 11,
      b: true,
      dx: -4,
      dy: 14,
      a: 'end',
    });
    D.t([B, -r.pr.q(B) * ks], feV(r.pr.q(B)) + ' kPa', { c: 'r', fs: 11, b: true, dx: 4, dy: 14 });
    D.t([0, 0], 'mũi', { fs: 11, i: true, dx: -5, dy: -6, a: 'end' });
    D.t([B, 0], 'gót', { fs: 11, i: true, dx: 5, dy: -6 });
    let s = D.svg()
      .replace(/^<svg[^>]*>/, '')
      .replace(/<\/svg>$/, '');
    const x = W - txtW + 8;
    let y = 34;
    const L = (t: string, o?: { b?: number; i?: number; fs?: number }) => {
      s += feT(x, y, t, Object.assign({ fs: 12 }, o || {}));
      y += 19;
    };
    L(FE_KLAB[k] || k, { b: 1, fs: 13 });
    if (CFE.FK[k as keyof typeof CFE.FK]) {
      L('(tổ hợp ' + (FE_KSHORT[r.k] || r.k) + ' bất lợi nhất)', { i: 1, fs: 11 });
    }
    y += 6;
    L('N = ' + cnf(r.N, 1) + ' kN/m');
    L('H = ' + cnf(r.H, 1) + ' kN/m');
    L('e = ' + cnf(r.e, 3) + ' m' + (r.e <= B / 6 + 1e-9 ? '  (≤ B/6)' : '  (> B/6)'));
    L('Lc = ' + cnf(r.Lc, 2) + ' m  (bề rộng tiếp xúc)');
    L('q mũi = ' + cnf(r.pr.q(0), 1) + ' kPa');
    L('q gót = ' + cnf(r.pr.q(B), 1) + ' kPa');
    if (r.tau) L('τ = H / Lc = ' + cnf(r.tau, 1) + ' kPa');
    y += 6;
    L('Phản lực nền tuyến tính, không chịu kéo,', { fs: 11, i: 1 });
    L('tự cân bằng với tải trọng đặt lên mô hình.', { fs: 11, i: 1 });
    return feSvg(W, H, s, '');
  });
}

function feSecVal(S: CfeSection, ks: string[], K: number): { M: number; V: number; N: number } | null {
  const L: CfeSectionPer[] = ks.filter((x) => S.per[x]).map((x) => S.per[x]);
  if (!L.length) return null;
  const f = S.rib ? K : 1;
  const big = (key: 'M' | 'V' | 'N'): number =>
    L.reduce<number | null>((b, q) => {
      const val = q[key] ?? 0;
      return b === null || Math.abs(val) > Math.abs(b) ? val : b;
    }, null) ?? 0;
  return { M: f * big('M'), V: f * Math.max(...L.map((q) => Math.abs(q.V ?? 0))), N: big('N') };
}

export function feMVNTable(R: FeReportResult): string {
  const fe = R.fe!;
  const K = fe.kfe ?? 1;
  const S = fe.sec!;
  const E = R.E;
  const kk = ['Ia', 'Ib', 'Ic', 'bao', 'SD'].concat(E ? ['Ea', 'Eb', 'baoE'] : []);
  const rows: string[][] = [];
  const f = (v: number | null | undefined) => (v == null ? '-' : cnf(v, 1));
  kk.forEach((k) => {
    const ks = CFE.FK[k as keyof typeof CFE.FK] || [k];
    const V = S.map((s) => feSecVal(s, ks, K));
    (
      [
        ['M', 'M (kN.m)'],
        ['V', 'V (kN)'],
        ['N', 'N (kN)'],
      ] as const
    ).forEach(([q, lab], i) =>
      rows.push([
        i === 0 ? '<b>' + FE_KSHORT[k] + '</b>' : '',
        lab,
        ...V.map((v) => (v ? f(v[q]) : '-')),
      ]),
    );
  });
  return sTab(['Tổ hợp', 'Nội lực', ...S.map((s) => feSecNo(s.id))], rows, [
    'l',
    'l',
    ...S.map(() => ''),
  ]);
}

export function calcFeSheet(
  _P: EngineProject,
  R: FeReportResult,
  sec: number,
): { h: string; sec: number } {
  const fe = R.fe as (CfeSolveResult & { secNo?: number }) | undefined;
  if (!fe || fe.err) return { h: '', sec };
  const tf = cnf;
  const M = fe.M!;
  const meshInfo = fe.mesh!;
  const combos = fe.combos!;
  const secList = fe.sec!;
  const rg = (R as RibCalcResult).rg;
  const rib = !!rg;
  const basis = fe.basis === 'fe';
  const K = fe.kfe ?? 1;
  const E = R.E;
  const n = (x: number | null | undefined) => tf(x, 1);
  const nm = rib ? 'thân tường, bản đáy và sườn' : 'thân tường và bản đáy';
  const ID = (s: CfeSection) => feSecNo(s.id);
  const nBd = 4;
  const nRe = 5;
  const nRib = 6;
  const nRc = rib ? 7 : 6;
  fe.secNo = sec;
  let h = sH2(`${sec}.&nbsp;&nbsp;KIỂM TOÁN BẰNG MÔ HÌNH PHẦN TỬ HỮU HẠN TẤM 3D`);
  h +=
    sH3(`${sec}.1. Mô hình, tải trọng và giả thiết`) +
    sTx(
      rib && rg
        ? `Một đơn nguyên tường dài Lu = ${tf(M.Lu, 2)} m gồm ${nm} (${rg.n} sườn) được chia thành ${meshInfo.elems} phần tử tấm bốn nút (màng và uốn có kể biến dạng cắt), ${meshInfo.nodes} nút, ${meshInfo.dof} bậc tự do. Lưới đặt theo mặt giữa của từng bộ phận; thân - bản đáy và thân - sườn liên kết liền khối.`
        : `Dải tường rộng 1 m gồm ${nm} được chia thành ${meshInfo.elems} phần tử tấm bốn nút (màng và uốn có kể biến dạng cắt), ${meshInfo.nodes} nút, ${meshInfo.dof} bậc tự do, giải ở dạng phẳng bằng điều kiện đối xứng theo chiều dài tường. Lưới đặt theo mặt giữa của thân và bản đáy, liên kết liền khối.`,
    ) +
    sTx(
      `Bê tông đàn hồi tuyến tính: Ec = ${tf(R.M.Ec, 0)} MPa, hệ số Poisson ν = 0,2; độ cứng lấy theo tiết diện nguyên (chưa kể nứt). Kích thước và vật liệu lấy đúng bản vẽ; tải trọng và các tổ hợp lấy từ lõi tính ở các mục 4 - 5 nên không phải nhập lại.`,
    ) +
    sTx(
      `Tải trọng đặt lên mô hình: trọng lượng bản thân; áp lực đất, tải chất thêm và hoạt tải trên mặt lưng thân theo nêm trượt đã tính ở mục 4 (kể cả thành phần đứng do ma sát đất - tường); đất đắp và tải trên bản đáy phía gót${rib ? ' và trên cạnh huyền sườn' : ''}${R.W ? '; áp lực nước và đẩy ngược' : ''}${E ? '; lực quán tính ngang kh.W của kết cấu và gia tăng áp lực đất ΔPAE ở tổ hợp Đặc biệt' : ''}. Phản lực nền phân bố tuyến tính, không chịu kéo, xác định từ hợp lực của các tải đặt lên mô hình ở từng tổ hợp (nên tự cân bằng); lực trượt đáy phân bố đều trên phần bản đáy tiếp xúc nền. Các gối cố định chỉ khử chuyển vị thể rắn.`,
    ) +
    sFig(
      cfFeMesh(R),
      rib
        ? 'Mô hình phần tử tấm của đơn nguyên tường (nhìn từ phía đất đắp, mỗi ô là một phần tử)'
        : 'Lưới phần tử tấm của dải tường 1 m (đường nét xanh là mặt giữa của thân và bản đáy)',
    );
  h +=
    sH3(`${sec}.2. Tổ hợp tải trọng và kiểm tra cân bằng`) +
    sTx(
      'Phản lực nền ở từng tổ hợp lấy theo hợp lực N (thẳng đứng), H (ngang) và độ lệch tâm e của các tải đặt lên mô hình, phân bố tuyến tính không chịu kéo; sai số cân bằng là tổng phản lực còn dư ở các gối cố định so với tổng tải thẳng đứng.',
    ) +
    sTab(
      ['Tổ hợp', 'N (kN/m)', 'H (kN/m)', 'e (m)', 'q mũi (kPa)', 'q gót (kPa)', 'Sai số cân bằng (%)'],
      combos.map((c) => [
        c.sd ? 'TTGH Sử dụng I' : CD_LAB[c.k] || c.nm,
        tf(c.N, 1),
        tf(c.H, 1),
        tf(c.e, 3),
        tf(c.q1, 1),
        tf(c.q2, 1),
        tf((100 * c.Rpin) / Math.max(c.N * M.Lu, 1e-9), 2),
      ]),
      ['l', '', '', '', '', '', ''],
    );
  const fr = (S: CfeSection) => (S.rib ? K : 1);
  const row = (S: CfeSection) => {
    const cd = (S.cd || {}) as Partial<NonNullable<CfeSection['cd']>>;
    const sd = (S.sd || {}) as Partial<NonNullable<CfeSection['sd']>>;
    const ee = (S.ee || {}) as Partial<NonNullable<CfeSection['ee']>>;
    const hd = S.hand;
    const kk = fr(S);
    const Mfe = kk * feAbs(cd.M);
    return [
      ID(S) + '. ' + S.name + '<br><i>' + S.where + '</i>',
      n(Mfe),
      n(kk * feAbs(cd.V)),
      n(cd.N),
      n(kk * feAbs(sd.M)),
      ...(E ? [n(kk * feAbs(ee.M))] : []),
      hd ? n(hd.M) : '-',
      hd && hd.M > 1e-6 ? tf(Mfe / hd.M, 2) : '-',
      S.util != null ? tf(S.util, 3) : '-',
      S.ok == null ? '-' : sOk(S.ok),
    ];
  };
  h +=
    sH3(`${sec}.3. Nội lực tại các mặt cắt kiểm tra`) +
    sTx(
      `Nội lực lấy từ kết quả phần tử tại các mặt cắt chủ đạo, lấy giá trị tuyệt đối lớn nhất của các tổ hợp Cường độ I-a, I-b, I-c (${E ? 'Đặc biệt I-a, I-b và ' : ''}Sử dụng I). Thân và bản đáy tính trên 1 m bề rộng${rib ? '; các mặt cắt của sườn tính cho một sườn (cách lấy ở mục ' + sec + '.' + nRib + ')' : ''}. Mômen dương căng mặt sau của thân (phía đất đắp) và thớ dưới của bản đáy; lực dọc N dương là nén. Cột "tính tay" lấy từ các mục kiểm toán trên (cùng mặt cắt, cùng tổ hợp).`,
    ) +
    sTab(
      [
        'Mặt cắt',
        'M CĐ (kN.m)',
        'V CĐ (kN)',
        'N (kN)',
        'M SD (kN.m)',
        ...(E ? ['M ĐB (kN.m)'] : []),
        'M tính tay (kN.m)',
        'FE / tay',
        'Hệ số sử dụng',
        'Kết quả',
      ],
      secList.map(row),
      ['l', '', '', '', '', ...(E ? [''] : []), '', '', '', 'c'],
    ) +
    sFig(cfFeSecPos(R), 'Vị trí các mặt cắt kiểm tra (số trong vòng tròn là số hiệu mặt cắt n-n)') +
    sTx(
      `<b>Bảng tổng hợp nội lực M, V, N</b> tại các mặt cắt kiểm tra theo từng tổ hợp (số hiệu mặt cắt như bảng trên). Hàng "bao" lấy giá trị lớn nhất của từng nội lực riêng rẽ trong các tổ hợp thành phần. M có dấu (dương: căng mặt sau thân / thớ dưới bản đáy); V là giá trị tuyệt đối; N dương là nén. Đơn vị theo 1 m bề rộng${rib ? ' (kN.m, kN/m, kN/m); các mặt cắt của sườn tính cho một sườn (kN.m, kN, kN)' : ''}.`,
    ) +
    feMVNTable(R);
  const q = (qq: string, k: string) => cfFeContour(R, { q: qq, k });
  const cap = (nmq: string, k: string) => nmq + ' – ' + FE_KLAB[k];
  const unit = rib
    ? 'kN.m/m, kN/m; mỗi ô là một phần tử, giá trị tại tâm phần tử'
    : 'kN.m/m, kN/m; vẽ dọc trục của thân và bản đáy';
  h +=
    sH3(`${sec}.${nBd}. Biểu đồ nội lực của thân tường và bản đáy`) +
    sTx(
      `Các hình dưới đây là kết quả nội lực của phần tử tấm (${unit}). Hình màu: xanh là giá trị nhỏ nhất, đỏ là giá trị lớn nhất; bảng màu ghi giá trị tại ranh giới các dải, kèm số hiệu và giá trị phần tử lớn nhất / nhỏ nhất. Tổ hợp "bao" lấy ở từng phần tử giá trị có trị tuyệt đối lớn nhất của các tổ hợp Cường độ I-a, I-b, I-c. Mômen Mmax là mômen có trị tuyệt đối lớn hơn trong hai phương (Mxx: uốn theo phương đứng của thân, phương x của bản đáy; Myy: uốn theo phương dọc tường); Vmax tương tự với Qx, Qy; Nmax là lực dọc màng, dương là kéo, âm là nén.${rib ? ' Sườn vẽ màu xám (nội lực sườn xem ở mục ' + sec + '.' + nRib + ').' : ''}`,
    ) +
    sFig(q('M', 'bao'), cap('Biểu đồ mômen uốn lớn nhất Mmax', 'bao')) +
    sFig(q('V', 'bao'), cap('Biểu đồ lực cắt lớn nhất Vmax', 'bao')) +
    sFig(q('N', 'bao'), cap('Biểu đồ lực dọc màng Nmax', 'bao')) +
    sFig(q('M', 'SD'), cap('Biểu đồ mômen uốn lớn nhất Mmax', 'SD')) +
    (E ? sFig(q('M', 'baoE'), cap('Biểu đồ mômen uốn lớn nhất Mmax', 'baoE')) : '');
  h +=
    sH3(`${sec}.${nRe}. Phản lực nền`) +
    sTx(
      'Phản lực nền ứng với tổ hợp bất lợi nhất của từng nhóm: biểu đồ áp lực dưới đáy bản đáy, hợp lực N đặt tại độ lệch tâm e so với tim bản đáy và lực trượt H (ma sát đáy).',
    ) +
    sFig(cfFeReact(R, 'bao'), 'Phản lực nền – ' + FE_KLAB.bao) +
    sFig(cfFeReact(R, 'SD'), 'Phản lực nền – ' + FE_KLAB.SD);
  if (rib && rg) {
    const RR = R as RibCalcResult;
    const S8 = secList.find((s) => s.id === 'S8');
    const S9 = secList.find((s) => s.id === 'S9');
    const hb = (RR.hand ? RR.hand.rib : RR.rib).base!;
    const b = RR.rib.base!;
    h +=
      sH3(`${sec}.${nRib}. Nội lực của sườn`) +
      sTx(
        `Tại cao độ y, mặt cắt ngang của sườn gồm bản sườn và dải thân rộng bf = min(S ; 12ts + tr) = ${tf(Math.min(rg.S, 12 * M.tS(rg.yb) + rg.rt), 2)} m ở chân sườn (TCVN 11823-4, Điều 6.2.6). Hợp lực kéo T và hợp lực nén C là tổng các thành phần lực màng theo phương đứng (kéo, nén) trên mặt cắt; z là khoảng cách giữa hai hợp lực; mômen M là nội ngẫu lực T.z mà cốt thép chủ của sườn phải chịu. Phần mômen uốn riêng của bản thân (uốn đứng) do cốt thép đứng của thân chịu và được kiểm tra ở các mặt cắt ${feSecNo('S1')}, ${feSecNo('S2')}. Lực cắt V là hợp lực ứng suất cắt màng của bản sườn; như ở mục ${sec - 3}, phần lực cắt do thành phần ngang của lực kéo trong thanh xiên chịu được trừ khi kiểm tra cắt.`,
      ) +
      sF(
        String.raw`T = \sum F_i^{+}\ ;\quad C = \sum |F_i^{-}|\ ;\quad z = x_T - x_C\ ;\quad M = T\,z\ ;\quad M_u = K_{FE}\,M\ ;\quad V = \int N_{xy}\,dx`,
      ) +
      sTx(
        `Hệ số hiệu chỉnh K<sub>FE</sub> = ${tf(K, 2)} kể đến việc lưới tấm liên kết sườn - thân mềm hơn thực tế khoảng 8 - 11 % (so với lưới mịn hơn), nhân vào nội lực của sườn (thiên về an toàn). Nội lực ở mỗi cao độ lấy giá trị lớn nhất của các tổ hợp tương ứng.`,
      ) +
      sTab(
        [
          'Mặt cắt',
          'T (kN)',
          'C (kN)',
          'z (m)',
          'M = T.z (kN.m)',
          'Mu = KFE.M (kN.m)',
          'Vu (kN)',
          'Mr (kN.m)',
          'Hệ số sử dụng',
        ],
        [S8, S9]
          .filter((x): x is CfeSection => Boolean(x))
          .map((S) => {
            const sq = (S.cd || {}) as Partial<NonNullable<CfeSection['cd']>>;
            return [
              ID(S) + '. ' + S.name,
              n(sq.T),
              n(sq.Cc),
              tf(sq.z, 3),
              n(sq.M),
              n(K * feAbs(sq.M)),
              n(K * feAbs(sq.V)),
              n(S.cap),
              tf(S.util, 3),
            ];
          }),
        ['l', '', '', '', '', '', '', '', ''],
      ) +
      sTx(
        `Mômen tính tay của sườn ở chân sườn (mục ${sec - 3}, công xôn chịu phản lực lớn nhất ρ.p(Z)): Mu = ${n(Math.abs(hb.Mu))} kN.m, Vu = ${n(hb.Vu)} kN; theo mô hình FE: Mu = ${n(Math.abs(b.Mu))} kN.m, Vu = ${n(b.Vu)} kN. Mô hình tính tay coi toàn bộ mômen của dải tường rộng một khoảng cách sườn do sườn chịu, bỏ qua sự làm việc không gian của bản mặt và lực dọc nén (có lợi) nên thiên về an toàn hơn.`,
      ) +
      sFig(
        cfFeRibDiag(R),
        'Biểu đồ nội lực của sườn dọc chiều cao: mômen M, lực cắt V, lực dọc N (TTGH Cường độ I) và mômen M (TTGH Sử dụng I)',
      ) +
      sFig(
        cfFeChart(RR),
        'Biểu đồ mômen Mu của sườn dọc chiều cao: mô hình FE, tính tay và khả năng Mr',
      ) +
      (basis
        ? sTx(
            `<b>Cơ sở kiểm toán:</b> nội lực sườn ở mục ${sec - 3} lấy theo mô hình FE (cột Mu, Vu ở bảng trên); mô hình tính tay giữ lại để đối chiếu.`,
          )
        : sTx(
            '<b>Cơ sở kiểm toán:</b> mục ' +
              (sec - 3) +
              ' dùng mô hình tính tay; kết quả FE ở đây chỉ để đối chiếu, không tính vào kết luận chung.',
          ));
  }
  const rcs = secList.filter((s) => s.rc && !s.rib);
  const ft = (v: number) => (isFinite(v) ? tf(v, 3) : '-');
  if (rcs.length) {
    h +=
      sH3(`${sec}.${nRc}. Kiểm tra cốt thép tại các mặt cắt (TCVN 11823-5)`) +
      sTx(
        'Mỗi mặt cắt kiểm tra uốn, cốt thép tối thiểu, kiểm soát nứt và cắt như ở các mục kiểm toán thân và bản đáy với cốt thép đang bố trí (Φ, a lấy từ bản vẽ); tổ hợp Đặc biệt kiểm tra với φ = 1,0. Hệ số sử dụng = nhu cầu / khả năng.',
      ) +
      sTab(
        [
          'Mặt cắt',
          'Uốn Mu / Mr',
          'Cắt Vu / Vr',
          'Cốt thép tối thiểu',
          'Nứt s / smax',
          'Hệ số sử dụng',
          'Kết quả',
        ],
        rcs.map((S) => {
          const rc = S.rc!;
          return [
            ID(S) + '. ' + S.name,
            ft(1 / rc.gM!.rM),
            ft(1 / rc.gV!.rV),
            rc.minR ? ft(rc.minR.lim / Math.max(rc.minR.Mr, 1e-9)) : '-',
            rc.cr ? ft(rc.cr.sb / rc.cr.smax) : '-',
            ft(S.util ?? 0),
            sOk(!!S.ok),
          ];
        }),
        ['l', '', '', '', '', '', 'c'],
      );
  }
  h +=
    sKL(
      !!fe.ok,
      'Các mặt cắt kiểm tra bằng mô hình phần tử hữu hạn ĐẠT YÊU CẦU.',
      'Có mặt cắt KHÔNG ĐẠT khi kiểm tra bằng mô hình phần tử hữu hạn - xem hệ số sử dụng ở bảng trên.',
    ) +
    sTx(
      (basis
        ? 'Kết quả mô hình FE được tính vào kết luận chung.'
        : 'Kết quả mô hình FE dùng để đối chiếu, không tính vào kết luận chung.') +
        ' Lưu ý: mô hình đàn hồi nguyên tiết diện, chưa kể nứt và phân phối lại nội lực; mô hình chỉ phản ánh một đơn nguyên tường (dải tường 1 m với tường không sườn).' +
        (E ? ' Lực quán tính của khối đất trên gót chưa kể trong mô hình ở tổ hợp Đặc biệt.' : '') +
        ' Khoá chống trượt, neo và chốt chưa đưa vào độ cứng của mô hình.',
    );
  return { h, sec: sec + 1 };
}

export function feElemInfo(
  R: FeReportResult,
  e: number,
  vals: Float64Array,
  V: Pick<FeInteractiveState, 'k' | 'q'>,
): string {
  const fe = R.fe!;
  const M = fe.M!;
  const E = M.EL[e];
  if (!E) return '';
  const fq = CFE.FQ[V.q as keyof typeof CFE.FQ];
  const c = CFE.elemVals(fe, V.k, e);
  const f = (v: number, d?: number) => cnf(v, d == null ? 1 : d);
  const where =
    E.kind === 'stem'
      ? `Thân tường (y = ${f(E.yc!, 2)} m${M.strip ? '' : ', z = ' + f(E.zc, 2) + ' m'})`
      : E.kind === 'slab'
        ? `Bản đáy (x = ${f(E.xc, 2)} m${M.strip ? '' : ', z = ' + f(E.zc, 2) + ' m'})`
        : `Sườn ${(E.r ?? 0) + 1} (x = ${f(E.xc, 2)} m, y = ${f(E.yc!, 2)} m)`;
  return (
    `<b>Phần tử ${e + 1}</b> · ${where} · <b>${fq.s} = ${f(vals[e])} ${fq.u}</b><br>` +
    `Mxx = ${f(c.Mxx)} · Myy = ${f(c.Myy)} · Mxy = ${f(c.Mxy)} kN.m/m &nbsp;|&nbsp; Qx = ${f(c.Qx)} · Qy = ${f(c.Qy)} kN/m &nbsp;|&nbsp; Nxx = ${f(c.Nxx)} · Nyy = ${f(c.Nyy)} · Nxy = ${f(c.Nxy)} kN/m`
  );
}

export function feStripTables(R: FeReportResult, k: string): string {
  const fe = R.fe!;
  const M = fe.M!;
  const f = (v: number) => cnf(v, 1);
  const one = (e: number) => {
    const c = CFE.elemVals(fe, k, e);
    return [f(c.Mxx), f(c.Qx), f(c.Nxx)];
  };
  const stem: Array<[number, number]> = [];
  const slab: Array<[number, number]> = [];
  M.EL.forEach((E, e) => {
    if (!E) return;
    if (E.kind === 'stem' && E.own) stem.push([E.yc!, e]);
    else if (E.kind === 'slab') slab.push([E.xc, e]);
  });
  stem.sort((a, b) => b[0] - a[0]);
  slab.sort((a, b) => a[0] - b[0]);
  return (
    `<p class="small"><b>Thân tường</b> (từ đỉnh xuống chân)</p>` +
    sTab(
      ['Cao độ y (m)', 'Mxx (kN.m/m)', 'Qx (kN/m)', 'Nxx (kN/m)'],
      stem.map(([y, e]) => [cnf(y, 2), ...one(e)]),
      ['', '', '', ''],
    ) +
    `<p class="small"><b>Bản đáy</b> (từ mũi đến gót)</p>` +
    sTab(
      ['x (m)', 'Mxx (kN.m/m)', 'Qx (kN/m)', 'Nxx (kN/m)'],
      slab.map(([x, e]) => [cnf(x, 2), ...one(e)]),
      ['', '', '', ''],
    )
  );
}
