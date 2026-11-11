import { describe, expect, it } from 'vitest';
import {
  pileArea,
  pileMainOffsets,
  allChecks,
  badgeStatusAll,
  calcBadgeStatus,
  calcChecks,
  calcRun,
  pileDefaults,
  pileNewLayer,
  pileRun,
  pileRowLoads,
  pileGrid,
  presetCanti,
  type EngineProject,
  type PileWallCombo,
} from '../../src/engine/index.ts';

/**
 * Golden tính tay cho sức chịu tải cọc theo TCVN 10304:2025 (không có oracle bản gốc).
 * Địa tầng thử: một lớp sét IL = 0,3 dày 20 m; cọc vuông 0,3 m, dài 9 m, đáy đài cách mặt đất 1 m,
 * đóng bằng búa (γR,R = γR,f = 1,0).
 *
 *  - Mũi cọc ở độ sâu 10 m: Bảng 2, sét IL 0,3 → qb = 3500 kPa; A = 0,09 m² → Rb = 315 kN.
 *  - Chia lớp dày 1,8 m (≤ 2 m, Chú thích Bảng 3), độ sâu giữa lớp từ mặt đất 1,9; 3,7; 5,5; 7,3; 9,1 m.
 *    Bảng 3, cột IL 0,3 (z=1:23, 2:30, 3:35, 4:38, 5:40, 6:42, 8:44, 10:46), nội suy:
 *      29,3 · 37,1 · 41,0 · 43,3 · 45,1  → Σ = 195,8 kPa;  Σ fi·hi = 195,8 × 1,8 = 352,44 kN/m
 *  - u = 1,2 m → Rf = 422,928 kN.   Rk = 315 + 422,928 = 737,928 kN.
 */
function mk(): EngineProject {
  const p = presetCanti(500) as EngineProject;
  const q = pileDefaults();
  q.type = 'sq';
  q.size = 0.3;
  q.L = 9;
  q.nx = 2;
  q.sx = 1.2;
  q.sy = 1.2;
  q.design.z0 = 1;
  q.design.cls = 'C2';
  q.design.install = 'hammer';
  q.design.selfWeight = false;
  q.layers = [pileNewLayer({ id: 'a', name: 'Sét', kind: 'clay', thk: 20, IL: 0.3, clayType: 'clay' })];
  p.pile = q;
  return p;
}

describe('pileCore – sức chịu tải cọc đóng theo TCVN 10304:2025', () => {
  it('Rk theo Bảng 2 + Bảng 3 khớp tính tay', () => {
    const p = mk();
    const combo: PileWallCombo[] = [{ k: 'Ia', nm: 'Cường độ Ia', N: 100, s: 0, H: 0 }];
    const r = pileRun(p, combo, 300)!;
    expect(r).not.toBeNull();
    expect(r.ok).toBe(true);
    const c = r.comp!;
    expect(c.qb).toBeCloseTo(3500, 6);
    expect(c.Rb).toBeCloseTo(315, 6);
    expect(c.rows.map((x) => x.fi)).toEqual([
      expect.closeTo(29.3, 6),
      expect.closeTo(37.1, 6),
      expect.closeTo(41, 6),
      expect.closeTo(43.3, 6),
      expect.closeTo(45.1, 6),
    ]);
    expect(c.Rf).toBeCloseTo(422.928, 3);
    expect(c.Rk).toBeCloseTo(737.928, 3);
  });

  it('phản lực đầu cọc: N đúng tâm chia đều, lệch tâm theo N/n ± N·e·x/Σx²', () => {
    const p = mk();
    const g = pileGrid(p, 300)!;
    // 2 hàng tại x = 90 và 210 cm; đơn nguyên Lu = 100 cm mặc định?  Lấy bước hiệu dụng từ kết quả.
    const r0 = pileRun(p, [{ k: 'x', nm: 'x', N: 100, s: 0, H: 0 }], 300)!;
    const s = r0.sEff;
    expect(r0.reactions[0].rows[0]).toBeCloseTo((100 * s) / 2, 6);
    expect(r0.reactions[0].rows[1]).toBeCloseTo((100 * s) / 2, 6);
    // hợp lực lệch về gót 0,3 m → hàng gót (x lớn) chịu thêm N·s·e/(2·0,6)
    const rows = pileRowLoads(g, { k: 'x', nm: 'x', N: 100, s: 0.3, H: 0 }, s);
    const N = 100 * s;
    // xc = 1,5 m; Σ(x−xc)² = 2·0,6² = 0,72; e = 0,3 → ΔN = N·0,3·0,6/0,72 = 0,25·N
    expect(rows[0]).toBeCloseTo(N / 2 - 0.25 * N, 6);
    expect(rows[1]).toBeCloseTo(N / 2 + 0.25 * N, 6);
  });

  it('thiếu địa tầng: báo thiếu thay vì cho kết quả', () => {
    const p = mk();
    p.pile!.layers[0].thk = 4;
    const r = pileRun(p, [{ k: 'x', nm: 'x', N: 100, s: 0, H: 0 }], 300)!;
    expect(r.ok).toBe(false);
    expect(r.missing.length).toBeGreaterThan(0);
  });

  it('tắt cọc thì pileRun trả null', () => {
    const p = presetCanti(500) as EngineProject;
    expect(pileRun(p, [], 300)).toBeNull();
  });
});

describe('pileCore – các phương pháp khác', () => {
  it('theo SPT (Phụ lục D): cát N = 20, cọc đóng 0,3 m dài 9 m → Rk = 972 kN', () => {
    // N̄ = 20 trong khoảng [L − 4d, L + d]; qb = 300·η·N̄ = 6000 kPa (≤ 18000) → Rb = 6000 · 0,09 = 540
    // fs = 2,0·N = 40 kPa (≤ 100) → Rf = 1,2 · 40 · 9 = 432;  Rk = 972
    const p = mk();
    p.pile!.method = 'spt';
    p.pile!.layers = [pileNewLayer({ id: 'c', name: 'Cát', kind: 'sand', thk: 20, N: 20, grain: 'medium' })];
    const r = pileRun(p, [{ k: 'x', nm: 'x', N: 100, s: 0, H: 0 }], 300)!;
    expect(r.ok).toBe(true);
    expect(r.comp!.Rb).toBeCloseTo(540, 6);
    expect(r.comp!.Rf).toBeCloseTo(432, 6);
    expect(r.comp!.Rk).toBeCloseTo(972, 6);
  });

  it('cọc khoan nhồi trong sét: qb theo Bảng 8, γR,f theo Bảng 6 (tính tay)', () => {
    // d = 0,8 m, L = 20 m, z0 = 1 m, sét IL = 0,3, khoan trong dung dịch (γR,f = 0,6)
    // mũi ở 21 m: qb = 1650 + 0,1·(2300 − 1650) = 1715 kPa; A = π·0,8²/4 = 0,50265 → Rb = 862,05 kN
    // fi (IL 0,3) tại z = 2,4,…,20: 30,38,42,44,46,48,50,52,54,56 → Σ = 460; hi = 2 m
    // Rf = π·0,8 · 0,6 · 460 · 2 = 1387,33 kN;  Rk = 2249,38 kN
    const p = mk();
    const q = p.pile!;
    q.type = 'bored';
    q.size = 0.8;
    q.L = 20;
    q.nx = 1;
    q.design.bored = 'wet';
    q.layers = [pileNewLayer({ id: 'c', name: 'Sét', kind: 'clay', thk: 40, IL: 0.3, clayType: 'clay' })];
    const r = pileRun(p, [{ k: 'x', nm: 'x', N: 100, s: 0, H: 0 }], 300)!;
    expect(r.ok).toBe(true);
    expect(r.comp!.qb).toBeCloseTo(1715, 6);
    expect(r.comp!.Rb).toBeCloseTo(862.05, 1);
    expect(r.comp!.Rf).toBeCloseTo(1387.33, 1);
    expect(r.comp!.Rk).toBeCloseTo(2249.38, 1);
  });

  it('cọc khoan nhồi mũi trong cát: qb theo công thức (14) hữu hạn, dương và không vượt Bảng 2', () => {
    const p = mk();
    const q = p.pile!;
    q.type = 'bored';
    q.size = 0.8;
    q.L = 20;
    q.nx = 1;
    q.layers = [pileNewLayer({ id: 's', name: 'Cát', kind: 'sand', thk: 40, phi: 31, grain: 'medium', gamma: 19 })];
    const r = pileRun(p, [{ k: 'x', nm: 'x', N: 100, s: 0, H: 0 }], 300)!;
    expect(r.ok).toBe(true);
    expect(Number.isFinite(r.comp!.qb)).toBe(true);
    expect(r.comp!.qb).toBeGreaterThan(0);
    expect(r.comp!.qb).toBeLessThanOrEqual(4800 + 1e-6); // Bảng 2, cát vừa, z = 21 m
    expect(r.comp!.Rk).toBeGreaterThan(0);
  });

  it('nhập từ thí nghiệm nén tĩnh: γk = 1,2, Rd = Rk/γk', () => {
    const p = mk();
    p.pile!.method = 'test';
    p.pile!.Qtest = 1000;
    p.pile!.design.testKind = 'static';
    const r = pileRun(p, [{ k: 'x', nm: 'x', N: 100, s: 0, H: 0 }], 300)!;
    expect(r.comp!.gk).toBeCloseTo(1.2, 6);
    expect(r.comp!.Rd).toBeCloseTo(1000 / 1.2, 6);
  });

  it('thí nghiệm chưa nhập Qtest: báo thiếu', () => {
    const p = mk();
    p.pile!.method = 'test';
    p.pile!.Qtest = null;
    const r = pileRun(p, [{ k: 'x', nm: 'x', N: 100, s: 0, H: 0 }], 300)!;
    expect(r.ok).toBe(false);
    expect(r.missing.join(' ')).toContain('thí nghiệm');
  });

  it('hợp lực lệch về mũi quá lớn làm hàng gót chịu kéo → kiểm tra nhổ', () => {
    const p = mk();
    const r = pileRun(p, [{ k: 'x', nm: 'x', N: 10, s: 0.8, H: 0 }], 300)!;
    // hai hàng cách tâm ±0,6 m, Σ = 0,72: hàng mũi = N'·(0,5 − 0,8·0,6/0,72) = −N'/6 < 0 (kéo)
    expect(r.NdTens).toBeGreaterThan(0);
    expect(r.tens).toBeDefined();
  });
});

describe('pileChecks – nối với kết quả tính tường', () => {
  it('tắt cọc: allChecks và badgeStatusAll giống hệt calcChecks / calcBadgeStatus', () => {
    const p = presetCanti(500) as EngineProject;
    const R = calcRun(p);
    expect(allChecks(p, R)).toEqual(calcChecks(R));
    expect(badgeStatusAll(R, p)).toEqual(calcBadgeStatus(R, p));
  });

  it('bật cọc: br và sl chỉ còn tham khảo, thêm kiểm tra cọc; tắt ignoreShallow thì trả lại', () => {
    const p = presetCanti(500) as EngineProject;
    p.pile = pileDefaults();
    const R = calcRun(p);
    const items = allChecks(p, R);
    const base = calcChecks(R);
    expect(items.length).toBeGreaterThan(base.length);
    expect(items.slice(0, base.length).map((c) => c.id)).toEqual(base.map((c) => c.id));
    for (const id of ['br', 'sl']) {
      const x = items.find((c) => c.id === id);
      if (x) expect(x.info).toBe(true);
    }
    expect(items.some((c) => c.id === 'pile-axial')).toBe(true);
    p.pile.ignoreShallow = false;
    const items2 = allChecks(p, R);
    for (const id of ['br', 'sl']) {
      const x = items2.find((c) => c.id === id);
      if (x) expect(x.info).toBeFalsy();
    }
  });
});

describe('cọc tròn đặc đúc sẵn (rc)', () => {
  it('tiết diện tròn đặc, chu vi πd, thép dọc bố trí trên vòng tròn, hạ cọc theo bảng cọc đóng', () => {
    const p = mk();
    const q = p.pile!;
    q.type = 'rc';
    q.size = 0.4;
    q.cage.nMain = 8;
    expect(pileArea(q)).toBeCloseTo(Math.PI * 0.04, 9);
    const offs = pileMainOffsets(q);
    expect(offs.length).toBe(8);
    const r0 = Math.hypot(offs[0][0], offs[0][1]);
    offs.forEach((o) => expect(Math.hypot(o[0], o[1])).toBeCloseTo(r0, 9));
    const r = pileRun(p, [{ k: 'x', nm: 'x', N: 100, s: 0, H: 0 }], 300)!;
    expect(r.ok).toBe(true);
    expect(r.comp!.u).toBeCloseTo(Math.PI * 0.4, 9);
    expect(r.comp!.A).toBeCloseTo(Math.PI * 0.04, 9);
    expect(r.comp!.gRR).toBe(1);
  });
});
