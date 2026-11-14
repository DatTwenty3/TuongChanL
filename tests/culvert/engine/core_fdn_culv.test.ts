import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  CTX,
  SAMPLE_CD,
  SAMPLE_DB,
  SCT2_LNK,
  TB,
  TT,
  bilin,
  clearContextStore,
  contextState,
  getIDP,
  interp1,
  parseSum,
  resetAllContexts,
  resolveScopedIdCandidates,
  setContextStore,
  withCtx,
} from '../../../src/culvert/engine/context.ts';
import { chFrameSolve, mdPlateSolve } from '../../../src/culvert/engine/math/rcmFrame.ts';
import {
  RC,
  buildCircularSection,
  capDir,
  compute3,
  curve,
  phiMnAt,
  pt3,
  section,
  type CircularComboLoad,
  type CircularSection,
  type RcLoadInput,
} from '../../../src/culvert/engine/math/rc.ts';
import { SF, sfAnc } from '../../../src/culvert/engine/foundations/shallowFdn.ts';
import { MC, PILE, RK } from '../../../src/culvert/engine/foundations/pileGroup.ts';
import {
  SCT,
  alphaB1,
  sctCheck,
  type SctCalcInput,
  type SctCalcOutput,
} from '../../../src/culvert/engine/foundations/drilledShaft.ts';
import {
  CH,
  CHREB_DEF,
  CHN,
  type ChInput,
  type ChnSoilInput,
} from '../../../src/culvert/engine/culvertsWalls/boxCulvert.ts';
import { CT, type CtInput } from '../../../src/culvert/engine/culvertsWalls/pipeCulvert.ts';
import {
  TC,
  TC_LIB,
  TC_LIB86,
  tc86Row,
  type TcInput,
} from '../../../src/culvert/engine/culvertsWalls/wallGravity.ts';
import { TL, tlRC, type TlInput } from '../../../src/culvert/engine/culvertsWalls/wallCantilever.ts';
import { QD, type QdInput } from '../../../src/culvert/engine/bridge/approachSlab.ts';
import type { RcSectionInput } from '../../../src/culvert/types/project.ts';

interface MockEl {
  id: string;
  tagName: string;
  value: string;
  innerHTML: string;
  textContent: string;
  readOnly: boolean;
  disabled: boolean;
  hidden: boolean;
  className: string;
  rows: MockEl[];
  style: Record<string, string>;
  dataset: Record<string, string>;
  attributes: Record<string, string>;
  children: Array<{ textContent: string }>;
  classList: {
    add: (...cls: string[]) => void;
    remove: (...cls: string[]) => void;
    toggle: (cls: string) => void;
    contains: (cls: string) => boolean;
  };
  addEventListener: () => void;
  removeEventListener: () => void;
  setAttribute: (k: string, val: unknown) => void;
  getAttribute: (k: string) => string | null;
  closest: () => null;
  querySelector: () => null;
  querySelectorAll: () => MockEl[];
  appendChild: (child: MockEl) => MockEl;
  insertAdjacentHTML: (position: string, html: string) => void;
  remove: () => void;
  click: () => void;
  onclick: ((...args: unknown[]) => unknown) | null;
}

interface JsOracle {
  SF: typeof SF;
  sfAnc: typeof sfAnc;
  TT: number[][];
  TB: number[][];
  bilin: (T: readonly (readonly number[])[], v: number, e: number) => number;
  parseSum: typeof parseSum;
  SAMPLE_CD: string;
  SAMPLE_DB: string;
  SCT2_LNK: string[];
  withCtx: <T>(p: string, fn: () => T) => T;
  dollar: (id: string) => MockEl | null;
  RC: {
    mat: (m: Parameters<typeof RC.mat>[0]) => ReturnType<typeof RC.mat>;
    bar: (d: number) => number;
    flex: (S: RcSectionInput, M: ReturnType<typeof RC.mat>, pos: boolean) => ReturnType<typeof RC.flex>;
    crack: (S: RcSectionInput, M: ReturnType<typeof RC.mat>, Ms: number) => ReturnType<typeof RC.crack>;
    shear: (
      S: RcSectionInput,
      M: ReturnType<typeof RC.mat>,
      Mu: number,
      Vu: number,
      Nu: number,
      phiV: number,
      fl: ReturnType<typeof RC.flex>,
    ) => ReturnType<typeof RC.shear>;
    run: (S: RcSectionInput, M: ReturnType<typeof RC.mat>, L: RcLoadInput[]) => ReturnType<typeof RC.run>;
  };
  section: () => CircularSection;
  curve: typeof curve;
  phiMnAt: typeof phiMnAt;
  pt3: typeof pt3;
  capDir: typeof capDir;
  compute3: (S: CircularSection, LCD: readonly CircularComboLoad[], LDB: readonly CircularComboLoad[]) => void;
  RK: typeof RK;
  PILE: typeof PILE;
  MC: typeof MC;
  SCT: {
    alphaB1: (qu: number, r: number) => number;
    calc: (I: SctCalcInput) => SctCalcOutput | { err: string };
    eta: typeof SCT.eta;
    igmClass: typeof SCT.igmClass;
  };
  sctCheck: () => void;
  CH: {
    Frame: typeof chFrameSolve;
    calc: (I: ChInput) => ReturnType<typeof CH.calc>;
    lerp: (x: number, xs: readonly number[], ys: readonly number[]) => number;
    VEH: typeof CH.VEH;
    patches: typeof CH.patches;
  };
  CHN: typeof CHN;
  CT: typeof CT;
  TC: typeof TC;
  TC_LIB: typeof TC_LIB;
  TC_LIB86: typeof TC_LIB86;
  tc86Row: typeof tc86Row;
  TL: typeof TL;
  tlRC: typeof tlRC;
  QD: typeof QD;
  MD: {
    plate: typeof mdPlateSolve;
  };
  setJsIDP: (p: string) => void;
  getJsIDP: () => string;
  getJsST3: () => ReturnType<typeof compute3>;
  setJsSCTR: (r: SctCalcOutput | null) => void;
  setJsMCR: (m: unknown) => void;
  getJsCTX: () => Record<string, Record<string, unknown>>;
  getJsSctOK: () => Record<string, boolean>;
}

const testDir = dirname(fileURLToPath(import.meta.url));
const modulesDir = resolve(testDir, '../../../../analysis-cau-cong/modules');

const MODULE_FILES = [
  '01_boot_shims_and_sf.js',
  '02_core_utils_and_column_pm.js',
  '03_abutment_loads_and_rc.js',
  '06_retaining_wall_gravity.js',
  '07_approach_slab_and_culvert_soil.js',
  '08_flexible_abutment_md.js',
  '09_retaining_wall_cantilever_l.js',
  '11_culverts_box_and_circular.js',
  '12_piles_geotech_mcoc_and_pm3d.js',
  '14_pier_solid_dct_and_shallow_fdn_ui.js',
] as const;

let oracle: JsOracle;
let domElements: Map<string, MockEl>;
let existingDomIds: Set<string>;
let autoCreateDom = true;

function makeMockEl(id: string): MockEl {
  const classes = new Set<string>();
  const el: MockEl = {
    id,
    tagName: 'INPUT',
    value: '',
    innerHTML: '',
    textContent: '',
    readOnly: false,
    disabled: false,
    hidden: false,
    className: '',
    rows: [],
    style: {},
    dataset: {},
    attributes: {},
    children: [{ textContent: '' }, { textContent: '' }, { textContent: '' }],
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
    setAttribute: (k, val) => {
      el.attributes[k] = String(val);
    },
    getAttribute: (k) => (k in el.attributes ? el.attributes[k] : null),
    closest: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    appendChild: (child) => child,
    insertAdjacentHTML: () => {},
    remove: () => {},
    click: () => {},
    onclick: null,
  };
  return el;
}

function setBothStores(values: Record<string, string | number | boolean>): void {
  setContextStore(values);
  for (const [id, raw] of Object.entries(values)) {
    const val = typeof raw === 'boolean' ? (raw ? '1' : '0') : String(raw);
    existingDomIds.add(id);
    let el = domElements.get(id);
    if (!el) {
      el = makeMockEl(id);
      domElements.set(id, el);
    }
    el.value = val;
  }
}

function clearBothStores(): void {
  clearContextStore();
  domElements.clear();
  existingDomIds.clear();
}

function expectParityClose(actual: unknown, expected: unknown, tol = 1e-9, path = 'root'): void {
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
    expectParityClose(actObj[key], expObj[key], tol, `${path}.${key}`);
  }
}

function loadCleanRoomJsOracle(): JsOracle {
  domElements = new Map<string, MockEl>();
  existingDomIds = new Set<string>();
  const storage = new Map<string, string>();
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();

  const fakeLocalStorage = {
    getItem: (k: string) => (storage.has(k) ? storage.get(k)! : null),
    setItem: (k: string, val: string) => {
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

  const getOrCreateEl = (id: string): MockEl | null => {
    if (domElements.has(id)) return domElements.get(id)!;
    if (!autoCreateDom && !existingDomIds.has(id)) return null;
    const el = makeMockEl(id);
    domElements.set(id, el);
    return el;
  };

  const fakeDocument = {
    body: makeMockEl('__body'),
    getElementById: (id: string) => getOrCreateEl(id),
    createElement: (tag: string) => {
      const el = makeMockEl('__created');
      el.tagName = tag.toUpperCase();
      return el;
    },
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
  };

  const fakeWindow: Record<string, unknown> = {
    localStorage: fakeLocalStorage,
    addEventListener: (ev: string, fn: (...args: unknown[]) => void) => {
      const list = listeners.get(ev) || [];
      list.push(fn);
      listeners.set(ev, list);
    },
    removeEventListener: () => {},
    __ckErr: [],
    __sctOK: {},
    __biOK: false,
    __matOK: {},
  };

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
    Blob: class MockBlob {
      constructor(public parts: unknown[], public options?: Record<string, unknown>) {}
    },
    URL: { createObjectURL: () => 'blob:mock' },
    Plotly: { Plots: { resize: () => {} }, newPlot: () => {}, react: () => {} },
    // Cross-module UI stubs omitted because modules 04/05/10/13 are not needed for these solvers
    igOn: () => false,
    ikOn: () => false,
    trOn: () => false,
    dcOn: () => false,
    objVis: () => {},
    damStep: () => {},
    sup2Step: () => {},
    trVis: () => {},
    sctTitles: () => {},
    trSchedule: () => {},
    saveAll: () => {},
  };
  fakeWindow.window = fakeWindow;
  sandbox.globalThis = sandbox;

  const ctx = vm.createContext(sandbox);
  for (const fname of MODULE_FILES) {
    const src = readFileSync(resolve(modulesDir, fname), 'utf8');
    vm.runInContext(src, ctx, { filename: fname });
  }

  // Extract lexical const/let/function bindings cleanly from inside the same vm context
  vm.runInContext(
    `globalThis.__ORACLE__ = {
      SF,
      sfAnc,
      TT,
      TB,
      bilin,
      parseSum,
      SAMPLE_CD,
      SAMPLE_DB,
      SCT2_LNK,
      withCtx,
      dollar: $,
      RC,
      section,
      curve,
      phiMnAt,
      pt3,
      capDir,
      compute3,
      RK,
      PILE,
      MC,
      SCT,
      sctCheck,
      CH,
      CHN,
      CT,
      TC,
      TC_LIB,
      TC_LIB86,
      tc86Row,
      TL,
      tlRC,
      QD,
      MD,
      setJsIDP: (p) => { IDP = p; },
      getJsIDP: () => IDP,
      getJsST3: () => ST3,
      setJsSCTR: (r) => { SCTR = r; },
      setJsMCR: (m) => { MCR = m; },
      getJsCTX: () => CTX,
      getJsSctOK: () => window.__sctOK,
    };`,
    ctx,
    { filename: 'oracle-bridge.js' },
  );

  return ctx.__ORACLE__ as JsOracle;
}

function buildBoxReb(n: 1 | 2 | 3): Record<number, ChInput['reb'][string]> {
  const src = CHREB_DEF[n];
  const out: Record<number, ChInput['reb'][string]> = {};
  for (const [k, d] of Object.entries(src) as Array<
    [string, readonly [number, number, number, number, number]]
  >) {
    out[Number(k)] = {
      p: { d: d[0], s: d[1] },
      n: { d: d[2], s: d[3] },
      c: 50,
      v: { d: 0, s: d[4], nl: Math.ceil(1000 / d[4]) },
    };
  }
  return out;
}

describe('Step 5.1 — Clean-Room Differential Parity (Core, Foundations, Culverts & Walls)', () => {
  beforeAll(() => {
    oracle = loadCleanRoomJsOracle();
  });

  beforeEach(() => {
    autoCreateDom = true;
    clearBothStores();
    resetAllContexts();
    oracle.setJsIDP('');
    oracle.setJsSCTR(null);
    oracle.setJsMCR(null);
  });

  // =========================================================================
  // 1. context.ts
  // =========================================================================
  describe('1. context.ts vs modules/02 & 12', () => {
    it('resolveScopedIdCandidates matches JS $ lookup precedence across empty, primary, and fallback prefixes', () => {
      expect(resolveScopedIdCandidates('D', '')).toEqual(['D']);
      expect(resolveScopedIdCandidates('D', 'T_')).toEqual(['T_D', 'D']);
      expect(resolveScopedIdCandidates('D', 'U_')).toEqual(['U_D', 'T_D', 'D']);
      expect(resolveScopedIdCandidates('s2_WL', 'W_')).toEqual(['W_s2_WL', 'P_s2_WL', 's2_WL']);

      autoCreateDom = false;
      setBothStores({ D: '1.0', T_D: '1.5', U_D: '2.0', x: 'base', P_x: 'p1' });

      oracle.setJsIDP('');
      expect(oracle.dollar('D')?.id).toBe(resolveScopedIdCandidates('D', '').find((c) => existingDomIds.has(c)));
      expect(oracle.dollar('D')?.value).toBe('1.0');

      oracle.setJsIDP('U_');
      expect(oracle.dollar('D')?.id).toBe(resolveScopedIdCandidates('D', 'U_')[0]);
      expect(oracle.dollar('D')?.value).toBe('2.0');

      existingDomIds.delete('U_D');
      domElements.delete('U_D');
      expect(oracle.dollar('D')?.id).toBe(resolveScopedIdCandidates('D', 'U_')[1]);
      expect(oracle.dollar('D')?.value).toBe('1.5');

      oracle.setJsIDP('W_');
      expect(oracle.dollar('x')?.id).toBe(resolveScopedIdCandidates('x', 'W_')[1]);
      expect(oracle.dollar('x')?.value).toBe('p1');
    });

    it('withCtx isolates state per slot, handles nested prefixes, and restores prefix on throw', () => {
      const traceTs: string[] = [];
      const traceJs: string[] = [];

      setContextStore({ phic: '0.75', T_phic: '0.70' });
      expect(getIDP()).toBe('');
      expect(oracle.getJsIDP()).toBe('');

      const rTs = withCtx('T_', () => {
        traceTs.push(getIDP());
        contextState.cur3 = 'DB';
        const inner = withCtx('U_', () => {
          traceTs.push(getIDP());
          contextState.cur3 = 'CD';
          return contextState.cur3;
        });
        traceTs.push(`${getIDP()}:${contextState.cur3}:${inner}`);
        return traceTs.join('|');
      });

      const rJs = oracle.withCtx('T_', () => {
        traceJs.push(oracle.getJsIDP());
        const inner = oracle.withCtx('U_', () => {
          traceJs.push(oracle.getJsIDP());
          return 'CD';
        });
        traceJs.push(`${oracle.getJsIDP()}:DB:${inner}`);
        return traceJs.join('|');
      });

      expect(rTs).toBe(rJs);
      expect(getIDP()).toBe('');
      expect(oracle.getJsIDP()).toBe('');
      expect(CTX['T_']?.cur3).toBe('DB');

      expect(() =>
        withCtx('C_', () => {
          expect(getIDP()).toBe('C_');
          throw new Error('boom');
        }),
      ).toThrow('boom');
      expect(getIDP()).toBe('');
      expect(() =>
        oracle.withCtx('C_', () => {
          throw new Error('boom');
        }),
      ).toThrow('boom');
      expect(oracle.getJsIDP()).toBe('');
    });

    it('bilin matches JS TT/TB bilinear lookup including boundary clamping', () => {
      const probes: Array<[number, number]> = [
        [0.05, -0.5], // clamped low
        [0.075, -0.2], // corner exact
        [0.112, -0.07],
        [0.15, 0.0], // exact knot
        [0.188, 0.375],
        [0.25, 1.0], // max exact
        [0.4, 2.5], // clamped high
      ];
      for (const [vVal, eVal] of probes) {
        expectParityClose(bilin(TT, vVal, eVal), oracle.bilin(oracle.TT, vVal, eVal), 1e-12, `TT(${vVal},${eVal})`);
        expectParityClose(bilin(TB, vVal, eVal), oracle.bilin(oracle.TB, vVal, eVal), 1e-12, `TB(${vVal},${eVal})`);
      }
    });

    it('interp1 matches JS CH.lerp piecewise-linear interpolation and clamping', () => {
      const xs = [300, 600, 900, 1800, 3600];
      const ys = [4.4, 4.2, 4.0, 3.8, 3.6];
      for (const x of [100, 300, 450, 600, 1200, 2700, 3600, 5000]) {
        expectParityClose(interp1(x, xs, ys), oracle.CH.lerp(x, xs, ys), 1e-12, `interp1(${x})`);
      }
    });

    it('parseSum matches JS parseSum on SAMPLE_CD, SAMPLE_DB, case-insensitive and malformed inputs', () => {
      expectParityClose(parseSum(SAMPLE_CD), oracle.parseSum(oracle.SAMPLE_CD), 1e-12, 'SAMPLE_CD');
      expectParityClose(parseSum(SAMPLE_DB), oracle.parseSum(oracle.SAMPLE_DB), 1e-12, 'SAMPLE_DB');

      const mixed = [
        'nmin 1 2 -10.5 2.2 -3.3 0.1 12.34 -45.67',
        'badline foo bar baz',
        'M3max 4 9 100 1 2 NaN 4 5',
        'M2max 2 5 200 1.5 -2.5 0.5 66.6 11.1',
      ].join('\n');
      expectParityClose(parseSum(mixed), oracle.parseSum(mixed), 1e-12, 'parseSum(mixed)');
    });

    it('SCT2_LNK tuple matches JS SCT2_LNK identically', () => {
      expect(Array.from(SCT2_LNK)).toEqual(oracle.SCT2_LNK);
      expect(SCT2_LNK).toHaveLength(23);
    });
  });

  // =========================================================================
  // 2. math/rcmFrame.ts
  // =========================================================================
  describe('2. math/rcmFrame.ts vs CH.Frame & MD.plate', () => {
    it('chFrameSolve matches CH.Frame displacements and member end forces under springs, fixities, trapezoidal, axial, and nodal loads', () => {
      const nodes = [
        { x: 0, y: 0 },
        { x: 0, y: 3.2 },
        { x: 0.4, y: 3.6 },
        { x: 4.1, y: 3.6 },
        { x: 4.5, y: 3.2 },
        { x: 4.5, y: 0 },
      ];
      const makeEls = () => [
        { i: 0, j: 1, EA: 1.2e7, EI: 1.8e5 },
        { i: 1, j: 2, EA: 1.4e7, EI: 2.5e5 },
        { i: 2, j: 3, EA: 1.1e7, EI: 1.6e5 },
        { i: 3, j: 4, EA: 1.4e7, EI: 2.5e5 },
        { i: 4, j: 5, EA: 1.2e7, EI: 1.8e5 },
        { i: 0, j: 5, EA: 1.3e7, EI: 2.1e5 },
      ];
      const springs = [
        { n: 0, dof: 1 as const, k: 45000 },
        { n: 5, dof: 1 as const, k: 45000 },
        { n: 0, dof: 0 as const, k: 12000 },
      ];
      const fix = [{ n: 5, dof: 0 as const }];
      const lc = {
        el: [
          { e: 2, t: 't' as const, a: 0.3, b: 3.4, q1: -42.5, q2: -68.0 },
          { e: 0, t: 't' as const, a: 0, b: 3.2, q1: 18.0, q2: 34.0 },
          { e: 4, t: 'a' as const, a: 0.5, b: 2.8, q1: -12.0, q2: -12.0 },
        ],
        nod: [
          { n: 2, fx: 25, fy: -40, m: 14.5 },
          { n: 4, fx: -15, fy: 0, m: -8.0 },
        ],
      };

      const tsFrame = chFrameSolve(nodes, makeEls(), springs, fix);
      const jsFrame = oracle.CH.Frame(nodes, makeEls(), springs, fix);
      const tsOut = tsFrame.run(lc);
      const jsOut = jsFrame.run(lc);

      expectParityClose(tsOut.u, jsOut.u, 1e-9, 'Frame.u');
      expectParityClose(tsOut.R, jsOut.R, 1e-9, 'Frame.R');
    });

    it('mdPlateSolve matches MD.plate tapered 4-node Mindlin mesh & internal stress resultants', () => {
      const cases = [
        (y: number) => 18.5 * Math.max(0, 5.2 - y),
        () => 14.2,
        (y: number) => 8.0 + 1.5 * y,
      ];
      const tsPlate = mdPlateSolve(3.1, 5.2, 1.75, 0.45, cases, 6, 5);
      const jsPlate = oracle.MD.plate(3.1, 5.2, 1.75, 0.45, cases, 6, 5);

      expectParityClose(tsPlate.X, jsPlate.X, 1e-9, 'MD.plate.X');
      expectParityClose(tsPlate.Y, jsPlate.Y, 1e-9, 'MD.plate.Y');
      expectParityClose(tsPlate.els, jsPlate.els, 1e-9, 'MD.plate.els');
      expectParityClose(tsPlate.cen, jsPlate.cen, 1e-9, 'MD.plate.cen');
      expectParityClose(tsPlate.res, jsPlate.res, 1e-9, 'MD.plate.res');
    });
  });

  // =========================================================================
  // 3. math/rc.ts
  // =========================================================================
  describe('3. math/rc.ts vs modules/02, 03 & 12', () => {
    it('RC.mat, RC.bar, RC.flex, RC.crack, RC.shear, RC.run match JS RC identically', () => {
      const rawMat = {
        fc: 35,
        fy: 400,
        Es: 200000,
        K1: 1.0,
        wc: 2450,
        ag: 19,
        ge: 0.75,
        g1: 1.6,
        g3: 0.75,
        ecl: 0.002,
        etl: 0.005,
      };
      const tsM = RC.mat(rawMat);
      const jsM = oracle.RC.mat(rawMat);
      expectParityClose(tsM, jsM, 1e-9, 'RC.mat');

      for (const d of [10, 14, 20, 25, 32]) {
        expectParityClose(RC.bar(d), oracle.RC.bar(d), 1e-12, `RC.bar(${d})`);
      }

      const S: RcSectionInput = {
        b: 1000,
        h: 750,
        f1: { n: 8, s: 125, d: 25, dc: 65 },
        f2: { n: 5, s: 200, d: 18, dc: 60 },
        st: { s: 150, d: 12, n: 4 },
      };
      expectParityClose(RC.flex(S, tsM, true), oracle.RC.flex(S, jsM, true), 1e-9, 'RC.flex(+)');
      expectParityClose(RC.flex(S, tsM, false), oracle.RC.flex(S, jsM, false), 1e-9, 'RC.flex(-)');
      expectParityClose(RC.crack(S, tsM, 420), oracle.RC.crack(S, jsM, 420), 1e-9, 'RC.crack(+)');
      expectParityClose(RC.crack(S, tsM, -190), oracle.RC.crack(S, jsM, -190), 1e-9, 'RC.crack(-)');

      const flPos = RC.flex(S, tsM, true);
      expectParityClose(
        RC.shear(S, tsM, 650, 480, -300, 0.9, flPos),
        oracle.RC.shear(S, jsM, 650, 480, -300, 0.9, flPos),
        1e-9,
        'RC.shear',
      );

      const loads: RcLoadInput[] = [
        { id: 'CD I', st: 'CD', M: 680, V: 520, N: 340 },
        { id: 'CD II', st: 'CD', M: -280, V: -210, N: 120 },
        { id: 'SD I', st: 'SD', M: 460, V: 340, N: 230 },
        { id: 'DB I', st: 'DB', M: 820, V: 640, N: 180 },
      ];
      expectParityClose(RC.run(S, tsM, loads), oracle.RC.run(S, jsM, loads), 1e-9, 'RC.run');
    });

    it('circular section(), curve(), phiMnAt(), pt3(), capDir(), and compute3() match JS 02 & 12', () => {
      const secStore = {
        D: '1200',
        n1: '20',
        d1: '25',
        c1: '75',
        n2: '10',
        d2: '20',
        c2: '150',
        n3: '0',
        d3: '0',
        c3: '0',
        fc: '30',
        fy: '400',
        tie: 'S',
        phic: '0.75',
        phit: '0.9',
        phicE: '1',
        phitE: '1',
      };
      setBothStores(secStore);

      const tsSec = section();
      const jsSec = oracle.section();
      expectParityClose(tsSec, jsSec, 1e-9, 'section()');

      const directSec = buildCircularSection({
        D: 1200,
        layers: [
          { n: 20, d: 25, c: 75 },
          { n: 10, d: 20, c: 150 },
        ],
        fc: 30,
        fy: 400,
        tie: 'S',
      });
      expectParityClose(directSec, jsSec, 1e-9, 'buildCircularSection()');

      const tsCurve = curve(tsSec, 0.75, 0.9);
      const jsCurve = oracle.curve(jsSec, 0.75, 0.9);
      expectParityClose(tsCurve, jsCurve, 1e-9, 'curve()');

      for (const pVal of [-4500, -1500, 0, 1200, 4500, 9000, tsCurve.cap, 30000]) {
        expectParityClose(phiMnAt(tsCurve, pVal), oracle.phiMnAt(jsCurve, pVal), 1e-9, `phiMnAt(${pVal})`);
      }

      for (const [al, c] of [
        [0.2, 300],
        [Math.PI / 5, 550],
        [-0.7, 920],
        [Math.PI / 2, 1600],
      ]) {
        expectParityClose(pt3(tsSec, al, c, 0.75, 0.9), oracle.pt3(jsSec, al, c, 0.75, 0.9), 1e-9, `pt3(${al},${c})`);
      }

      for (const [th, pVal] of [
        [0, 1200],
        [Math.PI / 6, 3500],
        [Math.PI / 3, -500],
        [Math.PI / 2, 0],
        [Math.PI, 4500],
        [-Math.PI / 4, 2200],
      ]) {
        expectParityClose(
          capDir(tsSec, th, pVal, 0.75, 0.9, tsCurve.cap),
          oracle.capDir(jsSec, th, pVal, 0.75, 0.9, jsCurve.cap),
          1e-9,
          `capDir(${th},${pVal})`,
        );
      }

      const LCD: CircularComboLoad[] = [
        {
          nm: 'Nmax',
          key: 'Nmax',
          r: { tc: 1, th: 1, N: 4200, Q2: 0, Q3: 0, M1: 0, M2: 410, M3: 680 },
          P: 4200,
          Mx: 680,
          My: 410,
          M: Math.hypot(680, 410),
        },
        {
          nm: 'Nmin',
          key: 'Nmin',
          r: { tc: 1, th: 2, N: -350, Q2: 0, Q3: 0, M1: 0, M2: -310, M3: 240 },
          P: -350,
          Mx: 240,
          My: -310,
          M: Math.hypot(240, -310),
        },
      ];
      const LDB: CircularComboLoad[] = [
        {
          nm: 'DB1',
          key: 'M3max',
          r: { tc: 2, th: 1, N: 2800, Q2: 0, Q3: 0, M1: 0, M2: -750, M3: 1120 },
          P: 2800,
          Mx: 1120,
          My: -750,
          M: Math.hypot(1120, -750),
        },
      ];

      const ts3 = compute3(tsSec, LCD, LDB);
      oracle.compute3(jsSec, LCD, LDB);
      const js3 = oracle.getJsST3();
      expectParityClose(ts3, js3, 1e-9, 'compute3');
    });
  });

  // =========================================================================
  // 4. foundations/shallowFdn.ts
  // =========================================================================
  describe('4. foundations/shallowFdn.ts vs modules/01 & 14', () => {
    it('SF.N17, SF.press, SF.soilQn, SF.check, SF.settle, and sfAnc match JS 01 & 14', () => {
      for (const phi of [0, 8.5, 18, 28, 32.4, 37, 42, 46]) {
        expectParityClose(SF.N17(phi), oracle.SF.N17(phi), 1e-9, `SF.N17(${phi})`);
      }

      const pressCases: Array<[number, number, number, number, number, number?]> = [
        [2500, 0, 0, 4.0, 6.0], // concentric
        [2500, 350, -450, 4.0, 6.0], // full biaxial compression (k=4)
        [1800, 1450, 0, 4.0, 6.0], // single-axis edge uplift (k=3)
        [1400, 1650, -2400, 4.0, 6.0, 80], // corner uplift (k=2)
        [0, 100, 100, 4.0, 6.0], // V <= 0
      ];
      for (const [V, My, Mx, B, L, n] of pressCases) {
        expectParityClose(
          SF.press(V, My, Mx, B, L, n),
          oracle.SF.press(V, My, Mx, B, L, n),
          1e-9,
          `SF.press(${V},${My},${Mx})`,
        );
      }

      expectParityClose(
        SF.soilQn({ c: 45, phi: 0, g: 18.5, pun: false, dqOn: true }, { Bp: 3.4, Lp: 5.8, Df: 2.0, Dw: 0.8 }, { V: 3200, Hx: 240, Hy: 110 }),
        oracle.SF.soilQn({ c: 45, phi: 0, g: 18.5, pun: false, dqOn: true }, { Bp: 3.4, Lp: 5.8, Df: 2.0, Dw: 0.8 }, { V: 3200, Hx: 240, Hy: 110 }),
        1e-9,
        'SF.soilQn(clay)',
      );
      expectParityClose(
        SF.soilQn({ c: 12, phi: 32, g: 19.2, pun: true, dqOn: true }, { Bp: 3.1, Lp: 4.9, Df: 1.8, Dw: 3.0 }, { V: 2900, Hx: 310, Hy: 180 }),
        oracle.SF.soilQn({ c: 12, phi: 32, g: 19.2, pun: true, dqOn: true }, { Bp: 3.1, Lp: 4.9, Df: 1.8, Dw: 3.0 }, { V: 2900, Hx: 310, Hy: 180 }),
        1e-9,
        'SF.soilQn(sand+pun)',
      );

      const ancRaw = { n: 12, d: 28, fy: 400, Dh: 50, Lr: 1.8, La: 0.75, fg: 30, tau: 0.75, mu: 0.7 };
      const tsAnc = sfAnc(ancRaw);
      const jsAnc = oracle.sfAnc(ancRaw);
      expectParityClose(tsAnc, jsAnc, 1e-9, 'sfAnc');

      const PSoil = {
        B: 4.2,
        L: 6.4,
        Df: 2.1,
        Dw: 1.5,
        rock: false,
        S: { c: 15, phi: 30, g: 19.0, pun: false, dqOn: true },
        qnRock: 0,
        fc: 30,
        phib: 0.45,
        phiT: 0.8,
        slide: 'cip' as const,
        dlt: 0,
        Rep: 220,
        phiEp: 0.5,
        Es: 32,
        nu: 0.3,
        Sa: 35,
        qsd: 260,
      };
      const combosSoil = [
        {
          id: 'CD I',
          st: 'CD' as const,
          V: 4200,
          Hx: 520,
          Hy: 180,
          Mx: -750,
          My: 1650,
          unf: { V: 3400, Hx: 410, Hy: 130 },
          Dw: 1.5,
        },
        {
          id: 'SD I',
          st: 'SD' as const,
          V: 3100,
          Hx: 340,
          Hy: 110,
          Mx: -510,
          My: 1080,
          unf: { V: 3100, Hx: 340, Hy: 110 },
          Dw: 1.5,
        },
        {
          id: 'DB I',
          st: 'DB' as const,
          V: 3550,
          Hx: 790,
          Hy: 260,
          Mx: -950,
          My: 2450,
          gEQ: 0.75,
          noLL: { V: 3200, Hx: 790, Hy: 260, Mx: -950, My: 2550 },
          st0: { V: 3350, My: 2500, Mx: -950 },
          Dw: 1.5,
        },
      ];
      expectParityClose(SF.check(PSoil, combosSoil), oracle.SF.check(PSoil, combosSoil), 1e-9, 'SF.check(soil)');
      expectParityClose(SF.settle(PSoil, combosSoil[1]), oracle.SF.settle(PSoil, combosSoil[1]), 1e-9, 'SF.settle(soil)');

      const PRock = {
        ...PSoil,
        rock: true,
        qnRock: 2800,
        phiT: 0.8,
        dlt: 36,
        Es: 450,
        nu: 0.25,
        Sa: 15,
        anc: tsAnc,
      };
      expectParityClose(SF.check(PRock, combosSoil), oracle.SF.check(PRock, combosSoil), 1e-9, 'SF.check(rock+anc)');
      expectParityClose(SF.settle(PRock, combosSoil[1]), oracle.SF.settle(PRock, combosSoil[1]), 1e-9, 'SF.settle(rock)');
    });
  });

  // =========================================================================
  // 5. foundations/pileGroup.ts
  // =========================================================================
  describe('5. foundations/pileGroup.ts vs modules/12', () => {
    it('RK.autoK, PILE.axialK, MC.latK, and MC.run match JS 12', () => {
      const rkInputs = [
        { type: 'Sét' as const, N: 2 },
        { type: 'Sét' as const, N: 6 },
        { type: 'Sét' as const, N: 18 },
        { type: 'Sét' as const, N: 42 },
        { type: 'Cuội' as const, N: 28 },
        { type: 'Cát' as const, raw: 'Cát thô', N: 22 },
        { type: 'Cát' as const, raw: 'Cát pha chặt vừa', N: 18 },
        { type: 'Cát' as const, raw: 'Cát pha chặt', N: 35 },
        { type: 'Cát' as const, raw: 'Cát bụi', N: 14 },
        { type: 'Cát' as const, raw: 'Cát lẫn sỏi', N: 32 },
        { type: 'Đá' as const, N: 60 },
      ];
      for (const inp of rkInputs) {
        expectParityClose(RK.autoK(inp), oracle.RK.autoK(inp), 1e-9, `RK.autoK(${inp.type}/${inp.raw ?? inp.N})`);
      }

      const axIn = {
        rows: [
          {
            i: 0,
            row: 0,
            name: '1',
            type: 'Sét' as const,
            top: 10,
            bot: -2,
            N: 10,
            qu: 0,
            rqd: 0,
            K: 4500,
            Ksrc: 'auto',
            Em: 0,
            a: 0.5,
            rock: false,
            h: 12,
          },
          {
            i: 1,
            row: 1,
            name: '2',
            type: 'Đá' as const,
            top: -2,
            bot: -14,
            N: 100,
            qu: 18,
            rqd: 72,
            K: 150000,
            Ksrc: 'rock',
            Em: 380,
            a: 0.85,
            rock: true,
            h: 12,
          },
        ],
        ELtop: 10,
        H: 18,
        D: 1.0,
        Ec: 30000,
        pts: [
          [-1.5, -2.0],
          [1.5, -2.0],
          [-1.5, 2.0],
          [1.5, 2.0],
        ] as Array<[number, number]>,
        E0s: 28,
        E01: 0,
        E02: 0,
        nu1: 0.32,
        nu2: 0.25,
      };
      expectParityClose(PILE.axialK(axIn), oracle.PILE.axialK(axIn), 1e-9, 'PILE.axialK(multi)');
      expectParityClose(
        PILE.axialK({ ...axIn, ktU: 165000 }),
        oracle.PILE.axialK({ ...axIn, ktU: 165000 }),
        1e-9,
        'PILE.axialK(ktU)',
      );

      expectParityClose(
        MC.latK(150000, 400, 1.8, 2.5, 16.0, 200000, 0.049, 100000, 0.785),
        oracle.MC.latK(150000, 400, 1.8, 2.5, 16.0, 200000, 0.049, 100000, 0.785),
        1e-9,
        'MC.latK',
      );

      const d = {
        Kn: 1,
        Evu: 3.1e6,
        Evn: 2.8e6,
        m: 500,
        Ax: 4.5,
        By: 6.0,
        Cz: 1.5,
        md: 400,
        mb: 350,
      };
      const Dp = 1.0;
      const Fp = (Math.PI * Dp * Dp) / 4;
      const Ip = (Math.PI * Dp ** 4) / 64;
      const piles = [
        { x: -1.4, y: -1.8, phi: 0, psi: 0, Lo: 1.8, H: 15, Bpx: 1.8, Bpy: 1.8, F: Fp, Fo: Fp, Ix: Ip, Iy: Ip, Jo: Ip, Po: 650, Co: 120000, Ct: 60000 },
        { x: 1.4, y: -1.8, phi: 7, psi: 0, Lo: 1.8, H: 15, Bpx: 1.8, Bpy: 1.8, F: Fp, Fo: Fp, Ix: Ip, Iy: Ip, Jo: Ip, Po: 650, Co: 120000, Ct: 60000 },
        { x: -1.4, y: 1.8, phi: -7, psi: 90, Lo: 1.8, H: 15, Bpx: 1.8, Bpy: 1.8, F: Fp, Fo: Fp, Ix: Ip, Iy: Ip, Jo: Ip, Po: 650, Co: 120000, Ct: 60000 },
        { x: 1.4, y: 1.8, phi: 0, psi: 0, Lo: 1.8, H: 15, Bpx: 1.8, Bpy: 1.8, F: Fp, Fo: Fp, Ix: Ip, Iy: Ip, Jo: Ip, Po: 650, Co: 120000, Ct: 60000, r1: 42000 },
      ];
      const loads = [
        [85, -35, 1450, 120, 480, 45],
        [-40, 60, 980, -190, -210, -20],
      ];
      const tsMc = MC.run(d, piles, loads);
      const jsMc = oracle.MC.run(d, piles, loads);
      expectParityClose(tsMc.Kc, jsMc.Kc, 1e-9, 'MC.run.Kc');
      expectParityClose(tsMc.res, jsMc.res, 1e-9, 'MC.run.res');
      expectParityClose(tsMc.parts.map((p) => p.PK), jsMc.parts.map((p) => p.PK), 1e-9, 'MC.run.parts');
    });
  });

  // =========================================================================
  // 6. foundations/drilledShaft.ts
  // =========================================================================
  describe('6. foundations/drilledShaft.ts vs modules/12', () => {
    it('alphaB1 and SCT.calc match JS 12 across Set, Cat, Cuoi, IGM I/II, and Da (HB & Intact)', () => {
      for (const r of [0, 0.4, 1.0, 2.3, 5.8, 7.0, 9.5]) {
        for (const qu of [0.2, 1.2, 4.7, 15.0, 24.0]) {
          expectParityClose(alphaB1(qu, r), oracle.SCT.alphaB1(qu, r), 1e-12, `alphaB1(${qu},${r})`);
        }
      }

      const rf = {
        Sét: [0.45, 0.4, 0.35],
        Cát: [0.55, 0.5, 0.45],
        IGM: [0.6, 0.55, 0.5],
        IGM1: [0.55, 0.5, 0.45],
        Đá: [0.55, 0.5, 0.5],
      } as const;

      const sctInBase: SctCalcInput = {
        D: 1.2,
        L: 28,
        ELcap: 12.0,
        ELgs: 10.5,
        s: 3.6,
        gcF: 25,
        spt: [
          { z: 9.0, N: 8 },
          { z: 6.0, N: 11 },
          { z: 1.5, N: 24 },
        ],
        noSplit: false,
        oneRow: false,
        cap: true,
        rockSide: 'AE',
        rkMob: 'both',
        svJ: 0.4,
        tdJ: 2.5,
        WL: 9.2,
        layers: [
          { row: 0, name: '1', raw: 'Sét', bot: 4.0, type: 'Sét', g: 18.2, N: 9, qu: 0, rqd: 0, aE: 0, open: null },
          { row: 1, name: '2', raw: 'Cát', bot: -2.0, type: 'Cát', g: 19.4, N: 22, qu: 0, rqd: 0, aE: 0, open: null },
          { row: 2, name: '3', raw: 'Cuội', bot: -6.0, type: 'Cuội', g: 20.5, N: 38, qu: 0, rqd: 0, aE: 0, open: null },
          { row: 3, name: '4', raw: 'IGM', bot: -9.5, type: 'IGM', g: 21.0, N: 75, qu: 1.2, rqd: 25, aE: 0, open: null },
          { row: 4, name: '5', raw: 'IGM', bot: -13.0, type: 'IGM', g: 22.0, N: 120, qu: 3.2, rqd: 45, aE: 0, open: null },
          { row: 5, name: '6', raw: 'Đá', bot: -18.0, type: 'Đá', g: 24.5, N: 150, qu: 18.0, rqd: 72, aE: 0, open: false },
        ],
        fc: 35,
        gc: 25,
        gW: 1.25,
        mSand: 1,
        ER: 60,
        corrN: true,
        qsMax: 0,
        open: false,
        tipRock: 'HB',
        GSI: 58,
        mi: 14,
        Dd: 0.3,
        kSu: 5.2,
        etaU: 0.8,
        rf,
      };

      expectParityClose(SCT.calc(sctInBase), oracle.SCT.calc(sctInBase), 1e-9, 'SCT.calc(HB+all-layers)');

      // Tip in Clay (Sét) + Intact Rock check + IGM III promotion (qu >= 23.9)
      const sctIntact: SctCalcInput = {
        ...sctInBase,
        L: 11,
        ELcap: 12,
        ELgs: 12,
        oneRow: true,
        cap: false,
        tipRock: 'I',
        layers: [
          { row: 0, name: '1', raw: 'IGM', bot: 7.0, type: 'IGM', g: 22.5, N: 120, qu: 26.0, rqd: 80, aE: 0, open: null },
          { row: 1, name: '2', raw: 'Sét', bot: 0.0, type: 'Sét', g: 18.8, N: 18, qu: 0, rqd: 0, aE: 0, open: null },
        ],
      };
      expectParityClose(SCT.calc(sctIntact), oracle.SCT.calc(sctIntact), 1e-9, 'SCT.calc(clay-tip+IGM3)');
    });

    it('sctCheck matches JS 12 single-pile compression/uplift, group block failure, and settlement limits', () => {
      const sctIn: SctCalcInput = {
        D: 1.0,
        L: 20.0,
        ELcap: 10.0,
        ELgs: 10.0,
        s: 3.0,
        oneRow: false,
        cap: true,
        WL: 8.5,
        layers: [
          { row: 0, name: '1', raw: 'Sét', bot: 0.0, type: 'Sét', g: 18.0, N: 10, qu: 0, rqd: 0, aE: 0, open: null },
          { row: 1, name: '2', raw: 'Sét', bot: -12.0, type: 'Sét', g: 18.5, N: 14, qu: 0, rqd: 0, aE: 0, open: null },
        ],
        fc: 30,
        gc: 25,
        gW: 1.25,
        ER: 60,
        kSu: 5,
        rf: {
          Sét: [0.45, 0.4, 0.35],
          Cát: [0.55, 0.5, 0.45],
          IGM: [0.6, 0.55, 0.5],
          IGM1: [0.55, 0.5, 0.45],
          Đá: [0.55, 0.5, 0.5],
        },
      };
      const R = SCT.calc(sctIn);
      if ('err' in R) throw new Error(R.err);

      const MCR = {
        piles: [
          { x: -1.5, y: -1.5 },
          { x: 1.5, y: -1.5 },
          { x: -1.5, y: 1.5 },
          { x: 1.5, y: 1.5 },
        ],
        rows: {
          'TTGH CƯỜNG ĐỘ VÀ SỬ DỤNG': [
            { tc: 1, th: 1, N: 145 },
            { tc: 3, th: 2, N: -12 },
          ],
          'TTGH ĐẶC BIỆT': [
            { tc: 2, th: 1, N: 195 },
            { tc: 4, th: 2, N: -24 },
          ],
        },
        LC: [[10, 5, 420]],
        LD: [[15, 8, 560]],
        U1: [
          [0.012, 0.008, 0.022, 0, 0, 0],
          [0.018, 0.006, 0.031, 0, 0, 0],
        ],
      };

      setBothStores({
        s2_WL: '8.5',
        s2_phig: '0.6',
        s2_dhL: '25',
        s2_dzL: '50',
        s2_ER: '60',
        s2_kSu: '5',
        s2_ddL: '',
      });

      oracle.setJsSCTR(R);
      oracle.setJsMCR(MCR);
      oracle.sctCheck();
      const jsOk = oracle.getJsSctOK().M;

      const tsChk = sctCheck({ MCR, SCTR: R });
      expect(tsChk).not.toBeNull();
      expect(tsChk!.okAll).toBe(jsOk);
      expect(contextState.sctOK.M).toBe(jsOk);

      const tbCmpHtml = oracle.dollar('tbCmp')?.innerHTML ?? '';
      const tbGrpHtml = oracle.dollar('tbGrp')?.innerHTML ?? '';
      const tbDspHtml = oracle.dollar('tbDsp')?.innerHTML ?? '';
      expect(tsChk!.singleCompOk && tsChk!.blockOk).toBe(tsChk!.compOk);
      expect(tbCmpHtml).toContain((R.QRcd / 9.81).toFixed(2));
      expect(tbCmpHtml).toContain((R.QRdb / 9.81).toFixed(2));
      expect(tbGrpHtml).toContain((tsChk!.Qg / 9.81).toFixed(2));
      expect(tbGrpHtml).toContain(tsChk!.QRgCD.toFixed(2));
      expect(tbGrpHtml).toContain(tsChk!.QRgDB.toFixed(2));
      expect(tbDspHtml).toContain(tsChk!.maxDhMm.toFixed(2));
      expect(tbDspHtml).toContain(tsChk!.maxDzMm.toFixed(2));
    });
  });

  // =========================================================================
  // 7. culvertsWalls/boxCulvert.ts
  // =========================================================================
  describe('7. culvertsWalls/boxCulvert.ts vs modules/11 & 07', () => {
    const makeBoxInput = (n: 1 | 2 | 3, hs: number): ChInput => ({
      n,
      H: 2.5,
      B: 2.5,
      tt: 0.3,
      tw: 0.3,
      twi: 0.25,
      tb: 0.32,
      tv: 0.15,
      hma: 0.1,
      gma: 23,
      hmo: hs < 0.3 ? 0.1 : 0.3,
      gmo: 21,
      hs,
      gs: 19,
      phi: 30,
      gw: 9.81,
      wc: 2450,
      K1: 1,
      gc: 24.5,
      fc: 30,
      st: 'CB400-V',
      fy: 400,
      fu: 570,
      Es: 200000,
      Fecap: 1.0,
      nl: 2,
      lane: 1,
      ehmin: 1,
      soil: 'd',
      k03: 0.5,
      Lc: 10,
      kUser: 0,
      etaD: 1,
      etaR: 1,
      etaI: 1,
      eta: 1,
      g3: 400 / 570,
      ge: 0.75,
      ag: 20,
      dl: { d: 12, s: 200 },
      water: 1,
      m: 1.0,
      reb: buildBoxReb(n),
    });

    it('CH.calc matches JS 11 for 1-cell, 2-cell, and 3-cell boxes across thin and deep cover', () => {
      for (const [n, hs] of [
        [1, 0.2], // thin cover < 600mm
        [1, 2.2], // deep fill >= 600mm
        [2, 0.35],
        [3, 1.5],
      ] as const) {
        const inp = makeBoxInput(n, hs);
        const tsRes = CH.calc(inp);
        const jsRes = oracle.CH.calc(inp);
        expectParityClose(tsRes.A.o, jsRes.A.o, 1e-9, `CH(${n},${hs}).A.o`);
        expectParityClose(tsRes.A.G.Bc, jsRes.A.G.Bc, 1e-9, `CH(${n},${hs}).A.G.Bc`);
        expectParityClose(tsRes.A.G.xs, jsRes.A.G.xs, 1e-9, `CH(${n},${hs}).A.G.xs`);
        expectParityClose(tsRes.A.G.cells, jsRes.A.G.cells, 1e-9, `CH(${n},${hs}).A.G.cells`);
        expectParityClose(tsRes.A.S, jsRes.A.S, 1e-9, `CH(${n},${hs}).A.S`);
        expectParityClose(tsRes.A.out, jsRes.A.out, 1e-9, `CH(${n},${hs}).A.out`);
        expectParityClose(tsRes.A.LL, jsRes.A.LL, 1e-9, `CH(${n},${hs}).A.LL`);
        expectParityClose(tsRes.A.reac, jsRes.A.reac, 1e-9, `CH(${n},${hs}).A.reac`);
        expectParityClose(tsRes.A.mem, jsRes.A.mem, 1e-9, `CH(${n},${hs}).A.mem`);
        expectParityClose(tsRes.EN, jsRes.EN, 1e-9, `CH(${n},${hs}).EN`);
        expectParityClose(tsRes.DS, jsRes.DS, 1e-9, `CH(${n},${hs}).DS`);
        expectParityClose(tsRes.SH, jsRes.SH, 1e-9, `CH(${n},${hs}).SH`);
        expectParityClose(tsRes.I, jsRes.I, 1e-9, `CH(${n},${hs}).I`);
      }
    });

    it('CHN.calc matches JS 07 for both soil bearing/settlement and rock bearing', () => {
      const boxIn = makeBoxInput(2, 1.8);
      const boxRes = CH.calc(boxIn);

      const soilIn: ChnSoilInput = {
        rock: false,
        c: 22,
        phi: 26,
        g: 18.8,
        Dw: 0.5,
        phib: 0.45,
        theta: 90,
        qu: 0,
        RMR: 0,
        rockT: 'C',
        phibR: 0.45,
        Df: 1.2,
        Scp: 8,
        gtb: 19,
        g1: 18.5,
        h1: 2.0,
        g2: 19.8,
        EP: [
          [0, 0.85],
          [100, 0.78],
          [200, 0.73],
          [400, 0.67],
        ],
      };

      expectParityClose(
        CHN.calc(boxIn, boxRes, soilIn, CH),
        oracle.CHN.calc(boxIn, boxRes, soilIn, oracle.CH),
        1e-9,
        'CHN.calc(soil)',
      );

      const rockIn: ChnSoilInput = {
        ...soilIn,
        rock: true,
        qu: 14,
        RMR: 52,
        rockT: 'B',
        phibR: 0.45,
      };
      expectParityClose(
        CHN.calc(boxIn, boxRes, rockIn, CH),
        oracle.CHN.calc(boxIn, boxRes, rockIn, oracle.CH),
        1e-9,
        'CHN.calc(rock)',
      );
    });
  });

  // =========================================================================
  // 8. culvertsWalls/pipeCulvert.ts
  // =========================================================================
  describe('8. culvertsWalls/pipeCulvert.ts vs modules/11', () => {
    it('CT.calc matches JS 11 across Heger Installation Types 1–4, direct & indirect, thin & deep cover', () => {
      const baseCt: CtInput = {
        D0: 1.5,
        t: 0.16,
        hs: 1.2,
        hma: 0.12,
        hmo: 0.35,
        tm: 0.15,
        gma: 23,
        gmo: 21,
        gs: 19,
        gc: 24.5,
        fc: 35,
        wc: 2450,
        K1: 1,
        st: 'CB400-V',
        fy: 400,
        Es: 200000,
        gw: 9.81,
        inst: 1,
        psi: 0,
        nl: 2,
        lane: 1,
        water: 1,
        etaD: 1,
        etaI: 1,
        cages: 2,
        D025: 90,
        mm: 'T',
        phiB: 30,
        fyv: 300,
        sv: 100,
        nlay: 2,
        C1: 0,
        ri: { d: 14, s: 100, c: 30 },
        ro: { d: 12, s: 120, c: 30 },
        m: 1.0,
      };

      const assertCtParity = (inp: CtInput, label: string) => {
        const ts = CT.calc(inp);
        const js = oracle.CT.calc(inp);
        expectParityClose(ts.A.o, js.A.o, 1e-9, `${label}.A.o`);
        expectParityClose(ts.A.L, js.A.L, 1e-9, `${label}.A.L`);
        expectParityClose(ts.A.out, js.A.out, 1e-9, `${label}.A.out`);
        expectParityClose(ts.A.M.nodes, js.A.M.nodes, 1e-9, `${label}.A.M.nodes`);
        expectParityClose(
          ts.A.M.F.els,
          (js.A.M as unknown as { els: unknown }).els,
          1e-9,
          `${label}.A.M.els`,
        );
        expectParityClose(ts.EN, js.EN, 1e-9, `${label}.EN`);
        expectParityClose(ts.DS, js.DS, 1e-9, `${label}.DS`);
        expectParityClose(ts.IN, js.IN, 1e-9, `${label}.IN`);
      };

      for (const inst of [1, 2, 3, 4] as const) {
        const inp = { ...baseCt, inst };
        assertCtParity(inp, `CT.calc(inst=${inst})`);
      }

      const thinPipe: CtInput = {
        ...baseCt,
        D0: 0.8,
        t: 0.1,
        hs: 0.05,
        hma: 0.08,
        hmo: 0.12,
        cages: 1,
        inst: 2,
      };
      assertCtParity(thinPipe, 'CT.calc(thin+1cage)');
    });
  });

  // =========================================================================
  // 9. culvertsWalls/wallGravity.ts
  // =========================================================================
  describe('9. culvertsWalls/wallGravity.ts vs modules/06', () => {
    it('TC_LIB, TC_LIB86, and tc86Row match JS 06 identically', () => {
      expectParityClose(TC_LIB, oracle.TC_LIB, 1e-12, 'TC_LIB');
      expectParityClose(TC_LIB86, oracle.TC_LIB86, 1e-12, 'TC_LIB86');

      for (const [gk, H1, H, Rk] of [
        ['1a', 1.0, 4.0, '2'],
        ['1a', 1.0, 4.35, '3'],
        ['2b', 0.5, 5.2, '2'],
        ['3', 0, 3.0, '2'],
        ['3', 0, 3.0, '3'],
        ['1a', 1.0, 99.0, '2'],
        ['missing', 1.0, 4.0, '2'],
      ] as const) {
        expectParityClose(
          tc86Row(gk, H1, H, Rk),
          oracle.tc86Row(gk, H1, H, Rk),
          1e-12,
          `tc86Row(${gk},${H1},${H},${Rk})`,
        );
      }
    });

    it('TC.calc matches JS 06 across masonry/concrete, sloped backfill, clay/SPT/rock, and bamboo piles', () => {
      const baseTc: TcInput = {
        H: 4.5,
        b0: 0.65,
        n1: 0.12,
        n2: 0.25,
        hc: 0.2,
        a1: 0.35,
        a2: 0.4,
        t1: 0.55,
        t2: 0.65,
        hf: 0.25,
        m: 1.5,
        Hs: 1.2,
        q: 10,
        LL: true,
        dT: 0.8,
        gs: 18.5,
        phi: 30,
        delta: 15,
        cs: 5,
        gm: 21,
        gb: 24,
        stemMat: 'm',
        R: 3.5,
        Rku: 0.2,
        Rc: 0.08,
        gr: 1.0,
        nsh: 0.5,
        mu: 0.7,
        md: 1,
        phi1: 1,
        Rbtf: 0.75,
        footMat: 'm',
        gfm: 21,
        fRku: 0.2,
        fRc: 0.08,
        gf: 18.8,
        phif: 28,
        cf: 12,
        soil: 'c',
        Su: 50,
        Dw: 1.2,
        rock: false,
        brmR: 'ck',
        qu: 12,
        RMR: 55,
        rockT: 'B',
        phibR: 0.45,
        phib: 0.45,
        phit: 0.8,
        qRu: 0,
        eta: 1,
        brm: 'lt',
        Nspt: 14,
        Ri: 1,
        phibS: 0.45,
        ctD: 0.08,
        ctL: 2.5,
        ctn: 16,
        ctm: 0.8,
        ctF: 1.4,
      };
      expectParityClose(TC.calc(baseTc), oracle.TC.calc(baseTc), 1e-9, 'TC.calc(masonry+lt)');

      const clayWeakSpt: TcInput = {
        ...baseTc,
        stemMat: 'c',
        footMat: 'c',
        soil: 'd',
        brm: 'spt',
        Nspt: 6,
        Su: 28,
        qRu: 0,
        R: 2.1,
      };
      expectParityClose(TC.calc(clayWeakSpt), oracle.TC.calc(clayWeakSpt), 1e-9, 'TC.calc(clay+spt+bamboo)');

      const rockWall: TcInput = {
        ...baseTc,
        stemMat: 'c',
        footMat: 'c',
        rock: true,
        brmR: 'ck',
        R: 2.4,
        Hs: 0,
        LL: false,
      };
      expectParityClose(TC.calc(rockWall), oracle.TC.calc(rockWall), 1e-9, 'TC.calc(rock)');
    });
  });

  // =========================================================================
  // 10. culvertsWalls/wallCantilever.ts
  // =========================================================================
  describe('10. culvertsWalls/wallCantilever.ts vs modules/09', () => {
    it('TL.calc and tlRC match JS 09 across soil+interface+shrinkage and rock+anchors', () => {
      const baseTl: TlInput = {
        H: 5.0,
        t: 0.35,
        n1: 0,
        n2: 0.06,
        b1: 1.1,
        b4: 2.3,
        hm: 0.55,
        ht: 0.45,
        hh: 0.45,
        hf: 0.3,
        Hs: 1.5,
        m: 1.5,
        q: 10,
        LL: true,
        dT: 0.6,
        gs: 18.8,
        phi: 31,
        dw: 15,
        dvA: true,
        dv: 0,
        cs: 4,
        gc: 24.5,
        fc: 30,
        fy: 400,
        ag: 20,
        ge: 0.75,
        cov: 50,
        covB: 75,
        sbd: 20,
        sbs: 150,
        sfd: 14,
        sfs: 200,
        fbd: 18,
        fbs: 150,
        ftd: 18,
        fts: 150,
        hd: 12,
        hs: 200,
        ld: 12,
        ls: 200,
        ift: 'y',
        soil: 'c',
        rock: false,
        gf: 19,
        phif: 29,
        cf: 15,
        Su: 60,
        Dw: 1.5,
        brm: 'lt',
        phib: 0.45,
        Nspt: 18,
        Ri: 1,
        phibS: 0.45,
        brmR: 'ck',
        qu: 15,
        RMR: 55,
        rockT: 'B',
        phibR: 0.45,
        qRu: 0,
        phit: 0.85,
        eta: 1,
        anc: false,
        aOT: false,
        ad: 25,
        afy: 400,
        aDh: 50,
        atau: 0.8,
        aLr: 1.8,
        aLc: 0.4,
        agf: 30,
        as: 1.2,
        aX: [0.55],
        amu: 0.7,
        phs: 0.9,
        php: 0.5,
      };

      const tsSoil = TL.calc(baseTl);
      const jsSoil = oracle.TL.calc(baseTl);
      expectParityClose(tsSoil, jsSoil, 1e-9, 'TL.calc(soil+ift)');

      expect(
        tlRC('Thân tường', tsSoil.st.Sb, tsSoil.M, tsSoil.st.rc, ['Sau', 'Trước']),
      ).toBe(
        oracle.tlRC('Thân tường', jsSoil.st.Sb, jsSoil.M, jsSoil.st.rc, ['Sau', 'Trước']),
      );
      expect(
        tlRC('Mũi móng', tsSoil.Sf, tsSoil.M, tsSoil.toe.rc, ['Dưới', 'Trên'], '<p>note</p>'),
      ).toBe(
        oracle.tlRC('Mũi móng', jsSoil.Sf, jsSoil.M, jsSoil.toe.rc, ['Dưới', 'Trên'], '<p>note</p>'),
      );
      expect(
        tlRC('Gót móng', tsSoil.Sf, tsSoil.M, tsSoil.heel.rc, ['Trên', 'Dưới']),
      ).toBe(
        oracle.tlRC('Gót móng', jsSoil.Sf, jsSoil.M, jsSoil.heel.rc, ['Trên', 'Dưới']),
      );

      const rockAnc: TlInput = {
        ...baseTl,
        rock: true,
        soil: 'r',
        ift: 'n',
        anc: true,
        aOT: true,
        aX: [0.4, 2.8],
        Hs: 0,
        LL: false,
      };
      expectParityClose(TL.calc(rockAnc), oracle.TL.calc(rockAnc), 1e-9, 'TL.calc(rock+anc)');
    });
  });

  // =========================================================================
  // 11. bridge/approachSlab.ts
  // =========================================================================
  describe('11. bridge/approachSlab.ts vs modules/07', () => {
    it('QD.calc matches JS 07 across <300mm, 300–600mm, and >=600mm soil cover and lane counts', () => {
      const baseQd: QdInput = {
        L: 6.0,
        Lsrc: true,
        h: 0.3,
        k: 2 / 3,
        h1: 0.1,
        h1n: 0.1,
        g1: 23,
        h2: 0.15,
        h2n: 0.15,
        g2: 21,
        hs: 0.15,
        gs: 18.5,
        gc: 24.5,
        gcm: 2450,
        K1: 1,
        fc: 30,
        fy: 400,
        mlane: 1.2,
        nl: '1',
        qlane: 9.3,
        LT: 250,
        wt: 510,
        LLDF: 1.15,
        eta: 1.0,
        db: 20,
        sb: 150,
        cb: 50,
        dt: 14,
        st: 200,
        ct: 40,
        g3: 0.75,
        ge: 0.75,
        ag: 19,
        nv: 4,
        dv: 10,
        sv: 150,
        Lc: 0.3,
        L1: 0.15,
        L2: 0.15,
        Hh: 0.4,
        Hcm: 0.45,
      };

      expectParityClose(QD.calc(baseQd), oracle.QD.calc(baseQd), 1e-9, 'QD.calc(450mm)');
      expectParityClose(
        QD.calc({ ...baseQd, h1: 0.08, h2: 0.08, hs: 0.04, Hcm: 0.2 }),
        oracle.QD.calc({ ...baseQd, h1: 0.08, h2: 0.08, hs: 0.04, Hcm: 0.2 }),
        1e-9,
        'QD.calc(<300mm)',
      );
      expectParityClose(
        QD.calc({ ...baseQd, hs: 0.75, Hcm: 1.0, mlane: 1.0, nl: '2' }),
        oracle.QD.calc({ ...baseQd, hs: 0.75, Hcm: 1.0, mlane: 1.0, nl: '2' }),
        1e-9,
        'QD.calc(>=600mm,2lanes)',
      );
    });
  });
});
