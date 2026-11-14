/**
 * BangTinhCauCong Web App — Reinforced Concrete Rectangular & Circular P-M / P-M-M Solvers
 *
 * Exact clean-room TypeScript port of:
 *  - Shared Rectangular RC Solver (`RC` / `rcMat` / `rcSec` / `rcRender` from Module 03:2060-2471)
 *  - Circular Column P-M Solver (`REBAR_AREA_02`, `section`, `CDL`, `curve`, `interp`, `phiMnAt`, `COMB`, `loadsOf` from Module 02:1-300)
 *  - 3D Fiber P-M-M Biaxial Interaction Solver (`pt3`, `mer3`, `atP`, `capDir`, `compute3`, `fig3`, `render3` from Module 12:3660-3895)
 *  - Circular Column / Pile Flexural-Shear-Slenderness Runner (`tab3Step` from Module 11:4007-4360)
 */

import {
  REBAR_AREA_02,
  type CircularPmCurveResult,
  type CircularPmPoint,
  type ContextPrefix,
  type LimitStateType,
  type Pm3dSurfaceResult,
  type RcComboRow,
  type RcCrackResult,
  type RcFlexResult,
  type RcMaterialProps,
  type RcMinFlexCheck,
  type RcSectionInput,
  type RcSectionResult,
  type RcShearResult,
} from '../../types/project';
import {
  $,
  FR,
  KEYS,
  TB,
  TH_E,
  TH_V,
  TT,
  bilin,
  contextState,
  fx,
  getIDP,
  getVisualHooks,
  num,
  parseSum,
  set,
  sv,
  v,
  type ParsedSummaryMap,
  type ParsedSummaryRow,
} from '../context';

export { REBAR_AREA_02, TH_V, TH_E, TT, TB, bilin };

// ---------------------------------------------------------------------------
// 1. Rectangular Reinforced Concrete Solver (`RC` — TCVN 11823-5:2017, Mod 03)
// ---------------------------------------------------------------------------

export interface RcMaterialRawInput {
  fc: number;
  fy: number;
  Es: number;
  K1: number;
  wc: number;
  ag: number;
  ge: number;
  g1: number;
  g3: number;
  ecl: number;
  etl: number;
}

export interface RcLoadInput {
  id: string;
  st: LimitStateType;
  M: number;
  V: number;
  N: number;
}

export interface RcSectionCheckWithOk extends RcSectionResult {
  ok: boolean;
}

export const STN: Readonly<Record<LimitStateType, string>> = {
  CD: 'Cường độ',
  SD: 'Sử dụng',
  DB: 'Đặc biệt',
};

export function rcBarArea(d: number): number {
  return (Math.PI * d * d) / 4;
}

export function rcMatCalc(m: RcMaterialRawInput): RcMaterialProps {
  const fc = m.fc;
  const b1 = Math.min(0.85, Math.max(0.65, 0.85 - (0.05 * (fc - 28)) / 7));
  const Ec = 0.0017 * m.K1 * m.wc * m.wc * Math.pow(fc, 0.33);
  return {
    ...m,
    Ec,
    fr: 0.63 * Math.sqrt(fc),
    b1,
    a1: 0.85,
    n: m.Es / Ec,
  };
}

export function rcFlex(S: RcSectionInput, M: RcMaterialProps, pos: boolean): RcFlexResult {
  const T = pos ? S.f1 : S.f2;
  const C = pos ? S.f2 : S.f1;
  const b = S.b;
  const h = S.h;
  const As = T.n * rcBarArea(T.d);
  const ds = h - T.dc;
  const Asc = C.n * rcBarArea(C.d);
  const dsc = C.dc;
  const fc = M.fc;
  const fy = M.fy;
  const Es = M.Es;
  const ecu = 0.003;

  const F = (c: number) => {
    const a = Math.min(M.b1 * c, h);
    const Cc = M.a1 * fc * a * b;
    const fs = Math.max(-fy, Math.min(fy, (Es * ecu * (ds - c)) / c));
    const fsc = Math.max(-fy, Math.min(fy, (Es * ecu * (c - dsc)) / c));
    return { a, Cc, fs, fsc, R: Cc + Asc * fsc - As * fs };
  };

  let lo = 1e-6;
  let hi = h;
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2;
    if (F(mid).R > 0) hi = mid;
    else lo = mid;
  }

  const c = (lo + hi) / 2;
  const r = F(c);
  const Mn = (As * r.fs * (ds - r.a / 2) + Asc * r.fsc * (r.a / 2 - dsc)) / 1e6;
  const et = (ecu * (ds - c)) / c;
  const phi = Math.max(0.75, Math.min(0.9, 0.75 + (0.15 * (et - M.ecl)) / (M.etl - M.ecl)));

  return {
    As,
    ds,
    Asc,
    dsc,
    c,
    a: r.a,
    fs: r.fs,
    fsc: r.fsc,
    Mn,
    et,
    phi,
    type: et >= M.etl ? 3 : et <= M.ecl ? 1 : 2,
    ylim: c / ds <= 0.003 / (0.003 + M.ecl),
  };
}

export function rcCrack(S: RcSectionInput, M: RcMaterialProps, Ms: number): RcCrackResult {
  const pos = Ms >= 0;
  const T = pos ? S.f1 : S.f2;
  const As = T.n * rcBarArea(T.d);
  const de = S.h - T.dc;
  const rho = As / (S.b * de);
  const n = M.n;
  const k = Math.sqrt((rho * n) ** 2 + 2 * rho * n) - rho * n;
  const j = 1 - k / 3;
  const fss0 = (Math.abs(Ms) * 1e6) / (As * j * de);
  const fss = Math.min(fss0, 0.6 * M.fy);
  const bs = 1 + T.dc / (0.7 * (S.h - T.dc));
  const smax = fss > 0 ? (123000 * M.ge) / (bs * fss) - 2 * T.dc : Infinity;
  const Sg = (S.b * S.h * S.h) / 6;
  const fct = (Math.abs(Ms) * 1e6) / Sg;

  return {
    As,
    de,
    rho,
    k,
    j,
    fss0,
    fss,
    bs,
    smax,
    fct,
    sb: T.s,
    need: fct > 0.8 * M.fr,
    ok: T.s <= smax,
  };
}

export function rcShear(
  S: RcSectionInput,
  M: RcMaterialProps,
  Mu: number,
  Vu: number,
  Nu: number,
  phiV: number,
  fl: RcFlexResult,
): RcShearResult {
  const T = Mu >= 0 ? S.f1 : S.f2;
  const As = T.n * rcBarArea(T.d);
  const de = S.h - T.dc;
  const b = S.b;
  const h = S.h;
  const fc = M.fc;
  const dv = Math.max(de - fl.a / 2, 0.9 * de, 0.72 * h);
  const Av = S.st.n * rcBarArea(S.st.d);
  const s = S.st.s;
  const Avmin = (0.083 * Math.sqrt(fc) * b * s) / M.fy;
  const V = Math.abs(Vu) * 1e3;
  const Mabs = Math.max(Math.abs(Mu) * 1e6, V * dv);
  const N = Nu * 1e3; // Nu > 0 is tension
  let es = (Mabs / dv + 0.5 * N + V) / (M.Es * As);
  if (es < 0) es = (Mabs / dv + 0.5 * N + V) / (M.Es * As + (M.Ec * b * h) / 2);
  es = Math.max(-0.0004, Math.min(0.006, es));
  const sxe = Math.max(294, Math.min(2000, (dv * 35) / (M.ag + 16)));
  const hasMin = Av > 0 && Av >= Avmin;
  const beta = (4.8 / (1 + 750 * es)) * (hasMin ? 1 : 1300 / (1000 + sxe));
  const th = 29 + 3500 * es;
  const Vc = (0.083 * beta * Math.sqrt(fc) * b * dv) / 1e3;
  const Vs = Av > 0 ? (Av * M.fy * dv) / Math.tan((th * Math.PI) / 180) / s / 1e3 : 0;
  const Vlim = (0.25 * fc * b * dv) / 1e3;
  const Vn = Math.min(Vc + Vs, Vlim);
  const Vr = phiV * Vn;
  const vu = V / (phiV * b * dv);
  const smax = vu < 0.125 * fc ? Math.min(0.8 * dv, 600) : Math.min(0.4 * dv, 300);

  return {
    As,
    de,
    dv,
    Av,
    Avmin,
    hasMin,
    es,
    sxe,
    beta,
    th,
    Vc,
    Vs,
    Vlim,
    Vn,
    Vr,
    vu,
    smax,
    needSt: Math.abs(Vu) > 0.5 * phiV * Vc,
    ok: Vr >= Math.abs(Vu),
  };
}

export function rcRun(
  S: RcSectionInput,
  M: RcMaterialProps,
  L: readonly RcLoadInput[],
): RcSectionResult {
  const rows: RcComboRow[] = L.map((l) => {
    const fl = rcFlex(S, M, l.M >= 0);
    const phi = l.st === 'DB' ? 1.0 : fl.phi;
    const Mr = phi * fl.Mn;
    const sh = rcShear(S, M, l.M, l.V, -l.N, l.st === 'DB' ? 1.0 : 0.9, fl);
    return {
      ...l,
      fl,
      phi,
      Mr,
      rM: Math.abs(l.M) > 1e-9 ? Mr / Math.abs(l.M) : Infinity,
      sh,
      rV: Math.abs(l.V) > 1e-9 ? sh.Vr / Math.abs(l.V) : Infinity,
    };
  });

  const U = rows.filter((r) => r.st !== 'SD');
  const svRows = rows.filter((r) => r.st === 'SD');
  const gM = U.reduce<RcComboRow | null>((p, q) => (!p || q.rM < p.rM ? q : p), null);
  const gV = U.reduce<RcComboRow | null>((p, q) => (!p || q.rV < p.rV ? q : p), null);
  const gS = svRows.reduce<RcComboRow | null>(
    (p, q) => (!p || Math.abs(q.M) > Math.abs(p.M) ? q : p),
    null,
  );

  const Sg = (S.b * S.h * S.h) / 6;
  const Mcr = (M.g3 * M.g1 * M.fr * Sg) / 1e6;
  const gMc =
    rows.filter((r) => r.st === 'CD').reduce<RcComboRow | null>(
      (p, q) => (!p || q.rM < p.rM ? q : p),
      null,
    ) || gM;

  const minR: RcMinFlexCheck | null = gMc
    ? {
        Mcr,
        Mu: Math.abs(gMc.M),
        lim: Math.min(Mcr, 1.33 * Math.abs(gMc.M)),
        Mr: gMc.Mr,
        ok: gMc.Mr >= Math.min(Mcr, 1.33 * Math.abs(gMc.M)),
        id: gMc.id,
      }
    : null;

  const cr = gS ? rcCrack(S, M, gS.M) : null;
  return {
    rows,
    gM,
    gV,
    gS,
    minR,
    cr,
    Ag: S.b * S.h,
    Ig: (S.b * S.h ** 3) / 12,
    Sg,
  };
}

/** Exact namespace parity mirror of `RC` in `03_abutment_loads_and_rc.js`. */
export const RC = {
  mat: rcMatCalc,
  bar: rcBarArea,
  flex: rcFlex,
  crack: rcCrack,
  shear: rcShear,
  run: rcRun,
} as const;

export function rcMat(): RcMaterialProps {
  const g = (id: string) => num(id);
  const fy = +v('rc_grade', '400') || 400;
  const fuMap: Record<number, number> = { 300: 450, 400: 570, 500: 650 };
  const fu = fuMap[fy] || fy / 0.7;
  const ecl = fy <= 420 ? 0.002 : Math.min(0.004, 0.002 + (0.002 * (fy - 420)) / 270);
  const etl = fy <= 420 ? 0.005 : Math.min(0.008, 0.005 + (0.003 * (fy - 420)) / 270);
  const wc = (num('mo_gcT') || 2.5) * 1000;
  const ge = v('rc_exp', '1') === '1' ? 1.0 : 0.75;

  const M = RC.mat({
    fc: g('rc_fc'),
    fy,
    Es: 200000,
    K1: g('rc_K1'),
    wc,
    ecl,
    etl,
    ag: g('rc_ag'),
    g1: 1.6,
    g3: fy / fu,
    ge,
  });

  set('o_rcfy', fx(fy, 0));
  set('o_rcfu', fx(fu, 0));
  set('o_rcEs', '200000');
  set('o_rcwc', fx(wc, 0));
  set('o_rcecl', fx(ecl, 4));
  set('o_rcetl', fx(etl, 4));
  set('o_rcg1', '1.60');
  set('o_rcg3', fx(fy / fu, 3));
  set('o_rcge', fx(ge, 2));
  set('o_rcEc', fx(M.Ec, 2));
  set('o_rcfr', fx(M.fr, 3));
  set('o_rcb1', fx(M.b1, 4));
  set('o_rcn', fx(M.n, 3));
  return M;
}

export function rcSec(pf: string, b: number, h: number): RcSectionInput {
  const g = (k: string) => num(`rc_${pf}${k}`);
  const nb = (q: '1' | '2') => {
    const s = g(`${q}s`);
    const a = g(`${q}a`);
    const n = s > 0 && b - 2 * a >= 0 ? Math.floor((b - 2 * a) / s + 1e-6) + 1 : 0;
    set(`o_rc${pf}${q}n`, String(n));
    return n;
  };
  return {
    b,
    h,
    f1: { n: nb('1'), s: g('1s'), d: g('1d'), dc: g('1c') },
    f2: { n: nb('2'), s: g('2s'), d: g('2d'), dc: g('2c') },
    st: { s: g('ss') || 1, d: g('sd'), n: g('sn') },
  };
}

/**
 * Pure section check returning `{ ...RC.run(...), ok }` with identical pass/fail rules
 * as `rcRender` (flexure, minimum reinforcement, crack spacing, shear, shrinkage/temp §10.8,
 * and footing stirrup exemption `/^(c1|c2|bn|bp)$/`).
 */
export function calcRcSection(
  pf: string,
  S: RcSectionInput,
  M: RcMaterialProps,
  L: readonly RcLoadInput[],
): RcSectionCheckWithOk | null {
  if (!L.length || !(S.b > 0 && S.h > 0)) return null;
  const R = RC.run(S, M, L);
  let ok = true;

  for (const r of R.rows) {
    if (r.st === 'SD') continue;
    ok = ok && r.rM >= 1;
  }
  if (R.minR) ok = ok && R.minR.ok;
  if (R.cr) ok = ok && R.cr.ok;
  for (const r of R.rows) {
    if (r.st === 'SD') continue;
    ok = ok && r.sh.ok;
  }

  // §10.8 shrinkage & temperature reinforcement
  const fyT = Math.min(M.fy || 400, 520);
  const Ast = Math.min(1.27, Math.max(0.233, (0.75 * S.b * S.h) / (2 * (S.b + S.h) * fyT)));
  const sT = S.h > 450 ? 300 : Math.min(3 * S.h, 450);
  const okT = [S.f1, S.f2].every((f) => {
    const a = f.n > 0 ? (f.n * RC.bar(f.d)) / S.b : 0;
    return a >= Ast - 1e-9 && f.s <= sT + 1e-9;
  });
  ok = ok && okT;

  const gv = R.gV;
  if (gv) {
    const h = gv.sh;
    const foot = /^(c1|c2|bn|bp)$/.test(pf);
    if (h.needSt && !h.hasMin && !foot) ok = false;
    if (S.st.n > 0 && S.st.s > h.smax) ok = false;
  }

  return { ...R, ok };
}

export function rcRender(
  pf: string,
  S: RcSectionInput,
  M: RcMaterialProps,
  L: readonly RcLoadInput[],
  f1: string,
  f2: string,
): RcSectionCheckWithOk | null {
  const oId = (id: string) => `o_rc${pf}${id}`;
  const setO = (id: string, val: string | number, d = 2) => {
    set(oId(id), typeof val === 'string' ? val : fx(val, d));
  };
  const okcNote = (id: string, isOk: boolean, text?: string) => {
    const full = oId(id);
    set(full, text || (isOk ? 'OK' : 'NG'));
    const el = $(full);
    if (el) el.className = `note ${isOk ? 'ok' : 'bad'}`;
  };

  setO('h', S.h, 0);
  setO('b', S.b, 0);
  setO('Ag', (S.b * S.h).toExponential(3));
  setO('Ig', ((S.b * S.h ** 3) / 12).toExponential(3));
  setO('1A', S.f1.n * RC.bar(S.f1.d), 1);
  setO('2A', S.f2.n * RC.bar(S.f2.d), 1);

  let t =
    '<tr><th>TT</th><th colspan="2">Tổ hợp</th><th>TTGH</th><th>N (kN)</th><th>V (kN)</th><th>M (kN.m)</th></tr>';
  L.forEach((l, i) => {
    t += `<tr><td class="c">${i + 1}</td><td class="l" colspan="2">${l.id}</td><td class="c">${STN[l.st]}</td><td>${fx(l.N, 2)}</td><td>${fx(l.V, 2)}</td><td>${fx(l.M, 2)}</td></tr>`;
  });
  set(`tbRC${pf}F`, t);

  if (!L.length || !(S.b > 0 && S.h > 0)) return null;
  const R = RC.run(S, M, L);
  let ok = true;

  t =
    '<tr><th>TT</th><th colspan="2">Tổ hợp</th><th>Mu (kN.m)</th><th>c (mm)</th><th>εt</th><th>φ</th><th>Mr (kN.m)</th><th>Mr/Mu</th><th>Kết luận</th></tr>';
  R.rows.forEach((r, i) => {
    if (r.st === 'SD') return;
    const g = r.rM >= 1;
    ok = ok && g;
    t += `<tr><td class="c">${i + 1}</td><td class="l" colspan="2">${r.id}</td><td>${fx(r.M, 2)}</td><td>${fx(r.fl.c, 1)}</td><td>${fx(r.fl.et, 4)}</td><td>${fx(r.phi, 3)}</td><td>${fx(r.Mr * (r.M < 0 ? -1 : 1), 2)}</td><td>${Number.isFinite(r.rM) ? fx(r.rM, 2) : '-'}</td><td class="c ${g ? 'ok' : 'bad'}">${g ? 'OK' : 'NG'}</td></tr>`;
  });
  set(`tbRC${pf}M`, t);

  const gm = R.gM;
  if (gm) {
    const f = gm.fl;
    setO('gM', gm.id);
    setO('gMf', gm.M >= 0 ? f1 : f2);
    setO('As', f.As, 1);
    setO('Asc', f.Asc, 1);
    setO('ds', f.ds, 0);
    setO('dsc', f.dsc, 0);
    setO('c', f.c, 2);
    setO('a', f.a, 2);
    setO('fs', f.fs, 1);
    setO('fsc', f.fsc, 1);
    setO('et', f.et, 5);
    setO('ty', String(f.type));
    setO('phi', gm.phi, 3);
    setO('Mn', f.Mn, 2);
    setO('Mr', gm.Mr, 2);
    setO('Mu', Math.abs(gm.M), 2);
    okcNote('Mun', gm.Mr >= Math.abs(gm.M));
  }

  const mr = R.minR;
  if (mr) {
    setO('Sc', R.Sg.toExponential(3));
    setO('Mcr', mr.Mcr, 2);
    setO('133', 1.33 * mr.Mu, 2);
    setO('mn', mr.lim, 2);
    setO('Mr2', mr.Mr, 2);
    okcNote('Mr2n', mr.ok, mr.ok ? 'OK' : 'NG');
    ok = ok && mr.ok;
  }

  const cr = R.cr;
  if (cr && R.gS) {
    setO('gS', R.gS.id);
    setO('Ms', Math.abs(R.gS.M), 2);
    setO('fct', cr.fct, 3);
    setO('fr8', 0.8 * M.fr, 3);
    set(oId('fctn'), cr.need ? 'Nứt' : 'Không nứt');
    const fe = $(oId('fctn'));
    if (fe) fe.className = 'note';
    setO('rho', cr.rho, 5);
    setO('kk', cr.k, 3);
    setO('jj', cr.j, 3);
    setO('fss', cr.fss, 2);
    setO('bs', cr.bs, 3);
    setO('ge', M.ge, 2);
    setO('smax', Number.isFinite(cr.smax) ? fx(cr.smax, 1) : '∞');
    setO('sb', cr.sb, 0);
    okcNote('sbn', cr.ok);
    ok = ok && cr.ok;
  }

  t =
    '<tr><th>TT</th><th colspan="2">Tổ hợp</th><th>Vu (kN)</th><th>Mu (kN.m)</th><th>εs (‰)</th><th>β</th><th>θ (độ)</th><th>Vr (kN)</th><th>Kết luận</th></tr>';
  R.rows.forEach((r, i) => {
    if (r.st === 'SD') return;
    const g = r.sh.ok;
    ok = ok && g;
    t += `<tr><td class="c">${i + 1}</td><td class="l" colspan="2">${r.id}</td><td>${fx(r.V, 2)}</td><td>${fx(r.M, 2)}</td><td>${fx(r.sh.es * 1000, 3)}</td><td>${fx(r.sh.beta, 3)}</td><td>${fx(r.sh.th, 2)}</td><td>${fx(r.sh.Vr, 1)}</td><td class="c ${g ? 'ok' : 'bad'}">${g ? 'OK' : 'NG'}</td></tr>`;
  });

  {
    const fyT = Math.min(M.fy || 400, 520);
    const Ast = Math.min(1.27, Math.max(0.233, (0.75 * S.b * S.h) / (2 * (S.b + S.h) * fyT)));
    const sT = S.h > 450 ? 300 : Math.min(3 * S.h, 450);
    const fcChecks = (
      [
        [f1, S.f1],
        [f2, S.f2],
      ] as const
    ).map(([nm, f]) => {
      const a = f.n > 0 ? (f.n * RC.bar(f.d)) / S.b : 0;
      const okA = a >= Ast - 1e-9 && f.s <= sT + 1e-9;
      return { nm, a, s: f.s, okA };
    });
    const okT = fcChecks.every((q) => q.okA);
    ok = ok && okT;
    t += `<tr><td class="l" colspan="10">Cốt thép co ngót, nhiệt độ (TCVN 11823-5, Điều 10.8; Phần 11, Điều 6.1.5.1): As ≥ 0,75bh/(2(b + h)fy) = ${fx(Ast, 3)} mm2/mm (0,233 ≤ As ≤ 1,27), s ≤ ${fx(sT, 0)} mm. ${fcChecks.map((q) => `${q.nm}: ${fx(q.a, 3)} mm2/mm, s = ${fx(q.s, 0)} mm - ${q.okA ? 'OK' : 'NG'}`).join(' ; ')}.</td></tr>`;
  }
  set(`tbRC${pf}V`, t);

  const gv = R.gV;
  if (gv) {
    const h = gv.sh;
    const phiV = gv.st === 'DB' ? 1 : 0.9;
    setO('gV', gv.id);
    setO('Vu', Math.abs(gv.V), 2);
    setO('Mu2', Math.abs(gv.M), 2);
    setO('Nu', -gv.N, 2);
    setO('dv', h.dv, 1);
    setO('bv', S.b, 0);
    setO('Av', h.Av, 1);
    setO('Avm', h.Avmin, 1);
    setO('es', h.es, 6);
    setO('sxe', h.sxe, 1);
    setO('bt', h.beta, 3);
    setO('th', h.th, 2);
    setO('Vc', h.Vc, 2);
    setO('Vs', h.Vs, 2);
    setO('Vl', h.Vlim, 1);
    setO('Vn', h.Vn, 2);
    setO('phiV', phiV, 2);
    setO('Vr', h.Vr, 2);
    okcNote('Vrn', h.ok);
    setO('half', 0.5 * phiV * h.Vc, 2);

    const need = h.needSt;
    const foot = /^(c1|c2|bn|bp)$/.test(pf);
    const halfnText = need
      ? h.hasMin
        ? 'Đã đủ'
        : foot
          ? 'Không bắt buộc (đế móng, Điều 8.2.4)'
          : 'Cần đai'
      : 'Không cần';
    set(oId('halfn'), halfnText);
    const hnEl = $(oId('halfn'));
    if (hnEl) hnEl.className = `note ${need && !h.hasMin && !foot ? 'bad' : 'ok'}`;
    if (need && !h.hasMin && !foot) ok = false;

    setO('ssm', S.st.n > 0 ? h.smax : '-', 0);
    okcNote(
      'ssmn',
      S.st.n <= 0 || S.st.s <= h.smax,
      S.st.n > 0 ? (S.st.s <= h.smax ? 'OK' : 'NG') : '-',
    );
    if (S.st.n > 0 && S.st.s > h.smax) ok = false;
  }

  return { ...R, ok };
}

// ---------------------------------------------------------------------------
// 2. Circular Column / Pile P-M Interaction Solver (Module 02:55-300)
// ---------------------------------------------------------------------------

export function barA(d: number): number {
  return REBAR_AREA_02[d] || (Math.PI * d * d) / 4;
}

export interface CircularBar {
  x: number;
  y: number;
  a: number;
  d: number;
  L: number;
  i: number;
}

export interface CircularLayer {
  n: number;
  d: number;
  a: number;
  c: number;
}

export interface CircularSectionInput {
  D: number;
  fc: number;
  fy: number;
  tie?: 'T' | 'S';
  layers: Array<{ n: number; d: number; c: number }>;
}

export interface CircularSection {
  D: number;
  R: number;
  bars: CircularBar[];
  layers: CircularLayer[];
  As: number;
  ns: number;
  Dr: number;
  fc: number;
  fy: number;
  Es: number;
  Ac: number;
  a1: number;
  b1: number;
  ecl: number;
  etl: number;
  kP: number;
  Po: number;
}

const linPiecewise = (x: number, xs: readonly number[], ys: readonly number[]): number => {
  if (x <= xs[0]) return ys[0];
  for (let i = 0; i < xs.length - 1; i++) {
    if (x <= xs[i + 1]) return ys[i] + ((x - xs[i]) * (ys[i + 1] - ys[i])) / (xs[i + 1] - xs[i]);
  }
  return ys[ys.length - 1];
};

export function buildCircularSection(input: CircularSectionInput): CircularSection {
  const D = input.D;
  const R = D / 2;
  const bars: CircularBar[] = [];
  const layers: CircularLayer[] = [];
  let As = 0;
  let ns = 0;
  let Dr = 0;

  input.layers.forEach((raw, idx) => {
    const L = idx + 1;
    const n = Math.round(raw.n);
    const d = raw.d;
    const c = raw.c;
    if (n > 0 && d > 0) {
      const a = barA(d);
      layers.push({ n, d, a, c });
      As += n * a;
      ns += n;
      if (!Dr) Dr = D - 2 * c;
      for (let i = 0; i < n; i++) {
        const t = ((90 - (360 * i) / n) * Math.PI) / 180;
        bars.push({ x: (R - c) * Math.cos(t), y: (R - c) * Math.sin(t), a, d, L, i: i + 1 });
      }
    }
  });

  const fc = input.fc;
  const fy = input.fy;
  const Es = 200000;
  const Ac = Math.PI * R * R;
  const a1 = Math.min(0.85, Math.max(0.75, 0.85 - (0.02 * (fc - 69)) / 7));
  const b1 = Math.min(0.85, Math.max(0.65, 0.85 - (0.05 * (fc - 28)) / 7));
  const ecl = fy <= 414 ? fy / Es : linPiecewise(fy, [414, 517, 552, 690], [0.002, 0.0028, 0.003, 0.004]);
  const etl = linPiecewise(fy, [517, 690], [0.005, 0.008]);
  const kP = (input.tie ?? 'S') === 'T' ? 0.8 : 0.85;
  const rMin = layers.length ? Math.min(...layers.map((l) => l.c)) : Infinity;
  if (layers.length) Dr = D - 2 * rMin;

  return {
    D,
    R,
    bars,
    layers,
    As,
    ns,
    Dr,
    fc,
    fy,
    Es,
    Ac,
    a1,
    b1,
    ecl,
    etl,
    kP,
    Po: (a1 * fc * (Ac - As) + fy * As) / 1000,
  };
}

export function section(): CircularSection {
  const D = num('D');
  const layerInputs: Array<{ n: number; d: number; c: number }> = [];
  for (let L = 1; L <= 3; L++) {
    const n = Math.round(num('n' + L));
    const d = num('d' + L);
    const c = num('c' + L);
    layerInputs.push({ n, d, c });
    set('a' + L, n > 0 && d > 0 ? fx(barA(d), 0) : '');
  }
  return buildCircularSection({
    D,
    fc: num('fc'),
    fy: num('fy'),
    tie: v('tie', 'S') === 'T' ? 'T' : 'S',
    layers: layerInputs,
  });
}

export const CDL: readonly number[] = (() => {
  const a: number[] = [];
  for (let x = 0.002; x < 0.02; x += 0.002) a.push(x);
  for (let x = 0.02; x < 0.1; x += 0.005) a.push(x);
  for (let x = 0.1; x < 1.0001; x += 0.01) a.push(x);
  for (let x = 1.05; x <= 3.0001; x += 0.05) a.push(x);
  return a;
})();

export function curve(S: CircularSection, phc: number, pht: number): CircularPmCurveResult {
  const pts: CircularPmPoint[] = [{ Pn: (-S.fy * S.As) / 1000, Mn: 0, phi: pht, P: 0, M: 0 }];
  const R = S.R;
  const dt = S.bars.length ? R - Math.min(...S.bars.map((b) => b.y)) : S.D;

  for (const r of CDL) {
    const c = r * S.D;
    const a = Math.min(S.b1 * c, S.D);
    const th = 2 * Math.acos(Math.max(-1, Math.min(1, (R - a) / R)));
    let P = (S.a1 * S.fc * R * R * (th - Math.sin(th))) / 2;
    let M = ((S.a1 * S.fc * 2) / 3) * R ** 3 * Math.sin(th / 2) ** 3;

    for (const b of S.bars) {
      const d = R - b.y;
      const e = (0.003 * (c - d)) / c;
      let fs = Math.max(-S.fy, Math.min(S.fy, S.Es * e));
      if (d < a && e > 0) fs -= S.a1 * S.fc;
      P += fs * b.a;
      M += fs * b.a * b.y;
    }

    const et = (0.003 * (dt - c)) / c;
    const phi = Math.min(pht, Math.max(phc, phc + ((pht - phc) * (et - S.ecl)) / (S.etl - S.ecl)));
    pts.push({ Pn: P / 1000, Mn: M / 1e6, phi, P: 0, M: 0 });
  }

  for (const p of pts) {
    p.P = p.phi * p.Pn;
    p.M = p.phi * p.Mn;
  }

  return { pts, cap: phc * S.kP * S.Po };
}

export function interp<T extends Record<string, number>>(
  arr: readonly T[],
  kx: keyof T & string,
  ky: keyof T & string,
  x: number,
): number | null {
  let best: number | null = null;
  for (let i = 0; i < arr.length - 1; i++) {
    const a = arr[i];
    const b = arr[i + 1];
    const lo = Math.min(a[kx], b[kx]);
    const hi = Math.max(a[kx], b[kx]);
    if (x >= lo && x <= hi && hi > lo) {
      const val = a[ky] + ((x - a[kx]) * (b[ky] - a[ky])) / (b[kx] - a[kx]);
      if (best === null || val < best) best = val;
    }
  }
  return best;
}

export function phiMnAt(C: CircularPmCurveResult, P: number): number {
  if (!C.pts.length) return 0;
  if (P > C.cap + 1e-9 || P < C.pts[0].P - 1e-9) return 0;
  const m = interp(
    C.pts as unknown as Array<Record<string, number>>,
    'P',
    'M',
    P,
  );
  return m == null ? 0 : m;
}

export const COMB: ReadonlyArray<readonly [string, keyof ParsedSummaryMap]> = [
  ['P_max', 'Nmax'],
  ['P_min', 'Nmin'],
  ['Mx_max', 'M3max'],
  ['My_max', 'M2max'],
];

export interface CircularComboLoad {
  nm: string;
  key: keyof ParsedSummaryMap;
  r: ParsedSummaryRow;
  P: number;
  Mx: number;
  My: number;
  M: number;
  phiM?: number;
  ratio?: number;
}

export function loadsOf(
  sum: ParsedSummaryMap,
  k: number,
  prefixOverride?: ContextPrefix,
): CircularComboLoad[] {
  const idp = prefixOverride !== undefined ? prefixOverride : getIDP();
  const list =
    idp === 'C_' || idp === 'T_'
      ? [...COMB, ['M_max (bất lợi nhất)', 'M1max'] as const]
      : COMB;

  return list
    .filter(([, key]) => Boolean(sum[key]))
    .map(([nm, key]) => {
      const r = sum[key]!;
      const P = r.N * k;
      const Mx = r.M3 * k;
      const My = r.M2 * k;
      return { nm, key, r, P, Mx, My, M: Math.hypot(Mx, My) };
    });
}

// ---------------------------------------------------------------------------
// 3. 3D Biaxial Interaction Solver (`pt3`, `mer3`, `atP`, `capDir`, `compute3`)
// ---------------------------------------------------------------------------

export interface MeridianPoint3D {
  P: number;
  Mx: number;
  My: number;
  M: number;
}

export interface St3StateBucket {
  X: number[][];
  Y: number[][];
  Z: number[][];
  cap: number;
  loads: Array<CircularComboLoad & { phiM3: number; ratio3: number }>;
  mers: MeridianPoint3D[][];
}

export type St3StateMap = Record<'CD' | 'DB', St3StateBucket>;

export function pt3(
  S: CircularSection,
  al: number,
  c: number,
  phc: number,
  pht: number,
): MeridianPoint3D {
  const ca = Math.cos(al);
  const sa = Math.sin(al);
  const R = S.R;
  const a = Math.min(S.b1 * c, S.D);
  const th = 2 * Math.acos(Math.max(-1, Math.min(1, (R - a) / R)));
  const Mc = ((S.a1 * S.fc * 2) / 3) * R ** 3 * Math.sin(th / 2) ** 3;
  let P = (S.a1 * S.fc * R * R * (th - Math.sin(th))) / 2;
  let Mx = Mc * sa;
  let My = Mc * ca;
  let dt = 0;

  for (const b of S.bars) {
    const d = R - (b.x * ca + b.y * sa);
    if (d > dt) dt = d;
    const e = (0.003 * (c - d)) / c;
    let fs = Math.max(-S.fy, Math.min(S.fy, S.Es * e));
    if (d < a && e > 0) fs -= S.a1 * S.fc;
    const F = fs * b.a;
    P += F;
    Mx += F * b.y;
    My += F * b.x;
  }

  const et = (0.003 * (dt - c)) / c;
  const phi = Math.min(pht, Math.max(phc, phc + ((pht - phc) * (et - S.ecl)) / (S.etl - S.ecl)));
  return {
    P: (phi * P) / 1000,
    Mx: (phi * Mx) / 1e6,
    My: (phi * My) / 1e6,
    M: (phi * (Mx * sa + My * ca)) / 1e6,
  };
}

export function mer3(
  S: CircularSection,
  al: number,
  phc: number,
  pht: number,
): MeridianPoint3D[] {
  const p: MeridianPoint3D[] = [{ P: (-pht * S.fy * S.As) / 1000, Mx: 0, My: 0, M: 0 }];
  for (const r of CDL) p.push(pt3(S, al, r * S.D, phc, pht));
  return p;
}

export function atP(
  m: readonly MeridianPoint3D[],
  P: number,
): { Mx: number; My: number; M: number } | null {
  let best: { Mx: number; My: number; M: number } | null = null;
  for (let i = 0; i < m.length - 1; i++) {
    const a = m[i];
    const b = m[i + 1];
    const lo = Math.min(a.P, b.P);
    const hi = Math.max(a.P, b.P);
    if (P >= lo && P <= hi && hi > lo) {
      const t = (P - a.P) / (b.P - a.P);
      const Mx = a.Mx + t * (b.Mx - a.Mx);
      const My = a.My + t * (b.My - a.My);
      const q = { Mx, My, M: Math.hypot(Mx, My) };
      if (!best || q.M < best.M) best = q;
    }
  }
  return best;
}

export function capDir(
  S: CircularSection,
  th: number,
  P: number,
  phc: number,
  pht: number,
  cap: number,
): number {
  if (P > cap + 1e-9 || P < (-pht * S.fy * S.As) / 1000 - 1e-9) return 0;
  let al = th;
  let q: { Mx: number; My: number; M: number } | null = null;
  for (let it = 0; it < 8; it++) {
    q = atP(mer3(S, al, phc, pht), P);
    if (!q || q.M < 1e-9) break;
    let d = th - Math.atan2(q.Mx, q.My);
    d = Math.atan2(Math.sin(d), Math.cos(d));
    if (Math.abs(d) < 1e-5) break;
    al += d;
  }
  return q ? q.M : 0;
}

export function compute3(
  S: CircularSection,
  LCD: readonly CircularComboLoad[],
  LDB: readonly CircularComboLoad[],
  phic?: number,
  phit?: number,
  phicE?: number,
  phitE?: number,
): St3StateMap {
  const sets: Record<'CD' | 'DB', [number, number, readonly CircularComboLoad[]]> = {
    CD: [phic ?? num('phic', 0.75), phit ?? num('phit', 0.9), LCD],
    DB: [phicE ?? num('phicE', 1), phitE ?? num('phitE', 1), LDB],
  };

  const out = {} as St3StateMap;
  for (const st of ['CD', 'DB'] as const) {
    const [phc, pht, L] = sets[st];
    const cap = phc * S.kP * S.Po;
    const NA = 72;
    const X: number[][] = [];
    const Y: number[][] = [];
    const Z: number[][] = [];
    const mers: MeridianPoint3D[][] = [];
    for (let j = 0; j <= NA; j++) mers.push(mer3(S, (2 * Math.PI * j) / NA, phc, pht));
    for (let i = 0; i < mers[0].length; i++) {
      const xr: number[] = [];
      const yr: number[] = [];
      const zr: number[] = [];
      for (let j = 0; j <= NA; j++) {
        const q = mers[j][i];
        xr.push(q.Mx);
        yr.push(q.My);
        zr.push(Math.min(q.P, cap));
      }
      X.push(xr);
      Y.push(yr);
      Z.push(zr);
    }
    X.push(Array(NA + 1).fill(0));
    Y.push(Array(NA + 1).fill(0));
    Z.push(Array(NA + 1).fill(cap));

    const loads = L.map((l) => {
      const pm = capDir(
        S,
        l.M > 1e-9 ? Math.atan2(l.Mx, l.My) : Math.PI / 2,
        l.P,
        phc,
        pht,
        cap,
      );
      return {
        ...l,
        phiM3: pm,
        ratio3: l.M > 1e-9 ? (pm > 0 ? pm / l.M : 0) : Infinity,
      };
    });
    out[st] = { X, Y, Z, cap, loads, mers };
  }

  contextState.ST3 = out;
  return out;
}

export function fig3(st: 'CD' | 'DB', st3Input?: St3StateMap): Record<string, unknown> | null {
  const st3 = st3Input ?? (contextState.ST3 as St3StateMap | null);
  if (!st3) return null;
  const d = st3[st];
  const L = d.loads;
  return {
    data: [
      {
        type: 'surface',
        x: d.X,
        y: d.Y,
        z: d.Z,
        opacity: 0.5,
        showscale: false,
        colorscale: [
          [0, '#2f7fb0'],
          [1, '#2f7fb0'],
        ],
        contours: {
          z: {
            show: true,
            usecolormap: false,
            color: '#1f4e79',
            width: 1,
            start: Math.floor(d.Z[0][0] / 2000) * 2000,
            end: d.cap,
            size: 2000,
          },
        },
        hovertemplate: 'φMx %{x:.0f}<br>φMy %{y:.0f}<br>φPn %{z:.0f}<extra></extra>',
      },
      {
        type: 'scatter3d',
        mode: 'markers+text',
        x: L.map((l) => l.Mx),
        y: L.map((l) => l.My),
        z: L.map((l) => l.P),
        text: L.map((_, i) => String(i + 1)),
        textposition: 'top center',
        textfont: { color: '#c00000', size: 13, family: 'Times New Roman' },
        marker: { size: 5, color: L.map((l) => (l.ratio3 >= 1 ? '#006b2d' : '#c00000')) },
        customdata: L.map((l) => l.nm),
        hovertemplate: '%{customdata}<br>Mx %{x:.1f} · My %{y:.1f}<br>Pu %{z:.1f}<extra></extra>',
      },
    ],
    layout: {
      paper_bgcolor: '#fff',
      font: { family: 'Times New Roman, serif', size: 12, color: '#111' },
      margin: { l: 0, r: 0, t: 24, b: 0 },
      showlegend: false,
      title: {
        text: st === 'CD' ? 'TTGH Cường độ và Sử dụng' : 'TTGH Đặc biệt',
        font: { size: 14 },
      },
      scene: {
        xaxis: { title: { text: 'φMx (kN.m)' }, gridcolor: '#d0d4d8' },
        yaxis: { title: { text: 'φMy (kN.m)' }, gridcolor: '#d0d4d8' },
        zaxis: { title: { text: 'φPn (kN)' }, gridcolor: '#d0d4d8' },
        aspectmode: 'manual',
        aspectratio: { x: 1, y: 1, z: 1.1 },
        camera: { eye: { x: 1.6, y: 1.6, z: 0.85 } },
      },
    },
  };
}

export function render3(st3Input?: St3StateMap): boolean {
  const st3 = st3Input ?? (contextState.ST3 as St3StateMap | null);
  if (!st3) return false;
  const cur3 = contextState.cur3 || 'CD';
  const bCD = $('b3CD');
  const bDB = $('b3DB');
  bCD?.setAttribute?.('aria-pressed', String(cur3 === 'CD'));
  bDB?.setAttribute?.('aria-pressed', String(cur3 === 'DB'));

  getVisualHooks().renderPm3d?.({
    prefix: getIDP(),
    state: cur3,
    st3,
  });

  let t =
    '<tr><th>No.</th><th>TTGH</th><th>COMBINATION</th><th>Pu<br>kN</th><th>Mx<br>kN-m</th><th>My<br>kN-m</th><th>Mxy<br>kN-m</th><th>φMn<br>kN-m</th><th>φMn/Mu</th></tr>';
  let mn = Infinity;
  let i = 0;
  for (const st of ['CD', 'DB'] as const) {
    st3[st].loads.forEach((l) => {
      mn = Math.min(mn, l.ratio3);
      t += `<tr><td class="c">${++i}</td><td class="c">${st === 'CD' ? 'CĐ' : 'ĐB'}</td><td class="l">${l.nm}</td><td>${fx(l.P, 1)}</td><td>${fx(l.Mx, 1)}</td><td>${fx(l.My, 1)}</td><td>${fx(l.M, 1)}</td><td>${fx(l.phiM3, 1)}</td><td class="${l.ratio3 >= 1 ? 'ok' : 'bad'}">${Number.isFinite(l.ratio3) ? fx(l.ratio3, 3) : '∞'}</td></tr>`;
    });
  }
  set('tbBi', t);
  const biOk = i > 0 && mn >= 1;
  contextState.biOK = biOk;
  set(
    'klBi',
    i
      ? `Min φMn/Mu (uốn hai phương) = ${Number.isFinite(mn) ? fx(mn, 3) : '∞'} → <span class="${mn >= 1 ? 'ok' : 'bad'}">${mn >= 1 ? 'ĐẠT' : 'KHÔNG ĐẠT'}</span>`
      : '',
  );
  return biOk;
}

export function toPm3dSurfaceResult(st3: St3StateMap): Pm3dSurfaceResult {
  const NA = 72;
  const cdMers = st3.CD.mers;
  const loadChecks: Pm3dSurfaceResult['loadChecks'] = [];
  let mn = Infinity;

  for (const st of ['CD', 'DB'] as const) {
    for (const l of st3[st].loads) {
      mn = Math.min(mn, l.ratio3);
      loadChecks.push({
        nm: l.nm,
        st,
        P: l.P,
        Mx: l.Mx,
        My: l.My,
        M: l.M,
        phiMnTheta: l.phiM3,
        ratio: l.ratio3,
        ok: l.ratio3 >= 1,
      });
    }
  }

  return {
    meridians: cdMers.slice(0, NA + 1).map((pts, j) => ({
      alphaDeg: (360 * j) / NA,
      pts: pts.map((p) => ({
        P: p.P,
        Mx: p.Mx,
        My: p.My,
        M: Math.min(p.M, st3.CD.cap),
        phi: 1,
      })),
    })),
    capCD: st3.CD.cap,
    capDB: st3.DB.cap,
    loadChecks,
    okAll: loadChecks.length > 0 && mn >= 1,
  };
}

// ---------------------------------------------------------------------------
// 4. Circular Column Shear & Complete Check (`tab3Step`, Module 11:4007-4360)
// ---------------------------------------------------------------------------

export interface CircularShearCaseInput {
  st: 'CĐ' | 'ĐB';
  nm: string;
  P: number;
  Vx: number;
  Vy: number;
  V: number;
  Mx: number;
  My: number;
  M: number;
  phi: number;
  C: CircularPmCurveResult;
}

export interface CircularShearCaseResult {
  Nu: number;
  Mn: number;
  dv1: number;
  dvs: number;
  dv: number;
  Mu: number;
  vu: number;
  ex: number;
  beta: number;
  th: number;
  Vc: number;
  Vs: number;
  Vn1: number;
  Vn2: number;
  Vn: number;
  Vr: number;
  ratio: number;
}

export function circularShearCalc(
  S: CircularSection,
  c: CircularShearCaseInput,
  params: {
    meth: 'F' | 'A';
    sel: '1' | '2';
    Dv: number;
    nv: number;
    s: number;
    fyt: number;
  },
): CircularShearCaseResult {
  const bv = S.D;
  const Ash = S.As / 2;
  const Av = (params.nv * Math.PI * params.Dv * params.Dv) / 4;
  const de = S.D / 2 + S.Dr / Math.PI;
  const dv2 = 0.9 * de;

  const Nu = -c.P;
  const Mn =
    interp(c.C.pts as unknown as Array<Record<string, number>>, 'Pn', 'Mn', c.P) || 0;
  const dv1 = (Mn * 1e6) / (Ash * S.fy);
  const dvs = params.sel === '1' ? dv1 : dv2;
  const dv = Math.max(dvs, 0.72 * S.D);
  const Mu = Math.max(c.M, (c.V * dv) / 1000);
  const vu = (c.V * 1000) / (c.phi * bv * dv);

  let beta: number;
  let th: number;
  let ex: number;

  if (params.meth === 'F') {
    ex = ((Mu * 1e6) / dv + 0.5 * Nu * 1000 + c.V * 1000) / (S.Es * Ash);
    ex = Math.min(0.006, Math.max(0, ex));
    beta = 4.8 / (1 + 750 * ex);
    th = 29 + 3500 * ex;
  } else {
    th = 30;
    ex = 0;
    for (let it = 0; it < 50; it++) {
      ex =
        ((Mu * 1e6) / dv +
          0.5 * Nu * 1000 +
          (0.5 * c.V * 1000) / Math.tan((th * Math.PI) / 180)) /
        (2 * S.Es * Ash);
      ex = Math.min(0.001, ex);
      const t2 = bilin(TH_V ? TT : TT, vu / S.fc, ex * 1000);
      if (Math.abs(t2 - th) < 1e-6) {
        th = t2;
        break;
      }
      th = t2;
    }
    beta = bilin(TB, vu / S.fc, ex * 1000);
  }

  const Vc = (0.083 * beta * Math.sqrt(S.fc) * bv * dv) / 1000;
  const Vs = (Av * params.fyt * dv) / Math.tan((th * Math.PI) / 180) / params.s / 1000;
  const Vn2 = (0.25 * S.fc * bv * dv) / 1000;
  const Vn = Math.min(Vc + Vs, Vn2);
  const Vr = c.phi * Vn;

  return {
    Nu,
    Mn,
    dv1,
    dvs,
    dv,
    Mu,
    vu,
    ex,
    beta,
    th,
    Vc,
    Vs,
    Vn1: Vc + Vs,
    Vn2,
    Vn,
    Vr,
    ratio: Vr / c.V,
  };
}

export interface CircularColumnPureInput {
  section: CircularSectionInput;
  sCD: ParsedSummaryMap;
  sDB: ParsedSummaryMap;
  k?: number;
  phic?: number;
  phit?: number;
  phicE?: number;
  phitE?: number;
  phiv?: number;
  phivE?: number;
  K1?: number;
  wc?: number;
  soil?: 'Cát' | 'Sét';
  nh?: number;
  Su?: number;
  L0?: number;
  Kef?: number;
  rmin?: number;
  rmax?: number;
  Dv?: number;
  nv?: number;
  s?: number;
  fyt?: number;
  meth?: 'F' | 'A';
  dvopt?: '1' | '2';
  prefix?: ContextPrefix;
}

export interface CircularColumnCheckOutput {
  S: CircularSection;
  Ec: number;
  Le: number;
  Lu: number;
  sl: number;
  slok: boolean;
  rho: number;
  rMinReq: number;
  rok: boolean;
  CCD: CircularPmCurveResult;
  CDB: CircularPmCurveResult;
  LCD: CircularComboLoad[];
  LDB: CircularComboLoad[];
  resCD: boolean;
  resDB: boolean;
  st3: St3StateMap;
  biOk: boolean;
  shCases: Array<CircularShearCaseInput & { r: CircularShearCaseResult }>;
  gShear: (CircularShearCaseInput & { r: CircularShearCaseResult }) | null;
  Av: number;
  Avmin: number;
  shOK: boolean;
  detOK: boolean;
  all: boolean;
}

export function runCircularColumnCheck(inp: CircularColumnPureInput): CircularColumnCheckOutput {
  const k = inp.k ?? 9.81;
  const S = buildCircularSection(inp.section);
  const K1 = inp.K1 ?? 1;
  const wc = inp.wc ?? 2450;
  const Ec = 0.0017 * K1 * wc ** 2 * S.fc ** 0.33;
  const Ip = (Math.PI * S.D ** 4) / 64;
  const Le =
    (inp.soil ?? 'Cát') === 'Cát'
      ? 1.8 * ((Ec * Ip) / Math.max(inp.nh ?? 5000, 1e-9)) ** 0.2
      : 1.4 * ((Ec * Ip) / Math.max(67 * (inp.Su ?? 50), 1e-9)) ** 0.25;
  const Lu = (inp.L0 ?? 0) + Le;
  const sl = ((inp.Kef ?? 1) * Lu) / (S.D / 4);
  const idp = inp.prefix ?? getIDP();
  const slok = sl < 22 || idp === 'C_' || idp === 'T_';
  const rho = (S.As / S.Ac) * 100;
  const rMinReq = Math.max(
    inp.rmin || 0,
    0.8,
    Math.min((0.135 * S.fc) / (S.fy || 400), 0.015) * 100,
  );
  const rok = rho >= rMinReq - 1e-9 && rho <= (inp.rmax ?? 8);

  const phic = inp.phic ?? 0.75;
  const phit = inp.phit ?? 0.9;
  const phicE = inp.phicE ?? 1;
  const phitE = inp.phitE ?? 1;

  const LCD = loadsOf(inp.sCD, k, idp);
  const LDB = loadsOf(inp.sDB, k, idp);
  const CCD = curve(S, phic, phit);
  const CDB = curve(S, phicE, phitE);

  let mnCD = Infinity;
  for (const l of LCD) {
    l.phiM = phiMnAt(CCD, l.P);
    l.ratio = l.M > 1e-9 ? l.phiM / l.M : Infinity;
    mnCD = Math.min(mnCD, l.ratio);
  }
  const resCD = LCD.length > 0 && mnCD >= 1;

  let mnDB = Infinity;
  for (const l of LDB) {
    l.phiM = phiMnAt(CDB, l.P);
    l.ratio = l.M > 1e-9 ? l.phiM / l.M : Infinity;
    mnDB = Math.min(mnDB, l.ratio);
  }
  const resDB = LDB.length > 0 && mnDB >= 1;

  const st3 = compute3(S, LCD, LDB, phic, phit, phicE, phitE);
  let mnBi = Infinity;
  let biCount = 0;
  for (const st of ['CD', 'DB'] as const) {
    for (const l of st3[st].loads) {
      biCount++;
      mnBi = Math.min(mnBi, l.ratio3);
    }
  }
  const biOk = biCount > 0 && mnBi >= 1;

  const shK: ReadonlyArray<readonly [string, keyof ParsedSummaryMap]> = [
    ['Vx_max', 'Q2max'],
    ['Vy_max', 'Q3max'],
    ['N_max', 'Nmax'],
    ['N_min', 'Nmin'],
    ['Mx_max', 'M3max'],
    ['My_max', 'M2max'],
    ['M_max', 'M1max'],
  ];

  const shParams = {
    meth: inp.meth ?? ('F' as const),
    sel: inp.dvopt ?? ('1' as const),
    Dv: inp.Dv ?? 12,
    nv: inp.nv ?? 2,
    s: inp.s ?? 150,
    fyt: inp.fyt ?? 400,
  };

  const shCases: Array<CircularShearCaseInput & { r: CircularShearCaseResult }> = [];
  for (const [st, sum] of [
    ['CĐ', inp.sCD],
    ['ĐB', inp.sDB],
  ] as const) {
    for (const [nm, key] of shK) {
      const r = sum[key];
      if (!r) continue;
      const P = r.N * k;
      const Vx = Math.abs(r.Q2) * k;
      const Vy = Math.abs(r.Q3) * k;
      const Mx = r.M3 * k;
      const My = r.M2 * k;
      const item: CircularShearCaseInput = {
        st,
        nm,
        P,
        Vx,
        Vy,
        V: Math.hypot(Vx, Vy),
        Mx,
        My,
        M: Math.hypot(Mx, My),
        phi: st === 'CĐ' ? (inp.phiv ?? 0.9) : (inp.phivE ?? 1),
        C: st === 'CĐ' ? CCD : CDB,
      };
      shCases.push({ ...item, r: circularShearCalc(S, item, shParams) });
    }
  }

  const gShear = shCases.reduce<(CircularShearCaseInput & { r: CircularShearCaseResult }) | null>(
    (a, b) => (!a || b.r.ratio < a.r.ratio ? b : a),
    null,
  );
  const Av = (shParams.nv * Math.PI * shParams.Dv * shParams.Dv) / 4;
  const Avmin = (0.083 * Math.sqrt(S.fc) * S.D * shParams.s) / shParams.fyt;
  let shOK = false;
  let detOK = false;
  if (gShear) {
    const req = shCases.some((c) => c.V > 0.5 * c.phi * c.r.Vc);
    const avok = !req || Av >= Avmin;
    const vuM = shCases.reduce(
      (a, c) => (c.r.vu > a.vu ? { vu: c.r.vu, dv: c.r.dv } : a),
      { vu: gShear.r.vu, dv: gShear.r.dv },
    );
    const smax =
      vuM.vu < 0.125 * S.fc ? Math.min(0.8 * vuM.dv, 600) : Math.min(0.4 * vuM.dv, 300);
    const sok = shParams.s <= smax;
    shOK = gShear.r.Vr >= gShear.V;
    detOK = avok && sok;
  }

  const all = Boolean(resCD && resDB && shOK && detOK && rok && biOk && slok);

  return {
    S,
    Ec,
    Le,
    Lu,
    sl,
    slok,
    rho,
    rMinReq,
    rok,
    CCD,
    CDB,
    LCD,
    LDB,
    resCD,
    resDB,
    st3,
    biOk,
    shCases,
    gShear,
    Av,
    Avmin,
    shOK,
    detOK,
    all,
  };
}

export interface Tab3RuntimeDeps {
  MCR?: { txtCD: string; txtDB: string } | null;
  TRC?: { SL?: { luT: number; luL: number; lt: number; ll: number; Kt: number; Kl: number } } | null;
}

export function tab3Step(deps?: Tab3RuntimeDeps): CircularColumnCheckOutput {
  const isCalcSrc = v('src', 'manual') === 'calc';
  const txtCDEl = $('txtCD');
  const txtDBEl = $('txtDB');
  if (txtCDEl) txtCDEl.readOnly = isCalcSrc;
  if (txtDBEl) txtDBEl.readOnly = isCalcSrc;

  const mcr = (deps?.MCR ?? contextState.MCR) as { txtCD: string; txtDB: string } | null;
  if (isCalcSrc && mcr) {
    sv('txtCD', mcr.txtCD);
    sv('txtDB', mcr.txtDB);
    sv('k', '9.81');
  }

  const k = num('k', 9.81);
  const S = section();
  const sCD = parseSum(v('txtCD', ''));
  const sDB = parseSum(v('txtDB', ''));

  // 0. Mcoc echo table
  let h =
    '<tr><th></th><th>T.C</th><th>T.H</th><th>N</th><th>Q2</th><th>Q3</th><th>M1</th><th>M2</th><th>M3</th></tr>';
  for (const [lab, sum] of [
    ['TTGH CƯỜNG ĐỘ VÀ SỬ DỤNG', sCD],
    ['TTGH ĐẶC BIỆT', sDB],
  ] as const) {
    h += `<tr class="grp"><td colspan="9">${lab} ${Object.keys(sum).length ? '' : "- <span class='bad'>chưa đọc được bảng tổng kết</span>"}</td></tr>`;
    for (const key of KEYS) {
      const r = sum[key];
      if (r) {
        h += `<tr><td class="l">${key}</td><td class="c">${r.tc}</td><td class="c">${r.th}</td><td>${fx(r.N, 2)}</td><td>${fx(r.Q2, 2)}</td><td>${fx(r.Q3, 2)}</td><td>${fx(r.M1, 3)}</td><td>${fx(r.M2, 3)}</td><td>${fx(r.M3, 3)}</td></tr>`;
      }
    }
  }
  set('tbMcoc', h);

  // 1. Section outputs
  set('o_nl', String(S.layers.length));
  set('o_As', fx(S.As, 0));
  set('o_Ac', fx(S.Ac, 0));
  set('o_ns', String(S.ns));
  const Ec = 0.0017 * num('K1', 1) * num('wc', 2450) ** 2 * S.fc ** 0.33;
  set('o_Ec', fx(Ec, 0));
  set('o_a1', fx(S.a1, 3));
  set('o_b1', fx(S.b1, 4));
  set('o_ecl', `${fx(S.ecl, 4)} / ${fx(S.etl, 4)}`);
  set('o_kP', fx(S.kP, 2));

  const Ip = (Math.PI * S.D ** 4) / 64;
  const soil = v('soil', 'Cát') === 'Cát' ? 'Cát' : 'Sét';
  const Le =
    soil === 'Cát'
      ? 1.8 * ((Ec * Ip) / Math.max(num('nh', 5000), 1e-9)) ** 0.2
      : 1.4 * ((Ec * Ip) / Math.max(67 * num('Su', 50), 1e-9)) ** 0.25;
  const Lu = num('L0', 0) + Le;
  const sl = (num('Kef', 1) * Lu) / (S.D / 4);
  set('o_Le', fx(Le, 0));
  set('o_Lu', fx(Lu, 0));
  set('o_sl', fx(sl, 2));

  const idp = getIDP();
  const trc = deps?.TRC;
  if ((idp === 'C_' || idp === 'T_') && trc && trc.SL) {
    const L = trc.SL;
    set('o_Le', '-');
    set(
      'o_Lu',
      `${fx(1000 * Math.max(L.luT, L.luL), 0)} (ngang ${fx(1000 * L.luT, 0)} ; dọc ${fx(1000 * L.luL, 0)})`,
    );
    set('o_sl', `ngang ${fx(L.lt, 2)} ; dọc ${fx(L.ll, 2)}`);
    const ke = $('Kef');
    const txtKef = `ngang ${L.Kt.toFixed(2)} ; dọc ${L.Kl.toFixed(2)}`;
    if (ke) {
      if (ke.value !== txtKef) ke.value = txtKef;
      ke.readOnly = true;
      ke.classList?.add('lnk');
      ke.title = 'Lấy theo phân tích khung trụ (trang kiểm toán xà mũ, giằng, thân trụ)';
    }
  }

  const slok = sl < 22 || idp === 'C_' || idp === 'T_';
  set(
    'o_slck',
    idp === 'T_'
      ? 'Cọc là phần kéo dài của thân trụ (cùng một cấu kiện): mômen cọc đã khuếch đại Mc = δb.M2b + δs.M2s cùng với thân trụ (TCVN 11823-4, 5.3.2.2.2), xem trang kiểm toán xà mũ, giằng, thân trụ'
      : sl < 22
        ? '< 22: Không cần xét độ mảnh'
        : idp === 'C_'
          ? '≥ 22: mômen đã được khuếch đại (TCVN 11823-4, 5.3.2.2.2), xem trang kiểm toán xà mũ, giằng, thân trụ'
          : '≥ 22: CẦN XÉT KHUẾCH ĐẠI MÔMEN (chưa tính trong bảng)',
  );
  const slckEl = $('o_slck');
  if (slckEl) slckEl.className = `note ${slok ? 'ok' : 'bad'}`;

  const rho = (S.As / S.Ac) * 100;
  set('o_r', fx(rho, 3));
  const rMinReq = Math.max(
    num('rmin') || 0,
    0.8,
    Math.min((0.135 * S.fc) / (num('fy') || 400), 0.015) * 100,
  );
  const rok = rho >= rMinReq - 1e-9 && rho <= num('rmax', 8);
  set(
    'o_rck',
    `${rok ? 'OK' : 'NG'}: ρ ≥ ${fx(rMinReq, 2)}% (0,8%Ag - Điều 13.4.5.2 ; 0,135f'c/fy - PT 40)`,
  );
  const rckEl = $('o_rck');
  if (rckEl) rckEl.className = `note ${rok ? 'ok' : 'bad'}`;
  set('o_Dr', fx(S.Dr, 0));

  const out = runCircularColumnCheck({
    section: {
      D: S.D,
      fc: S.fc,
      fy: S.fy,
      tie: v('tie', 'S') === 'T' ? 'T' : 'S',
      layers: [1, 2, 3].map((L) => ({
        n: Math.round(num(`n${L}`)),
        d: num(`d${L}`),
        c: num(`c${L}`),
      })),
    },
    sCD,
    sDB,
    k,
    phic: num('phic', 0.75),
    phit: num('phit', 0.9),
    phicE: num('phicE', 1),
    phitE: num('phitE', 1),
    phiv: num('phiv', 0.9),
    phivE: num('phivE', 1),
    K1: num('K1', 1),
    wc: num('wc', 2450),
    soil,
    nh: num('nh', 5000),
    Su: num('Su', 50),
    L0: num('L0', 0),
    Kef: num('Kef', 1),
    rmin: num('rmin', 0.8),
    rmax: num('rmax', 8),
    Dv: num('Dv', 12),
    nv: num('nv', 2),
    s: num('s', 150),
    fyt: num('fyt', 400),
    meth: v('bmeth', 'F') === 'A' ? 'A' : 'F',
    dvopt: v('dvopt', '1') === '2' ? '2' : '1',
    prefix: idp,
  });

  // 2.1 combos
  h =
    '<tr><th rowspan="2">No.</th><th rowspan="2">COMBINATION</th><th rowspan="2">Axial force<br>P (KN)</th><th colspan="3">Moment (KN.m)</th></tr><tr><th>Mx</th><th>My</th><th>Mxy</th></tr>';
  for (const [lab, L] of [
    ['STRENGTH AND SERVICE LIMIT STATES (TTGH CƯỜNG ĐỘ VÀ SỬ DỤNG)', out.LCD],
    ['EXTREME EVENT LIMIT STATES (TTGH ĐẶC BIỆT)', out.LDB],
  ] as const) {
    h += `<tr class="grp"><td colspan="6">${lab}</td></tr>`;
    L.forEach((l, i) => {
      h += `<tr><td class="c">${i + 1}</td><td class="l">${l.nm}</td><td>${fx(l.P, 3)}</td><td>${fx(l.Mx, 3)}</td><td>${fx(l.My, 3)}</td><td>${fx(l.M, 3)}</td></tr>`;
    });
  }
  set('tbComb', h);

  // 2.2 check
  const hooks = getVisualHooks();
  for (const [st, L, C] of [
    ['CD', out.LCD, out.CCD],
    ['DB', out.LDB, out.CDB],
  ] as const) {
    hooks.renderCircularPm?.({ prefix: idp, curve: C, loads: L, section: S });
    let t =
      '<tr><th>No.</th><th>COMBINATION</th><th>Pu<br>kN</th><th>Mux<br>kN-m</th><th>φMnx<br>kN-m</th><th>φMn/Mu</th></tr>';
    let mn = Infinity;
    L.forEach((l, i) => {
      const ratio = l.ratio ?? 0;
      mn = Math.min(mn, ratio);
      t += `<tr><td class="c">${i + 1}</td><td class="l">${l.nm}</td><td>${fx(l.P, 1)}</td><td>${fx(l.M, 1)}</td><td>${fx(l.phiM ?? 0, 1)}</td><td class="${ratio >= 1 ? 'ok' : 'bad'}">${Number.isFinite(ratio) ? fx(ratio, 3) : '∞'}</td></tr>`;
    });
    set(`tbRes${st}`, t);
    const ok = L.length > 0 && mn >= 1;
    set(
      `kl${st}`,
      L.length
        ? `φPr,max = ${fx(C.cap, 1)} kN. Min φMn/Mu = ${Number.isFinite(mn) ? fx(mn, 3) : '∞'} → <span class="${ok ? 'ok' : 'bad'}">${ok ? 'ĐẠT' : 'KHÔNG ĐẠT'}</span>`
        : '',
    );
  }

  // 3. Shear outputs
  const bv = S.D;
  const Ash = S.As / 2;
  const s = num('s', 150);
  const fyt = num('fyt', 400);
  const de = S.D / 2 + S.Dr / Math.PI;
  const dv2 = 0.9 * de;
  const meth = v('bmeth', 'F') === 'A' ? 'A' : 'F';

  set('o_bv', fx(bv, 0));
  set('o_Ash', fx(Ash, 0));
  set('o_Av', fx(out.Av, 2));
  set('o_de', fx(de, 1));
  set('o_dv2', fx(dv2, 1));

  h =
    '<tr><th rowspan="2">No.</th><th rowspan="2">COMB.</th><th rowspan="2">Axial force<br>P (KN)</th><th colspan="3">Shear (KN)</th><th colspan="3">Moment (KN.m)</th><th rowspan="2">Vr/Vu</th></tr><tr><th>Vx</th><th>Vy</th><th>Vxy</th><th>Mx</th><th>My</th><th>Mxy</th></tr>';
  out.shCases.forEach((c, i) => {
    h += `<tr><td class="c">${i + 1}</td><td class="l">${c.st} - ${c.nm}</td><td>${fx(c.P, 3)}</td><td>${fx(c.Vx, 3)}</td><td>${fx(c.Vy, 3)}</td><td>${fx(c.V, 3)}</td><td>${fx(c.Mx, 3)}</td><td>${fx(c.My, 3)}</td><td>${fx(c.M, 3)}</td><td class="${c.r.ratio >= 1 ? 'ok' : 'bad'}">${fx(c.r.ratio, 3)}</td></tr>`;
  });
  set('tbShear', h);

  const g = out.gShear;
  if (g) {
    const r = g.r;
    set('o_case', `${g.st} - ${g.nm} (Vr/Vu nhỏ nhất)`);
    set('o_Nu', fx(r.Nu, 3));
    set('o_Mu', fx(r.Mu, 3));
    set('o_Vu', fx(g.V, 3));
    set('o_phiv', fx(g.phi, 2));
    set('o_Mn', fx(r.Mn, 2));
    set('o_dv1', fx(r.dv1, 1));
    set('o_dvsel', fx(r.dvs, 1));
    set('o_dv', fx(r.dv, 1));
    set('o_vu', fx(r.vu, 4));
    set('o_Avmin', fx(out.Avmin, 2));
    const req = out.shCases.some((c) => c.V > 0.5 * c.phi * c.r.Vc);
    set('o_hVc', fx(0.5 * g.phi * r.Vc, 2));
    set(
      'o_req',
      req
        ? 'Vu > 0.5φVc: bắt buộc Av ≥ Av,min'
        : 'Vu ≤ 0.5φVc ở mọi trường hợp: không bắt buộc',
    );
    const avok = !req || out.Av >= out.Avmin;
    set('o_Avck', 'Check: ' + (out.Av >= out.Avmin ? 'OK' : req ? 'NG' : 'OK (không bắt buộc)'));
    const avckEl = $('o_Avck');
    if (avckEl) avckEl.className = `note ${avok ? 'ok' : 'bad'}`;

    const vuM = out.shCases.reduce(
      (a, c) => (c.r.vu > a.vu ? { vu: c.r.vu, dv: c.r.dv } : a),
      { vu: r.vu, dv: r.dv },
    );
    const smax =
      vuM.vu < 0.125 * S.fc ? Math.min(0.8 * vuM.dv, 600) : Math.min(0.4 * vuM.dv, 300);
    set('o_smax', fx(smax, 1));
    const sok = s <= smax;
    set('o_sck', 'Check: ' + (sok ? 'OK' : 'NG'));
    const sckEl = $('o_sck');
    if (sckEl) sckEl.className = `note ${sok ? 'ok' : 'bad'}`;

    set(
      'bt',
      meth === 'F'
        ? `<div class="row"><span></span><span>Biến dạng thép dọc chịu kéo, 0 ≤ εs ≤ 0.006 (Điều 8.3.4.2)</span></div>` +
            FR(
              String.raw`\varepsilon_s = \dfrac{\left|M_u\right|/d_v + 0.5\,N_u + \left|V_u\right|}{E_s\,A_s}`,
              `<span class="sym">εs</span><span class="val">${fx(r.ex, 6)}</span>`,
            ) +
            FR(
              String.raw`\beta = \dfrac{4.8}{1 + 750\,\varepsilon_s}`,
              `<span class="sym">β</span><span class="val">${fx(r.beta, 4)}</span>`,
            ) +
            FR(
              String.raw`\theta = 29 + 3500\,\varepsilon_s`,
              `<span class="sym">θ</span><span class="val">${fx(r.th, 3)}</span><span class="unit">deg.</span>`,
            )
        : `<div class="row"><span></span><span>• Biến dạng trong cốt thép chịu kéo do uốn (εx ≤ 0.001)</span></div>` +
            FR(
              String.raw`\varepsilon_x = \dfrac{M_u/d_v + 0.5\,N_u + 0.5\,V_u\cot\theta}{2\,E_s\,A_s}`,
              `<span class="sym">εx</span><span class="val">${fx(r.ex, 7)}</span><span class="unit"></span><span class="note ${r.ex <= 0.001 ? 'ok' : 'bad'}">${r.ex <= 0.001 ? 'OK' : ''}</span>`,
            ) +
            `<div class="row"><span></span><span></span><span class="sym">vu/f'c</span><span class="val">${fx(r.vu / S.fc, 5)}</span></div>` +
            `<div class="row"><span></span><span></span><span class="sym">1000εx</span><span class="val">${fx(r.ex * 1000, 5)}</span></div>` +
            `<div class="row"><span></span><span>Góc θ tra Bảng 4 (AASHTO LRFD 2004) (lặp đến hội tụ)</span><span class="sym">θ</span><span class="val">${fx(r.th, 3)}</span><span class="unit">deg.</span></div>` +
            `<div class="row"><span></span><span>Hệ số β tra Bảng 4 (AASHTO LRFD 2004) theo vu/f'c và 1000εx</span><span class="sym">β</span><span class="val">${fx(r.beta, 4)}</span></div>`,
    );

    const on = meth !== 'F';
    const hd = '<tr><th>vu/f\'c \\ 1000εx</th>' + TH_E.map((e) => `<th>${e}</th>`).join('') + '</tr>';
    const mk = (T: readonly (readonly number[])[]) =>
      hd +
      TH_V.map(
        (vVal, i) => `<tr><td class="c">${vVal}</td>` + T[i].map((x) => `<td>${x}</td>`).join('') + '</tr>',
      ).join('');
    set('tbBTT', on ? mk(TT) : '');
    set('tbBTB', on ? mk(TB) : '');

    set('o_Vc', fx(r.Vc, 2));
    set('o_Vs', fx(r.Vs, 2));
    set('o_Vn1', fx(r.Vn1, 2));
    set('o_Vn2', fx(r.Vn2, 2));
    set('o_Vn', fx(r.Vn, 2));
    set('o_Vr', fx(r.Vr, 2));
    set(
      'o_Vck',
      `${out.shOK ? '&gt;' : '&lt;'} ${fx(g.V, 2)} kN&nbsp; <span class="${out.shOK ? 'ok' : 'bad'}">${out.shOK ? 'O.K.' : 'N.G.'}</span>`,
    );
  }

  render3(out.st3);

  const enough =
    S.bars.length > 0 && S.D > 0 && out.LCD.length + out.LDB.length > 0 && out.shCases.length > 0;
  contextState.matOK[idp || 'M'] = Boolean(out.all && enough);
  set(
    'o_all',
    !enough
      ? `<span class="bad">CHƯA ĐỦ SỐ LIỆU ĐỂ KẾT LUẬN (chưa có số liệu cốt thép hoặc nội lực)</span>`
      : `<span class="${out.all ? 'ok' : 'bad'}">${out.all ? (idp === 'C_' ? 'THÂN TRỤ ĐẠT YÊU CẦU' : 'CỌC ĐẠT YÊU CẦU') : 'CÓ HẠNG MỤC KHÔNG ĐẠT (xem các ô NG ở trên)'}</span>`,
  );

  hooks.renderMath?.();
  return out;
}
