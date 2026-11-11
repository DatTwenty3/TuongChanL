import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import zlib from 'node:zlib';
import { PDFDocument } from 'pdf-lib';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SHEET_DEFS,
  autoScale,
  buildAllSheets,
  buildSheet,
  toDXF,
  toSVG,
} from '../src/cad';
import {
  CFE,
  DIAS,
  D_TAB,
  KE_TAB,
  buildBars,
  calcApplyFixes,
  calcBadgeStatus,
  calcChecks,
  calcDefaults,
  calcEnsure,
  calcFamilyFix,
  calcFeEnsure,
  calcFemRun,
  calcGsOut,
  calcGsRunNow,
  calcHeelHint,
  calcRun,
  calcSuggest,
  fmt,
  fmt2,
  mergeProject,
  presetCanti,
  presetKe,
  presetRib,
  presetWall4,
  quantities,
  resetEngineCaches,
  setCalcDec as setEngineCalcDec,
  type CantiCalcResult,
  type EngineProject,
  type RibCalcResult,
} from '../src/engine';
import {
  baseName,
  buildCadPrintHtml,
  buildCsvContent,
  calcDocxBlob,
  calcPrintDoc,
  dxFooter,
  dxSettings,
  dxStyles,
  exportCadPdfBytes,
  exportCalcPdfBytes,
  omLines,
  omParse,
  omPieces,
  parseProjectFile,
  serializeProject,
  zCrc32,
  zDeflate,
} from '../src/export';
import { m3Bars, m3Concrete, model3D, v3FormatTip } from '../src/model3d';
import {
  FE_VIEWS,
  calcGsView,
  calcRbView,
  calcSheetHTML,
  cfAnchor,
  cfBase,
  cfFeContour,
  cfFeReact,
  cfFeRibDiag,
  cfFeSecPos,
  cfLoads,
  cfPressure,
  cfRC,
  cfRbScheme,
  cfRibChart,
  cfRibElev,
  cfRibPlan,
  cfSection,
  cfWeights,
  feElemInfo,
  feMVNTable,
  feStripTables,
  resetReportFigCounter,
  sF,
  setCalcDec as setReportDec,
  texToHtml,
} from '../src/reports';

interface RefReportOracle {
  DIAS: number[];
  KE_TAB: Array<Record<string, unknown>>;
  D_TAB: Array<Record<string, unknown>>;
  CFE: {
    fieldOf: (fe: unknown, k: string, q: string) => Float64Array;
  };
  presetCanti: (H?: number, keep?: Record<string, unknown>) => EngineProject;
  presetRib: () => EngineProject;
  presetKe: (keep?: Record<string, unknown>, idx?: number) => EngineProject;
  presetWall4: (keep?: Record<string, unknown>, idx?: number) => EngineProject;
  mergeProject: (s: Record<string, unknown>) => EngineProject;
  baseName: (name?: string) => string;
  calcDefaults: () => Record<string, unknown>;
  calcEnsure: (p: EngineProject) => Record<string, unknown>;
  calcFamilyFix: (p: EngineProject, wasD: boolean) => void;
  setAnc: (p: EngineProject, on: boolean) => void;
  buildBars: (p: EngineProject) => Record<string, unknown>;
  quantities: (p: EngineProject, bars?: unknown) => Record<string, unknown>;
  calcRun: (p: EngineProject) => Record<string, unknown>;
  calcFeEnsure: (p: EngineProject) => boolean;
  calcGsRunNow: (p: EngineProject) => boolean;
  calcFemRun: (p: EngineProject, done: () => void) => boolean;
  calcChecks: (R: unknown) => Array<{ id: string; t: string; ok: boolean; v: number; info?: boolean }>;
  calcBadgeCount: (R: unknown) => number;
  setDec: (d: '.' | ',') => void;
  resetReportFigs: (n?: number) => void;
  resetCaches: () => void;
  // TeX & OOXML micro-helpers
  texToHtml: (s: string) => string;
  omPieces: (s: string) => string[];
  omLines: (s: string) => string[];
  omParse: (s: string) => string;
  dxStyles: () => string;
  dxSettings: () => string;
  dxFooter: () => string;
  // Report figures, charts & HTML
  calcSheetHTML: (p: EngineProject, R: unknown) => string;
  calcGsView: (p: EngineProject, R: unknown) => string;
  calcRbView: (p: EngineProject, R: unknown) => string;
  calcPrintDoc: (p: EngineProject) => string;
  calcDocxBlob: (p: EngineProject, R: unknown) => Promise<Blob>;
  cfSection: (R: unknown) => string;
  cfWeights: (R: unknown) => string;
  cfPressure: (R: unknown, c?: unknown) => string;
  cfBase: (R: unknown) => string;
  cfLoads: (R: unknown) => string;
  cfRbScheme: (p: EngineProject, R: unknown, res?: unknown) => string;
  cfRC: (R: unknown) => string;
  cfAnchor: (R: unknown) => string;
  cfRibPlan: (R: unknown) => string;
  cfRibElev: (R: unknown) => string;
  cfRibChart: (R: unknown) => string;
  cfFeContour: (R: unknown, o?: Record<string, unknown>) => string;
  cfFeReact: (R: unknown, k: string) => string;
  cfFeSecPos: (R: unknown) => string;
  cfFeRibDiag: (R: unknown) => string;
  feMVNTable: (R: unknown) => string;
  feStripTables: (R: unknown, k: string) => string;
  feElemInfo: (R: unknown, e: number, vals: Float64Array, v: { q: string; k: string }) => string;
  // CAD & 3D
  autoScale: (p: EngineProject, res: unknown, q: unknown) => number;
  buildAllSheets: (p: EngineProject, res: unknown, q: unknown, S?: number) => Array<Record<string, unknown>>;
  toSVG: (sh: unknown, o?: Record<string, unknown>) => string;
  toDXF: (sheets: unknown[]) => string;
  model3D: (p: EngineProject, res: unknown) => Record<string, unknown>;
}

const PNG_1X1 = new Uint8Array([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0,
  0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84, 120, 156, 99, 248, 255, 255, 63, 0, 5, 254, 2,
  254, 167, 53, 129, 132, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
]);

function makeJpgWithDimMarker(w: number, h: number): Uint8Array {
  return new Uint8Array([
    0xff,
    0xd8,
    0xff,
    0xfe,
    0x00,
    0x06,
    (w >> 8) & 0xff,
    w & 0xff,
    (h >> 8) & 0xff,
    h & 0xff,
    0xff,
    0xd9,
  ]);
}

function loadReportOracle(): RefReportOracle {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const modulesDir = path.resolve(here, '../../analysis/modules');
  const readMod = (name: string) => fs.readFileSync(path.join(modulesDir, name), 'utf8');
  const linesSlice = (name: string, start: number, end: number) =>
    readMod(name)
      .split(/\r?\n/)
      .slice(start - 1, end)
      .join('\n');

  const ctxObj: Record<string, unknown> = {
    Math,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Map,
    Set,
    JSON,
    Date,
    RegExp,
    Error,
    Promise,
    ArrayBuffer,
    DataView,
    Int8Array,
    Int32Array,
    Uint8Array,
    Uint8ClampedArray,
    Uint16Array,
    Uint32Array,
    Float64Array,
    Float32Array,
    TextEncoder,
    TextDecoder,
    CompressionStream,
    Response,
    Blob,
    URL,
    DOMParser,
    XMLSerializer,
    document,
    isFinite,
    isNaN,
    parseFloat,
    parseInt,
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
  };
  Object.defineProperty(ctxObj, 'Image', {
    get: () => globalThis.Image,
    configurable: true,
    enumerable: true,
  });

  const context = vm.createContext(ctxObj);
  const run = (code: string, filename: string) => vm.runInContext(code, context, { filename });

  for (const mod of [
    '01_project_geom.js',
    '02_cad_2d.js',
    '03_template_b_canti.js',
    '04_template_c_ke.js',
    '05_template_d_anchor_rebar.js',
    '06_template_d_cad.js',
    '07_water_seepage.js',
    '08_slope_stability.js',
    '09_calc_core.js',
    '10_calc_orchestrator.js',
    '11_calc_ribbed.js',
    '12_fe3d_shell.js',
    '13_cfe_continuous.js',
    '14_fem2d_worker.js',
    '15_tex_html.js',
    '16_calc_figures.js',
    '17_calc_sheet_html.js',
    '18_calc_ext_sheet.js',
    '19_calc_fe_sheet.js',
    '20_calc_gs_fem_sheet.js',
    '21_calc_rib_sheet.js',
    '22_docx_exporter.js',
    '23_model_3d.js',
  ]) {
    run(readMod(mod), mod);
  }

  // Safe non-UI/non-licensing functional slices of 25_calc_ui_print.js and 26_app_ui_export.js
  run('var P = presetCanti(500);', '26_state_stub.js');
  run(linesSlice('25_calc_ui_print.js', 4, 83), '25_checks.js');
  run(linesSlice('25_calc_ui_print.js', 1225, 1332), '25_fe_helpers.js');
  run(linesSlice('25_calc_ui_print.js', 1561, 1568), '25_calcPrintDoc.js');
  run(linesSlice('26_app_ui_export.js', 1090, 1097), '26_baseName.js');
  run(linesSlice('26_app_ui_export.js', 1182, 1192), '26_setAnc.js');
  run(linesSlice('26_app_ui_export.js', 1203, 1246), '26_mergeProject.js');

  run(
    `
    function buildAllSheetsRef(p, res, q, S) {
      const sc = S || autoScale(p, res, q);
      DIM_ID = 0;
      return SHEET_DEFS.map((_, i) => buildCluster(p, res, q, i, sc));
    }
    function setDecRef(d) {
      CALC_DEC = d === "," ? "," : ".";
    }
    function resetReportFigsRef(n = 0) {
      _sFig = n;
      _cfN = 0;
      _gsId = 0;
    }
    function calcBadgeCountRef(R) {
      if (!R || R.error || R.unsupported) return 0;
      return calcChecks(R).filter((x) => !x.ok && !x.info).length;
    }
    function resetCachesRef() {
      _calcCache = { key: "", res: null };
      _feCache = { key: "", fe: null, id: 0 };
      _gsCache = { key: "", res: null, tpl: "" };
      _femCache = { key: "", ekey: "", out: null, err: "", tpl: "", busy: false, t0: 0, ms: 0, nth: 0 };
      _feFigC = new WeakMap();
    }
    function calcPrintDocRef(p) {
      P = p;
      return calcPrintDoc();
    }
    function baseNameRef(name) {
      P = { name: name };
      return baseName();
    }
    function feStripTablesRef(R, k) {
      _feV.k = k;
      return feStripTables(R);
    }
    function feElemInfoRef(R, e, vals, v) {
      _feV.q = v.q;
      _feV.k = v.k;
      return feElemInfo(R, e, vals);
    }
    globalThis.__REF_REPORT__ = {
      DIAS, KE_TAB, D_TAB, CFE,
      presetCanti, presetRib, presetKe, presetWall4, mergeProject,
      baseName: baseNameRef,
      calcDefaults, calcEnsure, calcFamilyFix, setAnc,
      buildBars, quantities, calcRun, calcFeEnsure, calcGsRunNow, calcFemRun,
      calcChecks, calcBadgeCount: calcBadgeCountRef,
      setDec: setDecRef,
      resetReportFigs: resetReportFigsRef,
      resetCaches: resetCachesRef,
      texToHtml, omPieces, omLines, omParse, dxStyles, dxSettings, dxFooter,
      calcSheetHTML, calcGsView, calcRbView, calcPrintDoc: calcPrintDocRef, calcDocxBlob,
      cfSection, cfWeights, cfPressure, cfBase, cfLoads, cfRbScheme, cfRC,
      cfAnchor, cfRibPlan, cfRibElev, cfRibChart,
      cfFeContour, cfFeReact, cfFeSecPos, cfFeRibDiag,
      feMVNTable, feStripTables: feStripTablesRef, feElemInfo: feElemInfoRef,
      autoScale, buildAllSheets: buildAllSheetsRef, toSVG, toDXF, model3D,
    };
    `,
    'export_ref_report.js',
  );

  return ctxObj.__REF_REPORT__ as RefReportOracle;
}

/**
 * Normalizes sequentially auto-incremented SVG def/clip/gradient IDs (`cf1`, `gc1`, ...)
 * in order of first appearance so identical figures compare byte-equal regardless of
 * prior calls in a test session while still verifying matching internal `id`/`url(#...)` wiring.
 */
function canonicalizeSvgIds(html: string): string {
  const seen = new Map<string, string>();
  let cfIdx = 0;
  let gcIdx = 0;
  return html.replace(/(?<=["'#])(cf|gc)(\d+)(?=[A-Za-z]*(?:["'#)]|\b))/g, (_m, pfx: string, num: string) => {
    const raw = pfx + num;
    let rep = seen.get(raw);
    if (!rep) {
      rep = pfx === 'cf' ? `cf_IDX_${++cfIdx}` : `gc_IDX_${++gcIdx}`;
      seen.set(raw, rep);
    }
    return rep;
  });
}

function expectStringParity(actual: string, expected: string, label: string): void {
  if (actual === expected) return;
  let i = 0;
  const minLen = Math.min(actual.length, expected.length);
  while (i < minLen && actual.charCodeAt(i) === expected.charCodeAt(i)) i++;
  const actCtx = actual.slice(Math.max(0, i - 80), i + 160);
  const expCtx = expected.slice(Math.max(0, i - 80), i + 160);
  throw new Error(
    `[${label}] String mismatch at char ${i} (actual len=${actual.length}, expected len=${expected.length}):\n` +
      `  EXP: ${JSON.stringify(expCtx)}\n` +
      `  ACT: ${JSON.stringify(actCtx)}`,
  );
}

type ValidCalc = CantiCalcResult | RibCalcResult;
type ReportArg = Parameters<typeof cfSection>[0];

function assertValidCalc(r: unknown): asserts r is ValidCalc {
  if (!r || typeof r !== 'object' || ('error' in r && (r as { error?: unknown }).error) || ('unsupported' in r && (r as { unsupported?: unknown }).unsupported)) {
    throw new Error(`Expected valid calcRun result, got ${JSON.stringify(r)}`);
  }
}

function readBlobAsUint8Array(blob: Blob): Promise<Uint8Array> {
  return new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error || new Error('FileReader error'));
    reader.readAsArrayBuffer(blob);
  });
}

function unzipAndVerifyCrc(buf: Uint8Array): Map<string, Uint8Array> {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65558); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  expect(eocd).toBeGreaterThanOrEqual(0);
  const entryCount = dv.getUint16(eocd + 10, true);
  const cdOffset = dv.getUint32(eocd + 16, true);
  const files = new Map<string, Uint8Array>();
  let p = cdOffset;
  const td = new TextDecoder('utf-8');

  for (let i = 0; i < entryCount; i++) {
    expect(dv.getUint32(p, true)).toBe(0x02014b50);
    const method = dv.getUint16(p + 10, true);
    const crc = dv.getUint32(p + 16, true);
    const compSize = dv.getUint32(p + 20, true);
    const uncompSize = dv.getUint32(p + 24, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const cmtLen = dv.getUint16(p + 32, true);
    const localOff = dv.getUint32(p + 42, true);
    const name = td.decode(buf.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + cmtLen;

    expect(dv.getUint32(localOff, true)).toBe(0x04034b50);
    const lNameLen = dv.getUint16(localOff + 26, true);
    const lExtraLen = dv.getUint16(localOff + 28, true);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const compSlice = buf.subarray(dataStart, dataStart + compSize);
    const raw =
      method === 0
        ? new Uint8Array(compSlice)
        : new Uint8Array(zlib.inflateRawSync(compSlice));

    expect(raw.length, `Length mismatch on ${name}`).toBe(uncompSize);
    expect(zCrc32(raw), `CRC32 mismatch on ${name}`).toBe(crc);
    files.set(name, raw);
  }
  return files;
}

interface MockCanvas2DRecorder {
  fillTextCalls: Array<{ text: string; x: number; y: number; font: string; fillStyle: string }>;
  fillRectCalls: Array<{ x: number; y: number; w: number; h: number; fillStyle: string }>;
  restore: () => void;
}

function installMockCanvas2D(): MockCanvas2DRecorder {
  const fillTextCalls: MockCanvas2DRecorder['fillTextCalls'] = [];
  const fillRectCalls: MockCanvas2DRecorder['fillRectCalls'] = [];
  const lastPixelHashByCanvas = new WeakMap<HTMLCanvasElement, number>();
  const origImage = globalThis.Image;

  class MockImage {
    width = 760;
    height = 400;
    onload: (() => void) | null = null;
    onerror: ((err?: unknown) => void) | null = null;
    private _src = '';
    get src(): string {
      return this._src;
    }
    set src(val: string) {
      this._src = val;
      queueMicrotask(() => {
        this.onload?.();
      });
    }
  }
  (globalThis as unknown as { Image: typeof MockImage }).Image = MockImage;

  const getContextSpy = vi
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockImplementation(function (this: HTMLCanvasElement, type: string) {
      if (type !== '2d') return null;
      const canvas = this;
      const ctx = {
        canvas,
        font: '16px serif',
        fillStyle: '#000',
        strokeStyle: '#000',
        lineWidth: 1,
        textAlign: 'left',
        createImageData: (w: number, h: number) => ({
          width: w,
          height: h,
          data: new Uint8ClampedArray(w * h * 4),
        }),
        putImageData: (im: { data: Uint8ClampedArray }) => {
          lastPixelHashByCanvas.set(canvas, zCrc32(new Uint8Array(im.data.buffer)));
        },
        fillRect: (x: number, y: number, w: number, h: number) => {
          fillRectCalls.push({ x, y, w, h, fillStyle: String(ctx.fillStyle) });
        },
        strokeRect: () => {},
        clearRect: () => {},
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        closePath: () => {},
        stroke: () => {},
        fill: () => {},
        drawImage: () => {},
        measureText: (txt: string) => ({ width: String(txt).length * 7.2 }),
        fillText: (txt: string, x: number, y: number) => {
          fillTextCalls.push({
            text: String(txt),
            x,
            y,
            font: String(ctx.font),
            fillStyle: String(ctx.fillStyle),
          });
        },
      };
      return ctx as unknown as CanvasRenderingContext2D;
    });

  const toDataUrlSpy = vi
    .spyOn(HTMLCanvasElement.prototype, 'toDataURL')
    .mockImplementation(function (this: HTMLCanvasElement, mime?: string) {
      const h = (lastPixelHashByCanvas.get(this) ?? 0).toString(16).padStart(8, '0');
      const m = mime === 'image/png' ? 'image/png' : 'image/jpeg';
      return `data:${m};base64,MOCK_${this.width}x${this.height}_${h}`;
    });

  const toBlobSpy = vi
    .spyOn(HTMLCanvasElement.prototype, 'toBlob')
    .mockImplementation(function (this: HTMLCanvasElement, cb: BlobCallback, mime?: string) {
      const isJpg = mime === 'image/jpeg';
      const bytes = isJpg ? makeJpgWithDimMarker(this.width || 1, this.height || 1) : PNG_1X1;
      const b = new Blob([new Uint8Array(bytes)], { type: isJpg ? 'image/jpeg' : 'image/png' });
      if (typeof b.arrayBuffer !== 'function') {
        Object.defineProperty(b, 'arrayBuffer', {
          value: async () => bytes.slice().buffer,
        });
      }
      queueMicrotask(() => cb(b));
    });

  return {
    fillTextCalls,
    fillRectCalls,
    restore: () => {
      getContextSpy.mockRestore();
      toDataUrlSpy.mockRestore();
      toBlobSpy.mockRestore();
      (globalThis as unknown as { Image: typeof origImage }).Image = origImage;
    },
  };
}

async function runFemSyncPair(
  pTs: EngineProject,
  pRef: EngineProject,
  refOracle: RefReportOracle,
): Promise<void> {
  await new Promise<void>((resolve) => {
    if (!calcFemRun(pTs, () => resolve())) resolve();
  });
  await new Promise<void>((resolve) => {
    if (!refOracle.calcFemRun(pRef, () => resolve())) resolve();
  });
}

let ref: RefReportOracle;

beforeAll(() => {
  ref = loadReportOracle();
});

beforeEach(() => {
  resetEngineCaches();
  ref.resetCaches();
  setEngineCalcDec('.');
  setReportDec('.');
  resetReportFigCounter(0);
  ref.setDec('.');
  ref.resetReportFigs(0);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  if (typeof URL.createObjectURL !== 'function') {
    URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  }
  if (typeof URL.revokeObjectURL !== 'function') {
    URL.revokeObjectURL = vi.fn();
  }
});

afterEach(() => {
  setEngineCalcDec('.');
  setReportDec('.');
  vi.restoreAllMocks();
});

describe('1. Micro Parity: TeX-to-HTML, OMML Equations & OOXML Parts vs Original Modules', () => {
  const TEX_CASES = [
    String.raw`\phi = 30^{\circ},\; f'_{c} = 24{,}9\text{ MPa}`,
    String.raw`a = \dfrac{A_{s} f_{y}}{0{,}85 f'_{c} b} = \frac{15{,}70 \cdot 400}{0{,}85 \cdot 24{,}9 \cdot 1000}`,
    String.raw`K_{ae} = \frac{\cos^{2}(\phi - \theta - \beta)}{\cos\theta\cos^{2}\beta\cos(\delta + \beta + \theta)\left[1 + \sqrt{\frac{\sin(\phi + \delta)\sin(\phi - i - \theta)}{\cos(\delta + \beta + \theta)\cos(i - \beta)}}\right]^{2}}`,
    String.raw`\overline{M}_{u}^{TT} = \bar{x} \cdot \left| V_{u} - \mathbf{R}_{n} \right| \pm 0{,}5\ln(1 + \tan\alpha) \quad \gamma_{p} M_{n} \ge 1{,}2 M_{cr}`,
    String.raw`d_{v} = \max\left(d_{e} - \frac{a}{2},\; 0{,}9 d_{e},\; 0{,}72 h\right),\quad \arctan(\sin\phi + \cot\psi)`,
  ];

  it('produces character-for-character identical HTML, OMML math & OOXML metadata across TS and VM', () => {
    expect(DIAS).toEqual(ref.DIAS);
    expect(KE_TAB.length).toBe(ref.KE_TAB.length);
    expect(D_TAB.length).toBe(ref.D_TAB.length);

    for (const tex of TEX_CASES) {
      expect(texToHtml(tex)).toBe(ref.texToHtml(tex));
      expect(omPieces(tex)).toEqual(ref.omPieces(tex));
      expect(omLines(tex)).toEqual(ref.omLines(tex));
      for (const line of omLines(tex)) {
        const xmlTs = omParse(line);
        const xmlRef = ref.omParse(line);
        expect(xmlTs).toBe(xmlRef);
      }
    }

    expect(omParse(TEX_CASES[2])).toContain('<m:f>');
    expect(omParse(TEX_CASES[2])).toContain('<m:rad>');
    expect(omParse(TEX_CASES[2])).toContain('<m:d>');
    expect(omParse(TEX_CASES[3])).toContain('<m:bar>');
    expect(omParse(TEX_CASES[3])).toContain('<m:sSubSup>');

    expect(dxStyles()).toBe(ref.dxStyles());
    expect(dxSettings()).toBe(ref.dxSettings());
    expect(dxFooter()).toBe(ref.dxFooter());

    const wrapped = sF(TEX_CASES[1]);
    expect(wrapped).toContain('data-tex=');
    expect(wrapped).toContain('class="fx"');
  });
});

describe('2. Easy Case: Mẫu 1 (presetCanti 500) Project I/O, CAD, 3D & Standard Report Parity', () => {
  it('round-trips .tcl.json across all 4 templates with all 96 calc keys & legacy migrations', () => {
    const presets = [
      presetCanti(500),
      presetRib(),
      presetKe({}, 0),
      presetWall4({}, 1),
    ];
    const defKeys = Object.keys(calcDefaults());
    expect(defKeys.length).toBe(96);
    expect(Object.keys(ref.calcDefaults()).length).toBe(96);

    for (const p of presets) {
      calcEnsure(p);
      const json = serializeProject(p);
      const parsed = JSON.parse(json) as { app: string; v: number };
      expect(parsed.app).toBe('tuong-chan-L');
      expect(parsed.v).toBe(1);

      const restored = parseProjectFile(json);
      expect(restored.tpl).toBe(p.tpl);
      expect(restored.H).toBe(p.H);
      expect(restored.type).toBe(p.type);
      for (const k of defKeys) {
        expect((restored.calc as unknown as Record<string, unknown>)[k]).toBeDefined();
      }
    }

    const legacy = {
      tpl: 'B',
      H: 500,
      calc: {
        kb: 0.75,
        kf: 0.55,
        soil: 'a',
        anc: true,
        ad: 28,
        as: 1.1,
        aLr: 0.8,
        aLc: 0.8,
      },
    };
    const pTs = mergeProject(JSON.parse(JSON.stringify(legacy)) as Record<string, unknown>);
    const pRef = ref.mergeProject(JSON.parse(JSON.stringify(legacy)));
    expect(pTs.calc?.kb).toBe(pRef.calc?.kb);
    expect(pTs.anc?.on).toBe(true);
    expect(pTs.anc?.L).toBe(160);
    expect(pTs.rb?.an?.d).toBe(28);
    expect(pTs.rb?.an?.a).toBe(110);

    expect(baseName('Tường chắn H=5m Đắk Lắk')).toBe(ref.baseName('Tường chắn H=5m Đắk Lắk'));
    expect(baseName('')).toBe(ref.baseName(''));
    expect(baseName('')).toBe('tuong_chan');
  });

  it('matches Mẫu 1 H=500 calcSheetHTML, CFig SVGs, calcGsView, calcRbView, calcPrintDoc & fixes Vu NaN', () => {
    const pTs = presetCanti(500);
    const pRef = ref.presetCanti(500);
    for (const p of [pTs, pRef]) {
      const c = p === pTs ? calcEnsure(p) : ref.calcEnsure(p);
      c.pjName = 'Cầu Đắk Bla';
      c.pjDate = '2026-11-10';
    }
    const rTs = calcRun(pTs);
    const rRef = ref.calcRun(pRef);
    assertValidCalc(rTs);
    expect(calcGsRunNow(pTs)).toBe(true);
    expect(ref.calcGsRunNow(pRef)).toBe(true);

    // Individual CFig diagrams match ref oracle identically
    const rTsRep = rTs as unknown as ReportArg;
    expectStringParity(canonicalizeSvgIds(cfSection(rTsRep)), canonicalizeSvgIds(ref.cfSection(rRef)), 'M1.cfSection');
    expectStringParity(canonicalizeSvgIds(cfWeights(rTsRep)), canonicalizeSvgIds(ref.cfWeights(rRef)), 'M1.cfWeights');
    expectStringParity(
      canonicalizeSvgIds(cfPressure(rTsRep as never)),
      canonicalizeSvgIds(ref.cfPressure(rRef)),
      'M1.cfPressure',
    );
    expectStringParity(canonicalizeSvgIds(cfBase(rTsRep)), canonicalizeSvgIds(ref.cfBase(rRef)), 'M1.cfBase');
    expectStringParity(canonicalizeSvgIds(cfLoads(rTsRep)), canonicalizeSvgIds(ref.cfLoads(rRef)), 'M1.cfLoads');
    const bTs = buildBars(pTs);
    const bRef = ref.buildBars(pRef);
    expectStringParity(
      canonicalizeSvgIds(cfRbScheme(pTs as never, rTsRep, bTs as never)),
      canonicalizeSvgIds(ref.cfRbScheme(pRef, rRef, bRef)),
      'M1.cfRbScheme',
    );
    expectStringParity(canonicalizeSvgIds(cfRC(rTsRep)), canonicalizeSvgIds(ref.cfRC(rRef)), 'M1.cfRC');

    // Main report HTML + GS subtab + Rebar subtab + PrintDoc parity
    const sheetTs = calcSheetHTML(pTs, rTs);
    const sheetRef = ref.calcSheetHTML(pRef, rRef);
    expectStringParity(canonicalizeSvgIds(sheetTs), canonicalizeSvgIds(sheetRef), 'M1.calcSheetHTML');

    // Regression: Vu shear row in sRC() must NEVER render "NaN"
    expect(sheetTs).not.toContain('NaN');
    expect(sheetTs).toContain('Lực cắt tính toán');
    expect(sheetTs).toContain('10/11/2026');

    expectStringParity(canonicalizeSvgIds(calcGsView(pTs, rTs)), canonicalizeSvgIds(ref.calcGsView(pRef, rRef)), 'M1.calcGsView');
    expectStringParity(canonicalizeSvgIds(calcRbView(pTs, rTs)), canonicalizeSvgIds(ref.calcRbView(pRef, rRef)), 'M1.calcRbView');
    expectStringParity(canonicalizeSvgIds(calcPrintDoc(pTs, rTs)), canonicalizeSvgIds(ref.calcPrintDoc(pRef)), 'M1.calcPrintDoc');

    // CAD, 3D & CSV baseline
    const res = buildBars(pTs);
    const q = quantities(pTs, res);
    const sh = buildSheet(pTs, res, q, 0, autoScale(pTs, res, q));
    expect(SHEET_DEFS).toHaveLength(5);
    expect(toSVG(sh, { theme: 'dark' })).not.toBe(toSVG(sh, { theme: 'light' }));
    expect(toDXF([sh])).toContain('AC1009');
    expect(buildCsvContent(res, q)).toContain(q.totKg.toFixed(2));
    expect(calcBadgeStatus(rTs, pTs).count).toBe(ref.calcBadgeCount(rRef));
  });
});

describe('3. Medium Cases: Mẫu 2 Ribbed, Mẫu 3 Kè & Mẫu 4 Rock-Anchored Reports & CAD/3D Parity', () => {
  it('matches Mẫu 2 (presetRib) cfRibPlan, cfRibElev, cfRibChart, calcRbView, calcSheetHTML & 3D tubes', () => {
    const pTs = presetRib();
    const pRef = ref.presetRib();
    const rTs = calcRun(pTs);
    const rRef = ref.calcRun(pRef);
    assertValidCalc(rTs);
    expect(rTs.model).toBe('rib');
    expect(calcGsRunNow(pTs)).toBe(true);
    expect(ref.calcGsRunNow(pRef)).toBe(true);

    expectStringParity(canonicalizeSvgIds(cfRibPlan(rTs as never)), canonicalizeSvgIds(ref.cfRibPlan(rRef)), 'M2.cfRibPlan');
    expectStringParity(canonicalizeSvgIds(cfRibElev(rTs as never)), canonicalizeSvgIds(ref.cfRibElev(rRef)), 'M2.cfRibElev');
    expectStringParity(canonicalizeSvgIds(cfRibChart(rTs as never)), canonicalizeSvgIds(ref.cfRibChart(rRef)), 'M2.cfRibChart');

    const htmlTs = calcSheetHTML(pTs, rTs);
    const htmlRef = ref.calcSheetHTML(pRef, rRef);
    expectStringParity(canonicalizeSvgIds(htmlTs), canonicalizeSvgIds(htmlRef), 'M2.calcSheetHTML');
    expect(htmlTs).not.toContain('NaN');

    expectStringParity(canonicalizeSvgIds(calcRbView(pTs, rTs)), canonicalizeSvgIds(ref.calcRbView(pRef, rRef)), 'M2.calcRbView');
    expectStringParity(canonicalizeSvgIds(calcGsView(pTs, rTs)), canonicalizeSvgIds(ref.calcGsView(pRef, rRef)), 'M2.calcGsView');

    const bars = buildBars(pTs);
    const concrete = m3Concrete(pTs, bars);
    const groups = m3Bars(pTs, bars);
    const m3 = model3D(pTs, bars);
    expect(concrete.conc.p.length).toBeGreaterThan(0);
    expect(groups.length).toBeGreaterThan(3);
    expect(m3.groups.length).toBe(groups.length);
    expect(v3FormatTip(m3.groups[0]).title).toContain('Mác');
  });

  it('matches Mẫu 3 (KE[0]) & Mẫu 4 (D80, D45) full report HTML, cfAnchor & 5-sheet CAD SVG/DXF', () => {
    for (const [label, makeTs, makeRef] of [
      ['C_KE0', () => presetKe({}, 0), () => ref.presetKe({}, 0)],
      ['D80', () => presetWall4({}, 0), () => ref.presetWall4({}, 0)],
      ['D45', () => presetWall4({}, 5), () => ref.presetWall4({}, 5)],
    ] as const) {
      const pTs = makeTs();
      const pRef = makeRef();
      const rTs = calcRun(pTs);
      const rRef = ref.calcRun(pRef);
      assertValidCalc(rTs);

      const sheetTs = calcSheetHTML(pTs, rTs);
      const sheetRef = ref.calcSheetHTML(pRef, rRef);
      expectStringParity(canonicalizeSvgIds(sheetTs), canonicalizeSvgIds(sheetRef), `${label}.calcSheetHTML`);
      expect(sheetTs, `${label}.noNaN`).not.toContain('NaN');
      expectStringParity(
        canonicalizeSvgIds(calcRbView(pTs, rTs)),
        canonicalizeSvgIds(ref.calcRbView(pRef, rRef)),
        `${label}.calcRbView`,
      );

      if ('an' in rTs && rTs.an) {
        expectStringParity(
          canonicalizeSvgIds(cfAnchor(rTs as unknown as ReportArg)),
          canonicalizeSvgIds(ref.cfAnchor(rRef)),
          `${label}.cfAnchor`,
        );
      }

      const bTs = buildBars(pTs);
      const bRef = ref.buildBars(pRef);
      const sTs = buildAllSheets(pTs, bTs, quantities(pTs, bTs));
      const sRef = ref.buildAllSheets(pRef, bRef, ref.quantities(pRef, bRef));
      expect(toDXF(sTs)).toBe(ref.toDXF(sRef));
    }
  });
});

describe('4. Hard Cases: Coupled Multi-Hazard (Water fd + Seismic + Bishop + FE3D + FEM2D SRM)', () => {
  function setupHardH1(p: EngineProject, ensureFn: (proj: EngineProject) => Record<string, unknown>) {
    p.fillMode = '1.5';
    p.fillH = 150;
    const c = ensureFn(p);
    c.pjName = 'H1 Multi-Hazard Retaining Wall';
    c.pjItem = 'Mố kè Bờ Tả';
    c.pjBy = 'Kỹ sư A';
    c.soil = 'd';
    c.brm = 'spt';
    c.Nspt = 16;
    c.LL = true;
    c.dT = 1.2;
    c.wOn = true;
    c.wMode = 'fd';
    c.hB = 4.8;
    c.hF = 0.4;
    c.Tn = 2.5;
    c.FSp = 2.2;
    c.eqOn = true;
    c.eqA = 0.14;
    c.eqKm = 'full';
    c.eqKv = 0.05;
    c.bsOn = true;
    c.feOn = true;
    c.feBasis = 'fe';
    c.femOn = true;
    c.femMesh = 'c';
    c.femLifts = 3;
    c.femSrm = true;
  }

  it('H1 Cantilever: matches calcSheetHTML, Extended/FE3D/FEM2D/GS charts, feStripTables & calcChecks', async () => {
    const pTs = presetCanti(600);
    const pRef = ref.presetCanti(600);
    setupHardH1(pTs, calcEnsure as unknown as (p: EngineProject) => Record<string, unknown>);
    setupHardH1(pRef, ref.calcEnsure);

    expect(calcFeEnsure(pTs)).toBe(true);
    expect(ref.calcFeEnsure(pRef)).toBe(true);
    expect(calcGsRunNow(pTs)).toBe(true);
    expect(ref.calcGsRunNow(pRef)).toBe(true);
    await runFemSyncPair(pTs, pRef, ref);

    const rTs = calcRun(pTs);
    const rRef = ref.calcRun(pRef);
    assertValidCalc(rTs);
    expect(calcChecks(rTs)).toEqual(ref.calcChecks(rRef));

    const htmlTs = calcSheetHTML(pTs, rTs);
    const htmlRef = ref.calcSheetHTML(pRef, rRef);
    expectStringParity(canonicalizeSvgIds(htmlTs), canonicalizeSvgIds(htmlRef), 'H1.calcSheetHTML');
    expect(htmlTs).not.toContain('NaN');
    expect(htmlTs).toContain('Áp lực nước và đẩy ngược (WA)');
    expect(htmlTs).toContain('Tải trọng động đất (EQ)');
    expect(htmlTs).toContain('Tổ hợp Đặc biệt I');
    expect(htmlTs).toContain('PHẦN TỬ HỮU HẠN 2D');
    expect(htmlTs).toContain('ỔN ĐỊNH TỔNG THỂ');

    expectStringParity(canonicalizeSvgIds(calcGsView(pTs, rTs)), canonicalizeSvgIds(ref.calcGsView(pRef, rRef)), 'H1.calcGsView');
    expectStringParity(canonicalizeSvgIds(calcRbView(pTs, rTs)), canonicalizeSvgIds(ref.calcRbView(pRef, rRef)), 'H1.calcRbView');
    expect(feStripTables(rTs as never, 'bao')).toBe(ref.feStripTables(rRef, 'bao'));
    expect(feStripTables(rTs as never, 'baoE')).toBe(ref.feStripTables(rRef, 'baoE'));

    const vals = CFE.fieldOf(rTs.fe as never, 'bao', 'M')!;
    const valsRef = ref.CFE.fieldOf((rRef as { fe: unknown }).fe, 'bao', 'M');
    expect(vals).not.toBeNull();
    expect(feElemInfo(rTs as never, 0, vals, { k: 'bao', q: 'M' })).toBe(
      ref.feElemInfo(rRef, 0, valsRef, { k: 'bao', q: 'M' }),
    );
    expectStringParity(canonicalizeSvgIds(calcPrintDoc(pTs, rTs)), canonicalizeSvgIds(ref.calcPrintDoc(pRef)), 'H1.calcPrintDoc');
  }, 120000);

  it('H2 Ribbed Multi-Hazard: matches calcSheetHTML, 4x3 FE 3D contours, cfFeRibDiag & hover across stem/slab/rib', async () => {
    const pTs = presetRib();
    const pRef = ref.presetRib();
    for (const p of [pTs, pRef]) {
      const c = p === pTs ? calcEnsure(p) : ref.calcEnsure(p);
      c.wOn = true;
      c.wMode = 'fd';
      c.hB = 6.0;
      c.hF = 0.5;
      c.eqOn = true;
      c.eqKm = 'tay';
      c.eqKh = 0.14;
      c.bsOn = true;
      c.feOn = true;
      c.feBasis = 'fe';
      c.femOn = true;
      c.femMesh = 'c';
      c.femLifts = 3;
    }

    expect(calcFeEnsure(pTs)).toBe(true);
    expect(ref.calcFeEnsure(pRef)).toBe(true);
    expect(calcGsRunNow(pTs)).toBe(true);
    expect(ref.calcGsRunNow(pRef)).toBe(true);
    await runFemSyncPair(pTs, pRef, ref);

    const rTs = calcRun(pTs);
    const rRef = ref.calcRun(pRef);
    assertValidCalc(rTs);
    const htmlTs = calcSheetHTML(pTs, rTs);
    const htmlRef = ref.calcSheetHTML(pRef, rRef);
    expectStringParity(canonicalizeSvgIds(htmlTs), canonicalizeSvgIds(htmlRef), 'H2.calcSheetHTML');
    expect(htmlTs).not.toContain('NaN');

    expectStringParity(canonicalizeSvgIds(cfFeRibDiag(rTs as never)), canonicalizeSvgIds(ref.cfFeRibDiag(rRef)), 'H2.cfFeRibDiag');
    expectStringParity(canonicalizeSvgIds(cfFeReact(rTs as never, 'baoE')), canonicalizeSvgIds(ref.cfFeReact(rRef, 'baoE')), 'H2.cfFeReact');
    expectStringParity(canonicalizeSvgIds(cfFeSecPos(rTs as never)), canonicalizeSvgIds(ref.cfFeSecPos(rRef)), 'H2.cfFeSecPos');
    expect(feMVNTable(rTs as never)).toBe(ref.feMVNTable(rRef));

    for (const [, az, el] of FE_VIEWS) {
      for (const ribs of ['grey', 'color', 'hide'] as const) {
        expectStringParity(
          canonicalizeSvgIds(cfFeContour(rTs as never, { q: 'M', k: 'bao', az, el, ribs, data: true, W: 780 })),
          canonicalizeSvgIds(ref.cfFeContour(rRef, { q: 'M', k: 'bao', az, el, ribs, data: true, W: 780 })),
          `H2.cfFeContour.${az}.${el}.${ribs}`,
        );
      }
    }

    // Hover element info across first stem, slab, and rib element
    const feTs = (rTs as unknown as { fe: { M: { EL: Array<{ kind: string }> } } }).fe;
    const feRef = (rRef as { fe: unknown }).fe;
    const valsTs = CFE.fieldOf(feTs as never, 'baoE', 'V')!;
    const valsRef = ref.CFE.fieldOf(feRef, 'baoE', 'V');
    expect(valsTs).not.toBeNull();
    for (const kind of ['stem', 'slab', 'rib'] as const) {
      const idx = feTs.M.EL.findIndex((e) => e && e.kind === kind);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(feElemInfo(rTs as never, idx, valsTs, { k: 'baoE', q: 'V' })).toBe(
        ref.feElemInfo(rRef, idx, valsRef, { k: 'baoE', q: 'V' }),
      );
    }

    expectStringParity(canonicalizeSvgIds(calcGsView(pTs, rTs)), canonicalizeSvgIds(ref.calcGsView(pRef, rRef)), 'H2.calcGsView');
    expectStringParity(canonicalizeSvgIds(calcRbView(pTs, rTs)), canonicalizeSvgIds(ref.calcRbView(pRef, rRef)), 'H2.calcRbView');
  }, 45000);
});

describe('5. Special Cases: Comma/Dot Decimal Mode, Rock Anchors (fr/dw), Raster DOCX ZIP & Multi-Page Canvas PDF', () => {
  it('propagates calc.dec="," consistently across reports, GS charts, FE contours & hover telemetry', async () => {
    const pTs = presetCanti(500);
    const pRef = ref.presetCanti(500);
    for (const p of [pTs, pRef]) {
      const c = p === pTs ? calcEnsure(p) : ref.calcEnsure(p);
      c.wOn = true;
      c.eqOn = true;
      c.bsOn = true;
      c.feOn = true;
      c.dec = ',';
    }
    expect(calcFeEnsure(pTs)).toBe(true);
    expect(ref.calcFeEnsure(pRef)).toBe(true);
    expect(calcGsRunNow(pTs)).toBe(true);
    expect(ref.calcGsRunNow(pRef)).toBe(true);

    setEngineCalcDec(',');
    setReportDec(',');
    ref.setDec(',');

    const rTs = calcRun(pTs);
    const rRef = ref.calcRun(pRef);
    assertValidCalc(rTs);

    const htmlCommaTs = calcSheetHTML(pTs, rTs);
    const htmlCommaRef = ref.calcSheetHTML(pRef, rRef);
    expectStringParity(canonicalizeSvgIds(htmlCommaTs), canonicalizeSvgIds(htmlCommaRef), 'comma.calcSheetHTML');
    expect(htmlCommaTs).toMatch(/\d+,\d+/);

    const feSvgCommaTs = cfFeContour(rTs as never, { q: 'M', k: 'bao', W: 780, data: true });
    const feSvgCommaRef = ref.cfFeContour(rRef, { q: 'M', k: 'bao', W: 780, data: true });
    expectStringParity(
      canonicalizeSvgIds(feSvgCommaTs),
      canonicalizeSvgIds(feSvgCommaRef),
      'comma.cfFeContour',
    );

    expect(feStripTables(rTs as never, 'bao')).toBe(ref.feStripTables(rRef, 'bao'));
    expect(feStripTables(rTs as never, 'bao')).toMatch(/\d+,\d+/);

    const valsTs = CFE.fieldOf(rTs.fe as never, 'bao', 'M')!;
    const valsRef = ref.CFE.fieldOf((rRef as { fe: unknown }).fe, 'bao', 'M');
    expect(valsTs).not.toBeNull();
    expect(feElemInfo(rTs as never, 0, valsTs, { k: 'bao', q: 'M' })).toBe(
      ref.feElemInfo(rRef, 0, valsRef, { k: 'bao', q: 'M' }),
    );
    expect(feElemInfo(rTs as never, 0, valsTs, { k: 'bao', q: 'M' })).toMatch(/\d+,\d+/);

    // Ensure rebar suggest & apply fixes also parity-checked cleanly
    const weak = presetCanti(600);
    calcEnsure(weak);
    weak.rb.s1.d = 12;
    weak.rb.s1.a = 30;
    const fixable = calcSuggest(weak, calcRun(weak)).filter((x) => !x.ok && x.sug);
    expect(fixable.length).toBeGreaterThan(0);
    calcApplyFixes(weak, fixable);
    expect(weak.rb.s1.d > 12 || weak.rb.s1.a < 30).toBe(true);
    const heelHint = calcHeelHint(presetCanti(500));
    expect(heelHint === null || typeof heelHint === 'number').toBe(true);
  });

  it('matches rock-anchor modes fr (tauA=tay + aOT) vs dw (noOT) and template family transitions (calcFamilyFix)', () => {
    for (const [mode, mut] of [
      ['fr_tay_aOT', (c: Record<string, unknown>) => { c.aSl = 'fr'; c.tauA = 'tay'; c.atau = 1.4; c.aOT = true; }],
      ['dw_noOT', (c: Record<string, unknown>) => { c.aSl = 'dw'; c.aTv = 0.6; c.aOT = false; }],
    ] as const) {
      const pTs = presetWall4({}, 0);
      const pRef = ref.presetWall4({}, 0);
      for (const p of [pTs, pRef]) {
        p.anc.on = true;
        const c = p === pTs ? calcEnsure(p) : ref.calcEnsure(p);
        c.soil = 'a';
        c.aSlSet = true;
        mut(c as unknown as Record<string, unknown>);
      }
      const rTs = calcRun(pTs);
      const rRef = ref.calcRun(pRef);
      assertValidCalc(rTs);
      expectStringParity(
        canonicalizeSvgIds(calcSheetHTML(pTs, rTs)),
        canonicalizeSvgIds(ref.calcSheetHTML(pRef, rRef)),
        `${mode}.sheet`,
      );
      expectStringParity(
        canonicalizeSvgIds(cfAnchor(rTs as unknown as ReportArg)),
        canonicalizeSvgIds(ref.cfAnchor(rRef)),
        `${mode}.cfAnchor`,
      );
    }

    // D -> B calcFamilyFix parity preserves default rock vs clay switch properly
    const dTs = presetWall4({}, 1);
    const dRef = ref.presetWall4({}, 1);
    const bFromDTs = presetCanti(500, { calc: dTs.calc });
    const bFromDRef = ref.presetCanti(500, { calc: dRef.calc as unknown as Record<string, unknown> });
    calcFamilyFix(bFromDTs, true);
    ref.calcFamilyFix(bFromDRef, true);
    expect(bFromDTs.calc!.soil).toBe(bFromDRef.calc!.soil);
    expect(bFromDTs.calc!.soil).toBe('r');
  });

  it('exercises gsRaster JPEG contours + OOXML/OMML Word (.docx) ZIP parity against VM on Easy & Hard cases', async () => {
    const rec = installMockCanvas2D();
    try {
      // Easy (Mẫu 1 H=500) + Hard (H1 multi-hazard with FEM2D + gsRaster JPEG)
      const pEasyTs = presetCanti(500);
      const pEasyRef = ref.presetCanti(500);
      calcEnsure(pEasyTs).pjName = 'Đắk Bla Dễ';
      ref.calcEnsure(pEasyRef).pjName = 'Đắk Bla Dễ';

      const pHardTs = presetCanti(550);
      const pHardRef = ref.presetCanti(550);
      for (const p of [pHardTs, pHardRef]) {
        const c = p === pHardTs ? calcEnsure(p) : ref.calcEnsure(p);
        p.fillMode = '1.5';
        p.fillH = 120;
        c.pjName = 'Hồ Thầu Đa Tổ Hợp';
        c.wOn = true;
        c.wMode = 'fd';
        c.hB = 4.2;
        c.hF = 0.3;
        c.eqOn = true;
        c.feOn = true;
        c.feBasis = 'fe';
        c.bsOn = true;
        c.femOn = true;
        c.femMesh = 'c';
        c.femLifts = 2;
        c.femSrm = true;
      }

      expect(calcFeEnsure(pHardTs)).toBe(true);
      expect(ref.calcFeEnsure(pHardRef)).toBe(true);
      expect(calcGsRunNow(pEasyTs)).toBe(true);
      expect(ref.calcGsRunNow(pEasyRef)).toBe(true);
      expect(calcGsRunNow(pHardTs)).toBe(true);
      expect(ref.calcGsRunNow(pHardRef)).toBe(true);
      await runFemSyncPair(pHardTs, pHardRef, ref);

      const rHardTs = calcRun(pHardTs);
      const rHardRef = ref.calcRun(pHardRef);
      assertValidCalc(rHardTs);

      // Verify gsRaster actually executed and produced identical JPEG data URLs in TS & VM
      const gsViewTs = calcGsView(pHardTs, rHardTs);
      const gsViewRef = ref.calcGsView(pHardRef, rHardRef);
      expect(gsViewTs).toContain('data:image/jpeg;base64,MOCK_');
      expectStringParity(canonicalizeSvgIds(gsViewTs), canonicalizeSvgIds(gsViewRef), 'Hard.gsView');

      // Verify full DOCX ZIP parity on both Easy & Hard (including .png + .jpg word/media)
      for (const [label, pT, pR, rT, rR] of [
        ['Easy_M1', pEasyTs, pEasyRef, calcRun(pEasyTs), ref.calcRun(pEasyRef)],
        ['Hard_H1', pHardTs, pHardRef, rHardTs, rHardRef],
      ] as const) {
        const blobTs = await calcDocxBlob(pT, rT);
        const blobRef = await ref.calcDocxBlob(pR, rR);
        const filesTs = unzipAndVerifyCrc(await readBlobAsUint8Array(blobTs));
        const filesRef = unzipAndVerifyCrc(await readBlobAsUint8Array(blobRef));

        expect([...filesTs.keys()], `${label} entry list`).toEqual([...filesRef.keys()]);
        const td = new TextDecoder('utf-8');
        const mediaKeys = [...filesTs.keys()].filter((k) => k.startsWith('word/media/'));
        expect(mediaKeys.some((k) => k.endsWith('.png'))).toBe(true);
        if (label === 'Hard_H1') {
          expect(mediaKeys.some((k) => k.endsWith('.jpg'))).toBe(true);
        }

        const normCore = (xml: string) =>
          xml.replace(/<dcterms:created[^>]*>[^<]*<\/dcterms:created>/, '<dcterms:created>TS</dcterms:created>');

        for (const key of filesTs.keys()) {
          if (key.startsWith('word/media/')) {
            expect(filesTs.get(key)!.length, `${label}:${key} media len`).toBe(
              filesRef.get(key)!.length,
            );
            continue;
          }
          const txtTs = td.decode(filesTs.get(key)!);
          const txtRef = td.decode(filesRef.get(key)!);
          if (key === 'docProps/core.xml') {
            expectStringParity(normCore(txtTs), normCore(txtRef), `${label}:${key}`);
          } else if (key === 'docProps/app.xml') {
            expect(txtTs).toContain('<Application>LEDAT-BIM</Application>');
            expect(txtTs).not.toContain('Thợ Vẽ');
            expectStringParity(
              txtTs,
              txtRef.replace('Tường chắn chữ L - Thợ Vẽ 4.0', 'LEDAT-BIM'),
              `${label}:${key}`,
            );
          } else {
            expectStringParity(txtTs, txtRef, `${label}:${key}`);
          }
        }
      }

      // Verify buildCalcCanvasPages() multi-page A4 PNG PDF path (both Easy & Hard)
      const calcPdfHard = await exportCalcPdfBytes(pHardTs, rHardTs);
      expect(new TextDecoder().decode(calcPdfHard.slice(0, 5))).toBe('%PDF-');
      const calcPdfDoc = await PDFDocument.load(calcPdfHard);
      expect(calcPdfDoc.getPageCount()).toBeGreaterThanOrEqual(4);

      // Verify formula boxes (.cr.f) use fxReadableText with (num)/(den) / _sub^sup, pagination footers present, and sTx is full-width
      const drawnStrings = rec.fillTextCalls.map((c) => c.text);
      expect(drawnStrings.some((t) => /^Trang 1 \/ \d+$/.test(t))).toBe(true);
      expect(drawnStrings.some((t) => /\)\/\(/.test(t))).toBe(true);
      expect(drawnStrings.some((t) => /_[A-Za-z0-9]|\^[A-Za-z0-9]/.test(t))).toBe(true);
      expect(drawnStrings.some((t) => t.includes('NaN'))).toBe(false);
      // Shaded formula box rects (#f6f8fa) were drawn
      expect(rec.fillRectCalls.some((r) => r.fillStyle === '#f6f8fa')).toBe(true);

      // Also verify CAD PNG-embedded PDF path
      const res = buildBars(pHardTs);
      const q = quantities(pHardTs, res);
      const sh = buildSheet(pHardTs, res, q, 0, autoScale(pHardTs, res, q));
      const cadPdf = await exportCadPdfBytes(sh);
      const cadDoc = await PDFDocument.load(cadPdf);
      expect(cadDoc.getPageCount()).toBe(1);
      expect(buildCadPrintHtml(pHardTs, sh, 0)).toContain('<svg');
    } finally {
      rec.restore();
    }
  }, 120000);

  it('keeps zDeflate non-deadlocking (>192 KB) and handles null-canvas DOCX & WinAnsi PDF fallbacks', async () => {
    const large = new Uint8Array(192 * 1024);
    for (let i = 0; i < large.length; i++) large[i] = (i * 17) & 255;
    const deflated = await zDeflate(large);
    expect(deflated.length).toBeGreaterThan(0);
    expect(deflated.length).toBeLessThan(large.length);

    const p = presetCanti(500);
    calcEnsure(p).pjName = 'Fallback Test';
    const R = calcRun(p);
    expect(calcGsRunNow(p)).toBe(true);

    const blob = await calcDocxBlob(p, R);
    const entries = unzipAndVerifyCrc(await readBlobAsUint8Array(blob));
    expect(entries.has('word/document.xml')).toBe(true);

    const pdfBytes = await exportCalcPdfBytes(p, R);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    expect(pdfDoc.getPageCount()).toBeGreaterThanOrEqual(2);
  });
});
