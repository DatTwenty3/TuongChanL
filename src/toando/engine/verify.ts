import type {
  AlternativeVerificationResult,
  DeflectionResult,
  DesignObjectType,
  FlexuralLayerResult,
  FullVerificationResult,
  PavementAlternative,
  PavementLayer,
  ProjectState,
  RehabCalculationSummary,
  ShearTargetResult,
  SurfaceGrade,
  TrafficSummary,
  TwoLayerReductionResult,
} from '../types/project';
import { computeDesignModulus, computeKcd } from './modulus';
import {
  buildEffectiveExistingLayers,
  createDefaultRehabilitationConfig,
  evaluateDeflectionOverFoundation,
  isAsphaltMixtureName,
  isInorganicStabilizedMaterial,
  resolveRehabilitationEchCu,
} from './rehabilitation';
import { reduceTwoLayerSystem, roundTo } from './reduction';
import { resolveSubgrade } from './subgrade';
import {
  evalToanDo31Internal,
  evalToanDo32Internal,
  evalToanDo33Internal,
  evalToanDo34Internal,
  evalToanDo35Internal,
  evalToanDo36Internal,
  lookupToanDo31,
  lookupToanDo32,
  lookupToanDo33,
  lookupToanDo34,
  lookupToanDo35,
  lookupToanDo36,
} from './toando';
import { computeTrafficSummary } from './traffic';

/**
 * Bacbero analytical fallback Eq. (E.1) / Appendix F (F-1) for thick pavements (H/D > 2.0).
 */
export function computeBacberoEch(E0_MPa: number, E1_MPa: number, H_over_D: number): number {
  if (E1_MPa <= 0 || E0_MPa <= 0) return 0;
  const r = E0_MPa / E1_MPa;
  const denom = (1 + r) / Math.sqrt(1 + 4 * H_over_D * H_over_D * Math.pow(r, -0.67)) + r;
  return roundTo((1.05 * E0_MPa) / denom, -3);
}

/**
 * Appendix E analytical fallback Eq. (E.2)-(E.3) for surface flexural stress.
 */
export function computeAnalyticalSigmaSurface(h_over_D: number, E1_over_Echm: number): number {
  if (h_over_D <= 0 || E1_over_Echm <= 0) return 0;
  const htdD = 1.1 * h_over_D * Math.cbrt(E1_over_Echm);
  return (
    (4 / Math.PI) *
    h_over_D *
    E1_over_Echm *
    (1 - (2 / Math.PI) * Math.atan(htdD)) *
    Math.pow(Math.atan(1 / htdD), 2)
  );
}

/**
 * Appendix E analytical fallback Eq. (E.4) for monolithic base flexural stress.
 */
export function computeAnalyticalSigmaBase(
  h_over_D: number,
  E1_over_E2: number,
  E2_over_E3: number,
): number {
  if (h_over_D <= 0 || E1_over_E2 <= 0 || E2_over_E3 <= 0) return 0;
  const num = (1.29 * Math.pow(E1_over_E2, -0.185)) / h_over_D - 0.203 / E1_over_E2 - 0.283;
  const den = 9.3 / E2_over_E3 + 0.83;
  return Math.max(0, num / den);
}

function computeEquivalentEchOverSubgrade(
  layersTopDown: Array<{ tenVatLieu: string; h_cm: number; E_MPa: number }>,
  E0_MPa: number,
  D_cm: number,
  allowBoundaryInterpolation = false,
) {
  if (layersTopDown.length === 0) {
    return {
      reduction: reduceTwoLayerSystem([], D_cm),
      Ech_MPa: E0_MPa,
      usedFormulaF1: false,
      e0RatioExtrapolated: false,
      Ech_over_E1: 1.0 as number | null,
      toanDo31: undefined,
    };
  }

  const reduction = reduceTwoLayerSystem(layersTopDown, D_cm);
  const H_over_D = reduction.H_over_D;
  const E1_MPa = reduction.Etb_dc_MPa;
  const E0_over_E1 = E1_MPa > 0 ? E0_MPa / E1_MPa : 0;

  if (allowBoundaryInterpolation) {
    const evalRes = evaluateDeflectionOverFoundation(H_over_D, E0_MPa, E1_MPa);
    const toanDo31 =
      !evalRes.usedFormulaF1 && E0_over_E1 <= 1.0
        ? lookupToanDo31(H_over_D, Math.min(0.9, E0_over_E1))
        : undefined;
    return {
      reduction,
      Ech_MPa: evalRes.Ech_MPa,
      usedFormulaF1: evalRes.usedFormulaF1,
      e0RatioExtrapolated: evalRes.e0RatioExtrapolated,
      Ech_over_E1: evalRes.Ech_over_E1,
      toanDo31,
    };
  }

  const usedFormulaF1 = H_over_D > 2.0;
  let Ech_over_E1: number | null;
  let Ech_MPa: number;
  let toanDo31 = undefined;

  if (!usedFormulaF1) {
    const td = lookupToanDo31(H_over_D, E0_over_E1);
    toanDo31 = td;
    const ratio = td.valid && td.value !== null ? td.value : evalToanDo31Internal(H_over_D, E0_over_E1);
    Ech_over_E1 = ratio;
    Ech_MPa = roundTo(ratio * E1_MPa, -3);
  } else {
    Ech_MPa = computeBacberoEch(E0_MPa, E1_MPa, H_over_D);
    Ech_over_E1 = E1_MPa > 0 ? Ech_MPa / E1_MPa : null;
  }

  return {
    reduction,
    Ech_MPa,
    usedFormulaF1,
    e0RatioExtrapolated: false,
    Ech_over_E1,
    toanDo31,
  };
}

export function checkDeflection(
  alt: PavementAlternative,
  project: ProjectState,
  E0_MPa: number,
  Eyc_MPa: number,
  options?: {
    isRehabFoundation?: boolean;
    foundationLabel?: string;
    excludeBuVenh?: boolean;
  },
): DeflectionResult {
  const D_cm = project.forecast.duongKinhVetBanh_D_cm;
  const Kcd_dv = project.roadScale.Kcd_vong;
  const excludeBuVenh = options?.excludeBuVenh ?? false;
  const stack = alt.layers
    .filter((l) => (!excludeBuVenh || !l.isBuVenh) && l.chieuDay_cm > 0 && l.E_vong_30C > 0)
    .map((l) => ({
      tenVatLieu: l.tenVatLieu,
      h_cm: l.chieuDay_cm,
      E_MPa: l.E_vong_30C,
    }));

  const eq = computeEquivalentEchOverSubgrade(
    stack,
    E0_MPa,
    D_cm,
    options?.isRehabFoundation ?? false,
  );
  const E0_over_Etbdc =
    eq.reduction.Etb_dc_MPa > 0 ? E0_MPa / eq.reduction.Etb_dc_MPa : 0;
  const Eyc_required_MPa = roundTo(Kcd_dv * Eyc_MPa, -3);
  const foundationValid = E0_MPa > 0;

  return {
    reduction: eq.reduction,
    H_over_D: eq.reduction.H_over_D,
    E0_over_Etbdc,
    usedFormulaF1: eq.usedFormulaF1,
    Ech_over_E1: eq.Ech_over_E1,
    Ech_MPa: eq.Ech_MPa,
    Kcd_dv,
    Eyc_MPa,
    Eyc_required_MPa,
    passed: foundationValid && eq.Ech_MPa >= Eyc_required_MPa,
    toanDo31: eq.toanDo31,
    ...(options?.isRehabFoundation
      ? {
          foundationModulus_MPa: E0_MPa,
          foundationLabel: options.foundationLabel ?? "E₀' = Ech,cũ",
          e0RatioExtrapolated: eq.e0RatioExtrapolated,
        }
      : {}),
  };
}

function getShearK1(doiTuongTK: DesignObjectType): number {
  return doiTuongTK === 'LGC' ? 0.9 : 0.6;
}

/**
 * TCCS 38:2022/TCĐBVN Table 12 discrete k2 lookup (§9.3.4):
 * - Áo đường (KCAD): Ntt < 100 -> 1.0, < 1000 -> 0.8, < 5000 -> 0.65, >= 5000 -> 0.60.
 * - Lề gia cố (LGC): 1.23 if B1, else 1.0.
 */
function getShearK2(
  Ntt: number,
  doiTuongTK: DesignObjectType,
  loaiTangMat: SurfaceGrade,
): number {
  if (doiTuongTK === 'LGC') {
    return loaiTangMat === 'B1' ? 1.23 : 1.0;
  }
  if (Ntt < 100) return 1.0;
  if (Ntt < 1000) return 0.8;
  if (Ntt < 5000) return 0.65;
  return 0.6;
}

/**
 * TCCS 38:2022/TCĐBVN §9.3.4 k3 lookup:
 * cohesive soils (including bazan) -> 1.5; fine sand -> 3.0; medium sand -> 6.0; coarse sand -> 7.0.
 */
function getShearK3(name: string, isSubgrade: boolean): number {
  const s = name.toLowerCase();
  if (s.includes('cát nhỏ') || s.includes('cát mịn')) return 3.0;
  if (s.includes('cát trung')) return 6.0;
  if (s.includes('cát thô')) return 7.0;
  if (
    s.includes('bazan') ||
    s.includes('dính') ||
    s.includes('á cát') ||
    s.includes('á sét') ||
    s.includes('sét')
  ) {
    return 1.5;
  }
  return isSubgrade ? 1.5 : 1.5;
}

function evaluateSingleShearTarget(
  tgt: {
    targetId: string;
    targetName: string;
    targetIndexFromTop: number | null;
    isSubgrade: boolean;
    phi_deg: number;
    C_MPa: number;
  },
  layersAbove: Array<{ tenVatLieu: string; chieuDay_cm: number; E_truot_60C: number }>,
  layersBelow: Array<{ tenVatLieu: string; chieuDay_cm: number; E_truot_60C: number }>,
  foundationE0_MPa: number,
  project: ProjectState,
  Ntt: number,
  allowBoundaryInterpolation = false,
): ShearTargetResult {
  const D_cm = project.forecast.duongKinhVetBanh_D_cm;
  const p_MPa = project.forecast.apLucBanh_p_MPa;
  const Kcd_tr = project.roadScale.Kcd_truot;
  const k1 = getShearK1(project.projectInfo.doiTuongTK);
  const k2 = getShearK2(Ntt, project.projectInfo.doiTuongTK, project.designParams.loaiTangMat);

  const reductionAbove = reduceTwoLayerSystem(
    layersAbove.map((l) => ({
      tenVatLieu: l.tenVatLieu,
      h_cm: l.chieuDay_cm,
      E_MPa: l.E_truot_60C,
    })),
    D_cm,
  );

  let reductionBelow: TwoLayerReductionResult | null = null;
  let E2_MPa = foundationE0_MPa;
  if (!tgt.isSubgrade && layersBelow.length > 0) {
    const belowEq = computeEquivalentEchOverSubgrade(
      layersBelow.map((l) => ({
        tenVatLieu: l.tenVatLieu,
        h_cm: l.chieuDay_cm,
        E_MPa: l.E_truot_60C,
      })),
      foundationE0_MPa,
      D_cm,
      allowBoundaryInterpolation,
    );
    reductionBelow = belowEq.reduction;
    E2_MPa = belowEq.Ech_MPa;
  }

  const H_cm = reductionAbove.H_total_cm;
  const H_over_D = reductionAbove.H_over_D;
  const E1_MPa = reductionAbove.Etb_dc_MPa;
  const E1_over_E2 = E2_MPa > 0 ? E1_MPa / E2_MPa : 1;

  // ADMv2.exe selection: TTdo3_2 when H/D <= 2.0, TTdo3_3 when H/D > 2.0, RoundTo(..., -4)
  const usedToanDo: '3-2' | '3-3' = H_over_D <= 2.0 ? '3-2' : '3-3';
  const toanDoTax =
    usedToanDo === '3-2'
      ? lookupToanDo32(H_over_D, E1_over_E2, tgt.phi_deg)
      : lookupToanDo33(H_over_D, E1_over_E2, tgt.phi_deg);

  const rawTaxOverP =
    toanDoTax.valid && toanDoTax.value !== null
      ? toanDoTax.value
      : usedToanDo === '3-2'
        ? evalToanDo32Internal(H_over_D, E1_over_E2, tgt.phi_deg)
        : evalToanDo33Internal(H_over_D, E1_over_E2, tgt.phi_deg);

  const tax_over_p = roundTo(rawTaxOverP, -4);
  const tax_MPa = tax_over_p * p_MPa;

  const toanDoTav = lookupToanDo34(H_cm, tgt.phi_deg);
  const tav_MPa =
    toanDoTav.valid && toanDoTav.value !== null
      ? toanDoTav.value
      : evalToanDo34Internal(H_cm, tgt.phi_deg);

  const k3 = getShearK3(
    tgt.isSubgrade ? project.subgrade.loaiDat : tgt.targetName,
    tgt.isSubgrade,
  );

  const rawCtt = tgt.C_MPa * k1 * k2 * k3;
  const Ctt_MPa = tgt.isSubgrade ? roundTo(rawCtt, -3) : rawCtt;
  const tau_total_MPa = tax_MPa + tav_MPa;
  const rawAllow = Kcd_tr > 0 ? Ctt_MPa / Kcd_tr : Ctt_MPa;
  const tau_allow_MPa = tgt.isSubgrade ? roundTo(rawAllow, -3) : rawAllow;

  return {
    targetId: tgt.targetId,
    targetName: tgt.targetName,
    targetIndexFromTop: tgt.targetIndexFromTop,
    isSubgrade: tgt.isSubgrade,
    reductionAbove,
    reductionBelow,
    E1_MPa,
    E2_MPa,
    H_cm,
    D_cm,
    H_over_D,
    E1_over_E2,
    phi_deg: tgt.phi_deg,
    C_MPa: tgt.C_MPa,
    usedToanDo,
    tax_over_p,
    tax_MPa,
    tav_MPa,
    k1,
    k2,
    k3,
    Ctt_MPa,
    Kcd_tr,
    tau_total_MPa,
    tau_allow_MPa,
    passed: tau_total_MPa <= tau_allow_MPa,
    toanDoTax,
    toanDoTav,
  };
}

export function checkShear(
  alt: PavementAlternative,
  project: ProjectState,
  Ntt: number,
  subgrade: { E0_MPa: number; phi_deg: number; C_MPa: number },
): ShearTargetResult[] {
  const structuralLayers = alt.layers.filter((l) => l.chieuDay_cm > 0 && l.E_truot_60C > 0);
  const targets: ShearTargetResult[] = [];

  for (let i = 0; i < structuralLayers.length; i++) {
    const l = structuralLayers[i];
    if (l.C_MPa > 0 && i > 0) {
      targets.push(
        evaluateSingleShearTarget(
          {
            targetId: l.id,
            targetName: l.tenVatLieu,
            targetIndexFromTop: i,
            isSubgrade: false,
            phi_deg: l.phi_deg,
            C_MPa: l.C_MPa,
          },
          structuralLayers.slice(0, i),
          structuralLayers.slice(i),
          subgrade.E0_MPa,
          project,
          Ntt,
        ),
      );
    }
  }

  targets.push(
    evaluateSingleShearTarget(
      {
        targetId: 'subgrade',
        targetName: 'Đất nền',
        targetIndexFromTop: null,
        isSubgrade: true,
        phi_deg: subgrade.phi_deg,
        C_MPa: subgrade.C_MPa,
      },
      structuralLayers,
      [],
      subgrade.E0_MPa,
      project,
      Ntt,
    ),
  );

  return targets;
}

/**
 * Inverts Hình 2 / Eq. (E.1) by bisection to find an equivalent single-layer modulus E1_eq
 * of thickness H_cu (cm) over subgrade E0_MPa that yields Ech = echCu_MPa.
 */
function inferEquivalentOldLayerModulus(
  H_cu_cm: number,
  D_cm: number,
  subgradeE0_MPa: number,
  echCu_MPa: number,
): number {
  if (echCu_MPa <= subgradeE0_MPa || H_cu_cm <= 0 || D_cm <= 0) {
    return Math.max(subgradeE0_MPa, echCu_MPa);
  }
  const H_over_D = H_cu_cm / D_cm;
  let lo = subgradeE0_MPa;
  let hi = Math.max(subgradeE0_MPa * 2, echCu_MPa * 25, 5000);
  while (
    evaluateDeflectionOverFoundation(H_over_D, subgradeE0_MPa, hi).Ech_MPa < echCu_MPa &&
    hi < 1e6
  ) {
    hi *= 2;
  }
  for (let iter = 0; iter < 42; iter++) {
    const mid = 0.5 * (lo + hi);
    const est = evaluateDeflectionOverFoundation(H_over_D, subgradeE0_MPa, mid).Ech_MPa;
    if (est < echCu_MPa) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return roundTo(0.5 * (lo + hi), -1);
}

function checkShearRehab(
  alt: PavementAlternative,
  project: ProjectState,
  Ntt: number,
  subgrade: { E0_MPa: number; phi_deg: number; C_MPa: number },
  echCu_MPa: number,
  effectiveExistingLayers: PavementLayer[],
  totalExistingThickness_cm?: number,
): {
  shearTargets: ShearTargetResult[];
  shearOldStackUsed: boolean;
  subgradeShearSkippedReason?: string;
  warnings: string[];
} {
  const warnings: string[] = [];
  const overlayShearLayers = alt.layers.filter(
    (l) => !l.isBuVenh && l.chieuDay_cm > 0 && l.E_truot_60C > 0,
  );
  const existingShearLayers = effectiveExistingLayers.filter(
    (l) => l.chieuDay_cm > 0 && l.E_truot_60C > 0,
  );

  // Case 1: Full existing layer stack provided -> full stack [...overlay, ...existing] on subgrade E0
  if (existingShearLayers.length > 0) {
    const fullStack = [...overlayShearLayers, ...existingShearLayers];
    const targets: ShearTargetResult[] = [];
    for (let i = 0; i < fullStack.length; i++) {
      const l = fullStack[i];
      if (l.C_MPa > 0 && i > 0) {
        targets.push(
          evaluateSingleShearTarget(
            {
              targetId: l.id,
              targetName: l.tenVatLieu,
              targetIndexFromTop: i,
              isSubgrade: false,
              phi_deg: l.phi_deg,
              C_MPa: l.C_MPa,
            },
            fullStack.slice(0, i),
            fullStack.slice(i),
            subgrade.E0_MPa,
            project,
            Ntt,
            true,
          ),
        );
      }
    }

    targets.push(
      evaluateSingleShearTarget(
        {
          targetId: 'subgrade',
          targetName: 'Đất nền',
          targetIndexFromTop: null,
          isSubgrade: true,
          phi_deg: subgrade.phi_deg,
          C_MPa: subgrade.C_MPa,
        },
        fullStack,
        [],
        subgrade.E0_MPa,
        project,
        Ntt,
        true,
      ),
    );

    return {
      shearTargets: targets,
      shearOldStackUsed: true,
      warnings,
    };
  }

  // Case 2 & Case 3: No explicit existing layer stack.
  // First check cohesive overlay layers (if any) over foundation E0' = echCu_MPa.
  const targets: ShearTargetResult[] = [];
  for (let i = 0; i < overlayShearLayers.length; i++) {
    const l = overlayShearLayers[i];
    if (l.C_MPa > 0 && i > 0) {
      targets.push(
        evaluateSingleShearTarget(
          {
            targetId: l.id,
            targetName: l.tenVatLieu,
            targetIndexFromTop: i,
            isSubgrade: false,
            phi_deg: l.phi_deg,
            C_MPa: l.C_MPa,
          },
          overlayShearLayers.slice(0, i),
          overlayShearLayers.slice(i),
          echCu_MPa,
          project,
          Ntt,
          true,
        ),
      );
    }
  }

  // Case 2: Total existing thickness H_cu is provided -> build equivalent single old layer over subgrade E0
  if (
    totalExistingThickness_cm !== undefined &&
    Number.isFinite(totalExistingThickness_cm) &&
    totalExistingThickness_cm > 0 &&
    subgrade.E0_MPa > 0
  ) {
    const D_cm = project.forecast.duongKinhVetBanh_D_cm;
    const eqOldE = inferEquivalentOldLayerModulus(
      totalExistingThickness_cm,
      D_cm,
      subgrade.E0_MPa,
      echCu_MPa,
    );
    const syntheticOldLayer = {
      tenVatLieu: 'Kết cấu áo đường cũ (quy đổi từ Ech,cũ)',
      chieuDay_cm: totalExistingThickness_cm,
      E_truot_60C: eqOldE,
    };
    const approxFullStack = [...overlayShearLayers, syntheticOldLayer];
    targets.push(
      evaluateSingleShearTarget(
        {
          targetId: 'subgrade',
          targetName: 'Đất nền',
          targetIndexFromTop: null,
          isSubgrade: true,
          phi_deg: subgrade.phi_deg,
          C_MPa: subgrade.C_MPa,
        },
        approxFullStack,
        [],
        subgrade.E0_MPa,
        project,
        Ntt,
        true,
      ),
    );
    warnings.push(
      `Kiểm toán cắt trượt đất nền cũ sử dụng H_cũ = ${totalExistingThickness_cm} cm với mô đun quy đổi tương đương ${eqOldE.toFixed(1)} MPa từ Ech,cũ = ${echCu_MPa.toFixed(1)} MPa (§10.3.3).`,
    );
    return {
      shearTargets: targets,
      shearOldStackUsed: true,
      warnings,
    };
  }

  // Case 3: Missing both existingLayers and totalExistingThickness_cm -> warn clearly, do not silently pass subgrade
  const skipReason =
    'Thiếu chiều dày kết cấu cũ H_cũ hoặc danh sách các lớp cũ giữ lại (§10.3.3, §9.2.5.5): chưa đủ dữ liệu kiểm toán cắt trượt trong đất nền cũ.';
  warnings.push(skipReason);
  return {
    shearTargets: targets,
    shearOldStackUsed: false,
    subgradeShearSkippedReason: skipReason,
    warnings,
  };
}

function classifyFatigueMaterial(layerName: string): {
  materialClass: 'BTN' | 'DA_SOI_GC' | 'DAT_GC';
  k2: number;
} {
  const s = layerName.toLowerCase();
  const isAsphalt =
    s.includes('btn') ||
    s.includes('btnc') ||
    s.includes('bê tông nhựa') ||
    s.includes('be tong nhua') ||
    s.includes('hhbr') ||
    s.includes('bán rỗng') ||
    s.includes('đgcn') ||
    s.includes('đá gia cố nhựa') ||
    s.includes('đá dăm đen') ||
    s.includes('polime') ||
    s.includes('thoát nước') ||
    s.includes('porous') ||
    s.includes('trộn nhựa');

  if (isAsphalt) {
    const isReducedK2 =
      s.includes('loại ii') ||
      s.includes('rỗng') ||
      s.includes('hhbr') ||
      s.includes('đgcn') ||
      s.includes('đá gia cố nhựa') ||
      s.includes('đá dăm đen') ||
      s.includes('thoát nước') ||
      s.includes('porous') ||
      s.includes('trộn nhựa');
    return { materialClass: 'BTN', k2: isReducedK2 ? 0.8 : 1.0 };
  }
  if (s.includes('đá') || s.includes('sỏi') || s.includes('cuội')) {
    return { materialClass: 'DA_SOI_GC', k2: 1.0 };
  }
  return { materialClass: 'DAT_GC', k2: 1.0 };
}

function computeFatigueK1(
  materialClass: 'BTN' | 'DA_SOI_GC' | 'DAT_GC',
  Ne_truc: number,
): number {
  const ne = Math.max(1, Ne_truc);
  if (materialClass === 'BTN') return 11.11 * Math.pow(ne, -0.22);
  if (materialClass === 'DA_SOI_GC') return 2.86 * Math.pow(ne, -0.11);
  return 2.22 * Math.pow(ne, -0.11);
}

function isMonolithicLayer(layer: PavementLayer): boolean {
  if (layer.Rku_MPa <= 0) return false;
  const s = layer.tenVatLieu.toLowerCase();
  if (s.includes('thấm nhập nhựa') || s.includes('trộn nhựa lỏng')) return false;
  return true;
}

function evaluateFlexuralLayer(
  stack: PavementLayer[],
  idx: number,
  foundationE0_MPa: number,
  D_cm: number,
  p_MPa: number,
  kb: number,
  Kcd_ku: number,
  Ne_truc: number,
  options?: {
    allowBoundaryInterpolation?: boolean;
    displayName?: string;
  },
): { result: FlexuralLayerResult; warning?: string } {
  const layer = stack[idx];
  const layersBelow = stack.slice(idx + 1);
  const belowEq = computeEquivalentEchOverSubgrade(
    layersBelow.map((l) => ({
      tenVatLieu: l.tenVatLieu,
      h_cm: l.chieuDay_cm,
      E_MPa: l.E_keoUon_10_15C,
    })),
    foundationE0_MPa,
    D_cm,
    options?.allowBoundaryInterpolation ?? false,
  );

  const Echm_MPa = belowEq.Ech_MPa;
  const isSurface = layer.isTangMat || idx === 0;

  let h1_cm = 0;
  let E1_MPa = layer.E_keoUon_10_15C;
  let E2_MPa = layer.E_keoUon_10_15C;
  let H_over_D = 0;
  let ratio1 = 1;
  let ratio2: number | null = null;
  let usedToanDo: '3-5' | '3-6' = '3-5';
  let usedAnalyticalFallback = false;
  let sigma_ku_bar = 0;
  let toanDoFlex = undefined;
  let warning: string | undefined;

  if (isSurface) {
    const stackTop = stack.slice(0, idx + 1);
    h1_cm = stackTop.reduce((acc, l) => acc + l.chieuDay_cm, 0);
    const sumEh = stackTop.reduce((acc, l) => acc + l.E_keoUon_10_15C * l.chieuDay_cm, 0);
    E1_MPa = h1_cm > 0 ? sumEh / h1_cm : layer.E_keoUon_10_15C;
    H_over_D = D_cm > 0 ? h1_cm / D_cm : 0;
    ratio1 = Echm_MPa > 0 ? E1_MPa / Echm_MPa : 1;
    usedToanDo = '3-5';

    const td = lookupToanDo35(H_over_D, ratio1);
    toanDoFlex = td;
    if (td.valid && td.value !== null) {
      sigma_ku_bar = td.value;
    } else if (ratio1 < 1.5) {
      usedAnalyticalFallback = true;
      sigma_ku_bar = computeAnalyticalSigmaSurface(H_over_D, ratio1);
      warning = `Lớp "${options?.displayName ?? layer.tenVatLieu}": Tỷ số E₁/Ech.m = ${ratio1.toFixed(2)} < 1,5 (ngoài cận dưới Hình 7), dùng công thức giải tích (E.2)–(E.3).`;
    } else if (H_over_D <= 1.0) {
      sigma_ku_bar = evalToanDo35Internal(H_over_D, ratio1);
    } else {
      usedAnalyticalFallback = true;
      sigma_ku_bar = computeAnalyticalSigmaSurface(H_over_D, ratio1);
    }
  } else {
    const stackAbove = stack.slice(0, idx);
    const hAbove = stackAbove.reduce((acc, l) => acc + l.chieuDay_cm, 0);
    const sumEhAbove = stackAbove.reduce(
      (acc, l) => acc + l.E_keoUon_10_15C * l.chieuDay_cm,
      0,
    );
    E1_MPa = hAbove > 0 ? sumEhAbove / hAbove : layer.E_keoUon_10_15C;
    E2_MPa = layer.E_keoUon_10_15C;
    h1_cm = hAbove + layer.chieuDay_cm;
    H_over_D = D_cm > 0 ? h1_cm / D_cm : 0;
    ratio1 = E2_MPa > 0 ? E1_MPa / E2_MPa : 1;
    ratio2 = Echm_MPa > 0 ? E2_MPa / Echm_MPa : 1;
    usedToanDo = '3-6';

    const td = lookupToanDo36(H_over_D, ratio1, ratio2);
    toanDoFlex = td;
    if (td.valid && td.value !== null) {
      sigma_ku_bar = td.value;
    } else if (H_over_D <= 2.0) {
      sigma_ku_bar = evalToanDo36Internal(H_over_D, ratio1, ratio2);
    } else {
      usedAnalyticalFallback = true;
      sigma_ku_bar = computeAnalyticalSigmaBase(H_over_D, ratio1, ratio2);
    }
  }

  const sigma_ku_MPa = sigma_ku_bar * p_MPa * kb;
  const { materialClass, k2 } = classifyFatigueMaterial(layer.tenVatLieu);
  const k1 = computeFatigueK1(materialClass, Ne_truc);
  const Rtt_ku_MPa = k1 * k2 * layer.Rku_MPa;
  const R_allow_MPa = Kcd_ku > 0 ? Rtt_ku_MPa / Kcd_ku : Rtt_ku_MPa;

  return {
    result: {
      layerId: layer.id,
      layerName: options?.displayName ?? layer.tenVatLieu,
      layerIndexFromTop: idx,
      isSurfaceLayer: isSurface,
      h1_cm,
      E1_MPa,
      E2_MPa,
      Echm_MPa,
      reductionBelow: layersBelow.length > 0 ? belowEq.reduction : null,
      H_over_D,
      ratio1,
      ratio2,
      usedToanDo,
      usedAnalyticalFallback,
      sigma_ku_bar,
      kb,
      p_MPa,
      sigma_ku_MPa,
      materialClass,
      k1,
      k2,
      Rku_MPa: layer.Rku_MPa,
      Rtt_ku_MPa,
      Kcd_ku,
      R_allow_MPa,
      passed: sigma_ku_MPa <= R_allow_MPa,
      toanDoFlex,
    },
    warning,
  };
}

export function checkFlexural(
  alt: PavementAlternative,
  project: ProjectState,
  Ne_truc: number,
  E0_MPa: number,
): FlexuralLayerResult[] {
  const D_cm = project.forecast.duongKinhVetBanh_D_cm;
  const p_MPa = project.forecast.apLucBanh_p_MPa;
  const Kcd_ku = project.roadScale.Kcd_keoUon;
  const kb = project.forecast.taiTrongTrucTacDung === 'BANH_DON' ? 1.0 : 0.85;
  const structuralLayers = alt.layers.filter((l) => l.chieuDay_cm > 0 && l.E_vong_30C > 0);

  const results: FlexuralLayerResult[] = [];
  for (let idx = 0; idx < structuralLayers.length; idx++) {
    const layer = structuralLayers[idx];
    if (!isMonolithicLayer(layer)) continue;
    results.push(
      evaluateFlexuralLayer(structuralLayers, idx, E0_MPa, D_cm, p_MPa, kb, Kcd_ku, Ne_truc).result,
    );
  }
  return results;
}

function checkFlexuralRehab(
  alt: PavementAlternative,
  project: ProjectState,
  Ne_truc: number,
  echCu_MPa: number,
  effectiveExistingLayers: PavementLayer[],
  subgradeE0_MPa: number,
): { flexuralLayers: FlexuralLayerResult[]; warnings: string[] } {
  const D_cm = project.forecast.duongKinhVetBanh_D_cm;
  const p_MPa = project.forecast.apLucBanh_p_MPa;
  const Kcd_ku = project.roadScale.Kcd_keoUon;
  const kb = project.forecast.taiTrongTrucTacDung === 'BANH_DON' ? 1.0 : 0.85;

  const overlayStructural = alt.layers.filter(
    (l) => !l.isBuVenh && l.chieuDay_cm > 0 && l.E_vong_30C > 0,
  );
  const results: FlexuralLayerResult[] = [];
  const warnings: string[] = [];

  for (let idx = 0; idx < overlayStructural.length; idx++) {
    const layer = overlayStructural[idx];
    if (!isMonolithicLayer(layer)) continue;
    const ev = evaluateFlexuralLayer(
      overlayStructural,
      idx,
      echCu_MPa,
      D_cm,
      p_MPa,
      kb,
      Kcd_ku,
      Ne_truc,
      { allowBoundaryInterpolation: true },
    );
    results.push(ev.result);
    if (ev.warning) warnings.push(ev.warning);
  }

  // Optional flexural verification on retained monolithic existing layers marked checkFlexural: true
  const existingConfigLayers = project.rehabilitation?.existingLayers ?? [];
  const existingCheckIds = new Set(
    existingConfigLayers.filter((l) => l.checkFlexural).map((l) => l.id),
  );
  if (existingCheckIds.size > 0 && effectiveExistingLayers.length > 0) {
    const combinedStack = [...overlayStructural, ...effectiveExistingLayers];
    for (let exIdx = 0; exIdx < effectiveExistingLayers.length; exIdx++) {
      const exLayer = effectiveExistingLayers[exIdx];
      if (!existingCheckIds.has(exLayer.id) || !isMonolithicLayer(exLayer)) continue;
      const combinedIdx = overlayStructural.length + exIdx;
      const ev = evaluateFlexuralLayer(
        combinedStack,
        combinedIdx,
        subgradeE0_MPa,
        D_cm,
        p_MPa,
        kb,
        Kcd_ku,
        Ne_truc,
        {
          allowBoundaryInterpolation: true,
          displayName: `${exLayer.tenVatLieu} (lớp cũ giữ lại)`,
        },
      );
      results.push(ev.result);
      if (ev.warning) warnings.push(ev.warning);
    }
  }

  return { flexuralLayers: results, warnings };
}

export function verifyAlternative(
  alt: PavementAlternative,
  project: ProjectState,
  traffic: TrafficSummary,
  subgradeResolved: { E0_MPa: number; phi_deg: number; C_MPa: number },
  modulusResolved: { Eyc_MPa: number; Emin_MPa: number; Ett_MPa: number },
): AlternativeVerificationResult {
  const warnings: string[] = [];
  const isCaiTao = project.projectInfo.loaiTK === 'CAI_TAO';

  if (isCaiTao) {
    const rehab = project.rehabilitation ?? createDefaultRehabilitationConfig();

    if (rehab.strategy === 'FULL_REBUILD') {
      const structuralLayers = alt.layers.filter((l) => l.chieuDay_cm > 0 && l.E_vong_30C > 0);
      if (alt.layers.length === 0) {
        warnings.push('Phương án chưa có lớp kết cấu nào.');
      } else {
        for (const l of alt.layers) {
          if (l.chieuDay_cm > 0 && l.E_vong_30C <= 0) {
            warnings.push(
              `Lớp "${l.tenVatLieu}" có E = 0 MPa (lớp bảo vệ/tạo nhám không tính vào cường độ chịu lực).`,
            );
          }
        }
      }

      const fullRebuildMsg =
        'Cải tạo toàn bộ kết cấu từ nền trở lên (§10.1.4.3 Phương án 1): kiểm toán như kết cấu mới trên nền đất E₀.';
      warnings.push(fullRebuildMsg);

      const deflection = checkDeflection(
        alt,
        project,
        subgradeResolved.E0_MPa,
        modulusResolved.Ett_MPa,
        {
          isRehabFoundation: false,
        },
      );
      deflection.foundationModulus_MPa = subgradeResolved.E0_MPa;
      deflection.foundationLabel = 'E₀ nền đất (cải tạo toàn bộ)';

      if (deflection.reduction.etbCapped) {
        warnings.push(
          `Đã kẹp trần Etb^đc ≤ ${deflection.reduction.maxLayerE_MPa} MPa theo TCCS 38:2022 Bảng 11 Chú thích 2.`,
        );
      }

      const isLowGrade =
        project.designParams.loaiTangMat === 'B1' || project.designParams.loaiTangMat === 'B2';
      const shearApplicable = !isLowGrade;
      const shearTargets = shearApplicable
        ? checkShear(alt, project, traffic.Ntt_trucLanNgDem, subgradeResolved)
        : [];
      const flexuralApplicable = !isLowGrade;
      const flexuralLayers = flexuralApplicable
        ? checkFlexural(alt, project, traffic.Ne_truc, subgradeResolved.E0_MPa)
        : [];

      const allDeflectionPassed = structuralLayers.length > 0 && deflection.passed;
      const allShearPassed = !shearApplicable || shearTargets.every((s) => s.passed);
      const allFlexuralPassed = !flexuralApplicable || flexuralLayers.every((f) => f.passed);

      const rehabSummary: RehabCalculationSummary = {
        loaiTK: 'CAI_TAO',
        strategy: 'FULL_REBUILD',
        excludedBuVenhLayers: [],
        shearOldStackUsed: false,
        warnings: [fullRebuildMsg],
      };

      return {
        alternativeId: alt.id,
        alternativeName: alt.name,
        ranAtIso: new Date().toISOString(),
        deflection,
        shearApplicable,
        shearTargets,
        flexuralApplicable,
        flexuralLayers,
        allDeflectionPassed,
        allShearPassed,
        allFlexuralPassed,
        allPassed: allDeflectionPassed && allShearPassed && allFlexuralPassed,
        warnings,
        rehabSummary,
      };
    }

    // Chapter 10 overlay / mill-and-overlay verification (§10.4.2)
    const rehabWarnings: string[] = [];
    const excludedBuVenhLayers: RehabCalculationSummary['excludedBuVenhLayers'] = [];
    const overlayStructuralLayers: PavementLayer[] = [];

    let hasAsphaltOverlayAbove = false;
    let totalAsphaltOverlay_cm = 0;

    if (alt.layers.length === 0) {
      warnings.push('Phương án chưa có lớp tăng cường nào.');
    }

    for (const l of alt.layers) {
      if (l.isBuVenh) {
        excludedBuVenhLayers.push({
          layerId: l.id,
          layerName: l.tenVatLieu,
          chieuDay_cm: l.chieuDay_cm,
        });
        const buVenhNote = `Lớp bù vênh "${l.tenVatLieu}" (${l.chieuDay_cm} cm) không được tính vào cường độ chung kết cấu sau tăng cường (theo Điều 10.2.1.2).`;
        warnings.push(buVenhNote);
        rehabWarnings.push(buVenhNote);

        if (isInorganicStabilizedMaterial(l.tenVatLieu)) {
          const inorgMsg = `Vi phạm §10.2.1.3: Lớp bù vênh "${l.tenVatLieu}" sử dụng vật liệu gia cố chất liên kết vô cơ.`;
          warnings.push(inorgMsg);
          rehabWarnings.push(inorgMsg);
        }
        if (hasAsphaltOverlayAbove && !isAsphaltMixtureName(l.tenVatLieu)) {
          const matMsg = `Cảnh báo §10.2.1.3: Lớp bù vênh "${l.tenVatLieu}" dưới lớp tăng cường nhựa nên dùng hỗn hợp đá nhựa.`;
          warnings.push(matMsg);
          rehabWarnings.push(matMsg);
        }
      } else if (l.chieuDay_cm > 0 && l.E_vong_30C <= 0) {
        warnings.push(
          `Lớp "${l.tenVatLieu}" có E = 0 MPa (lớp bảo vệ/tạo nhám không tính vào cường độ chịu lực).`,
        );
      } else if (l.chieuDay_cm > 0 && l.E_vong_30C > 0) {
        overlayStructuralLayers.push(l);
        if (isAsphaltMixtureName(l.tenVatLieu)) {
          hasAsphaltOverlayAbove = true;
          totalAsphaltOverlay_cm += l.chieuDay_cm;
        }
      }
    }

    if (rehab.assessment.hasReflectiveCrackRisk && totalAsphaltOverlay_cm < 14) {
      const reflMsg =
        'Theo §5.2.5 & §10.2.3, tầng mặt nhựa tăng cường trên móng gia cố vô cơ cũ nên dày tối thiểu 14–18 cm (hoặc dùng lưới chịu kéo/SAMI theo §10.2.4).';
      warnings.push(reflMsg);
      rehabWarnings.push(reflMsg);
    }

    const D_cm = project.forecast.duongKinhVetBanh_D_cm;
    const resolvedEch = resolveRehabilitationEchCu(
      rehab,
      subgradeResolved.E0_MPa,
      D_cm,
      project.roadScale.doTinCayTK,
    );
    const echCu_MPa = resolvedEch.echCu_MPa;
    for (const w of resolvedEch.warnings) {
      warnings.push(w);
      rehabWarnings.push(w);
    }

    const methodTag =
      resolvedEch.method === 'BENKELMAN'
        ? 'Cần Benkelman TCVN 8867'
        : resolvedEch.method === 'LAYER_STACK'
          ? 'Quy đổi các lớp kết cấu cũ'
          : 'Nhập trực tiếp FWD / TCVN 8867';

    const deflection = checkDeflection(alt, project, echCu_MPa, modulusResolved.Ett_MPa, {
      isRehabFoundation: true,
      foundationLabel: `E₀' = Ech,cũ (${methodTag})`,
      excludeBuVenh: true,
    });

    if (deflection.reduction.etbCapped) {
      warnings.push(
        `Đã kẹp trần Etb^đc ≤ ${deflection.reduction.maxLayerE_MPa} MPa theo TCCS 38:2022 Bảng 11 Chú thích 2.`,
      );
    }
    if (deflection.e0RatioExtrapolated) {
      const extMsg = `Tỷ số E₀'/E₁ = ${deflection.E0_over_Etbdc.toFixed(3)} nằm trong (0,90; 1,00]: đã nội suy tuyến tính vượt cận trên 0,90 của Hình 2.`;
      warnings.push(extMsg);
      rehabWarnings.push(extMsg);
    }
    if (overlayStructuralLayers.length > 0 && deflection.E0_over_Etbdc > 1.0) {
      const outMsg = `Mô đun lớp tăng cường Etb^đc (${deflection.reduction.Etb_dc_MPa.toFixed(1)} MPa) nhỏ hơn Ech,cũ (${echCu_MPa.toFixed(1)} MPa) (E₀'/E₁ = ${deflection.E0_over_Etbdc.toFixed(3)} > 1,0, ngoài miền Hình 2). Nên dùng Phương pháp C.`;
      warnings.push(outMsg);
      rehabWarnings.push(outMsg);
    }

    const existingSurfaceAlreadyMeetsEyc =
      echCu_MPa > 0 && echCu_MPa >= deflection.Eyc_required_MPa;
    if (existingSurfaceAlreadyMeetsEyc) {
      const metMsg = `Kết cấu cũ đã đạt Ech,cũ (${echCu_MPa.toFixed(2)} MPa) ≥ Kcd·Eyc (${deflection.Eyc_required_MPa.toFixed(2)} MPa).`;
      warnings.push(metMsg);
      rehabWarnings.push(metMsg);
    }

    const isLowGrade =
      project.designParams.loaiTangMat === 'B1' || project.designParams.loaiTangMat === 'B2';
    const shearApplicable = !isLowGrade;
    const shearRes = shearApplicable
      ? checkShearRehab(
          alt,
          project,
          traffic.Ntt_trucLanNgDem,
          subgradeResolved,
          echCu_MPa,
          resolvedEch.effectiveExistingLayers,
          rehab.totalExistingThickness_cm,
        )
      : {
          shearTargets: [] as ShearTargetResult[],
          shearOldStackUsed: false,
          subgradeShearSkippedReason: undefined,
          warnings: [] as string[],
        };

    for (const w of shearRes.warnings) {
      warnings.push(w);
      rehabWarnings.push(w);
    }

    const flexuralApplicable = !isLowGrade;
    const flexRes = flexuralApplicable
      ? checkFlexuralRehab(
          alt,
          project,
          traffic.Ne_truc,
          echCu_MPa,
          resolvedEch.effectiveExistingLayers,
          subgradeResolved.E0_MPa,
        )
      : { flexuralLayers: [] as FlexuralLayerResult[], warnings: [] as string[] };

    for (const w of flexRes.warnings) {
      warnings.push(w);
      rehabWarnings.push(w);
    }

    const allDeflectionPassed = echCu_MPa > 0 && deflection.passed;
    const allShearPassed =
      !shearApplicable ||
      (!shearRes.subgradeShearSkippedReason && shearRes.shearTargets.every((s) => s.passed));
    const allFlexuralPassed =
      !flexuralApplicable || flexRes.flexuralLayers.every((f) => f.passed);

    const rehabSummary: RehabCalculationSummary = {
      loaiTK: 'CAI_TAO',
      strategy: rehab.strategy,
      echMethod: resolvedEch.method,
      echCu_MPa,
      benkelmanStats: resolvedEch.benkelmanStats,
      existingReduction: resolvedEch.existingReduction,
      excludedBuVenhLayers,
      shearOldStackUsed: shearRes.shearOldStackUsed,
      subgradeShearSkippedReason: shearRes.subgradeShearSkippedReason,
      existingSurfaceAlreadyMeetsEyc,
      warnings: rehabWarnings,
    };

    return {
      alternativeId: alt.id,
      alternativeName: alt.name,
      ranAtIso: new Date().toISOString(),
      deflection,
      shearApplicable,
      shearTargets: shearRes.shearTargets,
      flexuralApplicable,
      flexuralLayers: flexRes.flexuralLayers,
      allDeflectionPassed,
      allShearPassed,
      allFlexuralPassed,
      allPassed: allDeflectionPassed && allShearPassed && allFlexuralPassed,
      warnings,
      rehabSummary,
    };
  }

  // Standard TK_MOI verification path
  const structuralLayers = alt.layers.filter((l) => l.chieuDay_cm > 0 && l.E_vong_30C > 0);
  if (alt.layers.length === 0) {
    warnings.push('Phương án chưa có lớp kết cấu nào.');
  } else {
    for (const l of alt.layers) {
      if (l.chieuDay_cm > 0 && l.E_vong_30C <= 0) {
        warnings.push(
          `Lớp "${l.tenVatLieu}" có E = 0 MPa (lớp bảo vệ/tạo nhám không tính vào cường độ chịu lực).`,
        );
      }
    }
  }

  const deflection = checkDeflection(
    alt,
    project,
    subgradeResolved.E0_MPa,
    modulusResolved.Ett_MPa,
  );
  if (deflection.reduction.etbCapped) {
    warnings.push(
      `Đã kẹp trần Etb^đc ≤ ${deflection.reduction.maxLayerE_MPa} MPa theo TCCS 38:2022 Bảng 11 Chú thích 2.`,
    );
  }
  const isLowGrade =
    project.designParams.loaiTangMat === 'B1' || project.designParams.loaiTangMat === 'B2';
  const shearApplicable = !isLowGrade;
  const shearTargets = shearApplicable
    ? checkShear(alt, project, traffic.Ntt_trucLanNgDem, subgradeResolved)
    : [];
  const flexuralApplicable = !isLowGrade;
  const flexuralLayers = flexuralApplicable
    ? checkFlexural(alt, project, traffic.Ne_truc, subgradeResolved.E0_MPa)
    : [];

  const allDeflectionPassed = structuralLayers.length > 0 && deflection.passed;
  const allShearPassed = !shearApplicable || shearTargets.every((s) => s.passed);
  const allFlexuralPassed = !flexuralApplicable || flexuralLayers.every((f) => f.passed);

  return {
    alternativeId: alt.id,
    alternativeName: alt.name,
    ranAtIso: new Date().toISOString(),
    deflection,
    shearApplicable,
    shearTargets,
    flexuralApplicable,
    flexuralLayers,
    allDeflectionPassed,
    allShearPassed,
    allFlexuralPassed,
    allPassed: allDeflectionPassed && allShearPassed && allFlexuralPassed,
    warnings,
  };
}

export function runFullVerification(project: ProjectState): FullVerificationResult {
  const kcd = computeKcd(project.roadScale.doTinCayTK);
  const roadScaleResolved = {
    ...project.roadScale,
    ...kcd,
  };

  const traffic = computeTrafficSummary(
    project.vehicles,
    project.forecast,
    roadScaleResolved,
    project.storedNtk,
    project.projectInfo.doiTuongTK,
  );
  const subgradeResolved = resolveSubgrade(project.subgrade);
  const mod = computeDesignModulus(
    traffic.Ntt_trucLanNgDem,
    roadScaleResolved,
    project.forecast,
    project.designParams.loaiTangMat,
    project.projectInfo.doiTuongTK,
  );

  const modulusResolved = {
    ...mod,
    ...kcd,
  };

  const normalizedProject: ProjectState = {
    ...project,
    roadScale: roadScaleResolved,
  };

  const alternatives: Record<string, AlternativeVerificationResult> = {};
  for (const alt of project.alternatives) {
    alternatives[alt.id] = verifyAlternative(
      alt,
      normalizedProject,
      traffic,
      subgradeResolved,
      mod,
    );
  }

  return {
    traffic,
    subgradeResolved,
    modulusResolved,
    alternatives,
  };
}
