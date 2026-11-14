import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  clearContextStore,
  resetAllContexts,
  setContextStore,
  updateContextStore,
} from '../../../src/culvert/engine/context.ts';
import {
  IPAN,
  ITOP,
  SUPDIST,
  XFgir,
  XFmk,
  spXF,
  type CrossfallConfig,
  type CrossfallModel,
  type IPanDrawOptions,
  type SupDistInput,
} from '../../../src/culvert/engine/bridge/crossfall.ts';
import {
  DAM,
  RCG,
  RC_LIB,
  damLoadLib,
  damStep,
  evalDamLimits,
  evalDamSummary,
  evalRcgSummary,
  girderInputs,
  rcgInputs,
  rcgLoadLib,
  rcgStep,
  setLatestDamResult,
  setLatestRcgResult,
  spInputs,
  toHollowGirderResult,
  toRcGirderResult,
  type DamCalcResult,
  type DamCompositeResult,
  type DamGirderInput,
  type DamLibKey,
  type DamSpInput,
  type RcCalcResult,
  type RcInput,
} from '../../../src/culvert/engine/bridge/girderHollow.ts';
import {
  GI,
  evalGiSummary,
  giInputs,
  giLoadLib,
  giStep,
  setLatestGirResult,
  toIGirderResult,
  type GiCalcResult,
  type GiCompositeResult,
  type GiInput,
} from '../../../src/culvert/engine/bridge/girderI.ts';
import {
  GL_TL,
  GL_VEH,
  bmCalc,
  bmOhCalc,
  bmOhStep,
  gcCalc,
  gcStep,
  glB1,
  glBlk,
  glCalc,
  glPolyA,
  glW,
  glcStep,
  kcgCalc,
  kcgStep,
  kdStep,
  ltnCalc,
  ltnStep,
  setLatestGlcResult,
  setLatestKcgResult,
  setLatestLtnResult,
  setLatestSup2Result,
  stripSolve,
  sup2Step,
  supApply,
  supK,
  toDeckComponentSummary,
  toGirderWithDeckResult,
  type BmInput,
  type BmOhInput,
  type BmOhResult,
  type BmResult,
  type GcBearingInput,
  type GcCalcResult,
  type GcReactionInput,
  type GlInput,
  type GlcCalcResult,
  type KcgCalcResult,
  type KcgInput,
  type KdStepResult,
  type LtnCalcResult,
  type LtnInput,
  type Sup2Result,
} from '../../../src/culvert/engine/bridge/deckJoints.ts';
import type { Point2D } from '../../../src/culvert/types/project.ts';

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
  className: string;
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

interface SuperJsOracle {
  XFmk: typeof XFmk;
  XFgir: typeof XFgir;
  ITOP: typeof ITOP;
  IPAN: typeof IPAN;
  SUPDIST: typeof SUPDIST;
  spXF: typeof spXF;
  DAM: typeof DAM;
  RCG: typeof RCG;
  GI: typeof GI;
  spInputs: () => DamSpInput;
  girderInputs: (k: 'g' | 'b') => DamGirderInput;
  damLoadLib: () => void;
  damStep: () => void;
  damRender: (
    k: 'g' | 'b',
    R: DamCalcResult,
    I: DamSpInput,
    G: DamGirderInput,
    LIM: ReturnType<typeof evalDamLimits>,
  ) => void;
  rcgInputs: () => RcInput;
  rcgLoadLib: () => void;
  rcgStep: (I?: DamSpInput, LIM?: ReturnType<typeof evalDamLimits>) => unknown;
  rcgRender: (k: 'g' | 'b', R: RcCalcResult, I: DamSpInput, G: RcInput, RR: Record<string, unknown>) => void;
  giInputs: () => GiInput;
  giLoadLib: () => void;
  giStep: (I?: DamSpInput, LIM?: ReturnType<typeof evalDamLimits>) => void;
  giRender: (
    k: 'g' | 'b',
    R: GiCalcResult,
    I: DamSpInput,
    G: GiInput,
    LIM: ReturnType<typeof evalDamLimits>,
    RR: Record<string, unknown>,
  ) => void;
  supK: typeof supK;
  supApply: typeof supApply;
  kdStep: (I: DamSpInput) => KdStepResult | null;
  stripSolve: typeof stripSolve;
  bmCalc: typeof bmCalc;
  bmOhCalc: typeof bmOhCalc;
  bmOhStep: (I: DamSpInput, R: BmResult) => BmOhResult;
  gcCalc: typeof gcCalc;
  sup2Step: () => void;
  ltnCalc: typeof ltnCalc;
  ltnStep: (I: DamSpInput, out?: Sup2Result | null) => LtnCalcResult | undefined;
  kcgCalc: typeof kcgCalc;
  kcgStep: (I: DamSpInput) => KcgCalcResult | null;
  glPolyA: typeof glPolyA;
  glW: typeof glW;
  glB1: typeof glB1;
  glBlk: typeof glBlk;
  glCalc: typeof glCalc;
  glcStep: (I: DamSpInput) => GlcCalcResult | null;
  getJsDAMR: () => DamCompositeResult | null;
  getJsGIR: () => GiCompositeResult | null;
  getJsRCGR: () => DamCompositeResult | null;
  getJsSUP2R: () => Sup2Result | null;
  getJsLTNR: () => LtnCalcResult | null;
  getJsKCGR: () => KcgCalcResult | null;
  getJsGLCR: () => GlcCalcResult | null;
  resetState: () => void;
  dollar: (id: string) => MockEl | null;
}

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(TEST_DIR, '../../..');
const MODULES_DIR = resolve(WEB_ROOT, '../analysis-cau-cong/modules');

const SUPER_MODULE_FILES = [
  '01_boot_shims_and_sf.js',
  '02_core_utils_and_column_pm.js',
  '04_girder_slab_hollow_rc.js',
  '05_girder_post_tensioned_i.js',
  '10_superstructure_ui_and_deck_joints.js',
] as const;

const SUPER_TS_FILES = [
  'src/culvert/engine/bridge/crossfall.ts',
  'src/culvert/engine/bridge/girderHollow.ts',
  'src/culvert/engine/bridge/girderI.ts',
  'src/culvert/engine/bridge/deckJoints.ts',
] as const;

let oracle: SuperJsOracle;
let domElements: Map<string, MockEl>;

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
    className: '',
    style: {},
    dataset: {},
    attributes: {},
    options: [],
    children: [],
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

function defaultSuperInputs(): Record<string, string | number | boolean> {
  return {
    tq_obj: 'all',
    tq_off: '',
    tq_bltn: '0',
    sp_type: 'BR',
    sp_lib: '18',
    gi_lib: '33',
    sp_hm: 'Kết cấu phần trên - dầm bản L = 18 m',
    sp_Lt: 18,
    sp_a0: 0.3,
    sp_skew: 0,
    sp_sup: 'G',
    sp_bk1: 0.75,
    sp_bk2: 0.675,
    sp_tpad: 0.02,
    sp_Gpad: 1000,
    sp_mupad: 0.6,
    sp_fck: 30,
    sp_Ng: 7,
    sp_S: 1,
    sp_Wb: 7,
    sp_Wpa: 0.5,
    sp_Hpa: 0.6,
    sp_Apa: 0.21838,
    sp_Hra: 0.61,
    sp_icL: 2,
    sp_icR: 2,
    sp_icy: 0,
    sp_gpl: 'doc',
    sp_Pra: 13.134,
    sp_WPL: 0,
    sp_APL: 0,
    sp_qPL: 3,
    sp_hs: 0.18,
    sp_hw: 0,
    sp_Hsu: 0.06,
    sp_gsu: 22.5,
    sp_DWu: 0.5,
    sp_curb: 'U',
    sp_IM: 0.33,
    sp_gc: 24.5,
    sp_K1: 1,
    sp_fc: 40,
    sp_fci: 36,
    sp_fcs: 30,
    sp_db: 12.7,
    sp_Ap1: 98.7,
    sp_fpu: 1860,
    sp_fpyr: 0.9,
    sp_fpjr: 0.75,
    sp_Ep: 195000,
    sp_fy: 400,
    sp_Es: 200000,
    sp_RH: 83,
    sp_ti: 3,
    sp_tcur: '',
    sp_td: 100,
    sp_tf: 10950,
    sp_exp: '1',
    sp_ifc: 'N',
    sp_gLL3: 0.8,
    sp_dlim: 800,
    sp_g1: '1.6',
    sp_hook: 400,
    sp_kdyn: 0.2,
    sp_TGp: '23;6',
    sp_TGn: '-7;-1',
    sp_gTG: 0.5,
    sp_alpha: 0.0000108,
    gg_dd: '',
    gg_cc: '',
    gg_vd: '',
    gg_st: '',
    gg_sz: '',
    gg_sol: '',
    gg_H: 650,
    gg_Le: 600,
    gg_Lm: 500,
    gg_sd: 16,
    gg_sn: 4,
    gg_cd: 16,
    gg_cn: 4,
    gg_nTop: 0,
    gg_dTop: 14,
    gg_anN: 8,
    gg_anD: 14,
    gg_anS: 2,
    gb_dd: '',
    gb_cc: '',
    gb_vd: '',
    gb_st: '',
    gb_sz: '',
    gb_sol: '',
    gb_H: 650,
    gb_Le: 600,
    gb_Lm: 500,
    gb_eW: 425,
    gb_sd: 16,
    gb_sn: 4,
    gb_cd: 16,
    gb_cn: 4,
    gb_nTop: 0,
    gb_dTop: 14,
    gb_anN: 8,
    gb_anD: 14,
    gb_anS: 2,
    rc_h1: 180,
    rc_h2: 0,
    rc_h3: 0,
    rc_h4: 80,
    rc_h5: 100,
    rc_bt: 900,
    rc_b3: 900,
    rc_bd: 980,
    rc_bdE: 985,
    rc_vd: '',
    rc_bars: '10 28 49',
    rc_tbars: '7 12 38',
    rc_barsE: '',
    rc_tbarsE: '',
    rc_sbar: 0,
    rc_gr: '400',
    rc_grv: '240T',
    rc_sd: 12,
    rc_sn: 2,
    rc_sz: '0 8680 150',
    rc_cd: 12,
    rc_cn: 2,
    rcg_ag: 20,
    rc_ge: '1',
    rc_etaD: 1,
    rc_etaR: 1,
    rc_etaI: 1.05,
    gi_H: 1650,
    gi_b1: 650,
    gi_h1: 150,
    gi_h2: 120,
    gi_bw: 200,
    gi_h4: 130,
    gi_b3: 700,
    gi_h5: 75,
    gi_b4: 700,
    gi_h6: 120,
    gi_bwE: 350,
    gi_Le: 1200,
    gi_Ltr: 1200,
    gi_nstr: 12,
    gi_D: 80,
    gi_mu: 0.25,
    gi_K: 0.0066,
    gi_set: 6,
    gi_sd: 12,
    gi_sn: 2,
    gi_cd: 12,
    gi_cn: 2,
    gi_ag: 19,
    gi_tpan: 0.08,
    gi_Apan: 0,
    gi_cab: '',
    gi_sz: '',
    gi_dn: '',
    gi_Asn: 0,
    gi_Asd: 16,
    gi_Asy: 60,
    gi_ATn: 0,
    gi_ATd: 14,
    gi_ATy: 60,
    gi_id: 'full',
    gi_Tu: 0,
    gi_anT: 'S',
    gi_ana: 250,
    gi_anb: 250,
    gi_anlc: 1650,
    gi_ansm: 300,
    gi_anem: 150,
    gi_anfc: 35,
    gi_bhd: 14,
    gi_bhn: 6,
    gi_bhs: 150,
    gi_spd: 14,
    gi_spn: 8,
    bm_dB: 16,
    bm_sB: 150,
    bm_dT: 16,
    bm_sT: 150,
    bm_dTa: 0,
    bm_sTa: 150,
    bm_dLB: 14,
    bm_sLB: 150,
    bm_dLT: 14,
    bm_sLT: 200,
    bm_ct: 60,
    bm_cb: 25,
    gc_L: 150,
    gc_W: 200,
    gc_n: 2,
    gc_hri: 6,
    gc_hc: 3.5,
    gc_hs: 3,
    gc_Fy: 250,
    gc_dFTH: 165,
    gc_G: 1.0,
    gc_tol: 15,
    gc_nb: 2,
    mo_Tmax: 47,
    mo_Tmin: 5,
    ln_n: 2,
    ln_Lc: 3200,
    ln_gap: 50,
    ln_h: 180,
    ln_fc: 30,
    ln_dT: 25,
    ln_sT: 100,
    ln_aT: 65,
    ln_dB: 20,
    ln_sB: 100,
    ln_aB: 40,
    ln_dTr: 16,
    ln_sTr: 150,
    ln_ge: 0.75,
    ln_Tc: '',
    kc_loai: 'Khe co giãn răng lược',
    kc_ref: '',
    kc_Tins: 25,
    kc_t1: 30,
    kc_t2: 20,
    kc_b: 0.0002,
    kc_mu: 0.5,
    kc_mode: 'half',
    kc_k: 1.2,
    kc_Dmin: 30,
    kc_Dmax: 80,
    kc_dA: 240,
    gl_fc: 25,
    gl_tl: 'TL-3',
    gl_phi: 0.9,
    gl_Mb: 0,
    gl_lav: 150,
    gl_cvr: '0',
    gl_sf: '0.52,0.6,0.2,5.5',
    gl_bi: 500,
    gl_nleg: 2,
    gl_poly: '0 0\n500 0\n500 100\n350 250\n300 250\n300 580\n280 600\n20 600\n0 580',
    gl_bars: '50 550\n250 550\n50 375\n250 375\n50 200\n360 200\n50 60\n440 60',
    gw1_hs: 300,
    gw1_b: 350,
    gw1_n: 2,
    gw1_d: 14,
    gw1_dsc: 50,
    gw2_hs: 455,
    gw2_b: 250,
    gw2_n: 2,
    gw2_d: 14,
    gw2_dsc: 50,
    gc1_hs: 300,
    gc1_n: 5,
    gc1_d: 14,
    gc1_dsc: 50,
    gc2_hs: 455,
    gc2_n: 5,
    gc2_d: 14,
    gc2_dsc: 50,
    gr_E: 200000,
    gr_fy: 250,
    gl_gc: 2500,
    gr_rails: '101.6 4.2 542.5\n76.3 3.2 150',
    gr_L: 2000,
    gr_pb: 130,
    gr_ph: 78,
    gr_pt: 6,
    gr_pyc: 204,
    gr_bn: 2,
    gr_bd: 22,
    gr_bfu: 400,
    gr_blev: 135,
  };
}

function setBothStores(values: Record<string, string | number | boolean>): void {
  setContextStore(values);
  for (const [id, raw] of Object.entries(values)) {
    const val = typeof raw === 'boolean' ? (raw ? '1' : '0') : String(raw);
    let el = domElements.get(id);
    if (!el) {
      el = makeMockEl(id);
      domElements.set(id, el);
    }
    el.value = val;
  }
}

function mergeBothStores(values: Record<string, string | number | boolean>): void {
  updateContextStore(values);
  for (const [id, raw] of Object.entries(values)) {
    const val = typeof raw === 'boolean' ? (raw ? '1' : '0') : String(raw);
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
  setLatestDamResult(null);
  setLatestRcgResult(null);
  setLatestGirResult(null);
  setLatestSup2Result(null);
  setLatestLtnResult(null);
  setLatestKcgResult(null);
  setLatestGlcResult(null);
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

function loadSuperOracle(): SuperJsOracle {
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
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
  };

  const fakeWindow: Record<string, unknown> = {
    document: fakeDocument,
    localStorage: fakeLocalStorage,
    addEventListener: () => {},
    removeEventListener: () => {},
    MathJax: { tex2svg: null },
    __ckErr: [],
  };
  fakeWindow.window = fakeWindow;

  const sandbox: Record<string, unknown> = {
    window: fakeWindow,
    self: fakeWindow,
    document: fakeDocument,
    localStorage: fakeLocalStorage,
    console: {
      log: () => {},
      warn: () => {},
      error: (...args: unknown[]) => {
        console.error('[VM error]', ...args);
      },
    },
    MathJax: { tex2svg: null },
    nums: (t: unknown) =>
      String(t ?? '')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !/^[#\/]/.test(l))
        .map((l) =>
          l
            .replace(/,(?=\d)/g, '.')
            .split(/[\s;\t]+/)
            .map(Number),
        )
        .filter((a) => a.length > 0 && a.every(Number.isFinite)),
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
    fetch: () => {
      throw new Error('Blocked external fetch() inside offline superstructure oracle');
    },
    // Clean cross-module UI/linkage stubs for modules outside 04/05/10/13-crossfall
    ikOn: () => true,
    itOn: () => true,
    objMode: () => 'all',
    objLinkOff: () => false,
    objOn: () => true,
    objUnlock: () => {},
    objVis: () => {},
    xfLink: () => {},
    moLink: () => {},
    trLink: () => {},
    trSchedule: () => {},
    sctTitles: () => {},
    mcStep: () => {},
    saveAll: () => {},
    run: () => {},
    mathAll: () => {},
  };
  sandbox.globalThis = sandbox;

  const ctx = vm.createContext(sandbox);

  // Load pure crossfall/superstructure helpers from lines 1-188 of 13_pier_flexible_tr.js
  const mod13 = readFileSync(resolve(MODULES_DIR, '13_pier_flexible_tr.js'), 'utf8');
  const trStart = mod13.indexOf('const TR = (function ()');
  if (trStart < 0) {
    throw new Error('Could not locate TR marker in 13_pier_flexible_tr.js');
  }
  vm.runInContext(mod13.slice(0, trStart), ctx, { filename: '13_crossfall_slice.js' });

  for (const fname of SUPER_MODULE_FILES) {
    const src = readFileSync(resolve(MODULES_DIR, fname), 'utf8');
    vm.runInContext(src, ctx, { filename: fname });
  }

  vm.runInContext(
    `globalThis.__ORACLE__ = {
      XFmk,
      XFgir,
      ITOP,
      IPAN,
      SUPDIST,
      spXF,
      DAM,
      RCG,
      GI,
      spInputs,
      girderInputs,
      damLoadLib,
      damStep,
      damRender,
      rcgInputs,
      rcgLoadLib,
      rcgStep,
      rcgRender,
      giInputs,
      giLoadLib,
      giStep,
      giRender,
      supK,
      supApply,
      kdStep,
      stripSolve,
      bmCalc,
      bmOhCalc,
      bmOhStep,
      gcCalc,
      sup2Step,
      ltnCalc,
      ltnStep,
      kcgCalc,
      kcgStep,
      glPolyA,
      glW,
      glB1,
      glBlk,
      glCalc,
      glcStep,
      getJsDAMR: () => DAMR,
      getJsGIR: () => GIR,
      getJsRCGR: () => RCGR,
      getJsSUP2R: () => SUP2R,
      getJsLTNR: () => LTNR,
      getJsKCGR: () => KCGR,
      getJsGLCR: () => GLCR,
      resetState: () => {
        DAMR = null;
        GIR = null;
        RCGR = null;
        SUP2R = null;
        LTNR = null;
        KCGR = null;
        GLCR = null;
        LIMcur = null;
        GITAG = false;
      },
      dollar: $,
    };`,
    ctx,
    { filename: 'super-oracle-bridge.js' },
  );

  return ctx.__ORACLE__ as SuperJsOracle;
}

beforeAll(() => {
  oracle = loadSuperOracle();
});

beforeEach(() => {
  resetAllContexts();
  clearBothStores();
  setBothStores(defaultSuperInputs());
});

// =============================================================================
// 1. CROSSFALL, GIRDER LAYOUT & PRECAST PANEL GEOMETRY (crossfall.ts)
// =============================================================================
describe('1. Crossfall, Girder Layout & Precast Panel Geometry (crossfall.ts)', () => {
  it('matches XFmk across symmetric, crowned, flat, superelevated, single-slope & bang modes', () => {
    const configs: CrossfallConfig[] = [
      { iL: 2, iR: 2, yc: 0, mode: 'theo', gpl: 'doc' },
      { iL: 2, iR: 2, yc: 0, mode: 'phang', gpl: 'bang' },
      { iL: -3.5, iR: 3.5, yc: -1.25, mode: 'theo', gpl: 'doc' },
      { iL: 0, iR: 4, yc: -4.0, mode: 'theo', gpl: 'bang' },
      { iL: 2.5, iR: 1.5, yc: 0.75, mode: 'rieng', mL: 1.0, mR: 0.5, gpl: 'bang' },
    ];
    const ysSample = [-4.2, -2.5, -1.0, 0, 1.0, 2.5, 4.2];
    const compareModel = (tsM: CrossfallModel, jsM: CrossfallModel, tag: string) => {
      expectParityClose(tsM.iL, jsM.iL, 1e-12, `${tag}.iL`);
      expectParityClose(tsM.iR, jsM.iR, 1e-12, `${tag}.iR`);
      expectParityClose(tsM.yc, jsM.yc, 1e-12, `${tag}.yc`);
      expect(tsM.mode).toBe(jsM.mode);
      expect(tsM.gpl).toBe(jsM.gpl);
      expect(tsM.flat).toBe(jsM.flat);
      expect(tsM.same).toBe(jsM.same);
      for (const y of ysSample) {
        expectParityClose(tsM.dD(y), jsM.dD(y), 1e-12, `${tag}.dD(${y})`);
        expectParityClose(tsM.dM(y), jsM.dM(y), 1e-12, `${tag}.dM(${y})`);
      }
      expectParityClose(tsM.gir(ysSample), jsM.gir(ysSample), 1e-12, `${tag}.gir`);
      expectParityClose(tsM.hk(ysSample, 0.18), jsM.hk(ysSample, 0.18), 1e-12, `${tag}.hk`);
      expectParityClose(tsM.gir([]), jsM.gir([]), 1e-12, `${tag}.girEmpty`);
      expectParityClose(tsM.hk([], 0.18), jsM.hk([], 0.18), 1e-12, `${tag}.hkEmpty`);
      expectParityClose(tsM.avg(tsM.dD, -3.5, 3.5), jsM.avg(jsM.dD, -3.5, 3.5), 1e-12, `${tag}.avg`);
    };

    configs.forEach((cfg, idx) => {
      compareModel(XFmk(cfg), oracle.XFmk(cfg), `XFmk[${idx}]`);
    });
  });

  it('matches XFgir, SUPDIST, ITOP, IPAN & spXF across symmetric and asymmetric spans', () => {
    for (const [ng, s, sb] of [
      [1, 1.0, undefined],
      [5, 2.2, 2.0],
      [7, 1.0, 0.96],
      [6, 1.85, 1.65],
    ] as Array<[number, number, number | undefined]>) {
      expectParityClose(XFgir(ng, s, sb), oracle.XFgir(ng, s, sb), 1e-12, `XFgir(${ng})`);
    }

    const supCases: Array<[number[], SupDistInput]> = [
      [
        XFgir(7, 1.0),
        { Wd: 8.0, bl: 0.5, br: 0.5, wp: 0, DC: 5.2, DCe: 0.4, DCs: 1.8, DW: 9.1 },
      ],
      [
        XFgir(5, 2.2, 2.0),
        { Wd: 12.0, bl: 0.5, br: 0.5, wpA: 1.5, wpB: 0.75, DC: 8.4, DW: 12.6 },
      ],
      [[0], { Wd: 3.0, bl: 0.3, br: 0.3, wp: 0, DC: 3.1, DW: 2.2 }],
    ];
    supCases.forEach(([xg, opts], idx) => {
      expectParityClose(SUPDIST(xg, opts), oracle.SUPDIST(xg, opts), 1e-10, `SUPDIST[${idx}]`);
    });

    const pLib = GI.shapeOf(GI.LIB['33'].g as unknown as GiInput, GI.LIB['33'].g.bw).P;
    expectParityClose(ITOP(pLib, 1650), oracle.ITOP(pLib, 1650), 1e-10, 'ITOP(lib33)');
    expectParityClose(
      ITOP(
        [
          [-300, 1200],
          [300, 1200],
          [300, 1000],
          [-300, 1000],
        ],
        1200,
      ),
      oracle.ITOP(
        [
          [-300, 1200],
          [300, 1200],
          [300, 1000],
          [-300, 1000],
        ],
        1200,
      ),
      1e-10,
      'ITOP(rect)',
    );

    const xg = XFgir(4, 2200);
    const geo = xg.map(() => ITOP(pLib, 1650));
    const tsPolys: Array<{ pts: Point2D[]; fill: string }> = [];
    const jsPolys: Array<{ pts: Point2D[]; fill: string }> = [];
    const commonPan: Omit<IPanDrawOptions, 'poly'> = {
      xg,
      geo,
      tp: 70,
      zgt: (i) => 1650 - Math.abs(xg[i]) * 0.02,
      zsb: (x) => 1690 - Math.abs(x) * 0.02,
      xL: -4500,
      xR: 4500,
      P: (x, z) => [x, z],
      fp: '#cbd5e1',
      fd: '#94a3b8',
    };
    const tsLab = IPAN({ ...commonPan, poly: (pts, fill) => tsPolys.push({ pts, fill }) });
    const jsLab = oracle.IPAN({ ...commonPan, poly: (pts, fill) => jsPolys.push({ pts, fill }) });
    expectParityClose(tsLab, jsLab, 1e-10, 'IPAN.label');
    expectParityClose(tsPolys, jsPolys, 1e-10, 'IPAN.polys');

    for (const spCase of [
      { Ng: 7, S: 1.0, icL: 2, icR: 2, icy: 0, gpl: 'doc' },
      { Ng: 7, S: 1.0, icL: 2, icR: 3, icy: -0.5, gpl: 'bang' },
    ]) {
      setBothStores({
        ...defaultSuperInputs(),
        sp_Ng: spCase.Ng,
        sp_S: spCase.S,
        sp_icL: spCase.icL,
        sp_icR: spCase.icR,
        sp_icy: spCase.icy,
        sp_gpl: spCase.gpl,
      });
      const tsSp = spXF(spCase);
      const jsSp = oracle.spXF(spCase);
      expectParityClose(tsSp.ys, jsSp.ys, 1e-12, 'spXF.ys');
      expectParityClose(tsSp.g, jsSp.g, 1e-12, 'spXF.g');
      expectParityClose(tsSp.hsxG, jsSp.hsxG, 1e-12, 'spXF.hsxG');
      expectParityClose(tsSp.hsxB, jsSp.hsxB, 1e-12, 'spXF.hsxB');
    }
  });
});

// =============================================================================
// 2a. PRE-TENSIONED HOLLOW-CORE SLAB GIRDER (DAM — girderHollow.ts)
// =============================================================================
describe('2a. Pre-tensioned Hollow-Core Slab Girder (DAM — girderHollow.ts)', () => {
  const libKeys: DamLibKey[] = ['15', '18', '21', '24'];

  it.each(libKeys)('matches DAM library L=%sm interior & exterior girders field-for-field', (libKey) => {
    setBothStores({ ...defaultSuperInputs(), sp_type: 'BR', sp_lib: libKey });
    damLoadLib();
    oracle.damLoadLib();

    const tsI = spInputs();
    const jsI = oracle.spInputs();
    expectParityClose(tsI, jsI, 1e-6, `spInputs(L=${libKey})`);

    const tsGg = girderInputs('g');
    const jsGg = oracle.girderInputs('g');
    expectParityClose(tsGg, jsGg, 1e-6, `girderInputs.g(L=${libKey})`);

    const tsRg = DAM.calc(tsI, tsGg);
    const jsRg = oracle.DAM.calc(jsI, jsGg);
    expectParityClose(tsRg, jsRg, 1e-6, `DAM.calc.g(L=${libKey})`);

    const tsGb = girderInputs('b');
    const jsGb = oracle.girderInputs('b');
    tsGb.DFg = tsRg.DF;
    jsGb.DFg = jsRg.DF;
    const tsRb = DAM.calc(tsI, tsGb);
    const jsRb = oracle.DAM.calc(jsI, jsGb);
    expectParityClose(tsRb, jsRb, 1e-6, `DAM.calc.b(L=${libKey})`);

    // Compare summary pass/fail items & governing stresses
    const tsLim = evalDamLimits(tsI);
    const tsSum = evalDamSummary(tsRg, tsI, tsLim);
    oracle.damRender('g', jsRg, jsI, jsGg, tsLim);
    const jsRgWithItems = jsRg as DamCalcResult & { items?: unknown[]; allOK?: boolean };
    expectParityClose(tsSum.allOK, jsRgWithItems.allOK, 1e-6, `DAM.allOK.g(L=${libKey})`);
    expect(tsSum.items.length).toBe(22);
    expectParityClose(
      tsRg.res.map((r) => ({ ftIT: r.ftIT, fbIIIT: r.fbIIIT, fdIT: r.fdIT })),
      jsRg.res.map((r) => ({ ftIT: r.ftIT, fbIIIT: r.fbIIIT, fdIT: r.fdIT })),
      1e-6,
      `DAM.TGstresses.g(L=${libKey})`,
    );
  });

  it('matches DAM edge cases: skew, bang crossfall, fixed bearing sup=K, pedestrians & damStep adapter', () => {
    setBothStores({
      ...defaultSuperInputs(),
      sp_type: 'BR',
      sp_lib: '21',
      sp_skew: 20,
      sp_sup: 'K',
      sp_gpl: 'bang',
      sp_icL: 2.5,
      sp_icR: 1.5,
      sp_icy: -0.4,
      sp_Ng: 8,
      sp_S: 1.0,
      sp_Wb: 8.0,
      sp_WPL: 1.0,
      sp_APL: 0.25,
      sp_qPL: 3.0,
      sp_curb: 'L',
      sp_ifc: 'R',
      sp_exp: '2',
    });
    damLoadLib();
    oracle.damLoadLib();

    const tsOut = damStep();
    oracle.damStep();
    const jsOut = oracle.getJsDAMR();

    expect(tsOut).toBeDefined();
    expect(jsOut).not.toBeNull();
    expectParityClose(tsOut!.g, jsOut!.g, 1e-6, 'DAM.skewBang.g');
    expectParityClose(tsOut!.b, jsOut!.b, 1e-6, 'DAM.skewBang.b');

    const tsUnified = toHollowGirderResult(tsOut!);
    const jsUnified = toHollowGirderResult(jsOut!);
    expect(((tsUnified.g.res as Record<string, unknown>).items as unknown[])?.length).toBe(22);
    delete (tsUnified.g.res as Record<string, unknown>).items;
    delete (tsUnified.b.res as Record<string, unknown>).items;
    delete (jsUnified.g.res as Record<string, unknown>).items;
    delete (jsUnified.b.res as Record<string, unknown>).items;
    expectParityClose(tsUnified, jsUnified, 1e-6, 'toHollowGirderResult');
  });
});

// =============================================================================
// 2b. RC SLAB GIRDER (RCG — girderHollow.ts)
// =============================================================================
describe('2b. RC Slab Girder (RCG — girderHollow.ts)', () => {
  it('matches RC_LIB["868"] interior & exterior calculations, summary & rcgStep', () => {
    setBothStores({ ...defaultSuperInputs(), sp_type: 'RC' });
    rcgLoadLib();
    oracle.rcgLoadLib();

    const tsI = spInputs();
    const jsI = oracle.spInputs();
    expectParityClose(tsI, jsI, 1e-6, 'rcg.spInputs');

    const tsG = rcgInputs();
    const jsG = oracle.rcgInputs();
    expectParityClose(tsG, jsG, 1e-6, 'rcgInputs(868)');

    const tsRg = RCG.calc(tsI, tsG, 'g');
    const jsRg = oracle.RCG.calc(jsI, jsG, 'g');
    expectParityClose(tsRg, jsRg, 1e-6, 'RCG.calc.g(868)');

    const tsRb = RCG.calc(tsI, tsG, 'b');
    const jsRb = oracle.RCG.calc(jsI, jsG, 'b');
    expectParityClose(tsRb, jsRb, 1e-6, 'RCG.calc.b(868)');

    const tsSumG = evalRcgSummary(tsRg);
    oracle.rcgRender('g', jsRg, jsI, jsG, { g: jsRg, b: jsRb });
    const jsRgSum = jsRg as RcCalcResult & { items?: unknown[]; okAll?: boolean };
    expectParityClose(tsSumG.okAll, jsRgSum.okAll, 1e-6, 'RCG.okAll.g');
    expectParityClose(tsSumG.items, jsRgSum.items, 1e-6, 'RCG.items.g');

    const tsOut = rcgStep();
    oracle.damStep();
    const jsOut = oracle.getJsRCGR();
    expect(tsOut).toBeDefined();
    expect(jsOut).not.toBeNull();
    expectParityClose(tsOut!.g, jsOut!.g, 1e-6, 'rcgStep.g');
    expectParityClose(tsOut!.b, jsOut!.b, 1e-6, 'rcgStep.b');

    const tsUnified = toRcGirderResult(tsOut!);
    const jsUnified = toRcGirderResult(jsOut!);
    expectParityClose(tsUnified, jsUnified, 1e-6, 'toRcGirderResult');
  });

  it('matches RCG custom span with voids, skew, exposure=2, pedestrians & curbMode=L', () => {
    setBothStores({ ...defaultSuperInputs(), sp_type: 'RC' });
    rcgLoadLib();
    oracle.rcgLoadLib();

    mergeBothStores({
      sp_type: 'RC',
      sp_Lt: 12,
      sp_a0: 0.35,
      sp_skew: 15,
      sp_Ng: 6,
      sp_S: 1.25,
      sp_Wb: 9.5,
      sp_WPL: 1.0,
      sp_APL: 0.22,
      sp_qPL: 3.0,
      sp_curb: 'L',
      sp_exp: '2',
      sp_gpl: 'bang',
      sp_icL: 2.0,
      sp_icR: 2.5,
      rc_h1: 200,
      rc_h2: 50,
      rc_h3: 200,
      rc_h4: 100,
      rc_h5: 150,
      rc_bt: 1000,
      rc_b3: 1000,
      rc_bd: 1200,
      rc_bdE: 1150,
      rc_vd: '-240 350 240\n240 350 240',
      rc_bars: '10 28 50',
      rc_tbars: '8 14 40',
      rc_sz: '0 12000 150',
    });

    const tsI = spInputs();
    const jsI = oracle.spInputs();
    const tsG = rcgInputs();
    const jsG = oracle.rcgInputs();
    const tsRg = RCG.calc(tsI, tsG, 'g');
    const jsRg = oracle.RCG.calc(jsI, jsG, 'g');
    const tsRb = RCG.calc(tsI, tsG, 'b');
    const jsRb = oracle.RCG.calc(jsI, jsG, 'b');
    expectParityClose(tsRg, jsRg, 1e-6, 'RCG.custom.g');
    expectParityClose(tsRb, jsRb, 1e-6, 'RCG.custom.b');
    expectParityClose(toRcGirderResult(tsRg, tsRb), toRcGirderResult(jsRg, jsRb), 1e-6, 'toRcGirderResult.custom');
  });
});

// =============================================================================
// 3. POST-TENSIONED I-GIRDER (GI — girderI.ts)
// =============================================================================
describe('3. Post-Tensioned I-Girder (GI — girderI.ts)', () => {
  it('matches GI geometry & live-load helpers (shapeOf, bwAt, leverRule, mOf)', () => {
    const baseG = GI.LIB['33'].g as unknown as GiInput;
    for (const bwTest of [baseG.bw, baseG.bwE, (baseG.bw + baseG.bwE) / 2]) {
      expectParityClose(GI.shapeOf(baseG, bwTest), oracle.GI.shapeOf(baseG, bwTest), 1e-10, `GI.shapeOf(${bwTest})`);
    }
    for (const d of [0, baseG.Le, baseG.Le + baseG.Ltr / 2, baseG.Le + baseG.Ltr + 1000]) {
      expectParityClose(GI.bwAt(baseG, d), oracle.GI.bwAt(baseG, d), 1e-10, `GI.bwAt(${d})`);
    }
    for (const k of [1, 2, 3, 4, 5]) {
      expectParityClose(GI.mOf(k), oracle.GI.mOf(k), 1e-12, `GI.mOf(${k})`);
    }
    const xs5 = XFgir(5, 2.2);
    for (const j of [0, 1, 2]) {
      expectParityClose(
        GI.leverRule(xs5, j, -5.0, 5.0, 3, true),
        oracle.GI.leverRule(xs5, j, -5.0, 5.0, 3, true),
        1e-9,
        `GI.leverRule(j=${j},m=true)`,
      );
      expectParityClose(
        GI.leverRule(xs5, j, -5.0, 5.0, 2, false),
        oracle.GI.leverRule(xs5, j, -5.0, 5.0, 2, false),
        1e-9,
        `GI.leverRule(j=${j},m=false)`,
      );
    }
  });

  it('matches GI.LIB["33"] interior & exterior girders, TG, anchorage zone, evalGiSummary & giStep', () => {
    setBothStores({
      ...defaultSuperInputs(),
      sp_type: 'I',
      sp_Lt: 33,
      sp_a0: 0.7,
      sp_Ng: 5,
      sp_S: 2.2,
      sp_Wb: 11.0,
      sp_hs: 0.2,
      sp_fc: 40,
      sp_fci: 35,
      sp_fcs: 30,
      sp_db: 15.2,
      sp_Ap1: 140,
    });
    giLoadLib();
    oracle.giLoadLib();

    const tsI = spInputs();
    const jsI = oracle.spInputs();
    const tsG0 = giInputs();
    const jsG0 = oracle.giInputs();
    expectParityClose(tsG0, jsG0, 1e-6, 'giInputs(33)');

    const tsRg = GI.calc(tsI, { ...tsG0, kind: 'giua' });
    const jsRg = oracle.GI.calc(jsI, { ...jsG0, kind: 'giua' });
    expectParityClose(tsRg, jsRg, 1e-6, 'GI.calc.g(33)');

    const tsRb = GI.calc(tsI, { ...tsG0, kind: 'bien' });
    const jsRb = oracle.GI.calc(jsI, { ...jsG0, kind: 'bien' });
    expectParityClose(tsRb, jsRb, 1e-6, 'GI.calc.b(33)');

    // Summary & thermal-gradient combined stress checks (ftIT, fbIIIT, fdIT, allOK)
    const tsLim = evalDamLimits(tsI);
    evalGiSummary(tsRg, tsI, tsLim);
    oracle.giRender('g', jsRg, jsI, jsG0, tsLim, { g: jsRg, b: jsRb });
    const tsSumR = tsRg as GiCalcResult & { items?: unknown[]; allOK?: boolean };
    const jsSumR = jsRg as GiCalcResult & { items?: unknown[]; allOK?: boolean };
    expectParityClose(tsSumR.allOK, jsSumR.allOK, 1e-6, 'GI.allOK.g(33)');
    expect(tsSumR.items?.length).toBeGreaterThanOrEqual(20);
    expectParityClose(tsRg.res, jsRg.res, 1e-6, 'GI.res+TG.g(33)');

    // Full giStep + toIGirderResult adapter
    const tsOut = giStep();
    oracle.damStep();
    const jsOut = oracle.getJsGIR();
    expect(tsOut).toBeDefined();
    expect(jsOut).not.toBeNull();
    expectParityClose(tsOut!.g, jsOut!.g, 1e-6, 'giStep.g(33)');
    expectParityClose(tsOut!.b, jsOut!.b, 1e-6, 'giStep.b(33)');
    const tsUni33 = toIGirderResult(tsOut!);
    const jsUni33 = toIGirderResult(jsOut!);
    delete (tsUni33.g.res as Record<string, unknown>).items;
    delete (tsUni33.b.res as Record<string, unknown>).items;
    expectParityClose(tsUni33, jsUni33, 1e-6, 'toIGirderResult(33)');
  });

  it('matches custom post-tensioned I-girder with bang crossfall, anchorage type B, torsion Tu>0 & sup=K', () => {
    setBothStores({
      ...defaultSuperInputs(),
      sp_type: 'I',
      sp_Lt: 30,
      sp_a0: 0.65,
      sp_skew: 12,
      sp_sup: 'K',
      sp_gpl: 'bang',
      sp_icL: 2.5,
      sp_icR: 2.0,
      sp_icy: -0.3,
      sp_Ng: 4,
      sp_S: 2.35,
      sp_Wb: 9.8,
      sp_WPL: 0.9,
      sp_APL: 0.2,
      sp_qPL: 3.0,
      sp_curb: 'L',
      sp_ifc: 'R',
      sp_exp: '2',
      sp_hs: 0.2,
      sp_fc: 45,
      sp_fci: 38,
      sp_fcs: 35,
      sp_db: 15.2,
      sp_Ap1: 140,
    });
    giLoadLib();
    oracle.giLoadLib();

    mergeBothStores({
      gi_id: 'full',
      gi_anT: 'B',
      gi_Tu: 28,
      gi_tpan: 0.07,
    });

    const tsI = spInputs();
    const jsI = oracle.spInputs();
    const tsG0 = giInputs();
    const jsG0 = oracle.giInputs();
    const tsRg = GI.calc(tsI, { ...tsG0, kind: 'giua' });
    const jsRg = oracle.GI.calc(jsI, { ...jsG0, kind: 'giua' });
    const tsRb = GI.calc(tsI, { ...tsG0, kind: 'bien' });
    const jsRb = oracle.GI.calc(jsI, { ...jsG0, kind: 'bien' });

    expectParityClose(tsRg, jsRg, 1e-6, 'GI.custom.g');
    expectParityClose(tsRb, jsRb, 1e-6, 'GI.custom.b');
    expectParityClose(toIGirderResult(tsRg, tsRb), toIGirderResult(jsRg, jsRb), 1e-6, 'toIGirderResult.custom');
  });
});

// =============================================================================
// 4. DECK SLAB, OVERHANG, BEARINGS, LINK SLAB, EXPANSION JOINT & BARRIER
// =============================================================================
describe('4. Deck Slab, Overhang, Bearings, Link Slab, Expansion Joint & Barrier (deckJoints.ts)', () => {
  it('matches stripSolve across symmetric & asymmetric multi-span continuous strips', () => {
    const cases: Array<{ xs: number[]; loads: Array<[number, number]> }> = [
      {
        xs: [0, 2.2, 4.4, 6.6],
        loads: [
          [1.5, 72.5],
          [3.3, 72.5],
        ],
      },
      {
        xs: [-1.0, 0, 1.85, 3.85, 5.7, 6.7],
        loads: [
          [-0.6, 55.0],
          [1.2, 72.5],
          [3.0, 72.5],
          [4.8, 55.0],
        ],
      },
      {
        xs: [0, 3.0],
        loads: [[1.4, 80.0]],
      },
    ];
    cases.forEach(({ xs, loads }, idx) => {
      expectParityClose(stripSolve(xs, loads), oracle.stripSolve(xs, loads), 1e-9, `stripSolve[${idx}]`);
    });
  });

  it('matches bmCalc, bmOhCalc, gcCalc, supK, supApply & kdStep directly on I-girder and hollow slab inputs', () => {
    setBothStores({
      ...defaultSuperInputs(),
      sp_type: 'I',
      sp_Lt: 33,
      sp_a0: 0.7,
      sp_Ng: 5,
      sp_S: 2.2,
      sp_Wb: 11.0,
      sp_hs: 0.2,
      sp_fc: 40,
      sp_fci: 35,
      sp_fcs: 30,
      sp_db: 15.2,
      sp_Ap1: 140,
    });
    giLoadLib();
    oracle.giLoadLib();

    const tsI = spInputs();
    const jsI = oracle.spInputs();
    const tsB: BmInput = {
      typeI: true,
      bf: 700,
      dB: 16,
      sB: 150,
      dT: 16,
      sT: 150,
      dLB: 14,
      sLB: 150,
      dLT: 14,
      sLT: 200,
      ct: 60,
      cb: 25,
    };
    const tsBm = bmCalc(tsI, tsB);
    const jsBm = oracle.bmCalc(jsI, tsB);
    expectParityClose(tsBm, jsBm, 1e-6, 'bmCalc(I)');

    // Overhang with parapet geometry from GI run
    const tsGlInput: GlInput = {
      tl: 'TL-3',
      poly: [
        [0, 0],
        [500, 0],
        [500, 100],
        [350, 250],
        [300, 250],
        [300, 580],
        [280, 600],
        [20, 600],
        [0, 580],
      ],
      bars: [
        [50, 550],
        [250, 550],
        [50, 375],
        [250, 375],
        [50, 200],
        [360, 200],
        [50, 60],
        [440, 60],
      ],
      bw: [
        { hs: 300, b: 350, n: 2, d: 14, dsc: 50 },
        { hs: 455, b: 250, n: 2, d: 14, dsc: 50 },
      ],
      bc: [
        { hs: 300, n: 5, d: 14, dsc: 50 },
        { hs: 455, n: 5, d: 14, dsc: 50 },
      ],
      fc: 25,
      fy: 400,
      phi: 0.9,
      Mb: 0,
      gc: 2500,
      lav: 150,
      cvr: false,
      fcd: 30,
      sv: 150,
      nleg: 2,
      bi: 500,
      Hra: 610,
      rails: [
        [101.6, 4.2, 542.5],
        [76.3, 3.2, 150],
      ],
      sfy: 250,
      sL: 2000,
      pb: 130,
      ph: 78,
      pt: 6,
      pyc: 204,
      bn: 2,
      bd: 22,
      bfu: 400,
      blev: 135,
      c: 50,
      mu: 1.0,
      K1: 1.72,
      K2: 0.25,
      dTd: 16,
      sTd: 150,
      ctd: 60,
      oh: Math.max(0, tsI.Wb / 2 - ((tsI.Ng - 1) / 2) * tsI.S),
    };
    const tsGl = glCalc(tsI, tsGlInput);
    const jsGl = oracle.glCalc(jsI, tsGlInput);
    expectParityClose(tsGl, jsGl, 1e-6, 'glCalc(TL-3)');

    const tsOhIn: BmOhInput = { dT: 16, sT: 150, ct: 60, dTa: 14, sTa: 150 };
    const tsOh = bmOhCalc(tsI, tsBm, tsOhIn, tsGl);
    const jsOh = oracle.bmOhCalc(jsI, jsBm, tsOhIn, jsGl);
    expectParityClose(tsOh, jsOh, 1e-6, 'bmOhCalc(I)');

    // Elastomeric bearing Method B check (gcCalc)
    const gcBearing: GcBearingInput = {
      L: 250,
      W: 350,
      n: 3,
      hri: 10,
      hc: 6,
      hs: 3,
      Fy: 250,
      dFTH: 165,
      G: 1.0,
      tol: 15,
      nb: 2,
      Tmax: 47,
      Tmin: 5,
      eSh: 0.00025,
      Lexp: 16.5,
    };
    const gcReac: GcReactionInput = {
      DC: 280,
      DW: 65,
      LL: 220,
      thSt: 0.0022,
      thCy: 0.0018,
      dcr: 3.5,
      dDeck: 1.2,
      dLL: 2.1,
    };
    expectParityClose(
      gcCalc(tsI, gcBearing, gcReac, gcReac),
      oracle.gcCalc(jsI, gcBearing, gcReac, gcReac),
      1e-6,
      'gcCalc(MethodB)',
    );

    // Fixed rubber pad mode sup='K' -> supK, supApply, kdStep
    setBothStores({ sp_sup: 'K', sp_fck: 30 });
    expect(supK()).toBe(oracle.supK());
    supApply();
    oracle.supApply();
    expectParityClose(kdStep(tsI), oracle.kdStep(jsI), 1e-6, 'kdStep(sup=K)');
  });

  it('matches ltnCalc, kcgCalc & gl* yield-line barrier helpers across configurations', () => {
    const tsI = spInputs();
    const jsI = oracle.spInputs();

    const tsGiOut = (() => {
      setBothStores({
        ...defaultSuperInputs(),
        sp_type: 'I',
        sp_Lt: 33,
        sp_a0: 0.7,
        sp_Ng: 5,
        sp_S: 2.2,
        sp_Wb: 11.0,
        sp_hs: 0.2,
        sp_fc: 40,
        sp_fci: 35,
        sp_fcs: 30,
        sp_db: 15.2,
        sp_Ap1: 140,
      });
      giLoadLib();
      oracle.giLoadLib();
      const tOut = giStep()!;
      oracle.damStep();
      return { tOut, jOut: oracle.getJsGIR()! };
    })();

    const ltnIn: LtnInput = {
      n: 2,
      Lc: 3200,
      gap: 50,
      h: 180,
      fc: 30,
      fy: 400,
      dT: 25,
      sT: 100,
      aT: 65,
      dB: 20,
      sB: 100,
      aB: 40,
      dTr: 16,
      sTr: 150,
      ge: 0.75,
      Tmax: 47,
      Tmin: 5,
      Tc: 26,
    };
    const gcPad: GcBearingInput = {
      L: 250,
      W: 350,
      n: 3,
      hri: 10,
      hc: 6,
      hs: 3,
      Fy: 250,
      dFTH: 165,
      G: 1.0,
      tol: 15,
      nb: 2,
      Tmax: 47,
      Tmin: 5,
      eSh: 0.0002,
      Lexp: 33,
    };
    const gcReacSample: GcReactionInput = {
      DC: 280,
      DW: 65,
      LL: 220,
      thSt: 0.0022,
      thCy: 0.0018,
      dcr: 3.5,
      dDeck: 1.2,
      dLL: 2.1,
    };
    const tsGcRes = { ...gcCalc(spInputs(), gcPad, gcReacSample, gcReacSample), C: gcPad };
    const jsGcRes = { ...oracle.gcCalc(oracle.spInputs(), gcPad, gcReacSample, gcReacSample), C: gcPad };
    expectParityClose(
      ltnCalc(spInputs(), tsGiOut.tOut.g, tsGiOut.tOut.b, tsGcRes, ltnIn),
      oracle.ltnCalc(oracle.spInputs(), tsGiOut.jOut.g, tsGiOut.jOut.b, jsGcRes, ltnIn),
      1e-6,
      'ltnCalc(GI)',
    );

    const kcgCases: KcgInput[] = [
      {
        Tmax: 47,
        Tmin: 5,
        Tins: 25,
        t1: 30,
        t2: 20,
        a: 0.0000108,
        b: 0.0002,
        mu: 0.5,
        L: 33000,
        mode: 'half',
        q: 1.15,
        k: 1.2,
        Dmin: 30,
        Dmax: 80,
        dA: 240,
      },
      {
        Tmax: 47,
        Tmin: 5,
        Tins: 25,
        t1: 30,
        t2: 20,
        a: 0.0000108,
        b: 0.0002,
        mu: 0.5,
        L: 66000,
        mode: 'full',
        q: 1.15,
        k: 1.2,
        Dmin: 20,
        Dmax: 120,
        dA: 240,
      },
    ];
    kcgCases.forEach((p, idx) => {
      expectParityClose(kcgCalc(p), oracle.kcgCalc(p), 1e-9, `kcgCalc[${idx}]`);
    });

    // Barrier polygon & yield-line sub-helpers across TL-2 / TL-3 / TL-4
    const poly: Point2D[] = [
      [0, 0],
      [500, 0],
      [500, 100],
      [350, 250],
      [300, 250],
      [300, 580],
      [280, 600],
      [20, 600],
      [0, 580],
    ];
    expectParityClose(glPolyA(poly), oracle.glPolyA(poly), 1e-9, 'glPolyA');
    expectParityClose(glW(poly, 300), oracle.glW(poly, 300), 1e-9, 'glW(300)');
    expectParityClose(glB1(30), oracle.glB1(30), 1e-9, 'glB1(30)');
    expectParityClose(glB1(40), oracle.glB1(40), 1e-9, 'glB1(40)');
    expectParityClose(
      glBlk(300, 350, 2, 14, 50, 0, 25, 400, 0.9),
      oracle.glBlk(300, 350, 2, 14, 50, 0, 25, 400, 0.9),
      1e-9,
      'glBlk',
    );

    expect(Object.keys(GL_TL).length).toBeGreaterThanOrEqual(5);
    expect(GL_VEH.cols.length).toBeGreaterThanOrEqual(6);

    const glTl4: GlInput = {
      tl: 'TL-4',
      poly,
      bars: [
        [50, 550],
        [250, 550],
        [50, 375],
        [250, 375],
        [50, 200],
        [360, 200],
        [50, 60],
        [440, 60],
      ],
      bw: [
        { hs: 300, b: 350, n: 2, d: 14, dsc: 50 },
        { hs: 455, b: 250, n: 2, d: 14, dsc: 50 },
      ],
      bc: [
        { hs: 300, n: 5, d: 14, dsc: 50 },
        { hs: 455, n: 5, d: 14, dsc: 50 },
      ],
      fc: 30,
      fy: 400,
      phi: 0.9,
      Mb: 0,
      gc: 2500,
      lav: 150,
      cvr: true,
      fcd: 30,
      sv: 150,
      nleg: 2,
      bi: 500,
      Hra: 610,
      rails: [
        [101.6, 4.2, 542.5],
        [76.3, 3.2, 150],
      ],
      sfy: 250,
      sL: 2000,
      pb: 130,
      ph: 78,
      pt: 6,
      pyc: 204,
      bn: 2,
      bd: 22,
      bfu: 400,
      blev: 135,
      c: 50,
      mu: 1.0,
      K1: 1.72,
      K2: 0.25,
      dTd: 16,
      sTd: 150,
      ctd: 60,
      oh: 0.65,
    };
    expectParityClose(glCalc(tsI, glTl4), oracle.glCalc(jsI, glTl4), 1e-6, 'glCalc(TL-4+cvr)');
  });

  it('matches integrated sup2Step, ltnStep, kcgStep, glcStep & unified adapters on DAM & GI spans', () => {
    // 1) Hollow-core slab bridge with active link slab + bearing G + joint + barrier
    setBothStores({
      ...defaultSuperInputs(),
      sp_type: 'BR',
      sp_lib: '18',
      sp_sup: 'G',
      tq_bltn: '1',
      ln_n: 2,
      bm_dTa: 14,
      bm_sTa: 150,
    });
    damLoadLib();
    oracle.damLoadLib();

    const tsDam = damStep()!;
    oracle.damStep();
    const jsDam = oracle.getJsDAMR()!;
    const tsI1 = spInputs();
    const jsI1 = oracle.spInputs();

    const tsGc1 = gcStep(tsI1);
    sup2Step();
    oracle.sup2Step();
    const jsSup2_1 = oracle.getJsSUP2R();
    expect(jsSup2_1).not.toBeNull();

    const tsLtn = ltnStep(tsI1);
    oracle.ltnStep(jsI1, jsSup2_1);
    expectParityClose(tsLtn, oracle.getJsLTNR(), 1e-6, 'ltnStep(BR)');

    const tsKcg = kcgStep(tsI1);
    oracle.kcgStep(jsI1);
    expectParityClose(tsKcg, oracle.getJsKCGR(), 1e-6, 'kcgStep(BR)');

    const tsGlc = glcStep(tsI1);
    oracle.glcStep(jsI1);
    expectParityClose(tsGlc, oracle.getJsGLCR(), 1e-6, 'glcStep(BR)');

    expectParityClose(tsGc1.gc, jsSup2_1?.gc, 1e-6, 'gcStep(BR)');
    expectParityClose(toDeckComponentSummary(), toDeckComponentSummary(jsSup2_1), 1e-6, 'toDeckComponentSummary(BR)');
    expectParityClose(
      toGirderWithDeckResult(tsDam),
      toGirderWithDeckResult(jsDam, jsSup2_1),
      1e-6,
      'toGirderWithDeckResult(BR)',
    );

    // 2) Post-tensioned I-girder with sup='K' pad & composite overhang
    clearBothStores();
    setBothStores({
      ...defaultSuperInputs(),
      sp_type: 'I',
      sp_Lt: 33,
      sp_a0: 0.7,
      sp_Ng: 5,
      sp_S: 2.2,
      sp_Wb: 11.0,
      sp_hs: 0.2,
      sp_fc: 40,
      sp_fci: 35,
      sp_fcs: 30,
      sp_db: 15.2,
      sp_Ap1: 140,
      sp_sup: 'K',
      mo_lnOn: 0,
      bm_dTa: 14,
      bm_sTa: 150,
    });
    giLoadLib();
    oracle.giLoadLib();

    const tsGi = giStep()!;
    oracle.damStep();
    const jsGi = oracle.getJsGIR()!;
    sup2Step();
    oracle.sup2Step();
    const jsSup2_2 = oracle.getJsSUP2R();
    expect(jsSup2_2).not.toBeNull();
    expectParityClose(toDeckComponentSummary(), toDeckComponentSummary(jsSup2_2), 1e-6, 'toDeckComponentSummary(I+K)');
    expectParityClose(
      toGirderWithDeckResult(tsGi),
      toGirderWithDeckResult(jsGi, jsSup2_2),
      1e-6,
      'toGirderWithDeckResult(I+K)',
    );
  });
});

// =============================================================================
// 5. STRICT CLEAN-ROOM & ZERO-CDN AUDIT
// =============================================================================
describe('5. Strict Clean-Room & Zero-CDN Compliance Audit', () => {
  it('contains zero https:// CDN URLs and zero licensing/trial/hwid tokens across all 4 bridge superstructure modules', () => {
    const forbiddenUrlOrLicense = /https:\/\/|license|hwid|machineId|trial|\.lic\b/i;
    const anyHttpRegex = /http:\/\/[^\s'"`>]+/gi;

    for (const relPath of SUPER_TS_FILES) {
      const fullPath = resolve(WEB_ROOT, relPath);
      const src = readFileSync(fullPath, 'utf8');
      expect(src.match(forbiddenUrlOrLicense), `Forbidden pattern found in ${relPath}`).toBeNull();

      const httpMatches = src.match(anyHttpRegex) ?? [];
      for (const match of httpMatches) {
        expect(match, `Unexpected http:// URL in ${relPath}`).toBe('http://www.w3.org/2000/svg');
      }
    }
  });
});
