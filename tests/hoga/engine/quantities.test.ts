// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { defaultProject } from '../../../src/hoga/engine/defaults';
import { computeQty } from '../../../src/hoga/engine/quantities';
import { GA_KINDS } from '../../../src/hoga/engine/types';

import { fx, hasFixture } from './fixture';

if (hasFixture) {
const kl: Record<string, number | string> = fx.lienKhoi.klhg;

describe('Khối lượng ga liền khối – đối chiếu với cột KL HG của tệp Excel mẫu', () => {
  const p = defaultProject('lienKhoi');
  const info = GA_KINDS.lienKhoi;
  p.rows.slice(0, 20).forEach((row, i) => {
    const r = 8 + i;
    const q = computeQty(row, p.config, p.catalog, info);
    const n = (c: string) => Number(kl[c + r]);
    it(`${row.name}: chiều cao, cao trình, lớp lót, bản đáy`, () => {
      expect(q.height - row.bottom.t / 1000).toBeCloseTo(n('F'), 6);
      expect(q.levelTop!).toBeCloseTo(n('D'), 6);
      expect(q.liner1).toBeCloseTo(n('X'), 6);
      expect(q.bottomConc).toBeCloseTo(n('Y'), 6);
      expect(q.bottomForm).toBeCloseTo(n('Z'), 6);
    });
    it(`${row.name}: tường, lỗ cống, ván khuôn`, () => {
      // Excel trừ thêm (a+b)/2·vát trần² thay vì (L+B)·vát²: sai khác đã biết = neckAvg·c²
      const knownDiff = 0.7 * 0.1 * 0.1;
      expect(q.wallConcGross - n('AC')).toBeCloseTo(knownDiff, 6);
      for (let k = 0; k < 4; k++) {
        expect(q.wallConcCut[k]).toBeCloseTo(Number(kl[['AD', 'AE', 'AF', 'AG'][k] + r] ?? 0), 6);
        expect(q.wallFormCut[k]).toBeCloseTo(Number(kl[['AJ', 'AK', 'AL', 'AM'][k] + r] ?? 0), 6);
      }
      expect(q.wallFormGross).toBeCloseTo(n('AI'), 6);
      expect(q.wallRim).toBeCloseTo(n('AN'), 6);
      expect(q.wallForm).toBeCloseTo(n('AO'), 6);
    });
    it(`${row.name}: trần, cổ, vữa chèn khe`, () => {
      expect(q.roofConc).toBeCloseTo(n('AR'), 6);
      expect(q.roofForm).toBeCloseTo(n('AS'), 6);
      expect(q.neckConc).toBeCloseTo(n('AV'), 6);
      expect(q.neckForm).toBeCloseTo(n('AW'), 6);
      expect(q.mortarPipe).toBeCloseTo(n('AZ'), 6);
    });
    it(`${row.name}: đào, đắp`, () => {
      expect(q.dig.hDig).toBeCloseTo(n('BH'), 6);
      expect(q.dig.baseL).toBeCloseTo(n('BJ'), 6);
      expect(q.dig.dig).toBeCloseTo(n('BP'), 6);
      expect(q.dig.fillFull).toBeCloseTo(n('BQ'), 6);
      expect(q.dig.minusLiner).toBeCloseTo(n('BR'), 6);
    });
  });
});
}
if (!hasFixture) it.skip('đối chiếu Excel mẫu VHGpro: bỏ qua vì thiếu tests/hoga/fixtures/vhg-templates.json', () => {});
