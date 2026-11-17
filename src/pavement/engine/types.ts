export type StdCode = '39' | '38' | '37';
export type TabId = 'rigid' | 'drain' | 'joint' | 'flex' | 'sn37';
export type Sn37SubTab = 'new' | 'ol' | 'low';

export interface RigidGranularLayer {
  name: string;
  E: number;
  h: number;
}

export interface RigidAxleSpecRow {
  P: number;
  p: number;
}

export interface RigidTrafficInputs {
  adtt: number;
  fhuong: number;
  flan: number;
  naxle: number;
  grow: number;
  tyear: number;
  eta: number;
  spec: RigidAxleSpecRow[];
}

export interface RigidInput {
  cap: string;
  model: 1 | 2;
  caly: 0 | 1;
  hc: number;
  L: number;
  B: number;
  fr: number;
  Ec: number;
  muc: number;
  ac: number;
  Tg: number;
  Ps: number;
  Pmax: number;
  Ne: number;
  kr: number;
  kc: number;
  gr: number;
  E0: number;
  matBound: string;
  Eb: number;
  hb: number;
  mub: number;
  fbr: number;
  layers: RigidGranularLayer[];
}

export interface RigidResult {
  Ex: number;
  hx: number;
  alpha: number;
  Et: number;
  Dc: number;
  Db: number;
  r: number;
  rg: number;
  R: number;
  kf: number;
  sps1: number;
  spm1: number;
  sps2: number;
  spm2: number;
  sps: number;
  spm: number;
  spr: number;
  spmax: number;
  t: number;
  CL1: number;
  CL2: number;
  kn: number;
  rb: number;
  zeta: number;
  CL: number;
  BL: number;
  stmax: number;
  kt1: number;
  kt2: number;
  kt: number;
  str: number;
  sbps: number;
  sbpr: number;
  c1: number;
  c2: number;
  c3: number;
  app3: boolean;
  p1: boolean;
  p2: boolean;
  p3: boolean;
}

export interface RigidStateSnapshot {
  input: RigidInput;
  traffic: RigidTrafficInputs;
}

export interface SavedRigidOption {
  name: string;
  state: RigidStateSnapshot;
  result: RigidResult;
}

export interface DrainInput {
  Ic: number;
  N: number;
  nh: number;
  B: number;
  L: number;
  id: number;
  in_: number;
  kb: number;
  ne: number;
  hbt: number;
}

export interface DrainResult {
  nz: number;
  Qi: number;
  Ls: number;
  vs: number;
  t: number;
  cap: number;
}

export interface JointInput {
  h: number;
  kc: '3.00' | '3.50' | '3.75' | '4.50';
  mong: 'hat' | 'gc';
  cap: 'thap' | 'cao';
  L: number;
}

export interface JointResult {
  h: number;
  tie: string;
  d: [number, string, string, string];
  doc_gia: string;
  co_thanh: string;
  co_khong: string;
  catlan: string;
  dan_kc: string;
}

export type FlexMaterialType = 'btn1' | 'btn2' | 'gcda' | 'gcdat' | 'hatroi';
export type FlexSurfaceGrade = 'A1' | 'A2' | 'B1' | 'B2';
export type FlexReliability = '0.98' | '0.95' | '0.90' | '0.85' | '0.80';
export type FlexRoadClass =
  | 'caotoc1'
  | 'capII'
  | 'capIII'
  | 'capIV'
  | 'capV'
  | 'capVI'
  | 'dt_caotoc'
  | 'dt_chinhkv'
  | 'dt_pho'
  | 'dt_cn'
  | 'dt_ngo';

export interface FlexLayer {
  name: string;
  type: FlexMaterialType;
  h: number;
  Ev: number;
  Et: number;
  Ek: number;
  Rku: number;
  C: number;
  phi: number;
  shear: boolean;
}

export interface FlexVehicleRow {
  name: string;
  Pt: number;
  Ps: number;
  ms: number;
  banh: 'doi' | '4banh';
  spacing: number;
  ni: number;
}

export interface FlexFormState {
  capduong: FlexRoadClass;
  loaimat: FlexSurfaceGrade;
  dotincay: FlexReliability;
  Ptt: 100 | 120;
  layers: FlexLayer[];
  E0v: number;
  E0t: number;
  C0: number;
  phi0: number;
  k3_0: number;
  vehicles: FlexVehicleRow[];
  ntkloai: 'cuoi' | 'dau';
  fL: number;
  q: number;
  t: number;
  echManual?: number | null;
  shearManual: Record<string, number>;
}

export type Sn37LayerKind =
  | 'mat_btn'
  | 'mongtren_hat_E'
  | 'mongtren_hat_CBR'
  | 'mongtren_xm_E'
  | 'mongtren_xm_Rn'
  | 'mongtren_nhua_S'
  | 'mongduoi_hat_E'
  | 'mongduoi_hat_CBR'
  | 'custom';

export interface Sn37Layer {
  name: string;
  kind: Sn37LayerKind;
  val: number;
  D: number;
}

export interface Sn37NewInput {
  w80: number;
  capduong: 'caotoc' | 'toc80' | 'toc60' | 'custom';
  p0: number;
  pt: number;
  R: number;
  S0: number;
  mrmode: 'direct' | 'cbr' | 'gi';
  mrval: number;
  layers: Sn37Layer[];
}

export interface Sn37SurveyLayer {
  name: string;
  a: number;
  D: number;
}

export interface Sn37OverlayInput {
  Nf: number;
  R: number;
  S0: number;
  p1: number;
  p2: number;
  MR: number;
  method: 'fwd' | 'survey' | 'rl';
  fwdP: number;
  fwda: number;
  fwdD: number;
  fwdr: number;
  fwddr: number;
  fwdd0: number;
  fwdC: number;
  survey: Sn37SurveyLayer[];
  rlSN0: number;
  rlNp: number;
  rlN15: number;
  olEac: number;
}

export interface Sn37LowInput {
  loai: 'nhua' | 'cpd';
  esal: number;
  mrmode: 'direct' | 'cbr';
  mrval: number;
  Rrel: '50' | '75';
}

export function createDefaultRigidInput(): RigidInput {
  return {
    cap: 'Cấp III (ví dụ B.2 – Long An)',
    model: 2,
    caly: 0,
    hc: 0.26,
    L: 4.8,
    B: 3.5,
    fr: 5.0,
    Ec: 31000,
    muc: 0.15,
    ac: 0.000011,
    Tg: 92,
    Ps: 100,
    Pmax: 180,
    Ne: 17070000,
    kr: 0.87,
    kc: 1.05,
    gr: 1.13,
    E0: 45,
    matBound: 'CPĐD gia cố xi măng',
    Eb: 1300,
    hb: 0.2,
    mub: 0.2,
    fbr: 0,
    layers: [{ name: 'CPĐD loại I (móng dưới)', E: 300, h: 0.18 }],
  };
}

export function createDefaultRigidTraffic(): RigidTrafficInputs {
  return {
    adtt: 120,
    fhuong: 0.5,
    flan: 0.6,
    naxle: 6000,
    grow: 6,
    tyear: 15,
    eta: 0.5,
    spec: [
      { P: 60, p: 40 },
      { P: 80, p: 35 },
      { P: 100, p: 20 },
      { P: 120, p: 5 },
    ],
  };
}

export function createDefaultDrainInput(): DrainInput {
  return {
    Ic: 0.36,
    N: 2,
    nh: 1,
    B: 7.5,
    L: 4.5,
    id: 0.5,
    in_: 2,
    kb: 300,
    ne: 0.15,
    hbt: 0.15,
  };
}

export function createDefaultJointInput(): JointInput {
  return {
    h: 24,
    kc: '3.75',
    mong: 'hat',
    cap: 'thap',
    L: 4.5,
  };
}

export function createDefaultFlexState(): FlexFormState {
  return {
    capduong: 'capIII',
    loaimat: 'A1',
    dotincay: '0.95',
    Ptt: 100,
    layers: [
      { name: 'BTN chặt 12,5 (lớp trên)', type: 'btn1', h: 6, Ev: 420, Et: 300, Ek: 1800, Rku: 2.8, C: 0, phi: 0, shear: false },
      { name: 'BTN chặt 19 (lớp dưới)', type: 'btn2', h: 8, Ev: 350, Et: 250, Ek: 1600, Rku: 2.0, C: 0, phi: 0, shear: false },
      { name: 'Đá dăm gia cố xi măng', type: 'gcda', h: 14, Ev: 600, Et: 600, Ek: 600, Rku: 0.8, C: 0, phi: 0, shear: false },
      { name: 'Cấp phối đá dăm loại I', type: 'hatroi', h: 17, Ev: 300, Et: 300, Ek: 300, Rku: 0, C: 0.01, phi: 35, shear: false },
      { name: 'Cấp phối đá dăm loại II', type: 'hatroi', h: 18, Ev: 250, Et: 250, Ek: 250, Rku: 0, C: 0.005, phi: 30, shear: true },
    ],
    E0v: 46,
    E0t: 46,
    C0: 0.038,
    phi0: 27,
    k3_0: 1.5,
    vehicles: [
      { name: 'Xe con', Pt: 0, Ps: 0, ms: 1, banh: 'doi', spacing: 0, ni: 1800 },
      { name: 'Xe buýt nhỏ', Pt: 26.4, Ps: 45.2, ms: 1, banh: 'doi', spacing: 0, ni: 500 },
      { name: 'Xe buýt lớn', Pt: 56.0, Ps: 95.8, ms: 1, banh: 'doi', spacing: 0, ni: 50 },
      { name: 'Tải nhẹ', Pt: 18.0, Ps: 56.0, ms: 1, banh: 'doi', spacing: 0, ni: 1800 },
      { name: 'Tải vừa', Pt: 25.8, Ps: 69.6, ms: 1, banh: 'doi', spacing: 0, ni: 1250 },
      { name: 'Tải nặng', Pt: 48.2, Ps: 100.0, ms: 1, banh: 'doi', spacing: 0, ni: 600 },
      { name: 'Tải nặng (2 trục sau)', Pt: 45.2, Ps: 94.2, ms: 2, banh: 'doi', spacing: 1.4, ni: 200 },
    ],
    ntkloai: 'cuoi',
    fL: 0.55,
    q: 6,
    t: 15,
    echManual: null,
    shearManual: {},
  };
}

export function createDefaultSn37NewInput(): Sn37NewInput {
  return {
    w80: 7223610,
    capduong: 'caotoc',
    p0: 4.2,
    pt: 2.5,
    R: 85,
    S0: 0.45,
    mrmode: 'direct',
    mrval: 50,
    layers: [
      { name: 'BTNC16 (lớp trên)', kind: 'mat_btn', val: 4770, D: 5 },
      { name: 'BTNC19 (lớp dưới)', kind: 'mat_btn', val: 5040, D: 6 },
      { name: 'Móng trên ATB25 (gia cố nhựa)', kind: 'mongtren_nhua_S', val: 8, D: 7 },
      { name: 'Móng dưới CPĐD loại 1 (CBR≥100%)', kind: 'mongduoi_hat_CBR', val: 100, D: 17 },
      { name: 'Móng dưới CPĐD loại 2 (CBR≥30%) — lớp giải chiều dày', kind: 'mongduoi_hat_CBR', val: 30, D: 0 },
    ],
  };
}

export function createDefaultSn37OverlayInput(): Sn37OverlayInput {
  return {
    Nf: 4000000,
    R: 90,
    S0: 0.45,
    p1: 4.2,
    p2: 2.2,
    MR: 39,
    method: 'fwd',
    fwdP: 40,
    fwda: 15,
    fwdD: 62,
    fwdr: 90,
    fwddr: 0.009,
    fwdd0: 0.06077,
    fwdC: 0.33,
    survey: [
      { name: 'Tầng mặt BTN (Bảng 14)', a: 0.3, D: 20 },
      { name: 'Móng trên có gia cố', a: 0.14, D: 20 },
      { name: 'Móng trên/dưới vật liệu hạt', a: 0.1, D: 20 },
    ],
    rlSN0: 4.5,
    rlNp: 3000000,
    rlN15: 8000000,
    olEac: 4200,
  };
}

export function createDefaultSn37LowInput(): Sn37LowInput {
  return {
    loai: 'nhua',
    esal: 600000,
    mrmode: 'direct',
    mrval: 45,
    Rrel: '50',
  };
}
