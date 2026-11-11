import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import zlib from 'node:zlib';
import { PDFDocument } from 'pdf-lib';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as TS_ENGINE from '../../src/engine/index.ts';
import type { EngineProject } from '../../src/engine/index.ts';
import * as TS_CAD from '../../src/cad/index.ts';
import * as TS_M3D from '../../src/model3d/index.ts';
import * as TS_REPORTS from '../../src/reports/index.ts';
import * as TS_EXPORT from '../../src/export/index.ts';

interface RefAll {
  DIAS: number[];
  CANTI_DIM: Record<number, number[]>;
  KE_TAB: Array<Record<string, unknown>>;
  D_TAB: Array<Record<string, unknown>>;
  isB: (p: { tpl: string }) => boolean;
  isC: (p: { tpl: string }) => boolean;
  isD: (p: { tpl: string }) => boolean;
  baseProject: () => EngineProject;
  presetCanti: (H: number) => EngineProject;
  presetRib: () => EngineProject;
  presetKe: (keep?: Record<string, unknown>, idx?: number) => EngineProject;
  presetWall4: (keep?: Record<string, unknown>, idx?: number) => EngineProject;
  mergeProject: (s: Record<string, unknown>) => EngineProject;
  calcDefaults: () => Record<string, unknown>;
  calcEnsure: (p: EngineProject) => Record<string, unknown>;
  calcFamilyFix: (p: EngineProject, wasD: boolean) => void;
  geom: (p: EngineProject) => Record<string, unknown>;
  buildBars: (p: EngineProject) => Record<string, unknown>;
  quantities: (p: EngineProject, bars?: unknown) => Record<string, unknown>;
  fmt: (n: number, d?: number) => string;
  fmt2: (n: number) => string;
  unitW: (d: number) => number;
  WATER: {
    seepSolve: (inp: unknown) => Record<string, unknown>;
    build: (I: unknown, g: unknown) => Record<string, unknown>;
    piping: (I: unknown, g: unknown, W: unknown) => Record<string, unknown>;
  };
  SLOPE: { run: (R: unknown, opt?: unknown) => Record<string, unknown> };
  CALC: { calc: (I: unknown, g: unknown) => Record<string, unknown> };
  calcRun: (p: EngineProject) => Record<string, unknown>;
  calcProportion: (p: EngineProject) => Record<string, unknown>;
  calcTipText: (p: EngineProject, f: (n: number, d?: number) => string, lead: string) => string;
  calcFeEnsure: (p: EngineProject) => boolean;
  calcGsRunNow: (p: EngineProject) => boolean;
  calcGsOut: (p: EngineProject) => Record<string, unknown> | null;
  calcSuggest: (p: EngineProject, R: unknown) => unknown[];
  calcApplyFixes: (p: EngineProject, items: unknown[]) => void;
  calcHeelHint: (p: EngineProject) => number | null;
  calcChecks: (R: unknown) => Array<{ id: string; t: string; ok: boolean; v: number; info?: boolean }>;
  calcBadgeCount: (R: unknown) => number;
  calcFemPack: (p: EngineProject, full?: boolean) => Record<string, unknown> | null;
  calcFemRun: (p: EngineProject, done?: () => void) => boolean;
  FEM2D: { job: (m: unknown) => Record<string, unknown> };
  CFE: { solve: (R: unknown, opt?: unknown) => Record<string, unknown> };
  resetCaches: () => void;
  setDec: (d: '.' | ',') => void;
  resetReportFigs: (n?: number) => void;
  calcSheetHTML: (p: EngineProject, R: unknown) => string;
  calcRbView: (p: EngineProject, R: unknown) => string;
  calcGsView: (p: EngineProject, R: unknown) => string;
  calcDocxBlob: (p: EngineProject, R: unknown) => Promise<Blob>;
  // CAD 2D
  LAYERS: Record<string, { n: string; c: string; cl: string; aci: number; lw: number; lt?: string }>;
  DIMSTY: Record<string, unknown>;
  SHEET_DEFS: Array<{ name: string; noScale?: boolean }>;
  resetDimId: (n?: number) => void;
  autoScale: (p: EngineProject, res: unknown, q: unknown) => number;
  buildSheet: (p: EngineProject, res: unknown, q: unknown, idx: number, S?: number) => Record<string, unknown>;
  buildAllSheets: (p: EngineProject, res: unknown, q: unknown, S?: number) => Array<Record<string, unknown>>;
  toSVG: (sh: unknown, o?: Record<string, unknown>) => string;
  toDXF: (sheets: unknown[]) => string;
  exportCsvString: (res: unknown, q: unknown) => string;
  // 3D
  M3Tubes: new (sides?: number, maxV?: number) => {
    add: (pts: number[][], R: number) => unknown;
    chunks: Array<{ v: number[]; i: number[]; nv: number }>;
  };
  m3Concrete: (p: EngineProject, res: unknown) => Record<string, unknown>;
  m3Bars: (p: EngineProject, res: unknown) => Array<Record<string, unknown>>;
  model3D: (p: EngineProject, res: unknown) => Record<string, unknown>;
}

function loadRefAll(): RefAll {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const modulesDir = path.resolve(here, '../../../analysis/modules');
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

  run(readMod('01_project_geom.js'), '01_project_geom.js');
  run(readMod('02_cad_2d.js'), '02_cad_2d.js');
  run(readMod('03_template_b_canti.js'), '03_template_b_canti.js');
  run(readMod('04_template_c_ke.js'), '04_template_c_ke.js');
  run(readMod('05_template_d_anchor_rebar.js'), '05_template_d_anchor_rebar.js');
  run(readMod('06_template_d_cad.js'), '06_template_d_cad.js');
  run(readMod('07_water_seepage.js'), '07_water_seepage.js');
  run(readMod('08_slope_stability.js'), '08_slope_stability.js');
  run(readMod('09_calc_core.js'), '09_calc_core.js');
  run(readMod('10_calc_orchestrator.js'), '10_calc_orchestrator.js');
  run(readMod('11_calc_ribbed.js'), '11_calc_ribbed.js');
  run(readMod('12_fe3d_shell.js'), '12_fe3d_shell.js');
  run(readMod('13_cfe_continuous.js'), '13_cfe_continuous.js');
  run(readMod('14_fem2d_worker.js'), '14_fem2d_worker.js');
  run(readMod('15_tex_html.js'), '15_tex_html.js');
  run(readMod('16_calc_figures.js'), '16_calc_figures.js');
  run(readMod('17_calc_sheet_html.js'), '17_calc_sheet_html.js');
  run(readMod('18_calc_ext_sheet.js'), '18_calc_ext_sheet.js');
  run(readMod('19_calc_fe_sheet.js'), '19_calc_fe_sheet.js');
  run(readMod('20_calc_gs_fem_sheet.js'), '20_calc_gs_fem_sheet.js');
  run(readMod('21_calc_rib_sheet.js'), '21_calc_rib_sheet.js');
  run(readMod('22_docx_exporter.js'), '22_docx_exporter.js');
  run(readMod('23_model_3d.js'), '23_model_3d.js');
  run('var P = presetCanti(500);', '26_state_stub.js');
  run(linesSlice('25_calc_ui_print.js', 4, 83), '25_checks.js');
  run(linesSlice('25_calc_ui_print.js', 1225, 1332), '25_fe_helpers.js');
  run(linesSlice('26_app_ui_export.js', 22, 22), '26_getp.js');
  run(linesSlice('26_app_ui_export.js', 84, 95), '26_ke_ui.js');
  run(linesSlice('26_app_ui_export.js', 1182, 1192), '26_setAnc.js');
  run(linesSlice('26_app_ui_export.js', 1203, 1246), '26_mergeProject.js');

  run(
    `
    function buildAllSheetsRef(p, res, q, S) {
      const sc = S || autoScale(p, res, q);
      DIM_ID = 0;
      return SHEET_DEFS.map((_, i) => buildCluster(p, res, q, i, sc));
    }
    function resetDimIdRef(n = 0) { DIM_ID = n; }
    function exportCsvStringRef(res, q) {
      const rows = [
        ["Mac","Ten","D(mm)","Dai 1 thanh min (mm)","Dai 1 thanh max (mm)","So luong","Tong dai (m)","kg/m","Khoi luong (kg)"]
      ];
      res.bars.forEach((b) =>
        rows.push([b.mark, b.name, b.d, b.minL, b.maxL, b.count, b.totLen.toFixed(2), unitW(b.d).toFixed(3), b.kg.toFixed(2)])
      );
      rows.push(
        [],
        ["Tong", "", "", "", "", "", "", "", q.totKg.toFixed(2)],
        ["Ham luong (kg/m3)", q.ratio.toFixed(1)],
        [],
        ["Be tong (m3)", "Mong/ban day", q.conc.foot.toFixed(2)],
        ["", "Than", q.conc.stem.toFixed(2)],
        ["", "Chan khoa/khay", q.conc.key.toFixed(2)],
        ["", "Suon", q.conc.rib.toFixed(2)],
        ["", "Cong", q.vol.toFixed(2)],
        ["Be tong lot (m3)", "", q.blind.toFixed(2)],
        ["Van khuon (m2)", "Mong/ban day", q.form.foot.toFixed(2)],
        ["", "Than", q.form.stem.toFixed(2)],
        ["", "Suon", q.form.rib.toFixed(2)],
        ["", "Cong", q.form.tot.toFixed(2)],
      );
      return "\\ufeff" + rows.map((r) => r.map((v) => '"' + String(v === undefined ? "" : v).replace(/"/g, '""') + '"').join(",")).join("\\r\\n");
    }
    function calcBadgeCountRef(R) {
      if (!R || R.error || R.unsupported) return 0;
      return calcChecks(R).filter((x) => !x.ok && !x.info).length;
    }
    function setDecRef(d) {
      CALC_DEC = d === "," ? "," : ".";
    }
    function resetReportFigsRef(n = 0) {
      _sFig = n;
      _cfN = 0;
      _gsId = 0;
    }
    function resetCachesRef() {
      _calcCache = { key: "", res: null };
      _feCache = { key: "", fe: null, id: 0 };
      _gsCache = { key: "", res: null, tpl: "" };
      _femCache = { key: "", ekey: "", out: null, err: "", tpl: "", busy: false, t0: 0, ms: 0, nth: 0 };
      _feFigC = new WeakMap();
    }
    globalThis.__REF_ALL__ = {
      DIAS, CANTI_DIM, KE_TAB, D_TAB,
      isB, isC, isD,
      baseProject, presetCanti, presetRib, presetKe, presetWall4, mergeProject,
      calcDefaults, calcEnsure, calcFamilyFix, geom, buildBars, quantities, fmt, fmt2, unitW,
      WATER, SLOPE, CALC,
      calcRun, calcProportion, calcTipText, calcFeEnsure, calcGsRunNow, calcGsOut, calcSuggest, calcApplyFixes, calcHeelHint, calcChecks,
      calcBadgeCount: calcBadgeCountRef,
      calcFemPack, calcFemRun, FEM2D, CFE,
      resetCaches: resetCachesRef,
      setDec: setDecRef,
      resetReportFigs: resetReportFigsRef,
      calcSheetHTML, calcRbView, calcGsView, calcDocxBlob,
      LAYERS, DIMSTY, SHEET_DEFS,
      resetDimId: resetDimIdRef,
      autoScale, buildSheet, buildAllSheets: buildAllSheetsRef,
      toSVG, toDXF,
      exportCsvString: exportCsvStringRef,
      M3Tubes, m3Concrete, m3Bars, model3D,
    };
    `,
    'export_ref_all.js',
  );

  return ctxObj.__REF_ALL__ as RefAll;
}

const IGNORE_KEYS = new Set(['time_ms', 'ms', '_psi']);

function assertParity(
  actual: unknown,
  expected: unknown,
  loc = 'root',
  seen = new WeakMap<object, WeakSet<object>>(),
  tol = 1e-10,
): void {
  if (typeof expected === 'function') {
    expect(typeof actual, `${loc}: expected function`).toBe('function');
    return;
  }
  if (expected === null || expected === undefined || typeof expected !== 'object') {
    if (typeof expected === 'number' && typeof actual === 'number') {
      if (Number.isNaN(expected)) {
        expect(Number.isNaN(actual), `${loc}: expected NaN`).toBe(true);
      } else if (!Number.isFinite(expected)) {
        expect(actual, `${loc}: expected ${expected}`).toBe(expected);
      } else {
        const diff = Math.abs(actual - expected);
        const allow = tol * Math.max(1, Math.abs(expected));
        if (diff > allow) {
          throw new Error(
            `${loc}: numeric mismatch actual=${actual} expected=${expected} (diff=${diff}, allow=${allow})`,
          );
        }
      }
      return;
    }
    if (actual !== expected) {
      throw new Error(`${loc}: primitive mismatch actual=${String(actual)} expected=${String(expected)}`);
    }
    return;
  }

  if (actual === null || actual === undefined || typeof actual !== 'object') {
    throw new Error(`${loc}: expected object, got ${String(actual)}`);
  }

  const expObj = expected as object;
  const actObj = actual as object;
  let seenExp = seen.get(actObj);
  if (seenExp && seenExp.has(expObj)) return;
  if (!seenExp) {
    seenExp = new WeakSet();
    seen.set(actObj, seenExp);
  }
  seenExp.add(expObj);

  if (Array.isArray(expected) || ArrayBuffer.isView(expected)) {
    const expLen = (expected as ArrayLike<unknown>).length;
    const actLen = (actual as ArrayLike<unknown>).length;
    if (actLen !== expLen) {
      throw new Error(`${loc}.length mismatch actual=${actLen} expected=${expLen}`);
    }
    for (let i = 0; i < expLen; i++) {
      assertParity(
        (actual as ArrayLike<unknown>)[i],
        (expected as ArrayLike<unknown>)[i],
        `${loc}[${i}]`,
        seen,
        tol,
      );
    }
    return;
  }

  if (expected instanceof Set || (expected as { constructor?: { name?: string } })?.constructor?.name === 'Set') {
    assertParity(Array.from(actual as Set<unknown>), Array.from(expected as Set<unknown>), `${loc}(Set)`, seen, tol);
    return;
  }

  const aRec = actual as Record<string, unknown>;
  const eRec = expected as Record<string, unknown>;
  const keys = new Set([...Object.keys(aRec), ...Object.keys(eRec)]);
  for (const k of keys) {
    if (IGNORE_KEYS.has(k)) continue;
    const av = aRec[k];
    const ev = eRec[k];
    if (av === undefined && ev === undefined) continue;
    if (av === undefined && !(k in eRec)) continue;
    if (ev === undefined && !(k in aRec)) continue;
    assertParity(av, ev, `${loc}.${k}`, seen, tol);
  }
}

interface ParsedDxf {
  header: Record<string, unknown>;
  layers: Array<{ name: string; aci: number; ltype: string }>;
  blocks: Array<{ name: string; entities: Array<Record<string, unknown>> }>;
  entities: Array<Record<string, unknown>>;
  endedWithEof: boolean;
}

function parseAsciiDxf(raw: string): ParsedDxf {
  const lines = raw.split(/\r?\n/);
  expect(lines.length % 2, 'DXF must have even group-code/value line count').toBe(0);
  const pairs: Array<[number, string]> = [];
  for (let i = 0; i < lines.length; i += 2) {
    const code = Number.parseInt(lines[i].trim(), 10);
    expect(Number.isNaN(code), `Invalid DXF group code at line ${i + 1}: "${lines[i]}"`).toBe(false);
    pairs.push([code, lines[i + 1]]);
  }
  const endedWithEof = pairs.length > 0 && pairs[pairs.length - 1][0] === 0 && pairs[pairs.length - 1][1] === 'EOF';

  const header: Record<string, unknown> = {};
  const layers: Array<{ name: string; aci: number; ltype: string }> = [];
  const blocks: Array<{ name: string; entities: Array<Record<string, unknown>> }> = [];
  const entities: Array<Record<string, unknown>> = [];

  let sec = '';
  let inLayerTable = false;
  let curLayer: { name: string; aci: number; ltype: string } | null = null;
  let curBlock: { name: string; entities: Array<Record<string, unknown>> } | null = null;
  let curEnt: Record<string, unknown> | null = null;
  let curHeaderVar = '';

  const flushEnt = () => {
    if (!curEnt) return;
    if (sec === 'BLOCKS' && curBlock) curBlock.entities.push(curEnt);
    else if (sec === 'ENTITIES') entities.push(curEnt);
    curEnt = null;
  };

  for (let i = 0; i < pairs.length; i++) {
    const [c, v] = pairs[i];
    if (c === 0 && v === 'SECTION') {
      const next = pairs[i + 1];
      if (next && next[0] === 2) {
        sec = next[1];
        i++;
      }
      continue;
    }
    if (c === 0 && v === 'ENDSEC') {
      flushEnt();
      if (curLayer) {
        layers.push(curLayer);
        curLayer = null;
      }
      inLayerTable = false;
      sec = '';
      continue;
    }
    if (sec === 'HEADER') {
      if (c === 9) curHeaderVar = v;
      else if (curHeaderVar) header[curHeaderVar] = v;
    } else if (sec === 'TABLES') {
      if (c === 0 && v === 'TABLE') {
        const next = pairs[i + 1];
        inLayerTable = Boolean(next && next[0] === 2 && next[1] === 'LAYER');
        if (next) i++;
      } else if (c === 0 && v === 'ENDTAB') {
        if (curLayer) {
          layers.push(curLayer);
          curLayer = null;
        }
        inLayerTable = false;
      } else if (inLayerTable) {
        if (c === 0 && v === 'LAYER') {
          if (curLayer) layers.push(curLayer);
          curLayer = { name: '', aci: 0, ltype: '' };
        } else if (curLayer) {
          if (c === 2) curLayer.name = v;
          else if (c === 62) curLayer.aci = Number(v);
          else if (c === 6) curLayer.ltype = v;
        }
      }
    } else if (sec === 'BLOCKS') {
      if (c === 0 && v === 'BLOCK') {
        flushEnt();
        curBlock = { name: '', entities: [] };
      } else if (c === 0 && v === 'ENDBLK') {
        flushEnt();
        if (curBlock) blocks.push(curBlock);
        curBlock = null;
      } else if (curBlock && curBlock.entities.length === 0 && !curEnt && c !== 0) {
        if (c === 2) curBlock.name = v;
      } else if (curBlock) {
        if (c === 0) {
          if (v === 'VERTEX' || v === 'SEQEND') {
            if (curEnt) {
              const list = (curEnt.vertices as Array<Record<string, unknown>>) || [];
              if (v === 'VERTEX') {
                list.push({});
                curEnt.vertices = list;
              }
            }
          } else {
            flushEnt();
            curEnt = { type: v };
          }
        } else if (curEnt) {
          if (Array.isArray(curEnt.vertices) && curEnt.vertices.length > 0 && curEnt.type === 'POLYLINE') {
            const verts = curEnt.vertices as Array<Record<string, unknown>>;
            verts[verts.length - 1][String(c)] = v;
          } else {
            curEnt[String(c)] = v;
          }
        }
      }
    } else if (sec === 'ENTITIES') {
      if (c === 0) {
        if (v === 'VERTEX') {
          if (curEnt) {
            const list = (curEnt.vertices as Array<Record<string, unknown>>) || [];
            list.push({});
            curEnt.vertices = list;
          }
        } else if (v === 'SEQEND') {
          // keep polyline open until next entity
        } else {
          flushEnt();
          curEnt = { type: v };
        }
      } else if (curEnt) {
        if (Array.isArray(curEnt.vertices) && curEnt.vertices.length > 0 && curEnt.type === 'POLYLINE') {
          const verts = curEnt.vertices as Array<Record<string, unknown>>;
          verts[verts.length - 1][String(c)] = v;
        } else {
          curEnt[String(c)] = v;
        }
      }
    }
  }
  return { header, layers, blocks, entities, endedWithEof };
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
  expect(eocd, 'ZIP End of Central Directory not found').toBeGreaterThanOrEqual(0);
  const entryCount = dv.getUint16(eocd + 10, true);
  const cdOffset = dv.getUint32(eocd + 16, true);
  const files = new Map<string, Uint8Array>();
  let p = cdOffset;
  const td = new TextDecoder('utf-8');

  for (let i = 0; i < entryCount; i++) {
    expect(dv.getUint32(p, true), `CD signature at entry ${i}`).toBe(0x02014b50);
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

    expect(dv.getUint32(localOff, true), `Local header sig for ${name}`).toBe(0x04034b50);
    const lNameLen = dv.getUint16(localOff + 26, true);
    const lExtraLen = dv.getUint16(localOff + 28, true);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const compSlice = buf.subarray(dataStart, dataStart + compSize);
    const raw =
      method === 0
        ? new Uint8Array(compSlice)
        : method === 8
          ? new Uint8Array(zlib.inflateRawSync(compSlice))
          : (() => {
              throw new Error(`Unsupported ZIP method ${method} on ${name}`);
            })();

    expect(raw.length, `Uncompressed length for ${name}`).toBe(uncompSize);
    expect(TS_EXPORT.zCrc32(raw), `CRC32 mismatch for ${name}`).toBe(crc);
    files.set(name, raw);
  }
  return files;
}

const PNG_1X1 = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
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

function readBlobAsUint8Array(blob: Blob): Promise<Uint8Array> {
  return new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error || new Error('FileReader error'));
    reader.readAsArrayBuffer(blob);
  });
}

function installMockCanvas2D(): { restore: () => void } {
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
          lastPixelHashByCanvas.set(canvas, TS_EXPORT.zCrc32(new Uint8Array(im.data.buffer)));
        },
        fillRect: () => {},
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
        fillText: () => {},
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
  refOracle: RefAll,
): Promise<void> {
  await new Promise<void>((resolve) => {
    if (!TS_ENGINE.calcFemRun(pTs, () => resolve())) resolve();
  });
  await new Promise<void>((resolve) => {
    if (!refOracle.calcFemRun(pRef, () => resolve())) resolve();
  });
}

let ref: RefAll;

beforeAll(() => {
  ref = loadRefAll();
});

beforeEach(() => {
  TS_ENGINE.resetEngineCaches();
  ref.resetCaches();
  TS_ENGINE.setCalcDec('.');
  TS_REPORTS.setCalcDec('.');
  TS_REPORTS.resetReportFigCounter(0);
  ref.setDec('.');
  ref.resetReportFigs(0);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  if (typeof URL.createObjectURL !== 'function') {
    URL.createObjectURL = vi.fn(() => 'blob:qa-mock');
  }
  if (typeof URL.revokeObjectURL !== 'function') {
    URL.revokeObjectURL = vi.fn();
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('QA 1. Initial Default Mẫu 1 (H=500 cm) KPI & #calcBadge Reference Parity', () => {
  it('matches Huong-dan-cai-dat-va-kich-hoat.pdf screenshot metrics & original TuongChanL exactly', () => {
    const pTs = TS_ENGINE.presetCanti(500);
    const pRef = ref.presetCanti(500);

    const barsTs = TS_ENGINE.buildBars(pTs);
    const barsRef = ref.buildBars(pRef);
    const qTs = TS_ENGINE.quantities(pTs, barsTs);
    const qRef = ref.quantities(pRef, barsRef) as {
      vol: number;
      conc: { tot: number };
      form: { tot: number };
      blind: number;
      totKg: number;
      ratio: number;
    };

    assertParity(qTs, qRef, 'Mẫu1_H500.quantities');
    expect(barsTs.warn).toEqual([]);

    // Exact KPI values visible in Huong-dan-cai-dat-va-kich-hoat.pdf (p.1 & p.6)
    expect(qTs.vol).toBeCloseTo(21.5, 6);
    expect(Number(qTs.form.tot.toFixed(2))).toBe(64.64);
    expect(qTs.blind).toBeCloseTo(1.5, 6);
    expect(Math.round(qTs.totKg)).toBe(2370);
    expect(Number(qTs.ratio.toFixed(1))).toBe(110.2);

    // Exact formatted UI card strings match Huong-dan-cai-dat-va-kich-hoat.pdf (Vietnamese comma decimal) & 01_project_geom.js
    expect(TS_ENGINE.fmt2(qTs.vol)).toBe('21,50');
    expect(TS_ENGINE.fmt2(qTs.conc.tot)).toBe('21,50');
    expect(TS_ENGINE.fmt2(qTs.form.tot)).toBe('64,64');
    expect(TS_ENGINE.fmt2(qTs.blind)).toBe('1,50');
    expect(TS_ENGINE.fmt(qTs.totKg, 0)).toBe('2370');
    expect(TS_ENGINE.fmt(qTs.ratio, 1)).toBe('110,2');

    expect(ref.fmt2(qRef.vol)).toBe('21,50');
    expect(ref.fmt2(qRef.form.tot)).toBe('64,64');
    expect(ref.fmt2(qRef.blind)).toBe('1,50');
    expect(ref.fmt(qRef.totKg, 0)).toBe('2370');
    expect(ref.fmt(qRef.ratio, 1)).toBe('110,2');

    const rTs = TS_ENGINE.calcRun(pTs);
    const rRef = ref.calcRun(pRef);
    assertParity(rTs, rRef, 'Mẫu1_H500.calcRun');
    const badgeTs = TS_ENGINE.calcBadgeStatus(rTs, pTs);
    const badgeRefCount = ref.calcBadgeCount(rRef);
    expect(badgeRefCount).toBe(3);
    expect(badgeTs).toEqual({ count: 3, pending: false, text: '✗ 3', cls: 'bad' });
  });
});

describe('QA 2. Comprehensive Calculation Differential Parity (All 4 Templates & Engineering Toggles)', () => {
  it('matches all Template B heights (400, 500, 800, 1300) plain & ribbed + key toggles', () => {
    for (const H of [400, 500, 800, 1300]) {
      for (const rib of [false, true]) {
        const pTs = TS_ENGINE.presetCanti(H);
        const pRef = ref.presetCanti(H);
        if (rib) {
          pTs.type = 'rib';
          pRef.type = 'rib';
          pTs.key.on = false;
          pRef.key.on = false;
        }
        const rTs = TS_ENGINE.calcRun(pTs);
        const rRef = ref.calcRun(pRef);
        assertParity(rTs, rRef, `B_${H}_${rib ? 'rib' : 'canti'}.calcRun`);
        assertParity(TS_ENGINE.calcChecks(rTs), ref.calcChecks(rRef), `B_${H}_${rib ? 'rib' : 'canti'}.checks`);
      }
    }
  });

  it('matches all KE_TAB Template C presets & edited+anchored variants', () => {
    expect(TS_ENGINE.KE_TAB.length).toBe(ref.KE_TAB.length);
    for (let i = 0; i < TS_ENGINE.KE_TAB.length; i++) {
      const cTs = TS_ENGINE.presetKe({}, i);
      const cRef = ref.presetKe({}, i);
      const bTs = TS_ENGINE.buildBars(cTs);
      const bRef = ref.buildBars(cRef);
      assertParity(TS_ENGINE.quantities(cTs, bTs), ref.quantities(cRef, bRef), `KE_TAB[${i}].qty`);
      if (i % 5 === 0 || i === TS_ENGINE.KE_TAB.length - 1) {
        const rTs = TS_ENGINE.calcRun(cTs);
        const rRef = ref.calcRun(cRef);
        assertParity(rTs, rRef, `KE_TAB[${i}].calcRun`);
      }
    }

    // Edited + anchored Template C
    const ceTs = TS_ENGINE.presetKe({}, 12);
    const ceRef = ref.presetKe({}, 12);
    for (const p of [ceTs, ceRef]) {
      p.heel += 30;
      p.anc.on = true;
      p.anc.L = 160;
      p.rb.c2.a = 12;
      const c = p === ceTs ? TS_ENGINE.calcEnsure(p) : ref.calcEnsure(p);
      c.soil = 'a';
      c.aSl = 'fr';
      c.aSlSet = true;
    }
    assertParity(TS_ENGINE.calcRun(ceTs), ref.calcRun(ceRef), 'C_edited_anchored.calcRun');
  });

  it('matches all 6 D_TAB Template D presets including rib toggle', () => {
    for (let i = 0; i < TS_ENGINE.D_TAB.length; i++) {
      const dTs = TS_ENGINE.presetWall4({}, i);
      const dRef = ref.presetWall4({}, i);
      const bTs = TS_ENGINE.buildBars(dTs);
      const bRef = ref.buildBars(dRef);
      assertParity(TS_ENGINE.quantities(dTs, bTs), ref.quantities(dRef, bRef), `D_TAB[${i}].qty`);
      assertParity(TS_ENGINE.calcRun(dTs), ref.calcRun(dRef), `D_TAB[${i}].calcRun`);
      if (dTs.type === 'rib') {
        const dFlatTs = TS_ENGINE.presetWall4({}, i);
        const dFlatRef = ref.presetWall4({}, i);
        dFlatTs.type = 'canti';
        dFlatRef.type = 'canti';
        assertParity(TS_ENGINE.calcRun(dFlatTs), ref.calcRun(dFlatRef), `D_TAB[${i}]_flat.calcRun`);
      }
    }
  });

  it('matches groundwater piping, seismic (half/full/tay + kv), rock anchors (fr/dw + aOT), slope, FE3D, and FEM2D SRM', () => {
    // 1) Water hs & fd + piping regime (high gradient triggers piping warning/fail)
    for (const wMode of ['hs', 'fd'] as const) {
      const a = TS_ENGINE.presetCanti(600);
      const b = ref.presetCanti(600);
      for (const p of [a, b]) {
        const c = p === a ? TS_ENGINE.calcEnsure(p) : ref.calcEnsure(p);
        c.wOn = true;
        c.wMode = wMode;
        c.hB = 5.5;
        c.hF = 0.0;
        c.Tn = 2.0;
        c.kbx = 1e-4;
        c.kby = 5e-5;
        c.kfx = 2e-4;
        c.kfy = 1e-4;
        c.FSp = 2.5;
        c.bsOn = true;
      }
      const rA = TS_ENGINE.calcRun(a);
      const rB = ref.calcRun(b);
      assertParity(rA, rB, `water_${wMode}_piping.calcRun`);
      expect(TS_ENGINE.calcGsRunNow(a)).toBe(ref.calcGsRunNow(b));
      assertParity(TS_ENGINE.calcGsOut(a), ref.calcGsOut(b), `water_${wMode}.calcGsOut`);
    }

    // 2) Seismic modes half, full, tay with kv > 0
    for (const eqKm of ['half', 'full', 'tay'] as const) {
      const a = TS_ENGINE.presetCanti(500);
      const b = ref.presetCanti(500);
      for (const p of [a, b]) {
        const c = p === a ? TS_ENGINE.calcEnsure(p) : ref.calcEnsure(p);
        c.eqOn = true;
        c.eqA = 0.16;
        c.eqKm = eqKm;
        c.eqKh = 0.11;
        c.eqKv = 0.06;
        c.eqG = 0.5;
      }
      assertParity(TS_ENGINE.calcRun(a), ref.calcRun(b), `seismic_${eqKm}.calcRun`);
    }

    // 3) Rock anchor regimes (fr auto vs tay, dw, aOT true/false)
    for (const [label, mut] of [
      ['fr_auto_aOT', (c: Record<string, unknown>) => { c.aSl = 'fr'; c.tauA = 'auto'; c.aOT = true; }],
      ['fr_tay_noOT', (c: Record<string, unknown>) => { c.aSl = 'fr'; c.tauA = 'tay'; c.atau = 1.2; c.aOT = false; }],
      ['dw_aOT', (c: Record<string, unknown>) => { c.aSl = 'dw'; c.aTv = 0.6; c.aOT = true; }],
    ] as const) {
      const a = TS_ENGINE.presetCanti(500);
      const b = ref.presetCanti(500);
      for (const p of [a, b]) {
        p.anc.on = true;
        p.anc.L = 140;
        const c = p === a ? TS_ENGINE.calcEnsure(p) : ref.calcEnsure(p);
        c.soil = 'a';
        c.aSlSet = true;
        mut(c as Record<string, unknown>);
      }
      assertParity(TS_ENGINE.calcRun(a), ref.calcRun(b), `anchor_${label}.calcRun`);
    }

    // 4) Ribbed weak A: calcSuggestRib + calcApplyFixes + calcHeelHint
    const weakATs = TS_ENGINE.presetRib();
    const weakARef = ref.presetRib();
    for (const p of [weakATs, weakARef]) {
      p.heel = 220;
      p.rb.h1 = { d: 12, a: 25 };
      p.rb.s1 = { d: 12, a: 25 };
      p.rb.l1 = { d: 12, a: 25 };
      p.rb.r1 = { d: 16, n: 2, ng: 1 };
    }
    const rWeakATs = TS_ENGINE.calcRun(weakATs);
    const rWeakARef = ref.calcRun(weakARef);
    const sugATs = TS_ENGINE.calcSuggest(weakATs, rWeakATs);
    const sugARef = ref.calcSuggest(weakARef, rWeakARef);
    assertParity(sugATs, sugARef, 'weak_A.calcSuggest');
    expect(TS_ENGINE.calcHeelHint(weakATs)).toBe(ref.calcHeelHint(weakARef));
    TS_ENGINE.calcApplyFixes(weakATs, sugATs);
    ref.calcApplyFixes(weakARef, sugARef);
    assertParity(weakATs, weakARef, 'weak_A.afterApplyFixes');

    // 5) FEM2D coarse dry & wet SRM
    for (const wet of [false, true]) {
      const fa = TS_ENGINE.presetCanti(450);
      const fb = ref.presetCanti(450);
      for (const p of [fa, fb]) {
        const c = p === fa ? TS_ENGINE.calcEnsure(p) : ref.calcEnsure(p);
        c.femMesh = 'c';
        c.femLifts = 2;
        c.femSrm = true;
        if (wet) {
          c.wOn = true;
          c.wMode = 'fd';
          c.hB = 3.5;
          c.hF = 0.2;
          c.Tn = 2.0;
        }
      }
      const pa = TS_ENGINE.packFemInput(fa, true)!;
      const pb = ref.calcFemPack(fb, true)!;
      assertParity(pa, pb, `FEM2D_${wet ? 'wet' : 'dry'}_srm.pack`);
      assertParity(
        TS_ENGINE.FEM2D.job(pa),
        ref.FEM2D.job(pb),
        `FEM2D_${wet ? 'wet' : 'dry'}_srm.job`,
        new WeakMap(),
        1e-8,
      );
    }

    // 5b) Cohesive backfill (phi = 0, cs = 25) + clay foundation (soil = 'd', Su = 45) (verifies phi === 0 parity)
    {
      const ca = TS_ENGINE.presetCanti(450);
      const cb = ref.presetCanti(450);
      for (const p of [ca, cb]) {
        const c = p === ca ? TS_ENGINE.calcEnsure(p) : ref.calcEnsure(p);
        c.phi = 0;
        c.cs = 25;
        c.soil = 'd';
        c.Su = 45;
        c.femMesh = 'c';
        c.femLifts = 2;
        c.femSrm = true;
      }
      const pa = TS_ENGINE.packFemInput(ca, true)!;
      const pb = ref.calcFemPack(cb, true)!;
      expect(pa.I.phi).toBe(0);
      assertParity(pa, pb, 'FEM2D_cohesive_phi0.pack');
      assertParity(TS_ENGINE.FEM2D.job(pa), ref.FEM2D.job(pb), 'FEM2D_cohesive_phi0.job', new WeakMap(), 1e-8);
    }

    // 6) FE3D / CFE parity ('fe' vs 'hand') across all 4 templates (canti B, rib A, ke C, D)
    for (const [label, makeTs, makeRef] of [
      ['B500', () => TS_ENGINE.presetCanti(500), () => ref.presetCanti(500)],
      ['A820', () => TS_ENGINE.presetRib(), () => ref.presetRib()],
      ['C_KE0', () => TS_ENGINE.presetKe({}, 0), () => ref.presetKe({}, 0)],
      ['D80', () => TS_ENGINE.presetWall4({}, 0), () => ref.presetWall4({}, 0)],
    ] as const) {
      for (const basis of ['fe', 'hand'] as const) {
        const a = makeTs();
        const b = makeRef();
        TS_ENGINE.calcEnsure(a).feOn = true;
        TS_ENGINE.calcEnsure(a).feBasis = basis;
        ref.calcEnsure(b).feOn = true;
        ref.calcEnsure(b).feBasis = basis;
        expect(TS_ENGINE.calcFeEnsure(a)).toBe(ref.calcFeEnsure(b));
        assertParity(TS_ENGINE.calcRun(a), ref.calcRun(b), `FE3D_${label}_${basis}.calcRun`, new WeakMap(), 1e-8);
      }
    }
  }, 45000);

  it('matches Template B passing cantilever ok.all, calcProportion, and calcTipText parity', () => {
    const a = TS_ENGINE.presetCanti(400);
    const b = ref.presetCanti(400);
    a.heel = 220;
    b.heel = 220;
    a.rb.s1 = { d: 22, a: 10, on: true };
    b.rb.s1 = { d: 22, a: 10, on: true };
    a.rb.b2 = { d: 22, a: 10, on: true };
    b.rb.b2 = { d: 22, a: 10, on: true };
    assertParity(TS_ENGINE.calcProportion(a), ref.calcProportion(b), 'prop');
    expect(TS_ENGINE.calcTipText(a, TS_ENGINE.fmt, 'Mẹo')).toBe(ref.calcTipText(b, ref.fmt, 'Mẹo'));
    const rA = TS_ENGINE.calcRun(a);
    const rB = ref.calcRun(b);
    assertParity(rA, rB, 'B400_passing.calcRun');
  });

  it('matches degenerate & invalid wall geometries (S2: tsb < tst, H <= 0, D vtop >= H) cleanly without unhandled throws', () => {
    const edgeCases: Array<{
      label: string;
      makeTs: () => EngineProject;
      makeRef: () => EngineProject;
    }> = [
      {
        label: 'S2_B_tsb_lt_tst',
        makeTs: () => Object.assign(TS_ENGINE.presetCanti(500), { tst: 60, tsb: 30 }),
        makeRef: () => Object.assign(ref.presetCanti(500), { tst: 60, tsb: 30 }),
      },
      {
        label: 'S2_A_tsb_lt_tst',
        makeTs: () => Object.assign(TS_ENGINE.presetRib(), { tst: 70, tsb: 35 }),
        makeRef: () => Object.assign(ref.presetRib(), { tst: 70, tsb: 35 }),
      },
      {
        label: 'S2_B_H0',
        makeTs: () => Object.assign(TS_ENGINE.presetCanti(500), { H: 0 }),
        makeRef: () => Object.assign(ref.presetCanti(500), { H: 0 }),
      },
      {
        label: 'S2_B_Hneg',
        makeTs: () => Object.assign(TS_ENGINE.presetCanti(500), { H: -50 }),
        makeRef: () => Object.assign(ref.presetCanti(500), { H: -50 }),
      },
      {
        label: 'S2_D_H0_vtop_gt_H',
        makeTs: () => Object.assign(TS_ENGINE.presetWall4({}, 0), { H: 0, vtop: 80 }),
        makeRef: () => Object.assign(ref.presetWall4({}, 0), { H: 0, vtop: 80 }),
      },
    ];

    for (const tc of edgeCases) {
      const pTs = tc.makeTs();
      const pRef = tc.makeRef();

      let errTs: unknown = null;
      let errRef: unknown = null;
      let rTs: ReturnType<typeof TS_ENGINE.calcRun> | undefined;
      let rRef: Record<string, unknown> | undefined;

      try {
        rTs = TS_ENGINE.calcRun(pTs);
      } catch (e) {
        errTs = e;
      }
      try {
        rRef = ref.calcRun(pRef);
      } catch (e) {
        errRef = e;
      }

      expect(Boolean(errTs), `${tc.label}: TS calcRun threw unexpectedly: ${String(errTs)}`).toBe(false);
      expect(Boolean(errRef), `${tc.label}: Ref calcRun threw unexpectedly: ${String(errRef)}`).toBe(false);

      const isErrTs = Boolean(rTs && 'error' in rTs && rTs.error);
      const isErrRef = Boolean(rRef && 'error' in rRef && rRef.error);
      expect(isErrTs, `${tc.label}: error flag parity`).toBe(isErrRef);
      if (isErrTs && rTs && 'error' in rTs && rRef) {
        expect(rTs.error).toBe(rRef.error);
      } else {
        assertParity(rTs, rRef, `${tc.label}.calcRun`);
      }

      expect(TS_ENGINE.calcBadgeStatus(rTs, pTs).count, `${tc.label}: badge count`).toBe(
        ref.calcBadgeCount(rRef),
      );
      expect(TS_ENGINE.calcChecks(rTs).length, `${tc.label}: checks len`).toBe(
        ref.calcChecks(rRef).length,
      );

      const htmlTs = canonicalizeSvgIds(TS_REPORTS.calcSheetHTML(pTs, rTs));
      const htmlRef = canonicalizeSvgIds(ref.calcSheetHTML(pRef, rRef));
      expectStringParity(htmlTs, htmlRef, `${tc.label}.calcSheetHTML`);

      const barsTs = TS_ENGINE.buildBars(pTs);
      const barsRef = ref.buildBars(pRef);
      assertParity(TS_ENGINE.quantities(pTs, barsTs), ref.quantities(pRef, barsRef), `${tc.label}.qty`);
    }
  });
});

describe('QA 3. Differential 2D 5-Sheet CAD, SVG, DXF & CSV Parity', () => {
  const cases: Array<{ label: string; makeTs: () => EngineProject; makeRef: () => EngineProject }> = [
    { label: 'B_H500', makeTs: () => TS_ENGINE.presetCanti(500), makeRef: () => ref.presetCanti(500) },
    { label: 'B_H800', makeTs: () => TS_ENGINE.presetCanti(800), makeRef: () => ref.presetCanti(800) },
    {
      label: 'B_H600_anc',
      makeTs: () => {
        const p = TS_ENGINE.presetCanti(600);
        p.anc.on = true;
        p.anc.L = 150;
        TS_ENGINE.calcEnsure(p).soil = 'a';
        return p;
      },
      makeRef: () => {
        const p = ref.presetCanti(600);
        p.anc.on = true;
        p.anc.L = 150;
        ref.calcEnsure(p).soil = 'a';
        return p;
      },
    },
    {
      label: 'B_H1300_extreme',
      makeTs: () =>
        Object.assign(TS_ENGINE.presetCanti(1300), {
          scale: 10,
          fillMode: '1.5' as const,
          fillH: 180,
          dimLeg: 'full' as const,
          blindOn: false,
          formEnds: false,
        }),
      makeRef: () =>
        Object.assign(ref.presetCanti(1300), {
          scale: 10,
          fillMode: '1.5' as const,
          fillH: 180,
          dimLeg: 'full' as const,
          blindOn: false,
          formEnds: false,
        }),
    },
    {
      label: 'A_rib_beam',
      makeTs: () => TS_ENGINE.presetRib(),
      makeRef: () => ref.presetRib(),
    },
    {
      label: 'A_rib_anc',
      makeTs: () => {
        const p = TS_ENGINE.presetRib();
        p.anc.on = true;
        p.anc.L = 160;
        TS_ENGINE.calcEnsure(p).soil = 'a';
        return p;
      },
      makeRef: () => {
        const p = ref.presetRib();
        p.anc.on = true;
        p.anc.L = 160;
        ref.calcEnsure(p).soil = 'a';
        return p;
      },
    },
    {
      label: 'A_rib_nobeam',
      makeTs: () => { const p = TS_ENGINE.presetRib(); p.beam!.on = false; return p; },
      makeRef: () => { const p = ref.presetRib(); p.beam!.on = false; return p; },
    },
    {
      label: 'C_KE0_unmod',
      makeTs: () => TS_ENGINE.presetKe({}, 0),
      makeRef: () => ref.presetKe({}, 0),
    },
    {
      label: 'C_KE5_edited_anc',
      makeTs: () => { const p = TS_ENGINE.presetKe({}, 5); p.heel += 40; p.anc.on = true; return p; },
      makeRef: () => { const p = ref.presetKe({}, 5); p.heel += 40; p.anc.on = true; return p; },
    },
    {
      label: 'D_D80_rib',
      makeTs: () => TS_ENGINE.presetWall4({}, 0),
      makeRef: () => ref.presetWall4({}, 0),
    },
    {
      label: 'D_D60_flat',
      makeTs: () => TS_ENGINE.presetWall4({}, 4),
      makeRef: () => ref.presetWall4({}, 4),
    },
  ];

  for (const tc of cases) {
    it(`matches all 5 CAD sheets, SVG, single/stacked DXF & CSV identically for ${tc.label}`, () => {
      const pTs = tc.makeTs();
      const pRef = tc.makeRef();
      const resTs = TS_ENGINE.buildBars(pTs);
      const resRef = ref.buildBars(pRef);
      const qTs = TS_ENGINE.quantities(pTs, resTs);
      const qRef = ref.quantities(pRef, resRef);

      const sheetsTs = TS_CAD.buildAllSheets(pTs, resTs, qTs);
      const sheetsRef = ref.buildAllSheets(pRef, resRef, qRef);

      expect(sheetsTs).toHaveLength(5);
      expect(sheetsRef).toHaveLength(5);
      if (tc.label === 'B_H1300_extreme') {
        expect(sheetsTs[0].S).toBe(10);
        expect(sheetsTs[0].fits).toBe(false);
        expect(sheetsTs[1].fits).toBe(false);
        expect(sheetsTs[2].fits).toBe(false);
      }

      for (let i = 0; i < 5; i++) {
        const sTs = sheetsTs[i];
        const sRef = sheetsRef[i] as {
          E: { a: unknown[] };
          W: number;
          H: number;
          S: number;
          fits: boolean;
          name: string;
          noScale: boolean;
        };
        expect(sTs.W, `${tc.label}[${i}].W`).toBeCloseTo(sRef.W, 10);
        expect(sTs.H, `${tc.label}[${i}].H`).toBeCloseTo(sRef.H, 10);
        expect(sTs.S, `${tc.label}[${i}].S`).toBe(sRef.S);
        expect(sTs.fits, `${tc.label}[${i}].fits`).toBe(sRef.fits);
        expect(sTs.name, `${tc.label}[${i}].name`).toBe(sRef.name);
        expect(sTs.noScale, `${tc.label}[${i}].noScale`).toBe(sRef.noScale);

        assertParity(sTs.E.a, sRef.E.a, `${tc.label}.sheet[${i}].E.a`, new WeakMap(), 1e-9);

        // SVG parity + XML DOM validity
        for (const theme of ['dark', 'light'] as const) {
          const svgTs = TS_CAD.toSVG(sTs, { theme });
          const svgRef = ref.toSVG(sRef, { theme });
          expect(svgTs, `${tc.label}[${i}] SVG (${theme})`).toBe(svgRef);

          const doc = new DOMParser().parseFromString(svgTs, 'image/svg+xml');
          expect(doc.querySelector('parsererror'), `${tc.label}[${i}] SVG parsererror`).toBeNull();
          expect(doc.documentElement.tagName.toLowerCase()).toBe('svg');
        }

        // Single-sheet DXF parity + group-code parse validation
        const dxfTs = TS_CAD.toDXF([sTs]);
        const dxfRef = ref.toDXF([sRef]);
        expect(dxfTs, `${tc.label}[${i}] single DXF`).toBe(dxfRef);
      }

      // Sheet 5 summary check matches concrete/formwork/steel ratio & per-bar weights
      const s5Text = sheetsTs[4].E.a
        .filter((e) => e.k === 'T')
        .map((e) => (e as { k: 'T'; s: string }).s)
        .join('\n');
      const s5Up = s5Text.toUpperCase();
      expect(s5Text).toContain(TS_ENGINE.fmt2(qTs.vol));
      expect(s5Text).toContain(TS_ENGINE.fmt2(qTs.form.tot));
      expect(s5Text).toContain(TS_ENGINE.fmt(qTs.ratio, 1));
      for (const b of resTs.bars) {
        expect(s5Up).toContain(String(b.mark).toUpperCase());
      }

      // Stacked all-5-sheets DXF parity + independent ASCII AutoCAD R12 parse check
      const allDxfTs = TS_CAD.toDXF(sheetsTs);
      const allDxfRef = ref.toDXF(sheetsRef);
      expect(allDxfTs, `${tc.label} stacked DXF`).toBe(allDxfRef);

      const parsed = parseAsciiDxf(allDxfTs);
      expect(parsed.endedWithEof).toBe(true);
      expect(parsed.header['$ACADVER']).toBe('AC1009');
      expect(Number(parsed.header['$INSUNITS'])).toBe(4);
      expect(parsed.layers).toHaveLength(17);

      const dBlockNames = parsed.blocks.map((b) => b.name).filter((n) => /^\*D\d+$/.test(n));
      expect(dBlockNames.length).toBeGreaterThan(0);
      expect(new Set(dBlockNames).size).toBe(dBlockNames.length); // no duplicate *D block IDs

      const dims = parsed.entities.filter((e) => e.type === 'DIMENSION');
      expect(dims.length).toBe(dBlockNames.length);
      dims.forEach((d) => expect(dBlockNames).toContain(String(d['2'])));

      // Bulge=1 filled circle polylines and \U+XXXX Vietnamese escapes
      const filledCircVerts = parsed.entities.some(
        (e) =>
          e.type === 'POLYLINE' &&
          Array.isArray(e.vertices) &&
          (e.vertices as Array<Record<string, unknown>>).some((v) => v['42'] === '1'),
      );
      expect(filledCircVerts).toBe(true);
      expect(allDxfTs).toMatch(/\\U\+[0-9A-F]{4}/);

      // CSV parity
      const csvTs = TS_EXPORT.buildCsvContent(resTs, qTs);
      const csvRef = ref.exportCsvString(resRef, qRef);
      expect(csvTs, `${tc.label} CSV`).toBe(csvRef);
      expect(csvTs.startsWith('\ufeff')).toBe(true);
      expect(csvTs).toContain(qTs.totKg.toFixed(2));
    });
  }
});

describe('QA 4. Differential 3D Model & Tube Geometry Parity', () => {
  for (const [label, makeTs, makeRef] of [
    ['B_H500', () => TS_ENGINE.presetCanti(500), () => ref.presetCanti(500)],
    [
      'B_H600_anc',
      () => {
        const p = TS_ENGINE.presetCanti(600);
        p.anc.on = true;
        p.anc.L = 150;
        TS_ENGINE.calcEnsure(p).soil = 'a';
        return p;
      },
      () => {
        const p = ref.presetCanti(600);
        p.anc.on = true;
        p.anc.L = 150;
        ref.calcEnsure(p).soil = 'a';
        return p;
      },
    ],
    [
      'B_H1300_extreme',
      () =>
        Object.assign(TS_ENGINE.presetCanti(1300), {
          scale: 10,
          fillMode: '1.5' as const,
          fillH: 180,
          dimLeg: 'full' as const,
          blindOn: false,
          formEnds: false,
        }),
      () =>
        Object.assign(ref.presetCanti(1300), {
          scale: 10,
          fillMode: '1.5' as const,
          fillH: 180,
          dimLeg: 'full' as const,
          blindOn: false,
          formEnds: false,
        }),
    ],
    ['A_rib', () => TS_ENGINE.presetRib(), () => ref.presetRib()],
    [
      'A_rib_anc',
      () => {
        const p = TS_ENGINE.presetRib();
        p.anc.on = true;
        p.anc.L = 160;
        TS_ENGINE.calcEnsure(p).soil = 'a';
        return p;
      },
      () => {
        const p = ref.presetRib();
        p.anc.on = true;
        p.anc.L = 160;
        ref.calcEnsure(p).soil = 'a';
        return p;
      },
    ],
    ['C_KE0', () => TS_ENGINE.presetKe({}, 0), () => ref.presetKe({}, 0)],
    [
      'C_KE5_edited_anc',
      () => {
        const p = TS_ENGINE.presetKe({}, 5);
        p.heel += 40;
        p.anc.on = true;
        return p;
      },
      () => {
        const p = ref.presetKe({}, 5);
        p.heel += 40;
        p.anc.on = true;
        return p;
      },
    ],
    ['D_D80_rib', () => TS_ENGINE.presetWall4({}, 0), () => ref.presetWall4({}, 0)],
    ['D_D60_flat', () => TS_ENGINE.presetWall4({}, 4), () => ref.presetWall4({}, 4)],
  ] as const) {
    it(`matches model3D concrete/soil/lean meshes, bar groups & M3Tubes buffers for ${label}`, () => {
      const pTs = makeTs();
      const pRef = makeRef();
      const resTs = TS_ENGINE.buildBars(pTs);
      const resRef = ref.buildBars(pRef);

      const mTs = TS_M3D.model3D(pTs, resTs);
      const mRef = ref.model3D(pRef, resRef) as {
        conc: unknown;
        lean: unknown;
        soil: unknown;
        bbox: unknown;
        sig: string;
        groups: Array<{ R: number; bars: number[][][] }>;
      };

      expect(mTs.sig).toBe(mRef.sig);
      assertParity(mTs.bbox, mRef.bbox, `${label}.3d.bbox`);
      assertParity(mTs.conc, mRef.conc, `${label}.3d.conc`, new WeakMap(), 1e-9);
      assertParity(mTs.lean, mRef.lean, `${label}.3d.lean`, new WeakMap(), 1e-9);
      assertParity(mTs.soil, mRef.soil, `${label}.3d.soil`, new WeakMap(), 1e-9);
      expect(mTs.groups.length).toBe(mRef.groups.length);

      for (let i = 0; i < mTs.groups.length; i++) {
        const gTs = mTs.groups[i];
        const gRef = mRef.groups[i] as Record<string, unknown>;
        expect(gTs.key).toBe(gRef.key);
        expect(gTs.mark).toBe(gRef.mark);
        expect(gTs.d).toBe(gRef.d);
        expect(gTs.count).toBe(gRef.count);
        assertParity(gTs.bars, gRef.bars, `${label}.3d.groups[${i}].bars`, new WeakMap(), 1e-9);
      }

      // Check M3Tubes generation parity across ALL bar groups & chunks (plus low-maxV multi-chunk boundary)
      const tTs = new TS_M3D.M3Tubes(8);
      const tRef = new ref.M3Tubes(8);
      for (let gi = 0; gi < mTs.groups.length; gi++) {
        const grTs = mTs.groups[gi];
        const grRef = mRef.groups[gi];
        grTs.bars.forEach((pl) => tTs.add(pl, grTs.R ?? grTs.d / 20));
        grRef.bars.forEach((pl) => tRef.add(pl, grRef.R));
      }
      const chTs = tTs.finish();
      expect(chTs.length).toBe(tRef.chunks.length);
      for (let ci = 0; ci < chTs.length; ci++) {
        expect(chTs[ci].nv, `${label}.chunk[${ci}].nv`).toBe(tRef.chunks[ci].nv);
        expect(chTs[ci].i.length, `${label}.chunk[${ci}].i.length`).toBe(tRef.chunks[ci].i.length);
        assertParity(chTs[ci].v, new Float32Array(tRef.chunks[ci].v), `${label}.M3Tubes[${ci}].v`, new WeakMap(), 1e-5);
      }

      if (label === 'B_H1300_extreme') {
        const splitTs = new TS_M3D.M3Tubes(8, 200);
        const splitRef = new ref.M3Tubes(8, 200);
        mTs.groups[0].bars.forEach((pl) => splitTs.add(pl, mTs.groups[0].R ?? mTs.groups[0].d / 20));
        mRef.groups[0].bars.forEach((pl) => splitRef.add(pl, mRef.groups[0].R));
        const scTs = splitTs.finish();
        expect(scTs.length).toBeGreaterThan(1);
        expect(scTs.length).toBe(splitRef.chunks.length);
        for (let ci = 0; ci < scTs.length; ci++) {
          expect(scTs[ci].nv).toBe(splitRef.chunks[ci].nv);
          expect(scTs[ci].i.length).toBe(splitRef.chunks[ci].i.length);
          assertParity(scTs[ci].v, new Float32Array(splitRef.chunks[ci].v), `splitChunk[${ci}].v`, new WeakMap(), 1e-5);
        }
      }
    });
  }
});

describe('QA 5. Project .tcl.json Roundtrip, Migrations & Export Binary Integrity', () => {
  it('roundtrips modified projects cleanly, migrates legacy payloads, and rejects malformed .tcl.json', () => {
    for (const [tsMaker, refMaker] of [
      [() => TS_ENGINE.presetCanti(750), () => ref.presetCanti(750)],
      [() => TS_ENGINE.presetRib(), () => ref.presetRib()],
      [() => TS_ENGINE.presetKe({}, 3), () => ref.presetKe({}, 3)],
      [() => TS_ENGINE.presetWall4({}, 2), () => ref.presetWall4({}, 2)],
    ] as const) {
      const p0 = tsMaker();
      const r0 = refMaker();
      for (const x of [p0, r0]) {
        x.name = 'Dự án Kiểm thử QĐ-12';
        (x === p0 ? TS_ENGINE.calcEnsure(x) : ref.calcEnsure(x)).wOn = true;
        (x === p0 ? TS_ENGINE.calcEnsure(x) : ref.calcEnsure(x)).eqOn = true;
      }
      const json = TS_EXPORT.serializeProject(p0);
      const obj = JSON.parse(json) as { app: string; v: number };
      expect(obj.app).toBe('tuong-chan-L');
      expect(obj.v).toBe(1);

      const restored = TS_EXPORT.parseProjectFile(json);
      const refMerged = ref.mergeProject(JSON.parse(JSON.stringify(r0)));
      assertParity(restored, refMerged, `roundtrip_merge_${p0.tpl}`);
      const rRestored = { ...TS_ENGINE.calcRun(restored) } as Record<string, unknown>;
      const rOrig = { ...TS_ENGINE.calcRun(p0) } as Record<string, unknown>;
      delete rRestored.P;
      delete rOrig.P;
      assertParity(rRestored, rOrig, `roundtrip_calc_${p0.tpl}`);
      assertParity(
        TS_CAD.buildAllSheets(restored, TS_ENGINE.buildBars(restored), TS_ENGINE.quantities(restored)),
        TS_CAD.buildAllSheets(p0, TS_ENGINE.buildBars(p0), TS_ENGINE.quantities(p0)),
        `roundtrip_cad_${p0.tpl}`,
      );
    }

    // Legacy (kb, kf) + legacy anchor migration parity
    const legacyRaw = {
      tpl: 'B',
      H: 500,
      calc: {
        kb: 15,
        kf: 2.5,
        soil: 'a',
        anc: true,
        aLr: 1.4,
        aLc: 0.7,
        ad: 28,
        as: 0.5,
      },
    };
    const tsMigrated = TS_EXPORT.parseProjectFile(JSON.stringify({ app: 'tuong-chan-L', v: 1, p: legacyRaw }));
    const refMigrated = ref.mergeProject(JSON.parse(JSON.stringify(legacyRaw)));
    assertParity(tsMigrated, refMigrated, 'legacy_migration');
    assertParity(TS_ENGINE.calcEnsure(tsMigrated), ref.calcEnsure(refMigrated), 'legacy_calcEnsure');
    expect(tsMigrated.calc!.kbx).toBeCloseTo(15e-6, 12);
    expect(tsMigrated.calc!.kfx).toBeCloseTo(2.5e-6, 12);
    expect(tsMigrated.anc.on).toBe(true);
    expect(tsMigrated.anc.L).toBe(210);
    expect(tsMigrated.rb.an.d).toBe(28);
    expect(tsMigrated.rb.an.a).toBe(50);

    expect(() => TS_EXPORT.parseProjectFile('{}')).toThrow();
    expect(() => TS_EXPORT.parseProjectFile('not json')).toThrow();
  });

  it('validates calcDocxBlob ZIP CRC32, word/document.xml OOXML+OMML+tables+media, and PDF binary structure', async () => {
    const p = TS_ENGINE.presetCanti(500);
    const c = TS_ENGINE.calcEnsure(p);
    c.pjName = 'Thử nghiệm Đắk Lắk';
    c.wOn = true;
    const R = TS_ENGINE.calcRun(p);
    expect(TS_ENGINE.calcGsRunNow(p)).toBe(true);

    const blob = await TS_EXPORT.calcDocxBlob(p, R);
    const ab = await new Promise<ArrayBuffer>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as ArrayBuffer);
      r.onerror = () => reject(r.error);
      r.readAsArrayBuffer(blob);
    });
    const zipEntries = unzipAndVerifyCrc(new Uint8Array(ab));

    for (const required of [
      '[Content_Types].xml',
      '_rels/.rels',
      'docProps/core.xml',
      'docProps/app.xml',
      'word/document.xml',
      'word/styles.xml',
      'word/settings.xml',
      'word/footer1.xml',
      'word/_rels/document.xml.rels',
    ]) {
      expect(zipEntries.has(required), `Missing DOCX entry ${required}`).toBe(true);
    }

    const td = new TextDecoder('utf-8');
    const docXml = td.decode(zipEntries.get('word/document.xml')!);
    expect(docXml).toContain('<w:document');
    expect(docXml).toContain('<m:oMath>');
    expect(docXml).toContain('<w:tbl>');
    expect(docXml).toContain('<w:sectPr>');
    expect(docXml).toContain('Thử nghiệm Đắk Lắk');

    // Every word/document.xml image rId must match a real file in word/media/
    const relsXml = td.decode(zipEntries.get('word/_rels/document.xml.rels')!);
    const mediaKeys = [...zipEntries.keys()].filter((k) => k.startsWith('word/media/'));
    expect(mediaKeys.length).toBeGreaterThanOrEqual(4);
    for (const k of mediaKeys) {
      expect(relsXml).toContain(k.replace('word/', ''));
    }

    // Valid CAD & Calc PDFs load cleanly via pdf-lib
    const res = TS_ENGINE.buildBars(p);
    const q = TS_ENGINE.quantities(p, res);
    const sh = TS_CAD.buildSheet(p, res, q, 0);
    const cadPdfBytes = await TS_EXPORT.exportCadPdfBytes(sh);
    expect(td.decode(cadPdfBytes.slice(0, 5))).toBe('%PDF-');
    expect(td.decode(cadPdfBytes.slice(-32))).toContain('%%EOF');
    const cadPdfDoc = await PDFDocument.load(cadPdfBytes);
    expect(cadPdfDoc.getPageCount()).toBe(1);

    const calcPdfBytes = await TS_EXPORT.exportCalcPdfBytes(p, R);
    expect(td.decode(calcPdfBytes.slice(0, 5))).toBe('%PDF-');
    expect(td.decode(calcPdfBytes.slice(-32))).toContain('%%EOF');
    const calcPdfDoc = await PDFDocument.load(calcPdfBytes);
    expect(calcPdfDoc.getPageCount()).toBeGreaterThanOrEqual(2);
  });
});

describe('QA 5b. Differential Report HTML, Zero-NaN Shear Rows & Multi-Template DOCX OOXML/OMML Parity', () => {
  it('matches calcSheetHTML, calcRbView, calcGsView (dot/comma, zero NaN) & full calcDocxBlob ZIP entries across Mẫu 1, 2, 4 & Hard Multi-Hazard', async () => {
    vi.restoreAllMocks();
    const rec = installMockCanvas2D();
    try {
      const specs: Array<{
        label: string;
        makeTs: () => EngineProject;
        makeRef: () => EngineProject;
        runFe?: boolean;
        runFem?: boolean;
      }> = [
        {
          label: 'Mau1_B500',
          makeTs: () => {
            const p = TS_ENGINE.presetCanti(500);
            TS_ENGINE.calcEnsure(p).pjName = 'Thử nghiệm Đắk Lắk';
            return p;
          },
          makeRef: () => {
            const p = ref.presetCanti(500);
            ref.calcEnsure(p).pjName = 'Thử nghiệm Đắk Lắk';
            return p;
          },
        },
        {
          label: 'Mau2_A_rib',
          makeTs: () => {
            const p = TS_ENGINE.presetRib();
            TS_ENGINE.calcEnsure(p).pjName = 'Tường có sườn Mẫu 2';
            return p;
          },
          makeRef: () => {
            const p = ref.presetRib();
            ref.calcEnsure(p).pjName = 'Tường có sườn Mẫu 2';
            return p;
          },
        },
        {
          label: 'Mau4_D80',
          makeTs: () => {
            const p = TS_ENGINE.presetWall4({}, 0);
            TS_ENGINE.calcEnsure(p).pjName = 'Tường neo đá D80';
            return p;
          },
          makeRef: () => {
            const p = ref.presetWall4({}, 0);
            ref.calcEnsure(p).pjName = 'Tường neo đá D80';
            return p;
          },
        },
        {
          label: 'Hard_MultiHazard',
          runFe: true,
          runFem: true,
          makeTs: () => {
            const p = TS_ENGINE.presetCanti(550);
            p.fillMode = '1.5';
            p.fillH = 120;
            const c = TS_ENGINE.calcEnsure(p);
            c.pjName = 'Đa tổ hợp Nước + Động đất + FE + FEM';
            c.wOn = true;
            c.wMode = 'fd';
            c.hB = 4.2;
            c.hF = 0.25;
            c.Tn = 2.0;
            c.eqOn = true;
            c.eqKm = 'full';
            c.eqA = 0.16;
            c.eqKh = 0.11;
            c.eqKv = 0.05;
            c.bsOn = true;
            c.feOn = true;
            c.feBasis = 'fe';
            c.femOn = true;
            c.femMesh = 'c';
            c.femLifts = 2;
            c.femSrm = true;
            return p;
          },
          makeRef: () => {
            const p = ref.presetCanti(550);
            p.fillMode = '1.5';
            p.fillH = 120;
            const c = ref.calcEnsure(p);
            c.pjName = 'Đa tổ hợp Nước + Động đất + FE + FEM';
            c.wOn = true;
            c.wMode = 'fd';
            c.hB = 4.2;
            c.hF = 0.25;
            c.Tn = 2.0;
            c.eqOn = true;
            c.eqKm = 'full';
            c.eqA = 0.16;
            c.eqKh = 0.11;
            c.eqKv = 0.05;
            c.bsOn = true;
            c.feOn = true;
            c.feBasis = 'fe';
            c.femOn = true;
            c.femMesh = 'c';
            c.femLifts = 2;
            c.femSrm = true;
            return p;
          },
        },
      ];

      const td = new TextDecoder('utf-8');
      const normCore = (xml: string) =>
        xml.replace(/<dcterms:created[^>]*>[^<]*<\/dcterms:created>/, '<dcterms:created>TS</dcterms:created>');

      for (const spec of specs) {
        TS_ENGINE.resetEngineCaches();
        ref.resetCaches();
        const pTs = spec.makeTs();
        const pRef = spec.makeRef();

        if (spec.runFe) {
          expect(TS_ENGINE.calcFeEnsure(pTs)).toBe(ref.calcFeEnsure(pRef));
        }
        expect(TS_ENGINE.calcGsRunNow(pTs)).toBe(ref.calcGsRunNow(pRef));
        if (spec.runFem) {
          await runFemSyncPair(pTs, pRef, ref);
        }

        const rTs = TS_ENGINE.calcRun(pTs);
        const rRef = ref.calcRun(pRef);
        expect(TS_ENGINE.isCalcValid(rTs), `${spec.label} calcValid`).toBe(true);
        if (!TS_ENGINE.isCalcValid(rTs)) continue;
        assertParity(rTs, rRef, `${spec.label}.calcRun`, new WeakMap(), 1e-8);

        // Compare Report HTML with '.' and ',' decimals + confirm zero NaN in shear rows
        for (const dec of ['.', ','] as const) {
          TS_ENGINE.calcEnsure(pTs).dec = dec;
          ref.calcEnsure(pRef).dec = dec;
          TS_REPORTS.resetReportFigCounter(0);
          ref.resetReportFigs(0);
          const htmlTs = TS_REPORTS.calcSheetHTML(pTs, rTs);
          const htmlRef = ref.calcSheetHTML(pRef, rRef);
          expect(htmlTs, `${spec.label}(${dec}): NaN in report HTML`).not.toMatch(/\bNaN\b/);
          expect(htmlTs, `${spec.label}(${dec}): Sức kháng cắt present`).toContain('Sức kháng cắt');
          expectStringParity(
            canonicalizeSvgIds(htmlTs),
            canonicalizeSvgIds(htmlRef),
            `${spec.label}.sheet(${dec})`,
          );
        }

        TS_ENGINE.calcEnsure(pTs).dec = '.';
        ref.calcEnsure(pRef).dec = '.';
        expectStringParity(
          canonicalizeSvgIds(TS_REPORTS.calcRbView(pTs, rTs)),
          canonicalizeSvgIds(ref.calcRbView(pRef, rRef)),
          `${spec.label}.rbView`,
        );
        expectStringParity(
          canonicalizeSvgIds(TS_REPORTS.calcGsView(pTs, rTs)),
          canonicalizeSvgIds(ref.calcGsView(pRef, rRef)),
          `${spec.label}.gsView`,
        );

        // Full OOXML/OMML DOCX ZIP byte parity (incl. exact _rels/.rels rId2 core-properties URI + zero NaN)
        const blobTs = await TS_EXPORT.calcDocxBlob(pTs, rTs);
        const blobRef = await ref.calcDocxBlob(pRef, rRef);
        const filesTs = unzipAndVerifyCrc(await readBlobAsUint8Array(blobTs));
        const filesRef = unzipAndVerifyCrc(await readBlobAsUint8Array(blobRef));
        expect([...filesTs.keys()], `${spec.label} docx entry list`).toEqual([...filesRef.keys()]);

        const topRels = td.decode(filesTs.get('_rels/.rels')!);
        expect(topRels, `${spec.label} _rels/.rels rId2 URI`).toContain(
          'Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"',
        );
        const docXml = td.decode(filesTs.get('word/document.xml')!);
        expect(docXml, `${spec.label} <m:oMath>`).toContain('<m:oMath>');
        expect(docXml, `${spec.label} <w:tbl>`).toContain('<w:tbl>');
        expect(docXml, `${spec.label} NaN in DOCX XML`).not.toMatch(/\bNaN\b/);

        for (const key of filesTs.keys()) {
          if (key.startsWith('word/media/')) {
            expect(filesTs.get(key)!.length, `${spec.label}:${key} media len`).toBe(
              filesRef.get(key)!.length,
            );
            continue;
          }
          const txtTs = td.decode(filesTs.get(key)!);
          const txtRef = td.decode(filesRef.get(key)!);
          if (key === 'docProps/core.xml') {
            expectStringParity(normCore(txtTs), normCore(txtRef), `${spec.label}:${key}`);
          } else if (key === 'docProps/app.xml') {
            expect(txtTs).toContain('<Application>LEDAT-BIM</Application>');
            expect(txtTs).not.toContain('Thợ Vẽ');
            expectStringParity(
              txtTs,
              txtRef.replace('Tường chắn chữ L - Thợ Vẽ 4.0', 'LEDAT-BIM'),
              `${spec.label}:${key}`,
            );
          } else {
            expectStringParity(txtTs, txtRef, `${spec.label}:${key}`);
          }
        }
      }
    } finally {
      rec.restore();
    }
  }, 120000);
});

describe('QA 6. Licensing / Trial / Activation Absence Audit', () => {
  it('contains zero licensing, trial, hardware-id, or activation artifacts in TuongChanL-Web src, index.html & start-webapp.bat', () => {
    const webappRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
    const forbidden = /\b(license|trial|machineId|machine_id|hwid|activate|licchip|licov|tclApp)\b|TCL1-|kích hoạt(?!\s+tường)|dùng thử|bản quyền|mã máy/i;

    const walk = (dir: string): string[] => {
      const out: string[] = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...walk(full));
        else if (/\.(ts|tsx|js|jsx|css|html|json)$/i.test(entry.name)) out.push(full);
      }
      return out;
    };

    const files = [
      path.join(webappRoot, 'index.html'),
      path.join(webappRoot, 'start-webapp.bat'),
      ...walk(path.join(webappRoot, 'src')),
    ];
    const hits: string[] = [];
    for (const f of files) {
      let text = fs.readFileSync(f, 'utf8');
      if (f.endsWith('fem2dCore.ts')) {
        // Mohr-Coulomb SRM algorithm uses mathematical trial load factor symbols `trial` / `trials` / `srmTrials`
        text = text.replace(/\b(srmTrials|trials|trial)\b/g, 'srmStep');
      }
      const m = forbidden.exec(text);
      if (m) hits.push(`${f}: matched "${m[0]}"`);
      if (/Thợ Vẽ/i.test(text)) hits.push(`${f}: matched legacy author string "Thợ Vẽ"`);
    }
    expect(hits, `Forbidden licensing/activation artifacts found:\n${hits.join('\n')}`).toEqual([]);
  });
});
