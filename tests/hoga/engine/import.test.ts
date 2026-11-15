// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { importWorkbook, type SheetReader } from '../../../src/hoga/export/importXlsx';
import { computeAll } from '../../../src/hoga/engine/summary';
import { GA_KINDS, GA_KIND_ORDER, type GaKind } from '../../../src/hoga/engine/types';

import { fx, hasFixture } from './fixture';

if (hasFixture) {

function readerFor(kind: GaKind): SheetReader {
  const f = fx[kind];
  const cf: Record<string, unknown> = f.cfGa;
  const cong = new Map<string, unknown>(f.cfCong);
  const data = new Map<string, unknown>(f.cfData);
  const rows: Record<string, unknown>[] = f.rows;
  return {
    names: [GA_KINDS[kind].sheet, 'CF.Ga', 'CF.Cong', 'CF.Data'],
    cell(sheet, addr) {
      if (sheet === 'CF.Ga') return cf[addr];
      if (sheet === 'CF.Cong') return cong.get(addr);
      if (sheet === 'CF.Data') return data.get(addr);
      const m = /^([A-Z]+)(\d+)$/.exec(addr)!;
      const r = Number(m[2]) - 4;
      return rows[r]?.[m[1]];
    },
  };
}

describe('Nhập tệp Excel mẫu của 5 loại ga', () => {
  for (const kind of GA_KIND_ORDER) {
    it(`${kind}: đọc đủ 20 ga, danh mục cống, thép hình; tính được khối lượng`, () => {
      const { project, warnings } = importWorkbook(readerFor(kind));
      expect(warnings).toEqual([]);
      expect(project.kind).toBe(kind);
      expect(project.rows).toHaveLength(20);
      expect(project.rows[0].name).toBe('G400-1');
      expect(project.catalog.round).toHaveLength(18);
      expect(project.catalog.box.length).toBeGreaterThan(10);
      expect(project.catalog.ditch.length).toBeGreaterThan(5);
      expect(project.angles['V30x30x3']).toBeCloseTo(1.36, 9);
      const res = computeAll(project);
      for (const r of res) {
        expect(Number.isFinite(r.qty.bottomConc)).toBe(true);
        expect(Number.isFinite(r.rebar.totalKg)).toBe(true);
        expect(r.rebar.totalKg).toBeGreaterThan(0);
      }
    });
  }
  it('liền khối: cấu hình CF.Ga', () => {
    const c = importWorkbook(readerFor('lienKhoi')).project.config;
    expect(c.liner).toEqual({ l1Ext: 100, l1T: 100, l2Ext: 100, l2T: 0 });
    expect(c.bottom).toEqual({ ext: 100, chamfer: 100, chamferDia: 12, hook: 250 });
    expect(c.roof).toEqual({ chamfer: 100, chamferDia: 14, hook: 200 });
    expect(c.neck.pos).toBe('Góc T1-T2');
    expect(c.neck.size).toBe('700x700');
    expect(c.neck.chamfer).toBe(false);
    expect(c.lid.type).toBe('Gang');
    expect(c.cover.bottom).toBe(20);
    expect(c.cover.wall).toBe(25);
    expect(c.fmt.bottomUp).toBe('2M');
    expect(c.fmt.mesh).toBe('Chia đều');
    expect(c.ties.spec).toBe('D6A300');
    expect(c.ladder.dens).toBe('500x300');
    expect(c.pipeHole.form).toBe('Bo+Xiên');
  });
  it('nắp rời: chốt thép, cổ ở góc T3-T4, nắp BTCT', () => {
    const c = importWorkbook(readerFor('napRoi')).project.config;
    expect(c.bottom.ext).toBe(0);
    expect(c.precast.pin).toBe(true);
    expect(c.precast.pinSpec).toBe('D18A300');
    expect(c.precast.mortar).toBe(15);
    expect(c.neck.pos).toBe('Góc T3-T4');
    expect(c.neck.size).toBe('570x820');
    expect(c.lid.type).toBe('BTCT');
  });
  it('thăm + thu: cửa thu nước', () => {
    const c = importWorkbook(readerFor('thamThuNapRoi')).project.config;
    expect(c.inlet.hole).toBe('550x250');
    expect(c.inlet.thick).toBe('125x150');
    expect(c.inlet.beamMain).toBe('4D12');
    expect(c.inlet.beamStirrup).toBe('D6A150');
    expect(c.inlet.side).toBe('Giữa T4');
  });
  it('không cổ: vát đỉnh tường, tấm nắp 2 tấm dọc', () => {
    const p = importWorkbook(readerFor('khongCo')).project;
    const c = p.config;
    expect(c.wall.topChamfer.on).toBe(true);
    expect(c.wall.topChamfer.size).toBe('75x120');
    expect(c.lid.nSlabs).toBe(2);
    expect(c.lid.dir).toBe('Dọc');
    expect(c.lid.lift).toBe('2D10');
    expect(c.fmt.mesh).toBe('Theo mật độ');
    expect(c.cover.bottom).toBe(30);
    expect(p.rows[0].roof.low).toBe('D10A150');
    expect(p.rows[0].neck.h).toBe(0);
  });
});

describe('Dữ liệu mẫu trong ứng dụng trùng với dữ liệu đọc từ tệp Excel mẫu', () => {
  for (const kind of GA_KIND_ORDER) {
    it(`${kind}: 20 ga giống nhau từng ô`, async () => {
      const { project } = importWorkbook(readerFor(kind));
      const { defaultProject } = await import('../../../src/hoga/engine/defaults');
      expect(defaultProject(kind).rows).toEqual(project.rows);
    });
  }
});
}
if (!hasFixture) it.skip('đối chiếu Excel mẫu VHGpro: bỏ qua vì thiếu tests/hoga/fixtures/vhg-templates.json', () => {});
