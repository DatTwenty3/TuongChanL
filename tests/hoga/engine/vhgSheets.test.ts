// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { defaultProject } from '../../../src/hoga/engine/defaults';
import { GA_KINDS, GA_KIND_ORDER } from '../../../src/hoga/engine/types';
import { computeAll } from '../../../src/hoga/engine/summary';
import { bboxOf, dxfLayerOf, LAYERS, patternSegments } from '../../../src/hoga/cad/ents';
import { layoutSheets, toDXF } from '../../../src/hoga/cad/dxf';
import { sheetToSvg } from '../../../src/hoga/cad/svg';
import { buildVhgSet } from '../../../src/hoga/cad/vhgSheets';

/** Bộ bản vẽ theo bố cục của bản mẫu VHGpro (xem specs/hoga/parity-spec.md §5). */
describe('Bộ bản vẽ kiểu VHGpro', () => {
  for (const kind of GA_KIND_ORDER) {
    it(`${kind}: 5 tờ cùng tỷ lệ, đủ hình, không có số lỗi`, () => {
      const p = defaultProject(kind);
      const res = computeAll(p);
      const info = GA_KINDS[kind];
      for (const i of [0, 7]) {
        const set = buildVhgSet(res[i], p.config, p.catalog, info);
        const kinds = set.map((x) => x.kind);
        expect(kinds[0]).toBe('vhg1');
        expect(kinds[1]).toBe('vhg2');
        expect(kinds[2]).toBe('vhg3');
        expect(kinds[kinds.length - 1]).toBe('vhg5');
        expect(kinds.slice(3, -1).every((k) => k === 'vhg4')).toBe(true);
        expect(new Set(set.map((x) => x.scale)).size).toBe(1);
        const s = set[0].scale;
        for (const sh of set) {
          expect(sh.w).toBeCloseTo(420 * s, 6);
          expect(sh.h).toBeCloseTo(297 * s, 6);
          const bb = bboxOf(sh.ents);
          expect([bb.x0, bb.y0, bb.x1, bb.y1].every(Number.isFinite)).toBe(true);
          expect(JSON.stringify(sh.ents)).not.toMatch(/NaN|undefined|Infinity/);
          expect(sheetToSvg(sh, 'light')).not.toContain('NaN');
        }
        // tờ 1: 6 tên hình (xanh lá) mỗi cái kèm dòng "Tỷ lệ 1:n"
        const titles = set[0].ents.filter((e) => e.t === 'text' && e.layer === 'TIEUDE').map((e) => (e as { s: string }).s);
        expect(titles).toEqual([`MẶT BẰNG HỐ GA ${res[i].row.name}`, 'MẶT CẮT B-B', 'MẶT CẮT  CỐT THÉP A-A', 'MẶT CẮT A-A', 'MẶT BẰNG LƯỚI THÉP TƯỜNG', 'CỐT THÉP MẶT CẮT B-B']);
        const scales = set[0].ents.filter((e) => e.t === 'text' && (e as { s: string }).s === `Tỷ lệ 1:${s}`);
        expect(scales).toHaveLength(6);
        // tờ 2, 3: mỗi tờ 6 hình có tên
        for (const k of [1, 2]) expect(set[k].ents.filter((e) => e.t === 'text' && e.layer === 'TIEUDE')).toHaveLength(6);
      }
    });
  }

  it('DXF dùng tên lớp, màu và mẫu tô của bản mẫu VHGpro', () => {
    const p = defaultProject('lienKhoi');
    const res = computeAll(p);
    const dxf = toDXF(layoutSheets([buildVhgSet(res[0], p.config, p.catalog, GA_KINDS.lienKhoi)]), 'R2000');
    for (const n of ['VHG-BT', 'VHG-Thep', 'VHG-Thep2', 'VHG-Dim', 'VHG-Text', 'VHG-VL', 'VHG-Dashed', 'VHG-Center', 'VHG-140']) expect(dxf).toContain(`\r\n${n}\r\n`);
    // mẫu tô chuẩn: bê tông ANSI32 + AR-CONC, vữa ANSI37
    for (const pat of ['ANSI32', 'AR-CONC', 'ANSI37']) expect(dxf).toContain(`\r\n2\r\n${pat}\r\n`);
    // tên hình màu 3 (xanh lá) trên lớp dùng chung VHG-Text
    expect(dxfLayerOf('TIEUDE')).toEqual({ layer: 'VHG-Text', aci: 3 });
    expect(dxfLayerOf('TEXT')).toEqual({ layer: 'VHG-Text', aci: undefined });
    // bảng lớp: màu ACI theo bản mẫu
    const aci = Object.fromEntries(LAYERS.map((l) => [l.dxf + (l.name === 'TIEUDE' ? '*' : ''), l.aci]));
    expect(aci['VHG-BT']).toBe(4);
    expect(aci['VHG-Thep']).toBe(1);
    expect(aci['VHG-Thep2']).toBe(2);
    expect(aci['VHG-Dim']).toBe(140);
    expect(dxf).not.toContain('NaN');
    expect(toDXF(layoutSheets([buildVhgSet(res[0], p.config, p.catalog, GA_KINDS.lienKhoi)]), 'R12')).toContain('AC1009');
  });

  it('mẫu tô: ANSI31 cách nhau 0,125 inch × hệ số, nằm trong đa giác; AR-CONC cho nét đứt / chấm', () => {
    const sq: [number, number][][] = [[[0, 0], [1000, 0], [1000, 1000], [0, 1000]]];
    const k = 120; // ANSI × 4 × tỷ lệ 1:30
    const seg = patternSegments(sq, 'ANSI31', k);
    // khoảng cách vuông góc 0,125" × 120 = 15 mm → ~ (1000·√2)/15 ≈ 94 đường
    expect(seg.length).toBeGreaterThan(85);
    expect(seg.length).toBeLessThan(105);
    for (const [x1, y1, x2, y2] of seg) {
      for (const [x, y] of [[x1, y1], [x2, y2]]) {
        expect(x).toBeGreaterThanOrEqual(-1e-6);
        expect(x).toBeLessThanOrEqual(1000 + 1e-6);
        expect(y).toBeGreaterThanOrEqual(-1e-6);
        expect(y).toBeLessThanOrEqual(1000 + 1e-6);
      }
    }
    const conc = patternSegments(sq, 'AR-CONC', 12);
    expect(conc.length).toBeGreaterThan(50);
    // lỗ: vòng thứ hai (even-odd) bị khoét
    const hole = patternSegments([sq[0], [[400, 400], [600, 400], [600, 600], [400, 600]]], 'ANSI31', k);
    const inHole = hole.filter(([x1, y1, x2, y2]) => (x1 + x2) / 2 > 410 && (x1 + x2) / 2 < 590 && (y1 + y2) / 2 > 410 && (y1 + y2) / 2 < 590);
    expect(inHole).toHaveLength(0);
  });
});
