import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ADM_V1_ERROR_MESSAGE,
  checkDeflection,
  checkFlexural,
  checkShear,
  computeDesignModulus,
  computeE0FromCbr,
  computeEmin,
  computeEyc,
  computeKcd,
  computeLaneFactor,
  computeTrafficSummary,
  createDefaultVehicles,
  lookupToanDo,
  lookupToanDo31,
  lookupToanDo32,
  lookupToanDo33,
  lookupToanDo34,
  lookupToanDo35,
  lookupToanDo36,
  parseAdmProject,
  parseProjectJson,
  parseVatLieuDat,
  reduceTwoLayerSystem,
  resolveSubgrade,
  resolveSubgradeByMoisture,
  runFullVerification,
  serializeAdmProject,
  serializeProjectJson,
  serializeVatLieuDat,
} from '../../../src/toando/engine';
import { DEFAULT_MATERIALS, LEGACY_VATLIEU_90 } from '../../../src/toando/data/vatlieu';
import {
  createBlankProject,
  SAMPLE_TCCS38_EX1,
  SAMPLE_TCCS38_EX2,
  SAMPLE_VD_PROJECT,
} from '../../../src/toando/data/sampleVd';
import {
  COMPACTION_K_OPTIONS,
  getMinReliabilityForRoadClass,
  SOIL_MOISTURE_TYPES,
  TABLE_2_SURFACE_REF,
  TABLE_7_MIN_RELIABILITY,
  TABLE_F1_MIN_A1,
} from '../../../src/toando/data/tables22tcn211';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(
  __dirname,
  '../../../../toan do/Phần mềm ADM theo 22TCN-211 06',
);
const VD_ADM_PATH = path.join(DATA_DIR, 'VD22TCN211-06.adm');
const VATLIEU_DAT_PATH = path.join(DATA_DIR, 'VatLieu.dat');

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  return a.byteLength === b.byteLength && a.every((v, i) => v === b[i]);
}

describe('ADM Binary I/O (.adm and VatLieu.dat)', () => {
  it('parses VD22TCN211-06.adm and round-trips byte-for-byte', () => {
    const raw = fs.readFileSync(VD_ADM_PATH);
    expect(raw.byteLength).toBe(2072);

    const parsed = parseAdmProject(raw);
    expect(parsed.projectInfo).toEqual(SAMPLE_VD_PROJECT.projectInfo);
    expect(parsed.roadScale).toEqual(SAMPLE_VD_PROJECT.roadScale);
    expect(parsed.vehicles).toEqual(SAMPLE_VD_PROJECT.vehicles);
    expect(parsed.forecast).toEqual(SAMPLE_VD_PROJECT.forecast);
    expect(parsed.subgrade).toEqual(SAMPLE_VD_PROJECT.subgrade);
    expect(parsed.designParams.loaiTangMat).toBe('A1');
    expect(parsed.designParams.Eyc_MPa).toBeCloseTo(180.0364554, 6);
    expect(parsed.storedNtk).toBeCloseTo(1636.373, 6);
    expect(parsed.alternatives).toHaveLength(2);
    expect(parsed.alternatives[0].layers).toHaveLength(5);
    expect(parsed.alternatives[1].layers).toHaveLength(3);

    const reserialized = serializeAdmProject(parsed);
    expect(reserialized.byteLength).toBe(raw.byteLength);
    expect(bytesEqual(reserialized, raw)).toBe(true);
  });

  it('rejects ADM v1.0 or invalid binary headers with exact Vietnamese error', () => {
    const bad = new TextEncoder().encode('ADM ver 1.0' + '\0'.repeat(100));
    expect(() => parseAdmProject(bad)).toThrow(ADM_V1_ERROR_MESSAGE);
  });

  it('parses VatLieu.dat (90 records) and round-trips byte-for-byte', () => {
    const raw = fs.readFileSync(VATLIEU_DAT_PATH);
    expect(raw.byteLength).toBe(11329);

    const materials = parseVatLieuDat(raw);
    expect(materials).toHaveLength(90);
    expect(materials).toEqual(LEGACY_VATLIEU_90);

    const reserialized = serializeVatLieuDat(materials);
    expect(reserialized.byteLength).toBe(raw.byteLength);
    expect(bytesEqual(reserialized, raw)).toBe(true);
  });

  it('provides TCCS 38:2022 Appendix C default materials without penetration > 90 group', () => {
    expect(DEFAULT_MATERIALS.some((m) => m.group.includes('> 90'))).toBe(false);
    expect(DEFAULT_MATERIALS.some((m) => m.name.includes('polime'))).toBe(true);
    expect(DEFAULT_MATERIALS.some((m) => m.name.includes('Porous Asphalt'))).toBe(true);
    expect(DEFAULT_MATERIALS.some((m) => m.name.includes('4,75 mm'))).toBe(true);
    expect(DEFAULT_MATERIALS.some((m) => m.name.includes('BTNC 12,5'))).toBe(true);
    expect(DEFAULT_MATERIALS.some((m) => m.name.includes('BTNC 19'))).toBe(true);
    expect(DEFAULT_MATERIALS.some((m) => m.name.includes('HHBR 19'))).toBe(true);
    expect(DEFAULT_MATERIALS.some((m) => m.name.includes('ĐGCN 25'))).toBe(true);
    expect(DEFAULT_MATERIALS.some((m) => m.note.includes('TCVN 8858 (14 ngày)'))).toBe(true);
    expect(DEFAULT_MATERIALS.some((m) => m.note.includes('TCVN 8857'))).toBe(true);
  });

  it('supports .adm.json round-trip serialization', () => {
    const json = serializeProjectJson(SAMPLE_VD_PROJECT);
    const parsed = parseProjectJson(json);
    expect(parsed.projectInfo.congTrinh).toBe(SAMPLE_VD_PROJECT.projectInfo.congTrinh);
    expect(parsed.alternatives).toHaveLength(2);
  });
});

describe('Traffic, Subgrade, and Design Modulus (22TCN 211-06)', () => {
  it('computes default vehicles and ESAL conversion for VD22TCN211-06', () => {
    const defaults = createDefaultVehicles();
    expect(defaults).toHaveLength(7);
    expect(defaults[0].tenXe).toBe('Xe con các loại');

    const summaryNoOverride = computeTrafficSummary(
      SAMPLE_VD_PROJECT.vehicles,
      SAMPLE_VD_PROJECT.forecast,
      SAMPLE_VD_PROJECT.roadScale,
    );
    // Exact ADMv2.exe Class_Xe rounding (248.373 front + 1388 rear = 1636.373)
    expect(summaryNoOverride.Ntk_trucNgDem).toBe(1636.373);
    expect(summaryNoOverride.conversions[1].Ni_truoc).toBe(9.124);
    expect(summaryNoOverride.conversions[1].Ni_sau).toBe(15);

    const summaryStored = computeTrafficSummary(
      SAMPLE_VD_PROJECT.vehicles,
      SAMPLE_VD_PROJECT.forecast,
      SAMPLE_VD_PROJECT.roadScale,
      SAMPLE_VD_PROJECT.storedNtk,
    );
    expect(summaryStored.Ntk_trucNgDem).toBe(1636.373);
    expect(summaryStored.Ntt_trucLanNgDem).toBeCloseTo(572.73055, 5);
    expect(summaryStored.Ne_truc).toBeCloseTo(2.1521e6, -3);
  });

  it('computes lane factor fL and Kcd safety factors', () => {
    expect(computeLaneFactor(1, false)).toBe(1.0);
    expect(computeLaneFactor(2, false)).toBe(0.55);
    expect(computeLaneFactor(4, true)).toBe(0.35);
    expect(computeLaneFactor(6, true)).toBe(0.3);

    expect(computeKcd(0.95)).toEqual({
      Kcd_vong: 1.17,
      Kcd_truot: 1.0,
      Kcd_keoUon: 1.0,
    });
    expect(computeKcd(0.98)).toEqual({
      Kcd_vong: 1.29,
      Kcd_truot: 1.1,
      Kcd_keoUon: 1.1,
    });
  });

  it('computes Table 3-4 Eyc and Table 3-5 Emin accurately', () => {
    const eyc = computeEyc(572.73055, 100, 'A1');
    expect(eyc).toBeCloseTo(180.0364554, 6);
    expect(computeEmin('DUONG_O_TO', 'Đường cấp II', 'A1')).toBe(160);
    expect(computeEmin('DUONG_O_TO', 'Đường cấp II', 'A1', 'LGC')).toBe(140);

    const mod = computeDesignModulus(
      572.73055,
      SAMPLE_VD_PROJECT.roadScale,
      SAMPLE_VD_PROJECT.forecast,
      'A1',
    );
    expect(mod.Ett_MPa).toBeCloseTo(180.036455, 5);
  });

  it('interpolates subgrade soil parameters by relative moisture a', () => {
    expect(resolveSubgradeByMoisture('Sét', 0.6, 0.95, false)).toEqual({
      E0_MPa: 42,
      phi_deg: 24,
      C_MPa: 0.032,
    });
    expect(resolveSubgradeByMoisture('Sét', 0.55, 0.95, true)).toEqual({
      E0_MPa: 60,
      phi_deg: 27,
      C_MPa: 0.038,
    });
    expect(resolveSubgradeByMoisture('Cát mịn', 0.75, 0.95, false)).toEqual({
      E0_MPa: 40,
      phi_deg: 35,
      C_MPa: 0.005,
    });
    const interp = resolveSubgradeByMoisture('Á sét', 0.625, 0.95, false);
    expect(interp.E0_MPa).toBeCloseTo(41, 4);
    expect(interp.phi_deg).toBeCloseTo(22.5, 4);
  });
});

describe('Toán đồ 3-1..3-6 Lookup & #N/A Bounds', () => {
  it('looks up valid points across all 6 nomograms with pixel traces inside 880x600', () => {
    const td31 = lookupToanDo31(1.9091, 42 / 428.831);
    expect(td31.valid).toBe(true);
    expect(td31.value!).toBeGreaterThan(0.48);
    expect(td31.value!).toBeLessThan(0.52);
    expect(td31.segmentsPx.length).toBe(2);

    const td32 = lookupToanDo32(0.8, 10, 24);
    expect(td32.valid).toBe(true);
    expect(td32.value!).toBeGreaterThan(0.01);
    expect(td32.value!).toBeLessThan(0.1);
    expect(td32.segmentsPx.length).toBe(3);

    const td33 = lookupToanDo33(1.909, 8.68, 27);
    expect(td33.valid).toBe(true);
    expect(td33.value!).toBeCloseTo(0.0106, 2);

    const td34 = lookupToanDo34(63, 24);
    expect(td34.valid).toBe(true);
    expect(td34.value!).toBeCloseTo(-0.001386, 6);

    const td35 = lookupToanDo35(0.424, 9.01);
    expect(td35.valid).toBe(true);
    expect(td35.value!).toBeCloseTo(1.59, 1);

    const td36 = lookupToanDo36(0.848, 2.81, 4.6);
    expect(td36.valid).toBe(true);
    expect(td36.value!).toBeGreaterThan(0.3);
    expect(td36.value!).toBeLessThan(0.4);
  });

  it('returns #N/A for out-of-domain inputs on all 6 nomograms', () => {
    expect(lookupToanDo31(2.5, 0.1).displayValue).toBe('#N/A');
    expect(lookupToanDo32(1.0, 10, 52).displayValue).toBe('#N/A');
    expect(lookupToanDo33(4.5, 10, 24).displayValue).toBe('#N/A');
    expect(lookupToanDo34(110, 24).displayValue).toBe('#N/A');
    expect(lookupToanDo({ id: '3-5', x: 1.2, yOrCurve: 10 }).displayValue).toBe('#N/A');
    expect(lookupToanDo({ id: '3-6', x: 1.0, yOrCurve: 2, ray: 30 }).displayValue).toBe('#N/A');
  });
});

describe('2-Layer Reduction & Full 22TCN 211-06 Verification Engine', () => {
  it('reduces PA 1 layers bottom-up accurately', () => {
    const pa1 = SAMPLE_VD_PROJECT.alternatives[0];
    const red = reduceTwoLayerSystem(
      pa1.layers.map((l) => ({
        tenVatLieu: l.tenVatLieu,
        h_cm: l.chieuDay_cm,
        E_MPa: l.E_vong_30C,
      })),
      33,
    );
    expect(red.H_total_cm).toBe(63);
    expect(red.H_over_D).toBeCloseTo(1.90909, 4);
    expect(red.EtbPrime_MPa).toBeCloseTo(356.206, 1);
    // Table 3-6 interpolation at H/D = 1.90909: 1.198 + (1.90909 - 1.75)/0.25 * (1.210 - 1.198) = 1.205636
    expect(red.beta).toBeCloseTo(1.205636, 4);
    expect(red.Etb_dc_MPa).toBeCloseTo(429.455, 1);
  });

  it('runs full verification on VD22TCN211-06 PA 1 and PA 2 matching benchmarks', () => {
    const full = runFullVerification(SAMPLE_VD_PROJECT);
    expect(full.traffic.Ntk_trucNgDem).toBe(1636.373);
    expect(full.modulusResolved.Eyc_MPa).toBeCloseTo(180.0365, 3);

    const r1 = full.alternatives['pa-1'];
    expect(r1.deflection.Ech_MPa).toBeGreaterThan(210.64);
    expect(r1.deflection.passed).toBe(true);
    expect(r1.shearTargets).toHaveLength(1);
    // TCCS 38:2022 Table 12 discrete k2 at Ntt = 572.73 (< 1000) is 0.8:
    // Ctt = RoundTo(0.032 * 0.6 * 0.8 * 1.5, -3) = RoundTo(0.02304, -3) = 0.023
    expect(r1.shearTargets[0].k2).toBe(0.8);
    expect(r1.shearTargets[0].Ctt_MPa).toBeCloseTo(0.023, 3);
    expect(r1.shearTargets[0].tav_MPa).toBeCloseTo(-0.001386, 5);
    expect(r1.shearTargets[0].passed).toBe(true);
    expect(r1.flexuralLayers).toHaveLength(3);
    expect(r1.flexuralLayers.every((f) => f.passed)).toBe(true);
    expect(r1.allPassed).toBe(true);

    const r2 = full.alternatives['pa-2'];
    expect(r2.deflection.reduction.EtbPrime_MPa).toBeCloseTo(313.31, 1);
    expect(r2.shearTargets).toHaveLength(1);
    expect(r2.flexuralLayers).toHaveLength(1);
  });

  it('skips shear and flexural checks for Cấp thấp B1 pavements', () => {
    const b1Project = createBlankProject();
    b1Project.designParams.loaiTangMat = 'B1';
    b1Project.alternatives[0].layers = [
      {
        id: 'b1-l1',
        tang: 'TANG_MAT',
        isTangMat: true,
        sttTrongTang: 1,
        tenVatLieu: 'Cấp phối đá dăm loại I',
        chieuDay_cm: 20,
        E_vong_30C: 300,
        E_truot_60C: 300,
        E_keoUon_10_15C: 300,
        Rku_MPa: 0,
        C_MPa: 0,
        phi_deg: 0,
        ghiChu: '',
      },
    ];
    const full = runFullVerification(b1Project);
    const res = full.alternatives['pa-1'];
    expect(res.shearApplicable).toBe(false);
    expect(res.flexuralApplicable).toBe(false);
    expect(res.shearTargets).toHaveLength(0);
    expect(res.flexuralLayers).toHaveLength(0);
    expect(checkDeflection(b1Project.alternatives[0], b1Project, 42, 64).Ech_MPa).toBeGreaterThan(0);
    expect(checkShear(b1Project.alternatives[0], b1Project, 50, { E0_MPa: 42, phi_deg: 24, C_MPa: 0.032 })).toHaveLength(1);
    expect(checkFlexural(b1Project.alternatives[0], b1Project, 1e5, 42)).toHaveLength(0);
  });

  it('checks intermediate cohesive layer shear (C != 0), P120 axle, and NamDau / q=0 traffic', () => {
    const proj = createBlankProject();
    proj.designParams.loaiTangMat = 'A2';
    proj.forecast.khongCoSoLieuDieuTra = true;
    proj.forecast.llNamTTDirect_trucNgDem = 226;
    proj.forecast.namTinhToan = 'NAM_DAU';
    proj.forecast.quyLuatTangTruong_q = 0;
    proj.forecast.tlTrucQuyDoi_kN = 120;
    proj.forecast.duongKinhVetBanh_D_cm = 36;
    proj.alternatives[0].layers = [
      {
        id: 'l1',
        tang: 'TANG_MAT',
        isTangMat: true,
        sttTrongTang: 1,
        tenVatLieu: 'Cấp phối đá dăm loại I',
        chieuDay_cm: 18,
        E_vong_30C: 300,
        E_truot_60C: 300,
        E_keoUon_10_15C: 300,
        Rku_MPa: 0,
        C_MPa: 0,
        phi_deg: 0,
        ghiChu: '',
      },
      {
        id: 'l2',
        tang: 'TANG_MONG',
        isTangMat: false,
        sttTrongTang: 1,
        tenVatLieu: 'Cấp phối thiên nhiên loại A',
        chieuDay_cm: 34,
        E_vong_30C: 200,
        E_truot_60C: 200,
        E_keoUon_10_15C: 200,
        Rku_MPa: 0,
        C_MPa: 0.05,
        phi_deg: 40,
        ghiChu: '',
      },
    ];

    const full = runFullVerification(proj);
    expect(full.traffic.Ntk_trucNgDem).toBe(226);
    expect(full.traffic.Ntt_trucLanNgDem).toBeCloseTo(226 * 0.55, 5);
    expect(full.traffic.Ne_truc).toBeCloseTo(20 * 365 * 226 * 0.55, 2);
    expect(computeEyc(100, 120, 'A2')).toBe(133);

    const res = full.alternatives['pa-1'];
    // Should check shear on both intermediate C!=0 layer (Cấp phối thiên nhiên loại A) and Đất nền
    expect(res.shearTargets).toHaveLength(2);
    expect(res.shearTargets[0].targetName).toBe('Cấp phối thiên nhiên loại A');
    expect(res.shearTargets[0].isSubgrade).toBe(false);
    expect(res.shearTargets[1].targetName).toBe('Đất nền');
    expect(res.shearTargets[1].isSubgrade).toBe(true);
  });
});

describe('TCCS 38:2022/TCĐBVN Updates & Appendix D Verification', () => {
  it('verifies Appendix D.1 Example I (SAMPLE_TCCS38_EX1) matching TCCS 38:2022 PDF', () => {
    const full = runFullVerification(SAMPLE_TCCS38_EX1);
    expect(full.traffic.Ntk_trucNgDem).toBe(1636.373);
    expect(full.traffic.Ntt_trucLanNgDem).toBeCloseTo(572.73055, 4);
    expect(full.subgradeResolved).toEqual({ E0_MPa: 46, phi_deg: 27, C_MPa: 0.038 });
    expect(full.modulusResolved.Eyc_MPa).toBeCloseTo(180.0365, 3);
    expect(full.modulusResolved.Emin_MPa).toBe(160);

    const pa1 = full.alternatives['pa-1'];
    expect(pa1.deflection.reduction.H_total_cm).toBe(63);
    expect(pa1.deflection.reduction.EtbPrime_MPa).toBeCloseTo(356.206, 1);
    expect(pa1.deflection.reduction.beta).toBeCloseTo(1.2056, 3);
    expect(pa1.deflection.reduction.Etb_dc_MPa).toBeCloseTo(429.455, 1);
    expect(pa1.deflection.reduction.etbCapped).toBe(false);
    expect(pa1.deflection.Ech_MPa).toBeGreaterThan(210.6);
    expect(pa1.deflection.passed).toBe(true);

    expect(pa1.shearTargets).toHaveLength(1);
    expect(pa1.shearTargets[0].k1).toBe(0.6);
    expect(pa1.shearTargets[0].k2).toBe(0.8);
    expect(pa1.shearTargets[0].k3).toBe(1.5);
    expect(pa1.shearTargets[0].Ctt_MPa).toBeCloseTo(0.027, 3);
    expect(pa1.shearTargets[0].passed).toBe(true);

    expect(pa1.flexuralLayers).toHaveLength(3);
    expect(pa1.flexuralLayers.every((f) => f.k2 === 1.0 && f.passed)).toBe(true);
    expect(pa1.allPassed).toBe(true);
  });

  it('verifies Appendix D.2 Example II (SAMPLE_TCCS38_EX2) excluding non-structural Láng nhựa', () => {
    const full = runFullVerification(SAMPLE_TCCS38_EX2);
    expect(full.traffic.Ntk_trucNgDem).toBe(226);
    expect(full.traffic.Ntt_trucLanNgDem).toBeCloseTo(124.3, 4);
    expect(full.modulusResolved.Eyc_MPa).toBeCloseTo(125.159, 1);
    expect(full.modulusResolved.Emin_MPa).toBe(100);

    const pa1 = full.alternatives['pa-1'];
    expect(pa1.warnings.some((w) => w.includes('Láng nhựa 2 lớp'))).toBe(true);
    expect(pa1.deflection.reduction.H_total_cm).toBe(50);
    expect(pa1.deflection.reduction.EtbPrime_MPa).toBeCloseTo(229.09, 1);
    expect(pa1.deflection.reduction.Etb_dc_MPa).toBeCloseTo(270.1, 0);
    expect(pa1.deflection.Ech_MPa).toBeGreaterThan(137.6);
    expect(pa1.deflection.passed).toBe(true);

    expect(pa1.shearTargets).toHaveLength(2);
    expect(pa1.shearTargets[0].targetName).toBe('Cấp phối thiên nhiên loại A');
    expect(pa1.shearTargets[0].k2).toBe(0.8);
    expect(pa1.shearTargets[0].Ctt_MPa).toBeCloseTo(0.036, 4);
    // Table 11 Note 2 caps single-layer CPTN Etb_dc at 200 MPa (vs 222 uncapped in PDF text)
    expect(pa1.shearTargets[0].reductionBelow?.etbCapped).toBe(true);
    expect(pa1.shearTargets[0].reductionBelow?.Etb_dc_MPa).toBe(200);
    expect(pa1.shearTargets[0].tau_total_MPa).toBeCloseTo(0.0385, 3);
    expect(pa1.shearTargets[0].tau_allow_MPa).toBeCloseTo(0.0383, 3);
    expect(pa1.shearTargets[1].targetName).toBe('Đất nền');
    expect(pa1.shearTargets[1].k2).toBe(0.8);
    expect(pa1.shearTargets[1].Ctt_MPa).toBeCloseTo(0.027, 3);
    expect(pa1.shearTargets[1].passed).toBe(true);
    expect(pa1.flexuralLayers).toHaveLength(0);
  });

  it('fixes Table 10 Đường cấp VI Emin, Table 7 min reliability, Table 2 & Table F.1 refs', () => {
    expect(computeEmin('DUONG_O_TO', 'Đường cấp VI', 'A2')).toBe(80);
    expect(computeEmin('DUONG_O_TO', 'Đường cấp VI', 'A2', 'LGC')).toBe(65);
    expect(computeEmin('DUONG_O_TO', 'Đường chuyên dụng', 'A1')).toBe(0);

    expect(getMinReliabilityForRoadClass('DUONG_O_TO', 'Đường cao tốc')).toBe(0.9);
    expect(getMinReliabilityForRoadClass('DUONG_O_TO', 'Đường cấp III')).toBe(0.85);
    expect(getMinReliabilityForRoadClass('DUONG_O_TO', 'Đường cấp VI')).toBe(0.8);
    expect(getMinReliabilityForRoadClass('DUONG_O_TO', 'Đường chuyên dụng')).toBe(0.8);
    expect(getMinReliabilityForRoadClass('DUONG_DO_THI', 'Đường phố')).toBe(0.85);
    expect(TABLE_7_MIN_RELIABILITY.length).toBeGreaterThanOrEqual(7);
    expect(TABLE_2_SURFACE_REF).toHaveLength(5);
    expect(TABLE_F1_MIN_A1).toHaveLength(8);
    expect(COMPACTION_K_OPTIONS).toEqual([0.9, 0.95, 0.98, 1.0]);
  });

  it('computes LGC lane distribution factor per TCCS 38:2022 §7.11', () => {
    expect(computeLaneFactor(1, false, 'LGC')).toBe(0.5);
    expect(computeLaneFactor(2, false, 'LGC')).toBeCloseTo(0.55 * 0.5, 5);
    expect(computeLaneFactor(3, false, 'LGC')).toBeCloseTo(0.55 * 0.425, 5);
    expect(computeLaneFactor(4, true, 'LGC')).toBeCloseTo(0.35 * 0.35, 5);
    expect(computeLaneFactor(4, false, 'LGC')).toBeCloseTo(0.55 * 0.35, 5);
    expect(computeLaneFactor(6, true, 'LGC')).toBeCloseTo(0.3 * 0.35, 5);
  });

  it('resolves Á cát bụi nặng (legacy alias), damNenCaiTien (+20% E0), and CBR helpers', () => {
    expect(SOIL_MOISTURE_TYPES).toContain('Á cát bụi nặng');
    expect(SOIL_MOISTURE_TYPES).not.toContain('Á sét bụi nặng');

    const std = resolveSubgradeByMoisture('Á cát bụi nặng', 0.6, 0.98, false, false);
    const legacy = resolveSubgradeByMoisture('Á sét bụi nặng', 0.6, 0.98, false, false);
    expect(std).toEqual({ E0_MPa: 45, phi_deg: 26, C_MPa: 0.022 });
    expect(legacy).toEqual(std);

    const improved = resolveSubgradeByMoisture('Á cát bụi nặng', 0.6, 0.98, false, true);
    expect(improved.E0_MPa).toBeCloseTo(54, 4);

    const fromCfg = resolveSubgrade({
      xacDinhTheoDoAm: true,
      loaiDat: 'Á cát bụi nặng',
      doAmTuongDoi_a: 0.6,
      doChatYeuCau_K: 0.98,
      lanSoiSan: false,
      damNenCaiTien: true,
      E0_MPa: 45,
      phi_deg: 26,
      C_MPa: 0.022,
    });
    expect(fromCfg.E0_MPa).toBeCloseTo(54, 4);

    expect(computeE0FromCbr(10, false)).toBeCloseTo(7.93 * Math.pow(10, 0.85), 2);
    expect(computeE0FromCbr(10, true)).toBeCloseTo(4.68 * 10 + 12.48, 2);
  });

  it('handles B2 low-grade surface, HHBR/polime/Porous Asphalt fatigue, bazan k3, and Etb_dc cap', () => {
    expect(computeEyc(100, 100, 'B2')).toBe(0);
    expect(computeEmin('DUONG_O_TO', 'Đường cấp VI', 'B2')).toBe(0);

    const b2Project = createBlankProject();
    b2Project.designParams.loaiTangMat = 'B2';
    b2Project.alternatives[0].layers = [
      {
        id: 'b2-l1',
        tang: 'TANG_MAT',
        isTangMat: true,
        sttTrongTang: 1,
        tenVatLieu: 'Đất gia cố XM hoặc vôi 8%',
        chieuDay_cm: 25,
        E_vong_30C: 300,
        E_truot_60C: 300,
        E_keoUon_10_15C: 300,
        Rku_MPa: 0.25,
        C_MPa: 0,
        phi_deg: 0,
        ghiChu: '',
      },
    ];
    const b2Res = runFullVerification(b2Project).alternatives['pa-1'];
    expect(b2Res.shearApplicable).toBe(false);
    expect(b2Res.flexuralApplicable).toBe(false);
    expect(b2Res.shearTargets).toHaveLength(0);
    expect(b2Res.flexuralLayers).toHaveLength(0);

    // Etb_dc cap per Table 11 Note 2: uniform E = 300 with H/D > 0.5 would exceed 300 without clamp
    const capped = reduceTwoLayerSystem(
      [{ tenVatLieu: 'CPĐD I', h_cm: 30, E_MPa: 300 }],
      33,
    );
    expect(capped.etbCapped).toBe(true);
    expect(capped.Etb_dc_MPa).toBe(300);

    // Fatigue k2 for polime (1.0), HHBR (0.8), Porous Asphalt (0.8), and bazan k3 (1.5)
    const matProj = createBlankProject();
    matProj.forecast.khongCoSoLieuDieuTra = true;
    matProj.forecast.llNamTTDirect_trucNgDem = 1200;
    matProj.subgrade.loaiDat = 'Đất Bazan Tây nguyên';
    matProj.alternatives[0].layers = [
      {
        id: 'm1',
        tang: 'TANG_MAT',
        isTangMat: true,
        sttTrongTang: 1,
        tenVatLieu: 'BTN chặt polime (đá dăm ≥ 50%)',
        chieuDay_cm: 5,
        E_vong_30C: 420,
        E_truot_60C: 300,
        E_keoUon_10_15C: 1800,
        Rku_MPa: 2.8,
        C_MPa: 0,
        phi_deg: 0,
        ghiChu: '',
      },
      {
        id: 'm2',
        tang: 'TANG_MAT',
        isTangMat: true,
        sttTrongTang: 2,
        tenVatLieu: 'HHBR 19 (BTN bán rỗng)',
        chieuDay_cm: 7,
        E_vong_30C: 320,
        E_truot_60C: 250,
        E_keoUon_10_15C: 1200,
        Rku_MPa: 1.6,
        C_MPa: 0,
        phi_deg: 0,
        ghiChu: '',
      },
      {
        id: 'm3',
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
    const matRes = runFullVerification(matProj).alternatives['pa-1'];
    expect(matRes.flexuralLayers).toHaveLength(2);
    expect(matRes.flexuralLayers[0].materialClass).toBe('BTN');
    expect(matRes.flexuralLayers[0].k2).toBe(1.0);
    expect(matRes.flexuralLayers[1].materialClass).toBe('BTN');
    expect(matRes.flexuralLayers[1].k2).toBe(0.8);
    expect(matRes.shearTargets[0].k3).toBe(1.5);
    expect(matRes.shearTargets[0].k2).toBe(0.8);
  });
});
