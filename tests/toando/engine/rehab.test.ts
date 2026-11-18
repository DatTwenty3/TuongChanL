import { describe, expect, it } from 'vitest';
import {
  assessBang13Severity,
  computeBenkelmanEchCu,
  computeExistingLayersEchCu,
  createDefaultRehabilitationConfig,
  getZAlphaForReliability,
  parseAdmProject,
  parseProjectJson,
  resolveRehabilitationEchCu,
  runFullVerification,
  serializeAdmProject,
  serializeProjectJson,
  validateRehabilitationInputs,
} from '../../../src/toando/engine';
import {
  TABLE_13_DISTRESS_REF,
  Z_ALPHA_BY_RELIABILITY,
} from '../../../src/toando/data/tables22tcn211';
import {
  createBlankProject,
  SAMPLE_TCCS38_CH10,
  SAMPLE_TCCS38_CH10_MILL,
} from '../../../src/toando/data/sampleVd';
import type { ExistingPavementLayer, ProjectState } from '../../../src/toando/types/project';

describe('TCCS 38:2022 Chapter 10 — Data & Ech,cu Resolution', () => {
  it('provides Table 13 (9 rows) and Z_alpha lookup matching TCVN 8867', () => {
    expect(TABLE_13_DISTRESS_REF).toHaveLength(9);
    expect(Z_ALPHA_BY_RELIABILITY['0.95']).toBe(1.645);
    expect(getZAlphaForReliability(0.98)).toBe(2.054);
    expect(getZAlphaForReliability(0.95)).toBe(1.645);
    expect(getZAlphaForReliability(0.9)).toBe(1.282);
    expect(getZAlphaForReliability(0.85)).toBe(1.036);
    expect(getZAlphaForReliability(0.8)).toBe(0.842);
  });

  it('computes exact Benkelman TCVN 8867 Ech,cu = 180.18 MPa at l_tt = 1.00 mm', () => {
    const stats = computeBenkelmanEchCu({
      inputMode: 'STATS',
      readings_mm: [],
      l_tb_mm: 1.0,
      S_mm: 0,
      Z_alpha: 1.645,
      K_t: 1.0,
      K_am: 1.0,
      p_do_MPa: 0.6,
      D_do_cm: 33.0,
      mu: 0.3,
    });
    expect(stats.l_dc_mm).toBeCloseTo(1.0, 6);
    expect(stats.l_tt_mm).toBeCloseTo(1.0, 6);
    expect(stats.echCu_MPa).toBe(180.18);

    // POINTS mode sample statistics
    const ptsStats = computeBenkelmanEchCu({
      inputMode: 'POINTS',
      readings_mm: [0.8, 1.0, 1.2],
      l_tb_mm: 0,
      S_mm: 0,
      Z_alpha: 1.645,
      K_t: 1.05,
      K_am: 1.1,
      p_do_MPa: 0.6,
      D_do_cm: 33.0,
      mu: 0.3,
    });
    expect(ptsStats.n).toBe(3);
    expect(ptsStats.l_tb_mm).toBeCloseTo(1.0, 6);
    expect(ptsStats.S_mm).toBeCloseTo(0.2, 6);
    expect(ptsStats.Cv).toBeCloseTo(0.2, 6);
    expect(ptsStats.l_dc_mm).toBeCloseTo(1.329, 6);
    expect(ptsStats.l_tt_mm).toBeCloseTo(1.329 * 1.05 * 1.1, 6);
    expect(ptsStats.echCu_MPa).toBeCloseTo(
      (10 * 0.6 * 33 * 0.91) / (1.329 * 1.05 * 1.1),
      2,
    );
  });

  it('resolves Direct FWD with seasonal factor K_dc and Layer Stack with K_hh reduction', () => {
    const rehab = createDefaultRehabilitationConfig();
    rehab.echMethod = 'DIRECT_FWD';
    rehab.directEchCu_MPa = 150;
    rehab.directKdc = 0.85;
    const fwdRes = resolveRehabilitationEchCu(rehab, 42, 33, 0.95);
    expect(fwdRes.echCu_MPa).toBe(127.5);

    const existingLayers: ExistingPavementLayer[] = [
      {
        id: 'old-m1',
        tang: 'TANG_MONG',
        isTangMat: false,
        sttTrongTang: 1,
        tenVatLieu: 'CPĐD loại I cũ',
        chieuDay_cm: 20,
        E_vong_30C: 300,
        E_truot_60C: 300,
        E_keoUon_10_15C: 300,
        Rku_MPa: 0,
        C_MPa: 0,
        phi_deg: 0,
        ghiChu: '',
        K_hh: 0.8,
      },
      {
        id: 'old-m2',
        tang: 'TANG_MONG',
        isTangMat: false,
        sttTrongTang: 2,
        tenVatLieu: 'CPTN loại A cũ',
        chieuDay_cm: 20,
        E_vong_30C: 200,
        E_truot_60C: 200,
        E_keoUon_10_15C: 200,
        Rku_MPa: 0,
        C_MPa: 0.05,
        phi_deg: 40,
        ghiChu: '',
        K_hh: 0.9,
      },
    ];

    const stackFull = computeExistingLayersEchCu(existingLayers, 42, 33);
    const stackUndamaged = computeExistingLayersEchCu(
      existingLayers.map((l) => ({ ...l, K_hh: 1.0 })),
      42,
      33,
    );
    expect(stackFull.effectiveLayers).toHaveLength(2);
    expect(stackFull.effectiveLayers[0].E_vong_30C).toBe(240);
    expect(stackFull.effectiveLayers[1].E_vong_30C).toBe(180);
    expect(stackFull.echCu_MPa).toBeGreaterThan(42);
    expect(stackFull.echCu_MPa).toBeLessThan(stackUndamaged.echCu_MPa);
  });

  it('assesses Table 13 distress severity and recommends appropriate rehab strategy', () => {
    const light = assessBang13Severity({
      segmentName: 'Đoạn 1',
      segmentLength_m: 500,
      oldSurfaceGrade: 'A1',
      crackingLevel: 'NHE',
      ruttingDepth_mm: 8,
      localizedSink_mm: 15,
      hasReflectiveCrackRisk: false,
      hasWidening: false,
    });
    expect(light.overall).toBe('NHE');
    expect(light.overallLabel).toBe('Nhẹ');
    expect(light.suggestedStrategy).toBe('DIRECT_OVERLAY');

    const mill = assessBang13Severity({
      segmentName: 'Đoạn 2',
      segmentLength_m: 600,
      oldSurfaceGrade: 'A1',
      crackingLevel: 'NANG',
      ruttingDepth_mm: 28,
      localizedSink_mm: 20,
      hasReflectiveCrackRisk: false,
      hasWidening: false,
    });
    expect(mill.rutting.label).toBe('Nặng');
    expect(mill.localizedSink.label).toBe('Nhẹ');
    expect(mill.overall).toBe('NANG');
    expect(mill.suggestedStrategy).toBe('MILL_AND_OVERLAY');

    const rebuild = assessBang13Severity({
      segmentName: 'Đoạn 3',
      segmentLength_m: 400,
      oldSurfaceGrade: 'A2',
      crackingLevel: 'VUA',
      ruttingDepth_mm: 18,
      localizedSink_mm: 58,
      hasReflectiveCrackRisk: false,
      hasWidening: false,
    });
    expect(rebuild.localizedSink.label).toBe('Nặng');
    expect(rebuild.suggestedStrategy).toBe('FULL_REBUILD');
  });
});

describe('TCCS 38:2022 Chapter 10 — Verification Engine & Edge Cases', () => {
  it('verifies SAMPLE_TCCS38_CH10 (DIRECT_OVERLAY + Benkelman + isBuVenh exclusion + full-stack shear)', () => {
    const full = runFullVerification(SAMPLE_TCCS38_CH10);
    const pa1 = full.alternatives['pa-1'];
    expect(pa1.rehabSummary).toBeDefined();
    expect(pa1.rehabSummary?.strategy).toBe('DIRECT_OVERLAY');
    expect(pa1.rehabSummary?.echMethod).toBe('BENKELMAN');
    expect(pa1.rehabSummary?.echCu_MPa).toBeGreaterThan(140);
    expect(pa1.rehabSummary?.echCu_MPa).toBeLessThan(170);

    // Leveling course (3 cm) excluded from 15 cm overlay structural stack
    expect(pa1.rehabSummary?.excludedBuVenhLayers).toHaveLength(1);
    expect(pa1.rehabSummary?.excludedBuVenhLayers[0].chieuDay_cm).toBe(3);
    expect(pa1.deflection.reduction.H_total_cm).toBe(15);
    expect(pa1.deflection.foundationModulus_MPa).toBe(pa1.rehabSummary?.echCu_MPa);
    expect(pa1.deflection.foundationLabel).toContain('Ech,cũ');
    expect(pa1.deflection.passed).toBe(true);

    // Full-stack shear checks both old cohesive CPTN (C=0.05*0.9=0.045) and Đất nền (H = 15 + 44 = 59 cm)
    expect(pa1.rehabSummary?.shearOldStackUsed).toBe(true);
    expect(pa1.shearTargets).toHaveLength(2);
    expect(pa1.shearTargets[1].isSubgrade).toBe(true);
    expect(pa1.shearTargets[1].H_cm).toBe(59);
    expect(pa1.shearTargets[1].passed).toBe(true);

    // Flexural checks the 2 monolithic BTNC overlay layers on Ech,cu
    expect(pa1.flexuralLayers).toHaveLength(2);
    expect(pa1.flexuralLayers[1].Echm_MPa).toBe(pa1.rehabSummary?.echCu_MPa);
    expect(pa1.allPassed).toBe(true);
  });

  it('verifies SAMPLE_TCCS38_CH10_MILL (MILL_AND_OVERLAY + LAYER_STACK)', () => {
    const full = runFullVerification(SAMPLE_TCCS38_CH10_MILL);
    const pa1 = full.alternatives['pa-1'];
    expect(pa1.rehabSummary?.strategy).toBe('MILL_AND_OVERLAY');
    expect(pa1.rehabSummary?.echMethod).toBe('LAYER_STACK');
    expect(pa1.rehabSummary?.existingReduction?.H_total_cm).toBe(36);
    expect(pa1.rehabSummary?.echCu_MPa).toBeGreaterThan(100);
    expect(pa1.deflection.passed).toBe(true);
    expect(pa1.shearTargets.some((s) => s.isSubgrade)).toBe(true);
  });

  it('handles 0.90 < E0/E1 <= 1.00 boundary interpolation, E0/E1 > 1.00 warning, and 0 overlay layers', () => {
    const base: ProjectState = structuredClone(SAMPLE_TCCS38_CH10);
    base.rehabilitation!.echMethod = 'DIRECT_FWD';
    base.rehabilitation!.directKdc = 1.0;

    // 1) 0.90 < E0'/E1 <= 1.00: overlay single layer E_vong = 200 MPa (H=20 cm -> H/D=0.606), Ech,cu = 190 MPa -> E0'/E1 = 0.95
    base.rehabilitation!.directEchCu_MPa = 190;
    base.alternatives[0].layers = [
      {
        id: 'ov-1',
        tang: 'TANG_MAT',
        isTangMat: true,
        sttTrongTang: 1,
        tenVatLieu: 'HHBR 19 (BTN bán rỗng)',
        chieuDay_cm: 20,
        E_vong_30C: 200,
        E_truot_60C: 200,
        E_keoUon_10_15C: 250,
        Rku_MPa: 1.6,
        C_MPa: 0,
        phi_deg: 0,
        ghiChu: '',
      },
    ];
    const interpRes = runFullVerification(base).alternatives['pa-1'];
    expect(interpRes.deflection.e0RatioExtrapolated).toBe(true);
    expect(interpRes.deflection.Ech_MPa).toBeGreaterThan(190);
    expect(interpRes.deflection.Ech_MPa).toBeLessThan(200);
    // Also E1/Echm = 250 / 190 = 1.316 < 1.5 triggers Eq. (E.2)-(E.3) analytical fallback
    expect(interpRes.flexuralLayers[0].usedAnalyticalFallback).toBe(true);
    expect(interpRes.warnings.some((w) => w.includes('E₁/Ech.m'))).toBe(true);

    // 2) E0'/E1 > 1.00 warning
    base.rehabilitation!.directEchCu_MPa = 240;
    const softerRes = runFullVerification(base).alternatives['pa-1'];
    expect(softerRes.warnings.some((w) => w.includes('ngoài miền Hình 2'))).toBe(true);

    // 3) 0 structural overlay layers (only leveling course)
    base.rehabilitation!.directEchCu_MPa = 210;
    base.alternatives[0].layers = [
      {
        ...base.alternatives[0].layers[0],
        id: 'ov-bv-only',
        isBuVenh: true,
      },
    ];
    const zeroOv = runFullVerification(base).alternatives['pa-1'];
    expect(zeroOv.deflection.reduction.H_total_cm).toBe(0);
    expect(zeroOv.deflection.Ech_MPa).toBe(210);
    expect(zeroOv.rehabSummary?.existingSurfaceAlreadyMeetsEyc).toBe(true);
    expect(zeroOv.deflection.passed).toBe(true);
  });

  it('handles thick overlay H_tc/D > 2.0 via Bacbero Eq. (E.1) and optional checkFlexural on retained layers', () => {
    const proj: ProjectState = structuredClone(SAMPLE_TCCS38_CH10);
    proj.rehabilitation!.echMethod = 'LAYER_STACK';
    proj.rehabilitation!.existingLayers = [
      {
        id: 'ret-ctb',
        tang: 'TANG_MONG',
        isTangMat: false,
        sttTrongTang: 1,
        tenVatLieu: 'Đá dăm gia cố XM cũ (Rn ≥ 4 MPa)',
        chieuDay_cm: 18,
        E_vong_30C: 600,
        E_truot_60C: 600,
        E_keoUon_10_15C: 600,
        Rku_MPa: 0.8,
        C_MPa: 0,
        phi_deg: 0,
        ghiChu: '',
        K_hh: 0.8,
        checkFlexural: true,
      },
    ];
    // Make overlay > 66 cm (H/D > 2.0 for D = 33 cm)
    proj.alternatives[0].layers = [
      {
        id: 'thick-1',
        tang: 'TANG_MAT',
        isTangMat: true,
        sttTrongTang: 1,
        tenVatLieu: 'BTNC 12,5 (đá dăm ≥ 50%)',
        chieuDay_cm: 10,
        E_vong_30C: 420,
        E_truot_60C: 300,
        E_keoUon_10_15C: 1800,
        Rku_MPa: 2.8,
        C_MPa: 0,
        phi_deg: 0,
        ghiChu: '',
      },
      {
        id: 'thick-2',
        tang: 'TANG_MONG',
        isTangMat: false,
        sttTrongTang: 1,
        tenVatLieu: 'Cấp phối đá dăm loại I',
        chieuDay_cm: 60,
        E_vong_30C: 300,
        E_truot_60C: 300,
        E_keoUon_10_15C: 300,
        Rku_MPa: 0,
        C_MPa: 0,
        phi_deg: 0,
        ghiChu: '',
      },
    ];
    const res = runFullVerification(proj).alternatives['pa-1'];
    expect(res.deflection.usedFormulaF1).toBe(true);
    expect(res.flexuralLayers.some((f) => f.layerName.includes('lớp cũ giữ lại'))).toBe(true);
  });

  it('warns clearly and does not silently pass shear when both existingLayers and H_cu are missing', () => {
    const proj: ProjectState = structuredClone(SAMPLE_TCCS38_CH10);
    proj.rehabilitation!.echMethod = 'DIRECT_FWD';
    proj.rehabilitation!.directEchCu_MPa = 140;
    proj.rehabilitation!.existingLayers = [];
    proj.rehabilitation!.totalExistingThickness_cm = undefined;

    const resMissing = runFullVerification(proj).alternatives['pa-1'];
    expect(resMissing.rehabSummary?.shearOldStackUsed).toBe(false);
    expect(resMissing.rehabSummary?.subgradeShearSkippedReason).toContain('Thiếu chiều dày kết cấu cũ');
    expect(resMissing.allShearPassed).toBe(false);
    expect(resMissing.allPassed).toBe(false);

    // When H_cu IS provided, subgrade shear uses equivalent old-layer thickness approximation
    proj.rehabilitation!.totalExistingThickness_cm = 40;
    const resWithH = runFullVerification(proj).alternatives['pa-1'];
    expect(resWithH.rehabSummary?.shearOldStackUsed).toBe(true);
    expect(resWithH.rehabSummary?.subgradeShearSkippedReason).toBeUndefined();
    expect(resWithH.shearTargets.some((s) => s.isSubgrade && s.H_cm === 55)).toBe(true);
    expect(resWithH.allShearPassed).toBe(true);
  });

  it('runs standard new-pavement verification when strategy === FULL_REBUILD', () => {
    const proj: ProjectState = structuredClone(SAMPLE_TCCS38_CH10);
    proj.rehabilitation!.strategy = 'FULL_REBUILD';
    // Give full new-pavement structure
    proj.alternatives[0].layers = [
      {
        id: 'new-1',
        tang: 'TANG_MAT',
        isTangMat: true,
        sttTrongTang: 1,
        tenVatLieu: 'BTNC 12,5 (đá dăm ≥ 50%)',
        chieuDay_cm: 6,
        E_vong_30C: 420,
        E_truot_60C: 300,
        E_keoUon_10_15C: 1800,
        Rku_MPa: 2.8,
        C_MPa: 0,
        phi_deg: 0,
        ghiChu: '',
      },
      {
        id: 'new-2',
        tang: 'TANG_MONG',
        isTangMat: false,
        sttTrongTang: 1,
        tenVatLieu: 'Cấp phối đá dăm loại I',
        chieuDay_cm: 30,
        E_vong_30C: 300,
        E_truot_60C: 300,
        E_keoUon_10_15C: 300,
        Rku_MPa: 0,
        C_MPa: 0,
        phi_deg: 0,
        ghiChu: '',
      },
    ];
    const res = runFullVerification(proj).alternatives['pa-1'];
    expect(res.rehabSummary?.strategy).toBe('FULL_REBUILD');
    expect(res.deflection.foundationModulus_MPa).toBe(42);
    expect(res.shearTargets[0].H_cm).toBe(36);
  });

  it('triggers all 9 Chapter 10 validation rules in validateRehabilitationInputs', () => {
    const proj: ProjectState = createBlankProject();
    proj.projectInfo.loaiTK = 'CAI_TAO';
    proj.rehabilitation = createDefaultRehabilitationConfig();
    proj.rehabilitation.assessment.segmentLength_m = 1500; // Rule 1
    proj.rehabilitation.echMethod = 'BENKELMAN';
    proj.rehabilitation.benkelman.inputMode = 'POINTS';
    proj.rehabilitation.benkelman.readings_mm = [0.5]; // Rule 3 (< 2 pts) -> also Rule 4 (Wait: 1 pt gives S=0, l_tb=0.5 so Ech>0)
    proj.rehabilitation.assessment.hasReflectiveCrackRisk = true; // Rule 7 (< 14 cm asphalt)
    proj.rehabilitation.existingLayers = [];
    proj.rehabilitation.totalExistingThickness_cm = undefined; // Rule 8
    proj.alternatives[0].layers = [
      {
        id: 'l-asph',
        tang: 'TANG_MAT',
        isTangMat: true,
        sttTrongTang: 1,
        tenVatLieu: 'BTNC 12,5',
        chieuDay_cm: 5,
        E_vong_30C: 100, // deliberately low for Rule 9 later
        E_truot_60C: 100,
        E_keoUon_10_15C: 1000,
        Rku_MPa: 2.0,
        C_MPa: 0,
        phi_deg: 0,
        ghiChu: '',
      },
      {
        id: 'l-bv-cpdd',
        tang: 'TANG_MONG',
        isTangMat: false,
        sttTrongTang: 1,
        tenVatLieu: 'Cấp phối đá dăm loại I',
        chieuDay_cm: 4,
        E_vong_30C: 300,
        E_truot_60C: 300,
        E_keoUon_10_15C: 300,
        Rku_MPa: 0,
        C_MPa: 0,
        phi_deg: 0,
        ghiChu: '',
        isBuVenh: true, // Rule 6 (non-asphalt leveling under asphalt overlay)
      },
      {
        id: 'l-bv-xm',
        tang: 'TANG_MONG',
        isTangMat: false,
        sttTrongTang: 2,
        tenVatLieu: 'Đá dăm gia cố xi măng',
        chieuDay_cm: 5,
        E_vong_30C: 600,
        E_truot_60C: 600,
        E_keoUon_10_15C: 600,
        Rku_MPa: 0.8,
        C_MPa: 0,
        phi_deg: 0,
        ghiChu: '',
        isBuVenh: true, // Rule 5 (inorganic binder forbidden in leveling course)
      },
    ];

    const issues1 = validateRehabilitationInputs(proj);
    const ids1 = issues1.map((i) => i.id);
    expect(ids1).toContain('segment-length');
    expect(ids1).toContain('benkelman-min-points');
    expect(ids1).toContain('reflective-cracking-thickness');
    expect(ids1).toContain('missing-subgrade-shear-data');
    expect(ids1.some((id) => id.startsWith('bu-venh-inorganic'))).toBe(true);
    expect(ids1.some((id) => id.startsWith('bu-venh-material'))).toBe(true);

    // Trigger Rule 2 (Cv > 0.25) and Rule 9 (Ech,cu / Etb_dc > 1.0)
    proj.rehabilitation.benkelman.readings_mm = [0.2, 1.0, 0.2, 1.0]; // mean=0.6, S=0.46188 -> Cv=0.77 > 0.25
    const issues2 = validateRehabilitationInputs(proj);
    expect(issues2.map((i) => i.id)).toContain('benkelman-cv');
    expect(issues2.map((i) => i.id)).toContain('overlay-weaker-than-existing');

    // Trigger Rule 4 (Ech,cu <= 0)
    proj.rehabilitation.echMethod = 'DIRECT_FWD';
    proj.rehabilitation.directEchCu_MPa = 0;
    const issues3 = validateRehabilitationInputs(proj);
    expect(issues3.map((i) => i.id)).toContain('ech-cu-positive');
  });

  it('round-trips rehabilitation and isBuVenh in .adm.json and preserves .adm v2 backward compatibility', () => {
    const json = serializeProjectJson(SAMPLE_TCCS38_CH10);
    const parsedJson = parseProjectJson(json);
    expect(parsedJson.projectInfo.loaiTK).toBe('CAI_TAO');
    expect(parsedJson.rehabilitation?.strategy).toBe('DIRECT_OVERLAY');
    expect(parsedJson.rehabilitation?.benkelman.readings_mm).toHaveLength(8);
    expect(parsedJson.alternatives[0].layers[2].isBuVenh).toBe(true);

    const bin = serializeAdmProject(SAMPLE_TCCS38_CH10);
    const parsedBin = parseAdmProject(bin);
    expect(parsedBin.projectInfo.loaiTK).toBe('CAI_TAO');
    expect(parsedBin.alternatives[0].layers).toHaveLength(3);
  });
});
