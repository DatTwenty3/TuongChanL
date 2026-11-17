// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as vm from 'node:vm';
import {
  BANG8,
  EtbDCfx,
  EchAnalyticFx,
  a1FromEacMPa,
  a2AsphaltFromSkN,
  a2CementFromEbsMPa,
  a2CementFromRnMPa,
  a2GranularFromCBR,
  a2GranularFromMrMPa,
  a3GranularFromCBR,
  a3GranularFromMrMPa,
  bang10Min,
  bang12K2,
  bang9Interp,
  betaOfFx,
  calcDrain,
  calcJoint,
  calcRigid,
  calcTC1,
  calcTC2,
  calcTC3,
  cfFromRL,
  computeFlexTraffic,
  computeNe,
  computeSN37Low,
  computeSN37New,
  computeSN37Overlay,
  createDefaultDrainInput,
  createDefaultFlexState,
  createDefaultJointInput,
  createDefaultRigidInput,
  createDefaultRigidTraffic,
  createDefaultSn37LowInput,
  createDefaultSn37NewInput,
  createDefaultSn37OverlayInput,
  mrFromCBR,
  mrFromGI,
  normSInv,
  reduceStackFx,
  resolveFlexInput,
  skuMatFx,
  skuMongFx,
  solveSN,
  tavAutoFx,
} from '../../src/pavement/engine';

const here = path.dirname(fileURLToPath(import.meta.url));
const oracleScriptPath = path.resolve(
  here,
  '../../../analysis-kcad/exported-scripts/files/isolated/source-1-42d71e05cc87b4a67f9dafbde0944bddafec1926244cffb51b7d3d0b9cf6b032.js',
);

const oracleSrc = (() => {
  try {
    return readFileSync(oracleScriptPath, 'utf8');
  } catch {
    return null;
  }
})();
const hasOracle = oracleSrc !== null;

interface OracleEnv {
  calc: (I: unknown) => Record<string, unknown>;
  computeNe: () => Record<string, number>;
  calcDrain: () => Record<string, number>;
  calcJoint: () => Record<string, unknown>;
  reduceStackFx: (layers: Array<{ E: number; h: number; name?: string }>) => Record<string, unknown>;
  betaOfFx: (hd: number) => number;
  EtbDCfx: (layers: Array<{ E: number; h: number; name?: string }>, D: number) => Record<string, unknown>;
  EchAnalyticFx: (E0: number, E1: number, H: number, D: number) => number;
  skuMatFx: (h1: number, E1: number, Echm: number, D: number) => number;
  skuMongFx: (E1: number, E2: number, E3: number, h: number, D: number) => number;
  bang9Interp: (Ntt: number, Ptt: number, loaiMat: string) => number;
  bang10Min: (cap: string, loaiMat: string) => number;
  bang12K2: (Ntt: number) => number;
  tavAutoFx: (phi: number, h: number) => number;
  calcTC1: (I: unknown) => Record<string, unknown>;
  calcTC2: (I: unknown) => Array<Record<string, unknown>>;
  calcTC3: (I: unknown) => Array<Record<string, unknown>>;
  normSInv: (p: number) => number;
  solveSN: (W80: number, ZR: number, S0: number, dPSI: number, MR: number) => number;
  a1FromEacMPa: (v: number) => number;
  a2GranularFromCBR: (v: number) => number;
  a2GranularFromMrMPa: (v: number) => number;
  a2CementFromRnMPa: (v: number) => number;
  a2CementFromEbsMPa: (v: number) => number;
  a2AsphaltFromSkN: (v: number) => number;
  a3GranularFromCBR: (v: number) => number;
  a3GranularFromMrMPa: (v: number) => number;
  mrFromCBR: (v: number) => number;
  mrFromGI: (v: number) => number;
  cfFromRL: (rl: number) => number;
  g_computeNew: () => Record<string, unknown>;
  g_computeOverlay: () => Record<string, unknown>;
  g_computeLow: () => Record<string, unknown>;
  setElValue: (id: string, val: string) => void;
  setFlexShear: (key: string, val: number) => void;
}

function loadOracle(): OracleEnv {
  const src = oracleSrc;
  if (!src) throw new Error(`Missing REA oracle script at ${oracleScriptPath}`);

  const elements = new Map<
    string,
    {
      value: string;
      innerHTML: string;
      textContent: string;
      hidden: boolean;
      style: Record<string, string>;
      dataset: Record<string, string>;
      selectedOptions: Array<{ text: string }>;
      classList: { toggle: () => void };
      addEventListener: () => void;
      setAttribute: () => void;
      querySelectorAll: () => unknown[];
    }
  >();

  const defaults: Record<string, string> = {
    cap: 'Cấp III (ví dụ B.2 – Long An)',
    model: '2',
    caly: '0',
    hc: '0.26',
    L: '4.8',
    B: '3.5',
    fr: '5.0',
    Ec: '31000',
    muc: '0.15',
    ac: '0.000011',
    Tg: '92',
    Ps: '100',
    Pmax: '180',
    Ne: '17070000',
    kr: '0.87',
    kc: '1.05',
    gr: '1.13',
    E0: '45',
    matBound: 'CPĐD gia cố xi măng',
    Eb: '1300',
    hb: '0.20',
    mub: '0.20',
    fbr: '0',
    adtt: '120',
    fhuong: '0.5',
    flan: '0.6',
    naxle: '6000',
    grow: '6',
    tyear: '15',
    eta: '0.5',
    d_Ic: '0.36',
    d_N: '2',
    d_nh: '1',
    d_B: '7.5',
    d_L: '4.5',
    d_id: '0.5',
    d_in: '2',
    d_kb: '300',
    d_ne: '0.15',
    d_hbt: '0.15',
    j_h: '24',
    j_kc: '3.75',
    j_mong: 'hat',
    j_cap: 'thap',
    j_L: '4.5',
    f_capduong: 'capIII',
    f_loaimat: 'A1',
    f_dotincay: '0.95',
    f_Ptt: '100',
    f_E0v: '46',
    f_E0t: '46',
    f_C0: '0.038',
    f_phi0: '27',
    f_k3_0: '1.5',
    f_ntkloai: 'cuoi',
    f_fL: '0.55',
    f_q: '6',
    f_t: '15',
    g_w80: '7223610',
    g_capduong: 'caotoc',
    g_p0: '4.2',
    g_pt: '2.5',
    g_R: '85',
    g_S0: '0.45',
    g_mrmode: 'direct',
    g_mrval: '50',
    g_nf: '4000000',
    g_olR: '90',
    g_olS0: '0.45',
    g_olp1: '4.2',
    g_olp2: '2.2',
    g_olMr: '39',
    g_olmethod: 'fwd',
    g_fwdP: '40',
    g_fwda: '15',
    g_fwdD: '62',
    g_fwdr: '90',
    g_fwddr: '0.009',
    g_fwdd0: '0.06077',
    g_fwdC: '0.33',
    g_rlSN0: '4.5',
    g_rlNp: '3000000',
    g_rlN15: '8000000',
    g_olEac: '4200',
    g_lowLoai: 'nhua',
    g_lowEsal: '600000',
    g_lowMrmode: 'direct',
    g_lowMr: '45',
    g_lowR: '50',
  };

  const makeEl = (id: string) => {
    const el = {
      value: defaults[id] ?? '',
      innerHTML: '',
      textContent: '',
      hidden: false,
      style: {},
      dataset: {},
      selectedOptions: [{ text: '' }],
      classList: { toggle: () => {} },
      addEventListener: () => {},
      setAttribute: () => {},
      querySelectorAll: () => [],
    };
    elements.set(id, el);
    return el;
  };

  const ctx = vm.createContext({
    Math,
    Number,
    String,
    Array,
    Object,
    JSON,
    Infinity,
    NaN,
    isFinite,
    isNaN,
    parseFloat,
    parseInt,
    window: { scrollTo: () => {} },
    document: {
      getElementById: (id: string) => elements.get(id) ?? makeEl(id),
      querySelectorAll: () => [],
      addEventListener: () => {},
      documentElement: { style: { setProperty: () => {} } },
    },
  });

  vm.runInContext(src, ctx);

  return {
    calc: (I) => vm.runInContext(`calc(${JSON.stringify(I)})`, ctx) as Record<string, unknown>,
    computeNe: () => vm.runInContext('computeNe()', ctx) as Record<string, number>,
    calcDrain: () => vm.runInContext('calcDrain()', ctx) as Record<string, number>,
    calcJoint: () => vm.runInContext('calcJoint()', ctx) as Record<string, unknown>,
    reduceStackFx: (layers) => vm.runInContext(`reduceStackFx(${JSON.stringify(layers)})`, ctx) as Record<string, unknown>,
    betaOfFx: (hd) => vm.runInContext(`betaOfFx(${hd})`, ctx) as number,
    EtbDCfx: (layers, D) => vm.runInContext(`EtbDCfx(${JSON.stringify(layers)}, ${D})`, ctx) as Record<string, unknown>,
    EchAnalyticFx: (E0, E1, H, D) => vm.runInContext(`EchAnalyticFx(${E0},${E1},${H},${D})`, ctx) as number,
    skuMatFx: (h1, E1, Echm, D) => vm.runInContext(`skuMatFx(${h1},${E1},${Echm},${D})`, ctx) as number,
    skuMongFx: (E1, E2, E3, h, D) => vm.runInContext(`skuMongFx(${E1},${E2},${E3},${h},${D})`, ctx) as number,
    bang9Interp: (Ntt, Ptt, loaiMat) => vm.runInContext(`bang9Interp(${Ntt},${Ptt},${JSON.stringify(loaiMat)})`, ctx) as number,
    bang10Min: (cap, loaiMat) => vm.runInContext(`bang10Min(${JSON.stringify(cap)},${JSON.stringify(loaiMat)})`, ctx) as number,
    bang12K2: (Ntt) => vm.runInContext(`bang12K2(${Ntt})`, ctx) as number,
    tavAutoFx: (phi, h) => vm.runInContext(`tavAutoFx(${phi},${h})`, ctx) as number,
    calcTC1: (I) => vm.runInContext(`calcTC1(${JSON.stringify(I)})`, ctx) as Record<string, unknown>,
    calcTC2: (I) =>
      vm.runInContext(`calcTC2(Object.assign(${JSON.stringify(I)}, {traf: computeFlexTraffic()}))`, ctx) as Array<Record<string, unknown>>,
    calcTC3: (I) =>
      vm.runInContext(`calcTC3(Object.assign(${JSON.stringify(I)}, {traf: computeFlexTraffic()}))`, ctx) as Array<Record<string, unknown>>,
    normSInv: (p) => vm.runInContext(`normSInv(${p})`, ctx) as number,
    solveSN: (W80, ZR, S0, dPSI, MR) => vm.runInContext(`solveSN(${W80},${ZR},${S0},${dPSI},${MR})`, ctx) as number,
    a1FromEacMPa: (v) => vm.runInContext(`a1FromEacMPa(${v})`, ctx) as number,
    a2GranularFromCBR: (v) => vm.runInContext(`a2GranularFromCBR(${v})`, ctx) as number,
    a2GranularFromMrMPa: (v) => vm.runInContext(`a2GranularFromMrMPa(${v})`, ctx) as number,
    a2CementFromRnMPa: (v) => vm.runInContext(`a2CementFromRnMPa(${v})`, ctx) as number,
    a2CementFromEbsMPa: (v) => vm.runInContext(`a2CementFromEbsMPa(${v})`, ctx) as number,
    a2AsphaltFromSkN: (v) => vm.runInContext(`a2AsphaltFromSkN(${v})`, ctx) as number,
    a3GranularFromCBR: (v) => vm.runInContext(`a3GranularFromCBR(${v})`, ctx) as number,
    a3GranularFromMrMPa: (v) => vm.runInContext(`a3GranularFromMrMPa(${v})`, ctx) as number,
    mrFromCBR: (v) => vm.runInContext(`mrFromCBR(${v})`, ctx) as number,
    mrFromGI: (v) => vm.runInContext(`mrFromGI(${v})`, ctx) as number,
    cfFromRL: (rl) => vm.runInContext(`cfFromRL(${rl})`, ctx) as number,
    g_computeNew: () => vm.runInContext('g_computeNew()', ctx) as Record<string, unknown>,
    g_computeOverlay: () => vm.runInContext('g_computeOverlay()', ctx) as Record<string, unknown>,
    g_computeLow: () => vm.runInContext('g_computeLow()', ctx) as Record<string, unknown>,
    setElValue: (id, val) => {
      const el = elements.get(id) ?? makeEl(id);
      el.value = val;
    },
    setFlexShear: (key, val) => {
      vm.runInContext(`FLEX_SHEAR_MANUAL[${JSON.stringify(key)}] = ${val}`, ctx);
    },
  };
}

describe('Pavement Engine Baseline Sanity (standalone CI safe)', () => {
  it('computes default TCCS 39, 38, and 37 solutions consistently', () => {
    const r = calcRigid(createDefaultRigidInput());
    expect(r.p1 && r.p2 && r.p3).toBe(true);
    expect(r.Et).toBeGreaterThan(70);
    const flex = resolveFlexInput(createDefaultFlexState());
    const tc1 = calcTC1(flex);
    expect(tc1.Ech).toBeGreaterThan(190);
    expect(tc1.pass).toBe(false);
    const snNew = computeSN37New(createDefaultSn37NewInput());
    expect(snNew.SN).toBeGreaterThan(4.4);
  });
});

describe.runIf(hasOracle)('Pavement Differential Parity vs REA-captured kcad.netlify.app', () => {
  it('TCCS 39 Rigid matches oracle for MH2, MH1, isolation layer, fbr>0, Ne, Drain, and Joint', () => {
    const oracle = loadOracle();
    const defIn = createDefaultRigidInput();

    const cases = [
      defIn,
      { ...defIn, model: 1 as const, Eb: 0, hb: 0, fbr: 0 },
      { ...defIn, caly: 1 as const, fbr: 1.2 },
      { ...defIn, hc: 0.22, L: 4.5, layers: [{ name: 'L1', E: 250, h: 0.15 }, { name: 'L2', E: 180, h: 0.2 }] },
    ];

    for (const c of cases) {
      const got = calcRigid(c);
      const exp = oracle.calc(c);
      for (const key of Object.keys(got) as Array<keyof typeof got>) {
        if (typeof got[key] === 'number') {
          expect(got[key]).toBeCloseTo(exp[key] as number, 10);
        } else {
          expect(got[key]).toEqual(exp[key]);
        }
      }
    }

    const neGot = computeNe(createDefaultRigidTraffic(), defIn.Ps);
    const neExp = oracle.computeNe();
    expect(neGot.adttlan).toBeCloseTo(neExp.adttlan, 10);
    expect(neGot.sum).toBeCloseTo(neExp.sum, 10);
    expect(neGot.Ns1).toBeCloseTo(neExp.Ns1, 10);
    expect(neGot.Ne).toBeCloseTo(neExp.Ne, 6);

    const drainGot = calcDrain(createDefaultDrainInput());
    const drainExp = oracle.calcDrain();
    expect(drainGot.nz).toBe(drainExp.nz);
    expect(drainGot.Qi).toBeCloseTo(drainExp.Qi, 10);
    expect(drainGot.Ls).toBeCloseTo(drainExp.Ls, 10);
    expect(drainGot.vs).toBeCloseTo(drainExp.vs, 12);
    expect(drainGot.t).toBeCloseTo(drainExp.t, 10);
    expect(drainGot.cap).toBeCloseTo(drainExp.cap, 10);

    for (const h of [20, 24, 26, 28, 30]) {
      oracle.setElValue('j_h', String(h));
      const jGot = calcJoint({ ...createDefaultJointInput(), h });
      const jExp = oracle.calcJoint();
      expect(jGot).toEqual(jExp);
    }
  });

  it('TCCS 38 Flex matches oracle across helpers, TC1, TC2, TC3, and traffic variants', () => {
    const oracle = loadOracle();

    for (const hd of [0.3, 0.5, 0.87, 1.35, 1.9, 2.5]) {
      expect(betaOfFx(hd)).toBeCloseTo(oracle.betaOfFx(hd), 10);
    }
    for (const ntt of [15, 75, 350, 901, 3500, 9000]) {
      expect(bang9Interp(ntt, 100, 'A1')).toBeCloseTo(oracle.bang9Interp(ntt, 100, 'A1'), 10);
      expect(bang9Interp(ntt, 120, 'A2')).toBeCloseTo(oracle.bang9Interp(ntt, 120, 'A2'), 10);
      expect(bang12K2(ntt)).toBe(oracle.bang12K2(ntt));
    }
    expect(bang10Min('capIII', 'A1')).toBe(oracle.bang10Min('capIII', 'A1'));
    expect(bang10Min('capV', 'A1')).toBe(oracle.bang10Min('capV', 'A1'));
    for (const phi of [5, 11, 20, 27, 35, 40]) {
      expect(tavAutoFx(phi, 45)).toBeCloseTo(oracle.tavAutoFx(phi, 45), 12);
    }
    expect(EchAnalyticFx(46, 429.5, 63, 33)).toBeCloseTo(oracle.EchAnalyticFx(46, 429.5, 63, 33), 10);
    expect(skuMatFx(6, 1800, 219.3, 33)).toBeCloseTo(oracle.skuMatFx(6, 1800, 219.3, 33), 10);
    expect(skuMongFx(1686, 600, 111.1, 28, 33)).toBeCloseTo(oracle.skuMongFx(1686, 600, 111.1, 28, 33), 10);

    const fState = createDefaultFlexState();
    fState.shearManual = { shear_4: 0.08, shear_5: 0.04 };
    oracle.setFlexShear('shear_4', 0.08);
    oracle.setFlexShear('shear_5', 0.04);

    const resolved = resolveFlexInput(fState);
    const tc1Got = calcTC1(resolved);
    const tc1Exp = oracle.calcTC1(resolved);
    expect(tc1Got.Ech).toBeCloseTo(tc1Exp.Ech as number, 10);
    expect(tc1Got.req).toBeCloseTo(tc1Exp.req as number, 10);
    expect(tc1Got.pass).toBe(tc1Exp.pass);

    const tc2Got = calcTC2(resolved);
    const tc2Exp = oracle.calcTC2(resolved);
    expect(tc2Got.length).toBe(tc2Exp.length);
    tc2Got.forEach((row, i) => {
      expect(row.sku).toBeCloseTo(tc2Exp[i].sku as number, 10);
      expect(row.allow).toBeCloseTo(tc2Exp[i].allow as number, 10);
      expect(row.pass).toBe(tc2Exp[i].pass);
    });

    const tc3Got = calcTC3(resolved);
    const tc3Exp = oracle.calcTC3(resolved);
    expect(tc3Got.length).toBe(tc3Exp.length);
    tc3Got.forEach((row, i) => {
      expect(row.lhs).toBeCloseTo(tc3Exp[i].lhs as number, 10);
      expect(row.allow).toBeCloseTo(tc3Exp[i].allow as number, 10);
      expect(row.Tav).toBeCloseTo(tc3Exp[i].Tav as number, 10);
      expect(row.pass).toBe(tc3Exp[i].pass);
    });

    const stackTest = [
      { E: 250, h: 18 },
      { E: 300, h: 17 },
    ];
    expect(reduceStackFx(stackTest).Etb).toBeCloseTo(oracle.reduceStackFx(stackTest).Etb as number, 10);
    expect(EtbDCfx(stackTest, 33).Etbc).toBeCloseTo(oracle.EtbDCfx(stackTest, 33).Etbc as number, 10);
    expect(BANG8['0.95'].dv).toBe(1.17);
    expect(computeFlexTraffic({ ...fState, ntkloai: 'dau' }).Ne).toBeGreaterThan(0);
  });

  it('TCCS 37 SN matches oracle across regressions, New, Overlay (FWD/Survey/RL), and Low-Volume', () => {
    const oracle = loadOracle();

    expect(normSInv(0.15)).toBeCloseTo(oracle.normSInv(0.15), 10);
    expect(solveSN(7223610, -1.036, 0.45, 1.7, 50)).toBeCloseTo(oracle.solveSN(7223610, -1.036, 0.45, 1.7, 50), 8);
    expect(a1FromEacMPa(4770)).toBeCloseTo(oracle.a1FromEacMPa(4770), 10);
    expect(a2GranularFromCBR(80)).toBeCloseTo(oracle.a2GranularFromCBR(80), 10);
    expect(a2GranularFromMrMPa(300)).toBeCloseTo(oracle.a2GranularFromMrMPa(300), 10);
    expect(a2CementFromRnMPa(4.5)).toBeCloseTo(oracle.a2CementFromRnMPa(4.5), 10);
    expect(a2CementFromEbsMPa(1200)).toBeCloseTo(oracle.a2CementFromEbsMPa(1200), 10);
    expect(a2AsphaltFromSkN(8)).toBeCloseTo(oracle.a2AsphaltFromSkN(8), 10);
    expect(a3GranularFromCBR(30)).toBeCloseTo(oracle.a3GranularFromCBR(30), 10);
    expect(a3GranularFromMrMPa(150)).toBeCloseTo(oracle.a3GranularFromMrMPa(150), 10);
    expect(mrFromCBR(8)).toBeCloseTo(oracle.mrFromCBR(8), 10);
    expect(mrFromGI(5)).toBeCloseTo(oracle.mrFromGI(5), 10);
    expect(cfFromRL(62.5)).toBeCloseTo(oracle.cfFromRL(62.5), 10);

    const newGot = computeSN37New(createDefaultSn37NewInput());
    const newExp = oracle.g_computeNew();
    expect(newGot.SN).toBeCloseTo(newExp.SN as number, 8);
    expect(newGot.lastD).toBeCloseTo(newExp.lastD as number, 8);

    for (const method of ['fwd', 'survey', 'rl'] as const) {
      oracle.setElValue('g_olmethod', method);
      const olGot = computeSN37Overlay({ ...createDefaultSn37OverlayInput(), method });
      const olExp = oracle.g_computeOverlay();
      expect(olGot.SNf).toBeCloseTo(olExp.SNf as number, 8);
      expect(olGot.SNeff).toBeCloseTo(olExp.SNeff as number, 8);
      expect(olGot.Dol).toBeCloseTo(olExp.Dol as number, 8);
    }

    for (const loai of ['nhua', 'cpd'] as const) {
      for (const Rrel of ['50', '75'] as const) {
        oracle.setElValue('g_lowLoai', loai);
        oracle.setElValue('g_lowR', Rrel);
        const lowGot = computeSN37Low({ ...createDefaultSn37LowInput(), loai, Rrel });
        const lowExp = oracle.g_computeLow();
        expect(lowGot.level).toBe(lowExp.level);
        expect(lowGot.quality).toBe(lowExp.quality);
        if (loai === 'nhua') {
          expect(lowGot.snr).toBe(lowExp.snr);
        } else {
          expect(lowGot.th).toBe(lowExp.th);
        }
      }
    }
  });
});
