import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CDL,
  EXPX,
  MX,
  TC_U2T,
  TEXC,
  atP,
  capDir,
  compute3,
  createTcfPlotter,
  dgChart,
  dgKit,
  dgPut,
  eqPng,
  eqSize,
  fig3,
  getMathJaxScriptUrl,
  hdDxf,
  hdDxfFig,
  hdDxfPreviewSvg,
  hdZip,
  hdZipBytes,
  hvFrame,
  hvdDxf,
  hvdPlcmd,
  mathAll,
  mer3,
  placeTcfLabels,
  pt3,
  qSlab,
  qdSvg,
  render3,
  svgKit,
  svgPng,
  tc86Shape,
  tcDxf,
  texToUnicode,
  unicodeToDxfEscape,
  unicodeToTcvn3Text,
  vSvg,
  type HvdFigureLayout,
  type Pm3dSectionInput,
} from '../../../src/culvert/graphics/index.ts';
import {
  PDF_FONT_SPECS,
  ab64,
  asNum,
  buildExportFilename,
  buildPdf,
  buildPdfData,
  buildWB,
  cellText,
  clearPdfFontCache,
  colLetter,
  downloadBlob,
  expName,
  getLocalFontUrl,
  loadCustomRainStations,
  parseProjectJson,
  pdfFonts,
  removeCustomRainStation,
  saveCustomRainStation,
  serializeProjectJson,
  serializeProjectSnapshot,
  tmParse,
  tmSlug,
} from '../../../src/culvert/export/index.ts';
import { KEEP_APP_ID, KEEP_SCHEMA_VERSION, STORAGE_KEYS } from '../../../src/culvert/types/index.ts';

const testDir = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(testDir, '../../..');
const publicDir = resolve(appRoot, 'public');

// Valid 1x1 white PNG encoded as base64 data URI (authentic IHDR/IDAT/IEND chunks)
const TINY_WHITE_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC';
const TINY_WHITE_PNG_DATA_URI = `data:image/png;base64,${TINY_WHITE_PNG_B64}`;

function loadRealFontProvider(relPath: string): Uint8Array {
  return new Uint8Array(readFileSync(resolve(publicDir, relPath)));
}

function buildFixtureDom(options?: {
  mode?: string;
  divider?: '0' | '1' | '2';
  includeDivisibleShortSheets?: boolean;
}): Document {
  const parser = new DOMParser();
  const mode = options?.mode ?? 'cau';
  const divider = options?.divider ?? '2';

  const wideHeaders = Array.from({ length: 14 }, (_, i) => `<th>C${i + 1}</th>`).join('');
  const wideRow = Array.from({ length: 14 }, (_, i) => `<td>${(i + 1) * 1.5}</td>`).join('');

  const html = `<!doctype html><html lang="vi"><body>
    <select id="appMode"><option value="${mode}" selected>${mode}</option></select>
    <select id="expScope"><option value="all" selected>all</option><option value="one">one</option></select>
    <select id="tq_ngan"><option value="0"${divider === '0' ? ' selected' : ''}>0</option><option value="1"${divider === '1' ? ' selected' : ''}>1</option><option value="2"${divider === '2' ? ' selected' : ''}>2</option></select>
    <input id="tq_obj" value="all" />
    <input id="tq_off" value="" />
    <input id="tq_mo" value="M1" />
    <input id="tq_kn" value="y" />
    <input id="tq_tru" value="deo" />
    <input id="tq_mot" value="nang" />
    <input id="tq_bltn" value="0" />
    <input id="tq_sct" value="0" />
    <input id="sp_sup" value="G" />
    <input id="sp_hm" value="Hạng mục nhịp dầm Super-T" />
    <input id="mo_fnd" value="coc" />
    <input id="dt_fnd" value="coc" />
    <input id="D" value="1200" />
    <input id="fc" value="30" />
    <input id="fy" value="400" />
    <input id="n1" value="16" /><input id="d1" value="25" /><input id="c1" value="100" />
    <input id="phic" value="0.75" /><input id="phit" value="0.9" />
    <input id="phicE" value="1.0" /><input id="phitE" value="1.0" />
    <select id="tie"><option value="S" selected>S</option><option value="T">T</option></select>

    <div class="proj">
      <p data-fmt="DỰ ÁN: {v}"><input id="pj1" value="Cầu vượt Quốc lộ 1A" /></p>
      <p data-fmt="HẠNG MỤC: {v}"><input id="pj4" value="Mố M1 - Cọc khoan nhồi D1200" /></p>
      <p data-fmt="{v}"><input id="pj6" value="BẢNG TÍNH TOÁN KẾT CẤU CẦU" /></p>
    </div>

    <div class="tabs">
      <button class="tab" data-t="7">0. Tổng quan</button>
      <button class="tab" data-t="8">1. Dầm giữa</button>
      <button class="tab" data-t="4">6. Tải trọng mố</button>
      <button class="tab" data-t="3">11. KT cọc vật liệu</button>
    </div>

    <div id="tab7" class="pane">
      <h1 class="ttl">TỔNG QUAN DỰ ÁN</h1>
      <div class="tqtoc">
        <h2>I. TỔNG QUAN</h2>
        <div class="row sub">1. Giới thiệu chung</div>
      </div>
      <h2>1. Thông số chung</h2>
      <div class="row"><span>1</span><span>Chiều dài nhịp tính toán</span><span>L</span><span><input class="in" value="33.00" /></span><span>m</span><span>OK</span></div>
    </div>

    <div id="tab8" class="pane">
      <h1 class="ttl">KIỂM TOÁN DẦM GIỮA BTCT DỰ ỨNG LỰC</h1>
      <p class="small">Hình 1 - Mặt cắt dầm Super-T tại nhịp.</p>
      <div class="row"><span>1.1</span><span>${MX('M_u = 1.25 M_{DC} + 1.75 M_{LL}')}<span class="m" data-tex="M_u"><svg width="10ex" height="2ex"><rect width="10" height="5"/></svg></span></span><span>Mu</span><span>1250.5</span><span>kN.m</span><span>ĐẠT</span></div>
      <div class="row"><span>1.2</span><span>Kiểm tra ứng suất kéo giới hạn cho phép</span><span>f_t</span><span>1.85</span><span>MPa</span><span>NG</span></div>
      <svg id="fig_dam" width="480" height="220"><rect x="10" y="10" width="460" height="200" fill="#eee" stroke="#111"/></svg>
      <table>
        <tr>${wideHeaders}</tr>
        <tr>${wideRow}</tr>
      </table>
    </div>

    <div id="tab4" class="pane">
      <h1 class="ttl">TẢI TRỌNG VÀ TỔ HỢP TẢI TRỌNG MỐ</h1>
      <div class="row"><span>2.1</span><span>Áp lực đất chủ động sau tường mố</span><span>K_a</span><span>0.333</span><span></span><span>Check: OK</span></div>
      <table>
        <tr><th>Tổ hợp</th><th>N (kN)</th><th>M (kN.m)</th><th>Kết quả</th></tr>
        <tr><td class="l">Cường độ Ia</td><td>1420.0</td><td>310.5</td><td class="ok">ĐẠT</td></tr>
        <tr><td class="l">Cường độ Ib</td><td>1380.0</td><td>295.0</td><td class="bad">KHÔNG ĐẠT</td></tr>
      </table>
    </div>

    <div id="tab3" class="pane">
      <h1 class="ttl">KIỂM TOÁN CỌC KHOAN NHỒI THEO VẬT LIỆU</h1>
      <div class="row"><span>3.1</span><span>Đường kính cọc thiết kế</span><span>D</span><span>1200</span><span>mm</span><span>OK</span></div>
    </div>
  </body></html>`;

  return parser.parseFromString(html, 'text/html');
}

describe('Graphics Primitives, CAD DXF/ZIP, Plots3D, MathJax & Export Pipelines', () => {
  afterEach(() => {
    TEXC.clear();
    clearPdfFontCache();
    vi.restoreAllMocks();
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.customRainDb);
    }
  });

  // -------------------------------------------------------------------------
  // 1. SVG Drawing Primitives & Collision Avoidance
  // -------------------------------------------------------------------------
  it('generates structural/hydraulic SVG primitives & resolves TCF label collisions cleanly without canvas', () => {
    expect(svgKit('ab').head).toContain('pattern id="hcab"');
    expect(svgKit('ab').head).toContain('marker id="arab"');

    const chart = dgChart(null, 'g1', {
      Ls: 20,
      xl: 'x (m)',
      yl: 'M (kN.m)',
      title: 'Biểu đồ mô men dầm',
      series: [
        {
          n: 'Mu',
          c: '#1f4e79',
          pts: [
            [0, 0],
            [10, 450],
            [20, 0],
          ],
        },
      ],
      hl: [{ n: 'PhiMn', y: 400, c: '#c00000', da: '4,3' }],
    });
    expect(chart).toContain('<svg');
    expect(chart).toContain('PhiMn');

    const qdMarkup = qdSvg(
      null,
      460,
      200,
      '<g>' +
        qSlab((x) => 40 + x * 40, 80, 12, 18, { L: 4.5, Lc: 0.4, L1: 0.6, L2: 0.5 }) +
        '</g>',
      '__',
    );
    expect(qdMarkup).toContain('url(#__H)');
    expect(qdMarkup).toContain('polygon');
    expect(vSvg([0, 0, 20, 40, 2], (x) => 100 + x, (y) => 100 - y, 1)).toContain('<rect');

    const hvD = dgKit('hv');
    const frame = hvFrame(hvD, 0, 100, 0, 20, { Wd: 500 });
    const hvSvg = dgPut(null, 640, frame.bot, hvD.s, 'hv');
    expect(hvSvg).toContain('<svg');
    expect(hvSvg).toContain('Cao độ (m)');
    expect(frame.X(50)).toBeGreaterThan(frame.L);

    const plotter = createTcfPlotter(null, 500, 360, 'tcf');
    plotter.lp(40, 120, 300, 120, 'stroke="#000" stroke-width="1.2"');
    plotter.tp(120, 118, 'Nhãn 1 trùng vị trí');
    plotter.tp(122, 119, 'Nhãn 2 cần tránh đè');
    const placed = placeTcfLabels(plotter);
    expect(placed).toHaveLength(2);
    const [b0, b1] = placed;
    const overlaps = !(b0[2] < b1[0] || b1[2] < b0[0] || b0[3] < b1[1] || b1[3] < b0[1]);
    expect(overlaps).toBe(false);
    expect(plotter.done()).toContain('<text');
  });

  // -------------------------------------------------------------------------
  // 2. AutoCAD R12 DXF (`AC1009`) & CRC-32 ZIP Archiver
  // -------------------------------------------------------------------------
  it('exports AutoCAD R12 AC1009 DXF (TCVN3 + Unicode), watershed HVD.dxf/plcmd & jszip-verified hdZip', async () => {
    expect(TC_U2T['ư']).toBe('\u00ad');
    expect(unicodeToTcvn3Text('Tường chắn mặt cắt chữ thập').t).not.toContain('ườ');
    expect(unicodeToDxfEscape('Tường chắn D1200')).toContain('\\U+');

    const shape = tc86Shape({
      t1: 0.5,
      H: 4.0,
      w: 50,
      B: 160,
      C1: 40,
      C2: 20,
      A: 220,
      M: 15,
      B1: 15,
      front: 'y',
      mat: 'da',
      Rk: '1',
      H1: '4.0',
    });
    expect(shape.foot).toHaveLength(4);
    expect(shape.stem).toHaveLength(5);
    expect(shape.cap).toHaveLength(5);
    expect(shape.A).toBeCloseTo(2.2, 6);

    const dxfInput = {
      I: {
        H: 5.0,
        b0: 0.6,
        n1: 0,
        n2: 0.25,
        a1: 0.1,
        a2: 0.05,
        t1: 0.5,
        t2: 0.35,
        hf: 0.8,
        m: 0,
        Hs: 0.6,
        LL: true,
        dT: 0.2,
        dT0: 0.1,
        stemMat: 'bt',
        footMat: 'bt',
      },
      g: {
        foot: [
          [0, 0],
          [2.8, 0],
          [2.8, 0.5],
          [0, 0.5],
        ] as Array<[number, number]>,
        stem: [
          [0.6, 0.5],
          [2.45, 0.5],
          [1.2, 5.0],
          [0.6, 5.0],
        ] as Array<[number, number]>,
        cap: null,
        yT: 5.0,
        xbt: 1.2,
        dy: 0,
        B: 2.8,
        xfb: 0.6,
        xbb: 2.45,
        xft: 0.6,
        xf: () => 0.6,
        xb: (y: number) => 2.45 - 0.25 * (y - 0.5),
      },
    };

    const latin1 = new TextDecoder('latin1');
    const r12Tcvn3Bytes = tcDxf(dxfInput, 'mm', 'tcvn3');
    const r12Tcvn3 = latin1.decode(r12Tcvn3Bytes);
    expect(r12Tcvn3).toContain('AC1009');
    expect(r12Tcvn3).toContain('$DWGCODEPAGE');
    expect(r12Tcvn3).toContain('ANSI_1252');
    expect(r12Tcvn3).toContain('vnarial.ttf');
    expect(r12Tcvn3).toContain('TEXT');
    expect(r12Tcvn3).toContain('EOF');
    expect(r12Tcvn3).not.toContain('NaN');

    const r12UniBytes = tcDxf(dxfInput, 'm', 'uni');
    const r12Uni = latin1.decode(r12UniBytes);
    expect(r12Uni).toContain('AC1009');
    expect(r12Uni).toContain('\\U+');

    const wsDxf = hvdDxf({
      Fkm: 12.345,
      L: 5.2,
      sl: 1.85,
      outVN: [560100, 2180200],
      bnd: [
        [560000, 2180000],
        [561000, 2180000],
        [561000, 2181000],
        [560000, 2181000],
      ],
      mainP: [
        [560100, 2180200],
        [560600, 2180600],
        [560900, 2180900],
      ],
      brP: [
        [
          [560600, 2180600],
          [560800, 2180400],
        ],
      ],
      brO: [],
      contours: [{ z: 50, closed: false, pts: [[560200, 2180300], [560700, 2180800]] }],
    });
    expect(wsDxf).toContain('AC1009');
    expect(wsDxf).toContain('LUU_VUC');
    expect(wsDxf).toContain('SUOI_CHINH');
    expect(wsDxf).toContain('DONG_MUC');

    const plcmd = hvdPlcmd(
      [
        [560000, 2180000],
        [561000, 2180000],
        [560500, 2180500],
      ],
      true,
    );
    expect(plcmd).toContain('_.PLINE');
    expect(plcmd).toContain('_non 560000.000,2180000.000');
    expect(plcmd).toContain('_C');

    const fallbackFigDxf = hdDxf({
      Fkm: 12.345,
      L: 5.2,
      sl: 1.85,
      bnd: [
        [560000, 2180000],
        [561000, 2180000],
        [561000, 2181000],
        [560000, 2181000],
      ],
      mainP: [
        [560100, 2180200],
        [560900, 2180900],
      ],
      brP: [],
      prof: [
        [0, 12.5],
        [5.2, 118.4],
      ],
      contours: [],
    });
    expect(fallbackFigDxf).toContain('AC1009');
    expect(fallbackFigDxf).toContain('LUU_VUC');

    const figLay: HvdFigureLayout = {
      c0: 0,
      r0: 0,
      sx: 1,
      sy: 1,
      G: { w: 105.0, n: 21.0, rx: 0.0003, ry: 0.0003 },
      o: { ll: true, lon0: 105 },
      boxes: [
        {
          b: { x: 10, y: 10, bw: 160, bh: 48 },
          L: [
            ['Lưu vực F = 12,345 km²', '#a000a0', '#e000e0'],
            ['Suối chính L = 5,200 km', '#e00000', '#ff0000'],
          ],
          sw: 36,
        },
      ],
      leads: [[100, 100, 10, 10]],
      dot: [150, 150],
      out: [100, 100],
      north: [480, 20],
      r2: {
        bnd: [
          [560010, 2180010],
          [560990, 2180010],
          [560990, 2180990],
        ],
        mainP: [
          [560120, 2180220],
          [560880, 2180880],
        ],
      },
    };
    const annotatedFigDxf = hdDxfFig(
      {
        Fkm: 12.345,
        L: 5.2,
        sl: 1.85,
        outVN: [560100, 2180200],
        bnd: [
          [560000, 2180000],
          [561000, 2180000],
          [561000, 2181000],
        ],
        mainP: [
          [560100, 2180200],
          [560900, 2180900],
        ],
        brP: [],
      },
      figLay,
    );
    expect(annotatedFigDxf).toContain('AC1009');
    expect(annotatedFigDxf).toContain('GHI_CHU_NEN');
    expect(annotatedFigDxf).toContain('SO_SANH_DEM');
    expect(annotatedFigDxf).toContain('DASHED');
    expect(annotatedFigDxf).toContain('\\U+');

    const previewSvg = hdDxfPreviewSvg({
      Fkm: 12.345,
      L: 5.2,
      sl: 1.85,
      bnd: [
        [0, 0],
        [100, 0],
        [100, 100],
      ],
      mainP: [
        [10, 10],
        [90, 90],
      ],
      prof: [
        [0, 12.5],
        [5.2, 118.4],
      ],
    });
    expect(previewSvg).toContain('<svg');
    expect(previewSvg).toContain('F = 12.345 km²');
    expect(previewSvg).toContain('Trắc dọc: 2 điểm');

    // Pack multi-file ZIP (`hdZipBytes` + `hdZip` Blob) and verify decompression + CRC-32 via JSZip
    const zipBytes = hdZipBytes([
      { name: 'HVD.dxf', data: wsDxf },
      { name: 'HVD.plcmd', data: plcmd },
      { name: 'note.txt', data: 'Lưu vực Cầu Sông Mã — H=5.0m' },
    ]);
    expect(zipBytes[0]).toBe(0x50);
    expect(zipBytes[1]).toBe(0x4b);

    const unpacked = await JSZip.loadAsync(zipBytes);
    expect(Object.keys(unpacked.files).sort()).toEqual(['HVD.dxf', 'HVD.plcmd', 'note.txt']);
    expect(await unpacked.file('HVD.dxf')!.async('string')).toBe(wsDxf);
    expect(await unpacked.file('HVD.plcmd')!.async('string')).toBe(plcmd);
    expect(await unpacked.file('note.txt')!.async('string')).toBe('Lưu vực Cầu Sông Mã — H=5.0m');

    const singleZipBlob = hdZip('HVD.dxf', wsDxf);
    expect(singleZipBlob).toBeInstanceOf(Blob);
    expect(singleZipBlob.type).toBe('application/zip');
    const singleZipBuf = await new Promise<ArrayBuffer>((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result as ArrayBuffer);
      fr.onerror = () => rej(fr.error);
      fr.readAsArrayBuffer(singleZipBlob);
    });
    const singleZip = await JSZip.loadAsync(singleZipBuf);
    expect(Object.keys(singleZip.files)).toEqual(['HVD.dxf']);
    expect(await singleZip.file('HVD.dxf')!.async('string')).toBe(wsDxf);
  });

  // -------------------------------------------------------------------------
  // 3. Plotly 3D P-M-M Surface & Jsdom SVG Fallback
  // -------------------------------------------------------------------------
  it('computes 3D circular P-M-M capacity surfaces & safely renders fallback in headless jsdom', () => {
    expect(CDL.length).toBeGreaterThan(130);

    const D = 1200;
    const R = D / 2;
    const barArea = 491; // Phi 25
    const nBars = 20;
    const bars = Array.from({ length: nBars }, (_, i) => {
      const ang = ((90 - (360 * i) / nBars) * Math.PI) / 180;
      return { x: (R - 100) * Math.cos(ang), y: (R - 100) * Math.sin(ang), a: barArea, i: i + 1 };
    });
    const As = nBars * barArea;
    const Ac = Math.PI * R * R;
    const fc = 30;
    const fy = 400;
    const sec: Pm3dSectionInput = {
      D,
      R,
      bars,
      As,
      fc,
      fy,
      Es: 200000,
      a1: 0.85,
      b1: 0.8357,
      ecl: 0.002,
      etl: 0.005,
      kP: 0.85,
      Po: (0.85 * fc * (Ac - As) + fy * As) / 1000,
    };

    const pSample = pt3(sec, Math.PI / 4, 0.5 * D, 0.75, 0.9);
    expect(pSample.M).toBeGreaterThan(100);
    const m0 = mer3(sec, 0, 0.75, 0.9);
    expect(atP(m0, pSample.P)?.M ?? 0).toBeGreaterThan(100);
    const dirCap = capDir(sec, 0.3, 1200, 0.75, 0.9, 0.75 * sec.kP * sec.Po);
    expect(dirCap).toBeGreaterThan(500);

    const st3 = compute3(
      sec,
      [{ nm: 'Nmax', P: 1200, Mx: 300, My: 400, M: 500 }],
      [{ nm: 'DB1', P: 1200, Mx: 350, My: 420, M: 546.7 }],
      { phic: 0.75, phit: 0.9, phicE: 1.0, phitE: 1.0 },
    );
    expect(st3.CD.X.length).toBeGreaterThan(130);
    expect(st3.CD.X[0]).toHaveLength(73);
    expect(st3.CD.loads[0].ratio3).toBeGreaterThan(1);

    const figCD = fig3(st3, 'CD');
    expect(figCD.data).toHaveLength(2);
    expect(figCD.data[0].type).toBe('surface');
    expect(figCD.data[1].type).toBe('scatter3d');

    const dom = new DOMParser().parseFromString(
      `<div id="wrap">
        <button id="b3CD" aria-pressed="true"></button>
        <button id="b3DB" aria-pressed="false"></button>
        <div id="p3d"></div>
        <table id="tbBi"></table>
        <div id="klBi"></div>
      </div>`,
      'text/html',
    );
    const res = render3({ st3, cur3: 'DB', root: dom });
    expect(res).not.toBeNull();
    expect(res!.ok).toBe(true);
    expect(res!.usedPlotly).toBe(false);
    expect(dom.querySelector('#p3d svg.p3d-fallback')).not.toBeNull();
    expect(dom.querySelector('#b3DB')?.getAttribute('aria-pressed')).toBe('true');
    expect(dom.querySelector('#tbBi')?.innerHTML).toContain('Nmax');
    expect(dom.querySelector('#klBi')?.textContent).toContain('ĐẠT');
    expect(window.__biOK?._root).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 4. Offline MathJax TeX-to-SVG (`TEXC`, `texToUnicode`, `eqSize`, Rasterizers)
  // -------------------------------------------------------------------------
  it('configures offline MathJax URL, caches SVG in TEXC, falls back offline cleanly, and scales eqSize', async () => {
    const mjUrl = getMathJaxScriptUrl();
    expect(mjUrl).toContain('vendor/mathjax/tex-svg.js');
    expect(mjUrl).not.toMatch(/^https?:\/\//);

    expect(EXPX).toBe(7.2);
    expect(texToUnicode('\\dfrac{a + b}{2} + \\sqrt{c}')).toBe('(a + b)/(2) + c');
    expect(MX('M_u = \\frac{qL^2}{8}')).toContain('class="m"');

    const root = new DOMParser().parseFromString(
      `<div>${MX('\\dfrac{qL^2}{8}')}${MX('\\dfrac{qL^2}{8}')}</div>`,
      'text/html',
    );

    // Offline fallback mode when MathJax.tex2svg is not loaded yet
    delete window.MathJax;
    mathAll(root);
    const spans = Array.from(root.querySelectorAll<HTMLElement>('.m'));
    expect(spans[0].textContent).toContain('(qL^2)/(8)');
    expect(spans[0].dataset.r).toBe('0\\dfrac{qL^2}{8}');

    // Switch to cached MathJax SVG mode (`TEXC` must deduplicate identical TeX expressions)
    let callCount = 0;
    window.MathJax = {
      tex2svg: (tex: string) => {
        callCount += 1;
        const host = document.createElement('div');
        host.innerHTML = `<svg width="20ex" height="3ex" data-expr="${tex}"><rect width="20" height="3"/></svg>`;
        return host;
      },
    };
    mathAll(root);
    expect(callCount).toBe(1);
    expect(TEXC.has('\\dfrac{qL^2}{8}')).toBe(true);
    expect(spans[1].querySelector('svg')).not.toBeNull();

    const svgNode = spans[0].querySelector('svg')!;
    expect(eqSize(svgNode)).toEqual({ W: 144, H: 22 });

    const eqData = await eqPng(svgNode, 144, 22, {
      rasterize: (_xml, pxW, pxH) => {
        expect(pxW).toBe(432);
        expect(pxH).toBe(66);
        return TINY_WHITE_PNG_DATA_URI;
      },
    });
    expect(eqData).toBe(TINY_WHITE_PNG_DATA_URI);

    const figEl = root.createElementNS('http://www.w3.org/2000/svg', 'svg');
    figEl.setAttribute('width', '300');
    figEl.setAttribute('height', '150');
    const figOut = await svgPng(figEl, {
      rasterize: (_xml, pxW, pxH) => {
        expect(pxW).toBe(600);
        expect(pxH).toBe(300);
        return TINY_WHITE_PNG_DATA_URI;
      },
    });
    expect(figOut.W).toBe(300);
    expect(figOut.H).toBe(150);
  });

  // -------------------------------------------------------------------------
  // 5. Real ExcelJS `.xlsx` Generation (`buildWB`) + Divider Sheets & ZIP Check
  // -------------------------------------------------------------------------
  it('builds real ExcelJS .xlsx workbook with tq_ngan dividers, wide-table expansion, images & PM curve sheet', async () => {
    const doc = buildFixtureDom({ mode: 'cau', divider: '2' });

    const { wb, metas, buffer } = await buildWB({
      documentRoot: doc,
      eqRasterizer: () => TINY_WHITE_PNG_DATA_URI,
      svgRasterizer: () => TINY_WHITE_PNG_DATA_URI,
    });

    expect(colLetter(1)).toBe('A');
    expect(colLetter(27)).toBe('AA');
    expect(asNum('12.340')).toEqual({ v: 12.34, fmt: '0.000' });
    expect(cellText(doc.querySelector('#tab7 .row span:nth-child(4)')!)).toBe('33.00');

    // Valid ZIP/XLSX signature
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);

    const sheetNames = wb.worksheets.map((w) => w.name);
    expect(sheetNames).toContain('0. Muc luc');
    expect(sheetNames).toContain('Ngan I');
    expect(sheetNames).toContain('0. Tong quan');
    expect(sheetNames).toContain('Ngan II');
    expect(sheetNames).toContain('Ngan II.1');
    expect(sheetNames).toContain('Ngan III');
    expect(sheetNames).toContain('Ngan III.1');
    expect(sheetNames).toContain('Bieu do tuong tac');

    // Verify divider styling (`#CCFFFF` + double `#0000FF` bottom border)
    const ngan1 = wb.getWorksheet('Ngan I')!;
    expect(ngan1.getCell('A1').fill).toMatchObject({
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFCCFFFF' },
    });
    expect(ngan1.getCell('A2').border?.bottom?.style).toBe('double');

    // Verify wide 14-col table triggered dynamic expansion on sheet "1. Dam giua"
    const damMeta = metas.find((m) => m.name.includes('Dam giua'));
    expect(damMeta).toBeDefined();
    expect(damMeta!.xc).toBe(3); // 14 + 1 - 12
    expect(damMeta!.widths).toHaveLength(15);
    expect(damMeta!.widths.slice(12)).toEqual([6.5, 6.5, 6.5]);
    expect(damMeta!.imgs.length).toBeGreaterThanOrEqual(2); // equation + SVG PNGs

    // Unzip actual generated XLSX bytes and check XML inside
    const xlsxZip = await JSZip.loadAsync(buffer);
    const workbookXml = await xlsxZip.file('xl/workbook.xml')!.async('string');
    expect(workbookXml).toContain('Ngan I');
    expect(workbookXml).toContain('Bieu do tuong tac');
  });

  // -------------------------------------------------------------------------
  // 6. Real `jspdf` Multi-Page A4 `.pdf` Generation + Local TTFs + Coalescing
  // -------------------------------------------------------------------------
  it('generates real A4 multi-page PDF embedding local Vietnamese TTFs, footers, dividers & sheet coalescing', async () => {
    expect(getLocalFontUrl('fonts/Tinos_400Regular.ttf')).toContain('fonts/Tinos_400Regular.ttf');
    expect(ab64(new Uint8Array([72, 105]))).toBe('SGk=');

    const fonts = await pdfFonts({ fontProvider: loadRealFontProvider });
    expect(fonts).toHaveLength(PDF_FONT_SPECS.length);
    fonts.forEach((f) => expect(f.b64.length).toBeGreaterThan(50_000));

    // Part A: Full bridge multi-sheet export with dividers (`tq_ngan = 2`)
    const doc = buildFixtureDom({ mode: 'cau', divider: '2' });
    const pdfRes = await buildPdfData({
      documentRoot: doc,
      fontProvider: loadRealFontProvider,
      eqRasterizer: () => TINY_WHITE_PNG_DATA_URI,
      svgRasterizer: () => TINY_WHITE_PNG_DATA_URI,
    });

    const headerAscii = new TextDecoder().decode(pdfRes.bytes.subarray(0, 8));
    expect(headerAscii.startsWith('%PDF-')).toBe(true);
    expect(pdfRes.blob.size).toBeGreaterThan(20_000);
    expect(pdfRes.pages.length).toBeGreaterThanOrEqual(5);
    expect(window.__PDFPAGES).toEqual(pdfRes.pages);

    // Check divider sheets are non-coalesced separator pages
    const nganPages = pdfRes.pages.filter((p) => p.sheetName.startsWith('Ngan '));
    expect(nganPages.length).toBeGreaterThanOrEqual(3);
    nganPages.forEach((p) => expect(p.coalesced).toBe(false));

    // Check `buildPdf()` convenience wrapper returns matching valid `%PDF-` Blob
    const directBlob = await buildPdf({
      documentRoot: doc,
      fontProvider: loadRealFontProvider,
      eqRasterizer: () => TINY_WHITE_PNG_DATA_URI,
      svgRasterizer: () => TINY_WHITE_PNG_DATA_URI,
    });
    expect(directBlob.size).toBeGreaterThan(20_000);

    // Part B: Verify consecutive same-signature sheet coalescing (`AV - Y >= 0.15 * AV`)
    const shortDoc = new DOMParser().parseFromString(
      `<!doctype html><html lang="vi"><body>
        <select id="appMode"><option value="tc" selected>tc</option></select>
        <select id="expScope"><option value="all" selected>all</option></select>
        <select id="tq_ngan"><option value="0" selected>0</option></select>
        <input id="pj4" value="Tường chắn trọng lực" />
        <div class="proj">
          <p data-fmt="HẠNG MỤC: {v}"><input id="pj4_view" value="TƯỜNG CHẮN" /></p>
          <p data-fmt="{v}"><input id="pj6" value="BẢNG TÍNH TƯỜNG CHẮN" /></p>
        </div>
        <div id="tab41" class="pane">
          <h1 class="ttl">1. SỐ LIỆU - TẢI TRỌNG</h1>
          <div class="row"><span>1</span><span>Chiều cao tường</span><span>H</span><span>4.0</span><span>m</span><span>OK</span></div>
        </div>
        <div id="tab42" class="pane">
          <h1 class="ttl">2. KIỂM TOÁN TƯỜNG CHẮN</h1>
          <div class="row"><span>2</span><span>Hệ số ổn định trượt</span><span>K_t</span><span>1.85</span><span></span><span>ĐẠT</span></div>
        </div>
      </body></html>`,
      'text/html',
    );

    const coalRes = await buildPdfData({
      documentRoot: shortDoc,
      fontProvider: loadRealFontProvider,
    });
    // Sheet 1 and Sheet 2 share identical header + footer signature and both fit on Page 1!
    expect(coalRes.metas).toHaveLength(2);
    expect(coalRes.pages).toHaveLength(1);
    expect(coalRes.pages[0].coalesced).toBe(true);
    expect(window.__PDFPAGES).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  // 7. `.json` Save / Open Roundtrip, Migrations, Filenames & `TM_DB`
  // -------------------------------------------------------------------------
  it('roundtrips _app:"ckn11823" JSON snapshots, runs _v<9 migrations, formats filenames & persists TM_DB', () => {
    const fixedDate = new Date(2026, 10, 11); // 20261111

    expect(buildExportFilename({ mode: 'cau', ext: 'xlsx', D: 1200, date: fixedDate })).toBe(
      'Kiem toan CKN D1200 20261111.xlsx',
    );
    expect(buildExportFilename({ mode: 'cau', ext: 'pdf', date: fixedDate })).toBe(
      'Bang tinh mo coc 20261111.pdf',
    );
    expect(buildExportFilename({ mode: 'ch', ext: 'xlsx', chCells: 2, date: fixedDate })).toBe(
      'Bang tinh cong hop 2 ngan 20261111.xlsx',
    );
    expect(buildExportFilename({ mode: 'ct', ext: 'pdf', ctD0: 1.5, date: fixedDate })).toBe(
      'Bang tinh cong tron D1500 20261111.pdf',
    );
    expect(buildExportFilename({ mode: 'tc', ext: 'xlsx', tcH: 5.5, date: fixedDate })).toBe(
      'Bang tinh tuong chan H5.5m 20261111.xlsx',
    );
    expect(buildExportFilename({ mode: 'tl', ext: 'pdf', tlH: 6, date: fixedDate })).toBe(
      'Bang tinh tuong chan L H6m 20261111.pdf',
    );
    expect(buildExportFilename({ mode: 'tv', ext: 'xlsx', date: fixedDate })).toBe(
      'Bang tinh thuy van cau 20261111.xlsx',
    );
    expect(buildExportFilename({ mode: 'tvc', ext: 'pdf', date: fixedDate })).toBe(
      'Bang tinh thuy van cong 20261111.pdf',
    );
    expect(buildExportFilename({ mode: 'cau', ext: 'json', date: fixedDate })).toBe(
      'So lieu cau 20261111.json',
    );
    expect(
      expName('Kiem toan CKN D1200 20261111.xlsx', {
        scope: 'one',
        openTabName: '2. Dầm biên (BTCT DƯL)',
      }),
    ).toBe('Kiem toan CKN D1200 20261111 - 2. Dam bien BTCT DUL.xlsx');

    // Serialize + roundtrip parse (`v9`)
    const wireJson = serializeProjectJson({
      mode: 'ch',
      values: { ch_B: '3.0', ch_H: '2.5', tq_off: '12,13' },
      metadata: { pj1: 'Cầu dân sinh Thanh Hóa', pj4: 'Cống hộp 3x2.5' },
    });
    const parsed = parseProjectJson(wireJson);
    expect(parsed._app).toBe(KEEP_APP_ID);
    expect(parsed._v).toBe(KEEP_SCHEMA_VERSION);
    expect(parsed._mode).toBe('ch');
    expect(parsed.values.ch_B).toBe('3.0');
    expect(parsed.metadata?.pj1).toBe('Cầu dân sinh Thanh Hóa');

    // Nested snapshot format roundtrip
    const snap = serializeProjectSnapshot({
      mode: 'tl',
      values: { tl_H: '5.5' },
      metadata: { pj6: 'BẢNG TÍNH TƯỜNG CHẮN CHỮ L' },
    });
    expect(parseProjectJson(JSON.stringify(snap)).values.tl_H).toBe('5.5');

    // Legacy `_v < 9` migration rules (`mo_jtm`, `s2_geoT`, `bm_sLB`, `s2_geo`, `s2_spt`, default `tq_off`)
    const legacyRaw = JSON.stringify({
      _app: 'ckn11823',
      _v: 1,
      _mode: 'unknown_mode',
      mo_jtm: 'old',
      s2_geoT: 'old_table',
      bm_sLB: '150',
      s2_geo: '123',
      s2_spt: '',
      D: '1000',
    });
    const migrated = parseProjectJson(legacyRaw);
    expect(migrated._v).toBe(9);
    expect(migrated._mode).toBe('cau');
    expect(migrated.values.mo_jtm).toBeUndefined();
    expect(migrated.values.s2_geoT).toBeUndefined();
    expect(migrated.values.bm_sLB).toBeUndefined();
    expect(migrated.values.s2_geo).toBeUndefined();
    expect(migrated.values.s2_spt).toBeUndefined();
    expect(migrated.values.tq_off).toBe('');
    expect(migrated.values.D).toBe('1000');

    expect(() => parseProjectJson('{"_app":"wrong"}')).toThrow();

    // Browser Blob download smoke test (mock URL & anchor click in jsdom)
    const createObjSpy = vi.fn(() => 'blob:mock-url');
    const revokeObjSpy = vi.fn();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.stubGlobal('URL', { createObjectURL: createObjSpy, revokeObjectURL: revokeObjSpy });
    downloadBlob('test.json', '{"ok":1}', 'application/json');
    expect(createObjSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);

    // Custom rainfall station persistence (`TM_DB` on `localStorage['tramMua']`)
    expect(tmSlug('Trạm Đo Mưa Nông Cống')).toBe('Tram_Do_Mua_Nong_Cong');
    expect(tmParse('2020 185.2\n2021 210,5\nbad_line\n1790 100')).toEqual([
      [2020, 185.2],
      [2021, 210.5],
    ]);
    expect(saveCustomRainStation('Nông Cống', '2020 150\n2021 160')).toBeNull();
    const savedStation = saveCustomRainStation(
      'Nông Cống',
      '2020 150\n2021 175.4\n2022 201.0',
    );
    expect(savedStation?.slug).toBe('Nong_Cong');
    const loadedStations = loadCustomRainStations();
    expect(loadedStations).toHaveLength(1);
    expect(loadedStations[0].ser).toHaveLength(3);
    expect(removeCustomRainStation('Nông Cống')).toBe(true);
    expect(loadCustomRainStations()).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // 8. Clean-Room Zero-CDN & Zero-Licensing Audit across All Owned Files
  // -------------------------------------------------------------------------
  it('contains zero https:// CDN URLs, Electron hooks, or licensing references in any owned source file', () => {
    const ownedFiles = [
      'src/culvert/graphics/svgPrimitives.ts',
      'src/culvert/graphics/cadDxfExport.ts',
      'src/culvert/graphics/plots3d.ts',
      'src/culvert/graphics/texMath.ts',
      'src/culvert/graphics/index.ts',
      'src/culvert/export/excelExport.ts',
      'src/culvert/export/pdfExport.ts',
      'src/culvert/export/projectIo.ts',
      'src/culvert/export/index.ts',
    ];

    const forbiddenPatterns: ReadonlyArray<{ label: string; regex: RegExp }> = [
      { label: 'https:// external URL', regex: /https:\/\//i },
      { label: 'cdn.jsdelivr.net URL', regex: /cdn\.jsdelivr\.net/i },
      { label: '@expo-google-fonts', regex: /expo-google-fonts/i },
      { label: 'pdfmake reference', regex: /pdfmake/i },
      { label: 'Electron host bridge', regex: /window\.__tv4|ipcRenderer|contextBridge/ },
      { label: 'Claude sandbox bridge', regex: /window\.claude/ },
      { label: 'Licensing / activation token', regex: /\blicens|\bhwid\b|\bmachineId\b|\bactivat|\btrial|\.lic\b/i },
    ];

    for (const rel of ownedFiles) {
      const text = readFileSync(resolve(appRoot, rel), 'utf8');
      for (const { label, regex } of forbiddenPatterns) {
        expect(text, `Found forbidden ${label} in ${rel}`).not.toMatch(regex);
      }
    }
  });
});
