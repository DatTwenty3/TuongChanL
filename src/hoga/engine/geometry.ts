/**
 * Hình học hố ga (mm). Hệ trục ga: gốc tại tâm lòng ga, x sang phải (dọc cạnh dài L),
 * y lên trên (dọc cạnh rộng B). Tường T1 = 12h (y+), T2 = 3h (x+), T3 = 6h (y−), T4 = 9h (x−).
 * Cao độ z tính từ mặt trong bản đáy (z = 0) lên trên.
 */
import type { GaConfig, GaRow, Neck } from './types';
import { parseDims, parsePipe, pipeOpening, pipeOuter, type PipeCatalog, type PipeDef } from './parse';

export type WallId = 0 | 1 | 2 | 3; // T1..T4
export const WALL_NAMES = ['T1', 'T2', 'T3', 'T4'] as const;

/** Lỗ cống/rãnh trên tường, toạ độ trong hệ phẳng của tường (u dọc tường, v = cao độ z). */
export interface WallOpening {
  wall: WallId;
  pipe: PipeDef;
  /** kích thước lỗ (gồm thành cống + vữa trát) */
  w: number;
  h: number;
  round: boolean;
  /** tâm lỗ theo phương dọc tường (u) – 0 = tim tường; dương = bên trái khi nhìn từ trong ra */
  uc: number;
  /** đáy và đỉnh lỗ (z) */
  z0: number;
  z1: number;
  /** vị trí tâm trong hệ ga (mm) */
  cx: number;
  cy: number;
  /** đáy cống ngoài (không vữa) */
  outerW: number;
  outerH: number;
}

export interface Dims {
  L: number;
  B: number;
  H: number;
  tb: number;
  tw: number;
  tr: number;
  /** nửa kích thước ngoài của thân ga (không kể lớp lót) */
  ox: number;
  oy: number;
  /** nửa kích thước bản đáy */
  bx: number;
  by: number;
}

export function dims(row: GaRow, cfg: GaConfig): Dims {
  const tw = row.wall.t;
  return {
    L: row.L,
    B: row.B,
    H: row.H,
    tb: row.bottom.t,
    tw,
    tr: row.roof.t,
    ox: row.L / 2 + tw,
    oy: row.B / 2 + tw,
    bx: row.L / 2 + tw + cfg.bottom.ext,
    by: row.B / 2 + tw + cfg.bottom.ext,
  };
}

export function parseNeckSize(size: string): { round: boolean; a: number; b: number } | null {
  const s = String(size ?? '').trim();
  if (/^D\s*\d/i.test(s)) {
    const d = Number(s.slice(1).replace(',', '.'));
    return d > 0 ? { round: true, a: d, b: d } : null;
  }
  const d = parseDims(s);
  if (!d || d.length !== 2 || !(d[0] > 0) || !(d[1] > 0)) return null;
  return { round: false, a: d[0], b: d[1] };
}

/** Cổ ga: kích thước trong + vị trí (cạnh, góc hoặc giữa ga). null nếu ga không có cổ. */
export function neckOf(row: GaRow, cfg: GaConfig, hasNeck: boolean): Neck | null {
  if (!hasNeck || !(row.neck.h > 0)) return null;
  const sz = parseNeckSize(cfg.neck.size);
  if (!sz) return null;
  const hx = row.L / 2;
  const hy = row.B / 2;
  const pos = cfg.neck.pos;
  let cx = 0;
  let cy = 0;
  const left = -hx + sz.a / 2;
  const right = hx - sz.a / 2;
  const bottom = -hy + sz.b / 2;
  const top = hy - sz.b / 2;
  if (/Giữa ga/i.test(pos)) {
    cx = 0;
    cy = 0;
  } else if (/Giữa T1/i.test(pos)) cy = top;
  else if (/Giữa T3/i.test(pos)) cy = bottom;
  else if (/Giữa T2/i.test(pos)) cx = right;
  else if (/Giữa T4/i.test(pos)) cx = left;
  else if (/T1-T2/i.test(pos)) {
    cx = right;
    cy = top;
  } else if (/T2-T3/i.test(pos)) {
    cx = right;
    cy = bottom;
  } else if (/T3-T4/i.test(pos)) {
    cx = left;
    cy = bottom;
  } else if (/T4-T1/i.test(pos)) {
    cx = left;
    cy = top;
  }
  // nếu cổ lớn hơn lòng ga thì căn giữa theo phương đó
  if (sz.a >= row.L) cx = 0;
  if (sz.b >= row.B) cy = 0;
  return { round: sz.round, a: sz.a, b: sz.b, cx, cy };
}

export function neckArea(n: Neck): number {
  return n.round ? (Math.PI * n.a * n.a) / 4 : n.a * n.b;
}
export function neckPerimeter(n: Neck): number {
  return n.round ? Math.PI * n.a : 2 * (n.a + n.b);
}

/** Lỗ cống/rãnh trên 4 tường. */
export function openings(row: GaRow, cfg: GaConfig, cat: PipeCatalog): WallOpening[] {
  const out: WallOpening[] = [];
  const d = dims(row, cfg);
  for (let i = 0; i < 4; i++) {
    const slot = row.pipes[i];
    const pipe = parsePipe(slot.spec, cat);
    if (!pipe) continue;
    const op = pipeOpening(pipe, cfg.pipeHole.plaster);
    const outer = pipeOuter(pipe);
    const e = pipe.t + cfg.pipeHole.plaster;
    let z0: number;
    let z1: number;
    if (pipe.kind === 'ditch') {
      z1 = d.H;
      z0 = d.H - op.h;
    } else {
      z0 = Math.max(0, slot.depth - e);
      z1 = z0 + op.h;
    }
    const off = cfg.pipeHole.offsets[i] ?? 0;
    // chiều dương = bên trái khi nhìn từ trong ga ra ngoài
    let cx = 0;
    let cy = 0;
    if (i === 0) {
      cy = d.B / 2 + d.tw / 2;
      cx = -off;
    } else if (i === 1) {
      cx = d.L / 2 + d.tw / 2;
      cy = off;
    } else if (i === 2) {
      cy = -(d.B / 2 + d.tw / 2);
      cx = off;
    } else {
      cx = -(d.L / 2 + d.tw / 2);
      cy = -off;
    }
    out.push({ wall: i as WallId, pipe, w: op.w, h: op.h, round: op.round, uc: off, z0, z1, cx, cy, outerW: outer.w, outerH: outer.h });
  }
  return out;
}

/** Chiều dài tường T1/T3 (theo x) hay T2/T4 (theo y) – phía trong. */
export function wallInnerLen(id: WallId, d: Dims): number {
  return id === 0 || id === 2 ? d.L : d.B;
}

/** Tổng cao ga (mm) từ đáy bản đáy tới mặt nắp. */
export function totalHeight(row: GaRow, cfg: GaConfig, hasNeck: boolean): number {
  const lidH = hasNeck ? cfg.lid.height : 0;
  return row.bottom.t + row.H + row.roof.t + (hasNeck ? row.neck.h : 0) + lidH;
}

/** Cao trình (m): [đỉnh ga, đáy ga]; đáy ga = mặt trong bản đáy. */
export function levels(row: GaRow, cfg: GaConfig, hasNeck: boolean): { top: number | null; bottom: number | null } {
  if (row.level === null || row.level === undefined) return { top: null, bottom: null };
  const bottom = row.level;
  const top = bottom + (row.H + row.roof.t + (hasNeck ? row.neck.h + cfg.lid.height : 0)) / 1000;
  return { top, bottom };
}
