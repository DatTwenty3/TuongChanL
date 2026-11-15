import type { PipeCatalog } from './parse';

/** 5 loại hố ga hỗ trợ (HDSD §1.2.2). */
export type GaKind = 'lienKhoi' | 'napRoi' | 'thamThuNapRoi' | 'thamThuLienKhoi' | 'khongCo';

export interface GaKindInfo {
  id: GaKind;
  label: string;
  /** có cổ ga hay không */
  hasNeck: boolean;
  /** trần đúc sẵn (liên kết với tường bằng chốt thép + vữa đệm) */
  precastRoof: boolean;
  /** có cửa thu nước */
  hasInlet: boolean;
  /** tên sheet Excel của VHGpro 4 chứa bảng chi tiết ga */
  sheet: string;
}

export const GA_KINDS: Record<GaKind, GaKindInfo> = {
  lienKhoi: { id: 'lienKhoi', label: 'Ga thăm BTCT đổ liền khối', hasNeck: true, precastRoof: false, hasInlet: false, sheet: 'GaThamLienKhoi' },
  napRoi: { id: 'napRoi', label: 'Ga thăm BTCT tách rời nắp và thân', hasNeck: true, precastRoof: true, hasInlet: false, sheet: 'GaThamNapRoi' },
  thamThuNapRoi: { id: 'thamThuNapRoi', label: 'Ga thăm + thu, nắp rời', hasNeck: true, precastRoof: true, hasInlet: true, sheet: 'GaThamThuNapRoi' },
  thamThuLienKhoi: { id: 'thamThuLienKhoi', label: 'Ga thăm + thu, liền khối', hasNeck: true, precastRoof: false, hasInlet: true, sheet: 'GaThamThuLienKhoi' },
  khongCo: { id: 'khongCo', label: 'Ga thăm có tấm nắp đúc sẵn, không cổ', hasNeck: false, precastRoof: true, hasInlet: false, sheet: 'GaThamKhongCo' },
};
export const GA_KIND_ORDER: GaKind[] = ['lienKhoi', 'napRoi', 'thamThuNapRoi', 'thamThuLienKhoi', 'khongCo'];

export interface PipeSlot {
  /** `D400`, `600x800`, `R300x400` hoặc rỗng */
  spec: string;
  /** khoảng cách từ đáy cống đến đáy ga (mm) */
  depth: number;
}

/** Một hàng của bảng chi tiết ga (đơn vị mm, cao độ m). */
export interface GaRow {
  name: string;
  /** số lượng ga cùng loại */
  count: number;
  /** kích thước trong lòng ga */
  L: number;
  B: number;
  H: number;
  bottom: { t: number; low: string; up: string };
  wall: { t: number; out: string; in: string };
  /** trần ga (có cổ) hoặc tấm nắp đúc sẵn (không cổ) */
  roof: { t: number; up: string; low: string };
  /** T1 (12h), T2 (3h), T3 (6h), T4 (9h) */
  pipes: [PipeSlot, PipeSlot, PipeSlot, PipeSlot];
  neck: { h: number; t: number; out: string; in: string };
  /** cao độ đáy ga (m) – null nếu dùng cao trình tương đối */
  level: number | null;
}

export type Dir = 'Ngang' | 'Dọc';

export interface GaConfig {
  liner: { l1Ext: number; l1T: number; l2Ext: number; l2T: number };
  bottom: { ext: number; chamfer: number; chamferDia: number; hook: number };
  wall: {
    horizAdj: number;
    dRed: number;
    prefix: string;
    topChamfer: { on: boolean; size: string; angle: string; pos: string; anchor: string };
  };
  roof: { chamfer: number; chamferDia: number; hook: number };
  precast: { pin: boolean; pinSpec: string; pinLen: number; pinHole: number; mortar: number; lift: string; liftSize: string };
  neck: {
    structure: 'BTCT' | 'Khác';
    pos: string;
    size: string;
    chamfer: boolean;
    chamferSize: string;
    angle: string;
    anglePos: string;
    anchor: string;
    prefix: string;
    horizAdj: number;
    dRed: number;
  };
  lid: {
    type: 'Gang' | 'BTCT';
    height: number;
    block: string;
    recess: boolean;
    recessSize: string;
    hatch: string;
    nSlabs: number;
    gap: number;
    dir: Dir;
    dLow: number;
    dUp: number;
    density: number;
    tie: string;
    tieShape: string;
    angle: string;
    angleCount: number;
    anchor: string;
    lift: string;
    liftSize: string;
    scale: number;
  };
  inlet: {
    place: 'Thân ga' | 'Cổ ga';
    side: string;
    hole: string;
    clear: string;
    thick: string;
    liner: string;
    beam: string;
    structure: 'BTCT' | 'Khác';
    mesh: string;
    beamMain: string;
    beamStirrup: string;
  };
  cover: { bottom: number; wall: number; roof: number; neck: number; lid: number; pipe: number; inlet: number; notch: number };
  fmt: {
    bottomLow: string;
    bottomUp: string;
    wallOut: string;
    wallIn: string;
    roofUp: string;
    roofLow: string;
    neckOut: string;
    neckIn: string;
    prefixes: { bottom: string; wall: string; roof: string; neck: string; lid: string };
    mesh: 'Chia đều' | 'Theo mật độ';
    hook: 'Theo KC' | 'Theo ĐK';
    hookN: number;
    densSym: string;
    showCount: boolean;
  };
  ties: {
    stagger: 'Đều' | 'Lệch';
    bottom: string;
    wall: string;
    roof: string;
    neck: string;
    spec: string;
    lap: number;
    hookC: number;
    hookZU: number;
    hookMid: number;
  };
  ladder: { pos: string; dia: number; dens: string; size: string; depth: number; prefix: string };
  pipeHole: { plaster: number; dia: number; form: string; count: number; ext: number; prefix: string; offsets: [number, number, number, number] };
  manHole: { dia: number; form: string; count: number; ext: number; prefix: string };
  levels: { mode: 'Tuyệt đối' | 'Tương đối'; labels: string[] };
  materials: { liner1: string; liner2: string; body: string; neck: string; plaster: string; mortar: string };
  excavation: { sandT: number; baseExt: number; slope: number; h0Dig: number; h0Fill: number };
}

export interface AngleTable {
  [name: string]: number; // kg/m
}

export interface HoGaProject {
  kind: GaKind;
  title: string;
  rows: GaRow[];
  config: GaConfig;
  catalog: PipeCatalog;
  angles: AngleTable;
}

/** Hình học phụ trợ của một ga (mm), dùng chung cho khối lượng, cốt thép và bản vẽ. */
export interface Neck {
  /** hình chữ nhật hay tròn */
  round: boolean;
  /** kích thước trong (mm); cổ tròn: a = b = D */
  a: number;
  b: number;
  /** tâm cổ trong hệ trục ga (gốc ở tâm lòng ga, x sang phải, y lên – hướng T1) */
  cx: number;
  cy: number;
}
