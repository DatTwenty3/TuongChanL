/**
 * Móng cọc BTCT – hình học (lưới cọc dưới bản đáy, lồng thép) và khối lượng.
 *
 * Quy ước toạ độ giống hình học tường: cm; x chạy ngang bản đáy từ mép mũi (0) đến mép gót (B),
 * z chạy dọc đơn nguyên (0…Lu), y thẳng đứng với y = 0 là đáy bản đáy, cọc đi xuống y < 0.
 * Tất cả hàm đều trả `null` / không làm gì khi chưa bật móng cọc.
 */

import type { PileConfig, PileQuantities, Point2D } from '../types/project.ts';
import { pileOn } from './pile.ts';
import type { EngineBarSpec, EngineProject } from './types.ts';

export interface PileGrid {
  /** Số cọc trong một đơn nguyên. */
  n: number;
  /** Cạnh cọc vuông hoặc đường kính ngoài (cm). */
  size: number;
  round: boolean;
  /** Bề dày thành ống (cm); 0 = đặc. */
  wall: number;
  /** Chiều dài cọc dưới đáy đài (cm). */
  L: number;
  /** Đoạn ngàm vào đài (cm). */
  embed: number;
  rows: Array<{ x: number; zs: number[] }>;
  /** Tâm từng cọc [x, z] (cm). */
  pts: Point2D[];
  B: number;
  Lu: number;
  warn: string[];
}

const fin = (v: number, d: number): number => (Number.isFinite(v) ? v : d);

export function pileGrid(p: EngineProject, B: number): PileGrid | null {
  const q = p.pile;
  if (!pileOn(p) || !q) return null;
  const size = Math.max(1, fin(q.size, 0.3) * 100);
  const L = Math.max(0, fin(q.L, 0) * 100);
  const embed = Math.max(0, fin(q.embed, 0) * 100);
  const sx = Math.max(1, fin(q.sx, 1) * 100);
  const sy = Math.max(1, fin(q.sy, 1) * 100);
  const nx = Math.max(1, Math.round(fin(q.nx, 1)));
  const Lu = Math.max(1, p.Lu);
  const nz = Math.max(1, Math.floor(Lu / sy + 1e-9));
  const warn: string[] = [];

  const rows: PileGrid['rows'] = [];
  for (let i = 0; i < nx; i++) {
    const x = q.centered ? B / 2 + (i - (nx - 1) / 2) * sx : fin(q.x0, 0) * 100 + i * sx;
    const odd = q.stagger && i % 2 === 1 && nz > 1;
    const zs: number[] = [];
    if (odd) {
      for (let k = 0; k < nz - 1; k++) zs.push(Lu / 2 + (k - (nz - 2) / 2) * sy);
    } else {
      for (let k = 0; k < nz; k++) zs.push(Lu / 2 + (k - (nz - 1) / 2) * sy);
    }
    rows.push({ x, zs });
  }
  const pts: Point2D[] = [];
  rows.forEach((r) => r.zs.forEach((z) => pts.push([r.x, z])));

  rows.forEach((r, i) => {
    if (r.x - size / 2 < -1e-6 || r.x + size / 2 > B + 1e-6) {
      warn.push(`Hàng cọc thứ ${i + 1} nằm ngoài bề rộng bản đáy.`);
    }
  });
  if (nz > 1 && sy < size - 1e-6) warn.push('Bước cọc dọc tường nhỏ hơn kích thước cọc: các cọc chồng lên nhau.');
  if (nx > 1 && sx < size - 1e-6) warn.push('Khoảng cách giữa các hàng cọc nhỏ hơn kích thước cọc: các cọc chồng lên nhau.');
  if (L <= 0) warn.push('Chiều dài cọc bằng 0.');

  return {
    n: pts.length,
    size,
    round: q.type !== 'sq',
    wall: q.type === 'phc' ? Math.max(0, fin(q.wall, 0) * 100) : 0,
    L,
    embed,
    rows,
    pts,
    B,
    Lu,
    warn,
  };
}

/** Diện tích tiết diện bê tông một cọc (m²). */
export function pileArea(q: PileConfig): number {
  const D = Math.max(0, q.size);
  if (q.type === 'sq') return D * D;
  const outer = (Math.PI * D * D) / 4;
  if (q.type === 'phc' && q.wall > 0) {
    const di = Math.max(0, D - 2 * q.wall);
    return outer - (Math.PI * di * di) / 4;
  }
  return outer;
}

/** Mức đai (m, tính từ đầu cọc xuống) theo vùng dày hai đầu và vùng giữa. */
export function pileHoopLevels(q: PileConfig): number[] {
  const L = Math.max(0, q.L);
  const sE = q.cage.sEnd > 0 ? q.cage.sEnd : 0;
  const sM = q.cage.sMid > 0 ? q.cage.sMid : 0;
  const Le = Math.min(Math.max(0, q.cage.Lend), L / 2);
  const out: number[] = [];
  if (!sE || !sM || L <= 0) return out;
  let t = 0.05;
  while (t <= Le + 1e-9) {
    out.push(t);
    t += sE;
  }
  while (t <= L - Le + 1e-9) {
    out.push(t);
    t += sM;
  }
  while (t <= L - 0.05 + 1e-9) {
    out.push(t);
    t += sE;
  }
  return out;
}

/** Vị trí thép dọc trong tiết diện, so với tâm cọc: [dx, dz] (cm). Rỗng nếu không có lồng thép. */
export function pileMainOffsets(q: PileConfig): Point2D[] {
  if (q.type === 'phc') return [];
  const n = Math.max(0, Math.round(q.cage.nMain));
  if (!n) return [];
  const c = fin(q.cover, 50) / 10;
  const inset = c + q.cage.dHoop / 10 + q.cage.dMain / 20;
  const out: Point2D[] = [];
  if (q.type === 'bored' || q.type === 'rc') {
    const r = Math.max(0.1, (q.size * 100) / 2 - inset);
    for (let k = 0; k < n; k++) {
      const a = (2 * Math.PI * k) / n;
      out.push([r * Math.cos(a), r * Math.sin(a)]);
    }
    return out;
  }
  const h = Math.max(0.1, (q.size * 100) / 2 - inset);
  const per = 8 * h;
  for (let k = 0; k < n; k++) {
    let t = (k * per) / n;
    // đi vòng chu vi bắt đầu từ góc (-h, -h) theo chiều +x
    let x: number;
    let z: number;
    if (t < 2 * h) {
      x = -h + t;
      z = -h;
    } else if ((t -= 2 * h) < 2 * h) {
      x = h;
      z = -h + t;
    } else if ((t -= 2 * h) < 2 * h) {
      x = h - t;
      z = h;
    } else {
      t -= 2 * h;
      x = -h;
      z = h - t;
    }
    out.push([x, z]);
  }
  return out;
}

/** Khối lượng bê tông cọc (không gồm thép; thép nằm trong `res.bars`). */
export function pileQuantities(p: EngineProject, B: number, steelKg = 0): PileQuantities | undefined {
  const q = p.pile;
  const g = pileGrid(p, B);
  if (!q || !g) return undefined;
  const volEach = pileArea(q) * Math.max(0, q.L);
  return {
    n: g.n,
    volEach,
    vol: volEach * g.n,
    totLen: g.n * Math.max(0, q.L),
    steelKg,
  };
}

/**
 * Thêm thép cọc vào kết quả `buildBars` (khi bật móng cọc). Gọi SAU khi các mẫu tường đã đánh mác
 * để không làm đổi mác của thép tường; mác cọc là chuỗi riêng `P1`, `P2`.
 */
export function appendPileBars(p: EngineProject, res: { bars: EngineBarSpec[]; warn: string[]; g: { B: number } }): void {
  const q = p.pile;
  const g = pileGrid(p, res.g.B);
  if (!q || !g) return;
  g.warn.forEach((w) => res.warn.push(w));
  if (q.type === 'phc' || !(q.cage.nMain > 0) || !(g.n > 0) || !(q.L > 0)) return;

  const nMain = Math.round(q.cage.nMain);
  const lenMain = Math.round((q.L + q.embed) * 1000);
  const mains: EngineBarSpec = {
    key: 'pm',
    mark: 'P1',
    name: 'Thép dọc cọc',
    d: q.cage.dMain,
    n: nMain,
    pile: true,
    straight: true,
    path: [
      [0, 0],
      [lenMain / 10, 0],
    ],
    items: Array.from({ length: g.n * nMain }, () => lenMain),
  };

  const levels = pileHoopLevels(q);
  const sizeMm = q.size * 1000;
  const inner = Math.max(10, sizeMm - 2 * fin(q.cover, 50) - q.cage.dHoop);
  const perim = q.type === 'sq' ? 4 * inner : Math.PI * inner;
  const lenHoop = Math.round(perim + 2 * Math.max(0, q.cage.hook));
  const s = inner / 10;
  const hoopPath: Point2D[] =
    q.type === 'sq'
      ? [
          [0, 0],
          [s, 0],
          [s, s],
          [0, s],
          [0, 0],
        ]
      : Array.from({ length: 17 }, (_, k): Point2D => [
          (s / 2) * (1 + Math.cos((2 * Math.PI * k) / 16)),
          (s / 2) * (1 + Math.sin((2 * Math.PI * k) / 16)),
        ]);
  const bars: EngineBarSpec[] = [mains];
  if (levels.length) {
    bars.push({
      key: 'ph',
      mark: 'P2',
      name: q.type === 'bored' || q.type === 'rc' ? 'Đai xoắn / đai tròn cọc' : 'Đai cọc',
      d: q.cage.dHoop,
      a: q.cage.sMid * 100,
      pile: true,
      path: hoopPath,
      items: Array.from({ length: g.n * levels.length }, () => lenHoop),
    });
  }
  res.bars.push(...bars);
}
