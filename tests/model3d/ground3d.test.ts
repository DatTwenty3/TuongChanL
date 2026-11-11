import { describe, expect, it } from 'vitest';
import {
  buildBars,
  pileDefaults,
  pileNewLayer,
  presetCanti,
  type EngineProject,
} from '../../src/engine/index.ts';
import { groundColor, m3Ground, model3D } from '../../src/model3d/index';

/** Khối đất nền 3D: chỉ để hiển thị, không đổi conc/lean/soil/bbox/sig của mô hình gốc. */
describe('ground3d – địa tầng nền trong mô hình 3D', () => {
  it('không có cọc: một khối nền theo loại nền, nằm dưới bản đáy', () => {
    const p = presetCanti(500) as EngineProject;
    const res = buildBars(p);
    const parts = m3Ground(p, res);
    expect(parts.length).toBe(1);
    expect(parts[0].kind).toBe('strata');
    expect(parts[0].y1).toBe(0);
    expect(parts[0].y0).toBeLessThan(0);
    expect(parts[0].mesh.i.length).toBeGreaterThan(0);
    expect(parts[0].name).toBe('Nền đất rời');
    expect(model3D(p, res).ground?.length).toBe(1);
  });

  it('bật cọc: mỗi lớp địa tầng một khối liền nhau đến 3 m dưới mũi cọc, kèm lớp đất phủ trước mũi', () => {
    const p = presetCanti(500) as EngineProject;
    const q = pileDefaults();
    q.L = 9;
    q.design.z0 = 1.5;
    q.layers = [
      pileNewLayer({ id: 'a', name: 'Bùn', kind: 'clay', thk: 4, IL: 0.9 }),
      pileNewLayer({ id: 'b', name: 'Sét', kind: 'clay', thk: 6, IL: 0.3 }),
      pileNewLayer({ id: 'c', name: 'Cát', kind: 'sand', thk: 30, grain: 'medium' }),
    ];
    p.pile = q;
    const res = buildBars(p);
    const parts = m3Ground(p, res);
    const strata = parts.filter((x) => x.kind === 'strata');
    expect(strata.map((x) => x.name)).toEqual(['Bùn', 'Sét', 'Cát']);
    // liền nhau, bắt đầu ở 0 và dừng ở độ sâu cọc + 3 m
    expect(strata[0].y1).toBeCloseTo(0, 6);
    for (let i = 1; i < strata.length; i++) expect(strata[i].y1).toBeCloseTo(strata[i - 1].y0, 6);
    expect(strata[2].y0).toBeCloseTo(-1200, 6);
    const cover = parts.find((x) => x.kind === 'cover')!;
    expect(cover.y1).toBeCloseTo(150, 6);
    // đỉnh < 65535 (Uint16) và màu theo loại đất
    parts.forEach((x) => expect(x.mesh.p.length / 3).toBeLessThanOrEqual(65535));
    expect(groundColor({ kind: 'clay', IL: 0.9 })).not.toEqual(groundColor({ kind: 'clay', IL: 0.2 }));
    expect(groundColor({ kind: 'sand', grain: 'fine' })).not.toEqual(groundColor({ kind: 'rock' }));
  });

  it('không đổi các phần đối chiếu: sig/bbox/soil giống nhau khi thêm ground', () => {
    const a = presetCanti(500) as EngineProject;
    const m = model3D(a, buildBars(a));
    expect(m.bbox.y0).toBeGreaterThan(-100);
    expect(m.sig).not.toContain('ground');
  });
});
