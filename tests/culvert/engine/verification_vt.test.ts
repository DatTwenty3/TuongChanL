import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearContextStore,
  resetAllContexts,
  setLatestCapResult,
  setLatestChResult,
  setLatestChnResult,
  setLatestCtResult,
  setLatestDamResult,
  setLatestDcLink,
  setLatestDcResult,
  setLatestGirResult,
  setLatestGlcResult,
  setLatestHvResult,
  setLatestKcgResult,
  setLatestLim,
  setLatestLtnResult,
  setLatestMdCapResult,
  setLatestMdFlexResult,
  setLatestMdStmResult,
  setLatestMorResult,
  setLatestQdResult,
  setLatestRcgResult,
  setLatestRcmResult,
  setLatestSfmResult,
  setLatestSup2Result,
  setLatestTcResult,
  setLatestTlResult,
  setLatestTrCheck,
  setLatestTrResult,
  setLatestTvcResult,
  setLatestVtResult,
} from '../../../src/culvert/engine/index.ts';
import {
  VT,
  getLatestVtResult,
  hl93,
  initVerificationDom,
  live,
  run as runVtSuite,
  runSuite,
  vtRender,
} from '../../../src/culvert/engine/verification/verificationSuite.ts';
import {
  LK,
  LOOKUP_BINDINGS,
  LOOKUP_KEYS,
  LOOKUP_MAP,
  formatCaptionsAndTables,
  getLookupEntry,
  getLookupTargetForField,
  initLookupBindings,
  resolveLookupBindings,
} from '../../../src/culvert/engine/verification/lookupTables.ts';
import { damStep, getLatestDamResult } from '../../../src/culvert/engine/bridge/girderHollow.ts';
import { giStep } from '../../../src/culvert/engine/bridge/girderI.ts';
import { runAll, setAppModeState } from '../../../src/culvert/engine/orchestrator.ts';
import { APP_MODES, type AppMode, type VerificationCheckResult } from '../../../src/culvert/types/project.ts';

interface PaneFixture {
  tabId: string;
  paneId: string;
  html: string;
}

interface UpstreamVtCheck {
  g: string;
  t: string;
  q: string;
  u: string;
  ref: number;
  tol: { abs?: number; rel?: number };
  src: string;
  f: () => number;
}

interface UpstreamVtResult extends UpstreamVtCheck {
  v: number;
  d: number;
  rel: number;
  lim: number;
  ok: boolean;
  err: string;
}

interface UpstreamOracle {
  vtChecks: UpstreamVtCheck[];
  vtRunFixedOnly: () => UpstreamVtResult[];
  vtRunAll: () => UpstreamVtResult[];
  hl93: (L: number, x: number) => { M: number; Q: number };
  lk: Record<string, { t: string; f: () => string }>;
  runUpstreamAll: () => void;
}

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(TEST_DIR, '../../..');
const MODULES_DIR = resolve(WEB_ROOT, '../analysis-cau-cong/modules');
const PANES_PATH = resolve(WEB_ROOT, 'src/culvert/assets/panes.json');

const EXPECTED_GROUP_COUNTS: ReadonlyArray<readonly [string, number]> = [
  ['Hệ số sức chịu tải Nc, Nq, Nγ - móng nông', 36],
  ['Hệ số áp lực đất chủ động ka (Coulomb) - tường chắn', 3],
  ['Hệ số Φ(P, Cs) đường tần suất Pearson III', 14],
  ['Mặt cắt chữ nhật BTCT: vật liệu, uốn, cắt, nứt', 24],
  ['Sức kháng dọc trục cọc khoan nhồi theo đất nền', 9],
  ['Thân trụ đặc chịu nén - uốn (biểu đồ tương tác), mặt cắt chữ nhật', 3],
  ['Phân tích khung phẳng có lò xo (khung trụ dẻo, cống hộp)', 6],
  ['Cọc chịu tải ngang và nhóm cọc bệ cứng (mố nặng, trụ đặc)', 7],
  ['Tường chắn: áp lực đất chủ động theo lăng thể trượt thử dần', 4],
];

const EXPECTED_LIVE_GROUP_COUNTS: ReadonlyArray<readonly [string, number]> = [
  ['Số liệu đang mở: nội lực hoạt tải HL-93 trên dầm giản đơn', 9],
  ['Số liệu đang mở: hệ số phân bố ngang dầm giữa (mặt cắt loại f, g)', 4],
  ['Số liệu đang mở: co ngót, từ biến, mất mát ứng suất trước dầm giữa (dầm bản rỗng căng trước)', 14],
  ['Số liệu đang mở: gối chất dẻo cốt bản thép (phương pháp B)', 20],
  ['Số liệu đang mở: bản mặt cầu - bề rộng dải tương đương', 2],
  ['Số liệu đang mở: khe co giãn - chuyển vị', 4],
  ['Số liệu đang mở: mố - áp lực đất', 6],
  ['Số liệu đang mở: thủy văn - lưu lượng thiết kế theo TCVN 9845', 6],
  ['Số liệu đang mở: thủy văn - lưu lượng qua mặt cắt (Manning)', 4],
  ['Số liệu đang mở: tường chắn - áp lực đất', 1],
  ['Số liệu đang mở: cống hộp - tải trọng đất, hoạt tải qua lớp đất đắp', 6],
  ['Số liệu đang mở: cống tròn - tải trọng, thiết kế gián tiếp', 5],
  ['Số liệu đang mở: bản quá độ - tải trọng', 4],
  ['Số liệu đang mở: bản liên tục nhiệt', 3],
  ['Số liệu đang mở: gờ lan can - phân tích đường chảy dẻo', 4],
];

let cachedPanes: PaneFixture[] | null = null;
function loadPanesFixture(): PaneFixture[] {
  if (!cachedPanes) {
    cachedPanes = JSON.parse(readFileSync(PANES_PATH, 'utf8')) as PaneFixture[];
  }
  return cachedPanes;
}

function seedDomWithPanes(doc: Document): void {
  doc.head.innerHTML = '';
  doc.body.innerHTML = '';

  const sel = doc.createElement('select');
  sel.id = 'appMode';
  for (const m of APP_MODES) {
    const opt = doc.createElement('option');
    opt.value = m;
    opt.textContent = m;
    sel.appendChild(opt);
  }
  sel.value = 'cau';
  doc.body.appendChild(sel);

  const xmsg = doc.createElement('div');
  xmsg.id = 'xmsg';
  doc.body.appendChild(xmsg);

  const vtSum = doc.createElement('div');
  vtSum.id = 'vt_sum';
  doc.body.appendChild(vtSum);

  const vtTb = doc.createElement('table');
  vtTb.id = 'vt_tb';
  doc.body.appendChild(vtTb);

  for (const pane of loadPanesFixture()) {
    const div = doc.createElement('div');
    div.className = 'pane';
    div.id = pane.paneId;
    div.innerHTML = pane.html;
    doc.body.appendChild(div);
  }
}

function resetAllEngineState(): void {
  resetAllContexts();
  clearContextStore();
  setAppModeState('cau');
  setLatestDamResult(null);
  setLatestRcgResult(null);
  setLatestLim(null);
  setLatestGirResult(null);
  setLatestSup2Result(null);
  setLatestLtnResult(null);
  setLatestKcgResult(null);
  setLatestGlcResult(null);
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
  setLatestQdResult(null);
  setLatestSfmResult(null);
  setLatestChResult(null);
  setLatestChnResult(null);
  setLatestCtResult(null);
  setLatestTcResult(null);
  setLatestTlResult(null);
  setLatestHvResult(null);
  setLatestTvcResult(null);
  setLatestVtResult(null);
}

function buildUpstreamOracle(): UpstreamOracle {
  const isoDoc = document.implementation.createHTMLDocument('upstream-oracle');
  seedDomWithPanes(isoDoc);

  const storage = new Map<string, string>();
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

  const ctx = vm.createContext({
    document: isoDoc,
    navigator: window.navigator,
    location: window.location,
    localStorage: fakeLocalStorage,
    Element: window.Element,
    HTMLElement: window.HTMLElement,
    HTMLInputElement: window.HTMLInputElement,
    HTMLSelectElement: window.HTMLSelectElement,
    HTMLTextAreaElement: window.HTMLTextAreaElement,
    HTMLTableElement: window.HTMLTableElement,
    Event: window.Event,
    CustomEvent: window.CustomEvent,
    MutationObserver: window.MutationObserver,
    DOMParser: window.DOMParser,
    XMLSerializer: window.XMLSerializer,
    getComputedStyle: window.getComputedStyle.bind(window),
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
    setTimeout: () => 0,
    clearTimeout: () => {},
    setInterval: () => 0,
    clearInterval: () => {},
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
    fetch: async () => ({ ok: false, status: 404 }),
    console: { log: () => {}, warn: () => {}, error: () => {} },
    Math,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Date,
    JSON,
    Map,
    Set,
    WeakMap,
    WeakSet,
    RegExp,
    Error,
    TypeError,
    RangeError,
    Promise,
    Float64Array,
    Float32Array,
    Int32Array,
    Uint32Array,
    Uint8Array,
    Uint16Array,
    Uint8ClampedArray,
    ArrayBuffer,
    DataView,
    isFinite,
    isNaN,
    parseFloat,
    parseInt,
    encodeURIComponent,
    decodeURIComponent,
    URL,
    Blob,
    TextEncoder,
    TextDecoder,
    Plotly: undefined,
    MathJax: undefined,
  });
  (ctx as Record<string, unknown>).window = ctx;
  (ctx as Record<string, unknown>).globalThis = ctx;

  const moduleFiles = [
    '01_boot_shims_and_sf.js',
    '02_core_utils_and_column_pm.js',
    '03_abutment_loads_and_rc.js',
    '04_girder_slab_hollow_rc.js',
    '05_girder_post_tensioned_i.js',
    '06_retaining_wall_gravity.js',
    '07_approach_slab_and_culvert_soil.js',
    '08_flexible_abutment_md.js',
    '09_retaining_wall_cantilever_l.js',
    '10_superstructure_ui_and_deck_joints.js',
    '11_culverts_box_and_circular.js',
    '12_piles_geotech_mcoc_and_pm3d.js',
    '13_pier_flexible_tr.js',
    '14_pier_solid_dct_and_shallow_fdn_ui.js',
    '15_bridge_hydrology_data_and_calc.js',
    '16_dem_watershed_ocr_dxf_import.js',
    '17_culvert_hydrology_and_dxftools.js',
    '19_lookup_caption_mode_guard.js',
    '20_verification_tests_vt.js',
  ];

  for (const file of moduleFiles) {
    vm.runInContext(readFileSync(resolve(MODULES_DIR, file), 'utf8'), ctx, { filename: file });
  }

  return {
    vtChecks: vm.runInContext('VT.C', ctx) as UpstreamVtCheck[],
    vtRunFixedOnly: vm.runInContext(
      `(() => () => VT.C.map((c) => {
        let v = NaN, err = '';
        try { v = +c.f(); } catch (e) { err = e.message || String(e); }
        const d = v - c.ref;
        const lim = c.tol.abs != null ? c.tol.abs : Math.abs(c.ref) * c.tol.rel;
        const ok = !err && isFinite(v) && Math.abs(d) <= lim + 1e-12;
        return { ...c, v, d, rel: c.ref ? d / Math.abs(c.ref) : NaN, lim, ok, err };
      }))()`,
      ctx,
    ) as () => UpstreamVtResult[],
    vtRunAll: vm.runInContext('() => VT.run()', ctx) as () => UpstreamVtResult[],
    hl93: vm.runInContext('VT.hl93', ctx) as (L: number, x: number) => { M: number; Q: number },
    lk: vm.runInContext('window.LK', ctx) as Record<string, { t: string; f: () => string }>,
    runUpstreamAll: vm.runInContext(
      `(() => () => {
        for (const fn of [run, qdStep, trStep, dcStep, chStep, chnStep, ctStep, tcStep, tlStep, hvStep, tvcStep]) {
          try { fn(); } catch (_) {}
        }
      })()`,
      ctx,
    ) as () => void,
  };
}

function countByGroup(rows: ReadonlyArray<{ g: string }>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.g] = (counts[r.g] || 0) + 1;
  return counts;
}

function expectCloseParity(actual: number, expected: number, tol = 1e-9, label = 'value'): void {
  if (Number.isNaN(expected)) {
    expect(Number.isNaN(actual), `${label} expected NaN, got ${actual}`).toBe(true);
    return;
  }
  const allowed = Math.max(tol, tol * Math.abs(expected));
  expect(
    Math.abs(actual - expected),
    `${label}: actual=${actual}, expected=${expected}`,
  ).toBeLessThanOrEqual(allowed);
}

describe('Step 5.5 part 3 — Verification Suite (VT), Orchestrator (runAll) & Lookup Tables (LK)', () => {
  let oracle: UpstreamOracle;

  beforeAll(() => {
    oracle = buildUpstreamOracle();
    oracle.runUpstreamAll();
  }, 60_000);

  beforeEach(() => {
    resetAllEngineState();
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // =========================================================================
  // 1. Fixed Benchmark Suite (VT.C — 106 checks across G1..G9)
  // =========================================================================
  describe('1. VT.runSuite() Fixed Benchmarks (106 checks across G1..G9)', () => {
    it('runs VT.runSuite() and vtRender() in pure headless Node (document/window undefined) with 106/106 passed', () => {
      vi.stubGlobal('document', undefined);
      vi.stubGlobal('window', undefined);
      vi.stubGlobal('localStorage', undefined);

      expect(typeof document).toBe('undefined');
      expect(VT.C.length).toBe(106);

      const suite = runSuite();
      expect(suite.fixedCount).toBe(106);
      expect(suite.liveCount).toBe(0);
      expect(suite.totalCount).toBe(106);
      expect(suite.passedCount).toBe(106);
      expect(suite.failedCount).toBe(0);
      expect(getLatestVtResult()).toBe(suite);
      expect(suite.results.every((r) => r.ok && r.err === '' && Number.isFinite(r.v))).toBe(true);

      const groupCounts = countByGroup(suite.results);
      expect(Object.keys(groupCounts)).toHaveLength(9);
      for (const [g, expectedCount] of EXPECTED_GROUP_COUNTS) {
        expect(groupCounts[g], `Group count mismatch for ${g}`).toBe(expectedCount);
      }

      // vtRender() and initVerificationDom() must also execute cleanly without DOM
      const rendered = vtRender();
      expect(rendered.passedCount).toBe(106);
      expect(rendered.failedCount).toBe(0);
      const cleanup = initVerificationDom();
      expect(() => cleanup()).not.toThrow();
    });

    it('runs VT.runSuite(), vtRender(), and initVerificationDom() in jsdom with 106/106 passed and clean table rendering', () => {
      document.body.innerHTML = `
        <div class="tabs"><button type="button" class="tab" data-t="60">Kiểm chứng</button></div>
        <button type="button" id="vt_run">Chạy lại</button>
        <div id="vt_sum"></div>
        <table id="vt_tb"></table>
      `;

      const suite = VT.runSuite();
      expect(suite.fixedCount).toBe(106);
      expect(suite.liveCount).toBe(0);
      expect(suite.totalCount).toBe(106);
      expect(suite.passedCount).toBe(106);
      expect(suite.failedCount).toBe(0);

      const rendered = vtRender();
      expect(rendered.passedCount).toBe(106);
      const sumText = document.getElementById('vt_sum')!.textContent || '';
      expect(sumText).toContain('Tổng số kiểm tra: 106');
      expect(sumText).toContain('đạt: 106');
      expect(sumText).toContain('không đạt: 0');

      const tb = document.getElementById('vt_tb')!;
      expect(tb.querySelectorAll('tr.grp').length).toBe(9);
      expect(tb.querySelectorAll('td.ok').length).toBe(106);
      expect(tb.querySelectorAll('td.bad').length).toBe(0);

      // Verify click delegation triggers vtRender via timer and cleanup removes listener
      vi.useFakeTimers();
      try {
        const cleanup = initVerificationDom();
        document.getElementById('vt_sum')!.textContent = 'stale';
        (document.getElementById('vt_run') as HTMLButtonElement).click();
        vi.advanceTimersByTime(100);
        expect(document.getElementById('vt_sum')!.textContent).toContain('đạt: 106');

        cleanup();
        document.getElementById('vt_sum')!.textContent = 'after-cleanup';
        (document.getElementById('vt_run') as HTMLButtonElement).click();
        vi.advanceTimersByTime(100);
        expect(document.getElementById('vt_sum')!.textContent).toBe('after-cleanup');
      } finally {
        vi.useRealTimers();
      }
    });

    it('matches upstream 20_verification_tests_vt.js VT.C metadata, tolerances, formulas, and results 100% in Node vm', () => {
      const jsChecks = oracle.vtChecks;
      const jsResults = oracle.vtRunFixedOnly();
      const tsResults = runVtSuite();

      expect(VT.C.length).toBe(106);
      expect(jsChecks.length).toBe(106);
      expect(tsResults.length).toBe(106);
      expect(jsResults.length).toBe(106);
      expect(jsResults.every((r) => r.ok)).toBe(true);
      expect(tsResults.every((r) => r.ok)).toBe(true);

      for (let i = 0; i < 106; i++) {
        const tsC = VT.C[i];
        const jsC = jsChecks[i];
        const tsR = tsResults[i];
        const jsR = jsResults[i];

        expect(tsC.g, `VT.C[${i}].g`).toBe(jsC.g);
        expect(tsC.t, `VT.C[${i}].t`).toBe(jsC.t);
        expect(tsC.q, `VT.C[${i}].q`).toBe(jsC.q);
        expect(tsC.u, `VT.C[${i}].u`).toBe(jsC.u);
        expect(tsC.src, `VT.C[${i}].src`).toBe(jsC.src);
        expectCloseParity(tsC.ref, jsC.ref, 1e-12, `VT.C[${i}].ref`);
        expect(tsC.tol).toEqual(jsC.tol);

        expectCloseParity(tsR.v, jsR.v, 1e-9, `VT.run[${i}].v (${tsC.g} / ${tsC.q})`);
        expectCloseParity(tsR.d, jsR.d, 1e-9, `VT.run[${i}].d`);
        expectCloseParity(tsR.lim, jsR.lim, 1e-12, `VT.run[${i}].lim`);
        expect(tsR.ok).toBe(jsR.ok);
      }

      // Differential check on VT.hl93(L, x) across spans and positions
      for (const L of [12, 18, 24, 33]) {
        for (const frac of [0, 0.25, 0.5, 0.75, 1]) {
          const x = L * frac;
          const tsH = hl93(L, x);
          const jsH = oracle.hl93(L, x);
          expectCloseParity(tsH.M, jsH.M, 1e-12, `hl93(${L}, ${x}).M`);
          expectCloseParity(tsH.Q, jsH.Q, 1e-12, `hl93(${L}, ${x}).Q`);
        }
      }
    });
  });

  // =========================================================================
  // 2. Orchestrator runAll() Modes & VT.live() End-to-End Parity
  // =========================================================================
  describe('2. runAll() Modes & VT.live() Integration Parity', () => {
    it('executes runAll across all AppModes in pure headless mode without uncaught throws', () => {
      vi.stubGlobal('document', undefined);
      vi.stubGlobal('window', undefined);
      vi.stubGlobal('localStorage', undefined);

      const modes: ReadonlyArray<AppMode | 'all'> = ['all', ...APP_MODES];
      const modeErrors: Record<string, Array<{ step: string; error: string }>> = {};

      for (const m of modes) {
        resetAllEngineState();
        const res = runAll(m);
        expect(res.mode).toBe(m);
        modeErrors[m] = res.errors;
        expect(Array.isArray(res.errors)).toBe(true);
      }

      // Without panes.json DOM inputs or seeded contextStore, hydrology/bridge/culvert/wall live
      // state either has empty inputs (e.g., `$('hv_F')` is null, girder/slab/culvert DOM inputs
      // are absent) or produces guarded input validation rather than uncaught exceptions.
      const headlessSuite = runSuite();
      expect(headlessSuite.fixedCount).toBe(106);
      expect(headlessSuite.failedCount).toBe(0);
      expect(headlessSuite.passedCount).toBe(headlessSuite.totalCount);
      // Confirm which headless steps stayed error-free vs input-dependent
      expect(modeErrors['cau']).toEqual([]);
      expect(modeErrors['tv']).toEqual([]);
      expect(modeErrors['tvc']).toEqual([]);
      expect(modeErrors['tc']).toEqual([]);
      expect(modeErrors['tl']).toEqual([]);
    }, 30_000);

    it('runs all AppModes + runAll("all") in jsdom seeded with panes.json with 0 errors and all 15 VT.live() blocks passing', () => {
      seedDomWithPanes(document);

      for (const m of APP_MODES) {
        const res = runAll(m);
        expect(res.mode).toBe(m);
        expect(res.errors, `runAll('${m}') errors`).toEqual([]);
      }

      resetAllEngineState();
      seedDomWithPanes(document);

      const allRes = runAll('all');
      expect(allRes.mode).toBe('all');
      expect(allRes.errors).toEqual([]);

      const suite = VT.runSuite();
      expect(suite.fixedCount).toBe(106);
      expect(suite.liveCount).toBe(92);
      expect(suite.totalCount).toBe(198);
      expect(suite.passedCount).toBe(198);
      expect(suite.failedCount).toBe(0);
      expect(suite.results.every((r) => r.ok && r.err === '')).toBe(true);

      const tsLiveRows = suite.results.slice(suite.fixedCount);
      const tsLiveGroups = countByGroup(tsLiveRows);
      expect(Object.keys(tsLiveGroups)).toHaveLength(15);
      for (const [g, cnt] of EXPECTED_LIVE_GROUP_COUNTS) {
        expect(tsLiveGroups[g], `Live group count mismatch for ${g}`).toBe(cnt);
      }

      // Differential parity against upstream VT.live() in Node vm on identical panes.json DOM
      const jsAll = oracle.vtRunAll();
      const jsLiveRows = jsAll.slice(106);
      expect(jsLiveRows.length).toBe(tsLiveRows.length);
      expect(jsAll.every((r) => r.ok)).toBe(true);

      const keyOf = (r: { g: string; t: string; q: string; u: string }) =>
        `${r.g}|||${r.t}|||${r.q}|||${r.u}`;
      const jsMap = new Map<string, UpstreamVtResult>();
      for (const r of jsLiveRows) {
        jsMap.set(keyOf(r), r);
      }

      for (const tsR of tsLiveRows) {
        const jsR = jsMap.get(keyOf(tsR));
        expect(jsR, `Missing upstream live check for ${keyOf(tsR)}`).toBeDefined();
        if (!jsR) continue;
        expectCloseParity(tsR.ref, jsR.ref, 1e-6, `live.ref ${tsR.q}`);
        expectCloseParity(tsR.v, jsR.v, 1e-6, `live.v ${tsR.q}`);
        expect(tsR.ok).toBe(true);
      }
    }, 60_000);

    it('activates and passes the I-girder DF & post-tensioning VT.live() block when girder type is switched to I-girder', () => {
      seedDomWithPanes(document);
      const typeSelect = document.getElementById('sp_type') as HTMLSelectElement | null;
      expect(typeSelect).not.toBeNull();
      typeSelect!.value = 'I';

      damStep({ hooks: { giStep: (I, LIM) => { giStep(I, LIM); } } });
      expect(getLatestDamResult()?.type).toBe('I');

      const liveChecks: VerificationCheckResult[] = VT.runSuite().results.slice(106);
      const iDfChecks = liveChecks.filter(
        (r) => r.g === 'Số liệu đang mở: hệ số phân bố ngang dầm I giữa (mặt cắt loại a, e, k)',
      );
      const iLossChecks = liveChecks.filter(
        (r) =>
          r.g ===
          'Số liệu đang mở: co ngót, từ biến, mất mát ứng suất trước dầm giữa (dầm I căng sau)',
      );

      expect(iDfChecks.length).toBe(4);
      expect(iLossChecks.length).toBe(12);
      expect(iDfChecks.every((r) => r.ok)).toBe(true);
      expect(iLossChecks.every((r) => r.ok)).toBe(true);
      expect(live().length).toBeGreaterThanOrEqual(25);
    });
  });

  // =========================================================================
  // 3. Lookup Tables (lookupTables.ts: 20 LK tables, 30 LOOKUP_MAP bindings)
  // =========================================================================
  describe('3. Standard Lookup Tables (LK / LOOKUP_MAP / initLookupBindings)', () => {
    it('exports 20 LK tables and 30 LOOKUP_MAP bindings matching upstream 19_lookup_caption_mode_guard.js', () => {
      expect(LOOKUP_KEYS).toHaveLength(20);
      expect(Object.keys(LK)).toHaveLength(20);
      expect(LOOKUP_MAP).toHaveLength(30);
      expect(LOOKUP_BINDINGS).toHaveLength(30);

      // Seed panes.json and run bridge pipeline so dynamic output nodes (`#o_mo_bd`, `#mo_gEQ`, etc.)
      // match the solved upstream oracle DOM before comparing all 20 rendered HTML/SVG tables.
      seedDomWithPanes(document);
      runAll('cau');

      const upstreamKeys = Object.keys(oracle.lk);
      expect(LOOKUP_KEYS).toEqual(upstreamKeys);

      for (const k of LOOKUP_KEYS) {
        const entry = getLookupEntry(k);
        expect(entry).not.toBeNull();
        expect(entry!.t).toBe(oracle.lk[k].t);
        expect(entry!.f()).toBe(oracle.lk[k].f());
      }

      expect(getLookupEntry('nonexistent')).toBeNull();
      expect(getLookupTargetForField('mo_del')).toBe('del');
      expect(getLookupTargetForField('Q_mo_del')).toBe('del');
      expect(getLookupTargetForField('T_s2_phig')).toBe('phig');
      expect(getLookupTargetForField('unknown_field')).toBeNull();
      expect(getLookupTargetForField('')).toBeNull();
    });

    it('resolves bindings on panes.json DOM, attaches Tra buttons idempotently, and fills target inputs on click', () => {
      seedDomWithPanes(document);

      const resolved = resolveLookupBindings(document);
      expect(resolved.length).toBeGreaterThanOrEqual(25);
      expect(resolved.some((b) => b.k === 'del' && b.target?.id === 'mo_del')).toBe(true);
      expect(resolved.some((b) => b.k === 'grade' && b.target?.id === 'rc_grade')).toBe(true);

      initLookupBindings(document);
      const firstButtonCount = document.querySelectorAll('.tra[data-k]').length;
      expect(firstButtonCount).toBeGreaterThanOrEqual(25);
      expect(document.querySelectorAll('#lkStyle')).toHaveLength(1);
      expect(document.querySelectorAll('#lkBg')).toHaveLength(1);

      // Idempotent on repeat calls
      initLookupBindings(document);
      expect(document.querySelectorAll('.tra[data-k]').length).toBe(firstButtonCount);
      expect(document.querySelectorAll('#lkStyle')).toHaveLength(1);
      expect(document.querySelectorAll('#lkBg')).toHaveLength(1);

      // Click "Tra" button for `mo_del`, pick value cell, verify input/change events & modal close
      const bg = document.getElementById('lkBg') as HTMLElement;
      expect(bg.hidden).toBe(true);

      const delBtn = document.querySelector('.tra[data-k="del"]') as HTMLButtonElement;
      expect(delBtn).not.toBeNull();
      delBtn.click();
      expect(bg.hidden).toBe(false);
      expect(document.getElementById('lkTt')!.textContent).toBe(LK.del.t);

      const targetInput = document.getElementById('mo_del') as HTMLInputElement;
      let inputFired = 0;
      let changeFired = 0;
      targetInput.addEventListener('input', () => {
        inputFired++;
      });
      targetInput.addEventListener('change', () => {
        changeFired++;
      });

      const cell = document.querySelector('#lkBd td[data-v="24"]') as HTMLElement;
      expect(cell).not.toBeNull();
      cell.click();

      expect(targetInput.value).toBe('24');
      expect(inputFired).toBe(1);
      expect(changeFired).toBe(1);
      expect(bg.hidden).toBe(true);

      // Escape key and close button close the modal
      delBtn.click();
      expect(bg.hidden).toBe(false);
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(bg.hidden).toBe(true);

      delBtn.click();
      expect(bg.hidden).toBe(false);
      (document.getElementById('lkX') as HTMLButtonElement).click();
      expect(bg.hidden).toBe(true);

      // formatCaptionsAndTables centers captions and adds .fit only outside #tab60
      document.body.innerHTML += `
        <p class="cap" id="test_cap">Hình 1 - Mặt cắt cầu</p>
        <p class="small" id="test_small">Bảng 2: Hệ số tải trọng</p>
        <table class="dt" id="t_outside"><tr><th>A</th><th>B</th><th>C</th></tr></table>
        <div id="tab60"><table class="dt" id="t_inside60"><tr><th>A</th><th>B</th></tr></table></div>
      `;
      formatCaptionsAndTables(document);
      expect(document.getElementById('test_cap')!.classList.contains('ctr')).toBe(true);
      expect(document.getElementById('test_small')!.classList.contains('ctr')).toBe(true);
      expect(document.getElementById('t_outside')!.classList.contains('fit')).toBe(true);
      expect(document.getElementById('t_inside60')!.classList.contains('fit')).toBe(false);
    });
  });

  // =========================================================================
  // 4. Clean-Room & Zero-CDN Compliance Audit
  // =========================================================================
  describe('4. Strict Clean-Room & Zero-CDN Compliance Audit', () => {
    it('contains zero external HTTP(S) URLs and zero licensing/HWID/trial identifiers in verification, lookup, orchestrator, and index', () => {
      const files = [
        'src/culvert/engine/verification/verificationSuite.ts',
        'src/culvert/engine/verification/lookupTables.ts',
        'src/culvert/engine/orchestrator.ts',
        'src/culvert/engine/index.ts',
      ];
      const forbiddenPattern = /https?:\/\/|license|hwid|machineId|trial|\.lic/i;

      for (const relPath of files) {
        const content = readFileSync(resolve(WEB_ROOT, relPath), 'utf8');
        const match = content.match(forbiddenPattern);
        expect(match, `Forbidden pattern found in ${relPath}: ${match?.[0] ?? ''}`).toBeNull();
      }
    });
  });
});
