/** Tổng hợp khối lượng toàn bộ danh sách ga (sheet "THKL"). */
import type { GaRow, HoGaProject } from './types';
import { GA_KINDS } from './types';
import { computeQty, type GaQty } from './quantities';
import { computeRebar, PART_LABEL, PART_ORDER, type GaRebar } from './rebar';

export interface GaResult {
  row: GaRow;
  qty: GaQty;
  rebar: GaRebar;
}

export interface ThklItem {
  tt: number;
  name: string;
  unit: string;
  value: number;
  group: string;
}

export function computeGa(p: HoGaProject, row: GaRow): GaResult {
  const info = GA_KINDS[p.kind];
  return { row, qty: computeQty(row, p.config, p.catalog, info), rebar: computeRebar(row, p.config, p.catalog, info, p.angles) };
}

export function computeAll(p: HoGaProject): GaResult[] {
  return p.rows.map((r) => computeGa(p, r));
}

/** Bảng tổng hợp khối lượng (nhân số lượng ga). */
export function summarize(p: HoGaProject, results: GaResult[]): ThklItem[] {
  const info = GA_KINDS[p.kind];
  const mat = p.config.materials;
  const sum = (f: (r: GaResult) => number) => results.reduce((s, r) => s + f(r) * r.row.count, 0);
  const items: Omit<ThklItem, 'tt'>[] = [];
  const add = (group: string, name: string, unit: string, value: number) => items.push({ group, name, unit, value });

  add('Móng', `Cát lót đáy móng (${mat.liner2})`, 'm3', sum((r) => r.qty.sand));
  add('Móng', `${mat.liner1}`, 'm3', sum((r) => r.qty.liner1));
  add('Bản đáy', `BTCT bản đáy ga (${mat.body})`, 'm3', sum((r) => r.qty.bottomConc));
  add('Bản đáy', 'Ván khuôn bản đáy ga', 'm2', sum((r) => r.qty.bottomForm));
  const steel = (part: (typeof PART_ORDER)[number], g: 'le10' | 'gt10') => sum((r) => r.rebar.byPart[part][g]);
  add('Bản đáy', 'Cốt thép bản đáy ga D ≤ 10mm', 'kg', steel('bottom', 'le10'));
  add('Bản đáy', 'Cốt thép bản đáy ga D > 10mm', 'kg', steel('bottom', 'gt10'));
  add('Tường', `BTCT tường ga (${mat.body})`, 'm3', sum((r) => r.qty.wallConc));
  add('Tường', 'Ván khuôn tường ga', 'm2', sum((r) => r.qty.wallForm));
  add('Tường', 'Cốt thép tường ga D ≤ 10mm', 'kg', steel('wall', 'le10'));
  add('Tường', 'Cốt thép tường ga D > 10mm', 'kg', steel('wall', 'gt10'));
  if (info.hasNeck) {
    add('Trần', `BTCT trần ga (${mat.body})`, 'm3', sum((r) => r.qty.roofConc));
    add('Trần', 'Ván khuôn trần ga', 'm2', sum((r) => r.qty.roofForm));
    add('Trần', 'Cốt thép trần ga D ≤ 10mm', 'kg', steel('roof', 'le10'));
    add('Trần', 'Cốt thép trần ga D > 10mm', 'kg', steel('roof', 'gt10'));
    add('Cổ', `BTCT cổ ga (${mat.neck})`, 'm3', sum((r) => r.qty.neckConc));
    add('Cổ', 'Ván khuôn cổ ga', 'm2', sum((r) => r.qty.neckForm));
    add('Cổ', 'Cốt thép cổ ga D ≤ 10mm', 'kg', steel('neck', 'le10'));
    add('Cổ', 'Cốt thép cổ ga D > 10mm', 'kg', steel('neck', 'gt10'));
  }
  if (info.hasInlet) {
    add('Cửa thu', 'Lót đáy cửa thu', 'm3', sum((r) => r.qty.inlet?.liner ?? 0));
    add('Cửa thu', `BTCT cửa thu (${mat.body})`, 'm3', sum((r) => r.qty.inlet?.conc ?? 0));
    add('Cửa thu', 'Ván khuôn cửa thu', 'm2', sum((r) => r.qty.inlet?.form ?? 0));
    add('Cửa thu', 'Cốt thép cửa thu D ≤ 10mm', 'kg', steel('inlet', 'le10'));
    add('Cửa thu', 'Cốt thép cửa thu D > 10mm', 'kg', steel('inlet', 'gt10'));
  }
  add('Vữa', `${mat.plaster} chèn khe cống`, 'm3', sum((r) => r.qty.mortarPipe));
  if (info.precastRoof) add('Vữa', `${mat.mortar} đệm trần/nắp`, 'm2', sum((r) => r.qty.mortarRoof));
  add('Nắp', 'Nắp ga bằng gang/composite', 'bộ', sum((r) => r.qty.lidGang));
  add('Nắp', 'Thép hình viền cổ ga / tấm nắp', 'kg', sum((r) => r.rebar.angleKg));
  add('Nắp', 'BTCT tấm nắp đúc sẵn', 'm3', sum((r) => r.qty.lid?.conc ?? 0));
  add('Nắp', 'Ván khuôn tấm nắp đúc sẵn', 'm2', sum((r) => r.qty.lid?.form ?? 0));
  add('Nắp', 'Cốt thép tấm nắp đúc sẵn', 'kg', steel('lid', 'le10') + steel('lid', 'gt10'));
  add('Đào đắp', 'Đào đất hố móng', 'm3', sum((r) => r.qty.dig.dig));
  add('Đào đắp', 'Đắp đất hoàn trả (đã trừ kết cấu)', 'm3', sum((r) => r.qty.dig.fill));
  return items.map((it, i) => ({ ...it, tt: i + 1 }));
}

/** Cốt thép từng ga theo phần, kg (cho một ga, chưa nhân số lượng). */
export function steelByPart(r: GaResult): { part: string; le10: number; gt10: number }[] {
  return PART_ORDER.map((p) => ({ part: PART_LABEL[p], le10: r.rebar.byPart[p].le10, gt10: r.rebar.byPart[p].gt10 }));
}

export const fmt = (x: number, d = 2): string => (Number.isFinite(x) ? x.toLocaleString('vi-VN', { minimumFractionDigits: d, maximumFractionDigits: d }) : '–');
