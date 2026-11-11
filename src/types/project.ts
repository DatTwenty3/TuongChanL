/**
 * TuongChanL Web App — Canonical TypeScript Contracts
 *
 * All property names preserve exact field-level parity with the extracted
 * TuongChanL safe engineering modules (`01`..`26`) for lossless `.tcl.json`
 * serialization and zero-guesswork integration across Solver, CAD/3D, Reports,
 * Exporters, and React UI modules.
 */

// ---------------------------------------------------------------------------
// 1. Core Project & `.tcl.json` Schema
// ---------------------------------------------------------------------------

export type Point2D = [number, number];
export type Point3D = [number, number, number];

export type WallType = 'canti' | 'rib';
export type TemplateId = 'B' | 'A' | 'C' | 'D';
export type PaperSize = 'A3' | 'A2' | 'A1' | 'A0';
export type DimLegMode = 'cut' | 'full';
export type FillMode = 'none' | 'flat' | '1' | '1.5';

export type SoilType = 'r' | 'd' | 'a';
export type InterfaceJointType = 'n' | 'r' | 'm';
export type BearingMethodSoil = 'lt' | 'spt' | 'kt';
export type BearingMethodRock = 'ck' | 'cp' | 'kt';
export type RockClass = 'A' | 'B' | 'C' | 'D' | 'E';
export type AnchorSlidingMode = 'fr' | 'dw';
export type AnchorBondMode = 'auto' | 'tay';
export type WaterMode = 'hs' | 'fd';
export type SeismicKMode = 'half' | 'full' | 'tay';
export type FeBasis = 'hand' | 'fe';
export type FemMeshDensity = 'n' | 'c';
export type DecimalSeparator = '.' | ',';

export interface CapConfig {
  w: number;
  hv: number;
  hs: number;
}

export interface BeamConfig {
  on: boolean;
  w: number;
  d: number;
}

export interface KeyConfig {
  on: boolean;
  w: number;
  d: number;
  dx: number;
  toeEnd?: boolean;
}

export interface AnchorConfig {
  on: boolean;
  d: number;
  a: number;
  L: number;
}

export interface RibConfig {
  t: number;
  gap: number;
  edge: number;
  drop: number;
  end?: number;
}

export interface PvcConfig {
  d: number;
  a: number;
}

export interface RebarEntry {
  d: number;
  a?: number;
  ah?: number;
  n?: number;
  ng?: number;
  sp?: number;
  la?: number;
  cuts?: number[];
  on?: boolean;
}

export type RebarMap = Record<string, RebarEntry>;

/**
 * Exact 96-key calculation parameter contract matching `calcDefaults()`
 * in `10_calc_orchestrator.js#L29-L128`.
 */
export interface CalcConfig {
  // Backfill & surcharge (10 keys)
  gs: number;
  phi: number;
  dw: number;
  dvA: boolean;
  dv: number;
  cs: number;
  q: number;
  LL: boolean;
  dT: number;
  qL: number;

  // Concrete, crack exposure, aggregate & joint interface (5 keys)
  gc: number;
  fc: number;
  ge: number;
  ag: number;
  ift: InterfaceJointType;

  // Foundation, bearing & rock properties (23 keys)
  soil: SoilType;
  gf: number;
  phif: number;
  cf: number;
  Su: number;
  Dw: number;
  hf: number;
  brm: BearingMethodSoil;
  phib: number;
  Nspt: number;
  Ri: number;
  phibS: number;
  brmR: BearingMethodRock;
  qu: number;
  RMR: number;
  rockT: RockClass;
  phibR: number;
  qRu: number;
  phit: number;
  eta: number;
  cR: number;
  phiR: number;
  gR: number;

  // Rock anchors (16 keys)
  anc: boolean;
  aOT: boolean;
  aSl: AnchorSlidingMode;
  aSlSet: boolean;
  aTv: number;
  ad: number;
  afy: number;
  aDh: number;
  tauA: AnchorBondMode;
  atau: number;
  aLr: number;
  aLc: number;
  agf: number;
  as: number;
  aX: string;
  amu: number;

  // Water & 2D seepage (12 keys)
  wOn: boolean;
  hB: number;
  hF: number;
  wMode: WaterMode;
  gsat: number;
  gfs: number;
  Tn: number;
  kbx: number;
  kby: number;
  kfx: number;
  kfy: number;
  FSp: number;

  // Seismic (6 keys)
  eqOn: boolean;
  eqA: number;
  eqKm: SeismicKMode;
  eqKh: number;
  eqKv: number;
  eqG: number;

  // Global slope & allowable safety factors (8 keys)
  bsOn: boolean;
  bsT: number;
  bsPhiR: number;
  fsSl: number;
  fsOt: number;
  fsGs: number;
  fsSlE: number;
  fsOtE: number;

  // 3D Shell / Continuous FE (3 keys)
  feOn: boolean;
  feBasis: FeBasis;
  feN: number;

  // 2D Plane-Strain FEM (7 keys)
  femOn: boolean;
  femMesh: FemMeshDensity;
  femSrm: boolean;
  femEb: number;
  femEf: number;
  femPsi: number;
  femLifts: number;

  // Report metadata & formatting (6 keys)
  pjName: string;
  pjItem: string;
  pjPlace: string;
  pjBy: string;
  pjDate: string;
  dec: DecimalSeparator;
}

/** Legacy `.tcl.json` calc input prior to `calcEnsure()` permeability migration. */
export type LegacyCalcConfigInput = Partial<CalcConfig> & {
  kb?: number;
  kf?: number;
};

// ---------------------------------------------------------------------------
// Móng cọc BTCT (mô đun tùy chọn, mở rộng – không có trong ứng dụng gốc)
// `Project.pile` chỉ tồn tại khi người dùng bật; vắng mặt = tắt hoàn toàn.
// Đơn vị: m, kN, kPa (khác với hình học tường tính bằng cm).
// ---------------------------------------------------------------------------

/** sq = vuông đúc sẵn; rc = tròn đặc đúc sẵn; phc = ly tâm ứng lực trước (rỗng); bored = khoan nhồi. */
export type PileType = 'sq' | 'rc' | 'phc' | 'bored';
export type PileMethod = 'tcvn' | 'spt' | 'test';
export type PileSoilKind = 'sand' | 'clay' | 'rock';
export type PileSandGrain = 'gravelly' | 'coarse' | 'medium' | 'fine' | 'silt';
export type PileClayType = 'sandy' | 'loam' | 'clay';

/** Một lớp đất, độ sâu tính từ đáy bản đáy (đáy đài) xuống. */
export interface PileSoilLayer {
  id: string;
  name: string;
  kind: PileSoilKind;
  /** Bề dày lớp (m). */
  thk: number;
  /** Trọng lượng riêng hữu hiệu (kN/m³) – người dùng nhập đã kể đẩy nổi nếu dưới mực nước. */
  gamma: number;
  /** Lực dính c (kPa). */
  c: number;
  /** Góc ma sát trong φ (độ). */
  phi: number;
  /** Cường độ kháng cắt không thoát nước Su (kPa). */
  Su: number;
  /** Độ sệt IL (đất dính). */
  IL: number;
  /** Chỉ số SPT N. */
  N: number;
  /** Mô đun biến dạng E (MPa). */
  E: number;
  /** Loại hạt của đất rời (tra Bảng 2 / 3 của TCVN 10304:2025). */
  grain: PileSandGrain;
  /** Loại đất dính (tra Bảng 6 khi cọc khoan nhồi): cát pha / sét pha / sét. */
  clayType: PileClayType;
  /** Hệ số hiệu chỉnh fi theo Chú thích của Bảng 3 (ví dụ cát chặt: 1,30); mặc định 1. */
  kf: number;
  /** Hệ số hiệu chỉnh qb theo Chú thích của Bảng 2; mặc định 1. */
  kb: number;
  /** Hệ số nền ngang K (kN/m⁴) – dùng cho cọc chịu tải ngang; null = chưa nhập. */
  K: number | null;
}

/** Lồng thép cọc do người dùng nhập (cọc vuông đúc sẵn / khoan nhồi). Cọc ly tâm là sản phẩm chế tạo sẵn nên không có lồng thép rời. */
export interface PileCage {
  /** Số thanh thép dọc chủ. */
  nMain: number;
  /** Đường kính thép dọc (mm). */
  dMain: number;
  /** Đường kính thép đai / xoắn (mm). */
  dHoop: number;
  /** Bước đai ở hai đầu cọc (m). */
  sEnd: number;
  /** Bước đai ở đoạn giữa cọc (m). */
  sMid: number;
  /** Chiều dài vùng đai dày ở mỗi đầu cọc (m). */
  Lend: number;
  /** Chiều dài móc neo mỗi đai (mm), cộng thêm vào chiều dài đai. */
  hook: number;
}

export type PileStructClass = 'C1' | 'C2' | 'C3';
export type PileInstallDriven = 'hammer' | 'press' | 'custom';
export type PileBoredMethod = 'cast' | 'vibro' | 'dry' | 'wet' | 'dryHard' | 'barrette';
export type PileTestKind = 'static' | 'dynElastic' | 'dynNoElastic';

/** Thông số tính sức chịu tải cọc theo TCVN 10304:2025. */
export interface PileDesign {
  /** Cấp hậu quả của công trình → γn = 1,0 / 1,15 / 1,20 (Điều 7.1.6.1). */
  cls: PileStructClass;
  /** Độ sâu đáy đài so với mặt đất tự nhiên / quy hoạch (m); bảng tra tính độ sâu từ mặt đất này. */
  z0: number;
  /** Phương pháp hạ cọc đóng / ép (Bảng 4). */
  install: PileInstallDriven;
  /** γR,R và γR,f khi `install === 'custom'`. */
  gRR: number;
  gRf: number;
  /** Phương pháp thi công cọc khoan nhồi (Bảng 6). */
  bored: PileBoredMethod;
  /** Mũi cọc tựa đất loại sét có độ bão hòa Sr < 0,85 → γc = 0,8 (Điều 7.2.3.1). */
  srLow: boolean;
  /** Cọc ly tâm có mũi thép kín (η = 1; không xét hiệu ứng mũi hở). */
  tipClosed: boolean;
  /** Kể trọng lượng bản thân cọc vào tải tác dụng lên cọc (Chú thích 2, Điều 7.1.6.1). */
  selfWeight: boolean;
  /** Loại thí nghiệm khi `method === 'test'` (quyết định γk). */
  testKind: PileTestKind;
}

export interface PileConfig {
  on: boolean;
  type: PileType;
  /** Cạnh (cọc vuông) hoặc đường kính ngoài (ly tâm / khoan nhồi), m. */
  size: number;
  /** Bề dày thành ống (ly tâm), m; 0 = đặc. */
  wall: number;
  /** Chiều dài cọc dưới đáy đài (m). */
  L: number;
  /** Đoạn cọc ngàm vào đài (m). */
  embed: number;
  concrete: string;
  steel: string;
  /** Lớp bê tông bảo vệ (mm). */
  cover: number;

  /** Số hàng cọc theo phương ngang bản đáy (mũi → gót). */
  nx: number;
  /** Khoảng cách giữa các hàng (m). */
  sx: number;
  /** Căn hàng cọc vào giữa bề rộng bản đáy; false = bắt đầu từ `x0`. */
  centered: boolean;
  /** Khoảng cách từ mép mũi bản đáy đến hàng đầu tiên (m) khi không căn giữa. */
  x0: number;
  /** Bước cọc dọc theo chiều dài tường (m). */
  sy: number;
  /** Bố trí so le giữa các hàng. */
  stagger: boolean;

  cage: PileCage;
  layers: PileSoilLayer[];
  method: PileMethod;
  /** Sức chịu tải giới hạn một cọc từ thí nghiệm (kN) khi `method === 'test'`. */
  Qtest: number | null;
  design: PileDesign;

  /** Khi bật cọc: kiểm tra sức kháng nền nông / trượt đáy móng chỉ mang tính tham khảo. */
  ignoreShallow: boolean;
}

/** Root retaining wall project model (cross-section units in `cm`, diameters in `mm`). */
export interface Project {
  name: string;
  title: string;
  company: string;
  client: string;
  designer: string;
  checker: string;
  date: string;
  concrete: string;
  steel: string;
  paper: PaperSize;
  scale: number;
  cover: number;
  tBlind: number;
  blindOn: boolean;
  formEnds?: boolean;
  /** Mẫu 3: ghi chiều cao thân H (từ mặt bản đáy) trên kích thước thay vì "tổng − bề dày mút". Vắng mặt = như bản gốc. */
  dimStem?: boolean;
  dimLeg: DimLegMode;
  labelUnit: string;
  labelFmt: string;
  fillMode: FillMode;
  fillH: number;

  type: WallType;
  tpl: TemplateId;
  slopeFront?: boolean;

  H: number;
  tst: number;
  tsb: number;
  toe: number;
  heel: number;
  tBase: number;
  tTip: number;
  tTipH?: number;
  toeFlat?: number;
  haunch?: number;
  Lu: number;

  // Template B CAD signature locks
  n5cad?: number;
  n5sig?: string;
  tieCad?: number[];
  tieB?: number;

  // Template A detailing
  fil?: number;
  cap?: CapConfig;
  beam?: BeamConfig;

  // Template C catalog tracking
  keIdx?: number;
  keId?: string;

  // Template D detailing & catalog tracking
  dIdx?: number;
  vtop?: number;
  pvc?: PvcConfig;

  key: KeyConfig;
  anc: AnchorConfig;
  rib: RibConfig;
  rb: RebarMap;
  calc?: CalcConfig;
  /** Móng cọc BTCT (tùy chọn). Vắng mặt = không dùng cọc. */
  pile?: PileConfig;
}

export interface ProjectFileEnvelope {
  app: 'tuong-chan-L';
  v: 1;
  p: Partial<Omit<Project, 'calc'>> & {
    tpl?: TemplateId;
    calc?: LegacyCalcConfigInput;
  };
}

// ---------------------------------------------------------------------------
// 2. Preset Catalog Tables (`01`, `04`, `05`)
// ---------------------------------------------------------------------------

/** `[toe, tsb, heel, tst, tBase, tTip, keyW, keyD]` in cm. */
export type CantiDimTuple = [number, number, number, number, number, number, number, number];
/** `[s1, s2, b1, b2, distrib(h1/l1/t1), k1]` in mm. */
export type CantiRebTuple = [number, number, number, number, number, number];

export interface KeCatalogEntry {
  id: string;
  H: number;
  tb: number;
  te: number;
  ts: number;
  hl: number;
  toe: number;
  Lu: number;
  k: number;
  d: Record<string, number>;
  c: Record<string, [number, number]>;
}

export interface DTabEntry {
  id: string;
  H: number;
  slab: number;
  B: number;
  Lu: number;
  ribH: number;
  pvc: [number, number];
  rb: Record<string, [number, number]>;
}

export interface DRoleUiEntry {
  k: string;
  mk: string;
  nm: string;
  noA?: boolean;
}

// ---------------------------------------------------------------------------
// 3. Derived Geometry, Rebar & Quantity Takeoff (`01`, `03`, `04`, `05`)
// ---------------------------------------------------------------------------

export interface AnchorGrid {
  xs: number[];
  zs: number[];
  a: number;
  L: number;
  Lc: number;
  Lb: number;
  tMin: number;
}

export interface GeomKey {
  x0: number;
  x1: number;
  d: number;
  xc: number;
  toe: boolean;
}

export interface GeomBeam {
  w: number;
  d: number;
}

export interface GeomRibSpan {
  x0: number;
  x1: number;
}

export interface GeomRibHyp {
  T: Point2D;
  E: Point2D;
  tri: Point2D[];
}

export interface GeomData {
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

export interface BarShapeSpec {
  pts: Point2D[];
  lens: number[];
  lab?: string;
}

export interface BarDiagLine {
  A: Point2D;
  B: Point2D;
  bad?: number;
}

export interface BarDotCoord {
  x: number;
  y: number;
  beam?: number;
}

export interface BarSpec {
  key: string;
  mark: number | string;
  name: string;
  d: number;
  a?: number;
  ah?: number;
  path: Point2D[];
  items: number[];
  count: number;
  /** Thanh thép của cọc (không thuộc 1 m dài tường). */
  pile?: boolean;

  // Computed by quantities() & barList()
  totLen?: number;
  kg?: number;
  minL?: number;
  maxL?: number;

  // Layout/geometry fields emitted by buildBarsB/C/D/G
  pos?: number[];
  rows?: number[];
  cols?: number[];
  xs?: number[];
  zs?: number[];
  yl?: number;
  yu?: number;
  pts?: BarDotCoord[];
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
  ok?: boolean;
  A?: AnchorGrid;
  T?: Point2D;
  y?: number;
  y0?: number;
  yF?: number;
  xF?: number;
  xe?: number;
  hook?: number;
  xB?: number;
  diag?: BarDiagLine[];
  ltb?: boolean;
  shapeKey?: string;
  shape?: BarShapeSpec;
  _yb?: number;
  _ys?: number;
  _yc?: number;
}

export interface BarsResult {
  bars: BarSpec[];
  warn: string[];
  g: GeomData;
  edited?: boolean;
  G?: Record<string, unknown>;
  _list?: BarSpec[];
}

export interface ConcreteQuantities {
  foot: number;
  stem: number;
  key: number;
  rib: number;
  tot: number;
}

export interface FormworkQuantities {
  foot: number;
  stem: number;
  rib: number;
  ends: boolean;
  tot: number;
}

export interface DiameterQuantity {
  len: number;
  kg: number;
}

/** Khối lượng móng cọc – chỉ có khi bật móng cọc. */
export interface PileQuantities {
  /** Số cọc trong một đơn nguyên. */
  n: number;
  /** Thể tích bê tông một cọc (m³), phần dưới đáy đài. */
  volEach: number;
  /** Tổng thể tích bê tông cọc (m³). */
  vol: number;
  /** Tổng chiều dài cọc (m). */
  totLen: number;
  /** Khối lượng thép cọc (kg), đã nằm trong `totKg`. */
  steelKg: number;
}

export interface QuantitiesResult {
  vol: number;
  conc: ConcreteQuantities;
  blind: number;
  form: FormworkQuantities;
  byD: Record<number, DiameterQuantity>;
  totKg: number;
  ratio: number;
  /** Chỉ có khi bật móng cọc. */
  pile?: PileQuantities;
}

// ---------------------------------------------------------------------------
// 4. 2D CAD Drafting, 5-Sheet Builder & Vector/CSV Exports (`02`, `03`, `04`, `06`)
// ---------------------------------------------------------------------------

export type CadLayerId =
  | 'OUT'
  | 'THIN'
  | 'HID'
  | 'AXIS'
  | 'DIM'
  | 'NOTE'
  | 'CDO'
  | 'LBL'
  | 'LEAD'
  | 'SEC'
  | 'COV'
  | 'REB'
  | 'RDOT'
  | 'RDOTW'
  | 'REB2'
  | 'CDTK'
  | 'TBL';

export type CadLinetype = 'C' | 'D' | 'X';

export interface CadLayerDef {
  n: string;
  c: string;
  cl: string;
  ac: number;
  lw: number;
  lt?: CadLinetype;
}

export interface DimStyle {
  exo: number;
  exe: number;
  asz: number;
  gap: number;
  txt: number;
  wf: number;
  cut: number;
}

export interface CadLineEntity {
  k: 'L';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  ly: CadLayerId;
  dm?: number;
}

export interface CadPolylineEntity {
  k: 'P';
  pts: Point2D[];
  ly: CadLayerId;
  closed: boolean;
  w: number;
  dm?: number;
}

export interface CadCircleEntity {
  k: 'C';
  x: number;
  y: number;
  r: number;
  ly: CadLayerId;
  fill: boolean;
  rMin?: number;
  dm?: number;
}

export interface CadArrowEntity {
  k: 'A';
  x: number;
  y: number;
  ux: number;
  uy: number;
  len: number;
  wid: number;
  ly: CadLayerId;
  dm?: number;
}

export interface CadTextEntity {
  k: 'T';
  x: number;
  y: number;
  s: string;
  h: number;
  ly: CadLayerId;
  al: 'l' | 'c' | 'r';
  va: 'b' | 'm' | 't';
  rot: number;
  bold: boolean;
  halo: boolean;
  wf: number;
  col: number;
  dm?: number;
}

export interface CadDimEntity {
  k: 'DM';
  id: number;
  a: Point2D;
  b: Point2D;
  dl: Point2D;
  tm: Point2D;
  typ: number;
  ang: number;
  ly: CadLayerId;
  txt?: string;
}

export type CadEntity =
  | CadLineEntity
  | CadPolylineEntity
  | CadCircleEntity
  | CadArrowEntity
  | CadTextEntity
  | CadDimEntity;

export interface CadBBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  w: number;
  h: number;
}

export interface CadEntsBuffer {
  a: CadEntity[];
  lbl: CadBBox[];
  dz?: CadBBox[];
  chn?: CadBBox[];
  lgs?: CadBBox[];
  tbx?: CadBBox[];
  bbox: () => CadBBox;
}

export interface CadContext {
  S: number;
  mm: (v: number) => number;
  dst: DimStyle;
  legFull: boolean;
  geoHit: boolean;
  tplA: boolean;
  tang: boolean;
  dotLy: CadLayerId;
  rDot: number;
  rCap: number;
}

export interface CadSheet {
  E: CadEntsBuffer;
  W: number;
  H: number;
  S: number;
  fits: boolean;
  name: string;
  noScale: boolean;
  dst: DimStyle;
}

export interface CadSheetDef {
  name: string;
  noScale?: boolean;
  views: (p: Project, res: BarsResult, q: QuantitiesResult, ctx: CadContext) => CadEntsBuffer[];
}

export interface CadViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ToSvgOptions {
  theme?: 'dark' | 'light';
  w?: string | number;
  h?: string | number;
}

export interface ToDxfOptions {
  gapMm?: number;
}

export interface CadCache {
  res: BarsResult;
  q: QuantitiesResult;
  sheets: (CadSheet | null)[];
  S: number;
}

// ---------------------------------------------------------------------------
// 5. 3D Mesh & WebGL Interactive Viewer (`23`, `24`)
// ---------------------------------------------------------------------------

export interface M3MeshData {
  p: number[];
  n: number[];
  i: number[];
  l: number[];
}

export interface M3TubeRange {
  ci: number;
  i0: number;
  n: number;
}

export interface M3TubeChunk {
  v: number[];
  i: number[];
  nv: number;
  vb?: WebGLBuffer | null;
  ib?: WebGLBuffer | null;
  n?: number;
}

export interface M3BarGroup {
  id?: string;
  key: string;
  mark: string | number;
  name: string;
  d: number;
  R?: number;
  count: number;
  kg?: number;
  per?: number;
  note?: string;
  bs: BarSpec[];
  bars: Point3D[][];
  chunks?: M3TubeChunk[];
  ranges?: (M3TubeRange | null)[];
  segs?: number[];
  segBar?: number[];
}

export interface Model3DBBox {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
}

export interface Model3DGpuMesh {
  vb: WebGLBuffer | null;
  ib: WebGLBuffer | null;
  n: number;
  lb: WebGLBuffer | null;
  nl: number;
}

/** Một khối đất của nền (theo lớp địa tầng hoặc lớp đất phủ mặt) – chỉ để hiển thị 3D. */
export interface Model3DGroundPart {
  id: string;
  name: string;
  kind: 'strata' | 'cover';
  color: [number, number, number];
  /** Loại / trạng thái đất (vd. "Sét dẻo cứng"). */
  kindText: string;
  /** Các chỉ tiêu hiển thị trong chú giải (vd. "γ = 18 kN/m³"). */
  props: string[];
  /** Kiểu bề mặt vật liệu (quyết định hoa văn shader). */
  look: 'sand' | 'clay' | 'mud' | 'rock';
  mesh: M3MeshData;
  /** Cao độ trên / dưới của khối (cm, đáy bản đáy = 0). */
  y0: number;
  y1: number;
}

export interface Model3DGpuBuffers {
  conc: Model3DGpuMesh;
  lean: Model3DGpuMesh;
  soil: Model3DGpuMesh;
  /** Chỉ có khi bật móng cọc. */
  pile?: Model3DGpuMesh;
  /** Song song với `Model3DData.ground`. */
  ground?: Model3DGpuMesh[];
  grid: { lb: WebGLBuffer | null; nl: number };
}

export interface Model3DData {
  conc: M3MeshData;
  lean: M3MeshData;
  soil: M3MeshData;
  /** Khối bê tông cọc – chỉ có khi bật móng cọc. */
  pile?: M3MeshData;
  /** Các khối đất nền theo lớp (hiển thị 3D). */
  ground?: Model3DGroundPart[];
  groups: M3BarGroup[];
  bbox: Model3DBBox;
  sig: string;
  gpu?: Model3DGpuBuffers;
}

export interface V3Visibility {
  conc: boolean;
  edges: boolean;
  blind: boolean;
  soil: boolean;
  /** Đất nền theo địa tầng. */
  strata: boolean;
  /** Nhãn chú thích lớp đất chĩa ra từ mô hình. */
  labels: boolean;
  grid: boolean;
  rebar: boolean;
}

export interface V3CameraState {
  tx: number;
  ty: number;
  tz: number;
  dist: number;
  yaw: number;
  pitch: number;
  ortho: boolean;
}

export interface V3ClipState {
  axis: '' | 'x' | 'y' | 'z';
  t: number;
  flip: boolean;
}

export type V3ColorMode = 'mark' | 'cad';
export type V3ViewPresetId = 'back' | 'front' | 'sect' | 'elev' | 'rear' | 'top';

export interface V3HoverHit {
  id: string;
  gr: M3BarGroup;
  bi: number;
  r: M3TubeRange | null;
  z: number;
}

export interface V3State {
  ok: boolean;
  inited: boolean;
  vis: V3Visibility;
  hidden: Set<string>;
  focus: string | null;
  hover: V3HoverHit | null;
  cam: V3CameraState;
  fov: number;
  alpha: number;
  kd: number;
  colorMode: V3ColorMode;
  clip: V3ClipState;
  model: Model3DData | null;
  sig: string;
  raf: number;
  mouse: { x: number; y: number } | null;
  stale: boolean;
}

// ---------------------------------------------------------------------------
// 6. TCVN 11823:2017 Engineering Solvers, Water, Slope, FE3D/CFE, FEM2D
// ---------------------------------------------------------------------------

export interface CalcFillParams {
  Hs: number;
  m: number;
  mode: FillMode;
}

export interface CalcGeomMeterData {
  k: number;
  B: number;
  yT: number;
  yF: number;
  Hst: number;
  As: number;
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
  Hs: number;
  m: number;
  betaV: number;
  Gv: Point2D[];
  out: Point2D[];
  foot: Point2D[];
  stem: Point2D[];
  ev: Point2D[];
  back: Point2D[];
  front: Point2D[];
  tmean: number;
  P: Project;
  g0: GeomData;
}

export interface CalcProportionResult {
  B: number;
  H: number;
  toe: number;
  rB: number;
  rT: number;
  okB: boolean;
  okT: boolean;
  light: boolean;
}

export interface CalcInputParams extends Omit<CalcConfig, 'fc'> {
  fc: number;
  fy: number;
  cov: number;
  covT: number;
  covB: number;
  rock: boolean;
  ht: number;
  hm: number;
  Hs: number;
  m: number;
  dT0: number;
  sd: number;
  sa: number;
  fd: number;
  fa: number;
  td: number;
  ta: number;
  hd: number;
  hs: number;
  ld: number;
  ls: number;
  s1o?: RebarEntry;
  s2o?: RebarEntry;
  b1o?: RebarEntry;
  b2o?: RebarEntry;
  h1o?: RebarEntry;
  l1o?: RebarEntry;
  g0: GeomData;
}

export interface SeepGridResult {
  X: number[];
  Y: number[];
  xc: number[];
  yc: number[];
  nx: number;
  ny: number;
  H: Float64Array;
  fl: Uint8Array;
  solid: Uint8Array;
  Qf: number;
  Qb: number;
  hMin: number;
  hMax: number;
  iters: number;
  res: number;
  psi?: Float64Array | null;
  headAt: (x: number, y: number) => number;
  uAt: (x: number, y: number, cap?: number) => number;
  ubHead: (x: number) => number;
  level: (x: number) => number;
  stream: () => Float64Array;
}

export interface PipingCheckResult {
  kind: 'rock' | 'none' | 'prism' | 'avg';
  FS: number;
  FSreq: number;
  ok: boolean;
  icr?: number;
  iavg?: number;
  imax?: number;
  Lc?: number;
  Wp?: number;
  Uex?: number;
  dh?: number;
  D?: number;
  wd?: number;
  dH?: number;
}

export interface WaterLoadVector {
  Fx: number;
  Fy: number;
  x: number;
  y: number;
  sub: 'back' | 'uplift' | 'front';
  nm?: string;
}

export interface WaterResult {
  wOn: boolean;
  mode: WaterMode;
  hB: number;
  hBraw: number;
  hF: number;
  hFtop: number;
  Df: number;
  xs: number;
  warn: string[];
  seep: SeepGridResult | null;
  U: number;
  xU: number;
  head: (x: number, y: number, side?: 'B' | 'F') => number;
  u: (x: number, y: number, side?: 'B' | 'F') => number;
  ub: (x: number) => number;
  L: WaterLoadVector[];
  pip: PipingCheckResult;
}

export interface SlopeSlice {
  x: number;
  dx: number;
  yb: number;
  yt: number;
  W: number;
  u: number;
  alpha: number;
  c: number;
  phi: number;
  sinA: number;
  cosA: number;
  zone: string;
}

export interface SlopeCircle {
  xc: number;
  yc: number;
  R: number;
  xL: number;
  xR: number;
  ylow: number;
  FS: number;
  slices?: SlopeSlice[];
}

export interface SlopeResult {
  FS: number;
  FSreq: number;
  ok: boolean;
  none?: boolean;
  best: SlopeCircle | null;
  T: number;
  phiR: number;
  ms?: number;
  nTried?: number;
  reason?: string;
}

export interface RcLayerSpec {
  As: number;
  ds: number;
  s: number;
  dcc: number;
  d: number;
}

export interface RcStirrupSpec {
  s: number;
  d: number;
  n: number;
  Av?: number;
}

export interface RcSectionSpec {
  b: number;
  h: number;
  f1: RcLayerSpec;
  f2: RcLayerSpec;
  st: RcStirrupSpec;
}

export interface RcMaterialProps {
  fc: number;
  fy: number;
  fu: number;
  wc: number;
  Ec: number;
  fr: number;
  a1: number;
  b1: number;
  ecl: number;
  etl: number;
  g1: number;
  g3: number;
  ge: number;
  ag: number;
}

export type RcLimitState = 'CD' | 'DB' | 'SD';

export interface RcLoadCase {
  id: string;
  st: RcLimitState;
  M: number;
  V: number;
  N: number;
}

export interface RcFlexResult {
  Mn: number;
  phi: number;
  c: number;
  a: number;
  et: number;
  fs: number;
  fsc: number;
  Cc: number;
  ylim: boolean;
  pos: boolean;
}

export interface RcCrackResult {
  sb: number;
  smax: number;
  fct: number;
  fr: number;
  need: boolean;
  ok: boolean;
  fss: number;
  k: number;
  j: number;
}

export interface RcShearResult {
  dv: number;
  es: number;
  beta: number;
  theta: number;
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

export interface RcComboRow extends RcLoadCase {
  fl: RcFlexResult;
  phi: number;
  Mr: number;
  rM: number;
  sh: RcShearResult;
  rV: number;
}

export interface RcMinReinforcementResult {
  Mcr: number;
  Mu: number;
  lim: number;
  Mr: number;
  ok: boolean;
  id: string;
}

export interface RcRunResult {
  rows: RcComboRow[];
  gM: RcComboRow;
  gV: RcComboRow;
  gS: RcComboRow | null;
  minR: RcMinReinforcementResult | null;
  cr: RcCrackResult | null;
  Ag: number;
  Ig: number;
  Sg: number;
}

export interface CalcIfaceResult {
  Acv: number;
  Avf: number;
  Avmin: number;
  Vu: number;
  Vn: number;
  Vr: number;
  Ve: number;
  mu: number;
  c: number;
  Pc: number;
  ok: boolean;
  okMin: boolean;
}

export interface CalcShrinkResult {
  b: number;
  h: number;
  As: number;
  req: number;
  s: number;
  smax: number;
  ok: boolean;
  okA?: boolean;
  okS?: boolean;
}

export interface CalcGlobalComboResult {
  k: string;
  nm: string;
  sd?: boolean;
  ev?: boolean;
  N: number;
  Hd: number;
  M: number;
  e: number;
  eLim: number;
  s: number;
  okE: boolean;
  okE0?: boolean;
  sl: {
    Rt: number;
    RR: number;
    Ra?: number;
    ok: boolean;
  };
  br: {
    qn: number | null;
    qR: number;
    ok?: boolean;
  };
  pr: {
    q1: number;
    q2: number;
    qmax: number;
    qmin: number;
    sigU: number;
    sigMax: number;
    Bp: number;
    tri: boolean;
  };
  sigB: number;
  okB: boolean;
  an?: {
    rows: unknown[];
    nAct: number;
    sum: number;
    M0: number;
    e: number;
    ok: boolean;
    qmax?: number;
  } | null;
}

export interface CalcStemResult {
  Sb: RcSectionSpec;
  Ib: { M: number; Q: number; N: number };
  SD: { M: number; Q: number; N: number };
  UE?: { M: number; Q: number; N: number } | null;
  Ea?: { M: number; Q: number; N: number } | null;
  Eb?: { M: number; Q: number; N: number } | null;
  rc: RcRunResult;
}

export interface CalcFootResult {
  U: { M: number; V: number; k?: string };
  SD: { M: number; V: number; k?: string };
  UE?: { M: number; V: number; k?: string } | null;
  rc: RcRunResult;
}

export interface Fe3dElemResult {
  Mxx: number;
  Myy: number;
  Mxy: number;
  Qx: number;
  Qy: number;
  Nxx: number;
  Nyy: number;
  Nxy: number;
}

export interface Fe3dSectionResult {
  id: string;
  name: string;
  part: string;
  util: number;
  ok: boolean;
  rib?: boolean;
  y?: number;
  sgn: number;
  rc?: RcRunResult;
  S?: RcSectionSpec;
  cap?: number;
  per: Record<string, { M: number; V: number; N: number }>;
  hand?: { M: number; V: number; N: number } | null;
  cd?: { M: number; V: number; N: number };
  ee?: { M: number; V: number; N: number } | null;
}

export interface CfeRibProfile {
  y: number[];
  Mu: number[];
  Ms: number[];
  Me: number[];
  Vu: number[];
  Vs: number[];
  Ve: number[];
}

export interface CfeResult {
  ok: boolean;
  err?: string;
  basis?: FeBasis;
  ribbed?: boolean;
  mesh?: {
    nodes: number;
    elems: number;
    nz: number;
    ny: number;
    Lu: number;
    dof: number;
  };
  combos?: Array<{
    k: string;
    nm: string;
    sd?: boolean;
    ev?: boolean;
    N: number;
    H: number;
    s: number;
    e: number;
    Lc: number;
    Rpin: number;
    q1: number;
    q2: number;
  }>;
  secRaw?: Fe3dSectionResult[];
  sec?: Fe3dSectionResult[];
  prof?: CfeRibProfile | null;
  profK?: CfeRibProfile | null;
  kfe?: number;
  util?: number;
  ms?: number;
  secNo?: number;
  M?: {
    EL: Array<{ part?: string; xc?: number[]; p?: number[] } | null>;
    nodes?: Point3D[];
    quads?: number[][];
  };
  res?: Array<{
    k: string;
    nm?: string;
    rf: Fe3dElemResult[];
    pr?: { q1: number; q2: number; qmax: number; qmin: number };
  }>;
  LC?: Record<string, unknown>;
}

export interface Fem2dWaterGrid {
  X: number[];
  Y: number[];
  H: number[];
  hB: number;
  hF: number;
  hFtop: number;
  xs: number;
  gw: number;
  Tn: number;
}

export interface Fem2dWaterInline {
  hB: number;
  hF: number;
  hFtop: number;
  Tn: number;
  k: [number, number, number, number];
  g: [number, number];
}

export interface Fem2dOpts {
  coarse: boolean;
  lifts: number;
  psi: number;
  noSrm: boolean;
  E: { back: number; found?: number };
  raw: boolean;
  water?: Fem2dWaterGrid | Fem2dWaterInline | null;
  srmEq?: boolean;
  Fmax?: number;
  srmIt?: number;
  debug?: boolean;
}

export interface Fem2dPackInput {
  I: Record<string, unknown>;
  g: Record<string, unknown>;
  Ec: number;
  E: { kh: number; kv: number } | null;
  opt: Fem2dOpts;
}

export interface Fem2dStageResult {
  id: string;
  name: string;
  ok: boolean;
  uTop: Point2D;
  uToe: Point2D;
  uHeel: Point2D;
  pBase: number[];
  pBack: number[];
  thrust: number;
  maxIt?: number;
}

export interface Fem2dMesh {
  nodes: Point2D[];
  tris: number[][];
  mat: number[];
  nx: number;
  ny: number;
}

export interface Fem2dOutput {
  ok: boolean;
  FSsrm: number | null;
  stages: Fem2dStageResult[];
  mesh: Fem2dMesh;
  u: Point2D[];
  uT: Point2D[];
  plastic: Point2D[];
  uSRM: Point2D[];
  lvl: number[];
  lvg: number[];
  water: unknown;
  time_ms: number;
  notes: string[];
  warn: string[];
  mech: { w: number; h: number; local: boolean } | null;
  umax: { v: number; x: number; y: number };
  mats: Array<{
    E: number;
    nu: number;
    c: number;
    phi: number;
    psi: number;
    gam: number;
    K0: number;
    el: boolean;
  }>;
  model: {
    rock: boolean;
    clay: boolean;
    H: number;
    B: number;
    Df: number;
    Lf: number;
    Lb: number;
    Dd: number;
    kh: number;
    kv: number;
    q: number;
  };
  info: {
    ne: number;
    nn: number;
    neq: number;
    nfac: number;
    hw: number;
    srmTrials: number;
    srmIt: number;
    Dd: number;
    Lf: number;
  };
  figs?: { plastic: string } | null;
}

export interface Fem2dWorkerRequest {
  id: number;
  m: Fem2dPackInput;
}

export interface Fem2dWorkerResponse {
  id: number;
  out?: Fem2dOutput;
  err?: string;
}

export interface Fem2dCacheState {
  key: string;
  ekey: string;
  out: Fem2dOutput | null;
  err: string;
  tpl: string;
  busy: boolean;
  t0: number;
  ms: number;
  nth: number;
  secNo?: number;
}

export interface GsClassicState {
  N: number;
  H: number;
  Rt: number;
  Ra: number;
  RR: number;
  Mr: number;
  Mo: number;
  Fsl: number;
  Fot: number;
  eq: boolean;
}

export interface GsRowItem {
  id: string;
  nm: string;
  how: string;
  fs: number | null;
  req: number;
  ok: boolean | null;
  info?: boolean;
  note?: string;
}

export interface GsRunOutput {
  key: string;
  ms: number;
  err: string;
  seep: SeepGridResult | null;
  bishop: SlopeResult | null;
}

export interface GsSummaryResult {
  rows: GsRowItem[];
  ok: boolean | null;
  complete: boolean;
  miss: GsRowItem[];
  cl: { sd: GsClassicState; eq: GsClassicState | null } | null;
  go: GsRunOutput | null;
  fo: Fem2dOutput | null;
}

export type CalcCheckId =
  | 'e'
  | 'sl'
  | 'br'
  | 'an'
  | 'pip'
  | 'slope'
  | 'stem'
  | 'ifc'
  | 'rib'
  | 'tie'
  | 'toe'
  | 'heel'
  | 'sh'
  | 'fe';

export interface CalcCheckItem {
  id: CalcCheckId | string;
  t: string;
  v: number;
  ok: boolean;
  info?: boolean;
}

export interface RebarSuggestEntry {
  d: number;
  a?: number;
  n?: number;
}

export interface RebarSuggestItem {
  id: string;
  title: string;
  path: string;
  cur: RebarSuggestEntry;
  ok: boolean;
  sug: RebarSuggestEntry | null;
  why: string;
}

export interface CalcRunOkMap {
  e: boolean;
  sl: boolean;
  br: boolean;
  stem: boolean;
  toe: boolean;
  heel: boolean;
  ifc?: boolean;
  rib?: boolean;
  tie?: boolean;
  sh: boolean;
  an: boolean;
  pip?: boolean;
  slope?: boolean;
  fe?: boolean;
  all: boolean;
}

export interface CalcRunBaseResult {
  P: Project;
  I: CalcInputParams;
  g: CalcGeomMeterData;
  M: RcMaterialProps;
  Ld: { L: unknown[]; [k: string]: unknown };
  C: CalcGlobalComboResult[];
  Ia: CalcGlobalComboResult;
  Ib: CalcGlobalComboResult;
  Ic: CalcGlobalComboResult;
  SD: CalcGlobalComboResult;
  Ea: CalcGlobalComboResult | null;
  Eb: CalcGlobalComboResult | null;
  eLim: number;
  eLimE: number;
  an: Record<string, unknown> | null;
  brm: string;
  DwE: number;
  W: WaterResult | null;
  E: Record<string, unknown> | null;
  ok: CalcRunOkMap;
  fe?: CfeResult;
  slope?: SlopeResult;
  checks?: CalcCheckItem[];
}

export interface CalcRunCantileverResult extends CalcRunBaseResult {
  model: 'canti';
  error?: undefined;
  unsupported?: undefined;
  st: CalcStemResult;
  toe: CalcFootResult;
  heel: CalcFootResult;
  Sf: RcSectionSpec;
  ifc: CalcIfaceResult;
  shS: CalcShrinkResult;
  shF: CalcShrinkResult;
}

export interface CalcRunRibbedResult extends CalcRunBaseResult {
  model: 'rib';
  error?: undefined;
  unsupported?: undefined;
  rg: Record<string, unknown>;
  bm: Record<string, unknown>;
  rho: number;
  stem: Record<string, unknown>;
  vert: Record<string, unknown>;
  rib: Record<string, unknown>;
  tie2: Record<string, unknown>;
  tie3: Record<string, unknown>;
  heel: Record<string, unknown>;
  toe2: Record<string, unknown>;
  shk: Record<string, CalcShrinkResult>;
  feBasis: FeBasis;
  hand?: { rib: unknown; ok: Partial<CalcRunOkMap> };
  [extra: string]: unknown;
}

export interface CalcRunErrorResult {
  error: string;
  unsupported?: undefined;
  model?: undefined;
}

export interface CalcRunUnsupportedResult {
  unsupported: true;
  msg: string;
  error?: undefined;
  model?: undefined;
}

export type CalcRunResult =
  | CalcRunCantileverResult
  | CalcRunRibbedResult
  | CalcRunErrorResult
  | CalcRunUnsupportedResult;

// ---------------------------------------------------------------------------
// 7. Application View State, Toasts & Exports (`22`, `25`, `26`)
// ---------------------------------------------------------------------------

export type AppViewMode = '2d' | '3d' | 'calc';
export type CalcSubTab = 'sheet' | 'gs' | 'rb' | 'fe' | 'pile';
export type ToastKind = '' | 'ok' | 'err' | 'wait';

export interface ToastAction {
  label: string;
  fn: () => void;
}

export interface ToastState {
  msg: string;
  kind: ToastKind;
  acts?: ToastAction[];
  visible: boolean;
}

export type PdfExportTarget =
  | { kind: 'cad-sheet'; sheet: CadSheet; sheetIndex: number; baseName: string }
  | { kind: 'calc-report'; html: string; css: string; baseName: string };

export interface DocxImageAsset {
  ext: 'png' | 'jpg';
  d: Uint8Array;
}
