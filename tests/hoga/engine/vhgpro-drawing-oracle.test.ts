// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { defaultProject } from '../../../src/hoga/engine/defaults';
import { computeRebar, barKg } from '../../../src/hoga/engine/rebar';
import { GA_KINDS } from '../../../src/hoga/engine/types';

/**
 * Số liệu đo từ bản vẽ mẫu "VHG1.Ga thăm liền khối.dwg" do VHGpro 4 vẽ (đọc bằng AutoCAD → DXF → các block thống kê TK.*),
 * ga G400-1 với đúng cấu hình mẫu (bản đáy 2500×1750, lớp bảo vệ đáy 20, A150, chia đều):
 *   Đáy trên  D1 Ø10 L=2460 móc 110×2 (DAI 2680) n=14 ; D2 L=1710 (DAI 1930) n=19
 *   Đáy dưới  D1 L=2460 n=14 ; D2 L=1710 n=19
 *   Thép buộc chữ U đáy Ø6 DAI 620 ; thép đứng tường lớp ngoài L=1550 móc 100×2 (DAI 1750)
 *   Thép ngang tường (lớp ngoài và lớp trong) L=2250
 * Khối lượng đáy hai lớp (không kể thép buộc) = 23,13+22,61+21,23+20,03 = 87,00 kg.
 */
describe('Đối chiếu bản vẽ mẫu của VHGpro 4 (ga G400-1, loại liền khối)', () => {
  const p = defaultProject('lienKhoi');
  const r = computeRebar(p.rows[0], p.config, p.catalog, GA_KINDS.lienKhoi, p.angles);
  const find = (part: string, label: RegExp) => r.groups.filter((g) => g.part === part && label.test(g.label));

  it('lưới bản đáy: chiều dài, số thanh, móc', () => {
    const up = find('bottom', /lớp trên/);
    const low = find('bottom', /lớp dưới/);
    const x = up.find((g) => g.length === 2680)!;
    const y = up.find((g) => g.length === 1930)!;
    expect([x.count, y.count]).toEqual([14, 19]);
    expect(find('bottom', /lớp dưới – phương X/)[0]).toMatchObject({ length: 2460, count: 14 });
    expect(low.find((g) => g.length === 1710)!.count).toBe(19);
  });

  it('khối lượng hai lớp thép đáy = 87,00 kg như VHGpro', () => {
    const kg = r.groups.filter((g) => g.part === 'bottom' && /Đáy lớp/.test(g.label)).reduce((a, g) => a + barKg(g), 0);
    expect(kg).toBeCloseTo(87.0, 1);
  });

  it('thép buộc chữ U của đáy dài 620 mm', () => {
    expect(find('bottom', /thép buộc/)[0].length).toBe(620);
  });

  it('thép đứng lớp ngoài tường dài 1750 (L 1550 + 2 móc 100) và thép ngang lớp trong dài 2250', () => {
    expect(r.groups.some((g) => g.part === 'wall' && /lớp ngoài – thép đứng/.test(g.label) && g.length === 1750 && g.count >= 8)).toBe(true);
    expect(r.groups.some((g) => g.part === 'wall' && /lớp trong – thép ngang/.test(g.label) && g.length === 2250)).toBe(true);
  });
});
