/**
 * Internal and public TypeScript interfaces for the TuongChanL calculation,
 * geometry, rebar, seepage, slope stability, 3D shell / continuous FE, and 2D
 * FEM engine modules.
 *
 * Compatible with `src/types/project.ts` while accurately reflecting the exact
 * runtime structures emitted by the extracted TuongChanL solvers (`01`..`14`,
 * `16`, `25`, `26`).
 */

import type {
  AnchorConfig,
  AnchorGrid,
  BarDotCoord,
  BarShapeSpec,
  BarSpec,
  BarsResult,
  BeamConfig,
  CalcConfig,
  CalcRunResult,
  CapConfig,
  CfeResult,
  ConcreteQuantities,
  DecimalSeparator,
  DTabEntry,
  Fem2dOutput,
  FillMode,
  FormworkQuantities,
  GeomBeam,
  GeomData,
  GeomKey,
  GeomRibHyp,
  GeomRibSpan,
  KeCatalogEntry,
  KeyConfig,
  PaperSize,
  Point2D,
  Point3D,
  Project,
  PvcConfig,
  QuantitiesResult,
  RebarEntry,
  RebarMap,
  RibConfig,
  SlopeResult,
  TemplateId,
  WallType,
  WaterResult,
} from '../types/project.ts';

export type {
  AnchorConfig,
  AnchorGrid,
  BarDotCoord,
  BarShapeSpec,
  BarSpec,
  BarsResult,
  BeamConfig,
  CalcConfig,
  CalcRunResult as ProjectCalcRunResult,
  CapConfig,
  CfeResult,
  ConcreteQuantities,
  DecimalSeparator,
  DTabEntry,
  Fem2dOutput,
  FillMode,
  FormworkQuantities,
  GeomBeam,
  GeomData,
  GeomKey,
  GeomRibHyp,
  GeomRibSpan,
  KeCatalogEntry,
  KeyConfig,
  PaperSize,
  Point2D,
  Point3D,
  Project,
  PvcConfig,
  QuantitiesResult,
  RebarEntry,
  RebarMap,
  RibConfig,
  SlopeResult,
  TemplateId,
  WallType,
  WaterResult,
};

export type EngineCalcConfig = CalcConfig & {
  kb?: number;
  kf?: number;
};

export interface EngineProject extends Omit<Project, 'calc'> {
  calc?: EngineCalcConfig;
}

export interface EngineRebarEntry extends RebarEntry {
  d: number;
  a: number;
  ah?: number;
  n?: number;
  ng?: number;
  sp?: number;
  la?: number;
  cuts?: number[];
  on?: boolean;
}

export interface EngineKeTabEntry extends Omit<KeCatalogEntry, 'k'> {
  H: number;
  k?: number;
}

export interface EngineDTabEntry extends DTabEntry {
  sheet: string;
}

export type DRoleUiTuple = [mark: string, name: string];
export type EngineDRoleUiMap = Record<string, DRoleUiTuple>;

export interface FillParams {
  Hs: number;
  m: number;
  mode: string;
}

export interface EngineGeomData {
  t: number;
  B: number;
  yTop: number;
  xbb: number;
  xbt: number;
  xb: (y: number) => number;
  xf: (y: number) => number;
  xft: number;
  sf: boolean;
  key: GeomKey | null;
  beam: GeomBeam | null;
  cap: CapConfig | null;
  fil: number;
  xcap: number;
  dn: number;
  out: Point2D[];
  ribs: GeomRibSpan[];
  yR: number;
  hyp: GeomRibHyp | null;
  c: number;
  tH: number;
  topY: (x: number) => number;
  an: AnchorGrid | null;
  dxt: number;
}

export interface EngineCalcGeomData {
  B: number;
  Bs: number;
  eps: number;
  C0: Point2D;
  yF: number;
  yT: number;
  tb: number;
  xfb: number;
  xbb: number;
  xft: number;
  xbt: number;
  xf: (y: number) => number;
  xb: (y: number) => number;
  topF: (x: number) => number;
  yG: (x: number) => number;
  A: Point2D;
  T: Point2D;
  Hp: number;
  Gv: Point2D[];
  betaV: number;
  foot: Point2D[];
  stem: Point2D[];
  ev: Point2D[];
  Hst: number;
  tmean: number;
  back: Point2D[];
  hf: number;
  g0: EngineGeomData;
  front: Point2D[];
}

export interface EngineBarShapeSpec {
  pts: Point2D[];
  lens: number[];
  lab?: string | (string | null)[];
}

export interface EngineBarDiagLine {
  k?: number;
  A: Point2D;
  B: Point2D;
  len: number;
  bad?: number;
}

export type RingPointTuple = [x: number, y: number, nx: number, ny: number, vx?: number, vd?: number];

export interface EngineBarSpec {
  key: string;
  mark: number | string;
  name: string;
  d: number;
  pile?: boolean;
  a?: number;
  ah?: number;
  n?: number;
  path: Point2D[];
  items: number[];
  count?: number;
  totLen?: number;
  kg?: number;
  minL?: number;
  maxL?: number;
  pos?: number[];
  rows?: number[];
  cols?: number[];
  xs?: number[];
  xsT?: number[];
  zs?: number[];
  yl?: number;
  yu?: number;
  pts?: BarDotCoord[] | RingPointTuple[] | Point2D[];
  straight?: boolean;
  tie?: boolean;
  mirror?: boolean;
  dup?: boolean;
  cad?: boolean;
  per?: number;
  perBeam?: number;
  perRib?: number;
  grp?: number;
  ng?: number;
  P0?: Point2D;
  u?: Point2D;
  ys?: number;
  ok?: number | boolean;
  A?: AnchorGrid | Point2D;
  T?: Point2D;
  y?: number;
  y0?: number;
  yF?: number;
  yb?: number;
  xF?: number;
  xe?: ((y: number) => number) | number;
  hook?: number;
  xB?: ((y: number) => number) | number;
  zw?: number;
  xw?: number;
  hk?: number;
  zb?: number;
  b1d?: number;
  foot?: { A: Point2D; T: Point2D };
  diag?: EngineBarDiagLine[];
  ltb?: boolean;
  shapeKey?: string;
  pathShape?: boolean;
  shape?: EngineBarShapeSpec;
  _yb?: number;
  _ys?: number;
  _yc?: number;
}

export interface EngineCDots {
  d2: Point2D[];
  d5: Point2D[];
  d5a: Point2D[];
}

export interface EngineCBarsGeometry {
  c: number;
  yt1: number;
  y3: (x: number) => number;
  x7: (y: number) => number;
  hl: number;
  B: number;
  yT: number;
  l1: [Point2D, Point2D][];
  l9: [Point2D, Point2D][];
  xs10: number[];
  l10: [Point2D, Point2D][];
  p3: Point2D[];
  p4: Point2D[];
  p6: Point2D[];
  p7: Point2D[];
  p8: Point2D[];
  lv: number[];
  l16: [Point2D, Point2D][];
  xOf: (y: number) => number;
  yOf: (x: number) => number;
  p13: Point2D[];
  rows: number[];
  l12: [Point2D, Point2D][];
  xs11: number[];
  l11: [Point2D, Point2D][];
  ticks: Point2D[];
  dots?: EngineCDots;
  geo?: Record<string, { lines?: Point2D[][]; dots?: Point2D[] }>;
}

export interface EngineBarsResult {
  bars: EngineBarSpec[];
  warn: string[];
  g: EngineGeomData;
  edited?: boolean;
  cad?: boolean;
  G?: EngineCBarsGeometry;
  _list?: EngineBarSpec[];
}

export interface EngineKeyLayoutC {
  xl: number;
  xr: number;
  yb: number;
  rows: number[];
  ties: number[];
  a: number;
}

export interface EngineDLayers {
  yb1: number;
  ylo: number;
  yb2: number;
  yup: number;
  yf1: number;
  yf2: number;
}

export interface EngineRebarMap {
  sb: RebarEntry;
  sf: RebarEntry;
  fb: RebarEntry;
  ft: RebarEntry;
  hh: RebarEntry;
  ll: RebarEntry;
  path: {
    sb: string;
    sf: string;
    fb: string;
    ft: string;
    hh: string;
    ll: string;
  };
}

export interface EngineCalcInputParams {
  H: number;
  t: number;
  n1: number;
  n2: number;
  b1: number;
  b4: number;
  hm: number;
  ht: number;
  hh: number;
  hf: number;
  Hs: number;
  m: number;
  q: number;
  qL: number;
  LL: boolean;
  dT: number;
  dT0?: number;
  gs: number;
  phi: number;
  dw: number;
  dvA: boolean;
  dv: number;
  cs: number;
  gc: number;
  fc: number;
  fy: number;
  ag: number;
  ge: number;
  cov: number;
  covB: number;
  covT: number;
  sbd: number;
  sbs: number;
  sfd: number;
  sfs: number;
  fbd: number;
  fbs: number;
  ftd: number;
  fts: number;
  hd: number;
  hs: number;
  ld: number;
  ls: number;
  ift: string;
  soil: string;
  rock: boolean;
  gf: number;
  phif: number;
  cf: number;
  Su: number;
  Dw: number;
  brm: string;
  phib: number;
  Nspt: number;
  Ri: number;
  phibS: number;
  brmR: string;
  qu: number;
  RMR: number;
  rockT: string;
  phibR: number;
  qRu: number;
  phit: number;
  eta: number;
  cR: number;
  phiR: number;
  gR: number;
  aSl: string;
  aTv: number;
  wOn: boolean;
  hB: number;
  hF: number;
  wMode: string;
  gsat: number;
  gfs: number;
  Tn: number;
  kbx: number;
  kby: number;
  kfx: number;
  kfy: number;
  FSp: number;
  eqOn: boolean;
  eqA: number;
  eqKm: string;
  eqKh: number;
  eqKv: number;
  eqG: number;
  bsOn: boolean;
  bsT: number;
  bsPhiR: number;
  anc: boolean;
  aOT: boolean;
  ad: number;
  afy: number;
  aDh: number;
  atau: number;
  aLr: number;
  aLc: number;
  agf: number;
  as: number;
  aX: number[];
  amu: number;
  phs: number;
  php: number;
  extra?: EngineLoadItem[];
  [key: string]: unknown;
}

export interface EngineLoadItem {
  nm?: string;
  ty: string;
  Fx: number;
  Fy: number;
  x: number;
  y: number;
  sub?: string;
  A?: number;
  g?: number;
  dyn?: boolean;
  Lq?: number;
  Ll?: number;
  P?: number;
  qL?: boolean;
}

export interface EngineWaterPiping {
  icr: number;
  gpr: number;
  dH: number;
  FSreq: number;
  Df: number;
  kind: 'rock' | 'none' | 'prism' | 'avg';
  iavg: number;
  FS: number;
  ok: boolean;
  D?: number;
  wd?: number;
  dh?: number;
  imax?: number;
  sv?: number;
  Wp?: number;
  Uex?: number;
  Lc?: number;
}

export interface EngineWaterSeep {
  nx: number;
  ny: number;
  X: Float64Array;
  Y: Float64Array;
  xc: Float64Array;
  yc: Float64Array;
  wx: Float64Array;
  wy: Float64Array;
  solid: Uint8Array;
  H: Float64Array;
  nf: number;
  it: number;
  res: number;
  Qf: number;
  Qb: number;
  xs: number;
  hB: number;
  hF: number;
  hFtop: number;
  Tn: number;
  B: number;
  kbx: number;
  kby: number;
  kfx: number;
  kfy: number;
  headAt: (x: number, y: number) => number;
  uAt: (x: number, y: number, cap?: number) => number;
  ubHead: (x: number) => number;
  stream: () => Float64Array;
  level: (x: number) => number;
}

export interface EngineWaterResult {
  on: boolean;
  mode: 'hs' | 'fd';
  gw: number;
  B: number;
  Df: number;
  hB: number;
  hF: number;
  hFtop: number;
  hBraw: number;
  hFraw: number;
  gsat: number;
  gfs: number;
  Tn: number;
  kbx: number;
  kby: number;
  kfx: number;
  kfy: number;
  xs: number;
  warn: string[];
  dH: number;
  seep: EngineWaterSeep | null;
  head: (x: number, y: number, side?: string) => number;
  u: (x: number, y: number, side?: string) => number;
  ub: (x: number) => number;
  U: number;
  xU: number;
  uB: (y: number) => number;
  wt: { yw: number; gsat: number; u: (x: number, y: number) => number };
  back: { Fx: number; Fy: number; Mx: number; My: number };
  front: { Fx: number; Fy: number; Mx: number; My: number };
  L: EngineLoadItem[];
  pip: EngineWaterPiping;
}

export interface EngineCheckItem {
  id: string;
  t: string;
  v: number;
  ok: boolean;
  info?: boolean;
}

export interface EngineRebarCandidate {
  d: number;
  a: number;
  As: number;
  n?: number;
}

export interface EngineSuggestItem {
  id: string;
  title: string;
  path: string | null;
  cur: { d: number; a?: number; n?: number };
  ok: boolean;
  sug: { d: number; a?: number; n?: number; As?: number } | null;
  why: string;
}

export interface EngineFem2dStage {
  name: string;
  uTop: number;
  uToe: number;
  uHeel: number;
  pBase: Point2D[];
  thrust: number;
  pBack: Point2D[];
  nPlastic: number;
  Vbase: number;
}

export interface EngineFem2dMesh {
  nodes: Float64Array;
  tri: Int32Array;
  nno: number;
  nel: number;
  nlin: number;
  mat: Uint8Array;
  xlo: number;
  xhi: number;
  ybot: number;
  ymx: number;
  H: number;
  B: number;
  bPts: Point2D[];
  top: { y: number; dx: number }[];
  backX: number[];
}

export interface EngineFem2dResult {
  mesh: EngineFem2dMesh;
  Ux: Float64Array;
  Uy: Float64Array;
  sxx: Float64Array;
  syy: Float64Array;
  txy: Float64Array;
  epsP: Float64Array;
  stages: EngineFem2dStage[];
  FSsrm: number | null;
  srm: {
    F: number;
    ok: boolean;
    nrm: number;
    iters: number;
    du?: Float64Array;
    dEps?: Float64Array;
  } | null;
  mech?: {
    ok?: boolean;
    local?: boolean;
    nrm?: number;
    r?: number;
    y0?: number;
  };
  uMax: number;
  ms: number;
  opts: Record<string, unknown>;
}
