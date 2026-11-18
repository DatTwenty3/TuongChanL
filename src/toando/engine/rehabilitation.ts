import type {
  BenkelmanConfig,
  BenkelmanStatsResult,
  DistressSeverity,
  EchCuMethod,
  ExistingDistressAssessment,
  ExistingPavementLayer,
  PavementLayer,
  ProjectState,
  RehabStrategy,
  RehabValidationIssue,
  RehabilitationConfig,
  TwoLayerReductionResult,
} from '../types/project';
import { Z_ALPHA_BY_RELIABILITY } from '../data/tables22tcn211';
import { reduceTwoLayerSystem, roundTo } from './reduction';
import { resolveSubgrade } from './subgrade';
import { evalToanDo31Internal } from './toando';

export interface Bang13AssessmentSummary {
  cracking: { level: DistressSeverity; label: 'Không' | 'Nhẹ' | 'Vừa' | 'Nặng' };
  rutting: { level: DistressSeverity; label: 'Không' | 'Nhẹ' | 'Vừa' | 'Nặng' };
  localizedSink: { level: DistressSeverity; label: 'Không' | 'Nhẹ' | 'Vừa' | 'Nặng' };
  overall: DistressSeverity;
  overallLabel: 'Không' | 'Nhẹ' | 'Vừa' | 'Nặng';
  suggestedStrategy: RehabStrategy;
  reason: string;
}

export interface ExistingLayersEchCuResult {
  echCu_MPa: number;
  reduction: TwoLayerReductionResult;
  usedFormulaF1: boolean;
  e0RatioExtrapolated: boolean;
  effectiveLayers: PavementLayer[];
  warnings: string[];
}

export interface ResolvedRehabEchCu {
  echCu_MPa: number;
  method: EchCuMethod;
  benkelmanStats?: BenkelmanStatsResult;
  existingReduction: TwoLayerReductionResult | null;
  effectiveExistingLayers: PavementLayer[];
  warnings: string[];
}

const SEVERITY_RANK: Record<DistressSeverity, number> = {
  NONE: 0,
  NHE: 1,
  VUA: 2,
  NANG: 3,
};

const SEVERITY_LABEL: Record<DistressSeverity, 'Không' | 'Nhẹ' | 'Vừa' | 'Nặng'> = {
  NONE: 'Không',
  NHE: 'Nhẹ',
  VUA: 'Vừa',
  NANG: 'Nặng',
};

export function createDefaultRehabilitationConfig(): RehabilitationConfig {
  return {
    strategy: 'DIRECT_OVERLAY',
    echMethod: 'DIRECT_FWD',
    directEchCu_MPa: 120,
    directKdc: 1.0,
    benkelman: {
      inputMode: 'POINTS',
      readings_mm: [0.85, 0.92, 0.88, 0.95, 0.9, 0.86, 0.94, 0.89],
      l_tb_mm: 0.9,
      S_mm: 0.08,
      Z_alpha: 1.645,
      K_t: 1.0,
      K_am: 1.0,
      p_do_MPa: 0.6,
      D_do_cm: 33.0,
      mu: 0.3,
    },
    totalExistingThickness_cm: undefined,
    existingLayers: [],
    assessment: {
      segmentName: 'Phân đoạn Km0+000 – Km0+800',
      segmentLength_m: 800,
      oldSurfaceGrade: 'A2',
      pci: null,
      crackingLevel: 'NHE',
      ruttingDepth_mm: 8,
      localizedSink_mm: 10,
      hasReflectiveCrackRisk: false,
      hasWidening: false,
    },
  };
}

/**
 * Looks up one-sided normal quantile Z_alpha from design reliability R (§10.3.2 / TCVN 8867).
 */
export function getZAlphaForReliability(R: number): number {
  if (!Number.isFinite(R)) return 1.645;
  const key = R.toFixed(2);
  if (Z_ALPHA_BY_RELIABILITY[key] !== undefined) {
    return Z_ALPHA_BY_RELIABILITY[key];
  }
  const entries = Object.entries(Z_ALPHA_BY_RELIABILITY)
    .map(([k, v]) => ({ r: parseFloat(k), v }))
    .sort((a, b) => a.r - b.r);
  if (R <= entries[0].r) return entries[0].v;
  if (R >= entries[entries.length - 1].r) return entries[entries.length - 1].v;
  for (let i = 0; i < entries.length - 1; i++) {
    if (R >= entries[i].r && R <= entries[i + 1].r) {
      const t = (R - entries[i].r) / (entries[i + 1].r - entries[i].r);
      return Number((entries[i].v + t * (entries[i + 1].v - entries[i].v)).toFixed(3));
    }
  }
  return 1.645;
}

/**
 * Computes characteristic existing pavement modulus E_ch,cũ (MPa) from Benkelman beam
 * deflection measurements per TCVN 8867 (referenced by TCCS 38:2022 §10.3.2):
 *   E_ch,cu = 10 * p_do * D_do * (1 - mu^2) / l_tt
 */
export function computeBenkelmanEchCu(
  config: BenkelmanConfig,
  fallbackR = 0.95,
): BenkelmanStatsResult {
  const validPts = config.readings_mm.filter((v) => Number.isFinite(v) && v >= 0);

  let n = validPts.length;
  let l_tb_mm = 0;
  let S_mm = 0;

  if (config.inputMode === 'POINTS') {
    if (n > 0) {
      l_tb_mm = validPts.reduce((acc, v) => acc + v, 0) / n;
      if (n >= 2) {
        const variance =
          validPts.reduce((acc, v) => acc + Math.pow(v - l_tb_mm, 2), 0) / (n - 1);
        S_mm = Math.sqrt(variance);
      }
    }
  } else {
    n = validPts.length;
    l_tb_mm = Number.isFinite(config.l_tb_mm) ? Math.max(0, config.l_tb_mm) : 0;
    S_mm = Number.isFinite(config.S_mm) ? Math.max(0, config.S_mm) : 0;
  }

  const Z_alpha =
    Number.isFinite(config.Z_alpha) && config.Z_alpha >= 0
      ? config.Z_alpha
      : getZAlphaForReliability(fallbackR);
  const K_t = Number.isFinite(config.K_t) && config.K_t > 0 ? config.K_t : 1.0;
  const K_am = Number.isFinite(config.K_am) && config.K_am > 0 ? config.K_am : 1.0;
  const p_do = Number.isFinite(config.p_do_MPa) && config.p_do_MPa > 0 ? config.p_do_MPa : 0.6;
  const D_do = Number.isFinite(config.D_do_cm) && config.D_do_cm > 0 ? config.D_do_cm : 33.0;
  const mu = Number.isFinite(config.mu) ? Math.min(0.49, Math.max(0, config.mu)) : 0.3;

  const Cv = l_tb_mm > 0 ? S_mm / l_tb_mm : 0;
  const l_dc_mm = l_tb_mm + Z_alpha * S_mm;
  const l_tt_mm = l_dc_mm * K_t * K_am;
  const echCu_MPa =
    l_tt_mm > 0 ? roundTo((10 * p_do * D_do * (1 - mu * mu)) / l_tt_mm, -2) : 0;

  return {
    n,
    l_tb_mm,
    S_mm,
    Cv,
    Z_alpha,
    l_dc_mm,
    l_tt_mm,
    echCu_MPa,
  };
}

/**
 * Evaluates Hình 2 (Toán đồ 3-1) or Bacbero Eq. (E.1) with Chapter 10 boundary handling
 * when 0.90 < E0'/E1 <= 1.00 (linear interpolation between Hình 2 at 0.90 and 1.00 at 1.00).
 */
export function evaluateDeflectionOverFoundation(
  H_over_D: number,
  E0_MPa: number,
  E1_MPa: number,
): {
  Ech_over_E1: number;
  Ech_MPa: number;
  usedFormulaF1: boolean;
  e0RatioExtrapolated: boolean;
} {
  if (E1_MPa <= 0 || E0_MPa <= 0) {
    return {
      Ech_over_E1: 0,
      Ech_MPa: 0,
      usedFormulaF1: H_over_D > 2.0,
      e0RatioExtrapolated: false,
    };
  }

  const ratio = E0_MPa / E1_MPa;
  if (H_over_D > 2.0) {
    const denom =
      (1 + ratio) / Math.sqrt(1 + 4 * H_over_D * H_over_D * Math.pow(ratio, -0.67)) + ratio;
    const Ech_MPa = roundTo((1.05 * E0_MPa) / denom, -3);
    return {
      Ech_over_E1: Ech_MPa / E1_MPa,
      Ech_MPa,
      usedFormulaF1: true,
      e0RatioExtrapolated: false,
    };
  }

  if (ratio <= 0.9) {
    const echOverE1 = evalToanDo31Internal(H_over_D, ratio);
    return {
      Ech_over_E1: echOverE1,
      Ech_MPa: roundTo(echOverE1 * E1_MPa, -3),
      usedFormulaF1: false,
      e0RatioExtrapolated: false,
    };
  }

  if (ratio <= 1.0) {
    const v09 = Math.max(0.9, evalToanDo31Internal(H_over_D, 0.9));
    const t = (ratio - 0.9) / 0.1;
    const echOverE1 = Math.max(ratio, v09 + t * (1.0 - v09));
    return {
      Ech_over_E1: echOverE1,
      Ech_MPa: roundTo(echOverE1 * E1_MPa, -3),
      usedFormulaF1: false,
      e0RatioExtrapolated: true,
    };
  }

  // E0' / E1 > 1.0: outside Hình 2 upper bound (upper layer softer than foundation).
  const v09 = evalToanDo31Internal(H_over_D, 0.9);
  return {
    Ech_over_E1: v09,
    Ech_MPa: roundTo(v09 * E1_MPa, -3),
    usedFormulaF1: false,
    e0RatioExtrapolated: false,
  };
}

export function buildEffectiveExistingLayers(
  existingLayers: ExistingPavementLayer[],
): PavementLayer[] {
  return existingLayers
    .filter((l) => l.chieuDay_cm > 0 && !l.isBuVenh)
    .map((l) => {
      const kHh = Number.isFinite(l.K_hh) ? Math.min(1.0, Math.max(0, l.K_hh)) : 1.0;
      const suffix = kHh < 1.0 ? ` [K_hh=${kHh.toFixed(2)}]` : '';
      return {
        ...l,
        E_vong_30C: roundTo(l.E_vong_30C * kHh, -3),
        E_truot_60C: roundTo(l.E_truot_60C * kHh, -3),
        E_keoUon_10_15C: roundTo(l.E_keoUon_10_15C * kHh, -3),
        ghiChu: l.ghiChu ? `${l.ghiChu}${suffix}` : suffix.trim(),
      };
    });
}

/**
 * Computes E_ch,cũ (MPa) from retained existing pavement layers on old subgrade E0 (§10.3.3).
 */
export function computeExistingLayersEchCu(
  existingLayers: ExistingPavementLayer[],
  subgradeE0_MPa: number,
  D_cm: number,
): ExistingLayersEchCuResult {
  const effectiveLayers = buildEffectiveExistingLayers(existingLayers).filter(
    (l) => l.E_vong_30C > 0,
  );
  const warnings: string[] = [];

  if (effectiveLayers.length === 0) {
    warnings.push(
      'Chưa khai báo lớp kết cấu cũ giữ lại có chiều dày > 0 và mô đun E > 0 cho Phương pháp C.',
    );
    return {
      echCu_MPa: 0,
      reduction: reduceTwoLayerSystem([], D_cm),
      usedFormulaF1: false,
      e0RatioExtrapolated: false,
      effectiveLayers: [],
      warnings,
    };
  }

  const reduction = reduceTwoLayerSystem(
    effectiveLayers.map((l) => ({
      tenVatLieu: l.tenVatLieu,
      h_cm: l.chieuDay_cm,
      E_MPa: l.E_vong_30C,
    })),
    D_cm,
  );

  const evalRes = evaluateDeflectionOverFoundation(
    reduction.H_over_D,
    subgradeE0_MPa,
    reduction.Etb_dc_MPa,
  );

  if (reduction.Etb_dc_MPa > 0 && subgradeE0_MPa / reduction.Etb_dc_MPa > 1.0) {
    warnings.push(
      `Mô đun quy đổi kết cấu cũ (${reduction.Etb_dc_MPa.toFixed(1)} MPa) nhỏ hơn E0 nền (${subgradeE0_MPa.toFixed(1)} MPa).`,
    );
  }

  return {
    echCu_MPa: roundTo(evalRes.Ech_MPa, -2),
    reduction,
    usedFormulaF1: evalRes.usedFormulaF1,
    e0RatioExtrapolated: evalRes.e0RatioExtrapolated,
    effectiveLayers,
    warnings,
  };
}

export function resolveRehabilitationEchCu(
  rehab: RehabilitationConfig,
  subgradeE0_MPa: number,
  D_cm: number,
  reliabilityR = 0.95,
): ResolvedRehabEchCu {
  const effectiveExistingLayers = buildEffectiveExistingLayers(rehab.existingLayers).filter(
    (l) => l.E_vong_30C > 0,
  );
  const warnings: string[] = [];

  if (rehab.echMethod === 'BENKELMAN') {
    const stats = computeBenkelmanEchCu(rehab.benkelman, reliabilityR);
    if (stats.Cv > 0.25) {
      warnings.push(
        `Hệ số biến động Cv = ${(stats.Cv * 100).toFixed(1)}% > 25%: đoạn đường chưa đồng nhất (§10.3.1, TCVN 8867).`,
      );
    }
    if (stats.echCu_MPa <= 0) {
      warnings.push('Không tính được Ech,cũ từ số liệu cần Benkelman (l_tt <= 0 hoặc thiếu điểm đo).');
    }
    return {
      echCu_MPa: stats.echCu_MPa,
      method: 'BENKELMAN',
      benkelmanStats: stats,
      existingReduction: null,
      effectiveExistingLayers,
      warnings,
    };
  }

  if (rehab.echMethod === 'LAYER_STACK') {
    const stackRes = computeExistingLayersEchCu(rehab.existingLayers, subgradeE0_MPa, D_cm);
    warnings.push(...stackRes.warnings);
    return {
      echCu_MPa: stackRes.echCu_MPa,
      method: 'LAYER_STACK',
      existingReduction: stackRes.reduction,
      effectiveExistingLayers: stackRes.effectiveLayers,
      warnings,
    };
  }

  // DIRECT_FWD
  const kdc = Number.isFinite(rehab.directKdc) && rehab.directKdc > 0 ? rehab.directKdc : 1.0;
  const raw = Number.isFinite(rehab.directEchCu_MPa) ? Math.max(0, rehab.directEchCu_MPa) : 0;
  const echCu_MPa = roundTo(raw * kdc, -2);
  if (echCu_MPa <= 0) {
    warnings.push('Mô đun đàn hồi chung áo đường cũ Ech,cũ nhập trực tiếp phải > 0 MPa.');
  }

  return {
    echCu_MPa,
    method: 'DIRECT_FWD',
    existingReduction: null,
    effectiveExistingLayers,
    warnings,
  };
}

/**
 * Classifies surface distress severity per TCCS 38:2022 Table 13 (§10.3.1) and recommends
 * a Chapter 10 rehabilitation strategy (§10.1.4.3 / §10.3.1).
 */
export function assessBang13Severity(
  assessment: ExistingDistressAssessment,
): Bang13AssessmentSummary {
  const crackingLevel: DistressSeverity = assessment.crackingLevel ?? 'NONE';

  const rut = assessment.ruttingDepth_mm ?? 0;
  let rutLevel: DistressSeverity = 'NONE';
  if (rut > 25) rutLevel = 'NANG';
  else if (rut > 13) rutLevel = 'VUA';
  else if (rut >= 6) rutLevel = 'NHE';

  const sink = assessment.localizedSink_mm ?? 0;
  let sinkLevel: DistressSeverity = 'NONE';
  if (sink > 50) sinkLevel = 'NANG';
  else if (sink > 25) sinkLevel = 'VUA';
  else if (sink >= 13) sinkLevel = 'NHE';

  let overall: DistressSeverity = crackingLevel;
  for (const lvl of [rutLevel, sinkLevel]) {
    if (SEVERITY_RANK[lvl] > SEVERITY_RANK[overall]) {
      overall = lvl;
    }
  }

  let suggestedStrategy: RehabStrategy = 'DIRECT_OVERLAY';
  let reason =
    'Hư hỏng mức nhẹ–vừa cục bộ: phù hợp tăng cường trực tiếp kết hợp sửa chữa cục bộ và bù vênh (§10.1.4.3 Phương án 3).';

  if (sinkLevel === 'NANG' || (assessment.pci != null && assessment.pci < 25)) {
    suggestedStrategy = 'FULL_REBUILD';
    reason =
      'Lún cục bộ mức Nặng (> 50 mm) hoặc PCI rất thấp (< 25): khuyến nghị cải tạo toàn bộ từ nền đường trở lên (§10.1.4.3 Phương án 1).';
  } else if (
    crackingLevel === 'NANG' ||
    rutLevel === 'NANG' ||
    (assessment.pci != null && assessment.pci < 50)
  ) {
    suggestedStrategy = 'MILL_AND_OVERLAY';
    reason =
      'Mặt đường nứt nặng hoặc vệt hằn bánh > 25 mm: khuyến nghị cào bóc/tái chế tầng mặt hư hỏng, tận dụng móng cũ và tăng cường (§10.1.4.3 Phương án 2).';
  }

  return {
    cracking: { level: crackingLevel, label: SEVERITY_LABEL[crackingLevel] },
    rutting: { level: rutLevel, label: SEVERITY_LABEL[rutLevel] },
    localizedSink: { level: sinkLevel, label: SEVERITY_LABEL[sinkLevel] },
    overall,
    overallLabel: SEVERITY_LABEL[overall],
    suggestedStrategy,
    reason,
  };
}

export function isInorganicStabilizedMaterial(name: string): boolean {
  return /xi\s*măng|\bxm\b|vôi|vô\s*cơ|\bctb\b/i.test(name);
}

export function isAsphaltMixtureName(name: string): boolean {
  return /btn|btnc|bê tông nhựa|be tong nhua|hhbr|bán rỗng|đgcn|đá gia cố nhựa|đá dăm đen|đá nhựa|polime|thoát nước|porous|hỗn hợp nhựa|thấm nhập nhựa|trộn nhựa/i.test(
    name,
  );
}

/**
 * Validates all 9 Chapter 10 rules from tccs38-ch10-spec.md §5.3.
 */
export function validateRehabilitationInputs(project: ProjectState): RehabValidationIssue[] {
  if (project.projectInfo.loaiTK !== 'CAI_TAO') return [];

  const rehab = project.rehabilitation;
  if (!rehab) {
    return [
      {
        id: 'missing-rehab-config',
        severity: 'error',
        clause: '§10.1',
        message: 'Chưa khởi tạo cấu hình áo đường cũ (Chương 10) cho chế độ Cải tạo, nâng cấp.',
      },
    ];
  }

  const issues: RehabValidationIssue[] = [];
  const activeAlt =
    project.alternatives.find((a) => a.id === project.activeAlternativeId) ??
    project.alternatives[0];
  const layers = activeAlt?.layers ?? [];

  // Rule 1: Segment length <= 1000 m (§10.3.1.2)
  if (rehab.assessment.segmentLength_m > 1000) {
    issues.push({
      id: 'segment-length',
      severity: 'warning',
      clause: '§10.3.1.2',
      message: 'Theo §10.3.1.2, chiều dài phân đoạn điều tra tối đa không quá 1000 m.',
    });
  }

  // Validate active alternative layers (Rules 5, 6, 7)
  let totalAsphaltOverlay_cm = 0;
  let hasAsphaltAbove = false;

  for (const l of layers) {
    if (l.isBuVenh) {
      // Rule 5: Forbidden inorganic binder in leveling course (§10.2.1.3)
      if (isInorganicStabilizedMaterial(l.tenVatLieu)) {
        issues.push({
          id: `bu-venh-inorganic-${l.id}`,
          severity: 'error',
          clause: '§10.2.1.3',
          message: `Lớp bù vênh "${l.tenVatLieu}": Theo §10.2.1.3, không được sử dụng vật liệu hạt/đất gia cố chất liên kết vô cơ làm lớp bù vênh.`,
        });
      }
      // Rule 6: When overlay above is asphalt mixture, leveling course must be asphalt mixture (§10.2.1.3)
      if (hasAsphaltAbove && !isAsphaltMixtureName(l.tenVatLieu)) {
        issues.push({
          id: `bu-venh-material-${l.id}`,
          severity: 'warning',
          clause: '§10.2.1.3',
          message: `Lớp bù vênh "${l.tenVatLieu}": Theo §10.2.1.3, bắt buộc dùng hỗn hợp đá nhựa làm lớp bù vênh khi lớp tăng cường phía trên là hỗn hợp nhựa.`,
        });
      }
    } else if (l.chieuDay_cm > 0 && l.E_vong_30C > 0 && isAsphaltMixtureName(l.tenVatLieu)) {
      hasAsphaltAbove = true;
      totalAsphaltOverlay_cm += l.chieuDay_cm;
    }
  }

  if (rehab.strategy === 'FULL_REBUILD') {
    return issues;
  }

  // Resolve Ech,cu for Rules 2, 3, 4, 9
  const subgradeResolved = resolveSubgrade(project.subgrade);
  const D_cm = project.forecast.duongKinhVetBanh_D_cm;
  const resolvedEch = resolveRehabilitationEchCu(
    rehab,
    subgradeResolved.E0_MPa,
    D_cm,
    project.roadScale.doTinCayTK,
  );

  // Rule 3: Minimum 2 deflection points in Benkelman POINTS mode
  if (rehab.echMethod === 'BENKELMAN' && rehab.benkelman.inputMode === 'POINTS') {
    const validPts = rehab.benkelman.readings_mm.filter((v) => Number.isFinite(v) && v >= 0);
    if (validPts.length < 2) {
      issues.push({
        id: 'benkelman-min-points',
        severity: 'error',
        clause: 'TCVN 8867',
        message: 'Cần ít nhất 2 điểm đo độ võng để tính độ lệch chuẩn S.',
      });
    }
  }

  // Rule 2: Benkelman Cv > 0.25
  if (
    rehab.echMethod === 'BENKELMAN' &&
    resolvedEch.benkelmanStats &&
    resolvedEch.benkelmanStats.Cv > 0.25
  ) {
    issues.push({
      id: 'benkelman-cv',
      severity: 'warning',
      clause: '§10.3.1 / TCVN 8867',
      message:
        'Hệ số biến động Cv > 25%: đoạn đường chưa đồng nhất, cân nhắc chia nhỏ phân đoạn (§10.3.1, TCVN 8867).',
    });
  }

  // Rule 4: Valid Ech,cu > 0
  if (resolvedEch.echCu_MPa <= 0) {
    issues.push({
      id: 'ech-cu-positive',
      severity: 'error',
      clause: '§10.3.2 / §10.4.2',
      message: 'Mô đun đàn hồi chung áo đường cũ Ech,cũ phải > 0 MPa.',
    });
  }

  // Rule 7: Reflective cracking risk when asphalt overlay < 14 cm (§5.2.5 & §10.2.3)
  if (rehab.assessment.hasReflectiveCrackRisk && totalAsphaltOverlay_cm < 14) {
    issues.push({
      id: 'reflective-cracking-thickness',
      severity: 'warning',
      clause: '§5.2.5 & §10.2.3',
      message:
        'Theo §5.2.5 & §10.2.3, tầng mặt nhựa trên móng gia cố vô cơ nên dày tối thiểu 14–18 cm (hoặc dùng lưới chịu kéo/SAMI theo §10.2.4).',
    });
  }

  // Rule 8: Missing existing thickness / layer stack for subgrade shear under A1/A2 (§10.3.3 & §9.2.5.5)
  const isHighGrade =
    project.designParams.loaiTangMat === 'A1' || project.designParams.loaiTangMat === 'A2';
  const hasExistingStack = resolvedEch.effectiveExistingLayers.length > 0;
  const hasTotalOldThickness =
    rehab.totalExistingThickness_cm !== undefined && rehab.totalExistingThickness_cm > 0;

  if (isHighGrade && !hasExistingStack && !hasTotalOldThickness) {
    issues.push({
      id: 'missing-subgrade-shear-data',
      severity: 'warning',
      clause: '§10.3.3 & §9.2.5.5',
      message:
        'Thiếu chiều dày kết cấu cũ & thông số nền đất (§10.3.3, §9.2.5.5): chỉ kiểm toán được các lớp kém dính mới (nếu có), chưa kiểm toán được cắt trượt trong đất nền cũ.',
    });
  }

  // Rule 9: Overlay Etb_dc < Ech,cu (E0'/E1 > 1.0, outside Hình 2)
  const structuralOverlay = layers.filter(
    (l) => !l.isBuVenh && l.chieuDay_cm > 0 && l.E_vong_30C > 0,
  );
  if (structuralOverlay.length > 0 && resolvedEch.echCu_MPa > 0) {
    const overlayRed = reduceTwoLayerSystem(
      structuralOverlay.map((l) => ({
        tenVatLieu: l.tenVatLieu,
        h_cm: l.chieuDay_cm,
        E_MPa: l.E_vong_30C,
      })),
      D_cm,
    );
    if (overlayRed.Etb_dc_MPa > 0 && resolvedEch.echCu_MPa / overlayRed.Etb_dc_MPa > 1.0) {
      issues.push({
        id: 'overlay-weaker-than-existing',
        severity: 'warning',
        clause: '§10.4.2 / Hình 2',
        message:
          'Mô đun lớp tăng cường nhỏ hơn Ech,cũ (E0/E1 > 1,0, ngoài miền Hình 2). Nên dùng Phương pháp C (tính đổi nhiều lớp trên nền đất E0).',
      });
    }
  }

  return issues;
}
