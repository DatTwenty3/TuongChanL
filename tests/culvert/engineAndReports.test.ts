import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearContextStore,
  contextState,
  getOutputValue,
  getVisualHooks,
  loadBuiltinDem,
  resetAllContexts,
  runAll,
  runWatershed,
  setContextStore,
  updateContextStore,
  capStep,
  chStep,
  chnStep,
  ctStep,
  damLoadLib,
  damStep,
  dcStep,
  getLatestCapResult,
  getLatestChResult,
  getLatestChnResult,
  getLatestCtResult,
  getLatestDamResult,
  getLatestDcResult,
  getLatestGirResult,
  getLatestHvResult,
  getLatestMdCapResult,
  getLatestMorResult,
  getLatestRcgResult,
  getLatestRcmResult,
  getLatestTcResult,
  getLatestTlResult,
  getLatestTrCheck,
  getLatestTrResult,
  getLatestTvcResult,
  giLoadLib,
  giStep,
  hvStep,
  mcocStep,
  mdFlex,
  mdFlexTxt,
  moInputs,
  moStep,
  rcStep,
  rcgLoadLib,
  rcgStep,
  sctCheck,
  sctStep,
  setLatestCapResult,
  setLatestChResult,
  setLatestChnResult,
  setLatestCtResult,
  setLatestDamResult,
  setLatestDcResult,
  setLatestGirResult,
  setLatestHvResult,
  setLatestMdCapResult,
  setLatestMdFlexResult,
  setLatestMorResult,
  setLatestRcgResult,
  setLatestRcmResult,
  setLatestTcResult,
  setLatestTlResult,
  setLatestTrCheck,
  setLatestTrResult,
  setLatestTvcResult,
  sfmStep,
  tab3Step,
  tcStep,
  tlStep,
  trStep,
  tvcStep,
  HVD,
  HVSTL,
  SAMPLE_CD,
  SAMPLE_DB,
  type VisualReportHooks,
} from '../../src/culvert/engine/index.ts';
import {
  getDefaultVisualHooks,
  registerDefaultVisualHooks,
  resetVisualReportHooksForTest,
  drawB1CurveSvg,
  drawDrilledShaftGroupSvg,
  drawPileDepthProfile,
  drawPilePlanSvg,
  renderCircularPmHook,
  renderPm3dHook,
  renderShallowFdnFigsHook,
  renderPileGroupHook,
  renderDrilledShaftHook,
  renderBoxCulvertVisuals,
  renderChnVisuals,
  renderPipeCulvertVisuals,
  renderGravityWallVisuals,
  renderCantileverWallVisuals,
  renderDemPreviewSvg,
  renderDemWatershedVisuals,
  renderBridgeHydroVisuals,
  renderCulvertHydroVisuals,
  renderGirderHollowVisuals,
  renderGirderIVisuals,
  renderAbutmentHeavyVisuals,
  renderAbutmentFlexVisuals,
  renderPierFlexVisuals,
  renderPierSolidVisuals,
  renderBridgeSummaryVisuals,
  sfCapFig,
} from '../../src/culvert/reports/index.ts';
import { TEXC } from '../../src/culvert/graphics/texMath.ts';
import type { CircularPmCurveResult } from '../../src/culvert/types/project.ts';
import type { CircularSection, St3StateMap } from '../../src/culvert/engine/math/rc.ts';
import type { SctCalcOutput } from '../../src/culvert/engine/foundations/drilledShaft.ts';
import type { TvxSavedGeo } from '../../src/culvert/engine/hydrology/culvertHydro.ts';

const testDir = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(testDir, '../..');
const PUBLIC_DIR = resolve(WEB_ROOT, 'public');

const REPORT_FILES = [
  'src/culvert/reports/index.ts',
  'src/culvert/reports/foundationReports.ts',
  'src/culvert/reports/culvertWallReports.ts',
  'src/culvert/reports/hydroDemReports.ts',
  'src/culvert/reports/bridgeReports.ts',
] as const;

let defaultPaneInputs: Record<string, string> = {};
const originalFetch = globalThis.fetch;

/**
 * Parse default input values from `src/assets/panes.json` via `JSON.parse` + DOM parsing
 * (never running regexes against `panes.json`).
 */
function loadDefaultPaneInputs(): Record<string, string> {
  const raw = readFileSync(resolve(WEB_ROOT, 'src/culvert/assets/panes.json'), 'utf8');
  const panes = JSON.parse(raw) as Record<string, { html?: string }>;
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

/** Run callback with `document` and `window` temporarily undefined to verify pure headless Node behavior. */
function withHeadlessEnv<T>(fn: () => T): T {
  vi.stubGlobal('document', undefined);
  vi.stubGlobal('window', undefined);
  try {
    return fn();
  } finally {
    vi.unstubAllGlobals();
  }
}

/** Create minimal jsdom fixture nodes (div / svg / table / button / select / span) and mount into `document.body`. */
function mountDomFixtures(spec: {
  svgs?: readonly string[];
  divs?: readonly string[];
  tables?: readonly string[];
  spans?: readonly string[];
  buttons?: readonly string[];
  selects?: ReadonlyArray<{ id: string; options: ReadonlyArray<string>; value?: string }>;
  inputs?: ReadonlyArray<{ id: string; value: string }>;
}): HTMLElement {
  const root = document.createElement('div');
  root.id = '__test_fixtures';

  for (const id of spec.svgs ?? []) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = id;
    root.appendChild(svg);
  }
  for (const id of spec.divs ?? []) {
    const div = document.createElement('div');
    div.id = id;
    root.appendChild(div);
  }
  for (const id of spec.tables ?? []) {
    const tbl = document.createElement('table');
    tbl.id = id;
    root.appendChild(tbl);
  }
  for (const id of spec.spans ?? []) {
    const span = document.createElement('span');
    span.id = id;
    root.appendChild(span);
  }
  for (const id of spec.buttons ?? []) {
    const btn = document.createElement('button');
    btn.id = id;
    root.appendChild(btn);
  }
  for (const s of spec.selects ?? []) {
    const sel = document.createElement('select');
    sel.id = s.id;
    for (const optVal of s.options) {
      const opt = document.createElement('option');
      opt.value = optVal;
      opt.textContent = optVal;
      sel.appendChild(opt);
    }
    if (s.value !== undefined) sel.value = s.value;
    root.appendChild(sel);
  }
  for (const inp of spec.inputs ?? []) {
    const input = document.createElement('input');
    input.id = inp.id;
    input.value = inp.value;
    root.appendChild(input);
  }

  document.body.appendChild(root);
  return root;
}

function resetAllTestState(): void {
  resetVisualReportHooksForTest();
  clearContextStore();
  resetAllContexts();
  TEXC.clear();

  setLatestDamResult(null);
  setLatestRcgResult(null);
  setLatestGirResult(null);
  setLatestMorResult(null);
  setLatestRcmResult(null);
  setLatestCapResult(null);
  setLatestMdFlexResult(null);
  setLatestMdCapResult(null);
  setLatestTrResult(null);
  setLatestTrCheck(null);
  setLatestDcResult(null);
  setLatestChResult(null);
  setLatestChnResult(null);
  setLatestCtResult(null);
  setLatestTcResult(null);
  setLatestTlResult(null);
  setLatestHvResult(null);
  setLatestTvcResult(null);

  if (typeof document !== 'undefined' && document.body) {
    document.body.innerHTML = '';
  }
}

function seedDefaults(overrides: Record<string, string | number | boolean> = {}): void {
  setContextStore({
    ...defaultPaneInputs,
    tab15: '1',
    tab18: '1',
    tab41: '1',
    tab44: '1',
    tab61: '1',
    tab70: '1',
    ...overrides,
  });
}

beforeAll(() => {
  defaultPaneInputs = loadDefaultPaneInputs();
});

beforeEach(() => {
  resetAllTestState();
  globalThis.fetch = originalFetch;
});

afterEach(() => {
  vi.unstubAllGlobals();
  globalThis.fetch = originalFetch;
  resetAllTestState();
});

describe('Step 5.6 part 5 — Engine & Visual Reports End-to-End Integration', () => {
  // =========================================================================
  // 1. Hook Registration & Reset Lifecycle
  // =========================================================================
  describe('1. registerDefaultVisualHooks() & Hook Reset Lifecycle', () => {
    const EXPECTED_HOOK_KEYS: ReadonlyArray<keyof VisualReportHooks> = [
      'renderMath',
      'renderCircularPm',
      'renderPm3d',
      'renderShallowFdnFigs',
      'renderPileGroup',
      'renderDrilledShaft',
      'renderBoxCulvert',
      'renderChn',
      'renderPipeCulvert',
      'renderGravityWall',
      'renderCantileverWall',
      'renderGirderHollow',
      'renderGirderI',
      'renderAbutmentHeavy',
      'renderAbutmentFlex',
      'renderPierFlex',
      'renderPierSolid',
      'renderHydrology',
    ];

    it('registers every VisualReportHooks handler plus renderBridgeStationMap and resets cleanly', () => {
      expect(Object.keys(getVisualHooks())).toEqual([]);

      const registered = registerDefaultVisualHooks() as VisualReportHooks & {
        renderBridgeStationMap?: unknown;
      };
      for (const key of EXPECTED_HOOK_KEYS) {
        expect(typeof registered[key], `Missing hook ${key}`).toBe('function');
      }
      expect(typeof registered.renderBridgeStationMap).toBe('function');
      expect(getVisualHooks()).toBe(registered);

      resetVisualReportHooksForTest();
      expect(Object.keys(getVisualHooks())).toEqual([]);
    });

    it('executes renderMath safely headless and with offline texToUnicode or mocked MathJax in jsdom', () => {
      const hooks = getDefaultVisualHooks();

      // Headless Node (document === undefined)
      expect(() => withHeadlessEnv(() => hooks.renderMath?.())).not.toThrow();

      // jsdom without window.MathJax -> offline texToUnicode fallback
      const span = document.createElement('span');
      span.className = 'm';
      span.dataset.tex = '\\frac{M_u}{\\phi M_n}';
      document.body.appendChild(span);

      hooks.renderMath?.();
      expect(span.textContent).toContain('(M_u)/( M_n)');
      expect(span.dataset.r).toBe('0\\frac{M_u}{\\phi M_n}');

      // jsdom with mocked offline window.MathJax.tex2svg
      const svgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svgNode.setAttribute('width', '4ex');
      svgNode.setAttribute('height', '2ex');
      const wrap = document.createElement('mjx-container');
      wrap.appendChild(svgNode);
      (window as unknown as { MathJax?: unknown }).MathJax = {
        tex2svg: vi.fn(() => wrap),
      };

      hooks.renderMath?.();
      expect(span.innerHTML).toContain('<svg');
      expect(span.dataset.r).toBe('1\\frac{M_u}{\\phi M_n}');
    });
  });

  // =========================================================================
  // 2. Foundation Reports
  // =========================================================================
  describe('2. Foundation Visual Reports (Circular P-M, 3D P-M-M, Shallow, Pile Group, Drilled Shaft)', () => {
    it('renders circular column P-M (#dgCD, #dgDB, #dgSec, #tbBar) and 3D P-M-M (#p3d, #tbBi, #klBi) via tab3Step + hooks', () => {
      registerDefaultVisualHooks();
      seedDefaults({
        src: 'manual',
        txtCD: SAMPLE_CD,
        txtDB: SAMPLE_DB,
        D: '1200',
        fc: '30',
        fy: '400',
        n1: '16',
        d1: '25',
        c1: '100',
        phic: '0.75',
        phit: '0.90',
        phicE: '1.0',
        phitE: '1.0',
        L0: '6.0',
        Kef: '1.0',
      });

      // Headless solver run
      const headlessOut = withHeadlessEnv(() => tab3Step());
      expect(headlessOut.CCD.pts.length).toBeGreaterThan(10);
      expect(headlessOut.CDB.pts.length).toBeGreaterThan(10);

      const st3 = contextState.ST3 as St3StateMap;
      expect(st3.CD.loads.length).toBeGreaterThan(0);

      const pmHookRes = withHeadlessEnv(() =>
        renderCircularPmHook({
          prefix: '',
          curve: headlessOut.CCD as CircularPmCurveResult,
          loads: headlessOut.LCD,
          section: headlessOut.S as CircularSection,
          state: 'CD',
        }),
      );
      expect(pmHookRes?.state).toBe('CD');
      expect(pmHookRes?.pmSvg).toContain('<svg');
      expect(pmHookRes?.sectionSvg).toContain('<svg');
      expect(pmHookRes?.tableHtml).toContain('<tr>');

      const pm3dHeadless = withHeadlessEnv(() =>
        renderPm3dHook({ prefix: '', state: 'CD', st3 }),
      );
      expect(pm3dHeadless).not.toBeNull();
      expect(pm3dHeadless!.usedPlotly).toBe(false);
      expect(pm3dHeadless!.count).toBeGreaterThan(0);
      expect(pm3dHeadless!.tableHtml).toContain('COMBINATION');

      // jsdom DOM injection via tab3Step()
      mountDomFixtures({
        svgs: ['dgCD', 'dgDB', 'dgSec'],
        divs: ['p3d', 'klCD', 'klDB', 'klBi'],
        tables: ['tbBar', 'tbComb', 'tbResCD', 'tbResDB', 'tbBi'],
        buttons: ['b3CD', 'b3DB'],
      });

      tab3Step();

      expect(document.getElementById('dgCD')!.innerHTML).toContain('<polygon');
      expect(document.getElementById('dgDB')!.innerHTML).toContain('<polygon');
      expect(document.getElementById('dgSec')!.innerHTML).toContain('<circle');
      expect(document.getElementById('tbBar')!.innerHTML).toContain('<tr>');
      expect(document.getElementById('p3d')!.innerHTML).toContain('<svg');
      expect(document.getElementById('tbBi')!.innerHTML).toContain('COMBINATION');
      expect(document.getElementById('klBi')!.innerHTML).toContain('Min φMn/Mu');
      expect(document.getElementById('b3CD')!.getAttribute('aria-pressed')).toBe('true');
      expect(document.getElementById('b3DB')!.getAttribute('aria-pressed')).toBe('false');

      // Interactive state toggle to DB
      document.getElementById('b3DB')!.click();
      expect(document.getElementById('b3DB')!.getAttribute('aria-pressed')).toBe('true');
      expect(document.getElementById('b3CD')!.getAttribute('aria-pressed')).toBe('false');
    });

    it('renders shallow footing diagrams (#dgEl, #dgPl, #dgSl, #dgSfCap6) via sfmStep + sfCapFig', () => {
      registerDefaultVisualHooks();
      seedDefaults({
        tq_mot: 'nang',
        mo_fnd: 'nong',
        mo_geo: 'dat',
        mo_phi: '30',
        mo_c: '15',
        mo_g: '19',
        mo_B: '4.0',
        mo_L: '9.0',
      });

      const mor = moStep()!;
      expect(mor).toBeTruthy();
      const iMo = moInputs();

      // Headless sfmStep + hook
      const sfHeadless = withHeadlessEnv(() =>
        sfmStep({ I: iMo, geo: mor.geo, combA: mor.comb.A }),
      )!;
      expect(sfHeadless).toBeTruthy();

      const hookHeadless = withHeadlessEnv(() =>
        renderShallowFdnFigsHook({ prefix: '', result: sfHeadless }),
      )!;
      expect(hookHeadless.elSvg).toContain('<svg');
      expect(hookHeadless.plSvg).toContain('<svg');
      expect(hookHeadless.slSvg).toContain('<svg');

      const capSvgHeadless = withHeadlessEnv(() =>
        sfCapFig(
          'dgSfCap6',
          { B: 4.0, L: 9.0, h: 1.2, s1: 0.9, s2: 0.9, sName: 'Mố' },
          { id: 'CD1', V: 4500, My: 1200, Mx: 150 },
          ['Bề rộng B', 'Chiều dài L', 'Mặt cắt I-I / II-II'],
        ),
      );
      expect(capSvgHeadless).toContain('<svg');

      // jsdom DOM injection (sfmStep passes prefix 'sfm_' into sfRender)
      mountDomFixtures({
        svgs: ['sfm_dgEl', 'sfm_dgPl', 'sfm_dgSl', 'dgSfCap6'],
        spans: ['sfm_capEl', 'sfm_capSl', 'sfm_kl'],
      });

      sfmStep({ I: iMo, geo: mor.geo, combA: mor.comb.A });
      sfCapFig(
        'dgSfCap6',
        { B: 4.0, L: 9.0, h: 1.2, s1: 0.9, s2: 0.9, sName: 'Mố' },
        { id: 'CD1', V: 4500, My: 1200, Mx: 150 },
        ['Bề rộng B', 'Chiều dài L', 'Mặt cắt I-I / II-II'],
      );

      expect(document.getElementById('sfm_dgEl')!.innerHTML.length).toBeGreaterThan(100);
      expect(document.getElementById('sfm_dgPl')!.innerHTML.length).toBeGreaterThan(100);
      expect(document.getElementById('sfm_dgSl')!.innerHTML.length).toBeGreaterThan(100);
      expect(document.getElementById('dgSfCap6')!.innerHTML.length).toBeGreaterThan(100);
      expect(document.getElementById('sfm_capEl')!.textContent).toContain('Hình 1');
      expect(document.getElementById('sfm_capSl')!.textContent).toContain('Hình 3');
    });

    it('renders pile group plan & depth profiles (#dgPlan, #dgPD*) and drilled shaft group (#dgB1, #dgGrp)', () => {
      registerDefaultVisualHooks();
      seedDefaults({
        tq_mot: 'nang',
        mo_fnd: 'coc',
        mc_src: 'mo',
        mc_xy: '-1.2 -2.4\n-1.2 0\n-1.2 2.4\n1.2 -2.4\n1.2 0\n1.2 2.4',
      });

      const mor = moStep()!;
      expect(mor).toBeTruthy();

      // Headless shaft + pile group
      const sctRes = withHeadlessEnv(() => sctStep()) as SctCalcOutput;
      expect(sctRes).toBeTruthy();
      expect('err' in sctRes).toBe(false);

      const mcr = withHeadlessEnv(() => mcocStep({ MOR: mor }))!;
      expect(mcr).toBeTruthy();
      expect(mcr.piles.length).toBe(6);

      const grpChk = withHeadlessEnv(() => sctCheck({ MCR: mcr, SCTR: sctRes }))!;
      expect(grpChk).toBeTruthy();

      const planSvgHeadless = withHeadlessEnv(() =>
        drawPilePlanSvg(mcr.piles, mcr.dd, mcr.D),
      );
      const pdHeadless = withHeadlessEnv(() =>
        drawPileDepthProfile('dgPDCD2', 'tbPDCD2', mcr.R1!, [0], [0], '2', { mcr, sctr: sctRes }),
      );
      const b1SvgHeadless = withHeadlessEnv(() => drawB1CurveSvg(sctRes));
      const grpSvgHeadless = withHeadlessEnv(() =>
        drawDrilledShaftGroupSvg(
          mcr.piles,
          mcr.D,
          sctRes,
          2.4 + mcr.D,
          4.8 + mcr.D,
          Math.max(2, sctRes.ELcap - sctRes.EL3),
        ),
      );
      expect(planSvgHeadless).toContain('<svg');
      expect(pdHeadless.svg).toContain('<svg');
      expect(b1SvgHeadless).toContain('<svg');
      expect(grpSvgHeadless).toContain('<svg');
      expect(getOutputValue('tbPDCD2')).toContain('<tr>');
      expect(getOutputValue('tbCmp')).toContain('<tr>');
      expect(getOutputValue('s2grp')).toContain('class="m"');

      // jsdom DOM injection
      mountDomFixtures({
        svgs: ['dgPlan', 'dgPDCD2', 'dgPDCD3', 'dgPDDB2', 'dgPDDB3', 'dgPDV', 'dgB1', 'dgGrp'],
        tables: ['tbPDCD2', 'tbPDCD3', 'tbPDDB2', 'tbPDDB3', 'tbPDV', 'tbCmp', 'tbGrp', 'tbDsp'],
        divs: ['s2grp'],
        selects: [
          { id: 'pd_st', options: ['CD', 'DB'], value: 'CD' },
          { id: 'pd_th', options: ['A', '0'], value: '0' },
          { id: 'pd_tc', options: ['A', '0'], value: '0' },
          { id: 'pd_dir', options: ['2', '3'], value: '2' },
        ],
      });

      renderPileGroupHook({ prefix: '', mcResult: mcr });
      renderDrilledShaftHook({ prefix: '', shaftResult: sctRes, groupSvgData: grpChk });

      expect(document.getElementById('dgPlan')!.innerHTML).toContain('<circle');
      expect(document.getElementById('dgPDCD2')!.innerHTML).toContain('<polyline');
      expect(document.getElementById('dgPDCD3')!.innerHTML).toContain('<polyline');
      expect(document.getElementById('dgPDV')!.innerHTML).toContain('<polyline');
      expect(document.getElementById('tbPDCD2')!.innerHTML).toContain('<tr>');
      expect(document.getElementById('dgB1')!.innerHTML).toContain('<polyline');
      expect(document.getElementById('dgGrp')!.innerHTML).toContain('<rect');
      expect(document.getElementById('tbCmp')!.innerHTML).toContain('<tr>');
      expect(document.getElementById('tbGrp')!.innerHTML).toContain('<tr>');
      expect(document.getElementById('tbDsp')!.innerHTML).toContain('<tr>');
      expect(document.getElementById('s2grp')!.innerHTML).toContain('Móng tương đương');
    });
  });

  // =========================================================================
  // 3. Culverts & Retaining Walls Visual Reports
  // =========================================================================
  describe('3. Culverts & Retaining Walls Visual Reports (CH, CHN, CT, TC, TL)', () => {
    it('executes box culvert (CH + CHN) visuals in headless Node & jsdom via runAll("ch")', () => {
      registerDefaultVisualHooks();
      seedDefaults();

      // Headless runAll('ch')
      const runRes = withHeadlessEnv(() => runAll('ch'));
      expect(runRes.errors).toEqual([]);
      expect(getLatestChResult()).not.toBeNull();
      expect(getLatestChnResult()).not.toBeNull();

      const chHeadless = withHeadlessEnv(() => renderBoxCulvertVisuals());
      expect(chHeadless.rendered).toBe(true);
      for (const svg of [
        chHeadless.sec,
        chHeadless.load,
        chHeadless.ll,
        chHeadless.mod,
        chHeadless.mCd,
        chHeadless.vCd,
        chHeadless.nCd,
        chHeadless.mSd,
      ]) {
        expect(svg).toContain('<svg');
      }

      const chnHeadless = withHeadlessEnv(() => renderChnVisuals());
      expect(chnHeadless.rendered).toBe(true);
      expect(chnHeadless.force).toContain('<svg');
      expect(chnHeadless.ecc).toContain('<svg');

      // jsdom DOM injection
      const chIds = ['dgChSec', 'dgChLoad', 'dgChLL', 'dgChMod', 'dgChM', 'dgChV', 'dgChN', 'dgChMs'];
      const chnIds = ['dgChnF', 'dgChnE', 'dgChnS'];
      mountDomFixtures({ svgs: [...chIds, ...chnIds] });

      chStep();
      chnStep();

      for (const id of chIds) {
        expect(document.getElementById(id)!.innerHTML, `Empty #${id}`).toContain('<');
      }
      expect(document.getElementById('dgChnF')!.innerHTML).toContain('<');
      expect(document.getElementById('dgChnE')!.innerHTML).toContain('<');
    });

    it('executes pipe culvert (CT) visuals in headless Node & jsdom via runAll("ct")', () => {
      registerDefaultVisualHooks();
      seedDefaults();

      const runRes = withHeadlessEnv(() => runAll('ct'));
      expect(runRes.errors).toEqual([]);
      expect(getLatestCtResult()).not.toBeNull();

      const ctHeadless = withHeadlessEnv(() => renderPipeCulvertVisuals());
      expect(ctHeadless.rendered).toBe(true);
      for (const svg of [
        ctHeadless.sec,
        ctHeadless.ll,
        ctHeadless.load,
        ctHeadless.mod,
        ctHeadless.m,
        ctHeadless.n,
        ctHeadless.v,
        ctHeadless.reb,
      ]) {
        expect(svg).toContain('<svg');
      }

      const ctIds = ['dgCtSec', 'dgCtLL', 'dgCtLoad', 'dgCtMod', 'dgCtM', 'dgCtN', 'dgCtV', 'dgCtReb'];
      mountDomFixtures({ svgs: ctIds });

      ctStep();

      for (const id of ctIds) {
        expect(document.getElementById(id)!.innerHTML, `Empty #${id}`).toContain('<');
      }
    });

    it('executes gravity wall (TCF) & cantilever wall (TLF) visuals in headless Node & jsdom', () => {
      registerDefaultVisualHooks();
      seedDefaults({
        tc_soil: 'd',
        tc_brm: 'kt',
        tc_qRu: '50',
        tc_phif: '10',
        tc_cf: '2',
        tc_Su: '4',
        tc_H: '5.0',
        tc_ctOn: '1',
        tl_anc: '1',
        tl_soil: 'a',
      });

      const tcRun = withHeadlessEnv(() => runAll('tc'));
      const tlRun = withHeadlessEnv(() => runAll('tl'));
      expect(tcRun.errors).toEqual([]);
      expect(tlRun.errors).toEqual([]);
      expect(getLatestTcResult()).not.toBeNull();
      expect(getLatestTlResult()).not.toBeNull();

      const tcHeadless = withHeadlessEnv(() => renderGravityWallVisuals());
      expect(tcHeadless.rendered).toBe(true);
      expect(tcHeadless.sec, 'tc.sec').toContain('<svg');
      expect(tcHeadless.weight, 'tc.weight').toContain('<svg');
      expect(tcHeadless.coulomb, 'tc.coulomb').toContain('<svg');
      expect(tcHeadless.pressure, 'tc.pressure').toContain('<svg');
      expect(tcHeadless.force, 'tc.force').toContain('<svg');
      expect(tcHeadless.ecc, 'tc.ecc').toContain('<svg');
      expect(tcHeadless.slide, 'tc.slide').toContain('<svg');
      expect(tcHeadless.bearing, 'tc.bearing').toContain('<svg');
      expect(tcHeadless.bamboo, 'tc.bamboo').toContain('<svg');
      expect(tcHeadless.stem, 'tc.stem').toContain('<svg');
      expect(tcHeadless.foot, 'tc.foot').toContain('<svg');

      const tlHeadless = withHeadlessEnv(() => renderCantileverWallVisuals());
      expect(tlHeadless.rendered).toBe(true);
      for (const svg of [
        tlHeadless.sec,
        tlHeadless.weight,
        tlHeadless.pressure,
        tlHeadless.bearing,
        tlHeadless.anchor,
        tlHeadless.rc,
      ]) {
        expect(svg).toContain('<svg');
      }

      const tcIds = [
        'dgTcSec',
        'dgTcW',
        'dgTcCoul',
        'dgTcP',
        'dgTcF',
        'dgTcE',
        'dgTcS',
        'dgTcB',
        'dgTcCt',
        'dgTcStm',
        'dgTcFt',
      ];
      const tlIds = ['dgTlSec', 'dgTlW', 'dgTlP', 'dgTlB', 'dgTlAn', 'dgTlRC'];
      mountDomFixtures({ svgs: [...tcIds, ...tlIds] });

      tcStep();
      tlStep({ force: true });

      for (const id of [...tcIds, ...tlIds]) {
        expect(document.getElementById(id)!.innerHTML, `Empty #${id}`).toContain('<');
      }
    });
  });

  // =========================================================================
  // 4. Hydrology & DEM Visual Reports
  // =========================================================================
  describe('4. Hydrology & Offline DEM Visual Reports (HVD, Bridge Hydro, Culvert Hydro)', () => {
    it('delineates offline COP DEM watershed and builds renderDemPreviewSvg & renderDemWatershedVisuals', async () => {
      // Block network fetch to guarantee 100% offline execution
      globalThis.fetch = (() => {
        throw new Error('Unexpected fetch during offline DEM test');
      }) as unknown as typeof fetch;

      await loadBuiltinDem('cop', (relPath) => readFileSync(resolve(PUBLIC_DIR, relPath), 'utf8'));
      const camThuy = HVSTL.find((s) => s.n === 'Cẩm Thủy')!;
      const ws = await runWatershed({
        src: 'cop',
        ll: false,
        lon0: 105,
        E: camThuy.E,
        N: camThuy.N,
        R: 2.0,
        thr: 0.05,
        snap: 120,
        two: true,
        mm: 'dai',
        ten: 'Suối Cẩm Thủy',
      });
      HVD.S.res = ws;

      const previewSvg = renderDemPreviewSvg(ws, 540, 380);
      expect(previewSvg).toContain('<svg');
      expect(previewSvg).toContain('<polygon');
      expect(previewSvg).toContain('<polyline');

      // Headless DEM visuals (hvLV checks document/#hd_cv, so lvHtml is empty without DOM)
      const demHeadless = withHeadlessEnv(() => renderDemWatershedVisuals(ws));
      expect(demHeadless.previewSvg).toContain('<svg');
      expect(demHeadless.renderedCanvas).toBe(false);
      expect(demHeadless.lvHtml).toBe('');

      // jsdom with mocked 2D canvas context
      const canvas = document.createElement('canvas');
      canvas.id = 'hd_cv';
      const fakeImg = { data: new Uint8ClampedArray(500 * 500 * 4) };
      (canvas as unknown as { getContext: (kind: string) => unknown }).getContext = () => ({
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        lineCap: 'butt',
        lineJoin: 'miter',
        font: '12px sans-serif',
        textAlign: 'left',
        textBaseline: 'alphabetic',
        createImageData: (w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
        putImageData: vi.fn(),
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        arc: vi.fn(),
        closePath: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        fillText: vi.fn(),
        strokeText: vi.fn(),
        setLineDash: vi.fn(),
        measureText: (txt: string) => ({ width: txt.length * 7 }),
        save: vi.fn(),
        restore: vi.fn(),
        getImageData: () => fakeImg,
      });
      (canvas as unknown as { toDataURL: () => string }).toDataURL = () =>
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC';
      document.body.appendChild(canvas);

      const demDom = renderDemWatershedVisuals(ws);
      expect(demDom.previewSvg).toContain('<svg');
      expect(demDom.renderedCanvas).toBe(true);
      expect(demDom.canvasPng).toMatch(/^data:image\/png;base64,/);
      expect(demDom.lvHtml.length).toBeGreaterThan(20);
    });

    it('renders bridge hydrology SVGs (hvFigFq/HQ/MC/Sec) and offline hvStMap with zero CDN URLs', () => {
      registerDefaultVisualHooks();
      seedDefaults({
        hv_F: '18.5',
        hv_L: '7.2',
        hv_sl: '1.2',
        hv_qm: 'tcvn',
        hv_rd: 'p3',
        hv_rm: 'fit',
        hv_st: 'Bái Thượng',
        hv_E: '539500',
        hv_N: '2198500',
        hv_lon0: '105',
      });

      const runRes = withHeadlessEnv(() => runAll('tv'));
      expect(runRes.errors).toEqual([]);
      const hvRes = getLatestHvResult()!;
      expect(hvRes).not.toBeNull();

      const visHeadless = withHeadlessEnv(() => renderBridgeHydroVisuals(hvRes));
      expect(visHeadless.rendered).toBe(true);
      expect(visHeadless.freqSvg).toContain('<svg');
      expect(visHeadless.mcSvg).toContain('<svg');
      expect(visHeadless.hqSvg).toContain('<svg');
      expect(visHeadless.secSvg).toContain('<svg');
      expect(visHeadless.stationMapHtml).toContain('<svg');
      expect(visHeadless.stationMapHtml).not.toContain('https://');
      expect(visHeadless.stationMapHtml).not.toContain('http://tile');

      mountDomFixtures({
        divs: ['hv_stMap'],
        svgs: ['hv_dgFq', 'hv_dgMC', 'hv_dgHQ', 'hv_dgSec'],
      });

      hvStep();

      expect(document.getElementById('hv_stMap')!.innerHTML).toContain('<svg');
      expect(document.getElementById('hv_dgFq')!.innerHTML).toContain('<path');
      expect(document.getElementById('hv_dgMC')!.innerHTML).toContain('<path');
      expect(document.getElementById('hv_dgHQ')!.innerHTML).toContain('<path');
      expect(document.getElementById('hv_dgSec')!.innerHTML).toContain('<path');
    });

    it('renders culvert hydrology SVGs (tvcFig, tvcMap) in headless Node & jsdom via runAll("tvc")', () => {
      registerDefaultVisualHooks();
      const sampleRows = [
        { ten: 'Cống Km1+200', F: 0.45, L: 0.9, J: 18, Lo: 'T', K: '2', n: 1, s: 1.5, i: 0.015 },
      ];
      const sampleGeo: TvxSavedGeo = {
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
            br: [],
            out: [539150, 2199860],
            km: 'Km1+200',
            Flab: 0.45,
          },
        ],
        ends: [{ dau: true, p: [539150, 2199860], km: 'Km1+200' }],
      };
      seedDefaults({
        tab70: '1',
        tvc_P: '2',
        tvc_Hp: '265',
        tvc_rows: JSON.stringify(sampleRows),
        tvc_geo: JSON.stringify(sampleGeo),
      });

      const runRes = withHeadlessEnv(() => runAll('tvc'));
      expect(runRes.errors).toEqual([]);
      const tvcRes = getLatestTvcResult()!;
      expect(tvcRes).not.toBeNull();

      const visHeadless = withHeadlessEnv(() => renderCulvertHydroVisuals(tvcRes, sampleGeo));
      expect(visHeadless.rendered).toBe(true);
      expect(visHeadless.figSvg).toContain('<svg');
      expect(visHeadless.mapSvg).toContain('<svg');
      expect(visHeadless.mapSvg).toContain('Km1+200');
      expect(visHeadless.mapNoteHtml).toContain('Lưu vực khoanh trên bản đồ địa hình');

      mountDomFixtures({
        svgs: ['tvc_dg', 'tvc_map'],
        divs: ['o_tvc_mapNote'],
      });

      tvcStep();

      expect(document.getElementById('tvc_dg')!.innerHTML).toContain('<');
      expect(document.getElementById('tvc_map')!.innerHTML).toContain('<path');
    });
  });

  // =========================================================================
  // 5. Bridge Visual Reports (DAM, RCG, GI, MO, MD, TR, DCT)
  // =========================================================================
  describe('5. Bridge Visual Reports (DAM, RCG, GI, MO, MD, TR, DCT, Summary)', () => {
    it('renders DAM (hollow PC), RCG (RC slab), and GI (post-tensioned I-girder) visuals', () => {
      registerDefaultVisualHooks();
      seedDefaults();

      // 5a. DAM (Pre-tensioned hollow slab)
      damLoadLib('24');
      const damRes = withHeadlessEnv(() => damStep())!;
      expect(damRes).toBeTruthy();
      expect(getLatestDamResult()).toBe(damRes);

      const damHeadless = withHeadlessEnv(() => renderGirderHollowVisuals(damRes));
      expect(damHeadless.rendered).toBe(true);
      expect(damHeadless.type).toBe('PC');
      expect(damHeadless.crossSectionSvg).toContain('<svg');
      expect(damHeadless.branches.g?.sec).toContain('<svg');

      mountDomFixtures({
        svgs: ['dgSpCS', 'dggSec', 'dggElv', 'dggLL', 'dgbSec', 'dgbElv', 'dgbLL'],
      });
      const damDom = renderGirderHollowVisuals(damRes);
      expect(damDom.rendered).toBe(true);
      expect(document.getElementById('dgSpCS')!.innerHTML).toContain('<polygon');
      expect(document.getElementById('dggSec')!.innerHTML).toContain('<');

      // 5b. RCG (RC slab)
      document.body.innerHTML = '';
      rcgLoadLib();
      const rcgRes = withHeadlessEnv(() => rcgStep())!;
      expect(rcgRes).toBeTruthy();
      expect(getLatestRcgResult()).toBe(rcgRes);

      const rcgHeadless = withHeadlessEnv(() => renderGirderHollowVisuals(rcgRes));
      expect(rcgHeadless.rendered).toBe(true);
      expect(rcgHeadless.type).toBe('RC');
      expect(rcgHeadless.crossSectionSvg).toContain('<svg');
      expect(rcgHeadless.branches.g?.sec).toContain('<svg');
      expect(rcgHeadless.branches.g?.elv).toContain('<svg');

      mountDomFixtures({
        svgs: ['dgSpCS', 'dgrSec', 'dgrElv', 'dgrbSec', 'dgrg_LL', 'dgrb_LL'],
      });
      const rcgDom = renderGirderHollowVisuals(rcgRes);
      expect(rcgDom.rendered).toBe(true);
      expect(document.getElementById('dgrSec')!.innerHTML).toContain('<');
      expect(document.getElementById('dgrElv')!.innerHTML).toContain('<');

      // 5c. GI (Post-tensioned I-girder)
      document.body.innerHTML = '';
      giLoadLib();
      const giRes = withHeadlessEnv(() => giStep())!;
      expect(giRes).toBeTruthy();
      expect(getLatestGirResult()).toBe(giRes);

      const giHeadless = withHeadlessEnv(() => renderGirderIVisuals(giRes));
      expect(giHeadless.rendered).toBe(true);
      expect(giHeadless.crossSectionSvg).toContain('<svg');
      expect(giHeadless.secMiddleSvg).toContain('<svg');
      expect(giHeadless.cabMiddleSvg).toContain('<svg');
      expect(giHeadless.secEdgeSvg).toContain('<svg');
      expect(giHeadless.cabEdgeSvg).toContain('<svg');

      mountDomFixtures({
        svgs: ['dgSpCS', 'dgiSec', 'dgiCab', 'dgib_Sec', 'dgib_Cab'],
      });
      const giDom = renderGirderIVisuals(giRes);
      expect(giDom.rendered).toBe(true);
      expect(document.getElementById('dgSpCS')!.innerHTML).toContain('<polygon');
    });

    it('renders heavy abutment (MO) & flexible abutment (MD) visuals + bridge summary', () => {
      registerDefaultVisualHooks();

      // 5d. Heavy gravity abutment (MO)
      seedDefaults({
        tq_mot: 'nang',
        mo_fnd: 'coc',
      });
      const mor = withHeadlessEnv(() => moStep())!;
      const rcm = withHeadlessEnv(() => rcStep())!;
      withHeadlessEnv(() => mcocStep({ MOR: mor }));
      withHeadlessEnv(() => capStep());
      expect(mor).toBeTruthy();
      expect(rcm).toBeTruthy();
      expect(getLatestCapResult()).not.toBeNull();

      const moHeadless = withHeadlessEnv(() => renderAbutmentHeavyVisuals());
      expect(moHeadless.rendered).toBe(true);
      expect(moHeadless.dgMo).toContain('<svg');
      expect(moHeadless.dgMoT).toContain('<svg');
      expect(moHeadless.dgCsm).toContain('<svg');
      expect(moHeadless.dgMoCS).toContain('<svg');
      expect(moHeadless.rcSummarySvg).toContain('<svg');

      mountDomFixtures({
        svgs: ['dgMo', 'dgMoT', 'dgCsm', 'dgMoCS', 'dgMoRcSummary'],
      });
      const moDom = renderAbutmentHeavyVisuals();
      expect(moDom.rendered).toBe(true);
      expect(document.getElementById('dgMo')!.innerHTML).toContain('<');
      expect(document.getElementById('dgMoT')!.innerHTML).toContain('<');
      expect(document.getElementById('dgCsm')!.innerHTML).toContain('<');
      expect(document.getElementById('dgMoCS')!.innerHTML).toContain('<');

      // 5e. Flexible abutment (MD)
      document.body.innerHTML = '';
      seedDefaults({
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

      const mdMor = withHeadlessEnv(() => moStep())!;
      withHeadlessEnv(() => rcStep());
      const iMo = moInputs();
      withHeadlessEnv(() =>
        mcocStep({
          MOR: mdMor,
          onMdFlex: ({ dd, piles, R1, R2, LC, LD }) => {
            mdFlex(dd, piles, R1, R2, LC, LD, { mor: mdMor, inputs: iMo });
            return { ok: true, text: mdFlexTxt() };
          },
        }),
      );
      withHeadlessEnv(() => capStep());
      expect(getLatestMdCapResult()).not.toBeNull();

      const mdHeadless = withHeadlessEnv(() => renderAbutmentFlexVisuals());
      expect(mdHeadless.rendered).toBe(true);
      expect(mdHeadless.longitudinal).toContain('<svg');
      expect(mdHeadless.elevation).toContain('<svg');
      expect(mdHeadless.loads).toContain('<svg');
      expect(mdHeadless.cap).toContain('<svg');
      expect(mdHeadless.thanSvg).toContain('<svg');
      expect(Object.keys(mdHeadless.wingSvgs ?? {}).length).toBeGreaterThan(0);

      mountDomFixtures({
        svgs: ['dgMd', 'dgMdE', 'dgMdL', 'dgMdCap', 'dgMdThan', 'dgCsm', 'dgMoCS'],
      });
      const mdDom = renderAbutmentFlexVisuals();
      expect(mdDom.rendered).toBe(true);
      expect(document.getElementById('dgMd')!.innerHTML).toContain('<');
      expect(document.getElementById('dgMdCap')!.innerHTML).toContain('<');
      expect(document.getElementById('dgMdThan')!.innerHTML).toContain('<');
    });

    it('renders flexible pier (TR), solid pier (DCT), and full runAll("cau") + renderBridgeSummaryVisuals()', () => {
      registerDefaultVisualHooks();
      seedDefaults({
        tq_kn: 'n',
        tq_tru: 'deo',
        tq_mot: 'nang',
      });

      // Run full bridge mode + explicit pier solvers
      const cauRun = withHeadlessEnv(() => runAll('cau'));
      expect(cauRun.errors).toEqual([]);

      const trRes = withHeadlessEnv(() => trStep())!;
      expect(trRes).toBeTruthy();
      expect(getLatestTrResult()).toBe(trRes);
      expect(getLatestTrCheck()).not.toBeNull();

      const trHeadless = withHeadlessEnv(() => renderPierFlexVisuals());
      expect(trHeadless.rendered).toBe(true);
      expect(trHeadless.summarySvg).toContain('<svg');

      // Switch to solid pier with shallow rock footing to exercise sfCapFig integration too
      updateContextStore({
        tq_tru: 'dac',
        dt_fnd: 'nong',
        sfd_geo: 'da',
      });
      const dcRes = withHeadlessEnv(() => dcStep())!;
      expect(dcRes).toBeTruthy();
      expect(getLatestDcResult()).toBe(dcRes);

      const dcHeadless = withHeadlessEnv(() => renderPierSolidVisuals());
      expect(dcHeadless.rendered).toBe(true);
      expect(dcHeadless.summarySvg).toContain('<svg');

      // Bridge summary aggregator across all populated bridge solvers
      const sumHeadless = withHeadlessEnv(() => renderBridgeSummaryVisuals());
      expect(sumHeadless.girderHollow?.rendered).toBe(true);
      expect(sumHeadless.abutmentHeavy?.rendered).toBe(true);
      expect(sumHeadless.pierFlex?.rendered).toBe(true);
      expect(sumHeadless.pierSolid?.rendered).toBe(true);

      // jsdom DOM injection for both piers
      mountDomFixtures({
        svgs: [
          'dgTdSummary',
          'dgTdEl',
          'dgTdIL',
          'dgTdLane',
          'dgTdMod',
          'dgTdSec',
          'dgDcSummary',
          'dgSfCap48',
        ],
      });

      const trDom = renderPierFlexVisuals();
      const dcDom = renderPierSolidVisuals();
      expect(trDom.rendered).toBe(true);
      expect(dcDom.rendered).toBe(true);
      expect(document.getElementById('dgTdSummary')!.innerHTML).toContain('TRỤ CỘT THÂN MẢNH');
      expect(document.getElementById('dgDcSummary')!.innerHTML).toContain('TRỤ ĐẶC');
    });
  });

  // =========================================================================
  // 6. Clean-Room & Zero-CDN Compliance
  // =========================================================================
  describe('6. Clean-Room & Zero-CDN Compliance across src/reports/*.ts', () => {
    it('contains zero https:// CDN URLs and zero licensing/trial/hwid tokens in src/reports/*.ts', () => {
      const forbiddenPattern = /https:\/\/|license|hwid|machineId|trial|\.lic\b/i;
      const anyHttpRegex = /http:\/\/[^\s'"`>]+/gi;

      for (const relPath of REPORT_FILES) {
        const src = readFileSync(resolve(WEB_ROOT, relPath), 'utf8');
        expect(src.match(forbiddenPattern), `Forbidden token/URL in ${relPath}`).toBeNull();

        const httpMatches = src.match(anyHttpRegex) ?? [];
        for (const match of httpMatches) {
          expect(match, `Unexpected http:// URL in ${relPath}`).toBe('http://www.w3.org/2000/svg');
        }
      }
    });
  });
});
