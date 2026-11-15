// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { defaultProject, emptyRow } from '../../../src/hoga/engine/defaults';
import { validateRow } from '../../../src/hoga/engine/validate';
import { GA_KINDS, GA_KIND_ORDER } from '../../../src/hoga/engine/types';

describe('Kiểm tra dữ liệu nhập', () => {
  it('dữ liệu mẫu của 5 loại ga không có lỗi nặng', () => {
    for (const k of GA_KIND_ORDER) {
      const p = defaultProject(k);
      for (const r of p.rows) {
        const errs = validateRow(r, p.config, p.catalog, GA_KINDS[k]).filter((w) => w.level === 'err');
        expect(errs, `${k} ${r.name}: ${errs.map((e) => e.text).join(' | ')}`).toEqual([]);
      }
    }
  });
  it('bắt lỗi định dạng thép, cống quá lớn, cổ quá lớn', () => {
    const p = defaultProject('lienKhoi');
    const r = emptyRow('X');
    r.bottom.low = 'D10-150';
    r.pipes[0] = { spec: 'D1200', depth: 100 };
    r.pipes[1] = { spec: 'ABC', depth: 0 };
    p.config.neck.size = '3000x3000';
    r.neck.h = 400;
    const t = validateRow(r, p.config, p.catalog, GA_KINDS.lienKhoi).map((w) => w.text).join('\n');
    expect(t).toContain('Thép đáy lớp dưới');
    expect(t).toContain('không lọt vào tường');
    expect(t).toContain('sai định dạng (D400');
    expect(t).toContain('Cổ ga lớn hơn lòng ga');
  });
});
