import { describe, it, expect } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import ExcelJS from 'exceljs';
import {
  SAMPLE_TCCS38_CH10,
  SAMPLE_TCCS38_CH10_MILL,
  SAMPLE_TCCS38_EX1,
  SAMPLE_VD_PROJECT,
} from '../../../src/toando/data/sampleVd';
import { runFullVerification } from '../../../src/toando/engine';
import {
  EQUATION_ASSETS,
  RvVongReport,
  RvTruotReport,
  RvTruotAllReport,
  RvKeoUonReport,
  RvKeoUonAllReport,
  buildRvVongSummaryText,
  buildRvTruotSummaryText,
  buildRvKeoUonSummaryText,
} from '../../../src/toando/reports';
import {
  buildVerificationWorkbook,
  exportVerificationToXlsxBuffer,
} from '../../../src/toando/export';
import type {
  AlternativeVerificationResult,
  FullVerificationResult,
  TwoLayerReductionResult,
} from '../../../src/toando/types/project';

function makeSampleReduction(etbPrime = 356.21, hTotal = 63, beta = 1.2039): TwoLayerReductionResult {
  return {
    rows: [
      {
        layerOrder: 1,
        tenVatLieu: 'Bê tông nhựa chặt loại I (lớp trên)',
        E_MPa: 420,
        t_E1_E2: 1.21,
        h_cm: 6,
        k_h1_h2: 0.11,
        Htb_cm: 63,
        EtbPrime_MPa: etbPrime,
      },
      {
        layerOrder: 2,
        tenVatLieu: 'Cấp phối đá dăm loại II',
        E_MPa: 250,
        t_E1_E2: null,
        h_cm: 18,
        k_h1_h2: null,
        Htb_cm: 18,
        EtbPrime_MPa: 250,
      },
    ],
    H_total_cm: hTotal,
    H_over_D: hTotal / 33,
    EtbPrime_MPa: etbPrime,
    beta,
    Etb_dc_MPa: etbPrime * beta,
    maxLayerE_MPa: 600,
  };
}

function makeSampleVerification(): FullVerificationResult {
  const red1 = makeSampleReduction(356.206, 63, 1.2039);
  const red2 = makeSampleReduction(313.31, 57, 1.1895);

  const pa1: AlternativeVerificationResult = {
    alternativeId: 'pa-1',
    alternativeName: 'Phương án 1',
    ranAtIso: '2026-11-18T00:00:00.000Z',
    deflection: {
      reduction: red1,
      H_over_D: 1.9091,
      E0_over_Etbdc: 0.0979,
      usedFormulaF1: false,
      Ech_over_E1: 0.502,
      Ech_MPa: 215.27,
      Kcd_dv: 1.17,
      Eyc_MPa: 180.0365,
      Eyc_required_MPa: 210.6427,
      passed: true,
    },
    shearApplicable: true,
    shearTargets: [
      {
        targetId: 'subgrade',
        targetName: 'Đất nền',
        targetIndexFromTop: null,
        isSubgrade: true,
        reductionAbove: makeSampleReduction(331.1, 63, 1.2039),
        reductionBelow: null,
        E1_MPa: 398.606,
        E2_MPa: 42.0,
        H_cm: 63,
        D_cm: 33,
        H_over_D: 1.9091,
        E1_over_E2: 9.4906,
        phi_deg: 24.0,
        C_MPa: 0.032,
        usedToanDo: '3-2',
        tax_over_p: 0.025,
        tax_MPa: 0.015,
        tav_MPa: -0.00139,
        k1: 0.6,
        k2: 0.8,
        k3: 1.5,
        Ctt_MPa: 0.02304,
        Kcd_tr: 1.0,
        tau_total_MPa: 0.01361,
        tau_allow_MPa: 0.02304,
        passed: true,
      },
      {
        targetId: 'pa1-l4',
        targetName: 'Cấp phối đá dăm loại I',
        targetIndexFromTop: 4,
        isSubgrade: false,
        reductionAbove: makeSampleReduction(380.0, 28, 1.08),
        reductionBelow: makeSampleReduction(250.0, 18, 1.04),
        E1_MPa: 410.4,
        E2_MPa: 112.5,
        H_cm: 28,
        D_cm: 33,
        H_over_D: 0.8485,
        E1_over_E2: 3.648,
        phi_deg: 40.0,
        C_MPa: 0.03,
        usedToanDo: '3-2',
        tax_over_p: 0.041,
        tax_MPa: 0.0246,
        tav_MPa: -0.00196,
        k1: 0.6,
        k2: 0.8,
        k3: 1.5,
        Ctt_MPa: 0.0216,
        Kcd_tr: 1.0,
        tau_total_MPa: 0.02264,
        tau_allow_MPa: 0.0216,
        passed: false,
      },
    ],
    flexuralApplicable: true,
    flexuralLayers: [
      {
        layerId: 'pa1-l1',
        layerName: 'Bê tông nhựa chặt loại I (lớp trên)',
        layerIndexFromTop: 1,
        isSurfaceLayer: true,
        h1_cm: 6.0,
        E1_MPa: 1800,
        E2_MPa: 1800,
        Echm_MPa: 310.5,
        reductionBelow: makeSampleReduction(340, 57, 1.19),
        H_over_D: 6 / 33,
        ratio1: 1800 / 310.5,
        ratio2: null,
        usedToanDo: '3-5',
        usedAnalyticalFallback: false,
        sigma_ku_bar: 1.45,
        kb: 0.85,
        p_MPa: 0.6,
        sigma_ku_MPa: 0.7395,
        materialClass: 'BTN',
        k1: 0.4492,
        k2: 1.0,
        Rku_MPa: 2.8,
        Rtt_ku_MPa: 1.2578,
        Kcd_ku: 1.0,
        R_allow_MPa: 1.2578,
        passed: true,
      },
      {
        layerId: 'pa1-l3',
        layerName: 'Đá dăm gia cố XM (Rn ≥ 4 Mpa)',
        layerIndexFromTop: 3,
        isSurfaceLayer: false,
        h1_cm: 28.0,
        E1_MPa: 1685.71,
        E2_MPa: 600.0,
        Echm_MPa: 165.0,
        reductionBelow: makeSampleReduction(272, 35, 1.11),
        H_over_D: 28 / 33,
        ratio1: 2.8095,
        ratio2: 3.636,
        usedToanDo: '3-6',
        usedAnalyticalFallback: false,
        sigma_ku_bar: 0.92,
        kb: 0.85,
        p_MPa: 0.6,
        sigma_ku_MPa: 0.4692,
        materialClass: 'DA_SOI_GC',
        k1: 0.5751,
        k2: 1.0,
        Rku_MPa: 0.8,
        Rtt_ku_MPa: 0.4601,
        Kcd_ku: 1.0,
        R_allow_MPa: 0.4601,
        passed: false,
      },
    ],
    allDeflectionPassed: true,
    allShearPassed: false,
    allFlexuralPassed: false,
    allPassed: false,
    warnings: [],
  };

  const pa2: AlternativeVerificationResult = {
    alternativeId: 'pa-2',
    alternativeName: 'Phương án 2',
    ranAtIso: '2026-11-18T00:00:00.000Z',
    deflection: {
      reduction: red2,
      H_over_D: 2.25,
      E0_over_Etbdc: 0.1127,
      usedFormulaF1: true,
      Ech_over_E1: null,
      Ech_MPa: 198.4,
      Kcd_dv: 1.17,
      Eyc_MPa: 180.0365,
      Eyc_required_MPa: 210.6427,
      passed: false,
    },
    shearApplicable: true,
    shearTargets: [
      {
        targetId: 'subgrade',
        targetName: 'Đất nền',
        targetIndexFromTop: null,
        isSubgrade: true,
        reductionAbove: makeSampleReduction(300, 57, 1.1895),
        reductionBelow: null,
        E1_MPa: 356.853,
        E2_MPa: 42.0,
        H_cm: 57,
        D_cm: 33,
        H_over_D: 1.7273,
        E1_over_E2: 8.4965,
        phi_deg: 24.0,
        C_MPa: 0.032,
        usedToanDo: '3-2',
        tax_over_p: 0.03,
        tax_MPa: 0.018,
        tav_MPa: -0.00125,
        k1: 0.6,
        k2: 0.8,
        k3: 1.5,
        Ctt_MPa: 0.02304,
        Kcd_tr: 1.0,
        tau_total_MPa: 0.01675,
        tau_allow_MPa: 0.02304,
        passed: true,
      },
    ],
    flexuralApplicable: true,
    flexuralLayers: [
      {
        layerId: 'pa2-l1',
        layerName: 'BTN chặt loại I (đá dăm ≥ 50%)',
        layerIndexFromTop: 1,
        isSurfaceLayer: true,
        h1_cm: 7.0,
        E1_MPa: 2200,
        E2_MPa: 2200,
        Echm_MPa: 255.0,
        reductionBelow: makeSampleReduction(300, 50, 1.17),
        H_over_D: 7 / 33,
        ratio1: 2200 / 255.0,
        ratio2: null,
        usedToanDo: '3-5',
        usedAnalyticalFallback: false,
        sigma_ku_bar: 1.6,
        kb: 0.85,
        p_MPa: 0.6,
        sigma_ku_MPa: 0.816,
        materialClass: 'BTN',
        k1: 0.4492,
        k2: 1.0,
        Rku_MPa: 2.8,
        Rtt_ku_MPa: 1.2578,
        Kcd_ku: 1.0,
        R_allow_MPa: 1.2578,
        passed: true,
      },
    ],
    allDeflectionPassed: false,
    allShearPassed: true,
    allFlexuralPassed: true,
    allPassed: false,
    warnings: [],
  };

  return {
    traffic: {
      conversions: SAMPLE_VD_PROJECT.vehicles.map((v, idx) => ({
        vehicleIndex: idx,
        tenXe: v.tenXe,
        tlTrucTruoc_kN: v.tlTrucTruoc_kN,
        tlTrucSau_kN: v.tlTrucSau_kN,
        C1_truoc: 1,
        C2_truoc: 6.4,
        C1_sau: v.soTrucSau > 1 ? 1.2 : 1,
        C2_sau: 1,
        luuLuong_xeNgDem: v.luuLuong_xeNgDem,
        Ni_truoc: idx === 0 ? 0 : 12.5 * idx,
        Ni_sau: idx === 0 ? 0 : 180.0 * idx,
        Ni_tong: idx === 0 ? 0 : 192.5 * idx,
      })),
      Ntk_trucNgDem: 1636.373,
      Ntt_trucLanNgDem: 572.73055,
      Ne_truc: 2152100,
    },
    subgradeResolved: {
      E0_MPa: 42.0,
      phi_deg: 24.0,
      C_MPa: 0.032,
    },
    modulusResolved: {
      Eyc_MPa: 180.0365,
      Emin_MPa: 160.0,
      Ett_MPa: 180.0365,
      Kcd_vong: 1.17,
      Kcd_truot: 1.0,
      Kcd_keoUon: 1.0,
    },
    alternatives: {
      'pa-1': pa1,
      'pa-2': pa2,
    },
  };
}

function renderToHost(element: React.ReactElement): { host: HTMLDivElement; unmount: () => void } {
  const host = document.createElement('div');
  const root = createRoot(host);
  flushSync(() => {
    root.render(element);
  });
  return { host, unmount: () => root.unmount() };
}

describe('RichView equation assets & report components', () => {
  it('registers all 42 extracted equation and badge PNG assets', () => {
    expect(Object.keys(EQUATION_ASSETS)).toHaveLength(42);
    expect(EQUATION_ASSETS.check.src).toBeTruthy();
    expect(EQUATION_ASSETS.cross.src).toBeTruthy();
    expect(EQUATION_ASSETS.echF.width).toBe(260);
    expect(EQUATION_ASSETS.echF.alt).toContain('Công thức (E.1)');
  });

  it('renders rv_Vong pass and fail reports with TCCS 38:2022/TCĐBVN citations, (E.1) fallback, and etbCapped note', () => {
    const verification = makeSampleVerification();
    const pa1 = verification.alternatives['pa-1'];
    const pa2 = verification.alternatives['pa-2'];

    const passView = renderToHost(
      React.createElement(RvVongReport, {
        deflection: pa1.deflection,
        roadScale: SAMPLE_VD_PROJECT.roadScale,
        subgradeE0: verification.subgradeResolved.E0_MPa,
        alternativeName: 'Phương án 1',
      })
    );
    expect(passView.host.textContent).toContain('Chuyển hệ nhiều lớp thành hệ 2 lớp');
    expect(passView.host.textContent).toContain('Tra Bảng 11, TCCS 38:2022/TCĐBVN');
    expect(passView.host.textContent).toContain('Tra toán đồ Hình 2');
    expect(passView.host.textContent).toContain('Tra Bảng 8, TCCS 38:2022/TCĐBVN');
    expect(passView.host.textContent).toContain('215.27');
    expect(passView.host.textContent).toContain('210.64');
    expect(passView.host.textContent).toContain(
      'Kết cấu áo đường đảm bảo tiêu chuẩn về độ võng đàn hồi'
    );
    expect(passView.host.querySelectorAll('img.rv-eq-img').length).toBeGreaterThan(8);
    expect(
      passView.host.querySelector('.rv-conclusion')?.getAttribute('data-passed')
    ).toBe('true');
    passView.unmount();

    const cappedDeflection = {
      ...pa2.deflection,
      reduction: { ...pa2.deflection.reduction, etbCapped: true },
    };
    const failView = renderToHost(
      React.createElement(RvVongReport, {
        deflection: cappedDeflection,
        roadScale: SAMPLE_VD_PROJECT.roadScale,
        subgradeE0: verification.subgradeResolved.E0_MPa,
      })
    );
    expect(failView.host.textContent).toContain(
      'Sử dụng Công thức (E.1), Phụ lục E, TCCS 38:2022/TCĐBVN'
    );
    expect(failView.host.textContent).toContain('kẹp trần max(Ei)');
    expect(failView.host.textContent).toContain('Bảng 11 Chú thích 2');
    expect(failView.host.textContent).toContain(
      'Kết cấu áo đường KHÔNG đảm bảo tiêu chuẩn về độ võng đàn hồi'
    );
    expect(
      failView.host.querySelector('.rv-conclusion')?.getAttribute('data-passed')
    ).toBe('false');
    failView.unmount();

    expect(buildRvVongSummaryText(pa1.deflection)).toContain('đảm bảo tiêu chuẩn');
    expect(buildRvVongSummaryText(cappedDeflection)).toContain('KHÔNG đảm bảo');
    expect(buildRvVongSummaryText(cappedDeflection)).toContain('kẹp trần max(Ei)');
  });

  it('renders rv_Truot for subgrade (pass), cohesive layer (fail + mini table), and B1/B2 exemptions', () => {
    const verification = makeSampleVerification();
    const pa1 = verification.alternatives['pa-1'];
    const subgradeTarget = pa1.shearTargets[0];
    const layerTarget = pa1.shearTargets[1];

    const subView = renderToHost(
      React.createElement(RvTruotReport, {
        target: subgradeTarget,
        roadScale: SAMPLE_VD_PROJECT.roadScale,
        forecast: SAMPLE_VD_PROJECT.forecast,
        designObject: SAMPLE_VD_PROJECT.projectInfo.doiTuongTK,
        traffic: verification.traffic,
      })
    );
    expect(subView.host.textContent).toContain('Kiểm tra đất nền:');
    expect(subView.host.textContent).toContain('Tra Bảng 11, TCCS 38:2022/TCĐBVN');
    expect(subView.host.textContent).toContain('Tra toán đồ Hình 4');
    expect(subView.host.textContent).toContain('Tra toán đồ Hình 6');
    expect(subView.host.textContent).toContain('tra Bảng 12');
    expect(subView.host.textContent).toContain('Tra Bảng 8, TCCS 38:2022/TCĐBVN');
    expect(subView.host.textContent).toContain('0.0230');
    expect(subView.host.textContent).toContain('Đất nền đảm bảo điều kiện cân bằng trượt');
    subView.unmount();

    const layerView = renderToHost(
      React.createElement(RvTruotReport, {
        target: layerTarget,
        roadScale: SAMPLE_VD_PROJECT.roadScale,
        forecast: SAMPLE_VD_PROJECT.forecast,
        designObject: SAMPLE_VD_PROJECT.projectInfo.doiTuongTK,
        traffic: verification.traffic,
      })
    );
    expect(layerView.host.textContent).toContain('Kiểm tra lớp Cấp phối đá dăm loại I:');
    expect(layerView.host.textContent).toContain('Tính đổi các lớp bên trên về một lớp');
    expect(layerView.host.querySelector('table.rv-mini-table')).not.toBeNull();
    expect(layerView.host.textContent).toContain(
      'Lớp Cấp phối đá dăm loại I KHÔNG đảm bảo điều kiện cân bằng trượt'
    );
    layerView.unmount();

    const b1View = renderToHost(
      React.createElement(RvTruotAllReport, {
        verification: { ...pa1, shearApplicable: false },
        project: {
          ...SAMPLE_VD_PROJECT,
          designParams: { ...SAMPLE_VD_PROJECT.designParams, loaiTangMat: 'B1' },
        },
        traffic: verification.traffic,
      })
    );
    expect(b1View.host.textContent).toContain('Không yêu cầu kiểm toán cắt trượt');
    expect(b1View.host.textContent).toContain('cấp thấp B1');
    expect(b1View.host.textContent).toContain('TCCS 38:2022/TCĐBVN');
    b1View.unmount();

    const b2View = renderToHost(
      React.createElement(RvTruotAllReport, {
        verification: { ...pa1, shearApplicable: false },
        project: {
          ...SAMPLE_VD_PROJECT,
          designParams: { ...SAMPLE_VD_PROJECT.designParams, loaiTangMat: 'B2' },
        },
        traffic: verification.traffic,
      })
    );
    expect(b2View.host.textContent).toContain('Không yêu cầu kiểm toán cắt trượt');
    expect(b2View.host.textContent).toContain('cấp thấp B2');
    expect(b2View.host.textContent).toContain('TCCS 38:2022/TCĐBVN');
    b2View.unmount();

    expect(buildRvTruotSummaryText(subgradeTarget)).toContain('Đất nền đảm bảo');
    expect(buildRvTruotSummaryText(layerTarget)).toContain('KHÔNG đảm bảo');
  });

  it('renders rv_KeoUon for surface (Hình 7, pass), monolithic base (Hình 8, fail), and B1/B2 exemptions', () => {
    const verification = makeSampleVerification();
    const pa1 = verification.alternatives['pa-1'];
    const surf = pa1.flexuralLayers[0];
    const base = pa1.flexuralLayers[1];

    const surfView = renderToHost(
      React.createElement(RvKeoUonReport, {
        layerResult: surf,
        roadScale: SAMPLE_VD_PROJECT.roadScale,
        forecast: SAMPLE_VD_PROJECT.forecast,
        traffic: verification.traffic,
      })
    );
    expect(surfView.host.textContent).toContain('Tra toán đồ Hình 7');
    expect(surfView.host.textContent).toContain('Công thức (A.3), Phụ lục A');
    expect(surfView.host.textContent).toContain('Tra Bảng 8, TCCS 38:2022/TCĐBVN');
    expect(surfView.host.textContent).toContain('0.740');
    expect(surfView.host.textContent).toContain(
      'Lớp Bê tông nhựa chặt loại I (lớp trên) đảm bảo tiêu chuẩn chịu kéo uốn'
    );
    surfView.unmount();

    const baseView = renderToHost(
      React.createElement(RvKeoUonReport, {
        layerResult: base,
        roadScale: SAMPLE_VD_PROJECT.roadScale,
        forecast: SAMPLE_VD_PROJECT.forecast,
        traffic: verification.traffic,
      })
    );
    expect(baseView.host.textContent).toContain('Tra toán đồ Hình 8');
    expect(baseView.host.textContent).toContain(
      'Lớp Đá dăm gia cố XM (Rn ≥ 4 Mpa) KHÔNG đảm bảo tiêu chuẩn chịu kéo uốn'
    );
    baseView.unmount();

    const emptyAllView = renderToHost(
      React.createElement(RvKeoUonAllReport, {
        verification: { ...pa1, flexuralApplicable: false, flexuralLayers: [] },
        project: SAMPLE_VD_PROJECT,
        traffic: verification.traffic,
      })
    );
    expect(emptyAllView.host.textContent).toContain('Không có lớp vật liệu liền khối');
    expect(emptyAllView.host.textContent).toContain('TCCS 38:2022/TCĐBVN');
    emptyAllView.unmount();

    const b2AllView = renderToHost(
      React.createElement(RvKeoUonAllReport, {
        verification: { ...pa1, flexuralApplicable: false, flexuralLayers: [] },
        project: {
          ...SAMPLE_VD_PROJECT,
          designParams: { ...SAMPLE_VD_PROJECT.designParams, loaiTangMat: 'B2' },
        },
        traffic: verification.traffic,
      })
    );
    expect(b2AllView.host.textContent).toContain('cấp thấp B2');
    expect(b2AllView.host.textContent).toContain('TCCS 38:2022/TCĐBVN');
    b2AllView.unmount();

    expect(buildRvKeoUonSummaryText(surf)).toContain('đảm bảo tiêu chuẩn chịu kéo uốn');
    expect(buildRvKeoUonSummaryText(base)).toContain('KHÔNG đảm bảo');
  });
});

function unwrapExcelCellText(val: ExcelJS.CellValue): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') {
    if ('richText' in val && Array.isArray(val.richText)) {
      return val.richText.map((r) => r.text).join('');
    }
    if ('result' in val) {
      return val.result !== undefined && val.result !== null ? String(val.result) : '';
    }
    if ('formula' in val) {
      return '';
    }
  }
  return String(val);
}

function extractSheetTexts(ws: ExcelJS.Worksheet): string {
  const texts: string[] = [];
  ws.eachRow((row) => {
    row.eachCell((cell) => {
      const t = unwrapExcelCellText(cell.value);
      if (t) texts.push(t);
    });
  });
  return texts.join('\n');
}

function extractSheetFormulas(
  ws: ExcelJS.Worksheet
): Array<{ coord: string; formula: string; result: unknown }> {
  const out: Array<{ coord: string; formula: string; result: unknown }> = [];
  ws.eachRow((row) => {
    row.eachCell((cell) => {
      const val = cell.value;
      if (val && typeof val === 'object' && 'formula' in val) {
        out.push({
          coord: cell.address,
          formula: val.formula ?? '',
          result: cell.result !== undefined ? cell.result : (val as ExcelJS.CellFormulaValue).result,
        });
      }
    });
  });
  return out;
}

describe('Excel export (abc 111.xls layout + live formulas + TCCS 38:2022/TCĐBVN parity)', () => {
  it('matches abc 111.xls 11-column grid, A4 page setup, Times New Roman, zero fills, RichText, borders, and colors', async () => {
    const verification = makeSampleVerification();
    const bytes = await exportVerificationToXlsxBuffer(SAMPLE_VD_PROJECT, verification);
    expect(bytes.byteLength).toBeGreaterThan(10000);

    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(bytes.buffer as ArrayBuffer);

    expect(loaded.creator).toBe('Áo đường mềm (TCCS 38:2022/TCĐBVN)');
    // No empty Sheet1; strictly 1 worksheet per selected alternative
    expect(loaded.worksheets.map((ws) => ws.name)).toEqual(['Phương án 1', 'Phương án 2']);

    const expectedWidths = [5.0, 9.29, 10.71, 12.14, 12.14, 13.57, 11.43, 12.14, 13.57, 12.86, 12.86];

    for (const ws of loaded.worksheets) {
      // Exact 11-column grid A..K
      expectedWidths.forEach((w, idx) => {
        expect(ws.getColumn(idx + 1).width).toBeCloseTo(w, 2);
      });
      expect(ws.columnCount).toBe(11);

      // Page setup & gridlines
      expect(ws.views[0]?.showGridLines).toBe(true);
      expect(ws.pageSetup.paperSize).toBe(9);
      expect(ws.pageSetup.orientation).toBe('portrait');
      expect(ws.pageSetup.fitToPage).toBe(true);
      expect(ws.pageSetup.fitToWidth).toBe(1);
      expect(ws.pageSetup.fitToHeight).toBe(0);
      expect(ws.pageSetup.margins?.left).toBeCloseTo(0.75, 2);
      expect(ws.pageSetup.margins?.right).toBeCloseTo(0.75, 2);
      expect(ws.pageSetup.margins?.top).toBeCloseTo(1.0, 2);
      expect(ws.pageSetup.margins?.bottom).toBeCloseTo(1.0, 2);

      // Title R1..R3 centerContinuous & sizes (cols 2..11 must remain empty so Excel does not clip)
      expect(ws.getRow(1).height).toBeCloseTo(18.75, 2);
      expect(ws.getCell('A1').font?.size).toBe(14);
      expect(ws.getCell('A1').font?.bold).toBe(true);
      expect(ws.getCell('A1').alignment?.horizontal).toBe('centerContinuous');
      expect(ws.getCell('B1').value).toBeNull();
      expect(ws.getCell('B2').value).toBeNull();
      expect(ws.getCell('B3').value).toBeNull();
      expect(ws.getRow(2).height).toBeCloseTo(17.25, 2);
      expect(ws.getCell('A2').font?.size).toBe(13);
      expect(ws.getCell('A2').font?.bold).toBe(true);
      expect(ws.getCell('A2').font?.italic).toBe(true);
      expect(ws.getCell('A2').alignment?.horizontal).toBe('centerContinuous');

      let richSubCount = 0;
      let richSupCount = 0;
      let hasHairBorder = false;
      let hasMediumBorder = false;
      let hasThinBorder = false;

      ws.eachRow((row) => {
        row.eachCell({ includeEmpty: true }, (cell) => {
          // Zero background fills on 100% of cells
          const fill = cell.fill as { pattern?: string } | undefined;
          if (fill && fill.pattern) {
            expect(fill.pattern).toBe('none');
          }

          // Never use trailing '#' after decimal in numFmt (prevents dangling decimal comma on integers)
          if (cell.numFmt && cell.numFmt !== 'General') {
            expect(cell.numFmt).not.toMatch(/\.[0#]*#/);
          }

          // Pure Times New Roman everywhere (never legacy `symbol` font)
          if (cell.font?.name) {
            expect(cell.font.name).toBe('Times New Roman');
          }
          const val = cell.value;
          if (val && typeof val === 'object' && 'richText' in val && Array.isArray(val.richText)) {
            for (const run of val.richText) {
              expect(run.font?.name).toBe('Times New Roman');
              if (run.font?.vertAlign === 'subscript') richSubCount += 1;
              if (run.font?.vertAlign === 'superscript') richSupCount += 1;
            }
          }

          const b = cell.border;
          if (b) {
            for (const side of [b.top, b.bottom, b.left, b.right]) {
              if (side?.style === 'hair') hasHairBorder = true;
              if (side?.style === 'medium') hasMediumBorder = true;
              if (side?.style === 'thin') hasThinBorder = true;
            }
          }
        });
      });

      expect(richSubCount).toBeGreaterThan(25);
      expect(richSupCount).toBeGreaterThan(10);
      expect(hasHairBorder).toBe(true);
      expect(hasMediumBorder).toBe(true);
      expect(hasThinBorder).toBe(true);

      // Bảng 1 header 2-row merges R13:R14
      expect(ws.getRow(12).height).toBeCloseTo(26.25, 2);
      expect(ws.getCell('B12').font?.bold).toBe(true);
      expect(ws.getCell('B12').font?.italic).toBe(true);
      expect(ws.getRow(13).height).toBeCloseTo(18.75, 2);
      expect(ws.getRow(14).height).toBeCloseTo(30.0, 2);
      expect(ws.getCell('A13').isMerged).toBe(true);
      expect(ws.getCell('F13').isMerged).toBe(true);
      expect(ws.getCell('A13').border?.top?.style).toBe('medium');
      expect(ws.getCell('A13').border?.left?.style).toBe('medium');
      expect(ws.getCell('F14').border?.bottom?.style).toBe('medium');
      expect(ws.getCell('K14').border?.right?.style).toBe('medium');
    }

    // Conclusion colors: PA1 has deflection PASS (#0000FF) and shear/flexural FAIL (#FF0000)
    const ws1 = loaded.getWorksheet('Phương án 1')!;
    const ws2 = loaded.getWorksheet('Phương án 2')!;
    const getConclusionColors = (ws: ExcelJS.Worksheet): Array<{ text: string; color?: string }> => {
      const items: Array<{ text: string; color?: string }> = [];
      ws.eachRow((row) => {
        const c = row.getCell(2);
        const txt = unwrapExcelCellText(c.value);
        if (txt.startsWith('Kết luận:')) {
          items.push({ text: txt, color: c.font?.color?.argb });
        }
      });
      return items;
    };

    const pa1Concs = getConclusionColors(ws1);
    expect(pa1Concs.some((i) => i.color === 'FF0000FF' && i.text.includes('đảm bảo tiêu chuẩn về độ võng'))).toBe(true);
    expect(pa1Concs.some((i) => i.color === 'FFFF0000' && i.text.includes('KHÔNG đảm bảo'))).toBe(true);

    const pa2Concs = getConclusionColors(ws2);
    expect(pa2Concs.some((i) => i.color === 'FFFF0000' && i.text.includes('KHÔNG đảm bảo tiêu chuẩn về độ võng'))).toBe(true);
    expect(pa2Concs.some((i) => i.color === 'FF0000FF' && i.text.includes('đảm bảo điều kiện cân bằng trượt'))).toBe(true);
  });

  it('generates formatted .xlsx workbook with TCCS 38:2022/TCĐBVN citations & Unicode Greek for SAMPLE_VD_PROJECT', async () => {
    const verification = makeSampleVerification();
    const bytes = await exportVerificationToXlsxBuffer(SAMPLE_VD_PROJECT, verification);
    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(bytes.buffer as ArrayBuffer);

    const joined = extractSheetTexts(loaded.getWorksheet('Phương án 1')!);
    const joinedPa2 = extractSheetTexts(loaded.getWorksheet('Phương án 2')!);

    expect(joined).toContain('BẢNG TÍNH KẾT CẤU ÁO ĐƯỜNG');
    expect(joined).toContain('Theo tiêu chuẩn TCCS 38:2022/TCĐBVN');
    expect(joined).not.toContain('Theo quy trình 22TCN 211-06');
    expect(joined).toContain('Ví dụ tính theo phụ lục E, tiêu chuẩn 22TCN 211-06');
    expect(joined).toContain('Bảng 6');
    expect(joined).toContain('Bảng 8');
    expect(joined).toContain('Bảng 9');
    expect(joined).toContain('Bảng 10');
    expect(joined).toContain('Bảng 11');
    expect(joined).toContain('Bảng 12');
    expect(joined).toContain('Hình 2');
    expect(joined).toContain('Hình 4');
    expect(joined).toContain('Hình 6');
    expect(joined).toContain('Hình 7');
    expect(joined).toContain('Hình 8');
    expect(joined).toContain('Công thức (A.3), Phụ lục A');
    expect(joined).toContain('Σ');
    expect(joined).toContain('φ');
    expect(joined).toContain('β');
    expect(joined).toContain('σ');
    expect(joinedPa2).toContain('Công thức (E.1) (Phụ lục E, TCCS 38:2022/TCĐBVN)');
    expect(joined).toContain('I. TÍNH SỐ TRỤC XE TÍNH TOÁN:');
    expect(joined).toContain('Bảng 1: Dự báo thành phần xe thông qua mặt cắt ngang điển hình');
    expect(joined).toContain('Bảng 2: Bảng tính số trục xe quy đổi về trục xe tính toán');
    expect(joined).toContain('II. TÍNH KẾT CẤU ÁO ĐƯỜNG:');
    expect(joined).toContain('Bảng 3: Bảng các lớp kết cấu áo đường');
    expect(joined).toContain('III. KIỂM TOÁN:');
    expect(joined).toContain('III.1. Kiểm tra tiêu chuẩn độ võng đàn hồi');
    expect(joined).toContain('III.2. Kiểm tra tiêu chuẩn cắt trượt');
    expect(joined).toContain('III.3. Kiểm tra tiêu chuẩn chịu kéo uốn');
    expect(joined).toContain('Kết luận: Kết cấu đảm bảo tiêu chuẩn về độ võng đàn hồi.');
    expect(joined).toContain('Kết luận: Đất nền đảm bảo điều kiện cân bằng trượt.');
    expect(joined).toContain('Xe kéo, xe rơmooc');
    expect(joined).toContain('Đá dăm gia cố XM (Rn ≥ 4 Mpa)');
  });

  it('embeds live Excel formulas (SUM, MAX, MIN, IF, ROUND, SUMPRODUCT) with exact cached results', async () => {
    const liveVerification = runFullVerification(SAMPLE_VD_PROJECT);
    const inMemWb = await buildVerificationWorkbook(SAMPLE_VD_PROJECT, liveVerification);
    for (const ws of inMemWb.worksheets) {
      for (const f of extractSheetFormulas(ws)) {
        expect(f.formula.startsWith('=')).toBe(false);
        expect(f.result, `Cell ${ws.name}!${f.coord} (${f.formula}) missing result`).toBeDefined();
        expect(f.result).not.toBeNull();
      }
    }

    const bytes = await exportVerificationToXlsxBuffer(SAMPLE_VD_PROJECT, liveVerification);
    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(bytes.buffer as ArrayBuffer);

    const ws1 = loaded.getWorksheet('Phương án 1')!;
    const ws2 = loaded.getWorksheet('Phương án 2')!;
    const formulas1 = extractSheetFormulas(ws1);
    const formulas2 = extractSheetFormulas(ws2);

    const hasFormulaLike = (list: typeof formulas1, pattern: RegExp) =>
      list.some((f) => pattern.test(f.formula));

    // Bảng 2 & I.3 formulas
    expect(hasFormulaLike(formulas1, /^IF\(OR\(NOT\(ISNUMBER\(F\d+\)\),F\d+<25\),0,ROUND\(.*\^4\.4,3\)\)$/)).toBe(true);
    expect(hasFormulaLike(formulas1, /^IF\(OR\(NOT\(ISNUMBER\(F\d+\)\),F\d+<25\),0,ROUND\(.*\^4\.4,0\)\)$/)).toBe(true);
    expect(hasFormulaLike(formulas1, /^SUM\(K\d+:K\d+\)$/)).toBe(true);
    expect(hasFormulaLike(formulas1, /^ROUND\(K\d+\*G\d+,0\)$/)).toBe(true);

    // II.4 MAX & II.5 COUNTA
    expect(hasFormulaLike(formulas1, /^MAX\(E\d+,E\d+\)$/)).toBe(true);
    expect(hasFormulaLike(formulas1, /^COUNTA\(A\d+:A\d+\)$/)).toBe(true);

    // III.1 reduction, beta, Etb_dc MIN/MAX, Kcd_dv, comparison & conclusion
    expect(hasFormulaLike(formulas1, /^K\d+\*\(\(1\+I\d+\*G\d+\^\(1\/3\)\)\/\(1\+I\d+\)\)\^3$/)).toBe(true);
    expect(hasFormulaLike(formulas1, /1\.114\*.*\^0\.12/)).toBe(true);
    expect(hasFormulaLike(formulas1, /^MIN\(ROUND\(F\d+\*F\d+,3\),MAX\(F\d+:F\d+\)\)$/)).toBe(true);
    expect(hasFormulaLike(formulas1, /^IF\(\$F\$\d+>=0\.98,1\.29/)).toBe(true);
    expect(hasFormulaLike(formulas1, /^IF\(C\d+>=F\d+,">=","<"\)$/)).toBe(true);

    // III.2 K2 discrete Table 12 & Ctt & Kcd_tr
    expect(hasFormulaLike(formulas1, /^IF\(\$F\$\d+<100,1,IF\(\$F\$\d+<1000,0\.8,IF\(\$F\$\d+<5000,0\.65,0\.6\)\)\)$/)).toBe(true);
    expect(hasFormulaLike(formulas1, /^E\d+\*E\d+\*E\d+\*E\d+$/)).toBe(true);

    // III.3 SUMPRODUCT, Ne, k1, Rtt_ku
    expect(hasFormulaLike(formulas1, /SUMPRODUCT\(/)).toBe(true);
    expect(hasFormulaLike(formulas1, /\^0\.22$/)).toBe(true);
    expect(hasFormulaLike(formulas1, /^2\.86\/D\d+\^0\.11$/)).toBe(true);

    // Note: ExcelJS omits <v>0</v> during serialization when result === 0, so roundtripped
    // formulas either have finite/non-null cached result or were 0-valued formulas.
    for (const f of [...formulas1, ...formulas2]) {
      expect(f.formula.startsWith('=')).toBe(false);
      if (typeof f.result === 'number') {
        expect(Number.isFinite(f.result)).toBe(true);
      }
    }

    // Check specific cached result values against runFullVerification
    const ntkFormula = formulas1.find((f) => /^SUM\(K\d+:K\d+\)$/.test(f.formula))!;
    expect(Number(ntkFormula.result)).toBeCloseTo(liveVerification.traffic.Ntk_trucNgDem, 2);

    const eycTtFormula = formulas1.find((f) => /^MAX\(E\d+,E\d+\)$/.test(f.formula))!;
    expect(Number(eycTtFormula.result)).toBeCloseTo(liveVerification.modulusResolved.Ett_MPa, 2);

    const countaFormula = formulas1.find((f) => /^COUNTA\(A\d+:A\d+\)$/.test(f.formula))!;
    expect(countaFormula.result).toBe(SAMPLE_VD_PROJECT.alternatives[0].layers.length);
  });

  it('respects selectedAlternativeIds filter and throws when no valid alternatives match', async () => {
    const verification = makeSampleVerification();
    const wb = await buildVerificationWorkbook(SAMPLE_VD_PROJECT, verification, ['pa-2']);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Phương án 2']);

    await expect(
      buildVerificationWorkbook(SAMPLE_VD_PROJECT, verification, ['nonexistent'])
    ).rejects.toThrow();
  });

  it('integrates end-to-end with runFullVerification(SAMPLE_TCCS38_EX1) across reports and Excel', async () => {
    const liveVerification = runFullVerification(SAMPLE_TCCS38_EX1);
    const pa1Res = liveVerification.alternatives['pa-1'];
    expect(pa1Res).toBeDefined();

    const vView = renderToHost(
      React.createElement(RvVongReport, {
        deflection: pa1Res.deflection,
        roadScale: SAMPLE_TCCS38_EX1.roadScale,
        subgradeE0: liveVerification.subgradeResolved.E0_MPa,
        alternativeName: pa1Res.alternativeName,
      })
    );
    expect(vView.host.textContent).toContain('Tra Bảng 11, TCCS 38:2022/TCĐBVN');
    expect(vView.host.textContent).toContain('Tra toán đồ Hình 2');
    expect(vView.host.textContent).toContain(pa1Res.deflection.Ech_MPa.toFixed(2));
    vView.unmount();

    const tView = renderToHost(
      React.createElement(RvTruotAllReport, {
        verification: pa1Res,
        project: SAMPLE_TCCS38_EX1,
        traffic: liveVerification.traffic,
      })
    );
    expect(tView.host.textContent).toContain('Kiểm tra đất nền:');
    expect(tView.host.textContent).toContain('tra Bảng 12');
    expect(tView.host.textContent).toContain('cân bằng trượt');
    tView.unmount();

    const kView = renderToHost(
      React.createElement(RvKeoUonAllReport, {
        verification: pa1Res,
        project: SAMPLE_TCCS38_EX1,
        traffic: liveVerification.traffic,
      })
    );
    expect(kView.host.textContent).toContain('Bê tông nhựa chặt 12,5');
    expect(kView.host.textContent).toContain('Đá dăm gia cố xi măng');
    expect(kView.host.textContent).toContain('Tra toán đồ Hình 7');
    expect(kView.host.textContent).toContain('Tra toán đồ Hình 8');
    kView.unmount();

    const bytes = await exportVerificationToXlsxBuffer(SAMPLE_TCCS38_EX1, liveVerification);
    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(bytes.buffer as ArrayBuffer);
    expect(loaded.worksheets).toHaveLength(1);
    const ws = loaded.getWorksheet('Phương án 1 (Phụ lục D.1)')!;
    expect(ws).toBeDefined();
    expect(ws.rowCount).toBeGreaterThan(150);

    const joined = extractSheetTexts(ws);
    expect(joined).toContain('Theo tiêu chuẩn TCCS 38:2022/TCĐBVN');
    expect(joined).not.toContain('22TCN 211-06');
    expect(joined).toContain('Ví dụ I — Phụ lục D.1 (TCCS 38:2022/TCĐBVN)');
    expect(joined).toContain('Tra Bảng 9 (TCCS 38:2022/TCĐBVN)');
    expect(joined).toContain('Tra Bảng 10 (TCCS 38:2022/TCĐBVN)');

    // Check Eq. (E.1) live Excel formula when H/D > 2.0
    const formulas = extractSheetFormulas(ws);
    if (pa1Res.deflection.usedFormulaF1) {
      expect(formulas.some((f) => f.formula.includes('1.05*') && f.formula.includes('SQRT('))).toBe(true);
    }
  });

  it('exports B2 surface grade exemption and etbCapped note cleanly in Excel', async () => {
    const verification = makeSampleVerification();
    const b2Project = {
      ...SAMPLE_TCCS38_EX1,
      designParams: { ...SAMPLE_TCCS38_EX1.designParams, loaiTangMat: 'B2' as const },
      subgrade: { ...SAMPLE_TCCS38_EX1.subgrade, damNenCaiTien: true },
    };
    const pa1 = verification.alternatives['pa-1'];
    const customVerif: FullVerificationResult = {
      ...verification,
      alternatives: {
        'pa-1': {
          ...pa1,
          deflection: {
            ...pa1.deflection,
            reduction: { ...pa1.deflection.reduction, etbCapped: true },
          },
          shearApplicable: false,
          shearTargets: [],
          flexuralApplicable: false,
          flexuralLayers: [],
        },
      },
    };
    const bytes = await exportVerificationToXlsxBuffer(b2Project, customVerif, ['pa-1']);
    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(bytes.buffer as ArrayBuffer);
    const ws = loaded.worksheets[0]!;
    const joined = extractSheetTexts(ws);
    expect(joined).toContain('Cấp thấp B2');
    expect(joined).toContain('đầm nén cải tiến +20% E0 theo Bảng B.4');
    expect(joined).toContain('kẹp trần max(Ei)');
    expect(joined).toContain('Không yêu cầu kiểm toán cắt trượt đối với tầng mặt cấp thấp B2');
    expect(joined).toContain('Không yêu cầu kiểm toán chịu kéo uốn đối với tầng mặt cấp thấp B2');
  });

  it('integrates end-to-end with runFullVerification(SAMPLE_VD_PROJECT) across reports and Excel', async () => {
    const liveVerification = runFullVerification(SAMPLE_VD_PROJECT);
    const pa1Res = liveVerification.alternatives['pa-1'];
    const pa2Res = liveVerification.alternatives['pa-2'];
    expect(pa1Res).toBeDefined();
    expect(pa2Res).toBeDefined();

    const vView = renderToHost(
      React.createElement(RvVongReport, {
        deflection: pa1Res.deflection,
        roadScale: SAMPLE_VD_PROJECT.roadScale,
        subgradeE0: liveVerification.subgradeResolved.E0_MPa,
        alternativeName: pa1Res.alternativeName,
      })
    );
    expect(vView.host.textContent).toContain('độ võng đàn hồi');
    expect(vView.host.textContent).toContain(pa1Res.deflection.Ech_MPa.toFixed(2));
    vView.unmount();

    const tView = renderToHost(
      React.createElement(RvTruotAllReport, {
        verification: pa1Res,
        project: SAMPLE_VD_PROJECT,
        traffic: liveVerification.traffic,
      })
    );
    expect(tView.host.textContent).toContain('Kiểm tra đất nền:');
    expect(tView.host.textContent).toContain('cân bằng trượt');
    tView.unmount();

    const kView = renderToHost(
      React.createElement(RvKeoUonAllReport, {
        verification: pa1Res,
        project: SAMPLE_VD_PROJECT,
        traffic: liveVerification.traffic,
      })
    );
    expect(kView.host.textContent).toContain('Bê tông nhựa chặt loại I (lớp trên)');
    expect(kView.host.textContent).toContain('Đá dăm gia cố XM (Rn ≥ 4 Mpa)');
    kView.unmount();

    const bytes = await exportVerificationToXlsxBuffer(SAMPLE_VD_PROJECT, liveVerification);
    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(bytes.buffer as ArrayBuffer);
    expect(loaded.worksheets).toHaveLength(2);
    expect(loaded.getWorksheet('Phương án 1')?.rowCount).toBeGreaterThan(200);
    expect(loaded.getWorksheet('Phương án 2')?.rowCount).toBeGreaterThan(150);
  });
});

describe('TCCS 38:2022 Chapter 10 (CAI_TAO) reports & Excel export', () => {
  it('renders RvVongReport, RvTruotAllReport, and RvKeoUonAllReport for CAI_TAO with warnings, isBuVenh, and Ech,cũ context', () => {
    const verification = makeSampleVerification();
    const pa1 = verification.alternatives['pa-1'];
    const rehabSummary = {
      loaiTK: 'CAI_TAO' as const,
      strategy: 'DIRECT_OVERLAY' as const,
      echMethod: 'BENKELMAN' as const,
      echCu_MPa: 135.5,
      benkelmanStats: {
        n: 6,
        l_tb_mm: 1.02,
        S_mm: 0.12,
        Cv: 0.1176,
        Z_alpha: 1.645,
        l_dc_mm: 1.217,
        l_tt_mm: 1.329,
        echCu_MPa: 135.5,
      },
      excludedBuVenhLayers: [
        {
          layerId: 'bv-1',
          layerName: 'BTN hạt nhỏ bù vênh',
          chieuDay_cm: 3,
        },
      ],
      shearOldStackUsed: false,
      subgradeShearSkippedReason:
        'Thiếu chiều dày kết cấu cũ H_cũ (§10.3.3): chưa kiểm toán được cắt trượt trong đất nền cũ.',
      existingSurfaceAlreadyMeetsEyc: false,
      warnings: [
        'Theo §10.2.1.2, lớp bù vênh không được tính vào cường độ chung kết cấu tăng cường.',
      ],
    };

    const rehabProject = {
      ...SAMPLE_VD_PROJECT,
      projectInfo: {
        ...SAMPLE_VD_PROJECT.projectInfo,
        loaiTK: 'CAI_TAO' as const,
      },
      rehabilitation: {
        strategy: 'DIRECT_OVERLAY' as const,
        echMethod: 'BENKELMAN' as const,
        directEchCu_MPa: 135.5,
        directKdc: 1.0,
        benkelman: {
          inputMode: 'STATS' as const,
          readings_mm: [],
          l_tb_mm: 1.02,
          S_mm: 0.12,
          Z_alpha: 1.645,
          K_t: 1.05,
          K_am: 1.04,
          p_do_MPa: 0.6,
          D_do_cm: 33,
          mu: 0.3,
        },
        existingLayers: [],
        assessment: {
          segmentName: 'Km0+000 - Km0+800',
          segmentLength_m: 800,
          oldSurfaceGrade: 'A1' as const,
          pci: 62,
          crackingLevel: 'VUA' as const,
          ruttingDepth_mm: 14,
          localizedSink_mm: 10,
          hasReflectiveCrackRisk: true,
          hasWidening: false,
        },
      },
    };

    const vongView = renderToHost(
      React.createElement(RvVongReport, {
        deflection: {
          ...pa1.deflection,
          foundationModulus_MPa: 135.5,
          foundationLabel: "E0' = Ech,cũ",
          e0RatioExtrapolated: true,
        },
        roadScale: rehabProject.roadScale,
        subgradeE0: verification.subgradeResolved.E0_MPa,
        alternativeName: 'PA Tăng cường 1',
        loaiTK: 'CAI_TAO',
        rehabSummary,
      })
    );
    expect(vongView.host.textContent).toContain('Chương 10 — TCCS 38:2022/TCĐBVN');
    expect(vongView.host.textContent).toContain('Phương pháp Benkelman TCVN 8867');
    expect(vongView.host.textContent).toContain('135.50');
    expect(vongView.host.textContent).toContain('BTN hạt nhỏ bù vênh');
    expect(vongView.host.textContent).toContain('Điều 10.2.1.2');
    expect(vongView.host.textContent).toContain("với E₀' = Ech,cũ = 135.50 MPa");
    expect(vongView.host.textContent).toContain('nội suy tuyến tính');
    expect(vongView.host.textContent).toContain(
      'Kết cấu tăng cường đảm bảo tiêu chuẩn về độ võng đàn hồi'
    );
    vongView.unmount();

    const truotView = renderToHost(
      React.createElement(RvTruotAllReport, {
        verification: { ...pa1, rehabSummary },
        project: rehabProject,
        traffic: verification.traffic,
      })
    );
    expect(truotView.host.textContent).toContain('Kiểm tra đất nền cũ (Chương 10)');
    expect(truotView.host.textContent).toContain('[lớp tăng cường mới + lớp cũ giữ lại]');
    expect(truotView.host.textContent).toContain('Thiếu chiều dày kết cấu cũ H_cũ');
    expect(truotView.host.querySelector('.rv-warning-callout')).not.toBeNull();
    truotView.unmount();

    const directSurfaceFlex = {
      ...pa1.flexuralLayers[0],
      reductionBelow: null,
      Echm_MPa: 135.5,
    };
    const keouonView = renderToHost(
      React.createElement(RvKeoUonAllReport, {
        verification: {
          ...pa1,
          flexuralLayers: [directSurfaceFlex],
          rehabSummary,
        },
        project: rehabProject,
        traffic: verification.traffic,
      })
    );
    expect(keouonView.host.textContent).toContain(
      'trên mặt kết cấu áo đường cũ (theo Điều 10.4.2 & 9.4.2)'
    );
    expect(keouonView.host.textContent).toContain('Ech,cũ = 135.50 (MPa)');
    expect(keouonView.host.querySelector('.rv-warning-callout')).not.toBeNull();
    keouonView.unmount();
  });

  it('exports Chapter 10 Excel workbook with II.1/II.2/II.5/Bảng 3b/III sections for CAI_TAO', async () => {
    const verification = makeSampleVerification();
    const pa1 = verification.alternatives['pa-1'];
    const rehabSummary = {
      loaiTK: 'CAI_TAO' as const,
      strategy: 'MILL_AND_OVERLAY' as const,
      echMethod: 'LAYER_STACK' as const,
      echCu_MPa: 148.2,
      existingReduction: makeSampleReduction(210, 32, 1.1),
      excludedBuVenhLayers: [
        {
          layerId: 'pa1-bv',
          layerName: 'Hỗn hợp đá nhựa bù vênh',
          chieuDay_cm: 3,
        },
      ],
      shearOldStackUsed: true,
      warnings: ['Cảnh báo nứt phản ánh trên lớp móng gia cố vô cơ cũ (§10.2.3).'],
    };

    const rehabProject = {
      ...SAMPLE_VD_PROJECT,
      projectInfo: {
        ...SAMPLE_VD_PROJECT.projectInfo,
        loaiTK: 'CAI_TAO' as const,
      },
      alternatives: [
        {
          ...SAMPLE_VD_PROJECT.alternatives[0],
          layers: [
            ...SAMPLE_VD_PROJECT.alternatives[0].layers,
            {
              ...SAMPLE_VD_PROJECT.alternatives[0].layers[0],
              id: 'pa1-bv',
              tenVatLieu: 'Hỗn hợp đá nhựa bù vênh',
              chieuDay_cm: 3,
              isBuVenh: true,
            },
          ],
        },
      ],
      rehabilitation: {
        strategy: 'MILL_AND_OVERLAY' as const,
        echMethod: 'LAYER_STACK' as const,
        directEchCu_MPa: 148.2,
        directKdc: 1.0,
        benkelman: {
          inputMode: 'STATS' as const,
          readings_mm: [],
          l_tb_mm: 1.0,
          S_mm: 0.1,
          Z_alpha: 1.645,
          K_t: 1.0,
          K_am: 1.0,
          p_do_MPa: 0.6,
          D_do_cm: 33,
          mu: 0.3,
        },
        totalExistingThickness_cm: 32,
        existingLayers: [
          {
            ...SAMPLE_VD_PROJECT.alternatives[0].layers[2],
            id: 'old-1',
            tenVatLieu: 'CPĐD loại I cũ giữ lại',
            chieuDay_cm: 32,
            K_hh: 0.85,
            checkFlexural: false,
          },
        ],
        assessment: {
          segmentName: 'Đoạn Km1+000 - Km1+800',
          segmentLength_m: 800,
          oldSurfaceGrade: 'A1' as const,
          pci: 55,
          crackingLevel: 'NANG' as const,
          ruttingDepth_mm: 28,
          localizedSink_mm: 20,
          hasReflectiveCrackRisk: true,
          hasWidening: true,
        },
      },
    };

    const customVerif: FullVerificationResult = {
      ...verification,
      alternatives: {
        'pa-1': {
          ...pa1,
          deflection: {
            ...pa1.deflection,
            foundationModulus_MPa: 148.2,
            foundationLabel: "E0' = Ech,cũ",
          },
          rehabSummary,
        },
      },
    };

    const bytes = await exportVerificationToXlsxBuffer(rehabProject, customVerif, ['pa-1']);
    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(bytes.buffer as ArrayBuffer);
    const ws = loaded.worksheets[0]!;
    expect(ws.columnCount).toBe(11);
    const joined = extractSheetTexts(ws);

    expect(joined).toContain('BẢNG TÍNH KẾT CẤU TĂNG CƯỜNG, CẢI TẠO ÁO ĐƯỜNG CŨ');
    expect(joined).toContain('Theo tiêu chuẩn TCCS 38:2022/TCĐBVN (Chương 10)');
    expect(joined).toContain('Cải tạo, nâng cấp (tăng cường áo đường cũ)');
    expect(joined).toContain('II.2. Hiện trạng kết cấu cũ & Nền đường:');
    expect(joined).toContain('Đoạn Km1+000 - Km1+800');
    expect(joined).toContain('Lớp bù vênh — không tính cường độ (§10.2.1.2)');
    expect(joined).toContain('Bảng 3b: Các lớp kết cấu cũ giữ lại');
    expect(joined).toContain('CPĐD loại I cũ giữ lại');
    expect(joined).toContain("Eo' = Ech,cũ = 148.20 MPa");
    expect(joined).toContain('[lớp tăng cường mới + lớp cũ giữ lại]');
    expect(joined).toContain('Cảnh báo nứt phản ánh trên lớp móng gia cố vô cơ cũ');
  });

  it('integrates end-to-end with runFullVerification(SAMPLE_TCCS38_CH10) and SAMPLE_TCCS38_CH10_MILL across RichView & Excel', async () => {
    const ch10Verif = runFullVerification(SAMPLE_TCCS38_CH10);
    const pa1Res = ch10Verif.alternatives['pa-1'];
    expect(pa1Res).toBeDefined();
    expect(pa1Res.rehabSummary?.echMethod).toBe('BENKELMAN');
    expect(pa1Res.rehabSummary?.excludedBuVenhLayers).toHaveLength(1);

    const vView = renderToHost(
      React.createElement(RvVongReport, {
        deflection: pa1Res.deflection,
        roadScale: SAMPLE_TCCS38_CH10.roadScale,
        subgradeE0: ch10Verif.subgradeResolved.E0_MPa,
        alternativeName: pa1Res.alternativeName,
        loaiTK: SAMPLE_TCCS38_CH10.projectInfo.loaiTK,
        rehabSummary: pa1Res.rehabSummary,
      })
    );
    expect(vView.host.textContent).toContain('Chương 10 — TCCS 38:2022/TCĐBVN');
    expect(vView.host.textContent).toContain('Phương pháp Benkelman TCVN 8867');
    expect(vView.host.textContent).toContain('Bù vênh hỗn hợp BTN chặt 12,5');
    expect(vView.host.textContent).toContain('Điều 10.2.1.2');
    expect(vView.host.textContent).toContain('Kết cấu tăng cường');
    vView.unmount();

    const tView = renderToHost(
      React.createElement(RvTruotAllReport, {
        verification: pa1Res,
        project: SAMPLE_TCCS38_CH10,
        traffic: ch10Verif.traffic,
      })
    );
    expect(tView.host.textContent).toContain('Kiểm tra đất nền cũ (Chương 10)');
    expect(tView.host.textContent).toContain('[lớp tăng cường mới + lớp cũ giữ lại]');
    tView.unmount();

    const kView = renderToHost(
      React.createElement(RvKeoUonAllReport, {
        verification: pa1Res,
        project: SAMPLE_TCCS38_CH10,
        traffic: ch10Verif.traffic,
      })
    );
    expect(kView.host.textContent).toContain('BTNC 12,5 (đá dăm ≥ 50%)');
    expect(kView.host.textContent).toContain('BTNC 19 (đá dăm ≥ 35%)');
    expect(kView.host.textContent).toContain('trên mặt kết cấu áo đường cũ');
    kView.unmount();

    const bytes = await exportVerificationToXlsxBuffer(SAMPLE_TCCS38_CH10, ch10Verif);
    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(bytes.buffer as ArrayBuffer);
    expect(loaded.worksheets).toHaveLength(2);

    const pa1Ws = loaded.worksheets[0]!;
    const pa1Text = extractSheetTexts(pa1Ws);
    const pa1Formulas = extractSheetFormulas(pa1Ws);
    expect(pa1Text).toContain('BẢNG TÍNH KẾT CẤU TĂNG CƯỜNG, CẢI TẠO ÁO ĐƯỜNG CŨ');
    expect(pa1Text).toContain('Theo tiêu chuẩn TCCS 38:2022/TCĐBVN (Chương 10)');
    expect(pa1Text).toContain('Cải tạo, nâng cấp (tăng cường áo đường cũ)');
    expect(pa1Text).toContain('II.2. Hiện trạng kết cấu cũ & Nền đường:');
    expect(pa1Text).toContain('Km0+000 – Km0+800');
    expect(pa1Text).toContain('Lớp bù vênh — không tính cường độ (§10.2.1.2)');
    expect(pa1Text).toContain('Bảng 3b: Các lớp kết cấu cũ giữ lại');
    expect(pa1Text).toContain('Ech.m');
    expect(pa1Text).toContain('= Ech,cũ =');
    // Live Benkelman Ech_cu formula: ROUND(10*p*D*(1-mu^2)/l_tt, 2) with full-precision l_tb/S
    const benkEch = pa1Formulas.find((f) => f.formula.startsWith('ROUND(10*') && f.formula.includes('^2)/'));
    expect(benkEch).toBeDefined();
    expect(Number(benkEch?.result)).toBeCloseTo(pa1Res.deflection.foundationModulus_MPa ?? 0, 2);

    const millVerif = runFullVerification(SAMPLE_TCCS38_CH10_MILL);
    const millBytes = await exportVerificationToXlsxBuffer(SAMPLE_TCCS38_CH10_MILL, millVerif);
    const millWb = new ExcelJS.Workbook();
    await millWb.xlsx.load(millBytes.buffer as ArrayBuffer);
    const millText = extractSheetTexts(millWb.worksheets[0]!);
    expect(millText).toContain('Cào bóc tầng mặt hư hỏng, tận dụng móng cũ + tăng cường');
    expect(millText).toContain('Phương pháp C — Quy đổi từ các lớp kết cấu cũ giữ lại');
    expect(millText).toContain('Cấp phối đá dăm loại I (móng trên giữ lại)');
  });

  it('handles DIRECT_FWD formula, NAM_DAU Eq. (A.2), khongCoSoLieuDieuTra, and LGC shoulder design', async () => {
    const fwdProject = {
      ...SAMPLE_TCCS38_CH10,
      projectInfo: { ...SAMPLE_TCCS38_CH10.projectInfo, doiTuongTK: 'LGC' as const },
      forecast: {
        ...SAMPLE_TCCS38_CH10.forecast,
        khongCoSoLieuDieuTra: true,
        llNamTTDirect_trucNgDem: 1200,
        namTinhToan: 'NAM_DAU' as const,
      },
      rehabilitation: {
        ...SAMPLE_TCCS38_CH10.rehabilitation!,
        echMethod: 'DIRECT_FWD' as const,
        directEchCu_MPa: 145,
        directKdc: 0.9,
      },
    };
    const verif = runFullVerification(fwdProject);
    const bytes = await exportVerificationToXlsxBuffer(fwdProject, verif, ['pa-1']);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bytes.buffer as ArrayBuffer);
    const ws = wb.worksheets[0]!;
    const text = extractSheetTexts(ws);
    const formulas = extractSheetFormulas(ws);

    expect(text).toContain('Lề gia cố');
    expect(text).toContain('Công thức (A.2), Phụ lục A');
    expect(text).toContain('Không có số liệu điều tra xe');
    // DIRECT_FWD live Ech_cu = ROUND(F*H, 2) = 130.5
    const fwdFormula = formulas.find((f) => /^ROUND\(F\d+\*H\d+,2\)$/.test(f.formula));
    expect(fwdFormula).toBeDefined();
    expect(Number(fwdFormula?.result)).toBeCloseTo(130.5, 2);
    // NAM_DAU Ne formula: ((1+$F$q/100)^$F$t-1)/($F$q/100)*365*$F$Ntt
    expect(
      formulas.some((f) => /^\(\(1\+\$F\$\d+\/100\)\^\$F\$\d+-1\)\/\(\$F\$\d+\/100\)\*365\*\$F\$\d+$/.test(f.formula))
    ).toBe(true);
  });
});
