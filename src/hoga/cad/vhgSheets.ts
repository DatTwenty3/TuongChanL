/**
 * Bộ bản vẽ A3 của một hố ga theo bố cục của bản vẽ mẫu VHGpro: mỗi tờ gồm 6 hình xếp 3 cột × 2 hàng, mỗi hình có
 * tên màu xanh lá và dòng "Tỷ lệ 1:n" phía trên, khung đơn (lề trái 20 mm, các lề còn lại 5 mm), không có khung tên.
 *   Tờ 1: mặt bằng ga · cắt B-B · cắt cốt thép A-A / cắt A-A · lưới thép tường · cốt thép cắt B-B
 * Tỷ lệ chọn tự động (lớn nhất mà mọi hình nằm gọn trong ô) hoặc theo yêu cầu.
 */
import { Builder, bboxOf, translate, type Ent } from './ents';
import { makeCtx, section, sectionRebar, type Ctx, type View } from './views';
import { figureTitle, planTop, wallMeshPlan } from './viewsVhg';
import { slabPanel, wallPanel } from './viewsPanels';
import { neckPlan, neckSection } from './viewsNeck';
import { drawSchedule, drawTotals, scheduleGroups, SET_W, shapeAt, tableArea } from './vhgTables';
import { A3, SCALES, type Sheet } from './sheets';
import { FRAME, vhgFrame } from './vhgFrame';
import type { GaConfig, GaKindInfo } from '../engine/types';
import type { GaResult } from '../engine/summary';
import type { PipeCatalog } from '../engine/parse';

/** Tâm 3 cột và đường chuẩn trên của tên hình ở 2 hàng (mm trên giấy, đo từ mép trên) — số đo từ bản vẽ mẫu. */
export const COL_X = [79.8, 216.15, 352.5];
export const ROW_TOP = [10, 149.3];
const CELL_W = 136.35;
const ROW_H = 139.3;
const TITLE_ZONE = 15;

export interface Cell {
  view: View | null;
  title: string;
}

/** Chọn tỷ lệ: nhỏ nhất trong SCALES mà mọi hình nằm trọn trong vùng của ô (trừ chỗ tên hình). */
export function pickScale(make: (s: number) => (View | null)[], cols = 3, rows = 2): number {
  const fits = (s: number): boolean =>
    make(s).every((v) => {
      if (!v) return true;
      const bb = bboxOf(v.ents);
      return (bb.x1 - bb.x0) / s <= CELL_W - 6 && (bb.y1 - bb.y0) / s <= ROW_H - TITLE_ZONE - 4;
    });
  void cols;
  void rows;
  return SCALES.find(fits) ?? SCALES[SCALES.length - 1];
}

/** Đặt các hình vào lưới ô và vẽ tên hình, khung. */
export function placeCells(b: Builder, cells: Cell[], cols = 3): void {
  const s = b.s;
  cells.forEach((cell, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = COL_X[col] * s;
    const titleY = (A3.h - ROW_TOP[row] - 4.5) * s;
    figureTitle(b, cx, titleY, cell.title);
    if (!cell.view) return;
    const bb = bboxOf(cell.view.ents);
    const top = (A3.h - ROW_TOP[row] - TITLE_ZONE) * s;
    const bottom = top - (ROW_H - TITLE_ZONE - 4) * s;
    const dx = cx - (bb.x0 + bb.x1) / 2;
    const dy = (top + bottom) / 2 - (bb.y0 + bb.y1) / 2;
    b.ents.push(...translate(cell.view.ents, dx, dy));
  });
}

function mk(res: GaResult, cfg: GaConfig, cat: PipeCatalog, info: GaKindInfo): Ctx {
  return makeCtx(res, cfg, cat, info);
}

/** Tờ 1: mặt bằng ga, các mặt cắt kết cấu / cốt thép và mặt bằng lưới thép tường. */
export function buildVhgMain(res: GaResult, cfg: GaConfig, cat: PipeCatalog, info: GaKindInfo, opts: { scale?: number | 'auto' } = {}): Sheet {
  const c = mk(res, cfg, cat, info);
  // trong bản mẫu A-A là mặt cắt ngang (theo bề rộng B), B-B là mặt cắt dọc (theo chiều dài L) → hoán đổi nhãn so với id trục nội bộ
  const views = (s: number): (View | null)[] => [planTop(c, s), section(c, s, 'A'), sectionRebar(c, s, 'B'), section(c, s, 'B'), wallMeshPlan(c, s), sectionRebar(c, s, 'A')];
  const s = typeof opts.scale === 'number' ? opts.scale : pickScale(views);
  const v = views(s);
  const b = new Builder(s);
  vhgFrame(b);
  const titles = [`MẶT BẰNG HỐ GA ${res.row.name}`, 'MẶT CẮT B-B', 'MẶT CẮT  CỐT THÉP A-A', 'MẶT CẮT A-A', 'MẶT BẰNG LƯỚI THÉP TƯỜNG', 'CỐT THÉP MẶT CẮT B-B'];
  placeCells(b, v.map((view, i) => ({ view, title: titles[i] })));
  return { id: `${res.row.name}:vhg1`, kind: 'vhg1', title: `${res.row.name} – Tờ 1`, scale: s, w: A3.w * s, h: A3.h * s, ents: b.ents };
}

/** Tờ 2 và 3: mặt bằng / mặt đứng từng lớp thép (bản đáy, 4 tường, trần), mỗi tờ 6 hình. */
export function buildVhgLayers(res: GaResult, cfg: GaConfig, cat: PipeCatalog, info: GaKindInfo, sheetNo: 2 | 3, opts: { scale?: number | 'auto' } = {}): Sheet {
  const c = mk(res, cfg, cat, info);
  const items: ((s: number) => View | null)[] =
    sheetNo === 2
      ? [(s) => slabPanel(c, s, 'bottom', 'up'), (s) => wallPanel(c, s, 0, 'out'), (s) => wallPanel(c, s, 1, 'out'), (s) => slabPanel(c, s, 'bottom', 'low'), (s) => wallPanel(c, s, 0, 'in'), (s) => wallPanel(c, s, 1, 'in')]
      : [(s) => wallPanel(c, s, 2, 'out'), (s) => wallPanel(c, s, 3, 'out'), (s) => slabPanel(c, s, 'roof', 'up'), (s) => wallPanel(c, s, 2, 'in'), (s) => wallPanel(c, s, 3, 'in'), (s) => slabPanel(c, s, 'roof', 'low')];
  const views = (s: number): (View | null)[] => items.map((f) => f(s));
  const s = typeof opts.scale === 'number' ? opts.scale : pickScale(views);
  const b = new Builder(s);
  vhgFrame(b);
  placeCells(b, views(s).map((view) => ({ view, title: view?.title ?? '' })));
  return { id: `${res.row.name}:vhg${sheetNo}`, kind: sheetNo === 2 ? 'vhg2' : 'vhg3', title: `${res.row.name} – Tờ ${sheetNo}`, scale: s, w: A3.w * s, h: A3.h * s, ents: b.ents };
}

/** Tờ 4 (và các tờ tiếp theo nếu bảng dài): hình thép cổ ga ở bên trái, bảng thống kê cốt thép hai cột bên phải, khối "Tổng (kg)" ở tờ cuối. */
export function buildVhgSchedule(res: GaResult, cfg: GaConfig, cat: PipeCatalog, info: GaKindInfo, s: number): Sheet[] {
  const c = mk(res, cfg, cat, info);
  const hasNeck = !!c.neck;
  let groups = scheduleGroups(res);
  const pages: Sheet[] = [];
  let pageNo = 0;
  const neckViews = (sc: number): (View | null)[] => [neckPlan(c, sc), neckSection(c, sc, 'A'), neckSection(c, sc, 'B')];
  while (pageNo === 0 || groups.length) {
    const b = new Builder(s);
    vhgFrame(b);
    let x0 = FRAME.l + 4;
    if (pageNo === 0 && hasNeck) {
      neckViews(s).forEach((view, i) => {
        const cx = (FRAME.l + 40) * s;
        const topMm = [10, 102, 194][i];
        figureTitle(b, cx, (A3.h - topMm - 4.5) * s, view?.title ?? '');
        if (!view) return;
        const bb = bboxOf(view.ents);
        const top = (A3.h - topMm - 15) * s;
        const bottom = top - 72 * s;
        b.ents.push(...translate(view.ents, cx - (bb.x0 + bb.x1) / 2, (top + bottom) / 2 - (bb.y0 + bb.y1) / 2));
      });
      x0 = FRAME.l + 84;
    }
    const left = drawSchedule(b, groups, tableArea(x0), 20);
    if (!left.length) drawTotals(b, res, x0 + SET_W + 4, FRAME.b + 4 + 17, SET_W);
    groups = left;
    pages.push({ id: `${res.row.name}:vhg4:${pageNo}`, kind: 'vhg4', title: `${res.row.name} – Tờ 4${pageNo ? ` (${pageNo + 1})` : ''}`, scale: s, w: A3.w * s, h: A3.h * s, ents: b.ents });
    pageNo++;
    if (pageNo > 6) break;
  }
  return pages;
}

/** Tờ 5: hình dạng từng thanh theo kết cấu (7 cột: đáy, T1…T4, trần, cổ ga và thang thép) — tên nhóm xanh lá, nhãn "Mã-Ø, L=…". */
export function buildVhgShapes(res: GaResult, s: number): Sheet {
  const b = new Builder(s);
  vhgFrame(b);
  const groups = scheduleGroups(res);
  const cols: { head: string; keys: string[] }[] = [
    { head: 'Bản đáy', keys: ['bd-t', 'bd-l'] },
    { head: 'Tường T1', keys: ['t1-ngoài', 't1-trong'] },
    { head: 'Tường T2', keys: ['t2-ngoài', 't2-trong'] },
    { head: 'Tường T3', keys: ['t3-ngoài', 't3-trong'] },
    { head: 'Tường T4', keys: ['t4-ngoài', 't4-trong'] },
    { head: 'Trần', keys: ['tr-t', 'tr-d'] },
    { head: 'Cổ ga', keys: ['co', 'thang', 'inlet', 'lid'] },
  ];
  const colW = (A3.w - FRAME.l - FRAME.r) / cols.length;
  cols.forEach((col, ci) => {
    const cx = FRAME.l + colW * (ci + 0.5);
    const gs = col.keys.map((k) => groups.find((g) => g.key === k)).filter((g): g is NonNullable<typeof g> => !!g);
    const nRows = gs.reduce((m, g) => m + g.rows.length, 0);
    const avail = A3.h - FRAME.t - FRAME.b - 12 - gs.length * 9;
    const pitch = Math.max(8.5, Math.min(15, avail / Math.max(1, nRows)));
    let y = A3.h - FRAME.t - 9;
    for (const g of gs) {
      b.text('TIEUDE', cx * s, y * s, g.name, 2.6, 'c');
      y -= 8;
      for (const r of g.rows) {
        b.text('TEXT', cx * s, y * s, `${r.mark}-Ø${r.dia}, L=${Math.round(r.length)}`, 1.9, 'c');
        shapeAt(b, r.shape, cx - 18, y - pitch + 4.2, 36, 5);
        y -= pitch;
      }
      y -= 2;
    }
  });
  return { id: `${res.row.name}:vhg5`, kind: 'vhg5', title: `${res.row.name} – Tờ 5`, scale: s, w: A3.w * s, h: A3.h * s, ents: b.ents };
}

/** Chọn tỷ lệ chung cho cả bộ bản vẽ của một ga (nhỏ nhất mà mọi hình ở mọi tờ nằm trọn trong ô). */
export function vhgSetScale(res: GaResult, cfg: GaConfig, cat: PipeCatalog, info: GaKindInfo): number {
  const c = mk(res, cfg, cat, info);
  const main = pickScale((s) => [planTop(c, s), section(c, s, 'A'), sectionRebar(c, s, 'B'), section(c, s, 'B'), wallMeshPlan(c, s), sectionRebar(c, s, 'A')]);
  const l2 = pickScale((s) => [slabPanel(c, s, 'bottom', 'up'), wallPanel(c, s, 0, 'out'), wallPanel(c, s, 1, 'out'), slabPanel(c, s, 'bottom', 'low'), wallPanel(c, s, 0, 'in'), wallPanel(c, s, 1, 'in')]);
  const l3 = pickScale((s) => [wallPanel(c, s, 2, 'out'), wallPanel(c, s, 3, 'out'), slabPanel(c, s, 'roof', 'up'), wallPanel(c, s, 2, 'in'), wallPanel(c, s, 3, 'in'), slabPanel(c, s, 'roof', 'low')]);
  let neck = SCALES[0];
  if (c.neck) {
    neck = SCALES.find((s) =>
      [neckPlan(c, s), neckSection(c, s, 'A'), neckSection(c, s, 'B')].every((v) => {
        if (!v) return true;
        const bb = bboxOf(v.ents);
        return (bb.x1 - bb.x0) / s <= 78 && (bb.y1 - bb.y0) / s <= 76;
      }),
    ) ?? SCALES[SCALES.length - 1];
  }
  return Math.max(main, l2, l3, neck);
}

/**
 * Bộ bản vẽ A3 của một ga theo bản mẫu VHGpro: tờ 1 (6 hình), tờ 2 và 3 (các lớp thép), tờ 4 (cổ ga + bảng thống kê, có thể nhiều tờ),
 * tờ 5 (hình dạng thanh). Mọi tờ cùng một tỷ lệ — tự chọn hoặc `opts.scale`.
 */
export function buildVhgSet(res: GaResult, cfg: GaConfig, cat: PipeCatalog, info: GaKindInfo, opts: { scale?: number | 'auto' } = {}): Sheet[] {
  const s = typeof opts.scale === 'number' ? opts.scale : vhgSetScale(res, cfg, cat, info);
  return [
    buildVhgMain(res, cfg, cat, info, { scale: s }),
    buildVhgLayers(res, cfg, cat, info, 2, { scale: s }),
    buildVhgLayers(res, cfg, cat, info, 3, { scale: s }),
    ...buildVhgSchedule(res, cfg, cat, info, s),
    buildVhgShapes(res, s),
  ];
}

export type { Ent };
