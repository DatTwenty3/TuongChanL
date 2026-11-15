/**
 * Bố trí các hình vẽ lên khung bản vẽ A3, chọn tỷ lệ tự động sao cho mọi hình nằm trọn trong tờ giấy
 * (tương tự lựa chọn "Chọn tỷ lệ tự động" của VHGpro), dựng khung tên và các bảng thống kê.
 */
import { Builder, bboxOf, translate, type Ent } from './ents';
import { lidPlan, lidSection, makeCtx, planBody, planRebar, planRoof, section, sectionRebar, wallElevation, type Ctx, type View } from './views';
import type { GaConfig, GaKindInfo, HoGaProject } from '../engine/types';
import { GA_KINDS } from '../engine/types';
import { barKg, PART_LABEL, PART_ORDER } from '../engine/rebar';
import type { GaResult, ThklItem } from '../engine/summary';
import { fmt } from '../engine/summary';
import type { PipeCatalog } from '../engine/parse';

export const SCALES = [5, 10, 15, 20, 25, 30, 40, 50, 75, 100];
export const A3 = { w: 420, h: 297 };
export type SheetKind = 'struct' | 'rebar' | 'wall' | 'lid' | 'schedule' | 'summary';

export interface Sheet {
  id: string;
  kind: SheetKind;
  title: string;
  /** mẫu số tỷ lệ: 1/scale */
  scale: number;
  /** kích thước khung (mm mô hình) */
  w: number;
  h: number;
  ents: Ent[];
}

const MARGIN = { l: 20, r: 5, t: 5, b: 5 };
const TITLE_H = 22;

function frame(b: Builder, lines: { left: string; mid: string; right: string }): void {
  const s = b.s;
  const W = A3.w * s;
  const H = A3.h * s;
  b.rect('KHUNG', 0, 0, W, H);
  b.rect('KHUNG', MARGIN.l * s, MARGIN.b * s, (A3.w - MARGIN.r) * s, (A3.h - MARGIN.t) * s);
  const y1 = (MARGIN.b + TITLE_H) * s;
  b.line('KHUNG', MARGIN.l * s, y1, (A3.w - MARGIN.r) * s, y1);
  const xA = (A3.w - MARGIN.r - 150) * s;
  const xB = (A3.w - MARGIN.r - 55) * s;
  b.line('KHUNG', xA, MARGIN.b * s, xA, y1);
  b.line('KHUNG', xB, MARGIN.b * s, xB, y1);
  b.text('TEXT', (MARGIN.l + 4) * s, (MARGIN.b + 13) * s, lines.left, 5, 'l', 0, true);
  b.text('TEXT', xA + 4 * s, (MARGIN.b + 13) * s, lines.mid, 3.5, 'l');
  b.text('TEXT', xB + 4 * s, (MARGIN.b + 13) * s, lines.right, 3.5, 'l');
  b.text('TEXT', (MARGIN.l + 4) * s, (MARGIN.b + 4) * s, 'LEDAT Hố Ga – bản vẽ sinh tự động, cần kiểm tra trước khi sử dụng', 2.2, 'l');
}

interface Cell {
  x0: number;
  y0: number;
  w: number;
  h: number;
}

function grid(cols: number, rows: number): Cell[] {
  const iw = A3.w - MARGIN.l - MARGIN.r;
  const ih = A3.h - MARGIN.t - MARGIN.b - TITLE_H;
  const cells: Cell[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push({ x0: MARGIN.l + (c * iw) / cols, y0: A3.h - MARGIN.t - ((r + 1) * ih) / rows, w: iw / cols, h: ih / rows });
    }
  }
  return cells;
}

type ViewFn = (c: Ctx, s: number) => View;

function viewList(kind: 'struct' | 'rebar', info: GaKindInfo): ViewFn[] {
  if (kind === 'struct') return [planBody, planRoof, (c, s) => section(c, s, 'A'), (c, s) => section(c, s, 'B')];
  const v: ViewFn[] = [(c, s) => sectionRebar(c, s, 'A'), (c, s) => sectionRebar(c, s, 'B')];
  v.push((c, s) => planRebar(c, s, 'bottom', 'low'), (c, s) => planRebar(c, s, 'bottom', 'up'));
  if (info.hasNeck) v.push((c, s) => planRebar(c, s, 'roof', 'low'), (c, s) => planRebar(c, s, 'roof', 'up'));
  return v;
}

/** Dựng một tờ kết cấu / cốt thép của một ga. */
export function buildViewSheet(res: GaResult, cfg: GaConfig, cat: PipeCatalog, info: GaKindInfo, kind: 'struct' | 'rebar', opts: { scale?: number | 'auto'; cols?: 2 | 3 } = {}): Sheet {
  const c = makeCtx(res, cfg, cat, info);
  const fns = viewList(kind, info);
  const cols = opts.cols ?? (fns.length > 4 ? 3 : 2);
  const rows = Math.ceil(fns.length / cols);
  const cells = grid(cols, rows);
  const fits = (s: number): boolean =>
    fns.every((fn, i) => {
      const bb = bboxOf(fn(c, s).ents);
      const cell = cells[i];
      return (bb.x1 - bb.x0) / s <= cell.w - 6 && (bb.y1 - bb.y0) / s <= cell.h - 12;
    });
  let s: number;
  if (typeof opts.scale === 'number') s = opts.scale;
  else s = SCALES.find(fits) ?? SCALES[SCALES.length - 1];
  const b = new Builder(s);
  frame(b, {
    left: `${res.row.name} – ${kind === 'struct' ? 'KẾT CẤU' : 'CỐT THÉP'}`,
    mid: GA_KINDS[info.id].label.slice(0, 44),
    right: `Tỷ lệ 1/${s}`,
  });
  fns.forEach((fn, i) => {
    const v = fn(c, s);
    const bb = bboxOf(v.ents);
    const cell = cells[i];
    const cx = (cell.x0 + cell.w / 2) * s;
    const cy = (cell.y0 + (cell.h + 8) / 2) * s;
    const dx = cx - (bb.x0 + bb.x1) / 2;
    const dy = cy - (bb.y0 + bb.y1) / 2;
    b.ents.push(...translate(v.ents, dx, dy));
    const ty = (cell.y0 + 2) * s;
    b.text('TEXT', cx, ty, v.title, 3.2, 'c', 0, true);
    b.line('KHUNG', cx - 28 * s, ty - 0.8 * s, cx + 28 * s, ty - 0.8 * s);
  });
  return { id: `${res.row.name}:${kind}`, kind, title: `${res.row.name} – ${kind === 'struct' ? 'Kết cấu' : 'Cốt thép'}`, scale: s, w: A3.w * s, h: A3.h * s, ents: b.ents };
}

/** Tờ lưới thép 4 tường (mỗi tường hai lớp) ở tỷ lệ tự động. */
export function buildWallSheet(res: GaResult, cfg: GaConfig, cat: PipeCatalog, info: GaKindInfo, opts: { scale?: number | 'auto' } = {}): Sheet {
  const c = makeCtx(res, cfg, cat, info);
  const fns: ((cc: Ctx, ss: number) => View | null)[] = [];
  for (const w of [0, 1, 2, 3] as const) for (const l of ['out', 'in'] as const) fns.push((cc, ss) => wallElevation(cc, ss, w, l));
  const cells = grid(4, 2);
  const fits = (sc: number) => fns.every((f, i) => {
    const v = f(c, sc);
    if (!v) return true;
    const bb = bboxOf(v.ents);
    return (bb.x1 - bb.x0) / sc <= cells[i].w - 4 && (bb.y1 - bb.y0) / sc <= cells[i].h - 12;
  });
  const sc = typeof opts.scale === 'number' ? opts.scale : (SCALES.find(fits) ?? SCALES[SCALES.length - 1]);
  const b = new Builder(sc);
  frame(b, { left: `${res.row.name} – LƯỚI THÉP TƯỜNG`, mid: GA_KINDS[info.id].label.slice(0, 44), right: `Tỷ lệ 1/${sc}` });
  fns.forEach((f, i) => {
    const v = f(c, sc);
    if (!v) return;
    const bb = bboxOf(v.ents);
    const cell = cells[i];
    const cx = (cell.x0 + cell.w / 2) * sc;
    const cy = (cell.y0 + (cell.h + 8) / 2) * sc;
    b.ents.push(...translate(v.ents, cx - (bb.x0 + bb.x1) / 2, cy - (bb.y0 + bb.y1) / 2));
    b.text('TEXT', cx, (cell.y0 + 2) * sc, v.title, 3, 'c', 0, true);
  });
  return { id: `${res.row.name}:wall`, kind: 'wall', title: `${res.row.name} – Lưới thép tường`, scale: sc, w: A3.w * sc, h: A3.h * sc, ents: b.ents };
}

/** Tờ chi tiết tấm nắp đúc sẵn (tỷ lệ riêng `lid.scale`); null nếu ga không dùng tấm nắp BTCT. */
export function buildLidSheet(res: GaResult, cfg: GaConfig, cat: PipeCatalog, info: GaKindInfo): Sheet | null {
  if (cfg.lid.type !== 'BTCT') return null;
  const c = makeCtx(res, cfg, cat, info);
  const s = cfg.lid.scale > 0 ? cfg.lid.scale : 10;
  const fns: ((c: Ctx, s: number) => View | null)[] = [lidPlan, (cc, ss) => lidSection(cc, ss, 'A'), (cc, ss) => lidSection(cc, ss, 'B')];
  const views = fns.map((f) => f(c, s));
  if (views.some((v) => !v)) return null;
  const cells = grid(3, 1);
  const b = new Builder(s);
  frame(b, { left: `${res.row.name} – TẤM NẮP`, mid: GA_KINDS[info.id].label.slice(0, 44), right: `Tỷ lệ 1/${s}` });
  views.forEach((v, i) => {
    const bb = bboxOf(v!.ents);
    const cell = cells[i];
    const cx = (cell.x0 + cell.w / 2) * s;
    const cy = (cell.y0 + (cell.h + 8) / 2) * s;
    b.ents.push(...translate(v!.ents, cx - (bb.x0 + bb.x1) / 2, cy - (bb.y0 + bb.y1) / 2));
    b.text('TEXT', cx, (cell.y0 + 2) * s, v!.title, 3.2, 'c', 0, true);
  });
  return { id: `${res.row.name}:lid`, kind: 'lid', title: `${res.row.name} – Tấm nắp`, scale: s, w: A3.w * s, h: A3.h * s, ents: b.ents };
}

/* ------------------------------------------------------------------ bảng */

interface Col {
  head: string;
  w: number;
  align: 'l' | 'c' | 'r';
  shape?: boolean;
}

export type BarShapeKind = 'straight' | 'hook1' | 'hook2' | 'tieU' | 'tieC' | 'tieZ' | 'ring' | 'bent' | 'ladder';

/** Suy ra hình dạng thanh từ nhãn và số móc để vẽ hình thu nhỏ trong bảng thống kê. */
export function shapeOf(label: string, hooks: number): BarShapeKind {
  if (/thép buộc.*Chữ U/i.test(label)) return 'tieU';
  if (/thép buộc.*Chữ Z/i.test(label)) return 'tieZ';
  if (/thép buộc/i.test(label)) return 'tieC';
  if (/\(bo\)/i.test(label)) return 'ring';
  if (/vát góc/i.test(label)) return 'bent';
  if (/thang|móc nâng/i.test(label)) return 'ladder';
  return hooks >= 2 ? 'hook2' : hooks === 1 ? 'hook1' : 'straight';
}

/** Hình thu nhỏ của thanh trong ô `w × h` (mm giấy) có góc dưới trái tại (x, y). */
function drawShape(b: Builder, k: BarShapeKind, x: number, y: number, w: number, h: number): void {
  const L = (x1: number, y1: number, x2: number, y2: number) => b.line('THEP', x1, y1, x2, y2);
  const px = x + 3;
  const qx = x + w - 3;
  const lo = y + 1.2;
  const hi = y + h - 1.2;
  const mid = (lo + hi) / 2;
  switch (k) {
    case 'straight':
      L(px, mid, qx, mid);
      break;
    case 'hook1':
      L(px, mid - 1, qx, mid - 1);
      L(qx, mid - 1, qx, hi);
      break;
    case 'hook2':
      L(px, hi, px, lo);
      L(px, lo, qx, lo);
      L(qx, lo, qx, hi);
      break;
    case 'tieU':
      L(px + 6, hi, px + 6, lo);
      L(px + 6, lo, qx - 6, lo);
      L(qx - 6, lo, qx - 6, hi);
      break;
    case 'tieC':
      L(px + 6, hi, px + 6, lo);
      L(px + 6, lo, qx - 6, lo);
      L(qx - 6, lo, qx - 6, hi);
      L(px + 6, hi, px + 9, hi);
      L(qx - 6, hi, qx - 9, hi);
      break;
    case 'tieZ':
      L(px + 6, hi, px + 6, lo);
      L(px + 6, lo, qx - 6, lo);
      L(qx - 6, lo, qx - 6, hi);
      L(px + 6, hi, px + 9, hi);
      L(qx - 6, hi, qx - 3, hi);
      break;
    case 'ring':
      b.circle('THEP', x + w / 2, mid, Math.min(w, h) / 2 - 1);
      break;
    case 'bent':
      L(px, lo, px + 6, lo);
      L(px + 6, lo, px + 11, hi);
      L(px + 11, hi, qx, hi);
      break;
    case 'ladder':
      L(px + 4, hi, px + 4, lo);
      L(px + 4, lo, qx - 4, lo);
      L(qx - 4, lo, qx - 4, hi);
      break;
  }
}

function tableSheets(idPrefix: string, kind: SheetKind, title: string, subtitle: string, cols: Col[], rows: { cells: string[]; style?: 'head' | 'sub' | 'total' | 'row'; shape?: BarShapeKind }[], right: string): Sheet[] {
  const perPage = 40;
  const pages: typeof rows[] = [];
  for (let i = 0; i < rows.length; i += perPage) pages.push(rows.slice(i, i + perPage));
  if (!pages.length) pages.push([]);
  return pages.map((pg, pi) => {
    const b = new Builder(1);
    frame(b, { left: title, mid: subtitle.slice(0, 40), right: pages.length > 1 ? `${right} – tờ ${pi + 1}/${pages.length}` : right });
    const x0 = MARGIN.l + 6;
    const totalW = cols.reduce((s, c) => s + c.w, 0);
    const scaleX = Math.min(1, (A3.w - MARGIN.l - MARGIN.r - 12) / totalW);
    const rh = 5.4;
    let y = A3.h - MARGIN.t - 10;
    const drawRow = (cells: string[], style: string, shape?: BarShapeKind) => {
      let x = x0;
      b.line('KHUNG', x0, y - rh, x0 + totalW * scaleX, y - rh);
      cols.forEach((c, i) => {
        const w = c.w * scaleX;
        const tx = c.align === 'l' ? x + 1.5 : c.align === 'c' ? x + w / 2 : x + w - 1.5;
        if (c.shape && style === 'row') {
          if (shape) drawShape(b, shape, x, y - rh, w, rh);
        } else b.text('TEXT', tx, y - rh + 1.3, cells[i] ?? '', 2.6, c.align, 0, style === 'head' || style === 'total' || style === 'sub');
        x += w;
        b.line('KHUNG', x, y, x, y - rh);
      });
      b.line('KHUNG', x0, y, x0, y - rh);
      y -= rh;
    };
    b.line('KHUNG', x0, y, x0 + totalW * scaleX, y);
    drawRow(cols.map((c) => c.head), 'head');
    for (const r of pg) drawRow(r.cells, r.style ?? 'row', r.shape);
    return { id: `${idPrefix}:${pi}`, kind, title: `${title}${pages.length > 1 ? ` (${pi + 1}/${pages.length})` : ''}`, scale: 1, w: A3.w, h: A3.h, ents: b.ents };
  });
}

/** Bảng chiết tính cốt thép của một ga. */
export function buildScheduleSheets(res: GaResult, cfg: GaConfig): Sheet[] {
  const cols: Col[] = [
    { head: 'Ký hiệu', w: 22, align: 'c' },
    { head: 'Mô tả', w: 120, align: 'l' },
    { head: 'Hình dạng', w: 34, align: 'c', shape: true },
    { head: 'Ø (mm)', w: 20, align: 'c' },
    { head: 'Dài 1 thanh (mm)', w: 36, align: 'r' },
    { head: 'Số thanh', w: 24, align: 'r' },
    { head: 'Tổng dài (m)', w: 30, align: 'r' },
    { head: 'Khối lượng (kg)', w: 36, align: 'r' },
  ];
  const rows: { cells: string[]; style?: 'head' | 'sub' | 'total' | 'row'; shape?: BarShapeKind }[] = [];
  let total = 0;
  for (const part of PART_ORDER) {
    const gs = res.rebar.groups.filter((g) => g.part === part);
    if (!gs.length) continue;
    rows.push({ cells: ['', PART_LABEL[part].toUpperCase(), '', '', '', '', '', ''], style: 'sub' });
    let sub = 0;
    for (const g of gs) {
      const kg = barKg(g);
      sub += kg;
      rows.push({ cells: [g.mark, g.label.slice(0, 54), '', String(g.dia), String(g.length), String(g.count), fmt((g.length * g.count) / 1000, 1), fmt(kg, 2)], shape: shapeOf(g.label, g.hooks) });
    }
    rows.push({ cells: ['', `Cộng ${PART_LABEL[part]}`, '', '', '', '', '', fmt(sub, 2)], style: 'sub' });
    total += sub;
  }
  for (const a of res.rebar.angles) rows.push({ cells: ['TH', `${a.label} ${a.name}`, '', '', fmt(a.length * 1000, 0), String(a.count), fmt(a.length * a.count, 1), fmt(a.kg, 2)], shape: 'straight' });
  rows.push({ cells: ['', 'TỔNG CỘNG (một ga)', '', '', '', '', '', fmt(total + res.rebar.angleKg, 2)], style: 'total' });
  void cfg;
  return tableSheets(`${res.row.name}:schedule`, 'schedule', `${res.row.name} – THỐNG KÊ THÉP`, `Số lượng ga: ${res.row.count}`, cols, rows, 'Bảng chiết tính');
}

/** Bảng tổng hợp khối lượng của toàn dự án. */
export function buildSummarySheets(p: HoGaProject, items: ThklItem[]): Sheet[] {
  const cols: Col[] = [
    { head: 'TT', w: 16, align: 'c' },
    { head: 'Hạng mục', w: 210, align: 'l' },
    { head: 'Đơn vị', w: 24, align: 'c' },
    { head: 'Khối lượng', w: 40, align: 'r' },
  ];
  const rows = items.map((it) => ({ cells: [String(it.tt), it.name.slice(0, 80), it.unit, fmt(it.value, 2)] }));
  return tableSheets('summary', 'summary', 'BẢNG TỔNG HỢP KHỐI LƯỢNG', p.title, cols, rows, GA_KINDS[p.kind].label.slice(0, 30));
}
