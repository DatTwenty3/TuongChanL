import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import {
  ADM_V1_ERROR_MESSAGE,
  computeBeta,
  computeEmin,
  computeEyc,
  computeKcd,
  computeLaneFactor,
  evalToanDo31Internal,
  lookupToanDo,
  lookupToanDo31,
  lookupToanDo32,
  lookupToanDo33,
  lookupToanDo34,
  lookupToanDo35,
  lookupToanDo36,
  parseAdmProject,
  parseVatLieuDat,
  reduceTwoLayerSystem,
  resolveSubgradeByMoisture,
  runFullVerification,
  serializeAdmProject,
  serializeVatLieuDat,
} from '../../../src/toando/engine';
import {
  COMPACTION_K_OPTIONS,
  getMinReliabilityForRoadClass,
  SOIL_MOISTURE_TYPES,
  TABLE_2_SURFACE_REF,
  TABLE_3_4_EYC,
  TABLE_3_5_EMIN,
  TABLE_3_6_BETA,
  TABLE_3_8_K2_COHESION,
  TABLE_7_MIN_RELIABILITY,
  TABLE_8_KCD_KEOUON,
  TABLE_8_KCD_TRUOT,
  TABLE_8_KCD_VONG,
  TABLE_F1_MIN_A1,
} from '../../../src/toando/data/tables22tcn211';
import {
  createBlankProject,
  SAMPLE_TCCS38_EX1,
  SAMPLE_TCCS38_EX2,
} from '../../../src/toando/data/sampleVd';
import { LEGACY_VATLIEU_90 } from '../../../src/toando/data/vatlieu';
import { exportVerificationToXlsxBuffer } from '../../../src/toando/export';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_WEB = path.resolve(__dirname, '../../..');
const DATA_DIR = path.resolve(
  __dirname,
  '../../../../toan do/Phần mềm ADM theo 22TCN-211 06',
);
const VD_ADM_PATH = path.join(DATA_DIR, 'VD22TCN211-06.adm');
const VATLIEU_DAT_PATH = path.join(DATA_DIR, 'VatLieu.dat');
const CURVES_JSON_PATH = path.resolve(__dirname, '../../../../analysis-toando/toando-curves.json');
const TCCS38_TABLES_JSON_PATH = path.resolve(__dirname, '../../../../analysis-toando/tccs38-tables.json');

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  return a.byteLength === b.byteLength && a.every((v, i) => v === b[i]);
}

interface ScalarKnot {
  x: number;
  y: number;
}
interface PolyKnot {
  x: number;
  y: number[];
}

interface ToanDoCurvesSpec {
  toando_3_1: {
    h_d_axis: number[];
    eo_e1_axis: number[];
    grid: number[][];
  };
  toando_3_2: {
    divisor_scale: number;
    e1_e2_poly6_knots: PolyKnot[];
    phi_knots: ScalarKnot[];
  };
  toando_3_3: {
    divisor_scale: number;
    e1_e2_poly6_knots: PolyKnot[];
    phi_knots: ScalarKnot[];
  };
  toando_3_4: {
    divisor_scale: number;
    h_knots: ScalarKnot[];
  };
  toando_3_5: {
    e1_echm_poly6_knots: PolyKnot[];
  };
  toando_3_6: {
    divisor_scale: number;
    e1_e2_poly4_knots: PolyKnot[];
    e2_e3_knots: ScalarKnot[];
  };
}

function refLerp(x1: number, x2: number, y1: number, y2: number, x: number): number {
  return x1 === x2 ? y1 : y1 + ((x - x1) * (y2 - y1)) / (x2 - x1);
}

function refScalarKnots(knots: ScalarKnot[], x: number): number {
  if (x <= knots[0].x) return knots[0].y;
  if (x >= knots[knots.length - 1].x) return knots[knots.length - 1].y;
  for (let i = 0; i < knots.length - 1; i++) {
    if (x >= knots[i].x && x <= knots[i + 1].x) {
      return refLerp(knots[i].x, knots[i + 1].x, knots[i].y, knots[i + 1].y, x);
    }
  }
  return knots[knots.length - 1].y;
}

function refPolyKnots(knots: PolyKnot[], x: number): number[] {
  if (x <= knots[0].x) return [...knots[0].y];
  if (x >= knots[knots.length - 1].x) return [...knots[knots.length - 1].y];
  for (let i = 0; i < knots.length - 1; i++) {
    if (x >= knots[i].x && x <= knots[i + 1].x) {
      return knots[i].y.map((v, idx) =>
        refLerp(knots[i].x, knots[i + 1].x, v, knots[i + 1].y[idx], x),
      );
    }
  }
  return [...knots[knots.length - 1].y];
}

function refHorner(c: number[], x: number): number {
  return c.reduce((acc, ci) => acc * x + ci, 0);
}

function walkTextFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkTextFiles(full, acc);
    } else if (/\.(ts|tsx|js|mjs|css|html|json)$/i.test(entry.name) && entry.name !== 'package-lock.json') {
      acc.push(full);
    }
  }
  return acc;
}

describe('QA 1: Clean-Room & Licensing Absence Audit', () => {
  it('contains zero licensing, activation, HWID, trial, or crack artifacts in ToanDo module', () => {
    const scanDirs = [
      path.join(ROOT_WEB, 'src/toando'),
      path.join(ROOT_WEB, 'toan-do'),
      path.join(ROOT_WEB, 'tests/toando'),
    ].filter((d) => fs.existsSync(d));
    const files = scanDirs
      .flatMap((d) => walkTextFiles(d))
      .filter((f) => !f.endsWith('parity.test.ts') && !f.endsWith('e2e_browser.mjs'));
    const forbidden = /\b(hwid|machineId|machine_id|license|licensing|activation|crack|keygen|dongle|trial_days|clock_tamper)\b|kích hoạt|bản quyền|mã máy|dùng thử/i;
    const violations: string[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      if (forbidden.test(content)) {
        violations.push(path.relative(ROOT_WEB, file));
      }
    }

    expect(violations).toEqual([]);
  });
});

describe('QA 2: Binary Round-Trip & VD22TCN211-06.adm Verification Parity', () => {
  it('parses and byte-exact round-trips VD22TCN211-06.adm (2,072 B) and VatLieu.dat (11,329 B)', () => {
    const admBytes = fs.readFileSync(VD_ADM_PATH);
    expect(admBytes.byteLength).toBe(2072);
    expect(createHash('sha256').update(admBytes).digest('hex')).toBe(
      'f120a5bcec9f3e3c4ba8626961b1a364b154cf94f9d8433d21253e6779cd4e29',
    );

    const parsedAdm = parseAdmProject(admBytes);
    const rebuiltAdm = serializeAdmProject(parsedAdm);
    expect(rebuiltAdm.byteLength).toBe(2072);
    expect(bytesEqual(rebuiltAdm, admBytes)).toBe(true);

    // Reject v1.0 header
    const v1Buf = new TextEncoder().encode('ADM ver 1.0' + '\0'.repeat(100));
    expect(() => parseAdmProject(v1Buf)).toThrow(ADM_V1_ERROR_MESSAGE);

    const vlBytes = fs.readFileSync(VATLIEU_DAT_PATH);
    expect(vlBytes.byteLength).toBe(11329);
    expect(createHash('sha256').update(vlBytes).digest('hex')).toBe(
      '96f44d7544a82622dd382e67c85078111fcca0655e8c3007d2624ce73dbc759c',
    );

    const parsedVl = parseVatLieuDat(vlBytes);
    expect(parsedVl).toHaveLength(90);
    expect(parsedVl).toEqual(LEGACY_VATLIEU_90);
    const rebuiltVl = serializeVatLieuDat(parsedVl);
    expect(rebuiltVl.byteLength).toBe(11329);
    expect(bytesEqual(rebuiltVl, vlBytes)).toBe(true);
  });

  it('matches exact traffic, Eyc, PA 1, and PA 2 outputs on binary VD22TCN211-06.adm under TCCS 38:2022 Bảng 12', () => {
    const admBytes = fs.readFileSync(VD_ADM_PATH);
    const proj = parseAdmProject(admBytes);
    // Clear storedNtk to verify engine computes 1636.373 directly from vehicle rows
    const freshProj = { ...proj, storedNtk: undefined };
    const res = runFullVerification(freshProj);

    expect(res.traffic.Ntk_trucNgDem).toBe(1636.373);
    expect(res.traffic.Ntt_trucLanNgDem).toBeCloseTo(572.73055, 6);
    expect(res.traffic.Ne_truc).toBeCloseTo(2152131.9095, 2);
    expect(res.modulusResolved.Eyc_MPa).toBeCloseTo(180.0365, 4);
    expect(res.modulusResolved.Emin_MPa).toBe(160);
    expect(res.modulusResolved.Ett_MPa).toBeCloseTo(180.0365, 4);

    // PA 1
    const pa1 = res.alternatives[proj.alternatives[0].id];
    expect(pa1.alternativeName).toBe('Phương án 1');
    expect(pa1.deflection.reduction.H_total_cm).toBe(63);
    expect(pa1.deflection.reduction.H_over_D).toBeCloseTo(63 / 33, 6);
    expect(pa1.deflection.reduction.EtbPrime_MPa).toBeCloseTo(356.206, 2);
    expect(pa1.deflection.reduction.beta).toBeCloseTo(1.205636, 5);
    expect(pa1.deflection.reduction.Etb_dc_MPa).toBeCloseTo(429.455, 2);
    expect(pa1.deflection.Eyc_required_MPa).toBeCloseTo(210.643, 3);
    expect(pa1.deflection.Ech_MPa).toBeGreaterThan(210.643);
    expect(pa1.deflection.passed).toBe(true);

    expect(pa1.shearTargets).toHaveLength(1);
    const s1 = pa1.shearTargets[0];
    expect(s1.isSubgrade).toBe(true);
    expect(s1.reductionAbove.EtbPrime_MPa).toBeCloseTo(331.1, 1);
    expect(s1.tav_MPa).toBeCloseTo(-0.001386, 6);
    // TCCS 38:2022 Bảng 12 discrete K2 = 0.8 for Ntt < 1000 -> Ctt = RoundTo(0.032 * 0.6 * 0.8 * 1.5, -3) = 0.023
    expect(s1.k2).toBe(0.8);
    expect(s1.Ctt_MPa).toBeCloseTo(0.023, 3);
    expect(s1.passed).toBe(true);

    expect(pa1.flexuralLayers).toHaveLength(3);
    expect(pa1.flexuralLayers[0].k1).toBeCloseTo(0.4492, 3);
    expect(pa1.flexuralLayers[0].Rtt_ku_MPa).toBeCloseTo(1.2577, 3);
    expect(pa1.flexuralLayers[1].Rtt_ku_MPa).toBeCloseTo(0.8984, 3);
    expect(pa1.flexuralLayers[2].k1).toBeCloseTo(0.5751, 3);
    expect(pa1.flexuralLayers[2].Rtt_ku_MPa).toBeCloseTo(0.4601, 3);
    expect(pa1.allPassed).toBe(true);

    // PA 2
    const pa2 = res.alternatives[proj.alternatives[1].id];
    expect(pa2.alternativeName).toBe('Phương án 2');
    expect(pa2.deflection.reduction.H_total_cm).toBe(57);
    expect(pa2.deflection.reduction.EtbPrime_MPa).toBeCloseTo(313.31, 2);
    expect(pa2.shearTargets).toHaveLength(1);
    expect(pa2.shearTargets[0].reductionAbove.EtbPrime_MPa).toBeCloseTo(300, 3);
    expect(pa2.flexuralLayers).toHaveLength(1);
    expect(pa2.flexuralLayers[0].E1_MPa).toBe(2200);
  });

  it('exports valid ExcelJS workbook containing required TCCS 38:2022/TCĐBVN sections', async () => {
    const proj = parseAdmProject(fs.readFileSync(VD_ADM_PATH));
    const res = runFullVerification(proj);
    const buf = await exportVerificationToXlsxBuffer(proj, res);
    expect(buf.byteLength).toBeGreaterThan(5000);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Uint8Array.from(buf).buffer);
    expect(wb.worksheets.length).toBe(2);

    for (const ws of wb.worksheets) {
      const texts: string[] = [];
      ws.eachRow((row) => {
        row.eachCell((cell) => {
          if (cell.value !== null && cell.value !== undefined) {
            texts.push(String(cell.value));
          }
        });
      });
      const joined = texts.join('\n');
      expect(joined).toContain('BẢNG TÍNH KẾT CẤU ÁO ĐƯỜNG');
      expect(joined).toContain('Theo tiêu chuẩn TCCS 38:2022/TCĐBVN');
      expect(joined).not.toContain('Theo quy trình 22TCN 211-06');
      expect(joined).toContain('Bảng 1');
      expect(joined).toContain('Bảng 2');
      expect(joined).toContain('Bảng 3');
      expect(joined).toContain('III. KIỂM TOÁN');
    }
  });
});

describe('QA 3: Differential Toán đồ 3-1..3-6 Lookup vs toando-curves.json', () => {
  const curves = JSON.parse(fs.readFileSync(CURVES_JSON_PATH, 'utf8')) as ToanDoCurvesSpec;

  it('Toán đồ 3-1 matches 41x37 grid at boundaries, interior points, Eq (F-1), and #N/A', () => {
    const { h_d_axis, eo_e1_axis, grid } = curves.toando_3_1;
    // Exact grid corners & interior points
    const samples: Array<[number, number]> = [
      [0, 0],
      [0, 0.9],
      [2.0, 0],
      [2.0, 0.9],
      [0.5, 0.25],
      [1.25, 0.4],
      [1.9, 0.1],
      [1.375, 0.3125],
    ];
    for (const [hd, eo] of samples) {
      const res = lookupToanDo31(hd, eo);
      expect(res.valid).toBe(true);

      let r = 0;
      for (let i = 0; i < h_d_axis.length - 1; i++) {
        if (hd >= h_d_axis[i] && hd <= h_d_axis[i + 1]) {
          r = i;
          break;
        }
      }
      if (hd >= 2.0) r = h_d_axis.length - 2;
      let c = 0;
      for (let j = 0; j < eo_e1_axis.length - 1; j++) {
        if (eo >= eo_e1_axis[j] && eo <= eo_e1_axis[j + 1]) {
          c = j;
          break;
        }
      }
      if (eo >= 0.9) c = eo_e1_axis.length - 2;
      const v0 = refLerp(eo_e1_axis[c], eo_e1_axis[c + 1], grid[r][c], grid[r][c + 1], eo);
      const v1 = refLerp(eo_e1_axis[c], eo_e1_axis[c + 1], grid[r + 1][c], grid[r + 1][c + 1], eo);
      const expected = refLerp(h_d_axis[r], h_d_axis[r + 1], v0, v1, hd);
      expect(res.value!).toBeCloseTo(expected, 10);
    }

    // Eq. (F-1) for H/D > 2.0
    const f1 = evalToanDo31Internal(2.6, 0.15);
    const f1Expected =
      (1.05 * 0.15) / ((1 + 0.15) / Math.sqrt(1 + 4 * 2.6 * 2.6 * Math.pow(0.15, -0.67)) + 0.15);
    expect(f1).toBeCloseTo(f1Expected, 12);

    // #N/A bounds
    expect(lookupToanDo31(-0.01, 0.5).displayValue).toBe('#N/A');
    expect(lookupToanDo31(2.01, 0.5).displayValue).toBe('#N/A');
    expect(lookupToanDo31(1.0, -0.01).displayValue).toBe('#N/A');
    expect(lookupToanDo31(1.0, 0.91).displayValue).toBe('#N/A');
  });

  it('Toán đồ 3-2 matches polynomial & phi knots across boundaries, interior, and #N/A', () => {
    const spec = curves.toando_3_2;
    const cases: Array<[number, number, number]> = [
      [0.0, 2.0, 20.0],
      [2.0, 50.0, 46.0],
      [0.8, 10.0, 24.0],
      [1.35, 14.5, 29.0],
      [1.9, 8.5, 17.5],
    ];
    for (const [hd, e12, phi] of cases) {
      const res = lookupToanDo32(hd, e12, phi);
      const expected =
        refHorner(refPolyKnots(spec.e1_e2_poly6_knots, e12), hd) /
        (spec.divisor_scale * refScalarKnots(spec.phi_knots, phi));
      expect(res.valid).toBe(true);
      expect(res.value!).toBeCloseTo(expected, 10);
    }
    // Output > 0.20 axis max triggers #N/A cleanly instead of clipping off the yellow axis
    expect(lookupToanDo32(0.0, 2.0, 2.0).displayValue).toBe('#N/A');

    expect(lookupToanDo32(-0.1, 10, 24).displayValue).toBe('#N/A');
    expect(lookupToanDo32(2.05, 10, 24).displayValue).toBe('#N/A');
    expect(lookupToanDo32(1.0, 1.9, 24).displayValue).toBe('#N/A');
    expect(lookupToanDo32(1.0, 50.1, 24).displayValue).toBe('#N/A');
    expect(lookupToanDo32(1.0, 10, 1.9).displayValue).toBe('#N/A');
    expect(lookupToanDo32(1.0, 10, 46.1).displayValue).toBe('#N/A');
  });

  it('Toán đồ 3-3 matches polynomial & phi knots across boundaries, interior, and #N/A', () => {
    const spec = curves.toando_3_3;
    const cases: Array<[number, number, number]> = [
      [2.2, 5.0, 24.0],
      [4.0, 50.0, 46.0],
      [2.5, 12.5, 21.0],
      [3.1, 27.0, 35.0],
    ];
    for (const [hd, e12, phi] of cases) {
      const res = lookupToanDo33(hd, e12, phi);
      const expected =
        refHorner(refPolyKnots(spec.e1_e2_poly6_knots, e12), hd) /
        (spec.divisor_scale * refScalarKnots(spec.phi_knots, phi));
      expect(res.valid).toBe(true);
      expect(res.value!).toBeCloseTo(expected, 10);
    }

    expect(lookupToanDo33(-0.1, 10, 24).displayValue).toBe('#N/A');
    expect(lookupToanDo33(4.1, 10, 24).displayValue).toBe('#N/A');
    expect(lookupToanDo33(2.5, 4.9, 24).displayValue).toBe('#N/A');
    expect(lookupToanDo33(2.5, 50.1, 24).displayValue).toBe('#N/A');
    expect(lookupToanDo33(2.5, 10, 1.9).displayValue).toBe('#N/A');
    expect(lookupToanDo33(2.5, 10, 46.1).displayValue).toBe('#N/A');
  });

  it('Toán đồ 3-4 matches ray-slope table across boundaries, interior, and #N/A', () => {
    const spec = curves.toando_3_4;
    const cases: Array<[number, number]> = [
      [0, 5],
      [100, 40],
      [63, 24],
      [50, 13],
      [75, 17.5],
    ];
    for (const [H, phi] of cases) {
      const res = lookupToanDo34(H, phi);
      const expected = (refScalarKnots(spec.h_knots, phi) * H) / spec.divisor_scale;
      expect(res.valid).toBe(true);
      expect(res.value!).toBeCloseTo(expected, 12);
    }

    expect(lookupToanDo34(-1, 24).displayValue).toBe('#N/A');
    expect(lookupToanDo34(101, 24).displayValue).toBe('#N/A');
    expect(lookupToanDo34(50, 4.9).displayValue).toBe('#N/A');
    expect(lookupToanDo34(50, 40.1).displayValue).toBe('#N/A');
  });

  it('Toán đồ 3-5 matches poly6 knots across boundaries, interior, and #N/A', () => {
    const spec = curves.toando_3_5;
    const cases: Array<[number, number]> = [
      [0.0, 1.5],
      [1.0, 1.5],
      [0.424, 9.01],
      [0.35, 6.0],
      [0.85, 42.0],
      [1.0, 100.0],
    ];
    for (const [hd, ratio] of cases) {
      const res = lookupToanDo35(hd, ratio);
      const expected = Math.max(0, refHorner(refPolyKnots(spec.e1_echm_poly6_knots, ratio), hd));
      expect(res.valid).toBe(true);
      expect(res.value!).toBeCloseTo(expected, 10);
    }

    expect(lookupToanDo35(-0.01, 5).displayValue).toBe('#N/A');
    expect(lookupToanDo35(1.01, 5).displayValue).toBe('#N/A');
    expect(lookupToanDo35(0.3, 1.49).displayValue).toBe('#N/A');
    expect(lookupToanDo35(0.3, 100.1).displayValue).toBe('#N/A');
  });

  it('Toán đồ 3-6 matches poly4 + E2/E3 knots across boundaries, interior, and #N/A', () => {
    const spec = curves.toando_3_6;
    const cases: Array<[number, number, number]> = [
      [0.4, 1.0, 2.0],
      [2.0, 25.0, 25.0],
      [0.848, 2.81, 4.6],
      [1.25, 8.5, 11.5],
    ];
    for (const [hd, e12, e23] of cases) {
      const res = lookupToanDo36(hd, e12, e23);
      const expected =
        refHorner(refPolyKnots(spec.e1_e2_poly4_knots, e12), hd) /
        (spec.divisor_scale * refScalarKnots(spec.e2_e3_knots, e23));
      expect(res.valid).toBe(true);
      expect(res.value!).toBeCloseTo(expected, 10);
    }

    expect(lookupToanDo({ id: '3-6', x: -0.05, yOrCurve: 3, ray: 5 }).displayValue).toBe('#N/A');
    expect(lookupToanDo({ id: '3-6', x: 2.05, yOrCurve: 3, ray: 5 }).displayValue).toBe('#N/A');
    expect(lookupToanDo({ id: '3-6', x: 0.8, yOrCurve: 0.9, ray: 5 }).displayValue).toBe('#N/A');
    expect(lookupToanDo({ id: '3-6', x: 0.8, yOrCurve: 25.1, ray: 5 }).displayValue).toBe('#N/A');
    expect(lookupToanDo({ id: '3-6', x: 0.8, yOrCurve: 3, ray: 1.9 }).displayValue).toBe('#N/A');
    expect(lookupToanDo({ id: '3-6', x: 0.8, yOrCurve: 3, ray: 25.1 }).displayValue).toBe('#N/A');
  });
});

interface Tccs38TablesSpec {
  standard: string;
  table7_reliabilityByRoadClass: Array<{
    roadType: string;
    group: string;
    classes: string[];
    values: number[];
    min: number;
  }>;
  table8_safetyFactors: Record<string, { Kcd_dv: number; Kcd_ku: number; Kcd_tr: number }>;
  table9_Eyc_MPa: Record<'100' | '120', Array<{ Ntt: number; A1: number; A2: number; B1: number }>>;
  table10_Emin_MPa: {
    DUONG_O_TO: Array<{
      roadClass: string;
      A1: number;
      A2: number;
      B1: number;
      shoulder?: { A1?: number; A2?: number; B1?: number };
    }>;
    DUONG_DO_THI: Array<{ roadClass: string; A1: number; A2: number; B1: number }>;
  };
  table11_beta: Array<{ H_over_D: number; beta: number }>;
  table12_K2: {
    roadwayDiscrete: Array<{ label: string; Ntt_lt: number | null; K2: number }>;
    shoulder: { default: number; B1: number };
  };
  tableB4_subgrade: {
    Set_and_ASet: Array<{ a: number; E0: number; E0_gravel: number; phi: number; C: number }>;
    ASetNhe_and_ACatBuiNang: Array<{ a: number; E0: number; phi: number; C: number }>;
    ACatNhe_and_ACat: Array<{ a: number; E0: number; phi: number; C: number }>;
    CatMin: { E0: number; phi: number; C: number };
    DatBazanTayNguyen: Array<{ a: number; E0: number; phi: number; C: number }>;
  };
  tableF1_minA1Thickness_cm: Array<{
    Ne_range: string;
    standard_cm: number;
    onAsphaltBase_ge10cm_cm: number;
  }>;
}

describe('QA 4: TCCS 38:2022/TCĐBVN Differential Parity vs tccs38-tables.json & Phụ lục D', () => {
  const spec = JSON.parse(fs.readFileSync(TCCS38_TABLES_JSON_PATH, 'utf8')) as Tccs38TablesSpec;

  it('matches TCCS 38:2022 Bảng 7..12, Đường cấp VI (A2 = 80 / 65), and Bảng F.1 against tccs38-tables.json', () => {
    expect(spec.standard).toBe('TCCS 38:2022/TCĐBVN');

    // Bảng 7: minimum reliability by road type & class
    for (const rule of spec.table7_reliabilityByRoadClass) {
      const roadType = rule.roadType === 'DUONG_DO_THI' ? 'DUONG_DO_THI' : 'DUONG_O_TO';
      for (const cls of rule.classes) {
        expect(getMinReliabilityForRoadClass(roadType, cls)).toBe(rule.min);
      }
    }
    expect(TABLE_7_MIN_RELIABILITY.length).toBe(spec.table7_reliabilityByRoadClass.length);

    // Bảng 8: Kcđ safety factors
    for (const [relStr, factors] of Object.entries(spec.table8_safetyFactors)) {
      const rel = parseFloat(relStr);
      expect(TABLE_8_KCD_VONG[relStr]).toBe(factors.Kcd_dv);
      expect(TABLE_8_KCD_TRUOT[relStr]).toBe(factors.Kcd_tr);
      expect(TABLE_8_KCD_KEOUON[relStr]).toBe(factors.Kcd_ku);
      expect(computeKcd(rel)).toEqual({
        Kcd_vong: factors.Kcd_dv,
        Kcd_truot: factors.Kcd_tr,
        Kcd_keoUon: factors.Kcd_ku,
      });
    }

    // Bảng 9: Eyc (100 kN & 120 kN)
    expect(TABLE_3_4_EYC[100]).toEqual(spec.table9_Eyc_MPa['100']);
    expect(TABLE_3_4_EYC[120]).toEqual(spec.table9_Eyc_MPa['120']);
    for (const row of spec.table9_Eyc_MPa['100']) {
      if (row.A1 > 0) expect(computeEyc(row.Ntt, 100, 'A1')).toBeCloseTo(row.A1, 6);
      if (row.A2 > 0) expect(computeEyc(row.Ntt, 100, 'A2')).toBeCloseTo(row.A2, 6);
      if (row.B1 > 0) expect(computeEyc(row.Ntt, 100, 'B1')).toBeCloseTo(row.B1, 6);
    }

    // Bảng 10: Emin (including Đường cấp VI A2 = 80 / LGC = 65)
    for (const row of spec.table10_Emin_MPa.DUONG_O_TO) {
      expect(computeEmin('DUONG_O_TO', row.roadClass, 'A1')).toBe(row.A1);
      expect(computeEmin('DUONG_O_TO', row.roadClass, 'A2')).toBe(row.A2);
      expect(computeEmin('DUONG_O_TO', row.roadClass, 'B1')).toBe(row.B1);
      if (row.shoulder?.A1 !== undefined) {
        expect(computeEmin('DUONG_O_TO', row.roadClass, 'A1', 'LGC')).toBe(row.shoulder.A1);
      }
      if (row.shoulder?.A2 !== undefined) {
        expect(computeEmin('DUONG_O_TO', row.roadClass, 'A2', 'LGC')).toBe(row.shoulder.A2);
      }
      if (row.shoulder?.B1 !== undefined) {
        expect(computeEmin('DUONG_O_TO', row.roadClass, 'B1', 'LGC')).toBe(row.shoulder.B1);
      }
    }
    expect(computeEmin('DUONG_O_TO', 'Đường cấp VI', 'A2')).toBe(80);
    expect(computeEmin('DUONG_O_TO', 'Đường cấp VI', 'A2', 'LGC')).toBe(65);
    expect(TABLE_3_5_EMIN.DUONG_DO_THI).toEqual(spec.table10_Emin_MPa.DUONG_DO_THI);

    // Bảng 11: beta
    expect(TABLE_3_6_BETA).toEqual(spec.table11_beta);
    for (const row of spec.table11_beta) {
      expect(computeBeta(row.H_over_D)).toBeCloseTo(row.beta, 6);
    }

    // Bảng 12: discrete K2 thresholds
    expect(TABLE_3_8_K2_COHESION.map((r) => r.k2)).toEqual(
      spec.table12_K2.roadwayDiscrete.map((r) => r.K2),
    );

    // Bảng 2 & Bảng F.1 reference tables
    expect(TABLE_2_SURFACE_REF).toHaveLength(5);
    expect(TABLE_F1_MIN_A1.map((r) => ({ s: r.standard_cm, b: r.onAsphaltBase_ge10cm_cm }))).toEqual(
      spec.tableF1_minA1Thickness_cm.map((r) => ({ s: r.standard_cm, b: r.onAsphaltBase_ge10cm_cm })),
    );
  });

  it('verifies Phụ lục D.1 (SAMPLE_TCCS38_EX1) and Phụ lục D.2 (SAMPLE_TCCS38_EX2) parity', () => {
    // Example I (Phụ lục D.1)
    const ex1 = runFullVerification(SAMPLE_TCCS38_EX1);
    expect(ex1.traffic.Ntk_trucNgDem).toBe(1636.373);
    expect(ex1.traffic.Ntt_trucLanNgDem).toBeCloseTo(572.73055, 4);
    expect(ex1.traffic.Ne_truc).toBeCloseTo(2152131.91, 1);
    expect(ex1.modulusResolved.Eyc_MPa).toBeCloseTo(180.0365, 3);
    expect(ex1.modulusResolved.Emin_MPa).toBe(160);

    const pa1 = ex1.alternatives['pa-1'];
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

    // Example II (Phụ lục D.2)
    const ex2 = runFullVerification(SAMPLE_TCCS38_EX2);
    expect(ex2.traffic.Ntk_trucNgDem).toBe(226);
    expect(ex2.traffic.Ntt_trucLanNgDem).toBeCloseTo(124.3, 4);
    expect(ex2.modulusResolved.Eyc_MPa).toBeCloseTo(125.159, 1);
    expect(ex2.modulusResolved.Emin_MPa).toBe(100);

    const ex2Pa1 = ex2.alternatives['pa-1'];
    expect(ex2Pa1.warnings.some((w) => w.includes('Láng nhựa 2 lớp'))).toBe(true);
    expect(ex2Pa1.deflection.reduction.H_total_cm).toBe(50);
    expect(ex2Pa1.deflection.reduction.EtbPrime_MPa).toBeCloseTo(229.09, 1);
    expect(ex2Pa1.deflection.reduction.Etb_dc_MPa).toBeCloseTo(270.1, 0);
    expect(ex2Pa1.deflection.Ech_MPa).toBeGreaterThan(137.6);
    expect(ex2Pa1.deflection.passed).toBe(true);

    expect(ex2Pa1.shearTargets).toHaveLength(2);
    expect(ex2Pa1.shearTargets[0].targetName).toBe('Cấp phối thiên nhiên loại A');
    expect(ex2Pa1.shearTargets[0].k2).toBe(0.8);
    expect(ex2Pa1.shearTargets[0].Ctt_MPa).toBeCloseTo(0.036, 4);
    // Bảng 11 Chú thích 2 caps single-layer CPTN Etb_dc at max(Ei) = 200 MPa
    expect(ex2Pa1.shearTargets[0].reductionBelow?.etbCapped).toBe(true);
    expect(ex2Pa1.shearTargets[0].reductionBelow?.Etb_dc_MPa).toBe(200);
    expect(ex2Pa1.shearTargets[1].targetName).toBe('Đất nền');
    expect(ex2Pa1.shearTargets[1].Ctt_MPa).toBeCloseTo(0.027, 3);
    expect(ex2Pa1.shearTargets[1].passed).toBe(true);
  });

  it('verifies LGC §7.11 (0.50 / 0.425 / 0.35), Bảng 11 Chú thích 2 etbCapped, B2 exemption, and Á cát bụi nặng / damNenCaiTien', () => {
    // LGC §7.11 lane factors
    expect(computeLaneFactor(1, false, 'LGC')).toBeCloseTo(1.0 * 0.5, 6);
    expect(computeLaneFactor(2, false, 'LGC')).toBeCloseTo(0.55 * 0.5, 6);
    expect(computeLaneFactor(3, false, 'LGC')).toBeCloseTo(0.55 * 0.425, 6);
    expect(computeLaneFactor(4, true, 'LGC')).toBeCloseTo(0.35 * 0.35, 6);
    expect(computeLaneFactor(4, false, 'LGC')).toBeCloseTo(0.55 * 0.35, 6);

    // Bảng 11 Chú thích 2: Etb_dc capped at max(Ei)
    const capped = reduceTwoLayerSystem([{ tenVatLieu: 'CPĐD I', h_cm: 30, E_MPa: 300 }], 33);
    expect(capped.etbCapped).toBe(true);
    expect(capped.Etb_dc_MPa).toBe(300);

    // B2 exemption: Eyc=0, Emin=0, shear & flexural exempt
    expect(computeEyc(100, 100, 'B2')).toBe(0);
    expect(computeEmin('DUONG_O_TO', 'Đường cấp VI', 'B2')).toBe(0);
    const b2Proj = createBlankProject();
    b2Proj.designParams.loaiTangMat = 'B2';
    b2Proj.alternatives[0].layers = [
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
    const b2Res = runFullVerification(b2Proj).alternatives['pa-1'];
    expect(b2Res.shearApplicable).toBe(false);
    expect(b2Res.flexuralApplicable).toBe(false);
    expect(b2Res.shearTargets).toHaveLength(0);
    expect(b2Res.flexuralLayers).toHaveLength(0);

    // Bảng B.4: Á cát bụi nặng + K=0.98 + damNenCaiTien (+20% E0)
    expect(COMPACTION_K_OPTIONS).toContain(0.98);
    expect(SOIL_MOISTURE_TYPES).toContain('Á cát bụi nặng');
    expect(SOIL_MOISTURE_TYPES).not.toContain('Á sét bụi nặng');

    for (const row of spec.tableB4_subgrade.ASetNhe_and_ACatBuiNang) {
      expect(resolveSubgradeByMoisture('Á cát bụi nặng', row.a, 0.98, false, false)).toEqual({
        E0_MPa: row.E0,
        phi_deg: row.phi,
        C_MPa: row.C,
      });
      const improved = resolveSubgradeByMoisture('Á cát bụi nặng', row.a, 0.98, false, true);
      expect(improved.E0_MPa).toBeCloseTo(row.E0 * 1.2, 4);
      expect(improved.phi_deg).toBe(row.phi);
      expect(improved.C_MPa).toBe(row.C);
    }
    expect(resolveSubgradeByMoisture('Á sét bụi nặng', 0.6, 0.98, false, false)).toEqual({
      E0_MPa: 45,
      phi_deg: 26,
      C_MPa: 0.022,
    });
    for (const row of spec.tableB4_subgrade.Set_and_ASet) {
      expect(resolveSubgradeByMoisture('Sét', row.a, 0.95, true, false).E0_MPa).toBe(row.E0_gravel);
    }
    expect(resolveSubgradeByMoisture('Cát mịn', 0.75, 0.95, false, false)).toEqual({
      E0_MPa: spec.tableB4_subgrade.CatMin.E0,
      phi_deg: spec.tableB4_subgrade.CatMin.phi,
      C_MPa: spec.tableB4_subgrade.CatMin.C,
    });
  });
});
