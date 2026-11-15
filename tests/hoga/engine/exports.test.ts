// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { defaultProject } from '../../../src/hoga/engine/defaults';
import { computeAll, summarize } from '../../../src/hoga/engine/summary';
import { buildXlsx, barTable, qtyTable, steelTable, toCsv } from '../../../src/hoga/export/exportXlsx';
import { importXlsxFile } from '../../../src/hoga/export/importXlsx';
import { baseName, parseProject, serializeProject } from '../../../src/hoga/export/projectIo';
import { GA_KIND_ORDER } from '../../../src/hoga/engine/types';
import { layoutSheets, toDXF } from '../../../src/hoga/cad/dxf';
import { buildScheduleSheets, buildSummarySheets, buildViewSheet } from '../../../src/hoga/cad/sheets';
import { sheetToSvg } from '../../../src/hoga/cad/svg';
import { GA_KINDS } from '../../../src/hoga/engine/types';

describe('Tổng hợp & xuất', () => {
  it('THKL: số lượng ga nhân đúng và mọi khối lượng hữu hạn', () => {
    const p = defaultProject('lienKhoi');
    const res = computeAll(p);
    const one = summarize(p, res);
    p.rows.forEach((r) => (r.count = 3));
    const three = summarize(p, computeAll(p));
    expect(three.length).toBe(one.length);
    one.forEach((it, i) => {
      expect(Number.isFinite(it.value)).toBe(true);
      expect(three[i].value).toBeCloseTo(it.value * 3, 6);
    });
    expect(one.find((i) => i.name.startsWith('BTCT bản đáy'))!.value).toBeGreaterThan(30);
  });

  it('bảng chiết tính có đúng số dòng và cột', () => {
    const p = defaultProject('thamThuNapRoi');
    const res = computeAll(p);
    for (const t of [qtyTable(p, res), steelTable(res)]) {
      expect(t.rows).toHaveLength(20);
      t.rows.forEach((r) => expect(r).toHaveLength(t.head.length));
    }
    const b = barTable(res);
    b.rows.forEach((r) => expect(r).toHaveLength(b.head.length));
    const csv = toCsv(b);
    expect(csv.startsWith('\ufeff')).toBe(true);
    expect(csv.split('\r\n').length).toBeGreaterThan(100);
  });

  it('xlsx: ghi rồi đọc lại bảng chi tiết ga', async () => {
    for (const kind of GA_KIND_ORDER) {
      const p = defaultProject(kind);
      const buf = await buildXlsx(p, computeAll(p));
      expect(buf.byteLength).toBeGreaterThan(5000);
      const { project, warnings } = await importXlsxFile(buf);
      expect(warnings.length).toBe(1); // thiếu CF.Ga
      expect(project.kind).toBe(kind);
      expect(project.rows).toHaveLength(20);
      project.rows.forEach((r, i) => {
        const o = p.rows[i];
        expect([r.name, r.L, r.B, r.H, r.bottom.t, r.wall.t]).toEqual([o.name, o.L, o.B, o.H, o.bottom.t, o.wall.t]);
        expect(r.bottom.low).toBe(o.bottom.low);
        expect(r.pipes.map((x) => x.spec)).toEqual(o.pipes.map((x) => x.spec));
      });
    }
  }, 60000);

  it('dự án JSON: ghi → đọc lại giống hệt, thiếu khoá thì lấy mặc định', () => {
    const p = defaultProject('khongCo');
    p.title = 'Đường Nguyễn Văn Linh';
    const back = parseProject(serializeProject(p));
    expect(back).toEqual(p);
    const partial = parseProject(JSON.stringify({ kind: 'napRoi', rows: [{ name: 'X1', L: 900 }], config: { cover: { bottom: 33 } } }));
    expect(partial.rows[0].name).toBe('X1');
    expect(partial.rows[0].L).toBe(900);
    expect(partial.rows[0].B).toBeGreaterThan(0);
    expect(partial.config.cover.bottom).toBe(33);
    expect(partial.config.cover.wall).toBe(25);
    expect(() => parseProject('{"kind":"x"}')).toThrow();
    expect(() => parseProject('không phải json')).toThrow();
  });

  it('baseName chuẩn hoá tiếng Việt', () => {
    expect(baseName('')).toBe('ho_ga');
    expect(baseName('Đường Nguyễn Văn Linh')).toBe('Duong_Nguyen_Van_Linh');
  });
});

describe('Bản vẽ', () => {
  for (const kind of GA_KIND_ORDER) {
    it(`${kind}: dựng được các tờ, SVG và DXF hợp lệ`, () => {
      const p = defaultProject(kind);
      const res = computeAll(p);
      const info = GA_KINDS[kind];
      const sheets = [
        buildViewSheet(res[3], p.config, p.catalog, info, 'struct'),
        buildViewSheet(res[3], p.config, p.catalog, info, 'rebar'),
        ...buildScheduleSheets(res[3], p.config),
        ...buildSummarySheets(p, summarize(p, res)),
      ];
      for (const s of sheets) {
        expect(s.ents.length).toBeGreaterThan(20);
        const svg = sheetToSvg(s, 'dark');
        expect(svg.startsWith('<svg')).toBe(true);
        expect(svg).not.toContain('NaN');
        expect(svg).not.toContain('undefined');
      }
      for (const ver of ['R12', 'R2000'] as const) {
        const dxf = toDXF(layoutSheets([sheets]), ver);
        expect(dxf).toContain(ver === 'R12' ? 'AC1009' : 'AC1015');
        expect(dxf.trimEnd().endsWith('EOF')).toBe(true);
        expect(dxf).not.toContain('NaN');
        expect(dxf).toContain('\\U+');
        // cân bằng SECTION/ENDSEC
        expect((dxf.match(/\r\nSECTION\r\n/g) ?? []).length).toBe((dxf.match(/\r\nENDSEC\r\n/g) ?? []).length);
      }
      const d2 = toDXF(layoutSheets([sheets]), 'R2000');
      expect(d2).toContain('AcDbHatch');
      expect(d2).toContain('\r\nDIMENSION\r\n');
      expect(d2).toContain('AcDbDimStyleTableRecord');
      expect(toDXF(layoutSheets([sheets]), 'R12')).not.toContain('0\r\nHATCH\r\n');
    });
  }
  it('tỷ lệ tự động: mọi hình nằm trong khung', () => {
    const p = defaultProject('lienKhoi');
    const res = computeAll(p);
    for (const i of [0, 9, 19]) {
      const s = buildViewSheet(res[i], p.config, p.catalog, GA_KINDS.lienKhoi, 'struct');
      expect(s.scale).toBeGreaterThanOrEqual(5);
      let maxX = 0;
      for (const e of s.ents) if (e.t === 'line') maxX = Math.max(maxX, e.x1, e.x2);
      expect(maxX).toBeLessThanOrEqual(s.w + 1e-6);
    }
  });
});

describe('DXF R2000 – cấu trúc đủ để AutoCAD mở (đã kiểm bằng accoreconsole AUDIT: 0 lỗi)', () => {
  it('mọi handle là duy nhất, mọi chủ sở hữu (330) và khối được dùng đều tồn tại', () => {
    for (const kind of GA_KIND_ORDER) {
      const p = defaultProject(kind);
      const res = computeAll(p);
      const info = GA_KINDS[kind];
      const sheets = [buildViewSheet(res[2], p.config, p.catalog, info, 'struct'), buildViewSheet(res[2], p.config, p.catalog, info, 'rebar'), ...buildScheduleSheets(res[2], p.config)];
      const dxf = toDXF(layoutSheets([sheets]), 'R2000');
      const t = dxf.split('\r\n');
      const handles = new Set<string>();
      const owners: string[] = [];
      const blocksDefined = new Set<string>();
      const blocksUsed = new Set<string>();
      let cur = '';
      for (let i = 0; i + 1 < t.length; i += 2) {
        const code = t[i].trim();
        const val = t[i + 1];
        if (code === '0') cur = val;
        if (code === '5' || code === '105') {
          expect(handles.has(val), `handle trùng ${val}`).toBe(false);
          handles.add(val);
        }
        if (code === '330') owners.push(val);
        if (code === '2' && cur === 'BLOCK') blocksDefined.add(val);
        if (code === '2' && (cur === 'INSERT' || cur === 'DIMENSION')) blocksUsed.add(val);
      }
      for (const o of owners) if (o !== '0') expect(handles.has(o), `owner ${o} không tồn tại`).toBe(true);
      for (const b of blocksUsed) expect(blocksDefined.has(b), `khối ${b} chưa định nghĩa`).toBe(true);
      expect(blocksUsed.has('NOT')).toBe(true);
    }
  });
});

describe('DXF nhiều ga', () => {
  it('20 ga × 5 tờ + bảng tổng hợp xuất được R2000 và R12 (không tràn ngăn xếp)', () => {
    const p = defaultProject('lienKhoi');
    const res = computeAll(p);
    const info = GA_KINDS.lienKhoi;
    const groups = res.map((r) => [buildViewSheet(r, p.config, p.catalog, info, 'struct'), buildViewSheet(r, p.config, p.catalog, info, 'rebar'), ...buildScheduleSheets(r, p.config)]);
    groups.push(buildSummarySheets(p, summarize(p, res)));
    for (const ver of ['R2000', 'R12'] as const) {
      const dxf = toDXF(layoutSheets(groups), ver);
      expect(dxf.length).toBeGreaterThan(2_000_000);
      expect(dxf.trimEnd().endsWith('EOF')).toBe(true);
    }
  }, 120000);
});
