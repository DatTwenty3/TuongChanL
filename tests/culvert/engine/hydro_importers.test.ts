import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import * as GeoTIFF from 'geotiff';
import proj4 from 'proj4';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  clearContextStore,
  resetAllContexts,
  setContextStore,
} from '../../../src/culvert/engine/context.ts';
import {
  BUILT_IN_HVST_NAMES,
  HVMAP,
  HVST,
  HVSTL,
  HVTAB,
  HVWL,
  HVZL,
  HVZONE,
  TVC_ST,
  hvRegAt,
  hvRegAuto,
  hvTMinv,
  tmAdd,
  tmLoadFromStorage,
  tmParse,
  tmSlug,
} from '../../../src/culvert/engine/hydrology/stationsDb.ts';
import {
  HV,
  HVM,
  HVKM,
  hvCalc,
  hvKm,
  hvKmF,
  hvPairs,
  hvPoly2,
  hvScour,
  hvSecTrim,
  toBridgeHydrologyResult,
  type HvCalcResult,
  type HvInput,
  type HvPierScourInput,
  type HvSoilProps,
  type HvAbutScourInput,
  type HvAbutSoilProps,
} from '../../../src/culvert/engine/hydrology/bridgeHydro.ts';
import {
  TVC_BAN,
  TVC_Q,
  getLatestTvcResult,
  setLatestTvcResult,
  toCulvertHydrologyResult,
  tvcCalc,
  tvcHV,
  tvcHp,
  tvcRows,
  tvcSize,
  tvcStep,
  tvxContours,
  tvxRun,
  type TvcCalcResult,
  type TvxDemGrid,
} from '../../../src/culvert/engine/hydrology/culvertHydro.ts';
import {
  HDSRC,
  HVD,
  base64ToUint8Array,
  hdDxfFig,
  loadBuiltinDem,
  runWatershed,
  toDemWatershedResult,
  type HvdRunOptions,
} from '../../../src/culvert/engine/hydrology/demWatershed.ts';
import {
  TCV3,
  analyzeBridgeDxfBuffer,
  decodeDxfBuffer,
  dxsBridge,
  dxsFind,
  dxsKm,
  dxsKmF,
  dxsPairs,
  dxsParse,
  dxsTxt,
  hasTcvn3Bytes,
  parseCulvertDxfText,
  tvxArea,
  tvxDpoly,
  tvxDseg,
  tvxGap,
  tvxIn,
  tvxKm,
  tvxLen,
} from '../../../src/culvert/engine/importers/dxfParser.ts';
import {
  OCRCOL,
  extractProfileStructure,
  getOfflineTesseractOptions,
  ocrNums,
  repairMissingDecimals,
  resolveOfflineAsset,
  stripTableLines,
  otsuThreshold,
} from '../../../src/culvert/engine/importers/ocrPipeline.ts';
import { STATIC_DEM_FILES, type HydrologyResult, type Point2D } from '../../../src/culvert/types/project.ts';

interface MockEl {
  id: string;
  tagName: string;
  value: string;
  checked: boolean;
  innerHTML: string;
  textContent: string;
  width: number;
  height: number;
  style: Record<string, string>;
  dataset: Record<string, string>;
  options: MockEl[];
  classList: {
    add: (...cls: string[]) => void;
    remove: (...cls: string[]) => void;
    toggle: (cls: string) => void;
    contains: (cls: string) => boolean;
  };
  addEventListener: () => void;
  removeEventListener: () => void;
  dispatchEvent: () => boolean;
  setAttribute: (k: string, val: unknown) => void;
  getAttribute: (k: string) => string;
  closest: () => MockEl;
  querySelector: () => null;
  querySelectorAll: () => MockEl[];
  appendChild: (child: MockEl) => MockEl;
  after: () => void;
  remove: () => void;
  getContext: (kind: string) => unknown;
  toDataURL: (mime?: string) => string;
  nextElementSibling: MockEl | null;
}

interface HydroJsOracle {
  HVST: typeof HVST;
  HVSTL: typeof HVSTL;
  HVMAP: typeof HVMAP;
  HVTAB: typeof HVTAB;
  HVZONE: typeof HVZONE;
  HVZL: typeof HVZL;
  HVWL: typeof HVWL;
  HVKM: typeof HVKM;
  TVC_ST: typeof TVC_ST;
  TVC_Q: typeof TVC_Q;
  TVC_BAN: typeof TVC_BAN;
  hvTMinv: typeof hvTMinv;
  hvRegAt: typeof hvRegAt;
  hvRegAuto: typeof hvRegAuto;
  HV: typeof HV;
  HVM: typeof HVM;
  hvKm: typeof hvKm;
  hvKmF: typeof hvKmF;
  hvPairs: typeof hvPairs;
  hvPBang: () => ReturnType<typeof import('../../../src/culvert/engine/hydrology/bridgeHydro.ts').hvPBang>;
  hvXLR: typeof import('../../../src/culvert/engine/hydrology/bridgeHydro.ts').hvXLR;
  hvSecTrim: typeof hvSecTrim;
  hvPoly2: typeof hvPoly2;
  hvScour: typeof hvScour;
  hvCalc: typeof hvCalc;
  hvIn: () => HvInput;
  tvcSize: typeof tvcSize;
  tvcHV: typeof tvcHV;
  tvcRows: () => ReturnType<typeof tvcRows>;
  tvcSer: () => Array<{ y: number; x: number }>;
  tvcHp: (P: number) => ReturnType<typeof tvcHp>;
  tvcCalc: () => TvcCalcResult;
  tvcStep: () => void;
  getJsTVCR: () => TvcCalcResult | null;
  tvcMap: () => void;
  TVX: Record<string, unknown>;
  tvxFile: (f: { name: string; arrayBuffer: () => Promise<ArrayBuffer> }) => Promise<void>;
  tvxRun: () => Promise<void>;
  tvxArea: typeof tvxArea;
  tvxIn: typeof tvxIn;
  tvxKm: typeof tvxKm;
  tvxLen: typeof tvxLen;
  tvxGap: typeof tvxGap;
  tvxDseg: typeof tvxDseg;
  tvxDpoly: typeof tvxDpoly;
  HVD: typeof HVD;
  HDSRC: typeof HDSRC;
  hdDxfFig: typeof hdDxfFig;
  TCV3: typeof TCV3;
  dxsTxt: typeof dxsTxt;
  dxsParse: typeof dxsParse;
  dxsFind: typeof dxsFind;
  dxsBridge: typeof dxsBridge;
  ocrNums: typeof ocrNums;
  dollar: (id: string) => MockEl;
  resetDom: () => void;
  getStorage: () => Record<string, string>;
}

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(TEST_DIR, '../../..');
const MODULES_DIR = resolve(WEB_ROOT, '../analysis-cau-cong/modules');
const PUBLIC_DIR = resolve(WEB_ROOT, 'public');

const HYDRO_ORACLE_FILES = [
  '01_boot_shims_and_sf.js',
  '02_core_utils_and_column_pm.js',
  '15_bridge_hydrology_data_and_calc.js',
  '16_dem_watershed_ocr_dxf_import.js',
  '17_culvert_hydrology_and_dxftools.js',
] as const;

const MODULE_SOURCE_FILES = [
  'src/culvert/engine/hydrology/stationsDb.ts',
  'src/culvert/engine/hydrology/demWatershed.ts',
  'src/culvert/engine/hydrology/culvertHydro.ts',
  'src/culvert/engine/hydrology/bridgeHydro.ts',
  'src/culvert/engine/importers/dxfParser.ts',
  'src/culvert/engine/importers/ocrPipeline.ts',
] as const;

let oracle: HydroJsOracle;
let origGlobalFetch: typeof globalThis.fetch;

function expectParityClose(
  actual: unknown,
  expected: unknown,
  tol = 1e-9,
  path = 'root',
): void {
  if (typeof expected === 'number') {
    expect(typeof actual, `${path} should be number`).toBe('number');
    const a = actual as number;
    if (Number.isNaN(expected)) {
      expect(Number.isNaN(a), `${path} expected NaN`).toBe(true);
      return;
    }
    if (!Number.isFinite(expected)) {
      expect(a, `${path} non-finite parity`).toBe(expected);
      return;
    }
    const diff = Math.abs(a - expected);
    const scale = Math.max(1, Math.abs(expected));
    expect(
      diff <= tol || diff <= tol * scale,
      `${path}: actual=${a} vs expected=${expected} (diff=${diff})`,
    ).toBe(true);
    return;
  }

  if (Array.isArray(expected)) {
    expect(Array.isArray(actual), `${path} should be array`).toBe(true);
    const aArr = actual as unknown[];
    expect(aArr.length, `${path}.length`).toBe(expected.length);
    for (let i = 0; i < expected.length; i++) {
      expectParityClose(aArr[i], expected[i], tol, `${path}[${i}]`);
    }
    return;
  }

  if (expected !== null && typeof expected === 'object') {
    expect(actual !== null && typeof actual === 'object', `${path} should be object`).toBe(true);
    const aObj = actual as Record<string, unknown>;
    const eObj = expected as Record<string, unknown>;
    for (const key of Object.keys(eObj)) {
      const val = eObj[key];
      if (typeof val === 'function') continue;
      expectParityClose(aObj[key], val, tol, `${path}.${key}`);
    }
    return;
  }

  expect(actual, `${path}`).toEqual(expected);
}

function loadHydroOracle(): HydroJsOracle {
  const domMap = new Map<string, MockEl>();
  const storageMap = new Map<string, string>();

  const makeMockEl = (id = '', tagName = 'DIV'): MockEl => {
    const classes = new Set<string>();
    const attrs: Record<string, string> = {};
    const el: MockEl = {
      id,
      tagName,
      value: '',
      checked: false,
      innerHTML: '',
      textContent: '',
      width: 300,
      height: 150,
      style: {},
      dataset: {},
      options: [],
      nextElementSibling: null,
      classList: {
        add: (...cls) => cls.forEach((c) => classes.add(c)),
        remove: (...cls) => cls.forEach((c) => classes.delete(c)),
        toggle: (cls) => {
          if (classes.has(cls)) classes.delete(cls);
          else classes.add(cls);
        },
        contains: (cls) => classes.has(cls),
      },
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
      setAttribute: (k, v) => {
        attrs[k] = String(v);
      },
      getAttribute: (k) => attrs[k] ?? '',
      closest: () => makeMockEl('', 'TR'),
      querySelector: () => null,
      querySelectorAll: () => [],
      appendChild: (c) => c,
      after: () => {},
      remove: () => {},
      getContext: (kind: string) =>
        kind === '2d'
          ? {
              createImageData: (w: number, h: number) => ({
                width: w,
                height: h,
                data: new Uint8ClampedArray(w * h * 4),
              }),
              putImageData: () => {},
              drawImage: () => {},
              clearRect: () => {},
              fillRect: () => {},
              beginPath: () => {},
              moveTo: () => {},
              lineTo: () => {},
              closePath: () => {},
              stroke: () => {},
              fill: () => {},
              arc: () => {},
              save: () => {},
              restore: () => {},
              translate: () => {},
              rotate: () => {},
              scale: () => {},
              fillText: () => {},
              measureText: () => ({ width: 12 }),
            }
          : null,
      toDataURL: () => 'data:image/png;base64,',
    };
    return el;
  };

  const getEl = (id: string): MockEl => {
    let e = domMap.get(id);
    if (!e) {
      e = makeMockEl(id);
      domMap.set(id, e);
    }
    return e;
  };

  const fakeDocument = {
    getElementById: (id: string) => getEl(id),
    createElement: (tag: string) => makeMockEl('', tag.toUpperCase()),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    head: makeMockEl('head', 'HEAD'),
    body: makeMockEl('body', 'BODY'),
  };

  const fakeLocalStorage = {
    getItem: (k: string) => (storageMap.has(k) ? storageMap.get(k)! : null),
    setItem: (k: string, val: unknown) => {
      storageMap.set(k, String(val));
    },
    removeItem: (k: string) => {
      storageMap.delete(k);
    },
    clear: () => {
      storageMap.clear();
    },
  };

  const fakeWindow: Record<string, unknown> = {
    document: fakeDocument,
    localStorage: fakeLocalStorage,
    addEventListener: () => {},
    __OD: {},
  };
  fakeWindow.window = fakeWindow;

  const sandbox: Record<string, unknown> = {
    console,
    Math,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Date,
    JSON,
    RegExp,
    Error,
    Map,
    Set,
    Uint8Array,
    Int32Array,
    Float64Array,
    Float32Array,
    Uint16Array,
    Uint8ClampedArray,
    DataView,
    ArrayBuffer,
    Promise,
    parseFloat,
    parseInt,
    isFinite,
    isNaN,
    TextDecoder,
    TextEncoder,
    Event: globalThis.Event,
    CustomEvent: globalThis.CustomEvent,
    atob: globalThis.atob.bind(globalThis),
    btoa: globalThis.btoa.bind(globalThis),
    performance,
    // Suppress top-level boot timers while compiling/running module initializers.
    setTimeout: () => 0,
    clearTimeout: () => {},
    requestAnimationFrame: () => 0,
    document: fakeDocument,
    window: fakeWindow,
    localStorage: fakeLocalStorage,
    Chart: function MockChart() {},
    Plotly: { newPlot: () => {}, react: () => {} },
    MathJax: { typesetPromise: () => Promise.resolve(), typesetClear: () => {} },
    GeoTIFF,
    proj4,
    fetch: () => {
      throw new Error('Blocked external fetch() inside offline hydrology oracle');
    },
  };
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;

  const ctx = vm.createContext(sandbox);
  for (const file of HYDRO_ORACLE_FILES) {
    const code = readFileSync(resolve(MODULES_DIR, file), 'utf8');
    vm.runInContext(code, ctx, { filename: file });
  }

  // Restore real timers once module boot code has executed so async yields inside tvxRun/HVD.run resolve.
  sandbox.setTimeout = globalThis.setTimeout.bind(globalThis);
  sandbox.clearTimeout = globalThis.clearTimeout.bind(globalThis);

  vm.runInContext(
    `globalThis.__ORACLE__ = {
      HVST,
      HVSTL,
      HVMAP,
      HVTAB,
      HVZONE,
      HVZL,
      HVWL,
      HVKM,
      TVC_ST,
      TVC_Q,
      TVC_BAN,
      hvTMinv,
      hvRegAt,
      hvRegAuto,
      HV,
      HVM,
      hvKm,
      hvKmF,
      hvPairs,
      hvPBang,
      hvXLR,
      hvSecTrim,
      hvPoly2,
      hvScour,
      hvCalc,
      hvIn,
      tvcSize,
      tvcHV,
      tvcRows,
      tvcSer,
      tvcHp,
      tvcCalc,
      tvcStep,
      getJsTVCR: () => TVCR,
      tvcMap,
      TVX,
      tvxFile,
      tvxRun,
      tvxArea,
      tvxIn,
      tvxKm,
      tvxLen,
      tvxGap,
      tvxDseg,
      tvxDpoly,
      HVD,
      HDSRC,
      hdDxfFig,
      TCV3,
      dxsTxt,
      dxsParse,
      dxsFind,
      dxsBridge,
      ocrNums,
      dollar: $,
    };`,
    ctx,
    { filename: 'hydro-oracle-bridge.js' },
  );

  const exposed = (ctx.__ORACLE__ as Omit<HydroJsOracle, 'resetDom' | 'getStorage'>);
  return {
    ...exposed,
    resetDom: () => {
      domMap.clear();
      storageMap.clear();
    },
    getStorage: () => Object.fromEntries(storageMap.entries()),
  };
}

function toArrayBufferCopy(u: Uint8Array): ArrayBuffer {
  const out = new Uint8Array(u.byteLength);
  out.set(u);
  return out.buffer;
}

function populateBridgeOracleDom(o: HydroJsOracle, fields: Record<string, string>): void {
  for (const [k, v] of Object.entries(fields)) {
    o.dollar(`hv_${k}`).value = v;
  }
}

function buildScenarioInput(opts: {
  idPrefix?: string;
  P?: string;
  capd?: string;
  pxm?: string;
  Px?: string;
  st?: string;
  rs?: string;
  rain?: string;
  Xm?: string;
  Cvp?: string;
  Csp?: string;
  Csu?: string;
  rm?: string;
  rd?: string;
  F?: string;
  L?: string;
  sl?: string;
  two?: string;
  Jls?: string;
  Jsd?: string;
  msd?: string;
  mls?: string;
  cls?: string;
  regm?: string;
  reg?: string;
  fao?: string;
  aoPos?: string;
  qm?: string;
  qsrc?: string;
  qtl?: string;
  km?: string;
  bctm?: string;
  mum?: string;
  v0m?: string;
  zm?: string;
  etm?: string;
  xm?: string;
  pm?: string;
  am?: string;
  sec?: string;
  xA1?: string;
  xA2?: string;
  piers?: string;
  hist?: string;
  MNHT?: string;
  i?: string;
  nch?: string;
  nb?: string;
  gch?: string;
  gb?: string;
  soil?: string;
  coh?: string;
  cty?: string;
  d50?: string;
  d90?: string;
  m?: string;
  Vcp?: string;
  th?: string;
  abut?: string;
  abn?: string;
  tha?: string;
  mta?: string;
  wlst?: string;
  wlser?: string;
  wlday?: string;
  Pt?: string;
}): { fields: Record<string, string>; runOracle: () => HvCalcResult } {
  const baiThuongSeries = HVST['Bái Thượng'].ser.map((a) => `${a[0]} ${a[1]}`).join('\n');
  const fields: Record<string, string> = {
    P: opts.P ?? 'auto',
    capd: opts.capd ?? '36',
    Pwhy: 'Theo TCVN 4054:2005',
    pxm: opts.pxm ?? 'auto',
    Px: opts.Px ?? '1',
    Pa: '4',
    st: opts.st ?? 'Bái Thượng',
    stvt: 'Thanh Hóa',
    lv: 'Sông Chu',
    stWhy: '',
    rs: opts.rs ?? 'ser',
    rain: opts.rain ?? baiThuongSeries,
    Csu: opts.Csu ?? '3.0',
    Xm: opts.Xm ?? '185',
    Cvp: opts.Cvp ?? '0.38',
    Csp: opts.Csp ?? '1.14',
    rm: opts.rm ?? 'fit',
    rd: opts.rd ?? 'p3',
    F: opts.F ?? '18.5',
    L: opts.L ?? '7.2',
    sl: opts.sl ?? '2.1',
    two: opts.two ?? '2',
    jm: 't',
    Jls: opts.Jls ?? '14.5',
    prof: '',
    Jsd: opts.Jsd ?? '45.0',
    msd: opts.msd ?? '0.32',
    mls: opts.mls ?? '9',
    noCh: '0',
    cls: opts.cls ?? 'II',
    phc: '',
    regm: opts.regm ?? 'tay',
    reg: opts.reg ?? 'II',
    fao: opts.fao ?? '1.5',
    aoPos: opts.aoPos ?? 'h',
    qm: opts.qm ?? 'tcvn',
    htr: '5.5',
    sec:
      opts.sec ??
      [
        '0 18.0',
        '15 14.5',
        '25 13.0',
        '32 9.2',
        '45 8.5',
        '58 9.0',
        '66 12.8',
        '78 14.2',
        '95 18.2',
      ].join('\n'),
    secR: '',
    mnk: '',
    xlm: 'bank',
    xL: '25',
    xR: '66',
    hf: 'r',
    nch: opts.nch ?? '0.035',
    nb: opts.nb ?? '0.050',
    gch: opts.gch ?? '0.008',
    gb: opts.gb ?? '0.015',
    i: opts.i ?? '3.5',
    hist: opts.hist ?? '2017 13.6 0\n2020 12.9 0',
    MNHT: opts.MNHT ?? '9.8',
    tcOn: '1',
    dTC: '0.8',
    tcm: 'p10',
    xA1: opts.xA1 ?? '18',
    xA2: opts.xA2 ?? '76',
    piers: opts.piers ?? '39 1.4 8.5\n54 1.4 8.5',
    nose: 'tron',
    mty: 'cot',
    pty: 'coc',
    th: opts.th ?? '0',
    abut: opts.abut ?? 'canh',
    abn: opts.abn ?? 'non',
    tha: opts.tha ?? '90',
    mta: opts.mta ?? '1.5',
    LpL: '',
    LpR: '',
    lpm: 'non',
    sdn: '',
    km: opts.km ?? 'bel',
    Pt: opts.Pt ?? 'qq',
    lxm: 'max',
    v0m: opts.v0m ?? 'cau',
    mum: opts.mum ?? '1',
    qsrc: opts.qsrc ?? 'tcvn',
    qtl: opts.qtl ?? '1 310\n2 255\n4 205\n10 155',
    qtlsrc: 'Số liệu đo thủy văn',
    bctm: opts.bctm ?? 'htb',
    dzcp: '0.30',
    Qcong: '0',
    wlst: opts.wlst ?? '',
    wlser: opts.wlser ?? '',
    wlday: opts.wlday ?? '',
    m: opts.m ?? '0.85',
    Vcp: opts.Vcp ?? '3.5',
    zm: opts.zm ?? 's1',
    etm: opts.etm ?? '0.05',
    soil: opts.soil ?? 'tb',
    coh: opts.coh ?? '0',
    cty: opts.cty ?? 'C2',
    d50: opts.d50 ?? '15',
    gd: '2.65',
    d90: opts.d90 ?? '38',
    xm: opts.xm ?? 'lis',
    pm: opts.pm ?? 'dhxd',
    am: opts.am ?? 'tdn',
    Ka: '1',
    Kf: '1',
    dlt: '1',
    ELdd: '19.5',
    ELkg: '18.2',
    vt: '0',
    lnk: '0',
    dcs: 'vn',
    dk0: '105',
    dE: '',
    dN: '',
  };

  return {
    fields,
    runOracle: () => {
      populateBridgeOracleDom(oracle, fields);
      const input = oracle.hvIn();
      return oracle.hvCalc(input);
    },
  };
}

let cachedDemLoaded = false;
async function ensureOfflineDemsLoaded(): Promise<void> {
  if (cachedDemLoaded) return;

  const cop1Text = readFileSync(resolve(PUBLIC_DIR, STATIC_DEM_FILES[0]), 'utf8');
  const cop2Text = readFileSync(resolve(PUBLIC_DIR, STATIC_DEM_FILES[1]), 'utf8');
  const thText = readFileSync(resolve(PUBLIC_DIR, STATIC_DEM_FILES[2]), 'utf8');

  const copBytes = base64ToUint8Array(cop1Text.trim() + cop2Text.trim());
  const thBytes = base64ToUint8Array(thText.trim());

  await loadBuiltinDem('cop', (relPath) => readFileSync(resolve(PUBLIC_DIR, relPath), 'utf8'));
  await loadBuiltinDem('srtm', (relPath) => readFileSync(resolve(PUBLIC_DIR, relPath), 'utf8'));

  await oracle.HVD.addBuffer(
    toArrayBufferCopy(copBytes),
    `${HDSRC.cop} - Thanh Hóa`,
    'cop',
    0.1,
  );
  await oracle.HVD.addBuffer(
    toArrayBufferCopy(thBytes),
    `${HDSRC.srtm} - Thanh Hóa`,
    'srtm',
    1,
  );

  cachedDemLoaded = true;
}

describe('Step 5.2 (Part 2) — Hydrology, DEM Watershed, DXF & OCR Differential Parity', () => {
  beforeAll(() => {
    origGlobalFetch = globalThis.fetch;
    oracle = loadHydroOracle();
  });

  beforeEach(() => {
    resetAllContexts();
    clearContextStore();
    oracle.resetDom();
  });

  afterEach(() => {
    globalThis.fetch = origGlobalFetch;
  });

  // ==========================================================================
  // 1. Stations DB, Coordinate Transforms & Core Hydrology Formulas
  // ==========================================================================
  describe('1. Stations DB, Coordinates & Core Hydrology (HV, HVKM, HVM, TVC_ST)', () => {
    it('matches TVC_ST (>= 132 stations), HVST, HVSTL, HVTAB, HVKM, HVZONE, HVZL & HVWL vs oracle', () => {
      expect(TVC_ST.length).toBeGreaterThanOrEqual(132);
      expect(TVC_ST.length).toBe(oracle.TVC_ST.length);
      expectParityClose(TVC_ST, oracle.TVC_ST, 1e-12, 'TVC_ST');

      // Verify well-known Thanh Hoa / key stations exist and match spot values
      expect(TVC_ST.some((r) => r[1] === 'Đà Nẵng' && r[2] === 448)).toBe(true);
      expect(TVC_ST.some((r) => r[1] === 'Huế' && r[2] === 800)).toBe(true);
      expect(TVC_ST[TVC_ST.length - 1][1]).toBe('Ayunpa');

      for (const name of ['Bái Thượng', 'Hồi Xuân', 'Yên Định', 'Như Xuân', 'Cẩm Thủy']) {
        expect(BUILT_IN_HVST_NAMES.has(name)).toBe(true);
        expectParityClose(HVST[name], oracle.HVST[name], 1e-12, `HVST.${name}`);
      }

      expectParityClose(HVSTL, oracle.HVSTL, 1e-12, 'HVSTL');
      expectParityClose(HVTAB, oracle.HVTAB, 1e-12, 'HVTAB');
      expectParityClose(HVKM, oracle.HVKM, 1e-12, 'HVKM');
      expectParityClose(HVZONE, oracle.HVZONE, 1e-12, 'HVZONE');
      expectParityClose(HVZL, oracle.HVZL, 1e-12, 'HVZL');
      expectParityClose(HVWL, oracle.HVWL, 1e-12, 'HVWL');
      expectParityClose(HVMAP, oracle.HVMAP, 1e-12, 'HVMAP');
    });

    it('matches custom rainfall library helpers (tmSlug, tmParse, tmAdd, tmLoadFromStorage)', () => {
      expect(tmSlug('Trạm Mẫu #1 - Xuân Khánh')).toBe('Tram_Mau_1_Xuan_Khanh');
      const parsed = tmParse('2020 155,4\n2021;190.2\n2022\t210');
      expect(parsed).toEqual([
        [2020, 155.4],
        [2021, 190.2],
        [2022, 210],
      ]);

      expect(tmAdd('Trạm Test Cục Bộ', parsed)).toBe(true);
      expect(HVST['Trạm Test Cục Bộ'].ser).toEqual(parsed);
      expect(BUILT_IN_HVST_NAMES.has('Trạm Test Cục Bộ')).toBe(false);
      // Verify custom station loads cleanly from clean-room storage key
      tmLoadFromStorage();
      expect(HVST['Trạm Test Cục Bộ']?.ser.length).toBe(3);
      // Cleanup so subsequent station DB comparisons remain deterministic
      delete HVST['Trạm Test Cục Bộ'];
    });

    it('matches hvTMinv, hvRegAt and hvRegAuto across Thanh Hoa stations within 1e-9', () => {
      const checkStations = ['Bái Thượng', 'Như Xuân', 'Tĩnh Gia', 'Hồi Xuân', 'Sầm Sơn'];
      for (const nm of checkStations) {
        const st = HVSTL.find((x) => x.n === nm)!;
        expect(st).toBeDefined();

        const [lonTs, latTs] = hvTMinv(st.E, st.N, 105);
        const [lonOr, latOr] = oracle.hvTMinv(st.E, st.N, 105);
        expectParityClose([lonTs, latTs], [lonOr, latOr], 1e-9, `hvTMinv(${nm})`);

        expect(hvRegAt(lonTs, latTs)).toBe(oracle.hvRegAt(lonOr, latOr));

        oracle.dollar('hv_dE').value = String(st.E);
        oracle.dollar('hv_dN').value = String(st.N);
        oracle.dollar('hv_dcs').value = 'vn';
        oracle.dollar('hv_dk0').value = '105';
        const autoTs = hvRegAuto({ E: st.E, N: st.N, dcs: 'vn', dk0: 105 });
        const autoOr = oracle.hvRegAuto();
        expectParityClose(autoTs, autoOr, 1e-9, `hvRegAuto(${nm})`);
      }

      // Coordinates far outside Thanh Hoa map return null region
      expect(hvRegAt(106.7, 10.8)).toBe(oracle.hvRegAt(106.7, 10.8));
      expect(hvRegAt(106.7, 10.8)).toBeNull();
    });

    it('matches HV statistical, TCVN 9845 rational formula, hydraulics, smallBr, csu & froeh within 1e-9', () => {
      for (const P of [0.33, 1, 2, 4, 10, 25, 50, 90]) {
        for (const Cs of [0.2, 0.8, 1.6, 2.4]) {
          expectParityClose(HV.phiP(P, Cs), oracle.HV.phiP(P, Cs), 1e-9, `phiP(${P},${Cs})`);
          expectParityClose(HV.xP(180, 0.35, Cs, P), oracle.HV.xP(180, 0.35, Cs, P), 1e-9);
        }
      }

      for (const stationName of ['Bái Thượng', 'Hồi Xuân', 'Yên Định']) {
        const ser = HVST[stationName].ser.map((a) => ({ y: a[0], x: a[1] }));
        expectParityClose(HV.stats(ser), oracle.HV.stats(ser), 1e-9, `stats(${stationName})`);
      }

      for (const cls of ['I', 'II', 'III', 'IV', 'V', 'VI']) {
        for (const F of [0.8, 12.5, 45, 88]) {
          for (const col of [null, 7, 10] as const) {
            expectParityClose(
              HV.phiA1(cls, 220, F, col),
              oracle.HV.phiA1(cls, 220, F, col),
              1e-9,
              `phiA1(${cls},${F},${col})`,
            );
          }
        }
      }

      for (const reg of ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']) {
        const tauTs = HV.tauA2(reg, 1.85);
        const tauOr = oracle.HV.tauA2(reg, 1.85);
        expectParityClose(tauTs, tauOr, 1e-9, `tauA2(${reg})`);
        expectParityClose(HV.apA3(reg, tauTs.tau, 22.5), oracle.HV.apA3(reg, tauOr.tau, 22.5), 1e-9);
      }

      const qpScenario = buildScenarioInput({
        F: '16.4',
        L: '6.8',
        sl: '1.9',
        two: '2',
        Jls: '15.2',
        Jsd: '42.0',
        msd: '0.32',
        mls: '9',
        cls: 'II',
        reg: 'II',
        fao: '3.5',
        aoPos: 't',
      });
      populateBridgeOracleDom(oracle, qpScenario.fields);
      const qpInput: HvInput = oracle.hvIn();
      expectParityClose(HV.qp(qpInput, 215), oracle.HV.qp(qpInput, 215), 1e-9, 'HV.qp(two=true)');
      const qpSingleSlope: HvInput = { ...qpInput, two: false };
      expectParityClose(
        HV.qp(qpSingleSlope, 215),
        oracle.HV.qp(qpSingleSlope, 215),
        1e-9,
        'HV.qp(two=false)',
      );

      // Free-flow and submerged small bridge checks
      expectParityClose(HV.smallBr(45, 14, 0.85, 1.2, 1.3, 1), oracle.HV.smallBr(45, 14, 0.85, 1.2, 1.3, 1), 1e-9);
      expectParityClose(HV.smallBr(125, 10, 0.85, 4.1, 1.6, 1), oracle.HV.smallBr(125, 10, 0.85, 4.1, 1.6, 1), 1e-9);

      expectParityClose(HV.csu(1.0, 1.15, 1.1, 0.9, 1.4, 5.2, 0.36), oracle.HV.csu(1.0, 1.15, 1.1, 0.9, 1.4, 5.2, 0.36), 1e-9);
      expectParityClose(HV.froeh(0.82, 0.97, 8.5, 2.8, 0.31), oracle.HV.froeh(0.82, 0.97, 8.5, 2.8, 0.31), 1e-9);
    });

    it('matches HVM.fit, qDHXD, qHT, all 17 HVM.PIER formulas and all 5 HVM.ABUT formulas within 1e-9', () => {
      const ser = HVST['Bái Thượng'].ser.map((a) => ({ y: a[0], x: a[1] }));
      const st = HV.stats(ser)!;
      expectParityClose(HVM.fit(st, 'p3'), oracle.HVM.fit(st, 'p3'), 1e-9, 'HVM.fit(p3)');
      expectParityClose(HVM.fit(st, 'km'), oracle.HVM.fit(st, 'km'), 1e-9, 'HVM.fit(km)');
      expectParityClose(HVM.kmK(2, 0.45, 1.1), oracle.HVM.kmK(2, 0.45, 1.1), 1e-9, 'HVM.kmK');

      const dhScenario = buildScenarioInput({ F: '22.0', L: '8.5', Jls: '12.0', reg: 'II', cls: 'II' });
      populateBridgeOracleDom(oracle, dhScenario.fields);
      const dhInput: HvInput = oracle.hvIn();
      expectParityClose(
        HVM.qDHXD(dhInput, 210, 0.36, 0.94),
        oracle.HVM.qDHXD(dhInput, 210, 0.36, 0.94),
        1e-9,
        'HVM.qDHXD',
      );

      const floods = [
        { y: 1995, h: 12.8, N: 1 },
        { y: 2005, h: 13.4, N: 1 },
        { y: 2017, h: 14.1, N: 1 },
      ];
      expectParityClose(
        HVM.qHT(floods, 'p3', 2.0, 0.45, 1),
        oracle.HVM.qHT(floods, 'p3', 2.0, 0.45, 1),
        1e-9,
        'HVM.qHT',
      );

      expect(HVM.PIER.length).toBe(17);
      expect(oracle.HVM.PIER.length).toBe(17);

      const pierCases: Array<{ q: HvPierScourInput; S: HvSoilProps }> = [
        {
          q: { h: 5.5, h2: 5.5, v: 2.35, b: 1.5, B1: 1.65, Kx: 1.0, L: 8.0, al: 10, nose: 'tron', chu: true },
          S: { d50: 0.65, d90: 1.4, coh: false, cty: 'C2', Ka: 1.0, Kf: 1.0 },
        },
        {
          q: { h: 6.2, h2: 6.0, v: 3.4, b: 1.8, B1: 2.4, Kx: 1.15, L: 9.0, al: 25, nose: 'vuong', chu: false },
          S: { d50: 18, d90: 42, coh: false, cty: 'C2', Ka: 1.05, Kf: 1.0 },
        },
        {
          q: { h: 4.8, h2: 4.8, v: 1.9, b: 1.3, B1: 1.3, Kx: 0.9, L: 6.5, al: 0, nose: 'nhon60', chu: true },
          S: { d50: 0.02, d90: 0.05, coh: true, cty: 'C2', Ka: 1.0, Kf: 1.0 },
        },
      ];

      for (let cIdx = 0; cIdx < pierCases.length; cIdx++) {
        const { q, S } = pierCases[cIdx];
        for (let i = 0; i < HVM.PIER.length; i++) {
          const tsFormula = HVM.PIER[i];
          const orFormula = oracle.HVM.PIER[i];
          expect(tsFormula.k).toBe(orFormula.k);
          expectParityClose(
            tsFormula.f(q, S),
            orFormula.f(q, S),
            1e-9,
            `HVM.PIER[${i}:${tsFormula.k}]#case${cIdx}`,
          );
        }
      }

      expect(HVM.ABUT.length).toBe(5);
      expect(oracle.HVM.ABUT.length).toBe(5);
      const abutIn: HvAbutScourInput = { Lp: 14.0, ya: 2.6, Vc: 2.1, Fr: 0.42, h1: 2.8, al: 15, v: 2.0 };
      const abutSoil: HvAbutSoilProps = {
        d50: 12,
        d90: 30,
        coh: false,
        cty: 'C2',
        Ka: 1.0,
        Kf: 1.0,
        abut: 'canh',
        abn: 'non',
        tha: 75,
        mta: 1.5,
        chu: false,
      };
      for (let i = 0; i < HVM.ABUT.length; i++) {
        expect(HVM.ABUT[i].k).toBe(oracle.HVM.ABUT[i].k);
        expectParityClose(
          HVM.ABUT[i].f(abutIn, abutSoil),
          oracle.HVM.ABUT[i].f(abutIn, abutSoil),
          1e-9,
          `HVM.ABUT[${i}:${HVM.ABUT[i].k}]`,
        );
      }
    }, 30000);
  });

  // ==========================================================================
  // 2. Bridge Hydrology (`hvCalc`, `hvScour`, `hvSecTrim`, `hvPoly2`)
  // ==========================================================================
  describe('2. Bridge Hydrology Full Solver & Contract Parity', () => {
    it('matches hvSecTrim and hvPoly2 identically vs oracle', () => {
      const rawSec: Point2D[] = [
        [0, 19.5],
        [10, 15.2],
        [20, 12.1],
        [30, 8.8],
        [45, 8.1],
        [60, 8.9],
        [72, 12.5],
        [85, 16.0],
        [100, 20.1],
      ];
      const trimArgs = { rng: [12, 82], lv: [13.5, 11.2], x1: 22, x2: 70 };
      expectParityClose(
        hvSecTrim(rawSec, trimArgs),
        oracle.hvSecTrim(rawSec, trimArgs),
        1e-9,
        'hvSecTrim(rng)',
      );
      expectParityClose(
        hvSecTrim(rawSec, { rng: null, lv: [12.0], x1: 25, x2: 68 }),
        oracle.hvSecTrim(rawSec, { rng: null, lv: [12.0], x1: 25, x2: 68 }),
        1e-9,
        'hvSecTrim(auto)',
      );

      const hqPts: Point2D[] = [
        [40, 10.2],
        [85, 11.1],
        [140, 11.9],
        [220, 12.8],
        [310, 13.6],
      ];
      expectParityClose(hvPoly2(hqPts), oracle.hvPoly2(hqPts), 1e-9, 'hvPoly2');
    });

    it('matches hvCalc, hvScour and toBridgeHydrologyResult across 3 distinct bridge scenarios within 1e-9', () => {
      // Scenario A: TCVN 9845 + Bai Thuong P3 Fit + Non-cohesive bed + Beloli + Construction WL
      const scA = buildScenarioInput({
        P: 'auto',
        capd: '12',
        F: '18.5',
        L: '7.2',
        qm: 'tcvn',
        rd: 'p3',
        rm: 'fit',
        km: 'bel',
        zm: 's1',
        xm: 'lis',
        pm: 'dhxd',
        am: 'tdn',
        wlst: 'Giàng',
        wlser: '2015 320\n2016 410\n2017 485\n2018 390\n2019 450\n2020 510',
        wlday: '250 10\n310 5\n370 2',
      });
      const orA = scA.runOracle();
      const tsA = hvCalc(orA.I);

      expectParityClose(tsA.Q, orA.Q, 1e-9, 'scenarioA.Q');
      expectParityClose(tsA.H, orA.H, 1e-9, 'scenarioA.H');
      expectParityClose(tsA.K, orA.K, 1e-9, 'scenarioA.K');
      expectParityClose(tsA.Z, orA.Z, 1e-9, 'scenarioA.Z');
      expectParityClose(tsA.X, orA.X, 1e-9, 'scenarioA.X');
      expectParityClose(tsA.W, orA.W, 1e-9, 'scenarioA.W');
      expectParityClose(tsA.Htk, orA.Htk, 1e-9, 'scenarioA.Htk');
      expectParityClose(tsA.Hd, orA.Hd, 1e-9, 'scenarioA.Hd');

      const resA: HydrologyResult = toBridgeHydrologyResult(tsA);
      expect(resA.mode).toBe('bridge');
      expect(resA.station).toBe('Bái Thượng');
      expect(resA.qsrc).toBe('rain');
      expect(resA.Q[tsA.Pd].Q).toBeCloseTo(tsA.Q[tsA.Pd].Q, 9);
      expect(resA.scour?.piers.length).toBe(2);
      expect(resA.scour?.abut.length).toBe(2);

      // Scenario B: Small bridge (km: 'nho', qm: 'dhxd', rd: 'km', rm: 'mom', cohesive clay bed)
      const scB = buildScenarioInput({
        P: '4',
        F: '3.2',
        L: '2.4',
        sl: '0.4',
        two: '1',
        xA1: '33',
        xA2: '49',
        piers: '',
        qm: 'dhxd',
        rd: 'km',
        rm: 'mom',
        km: 'nho',
        coh: '1',
        cty: 'C2',
        d50: '0.02',
        d90: '0.05',
      });
      const orB = scB.runOracle();
      const tsB = hvCalc(orB.I);
      expectParityClose(tsB.Q, orB.Q, 1e-9, 'scenarioB.Q');
      expectParityClose(tsB.H, orB.H, 1e-9, 'scenarioB.H');
      expectParityClose(tsB.K, orB.K, 1e-9, 'scenarioB.K');
      expectParityClose(tsB.Z, orB.Z, 1e-9, 'scenarioB.Z');
      expectParityClose(tsB.X, orB.X, 1e-9, 'scenarioB.X');

      const resB = toBridgeHydrologyResult(tsB);
      expect(resB.qsrc).toBe('dhxd');
      expect(resB.Q[tsB.Pd].Q).toBeCloseTo(tsB.Q[tsB.Pd].Q, 9);

      // Scenario C: Direct flood series ('tl') + skew angle 15° + 'bai' opening + 'b41' contraction + 's2' backwater
      const scC = buildScenarioInput({
        qsrc: 'tl',
        qtl: '1 310\n2 255\n4 205\n10 155',
        km: 'kas',
        bctm: 'bai',
        mum: 'b41',
        v0m: 'tm',
        zm: 's2',
        th: '15',
        Pt: 'hs',
      });
      const orC = scC.runOracle();
      const tsC = hvCalc(orC.I);
      expectParityClose(tsC.Q, orC.Q, 1e-9, 'scenarioC.Q');
      expectParityClose(tsC.K, orC.K, 1e-9, 'scenarioC.K');
      expectParityClose(tsC.Z, orC.Z, 1e-9, 'scenarioC.Z');
      expectParityClose(tsC.X, orC.X, 1e-9, 'scenarioC.X');

      // Direct hvScour call parity at P = Px (design scour return period)
      const scourTs = hvScour(tsC, tsC.I, tsC.S, tsC.Px);
      const scourOr = oracle.hvScour(orC, orC.I, orC.S, orC.Px);
      expectParityClose(scourTs, scourOr, 1e-9, 'hvScour(Px)');

      const resC = toBridgeHydrologyResult(tsC);
      expect(resC.qsrc).toBe('tl');
    });
  });

  // ==========================================================================
  // 3. Culvert Hydrology (`TVC_Q`, `tvcCalc`, `tvcStep`, `tvxContours`)
  // ==========================================================================
  describe('3. Culvert Hydrology & Contours Parity', () => {
    it('matches tvcSize, tvcHV and tvcHp across station, series and manual modes within 1e-9', () => {
      for (const typ of ['tron', 'hop'] as const) {
        for (const d of ['50', '75', '100', '125', '150', '200']) {
          if (typ === 'hop' && Number(d) < 100) continue;
          expectParityClose(tvcSize(typ, d), oracle.tvcSize(typ, d), 1e-12, `tvcSize(${typ},${d})`);
        }
      }

      for (const [typ, key, q] of [
        ['tron', '100', 1.45],
        ['tron', '150', 4.1],
        ['tron', '75', 0.1], // below lower bound
        ['tron', '100', 12.0], // above max
        ['hop', '200', 4.6],
      ] as const) {
        expectParityClose(tvcHV(typ, key, q), oracle.tvcHV(typ, key, q), 1e-9, `tvcHV(${typ},${key},${q})`);
      }

      // Station lookup
      oracle.dollar('tvc_hps').value = 'tram';
      oracle.dollar('tvc_st').value = '12';
      expectParityClose(
        tvcHp(2, { hps: 'tram', st: 12 }),
        oracle.tvcHp(2),
        1e-9,
        'tvcHp(tram)',
      );

      // Rainfall series + P3 fit
      const rainText = HVST['Như Xuân'].ser.map((a) => `${a[0]} ${a[1]}`).join('\n');
      oracle.dollar('tvc_hps').value = 'ser';
      oracle.dollar('tvc_st2').value = 'Như Xuân';
      oracle.dollar('tvc_rain').value = rainText;
      oracle.dollar('tvc_rm').value = 'fit';
      oracle.dollar('tvc_rd').value = 'p3';
      expectParityClose(
        tvcHp(1, { hps: 'ser', st2: 'Như Xuân', rain: rainText, rm: 'fit', rd: 'p3' }),
        oracle.tvcHp(1),
        1e-9,
        'tvcHp(ser)',
      );
    }, 30000);

    it('matches tvcCalc, tvcStep and toCulvertHydrologyResult across pipe, multi-cell box and slab culverts', () => {
      const sampleRows = [
        {
          km: 'Km1+100',
          name: 'C1',
          F: '0.85',
          L: '1.35',
          sl: '0.20',
          Jls: '18.5',
          Jsd: '55',
          two: '2',
          typ: 'tron',
          d: '125',
          n: '1',
          zd: '12.40',
          zr: '14.90',
        },
        {
          km: 'Km1+850',
          name: 'C2',
          F: '3.20',
          L: '2.80',
          sl: '0.60',
          Jls: '11.2',
          Jsd: '38',
          two: '2',
          typ: 'hop',
          d: '200',
          h: '200',
          n: '2',
          zd: '10.10',
          zr: '13.50',
        },
        {
          km: 'Km2+400',
          name: 'C3',
          F: '5.40',
          L: '3.60',
          sl: '0.90',
          Jls: '9.8',
          Jsd: '32',
          two: '2',
          typ: 'ban',
          d: '300',
          h: '250',
          n: '1',
          zd: '8.50',
          i: '0.015',
          zr: '12.20',
        },
      ];

      oracle.dollar('tab70').id = 'tab70';
      oracle.dollar('tvc_P').value = '2';
      oracle.dollar('tvc_hps').value = 'tay';
      oracle.dollar('tvc_Hp').value = '265';
      oracle.dollar('tvc_reg').value = 'II';
      oracle.dollar('tvc_cls').value = 'III';
      oracle.dollar('tvc_msd').value = '0.32';
      oracle.dollar('tvc_mls').value = '9';
      oracle.dollar('tvc_fao').value = '1.0';
      oracle.dollar('tvc_aoPos').value = 'h';
      oracle.dollar('tvc_kgc').value = '3';
      oracle.dollar('tvc_phi').value = '0.95';
      oracle.dollar('tvc_nc').value = '0.013';
      oracle.dollar('tvc_xoi').value = '1';
      oracle.dollar('tvc_hd').value = '0.5';
      oracle.dollar('tvc_rows').value = JSON.stringify(sampleRows);

      const orRes = oracle.tvcCalc();
      const tsRes = tvcCalc({
        P: 2,
        Hp: 265,
        reg: 'II',
        cls: 'III',
        msd: 0.32,
        mls: 9,
        fao: 1.0,
        aoPos: 'h',
        kgc: 3,
        phi: 0.95,
        nc: 0.013,
        xoi: true,
        hd: 0.5,
        rows: sampleRows,
      });

      expectParityClose(tsRes.C.Hp, orRes.C.Hp, 1e-9, 'tvc.C.Hp');
      expectParityClose(tsRes.out, orRes.out, 1e-9, 'tvc.out');

      // Exercise tvcStep headless/context workflow + toCulvertHydrologyResult
      setContextStore({
        tab70: '1',
        tvc_P: '2',
        tvc_hps: 'tay',
        tvc_Hp: '265',
        tvc_reg: 'II',
        tvc_cls: 'III',
        tvc_msd: '0.32',
        tvc_mls: '9',
        tvc_fao: '1.0',
        tvc_aoPos: 'h',
        tvc_kgc: '3',
        tvc_phi: '0.95',
        tvc_nc: '0.013',
        tvc_xoi: '1',
        tvc_hd: '0.5',
        tvc_rows: JSON.stringify(sampleRows),
      });
      setLatestTvcResult(null);
      oracle.tvcStep();
      const stepRes = tvcStep();
      expect(stepRes).toBeDefined();
      expect(getLatestTvcResult()).toBe(stepRes);
      expectParityClose(stepRes!.out, oracle.getJsTVCR()!.out, 1e-9, 'tvcStep.out');

      const culvContract = toCulvertHydrologyResult(stepRes);
      expect(culvContract.mode).toBe('culvert');
      expect(culvContract.P).toBe(2);
      expect(culvContract.Q[2].Q).toBeCloseTo(stepRes!.out[0].Q!, 9);
      expect(culvContract.culvertSizing?.length).toBe(3);
      expect(culvContract.culvertSizing?.[1].nBarrels).toBe(2);
      expect(culvContract.culvertSizing?.[2].kind).toBe('ban');
    });

    it('matches tvxContours marching squares intervals and segment geometry vs 17_culvert_hydrology tvcMap', () => {
      // Test relief ranges covering ci = 5 (rel <= 150), ci = 20 (400 < rel <= 800), ci = 50 (rel > 800)
      const makeGrid = (zMax: number): TvxDemGrid => {
        const nx = 8;
        const ny = 7;
        const z: number[] = [];
        for (let r = 0; r < ny; r++) {
          for (let c = 0; c < nx; c++) {
            const tx = c / (nx - 1);
            const ty = r / (ny - 1);
            z.push(15 + (zMax - 15) * (0.6 * tx + 0.4 * ty + 0.1 * Math.sin(c + r)));
          }
        }
        return { nx, ny, d: 30, x0: 539000, y1: 2200000, z };
      };

      expect(tvxContours(makeGrid(120)).interval).toBe(5);
      expect(tvxContours(makeGrid(550)).interval).toBe(20);
      expect(tvxContours(makeGrid(980)).interval).toBe(50);

      // Compare exact contour path vertices against upstream tvcMap SVG output
      const dem = makeGrid(520);
      const geoObj = {
        bas: [
          {
            bnd: [
              [539000, 2199820],
              [539210, 2199820],
              [539210, 2200000],
              [539000, 2200000],
              [539000, 2199820],
            ],
            main: [
              [539050, 2199950],
              [539150, 2199860],
            ],
            out: [539150, 2199860],
            name: 'C1',
          },
        ],
        opens: [],
        kms: [],
        dem,
      };
      oracle.dollar('tvc_geo').value = JSON.stringify(geoObj);
      oracle.tvcMap();
      const svgHtml = oracle.dollar('tvc_map').innerHTML;

      const tsContours = tvxContours(dem);
      expect(tsContours.interval).toBe(20);
      expect(tsContours.segments.length).toBeGreaterThan(20);

      // Upstream tvcMap renders two <path ... stroke="#a0703c" ...> elements for minor ('n') and major ('m') contours;
      // verify matching segment counts (each segment has M x,y L x,y = 2 vertices).
      const contourPaths = [...svgHtml.matchAll(/<path d="([^"]+)" stroke="#a0703c"/g)].map((m) => m[1]);
      expect(contourPaths.length).toBe(2);
      const minorSegVertices = contourPaths[0].split('M').length - 1;
      const majorSegVertices = contourPaths[1].split('M').length - 1;
      expect(minorSegVertices * 2).toBe(tsContours.gridSegments.n.length);
      expect(majorSegVertices * 2).toBe(tsContours.gridSegments.m.length);
    });
  });

  // ==========================================================================
  // 4. Real Offline DEM Watershed (`public/dem/cop1.txt`, `cop2.txt`, `thanhhoa.txt`)
  // ==========================================================================
  describe('4. Offline Real DEM Watershed Delineation (Thanh Hoa COP & SRTM)', () => {
    it('loads cop1+cop2 & thanhhoa 100% offline (fetch blocked) and matches oracle D8 watershed <= 1e-9', async () => {
      // Guarantee zero network fetches occur anywhere inside loadBuiltinDem / runWatershed / oracle
      globalThis.fetch = (() => {
        throw new Error('Forbidden network fetch() during offline DEM test');
      }) as unknown as typeof fetch;

      await ensureOfflineDemsLoaded();

      expect(HVD.S.tiles.some((t) => t.src === 'cop')).toBe(true);
      expect(HVD.S.tiles.some((t) => t.src === 'srtm')).toBe(true);
      expect(oracle.HVD.S.tiles.some((t) => t.src === 'cop')).toBe(true);
      expect(oracle.HVD.S.tiles.some((t) => t.src === 'srtm')).toBe(true);

      // Use real Cam Thuy Thanh Hoa coordinates from HVSTL inside both DEMs
      const camThuy = HVSTL.find((s) => s.n === 'Cẩm Thủy')!;
      const runOptsBase: Omit<HvdRunOptions, 'src'> = {
        ll: false,
        lon0: 105,
        E: camThuy.E,
        N: camThuy.N,
        R: 2.5,
        thr: 0.05,
        snap: 120,
        two: true,
        mm: 'dai',
        ten: 'Suối mẫu Cẩm Thủy',
      };

      let copWatershed: Awaited<ReturnType<typeof runWatershed>> | null = null;

      for (const src of ['cop', 'srtm'] as const) {
        const opts: HvdRunOptions = { ...runOptsBase, src };
        const tsRun = await runWatershed(opts);
        const orRun = await oracle.HVD.run(opts);
        if (src === 'cop') copWatershed = tsRun;

        expect(tsRun.Fkm).toBeGreaterThan(0);
        expect(tsRun.L).toBeGreaterThan(0);
        expect(tsRun.prof.length).toBeGreaterThan(2);

        expectParityClose(tsRun.Fkm, orRun.Fkm, 1e-9, `HVD(${src}).Fkm`);
        expectParityClose(tsRun.L, orRun.L, 1e-9, `HVD(${src}).L`);
        expectParityClose(tsRun.B, orRun.B, 1e-9, `HVD(${src}).B`);
        expectParityClose(tsRun.sl, orRun.sl, 1e-9, `HVD(${src}).sl`);
        expectParityClose(tsRun.Jls, orRun.Jls, 1e-9, `HVD(${src}).Jls`);
        expectParityClose(tsRun.Jsd, orRun.Jsd, 1e-9, `HVD(${src}).Jsd`);
        expectParityClose(tsRun.zo, orRun.zo, 1e-9, `HVD(${src}).zo`);
        expectParityClose(tsRun.outVN, orRun.outVN, 1e-9, `HVD(${src}).outVN`);
        expectParityClose(tsRun.cnt, orRun.cnt, 1e-9, `HVD(${src}).cnt`);
        expectParityClose(tsRun.cA, orRun.cA, 1e-9, `HVD(${src}).cA`);
        expectParityClose(tsRun.bnd, orRun.bnd, 1e-9, `HVD(${src}).bnd`);
        expectParityClose(tsRun.mainP, orRun.mainP, 1e-9, `HVD(${src}).mainP`);
        expectParityClose(tsRun.prof, orRun.prof, 1e-9, `HVD(${src}).prof`);

        const contract = toDemWatershedResult(tsRun);
        expect(contract.src).toBe(src);
        expect(contract.Fkm).toBe(tsRun.Fkm);

        // DXF figure export parity
        const tsDxf = hdDxfFig(tsRun);
        const orDxf = oracle.hdDxfFig(orRun);
        expect(tsDxf).toContain('SECTION');
        expect(tsDxf).toContain('EOF');
        expect(tsDxf).toBe(orDxf);
      }

      // Culvert batch DEM extraction (tvxRun) on offline COP DEM vs oracle.tvxRun
      expect(copWatershed).not.toBeNull();
      const bndPts = copWatershed!.bnd;
      const closedBnd =
        bndPts[0][0] === bndPts[bndPts.length - 1][0] && bndPts[0][1] === bndPts[bndPts.length - 1][1]
          ? bndPts
          : [...bndPts, bndPts[0]];
      const [outX, outY] = copWatershed!.outVN;
      const basinDxf = [
        '0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1021', '0', 'ENDSEC',
        '0', 'SECTION', '2', 'ENTITIES',
        '0', 'LWPOLYLINE', '8', 'LuuVuc', '90', String(closedBnd.length), '70', '1',
        ...closedBnd.flatMap(([px, py]) => ['10', px.toFixed(3), '20', py.toFixed(3)]),
        '0', 'CIRCLE', '8', 'Cong', '10', outX.toFixed(3), '20', outY.toFixed(3), '40', '8',
        '0', 'TEXT', '8', 'LyTrinh', '10', (outX + 15).toFixed(3), '20', (outY - 5).toFixed(3), '1', 'Km1+250',
        '0', 'ENDSEC', '0', 'EOF',
      ].join('\r\n');

      const dxfBytes = new TextEncoder().encode(basinDxf);
      await oracle.tvxFile({
        name: 'culvert_cam_thuy.dxf',
        arrayBuffer: async () => toArrayBufferCopy(dxfBytes),
      });
      oracle.dollar('tvc_dxly').value = '*';
      oracle.dollar('tvc_k0').value = '105';
      oracle.dollar('tvc_dsrc').value = 'cop';
      oracle.dollar('tvc_rows').value = '[]';
      await oracle.tvxRun();
      const orTvxRows = oracle.tvcRows();

      const parsedCulv = parseCulvertDxfText(basinDxf);
      const tsTvx = await tvxRun({
        state: parsedCulv,
        layer: '*',
        lon0: 105,
        src: 'cop',
        skipDemLoad: true,
        skipUiUpdate: true,
      });

      expect(tsTvx).not.toBeNull();
      expect(tsTvx!.rows.length).toBe(1);
      expect(orTvxRows.length).toBe(1);
      expect(tsTvx!.rows[0].km).toBe(orTvxRows[0].km);
      expect(Number(tsTvx!.rows[0].F)).toBeGreaterThan(0);
      expect(Number(tsTvx!.rows[0].L)).toBeGreaterThan(0);
      expect(Number(tsTvx!.rows[0].Jls)).toBeGreaterThan(0);
      expect(Number(tsTvx!.rows[0].Jsd)).toBeGreaterThan(0);
      expect(Number(tsTvx!.rows[0].F)).toBeCloseTo(Number(orTvxRows[0].F), 9);
      expect(Number(tsTvx!.rows[0].L)).toBeCloseTo(Number(orTvxRows[0].L), 9);
      expect(Number(tsTvx!.rows[0].Jls)).toBeCloseTo(Number(orTvxRows[0].Jls), 9);
      expect(Number(tsTvx!.rows[0].Jsd)).toBeCloseTo(Number(orTvxRows[0].Jsd), 9);
    }, 30000);
  });

  // ==========================================================================
  // 5. DXF Parser (`dxfParser.ts`)
  // ==========================================================================
  describe('5. DXF Parser Parity (ASCII, TCVN3, Bridge Profile & Culvert Extraction)', () => {
    it('matches TCV3 decoding and helper utilities identically vs module 16 & 17 oracle', () => {
      expectParityClose(TCV3, oracle.TCV3, 0, 'TCV3');

      const sampleTcvn3 = 'M·t c¾t ngang s«ng Chu t¹i Km1+250\\PCao ®é tù nhiªn';
      expect(hasTcvn3Bytes(sampleTcvn3)).toBe(true);
      expect(dxsTxt(sampleTcvn3)).toBe(oracle.dxsTxt(sampleTcvn3));

      expect(dxsKm('KM1+250.5')).toBe(1250.5);
      expect(dxsKmF(1250.5)).toBe('Km1+250.50');
      expect(dxsPairs('0 12.5\n25 10.1\n50;14.2')).toEqual([
        [0, 12.5],
        [25, 10.1],
        [50, 14.2],
      ]);

      expect(tvxKm('Km 3 + 045,50')).toEqual(oracle.tvxKm('Km 3 + 045,50'));
      const sq: Point2D[] = [
        [0, 0],
        [100, 0],
        [100, 50],
        [0, 50],
        [0, 0],
      ];
      expect(tvxArea(sq)).toBeCloseTo(oracle.tvxArea(sq), 9);
      expect(tvxIn(sq, 50, 25)).toBe(oracle.tvxIn(sq, 50, 25));
      expect(tvxIn(sq, 150, 25)).toBe(oracle.tvxIn(sq, 150, 25));
      expect(tvxLen(sq)).toBeCloseTo(oracle.tvxLen(sq), 9);
      expect(tvxGap(sq)).toBeCloseTo(oracle.tvxGap(sq), 9);
      expect(tvxDseg([50, 10], [0, 0], [100, 0])).toBeCloseTo(oracle.tvxDseg([50, 10], [0, 0], [100, 0]), 9);
      expect(tvxDpoly(sq, [110, 25])).toBeCloseTo(oracle.tvxDpoly(sq, [110, 25]), 9);
    });

    it('matches dxsParse, dxsFind, dxsBridge & analyzeBridgeDxfBuffer on realistic bridge DXF', () => {
      // Build a bridge profile + cross-section ASCII DXF covering POLYLINE/VERTEX/SEQEND, LWPOLYLINE, LINE, TEXT
      const xVals = [0, 20, 40, 55, 70, 90, 110];
      const zVals = [18.5, 14.2, 10.5, 8.2, 10.8, 14.5, 18.8];
      const scaleX = 2; // 2 drawing units per meter
      const scaleZ = 5; // 5 drawing units per meter
      const dxfX0 = 100;
      const dxfY0 = 200; // datum z=0 at y=200

      const entities: string[] = [];
      const addLine = (x1: number, y1: number, x2: number, y2: number, ly = '0') => {
        entities.push(
          '0', 'LINE', '8', ly,
          '10', String(x1), '20', String(y1),
          '11', String(x2), '21', String(y2),
        );
      };
      const addText = (x: number, y: number, s: string, ly = 'TEXT', rot = 0, centered = false) => {
        if (centered) {
          entities.push(
            '0', 'TEXT', '8', ly,
            '10', String(x), '20', String(y),
            '11', String(x), '21', String(y),
            '40', '2.5', '50', String(rot), '72', '1', '73', '2', '1', s,
          );
        } else {
          entities.push(
            '0', 'TEXT', '8', ly,
            '10', String(x), '20', String(y),
            '40', '2.5', '50', String(rot), '1', s,
          );
        }
      };

      // Profile table frame: outer box & horizontal band lines between y=100..180, width x=70..330
      const tbX0 = 70;
      const tbX1 = dxfX0 + 110 * scaleX + 10;
      addLine(tbX0, 180, tbX1, 180, 'FRAME');
      addLine(tbX0, 160, tbX1, 160, 'FRAME');
      addLine(tbX0, 140, tbX1, 140, 'FRAME');
      addLine(tbX0, 120, tbX1, 120, 'FRAME');
      addLine(tbX0, 100, tbX1, 100, 'FRAME');
      addLine(tbX0, 100, tbX0, 180, 'FRAME');
      addLine(dxfX0, 100, dxfX0, 180, 'FRAME');
      addLine(tbX1, 100, tbX1, 180, 'FRAME');

      // Row titles on left
      addText(tbX0 + 5, 168, 'Cao độ tự nhiên', 'FRAME');
      addText(tbX0 + 5, 148, 'Cự ly lẻ', 'FRAME');
      addText(tbX0 + 5, 128, 'Lý trình', 'FRAME');

      // Ground polyline via POLYLINE + VERTEX + SEQEND
      entities.push('0', 'POLYLINE', '8', 'DIA_HINH', '66', '1', '70', '0');
      for (let i = 0; i < xVals.length; i++) {
        entities.push(
          '0', 'VERTEX', '8', 'DIA_HINH',
          '10', String(dxfX0 + xVals[i] * scaleX),
          '20', String(dxfY0 + zVals[i] * scaleZ),
        );
      }
      entities.push('0', 'SEQEND');

      // Station numbers in elevation & distance & chainage rows (middle-center aligned on station x)
      for (let i = 0; i < xVals.length; i++) {
        const px = dxfX0 + xVals[i] * scaleX;
        addText(px, 168, zVals[i].toFixed(2), 'TEXT', 90, true);
        if (i > 0) {
          const dSeg = xVals[i] - xVals[i - 1];
          addText(px - (dSeg * scaleX) / 2, 148, String(dSeg), 'TEXT', 0, true);
        }
        addText(px, 128, `Km0+${xVals[i].toFixed(2).padStart(6, '0')}`, 'TEXT', 90, true);
      }

      // Bridge abutment & pier vertical legs + water level labels
      const xA1 = dxfX0 + 25 * scaleX;
      const xA2 = dxfX0 + 85 * scaleX;
      const xPierCenter = dxfX0 + 55 * scaleX;
      addLine(xA1, dxfY0 + 13 * scaleZ, xA1, dxfY0 + 19 * scaleZ, 'CAU');
      addLine(xA2, dxfY0 + 13 * scaleZ, xA2, dxfY0 + 19 * scaleZ, 'CAU');
      // Pier spacing 1.6 DXF units satisfies clustering <= 2.0 and pier width >= 0.5 (1.6 / scaleX = 0.8 m)
      addLine(xPierCenter - 0.8, dxfY0 + 8.0 * scaleZ, xPierCenter - 0.8, dxfY0 + 18.5 * scaleZ, 'CAU');
      addLine(xPierCenter + 0.8, dxfY0 + 8.0 * scaleZ, xPierCenter + 0.8, dxfY0 + 18.5 * scaleZ, 'CAU');
      addText(xPierCenter, dxfY0 + 15.2 * scaleZ, 'MNTK: +15.20', 'MN');
      addText(xPierCenter, dxfY0 + 13.8 * scaleZ, 'MNHT: +13.80', 'MN');

      const dxfText = [
        '0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1021', '0', 'ENDSEC',
        '0', 'SECTION', '2', 'ENTITIES',
        ...entities,
        '0', 'ENDSEC', '0', 'EOF',
      ].join('\r\n');

      const decoded = decodeDxfBuffer(new TextEncoder().encode(dxfText));
      expect(decoded.acadVersion).toBe('AC1021');
      expect(decoded.isBinary).toBe(false);

      const tsT = dxsParse(dxfText);
      const orT = oracle.dxsParse(dxfText);
      expectParityClose(tsT.length, orT.length, 0, 'dxsParse.texts.length');
      expectParityClose(tsT.S.length, orT.S.length, 0, 'dxsParse.polylines.length');
      expectParityClose(tsT.S, orT.S, 1e-9, 'dxsParse.S');

      const tsBands = dxsFind(tsT);
      const orBands = oracle.dxsFind(orT);
      expect(tsBands.length).toBeGreaterThanOrEqual(1);
      expect(tsBands.length).toBe(orBands.length);
      expectParityClose(tsBands[0].pts, orBands[0].pts, 1e-9, 'dxsFind[0].pts');
      expect(tsBands[0].pts.length).toBe(xVals.length);

      const tsBridge = dxsBridge(tsT, tsT.S, tsBands[0]);
      const orBridge = oracle.dxsBridge(orT, orT.S, orBands[0]);
      expect(tsBridge).not.toBeNull();
      expect(orBridge).not.toBeNull();
      expectParityClose(tsBridge!.xA1, orBridge!.xA1, 1e-9, 'dxsBridge.xA1');
      expectParityClose(tsBridge!.xA2, orBridge!.xA2, 1e-9, 'dxsBridge.xA2');
      expectParityClose(tsBridge!.piers, orBridge!.piers, 1e-9, 'dxsBridge.piers');
      expectParityClose(tsBridge!.mnAll, orBridge!.mnAll, 1e-9, 'dxsBridge.mnAll');

      const analyzed = analyzeBridgeDxfBuffer(new TextEncoder().encode(dxfText), 0);
      expect(analyzed.error).toBeUndefined();
      expect(analyzed.result.section?.points.length).toBe(xVals.length);
      expect(analyzed.result.bridge?.xA1).toBeCloseTo(25, 6);
      expect(analyzed.result.bridge?.xA2).toBeCloseTo(85, 6);
      expect(analyzed.result.bridge?.piers.length).toBe(1);
    });

    it('matches parseCulvertDxfText identically vs module 17 tvxFile oracle', async () => {
      const culvDxf = [
        '0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1021', '0', 'ENDSEC',
        '0', 'SECTION', '2', 'ENTITIES',
        // Closed catchment on "LuuVuc" layer
        '0', 'LWPOLYLINE', '8', 'LuuVuc', '90', '4', '70', '1',
        '10', '0', '20', '0',
        '10', '400', '20', '0',
        '10', '400', '20', '300',
        '10', '0', '20', '300',
        // Open centerline route (from x=-100 to x=500)
        '0', 'LWPOLYLINE', '8', 'TimTuyen', '90', '2', '70', '0',
        '10', '-100', '20', '10',
        '10', '500', '20', '10',
        // Stream polyline mostly inside basin
        '0', 'LWPOLYLINE', '8', 'Suoi', '90', '2', '70', '0',
        '10', '200', '20', '260',
        '10', '200', '20', '10',
        // Markers
        '0', 'CIRCLE', '8', 'Diem', '10', '-100', '20', '10', '40', '5',
        '0', 'CIRCLE', '8', 'Diem', '10', '500', '20', '10', '40', '5',
        '0', 'CIRCLE', '8', 'Cong', '10', '200', '20', '10', '40', '6',
        // Labels
        '0', 'TEXT', '8', 'TEXT', '10', '-100', '20', '15', '1', 'Đầu tuyến Km0+000',
        '0', 'TEXT', '8', 'TEXT', '10', '500', '20', '15', '1', 'Cuối tuyến Km0+600',
        '0', 'TEXT', '8', 'TEXT', '10', '205', '20', '20', '1', 'Km0+300',
        '0', 'TEXT', '8', 'TEXT', '10', '150', '20', '150', '1', 'F = 0,12 km2',
        '0', 'ENDSEC', '0', 'EOF',
      ].join('\r\n');

      await oracle.tvxFile({
        name: 'culvert_plan.dxf',
        arrayBuffer: async () => toArrayBufferCopy(new TextEncoder().encode(culvDxf)),
      });
      const tsParsed = parseCulvertDxfText(culvDxf);

      expect(tsParsed.bas.length).toBe(1);
      expect(tsParsed.autoLayer).toBe('LuuVuc');
      expectParityClose(tsParsed.bas[0].A, 120000, 1e-9);
      expectParityClose(tsParsed.bas, oracle.TVX.bas, 1e-9, 'TVX.bas');
      expectParityClose(tsParsed.kms, oracle.TVX.kms, 1e-9, 'TVX.kms');
      expectParityClose(tsParsed.FL, oracle.TVX.FL, 1e-9, 'TVX.FL');
      expectParityClose(tsParsed.dots, oracle.TVX.dots, 1e-9, 'TVX.dots');
      expectParityClose(tsParsed.tim, oracle.TVX.tim, 1e-9, 'TVX.tim');
      expectParityClose(tsParsed.E0, oracle.TVX.E0, 1e-9, 'TVX.E0');
      expectParityClose(tsParsed.E1, oracle.TVX.E1, 1e-9, 'TVX.E1');
    });
  });

  // ==========================================================================
  // 6. OCR Pipeline Helpers (`ocrPipeline.ts`)
  // ==========================================================================
  describe('6. OCR Pipeline Helpers & Offline Vendor Asset Configuration', () => {
    it('configures Tesseract offline asset paths strictly under local /vendor/... with zero CDN URLs', () => {
      const opts = getOfflineTesseractOptions();
      expect(opts.workerPath).toBe('/vendor/tesseract/worker.min.js');
      expect(opts.corePath).toBe('/vendor/tesseract-core');
      expect(opts.langPath).toBe('/vendor/tesseract-data/4.0.0_best_int');

      for (const pathVal of [opts.workerPath ?? '', opts.corePath ?? '', opts.langPath ?? '']) {
        expect(pathVal).toBeTruthy();
        expect(pathVal).not.toMatch(/https?:\/\//i);
        expect(pathVal.startsWith('/vendor/')).toBe(true);
      }

      // Check matching offline vendor files actually exist on disk in public/vendor
      expect(
        readFileSync(resolve(PUBLIC_DIR, 'vendor/tesseract/worker.min.js'), 'utf8').length,
      ).toBeGreaterThan(10000);
      expect(resolveOfflineAsset('vendor/tesseract/worker.min.js')).toBe('/vendor/tesseract/worker.min.js');
      expect(OCRCOL.hv_sec).toBe(2);
      expect(OCRCOL.hv_rain).toBe(2);
      expect(OCRCOL.hv_piers).toBe(3);
    });

    it('matches ocrNums vs module 16 oracle and verifies repairMissingDecimals, otsuThreshold & stripTableLines', () => {
      const numberLines = [
        '1998  184,50   —12,4',
        '2005; 210.75 – 3,20',
        '102,4  98,0  150,25',
        'text without numbers',
        '25,5  -4,25',
      ];
      for (const line of numberLines) {
        expect(ocrNums(line)).toEqual(oracle.ocrNums(line));
      }

      const repaired = repairMissingDecimals([
        ['0.00', '12.34'],
        ['25.00', '1256'],
        ['50.00', '13.10'],
        ['75.00', '1405'],
      ]);
      expect(repaired).toEqual([
        ['0.00', '12.34'],
        ['25.00', '12.56'],
        ['50.00', '13.10'],
        ['75.00', '14.05'],
      ]);

      // Bimodal grayscale buffer -> Otsu threshold should sit strictly between dark text (25) and white paper (230)
      const gray = new Uint8Array(1000);
      for (let i = 0; i < 1000; i++) gray[i] = i < 200 ? 25 : 230;
      const th = otsuThreshold(gray);
      expect(th).toBeGreaterThanOrEqual(25);
      expect(th).toBeLessThan(230);

      // Horizontal & vertical table grid lines should be stripped (`2`) while short digit glyphs (`1`) stay intact
      const W = 120;
      const H = 60;
      const bw = new Uint8Array(W * H);
      for (let x = 5; x < 115; x++) bw[10 * W + x] = 1; // horizontal line len=110 >= max(60, 14.4)
      for (let y = 5; y < 55; y++) bw[y * W + 15] = 1; // vertical line len=50 >= max(40, 15)
      // Short digit stroke block at (40..44, 25..31)
      for (let y = 25; y <= 31; y++) {
        for (let x = 40; x <= 44; x++) bw[y * W + x] = 1;
      }
      const stripped = stripTableLines(bw, W, H);
      expect(stripped[10 * W + 50]).toBe(2);
      expect(stripped[30 * W + 15]).toBe(2);
      expect(stripped[28 * W + 42]).toBe(1);
    });

    it('extractProfileStructure detects 4-band profile grid, ticks and label boxes cleanly', () => {
      const W = 420;
      const H = 120; // W >= 3*H required
      const px = new Uint8ClampedArray(W * H * 4);
      // White background
      for (let i = 0; i < W * H; i++) {
        px[4 * i] = 255;
        px[4 * i + 1] = 255;
        px[4 * i + 2] = 255;
        px[4 * i + 3] = 255;
      }
      const setBlack = (x: number, y: number) => {
        const idx = (y * W + x) * 4;
        px[idx] = 0;
        px[idx + 1] = 0;
        px[idx + 2] = 0;
      };

      // 4 horizontal grid lines spanning x=1..400 (0.95 * W > 0.6 * W)
      const bandYs = [10, 42, 74, 106];
      for (const y of bandYs) {
        for (let x = 1; x < 400; x++) setBlack(x, y);
      }
      // Outer left border at x=1 (ignored by vf > 3), label column divider at x=90, right border at x=399
      for (const x of [1, 90, 399]) {
        for (let y = 10; y <= 106; y++) setBlack(x, y);
      }
      // Internal vertical station tick across band 1 (y=44..72) at x=210
      for (let y = 44; y <= 72; y++) setBlack(210, y);

      // Label glyph clusters in band 0 & band 1 (each label has two digit blobs so width >= chh*1.2 = 13.2px)
      for (let y = 20; y <= 30; y++) {
        for (let x = 140; x <= 146; x++) setBlack(x, y);
        for (let x = 149; x <= 155; x++) setBlack(x, y);
        for (let x = 250; x <= 256; x++) setBlack(x, y);
        for (let x = 259; x <= 265; x++) setBlack(x, y);
      }
      for (let y = 52; y <= 62; y++) {
        for (let x = 160; x <= 166; x++) setBlack(x, y);
        for (let x = 169; x <= 175; x++) setBlack(x, y);
        for (let x = 260; x <= 266; x++) setBlack(x, y);
        for (let x = 269; x <= 275; x++) setBlack(x, y);
      }

      const structure = extractProfileStructure(px, W, H);
      expect(structure).not.toBeNull();
      expect(structure!.hl.length).toBe(4);
      expect(structure!.bands.length).toBe(3);
      expect(structure!.xL).toBeGreaterThan(80);
      expect(structure!.xR).toBeGreaterThan(390);
      expect(structure!.bands[0].lbl.length).toBe(2);
      expect(structure!.bands[1].ticks.length).toBe(1);
    });
  });

  // ==========================================================================
  // 7. Strict Clean-Room & Zero-CDN Audit
  // ==========================================================================
  describe('7. Strict Clean-Room & Zero-CDN Compliance Audit', () => {
    it('contains zero external HTTP(S) URLs and zero licensing/HWID/trial identifiers across all 6 modules', () => {
      const forbiddenPattern = /https?:\/\/|license|hwid|machineId|trial|\.lic/i;

      for (const relPath of MODULE_SOURCE_FILES) {
        const fullPath = resolve(WEB_ROOT, relPath);
        const content = readFileSync(fullPath, 'utf8');
        const match = content.match(forbiddenPattern);
        expect(match, `Forbidden pattern found in ${relPath}: ${match?.[0] ?? ''}`).toBeNull();
      }
    });
  });
});
