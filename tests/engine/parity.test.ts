import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as TS from '../../src/engine/index.ts';
import type { EngineProject } from '../../src/engine/index.ts';

interface RefEngine {
  DIAS: number[];
  CANTI_DIM: Record<number, number[]>;
  CANTI_REB: Record<number, number[]>;
  CANTI_TIE: Record<number, number[]>;
  CANTI_N5: Record<number, number>;
  HK: Record<number, number>;
  KE_TAB: Array<Record<string, unknown>>;
  D_TAB: Array<Record<string, unknown>>;
  D_ROLES: (p: { anc?: { on?: boolean }; type: string }) => string[];
  D_ROLE_UI: Record<string, [string, string]>;
  C_MARKS: string[];
  CALC_DS: number[];
  CALC_AS: number[];
  CALC_TAU: Record<string, number>;
  CALC_FCT: [number, number][];
  isB: (p: { tpl: string }) => boolean;
  isC: (p: { tpl: string }) => boolean;
  isD: (p: { tpl: string }) => boolean;
  blindT: (p: { blindOn?: boolean; tBlind?: number }) => number;
  beamOn: (p: { type: string; tpl?: string; beam?: { on?: boolean } }) => boolean;
  ancOn: (p: { anc?: { on?: boolean } }) => boolean;
  keyBlocked: (p: { key?: { on?: boolean }; beam?: { on?: boolean }; type: string; tpl?: string }) => boolean;
  keyOn: (p: { key?: { on?: boolean }; beam?: { on?: boolean }; type: string; tpl?: string; anc?: { on?: boolean } }) => boolean;
  rolesOf: (p: EngineProject) => string[];
  baseProject: () => EngineProject;
  presetCanti: (H: number) => EngineProject;
  presetRib: () => EngineProject;
  presetKe: (keep?: Record<string, unknown>, idx?: number) => EngineProject;
  presetWall4: (keep?: Record<string, unknown>, idx?: number) => EngineProject;
  mergeProject: (s: Record<string, unknown>) => EngineProject;
  calcDefaults: () => Record<string, unknown>;
  calcDefaultsD: () => Record<string, unknown>;
  calcEnsure: (p: EngineProject) => Record<string, unknown>;
  calcFamilyFix: (p: EngineProject, wasD: boolean) => void;
  calcFcOf: (name?: string | null) => number;
  calcFyOf: (name?: string | null) => number;
  unitW: (d: number) => number;
  geom: (p: EngineProject) => Record<string, unknown>;
  ancGrid: (p: EngineProject, g?: unknown) => unknown;
  ancWarn: (p: EngineProject, g: unknown) => string[];
  calcFill: (p: EngineProject) => Record<string, unknown>;
  calcGeomP: (p: EngineProject) => Record<string, unknown>;
  areaClipY: (pts: number[][], y0: number, up: boolean) => number;
  tieRowsB: (p: EngineProject, g: unknown) => number[];
  tieXsB: (p: EngineProject, g: unknown) => number[];
  keyLayoutC: (p: EngineProject, g: unknown) => unknown;
  dLayers: (p: EngineProject, g?: unknown) => unknown;
  dRing: (p: EngineProject, g: unknown) => unknown;
  dRibDiag: (p: EngineProject, g: unknown, x0: number, x1: number, yLo: number) => unknown[];
  n5sig: (p: EngineProject) => string;
  cFormula: (p: EngineProject, g: unknown, G: unknown) => unknown;
  cBars: (p: EngineProject, g: unknown) => unknown;
  cDots: (p: EngineProject, g: unknown, G: unknown, n2: number, n5: number) => unknown;
  footTop: (A: [number, number], yt: number, l1: unknown, df: number) => [number, number];
  beamDots: (g: unknown, e1: unknown, c: number) => unknown[];
  ribCuts: (p: EngineProject, g: unknown, ng: number) => number[];
  buildBars: (p: EngineProject) => Record<string, unknown>;
  buildBarsB: (p: EngineProject) => Record<string, unknown>;
  buildBarsC: (p: EngineProject) => Record<string, unknown>;
  buildBarsD: (p: EngineProject) => Record<string, unknown>;
  buildBarsG: (p: EngineProject) => Record<string, unknown>;
  barList: (res: unknown) => unknown[];
  numberMarks: (p: EngineProject, bars: unknown[]) => void;
  quantities: (p: EngineProject, bars?: unknown) => Record<string, unknown>;
  keLabel: (r: unknown) => string;
  keFirst: (idx: number) => number;
  dLabel: (r: unknown) => string;
  dIdxOf: (p: { dIdx?: number }) => number;
  WATER: {
    GW: number;
    seepSolve: (inp: unknown) => Record<string, unknown>;
    build: (I: unknown, g: unknown) => Record<string, unknown>;
    pipingCheck: (I: unknown, g: unknown, W: unknown) => Record<string, unknown>;
    contourLines: (
      px: ArrayLike<number>,
      py: ArrayLike<number>,
      val: (i: number, j: number) => number,
      ok: ((i: number, j: number) => boolean) | null,
      lev: number,
    ) => unknown;
  };
  SLOPE: {
    run: (R: unknown, opt?: unknown) => Record<string, unknown>;
  };
  CALC: {
    RC: {
      run: (S: unknown, M: unknown, rows: unknown[]) => unknown;
      mat: (I: unknown) => unknown;
    };
    wedge: (...args: unknown[]) => Record<string, unknown>;
    coulomb: (t: number, f: number, d: number, b: number) => number;
    bearing: (...args: unknown[]) => Record<string, unknown>;
    bearingSPT: (...args: unknown[]) => Record<string, unknown>;
    bearingRock: (...args: unknown[]) => Record<string, unknown>;
    calc: (I: unknown, g: unknown) => Record<string, unknown>;
  };
  calcProportion: (p: EngineProject) => Record<string, unknown>;
  calcTipLive: (p: EngineProject) => string;
  calcFindBars: (cur: { d: number; a: number; n?: number }, test: (c: { d: number; a: number; As: number }) => boolean) => unknown;
  ribBeam: (sup: number[], L: number) => Record<string, unknown>;
  ribTProps: (bf: number, tf: number, bw: number, h: number) => Record<string, unknown>;
  calcInputs: (p: EngineProject, g: unknown) => Record<string, unknown>;
  calcRun: (p: EngineProject) => Record<string, unknown>;
  calcFeEnsure: (p: EngineProject) => boolean;
  calcGsSeep: (R: unknown, coarse?: boolean) => Record<string, unknown> | null;
  calcGsWater: (R: unknown, coarse?: boolean) => Record<string, unknown> | null;
  calcGsClassic: (R: unknown) => Record<string, unknown> | null;
  calcGsRunNow: (p: EngineProject) => boolean;
  calcGsOut: (p: EngineProject) => Record<string, unknown> | null;
  calcGsRows: (p: EngineProject, R: unknown) => Record<string, unknown>;
  calcSuggest: (p: EngineProject, R: unknown) => unknown[];
  calcApplyFixes: (p: EngineProject, items: unknown[]) => void;
  calcHeelHint: (p: EngineProject) => number | null;
  calcChecks: (R: unknown) => unknown[];
  calcBadgeCount: (R: unknown) => number;
  calcBadgeStatus: (R: unknown, P?: EngineProject) => Record<string, unknown>;
  calcFemPack: (p: EngineProject, full?: boolean) => Record<string, unknown> | null;
  cnf: (x: number | null | undefined, d?: number) => string;
  setCalcDec: (dec: '.' | ',') => void;
  FE3D: Record<string, unknown>;
  CFE: {
    solve: (R: unknown, opt?: unknown) => Record<string, unknown>;
    check: (R: unknown, fe: unknown) => Record<string, unknown>;
    ribProvider: (prof: unknown) => unknown;
  };
  FEM2D: {
    job: (m: unknown) => Record<string, unknown>;
    pack: (R: unknown, opt?: unknown) => Record<string, unknown>;
    domain: (R: unknown, tn?: number) => Record<string, unknown>;
  };
  resetCaches: () => void;
}

function loadRefEngine(): RefEngine {
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
    Int32Array,
    Uint8Array,
    Uint32Array,
    Float64Array,
    Float32Array,
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
  const context = vm.createContext(ctxObj);

  const run = (code: string, filename: string) => {
    vm.runInContext(code, context, { filename });
  };

  run(readMod('01_project_geom.js'), '01_project_geom.js');
  // Exact blindT helper from 02_cad_2d.js#L31
  run(linesSlice('02_cad_2d.js', 31, 31), '02_blindT.js');
  run(readMod('03_template_b_canti.js'), '03_template_b_canti.js');
  // 04_template_c_ke.js defines C_MARKS..buildBarsC in lines 1..681 (CAD views use 682+)
  run(linesSlice('04_template_c_ke.js', 1, 681), '04_template_c_ke.js');
  run(readMod('05_template_d_anchor_rebar.js'), '05_template_d_anchor_rebar.js');
  run(readMod('07_water_seepage.js'), '07_water_seepage.js');
  run(readMod('08_slope_stability.js'), '08_slope_stability.js');
  run(readMod('09_calc_core.js'), '09_calc_core.js');
  run(readMod('10_calc_orchestrator.js'), '10_calc_orchestrator.js');
  run(readMod('11_calc_ribbed.js'), '11_calc_ribbed.js');
  run(readMod('12_fe3d_shell.js'), '12_fe3d_shell.js');
  run(readMod('13_cfe_continuous.js'), '13_cfe_continuous.js');
  run(readMod('14_fem2d_worker.js'), '14_fem2d_worker.js');
  // CALC_DEC + cnf from 16_calc_figures.js#L2-13
  run(linesSlice('16_calc_figures.js', 2, 13), '16_cnf.js');
  // calcFamilyFix + calcChecks from 25_calc_ui_print.js#L4-83
  run(linesSlice('25_calc_ui_print.js', 4, 83), '25_checks.js');
  // keLabel, KE_HS, keFirst from 26_app_ui_export.js#L84-95, getp#L22, mergeProject#L1203-1246
  run(linesSlice('26_app_ui_export.js', 22, 22), '26_getp.js');
  run(linesSlice('26_app_ui_export.js', 84, 95), '26_ke_ui.js');
  run(linesSlice('26_app_ui_export.js', 1203, 1246), '26_mergeProject.js');

  run(
    `
    function calcBadgeCountRef(R) {
      if (!R || R.error || R.unsupported) return 0;
      return calcChecks(R).filter((x) => !x.ok && !x.info).length;
    }
    function calcBadgeStatusRef(R, P) {
      if (!R || R.error || R.unsupported) return { count: 0, pending: false, text: "", cls: "" };
      const bad = calcBadgeCountRef(R),
        pend = P ? calcFeStale(P) : false;
      return {
        count: bad,
        pending: pend,
        text: bad ? "✗ " + bad : pend ? "…" : "✓",
        cls: bad ? "bad" : pend ? "" : "ok",
      };
    }
    function setCalcDecRef(d) { CALC_DEC = d === "," ? "," : "."; }
    function resetCachesRef() {
      _calcCache = { key: "", res: null };
      _feCache = { key: "", fe: null, id: 0 };
      _gsCache = { key: "", res: null, tpl: "" };
      _femCache = { key: "", ekey: "", out: null, err: "", tpl: "", busy: false, t0: 0, ms: 0, nth: 0 };
    }
    globalThis.__REF__ = {
      DIAS,
      CANTI_DIM, CANTI_REB, CANTI_TIE, CANTI_N5, HK, KE_TAB, D_TAB, D_ROLES, D_ROLE_UI, C_MARKS,
      CALC_DS, CALC_AS, CALC_TAU, CALC_FCT,
      isB, isC, isD, blindT, beamOn, ancOn, keyBlocked, keyOn, rolesOf,
      baseProject, presetCanti, presetRib, presetKe, presetWall4, mergeProject,
      calcDefaults, calcDefaultsD, calcEnsure, calcFamilyFix, calcFcOf, calcFyOf, unitW,
      geom, ancGrid, ancWarn, calcFill, calcGeomP, areaClipY, tieRowsB, tieXsB, keyLayoutC, dLayers, dRing, dRibDiag,
      n5sig, cFormula, cBars, cDots, footTop, beamDots, ribCuts, buildBars, buildBarsB, buildBarsC, buildBarsD, buildBarsG, barList, numberMarks, quantities,
      keLabel, keFirst, dLabel, dIdxOf,
      WATER, SLOPE, CALC,
      calcProportion, calcTipLive, calcFindBars, ribBeam, ribTProps,
      calcInputs, calcRun, calcFeEnsure, calcGsSeep, calcGsWater, calcGsClassic, calcGsRunNow, calcGsOut, calcGsRows,
      calcSuggest, calcApplyFixes, calcHeelHint, calcChecks,
      calcBadgeCount: calcBadgeCountRef,
      calcBadgeStatus: calcBadgeStatusRef,
      calcFemPack, cnf, setCalcDec: setCalcDecRef,
      FE3D, CFE, FEM2D,
      resetCaches: resetCachesRef,
    };
    `,
    'export_ref.js',
  );

  return ctxObj.__REF__ as RefEngine;
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
    expect(actual, `${loc}`).toBe(expected);
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
    expect(actLen, `${loc}.length`).toBe(expLen);
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
    const aArr = Array.from(actual as Set<unknown>);
    const eArr = Array.from(expected as Set<unknown>);
    assertParity(aArr, eArr, `${loc}(Set)`, seen, tol);
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

let ref: RefEngine;

beforeAll(() => {
  ref = loadRefEngine();
});

beforeEach(() => {
  TS.resetEngineCaches();
  ref.resetCaches();
  TS.setCalcDec('.');
  ref.setCalcDec('.');
});

describe('0. Constants, Lookup Tables, Defaults & Pure Math Parity', () => {
  it('matches scalar constants, material curves, rebar tables, and defaults (96 keys + D overrides)', () => {
    assertParity(TS.DIAS, ref.DIAS, 'DIAS');
    expect(TS.D_MIN).toBe(Math.min(...ref.DIAS));
    expect(TS.D_MAX).toBe(Math.max(...ref.DIAS));
    expect(TS.CONCRETES.length).toBe(8);
    expect(TS.STEELS).toEqual(['CB300-V', 'CB400-V', 'CB500-V']);
    for (const grade of ['M150', 'M200', 'M225', 'M250', 'M300', 'M350', 'M400', 'M500']) {
      expect(TS.calcFcOf(grade)).toBe(ref.calcFcOf(grade));
    }
    for (const st of ['CB300-V', 'CB400-V', 'CB500-V']) {
      expect(TS.calcFyOf(st)).toBe(ref.calcFyOf(st));
    }
    for (const d of ref.DIAS) {
      expect(TS.unitW(d)).toBeCloseTo(ref.unitW(d), 12);
    }
    assertParity(TS.CANTI_DIM, ref.CANTI_DIM, 'CANTI_DIM');
    assertParity(TS.CANTI_REB, ref.CANTI_REB, 'CANTI_REB');
    assertParity(TS.CANTI_TIE, ref.CANTI_TIE, 'CANTI_TIE');
    assertParity(TS.CANTI_N5, ref.CANTI_N5, 'CANTI_N5');
    assertParity(TS.HK, ref.HK, 'HK');
    assertParity(TS.KE_TAB, ref.KE_TAB, 'KE_TAB');
    assertParity(TS.D_TAB, ref.D_TAB, 'D_TAB');
    assertParity(TS.D_ROLES, ref.D_ROLES, 'D_ROLES');
    assertParity(TS.D_ROLE_UI, ref.D_ROLE_UI, 'D_ROLE_UI');
    assertParity(TS.D_ROLES_UI, ref.D_ROLE_UI, 'D_ROLES_UI');
    assertParity(TS.C_MARKS, ref.C_MARKS, 'C_MARKS');
    assertParity(TS.CALC_DS, ref.CALC_DS, 'CALC_DS');
    assertParity(TS.CALC_AS, ref.CALC_AS, 'CALC_AS');
    assertParity(TS.CALC_TAU, ref.CALC_TAU, 'CALC_TAU');
    assertParity(TS.CALC_FCT, ref.CALC_FCT, 'CALC_FCT');
    assertParity(TS.baseProject(), ref.baseProject(), 'baseProject');
    const defsTs = TS.calcDefaults();
    expect(Object.keys(defsTs).length).toBe(96);
    assertParity(defsTs, ref.calcDefaults(), 'calcDefaults');
    assertParity(TS.calcDefaultsD(), ref.calcDefaultsD(), 'calcDefaultsD');
    assertParity(
      TS.calcFindBars({ d: 14, a: 20 }, (c) => c.As >= 1200),
      ref.calcFindBars({ d: 14, a: 20 }, (c) => c.As >= 1200),
      'calcFindBars',
    );
  });

  it('matches presetCanti across tabulated and interpolated heights (400..1300 cm)', () => {
    for (const H of [400, 500, 540, 750, 900, 1125, 1300]) {
      assertParity(TS.presetCanti(H), ref.presetCanti(H), `presetCanti(${H})`);
    }
  });
});

describe('1. EASY — Core Templates (Mẫu 1 B=500, Passing B=400 & D60b, Mẫu 2 A=820 Ribbed)', () => {
  it('matches Default Mẫu 1 (B, H=500): geometry, bars, quantities, calcRun & checks', () => {
    const pTs = TS.presetCanti(500);
    const pRef = ref.presetCanti(500);

    assertParity(TS.geom(pTs), ref.geom(pRef), 'B500.geom');
    assertParity(TS.calcFill(pTs), ref.calcFill(pRef), 'B500.calcFill');
    assertParity(TS.calcGeomP(pTs), ref.calcGeomP(pRef), 'B500.calcGeomP');
    assertParity(TS.rolesOf(pTs), ref.rolesOf(pRef), 'B500.rolesOf');

    const barsTs = TS.buildBars(pTs);
    const barsRef = ref.buildBars(pRef);
    assertParity(barsTs, barsRef, 'B500.buildBars');
    assertParity(TS.buildBarsB(pTs), ref.buildBarsB(pRef), 'B500.buildBarsB');
    assertParity(TS.barList(barsTs), ref.barList(barsRef), 'B500.barList');

    const qtyTs = TS.quantities(pTs, barsTs);
    const qtyRef = ref.quantities(pRef, barsRef);
    assertParity(qtyTs, qtyRef, 'B500.quantities');
    expect(qtyTs.vol).toBeCloseTo(21.5, 2);
    expect(qtyTs.blind).toBeCloseTo(1.5, 2);
    expect(qtyTs.form.tot).toBeCloseTo(64.64, 2);
    expect(Math.round(qtyTs.totKg)).toBe(2370);

    const gTs = TS.geom(pTs);
    const gRef = ref.geom(pRef) as { yTop: number; topY: (x: number) => number; out: number[][] };
    expect(TS.tieY0(pTs)).toBe(pTs.tBase + 80);
    expect(TS.tieY1(pTs, gTs)).toBe(gTs.yTop - pTs.cover);
    expect(TS.tieY1(pTs, gTs, 20)).toBe(gTs.topY(20) - pTs.cover);
    expect(TS.areaClipY(gTs.out, pTs.tBase, true)).toBeCloseTo(ref.areaClipY(gRef.out, pRef.tBase, true), 10);
    expect(TS.n5sig(pTs)).toBe(ref.n5sig(pRef));
    assertParity(TS.calcProportion(pTs), ref.calcProportion(pRef), 'B500.calcProportion');
    expect(TS.calcTipLive(pTs)).toBe(ref.calcTipLive(pRef));

    const rTs = TS.calcRun(pTs);
    const rRef = ref.calcRun(pRef);
    assertParity(rTs, rRef, 'B500.calcRun');
    assertParity(TS.calcChecks(rTs), ref.calcChecks(rRef), 'B500.calcChecks');
    expect(TS.calcBadgeCount(rTs)).toBe(3);
    assertParity(TS.calcBadgeStatus(rTs, pTs), ref.calcBadgeStatus(rRef, pRef), 'B500.badgeStatus');
  });

  it('evaluates ok.all === true & badgeCount === 0 on Passing Mẫu 1 (B400 wide heel) and D_TAB[3]', () => {
    const bTs = TS.presetCanti(400);
    const bRef = ref.presetCanti(400);
    for (const p of [bTs, bRef]) {
      p.heel = 220;
      p.rb.s1 = { d: 22, a: 10, on: true };
      p.rb.b2 = { d: 22, a: 10, on: true };
    }
    const rBTs = TS.calcRun(bTs);
    const rBRef = ref.calcRun(bRef);
    assertParity(rBTs, rBRef, 'B400_passing.calcRun');
    assertParity(TS.calcChecks(rBTs), ref.calcChecks(rBRef), 'B400_passing.calcChecks');
    expect(TS.isCalcValid(rBTs) && rBTs.ok.all).toBe(true);
    expect(TS.calcBadgeCount(rBTs)).toBe(0);
    assertParity(TS.calcBadgeStatus(rBTs, bTs), { count: 0, pending: false, text: '✓', cls: 'ok' }, 'B400_passing.badge');

    const dTs = TS.presetWall4({}, 3);
    const dRef = ref.presetWall4({}, 3);
    const rDTs = TS.calcRun(dTs);
    const rDRef = ref.calcRun(dRef);
    assertParity(rDTs, rDRef, 'D_TAB[3].calcRun');
    expect(TS.isCalcValid(rDTs) && rDTs.ok.all).toBe(true);
  });

  it('matches Mẫu 2 (A, H=820 ribbed) with cap+beam.on=true AND beam.on=false', () => {
    for (const beamOn of [true, false]) {
      const pTs = TS.presetRib();
      const pRef = ref.presetRib();
      pTs.beam!.on = beamOn;
      pRef.beam!.on = beamOn;
      const gTs = TS.geom(pTs);
      const gRef = ref.geom(pRef);
      assertParity(gTs, gRef, `A_beam_${beamOn}.geom`);
      expect(TS.beamOn(pTs)).toBe(ref.beamOn(pRef));
      expect(TS.keyBlocked(pTs)).toBe(ref.keyBlocked(pRef));

      const bTs = TS.buildBars(pTs);
      const bRef = ref.buildBars(pRef);
      assertParity(bTs, bRef, `A_beam_${beamOn}.buildBars`);
      assertParity(TS.buildBarsG(pTs), ref.buildBarsG(pRef), `A_beam_${beamOn}.buildBarsG`);
      assertParity(TS.quantities(pTs, bTs), ref.quantities(pRef, bRef), `A_beam_${beamOn}.quantities`);

      if (beamOn) {
        const e1Ts = bTs.bars.find((b) => b.key === 'e1');
        const e1Ref = (bRef.bars as Array<{ key: string }>).find((b) => b.key === 'e1');
        assertParity(TS.beamDots(gTs, e1Ts, pTs.cover), ref.beamDots(gRef, e1Ref, pRef.cover), 'A.beamDots');
        const l1Ts = bTs.bars.find((b) => b.key === 'l1');
        assertParity(TS.footTop([10, -20], 30, l1Ts, 16), ref.footTop([10, -20], 30, l1Ts, 16), 'A.footTop');
      }

      const rTs = TS.calcRun(pTs);
      const rRef = ref.calcRun(pRef);
      assertParity(rTs, rRef, `A_beam_${beamOn}.calcRun`);
      assertParity(TS.calcChecks(rTs), ref.calcChecks(rRef), `A_beam_${beamOn}.calcChecks`);
      expect(TS.calcBadgeCount(rTs)).toBe(ref.calcBadgeCount(rRef));
    }
  });
});

describe('2. MEDIUM — Templates C (all 27 KE_TAB + key.on) & D (all 6 D_TAB), slopeFront=false, Grades, Custom Rebar & Suggest/Apply/HeelHint', () => {
  it('matches Mẫu 3 (C): all 27 KE_TAB presets, idx=0/10/26 solvers, key.on=true & edited CAD fallback', () => {
    for (let i = 0; i < ref.KE_TAB.length; i++) {
      const pTs = TS.presetKe({}, i);
      const pRef = ref.presetKe({}, i);
      assertParity(pTs, pRef, `presetKe(${i})`);
      expect(TS.keLabel(TS.KE_TAB[i])).toBe(ref.keLabel(ref.KE_TAB[i]));
      expect(TS.keFirst(i)).toBe(ref.keFirst(i));
      const bTs = TS.buildBars(pTs);
      const bRef = ref.buildBars(pRef);
      assertParity(bTs, bRef, `KE_${i}.buildBars`);
      assertParity(TS.quantities(pTs, bTs), ref.quantities(pRef, bRef), `KE_${i}.qty`);
    }

    for (const idx of [0, 10, 26]) {
      const pTs = TS.presetKe({}, idx);
      const pRef = ref.presetKe({}, idx);
      const rTs = TS.calcRun(pTs);
      const rRef = ref.calcRun(pRef);
      assertParity(rTs, rRef, `KE_${idx}.calcRun`);
      assertParity(TS.calcChecks(rTs), ref.calcChecks(rRef), `KE_${idx}.calcChecks`);
      expect(TS.calcBadgeCount(rTs)).toBe(ref.calcBadgeCount(rRef));
    }

    // Explicitly toggle key.on = true on K1 (idx=0 normally has k=0 -> key.on=false) + test edited fallback
    const kTs = TS.presetKe({}, 0);
    const kRef = ref.presetKe({}, 0);
    for (const p of [kTs, kRef]) {
      p.key.on = true;
      p.key.toeEnd = true;
      p.key.w = 45;
      p.key.d = 120;
    }
    expect(TS.keyOn(kTs)).toBe(true);
    expect(TS.keyOn(kTs)).toBe(ref.keyOn(kRef));
    assertParity(TS.keyLayoutC(kTs, TS.geom(kTs)), ref.keyLayoutC(kRef, ref.geom(kRef)), 'C_keyOn.keyLayoutC');
    assertParity(TS.buildBarsC(kTs), ref.buildBarsC(kRef), 'C_keyOn.buildBarsC');
    assertParity(TS.calcRun(kTs), ref.calcRun(kRef), 'C_keyOn.calcRun');

    const cEdTs = TS.presetKe({}, 5);
    const cEdRef = ref.presetKe({}, 5);
    for (const p of [cEdTs, cEdRef]) {
      p.heel += 40;
      p.rb.c6.a = 15;
      p.anc.on = true;
    }
    const bEdTs = TS.buildBars(cEdTs);
    const bEdRef = ref.buildBars(cEdRef);
    assertParity(bEdTs, bEdRef, 'C_edited.buildBars');
    assertParity(TS.quantities(cEdTs, bEdTs), ref.quantities(cEdRef, bEdRef), 'C_edited.qty');
    const cgTs = TS.geom(cEdTs);
    const cgRef = ref.geom(cEdRef);
    const cGTs = TS.cBars(cEdTs, cgTs);
    const cGRef = ref.cBars(cEdRef, cgRef);
    assertParity(cGTs, cGRef, 'C.cBars');
    assertParity(
      TS.cDots(cEdTs, cgTs, cGTs, TS.KE_TAB[5].c['2'][0], TS.KE_TAB[5].c['5'][0]),
      ref.cDots(cEdRef, cgRef, cGRef, TS.KE_TAB[5].c['2'][0], TS.KE_TAB[5].c['5'][0]),
      'C.cDots',
    );
    assertParity(TS.cFormula(cEdTs, cgTs, cGTs), ref.cFormula(cEdRef, cgRef, cGRef), 'C.cFormula');
  });

  it('matches Mẫu 4 (D) across ALL 6 D_TAB presets (D80, D65, D60, D60b, D45, D30)', () => {
    for (let idx = 0; idx < ref.D_TAB.length; idx++) {
      const dTs = TS.presetWall4({}, idx);
      const dRef = ref.presetWall4({}, idx);
      assertParity(dTs, dRef, `D_${idx}.preset`);
      expect(TS.dLabel(TS.D_TAB[idx])).toBe(ref.dLabel(ref.D_TAB[idx]));
      expect(TS.dIdxOf(dTs)).toBe(ref.dIdxOf(dRef));
      assertParity(TS.D_ROLES(dTs), ref.D_ROLES(dRef), `D_${idx}.D_ROLES`);

      const dgTs = TS.geom(dTs);
      const dgRef = ref.geom(dRef) as { xbb: number; B: number };
      assertParity(dgTs, dgRef, `D_${idx}.geom`);
      assertParity(TS.dLayers(dTs), ref.dLayers(dRef, dgRef), `D_${idx}.dLayers`);
      assertParity(TS.dRing(dTs, dgTs), ref.dRing(dRef, dgRef), `D_${idx}.dRing`);
      if (dTs.type === 'rib') {
        assertParity(
          TS.dRibDiag(dTs, dgTs, dgTs.xbb + dTs.cover, dgTs.B - dTs.cover, 20),
          ref.dRibDiag(dRef, dgRef, dgRef.xbb + dRef.cover, dgRef.B - dRef.cover, 20),
          `D_${idx}.dRibDiag`,
        );
      }

      const bTs = TS.buildBars(dTs);
      const bRef = ref.buildBars(dRef);
      assertParity(bTs, bRef, `D_${idx}.buildBars`);
      assertParity(TS.buildBarsD(dTs), ref.buildBarsD(dRef), `D_${idx}.buildBarsD`);
      assertParity(TS.quantities(dTs, bTs), ref.quantities(dRef, bRef), `D_${idx}.qty`);

      const rTs = TS.calcRun(dTs);
      const rRef = ref.calcRun(dRef);
      assertParity(rTs, rRef, `D_${idx}.calcRun`);
      assertParity(TS.calcSuggest(dTs, rTs), ref.calcSuggest(dRef, rRef), `D_${idx}.calcSuggest`);
      assertParity(TS.calcChecks(rTs), ref.calcChecks(rRef), `D_${idx}.calcChecks`);
      expect(TS.calcBadgeCount(rTs)).toBe(ref.calcBadgeCount(rRef));
    }
  });

  it('matches slopeFront=false, M200/M300/M350 & CB300/CB400/CB500 grades, custom cuts/rebar & warnings', () => {
    // 1. slopeFront = false on B500 and D65
    for (const [label, make] of [
      ['B500_vertFront', () => [TS.presetCanti(500), ref.presetCanti(500)] as const],
      ['D65_vertFront', () => [TS.presetWall4({}, 1), ref.presetWall4({}, 1)] as const],
    ] as const) {
      const [pTs, pRef] = make();
      pTs.slopeFront = false;
      pRef.slopeFront = false;
      assertParity(TS.geom(pTs), ref.geom(pRef), `${label}.geom`);
      const bTs = TS.buildBars(pTs);
      const bRef = ref.buildBars(pRef);
      assertParity(bTs, bRef, `${label}.buildBars`);
      assertParity(TS.quantities(pTs, bTs), ref.quantities(pRef, bRef), `${label}.qty`);
      assertParity(TS.calcRun(pTs), ref.calcRun(pRef), `${label}.calcRun`);
    }

    // 2. Concrete (M200, M300, M350) & Steel (CB300-V, CB400-V, CB500-V) grade combinations
    for (const [concrete, steel] of [
      ['M200', 'CB300-V'],
      ['M300', 'CB400-V'],
      ['M350', 'CB500-V'],
    ] as const) {
      const pTs = TS.presetCanti(500);
      const pRef = ref.presetCanti(500);
      for (const p of [pTs, pRef]) {
        p.concrete = concrete;
        p.steel = steel;
      }
      const rTs = TS.calcRun(pTs);
      const rRef = ref.calcRun(pRef);
      assertParity(rTs, rRef, `grade_${concrete}_${steel}.calcRun`);
      assertParity(TS.calcChecks(rTs), ref.calcChecks(rRef), `grade_${concrete}_${steel}.checks`);
    }

    // 3. Custom multi-group rib cuts + disabled optional bars + cover/spacing/>11.7m/tsb<tst warnings
    const aCutTs = TS.presetRib();
    const aCutRef = ref.presetRib();
    for (const p of [aCutTs, aCutRef]) {
      p.formEnds = false;
      p.blindOn = false;
      p.rb.r1 = { d: 25, n: 2, ng: 3, sp: 12, la: 18, cuts: [220, 110], on: true };
      p.rb.t1 = { d: 12, a: 100, ah: 100, on: false };
      p.rb.r3 = { d: 12, a: 20, on: false };
      p.rb.s1.a = 50; // triggers > 45 cm warning in buildBarsG
      p.cover = 3.5; // triggers cover < 4 cm warning
      p.Lu = 1300; // triggers > 11.7 m warning
      p.tsb = 40; // triggers tsb < tst warning
    }
    expect(TS.blindT(aCutTs)).toBe(0);
    expect(TS.blindT(aCutTs)).toBe(ref.blindT(aCutRef));
    assertParity(
      TS.ribCuts(aCutTs, TS.geom(aCutTs), 3),
      ref.ribCuts(aCutRef, ref.geom(aCutRef), 3),
      'A_custom.ribCuts',
    );
    const bCutTs = TS.buildBars(aCutTs);
    const bCutRef = ref.buildBars(aCutRef);
    assertParity(bCutTs, bCutRef, 'A_custom.buildBars');
    expect(bCutTs.warn.length).toBeGreaterThanOrEqual(4);
    assertParity(TS.quantities(aCutTs, bCutTs), ref.quantities(aCutRef, bCutRef), 'A_custom.qty');

    // Also test B warnings (Lu>11.7m, tight spacing, tsb<tst, tight rock anchor)
    const bwTs = TS.presetCanti(500);
    const bwRef = ref.presetCanti(500);
    for (const p of [bwTs, bwRef]) {
      p.Lu = 1300;
      p.rb.b1 = { d: 28, a: 6 };
      p.tsb = 20;
      p.anc.on = true;
      p.anc.L = 40;
    }
    const bwbTs = TS.buildBars(bwTs);
    const bwbRef = ref.buildBars(bwRef);
    assertParity(bwbTs, bwbRef, 'B_warnings.buildBars');
    assertParity(TS.ancWarn(bwTs, bwbTs.g), ref.ancWarn(bwRef, bwbRef.g), 'B_warnings.ancWarn');
    expect(bwbTs.warn.length).toBeGreaterThanOrEqual(3);
  });

  it('matches calcSuggest, calcHeelHint, calcApplyFixes & post-fix re-run on weak Cantilever & Ribbed walls', () => {
    // 1. Weak cantilever (B, H=700)
    const wTs = TS.presetCanti(700);
    const wRef = ref.presetCanti(700);
    for (const p of [wTs, wRef]) {
      p.heel = 140;
      p.rb.s1 = { d: 12, a: 25 };
      p.rb.b1 = { d: 12, a: 25 };
      p.rb.b2 = { d: 12, a: 25 };
      p.rb.h1 = { d: 10, a: 25 };
      p.rb.l1 = { d: 10, a: 25 };
    }
    const rWeakTs = TS.calcRun(wTs);
    const rWeakRef = ref.calcRun(wRef);
    const sugTs = TS.calcSuggest(wTs, rWeakTs);
    const sugRef = ref.calcSuggest(wRef, rWeakRef);
    assertParity(sugTs, sugRef, 'weak_B.calcSuggest');
    expect(sugTs.some((s) => !s.ok && s.sug !== null)).toBe(true);
    expect(TS.calcHeelHint(wTs)).toBe(ref.calcHeelHint(wRef));

    TS.calcApplyFixes(wTs, sugTs);
    ref.calcApplyFixes(wRef, sugRef);
    assertParity(wTs, wRef, 'weak_B.afterApplyFixes');
    assertParity(TS.calcRun(wTs), ref.calcRun(wRef), 'weak_B.recalcAfterFixes');

    // 2. Weak ribbed walls (Template A and Template D D80)
    for (const [label, make] of [
      ['weak_A_rib', () => [TS.presetRib(), ref.presetRib()] as const],
      ['weak_D_D80_rib', () => [TS.presetWall4({}, 0), ref.presetWall4({}, 0)] as const],
    ] as const) {
      const [pTs, pRef] = make();
      for (const p of [pTs, pRef]) {
        p.heel = Math.max(120, p.heel - 280);
        p.rb.h1 = { d: 12, a: 25, on: true };
        p.rb.s1 = { d: 12, a: 25, on: true };
        p.rb.s2 = { d: 12, a: 25, on: true };
        p.rb.b1 = { d: 12, a: 25, on: true };
        p.rb.b2 = { d: 12, a: 25, on: true };
        p.rb.l1 = { d: 12, a: 25, on: true };
        p.rb.r1 = { ...p.rb.r1, d: 12, a: 25, n: 1, on: true };
        p.rb.r2 = { d: 12, a: 25, on: true };
        if (p.rb.r3) p.rb.r3 = { d: 12, a: 25, on: true };
      }
      const r0Ts = TS.calcRun(pTs);
      const r0Ref = ref.calcRun(pRef);
      const s0Ts = TS.calcSuggest(pTs, r0Ts);
      const s0Ref = ref.calcSuggest(pRef, r0Ref);
      assertParity(s0Ts, s0Ref, `${label}.calcSuggest`);
      expect(TS.calcHeelHint(pTs)).toBe(ref.calcHeelHint(pRef));

      TS.calcApplyFixes(pTs, s0Ts);
      ref.calcApplyFixes(pRef, s0Ref);
      assertParity(pTs, pRef, `${label}.afterApplyFixes`);
      assertParity(TS.calcRun(pTs), ref.calcRun(pRef), `${label}.recalcAfterFixes`);
    }
  });
});

describe('3. HARD — Water (HS + Anisotropic FDM Seepage & Piping), Seismic (half/full/tay + kv + slope), Bishop, FE3D/CFE & FEM2D + SRM', () => {
  it('matches hydrostatic water (wMode="hs", avg piping) and anisotropic 2D FDM seepage (wMode="fd", prism piping + contours)', () => {
    for (const [mode, kbx, kby, kfx, kfy, FSp] of [
      ['hs', 1e-5, 1e-5, 1e-7, 1e-7, 1.5],
      ['fd', 2e-4, 5e-5, 8e-6, 2e-6, 1.5],
      ['fd', 5e-4, 5e-5, 2e-4, 4e-5, 6.0], // failing piping FS check
    ] as const) {
      const pTs = TS.presetCanti(550);
      const pRef = ref.presetCanti(550);
      for (const p of [pTs, pRef]) {
        p.key.on = true;
        p.key.d = 80;
        const c = p === pTs ? TS.calcEnsure(p) : ref.calcEnsure(p);
        c.wOn = true;
        c.wMode = mode;
        c.hB = 3.6;
        c.hF = 0.7;
        c.gsat = 20.5;
        c.gfs = 20.0;
        c.Tn = 6;
        c.kbx = kbx;
        c.kby = kby;
        c.kfx = kfx;
        c.kfy = kfy;
        c.FSp = FSp;
      }
      const rTs = TS.calcRun(pTs);
      const rRef = ref.calcRun(pRef);
      assertParity(rTs, rRef, `water_${mode}_${FSp}.calcRun`);
      assertParity(TS.calcChecks(rTs), ref.calcChecks(rRef), `water_${mode}_${FSp}.checks`);
      if (TS.isCalcValid(rTs) && rTs.W) {
        const wTs = rTs.W;
        const wRef = rRef.W as {
          head: (x: number, y: number, s?: string) => number;
          u: (x: number, y: number, s?: string) => number;
          ub: (x: number) => number;
          seep?: {
            xc: Float64Array;
            yc: Float64Array;
            ny: number;
            H: Float64Array;
            fl: Uint8Array;
            headAt: (x: number, y: number) => number;
            level: (x: number) => number;
            uAt: (x: number, y: number) => number;
          };
        };
        expect(wTs.head(1.2, 0.4)).toBeCloseTo(wRef.head(1.2, 0.4), 10);
        expect(wTs.u(1.2, 0.4, 'U')).toBeCloseTo(wRef.u(1.2, 0.4, 'U'), 10);
        expect(wTs.ub(0.8)).toBeCloseTo(wRef.ub(0.8), 10);
        if (wTs.seep && wRef.seep) {
          expect(wTs.pip.kind).toBe('prism');
          expect(wTs.seep.level(-1)).toBeCloseTo(wRef.seep.level(-1), 10);
          expect(wTs.seep.level(rTs.g.B + 1)).toBeCloseTo(wRef.seep.level(rTs.g.B + 1), 10);
          expect(wTs.seep.uAt(0.5, -0.5)).toBeCloseTo(wRef.seep.uAt(0.5, -0.5), 10);
          const sT = wTs.seep as TS.InternalWaterSeep;
          const sR = wRef.seep;
          assertParity(
            TS.WATER.contourLines(
              sT.xc,
              sT.yc,
              (i, j) => sT.H[i * sT.ny + j],
              (i, j) => !sT.fl[i * sT.ny + j],
              2.0,
            ),
            ref.WATER.contourLines(
              sR.xc,
              sR.yc,
              (i, j) => sR.H[i * sR.ny + j],
              (i, j) => !sR.fl[i * sR.ny + j],
              2.0,
            ),
            `water_${mode}.contours`,
          );
        } else {
          expect(wTs.pip.kind).toBe('avg');
        }
      }
    }
  });

  it('matches seismic modes (half, full, tay) with vertical eqKv, sloped backfill beta>0, dvA=false & live loads', () => {
    expect(TS.CALC.coulomb(85, 32, 18, 12)).toBeCloseTo(ref.CALC.coulomb(85, 32, 18, 12), 12);

    for (const [eqKm, eqKh, eqKv, fillMode] of [
      ['half', 0.05, 0.0, '1'],
      ['full', 0.14, 0.05, '1.5'],
      ['tay', 0.11, 0.04, '1.5'],
    ] as const) {
      const pTs = TS.presetCanti(600);
      const pRef = ref.presetCanti(600);
      for (const p of [pTs, pRef]) {
        p.fillMode = fillMode;
        p.fillH = 180;
        const c = p === pTs ? TS.calcEnsure(p) : ref.calcEnsure(p);
        c.gs = 18.5;
        c.phi = 32;
        c.dw = 22;
        c.dvA = false;
        c.dv = 16;
        c.cs = 6;
        c.q = 15;
        c.LL = true;
        c.qL = 12;
        c.dT = 0.4;
        c.eqOn = true;
        c.eqA = 0.14;
        c.eqKm = eqKm;
        c.eqKh = eqKh;
        c.eqKv = eqKv;
        c.eqG = 0.25;
      }
      const rTs = TS.calcRun(pTs);
      const rRef = ref.calcRun(pRef);
      assertParity(rTs, rRef, `seismic_${eqKm}.calcRun`);
      assertParity(TS.calcChecks(rTs), ref.calcChecks(rRef), `seismic_${eqKm}.checks`);
      expect(TS.calcBadgeCount(rTs)).toBe(ref.calcBadgeCount(rRef));
    }
  });

  it('matches Bishop global slope stability (SLOPE.run, bsOn=true, multi-zone soil & FDM water) + calcGsRunNow/Rows', () => {
    for (const [label, soilMode] of [
      ['sand_multiZone_fdmWater', 'r'],
      ['clay_Su_fdmWater', 'd'],
    ] as const) {
      TS.resetEngineCaches();
      ref.resetCaches();
      const pTs = TS.presetCanti(550);
      const pRef = ref.presetCanti(550);
      for (const p of [pTs, pRef]) {
        p.fillMode = '1.5';
        p.fillH = 120;
        const c = p === pTs ? TS.calcEnsure(p) : ref.calcEnsure(p);
        c.soil = soilMode;
        c.gs = 19;
        c.phi = 28;
        c.cs = 10; // backfill cohesion != foundation cohesion
        c.gf = 18.5;
        c.phif = soilMode === 'd' ? 0 : 34;
        c.cf = soilMode === 'd' ? 0 : 4;
        c.Su = soilMode === 'd' ? 75 : 0;
        c.wOn = true;
        c.wMode = 'fd';
        c.hB = 3.0;
        c.hF = 0.5;
        c.bsOn = true;
        c.bsT = 8;
        c.bsPhiR = 0.7;
        c.eqOn = true;
        c.eqKm = 'full';
        c.eqA = 0.12;
        c.femMesh = 'c';
      }
      const rTs = TS.calcRun(pTs);
      const rRef = ref.calcRun(pRef);
      assertParity(rTs, rRef, `${label}.calcRun_with_bishop`);
      assertParity(TS.calcChecks(rTs), ref.calcChecks(rRef), `${label}.checks`);

      expect(TS.calcGsNeed(pTs)).toBe(true);
      expect(TS.calcGsRunNow(pTs)).toBe(ref.calcGsRunNow(pRef));
      expect(TS.calcGsStale(pTs)).toBe(false);
      assertParity(TS.calcGsOut(pTs), ref.calcGsOut(pRef), `${label}.calcGsOut`);
      assertParity(TS.calcGsClassic(rTs as TS.CalcValidResult), ref.calcGsClassic(rRef), `${label}.calcGsClassic`);
      assertParity(TS.calcGsRows(pTs, rTs), ref.calcGsRows(pRef, rRef), `${label}.calcGsRows`);
    }
  });

  it('matches 3D Shell CFE solver in both feBasis="fe" and "hand" modes across Templates B, A, C & D', () => {
    for (const [name, tsP, refP, feBasis] of [
      ['B_strip_fe', TS.presetCanti(500), ref.presetCanti(500), 'fe'],
      ['B_strip_hand', TS.presetCanti(500), ref.presetCanti(500), 'hand'],
      ['A_rib_fe', TS.presetRib(), ref.presetRib(), 'fe'],
      ['A_rib_hand', TS.presetRib(), ref.presetRib(), 'hand'],
      ['C_rib_fe', TS.presetKe({}, 0), ref.presetKe({}, 0), 'fe'],
      ['D_rib_fe', TS.presetWall4({}, 0), ref.presetWall4({}, 0), 'fe'],
      ['D_rib_hand', TS.presetWall4({}, 0), ref.presetWall4({}, 0), 'hand'],
    ] as const) {
      TS.resetEngineCaches();
      ref.resetCaches();
      for (const p of [tsP, refP]) {
        const c = p === tsP ? TS.calcEnsure(p) : ref.calcEnsure(p);
        c.feOn = true;
        c.feBasis = feBasis;
        c.feN = 0.9;
      }
      expect(TS.calcFeStale(tsP)).toBe(true);
      expect(TS.calcFeEnsure(tsP)).toBe(ref.calcFeEnsure(refP));
      expect(TS.calcFeCurrent(tsP)).toBe(true);

      const tsR = TS.calcRun(tsP);
      const refR = ref.calcRun(refP);
      assertParity(tsR, refR, `${name}.calcRun`);
      assertParity(TS.calcChecks(tsR), ref.calcChecks(refR), `${name}.checks`);
      assertParity(TS.calcBadgeStatus(tsR, tsP), ref.calcBadgeStatus(refR, refP), `${name}.badgeStatus`);
    }
  });

  it('matches FEM2D coarse mesh (femMesh="c", femPsi>0, femLifts>1, wOn=true SRM) + runFemSync & calcGsRows', () => {
    const tsP = TS.presetCanti(500);
    const refP = ref.presetCanti(500);
    for (const p of [tsP, refP]) {
      const c = p === tsP ? TS.calcEnsure(p) : ref.calcEnsure(p);
      c.femMesh = 'c';
      c.femPsi = 6;
      c.femLifts = 3;
      c.femSrm = true;
      c.femEb = 35;
      c.femEf = 60;
      c.wOn = true;
      c.wMode = 'fd';
      c.hB = 2.5;
      c.hF = 0.5;
    }

    const packTs = TS.packFemInput(tsP, true)!;
    const packRef = ref.calcFemPack(refP, true)!;
    assertParity(packTs, packRef, 'FEM2D_coarse.pack');

    const outTs = TS.FEM2D.job(packTs);
    const outRef = ref.FEM2D.job(packRef);
    assertParity(outTs, outRef, 'FEM2D_coarse.job', new WeakMap(), 1e-8);
    expect(outTs.ok).toBe(true);
    expect(outTs.FSsrm).not.toBeNull();
    expect(outTs.FSsrm!).toBeGreaterThan(1.0);

    const outSync = TS.runFemSync(tsP, { full: true, raw: true });
    assertParity(outSync, outRef, 'FEM2D_coarse.runFemSync', new WeakMap(), 1e-8);
  }, 30000);

  it('matches FEM2D normal dense mesh (femMesh="n", ~3000 elements, femPsi>0, femLifts=4, SRM)', () => {
    const tsP = TS.presetCanti(450);
    const refP = ref.presetCanti(450);
    for (const p of [tsP, refP]) {
      const c = p === tsP ? TS.calcEnsure(p) : ref.calcEnsure(p);
      c.femMesh = 'n';
      c.femPsi = 5;
      c.femLifts = 4;
      c.femSrm = true;
    }

    const packTs = TS.packFemInput(tsP, true)!;
    const packRef = ref.calcFemPack(refP, true)!;
    assertParity(packTs, packRef, 'FEM2D_normal.pack');

    const outTs = TS.FEM2D.job(packTs);
    const outRef = ref.FEM2D.job(packRef);
    assertParity(outTs, outRef, 'FEM2D_normal.job', new WeakMap(), 1e-7);
    expect(outTs.ok).toBe(true);
    expect(outTs.info.ne).toBeGreaterThan(2000);
    expect(outTs.FSsrm).not.toBeNull();
  }, 60000);

  it('handles FEM2D worker requests AND calcFemRun async fallback cleanly', async () => {
    const messages: unknown[] = [];
    const g = globalThis as unknown as {
      onmessage: ((ev: MessageEvent<unknown>) => void) | null;
      postMessage?: (msg: unknown) => void;
    };
    const origPost = g.postMessage;
    const origOnMsg = g.onmessage;
    g.postMessage = (msg: unknown) => {
      messages.push(msg);
    };
    try {
      await import('../../src/engine/fem2d.worker.ts');
      const p = TS.presetCanti(450);
      const c = TS.calcEnsure(p);
      c.femMesh = 'c';
      c.femLifts = 2;
      c.femSrm = false;
      const m = TS.packFemInput(p, false)!;
      expect(typeof g.onmessage).toBe('function');
      g.onmessage!({ data: { id: 42, m } } as MessageEvent<unknown>);
      expect(messages.length).toBe(1);
      const reply = messages[0] as { id: number; out?: Record<string, unknown>; err?: string };
      expect(reply.id).toBe(42);
      expect(reply.err).toBeUndefined();
      expect(reply.out?.ok).toBe(true);
    } finally {
      g.postMessage = origPost;
      g.onmessage = origOnMsg;
    }

    // Exercise calcFemRun fallback timer path cleanly
    TS.resetEngineCaches();
    const p2 = TS.presetCanti(450);
    TS.calcEnsure(p2).femMesh = 'c';
    TS.calcEnsure(p2).femLifts = 2;
    TS.calcEnsure(p2).femSrm = false;
    await new Promise<void>((resolve, reject) => {
      const started = TS.calcFemRun(p2, () => {
        try {
          const out = TS.calcFemOut(p2);
          expect(out?.ok).toBe(true);
          expect(TS.calcFemCurrent(p2)).toBe(true);
          expect(TS.calcFemFailed(p2)).toBe(false);
          expect(TS.calcFemNeed(p2)).toBe(false);
          resolve();
        } catch (err) {
          reject(err);
        }
      });
      if (!started) reject(new Error('calcFemRun failed to start'));
    });
  }, 20000);
});

describe('4. SPECIAL / EXTREME / EDGE — H=1300 (canti vs rib), Soft Clay & Sand, Zero-Phi Backfill, All Rock/Anchor Modes, Multi-Hazard Stress Test & Legacy Migrations', () => {
  it('matches extreme height H=1300 cm as Cantilever AND mutated to Ribbed (with multi-group ribs)', () => {
    const cTs = TS.presetCanti(1300);
    const cRef = ref.presetCanti(1300);
    const cbTs = TS.buildBars(cTs);
    const cbRef = ref.buildBars(cRef);
    assertParity(cbTs, cbRef, 'H1300_canti.buildBars');
    assertParity(TS.quantities(cTs, cbTs), ref.quantities(cRef, cbRef), 'H1300_canti.qty');
    assertParity(TS.calcRun(cTs), ref.calcRun(cRef), 'H1300_canti.calcRun');

    const rTs = TS.presetCanti(1300);
    const rRef = ref.presetCanti(1300);
    for (const p of [rTs, rRef]) {
      p.type = 'rib';
      p.Lu = 1000;
      p.rib = { t: 45, gap: 250, edge: 95, drop: 0 };
      p.rb.r1 = { d: 28, n: 2, ng: 4, on: true };
    }
    const rbTs = TS.buildBars(rTs);
    const rbRef = ref.buildBars(rRef);
    assertParity(rbTs, rbRef, 'H1300_rib.buildBars');
    assertParity(TS.quantities(rTs, rbTs), ref.quantities(rRef, rbRef), 'H1300_rib.qty');
    const resRibTs = TS.calcRun(rTs);
    const resRibRef = ref.calcRun(rRef);
    assertParity(resRibTs, resRibRef, 'H1300_rib.calcRun');
    assertParity(TS.calcSuggest(rTs, resRibTs), ref.calcSuggest(rRef, resRibRef), 'H1300_rib.calcSuggest');
  });

  it('matches Soft Clay (soil="d", Su, saturated) vs Cohesionless Sand (soil="r", brm="lt"/"spt"/"kt") + Zero-Phi FEM2D edge check', () => {
    // 1. Soft clay across bearing options + saturation
    for (const brm of ['lt', 'spt', 'kt'] as const) {
      const pTs = TS.presetCanti(500);
      const pRef = ref.presetCanti(500);
      for (const p of [pTs, pRef]) {
        const c = p === pTs ? TS.calcEnsure(p) : ref.calcEnsure(p);
        c.soil = 'd';
        c.gf = 17.5;
        c.gfs = 18.2;
        c.phif = 0;
        c.cf = 35;
        c.Su = 45;
        c.brm = brm;
        c.Nspt = 7;
        c.Ri = 0.85;
        c.qRu = 220;
        c.wOn = true;
        c.wMode = 'hs';
        c.hB = 4.0;
        c.hF = 1.0;
        c.gsat = 20.5;
      }
      assertParity(TS.calcRun(pTs), ref.calcRun(pRef), `softClay_${brm}.calcRun`);
    }

    // 2. Cohesionless sand (SPT vs Vesic vs kT)
    for (const brm of ['lt', 'spt', 'kt'] as const) {
      const pTs = TS.presetCanti(500);
      const pRef = ref.presetCanti(500);
      for (const p of [pTs, pRef]) {
        const c = p === pTs ? TS.calcEnsure(p) : ref.calcEnsure(p);
        c.soil = 'r';
        c.gf = 19.5;
        c.phif = 34;
        c.cf = 0;
        c.brm = brm;
        c.Nspt = 28;
        c.qRu = 450;
        c.Dw = 0.2;
      }
      assertParity(TS.calcRun(pTs), ref.calcRun(pRef), `sand_${brm}.calcRun`);
    }

    // 3. Zero-friction cohesive backfill regression in FEM2D (`phi = 0, cs = 25` must NOT become 30 deg!)
    const zTs = TS.presetCanti(450);
    const zRef = ref.presetCanti(450);
    for (const p of [zTs, zRef]) {
      const c = p === zTs ? TS.calcEnsure(p) : ref.calcEnsure(p);
      c.phi = 0;
      c.cs = 25;
      c.femMesh = 'c';
      c.femLifts = 2;
      c.femSrm = false;
    }
    const zPackTs = TS.packFemInput(zTs, false)!;
    const zPackRef = ref.calcFemPack(zRef, false)!;
    assertParity(zPackTs, zPackRef, 'zeroPhi_FEM2D.pack');
    const zOutTs = TS.FEM2D.job(zPackTs);
    const zOutRef = ref.FEM2D.job(zPackRef);
    assertParity(zOutTs, zOutRef, 'zeroPhi_FEM2D.job', new WeakMap(), 1e-8);
    expect((zOutTs.mats as Array<{ phi: number }>)[1].phi).toBe(0);
  }, 30000);

  it('matches Rock foundation (soil="a") across ALL bearing modes (ck/cp/kt) & Rock anchors (fr vs dw, aOT=true/false, tauA="tay", custom aX, forced hs water)', () => {
    const cases: Array<[string, (p: EngineProject, isTs: boolean) => void]> = [
      [
        'rock_ck_fr_tay_aOT_true',
        (p, isTs) => {
          p.anc.on = true;
          p.anc.L = 140;
          const c = isTs ? TS.calcEnsure(p) : ref.calcEnsure(p);
          c.soil = 'a';
          c.brmR = 'ck';
          c.rockT = 'D';
          c.qu = 35;
          c.RMR = 62;
          c.phibR = 0.5;
          c.aSl = 'fr';
          c.aSlSet = true;
          c.tauA = 'tay';
          c.atau = 1.1;
          c.amu = 0.7;
          c.aOT = true;
          c.wOn = true;
          c.wMode = 'fd'; // Rock must automatically fall back to hydrostatic 'hs' with warning
          c.hB = 3.0;
          c.hF = 0.3;
        },
      ],
      [
        'rock_cp_dw_aOT_false',
        (p, isTs) => {
          p.anc.on = true;
          const c = isTs ? TS.calcEnsure(p) : ref.calcEnsure(p);
          c.soil = 'a';
          c.brmR = 'cp';
          c.cR = 90;
          c.phiR = 34;
          c.gR = 24;
          c.aSl = 'dw';
          c.aSlSet = true;
          c.aOT = false; // should bypass base friction & auto-pass ok.an
          c.aTv = 0.75;
        },
      ],
      [
        'rock_kt_dw_aOT_true',
        (p, isTs) => {
          p.anc.on = true;
          const c = isTs ? TS.calcEnsure(p) : ref.calcEnsure(p);
          c.soil = 'a';
          c.brmR = 'kt';
          c.qRu = 1800;
          c.aSl = 'dw';
          c.aSlSet = true;
          c.aOT = true;
          c.aX = '0.4; 2.2';
        },
      ],
      [
        'rock_no_anchor_ck',
        (p, isTs) => {
          p.anc.on = false;
          const c = isTs ? TS.calcEnsure(p) : ref.calcEnsure(p);
          c.soil = 'a';
          c.brmR = 'ck';
          c.phif = 38;
        },
      ],
    ];

    for (const [name, setup] of cases) {
      const pTs = TS.presetCanti(500);
      const pRef = ref.presetCanti(500);
      setup(pTs, true);
      setup(pRef, false);
      const rTs = TS.calcRun(pTs);
      const rRef = ref.calcRun(pRef);
      assertParity(rTs, rRef, `${name}.calcRun`);
      assertParity(TS.calcChecks(rTs), ref.calcChecks(rRef), `${name}.checks`);
      expect(TS.calcBadgeCount(rTs)).toBe(ref.calcBadgeCount(rRef));
      if (name === 'rock_ck_fr_tay_aOT_true' && TS.isCalcValid(rTs)) {
        expect(rTs.W?.mode).toBe('hs');
        expect(rTs.W?.pip.kind).toBe('rock');
      }
    }
  });

  it('passes Combined Multi-Hazard Stress Test (Ribbed + FDM Seepage + Full Seismic w/ kv + Live Load + Rock/Slope + FE3D + FEM2D SRM)', () => {
    // Variant A: Soil foundation ribbed wall with full anisotropic 2D FDM seepage + Bishop + FE3D + FEM2D SRM + Full Seismic
    {
      const pTs = TS.presetRib();
      const pRef = ref.presetRib();
      for (const p of [pTs, pRef]) {
        p.key.on = true;
        p.key.d = 60;
        p.beam!.on = false; // allows key.on = true in Template A
        p.fillMode = '1.5';
        p.fillH = 150;
        const c = p === pTs ? TS.calcEnsure(p) : ref.calcEnsure(p);
        c.soil = 'r';
        c.brm = 'lt';
        c.gf = 19.5;
        c.phif = 33;
        c.cf = 5;
        c.q = 15;
        c.LL = true;
        c.qL = 12;
        c.dT = 0.5;
        c.wOn = true;
        c.wMode = 'fd';
        c.hB = 3.8;
        c.hF = 0.6;
        c.kbx = 3e-4;
        c.kby = 8e-5;
        c.kfx = 1e-5;
        c.kfy = 2e-6;
        c.Tn = 6;
        c.eqOn = true;
        c.eqA = 0.16;
        c.eqKm = 'full';
        c.eqKv = 0.06;
        c.bsOn = true;
        c.bsT = 6;
        c.feOn = true;
        c.feBasis = 'fe';
        c.feN = 1.0;
        c.femMesh = 'c';
        c.femPsi = 4;
        c.femLifts = 3;
        c.femSrm = true;
      }

      expect(TS.calcFeEnsure(pTs)).toBe(ref.calcFeEnsure(pRef));
      const rTs = TS.calcRun(pTs);
      const rRef = ref.calcRun(pRef);
      assertParity(rTs, rRef, 'multiHazard_A_soilFdm.calcRun');
      assertParity(TS.calcChecks(rTs), ref.calcChecks(rRef), 'multiHazard_A_soilFdm.checks');
      expect(TS.calcGsRunNow(pTs)).toBe(ref.calcGsRunNow(pRef));
      assertParity(TS.calcGsOut(pTs), ref.calcGsOut(pRef), 'multiHazard_A_soilFdm.calcGsOut');

      const femTs = TS.runFemSync(pTs, { full: true, raw: true });
      const femRef = ref.FEM2D.job(ref.calcFemPack(pRef, true)!);
      assertParity(femTs, femRef, 'multiHazard_A_soilFdm.FEM2D', new WeakMap(), 1e-8);
      assertParity(TS.calcGsRows(pTs, rTs), ref.calcGsRows(pRef, rRef), 'multiHazard_A_soilFdm.calcGsRows');
    }

    // Variant B: Template D ribbed rock-anchored wall under Full Seismic + Live Load + Sloped Backfill + Water + Bishop + FE3D + FEM2D SRM
    {
      TS.resetEngineCaches();
      ref.resetCaches();
      const dTs = TS.presetWall4({}, 0); // D80 ribbed
      const dRef = ref.presetWall4({}, 0);
      for (const p of [dTs, dRef]) {
        p.fillMode = '1.5';
        p.fillH = 120;
        const c = p === dTs ? TS.calcEnsure(p) : ref.calcEnsure(p);
        c.soil = 'a';
        c.brmR = 'cp';
        c.cR = 120;
        c.phiR = 35;
        c.gR = 25;
        c.aSl = 'fr';
        c.aSlSet = true;
        c.aOT = true;
        c.q = 10;
        c.LL = true;
        c.qL = 15;
        c.dT = 0.5;
        c.wOn = true;
        c.wMode = 'fd'; // verifies rock anchor + water falls back cleanly to hs
        c.hB = 3.0;
        c.hF = 0.4;
        c.eqOn = true;
        c.eqA = 0.15;
        c.eqKm = 'full';
        c.eqKv = 0.05;
        c.bsOn = true;
        c.feOn = true;
        c.feBasis = 'fe';
        c.feN = 1.0;
        c.femMesh = 'c';
        c.femLifts = 3;
        c.femSrm = true;
      }

      expect(TS.calcFeEnsure(dTs)).toBe(ref.calcFeEnsure(dRef));
      const rTs = TS.calcRun(dTs);
      const rRef = ref.calcRun(dRef);
      assertParity(rTs, rRef, 'multiHazard_D_rockAnchor.calcRun');
      assertParity(TS.calcChecks(rTs), ref.calcChecks(rRef), 'multiHazard_D_rockAnchor.checks');
      expect(TS.calcGsRunNow(dTs)).toBe(ref.calcGsRunNow(dRef));
      const femTs = TS.runFemSync(dTs, { full: true, raw: true });
      const femRef = ref.FEM2D.job(ref.calcFemPack(dRef, true)!);
      assertParity(femTs, femRef, 'multiHazard_D_rockAnchor.FEM2D', new WeakMap(), 1e-8);
    }
  }, 45000);

  it('matches legacy .tcl.json migrations (kb/kf -> kbx/kby/kfx/kfy, rock anchors on B/A) and calcFamilyFix (B<->D)', () => {
    const legacyB = {
      tpl: 'B',
      H: 600,
      calc: {
        soil: 'a',
        anc: true,
        aLr: 1.5,
        aLc: 0.6,
        ad: 28,
        as: 0.8,
        wOn: true,
        kb: 1e-4,
        kf: 5e-5,
      },
    };
    const tsMerged = TS.mergeProject(JSON.parse(JSON.stringify(legacyB)));
    const refMerged = ref.mergeProject(JSON.parse(JSON.stringify(legacyB)));
    assertParity(tsMerged, refMerged, 'mergeProject(legacyB)');
    assertParity(TS.calcEnsure(tsMerged), ref.calcEnsure(refMerged), 'calcEnsure(legacyB)');
    expect(tsMerged.anc.on).toBe(true);
    expect(tsMerged.calc!.kbx).toBeCloseTo(1e-10, 18);
    expect(tsMerged.calc!.kfx).toBeCloseTo(5e-11, 18);

    // Zero kb/kf fallback (kb: 0 -> 1 * 1e-6) + metadata preservation across calcFamilyFix B -> D -> B
    const legacyZeroK = {
      tpl: 'B',
      H: 500,
      calc: { pjName: 'Bridge 1', dec: ',', kb: 0, kf: 0 },
    };
    const tsZero = TS.mergeProject(JSON.parse(JSON.stringify(legacyZeroK)));
    const refZero = ref.mergeProject(JSON.parse(JSON.stringify(legacyZeroK)));
    assertParity(TS.calcEnsure(tsZero), ref.calcEnsure(refZero), 'calcEnsure(zero_kb_kf)');
    expect(tsZero.calc!.kbx).toBe(1e-6);

    const switchToD = JSON.parse(JSON.stringify(tsZero)) as EngineProject;
    const switchToDRef = JSON.parse(JSON.stringify(refZero)) as EngineProject;
    switchToD.tpl = 'D';
    switchToDRef.tpl = 'D';
    TS.calcFamilyFix(switchToD, false);
    ref.calcFamilyFix(switchToDRef, false);
    assertParity(switchToD, switchToDRef, 'calcFamilyFix(B->D)');
    expect(switchToD.calc!.pjName).toBe('Bridge 1');
    expect(switchToD.calc!.dec).toBe(',');

    switchToD.tpl = 'B';
    switchToDRef.tpl = 'B';
    TS.calcFamilyFix(switchToD, true);
    ref.calcFamilyFix(switchToDRef, true);
    assertParity(switchToD, switchToDRef, 'calcFamilyFix(D->B)');
    expect(switchToD.calc!.pjName).toBe('Bridge 1');
    expect(switchToD.calc!.dec).toBe(',');
  });
});
