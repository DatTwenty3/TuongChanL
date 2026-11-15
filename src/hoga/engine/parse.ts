/**
 * Phân tích các chuỗi nhập liệu của bảng hố ga: `D10A150`, `D6A150L100`, `R300x400`,
 * `600x800`, `75x50`, `2D12`, `V50x50x3`, … (định dạng ghi trong HDSD – chương 2).
 * Mọi hàm trả về `null` khi ô để trống / "0" / "Không" để nơi gọi dễ dùng `if (x)`.
 */

export interface RebarSpec {
  /** đường kính (mm) */
  dia: number;
  /** khoảng cách / mật độ (mm) */
  spacing: number;
}
export interface AnchorSpec extends RebarSpec {
  /** chiều dài thanh neo (mm) */
  len: number;
}
export interface LiftSpec {
  n: number;
  dia: number;
}
export interface AngleSpec {
  kind: 'V' | 'L';
  a: number;
  b: number;
  t: number;
  /** tên chuẩn hoá để tra bảng khối lượng riêng */
  name: string;
}

const isBlank = (s: unknown): boolean => s === null || s === undefined || String(s).trim() === '' || String(s).trim() === '0' || /^kh[oô]ng$/i.test(String(s).trim());

export function parseRebar(s: unknown): RebarSpec | null {
  if (isBlank(s)) return null;
  const m = /^\s*D\s*(\d+(?:[.,]\d+)?)\s*A\s*(\d+(?:[.,]\d+)?)\s*$/i.exec(String(s));
  if (!m) return null;
  const dia = Number(m[1].replace(',', '.'));
  const spacing = Number(m[2].replace(',', '.'));
  if (!(dia > 0) || !(spacing > 0)) return null;
  return { dia, spacing };
}

export function parseAnchor(s: unknown): AnchorSpec | null {
  if (isBlank(s)) return null;
  const m = /^\s*D\s*(\d+(?:[.,]\d+)?)\s*A\s*(\d+(?:[.,]\d+)?)\s*L\s*(\d+(?:[.,]\d+)?)\s*$/i.exec(String(s));
  if (!m) return null;
  const n = (x: string) => Number(x.replace(',', '.'));
  return { dia: n(m[1]), spacing: n(m[2]), len: n(m[3]) };
}

/** `2D12` → 2 thanh φ12 (số lượng 0 hoặc rỗng → null) */
export function parseLift(s: unknown): LiftSpec | null {
  if (isBlank(s)) return null;
  const m = /^\s*(\d+)\s*D\s*(\d+(?:[.,]\d+)?)\s*$/i.exec(String(s));
  if (!m) return null;
  const n = Number(m[1]);
  if (!(n > 0)) return null;
  return { n, dia: Number(m[2].replace(',', '.')) };
}

/** `75x50`, `100x150x80`, `820x570` … → mảng số */
export function parseDims(s: unknown): number[] | null {
  if (s === null || s === undefined) return null;
  const parts = String(s).trim().toLowerCase().split('x');
  const out = parts.map((p) => Number(p.replace(',', '.')));
  if (!out.length || out.some((x) => !Number.isFinite(x))) return null;
  return out;
}

/** `V30x30x3` / `L40x25x3` ; "Không" → null */
export function parseAngle(s: unknown): AngleSpec | null {
  if (isBlank(s)) return null;
  const m = /^\s*([VL])\s*(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)\s*$/i.exec(String(s));
  if (!m) return null;
  const n = (x: string) => Number(x.replace(',', '.'));
  const kind = m[1].toUpperCase() as 'V' | 'L';
  return { kind, a: n(m[2]), b: n(m[3]), t: n(m[4]), name: `${kind}${n(m[2])}x${n(m[3])}x${n(m[4])}` };
}

/** `4D12` (thép chủ giằng cửa thu) */
export const parseMain = parseLift;

/* ------------------------------------------------------------------ cống / rãnh */

export type PipeKind = 'round' | 'box' | 'ditch';

export interface PipeCatalog {
  /** cống tròn: D trong, dày */
  round: { d: number; t: number }[];
  /** cống hộp: B, H, dày, vát, cống đôi */
  box: { b: number; h: number; t: number; chamfer: number; twin: boolean }[];
  /** rãnh chữ U: B, H, dày, vát */
  ditch: { b: number; h: number; t: number; chamfer: number }[];
}

/** Cống/rãnh đã giải mã từ chuỗi kích thước và danh mục. */
export interface PipeDef {
  kind: PipeKind;
  /** kích thước trong (mm): tròn → d ; hộp/rãnh → b × h */
  d: number;
  b: number;
  h: number;
  /** chiều dày thành (mm) */
  t: number;
  chamfer: number;
  twin: boolean;
  spec: string;
}

export function parsePipe(spec: unknown, cat: PipeCatalog): PipeDef | null {
  if (isBlank(spec)) return null;
  const s = String(spec).trim();
  const up = s.toUpperCase();
  const num = (x: string) => Number(x.replace(',', '.'));
  if (/^D\s*\d/.test(up)) {
    const d = num(up.slice(1));
    const row = cat.round.find((r) => r.d === d);
    return { kind: 'round', d, b: d, h: d, t: row?.t ?? 0, chamfer: 0, twin: false, spec: s };
  }
  if (up.startsWith('R')) {
    const dims = parseDims(up.slice(1));
    if (!dims || dims.length !== 2) return null;
    const [b, h] = dims;
    const row = cat.ditch.find((r) => r.b === b && r.h === h);
    return { kind: 'ditch', d: b, b, h, t: row?.t ?? 0, chamfer: row?.chamfer ?? 0, twin: false, spec: s };
  }
  const dims = parseDims(up);
  if (!dims || dims.length !== 2) return null;
  const [b, h] = dims;
  const row = cat.box.find((r) => r.b === b && r.h === h);
  return { kind: 'box', d: b, b, h, t: row?.t ?? 0, chamfer: row?.chamfer ?? 0, twin: row?.twin ?? false, spec: s };
}

/** Kích thước lỗ trên tường gồm thành cống + vữa trát (mm): rộng × cao. */
export function pipeOpening(p: PipeDef, plaster: number): { w: number; h: number; round: boolean } {
  const e = p.t + plaster;
  if (p.kind === 'round') return { w: p.d + 2 * e, h: p.d + 2 * e, round: true };
  if (p.kind === 'ditch') return { w: p.b + 2 * e, h: p.h + e, round: false };
  return { w: p.b + 2 * e, h: p.h + 2 * e, round: false };
}

/** Kích thước ngoài cống (không vữa), cùng quy ước với `pipeOpening`. */
export function pipeOuter(p: PipeDef): { w: number; h: number; round: boolean } {
  return pipeOpening(p, 0);
}

/* ------------------------------------------------------------------ thép */

/** Khối lượng đơn vị thép tròn (kg/m) theo φ (mm). */
/** π/4·d²·7850 kg/m³ – trùng cột KL của bảng thống kê trong bản vẽ mẫu VHGpro (Ø10 → 0,6165 kg/m). */
export const rebarKgPerM = (dia: number): number => (Math.PI / 4) * dia * dia * 0.00785;

/** Các đường kính tiêu chuẩn dùng khi "giảm thép" (bậc đường kính). */
export const DIA_STEPS = [6, 8, 10, 12, 14, 16, 18, 20, 22, 25, 28, 32];

/** Giảm `steps` cấp đường kính (>= φ6). */
export function reduceDia(dia: number, steps: number): number {
  if (!steps) return dia;
  const i = DIA_STEPS.indexOf(dia);
  if (i < 0) return dia;
  return DIA_STEPS[Math.max(0, i - steps)];
}

/** Tách `0M`/`1M`/`2M` (số móc của thanh). */
export function parseHooks(s: unknown): 0 | 1 | 2 {
  const m = /^\s*([012])\s*M\s*$/i.exec(String(s ?? ''));
  return (m ? Number(m[1]) : 0) as 0 | 1 | 2;
}

/** Làm tròn nhỏ để so sánh/hiển thị. */
export const r3 = (x: number): number => Math.round(x * 1000) / 1000;
