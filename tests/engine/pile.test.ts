import { describe, expect, it } from 'vitest';
import {
  mergeProject,
  pileDefaults,
  pileEnsure,
  pileNewLayer,
  pileOn,
  presetCanti,
  presetKe,
  presetRib,
  presetWall4,
  type EngineProject,
} from '../../src/engine/index.ts';
import { parseProjectFile, serializeProject } from '../../src/export/projectIo.ts';

/**
 * Giai đoạn 0 của mô đun móng cọc: dữ liệu + chuẩn hóa. Mô đun không có bản gốc để đối chiếu
 * nên các kiểm tra ở đây là bất biến (tắt = không thay đổi) và tính toàn vẹn dữ liệu.
 */
describe('pile – nền tảng dữ liệu (tắt = không ảnh hưởng)', () => {
  it('preset và mergeProject không tự tạo khóa pile', () => {
    for (const p of [presetCanti(500), presetRib(), presetKe({}, 0), presetWall4({}, 1)]) {
      expect('pile' in p).toBe(false);
      expect(pileOn(p)).toBe(false);
      expect(pileEnsure(p as EngineProject)).toBeUndefined();
      expect('pile' in p).toBe(false);
    }
    const merged = mergeProject(JSON.parse(JSON.stringify(presetCanti(700))));
    expect('pile' in merged).toBe(false);
  });

  it('vòng khứ hồi .tcl.json giữ nguyên cấu hình cọc và idempotent', () => {
    const p = presetCanti(500) as EngineProject;
    p.pile = pileDefaults();
    p.pile.L = 24.5;
    p.pile.design.z0 = 1.4;
    p.pile.layers.push(pileNewLayer({ name: 'Lớp thêm', thk: 3 }));
    const back = parseProjectFile(serializeProject(p));
    expect(back.pile).toBeDefined();
    expect(back.pile?.L).toBe(24.5);
    expect(back.pile?.design.z0).toBe(1.4);
    expect(back.pile?.layers.length).toBe(4);
    const once = JSON.stringify(back.pile);
    pileEnsure(back);
    expect(JSON.stringify(back.pile)).toBe(once);
  });

  it('pileEnsure điền trường còn thiếu của file cũ, không ghi đè giá trị có sẵn', () => {
    const p = presetCanti(500) as EngineProject;
    p.pile = { on: true, L: 30 } as unknown as EngineProject['pile'];
    const q = pileEnsure(p)!;
    expect(q.L).toBe(30);
    expect(q.type).toBe('sq');
    expect(q.layers.length).toBeGreaterThan(0);
    // cấu hình thiết kế được điền đủ
    expect(q.design.cls).toBe('C2');
    expect(q.layers.every((l) => l.kf === 1 && l.kb === 1)).toBe(true);
    // id lớp đất duy nhất
    const ids = q.layers.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('mặc định thiết kế: cấp 2, tra bảng tự động, không có bảng nhập tay', () => {
    const d = pileDefaults();
    expect(d.method).toBe('tcvn');
    expect(d.design.cls).toBe('C2');
    expect(d.Qtest).toBeNull();
    expect('fi' in d).toBe(false);
    expect('coef' in d).toBe(false);
  });
});
