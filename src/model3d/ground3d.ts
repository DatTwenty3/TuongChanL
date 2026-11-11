/**
 * Mô hình 3D – nền đất theo địa tầng (mở rộng, không có trong ứng dụng gốc).
 *
 * Dựng các khối đất nằm dưới bản đáy theo từng lớp (khi bật móng cọc: lấy từ `pile.layers`;
 * khi không có cọc: một khối nền đất / đá theo loại nền trong mục tính toán) và lớp đất phủ phía
 * trước mũi tường tới mặt đất tự nhiên. Chỉ phục vụ hiển thị: không đổi `conc/lean/soil`,
 * `bbox`, `sig` nên đối chiếu với bản gốc giữ nguyên.
 *
 * Tọa độ như phần còn lại của mô hình (cm): x dọc mặt cắt (mũi = 0, gót = B), y thẳng đứng
 * (đáy bản đáy = 0, đi xuống là âm), z dọc chiều dài đơn nguyên.
 */

import type { EngineBarsResult, EngineProject } from '../engine';
import type { BarsResult, Model3DGroundPart, Project } from '../types/project';
import { M3Mesh } from './mesh';

type RGB = [number, number, number];

/** Màu đất theo loại / độ sệt / loại hạt – tông gần với đất thực tế ở ĐBSCL và miền Nam. */
export function groundLook(l: { kind: 'sand' | 'clay' | 'rock'; IL?: number }): 'sand' | 'clay' | 'mud' | 'rock' {
  if (l.kind === 'rock') return 'rock';
  if (l.kind === 'sand') return 'sand';
  return (l.IL ?? 0.5) >= 0.75 ? 'mud' : 'clay';
}

export function groundColor(l: {
  kind: 'sand' | 'clay' | 'rock';
  IL?: number;
  grain?: string;
}): RGB {
  if (l.kind === 'rock') return [0.54, 0.56, 0.6];
  if (l.kind === 'sand') {
    switch (l.grain) {
      case 'gravelly':
        return [0.7, 0.62, 0.5];
      case 'coarse':
        return [0.82, 0.7, 0.46];
      case 'fine':
        return [0.88, 0.78, 0.56];
      case 'silt':
        return [0.8, 0.74, 0.6];
      default:
        return [0.86, 0.73, 0.45];
    }
  }
  const il = l.IL ?? 0.5;
  if (il >= 0.75) return [0.44, 0.47, 0.42]; // bùn sét: xám xanh
  if (il >= 0.5) return [0.5, 0.44, 0.34]; // sét dẻo mềm
  if (il >= 0.25) return [0.66, 0.46, 0.3]; // sét dẻo cứng: nâu đỏ
  return [0.72, 0.4, 0.26]; // sét cứng: đỏ nâu
}

export function m3Ground(pIn: Project | EngineProject, resIn: BarsResult | EngineBarsResult): Model3DGroundPart[] {
  const p = pIn as unknown as EngineProject;
  const res = resIn as BarsResult;
  const g = res.g;
  const Lu = p.Lu;
  const B = g.B;
  const H = Math.max(100, p.H || 300);
  const xa = -Math.max(150, 0.35 * H);
  const xb = B + Math.max(300, 0.7 * H);
  const out: Part[] = [];

  const box = (x0: number, x1: number, yTop: number, yBot: number): M3Mesh => {
    const m = new M3Mesh();
    m.prism(
      [
        [x0, yBot],
        [x1, yBot],
        [x1, yTop],
        [x0, yTop],
      ],
      0,
      Lu,
    );
    return m;
  };

  const q = p.pile && p.pile.on ? p.pile : null;
  if (q && q.layers.length) {
    const reach = Math.max(0, q.L) * 100 + 300; // sâu hơn mũi cọc 3 m
    let z = 0;
    q.layers.forEach((l, i) => {
      if (z * 100 >= reach) return;
      const top = -z * 100;
      const bot = -Math.min(z + Math.max(0, l.thk), reach / 100) * 100;
      z += Math.max(0, l.thk);
      if (bot >= top - 1e-6) return;
      out.push({
        id: 'gl' + i,
        name: l.name || `Lớp ${i + 1}`,
        kind: 'strata',
        color: groundColor(l),
        look: groundLook(l),
        mesh: box(xa, xb, top, bot),
        y0: bot,
        y1: top,
      });
    });
    const z0 = Math.max(0, q.design.z0) * 100;
    if (z0 > 1e-6 && q.layers[0]) {
      const l = q.layers[0];
      out.push({
        id: 'glc',
        name: 'Đất phủ mặt – trước mũi tường',
        kind: 'cover',
        color: groundColor(l),
        look: groundLook(l),
        mesh: box(xa, 0, z0, 0),
        y0: 0,
        y1: z0,
      });
    }
  } else {
    const c = (p as EngineProject).calc;
    const rock = c?.soil === 'a';
    const clay = c?.soil === 'd';
    const depth = Math.min(500, Math.max(250, 0.5 * H));
    out.push({
      id: 'gl0',
      name: rock ? 'Nền đá' : clay ? 'Nền đất dính' : 'Nền đất rời',
      kind: 'strata',
      color: rock ? groundColor({ kind: 'rock' }) : clay ? groundColor({ kind: 'clay', IL: 0.3 }) : groundColor({ kind: 'sand' }),
      look: rock ? 'rock' : clay ? 'clay' : 'sand',
      mesh: box(xa, xb, 0, -depth),
      y0: -depth,
      y1: 0,
    });
  }
  return out;
}

type Part = Model3DGroundPart;
