/** Xuất Excel: THKL, KL HG (chiết tính từng ga), Thep (thép theo kết cấu), Chiết tính thép (từng thanh), dữ liệu ga. */
import type { HoGaProject } from '../engine/types';
import { GA_KINDS } from '../engine/types';
import { parseRebar } from '../engine/parse';
import { barKg, PART_LABEL, PART_ORDER } from '../engine/rebar';
import { summarize, type GaResult } from '../engine/summary';

export interface TableData {
  head: string[];
  rows: (string | number)[][];
}

/** Bảng chiết tính từng ga (nhân số lượng) dạng bảng phẳng, dùng cho cả Excel và CSV. */
export function qtyTable(p: HoGaProject, res: GaResult[]): TableData {
  const info = GA_KINDS[p.kind];
  const head = ['STT', 'Tên ga', 'SL', 'Cao trình đỉnh (m)', 'Cao trình đáy (m)', 'Cao ga (m)', 'Cát lót (m3)', 'BT lót (m3)', 'BT đáy (m3)', 'VK đáy (m2)', 'BT tường (m3)', 'VK tường (m2)'];
  if (info.hasNeck) head.push('BT trần (m3)', 'VK trần (m2)', 'BT cổ (m3)', 'VK cổ (m2)');
  head.push('Vữa chèn cống (m3)');
  if (info.precastRoof) head.push('Vữa đệm (m2)');
  head.push('Nắp gang (bộ)', 'BT tấm nắp (m3)', 'VK tấm nắp (m2)');
  if (info.hasInlet) head.push('BT cửa thu (m3)', 'VK cửa thu (m2)');
  head.push('Đào (m3)', 'Đắp (m3)');
  const rows = res.map((r, i) => {
    const q = r.qty;
    const n = r.row.count;
    const row: (string | number)[] = [i + 1, r.row.name, n, q.levelTop ?? '', q.levelBottom ?? '', q.height];
    const m = (x: number) => x * n;
    row.push(m(q.sand), m(q.liner1), m(q.bottomConc), m(q.bottomForm), m(q.wallConc), m(q.wallForm));
    if (info.hasNeck) row.push(m(q.roofConc), m(q.roofForm), m(q.neckConc), m(q.neckForm));
    row.push(m(q.mortarPipe));
    if (info.precastRoof) row.push(m(q.mortarRoof));
    row.push(m(q.lidGang), m(q.lid?.conc ?? 0), m(q.lid?.form ?? 0));
    if (info.hasInlet) row.push(m(q.inlet?.conc ?? 0), m(q.inlet?.form ?? 0));
    row.push(m(q.dig.dig), m(q.dig.fill));
    return row;
  });
  return { head, rows };
}

/** Cốt thép theo kết cấu: D ≤ 10 / D > 10 cho từng ga (nhân số lượng). */
export function steelTable(res: GaResult[]): TableData {
  const head = ['STT', 'Tên ga', 'SL'];
  for (const p of PART_ORDER) head.push(`${PART_LABEL[p]} D≤10 (kg)`, `${PART_LABEL[p]} D>10 (kg)`);
  head.push('Thép hình (kg)', 'Tổng (kg)');
  const rows = res.map((r, i) => {
    const n = r.row.count;
    const row: (string | number)[] = [i + 1, r.row.name, n];
    for (const p of PART_ORDER) row.push(r.rebar.byPart[p].le10 * n, r.rebar.byPart[p].gt10 * n);
    row.push(r.rebar.angleKg * n, r.rebar.totalKg * n);
    return row;
  });
  return { head, rows };
}

/** Chiết tính từng thanh thép (mỗi dòng một nhóm thanh) của mọi ga. */
export function barTable(res: GaResult[]): TableData {
  const head = ['Tên ga', 'Kết cấu', 'Ký hiệu', 'Mô tả', 'Ø (mm)', 'Dài 1 thanh (mm)', 'Số thanh / ga', 'SL ga', 'Tổng dài (m)', 'Khối lượng (kg)'];
  const rows: (string | number)[][] = [];
  for (const r of res) {
    for (const g of r.rebar.groups) {
      rows.push([r.row.name, PART_LABEL[g.part], g.mark, g.label, g.dia, g.length, g.count, r.row.count, (g.length * g.count * r.row.count) / 1000, barKg(g) * r.row.count]);
    }
    for (const a of r.rebar.angles) rows.push([r.row.name, 'Thép hình', 'TH', `${a.label} ${a.name}`, '', a.length * 1000, a.count, r.row.count, a.length * a.count * r.row.count, a.kg * r.row.count]);
  }
  return { head, rows };
}

export function toCsv(t: TableData): string {
  const esc = (v: string | number) => {
    const s = typeof v === 'number' ? String(Math.round(v * 1e6) / 1e6) : v;
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + [t.head, ...t.rows].map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n';
}

export async function buildXlsx(p: HoGaProject, res: GaResult[]): Promise<ArrayBuffer> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'LEDAT Hố Ga';
  const style = (ws: import('exceljs').Worksheet, widths: number[]) => {
    widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));
    const h = ws.getRow(1);
    h.font = { bold: true };
    h.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE9F2' } };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
  };

  const items = summarize(p, res);
  const w1 = wb.addWorksheet('THKL');
  w1.addRow(['TT', 'Hạng mục', 'Đơn vị', 'Khối lượng']);
  items.forEach((it) => w1.addRow([it.tt, it.name, it.unit, Math.round(it.value * 1000) / 1000]));
  style(w1, [6, 62, 10, 16]);
  w1.getColumn(4).numFmt = '#,##0.00';

  const q = qtyTable(p, res);
  const w2 = wb.addWorksheet('KL HG');
  w2.addRow(q.head);
  q.rows.forEach((r) => w2.addRow(r));
  style(w2, [5, 12, 5, ...q.head.slice(3).map(() => 14)]);
  w2.getRow(1).height = 32;

  const s = steelTable(res);
  const w3 = wb.addWorksheet('Thep');
  w3.addRow(s.head);
  s.rows.forEach((r) => w3.addRow(r));
  style(w3, [5, 12, 5, ...s.head.slice(3).map(() => 13)]);
  w3.getRow(1).height = 32;
  const last = w3.addRow(['', 'Tổng cộng', '']);
  for (let c = 4; c <= s.head.length; c++) last.getCell(c).value = { formula: `SUM(${w3.getColumn(c).letter}2:${w3.getColumn(c).letter}${w3.rowCount - 1})` };
  last.font = { bold: true };

  const b = barTable(res);
  const w4 = wb.addWorksheet('Chiết tính thép');
  w4.addRow(b.head);
  b.rows.forEach((r) => w4.addRow(r));
  style(w4, [12, 12, 9, 60, 8, 14, 12, 8, 14, 14]);

  // dữ liệu ga theo bố cục sheet nhập liệu để có thể nhập lại
  const info = GA_KINDS[p.kind];
  const w5 = wb.addWorksheet(info.sheet);
  w5.addRow(['Thứ tự', 'Tên ga', 'Dài', 'Rộng', 'Cao', 'Dày đáy', 'Đáy dưới', 'Đáy trên', 'Dày tường', 'Tường ngoài', 'Tường trong', 'Dày trần', 'Trần trên', 'Trần dưới', 'T1', 'T1 sâu', 'T2', 'T2 sâu', 'T3', 'T3 sâu', 'T4', 'T4 sâu', 'Cổ cao', 'Cổ dày', 'Cổ ngoài', 'Cổ trong', 'Cao độ đáy ga']);
  w5.addRow([]);
  w5.addRow([]);
  // các dòng dữ liệu bắt đầu ở hàng 4 như tệp mẫu
  res.forEach((r, i) => {
    const x = r.row;
    const base: (string | number | null)[] = [i + 1, x.name, x.L, x.B, x.H, x.bottom.t, x.bottom.low, x.bottom.up, x.wall.t, x.wall.out, x.wall.in, x.roof.t, x.roof.up, x.roof.low];
    const pipes = x.pipes.flatMap((pp) => [pp.spec || null, pp.spec && pp.depth ? pp.depth : null]);
    const tail = [x.neck.h || null, x.neck.t || null, x.neck.out || null, x.neck.in || null, x.level];
    if (info.hasNeck) w5.addRow([...base, ...pipes, ...tail]);
    else {
      const lo = parseRebar(x.roof.low);
      const up = parseRebar(x.roof.up);
      w5.addRow([i + 1, x.name, x.L, x.B, x.H, x.bottom.t, x.bottom.low, x.bottom.up, x.wall.t, x.wall.out, x.wall.in, x.roof.t, lo?.dia ?? null, up?.dia ?? null, (lo ?? up)?.spacing ?? null, ...pipes, x.level]);
    }
  });
  style(w5, [7, 12, ...Array(25).fill(11)]);
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
