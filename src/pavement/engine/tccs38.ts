import type {
  FlexFormState,
  FlexLayer,
  FlexMaterialType,
  FlexReliability,
  FlexRoadClass,
  FlexSurfaceGrade,
} from './types';

export interface FlexMaterialMeta {
  label: string;
  group: 'mat' | 'mong' | 'roi';
  k2: number;
  life: number | null;
  k1fn: (Ne: number) => number;
}

export const F_TYPES: Record<FlexMaterialType, FlexMaterialMeta> = {
  btn1: {
    label: 'BTN chặt loại I / BTN polime (nhóm tầng mặt)',
    group: 'mat',
    k2: 1.0,
    life: 15,
    k1fn: (Ne) => 11.11 / Math.pow(Ne, 0.22),
  },
  btn2: {
    label: 'BTN chặt loại II / rỗng / hh đá trộn nhựa (tầng mặt)',
    group: 'mat',
    k2: 0.8,
    life: 10,
    k1fn: (Ne) => 11.11 / Math.pow(Ne, 0.22),
  },
  gcda: {
    label: 'Đá/sỏi gia cố chất liên kết vô cơ (tầng móng)',
    group: 'mong',
    k2: 1.0,
    life: null,
    k1fn: (Ne) => 2.86 / Math.pow(Ne, 0.11),
  },
  gcdat: {
    label: 'Đất/cát gia cố chất liên kết vô cơ (tầng móng)',
    group: 'mong',
    k2: 1.0,
    life: null,
    k1fn: (Ne) => 2.22 / Math.pow(Ne, 0.11),
  },
  hatroi: {
    label: 'Vật liệu hạt rời / không gia cố',
    group: 'roi',
    k2: 0,
    life: null,
    k1fn: () => 0,
  },
};

export const CAP_DUONG_38_OPTIONS: ReadonlyArray<{ value: FlexRoadClass; label: string }> = [
  { value: 'caotoc1', label: 'Đường cao tốc / Cấp I' },
  { value: 'capII', label: 'Đường cấp II' },
  { value: 'capIII', label: 'Đường cấp III' },
  { value: 'capIV', label: 'Đường cấp IV' },
  { value: 'capV', label: 'Đường cấp V' },
  { value: 'capVI', label: 'Đường cấp VI' },
  { value: 'dt_caotoc', label: 'Đô thị – cao tốc / trục chính' },
  { value: 'dt_chinhkv', label: 'Đô thị – đường chính khu vực' },
  { value: 'dt_pho', label: 'Đô thị – đường phố' },
  { value: 'dt_cn', label: 'Đô thị – CN & kho tàng' },
  { value: 'dt_ngo', label: 'Đô thị – xe đạp, ngõ' },
];

export const LOAI_MAT_38_OPTIONS: ReadonlyArray<{ value: FlexSurfaceGrade; label: string }> = [
  { value: 'A1', label: 'Cấp cao A1' },
  { value: 'A2', label: 'Cấp cao A2' },
  { value: 'B1', label: 'Cấp thấp B1' },
  { value: 'B2', label: 'Cấp thấp B2' },
];

export const RELIABILITY_38_OPTIONS: ReadonlyArray<{ value: FlexReliability; label: string }> = [
  { value: '0.98', label: '0,98' },
  { value: '0.95', label: '0,95' },
  { value: '0.90', label: '0,90' },
  { value: '0.85', label: '0,85' },
  { value: '0.80', label: '0,80' },
];

export interface OdemarkStep {
  name: string;
  E: number;
  t: number | null;
  h: number;
  k: number | null;
  Htb: number;
  Etb: number;
}

export interface StackReductionResult {
  Etb: number;
  H: number;
  maxE: number;
  n: number;
  steps: OdemarkStep[];
}

export interface EtbDCResult extends StackReductionResult {
  HD: number;
  beta: number;
  Etbc: number;
  capped: boolean;
}

export function reduceStackFx(layersBottomToTop: ReadonlyArray<{ E: number; h: number; name?: string }>): StackReductionResult {
  const a = layersBottomToTop.filter((l) => l.h > 0 && l.E > 0);
  if (!a.length) return { Etb: 0, H: 0, maxE: 0, n: 0, steps: [] };
  let E = a[0].E;
  let H = a[0].h;
  let maxE = a[0].E;
  const steps: OdemarkStep[] = [
    { name: a[0].name || '', E: a[0].E, t: null, h: a[0].h, k: null, Htb: H, Etb: E },
  ];
  for (let i = 1; i < a.length; i++) {
    const k = a[i].h / H;
    const t = a[i].E / E;
    E = E * Math.pow((1 + k * Math.pow(t, 1 / 3)) / (1 + k), 3);
    H += a[i].h;
    maxE = Math.max(maxE, a[i].E);
    steps.push({ name: a[i].name || '', E: a[i].E, t, h: a[i].h, k, Htb: H, Etb: E });
  }
  return { Etb: E, H, maxE, n: a.length, steps };
}

export const BANG11: ReadonlyArray<readonly [number, number]> = [
  [0.5, 1.033],
  [0.75, 1.069],
  [1.0, 1.107],
  [1.25, 1.136],
  [1.5, 1.178],
  [1.75, 1.198],
  [2.0, 1.21],
];

export function betaOfFx(HD: number): number {
  if (HD <= 0.5) return BANG11[0][1];
  if (HD >= 2.0) return 1.114 * Math.pow(HD, 0.12);
  for (let i = 0; i < BANG11.length - 1; i++) {
    if (HD >= BANG11[i][0] && HD <= BANG11[i + 1][0]) {
      const f = (HD - BANG11[i][0]) / (BANG11[i + 1][0] - BANG11[i][0]);
      return BANG11[i][1] + f * (BANG11[i + 1][1] - BANG11[i][1]);
    }
  }
  return 1.114 * Math.pow(HD, 0.12);
}

export function EtbDCfx(layersBottomToTop: ReadonlyArray<{ E: number; h: number; name?: string }>, D: number): EtbDCResult {
  const { Etb, H, maxE, n, steps } = reduceStackFx(layersBottomToTop);
  if (H <= 0) return { Etb: 0, H: 0, HD: 0, beta: 1, Etbc: 0, maxE: 0, capped: false, n: 0, steps: [] };
  const HD = H / D;
  const beta = n > 1 ? betaOfFx(HD) : 1;
  let Etbc = beta * Etb;
  const capped = maxE > 0 && Etbc > maxE;
  if (capped) Etbc = maxE;
  return { Etb, H, HD, beta, Etbc, maxE, capped, n, steps };
}

export function EchAnalyticFx(E0: number, E1: number, H: number, D: number): number {
  if (E1 <= 0) return E0;
  const HD = H / D;
  const ratio = E0 / E1;
  const denom = (1 + ratio) / Math.sqrt(1 + 4 * HD * HD * Math.pow(ratio, -0.67)) + ratio;
  return (1.05 * E0) / denom;
}

export function skuMatFx(h1: number, E1: number, Echm: number, D: number): number {
  if (Echm <= 0 || h1 <= 0) return 0;
  const htd = 1.1 * h1 * Math.pow(E1 / Echm, 1 / 3);
  const t1 = 1 - (2 / Math.PI) * Math.atan(htd / D);
  const t2 = Math.pow(Math.atan(D / htd), 2);
  return (4 / Math.PI) * (h1 / D) * (E1 / Echm) * t1 * t2;
}

export function skuMongFx(E1: number, E2: number, E3: number, h: number, D: number): number {
  if (E2 <= 0 || h <= 0) return 0;
  const num = 1.29 * Math.pow(E1 / E2, -0.185) * (D / h) - 0.203 * (E2 / E1) - 0.283;
  const den = 9.3 * (E3 / E2) + 0.83;
  return den > 0 ? num / den : 0;
}

export const BANG9: Record<100 | 120, Record<'A1' | 'A2' | 'B1', ReadonlyArray<readonly [number, number]>>> = {
  100: {
    A1: [
      [50, 133],
      [100, 147],
      [200, 160],
      [500, 178],
      [1000, 192],
      [2000, 207],
      [5000, 224],
      [7000, 235],
    ],
    A2: [
      [20, 91],
      [50, 110],
      [100, 122],
      [200, 135],
      [500, 153],
    ],
    B1: [
      [10, 64],
      [20, 82],
      [50, 94],
    ],
  },
  120: {
    A1: [
      [20, 127],
      [50, 146],
      [100, 161],
      [200, 173],
      [500, 190],
      [1000, 204],
      [2000, 218],
      [5000, 235],
      [7000, 253],
    ],
    A2: [
      [10, 90],
      [20, 103],
      [50, 120],
      [100, 133],
      [200, 146],
      [500, 163],
    ],
    B1: [
      [10, 79],
      [20, 98],
      [50, 111],
    ],
  },
};

export function bang9Interp(Ntt: number, Ptt: 100 | 120, loaiMat: FlexSurfaceGrade): number {
  const key = loaiMat === 'B2' ? 'B1' : loaiMat;
  const T = (BANG9[Ptt] && BANG9[Ptt][key]) || BANG9[100].A1;
  if (Ntt <= T[0][0]) return T[0][1];
  if (Ntt >= T[T.length - 1][0]) return T[T.length - 1][1];
  for (let i = 0; i < T.length - 1; i++) {
    if (Ntt >= T[i][0] && Ntt <= T[i + 1][0]) {
      const f = (Ntt - T[i][0]) / (T[i + 1][0] - T[i][0]);
      return T[i][1] + f * (T[i + 1][1] - T[i][1]);
    }
  }
  return T[T.length - 1][1];
}

export const BANG10: Record<FlexRoadClass, Record<'A1' | 'A2' | 'B1', number | null>> = {
  caotoc1: { A1: 180, A2: null, B1: null },
  capII: { A1: 160, A2: null, B1: null },
  capIII: { A1: 140, A2: 120, B1: null },
  capIV: { A1: 130, A2: 100, B1: 75 },
  capV: { A1: null, A2: 80, B1: 0 },
  capVI: { A1: null, A2: null, B1: 0 },
  dt_caotoc: { A1: 190, A2: null, B1: null },
  dt_chinhkv: { A1: 155, A2: 130, B1: null },
  dt_pho: { A1: 120, A2: 95, B1: 70 },
  dt_cn: { A1: 155, A2: 130, B1: 100 },
  dt_ngo: { A1: 100, A2: 75, B1: 50 },
};

export function bang10Min(capDuong: FlexRoadClass, loaiMat: FlexSurfaceGrade): number {
  const key = loaiMat === 'B2' ? 'B1' : loaiMat;
  const row = BANG10[capDuong];
  const v = row ? row[key] : undefined;
  return v === undefined || v === null ? 0 : v;
}

export const BANG8: Record<FlexReliability, { dv: number; kutr: number }> = {
  '0.98': { dv: 1.29, kutr: 1.1 },
  '0.95': { dv: 1.17, kutr: 1.0 },
  '0.90': { dv: 1.1, kutr: 0.94 },
  '0.85': { dv: 1.06, kutr: 0.9 },
  '0.80': { dv: 1.02, kutr: 0.87 },
};

export function bang12K2(Ntt: number): number {
  if (Ntt < 100) return 1.0;
  if (Ntt < 1000) return 0.8;
  if (Ntt < 5000) return 0.65;
  return 0.6;
}

export const TAV_SLOPE100: ReadonlyArray<{ phi: number; s: number }> = [
  { phi: 5, s: 0.0034 },
  { phi: 10, s: 0.002 },
  { phi: 13, s: 0.001 },
  { phi: 20, s: -0.001 },
  { phi: 27, s: -0.003 },
  { phi: 30, s: -0.004 },
  { phi: 40, s: -0.0081 },
];

export function tavSlopeFx(phiDeg: number): number {
  const T = TAV_SLOPE100;
  if (phiDeg <= T[0].phi) return T[0].s;
  if (phiDeg >= T[T.length - 1].phi) return T[T.length - 1].s;
  for (let i = 0; i < T.length - 1; i++) {
    if (phiDeg >= T[i].phi && phiDeg <= T[i + 1].phi) {
      const f = (phiDeg - T[i].phi) / (T[i + 1].phi - T[i].phi);
      return T[i].s + f * (T[i + 1].s - T[i].s);
    }
  }
  return T[T.length - 1].s;
}

export function tavAutoFx(phiDeg: number, hCm: number): number {
  return (tavSlopeFx(phiDeg) / 100) * hCm;
}

export interface FlexTrafficResult {
  Ptt: 100 | 120;
  Ntk: number;
  fL: number;
  Ntt: number;
  q: number;
  t: number;
  loai: 'cuoi' | 'dau';
  NeAt: (tt: number) => number;
  Ne: number;
}

export function computeFlexTraffic(state: FlexFormState): FlexTrafficResult {
  const Ptt = state.Ptt;
  let Ntk = 0;
  for (const v of state.vehicles) {
    const C2s = v.banh === '4banh' ? 0.38 : 1.0;
    if (v.Pt >= 25) {
      Ntk += 1 * 6.4 * v.ni * Math.pow(v.Pt / Ptt, 4.4);
    }
    if (v.Ps >= 25) {
      if (v.ms > 1 && v.spacing > 3.0) {
        Ntk += v.ms * (1 * C2s * v.ni * Math.pow(v.Ps / Ptt, 4.4));
      } else {
        const C1 = 1 + 1.2 * (v.ms - 1);
        Ntk += C1 * C2s * v.ni * Math.pow(v.Ps / Ptt, 4.4);
      }
    }
  }
  const fL = state.fL || 0.55;
  const Ntt = Ntk * fL;
  const q = state.q / 100;
  const t = state.t;
  const loai = state.ntkloai;
  const NeAt = (tt: number): number => {
    if (q <= 0) return Ntt * 365 * tt;
    return loai === 'dau'
      ? Ntt * 365 * ((Math.pow(1 + q, tt) - 1) / q)
      : Ntt * 365 * ((Math.pow(1 + q, tt) - 1) / (q * Math.pow(1 + q, tt - 1)));
  };
  return { Ptt, Ntk, fL, Ntt, q, t, loai, NeAt, Ne: NeAt(t) };
}

export interface FlexResolvedInput {
  layers: FlexLayer[];
  D: number;
  p: number;
  E0v: number;
  E0t: number;
  C0: number;
  phi0: number;
  k3_0: number;
  loaiMat: FlexSurfaceGrade;
  capDuong: FlexRoadClass;
  dotincay: FlexReliability;
  traf: FlexTrafficResult;
  echManual?: number | null;
  shearManual: Record<string, number>;
}

export function resolveFlexInput(state: FlexFormState): FlexResolvedInput {
  const traf = computeFlexTraffic(state);
  const D = traf.Ptt >= 120 ? 36 : 33;
  return {
    layers: state.layers.filter((l) => l.h > 0),
    D,
    p: 0.6,
    E0v: state.E0v,
    E0t: state.E0t,
    C0: state.C0,
    phi0: state.phi0,
    k3_0: state.k3_0,
    loaiMat: state.loaimat,
    capDuong: state.capduong,
    dotincay: state.dotincay,
    traf,
    echManual: state.echManual ?? null,
    shearManual: state.shearManual,
  };
}

export interface FlexTC1Result {
  red: EtbDCResult;
  Ech: number;
  EchAuto: number;
  isEchManual: boolean;
  EycTab: number;
  EycMin: number;
  Eyc: number;
  Kdv: number;
  req: number;
  pass: boolean;
}

export function calcTC1(I: FlexResolvedInput): FlexTC1Result {
  const bottomUp = [...I.layers].reverse().map((l) => ({ E: l.Ev, h: l.h, name: l.name }));
  const red = EtbDCfx(bottomUp, I.D);
  const EchAuto = EchAnalyticFx(I.E0v, red.Etbc, red.H, I.D);
  const manual = I.echManual;
  const isEchManual = typeof manual === 'number' && Number.isFinite(manual) && manual > 0;
  const Ech = isEchManual ? manual : EchAuto;
  const EycTab = bang9Interp(I.traf.Ntt, I.traf.Ptt, I.loaiMat);
  const EycMin = bang10Min(I.capDuong, I.loaiMat);
  const Eyc = Math.max(EycTab, EycMin);
  const Kdv = BANG8[I.dotincay].dv;
  const req = Kdv * Eyc;
  return { red, Ech, EchAuto, isEchManual, EycTab, EycMin, Eyc, Kdv, req, pass: Ech >= req };
}

export interface FlexTC2Row {
  idx: number;
  name: string;
  group: 'mat' | 'mong';
  h1: number;
  E1: number;
  Echm: number;
  skuBar: number;
  kb: number;
  sku: number;
  Ne: number;
  k1: number;
  k2: number;
  Rtt: number;
  allow: number;
  pass: boolean;
}

export function calcTC2(I: FlexResolvedInput): FlexTC2Row[] {
  const layers = I.layers;
  const out: FlexTC2Row[] = [];
  if (I.loaiMat === 'B1' || I.loaiMat === 'B2') return out;
  layers.forEach((l, i) => {
    const meta = F_TYPES[l.type];
    if (meta.group === 'roi') return;
    const h1 = layers.slice(0, i + 1).reduce((s, x) => s + x.h, 0);
    const below = layers
      .slice(i + 1)
      .map((x) => ({ E: x.Ek, h: x.h }))
      .reverse();
    const redB = EtbDCfx(below, I.D);
    const Echm = redB.H > 0 ? EchAnalyticFx(I.E0v, redB.Etbc, redB.H, I.D) : I.E0v;
    let skuBar = 0;
    let E1 = 0;
    if (meta.group === 'mat') {
      let sh = 0;
      let se = 0;
      for (let j = 0; j <= i; j++) {
        sh += layers[j].h;
        se += layers[j].h * layers[j].Ek;
      }
      E1 = sh > 0 ? se / sh : 0;
      skuBar = skuMatFx(h1, E1, Echm, I.D);
    } else {
      let sh = 0;
      let se = 0;
      for (let j = 0; j < i; j++) {
        sh += layers[j].h;
        se += layers[j].h * layers[j].Ek;
      }
      E1 = sh > 0 ? se / sh : 0;
      skuBar = skuMongFx(E1, l.Ek, Echm, h1, I.D);
    }
    const kb = 0.85;
    const sku = skuBar * I.p * kb;
    const Ne = I.traf.NeAt(meta.life || I.traf.t);
    const k1 = meta.k1fn(Math.max(Ne, 1));
    const k2 = meta.k2;
    const Rtt = k1 * k2 * l.Rku;
    const Kku = BANG8[I.dotincay].kutr;
    const allow = Kku > 0 ? Rtt / Kku : 0;
    out.push({
      idx: i,
      name: l.name,
      group: meta.group,
      h1,
      E1,
      Echm,
      skuBar,
      kb,
      sku,
      Ne,
      k1,
      k2,
      Rtt,
      allow,
      pass: sku <= allow,
    });
  });
  return out;
}

export interface FlexTC3Row {
  key: string;
  label: string;
  H1: number;
  E1: number;
  E2: number;
  HD: number;
  ratio: number;
  phi: number;
  Taxp: number;
  Tav: number;
  Tax: number;
  Ctt: number;
  k1s: number;
  k2s: number;
  k3s: number;
  lhs: number;
  allow: number;
  pass: boolean;
}

export function calcTC3(I: FlexResolvedInput): FlexTC3Row[] {
  const layers = I.layers;
  const out: FlexTC3Row[] = [];
  if (I.loaiMat === 'B1' || I.loaiMat === 'B2') return out;
  const points: Array<{ idx: number; label: string; C: number; phi: number; k3: number }> = [];
  layers.forEach((l, i) => {
    if (l.type === 'hatroi' && l.shear) {
      points.push({ idx: i, label: 'Đỉnh lớp: ' + l.name, C: l.C, phi: l.phi, k3: 3.0 });
    }
  });
  points.push({ idx: layers.length, label: 'Nền đất', C: I.C0, phi: I.phi0, k3: I.k3_0 });
  for (const p of points) {
    const upper = layers
      .slice(0, p.idx)
      .map((x) => ({ E: x.Et, h: x.h }))
      .reverse();
    const ru = EtbDCfx(upper, I.D);
    let E2: number;
    const lowerLayers = layers.slice(p.idx);
    if (lowerLayers.length === 0) {
      E2 = I.E0t;
    } else {
      const rl = EtbDCfx(
        lowerLayers.map((x) => ({ E: x.Et, h: x.h })).reverse(),
        I.D,
      );
      E2 = rl.H > 0 ? EchAnalyticFx(I.E0t, rl.Etbc, rl.H, I.D) : I.E0t;
    }
    const key = 'shear_' + p.idx;
    const Taxp = I.shearManual[key] || 0;
    const Tax = Taxp * I.p;
    const Tav = tavAutoFx(p.phi, ru.H);
    const k1s = 0.6;
    const k2s = bang12K2(I.traf.Ntt);
    const k3s = p.k3;
    const Ctt = p.C * k1s * k2s * k3s;
    const Ktr = BANG8[I.dotincay].kutr;
    const lhs = Tax + Tav;
    const allow = Ktr > 0 ? Ctt / Ktr : 0;
    out.push({
      key,
      label: p.label,
      H1: ru.H,
      E1: ru.Etbc,
      E2,
      HD: I.D > 0 ? ru.H / I.D : 0,
      ratio: E2 > 0 ? ru.Etbc / E2 : 0,
      phi: p.phi,
      Taxp,
      Tav,
      Tax,
      Ctt,
      k1s,
      k2s,
      k3s,
      lhs,
      allow,
      pass: lhs <= allow,
    });
  }
  return out;
}

export const FLEX_FORMULAS: ReadonlyArray<readonly [string, string, string]> = [
  ['Quy đổi 2 lớp (Odemark)', "E'ₜᵦ = E₁[(1+k·∛t)/(1+k)]³ , k=h₂/h₁, t=E₂/E₁", '(5)'],
  ['Hệ số điều chỉnh β', 'β = 1,114·(H/D)^0,12 (H/D≤2: nội suy Bảng 11)', '(6)'],
  ['TC1 – Độ võng', 'E_ch ≥ K_cd^dv·E_yc', '(4)'],
  ['E_ch giải tích (2 lớp)', 'E_ch=1,05E₀ / {(1+E₀/E₁)/√[1+4(H/D)²(E₀/E₁)^-0,67] + E₀/E₁}', '(E.1)'],
  ['TC2 – Kéo uốn', 'σ_ku = σ̄_ku·p·k_b ≤ R_tt^ku/K_cd^ku , R_tt^ku=k₁k₂R_ku', '(9)(10)(11)'],
  ['σ̄_ku tầng mặt (Hình 7)', 'σ̄_ku=(4/π)(h₁/D)(E₁/E_ch.m)[1-(2/π)arctg(h_td/D)]·arctg²(D/h_td)', '(E.2)'],
  ['h_td', 'h_td = 1,1·h₁·∛(E₁/E_ch.m)', '(E.3)'],
  ['σ̄_ku tầng móng (Hình 8)', 'σ̄_ku = [1,29(E₁/E₂)^-0,185·(D/h)-0,203(E₂/E₁)-0,283] / [9,3(E₃/E₂)+0,83]', '(E.4)'],
  ['k₁ mỏi – BTN', 'k₁ = 11,11/Ne^0,22', '(12)'],
  ['k₁ mỏi – đá/sỏi GC vô cơ', 'k₁ = 2,86/Ne^0,11', '(13)'],
  ['k₁ mỏi – đất GC vô cơ', 'k₁ = 2,22/Ne^0,11', '(14)'],
  ['TC3 – Cắt trượt', 'T_ax+T_av ≤ C_tt/K_cd^tr , C_tt=C·k₁·k₂·k₃', '(7)(8)'],
  ['T_av tự động (số hoá Hình 6)', 'T_av = slope(φ)/100 · H₁ , slope nội suy tuyến tính theo φ từ toán đồ Hình 6', '(số hoá)'],
  ['Traffic – quy đổi trục', 'N=ΣC₁C₂nᵢ(Pᵢ/Ptt)^4,4 , C₁=1+1,2(m-1)', '(1)/(A.3.1)'],
  ['Số trục tích lũy', 'Ne=[(1+q)^t-1]/q·365·N₁ (hoặc dạng N_t)', '(A.2)/(A.3)'],
];
