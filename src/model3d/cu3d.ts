/**
 * Mô hình 3D cừ tràm: các cây gỗ tròn thuôn dần, đóng thẳng đứng theo lưới dưới bê tông lót.
 * Toạ độ: x ngang bản đáy, y thẳng đứng (y = 0 là đáy bản đáy), z dọc đơn nguyên; đơn vị cm.
 * Chỉ dựng khi bật cừ tràm.
 */

import { cuGrid, cuOn, type EngineProject } from '../engine';
import type { BarsResult, M3MeshData, Project } from '../types/project';

/** Số ngẫu nhiên tất định theo chỉ số cây (hình dạng không đổi giữa các lần vẽ). */
function rnd(i: number, k: number): number {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Cao độ đỉnh cừ (cm): sát đáy lớp bê tông lót. */
export function cuTopY(p: Project | EngineProject): number {
  const q = p as Project;
  return q.blindOn === false ? 0 : -Math.max(0, q.tBlind || 0);
}

/**
 * Lưới các cây cừ. Mỗi cây: thân 3 đốt (đường kính gốc lớn hơn ngọn, hơi cong tự nhiên) + mũi vát nhọn.
 * `null` khi tắt hoặc không có cây nào.
 */
export function m3CuMesh(pIn: Project | EngineProject, resIn: BarsResult): M3MeshData | null {
  const p = pIn as unknown as EngineProject;
  if (!cuOn(p)) return null;
  const q = p.cu!;
  const B = resIn.g.B;
  const Lu = p.Lu;
  const g = cuGrid(q, B / 100, Lu / 100);
  const L = Math.max(0, q.L) * 100;
  if (!g.n || L <= 0) return null;

  // giảm số cạnh khi rất nhiều cây để mô hình vẫn nhẹ
  const sides = g.n > 6000 ? 5 : g.n > 2500 ? 6 : 8;
  const r0 = Math.max(1, q.d / 2);
  const yTop = cuTopY(p);
  const P: number[] = [];
  const N: number[] = [];
  const I: number[] = [];
  const sx = (g.sx * 100);
  const sz = (g.sz * 100);
  // các mức dọc thân: tỉ lệ chiều dài và tỉ lệ bán kính (gốc 1,22 → ngọn 0,72), mũi vát ở 6 % cuối
  const levels: Array<[number, number]> = [
    [0, 1.22],
    [0.35, 1.05],
    [0.7, 0.88],
    [0.94, 0.72],
  ];

  let idx = 0;
  for (let ix = 0; ix < g.nx; ix++) {
    for (let iz = 0; iz < g.nz; iz++) {
      idx++;
      // lệch nhẹ khỏi nút lưới + nghiêng / cong nhẹ như cây thật
      const jx = (rnd(idx, 1) - 0.5) * 0.18 * sx;
      const jz = (rnd(idx, 2) - 0.5) * 0.18 * sz;
      const cx = (ix + 0.5) * sx + jx;
      const cz = (iz + 0.5) * sz + jz;
      const lean = 0.012 * L;
      const lx = (rnd(idx, 3) - 0.5) * 2 * lean;
      const lz = (rnd(idx, 4) - 0.5) * 2 * lean;
      const bow = (rnd(idx, 5) - 0.5) * 0.02 * L;
      const rk = 0.88 + 0.24 * rnd(idx, 6);
      const rot = rnd(idx, 7) * Math.PI * 2;
      const base = P.length / 3;

      const centre = (t: number): [number, number] => [
        cx + lx * t + bow * Math.sin(Math.PI * t),
        cz + lz * t - bow * Math.sin(Math.PI * t) * 0.6,
      ];

      levels.forEach(([t, k]) => {
        const [ox, oz] = centre(t);
        const y = yTop - L * t;
        const r = r0 * rk * k;
        for (let s = 0; s < sides; s++) {
          const a = rot + (2 * Math.PI * s) / sides;
          const nx = Math.cos(a);
          const nz = Math.sin(a);
          P.push(ox + r * nx, y, oz + r * nz);
          N.push(nx, 0.06, nz);
        }
      });
      // thân
      for (let lv = 0; lv < levels.length - 1; lv++) {
        for (let s = 0; s < sides; s++) {
          const a = base + lv * sides + s;
          const b = base + lv * sides + ((s + 1) % sides);
          const c = a + sides;
          const d = b + sides;
          I.push(a, b, c, b, d, c);
        }
      }
      // mũi nhọn
      const [tx, tz] = centre(1);
      const tip = P.length / 3;
      P.push(tx, yTop - L, tz);
      N.push(0, -1, 0);
      const last = base + (levels.length - 1) * sides;
      for (let s = 0; s < sides; s++) {
        I.push(last + s, last + ((s + 1) % sides), tip);
      }
      // mặt cắt đầu cừ
      const [hx, hz] = centre(0);
      const cap = P.length / 3;
      P.push(hx, yTop, hz);
      N.push(0, 1, 0);
      const rim = P.length / 3;
      for (let s = 0; s < sides; s++) {
        P.push(P[(base + s) * 3], yTop, P[(base + s) * 3 + 2]);
        N.push(0, 1, 0);
      }
      for (let s = 0; s < sides; s++) {
        I.push(cap, rim + ((s + 1) % sides), rim + s);
      }
    }
  }
  return { p: P, n: N, i: I, l: [] };
}
