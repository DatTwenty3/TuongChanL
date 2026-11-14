/**
 * BangTinhCauCong Web App — Canonical Clean-Room Domain & Contract Types
 *
 * Strictly reconstructed from verified engineering, GIS/DEM, graphics, and reporting
 * specifications under `E:\3. data\rea\analysis-cau-cong\` (modules `01`..`20` & `shell.html`).
 * Zero Electron IPC, commercial activation, or licensing concepts exist anywhere in these contracts.
 */

// ---------------------------------------------------------------------------
// 1. Application Modes, 46-Tab Registry & Scope Visibility
// ---------------------------------------------------------------------------

export const APP_MODES = ['cau', 'ch', 'ct', 'tc', 'tl', 'tv', 'tvc'] as const;
export type AppMode = (typeof APP_MODES)[number];

export const APPMODE_LABELS: Readonly<Record<AppMode, string>> = {
  cau: 'Cầu: kết cấu nhịp, mố, cọc',
  ch: 'Cống hộp BTCT (tính độc lập)',
  ct: 'Cống tròn BTCT (tính độc lập)',
  tc: 'Tường chắn trọng lực (tính độc lập)',
  tl: 'Tường chắn chữ L BTCT (tính độc lập)',
  tv: 'Thủy văn cầu (tính độc lập)',
  tvc: 'Thủy văn cống (tính độc lập)',
};

export const BODY_MODE_CLASS: Readonly<Record<AppMode, string | null>> = {
  cau: null,
  ch: 'mch',
  ct: 'mct',
  tc: 'mtc',
  tl: 'mtl',
  tv: 'mtv',
  tvc: 'mtvc',
};

export type ObjScope = 'all' | 'dam' | 'mo' | 'tru';

export const CONTEXT_PREFIXES = ['', 'Q_', 'T_', 'U_', 'C_', 'P_', 'W_'] as const;
export type ContextPrefix = (typeof CONTEXT_PREFIXES)[number];

/**
 * Fallback prefix hierarchy (`12_piles_geotech_mcoc_and_pm3d.js` / `02_core_utils_and_column_pm.js`):
 * Secondary T2 borehole tabs (`U_`, `W_`) fall back to T1 shaft inputs (`T_`, `P_`).
 */
export const CTXPAR: Readonly<Partial<Record<ContextPrefix, ContextPrefix>>> = {
  U_: 'T_',
  W_: 'P_',
};

/**
 * Resolve an unprefixed DOM element ID within a cross-tab context (`IDP` + `CTXPAR` rule).
 */
export function resolveScopedIdCandidates(id: string, prefix: ContextPrefix): string[] {
  const candidates: string[] = [];
  if (prefix) {
    candidates.push(prefix + id);
    const parent = CTXPAR[prefix];
    if (parent) candidates.push(parent + id);
  }
  candidates.push(id);
  return candidates;
}

/**
 * Exact 46 active `.tab[data-t]` IDs in `shell.html` order.
 * Includes `45` engineering tabs + verification tab `60` (`tvt`).
 */
export const TAB_IDS = [
  7, 54, 70, 8, 9, 10, 11, 12, 13, 14, 4, 5, 1, 52, 6, 2, 56, 3, 20, 21, 22, 26, 23, 24, 57, 25,
  46, 47, 49, 53, 48, 50, 58, 51, 43, 15, 16, 44, 17, 41, 42, 61, 62, 18, 19, 60,
] as const;

export type TabId = (typeof TAB_IDS)[number];

/**
 * Reserved unused numeric IDs absent from `shell.html`.
 */
export const RESERVED_TAB_IDS = [
  27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 45, 55, 59, 63, 64, 65, 66, 67, 68, 69,
] as const;

export const OBJ_TABS: Readonly<Record<Exclude<ObjScope, 'all'>, readonly TabId[]>> = {
  dam: [8, 9, 10, 11, 12, 13, 14],
  mo: [4, 5, 1, 6, 2, 56, 3, 52, 43],
  tru: [20, 21, 22, 26, 23, 24, 57, 25, 46, 47, 49, 48, 50, 58, 51, 53],
};

export type ItemKey =
  | '8'
  | '9'
  | '10'
  | '11'
  | '12'
  | '13'
  | '14'
  | 'mtt'
  | 'mmc'
  | 'mnl'
  | 'mbe'
  | 'msc'
  | 'mvl'
  | 'ttt'
  | 'tnl'
  | 'txm'
  | 'tth'
  | 'tnc'
  | 'tbe'
  | 'tsc'
  | 'tvl'
  | 'qd';

export type ItemGroup = 'sup' | 'mo' | 'tru' | 'qd';

/**
 * Exact 32-tab -> 22-item checklist registry (`IT_TAB` in `12_piles_geotech_mcoc_and_pm3d.js:1558-1591`).
 */
export const IT_TAB: Readonly<Partial<Record<TabId, ItemKey>>> = {
  8: '8',
  9: '9',
  10: '10',
  11: '11',
  12: '12',
  13: '13',
  14: '14',
  4: 'mtt',
  5: 'mmc',
  1: 'mnl',
  52: 'mnl',
  6: 'mbe',
  2: 'msc',
  56: 'msc',
  3: 'mvl',
  20: 'ttt',
  21: 'tnl',
  22: 'txm',
  46: 'txm',
  26: 'tth',
  47: 'tth',
  23: 'tnc',
  49: 'tnc',
  53: 'tnc',
  48: 'tbe',
  24: 'tsc',
  57: 'tsc',
  50: 'tsc',
  58: 'tsc',
  25: 'tvl',
  51: 'tvl',
  43: 'qd',
};

/** Divider sheets (`#tq_ngan`): `0` = none, `1` = Part I/II/III dividers, `2` = Part + Item dividers */
export type DividerMode = 0 | 1 | 2;

/** Export worksheet scope (`#expScope`) */
export type ExportScope = 'all' | 'one';

// ---------------------------------------------------------------------------
// 2. Project Metadata, `KEEP` Persistence & Local Static Assets
// ---------------------------------------------------------------------------

export interface ProjectMetadata {
  pj1: string;
  pj2: string;
  pj3: string;
  pj4: string;
  pj5: string;
  pj6: string;
}

export const PROJDEF: Readonly<Record<Exclude<AppMode, 'cau'>, Pick<ProjectMetadata, 'pj6' | 'pj4'>>> = {
  ch: { pj6: 'BẢNG TÍNH TOÁN KẾT CẤU CỐNG HỘP BTCT', pj4: 'Cống hộp BTCT' },
  ct: { pj6: 'BẢNG TÍNH TOÁN KẾT CẤU CỐNG TRÒN BTCT', pj4: 'Cống tròn BTCT' },
  tc: { pj6: 'BẢNG TÍNH TOÁN TƯỜNG CHẮN TRỌNG LỰC', pj4: 'Tường chắn trọng lực' },
  tl: { pj6: 'BẢNG TÍNH TOÁN TƯỜNG CHẮN CHỮ L BTCT', pj4: 'Tường chắn chữ L BTCT' },
  tv: { pj6: 'BẢNG TÍNH THỦY VĂN, THỦY LỰC CẦU', pj4: 'Thủy văn cầu' },
  tvc: { pj6: 'BẢNG TÍNH THỦY VĂN, THỦY LỰC CỐNG', pj4: 'Thủy văn cống' },
};

export const KEEP_APP_ID = 'ckn11823' as const;
export const KEEP_SCHEMA_VERSION = 9 as const;

export const STORAGE_KEYS = {
  snapshot: 'ckn11823v5',
  snapshotBackup: 'ckn11823v5_truoc_KL',
  klMigrationFlag: 'ckn_kl_v1',
  mode: 'ckn_mode',
  tabLegacy: 'ckn_tab',
  tabState: 'ckn11823t5',
  tabByModePrefix: 'ckn_tab_',
  projByModePrefix: 'ckn_proj_',
  boxCulvertRebar: 'ckn_ch_reb2',
  rcInit: 'ckn_rc_init',
  giInit: 'ckn_gi_init',
  customRainDb: 'tramMua',
} as const;

/**
 * Version-keyed `KEEP` migration cleanup rules (`12_piles_geotech_mcoc_and_pm3d.js:3949-3969`).
 */
export const KEEP_MIGRATION_KEYS_BY_VERSION = {
  2: ['mo_jtm', 's2_geoT', 's2_bh', 's2_top'],
  3: ['mo_jtm', 'mo_dky', 'mo_g', 'mo_ix', 'mo_hrt'],
  4: ['tq_sup'],
  5: ['mo_Tmax'],
  6: ['gc_n', 'gc_hri', 'gc_hc', 'gc_hs'],
  7: ['gc_n', 'gc_hri', 'gc_hc', 'gc_hs'],
  8: [
    'bm_dB',
    'bm_sB',
    'bm_dT',
    'bm_sT',
    'bm_dLB',
    'bm_sLB',
    'bm_dLT',
    'bm_sLT',
    'bm_ct',
    'bm_cb',
  ],
  9: ['bm_sLB'],
} as const;

/**
 * Deduplicated legacy field IDs stripped when upgrading snapshots with `_v < 9`
 * (`12_piles_geotech_mcoc_and_pm3d.js:3949-3969`).
 */
export const DEPRECATED_KEEP_KEYS_LT_9 = [
  'mo_jtm',
  's2_geoT',
  's2_bh',
  's2_top',
  'mo_dky',
  'mo_g',
  'mo_ix',
  'mo_hrt',
  'tq_sup',
  'mo_Tmax',
  'gc_n',
  'gc_hri',
  'gc_hc',
  'gc_hs',
  'bm_dB',
  'bm_sB',
  'bm_dT',
  'bm_sT',
  'bm_dLB',
  'bm_sLB',
  'bm_dLT',
  'bm_sLT',
  'bm_ct',
  'bm_cb',
] as const;

export interface ProjectSnapshot {
  _app: typeof KEEP_APP_ID;
  _v: typeof KEEP_SCHEMA_VERSION;
  _mode: AppMode;
  _date: string;
  values: Record<string, string>;
  metadata?: Partial<ProjectMetadata>;
}

/**
 * Static offline TTF fonts & Thanh Hóa GeoTIFF DEM assets served directly from `public/`.
 */
export const STATIC_FONT_FILES = [
  'fonts/Arimo_400Regular.ttf',
  'fonts/Tinos_400Regular.ttf',
  'fonts/Tinos_400Regular_Italic.ttf',
  'fonts/Tinos_700Bold.ttf',
  'fonts/Tinos_700Bold_Italic.ttf',
] as const;

export const STATIC_DEM_FILES = ['dem/cop1.txt', 'dem/cop2.txt', 'dem/thanhhoa.txt'] as const;

export const VENDOR_ASSET_PATHS = {
  mathjaxTexSvg: 'vendor/mathjax/tex-svg.js',
  tesseractWorker: 'vendor/tesseract/worker.min.js',
  tesseractCoreDir: 'vendor/tesseract-core',
  tesseractLangDir: 'vendor/tesseract-data/4.0.0_best_int',
} as const;

// ---------------------------------------------------------------------------
// 3. Shared Engineering Primitives & Rebar Area Tables
// ---------------------------------------------------------------------------

export type Point2D = [number, number];
export type Point3D = [number, number, number];
export type LimitStateType = 'CD' | 'DB' | 'SD';
export type SoilStratumType = 'Sét' | 'Cát' | 'Cuội' | 'IGM' | 'Đá';

export type RebarAreaMap = Readonly<Record<number, number>>;

/** Module 02 circular pile bar table (preserved verbatim) */
export const REBAR_AREA_02: RebarAreaMap = {
  10: 78.5,
  12: 113.1,
  14: 154,
  16: 201,
  18: 254.5,
  20: 314,
  22: 380.1,
  25: 491,
  28: 616,
  32: 804,
};

/** Module 11 box culvert bar table (preserved verbatim) */
export const CH_REBAR_AREA: RebarAreaMap = {
  6: 28.3,
  8: 50.3,
  10: 78.5,
  12: 113.1,
  14: 153.9,
  16: 201.1,
  18: 254.5,
  20: 314.2,
  22: 380.1,
  25: 490.9,
  28: 615.8,
  32: 804.2,
  36: 1017.9,
  40: 1256.6,
};

/** Module 11 circular pipe culvert bar table (preserved verbatim) */
export const CT_REBAR_AREA: RebarAreaMap = {
  6: 28.3,
  8: 50.3,
  10: 78.5,
  12: 113.1,
  14: 153.9,
  16: 201.1,
  18: 254.5,
  20: 314.2,
  22: 380.1,
  25: 490.9,
};

// ---------------------------------------------------------------------------
// 4. Shallow Foundation Result (`SF` — Module 01 & 14)
// ---------------------------------------------------------------------------

export interface N17Factors {
  Nc: number;
  Nq: number;
  Ng: number;
}

export interface BearingPressureResult {
  ok: boolean;
  why?: string;
  ex?: number;
  ey?: number;
  qmax?: number;
  qmin?: number;
  a?: number;
  b?: number;
  c?: number;
  ratio?: number;
  fullComp?: boolean;
}

export interface SoilQnResult {
  c: number;
  phi: number;
  F: N17Factors;
  B: number;
  L: number;
  sc: number;
  sg: number;
  sq: number;
  dq: number;
  n: number;
  th: number;
  H: number;
  V: number;
  iq: number;
  ig: number;
  ic: number;
  Cwq: number;
  Cwg: number;
  Ncm: number;
  Nqm: number;
  Ngm: number;
  qn: number;
}

export interface ShallowFootingComboCheck {
  id: string;
  st: LimitStateType;
  V: number;
  Hx: number;
  Hy: number;
  Mx: number;
  My: number;
  gEQ?: number;
  Dw?: number;
  ex: number;
  ey: number;
  g0?: boolean;
  exE?: number;
  eyE?: number;
  eLk?: number;
  eLx?: number;
  eLy?: number;
  eOK?: boolean;
  Bp?: number;
  Lp?: number;
  Ap?: number;
  q: number;
  br?: SoilQnResult;
  pr?: BearingPressureResult;
  qn?: number;
  phiB?: number;
  qRr?: number;
  qRc?: number;
  qR?: number;
  qOK: boolean;
  H?: number;
  Vs?: number;
  Rt?: number;
  Ra?: number;
  RR?: number;
  fT?: number;
  fE?: number;
  sOK?: boolean;
  sTag?: string;
  qs?: number;
  tanD?: number;
}

export interface ShallowFootingSettlement {
  ok: boolean;
  id?: string;
  V?: number;
  ex?: number;
  ey?: number;
  Bp?: number;
  Lp?: number;
  A?: number;
  q0?: number;
  bz?: number;
  Ip?: number | null;
  S?: number;
  Sa?: number;
  sOK?: boolean;
}

export interface RockAnchorCheck {
  n: number;
  d: number;
  As: number;
  TrSteel: number;
  TrBond: number;
  Tr: number;
  ldbGrout: number;
  ldbCap: number;
  okLr: boolean;
  okLc: boolean;
  mu: number;
  sum: number;
}

export interface ShallowFootingResult {
  B: number;
  L: number;
  Df: number;
  rock: boolean;
  checks: ShallowFootingComboCheck[];
  settlement: ShallowFootingSettlement | null;
  anchor?: RockAnchorCheck | null;
  pressureGrid?: {
    cells: Array<{ x: number; y: number; a: number; dx: number; dy: number }>;
    reactionsByCombo: Array<{ id: string; st: LimitStateType; q: number[]; ok: boolean }>;
  };
  okAll: boolean;
}

// ---------------------------------------------------------------------------
// 5. Reinforced Concrete Rectangular & Circular Section Result (`RC` / `PM3D`)
// ---------------------------------------------------------------------------

export interface RcMaterialProps {
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
  Ec: number;
  fr: number;
  b1: number;
  a1: number;
  n: number;
}

export interface RcRebarLayer {
  n: number;
  s: number;
  d: number;
  dc: number;
}

export interface RcSectionInput {
  b: number;
  h: number;
  f1: RcRebarLayer;
  f2: RcRebarLayer;
  st: { s: number; d: number; n: number };
}

export interface RcFlexResult {
  As: number;
  ds: number;
  Asc: number;
  dsc: number;
  c: number;
  a: number;
  fs: number;
  fsc: number;
  Mn: number;
  et: number;
  phi: number;
  type: 1 | 2 | 3;
  ylim: boolean;
}

export interface RcCrackResult {
  As: number;
  de: number;
  rho: number;
  k: number;
  j: number;
  fss0: number;
  fss: number;
  bs: number;
  smax: number;
  fct: number;
  sb: number;
  need: boolean;
  ok: boolean;
}

export interface RcShearResult {
  As: number;
  de: number;
  dv: number;
  Av: number;
  Avmin: number;
  hasMin: boolean;
  es: number;
  sxe: number;
  beta: number;
  th: number;
  Vc: number;
  Vs: number;
  Vlim: number;
  Vn: number;
  Vr: number;
  vu: number;
  smax: number;
  needSt: boolean;
  ok: boolean;
}

export interface RcComboRow {
  id: string;
  st: LimitStateType;
  M: number;
  V: number;
  N: number;
  fl: RcFlexResult;
  phi: number;
  Mr: number;
  rM: number;
  sh: RcShearResult;
  rV: number;
}

export interface RcMinFlexCheck {
  Mcr: number;
  Mu: number;
  lim: number;
  Mr: number;
  ok: boolean;
  id: string;
}

export interface CircularPmPoint {
  Pn: number;
  Mn: number;
  phi: number;
  P: number;
  M: number;
}

export interface CircularPmCurveResult {
  pts: CircularPmPoint[];
  cap: number;
}

export interface Pm3dSurfaceResult {
  meridians: Array<{
    alphaDeg: number;
    pts: Array<{ P: number; Mx: number; My: number; M: number; phi: number }>;
  }>;
  capCD: number;
  capDB: number;
  loadChecks: Array<{
    nm: string;
    st: 'CD' | 'DB';
    P: number;
    Mx: number;
    My: number;
    M: number;
    phiMnTheta: number;
    ratio: number;
    ok: boolean;
  }>;
  okAll: boolean;
}

export interface RcSectionResult {
  rows: RcComboRow[];
  gM: RcComboRow | null;
  gV: RcComboRow | null;
  gS: RcComboRow | null;
  minR: RcMinFlexCheck | null;
  cr: RcCrackResult | null;
  Ag: number;
  Ig: number;
  Sg: number;
  circular?: {
    D: number;
    As: number;
    Po: number;
    cd: CircularPmCurveResult;
    db: CircularPmCurveResult;
    pm3d?: Pm3dSurfaceResult;
  };
}

// ---------------------------------------------------------------------------
// 6. Superstructure Girder & Deck Result (`DAM` / `RCG` / `GI` / `SUP2R`)
// ---------------------------------------------------------------------------

export type GirderSystemType = 'PC' | 'RC' | 'I';

export interface GirderBranchResult {
  kind: GirderSystemType;
  Lm: number;
  L: number;
  Ls: number;
  H: number;
  Ec: number;
  Eci: number;
  Ecs: number;
  ncs: number;
  vol: number;
  loads: Record<string, number>;
  DF: Record<string, number>;
  IM: number;
  Rg: { DC: number; DW: number };
  groups: Record<string, unknown>;
  res: Record<string, unknown>;
  camber: Record<string, unknown>;
  shr: Record<string, unknown>;
  anch?: Record<string, unknown>;
  dd?: Point2D[];
  okAll?: boolean;
}

export interface DeckComponentSummary {
  deckSlabOk?: boolean;
  overhangOk?: boolean;
  bearingOrPadMode: 'G' | 'K';
  bearingOk?: boolean;
  linkSlabActive: boolean;
  linkSlabOk?: boolean;
  expansionJointOk?: boolean;
  barrierYieldLineOk?: boolean;
}

export interface GirderResult {
  spType: GirderSystemType;
  g: GirderBranchResult;
  b: GirderBranchResult;
  deck?: DeckComponentSummary;
}

// ---------------------------------------------------------------------------
// 7. Abutment Results (`MO`/`MOR` Heavy & `MD` Flexible)
// ---------------------------------------------------------------------------

export interface ForceVector5 {
  N: number;
  Hx: number;
  My: number;
  Hy: number;
  Mx: number;
}

export interface AbutmentComboEntry {
  id: string;
  st: LimitStateType;
  lim: string;
  desc: string;
  tot: ForceVector5;
  rows: Array<ForceVector5 & { k: string; g: number }>;
}

export interface MindlinPlateResult {
  nx: number;
  ny: number;
  t: number;
  B5: number;
  H: number;
  H4: number;
  maxMxx: number;
  maxMyy: number;
  maxQx: number;
  maxQy: number;
  ok: boolean;
}

export interface AbutmentResult {
  variant: 'heavy' | 'flexible';
  err: string[];
  sec: Record<'A' | 'B' | 'C', Record<string, ForceVector5>>;
  comb: Record<'A' | 'B' | 'C', AbutmentComboEntry[]>;
  sectionChecks?: Record<string, RcSectionResult>;
  capCheck?: {
    rc: RcSectionResult;
    punching?: { ok: boolean; ratios: number[] };
    winklerCap?: { Rv: number[]; Mmax: number; Mmin: number; Vmax: number };
    stm?: { active: boolean; ok: boolean };
  };
  wingwallPlate?: MindlinPlateResult;
  okAll: boolean;
}

// ---------------------------------------------------------------------------
// 8. Bridge Pier Results (`TR` Flexible & `DCT` Solid)
// ---------------------------------------------------------------------------

export interface PierResult {
  variant: 'flexible' | 'solid';
  geom: Record<string, number>;
  combos: Array<{ id: string; st: LimitStateType; tot: ForceVector5 }>;
  buckling?: {
    PeT: number;
    PeL: number;
    PeTb: number;
    PeLb: number;
    slenderMax: number;
    swayFlag: boolean;
  };
  capCheck?: RcSectionResult;
  stemCheck?: {
    rc?: RcSectionResult;
    pmBiaxial?: {
      angles: number;
      depths: number;
      maxUtilRatio: number;
      ok: boolean;
    };
  };
  footingCheck?: {
    rcX?: RcSectionResult;
    rcY?: RcSectionResult;
    punchingOk?: boolean;
    stmActive?: boolean;
    stmOk?: boolean;
  };
  seismic?: {
    T: number;
    Cms: number;
    zone: number;
    plasticHingeOk?: boolean;
    confinementOk?: boolean;
  };
  okAll: boolean;
}

// ---------------------------------------------------------------------------
// 9. Pile Group Rigid-Cap (`MC`) & Drilled Shaft Geotech (`SCT`) Results
// ---------------------------------------------------------------------------

export interface PileHeadForces {
  N: number;
  Q2: number;
  Q3: number;
  M1: number;
  M2: number;
  M3: number;
  ul?: number[];
}

export interface PileSummaryRow extends PileHeadForces {
  tc: number;
  th: number;
}

export interface PileSummaryEnvelope {
  Nmin: PileSummaryRow | null;
  Nmax: PileSummaryRow | null;
  Q2max: PileSummaryRow | null;
  Q3max: PileSummaryRow | null;
  M1max: PileSummaryRow | null;
  M2max: PileSummaryRow | null;
  M3max: PileSummaryRow | null;
}

export interface PileGroupResult {
  Kc: number[][];
  parts: Array<{
    x: number;
    y: number;
    bx: number;
    by: number;
    K: number[][];
    TA: number[][];
  }>;
  res: Array<{
    U: [number, number, number, number, number, number];
    pf: PileHeadForces[];
  }>;
  summaryCD?: PileSummaryEnvelope;
  summaryDB?: PileSummaryEnvelope;
}

export interface SoilStratumInput {
  name?: string;
  type: SoilStratumType;
  topEl: number;
  botEl: number;
  gamma: number;
  N60?: number;
  qu?: number;
  RQD?: number;
  GSI?: number;
  mi?: number;
  Dd?: number;
  open?: boolean;
}

export interface ShaftSliceResult {
  i: number;
  zTop: number;
  zBot: number;
  len: number;
  type: SoilStratumType;
  sv: number;
  qs: number;
  Rs: number;
  phi: number;
  Rsd: number;
}

export interface ShaftTipResult {
  type: SoilStratumType;
  qp: number;
  qpk: number;
  Rn: number;
  phi: number;
  eta: number;
  Rcd: number;
  Rdb: number;
  capped?: boolean;
  txt: string;
}

export interface DrilledShaftGroupCheckResult {
  compOk: boolean;
  upliftOk: boolean;
  blockOk: boolean;
  settleMm?: number;
  settleOk?: boolean;
  punchOk?: boolean;
  negFrictionDeducted?: number;
  okAll: boolean;
}

export interface DrilledShaftResult {
  D: number;
  P: number;
  A: number;
  EL3: number;
  top: number;
  ELcap: number;
  L: number;
  s: number;
  eta: number;
  layers: SoilStratumInput[];
  slices: ShaftSliceResult[];
  byType: Record<string, number>;
  tip: ShaftTipResult;
  RsCD: number;
  RsDB: number;
  QupCD: number;
  QupDB: number;
  QRcd: number;
  QRdb: number;
  W: number;
  PW: number;
  warn: string[];
  groupCheck?: DrilledShaftGroupCheckResult;
}

// ---------------------------------------------------------------------------
// 10. Retaining Walls (`TC` Gravity & `TL` Cantilever L-Wall) & Culverts (`CH`/`CT`/`QD`)
// ---------------------------------------------------------------------------

export type TcLib86GroupCode = 'vvm' | 'vvc' | 'vnm' | 'vnc' | 'cvm' | 'cvc' | 'cnm' | 'cnc';

export interface RetainingWallResult {
  variant: 'gravity' | 'cantilever-l';
  eLim: number;
  brm: string;
  coul?: number;
  Ia: Record<string, unknown>;
  Ib: Record<string, unknown>;
  SD: Record<string, unknown>;
  bambooNeeded?: boolean;
  anchor?: RockAnchorCheck | null;
  iface?: { Vr: number; Vu: number; Avf: number; AvfMin: number; ok: boolean; okMin: boolean };
  ok: {
    e: boolean;
    sl: boolean;
    br: boolean;
    stem: boolean;
    foot?: boolean;
    toe?: boolean;
    heel?: boolean;
    ifc?: boolean;
    sh?: boolean;
    an?: boolean;
    all: boolean;
  };
}

export interface CulvertResult {
  kind: 'box' | 'circular' | 'approach-slab';
  cells?: 1 | 2 | 3;
  stationsCount?: number;
  direct?: {
    rows: Array<Record<string, unknown>>;
    shear?: Array<Record<string, unknown>>;
    okAll: boolean;
  };
  indirect?: {
    Si: number;
    BFE: number;
    BFLL: number;
    D: number;
    Dp: number;
    ok: boolean | null;
  };
  soilSettlement?: {
    Bp: number;
    qMax: number;
    qR: number;
    StMm: number;
    okBearing: boolean;
    okSettle: boolean;
  };
  shrinkageOk?: boolean;
  okAll: boolean;
}

// ---------------------------------------------------------------------------
// 11. Hydrology (`HV`/`TVC`), GeoTIFF DEM Watershed (`HVD`/`TVX`), DXF & OCR
// ---------------------------------------------------------------------------

export interface CustomRainfallStation {
  slug: string;
  name: string;
  tg: 'mx' | 'rx' | 'd';
  ser: Array<[number, number, ...unknown[]]>;
}

export interface HydrologyResult {
  mode: 'bridge' | 'culvert';
  station: string;
  P: number;
  Px?: number;
  qsrc?: 'rain' | 'dhxd' | 'tl' | 'ht';
  stats?: {
    n: number;
    mean: number;
    Cv: number;
    Cs: number;
    csOK: boolean;
  };
  Q: Record<number, { Q: number; Hp?: number; phi?: number; Ap?: number }>;
  H: Record<number, number>;
  scour?: {
    P: number;
    Q: number;
    H: number;
    generalEg: number;
    maxGeneralDepth: number;
    piers: Array<{ ys: number; el: number; method: string }>;
    abut: Array<{ n: string; ys: number; el: number; mode: string }>;
  };
  culvertSizing?: Array<{
    name: string;
    km: string;
    Fkm: number;
    Q: number;
    kind: 'tron' | 'hop' | 'ban';
    nBarrels: number;
    size: string;
    Hd: number;
    Vra: number;
    hx: number;
    okClearance: boolean;
  }>;
}

export type DemSourceKind = 'cop' | 'srtm' | 'user';

export interface DemWatershedResult {
  src: DemSourceKind;
  Fkm: number;
  L: number;
  B: number;
  sl: number;
  Jls: number;
  Jsd: number;
  R: number;
  edge: boolean;
  nodata: boolean;
  thr: number;
  cnt: number;
  cA: number;
  lon: number;
  lat: number;
  outVN: Point2D;
  bnd: Point2D[];
  mainP: Point2D[];
  brP: Point2D[][];
  brO: Point2D[][];
  prof: Array<[number, number]>;
}

export interface DxfImportResult {
  acadVersion: string;
  usedTcvn3: boolean;
  entityCount: number;
  section?: {
    name: string;
    x0: number;
    points: Point2D[];
  };
  bridge?: {
    xA1?: number;
    xA2?: number;
    piers: Array<{ x: number; width: number }>;
    waterLevels: Array<{ label: string; z: number }>;
    pearsonR: number;
  };
}

export interface OcrResult {
  targetId: string;
  mode: 'profile' | 'table';
  scalesEvaluated: number[];
  rowsParsed: number;
  text: string;
}

// ---------------------------------------------------------------------------
// 12. Standard Lookup Modal (`LK`) & Verification Suite (`VT`)
// ---------------------------------------------------------------------------

export type LookupTableKey =
  | 'uw'
  | 'IM'
  | 'mL'
  | 'V'
  | 'del'
  | 'mu'
  | 'VB'
  | 'S'
  | 'Cd'
  | 'lf'
  | 'heq'
  | 'soil'
  | 'R'
  | 'G'
  | 'grade'
  | 'g13'
  | 'exp'
  | 'Kp'
  | 'Kef'
  | 'phig';

export interface LookupTableDef {
  key: LookupTableKey;
  title: string;
  standardRef: string;
  interactive: boolean;
  hasDynamicSvg: boolean;
  hostTargets: Array<{ elementId?: string; textMatch?: string; dataFor?: string }>;
}

export type VerificationTolerance = { abs: number; rel?: never } | { rel: number; abs?: never };

export interface VerificationCheck {
  g: string;
  t: string;
  q: string;
  u: string;
  ref: number;
  tol: VerificationTolerance;
  src: string;
  f: () => number;
}

export interface VerificationCheckResult extends VerificationCheck {
  v: number;
  d: number;
  rel: number;
  lim: number;
  ok: boolean;
  err: string;
}

export interface VerificationSuiteResult {
  fixedCount: number;
  liveCount: number;
  totalCount: number;
  passedCount: number;
  failedCount: number;
  results: VerificationCheckResult[];
}

// ---------------------------------------------------------------------------
// 13. UI State & Standalone Browser Bridges (Zero Electron / Zero CDN)
// ---------------------------------------------------------------------------

export interface AppStoreState {
  mode: AppMode;
  activeTab: TabId;
  objScope: ObjScope;
  exportScope: ExportScope;
  dividerMode: DividerMode;
  disabledItems: ItemKey[];
  isDirty: boolean;
  busyExport: boolean;
  statusMessage: string;
  klMessage: string;
  metadata: ProjectMetadata;
  values: Record<string, string>;
}

export interface WindowBridgeContract {
  downloadBlob: (filename: string, data: BlobPart | Uint8Array, mimeType: string) => void;
  exportXlsx: (scope: ExportScope) => Promise<void>;
  exportPdf: (scope: ExportScope) => Promise<void>;
  saveProjectJson: () => void;
  loadProjectJson: (rawJson: string) => ProjectSnapshot;
}
