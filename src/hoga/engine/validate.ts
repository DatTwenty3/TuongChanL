/** Kiểm tra dữ liệu nhập của một ga – trả về cảnh báo bằng tiếng Việt, không chặn việc tính. */
import type { GaConfig, GaKindInfo, GaRow } from './types';
import { parseDims, parsePipe, parseRebar, type PipeCatalog } from './parse';
import { dims, neckOf, openings, parseNeckSize } from './geometry';

export interface Warning {
  level: 'err' | 'warn';
  text: string;
}

export function validateRow(row: GaRow, cfg: GaConfig, cat: PipeCatalog, info: GaKindInfo): Warning[] {
  const w: Warning[] = [];
  const add = (level: Warning['level'], text: string) => w.push({ level, text });
  const d = dims(row, cfg);
  if (!row.name.trim()) add('err', 'Tên ga trống.');
  if (!(row.L > 0 && row.B > 0 && row.H > 0)) add('err', 'Kích thước trong lòng ga phải lớn hơn 0.');
  if (!(row.count >= 1)) add('warn', 'Số lượng ga nhỏ hơn 1.');
  if (!(row.bottom.t > 0 && row.wall.t > 0)) add('err', 'Chiều dày bản đáy / tường phải lớn hơn 0.');
  const specs: [string, string, boolean][] = [
    ['Thép đáy lớp dưới', row.bottom.low, true],
    ['Thép đáy lớp trên', row.bottom.up, true],
    ['Thép tường lớp ngoài', row.wall.out, true],
    ['Thép tường lớp trong', row.wall.in, true],
    ['Thép trần lớp trên', row.roof.up, info.hasNeck],
    ['Thép trần lớp dưới', row.roof.low, info.hasNeck],
  ];
  for (const [label, s, required] of specs) {
    if (s.trim() && !parseRebar(s)) add('err', `${label}: "${s}" sai định dạng (đúng: D10A150).`);
    else if (!s.trim() && required) add('warn', `${label} đang trống – ga có ít hơn 2 lớp thép.`);
  }
  row.pipes.forEach((p, i) => {
    if (!p.spec.trim()) return;
    const pipe = parsePipe(p.spec, cat);
    if (!pipe) {
      add('err', `Cống T${i + 1}: "${p.spec}" sai định dạng (D400, 600x800 hoặc R300x400).`);
      return;
    }
    if (!pipe.t) add('warn', `Cống T${i + 1} (${p.spec}) không có trong danh mục CF.Cong – chiều dày thành lấy bằng 0.`);
  });
  for (const o of openings(row, cfg, cat)) {
    const len = o.wall % 2 === 0 ? row.L + 2 * d.tw : row.B;
    if (o.w > len - 2 * cfg.cover.wall) add('err', `Cống T${o.wall + 1}: lỗ rộng ${Math.round(o.w)} mm không lọt vào tường dài ${len} mm.`);
    if (o.z1 > d.H + 1e-6) add('err', `Cống T${o.wall + 1}: đỉnh lỗ ${Math.round(o.z1)} mm vượt chiều cao ga ${d.H} mm.`);
  }
  if (info.hasNeck) {
    if (row.neck.h > 0) {
      const sz = parseNeckSize(cfg.neck.size);
      if (!sz) add('err', `Kích thước cổ ga "${cfg.neck.size}" sai định dạng (700x700 hoặc D700).`);
      else if (sz.a > row.L || sz.b > row.B) add('err', 'Cổ ga lớn hơn lòng ga.');
      if (!neckOf(row, cfg, true)) add('warn', 'Không dựng được cổ ga.');
      if (!(row.neck.t > 0)) add('err', 'Chiều dày cổ ga phải lớn hơn 0.');
    }
  } else if (!(row.roof.t > 0)) add('err', 'Chiều dày tấm nắp phải lớn hơn 0.');
  if (cfg.lid.type === 'BTCT' && cfg.lid.nSlabs < 1) add('warn', 'Nắp BTCT cần ít nhất 1 tấm.');
  const ch = cfg.neck.chamfer ? parseDims(cfg.neck.chamferSize) : null;
  if (cfg.neck.chamfer && !ch) add('err', 'Kích thước vát cổ sai định dạng (75x50).');
  if (row.level !== null && !Number.isFinite(row.level)) add('err', 'Cao độ đáy ga không hợp lệ.');
  return w;
}
