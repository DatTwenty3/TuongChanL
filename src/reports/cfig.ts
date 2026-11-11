import type { CalcGlobalComboResult, CalcRunBaseResult, Point2D } from '../types/project';

let _calcDec: '.' | ',' = '.';
let _cfN = 0;
let _cfCv: CanvasRenderingContext2D | null = null;
let _sFig = 0;
let _femSecNo = 0;
let _gsSecNo = 0;

export function getCalcDec(): '.' | ',' {
  return _calcDec;
}

export function setCalcDec(dec: '.' | ','): void {
  _calcDec = dec === ',' ? ',' : '.';
}

export function resetReportFigCounter(n = 0): void {
  _sFig = n;
}

export function nextReportFigNo(): number {
  return ++_sFig;
}

export function getReportState(): {
  sFig: number;
  femSecNo: number;
  gsSecNo: number;
} {
  return { sFig: _sFig, femSecNo: _femSecNo, gsSecNo: _gsSecNo };
}

export function setFemSecNo(sec: number): void {
  _femSecNo = sec;
}

export function setGsSecNo(sec: number): void {
  _gsSecNo = sec;
}

export const escHtml = (s: unknown): string =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export function cnf(x: number | null | undefined, d = 2): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return '-';
  const parts = (+x).toFixed(d).split('.');
  let i = parts[0];
  const f = parts[1];
  let neg = i[0] === '-';
  if (neg) i = i.slice(1);
  const dot = _calcDec === ',' ? ',' : '.';
  const ths = _calcDec === ',' ? '.' : ',';
  i = i.replace(/\B(?=(\d{3})+(?!\d))/g, ths);
  if (neg && +i.replace(/\D/g, '') === 0 && !(f && /[1-9]/.test(f))) neg = false;
  return (neg ? '-' : '') + i + (f ? dot + f : '');
}

export const fmtDec = cnf;

export const CALC_DEC = {
  get: getCalcDec,
  set: setCalcDec,
};

export const CD_LAB: Record<string, string> = {
  Ia: 'CĐ I-a',
  Ib: 'CĐ I-b',
  Ic: 'CĐ I-c',
  Ea: 'CĐ ĐB I-a',
  Eb: 'CĐ ĐB I-b',
};

export const cdLab = (cc: Pick<CalcGlobalComboResult, 'k' | 'nm'>): string => CD_LAB[cc.k] || cc.nm;

export const CF_CL: Record<string, string> = {
  r: '#c00000',
  b: '#0050b0',
  g: '#1b7a2a',
  k: '#222222',
  o: '#c06000',
  m: '#8a2be2',
  t: '#0a7f8f',
  n: '#7a4a1a',
};

export interface CFigLabelOpts {
  fs?: number;
  a?: 'start' | 'middle' | 'end';
  rot?: number;
  c?: string;
  b?: boolean;
  i?: boolean;
  h?: boolean;
  hc?: string;
  dx?: number;
  dy?: number;
  fixed?: boolean;
  free?: boolean;
  title?: boolean;
  tr?: number;
  w?: number;
}

export interface CFigLabel {
  x: number;
  y: number;
  t: string;
  o: CFigLabelOpts;
}

export interface CFigRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CFigInstance {
  W: number;
  H: number;
  id: string;
  s: string;
  sc: number;
  lab: CFigLabel[];
  obs: Array<[number, number, number, number]>;
  seg: Array<[number, number, number, number]>;
  X: (x: number) => number;
  Y: (y: number) => number;
  view: (box: [number, number, number, number], rect: CFigRect) => void;
  P: (a: Point2D[]) => string;
  poly: (pts: Point2D[] | null | undefined, st?: string) => void;
  pl: (pts: Point2D[], st?: string) => void;
  ln: (a: Point2D, b: Point2D, st?: string) => void;
  lp: (x1: number, y1: number, x2: number, y2: number, st?: string) => void;
  rp: (x: number, y: number, w: number, h: number, st?: string) => void;
  tp: (x: number, y: number, t: string, o?: CFigLabelOpts) => void;
  t: (p: Point2D, t: string, o?: CFigLabelOpts) => void;
  arp: (x1: number, y1: number, x2: number, y2: number, c?: string, w?: number, dash?: string) => void;
  arTo: (p: Point2D, u: Point2D, L: number, c?: string, w?: number) => Point2D;
  arFr: (p: Point2D, u: Point2D, L: number, c?: string, w?: number) => Point2D;
  dimH: (
    x1: number,
    x2: number,
    ypx: number,
    t?: string,
    ext?: [number, number],
    o?: CFigLabelOpts,
  ) => void;
  dimV: (
    y1: number,
    y2: number,
    xpx: number,
    t?: string,
    ext?: [number, number],
    o?: CFigLabelOpts,
  ) => void;
  arc: (c: Point2D, r: number, a1: number, a2: number, t?: string, o?: CFigLabelOpts) => void;
  gnd: (pts: Point2D[], c?: string) => void;
  dot: (p: Point2D, c?: string, r?: number) => void;
  num: (p: Point2D, t: string, c?: string) => void;
  title: (t: string) => void;
  svg: () => string;
}

export function cfW(t: string, o: CFigLabelOpts = {}): number {
  const s = String(t).replace(/<[^>]+>/g, '');
  const fs = o.fs || 12;
  if (typeof document !== 'undefined') {
    try {
      if (!_cfCv) {
        const cv = document.createElement('canvas');
        _cfCv = cv.getContext('2d');
      }
      if (_cfCv) {
        _cfCv.font = `${o.i ? 'italic ' : ''}${o.b ? 'bold ' : ''}${fs}px "Times New Roman",Times,"Liberation Serif",serif`;
        return _cfCv.measureText(s).width * 1.08;
      }
    } catch {
      // Fallback when 2D canvas context is unavailable (e.g. jsdom without canvas)
    }
  }
  return s.length * fs * 0.5 * (o.b ? 1.06 : 1);
}

export function cfBox(L: CFigLabel, dx: number, dy: number): [number, number, number, number] {
  const o = L.o;
  const fs = o.fs || 12;
  const w = cfW(L.t, o);
  const x = L.x + dx;
  const y = L.y + dy;
  const a = o.a || 'start';
  if (o.rot) {
    const y0 = a === 'middle' ? y - w / 2 : a === 'end' ? y : y - w;
    return [x - 0.9 * fs, y0, x + 0.4 * fs, y0 + w];
  }
  const x0 = a === 'middle' ? x - w / 2 : a === 'end' ? x - w : x;
  return [x0, y - 0.78 * fs, x0 + w, y + 0.24 * fs];
}

const cfOvl = (a: [number, number, number, number], b: [number, number, number, number]): number =>
  Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) *
  Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));

function cfSegHit(
  b: [number, number, number, number],
  s: [number, number, number, number],
): number {
  const [x1, y1, x2, y2] = s;
  const n = Math.max(2, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 3));
  let k = 0;
  for (let i = 0; i <= n; i++) {
    const x = x1 + ((x2 - x1) * i) / n;
    const y = y1 + ((y2 - y1) * i) / n;
    if (x > b[0] && x < b[2] && y > b[1] && y < b[3]) k++;
  }
  return k;
}

export function cfPlace(D: Pick<CFigInstance, 'W' | 'H' | 'lab' | 'obs' | 'seg'>): void {
  const done: Array<[number, number, number, number]> = [];
  const P = 2.5;
  D.lab
    .sort((a, b) => (b.o.title ? 1 : 0) - (a.o.title ? 1 : 0))
    .forEach((L) => {
      if (L.o.fixed) {
        done.push(cfBox(L, 0, 0));
        return;
      }
      const fs = L.o.fs || 12;
      const k = fs * 1.05;
      const w = cfW(L.t, L.o);
      const rot = !!L.o.rot;
      const C: Array<[number, number]> = [[0, 0]];
      for (let m = 1; m <= 6; m++) {
        C.push(rot ? [-m * k, 0] : [0, -m * k]);
        C.push(rot ? [m * k, 0] : [0, m * k]);
        if (m <= 2) {
          C.push(rot ? [0, -m * w * 0.35] : [-m * w * 0.35, 0]);
          C.push(rot ? [0, m * w * 0.35] : [m * w * 0.35, 0]);
        }
      }
      let best: {
        sc: number;
        dx: number;
        dy: number;
        b: [number, number, number, number];
      } | null = null;
      for (const [dx, dy] of C) {
        const b = cfBox(L, dx, dy);
        const bp: [number, number, number, number] = [b[0] - P, b[1] - P, b[2] + P, b[3] + P];
        let sc = 0;
        done.forEach((q) => {
          sc += cfOvl(bp, q) * 10;
        });
        D.obs.forEach((q) => {
          sc += cfOvl(bp, q) * 10;
        });
        if (!L.o.free) {
          D.seg.forEach((sg) => {
            sc += cfSegHit(b, sg) * 12;
          });
        }
        sc +=
          (Math.max(0, 2 - b[0]) +
            Math.max(0, b[2] - (D.W - 2)) +
            Math.max(0, (L.o.title ? 0 : 24) - b[1]) +
            Math.max(0, b[3] - (D.H - 2))) *
          40;
        sc += Math.hypot(dx, dy) * 0.02;
        if (!best || sc < best.sc) best = { sc, dx, dy, b };
        if (sc <= Math.hypot(dx, dy) * 0.02 + 1e-9) break;
      }
      if (best) {
        L.x += best.dx;
        L.y += best.dy;
        done.push(best.b);
      }
    });
}

export function CFig(W: number, H: number): CFigInstance {
  const id = 'cf' + ++_cfN;
  const DG = Math.PI / 180;
  const f1 = (v: number): string => (+v).toFixed(1);

  const defs =
    `<defs><pattern id="${id}S" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="0.9" fill="#a08050"/><circle cx="9" cy="9" r="0.9" fill="#a08050"/><path d="M7,2 L10,2" stroke="#a08050" stroke-width="0.6"/></pattern>` +
    `<pattern id="${id}R" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M0,10 L10,0 M-2,2 L2,-2 M8,12 L12,8" stroke="#a08050" stroke-width="0.6"/></pattern>` +
    Object.entries(CF_CL)
      .map(
        ([k, c]) =>
          `<marker id="${id}M${k}" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,1.5 L10,5 L0,8.5 z" fill="${c}"/></marker>`,
      )
      .join('') +
    '</defs>';

  const D: CFigInstance = {
    W,
    H,
    id,
    s: defs,
    sc: 1,
    lab: [],
    obs: [],
    seg: [],
    X: (x) => x,
    Y: (y) => y,
    view(box, rect) {
      const [x0, x1, y0, y1] = box;
      const sc = Math.min(rect.w / (x1 - x0), rect.h / (y1 - y0));
      const ox = rect.x + (rect.w - (x1 - x0) * sc) / 2;
      const oy = rect.y + (rect.h - (y1 - y0) * sc) / 2;
      D.sc = sc;
      D.X = (x) => ox + (x - x0) * sc;
      D.Y = (y) => oy + (y1 - y) * sc;
    },
    P: (a) => a.map((q) => f1(D.X(q[0])) + ',' + f1(D.Y(q[1]))).join(' '),
    poly(pts, st) {
      if (pts && pts.length > 2) {
        D.s += `<polygon points="${D.P(pts)}" ${st || 'fill="none" stroke="#222"'}/>`;
      }
    },
    pl(pts, st) {
      D.s += `<polyline points="${D.P(pts)}" fill="none" ${st || 'stroke="#222"'}/>`;
    },
    ln(a, b, st) {
      D.s += `<line x1="${f1(D.X(a[0]))}" y1="${f1(D.Y(a[1]))}" x2="${f1(D.X(b[0]))}" y2="${f1(D.Y(b[1]))}" ${st || 'stroke="#222"'}/>`;
    },
    lp(x1, y1, x2, y2, st) {
      D.s += `<line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" ${st || 'stroke="#333" stroke-width="0.7"'}/>`;
    },
    rp(x, y, w, h, st) {
      D.s += `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" ${st || 'fill="none" stroke="#222"'}/>`;
    },
    tp(x, y, t, o) {
      D.lab.push({ x, y, t, o: o || {} });
    },
    t(p, t, o) {
      const oo = o || {};
      D.tp(D.X(p[0]) + (oo.dx || 0), D.Y(p[1]) + (oo.dy || 0), t, oo);
    },
    arp(x1, y1, x2, y2, c, w, dash) {
      D.seg.push([x1, y1, x2, y2]);
      D.s += `<line x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}" stroke="${CF_CL[c || 'r']}" stroke-width="${w || 1.8}"${dash ? ` stroke-dasharray="${dash}"` : ''} marker-end="url(#${id}M${c || 'r'})"/>`;
    },
    arTo(p, u, L, c, w) {
      const n = Math.hypot(u[0], u[1]) || 1;
      const px = D.X(p[0]);
      const py = D.Y(p[1]);
      const ux = u[0] / n;
      const uy = -u[1] / n;
      D.arp(px - ux * L, py - uy * L, px, py, c, w);
      return [px - ux * L, py - uy * L];
    },
    arFr(p, u, L, c, w) {
      const n = Math.hypot(u[0], u[1]) || 1;
      const px = D.X(p[0]);
      const py = D.Y(p[1]);
      const ux = u[0] / n;
      const uy = -u[1] / n;
      D.arp(px, py, px + ux * L, py + uy * L, c, w);
      return [px + ux * L, py + uy * L];
    },
    dimH(x1, x2, ypx, t, ext, o) {
      const a = D.X(x1);
      const b = D.X(x2);
      if (ext) {
        D.lp(a, D.Y(ext[0]), a, ypx + 4, 'stroke="#999" stroke-width="0.5"');
        D.lp(b, D.Y(ext[1]), b, ypx + 4, 'stroke="#999" stroke-width="0.5"');
      }
      D.lp(a - 4, ypx, b + 4, ypx);
      tick(a, ypx);
      tick(b, ypx);
      if (t) D.tp((a + b) / 2, ypx - 4, t, Object.assign({ a: 'middle', fs: 11 }, o || {}));
    },
    dimV(y1, y2, xpx, t, ext, o) {
      const a = D.Y(y1);
      const b = D.Y(y2);
      if (ext) {
        D.lp(
          D.X(ext[0]),
          a,
          xpx + 4 * (Math.sign(xpx - D.X(ext[0])) || 1),
          a,
          'stroke="#999" stroke-width="0.5"',
        );
        D.lp(
          D.X(ext[1]),
          b,
          xpx + 4 * (Math.sign(xpx - D.X(ext[1])) || 1),
          b,
          'stroke="#999" stroke-width="0.5"',
        );
      }
      D.lp(xpx, a + 4, xpx, b - 4);
      tick(xpx, a);
      tick(xpx, b);
      if (t) {
        D.tp(xpx - 4, (a + b) / 2, t, Object.assign({ a: 'middle', fs: 11, rot: -90 }, o || {}));
      }
    },
    arc(c, r, a1, a2, t, o) {
      const oo = o || {};
      const cx = D.X(c[0]);
      const cy = D.Y(c[1]);
      const p = (a: number): Point2D => [cx + r * Math.cos(a * DG), cy - r * Math.sin(a * DG)];
      const A = p(a1);
      const B = p(a2);
      const lg = Math.abs(a2 - a1) > 180 ? 1 : 0;
      const sw = a2 > a1 ? 0 : 1;
      D.s += `<path d="M${f1(A[0])},${f1(A[1])} A${r},${r} 0 ${lg} ${sw} ${f1(B[0])},${f1(B[1])}" fill="none" stroke="${(oo.c && CF_CL[oo.c]) || oo.c || '#333'}" stroke-width="${oo.w || 0.9}"/>`;
      if (t) {
        const am = (a1 + a2) / 2;
        const rr = r + (oo.tr || 11);
        D.tp(cx + rr * Math.cos(am * DG), cy - rr * Math.sin(am * DG) + 4, t, {
          a: 'middle',
          fs: oo.fs || 11,
          c: oo.c,
          i: true,
        });
      }
    },
    gnd(pts, c) {
      D.pl(pts, `stroke="${c || '#3a7d2a'}" stroke-width="1.6"`);
      for (let i = 0; i < pts.length - 1; i++) {
        const a: Point2D = [D.X(pts[i][0]), D.Y(pts[i][1])];
        const b: Point2D = [D.X(pts[i + 1][0]), D.Y(pts[i + 1][1])];
        const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const n = Math.floor(L / 14);
        for (let k = 1; k < n; k++) {
          const x = a[0] + ((b[0] - a[0]) * k) / n;
          const y = a[1] + ((b[1] - a[1]) * k) / n;
          D.lp(x, y, x - 5, y + 6, `stroke="${c || '#3a7d2a'}" stroke-width="0.7"`);
        }
      }
    },
    dot(p, c, r) {
      D.s += `<circle cx="${f1(D.X(p[0]))}" cy="${f1(D.Y(p[1]))}" r="${r || 3.2}" fill="${(c && CF_CL[c]) || c || '#222'}"/>`;
    },
    num(p, t, c) {
      const x = D.X(p[0]);
      const y = D.Y(p[1]);
      D.obs.push([x - 10, y - 10, x + 10, y + 10]);
      D.s += `<circle cx="${f1(x)}" cy="${f1(y)}" r="9" fill="#fff" stroke="${(c && CF_CL[c]) || '#222'}" stroke-width="1.2"/>`;
      emit({ x, y: y + 4, t, o: { a: 'middle', fs: 11, b: true, c, h: false } });
    },
    title: (t) => D.tp(D.W / 2, 18, t, { a: 'middle', fs: 13, b: true, free: true, title: true }),
    svg() {
      cfPlace(D);
      D.lab.forEach(emit);
      D.lab = [];
      return `<svg class="dg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="'Times New Roman',Times,'Liberation Serif',serif">${D.s}</svg>`;
    },
  };

  function emit(L: CFigLabel): void {
    const { x, y, t, o } = L;
    const rot = o.rot ? ` transform="rotate(${o.rot} ${f1(x)} ${f1(y)})"` : '';
    D.s += `<text x="${f1(x)}" y="${f1(y)}" font-size="${o.fs || 12}"${o.a ? ` text-anchor="${o.a}"` : ''} fill="${o.c ? CF_CL[o.c] || o.c : '#111'}"${o.b ? ' font-weight="bold"' : ''}${o.i ? ' font-style="italic"' : ''}${o.h === false ? '' : ` style="paint-order:stroke" stroke="${o.hc || '#fff'}" stroke-width="3" stroke-linejoin="round"`}${rot}>${t}</text>`;
  }

  function tick(x: number, y: number): void {
    D.lp(x - 3.5, y + 3.5, x + 3.5, y - 3.5, 'stroke="#222" stroke-width="1.1"');
  }

  return D;
}

export function cfGBox(
  R: Pick<CalcRunBaseResult, 'g' | 'I' | 'an'>,
  pad: number,
): [number, number, number, number] {
  const g = R.g;
  const I = R.I;
  const xs = [0, g.B, g.xbt + (I.Hs > 1e-9 ? I.m * I.Hs : 0)];
  const ys = [-(R.an ? I.aLr : 0), Math.min(...g.foot.map((p) => p[1])), g.yT + Math.max(I.Hs, 0)];
  return [
    Math.min(...xs) - pad,
    Math.max(...xs, g.B + 0.6) + pad,
    Math.min(...ys) - pad,
    Math.max(...ys) + pad,
  ];
}

export function cfGline(R: Pick<CalcRunBaseResult, 'g' | 'I'>, xr?: number): Point2D[] {
  const g = R.g;
  const I = R.I;
  const P: Point2D[] = [[g.xbt, g.yT]];
  if (I.Hs > 1e-9) P.push([g.xbt + I.m * I.Hs, g.yT + I.Hs]);
  const xe = Math.max(g.B + 1.2, P[P.length - 1][0] + 0.8, xr || 0);
  P.push([xe, P[P.length - 1][1]]);
  return P;
}

export function cfNew(
  bx: [number, number, number, number],
  W: number,
  rw: number,
  rh: number,
  top: number,
  bot: number,
): CFigInstance {
  const sc = Math.min(rw / (bx[1] - bx[0]), rh / (bx[3] - bx[2]));
  const h = (bx[3] - bx[2]) * sc;
  const D = CFig(W, Math.round(h + top + bot));
  D.view(bx, { x: (W - rw) / 2, y: top, w: rw, h });
  return D;
}

export function cfBody(
  D: CFigInstance,
  R: Pick<CalcRunBaseResult, 'g' | 'I'>,
  o: { xr?: number; xl?: number; deep?: number } = {},
): void {
  const g = R.g;
  const id = D.id;
  const I = R.I;
  const G = cfGline(R, o.xr);
  const xr = G[G.length - 1][0];
  const yk = Math.min(...g.foot.map((p) => p[1]));
  D.poly([...g.back, ...G.slice(1), [xr, 0], [g.B, 0]], `fill="url(#${id}S)" stroke="none"`);
  D.gnd(G);
  const xl = o.xl != null ? o.xl : -0.8;
  const yb = Math.min(-(o.deep || 0.8), yk - 0.4);
  D.poly(
    [
      [xl, 0],
      [xr, 0],
      [xr, yb],
      [xl, yb],
    ],
    `fill="url(#${id}${I.rock ? 'R' : 'S'})" stroke="none"`,
  );
  D.ln([xl, 0], [xr, 0], 'stroke="#8a6d3b" stroke-width="1"');
  if (I.hf > 1e-9) {
    const yf = I.ht + I.hf;
    D.poly(
      [
        [xl, 0],
        [0, 0],
        [0, I.ht],
        [g.xfb, g.yF],
        [g.xfb, Math.max(yf, g.yF)],
        [xl, yf],
      ],
      `fill="url(#${id}S)" stroke="none"`,
    );
    D.gnd([
      [xl, yf],
      [g.xfb, yf],
    ]);
  }
  D.poly(g.foot, 'fill="#d9d9d9" stroke="#222" stroke-width="1.4"');
  D.poly(g.stem, 'fill="#d9d9d9" stroke="#222" stroke-width="1.4"');
}
