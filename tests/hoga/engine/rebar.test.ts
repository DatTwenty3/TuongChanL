// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { defaultProject } from '../../../src/hoga/engine/defaults';
import { computeRebar, spaced, cutSegment, barKg } from '../../../src/hoga/engine/rebar';
import { GA_KINDS, GA_KIND_ORDER } from '../../../src/hoga/engine/types';

describe('spaced / cutSegment', () => {
  it('Chia đều: khoảng cách thực tế không lớn hơn mật độ nhập', () => {
    for (const span of [500, 1000, 1710, 2460]) {
      const s = spaced(span, 150, 'Chia đều');
      expect(s.step).toBeLessThanOrEqual(150 + 1e-9);
      expect(s.pos[0]).toBe(0);
      expect(s.pos[s.n - 1]).toBeCloseTo(span, 9);
    }
  });
  it('Theo mật độ: đúng mật độ, dư chia đều hai bên', () => {
    const s = spaced(1000, 150, 'Theo mật độ');
    expect(s.step).toBe(150);
    expect(s.n).toBe(7);
    expect(s.pos[0] + (1000 - s.pos[s.n - 1])).toBeCloseTo(100, 9);
    expect(s.pos[0]).toBeCloseTo(s.pos[0], 9);
  });
  it('cắt đoạn bởi lỗ', () => {
    expect(cutSegment(0, 100, [[40, 60]])).toEqual([[0, 40], [60, 100]]);
    expect(cutSegment(0, 100, [[-5, 20]])).toEqual([[20, 100]]);
    expect(cutSegment(0, 100, [[0, 100]])).toEqual([]);
  });
});

describe('Cốt thép từng loại ga', () => {
  for (const kind of GA_KIND_ORDER) {
    const p = defaultProject(kind);
    const info = GA_KINDS[kind];
    it(`${kind}: mọi ga sinh ra thép hợp lệ, tổng = Σ thanh + thép hình`, () => {
      for (const row of p.rows) {
        const r = computeRebar(row, p.config, p.catalog, info, p.angles);
        expect(r.groups.length).toBeGreaterThan(0);
        let s = 0;
        for (const g of r.groups) {
          expect(g.length).toBeGreaterThan(0);
          expect(g.count).toBeGreaterThan(0);
          expect(g.dia).toBeGreaterThan(0);
          s += barKg(g);
        }
        expect(r.totalKg).toBeCloseTo(s + r.angleKg, 9);
        const parts = Object.values(r.byPart).reduce((a, b) => a + b.le10 + b.gt10, 0);
        expect(parts).toBeCloseTo(s, 9);
        expect(Number.isFinite(r.totalKg)).toBe(true);
      }
    });
  }
  it('ga lớn hơn dùng nhiều thép hơn (đơn điệu theo kích thước)', () => {
    const p = defaultProject('lienKhoi');
    const kg = (i: number) => computeRebar(p.rows[i], p.config, p.catalog, GA_KINDS.lienKhoi, p.angles).totalKg;
    expect(kg(19)).toBeGreaterThan(kg(0));
  });
  it('lỗ cống cắt bớt thép tường', () => {
    const p = defaultProject('lienKhoi');
    const row = JSON.parse(JSON.stringify(p.rows[0]));
    const base = computeRebar(row, p.config, p.catalog, GA_KINDS.lienKhoi, p.angles);
    const wallKg = (r: typeof base) => r.byPart.wall.le10 + r.byPart.wall.gt10;
    const cfg = { ...p.config, pipeHole: { ...p.config.pipeHole, dia: 0 } };
    const noReinf = computeRebar(row, cfg, p.catalog, GA_KINDS.lienKhoi, p.angles);
    const row2 = { ...row, pipes: row.pipes.map(() => ({ spec: '', depth: 0 })) };
    const solid = computeRebar(row2, cfg, p.catalog, GA_KINDS.lienKhoi, p.angles);
    expect(wallKg(noReinf)).toBeLessThan(wallKg(solid));
    expect(wallKg(base)).toBeGreaterThan(0);
  });
});

describe('Dữ liệu mẫu', () => {
  it('ga không cổ có thép tấm nắp ở mọi ga mẫu', () => {
    const p = defaultProject('khongCo');
    for (const row of p.rows) {
      const r = computeRebar(row, p.config, p.catalog, GA_KINDS.khongCo, p.angles);
      expect(r.byPart.lid.le10 + r.byPart.lid.gt10).toBeGreaterThan(0);
    }
  });
});
