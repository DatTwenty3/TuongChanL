import { describe, expect, it } from 'vitest';
import { KE_TAB, appPresetKe, buildBars, presetKe, quantities } from '../../src/engine/index.ts';
import { buildSheet } from '../../src/cad/index';

/**
 * Mẫu 3 (khối kè): hai khác biệt cố ý so với ứng dụng gốc, đặt ở `appPresetKe`
 * (còn `presetKe` giữ nguyên để đối chiếu bản gốc).
 */
const texts = (p: ReturnType<typeof presetKe>): string[] => {
  const res = buildBars(p);
  const q = quantities(p, res);
  const sh = buildSheet(p, res, q, 0, 25);
  return sh.E.a.filter((e) => e.k === 'T').map((e) => (e as { s: string }).s);
};

describe('Mẫu 3 – mặc định chân khay và kích thước chiều cao', () => {
  it('appPresetKe: KHÔNG có chân khay ở mọi chiều cao trong bảng, kèm cờ dimStem', () => {
    KE_TAB.forEach((_, i) => {
      const p = appPresetKe({}, i);
      expect(p.key.on, `K[${i}] ${KE_TAB[i].id}`).toBe(false);
      expect(p.dimStem).toBe(true);
    });
  });

  it('presetKe vẫn như bản gốc: bản vẽ K1 (H=3,00) có chân khay, không có cờ dimStem', () => {
    const p = presetKe({}, 0);
    expect(p.key.on).toBe(true);
    expect('dimStem' in p).toBe(false);
  });

  it('H=4,20 (bản vẽ K102;K103): bản gốc ghi 500 + 4500 (tổng 5000), bản ứng dụng ghi 500 + 300 + 4200', () => {
    const idx = KE_TAB.findIndex((r) => r.H === 420);
    expect(idx).toBeGreaterThanOrEqual(0);
    // H = 420, bản đáy 80, tổng 500; bề dày mút 50 => 500 (mút) + 300 (vát) + 4200 (thân H)
    const count = (t: string[], v: string): number => t.filter((x) => x === v).length;
    const orig = texts(presetKe({}, idx));
    const app = texts(appPresetKe({}, idx));
    // bản gốc: kích thước đứng của mặt cắt ghi 4500 (= 5000 - 500); bản ứng dụng thay bằng 4200
    expect(count(orig, '4500')).toBe(1);
    expect(count(app, '4500')).toBe(0);
    // "4200" đã có sẵn 1 lần ở view khác của sheet; bản ứng dụng có thêm đúng 1 lần ở mặt cắt
    expect(count(app, '4200')).toBe(count(orig, '4200') + 1);
    // tổng chiều cao 5000 vẫn ghi đúng 1 lần
    expect(count(orig, '5000')).toBe(1);
    expect(count(app, '5000')).toBe(1);
  });
});
