/**
 * BangTinhCauCong Web App — Superstructure Switcher, Deck Slab (`SUP2R`),
 * Cantilever Overhang, Elastomeric Bearing (`GC`), Link Slab (`LTNR`),
 * Expansion Joint (`KCGR`), and Concrete Barrier Yield-Line (`GLCR`) Solvers.
 *
 * Clean-room TypeScript port of:
 *  - `analysis-cau-cong/modules/10_superstructure_ui_and_deck_joints.js` (lines 2577–6270)
 *
 * Standards:
 *  - TCVN 11823-3:2017 / 4 / 5 / 9 / 13 / 14 (AASHTO LRFD 7th Ed. 2014)
 *  - Link slab rotation moment & axial restraint: Caner & Zia (1998)
 */

import type { DeckComponentSummary, GirderResult, Point2D } from '../../types/project.ts';
import { $, fx, getOutputValue, num, nums, setOutputValue } from '../context.ts';
import { dgKit, dgPut, xEdges } from '../../graphics/svgPrimitives.ts';
import { mathAll } from '../../graphics/texMath.ts';
import { itOffSet, objLinkOff } from './crossfall.ts';
import {
  DAM,
  getLatestDamResult,
  getLatestRcgResult,
  rcgLoadLib,
  registerGirderHollowHooks,
  spV,
  type DamCalcResult,
  type DamCompositeResult,
  type DamSpInput,
  type RcCalcResult,
} from './girderHollow.ts';
import {
  getLatestGirResult,
  giLink,
  giLoadLib,
  giStep,
  type GiCalcResult,
  type GiCompositeResult,
} from './girderI.ts';

// ---------------------------------------------------------------------------
// 1. Domain Interfaces & Types
// ---------------------------------------------------------------------------

export type AnyGirderBranch = DamCalcResult | RcCalcResult | GiCalcResult;
export type AnyDamResult = DamCompositeResult | GiCompositeResult;

export interface KdCheckRow {
  nm: string;
  DC: number;
  DW: number;
  LL: number;
  Ru: number;
  Rs: number;
  bw: number;
  sn: string;
  bk: number;
  A1: number;
  Pn: number;
  Pr: number;
  sig: number;
  ok: boolean;
}

export interface KdStepResult {
  kd: true;
  BR: number;
  Gmax: number;
  A: number;
  hrt: number;
  C: { nb: number; eSh: number };
  cap: number;
  chk: KdCheckRow[];
  ok: boolean;
}

export interface BmInput {
  typeI: boolean;
  bf: number;
  dB: number;
  sB: number;
  dT: number;
  sT: number;
  dLB: number;
  sLB: number;
  dLT: number;
  sLT: number;
  ct: number;
  cb: number;
}

export interface BmMomentRow {
  x: number;
  DC: number;
  DW: number;
  LL: number;
  Mu: number;
  Ms: number;
}

export interface BmGovPlacement {
  v: number;
  x: number;
  W: number[];
  m: number;
  k: number;
}

export interface BmSectResult {
  As: number;
  d: number;
  a: number;
  c: number;
  et: number;
  phi: number;
  Mr: number;
  Mcr: number;
  Mmin: number;
  x: number;
  Icr: number;
  fss: number;
  ge: number;
  bs: number;
  smax: number;
  dc: number;
  s?: number;
}

export interface BmResult {
  xs: number[];
  xL: number;
  xR: number;
  face: number;
  bf: number;
  h: number;
  ts: number;
  E1: number;
  E2: number;
  lp: number;
  xmin: number;
  xmax: number;
  secP: number[];
  secN: number[];
  envP: number[];
  envN: number[];
  rowsP: BmMomentRow[];
  rowsN: BmMomentRow[];
  gP: BmMomentRow;
  gN: BmMomentRow;
  govP: BmGovPlacement | null;
  govN: BmGovPlacement | null;
  fDC: (x: number) => number;
  fDW: (x: number) => number;
  P: BmSectResult;
  N: BmSectResult;
  dv: number;
  Vc: number;
  Vr: number;
  Vu: number;
  Ast: number;
  smaxT: number;
  AsLB: number;
  AsLT: number;
  Se: number;
  pct: number;
  AsDist: number;
  n: number;
  Ec: number;
  curb: number;
  rail: number;
  side: number;
  lay: Array<[string, number, number, number]>;
  ctOK?: boolean;
  ctMin?: number;
  cbOK?: boolean;
  items?: Array<[string, boolean]>;
  oh?: BmOhResult;
  allOK?: boolean;
}

export interface BmOhInput {
  dT: number;
  sT: number;
  ct: number;
  dTa: number;
  sTa: number;
}

export interface BmOhCapResult {
  F: number;
  a: number;
  c: number;
  et: number;
  phi: number;
  Mr: number;
  Mt: number;
}

export interface BmOhCase1Item extends BmOhCapResult {
  t: string;
  Rw: number;
  Lc: number;
  T: number;
  Mc: number;
  Mu: number;
}

export interface BmOhCase2Item extends BmOhCapResult {
  Fv: number;
  Lv: number;
  Mv: number;
  Mu: number;
}

export interface BmOhPunchingItem {
  t: string;
  Wb: number;
  D: number;
  bc: number;
  vc: number;
  Bm: number;
  b0: number;
  Vn: number;
  Vr: number;
  Vu: number;
}

export interface BmOhResult {
  na: boolean;
  oh: number;
  PS?: BmOhPunchingItem[] | null;
  sEq?: number;
  xv?: number;
  VLLv?: number;
  xd?: number;
  Le?: number;
  xg?: number;
  xw?: number;
  X?: number;
  E?: number;
  h?: number;
  ts?: number;
  d?: number;
  As?: number;
  DCs?: number;
  MDCs?: number;
  Pcurb?: number;
  xc?: number;
  Prail?: number;
  xr?: number;
  MDCb?: number;
  side?: number;
  Mside?: number;
  DW?: number;
  MDW?: number;
  PLq?: number;
  MPL?: number;
  VPL?: number;
  P?: number;
  m?: number;
  IM?: number;
  aw?: number;
  MLL?: number;
  VLL?: number;
  DCt?: number;
  VDC?: number;
  Mu3?: number;
  Ms3?: number;
  Vu3?: number;
  C1?: Array<{ t: string; Rw: number; Lc: number; T: number; Mc: number; Mu: number }>;
  C2?: { Fv: number; Lv: number; Mv: number; Mu: number } | null;
  S3?: BmOhCapResult;
  Sx?: BmOhCase1Item[];
  Sv?: BmOhCase2Item | null;
  Mcr?: number;
  Mmin?: number;
  x?: number;
  fss?: number;
  dc?: number;
  bs?: number;
  smax?: number;
  dv?: number;
  Vr?: number;
  ok?: {
    s3: boolean;
    min: boolean;
    cr: boolean;
    v: boolean;
    c1: boolean;
    c2: boolean;
    ps: boolean;
  };
  items?: Array<[string, boolean]>;
  GL?: boolean;
}

export interface GcBearingInput {
  L: number;
  W: number;
  n: number;
  hri: number;
  hc: number;
  hs: number;
  Fy: number;
  dFTH: number;
  G: number;
  tol: number;
  nb: number;
  Tmax: number;
  Tmin: number;
  eSh: number;
  Lexp: number | null;
}

export interface GcReactionInput {
  DC: number;
  DW: number;
  LL: number;
  thSt: number;
  thCy: number;
  dcr: number;
  dDeck: number;
  dLL: number;
}

export interface GcStabCheck {
  A: number;
  B: number;
  ok: boolean;
  lim: number;
}

export interface GcGirderCheck {
  So: number;
  oa_st: number;
  oa_cy: number;
  or_st: number;
  or_cy: number;
  sumO: number;
  tag: string;
  R: GcReactionInput;
  Pst: number;
  Pcy: number;
  sst: number;
  scy: number;
  ss: number;
  th_st: number;
  th_cy: number;
  ga_st: number;
  ga_cy: number;
  gr_st: number;
  gr_cy: number;
  gs_st: number;
  gs_cy: number;
  sum: number;
  st1: GcStabCheck;
  st2: GcStabCheck | null;
  hs1: number;
  hs2: number;
  ea: number;
  thT: number;
  needAnchor: boolean;
  dl_st: number;
  dl_cy: number;
  Hu: number;
}

export interface GcProposal {
  Q: GcCalcResult;
  sc: number;
  n: number;
  hri: number;
  hc: number;
  hs: number;
}

export interface GcCalcResult {
  L: number;
  W: number;
  A: number;
  n: number;
  hri: number;
  hc: number;
  hrt: number;
  Htot: number;
  Si: number;
  neff: number;
  Gn: number;
  Gmin: number;
  Gmax: number;
  Lb: number;
  dTher: number;
  dSh: number;
  Ds: number;
  BR: number;
  BR1: number;
  nbAll: number;
  Hbr: number;
  rg: GcGirderCheck;
  rb: GcGirderCheck;
  hcOK: boolean;
  GOK: boolean;
  shOK: boolean;
  stOK: boolean;
  applA: number;
  C?: GcBearingInput;
  allOK?: boolean;
  bestProposal?: GcProposal | null;
}

export interface Sup2Result {
  bm?: BmResult;
  gc?: GcCalcResult | KdStepResult | null;
  changed?: boolean;
}

export interface LtnInput {
  n: number;
  Lc: number;
  gap: number;
  h: number;
  fc: number;
  fy: number;
  dT: number;
  sT: number;
  aT: number;
  dB: number;
  sB: number;
  aB: number;
  dTr: number;
  sTr: number;
  ge: number;
  Tmax: number;
  Tmin: number;
  Tc: number;
}

export interface LtnRotationResult {
  L: number;
  EI: number;
  tv: number;
  vn: string;
  tl: number;
  DF: number;
  IM: number;
  tLL: number;
  tDC: number;
  tDW: number;
  tvF: number;
  DFf: number;
  tF: number;
  tTGp: number;
  tTGn: number;
  MLL: number;
  MDC: number;
  MDW: number;
  MF: number;
  MTGp: number;
  MTGn: number;
  Mu: number;
  Ms: number;
  MuP: number;
}

export interface LtnMnResult {
  c: number;
  a: number;
  et: number;
  fs: number;
  fsc: number;
  Cc: number;
  Cs: number;
  Mcap: number;
  Nn: number;
  Mreq: number;
  phi: number;
  ratio: number;
}

export interface LtnCalcResult {
  k4: number;
  gTG: number;
  MuP: number;
  dBt: number;
  aP: number;
  MrP: number;
  rF: LtnRotationResult;
  fyF: number;
  dfF: number;
  fminF: number;
  dFTH: number;
  Esl: number;
  Isl: number;
  k2: number;
  rg: LtnRotationResult;
  rb: LtnRotationResult;
  rc: LtnRotationResult;
  BR: number;
  NBR: number;
  kb: number;
  K: number;
  xs: number[];
  xc: number;
  eSh: number;
  eT: number;
  eC: number;
  NTt: number;
  NTc: number;
  NSh: number;
  jMax: number;
  Nu: number;
  Ns: number;
  AsT: number;
  AsB: number;
  dT: number;
  b1: number;
  a0f: number;
  pf: null;
  Mr0: number;
  MN: LtnMnResult;
  Nr: number;
  fr: number;
  Sc: number;
  Mcr: number;
  Mmin: number;
  nE: number;
  rho: number;
  kk: number;
  jj: number;
  fss: number;
  dc: number;
  bs: number;
  smax: number;
  Vu: number;
  dv: number;
  Vr: number;
  Ast: number;
  smaxT: number;
  AsTr: number;
  ctMin: number;
  ct: number;
  cb: number;
  Ldz: number;
  Lexp: number;
  P?: LtnInput;
  allOK?: boolean;
}

export interface KcgInput {
  Tmax: number;
  Tmin: number;
  Tins: number;
  t1: number;
  t2: number;
  a: number;
  b: number;
  mu: number;
  L: number;
  mode: string;
  q: number;
  k: number;
  Dmin: number;
  Dmax: number;
  dA: number;
}

export interface KcgCalcResult {
  dT: number;
  L: number;
  Lt: number;
  Dsh: number;
  DshN: number;
  DshP: number;
  Dt: number;
  DtN: number;
  DtP: number;
  D1: number;
  Dop: number;
  D2: number;
  Dtot: number;
  kD1: number;
  kD2: number;
  kDtot: number;
  DL: number;
  DLN: number;
  m1: number;
  m2: number;
  avg: number;
  Dins: number;
  slope: number;
  Dt1: number;
  Dt2: number;
  chkMax: number;
  okMax: boolean;
  chkMin: number;
  okMin: boolean;
  okRange: boolean;
  ok: boolean;
  P?: KcgInput;
  n?: number;
  allOK?: boolean;
}

export interface GlTlSpec {
  Ft: number;
  FL: number;
  Fv: number;
  Lt: number;
  Lv: number;
  He: number;
  Hmin: number;
}

export interface GlBlockVertInput {
  hs: number;
  b: number;
  n: number;
  d: number;
  dsc: number;
}

export interface GlBlockHorizInput {
  hs: number;
  n: number;
  d: number;
  dsc: number;
}

export interface GlInput {
  tl: string;
  poly: Point2D[];
  bars: Point2D[];
  bw: GlBlockVertInput[];
  bc: GlBlockHorizInput[];
  fc: number;
  fy: number;
  phi: number;
  Mb: number;
  gc: number;
  lav: number;
  cvr: boolean;
  fcd: number;
  sv: number;
  nleg: number;
  bi: number;
  Hra: number;
  rails: number[][];
  sfy: number;
  sL: number;
  pb: number;
  ph: number;
  pt: number;
  pyc: number;
  bn: number;
  bd: number;
  bfu: number;
  blev: number;
  c: number;
  mu: number;
  K1: number;
  K2: number;
  dTd: number;
  sTd: number;
  ctd: number;
  oh?: number;
}

export interface GlBlockRes {
  hs: number;
  b: number;
  n: number;
  d: number;
  dsc: number;
  Asy: number;
  ds: number;
  b1: number;
  c: number;
  a: number;
  Mn: number;
  phi: number;
  Mr: number;
}

export interface GlRailComb1 {
  R: number;
  Y: number;
  ok?: boolean;
}

export interface GlRailComb2 {
  Rw2: number;
  R: number;
  Y: number;
  ok?: boolean;
}

export interface GlRailResult {
  rails: Array<{ D: number; t: number; y: number; Z: number; Mp: number }>;
  Mp: number;
  yR: number;
  Hr: number;
  b: number;
  h: number;
  t: number;
  Zpo: number;
  MpPost: number;
  PpPost: number;
  Ab: number;
  Tn: number;
  MpBolt: number;
  PpBolt: number;
  Pp: number;
  NI: number;
  RI: number;
  NE: number;
  RE: number;
  R2: number;
  mI: GlRailComb1;
  mE: GlRailComb1;
  pI: GlRailComb2;
  pE: GlRailComb2;
}

export interface GlInterfaceCase {
  t: string;
  Rw: number;
  Lc: number;
  Vu: number;
  Avf: number;
  Pc: number;
  Acv: number;
  Vn: number;
  Vmax: number;
  Vr: number;
  T: number;
}

export interface GlDeckCheck {
  T: number;
  Ms: number;
  Mcap: number;
  Mreq: number;
  ok: boolean;
}

export interface GlcCalcResult {
  A: number;
  H: number;
  TL: GlTlSpec;
  Ft: number;
  Lt: number;
  W: GlBlockRes[];
  C: GlBlockRes[];
  Hb: number;
  Mw: number;
  Mc: number;
  Mb: number;
  I0: { Lc: number; Rw: number };
  E0: { Lc: number; Rw: number };
  lhb: number;
  lhb0: number;
  lmin: number;
  lminOK: boolean;
  rD: number;
  Cb: GlBlockRes;
  McBase: number;
  McU: number;
  LcI: number;
  RwI: number;
  LcE: number;
  RwE: number;
  comb: boolean;
  rail: boolean;
  Hra: number;
  RL: GlRailResult | null;
  Htot: number;
  cases: GlInterfaceCase[];
  deck: GlDeckCheck[];
  hD: number;
  AsD: number;
  dD: number;
  P?: GlInput;
  allOK?: boolean;
}

// ---------------------------------------------------------------------------
// 2. Module State & Getters / Setters
// ---------------------------------------------------------------------------

export let SUP2R: Sup2Result | null = null;
export let LTNR: LtnCalcResult | null = null;
export let KCGR: KcgCalcResult | null = null;
export let GLCR: GlcCalcResult | null = null;

export function getLatestSup2Result(): Sup2Result | null {
  return SUP2R;
}

export function setLatestSup2Result(result: Sup2Result | null): void {
  SUP2R = result;
}

export function getLatestLtnResult(): LtnCalcResult | null {
  return LTNR;
}

export function setLatestLtnResult(result: LtnCalcResult | null): void {
  LTNR = result;
}

export function getLatestKcgResult(): KcgCalcResult | null {
  return KCGR;
}

export function setLatestKcgResult(result: KcgCalcResult | null): void {
  KCGR = result;
}

export function getLatestGlcResult(): GlcCalcResult | null {
  return GLCR;
}

export function setLatestGlcResult(result: GlcCalcResult | null): void {
  GLCR = result;
}

export function ikOn(k: string | number): boolean {
  return !itOffSet().has(String(k));
}

// ---------------------------------------------------------------------------
// 3. Shared DOM & Report Formatting Helpers (Null-Safe for Headless Node)
// ---------------------------------------------------------------------------

function resolveRealDom(id: string): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return document.getElementById(id);
}

const djE = (s: unknown): string =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

const gF = (val: number | null | undefined, d = 2): string =>
  val == null || !Number.isFinite(val) ? '-' : fx(val, d);

const gR = (
  l: string,
  s: string,
  val: string | number | null | undefined,
  u: string,
  nt?: [boolean, string],
): string =>
  `<div class="row"><span></span><span>${l}</span><span class="sym">${s || ''}</span><span class="val">${val ?? ''}</span><span class="unit">${u || ''}</span>${nt ? `<span class="note ${nt[0] ? 'ok' : 'bad'}">${nt[1]}</span>` : ''}</div>`;

const gT = (t: string): string => `<div class="row"><span></span><span>${t}</span></div>`;

const gN = (t: string): string => `<div class="row small"><span></span><span>${t}</span></div>`;

const gM = (
  tex: string,
  s?: string,
  val?: string | number | null,
  u?: string,
  nt?: [boolean, string],
): string =>
  `<div class="row f"><span></span><span><span class="m" data-tex="${djE(tex)}"></span></span><span class="sym">${s || ''}</span><span class="val">${val ?? ''}</span><span class="unit">${u || ''}</span>${nt ? `<span class="note ${nt[0] ? 'ok' : 'bad'}">${nt[1]}</span>` : ''}</div>`;

const gH2 = (n: number, t: string): string => `<h2>${n}.&nbsp;&nbsp;${t}</h2>`;

const gOk = (ok: boolean, t?: string): string =>
  `<td class="c ${ok ? 'ok' : 'bad'}">${t || (ok ? 'OK' : 'NG')}</td>`;

const gKL = (ok: boolean, cols: number, note?: string): string =>
  `<tr><td class="l" colspan="${cols - 2}"><b>KẾT LUẬN</b>${note ? ' ' + note : ''}</td><td class="c ${ok ? 'ok' : 'bad'}" colspan="2"><b>${ok ? 'ĐẠT' : 'KHÔNG ĐẠT'}</b></td></tr>`;

const setOut = (id: string, val: string | number, d = 2): void => {
  const str = typeof val === 'number' ? fx(val, d) : String(val ?? '');
  const e = $(id);
  if (e) e.textContent = str;
  setOutputValue(id, str);
};

const okn = (id: string, ok: boolean, t?: string): void => {
  const txt = t || (ok ? 'OK' : 'NG');
  const e = $(id + 'n');
  if (e) {
    e.textContent = txt;
    e.className = 'note ' + (ok ? 'ok' : 'bad');
  }
  setOutputValue(id + 'n', txt);
};

const tbx = (id: string, h: string): void => {
  const e = $(id);
  if (e) e.innerHTML = h;
  setOutputValue(id, h);
};

const ok2 = (ok: boolean, t?: string | null, cs?: number): string =>
  `<td class="c ${ok ? 'ok' : 'bad'}"${cs ? ` colspan="${cs}"` : ''}>${t || (ok ? 'OK' : 'NG')}</td>`;

function klAppend(id: string, ok: boolean, cols: number, note?: string): void {
  const rowHtml = `<tr><td class="l" colspan="${cols - 2}"><b>KẾT LUẬN</b>${note ? ' ' + note : ''}</td><td class="c ${ok ? 'ok' : 'bad'}" colspan="2"><b>${ok ? 'ĐẠT' : 'KHÔNG ĐẠT'}</b></td></tr>`;
  const domEl = resolveRealDom(id);
  const e = domEl ?? $(id);
  if (e) {
    if (typeof e.insertAdjacentHTML === 'function') {
      e.insertAdjacentHTML('beforeend', rowHtml);
    } else {
      e.innerHTML = (e.innerHTML || '') + rowHtml;
    }
    setOutputValue(id, e.innerHTML);
  } else {
    const prev = getOutputValue(id) ?? '';
    setOutputValue(id, prev + rowHtml);
  }
}

function activeGirderComposite(override?: AnyDamResult | null): AnyDamResult | null {
  return override ?? getLatestDamResult() ?? getLatestGirResult() ?? getLatestRcgResult();
}

// ---------------------------------------------------------------------------
// 4. Superstructure Switcher (`supK`, `supLabel`, `supApply`, `supLink`, `kdStep`)
// ---------------------------------------------------------------------------

export function supK(): boolean {
  const e = $('sp_sup');
  return Boolean(e && e.value === 'K');
}

export const SUPK_TXT: ReadonlyArray<readonly [string, string, 1?]> = [
  ['mo_mu', 'Hệ số ma sát giữa dầm, lớp đệm và mặt mũ mố (lấy theo sheet dầm giữa, mục 1.1)'],
  [
    'o_moFR',
    'Lực ma sát gối trượt (Điều 12): dầm kê trực tiếp không có gối trượt ; lực ma sát do chuyển vị nhiệt, co ngót của kết cấu nhịp kể trong lực TU, CS dưới đây:',
    1,
  ],
  ['mo_Gb', 'Mô đun chống cắt của lớp đệm đàn hồi dưới đáy dầm (lấy theo sheet dầm giữa, mục 1.1)'],
  ['mo_bga', 'Chiều dài đoạn dầm kê trên mũ mố, theo phương dọc cầu'],
  ['mo_bgb', 'Bề rộng đáy dầm, theo phương ngang cầu'],
  ['o_moAb', 'Diện tích tiếp xúc của 1 đầu dầm với lớp đệm: Ab = ag.bg'],
  ['mo_hrt', 'Chiều dày lớp đệm'],
  ['mo_nbg', 'Số đầu dầm kê trên một mố'],
  [
    'o_moTU',
    'Lực do nhiệt độ thay đổi đều truyền qua lớp đệm (Điều 11.2), không lớn hơn lực ma sát giữa dầm và mặt mũ mố μ.(DC1 + DW):',
    1,
  ],
];

export const SUPK_TEX: Readonly<Record<string, readonly [string, string]>> = {
  o_moTU: [
    '\\Delta_u = \\alpha\\,\\Delta T\\,L_b\\ ;\\quad TU = n_b\\,\\dfrac{G\\,A_b\\,\\Delta_u}{h_{rt}}',
    '\\Delta_u = \\alpha\\,\\Delta T\\,L_b\\ ;\\quad TU = \\min\\left(n_b\\,\\dfrac{G\\,A_b\\,\\Delta_u}{h_{rt}}\\ ;\\ \\mu\\,(DC_1 + DW)\\right)',
  ],
  o_moCS: [
    '\\Delta_{cs} = \\varepsilon_{cs}\\,L_b\\ ;\\quad CS = n_b\\,\\dfrac{G\\,A_b\\,\\Delta_{cs}}{h_{rt}}\\quad (\\gamma_{SH},\\ \\gamma_{CR}\\ \\text{như } \\gamma_{TU})',
    '\\Delta_{cs} = \\varepsilon_{cs}\\,L_b\\ ;\\quad CS = \\min\\left(n_b\\,\\dfrac{G\\,A_b\\,\\Delta_{cs}}{h_{rt}}\\ ;\\ \\mu\\,(DC_1 + DW) - TU\\right)',
  ],
};

export const SUPK_TD: ReadonlyArray<readonly [string, string]> = [
  ['td_hb', 'Chiều dày lớp đệm dưới đáy dầm (dầm kê trực tiếp, không có gối, đá kê)'],
  ['td_Gb', 'Mô đun chống cắt lớp đệm đàn hồi'],
  ['td_ga', 'Diện tích tiếp xúc 1 đầu dầm: chiều dài kê × bề rộng đáy dầm'],
  ['td_hrt', 'Chiều dày lớp đệm'],
  ['td_nbg', 'Số lớp đệm dưới một đầu dầm'],
];

export function supLabel(
  el: Element | null | undefined,
  txt: string,
  K: boolean,
  prevRow?: boolean | number,
): void {
  if (!el || typeof document === 'undefined') return;
  let row = el.closest('.row') as HTMLElement | null;
  let lab: HTMLElement | null = null;
  if (row && prevRow) {
    row = row.previousElementSibling as HTMLElement | null;
    while (row && !row.classList.contains('row')) {
      row = row.previousElementSibling as HTMLElement | null;
    }
  }
  if (row && row.classList.contains('row')) {
    lab = (row.children[1] as HTMLElement | undefined) ?? null;
  } else {
    const tr = el.closest('tr');
    if (tr) lab = tr.querySelector('td.l') as HTMLElement | null;
  }
  if (!lab) return;
  if (lab.dataset.k0 == null) lab.dataset.k0 = lab.innerHTML;
  const want = K ? txt : lab.dataset.k0;
  if (lab.innerHTML !== want) lab.innerHTML = want;
}

export function supApply(): void {
  const K = supK();
  if (typeof document !== 'undefined') {
    document.querySelectorAll<HTMLElement>('[data-spk]').forEach((e) => {
      const on = e.dataset.spk === (K ? 'K' : 'G');
      e.hidden = !on;
      e.toggleAttribute('hidden', !on);
      e.classList.toggle('noprint', !on);
    });
    const b = document.querySelector<HTMLElement>('.tab[data-t="11"]');
    if (b) b.textContent = K ? '4. Kê dầm trên mố, trụ' : '4. Gối cầu';
    const t11 = document.getElementById('tab11');
    if (t11) {
      const h = t11.querySelector<HTMLElement>('h1.ttl');
      if (h) {
        h.textContent = K ? 'KIỂM TOÁN KÊ DẦM TRỰC TIẾP LÊN MŨ MỐ, XÀ MŨ TRỤ' : 'KIỂM TOÁN GỐI CẦU';
      }
      [...t11.children].forEach((child) => {
        const e = child as HTMLElement;
        if (e.classList.contains('ttl')) return;
        if (e.id === 'kdK') {
          e.style.display = K ? '' : 'none';
          e.classList.toggle('noprint', !K);
          return;
        }
        e.style.display = K ? 'none' : '';
        if (e.dataset.k1 == null) e.dataset.k1 = e.classList.contains('noprint') ? '1' : '0';
        e.classList.toggle('noprint', K || e.dataset.k1 === '1');
      });
    }
    SUPK_TXT.forEach(([id, t, prev]) => supLabel(resolveRealDom(id), t, K, prev));
    Object.entries(SUPK_TEX).forEach(([id, [t0, t1]]) => {
      const el = resolveRealDom(id);
      if (!el) return;
      const row = el.closest('.row');
      const m = row?.querySelector<HTMLElement>('.m');
      if (!m) return;
      const want = K ? t1 : t0;
      if (m.dataset.tex !== want) {
        m.dataset.tex = want;
        m.dataset.r = '';
      }
    });
    SUPK_TD.forEach(([id, t]) => supLabel(resolveRealDom(id), t, K, false));
    {
      const kl = resolveRealDom('o_mokL');
      const row = kl?.closest('.row') ?? null;
      const p = row?.previousElementSibling ?? null;
      if (p && p.classList.contains('row')) {
        const lab = p.children[1] as HTMLElement | undefined;
        if (lab) {
          if (lab.dataset.k0 == null) lab.dataset.k0 = lab.innerHTML;
          const w = K
            ? lab.dataset.k0.replace(
                /gối trượt kL = 0\)/,
                'gối trượt kL = 0 ; dầm kê trực tiếp lên mũ mố kL = 1)',
              )
            : lab.dataset.k0;
          if (lab.innerHTML !== w) lab.innerHTML = w;
        }
      }
    }
    mathAll();
  }
}

export function supLink(options?: { damResult?: AnyDamResult | null }): boolean {
  const K = supK();
  if (objLinkOff()) return false;
  let ch = false;
  const ro = (id: string, val: number): void => {
    const e = $(id);
    if (!e) return;
    if (K) {
      const s = String(+(+val).toFixed(6));
      if (e.value !== s) {
        e.value = s;
        ch = true;
      }
      e.readOnly = true;
      e.classList?.add('lnk');
      if (e.dataset) e.dataset.supk = '1';
      e.title = 'Dầm kê trực tiếp lên mũ mố, xà mũ trụ: lấy theo sheet dầm giữa, mục 1.1';
    } else if (e.dataset?.supk === '1') {
      e.readOnly = false;
      e.classList?.remove('lnk');
      e.dataset.supk = '';
      e.title = '';
    }
  };
  const sel = (id: string, val: string): void => {
    const e = $(id);
    if (!e) return;
    if (K) {
      if (e.value !== val) {
        e.value = val;
        ch = true;
      }
      e.disabled = true;
      e.classList?.add('lnk');
      if (e.dataset) e.dataset.supk = '1';
    } else if (e.dataset?.supk === '1') {
      if (e.value === val && e.options && e.options.length > 0) {
        e.value = e.options[0].value;
      }
      e.disabled = false;
      e.classList?.remove('lnk');
      e.dataset.supk = '';
      ch = true;
    }
  };
  const D = activeGirderComposite(options?.damResult);
  const I = D?.I;
  const gg = D?.GG as { g?: { dd?: Point2D[] } } | undefined;
  const P = gg?.g?.dd;
  const bw = P
    ? (() => {
        const xs = P.filter((p) => p[1] < 1).map((p) => p[0]);
        return xs.length > 1 ? (Math.max(...xs) - Math.min(...xs)) / 1000 : I ? I.S : 1;
      })()
    : 1;
  const tp = spV('sp_tpad') || 0.02;
  const Gp = spV('sp_Gpad') || 1000;
  const mu = spV('sp_mupad') || 0.6;
  const bk1 = spV('sp_bk1') || 0.5;
  const bk2 = spV('sp_bk2') || 0.5;
  const Ng = I ? I.Ng : Math.round(spV('sp_Ng'));
  sel('mo_goi', 'K');
  ro('mo_dkh', 0);
  ro('mo_dkn', 0);
  ro('mo_hbg', tp);
  ro('mo_bga', bk1);
  ro('mo_bgb', bw);
  ro('mo_nbg', Ng);
  ro('mo_hrt', tp);
  ro('mo_Gb', Gp);
  ro('mo_mu', mu);
  ro('mo_unn', 0);
  sel('td_brt', '2');
  ro('td_hb', tp);
  ro('td_ga', bk2);
  ro('td_gb2', bw);
  ro('td_nbg', 1);
  ro('td_hrt', tp);
  ro('td_Gb', Gp);
  ro('dt_dkh', 0);
  supApply();
  return ch;
}

export function kdStep(
  I: DamSpInput,
  options?: { damResult?: AnyDamResult | null },
): KdStepResult | null {
  const box = $('kdK');
  const D = activeGirderComposite(options?.damResult);
  if (!supK() || !D || !D.g) {
    if (box) box.innerHTML = '';
    setOutputValue('kdK', '');
    return null;
  }
  const g = D.g as AnyGirderBranch;
  const b = (D.b as AnyGirderBranch | undefined) || g;
  const F = gF;
  const eta = D.type === 'RC' ? (g as RcCalcResult).eta : 1;
  const fc = Math.min(I.fc, spV('sp_fck') || I.fc);
  const phi = 0.7;
  const bk1 = spV('sp_bk1');
  const bk2 = spV('sp_bk2');
  const tp = spV('sp_tpad');
  const Gp = spV('sp_Gpad');
  const mu = spV('sp_mupad');
  const gg = (D.GG || {}) as { g?: { dd?: Point2D[] }; b?: { dd?: Point2D[] } };
  const bw = (q?: { dd?: Point2D[] }): number => {
    const xs = ((q && q.dd) || []).filter((p) => p[1] < 1).map((p) => p[0]);
    return xs.length > 1 ? Math.max(...xs) - Math.min(...xs) : I.S * 1000;
  };
  const bG = bw(gg.g);
  const bB = bw(gg.b);
  const LLof = (R: AnyGirderBranch): number => {
    const rg = R.Rg as { DC: number; DW: number; LL?: number } | undefined;
    if (rg && rg.LL != null) return rg.LL;
    const r0 = R.res?.[0] as { VLL?: number; VLLt?: number } | undefined;
    if (r0 && r0.VLL != null) return r0.VLL;
    if (r0 && r0.VLLt != null) return r0.VLLt;
    return 0;
  };
  const rx = (R: AnyGirderBranch, nm: string, bwid: number) => {
    const DC = R.Rg.DC;
    const DW = R.Rg.DW;
    const LL = LLof(R);
    const Ru = eta * (1.25 * DC + 1.5 * DW + 1.75 * LL);
    const Rs = DC + DW + LL;
    return { nm, DC, DW, LL, Ru, Rs, bw: bwid };
  };
  const rows = [rx(g, 'Dầm giữa', bG), rx(b, 'Dầm biên', bB)];
  const sups: Array<[string, number]> = [
    ['Mũ mố', bk1],
    ['Xà mũ trụ', bk2],
  ];
  const chk: KdCheckRow[] = [];
  rows.forEach((r) =>
    sups.forEach(([sn, bk]) => {
      const A1 = r.bw * bk * 1000;
      const Pn = (0.85 * fc * A1) / 1e3;
      const Pr = phi * Pn;
      const sig = (r.Rs * 1e3) / A1;
      chk.push({ ...r, sn, bk, A1, Pn, Pr, sig, ok: Pr >= r.Ru });
    }),
  );
  const Ab = bG * bk2 * 1000;
  const kpad = ((Gp / 1000) * Ab) / (tp * 1000) / 1000;
  const Hf = mu * (g.Rg.DC + g.Rg.DW);

  let h = `<p class="small">Dầm kê trực tiếp lên mũ mố, xà mũ trụ qua lớp đệm dày tđ = ${F(tp * 1000, 0)} mm, không có gối cầu và đá kê gối. Phản lực lấy theo sheet kiểm toán dầm giữa, dầm biên ; kiểm toán ép mặt bê tông vùng kê theo TCVN 11823-5, Điều 7.5. Đơn vị: kN, mm, MPa.</p>`;
  h +=
    gH2(1, 'SỐ LIỆU') +
    gR(
      'Chiều dài đoạn dầm kê trên mũ mố (từ đầu dầm đến mép trước mũ mố)',
      'bk1',
      F(bk1 * 1000, 0),
      'mm',
    ) +
    gR(
      'Chiều dài đoạn dầm kê trên xà mũ trụ (từ đầu dầm đến mép xà mũ)',
      'bk2',
      F(bk2 * 1000, 0),
      'mm',
    ) +
    gR('Bề rộng đáy dầm giữa ; dầm biên', 'bd', F(bG, 0) + ' ; ' + F(bB, 0), 'mm') +
    gR(
      'Chiều dày lớp đệm ; mô đun chống cắt lớp đệm',
      'tđ ; Gđ',
      F(tp * 1000, 0) + ' ; ' + F(Gp, 0),
      'mm ; kPa',
    ) +
    gR(
      `Cường độ chịu nén bê tông tính ép mặt: giá trị nhỏ hơn của bê tông dầm (${F(I.fc, 0)} MPa) và bê tông mũ mố, xà mũ (${F(spV('sp_fck'), 0)} MPa)`,
      "f'c",
      F(fc, 0),
      'MPa',
    ) +
    gR('Hệ số sức kháng ép mặt trên bê tông (TCVN 11823-5, Điều 5.4.2.1)', 'φb', F(phi, 2), '') +
    gR('Hệ số điều chỉnh tải trọng TTGH Cường độ', 'η', F(eta, 3), '');
  h +=
    gH2(2, 'PHẢN LỰC MỘT ĐẦU DẦM') +
    `<table class="t dt"><tr><th colspan="3">Dầm</th><th>DC</th><th>DW</th><th>LL + IM + PL</th><th>Cường độ I Ru</th><th>Sử dụng I</th></tr>` +
    rows
      .map(
        (r) =>
          `<tr><td class="l" colspan="3">${r.nm}</td><td>${F(r.DC, 2)}</td><td>${F(r.DW, 2)}</td><td>${F(r.LL, 2)}</td><td><b>${F(r.Ru, 2)}</b></td><td>${F(r.Rs, 2)}</td></tr>`,
      )
      .join('') +
    `<tr><td class="l" colspan="8">Ru = η.(1,25DC + 1,5DW + 1,75(LL + IM + PL)) ; LL lấy bằng lực cắt hoạt tải tại tim kê đã nhân hệ số phân bố lực cắt.</td></tr></table>`;
  h +=
    gH2(3, 'KIỂM TOÁN ÉP MẶT VÙNG KÊ DẦM (TCVN 11823-5, Điều 7.5)') +
    gM('P_r = \\phi_b\\,P_n\\ ;\\quad P_n = 0.85\\,f\'_c\\,A_1\\,m\\ ;\\quad A_1 = b_d\\,b_k') +
    gT(
      'Vùng kê nằm sát mép mũ mố, xà mũ nên không kể hệ số tăng cường do diện tích chịu tải A2 rộng hơn A1: lấy m = 1,0. Ép mặt kiểm toán cho cả bê tông đầu dầm và bê tông mũ mố, xà mũ (lấy f\'c nhỏ hơn). Phản lực giả thiết phân bố đều trên diện tích tiếp xúc qua lớp đệm đàn hồi.',
    ) +
    `<table class="t dt"><tr><th>Dầm</th><th>Vị trí kê</th><th>bk (mm)</th><th>A1 (mm²)</th><th>Pn (kN)</th><th>Pr (kN)</th><th>Ru (kN)</th><th>σ sử dụng (MPa)</th><th>KL</th></tr>` +
    chk
      .map(
        (c) =>
          `<tr><td class="l">${c.nm}</td><td class="l">${c.sn}</td><td>${F(c.bk * 1000, 0)}</td><td>${F(c.A1, 0)}</td><td>${F(c.Pn, 1)}</td><td>${F(c.Pr, 1)}</td><td>${F(c.Ru, 2)}</td><td>${F(c.sig, 3)}</td>${gOk(c.ok)}</tr>`,
      )
      .join('') +
    `</table>`;
  h +=
    gH2(4, 'LỰC NGANG TRUYỀN QUA LỚP ĐỆM') +
    gT(
      'Lực dọc cầu do nhiệt độ, co ngót, từ biến truyền từ dầm xuống mũ mố, xà mũ qua biến dạng cắt của lớp đệm và không lớn hơn lực ma sát giữa dầm, lớp đệm và mặt bê tông; lực hãm xe truyền toàn bộ xuống mố, trụ (thiên về an toàn). Các giá trị này được chuyển sang sheet tải trọng mố, trụ:',
    ) +
    gM(
      'k = \\dfrac{G\\,A_b}{t}\\ ;\\quad H_{max} = \\mu\\,(R_{DC} + R_{DW})',
      'kđ',
      F(kpad, 1),
      'kN/mm',
    ) +
    gN(
      'G, t - mô đun chống cắt, chiều dày lớp đệm ; μ - hệ số ma sát dầm - lớp đệm - mặt bê tông ; RDC, RDW - phản lực tĩnh tải 1 đầu dầm.',
    ) +
    gR('Diện tích tiếp xúc 1 đầu dầm giữa trên xà mũ trụ', 'Ab', F(Ab, 0), 'mm2') +
    gR('Hệ số ma sát dầm - lớp đệm - mặt bê tông', 'μđ', F(mu, 2), '') +
    gR('Lực ngang lớn nhất truyền qua lớp đệm của 1 đầu dầm giữa', 'Hmax', F(Hf, 2), 'kN');
  const ok = chk.every((c) => c.ok);
  h +=
    gH2(5, 'TỔNG HỢP KẾT QUẢ') +
    `<table class="t dt"><tr><th colspan="8">Hạng mục kiểm toán</th><th colspan="2">KL</th></tr>` +
    chk
      .map(
        (c) =>
          `<tr><td class="l" colspan="8">Ép mặt vùng kê - ${c.nm.toLowerCase()} trên ${c.sn.toLowerCase()}: Ru = ${F(c.Ru, 1)} ≤ Pr = ${F(c.Pr, 1)} kN</td>${gOk(c.ok).replace('<td', '<td colspan="2"')}</tr>`,
      )
      .join('') +
    gKL(ok, 10) +
    `</table>`;

  if (box) box.innerHTML = h;
  setOutputValue('kdK', h);
  if (typeof document !== 'undefined') mathAll();

  const m = I.nL === 1 ? 1.2 : I.nL === 2 ? 1 : I.nL === 3 ? 0.85 : 0.65;
  const Lsm = I.Lt - 2 * I.a0;
  const BR1 = Math.max(0.25 * 325, 0.05 * (325 + 9.3 * Lsm), 0.25 * 220, 0.05 * (220 + 9.3 * Lsm));
  const gWithShr = g as { eSh?: number; shr?: { eps_bdf?: number } };
  const eSh = gWithShr.eSh != null ? gWithShr.eSh : gWithShr.shr?.eps_bdf ?? 0;

  return {
    kd: true,
    BR: BR1 * I.nL * m,
    Gmax: Gp / 1000,
    A: Ab,
    hrt: tp * 1000,
    C: { nb: 1, eSh },
    cap: mu * I.Ng * (g.Rg.DC + g.Rg.DW),
    chk,
    ok,
  };
}

export function bindDeckJointEvents(onRun?: () => void): void {
  if (typeof document === 'undefined') return;
  const rcLoadBtn = document.getElementById('rc_load');
  if (rcLoadBtn) rcLoadBtn.onclick = () => rcgLoadLib();
  const supEl = document.getElementById('sp_sup');
  if (supEl && supEl.dataset.supBound !== '1') {
    supEl.dataset.supBound = '1'; // gắn một lần (khởi tạo lại không nhân đôi listener)
    supEl.addEventListener('change', () => {
      try {
        supApply();
      } catch {
        // ignore
      }
      try {
        onRun?.();
      } catch (e) {
        console.error(e);
      }
    });
  }
}

export function initDeckJointsHooks(): void {
  registerGirderHollowHooks({
    supK,
    supApply,
    supLink: () => supLink(),
    giStep: (I, LIM) => {
      giStep(I, LIM);
    },
    giLink,
    giLoadLib: () => giLoadLib(),
  });
}

initDeckJointsHooks();

// ---------------------------------------------------------------------------
// 5. Deck Slab (`stripSolve`, `bmCalc`, `bmSumRender`, `bmOhCalc`, `bmOhStep`)
// ---------------------------------------------------------------------------

export function stripSolve(
  xs: readonly number[],
  loads: ReadonlyArray<readonly [number, number]>,
  _xL?: number,
  _xR?: number,
): (x: number) => number {
  const n = xs.length;
  const S = n > 1 ? xs[1] - xs[0] : 1;
  const Ms = new Array<number>(n).fill(0);
  loads.forEach(([x, P]) => {
    if (x < xs[0]) Ms[0] -= P * (xs[0] - x);
    if (x > xs[n - 1]) Ms[n - 1] -= P * (x - xs[n - 1]);
  });
  if (n > 2) {
    const m = n - 2;
    const a = new Array<number>(m).fill(1);
    const b = new Array<number>(m).fill(4);
    const c = new Array<number>(m).fill(1);
    const d = new Array<number>(m).fill(0);
    loads.forEach(([x, P]) => {
      for (let j = 1; j < n; j++) {
        const x0 = xs[j - 1];
        const x1 = xs[j];
        if (x > x0 && x < x1) {
          const aL = x - x0;
          const bR = x1 - x;
          if (j - 1 >= 1) d[j - 2] -= (P * bR * (S * S - bR * bR)) / (S * S);
          if (j <= n - 2) d[j - 1] -= (P * aL * (S * S - aL * aL)) / (S * S);
        }
      }
    });
    d[0] -= Ms[0];
    d[m - 1] -= Ms[n - 1];
    for (let i = 1; i < m; i++) {
      const w = a[i] / b[i - 1];
      b[i] -= w * c[i - 1];
      d[i] -= w * d[i - 1];
    }
    const z = new Array<number>(m);
    z[m - 1] = d[m - 1] / b[m - 1];
    for (let i = m - 2; i >= 0; i--) z[i] = (d[i] - c[i] * z[i + 1]) / b[i];
    for (let i = 0; i < m; i++) Ms[i + 1] = z[i];
  }
  return (x: number): number => {
    if (x <= xs[0]) {
      let M = 0;
      loads.forEach(([p, P]) => {
        if (p < x) M -= P * (x - p);
      });
      return M;
    }
    if (x >= xs[n - 1]) {
      let M = 0;
      loads.forEach(([p, P]) => {
        if (p > x) M -= P * (p - x);
      });
      return M;
    }
    let j = 1;
    while (j < n - 1 && x > xs[j]) j++;
    const x0 = xs[j - 1];
    const x1 = xs[j];
    const t = (x - x0) / S;
    let M0 = 0;
    loads.forEach(([p, P]) => {
      if (p > x0 && p < x1) {
        M0 += p <= x ? (P * (p - x0) * (x1 - x)) / S : (P * (x - x0) * (x1 - p)) / S;
      }
    });
    return M0 + Ms[j - 1] * (1 - t) + Ms[j] * t;
  };
}

export function bmCalc(I: DamSpInput, B: BmInput): BmResult {
  const Wb = I.Wb;
  const Ng = I.Ng;
  const S = I.S;
  const hs = I.hs;
  const hw = I.hwear;
  const h = (hs - hw) * 1000;
  const ts = hs * 1000;
  const xs = Array.from({ length: Ng }, (_, i) => (i - (Ng - 1) / 2) * S);
  const xL = -Wb / 2;
  const xR = Wb / 2;
  const bf = B.bf / 1000;
  const face = B.typeI ? Math.min(bf / 3, 0.38, S / 2) : Math.min(bf / 2, S / 2);

  const dx = 0.025;
  const DCl: Array<[number, number]> = [];
  const DWl: Array<[number, number]> = [];
  for (let x = xL + dx / 2; x < xR; x += dx) {
    DCl.push([x, I.gc * hs * dx]);
  }
  const curb = I.gc * I.Apa;
  const rail = I.Pra / I.Lt / 2;
  const side = (I.gc * (I.APL || 0)) / 2;
  [-1, 1].forEach((sg) => {
    DCl.push([sg * (Wb / 2 - I.Wpa / 2), curb]);
    DCl.push([sg * (Wb / 2 - I.Wpa * 0.3), rail]);
    if (I.WPL > 0 && side > 0) {
      for (let x = Wb / 2 - I.Wpa - I.WPL + dx / 2; x < Wb / 2 - I.Wpa; x += dx) {
        DCl.push([sg * x, (side * dx) / I.WPL]);
      }
    }
  });
  const xa = -(Wb / 2 - I.Wpa - I.WPL);
  const xb = -xa;
  if (I.Hsu > 0) {
    for (let x = xa + dx / 2; x < xb; x += dx) DWl.push([x, I.gsu * I.Hsu * dx]);
  }
  const fDC = stripSolve(xs, DCl, xL, xR);
  const fDW = stripSolve(xs, DWl, xL, xR);

  const Pw = 72.5;
  const lp = (510 + ts) / 1000;
  const np = 9;
  const E1 = (660 + 0.55 * S * 1000) / 1000;
  const E2 = (1220 + 0.25 * S * 1000) / 1000;
  const wheel = (xc: number): Array<[number, number]> =>
    Array.from({ length: np }, (_, i) => [xc - lp / 2 + (lp * (i + 0.5)) / np, Pw / np]);
  const xmin = xa + 0.6;
  const xmax = xb - 0.6;
  const nLmax = Math.max(1, I.nL);
  const mOf = (k: number): number => (k === 1 ? 1.2 : k === 2 ? 1 : k === 3 ? 0.85 : 0.65);

  const secP: number[] = [];
  for (let j = 1; j < Ng; j++) {
    for (let t = 0.05; t < 0.96; t += 0.05) secP.push(xs[j - 1] + t * S);
  }
  const secN: number[] = [];
  xs.forEach((x, i) => {
    if (i > 0) secN.push(x - face);
    if (i < Ng - 1) secN.push(x + face);
  });
  const envP = secP.map(() => -1e9);
  const envN = secN.map(() => 1e9);
  const envV = secN.map(() => 0);
  let govP: BmGovPlacement | null = null;
  let govN: BmGovPlacement | null = null;
  const step = 0.025;
  for (let k = 1; k <= nLmax; k++) {
    const m = mOf(k);
    const span = k * 1.8 + (k - 1) * 1.2;
    if (span > xmax - xmin + 1e-9 && k > 1) break;
    for (let x0 = xmin; x0 <= xmax - 1.8 * (k > 0 ? 1 : 0) - (k - 1) * 3.0 + 1e-9; x0 += step) {
      const ws: number[] = [];
      for (let q = 0; q < k; q++) {
        const a = x0 + q * 3.0;
        ws.push(a, a + 1.8);
      }
      if (ws[ws.length - 1] > xmax + 1e-9) continue;
      const sets = [ws];
      sets.forEach((W) => {
        const L: Array<[number, number]> = [];
        W.forEach((xc) => L.push(...wheel(xc)));
        const f = stripSolve(xs, L, xL, xR);
        secP.forEach((x, i) => {
          const val = m * f(x);
          if (val > envP[i]) {
            envP[i] = val;
            if (!govP || val > govP.v) govP = { v: val, x, W: W.slice(), m, k };
          }
        });
        secN.forEach((x, i) => {
          const val = m * f(x);
          if (val < envN[i]) {
            envN[i] = val;
            if (!govN || val < govN.v) govN = { v: val, x, W: W.slice(), m, k };
          }
          const dd = 0.01;
          const V = Math.abs((m * (f(x + dd) - f(x - dd))) / (2 * dd));
          if (V > envV[i]) envV[i] = V;
        });
      });
    }
  }
  const IM = I.IM;
  const rowsP: BmMomentRow[] = secP.map((x, i) => {
    const DC = fDC(x);
    const DW = fDW(x);
    const LL = (Math.max(0, envP[i]) * (1 + IM)) / E1;
    const Mu =
      1.25 * Math.max(DC, 0) +
      0.9 * Math.min(DC, 0) +
      1.5 * Math.max(DW, 0) +
      0.65 * Math.min(DW, 0) +
      1.75 * LL;
    const Ms = DC + DW + LL;
    return { x, DC, DW, LL, Mu, Ms };
  });
  const rowsN: BmMomentRow[] = secN.map((x, i) => {
    const DC = fDC(x);
    const DW = fDW(x);
    const LL = (Math.min(0, envN[i]) * (1 + IM)) / E2;
    const Mu =
      1.25 * Math.min(DC, 0) +
      0.9 * Math.max(DC, 0) +
      1.5 * Math.min(DW, 0) +
      0.65 * Math.max(DW, 0) +
      1.75 * LL;
    const Ms = DC + DW + LL;
    return { x, DC, DW, LL, Mu, Ms };
  });
  const gP = rowsP.reduce((a, r) => (r.Mu > a.Mu ? r : a), rowsP[0]);
  const gN = rowsN.reduce((a, r) => (r.Mu < a.Mu ? r : a), rowsN[0]);

  const VDC = secN.map((x) => {
    const d = 0.01;
    return Math.abs((fDC(x + d) - fDC(x - d)) / (2 * d));
  });
  const VDW = secN.map((x) => {
    const d = 0.01;
    return Math.abs((fDW(x + d) - fDW(x - d)) / (2 * d));
  });
  const Vu = Math.max(
    ...secN.map((_x, i) => 1.25 * VDC[i] + 1.5 * VDW[i] + (1.75 * envV[i] * (1 + IM)) / E2),
  );

  const fc = I.fcs;
  const fy = I.fy;
  const Es = I.Es;
  const Ec = DAM.EcOf(fc, I.K1);
  const n = Es / Ec;
  const b1 = fc <= 28 ? 0.85 : Math.max(0.65, 0.85 - (0.05 * (fc - 28)) / 7);
  const As = (d: number, s: number): number => (((Math.PI * d * d) / 4) * 1000) / s;
  const fuTable: Record<number, number> = { 240: 380, 300: 450, 400: 570, 500: 650 };
  const sect = (
    Asv: number,
    d: number,
    hh: number,
    Mu: number,
    Ms: number,
    dc: number,
  ): BmSectResult => {
    const a = (Asv * fy) / (0.85 * fc * 1000);
    const c = a / b1;
    const et = (0.003 * (d - c)) / c;
    const phi = et >= 0.005 ? 0.9 : Math.max(0.75, 0.75 + (0.15 * (et - 0.002)) / 0.003);
    const Mr = (phi * Asv * fy * (d - a / 2)) / 1e6;
    const fr = 0.63 * Math.sqrt(fc);
    const Sc = (1000 * hh * hh) / 6;
    const g3 = fy / (fuTable[Math.round(fy)] || fy / 0.67);
    const Mcr = (g3 * 1.6 * fr * Sc) / 1e6;
    const Mmin = Math.min(1.33 * Math.abs(Mu), Mcr);
    const rho = n * Asv;
    const x = (-rho + Math.sqrt(rho * rho + 2 * 1000 * rho * d)) / 1000;
    const Icr = (1000 * x ** 3) / 3 + rho * (d - x) ** 2;
    const fss = Math.min(((Math.abs(Ms) * 1e6 * (d - x)) / Icr) * n, 0.6 * fy);
    const ge = 0.75;
    const bs = 1 + dc / (0.7 * (hh - dc));
    const smax = fss > 0 ? (123000 * ge) / (bs * fss) - 2 * dc : 1e9;
    return { As: Asv, d, a, c, et, phi, Mr, Mcr, Mmin, x, Icr, fss, ge, bs, smax, dc };
  };

  const dB = B.dB;
  const sB = B.sB;
  const dT = B.dT;
  const sT = B.sT;
  const dcB = B.cb + dB / 2;
  const dcT = B.ct + dT / 2;
  const dPos = h - dcB;
  const dNeg = ts - dcT;
  const P = sect(As(dB, sB), dPos, h, gP.Mu, gP.Ms, dcB);
  const N = sect(As(dT, sT), dNeg, h, gN.Mu, gN.Ms, dcT);
  P.s = sB;
  N.s = sT;

  const dv = Math.max(0.9 * Math.min(dPos, dNeg), 0.72 * h);
  const Vc = (0.083 * 2 * Math.sqrt(fc) * 1000 * dv) / 1e3;
  const Vr = 0.9 * Vc;

  const bw = Wb * 1000;
  const Ast = Math.min(Math.max((0.75 * bw * h) / (2 * (bw + h) * fy), 0.233), 1.27) * 1000;
  const smaxT = Math.min(3 * h, 450);
  const AsLB = As(B.dLB, B.sLB);
  const AsLT = As(B.dLT, B.sLT);

  const Se = Math.max((S - bf) * 1000, 1);
  const pct = Math.min(3840 / Math.sqrt(Se), 67) / 100;
  const AsDist = pct * P.As;

  return {
    xs,
    xL,
    xR,
    face,
    bf,
    h,
    ts,
    E1,
    E2,
    lp,
    xmin,
    xmax,
    secP,
    secN,
    envP,
    envN,
    rowsP,
    rowsN,
    gP,
    gN,
    govP,
    govN,
    fDC,
    fDW,
    P,
    N,
    dv,
    Vc,
    Vr,
    Vu,
    Ast,
    smaxT,
    AsLB,
    AsLT,
    Se,
    pct,
    AsDist,
    n,
    Ec,
    curb,
    rail,
    side,
    lay: [
      ['Ngang, lớp dưới (chịu M+)', B.dB, B.sB, As(B.dB, B.sB)],
      ['Ngang, lớp trên (chịu M-)', B.dT, B.sT, As(B.dT, B.sT)],
      ['Dọc, lớp dưới (phân bố)', B.dLB, B.sLB, AsLB],
      ['Dọc, lớp trên', B.dLT, B.sLT, AsLT],
    ],
  };
}

export function bmSumRender(R: BmResult): void {
  const its: Array<[string, boolean]> = [...(R.items || []), ...(R.oh?.items || [])];
  R.allOK = its.every((x) => x[1]);
  const html =
    `<tr><th colspan="8">Hạng mục kiểm toán bản mặt cầu</th><th colspan="2">KL</th></tr>` +
    its.map(([t, o]) => `<tr><td class="l" colspan="8">${t}</td>${ok2(o, null, 2)}</tr>`).join('');
  tbx('tbBmSum', html);
  klAppend('tbBmSum', R.allOK, 10);
}

export function bmOhCalc(
  I: DamSpInput,
  R: BmResult,
  B: BmOhInput,
  GL: GlcCalcResult | null,
): BmOhResult {
  const S = I.S;
  const oh = I.Wb / 2 - ((I.Ng - 1) / 2) * S;
  const xd = R.face;
  const h = R.h;
  const ts = R.ts;
  const gc = I.gc;
  if (oh - xd < 0.05) return { na: true, oh };
  const Le = oh - xd;
  const xg = oh - I.Wpa - (I.WPL || 0);
  const xw = xg - 0.3;
  const X = Math.max(0, xw - xd) * 1000;
  const E = 1140 + 0.833 * X;
  const arm = (x: number): number => Math.max(0, x - xd);

  const DCs = gc * (ts / 1000) * Le;
  const MDCs = (gc * (ts / 1000) * Le * Le) / 2;
  const Pcurb = gc * I.Apa;
  const xc = oh - I.Wpa / 2;
  const Prail = I.Pra / I.Lt / 2;
  const xr = oh - I.Wpa * 0.3;
  const MDCb = Pcurb * arm(xc) + Prail * arm(xr);
  const PLq = (I.WPL || 0) > 0 ? I.qPL || 3 : 0;
  const wsw = (gc * (I.APL || 0)) / 2 / Math.max(I.WPL || 1, 1e-6);
  const xs1 = oh - I.Wpa - (I.WPL || 0);
  const xs2 = oh - I.Wpa;
  const side = (I.WPL || 0) > 0 ? wsw * (xs2 - xs1) : 0;
  const Mside = (I.WPL || 0) > 0 ? (wsw * (arm(xs2) ** 2 - arm(xs1) ** 2)) / 2 : 0;
  const lDW = Math.max(0, xg - xd);
  const DW = I.gsu * I.Hsu * lDW;
  const MDW = (I.gsu * I.Hsu * lDW * lDW) / 2;
  const MPL = (PLq * (arm(xs2) ** 2 - arm(xs1) ** 2)) / 2;
  const VPL = PLq * Math.max(0, xs2 - Math.max(xs1, xd));
  const P = 72.5;
  const m = 1.2;
  const IM = I.IM;
  const aw = arm(xw);
  const MLL = aw > 0 ? (m * (1 + IM) * P * aw) / (E / 1000) : 0;
  const VLL = aw > 0 ? (m * (1 + IM) * P) / (E / 1000) : 0;
  const DCt = MDCs + MDCb + Mside;
  const VDC = DCs + Pcurb + Prail + side;
  const Mu3 = 1.25 * DCt + 1.5 * MDW + 1.75 * (MLL + MPL);
  const Ms3 = DCt + MDW + MLL + MPL;
  const dv0 = Math.max(0.9 * (ts - B.ct - B.dT / 2), 0.72 * h) / 1000;
  const xv = xd + dv0;
  const beyond = (a: number, b2: number): number => Math.max(0, b2 - Math.max(a, xv));
  const VDCv =
    gc * (ts / 1000) * Math.max(0, oh - xv) +
    (xc > xv ? Pcurb : 0) +
    (xr > xv ? Prail : 0) +
    ((I.WPL || 0) > 0 ? wsw * beyond(xs1, xs2) : 0);
  const VDWv = I.gsu * I.Hsu * Math.max(0, xg - xv);
  const VLLv = xw > xv ? VLL : 0;
  const VPLv = PLq * beyond(xs1, xs2);
  const Vu3 = 1.25 * VDCv + 1.5 * VDWv + 1.75 * (VLLv + VPLv);

  let C1: Array<{ t: string; Rw: number; Lc: number; T: number; Mc: number; Mu: number }> = [];
  let C2: { Fv: number; Lv: number; Mv: number; Mu: number } | null = null;
  if (GL) {
    const Hb = GL.H;
    const Xs = Math.max(0, (oh - I.Wpa - xd) * 1000);
    C1 = (
      [
        ['giữa đoạn gờ', GL.RwI, GL.LcI],
        ['đầu đoạn gờ', GL.RwE, GL.LcE],
      ] as const
    ).map(([t, Rw, Lc]) => {
      const T = Rw / (Lc + 2 * Hb);
      const Mc = ((GL.McBase / 1000) * Lc) / (Lc + 2 * Xs);
      const Mu = 1.0 * DCt + 1.0 * MDW + Mc;
      return { t, Rw, Lc, T, Mc, Mu };
    });
    const Fv = GL.TL.Fv;
    const Lv = GL.TL.Lv;
    const Mv = (Fv * arm(xc)) / ((Lv + 2 * Xs) / 1000);
    C2 = { Fv, Lv, Mv, Mu: 1.0 * DCt + 1.0 * MDW + Mv };
  }

  const fc = I.fcs;
  const fy = I.fy;
  const b1 = fc <= 28 ? 0.85 : Math.max(0.65, 0.85 - (0.05 * (fc - 28)) / 7);
  const As =
    (((Math.PI * B.dT * B.dT) / 4) * 1000) / B.sT +
    (B.dTa > 0 ? (((Math.PI * B.dTa * B.dTa) / 4) * 1000) / B.sTa : 0);
  const d = ts - B.ct - Math.max(B.dT, B.dTa || 0) / 2;
  const cap = (T: number, phiF?: number): BmOhCapResult => {
    const F = As * fy - T * 1000;
    const a = F / (0.85 * fc * 1000);
    const c = a / b1;
    const et = (0.003 * (d - c)) / c;
    const phi =
      phiF ?? (et >= 0.005 ? 0.9 : Math.max(0.75, 0.75 + (0.15 * (et - 0.002)) / 0.003));
    return {
      F,
      a,
      c,
      et,
      phi,
      Mr: F > 0 ? (phi * F * (d - a / 2)) / 1e6 : 0,
      Mt: (T * (d - h / 2)) / 1000,
    };
  };
  const S3 = cap(0);
  const Sx: BmOhCase1Item[] = C1.map((c) => ({ ...c, ...cap(c.T, 1.0) }));
  const Sv: BmOhCase2Item | null = C2 ? { ...C2, ...cap(0, 1.0) } : null;

  let PS: BmOhPunchingItem[] | null = null;
  if (GL && GL.P && GL.P.poly && GL.P.poly.length > 2) {
    const px = GL.P.poly.map((p) => p[0]);
    const y0 = Math.min(...GL.P.poly.map((p) => p[1]));
    const bx = GL.P.poly.filter((p) => Math.abs(p[1] - y0) < 1).map((p) => p[0]);
    const D = bx.length > 1 ? Math.max(...bx) - Math.min(...bx) : Math.max(...px) - Math.min(...px);
    PS = C1.map((c) => {
      const Wb = c.Lc;
      const bc = Wb / Math.max(D, 1);
      const vc = Math.min((0.166 + 0.332 / bc) * Math.sqrt(fc), 0.332 * Math.sqrt(fc));
      const Bm = Math.max(0, D - 2 * 50);
      const E0 = 0;
      const b0 = Wb + h + 2 * (E0 + Bm / 2 + h / 2);
      const Vn = (vc * b0 * h) / 1000;
      return { t: c.t, Wb, D, bc, vc, Bm, b0, Vn, Vr: 1.0 * Vn, Vu: c.Rw / 1000 };
    });
  }

  const fr = 0.63 * Math.sqrt(fc);
  const fuTable: Record<number, number> = { 240: 380, 300: 450, 400: 570, 500: 650 };
  const g3 = fy / (fuTable[Math.round(fy)] || fy / 0.67);
  const Mcr = (g3 * 1.6 * fr * 1000 * h * h) / 6 / 1e6;
  const Mmin = Math.min(1.33 * Mu3, Mcr);
  const n = R.n;
  const rho = n * As;
  const x = (-rho + Math.sqrt(rho * rho + 2 * 1000 * rho * d)) / 1000;
  const Icr = (1000 * x ** 3) / 3 + rho * (d - x) ** 2;
  const fss = Math.min(((Ms3 * 1e6 * (d - x)) / Icr) * n, 0.6 * fy);
  const dc = B.ct + B.dT / 2;
  const bs = 1 + dc / (0.7 * (h - dc));
  const smax = fss > 0 ? (123000 * 0.75) / (bs * fss) - 2 * dc : 1e9;
  const dv = Math.max(0.9 * d, 0.72 * h);
  const Vr = (0.9 * 0.083 * 2 * Math.sqrt(fc) * 1000 * dv) / 1e3;
  const sEq = B.dTa > 0 ? Math.min(B.sT, B.sTa) / 2 : B.sT;
  const ok = {
    s3: S3.Mr >= Mu3,
    min: S3.Mr >= Mmin,
    cr: sEq <= smax,
    v: Vr >= Vu3,
    c1: Sx.every((q) => q.Mr >= q.Mu + q.Mt),
    c2: !Sv || Sv.Mr >= Sv.Mu,
    ps: !PS || PS.every((q) => q.Vr >= q.Vu),
  };
  const items: Array<[string, boolean]> = [
    ['Bản hẫng - trường hợp 3 (bánh xe, CĐ I): Mr ≥ Mu', ok.s3],
    ['Bản hẫng - cốt thép tối thiểu', ok.min],
    ['Bản hẫng - kiểm soát nứt (SD I)', ok.cr],
    ['Bản hẫng - sức kháng cắt', ok.v],
  ];
  if (GL) {
    items.push(
      ['Bản hẫng - trường hợp 1 (va ngang, ĐB II)', ok.c1],
      ['Bản hẫng - trường hợp 2 (va thẳng đứng, ĐB II)', ok.c2],
    );
  }
  if (PS) {
    items.push(['Bản hẫng - cắt xuyên thủng tại chân ngoài gờ chắn (Điều 7.1.5 Phần 9)', ok.ps]);
  }
  return {
    na: false,
    PS,
    sEq,
    xv,
    VLLv,
    oh,
    xd,
    Le,
    xg,
    xw,
    X,
    E,
    h,
    ts,
    d,
    As,
    DCs,
    MDCs,
    Pcurb,
    xc,
    Prail,
    xr,
    MDCb,
    side,
    Mside,
    DW,
    MDW,
    PLq,
    MPL,
    VPL,
    P,
    m,
    IM,
    aw,
    MLL,
    VLL,
    DCt,
    VDC,
    Mu3,
    Ms3,
    Vu3,
    C1,
    C2,
    S3,
    Sx,
    Sv,
    Mcr,
    Mmin,
    x,
    fss,
    dc,
    bs,
    smax,
    dv,
    Vr,
    ok,
    items,
    GL: Boolean(GL),
  };
}

export function bmOhDraw(I: DamSpInput, O: BmOhResult): string {
  if (O.na) return '';
  const sv = resolveRealDom('dgBmOh');
  const id = 'BmOh';
  const d = dgKit(id);
  const W = 740;
  const L = O.oh;
  const k = 520 / (L + 0.6);
  const x0 = 80;
  const X = (x: number): number => x0 + (x + 0.6) * k;
  const yS = 150;
  const ts = O.ts ?? 0;
  const xd = O.xd ?? 0;
  const aw = O.aw ?? 0;
  const xw = O.xw ?? 0;
  const xg = O.xg ?? 0;
  const th = Math.max(14, (ts / 1000) * k);
  const gH = 70;
  d.T(
    W / 2,
    18,
    'Sơ đồ tính bản hẫng (dải rộng 1 m): tải trọng bánh xe, gờ lan can, mặt cắt thiết kế',
    'middle',
    'font-weight="bold"',
  );
  d.s += `<rect class="l" x="${X(-0.6)}" y="${yS}" width="${(L + 0.6) * k}" height="${th}" style="fill:url(#hD${id})"/>`;
  const bf = Math.min(0.85, xd * 3);
  const bw = 0.2;
  d.poly(
    [
      [X(-bf / 2), yS + th],
      [X(bf / 2), yS + th],
      [X(bf / 2), yS + th + 18],
      [X(bw / 2), yS + th + 40],
      [X(bw / 2), yS + th + gH],
      [X(-bw / 2), yS + th + gH],
      [X(-bw / 2), yS + th + 40],
      [X(-bf / 2), yS + th + 18],
    ],
    '#eee',
  );
  d.L(X(0), yS - 60, X(0), yS + th + gH + 10, 'c');
  d.T(X(0), yS + th + gH + 24, 'tim dầm biên', 'middle', 'class="s"');
  const xi = L - I.Wpa;
  d.s += `<rect class="l" x="${X(xi)}" y="${yS - 62}" width="${I.Wpa * k}" height="62" style="fill:url(#hD${id})"/>`;
  if ((I.WPL || 0) > 0) {
    d.s += `<rect class="t" x="${X(xi - I.WPL)}" y="${yS - 18}" width="${I.WPL * k}" height="18" style="fill:#f4f4f4"/>`;
  }
  d.L(X(xd), yS - 30, X(xd), yS + th + 12, 'd');
  d.T(X(xd) + 4, yS + th + 26, 'mặt cắt thiết kế', 'start', 'class="s"');
  if (aw > 0) {
    d.A(X(xw), yS - 70, X(xw), yS - 2);
    d.T(X(xw) + 6, yS - 60, 'P = 72,5 kN', 'start', 'class="s"');
    d.dimH(X(xw), X(xg), yS - 38, '300');
  }
  d.dimH(X(0), X(L), yS + th + 50, 'Le = ' + fx(L * 1000, 0), yS + th);
  d.dimH(X(0), X(xd), yS + th + 70, 'xd = ' + fx(xd * 1000, 0), yS + th);
  if (aw > 0) d.dimH(X(xd), X(xw), yS - 104, 'X - xd = ' + fx(aw * 1000, 0), yS - 80);
  d.T(X(L - I.Wpa / 2), yS - 70, 'gờ lan can', 'middle', 'class="s"');
  if (O.GL) {
    d.A(X(L) + 60, yS - 50, X(L) + 6, yS - 50);
    d.T(X(L) + 64, yS - 46, 'Ft (va xe)', 'start', 'class="s"');
  }
  const svg = dgPut(sv as unknown as SVGElement | null, W, yS + th + gH + 40, d.s, id);
  setOutputValue('dgBmOh', svg);
  return svg;
}

export function bmDraw(I: DamSpInput, R: BmResult): string {
  const sv = resolveRealDom('dgBm');
  const id = 'Bm';
  const d = dgKit(id);
  const W = 740;
  const Wb = I.Wb;
  const k = (W - 80) / Wb;
  const X = (x: number): number => 40 + (x + Wb / 2) * k;
  const yD = 104;
  const th = Math.max(10, (R.ts / 1000) * k * 1.5);
  d.s += `<rect class="l" x="${X(-Wb / 2)}" y="${yD}" width="${Wb * k}" height="${th}" style="fill:url(#hD${id})"/>`;
  R.xs.forEach((x) => {
    d.s += `<polygon class="t" points="${X(x)},${yD + th} ${X(x) - 7},${yD + th + 12} ${X(x) + 7},${yD + th + 12}" style="fill:#fff"/>`;
    d.L(X(x - R.face), yD + th + 2, X(x - R.face), yD + th + 8);
    d.L(X(x + R.face), yD + th + 2, X(x + R.face), yD + th + 8);
  });
  [-1, 1].forEach((sg) => {
    const xo = (sg * Wb) / 2;
    const xi = sg * (Wb / 2 - I.Wpa);
    d.s += `<rect class="l" x="${Math.min(X(xo), X(xi))}" y="${yD - 36}" width="${Math.abs(X(xo) - X(xi))}" height="36" style="fill:url(#hD${id})"/>`;
  });
  const g = R.govP;
  if (g) {
    g.W.forEach((xc) => {
      d.A(X(xc), yD - 52, X(xc), yD - 2);
      d.s += `<rect x="${X(xc - R.lp / 2)}" y="${yD - 6}" width="${R.lp * k}" height="5" fill="#000"/>`;
      d.T(X(xc), yD - 56, '72,5 kN', 'middle', 'class="s"');
    });
  }
  d.T(
    W / 2,
    18,
    'Sơ đồ dải bản ngang cầu: gối cứng tại tim các dầm, nhịp S = ' +
      fx(I.S * 1000, 0) +
      ' mm ; xếp bánh xe gây M+ lớn nhất',
    'middle',
    'font-weight="bold"',
  );
  const y0 = yD + th + 90;
  const IM = I.IM;
  const pts: Point2D[] = R.secP.map((x, i) => [x, (Math.max(0, R.envP[i]) * (1 + IM)) / R.E1]);
  const ptsN: Point2D[] = R.secN.map((x, i) => [x, (Math.min(0, R.envN[i]) * (1 + IM)) / R.E2]);
  const mx = Math.max(1, ...pts.map((p) => p[1]), ...ptsN.map((p) => -p[1]));
  const sc = 60 / mx;
  const Y = (val: number): number => y0 - val * sc;
  d.L(X(-Wb / 2), y0, X(Wb / 2), y0);
  d.s += `<polyline points="${pts.map((p) => X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ')}" fill="none" stroke="#ff0000" stroke-width="1.6"/>`;
  ptsN.forEach((p) => {
    d.L(X(p[0]), y0, X(p[0]), Y(p[1]), 't');
    d.s += `<circle cx="${X(p[0]).toFixed(1)}" cy="${Y(p[1]).toFixed(1)}" r="2.5" fill="#0000ff"/>`;
  });
  d.T(
    X(R.gP.x),
    Y(Math.max(...pts.map((p) => p[1]))) - 6,
    'M+ = ' + fx(Math.max(...pts.map((p) => p[1])), 2),
    'middle',
    'class="s"',
  );
  d.T(
    W / 2,
    y0 + 82,
    'Bao mômen do hoạt tải (kN.m/m, đã nhân m, IM và chia bề rộng dải): đường đỏ - mômen dương (chia E+), vẽ lên trên ;',
    'middle',
    'class="s"',
  );
  d.T(
    W / 2,
    y0 + 96,
    'điểm xanh - mômen âm tại mép mặt trên dầm (chia E-), vẽ xuống dưới.',
    'middle',
    'class="s"',
  );
  const svg = dgPut(sv as unknown as SVGElement | null, W, y0 + 106, d.s, id);
  setOutputValue('dgBm', svg);
  return svg;
}

export function bmOhStep(I: DamSpInput, R: BmResult): BmOhResult {
  const B: BmOhInput = {
    dT: spV('bm_dT'),
    sT: spV('bm_sT'),
    ct: spV('bm_ct'),
    dTa: spV('bm_dTa'),
    sTa: spV('bm_sTa') || 150,
  };
  const GL = GLCR && Number.isFinite(GLCR.McBase) ? GLCR : null;
  const O = bmOhCalc(I, R, B, GL);
  R.oh = O;
  const box = resolveRealDom('ohBox');
  if (O.na) {
    setOut(
      'o_oh_na',
      'Bản không có phần hẫng ngoài mặt cắt thiết kế ở dầm biên (phần hẫng ' +
        fx(O.oh * 1000, 0) +
        ' mm tính từ tim dầm biên): không phải thiết kế bản hẫng; mômen chân gờ lan can truyền vào bản liên hợp với dầm biên (xem sheet gờ lan can).',
    );
    if (box) box.hidden = true;
    bmSumRender(R);
    return O;
  }
  setOut('o_oh_na', '');
  if (box) box.hidden = false;
  const xd = O.xd ?? 0;
  const h = O.h ?? 0;
  const d = O.d ?? 0;
  const xg = O.xg ?? 0;
  const xc = O.xc ?? 0;
  const xr = O.xr ?? 0;
  const DCs = O.DCs ?? 0;
  const MDCs = O.MDCs ?? 0;
  const Pcurb = O.Pcurb ?? 0;
  const Prail = O.Prail ?? 0;
  const side = O.side ?? 0;
  const Mside = O.Mside ?? 0;
  const DW = O.DW ?? 0;
  const MDW = O.MDW ?? 0;
  const PLq = O.PLq ?? 0;
  const MPL = O.MPL ?? 0;
  const VPL = O.VPL ?? 0;
  const P = O.P ?? 72.5;
  const m = O.m ?? 1.2;
  const IM = O.IM ?? 0;
  const E = O.E ?? 1140;
  const aw = O.aw ?? 0;
  const MLL = O.MLL ?? 0;
  const VLL = O.VLL ?? 0;
  const Mu3 = O.Mu3 ?? 0;
  const Ms3 = O.Ms3 ?? 0;
  const Vu3 = O.Vu3 ?? 0;
  const S3 = O.S3!;

  setOut('o_oh_Le', O.oh * 1000, 0);
  setOut('o_oh_xd', xd * 1000, 0);
  setOut('o_oh_hd', fx(h, 0) + ' ; ' + fx(d, 0));
  setOut('o_oh_xg', xg * 1000, 0);
  setOut('o_oh_X', O.X ?? 0, 0);
  setOut('o_oh_E', E, 0);

  const r = (t: string, f: string, a: string, M: number, V: number | null): string =>
    `<tr><td class="l" colspan="4">${t}</td><td>${f}</td><td>${a}</td><td>${fx(M, 3)}</td><td>${V == null ? '-' : fx(V, 3)}</td></tr>`;
  tbx(
    'tbOhM',
    `<tr><th colspan="4">Tải trọng (dải rộng 1 m)</th><th>Lực</th><th>Cánh tay đòn tới mặt cắt (m)</th><th>M (kN.m/m)</th><th>V (kN/m)</th></tr>` +
      r('DC - trọng lượng bản: γc.h.Le', fx(DCs, 3) + ' kN/m', fx((O.oh - xd) / 2, 3), MDCs, DCs) +
      r(
        'DC - gờ lan can: γc.Apa (tại trọng tâm gờ)',
        fx(Pcurb, 3) + ' kN/m',
        fx(Math.max(0, xc - xd), 3),
        Pcurb * Math.max(0, xc - xd),
        Pcurb,
      ) +
      r(
        'DC - lan can tay vịn',
        fx(Prail, 3) + ' kN/m',
        fx(Math.max(0, xr - xd), 3),
        Prail * Math.max(0, xr - xd),
        Prail,
      ) +
      (side > 0 ? r('DC - kết cấu lề bộ hành', fx(side, 3) + ' kN/m', '-', Mside, side) : '') +
      r(
        'DW - lớp phủ (từ mặt trong gờ tới mặt cắt)',
        fx(DW, 3) + ' kN/m',
        fx(Math.max(0, xg - xd) / 2, 3),
        MDW,
        DW,
      ) +
      (PLq > 0 ? r('PL - người đi bộ ' + fx(PLq, 1) + ' kN/m2', '-', '-', MPL, VPL) : '') +
      r(
        `LL - bánh xe ${fx(P, 1)} kN, m = 1,2, (1 + IM) = ${fx(1 + IM, 2)}, chia E = ${fx(E, 0)} mm`,
        fx((m * (1 + IM) * P) / (E / 1000), 3) + ' kN/m',
        fx(aw, 3),
        MLL,
        VLL,
      ) +
      `<tr><td class="l" colspan="8">Mômen mang dấu dương khi căng thớ trên. Có thể thay bánh xe dãy ngoài cùng bằng tải trọng tuyến 14,6 N/mm cách mặt lan can 300 mm khi phần hẫng ≤ 1800 mm và lan can bê tông liên tục (Điều 6.1.3.4 Phần 3); bảng tính dùng tải trọng bánh xe (bất lợi hơn khi E nhỏ).</td></tr>`,
  );

  let c =
    `<tr><th colspan="4">Trường hợp</th><th>Hệ số</th><th>Mu hoặc Ms (kN.m/m)</th><th>T (kN/m)</th><th>Vu (kN/m)</th></tr>` +
    `<tr><td class="l" colspan="4">Trường hợp 3 - CĐ I: 1,25DC + 1,5DW + 1,75(LL + PL)</td><td class="c">CĐ I</td><td>${fx(Mu3, 3)}</td><td>0</td><td>${fx(Vu3, 3)}</td></tr>` +
    `<tr><td class="l" colspan="4">Trường hợp 3 - SD I: DC + DW + LL + PL</td><td class="c">SD I</td><td>${fx(Ms3, 3)}</td><td>0</td><td>-</td></tr>`;
  if (O.GL && GL && O.C1 && O.C2) {
    O.C1.forEach((q) => {
      c += `<tr><td class="l" colspan="4">Trường hợp 1 (${q.t}): 1,0DC + 1,0DW + Mc.Lc/(Lc + 2X) ; Mc = ${fx(GL.McBase / 1000, 2)} kN.m/m ; Lc = ${fx(q.Lc, 0)} mm</td><td class="c">ĐB II</td><td>${fx(q.Mu, 3)}</td><td>${fx(q.T, 3)}</td><td>-</td></tr>`;
    });
    c += `<tr><td class="l" colspan="4">Trường hợp 2: 1,0DC + 1,0DW + Fv.a/(Lv + 2X) ; Fv = ${fx(O.C2.Fv, 0)} kN ; Lv = ${fx(O.C2.Lv, 0)} mm</td><td class="c">ĐB II</td><td>${fx(O.C2.Mu, 3)}</td><td>0</td><td>-</td></tr>`;
  }
  c += `<tr><td class="l" colspan="8">${O.GL ? "Mc - sức kháng uốn chân gờ lan can (sheet gờ lan can), phân bố trên chiều dài Lc + 2X tại mặt cắt thiết kế (X - khoảng cách từ mặt trong chân gờ tới mặt cắt) ; T = Rw/(Lc + 2H) (Điều A13.4.2). Hoạt tải xe không xét đồng thời với lực va; hệ số tải trọng thường xuyên γp = 1,0 (TCVN 11823-13, Điều 7.3.5.1)." : "Chưa có kết quả sheet gờ lan can: chưa xét trường hợp 1 và 2 (lực va)."}</td></tr>`;
  tbx('tbOhC', c);

  const rr = (t: string, S: BmOhCapResult, Mreq: number, T: number): string =>
    `<tr><td class="l" colspan="3">${t}</td><td>${fx(O.As ?? 0, 0)}</td><td>${fx(T, 2)}</td><td>${fx(S.a, 1)}</td><td>${fx(S.phi, 2)}</td><td>${fx(Mreq, 2)}</td><td>${fx(S.Mr, 2)}</td>${ok2(S.Mr >= Mreq)}</tr>`;
  let hStr =
    `<tr><th colspan="3">Trường hợp</th><th>As (mm2/m)</th><th>T (kN/m)</th><th>a (mm)</th><th>φ</th><th>Mu + T(d - h/2)</th><th>Mr</th><th>KL</th></tr>` +
    rr('Trường hợp 3 - CĐ I', S3, Mu3, 0);
  if (O.GL && O.Sx && O.Sv) {
    O.Sx.forEach((q) => {
      hStr += rr('Trường hợp 1 - ' + q.t, q, q.Mu + q.Mt, q.T);
    });
    hStr += rr('Trường hợp 2', O.Sv, O.Sv.Mu, 0);
  }
  if (O.PS) {
    hStr +=
      `<tr><th colspan="10">Cắt xuyên thủng tại chân ngoài gờ chắn do lực va (TCVN 11823-9, Điều 7.1.5 ; AASHTO LRFD 7th Ed. (2014), A13.4.3.2 áp dụng cho đoạn gờ dài Lc, E = 0, B = D - 100 mm, φ = 1,0)</th></tr>` +
      O.PS.map(
        (q) =>
          `<tr><td class="l" colspan="3">${q.t}: Wb = Lc = ${fx(q.Wb, 0)} ; D = ${fx(q.D, 0)} ; βc = ${fx(q.bc, 2)} ; vc = ${fx(q.vc, 3)} MPa</td><td colspan="2">b0 = ${fx(q.b0, 0)} mm</td><td colspan="2">Vu = Rw = ${fx(q.Vu, 1)} kN</td><td colspan="2">Vr = ${fx(q.Vr, 1)} kN</td>${ok2(q.Vr >= q.Vu)}</tr>`,
      ).join('');
  }
  tbx(
    'tbOhR',
    hStr +
      `<tr><td class="l" colspan="10">Cốt thép lớp trên ở bản hẫng: D${fx(B.dT, 0)} @ ${fx(B.sT, 0)}${B.dTa > 0 ? ' + tăng cường D' + fx(B.dTa, 0) + ' @ ' + fx(B.sTa, 0) : ''} (mục 1). Mômen tính bằng kN.m/m.</td></tr>`,
  );
  tbx(
    'tbOhK',
    `<tr><th colspan="6">Kiểm toán khác (trường hợp 3)</th><th colspan="2">Trị số</th><th colspan="2">KL</th></tr>` +
      `<tr><td class="l" colspan="6">Cốt thép tối thiểu: Mr ≥ min(1,33Mu ; Mcr = γ3.γ1.fr.Sc) (Điều 7.3.3.2 Phần 5)</td><td colspan="2">${fx(S3.Mr, 2)} ≥ ${fx(O.Mmin ?? 0, 2)}</td>${ok2(O.ok!.min, null, 2)}</tr>` +
      `<tr><td class="l" colspan="6">Kiểm soát nứt: s ≤ 123000γe/(βs.fss) - 2dc ; γe = 0,75 ; fss = ${fx(O.fss ?? 0, 1)} MPa ; βs = ${fx(O.bs ?? 1, 3)} (Điều 7.3.4 Phần 5)</td><td colspan="2">${fx(O.sEq ?? 0, 0)} ≤ ${fx(O.smax ?? 0, 0)}</td>${ok2(O.ok!.cr, null, 2)}</tr>` +
      `<tr><td class="l" colspan="6">Sức kháng cắt tại mặt cắt tới hạn cách mặt cắt thiết kế một khoảng dv (cách tim dầm biên ${fx((O.xv ?? 0) * 1000, 0)} mm, Điều 8.3.2 Phần 5)${(O.VLLv ?? 0) > 0 ? '' : ' - tải trọng bánh xe nằm trong phạm vi dv, truyền trực tiếp vào gối, không gây lực cắt tại mặt cắt tới hạn'}: Vr = 0,9.0,083.β.√f'c.b.dv, β = 2 ; dv = ${fx(O.dv ?? 0, 0)} mm (Điều 8.3.4.1 Phần 5)</td><td colspan="2">${fx(O.Vr ?? 0, 2)} ≥ ${fx(Vu3, 2)}</td>${ok2(O.ok!.v, null, 2)}</tr>`,
  );
  bmSumRender(R);
  bmOhDraw(I, O);
  return O;
}

// ---------------------------------------------------------------------------
// 6. Elastomeric Bearing (`gcCalc`, `gcStep`, `gcDraw`) & `sup2Step`
// ---------------------------------------------------------------------------

export function gcCalc(
  I: DamSpInput,
  C: GcBearingInput,
  Rg: GcReactionInput,
  Rb: GcReactionInput,
): GcCalcResult {
  const L = C.L;
  const W = C.W;
  const A = L * W;
  const n = C.n;
  const hri = C.hri;
  const hc = C.hc;
  const hrt = n * hri + 2 * hc;
  const Htot = hrt + (n + 1) * C.hs;
  const Si = (L * W) / (2 * hri * (L + W));
  const neff = n + (hc >= hri / 2 ? 1 : 0);
  const Gn = C.G;
  const Gmin = Gn * (1 - C.tol);
  const Gmax = Gn * (1 + C.tol);

  const Lsm = I.Lt - 2 * I.a0;
  const Lb = C.Lexp ? C.Lexp - I.a0 * 1000 : (Lsm * 1000) / 2;
  const dTher = I.alpha * (C.Tmax - C.Tmin) * Lb;
  const dSh = C.eSh * Lb;
  const Ds = 0.65 * dTher + dSh;

  const m = I.nL === 1 ? 1.2 : I.nL === 2 ? 1 : I.nL === 3 ? 0.85 : 0.65;
  const BR1 = Math.max(0.25 * 325, 0.05 * (325 + 9.3 * Lsm), 0.25 * 220, 0.05 * (220 + 9.3 * Lsm));
  const BR = BR1 * I.nL * m;
  const nbAll = 2 * I.Ng * C.nb;
  const Hbr = (BR / nbAll) * 1000;

  const one = (R: GcReactionInput, tag: string): GcGirderCheck => {
    const Pst = ((R.DC + R.DW) / C.nb) * 1000;
    const Pcy = (R.LL / C.nb) * 1000;
    const sst = Pst / A;
    const scy = Pcy / A;
    const ss = sst + scy;
    const th_st = Math.abs(R.thSt) + 0.005;
    const th_cy = Math.abs(R.thCy);
    const Da = 1.4;
    const Dr = 0.5;
    const Ba = 1.6;
    const ga_st = (Da * sst) / (Gmin * Si);
    const ga_cy = (Da * scy) / (Gmin * Si);
    const gr_st = (Dr * (L / hri) ** 2 * th_st) / neff;
    const gr_cy = (Dr * (L / hri) ** 2 * th_cy) / neff;
    const gs_st = Ds / hrt;
    const gs_cy = Hbr / (Gmin * A);
    const sum = ga_st + gr_st + gs_st + 1.75 * (ga_cy + gr_cy + gs_cy);

    const So = (L * W) / (2 * 2 * hc * (L + W));
    const oa_st = (Da * sst) / (Gmin * So);
    const oa_cy = (Da * scy) / (Gmin * So);
    const or_st = (Dr * L * L * th_st) / (2 * hc * hrt);
    const or_cy = (Dr * L * L * th_cy) / (2 * hc * hrt);
    const sumO = oa_st + or_st + gs_st + 1.75 * (oa_cy + or_cy + gs_cy);

    const stab = (Lx: number, Wx: number): GcStabCheck => {
      const Aa = (1.92 * hrt) / Lx / Math.sqrt(1 + (2 * Lx) / Wx);
      const Bb = 2.67 / ((Si + 2) * (1 + Lx / (4 * Wx)));
      return {
        A: Aa,
        B: Bb,
        ok: 2 * Aa <= Bb,
        lim: 2 * Aa > Bb ? (Gmin * Si) / (2 * Aa - Bb) : Infinity,
      };
    };
    const st1 = stab(L, W);
    const st2 = L > W ? stab(W, L) : null;

    const hmax = Math.max(hri, hc);
    const hs1 = (3 * hmax * ss) / C.Fy;
    const hs2 = (2 * hmax * scy) / C.dFTH;

    const ea = (sst + 1.75 * scy) / (3 * Ba * Gmin * Si * Si);
    const thT = th_st + 1.75 * th_cy;
    const needAnchor = thT / neff >= (3 * ea) / Si;

    const dl_st = (sst / (3 * Ba * Gn * Si * Si)) * hrt;
    const dl_cy = (scy / (3 * Ba * Gn * Si * Si)) * hrt;
    const Hu = (Gmax * A * Ds) / hrt / 1000;
    return {
      So,
      oa_st,
      oa_cy,
      or_st,
      or_cy,
      sumO,
      tag,
      R,
      Pst,
      Pcy,
      sst,
      scy,
      ss,
      th_st,
      th_cy,
      ga_st,
      ga_cy,
      gr_st,
      gr_cy,
      gs_st,
      gs_cy,
      sum,
      st1,
      st2,
      hs1,
      hs2,
      ea,
      thT,
      needAnchor,
      dl_st,
      dl_cy,
      Hu,
    };
  };

  const rg = one(Rg, 'Dầm giữa');
  const rb = one(Rb, 'Dầm biên');
  return {
    L,
    W,
    A,
    n,
    hri,
    hc,
    hrt,
    Htot,
    Si,
    neff,
    Gn,
    Gmin,
    Gmax,
    Lb,
    dTher,
    dSh,
    Ds,
    BR,
    BR1,
    nbAll,
    Hbr,
    rg,
    rb,
    hcOK: hc <= 0.7 * hri + 1e-9,
    GOK: Gmin >= 0.55 - 1e-9 && Gmax <= 1.2 + 1e-9,
    shOK: hrt >= 2 * Ds,
    stOK: C.hs >= Math.max(1.6, rg.hs1, rg.hs2, rb.hs1, rb.hs2),
    applA: (Si * Si) / n,
  };
}

export function gcDraw(R: GcCalcResult): string {
  const C = R.C;
  if (!C) return '';
  const sv = resolveRealDom('dgGc');
  const id = 'Gc';
  const d = dgKit(id);
  const W = 760;
  d.T(
    W / 2,
    20,
    'Gối chất dẻo cốt bản thép: mặt cắt dọc cầu (chiều cao phóng to) và mặt bằng',
    'middle',
    'font-weight="bold"',
  );
  const k = Math.min(2.0, 300 / R.L);
  const x0 = 50;
  const y0 = 78;
  let y = y0;
  const lay: Array<['c' | 's' | 'r', number]> = [['c', C.hc]];
  for (let i = 0; i < C.n; i++) lay.push(['s', C.hs], ['r', C.hri]);
  lay.push(['s', C.hs], ['c', C.hc]);
  const tot = lay.reduce((a, l) => a + l[1], 0);
  const ky = Math.min(9, 170 / tot);
  const side = 5 * k;
  d.s += `<rect x="${x0}" y="${y0}" width="${R.L * k}" height="${tot * ky}" style="fill:url(#hP${id});stroke:#000;stroke-width:1.2"/>`;
  lay.forEach(([t, hh]) => {
    const hp = hh * ky;
    if (t === 's') {
      d.s += `<rect x="${x0 + side}" y="${y}" width="${R.L * k - 2 * side}" height="${hp}" style="fill:#555;stroke:#000;stroke-width:0.8"/>`;
    }
    y += hp;
  });
  d.dimH(x0, x0 + R.L * k, 50, 'L = ' + fx(R.L, 0) + ' (dọc cầu)', y0);
  d.dimV(x0 + R.L * k + 22, y0, y, 'H = ' + fx(R.Htot, 1));
  d.T(
    x0,
    y + 22,
    `${C.n} lớp trong hri = ${fx(C.hri, 1)} ; 2 lớp phủ hc = ${fx(C.hc, 1)} ; ${C.n + 1} bản thép hs = ${fx(C.hs, 2)} ; hrt = ${fx(R.hrt, 1)} (mm)`,
    'start',
    'class="s"',
  );

  const kp = Math.min(1.0, 190 / Math.max(R.L, R.W));
  const xp = x0 + R.L * k + 120;
  const yp = y0;
  const pw = R.W * kp;
  const ph = R.L * kp;
  const e = 5 * kp;
  d.s += `<rect class="l" x="${xp}" y="${yp}" width="${pw}" height="${ph}" style="fill:url(#hP${id})"/>`;
  d.s += `<rect x="${xp + e}" y="${yp + e}" width="${pw - 2 * e}" height="${ph - 2 * e}" style="fill:none;stroke:#000;stroke-width:0.8;stroke-dasharray:5,3"/>`;
  d.L(xp + pw / 2, yp - 10, xp + pw / 2, yp + ph + 10, 'c');
  d.L(xp - 10, yp + ph / 2, xp + pw + 10, yp + ph / 2, 'c');
  d.dimH(xp, xp + pw, 50, 'W = ' + fx(R.W, 0) + ' (ngang cầu)', yp);
  d.dimV(xp + pw + 22, yp, yp + ph, 'L = ' + fx(R.L, 0));
  d.A(xp - 28, yp + ph - 10, xp - 28, yp + 10);
  d.T(
    xp - 36,
    yp + ph / 2,
    'dọc cầu',
    'middle',
    `class="s" transform="rotate(-90 ${xp - 36} ${yp + ph / 2})"`,
  );
  d.T(xp, yp + ph + 22, 'Nét đứt: mép bản thép (cách mép gối 5 mm)', 'start', 'class="s"');
  const svg = dgPut(sv as unknown as SVGElement | null, W, Math.max(y + 34, yp + ph + 34), d.s, id);
  setOutputValue('dgGc', svg);
  return svg;
}

export function gcStep(
  I: DamSpInput,
  options?: { damResult?: AnyDamResult | null },
): { gc: GcCalcResult | KdStepResult | null; changed: boolean } {
  const damR = activeGirderComposite(options?.damResult);
  if (supK()) {
    try {
      return { gc: kdStep(I, { damResult: damR }), changed: false };
    } catch (e) {
      console.error(e);
      return { gc: null, changed: false };
    }
  }
  if (!damR || !damR.g) return { gc: null, changed: false };
  const G = damR.g as AnyGirderBranch;
  const Bq = (damR.b as AnyGirderBranch | undefined) || G;

  const C: GcBearingInput = {
    L: spV('gc_L'),
    W: spV('gc_W'),
    n: Math.max(1, Math.round(spV('gc_n'))),
    hri: spV('gc_hri'),
    hc: spV('gc_hc'),
    hs: spV('gc_hs'),
    Fy: spV('gc_Fy'),
    dFTH: spV('gc_dFTH'),
    G: spV('gc_G'),
    tol: (spV('gc_tol') || 0) / 100,
    nb: Math.max(1, Math.round(spV('gc_nb'))),
    Tmax: num('mo_Tmax'),
    Tmin: num('mo_Tmin'),
    eSh: 0,
    Lexp: ltnLexp(I),
  };

  const Rof = (R: AnyGirderBranch): GcReactionInput => {
    const r0 = R.res[0] as { VLL: number };
    const C2 = R.camber;
    const Ls = R.Ls;
    const thSt = (4 * C2.dcr - 3.2 * C2.dDeck) / Ls;
    const thCy = (3.2 * Math.max(C2.dLL1, C2.dLL2)) / Ls;
    return {
      DC: R.Rg.DC,
      DW: R.Rg.DW,
      LL: r0.VLL,
      thSt,
      thCy,
      dcr: C2.dcr,
      dDeck: C2.dDeck,
      dLL: Math.max(C2.dLL1, C2.dLL2),
    };
  };

  const gAny = G as {
    shr?: { eps_bdf: number; psi_fi: number; psi_di: number };
    res: Array<{ fcgp?: number }>;
    Eci?: number;
    eSh?: number;
  };
  if (gAny.shr) {
    const lastFcgp = gAny.res[gAny.res.length - 1]?.fcgp ?? 0;
    const eci = gAny.Eci || 1;
    C.eSh = gAny.shr.eps_bdf + (lastFcgp / eci) * (gAny.shr.psi_fi - gAny.shr.psi_di);
  } else {
    C.eSh = gAny.eSh || 0;
  }

  const R = gcCalc(I, C, Rof(G), Rof(Bq));
  R.C = C;

  setOut('o_gc_hrt', R.hrt, 1);
  setOut('o_gc_H', R.Htot, 1);
  setOut('o_gc_A', R.A, 0);
  setOut('o_gc_Si', R.Si, 3);
  setOut('o_gc_neff', R.neff, 1);
  setOut('o_gc_SS', R.applA, 1);
  okn(
    'o_gc_hrt',
    R.hcOK,
    (R.hcOK ? 'OK' : 'NG') +
      ': lớp ngoài hc = ' +
      fx(C.hc, 1) +
      (R.hcOK ? ' ≤ ' : ' > ') +
      '0,7hri = ' +
      fx(0.7 * C.hri, 1),
  );
  setOut('o_gc_Gr', fx(R.Gmin, 3) + ' ; ' + fx(R.Gmax, 3));
  okn(
    'o_gc_Gr',
    R.GOK,
    R.GOK ? 'OK: trong khoảng 0,55 - 1,2 MPa' : 'NG: ngoài khoảng 0,55 - 1,2 MPa',
  );
  setOut('o_gc_Tm', fx(C.Tmax, 0) + ' ; ' + fx(C.Tmin, 0));
  setOut('o_gc_Lb', R.Lb, 0);
  setOut('o_gc_dT', R.dTher, 2);
  setOut('o_gc_eSh', C.eSh * 1e6, 1);
  setOut('o_gc_dSh', R.dSh, 2);
  setOut('o_gc_Ds', R.Ds, 2);
  okn(
    'o_gc_Ds',
    R.shOK,
    (R.shOK ? 'OK' : 'NG') +
      ': hrt = ' +
      fx(R.hrt, 1) +
      (R.shOK ? ' ≥ ' : ' < ') +
      '2Δs = ' +
      fx(2 * R.Ds, 2),
  );
  setOut('o_gc_BR', R.BR, 2);
  setOut('o_gc_Hbr', R.Hbr / 1000, 3);

  const rs: [GcGirderCheck, GcGirderCheck] = [R.rg, R.rb];
  const row = (t: string, f: (o: GcGirderCheck) => number, d: number): string =>
    `<tr><td class="l" colspan="4">${t}</td>${rs.map((o) => `<td colspan="2">${fx(f(o), d)}</td>`).join('')}</tr>`;
  tbx(
    'tbGcL',
    `<tr><th colspan="4">Đại lượng (1 gối)</th><th colspan="2">Dầm giữa</th><th colspan="2">Dầm biên</th></tr>` +
      row('Phản lực tĩnh tải DC + DW của 1 dầm (kN)', (o) => o.R.DC + o.R.DW, 2) +
      row('Phản lực hoạt tải (kể IM, g, PL) của 1 dầm (kN)', (o) => o.R.LL, 2) +
      `<tr><td class="l" colspan="4">Lực nén tĩnh ; lặp trên 1 gối (kN)</td>${rs.map((o) => `<td colspan="2">${fx(o.Pst / 1000, 2)} ; ${fx(o.Pcy / 1000, 2)}</td>`).join('')}</tr>` +
      `<tr><td class="l" colspan="4">Ứng suất nén σst ; σcy (MPa)</td>${rs.map((o) => `<td colspan="2">${fx(o.sst, 3)} ; ${fx(o.scy, 3)}</td>`).join('')}</tr>` +
      `<tr><td class="l" colspan="4">Độ vồng dài hạn δcr ; võng do tĩnh tải giai đoạn II δb ; võng hoạt tải δLL (mm)</td>${rs.map((o) => `<td colspan="2">${fx(o.R.dcr, 1)} ; ${fx(o.R.dDeck, 1)} ; ${fx(o.R.dLL, 1)}</td>`).join('')}</tr>` +
      `<tr><td class="l" colspan="4">Góc xoay tĩnh θst = |4δcr - 3,2δb|/Ls + 0,005 ; lặp θcy = 3,2δLL/Ls (rad)</td>${rs.map((o) => `<td colspan="2">${fx(o.th_st, 5)} ; ${fx(o.th_cy, 5)}</td>`).join('')}</tr>`,
  );

  tbx(
    'tbGcS',
    `<tr><th colspan="4">Ứng biến cắt</th><th>Giữa, tĩnh</th><th>Giữa, lặp</th><th>Biên, tĩnh</th><th>Biên, lặp</th></tr>` +
      (
        [
          ['Do tải trọng dọc trục γa = Da.σ/(G.Si)', 'ga'],
          ['Do xoay γr = Dr.(L/hri)².θ/n', 'gr'],
          ['Do chuyển vị cắt γs = Δs/hrt ; lực hãm H/(G.A)', 'gs'],
        ] as const
      )
        .map(
          ([t, k]) =>
            `<tr><td class="l" colspan="4">${t}</td><td>${fx(R.rg[`${k}_st`], 4)}</td><td>${fx(R.rg[`${k}_cy`], 4)}</td><td>${fx(R.rb[`${k}_st`], 4)}</td><td>${fx(R.rb[`${k}_cy`], 4)}</td></tr>`,
        )
        .join('') +
      `<tr><td class="l" colspan="4"><b>Tổng (γa + γr + γs)st + 1,75(γa + γr + γs)cy ≤ 5,0</b></td><td colspan="2"><b>${fx(R.rg.sum, 3)}</b></td><td colspan="2"><b>${fx(R.rb.sum, 3)}</b></td></tr>` +
      `<tr><td class="l" colspan="4">Kết luận (Phương trình 41 ; γa,st ≤ 3,0 theo Phương trình 42)</td>${rs.map((o) => ok2(o.sum <= 5 && o.ga_st <= 3, null, 2)).join('')}</tr>` +
      (R.hcOK
        ? ''
        : `<tr><td class="l" colspan="8"><b>Kiểm tra bổ sung lớp phủ ngoài</b> (hc = ${fx(C.hc, 1)} mm > 0,7hri): lớp ngoài chỉ dính bám một mặt nên làm việc như lớp trong có chiều dày 2hc = ${fx(2 * C.hc, 1)} mm, hệ số hình dạng So = L.W/(2.2hc.(L + W)) = ${fx(R.rg.So, 3)} ; góc xoay của lớp ngoài lấy tỷ lệ với chiều dày: γr,o = Dr.L².θ/(2.hc.hrt).</td></tr>` +
          `<tr><td class="l" colspan="4">Lớp ngoài: γa = Da.σ/(G.So)</td><td>${fx(R.rg.oa_st, 4)}</td><td>${fx(R.rg.oa_cy, 4)}</td><td>${fx(R.rb.oa_st, 4)}</td><td>${fx(R.rb.oa_cy, 4)}</td></tr>` +
          `<tr><td class="l" colspan="4">Lớp ngoài: γr = Dr.L².θ/(2.hc.hrt)</td><td>${fx(R.rg.or_st, 4)}</td><td>${fx(R.rg.or_cy, 4)}</td><td>${fx(R.rb.or_st, 4)}</td><td>${fx(R.rb.or_cy, 4)}</td></tr>` +
          `<tr><td class="l" colspan="4"><b>Lớp ngoài: tổng theo Phương trình 41 ≤ 5,0 ; γa,st ≤ 3,0</b></td><td colspan="2"><b>${fx(R.rg.sumO, 3)}</b></td><td colspan="2"><b>${fx(R.rb.sumO, 3)}</b></td></tr>` +
          `<tr><td class="l" colspan="4">Kết luận lớp ngoài</td>${rs.map((o) => ok2(o.sumO <= 5 && o.oa_st <= 3, null, 2)).join('')}</tr>`),
  );

  tbx(
    'tbGcO',
    `<tr><th colspan="4">Ổn định (Điều 7.5.3.4)</th><th colspan="2">Dầm giữa</th><th colspan="2">Dầm biên</th></tr>` +
      `<tr><td class="l" colspan="4">A = 1,92(hrt/L)/√(1 + 2L/W) ; B = 2,67/((Si + 2)(1 + L/4W))</td>${rs.map((o) => `<td colspan="2">${fx(o.st1.A, 4)} ; ${fx(o.st1.B, 4)}</td>`).join('')}</tr>` +
      `<tr><td class="l" colspan="4">2A ≤ B : gối ổn định, không cần kiểm tra thêm</td>${rs.map((o) => `<td colspan="2">${fx(2 * o.st1.A, 4)} ${o.st1.ok ? '≤' : '>'} ${fx(o.st1.B, 4)}</td>`).join('')}</tr>` +
      `<tr><td class="l" colspan="4">Khi 2A > B, kết cấu dịch chuyển ngang tự do: σs ≤ G.Si/(2A - B) (Phương trình 61) (MPa)</td>${rs.map((o) => `<td colspan="2">${o.st1.ok ? '-' : fx(o.ss, 3) + ' ≤ ' + fx(o.st1.lim, 2)}</td>`).join('')}</tr>` +
      `<tr><td class="l" colspan="4">Kết luận</td>${rs.map((o) => ok2(o.st1.ok || o.ss <= o.st1.lim, null, 2)).join('')}</tr>` +
      (rs[0].st2
        ? `<tr><td class="l" colspan="4">Hoán đổi L, W (L > W)</td>${rs.map((o) => ok2(!o.st2 || o.st2.ok || o.ss <= o.st2.lim, null, 2)).join('')}</tr>`
        : ''),
  );

  tbx(
    'tbGcP',
    `<tr><th colspan="4">Bản thép (Điều 7.5.3.5)</th><th colspan="2">Dầm giữa</th><th colspan="2">Dầm biên</th></tr>` +
      `<tr><td class="l" colspan="4">Sử dụng: hs ≥ 3.hmax.σs/Fy ; hmax = max(hri ; hc) (mm)</td>${rs.map((o) => `<td colspan="2">${fx(o.hs1, 3)}</td>`).join('')}</tr>` +
      `<tr><td class="l" colspan="4">Mỏi: hs ≥ 2,0.hmax.σL/ΔFTH (mm) - bản in TCVN 11823-14 PT 64 ghi hệ số 3 là sai; đúng theo AASHTO LRFD 7th Ed. (2014), PT 14.7.5.3.5-2</td>${rs.map((o) => `<td colspan="2">${fx(o.hs2, 3)}</td>`).join('')}</tr>` +
      `<tr><td class="l" colspan="4">Chiều dày bản thép thực tế hs = ${fx(C.hs, 2)} mm</td>${rs.map((o) => ok2(C.hs >= Math.max(1.6, o.hs1, o.hs2), null, 2)).join('')}</tr>`,
  );

  tbx(
    'tbGcA',
    `<tr><th colspan="4">Neo gối (Điều 7.5.4) và độ lún (Điều 7.5.3.6)</th><th colspan="2">Dầm giữa</th><th colspan="2">Dầm biên</th></tr>` +
      `<tr><td class="l" colspan="4">εa = (σst + 1,75σcy)/(3.Ba.G.Si²) ; θs = θst + 1,75θcy</td>${rs.map((o) => `<td colspan="2">${fx(o.ea, 5)} ; ${fx(o.thT, 5)}</td>`).join('')}</tr>` +
      `<tr><td class="l" colspan="4">θs/n ≥ 3εa/Si : phải có hệ kiềm chế chống dịch chuyển ngang của gối</td>${rs.map((o) => `<td colspan="2">${fx(o.thT / R.neff, 5)} ${o.needAnchor ? '≥' : '<'} ${fx((3 * o.ea) / R.Si, 5)}</td>`).join('')}</tr>` +
      `<tr><td class="l" colspan="4">Kết luận</td>${rs.map((o) => `<td class="c ${o.needAnchor ? 'bad' : 'ok'}" colspan="2">${o.needAnchor ? 'Cần kiềm chế' : 'Không cần'}</td>`).join('')}</tr>` +
      `<tr><td class="l" colspan="4">Độ lún tức thời do tĩnh tải ; hoạt tải (mm)</td>${rs.map((o) => `<td colspan="2">${fx(o.dl_st, 2)} ; ${fx(o.dl_cy, 2)}</td>`).join('')}</tr>` +
      `<tr><td class="l" colspan="4">Lực ngang do biến dạng gối Hu = Gmax.A.Δs/hrt (kN, Điều 6.3.1)</td>${rs.map((o) => `<td colspan="2">${fx(o.Hu, 2)}</td>`).join('')}</tr>`,
  );

  const items: Array<[string, boolean]> = [
    ['Mô đun cắt trong khoảng 0,55 - 1,2 MPa (Điều 7.5.2)', R.GOK],
    ['Lớp phủ ngoài ≤ 0,7 lớp trong (Điều 7.5.1)', R.hcOK],
    ['Biến dạng cắt hrt ≥ 2Δs (Phương trình 40)', R.shOK],
    ...rs.map(
      (o): [string, boolean] => [
        `Nén, xoay, cắt kết hợp - ${o.tag.toLowerCase()} (Phương trình 41, 42)`,
        o.sum <= 5 && o.ga_st <= 3,
      ],
    ),
    ...(R.hcOK
      ? []
      : rs.map(
          (o): [string, boolean] => [
            `Kiểm tra bổ sung lớp phủ ngoài dày - ${o.tag.toLowerCase()} (Phương trình 41, 42)`,
            o.sumO <= 5 && o.oa_st <= 3,
          ],
        )),
    ...rs.map(
      (o): [string, boolean] => [
        `Ổn định - ${o.tag.toLowerCase()} (Phương trình 58)`,
        (o.st1.ok || o.ss <= o.st1.lim) && (!o.st2 || o.st2.ok || o.ss <= o.st2.lim),
      ],
    ),
    ['Chiều dày bản thép (Phương trình 63, 64)', R.stOK],
  ];
  const tbGcSumHtml =
    `<tr><th colspan="8">Hạng mục kiểm toán gối</th><th colspan="2">KL</th></tr>` +
    items
      .map(([t, o]) => `<tr><td class="l" colspan="8">${t}</td>${ok2(o, null, 2)}</tr>`)
      .join('') +
    `<tr><td class="l" colspan="8">Kiềm chế chống trượt gối (Điều 7.5.4)</td><td class="c" colspan="2">${R.rg.needAnchor || R.rb.needAnchor ? 'Cần bố trí' : 'Không cần'}</td></tr>`;
  tbx('tbGcSum', tbGcSumHtml);
  R.allOK = items.every((x) => x[1]);
  klAppend('tbGcSum', R.allOK, 10);

  if (!R.allOK) {
    const okAll = (Q: GcCalcResult): boolean =>
      Q.GOK &&
      Q.hcOK &&
      Q.shOK &&
      Q.stOK &&
      [Q.rg, Q.rb].every(
        (o) =>
          o.sum <= 5 &&
          o.ga_st <= 3 &&
          (o.st1.ok || o.ss <= o.st1.lim) &&
          (!o.st2 || o.st2.ok || o.ss <= o.st2.lim),
      );
    let best: GcProposal | null = null;
    for (let n = 1; n <= 5; n++) {
      for (let hri = 4; hri <= 12; hri += 1) {
        for (let hc = 2; hc <= 0.7 * hri + 1e-9; hc += 0.5) {
          for (let hs = 3; hs <= 5; hs += 0.5) {
            const Ht = n * hri + 2 * hc + (n + 1) * hs;
            if (Math.abs(Ht - R.Htot) > 0.5) continue;
            const Q = gcCalc(I, { ...C, n, hri, hc, hs }, Rof(G), Rof(Bq));
            if (!okAll(Q)) continue;
            const sc = Math.max(Q.rg.sum, Q.rb.sum);
            if (
              !best ||
              sc < best.sc - 1e-9 ||
              (Math.abs(sc - best.sc) < 1e-9 && Q.hrt > best.Q.hrt)
            ) {
              best = { Q, sc, n, hri, hc, hs };
            }
          }
        }
      }
    }
    R.bestProposal = best;
    if (best) {
      const propRow = `<tr><td class="l" colspan="10"><b>Đề xuất cấu tạo lớp thỏa mãn</b> (giữ mặt bằng ${fx(C.L, 0)}x${fx(C.W, 0)}, chiều cao ${fx(R.Htot, 0)} mm): ${best.n} lớp trong ${fx(best.hri, 1)} mm + 2 lớp phủ ngoài ${fx(best.hc, 1)} mm + ${best.n + 1} bản thép ${fx(best.hs, 1)} mm ; hrt = ${fx(best.Q.hrt, 1)} mm ; tổ hợp ứng biến lớn nhất ${fx(best.sc, 3)} ≤ 5,0. Nhập lại các thông số này ở mục 1 để kiểm tra chi tiết.</td></tr>`;
      const sumEl = $('tbGcSum');
      if (sumEl) {
        sumEl.innerHTML += propRow;
        setOutputValue('tbGcSum', sumEl.innerHTML);
      } else {
        setOutputValue('tbGcSum', (getOutputValue('tbGcSum') ?? '') + propRow);
      }
    }
  }

  setOut(
    'o_gc_LbT',
    C.Lexp
      ? 'Chuỗi liên tục nhiệt ' +
          ltnN() +
          ' nhịp, điểm cố định nhiệt ở giữa chuỗi: Lb = (n.Lt + (n - 1).g)/2 - a0 (gối ở đầu chuỗi)'
      : 'Nhịp giản đơn, điểm cố định nhiệt ở giữa nhịp: Lb = Ls/2',
  );
  gcDraw(R);

  const map: Record<string, number> = objLinkOff()
    ? {}
    : {
        mo_Gb: +(R.Gmax * 1000).toFixed(1),
        mo_bga: C.L / 1000,
        mo_bgb: C.W / 1000,
        mo_hrt: +(R.hrt / 1000).toFixed(4),
        mo_nbg: I.Ng * C.nb,
      };
  let changed = false;
  for (const [id, val] of Object.entries(map)) {
    const e = $(id);
    if (!e) continue;
    const sv = String(val);
    if (e.value !== sv) {
      e.value = sv;
      changed = true;
    }
    e.readOnly = true;
    e.classList?.add('lnk');
    e.title = 'Lấy từ sheet gối cầu';
  }
  return { gc: R, changed };
}

export function sup2Step(options?: { damResult?: AnyDamResult | null }): boolean | undefined {
  const damR = activeGirderComposite(options?.damResult);
  if (!damR || !damR.g) return undefined;
  const I = damR.I;
  const out: Sup2Result = {};

  if (ikOn('10')) {
    try {
      const ddg = nums($('gg_dd')?.value || '').map((a) => [a[0], a[1]] as Point2D);
      const Hg = spV('gg_H');
      const g0 = damR.G0 as { b3?: number; bt?: number } | undefined;
      const bf =
        damR.type === 'I'
          ? g0?.b3 ?? Hg
          : damR.type === 'RC'
            ? g0?.bt ?? Hg
            : (() => {
                const y = Hg - 0.5;
                const xs: number[] = [];
                for (let i = 0; i < ddg.length; i++) {
                  const [x1, y1] = ddg[i];
                  const [x2, y2] = ddg[(i + 1) % ddg.length];
                  if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
                    xs.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
                  }
                }
                return xs.length > 1 ? Math.max(...xs) - Math.min(...xs) : Hg;
              })();
      const B: BmInput = {
        typeI: damR.type === 'I',
        bf,
        dB: spV('bm_dB'),
        sB: spV('bm_sB'),
        dT: spV('bm_dT'),
        sT: spV('bm_sT'),
        dLB: spV('bm_dLB'),
        sLB: spV('bm_sLB'),
        dLT: spV('bm_dLT'),
        sLT: spV('bm_sLT'),
        ct: spV('bm_ct'),
        cb: spV('bm_cb'),
      };
      const R = bmCalc(I, B);
      out.bm = R;
      setOut('o_bm_h', R.h, 0);
      {
        const Se = R.Se;
        const h = R.h;
        const bRes = damR.b as { P?: Point2D[] } | undefined;
        const gbd =
          damR.type === 'I'
            ? [(g0?.b3 ?? 0) / 2]
            : damR.type === 'RC'
              ? (bRes?.P || []).map((p) => p[0])
              : nums($('gb_dd')?.value || '').map((a) => a[0]);
        const half = gbd.length ? Math.max(...gbd.map(Math.abs)) : I.S * 500;
        const oh = Math.max(0, I.Wb * 500 - (((I.Ng - 1) / 2) * I.S * 1000 + half));
        const rs: string[] = [];
        if (Se / h < 6) {
          rs.push(
            'chiều dài có hiệu (khoảng cách giữa mép cánh trên các dầm) S = ' +
              fx(Se, 0) +
              ' mm nhỏ hơn 6 lần chiều dày bản',
          );
        }
        if (Se > 4100) rs.push('chiều dài có hiệu lớn hơn 4100 mm');
        if (oh < 5 * h) rs.push('phần hẫng ' + fx(oh, 0) + ' mm nhỏ hơn 5 lần chiều dày bản');
        setOut(
          'o_bm_meth',
          rs.length
            ? 'Thiết kế theo kinh nghiệm (Điều 7.2) không áp dụng được vì ' +
                rs.join('; ') +
                ' (Điều 7.2.4). Bản được thiết kế theo phương pháp truyền thống (Điều 7.3) với nội lực tính theo phương pháp dải (Điều 6.1 Phần 9, Điều 6.2.1 Phần 4).'
            : 'Bản có thể thiết kế theo kinh nghiệm (Điều 7.2); bảng tính này kiểm toán theo phương pháp truyền thống (Điều 7.3) với nội lực tính theo phương pháp dải (Điều 6.2.1 Phần 4).',
        );
        setOut(
          'o_bm_oh',
          oh < 10
            ? 'Bản không có phần hẫng (dầm biên đỡ bản tới mép ngoài cầu), nên Điều 7.1.5 (thiết kế bản hẫng chịu va xe vào lan can) không áp dụng. Liên kết gờ lan can với bản kiểm toán theo Phần 13 (ngoài phạm vi bảng tính này).'
            : 'Phần hẫng của bản ngoài mép dầm biên ' +
                fx(oh, 0) +
                ' mm: thiết kế bản hẫng theo Điều 7.1.5 Phần 9 và Điều A13.4.1 Phần 13 ở mục 6.',
        );
      }
      {
        const cm = I.Hsu > 0 ? 50 : 60;
        setOut('o_bm_ctmin', cm, 0);
        okn(
          'o_bm_ctmin',
          B.ct >= cm,
          (B.ct >= cm ? 'OK' : 'NG') +
            ': ct = ' +
            fx(B.ct, 0) +
            (I.Hsu > 0 ? ' (có lớp phủ)' : ' (xe chạy trực tiếp)'),
        );
        R.ctOK = B.ct >= cm;
        R.ctMin = cm;
        R.cbOK = B.cb >= 25;
      }
      okn('o_bm_h', R.h >= 175, (R.h >= 175 ? 'OK' : 'NG') + ' ≥ 175 mm');
      setOut('o_bm_bf', bf, 0);
      setOut('o_bm_face', R.face * 1000, 0);
      setOut(
        'o_bm_faceT',
        B.typeI
          ? 'Mặt cắt thiết kế mômen âm và lực cắt (Điều 6.2.1.6 Phần 4, dầm I bê tông đúc sẵn, mặt cắt loại k): cách tim dầm 1/3 bề rộng cánh trên, không quá 380 mm'
          : 'Mặt cắt tính mômen âm tại mép cấu kiện đỡ, cách tim dầm (Điều 6.2.1.6 Phần 4, dầm bản, mặt cắt loại f, g)',
      );
      setOut('o_bm_E1', R.E1 * 1000, 0);
      setOut('o_bm_E2', R.E2 * 1000, 0);
      setOut('o_bm_lp', R.lp * 1000, 0);
      setOut('o_bm_curb', R.curb, 3);
      setOut('o_bm_rail', R.rail, 3);
      setOut('o_bm_wDC', I.gc * I.hs, 3);
      setOut('o_bm_wDW', I.gsu * I.Hsu, 3);

      const gp = R.gP;
      const gn = R.gN;
      tbx(
        'tbBmM',
        `<tr><th colspan="3">Mômen (kN.m/m)</th><th>Vị trí x (m)</th><th>M DC</th><th>M DW</th><th>M LL+IM</th><th>Mu (CĐ I)</th><th>Ms (SD I)</th></tr>` +
          (
            [
              ['Mômen dương lớn nhất (giữa các dầm)', gp],
              ['Mômen âm lớn nhất (tại mép mặt trên dầm)', gn],
            ] as Array<[string, BmMomentRow]>
          )
            .map(
              ([t, r]) =>
                `<tr><td class="l" colspan="3">${t}</td><td>${fx(r.x, 3)}</td><td>${fx(r.DC, 3)}</td><td>${fx(r.DW, 3)}</td><td>${fx(r.LL, 3)}</td><td><b>${fx(r.Mu, 3)}</b></td><td>${fx(r.Ms, 3)}</td></tr>`,
            )
            .join('') +
          `<tr><td class="l" colspan="9">Tọa độ x tính từ tim cầu. M LL+IM = m.(1 + IM).M(bánh xe)/E; E+ = ${fx(R.E1 * 1000, 0)} mm, E- = ${fx(R.E2 * 1000, 0)} mm. Mu = 1,25DC + 1,5DW + 1,75(LL+IM) (DC, DW lấy hệ số 0,9 / 0,65 khi ngược dấu).</td></tr>`,
      );
      const sec = (t: string, X: BmSectResult, Mu: number, _Ms: number, dd: string, ss: number): string =>
        `<tr><td class="l" colspan="2">${t}</td><td>${dd} @ ${ss}</td><td>${fx(X.As, 0)}</td><td>${fx(X.d, 0)}</td><td>${fx(X.a, 1)}</td><td>${fx(X.phi, 2)}</td><td>${fx(Math.abs(Mu), 2)}</td><td>${fx(X.Mr, 2)}</td>${ok2(X.Mr >= Math.abs(Mu))}</tr>`;
      tbx(
        'tbBmR',
        `<tr><th colspan="2">Mặt cắt</th><th>Cốt thép</th><th>As (mm2/m)</th><th>d (mm)</th><th>a (mm)</th><th>φ</th><th>Mu</th><th>Mr</th><th>KL</th></tr>` +
          sec('M+ : thép ngang lớp dưới', R.P, gp.Mu, gp.Ms, 'D' + B.dB, B.sB) +
          sec('M- : thép ngang lớp trên', R.N, gn.Mu, gn.Ms, 'D' + B.dT, B.sT) +
          `<tr><td class="l" colspan="10">Mr = φ.As.fy.(d - a/2) ; a = As.fy/(0,85.f'c.b) ; φ = 0,9 khi εt ≥ 0,005 (Điều 5.4.2 Phần 5). Mô men tính bằng kN.m/m.</td></tr>`,
      );
      const mn = (t: string, X: BmSectResult, Mu: number): string =>
        `<tr><td class="l" colspan="3">${t}</td><td>${fx(X.Mcr, 2)}</td><td>${fx(1.33 * Math.abs(Mu), 2)}</td><td>${fx(X.Mmin, 2)}</td><td>${fx(X.Mr, 2)}</td>${ok2(X.Mr >= X.Mmin)}</tr>`;
      tbx(
        'tbBmMin',
        `<tr><th colspan="3">Mặt cắt</th><th>Mcr</th><th>1,33Mu</th><th>Yêu cầu</th><th>Mr</th><th>KL</th></tr>` +
          mn('M+ (thép dưới)', R.P, gp.Mu) +
          mn('M- (thép trên)', R.N, gn.Mu) +
          `<tr><td class="l" colspan="8">Mcr = γ3.γ1.fr.Sc ; γ1 = 1,6 ; γ3 = fy/fu (TCVN 1651-2) ; fr = 0,63√f'c ; Sc = b.h²/6 (Điều 7.3.3.2 Phần 5). kN.m/m.</td></tr>`,
      );
      const cr = (t: string, X: BmSectResult): string =>
        `<tr><td class="l" colspan="2">${t}</td><td>${fx(X.dc, 1)}</td><td>${fx(X.x, 1)}</td><td>${fx(X.fss, 1)}</td><td>${fx(X.bs, 3)}</td><td>${fx(X.smax, 0)}</td><td>${fx(X.s ?? 0, 0)}</td>${ok2((X.s ?? 0) <= X.smax)}</tr>`;
      tbx(
        'tbBmCr',
        `<tr><th colspan="2">Mặt cắt</th><th>dc (mm)</th><th>x (mm)</th><th>fss (MPa)</th><th>βs</th><th>s max (mm)</th><th>s (mm)</th><th>KL</th></tr>` +
          cr('M+ (thép dưới)', R.P) +
          cr('M- (thép trên)', R.N) +
          `<tr><td class="l" colspan="9">s ≤ 123000.γe/(βs.fss) - 2dc ; βs = 1 + dc/(0,7(h - dc)) ; γe = ${fx(R.P.ge, 2)} (bề mặt bản mặt cầu: điều kiện phơi lộ cấp 2) ; fss ≤ 0,6fy tính theo mặt cắt nứt, n = Es/Ec = ${fx(R.n, 2)} (Điều 7.3.4 Phần 5).</td></tr>`,
      );
      setOut('o_bm_Vu', R.Vu, 2);
      setOut('o_bm_dv', R.dv, 0);
      setOut('o_bm_Vr', R.Vr, 2);
      okn('o_bm_Vr', R.Vr >= R.Vu, (R.Vr >= R.Vu ? 'OK' : 'NG') + ' ≥ Vu = ' + fx(R.Vu, 2));
      tbx(
        'tbBmT',
        `<tr><th colspan="3">Lớp cốt thép</th><th>Cốt thép</th><th>As (mm2/m)</th><th>As yêu cầu (mm2/m)</th><th>s max (mm)</th><th>KL</th></tr>` +
          R.lay
            .map(([t, d, s, a], i) => {
              const req = i === 2 ? Math.max(R.Ast, R.AsDist) : R.Ast;
              return `<tr><td class="l" colspan="3">${t}</td><td>D${d} @ ${s}</td><td>${fx(a, 0)}</td><td>${fx(req, 0)}${i === 2 ? ' (*)' : ''}</td><td>${fx(R.smaxT, 0)}</td>${ok2(a >= req - 1e-6 && s <= R.smaxT)}</tr>`;
            })
            .join('') +
          `<tr><td class="l" colspan="8">Co ngót, nhiệt độ (Điều 10.8 Phần 5): As ≥ 0,75bh/(2(b + h)fy), 233 ≤ As ≤ 1270 mm2/m, s ≤ min(3h ; 450). (*) Cốt thép phân bố lớp dưới (Điều 7.3.2 Phần 9, thép chính vuông góc làn xe): ≥ min(3840/√S ; 67%) As thép chính dưới = ${fx(100 * R.pct, 1)}% x ${fx(R.P.As, 0)} = ${fx(R.AsDist, 0)} mm2/m ; S = ${fx(R.Se, 0)} mm (khoảng cách giữa mép cánh trên các dầm, Điều 7.2.3).</td></tr>` +
          (R.AsLB < R.AsDist - 1e-6
            ? `<tr><td class="l" colspan="8">Cốt thép dọc lớp dưới bố trí ${fx(R.AsLB, 0)} mm2/m < ${fx(R.AsDist, 0)} mm2/m (67% cốt thép ngang lớp dưới đã bố trí). Đề xuất: ${[
                [14, 150],
                [16, 200],
                [16, 150],
                [18, 200],
              ]
                .map(([d, sp]) => [d, sp, (((Math.PI * d * d) / 4) * 1000) / sp] as const)
                .filter((x) => x[2] >= R.AsDist)
                .slice(0, 2)
                .map((x) => 'D' + x[0] + '@' + x[1] + ' (' + fx(x[2], 0) + ' mm2/m)')
                .join(' hoặc ')}.</td></tr>`
            : ''),
      );
      const items: Array<[string, boolean]> = [
        ['Chiều dày bản (không kể lớp hao mòn) ≥ 175 mm', R.h >= 175],
        ['Lớp bê tông bảo vệ mặt trên ≥ ' + (R.ctMin ?? 50) + ' mm (Bảng 13 Phần 5)', Boolean(R.ctOK)],
        ['Lớp bê tông bảo vệ mặt dưới ≥ 25 mm (Bảng 13 Phần 5)', R.cbOK !== false],
        ['Sức kháng uốn M+', R.P.Mr >= Math.abs(gp.Mu)],
        ['Sức kháng uốn M-', R.N.Mr >= Math.abs(gn.Mu)],
        ['Cốt thép tối thiểu', R.P.Mr >= R.P.Mmin && R.N.Mr >= R.N.Mmin],
        ['Kiểm soát nứt', (R.P.s ?? 0) <= R.P.smax && (R.N.s ?? 0) <= R.N.smax],
        ['Sức kháng cắt', R.Vr >= R.Vu],
        [
          'Cốt thép co ngót, nhiệt độ và phân bố',
          R.lay.every(
            ([_t, _d, s, a], i) =>
              a >= (i === 2 ? Math.max(R.Ast, R.AsDist) : R.Ast) - 1e-6 && s <= R.smaxT,
          ),
        ],
      ];
      tbx(
        'tbBmSum',
        `<tr><th colspan="8">Hạng mục kiểm toán bản mặt cầu</th><th colspan="2">KL</th></tr>` +
          items
            .map(([t, o]) => `<tr><td class="l" colspan="8">${t}</td>${ok2(o, null, 2)}</tr>`)
            .join(''),
      );
      R.items = items;
      bmSumRender(R);
      bmDraw(I, R);
    } catch (e) {
      console.error(e);
    }
  }

  try {
    const gcRes = gcStep(I, { damResult: damR });
    out.gc = gcRes.gc;
    if (gcRes.changed) out.changed = true;
  } catch (e) {
    console.error(e);
  }

  if (ikOn('12')) {
    try {
      ltnStep(I, out, { damResult: damR });
    } catch (e) {
      console.error(e);
    }
  } else {
    LTNR = null;
  }
  if (ikOn('13')) {
    try {
      kcgStep(I);
    } catch (e) {
      console.error(e);
    }
  } else {
    KCGR = null;
  }
  if (ikOn('14') || ikOn('10')) {
    try {
      glcStep(I);
    } catch (e) {
      console.error(e);
    }
  } else {
    GLCR = null;
  }
  try {
    if (out.bm) bmOhStep(I, out.bm);
  } catch (e) {
    console.error(e);
  }
  SUP2R = out;
  return out.changed;
}

// ---------------------------------------------------------------------------
// 7. Link Slab Solver (LTN / LTNR — Caner & Zia 1998, TCVN 11823-5:2017)
// ---------------------------------------------------------------------------

export function ltnOn(): boolean {
  const el = $('tq_bltn');
  return !!el && el.value === '1';
}

export function ltnN(): number {
  return Math.max(1, Math.round(num('ln_n') || 1));
}

export function ltnLexp(I: DamSpInput): number | null {
  if (!ltnOn() || ltnN() < 2) return null;
  const n = ltnN();
  const g = num('ln_gap') || 0;
  return (n * I.Lt * 1000 + (n - 1) * g) / 2;
}

export function ltnCalc(
  I: DamSpInput,
  G: AnyGirderBranch,
  Bq: AnyGirderBranch | null | undefined,
  gc: GcCalcResult | KdStepResult | null | undefined,
  P: LtnInput,
): LtnCalcResult {
  const wc = P.fc <= 35 ? 2320 : 2240 + 2.29 * P.fc;
  const Esl = 0.0017 * wc * wc * P.fc ** 0.33;
  const Es = 200000;
  const b = 1000;
  const h = P.h;
  const fy = P.fy;
  const fc = P.fc;
  const Isl = (b * h ** 3) / 12;
  const k2 = (2 * Esl * Isl) / P.Lc;
  const k4 = 2 * k2;

  const rot = (R: AnyGirderBranch): LtnRotationResult => {
    const L = R.Lm;
    const EI = R.EIc;
    const th = (Pk: number, a: number): number =>
      a <= 0 || a >= L ? 0 : (Pk * a * (L * L - a * a)) / (6 * EI * L);
    const veh: Array<Array<[number, number]>> = [
      [
        [0, 35],
        [4.3, 145],
        [8.6, 145],
      ],
      [
        [0, 145],
        [4.3, 145],
        [8.6, 35],
      ],
      [
        [0, 110],
        [1.2, 110],
      ],
    ];
    let tv = 0;
    let vn = '';
    veh.forEach((vehAxles, iv) => {
      for (let p0 = -9; p0 <= L + 0.001; p0 += 0.02) {
        const t = vehAxles.reduce((s, [o, Pk]) => s + th(Pk, p0 + o), 0);
        if (t > tv) {
          tv = t;
          vn = iv < 2 ? 'Xe tải' : 'Xe 2 trục';
        }
      }
    });
    const w3 = L ** 3 / (24 * EI);
    const tl = 9.3 * w3;
    const df = R.DF as { M: number; M1: number; M1e?: number; Mf?: number };
    const loads = ((R as { loads?: Record<string, number> }).loads || {}) as Record<string, number>;
    const DF = df.M;
    const IM = R.IM;
    const wPL = loads.wPL ?? 0;
    const DC4 = loads.DC4 ?? loads.w3 ?? 0;
    const DW = loads.DW ?? loads.wDW ?? 0;
    const tLL = DF * ((1 + IM) * tv + tl) + wPL * w3;
    const tDC = DC4 * w3;
    const tDW = DW * w3;

    let tvF = 0;
    const fatVeh: Array<Array<[number, number]>> = [
      [
        [0, 35],
        [4.3, 145],
        [13.3, 145],
      ],
      [
        [0, 145],
        [9, 145],
        [13.3, 35],
      ],
    ];
    fatVeh.forEach((vehAxles) => {
      for (let p0 = -14; p0 <= L + 0.001; p0 += 0.02) {
        const t = vehAxles.reduce((s, [o, Pk]) => s + th(Pk, p0 + o), 0);
        if (t > tvF) tvF = t;
      }
    });
    const DFf =
      df.Mf != null ? df.Mf : (R.kind === 'bien' ? df.M1e || df.M1 : df.M1) / 1.2;
    const tF = 1.5 * DFf * 1.15 * tvF;

    const tg = R.TG as { pos?: { kap?: number }; neg?: { kap?: number } } | undefined;
    const kP = Math.abs(tg?.pos?.kap || 0);
    const kN = Math.abs(tg?.neg?.kap || 0);
    const tTGp = (kP * L * 1000) / 2;
    const tTGn = (kN * L * 1000) / 2;
    return {
      L,
      EI,
      tv,
      vn,
      tl,
      DF,
      IM,
      tLL,
      tDC,
      tDW,
      tvF,
      DFf,
      tF,
      tTGp,
      tTGn,
      MLL: (k4 * tLL) / 1e6,
      MDC: (k2 * tDC) / 1e6,
      MDW: (k2 * tDW) / 1e6,
      MF: (k4 * tF) / 1e6,
      MTGp: (k2 * tTGp) / 1e6,
      MTGn: (k2 * tTGn) / 1e6,
      Mu: 0,
      Ms: 0,
      MuP: 0,
    };
  };

  const rg = rot(G);
  const rb = rot(Bq || G);
  const gTG = (G.TG as { g?: number } | undefined)?.g || 0;
  [rg, rb].forEach((r) => {
    r.Mu = 1.75 * r.MLL + 1.25 * r.MDC + 1.5 * r.MDW + gTG * r.MTGn;
    r.Ms = r.MLL + r.MDC + r.MDW + gTG * r.MTGn;
    r.MuP = gTG * r.MTGp;
  });
  const rc = rb.Ms > rg.Ms ? rb : rg;
  const Wb = I.Wb;
  const n = P.n;

  const BR = gc ? gc.BR : 0;
  const NBR = n > 1 ? (BR * (n - 1)) / n / Wb : 0;
  const kb = gc ? (gc.Gmax * gc.A) / gc.hrt / 1000 : 0;
  const K = kb * I.Ng * (gc?.C ? gc.C.nb : 2);
  const Lt = I.Lt * 1000;
  const a0 = I.a0 * 1000;
  const xs: number[] = [];
  for (let i = 0; i < n; i++) {
    const s0 = i * (Lt + P.gap);
    xs.push(s0 + a0, s0 + Lt - a0);
  }
  const xc = (n * Lt + (n - 1) * P.gap) / 2;
  const eSh = gc?.C ? gc.C.eSh : 0;
  const eT = I.alpha * (P.Tc - P.Tmin);
  const eC = I.alpha * (P.Tmax - P.Tc);
  let Smax = 0;
  let jMax = 1;
  for (let j = 1; j < n; j++) {
    const cut = j * (Lt + P.gap) - P.gap / 2;
    const sj = Math.abs(xs.filter((x) => x < cut).reduce((t, x) => t + K * (xc - x), 0));
    if (sj > Smax) {
      Smax = sj;
      jMax = j;
    }
  }
  let NTt = Smax * eT;
  let NTc = Smax * eC;
  let NSh = Smax * eSh;
  const gcCap = gc && 'cap' in gc ? (gc.cap ?? 0) : 0;
  if (gcCap > 0) {
    const capF = gcCap;
    const Nof = (e: number): number => {
      let best = 0;
      for (let j = 1; j < n; j++) {
        const cut = j * (Lt + P.gap) - P.gap / 2;
        const sj = Math.abs(
          xs
            .filter((x) => x < cut)
            .reduce(
              (t, x) => t + Math.sign(xc - x) * Math.min(K * Math.abs(xc - x) * e, capF),
              0,
            ),
        );
        if (sj > best) best = sj;
      }
      return best;
    };
    NTt = Nof(eT);
    NTc = Nof(eC);
    NSh = Nof(eSh);
  }
  NTt /= Wb;
  NTc /= Wb;
  NSh /= Wb;
  const Nu = 1.75 * NBR + 0.5 * NTt + 1.0 * NSh;
  const Ns = NBR + 1.0 * NTt + 1.0 * NSh;

  const Ab = (d: number): number => (Math.PI * d * d) / 4;
  const AsT = (Ab(P.dT) * 1000) / P.sT;
  const AsB = (Ab(P.dB) * 1000) / P.sB;
  const dT = h - P.aT;
  const b1 = Math.min(0.85, Math.max(0.65, 0.85 - (0.05 * (fc - 28)) / 7));
  const phiOf = (c: number, d: number): { et: number; phi: number } => {
    const et = (0.003 * (d - c)) / c;
    return {
      et,
      phi: Math.min(0.9, Math.max(0.75, 0.75 + (0.15 * (et - 0.002)) / (0.005 - 0.002))),
    };
  };
  const a0f = 0;
  const pf = null;
  const dB = P.aB;
  const fsOf = (e: number): number => Math.max(-fy, Math.min(fy, Es * e));
  const solve = (Nn: number) => {
    let lo = 1e-3;
    let hi = dT;
    const F = (c: number): number => {
      const es = (0.003 * (dT - c)) / c;
      const esc = (0.003 * (c - dB)) / c;
      const Cc = 0.85 * fc * b * b1 * c;
      const Cs = AsB * (fsOf(esc) - (c > dB ? 0.85 * fc : 0));
      return Cc + Cs - AsT * fsOf(es) + Nn;
    };
    for (let k = 0; k < 80; k++) {
      const m = (lo + hi) / 2;
      if (F(m) > 0) hi = m;
      else lo = m;
    }
    const c = (lo + hi) / 2;
    const es = (0.003 * (dT - c)) / c;
    const esc = (0.003 * (c - dB)) / c;
    const a = b1 * c;
    const Cc = 0.85 * fc * b * a;
    const Cs = AsB * (fsOf(esc) - (c > dB ? 0.85 * fc : 0));
    return {
      c,
      a,
      et: es,
      fs: fsOf(es),
      fsc: fsOf(esc),
      Cc,
      Cs,
      Mcap: Cc * (dT - a / 2) + Cs * (dT - dB),
    };
  };

  let ph = 0.9;
  let X = solve((Nu * 1e3) / ph);
  for (let k = 0; k < 8; k++) {
    X = solve((Nu * 1e3) / ph);
    const q = phiOf(X.c, dT).phi;
    if (Math.abs(q - ph) < 1e-6) break;
    ph = q;
  }
  const NnVal = (Nu * 1e3) / ph;
  const MreqVal = (rc.Mu * 1e6) / ph + NnVal * (dT - h / 2);
  const MN: LtnMnResult = {
    ...X,
    Nn: NnVal,
    Mreq: MreqVal,
    phi: ph,
    ratio: MreqVal / X.Mcap,
  };
  const X0 = solve(0);
  const Mr0 = (phiOf(X0.c, dT).phi * X0.Mcap) / 1e6;
  const Nr = (0.9 * fy * (AsT + AsB)) / 1e3;

  const fr = 0.63 * Math.sqrt(fc);
  const Sc = (b * h * h) / 6;
  const fuMap: Record<number, number> = { 240: 380, 300: 450, 400: 570, 500: 650 };
  const g3 = fy / (fuMap[Math.round(fy)] || fy / 0.67);
  const Mcr = (g3 * 1.6 * fr * Sc) / 1e6;
  const Mmin = Math.min(1.33 * rc.Mu, Mcr);

  const nE = Es / Esl;
  const rho = AsT / (b * dT);
  const kk = Math.sqrt(2 * rho * nE + (rho * nE) ** 2) - rho * nE;
  const jj = 1 - kk / 3;
  const fss = (rc.Ms * 1e6) / (AsT * jj * dT) + (Ns * 1e3) / (AsT + AsB);
  const dc = P.aT;
  const bs = 1 + dc / (0.7 * (h - dc));
  const smax = (P.ge * 123000) / (bs * fss) - 2 * dc;

  const Vu = (1.5 * 1.75 * rc.MLL) / (P.Lc / 1000);
  const dv = Math.max(0.9 * dT, 0.72 * h);
  const Vr = (0.9 * 0.083 * 2 * Math.sqrt(fc) * b * dv) / 1e3;

  const MuP = Math.max(rg.MuP, rb.MuP);
  const dBt = h - P.aB;
  const aP = (AsB * fy) / (0.85 * fc * b);
  const MrP = (0.9 * AsB * fy * (dBt - aP / 2)) / 1e6;

  const rF = rb.MF > rg.MF ? rb : rg;
  const fyF = Math.max(420, Math.min(690, fy));
  const dfF = (rF.MF * 1e6) / (AsT * jj * dT);
  const fminF = ((rF.MDC + rF.MDW) * 1e6) / (AsT * jj * dT);
  const dFTH = 166 - (138 * fminF) / fyF;

  const Bw = Wb * 1000;
  const Ast = Math.min(1270, Math.max(233, ((0.75 * Bw * h) / (2 * (Bw + h) * fy)) * 1000));
  const smaxT = Math.min(3 * h, 450);
  const AsTr = (Ab(P.dTr) * 1000) / P.sTr;

  const ctMin = I.Hsu > 0 ? 50 : 60;
  const ct = P.aT - P.dT / 2;
  const cb = P.aB - P.dB / 2;
  const Ldz = 0.05 * 2 * G.Lm * 1000;
  const Lexp = xc;

  return {
    k4,
    gTG,
    MuP,
    dBt,
    aP,
    MrP,
    rF,
    fyF,
    dfF,
    fminF,
    dFTH,
    Esl,
    Isl,
    k2,
    rg,
    rb,
    rc,
    BR,
    NBR,
    kb,
    K,
    xs,
    xc,
    eSh,
    eT,
    eC,
    NTt,
    NTc,
    NSh,
    jMax,
    Nu,
    Ns,
    AsT,
    AsB,
    dT,
    b1,
    a0f,
    pf,
    Mr0,
    MN,
    Nr,
    fr,
    Sc,
    Mcr,
    Mmin,
    nE,
    rho,
    kk,
    jj,
    fss,
    dc,
    bs,
    smax,
    Vu,
    dv,
    Vr,
    Ast,
    smaxT,
    AsTr,
    ctMin,
    ct,
    cb,
    Ldz,
    Lexp,
  };
}

export function ltnStep(
  I: DamSpInput,
  out?: Sup2Result,
  options?: { damResult?: AnyDamResult | null },
): LtnCalcResult | null {
  const on = ltnOn();
  const lnOff = resolveRealDom('ln_off');
  if (lnOff) lnOff.style.display = on ? 'none' : '';
  const tab12 = resolveRealDom('tab12');
  if (tab12) {
    Array.from(tab12.children).forEach((el) => {
      const hEl = el as HTMLElement;
      if (hEl.id !== 'ln_off' && !hEl.classList.contains('ttl')) {
        hEl.style.display = on ? '' : 'none';
      }
    });
  }
  if (!on) {
    LTNR = null;
    return null;
  }
  const damR = activeGirderComposite(options?.damResult);
  if (!damR || !damR.g) return null;
  const gc = out?.gc ?? SUP2R?.gc ?? null;
  const Tmax = num('mo_Tmax');
  const Tmin = num('mo_Tmin');
  const tcv = String($('ln_Tc')?.value ?? '').trim();
  const P: LtnInput = {
    n: ltnN(),
    Lc: num('ln_Lc'),
    gap: num('ln_gap'),
    h: num('ln_h'),
    fc: num('ln_fc'),
    fy: num('sp_fy') || 400,
    dT: num('ln_dT'),
    sT: num('ln_sT'),
    aT: num('ln_aT'),
    dB: num('ln_dB'),
    sB: num('ln_sB'),
    aB: num('ln_aB'),
    dTr: num('ln_dTr'),
    sTr: num('ln_sTr'),
    ge: num('ln_ge') || 0.75,
    Tmax,
    Tmin,
    Tc: tcv === '' ? (Tmax + Tmin) / 2 : num('ln_Tc'),
  };
  const gBranch = damR.g as AnyGirderBranch;
  const bBranch = (damR.b ?? null) as AnyGirderBranch | null;
  const R = ltnCalc(I, gBranch, bBranch, gc, P);
  R.P = P;
  LTNR = R;
  const rc = R.rc;

  setOut('o_ln_Ls', gBranch.Lm, 3);
  setOut('o_ln_Esl', R.Esl, 0);
  setOut('o_ln_Isl', R.Isl / 1e6, 1);
  setOut('o_ln_fy', P.fy, 0);
  setOut('o_ln_Tmx', Tmax, 1);
  setOut('o_ln_Tmn', Tmin, 1);
  setOut('o_ln_Tcc', P.Tc, 1);
  setOut('o_ln_AsT', R.AsT, 0);
  setOut('o_ln_AsB', R.AsB, 0);
  setOut('o_ln_Ldz', R.Ldz, 0);
  okn('o_ln_Ldz', P.Lc >= R.Ldz, P.Lc >= R.Ldz ? 'OK ≤ Lc' : '> Lc');
  setOut('o_ln_k2', R.k2 / 1e9, 3);
  setOut('o_ln_k4', R.k4 / 1e9, 3);

  const rs = [R.rg, R.rb];
  const row = (t: string, f: (o: LtnRotationResult) => string | number, d?: number): string =>
    `<tr><td class="l" colspan="4">${t}</td>${rs
      .map((o) => {
        const res = f(o);
        return `<td colspan="2">${typeof res === 'string' ? res : fx(res, d ?? 2)}</td>`;
      })
      .join('')}</tr>`;

  tbx(
    'tbLnTh',
    `<tr><th colspan="4">Đại lượng (1 dầm)</th><th colspan="2">Dầm giữa</th><th colspan="2">Dầm biên</th></tr>` +
      row(
        'Nhịp tính toán L (m) ; độ cứng liên hợp Ec.Ic (kN.m2)',
        (o) => fx(o.L, 3) + ' ; ' + o.EI.toExponential(4),
      ) +
      row('Hệ số phân bố mômen gM ; lực xung kích IM', (o) => fx(o.DF, 4) + ' ; ' + fx(o.IM, 2)) +
      row(
        'Góc xoay do xe thiết kế (1 làn, chưa nhân g, IM), vị trí bất lợi (rad)',
        (o) => o.tv.toExponential(4) + ' (' + o.vn + ')',
      ) +
      row('Góc xoay do tải trọng làn 9,3 kN/m (1 làn) (rad)', (o) => o.tl.toExponential(4)) +
      row('θLL = gM.[(1 + IM).θxe + θlàn] + θPL (rad)', (o) => o.tLL.toExponential(4)) +
      row('θDC: gờ lan can, lan can, lề bộ hành (tác dụng sau khi nối bản) (rad)', (o) =>
        o.tDC.toExponential(4),
      ) +
      row('θDW: lớp phủ, tiện ích (rad)', (o) => o.tDW.toExponential(4)) +
      row(
        'Gradien nhiệt: θTG = κ.L/2, dương ; âm (rad)',
        (o) => o.tTGp.toExponential(4) + ' ; ' + o.tTGn.toExponential(4),
      ) +
      row(
        'Xe mỏi (1 làn, trục sau 9,0 m): θ ; gf ; θMỏi = 1,5.gf.1,15.θ (rad)',
        (o) => o.tvF.toExponential(4) + ' ; ' + fx(o.DFf, 4) + ' ; ' + o.tF.toExponential(4),
      ),
  );

  tbx(
    'tbLnM',
    `<tr><th colspan="4">Mômen âm trong bản (kN.m/m)</th><th>M LL+IM</th><th>M DC</th><th>M DW</th><th>M TG âm</th><th>Mu (CĐ I)</th><th>Ms (SD I)</th></tr>` +
      rs
        .map(
          (o, i) =>
            `<tr><td class="l" colspan="4">Do góc xoay ${i ? 'dầm biên' : 'dầm giữa'}</td><td>${fx(o.MLL, 3)}</td><td>${fx(o.MDC, 3)}</td><td>${fx(o.MDW, 3)}</td><td>${fx(o.MTGn, 3)}</td><td>${o === rc ? '<b>' + fx(o.Mu, 3) + '</b>' : fx(o.Mu, 3)}</td><td>${o === rc ? '<b>' + fx(o.Ms, 3) + '</b>' : fx(o.Ms, 3)}</td></tr>`,
        )
        .join('') +
      `<tr><td class="l" colspan="10">Mu = 1,75M LL+IM + 1,25M DC + 1,5M DW + γTG.M TG ; Ms = M LL+IM + M DC + M DW + γTG.M TG ; γTG = ${fx(R.gTG, 2)} (như sheet dầm). Lấy giá trị bất lợi hơn (số đậm). Tĩnh tải bản thân dầm, bản mặt cầu tác dụng trước khi bản liên tục nhiệt làm việc nên không gây mômen trong bản. Gradien nhiệt dương gây mômen dương trong bản (kiểm tra ở mục 4): γTG.M TG dương = ${fx(R.MuP, 3)} kN.m/m.</td></tr>`,
  );

  setOut('o_ln_BR', R.BR, 2);
  setOut('o_ln_NBR', R.NBR, 3);
  setOut('o_ln_kb', R.kb, 3);
  setOut('o_ln_K', R.K, 2);
  setOut('o_ln_eTt', R.eT * 1e6, 1);
  setOut('o_ln_eSh', R.eSh * 1e6, 1);
  setOut('o_ln_NSh', R.NSh, 3);
  setOut('o_ln_eTc', R.eC * 1e6, 1);
  setOut('o_ln_NTt', R.NTt, 3);
  setOut('o_ln_NTc', R.NTc, 3);
  setOut('o_ln_Nuu', R.Nu, 3);
  setOut('o_ln_Nss', R.Ns, 3);
  setOut(
    'o_ln_jx',
    P.n > 1
      ? 'Mặt cắt bất lợi: bản liên tục nhiệt thứ ' +
          R.jMax +
          ' (giữa nhịp ' +
          R.jMax +
          ' và nhịp ' +
          (R.jMax + 1) +
          ')'
      : '',
  );

  const MN = R.MN;
  tbx(
    'tbLnR',
    `<tr><th colspan="4">Đại lượng</th><th colspan="2">Giá trị</th><th colspan="3">Ghi chú</th></tr>` +
      [
        [
          'Cốt thép chịu kéo (lớp trên) As ; chiều cao có hiệu ds (mm2/m ; mm)',
          fx(R.AsT, 0) + ' ; ' + fx(R.dT, 0),
          'D' + P.dT + ' @ ' + P.sT,
        ],
        [
          'Mu ; Nu (CĐ I) (kN.m/m ; kN/m)',
          fx(rc.Mu, 3) + ' ; ' + fx(R.Nu, 3),
          'Nu kéo, đặt tại trọng tâm bản',
        ],
        [
          "Cốt thép lớp dưới A's ; a2 (mm2/m ; mm)",
          fx(R.AsB, 0) + ' ; ' + fx(P.aB, 0),
          'D' + P.dB + ' @ ' + P.sB,
        ],
        [
          'Chiều cao vùng nén c ; a = β1.c (mm) ; β1',
          fx(MN.c, 1) + ' ; ' + fx(MN.a, 1) + ' ; ' + fx(R.b1, 3),
          'cân bằng lực theo tương thích biến dạng',
        ],
        [
          "Ứng suất cốt thép chịu kéo fs ; cốt thép lớp dưới f's (MPa, + nén)",
          fx(MN.fs, 1) + ' ; ' + fx(MN.fsc, 1),
          'εcu = 0,003',
        ],
        [
          'Biến dạng cốt thép chịu kéo εt ; hệ số sức kháng φ',
          fx(MN.et, 4) + ' ; ' + fx(MN.phi, 3),
          'φ theo εt (Điều 5.4.2 Phần 5)',
        ],
        [
          'Mô men yêu cầu đối với cốt thép chịu kéo: Mu/φ + (Nu/φ).(ds - h/2) (kN.m/m)',
          fx(MN.Mreq / 1e6, 3),
          '',
        ],
        ['Sức kháng danh định: Cc.(ds - a/2) + Cs.(ds - a2) (kN.m/m)', fx(MN.Mcap / 1e6, 3), ''],
        ['Tỷ số yêu cầu / sức kháng', fx(MN.ratio, 3), ''],
      ]
        .map(
          (r) =>
            `<tr><td class="l" colspan="4">${r[0]}</td><td colspan="2">${r[1]}</td><td class="l" colspan="3">${r[2]}</td></tr>`,
        )
        .join('') +
      `<tr><td class="l" colspan="6">Kết luận uốn + kéo (CĐ I)</td>${ok2(MN.ratio <= 1, null, 3)}</tr>` +
      `<tr><td class="l" colspan="4">Kéo đúng tâm: φ.fy.(As trên + As dưới) ≥ Nu (kN/m)</td><td colspan="2">${fx(R.Nr, 1)} ≥ ${fx(R.Nu, 2)}</td>${ok2(R.Nr >= R.Nu, null, 3)}</tr>` +
      `<tr><td class="l" colspan="4">Mômen dương do gradien nhiệt dương, cốt thép lớp dưới chịu kéo: φ.As'.fy.(d - a/2) ≥ γTG.M TG (kN.m/m)</td><td colspan="2">${fx(R.MrP, 2)} ≥ ${fx(R.MuP, 2)}</td>${ok2(R.MrP >= R.MuP, null, 3)}</tr>` +
      `<tr><td class="l" colspan="4">Mỏi cốt thép lớp trên (Điều 5.5.3.2, PT 10): Δf = M Mỏi/(As.j.ds) ≤ (ΔF)TH = 166 - 138.fmin/fy ; fmin = ${fx(R.fminF, 1)} MPa (MPa)</td><td colspan="2">${fx(R.dfF, 1)} ≤ ${fx(R.dFTH, 1)}</td>${ok2(R.dfF <= R.dFTH, null, 3)}</tr>` +
      `<tr><td class="l" colspan="9">PT 10: bản in TCVN 11823-5 ghi (ΔF)TH = 166 - 20fmin/fy, hệ số 20 là trị số theo ksi; dạng SI theo AASHTO LRFD 7th Ed. (2014), PT 5.5.3.2-1 là 166 - 138fmin/fy (MPa), fy lấy trong khoảng 420 ÷ 690 MPa. Từ biến, độ vồng tăng thêm của dầm sau khi nối bản làm giảm mômen âm trong bản, bảng tính bỏ qua (thiên về an toàn cho mômen âm).</td></tr>`,
  );

  tbx(
    'tbLnMin',
    `<tr><th colspan="3">Mặt cắt</th><th>Mcr</th><th>1,33Mu</th><th>Yêu cầu</th><th>Mr</th><th>KL</th></tr>` +
      `<tr><td class="l" colspan="3">Mômen âm (thép trên)</td><td>${fx(R.Mcr, 2)}</td><td>${fx(1.33 * rc.Mu, 2)}</td><td>${fx(R.Mmin, 2)}</td><td>${fx(R.Mr0, 2)}</td>${ok2(R.Mr0 >= R.Mmin)}</tr>` +
      `<tr><td class="l" colspan="8">Mcr = γ3.γ1.fr.Sc ; γ1 = 1,6 ; γ3 = fy/fu (TCVN 1651-2) ; fr = 0,63√f'c = ${fx(R.fr, 3)} MPa ; Sc = b.h²/6 (Điều 7.3.3.2 Phần 5). Mr: uốn thuần túy, tương thích biến dạng như mục trên. kN.m/m.</td></tr>`,
  );

  tbx(
    'tbLnCr',
    `<tr><th colspan="4">Đại lượng</th><th colspan="2">Giá trị</th><th colspan="3">Giới hạn</th></tr>` +
      `<tr><td class="l" colspan="4">Ms ; Ns (SD I) (kN.m/m ; kN/m)</td><td colspan="2">${fx(rc.Ms, 3)} ; ${fx(R.Ns, 3)}</td><td colspan="3"></td></tr>` +
      `<tr><td class="l" colspan="4">n = Es/Ec ; ρ = As/(b.ds) ; k ; j = 1 - k/3</td><td colspan="2">${fx(R.nE, 2)} ; ${fx(R.rho, 5)} ; ${fx(R.kk, 4)} ; ${fx(R.jj, 4)}</td><td colspan="3"></td></tr>` +
      `<tr><td class="l" colspan="4">fss = Ms/(As.j.ds) + Ns/(As trên + As dưới) (MPa)</td><td colspan="2">${fx(R.fss, 1)}</td>${ok2(R.fss <= 0.6 * P.fy, '≤ 0,6fy = ' + fx(0.6 * P.fy, 0), 3)}</tr>` +
      `<tr><td class="l" colspan="4">Khuyến nghị cho bản liên tục nhiệt (Caner & Zia, 1998): fss ≤ 0,4fy (MPa)</td><td colspan="2">${fx(R.fss, 1)}</td>${ok2(R.fss <= 0.4 * P.fy, (R.fss <= 0.4 * P.fy ? 'OK' : 'Vượt') + ' : 0,4fy = ' + fx(0.4 * P.fy, 0), 3)}</tr>` +
      `<tr><td class="l" colspan="4">dc ; βs = 1 + dc/(0,7(h - dc)) ; γe</td><td colspan="2">${fx(R.dc, 0)} ; ${fx(R.bs, 3)} ; ${fx(P.ge, 2)}</td><td colspan="3"></td></tr>` +
      `<tr><td class="l" colspan="4">Bước cốt thép s ≤ 123000.γe/(βs.fss) - 2dc (mm)</td><td colspan="2">${fx(P.sT, 0)}</td>${ok2(P.sT <= R.smax, '≤ ' + fx(R.smax, 0), 3)}</tr>`,
  );

  setOut('o_ln_Vu', R.Vu, 2);
  setOut('o_ln_dv', R.dv, 0);
  setOut('o_ln_Vr', R.Vr, 2);
  okn('o_ln_Vr', R.Vr >= R.Vu, R.Vr >= R.Vu ? 'OK ≥ Vu' : 'NG < Vu');

  const lay: Array<[string, number, number, number]> = [
    ['Dọc cầu, lớp trên', P.dT, P.sT, R.AsT],
    ['Dọc cầu, lớp dưới', P.dB, P.sB, R.AsB],
    ['Ngang cầu (mỗi lớp)', P.dTr, P.sTr, R.AsTr],
  ];
  tbx(
    'tbLnT',
    `<tr><th colspan="3">Lớp cốt thép</th><th>Cốt thép</th><th>As (mm2/m)</th><th>As yêu cầu</th><th>s max (mm)</th><th>KL</th></tr>` +
      lay
        .map(
          ([t, d, s, a]) =>
            `<tr><td class="l" colspan="3">${t}</td><td>D${d} @ ${s}</td><td>${fx(a, 0)}</td><td>${fx(R.Ast, 0)}</td><td>${fx(R.smaxT, 0)}</td>${ok2(a >= R.Ast - 1e-6 && s <= R.smaxT)}</tr>`,
        )
        .join('') +
      `<tr><td class="l" colspan="3">Lớp bảo vệ mặt trên (tịnh)</td><td colspan="2">${fx(R.ct, 1)} mm</td><td colspan="2">≥ ${R.ctMin} mm${I.Hsu > 0 ? ' (có lớp phủ)' : ' (xe chạy trực tiếp)'}</td>${ok2(R.ct >= R.ctMin - 1e-6)}</tr>` +
      `<tr><td class="l" colspan="3">Lớp bảo vệ mặt dưới (tịnh)</td><td colspan="2">${fx(R.cb, 1)} mm</td><td colspan="2">≥ 25 mm</td>${ok2(R.cb >= 25 - 1e-6)}</tr>` +
      `<tr><td class="l" colspan="8">Co ngót, nhiệt độ (Điều 10.8 Phần 5): As ≥ 0,75bh/(2(b + h)fy), 233 ≤ As ≤ 1270 mm2/m cho mỗi mặt, s ≤ min(3h ; 450). Lớp bảo vệ theo Bảng 13 Phần 5, tính đến mép thanh cốt thép.</td></tr>`,
  );

  const items: Array<[string, boolean]> = [
    ['Uốn + kéo dọc trục (CĐ I)', MN.ratio <= 1],
    ['Kéo đúng tâm (CĐ I)', R.Nr >= R.Nu],
    ['Cốt thép tối thiểu', R.Mr0 >= R.Mmin],
    ['Ứng suất cốt thép fss ≤ 0,6fy', R.fss <= 0.6 * P.fy],
    ['Kiểm soát nứt (bước cốt thép)', P.sT <= R.smax],
    ['Sức kháng cắt', R.Vr >= R.Vu],
    ['Mômen dương do gradien nhiệt (cốt thép lớp dưới)', R.MrP >= R.MuP],
    ['Mỏi cốt thép', R.dfF <= R.dFTH],
    [
      'Cốt thép co ngót, nhiệt độ',
      lay.every(([, , s, a]) => a >= R.Ast - 1e-6 && s <= R.smaxT),
    ],
    ['Lớp bê tông bảo vệ', R.ct >= R.ctMin - 1e-6 && R.cb >= 25 - 1e-6],
  ];
  tbx(
    'tbLnSum',
    `<tr><th colspan="8">Hạng mục kiểm toán bản liên tục nhiệt</th><th colspan="2">KL</th></tr>` +
      items
        .map(([t, o]) => `<tr><td class="l" colspan="8">${t}</td>${ok2(o, null, 2)}</tr>`)
        .join('') +
      `<tr><td class="l" colspan="8">Khuyến nghị: fss ≤ 0,4fy ; chiều dài đoạn không dính bám Lc ≥ 0,05(L1 + L2)</td><td class="c" colspan="2">${R.fss <= 0.4 * P.fy && P.Lc >= R.Ldz ? 'Thỏa mãn' : 'Xem lại'}</td></tr>`,
  );
  R.allOK = items.every((x) => x[1]);
  klAppend(
    'tbLnSum',
    R.allOK,
    10,
    '(các khuyến nghị không thuộc tiêu chuẩn không tham gia kết luận)',
  );
  ltnDraw(I, R, damR);
  return R;
}

export function ltnDraw(
  I: DamSpInput,
  R: LtnCalcResult,
  damOverride?: AnyDamResult | null,
): void {
  const sv = resolveRealDom('dgLn') as SVGElement | null;
  if (!sv || !R.P) return;
  const damR = activeGirderComposite(damOverride);
  const id = 'Ln';
  const d = dgKit(id);
  const W = 760;
  const P = R.P;
  const H = (damR?.g as { H?: number } | undefined)?.H || 650;
  const half = P.Lc / 2 + 700;
  const k = (W - 180) / (2 * half);
  const x0 = W / 2;
  const yT = 70;
  const kv = Math.min(k * 1.6, 0.3);
  const X = (x: number): number => x0 + x * k;
  const Y = (y: number): number => yT + y * kv;
  d.T(
    W / 2,
    20,
    'Bản liên tục nhiệt trên trụ: mặt cắt dọc cầu (tỷ lệ đứng phóng to)',
    'middle',
    'font-weight="bold"',
  );
  const g2 = P.gap / 2;
  const a0 = I.a0 * 1000;
  const yb = P.h + 4 / kv;
  const yg = yb + H;
  const KK = supK();
  const bk2 = KK ? (spV('sp_bk2') || 0.5) * 1000 : 0;

  [-1, 1].forEach((s) => {
    const xa = X(s * g2);
    const xb = X(s * half);
    d.s += `<rect class="l" x="${Math.min(xa, xb).toFixed(1)}" y="${Y(P.h).toFixed(1)}" width="${Math.abs(xb - xa).toFixed(1)}" height="${((yg - P.h) * kv).toFixed(1)}" style="fill:#f4f4f4"/>`;
    if (KK) {
      const xa2 = X(s * g2);
      const xb2 = X(s * (g2 + bk2));
      d.s += `<rect x="${Math.min(xa2, xb2).toFixed(1)}" y="${Y(yg).toFixed(1)}" width="${Math.abs(xb2 - xa2).toFixed(1)}" height="3" style="fill:#333"/>`;
    } else {
      const xg = X(s * (g2 + a0));
      d.poly(
        [
          [xg, Y(yg)],
          [xg - 7, Y(yg) + 12],
          [xg + 7, Y(yg) + 12],
        ],
        '#fff',
      );
    }
  });

  if (KK) {
    d.s += `<rect class="l" x="${X(-g2 - bk2).toFixed(1)}" y="${(Y(yg) + 3).toFixed(1)}" width="${(2 * (g2 + bk2) * k).toFixed(1)}" height="22" style="fill:#e6e6e6"/>`;
    d.T(X((g2 + bk2) / 2), Y(yg) + 19, 'xà mũ trụ', 'middle', 'class="s"');
  }

  d.s += `<rect class="l" x="${X(-half).toFixed(1)}" y="${Y(0).toFixed(1)}" width="${(2 * half * k).toFixed(1)}" height="${(P.h * kv).toFixed(1)}" style="fill:url(#hP${id})"/>`;
  d.s += `<rect x="${X(-P.Lc / 2).toFixed(1)}" y="${Y(P.h).toFixed(1)}" width="${(P.Lc * k).toFixed(1)}" height="4" style="fill:#555"/>`;
  d.s += `<line x1="${X(-half + 30)}" y1="${Y(P.aT).toFixed(1)}" x2="${X(half - 30)}" y2="${Y(P.aT).toFixed(1)}" style="stroke:#c00;stroke-width:2"/>`;
  d.s += `<line x1="${X(-half + 30)}" y1="${Y(P.h - P.aB).toFixed(1)}" x2="${X(half - 30)}" y2="${Y(P.h - P.aB).toFixed(1)}" style="stroke:#c00;stroke-width:1.4"/>`;
  d.L(X(0), Y(-25), X(0), Y(yg) + 25, 'c');
  d.dimH(
    X(-P.Lc / 2),
    X(P.Lc / 2),
    Y(0) - 26,
    'Lc = ' + fx(P.Lc, 0) + ' (không dính bám)',
    Y(0),
  );
  d.dimV(X(half) + 16, Y(0), Y(P.h), 'h = ' + fx(P.h, 0));
  d.T(X(-half) - 4, Y(P.aT) + 4, 'D' + P.dT + '@' + P.sT, 'end', 'class="s"');
  d.T(X(-half) - 4, Y(P.h - P.aB) + 4, 'D' + P.dB + '@' + P.sB, 'end', 'class="s"');
  d.L(X(P.Lc / 2) - 20, Y(P.h) + 3, X(P.Lc / 2) - 50, Y(yb) + 30);
  d.T(X(P.Lc / 2) - 52, Y(yb) + 42, 'lớp đệm không dính bám', 'end', 'class="s"');
  if (KK) {
    d.dimH(
      X(-g2 - bk2),
      X(g2 + bk2),
      Y(yg) + 44,
      '2bk2 + g = ' +
        fx(2 * bk2 + P.gap, 0) +
        ' (lớp đệm dày ' +
        fx((spV('sp_tpad') || 0.02) * 1000, 0) +
        ')',
      Y(yg) + 25,
    );
  } else {
    d.dimH(
      X(-g2 - a0),
      X(g2 + a0),
      Y(yg) + 44,
      '2a0 + g = ' + fx(2 * a0 + P.gap, 0),
      Y(yg) + 12,
    );
  }
  d.T(X(-half / 2), Y(yb + H / 2) + 4, 'Nhịp ' + R.jMax, 'middle');
  d.T(X(half / 2), Y(yb + H / 2) + 4, 'Nhịp ' + (R.jMax + 1), 'middle');
  d.T(
    W / 2,
    Y(yg) + 70,
    'Mômen âm do góc xoay đầu dầm: Ma = 2.Esl.Isl.θ/Lc ; lực dọc: lực hãm, kiềm chế biến dạng nhiệt qua ' +
      (KK ? 'lớp đệm' : 'gối'),
    'middle',
    'class="s"',
  );
  dgPut(sv, W, Y(yg) + 84, d.s, id);
}

// ---------------------------------------------------------------------------
// 8. Expansion Joint at Abutment (KCG / KCGR — TCVN 11823-3:2017, Cl. 12.2)
// ---------------------------------------------------------------------------

export function kcgCalc(P: KcgInput): KcgCalcResult {
  const c = Math.cos((P.q * Math.PI) / 180);
  const s = Math.sin((P.q * Math.PI) / 180);
  const dT = P.Tmax - P.Tmin;
  const L = P.L;
  const Lt = P.mode === 'half' ? P.L / 2 : P.L;
  const Dsh = P.b * P.mu * Lt * 1000;
  const DshN = Dsh * c;
  const DshP = Dsh * s;
  const Dt = P.a * dT * Lt * 1000;
  const DtN = Dt * c;
  const DtP = Dt * s;
  const D1 = P.a * (P.Tmax - P.Tins) * Lt * 1000 * c;
  const Dop = P.a * (P.Tins - P.Tmin) * Lt * 1000 * c;
  const D2 = Dop + DshN;
  const Dtot = Dop + DshN + D1;
  const kD1 = P.k * D1;
  const kD2 = P.k * D2;
  const kDtot = P.k * Dtot;
  const DL = P.Dmax - P.Dmin;
  const DLN = DL * c;
  const m1 = 0.5 * DLN - kD1;
  const m2 = kD2 - 0.5 * DLN;
  const avg = (m1 + m2) / 2;
  const Dins = Math.ceil(P.Dmin + kD1 - 1e-9);
  const slope = P.a * Lt * 1000 * c;
  const Dt1 = Dins - slope * (P.t1 - P.Tins);
  const Dt2 = Dins - slope * (P.t2 - P.Tins);
  const chkMax = kD2 + Dins;
  const okMax = chkMax <= P.Dmax + 1e-9;
  const chkMin = Dins - kD1;
  const okMin = chkMin >= P.Dmin - 1e-9;
  const okRange = kDtot <= DLN + 1e-9;
  const ok = okMax && okMin && okRange;

  return {
    dT,
    L,
    Lt,
    Dsh,
    DshN,
    DshP,
    Dt,
    DtN,
    DtP,
    D1,
    Dop,
    D2,
    Dtot,
    kD1,
    kD2,
    kDtot,
    DL,
    DLN,
    m1,
    m2,
    avg,
    Dins,
    slope,
    Dt1,
    Dt2,
    chkMax,
    okMax,
    chkMin,
    okMin,
    okRange,
    ok,
  };
}

export function kcgStep(I: DamSpInput): KcgCalcResult | null {
  if (!I) return null;
  const chain = ltnOn() && ltnN() > 1;
  const n = chain ? ltnN() : 1;
  const g = chain ? num('ln_gap') || 0 : 0;
  const P: KcgInput = {
    Tmax: num('mo_Tmax'),
    Tmin: num('mo_Tmin'),
    Tins: num('kc_Tins'),
    t1: num('kc_t1'),
    t2: num('kc_t2'),
    a: I.alpha,
    b: num('kc_b'),
    mu: num('kc_mu'),
    L: n * I.Lt + ((n - 1) * g) / 1000,
    mode: $('kc_mode')?.value || 'half',
    q: I.skew || 0,
    k: num('kc_k') || 1.2,
    Dmin: num('kc_Dmin'),
    Dmax: num('kc_Dmax'),
    dA: num('kc_dA') || 0,
  };
  const r = kcgCalc(P);
  r.P = P;
  r.n = n;
  KCGR = r;

  const loStr = String($('kc_loai')?.value ?? '').trim();
  const rfStr = String($('kc_ref')?.value ?? '').trim();
  setOut('o_kc_loaiT', 'Loại khe co giãn: ' + (loStr || '-') + (rfStr ? ' (' + rfStr + ')' : ''));
  setOut('o_kc_Tmax', P.Tmax, 0);
  setOut('o_kc_Tmin', P.Tmin, 0);
  setOut('o_kc_dT', r.dT, 0);
  setOut('o_kc_a', (P.a * 1e6).toFixed(2) + 'E-06');
  setOut(
    'o_kc_sch',
    chain
      ? 'Chuỗi liên tục nhiệt ' +
          n +
          ' nhịp (sheet bản liên tục nhiệt): L = n.Lt + (n - 1).g = ' +
          n +
          ' x ' +
          fx(I.Lt, 2) +
          ' + ' +
          (n - 1) +
          ' x ' +
          fx(g / 1000, 3) +
          ' m'
      : 'Nhịp giản đơn: L = Lt = ' + fx(I.Lt, 2) + ' m (khe ở cả hai đầu nhịp)',
  );
  setOut('o_kc_L', r.L, 3);
  setOut('o_kc_Lt', r.Lt, 3);
  setOut('o_kc_q', P.q, 1);

  const numFields: Array<[keyof KcgCalcResult, number]> = [
    ['Dsh', 2],
    ['DshN', 2],
    ['DshP', 2],
    ['Dt', 2],
    ['DtN', 2],
    ['DtP', 2],
    ['D1', 2],
    ['Dop', 2],
    ['D2', 2],
    ['Dtot', 2],
    ['kD1', 2],
    ['kD2', 2],
    ['kDtot', 2],
    ['DL', 0],
    ['DLN', 2],
    ['m1', 2],
    ['m2', 2],
    ['avg', 2],
  ];
  numFields.forEach(([k, d]) => setOut('o_kc_' + String(k), r[k] as number, d));

  okn('o_kc_DLN', r.okRange, (r.okRange ? 'OK ≥ ' : 'NG < ') + 'γΔtotal');
  setOut('o_kc_Dins', r.Dins, 0);
  setOut('o_kc_Ains', P.dA > 0 ? r.Dins + P.dA : '-', 0);
  setOut('o_kc_slope', r.slope, 3);
  setOut('o_kc_Dt1', r.Dt1, 0);
  setOut('o_kc_Dt2', r.Dt2, 0);
  setOut('o_kc_chkMax', r.chkMax, 1);
  setOut('o_kc_chkMin', r.chkMin, 1);
  okn('o_kc_chkMax', r.okMax, (r.okMax ? 'OK ≤ ' : 'NG > ') + fx(P.Dmax, 0));
  okn('o_kc_chkMin', r.okMin, (r.okMin ? 'OK ≥ ' : 'NG < ') + fx(P.Dmin, 0));
  setOut('o_kc_t1', P.t1, 0);
  setOut('o_kc_t2', P.t2, 0);
  setOut('o_kc_Ti', P.Tins, 0);

  tbx(
    'tbKcTri',
    `<tr><th>T (°C)</th><td class="c">${fx(P.t1, 0)}</td><td class="c">${fx(P.Tins, 0)}</td><td class="c">${fx(P.t2, 0)}</td></tr><tr><th>D (mm)</th><td class="c">${fx(r.Dt1, 0)}</td><td class="c"><b>${fx(r.Dins, 0)}</b></td><td class="c">${fx(r.Dt2, 0)}</td></tr>` +
      (P.dA > 0
        ? `<tr><th>A (mm)</th><td class="c">${fx(r.Dt1 + P.dA, 0)}</td><td class="c"><b>${fx(r.Dins + P.dA, 0)}</b></td><td class="c">${fx(r.Dt2 + P.dA, 0)}</td></tr>`
        : ''),
  );

  const lo = Math.floor(P.Tmin);
  const hi = Math.ceil(P.Tmax);
  const cells: Array<[number, number]> = [];
  for (let t = lo; t <= hi; t++) cells.push([t, r.Dins - r.slope * (t - P.Tins)]);
  const hasA = P.dA > 0;
  const G = 3;
  const nr = Math.ceil(cells.length / G);
  const hd = `<th>T (°C)</th><th>D (mm)</th>${hasA ? '<th>A (mm)</th>' : ''}`;
  let lk = `<tr>${hd.repeat(G)}</tr>`;
  for (let i = 0; i < nr; i++) {
    let tr = '';
    for (let gIdx = 0; gIdx < G; gIdx++) {
      const q = cells[gIdx * nr + i];
      tr += q
        ? `<td class="c"><b>${q[0]}</b></td><td class="c">${fx(q[1], 0)}</td>${hasA ? `<td class="c">${fx(q[1] + P.dA, 0)}</td>` : ''}`
        : `<td></td><td></td>${hasA ? '<td></td>' : ''}`;
    }
    lk += `<tr>${tr}</tr>`;
  }
  tbx('tbKcLook', lk);

  const items: Array<[string, boolean]> = [
    ['Phạm vi chuyển vị của khe ΔL,n ≥ γTU.Δtotal,n', r.okRange],
    ['Khe mở lớn nhất: Dinstall + γTU.Δ2 ≤ Dmax', r.okMax],
    ['Khe đóng nhỏ nhất: Dinstall - γTU.Δ1 ≥ Dmin', r.okMin],
  ];
  tbx(
    'tbKcSum',
    `<tr><th colspan="8">Hạng mục kiểm toán khe co giãn</th><th colspan="2">KL</th></tr>` +
      items
        .map(
          ([t, o]) =>
            `<tr><td class="l" colspan="8">${t}</td><td class="c ${o ? 'ok' : 'bad'}" colspan="2">${o ? 'OK' : 'NG'}</td></tr>`,
        )
        .join(''),
  );
  r.allOK = r.ok && items.every((x) => x[1]);
  klAppend('tbKcSum', r.allOK, 10);
  kcgDraw(r);
  kcgChart(r);
  return r;
}

export function kcgDraw(r: KcgCalcResult): void {
  const sv = resolveRealDom('dgKc') as SVGElement | null;
  if (!sv) return;
  const id = 'Kc';
  const d = dgKit(id);
  const W = 760;
  const Dv = Math.max(15, Math.min(90, r.Dins || 40));
  d.s += `<defs><pattern id="hK${id}" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" stroke="#9a9a9a" stroke-width="0.7"/></pattern>
    <pattern id="hN${id}" width="5" height="5" patternUnits="userSpaceOnUse"><circle cx="2.5" cy="2.5" r="0.6" fill="#888"/></pattern></defs>`;
  d.T(W / 2, 16, 'Cấu tạo khe co giãn răng lược tại mố', 'middle', 'font-weight="bold"');

  const k = 0.75;
  const tl = 90;
  const R = 18.5;
  const pitch = 100;
  const bw = 60;
  const yT = 52;
  const nT = 3;
  const Hh = nT * pitch * k + 30;
  const xc = 190;
  const xL0 = xc - ((tl + Dv) * k) / 2;
  const xR0 = xc + ((tl + Dv) * k) / 2;
  const xa = xL0 - bw * k;
  const xb = xR0 + bw * k;
  d.s += `<rect x="${(xa - 34).toFixed(1)}" y="${yT}" width="34" height="${Hh}" style="fill:url(#hK${id});stroke:none"/><rect x="${xb.toFixed(1)}" y="${yT}" width="34" height="${Hh}" style="fill:url(#hK${id});stroke:none"/>`;
  d.s += `<rect class="l" x="${xa.toFixed(1)}" y="${yT}" width="${(bw * k).toFixed(1)}" height="${Hh}" style="fill:#d9d9d9"/><rect class="l" x="${xR0.toFixed(1)}" y="${yT}" width="${(bw * k).toFixed(1)}" height="${Hh}" style="fill:#d9d9d9"/>`;
  const tooth = (x0: number, yc: number, dir: number): string => {
    const w = R * k;
    const L = tl * k;
    const xt = x0 + dir * (L - w);
    return `<path class="l" d="M${x0.toFixed(1)},${(yc - w - 4).toFixed(1)} L${xt.toFixed(1)},${(yc - w).toFixed(1)} A${w.toFixed(1)},${w.toFixed(1)} 0 0 ${dir > 0 ? 1 : 0} ${xt.toFixed(1)},${(yc + w).toFixed(1)} L${x0.toFixed(1)},${(yc + w + 4).toFixed(1)} Z" style="fill:#d9d9d9"/>`;
  };
  for (let i = 0; i < nT; i++) {
    const y1 = yT + 15 + pitch * k * (i + 0.25);
    const y2 = yT + 15 + pitch * k * (i + 0.75);
    d.s += tooth(xL0, y1, 1) + tooth(xR0, y2, -1);
  }
  d.dimH(xL0 + tl * k, xR0, yT + Hh + 16, 'D', yT + Hh - 6);
  d.dimH(xL0, xL0 + tl * k, yT - 10, 'răng ' + tl, yT);
  const yp1 = yT + 15 + pitch * k * 0.25;
  const yp2 = yp1 + pitch * k;
  d.dimV(xa - 48, yp1, yp2, '@' + pitch, -1);
  d.T(xa - 17, yT + Hh + 34, 'Phía mố', 'middle');
  d.T(xb + 17, yT + Hh + 34, 'Phía nhịp', 'middle');
  d.T(xc, yT + Hh + 52, 'MẶT BẰNG TẤM RĂNG', 'middle', 'font-weight="bold" class="s"');

  const ks = 0.36;
  const x0 = 400;
  const yS = 72;
  const wL = 500;
  const wR = 350;
  const pk = 1.6;
  const X = (x: number): number => x0 + x * ks;
  const Y = (y: number): number => yS + y * ks * pk;
  const xg = wL;
  const xg2 = wL + Dv;

  d.s += `<rect class="l" x="${X(0)}" y="${Y(0)}" width="${(wL * ks).toFixed(1)}" height="${(300 * ks * pk).toFixed(1)}" style="fill:url(#hK${id})"/>`;
  d.s += `<rect class="l" x="${X(xg2).toFixed(1)}" y="${Y(0)}" width="${(wR * ks).toFixed(1)}" height="${(300 * ks * pk).toFixed(1)}" style="fill:url(#hK${id})"/>`;
  d.s += `<rect class="t" x="${X(wL - 380)}" y="${Y(0)}" width="${(380 * ks).toFixed(1)}" height="${(190 * ks * pk).toFixed(1)}" style="fill:url(#hN${id});fill-opacity:1"/>`;
  d.s += `<rect class="t" x="${X(xg2).toFixed(1)}" y="${Y(0)}" width="${(230 * ks).toFixed(1)}" height="${(190 * ks * pk).toFixed(1)}" style="fill:url(#hN${id})"/>`;

  const tp = 30;
  const hv = 120;
  d.s += `<rect x="${X(xg - 120).toFixed(1)}" y="${Y(0)}" width="${(120 * ks + tl * ks * 0.55).toFixed(1)}" height="${(tp * ks * pk).toFixed(1)}" style="fill:#444"/>`;
  d.s += `<rect x="${X(xg2 - tl * 0.55).toFixed(1)}" y="${Y(0)}" width="${(120 * ks + tl * ks * 0.55).toFixed(1)}" height="${(tp * ks * pk * 0.6).toFixed(1)}" style="fill:#888"/>`;
  d.s += `<rect x="${(X(xg) - 3).toFixed(1)}" y="${Y(tp)}" width="3" height="${(hv * ks * pk).toFixed(1)}" style="fill:#444"/><rect x="${X(xg2).toFixed(1)}" y="${Y(tp)}" width="3" height="${(hv * ks * pk).toFixed(1)}" style="fill:#444"/>`;

  const loop = (xA: number, xB: number, y1: number, y2: number): string =>
    `<rect x="${Math.min(X(xA), X(xB)).toFixed(1)}" y="${Y(y1).toFixed(1)}" width="${Math.abs(X(xB) - X(xA)).toFixed(1)}" height="${(Y(y2) - Y(y1)).toFixed(1)}" rx="6" style="fill:none;stroke:#c00000;stroke-width:1.3"/>`;
  d.s += loop(wL - 360, wL - 30, 65, 140) + loop(xg2 + 30, xg2 + 210, 65, 140);

  const mx = X((xg + xg2) / 2);
  const my = Y(300) + 4;
  d.s += `<path d="M${(X(xg) + 2).toFixed(1)},${Y(tp + hv).toFixed(1)} Q${mx.toFixed(1)},${(my + 26).toFixed(1)} ${(X(xg2) - 2).toFixed(1)},${Y(tp + hv).toFixed(1)}" style="fill:none;stroke:#1f4e79;stroke-width:1.2;stroke-dasharray:4,2"/>`;
  d.T(mx, my + 38, 'máng thoát nước', 'middle', 'class="s"');

  d.dimH(X(xg - 120), X(xg2 + 120), Y(0) - 26, 'A = D + 240', Y(0));
  d.dimH(X(xg), X(xg2), Y(300) + 16, 'D', Y(300));
  d.T(X(wL / 2), Y(250), 'Mố cầu', 'middle');
  d.T(X(xg2 + wR / 2), Y(250), 'Dầm bản', 'middle');
  d.T(X(wL - 190), Y(190) + 14, 'BT không co ngót', 'middle', 'class="s"');
  d.T(
    (X(0) + X(xg2 + wR)) / 2,
    yT + Hh + 52,
    'MẶT CẮT DỌC CẦU (tỷ lệ đứng phóng to)',
    'middle',
    'font-weight="bold" class="s"',
  );
  d.T(
    W / 2,
    yT + Hh + 72,
    'D: khe hở giữa đầu răng và chân răng tấm đối diện, bằng khe hở giữa hai mép thép góc',
    'middle',
    'class="s"',
  );
  d.T(
    W / 2,
    yT + Hh + 86,
    'D tăng khi nhiệt độ giảm, co ngót ; D giảm khi nhiệt độ tăng',
    'middle',
    'class="s"',
  );
  dgPut(sv, W, yT + Hh + 96, d.s, id);
}

export function kcgChart(r: KcgCalcResult): void {
  const P = r.P;
  if (!P) return;
  const sv = resolveRealDom('dgKcC');
  const W = 640;
  const H = 300;
  const pl = 70;
  const pr = 24;
  const pt = 36;
  const pb = 50;
  const t1 = P.t1;
  const t2 = P.t2;
  const Ti = P.Tins;
  const x0 = Math.min(t1, t2) - 2;
  const x1 = Math.max(t1, t2) + 2;
  const D = (T: number): number => r.Dins - r.slope * (T - Ti);
  const vs = [D(t1), r.Dins, D(t2)];
  const mn = Math.min(...vs);
  const mx = Math.max(...vs);
  let y0 = Math.floor(mn / 5) * 5;
  if (mn - y0 < 1) y0 -= 5;
  let y1 = Math.ceil(mx / 5) * 5 + 5;
  if (y1 - y0 < 10) y1 = y0 + 10;
  const ys = y1 - y0 > 60 ? 10 : y1 - y0 > 25 ? 5 : 2;
  const sx = (T: number): number => pl + ((T - x0) / (x1 - x0)) * (W - pl - pr);
  const sy = (v: number): number => pt + (1 - (v - y0) / (y1 - y0)) * (H - pt - pb);
  const ff = 'font-family="Arial, Liberation Sans, Helvetica, sans-serif" fill="#000"';
  let g = `<rect x="1" y="1" width="${W - 2}" height="${H - 2}" fill="#fff" stroke="#000" stroke-width="2"/>`;
  g += `<text x="${W / 2}" y="22" text-anchor="middle" font-size="13" font-weight="bold" ${ff}>TƯƠNG QUAN GIỮA CHIỀU RỘNG KHE HỞ D VÀ NHIỆT ĐỘ LẮP ĐẶT</text>`;
  g += `<rect x="${pl}" y="${pt}" width="${W - pl - pr}" height="${H - pt - pb}" fill="#c0c0c0"/>`;
  for (let T = Math.ceil(x0); T <= x1; T++) {
    g += `<line x1="${sx(T)}" x2="${sx(T)}" y1="${pt}" y2="${H - pb}" stroke="#8c8c8c" stroke-width=".8"/><text x="${sx(T)}" y="${H - pb + 15}" text-anchor="middle" font-size="11.5" ${ff}>${T}</text>`;
  }
  for (let v = y0; v <= y1 + 1e-9; v += ys) {
    g += `<line x1="${pl}" x2="${W - pr}" y1="${sy(v)}" y2="${sy(v)}" stroke="#8c8c8c" stroke-width=".8"/><text x="${pl - 7}" y="${sy(v) + 4.5}" text-anchor="end" font-size="13" ${ff}>${v}</text>`;
  }
  g += `<rect x="${pl}" y="${pt}" width="${W - pl - pr}" height="${H - pt - pb}" fill="none" stroke="#000" stroke-width=".8"/>`;
  g += `<text x="${(pl + W - pr) / 2}" y="${H - 12}" text-anchor="middle" font-size="12" font-weight="bold" ${ff}>Nhiệt độ lắp đặt (°C)</text>`;
  g += `<text transform="translate(24 ${(pt + H - pb) / 2}) rotate(-90)" text-anchor="middle" font-size="12" font-weight="bold" ${ff}>Chiều rộng khe hở D (mm)</text>`;
  const ptsRaw: Array<[number, number]> = [
    [t2, D(t2)],
    [Ti, r.Dins],
    [t1, D(t1)],
  ];
  const pts = ptsRaw.sort((a, b) => a[0] - b[0]);
  g += `<polyline points="${pts.map(([T, v]) => sx(T) + ',' + sy(v)).join(' ')}" fill="none" stroke="#000080" stroke-width="3"/>`;
  pts.forEach(
    ([T, v]) =>
      (g += `<circle cx="${sx(T)}" cy="${sy(v)}" r="5.5" fill="#000080"/><text x="${sx(T) + 8}" y="${sy(v) - 8}" font-size="12" ${ff}>${fx(v, 1)}</text>`),
  );
  if (sv) {
    sv.setAttribute('width', String(W));
    sv.setAttribute('height', String(H));
    sv.setAttribute('viewBox', `0 0 ${W} ${H}`);
    sv.innerHTML = g;
  }
  setOutputValue(
    'dgKcC',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${g}</svg>`,
  );
}

// ---------------------------------------------------------------------------
// 9. Concrete Barrier / Guardrail Yield-Line Solver (GLC / GLCR — TCVN 11823-13)
// ---------------------------------------------------------------------------

export const GL_TL: Record<string, GlTlSpec> = {
  'TL-1': { Ft: 60, FL: 20, Fv: 20, Lt: 1220, Lv: 5500, He: 460, Hmin: 685 },
  'TL-2': { Ft: 120, FL: 40, Fv: 20, Lt: 1220, Lv: 5500, He: 510, Hmin: 685 },
  'TL-3': { Ft: 240, FL: 80, Fv: 20, Lt: 1220, Lv: 5500, He: 610, Hmin: 685 },
  'TL-4': { Ft: 240, FL: 80, Fv: 80, Lt: 1070, Lv: 5500, He: 810, Hmin: 810 },
  'TL-5': { Ft: 550, FL: 183, Fv: 355, Lt: 2440, Lv: 12200, He: 1070, Hmin: 1070 },
};

export const GL_VEH: {
  cols: Array<[string, number]>;
  B: number[];
  G: number[];
  ang: number[];
  v: Record<string, Array<number | string>>;
} = {
  cols: [
    ['Xe con', 7],
    ['Xe con', 8],
    ['Xe tải nhẹ', 20],
    ['Xe tải đơn', 80],
    ['Xe kéo moóc', 220],
    ['Xe kéo bồn', 355],
  ],
  B: [1700, 1700, 2000, 2300, 2450, 2450],
  G: [550, 550, 700, 1250, 1630, 1850],
  ang: [20, 20, 25, 15, 15, 15],
  v: {
    'TL-1': [50, 50, 50, '-', '-', '-'],
    'TL-2': [70, 70, 70, '-', '-', '-'],
    'TL-3': [100, 100, 100, 80, '-', '-'],
    'TL-4': [100, 100, 100, '-', 80, '-'],
    'TL-5': [100, 100, 100, '-', '-', 80],
  },
};

export function glPolyA(P: Point2D[]): number {
  let A = 0;
  for (let i = 0; i < P.length; i++) {
    const [x1, y1] = P[i];
    const [x2, y2] = P[(i + 1) % P.length];
    A += x1 * y2 - x2 * y1;
  }
  return Math.abs(A) / 2;
}

export function glW(P: Point2D[], y: number): { w: number; xmin: number; xmax: number } {
  const xs = xEdges(P, y);
  let w = 0;
  let xmin = Infinity;
  let xmax = -Infinity;
  for (let i = 0; i + 1 < xs.length; i += 2) {
    w += xs[i + 1] - xs[i];
    xmin = Math.min(xmin, xs[i]);
    xmax = Math.max(xmax, xs[i + 1]);
  }
  return { w, xmin, xmax };
}

export const glB1 = (fc: number): number =>
  Math.min(0.85, Math.max(0.65, 0.85 - (0.05 * (fc - 28)) / 7));

export function glBlk(
  hs: number,
  b: number,
  n: number,
  d: number,
  dsc: number,
  dsub: number,
  fc: number,
  fy: number,
  phi: number,
): GlBlockRes {
  const Asy = (n * Math.PI * d * d) / 4;
  const ds = hs - dsc - dsub - d / 2;
  const b1 = glB1(fc);
  const c = (Asy * fy) / (0.85 * fc * b1 * b);
  const a = b1 * c;
  const Mn = Asy * fy * (ds - a / 2);
  return { hs, b, n, d, dsc, Asy, ds, b1, c, a, Mn, phi, Mr: phi * Mn };
}

export function glCalc(I: DamSpInput, P: GlInput): GlcCalcResult {
  const Pg = P.poly;
  const A = glPolyA(Pg);
  const ys = Pg.map((p) => p[1]);
  const H = Math.max(...ys) - Math.min(...ys);
  const fc = P.fc;
  const fy = P.fy;
  const phi = P.phi;
  const TL = GL_TL[P.tl] || GL_TL['TL-3'];

  const W = P.bw.map((k, i) =>
    glBlk(k.hs, k.b, k.n, k.d, k.dsc, (P.bc[i] || P.bc[0]).d, fc, fy, phi),
  );
  const C = P.bc.map((k) => glBlk(k.hs, 1000, k.n, k.d, k.dsc, 0, fc, fy, phi));
  const Hb = P.bw.reduce((a, k) => a + k.b, 0) || H;
  const Mw = W.reduce((a, w) => a + w.Mr, 0) / Hb;
  const Mc = C.reduce((a, c, i) => a + (c.Mr / 1000) * (P.bw[i] ? P.bw[i].b : 0), 0) / Hb;
  const Mb = P.Mb || 0;
  const Lt = TL.Lt;
  const Ft = TL.Ft * 1000;

  const RwOf = (Mc_: number, end: boolean): { Lc: number; Rw: number } => {
    const k = end ? 1 : 8;
    const Lc = Lt / 2 + Math.sqrt((Lt / 2) ** 2 + (k * H * (Mb + Mw * H)) / Mc_);
    const Rw =
      (2 / (2 * Lc - Lt)) *
      ((end ? 1 : 8) * Mb + (end ? 1 : 8) * Mw * H + (Mc_ * Lc * Lc) / H);
    return { Lc, Rw };
  };
  const I0 = RwOf(Mc, false);
  const E0 = RwOf(Mc, true);

  const dv = P.bc[P.bc.length - 1].d;
  const lhb0 = ((100 * dv) / Math.sqrt(P.fcd)) * (fy / 420);
  const lmin = Math.max(8 * dv, 150);
  const lhb = Math.max(lmin, lhb0 * (P.cvr ? 0.8 : 1));
  const rD = Math.min(1, P.lav / lhb);
  const lminOK = P.lav >= lmin - 1e-9;

  const cb = P.bc[P.bc.length - 1];
  const Cb = glBlk(cb.hs, 1000, cb.n, cb.d, cb.dsc, 0, fc, rD * fy, phi);
  const McBase = Cb.Mr / 1000;
  const McU = Math.min(Mc, McBase);
  const Ir = RwOf(McU, false);
  const Er = RwOf(McU, true);
  const LcI = Ir.Lc;
  const RwI = Ir.Rw;
  const LcE = Er.Lc;
  const RwE = Er.Rw;

  const Hra = P.Hra || 0;
  const rail = Hra > 0 && P.rails.length > 0;
  const Htot = Hra > 0 ? H + Hra : H;
  const comb = rail;
  let RL: GlRailResult | null = null;
  if (rail) {
    const fyS = P.sfy;
    const L = P.sL;
    const Zp = (D: number, t: number): number => (D ** 3 - (D - 2 * t) ** 3) / 6;
    const rails = P.rails.map(([D, t, y]) => ({ D, t, y, Z: Zp(D, t), Mp: fyS * Zp(D, t) }));
    const Mp = rails.reduce((a, r) => a + r.Mp, 0);
    const yR = rails.reduce((a, r) => a + r.Mp * r.y, 0) / Mp;
    const Hr = H + yR;
    const b = P.pb;
    const h = P.ph;
    const t = P.pt;
    const Zpo = (b * h * h) / 4 - ((b - 2 * t) * Math.max(0, h - 2 * t) ** 2) / 4;
    const MpPost = fyS * Zpo;
    const PpPost = MpPost / Math.max(1, yR - P.pyc);
    const Ab = (Math.PI * P.bd * P.bd) / 4;
    const Tn = 0.76 * Ab * P.bfu;
    const MpBolt = P.bn * Tn * P.blev;
    const PpBolt = MpBolt / yR;
    const Pp = Math.min(PpPost, PpBolt);
    const Rint = (N: number): number =>
      (N % 2 ? 16 * Mp + (N - 1) * (N + 1) * Pp * L : 16 * Mp + N * N * Pp * L) /
      (2 * N * L - Lt);
    const Rend = (N: number): number =>
      (2 * Mp + (2 * Pp * L * N * (N + 1)) / 2) / (2 * N * L - Lt);

    let NI = 1;
    let RI = Infinity;
    let NE = 1;
    let RE = Infinity;
    for (let N = 1; N <= 8; N++) {
      if (2 * N * L <= Lt) continue;
      const a = Rint(N);
      const e = Rend(N);
      if (a < RI) {
        RI = a;
        NI = N;
      }
      if (e < RE) {
        RE = e;
        NE = N;
      }
    }
    const R2 = (16 * Mp) / (4 * L - Lt);
    const comb1 = (Rr: number, Rw: number): GlRailComb1 => {
      const R = Rr + Rw;
      const Y = (Rr * Hr + Rw * H) / (Rr + Rw);
      return { R, Y, ok: R >= Ft && Y >= TL.He };
    };
    const comb2 = (Rw: number): GlRailComb2 => {
      const Rw2 = (Rw * H - Pp * Hr) / H;
      const R = Pp + R2 + Rw2;
      const Y = (Pp * Hr + R2 * Hr + Rw2 * H) / R;
      return { Rw2, R, Y, ok: R >= Ft && Y >= TL.He };
    };
    RL = {
      rails,
      Mp,
      yR,
      Hr,
      b,
      h,
      t,
      Zpo,
      MpPost,
      PpPost,
      Ab,
      Tn,
      MpBolt,
      PpBolt,
      Pp,
      NI,
      RI,
      NE,
      RE,
      R2,
      mI: comb1(RI, RwI),
      mE: comb1(RE, RwE),
      pI: comb2(RwI),
      pE: comb2(RwE),
    };
  }

  const cases: GlInterfaceCase[] = (
    [
      ['Giữa đoạn gờ', RwI, LcI],
      ['Đầu đoạn gờ', RwE, LcE],
    ] as Array<[string, number, number]>
  ).map(([t, Rw, Lc]) => {
    const Vu = Rw / (Lc + 2 * H);
    const Avf = (P.nleg * Math.PI * dv * dv) / 4 / P.sv;
    const Pc = P.gc * 9.81e-6 * 1e-3 * A;
    const Acv = P.bi;
    const Vn = P.c * Acv + P.mu * (Avf * rD * fy + Pc);
    const Vmax = Math.min(P.K1 * P.fcd * Acv, P.K2 * Acv);
    const Vr = Math.min(Vn, Vmax);
    return { t, Rw, Lc, Vu, Avf, Pc, Acv, Vn, Vmax, Vr, T: Vu };
  });

  const dTa = num('bm_dTa');
  const sTa = num('bm_sTa') || 150;
  const hD = (I.hs - I.hwear) * 1000;
  const AsD =
    (Math.PI * P.dTd * P.dTd) / 4 / P.sTd + (dTa > 0 ? (Math.PI * dTa * dTa) / 4 / sTa : 0);
  const dD = hD - P.ctd - Math.max(P.dTd, dTa) / 2;
  const fcD = P.fcd;
  const deck: GlDeckCheck[] = cases.map((cs) => {
    const T = cs.T;
    const Ms = McBase;
    const Cc = AsD * fy - T;
    const a = Cc / (0.85 * fcD);
    const Mcap = Cc > 0 ? Cc * (dD - a / 2) : 0;
    const Mreq = Ms + T * (dD - hD / 2);
    return { T, Ms, Mcap, Mreq, ok: Mreq <= Mcap };
  });

  return {
    A,
    H,
    TL,
    Ft,
    Lt,
    W,
    C,
    Hb,
    Mw,
    Mc,
    Mb,
    I0,
    E0,
    lhb,
    lhb0,
    lmin,
    lminOK,
    rD,
    Cb,
    McBase,
    McU,
    LcI,
    RwI,
    LcE,
    RwE,
    comb,
    rail,
    Hra,
    RL,
    Htot,
    cases,
    deck,
    hD,
    AsD,
    dD,
  };
}

export function glcStep(I: DamSpInput): GlcCalcResult | null {
  if (!I) return null;
  const poly: Point2D[] = nums($('gl_poly')?.value || '').map((a) => [a[0], a[1]]);
  const bars: Point2D[] = nums($('gl_bars')?.value || '').map((a) => [a[0], a[1]]);
  if (poly.length < 3) return null;

  const nb = 2;
  const bw: GlBlockVertInput[] = [];
  const bc: GlBlockHorizInput[] = [];
  for (let k = 1; k <= nb; k++) {
    bw.push({
      hs: num(`gw${k}_hs`),
      b: num(`gw${k}_b`),
      n: num(`gw${k}_n`),
      d: num(`gw${k}_d`),
      dsc: num(`gw${k}_dsc`),
    });
    bc.push({
      hs: num(`gc${k}_hs`),
      n: num(`gc${k}_n`),
      d: num(`gc${k}_d`),
      dsc: num(`gc${k}_dsc`),
    });
  }
  const sf = ($('gl_sf')?.value || '').split(',').map(Number);
  const P: GlInput = {
    tl: $('gl_tl')?.value || 'TL-3',
    poly,
    bars,
    bw,
    bc,
    fc: num('gl_fc'),
    fy: num('sp_fy') || 400,
    phi: num('gl_phi') || 0.9,
    Mb: num('gl_Mb') || 0,
    gc: num('gl_gc') || 2500,
    lav: num('gl_lav'),
    cvr: $('gl_cvr')?.value === '1',
    fcd: num('sp_fcs') || 30,
    sv: 1000 / Math.max(1, num('gc2_n')),
    nleg: num('gl_nleg') || 1,
    bi: num('gl_bi'),
    Hra: (spV('sp_Hra') || 0) * 1000,
    rails: nums($('gr_rails')?.value || '').filter((a) => a.length >= 3),
    sfy: num('gr_fy'),
    sL: num('gr_L'),
    pb: num('gr_pb'),
    ph: num('gr_ph'),
    pt: num('gr_pt'),
    pyc: num('gr_pyc'),
    bn: num('gr_bn'),
    bd: num('gr_bd'),
    bfu: num('gr_bfu'),
    blev: num('gr_blev'),
    c: sf[0] ?? 0,
    mu: sf[1] ?? 0,
    K1: sf[2] ?? 0,
    K2: sf[3] ?? 0,
    dTd: num('bm_dT') || 16,
    sTd: num('bm_sT') || 150,
    ctd: num('bm_ct') || 50,
  };
  {
    const gbd = nums($('gb_dd')?.value || '').map((a) => a[0]);
    const half = gbd.length ? Math.max(...gbd.map(Math.abs)) : I.S * 500;
    P.oh = Math.max(0, I.Wb * 500 - (((I.Ng - 1) / 2) * I.S * 1000 + half));
  }
  const R = glCalc(I, P);
  R.P = P;
  GLCR = R;
  const TL = R.TL;
  setOut('o_gl_fy', P.fy, 0);
  setOut('o_gl_Es', 200000, 0);

  tbx(
    'tbGlVeh',
    `<tr><th>Đặc trưng xe</th><th>Đơn vị</th>${GL_VEH.cols.map((c) => `<th>${c[0]}</th>`).join('')}</tr>` +
      `<tr><td class="c">W</td><td class="c">kN</td>${GL_VEH.cols.map((c) => `<td>${c[1]}</td>`).join('')}</tr>` +
      (
        [
          ['B', 'mm', 'B'],
          ['G', 'mm', 'G'],
          ['Góc va', 'độ', 'ang'],
        ] as Array<[string, string, 'B' | 'G' | 'ang']>
      )
        .map(
          ([t, u, k]) =>
            `<tr><td class="c">${t}</td><td class="c">${u}</td>${GL_VEH[k].map((val) => `<td>${val}</td>`).join('')}</tr>`,
        )
        .join('') +
      `<tr><th>Mức độ</th><th colspan="7">Tốc độ kiểm tra (km/h)</th></tr>` +
      Object.entries(GL_VEH.v)
        .map(
          ([k, vals]) =>
            `<tr${k === P.tl ? ' style="font-weight:bold;background:#fff2cc"' : ''}><td class="c">${k}</td><td></td>${vals.map((x) => `<td class="c">${x}</td>`).join('')}</tr>`,
        )
        .join(''),
  );

  const TLk = Object.keys(GL_TL);
  tbx(
    'tbGlTL',
    `<tr><th>Lực thiết kế và các kí hiệu</th><th>Đơn vị</th>${TLk.map((k) => `<th>${k}</th>`).join('')}</tr>` +
      (
        [
          ['Ft ngang', 'kN', 'Ft'],
          ['FL dọc', 'kN', 'FL'],
          ['Fv thẳng đứng', 'kN', 'Fv'],
          ['Lt và LL', 'mm', 'Lt'],
          ['Lv', 'mm', 'Lv'],
          ['He', 'mm', 'He'],
          ['Chiều cao lan can nhỏ nhất H', 'mm', 'Hmin'],
        ] as Array<[string, string, keyof GlTlSpec]>
      )
        .map(
          ([t, u, k]) =>
            `<tr><td class="l">${t}</td><td class="c">${u}</td>${TLk.map((x) => `<td${x === P.tl ? ' style="font-weight:bold;background:#fff2cc"' : ''}>${GL_TL[x][k]}</td>`).join('')}</tr>`,
        )
        .join(''),
  );

  (
    [
      ['Ft', TL.Ft],
      ['FL', TL.FL],
      ['Fv', TL.Fv],
      ['Lt', TL.Lt],
      ['Lv', TL.Lv],
      ['He', TL.He],
      ['Hm', TL.Hmin],
    ] as Array<[string, number]>
  ).forEach(([k, val]) => setOut('o_gl_s' + k, val, 0));

  setOut('o_gl_H', R.H, 0);
  setOut('o_gl_A', R.A / 1e6, 5);
  okn(
    'o_gl_A',
    Math.abs(R.A / 1e6 - I.Apa) <= 0.01 * I.Apa + 1e-6,
    Math.abs(R.A / 1e6 - I.Apa) <= 0.01 * I.Apa + 1e-6
      ? '= Apa sheet dầm'
      : '≠ Apa = ' + fx(I.Apa, 5),
  );

  R.W.forEach((w, i) => {
    const k = i + 1;
    setOut(`o_gw${k}_As`, w.Asy, 0);
    setOut(`o_gw${k}_ds`, w.ds, 0);
    setOut(`o_gw${k}_b1`, w.b1, 3);
    setOut(`o_gw${k}_c`, w.c, 2);
    setOut(`o_gw${k}_a`, w.a, 2);
    setOut(`o_gw${k}_Mn`, w.Mn / 1e6, 2);
    setOut(`o_gw${k}_phi`, w.phi, 2);
    setOut(`o_gw${k}_Mr`, w.Mr / 1e6, 2);
  });
  R.C.forEach((c, i) => {
    const k = i + 1;
    setOut(`o_gc${k}_As`, c.Asy, 0);
    setOut(`o_gc${k}_ds`, c.ds, 0);
    setOut(`o_gc${k}_b1`, c.b1, 3);
    setOut(`o_gc${k}_c`, c.c, 2);
    setOut(`o_gc${k}_a`, c.a, 2);
    setOut(`o_gc${k}_Mn`, c.Mn / 1e6, 2);
    setOut(`o_gc${k}_phi`, c.phi, 2);
    setOut(`o_gc${k}_Mr`, c.Mr / 1e6, 2);
  });

  setOut('o_gl_Hb', R.Hb, 0);
  okn(
    'o_gl_Hb',
    Math.abs(R.Hb - R.H) <= 1,
    Math.abs(R.Hb - R.H) <= 1
      ? '= H'
      : '≠ H = ' + fx(R.H, 0) + ' mm: kiểm tra lại chiều cao các khối',
  );
  setOut('o_gl_Mw', R.Mw / 1e3, 2);
  setOut('o_gl_Mc', R.Mc / 1e3, 2);

  setOut('o_gl_Ft5', TL.Ft, 0);
  setOut('o_gl_H5', R.H, 0);
  setOut('o_gl_Lc5', R.I0.Lc, 0);
  setOut('o_gl_Lt5', TL.Lt, 0);
  setOut('o_gl_Mb5', R.Mb / 1e3, 2);
  setOut('o_gl_Mw5', R.Mw / 1e3, 2);
  setOut('o_gl_Mc5', R.Mc / 1e3, 2);
  setOut('o_gl_Rw5', R.I0.Rw / 1e3, 1);
  setOut(
    'o_gl_ck5',
    fx(R.I0.Rw / 1e3, 1) + (R.I0.Rw >= R.Ft ? ' > ' : ' < ') + 'Ft = ' + fx(TL.Ft, 0) + ' kN',
  );
  okn('o_gl_ck5', R.I0.Rw >= R.Ft, R.I0.Rw >= R.Ft ? 'Đạt' : 'Không đạt');

  setOut('o_gl_LcE', R.E0.Lc, 0);
  setOut('o_gl_RwE', R.E0.Rw / 1e3, 1);
  okn('o_gl_RwE', R.E0.Rw >= R.Ft, R.E0.Rw >= R.Ft ? 'Đạt ≥ Ft' : 'Không đạt < Ft');

  setOut('o_gl_lhb', R.lhb, 0);
  setOut('o_gl_fcd', P.fcd, 0);
  setOut('o_gl_rD', R.rD, 3);
  okn(
    'o_gl_rD',
    R.rD >= 1 || R.lminOK,
    R.rD >= 1
      ? 'Đủ chiều dài neo'
      : R.lminOK
        ? 'Tính với ứng suất r.fy'
        : 'ℓav < max(8db; 150): Không đạt',
  );
  setOut('o_gl_McB', R.McBase / 1e3, 2);
  setOut('o_gl_McU', R.McU / 1e3, 2);
  tbx(
    'tbGlRw',
    `<tr><th colspan="4">Sức kháng gờ dùng kiểm toán tiếp (Mc = ${fx(R.McU / 1e3, 2)} kN.m/m)</th><th colspan="2">Giữa đoạn gờ</th><th colspan="2">Đầu đoạn gờ</th></tr>` +
      `<tr><td class="l" colspan="4">Chiều dài tới hạn Lc (mm) ; sức kháng Rw (kN)</td><td colspan="2">${fx(R.LcI, 0)} ; ${fx(R.RwI / 1e3, 1)}</td><td colspan="2">${fx(R.LcE, 0)} ; ${fx(R.RwE / 1e3, 1)}</td></tr>` +
      `<tr><td class="l" colspan="4">Kiểm tra Rw ≥ Ft = ${TL.Ft} kN</td>${ok2(R.RwI >= R.Ft, 'Đạt', 2).replace('Đạt', R.RwI >= R.Ft ? 'Đạt' : 'Không đạt')}${ok2(R.RwE >= R.Ft, R.RwE >= R.Ft ? 'Đạt' : 'Không đạt', 2)}</tr>`,
  );

  setOut('o_gl_Hra', R.Hra, 0);
  if (R.RL) {
    const L = R.RL;
    const glOk2 = (ok: boolean, cs = 2): string => ok2(ok, ok ? 'Đạt' : 'Không đạt', cs);
    tbx(
      'tbGrM',
      `<tr><th colspan="3">Bộ phận</th><th>Kích thước (mm)</th><th>y (mm)</th><th>Zp (mm3)</th><th colspan="2">Mp (kN.m)</th></tr>` +
        L.rails
          .map(
            (r, i) =>
              `<tr><td class="l" colspan="3">Thanh tay vịn ${i + 1}</td><td>Ø${fx(r.D, 1)} x ${fx(r.t, 1)}</td><td>${fx(r.y, 1)}</td><td>${fx(r.Z, 0)}</td><td colspan="2">${fx(r.Mp / 1e6, 2)}</td></tr>`,
          )
          .join('') +
        `<tr><td class="l" colspan="5">Tổng các thanh Mp ; chiều cao hợp lực trên mặt gờ ȳ = Σ(Mp.y)/ΣMp (mm)</td><td>${fx(L.yR, 1)}</td><td colspan="2">${fx(L.Mp / 1e6, 2)}</td></tr>` +
        `<tr><td class="l" colspan="3">Cột tại mặt cắt nguy hiểm (hộp b x h x t)</td><td>${fx(L.b, 0)} x ${fx(L.h, 0)} x ${fx(L.t, 1)}</td><td>${fx(P.pyc, 0)}</td><td>${fx(L.Zpo, 0)}</td><td colspan="2">${fx(L.MpPost / 1e6, 2)}</td></tr>` +
        `<tr><td class="l" colspan="5">Sức kháng cột Pp,c = Mp,cột/(ȳ - yc) (kN)</td><td colspan="3">${fx(L.PpPost / 1e3, 2)}</td></tr>` +
        `<tr><td class="l" colspan="5">Bu lông neo cột: ${P.bn} bu lông chịu kéo M${P.bd}, Tn = 0,76.Ab.Fub = ${fx(L.Tn / 1e3, 1)} kN ; cánh tay đòn ${fx(P.blev, 0)} mm ; Pp,b = n.Tn.e/ȳ (kN)</td><td colspan="3">${fx(L.PpBolt / 1e3, 2)}</td></tr>` +
        `<tr><td class="l" colspan="5"><b>Sức kháng của một cột Pp = min(Pp,c ; Pp,b) (kN)</b></td><td colspan="3"><b>${fx(L.Pp / 1e3, 2)}</b></td></tr>`,
    );
    tbx(
      'tbGrR',
      `<tr><th colspan="4">Đại lượng</th><th colspan="2">Giữa đoạn gờ</th><th colspan="2">Đầu đoạn gờ</th></tr>` +
        `<tr><td class="l" colspan="4">Lan can thép: số nhịp cột N của cơ cấu phá hoại ; sức kháng Rr (kN)</td><td colspan="2">${L.NI} ; ${fx(L.RI / 1e3, 1)}</td><td colspan="2">${L.NE} ; ${fx(L.RE / 1e3, 1)}</td></tr>` +
        `<tr><td class="l" colspan="4">Va giữa hai cột: R = Rr + Rw (kN) ; Ȳ = (Rr.Hr + Rw.H)/R (mm)</td><td colspan="2">${fx(L.mI.R / 1e3, 1)} ; ${fx(L.mI.Y, 0)}</td><td colspan="2">${fx(L.mE.R / 1e3, 1)} ; ${fx(L.mE.Y, 0)}</td></tr>` +
        `<tr><td class="l" colspan="4">Kiểm tra R ≥ Ft = ${TL.Ft} kN và Ȳ ≥ He = ${TL.He} mm</td>${glOk2(!!L.mI.ok)}${glOk2(!!L.mE.ok)}</tr>` +
        `<tr><td class="l" colspan="4">Va tại cột: R'w = (Rw.H - Pp.Hr)/H ; R'r = 16Mp/(4L - Lt) = ${fx(L.R2 / 1e3, 1)} kN ; R = Pp + R'r + R'w (kN) ; Ȳ (mm)</td><td colspan="2">${fx(L.pI.Rw2 / 1e3, 1)} ; ${fx(L.pI.R / 1e3, 1)} ; ${fx(L.pI.Y, 0)}</td><td colspan="2">${fx(L.pE.Rw2 / 1e3, 1)} ; ${fx(L.pE.R / 1e3, 1)} ; ${fx(L.pE.Y, 0)}</td></tr>` +
        `<tr><td class="l" colspan="4">Kiểm tra R ≥ Ft và Ȳ ≥ He</td>${glOk2(!!L.pI.ok)}${glOk2(!!L.pE.ok)}</tr>` +
        `<tr><td class="l" colspan="8">Hr = H + ȳ = ${fx(L.Hr, 0)} mm ; L = ${fx(P.sL, 0)} mm khoảng cách cột ; cơ cấu giữa đoạn: N lẻ R = (16Mp + (N - 1)(N + 1)Pp.L)/(2NL - Lt), N chẵn R = (16Mp + N².Pp.L)/(2NL - Lt) ; đầu đoạn R = (2Mp + 2Pp.L.ΣN)/(2NL - Lt), lấy giá trị nhỏ nhất theo N.</td></tr>`,
    );
  } else {
    tbx('tbGrM', '');
    tbx('tbGrR', '');
  }

  const hOK = R.Hra > 0 ? R.Htot >= TL.Hmin : R.H >= TL.Hmin && R.H >= TL.He;
  setOut(
    'o_gl_Hck',
    R.Hra > 0
      ? 'Chiều cao lan can tổ hợp H + Hra = ' +
          fx(R.H, 0) +
          ' + ' +
          fx(R.Hra, 0) +
          ' = ' +
          fx(R.Htot, 0) +
          ' mm ; yêu cầu ≥ Hmin = ' +
          TL.Hmin +
          ' mm'
      : 'Gờ bê tông: H = ' +
          fx(R.H, 0) +
          ' mm ; yêu cầu H ≥ max(He ; Hmin) = ' +
          Math.max(TL.He, TL.Hmin) +
          ' mm',
  );
  setOut('o_gl_Hok', '');
  okn('o_gl_Hok', hOK, hOK ? 'Đạt' : 'Không đạt');

  const glOkTd = (ok: boolean, cs = 2): string => ok2(ok, ok ? 'Đạt' : 'Không đạt', cs);
  tbx(
    'tbGlV',
    `<tr><th colspan="4">Truyền lực gờ - bản mặt cầu (trên 1 mm dài)</th><th colspan="2">Giữa đoạn gờ</th><th colspan="2">Đầu đoạn gờ</th></tr>` +
      (
        [
          ['Lực cắt Vu = T = Rw/(Lc + 2H) (N/mm)', (c) => fx(c.Vu, 1)],
          ['Avf (mm2/mm) ; Pc trọng lượng gờ (N/mm)', (c) => fx(c.Avf, 3) + ' ; ' + fx(c.Pc, 2)],
          ['Vn = c.Acv + μ(Avf.fs + Pc) (N/mm)', (c) => fx(c.Vn, 1)],
          ["Giới hạn min(K1.f'c.Acv ; K2.Acv) (N/mm)", (c) => fx(c.Vmax, 1)],
        ] as Array<[string, (c: GlInterfaceCase) => string]>
      )
        .map(
          ([t, f]) =>
            `<tr><td class="l" colspan="4">${t}</td>${R.cases.map((c) => `<td colspan="2">${f(c)}</td>`).join('')}</tr>`,
        )
        .join('') +
      `<tr><td class="l" colspan="4">Kiểm tra φVn ≥ Vu (φ = 1,0)</td>${R.cases.map((c) => glOkTd(c.Vr >= c.Vu)).join('')}</tr>`,
  );

  const ohApp = (P.oh ?? 0) >= 10;
  setOut(
    'o_gl_Dtx',
    ohApp
      ? ''
      : 'Bản mặt cầu không có phần hẫng ngoài dầm biên (phần hẫng ' +
          fx(P.oh ?? 0, 0) +
          ' mm): gờ đặt trực tiếp trên bản liên hợp với dầm biên, mômen chân gờ truyền vào bản và dầm biên; điều kiện thiết kế phần hẫng (Điều A13.4.1, A13.4.2) không áp dụng.',
  );
  const tbGlD = resolveRealDom('tbGlD');
  if (tbGlD) {
    tbGlD.style.display = ohApp ? '' : 'none';
    if (!ohApp) tbGlD.innerHTML = '';
  }
  if (!ohApp) setOutputValue('tbGlD', '');
  if (ohApp) {
    tbx(
      'tbGlD',
      `<tr><th colspan="4">Bản mặt cầu dưới chân gờ (trên 1 mm dài)</th><th colspan="2">Giữa đoạn gờ</th><th colspan="2">Đầu đoạn gờ</th></tr>` +
        (
          [
            [
              'Mômen Ms = Mc chân gờ (kN.m/m) ; lực kéo T (kN/m)',
              (d) => fx(d.Ms / 1e3, 2) + ' ; ' + fx(d.T, 1),
            ],
            ['Yêu cầu Ms + T.(ds - h/2) (kN.m/m)', (d) => fx(d.Mreq / 1e3, 2)],
            ['Sức kháng (As.fy - T).(ds - a/2) (kN.m/m)', (d) => fx(d.Mcap / 1e3, 2)],
          ] as Array<[string, (d: GlDeckCheck) => string]>
        )
          .map(
            ([t, f]) =>
              `<tr><td class="l" colspan="4">${t}</td>${R.deck.map((d) => `<td colspan="2">${f(d)}</td>`).join('')}</tr>`,
          )
          .join('') +
        `<tr><td class="l" colspan="4">Kết luận (φ = 1,0)</td>${R.deck.map((d) => glOkTd(d.ok)).join('')}</tr>`,
    );
  }

  const items: Array<[string, boolean | 'na']> = [
    ['Sức kháng gờ chắn tại giữa nhịp Rw ≥ Ft (mục 5)', R.I0.Rw >= R.Ft],
    ['Sức kháng gờ chắn tại đầu đoạn gờ Rw ≥ Ft (mục 6)', R.E0.Rw >= R.Ft],
    [
      'Neo cốt thép đứng vào bản mặt cầu (mục 7)' +
        (R.rD < 1
          ? ': chiều dài neo có được bằng ' +
            fx(R.rD, 2) +
            ' ℓdh, sức kháng gờ đã tính với ứng suất cốt thép chân gờ r.fy (TCVN 11823-5, Điều 11.2.4.2, hệ số λer)'
          : ''),
      R.rD >= 1 ? true : R.lminOK && R.RwI >= R.Ft && R.RwE >= R.Ft,
    ],
    ['Chiều cao lan can theo mức ' + P.tl + ' (mục 8)', hOK],
    ...(R.RL
      ? ([
          [
            'Lan can tổ hợp, giữa đoạn gờ: va giữa hai cột ; va tại cột (mục 8)',
            !!(R.RL.mI.ok && R.RL.pI.ok),
          ],
          [
            'Lan can tổ hợp, đầu đoạn gờ: va giữa hai cột ; va tại cột (mục 8)',
            !!(R.RL.mE.ok && R.RL.pE.ok),
          ],
        ] as Array<[string, boolean]>)
      : []),
    ['Truyền lực cắt gờ - bản (mục 9)', R.cases.every((c) => c.Vr >= c.Vu)],
    ['Bản mặt cầu dưới chân gờ (phần hẫng)', ohApp ? R.deck.every((d) => d.ok) : 'na'],
  ];

  tbx(
    'tbGlSum',
    `<tr><th colspan="8">Hạng mục kiểm toán gờ lan can</th><th colspan="2">KL</th></tr>` +
      items
        .map(
          ([t, o]) =>
            `<tr><td class="l" colspan="8">${t}</td>${o === 'na' ? '<td class="c" colspan="2">Không áp dụng</td>' : glOkTd(o)}</tr>`,
        )
        .join(''),
  );
  R.allOK = items.every((x) => x[1] !== false);
  klAppend('tbGlSum', R.allOK, 10);
  glDraw(R);
  return R;
}

export function glDraw(R: GlcCalcResult): void {
  const sv = resolveRealDom('dgGl') as SVGElement | null;
  if (!sv || !R.P) return;
  const id = 'Gl';
  const d = dgKit(id);
  const W = 760;
  const P = R.P;
  const xs = P.poly.map((p) => p[0]);
  const ys = P.poly.map((p) => p[1]);
  const X0 = Math.min(...xs);
  const X1 = Math.max(...xs);
  const Y0 = Math.min(...ys);
  const Y1 = Math.max(...ys);
  const k = Math.min(0.5, 330 / (Y1 - Y0 + 200));
  const x0 = 90;
  const yb = 40 + (Y1 - Y0) * k;
  const X = (x: number): number => x0 + (x - X0) * k;
  const Y = (y: number): number => yb - (y - Y0) * k;

  d.T(W / 2, 18, 'Mặt cắt ngang gờ lan can và sơ đồ đường chảy', 'middle', 'font-weight="bold"');
  d.s += `<rect class="l" x="${X(X0 - 60)}" y="${Y(Y0)}" width="${(X1 - X0 + 360) * k}" height="${R.hD * k}" style="fill:#f4f4f4"/>`;
  d.poly(
    P.poly.map(([x, y]) => [X(x), Y(y)]),
    `url(#hP${id})`,
  );
  const barR = Math.max(2.5, ((P.bw[0]?.d ?? 12) / 2) * k);
  P.bars.forEach(
    ([x, y]) =>
      (d.s += `<circle cx="${X(x)}" cy="${Y(y)}" r="${barR}" style="fill:#c00000"/>`),
  );
  d.dimV(X(X0) - 30, Y(Y1), Y(Y0), 'H = ' + fx(R.H, 0), -1);
  d.dimH(X(X0), X(X1), Y(Y0) + R.hD * k + 22, fx(X1 - X0, 0), Y(Y0) + R.hD * k);

  const yh = Math.min(R.TL.He, Y1 - 1);
  const xa = X(glW(P.poly, yh).xmax);
  d.A(xa + 90, Y(yh), xa + 4, Y(yh));
  d.T(
    xa + 8,
    Y(yh) - 6,
    'Ft = ' + R.TL.Ft + ' kN tại He = ' + R.TL.He + (R.TL.He > Y1 ? ' (> H)' : ''),
    'start',
    'class="s"',
  );
  {
    const yb2 = P.bw[1] ? P.bw[1].b : 0;
    if (yb2 > 0 && yb2 < R.H) {
      d.s += `<line x1="${X(X0) - 14}" y1="${Y(Y0 + yb2)}" x2="${X(X1) + 14}" y2="${Y(Y0 + yb2)}" style="stroke:#1f4e79;stroke-dasharray:6,3"/>`;
      d.T(
        X(X0) + 6,
        Y(Y0 + yb2 + (R.H - yb2) / 2) + 4,
        'Khối 1',
        'start',
        'class="s" style="fill:#1f4e79"',
      );
      d.T(X(X0) + 6, Y(Y0 + yb2 / 2) + 4, 'Khối 2', 'start', 'class="s" style="fill:#1f4e79"');
    }
  }
  d.T(X(X1) + 40, Y(Y0) - 6, 'phía xe chạy', 'middle', 'class="s"');
  d.T(X(X0) - 40, Y(Y0) + R.hD * k + 40, '', 'middle');

  const ex = 455;
  const ew = 280;
  const eh = 110;
  const ey = 60;
  d.s += `<rect class="l" x="${ex}" y="${ey}" width="${ew}" height="${eh}" style="fill:#fafafa"/>`;
  const lc = ew * 0.62;
  const lt = ew * 0.2;
  const cx = ex + ew / 2;
  d.s += `<path d="M${cx - lc / 2},${ey + eh} L${cx - lt / 2},${ey} M${cx + lc / 2},${ey + eh} L${cx + lt / 2},${ey} M${cx - lc / 2},${ey + eh} L${cx + lc / 2},${ey + eh}" style="stroke:#c00000;stroke-width:1.5;stroke-dasharray:6,3;fill:none"/>`;
  d.s += `<rect x="${cx - lt / 2}" y="${ey - 8}" width="${lt}" height="6" style="fill:#1f4e79"/>`;
  d.dimH(cx - lt / 2, cx + lt / 2, ey - 14, 'Lt', ey - 8);
  d.dimH(cx - lc / 2, cx + lc / 2, ey + eh + 16, 'Lc', ey + eh);
  d.T(
    cx,
    ey + eh + 44,
    'Giữa đoạn gờ: Rw = 2/(2Lc - Lt).(8Mb + 8Mw.H + Mc.Lc²/H)',
    'middle',
    'class="s"',
  );
  d.T(
    cx,
    ey + eh + 60,
    'Đầu đoạn gờ: Rw = 2/(2Lc - Lt).(Mb + Mw.H + Mc.Lc²/H)',
    'middle',
    'class="s"',
  );
  dgPut(sv, W, Math.max(Y(Y0) + R.hD * k + 50, ey + eh + 72), d.s, id);
}

// ---------------------------------------------------------------------------
// 10. Canonical Project-Type Adapters (`src/types/project.ts`)
// ---------------------------------------------------------------------------

export function toDeckComponentSummary(sup2?: Sup2Result | null): DeckComponentSummary {
  const s = sup2 ?? SUP2R;
  const gc = s?.gc;
  const isKd = !!(gc && 'kd' in gc && gc.kd);
  const bearingOrPadMode: 'G' | 'K' = isKd ? 'K' : supK() ? 'K' : 'G';
  const bearingOk = gc
    ? 'kd' in gc && gc.kd
      ? gc.ok
      : (gc as GcCalcResult).allOK
    : undefined;
  const oh = s?.bm?.oh;
  const overhangOk =
    oh && !oh.na && oh.items ? oh.items.every(([, ok]) => ok) : undefined;
  const linkActive = ltnOn();

  return {
    deckSlabOk: s?.bm?.allOK,
    overhangOk,
    bearingOrPadMode,
    bearingOk,
    linkSlabActive: linkActive,
    linkSlabOk: linkActive ? LTNR?.allOK : undefined,
    expansionJointOk: KCGR?.allOK ?? KCGR?.ok,
    barrierYieldLineOk: GLCR?.allOK,
  };
}

export function toGirderWithDeckResult(
  damResult: AnyDamResult,
  sup2?: Sup2Result | null,
): GirderResult {
  const rawType = damResult.type;
  const spType: GirderResult['spType'] =
    rawType === 'I' ? 'I' : rawType === 'RC' ? 'RC' : 'PC';
  const mapBranch = (br: AnyGirderBranch): GirderResult['g'] => {
    const anyBr = br as unknown as Record<string, unknown>;
    return {
      kind: spType,
      Lm: br.Lm,
      L: br.L,
      Ls: br.Ls,
      H: (anyBr.H as number | undefined) ?? 0,
      Ec: br.Ec,
      Eci: (anyBr.Eci as number | undefined) ?? br.Ec,
      Ecs: (anyBr.Ecs as number | undefined) ?? br.Ec,
      ncs: (anyBr.ncs as number | undefined) ?? 1,
      vol: (anyBr.vol as number | undefined) ?? 0,
      loads: (anyBr.loads as Record<string, number> | undefined) ?? {},
      DF: (anyBr.DF as Record<string, number> | undefined) ?? {},
      IM: br.IM,
      Rg: br.Rg,
      groups: (anyBr.groups as Record<string, unknown> | undefined) ?? {},
      res: (anyBr.res as Record<string, unknown> | undefined) ?? {},
      camber: (anyBr.camber as Record<string, unknown> | undefined) ?? {},
      shr: (anyBr.shr as Record<string, unknown> | undefined) ?? {},
      anch: anyBr.anch as Record<string, unknown> | undefined,
      dd: anyBr.dd as Point2D[] | undefined,
      okAll: (anyBr.okAll as boolean | undefined) ?? undefined,
    };
  };

  return {
    spType,
    g: mapBranch(damResult.g as AnyGirderBranch),
    b: mapBranch((damResult.b ?? damResult.g) as AnyGirderBranch),
    deck: toDeckComponentSummary(sup2),
  };
}
