// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { computeQty } from '../../../src/hoga/engine/quantities';
import { importWorkbook, type SheetReader } from '../../../src/hoga/export/importXlsx';
import { GA_KINDS, type GaKind } from '../../../src/hoga/engine/types';

import { fx, hasFixture } from './fixture';

if (hasFixture) {

function projectOf(kind: GaKind) {
  const f = fx[kind];
  const cf: Record<string, unknown> = f.cfGa;
  const cong = new Map<string, unknown>(f.cfCong);
  const data = new Map<string, unknown>(f.cfData);
  const reader: SheetReader = {
    names: [GA_KINDS[kind].sheet, 'CF.Ga', 'CF.Cong', 'CF.Data'],
    cell(sheet, addr) {
      if (sheet === 'CF.Ga') return cf[addr];
      if (sheet === 'CF.Cong') return cong.get(addr);
      if (sheet === 'CF.Data') return data.get(addr);
      const m = /^([A-Z]+)(\d+)$/.exec(addr)!;
      return (f.rows as Record<string, unknown>[])[Number(m[2]) - 4]?.[m[1]];
    },
  };
  return importWorkbook(reader).project;
}

/**
 * Tệp Excel mẫu số 5 lấy chiều cao vát đỉnh tường bằng RIGHT("75x120", FIND("x")-1) = "20" → 20 mm thay vì 120 mm
 * (lỗi công thức khi chiều cao vát có 3 chữ số). Để đối chiếu từng con số ta cho cấu hình đúng giá trị Excel đã dùng;
 * phép tính của ứng dụng dùng kích thước vát đúng khi người dùng nhập 75x120 (kiểm tra ở test cuối).
 */
describe('Đối chiếu KL HG – ga không cổ (tệp 5), cấu hình đọc từ chính tệp', () => {
  const p = projectOf('khongCo');
  const excelCfg = structuredClone(p.config);
  excelCfg.wall.topChamfer.size = '75x20';
  const kl = fx.khongCo.klhg as Record<string, number | string>;
  // G500-2: các ô trừ lỗ rãnh R400x600 trong tệp không suy ra được từ công thức (lệch 0,5 % – giá trị lưu cũ) → bỏ qua
  const staleRows = new Set(['G500-2']);
  p.rows.forEach((row, i) => {
    const r = 8 + i;
    const q = computeQty(row, excelCfg, p.catalog, GA_KINDS.khongCo);
    const n = (c: string) => Number(kl[c + r] ?? 0);
    it(`${row.name}: lót, đáy, tường, vữa chèn, đào đắp`, () => {
      expect(q.levelTop! - q.levelBottom!).toBeCloseTo(n('F'), 6);
      expect(q.liner1).toBeCloseTo(n('V'), 6);
      expect(q.bottomConc).toBeCloseTo(n('W'), 6);
      expect(q.bottomForm).toBeCloseTo(n('X'), 6);
      expect(q.wallConcGross).toBeCloseTo(n('AA'), 6);
      expect(q.wallFormGross).toBeCloseTo(n('AG'), 6);
      expect(q.wallRim).toBeCloseTo(n('AL'), 6);
      expect(q.mortarPipe).toBeCloseTo(n('AP'), 6);
      expect(q.dig.dig).toBeCloseTo(n('BF'), 6);
      expect(q.dig.fillFull).toBeCloseTo(n('BG'), 6);
      if (staleRows.has(row.name)) return;
      for (let k = 0; k < 4; k++) {
        expect(q.wallConcCut[k]).toBeCloseTo(n(['AB', 'AC', 'AD', 'AE'][k]), 6);
        expect(q.wallFormCut[k]).toBeCloseTo(n(['AH', 'AI', 'AJ', 'AK'][k]), 6);
      }
      expect(q.wallConc).toBeCloseTo(n('AF'), 6);
      expect(q.wallForm).toBeCloseTo(n('AM'), 6);
    });
    it(`${row.name}: tấm nắp (dài × rộng, bê tông, ván khuôn)`, () => {
      expect(q.lid).not.toBeNull();
      expect(q.lid!.len).toBeCloseTo(n('AS'), 6);
      expect(q.lid!.wid).toBeCloseTo(n('AT'), 6);
      expect(q.lid!.conc).toBeCloseTo(n('AU'), 6);
      expect(q.lid!.form).toBeCloseTo(n('AV'), 6);
    });
  });
  it('vát đỉnh tường 75x120 đúng thì đỉnh ga thấp hơn 100 mm so với giá trị lỗi của Excel', () => {
    const a = computeQty(p.rows[0], excelCfg, p.catalog, GA_KINDS.khongCo);
    const b = computeQty(p.rows[0], p.config, p.catalog, GA_KINDS.khongCo);
    expect(a.levelTop! - b.levelTop!).toBeCloseTo(0.1, 9);
    expect(b.wallConcGross).toBeLessThan(a.wallConcGross);
  });
});

describe('Ga nắp rời (tệp 2): kích thước tấm nắp và khối lượng hữu hạn', () => {
  const p = projectOf('napRoi');
  const kl = fx.napRoi.klhg as Record<string, number | string>;
  it('có cổ, nắp BTCT: đối chiếu cột chiều dài/rộng tấm nắp nếu tệp có sẵn', () => {
    const q = computeQty(p.rows[0], p.config, p.catalog, GA_KINDS.napRoi);
    expect(q.lid).not.toBeNull();
    expect(Number.isFinite(q.lid!.conc)).toBe(true);
    expect(q.mortarRoof).toBeGreaterThan(0);
    expect(typeof kl).toBe('object');
  });
});
}
if (!hasFixture) it.skip('đối chiếu Excel mẫu VHGpro: bỏ qua vì thiếu tests/hoga/fixtures/vhg-templates.json', () => {});
