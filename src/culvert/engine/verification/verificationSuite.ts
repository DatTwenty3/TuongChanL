/**
 * BangTinhCauCong Web App — Independent Software Verification Suite (`VT`).
 *
 * Clean-room TypeScript port of `analysis-cau-cong/modules/20_verification_tests_vt.js`
 * (lines 1–2024):
 * - `106` fixed benchmark checks (`63` `add()` calls) across groups `G1..G9`
 *   comparing solver outputs against published TCVN 11823 / TCVN 9845 / AASHTO LRFD
 *   tables and closed-form analytical solutions.
 * - `VT.live()` covering all live integration blocks across solved bridge, abutment,
 *   hydrology, retaining wall, culvert, approach slab, link slab, and parapet state.
 * - Headless-safe `VT.run()`, `VT.runSuite()`, `vtRender()`, `getLatestVtResult()`.
 */

import { $, fx, getOutputValue } from '../context.ts';
import { RC } from '../math/rc.ts';
import { SF } from '../foundations/shallowFdn.ts';
import { SCT, type SctCalcInput, type SctCalcOutput } from '../foundations/drilledShaft.ts';
import { MC } from '../foundations/pileGroup.ts';
import { TC, getLatestTcResult } from '../culvertsWalls/wallGravity.ts';
import { CH, getLatestChResult } from '../culvertsWalls/boxCulvert.ts';
import { getLatestCtResult } from '../culvertsWalls/pipeCulvert.ts';
import { DCT } from '../bridge/pierSolid.ts';
import { getLatestDamResult, type DamCalcResult, type DamSpInput, type RcCalcResult } from '../bridge/girderHollow.ts';
import { type GiCalcResult } from '../bridge/girderI.ts';
import {
  getLatestGlcResult,
  getLatestKcgResult,
  getLatestLtnResult,
  getLatestSup2Result,
  type GcCalcResult,
} from '../bridge/deckJoints.ts';
import { getLatestMorResult, moInputs } from '../bridge/abutmentHeavy.ts';
import { getLatestQdResult } from '../bridge/approachSlab.ts';
import { HV, hvCalc, hvIn, type HvCalcResult } from '../hydrology/bridgeHydro.ts';
import type {
  VerificationCheck,
  VerificationCheckResult,
  VerificationSuiteResult,
  VerificationTolerance,
} from '../../types/project.ts';

// ---------------------------------------------------------------------------
// 1. Latest Verification Result State
// ---------------------------------------------------------------------------

let latestVtResult: VerificationSuiteResult | null = null;

export function getLatestVtResult(): VerificationSuiteResult | null {
  return latestVtResult;
}

export function setLatestVtResult(result: VerificationSuiteResult | null): void {
  latestVtResult = result;
}

// ---------------------------------------------------------------------------
// 2. Fixed Benchmark Checks (`VT.C` — 106 Checks across 63 `add()` Calls)
// ---------------------------------------------------------------------------

const R = (v: number): VerificationTolerance => ({ rel: v });
const A = (v: number): VerificationTolerance => ({ abs: v });

const fixedChecks: VerificationCheck[] = [];
const add = (
  g: string,
  t: string,
  q: string,
  u: string,
  ref: number,
  tol: VerificationTolerance,
  src: string,
  f: () => number,
): void => {
  fixedChecks.push({ g, t, q, u, ref, tol, src, f });
};

// ---------- 1. Hệ số sức chịu tải móng nông (36 checks) ----------
const TB_N: ReadonlyArray<readonly [number, number, number, number]> = [
  [0, 5.14, 1.0, 0.0],
  [20, 14.83, 6.4, 5.39],
  [25, 20.72, 10.66, 10.88],
  [30, 30.14, 18.4, 22.4],
  [35, 46.12, 33.3, 48.03],
  [40, 75.31, 64.2, 109.41],
];
const G1 = 'Hệ số sức chịu tải Nc, Nq, Nγ - móng nông';
const S1 = 'TCVN 11823-10, Bảng hệ số sức chịu tải (= AASHTO LRFD Bảng 10.6.3.1.2a-1)';

TB_N.forEach(([p, nc, nq, ng]) => {
  add(G1, `φf = ${p}° - tường chắn (công thức)`, 'Nc', '', nc, A(0.01), S1, () => TC.Nfac(p).Nc);
  add(G1, `φf = ${p}° - tường chắn (công thức)`, 'Nq', '', nq, A(0.01), S1, () => TC.Nfac(p).Nq);
  add(G1, `φf = ${p}° - tường chắn (công thức)`, 'Nγ', '', ng, A(0.01), S1, () => TC.Nfac(p).Ng);
  add(
    G1,
    `φf = ${p}° - móng nông mố, trụ (Bảng 17)`,
    'Nc',
    '',
    nc,
    A(0.06),
    S1,
    () => SF.N17(p).Nc,
  );
  add(
    G1,
    `φf = ${p}° - móng nông mố, trụ (Bảng 17)`,
    'Nq',
    '',
    nq,
    A(0.06),
    S1,
    () => SF.N17(p).Nq,
  );
  add(
    G1,
    `φf = ${p}° - móng nông mố, trụ (Bảng 17)`,
    'Nγ',
    '',
    ng,
    A(0.06),
    S1,
    () => SF.N17(p).Ng,
  );
});

// ---------- 2. Áp lực đất chủ động Coulomb (3 checks) ----------
const G2 = 'Hệ số áp lực đất chủ động ka (Coulomb) - tường chắn';
const S2 = 'TCVN 11823-3, Điều 11.5.3; lưng tường thẳng đứng, mặt đất nằm ngang';

add(G2, 'φ = 30°, δ = 0 (trùng Rankine: tan²(45° - φ/2))', 'ka', '', 0.33333, A(0.0005), S2, () =>
  TC.coulomb(90, 30, 0, 0),
);
add(G2, 'φ = 35°, δ = 0 (trùng Rankine)', 'ka', '', 0.27099, A(0.0005), S2, () =>
  TC.coulomb(90, 35, 0, 0),
);
add(
  G2,
  'φ = 30°, δ = 20°',
  'ka',
  '',
  0.2973,
  A(0.0005),
  S2 + '; giá trị tra bảng Coulomb 0,297',
  () => TC.coulomb(90, 30, 20, 0),
);

// ---------- 3. Đường tần suất Pearson III (14 checks) ----------
const G3 = 'Hệ số Φ(P, Cs) đường tần suất Pearson III';
const S3 = 'Bảng hệ số tần suất Pearson III (Foster - Rưbkin; U.S. Bulletin 17B, Phụ lục 3)';

(
  [
    [0, 1, 2.32635],
    [0, 10, 1.28155],
    [1, 1, 3.02239],
    [1, 2, 2.54206],
    [1, 4, 2.04269],
    [1, 10, 1.34039],
    [1, 50, -0.16397],
    [2, 1, 3.60517],
    [2, 2, 2.91202],
    [2, 10, 1.30157],
    [2, 50, -0.30685],
    [0.6, 1, 2.75514],
    [0.6, 10, 1.3285],
    [-0.4, 1, 2.02891],
  ] as const
).forEach(([cs, P, k]) =>
  add(G3, `Cs = ${String(cs).replace('.', ',')} ; P = ${P} %`, 'Φ', '', k, A(0.003), S3, () =>
    HV.phiP(P, cs),
  ),
);

// ---------- 4. Mặt cắt chữ nhật BTCT (24 checks) ----------
const G4 = 'Mặt cắt chữ nhật BTCT: vật liệu, uốn, cắt, nứt';
const S4 = 'Tính tay theo TCVN 11823-5';

const M = () =>
  RC.mat({
    fc: 30,
    fy: 400,
    Es: 200000,
    K1: 1,
    wc: 2500,
    ecl: 0.002,
    etl: 0.005,
    ag: 20,
    g1: 1.6,
    g3: 400 / 570,
    ge: 1.0,
  });

const sec = (
  b: number,
  h: number,
  n1: number,
  d1: number,
  dc1: number,
  n2: number,
  d2: number,
  dc2: number,
  st?: { s: number; d: number; n: number },
) => ({
  b,
  h,
  f1: { n: n1, s: 200, d: d1, dc: dc1 },
  f2: { n: n2, s: 200, d: d2, dc: dc2 },
  st: st || { s: 200, d: 12, n: 0 },
});

add(
  G4,
  "Bê tông f'c = 30 MPa, wc = 2500 kg/m³, K1 = 1",
  'Ec',
  'MPa',
  32642.2,
  R(0.0005),
  "TCVN 11823-5, Điều 4.2.4: Ec = 0,0017.K1.wc².f'c^0,33",
  () => M().Ec,
);
add(
  G4,
  "Bê tông f'c = 30 MPa",
  'fr',
  'MPa',
  3.4507,
  A(0.0005),
  "TCVN 11823-5, Điều 4.2.6: fr = 0,63√f'c",
  () => M().fr,
);
add(
  G4,
  "Bê tông f'c = 30 MPa",
  'β1',
  '',
  0.83571,
  A(0.0001),
  "TCVN 11823-5, Điều 7.2.2: β1 = 0,85 - 0,05(f'c - 28)/7",
  () => M().b1,
);

const F1 = () => RC.flex(sec(1000, 800, 5, 25, 60, 0, 16, 60), M(), true);
add(
  G4,
  'Uốn - cốt đơn, thép chảy: b×h = 1000×800, 5Φ25, dc = 60',
  'a',
  'mm',
  38.5,
  R(0.001),
  S4 + ", Điều 7.3.2: a = As.fy/(0,85.f'c.b)",
  () => F1().a,
);
add(
  G4,
  'Uốn - cốt đơn, thép chảy: b×h = 1000×800, 5Φ25, dc = 60',
  'Mn',
  'kN.m',
  707.595,
  R(0.001),
  S4 + ', Điều 7.3.2: Mn = As.fy(ds - a/2)',
  () => F1().Mn,
);
add(
  G4,
  'Uốn - cốt đơn, thép chảy: b×h = 1000×800, 5Φ25, dc = 60',
  'φ',
  '',
  0.9,
  A(0.0005),
  'TCVN 11823-5, Điều 5.4.2: εt = 0,0452 ≥ εtl, kéo khống chế',
  () => F1().phi,
);

const F2 = () => RC.flex(sec(400, 700, 10, 32, 70, 4, 20, 60), M(), true);
add(
  G4,
  'Uốn - cốt kép: 400×700, kéo 10Φ32 dc = 70, nén 4Φ20 dc = 60',
  'c',
  'mm',
  318.42,
  R(0.001),
  S4 + ", cân bằng nội lực, thép nén f's = min(fy; 600(c - d's)/c)",
  () => F2().c,
);
add(
  G4,
  'Uốn - cốt kép: 400×700, kéo 10Φ32 dc = 70, nén 4Φ20 dc = 60',
  'Mn',
  'kN.m',
  1635.39,
  R(0.001),
  S4 + ": Mn = As.fs(ds - a/2) + A's.f's(a/2 - d's)",
  () => F2().Mn,
);
add(
  G4,
  'Uốn - cốt kép: 400×700, kéo 10Φ32 dc = 70, nén 4Φ20 dc = 60',
  'φ',
  '',
  0.7968,
  A(0.0005),
  'TCVN 11823-5, Điều 5.4.2: φ = 0,75 + 0,15(εt - εcl)/(εtl - εcl), εt = 0,00294',
  () => F2().phi,
);

const F3 = () => RC.flex(sec(300, 500, 6, 32, 60, 0, 16, 60), M(), true);
add(
  G4,
  'Uốn - thép kéo chưa chảy: 300×500, 6Φ32, dc = 60',
  'fs',
  'MPa',
  363.15,
  R(0.001),
  S4 + ': tương thích biến dạng, fs = 600(ds - c)/c < fy',
  () => F3().fs,
);
add(
  G4,
  'Uốn - thép kéo chưa chảy: 300×500, 6Φ32, dc = 60',
  'Mn',
  'kN.m',
  570.34,
  R(0.001),
  S4 + ': Mn = As.fs(ds - a/2)',
  () => F3().Mn,
);
add(
  G4,
  'Uốn - thép kéo chưa chảy: 300×500, 6Φ32, dc = 60',
  'φ',
  '',
  0.75,
  A(0.0005),
  'TCVN 11823-5, Điều 5.4.2 (εt = 0,00182 ≤ εcl, chịu nén khống chế)',
  () => F3().phi,
);

const SH1 = () => {
  const S = sec(1000, 800, 5, 25, 60, 0, 16, 60, { s: 200, d: 12, n: 4 });
  const m = M();
  return RC.shear(S, m, 300, 400, 0, 0.9, RC.flex(S, m, true));
};
const SH = 'Cắt - có cốt đai: 1000×800, 5Φ25, đai 4 nhánh Φ12 a200; Mu = 300 kN.m, Vu = 400 kN';
add(
  G4,
  SH,
  'dv',
  'mm',
  720.75,
  R(0.001),
  'TCVN 11823-5, Điều 8.2.9: dv = max(de - a/2; 0,9de; 0,72h)',
  () => SH1().dv,
);
add(
  G4,
  SH,
  'εs',
  '‰',
  1.66282,
  R(0.002),
  'TCVN 11823-5, Điều 8.3.4.2 (dạng đúng theo AASHTO LRFD 7th Ed., PT 5.8.3.4.2-4)',
  () => SH1().es * 1000,
);
add(
  G4,
  SH,
  'β',
  '',
  2.13607,
  R(0.002),
  'TCVN 11823-5, PT 77: β = 4,8/(1 + 750εs)',
  () => SH1().beta,
);
add(G4, SH, 'θ', 'độ', 34.82, R(0.001), 'TCVN 11823-5, PT 79: θ = 29 + 3500εs', () => SH1().th);
add(
  G4,
  SH,
  'Vc',
  'kN',
  699.91,
  R(0.002),
  "TCVN 11823-5, Điều 8.3.3: Vc = 0,083β√f'c.bv.dv",
  () => SH1().Vc,
);
add(
  G4,
  SH,
  'Vs',
  'kN',
  937.58,
  R(0.002),
  'TCVN 11823-5, Điều 8.3.3: Vs = Av.fy.dv.cotθ/s',
  () => SH1().Vs,
);
add(G4, SH, 'Vr', 'kN', 1473.74, R(0.002), 'TCVN 11823-5, Điều 8.3.3, φ = 0,9', () => SH1().Vr);

const SH2 = () => {
  const S = sec(1000, 300, 5, 16, 50, 0, 16, 50, { s: 200, d: 12, n: 0 });
  const m = M();
  return RC.shear(S, m, 40, 120, 0, 0.9, RC.flex(S, m, true));
};
const SHb =
  'Cắt - không cốt đai, sxe chạm cận dưới: 1000×300, 5Φ16, ag = 20; Mu = 40 kN.m, Vu = 120 kN';
add(
  G4,
  SHb,
  'sxe',
  'mm',
  294,
  A(0.01),
  'TCVN 11823-5, Điều 8.3.4.2: sxe = sx.35/(ag + 16) = 235 mm, lấy ≥ 294 mm',
  () => SH2().sxe,
);
add(
  G4,
  SHb,
  'β',
  '',
  2.33649,
  R(0.002),
  'TCVN 11823-5, PT 78 (dạng SI): β = 4,8/(1 + 750εs) × 1300/(1000 + sxe)',
  () => SH2().beta,
);
add(G4, SHb, 'Vc', 'kN', 257.17, R(0.002), 'TCVN 11823-5, Điều 8.3.3', () => SH2().Vc);

const CR = () => RC.crack(sec(1000, 800, 5, 25, 60, 0, 16, 60), M(), 400);
const CRt = 'Nứt: 1000×800, 5Φ25 a200, dc = 60; Ms = 400 kN.m; γe = 1,0';
add(
  G4,
  CRt,
  'fss',
  'MPa',
  234.49,
  R(0.002),
  'Tiết diện nứt đàn hồi: fss = Ms/(As.j.de), n = Es/Ec',
  () => CR().fss,
);
add(
  G4,
  CRt,
  'smax',
  'mm',
  350.1,
  R(0.002),
  'TCVN 11823-5, Điều 7.3.4: s ≤ 123000γe/(βs.fss) - 2dc',
  () => CR().smax,
);

// ---------- 5. Sức kháng dọc trục cọc khoan nhồi theo đất nền (9 checks) ----------
const G5 = 'Sức kháng dọc trục cọc khoan nhồi theo đất nền';
const RF = {
  Sét: [0.45, 0.4, 0.35],
  Cát: [0.55, 0.5, 0.45],
  Cuội: [0.55, 0.5, 0.45],
  IGM: [0.6, 0.55, 0.4],
  IGM1: [0.6, 0.55, 0.4],
  Đá: [0.5, 0.5, 0.4],
} as unknown as SctCalcInput['rf'];

const sctBase: Omit<SctCalcInput, 'D' | 'L' | 's' | 'layers'> = {
  ELcap: 0,
  ELgs: 0,
  gcF: 24,
  spt: [],
  noSplit: true,
  oneRow: false,
  cap: false,
  rockSide: 'E',
  svJ: 300,
  tdJ: 0,
  WL: 0,
  fc: 30,
  gc: 24,
  gW: 1,
  mSand: 0.6,
  ER: 60,
  corrN: true,
  qsMax: 0,
  open: false,
  tipRock: 'A',
  GSI: 50,
  mi: 10,
  Dd: 0,
  kSu: 5,
  etaU: 1,
  rf: RF,
};

const sctUnwrap = (res: SctCalcOutput | { err: string }): SctCalcOutput => {
  if ('err' in res && res.err) throw new Error(res.err);
  return res as SctCalcOutput;
};

const P1 = () =>
  sctUnwrap(
    SCT.calc({
      ...sctBase,
      D: 1.0,
      L: 20,
      s: 3.0,
      layers: [
        { name: '1', bot: -30, type: 'Sét', g: 18, N: 20, qu: 0, rqd: 0, aE: 0, open: null },
      ],
    }),
  );
const P1t = 'Sét đồng nhất N60 = 20 (Su = 100 kPa); D = 1,0 m; L = 20 m; s = 3D';
add(
  G5,
  P1t,
  'α',
  '',
  0.55,
  A(0.0005),
  'TCVN 11823-10, Điều 8.3.5.1.2 (α theo Su/pa ≤ 1,5)',
  () => P1().slices[0].coef ?? NaN,
);
add(
  G5,
  P1t,
  'Rs (danh định)',
  'kN',
  3023.78,
  R(0.002),
  'Tính tay: qs = α.Su = 55 kPa trên 17,5 m (bỏ 1,5 m đầu cọc và đoạn bằng D ở mũi, Điều 8.3.5.1.2)',
  () => P1().byType['Sét'].Rn,
);
add(
  G5,
  P1t,
  'η nhóm (sét)',
  '',
  0.7,
  A(0.0005),
  'TCVN 11823-10, Điều 8.3.6.2 và 7.3.9: η = 0,65 (s = 2,5D) đến 1,0 (s = 6D), nội suy',
  () => P1().byType['Sét'].eta,
);
add(
  G5,
  P1t,
  'Nc',
  '',
  9.0,
  A(0.001),
  'TCVN 11823-10, Điều 8.3.5.1.3, PT 89: Nc = 6[1 + 0,2(Z/D)] ≤ 9',
  () => P1().tip.Nc ?? NaN,
);
add(
  G5,
  P1t,
  'Rp (danh định)',
  'kN',
  706.86,
  R(0.002),
  'Tính tay: qp = Nc.Su = 900 kPa',
  () => P1().tip.Rn,
);

const P2 = () =>
  sctUnwrap(
    SCT.calc({
      ...sctBase,
      D: 1.2,
      L: 25,
      s: 3.6,
      layers: [
        { name: '1', bot: -40, type: 'Cát', g: 19, N: 30, qu: 0, rqd: 0, aE: 0, open: null },
      ],
    }),
  );
const P2t = 'Cát đồng nhất N60 = 30, γ = 19 kN/m³, mực nước ở mặt đất; D = 1,2 m; L = 25 m';
add(
  G5,
  P2t,
  "φ'f",
  'độ',
  40.85,
  R(0.001),
  "TCVN 11823-10, Điều 8.3.5.2.2: φ' = 27,5 + 9,2.lg(N1)60, (N1)60 = 28,25",
  () => P2().slices[0].phi ?? NaN,
);
add(
  G5,
  P2t,
  'β',
  '',
  0.63752,
  R(0.002),
  "TCVN 11823-10, Điều 8.3.5.2.2: β = (1 - sinφ')(σ'p/σ'v)^sinφ'.tanφ', σ'p = 0,47pa.N60^0,6",
  () => P2().slices[0].coef ?? NaN,
);
add(
  G5,
  P2t,
  'Rs (danh định)',
  'kN',
  6902.23,
  R(0.002),
  "Tính tay: qs = β.σ'v = 73,23 kPa (σ'v giữa lớp = 114,9 kPa)",
  () => P2().byType['Cát'].Rn,
);
add(
  G5,
  P2t,
  'Rp (danh định)',
  'kN',
  1933.96,
  R(0.002),
  'TCVN 11823-10, Điều 8.3.5.2.3, PT 95: qp = 0,057.N60 = 1,71 MPa',
  () => P2().tip.Rn,
);

// ---------- 6. Cột chữ nhật chịu nén - uốn (3 checks) ----------
const G6 = 'Thân trụ đặc chịu nén - uốn (biểu đồ tương tác), mặt cắt chữ nhật';
const S6 =
  'Tính tay theo TCVN 11823-5, Điều 7.3 (tương thích biến dạng, εcu = 0,003, khối ứng suất chữ nhật, trừ bê tông bị cốt thép chiếm chỗ)';
const PMT = (() => {
  let T: ReturnType<typeof DCT.pmTable> | null = null;
  return () => {
    if (T) return T;
    const B = 500;
    const cs = 5;
    const cells: Array<{ x: number; y: number; a: number }> = [];
    const Ab = (Math.PI * 25 * 25) / 4;
    const bars: Array<{ x: number; y: number; a: number }> = [];
    for (let x = -B / 2 + cs / 2; x < B / 2; x += cs) {
      for (let y = -B / 2 + cs / 2; y < B / 2; y += cs) cells.push({ x, y, a: cs * cs });
    }
    [-190, 0, 190].forEach((x) =>
      [-190, 0, 190].forEach((y) => {
        if (x || y) bars.push({ x, y, a: Ab });
      }),
    );
    const S = { cells, bars, Ag: B * B, Ast: bars.length * Ab };
    const m = M();
    T = DCT.pmTable(
      S,
      { ...m, fc: 30, fy: 400, Es: 200000, b1: m.b1, ecl: 0.002, etl: 0.005 },
      1.0,
    );
    return T;
  };
})();
const pmAt = (P: number): number => {
  const pts = PMT()
    .T[0].pts.slice()
    .sort((p, q) => p.P - q.P);
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].P >= P) {
      const a = pts[i - 1];
      const b = pts[i];
      return a.My + ((b.My - a.My) * (P - a.P)) / (b.P - a.P);
    }
  }
  return NaN;
};
const C6 =
  'Cột 500×500, 8Φ25 (4 góc + 4 giữa cạnh), tâm thép cách mép 60 mm; f\'c = 30 MPa, fy = 400 MPa';
add(
  G6,
  C6,
  "Po = 0,85f'c(Ag - Ast) + fy.Ast",
  'kN',
  7845.66,
  R(0.001),
  'TCVN 11823-5, Điều 7.4.4',
  () => PMT().Pn0 / 1e3,
);
add(G6, C6, 'Mn tại P = 0', 'kN.m', 321.27, R(0.01), S6 + '; c = 77,2 mm', () => pmAt(0));
add(
  G6,
  C6,
  'Mn tại điểm cân bằng, Pb = 2806,7 kN',
  'kN.m',
  609.64,
  R(0.01),
  S6 + '; cb = 264 mm (εs = εy ở hàng thép xa nhất)',
  () => pmAt(2806.7),
);

// ---------- 7. Phân tích khung phẳng (6 checks) ----------
const G7 = 'Phân tích khung phẳng có lò xo (khung trụ dẻo, cống hộp)';
const FR = (
  nodes: Array<{ x: number; y: number }>,
  els: Array<{ i: number; j: number; EA: number; EI: number }>,
  springs: Array<{ n: number; dof: 0 | 1 | 2; k: number }>,
  fix: Array<{ n: number; dof: 0 | 1 | 2 }>,
  LC: Parameters<ReturnType<typeof CH.Frame>['run']>[0],
) => {
  const F = CH.Frame(nodes, els, springs, fix);
  return F.run(LC);
};

const cant = () => {
  const n = 10;
  const nodes = [...Array(n + 1)].map((_, i) => ({ x: 0, y: (5 * i) / n }));
  const els = [...Array(n)].map((_, i) => ({ i, j: i + 1, EA: 1e7, EI: 1e5 }));
  return FR(
    nodes,
    els,
    [],
    [
      { n: 0, dof: 0 },
      { n: 0, dof: 1 },
      { n: 0, dof: 2 },
    ],
    { nod: [{ n, fx: 10 }] },
  );
};
const C7a = 'Công xôn đứng L = 5 m, EI = 1e5 kN.m², lực ngang đầu tự do P = 10 kN';
add(
  G7,
  C7a,
  'chuyển vị đầu',
  'mm',
  4.16667,
  R(0.001),
  'Sức bền vật liệu: Δ = PL³/(3EI)',
  () => Math.abs(cant().u[30]) * 1000,
);
add(G7, C7a, 'mômen chân', 'kN.m', 50, R(0.001), 'M = P.L', () => Math.abs(cant().R[0].Mi));

const ssb = () => {
  const n = 16;
  const L = 8;
  const nodes = [...Array(n + 1)].map((_, i) => ({ x: (L * i) / n, y: 0 }));
  const els = [...Array(n)].map((_, i) => ({ i, j: i + 1, EA: 1e7, EI: 1e5 }));
  return FR(
    nodes,
    els,
    [],
    [
      { n: 0, dof: 0 },
      { n: 0, dof: 1 },
      { n, dof: 1 },
    ],
    { el: els.map((_, k) => ({ e: k, t: 't' as const, a: 0, b: L / n, q1: -12, q2: -12 })) },
  );
};
const C7b = 'Dầm giản đơn L = 8 m, EI = 1e5 kN.m², tải phân bố đều q = 12 kN/m';
add(
  G7,
  C7b,
  'độ võng giữa nhịp',
  'mm',
  6.4,
  R(0.001),
  'Sức bền vật liệu: f = 5qL⁴/(384EI)',
  () => Math.abs(ssb().u[3 * 8 + 1]) * 1000,
);
add(G7, C7b, 'mômen giữa nhịp', 'kN.m', 96, R(0.001), 'M = qL²/8', () => Math.abs(ssb().R[7].Mj));

const wink = () => {
  const n = 120;
  const L = 30;
  const d = L / n;
  const k = 5000;
  const nodes = [...Array(n + 1)].map((_, i) => ({ x: d * i, y: 0 }));
  const els = [...Array(n)].map((_, i) => ({ i, j: i + 1, EA: 1e7, EI: 1e5 }));
  const sp = nodes.map((_, i) => ({
    n: i,
    dof: 1 as const,
    k: k * d * (i === 0 || i === n ? 0.5 : 1),
  }));
  return FR(nodes, els, sp, [{ n: 0, dof: 0 }], { nod: [{ n: 0, fy: -100 }] });
};
const C7c =
  'Dầm dài trên nền đàn hồi (lò xo rời rạc a = 0,25 m), EI = 1e5 kN.m², k = 5000 kN/m², lực P = 100 kN ở đầu tự do';
add(
  G7,
  C7c,
  'chuyển vị đầu',
  'mm',
  13.375,
  R(0.01),
  'Hetényi: y0 = 2Pβ/k, β = (k/4EI)^0,25',
  () => Math.abs(wink().u[1]) * 1000,
);
add(
  G7,
  C7c,
  'mômen lớn nhất',
  'kN.m',
  96.419,
  R(0.015),
  'Hetényi: Mmax = (P/β).e^(-π/4).sin(π/4) tại z = π/(4β)',
  () => Math.max(...wink().R.map((r) => Math.max(Math.abs(r.Mi), Math.abs(r.Mj)))),
);

// ---------- 8. Cọc chịu tải ngang, nhóm cọc bệ cứng (7 checks) ----------
const G8 = 'Cọc chịu tải ngang và nhóm cọc bệ cứng (mố nặng, trụ đặc)';
const lat = () => {
  const K = MC.latK(1e5, 5000, 1, 0, 20, 0, 0, 0, 0);
  const det = K[0][0] * K[1][1] - K[0][1] * K[1][0];
  return { u: (K[1][1] / det) * 100, t: Math.abs((K[1][0] / det) * 100) };
};
const C8a =
  'Cọc dài trong đất có hệ số nền tăng tuyến tính k = nh.z (nh.bp = 5000 kN/m³), EI = 1e5 kN.m², L = 20 m, đầu tự do, H = 100 kN';
add(
  G8,
  C8a,
  'chuyển vị đầu cọc',
  'mm',
  14.693,
  R(0.01),
  'Matlock - Reese: y0 = 2,435.H.T³/EI, T = (EI/nh)^(1/5) = 1,821 m',
  () => lat().u * 1000,
);
add(
  G8,
  C8a,
  'góc xoay đầu cọc',
  'rad',
  0.0053794,
  R(0.01),
  'Matlock - Reese: θ0 = 1,623.H.T²/EI',
  () => lat().t,
);

const grp = (piles: Array<[number, number, number, number]>, load: number[]): number[] => {
  const d = { Kn: 1, Evu: 1, Evn: 3e6, m: 0.001, Ax: 0, By: 0, Cz: 0, md: 0, mb: 0 };
  const P = piles.map(([x, y, phi, psi]) => ({
    x,
    y,
    phi,
    psi,
    Lo: 0,
    H: 10,
    Bpx: 1.62,
    Bpy: 1.62,
    F: 0.785398,
    Fo: 0.785398,
    Ix: 0.049087,
    Iy: 0.049087,
    Jo: 0.049087,
    Po: 500,
    Co: 1e9,
    Ct: 1,
  }));
  return MC.run(d, P, [load])
    .res[0].pf.map((f) => f.N)
    .sort((a, b) => a - b);
};

const g1 = () =>
  grp(
    [
      [-1.5, -1, 0, 0],
      [-1.5, 1, 0, 0],
      [1.5, -1, 0, 0],
      [1.5, 1, 0, 0],
    ],
    [0, 0, 400, 0, 120, 0],
  );
const C8b =
  'Bệ cứng 4 cọc thẳng đứng (x = ±1,5 m; y = ±1,0 m), P = 400, My = 120 (độ cứng ngang cọc rất nhỏ)';
add(
  G8,
  C8b,
  'N cọc lớn nhất',
  '',
  120,
  R(0.002),
  'Tĩnh học bệ cứng: N = P/n ± My.x/Σx²',
  () => g1()[3],
);
add(
  G8,
  C8b,
  'N cọc nhỏ nhất',
  '',
  80,
  R(0.002),
  'Tĩnh học bệ cứng: N = P/n ± My.x/Σx²',
  () => g1()[0],
);

const g2 = () =>
  grp(
    [
      [-1.2, -1, 0, 0],
      [-1.2, 1, 0, 0],
      [0, -1, 0, 0],
      [0, 1, 0, 0],
      [1.2, -1, 10, 0],
      [1.2, 1, 10, 0],
    ],
    [40, 0, 600, 0, 0, 0],
  );
const C8c =
  'Bệ cứng 6 cọc: hàng x = -1,2 và x = 0 thẳng đứng, hàng x = +1,2 xiên 10°; H = 40, P = 600 (chỉ độ cứng dọc trục)';
add(
  G8,
  C8c,
  'N hàng giữa',
  '',
  73.149,
  R(0.005),
  'Tính tay: bệ cứng, cọc làm việc dọc trục, cân bằng ΣN.e = F, tương thích chuyển vị',
  () => g2()[0],
);
add(G8, C8c, 'N hàng thẳng đứng ngoài', '', 113.426, R(0.005), 'Tính tay như trên', () => g2()[2]);
add(G8, C8c, 'N hàng xiên', '', 115.175, R(0.005), 'Tính tay như trên', () => g2()[4]);

// ---------- 9. Tường chắn: lăng thể trượt thử dần (4 checks) ----------
const G9 = 'Tường chắn: áp lực đất chủ động theo lăng thể trượt thử dần';
const wd = (beta: number, q = 0) => {
  const H = 5;
  const T: [number, number] = [0, H];
  const G: Array<[number, number]> = [T, [100, H + 100 * Math.tan((beta * Math.PI) / 180)]];
  return TC.wedge([0, 0], T, G, 18, 30, 20, q || 0, 0, 0);
};
add(
  G9,
  'Lưng tường thẳng đứng H = 5 m, đất đắp nằm ngang, γ = 18 kN/m³, φ = 30°, δ = 20°',
  'ka',
  '',
  0.29731,
  R(0.002),
  'Lăng thể phẳng trùng nghiệm Coulomb: TCVN 11823-3, Điều 11.5.3',
  () => wd(0).Ka,
);
add(
  G9,
  'Lưng tường thẳng đứng H = 5 m, đất đắp nằm ngang, γ = 18 kN/m³, φ = 30°, δ = 20°',
  'Pa',
  'kN/m',
  66.896,
  R(0.002),
  'Pa = 0,5.ka.γ.H²',
  () => wd(0).P,
);
add(
  G9,
  'Như trên, mặt đất đắp dốc β = 10°',
  'Pa',
  'kN/m',
  76.505,
  R(0.002),
  'Coulomb, β = 10°: ka = 0,34002',
  () => wd(10).P,
);
add(
  G9,
  'Như trên, đất đắp nằm ngang, tải phân bố q = 10 kN/m²',
  'Pa',
  'kN/m',
  81.761,
  R(0.002),
  'Pa = ka(0,5.γ.H² + q.H) (mặt trượt không đổi khi q phân bố đều)',
  () => wd(0, 10).P,
);

// ---------------------------------------------------------------------------
// 3. Open-Project Live Integration Checks (`VT.hl93`, `VT.live`)
// ---------------------------------------------------------------------------

/** Independent HL-93 vehicle envelope on a simply-supported beam of span `L` (m) at `x` (m). */
export function hl93(L: number, x: number): { M: number; Q: number } {
  const V: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
    [
      [0, 35],
      [4.3, 145],
      [8.6, 145],
    ],
    [
      [0, 145],
      [4.3, 145],
      [8.6, 35],
    ],
    [
      [0, 110],
      [1.2, 110],
    ],
  ];
  let M = 0;
  let Q = 0;
  const iM = (q: number): number =>
    q < 0 || q > L ? 0 : q <= x ? (q * (L - x)) / L : (x * (L - q)) / L;
  const iV = (q: number): number =>
    q < 0 || q > L ? 0 : q < x ? -q / L : (L - q) / L;

  V.forEach((v) =>
    v.forEach(([p0]) => {
      const s = x - p0;
      M = Math.max(
        M,
        v.reduce((t, [p, w]) => t + w * iM(s + p), 0),
      );
      const s2 = x - p0 + 1e-9;
      Q = Math.max(
        Q,
        v.reduce((t, [p, w]) => t + w * iV(s2 + p), 0),
      );
    }),
  );
  return { M, Q };
}

interface LiveGirderSectionLike {
  x: number;
  Aps?: number;
  Ag?: number;
  Ig?: number;
  e?: number;
  M1?: number;
  fcgp?: number;
  dES?: number;
  Kid?: number;
  dR1?: number;
  dSR?: number;
  dCR?: number;
  fpt?: number;
  MLLv?: number;
  MLv?: number;
  MLLl?: number;
  MLl?: number;
  VLLv?: number;
  VLv?: number;
}

interface LiveGirderBranchLike {
  Lm?: number;
  Ls?: number;
  hs?: number;
  Eci?: number;
  DF?: Record<string, number>;
  shr?: DamCalcResult['shr'] | GiCalcResult['shr'];
  ES?: GiCalcResult['ES'];
  res?: LiveGirderSectionLike[];
}

export function live(): VerificationCheck[] {
  const out: VerificationCheck[] = [];

  // 1–4. Superstructure girders (`DAMR`: HL-93, distribution factors, shrinkage/creep/losses)
  const DAMR = getLatestDamResult();
  if (DAMR) {
    const damG = DAMR.g as LiveGirderBranchLike | undefined;
    const damB = DAMR.b as LiveGirderBranchLike | undefined;
    const branches: ReadonlyArray<readonly ['g' | 'b', string, LiveGirderBranchLike | undefined]> = [
      ['g', 'dầm giữa', damG],
      ['b', 'dầm biên', damB],
    ];

    branches.forEach(([k, nm, D]) => {
      if (!D || !D.res || !D.Lm) return;
      if (k === 'b' && damG && damG.Lm && Math.abs(damG.Lm - D.Lm) < 1e-6) return;
      const L = D.Lm;
      const rows = D.res.filter((r) => r.x > 1e-6 && r.x < L - 1e-6);
      const pick = [rows[0], rows[Math.floor(rows.length / 2)], rows[rows.length - 1]].filter(
        (r, i, a): r is LiveGirderSectionLike => Boolean(r) && a.indexOf(r) === i,
      );
      pick.forEach((r) => {
        const h = hl93(L, r.x);
        const t = `Dầm hiện tại (${nm}), Ltt = ${fx(L, 3)} m, x = ${fx(r.x, 3)} m`;
        const G = 'Số liệu đang mở: nội lực hoạt tải HL-93 trên dầm giản đơn';
        const src =
          'Tính lại độc lập: đường ảnh hưởng dầm giản đơn, xe tải 35 + 145 + 145 kN (4,3 m) và xe hai trục 2 × 110 kN (1,2 m) - TCVN 11823-3, Điều 6.1.2';
        out.push({
          g: G,
          t,
          q: 'M xe (chưa nhân hệ số)',
          u: 'kN.m',
          ref: h.M,
          tol: R(0.002),
          src,
          f: () => (r.MLLv != null ? r.MLLv : (r.MLv ?? NaN)),
        });
        out.push({
          g: G,
          t,
          q: 'M làn 9,3 kN/m',
          u: 'kN.m',
          ref: (9.3 * r.x * (L - r.x)) / 2,
          tol: R(0.002),
          src: 'Tính lại độc lập: M = q.x(L - x)/2',
          f: () => (r.MLLl != null ? r.MLLl : (r.MLl ?? NaN)),
        });
        out.push({
          g: G,
          t,
          q: 'V xe (chưa nhân hệ số)',
          u: 'kN',
          ref: h.Q,
          tol: R(0.005),
          src,
          f: () => (r.VLLv != null ? r.VLLv : (r.VLv ?? NaN)),
        });
      });
    });

    // Hệ số phân bố ngang dầm giữa (mặt cắt loại f, g)
    if (DAMR.type !== 'I' && damG && damG.DF && DAMR.I) {
      const D = damG;
      const F = D.DF!;
      const I = DAMR.I as DamSpInput;
      const b = F.b || I.S * 1000;
      const L = D.Ls ?? (I.Lt - 2 * I.a0) * 1000;
      const k = Math.max(1.5, 2.5 * Math.pow(I.Ng, -0.2));
      const IJ = F.IJ;
      const G = 'Số liệu đang mở: hệ số phân bố ngang dầm giữa (mặt cắt loại f, g)';
      const t = `Dầm hiện tại: b = ${fx(b, 0)} mm, L = ${fx(L, 0)} mm, Nb = ${I.Ng}, I/J = ${fx(IJ, 4)}`;
      out.push({
        g: G,
        t,
        q: 'gM, một làn',
        u: '',
        ref: k * Math.sqrt(b / (2.8 * L)) * Math.pow(IJ, 0.25),
        tol: R(0.001),
        src: 'Tính lại độc lập: TCVN 11823-4, Bảng 6: k(b/2,8L)^0,5(I/J)^0,25, k = 2,5Nb^-0,2 ≥ 1,5',
        f: () => F.M1,
      });
      out.push({
        g: G,
        t,
        q: 'gM, hai làn trở lên',
        u: '',
        ref: k * Math.pow(b / 7600, 0.6) * Math.pow(b / L, 0.2) * Math.pow(IJ, 0.06),
        tol: R(0.001),
        src: 'Tính lại độc lập: TCVN 11823-4, Bảng 6: k(b/7600)^0,6(b/L)^0,2(I/J)^0,06',
        f: () => F.M2,
      });
      out.push({
        g: G,
        t,
        q: 'gV, một làn',
        u: '',
        ref: 0.7 * Math.pow(b / L, 0.15) * Math.pow(IJ, 0.05),
        tol: R(0.001),
        src: 'Tính lại độc lập: TCVN 11823-4, Bảng 12: 0,70(b/L)^0,15(I/J)^0,05',
        f: () => F.V1,
      });
      out.push({
        g: G,
        t,
        q: 'gV, hai làn trở lên',
        u: '',
        ref:
          Math.pow(b / 4000, 0.4) *
          Math.pow(b / L, 0.1) *
          Math.pow(IJ, 0.05) *
          Math.max(1, b / 1200),
        tol: R(0.001),
        src: 'Tính lại độc lập: TCVN 11823-4, Bảng 12: (b/4000)^0,4(b/L)^0,1(I/J)^0,05(b/1200), b/1200 ≥ 1',
        f: () => F.V2,
      });
    }

    // Dầm I: hệ số phân bố ngang (mặt cắt loại a, e, k)
    if (DAMR.type === 'I' && damG && damG.DF && DAMR.I) {
      const D = damG;
      const F = D.DF!;
      const S = DAMR.I.S * 1000;
      const L = D.Ls!;
      const ts = D.hs!;
      const Kg = F.Kg;
      const kk = Kg / (L * ts ** 3);
      const G = 'Số liệu đang mở: hệ số phân bố ngang dầm I giữa (mặt cắt loại a, e, k)';
      const t = `Dầm hiện tại: S = ${fx(S, 0)} mm, L = ${fx(L, 0)} mm, ts = ${fx(ts, 0)} mm, Kg = ${fx(Kg / 1e9, 1)}.10⁹ mm⁴`;
      out.push({
        g: G,
        t,
        q: 'gM, một làn',
        u: '',
        ref: 0.06 + Math.pow(S / 4300, 0.4) * Math.pow(S / L, 0.3) * Math.pow(kk, 0.1),
        tol: R(0.001),
        src: 'Tính lại độc lập: TCVN 11823-4, Bảng 6: 0,06 + (S/4300)^0,4(S/L)^0,3(Kg/Lts³)^0,1',
        f: () => F.gM1,
      });
      out.push({
        g: G,
        t,
        q: 'gM, hai làn trở lên',
        u: '',
        ref: 0.075 + Math.pow(S / 2900, 0.6) * Math.pow(S / L, 0.2) * Math.pow(kk, 0.1),
        tol: R(0.001),
        src: 'Tính lại độc lập: TCVN 11823-4, Bảng 6: 0,075 + (S/2900)^0,6(S/L)^0,2(Kg/Lts³)^0,1',
        f: () => F.gM2,
      });
      out.push({
        g: G,
        t,
        q: 'gV, một làn',
        u: '',
        ref: 0.36 + S / 7600,
        tol: R(0.001),
        src: 'Tính lại độc lập: TCVN 11823-4, Bảng 12: 0,36 + S/7600',
        f: () => F.gV1,
      });
      out.push({
        g: G,
        t,
        q: 'gV, hai làn trở lên',
        u: '',
        ref: 0.2 + S / 3600 - (S / 10700) ** 2,
        tol: R(0.001),
        src: 'Tính lại độc lập: TCVN 11823-4, Bảng 12: 0,2 + S/3600 - (S/10700)²',
        f: () => F.gV2,
      });
    }

    // Dầm: co ngót, từ biến, mất mát ứng suất trước
    if (damG && damG.shr && DAMR.I) {
      const D = damG;
      const I = DAMR.I;
      const sh = D.shr!;
      const fci = I.fci;
      const RH = I.RH;
      const ti = I.ti;
      const td = I.td;
      const tf = I.tf;
      const Ep = I.Ep;
      const Eci = D.Eci!;
      const isI = DAMR.type === 'I';
      const khs = 2 - 0.014 * RH;
      const khc = 1.56 - 0.008 * RH;
      const kf = 35 / (7 + fci);
      const ktd = (t: number) => t / ((12 * (100 - 0.58 * fci)) / (0.145 * fci + 20) + t);
      const ks = Math.max(1, 1.45 - 0.0051 * sh.VS);
      const psi = (t: number, tl: number) =>
        1.9 * ks * khc * kf * ktd(t) * Math.pow(tl, -0.118);
      const tc = isFinite(I.tcur) && I.tcur > 0 ? I.tcur : ti;
      const k5 = tc < 5 ? 1.2 : 1;
      const eps = (t: number) => k5 * ks * khs * kf * ktd(t) * 0.48e-3;
      const G =
        'Số liệu đang mở: co ngót, từ biến, mất mát ứng suất trước dầm giữa (' +
        (isI ? 'dầm I căng sau' : 'dầm bản rỗng căng trước') +
        ')';
      const src = 'Tính lại độc lập: TCVN 11823-5, Điều 4.2.3 (PT co ngót, từ biến)';
      const t1 = `RH = ${RH} %, f'ci = ${fci} MPa, ti = ${ti} ngày, bảo dưỡng ${tc} ngày (hệ số co ngót ${k5}), td = ${td} ngày, tf = ${tf} ngày, V/S = ${fx(sh.VS, 1)} mm`;
      (
        [
          ['khs', 'khs', khs],
          ['khc', 'khc', khc],
          ['kf', 'kf', kf],
          ['ks', 'ks', ks],
          ['ktd(td - ti)', 'ktd_di', ktd(td - ti)],
          ['ψb(tf, ti)', 'psi_fi', psi(tf - ti, ti)],
          ['ψb(td, ti)', 'psi_di', psi(td - ti, ti)],
          ['εbid (×10⁻³)', 'eps_bid', eps(td - ti)],
        ] as ReadonlyArray<readonly [string, keyof typeof sh, number]>
      ).forEach(([q, k, v]) =>
        out.push({
          g: G,
          t: t1,
          q,
          u: '',
          ref: k === 'eps_bid' ? v * 1000 : v,
          tol: R(0.001),
          src,
          f: () => (k === 'eps_bid' ? Number(sh[k]) * 1000 : Number(sh[k])),
        }),
      );

      const L = D.Lm!;
      const rows = (D.res || []).filter((r) => (r.Aps ?? 0) > 0);
      const r = rows.reduce<LiveGirderSectionLike | null>(
        (b, q) => (!b || Math.abs(q.x - L / 2) < Math.abs(b.x - L / 2) ? q : b),
        null,
      );
      if (r) {
        const fpy = I.fpyr * I.fpu;
        const t2 = `Mặt cắt x = ${fx(r.x, 3)} m: Aps = ${fx(r.Aps, 1)} mm², e = ${fx(r.e, 1)} mm`;
        const s9 = 'Tính lại độc lập: TCVN 11823-5, Điều 9.5.4.2 (phương pháp chi tiết)';
        if (!isI) {
          const fpj = I.fpjr * I.fpu;
          const Ag = r.Ag!;
          const Ig = r.Ig!;
          const e = r.e!;
          const Aps = r.Aps!;
          const M1 = r.M1! * 1e6;
          let fpt = fpj;
          let fc = 0;
          for (let k = 0; k < 60; k++) {
            const P0 = fpt * Aps;
            fc = P0 / Ag + (P0 * e * e) / Ig - (M1 * e) / Ig;
            fpt = fpj - (Ep / Eci) * fc;
          }
          const dES = fpj - fpt;
          const fpt2 = Math.max(fpt, 0.55 * fpy);
          const dR1 = (fpt2 / 30) * (fpt2 / fpy - 0.55);
          const Kid =
            1 /
            (1 +
              (Ep / Eci) *
                (Aps / Ag) *
                (1 + (Ag * e * e) / Ig) *
                (1 + 0.7 * psi(tf - ti, ti)));
          out.push({
            g: G,
            t: t2,
            q: 'fcgp',
            u: 'MPa',
            ref: fc,
            tol: R(0.001),
            src: 'Tính lại độc lập: TCVN 11823-5, Điều 9.5.2.3.1 (lặp theo fpt sau co ngắn đàn hồi)',
            f: () => r.fcgp ?? NaN,
          });
          out.push({
            g: G,
            t: t2,
            q: 'ΔfpES',
            u: 'MPa',
            ref: dES,
            tol: R(0.001),
            src: 'Tính lại độc lập: TCVN 11823-5, Điều 9.5.2.3.1: ΔfpES = (Ep/Eci).fcgp',
            f: () => r.dES ?? NaN,
          });
          out.push({
            g: G,
            t: t2,
            q: 'Kid',
            u: '',
            ref: Kid,
            tol: R(0.001),
            src: s9,
            f: () => r.Kid ?? NaN,
          });
          out.push({
            g: G,
            t: t2,
            q: 'ΔfpR1',
            u: 'MPa',
            ref: dR1,
            tol: R(0.001),
            src: 'Tính lại độc lập: TCVN 11823-5, Điều 9.5.4.2.3, PT 134: ΔfpR1 = (fpt/KL)(fpt/fpy - 0,55), KL = 30',
            f: () => r.dR1 ?? NaN,
          });
          out.push({
            g: G,
            t: t2,
            q: 'ΔfpSR',
            u: 'MPa',
            ref: eps(td - ti) * Ep * Kid,
            tol: R(0.001),
            src: s9 + ': ΔfpSR = εbid.Ep.Kid',
            f: () => r.dSR ?? NaN,
          });
          out.push({
            g: G,
            t: t2,
            q: 'ΔfpCR',
            u: 'MPa',
            ref: (Ep / Eci) * fc * psi(td - ti, ti) * Kid,
            tol: R(0.001),
            src: s9 + ': ΔfpCR = (Ep/Eci).fcgp.ψb(td, ti).Kid',
            f: () => r.dCR ?? NaN,
          });
        } else if (D.ES) {
          const E = D.ES;
          const P = E.P * 1e3;
          const fcES = P / E.A1 + (P * E.e * E.e) / E.I1 - (E.M1 * 1e6 * E.e) / E.I1;
          out.push({
            g: G,
            t: `Co ngắn đàn hồi: ${E.N} bó cáp kéo lần lượt, P = ${fx(E.P, 1)} kN, e = ${fx(E.e, 1)} mm`,
            q: 'ΔfpES',
            u: 'MPa',
            ref: ((((E.N - 1) / (2 * E.N)) * Ep) / Eci) * fcES,
            tol: R(0.001),
            src: 'Tính lại độc lập: TCVN 11823-5, Điều 9.5.2.3.2: ΔfpES = (N - 1)/(2N).(Ep/Eci).fcgp',
            f: () => E.dES,
          });
          const fpt = r.fpt!;
          out.push({
            g: G,
            t: t2,
            q: 'ΔfpR1',
            u: 'MPa',
            ref: (fpt / 30) * (fpt / fpy - 0.55),
            tol: R(0.001),
            src: 'Tính lại độc lập: TCVN 11823-5, Điều 9.5.4.2.3, PT 134: ΔfpR1 = (fpt/KL)(fpt/fpy - 0,55), KL = 30',
            f: () => r.dR1 ?? NaN,
          });
          out.push({
            g: G,
            t: t2,
            q: 'ΔfpSR',
            u: 'MPa',
            ref: eps(td - ti) * Ep * (r.Kid ?? NaN),
            tol: R(0.001),
            src: s9 + ': ΔfpSR = εbid.Ep.Kid',
            f: () => r.dSR ?? NaN,
          });
          out.push({
            g: G,
            t: t2,
            q: 'ΔfpCR',
            u: 'MPa',
            ref: (Ep / Eci) * (r.fcgp ?? NaN) * psi(td - ti, ti) * (r.Kid ?? NaN),
            tol: R(0.001),
            src: s9 + ': ΔfpCR = (Ep/Eci).fcgp.ψb(td, ti).Kid',
            f: () => r.dCR ?? NaN,
          });
        }
      }
    }
  }

  // 5. Gối chất dẻo cốt bản thép (`SUP2R.gc`)
  const SUP2R = getLatestSup2Result();
  if (SUP2R && SUP2R.gc && 'C' in SUP2R.gc && SUP2R.gc.C && DAMR?.I) {
    const g = SUP2R.gc as GcCalcResult;
    const C = g.C!;
    const I = DAMR.I;
    const Gm = C.G * (1 - C.tol);
    const Si = (C.L * C.W) / (2 * C.hri * (C.L + C.W));
    const hrt = C.n * C.hri + 2 * C.hc;
    const ne = C.n + (C.hc >= C.hri / 2 ? 1 : 0);
    const Lb = C.Lexp ? C.Lexp - I.a0 * 1000 : (I.Lt - 2 * I.a0) * 500;
    const dT = I.alpha * (C.Tmax - C.Tmin) * Lb;
    const Ds = 0.65 * dT + C.eSh * Lb;
    const G = 'Số liệu đang mở: gối chất dẻo cốt bản thép (phương pháp B)';
    const src = 'Tính lại độc lập: TCVN 11823-14, Điều 7.5.3';
    const t0 = `Gối ${C.L}×${C.W} mm, ${C.n} lớp hri = ${C.hri} mm, hc = ${C.hc} mm, G = ${C.G} MPa (Gmin = ${fx(Gm, 3)})`;
    out.push({ g: G, t: t0, q: 'Si', u: '', ref: Si, tol: R(0.001), src: 'Si = LW/(2hri(L + W))', f: () => g.Si });
    out.push({ g: G, t: t0, q: 'hrt', u: 'mm', ref: hrt, tol: R(0.001), src: 'hrt = n.hri + 2hc', f: () => g.hrt });
    out.push({
      g: G,
      t: t0,
      q: 'n tính γr',
      u: '',
      ref: ne,
      tol: A(1e-9),
      src: 'TCVN 11823-14, Điều 7.5.3.3: lớp ngoài dày hơn hri/2 được cộng 0,5 mỗi lớp',
      f: () => g.neff,
    });
    out.push({
      g: G,
      t: t0,
      q: 'ΔS',
      u: 'mm',
      ref: Ds,
      tol: R(0.001),
      src: 'TCVN 11823-14, Điều 7.5.3.2: ΔS = 0,65ΔT + co ngót, từ biến',
      f: () => g.Ds,
    });
    (
      [
        ['rg', 'dầm giữa'],
        ['rb', 'dầm biên'],
      ] as const
    ).forEach(([k, nm]) => {
      const q = g[k];
      if (!q) return;
      const t = `Gối dưới ${nm}: σst = ${fx(q.sst, 3)} MPa, σcy = ${fx(q.scy, 3)} MPa, θst = ${fx(q.th_st, 5)}, θcy = ${fx(q.th_cy, 5)} rad`;
      const ga_st = (1.4 * q.sst) / (Gm * Si);
      const ga_cy = (1.4 * q.scy) / (Gm * Si);
      const gr_st = (0.5 * (C.L / C.hri) ** 2 * q.th_st) / ne;
      const gr_cy = (0.5 * (C.L / C.hri) ** 2 * q.th_cy) / ne;
      const gs_st = Ds / hrt;
      const gs_cy = g.Hbr / (Gm * g.A);
      out.push({ g: G, t, q: 'γa,st', u: '', ref: ga_st, tol: R(0.001), src: src + ', PT 43, 44', f: () => q.ga_st });
      out.push({ g: G, t, q: 'γr,st', u: '', ref: gr_st, tol: R(0.001), src: src + ', PT 46, 47', f: () => q.gr_st });
      out.push({ g: G, t, q: 'γs,st', u: '', ref: gs_st, tol: R(0.001), src: src + ', PT 50 (ΔS/hrt)', f: () => q.gs_st });
      out.push({
        g: G,
        t,
        q: 'Σ = st + 1,75cy',
        u: '',
        ref: ga_st + gr_st + gs_st + 1.75 * (ga_cy + gr_cy + gs_cy),
        tol: R(0.001),
        src: src + ', PT 41',
        f: () => q.sum,
      });
      const Aa = (1.92 * hrt) / C.L / Math.sqrt(1 + (2 * C.L) / C.W);
      const Bb = 2.67 / ((Si + 2) * (1 + C.L / (4 * C.W)));
      out.push({ g: G, t, q: 'A (ổn định)', u: '', ref: Aa, tol: R(0.001), src: 'TCVN 11823-14, Điều 7.5.3.4, PT 59', f: () => q.st1.A });
      out.push({ g: G, t, q: 'B (ổn định)', u: '', ref: Bb, tol: R(0.001), src: 'TCVN 11823-14, Điều 7.5.3.4, PT 60', f: () => q.st1.B });
      out.push({
        g: G,
        t,
        q: 'hs yêu cầu, sử dụng',
        u: 'mm',
        ref: (3 * Math.max(C.hri, C.hc) * (q.sst + q.scy)) / C.Fy,
        tol: R(0.001),
        src: 'TCVN 11823-14, Điều 7.5.3.5, PT 63',
        f: () => q.hs1,
      });
      out.push({
        g: G,
        t,
        q: 'hs yêu cầu, mỏi',
        u: 'mm',
        ref: (2 * Math.max(C.hri, C.hc) * q.scy) / C.dFTH,
        tol: R(0.001),
        src: 'AASHTO LRFD 7th Ed., PT 14.7.5.3.5-2 (hệ số 2,0; bản in TCVN 11823-14 PT 64 ghi 3 là sai)',
        f: () => q.hs2,
      });
    });
  }

  // 6. Bản mặt cầu: dải tương đương (`SUP2R.bm`)
  if (SUP2R && SUP2R.bm && DAMR && DAMR.I) {
    const b = SUP2R.bm;
    const S = DAMR.I.S * 1000;
    const G = 'Số liệu đang mở: bản mặt cầu - bề rộng dải tương đương';
    const t = `Khoảng cách dầm S = ${fx(S, 0)} mm`;
    out.push({
      g: G,
      t,
      q: 'dải mômen dương',
      u: 'm',
      ref: (660 + 0.55 * S) / 1000,
      tol: R(0.001),
      src: 'Tính lại độc lập: TCVN 11823-4, Bảng 3: 660 + 0,55S',
      f: () => b.E1,
    });
    out.push({
      g: G,
      t,
      q: 'dải mômen âm',
      u: 'm',
      ref: (1220 + 0.25 * S) / 1000,
      tol: R(0.001),
      src: 'Tính lại độc lập: TCVN 11823-4, Bảng 3: 1220 + 0,25S',
      f: () => b.E2,
    });
  }

  // 7. Khe co giãn (`KCGR`)
  const KCGR = getLatestKcgResult();
  if (KCGR && KCGR.P) {
    const k = KCGR;
    const P = KCGR.P;
    const Lt = k.Lt * 1000;
    const dT = P.Tmax - P.Tmin;
    const Dt = P.a * dT * Lt;
    const Dsh = P.mu * P.b * Lt;
    const G = 'Số liệu đang mở: khe co giãn - chuyển vị';
    const src =
      'Tính lại độc lập: TCVN 11823-3, Điều 11.2 (ΔT = α.L.(Tmax - Tmin)); co ngót, từ biến = μ.εsh.L';
    const t = `Chiều dài giãn nở L = ${fx(k.Lt, 3)} m, α = ${P.a}, Tmax = ${P.Tmax}, Tmin = ${P.Tmin}, Tlắp = ${P.Tins} °C`;
    out.push({ g: G, t, q: 'ΔT nhiệt', u: 'mm', ref: Dt, tol: R(0.001), src, f: () => k.Dt });
    out.push({ g: G, t, q: 'co ngót, từ biến', u: 'mm', ref: Dsh, tol: R(0.001), src, f: () => k.Dsh });
    out.push({
      g: G,
      t,
      q: 'khe khép lại (từ lúc lắp)',
      u: 'mm',
      ref: (Dt * (P.Tmax - P.Tins)) / dT,
      tol: R(0.001),
      src: 'Theo nhiệt độ lắp đặt: Dt.(Tmax - Tlắp)/(Tmax - Tmin)',
      f: () => k.D1,
    });
    out.push({
      g: G,
      t,
      q: 'khe mở ra (từ lúc lắp)',
      u: 'mm',
      ref: (Dt * (P.Tins - P.Tmin)) / dT + Dsh,
      tol: R(0.001),
      src: 'Dt.(Tlắp - Tmin)/(Tmax - Tmin) + co ngót, từ biến',
      f: () => k.D2,
    });
  }

  // 8. Mố: áp lực đất (`MOR`)
  const MOR = getLatestMorResult();
  if (MOR && MOR.K) {
    let I: ReturnType<typeof moInputs> | null = null;
    try {
      I = moInputs();
    } catch {
      I = null;
    }
    if (I && isFinite(I.phi)) {
      const r = (x: number) => (x * Math.PI) / 180;
      const f = I.phi;
      const d = I.del;
      const b = I.beta;
      const th = I.theta;
      const G = 'Số liệu đang mở: mố - áp lực đất';
      const t = `φ = ${f}°, δ = ${d}°, β = ${b}°, θ = ${th}°`;
      const Gm =
        (1 +
          Math.sqrt(
            (Math.sin(r(f + d)) * Math.sin(r(f - b))) /
              (Math.sin(r(th - d)) * Math.sin(r(th + b))),
          )) **
        2;
      const ka = Math.sin(r(th + f)) ** 2 / (Gm * Math.sin(r(th)) ** 2 * Math.sin(r(th - d)));
      out.push({
        g: G,
        t,
        q: 'ka (Coulomb)',
        u: '',
        ref: ka,
        tol: R(0.001),
        src: 'Tính lại độc lập: TCVN 11823-3, Điều 11.5.3',
        f: () => MOR.K.KA.K,
      });
      out.push({
        g: G,
        t,
        q: "k0 = 1 - sinφ'",
        u: '',
        ref: 1 - Math.sin(r(f)),
        tol: R(0.001),
        src: 'TCVN 11823-3, Điều 11.5.1',
        f: () => MOR.K.K0,
      });
      const heq = (H: number) =>
        H <= 1.5
          ? 1.2
          : H <= 3
            ? 1.2 - ((H - 1.5) / 1.5) * 0.3
            : H <= 6
              ? 0.9 - ((H - 3) / 3) * 0.3
              : 0.6;
      (['A', 'B', 'C'] as const).forEach((S) => {
        const L = MOR.LSs[S];
        if (!L) return;
        out.push({
          g: G,
          t: `Hoạt tải chất thêm, mặt cắt ${S}: H = ${fx(L.H, 3)} m`,
          q: 'heq',
          u: 'm',
          ref: heq(L.H),
          tol: A(0.0005),
          src: 'Tính lại độc lập: TCVN 11823-3, Bảng 22 (1,2 m khi H ≤ 1,5 m; 0,9 m khi H = 3 m; 0,6 m khi H ≥ 6 m, nội suy)',
          f: () => L.he,
        });
      });
      const E = MOR.EQ;
      if (E && isFinite(E.KAE)) {
        const ps = E.psi;
        const bw = 90 - th;
        const i = b;
        const num = Math.sin(r(f + d)) * Math.sin(r(f - ps - i));
        const den = Math.cos(r(d + bw + ps)) * Math.cos(r(i - bw));
        const kae =
          Math.cos(r(f - ps - bw)) ** 2 /
          (Math.cos(r(ps)) *
            Math.cos(r(bw)) ** 2 *
            Math.cos(r(d + bw + ps)) *
            (1 + Math.sqrt(Math.max(0, num / den))) ** 2);
        out.push({
          g: G,
          t: t + `, ψ = ${fx(ps, 3)}°`,
          q: 'KAE (Mononobe - Okabe)',
          u: '',
          ref: kae,
          tol: R(0.002),
          src: 'Tính lại độc lập: TCVN 11823-11, Phụ lục A (Mononobe - Okabe)',
          f: () => E.KAE,
        });
      }
    }
  }

  // 9–10. Thủy văn: lưu lượng TCVN 9845, Manning
  if ($('hv_F')) {
    let H: HvCalcResult | null = null;
    try {
      H = hvCalc(hvIn());
    } catch {
      H = null;
    }
    const q = H && H.Q && H.Q[H.Pd] && H.Q[H.Pd].t;
    if (H && q) {
      const I = H.I;
      const G = 'Số liệu đang mở: thủy văn - lưu lượng thiết kế theo TCVN 9845';
      const t = `F = ${I.F} km², L = ${I.L} km, Σl = ${I.sl} km, Jls = ${fx(H.Jls, 2)} ‰, Jsd = ${I.Jsd} ‰, φ = ${q.phi}, HP = ${fx(q.Hp, 2)} mm`;
      const B = I.two ? I.F / (2 * I.L) : I.F / I.L;
      const Lsd = (1000 * I.F) / ((I.two ? 1.8 : 0.9) * (I.L + I.sl));
      const pH = q.phi * q.Hp;
      const psd = Math.pow(Lsd, 0.6) / (I.msd * Math.pow(I.Jsd, 0.3) * Math.pow(pH, 0.4));
      const pls =
        (1000 * I.L) /
        (I.mls * Math.pow(H.Jls, 1 / 3) * Math.pow(I.F, 0.25) * Math.pow(pH, 0.25));
      out.push({
        g: G,
        t,
        q: 'HP = X̄.KP',
        u: 'mm',
        ref: H.Xm * (1 + HV.phiP(H.Pd, H.Cs) * H.Cv),
        tol: R(0.001),
        src: 'Tính lại: HP = X̄(1 + Φ.Cv), đường tần suất Pearson III',
        f: () => q.Hp,
      });
      out.push({ g: G, t, q: 'B', u: 'km', ref: B, tol: R(0.001), src: 'TCVN 9845, PT 2, 3', f: () => q.B });
      out.push({ g: G, t, q: 'Lsd', u: 'm', ref: Lsd, tol: R(0.001), src: 'TCVN 9845, PT 1', f: () => q.Lsd });
      out.push({ g: G, t, q: 'φsd', u: '', ref: psd, tol: R(0.001), src: 'TCVN 9845, PT 9', f: () => q.phisd });
      if (!q.noCh) {
        out.push({ g: G, t, q: 'φls', u: '', ref: pls, tol: R(0.001), src: 'TCVN 9845, PT 10', f: () => q.phils });
      }
      out.push({
        g: G,
        t,
        q: 'QP = AP.φ.HP.F.δ',
        u: 'm³/s',
        ref: q.Ap * q.phi * q.Hp * I.F * q.delta,
        tol: R(0.001),
        src: 'TCVN 9845, PT 8 (AP tra Bảng A.3)',
        f: () => q.Q,
      });
    }
    if (H && H.o && H.o.parts) {
      const Hcur = H;
      const G = 'Số liệu đang mở: thủy văn - lưu lượng qua mặt cắt (Manning)';
      const i = Hcur.I.i;
      Hcur.o.parts.forEach((p) =>
        out.push({
          g: G,
          t: `${p.n} tại mực nước H = ${fx(Hcur.o.H, 3)} m: A = ${fx(p.A, 3)} m², h tính = ${fx(p.hr, 3)} m, n = ${p.nn}`,
          q: 'Q',
          u: 'm³/s',
          ref: (p.A / p.nn) * Math.pow(p.hr, 2 / 3) * Math.sqrt(i),
          tol: R(0.001),
          src: `Manning: Q = (1/n).A.h^(2/3).i^(1/2), i = ${i}`,
          f: () => p.Q,
        }),
      );
      out.push({
        g: G,
        t: `Tổng mặt cắt tại H = ${fx(Hcur.o.H, 3)} m`,
        q: 'Q',
        u: 'm³/s',
        ref: Hcur.o.parts.reduce((s, p) => s + p.Q, 0),
        tol: R(0.001),
        src: 'Tổng các phần lòng chủ, bãi',
        f: () => Hcur.o.Q,
      });
    }
  }

  // 11. Tường chắn trọng lực (`TCR`)
  const TCR = getLatestTcResult();
  if (TCR && TCR.Ld && TCR.Ld.w0 && isFinite(TCR.coul)) {
    const T = TCR;
    const I = T.I;
    const G = 'Số liệu đang mở: tường chắn - áp lực đất';
    out.push({
      g: G,
      t: `φ = ${I.phi}°, δ = ${I.delta}°, lưng tường nghiêng ${fx(T.Ld.w0.theta, 2)}° so với phương ngang`,
      q: 'ka (lăng thể thử dần)',
      u: '',
      ref: T.coul,
      tol: R(0.005),
      src: 'So với công thức Coulomb (TCVN 11823-3, Điều 11.5.3) với cùng hình học',
      f: () => T.Ld.w0.Ka,
    });
  }

  // 12. Cống hộp (`CHR`)
  const CHR = getLatestChResult();
  if (CHR && CHR.A && CHR.A.o && CHR.I) {
    const o = CHR.A.o;
    const I = CHR.I;
    const G = 'Số liệu đang mở: cống hộp - tải trọng đất, hoạt tải qua lớp đất đắp';
    const Hph = I.hma + I.hmo + I.hs;
    const H = Hph * 1000;
    const Di = I.B * 1000;
    const LL = o.LLDF;
    const t = `Đất đắp trên cống H = ${fx(Hph, 3)} m, Bc = ${fx(o.Bc, 3)} m, γs = ${I.gs} kN/m³, φ = ${I.phi}°`;
    const Fe = Math.min(1 + (0.2 * Hph) / o.Bc, I.Fecap);
    out.push({
      g: G,
      t,
      q: 'Fe',
      u: '',
      ref: Fe,
      tol: R(0.001),
      src: 'Tính lại độc lập: TCVN 11823-12, Điều 11.2.2.1: Fe = 1 + 0,2H/Bc ≤ giới hạn',
      f: () => o.Fe,
    });
    out.push({
      g: G,
      t,
      q: 'áp lực đất đứng EV',
      u: 'kN/m²',
      ref: Fe * I.gs * I.hs,
      tol: R(0.001),
      src: 'EV = Fe.γs.H (lớp đất)',
      f: () => o.EV,
    });
    out.push({
      g: G,
      t,
      q: 'k0',
      u: '',
      ref: 1 - Math.sin((I.phi * Math.PI) / 180),
      tol: R(0.001),
      src: 'TCVN 11823-3, Điều 11.5.1',
      f: () => o.k0,
    });
    out.push({
      g: G,
      t,
      q: 'IM (kết cấu vùi)',
      u: '%',
      ref: Math.max(0, 33 * (1 - 4.1e-4 * H)),
      tol: R(0.001),
      src: 'TCVN 11823-3, Điều 6.2.2: IM = 33(1 - 4,1.10⁻⁴DE) ≥ 0',
      f: () => o.IM,
    });
    if (!o.strip) {
      const Hi = (1800 - 510 - 0.06 * Di) / LL;
      const ti = H >= Hi;
      out.push({
        g: G,
        t,
        q: 'bề rộng vệt bánh tại đỉnh cống',
        u: 'mm',
        ref: ti ? 510 + 1800 + LL * H + 0.06 * Di : 510 + LL * H + 0.06 * Di,
        tol: R(0.001),
        src: 'TCVN 11823-3, Điều 6.1.2.6: ww = wt + LLDF.H + 0,06Di (cộng khoảng cách bánh khi hai vệt chồng nhau)',
        f: () => Number(o.Ww ?? 0),
      });
      out.push({
        g: G,
        t,
        q: 'chiều dài vệt bánh',
        u: 'mm',
        ref: 250 + LL * H,
        tol: R(0.001),
        src: 'TCVN 11823-3, Điều 6.1.2.6: lw = lt + LLDF.H',
        f: () => o.Lw0,
      });
    }
  }

  // 13. Cống tròn (`CTR`)
  const CTR = getLatestCtResult();
  if (CTR && CTR.A && CTR.A.o && CTR.I) {
    const o = CTR.A.o;
    const I = CTR.I;
    const G = 'Số liệu đang mở: cống tròn - tải trọng, thiết kế gián tiếp';
    const T_MAP: Record<number, readonly [number, number]> = {
      1: [1.35, 0.45],
      2: [1.4, 0.4],
      3: [1.4, 0.37],
      4: [1.45, 0.3],
    };
    const T = T_MAP[I.inst] || [1.35, 0.45];
    const t = `Cống D = ${I.D0} m, kiểu lắp đặt ${I.inst}, đất đắp H = ${fx(o.Hph, 3)} m`;
    out.push({
      g: G,
      t,
      q: 'VAF',
      u: '',
      ref: T[0],
      tol: A(1e-9),
      src: 'TCVN 11823-12, Bảng hệ số tải trọng đứng, ngang theo kiểu lắp đặt (AASHTO Bảng 12.10.2.1-1)',
      f: () => o.VAF,
    });
    out.push({ g: G, t, q: 'HAF', u: '', ref: T[1], tol: A(1e-9), src: 'như trên', f: () => o.HAF });
    out.push({
      g: G,
      t,
      q: 'WE = VAF × tải lăng trụ',
      u: 'kN/m',
      ref: T[0] * o.PLev,
      tol: R(0.001),
      src: 'TCVN 11823-12, Điều 10.2.4.1 (AASHTO PT 12.10.2.1-1)',
      f: () => o.WEV,
    });
    out.push({
      g: G,
      t,
      q: 'IM (kết cấu vùi)',
      u: '%',
      ref: Math.max(0, 33 * (1 - 4.1e-4 * o.DE)),
      tol: R(0.001),
      src: 'TCVN 11823-3, Điều 6.2.2',
      f: () => o.IM,
    });
    const N = CTR.IN;
    if (N && N.Si) {
      out.push({
        g: G,
        t: `Thiết kế gián tiếp: WE = ${fx(N.WE, 2)}, WF = ${fx(N.WF, 2)}, WL = ${fx(N.WL, 2)} kN/m; BFE = ${fx(N.BFE, 3)}, BFLL = ${fx(N.BFLL, 3)}`,
        q: 'tải D',
        u: 'kN/m/m',
        ref: (N.fac * ((N.WE + N.WF) / N.BFE + N.WL / N.BFLL)) / (N.Si / 1000),
        tol: R(0.001),
        src: 'TCVN 11823-12, Điều 10.4.3.1: D = (F.S./Si)[(WE + WF)/BFE + WL/BFLL]',
        f: () => N.D,
      });
    }
  }

  // 14. Bản quá độ (`QDR`)
  const QDR = getLatestQdResult();
  if (QDR && QDR.I && QDR.Hc != null) {
    const R0 = QDR;
    const I = R0.I;
    const G = 'Số liệu đang mở: bản quá độ - tải trọng';
    const Fe = Math.min(1.15, 1 + (0.2 * R0.Hc) / R0.Ltt);
    const t = `Ltt = ${fx(R0.Ltt, 3)} m, chiều dày lớp phủ và đất trên bản Hc = ${fx(R0.Hc, 3)} m`;
    out.push({
      g: G,
      t,
      q: 'Fe',
      u: '',
      ref: Fe,
      tol: R(0.001),
      src: 'Tính lại độc lập: TCVN 11823-12, Điều 11.2.2.1',
      f: () => R0.Fe,
    });
    out.push({
      g: G,
      t,
      q: 'IM',
      u: '%',
      ref: Math.max(0, 33 * (1 - 4.1e-4 * R0.Hc * 1000)),
      tol: R(0.001),
      src: 'TCVN 11823-3, Điều 6.2.2',
      f: () => R0.IM,
    });
    out.push({
      g: G,
      t,
      q: 'EV',
      u: 'kN/m²',
      ref: Fe * I.gs * I.hs,
      tol: R(0.001),
      src: 'EV = Fe.γs.hs',
      f: () => R0.EV,
    });
    out.push({
      g: G,
      t,
      q: 'DC bản',
      u: 'kN/m²',
      ref: I.gc * I.h,
      tol: R(0.001),
      src: 'DC = γc.h',
      f: () => R0.DC,
    });
  }

  // 15. Bản liên tục nhiệt (`LTNR`)
  const LTNR = getLatestLtnResult();
  if (LTNR && LTNR.rg && LTNR.P) {
    const L0 = LTNR;
    const P = L0.P!;
    const r = L0.rg;
    const G = 'Số liệu đang mở: bản liên tục nhiệt';
    const wc = P.fc <= 35 ? 2320 : 2240 + 2.29 * P.fc;
    const Esl = 0.0017 * wc * wc * Math.pow(P.fc, 0.33);
    const Isl = (1000 * P.h ** 3) / 12;
    const k2 = (2 * Esl * Isl) / P.Lc;
    out.push({
      g: G,
      t: `Bản h = ${P.h} mm, f'c = ${P.fc} MPa, chiều dài tách dính Lc = ${P.Lc} mm`,
      q: 'k = 2EI/Lc',
      u: 'kN.m/rad',
      ref: k2 / 1e6,
      tol: R(0.001),
      src: 'Tính lại độc lập: Ec theo TCVN 11823-5, Điều 4.2.4; bản làm việc như dầm hai đầu ngàm đàn hồi',
      f: () => L0.k2 / 1e6,
    });
    let tv = 0;
    const th = (Pk: number, a: number): number =>
      a <= 0 || a >= r.L ? 0 : (Pk * a * (r.L * r.L - a * a)) / (6 * r.EI * r.L);
    (
      [
        [
          [0, 35],
          [4.3, 145],
          [8.6, 145],
        ],
        [
          [0, 145],
          [4.3, 145],
          [8.6, 35],
        ],
        [
          [0, 110],
          [1.2, 110],
        ],
      ] as const
    ).forEach((v) => {
      for (let p0 = -9; p0 <= r.L; p0 += 0.005) {
        tv = Math.max(
          tv,
          v.reduce((s, [o, Pk]) => s + th(Pk, p0 + o), 0),
        );
      }
    });
    const tt = `Dầm giữa Ltt = ${fx(r.L, 3)} m, EI = ${fx(r.EI / 1e12, 4)}.10¹² kN.mm²`;
    out.push({
      g: G,
      t: tt,
      q: 'góc xoay đầu dầm do xe',
      u: 'rad',
      ref: tv,
      tol: R(0.002),
      src: 'Tính lại độc lập: θ = P.a(L² - a²)/(6EIL), xe tải và xe hai trục chạy dọc nhịp',
      f: () => r.tv,
    });
    out.push({
      g: G,
      t: tt,
      q: 'góc xoay do tải làn',
      u: 'rad',
      ref: (9.3 * r.L ** 3) / (24 * r.EI),
      tol: R(0.001),
      src: 'θ = wL³/(24EI), w = 9,3 kN/m',
      f: () => r.tl,
    });
  }

  // 16. Gờ lan can: đường chảy dẻo (`GLCR`)
  const GLCR = getLatestGlcResult();
  if (GLCR && GLCR.Lt) {
    const g = GLCR;
    const H = g.H;
    const Lt = g.Lt;
    const Mw = g.Mw;
    const Mb = g.Mb || 0;
    const Mc = g.McU;
    const G = 'Số liệu đang mở: gờ lan can - phân tích đường chảy dẻo';
    const t = `Gờ hiện tại: H = ${fx(H, 0)} mm, Lt = ${fx(Lt, 0)} mm, Mw = ${fx((Mw * H) / 1e6, 2)} kN.m, Mc = ${fx(Mc / 1e3, 2)} kN.m/m`;
    const src = 'Tính lại độc lập: TCVN 11823-13, Phụ lục A, Điều A3.1';
    const LcI = Lt / 2 + Math.sqrt((Lt / 2) ** 2 + (8 * H * (Mb + Mw * H)) / Mc);
    const RwI = (2 / (2 * LcI - Lt)) * (8 * Mb + 8 * Mw * H + (Mc * LcI * LcI) / H);
    const LcE = Lt / 2 + Math.sqrt((Lt / 2) ** 2 + (H * (Mb + Mw * H)) / Mc);
    const RwE = (2 / (2 * LcE - Lt)) * (Mb + Mw * H + (Mc * LcE * LcE) / H);
    out.push({ g: G, t, q: 'Lc - đoạn giữa', u: 'mm', ref: LcI, tol: R(0.001), src, f: () => g.LcI });
    out.push({ g: G, t, q: 'Rw - đoạn giữa', u: 'kN', ref: RwI / 1e3, tol: R(0.001), src, f: () => g.RwI / 1e3 });
    out.push({ g: G, t, q: 'Lc - đầu gờ, khe nối', u: 'mm', ref: LcE, tol: R(0.001), src, f: () => g.LcE });
    out.push({ g: G, t, q: 'Rw - đầu gờ, khe nối', u: 'kN', ref: RwE / 1e3, tol: R(0.001), src, f: () => g.RwE / 1e3 });
  }

  return out;
}

function evalChecks(checks: readonly VerificationCheck[]): VerificationCheckResult[] {
  return checks.map((c) => {
    let v = NaN;
    let err = '';
    try {
      v = +c.f();
    } catch (e) {
      err = e instanceof Error ? e.message : String(e);
    }
    const d = v - c.ref;
    const lim = c.tol.abs != null ? c.tol.abs : Math.abs(c.ref) * (c.tol.rel ?? 0);
    const ok = !err && Number.isFinite(v) && Math.abs(d) <= lim + 1e-12;
    return { ...c, v, d, rel: c.ref ? d / Math.abs(c.ref) : NaN, lim, ok, err };
  });
}

/** Run all fixed + live checks and return raw check result rows. */
export function run(): VerificationCheckResult[] {
  const liveChecks = live();
  const results = evalChecks([...fixedChecks, ...liveChecks]);
  const passedCount = results.filter((r) => r.ok).length;
  latestVtResult = {
    fixedCount: fixedChecks.length,
    liveCount: liveChecks.length,
    totalCount: results.length,
    passedCount,
    failedCount: results.length - passedCount,
    results,
  };
  return results;
}

/** Run all checks and return the structured `VerificationSuiteResult` summary. */
export function runSuite(): VerificationSuiteResult {
  run();
  return latestVtResult!;
}

export const VT = {
  C: fixedChecks as readonly VerificationCheck[],
  live,
  run,
  runSuite,
  hl93,
} as const;

// ---------------------------------------------------------------------------
// 4. Headless-Safe Renderer & DOM Binding (`vtRender`, `initVerificationDom`)
// ---------------------------------------------------------------------------

/** Render `#vt_tb` and `#vt_sum` in DOM (or virtual output store when headless). */
export function vtRender(): VerificationSuiteResult {
  const suite = runSuite();
  const rs = suite.results;
  const nOK = suite.passedCount;
  const sumHtml = `Tổng số kiểm tra: <b>${rs.length}</b> ; đạt: <b class="ok">${nOK}</b> ; không đạt: <b class="${nOK < rs.length ? 'bad' : 'ok'}">${rs.length - nOK}</b>`;

  const f = (v: number, r: number): string =>
    !Number.isFinite(v)
      ? '-'
      : Math.abs(r) >= 100
        ? fx(v, 2)
        : Math.abs(r) >= 1
          ? fx(v, 4)
          : fx(v, 5);

  const span = (i: number, k: 't' | 'src'): number => {
    let n = 1;
    while (
      i + n < rs.length &&
      rs[i + n].g === rs[i].g &&
      rs[i + n][k] === rs[i][k] &&
      (k === 't' || rs[i + n].t === rs[i].t)
    ) {
      n++;
    }
    return n;
  };

  let g = '';
  let h =
    '<tr><th>Ví dụ</th><th>Đại lượng</th><th>Phần mềm</th><th>Đáp án</th><th>Sai lệch</th><th>Kết quả</th><th>Nguồn đáp án</th></tr>';
  rs.forEach((r, i) => {
    if (r.g !== g) {
      g = r.g;
      h += `<tr class="grp"><td colspan="7">${g}</td></tr>`;
    }
    const dv = r.err
      ? r.err
      : r.tol.abs != null
        ? f(r.d, r.ref)
        : Number.isFinite(r.rel)
          ? fx(Math.abs(r.rel) < 5e-6 ? 0 : r.rel * 100, 3) + ' %'
          : '-';
    const p = rs[i - 1];
    const newT = !p || p.g !== r.g || p.t !== r.t;
    const newS = newT || p.src !== r.src;
    h += `<tr>${newT ? `<td class="l" rowspan="${span(i, 't')}">${r.t}</td>` : ''}<td class="c">${r.q}${r.u ? ' (' + r.u + ')' : ''}</td><td>${f(r.v, r.ref)}</td><td>${f(r.ref, r.ref)}</td><td>${dv}</td><td class="c ${r.ok ? 'ok' : 'bad'}">${r.ok ? 'Đạt' : 'Không đạt'}</td>${newS ? `<td class="l small" rowspan="${span(i, 'src')}">${r.src}</td>` : ''}</tr>`;
  });

  const tb = $('vt_tb');
  const sm = $('vt_sum');
  if (sm) sm.innerHTML = sumHtml;
  if (tb) tb.innerHTML = h;

  return suite;
}

/** Attach `#vt_run` and tab `60` click delegation in browser/jsdom environments. */
export function initVerificationDom(): () => void {
  if (typeof document === 'undefined') return () => {};
  const handler = (e: Event) => {
    const target = e.target as Element | null;
    const b = target && typeof target.closest === 'function'
      ? target.closest('.tabs .tab[data-t="60"],#vt_run')
      : null;
    if (b) setTimeout(vtRender, 60);
  };
  document.addEventListener('click', handler);
  return () => document.removeEventListener('click', handler);
}

// Re-export `getOutputValue` convenience reference if needed by external checks
export { getOutputValue };
