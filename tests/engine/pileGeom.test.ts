import { describe, expect, it } from 'vitest';
import {
  appendPileBars,
  buildBars,
  geom,
  pileArea,
  pileDefaults,
  pileGrid,
  pileHoopLevels,
  pileMainOffsets,
  presetCanti,
  presetKe,
  presetRib,
  presetWall4,
  quantities,
  type EngineProject,
} from '../../src/engine/index.ts';
import { buildCsvContent } from '../../src/export/csv';
import { buildAllSheets, toDXF, toSVG } from '../../src/cad/index';
import { model3D } from '../../src/model3d/index';

/**
 * Giai đoạn 2 của mô đun móng cọc: hình học lưới cọc, thép cọc, khối lượng, bản vẽ, 3D.
 * Không có bản gốc để đối chiếu -> golden tính tay (ghi chú trong từng test).
 */

const withPile = (p: EngineProject, over: Partial<NonNullable<EngineProject['pile']>> = {}): EngineProject => {
  p.pile = { ...pileDefaults(), ...over };
  return p;
};

describe('pile – lưới cọc', () => {
  it('2 hàng, căn giữa B=300 cm, bước dọc 120 cm, Lu=1000 cm', () => {
    const p = withPile(presetCanti(500) as EngineProject, { nx: 2, sx: 1.2, sy: 1.2, centered: true });
    p.Lu = 1000;
    const B = geom(p).B;
    const g = pileGrid(p, B)!;
    // x = B/2 ± 60
    expect(g.rows.map((r) => r.x)).toEqual([B / 2 - 60, B / 2 + 60]);
    // nz = floor(1000/120) = 8 cọc mỗi hàng -> 16 cọc
    expect(g.rows[0].zs.length).toBe(8);
    expect(g.n).toBe(16);
    // đối xứng quanh Lu/2 = 500
    const zs = g.rows[0].zs;
    expect(zs[0] + zs[zs.length - 1]).toBeCloseTo(1000, 9);
    expect(zs[1] - zs[0]).toBeCloseTo(120, 9);
  });

  it('so le: hàng lẻ có ít hơn 1 cọc và lệch nửa bước', () => {
    const p = withPile(presetCanti(500) as EngineProject, { nx: 2, sy: 1.2, stagger: true });
    p.Lu = 1000;
    const g = pileGrid(p, geom(p).B)!;
    expect(g.rows[0].zs.length).toBe(8);
    expect(g.rows[1].zs.length).toBe(7);
    expect(g.rows[1].zs[0] - g.rows[0].zs[0]).toBeCloseTo(60, 9);
    expect(g.n).toBe(15);
  });

  it('cảnh báo khi cọc ra ngoài bản đáy hoặc chồng nhau', () => {
    const p = withPile(presetCanti(500) as EngineProject, { nx: 4, sx: 2, sy: 0.2, size: 0.3 });
    const g = pileGrid(p, geom(p).B)!;
    expect(g.warn.some((w) => w.includes('ngoài'))).toBe(true);
    expect(g.warn.some((w) => w.includes('chồng'))).toBe(true);
  });

  it('tắt hoặc vắng pile -> null', () => {
    const p = presetCanti(500) as EngineProject;
    expect(pileGrid(p, 300)).toBeNull();
    p.pile = { ...pileDefaults(), on: false };
    expect(pileGrid(p, 300)).toBeNull();
  });
});

describe('pile – tiết diện, đai, thép dọc', () => {
  it('diện tích: vuông 0,3² = 0,09; tròn D0,6; ống thành 0,1', () => {
    const q = pileDefaults();
    expect(pileArea({ ...q, type: 'sq', size: 0.3 })).toBeCloseTo(0.09, 12);
    expect(pileArea({ ...q, type: 'bored', size: 0.6 })).toBeCloseTo((Math.PI * 0.36) / 4, 12);
    // ống: pi/4 (0,6² - 0,4²) = pi/4 * 0,2
    expect(pileArea({ ...q, type: 'phc', size: 0.6, wall: 0.1 })).toBeCloseTo((Math.PI / 4) * 0.2, 12);
  });

  it('mức đai: L=18, Lend=1,5, sEnd=0,1, sMid=0,2 -> đếm tay', () => {
    const q = { ...pileDefaults() };
    const lv = pileHoopLevels(q);
    // đầu: t = 0,05 + 0,1k <= 1,5 -> k = 0..14 -> 15 mức (0,05 … 1,45)
    // giữa: t = 1,55 + 0,2j <= 16,5 (= L - Lend) -> j = 0..74 -> 75 mức (1,55 … 16,35)
    // đuôi: t = 16,55 + 0,1m <= 17,95 (= L - 0,05) -> m = 0..14 -> 15 mức (16,55 … 17,95)
    expect(lv.length).toBe(15 + 75 + 15);
    expect(lv[0]).toBeCloseTo(0.05, 12);
    expect(lv[14]).toBeCloseTo(1.45, 9);
    expect(lv[15]).toBeCloseTo(1.55, 9);
  });

  it('thép dọc cọc vuông 4 thanh ở 4 góc, đối xứng quanh tâm', () => {
    const q = { ...pileDefaults(), type: 'sq' as const };
    const o = pileMainOffsets(q);
    expect(o.length).toBe(4);
    // inset = cover 5 + dHoop 0,6 + dMain/2 0,8 = 6,4 cm ; h = 15 - 6,4 = 8,6
    o.forEach(([x, z]) => {
      expect(Math.abs(x)).toBeCloseTo(8.6, 9);
      expect(Math.abs(z)).toBeCloseTo(8.6, 9);
    });
    expect(pileMainOffsets({ ...q, type: 'phc' }).length).toBe(0);
  });
});

describe('pile – thép, khối lượng, bản vẽ, 3D khi bật', () => {
  const mk = (tpl: 'B' | 'A' | 'C' | 'D'): EngineProject => {
    const p =
      tpl === 'B' ? presetCanti(500) : tpl === 'A' ? presetRib() : tpl === 'C' ? presetKe({}, 3) : presetWall4({}, 1);
    return withPile(p as EngineProject);
  };

  it('thêm đúng 2 loại thép cọc, mác P1/P2, và số lượng khớp lưới cọc', () => {
    const p = mk('B');
    p.Lu = 1000;
    const res = buildBars(p);
    const pm = res.bars.find((b) => b.key === 'pm')!;
    const ph = res.bars.find((b) => b.key === 'ph')!;
    const g = pileGrid(p, res.g.B)!;
    expect(pm.mark).toBe('P1');
    expect(ph.mark).toBe('P2');
    expect(pm.items.length).toBe(g.n * 4);
    // chiều dài thanh dọc = (18 + 0,1) m = 18100 mm
    expect(pm.items[0]).toBe(18100);
    // đai vuông: inner = 300 - 2*50 - 6 = 194 mm ; chu vi 4*194 = 776 ; + 2*100 móc = 976
    expect(ph.items[0]).toBe(976);
    expect(ph.items.length).toBe(g.n * pileHoopLevels(p.pile!).length);
    // số mác tường không đổi: vẫn bắt đầu từ 1
    expect(res.bars.filter((b) => !b.pile).every((b) => !String(b.mark).startsWith('P'))).toBe(true);
  });

  it('khối lượng: bê tông cọc = diện tích × L × số cọc, thép nằm trong totKg', () => {
    const p = mk('B');
    p.Lu = 1000;
    const res = buildBars(p);
    const q = quantities(p, res);
    const n = pileGrid(p, res.g.B)!.n;
    expect(q.pile).toBeDefined();
    expect(q.pile!.n).toBe(n);
    expect(q.pile!.volEach).toBeCloseTo(0.09 * 18, 12);
    expect(q.pile!.vol).toBeCloseTo(0.09 * 18 * n, 9);
    const kgPile = res.bars.filter((b) => b.pile).reduce((s, b) => s + (b.kg ?? 0), 0);
    expect(q.pile!.steelKg).toBeCloseTo(kgPile, 9);
    expect(kgPile).toBeGreaterThan(0);
    // bê tông tường (vol) không bị cộng cọc
    const off = presetCanti(500) as EngineProject;
    off.Lu = 1000;
    const q0 = quantities(off, buildBars(off));
    expect(q.vol).toBeCloseTo(q0.vol, 9);
    expect(q.totKg).toBeGreaterThan(q0.totKg);
  });

  it('cọc ly tâm: không có thép rời trong thống kê', () => {
    const p = withPile(presetCanti(500) as EngineProject, { type: 'phc', size: 0.4, wall: 0.08 });
    const res = buildBars(p);
    expect(res.bars.some((b) => b.pile)).toBe(false);
    expect(quantities(p, res).pile?.n).toBeGreaterThan(0);
  });

  for (const tpl of ['B', 'A', 'C', 'D'] as const) {
    it(`mẫu ${tpl}: dựng đủ 5 sheet, SVG, DXF (17 layer) và mô hình 3D có cọc`, () => {
      const p = mk(tpl);
      const res = buildBars(p);
      const q = quantities(p, res);
      const sheets = buildAllSheets(p, res, q);
      expect(sheets.length).toBe(5);
      const svg = toSVG(sheets[0]);
      expect(svg).toContain('<svg');
      const dxf = toDXF(sheets);
      expect(dxf).toContain('AC1009');
      const m = model3D(p, res);
      expect(m.pile).toBeDefined();
      expect(m.pile!.i.length).toBeGreaterThan(0);
      expect(m.bbox.y0).toBeLessThanOrEqual(-p.pile!.L * 100);
      // số đỉnh <= 65535 (Uint16)
      expect(m.pile!.p.length / 3).toBeLessThanOrEqual(65535);
      const gp = m.groups.filter((g) => g.key === 'pm' || g.key === 'ph');
      expect(gp.length).toBe(2);
      // id nhóm duy nhất
      const ids = m.groups.map((g) => g.id);
      expect(new Set(ids).size).toBe(ids.length);
      // CSV có dòng thép cọc
      expect(buildCsvContent(res, q)).toContain('"P1"');
    });
  }

  it('tắt móng cọc: kết quả giống hệt khi không có khóa pile', () => {
    const a = presetCanti(500) as EngineProject;
    const b = presetCanti(500) as EngineProject;
    b.pile = { ...pileDefaults(), on: false };
    const ra = buildBars(a);
    const rb = buildBars(b);
    expect(rb.bars.length).toBe(ra.bars.length);
    expect(JSON.stringify(quantities(b, rb))).toBe(JSON.stringify(quantities(a, ra)));
    expect(model3D(b, rb).pile).toBeUndefined();
    expect(model3D(a, ra).sig).toBe(model3D(b, rb).sig);
    void appendPileBars;
  });
});
