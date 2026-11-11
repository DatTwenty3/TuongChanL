import { describe, expect, it } from 'vitest';
import {
  buildBars,
  pileDefaults,
  pileNewLayer,
  presetCanti,
  type EngineProject,
} from '../../src/engine/index.ts';
import { clayState, layerKindText, layerProps, m3Ground } from '../../src/model3d/ground3d';
import { layoutSoilLabels, type SoilLabelInput } from '../../src/model3d/labels3d';

const inp = (id: string, ax: number, ay: number, side: 'L' | 'R' = 'R'): SoilLabelInput => ({
  id,
  ax,
  ay,
  side,
  w: 200,
  h: 40,
});

describe('labels3d – bố trí nhãn lớp đất chĩa ra từ mô hình', () => {
  it('nhãn bên phải: cùng một cột, không chồng lên nhau, nằm trong khung', () => {
    const W = 1000;
    const H = 500;
    const pos = layoutSoilLabels([inp('a', 400, 100), inp('b', 420, 110), inp('c', 410, 120), inp('d', 430, 480)], W, H, {
      reserveRight: 0,
    });
    expect(pos.length).toBe(4);
    const xs = new Set(pos.map((p) => p.x));
    expect(xs.size).toBe(1);
    const sorted = [...pos].sort((p, q) => p.y - q.y);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i].y).toBeGreaterThanOrEqual(sorted[i - 1].y + 40 - 1e-9);
    pos.forEach((p) => {
      expect(p.y).toBeGreaterThanOrEqual(8 - 1e-9);
      expect(p.y + p.h).toBeLessThanOrEqual(H - 8 + 1e-9);
      expect(p.x + p.w).toBeLessThanOrEqual(W - 8 + 1e-9);
      expect(p.x).toBeGreaterThan(430); // nằm bên phải điểm neo xa nhất
    });
  });

  it('chừa bề ngang cho chú giải bên phải và đặt nhãn bên trái cho lớp phủ trước mũi', () => {
    const pos = layoutSoilLabels([inp('r', 700, 200), inp('l', 300, 260, 'L')], 1000, 600, { reserveRight: 320 });
    const r = pos.find((p) => p.id === 'r')!;
    const l = pos.find((p) => p.id === 'l')!;
    expect(r.x + r.w).toBeLessThanOrEqual(1000 - 320);
    expect(l.x + l.w).toBeLessThan(300);
    expect(l.ex).toBeCloseTo(l.x + l.w, 9); // đường chĩa chạm cạnh phải của nhãn trái
    expect(r.ex).toBeCloseTo(r.x, 9);
  });

  it('đường chĩa gấp khúc ở cạnh nhãn, nối thẳng nếu neo sát nhãn', () => {
    const [far] = layoutSoilLabels([inp('a', 100, 100)], 1000, 500);
    expect(far.bx).toBeLessThan(far.ex);
    expect(far.by).toBeCloseTo(far.ey, 9);
    const [near] = layoutSoilLabels([inp('a', 995, 100)], 1000, 500);
    expect(near.bx).toBe(near.ax);
  });
});

describe('ground3d – thông tin chữ cho nhãn lớp đất', () => {
  it('trạng thái đất dính theo IL và tên loại đất', () => {
    expect(clayState(-0.1)).toBe('cứng');
    expect(clayState(0.3)).toBe('dẻo cứng');
    expect(clayState(0.6)).toBe('dẻo mềm');
    expect(clayState(0.9)).toBe('dẻo chảy');
    expect(clayState(1.2)).toBe('chảy');
    expect(layerKindText({ kind: 'clay', IL: 0.3, clayType: 'sandy' })).toBe('Cát pha dẻo cứng');
    expect(layerKindText({ kind: 'sand', grain: 'fine' })).toBe('Cát mịn');
    expect(layerKindText({ kind: 'rock' })).toBe('Đá');
  });

  it('chỉ liệt kê các chỉ tiêu có giá trị', () => {
    const props = layerProps({ kind: 'sand', gamma: 19, c: 0, phi: 30, Su: 0, IL: 0, N: 25, E: 30 });
    expect(props).toEqual(['γ = 19 kN/m³', 'φ = 30°', 'N = 25', 'E = 30 MPa']);
  });

  it('mỗi khối đất của mô hình đều có kindText và props', () => {
    const p = presetCanti(500) as EngineProject;
    const q = pileDefaults();
    q.layers = [
      pileNewLayer({ id: 'a', name: 'Bùn', kind: 'clay', thk: 4, IL: 0.9, gamma: 15 }),
      pileNewLayer({ id: 'b', name: 'Cát', kind: 'sand', thk: 30, grain: 'medium', phi: 30, N: 20 }),
    ];
    p.pile = q;
    const parts = m3Ground(p, buildBars(p));
    expect(parts.length).toBeGreaterThan(2);
    parts.forEach((x) => {
      expect(x.kindText.length).toBeGreaterThan(0);
      expect(Array.isArray(x.props)).toBe(true);
    });
    expect(parts[0].kindText).toBe('Sét dẻo chảy');
    expect(parts.find((x) => x.kind === 'cover')!.kindText).toContain('đất tự nhiên');
  });
});
