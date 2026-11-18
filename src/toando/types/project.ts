/**
 * Canonical domain, nomogram, binary I/O, and TCCS 38:2022/TCĐBVN verification result types
 * for Áo đường mềm (ToanDo-Web).
 */

export type DesignObjectType = 'KCAD' | 'LGC';
export type DesignKindType = 'TK_MOI' | 'CAI_TAO';
export type RoadType = 'DUONG_O_TO' | 'DUONG_DO_THI';
export type SurfaceGrade = 'A1' | 'A2' | 'B1' | 'B2';
export type WheelGroupType = 'DON' | 'DOI' | 'BON';
export type CalculationYearMode = 'NAM_DAU' | 'NAM_CUOI';
export type StandardAxleType = 100 | 120;
export type AppliedAxleLoadType = 'BANH_DOI' | 'BANH_DON';
export type PavementTier = 'TANG_MAT' | 'TANG_MONG';
export type ToanDoId = '3-1' | '3-2' | '3-3' | '3-4' | '3-5' | '3-6';

export interface ProjectInfo {
  congTrinh: string;
  diaDiem: string;
  kySuThietKe: string;
  doiTuongTK: DesignObjectType;
  loaiTK: DesignKindType;
}

export interface RoadScale {
  loaiDuong: RoadType;
  capDuong: string;
  soLanXe: number;
  gpcGiua: boolean;
  gpcBen: boolean;
  heSoLan_fL: number;
  vanTocTK_kmh: number;
  doTinCayTK: number;
  Kcd_vong: number;
  Kcd_truot: number;
  Kcd_keoUon: number;
}

export interface VehicleRow {
  id: string;
  tenXe: string;
  tlTrucTruoc_kN: number;
  tlTrucSau_kN: number;
  soTrucSau: number;
  cumBanhTrucSau: WheelGroupType;
  khoangCachTrucSau_m: number;
  luuLuong_xeNgDem: number;
  /** Optional binary flag byte preserved across .adm round-trips. */
  flag?: number;
}

export interface VehicleConversionRow {
  vehicleIndex: number;
  tenXe: string;
  tlTrucTruoc_kN: number;
  tlTrucSau_kN: number;
  C1_truoc: number;
  C2_truoc: number;
  C1_sau: number;
  C2_sau: number;
  luuLuong_xeNgDem: number;
  Ni_truoc: number;
  Ni_sau: number;
  Ni_tong: number;
}

export interface ForecastConfig {
  khongCoSoLieuDieuTra: boolean;
  llNamTTDirect_trucNgDem: number;
  thoiHanTK_nam: number;
  namTinhToan: CalculationYearMode;
  /** Annual traffic growth rate as decimal (e.g. 0.06 = 6%). */
  quyLuatTangTruong_q: number;
  tlTrucQuyDoi_kN: StandardAxleType;
  taiTrongTrucTacDung: AppliedAxleLoadType;
  duongKinhVetBanh_D_cm: number;
  apLucBanh_p_MPa: number;
}

export interface TrafficSummary {
  conversions: VehicleConversionRow[];
  Ntk_trucNgDem: number;
  Ntt_trucLanNgDem: number;
  Ne_truc: number;
}

export interface SubgradeConfig {
  xacDinhTheoDoAm: boolean;
  loaiDat: string;
  doAmTuongDoi_a: number;
  doChatYeuCau_K: number;
  lanSoiSan: boolean;
  /** Improved compaction (+20% E0 per TCCS 38:2022 Table B.4 Note 3); defaults to false. */
  damNenCaiTien?: boolean;
  E0_MPa: number;
  phi_deg: number;
  C_MPa: number;
  /** Optional binary flag byte preserved across .adm round-trips. */
  flag2?: number;
}

export interface DesignParams {
  loaiTangMat: SurfaceGrade;
  Emin_MPa: number;
  Eyc_MPa: number;
  Ett_MPa: number;
}

export interface PavementLayer {
  id: string;
  tang: PavementTier;
  isTangMat: boolean;
  sttTrongTang: number;
  tenVatLieu: string;
  chieuDay_cm: number;
  E_vong_30C: number;
  E_truot_60C: number;
  E_keoUon_10_15C: number;
  Rku_MPa: number;
  C_MPa: number;
  phi_deg: number;
  ghiChu: string;
  /** True when this layer is a leveling/profile correction course (§10.2.1.2: excluded from strength). */
  isBuVenh?: boolean;
}

export interface PavementAlternative {
  id: string;
  name: string;
  layers: PavementLayer[];
}

export type EchCuMethod = 'BENKELMAN' | 'DIRECT_FWD' | 'LAYER_STACK';

export type RehabStrategy = 'DIRECT_OVERLAY' | 'MILL_AND_OVERLAY' | 'FULL_REBUILD';

export type DistressSeverity = 'NONE' | 'NHE' | 'VUA' | 'NANG';

export interface BenkelmanConfig {
  /** Input mode: individual deflection readings l_i (mm) or precomputed l_tb, S. */
  inputMode: 'POINTS' | 'STATS';
  /** Measured deflection points l_i (mm). */
  readings_mm: number[];
  /** Mean deflection l_tb (mm). */
  l_tb_mm: number;
  /** Sample standard deviation S (mm). */
  S_mm: number;
  /** One-sided standard normal quantile Z_alpha. */
  Z_alpha: number;
  /** Temperature correction factor K_t to 30°C (default 1.0). */
  K_t: number;
  /** Moisture/seasonal correction factor K_am (>= 1.0, default 1.0). */
  K_am: number;
  /** Test wheel contact pressure p_do (MPa, default 0.60). */
  p_do_MPa: number;
  /** Test wheel equivalent contact diameter D_do (cm, default 33.0). */
  D_do_cm: number;
  /** Equivalent Poisson's ratio mu (default 0.30). */
  mu: number;
}

export interface ExistingPavementLayer extends PavementLayer {
  /** Distress/quality reduction factor K_hh in (0, 1.0]; defaults to 1.0 for in-situ moduli. */
  K_hh: number;
  /** Whether to check flexural fatigue tension on this retained monolithic layer. */
  checkFlexural?: boolean;
}

export interface ExistingDistressAssessment {
  segmentName: string;
  /** Investigation segment length in meters (<= 1000 m per §10.3.1.2). */
  segmentLength_m: number;
  oldSurfaceGrade: SurfaceGrade;
  /** Optional PCI per TCCS 07:2013/TCĐBVN. */
  pci?: number | null;
  crackingLevel: DistressSeverity;
  ruttingDepth_mm?: number;
  localizedSink_mm?: number;
  hasReflectiveCrackRisk: boolean;
  hasWidening: boolean;
}

export interface RehabilitationConfig {
  strategy: RehabStrategy;
  echMethod: EchCuMethod;
  /** Direct characteristic modulus E_ch,cũ (MPa) for DIRECT_FWD method. */
  directEchCu_MPa: number;
  /** Combined seasonal/reliability adjustment K_đc in (0, 1.0] for DIRECT_FWD. */
  directKdc: number;
  benkelman: BenkelmanConfig;
  /** Optional retained total existing pavement thickness (cm) for subgrade shear under A/B. */
  totalExistingThickness_cm?: number;
  /** Retained existing pavement layers (top-down) for LAYER_STACK and full-stack shear. */
  existingLayers: ExistingPavementLayer[];
  /** Existing surface distress assessment per §10.3.1 and Table 13. */
  assessment: ExistingDistressAssessment;
}

export interface RehabValidationIssue {
  id: string;
  severity: 'error' | 'warning' | 'info';
  clause: string;
  message: string;
}

export interface BenkelmanStatsResult {
  n: number;
  l_tb_mm: number;
  S_mm: number;
  Cv: number;
  Z_alpha: number;
  l_dc_mm: number;
  l_tt_mm: number;
  echCu_MPa: number;
}

export interface RehabCalculationSummary {
  loaiTK: DesignKindType;
  strategy: RehabStrategy;
  echMethod?: EchCuMethod;
  echCu_MPa?: number;
  benkelmanStats?: BenkelmanStatsResult;
  existingReduction?: TwoLayerReductionResult | null;
  excludedBuVenhLayers: Array<{
    layerId: string;
    layerName: string;
    chieuDay_cm: number;
  }>;
  shearOldStackUsed: boolean;
  subgradeShearSkippedReason?: string;
  existingSurfaceAlreadyMeetsEyc?: boolean;
  warnings: string[];
}

export interface MaterialRecord {
  index: number;
  isGroupHeader: boolean;
  group: string;
  name: string;
  E_vong_30C: number;
  E_truot_60C: number;
  E_keoUon_10_15C: number;
  Rku_MPa: number;
  C_MPa: number;
  phi_deg: number;
  note: string;
}

export interface ProjectState {
  projectInfo: ProjectInfo;
  roadScale: RoadScale;
  vehicles: VehicleRow[];
  forecast: ForecastConfig;
  subgrade: SubgradeConfig;
  designParams: DesignParams;
  alternatives: PavementAlternative[];
  activeAlternativeId: string;
  /** Preserved Ntk when loaded from an external .adm file prior to editing traffic. */
  storedNtk?: number;
  /** Chapter 10 rehabilitation configuration when projectInfo.loaiTK === 'CAI_TAO'. */
  rehabilitation?: RehabilitationConfig;
}

export interface NomogramBBoxPx {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface NomogramMeta {
  index: number;
  id: ToanDoId;
  name: string;
  title: string;
  imagePath: string;
  widthPx: number;
  heightPx: number;
  plotBboxPx: NomogramBBoxPx;
  yellowAxisPx: NomogramBBoxPx | null;
  tccs38Figure: string;
  tcn211Figure: string;
  xVar: string;
  xRange: [number, number];
  yVar?: string;
  yRange?: [number, number];
  curveVar?: string;
  curveValues?: number[];
  rayVar?: string;
  rayValues?: number[];
  outputVar: string;
  outputRange?: [number, number];
}

export interface ToanDoTracePoint {
  xPx: number;
  yPx: number;
  label?: string;
}

export interface ToanDoTraceSegment {
  x1Px: number;
  y1Px: number;
  x2Px: number;
  y2Px: number;
  color: 'red' | 'yellow' | 'cyan';
  dashed?: boolean;
}

export interface ToanDoLookupInput {
  id: ToanDoId;
  /** Primary X axis input (H/D, h/D, or H_cm for 3-4). */
  x: number;
  /** Secondary Y or curve parameter (Eo/E1 for 3-1, E1/E2 for 3-2/3-3/3-6, E1/Ech.m for 3-5, phi_deg for 3-4). */
  yOrCurve: number;
  /** Optional third parameter (phi_deg for 3-2/3-3, E2/E3 for 3-6). */
  ray?: number;
}

export interface ToanDoLookupResult {
  id: ToanDoId;
  valid: boolean;
  value: number | null;
  displayValue: string;
  reason?: string;
  pointPx?: ToanDoTracePoint;
  segmentsPx: ToanDoTraceSegment[];
}

export interface TwoLayerReductionRow {
  layerOrder: number;
  tenVatLieu: string;
  E_MPa: number;
  t_E1_E2: number | null;
  h_cm: number;
  k_h1_h2: number | null;
  Htb_cm: number;
  EtbPrime_MPa: number;
}

export interface TwoLayerReductionResult {
  rows: TwoLayerReductionRow[];
  H_total_cm: number;
  H_over_D: number;
  EtbPrime_MPa: number;
  beta: number;
  Etb_dc_MPa: number;
  maxLayerE_MPa: number;
  /** True when Etb_dc_MPa was capped at maxLayerE_MPa per TCCS 38:2022 Table 11 Note 2. */
  etbCapped?: boolean;
}

export interface DeflectionResult {
  reduction: TwoLayerReductionResult;
  H_over_D: number;
  E0_over_Etbdc: number;
  usedFormulaF1: boolean;
  Ech_over_E1: number | null;
  Ech_MPa: number;
  Kcd_dv: number;
  Eyc_MPa: number;
  Eyc_required_MPa: number;
  passed: boolean;
  toanDo31?: ToanDoLookupResult;
  /** Foundation modulus E0 (TK_MOI) or E_ch,cũ (CAI_TAO) used under the overlay/pavement stack. */
  foundationModulus_MPa?: number;
  /** Human-readable label distinguishing subgrade E0 vs existing pavement E_ch,cũ. */
  foundationLabel?: string;
  /** True when 0.90 < E0'/E1 <= 1.00 triggered linear interpolation above Hình 2's 0.90 boundary. */
  e0RatioExtrapolated?: boolean;
}

export interface ShearTargetResult {
  targetId: string;
  targetName: string;
  targetIndexFromTop: number | null;
  isSubgrade: boolean;
  reductionAbove: TwoLayerReductionResult;
  reductionBelow: TwoLayerReductionResult | null;
  E1_MPa: number;
  E2_MPa: number;
  H_cm: number;
  D_cm: number;
  H_over_D: number;
  E1_over_E2: number;
  phi_deg: number;
  C_MPa: number;
  usedToanDo: '3-2' | '3-3' | 'F-1' | 'E.1';
  tax_over_p: number;
  tax_MPa: number;
  tav_MPa: number;
  k1: number;
  k2: number;
  k3: number;
  Ctt_MPa: number;
  Kcd_tr: number;
  tau_total_MPa: number;
  tau_allow_MPa: number;
  passed: boolean;
  toanDoTax?: ToanDoLookupResult;
  toanDoTav?: ToanDoLookupResult;
}

export interface FlexuralLayerResult {
  layerId: string;
  layerName: string;
  layerIndexFromTop: number;
  isSurfaceLayer: boolean;
  h1_cm: number;
  E1_MPa: number;
  E2_MPa: number;
  Echm_MPa: number;
  reductionBelow: TwoLayerReductionResult | null;
  H_over_D: number;
  ratio1: number;
  ratio2: number | null;
  usedToanDo: '3-5' | '3-6';
  usedAnalyticalFallback: boolean;
  sigma_ku_bar: number;
  kb: number;
  p_MPa: number;
  sigma_ku_MPa: number;
  materialClass: 'BTN' | 'DA_SOI_GC' | 'DAT_GC';
  k1: number;
  k2: number;
  Rku_MPa: number;
  Rtt_ku_MPa: number;
  Kcd_ku: number;
  R_allow_MPa: number;
  passed: boolean;
  toanDoFlex?: ToanDoLookupResult;
}

export interface AlternativeVerificationResult {
  alternativeId: string;
  alternativeName: string;
  ranAtIso: string;
  deflection: DeflectionResult;
  shearApplicable: boolean;
  shearTargets: ShearTargetResult[];
  flexuralApplicable: boolean;
  flexuralLayers: FlexuralLayerResult[];
  allDeflectionPassed: boolean;
  allShearPassed: boolean;
  allFlexuralPassed: boolean;
  allPassed: boolean;
  warnings: string[];
  rehabSummary?: RehabCalculationSummary;
}

export interface FullVerificationResult {
  traffic: TrafficSummary;
  subgradeResolved: {
    E0_MPa: number;
    phi_deg: number;
    C_MPa: number;
  };
  modulusResolved: {
    Eyc_MPa: number;
    Emin_MPa: number;
    Ett_MPa: number;
    Kcd_vong: number;
    Kcd_truot: number;
    Kcd_keoUon: number;
  };
  alternatives: Record<string, AlternativeVerificationResult>;
}

export interface ToanDoInputStrings {
  x: string;
  yOrCurve: string;
  ray: string;
}
