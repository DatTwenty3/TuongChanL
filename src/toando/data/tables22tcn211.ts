import type { RoadType, StandardAxleType, SurfaceGrade } from '../types/project';

/**
 * Engineering lookup tables per TCCS 38:2022/TCĐBVN (Áo đường mềm — Các yêu cầu và chỉ dẫn thiết kế).
 * Legacy symbol names (`TABLE_3_*`) are preserved alongside TCCS 38:2022 aliases (`TABLE_7..12_*`).
 */

export const HIGHWAY_CLASSES: string[] = [
  'Đường cao tốc',
  'Đường cấp I',
  'Đường cấp II',
  'Đường cấp III',
  'Đường cấp IV',
  'Đường cấp V',
  'Đường cấp VI',
  'Đường chuyên dụng',
];

export const URBAN_CLASSES: string[] = [
  'Đường cao tốc',
  'Đường trục chính',
  'Đường chính khu vực',
  'Đường phố',
  'Đường công nghiệp và kho tàng',
  'Đường xe đạp, ngõ',
];

export const RELIABILITY_OPTIONS: number[] = [0.98, 0.95, 0.9, 0.85, 0.8];

export interface Table7ReliabilityRule {
  roadType: RoadType | 'CHUYEN_DUNG';
  group: string;
  classes: string[];
  values: number[];
  min: number;
}

/** TCCS 38:2022 Table 7: Design reliability selection by road type and class (§8.2). */
export const TABLE_7_MIN_RELIABILITY: Table7ReliabilityRule[] = [
  {
    roadType: 'DUONG_O_TO',
    group: 'Đường cao tốc',
    classes: ['Đường cao tốc'],
    values: [0.9, 0.95, 0.98],
    min: 0.9,
  },
  {
    roadType: 'DUONG_O_TO',
    group: 'Cấp I, II',
    classes: ['Đường cấp I', 'Đường cấp II'],
    values: [0.9, 0.95, 0.98],
    min: 0.9,
  },
  {
    roadType: 'DUONG_O_TO',
    group: 'Cấp III, IV',
    classes: ['Đường cấp III', 'Đường cấp IV'],
    values: [0.85, 0.9, 0.95],
    min: 0.85,
  },
  {
    roadType: 'DUONG_O_TO',
    group: 'Cấp V, VI',
    classes: ['Đường cấp V', 'Đường cấp VI'],
    values: [0.8, 0.85, 0.9],
    min: 0.8,
  },
  {
    roadType: 'DUONG_DO_THI',
    group: 'Cao tốc và trục chính đô thị',
    classes: ['Đường cao tốc', 'Đường trục chính'],
    values: [0.9, 0.95, 0.98],
    min: 0.9,
  },
  {
    roadType: 'DUONG_DO_THI',
    group: 'Các đường đô thị khác',
    classes: [
      'Đường chính khu vực',
      'Đường phố',
      'Đường công nghiệp và kho tàng',
      'Đường xe đạp, ngõ',
    ],
    values: [0.85, 0.9, 0.95],
    min: 0.85,
  },
  {
    roadType: 'CHUYEN_DUNG',
    group: 'Đường chuyên dụng',
    classes: ['Đường chuyên dụng'],
    values: [0.8, 0.85, 0.9],
    min: 0.8,
  },
];

export function getMinReliabilityForRoadClass(loaiDuong: RoadType, capDuong: string): number {
  const rule = TABLE_7_MIN_RELIABILITY.find(
    (r) =>
      (r.roadType === loaiDuong || (r.roadType === 'CHUYEN_DUNG' && capDuong === 'Đường chuyên dụng')) &&
      r.classes.includes(capDuong),
  );
  return rule ? rule.min : 0.8;
}

export interface Table2SurfaceRefRow {
  grade: SurfaceGrade;
  gradeLabel: string;
  roadClasses: string;
  materialsAndStructure: string;
  minDesignLifeYears: number;
}

/** TCCS 38:2022 Table 2: Surface materials and minimum design life (§5.2.4, pp. 10–11). */
export const TABLE_2_SURFACE_REF: Table2SurfaceRefRow[] = [
  {
    grade: 'A1',
    gradeLabel: 'Cấp cao A1 (cao tốc, cấp I, II)',
    roadClasses: 'Đường cao tốc, cấp I, II (và đường cao tốc, trục chính đô thị)',
    materialsAndStructure:
      'Lớp tạo nhám (nếu có) + lớp mặt trên bằng hỗn hợp bê tông nhựa cải thiện (polime/phụ gia) + lớp mặt chịu lực bằng BTNC',
    minDesignLifeYears: 15,
  },
  {
    grade: 'A1',
    gradeLabel: 'Cấp cao A1 (cấp III, IV)',
    roadClasses: 'Đường cấp III, IV (và đường đô thị tương đương)',
    materialsAndStructure:
      'Lớp mặt trên bằng BTNC + lớp mặt chịu lực bằng BTNC hoặc hỗn hợp BTN bán rỗng (HHBR)',
    minDesignLifeYears: 10,
  },
  {
    grade: 'A2',
    gradeLabel: 'Cấp cao A2',
    roadClasses: 'Đường cấp IV, V (và đường đô thị tương đương)',
    materialsAndStructure:
      'Hỗn hợp BTN bán rỗng (HHBR), đá gia cố nhựa (ĐGCN), đá dăm thấm nhập nhựa, đá dăm đen, láng nhựa nóng nhiều lớp',
    minDesignLifeYears: 8,
  },
  {
    grade: 'B1',
    gradeLabel: 'Cấp thấp B1',
    roadClasses: 'Đường cấp V, VI',
    materialsAndStructure:
      'Đá dăm, sỏi cuội, cấp phối đá dăm, cấp phối thiên nhiên không gia cố hoặc gia cố chất liên kết vô cơ (có hoặc không có láng nhựa bảo vệ)',
    minDesignLifeYears: 6,
  },
  {
    grade: 'B2',
    gradeLabel: 'Cấp thấp B2',
    roadClasses: 'Đường cấp VI, đường GTNT',
    materialsAndStructure:
      'Đất, đá tại chỗ gia cố cơ học hoặc phế thải công nghiệp, chất liên kết vô cơ (Điều 3.12.4; miễn kiểm toán cắt trượt & kéo uốn)',
    minDesignLifeYears: 6,
  },
];

export interface TableF1MinA1Row {
  Ne_range: string;
  standard_cm: number;
  onAsphaltBase_ge10cm_cm: number;
}

/** TCCS 38:2022 Appendix F Table F.1: Minimum asphalt surface thickness for grade A1 (cm, p. 73). */
export const TABLE_F1_MIN_A1: TableF1MinA1Row[] = [
  { Ne_range: '< 0,1 × 10⁶', standard_cm: 6, onAsphaltBase_ge10cm_cm: 5 },
  { Ne_range: '≥ 0,1 × 10⁶', standard_cm: 7, onAsphaltBase_ge10cm_cm: 5 },
  { Ne_range: '≥ 0,5 × 10⁶', standard_cm: 8, onAsphaltBase_ge10cm_cm: 5 },
  { Ne_range: '≥ 1,0 × 10⁶', standard_cm: 9, onAsphaltBase_ge10cm_cm: 5 },
  { Ne_range: '≥ 2,0 × 10⁶', standard_cm: 10, onAsphaltBase_ge10cm_cm: 5 },
  { Ne_range: '≥ 4,0 × 10⁶', standard_cm: 12.5, onAsphaltBase_ge10cm_cm: 7.5 },
  { Ne_range: '≥ 6,0 × 10⁶', standard_cm: 15.0, onAsphaltBase_ge10cm_cm: 10 },
  { Ne_range: '≥ 9,0 × 10⁶', standard_cm: 20.0, onAsphaltBase_ge10cm_cm: 10 },
];

export const SOIL_DIRECT_TYPES: string[] = [
  'Đất dính',
  'Đất sét',
  'Đất á sét',
  'Đất á cát',
  'Đất cát nhỏ',
  'Đất cát trung',
  'Đất cát thô',
];

/** TCCS 38:2022 Appendix B Table B.4 soil types ('Á cát bụi nặng' corrected from 'Á sét bụi nặng'). */
export const SOIL_MOISTURE_TYPES: string[] = [
  'Sét',
  'Á sét',
  'Á sét nhẹ',
  'Á cát bụi nặng',
  'Á cát nhẹ',
  'Á cát',
  'Cát mịn',
  'Đất Bazan Tây nguyên',
];

export const COMPACTION_K_OPTIONS: number[] = [0.9, 0.95, 0.98, 1.0];

export const LANE_COUNT_OPTIONS: number[] = [1, 2, 3, 4, 6];

/** TCCS 38:2022 Table 6 (formerly 22TCN 211-06 Table 3-1): Standard axle characteristics. */
export const STANDARD_AXLE_PARAMS: Record<
  StandardAxleType,
  { P_kN: number; p_MPa: number; D_cm: number }
> = {
  100: { P_kN: 100, p_MPa: 0.6, D_cm: 33 },
  120: { P_kN: 120, p_MPa: 0.6, D_cm: 36 },
};

/** TCCS 38:2022 Table 8 Row 1 (formerly Table 3-2): Strength safety factor for elastic deflection (Kcd^dv). */
export const TABLE_3_2_KCD_VONG: Record<string, number> = {
  '0.98': 1.29,
  '0.95': 1.17,
  '0.90': 1.1,
  '0.85': 1.06,
  '0.80': 1.02,
};
export const TABLE_8_KCD_VONG = TABLE_3_2_KCD_VONG;

/** TCCS 38:2022 Table 8 Row 2 (formerly Table 3-7): Strength safety factor for shear resistance (Kcd^tr). */
export const TABLE_3_7_KCD_TRUOT: Record<string, number> = {
  '0.98': 1.1,
  '0.95': 1.0,
  '0.90': 0.94,
  '0.85': 0.9,
  '0.80': 0.87,
};
export const TABLE_8_KCD_TRUOT = TABLE_3_7_KCD_TRUOT;

/** TCCS 38:2022 Table 8 Row 2 (formerly Table 3-7): Strength safety factor for flexural tension (Kcd^ku). */
export const TABLE_3_7_KCD_KEOUON: Record<string, number> = {
  '0.98': 1.1,
  '0.95': 1.0,
  '0.90': 0.94,
  '0.85': 0.9,
  '0.80': 0.87,
};
export const TABLE_8_KCD_KEOUON = TABLE_3_7_KCD_KEOUON;

export interface Table34Row {
  Ntt: number;
  A1: number;
  A2: number;
  B1: number;
}

/** TCCS 38:2022 Table 9 (formerly Table 3-4): Required modulus Eyc (MPa) vs design daily standard axles Ntt. */
export const TABLE_3_4_EYC: Record<StandardAxleType, Table34Row[]> = {
  100: [
    { Ntt: 10, A1: 0, A2: 0, B1: 0 },
    { Ntt: 20, A1: 0, A2: 91, B1: 64 },
    { Ntt: 50, A1: 133, A2: 110, B1: 82 },
    { Ntt: 100, A1: 147, A2: 122, B1: 94 },
    { Ntt: 200, A1: 160, A2: 135, B1: 0 },
    { Ntt: 500, A1: 178, A2: 153, B1: 0 },
    { Ntt: 1000, A1: 192, A2: 0, B1: 0 },
    { Ntt: 2000, A1: 207, A2: 0, B1: 0 },
    { Ntt: 5000, A1: 224, A2: 0, B1: 0 },
    { Ntt: 7000, A1: 235, A2: 0, B1: 0 },
  ],
  120: [
    { Ntt: 10, A1: 0, A2: 90, B1: 0 },
    { Ntt: 20, A1: 127, A2: 103, B1: 79 },
    { Ntt: 50, A1: 146, A2: 120, B1: 98 },
    { Ntt: 100, A1: 161, A2: 133, B1: 111 },
    { Ntt: 200, A1: 173, A2: 146, B1: 0 },
    { Ntt: 500, A1: 190, A2: 163, B1: 0 },
    { Ntt: 1000, A1: 204, A2: 0, B1: 0 },
    { Ntt: 2000, A1: 218, A2: 0, B1: 0 },
    { Ntt: 5000, A1: 235, A2: 0, B1: 0 },
    { Ntt: 7000, A1: 253, A2: 0, B1: 0 },
  ],
};
export const TABLE_9_EYC = TABLE_3_4_EYC;

export interface Table35Entry {
  roadClass: string;
  A1: number;
  A2: number;
  B1: number;
  shoulder?: Partial<Record<SurfaceGrade, number>>;
}

/** TCCS 38:2022 Table 10 (formerly Table 3-5): Minimum required modulus Emin (MPa) by road type and class. */
export const TABLE_3_5_EMIN: Record<RoadType, Table35Entry[]> = {
  DUONG_O_TO: [
    { roadClass: 'Đường cao tốc', A1: 180, A2: 0, B1: 0, shoulder: { A1: 160 } },
    { roadClass: 'Đường cấp I', A1: 180, A2: 0, B1: 0, shoulder: { A1: 160 } },
    { roadClass: 'Đường cấp II', A1: 160, A2: 0, B1: 0, shoulder: { A1: 140 } },
    { roadClass: 'Đường cấp III', A1: 140, A2: 120, B1: 0, shoulder: { A1: 120, A2: 95 } },
    { roadClass: 'Đường cấp IV', A1: 130, A2: 100, B1: 75, shoulder: { A1: 110, A2: 80, B1: 75 } },
    { roadClass: 'Đường cấp V', A1: 0, A2: 80, B1: 0, shoulder: { A2: 65 } },
    { roadClass: 'Đường cấp VI', A1: 0, A2: 80, B1: 0, shoulder: { A2: 65 } },
    { roadClass: 'Đường chuyên dụng', A1: 0, A2: 0, B1: 0 },
  ],
  DUONG_DO_THI: [
    { roadClass: 'Đường cao tốc', A1: 190, A2: 0, B1: 0 },
    { roadClass: 'Đường trục chính', A1: 190, A2: 0, B1: 0 },
    { roadClass: 'Đường chính khu vực', A1: 155, A2: 130, B1: 0 },
    { roadClass: 'Đường phố', A1: 120, A2: 95, B1: 70 },
    { roadClass: 'Đường công nghiệp và kho tàng', A1: 155, A2: 130, B1: 100 },
    { roadClass: 'Đường xe đạp, ngõ', A1: 100, A2: 75, B1: 50 },
  ],
};
export const TABLE_10_EMIN = TABLE_3_5_EMIN;

/** TCCS 38:2022 Table 11 (formerly Table 3-6): Thickness correction factor beta vs H/D. */
export const TABLE_3_6_BETA: Array<{ H_over_D: number; beta: number }> = [
  { H_over_D: 0.5, beta: 1.033 },
  { H_over_D: 0.75, beta: 1.069 },
  { H_over_D: 1.0, beta: 1.107 },
  { H_over_D: 1.25, beta: 1.136 },
  { H_over_D: 1.5, beta: 1.178 },
  { H_over_D: 1.75, beta: 1.198 },
  { H_over_D: 2.0, beta: 1.21 },
];
export const TABLE_11_BETA = TABLE_3_6_BETA;

/** TCCS 38:2022 Table 12 (formerly Table 3-8): Discrete cohesion adjustment factor k2 vs Ntt. */
export const TABLE_3_8_K2_COHESION: Array<{ Ntt_max: number; k2: number }> = [
  { Ntt_max: 100, k2: 1.0 },
  { Ntt_max: 1000, k2: 0.8 },
  { Ntt_max: 5000, k2: 0.65 },
  { Ntt_max: Infinity, k2: 0.6 },
];
export const TABLE_12_K2_COHESION = TABLE_3_8_K2_COHESION;

export interface SoilMoistureRow {
  a: number;
  E0: number;
  phi: number;
  C: number;
}

/**
 * TCCS 38:2022 Appendix B Table B.4: Subgrade soil properties vs relative moisture a = Wtn / Wnh
 * at K = 0.95 standard compaction (increase E0 by +20% for improved compaction per Note 3).
 */
export const SOIL_MOISTURE_TABLES = {
  Set_and_ASet: [
    { a: 0.55, E0: 46, phi: 27.0, C: 0.038 },
    { a: 0.6, E0: 42, phi: 24.0, C: 0.032 },
    { a: 0.65, E0: 40, phi: 21.0, C: 0.028 },
    { a: 0.7, E0: 34, phi: 18.0, C: 0.023 },
    { a: 0.75, E0: 29, phi: 15.0, C: 0.019 },
    { a: 0.8, E0: 25, phi: 13.0, C: 0.015 },
    { a: 0.85, E0: 21, phi: 12.0, C: 0.013 },
    { a: 0.9, E0: 20, phi: 11.5, C: 0.012 },
  ] as SoilMoistureRow[],
  ASetNhe_and_ACatBuiNang: [
    { a: 0.55, E0: 48, phi: 28.0, C: 0.024 },
    { a: 0.6, E0: 45, phi: 26.0, C: 0.022 },
    { a: 0.65, E0: 42, phi: 26.0, C: 0.018 },
    { a: 0.7, E0: 37, phi: 25.0, C: 0.014 },
    { a: 0.75, E0: 32, phi: 25.0, C: 0.012 },
    { a: 0.8, E0: 27, phi: 24.0, C: 0.011 },
    { a: 0.85, E0: 23, phi: 24.0, C: 0.01 },
    { a: 0.9, E0: 22, phi: 23.0, C: 0.009 },
  ] as SoilMoistureRow[],
  ACatNhe_and_ACat: [
    { a: 0.55, E0: 49, phi: 30.0, C: 0.02 },
    { a: 0.6, E0: 45, phi: 28.0, C: 0.018 },
    { a: 0.65, E0: 42, phi: 28.0, C: 0.014 },
    { a: 0.7, E0: 38, phi: 27.0, C: 0.012 },
    { a: 0.75, E0: 34, phi: 27.0, C: 0.011 },
    { a: 0.8, E0: 32, phi: 26.0, C: 0.01 },
    { a: 0.85, E0: 30, phi: 26.0, C: 0.009 },
    { a: 0.9, E0: 28, phi: 25.0, C: 0.008 },
  ] as SoilMoistureRow[],
  CatMin: { a: 0.55, E0: 40, phi: 35.0, C: 0.005 },
  DatBazanTayNguyen: [
    { a: 0.55, E0: 51, phi: 17.0, C: 0.036 },
    { a: 0.6, E0: 44, phi: 12.0, C: 0.031 },
    { a: 0.65, E0: 40, phi: 14.0, C: 0.028 },
    { a: 0.7, E0: 25, phi: 8.0, C: 0.024 },
    { a: 0.75, E0: 23, phi: 11.0, C: 0.019 },
    { a: 0.8, E0: 21, phi: 9.0, C: 0.015 },
    { a: 0.85, E0: 16, phi: 7.0, C: 0.011 },
  ] as SoilMoistureRow[],
  LanSoiSan_E0: [
    { a: 0.55, E0: 60 },
    { a: 0.6, E0: 57 },
    { a: 0.65, E0: 53 },
    { a: 0.7, E0: 50 },
    { a: 0.75, E0: 46 },
    { a: 0.8, E0: 42 },
    { a: 0.85, E0: 40 },
    { a: 0.9, E0: 38 },
  ],
};

/**
 * One-sided standard normal quantile Z_alpha by design reliability R
 * (TCCS 38:2022 §10.3.2 & TCVN 8867).
 */
export const Z_ALPHA_BY_RELIABILITY: Record<string, number> = {
  '0.98': 2.054,
  '0.95': 1.645,
  '0.90': 1.282,
  '0.85': 1.036,
  '0.80': 0.842,
};

export interface Table13DistressRow {
  category: string;
  distressAsphalt: string;
  distressLowGrade: string;
  criteria: {
    nhe?: string;
    vua?: string;
    nang?: string;
    note?: string;
  };
}

/**
 * TCCS 38:2022/TCĐBVN Chapter 10 Table 13 (§10.3.1, pp. 39–40):
 * Existing pavement surface distress types and severity evaluation criteria.
 */
export const TABLE_13_DISTRESS_REF: Table13DistressRow[] = [
  {
    category: 'Nứt',
    distressAsphalt: 'Nứt dọc, nứt ngang, nứt phản ảnh',
    distressLowGrade: '—',
    criteria: {
      nhe: 'Bề rộng khe nứt < 10 mm, không gây xóc khi xe chạy qua.',
      vua: 'Bề rộng > 10 mm, gây xóc, bắt đầu có vết nứt thứ cấp xung quanh vết nứt chính. Chiều rộng nứt chính và nứt thứ cấp ≤ 100 mm.',
      nang: 'Nứt rộng, sâu, gây va đập khi xe chạy qua. Có vết nứt thứ cấp xung quanh vết nứt chính. Chiều rộng nứt chính và nứt thứ cấp đến > 100 mm.',
    },
  },
  {
    category: 'Nứt',
    distressAsphalt: 'Nứt thành lưới (nứt mai rùa hoặc nứt thành miếng)',
    distressLowGrade: '—',
    criteria: {
      nhe: 'Các đường nứt chưa liên kết với nhau.',
      vua: 'Đã liên kết thành mạng.',
      nang: 'Nứt lan ra ngoài phạm vi vệt bánh xe và liên kết với nhau. Bắt đầu hiện tượng bong vỡ.',
    },
  },
  {
    category: 'Biến dạng bề mặt',
    distressAsphalt: 'Vệt hằn bánh, lún sụt',
    distressLowGrade: '—',
    criteria: {
      nhe: 'Vệt hằn sâu trung bình từ 6 mm đến 13 mm.',
      vua: 'Từ 13 mm đến 25 mm.',
      nang: '> 25 mm.',
      note: 'Dùng thước thẳng đặt ngang vệt hằn; cứ cách 5 m đến 10 m đo một chỗ rồi lấy trị số trung bình cho mỗi đoạn.',
    },
  },
  {
    category: 'Biến dạng bề mặt',
    distressAsphalt: 'Làn sóng, xô dồn, đẩy trồi',
    distressLowGrade: 'Làn sóng, xô dồn',
    criteria: {
      nhe: 'Mặt đường bị đẩy trồi, dồn nhựa nhưng không ảnh hưởng đến chất lượng chạy xe.',
      vua: 'Mặt đường bị đẩy trồi ảnh hưởng đến chất lượng chạy xe; lái xe thấy khó chịu do xóc.',
      nang: 'Mặt đường bị đẩy trồi, nhựa dồn cao ảnh hưởng nghiêm trọng đến chất lượng chạy xe; lái xe không thể chạy với tốc độ cao do xóc.',
    },
  },
  {
    category: 'Biến dạng bề mặt',
    distressAsphalt: 'Lún lõm, đẩy trồi cục bộ',
    distressLowGrade: 'Lún lõm, đẩy trồi cục bộ',
    criteria: {
      nhe: 'Chiều sâu lún cục bộ từ 13 mm đến 25 mm.',
      vua: 'Chiều sâu lún cục bộ từ 25 mm đến 50 mm.',
      nang: 'Chiều sâu lún cục bộ > 50 mm.',
    },
  },
  {
    category: 'Biến dạng bề mặt',
    distressAsphalt: '—',
    distressLowGrade: 'Mất mui luyện hoặc mui luyện ngược gây lõm giữa đường',
    criteria: {
      nhe: 'Tồn tại mui luyện mặt đường nhưng độ dốc ngang không đạt yêu cầu.',
      vua: 'Không còn mui luyện, dốc ngang mặt đường gần bằng 0, xuất hiện đọng nước nhẹ khi trời mưa.',
      nang: 'Mui luyện ngược, mặt đường lõm ở giữa, đọng nước khi trời mưa.',
    },
  },
  {
    category: 'Hư hỏng bề mặt',
    distressAsphalt: 'Chảy nhựa',
    distressLowGrade: '—',
    criteria: {
      note: 'Không phân mức độ nghiêm trọng khi phân đoạn đường.',
    },
  },
  {
    category: 'Hư hỏng bề mặt',
    distressAsphalt: 'Bong tróc, rời rạc; Mài mòn, lộ đá',
    distressLowGrade: 'Bong tróc, rời rạc',
    criteria: {
      note: 'Không phân mức độ nghiêm trọng khi phân đoạn đường.',
    },
  },
  {
    category: 'Hư hỏng bề mặt',
    distressAsphalt: 'Ổ gà',
    distressLowGrade: 'Ổ gà',
    criteria: {
      note: 'Không phân mức độ nghiêm trọng khi phân đoạn đường.',
    },
  },
];
