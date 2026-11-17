import type {
  Sn37LayerKind,
  Sn37LowInput,
  Sn37NewInput,
  Sn37OverlayInput,
  Sn37SurveyLayer,
} from './types';

export function log10(x: number): number {
  return Math.log(x) / Math.LN10;
}

export function normSInv(p: number): number {
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2,
    -3.066479806614716e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1,
    -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734,
    4.374664141464968, 2.938163982698783,
  ];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const plow = 0.02425;
  const phigh = 1 - plow;
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p < plow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  if (p <= phigh) {
    const q = p - 0.5;
    const r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  }
  const q = Math.sqrt(-2 * Math.log(1 - p));
  return -(
    (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  );
}

export function zrFromR(Rpercent: number): number {
  return normSInv(1 - Rpercent / 100);
}

export function snEquationLHS(SN: number, ZR: number, S0: number, dPSI: number, MR_MPa: number): number {
  const t1 = ZR * S0 + 9.36 * log10(SN + 1) - 0.2;
  const denom = 0.4 + 1094 / Math.pow(SN + 1, 5.19);
  const mid = log10(dPSI / 2.7) / denom;
  return t1 + mid + 2.32 * log10(MR_MPa) - 3.06;
}

export function solveSN(W80: number, ZR: number, S0: number, dPSI: number, MR_MPa: number): number {
  const target = log10(W80);
  let lo = 0.01;
  let hi = 25;
  let flo = snEquationLHS(lo, ZR, S0, dPSI, MR_MPa) - target;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fmid = snEquationLHS(mid, ZR, S0, dPSI, MR_MPa) - target;
    if (Math.abs(fmid) < 1e-10) return mid;
    if (fmid > 0 === flo > 0) {
      lo = mid;
      flo = fmid;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
}

export function a1FromEacMPa(EacMPa: number): number {
  const ksi = EacMPa * 0.145038;
  let a = 0.4 * log10(ksi / 450) + 0.44;
  if (a > 0.44) a = 0.44;
  if (a < 0) a = 0;
  return a;
}

export function a2GranularFromCBR(CBR: number): number {
  return Math.max(0, -0.05646 + 0.1004 * log10(CBR));
}

export function a2GranularFromMrMPa(MrMPa: number): number {
  return Math.max(0, 0.2986 + 0.2336 * log10(MrMPa / 1000));
}

export function a2CementFromRnMPa(RnMPa: number): number {
  return Math.max(0, 0.0935 + 0.02284 * RnMPa);
}

export function a2CementFromEbsMPa(EbsMPa: number): number {
  const g = EbsMPa / 1000;
  return Math.max(0, -0.1329 + 0.08604 * g - 0.004132 * g * g);
}

export function a2AsphaltFromSkN(SkN: number): number {
  return Math.max(0, 0.1123 + 0.02573 * SkN);
}

export function a3GranularFromCBR(CBR: number): number {
  return Math.max(0, 0.007574 + 0.06792 * log10(CBR));
}

export function a3GranularFromMrMPa(MrMPa: number): number {
  return Math.max(0, 0.3051 + 0.1981 * log10(MrMPa / 1000));
}

export function mrFromCBR(CBR: number): number {
  return 13.22 * Math.pow(CBR, 0.685);
}

export function mrFromGI(GI: number): number {
  return 69.34 - 4.263 * GI + 0.0856 * GI * GI;
}

export interface Sn37KindMeta {
  label: string;
  valLabelHtml: string;
  unit: string;
  mat: 'concrete' | 'bound' | 'gran';
  calc: (v: number) => number;
  eqName: string;
}

export const G_KINDS: Record<Sn37LayerKind, Sn37KindMeta> = {
  mat_btn: {
    label: 'Tầng mặt – BTN chặt',
    valLabelHtml: 'E<sub>AC</sub> (ở nhiệt độ tính toán)',
    unit: 'MPa',
    mat: 'concrete',
    calc: (v) => a1FromEacMPa(v),
    eqName: '(16)',
  },
  mongtren_hat_E: {
    label: 'Móng trên – vật liệu hạt (theo E)',
    valLabelHtml: 'E (M<sub>R</sub>)',
    unit: 'MPa',
    mat: 'bound',
    calc: (v) => a2GranularFromMrMPa(v),
    eqName: 'PL.G.3',
  },
  mongtren_hat_CBR: {
    label: 'Móng trên – vật liệu hạt (theo CBR)',
    valLabelHtml: 'CBR',
    unit: '%',
    mat: 'bound',
    calc: (v) => a2GranularFromCBR(v),
    eqName: 'PL.G.3',
  },
  mongtren_xm_E: {
    label: 'Móng trên – gia cố xi măng (theo E)',
    valLabelHtml: 'E<sub>BS</sub>',
    unit: 'MPa',
    mat: 'bound',
    calc: (v) => a2CementFromEbsMPa(v),
    eqName: 'PL.G.4',
  },
  mongtren_xm_Rn: {
    label: 'Móng trên – gia cố xi măng (theo R7 nén)',
    valLabelHtml: 'R<sub>7ngày</sub>',
    unit: 'MPa',
    mat: 'bound',
    calc: (v) => a2CementFromRnMPa(v),
    eqName: 'PL.G.4',
  },
  mongtren_nhua_S: {
    label: 'Móng trên – gia cố/xử lý nhựa (ATB)',
    valLabelHtml: 'Độ ổn định Marshall S',
    unit: 'kN',
    mat: 'bound',
    calc: (v) => a2AsphaltFromSkN(v),
    eqName: 'PL.G.5',
  },
  mongduoi_hat_E: {
    label: 'Móng dưới – vật liệu hạt (theo E)',
    valLabelHtml: 'E (M<sub>R</sub>)',
    unit: 'MPa',
    mat: 'gran',
    calc: (v) => a3GranularFromMrMPa(v),
    eqName: 'PL.G.6',
  },
  mongduoi_hat_CBR: {
    label: 'Móng dưới – vật liệu hạt (theo CBR)',
    valLabelHtml: 'CBR',
    unit: '%',
    mat: 'gran',
    calc: (v) => a3GranularFromCBR(v),
    eqName: 'PL.G.6',
  },
  custom: {
    label: 'Tự nhập hệ số lớp a (vd. Phụ lục O)',
    valLabelHtml: 'a (hệ số lớp)',
    unit: '–',
    mat: 'bound',
    calc: (v) => v,
    eqName: '-',
  },
};

export interface Bang5Row {
  max: number;
  btn: string;
  hat: number | string;
  hatnhua: number | string;
}

export const G_BANG5: ReadonlyArray<Bang5Row> = [
  { max: 50000, btn: '2,5 (hoặc xử lý bề mặt)', hat: 10, hatnhua: '–' },
  { max: 150000, btn: '5', hat: 10, hatnhua: '–' },
  { max: 500000, btn: '7', hat: 10, hatnhua: '–' },
  { max: 2000000, btn: '8', hat: 15, hatnhua: '–' },
  { max: 5000000, btn: '9', hat: 15, hatnhua: '–' },
  { max: 7000000, btn: '10', hat: 15, hatnhua: '–' },
  { max: 10000000, btn: '12 (10)', hat: '–', hatnhua: 7 },
  { max: 15000000, btn: '15 (10)', hat: '–', hatnhua: 8 },
  { max: 20000000, btn: '18 (12)', hat: '–', hatnhua: 9 },
  { max: Infinity, btn: '20 (>12)', hat: '–', hatnhua: 10 },
];

export function bang5Row(esal: number): Bang5Row {
  return G_BANG5.find((r) => esal <= r.max) || G_BANG5[G_BANG5.length - 1];
}

export type SoilQuality = 'Rất tốt' | 'Tốt' | 'Trung bình' | 'Xấu' | 'Rất xấu';
export type TrafficLevel = 'Cao' | 'Trung bình' | 'Thấp';
export type TrafficLevelKey = 'Cao' | 'TB' | 'Thấp';

export function soilQuality37(MrMPa: number): SoilQuality {
  if (MrMPa <= 20) return 'Rất xấu';
  if (MrMPa <= 30) return 'Xấu';
  if (MrMPa <= 42) return 'Trung bình';
  if (MrMPa < 60) return 'Tốt';
  return 'Rất tốt';
}

export function trafficLevel37(loai: 'nhua' | 'cpd', esal: number): TrafficLevel {
  if (loai === 'nhua') {
    if (esal >= 700000) return 'Cao';
    if (esal >= 400000) return 'Trung bình';
    return 'Thấp';
  }
  if (esal >= 60000) return 'Cao';
  if (esal >= 30000) return 'Trung bình';
  return 'Thấp';
}

export const G_BANG15: Record<SoilQuality, Record<TrafficLevelKey, string>> = {
  'Rất tốt': { Cao: '2,3–2,5', TB: '2,1–2,3', Thấp: '1,5–2,0' },
  'Tốt': { Cao: '2,6–2,8', TB: '2,4–2,6', Thấp: '1,7–2,3' },
  'Trung bình': { Cao: '2,9–3,1', TB: '2,6–2,8', Thấp: '2,0–2,6' },
  'Xấu': { Cao: '3,2–3,4', TB: '3,0–3,2', Thấp: '2,2–2,8' },
  'Rất xấu': { Cao: '3,5–3,7', TB: '3,2–3,4', Thấp: '2,4–3,1' },
};

export const G_BANG16: Record<SoilQuality, Record<TrafficLevelKey, string>> = {
  'Rất tốt': { Cao: '2,6–2,7', TB: '2,3–2,5', Thấp: '1,6–2,1' },
  'Tốt': { Cao: '2,9–3,0', TB: '2,6–2,8', Thấp: '1,9–2,4' },
  'Trung bình': { Cao: '3,2–3,3', TB: '2,8–3,1', Thấp: '2,1–2,7' },
  'Xấu': { Cao: '3,5–3,6', TB: '3,1–3,4', Thấp: '2,4–3,0' },
  'Rất xấu': { Cao: '3,8–3,9', TB: '3,4–3,7', Thấp: '2,6–3,2' },
};

export interface LowVolumeStructRow {
  sn: string;
  ln: [string, number, number] | 'KD';
  dd: [number, number, number] | 'KD' | 'CT';
  bt: [number, number, number] | 'CT';
}

export const G_BANG17: Record<SoilQuality, Record<TrafficLevelKey, LowVolumeStructRow>> = {
  'Rất tốt': {
    Cao: { sn: '2,4', ln: ['2,5', 22, 30], dd: [6, 15, 23], bt: [7, 12, 20] },
    TB: { sn: '2,2', ln: ['2,5', 20, 28], dd: [6, 15, 18], bt: [5, 12, 22] },
    Thấp: { sn: '1,8', ln: ['2,5', 15, 22], dd: [5, 12, 15], bt: [5, 10, 14] },
  },
  'Tốt': {
    Cao: { sn: '2,7', ln: ['2,5', 25, 32], dd: [6, 18, 25], bt: [7, 15, 23] },
    TB: { sn: '2,5', ln: ['2,5', 25, 28], dd: [6, 18, 25], bt: [7, 15, 26] },
    Thấp: { sn: '2,0', ln: ['2,5', 18, 25], dd: [5, 12, 20], bt: [5, 10, 20] },
  },
  'Trung bình': {
    Cao: { sn: '3,0', ln: 'KD', dd: [6, 22, 30], bt: [7, 20, 24] },
    TB: { sn: '2,7', ln: ['2,5', 25, 32], dd: [6, 18, 25], bt: [7, 15, 23] },
    Thấp: { sn: '2,4', ln: ['2,5', 22, 30], dd: [5, 15, 26], bt: [5, 15, 23] },
  },
  'Xấu': {
    Cao: { sn: '3,3', ln: 'KD', dd: 'CT', bt: 'CT' },
    TB: { sn: '3,1', ln: 'KD', dd: [6, 22, 32], bt: 'CT' },
    Thấp: { sn: '2,6', ln: ['2,5', 25, 31], dd: [5, 20, 24], bt: 'CT' },
  },
  'Rất xấu': {
    Cao: { sn: '3,6', ln: 'KD', dd: 'CT', bt: 'CT' },
    TB: { sn: '3,3', ln: 'KD', dd: 'CT', bt: 'CT' },
    Thấp: { sn: '2,8', ln: ['2,5', 28, 32], dd: [5, 20, 30], bt: 'CT' },
  },
};

export const G_BANG18: Record<SoilQuality, Record<TrafficLevelKey, LowVolumeStructRow>> = {
  'Rất tốt': {
    Cao: { sn: '2,4', ln: ['2,5', 25, 31], dd: [6, 18, 24], bt: [7, 15, 20] },
    TB: { sn: '2,2', ln: ['2,5', 22, 30], dd: [6, 15, 23], bt: [7, 12, 20] },
    Thấp: { sn: '1,9', ln: ['2,5', 16, 26], dd: [5, 12, 12], bt: [5, 10, 14] },
  },
  'Tốt': {
    Cao: { sn: '2,9', ln: ['2,5', 28, 35], dd: [6, 20, 29], bt: [7, 18, 24] },
    TB: { sn: '2,7', ln: ['2,5', 25, 32], dd: [6, 18, 25], bt: [7, 15, 23] },
    Thấp: { sn: '2,2', ln: ['2,5', 20, 28], dd: [5, 15, 21], bt: [5, 12, 22] },
  },
  'Trung bình': {
    Cao: { sn: '3,2', ln: 'KD', dd: [6, 22, 34], bt: [7, 20, 29] },
    TB: { sn: '3,0', ln: 'KD', dd: [6, 22, 30], bt: [7, 20, 24] },
    Thấp: { sn: '2,6', ln: ['2,5', 25, 32], dd: [5, 20, 24], bt: [5, 18, 24] },
  },
  'Xấu': {
    Cao: { sn: '3,5', ln: 'KD', dd: 'CT', bt: 'CT' },
    TB: { sn: '3,3', ln: 'KD', dd: 'CT', bt: 'CT' },
    Thấp: { sn: '2,8', ln: ['2,5', 28, 32], dd: [5, 20, 30], bt: 'CT' },
  },
  'Rất xấu': {
    Cao: { sn: '3,8', ln: 'KD', dd: 'CT', bt: 'CT' },
    TB: { sn: '3,6', ln: 'KD', dd: 'CT', bt: 'CT' },
    Thấp: { sn: '2,9', ln: ['2,5', 28, 35], dd: [5, 20, 32], bt: 'CT' },
  },
};

export const G_BANG19: Record<SoilQuality, Record<TrafficLevelKey, number | '**'>> = {
  'Rất tốt': { Cao: 20, TB: 15, Thấp: 10 },
  'Tốt': { Cao: 28, TB: 20, Thấp: 10 },
  'Trung bình': { Cao: 33, TB: 28, Thấp: 15 },
  'Xấu': { Cao: '**', TB: '**', Thấp: 23 },
  'Rất xấu': { Cao: '**', TB: '**', Thấp: 28 },
};

export const G_HINH15: ReadonlyArray<readonly [number, number]> = [
  [0, 1.0],
  [5, 0.94],
  [10, 0.895],
  [20, 0.845],
  [30, 0.805],
  [40, 0.775],
  [50, 0.75],
  [60, 0.72],
  [70, 0.685],
  [80, 0.645],
  [90, 0.59],
  [100, 0.5],
];

export function cfFromRL(RL: number): number {
  const clamped = Math.max(0, Math.min(100, RL));
  for (let i = 0; i < G_HINH15.length - 1; i++) {
    const [x0, y0] = G_HINH15[i];
    const [x1, y1] = G_HINH15[i + 1];
    if (clamped >= x0 && clamped <= x1) {
      return y0 + ((y1 - y0) * (clamped - x0)) / (x1 - x0);
    }
  }
  return 0.5;
}

export const CAP_DUONG_37_OPTIONS: ReadonlyArray<{ value: Sn37NewInput['capduong']; label: string }> = [
  { value: 'caotoc', label: 'Đường cao tốc / tốc độ >80 km/h' },
  { value: 'toc80', label: 'Đường tốc độ = 80 km/h' },
  { value: 'toc60', label: 'Đường tốc độ ≤ 60 km/h' },
  { value: 'custom', label: 'Tự nhập p₀, p₁' },
];

export const CAP_DUONG_37_PRESETS: Record<string, { p0: number; pt: number }> = {
  caotoc: { p0: 4.2, pt: 2.5 },
  toc80: { p0: 4.2, pt: 2.2 },
  toc60: { p0: 4.0, pt: 2.0 },
};

export function computeMR37(mode: Sn37NewInput['mrmode'], val: number): number {
  if (mode === 'direct') return val;
  if (mode === 'cbr') return mrFromCBR(val);
  return mrFromGI(val);
}

export interface Sn37NewComputedRow {
  name: string;
  kind: Sn37LayerKind;
  val: number;
  D: number;
  a: number;
  isLast: boolean;
}

export interface Sn37NewResult {
  t: Sn37NewInput;
  MR: number;
  dPSI: number;
  ZR: number;
  SN: number;
  rows: Sn37NewComputedRow[];
  knownSum: number;
  lastD: number;
  totalBTN: number;
  b5: Bang5Row;
  checkSum: number;
}

export function computeSN37New(t: Sn37NewInput): Sn37NewResult {
  const MR = computeMR37(t.mrmode, t.mrval);
  const dPSI = t.p0 - t.pt;
  const ZR = zrFromR(t.R);
  const SN = solveSN(t.w80, ZR, t.S0, dPSI, MR);
  const rows: Sn37NewComputedRow[] = t.layers.map((l, i) => ({
    name: l.name,
    kind: l.kind,
    val: l.val,
    D: l.D,
    a: G_KINDS[l.kind].calc(l.val),
    isLast: i === t.layers.length - 1,
  }));
  const knownSum = rows.filter((r) => !r.isLast).reduce((s, r) => s + r.a * r.D, 0);
  const lastA = rows[rows.length - 1].a;
  const lastD = lastA > 0 ? (2.54 * SN - knownSum) / lastA : NaN;
  rows[rows.length - 1].D = lastD;
  const totalBTN = rows.filter((r) => r.kind === 'mat_btn').reduce((s, r) => s + (r.D || 0), 0);
  const b5 = bang5Row(t.w80);
  const checkSum = rows.reduce((s, r) => s + r.a * r.D, 0);
  return { t, MR, dPSI, ZR, SN, rows, knownSum, lastD, totalBTN, b5, checkSum };
}

export type Sn37OverlayDetail =
  | {
      method: 'fwd';
      P: number;
      a: number;
      D: number;
      r: number;
      dr: number;
      d0: number;
      C: number;
      p: number;
      MRfwd: number;
      MRtk: number;
      Ep: number;
      SNeff: number;
    }
  | {
      method: 'survey';
      layers: Sn37SurveyLayer[];
      sum: number;
      SNeff: number;
    }
  | {
      method: 'rl';
      SN0: number;
      Np: number;
      N15: number;
      RL: number;
      CF: number;
      SNeff: number;
    };

export interface Sn37OverlayResult {
  Nf: number;
  R: number;
  S0: number;
  p1: number;
  p2: number;
  dPSI: number;
  ZR: number;
  MR: number;
  SNf: number;
  SNeff: number;
  SNol: number;
  Eac: number;
  aol: number;
  Dol: number;
  detail: Sn37OverlayDetail;
}

export function computeSN37Overlay(inp: Sn37OverlayInput): Sn37OverlayResult {
  const { Nf, R, S0, p1, p2, MR, method } = inp;
  const dPSI = p1 - p2;
  const ZR = zrFromR(R);
  const SNf = solveSN(Nf, ZR, S0, dPSI, MR);
  let SNeff = 0;
  let detail: Sn37OverlayDetail;

  if (method === 'fwd') {
    const P = inp.fwdP;
    const a = inp.fwda;
    const D = inp.fwdD;
    const r = inp.fwdr;
    const dr = inp.fwddr;
    const d0 = inp.fwdd0;
    const C = inp.fwdC;
    const p = (10 * P) / (Math.PI * a * a);
    const MRfwd = (2.4 * P) / (dr * r);
    const MRtk = C * MRfwd;
    const f = (Ep: number) => {
      const ratio = D / a;
      const term1 = 1 / (MRfwd * Math.sqrt(1 + Math.pow(ratio * Math.cbrt(Ep / MRfwd), 2)));
      const term2 = (1 - 1 / Math.sqrt(1 + ratio * ratio)) / Ep;
      return 1.5 * p * a * (term1 + term2) - d0;
    };
    let lo = 0.5;
    let hi = 200000;
    let flo = f(lo);
    for (let i = 0; i < 300; i++) {
      const mid = (lo + hi) / 2;
      const fmid = f(mid);
      if (Math.abs(fmid) < 1e-10) {
        lo = hi = mid;
        break;
      }
      if (fmid > 0 === flo > 0) {
        lo = mid;
        flo = fmid;
      } else {
        hi = mid;
      }
    }
    const Ep = (lo + hi) / 2;
    SNeff = 0.0093 * D * Math.pow(Ep, 1 / 3);
    detail = { method: 'fwd', P, a, D, r, dr, d0, C, p, MRfwd, MRtk, Ep, SNeff };
  } else if (method === 'survey') {
    const sum = inp.survey.reduce((s, l) => s + l.a * l.D, 0);
    SNeff = sum / 2.54;
    detail = { method: 'survey', layers: inp.survey, sum, SNeff };
  } else {
    const SN0 = inp.rlSN0;
    const Np = inp.rlNp;
    const N15 = inp.rlN15;
    const RL = 100 * (1 - Np / N15);
    const CF = cfFromRL(RL);
    SNeff = CF * SN0;
    detail = { method: 'rl', SN0, Np, N15, RL, CF, SNeff };
  }

  const SNol = Math.max(0, SNf - SNeff);
  const Eac = inp.olEac;
  const aol = a1FromEacMPa(Eac);
  const Dol = aol > 0 ? (2.54 * SNol) / aol : NaN;
  return { Nf, R, S0, p1, p2, dPSI, ZR, MR, SNf, SNeff, SNol, Eac, aol, Dol, detail };
}

export interface Sn37LowResult {
  loai: 'nhua' | 'cpd';
  esal: number;
  mrmode: 'direct' | 'cbr';
  mrval: number;
  MR: number;
  level: TrafficLevel;
  quality: SoilQuality;
  Rrel: '50' | '75';
  levelKey: TrafficLevelKey;
  snr?: string;
  row?: LowVolumeStructRow;
  tableNo?: number;
  tableNo2?: number;
  th?: number | '**';
}

export function computeSN37Low(inp: Sn37LowInput): Sn37LowResult {
  const { loai, esal, mrmode, mrval, Rrel } = inp;
  const MR = mrmode === 'direct' ? mrval : mrFromCBR(mrval);
  const level = trafficLevel37(loai, esal);
  const quality = soilQuality37(MR);
  const levelKey: TrafficLevelKey = level === 'Trung bình' ? 'TB' : level;
  const result: Sn37LowResult = { loai, esal, mrmode, mrval, MR, level, quality, Rrel, levelKey };
  if (loai === 'nhua') {
    const table = Rrel === '50' ? G_BANG15 : G_BANG16;
    result.snr = table[quality][levelKey];
    const bt = Rrel === '50' ? G_BANG17 : G_BANG18;
    result.row = bt[quality][levelKey];
    result.tableNo = Rrel === '50' ? 15 : 16;
    result.tableNo2 = Rrel === '50' ? 17 : 18;
  } else {
    result.th = G_BANG19[quality][levelKey];
  }
  return result;
}
