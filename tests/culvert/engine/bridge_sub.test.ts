import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  clearContextStore,
  contextState,
  resetAllContexts,
  setContextStore,
  withCtx,
} from '../../../src/culvert/engine/context.ts';
import {
  RC,
  curve,
  rcMat,
  rcSec,
  section,
} from '../../../src/culvert/engine/math/rc.ts';
import {
  MC,
  mcocStep,
  type McCapSoilInput,
  type McPileInput,
} from '../../../src/culvert/engine/foundations/pileGroup.ts';
import { sctCheck, sctStep } from '../../../src/culvert/engine/foundations/drilledShaft.ts';
import { sfdStep, sfmStep } from '../../../src/culvert/engine/foundations/shallowFdn.ts';
import {
  MO,
  capStep,
  getLatestCapResult,
  getLatestMorResult,
  getLatestRcmResult,
  moInputs,
  moStep,
  punchStep,
  rcStep,
  setLatestCapResult,
  setLatestMorResult,
  setLatestRcmResult,
  toHeavyAbutmentResult,
  type CapComboInternalForce,
  type CapRuntimeState,
  type MoCalcResult,
  type MoGeo,
  type MoInput,
  type MoWeightItem,
  type RcMRuntimeState,
} from '../../../src/culvert/engine/bridge/abutmentHeavy.ts';
import {
  MD,
  getLatestMdCapResult,
  getLatestMdFlexResult,
  getLatestMdStmResult,
  mdCapDef,
  mdCapLoad,
  mdCapStep,
  mdFlex,
  mdFlexTxt,
  mdInputs,
  mdLLsets,
  mdPlate,
  mdSTM,
  mdSelfW,
  mdWing,
  setLatestMdCapResult,
  setLatestMdFlexResult,
  setLatestMdStmResult,
  toFlexibleAbutmentResult,
  type MdCapRuntimeState,
  type MdFlexRuntimeState,
  type MdSelfWeightParams,
  type MdStmRuntimeState,
} from '../../../src/culvert/engine/bridge/abutmentFlex.ts';
import {
  TR,
  getLatestTrCheck,
  getLatestTrConf,
  getLatestTrEq,
  getLatestTrResult,
  getLatestTrRows,
  getLatestTrSummaryOk,
  getLatestTrXy,
  setLatestTrCheck,
  setLatestTrResult,
  toFlexiblePierResult,
  trBuck,
  trCalc,
  trCheck,
  trFast,
  trGeom,
  trInputs,
  trLever,
  trLlLong,
  trLoads,
  trMat,
  trModel,
  trModelL,
  trPlacements,
  trResAt,
  trState,
  trStep,
  type TrCalcResult,
  type TrCheckResult,
  type TrInput,
} from '../../../src/culvert/engine/bridge/pierFlex.ts';
import {
  DCT,
  dcCalc,
  dcCapAA,
  dcCms,
  dcColSec,
  dcCombine,
  dcCombos,
  dcGeom,
  dcInputs,
  dcLoads,
  dcPmCap,
  dcPmCurve,
  dcPmTable,
  dcSTMb,
  dcSTMx,
  dcStep,
  getLatestDcLink,
  getLatestDcResult,
  getLatestDcSfdResult,
  setLatestDcLink,
  setLatestDcResult,
  toSolidPierResult,
  type DcCalcResult,
  type DcInput,
} from '../../../src/culvert/engine/bridge/pierSolid.ts';

interface MockEl {
  id: string;
  tagName: string;
  title: string;
  value: string;
  innerHTML: string;
  textContent: string;
  outerHTML: string;
  readOnly: boolean;
  disabled: boolean;
  hidden: boolean;
  checked: boolean;
  className: string;
  rows: MockEl[];
  style: Record<string, string>;
  dataset: Record<string, string>;
  attributes: Record<string, string>;
  options: Array<{ value: string; text?: string }>;
  children: MockEl[];
  content: { children: MockEl[] };
  previousElementSibling: MockEl | null;
  nextElementSibling: MockEl | null;
  classList: {
    add: (...cls: string[]) => void;
    remove: (...cls: string[]) => void;
    toggle: (cls: string, force?: boolean) => boolean;
    contains: (cls: string) => boolean;
  };
  addEventListener: () => void;
  removeEventListener: () => void;
  setAttribute: (k: string, val: unknown) => void;
  getAttribute: (k: string) => string | null;
  toggleAttribute: (k: string, force?: boolean) => void;
  closest: () => MockEl | null;
  querySelector: () => MockEl | null;
  querySelectorAll: () => MockEl[];
  appendChild: (child: MockEl) => MockEl;
  insertAdjacentHTML: () => void;
  after: () => void;
  remove: () => void;
  click: () => void;
  onclick: ((...args: unknown[]) => unknown) | null;
}

interface BridgeSubOracle {
  MO: typeof MO;
  moInputs: () => MoInput;
  moStep: () => void;
  rcStep: () => void;
  capStep: () => void;
  punchStep: (...args: unknown[]) => void;
  mcocStep: () => void;
  MD: typeof MD;
  mdInputs: () => ReturnType<typeof mdInputs>;
  mdSelfW: typeof mdSelfW;
  mdPlate: typeof mdPlate;
  mdWing: typeof mdWing;
  mdCapDef: typeof mdCapDef;
  mdCapLoad: typeof mdCapLoad;
  mdLLsets: typeof mdLLsets;
  mdFlex: (...args: unknown[]) => void;
  mdCapStep: () => void;
  mdSTM: () => boolean | undefined;
  TR: typeof TR;
  trInputs: () => TrInput;
  trStep: () => void;
  DCT: typeof DCT;
  dcInputs: () => DcInput;
  dcSTMx: typeof dcSTMx;
  dcSTMb: typeof dcSTMb;
  dcStep: () => void;
  getJsMOR: () => MoCalcResult | null;
  getJsRCM: () => RcMRuntimeState | null;
  getJsCAPR: () => CapRuntimeState | null;
  getJsMDFLEX: () => MdFlexRuntimeState | null;
  getJsMDCAP: () => MdCapRuntimeState | null;
  getJsTRR: () => TrCalcResult | null;
  getJsTRC: () => TrCheckResult | null;
  getJsTRROWS: () => { CD: unknown[]; DB: unknown[] } | null;
  getJsTRXY: () => Array<[number, number]> | null;
  getJsDCR: () => DcCalcResult | null;
  getJsDCLK: () => unknown;
  getJsMCR: () => unknown;
  getJsSFDR: () => unknown;
  getJsPunOK: () => boolean;
  getJsCapStmOK: () => boolean;
  getJsMdStmOK: () => boolean;
  getJsConfOK: () => Record<string, boolean>;
  getJsTrEq: () => Record<string, unknown>;
  withCtx: <T>(p: string, fn: () => T) => T;
  resetState: () => void;
  dollar: (id: string) => MockEl | null;
}

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(TEST_DIR, '../../..');
const MODULES_DIR = resolve(WEB_ROOT, '../analysis-cau-cong/modules');

const SUB_MODULE_FILES = [
  '01_boot_shims_and_sf.js',
  '02_core_utils_and_column_pm.js',
  '03_abutment_loads_and_rc.js',
  '06_retaining_wall_gravity.js',
  '08_flexible_abutment_md.js',
  '11_culverts_box_and_circular.js',
  '12_piles_geotech_mcoc_and_pm3d.js',
  '13_pier_flexible_tr.js',
  '14_pier_solid_dct_and_shallow_fdn_ui.js',
] as const;

const BRIDGE_SUB_TS_FILES = [
  'src/culvert/engine/bridge/abutmentHeavy.ts',
  'src/culvert/engine/bridge/abutmentFlex.ts',
  'src/culvert/engine/bridge/pierFlex.ts',
  'src/culvert/engine/bridge/pierSolid.ts',
] as const;

let oracle: BridgeSubOracle;
let domElements: Map<string, MockEl>;
let defaultPaneInputs: Record<string, string> = {};

function loadDefaultPaneInputs(): Record<string, string> {
  const panesRaw = readFileSync(resolve(WEB_ROOT, 'src/culvert/assets/panes.json'), 'utf8');
  const panes = JSON.parse(panesRaw) as Record<string, { html?: string }>;
  const out: Record<string, string> = {};
  const host = document.createElement('div');
  for (const item of Object.values(panes)) {
    if (!item || typeof item.html !== 'string') continue;
    host.innerHTML = item.html;
    host.querySelectorAll('input,select,textarea').forEach((node) => {
      const el = node as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      if (!el.id || el.id in out) return;
      out[el.id] =
        el instanceof HTMLInputElement && el.type === 'checkbox'
          ? el.checked
            ? '1'
            : '0'
          : el.value;
    });
  }
  host.innerHTML = '';
  return out;
}

function makeMockEl(id: string, tagName = 'INPUT'): MockEl {
  const classes = new Set<string>();
  const el: MockEl = {
    id,
    tagName,
    title: '',
    value: '',
    innerHTML: '',
    textContent: '',
    outerHTML: '',
    readOnly: false,
    disabled: false,
    hidden: false,
    checked: false,
    className: '',
    rows: [],
    style: {},
    dataset: {},
    attributes: {},
    options: [],
    children: [
      { textContent: '' } as MockEl,
      { textContent: '' } as MockEl,
      { textContent: '' } as MockEl,
    ],
    content: { children: [] },
    previousElementSibling: null,
    nextElementSibling: null,
    classList: {
      add: (...cls) => cls.forEach((c) => classes.add(c)),
      remove: (...cls) => cls.forEach((c) => classes.delete(c)),
      toggle: (cls, force) => {
        if (force === true) {
          classes.add(cls);
          return true;
        }
        if (force === false) {
          classes.delete(cls);
          return false;
        }
        if (classes.has(cls)) {
          classes.delete(cls);
          return false;
        }
        classes.add(cls);
        return true;
      },
      contains: (cls) => classes.has(cls),
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    setAttribute: (k, val) => {
      el.attributes[k] = String(val);
    },
    getAttribute: (k) => (k in el.attributes ? el.attributes[k] : null),
    toggleAttribute: (k, force) => {
      if (force === false) delete el.attributes[k];
      else el.attributes[k] = '';
    },
    closest: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    appendChild: (child) => child,
    insertAdjacentHTML: () => {},
    after: () => {},
    remove: () => {},
    click: () => {},
    onclick: null,
  };
  return el;
}

function matchMockSelector(el: MockEl, sel: string): boolean {
  const idx = sel.indexOf('[id^="');
  if (idx !== -1) {
    const start = idx + 6;
    const end = sel.indexOf('"]', start);
    if (end !== -1) {
      const prefix = sel.slice(start, end);
      if (!el.id.startsWith(prefix)) return false;
      if (sel.includes('.lnk') && !el.classList.contains('lnk')) return false;
      return true;
    }
  }
  return false;
}

function setBothStores(values: Record<string, string | number | boolean>): void {
  setContextStore(values);
  domElements.clear();
  for (const [id, raw] of Object.entries(values)) {
    const val = typeof raw === 'boolean' ? (raw ? '1' : '0') : String(raw);
    const el = makeMockEl(id, 'INPUT');
    el.value = val;
    if (typeof raw === 'boolean') el.checked = raw;
    domElements.set(id, el);
  }
}

function seedInputs(overrides: Record<string, string | number | boolean> = {}): void {
  setBothStores({ ...defaultPaneInputs, ...overrides });
}

function clearAllSolverState(): void {
  clearContextStore();
  resetAllContexts();
  domElements.clear();
  setLatestMorResult(null);
  setLatestRcmResult(null);
  setLatestCapResult(null);
  setLatestMdFlexResult(null);
  setLatestMdCapResult(null);
  setLatestMdStmResult(null);
  setLatestTrResult(null);
  setLatestTrCheck(null);
  setLatestDcResult(null);
  setLatestDcLink(null);
  oracle?.resetState();
}

function expectParityClose(
  actual: unknown,
  expected: unknown,
  tol = 1e-6,
  path = 'root',
): void {
  if (typeof expected === 'number') {
    expect(typeof actual, `${path} should be number`).toBe('number');
    const a = actual as number;
    if (Number.isNaN(expected)) {
      expect(Number.isNaN(a), `${path} expected NaN, got ${a}`).toBe(true);
      return;
    }
    if (!Number.isFinite(expected)) {
      expect(a, `${path} expected ${expected}, got ${a}`).toBe(expected);
      return;
    }
    const allowed = Math.max(tol, tol * Math.abs(expected));
    const diff = Math.abs(a - expected);
    if (diff > allowed) {
      throw new Error(
        `Numeric mismatch at ${path}: actual=${a}, expected=${expected}, diff=${diff}, allowed=${allowed}`,
      );
    }
    return;
  }
  if (typeof expected === 'function') {
    expect(typeof actual, `${path} should be function`).toBe('function');
    return;
  }
  if (expected === null || typeof expected !== 'object') {
    expect(actual, `${path}`).toBe(expected);
    return;
  }
  if (Array.isArray(expected) || ArrayBuffer.isView(expected)) {
    const expArr = Array.from(expected as ArrayLike<unknown>);
    const actArr = Array.from(actual as ArrayLike<unknown>);
    expect(actArr.length, `${path}.length`).toBe(expArr.length);
    for (let i = 0; i < expArr.length; i++) {
      expectParityClose(actArr[i], expArr[i], tol, `${path}[${i}]`);
    }
    return;
  }
  expect(actual, `${path} should be non-null object`).not.toBeNull();
  expect(typeof actual, `${path} typeof`).toBe('object');
  const expObj = expected as Record<string, unknown>;
  const actObj = actual as Record<string, unknown>;
  for (const key of Object.keys(expObj)) {
    if (typeof expObj[key] === 'function') continue;
    expectParityClose(actObj[key], expObj[key], tol, `${path}.${key}`);
  }
}

function loadBridgeSubOracle(): BridgeSubOracle {
  domElements = new Map<string, MockEl>();
  const storage = new Map<string, string>();

  const fakeLocalStorage = {
    getItem: (k: string) => (storage.has(k) ? storage.get(k)! : null),
    setItem: (k: string, val: unknown) => {
      storage.set(k, String(val));
    },
    removeItem: (k: string) => {
      storage.delete(k);
    },
    clear: () => storage.clear(),
    key: (i: number) => Array.from(storage.keys())[i] ?? null,
    get length() {
      return storage.size;
    },
  };

  const getOrCreateEl = (id: string): MockEl => {
    let el = domElements.get(id);
    if (!el) {
      el = makeMockEl(id);
      domElements.set(id, el);
    }
    return el;
  };

  const fakeDocument = {
    head: makeMockEl('__head', 'HEAD'),
    body: makeMockEl('__body', 'BODY'),
    getElementById: (id: string) => getOrCreateEl(id),
    createElement: (tag: string) => makeMockEl('__created', tag.toUpperCase()),
    querySelector: () => null,
    querySelectorAll: (sel: string) => {
      const parts = sel.split(',').map((s) => s.trim());
      const out: MockEl[] = [];
      for (const el of domElements.values()) {
        if (parts.some((p) => matchMockSelector(el, p))) out.push(el);
      }
      return out;
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  };

  const fakeWindow: Record<string, unknown> = {
    document: fakeDocument,
    localStorage: fakeLocalStorage,
    addEventListener: () => {},
    removeEventListener: () => {},
    __ckErr: [],
    __sctOK: {},
    __biOK: false,
    __matOK: {},
    __confOK: {},
    __trEq: {},
    __punOK: true,
    __capStmOK: true,
    __mdStmOK: true,
  };
  fakeWindow.window = fakeWindow;

  const sandbox: Record<string, unknown> = {
    window: fakeWindow,
    self: fakeWindow,
    document: fakeDocument,
    localStorage: fakeLocalStorage,
    console: { log: () => {}, warn: () => {}, error: () => {} },
    setTimeout: () => 0,
    clearTimeout: () => {},
    setInterval: () => 0,
    clearInterval: () => {},
    Math,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Map,
    Set,
    JSON,
    RegExp,
    Error,
    Date,
    Float64Array,
    Int32Array,
    Uint8Array,
    TextEncoder,
    parseFloat,
    parseInt,
    isFinite,
    isNaN,
    Plotly: { Plots: { resize: () => {} }, newPlot: () => {}, react: () => {} },
    MathJax: undefined,
    klDiv: () => {},
    dgKit: (id: string) => ({
      s: '',
      L: () => {},
      T: () => {},
      A: () => {},
      dimH: () => {},
      dimV: () => {},
      poly: () => {},
      _id: id,
    }),
    dgPut: () => {},
    qL: () => '',
    qT: () => '',
    qDH: () => '',
    qDV: () => '',
    qP: () => '',
    qB: () => '',
    qAr: () => '',
    qdSvg: () => {},
    fetch: () => {
      throw new Error('Blocked external fetch() inside offline bridge-sub oracle');
    },
    DAMR: null,
    objMode: () => {
      const e = fakeDocument.getElementById('tq_obj');
      return e && e.value && e.value !== 'tv' ? e.value : 'all';
    },
    objLinkOff: () => {
      const e = fakeDocument.getElementById('tq_obj');
      const m = e && e.value && e.value !== 'tv' ? e.value : 'all';
      return m === 'mo' || m === 'tru';
    },
    objOn: () => true,
    objUnlock: () => {},
    objVis: () => {},
    supK: () => fakeDocument.getElementById('sp_sup').value === 'K',
    ltnOn: () => fakeDocument.getElementById('tq_bltn').value === '1',
    ltnN: () => Math.max(1, Math.round(parseFloat(fakeDocument.getElementById('ln_n').value) || 1)),
    ltnLexp: (I: { Lt: number }) => {
      if (fakeDocument.getElementById('tq_bltn').value !== '1') return null;
      const n = Math.max(1, Math.round(parseFloat(fakeDocument.getElementById('ln_n').value) || 1));
      if (n < 2) return null;
      const g = parseFloat(fakeDocument.getElementById('ln_gap').value) || 0;
      return (n * I.Lt * 1000 + (n - 1) * g) / 2;
    },
    damStep: () => {},
    sup2Step: () => {},
    sctTitles: () => {},
    saveAll: () => {},
    run: () => {},
  };
  sandbox.globalThis = sandbox;

  const ctx = vm.createContext(sandbox);
  for (const fname of SUB_MODULE_FILES) {
    const src = readFileSync(resolve(MODULES_DIR, fname), 'utf8');
    vm.runInContext(src, ctx, { filename: fname });
  }
  fakeWindow.MathJax = undefined;
  sandbox.MathJax = undefined;

  vm.runInContext(
    `globalThis.__ORACLE__ = {
      MO,
      moInputs,
      moStep,
      rcStep,
      capStep,
      punchStep,
      mcocStep,
      MD,
      mdInputs: MD.inputs,
      mdSelfW: MD.selfW,
      mdPlate: MD.plate,
      mdWing: MD.wing,
      mdCapDef,
      mdCapLoad,
      mdLLsets,
      mdFlex,
      mdCapStep,
      mdSTM,
      TR,
      trInputs,
      trStep,
      DCT,
      dcInputs,
      dcSTMx,
      dcSTMb,
      dcStep,
      getJsMOR: () => MOR,
      getJsRCM: () => RCM,
      getJsCAPR: () => CAPR,
      getJsMDFLEX: () => MDFLEX,
      getJsMDCAP: () => MDCAP,
      getJsTRR: () => TRR,
      getJsTRC: () => TRC,
      getJsTRROWS: () => TRROWS,
      getJsTRXY: () => TRXY,
      getJsDCR: () => DCR,
      getJsDCLK: () => DCLK,
      getJsMCR: () => MCR,
      getJsSFDR: () => typeof SFD !== 'undefined' ? SFD : null,
      getJsPunOK: () => window.__punOK !== false,
      getJsCapStmOK: () => window.__capStmOK !== false,
      getJsMdStmOK: () => window.__mdStmOK !== false,
      getJsConfOK: () => window.__confOK || {},
      getJsTrEq: () => window.__trEq || {},
      withCtx,
      dollar: $,
      resetState: () => {
        IDP = '';
        for (const k of Object.keys(CTX)) delete CTX[k];
        MOR = null;
        RCM = null;
        CAPR = null;
        MDFLEX = null;
        MDCAP = null;
        TRR = null;
        TRC = null;
        TRLK = null;
        TRXY = null;
        TRROWS = null;
        TRSHOW = {};
        DCR = null;
        DCLK = null;
        SFD = null;
        SFM = null;
        SCTR = null;
        MCR = null;
        ST3 = null;
        window.__sctOK = {};
        window.__matOK = {};
        window.__confOK = {};
        window.__trEq = {};
        window.__punOK = true;
        window.__capStmOK = true;
        window.__mdStmOK = true;
        window.__biOK = false;
      },
    };`,
    ctx,
    { filename: 'bridge-sub-oracle-bridge.js' },
  );

  return ctx.__ORACLE__ as BridgeSubOracle;
}

describe('Step 5.4 Part 5 — Bridge Substructure Clean-Room Differential Parity', () => {
  beforeAll(() => {
    defaultPaneInputs = loadDefaultPaneInputs();
    oracle = loadBridgeSubOracle();
  });

  beforeEach(() => {
    clearAllSolverState();
    seedInputs();
  });

  // =========================================================================
  // 1. abutmentHeavy.ts (MO) vs modules/03_abutment_loads_and_rc.js
  // =========================================================================
  describe('1. abutmentHeavy.ts (MO) vs modules/03_abutment_loads_and_rc.js', () => {
    it('MO helper primitives (r, mL, heq, coulomb, kae, csm, trapX, trapZ) match exactly', () => {
      for (const deg of [0, 35, 80, 90, 125.5]) {
        expectParityClose(MO.r(deg), oracle.MO.r(deg), 1e-12, `MO.r(${deg})`);
      }
      for (const lanes of [1, 2, 3, 4, 6]) {
        expectParityClose(MO.mL(lanes), oracle.MO.mL(lanes), 1e-12, `MO.mL(${lanes})`);
      }
      for (const h of [0.8, 1.5, 2.25, 3.0, 4.5, 6.0, 9.0]) {
        expectParityClose(MO.heq(h), oracle.MO.heq(h), 1e-12, `MO.heq(${h})`);
      }
      for (const [phi, del, beta, theta] of [
        [35, 20, 0, 90],
        [32, 18, 10, 82],
        [28, 14, -5, 88],
      ] as const) {
        expectParityClose(
          MO.coulomb(phi, del, beta, theta),
          oracle.MO.coulomb(phi, del, beta, theta),
          1e-10,
          `MO.coulomb(${phi},${del},${beta},${theta})`,
        );
      }
      for (const [phi, del, i, bw, psi] of [
        [35, 20, 0, 0, 3.4],
        [32, 18, 10, 8, 6.0],
        [20, 15, 15, 0, 10.0],
      ] as const) {
        expectParityClose(
          MO.kae(phi, del, i, bw, psi),
          oracle.MO.kae(phi, del, i, bw, psi),
          1e-10,
          `MO.kae(${phi},${del},${i},${bw},${psi})`,
        );
      }
      for (const [A, S, soil, T] of [
        [0.12, 1.09, 3, 0.3],
        [0.32, 1.2, 3, 0.45],
        [0.15, 1.0, 2, 5.2],
      ] as const) {
        expectParityClose(
          MO.csm(A, S, soil, T),
          oracle.MO.csm(A, S, soil, T),
          1e-10,
          `MO.csm(${A},${S},${soil},${T})`,
        );
      }
      expectParityClose(MO.trapX(1.7, 1.8, 1.8), oracle.MO.trapX(1.7, 1.8, 1.8), 1e-12, 'trapX');
      expectParityClose(MO.trapX(1.9, 0.8, 0.3), oracle.MO.trapX(1.9, 0.8, 0.3), 1e-12, 'trapX_taper');
      expectParityClose(MO.trapZ(0.6, 0.3), oracle.MO.trapZ(0.6, 0.3), 1e-12, 'trapZ');
      expectParityClose(MO.trapZ(0, 0), oracle.MO.trapZ(0, 0), 1e-12, 'trapZ_zero');
    });

    it('MO.calc, MO.ext, and MO.secZ match on default pile-founded heavy abutment', () => {
      const I_ts = moInputs();
      const I_js = oracle.moInputs();
      expectParityClose(I_ts, I_js, 1e-9, 'moInputs.default');

      const R_ts = MO.calc(I_ts);
      const R_js = oracle.MO.calc(I_js);

      expectParityClose(R_ts.err, R_js.err, 1e-9, 'MO.default.err');
      expectParityClose(R_ts.geo, R_js.geo, 1e-7, 'MO.default.geo');
      expectParityClose(R_ts.W, R_js.W, 1e-7, 'MO.default.W');
      expectParityClose(R_ts.SUP, R_js.SUP, 1e-7, 'MO.default.SUP');
      expectParityClose(R_ts.LIVE, R_js.LIVE, 1e-7, 'MO.default.LIVE');
      expectParityClose(R_ts.K, R_js.K, 1e-7, 'MO.default.K');
      expectParityClose(R_ts.LSv, R_js.LSv, 1e-7, 'MO.default.LSv');
      expectParityClose(R_ts.WIND, R_js.WIND, 1e-7, 'MO.default.WIND');
      expectParityClose(R_ts.EQ, R_js.EQ, 1e-7, 'MO.default.EQ');
      expectParityClose(R_ts.FR, R_js.FR, 1e-7, 'MO.default.FR');
      expectParityClose(R_ts.TU, R_js.TU, 1e-7, 'MO.default.TU');
      expectParityClose(R_ts.CS, R_js.CS, 1e-7, 'MO.default.CS');
      expectParityClose(R_ts.eCS, R_js.eCS, 1e-10, 'MO.default.eCS');
      expectParityClose(R_ts.EV, R_js.EV, 1e-7, 'MO.default.EV');
      expectParityClose(R_ts.comb, R_js.comb, 1e-6, 'MO.default.comb');
      expectParityClose(R_ts.sec, R_js.sec, 1e-6, 'MO.default.sec');
      expectParityClose(R_ts.WG, R_js.WG, 1e-6, 'MO.default.WG');
      expectParityClose(R_ts.link, R_js.link, 1e-6, 'MO.default.link');

      MO.ext(I_ts, R_ts);
      oracle.MO.ext(I_js, R_js);
      expectParityClose(R_ts.W, R_js.W, 1e-7, 'MO.ext.W');

      for (const z of [0, 1.8, 3.5, R_ts.geo.zwt]) {
        expectParityClose(
          MO.secZ(I_ts, R_ts, z),
          oracle.MO.secZ(I_js, R_js, z),
          1e-6,
          `MO.secZ(${z})`,
        );
      }
    });

    it('MO.calc matches across sloped backfill, inclined back wall, water, Mononobe-Okabe seismic & skew', () => {
      seedInputs({
        mo_fnd: 'nong',
        mo_sa: '80',
        mo_beta: '10',
        mo_theta: '82',
        mo_EHv: '1',
        mo_Kmode: '0',
        mo_eqm: 'M',
        mo_wOn: '1',
        mo_ELw: '17.5',
        mo_Rce: '120',
        mo_WSlong: '1',
        mo_gpl: 'bang',
        mo_ixm: 'rieng',
        mo_ix: '2.5',
        mo_ixR: '1.5',
        mo_f: '0.4',
        mo_cf: '0.6',
        mo_kt: '0.8',
        mo_vt: '0.35',
        mo_unx: '0.4',
        mo_uny: '0.4',
        mo_unh: '0.3',
        mo_unn: '2',
        mo_Lqd: '4',
        tq_bltn: '0',
      });

      const I_ts = moInputs();
      const I_js = oracle.moInputs();
      expectParityClose(I_ts, I_js, 1e-9, 'moInputs.sloped');

      const R_ts = MO.calc(I_ts);
      const R_js = oracle.MO.calc(I_js);
      expectParityClose(R_ts.err, R_js.err, 1e-9, 'MO.sloped.err');
      expectParityClose(R_ts.geo, R_js.geo, 1e-7, 'MO.sloped.geo');
      expectParityClose(R_ts.K, R_js.K, 1e-7, 'MO.sloped.K');
      expectParityClose(R_ts.EQ, R_js.EQ, 1e-7, 'MO.sloped.EQ');
      expectParityClose(R_ts.comb, R_js.comb, 1e-6, 'MO.sloped.comb');
      expectParityClose(R_ts.WG, R_js.WG, 1e-6, 'MO.sloped.WG');
      expectParityClose(R_ts.link, R_js.link, 1e-6, 'MO.sloped.link');
    });

    it('moStep -> rcStep -> mcocStep -> capStep (including punchStep & STM) & toHeavyAbutmentResult match on pile abutment', () => {
      // Place 2x2 close piles so some piles lie within 2*d of stem faces (exercising cap STM + punching)
      seedInputs({
        mo_fnd: 'coc',
        tq_mot: 'nang',
        mc_src: 'mo',
        mc_xy: '-1.5 -2.0\n-1.5 2.0\n1.5 2.0\n1.5 -2.0',
      });

      const morTs = moStep();
      oracle.moStep();
      const morJs = oracle.getJsMOR();
      expect(morTs).not.toBeNull();
      expect(morJs).not.toBeNull();
      expectParityClose(morTs!.comb, morJs!.comb, 1e-6, 'moStep.comb');

      const rcmTs = rcStep();
      oracle.rcStep();
      const rcmJs = oracle.getJsRCM();
      expect(rcmJs).not.toBeNull();
      expectParityClose(rcmTs.M, rcmJs!.M, 1e-7, 'rcStep.M');
      const rcmJsOk = Object.values(rcmJs!.res).filter(Boolean).every((o) => Boolean(o?.ok));
      expect(rcmTs.ok).toBe(rcmJsOk);
      for (const k of ['cc', 'bx', 'by', 'ee', 'ff', 'gg'] as const) {
        expectParityClose(rcmTs.res[k]?.gM, rcmJs!.res[k]?.gM, 1e-6, `rcStep.${k}.gM`);
        expectParityClose(rcmTs.res[k]?.gV, rcmJs!.res[k]?.gV, 1e-6, `rcStep.${k}.gV`);
        expectParityClose(rcmTs.res[k]?.gS, rcmJs!.res[k]?.gS, 1e-6, `rcStep.${k}.gS`);
        expectParityClose(rcmTs.res[k]?.ok, rcmJs!.res[k]?.ok, 1e-6, `rcStep.${k}.ok`);
      }

      const mcrTs = mcocStep({ MOR: morTs });
      oracle.mcocStep();
      const mcrJs = oracle.getJsMCR() as { rows: unknown; U1: unknown };
      expect(mcrTs).not.toBeNull();
      expectParityClose(mcrTs!.rows, mcrJs.rows, 1e-5, 'mcocStep.rows');
      expectParityClose(mcrTs!.U1, mcrJs.U1, 1e-6, 'mcocStep.U1');

      const capTs = capStep() as CapRuntimeState;
      oracle.capStep();
      const capJs = oracle.getJsCAPR();
      expect(capTs).not.toBeNull();
      expect(capJs).not.toBeNull();
      expectParityClose(capTs.c1?.gM, capJs!.c1?.gM, 1e-6, 'capStep.c1.gM');
      expectParityClose(capTs.c1?.gV, capJs!.c1?.gV, 1e-6, 'capStep.c1.gV');
      expectParityClose(capTs.c2?.gM, capJs!.c2?.gM, 1e-6, 'capStep.c2.gM');
      expectParityClose(capTs.c2?.gV, capJs!.c2?.gV, 1e-6, 'capStep.c2.gV');
      expect(Boolean(capTs.punching?.ok)).toBe(oracle.getJsPunOK());
      expect(capTs.stm ? Boolean(capTs.stm.ok) : true).toBe(oracle.getJsCapStmOK());

      const canon = toHeavyAbutmentResult(morTs!, rcmTs, capTs);
      expect(canon.variant).toBe('heavy');
      expect(canon.err).toEqual([]);
      expect(canon.comb.A.length).toBe(morTs!.comb.A.length);
      expect(canon.sectionChecks?.cc).toBeDefined();
      expect(canon.capCheck?.punching?.ok).toBe(oracle.getJsPunOK());
    });

    it('punchStep computes identical overlapping-perimeter pile group punching checks', () => {
      seedInputs({ mo_fnd: 'coc', tq_mot: 'nang' });
      const morTs = moStep()!;
      oracle.moStep();
      rcStep();
      oracle.rcStep();

      const I = moInputs();
      const piles = [
        { x: -0.95, y: -0.95 },
        { x: -0.95, y: 0.95 },
        { x: 0.95, y: -0.95 },
        { x: 0.95, y: 0.95 },
      ];
      const out: CapComboInternalForce[] = [
        { id: 'CD1', st: 'CD', g: { DC: 1.25 }, VI: 1200, MI: 400, VII: 900, MII: 200, dvI: 1.4, dvII: 1.4, VcI: 1000, VcII: 800 },
        { id: 'DB1', st: 'DB', g: { DC: 1.0 }, VI: 1400, MI: 500, VII: 1000, MII: 250, dvI: 1.4, dvII: 1.4, VcI: 1100, VcII: 900 },
      ];
      const reactions = [
        [1850, 1750, 1400, 1300],
        [2100, 2000, 1600, 1500],
      ];
      const Rfn = (ci: number, pi: number) => reactions[ci][pi];
      const S1 = { h: 1800, f1: { dc: 168 } };

      const punTs = punchStep(I, piles, out, Rfn, S1, 1.4, 1.0);
      oracle.punchStep(oracle.moInputs(), piles, out, Rfn, S1, 1.4, 1.0);

      expect(punTs.ok).toBe(oracle.getJsPunOK());
      expect(punTs.groups).toBeGreaterThanOrEqual(1);
      const jsPunHtml = oracle.dollar('tbPun')?.innerHTML ?? '';
      expect(jsPunHtml.includes('Nhóm')).toBe(true);
    });

    it('moStep -> rcStep -> capStep matches on shallow-footing rock abutment (mo_fnd = nong)', () => {
      seedInputs({
        mo_fnd: 'nong',
        tq_mot: 'nang',
        sfm_gnd: 'da',
        sfm_anc: '1',
      });

      const morTs = moStep()!;
      oracle.moStep();
      const rcmTs = rcStep();
      oracle.rcStep();
      const sfmTs = sfmStep({ I: moInputs(), geo: morTs.geo, combA: morTs.comb.A });

      const capTs = capStep() as CapRuntimeState;
      oracle.capStep();
      const capJs = oracle.getJsCAPR();

      expect(capTs).not.toBeNull();
      expect(capJs).not.toBeNull();
      expectParityClose(capTs.c1?.gM, capJs!.c1?.gM, 1e-6, 'capStep.rock.c1.gM');
      expectParityClose(capTs.c1?.gV, capJs!.c1?.gV, 1e-6, 'capStep.rock.c1.gV');
      expectParityClose(capTs.c2?.gM, capJs!.c2?.gM, 1e-6, 'capStep.rock.c2.gM');
      expect(sfmTs).not.toBeNull();

      const canon = toHeavyAbutmentResult(morTs, rcmTs, capTs);
      expect(canon.variant).toBe('heavy');
      expect(canon.capCheck?.rc).toBeDefined();
    });
  });

  // =========================================================================
  // 2. abutmentFlex.ts (MD) vs modules/08_flexible_abutment_md.js
  // =========================================================================
  describe('2. abutmentFlex.ts (MD) vs modules/08_flexible_abutment_md.js', () => {
    it('mdInputs, mdSelfW, mdPlate (Mindlin FEM), and mdWing match exactly', () => {
      seedInputs({
        tq_mot: 'deo',
        mo_fnd: 'coc',
        mo_d: '1.4',
        mo_f: '0',
        mo_a: '0.5',
        mo_t: '0.5',
        mo_b: '2.2',
        mo_b1: '0.9',
        md_B5: '2.3',
        md_H4: '1.5',
      });

      const DE_ts = mdInputs();
      const DE_js = oracle.mdInputs();
      expectParityClose(DE_ts, DE_js, 1e-12, 'mdInputs');

      // Direct Mindlin 4-node plate FEM parity
      const plateTs = mdPlate(2.3, 3.8, 1.5, 0.45, [(y) => 12 + 8 * y, (y) => 25 + 3 * y], 6, 6);
      const plateJs = oracle.mdPlate(2.3, 3.8, 1.5, 0.45, [(y) => 12 + 8 * y, (y) => 25 + 3 * y], 6, 6);
      expectParityClose(plateTs, plateJs, 1e-6, 'mdPlate');

      // Direct mdSelfW parity
      const I_ts = moInputs();
      const I_js = oracle.moInputs();
      const mor0 = MO.calc(I_ts);
      const wTs: MoWeightItem[] = [];
      const wJs: MoWeightItem[] = [];
      const geoTs: MoGeo = { ...mor0.geo };
      const geoJs: MoGeo = { ...mor0.geo };
      const selfParams: MdSelfWeightParams = {
        b: I_ts.b,
        t: I_ts.t,
        d: I_ts.d,
        L: I_ts.L,
        xw2: I_ts.b / 2 - (I_ts.b - I_ts.t) - I_ts.t,
        xb: I_ts.b / 2 - (I_ts.b - I_ts.t) - I_ts.t + I_ts.g,
        ztop: I_ts.d + I_ts.jtm,
        wB: I_ts.L - I_ts.ut - I_ts.up,
        geo: geoTs,
      };
      const selfParamsJs: MdSelfWeightParams = { ...selfParams, geo: geoJs };
      mdSelfW(I_ts, DE_ts, selfParams, (no, name, V, x, y, z, sec) => {
        const item: MoWeightItem = { no, name, V, P: V * I_ts.gc, x, y, z, sec };
        wTs.push(item);
        return item;
      });
      oracle.mdSelfW(I_js, DE_js, selfParamsJs, (no, name, V, x, y, z, sec) => {
        const item: MoWeightItem = { no, name, V, P: V * I_ts.gc, x, y, z, sec };
        wJs.push(item);
        return item;
      });
      expectParityClose(wTs, wJs, 1e-9, 'mdSelfW.elements');
      expectParityClose(geoTs, geoJs, 1e-9, 'mdSelfW.geo');

      // Direct mdWing parity
      const wingIn = {
        K: mor0.K.K,
        KA: mor0.K.KA,
        KAE: mor0.EQ.KAE,
        gs: mor0.gs,
        gc: mor0.gc,
        kin: mor0.EQ.kin,
        geo: mor0.geo,
      };
      const wingTs = mdWing(I_ts, DE_ts, wingIn);
      const wingJs = oracle.mdWing(I_js, DE_js, wingIn);
      expectParityClose(wingTs, wingJs, 1e-6, 'mdWing');
    });

    it('MO.calc(deo), mdCapDef, mdCapLoad, mdLLsets, mdFlex, mdCapStep, mdSTM & toFlexibleAbutmentResult match', () => {
      seedInputs({
        tq_mot: 'deo',
        mo_fnd: 'coc',
        mo_d: '1.4',
        mo_f: '0',
        mo_a: '0.5',
        mo_t: '0.5',
        mo_b: '2.2',
        mo_b1: '0.9',
        md_B5: '2.3',
        md_H4: '1.5',
        mc_src: 'mo',
        mc_xy: '0 -2.4\n0 0\n0 2.4',
        md_stmm: 'stm',
      });

      const morTs = moStep()!;
      oracle.moStep();
      const morJs = oracle.getJsMOR()!;
      expectParityClose(morTs.geo, morJs.geo, 1e-7, 'md.moStep.geo');
      expectParityClose(morTs.W, morJs.W, 1e-7, 'md.moStep.W');
      expectParityClose(morTs.comb, morJs.comb, 1e-6, 'md.moStep.comb');
      expectParityClose(morTs.WG, morJs.WG, 1e-6, 'md.moStep.WG');

      const rcmTs = rcStep();
      oracle.rcStep();
      const rcmJs = oracle.getJsRCM()!;
      const rcmJsOk = Object.values(rcmJs.res).filter(Boolean).every((o) => Boolean(o?.ok));
      expect(rcmTs.ok).toBe(rcmJsOk);
      expectParityClose(rcmTs.res.wx?.gM, rcmJs.res.wx?.gM, 1e-6, 'md.rcStep.wx.gM');
      expectParityClose(rcmTs.res.wy?.gM, rcmJs.res.wy?.gM, 1e-6, 'md.rcStep.wy.gM');

      const I_ts = moInputs();
      const I_js = oracle.moInputs();
      const cd0Ts = mdCapDef(I_ts, morTs.geo, morTs);
      const cd0Js = oracle.mdCapDef(I_js, morJs.geo);
      expectParityClose(cd0Ts, cd0Js, 1e-7, 'mdCapDef');

      const llTs = mdLLsets(I_ts, cd0Ts, morTs);
      const llJs = oracle.mdLLsets(I_js, cd0Js);
      expectParityClose(llTs, llJs, 1e-7, 'mdLLsets');

      const capLoadTs = mdCapLoad(cd0Ts, morTs.comb.A[0], llTs.s1[0]);
      const capLoadJs = oracle.mdCapLoad(cd0Js, morJs.comb.A[0], llJs.s1[0]);
      expectParityClose(capLoadTs, capLoadJs, 1e-6, 'mdCapLoad');

      // Pile group + Winkler mdFlex coupling
      const mcrTs = mcocStep({
        MOR: morTs,
        onMdFlex: ({ dd, piles, R1, R2, LC, LD }) => {
          mdFlex(dd, piles, R1, R2, LC, LD, { mor: morTs, inputs: I_ts });
          const f = getLatestMdFlexResult();
          return f ? { ok: f.ok, text: mdFlexTxt() } : null;
        },
      })!;
      oracle.mcocStep();
      const mcrJs = oracle.getJsMCR() as { rows: unknown; U1: unknown };
      const flexTs = getLatestMdFlexResult()!;
      const flexJs = oracle.getJsMDFLEX()!;
      expect(flexTs.ok).toBe(true);
      expect(flexJs.ok).toBe(true);
      expectParityClose(flexTs.kv, flexJs.kv, 1e-6, 'mdFlex.kv');
      expectParityClose(flexTs.kt, flexJs.kt, 1e-6, 'mdFlex.kt');
      expectParityClose(flexTs.EI, flexJs.EI, 1e-5, 'mdFlex.EI');
      expectParityClose(flexTs.CD.map((c) => c.dN), flexJs.CD.map((c) => c.dN), 1e-5, 'mdFlex.CD.dN');
      expectParityClose(flexTs.CD.map((c) => c.dM), flexJs.CD.map((c) => c.dM), 1e-5, 'mdFlex.CD.dM');
      expectParityClose(mcrTs.rows, mcrJs.rows, 1e-5, 'md.mcocStep.rows');

      // Flexible cap bending/shear + STM
      const capTs = capStep() as CapRuntimeState;
      oracle.capStep();
      const capJs = oracle.getJsCAPR()!;
      const mdCapTs = getLatestMdCapResult()!;
      const mdCapJs = oracle.getJsMDCAP()!;

      expectParityClose(capTs.bn?.gM, capJs.bn?.gM, 1e-6, 'mdCapStep.bn.gM');
      expectParityClose(capTs.bp?.gM, capJs.bp?.gM, 1e-6, 'mdCapStep.bp.gM');
      expectParityClose(capTs.bn?.gV, capJs.bn?.gV, 1e-6, 'mdCapStep.bn.gV');
      expectParityClose(
        mdCapTs.out.map((o) => ({ id: o.id, N: o.N, mn: o.mn, mx: o.mx, Vu: o.Vu })),
        mdCapJs.out.map((o) => ({ id: o.id, N: o.N, mn: o.mn, mx: o.mx, Vu: o.Vu })),
        1e-5,
        'mdCapStep.out',
      );
      expect(Boolean(capTs.stm?.ok)).toBe(Boolean(capJs.stm?.ok));

      const canon = toFlexibleAbutmentResult(morTs, rcmTs, capTs, mdCapTs);
      expect(canon.variant).toBe('flexible');
      expect(canon.capCheck?.winklerCap).toBeDefined();
      expect(canon.wingwallPlate).toBeDefined();
    });
  });

  // =========================================================================
  // 3. pierFlex.ts (TR) vs modules/13_pier_flexible_tr.js
  // =========================================================================
  describe('3. pierFlex.ts (TR) vs modules/13_pier_flexible_tr.js', () => {
    it('trGeom, trMat, trLlLong, trLever, trPlacements, trModel, trModelL, trLoads, trResAt match', () => {
      seedInputs({
        tq_kn: 'n',
        tq_tru: 'deo',
        tq_obj: 'tru',
        td_Lc: '8.2',
        td_n: '3',
        td_br: '0',
      });

      const I_ts = trInputs();
      const I_js = oracle.trInputs();
      expectParityClose({ ...I_ts, br: Boolean(I_ts.br) }, { ...I_js, br: Boolean(I_js.br) }, 1e-9, 'trInputs.default');

      const G_ts = trGeom(I_ts);
      const G_js = oracle.TR.geom(I_js);
      expectParityClose(G_ts, G_js, 1e-7, 'trGeom');

      const M_ts = trMat(I_ts);
      const M_js = oracle.TR.mat(I_js);
      const { fu: _ignoredFu, ...M_js_cmp } = M_js as unknown as Record<string, unknown>;
      expectParityClose(M_ts, M_js_cmp, 1e-7, 'trMat');

      const LO_ts = trLlLong(I_ts);
      const LO_js = oracle.TR.llLong(I_js);
      expectParityClose(LO_ts, LO_js, 1e-7, 'trLlLong');

      const levTs = new Float64Array(G_ts.nb);
      const levJs = new Float64Array(G_js.nb);
      trLever(G_ts.xg, 1.35, 100, levTs);
      oracle.TR.lever(G_js.xg, 1.35, 100, levJs);
      expectParityClose(levTs, levJs, 1e-12, 'trLever');

      const PL_ts = trPlacements(I_ts, G_ts, LO_ts);
      const PL_js = oracle.TR.placements(I_js, G_js, LO_js);
      expectParityClose(PL_ts, PL_js, 1e-7, 'trPlacements');

      const MD_ts = trModel(I_ts, G_ts, M_ts);
      const MD_js = oracle.TR.model(I_js, G_js, M_js);
      expectParityClose(MD_ts.nodes, MD_js.nodes, 1e-7, 'trModel.nodes');
      expectParityClose(MD_ts.els, MD_js.els, 1e-7, 'trModel.els');
      expectParityClose(MD_ts.springs, MD_js.springs, 1e-7, 'trModel.springs');
      expectParityClose(MD_ts.fix, MD_js.fix, 1e-7, 'trModel.fix');

      const ML_ts = trModelL(I_ts, G_ts, MD_ts, 1200);
      const ML_js = oracle.TR.modelL(I_js, G_js, MD_js, 1200);
      expectParityClose(ML_ts.nodes, ML_js.nodes, 1e-7, 'trModelL.nodes');
      expectParityClose(ML_ts.els, ML_js.els, 1e-7, 'trModelL.els');
      expectParityClose(ML_ts.springs, ML_js.springs, 1e-7, 'trModelL.springs');

      const LDo_ts = trLoads(I_ts, G_ts, MD_ts, LO_ts, PL_ts);
      const LDo_js = oracle.TR.loads(I_js, G_js, MD_js, LO_js, PL_js);
      expectParityClose(LDo_ts.C, LDo_js.C, 1e-6, 'trLoads.C');
      expectParityClose(LDo_ts.info, LDo_js.info, 1e-6, 'trLoads.info');

      expectParityClose(
        trResAt(LDo_ts.C.DCs, G_ts.ELs),
        oracle.TR.resAt(LDo_js.C.DCs, G_js.ELs),
        1e-7,
        'trResAt(DCs)',
      );
    });

    it('trCalc, trBuck, trState, and trCheck match on default 3-column and braced seismic 2-column piers', () => {
      // Case A: Default 3-column pier
      seedInputs({
        tq_kn: 'n',
        tq_tru: 'deo',
        tq_obj: 'tru',
        td_Lc: '8.2',
        td_n: '3',
        td_br: '0',
      });
      const I_a_ts = trInputs();
      const I_a_js = oracle.trInputs();
      const R_a_ts = trCalc(I_a_ts);
      const R_a_js = oracle.TR.calc(I_a_js);

      expectParityClose(R_a_ts.err, R_a_js.err, 1e-9, 'trCalc.A.err');
      expectParityClose(R_a_ts.G, R_a_js.G, 1e-7, 'trCalc.A.G');
      expectParityClose(R_a_ts.EQ, R_a_js.EQ, 1e-6, 'trCalc.A.EQ');
      expectParityClose(R_a_ts.CB, R_a_js.CB, 1e-7, 'trCalc.A.CB');
      expectParityClose(R_a_ts.VAR, R_a_js.VAR, 1e-5, 'trCalc.A.VAR');
      expectParityClose(R_a_ts.LLS, R_a_js.LLS, 1e-5, 'trCalc.A.LLS');

      expectParityClose(trState(R_a_ts, 0, 0), oracle.TR.state(R_a_js, 0, 0), 1e-6, 'trState(0,0)');

      const MD_a = R_a_ts.MD!;
      const lamTs = trBuck(
        MD_a.nodes,
        MD_a.els,
        MD_a.springs,
        MD_a.fix,
        (e) => (e.kind === 'cap' ? e.EI : MD_a.Ec * MD_a.Icol * 0.4),
        (e) => (e.kind === 'col' ? 2500 : 0),
      );
      const lamJs = oracle.TR.buck(
        MD_a.nodes,
        MD_a.els,
        MD_a.springs,
        MD_a.fix,
        (e: { kind: string; EI: number }) => (e.kind === 'cap' ? e.EI : MD_a.Ec * MD_a.Icol * 0.4),
        (e: { kind: string }) => (e.kind === 'col' ? 2500 : 0),
      );
      expectParityClose(lamTs, lamJs, 1e-5, 'trBuck');

      let pmTs: { CD: ReturnType<typeof trFast>; DB: ReturnType<typeof trFast> } | null = null;
      withCtx('C_', () => {
        const S = section();
        pmTs = {
          CD: trFast(curve(S, 0.75, 0.9)),
          DB: trFast(curve(S, 1.0, 1.0)),
        };
      });
      const C_a_ts = trCheck(R_a_ts, pmTs, {
        EIg: MD_a.Ec * MD_a.Icol,
        EsIs: 2e8 * 0.002,
        EpIg: MD_a.Ep * MD_a.Icol,
        EsIsP: 2e8 * 0.002,
      });
      const C_a_js = oracle.TR.check(R_a_js, pmTs, {
        EIg: MD_a.Ec * MD_a.Icol,
        EsIs: 2e8 * 0.002,
        EpIg: MD_a.Ep * MD_a.Icol,
        EsIsP: 2e8 * 0.002,
      });
      expectParityClose(C_a_ts.SL, C_a_js.SL, 1e-5, 'trCheck.A.SL');
      expectParityClose(C_a_ts.colRec, C_a_js.colRec, 1e-5, 'trCheck.A.colRec');
      expectParityClose(C_a_ts.pileRec, C_a_js.pileRec, 1e-5, 'trCheck.A.pileRec');

      // Case B: Braced 2-column pier in seismic zone 3 with flow angle & collision
      seedInputs({
        tq_kn: 'n',
        tq_tru: 'deo',
        tq_obj: 'tru',
        td_Lc: '8.2',
        td_n: '2',
        td_s: '4.2',
        td_br: '1',
        td_ELb: '17.0',
        td_A: '0.24',
        td_thw: '15',
        td_hx: '1.2',
        td_PCT: '350',
      });
      const R_b_ts = trCalc(trInputs());
      const R_b_js = oracle.TR.calc(oracle.trInputs());
      expectParityClose(R_b_ts.err, R_b_js.err, 1e-9, 'trCalc.B.err');
      expectParityClose(R_b_ts.G, R_b_js.G, 1e-7, 'trCalc.B.G');
      expectParityClose(R_b_ts.EQ, R_b_js.EQ, 1e-6, 'trCalc.B.EQ');
      expectParityClose(R_b_ts.VAR, R_b_js.VAR, 1e-5, 'trCalc.B.VAR');
    }, 20_000);

    it('trStep and toFlexiblePierResult match full end-to-end flexible pier workflow', () => {
      seedInputs({
        tq_kn: 'n',
        tq_tru: 'deo',
        tq_obj: 'tru',
        td_Lc: '8.2',
        td_n: '3',
        td_br: '0',
        td_A: '0.22',
        T_pd2_g: 'CD',
        T_pd2_c: 'A',
        pd2_g: 'CD',
        pd2_c: 'A',
      });

      const R_ts = trStep();
      oracle.trStep();
      const R_js = oracle.getJsTRR();
      const C_ts = getLatestTrCheck();
      const C_js = oracle.getJsTRC();

      expect(R_ts).toBeDefined();
      expect(R_js).not.toBeNull();
      expect(C_ts).not.toBeNull();
      expect(C_js).not.toBeNull();

      expectParityClose(R_ts!.G, R_js!.G, 1e-7, 'trStep.G');
      expectParityClose(R_ts!.EQ, R_js!.EQ, 1e-6, 'trStep.EQ');
      expectParityClose(C_ts!.SL, C_js!.SL, 1e-5, 'trStep.C.SL');
      expectParityClose(C_ts!.colRec, C_js!.colRec, 1e-5, 'trStep.C.colRec');
      expectParityClose(C_ts!.pileRec, C_js!.pileRec, 1e-5, 'trStep.C.pileRec');
      expectParityClose(getLatestTrXy(), oracle.getJsTRXY(), 1e-9, 'trStep.TRXY');
      expectParityClose(getLatestTrRows(), oracle.getJsTRROWS(), 1e-5, 'trStep.TRROWS');
      expectParityClose(getLatestTrConf(), oracle.getJsConfOK(), 1e-9, 'trStep.confOK');

      const jsEq = oracle.getJsTrEq();
      const tsEq = getLatestTrEq();
      expect(tsEq.hOK).toBe(jsEq.hOK);
      expect(tsEq.sOK).toBe(jsEq.sOK);

      const canon = toFlexiblePierResult(getLatestTrResult(), C_ts);
      expect(canon).not.toBeNull();
      expect(canon!.variant).toBe('flexible');
      expect(canon!.combos.length).toBeGreaterThan(0);
      expect(canon!.buckling).toBeDefined();
      expect(canon!.capCheck).toBeDefined();
      expect(canon!.seismic).toBeDefined();
      expect(canon!.okAll).toBe(getLatestTrSummaryOk());
    }, 20_000);
  });

  // =========================================================================
  // 4. pierSolid.ts (DCT) vs modules/14_pier_solid_dct_and_shallow_fdn_ui.js
  // =========================================================================
  describe('4. pierSolid.ts (DCT) vs modules/14_pier_solid_dct_and_shallow_fdn_ui.js', () => {
    it('dcGeom, dcCms, dcLoads, dcCombos, dcCombine, dcColSec, dcPmTable, dcPmCap, dcPmCurve, dcCapAA, dcCalc match', () => {
      seedInputs({
        tq_kn: 'n',
        tq_tru: 'dac',
        tq_obj: 'tru',
        dt_fnd: 'coc',
      });

      const I_ts = trInputs();
      const I_js = oracle.trInputs();
      const Q_ts = dcInputs();
      const Q_js = oracle.dcInputs();
      expectParityClose(Q_ts, Q_js, 1e-9, 'dcInputs');

      for (const [A, S, soil, T] of [
        [0.054, 1.09, 3, 0.3],
        [0.35, 1.2, 3, 0.4],
        [0.18, 1.0, 2, 4.8],
      ] as const) {
        expectParityClose(dcCms(A, S, soil, T), oracle.DCT.Cms(A, S, soil, T), 1e-12, `dcCms(${A},${T})`);
      }

      const G_ts = dcGeom(I_ts, Q_ts);
      const G_js = oracle.DCT.geom(I_js, Q_js);
      expectParityClose(G_ts, G_js, 1e-7, 'dcGeom');

      const M_ts = trMat(I_ts);
      const M_js = oracle.TR.mat(I_js);
      const LD_ts = dcLoads(I_ts, Q_ts, G_ts, M_ts);
      const LD_js = oracle.DCT.loads(I_js, Q_js, G_js, M_js);
      expectParityClose(LD_ts.C, LD_js.C, 1e-6, 'dcLoads.C');
      expectParityClose(LD_ts.info, LD_js.info, 1e-6, 'dcLoads.info');

      const CB_ts = dcCombos(I_ts, LD_ts);
      const CB_js = oracle.DCT.combos(I_js, LD_js);
      expectParityClose(CB_ts, CB_js, 1e-7, 'dcCombos');

      const R_ts = dcCalc(I_ts, Q_ts);
      const R_js = oracle.DCT.calc(I_js, Q_js);
      expectParityClose(R_ts.S1, R_js.S1, 1e-6, 'dcCalc.S1');
      expectParityClose(R_ts.S2, R_js.S2, 1e-6, 'dcCalc.S2');
      expectParityClose(R_ts.C1, R_js.C1, 1e-5, 'dcCalc.C1');
      expectParityClose(R_ts.C2, R_js.C2, 1e-5, 'dcCalc.C2');
      expectParityClose(R_ts.AA, R_js.AA, 1e-5, 'dcCalc.AA');

      const combDirectTs = dcCombine(I_ts, CB_ts, R_ts.S2!);
      const combDirectJs = oracle.DCT.combine(I_js, CB_js, R_js.S2!);
      expectParityClose(combDirectTs, combDirectJs, 1e-5, 'dcCombine');

      const aaDirectTs = dcCapAA(I_ts, Q_ts, G_ts, LD_ts);
      const aaDirectJs = oracle.DCT.capAA(I_js, Q_js, G_js, LD_js);
      expectParityClose(aaDirectTs, aaDirectJs, 1e-5, 'dcCapAA');

      const colSecTs = dcColSec(Q_ts, G_ts, M_ts);
      const colSecJs = oracle.DCT.colSec(Q_js, G_js, M_js);
      expectParityClose(colSecTs, colSecJs, 1e-7, 'dcColSec');

      const ptTs = dcPmTable(colSecTs, M_ts, 0.9);
      const ptJs = oracle.DCT.pmTable(colSecJs, M_js, 0.9);
      expectParityClose(ptTs.Pn0, ptJs.Pn0, 1e-6, 'dcPmTable.Pn0');
      expectParityClose(ptTs.Prmax, ptJs.Prmax, 1e-6, 'dcPmTable.Prmax');
      expectParityClose(ptTs.T, ptJs.T, 1e-6, 'dcPmTable.T');

      const capCdTs = dcPmCap(ptTs, 5200, 1800, 950, 'CD');
      const capCdJs = oracle.DCT.pmCap(ptJs, 5200, 1800, 950, 'CD');
      expectParityClose(capCdTs, capCdJs, 1e-6, 'dcPmCap.CD');

      const capDbTs = dcPmCap(ptTs, 4800, 2100, 1200, 'DB');
      const capDbJs = oracle.DCT.pmCap(ptJs, 4800, 2100, 1200, 'DB');
      expectParityClose(capDbTs, capDbJs, 1e-6, 'dcPmCap.DB');

      expectParityClose(dcPmCurve(ptTs, 0, 'CD', 'My'), oracle.DCT.pmCurve(ptJs, 0, 'CD', 'My'), 1e-6, 'dcPmCurve.0');
      expectParityClose(dcPmCurve(ptTs, 18, 'DB', 'Mx'), oracle.DCT.pmCurve(ptJs, 18, 'DB', 'Mx'), 1e-6, 'dcPmCurve.18');
    });

    it('dcStep, dcSTMx, dcSTMb & toSolidPierResult match on pile-founded solid pier', () => {
      seedInputs({
        tq_kn: 'n',
        tq_tru: 'dac',
        tq_obj: 'tru',
        dt_fnd: 'coc',
        dt_stmx: 'ref',
        dt_stmb: 'ref',
      });

      const R_ts = dcStep();
      oracle.dcStep();
      const R_js = oracle.getJsDCR();

      expect(R_ts).not.toBeNull();
      expect(R_js).not.toBeNull();
      expectParityClose(R_ts!.G, R_js!.G, 1e-7, 'dcStep.pile.G');
      expectParityClose(R_ts!.C2, R_js!.C2, 1e-5, 'dcStep.pile.C2');
      expectParityClose(R_ts!.AA, R_js!.AA, 1e-5, 'dcStep.pile.AA');
      expectParityClose(R_ts!.capOK, R_js!.capOK, 1e-9, 'dcStep.pile.capOK');
      expectParityClose(R_ts!.colOK, R_js!.colOK, 1e-9, 'dcStep.pile.colOK');
      expectParityClose(R_ts!.beOK, R_js!.beOK, 1e-9, 'dcStep.pile.beOK');
      expectParityClose(R_ts!.stmX, R_js!.stmX, 1e-6, 'dcStep.pile.stmX');
      expectParityClose(R_ts!.stmB, R_js!.stmB, 1e-6, 'dcStep.pile.stmB');
      expectParityClose(getLatestDcLink(), oracle.getJsDCLK(), 1e-5, 'dcStep.pile.DCLK');

      // Also verify direct deep=true STM paths on cap & footing
      dcSTMx(R_ts!, true);
      oracle.dcSTMx(R_js!, true);
      expectParityClose(R_ts!.stmX, R_js!.stmX, 1e-5, 'dcSTMx(deep=true)');

      const piles = [
        { x: -1.5, y: -2.0 },
        { x: -1.5, y: 2.0 },
        { x: 1.5, y: 2.0 },
        { x: 1.5, y: -2.0 },
      ];
      const P_stm = R_ts!.C2!.map((c) => ({
        id: c.id,
        st: c.st,
        Rs: piles.map(() => c.tot.Hz / piles.length),
      }));
      dcSTMb(R_ts!, piles, P_stm, R_ts!.C2!, true, 1.0);
      oracle.dcSTMb(R_js!, piles, P_stm, R_js!.C2!, true, 1.0);
      expectParityClose(R_ts!.stmB, R_js!.stmB, 1e-5, 'dcSTMb(deep=true)');

      const canon = toSolidPierResult(getLatestDcResult());
      expect(canon).not.toBeNull();
      expect(canon!.variant).toBe('solid');
      expect(canon!.combos.length).toBe(R_ts!.C2!.length);
      expect(canon!.buckling).toBeDefined();
      expect(canon!.stemCheck?.pmBiaxial).toBeDefined();
      expect(canon!.footingCheck?.rcX).toBeDefined();
    });

    it('dcStep & toSolidPierResult match on rock shallow-footing solid pier (dt_fnd = nong)', () => {
      seedInputs({
        tq_kn: 'n',
        tq_tru: 'dac',
        tq_obj: 'tru',
        dt_fnd: 'nong',
        sfd_gnd: 'da',
        sfd_anc: '1',
      });

      const R_ts = dcStep();
      oracle.dcStep();
      const R_js = oracle.getJsDCR();
      const sfdTs = getLatestDcSfdResult();
      const sfdJs = oracle.getJsSFDR() as { ok?: boolean; R?: unknown } | null;

      expect(R_ts).not.toBeNull();
      expect(R_js).not.toBeNull();
      expect(sfdTs).not.toBeNull();
      expect(sfdJs).not.toBeNull();

      expectParityClose(sfdTs!.ok, sfdJs!.ok, 1e-9, 'dcStep.rock.sfd.ok');
      expectParityClose(sfdTs!.R, sfdJs!.R, 1e-6, 'dcStep.rock.sfd.R');
      expectParityClose(R_ts!.beOK, R_js!.beOK, 1e-9, 'dcStep.rock.beOK');
      expect(R_ts!.footRcX).toBeDefined();
      expect(R_ts!.footRcY).toBeDefined();

      const canon = toSolidPierResult(R_ts);
      expect(canon).not.toBeNull();
      expect(canon!.variant).toBe('solid');
      expect(canon!.footingCheck?.rcX).toBeDefined();
      expect(canon!.footingCheck?.rcY).toBeDefined();
      expect(canon!.okAll).toBe(
        Boolean(R_ts!.capOK && R_ts!.colOK && R_ts!.beOK && sfdTs!.ok),
      );
    });
  });

  // =========================================================================
  // 5. Clean-Room & Zero-CDN Audit
  // =========================================================================
  describe('5. Clean-Room & Zero-CDN Audit', () => {
    it('all 4 bridge substructure solver modules contain zero https:// URLs and zero licensing terms', () => {
      const forbiddenUrl = /https?:\/\//i;
      const forbiddenLic = /\b(license|licensing|hwid|machineId|activation|keygen|trial)\b/i;

      for (const rel of BRIDGE_SUB_TS_FILES) {
        const src = readFileSync(resolve(WEB_ROOT, rel), 'utf8');
        expect(src, `${rel} must contain zero external HTTP/HTTPS URLs`).not.toMatch(forbiddenUrl);
        expect(src, `${rel} must contain zero licensing/activation terms`).not.toMatch(forbiddenLic);
      }
    });
  });
});
