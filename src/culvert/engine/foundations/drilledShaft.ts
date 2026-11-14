/**
 * BangTinhCauCong Web App — Drilled Shaft Geotechnical Capacity & Group Check (`SCT`)
 *
 * Exact clean-room TypeScript port of TCVN 11823-10:2017 §8.3.5–8.3.7 & Appendix B (O'Neill & Reese)
 * from `analysis-cau-cong/modules/12_piles_geotech_mcoc_and_pm3d.js:676-1442, 1906-3007`.
 */

import type {
  DrilledShaftGroupCheckResult,
  DrilledShaftResult,
  SoilStratumInput,
  SoilStratumType,
} from '../../types/project';
import {
  $,
  FR,
  contextState,
  ctxW,
  fx,
  getIDP,
  getVisualHooks,
  num,
  nums,
  set,
  sv,
  v,
} from '../context';
import { sctTipHtml } from './sctTipHtml';

// ---------------------------------------------------------------------------
// 1. Constants, Resistance Factors, Empirical Lookup Tables (Fig B1, Eq 99-100)
// ---------------------------------------------------------------------------

export const GT_TYPES: readonly SoilStratumType[] = ['Sét', 'Cát', 'Cuội', 'IGM', 'Đá'];

export const SCT_PA = 0.101;
export const SCT_PSI = 0.006895;

export const SCT_GROUP: Readonly<Record<SoilStratumType | 'IGM1', string>> = {
  Sét: 'Sét',
  Cát: 'Cát',
  Cuội: 'Cát',
  IGM: 'IGM',
  IGM1: 'IGM1',
  Đá: 'Đá',
};

/** Table 10.8.3.5.4b-1: αE according to RQD (%) — [RQD, closed joint, open joint] */
export const SCT_AE: ReadonlyArray<readonly [number, number, number]> = [
  [100, 1.0, 0.85],
  [70, 0.85, 0.55],
  [50, 0.6, 0.55],
  [30, 0.5, 0.5],
  [20, 0.45, 0.45],
];

/** Digitized Fig. B1 (O'Neill et al. 1996): qu (MPa) grid for σn/pa = 1..7 */
export const B1Q: readonly number[] = [
  0.5, 0.55, 0.65, 0.8, 0.95, 1.1, 1.25, 1.35, 1.45, 1.9, 2.1, 2.6, 3.1, 3.6, 4.1, 4.6, 5.0,
];

export const B1A: readonly (readonly number[])[] = [
  [
    0.205, 0.195, 0.18, 0.163, 0.15, 0.14, 0.131, 0.126, 0.122, 0.107, 0.102, 0.093, 0.085, 0.078,
    0.074, 0.07, 0.066,
  ],
  [
    0.335, 0.318, 0.291, 0.263, 0.238, 0.222, 0.207, 0.199, 0.192, 0.167, 0.157, 0.142, 0.129,
    0.119, 0.111, 0.104, 0.1,
  ],
  [
    0.445, 0.426, 0.387, 0.347, 0.312, 0.289, 0.268, 0.256, 0.247, 0.213, 0.201, 0.18, 0.162, 0.149,
    0.138, 0.13, 0.122,
  ],
  [
    0.5, 0.5, 0.469, 0.416, 0.373, 0.343, 0.316, 0.301, 0.29, 0.247, 0.233, 0.206, 0.186, 0.169,
    0.156, 0.146, 0.138,
  ],
  [
    0.5, 0.5, 0.5, 0.475, 0.422, 0.386, 0.354, 0.337, 0.322, 0.272, 0.256, 0.224, 0.199, 0.182,
    0.167, 0.155, 0.146,
  ],
  [
    0.5, 0.5, 0.5, 0.5, 0.462, 0.419, 0.382, 0.364, 0.347, 0.29, 0.272, 0.235, 0.209, 0.189, 0.173,
    0.158, 0.149,
  ],
  [
    0.5, 0.5, 0.5, 0.5, 0.49, 0.444, 0.403, 0.381, 0.363, 0.301, 0.28, 0.243, 0.214, 0.194, 0.176,
    0.161, 0.152,
  ],
];

export function normType(tRaw: unknown): SoilStratumType | null {
  const t = String(tRaw || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
  if (/^(1|cat)/.test(t)) return 'Cát';
  if (/^(2|set|dinh)/.test(t)) return 'Sét';
  if (/^(3|cuoi|soi)/.test(t)) return 'Cuội';
  if (/^(4|igm)/.test(t)) return 'IGM';
  if (/^(5|da)/.test(t)) return 'Đá';
  return null;
}

export function alphaE(rqd: number, open: boolean): number {
  const T = SCT_AE;
  const k = open ? 2 : 1;
  if (rqd >= 100) return T[0][k];
  if (rqd < 20) return T[4][k];
  for (let i = 0; i < T.length - 1; i++) {
    const a = T[i];
    const b = T[i + 1];
    if (rqd <= a[0] && rqd >= b[0]) {
      return b[k] + ((rqd - b[0]) * (a[k] - b[k])) / (a[0] - b[0]);
    }
  }
  return T[4][k];
}

export function sctEta(
  s: number,
  D: number,
  oneRow: boolean,
  cap: boolean,
): { r: number; clay: number; sand: number } {
  const r = D > 0 && s > 0 ? s / D : Infinity;
  const clay = cap ? 1 : r <= 2.5 ? 0.65 : r >= 6 ? 1 : 0.65 + (0.35 * (r - 2.5)) / 3.5;
  const sand = cap
    ? 1
    : oneRow
      ? r <= 2
        ? 0.9
        : r >= 3
          ? 1
          : 0.9 + 0.1 * (r - 2)
      : r <= 2.5
        ? 0.67
        : r <= 3
          ? 0.67 + (0.13 * (r - 2.5)) / 0.5
          : r <= 4
            ? 0.8 + 0.2 * (r - 3)
            : 1;
  return { r, clay, sand };
}

export function igmClass(N: number, qu: number): 1 | 2 | 3 {
  return N < 100 ? 1 : qu >= 4.7 ? 3 : 2;
}

export function b1curve(k: number, q: number): number {
  const Q = B1Q;
  const A = B1A[k];
  const qc = Math.min(Q[Q.length - 1], Math.max(Q[0], q));
  let i = 0;
  while (i < Q.length - 2 && qc > Q[i + 1]) i++;
  return A[i] + ((A[i + 1] - A[i]) * (qc - Q[i])) / (Q[i + 1] - Q[i]);
}

export function alphaB1(qu: number, r: number): number {
  if (r < 1) return b1curve(0, qu) * Math.max(r, 0);
  const c = Math.min(r, 7);
  const k = Math.floor(c);
  const f = c - k;
  return k >= 7 ? b1curve(6, qu) : b1curve(k - 1, qu) * (1 - f) + b1curve(k, qu) * f;
}

// ---------------------------------------------------------------------------
// 2. Log, Layer & SPT Parsers
// ---------------------------------------------------------------------------

export interface SctLayerInput {
  row?: number;
  name: string;
  raw?: string;
  bot: number;
  type: SoilStratumType;
  g: number;
  qu: number;
  rqd: number;
  aE: number;
  open: boolean | null;
  N: number;
  topLog?: number;
  nSPT?: number;
  top?: number;
  ge?: number | null;
  igm3?: boolean;
  spt?: SctSptPoint[];
}

export interface SctSptPoint {
  z: number;
  N: number;
}

export function parseLog(txt: string): {
  top: number | null;
  layers: SctLayerInput[];
  spt: SctSptPoint[];
  err: string[];
} {
  const layers: SctLayerInput[] = [];
  const spt: SctSptPoint[] = [];
  const err: string[] = [];
  let top: number | null = null;

  String(txt || '')
    .split(/\r?\n/)
    .forEach((ln, i) => {
      const l = ln.trim();
      if (!l || /^[#/]/.test(l)) return;
      const a = l.replace(/,(?=\d)/g, '.').split(/[\t;]+|\s+/);
      const f = (k: number) => {
        const val = parseFloat(a[k]);
        return Number.isFinite(val) ? val : 0;
      };
      const z = parseFloat(a[0]);
      if (!Number.isFinite(z)) {
        err.push(`Dòng ${i + 1}: cột 1 phải là cao độ`);
        return;
      }
      if (a.length === 1) {
        if (top == null) top = z;
        else err.push(`Dòng ${i + 1}: thiếu số liệu`);
        return;
      }
      const type = a.length >= 3 ? normType(a[2]) : null;
      if (type) {
        const jt = String(a[7] || '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        layers.push({
          name: a[1],
          bot: z,
          type,
          g: f(3),
          qu: f(4),
          rqd: f(5),
          aE: f(6),
          open: /^h/.test(jt) ? true : /^k/.test(jt) ? false : null,
          N: 0,
        });
      } else if (a.length >= 2 && Number.isFinite(parseFloat(a[1]))) {
        spt.push({ z, N: parseFloat(a[1]) });
      } else {
        err.push(
          `Dòng ${i + 1}: không nhận ra (điểm SPT: "Cao_độ N" ; đáy lớp: "Cao_độ Tên Loại γ ...")`,
        );
      }
    });

  layers.sort((x, y) => y.bot - x.bot);
  spt.sort((x, y) => y.z - x.z);

  if (top == null && layers.length) {
    top = Math.max(layers[0].bot, ...spt.map((q) => q.z)) + 0.001;
    err.push('Chưa có dòng cao độ đỉnh lỗ khoan.');
  }

  let prev = top ?? 0;
  layers.forEach((L) => {
    L.topLog = prev;
    const P = spt.filter((q) => q.z <= prev + 1e-9 && q.z > L.bot - 1e-9);
    L.N = P.length ? P.reduce((t, q) => t + q.N, 0) / P.length : 0;
    L.nSPT = P.length;
    prev = L.bot;
  });

  return { top, layers, spt, err };
}

export function parseLayers(txt: string): { layers: SctLayerInput[]; err: string[] } {
  const out: SctLayerInput[] = [];
  const err: string[] = [];
  String(txt || '')
    .split(/\r?\n/)
    .forEach((ln, i) => {
      const l = ln.trim();
      if (!l || /^[#/]/.test(l)) return;
      const a = l.replace(/,(?=\d)/g, '.').split(/[\t;]+|\s+/);
      if (a.length < 4) {
        err.push(`Dòng ${i + 1}: thiếu số liệu`);
        return;
      }
      const type = normType(a[2]);
      const n = (k: number) => {
        const val = parseFloat(a[k]);
        return Number.isFinite(val) ? val : 0;
      };
      if (!type || !Number.isFinite(parseFloat(a[1]))) {
        err.push(`Dòng ${i + 1}: sai cao độ hoặc loại đất`);
        return;
      }
      const jt = String(a[8] || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      out.push({
        name: a[0],
        bot: n(1),
        type,
        N: n(3),
        g: n(4),
        qu: n(5),
        rqd: n(6),
        aE: n(7),
        open: /^h/.test(jt) ? true : /^k/.test(jt) ? false : null,
      });
    });
  return { layers: out, err };
}

export function parseSPT(txt: string): SctSptPoint[] {
  const out: SctSptPoint[] = [];
  String(txt || '')
    .split(/\r?\n/)
    .forEach((ln) => {
      const a = ln
        .trim()
        .replace(/,(?=\d)/g, '.')
        .split(/[\t;]+|\s+/)
        .map(parseFloat);
      if (a.length >= 2 && Number.isFinite(a[0]) && Number.isFinite(a[1])) {
        out.push({ z: a[0], N: a[1] });
      }
    });
  return out.sort((x, y) => y.z - x.z);
}

// ---------------------------------------------------------------------------
// 3. Drilled Shaft Bearing Capacity Engine (`SCT.calc`)
// ---------------------------------------------------------------------------

export interface SctCalcInput {
  D: number;
  L: number;
  ELcap: number;
  ELgs: number;
  s: number;
  gcF?: number;
  spt?: SctSptPoint[];
  noSplit?: boolean;
  oneRow: boolean;
  cap: boolean;
  rockSide?: 'C' | 'AE' | string;
  rkMob?: 'both' | 'tip' | 'side' | string;
  svJ?: number;
  tdJ?: number;
  WL?: number | null;
  layers: SctLayerInput[];
  fc: number;
  gc: number;
  gW: number;
  mSand?: number;
  ER?: number;
  corrN?: boolean;
  qsMax?: number;
  open?: boolean;
  tipRock?: 'A' | 'I' | 'HB' | string;
  GSI?: number;
  mi?: number;
  Dd?: number;
  kSu?: number;
  etaU?: number;
  rf: Record<'Sét' | 'Cát' | 'IGM' | 'IGM1' | 'Đá', readonly number[]>;
}

export interface SctSliceInternal {
  l: SctLayerInput;
  li: number;
  zt: number;
  zb: number;
  Nspt: number | null;
  zs: number | null;
  name: string;
  type: SoilStratumType;
  dz: number;
  sv: number;
  Nraw: number;
  N60: number;
  Lt: number;
  coef: number | null;
  qs: number;
  ex: string;
  Su?: number;
  N160?: number;
  phi?: number;
  sp?: number;
  igc?: 1 | 2 | 3;
  sn?: number;
  snr?: number;
  alB?: number;
  fj?: number;
  Rn: number;
  qsk: number;
}

export interface SctByTypeSummary {
  type: string;
  Rn: number;
  eta: number;
  phiS: number;
  phiU: number;
  L: number;
  Rcd: number;
  Rdb: number;
  Rup: number;
  RupDB: number;
}

export interface SctTipInternal {
  name: string;
  type: SoilStratumType;
  igc: number;
  zSPT: number | null;
  sv: number;
  N60: number;
  qp: number;
  txt: string;
  eta: number;
  phi: number;
  Su?: number;
  Nc0?: number;
  Nc?: number;
  weak?: boolean;
  qp0?: number;
  qu?: number;
  quCap?: boolean;
  Ds?: number;
  sv_?: number;
  td?: number;
  Ksp?: number;
  dd?: number;
  sock?: number;
  mode?: string;
  z2?: number;
  s?: number;
  a?: number;
  mb?: number;
  Aq?: number;
  qpHB?: number;
  capped?: boolean;
  Rn: number;
  Rcd: number;
  Rdb: number;
  qpk: number;
}

export interface SctCalcOutput {
  err?: string;
  D: number;
  P: number;
  A: number;
  EL3: number;
  top: number;
  ELcap: number;
  L: number;
  s: number;
  eta: { r: number; clay: number; sand: number };
  layers: SctLayerInput[];
  slices: SctSliceInternal[];
  byType: Record<string, SctByTypeSummary>;
  tip: SctTipInternal;
  RsCD: number;
  RsDB: number;
  QupCD: number;
  QupDB: number;
  QRcd: number;
  QRdb: number;
  W: number;
  PW: number;
  warn: string[];
}

export function sctCalc(I: SctCalcInput): SctCalcOutput | { err: string } {
  const pa = SCT_PA;
  const D = I.D;
  const P = Math.PI * D;
  const A = (Math.PI * D * D) / 4;
  const EL3 = I.ELcap - I.L;
  const top = Math.min(I.ELcap, I.ELgs);
  const warn: string[] = [];

  if (!(D > 0) || !(I.L > 0)) return { err: 'Thiếu đường kính hoặc chiều dài cọc' };
  const layers = I.layers.map((l) => ({ ...l })).sort((a, b) => b.bot - a.bot);
  if (!layers.length) return { err: 'Chưa có số liệu địa chất' };

  layers.forEach((l) => {
    if (l.type === 'IGM' && l.qu >= 23.9) {
      l.type = 'Đá';
      l.igm3 = true;
      warn.push(
        `Lớp ${l.name} (IGM) có qu ≥ 23.9 MPa: vượt phạm vi IGM loại III (Phụ lục B), tính như đá.`,
      );
    }
  });

  for (let i = layers.length - 1; i >= 0; i--) {
    if (layers[i].bot >= I.ELgs - 1e-9) layers.splice(i, 1);
  }
  if (!layers.length) return { err: 'Toàn bộ địa chất nằm trên cao độ mặt đất sau xói' };

  let prev = I.ELgs;
  layers.forEach((l) => {
    l.top = prev;
    prev = l.bot;
  });

  const last = layers[layers.length - 1];
  if (EL3 < last.bot - 1e-6) {
    warn.push(
      `Mũi cọc (${EL3.toFixed(3)}) thấp hơn đáy lớp cuối (${last.bot.toFixed(3)}): lớp cuối được kéo dài đến mũi cọc.`,
    );
    last.bot = EL3;
  }
  if (top <= EL3) return { err: 'Cao độ mũi cọc cao hơn đỉnh vùng tính ma sát' };

  const E = sctEta(I.s, D, I.oneRow, I.cap);
  const etaOf = (t: SoilStratumType) =>
    t === 'Sét' ? E.clay : t === 'Cát' || t === 'Cuội' ? E.sand : 1;

  const WL = I.WL != null && Number.isFinite(I.WL) ? I.WL : Infinity;
  const GW = 9.81;
  layers.forEach((l) => {
    l.ge = l.bot >= WL ? l.g : (l.top ?? 0) <= WL ? l.g - GW : null;
  });

  const sigv = (z: number) => {
    let s = 0;
    for (const l of layers) {
      const t = l.top ?? 0;
      const b = Math.max(l.bot, z);
      if (t <= b) continue;
      if (t > WL) s += l.g * (t - Math.max(b, WL));
      if (WL > b) s += (l.g - GW) * (Math.min(t, WL) - b);
    }
    return s / 1000;
  };

  const tipL = layers.find((l) => EL3 <= (l.top ?? 0) + 1e-9 && EL3 >= l.bot - 1e-9) || last;

  // Divide strata into <= 2 m segments
  const slices: SctSliceInternal[] = [];
  const SPT = I.spt || [];
  layers.forEach((l) => {
    l.spt = SPT.filter((q) => q.z <= (l.top ?? 0) + 1e-9 && q.z > l.bot - 1e-9);
  });

  const pushSeg = (
    l: SctLayerInput,
    li: number,
    t: number,
    b: number,
    Nspt: number | null,
    zs: number | null,
  ) => {
    const n = I.noSplit ? 1 : Math.ceil((t - b) / 2 - 1e-9);
    const h = (t - b) / n;
    for (let k = 0; k < n; k++) {
      slices.push({
        l,
        li,
        zt: t - k * h,
        zb: t - (k + 1) * h,
        Nspt,
        zs,
        name: l.name,
        type: l.type,
        dz: 0,
        sv: 0,
        Nraw: 0,
        N60: 0,
        Lt: 0,
        coef: null,
        qs: 0,
        ex: '',
        Rn: 0,
        qsk: 0,
      });
    }
  };

  layers.forEach((l, li) => {
    const t = Math.min(l.top ?? 0, top);
    const b = Math.max(l.bot, EL3);
    if (t - b < 1e-6) return;
    if (!l.spt?.length) {
      pushSeg(l, li, t, b, null, null);
      return;
    }
    const Pspt = l.spt;
    Pspt.forEach((q, i) => {
      const zt = i === 0 ? (l.top ?? 0) : (Pspt[i - 1].z + q.z) / 2;
      const zb = i === Pspt.length - 1 ? l.bot : (q.z + Pspt[i + 1].z) / 2;
      const a = Math.min(zt, t);
      const c = Math.max(zb, b);
      if (a - c > 1e-6) {
        slices.push({
          l,
          li,
          zt: a,
          zb: c,
          Nspt: q.N,
          zs: q.z,
          name: l.name,
          type: l.type,
          dz: 0,
          sv: 0,
          Nraw: 0,
          N60: 0,
          Lt: 0,
          coef: null,
          qs: 0,
          ex: '',
          Rn: 0,
          qsk: 0,
        });
      }
    });
  });

  const exTop = top - 1.5;
  for (const S of slices) {
    const l = S.l;
    const t = l.type;
    const dz = S.zt - S.zb;
    const zm = (S.zt + S.zb) / 2;
    const sv = sigv(zm);
    S.name = l.name;
    S.type = t;
    S.dz = dz;
    S.sv = sv * 1000;
    S.Nraw = S.Nspt != null ? S.Nspt : l.N;
    S.N60 = (S.Nraw * (I.ER || 60)) / 60;
    S.Lt = dz;
    S.coef = null;
    S.qs = 0;
    S.ex = '';

    if (t === 'Sét') {
      const ov = (a: number, b: number) => Math.max(0, Math.min(S.zt, a) - Math.max(S.zb, b));
      const e1 = ov(top, exTop);
      const e2 = ov(EL3 + D, EL3);
      S.Lt = Math.max(0, dz - e1 - e2);
      S.ex = [
        e1 > 1e-9 ? 'bỏ 1.5 m đầu cọc' : '',
        e2 > 1e-9 ? 'bỏ đoạn 1D trên mũi cọc' : '',
      ]
        .filter(Boolean)
        .join('; ');
      const Su = Math.min(((I.kSu || 5) / 1000) * S.N60, 0.25);
      const r = Su / pa;
      const al = r <= 1.5 ? 0.55 : 0.55 - 0.1 * (r - 1.5);
      S.Su = Su * 1000;
      S.coef = al;
      S.qs = al * Su;
    } else if (t === 'Cát' || t === 'Cuội') {
      const CN = Math.min(2, 0.77 * Math.log10(1.92 / Math.max(sv, 1e-4)));
      const N1 = I.corrN ? Math.max(CN, 0) * S.N60 : S.N60;
      S.N160 = N1;
      const ph = N1 > 0 ? 27.5 + 9.2 * Math.log10(N1) : 0;
      const pr = (ph * Math.PI) / 180;
      S.phi = ph;
      const sp =
        t === 'Cát' ? 0.47 * pa * Math.pow(S.N60, I.mSand || 0.6) : 0.15 * pa * S.N60;
      S.sp = sp * 1000;
      const be =
        sv > 0 && ph > 0 ? (1 - Math.sin(pr)) * Math.pow(sp / sv, Math.sin(pr)) * Math.tan(pr) : 0;
      S.coef = be;
      S.qs = be * sv;
      if (I.qsMax && I.qsMax > 0 && S.qs > I.qsMax) {
        S.qs = I.qsMax;
        S.ex = `qs ≤ ${I.qsMax} MPa`;
      }
    } else if (t === 'IGM') {
      const c = igmClass(S.N60, l.qu);
      S.igc = c;
      if (c === 1) {
        S.qs = 0.52 * SCT_PSI * S.N60;
      } else {
        const zst = Math.min(Math.max(top - zm, 0), 12);
        const sn = (0.65 * (I.gcF || 24) * zst) / 1000;
        const r = sn / pa;
        S.sn = sn * 1000;
        S.snr = r;
        const al = l.aE > 0 ? l.aE : alphaB1(l.qu, r);
        const fj = alphaE(l.rqd || 100, l.open != null ? l.open : Boolean(I.open));
        S.alB = al;
        S.fj = fj;
        S.coef = al;
        S.qs = al * fj * l.qu;
        if (l.qu > 5 || l.qu < 0.5) {
          S.ex = 'qu ngoài phạm vi Hình B1 (0,5 - 5 MPa): lấy theo giá trị biên';
        }
        if (r < 1 && !(l.aE > 0)) {
          S.ex = (S.ex ? S.ex + '; ' : '') + 'σn/pa < 1: α nội suy tuyến tính về 0';
        }
      }
    } else {
      const qu = Math.min(l.qu, I.fc);
      const e97 = I.rockSide !== 'C';
      const ae = e97
        ? l.aE > 0
          ? l.aE
          : alphaE(l.rqd, l.open != null ? l.open : Boolean(I.open))
        : 1;
      S.coef = ae;
      S.qs = (e97 ? 0.65 * ae : 1) * pa * Math.sqrt(qu / pa);
      if (l.qu > I.fc) S.ex = "qu lấy = f'c";
    }

    S.Rn = S.qs * 1000 * P * S.Lt;
    S.qsk = S.qs * 1000;
  }

  if (I.rkMob === 'tip') {
    slices.forEach((S) => {
      if (S.type === 'Đá' && S.Rn > 0) {
        S.Rn = 0;
        S.ex = (S.ex ? S.ex + '; ' : '') + 'không tính ma sát thành bên (Điều 8.3.5.4.1)';
      }
    });
  }

  const byType: Record<string, SctByTypeSummary> = {};
  let RsCD = 0;
  let RsDB = 0;
  let QupCD = 0;
  let QupDB = 0;

  for (const S of slices) {
    const GKey = (S.type === 'IGM' && S.igc === 1 ? 'IGM1' : SCT_GROUP[S.type]) as keyof typeof I.rf;
    const f = I.rf[GKey];
    const et = etaOf(S.type);
    const key =
      S.type === 'IGM'
        ? S.igc === 1
          ? 'IGM loại I'
          : `IGM loại ${S.igc === 2 ? 'II' : 'III'}`
        : S.type;
    const o =
      byType[key] ||
      (byType[key] = {
        type: key,
        Rn: 0,
        eta: et,
        phiS: f[0],
        phiU: f[2],
        L: 0,
        Rcd: 0,
        Rdb: 0,
        Rup: 0,
        RupDB: 0,
      });
    o.Rn += S.Rn;
    o.L += S.Lt;
  }

  Object.values(byType).forEach((o) => {
    o.Rcd = o.phiS * o.eta * o.Rn;
    o.Rdb = o.eta * o.Rn;
    o.Rup = o.phiU * (I.etaU || 1) * o.Rn;
    o.RupDB = 0.8 * (I.etaU || 1) * o.Rn;
    RsCD += o.Rcd;
    RsDB += o.Rdb;
    QupCD += o.Rup;
    QupDB += o.RupDB;
  });

  // Tip resistance
  const tipSPT = (tipL.spt || [])
    .slice()
    .sort((x, y) => Math.abs(x.z - EL3) - Math.abs(y.z - EL3))[0];
  const n3 = ((tipSPT ? tipSPT.N : tipL.N) * (I.ER || 60)) / 60;
  const tt = tipL.type;
  const sv3 = sigv(EL3);
  const igc = tt === 'IGM' ? igmClass(n3, tipL.qu) : 0;
  const tipGroupKey = (igc === 1 ? 'IGM1' : SCT_GROUP[tt]) as keyof typeof I.rf;

  const Tp: SctTipInternal = {
    name: tipL.name,
    type: tt,
    igc,
    zSPT: tipSPT ? tipSPT.z : null,
    sv: sv3 * 1000,
    N60: n3,
    qp: 0,
    txt: '',
    eta: etaOf(tt),
    phi: I.rf[tipGroupKey][1],
    Rn: 0,
    Rcd: 0,
    Rdb: 0,
    qpk: 0,
  };

  if (tt === 'Sét') {
    const Su = Math.min(((I.kSu || 5) / 1000) * n3, 0.25);
    const Z = top - EL3;
    const Nc0 = Math.min(9, 6 * (1 + (0.2 * Z) / D));
    const Nc = Su < 0.024 ? 0.67 * Nc0 : Nc0;
    Tp.Su = Su * 1000;
    Tp.Nc0 = Nc0;
    Tp.Nc = Nc;
    Tp.weak = Su < 0.024;
    Tp.qp = Math.min(Nc * Su, 4);
    Tp.txt = 'qp = Nc.Su ≤ 4 MPa';
  } else if (tt === 'Cát' || tt === 'Cuội') {
    const n = Math.min(n3, 50);
    Tp.qp0 = 0.057 * n;
    Tp.qp = Math.min(Tp.qp0, 3);
    Tp.txt = 'qp = 0.057.N60 ≤ 3.0 MPa';
    if (n3 >= 50) {
      warn.push('N60 tại mũi cọc ≥ 50: Phương trình 95 áp dụng cho N60 < 50, đã lấy N60 = 50.');
    }
  } else if (tt === 'IGM') {
    Tp.qu = tipL.qu;
    Tp.Ds = Math.min(tipL.top ?? 0, top) - EL3;
    if (igc === 1) {
      Tp.qp = 6.35 * SCT_PSI * n3;
    } else {
      const sv = I.svJ || 300;
      const td = I.tdJ || 0;
      const Bm = D * 1000;
      const Ksp = (3 + sv / Bm) / (10 * Math.sqrt(1 + (300 * td) / sv));
      const dd = Math.min(1 + (0.4 * Tp.Ds) / D, 3.4);
      Object.assign(Tp, { sv_: sv, td, Ksp, dd });
      Tp.qp = 3 * tipL.qu * Ksp * dd;
      if (sv < 300 || td > 6) {
        warn.push(
          'Phương trình B6 chỉ áp dụng khi khoảng cách vết nứt ≥ 300 mm và độ mở vết nứt ≤ 6 mm.',
        );
      }
    }
  } else {
    const qu = Math.min(tipL.qu, I.fc);
    Tp.qu = qu;
    Tp.quCap = tipL.qu > I.fc;
    let mode = I.tipRock === 'A' ? (tipL.rqd >= 90 ? 'I' : 'HB') : I.tipRock || 'HB';
    let rTop = EL3;
    const ii = layers.indexOf(tipL);
    for (let j = ii; j >= 0 && layers[j].type === 'Đá'; j--) {
      rTop = Math.min(layers[j].top ?? 0, top);
    }
    Tp.sock = rTop - EL3;
    if (mode === 'I' && Tp.sock < 1.5 * D) {
      mode = 'HB';
      warn.push(
        `Chiều sâu ngàm trong đá ${Tp.sock.toFixed(2)} m < 1,5D: không đủ điều kiện dùng qp = 2,5qu (PT 98), tính theo Hoek - Brown (PT 99, 100).`,
      );
    }
    Tp.mode = mode;

    const z2 = EL3 - 2 * D;
    const Z = layers.filter((l) => l.bot < EL3 - 1e-9 && (l.top ?? 0) > z2 + 1e-9);
    const deep = layers.length > 0 && layers[layers.length - 1].bot <= z2 + 1e-9;
    const allR = Z.length > 0 && Z.every((l) => l.type === 'Đá');
    const intact = allR && Z.every((l) => (l.rqd || 0) >= 90);
    Tp.z2 = z2;

    if (!deep) {
      warn.push(
        `Địa chất chưa xuống tới cao độ ${z2.toFixed(2)} m (2,0B dưới mũi cọc): chưa khẳng định được đá dưới mũi (Điều 8.3.5.4.3).`,
      );
    }
    if (!allR && Z.length) {
      warn.push(
        'Trong phạm vi 2,0B dưới mũi cọc có lớp không phải đá: sức kháng mũi theo đá chưa đủ cơ sở (Điều 8.3.5.4.3).',
      );
    }
    if (mode === 'I' && !(intact && deep)) {
      mode = 'HB';
      warn.push(
        'Đá trong phạm vi 2,0B dưới mũi cọc không liền khối (RQD < 90 %) hoặc chưa đủ số liệu: không dùng qp = 2,5qu, tính theo PT 99, 100 (Điều 8.3.5.4.3).',
      );
    }

    const quZ = Math.min(
      ...Z.filter((l) => l.type === 'Đá' && l.qu > 0).map((l) => l.qu),
      Infinity,
    );
    if (Number.isFinite(quZ) && quZ < tipL.qu) {
      Tp.qu = Math.min(quZ, I.fc);
      warn.push(`Lấy qu nhỏ nhất của các lớp đá trong phạm vi 2,0B dưới mũi cọc: ${quZ} MPa.`);
    }

    const qu2 = Tp.qu;
    if (mode === 'I') {
      Tp.qp = 2.5 * qu2;
      Tp.txt = 'qp = 2.5.qu (đá liền khối, ngàm ≥ 1.5D)';
      if (Tp.sock < 1.5 * D) warn.push('Chiều sâu ngàm trong đá < 1.5D: không đủ điều kiện dùng qp = 2.5qu.');
    } else {
      const G = I.GSI ?? 50;
      const Dd = I.Dd ?? 0;
      const mi = I.mi ?? 15;
      const s = Math.exp((G - 100) / (9 - 3 * Dd));
      const a = 0.5 + (Math.exp(-G / 15) - Math.exp(-20 / 3)) / 6;
      const mb = mi * Math.exp((G - 100) / (28 - 14 * Dd));
      const Aq = sv3 + qu2 * Math.pow((mb * sv3) / qu2 + s, a);
      const qp0 = Aq + qu2 * Math.pow((mb * Aq) / qu2 + s, a);
      Object.assign(Tp, { s, a, mb, Aq: Aq * 1000, qpHB: qp0 * 1000 });
      Tp.qp = Math.min(qp0, 2.5 * qu2);
      Tp.capped = qp0 > 2.5 * qu;
      Tp.txt = 'Hoek - Brown (GSI)';
    }
  }

  if (I.rkMob === 'side' && tt === 'Đá') {
    Tp.qp = 0;
    Tp.txt = 'không tính sức kháng mũi (Điều 8.3.5.4.1: không làm sạch, kiểm tra đáy hố khoan)';
  }

  Tp.Rn = Tp.qp * 1000 * A;
  Tp.Rcd = Tp.phi * Tp.eta * Tp.Rn;
  Tp.Rdb = Tp.eta * Tp.Rn;
  Tp.qpk = Tp.qp * 1000;
  const W = I.gc * A * I.L;

  return {
    D,
    P,
    A,
    EL3,
    top,
    ELcap: I.ELcap,
    L: I.L,
    s: I.s,
    eta: E,
    layers,
    slices,
    byType,
    tip: Tp,
    RsCD,
    RsDB,
    QupCD,
    QupDB,
    QRcd: RsCD + Tp.Rcd,
    QRdb: RsDB + Tp.Rdb,
    W,
    PW: I.gW * W,
    warn,
  };
}

export const SCT = {
  pa: SCT_PA,
  PSI: SCT_PSI,
  TYPES: GT_TYPES,
  GROUP: SCT_GROUP,
  AE: SCT_AE,
  B1Q,
  B1A,
  normType,
  alphaE,
  eta: sctEta,
  parseLog,
  parseLayers,
  parseSPT,
  igmClass,
  b1curve,
  alphaB1,
  calc: sctCalc,
} as const;

// ---------------------------------------------------------------------------
// 4. Soil Stratigraphy Input Table Helpers (`geoRows`, `geoParse`, `geoRender`, `geoInit`)
// ---------------------------------------------------------------------------

export function geoRows(): string[][] {
  return v('s2_geoT', '')
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => {
      const a = l.split('\t');
      while (a.length < 9) a.push('');
      return a.slice(0, 9);
    });
}

export function geoSave(rows: string[][]): void {
  sv('s2_geoT', rows.map((r) => r.join('\t')).join('\n'));
}

export function geoRead(): string[][] {
  if (typeof document === 'undefined') return geoRows();
  const tb = document.getElementById(getIDP() + 'tbGeoIn') || document.getElementById('tbGeoIn');
  if (!tb) return geoRows();
  return [...tb.querySelectorAll('tr[data-i]')].map((tr) => {
    const r = Array(9).fill('');
    tr.querySelectorAll('[data-c]').forEach((el) => {
      const inp = el as HTMLInputElement | HTMLSelectElement;
      const col = +(inp.dataset.c || '0');
      r[col] = inp.value.trim();
    });
    return r;
  });
}

export function geoRender(): void {
  const rows = geoRows();
  const esc = (val: string) => String(val).replace(/"/g, '&quot;');
  const idp = getIDP();
  let h =
    '<tr><th rowspan="2">Lớp</th><th>Cao độ đỉnh</th><th>Cao độ đáy</th><th>Dày</th><th rowspan="2">Loại đất</th><th>γ</th><th rowspan="2">N SPT</th><th>qu</th><th>RQD</th><th rowspan="2">α / αE</th><th rowspan="2">Khe nứt</th></tr><tr><th>(m)</th><th>(m)</th><th>(m)</th><th>(kN/m3)</th><th>(MPa)</th><th>(%)</th></tr>';
  rows.forEach((r, i) => {
    const ty = normType(r[2]) || '';
    const jt = /^h/i.test(r[8]) ? 'Hở' : /^k/i.test(r[8]) ? 'Kín' : '';
    h +=
      `<tr data-i="${i}"${i === contextState.GT_SEL ? ' class="sel"' : ''}><td><input class="in gn" data-c="0" value="${esc(r[0])}"></td><td id="${idp}gt_t${i}"></td><td><input class="in" data-c="1" value="${esc(r[1])}"></td><td id="${idp}gt_h${i}"></td>` +
      `<td><select class="in" data-c="2">${ty ? '' : '<option value="" selected></option>'}${GT_TYPES.map((t) => `<option${t === ty ? ' selected' : ''}>${t}</option>`).join('')}</select></td><td><input class="in gn" data-c="3" value="${esc(r[3])}"></td>` +
      `<td><input class="in gn" data-c="4" value="${esc(r[4])}"></td><td><input class="in gn" data-c="5" value="${esc(r[5])}"></td><td><input class="in gn" data-c="6" value="${esc(r[6])}"></td><td id="${idp}gt_a${i}" class="c"></td>` +
      `<td><select class="in" data-c="8" style="width:56px"><option value=""${jt ? '' : ' selected'}></option><option${jt === 'Kín' ? ' selected' : ''}>Kín</option><option${jt === 'Hở' ? ' selected' : ''}>Hở</option></select></td></tr>`;
  });
  set('tbGeoIn', h);
}

export function geoParse(): {
  top: number;
  layers: SctLayerInput[];
  spt: SctSptPoint[];
  err: string[];
} {
  const top = num('s2_top');
  const err: string[] = [];
  const layers: SctLayerInput[] = [];
  let prev = top;

  geoRows().forEach((r, i) => {
    const type = normType(r[2]);
    const bot = parseFloat(String(r[1]).replace(',', '.'));
    const f = (k: number) => {
      const val = parseFloat(String(r[k]).replace(',', '.'));
      return Number.isFinite(val) ? val : 0;
    };
    if (!type || !Number.isFinite(bot)) {
      if (r.some((x) => x)) err.push(`Dòng ${i + 1}: thiếu cao độ đáy hoặc loại đất`);
      return;
    }
    if (bot >= prev - 1e-9) {
      err.push(`Dòng ${i + 1}: cao độ đáy phải thấp hơn cao độ đỉnh (${fx(prev, 3)})`);
    }
    layers.push({
      row: i,
      name: r[0] || String(i + 1),
      raw: String(r[2] || ''),
      bot,
      type,
      g: f(3),
      N: f(4),
      qu: f(5),
      rqd: f(6),
      aE: 0,
      open: /^h/i.test(r[8]) ? true : /^k/i.test(r[8]) ? false : null,
      topLog: prev,
    });
    prev = bot;
  });

  return { top, layers, spt: [], err };
}

export function geoInit(onUpdate?: () => void): void {
  if (typeof document === 'undefined') return;
  const tb = $(`tbGeoIn`) as unknown as HTMLElement | null;
  if (!tb || typeof tb.addEventListener !== 'function') return;
  if (tb.dataset.geoBound === '1') return; // khởi tạo một lần (StrictMode / khởi tạo lại không gắn trùng listener)
  tb.dataset.geoBound = '1';

  // Mọi thao tác bọc ctxW như bản gốc: giữ nguyên tiền tố ngữ cảnh (mố / trụ / ...) tại thời điểm khởi tạo
  tb.addEventListener(
    'focusin',
    ctxW((e: Event) => {
      const target = e.target as HTMLElement | null;
      const tr = target?.closest?.('tr[data-i]') as HTMLElement | null;
      if (tr) {
        contextState.GT_SEL = +(tr.dataset.i || '-1');
        tb.querySelectorAll('tr.sel').forEach((x) => x.classList.remove('sel'));
        tr.classList.add('sel');
      }
    }),
  );
  const upd = ctxW(() => {
    geoSave(geoRead());
    onUpdate?.();
  });
  tb.addEventListener('input', upd);
  tb.addEventListener('change', upd);

  // Dán nhiều dòng từ Excel (tab / xuống dòng) vào bảng địa tầng
  tb.addEventListener(
    'paste',
    ctxW((e: Event) => {
      const cd = (e as ClipboardEvent).clipboardData;
      const text = cd ? cd.getData('text') : '';
      if (!/[\t\n]/.test(text)) return;
      e.preventDefault();
      const target = e.target as HTMLElement | null;
      const tr = target?.closest?.('tr[data-i]') as HTMLElement | null;
      const i0 = tr ? +(tr.dataset.i || '0') : 0;
      const c0 = target?.dataset ? +(target.dataset.c || '0') || 0 : 0;
      const rows = geoRead();
      text
        .replace(/\r/g, '')
        .split('\n')
        .filter((l) => l.trim())
        .forEach((l, k) => {
          const v = l.split('\t');
          const r = rows[i0 + k] || (rows[i0 + k] = Array(9).fill(''));
          const COL = [0, 1, 2, 3, 4, 5, 6, 8];
          const p0 = Math.max(0, COL.indexOf(c0));
          v.forEach((x, j) => {
            const c = COL[p0 + j];
            if (c != null) r[c] = x.trim();
          });
        });
      geoSave(rows);
      geoRender();
      onUpdate?.();
    }),
  );

  // Thêm / chèn / xóa lớp đất
  const gAdd = $('gAdd') as unknown as HTMLElement | null;
  const gIns = $('gIns') as unknown as HTMLElement | null;
  const gDel = $('gDel') as unknown as HTMLElement | null;
  if (gAdd) {
    gAdd.onclick = ctxW(() => {
      const r = geoRead();
      const last = r[r.length - 1] || ['', '', 'Cát', '', '', '', '', '', ''];
      r.push([last[0], '', last[2], last[3], '', '', '', '', '']);
      geoSave(r);
      geoRender();
      onUpdate?.();
    });
  }
  if (gIns) {
    gIns.onclick = ctxW(() => {
      const r = geoRead();
      const i = contextState.GT_SEL >= 0 ? contextState.GT_SEL : r.length;
      r.splice(i, 0, ['', '', (r[i] || [])[2] || 'Cát', '', '', '', '', '', '']);
      geoSave(r);
      geoRender();
      onUpdate?.();
    });
  }
  if (gDel) {
    gDel.onclick = ctxW(() => {
      const r = geoRead();
      const i = contextState.GT_SEL >= 0 && contextState.GT_SEL < r.length ? contextState.GT_SEL : r.length - 1;
      if (i >= 0) r.splice(i, 1);
      contextState.GT_SEL = -1;
      geoSave(r);
      geoRender();
      onUpdate?.();
    });
  }
}

// ---------------------------------------------------------------------------
// 5. Drilled Shaft Step & Group Check (`sctStep`, `sctCheck`, pure `checkDrilledShaftGroup`)
// ---------------------------------------------------------------------------

export interface SctGroupCheckPureInput {
  R: SctCalcOutput;
  piles: Array<{ x: number; y: number }>;
  rowsCD: Array<{ tc: number; th: number | string; N: number }>;
  rowsDB: Array<{ tc: number; th: number | string; N: number }>;
  LC?: number[][];
  LD?: number[][];
  U1?: number[][];
  WL?: number;
  phig?: number;
  dhLim?: number;
  dzLim?: number;
  ER?: number;
  kSu?: number;
  negSkinLayers?: string[];
}

export interface SctGroupCheckDetailed extends DrilledShaftGroupCheckResult {
  singleCompOk: boolean;
  singleUpliftOk: boolean;
  blockNc: number;
  Qg: number;
  QRgCD: number;
  QRgDB: number;
  dispOk: boolean;
  maxDxMm: number;
  maxDyMm: number;
  maxDhMm: number;
  maxDzMm: number;
  negFriction?: {
    DDn: number;
    QRpCD: number;
    QRpDB: number;
    nuCD: number | null;
    nuDB: number | null;
    ok: boolean;
  };
  groupUplift?: {
    Pug: number;
    Wg: number;
    Qug: number;
    phiQug: number;
    ok: boolean;
  };
  weakClay?: Array<{
    name: string;
    z: number;
    q: number;
    qr: number;
    ok: boolean;
  }>;
}

export function checkDrilledShaftGroup(inp: SctGroupCheckPureInput): SctGroupCheckDetailed {
  const { R } = inp;
  const k = 9.81;
  const PW = R.PW / k;
  const P = inp.piles || [];
  const n = P.length;
  const D = R.D;

  let ok = true;
  const ext = (rows: Array<{ tc: number; th: number | string; N: number }>, sg: number) =>
    rows.reduce((a, r) => (sg * r.N > sg * a.N ? r : a), rows[0]);

  const C = inp.rowsCD || [];
  const B = inp.rowsDB || [];
  const mC = C.length ? ext(C, 1) : null;
  const mB = B.length ? ext(B, 1) : null;
  const nC = C.length ? ext(C, -1) : null;
  const nB = B.length ? ext(B, -1) : null;

  const QC = R.QRcd / k;
  const QB = R.QRdb / k;
  const NC = mC ? mC.N + PW : null;
  const NB = mB ? mB.N + PW : null;
  const singleCompOk = (NC == null || QC >= NC) && (NB == null || QB >= NB);
  ok = ok && singleCompOk;

  const wl = inp.WL ?? Infinity;
  const top = R.ELcap;
  const L = R.L;
  const Lw = Number.isFinite(wl) ? Math.max(0, Math.min(L, wl - (top - L))) : 0;
  const Wu = (R.A * ((R.W / (R.A * L)) * (L - Lw) + (R.W / (R.A * L) - 9.81) * Lw)) / k;
  const tC = nC && nC.N < 0 ? -nC.N : null;
  const tB = nB && nB.N < 0 ? -nB.N : null;
  const UC = R.QupCD / k + 0.9 * Wu;
  const UB = R.QupDB / k + 0.9 * Wu;
  const singleUpliftOk = (tC == null || UC >= tC) && (tB == null || UB >= tB);
  ok = ok && singleUpliftOk;

  // Equivalent block
  const xs = P.map((q) => q.x);
  const ys = P.map((q) => q.y);
  const Lx = n ? Math.max(...xs) - Math.min(...xs) + D : 0;
  const Ly = n ? Math.max(...ys) - Math.min(...ys) + D : 0;
  const X = Math.min(Lx, Ly);
  const Y = Math.max(Lx, Ly);
  const cl = R.slices.filter((S) => S.type === 'Sét');
  const Z = cl.reduce((a, S) => a + S.dz, 0);
  const Sbar = Z > 0 ? cl.reduce((a, S) => a + (S.Su || 0) * S.dz, 0) / Z : 0;
  const tipClay = R.tip.type === 'Sét';
  const Sub = tipClay ? R.tip.Su || 0 : 0;
  const useBlock = tipClay && n > 1;
  const phig = inp.phig ?? 0.6;
  const blockNc =
    X > 0 && Y > 0
      ? Z / X <= 2.5
        ? 5 * (1 + X / (5 * Y)) * (1 + Z / (5 * X))
        : 7.5 * (1 + X / (5 * Y))
      : 0;
  const Qg = (2 * X + 2 * Y) * Z * Sbar + X * Y * blockNc * Sub;

  const Lc = inp.LC || [];
  const Ld = inp.LD || [];
  const Pc = Lc.length ? Math.max(...Lc.map((a) => a[2])) : null;
  const Pd = Ld.length ? Math.max(...Ld.map((a) => a[2])) : null;
  const sC = (n * R.QRcd) / k;
  const sD = (n * R.QRdb) / k;
  const bC = useBlock ? (phig * Qg) / k : null;
  const bD = useBlock ? Qg / k : null;
  const QRgCD = useBlock ? Math.min(sC, bC!) : sC;
  const QRgDB = useBlock ? Math.min(sD, bD!) : sD;
  const nPW = n * PW;
  const NC2 = Pc != null ? Pc + nPW : null;
  const ND2 = Pd != null ? Pd + nPW : null;
  const blockOk = (NC2 == null || QRgCD >= NC2) && (ND2 == null || QRgDB >= ND2);
  if (n > 1) ok = ok && blockOk;

  // Cap displacements
  const U = inp.U1 || [];
  const lh = inp.dhLim ?? 25;
  const lz = inp.dzLim ?? 50;
  let maxDxMm = 0;
  let maxDyMm = 0;
  let maxDhMm = 0;
  let maxDzMm = 0;
  let dispOk = true;
  if (U.length) {
    maxDxMm = Math.max(...U.map((u) => Math.abs(u[0]))) * 1000;
    maxDyMm = Math.max(...U.map((u) => Math.abs(u[1]))) * 1000;
    maxDhMm = Math.max(...U.map((u) => Math.hypot(u[0], u[1]))) * 1000;
    maxDzMm = Math.max(...U.map((u) => Math.abs(u[2]))) * 1000;
    dispOk = maxDxMm <= lh && maxDyMm <= lh && maxDhMm <= lh && maxDzMm <= lz;
    ok = ok && dispOk;
  }

  // Eq 52 raft settlement
  let settleMm: number | undefined;
  let settleOk = true;
  if (n >= 1 && R.layers.length && R.slices.length) {
    const tipL =
      R.layers.find((l) => l.bot < R.EL3 + 1e-9 && (l.top == null || l.top >= R.EL3 - 1e-9)) ||
      R.layers[R.layers.length - 1];
    const zTopB = Math.min(tipL.top != null ? tipL.top : R.top, R.top);
    const Db = Math.max(0, zTopB - R.EL3);
    const zEF = zTopB - (2 * Db) / 3;
    const z2 = zEF - X;
    const gran = (t: SoilStratumType) => t === 'Cát' || t === 'Cuội';
    const cover = R.layers.filter((l) => (l.top != null ? l.top : 1e9) > z2 && l.bot < zEF);
    const ER = inp.ER ?? 60;
    const sl = R.slices;
    const svT = sl.length ? sl[sl.length - 1].sv : 0;
    const rowsSD = C.filter((r) => /SD|Sử dụng/.test(String(r.th || '')));
    const byC: Record<string, number> = {};
    rowsSD.forEach((r) => {
      const thKey = String(r.th);
      byC[thKey] = (byC[thKey] || 0) + r.N;
    });
    const Psd = Math.max(0, ...Object.values(byC)) * k;

    if (tipL.type !== 'Đá' && tipL.type !== 'IGM' && !cover.some((l) => !gran(l.type))) {
      let sN = 0;
      let sZ = 0;
      const dz = 0.1;
      for (let z = zEF - dz / 2; z > z2; z -= dz) {
        const s = sl.find((q) => z <= q.zt && z >= q.zb);
        let N1: number;
        if (s) {
          N1 = s.N160 != null ? s.N160 : s.N60;
        } else {
          const l = R.layers.find((q) => q.bot <= z && (q.top == null || q.top >= z));
          if (!l) continue;
          const sv = (svT + 9 * (R.EL3 - z)) / 1000;
          const CN = Math.min(2, Math.max(0, 0.77 * Math.log10(1.92 / Math.max(sv, 1e-4))));
          N1 = (CN * l.N * ER) / 60;
        }
        if (N1 > 0) {
          sN += N1 * dz;
          sZ += dz;
        }
      }
      const N160 = sZ > 0 ? sN / sZ : 0;
      const q = Psd / 1000 / (X * Y);
      const Iq = Math.max(0.5, 1 - (0.125 * ((2 * Db) / 3)) / X);
      settleMm = N160 > 0 ? (30 * q * Iq * Math.sqrt(X * 1000)) / N160 : Infinity;
      settleOk = settleMm <= lz + 1e-9;
      ok = ok && settleOk;
    }
  }

  // Negative skin friction (1.25)
  let negFriction: SctGroupCheckDetailed['negFriction'];
  let negFrictionDeducted = 0;
  const ddN = (inp.negSkinLayers || []).filter(Boolean);
  if (ddN.length) {
    const SS = R.slices.filter((S) => ddN.includes(String(S.name)));
    const DDn = SS.reduce((a, S) => a + S.Rn, 0);
    const BT = R.byType || {};
    const lossC = SS.reduce((a, S) => {
      const o = BT[S.type];
      return a + S.Rn * (o?.phiS || 0) * (o?.eta || 1);
    }, 0);
    const lossD = SS.reduce((a, S) => {
      const o = BT[S.type];
      return a + S.Rn * (o?.eta || 1);
    }, 0);
    const gDD = 1.25;
    const QRpCD = (R.QRcd - lossC) / k;
    const QRpDB = (R.QRdb - lossD) / k;
    const nuCD = mC ? mC.N + PW + (gDD * DDn) / k : null;
    const nuDB = mB ? mB.N + PW + (gDD * DDn) / k : null;
    const nfOk = (nuCD == null || QRpCD >= nuCD) && (nuDB == null || QRpDB >= nuDB);
    ok = ok && nfOk;
    negFrictionDeducted = DDn / k;
    negFriction = { DDn: DDn / k, QRpCD, QRpDB, nuCD, nuDB, ok: nfOk };
  }

  // Group uplift
  let upliftOk = singleUpliftOk;
  let groupUplift: SctGroupCheckDetailed['groupUplift'];
  if (n > 1) {
    const Xu = Math.max(...xs) - Math.min(...xs) + D;
    const Yu = Math.max(...ys) - Math.min(...ys) + D;
    const minP = [...Lc, ...Ld].reduce((a, r) => Math.min(a, r[2]), Infinity);
    if (minP < 0) {
      let Wg = 0;
      R.slices.forEach((S) => {
        const el = R.ELcap - (S.zt + S.zb) / 2;
        const g = (S.l && S.l.g) || 18;
        Wg += (g - (el < wl ? 9.81 : 0)) * S.Lt;
      });
      Wg *= Xu * Yu;
      const Zup = cl.reduce((a, S) => a + S.Lt, 0);
      const Sb = Zup > 0 ? cl.reduce((a, S) => a + (S.Su || 0) * S.Lt, 0) / Zup : 0;
      const Qug = (2 * Xu + 2 * Yu) * Zup * Sb + Wg;
      const phU = 0.45;
      const okU = (phU * Qug) / k >= -minP;
      ok = ok && okU;
      upliftOk = upliftOk && okU;
      groupUplift = {
        Pug: -minP,
        Wg: Wg / k,
        Qug: Qug / k,
        phiQug: (phU * Qug) / k,
        ok: okU,
      };
    }
  }

  // Weak clay punching (2V:1H)
  let punchOk = true;
  const weakClay: NonNullable<SctGroupCheckDetailed['weakClay']> = [];
  if (n >= 1 && R.layers.length) {
    const below = R.layers.filter((l) => l.top != null && l.top < R.EL3 - 1e-6 && l.type === 'Sét');
    const Pk = (n > 1 ? (Pc ?? 0) + n * PW : mC ? mC.N + PW : 0) * k;
    below.forEach((l) => {
      const z = R.EL3 - (l.top ?? 0);
      const N60 = ((l.N || 0) * (inp.ER ?? 60)) / 60;
      const Su = Math.min((inp.kSu ?? 5) * N60, 250);
      const q = Pk / ((X + z) * (Y + z));
      const sc = 1 + X / (5 * Y);
      const qn = 5.14 * sc * Su;
      const qr = 0.5 * qn;
      const o = qr >= q;
      punchOk = punchOk && o;
      weakClay.push({ name: l.name, z, q, qr, ok: o });
    });
    ok = ok && punchOk;
  }

  return {
    compOk: singleCompOk && (n <= 1 || blockOk),
    upliftOk,
    blockOk: n <= 1 || blockOk,
    settleMm,
    settleOk,
    punchOk,
    negFrictionDeducted,
    okAll: ok,
    singleCompOk,
    singleUpliftOk,
    blockNc,
    Qg,
    QRgCD,
    QRgDB,
    dispOk,
    maxDxMm,
    maxDyMm,
    maxDhMm,
    maxDzMm,
    negFriction,
    groupUplift,
    weakClay,
  };
}

export interface SctStepRuntimeDeps {
  TRXY?: Array<[number, number]>;
  TRR?: { G?: { n?: number } };
  MCR?: unknown;
}

export function sctStep(deps?: SctStepRuntimeDeps): SctCalcOutput | { err: string } {
  const tbGeo = $('tbGeoIn');
  if (tbGeo && !tbGeo.rows?.length) geoRender();

  const D = num('D') / 1000;
  const lpRaw = v('s2_Lp', '').replace(',', '.').trim();
  const lpNum = lpRaw ? parseFloat(lpRaw) : NaN;
  const L = Number.isFinite(lpNum) && lpNum > 0 ? lpNum : num('mc_Lo') + num('mc_H');
  const fc = num('fc');
  const ELcap = num('s2_ELcap');
  const ELgs = num('s2_ELgs');
  const idp = getIDP();

  const rawXy =
    (idp === 'T_' || idp === 'U_') && deps?.TRXY ? deps.TRXY : nums(v('mc_xy', ''));
  const xy = rawXy.filter((a) => a.length >= 2);

  let s = 0;
  for (let i = 0; i < xy.length; i++) {
    for (let j = i + 1; j < xy.length; j++) {
      const d = Math.hypot(xy[i][0] - xy[j][0], xy[i][1] - xy[j][1]);
      if (d > 1e-6 && (!s || d < s)) s = d;
    }
  }

  set('o_s2D', fx(D * 1000, 0));
  set('o_s2P', fx(Math.PI * D, 4));
  set('o_s2A', fx((Math.PI * D * D) / 4, 4));
  set('o_s2L', fx(L, 3));
  set('o_s2EL3', fx(ELcap - L, 3));

  const sm = v('s2_smode', 'auto') === 'in';
  const sEl = $('s2_s');
  if (sEl) sEl.readOnly = !sm;
  if (sm) s = num('s2_s');
  else sv('s2_s', s ? fx(s, 3) : '0');

  set('o_s2r', s > 0 && D > 0 ? fx(s / D, 3) : '-');
  set('o_s2fc', fx(fc, 1));

  let oneRow = xy.length >= 2;
  if (oneRow) {
    const p0 = xy[0];
    let far = xy[1];
    xy.forEach((q) => {
      if (Math.hypot(q[0] - p0[0], q[1] - p0[1]) > Math.hypot(far[0] - p0[0], far[1] - p0[1])) {
        far = q;
      }
    });
    const ux = far[0] - p0[0];
    const uy = far[1] - p0[1];
    const Ln = Math.hypot(ux, uy) || 1;
    oneRow = xy.every((q) => Math.abs(((q[0] - p0[0]) * uy - (q[1] - p0[1]) * ux) / Ln) < 0.05);
  }

  const cap = v('s2_cap', '0') === '1';
  set('o_s2row', oneRow ? 'Một hàng cọc' : 'Nhiều hàng cọc');
  const E = sctEta(s, D, oneRow, cap);
  set('o_s2ec', fx(E.clay, 3));
  set('o_s2es', fx(E.sand, 3));

  const G = geoParse();
  set('s2_err', G.err.join(' ; '));

  const rf: SctCalcInput['rf'] = {
    Sét: ['rf_c1', 'rf_c2', 'rf_c3'].map((id) => num(id, 0.5)),
    Cát: ['rf_s1', 'rf_s2', 'rf_s3'].map((id) => num(id, 0.5)),
    IGM: ['rf_i1', 'rf_i2', 'rf_i3'].map((id) => num(id, 0.5)),
    IGM1: ['rf_g1', 'rf_g2', 'rf_g3'].map((id) => num(id, 0.5)),
    Đá: ['rf_r1', 'rf_r2', 'rf_r3'].map((id) => num(id, 0.5)),
  };

  const one1 =
    idp === 'T_' || idp === 'U_'
      ? Boolean(deps?.TRR?.G && deps.TRR.G.n === 1)
      : nums(v('mc_xy', '')).filter((a) => a.length >= 2).length === 1;
  if (one1) {
    Object.values(rf).forEach((arr) => {
      for (let i = 0; i < arr.length; i++) (arr as number[])[i] *= 0.8;
    });
  }

  const R = sctCalc({
    D,
    L,
    ELcap,
    ELgs,
    s,
    gcF: num('s2_gc'),
    spt: [],
    noSplit: true,
    oneRow,
    cap,
    rockSide: v('s2_rockS', 'AE'),
    rkMob: v('s2_rkMob', 'both'),
    svJ: num('s2_svJ'),
    tdJ: num('s2_tdJ'),
    WL: v('s2_WL', '').trim() === '' ? Infinity : num('s2_WL'),
    layers: G.layers,
    fc,
    gc: num('s2_gc'),
    gW: num('s2_gp', 1.05),
    mSand: +v('s2_m', '0.6') || 0.6,
    ER: num('s2_ER') || 60,
    corrN: v('s2_corr', '0') === '1',
    qsMax: num('s2_qsMax'),
    open: v('s2_open', '0') === '1',
    tipRock: v('s2_tipR', 'A'),
    GSI: num('s2_GSI'),
    mi: num('s2_mi'),
    Dd: num('s2_Dd'),
    kSu: num('s2_kSu'),
    etaU: num('s2_etaU', 1),
    rf,
  });

  set('o_s2Dd', fx(num('s2_Dd'), 1));
  if (!('err' in R) && one1) {
    R.warn.push(
      'Trụ một cọc khoan nhồi: các hệ số sức kháng TTGH cường độ đã giảm 20% (TCVN 11823-10, Điều 5.5.2.4).',
    );
  }

  ['tbSide', 'tbSideSum', 's2tip', 'tbQR', 'tbCmp', 'tbDsp'].forEach((id) => set(id, ''));
  set('o_s2Po', '');

  if ('err' in R && R.err) {
    contextState.SCTR = null;
    set('s2_err', [R.err, ...G.err].join(' ; '));
    return R;
  }

  const res = R as SctCalcOutput;
  contextState.SCTR = res;

  const W2 = res.warn.filter((w) => !/α$/.test(w));
  if (W2.length) set('s2_err', [...G.err, ...W2].join(' ; '));

  // Render borehole derived columns
  G.layers.forEach((l) => {
    const RL = res.layers.find((x) => x.row === l.row);
    set(`gt_t${l.row}`, fx(l.topLog, 3));
    set(`gt_h${l.row}`, fx((l.topLog ?? 0) - l.bot, 2));
    let av = '-';
    const N60 = (l.N * (num('s2_ER') || 60)) / 60;
    const op = l.open != null ? l.open : v('s2_open', '0') === '1';
    if (l.type === 'Sét') {
      const Su = Math.min(((num('s2_kSu') || 5) / 1000) * N60, 0.25);
      const r = Su / SCT_PA;
      av = fx(r <= 1.5 ? 0.55 : 0.55 - 0.1 * (r - 1.5), 3);
    } else if (l.type === 'Đá' || (l.type === 'IGM' && l.qu >= 23.9)) {
      av = v('s2_rockS', 'AE') === 'C' ? 'C = 1' : fx(alphaE(l.rqd, op), 3);
    } else if (l.type === 'IGM' && igmClass(N60, l.qu) > 1) {
      const Ss = res.slices.filter((S) => S.l.row === l.row && (S.alB ?? 0) > 0);
      av = Ss.length ? fx(Ss.reduce((t, S) => t + (S.alB || 0), 0) / Ss.length, 3) : '-';
    }
    set(`gt_a${l.row}`, av);
    set(
      `gt_g${l.row}`,
      !RL || RL.top == null
        ? '-'
        : RL.ge == null
          ? `${fx(l.g, 2)} / ${fx(l.g - 9.81, 2)}`
          : fx(RL.ge, 2),
    );
  });

  // Render Fig. B1 table
  {
    const qs = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5];
    let h3 = '<tr><th>σn/pa \\ qu (MPa)</th>' + qs.map((q) => `<th>${q}</th>`).join('') + '</tr>';
    for (let k = 0; k < 7; k++) {
      h3 += `<tr><td class="c">${k + 1}</td>${qs.map((q) => `<td>${fx(b1curve(k, q), 3)}</td>`).join('')}</tr>`;
    }
    set('tbB1', h3);
  }

  // Side friction table
  let t =
    "<tr><th>TT</th><th>Lớp</th><th>Từ (m)</th><th>Đến (m)</th><th>Lt (m)</th><th>σ'v</th><th>N60 / qu</th><th>φ' / Su / αE</th><th>β / α</th><th>qs</th><th>Rn</th></tr>";
  res.slices.forEach((S, i) => {
    let c8 = '';
    let c9 = '';
    let c10 = '';
    if (S.type === 'Sét') {
      c8 = fx(S.N60, 1);
      c9 = fx(S.Su, 1);
      c10 = fx(S.coef, 3);
    } else if (S.type === 'Cát' || S.type === 'Cuội') {
      c8 = fx(S.N60, 1);
      c9 = `${fx(S.phi, 2)}°`;
      c10 = fx(S.coef, 3);
    } else if (S.type === 'IGM') {
      c8 = S.igc === 1 ? fx(S.N60, 1) : fx(S.l.qu, 2);
      c9 = S.igc === 1 ? 'loại I' : `α=${fx(S.alB, 3)} (σn/pa=${fx(S.snr, 2)})`;
      c10 = S.igc === 1 ? '' : `φj=${fx(S.fj, 3)}`;
    } else {
      c8 = fx(S.l.qu, 1);
      c9 = fx(S.coef, 3);
    }
    t += `<tr><td class="c">${i + 1}</td><td class="c">${S.name} - ${S.type}</td><td>${fx(S.zt, 3)}</td><td>${fx(S.zb, 3)}</td><td>${fx(S.Lt, 3)}</td><td>${fx(S.sv, 1)}</td><td>${c8}</td><td>${c9}</td><td>${c10}</td><td>${fx(S.qsk, 1)}</td><td>${fx(S.Rn, 1)}</td></tr>`;
  });
  const sL = res.slices.reduce((a, S) => a + S.Lt, 0);
  const sR = res.slices.reduce((a, S) => a + S.Rn, 0);
  t += `<tr class="grp"><td colspan="4">Tổng cộng</td><td>${fx(sL, 3)}</td><td colspan="5"></td><td>${fx(sR, 1)}</td></tr>`;
  set('tbSide', t);

  t =
    '<tr><th>Loại đất</th><th>Lt (m)</th><th>Rn (kN)</th><th>η</th><th>φqs</th><th>Rs CĐ (kN)</th><th>Rs ĐB (kN)</th><th>φup</th><th>Nhổ CĐ (kN)</th><th>Nhổ ĐB (kN)</th></tr>';
  Object.values(res.byType).forEach((o) => {
    t += `<tr><td class="l">${o.type}</td><td>${fx(o.L, 3)}</td><td>${fx(o.Rn, 1)}</td><td>${fx(o.eta, 3)}</td><td>${fx(o.phiS, 2)}</td><td>${fx(o.Rcd, 1)}</td><td>${fx(o.Rdb, 1)}</td><td>${fx(o.phiU, 2)}</td><td>${fx(o.Rup, 1)}</td><td>${fx(o.RupDB, 1)}</td></tr>`;
  });
  t += `<tr class="grp"><td>Tổng cộng</td><td>${fx(sL, 3)}</td><td>${fx(sR, 1)}</td><td></td><td></td><td>${fx(res.RsCD, 1)}</td><td>${fx(res.RsDB, 1)}</td><td></td><td>${fx(res.QupCD, 1)}</td><td>${fx(res.QupDB, 1)}</td></tr>`;
  set('tbSideSum', t);

  // Tip summary HTML (chuyển nguyên văn từ bản gốc: đủ các dòng diễn giải và giá trị trung gian)
  const T = res.tip;
  set('s2tip', sctTipHtml(res));

  const k = 9.81;
  const r2 = (lab: string, a: number, b: number) =>
    `<tr><td class="l" colspan="4">${lab}</td><td>${fx(a, 1)}</td><td>${fx(a / k, 2)}</td><td>${fx(b, 1)}</td><td>${fx(b / k, 2)}</td></tr>`;
  const qrHtml =
    `<tr><th rowspan="2" colspan="4">Thành phần</th><th colspan="2">TTGH CƯỜNG ĐỘ</th><th colspan="2">TTGH ĐẶC BIỆT</th></tr><tr><th>kN</th><th>T</th><th>kN</th><th>T</th></tr>` +
    r2('Sức kháng thân cọc Rs', res.RsCD, res.RsDB) +
    r2('Sức kháng mũi cọc Rp', T.Rcd, T.Rdb) +
    r2('Sức chịu tải nén QR = Rs + Rp', res.QRcd, res.QRdb) +
    r2('Sức kháng nhổ QR,nhổ (*)', res.QupCD, res.QupDB) +
    r2('Trọng lượng cọc W = γc.As.L', res.W, res.W) +
    `<tr><td class="l" colspan="8">(*) TTGH Đặc biệt lấy φ = 0,8 (TCVN 11823-10:2017, Điều 5.5.3.3)</td></tr>`;
  set('tbQR', qrHtml);
  set('o_s2Po', fx(res.QRcd / k, 2));

  const hooks = getVisualHooks();
  hooks.renderDrilledShaft?.({ prefix: idp, shaftResult: res });
  hooks.renderMath?.();
  return res;
}

export function sctCheck(deps?: { MCR?: unknown; SCTR?: SctCalcOutput | null }): SctGroupCheckDetailed | null {
  ['tbCmp', 'tbDsp', 's2grp', 'tbGrp', 'dgGrp'].forEach((id) => set(id, ''));
  const idp = getIDP();
  contextState.sctOK[idp || 'M'] = false;
  set('o_s2all', '');

  const R = (deps?.SCTR !== undefined ? deps.SCTR : contextState.SCTR) as SctCalcOutput | null;
  const M = (deps?.MCR !== undefined ? deps.MCR : contextState.MCR) as {
    rows?: Record<string, Array<{ tc: number; th: number | string; N: number }>>;
    piles?: Array<{ x: number; y: number }>;
    LC?: number[][];
    LD?: number[][];
    U1?: number[][];
    grp?: { piles?: Array<{ x: number; y: number }>; LC?: number[][]; LD?: number[][] };
  } | null;
  if (!R || !M || !M.rows) return null;

  const P = (M.grp ? M.grp.piles : M.piles) || [];
  const C = M.rows['TTGH CƯỜNG ĐỘ VÀ SỬ DỤNG'] || [];
  const B = M.rows['TTGH ĐẶC BIỆT'] || [];
  const Lc = (M.grp ? M.grp.LC : M.LC) || [];
  const Ld = (M.grp ? M.grp.LD : M.LD) || [];
  const wlStr = v('s2_WL', '').trim();
  const WL = wlStr === '' ? Infinity : num('s2_WL', Infinity);

  const ddN = v('s2_ddL', '')
    .split(/[;,]/)
    .map((x) => x.trim())
    .filter(Boolean);

  const chk = checkDrilledShaftGroup({
    R,
    piles: P,
    rowsCD: C,
    rowsDB: B,
    LC: Lc,
    LD: Ld,
    U1: M.U1 || [],
    WL,
    phig: num('s2_phig', 0.6),
    dhLim: num('s2_dhL', 25),
    dzLim: num('s2_dzL', 50),
    ER: num('s2_ER', 60) || 60,
    kSu: num('s2_kSu', 5) || 5,
    negSkinLayers: ddN,
  });

  contextState.sctOK[idp || 'M'] = chk.okAll;
  set(
    'o_s2all',
    `<span class="${chk.okAll ? 'ok' : 'bad'}">${chk.okAll ? (idp === 'T_' || idp === 'U_' ? 'CỌC ĐƠN, NHÓM CỌC VÀ CHUYỂN VỊ ĐẦU CỌC (TTGH SỬ DỤNG) ĐẠT YÊU CẦU' : 'CỌC ĐƠN, NHÓM CỌC VÀ CHUYỂN VỊ ĐÁY BỆ ĐẠT YÊU CẦU') : 'KHÔNG ĐẠT - CẦN XEM XÉT LẠI'}</span>`,
  );

  const hooks = getVisualHooks();
  hooks.renderDrilledShaft?.({ prefix: idp, shaftResult: R, groupSvgData: chk });
  hooks.renderMath?.();
  return chk;
}

export function toDrilledShaftResult(
  R: SctCalcOutput,
  grp?: SctGroupCheckDetailed | null,
): DrilledShaftResult {
  return {
    D: R.D,
    P: R.P,
    A: R.A,
    EL3: R.EL3,
    top: R.top,
    ELcap: R.ELcap,
    L: R.L,
    s: R.s,
    eta: R.eta.clay,
    layers: R.layers.map((l) => ({
      name: l.name,
      type: l.type,
      topEl: l.top ?? R.top,
      botEl: l.bot,
      gamma: l.g,
      N60: l.N,
      qu: l.qu,
      RQD: l.rqd,
      open: l.open ?? undefined,
    })),
    slices: R.slices.map((s, idx) => ({
      i: idx + 1,
      zTop: s.zt,
      zBot: s.zb,
      len: s.Lt,
      type: s.type,
      sv: s.sv,
      qs: s.qsk,
      Rs: s.Rn,
      phi: R.byType[s.type]?.phiS ?? 0.5,
      Rsd: s.Rn * (R.byType[s.type]?.phiS ?? 0.5),
    })),
    byType: Object.fromEntries(Object.entries(R.byType).map(([k, val]) => [k, val.Rcd])),
    tip: {
      type: R.tip.type,
      qp: R.tip.qp,
      qpk: R.tip.qpk,
      Rn: R.tip.Rn,
      phi: R.tip.phi,
      eta: R.tip.eta,
      Rcd: R.tip.Rcd,
      Rdb: R.tip.Rdb,
      capped: R.tip.capped,
      txt: R.tip.txt,
    },
    RsCD: R.RsCD,
    RsDB: R.RsDB,
    QupCD: R.QupCD,
    QupDB: R.QupDB,
    QRcd: R.QRcd,
    QRdb: R.QRdb,
    W: R.W,
    PW: R.PW,
    warn: R.warn,
    groupCheck: grp ?? undefined,
  };
}
