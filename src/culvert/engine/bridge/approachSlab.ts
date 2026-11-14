/**
 * BangTinhCauCong Web App — Reinforced Concrete Bridge Approach Slab Solver (`QD`).
 *
 * Exact clean-room TypeScript port of `QD`, `QDR`, `qdN`, `qf`, `QD_HG`, `qdInputs`,
 * `qdOk`, and `qdStep` from `analysis-cau-cong/modules/07_approach_slab_and_culvert_soil.js`
 * (lines 1–582).
 *
 * Structural model: Simply supported 1 m strip of effective span `Ltt = k * L` supported on
 * abutment corbel at one end and embankment subgrade at the other (TCVN 11823:2017).
 * Units: kN, m, kPa; section checks in mm, MPa.
 */

import type { CulvertResult } from '../../types/project';
import {
  $,
  cls,
  getVisualHooks,
  qdN,
  qf,
  set,
  v,
  type VisualReportHooks,
} from '../context';

export { qdN, qf };

// ---------------------------------------------------------------------------
// 1. Domain Interfaces
// ---------------------------------------------------------------------------

export interface QdPatchEval {
  RA: number;
  RB: number;
  M: (x: number) => number;
  V: (x: number) => number;
}

export interface QdAxleDef {
  x: number;
  P: number;
}

export interface QdVehicleSpec {
  k: 'truck' | 'tandem';
  nm: string;
  axles: readonly QdAxleDef[];
}

export interface QdVehiclePatch {
  off: number;
  len: number;
  p: number;
  E?: number;
  Esp?: number;
  W?: number;
  Lw?: number;
  ov?: boolean;
}

export interface QdEnvelopeResult {
  M: number;
  xM?: number;
  sM?: number;
  V: number;
  sV?: number;
}

export interface QdVehicleResult extends QdVehicleSpec {
  patches: QdVehiclePatch[];
  env: QdEnvelopeResult;
}

export interface QdComboFactors {
  DC: number;
  DW: number;
  EV: number;
  LL: number;
}

export interface QdComboResult {
  k: 'STR' | 'SD';
  nm: string;
  f: QdComboFactors;
  wU: number;
  MU: number;
  VU: number;
  ML: number;
  VL: number;
  Mu: number;
  Vu: number;
}

export interface QdSectionFlexResult {
  b: number;
  h: number;
  fc: number;
  fy: number;
  Es: number;
  As: number;
  Asp: number;
  ds: number;
  dps: number;
  b1: number;
  c: number;
  a: number;
  Mn: number;
  et: number;
  phi: number;
  Mr: number;
  okM: boolean;
}

export interface QdMinSteelResult {
  fr: number;
  Sc: number;
  Mcr: number;
  M133: number;
  ok: boolean;
}

export interface QdCrackResult {
  Ec: number;
  n: number;
  rho: number;
  k: number;
  j: number;
  fss: number;
  dc: number;
  bs: number;
  smax: number;
  s: number;
  ok: boolean;
}

export interface QdShearResult {
  dv: number;
  Vu: number;
  Mu: number;
  es: number;
  sx: number;
  sxe: number;
  beta: number;
  theta: number;
  Vc: number;
  Vs: number;
  Vn: number;
  Vr: number;
  Av: number;
  ok: boolean;
}

export interface QdInput {
  L: number;
  Lsrc?: boolean;
  h: number;
  k: number;
  S?: number;
  h1: number;
  h1n?: number;
  g1: number;
  h2: number;
  h2n?: number;
  g2: number;
  hs: number;
  gs: number;
  gc: number;
  gcm: number;
  K1?: number;
  fc: number;
  fy?: number;
  grade?: string;
  mlane: number;
  nl?: string;
  qlane: number;
  IM?: number;
  LT: number;
  wt: number;
  LLDF: number;
  eta: number;
  db: number;
  sb: number;
  cb: number;
  dt: number;
  st: number;
  ct: number;
  g3: number;
  ge: number;
  ag: number;
  nv: number;
  dv: number;
  sv: number;
  Lc?: number;
  L1?: number;
  L2?: number;
  Hh?: number;
  hg?: number;
  ip?: number;
  i?: number;
  xm?: number;
  Hc0?: number;
  HcE?: number;
  Hcm?: number;
}

export interface QdResult {
  I: QdInput;
  Ltt: number;
  Hc: number;
  Fe: number;
  IM: number;
  DC: number;
  DW: number;
  EV: number;
  LN: number;
  veh: QdVehicleResult[];
  vg: QdVehicleResult;
  vgV: QdVehicleResult;
  C: QdComboResult[];
  sec: QdSectionFlexResult;
  min: QdMinSteelResult;
  crk: QdCrackResult;
  shr: QdShearResult;
  ok: {
    M: boolean;
    min: boolean;
    crk: boolean;
    V: boolean;
    all: boolean;
  };
}

// ---------------------------------------------------------------------------
// 2. Approach Slab Core Solver (`QD`)
// ---------------------------------------------------------------------------

export function qdPatch(L: number, a0: number, b0: number, p: number): QdPatchEval | null {
  const a = Math.max(0, a0);
  const b = Math.min(L, b0);
  if (b <= a) return null;
  const P = p * (b - a);
  const c = (a + b) / 2;
  const RA = (P * (L - c)) / L;
  const RB = P - RA;
  return {
    RA,
    RB,
    M: (x: number) =>
      x <= a ? RA * x : x >= b ? RB * (L - x) : RA * x - (p * (x - a) * (x - a)) / 2,
    V: (x: number) => (x < a ? RA : x > b ? -RB : RA - p * (x - a)),
  };
}

export function qdVehicle(I: QdInput, Hc: number, veh: QdVehicleSpec): QdVehiclePatch[] {
  const IMf = 1 + (I.IM || 0) / 100;
  const m = I.mlane;
  const H = Hc * 1000;
  const out: QdVehiclePatch[] = [];

  for (const ax of veh.axles) {
    if (H < 600) {
      const E = 2440 + 0.12 * (I.S || 0);
      const Esp = I.LT + I.LLDF * H;
      const len = Esp / 1000;
      const pw = (m * IMf * ax.P) / ((E / 1000) * len);
      out.push({ off: ax.x, len, p: pw, E, Esp });
    } else {
      const w1 = I.wt + I.LLDF * H;
      const l1 = I.LT + I.LLDF * H;
      const ov = w1 > 1800;
      const W = ov ? 1800 + w1 : w1;
      const Pw = ov ? ax.P : ax.P / 2;
      const len = l1 / 1000;
      const pw = (m * IMf * Pw) / ((W / 1000) * len);
      out.push({ off: ax.x, len, p: pw, W, Lw: l1, ov });
    }
  }
  return out;
}

export const QD_VEH: readonly QdVehicleSpec[] = [
  {
    k: 'truck',
    nm: 'Xe tải thiết kế',
    axles: [
      { x: 0, P: 35 },
      { x: 4.3, P: 145 },
      { x: 8.6, P: 145 },
    ],
  },
  {
    k: 'tandem',
    nm: 'Xe hai trục thiết kế',
    axles: [
      { x: 0, P: 110 },
      { x: 1.2, P: 110 },
    ],
  },
];

export function qdEnvelope(
  _I: QdInput,
  L: number,
  _wU: number,
  patches: readonly QdVehiclePatch[],
  n: number,
): QdEnvelopeResult {
  const xs = Array.from({ length: n + 1 }, (_, i) => (L * i) / n);
  const span = Math.max(...patches.map((q) => q.off + q.len));
  let Mb: { M: number; x?: number; s?: number } = { M: 0 };
  let Vb: { V: number; s?: number } = { V: 0 };

  for (let s = -span; s <= L + 1e-9; s += L / 200) {
    const P = patches
      .map((q) => qdPatch(L, s + q.off, s + q.off + q.len, q.p))
      .filter((x): x is QdPatchEval => Boolean(x));
    if (!P.length) continue;
    for (const x of xs) {
      const M = P.reduce((a, q) => a + q.M(x), 0);
      if (M > Mb.M) Mb = { M, x, s };
    }
    const V = P.reduce((a, q) => a + q.RA, 0);
    const V2 = P.reduce((a, q) => a + q.RB, 0);
    if (Math.max(V, V2) > Vb.V) Vb = { V: Math.max(V, V2), s };
  }

  return { M: Mb.M, xM: Mb.x, sM: Mb.s, V: Vb.V, sV: Vb.s };
}

export const QD_GR: Readonly<Record<string, number>> = {
  'CB300-V': 300,
  'CB400-V': 400,
  'CB500-V': 500,
  'CB240-T': 240,
  'CB300-T': 300,
};

export function qdCalc(I0: QdInput): QdResult {
  const I: QdInput = { ...I0 };
  const L = I.k * I.L;
  const Ltt = L;
  I.S = L * 1000;
  const Hc = I.h1 + I.h2 + I.hs;
  const Fe = Math.min(1.15, 1 + (0.2 * Hc) / L);
  I.IM = Math.max(0, 33 * (1 - 4.1e-4 * Hc * 1000));
  const IM = I.IM;
  const DC = I.gc * I.h;
  const DW = Fe * (I.g1 * I.h1 + I.g2 * I.h2);
  const EV = Fe * I.gs * I.hs;
  const LN = (I.mlane * I.qlane) / 3;

  const veh: QdVehicleResult[] = QD_VEH.map((vehSpec) => {
    const P = qdVehicle(I, Hc, vehSpec);
    return {
      ...vehSpec,
      patches: P,
      env: qdEnvelope(I, L, 0, P, 100),
    };
  });
  const vg = veh.reduce((a, b) => (b.env.M > a.env.M ? b : a));
  const vgV = veh.reduce((a, b) => (b.env.V > a.env.V ? b : a));

  const comboSpecs: ReadonlyArray<{ k: 'STR' | 'SD'; nm: string; f: QdComboFactors }> = [
    { k: 'STR', nm: 'CĐ I', f: { DC: 1.25, DW: 1.5, EV: 1.3, LL: 1.75 } },
    { k: 'SD', nm: 'SD I', f: { DC: 1, DW: 1, EV: 1, LL: 1 } },
  ];
  const C: QdComboResult[] = comboSpecs.map((c) => {
    const e = c.k === 'STR' ? I.eta : 1;
    const wU = c.f.DC * DC + c.f.DW * DW + c.f.EV * EV + c.f.LL * LN;
    const MU = (wU * L * L) / 8;
    const VU = (wU * L) / 2;
    return {
      k: c.k,
      nm: c.nm,
      f: c.f,
      wU,
      MU,
      VU,
      ML: c.f.LL * vg.env.M,
      VL: c.f.LL * vgV.env.V,
      Mu: e * (MU + c.f.LL * vg.env.M),
      Vu: e * (VU + c.f.LL * vgV.env.V),
    };
  });
  const S = C[0];
  const SD = C[1];

  const b = 1000;
  const h = I.h * 1000;
  const fc = I.fc;
  const fy = I.fy || (I.grade ? QD_GR[I.grade] : 0) || 400;
  const Es = 200000;
  const Ab = (d: number) => (Math.PI * d * d) / 4;
  const As = (Ab(I.db) * 1000) / I.sb;
  const Asp = I.dt > 0 && I.st > 0 ? (Ab(I.dt) * 1000) / I.st : 0;
  const ds = h - I.cb - I.db / 2;
  const dps = I.ct + I.dt / 2;
  const b1 = fc <= 28 ? 0.85 : Math.max(0.65, 0.85 - (0.05 * (fc - 28)) / 7);
  const c = (As * fy) / (0.85 * fc * b1 * b);
  const a = b1 * c;
  const Mn = (As * fy * (ds - a / 2)) / 1e6;
  const et = (0.003 * (ds - c)) / c;
  const phi = et >= 0.005 ? 0.9 : et <= 0.002 ? 0.75 : 0.75 + (0.15 * (et - 0.002)) / 0.003;
  const sec: QdSectionFlexResult = {
    b,
    h,
    fc,
    fy,
    Es,
    As,
    Asp,
    ds,
    dps,
    b1,
    c,
    a,
    Mn,
    et,
    phi,
    Mr: phi * Mn,
    okM: S.Mu <= phi * Mn,
  };

  const fr = 0.63 * Math.sqrt(fc);
  const Sc = (b * h * h) / 6;
  const Mcr = (I.g3 * 1.6 * fr * Sc) / 1e6;
  const min: QdMinSteelResult = {
    fr,
    Sc,
    Mcr,
    M133: 1.33 * S.Mu,
    ok: sec.Mr >= Math.min(Mcr, 1.33 * S.Mu),
  };

  const Ec = 0.0017 * (I.K1 || 1) * I.gcm * I.gcm * Math.pow(fc, 0.33);
  const n = Es / Ec;
  const rho = As / (b * ds);
  const k = -n * rho + Math.sqrt((n * rho) ** 2 + 2 * n * rho);
  const j = 1 - k / 3;
  const fss = Math.min(0.6 * fy, (SD.Mu * 1e6) / (As * j * ds));
  const dc = I.cb + I.db / 2;
  const bs = 1 + dc / (0.7 * (h - dc));
  const smax = (123000 * I.ge) / (bs * fss) - 2 * dc;
  const crk: QdCrackResult = {
    Ec,
    n,
    rho,
    k,
    j,
    fss,
    dc,
    bs,
    smax,
    s: I.sb,
    ok: I.sb <= smax,
  };

  const dv = Math.max(0.9 * ds, 0.72 * h);
  const Vu = S.Vu;
  const Mu = (Vu * dv) / 1000;
  const es = Math.min(0.006, Math.max(0, ((Mu * 1e6) / dv + Vu * 1e3) / (Es * As)));
  const sx = dv;
  const sxe = Math.min(2000, Math.max(300, (sx * 35) / (I.ag + 16)));
  const Avs = I.sv > 0 && I.dv > 0 && I.nv > 0 ? I.nv * Ab(I.dv) : 0;
  const beta = Avs > 0 ? 4.8 / (1 + 750 * es) : ((4.8 / (1 + 750 * es)) * 1300) / (1000 + sxe);
  const theta = 29 + 3500 * es;
  const Vc = (0.083 * beta * Math.sqrt(fc) * b * dv) / 1000;
  const Vs = Avs > 0 ? (Avs * fy * dv) / Math.tan((theta * Math.PI) / 180) / I.sv / 1000 : 0;
  const Vn = Math.min(Vc + Vs, (0.25 * fc * b * dv) / 1000);
  const Vr = 0.9 * Vn;
  const Av = Avs;
  const shr: QdShearResult = {
    dv,
    Vu,
    Mu,
    es,
    sx,
    sxe,
    beta,
    theta,
    Vc,
    Vs,
    Vn,
    Vr,
    Av,
    ok: Vu <= Vr,
  };

  const ok = {
    M: sec.okM,
    min: min.ok,
    crk: crk.ok,
    V: shr.ok,
    all: sec.okM && min.ok && crk.ok && shr.ok,
  };

  return {
    I,
    Ltt,
    Hc,
    Fe,
    IM,
    DC,
    DW,
    EV,
    LN,
    veh,
    vg,
    vgV,
    C,
    sec,
    min,
    crk,
    shr,
    ok,
  };
}

export const QD = {
  calc: qdCalc,
  VEH: QD_VEH,
  patch: qdPatch,
  vehicle: qdVehicle,
  envelope: qdEnvelope,
  GR: QD_GR,
} as const;

// ---------------------------------------------------------------------------
// 3. UI State, Input Reader & HTML Report Generators (`07:214-582`)
// ---------------------------------------------------------------------------

export let QDR: QdResult | null = null;

export function getLatestQdResult(): QdResult | null {
  return QDR;
}

export function setLatestQdResult(res: QdResult | null): void {
  QDR = res;
}

export const QD_HG = 0.7;

export function qdInputs(): QdInput {
  const Lm = qdN('mo_Lqd');
  const hm = qdN('mo_hqd');
  const nl = $('qd_nl') ? v('qd_nl', '1') || '1' : '1';
  const I: QdInput = {
    L: Lm > 0 ? Lm : qdN('qd_L'),
    Lsrc: Lm > 0,
    h: hm > 0 ? hm : 0.3,
    k: qdN('qd_k') || 2 / 3,
    h1: qdN('qd_h1'),
    g1: qdN('qd_g1'),
    h2: qdN('qd_h2'),
    g2: qdN('qd_g2'),
    hs: 0,
    gs: (qdN('mo_gsT') || 1.8) * 9.81,
    gc: (qdN('mo_gcT') || 2.5) * 9.81,
    gcm: (qdN('mo_gcT') || 2.5) * 1000,
    K1: 1,
    fc: qdN('rc_fc') || 30,
    fy: qdN('rc_grade') || 400,
    mlane: nl === '2' ? 1.0 : 1.2,
    nl,
    qlane: 9.3,
    LT: 250,
    wt: 510,
    LLDF: qdN('qd_LLDF') || 1.15,
    eta: qdN('qd_eta') || 1,
    db: qdN('qd_db'),
    sb: qdN('qd_sb'),
    cb: qdN('qd_cb'),
    dt: qdN('qd_dt'),
    st: qdN('qd_st'),
    ct: qdN('qd_ct'),
    g3: 0.75,
    ge: +($('qd_ge') ? v('qd_ge', '1') : 1) || 1,
    ag: qdN('qd_ag') || 19,
    nv: qdN('qd_nv'),
    dv: qdN('qd_dv'),
    sv: qdN('qd_sv'),
    Lc: qdN('qd_Lc') || 0.3,
    L1: qdN('qd_L1'),
    L2: qdN('qd_L2'),
    Hh: qdN('qd_Hh'),
  };

  I.hg = QD_HG;
  I.ip = $('qd_i') ? qdN('qd_i') : 5;
  I.i = I.ip / 100;
  I.xm = (I.Lc || 0.3) + (I.k * I.L) / 2;
  I.Hc0 = I.hg - I.h;
  I.HcE = I.hg - I.h + I.i * I.L;
  I.Hcm = Math.max(0, I.Hc0 + I.i * I.xm);
  I.h1n = I.h1;
  I.h2n = I.h2;
  I.hs = Math.max(0, I.Hcm - I.h1 - I.h2);
  I.h1 = Math.min(I.h1n, I.Hcm);
  I.h2 = Math.min(I.h2n, Math.max(0, I.Hcm - I.h1n));
  return I;
}

export const qdOk = (b: boolean): string =>
  `<span class="${b ? 'ok' : 'bad'}">${b ? 'Đạt' : 'Không đạt'}</span>`;

export function qdStep(opts?: {
  force?: boolean;
  ikOn?: (key: string) => boolean;
  trOn?: () => boolean;
  dcOn?: () => boolean;
}): QdResult | null {
  if (!opts?.force && !$('tab43')) return null;

  const ikOnFn =
    opts?.ikOn ?? (globalThis as { ikOn?: (key: string) => boolean }).ikOn;
  if (typeof ikOnFn === 'function' && !ikOnFn('qd')) {
    QDR = null;
    return null;
  }

  let I: QdInput;
  let R: QdResult;
  try {
    I = qdInputs();
    R = QD.calc(I);
  } catch (e) {
    console.error(e);
    return null;
  }

  QDR = R;
  I = R.I;

  const kl = (id: string, ok: boolean, t1: string, t2: string) => {
    set(id, 'KẾT LUẬN: ' + (ok ? t1 : t2));
    cls(id, 'kl ' + (ok ? 'ok' : 'bad'));
  };

  const tabNum = (() => {
    try {
      const trOnFn = opts?.trOn ?? (globalThis as { trOn?: () => boolean }).trOn;
      const dcOnFn = opts?.dcOn ?? (globalThis as { dcOn?: () => boolean }).dcOn;
      if (typeof trOnFn === 'function') {
        return trOnFn() || (typeof dcOnFn === 'function' && dcOnFn()) ? '21' : '14';
      }
      if ($('tq_kn')) {
        return v('tq_kn') !== 'k' ? '21' : '14';
      }
      return '14';
    } catch {
      return '21';
    }
  })();

  const btn = $('qdTabBtn');
  if (btn) btn.textContent = `${tabNum}. Bản quá độ`;

  set('o_qd_L', qf(I.L, 2) + (I.Lsrc ? '' : ' (theo giá trị L0)'));
  set('o_qd_h', qf(I.h, 3));
  set('o_qd_Ltt', qf(R.Ltt, 3));
  set('o_qd_Hc', qf(R.Hc, 3));
  {
    const r = $('qd_L');
    const rr = r?.closest?.('.row');
    if (rr && rr.style) rr.style.display = I.Lsrc ? 'none' : '';
  }
  set('o_qd_hg', qf(I.hg ?? QD_HG, 2));
  set('o_qd_hs', qf(I.hs, 3));
  {
    const ip = I.ip ?? 5;
    const h1n = I.h1n ?? I.h1;
    const h2n = I.h2n ?? I.h2;
    const okI = ip >= 4 - 1e-9 && ip <= 10 + 1e-9;
    const cut = I.h1 + I.h2 < h1n + h2n - 1e-9;
    set(
      'o_qd_slope',
      `Chiều dày lớp phủ trên bản: tại đầu bản kê lên gờ H0 = hg − h = ${qf(I.Hc0, 3)} m ; tại cuối bản HL = H0 + i.L = ${qf(I.HcE, 3)} m ; tại giữa nhịp tính toán H = ${qf(I.Hcm, 3)} m.` +
        (cut
          ? ` Tại giữa nhịp tính toán bản nằm trong kết cấu áo đường: lấy h1 = ${qf(I.h1, 3)} m, h2 = ${qf(I.h2, 3)} m, hs = 0.`
          : '') +
        (okI
          ? ''
          : ` <b class="bad">Độ dốc i = ${qf(ip, 1)}% nằm ngoài khoảng 4 ÷ 10% - nhập lại.</b>`),
    );
  }
  set('o_qd_fc', qf(I.fc, 1));
  set('o_qd_fy', qf(R.sec.fy, 0));
  set('o_qd_gc', qf(I.gc, 3));
  set('o_qd_gs', qf(I.gs, 3));
  set('o_qd_Ec', qf(R.crk.Ec, 0));
  set(
    'o_qd_ttl',
    `BẢN QUÁ ĐỘ - BẢNG TÍNH KIỂM TOÁN BẢN QUÁ ĐỘ BTCT L = ${qf(I.L, 2)} m, h = ${qf(I.h, 2)} m (TCVN 11823:2017)`,
  );

  set(
    'tbQdD',
    '<tr><th>Tải trọng</th><th>Ký hiệu</th><th>Công thức</th><th>Giá trị (kN/m)</th></tr>' +
      [
        [
          'Hệ số tương tác đất - kết cấu',
          'Fe',
          `1 + 0,2.${qf(R.Hc, 2)}/${qf(R.Ltt, 2)}`,
          qf(R.Fe, 4),
        ],
        [
          'Trọng lượng bản thân bản quá độ',
          'DC',
          `γc.h = ${qf(I.gc, 2)} × ${qf(I.h, 2)}`,
          qf(R.DC, 3),
        ],
        [
          'Kết cấu áo đường trên bản',
          'DW',
          `Fe.(γ1.h1 + γ2.h2) = ${qf(R.Fe, 3)} × (${qf(I.g1, 1)} × ${qf(I.h1, 2)} + ${qf(I.g2, 1)} × ${qf(I.h2, 2)})`,
          qf(R.DW, 3),
        ],
        [
          'Đất đắp trên bản',
          'EV',
          `Fe.γs.hs = ${qf(R.Fe, 3)} × ${qf(I.gs, 2)} × ${qf(I.hs, 2)}`,
          qf(R.EV, 3),
        ],
        [
          'Tải trọng làn (đã nhân hệ số làn m)',
          'LLlàn',
          `m.9,3/3 = ${qf(I.mlane, 2)} × 9,3/3`,
          qf(R.LN, 3),
        ],
      ]
        .map(
          (r) =>
            `<tr><td class="l">${r[0]}</td><td class="c">${r[1]}</td><td class="l">${r[2]}</td><td>${r[3]}</td></tr>`,
        )
        .join(''),
  );

  const H = R.Hc * 1000;
  const caseA = H < 600;
  ['qd_fA', 'qd_fB'].forEach((id, i) => {
    const e = $(id);
    if (e && e.style) e.style.display = (i === 0) === caseA ? '' : 'none';
  });
  set(
    'o_qd_llm',
    `Chiều dày lớp phủ trên bản H = DE = ${qf(H, 0)} mm ${caseA ? '< 600 mm: tải trọng trục phân bố trên bản theo TCVN 11823-4, Điều 6.2.10 (như cống hộp có xe chạy song song nhịp)' : '≥ 600 mm: tải trọng bánh xe phân bố qua đất đắp trên diện tích chữ nhật theo TCVN 11823-3, Điều 6.1.2.6'}. IM = ${qf(R.IM, 2)}%; hệ số làn m = ${qf(I.mlane, 2)} (${I.nl || '1'} làn chất tải); LLDF = ${qf(I.LLDF, 2)}.`,
  );

  {
    let h = `<tr><th>Đại lượng</th><th>Ký hiệu</th>${R.veh.map((veh) => `<th>${veh.nm}</th>`).join('')}<th>Đơn vị</th></tr>`;
    const rw = (
      l: string,
      s: string,
      f: (veh: QdVehicleResult) => string | number | undefined,
      u: string,
      d = 2,
    ) => {
      h += `<tr><td class="l">${l}</td><td class="c">${s}</td>${R.veh.map((veh) => {
        const val = f(veh);
        return `<td>${typeof val === 'string' ? val : qf(val, d)}</td>`;
      }).join('')}<td class="c">${u}</td></tr>`;
    };
    rw(
      'Tải trọng trục và cự ly trục',
      'P',
      (veh) => veh.axles.map((a) => qf(a.P, 0)).join(' - ') + ' kN',
      'kN',
    );
    if (caseA) {
      rw('Bề rộng phân bố vuông góc nhịp E = 2440 + 0,12S', 'E', (veh) => veh.patches[0].E, 'mm', 0);
      rw(
        'Chiều dài phân bố dọc nhịp Espan = LT + LLDF.H',
        'Espan',
        (veh) => veh.patches[0].Esp,
        'mm',
        1,
      );
    } else {
      rw('Bề rộng vệt phân bố Ww', 'Ww', (veh) => veh.patches[0].W, 'mm', 1);
      rw('Chiều dài vệt phân bố Lw', 'Lw', (veh) => veh.patches[0].Lw, 'mm', 1);
    }
    rw(
      'Áp lực của trục nặng nhất lên đỉnh bản (dải 1 m)',
      'p',
      (veh) => Math.max(...veh.patches.map((q) => q.p)),
      'kN/m',
      2,
    );
    rw('Mô men lớn nhất do xe (chưa hệ số)', 'MLL', (veh) => veh.env.M, 'kN.m', 2);
    rw('Lực cắt lớn nhất do xe (chưa hệ số)', 'VLL', (veh) => veh.env.V, 'kN', 2);
    h += `<tr class="grp"><td class="l" colspan="${R.veh.length + 3}">Xe gây mô men lớn nhất: ${R.vg.nm} ; xe gây lực cắt lớn nhất: ${R.vgV.nm}.</td></tr>`;
    set('tbQdLL', h);
  }

  set(
    'tbQdF',
    '<tr><th>Tổ hợp</th><th>w (kN/m)</th><th>M do tải đều</th><th>M do xe</th><th>Mu (kN.m)</th><th>V do tải đều</th><th>V do xe</th><th>Vu (kN)</th></tr>' +
      R.C.map(
        (c) =>
          `<tr><td class="l">${c.nm} (η = ${qf(c.k === 'STR' ? I.eta : 1, 2)})</td><td>${qf(c.wU, 3)}</td><td>${qf(c.MU)}</td><td>${qf(c.ML)}</td><td>${qf(c.Mu)}</td><td>${qf(c.VU)}</td><td>${qf(c.VL)}</td><td>${qf(c.Vu)}</td></tr>`,
      ).join(''),
  );

  const s = R.sec;
  const S = R.C[0];
  const SD = R.C[1];
  const T = (rows: ReadonlyArray<readonly [string, string, string, string?]>) =>
    '<tr><th>Hạng mục</th><th>Ký hiệu</th><th>Giá trị</th><th>Đơn vị</th></tr>' +
    rows
      .map(
        (r) =>
          `<tr><td class="l">${r[0]}</td><td class="c">${r[1]}</td><td>${r[2]}</td><td class="c">${r[3] || ''}</td></tr>`,
      )
      .join('');

  set(
    'tbQdM',
    T([
      ['Diện tích cốt thép chịu kéo trên 1 m', 'As', qf(s.As, 1), 'mm²'],
      ['Chiều cao có hiệu ds = h − cb − φb/2', 'ds', qf(s.ds, 1), 'mm'],
      ['Hệ số β1', 'β1', qf(s.b1, 3)],
      ['Chiều cao vùng nén c', 'c', qf(s.c, 2), 'mm'],
      ['Chiều cao khối ứng suất a = β1.c', 'a', qf(s.a, 2), 'mm'],
      ['Biến dạng cốt thép chịu kéo εt', 'εt', qf(s.et, 4)],
      ['Hệ số sức kháng', 'φ', qf(s.phi, 3)],
      ['Sức kháng uốn danh định', 'Mn', qf(s.Mn), 'kN.m'],
      ['Sức kháng uốn tính toán Mr = φ.Mn', 'Mr', qf(s.Mr), 'kN.m'],
      ['Mô men tính toán (CĐ I)', 'Mu', qf(S.Mu), 'kN.m'],
      ['Kiểm tra Mu ≤ Mr', '', qdOk(R.ok.M)],
    ]),
  );
  kl(
    'klQdM',
    R.ok.M,
    'Bản quá độ ĐẠT YÊU CẦU về sức kháng uốn.',
    'Bản quá độ KHÔNG ĐẠT về sức kháng uốn - tăng chiều dày bản hoặc cốt thép.',
  );

  set(
    'tbQdMin',
    T([
      ["Cường độ chịu kéo khi uốn fr = 0,63√f'c", 'fr', qf(R.min.fr, 3), 'MPa'],
      ['Mô đun chống uốn Sc = b.h²/6', 'Sc', qf(R.min.Sc / 1e6, 3) + '×10⁶', 'mm³'],
      ['Mô men nứt Mcr = γ3.γ1.fr.Sc', 'Mcr', qf(R.min.Mcr), 'kN.m'],
      ['1,33 Mu', '1,33Mu', qf(R.min.M133), 'kN.m'],
      ['Sức kháng uốn tính toán', 'Mr', qf(s.Mr), 'kN.m'],
      ['Kiểm tra Mr ≥ min(1,33Mu ; Mcr)', '', qdOk(R.ok.min)],
    ]),
  );
  kl(
    'klQdMin',
    R.ok.min,
    'Hàm lượng cốt thép ĐẠT YÊU CẦU tối thiểu.',
    'Cốt thép KHÔNG ĐỦ hàm lượng tối thiểu - tăng cốt thép.',
  );

  const c = R.crk;
  set(
    'tbQdC',
    T([
      ['Tỷ số mô đun n = Es/Ec', 'n', qf(c.n, 3)],
      ['Hàm lượng cốt thép ρ = As/(b.ds)', 'ρ', qf(c.rho, 5)],
      ['k = −nρ + √((nρ)² + 2nρ)', 'k', qf(c.k, 4)],
      ['j = 1 − k/3', 'j', qf(c.j, 4)],
      ['Mô men ở TTGH SD I', 'Ms', qf(SD.Mu), 'kN.m'],
      ['Ứng suất cốt thép fss (≤ 0,6fy)', 'fss', qf(c.fss, 2), 'MPa'],
      ['Khoảng cách từ thớ chịu kéo đến tim cốt thép', 'dc', qf(c.dc, 1), 'mm'],
      ['Hệ số βs', 'βs', qf(c.bs, 4)],
      ['Hệ số phơi lộ', 'γe', qf(I.ge, 2)],
      ['Cự ly cốt thép tối đa smax', 'smax', qf(c.smax, 1), 'mm'],
      ['Cự ly cốt thép thiết kế', 's', qf(c.s, 0), 'mm'],
      ['Kiểm tra s ≤ smax', '', qdOk(R.ok.crk)],
    ]),
  );
  kl(
    'klQdC',
    R.ok.crk,
    'Bản quá độ ĐẠT YÊU CẦU khống chế nứt.',
    'Bản quá độ KHÔNG ĐẠT khống chế nứt - giảm cự ly hoặc tăng cốt thép.',
  );

  const sh = R.shr;
  set(
    'tbQdV',
    T([
      ['Chiều cao chịu cắt có hiệu dv = max(0,9ds ; 0,72h)', 'dv', qf(sh.dv, 1), 'mm'],
      ['Lực cắt tính toán (CĐ I)', 'Vu', qf(sh.Vu), 'kN'],
      ['Mô men đồng thời Mu = Vu.dv', 'Mu', qf(sh.Mu), 'kN.m'],
      ['Biến dạng dọc εs (≤ 0,006)', 'εs', qf(sh.es, 5)],
      ['Thông số khoảng cách vết nứt sxe', 'sxe', qf(sh.sxe, 1), 'mm'],
      ['Hệ số β', 'β', qf(sh.beta, 3)],
      ['Góc θ = 29 + 3500εs', 'θ', qf(sh.theta, 2), 'độ'],
      ['Sức kháng cắt của bê tông', 'Vc', qf(sh.Vc), 'kN'],
      ['Sức kháng cắt của cốt đai', 'Vs', qf(sh.Vs), 'kN'],
      ['Sức kháng cắt danh định', 'Vn', qf(sh.Vn), 'kN'],
      ['Sức kháng cắt tính toán Vr = 0,9Vn', 'Vr', qf(sh.Vr), 'kN'],
      ['Kiểm tra Vu ≤ Vr', '', qdOk(R.ok.V)],
    ]),
  );
  kl(
    'klQdV',
    R.ok.V,
    'Bản quá độ ĐẠT YÊU CẦU về sức kháng cắt.',
    'Bản quá độ KHÔNG ĐẠT về sức kháng cắt - tăng chiều dày bản hoặc bố trí cốt đai.',
  );

  set(
    'tbQdSum',
    '<tr><th>STT</th><th>Hạng mục kiểm toán</th><th>Căn cứ</th><th>Kết quả</th></tr>' +
      (
        [
          ['Sức kháng uốn', 'TCVN 11823-5, Điều 7.3.2', R.ok.M],
          ['Cốt thép tối thiểu', 'TCVN 11823-5, Điều 7.3.3.2', R.ok.min],
          ['Khống chế nứt', 'TCVN 11823-5, Điều 7.3.4', R.ok.crk],
          ['Sức kháng cắt', 'TCVN 11823-5, Điều 7.2.3', R.ok.V],
        ] as Array<[string, string, boolean]>
      )
        .map(
          (r, i) =>
            `<tr><td class="c">${i + 1}</td><td class="l">${r[0]}</td><td class="l">${r[1]}</td><td class="c">${qdOk(r[2])}</td></tr>`,
        )
        .join(''),
  );
  kl(
    'klQd',
    R.ok.all,
    'BẢN QUÁ ĐỘ ĐẠT YÊU CẦU THEO TẤT CẢ CÁC HẠNG MỤC KIỂM TOÁN.',
    'BẢN QUÁ ĐỘ KHÔNG ĐẠT - XEM CÁC HẠNG MỤC KHÔNG ĐẠT Ở BẢNG TRÊN.',
  );

  try {
    const hooks = getVisualHooks() as VisualReportHooks & {
      renderApproachSlab?: (payload: { result: QdResult }) => void;
    };
    hooks.renderApproachSlab?.({ result: R });
    const qdFigsGlobal = (globalThis as { qdFigs?: (res: QdResult) => void }).qdFigs;
    if (!hooks.renderApproachSlab && typeof qdFigsGlobal === 'function') {
      qdFigsGlobal(R);
    }
    hooks.renderMath?.();
  } catch (e) {
    console.error(e);
  }
  return R;
}

export function toApproachSlabResult(R: QdResult): CulvertResult {
  return {
    kind: 'approach-slab',
    direct: {
      rows: [
        {
          sec: R.sec,
          min: R.min,
          crk: R.crk,
          shr: R.shr,
          combos: R.C,
        },
      ],
      okAll: R.ok.all,
    },
    okAll: R.ok.all,
  };
}
