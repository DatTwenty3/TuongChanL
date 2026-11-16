/**
 * Dựng các hình vẽ của một hố ga: mặt bằng thân ga, mặt bằng trần/nắp, mặt cắt A-A và B-B (kết cấu),
 * mặt cắt cốt thép và mặt bằng cốt thép các lớp. Hệ toạ độ hình vẽ = hệ ga (mm, gốc ở tâm lòng ga).
 * Mặt cắt: trục ngang = x (A-A) hoặc y (B-B), trục đứng z với z = 0 tại mặt trong bản đáy.
 */
import { Builder, type Ent } from './ents';
import type { GaConfig, GaKindInfo, GaRow, Neck } from '../engine/types';
import { dims, neckOf, openings, wallInnerLen, type Dims, type WallOpening } from '../engine/geometry';
import { parseDims, parseHooks, parseRebar, reduceDia, type PipeCatalog } from '../engine/parse';
import { ladderLevels, ladderWall, lidSlabs, spaced, wallPanels } from '../engine/rebar';
import { inletGeom } from '../engine/quantities';
import type { GaResult } from '../engine/summary';

export interface Ctx {
  row: GaRow;
  cfg: GaConfig;
  cat: PipeCatalog;
  info: GaKindInfo;
  d: Dims;
  neck: Neck | null;
  ops: WallOpening[];
  res: GaResult;
}

export function makeCtx(res: GaResult, cfg: GaConfig, cat: PipeCatalog, info: GaKindInfo): Ctx {
  return { row: res.row, cfg, cat, info, d: dims(res.row, cfg), neck: neckOf(res.row, cfg, info.hasNeck), ops: openings(res.row, cfg, cat), res };
}

export interface View {
  id: string;
  title: string;
  /** thực thể (mm, hệ riêng của hình) – chưa đặt lên khung giấy */
  ents: Ent[];
}

export type Pt = [number, number];
export const circlePoly = (cx: number, cy: number, r: number, n = 40): Pt[] => Array.from({ length: n }, (_, i) => [cx + r * Math.cos((2 * Math.PI * i) / n), cy + r * Math.sin((2 * Math.PI * i) / n)] as Pt);
export const rectPoly = (x0: number, y0: number, x1: number, y1: number): Pt[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

/** u (dọc tường), n (khoảng cách pháp tuyến từ tâm ga) → toạ độ x,y */
export function wallXY(i: number, u: number, n: number): Pt {
  if (i === 0) return [-u, n];
  if (i === 1) return [n, u];
  if (i === 2) return [u, -n];
  return [-n, -u];
}

/** các khoảng [u0,u1] bị lỗ chiếm trên tường i */
export function gapsOf(ops: WallOpening[], i: number, extra = 0): [number, number][] {
  return ops.filter((o) => o.wall === i).map((o) => [o.uc - o.w / 2 - extra, o.uc + o.w / 2 + extra] as [number, number]).sort((a, b) => a[0] - b[0]);
}
export function subtractGaps(a: number, b: number, gaps: [number, number][]): [number, number][] {
  let segs: [number, number][] = [[a, b]];
  for (const [g0, g1] of gaps) {
    const next: [number, number][] = [];
    for (const [s0, s1] of segs) {
      if (g1 <= s0 || g0 >= s1) next.push([s0, s1]);
      else {
        if (g0 > s0) next.push([s0, g0]);
        if (g1 < s1) next.push([g1, s1]);
      }
    }
    segs = next;
  }
  return segs;
}

export const fmtMm = (x: number) => String(Math.round(x));
/** Kích thước (mm) ghi trong tên block nắp, ví dụ `VIN.TNM.LD.820x570` → [820, 570]. */
export function lidBlockDims(name: string): [number, number] | null {
  const m = /(\d+)x(\d+)(?:\.(?:MB|AA|BB))?$/i.exec(name.trim());
  return m ? [Number(m[1]), Number(m[2])] : null;
}
const levelTxt = (z: number | null) => (z === null ? '' : `${z >= 0 ? '+' : ''}${z.toFixed(2)}`);

/* ================================================================== MẶT BẰNG */

export function planBody(c: Ctx, s: number): View {
  const b = new Builder(s);
  const { d, cfg, row } = c;
  const lx = d.ox + cfg.liner.l1Ext + cfg.bottom.ext;
  const ly = d.oy + cfg.liner.l1Ext + cfg.bottom.ext;
  if (cfg.liner.l1T > 0) b.rect('LOT', -lx, -ly, lx, ly);
  b.rect('LOT', -d.bx, -d.by, d.bx, d.by);

  // chân tường: vùng tô BTCT thành 4 mảnh không chồng nhau
  const pieces: Pt[][] = [];
  for (let i = 0; i < 4; i++) {
    const Li = wallInnerLen(i as 0, d);
    const nIn = i % 2 === 0 ? d.B / 2 : d.L / 2;
    const half = Li / 2 + (i % 2 === 0 ? d.tw : 0);
    for (const [u0, u1] of subtractGaps(-half, half, gapsOf(c.ops, i))) {
      pieces.push([wallXY(i, u0, nIn), wallXY(i, u1, nIn), wallXY(i, u1, nIn + d.tw), wallXY(i, u0, nIn + d.tw)]);
    }
  }
  b.hatch(pieces, 45, 2.4);
  // viền tường (có khoảng hở tại lỗ)
  for (let i = 0; i < 4; i++) {
    const Li = wallInnerLen(i as 0, d);
    const nIn = i % 2 === 0 ? d.B / 2 : d.L / 2;
    const gaps = gapsOf(c.ops, i);
    for (const [u0, u1] of subtractGaps(-Li / 2, Li / 2, gaps)) {
      const p = wallXY(i, u0, nIn);
      const q = wallXY(i, u1, nIn);
      b.line('KC', p[0], p[1], q[0], q[1]);
    }
    const hi = Li / 2 + d.tw;
    for (const [u0, u1] of subtractGaps(-hi, hi, gaps)) {
      const p = wallXY(i, u0, nIn + d.tw);
      const q = wallXY(i, u1, nIn + d.tw);
      b.line('KC', p[0], p[1], q[0], q[1]);
    }
    // cạnh bên tại lỗ
    for (const [g0, g1] of gaps) for (const u of [g0, g1]) {
      const p = wallXY(i, u, nIn);
      const q = wallXY(i, u, nIn + d.tw);
      b.line('KC', p[0], p[1], q[0], q[1]);
    }
  }
  // vát góc đáy (nét đứt)
  const c5 = cfg.bottom.chamfer;
  if (c5 > 0) b.rect('LOT', -d.L / 2 + c5, -d.B / 2 + c5, d.L / 2 - c5, d.B / 2 - c5);

  // cống / rãnh
  const stub = 420;
  for (const o of c.ops) {
    const i = o.wall;
    const nIn = i % 2 === 0 ? d.B / 2 : d.L / 2;
    const e = o.pipe.t;
    const half = o.outerW / 2;
    const pc = (u: number, n: number): Pt => wallXY(i, o.uc + u, n);
    const nOut = nIn + d.tw + stub;
    // thành cống (2 dải) + vữa trát hai bên trong chiều dày tường
    const strips: Pt[][] = [];
    if (o.pipe.kind === 'round') {
      for (const sg of [-1, 1]) strips.push([pc(sg * half, nIn), pc(sg * (half - e), nIn), pc(sg * (half - e), nOut), pc(sg * half, nOut)]);
    } else {
      for (const sg of [-1, 1]) strips.push([pc(sg * half, nIn), pc(sg * (half - e), nIn), pc(sg * (half - e), nOut), pc(sg * half, nOut)]);
    }
    b.hatch(strips, 135, 1.8, 'HATCH');
    for (const sg of [-1, 1]) {
      const p1 = pc(sg * half, nIn);
      const p2 = pc(sg * half, nOut);
      const p3 = pc(sg * (half - e), nIn);
      const p4 = pc(sg * (half - e), nOut);
      b.line('CONG', p1[0], p1[1], p2[0], p2[1]);
      b.line('CONG', p3[0], p3[1], p4[0], p4[1]);
    }
    const t1 = pc(-half, nOut);
    const t2 = pc(half, nOut);
    b.line('CONG', t1[0], t1[1], t2[0], t2[1]);
    // đường tim cống
    const m1 = pc(0, nIn - b.paper(6));
    const m2 = pc(0, nOut + b.paper(3));
    b.line('TIM', m1[0], m1[1], m2[0], m2[1]);
    const lab = pc(half + b.paper(1.5), nOut - b.paper(1));
    b.text('TEXT', lab[0], lab[1], o.pipe.spec, 2.2, 'l');
  }

  // cổ ga (nét đứt, nằm trên trần)
  if (c.neck) neckOutline(b, c.neck, row.neck.t, 'LOT');
  // cửa thu
  const ig = c.info.hasInlet ? inletGeom(row, cfg) : null;
  if (ig) {
    const i = ig.wall;
    const nOut = (i % 2 === 0 ? d.B / 2 : d.L / 2) + d.tw;
    const pts: Pt[] = [wallXY(i, ig.along - ig.outerW / 2, nOut), wallXY(i, ig.along - ig.outerW / 2, nOut + ig.outerL), wallXY(i, ig.along + ig.outerW / 2, nOut + ig.outerL), wallXY(i, ig.along + ig.outerW / 2, nOut)];
    b.poly('KC', pts, false);
    const inner: Pt[] = [wallXY(i, ig.along - ig.holeW / 2, nOut), wallXY(i, ig.along - ig.holeW / 2, nOut + ig.clearLen), wallXY(i, ig.along + ig.holeW / 2, nOut + ig.clearLen), wallXY(i, ig.along + ig.holeW / 2, nOut)];
    b.poly('KC', inner, false);
    const tp = wallXY(i, ig.along, nOut + ig.outerL + b.paper(3));
    b.text('TEXT', tp[0], tp[1], 'Cửa thu', 2.2, 'c');
  }

  // tim ga
  const ext = b.paper(8);
  b.line('TIM', -lx - ext, 0, lx + ext, 0);
  b.line('TIM', 0, -ly - ext, 0, ly + ext);
  b.text('TEXT', lx + ext, 0, 'x', 2, 'l');

  // kích thước
  const gy = ly + b.paper(8);
  b.dimH(-d.ox, -d.L / 2, gy, d.oy, fmtMm(d.tw));
  b.dimH(-d.L / 2, d.L / 2, gy, d.oy, fmtMm(d.L));
  b.dimH(d.L / 2, d.ox, gy, d.oy, fmtMm(d.tw));
  b.dimH(-d.bx, d.bx, gy + b.paper(7), d.oy, fmtMm(2 * d.bx));
  const gx = lx + b.paper(8);
  b.dimV(-d.oy, -d.B / 2, gx, d.ox, fmtMm(d.tw));
  b.dimV(-d.B / 2, d.B / 2, gx, d.ox, fmtMm(d.B));
  b.dimV(d.B / 2, d.oy, gx, d.ox, fmtMm(d.tw));
  b.dimV(-d.by, d.by, gx + b.paper(7), d.ox, fmtMm(2 * d.by));
  // ký hiệu mặt cắt
  sectionMarks(b, d, lx, ly);
  // tên tường
  for (let i = 0; i < 4; i++) {
    const p = wallXY(i, 0, (i % 2 === 0 ? d.B / 2 : d.L / 2) - b.paper(4));
    b.text('TEXT', p[0], p[1] - (i % 2 === 0 ? b.paper(1.2) : 0), `T${i + 1}`, 2, 'c');
  }
  return { id: 'planBody', title: 'MẶT BẰNG THÂN GA', ents: b.ents };
}

function sectionMarks(b: Builder, d: Dims, lx: number, ly: number): void {
  const k = b.paper(4);
  // A-A: cắt theo trục x; B-B: theo trục y
  b.line('KC', -lx - b.paper(10), 0, -lx - b.paper(2), 0);
  b.text('TEXT', -lx - b.paper(14), b.paper(2), 'A', 3, 'c');
  b.text('TEXT', lx + b.paper(14), b.paper(2), 'A', 3, 'c');
  b.text('TEXT', b.paper(2), ly + b.paper(26), 'B', 3, 'c');
  b.text('TEXT', b.paper(2), -ly - b.paper(18), 'B', 3, 'c');
  void k;
  void d;
}

export function neckOutline(b: Builder, n: Neck, t: number, layer: 'LOT' | 'KC'): void {
  if (n.round) {
    b.circle(layer, n.cx, n.cy, n.a / 2);
    b.circle(layer, n.cx, n.cy, n.a / 2 + t);
  } else {
    b.rect(layer, n.cx - n.a / 2, n.cy - n.b / 2, n.cx + n.a / 2, n.cy + n.b / 2);
    b.rect(layer, n.cx - n.a / 2 - t, n.cy - n.b / 2 - t, n.cx + n.a / 2 + t, n.cy + n.b / 2 + t);
  }
}

export function planRoof(c: Ctx, s: number): View {
  const b = new Builder(s);
  const { d, cfg, row } = c;
  const slab = rectPoly(-d.ox, -d.oy, d.ox, d.oy);
  const hatchPolys: Pt[][] = [slab];
  if (c.info.hasNeck && c.neck) {
    const n = c.neck;
    hatchPolys.push(n.round ? circlePoly(n.cx, n.cy, n.a / 2) : rectPoly(n.cx - n.a / 2, n.cy - n.b / 2, n.cx + n.a / 2, n.cy + n.b / 2));
    b.hatch(hatchPolys, 45, 2.6);
    b.rect('KC', -d.ox, -d.oy, d.ox, d.oy);
    neckOutline(b, n, row.neck.t, 'KC');
    const cham = cfg.neck.chamfer ? parseDims(cfg.neck.chamferSize) : null;
    if (cham) {
      if (n.round) b.circle('LOT', n.cx, n.cy, n.a / 2 + cham[0]);
      else b.rect('LOT', n.cx - n.a / 2 - cham[0], n.cy - n.b / 2 - cham[0], n.cx + n.a / 2 + cham[0], n.cy + n.b / 2 + cham[0]);
    }
    lidDraw(c, b, n.cx, n.cy, n.a, n.b, n.round, row.neck.t, cham ? cham[0] : 0);
    if (c.info.precastRoof && cfg.precast.pin) {
      // chốt thép dọc tim tường, khoảng cách làm tròn đến 50 mm (HDSD §2.3.5)
      const sp = parseRebar(cfg.precast.pinSpec);
      if (sp) {
        const hx = d.L / 2 + d.tw / 2;
        const hy = d.B / 2 + d.tw / 2;
        const per = 4 * (hx + hy);
        const cnt = Math.max(4, Math.ceil(per / sp.spacing));
        const step = Math.max(50, Math.round(per / cnt / 50) * 50);
        for (let t = 0; t < per - 1; t += step) {
          const u = t;
          const e1 = 2 * hx;
          const e2 = 2 * hy;
          let px: number;
          let py: number;
          if (u < e1) [px, py] = [-hx + u, hy];
          else if (u < e1 + e2) [px, py] = [hx, hy - (u - e1)];
          else if (u < 2 * e1 + e2) [px, py] = [hx - (u - e1 - e2), -hy];
          else [px, py] = [-hx, -hy + (u - 2 * e1 - e2)];
          b.circle('LOT', px, py, Math.max(cfg.precast.pinHole / 2, b.paper(0.5)));
        }
      }
    }
    // kích thước cổ
    const gy = d.oy + b.paper(8);
    b.dimH(n.cx - n.a / 2, n.cx + n.a / 2, gy, d.oy, fmtMm(n.a));
    b.dimH(-d.ox, d.ox, gy + b.paper(7), d.oy, fmtMm(2 * d.ox));
    const gx = d.ox + b.paper(8);
    b.dimV(n.cy - n.b / 2, n.cy + n.b / 2, gx, d.ox, fmtMm(n.b));
    b.dimV(-d.oy, d.oy, gx + b.paper(7), d.ox, fmtMm(2 * d.oy));
  } else {
    // ga không cổ: tấm nắp đặt lên đỉnh tường
    b.rect('KC', -d.ox, -d.oy, d.ox, d.oy);
    b.rect('LOT', -d.L / 2, -d.B / 2, d.L / 2, d.B / 2);
    const slabs = lidSlabs(row, cfg, c.info);
    if (slabs) {
      const { n, len, wid } = slabs;
      const tc = cfg.wall.topChamfer.on ? parseDims(cfg.wall.topChamfer.size) : null;
      const ext = tc ? tc[0] : d.tw;
      const gap = cfg.lid.gap;
      const totalX = d.L + 2 * ext;
      const totalY = d.B + 2 * ext;
      for (let k = 0; k < n; k++) {
        if (cfg.lid.dir === 'Dọc') {
          const x0 = -totalX / 2 + (tc ? gap : 0) + k * (len + gap);
          b.hatch([rectPoly(x0, -wid / 2, x0 + len, wid / 2)], 45, 2.8);
          b.rect('KC', x0, -wid / 2, x0 + len, wid / 2);
        } else {
          const y0 = -totalY / 2 + (tc ? gap : 0) + k * (wid + gap);
          b.hatch([rectPoly(-len / 2, y0, len / 2, y0 + wid)], 45, 2.8);
          b.rect('KC', -len / 2, y0, len / 2, y0 + wid);
        }
      }
    } else {
      b.line('KC', -d.L / 2, -d.B / 2, d.L / 2, d.B / 2);
      b.line('KC', -d.L / 2, d.B / 2, d.L / 2, -d.B / 2);
    }
    const gy = d.oy + b.paper(8);
    b.dimH(-d.ox, d.ox, gy, d.oy, fmtMm(2 * d.ox));
    b.dimV(-d.oy, d.oy, d.ox + b.paper(8), d.ox, fmtMm(2 * d.oy));
  }
  const ext = b.paper(8);
  b.line('TIM', -d.ox - ext, 0, d.ox + ext, 0);
  b.line('TIM', 0, -d.oy - ext, 0, d.oy + ext);
  return { id: 'planRoof', title: c.info.hasNeck ? 'MẶT BẰNG TRẦN GA' : 'MẶT BẰNG TẤM NẮP', ents: b.ents };
}

export function lidDraw(c: Ctx, b: Builder, cx: number, cy: number, a: number, bb: number, round: boolean, tNeck: number, cham: number): void {
  const { cfg } = c;
  if (cfg.lid.type === 'Gang') {
    // nắp gang: theo kích thước ghi trong tên block, có đường chéo; vát nắp vẽ nét đứt
    const blk = lidBlockDims(cfg.lid.block);
    const bwid = blk ? blk[0] : a;
    const bhei = blk ? blk[1] : bb;
    const rc = cfg.lid.recess ? parseDims(cfg.lid.recessSize) : null;
    if (rc) {
      if (round) b.circle('LOT', cx, cy, a / 2 + rc[0]);
      else b.rect('LOT', cx - a / 2 - rc[0], cy - bb / 2 - rc[0], cx + a / 2 + rc[0], cy + bb / 2 + rc[0]);
    }
    if (round) {
      b.circle('KC', cx, cy, bwid / 2 - 20);
      b.line('KC', cx - bwid / 2 + 20, cy, cx + bwid / 2 - 20, cy);
      b.line('KC', cx, cy - bwid / 2 + 20, cx, cy + bwid / 2 - 20);
    } else {
      b.rect('KC', cx - bwid / 2 + 20, cy - bhei / 2 + 20, cx + bwid / 2 - 20, cy + bhei / 2 - 20);
      b.line('KC', cx - bwid / 2 + 20, cy - bhei / 2 + 20, cx + bwid / 2 - 20, cy + bhei / 2 - 20);
      b.line('KC', cx - bwid / 2 + 20, cy + bhei / 2 - 20, cx + bwid / 2 - 20, cy - bhei / 2 + 20);
    }
    b.text('TEXT', cx, cy - Math.max(bhei, bwid) / 2 - b.paper(4), cfg.lid.block.replace(/\.(MB|AA|BB)$/i, ''), 2, 'c');
    return;
  }
  const slabs = lidSlabs(c.row, cfg, c.info);
  if (!slabs) return;
  const { n, len, wid } = slabs;
  const gap = cfg.lid.gap;
  const rx = cham ? a + 2 * cham : a + 2 * tNeck;
  const ry = cham ? bb + 2 * cham : bb + 2 * tNeck;
  for (let k = 0; k < n; k++) {
    if (cfg.lid.dir === 'Dọc') {
      const x0 = cx - rx / 2 + (cham ? gap : 0) + k * (len + gap);
      b.rect('KC', x0, cy - wid / 2, x0 + len, cy + wid / 2);
    } else {
      const y0 = cy - ry / 2 + (cham ? gap : 0) + k * (wid + gap);
      b.rect('KC', cx - len / 2, y0, cx + len / 2, y0 + wid);
    }
  }
}

/* ================================================================== MẶT CẮT */

interface Axis {
  id: 'A' | 'B';
  /** nửa chiều dài lòng ga theo trục ngang */
  half: number;
  /** chỉ số tường trái / phải trong mặt cắt */
  left: 0 | 1 | 2 | 3;
  right: 0 | 1 | 2 | 3;
  /** toạ độ cổ dọc / ngang mặt cắt */
  along: (n: Neck) => number;
  cross: (n: Neck) => number;
  ext: (n: Neck) => [number, number];
}
const AXIS_A: Axis = { id: 'A', half: 0, left: 3, right: 1, along: (n) => n.cx, cross: (n) => n.cy, ext: (n) => [n.a, n.b] };
const AXIS_B: Axis = { id: 'B', half: 0, left: 2, right: 0, along: (n) => n.cy, cross: (n) => n.cx, ext: (n) => [n.b, n.a] };

export function axisOf(c: Ctx, id: 'A' | 'B'): Axis & { half: number; other: number } {
  const base = id === 'A' ? AXIS_A : AXIS_B;
  return { ...base, half: (id === 'A' ? c.d.L : c.d.B) / 2, other: (id === 'A' ? c.d.B : c.d.L) / 2 };
}

/** Lỗ trên tường `i` bị mặt cắt cắt qua (mặt phẳng cắt đi qua tim tường). */
export function cutOpening(c: Ctx, i: number): WallOpening | undefined {
  return c.ops.find((o) => o.wall === i && Math.abs(o.uc) < o.w / 2);
}

export function sectionBase(c: Ctx, b: Builder, id: 'A' | 'B'): { ax: ReturnType<typeof axisOf>; zTop: number } {
  const ax = axisOf(c, id);
  const { d, cfg, row, info } = c;
  const ho = ax.half + d.tw; // nửa chiều rộng ngoài
  const bw = ho + cfg.bottom.ext;
  const neck = c.neck;
  const l1 = cfg.liner.l1T;
  const l2 = cfg.liner.l2T;
  const hatchPolys: Pt[][] = [];
  const lotPolys: Pt[][] = [];
  const draw = (pts: Pt[]) => b.poly('KC', pts, true);
  const ig = info.hasInlet ? inletGeom(row, cfg) : null;

  // lớp lót
  if (l1 > 0) {
    const e = bw + cfg.liner.l1Ext;
    lotPolys.push(rectPoly(-e, -d.tb - l1, e, -d.tb));
    b.rect('KC', -e, -d.tb - l1, e, -d.tb);
  }
  if (l2 > 0) {
    const e = bw + cfg.liner.l2Ext;
    lotPolys.push(rectPoly(-e, -d.tb - l1 - l2, e, -d.tb - l1));
    b.rect('KC', -e, -d.tb - l1 - l2, e, -d.tb - l1);
  }
  // bản đáy + vát
  const c5 = cfg.bottom.chamfer;
  const baseOutline: Pt[] = [[-bw, -d.tb], [bw, -d.tb], [bw, 0], [ax.half + 0, 0]];
  if (c5 > 0) {
    baseOutline.push([ax.half - c5, 0], [ax.half, c5]); // sẽ bổ sung tường bên phải bằng polygon liền
  }
  // ghép cả đáy + tường thành một đa giác mỗi bên để viền gọn
  const roofZ = d.H;
  // trần đúc sẵn: vữa đệm nằm giữa đỉnh tường và đáy trần (chiều cao lòng ga đã gồm lớp vữa)
  const mortarT = info.precastRoof && info.hasNeck ? cfg.precast.mortar : 0;
  const wallTop = roofZ - mortarT;
  const pieces: Pt[][] = [];
  const wallL = c.ops.find((o) => o.wall === ax.left);
  void wallL;
  const side = (sg: -1 | 1) => {
    const wi = sg === -1 ? ax.left : ax.right;
    const op = cutOpening(c, wi);
    const x0 = sg * ax.half;
    const x1 = sg * ho;
    const xa = Math.min(x0, x1);
    const xb = Math.max(x0, x1);
    const notch = !info.hasNeck && cfg.wall.topChamfer.on ? parseDims(cfg.wall.topChamfer.size) : null;
    const top = wallTop;
    let segs: [number, number][] = op ? [[0, Math.max(0, op.z0)], [Math.min(top, op.z1), top]] : [[0, top]];
    if (ig && ig.wall === wi && cfg.inlet.place === 'Thân ga' && Math.abs(ig.along) < ig.holeW / 2) segs = segs.map(([a, bb]) => [a, Math.min(bb, top - ig.holeH)] as [number, number]).filter(([a, bb]) => bb > a);
    for (const [z0, z1] of segs) {
      if (z1 - z0 <= 0.5) continue;
      pieces.push(rectPoly(xa, z0, xb, z1));
    }
    return { op, xa, xb, notch };
  };
  const L = side(-1);
  const R = side(1);
  if (mortarT > 0) {
    for (const sd of [L, R]) {
      const mp = rectPoly(sd.xa, wallTop, sd.xb, roofZ);
      lotPolys.push(mp);
      b.poly('LOT', mp, true);
    }
  }
  const base: Pt[] = rectPoly(-bw, -d.tb, bw, 0);
  hatchPolys.push(base, ...pieces);
  // vát góc đáy: tam giác bê tông trong lòng ga
  if (c5 > 0) {
    for (const sg of [-1, 1]) {
      const p: Pt[] = [[sg * ax.half, 0], [sg * (ax.half - c5), 0], [sg * ax.half, c5]];
      hatchPolys.push(p);
      b.poly('KC', p, true);
    }
  }
  void draw;
  void baseOutline;
  // trần
  let hole: [number, number] | null = null;
  if (info.hasNeck) {
    const rr = rectPoly(-ho, roofZ, ho, roofZ + d.tr);
    if (neck) {
      const [ea, eb] = ax.ext(neck);
      const cr = ax.cross(neck);
      const hw = neck.round ? Math.sqrt(Math.max(0, (neck.a / 2) ** 2 - cr ** 2)) : Math.abs(cr) < eb / 2 ? ea / 2 : -1;
      if (hw > 0) hole = [ax.along(neck) - hw, ax.along(neck) + hw];
    }
    if (hole) {
      hatchPolys.push(rectPoly(-ho, roofZ, hole[0], roofZ + d.tr), rectPoly(hole[1], roofZ, ho, roofZ + d.tr));
    } else hatchPolys.push(rr);
  }
  // cổ ga
  let zTop = roofZ + (info.hasNeck ? d.tr : 0);
  if (neck && info.hasNeck) {
    const [ea, eb] = ax.ext(neck);
    const al = ax.along(neck);
    const cr = ax.cross(neck);
    const V = row.neck.t;
    const zn0 = roofZ + d.tr;
    const zn1 = zn0 + row.neck.h;
    const cuts = hole !== null;
    if (cuts && hole) {
      const wl = rectPoly(hole[0] - V, zn0, hole[0], zn1);
      const wr = rectPoly(hole[1], zn0, hole[1] + V, zn1);
      hatchPolys.push(wl, wr);
      b.poly('KC', wl, true);
      b.poly('KC', wr, true);
    } else {
      // cổ nằm ngoài mặt phẳng cắt: vẽ hình chiếu
      b.rect('KC', al - ea / 2 - V, zn0, al + ea / 2 + V, zn1);
      b.rect('LOT', al - ea / 2, zn0, al + ea / 2, zn1);
    }
    void cr;
    void eb;
    zTop = zn1;
    const lidH = cfg.lid.height;
    if (lidH > 0) {
      const cham = cfg.neck.chamfer ? parseDims(cfg.neck.chamferSize) : null;
      const lx0 = al - ea / 2 - (cham ? cham[0] : V);
      const lx1 = al + ea / 2 + (cham ? cham[0] : V);
      if (cfg.lid.type === 'Gang') {
        const rc = cfg.lid.recess ? parseDims(cfg.lid.recessSize) : null;
        const blk = lidBlockDims(cfg.lid.block);
        const bx = blk ? (ax.id === 'A' ? blk[0] : blk[1]) : ea;
        if (rc && rc.length >= 2 && hole) {
          // vành đỡ nắp: hai mảnh bê tông có bậc lõm ở mép trong đỉnh cổ
          const zt = zn1 + lidH;
          const ring = (sg: -1 | 1): Pt[] => {
            const xi = sg === -1 ? hole![0] : hole![1];
            const xo = xi + sg * V;
            return [[xi, zn1], [xo, zn1], [xo, zt], [xi - sg * rc[0], zt], [xi - sg * rc[0], zt - rc[1]], [xi, zt - rc[1]]];
          };
          for (const sg of [-1, 1] as const) {
            const rp = ring(sg);
            hatchPolys.push(rp);
            b.poly('KC', rp, true);
          }
          b.rect('KC', hole[0] - rc[0] + 2, zt - rc[1], hole[1] + rc[0] - 2, zt);
        } else if (rc && rc.length >= 2) {
          b.rect('KC', al - ea / 2 - V, zn1, al + ea / 2 + V, zn1 + lidH);
          b.rect('LOT', al - bx / 2, zn1 + lidH - rc[1], al + bx / 2, zn1 + lidH);
        } else {
          b.rect('KC', al - ea / 2 - (cham ? cham[0] : 0), zn1, al + ea / 2 + (cham ? cham[0] : 0), zn1 + lidH);
          b.line('KC', al - ea / 2, zn1 + lidH, al + ea / 2, zn1 + lidH);
        }
        void lx0;
        void lx1;
      } else {
        const slabs = lidSlabs(row, cfg, c.info);
        if (slabs) {
          const hatched = rectPoly(lx0, zn1, lx1, zn1 + lidH);
          hatchPolys.push(hatched);
          b.poly('KC', hatched, true);
        }
      }
      zTop = zn1 + lidH;
    }
  } else if (!info.hasNeck) {
    // tấm nắp ga không cổ
    const slabs = lidSlabs(row, cfg, info);
    const tc = cfg.wall.topChamfer.on ? parseDims(cfg.wall.topChamfer.size) : null;
    const ext = tc ? tc[0] : d.tw;
    const tt = row.roof.t;
    const x0 = -(ax.half + ext);
    const x1 = ax.half + ext;
    const z0 = roofZ - (tc ? tc[1] : 0);
    if (slabs) {
      const hh = rectPoly(x0 + (tc ? cfg.lid.gap : 0), z0, x1 - (tc ? cfg.lid.gap : 0), z0 + tt);
      hatchPolys.push(hh);
      b.poly('KC', hh, true);
    }
    zTop = z0 + tt;
  }

  // cửa thu nước nằm trên mặt phẳng cắt
  if (ig && cfg.inlet.place === 'Thân ga' && Math.abs(ig.along) < ig.holeW / 2 && (ig.wall === ax.left || ig.wall === ax.right)) {
    const sg = ig.wall === ax.left ? -1 : 1;
    const xf = sg * ho;
    const zf = d.H - ig.clearH;
    const x1 = xf + sg * ig.clearLen;
    const x2 = xf + sg * ig.outerL;
    const base = rectPoly(Math.min(xf, x2), zf - ig.tb, Math.max(xf, x2), zf);
    const end = rectPoly(Math.min(x1, x2), zf, Math.max(x1, x2), d.H + ig.beamH);
    for (const pg of [base, end]) {
      hatchPolys.push(pg);
      b.poly('KC', pg, true);
    }
    if (ig.linerT > 0) {
      const lt = rectPoly(Math.min(xf, x2 + sg * ig.linerExt), zf - ig.tb - ig.linerT, Math.max(xf, x2 + sg * ig.linerExt), zf - ig.tb);
      lotPolys.push(lt);
      b.poly('LOT', lt, true);
    }
  }
  // tô vật liệu (như bản vẽ mẫu VHGpro: bê tông ANSI32 × 4·tỷ lệ + AR-CONC × 0,4·tỷ lệ; bê tông lót / đệm AR-CONC)
  b.hatchPat(hatchPolys, 'ANSI32', 4);
  b.hatchPat(hatchPolys, 'AR-CONC', 0.4);
  b.hatchPat(lotPolys, 'AR-CONC', 0.4);
  // viền BTCT (đáy + tường)
  b.rect('KC', -bw, -d.tb, bw, 0);
  for (const sd of [L, R]) {
    const segs = sd.op ? [[0, Math.max(0, sd.op.z0)], [Math.min(wallTop, sd.op.z1), wallTop]] : [[0, wallTop]];
    for (const [z0, z1] of segs) if (z1 - z0 > 0.5) b.rect('KC', sd.xa, z0, sd.xb, z1);
  }
  if (info.hasNeck) {
    if (hole) {
      b.rect('KC', -ho, roofZ, hole[0], roofZ + d.tr);
      b.rect('KC', hole[1], roofZ, ho, roofZ + d.tr);
    } else b.rect('KC', -ho, roofZ, ho, roofZ + d.tr);
  }
  // cống đi qua tường
  for (const sd of [L, R]) {
    const op = sd.op;
    if (!op) continue;
    const e = op.pipe.t;
    const xa = sd.xa;
    const xb = sd.xb;
    const stub = 380;
    const xo = sd === L ? xa - stub : xb + stub;
    const strips: Pt[][] = [];
    const [zo0, zo1] = [op.z0 + cfg.pipeHole.plaster, op.z1 - (op.pipe.kind === 'ditch' ? 0 : cfg.pipeHole.plaster)];
    const xin = sd === L ? xb : xa;
    const xlo = Math.min(xo, xin);
    const xhi = Math.max(xo, xin);
    strips.push(rectPoly(xlo, zo0, xhi, zo0 + e));
    if (op.pipe.kind !== 'ditch') strips.push(rectPoly(xlo, zo1 - e, xhi, zo1));
    b.hatchPat(strips, 'ANSI37', 4);
    strips.forEach((st) => b.poly('CONG', st, true));
    // nhãn loại cống cạnh tim cống và chú thích vữa trát có đường dẫn gạch chân (như bản mẫu)
    const dirP = sd === L ? -1 : 1;
    b.text('TEXT', xlo - b.paper(1), (zo0 + zo1) / 2 + b.paper(0.8), op.pipe.spec, 2, dirP === -1 ? 'r' : 'l');
    {
      const px = (xa + xb) / 2;
      const pz = op.z0 + cfg.pipeHole.plaster / 2;
      const tx = dirP === -1 ? xlo - b.paper(6) : xhi + b.paper(6);
      const tz = op.z0 - b.paper(9);
      const txt = cfg.materials.plaster;
      const len = b.paper(1.8) + txt.length * b.paper(2) * 0.55;
      b.line('NET', px, pz, tx, tz);
      b.line('NET', tx, tz, tx - dirP * -len, tz);
      b.text('TEXT', tx + (dirP === -1 ? -b.paper(0.8) : b.paper(0.8)), tz + b.paper(0.8), txt, 2, dirP === -1 ? 'r' : 'l');
    }
    // lỗ trát
    b.line('CONG', xa, op.z0, xb, op.z0);
    if (op.pipe.kind !== 'ditch') b.line('CONG', xa, op.z1, xb, op.z1);
    b.line('TIM', xlo - b.paper(2), (zo0 + zo1) / 2, xhi, (zo0 + zo1) / 2);
  }
  // chốt thép liên kết tường – trần đúc sẵn
  if (mortarT >= 0 && info.precastRoof && info.hasNeck && cfg.precast.pin) {
    for (const sg of [-1, 1]) {
      const xm = sg * (ax.half + d.tw / 2);
      b.line('THEP', xm, wallTop - cfg.precast.pinLen / 2, xm, Math.min(roofZ + d.tr - cfg.cover.roof, roofZ + cfg.precast.pinLen / 2));
    }
  }
  // thang thép: các bậc nhô vào lòng ga `depth` mm tại tường đặt thang
  const lw = ladderWall(cfg, info.hasNeck);
  if (lw !== null && (lw === ax.left || lw === ax.right)) {
    const sg = lw === ax.left ? -1 : 1;
    for (const z of ladderLevels(row, cfg, info)) {
      b.line('THEP', sg * ax.half, z, sg * (ax.half - cfg.ladder.depth), z);
      b.circle('THEP', sg * (ax.half - cfg.ladder.depth), z, Math.max(cfg.ladder.dia / 2, b.paper(0.5)), true);
    }
    b.text('TEXT', sg * (ax.half - cfg.ladder.depth - b.paper(2)), d.H * 0.5, `${cfg.ladder.prefix} Ø${cfg.ladder.dia}`, 2, sg === 1 ? 'r' : 'l', 90);
  }
  // ghi chú vật liệu: một đường dẫn đứng xuyên bản đáy và các lớp lót, các dòng chữ gạch chân xếp bên dưới (như bản mẫu)
  const zb = -d.tb - l1 - l2 - b.paper(10);
  {
    const m = cfg.materials;
    const notes: [string, number][] = [[m.body, -d.tb / 2]];
    if (l1 > 0) notes.push([m.liner1, -d.tb - l1 / 2]);
    if (l2 > 0) notes.push([m.liner2, -d.tb - l1 - l2 / 2]);
    const nx = -bw * 0.28;
    const h = b.paper(2);
    const row = b.paper(3.4);
    const zTxt = zb - b.paper(7) - b.paper(10);
    b.line('NET', nx, notes[0][1], nx, zTxt - row * (notes.length - 1) + b.paper(0.8));
    for (const [, z] of notes) b.circle('THEP', nx, z, b.paper(0.35), true);
    notes.forEach(([t, ], i) => {
      const y = zTxt - row * i;
      b.text('TEXT', nx + b.paper(0.8), y + b.paper(0.8), t, 2, 'l');
      b.line('NET', nx, y, nx + b.paper(1.6) + t.length * h * 0.55, y);
    });
  }
  // kích thước ngang
  b.dimH(-ho, -ax.half, zb, -d.tb - l1 - l2, fmtMm(d.tw));
  b.dimH(-ax.half, ax.half, zb, -d.tb - l1 - l2, fmtMm(2 * ax.half));
  b.dimH(ax.half, ho, zb, -d.tb - l1 - l2, fmtMm(d.tw));
  b.dimH(-bw, bw, zb - b.paper(7), -d.tb - l1 - l2, fmtMm(2 * bw));
  // kích thước đứng (bên phải)
  const xr = bw + cfg.liner.l1Ext + b.paper(9);
  const chain: [number, number, string][] = [
    [-d.tb, 0, fmtMm(d.tb)],
    [0, d.H, `${cfg.wall.prefix}${fmtMm(d.H)}`],
  ];
  if (info.hasNeck) {
    chain.push([d.H, d.H + d.tr, fmtMm(d.tr)]);
    if (neck) chain.push([d.H + d.tr, d.H + d.tr + row.neck.h, `${cfg.neck.prefix}${fmtMm(row.neck.h)}`]);
    if (cfg.lid.height > 0 && neck) chain.push([d.H + d.tr + row.neck.h, zTop, fmtMm(cfg.lid.height)]);
  }
  for (const [z0, z1, lab] of chain) b.dimV(z0, z1, xr, bw + cfg.liner.l1Ext, lab);
  // cao trình
  levelMarks(c, b, xr + b.paper(9), zTop, ax, ho);
  b.line('TIM', 0, -d.tb - l1 - l2 - b.paper(3), 0, zTop + b.paper(5));
  return { ax, zTop };
}

function levelMarks(c: Ctx, b: Builder, x: number, zTop: number, ax: ReturnType<typeof axisOf>, ho: number): void {
  const lv = c.res.qty;
  const rel = c.cfg.levels.mode === 'Tương đối';
  if (!rel && lv.levelBottom === null) return;
  const labels = c.cfg.levels.labels;
  const tri = (px: number, z: number, label: string, side: 1 | -1 = 1) => {
    const k = b.paper(1.6);
    b.poly('KT', [[px, z], [px - k, z + k * 1.5], [px + k, z + k * 1.5]], true);
    b.line('KT', px - b.paper(6), z, px + b.paper(6), z);
    b.text('KT', px + side * b.paper(2), z + b.paper(0.8), label, 2.2, side === 1 ? 'l' : 'r');
  };
  const abs = (z: number) => (lv.levelBottom === null ? '' : levelTxt(lv.levelBottom + z / 1000));
  tri(x, 0, rel ? labels[0] : abs(0));
  tri(x, zTop, rel ? labels[1] : abs(zTop));
  // cao trình đáy cống tại các tường nằm trên mặt phẳng cắt
  for (const sg of [-1, 1] as const) {
    const wi = sg === -1 ? ax.left : ax.right;
    const o = c.ops.find((q) => q.wall === wi && Math.abs(q.uc) < q.w / 2);
    if (!o) continue;
    const z = o.z0 + o.pipe.t + c.cfg.pipeHole.plaster;
    tri(sg * (ho + 380), z, rel ? labels[2 + wi] : abs(z), sg);
  }
}

export function section(c: Ctx, s: number, id: 'A' | 'B'): View {
  const b = new Builder(s);
  sectionBase(c, b, id);
  return { id: `section${id}`, title: `MẶT CẮT ${id}-${id}`, ents: b.ents };
}

/* ================================================================== CỐT THÉP */

/** Vẽ lớp thép (đường) và các thanh vuông góc mặt cắt (chấm). */
export function sectionRebar(c: Ctx, s: number, id: 'A' | 'B'): View {
  const b = new Builder(s);
  const { ax, zTop } = sectionBase(c, b, id);
  const { d, cfg, row, info } = c;
  void zTop;
  const ho = ax.half + d.tw;
  const bw = ho + cfg.bottom.ext;
  const dot = (x: number, z: number, _dia: number) => b.circle('THEP', x, z, Math.max(cfg.cover.notch / 2, b.paper(0.3)), true);
  const barLine = (x0: number, z0: number, x1: number, z1: number) => b.line('THEP', x0, z0, x1, z1);
  const mark = (x: number, z: number, text: string, dx = 0, dz = 0) => {
    const dir = dx >= 0 ? 1 : -1;
    const len = b.paper(1.8) + text.length * b.paper(2) * 0.55;
    b.line('NET', x, z, x + dx, z + dz);
    b.line('NET', x + dx, z + dz, x + dx + dir * len, z + dz);
    b.text('TEXT', x + dx + dir * b.paper(0.8), z + dz + b.paper(0.8), text, 2, dir === 1 ? 'l' : 'r');
    b.circle('THEP', x, z, b.paper(0.35), true);
  };

  // ---- bản đáy: lớp dưới (đường) + lớp trên (đường) ; thanh phương kia = chấm
  const cb = cfg.cover.bottom;
  const low = parseRebar(row.bottom.low);
  const up = parseRebar(row.bottom.up);
  const hk = (n: 0 | 1 | 2, dia: number) => (cfg.fmt.hook === 'Theo KC' ? d.tb - 2 * cb : Math.min(cfg.fmt.hookN * dia, d.tb - 2 * cb)) * (n ? 1 : 0);
  if (low) {
    const z = -d.tb + cb;
    const h = parseHooks(cfg.fmt.bottomLow);
    const pts: [number, number][] = [];
    if (h >= 1) pts.push([-bw + cb, z + hk(h, low.dia)]);
    pts.push([-bw + cb, z], [bw - cb, z]);
    if (h >= 2) pts.push([bw - cb, z + hk(h, low.dia)]);
    b.poly('THEP', pts, false);
    const sp = spaced(2 * (bw - cb), low.spacing, cfg.fmt.mesh, 2);
    sp.pos.forEach((p) => dot(-bw + cb + p, z + low.dia, low.dia));
    mark(bw - cb - 100, z, 'Đáy dưới', b.paper(7), -b.paper(6));
  }
  if (up) {
    const z = -cb;
    const h = parseHooks(cfg.fmt.bottomUp);
    const pts: [number, number][] = [];
    if (h >= 1) pts.push([-bw + cb, z - hk(h, up.dia)]);
    pts.push([-bw + cb, z], [bw - cb, z]);
    if (h >= 2) pts.push([bw - cb, z - hk(h, up.dia)]);
    b.poly('THEP', pts, false);
    const sp = spaced(2 * (bw - cb), up.spacing, cfg.fmt.mesh, 2);
    sp.pos.forEach((p) => dot(-bw + cb + p, z - up.dia, up.dia));
    mark(bw / 3, z, 'Đáy trên', b.paper(7), -b.paper(15));
  }
  // ---- tường: thép đứng (đường) + thép ngang (chấm)
  const cw = cfg.cover.wall;
  const outSpec = parseRebar(row.wall.out);
  const inSpec = parseRebar(row.wall.in);
  const integral = info.hasNeck && !info.precastRoof;
  const zTopBar = d.H + (integral ? d.tr - cfg.cover.roof : -cw);
  for (const sg of [-1, 1]) {
    const op = cutOpening(c, sg === -1 ? ax.left : ax.right);
    for (const [spec, xs, name] of [
      [outSpec, sg * (ho - cw), 'ngoài'],
      [inSpec, sg * (ax.half + cw), 'trong'],
    ] as const) {
      if (!spec) continue;
      const segs: [number, number][] = op ? [[-(d.tb - cb), op.z0 - cw], [op.z1 + cw, zTopBar]] : [[-(d.tb - cb), zTopBar]];
      for (const [z0, z1] of segs) if (z1 - z0 > 5) barLine(xs, z0, xs, z1);
      const dH = reduceDia(spec.dia, cfg.wall.dRed);
      const sph = spaced(d.H - 2 * cw, spec.spacing + cfg.wall.horizAdj, cfg.fmt.mesh);
      const xdot = sg * (name === 'ngoài' ? ho - cw - spec.dia : ax.half + cw + spec.dia);
      sph.pos.forEach((p) => {
        const z = cw + p;
        if (op && z >= op.z0 - cw && z <= op.z1 + cw) return;
        dot(xdot, z, dH);
      });
      mark(xs, d.H * (name === 'ngoài' ? 0.72 : 0.5), `T${(sg === -1 ? ax.left : ax.right) + 1} ${name}`, sg * b.paper(name === 'ngoài' ? 9 : -9), b.paper(name === 'ngoài' ? 6 : -4));
    }
  }
  // ---- trần
  if (info.hasNeck) {
    const cr = cfg.cover.roof;
    const lowR = parseRebar(row.roof.low);
    const upR = parseRebar(row.roof.up);
    const z0 = d.H + cr;
    const z1 = d.H + d.tr - cr;
    if (lowR) {
      barLine(-ho + cr, z0, ho - cr, z0);
      spaced(2 * (ho - cr), lowR.spacing, cfg.fmt.mesh).pos.forEach((p) => dot(-ho + cr + p, z0 + lowR.dia, lowR.dia));
    }
    if (upR) {
      barLine(-ho + cr, z1, ho - cr, z1);
      spaced(2 * (ho - cr), upR.spacing, cfg.fmt.mesh).pos.forEach((p) => dot(-ho + cr + p, z1 - upR.dia, upR.dia));
      mark(-ho + cr + 60, z1, 'Trần trên', -b.paper(8), b.paper(5));
    }
    if (lowR) mark(ho - cr - 60, z0, 'Trần dưới', b.paper(8), -b.paper(7));
  }
  // ---- cổ
  const neck = c.neck;
  if (neck && cfg.neck.structure === 'BTCT') {
    const [ea] = ax.ext(neck);
    const al = ax.along(neck);
    const V = row.neck.t;
    const cn = cfg.cover.neck;
    const zn0 = d.H + d.tr;
    const zn1 = zn0 + row.neck.h;
    const o = parseRebar(row.neck.out);
    const i2 = parseRebar(row.neck.in);
    if (o) mark(al + (ea / 2 + V - cn), zn0 + row.neck.h * 0.5, 'Cổ ga', b.paper(12), b.paper(4));
    for (const sg of [-1, 1]) {
      if (o) barLine(al + sg * (ea / 2 + V - cn), zn0 - (d.tr - cfg.cover.roof), al + sg * (ea / 2 + V - cn), zn1 - cn);
      if (i2) barLine(al + sg * (ea / 2 + cn), zn0, al + sg * (ea / 2 + cn), zn1 - cn);
    }
    if (o) spaced(row.neck.h - 2 * cn, o.spacing + cfg.neck.horizAdj, cfg.fmt.mesh).pos.forEach((p) => {
      dot(al + (ea / 2 + V - cn - o.dia), zn0 + cn + p, o.dia);
      dot(al - (ea / 2 + V - cn - o.dia), zn0 + cn + p, o.dia);
    });
  }
  // ---- tấm nắp BTCT (ga không cổ)
  if (!info.hasNeck) {
    const slabs = lidSlabs(row, cfg, info);
    const tc = cfg.wall.topChamfer.on ? parseDims(cfg.wall.topChamfer.size) : null;
    if (slabs) {
      const cl = cfg.cover.lid;
      const z0 = d.H - (tc ? tc[1] : 0);
      const lowL = parseRebar(row.roof.low);
      const upL = parseRebar(row.roof.up);
      const e = (tc ? tc[0] : d.tw) + ax.half;
      if (lowL) barLine(-e + cl, z0 + cl, e - cl, z0 + cl);
      if (upL) barLine(-e + cl, z0 + slabs.thick - cl, e - cl, z0 + slabs.thick - cl);
    }
  }
  // ghi chú vát góc
  const ch = cfg.bottom.chamfer;
  if (ch > 0 && cfg.bottom.chamferDia > 0) {
    for (const sg of [-1, 1]) barLine(sg * (ax.half - ch + 20), 20 + cfg.bottom.chamferDia, sg * (ax.half - 20), ch - 20 + cfg.bottom.chamferDia);
  }
  return { id: `rebar${id}`, title: `CỐT THÉP MẶT CẮT ${id}-${id}`, ents: b.ents };
}

/** Mặt bằng cốt thép một lớp của bản đáy hoặc trần. */
export function planRebar(c: Ctx, s: number, part: 'bottom' | 'roof', layer: 'low' | 'up'): View {
  const b = new Builder(s);
  const { d, cfg, row } = c;
  const isBottom = part === 'bottom';
  const w = isBottom ? 2 * d.bx : 2 * d.ox;
  const h = isBottom ? 2 * d.by : 2 * d.oy;
  const cover = isBottom ? cfg.cover.bottom : cfg.cover.roof;
  const spec = parseRebar(isBottom ? (layer === 'low' ? row.bottom.low : row.bottom.up) : layer === 'low' ? row.roof.low : row.roof.up);
  b.rect('KC', -w / 2, -h / 2, w / 2, h / 2);
  if (isBottom) b.rect('LOT', -d.ox, -d.oy, d.ox, d.oy);
  const hole = !isBottom && c.neck ? c.neck : null;
  if (hole) {
    if (hole.round) b.circle('KC', hole.cx, hole.cy, hole.a / 2);
    else b.rect('KC', hole.cx - hole.a / 2, hole.cy - hole.b / 2, hole.cx + hole.a / 2, hole.cy + hole.b / 2);
  }
  if (spec) {
    const ex = isBottom ? 2 : 1;
    const ax = spaced(w - 2 * cover, spec.spacing, cfg.fmt.mesh, ex);
    const ay = spaced(h - 2 * cover, spec.spacing, cfg.fmt.mesh, ex);
    ay.pos.forEach((p) => {
      const y = -h / 2 + cover + p;
      let segs: [number, number][] = [[-w / 2 + cover, w / 2 - cover]];
      if (hole) {
        const half = hole.round ? Math.sqrt(Math.max(0, (hole.a / 2) ** 2 - (y - hole.cy) ** 2)) : Math.abs(y - hole.cy) <= hole.b / 2 ? hole.a / 2 : -1;
        if (half > 0) segs = subtractGaps(segs[0][0], segs[0][1], [[hole.cx - half, hole.cx + half]]);
      }
      segs.forEach(([a, bb]) => b.line('THEP', a, y, bb, y));
    });
    ax.pos.forEach((p) => {
      const x = -w / 2 + cover + p;
      let segs: [number, number][] = [[-h / 2 + cover, h / 2 - cover]];
      if (hole) {
        const half = hole.round ? Math.sqrt(Math.max(0, (hole.a / 2) ** 2 - (x - hole.cx) ** 2)) : Math.abs(x - hole.cx) <= hole.a / 2 ? hole.b / 2 : -1;
        if (half > 0) segs = subtractGaps(segs[0][0], segs[0][1], [[hole.cy - half, hole.cy + half]]);
      }
      segs.forEach(([a, bb]) => b.line('THEP', x, a, x, bb));
    });
    b.text('TEXT', 0, h / 2 + b.paper(4), `Ø${spec.dia}${cfg.fmt.densSym}${spec.spacing}`, 2.6, 'c');
  }
  b.dimH(-w / 2, w / 2, -h / 2 - b.paper(8), -h / 2, fmtMm(w));
  b.dimV(-h / 2, h / 2, w / 2 + b.paper(8), w / 2, fmtMm(h));
  const nm = isBottom ? 'BẢN ĐÁY' : 'TRẦN GA';
  return { id: `rebarPlan_${part}_${layer}`, title: `CỐT THÉP ${nm} – LỚP ${layer === 'low' ? 'DƯỚI' : 'TRÊN'}`, ents: b.ents };
}

/* ================================================================== TẤM NẮP ĐÚC SẴN */

interface LidSpec {
  n: number;
  len: number;
  wid: number;
  thick: number;
  low: ReturnType<typeof parseRebar>;
  up: ReturnType<typeof parseRebar>;
}

export function lidSpec(c: Ctx): LidSpec | null {
  const sl = lidSlabs(c.row, c.cfg, c.info);
  if (!sl) return null;
  const { cfg, row, info } = c;
  const low = info.hasNeck ? ({ dia: cfg.lid.dLow, spacing: cfg.lid.density } as LidSpec['low']) : parseRebar(row.roof.low);
  const up = info.hasNeck ? (cfg.lid.dUp > 0 ? ({ dia: cfg.lid.dUp, spacing: cfg.lid.density } as LidSpec['up']) : null) : parseRebar(row.roof.up);
  return { ...sl, low, up };
}

/** Mặt bằng cốt thép một tấm nắp (lớp dưới nét liền, lớp trên nét đứt), thép góc viền và móc nâng. */
export function lidPlan(c: Ctx, s: number): View | null {
  const sp = lidSpec(c);
  if (!sp) return null;
  const b = new Builder(s);
  const { cfg } = c;
  const cv = cfg.cover.lid;
  const { len, wid } = sp;
  b.rect('KC', -len / 2, -wid / 2, len / 2, wid / 2);
  const mesh = (spec: LidSpec['low'], layer: 'THEP' | 'LOT') => {
    if (!spec) return;
    const ax = spaced(len - 2 * cv, spec.spacing, cfg.fmt.mesh);
    const ay = spaced(wid - 2 * cv, spec.spacing, cfg.fmt.mesh);
    ay.pos.forEach((p) => b.line(layer, -len / 2 + cv, -wid / 2 + cv + p, len / 2 - cv, -wid / 2 + cv + p));
    ax.pos.forEach((p) => b.line(layer, -len / 2 + cv + p, -wid / 2 + cv, -len / 2 + cv + p, wid / 2 - cv));
  };
  mesh(sp.low, 'THEP');
  mesh(sp.up, 'LOT');
  const ang = parseAngleSafe(cfg.lid.angle);
  if (ang && cfg.lid.angleCount > 0) b.rect('KC', -len / 2 + ang, -wid / 2 + ang, len / 2 - ang, wid / 2 - ang);
  const lf = cfg.lid.lift.match(/^(\d+)D(\d+)/i);
  const nLift = lf ? Number(lf[1]) : 0;
  for (let i = 0; i < nLift; i++) {
    const x = nLift === 4 ? (i % 2 === 0 ? -len / 4 : len / 4) : i === 0 ? -len / 4 : len / 4;
    const y = nLift === 4 ? (i < 2 ? -wid / 4 : wid / 4) : 0;
    b.circle('KC', x, y, Math.max(Number(lf![2]) * 1.5, b.paper(0.8)));
  }
  b.dimH(-len / 2, len / 2, -wid / 2 - b.paper(8), -wid / 2, fmtMm(len));
  b.dimV(-wid / 2, wid / 2, len / 2 + b.paper(8), len / 2, fmtMm(wid));
  if (sp.low) b.text('TEXT', 0, wid / 2 + b.paper(3), `Ø${sp.low.dia}${cfg.fmt.densSym}${sp.low.spacing}`, 2.4, 'c');
  return { id: 'lidPlan', title: `CỐT THÉP TẤM NẮP (SL: ${sp.n})`, ents: b.ents };
}

function parseAngleSafe(name: string): number {
  const m = /^[VL](\d+)x/i.exec(name.trim());
  return m ? Number(m[1]) : 0;
}

/** Mặt cắt dọc (theo chiều dài) hoặc ngang (theo chiều rộng) của tấm nắp. */
export function lidSection(c: Ctx, s: number, id: 'A' | 'B'): View | null {
  const sp = lidSpec(c);
  if (!sp) return null;
  const b = new Builder(s);
  const { cfg } = c;
  const cv = cfg.cover.lid;
  const w = id === 'A' ? sp.len : sp.wid;
  const o = id === 'A' ? sp.wid : sp.len;
  const t = sp.thick;
  const body = rectPoly(-w / 2, 0, w / 2, t);
  b.hatch([body], 45, 2.2);
  b.poly('KC', body, true);
  const ang = parseAngleSafe(cfg.lid.angle);
  const dot = (x: number, z: number) => b.circle('THEP', x, z, Math.max(cfg.cover.notch / 2, b.paper(0.3)), true);
  const layer = (spec: LidSpec['low'], z: number) => {
    if (!spec) return;
    b.line('THEP', -w / 2 + cv, z, w / 2 - cv, z);
    spaced(o - 2 * cv, spec.spacing, cfg.fmt.mesh).pos.forEach((p) => dot(-w / 2 + cv + p, z + (z < t / 2 ? spec.dia : -spec.dia)));
  };
  layer(sp.low, cv);
  layer(sp.up, t - cv);
  if (ang && cfg.lid.angleCount > 0) {
    for (const sg of [-1, 1]) {
      b.poly('KC', [[sg * w / 2, 0], [sg * (w / 2 - ang), 0], [sg * (w / 2 - ang), 3], [sg * w / 2, 3]], false);
      if (cfg.lid.angleCount >= 2) b.line('KC', sg * w / 2, t, sg * (w / 2 - ang), t);
    }
  }
  b.dimH(-w / 2, w / 2, -b.paper(7), 0, fmtMm(w));
  b.dimV(0, t, w / 2 + b.paper(7), w / 2, fmtMm(t));
  return { id: `lidSection${id}`, title: `MẶT CẮT ${id}-${id}`, ents: b.ents };
}

/* ================================================================== LƯỚI THÉP TƯỜNG */

/** Nhóm thanh có nhãn khớp `re` (lấy nhóm tốn thép nhất) → chuỗi chú thích `T1-Ø10, L=2450, n=8`. */
export function barCallout(c: Ctx, part: string, re: RegExp): string | null {
  const gs = c.res.rebar.groups.filter((g) => g.part === part && re.test(g.label));
  if (!gs.length) return null;
  const g = gs.reduce((a, x) => (x.length * x.count > a.length * a.count ? x : a));
  return `${g.mark}-Ø${g.dia}, L=${g.length}${c.cfg.fmt.showCount ? `, n=${g.count}` : ''}`;
}

/** Mặt đứng lưới thép của một tường (lớp ngoài hoặc trong): thanh đứng, thanh ngang, thép buộc, lỗ cống, chú thích. */
export function wallElevation(c: Ctx, s: number, wall: 0 | 1 | 2 | 3, layer: 'out' | 'in'): View | null {
  const P = wallPanels(c.row, c.cfg, c.cat, c.info).find((p) => p.wall === wall && p.layer === layer);
  if (!P) return null;
  const b = new Builder(s);
  const { d, cfg } = c;
  const W = P.width;
  b.rect('KC', -W / 2, 0, W / 2, d.H);
  for (const o of c.ops.filter((q) => q.wall === wall)) {
    if (o.round) b.poly('CONG', circlePoly(o.uc, o.z0 + o.h / 2, o.w / 2, 48), true);
    else b.rect('CONG', o.uc - o.w / 2, o.z0, o.uc + o.w / 2, o.z1);
  }
  for (const v of P.vert) b.line('THEP', v.u, v.z0, v.u, v.z1);
  for (const h of P.horiz) b.line('THEP', h.u0, h.z, h.u1, h.z);
  for (const [u, z] of P.ties) b.circle('LOT', u, z, Math.max(cfg.cover.notch / 2, b.paper(0.3)));
  // chú thích: số hiệu, Ø, chiều dài (và số thanh nếu bật "Ghi số thanh")
  const sideOut = layer === 'out' ? 'ngoài' : 'trong';
  const label = `Tường ${wall + 1} lớp ${sideOut}`;
  const notes = [
    [barCallout(c, 'wall', new RegExp(`^${label} – thép đứng`)), P.vert[Math.floor(P.vert.length / 2)] ? ([P.vert[Math.floor(P.vert.length / 2)].u, d.H * 0.78] as Pt) : null],
    [barCallout(c, 'wall', new RegExp(`^${label} – thép ngang`)), P.horiz[0] ? ([P.horiz[0].u1 - W * 0.1, P.horiz[Math.floor(P.horiz.length / 2)]?.z ?? d.H / 2] as Pt) : null],
    [layer === 'out' ? barCallout(c, 'wall', new RegExp(`^Tường ${wall + 1} – thép buộc`)) : null, P.ties[0] ? P.ties[Math.floor(P.ties.length / 2)] : null],
  ] as [string | null, Pt | null][];
  notes.forEach(([text, at], i) => {
    if (!text || !at) return;
    const ty = d.H * (0.9 - i * 0.28);
    const tx = W / 2 + b.paper(8);
    b.line('NET', at[0], at[1], tx, ty);
    b.text('TEXT', tx + b.paper(1), ty, text, 2.4, 'l');
  });
  b.dimH(-W / 2, W / 2, -b.paper(9), 0, fmtMm(W));
  b.dimV(0, d.H, -W / 2 - b.paper(8), -W / 2, fmtMm(d.H));
  return { id: `wall${wall}${layer}`, title: `TƯỜNG T${wall + 1} – LỚP ${sideOut.toUpperCase()}`, ents: b.ents };
}
