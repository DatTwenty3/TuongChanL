/**
 * BangTinhCauCong Web App — Rigid-Cap Pile Group (`MC`), Rock/Soil Lateral Subgrade (`RK`),
 * Axial Pile Stiffness (`PILE`, TCVN 10304:2025), and Pile Depth Profile (`pdAxial` / `pdProf`).
 *
 * Exact clean-room TypeScript port of `analysis-cau-cong/modules/12_piles_geotech_mcoc_and_pm3d.js`
 * lines 1-675 and 3009-3590. Units in MC/RK/PILE follow Mcoc conventions: T, m (z downwards,
 * clockwise rotation positive looking from + axis end), with `9.81` conversion to/from kN.
 */

import type {
  PileGroupResult,
  PileHeadForces,
  PileSummaryEnvelope,
  PileSummaryRow,
  SoilStratumType,
} from '../../types/project';
import {
  $,
  KEYS,
  contextState,
  fx,
  getIDP,
  getVisualHooks,
  num,
  nums,
  set,
  v,
} from '../context';
import { geoParse, type SctCalcOutput } from './drilledShaft';

export type GeoParsedLog = ReturnType<typeof geoParse>;

// ---------------------------------------------------------------------------
// 1. RK — Lateral Subgrade Modulus Around Piles (`TCVN 10304:2025 App. A`, `TCVN 11823-10`)
// ---------------------------------------------------------------------------

export interface RkRow {
  i: number;
  row: number;
  name: string;
  type: SoilStratumType;
  top: number;
  bot: number;
  N: number;
  qu: number;
  rqd: number;
  rock: boolean;
  gsi?: number;
  gsiOv?: boolean;
  etn?: number | null;
  E5?: number;
  Em?: number;
  k?: number;
  Ka?: number;
  arow?: number;
  how?: string;
  Kov?: number | null;
  K?: number;
}

export interface RkAutoKResult {
  K: number;
  row: number;
  how: string;
}

export interface RkMakeResult {
  f: (z: number) => number;
  rows: RkRow[];
  bp: number;
  nu: number;
  ok: boolean;
}

export interface RkAlphaResult {
  T: number[];
  Tp: number[];
  Tm: number[];
  L: number[];
  Lm: number;
}

export interface RkPmResult {
  T: number[];
  Tp: number[];
  Tm: number[];
  L: number[];
  Lm: number;
  r: number;
  kind: 'pm';
}

export const RK_EMEI: ReadonlyArray<readonly [number, number, number]> = [
  [100, 1.0, 0.6],
  [70, 0.7, 0.1],
  [50, 0.15, 0.1],
  [35, 0.1, 0.1],
  [20, 0.05, 0.05],
];

export const RK_NU = 0.25;

export const RK_A1: ReadonlyArray<readonly [number, number]> = [
  [6000, 10000],
  [4000, 6000],
  [2350, 4000],
  [1350, 2350],
  [16750, 33350],
];

export const RK_A1T: readonly string[] = [
  'Cát hạt thô ; sét, sét pha cứng (IL < 0)',
  'Cát mịn, cát vừa, cát pha cứng ; sét, sét pha dẻo cứng, nửa cứng',
  'Cát bụi, cát pha dẻo ; sét, sét pha dẻo mềm (0,5 ≤ IL ≤ 0,75)',
  'Sét, sét pha dẻo chảy (0,75 ≤ IL ≤ 1,0)',
  'Cát lẫn sỏi sạn ; đất hòn lớn có lẫn cát',
];

export const rkLin = (x: number, x0: number, x1: number, y0: number, y1: number): number =>
  x <= x0 ? y0 : x >= x1 ? y1 : y0 + ((x - x0) * (y1 - y0)) / (x1 - x0);

export function rkEmei(rqd: number, open = false): number {
  const T = RK_EMEI;
  const k = open ? 2 : 1;
  if (rqd >= 100) return T[0][k];
  if (rqd <= 20) return T[4][k];
  for (let i = 0; i < T.length - 1; i++) {
    const a = T[i];
    const b = T[i + 1];
    if (rqd <= a[0] && rqd >= b[0]) {
      return b[k] + ((rqd - b[0]) * (a[k] - b[k])) / (a[0] - b[0]);
    }
  }
  return T[4][k];
}

export function rkAutoK(l: {
  raw?: string;
  name?: string;
  type: SoilStratumType;
  N?: number;
}): RkAutoKResult | null {
  const N = Math.max(0, l.N || 0);
  const nm = (String(l.raw || '') + ' ' + String(l.name || ''))
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');

  if (l.type === 'Sét') {
    const row = N < 4 ? 4 : N < 8 ? 3 : N < 30 ? 2 : 1;
    const K =
      N < 4
        ? rkLin(N, 0, 4, 1350, 2350)
        : N < 8
          ? rkLin(N, 4, 8, 2350, 4000)
          : N < 30
            ? rkLin(N, 8, 30, 4000, 6000)
            : rkLin(N, 30, 50, 6000, 10000);
    return { K, row, how: 'trạng thái suy từ N = ' + fx(N, 0) };
  }
  if (l.type === 'Cuội') {
    return {
      K: rkLin(N, 10, 50, 16750, 33350),
      row: 5,
      how: 'độ chặt suy từ N = ' + fx(N, 0),
    };
  }
  if (l.type === 'Cát') {
    const row = /\btho\b/.test(nm)
      ? 1
      : /soi|san/.test(nm)
        ? 5
        : /\bpha\b/.test(nm)
          ? N >= 30
            ? 2
            : 3
          : /bui/.test(nm)
            ? 3
            : 2;
    const r = RK_A1[row - 1];
    return {
      K: row === 5 ? rkLin(N, 10, 50, r[0], r[1]) : rkLin(N, 10, 30, r[0], r[1]),
      row,
      how: 'độ chặt suy từ N = ' + fx(N, 0),
    };
  }
  return null;
}

export const rkEmGSI = (qu: number, gsi: number): number =>
  (qu <= 100 ? Math.sqrt(qu / 100) : 1) * Math.pow(10, (gsi - 10) / 40) * 1000; // MPa

export interface RkMakeLayerOverride {
  row: number;
  name: string;
  raw?: string;
  type: SoilStratumType;
  topLog: number;
  bot: number;
  N: number;
  qu: number;
  rqd?: number;
}

export function rkMake(
  ELg: number,
  D: number,
  EpIp: number,
  Kov?: Record<number, number> | number[] | null,
  GSIov?: Record<number, number> | number[] | null,
  EmTN?: Record<number, number> | number[] | null,
  opts?: { layers?: RkMakeLayerOverride[]; gsiDef?: number },
): RkMakeResult {
  let G: Pick<GeoParsedLog, 'layers'>;
  if (opts?.layers) {
    G = { layers: opts.layers as unknown as GeoParsedLog['layers'] };
  } else {
    try {
      G = geoParse();
    } catch {
      G = { layers: [] };
    }
  }
  // Keep parity call to $('s2_open') if present in context
  void ($('s2_open') ? $('s2_open')!.value === '1' : false);
  const nu = RK_NU;
  const bp = D >= 0.8 ? D + 1 : 1.5 * D + 0.5;
  const rows: RkRow[] = [];

  type WorkingLayer = {
    row: number;
    name: string;
    raw?: string;
    type: SoilStratumType;
    top: number;
    bot: number;
    N: number;
    qu: number;
    rqd?: number;
    r?: RkRow;
  };

  const L: WorkingLayer[] = (G.layers || []).map((l) => ({
    row: l.row ?? 0,
    name: l.name,
    raw: l.raw,
    type: l.type,
    top: l.topLog ?? 0,
    bot: l.bot,
    N: l.N,
    qu: l.qu,
    rqd: l.rqd,
  }));

  L.forEach((l, i) => {
    if (l.bot >= ELg - 1e-9) return;
    const r: RkRow = {
      i,
      row: l.row,
      name: l.name,
      type: l.type,
      top: Math.min(l.top, ELg),
      bot: l.bot,
      N: l.N,
      qu: l.qu,
      rqd: l.rqd || 0,
      rock: false,
    };
    const ov = Kov && Kov[l.row] > 0 ? Kov[l.row] : null;
    if ((l.type === 'Đá' || l.type === 'IGM') && l.qu > 0 && EpIp > 0) {
      const gsi =
        GSIov && GSIov[l.row] > 0
          ? GSIov[l.row]
          : opts?.gsiDef !== undefined
            ? opts.gsiDef
            : num('s2_GSI') || 0;
      const etn = EmTN && EmTN[l.row] > 0 ? EmTN[l.row] : null;
      const E5 = rkEmGSI(l.qu, gsi);
      const Em = etn ? Math.min(etn, E5) : E5;
      const Ek = Em * 1000;
      Object.assign(r, {
        rock: true,
        gsi,
        gsiOv: Boolean(GSIov && GSIov[l.row] > 0),
        etn,
        E5,
        Em,
        k: (0.65 * Math.pow((Ek * D ** 4) / EpIp, 1 / 12) * Ek) / (1 - nu * nu),
      });
    } else {
      const a = rkAutoK(l) || { K: 0, row: 0, how: 'chưa xác định' };
      Object.assign(r, {
        rock: false,
        Ka: a.K,
        arow: a.row,
        how: a.how,
        Kov: ov,
        K: ov || a.K,
      });
    }
    l.r = r;
    rows.push(r);
  });

  const at = (x: number): RkRow | null => {
    const el = ELg - x;
    let l = L.find((q) => el <= q.top + 1e-9 && el > q.bot - 1e-9);
    if (!l && L.length && el <= L[L.length - 1].bot) l = L[L.length - 1];
    return l && l.r ? l.r : null;
  };

  const f = (z: number): number => {
    const r = at(z);
    if (!r) return 0;
    return r.rock ? r.k || 0 : (r.K || 0) * Math.max(0, z) * bp;
  };

  return { f, rows, bp, nu, ok: rows.length > 0 };
}

export function rkAlpha(ys: readonly number[], D: number, gcc: number): RkAlphaResult {
  const n = ys.length;
  const o = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  const T = new Array<number>(n).fill(1);
  const Tp = new Array<number>(n).fill(1);
  const Tm = new Array<number>(n).fill(1);
  const Lg = new Array<number>(n).fill(1);

  const fct = (r: number, c: number) =>
    Math.max(0, 1 - (D / r) * (0.789 + 0.229 * c - 0.143 * c * c));

  o.forEach((p, k) => {
    let ap = gcc;
    let am = gcc;
    let al = gcc;
    for (const q of [o[k - 1], o[k + 1]]) {
      if (!q) continue;
      const r = Math.abs(q.y - p.y);
      if (!(r > 0)) continue;
      const c = (q.y - p.y) / r;
      ap *= fct(r, c);
      am *= fct(r, -c);
      al *= fct(r, 0);
    }
    Tp[p.i] = ap;
    Tm[p.i] = am;
    T[p.i] = Math.min(ap, am);
    Lg[p.i] = al;
  });

  return {
    T,
    Tp,
    Tm,
    L: Lg,
    Lm: Lg.reduce((a, b) => a + b, 0) / Math.max(n, 1),
  };
}

export function rkPm(ys: readonly number[], D: number, s: number): RkPmResult {
  const n = ys.length;
  const r = s / D;
  const t = Math.max(0, Math.min(1, (r - 3) / 2));
  const row = (k: number) => {
    const a = [0.8, 0.4, 0.3][Math.min(k, 2)];
    const b = [1.0, 0.85, 0.7][Math.min(k, 2)];
    return a + (b - a) * t;
  };
  const o = ys.map((y, i) => ({ y, i })).sort((a, b) => b.y - a.y);
  const Tp = new Array<number>(n).fill(1);
  const Tm = new Array<number>(n).fill(1);
  if (n > 1) {
    o.forEach((p, k) => {
      Tp[p.i] = row(k);
      Tm[p.i] = row(n - 1 - k);
    });
  }
  const pl = n > 1 ? (r >= 5 ? 1 : 0.8 + 0.2 * t) : 1;
  const T = Tp.map((v, i) => Math.min(v, Tm[i]));
  const L = new Array<number>(n).fill(pl);
  return { T, Tp, Tm, L, Lm: pl, r, kind: 'pm' };
}

export const RK = {
  EMEI: RK_EMEI,
  nu: RK_NU,
  A1: RK_A1,
  A1T: RK_A1T,
  emei: rkEmei,
  autoK: rkAutoK,
  emGSI: rkEmGSI,
  make: rkMake,
  alpha: rkAlpha,
  pm: rkPm,
} as const;

// ---------------------------------------------------------------------------
// 2. PILE — Axial Stiffness (`TCVN 10304:2025 7.4.2-7.4.3`) & P-multiplier (`TCVN 11823-10 Table 21`)
// ---------------------------------------------------------------------------

export interface PileAxialInput {
  rows: RkRow[];
  ELtop: number;
  H: number;
  D: number;
  Ec: number;
  pts: Array<[number, number]>;
  E0s: number;
  E01: number;
  E02: number;
  nu1?: number;
  nu2?: number;
  ktU?: number;
}

export interface PileAxialResult {
  E01: number;
  E02: number;
  e1: { E: number; miss: boolean };
  e2: { E: number; miss: boolean };
  nu1: number;
  nu2: number;
  G1: number;
  G2: number;
  kv: number;
  kv1: number;
  kk: number;
  how: string;
  bt: Record<string, number>;
  kw: number;
  sdl: number[];
  kt: number[];
  ktRaw: number[];
  ktU: number;
  note: string;
  ELp: number;
  H: number;
  D: number;
}

export interface PilePmDirResult {
  f: number[];
  fp: number[];
  fm: number[];
  rows: number;
  r: number;
  perp?: boolean;
}

export interface PilePmResult {
  X: PilePmDirResult;
  Y: PilePmDirResult;
}

const AXIAL_NU_TAB = [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5] as const;
const AXIAL_MV_TAB = [
  1.345, 1.373, 1.405, 1.446, 1.491, 1.54, 1.607, 1.685, 1.786, 1.916, 2.01,
] as const;

export function pileAxialK(o: PileAxialInput): PileAxialResult {
  const rows = o.rows || [];
  const H = o.H;
  const D = o.D;
  const F = (Math.PI * D * D) / 4;
  const ELp = o.ELtop - H;
  const nu1 = o.nu1 || 0.3;
  const nu2 = o.nu2 || 0.3;

  const Eavg = (a: number, b: number) => {
    let sl = 0;
    let se = 0;
    let miss = false;
    rows.forEach((r, k) => {
      const top = Math.min(r.top, a);
      const bot = k === rows.length - 1 ? Math.min(r.bot, b) : r.bot;
      const len = Math.max(0, top - Math.max(bot, b));
      if (len <= 0) return;
      const E = r.rock ? (r.Em ?? NaN) : o.E0s > 0 ? o.E0s : NaN;
      if (!(E > 0)) {
        miss = true;
        return;
      }
      sl += len;
      se += E * len;
    });
    if (!rows.length) miss = true;
    return { E: sl > 0 ? se / sl : NaN, miss };
  };

  const e1 = Eavg(o.ELtop, ELp);
  const e2 = Eavg(ELp, ELp - 0.5 * H);
  const E01 = o.E01 > 0 ? o.E01 : e1.E;
  const E02 = o.E02 > 0 ? o.E02 : e2.E;
  const G1 = E01 / (2 * (1 + nu1));
  const G2 = E02 / (2 * (1 + nu2));
  const nu = (nu1 + nu2) / 2;
  const kvF = (vv: number) => 2.82 - 3.78 * vv + 2.18 * vv * vv;
  const kv = kvF(nu);
  const kv1 = kvF(nu1);
  const EA = o.Ec * F;
  const kk = (G1 * H) / (G2 * D);

  const lerp = (x: number, xs: readonly number[], ys: readonly number[]) => {
    if (x <= xs[0]) return ys[0];
    for (let i = 1; i < xs.length; i++) {
      if (x <= xs[i]) return ys[i - 1] + ((ys[i] - ys[i - 1]) * (x - xs[i - 1])) / (xs[i] - xs[i - 1]);
    }
    return ys[ys.length - 1];
  };

  const mv = lerp(nu, AXIAL_NU_TAB, AXIAL_MV_TAB);
  const z0 = (1 - 2 * nu) / (2 * Math.log(3 - 4 * nu));

  let kw = NaN;
  let how = '';
  let bt: Record<string, number> = {};

  if (H > 0 && G1 > 0 && G2 > 0) {
    if (kk >= 7.5) {
      const chi = EA / (G1 * H * H);
      const l1 = (2.12 * chi ** 0.75) / (1 + 2.12 * chi ** 0.75);
      const b1 = 0.17 * Math.log(kv * kk);
      const a1 = 0.17 * Math.log((kv1 * H) / D);
      const beta = b1 / l1 + (0.3 * (1 - b1 / a1)) / chi;
      kw = ((G1 * H) / beta) * 1000;
      how = 'PT 30 (cọc ma sát dài, k ≥ 7,5)';
      bt = { chi, l1, b1, a1, beta };
    } else {
      const zt = z0 / (1 + kk / mv);
      kw = ((G2 * D) / zt) * 1000;
      how = 'PT 34 (cọc ngắn, k ≤ 7,5)';
      bt = { z0, mv, zt };
    }
  }

  const pts = o.pts && o.pts.length ? o.pts : ([[0, 0]] as Array<[number, number]>);
  const dIJ = (a: number) => {
    const x = (kv * G1 * H) / (2 * G2 * a);
    return a > 1e-6 && x > 1 ? 0.17 * Math.log(x) : 0;
  };
  const sdl = pts.map((p, i) =>
    pts.reduce((t, q, j) => (j === i ? t : t + dIJ(Math.hypot(q[0] - p[0], q[1] - p[1]))), 0),
  );
  const ktU = o.ktU && o.ktU > 0 ? o.ktU : 0;
  const kt = pts.map((_p, i) =>
    ktU > 0 ? ktU : kw > 0 ? 1 / (1 / kw + sdl[i] / (G1 * H * 1000)) : NaN,
  );

  const okData = !(e1.miss && !(o.E01 > 0)) && !(e2.miss && !(o.E02 > 0)) && kw > 0;
  const warn: string[] = [];
  if (!okData && !(ktU > 0)) {
    warn.push(
      kw > 0
        ? 'Chưa có mô đun biến dạng E0 của các lớp đất (không phải đá) dọc thân hoặc dưới mũi cọc: E0,1 ; E0,2 đang lấy trung bình của các lớp có số liệu. Nhập E0 đất (hoặc E0,1 ; E0,2) để tính đủ theo 7.4.2.2.'
        : 'Thiếu mô đun biến dạng E0 dọc thân và dưới mũi cọc (nhập E0 đất hoặc E0,1 ; E0,2): tạm lấy mũi cọc không lún.',
    );
  }
  if (okData && !(ktU > 0) && (H / D <= 5 || kk <= 1)) {
    warn.push('Ngoài điều kiện áp dụng 7.4.2.1 (L/d > 5 ; G1.L/(G2.d) > 1).');
  }
  const ktA = kt.map((val) => (val > 10 ? val : 1e8));

  return {
    E01,
    E02,
    e1,
    e2,
    nu1,
    nu2,
    G1,
    G2,
    kv,
    kv1,
    kk,
    how,
    bt,
    kw,
    sdl,
    kt: ktA,
    ktRaw: kt,
    ktU,
    note: warn.join(' '),
    ELp,
    H,
    D,
  };
}

export function pilePm(pts: readonly [number, number][], D: number): PilePmResult {
  const t3 = (r: number) => Math.max(0, Math.min(1, (r - 3) / 2));
  const rowF = (k: number, t: number) => {
    const a = [0.8, 0.4, 0.3][Math.min(k, 2)];
    const b = [1.0, 0.85, 0.7][Math.min(k, 2)];
    return a + (b - a) * t;
  };
  const dir = (ax: 0 | 1): PilePmDirResult => {
    const n = pts.length;
    const f = new Array<number>(n).fill(1);
    const fp = new Array<number>(n).fill(1);
    const fm = new Array<number>(n).fill(1);
    if (n < 2) return { f, fp, fm, rows: 1, r: Infinity };
    const keys = [...new Set(pts.map((p) => Math.round(p[ax] * 100) / 100))].sort((a, b) => a - b);
    const nr = keys.length;
    const ri = (p: [number, number]) => keys.indexOf(Math.round(p[ax] * 100) / 100);
    if (nr === 1) {
      const ys = pts.map((p) => p[1 - ax]).sort((a, b) => a - b);
      let s = Infinity;
      for (let i = 1; i < ys.length; i++) {
        if (ys[i] - ys[i - 1] > 1e-6) s = Math.min(s, ys[i] - ys[i - 1]);
      }
      const r = s / D;
      const val = r >= 5 ? 1 : 0.8 + 0.2 * t3(r);
      return {
        f: f.fill(val),
        fp: fp.fill(val),
        fm: fm.fill(val),
        rows: 1,
        r,
        perp: true,
      };
    }
    let s = Infinity;
    for (let i = 1; i < nr; i++) s = Math.min(s, keys[i] - keys[i - 1]);
    const r = s / D;
    const t = t3(r);
    pts.forEach((p, i) => {
      const k = ri(p);
      fp[i] = rowF(nr - 1 - k, t);
      fm[i] = rowF(k, t);
      f[i] = Math.min(fp[i], fm[i]);
    });
    return { f, fp, fm, rows: nr, r };
  };
  return { X: dir(0), Y: dir(1) };
}

export const PILE = {
  axialK: pileAxialK,
  pm: pilePm,
} as const;

// ---------------------------------------------------------------------------
// 3. MC — Rigid-Cap 6-DOF Pile Group Matrix Solver (`12_piles_geotech_mcoc_and_pm3d.js:373-674`)
// ---------------------------------------------------------------------------

export const MC_GAUSS4: ReadonlyArray<readonly [number, number]> = [
  [-0.8611363116, 0.3478548451],
  [-0.3399810436, 0.6521451549],
  [0.3399810436, 0.6521451549],
  [0.8611363116, 0.3478548451],
];

export interface McLatModel {
  s: number[];
  X: number[][];
  EI: number;
  m: number;
  bp: number;
  l0: number;
}

export type McLatKMatrix = [[number, number], [number, number]] & { model: McLatModel };

export interface McPileInput {
  x: number;
  y: number;
  phi: number;
  psi: number;
  Lo: number;
  H: number;
  Bpx: number;
  Bpy: number;
  F: number;
  Fo: number;
  Ix: number;
  Iy: number;
  Jo: number;
  Po: number;
  Co: number;
  Ct: number;
  r1?: number;
}

export interface McCapSoilInput {
  Kn: number;
  Evu: number;
  Evn: number;
  m: number;
  Ax: number;
  By: number;
  Cz: number;
  md: number;
  mb: number;
}

export interface McPileStiffnessResult {
  K: number[][];
  r1: number;
  Kx: McLatKMatrix;
  Ky: McLatKMatrix;
  alpha: number;
  ah: number;
}

export interface McRunPart {
  x: number;
  y: number;
  bx: number;
  by: number;
  TA: number[][];
  K: number[][];
  PK: McPileStiffnessResult;
}

export interface McRunCaseResult {
  U: [number, number, number, number, number, number];
  pf: PileHeadForces[];
}

export interface McRunResult extends PileGroupResult {
  parts: McRunPart[];
  res: McRunCaseResult[];
  Kc: number[][];
}

export interface McProfileRow {
  z: number;
  u: number;
  th: number;
  Q: number;
  M: number;
  p: number;
}

export function mcSolve(
  Ain: readonly (readonly number[])[],
  Bin: readonly (readonly number[])[],
): number[][] {
  const n = Ain.length;
  const m = Bin[0].length;
  const A = Ain.map((r) => r.slice());
  const B = Bin.map((r) => r.slice());
  for (let k = 0; k < n; k++) {
    let p = k;
    let mx = Math.abs(A[k][k]);
    for (let i = k + 1; i < n; i++) {
      if (Math.abs(A[i][k]) > mx) {
        mx = Math.abs(A[i][k]);
        p = i;
      }
    }
    if (p !== k) {
      [A[k], A[p]] = [A[p], A[k]];
      [B[k], B[p]] = [B[p], B[k]];
    }
    const piv = A[k][k];
    if (Math.abs(piv) < 1e-300) throw new Error('Ma trận suy biến');
    for (let i = k + 1; i < n; i++) {
      const f = A[i][k] / piv;
      if (f === 0) continue;
      const Ai = A[i];
      const Ak = A[k];
      for (let j = k; j < n; j++) Ai[j] -= f * Ak[j];
      const Bi = B[i];
      const Bk = B[k];
      for (let j = 0; j < m; j++) Bi[j] -= f * Bk[j];
    }
  }
  const X = Array.from({ length: n }, () => new Array<number>(m).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = 0; j < m; j++) {
      let s = B[i][j];
      for (let k = i + 1; k < n; k++) s -= A[i][k] * X[k][j];
      X[i][j] = s / A[i][i];
    }
  }
  return X;
}

export function mcLatK(
  EI: number,
  m: number,
  bp: number,
  l0: number,
  h: number,
  C0: number,
  J0: number,
  Ct: number,
  F0: number,
): McLatKMatrix {
  const s: number[] = [0];
  if (l0 > 0) {
    for (let i = 1; i <= 8; i++) s.push((l0 * i) / 8);
  }
  const ne = 100;
  for (let i = 1; i <= ne; i++) s.push(l0 + h * Math.pow(i / ne, 1.5));
  const n = s.length;
  const N = 2 * n;
  const K = Array.from({ length: N }, () => new Float64Array(N));

  for (let e = 0; e < n - 1; e++) {
    const le = s[e + 1] - s[e];
    const c = EI / le ** 3;
    const ke = [
      [12, 6 * le, -12, 6 * le],
      [6 * le, 4 * le * le, -6 * le, 2 * le * le],
      [-12, -6 * le, 12, -6 * le],
      [6 * le, 2 * le * le, -6 * le, 4 * le * le],
    ].map((r) => r.map((val) => val * c));

    for (const [xi, w] of MC_GAUSS4) {
      const t = (xi + 1) / 2;
      const x = s[e] + t * le;
      const kz = m * bp * Math.max(0, x - l0);
      if (!kz) continue;
      const Nf = [
        1 - 3 * t * t + 2 * t ** 3,
        le * (t - 2 * t * t + t ** 3),
        3 * t * t - 2 * t ** 3,
        le * (-t * t + t ** 3),
      ];
      for (let a = 0; a < 4; a++) {
        for (let b = 0; b < 4; b++) {
          ke[a][b] += ((w * le) / 2) * kz * Nf[a] * Nf[b];
        }
      }
    }
    const id = [2 * e, 2 * e + 1, 2 * e + 2, 2 * e + 3];
    for (let a = 0; a < 4; a++) {
      for (let b = 0; b < 4; b++) K[id[a]][id[b]] += ke[a][b];
    }
  }
  K[N - 1][N - 1] += C0 * J0;
  K[N - 2][N - 2] += Ct * F0;

  const Kbb: number[][] = [];
  const Kba: number[][] = [];
  for (let i = 2; i < N; i++) {
    Kbb.push(Array.from(K[i].slice(2)));
    Kba.push([K[i][0], K[i][1]]);
  }
  const X = mcSolve(Kbb, Kba);
  const R = [
    [K[0][0], K[0][1]],
    [K[1][0], K[1][1]],
  ] as unknown as McLatKMatrix;

  for (let a = 0; a < 2; a++) {
    for (let b = 0; b < 2; b++) {
      let t = 0;
      for (let i = 2; i < N; i++) t += K[a][i] * X[i - 2][b];
      R[a][b] -= t;
    }
  }
  R.model = { s, X, EI, m, bp, l0 };
  return R;
}

export function mcProfile(md: McLatModel, u0: number, t0: number): McProfileRow[] {
  const { s, X, EI, m, bp, l0 } = md;
  const n = s.length;
  const d = [u0, t0];
  for (let i = 0; i < X.length; i++) d.push(-(X[i][0] * u0 + X[i][1] * t0));
  const out: McProfileRow[] = [];

  for (let e = 0; e < n - 1; e++) {
    const le = s[e + 1] - s[e];
    const c = EI / le ** 3;
    const ke = [
      [12, 6 * le, -12, 6 * le],
      [6 * le, 4 * le * le, -6 * le, 2 * le * le],
      [-12, -6 * le, 12, -6 * le],
      [6 * le, 2 * le * le, -6 * le, 4 * le * le],
    ].map((r) => r.map((val) => val * c));

    for (const [xi, w] of MC_GAUSS4) {
      const t = (xi + 1) / 2;
      const x = s[e] + t * le;
      const kz = m * bp * Math.max(0, x - l0);
      if (!kz) continue;
      const Nf = [
        1 - 3 * t * t + 2 * t ** 3,
        le * (t - 2 * t * t + t ** 3),
        3 * t * t - 2 * t ** 3,
        le * (-t * t + t ** 3),
      ];
      for (let a = 0; a < 4; a++) {
        for (let b = 0; b < 4; b++) ke[a][b] += ((w * le) / 2) * kz * Nf[a] * Nf[b];
      }
    }
    const de = [d[2 * e], d[2 * e + 1], d[2 * e + 2], d[2 * e + 3]];
    const f = ke.map((r) => r.reduce((t, val, k) => t + val * de[k], 0));
    out.push({
      z: s[e],
      u: de[0],
      th: de[1],
      Q: f[0],
      M: f[1],
      p: m * bp * Math.max(0, s[e] - l0) * de[0],
    });
    if (e === n - 2) {
      out.push({
        z: s[e + 1],
        u: de[2],
        th: de[3],
        Q: -f[2],
        M: -f[3],
        p: m * bp * Math.max(0, s[e + 1] - l0) * de[2],
      });
    }
  }
  return out;
}

export const mcMatmul = (A: readonly (readonly number[])[], B: readonly (readonly number[])[]): number[][] =>
  A.map((r) => B[0].map((_, j) => r.reduce((t, val, k) => t + val * B[k][j], 0)));

export const mcTranspose = (A: readonly (readonly number[])[]): number[][] =>
  A[0].map((_, j) => A.map((r) => r[j]));

export function mcPileK(
  p: McPileInput,
  d: McCapSoilInput,
  cache: Record<string, McPileStiffnessResult>,
): McPileStiffnessResult {
  const key = JSON.stringify([
    p.r1 || 0,
    p.Lo,
    p.H,
    p.Bpx,
    p.Bpy,
    p.F,
    p.Fo,
    p.Ix,
    p.Iy,
    p.Jo,
    p.Po,
    p.Co,
    p.Ct,
    d.Kn,
    d.Evu,
    d.Evn,
    d.m,
  ]);
  if (cache[key]) return cache[key];
  const r1 =
    p.r1 && p.r1 > 0
      ? p.r1
      : d.Kn === 0
        ? p.Po / 0.007
        : 1 / ((p.Lo + p.H) / (d.Evn * p.F) + 1 / (p.Co * p.Fo));
  const Kx = mcLatK(d.Evu * p.Iy, d.m, p.Bpx, p.Lo, p.H, p.Co, p.Jo, p.Ct, p.Fo);
  const Ky = mcLatK(d.Evu * p.Ix, d.m, p.Bpy, p.Lo, p.H, p.Co, p.Jo, p.Ct, p.Fo);
  const K = Array.from({ length: 6 }, () => new Array<number>(6).fill(0));
  K[2][2] = r1;
  K[0][0] = Kx[0][0];
  K[0][4] = Kx[0][1];
  K[4][0] = Kx[1][0];
  K[4][4] = Kx[1][1];
  K[1][1] = Ky[0][0];
  K[1][3] = -Ky[0][1];
  K[3][1] = -Ky[1][0];
  K[3][3] = Ky[1][1];
  K[5][5] = 1e-9;
  const EI = d.Evu * p.Iy;
  const al = Math.pow((d.m * p.Bpx) / EI, 0.2);
  return (cache[key] = { K, r1, Kx, Ky, alpha: al, ah: al * p.H });
}

export function mcAxes(phi: number, psi: number): [number[], number[], number[]] {
  const sf = Math.sin(phi);
  const cf = Math.cos(phi);
  const sp = Math.sin(psi);
  const cp = Math.cos(psi);
  const e1 = [sf * cp, sf * sp, cf];
  const e2 = [-cf * cp, -cf * sp, sf];
  const e3 = [
    e1[1] * e2[2] - e1[2] * e2[1],
    e1[2] * e2[0] - e1[0] * e2[2],
    e1[0] * e2[1] - e1[1] * e2[0],
  ];
  return [e2, e3, e1];
}

export function mcRun(
  d: McCapSoilInput,
  piles: readonly McPileInput[],
  loads: readonly (readonly number[])[],
): McRunResult {
  const cache: Record<string, McPileStiffnessResult> = {};
  const Kc = Array.from({ length: 6 }, () => new Array<number>(6).fill(0));
  const parts: McRunPart[] = [];

  for (const p of piles) {
    const R = mcAxes((p.phi * Math.PI) / 180, (p.psi * Math.PI) / 180);
    const T = Array.from({ length: 6 }, () => new Array<number>(6).fill(0));
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        T[i][j] = R[i][j];
        T[i + 3][j + 3] = R[i][j];
      }
    }
    const A: number[][] = Array.from({ length: 6 }, (_, i) =>
      Array.from({ length: 6 }, (_, j) => (i === j ? 1 : 0)),
    );
    const x = p.x;
    const y = p.y;
    // u_head = U + Theta x r, r = (x, y, 0)
    A[0][5] = -y;
    A[1][5] = x;
    A[2][3] = y;
    A[2][4] = -x;
    const PK = mcPileK(p, d, cache);
    const TA = mcMatmul(T, A);
    const Kg = mcMatmul(mcTranspose(TA), mcMatmul(PK.K, TA));
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) Kc[i][j] += Kg[i][j];
    }
    parts.push({ x: p.x, y: p.y, bx: p.Bpx, by: p.Bpy, TA, K: PK.K, PK });
  }

  const { Ax, By, Cz, md, mb } = d;
  if (Cz > 0 && mb > 0) {
    const I0 = (mb * Cz * Cz) / 2;
    const I1 = mb * (Cz ** 3 / 3 - Cz ** 3 / 2);
    const I2 = mb * (Cz ** 4 / 4 - (2 * Cz ** 4) / 3 + Cz ** 4 / 2);
    Kc[0][0] += By * I0;
    Kc[0][4] += By * I1;
    Kc[4][0] += By * I1;
    Kc[4][4] += By * I2;
    Kc[1][1] += Ax * I0;
    Kc[1][3] -= Ax * I1;
    Kc[3][1] -= Ax * I1;
    Kc[3][3] += Ax * I2;
  }
  if (md > 0 && Cz > 0 && Ax > 0 && By > 0) {
    const Cd = md * Cz;
    Kc[2][2] += Cd * Ax * By;
    Kc[3][3] += (Cd * Ax * By ** 3) / 12;
    Kc[4][4] += (Cd * By * Ax ** 3) / 12;
  }
  Kc[5][5] += 1e-6;

  const S = [1, 1, 1, -1, -1, -1] as const;
  const res: McRunCaseResult[] = [];
  for (const L of loads) {
    const F = L.map((val, i) => [val * S[i]]);
    const U = mcSolve(Kc, F).map((r) => r[0]);
    const pf: PileHeadForces[] = parts.map((pt) => {
      const ul = pt.TA.map((r) => r.reduce((t, val, k) => t + val * U[k], 0));
      const f = pt.K.map((r) => r.reduce((t, val, k) => t + val * ul[k], 0));
      return { N: f[2], Q2: f[0], Q3: f[1], M1: -f[5], M2: -f[3], M3: -f[4], ul };
    });
    const Uc = U.map((val, i) => val * S[i]) as [number, number, number, number, number, number];
    res.push({ U: Uc, pf });
  }

  return { res, parts, Kc };
}

export function mcSummary(rows: readonly PileSummaryRow[]): PileSummaryEnvelope {
  const pick = (k: keyof PileHeadForces, f: (x: number) => number): PileSummaryRow | null =>
    rows.reduce<PileSummaryRow | null>(
      (b, r) => (b === null || f(r[k] as number) > f(b[k] as number) + 1e-12 ? r : b),
      null,
    );
  return {
    Nmin: pick('N', (val) => -val),
    Nmax: pick('N', (val) => val),
    Q2max: pick('Q2', Math.abs),
    Q3max: pick('Q3', Math.abs),
    M1max: pick('M1', Math.abs),
    M2max: pick('M2', Math.abs),
    M3max: pick('M3', Math.abs),
  };
}

export const MC = {
  gauss4: MC_GAUSS4,
  solve: mcSolve,
  latK: mcLatK,
  profile: mcProfile,
  matmul: mcMatmul,
  T: mcTranspose,
  pileK: mcPileK,
  axes: mcAxes,
  run: mcRun,
  summary: mcSummary,
} as const;

// ---------------------------------------------------------------------------
// 4. Pile Depth Force/Displacement Profiles (`pdAxial`, `pdProf`, `pdStep`)
// ---------------------------------------------------------------------------

export interface PdAxialResult {
  N: number[];
  ok: boolean;
  rho?: number;
  Ltip?: number;
}

export interface PdProfileRow {
  z: number;
  N: number;
  u2: number;
  u3: number;
  Q2: number;
  Q3: number;
  M3: number;
  M2: number;
  p2: number;
  p3: number;
}

export type PdProfileResult = PdProfileRow[] & { axOK: boolean };

export function pdAxial(
  N0: number,
  zs: readonly number[],
  sctr?: SctCalcOutput | null,
): PdAxialResult {
  const k = 9.81;
  const S = sctr !== undefined ? sctr : (contextState.SCTR as SctCalcOutput | null);
  if (!S || !S.slices || !S.slices.length) {
    return { N: zs.map(() => N0), ok: false };
  }
  const L = S.L;
  const wq = S.PW / k / L; // T/m
  const z0 = S.ELcap;
  const sl = S.slices.map((q) => ({ a: z0 - q.zt, b: z0 - q.zb, R: q.Rn / k }));
  const Rs = sl.reduce((t, q) => t + q.R, 0);
  const Rp = S.tip.Rn / k;
  const Ntot = N0 + wq * L;
  const rho = Ntot >= 0 ? Ntot / (Rs + Rp || 1) : Ntot / (Rs || 1);
  const Sup = (z: number) =>
    sl.reduce(
      (t, q) => t + (z <= q.a ? 0 : z >= q.b ? q.R : (q.R * (z - q.a)) / (q.b - q.a)),
      0,
    );
  return {
    N: zs.map((z) => N0 + wq * Math.min(z, L) - rho * Sup(z)),
    ok: true,
    rho,
    Ltip: L,
  };
}

function getPdcMap(): Map<string, PdProfileResult> {
  if (!(contextState.PDC instanceof Map)) {
    contextState.PDC = new Map<string, PdProfileResult>();
  }
  return contextState.PDC as Map<string, PdProfileResult>;
}

export interface McrRuntimeState {
  txtCD: string;
  txtDB: string;
  rows: Record<string, PileSummaryRow[]>;
  U1: Array<[number, number, number, number, number, number]>;
  LC: number[][];
  LD: number[][];
  piles: McPileInput[];
  R1: McRunResult;
  R2: McRunResult;
  lk: { CD?: Array<{ id?: string }>; DB?: Array<{ id?: string }> } | null;
  dd: McCapSoilInput;
  D: number;
  summaryCD: PileSummaryEnvelope | null;
  summaryDB: PileSummaryEnvelope | null;
}

export function pdProf(
  R: McRunResult,
  i: number,
  k: number,
  mcr?: McrRuntimeState | null,
  sctr?: SctCalcOutput | null,
): PdProfileResult {
  const MCR = mcr !== undefined ? mcr : (contextState.MCR as McrRuntimeState | null);
  const pdc = getPdcMap();
  const key = MCR && R === MCR.R1 ? 'C' : 'D';
  const ck = `${key}${i}_${k}`;
  const cached = pdc.get(ck);
  if (cached) return cached;

  const pt = R.parts[i];
  const f = R.res[k].pf[i];
  const ul = f.ul || [0, 0, 0, 0, 0, 0];
  const P = pt.PK;
  const px = mcProfile(P.Kx.model, ul[0], ul[4]);
  const py = mcProfile(P.Ky.model, ul[1], -ul[3]);
  const ax = pdAxial(
    f.N,
    px.map((a) => a.z),
    sctr,
  );
  const out = px.map((a, j) => {
    const b = py[j];
    return {
      z: a.z,
      N: ax.N[j],
      u2: a.u,
      u3: b.u,
      Q2: a.Q,
      Q3: b.Q,
      M3: -a.M,
      M2: b.M,
      p2: a.p,
      p3: b.p,
    };
  }) as PdProfileResult;
  out.axOK = ax.ok;
  pdc.set(ck, out);
  return out;
}

// ---------------------------------------------------------------------------
// 5. Step Runners (`mcocStep`, `pdStep`) & Result Mapper
// ---------------------------------------------------------------------------

export interface McocStepDeps {
  TRXY?: Array<[number, number]>;
  TRLK?: { CD?: Array<{ id?: string }>; DB?: Array<{ id?: string }> } | null;
  DCLK?: { CD?: Array<{ id?: string }>; DB?: Array<{ id?: string }> } | null;
  MOR?: { link?: { CD?: Array<{ id?: string }>; DB?: Array<{ id?: string }> } } | null;
  SCTR?: SctCalcOutput | null;
  onMdFlex?: (payload: {
    dd: McCapSoilInput;
    piles: McPileInput[];
    R1: McRunResult;
    R2: McRunResult;
    LC: number[][];
    LD: number[][];
  }) => { ok?: boolean; text?: string } | null;
}

export function pdStep(deps?: { MCR?: McrRuntimeState | null; SCTR?: SctCalcOutput | null }): void {
  const pdc = getPdcMap();
  pdc.clear();
  const ids = ['CD2', 'CD3', 'DB2', 'DB3', 'V'];
  ids.forEach((x) => {
    set('dgPD' + x, '');
    set('tbPD' + x, '');
  });
  set('pdNote', '');
  const MCR = (deps?.MCR !== undefined ? deps.MCR : contextState.MCR) as McrRuntimeState | null;
  const SCTR = (deps?.SCTR !== undefined ? deps.SCTR : contextState.SCTR) as SctCalcOutput | null;
  if (!MCR || !MCR.R1) return;

  const refR = MCR.R1.res.length ? MCR.R1 : MCR.R2;
  if (!refR || !refR.res.length || !refR.parts.length) return;
  const okN = pdProf(refR, 0, 0, MCR, SCTR).axOK;
  set(
    'pdNote',
    okN
      ? ''
      : 'Chưa có kết quả sheet sức chịu tải cọc theo đất nền: N lấy không đổi theo chiều sâu.',
  );
  if (SCTR && MCR.piles.length && Math.abs(SCTR.L - (MCR.piles[0].Lo + MCR.piles[0].H)) > 0.01) {
    set(
      'pdNote',
      `Chiều dài cọc ở sheet sức chịu tải (${fx(SCTR.L, 2)} m) khác chiều dài cọc dùng tính nội lực L0 + h = ${fx(MCR.piles[0].Lo + MCR.piles[0].H, 2)} m.`,
    );
  }

  const profiles = {
    CD2: MCR.R1.res.length ? pdProf(MCR.R1, 0, 0, MCR, SCTR) : null,
    DB2: MCR.R2.res.length ? pdProf(MCR.R2, 0, 0, MCR, SCTR) : null,
  };
  getVisualHooks().renderPileGroup?.({
    prefix: getIDP(),
    mcResult: MCR,
    depthProfile: profiles,
  });
}

export function mcocStep(deps?: McocStepDeps): McrRuntimeState | null {
  const g = (id: string) => num(id);
  const D = num('D') / 1000;
  const d = g('mc_d');
  const KnS = v('mc_Kn', '2');
  const Kn = KnS === 'T' ? 2 : +KnS;
  const knT = $('mc_KnT');
  if (knT && knT.style) knT.style.display = KnS === 'T' ? '' : 'none';

  set('o_mcD', fx(D, 3));
  const F = (Math.PI * (D * D - d * d)) / 4;
  const I = (Math.PI * (D ** 4 - d ** 4)) / 64;
  set('o_mcF', fx(F, 4));
  set('o_mcI', fx(I, 5));
  const Bp = 0.9 * (D + 1) * 0.9;
  set('o_mcBpx', fx(Bp, 3));
  set('o_mcBpy', fx(Bp, 3));

  const MAC = [150, 200, 250, 300, 400, 500, 600];
  const EBT = [230000, 265000, 290000, 315000, 350000, 390000, 400000];
  const Mac = num('fc') * g('mc_kc') * 10;
  const Mc = Math.min(600, Math.max(150, Mac));
  let j = 0;
  while (j < MAC.length - 2 && Mc > MAC[j + 1]) j++;
  const Eb = EBT[j] + ((Mc - MAC[j]) / (MAC[j + 1] - MAC[j])) * (EBT[j + 1] - EBT[j]);
  const Ev = 0.8 * Eb * 10;
  set('o_mcfc', fx(num('fc'), 1));
  set('o_mcMac', fx(Mac, 1));
  set('o_mcEb', fx(Eb, 0));
  set('o_mcEvu', fx(Ev, 0));
  set('o_mcEvn', fx(Ev, 0));

  const H = g('mc_H');
  const Lo = g('mc_Lo');
  const PoU = g('mc_PoU');
  const SCTR = (deps?.SCTR !== undefined ? deps.SCTR : contextState.SCTR) as SctCalcOutput | null;
  const Po = PoU > 0 ? PoU : SCTR && SCTR.QRcd > 0 ? SCTR.QRcd / 9.81 : 0;
  set('o_mcPo', Po ? fx(Po, 2) : 'chưa có');

  let C: number;
  if (v('mc_tip', 'S') === 'R') {
    const Rc = g('mc_Rc');
    C = Rc <= 100 ? 3e4 : Rc >= 2500 ? 1.5e6 : 3e4 + ((Rc - 100) / 2400) * (1.5e6 - 3e4);
  } else {
    const m0 = g('mc_m0');
    C = H <= 10 ? 10 * m0 : m0 * H;
  }
  const Co = D > 0 ? (5 * C) / D : 0;
  const Ct = Co / 2;
  set('o_mcC', fx(C, 0));
  set('o_mcCo', fx(Co, 0));
  set('o_mcCt', fx(Ct, 0));

  const dd: McCapSoilInput = {
    Kn,
    Evu: Ev,
    Evn: Ev,
    m: g('mc_m'),
    Ax: g('mc_Ax'),
    By: g('mc_By'),
    Cz: g('mc_Cz'),
    md: g('mc_md'),
    mb: g('mc_mb'),
  };

  const xy = nums(v('mc_xy', '')).filter((a) => a.length >= 2);
  const piles: McPileInput[] = xy.map((a) => ({
    x: a[0],
    y: a[1],
    phi: a[2] || 0,
    psi: a[3] || 0,
    Lo,
    H,
    Bpx: Bp,
    Bpy: Bp,
    F,
    Fo: F,
    Ix: I,
    Iy: I,
    Jo: I,
    Po,
    Co,
    Ct,
  }));

  if (KnS === 'T') {
    const ELgr = num('s2_ELcap') - Lo;
    const EcM = (Ev * 9.81) / 1000;
    const S0 = rkMake(ELgr, D, Ev * 9.81 * I, [], [], []);
    const AX = pileAxialK({
      rows: S0.rows,
      ELtop: ELgr,
      H,
      D,
      Ec: EcM,
      pts: xy.map((a) => [a[0], a[1]]),
      E0s: g('mc_E0s'),
      E01: g('mc_E01'),
      E02: g('mc_E02'),
      nu1: g('mc_nu1') || 0.3,
      nu2: g('mc_nu2') || 0.3,
      ktU: g('mc_ktU'),
    });
    const ok = AX.kw > 0 || AX.ktU > 0;
    if (ok) {
      piles.forEach((p, i) => {
        p.r1 = 1 / (Lo / (Ev * F) + 9.81 / AX.kt[i]);
      });
    }
    set(
      'o_mcKnT',
      ok
        ? `Độ cứng cọc đơn kw = ${fx(AX.kw, 0)} kN/m (${AX.how || 'nhập trực tiếp'} ; E0,1 = ${fx(AX.E01, 1)} MPa ; E0,2 = ${fx(AX.E02, 1)} MPa). Độ cứng dọc trục từng cọc kể lún bổ sung do các cọc lân cận (PT 36, 37) và đoạn tự do Lo: ρ1 = 1/[Lo/(E.F) + 1/kt] = ${piles.map((p) => fx(p.r1, 0)).join(' ; ')} T/m.${AX.note ? ' ' + AX.note : ''}`
        : '<span class="bad">Chưa có mô đun biến dạng E0 của đất: không tính được độ cứng dọc trục theo TCVN 10304:2025, 7.4.2; tạm lấy theo Kn = 0 (ρ1 = Po/0.007).</span>',
    );
  }

  const LC = nums(v('mc_LCD', ''))
    .filter((a) => a.length >= 3)
    .map((a) => [0, 1, 2, 3, 4, 5].map((idx) => a[idx] || 0));
  const LD = nums(v('mc_LDB', ''))
    .filter((a) => a.length >= 3)
    .map((a) => [0, 1, 2, 3, 4, 5].map((idx) => a[idx] || 0));

  const idp = getIDP();
  const PDW =
    idp === 'T_' && deps?.TRXY
      ? deps.TRXY.map((a) => ({ x: a[0], y: a[1], phi: 0, psi: 0 }))
      : piles;
  let t = '<tr><th>Cọc</th><th>X (m)</th><th>Y (m)</th><th>φ (độ)</th><th>ψ (độ)</th></tr>';
  PDW.forEach((p, idx) => {
    t += `<tr><td class="c">${idx + 1}</td><td>${fx(p.x, 2)}</td><td>${fx(p.y, 2)}</td><td>${fx(p.phi, 2)}</td><td>${fx(p.psi, 2)}</td></tr>`;
  });
  set('tbXY', t);

  const lk =
    idp === 'T_'
      ? deps?.TRLK || null
      : idp === 'P_'
        ? deps?.DCLK || null
        : v('mc_src') === 'mo' && deps?.MOR?.link
          ? deps.MOR.link
          : null;

  // Bảng tải trọng đầu vào (tbLoads) — như bản gốc: có thêm cột "Tổ hợp" khi lấy từ sheet mố / trụ
  {
    const lkr = lk as { CD?: Array<{ id: string }>; DB?: Array<{ id: string }> } | null;
    let tl =
      '<tr><th>T.T</th>' +
      (lkr ? '<th>Tổ hợp</th>' : '') +
      '<th>Hx</th><th>Hy</th><th>P</th><th>Mx</th><th>My</th><th>Mz</th></tr>';
    const blocks: Array<[string, number[][], Array<{ id: string }> | undefined]> = [
      ['TTGH CƯỜNG ĐỘ VÀ SỬ DỤNG', LC, lkr?.CD],
      ['TTGH ĐẶC BIỆT', LD, lkr?.DB],
    ];
    for (const [lab, L, nm] of blocks) {
      tl += `<tr class="grp"><td colspan="${lkr ? 8 : 7}">${lab}</td></tr>`;
      L.forEach((a, i) => {
        tl += `<tr><td class="c">${i + 1}</td>${lkr ? `<td class="l">${nm && nm[i] ? nm[i].id : ''}</td>` : ''}${a.map((val) => `<td>${fx(val, 2)}</td>`).join('')}</tr>`;
      });
    }
    set('tbLoads', tl);
  }

  const bad =
    (Kn === 0 && !(Po > 0)) ||
    !piles.length ||
    !(D > 0) ||
    !(H > 0) ||
    !(dd.Evu > 0) ||
    !(dd.m > 0);

  ['tbDisp', 'tbPF', 'tbSumMC', 'tbChk', 'tbMax'].forEach((id) => set(id, ''));
  if (bad) {
    contextState.MCR = null;
    ['o_mcal', 'o_mcah', 'o_mcr1', 'o_mcr2', 'o_mcr3', 'o_mcr4'].forEach((i) => set(i, ''));
    return null;
  }

  let R1: McRunResult;
  let R2: McRunResult;
  try {
    R1 = mcRun(dd, piles, LC);
    R2 = mcRun(dd, piles, LD);
  } catch (e) {
    contextState.MCR = null;
    set('o_mcr1', 'Lỗi: ' + (e instanceof Error ? e.message : String(e)));
    return null;
  }

  if (idp === '' && deps?.onMdFlex) {
    try {
      const fxRes = deps.onMdFlex({ dd, piles, R1, R2, LC, LD });
      if (fxRes?.text !== undefined) set('o_mcFlex', fxRes.ok ? fxRes.text : '');
    } catch {
      set('o_mcFlex', '');
    }
  }

  const PK = (R1.parts[0] || R2.parts[0])?.PK;
  if (PK) {
    set('o_mcal', fx(PK.alpha, 4));
    set('o_mcah', fx(PK.ah, 2));
    set('o_mcr1', fx(PK.r1, 0));
    set('o_mcr2', fx(PK.Kx[0][0], 1));
    set('o_mcr4', fx(PK.Kx[1][1], 1));
    set('o_mcr3', fx(Math.abs(PK.Kx[0][1]), 1));
  }

  const grp: Array<[string, McRunResult, number[][]]> = [
    ['TTGH CƯỜNG ĐỘ VÀ SỬ DỤNG', R1, LC],
    ['TTGH ĐẶC BIỆT', R2, LD],
  ];

  const rows: Record<string, PileSummaryRow[]> = {};
  for (const [lab, R] of grp) {
    rows[lab] = [];
    piles.forEach((_p, i) =>
      R.res.forEach((r, k) => {
        const f = r.pf[i];
        rows[lab].push({ tc: i + 1, th: k + 1, ...f });
      }),
    );
  }

  const txt: Record<string, string> = {};
  const sums: Record<string, PileSummaryEnvelope | null> = {};
  for (const [lab] of grp) {
    const S = rows[lab].length ? mcSummary(rows[lab]) : null;
    sums[lab] = S;
    let tx = '      T.C  T.H     N        Q2       Q3        M1         M2         M3\n';
    if (S) {
      for (const k of KEYS) {
        const r = S[k];
        if (!r) continue;
        tx += `${k.padEnd(6)} ${String(r.tc).padStart(3)} ${String(r.th).padStart(3)} ${r.N.toFixed(2).padStart(9)} ${r.Q2.toFixed(2).padStart(8)} ${r.Q3.toFixed(2).padStart(8)} ${r.M1.toFixed(3).padStart(10)} ${r.M2.toFixed(3).padStart(10)} ${r.M3.toFixed(3).padStart(10)}\n`;
      }
    }
    txt[lab] = tx;
  }

  // Các bảng kết quả (chuyển vị, nội lực đầu cọc, tổng kết, kiểm tra cân bằng, cực trị) — như bản gốc
  {
    const grpR: Array<[string, McRunResult, number[][]]> = [
      ['TTGH CƯỜNG ĐỘ VÀ SỬ DỤNG', R1, LC],
      ['TTGH ĐẶC BIỆT', R2, LD],
    ];
    let td = '<tr><th>T.H</th><th>X</th><th>Y</th><th>Z</th><th>Fix</th><th>Fiy</th><th>Fiz</th></tr>';
    for (const [lab, R] of grpR) {
      td += `<tr class="grp"><td colspan="7">${lab}</td></tr>`;
      R.res.forEach((r, k) => {
        td += `<tr><td class="c">${k + 1}</td>${r.U.map((val, i) => `<td>${fx(val, i < 3 ? 5 : 6)}</td>`).join('')}</tr>`;
      });
    }
    set('tbDisp', td);

    let tp =
      '<tr><th>T.C</th><th>T.H</th><th>N</th><th>Q2</th><th>Q3</th><th>M1</th><th>M2</th><th>M3</th></tr>';
    for (const [lab, R] of grpR) {
      tp += `<tr class="grp"><td colspan="8">${lab}</td></tr>`;
      piles.forEach((_p, i) =>
        R.res.forEach((r, k) => {
          const f = r.pf[i];
          tp += `<tr><td class="c">${k === 0 ? i + 1 : ''}</td><td class="c">${k + 1}</td><td>${fx(f.N, 2)}</td><td>${fx(f.Q2, 2)}</td><td>${fx(f.Q3, 2)}</td><td>${fx(f.M1, 3)}</td><td>${fx(f.M2, 3)}</td><td>${fx(f.M3, 3)}</td></tr>`;
        }),
      );
    }
    set('tbPF', tp);

    let ts =
      '<tr><th></th><th>T.C</th><th>T.H</th><th>N</th><th>Q2</th><th>Q3</th><th>M1</th><th>M2</th><th>M3</th></tr>';
    for (const [lab] of grpR) {
      const S = sums[lab];
      ts += `<tr class="grp"><td colspan="9">${lab}</td></tr>`;
      if (S) {
        for (const k of KEYS) {
          const r = S[k];
          if (!r) continue;
          ts += `<tr><td class="l">${k}</td><td class="c">${r.tc}</td><td class="c">${r.th}</td><td>${fx(r.N, 2)}</td><td>${fx(r.Q2, 2)}</td><td>${fx(r.Q3, 2)}</td><td>${fx(r.M1, 3)}</td><td>${fx(r.M2, 3)}</td><td>${fx(r.M3, 3)}</td></tr>`;
        }
      }
    }
    set('tbSumMC', ts);

    let tc =
      '<tr><th rowspan="2">T.H</th><th colspan="3">Lực đứng P (T)</th><th colspan="3">Lực ngang Hx (T)</th><th colspan="3">Lực ngang Hy (T)</th></tr><tr><th>Tải</th><th>Cọc</th><th>Bệ</th><th>Tải</th><th>Cọc</th><th>Bệ</th><th>Tải</th><th>Cọc</th><th>Bệ</th></tr>';
    for (const [lab, R, L] of grpR) {
      tc += `<tr class="grp"><td colspan="10">${lab}</td></tr>`;
      R.res.forEach((r, k) => {
        let sx = 0;
        let sy = 0;
        let sz = 0;
        r.pf.forEach((f, i) => {
          const Rr = mcAxes((piles[i].phi * Math.PI) / 180, (piles[i].psi * Math.PI) / 180);
          const loc = [f.Q2, f.Q3, f.N];
          sx += Rr[0][0] * loc[0] + Rr[1][0] * loc[1] + Rr[2][0] * loc[2];
          sy += Rr[0][1] * loc[0] + Rr[1][1] * loc[1] + Rr[2][1] * loc[2];
          sz += Rr[0][2] * loc[0] + Rr[1][2] * loc[1] + Rr[2][2] * loc[2];
        });
        const a = L[k];
        tc += `<tr><td class="c">${k + 1}</td><td>${fx(a[2], 2)}</td><td>${fx(sz, 2)}</td><td>${fx(a[2] - sz, 2)}</td><td>${fx(a[0], 2)}</td><td>${fx(sx, 2)}</td><td>${fx(a[0] - sx, 2)}</td><td>${fx(a[1], 2)}</td><td>${fx(sy, 2)}</td><td>${fx(a[1] - sy, 2)}</td></tr>`;
      });
    }
    set('tbChk', tc);

    let tm =
      '<tr><th colspan="3">Trạng thái giới hạn</th><th colspan="3">Nội lực</th><th>Giá trị</th><th>Đơn vị</th><th>Cọc</th><th>T.H</th></tr>';
    for (const [lab] of grpR) {
      const Rw = rows[lab];
      if (!Rw.length) continue;
      const ext: Array<[string, (r: PileSummaryRow) => number, number, string]> = [
        ['Nmax (nén lớn nhất)', (r) => r.N, 1, 'T'],
        ['Nmin (nhỏ nhất)', (r) => r.N, -1, 'T'],
        ['Qmax', (r) => Math.hypot(r.Q2, r.Q3), 1, 'T'],
        ['Mmax', (r) => Math.hypot(r.M2, r.M3), 1, 'T.m'],
      ];
      ext.forEach(([nm, f, sg, u], j) => {
        const b = Rw.reduce((a, r) => (sg * f(r) > sg * f(a) ? r : a), Rw[0]);
        tm += `<tr>${j === 0 ? `<td class="l" rowspan="4" colspan="3" style="white-space:normal">${lab}</td>` : ''}<td class="l" colspan="3">${nm}</td><td>${fx(f(b), 2)}</td><td class="c">${u}</td><td class="c">${b.tc}</td><td class="c">${b.th}</td></tr>`;
      });
    }
    set('tbMax', tm);
  }

  const mcr: McrRuntimeState = {
    txtCD: txt['TTGH CƯỜNG ĐỘ VÀ SỬ DỤNG'],
    txtDB: txt['TTGH ĐẶC BIỆT'],
    rows,
    U1: R1.res.map((r) => r.U),
    LC,
    LD,
    piles,
    R1,
    R2,
    lk,
    dd,
    D,
    summaryCD: sums['TTGH CƯỜNG ĐỘ VÀ SỬ DỤNG'],
    summaryDB: sums['TTGH ĐẶC BIỆT'],
  };
  contextState.MCR = mcr;
  pdStep({ MCR: mcr, SCTR });
  return mcr;
}

export function toPileGroupResult(
  runResult: McRunResult,
  summaryCD?: PileSummaryEnvelope | null,
  summaryDB?: PileSummaryEnvelope | null,
): PileGroupResult {
  return {
    Kc: runResult.Kc,
    parts: runResult.parts.map((pt) => ({
      x: pt.x,
      y: pt.y,
      bx: pt.bx,
      by: pt.by,
      K: pt.K,
      TA: pt.TA,
    })),
    res: runResult.res.map((r) => ({
      U: r.U,
      pf: r.pf,
    })),
    summaryCD: summaryCD ?? undefined,
    summaryDB: summaryDB ?? undefined,
  };
}
