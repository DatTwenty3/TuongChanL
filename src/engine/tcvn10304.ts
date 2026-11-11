/**
 * TCVN 10304:2025 – tra bảng và hệ số cho sức chịu tải cọc theo đất nền.
 * Số liệu bảng nằm ở `tcvn10304Data.ts` (sinh từ bản tiêu chuẩn); các quy tắc nội suy theo
 * Chú thích 4 của Bảng 2 và Bảng 7: nội suy tuyến tính theo độ sâu và theo chỉ số chảy IL.
 */

import {
  T2_IL,
  T2_QB_DRIVEN,
  T3_FI,
  T3_IL,
  T7_A12,
  T7_A3,
  T7_A4,
  T7_HD,
  T7_PHI,
  T8_QB_BORED_CLAY,
} from './tcvn10304Data.ts';

export type SandGrain = 'gravelly' | 'coarse' | 'medium' | 'fine' | 'silt';
export type ClayType = 'sandy' | 'loam' | 'clay';

/** Mô tả đất để tra bảng. `IL` chỉ dùng cho đất loại sét. */
export interface TableSoil {
  kind: 'sand' | 'clay';
  grain?: SandGrain;
  IL?: number;
  clayType?: ClayType;
}

export interface Looked {
  v: number;
  /** Giá trị nằm ngoài miền của bảng và đã được kẹp về biên (cần cảnh báo). */
  clamped?: string;
}

const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));

/** Nội suy tuyến tính trên lưới tăng dần; kẹp ở hai đầu. */
function lerp1(xs: readonly number[], ys: readonly number[], x: number): number {
  if (x <= xs[0]) return ys[0];
  if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
  let i = 0;
  while (i < xs.length - 2 && x > xs[i + 1]) i++;
  const t = (x - xs[i]) / (xs[i + 1] - xs[i]);
  return ys[i] + (ys[i + 1] - ys[i]) * t;
}

/** Nội suy theo độ sâu từ các hàng (z, giá trị); trả về null nếu một trong hai hàng kề là ô trống. */
function lerpDepth<R extends readonly [number, ...unknown[]]>(
  rows: ReadonlyArray<R>,
  z: number,
  pick: (r: R) => number | null,
): number | null {
  const zs = rows.map((r) => r[0]);
  if (z <= zs[0]) return pick(rows[0]);
  if (z >= zs[zs.length - 1]) return pick(rows[rows.length - 1]);
  let i = 0;
  while (i < zs.length - 2 && z > zs[i + 1]) i++;
  const a = pick(rows[i]);
  const b = pick(rows[i + 1]);
  if (a === null || b === null) return null;
  return a + ((b - a) * (z - zs[i])) / (zs[i + 1] - zs[i]);
}

const SAND_COL_QB: Record<SandGrain, number> = { gravelly: 0, coarse: 1, medium: 2, fine: 3, silt: 4 };
const SAND_COL_FI: Record<SandGrain, number> = { gravelly: 0, coarse: 0, medium: 0, fine: 1, silt: 2 };

/** Bảng 2: sức kháng đơn vị dưới mũi cọc đóng / ép, qb (kPa). Độ sâu mũi cọc z (m) tính từ mặt đất tự nhiên. */
export function qbDriven(z: number, soil: TableSoil): Looked {
  const rows = T2_QB_DRIVEN;
  const clampedZ = z < rows[0][0] ? 'chiều sâu mũi cọc nhỏ hơn 3 m' : z > rows[rows.length - 1][0] ? 'chiều sâu mũi cọc lớn hơn 40 m (lấy như 40 m)' : undefined;
  if (soil.kind === 'sand') {
    const c = SAND_COL_QB[soil.grain ?? 'medium'];
    return { v: lerpDepth(rows, z, (r) => r[1][c]) as number, clamped: clampedZ };
  }
  const IL = soil.IL ?? 0.5;
  const ilc = clamp(IL, T2_IL[0], T2_IL[T2_IL.length - 1]);
  const vs = T2_IL.map((_, c) => lerpDepth(rows, z, (r) => r[2][c]) as number);
  const out: Looked = { v: lerp1(T2_IL, vs, ilc), clamped: clampedZ };
  if (IL > 0.6) out.clamped = (out.clamped ? out.clamped + '; ' : '') + 'IL > 0,6: không nên tựa mũi cọc đóng/ép (Điều 7.2.2.2)';
  return out;
}

/** Bảng 3: sức kháng đơn vị trên mặt bên thân cọc, fi (kPa). z = độ sâu trung bình của lớp (m). */
export function fiDriven(z: number, soil: TableSoil): Looked {
  const rows = T3_FI;
  const clampedZ = z < rows[0][0] ? 'độ sâu lớp đất nhỏ hơn 1 m (lấy như 1 m)' : z > rows[rows.length - 1][0] ? 'độ sâu lớp đất lớn hơn 40 m (lấy như 40 m)' : undefined;
  if (soil.kind === 'sand') {
    const c = SAND_COL_FI[soil.grain ?? 'medium'];
    return { v: lerpDepth(rows, z, (r) => r[1][c]) as number, clamped: clampedZ };
  }
  const IL = soil.IL ?? 0.5;
  const ilc = clamp(IL, T3_IL[0], T3_IL[T3_IL.length - 1]);
  const vs = T3_IL.map((_, c) => lerpDepth(rows, z, (r) => r[1][c]) as number);
  return { v: lerp1(T3_IL, vs, ilc), clamped: clampedZ };
}

/** Bảng 8: qb dưới mũi cọc nhồi / khoan trong đất loại sét (kPa); null nếu bảng không cho giá trị. */
export function qbBoredClay(z: number, IL: number): Looked | null {
  const rows = T8_QB_BORED_CLAY;
  const clampedZ = z < rows[0][0] ? 'chiều sâu mũi cọc nhỏ hơn 3 m' : undefined;
  const ILs = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6];
  const ilc = clamp(IL, 0, 0.6);
  // chỉ nội suy trên hai cột IL kề nhau để xử lý ô trống
  let j = 0;
  while (j < ILs.length - 2 && ilc > ILs[j + 1]) j++;
  const a = lerpDepth(rows, z, (r) => r[1][j]);
  const b = lerpDepth(rows, z, (r) => r[1][j + 1]);
  const t = (ilc - ILs[j]) / (ILs[j + 1] - ILs[j]);
  if (a === null) return null;
  if (b === null) {
    if (t > 1e-9) return null;
    return { v: a, clamped: clampedZ };
  }
  const out: Looked = { v: a + (b - a) * t, clamped: clampedZ };
  if (IL > 0.6) out.clamped = (out.clamped ? out.clamped + '; ' : '') + 'IL > 0,6: phải thử nén tĩnh cọc (Điều 7.2.3.5)';
  return out;
}

export interface BoredSandAlpha {
  a1: number;
  a2: number;
  a3: number;
  a4: number;
  clamped?: string;
}

/** Bảng 7: các hệ số α1…α4 theo φ (độ), h/d và d (m). */
export function boredAlpha(phi: number, hd: number, d: number): BoredSandAlpha {
  const notes: string[] = [];
  if (phi < T7_PHI[0] || phi > T7_PHI[T7_PHI.length - 1]) notes.push('φ nằm ngoài 23°–39° (kẹp về biên)');
  if (hd < T7_HD[0]) notes.push('h/d < 4 (kẹp về 4)');
  const p = clamp(phi, T7_PHI[0], T7_PHI[T7_PHI.length - 1]);
  const a1 = lerp1(T7_PHI, T7_A12.map((x) => x[0]), p);
  const a2 = lerp1(T7_PHI, T7_A12.map((x) => x[1]), p);
  // α3: nội suy theo h/d trên mỗi cột φ rồi nội suy theo φ
  const a3col = T7_A3.map((row) => lerp1(T7_HD, row, hd));
  const a3 = lerp1(T7_PHI, a3col, p);
  const a4s = lerp1(T7_PHI, T7_A4.map((x) => x[0]), p);
  const a4l = lerp1(T7_PHI, T7_A4.map((x) => x[1]), p);
  const a4 = lerp1([0.8, 4.0], [a4s, a4l], d);
  return { a1, a2, a3, a4, clamped: notes.length ? notes.join('; ') : undefined };
}

/** Công thức (14): qb (kPa) dưới mũi cọc nhồi / khoan trong đất cát. */
export function qbBoredSand(args: {
  phi: number;
  d: number;
  h: number;
  gammaTipEff: number;
  gammaAbove: number;
}): { v: number; alpha: BoredSandAlpha } {
  const al = boredAlpha(args.phi, args.h / args.d, args.d);
  const v = 0.75 * al.a4 * (al.a1 * args.gammaTipEff * args.d + al.a2 * al.a3 * args.gammaAbove * args.h);
  return { v, alpha: al };
}

export type InstallDriven = 'hammer' | 'press' | 'custom';
export type BoredMethod = 'cast' | 'vibro' | 'dry' | 'wet' | 'dryHard' | 'barrette';

export const BORED_METHOD_LABEL: Record<BoredMethod, string> = {
  cast: 'Cọc nhồi (ống vách bịt mũi / nút bê tông)',
  vibro: 'Cọc nhồi ép rung',
  dry: 'Cọc khoan, đổ bê tông khô / có ống vách / CFA',
  wet: 'Cọc khoan dưới nước hoặc trong dung dịch bentonite',
  dryHard: 'Cọc khoan, bê tông cứng đầm sâu (khô)',
  barrette: 'Cọc barrette',
};

/** Bảng 6 – γR,f theo loại đất: [cát, cát pha, sét pha, sét]. */
const T6: Record<BoredMethod, readonly [number, number, number, number]> = {
  cast: [1.0, 1.0, 1.0, 0.9],
  vibro: [0.9, 0.9, 0.9, 0.9],
  dry: [0.7, 0.7, 0.7, 0.6],
  wet: [0.6, 0.6, 0.6, 0.6],
  dryHard: [0.8, 0.8, 0.8, 0.7],
  barrette: [0.6, 0.6, 0.6, 0.6],
};

export function boredGammaRf(method: BoredMethod, soil: TableSoil): number {
  const row = T6[method];
  if (soil.kind === 'sand') return row[0];
  return soil.clayType === 'sandy' ? row[1] : soil.clayType === 'loam' ? row[2] : row[3];
}

export interface DrivenCoef {
  gRR: number;
  gRf: number;
  note?: string;
}

/**
 * Bảng 4 – γR,R (dưới mũi) và γR,f (mặt bên) cho cọc đóng / ép.
 *  - hammer: hạ bằng búa (hàng 1): 1,0 / 1,0
 *  - press: hạ bằng ép (hàng 7): cát thô-vừa-mịn 1,1 / 1,0; cát bụi 1,1 / 0,8; sét IL < 0,5 1,1 / 1,0; sét IL ≥ 0,5 1,0 / 1,0
 * `tip` là loại đất dưới mũi, `side` là loại đất của lớp đang xét ở mặt bên.
 */
export function drivenCoef(
  install: InstallDriven,
  tip: TableSoil,
  side: TableSoil,
  custom: { gRR: number; gRf: number },
): DrivenCoef {
  if (install === 'custom') return { gRR: custom.gRR, gRf: custom.gRf, note: 'hệ số do người dùng nhập' };
  if (install === 'hammer') return { gRR: 1.0, gRf: 1.0 };
  const tipClay = tip.kind === 'clay';
  const gRR = tipClay ? ((tip.IL ?? 0.5) < 0.5 ? 1.1 : 1.0) : 1.1;
  const siltSand = side.kind === 'sand' && side.grain === 'silt';
  const gRf = siltSand ? 0.8 : 1.0;
  return { gRR, gRf };
}

/** Bảng 4, hàng 5 – cọc rỗng mũi hở hạ bằng búa: γR,R theo đường kính lòng cọc (m). */
export function openHollowTipCoef(dInner: number): number {
  return dInner < 0.4 ? 1.0 : dInner <= 0.8 ? 0.7 : 0.7;
}

export type StructClass = 'C1' | 'C2' | 'C3';

/** Điều 7.1.6.1 – hệ số tầm quan trọng γn. */
export const GAMMA_N: Record<StructClass, number> = { C1: 1.0, C2: 1.15, C3: 1.2 };

export type TestKind = 'static' | 'dynElastic' | 'dynNoElastic';

/** γk khi nén; `n` là số cọc trong móng, `Nd` là tải lớn nhất lên một cọc (kN), `pile` để xét ngoại lệ móng một cọc. */
export function gammaKCompression(
  method: 'tcvn' | 'spt' | 'test',
  test: TestKind,
  n: number,
  NdMax: number,
  pile: 'sq' | 'rc' | 'phc' | 'bored',
): { v: number; note: string } {
  let v = method === 'spt' ? 1.5 : method === 'test' ? (test === 'static' ? 1.2 : test === 'dynElastic' ? 1.25 : 1.4) : 1.4;
  let note = method === 'spt' ? 'xác định theo SPT' : method === 'test' ? 'theo thí nghiệm' : 'tính theo các bảng tra của tiêu chuẩn';
  if (n === 1 && method !== 'test') {
    const lim = pile === 'sq' || pile === 'rc' ? 600 : pile === 'bored' ? 2500 : Infinity;
    if (NdMax > lim) {
      v = 1.6;
      note += `; móng một cọc có tải > ${lim} kN`;
    }
  }
  return { v, note };
}

/** γk khi kéo hoặc cọc ma sát trong móng công trình thủy lợi: phụ thuộc số cọc (giá trị không trong ngoặc). */
export function gammaKTension(n: number): number {
  return n >= 21 ? 1.4 : n >= 11 ? 1.55 : n >= 6 ? 1.65 : 1.75;
}

/** γc khi kéo (công thức 11): 0,6 khi chiều sâu hạ cọc < 4 m, 0,8 khi ≥ 4 m. */
export function gammaCTension(L: number): number {
  return L < 4 ? 0.6 : 0.8;
}
