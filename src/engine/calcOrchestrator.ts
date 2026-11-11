/**
 * Top-level calculation orchestrator (`calcRun`, `calcInputs`, `calcFeEnsure`,
 * `calcFemRun`, `calcGsRunNow`, `calcSuggest`, `calcApplyFixes`, `calcHeelHint`,
 * `calcChecks`, `calcBadgeCount`, `cnf`) ported faithfully from
 * `10_calc_orchestrator.js`, `16_calc_figures.js`, and `25_calc_ui_print.js`.
 */

import {
  CALC,
  type CalcCoreResult,
} from './calcCore.ts';
import {
  calcGlobalChecks,
  calcRibRun,
  calcSuggestRib,
  type CalcRibResult,
} from './calcRibbed.ts';
import { CFE, type CfeSolveResult } from './cfe.ts';
import {
  FEM2D,
  type Fem2dJobOutput,
  type Fem2dPackInput,
  type Fem2dPackOptions,
  type Fem2dWaterInput,
} from './fem2dCore.ts';
import { ancGrid, calcFill, calcGeomP, geom } from './geom.ts';
import {
  CALC_AS,
  CALC_DS,
  CALC_FCT,
  CALC_TAU,
  ancKey,
  ancOn,
  barA,
  blindT,
  calcDefaults,
  calcDefaultsD,
  calcEnsure,
  calcFamilyFix,
  calcFcOf,
  calcFindBars,
  calcFyOf,
  fmt,
} from './presets.ts';
import { SLOPE, type SlopeRunResult } from './slope.ts';
import type {
  EngineCalcConfig,
  EngineCalcGeomData,
  EngineCalcInputParams,
  EngineCheckItem,
  EngineProject,
  EngineRebarMap,
  EngineSuggestItem,
  EngineWaterSeep,
} from './types.ts';
import { WATER } from './water.ts';

export {
  CALC_AS,
  CALC_DS,
  CALC_FCT,
  CALC_TAU,
  barA,
  calcDefaults,
  calcDefaultsD,
  calcEnsure,
  calcFamilyFix,
  calcFcOf,
  calcFill,
  calcFindBars,
  calcFyOf,
  calcGeomP,
};

export let CALC_DEC: '.' | ',' = '.';

export function setCalcDec(dec: '.' | ','): void {
  CALC_DEC = dec === ',' ? ',' : '.';
}

export function cnf(x: number | null | undefined, d = 2): string {
  if (x === null || x === undefined || !isFinite(x)) return '-';
  const [iRaw, f] = (+x).toFixed(d).split('.');
  let i = iRaw;
  let neg = i[0] === '-';
  if (neg) i = i.slice(1);
  const dot = CALC_DEC === ',' ? ',' : '.';
  const ths = CALC_DEC === ',' ? '.' : ',';
  i = i.replace(/\B(?=(\d{3})+(?!\d))/g, ths);
  if (neg && +i.replace(/\D/g, '') === 0 && !(f && /[1-9]/.test(f))) neg = false;
  return (neg ? '-' : '') + i + (f ? dot + f : '');
}

export type CantiCalcResult = CalcCoreResult & {
  P?: EngineProject;
  model?: 'canti';
  fe?: CfeSolveResult;
  slope?: SlopeRunResult;
  checks?: EngineCheckItem[];
  ok: CalcCoreResult['ok'] & { fe?: boolean; slope?: boolean };
  error?: undefined;
  unsupported?: undefined;
};

export type RibCalcResult = Omit<CalcRibResult, 'ok'> & {
  fe?: CfeSolveResult;
  slope?: SlopeRunResult;
  hand?: { rib: CalcRibResult['rib']; ok: CalcRibResult['ok'] };
  ok: CalcRibResult['ok'] & { fe?: boolean; slope?: boolean };
  error?: undefined;
  unsupported?: undefined;
};

export type CalcValidResult = CantiCalcResult | RibCalcResult;

export type CalcRunResult =
  | CalcValidResult
  | { unsupported: true; msg: string; error?: undefined }
  | { error: string; unsupported?: undefined };

export function isCalcValid(R: CalcRunResult | null | undefined): R is CalcValidResult {
  return !!(R && R.error === undefined && R.unsupported === undefined);
}

export interface GsRunResult {
  key: string;
  ms: number;
  err: string;
  seep: EngineWaterSeep | null;
  bishop: SlopeRunResult | null;
}

export interface GsRow {
  id: string;
  nm: string;
  how: string;
  fs: number | null;
  req: number;
  ok: boolean | null;
  note?: string;
  info?: boolean;
}

const getp = (o: unknown, path: string): Record<string, unknown> =>
  path.split('.').reduce<unknown>((a, k) => (a as Record<string, unknown>)[k], o) as Record<
    string,
    unknown
  >;

export function calcProportion(P: EngineProject) {
  const g0 = geom(P);
  const B = g0.B / 100;
  const H = g0.yTop / 100;
  const toe = Math.max(0, P.toe || 0) / 100;
  const rB = B / Math.max(H, 1e-9);
  const rT = toe / Math.max(B, 1e-9);
  const e = 1e-6;
  return {
    B,
    H,
    toe,
    rB,
    rT,
    okB: rB >= 0.5 - e && rB <= 0.7 + e,
    okT: rT >= 0.15 - e && rT <= 0.25 + e,
    light: P.type === 'canti',
  };
}

export function calcTipText(
  P: EngineProject,
  f: (n: number, d?: number) => string,
  lead: string,
): string {
  const q = calcProportion(P);
  const flag = (ok: boolean) => (ok || !q.light ? '' : ' (ngoài khoảng thường dùng)');
  return (
    `${lead}: bề rộng đáy móng B thường chọn từ ${f(0.5, 1)}H đến ${f(0.7, 1)}H; chiều dài mũi móng thường từ ${f(0.15, 2)}B đến ${f(0.25, 2)}B để cân bằng ổn định lật và trượt (H - chiều cao toàn tường tính từ đáy bản đáy). ` +
    `Tường hiện tại: H = ${f(q.H, 2)} m ; B = ${f(q.B, 2)} m = ${f(q.rB, 2)}H${flag(q.okB)} ; mũi = ${f(q.toe, 2)} m = ${f(q.rT, 2)}B${flag(q.okT)}.` +
    (q.light ? '' : ' Khoảng này dùng cho tường không sườn; tường có sườn thường có gót dài hơn.')
  );
}

export const calcTipLive = (P: EngineProject): string => calcTipText(P, fmt, 'Mẹo thiết kế');

export function calcRebarMap(P: EngineProject): EngineRebarMap {
  const rb = P.rb;
  if (P.tpl === 'C') {
    return {
      sb: rb.c6,
      sf: rb.c7,
      fb: rb.c1,
      ft: rb.c1,
      hh: rb.c5,
      ll: rb.c2,
      path: { sb: 'rb.c6', sf: 'rb.c7', fb: 'rb.c1', ft: 'rb.c1', hh: 'rb.c5', ll: 'rb.c2' },
    };
  }
  return {
    sb: rb.s1,
    sf: rb.s2,
    fb: rb.b1,
    ft: rb.b2,
    hh: rb.h1,
    ll: rb.l1,
    path: { sb: 'rb.s1', sf: 'rb.s2', fb: 'rb.b1', ft: 'rb.b2', hh: 'rb.h1', ll: 'rb.l1' },
  };
}

export function calcInputs(P: EngineProject, g: EngineCalcGeomData): EngineCalcInputParams {
  const c = calcEnsure(P);
  const k = 0.01;
  const rm = calcRebarMap(P);
  const fill = calcFill(P);
  const g0 = g.g0;
  const cmm = P.cover * 10;
  const hStem = g.yT - g.yF;
  const I: EngineCalcInputParams = {
    H: hStem,
    t: P.tst * k,
    n1: (g.xf(g.yT) - g.xfb) / Math.max(hStem, 1e-9),
    n2: (g.xbb - g.xb(g.yT)) / Math.max(hStem, 1e-9),
    b1: P.toe * k,
    b4: P.heel * k,
    hm: g.yF,
    ht: Math.min(P.tTip * k, g.yF),
    hh: Math.min(g0.tH * k, g.yF),
    hf: c.hf,
    Hs: fill.Hs,
    m: fill.m,
    q: c.q,
    qL: Math.max(0, c.qL || 0),
    LL: !!c.LL,
    dT: c.dT,
    gs: c.gs,
    phi: c.phi,
    dw: c.dw,
    dvA: !!c.dvA,
    dv: c.dv,
    cs: Math.max(0, c.cs),
    gc: c.gc,
    fc: c.fc > 0 ? c.fc : calcFcOf(P.concrete),
    fy: calcFyOf(P.steel),
    ag: c.ag,
    ge: c.ge,
    cov: cmm + rm.hh.d,
    covB: cmm,
    covT: cmm,
    sbd: rm.sb.d,
    sbs: (rm.sb.a || 20) * 10,
    sfd: rm.sf.d,
    sfs: (rm.sf.a || 20) * 10,
    fbd: rm.fb.d,
    fbs: (rm.fb.a || 20) * 10,
    ftd: rm.ft.d,
    fts: (rm.ft.a || 20) * 10,
    hd: rm.hh.d,
    hs: (rm.hh.a || 20) * 10,
    ld: rm.ll.d,
    ls: (rm.ll.a || 20) * 10,
    ift: c.ift,
    soil: c.soil === 'a' ? 'r' : c.soil,
    rock: c.soil === 'a',
    gf: c.gf,
    phif: c.phif,
    cf: c.cf,
    Su: c.Su,
    Dw: c.Dw,
    brm: c.brm,
    phib: c.phib,
    Nspt: c.Nspt,
    Ri: c.Ri || 1,
    phibS: c.phibS,
    brmR: c.brmR,
    qu: c.qu,
    RMR: c.RMR,
    rockT: c.rockT,
    phibR: c.phibR,
    qRu: c.qRu,
    phit: c.phit,
    eta: c.eta || 1,
    cR: c.cR,
    phiR: c.phiR,
    gR: c.gR,
    aSl: c.aSl,
    aTv: c.aTv,
    wOn: !!c.wOn,
    hB: c.hB,
    hF: c.hF,
    wMode: c.wMode,
    gsat: c.gsat,
    gfs: c.gfs,
    Tn: c.Tn,
    kbx: c.kbx,
    kby: c.kby,
    kfx: c.kfx,
    kfy: c.kfy,
    FSp: c.FSp,
    eqOn: !!c.eqOn,
    eqA: c.eqA,
    eqKm: c.eqKm,
    eqKh: c.eqKh,
    eqKv: c.eqKv,
    eqG: c.eqG,
    bsOn: !!c.bsOn,
    bsT: c.bsT,
    bsPhiR: c.bsPhiR,
    anc: c.soil === 'a' && ancOn(P),
    aOT: !!c.aOT,
    ad: c.ad,
    afy: c.afy,
    aDh: c.aDh,
    atau: c.tauA === 'tay' ? c.atau : CALC_TAU[c.rockT] || 0.8,
    aLr: c.aLr,
    aLc: c.aLc,
    agf: c.agf,
    as: c.as || 1,
    aX: (() => {
      const a = String(c.aX)
        .split(/[;\s]+/)
        .map((s) => parseFloat(s.replace(',', '.')))
        .filter(isFinite);
      const B = g.B;
      const r = a.length
        ? a
        : P.toe * k > 0.3
          ? [(P.toe * k) / 2, B - (P.heel * k) / 2]
          : [0.15 * B, 0.85 * B];
      return r.map((x) => Math.min(B - 0.05, Math.max(0.05, x)));
    })(),
    amu: c.amu,
    phs: 0.9,
    php: 0.5,
  };
  if (I.anc) {
    const da = g0.an || ancGrid(P, g0)!;
    const ra = (P.rb && P.rb[ancKey(P)]) || {};
    I.ad = ra.d || P.anc.d || I.ad;
    I.aLr = Math.max(0.05, da.Lb - blindT(P)) * k;
    I.aLc = da.Lc * k;
    I.as = da.a * k;
    I.aX = da.xs.map((x) => x * k);
  }
  return I;
}

let _calcCache: { key: string; res: CalcRunResult | null } = { key: '', res: null };

const _calcKeyArr = (P: EngineProject) => [
  P.tpl,
  P.type,
  P.H,
  P.tst,
  P.tsb,
  P.toe,
  P.heel,
  P.tBase,
  P.tTip,
  P.tTipH,
  P.toeFlat,
  P.haunch,
  P.fil,
  P.cap,
  P.beam,
  P.key,
  P.rib,
  P.Lu,
  P.concrete,
  P.fillMode,
  P.fillH,
  P.keIdx,
  P.dIdx,
  P.pvc,
  P.anc,
  P.vtop,
];

const _FEM_KEYS = [
  'femOn',
  'femMesh',
  'femSrm',
  'femEb',
  'femEf',
  'femPsi',
  'femLifts',
  'fsSl',
  'fsOt',
  'fsGs',
  'fsSlE',
  'fsOtE',
  'pjName',
  'pjItem',
  'pjPlace',
  'pjBy',
  'pjDate',
] as const;

export function calcKey(P: EngineProject): string {
  const c: Record<string, unknown> = { ...(P.calc as object) };
  _FEM_KEYS.forEach((k) => {
    delete c[k];
  });
  return JSON.stringify([c, _calcKeyArr(P), P.cover, P.steel, P.rb]);
}

let _feCache: { key: string; fe: CfeSolveResult | null; id: number } = {
  key: '',
  fe: null,
  id: 0,
};

export function getFeCache() {
  return _feCache;
}

export function calcFeKey(P: EngineProject): string {
  const c: Record<string, unknown> = { ...(P.calc as object) };
  ['feOn', 'feBasis', 'dec', ..._FEM_KEYS].forEach((k) => {
    delete c[k];
  });
  return JSON.stringify([c, _calcKeyArr(P)]);
}

export const calcFeCurrent = (P: EngineProject): boolean =>
  !!(_feCache.fe && _feCache.key === calcFeKey(P));

export const calcFeStale = (P: EngineProject): boolean => {
  const c = calcEnsure(P);
  return !!c.feOn && !calcFeCurrent(P);
};

export function calcFeEnsure(P: EngineProject): boolean {
  const c = calcEnsure(P);
  if (!calcFeStale(P)) return false;
  const R = calcRun(P);
  if (!isCalcValid(R) || !R.C) return false;
  const n = Math.min(1.5, Math.max(0.25, +c.feN || 0.5));
  const fe = CFE.solve(R, { hx: n, hz: 0.9 * n, hxr: n });
  _feCache = { key: calcFeKey(P), fe, id: _feCache.id + 1 };
  return true;
}

let _femCache: {
  key: string;
  ekey: string;
  out: Fem2dJobOutput | null;
  err: string;
  tpl: string;
  busy: boolean;
  t0: number;
  ms: number;
  nth: number;
} = {
  key: '',
  ekey: '',
  out: null,
  err: '',
  tpl: '',
  busy: false,
  t0: 0,
  ms: 0,
  nth: 0,
};
let _femWorker: Worker | false | null = null;
let _femPend: {
  id: number;
  m: Fem2dPackInput;
  fin: (out: Fem2dJobOutput | null, err?: string) => void;
} | null = null;

export function getFemCache() {
  return _femCache;
}

export function calcFemOpts(c: EngineCalcConfig): Fem2dPackOptions {
  const o: Fem2dPackOptions = {
    coarse: c.femMesh === 'c',
    lifts: Math.max(1, Math.min(10, Math.round(+c.femLifts) || 5)),
    psi: Math.max(0, Math.min(30, +c.femPsi || 0)),
    noSrm: !c.femSrm,
    E: { back: Math.max(1, +c.femEb || 30) * 1e3 },
    raw: true,
  };
  if (+c.femEf > 0) o.E!.found = +c.femEf * 1e3;
  return o;
}

export function calcGsSeep(R: CalcValidResult, coarse?: boolean): EngineWaterSeep | null {
  const I = R.I;
  const g = R.g;
  const W = R.W;
  if (!I.wOn || !W) return null;
  const dm = FEM2D.domain(R, I.Tn);
  const mk = (v: number) => Math.max(1e-12, +v || 1e-12);
  return WATER.seepSolve({
    polys: [g.foot, g.stem],
    B: g.B,
    hB: W.hB,
    hF: W.hF,
    hFtop: W.hFtop,
    Df: W.Df,
    Tn: Math.max(1, I.Tn),
    kbx: mk(I.kbx),
    kby: mk(I.kby),
    kfx: mk(I.kfx),
    kfy: mk(I.kfy),
    xs: W.xs,
    q: coarse ? 2 : 1,
    xlo: -dm.Lf,
    xhi: g.B + dm.Lb,
  });
}

export function calcGsWater(R: CalcValidResult, coarse?: boolean): Fem2dWaterInput | null {
  const S = calcGsSeep(R, coarse);
  if (!S) return null;
  const W = R.W!;
  const r4 = (v: number) => Math.round(v * 1e4) / 1e4;
  const H = new Array<number>(S.H.length);
  for (let k = 0; k < H.length; k++) {
    const v = S.H[k];
    H[k] = isFinite(v) ? r4(v) : 1e9;
  }
  return {
    X: Array.from(S.X, r4),
    Y: Array.from(S.Y, r4),
    H,
    hB: W.hB,
    hF: W.hF,
    hFtop: W.hFtop,
    xs: W.xs,
    gw: WATER.GW,
    Tn: -S.Y[0],
  };
}

export function calcFemPack(P: EngineProject, full?: boolean): Fem2dPackInput | null {
  const R = calcRun(P);
  if (!isCalcValid(R) || !R.g || !R.I) return null;
  const o = calcFemOpts(calcEnsure(P));
  const I = R.I;
  if (I.wOn && R.W) {
    o.water = full
      ? calcGsWater(R, o.coarse)
      : {
          hB: R.W.hB,
          hF: R.W.hF,
          hFtop: R.W.hFtop,
          Tn: Math.max(1, I.Tn),
          k: [I.kbx, I.kby, I.kfx, I.kfy],
          g: [I.gsat, I.gfs],
        };
  }
  return FEM2D.pack(R, o);
}

export function calcFemKey(P: EngineProject): string {
  const m = calcFemPack(P, false);
  return m ? JSON.stringify(m) : '';
}

export const calcFemOut = (P: EngineProject): Fem2dJobOutput | null =>
  _femCache.out && _femCache.tpl === P.tpl ? _femCache.out : null;

export const calcFemCurrent = (P: EngineProject): boolean =>
  !!(calcFemOut(P) && _femCache.key && _femCache.key === calcFemKey(P));

export const calcFemStale = (P: EngineProject): boolean =>
  !!(calcFemOut(P) && _femCache.key !== calcFemKey(P));

function calcFemWorker(): Worker | false {
  if (_femWorker !== null) return _femWorker;
  _femWorker = false;
  try {
    if (typeof Worker !== 'function') return false;
    const w = new Worker(new URL('./fem2d.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (
      e: MessageEvent<{ id: number; out?: Fem2dJobOutput; err?: string }>,
    ) => {
      const p = _femPend;
      if (p && p.id === e.data.id) {
        _femPend = null;
        p.fin(e.data.out ?? null, e.data.err);
      }
    };
    w.onerror = (ev: ErrorEvent) => {
      if (ev && ev.preventDefault) ev.preventDefault();
      _femWorker = false;
      const p = _femPend;
      if (p) {
        _femPend = null;
        setTimeout(() => {
          try {
            p.fin(FEM2D.job(p.m));
          } catch (x: unknown) {
            p.fin(null, String((x && (x as Error).message) || x));
          }
        }, 30);
      }
    };
    _femWorker = w;
  } catch {
    _femWorker = false;
  }
  return _femWorker;
}

export const calcFemCanAuto = (): boolean =>
  typeof Worker === 'function' && _femWorker !== false;

export function calcFemRun(P: EngineProject, done?: () => void): boolean {
  if (_femCache.busy) return false;
  const R = calcRun(P);
  if (!isCalcValid(R) || !R.g || !R.I) return false;
  const m = calcFemPack(P, true);
  if (!m) return false;
  const key = calcFemKey(P);
  const t0 = Date.now();
  const id = ++_femCache.nth;
  const tpl = P.tpl;
  _femCache.busy = true;
  _femCache.err = '';
  _femCache.t0 = t0;
  const fin = (out: Fem2dJobOutput | null, err?: string) => {
    _femCache = {
      key: err ? '' : key,
      ekey: err ? key : '',
      out: err ? null : out,
      err: err || '',
      tpl,
      busy: false,
      t0: 0,
      ms: Date.now() - t0,
      nth: _femCache.nth,
    };
    if (done) done();
  };
  const w = calcFemWorker();
  if (w) {
    _femPend = { id, m, fin };
    w.postMessage({ id, m });
  } else {
    setTimeout(() => {
      try {
        fin(FEM2D.job(m));
      } catch (x: unknown) {
        fin(null, String((x && (x as Error).message) || x));
      }
    }, 40);
  }
  return true;
}

export function calcGsClassic(R: CalcValidResult) {
  const I = R.I;
  const g = R.g;
  const L = R.Ld && R.Ld.L;
  if (!L || !L.length) return null;
  const one = (eq: boolean) => {
    const gq = R.E && R.E.gq != null ? R.E.gq : 0.5;
    const f: Record<string, number> = {
      DC: 1,
      EV: 1,
      EH: 1,
      ES: 1,
      LSh: eq ? gq : 1,
      LSv: eq ? gq : 1,
      WA: 1,
      EQ: eq ? 1 : 0,
    };
    let Fx = 0;
    let Fy = 0;
    let Mr = 0;
    let Mo = 0;
    L.forEach((l) => {
      const k = f[l.ty] != null ? f[l.ty] : 1;
      if (!k) return;
      const fx = k * l.Fx;
      const fy = k * l.Fy;
      Fx += fx;
      Fy += fy;
      [l.x * fy, -l.y * fx].forEach((v) => {
        if (v < 0) Mr -= v;
        else Mo += v;
      });
    });
    const N = -Fy;
    const H = -Fx;
    const an = R.an;
    const dwm = an && an.dw;
    const Rt =
      !I.rock && I.soil === 'd'
        ? Math.min(I.Su, (0.5 * N) / g.B) * g.B
        : N * Math.tan((I.phif * Math.PI) / 180);
    const Ra = an ? (dwm ? (eq ? an.Qn : an.Qd) : I.amu * an.sum) : 0;
    const RR = dwm ? Ra : Rt + Ra;
    return {
      N,
      H,
      Rt,
      Ra,
      RR,
      Mr,
      Mo,
      Fsl: H > 1e-9 ? RR / H : Infinity,
      Fot: Mo > 1e-9 ? Mr / Mo : Infinity,
      eq,
    };
  };
  return { sd: one(false), eq: R.E ? one(true) : null };
}

let _gsCache: { key: string; res: GsRunResult | null; tpl: string } = {
  key: '',
  res: null,
  tpl: '',
};

export function calcGsKey(P: EngineProject): string {
  const R = calcRun(P);
  if (!isCalcValid(R) || !R.g || !R.I) return '';
  const c = calcEnsure(P);
  return calcKey(P) + '|' + c.bsT + '|' + (c.femMesh === 'c' ? 'c' : 'n');
}

export function calcGsRunNow(P: EngineProject): boolean {
  const R = calcRun(P);
  if (!isCalcValid(R) || !R.g || !R.I) return false;
  const c = calcEnsure(P);
  const t0 = Date.now();
  const out: GsRunResult = { key: calcGsKey(P), ms: 0, err: '', seep: null, bishop: null };
  try {
    const S = calcGsSeep(R, c.femMesh === 'c');
    out.seep = S;
    out.bishop = SLOPE.run(
      R,
      Object.assign({ T: c.bsT, phiR: c.bsPhiR }, S ? { level: S.level, uFn: S.uAt } : {}),
    );
  } catch (e: unknown) {
    out.err = String((e && (e as Error).message) || e);
  }
  out.ms = Date.now() - t0;
  _gsCache = { key: out.key, res: out, tpl: P.tpl };
  return true;
}

export const calcGsOut = (P: EngineProject): GsRunResult | null =>
  _gsCache.res && _gsCache.tpl === P.tpl ? _gsCache.res : null;

export const calcGsStale = (P: EngineProject): boolean =>
  !!(calcGsOut(P) && _gsCache.key !== calcGsKey(P));

export const calcGsNeed = (P: EngineProject): boolean => {
  const R = calcRun(P);
  return !!(
    isCalcValid(R) &&
    R.g &&
    R.I &&
    (!calcGsOut(P) || calcGsStale(P))
  );
};

export function calcGsEnsure(P: EngineProject): boolean {
  return calcGsNeed(P) ? calcGsRunNow(P) : false;
}

export function calcGsRows(P: EngineProject, R: CalcRunResult | null | undefined) {
  const c = calcEnsure(P);
  const VR = isCalcValid(R) ? R : null;
  const cl = VR && VR.Ld ? calcGsClassic(VR) : null;
  const go = calcGsOut(P);
  const fo = calcFemOut(P);
  const fst = !!(fo && calcFemStale(P));
  const rows: GsRow[] = [];
  const fin = (v: number) => (isFinite(v) ? v : 1e9);
  const mk = (
    id: string,
    nm: string,
    how: string,
    fs: number | null,
    req: number,
    extra?: Partial<GsRow>,
  ) =>
    rows.push(
      Object.assign(
        { id, nm, how, fs, req, ok: fs == null ? null : fs >= req - 1e-9 },
        extra || {},
      ),
    );
  if (cl) {
    mk(
      'sl',
      'Trượt phẳng theo đáy móng',
      'sức kháng trượt / lực ngang, tải tiêu chuẩn',
      fin(cl.sd.Fsl),
      c.fsSl,
    );
    mk('ot', 'Lật quanh mũi', 'ΣM giữ / ΣM lật quanh mũi, tải tiêu chuẩn', fin(cl.sd.Fot), c.fsOt);
    if (cl.eq) {
      mk(
        'slE',
        'Trượt phẳng – có động đất',
        'giả tĩnh Mononobe-Okabe, tải tiêu chuẩn',
        fin(cl.eq.Fsl),
        c.fsSlE,
      );
      mk(
        'otE',
        'Lật quanh mũi – có động đất',
        'giả tĩnh Mononobe-Okabe, tải tiêu chuẩn',
        fin(cl.eq.Fot),
        c.fsOtE,
      );
    }
  }
  const b = go && go.bishop;
  mk(
    'bs',
    'Cung trượt tròn (Bishop)',
    VR && VR.W ? 'áp lực nước lỗ rỗng theo lời giải thấm 2D' : 'đất khô, không xét nước ngầm',
    b ? (b.none || !(b.FS != null && b.FS > 0) ? 0 : b.FS) : null,
    c.fsGs,
    b && (b.none || !(b.FS != null && b.FS > 0)) ? { note: 'không tìm được cung trượt hợp lệ' } : {},
  );
  const loc = !!(fo && fo.mech && fo.mech.local);
  const stN = fst ? 'FEM của lần chạy trước, số liệu đã đổi – chạy lại' : '';
  if (fo && fo.FSsrm != null) {
    mk(
      'srm',
      'FEM 2D – giảm cường độ (c, tanφ)',
      'đất Mohr-Coulomb, tường đàn hồi',
      fo.FSsrm,
      c.fsGs,
      loc || fst
        ? {
            info: true,
            note: [loc ? 'cơ chế cục bộ – không đại diện ổn định tổng thể' : '', stN]
              .filter(Boolean)
              .join('; '),
          }
        : {},
    );
  } else if (fo && c.femSrm) {
    mk(
      'srm',
      'FEM 2D – giảm cường độ (c, tanφ)',
      'đất Mohr-Coulomb, tường đàn hồi',
      0,
      c.fsGs,
      Object.assign(
        {
          note: ['không hội tụ ở F = 1: Fs < 1 hoặc mô hình chưa cân bằng', stN]
            .filter(Boolean)
            .join('; '),
        },
        fst ? { info: true } : {},
      ),
    );
  } else if (c.femSrm) {
    mk('srm', 'FEM 2D – giảm cường độ (c, tanφ)', 'đất Mohr-Coulomb, tường đàn hồi', null, c.fsGs);
  }
  const done = rows.filter((r) => r.ok != null && !r.info);
  const ok = done.length ? done.every((r) => r.ok) : null;
  const miss = rows.filter((r) => r.ok == null);
  return { rows, ok, complete: !miss.length, miss, cl, go, fo };
}

export const calcFemFailed = (P: EngineProject): boolean =>
  !!(
    _femCache.err &&
    _femCache.ekey &&
    _femCache.tpl === P.tpl &&
    _femCache.ekey === calcFemKey(P)
  );

export const calcFemNeed = (P: EngineProject): boolean => {
  const R = calcRun(P);
  return !!(
    isCalcValid(R) &&
    R.g &&
    R.I &&
    !_femCache.busy &&
    !calcFemCurrent(P) &&
    !calcFemFailed(P)
  );
};

export async function calcEnsureAll(
  P: EngineProject,
  say?: (msg: string) => void,
): Promise<CalcRunResult> {
  const c = calcEnsure(P);
  const tick = () => new Promise<void>((r) => setTimeout(r, 25));
  const notify = say || (() => {});
  let R = calcRun(P);
  if (!isCalcValid(R)) return R;
  if (c.feOn && calcFeStale(P)) {
    notify('Đang tính mô hình FE 3D…');
    await tick();
    if (calcFeEnsure(P)) R = calcRun(P);
  }
  if (calcGsNeed(P)) {
    notify('Đang tính ổn định tổng thể…');
    await tick();
    calcGsEnsure(P);
  }
  for (let k = 0; k < 4 && (_femCache.busy || calcFemNeed(P)); k++) {
    notify('Đang tính FEM 2D…');
    if (_femCache.busy) {
      const w0 = Date.now();
      await new Promise<void>((r) => {
        const t = setInterval(() => {
          if (!_femCache.busy || Date.now() - w0 > 15e4) {
            clearInterval(t);
            r();
          }
        }, 120);
      });
      if (_femCache.busy) break;
    } else if (
      !(await new Promise<boolean>((r) => {
        if (!calcFemRun(P, () => r(true))) r(false);
      }))
    ) {
      break;
    }
  }
  return calcRun(P);
}

export function calcRun(P: EngineProject): CalcRunResult {
  calcEnsure(P);
  const fcur = P.calc!.feOn && calcFeCurrent(P) && _feCache.fe && !_feCache.fe.err;
  const key = calcKey(P) + '#' + (fcur ? _feCache.id : 0);
  if (_calcCache.key === key && _calcCache.res) return _calcCache.res;
  let res: CalcRunResult;
  try {
    const g = calcGeomP(P);
    const I = calcInputs(P, g);
    const c = P.calc!;
    if (P.type === 'rib') {
      res = calcRibRun(P, I, g) as RibCalcResult;
    } else {
      const base = CALC.calc(I, g) as CantiCalcResult;
      base.P = P;
      base.model = 'canti';
      res = base;
    }
    if (fcur && _feCache.fe) {
      const fe0 = _feCache.fe;
      const basis: 'fe' | 'hand' = c.feBasis === 'fe' ? 'fe' : 'hand';
      if (basis === 'fe' && P.type === 'rib' && fe0.prof) {
        const hand = res as RibCalcResult;
        const r2 = calcRibRun(P, I, g, CFE.ribProvider(fe0.prof)) as RibCalcResult;
        r2.hand = { rib: hand.rib, ok: hand.ok };
        res = r2;
      }
      const fe = CFE.check(res, fe0);
      fe.basis = basis;
      res.fe = fe;
      if (basis === 'fe') {
        res.ok.fe = !!fe.ok;
        res.ok.all = Object.entries(res.ok)
          .filter(([k]) => k !== 'all')
          .every(([, v]) => Boolean(v));
        if (res.model === 'rib' && res.checks) {
          res.checks.push({
            id: 'fe',
            t: 'Mô hình FE – các mặt cắt',
            v: fe.util || 0,
            ok: !!fe.ok,
          });
        }
      }
    }
    if (I.bsOn) {
      const sp = res.W && res.W.seep ? { level: res.W.seep.level, uFn: res.W.seep.uAt } : {};
      res.slope = SLOPE.run(res, Object.assign({ T: I.bsT, phiR: I.bsPhiR }, sp));
      res.ok.slope = res.slope.ok;
      res.ok.all = Object.entries(res.ok)
        .filter(([k]) => k !== 'all')
        .every(([, v]) => Boolean(v));
    }
  } catch (e: unknown) {
    res = { error: String((e && (e as Error).message) || e) };
  }
  _calcCache = { key, res };
  return res;
}

export function calcSuggest(
  P: EngineProject,
  R: CalcRunResult | null | undefined,
): EngineSuggestItem[] {
  if (!isCalcValid(R)) return [];
  if (R.model === 'rib') return calcSuggestRib(P, R);
  if (!R.C || R.model !== 'canti') return [];

  const E = CALC;
  const M = R.M;
  const I = R.I;
  const g = R.g;
  const rm = calcRebarMap(P);
  const items: EngineSuggestItem[] = [];

  const runStem = (sb: { d: number; a: number }, sf: { d: number; a: number }) => {
    const S = Object.assign({}, R.st.Sb!, {
      f1: E.bars(sb.d, sb.a * 10, I.cov),
      f2: E.bars(sf.d, sf.a * 10, I.cov),
    });
    const U = R.st.UE;
    const rc = E.RC.run(S, M, [
      { id: 'CĐ I', st: 'CD', M: R.st.Ib.M, V: R.st.Ib.Q, N: R.st.Ib.N },
      ...(U ? [{ id: 'CĐ ĐB', st: 'DB', M: U.M, V: U.Q, N: U.N }] : []),
      { id: 'SD I', st: 'SD', M: R.st.SD.M, V: R.st.SD.Q, N: R.st.SD.N },
    ]);
    const ifc = E.iface(
      I,
      g,
      Object.assign({}, R.st, { Sb: S }),
      0.9 * I.gc * E.cent(g.stem).A,
    );
    return { ok: E.rcOK(rc) && ifc.ok && ifc.okMin, rc, ifc };
  };

  const runFoot = (
    o: CalcCoreResult['toe'],
    fb: { d: number; a: number },
    ft: { d: number; a: number },
  ) => {
    const S = Object.assign({}, R.Sf, {
      f1: E.bars(fb.d, fb.a * 10, I.covB),
      f2: E.bars(ft.d, ft.a * 10, I.covT != null ? I.covT : I.cov),
    });
    const rc = E.RC.run(S, M, [
      { id: 'CĐ', st: 'CD', M: o.U!.M, V: o.U!.V, N: 0 },
      ...(o.UE ? [{ id: 'CĐ ĐB', st: 'DB', M: o.UE.M, V: o.UE.V, N: 0 }] : []),
      { id: 'SD I', st: 'SD', M: o.SD.M, V: o.SD.V, N: 0 },
    ]);
    return { ok: E.rcOK(rc), rc };
  };

  const shr = (d: number, a: number, b: number, h: number) =>
    E.shrink(I, b, h, E.RC.bar(d) / (a * 10), a * 10);

  const sbCur = { d: rm.sb.d, a: rm.sb.a || 20 };
  const sfCur = { d: rm.sf.d, a: rm.sf.a || 20 };
  const fbCur = { d: rm.fb.d, a: rm.fb.a || 20 };
  const ftCur = { d: rm.ft.d, a: rm.ft.a || 20 };

  const mk = (
    id: string,
    title: string,
    path: string | null,
    cur: { d: number; a: number },
    ok: boolean,
    sug: EngineSuggestItem['sug'],
    why: string,
  ) =>
    items.push({
      id,
      title,
      path,
      cur: { d: cur.d, a: cur.a },
      ok,
      sug: ok ? null : sug,
      why: ok ? '' : sug ? '' : why,
    });

  {
    const okNow = runStem(sbCur, sfCur).ok;
    let sug = null;
    if (!okNow) sug = calcFindBars(sbCur, (c) => runStem(c, sfCur).ok);
    mk(
      's1',
      'Thép đứng thân – mặt sau',
      rm.path.sb,
      sbCur,
      okNow,
      sug,
      'Không đạt dù tăng cốt thép: cần tăng bề dày thân tường.',
    );
    const sbUse = sug || sbCur;
    const okF = runStem(sbUse, sfCur).ok;
    let sugF = null;
    if (!okF) sugF = calcFindBars(sfCur, (c) => runStem(sbUse, c).ok);
    mk(
      's2',
      'Thép đứng thân – mặt trước',
      rm.path.sf,
      sfCur,
      okF,
      sugF,
      'Không đạt dù tăng cốt thép mặt trước.',
    );
  }
  {
    const okT = runFoot(R.toe, fbCur, ftCur).ok;
    let sug = null;
    if (!okT) sug = calcFindBars(fbCur, (c) => runFoot(R.toe, c, ftCur).ok);
    mk(
      'b1',
      'Thép bản đáy – lớp dưới (mũi)',
      rm.path.fb,
      fbCur,
      okT,
      sug,
      'Không đạt dù tăng cốt thép: cần tăng bề dày bản đáy.',
    );
    const fbUse = sug || fbCur;
    const okH = runFoot(R.heel, fbUse, ftCur).ok;
    let sugH = null;
    if (!okH) sugH = calcFindBars(ftCur, (c) => runFoot(R.heel, fbUse, c).ok);
    mk(
      'b2',
      'Thép bản đáy – lớp trên (gót)',
      rm.path.ft,
      ftCur,
      okH,
      sugH,
      'Không đạt dù tăng cốt thép: cần tăng bề dày bản đáy.',
    );
  }
  {
    const hC = { d: rm.hh.d, a: rm.hh.a || 20 };
    const lC = { d: rm.ll.d, a: rm.ll.a || 20 };
    const okS = shr(hC.d, hC.a, g.Hst * 1e3, g.tmean * 1e3).ok;
    let sg = null;
    if (!okS) sg = calcFindBars(hC, (c) => shr(c.d, c.a, g.Hst * 1e3, g.tmean * 1e3).ok);
    mk(
      'h1',
      'Thép ngang thân tường (co ngót, nhiệt độ)',
      rm.path.hh,
      hC,
      okS,
      sg,
      'Không xác định được phương án.',
    );
    const okL = shr(lC.d, lC.a, g.B * 1e3, I.hm * 1e3).ok;
    let sl = null;
    if (!okL) sl = calcFindBars(lC, (c) => shr(c.d, c.a, g.B * 1e3, I.hm * 1e3).ok);
    mk(
      'l1',
      'Thép dọc bản đáy (co ngót, nhiệt độ)',
      rm.path.ll,
      lC,
      okL,
      sl,
      'Không xác định được phương án.',
    );
  }
  return items;
}

export function calcApplyFixes(P: EngineProject, items: EngineSuggestItem[]): void {
  items.forEach((it) => {
    if (!it.sug || !it.path) return;
    const o = getp(P, it.path);
    o.d = it.sug.d;
    if (it.sug.a != null) o.a = it.sug.a;
    if (it.sug.n != null) o.n = it.sug.n;
  });
}

export function calcHeelHint(P: EngineProject): number | null {
  const R0 = calcRun(P);
  if (!isCalcValid(R0) || !R0.ok || (R0.ok.e && R0.ok.sl && R0.ok.br))
    return null;
  for (let add = 5; add <= 400; add += 5) {
    const P2 = JSON.parse(JSON.stringify(P)) as EngineProject;
    P2.heel += add;
    const R = calcRun(P2);
    if (isCalcValid(R) && R.ok && R.ok.e && R.ok.sl && R.ok.br) {
      calcRun(P);
      return add;
    }
  }
  calcRun(P);
  return null;
}

export function calcChecks(R: CalcRunResult | null | undefined): EngineCheckItem[] {
  if (!isCalcValid(R) || !R.ok) return [];
  const fin = (v: number) => (isFinite(v) ? v : 0);
  const rcR = (rc: {
    gM: { rM: number } | null;
    gV: { rV: number } | null;
    minR: { lim: number; Mr: number } | null;
    cr: { sb: number; smax: number } | null;
  }) =>
    Math.max(
      rc.gM ? fin(1 / rc.gM.rM) : 0,
      rc.gV ? fin(1 / rc.gV.rV) : 0,
      rc.minR ? fin(rc.minR.lim / Math.max(rc.minR.Mr, 1e-9)) : 0,
      rc.cr ? fin(rc.cr.sb / rc.cr.smax) : 0,
    );

  let L: EngineCheckItem[];
  if (R.model === 'rib') {
    L = (R.checks || []).filter((x) => x.id !== 'pip' && x.id !== 'slope');
  } else {
    L = calcGlobalChecks(R).filter((x) => x.id !== 'pip');
    L.push(
      { id: 'stem', t: 'Thân tường', v: rcR(R.st.rc!), ok: R.ok.stem },
      {
        id: 'ifc',
        t: 'Mối nối chân tường',
        v: Math.max(
          R.ifc.Vu / Math.max(R.ifc.Vr, 1e-9),
          R.ifc.Ve ? R.ifc.Ve / Math.max(R.ifc.Vn, 1e-9) : 0,
          R.ifc.Avmin / Math.max(R.ifc.Avf, 1e-9),
        ),
        ok: R.ok.ifc,
      },
      { id: 'toe', t: 'Bản đáy – mũi', v: rcR(R.toe.rc!), ok: R.ok.toe },
      { id: 'heel', t: 'Bản đáy – gót', v: rcR(R.heel.rc!), ok: R.ok.heel },
      {
        id: 'sh',
        t: 'Cốt thép co ngót',
        v: Math.max(
          R.shS.req / R.shS.As,
          R.shS.s / R.shS.smax,
          R.shF.req / R.shF.As,
          R.shF.s / R.shF.smax,
        ),
        ok: R.ok.sh,
      },
    );
  }
  if (R.fe && R.model !== 'rib' && R.fe.basis === 'fe') {
    L.push({ id: 'fe', t: 'Mô hình FE – các mặt cắt', v: R.fe.util || 0, ok: !!R.fe.ok });
  }
  if (R.fe && R.fe.basis !== 'fe') {
    L.push({ id: 'fe', t: 'Mô hình FE (đối chiếu)', v: R.fe.util || 0, ok: !!R.fe.ok, info: true });
  }
  const ex: EngineCheckItem[] = [];
  const p = R.W && R.W.pip;
  if (p && (p.kind === 'avg' || p.kind === 'prism')) {
    ex.push({
      id: 'pip',
      t: 'Xói ngầm',
      v: isFinite(p.FS) && p.FS > 0 ? p.FSreq / p.FS : 0,
      ok: !!R.ok.pip,
    });
  }
  if (R.slope) {
    ex.push({
      id: 'slope',
      t: 'Ổn định tổng thể',
      v:
        R.slope.none || !(R.slope.FS != null && R.slope.FS > 0)
          ? 99
          : R.slope.FSreq / R.slope.FS,
      ok: !!R.ok.slope,
    });
  }
  if (ex.length) {
    let at = 0;
    L.forEach((x, i) => {
      if (['e', 'sl', 'br', 'an'].indexOf(x.id) >= 0) at = i + 1;
    });
    L.splice(at, 0, ...ex);
  }
  return L;
}

export function calcBadgeCount(R: CalcRunResult | null | undefined): number {
  if (!isCalcValid(R)) return 0;
  return calcChecks(R).filter((x) => !x.ok && !x.info).length;
}

export function calcBadgeStatus(
  R: CalcRunResult | null | undefined,
  P?: EngineProject,
): { count: number; pending: boolean; text: string; cls: 'bad' | 'ok' | '' } {
  if (!isCalcValid(R)) return { count: 0, pending: false, text: '', cls: '' };
  const bad = calcBadgeCount(R);
  const pend = P ? calcFeStale(P) : false;
  return {
    count: bad,
    pending: pend,
    text: bad ? '✗ ' + bad : pend ? '…' : '✓',
    cls: bad ? 'bad' : pend ? '' : 'ok',
  };
}

export function resetEngineCaches(): void {
  _calcCache = { key: '', res: null };
  _feCache = { key: '', fe: null, id: 0 };
  _gsCache = { key: '', res: null, tpl: '' };
  if (_femWorker && typeof _femWorker.terminate === 'function') {
    _femWorker.terminate();
  }
  _femWorker = null;
  _femPend = null;
  _femCache = {
    key: '',
    ekey: '',
    out: null,
    err: '',
    tpl: '',
    busy: false,
    t0: 0,
    ms: 0,
    nth: 0,
  };
}
