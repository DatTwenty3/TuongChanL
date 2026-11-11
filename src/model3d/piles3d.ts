/**
 * Mô hình 3D móng cọc BTCT: khối bê tông cọc và lồng thép (tùy chọn, chỉ dựng khi bật móng cọc).
 * Toạ độ 3D: x ngang bản đáy, y thẳng đứng (y = 0 là đáy bản đáy, cọc đi xuống), z dọc đơn nguyên.
 */

import { type EngineProject, pileGrid, pileHoopLevels, pileMainOffsets } from '../engine';
import type { BarSpec, BarsResult, M3BarGroup, Point2D, Point3D, Project } from '../types/project';
import { M3Mesh } from './mesh';

/** Khối bê tông các cọc; `null` nếu không có cọc hoặc quá nhiều đỉnh cho chỉ số Uint16. */
export function m3PileMesh(pIn: Project | EngineProject, resIn: BarsResult): M3Mesh | null {
  const p = pIn as unknown as EngineProject;
  const g = pileGrid(p, resIn.g.B);
  if (!g || !g.n || g.L <= 0) return null;
  const budget = 60000;
  let segs = g.round ? Math.max(6, Math.min(18, Math.floor(budget / (g.n * 6)))) : 4;
  let box = !g.round;
  if (g.round && g.n * segs * 6 > budget) {
    box = true;
    segs = 4;
  }
  if (g.n * (box ? 24 : segs * 6) > budget) return null;

  const mesh = new M3Mesh();
  const r = g.size / 2;
  const y0 = -g.L;
  const y1 = g.embed;
  g.pts.forEach(([x, z]) => {
    let poly: Point2D[];
    if (box) {
      poly = [
        [x - r, z - r],
        [x + r, z - r],
        [x + r, z + r],
        [x - r, z + r],
      ];
    } else {
      poly = Array.from({ length: segs }, (_, k): Point2D => {
        const a = (2 * Math.PI * k) / segs;
        return [x + r * Math.cos(a), z + r * Math.sin(a)];
      });
    }
    mesh.vprism(poly, y0, y1, !box);
  });
  return mesh;
}

/** Nhóm thép lồng cọc (thép dọc, đai) để hiển thị/ẩn/tô sáng như thép tường. */
export function m3PileGroups(
  pIn: Project | EngineProject,
  resIn: BarsResult,
  firstIndex: number,
): M3BarGroup[] {
  const p = pIn as unknown as EngineProject;
  const q = p.pile;
  const g = pileGrid(p, resIn.g.B);
  const out: M3BarGroup[] = [];
  if (!q || !g || !g.n || q.type === 'phc') return out;
  const bars = resIn.bars as unknown as BarSpec[];
  const bMain = bars.find((b) => b.key === 'pm');
  const bHoop = bars.find((b) => b.key === 'ph');
  const offs = pileMainOffsets(q);
  const cv = q.cover / 10;
  const y0 = -g.L + cv;
  const y1 = g.embed;

  if (bMain && offs.length) {
    const lines: Point3D[][] = [];
    g.pts.forEach(([x, z]) =>
      offs.forEach(([dx, dz]) =>
        lines.push([
          [x + dx, y0, z + dz],
          [x + dx, y1, z + dz],
        ]),
      ),
    );
    out.push({
      id: 'g' + (firstIndex + out.length),
      key: 'pm',
      mark: String(bMain.mark),
      name: bMain.name,
      d: bMain.d,
      R: bMain.d / 20,
      count: bMain.count ?? bMain.items.length,
      bars: lines,
      bs: [bMain],
      per: 0,
    });
  }

  if (bHoop) {
    const levels = pileHoopLevels(q).map((m) => m * 100);
    const half = g.size / 2 - cv - q.cage.dHoop / 20;
    const loop = (x: number, z: number, y: number): Point3D[] => {
      if (q.type === 'sq') {
        return [
          [x - half, y, z - half],
          [x + half, y, z - half],
          [x + half, y, z + half],
          [x - half, y, z + half],
          [x - half, y, z - half],
        ];
      }
      return Array.from({ length: 13 }, (_, k): Point3D => {
        const a = (2 * Math.PI * k) / 12;
        return [x + half * Math.cos(a), y, z + half * Math.sin(a)];
      });
    };
    // giới hạn số vòng đai vẽ để mô hình không quá nặng (số liệu thống kê vẫn là đủ)
    const total = g.n * levels.length;
    const step = Math.max(1, Math.ceil(total / 3000));
    const lines: Point3D[][] = [];
    g.pts.forEach(([x, z]) => {
      levels.forEach((d, i) => {
        if (i % step === 0) lines.push(loop(x, z, -d));
      });
    });
    out.push({
      id: 'g' + (firstIndex + out.length),
      key: 'ph',
      mark: String(bHoop.mark),
      name: bHoop.name,
      d: bHoop.d,
      R: bHoop.d / 20,
      count: bHoop.count ?? bHoop.items.length,
      bars: lines,
      bs: [bHoop],
      per: 0,
    });
  }
  return out;
}
