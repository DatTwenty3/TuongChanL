/**
 * Kiểm toán mặt đường cứng BTXM thông thường theo TCCS 39:2022/TCĐBVN (Điều 8, Phụ lục A, B).
 *
 * Phần tính tấm dùng lại engine đã đối chiếu ví dụ Phụ lục B ở `src/pavement/engine/tccs39.ts`
 * (không viết trùng công thức). File này bổ sung: bảng tra theo tiêu chuẩn (Bảng 9, 10, 11,
 * Điều 8.2.3, 8.2.8, 8.3.1), nối dữ liệu từ dự án (E0 từ mục Đất nền), các điều kiện kiểm toán
 * (6), (7), (8) và khe nối (Điều 6).
 */
import {
  calcDrain,
  calcJoint,
  calcRigid,
  computeNe,
  findMinHc,
  type NeSummary,
} from '../../pavement/engine/tccs39';
import type {
  DrainResult,
  JointInput,
  JointResult,
  RigidInput,
  RigidResult,
  RigidTrafficInputs,
} from '../../pavement/engine/types';
import type {
  ProjectState,
  RigidAggregate,
  RigidDrainData,
  RigidProjectData,
  RigidRegion,
  RigidRoadClass,
  RigidShoulder,
} from '../types/project';
import { resolveSubgrade } from './subgrade';

export type { NeSummary };

export const RIGID_ROAD_CLASS_OPTIONS: ReadonlyArray<{
  value: RigidRoadClass;
  label: string;
}> = [
  { value: 'CAO_TOC', label: 'Đường cao tốc' },
  { value: 'CAP_I_II', label: 'Đường cấp I, cấp II' },
  { value: 'CAP_III', label: 'Đường cấp III' },
  { value: 'CAP_IV', label: 'Đường cấp IV trở xuống' },
];

export const RIGID_REGION_OPTIONS: ReadonlyArray<{ value: RigidRegion; label: string }> = [
  { value: 'BAC', label: 'Miền Bắc (Tg = 86 °C/m)' },
  { value: 'TRUNG', label: 'Miền Trung (Tg = 86–92 °C/m)' },
  { value: 'NAM', label: 'Miền Nam (Tg = 92 °C/m)' },
];

export const RIGID_AGGREGATE_OPTIONS: ReadonlyArray<{
  value: RigidAggregate;
  label: string;
}> = [
  { value: 'SILIC', label: 'Đá silic' },
  { value: 'SA_THACH', label: 'Sa thạch' },
  { value: 'CUOI_SOI', label: 'Cuội sỏi' },
  { value: 'GRANIT', label: 'Granit' },
  { value: 'DA_VOI', label: 'Đá vôi' },
];

export const RIGID_SHOULDER_OPTIONS: ReadonlyArray<{
  value: RigidShoulder;
  label: string;
}> = [
  { value: 'BTXM_BANG', label: 'Lề BTXM cùng chiều dày với phần xe chạy (kr = 0,87)' },
  { value: 'BTXM_MONG', label: 'Lề BTXM mỏng hơn (kr = 0,92)' },
  { value: 'MEM', label: 'Lề mềm — bê tông nhựa hoặc lề đất (kr = 1,00)' },
];

/** Bảng 10 — hệ số dãn nở nhiệt αc (1/°C). */
export const ALPHA_C_BY_AGGREGATE: Record<RigidAggregate, number> = {
  SILIC: 12e-6,
  SA_THACH: 12e-6,
  CUOI_SOI: 11e-6,
  GRANIT: 10e-6,
  DA_VOI: 7e-6,
};

/** Điều 8.2.8 — gradien nhiệt lớn nhất Tg (°C/m). */
export const TG_BY_REGION: Record<RigidRegion, number> = { BAC: 86, TRUNG: 89, NAM: 92 };

/** Điều 8.3.1 — hệ số tổng hợp kc theo cấp hạng đường. */
export const KC_BY_CLASS: Record<RigidRoadClass, number> = {
  CAO_TOC: 1.15,
  CAP_I_II: 1.1,
  CAP_III: 1.05,
  CAP_IV: 1.0,
};

/** Điều 8.3.1 — hệ số triết giảm ứng suất kr theo kết cấu lề. */
export const KR_BY_SHOULDER: Record<RigidShoulder, number> = {
  BTXM_BANG: 0.87,
  BTXM_MONG: 0.92,
  MEM: 1.0,
};

/** Bảng 9 — khoảng hệ số độ tin cậy thiết kế γr và độ tin cậy yêu cầu. */
export const GAMMA_R_BY_CLASS: Record<
  RigidRoadClass,
  { min: number; max: number; reliability: string; years: string }
> = {
  CAO_TOC: { min: 1.33, max: 1.5, reliability: '95', years: '30' },
  CAP_I_II: { min: 1.16, max: 1.23, reliability: '90', years: '20' },
  CAP_III: { min: 1.08, max: 1.13, reliability: '85', years: '15' },
  CAP_IV: { min: 1.04, max: 1.07, reliability: '80–70', years: '10' },
};

/** Điều 8.2.3 — cường độ kéo uốn thiết kế yêu cầu fr (MPa) mặc định theo cấp hạng đường. */
export const FR_BY_CLASS: Record<RigidRoadClass, number> = {
  CAO_TOC: 5.0,
  CAP_I_II: 5.0,
  CAP_III: 4.5,
  CAP_IV: 4.5,
};

/** Bảng 11 — mô đun đàn hồi tính toán của BTXM: [fr (MPa), Ec (GPa)]. */
export const EC_BY_FR_TABLE: ReadonlyArray<readonly [number, number]> = [
  [1.0, 10],
  [1.5, 15],
  [2.0, 18],
  [2.5, 21],
  [3.0, 23],
  [3.5, 25],
  [4.0, 27],
  [4.5, 29],
  [5.0, 31],
  [5.5, 33],
];

/** Tra Bảng 11 (nội suy tuyến tính theo fr), trả MPa. */
export function ecFromFr(fr: number): number {
  const t = EC_BY_FR_TABLE;
  if (!Number.isFinite(fr) || fr <= t[0][0]) return t[0][1] * 1000;
  const last = t[t.length - 1];
  if (fr >= last[0]) return last[1] * 1000;
  for (let i = 0; i < t.length - 1; i++) {
    const [x0, y0] = t[i];
    const [x1, y1] = t[i + 1];
    if (fr >= x0 && fr <= x1) {
      return (y0 + ((fr - x0) / (x1 - x0)) * (y1 - y0)) * 1000;
    }
  }
  return last[1] * 1000;
}

/** Giá trị γr gợi ý: cận trên của khoảng Bảng 9 (thiên về an toàn). */
export function suggestGammaR(roadClass: RigidRoadClass): number {
  return GAMMA_R_BY_CLASS[roadClass].max;
}

export function createDefaultRigidProjectData(): RigidProjectData {
  const roadClass: RigidRoadClass = 'CAP_III';
  const input: RigidInput = {
    cap: 'Đường cấp III',
    model: 1,
    caly: 0,
    hc: 0.24,
    L: 4.5,
    B: 3.5,
    fr: FR_BY_CLASS[roadClass],
    Ec: ecFromFr(FR_BY_CLASS[roadClass]),
    muc: 0.15,
    ac: ALPHA_C_BY_AGGREGATE.GRANIT,
    Tg: TG_BY_REGION.BAC,
    Ps: 100,
    Pmax: 150,
    Ne: 2.8e4,
    kr: KR_BY_SHOULDER.BTXM_BANG,
    kc: KC_BY_CLASS[roadClass],
    gr: suggestGammaR(roadClass),
    E0: 40,
    matBound: 'CPĐD gia cố xi măng',
    Eb: 0,
    hb: 0,
    mub: 0.15,
    fbr: 0,
    layers: [{ name: 'CPĐD loại I (móng trên)', E: 300, h: 0.2 }],
  };
  return {
    roadClass,
    region: 'BAC',
    aggregate: 'GRANIT',
    shoulder: 'BTXM_BANG',
    input,
    traffic: {
      adtt: 120,
      fhuong: 0.5,
      flan: 0.6,
      naxle: 6000,
      grow: 6,
      tyear: 15,
      eta: 0.5,
      spec: [
        { P: 60, p: 40 },
        { P: 80, p: 35 },
        { P: 100, p: 20 },
        { P: 120, p: 5 },
      ],
    },
    neAuto: false,
    e0FromSubgrade: false,
    joint: { h: 24, kc: '3.50', mong: 'hat', cap: 'thap', L: 4.5 },
  };
}

export const RIGID_DRAIN_TYPE_OPTIONS: ReadonlyArray<{ value: RigidDrainData['type']; label: string }> = [
  { value: 'KHONG_THAM', label: 'Lớp móng trên không thấm nước — ống thoát nước dọc biên (Điều 7.2)' },
  { value: 'THAM', label: 'Có lớp móng thoát nước (Điều 7.3)' },
];

export const RIGID_TRAFFIC_SCALE_OPTIONS: ReadonlyArray<{ value: RigidDrainData['trafficScale']; label: string }> = [
  { value: 'THUONG', label: 'Dưới cấp nặng' },
  { value: 'NANG', label: 'Cấp nặng' },
  { value: 'RAT_NANG', label: 'Cấp rất nặng trở lên' },
];

export const RIGID_SUBGRADE_SOIL_OPTIONS: ReadonlyArray<{ value: RigidDrainData['subgradeSoil']; label: string }> = [
  { value: 'HAT_MIN', label: 'Vật liệu hạt mịn' },
  { value: 'SET', label: 'Đất loại sét' },
  { value: 'KHAC', label: 'Loại khác' },
];

/** Dữ liệu thoát nước mặc định (Điều 7.1.4: Ic = 0,36 m³/ngày.m; Điều 7.1.3: t ≤ 2 h, Ls ≤ 60 m). */
export function createDefaultRigidDrainData(): RigidDrainData {
  return {
    type: 'THAM',
    Ic: 0.36,
    N: 2,
    nh: 1,
    B: 7.5,
    id: 0.5,
    in_: 2,
    kb: 300,
    ne: 0.15,
    hbt: 0.15,
    tLimit: 2,
    lsLimit: 60,
    pipeDia: 100,
    pipeSlopeLong: 0.5,
    pipeSlopeCross: 5,
    pipeSpacing: 75,
    trafficScale: 'NANG',
    rain: 1500,
    subgradeSoil: 'SET',
    subgradeK: 1,
  };
}

export interface RigidDrainCheck {
  id: string;
  label: string;
  clause: string;
  /** Giá trị tính / nhập (đơn vị ở `unit`). */
  value: number;
  unit: string;
  /** Yêu cầu dạng chữ, ví dụ "≤ 2 h". */
  requirement: string;
  passed: boolean;
}

export interface RigidDrainResult {
  type: RigidDrainData['type'];
  /** Kết quả các công thức (1)–(5) của Điều 7 (calcDrain). */
  calc: DrainResult;
  /** Chiều dài tấm L dùng trong công thức (1) (m). */
  L: number;
  checks: RigidDrainCheck[];
  passed: boolean;
  /** Điều 7.1.2: có bắt buộc bố trí hệ thống thoát nước hay không và lý do. */
  required: boolean;
  requiredReasons: string[];
}

/** Điều 7.1.2 — điều kiện bắt buộc bố trí hệ thống thoát nước. */
export function drainRequirement(
  roadClass: RigidRoadClass,
  d: RigidDrainData,
): { required: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const highClass = roadClass === 'CAO_TOC' || roadClass === 'CAP_I_II' || d.trafficScale === 'RAT_NANG';
  const heavy = d.trafficScale === 'NANG' || d.trafficScale === 'RAT_NANG';
  if (highClass && d.rain > 600 && d.subgradeSoil === 'HAT_MIN' && d.subgradeK < 85) {
    reasons.push(
      `Khoản 1: đường cao tốc, cấp I, II hoặc quy mô rất nặng trở lên; lượng mưa trung bình năm ${d.rain} mm > 600 mm; nền hạt mịn có hệ số thấm ${d.subgradeK} m/ngày < 85 m/ngày.`,
    );
  }
  if (heavy && d.subgradeSoil === 'SET' && d.subgradeK < 3) {
    reasons.push(
      `Khoản 2: quy mô giao thông cấp nặng trở lên; nền trên cùng là đất sét có hệ số thấm ${d.subgradeK} m/ngày < 3 m/ngày.`,
    );
  }
  return { required: reasons.length > 0, reasons };
}

/** Kiểm toán thoát nước theo Điều 7 (công thức (1)–(5)); null khi dự án chưa bật. */
export function runRigidDrain(proj: ProjectState, slabL: number): RigidDrainResult | null {
  const data = proj.rigid;
  const d = data?.drain;
  if (!data || !d) return null;
  const calc = calcDrain({ Ic: d.Ic, N: d.N, nh: d.nh, B: d.B, L: slabL, id: d.id, in_: d.in_, kb: d.kb, ne: d.ne, hbt: d.hbt });
  const checks: RigidDrainCheck[] = [
    {
      id: 'ls',
      label: 'Chiều dài đường thấm ra khỏi kết cấu',
      clause: 'Công thức (3) — Điều 7.1.3 và 7.3.4',
      value: calc.Ls,
      unit: 'm',
      requirement: `≤ ${d.lsLimit} m`,
      passed: calc.Ls <= d.lsLimit,
    },
  ];
  if (d.type === 'THAM') {
    checks.push(
      {
        id: 't',
        label: 'Thời gian thấm nước ra khỏi lớp móng thoát nước',
        clause: 'Công thức (2) — Điều 7.1.3 và 7.3.4',
        value: calc.t,
        unit: 'h',
        requirement: `≤ ${d.tLimit} h`,
        passed: calc.t <= d.tLimit,
      },
      {
        id: 'hbt',
        label: 'Khả năng thoát nước của lớp móng thoát nước (hbt·1,0·vs ≥ Qi)',
        clause: 'Công thức (5) — Điều 7.4.2',
        value: calc.cap,
        unit: 'm³/ngày.m',
        requirement: `≥ Qi = ${calc.Qi.toFixed(3)} m³/ngày.m`,
        passed: calc.cap >= calc.Qi,
      },
    );
  } else {
    checks.push(
      {
        id: 'dia',
        label: 'Đường kính ống thoát nước dọc',
        clause: 'Điều 7.2.2',
        value: d.pipeDia,
        unit: 'mm',
        requirement: '80–100 mm',
        passed: d.pipeDia >= 80 && d.pipeDia <= 100,
      },
      {
        id: 'slopeLong',
        label: 'Độ dốc dọc của ống thoát nước dọc',
        clause: 'Điều 7.2.2',
        value: d.pipeSlopeLong,
        unit: '%',
        requirement: '≥ 0,3 %',
        passed: d.pipeSlopeLong >= 0.3,
      },
      {
        id: 'slopeCross',
        label: 'Độ dốc dọc của ống thoát nước ngang',
        clause: 'Điều 7.2.3',
        value: d.pipeSlopeCross,
        unit: '%',
        requirement: '≥ 5 %',
        passed: d.pipeSlopeCross >= 5,
      },
      {
        id: 'spacing',
        label: 'Khoảng cách ống thoát nước ngang',
        clause: 'Điều 7.2.3',
        value: d.pipeSpacing,
        unit: 'm',
        requirement: '50–100 m',
        passed: d.pipeSpacing >= 50 && d.pipeSpacing <= 100,
      },
    );
  }
  const req = drainRequirement(data.roadClass, d);
  return {
    type: d.type,
    calc,
    L: slabL,
    checks,
    passed: checks.every((c) => c.passed),
    required: req.required,
    requiredReasons: req.reasons,
  };
}

/** Bảo đảm dự án mặt đường cứng có dữ liệu (không đổi khi đã có). */
export function ensureRigidState(proj: ProjectState): ProjectState {
  if (proj.projectInfo.loaiMatDuong === 'CUNG' && !proj.rigid) {
    return { ...proj, rigid: createDefaultRigidProjectData() };
  }
  return proj;
}

export function isRigidProject(proj: ProjectState): boolean {
  return proj.projectInfo.loaiMatDuong === 'CUNG';
}

export interface RigidCheckItem {
  id: 'fatigue' | 'maxload' | 'base';
  label: string;
  /** Số hiệu công thức điều kiện giới hạn trong TCCS 39 (6), (7), (8). */
  conditionNo: string;
  clause: string;
  /** Vế trái γr·(σ…) (MPa). */
  lhs: number;
  /** Vế phải: fr hoặc fbr (MPa). */
  rhs: number;
  applicable: boolean;
  passed: boolean;
}

export interface RigidVerification {
  /** Dữ liệu đầu vào đã giải (E0, Ne lấy theo chế độ tự động/nhập tay). */
  input: RigidInput;
  ne: NeSummary;
  res: RigidResult;
  joint: JointResult;
  checks: RigidCheckItem[];
  /** Kết luận chung: tấm BTXM đạt (6), (7), (8) và — nếu đã bật — thoát nước đạt (Điều 7). */
  allPassed: boolean;
  /** Chỉ riêng tấm BTXM (điều kiện (6), (7), (8)). */
  slabPassed: boolean;
  /** Kiểm toán thoát nước (Điều 7); null khi chưa bật. */
  drain: RigidDrainResult | null;
  /** Chiều dày tấm nhỏ nhất (m) thoả cả 3 điều kiện, tìm theo bước 5 mm; null nếu không có. */
  minHc: number | null;
  warnings: string[];
}

/** Dữ liệu đầu vào thực dùng để tính: E0 và Ne giải từ tuỳ chọn tự động. */
export function resolveRigidInput(proj: ProjectState): { input: RigidInput; ne: NeSummary } {
  const data = proj.rigid ?? createDefaultRigidProjectData();
  const ne = computeNe(data.traffic, data.input.Ps);
  const input: RigidInput = { ...data.input };
  if (data.e0FromSubgrade) input.E0 = resolveSubgrade(proj.subgrade).E0_MPa;
  if (data.neAuto) input.Ne = ne.Ne;
  return { input, ne };
}

export function runRigidVerification(proj: ProjectState): RigidVerification {
  const data = proj.rigid ?? createDefaultRigidProjectData();
  const { input, ne } = resolveRigidInput(proj);
  const res = calcRigid(input);
  const joint = calcJoint({ ...data.joint, h: Math.round(input.hc * 1000) / 10, L: input.L });
  const checks: RigidCheckItem[] = [
    {
      id: 'fatigue',
      label: 'Điều kiện mỏi do tải trọng và gradien nhiệt',
      conditionNo: '(6)',
      clause: 'Điều 8.2.2',
      lhs: res.c1,
      rhs: input.fr,
      applicable: true,
      passed: res.p1,
    },
    {
      id: 'maxload',
      label: 'Điều kiện chịu trục nặng nhất và gradien nhiệt lớn nhất',
      conditionNo: '(7)',
      clause: 'Điều 8.2.2',
      lhs: res.c2,
      rhs: input.fr,
      applicable: true,
      passed: res.p2,
    },
    {
      id: 'base',
      label: 'Điều kiện mỏi của lớp móng trên (bê tông nghèo, bê tông đầm lăn)',
      conditionNo: '(8)',
      clause: 'Điều 8.4.2',
      lhs: res.c3,
      rhs: input.fbr,
      applicable: res.app3,
      passed: res.p3,
    },
  ];
  const warnings: string[] = [];
  if (!(input.hc >= 0.15 && input.hc <= 0.42)) {
    warnings.push('Chiều dày tấm nằm ngoài khoảng 0,15–0,42 m thường dùng.');
  }
  if (input.model === 2 && !(input.Eb > 0 && input.hb > 0)) {
    warnings.push('Mô hình 2 (tấm hai lớp) cần mô đun Eb và chiều dày hb của lớp móng trên.');
  }
  // Điều 8.4.2: chỉ cần kiểm tra mỏi lớp móng trên khi là bê tông nghèo hoặc bê tông đầm lăn.
  if (input.model === 2 && input.fbr <= 0 && /nghèo|đầm lăn/i.test(input.matBound)) {
    warnings.push('Chưa nhập cường độ kéo uốn yêu cầu fbr của móng trên nên chưa kiểm tra điều kiện (8).');
  }
  const g = GAMMA_R_BY_CLASS;
  const cls = (proj.rigid ?? data).roadClass;
  if (input.gr < g[cls].min || input.gr > g[cls].max) {
    warnings.push(
      `γr = ${input.gr} nằm ngoài khoảng ${g[cls].min}–${g[cls].max} của Bảng 9 cho cấp hạng đường đã chọn.`,
    );
  }
  if (data.neAuto && Math.abs(ne.ptot - 100) > 0.5) {
    warnings.push(`Tổng tỷ lệ phổ tải trọng trục = ${ne.ptot.toFixed(1)}% (nên bằng 100%).`);
  }
  if (!(input.Pmax > 0) || input.Pmax < input.Ps) {
    warnings.push('Trục đơn nặng nhất Pmax nên không nhỏ hơn trục tính mỏi Ps.');
  }
  const found = findMinHc(input);
  const drain = runRigidDrain(proj, input.L);
  const slabPassed = checks.every((c) => !c.applicable || c.passed);
  return {
    input,
    ne,
    res,
    joint,
    checks,
    allPassed: slabPassed && (drain ? drain.passed : true),
    slabPassed,
    drain,
    minHc: found ? found.hc : null,
    warnings,
  };
}

export type { JointInput, RigidInput, RigidResult, RigidTrafficInputs };
