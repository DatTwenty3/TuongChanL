// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { defaultProject } from '../../../src/hoga/engine/defaults';
import { GA_KINDS, GA_KIND_ORDER } from '../../../src/hoga/engine/types';
import { layoutSheets } from '../../../src/hoga/cad/dxf';
import { buildSummarySheets } from '../../../src/hoga/cad/sheets';
import { buildVhgSet } from '../../../src/hoga/cad/vhgSheets';
import { computeAll, summarize } from '../../../src/hoga/engine/summary';

/** Hai tờ bị coi là đè nhau khi phần chung của hai khung chữ nhật có diện tích dương. */
function overlaps(a: { ox: number; oy: number; sheet: { w: number; h: number } }, b: typeof a): boolean {
  const w = Math.min(a.ox + a.sheet.w, b.ox + b.sheet.w) - Math.max(a.ox, b.ox);
  const h = Math.min(a.oy + a.sheet.h, b.oy + b.sheet.h) - Math.max(a.oy, b.oy);
  return w > 1e-6 && h > 1e-6;
}

describe('DXF nhiều ga: bố cục các tờ', () => {
  for (const kind of GA_KIND_ORDER) {
    it(`${kind}: không có hai tờ nào đè lên nhau (20 ga + bảng tổng hợp)`, () => {
      const p = defaultProject(kind);
      const res = computeAll(p);
      const info = GA_KINDS[kind];
      const groups = res.map((r) => buildVhgSet(r, p.config, p.catalog, info));
      groups.push(buildSummarySheets(p, summarize(p, res)));
      const placed = layoutSheets(groups);
      expect(placed.length).toBe(groups.reduce((n, g) => n + g.length, 0));
      for (let i = 0; i < placed.length; i++) {
        for (let j = i + 1; j < placed.length; j++) {
          expect(overlaps(placed[i], placed[j]), `tờ ${placed[i].sheet.id} đè tờ ${placed[j].sheet.id}`).toBe(false);
        }
      }
    }, 120000);
  }

  it('hai nhóm có chiều cao rất khác nhau vẫn không đè nhau', () => {
    const mk = (id: string, w: number, h: number) => ({ id, kind: 'struct' as const, title: id, scale: 1, w, h, ents: [] });
    const placed = layoutSheets([[mk('a', 100, 50)], [mk('b', 100, 500)], [mk('c', 100, 10)]]);
    for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) expect(overlaps(placed[i], placed[j])).toBe(false);
  });
});
