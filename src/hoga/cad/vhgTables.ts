/**
 * Bảng thống kê cốt thép và tờ "hình dạng thanh" theo kiểu bản vẽ mẫu VHGpro: bảng có ô tên kết cấu gộp (chữ dọc),
 * số hiệu trong vòng tròn, hình dạng thanh thu nhỏ, Ø, chiều dài một thanh (m), số thanh, tổng chiều dài (m), khối lượng (kg),
 * chia thành hai cột bảng đặt cạnh nhau; cuối bảng là khối "Tổng (kg)" theo Ø ≤ 10 / Ø > 10 của từng phần.
 */
import { Builder } from './ents';
import { A3, drawShape, shapeOf, type BarShapeKind } from './sheets';
import { FRAME, vhgFrame } from './vhgFrame';
import { barKg, PART_LABEL, type BarGroup, type RebarPart } from '../engine/rebar';
import type { GaResult } from '../engine/summary';
import { fmt } from '../engine/summary';

export interface SchedRow {
  mark: string;
  label: string;
  shape: BarShapeKind;
  dia: number;
  /** mm */
  length: number;
  count: number;
  kg: number;
  hooks: number;
}
export interface SchedGroup {
  key: string;
  name: string;
  rows: SchedRow[];
}

const ORDER = ['Đáy - lớp trên', 'Đáy - lớp dưới'];

/** Gom các nhóm thanh theo "kết cấu - lớp" như bản mẫu: Đáy, Tường Tn ngoài/trong, Trần, Cổ ga, Thang thép, cửa thu, tấm nắp. */
export function scheduleGroups(res: GaResult): SchedGroup[] {
  const map = new Map<string, SchedGroup>();
  const order: string[] = [];
  const add = (key: string, name: string, g: BarGroup): void => {
    let e = map.get(key);
    if (!e) {
      e = { key, name, rows: [] };
      map.set(key, e);
      order.push(key);
    }
    e.rows.push({ mark: g.mark, label: g.label, shape: shapeOf(g.label, g.hooks), dia: g.dia, length: g.length, count: g.count, kg: barKg(g), hooks: g.hooks });
  };
  let wall = 0;
  let layer: 'ngoài' | 'trong' = 'ngoài';
  for (const g of res.rebar.groups) {
    const part: RebarPart = g.part;
    if (part === 'bottom') add(/lớp dưới/.test(g.label) ? 'bd-l' : 'bd-t', /lớp dưới/.test(g.label) ? ORDER[1] : ORDER[0], g);
    else if (part === 'wall') {
      const m = /^Tường (\d) lớp (ngoài|trong)/.exec(g.label);
      const t = /^Tường (\d) – thép buộc/.exec(g.label);
      const gc = /\((ngoài|trong)\)/.exec(g.label);
      if (m) {
        wall = Number(m[1]);
        layer = m[2] as 'ngoài' | 'trong';
      } else if (t) {
        wall = Number(t[1]);
        layer = 'ngoài';
      } else if (gc) layer = gc[1] as 'ngoài' | 'trong';
      if (/thang thép/i.test(g.label)) add('thang', 'Thang thép', g);
      else add(`t${wall}-${layer}`, `Tường T${wall} - lớp ${layer}`, g);
    } else if (part === 'roof') {
      const low = /lớp dưới/.test(g.label);
      add(low ? 'tr-d' : 'tr-t', low ? 'Trần - lớp dưới' : 'Trần - lớp trên', g);
    } else if (part === 'neck') add('co', 'Cổ ga', g);
    else add(part, PART_LABEL[part], g);
  }
  const rank = (k: string): number => {
    const fixed = ['bd-t', 'bd-l'];
    const i = fixed.indexOf(k);
    if (i >= 0) return i;
    const w = /^t(\d)-(ngoài|trong)$/.exec(k);
    if (w) return 10 + Number(w[1]) * 2 + (w[2] === 'trong' ? 1 : 0);
    return { 'tr-t': 30, 'tr-d': 31, co: 32, thang: 33, inlet: 34, lid: 35 }[k] ?? 40;
  };
  return order.sort((a, b) => rank(a) - rank(b)).map((k) => map.get(k)!);
}

const COLS = [
  { head: ['Tên', 'kết cấu'], w: 14 },
  { head: ['Số', 'hiệu'], w: 10 },
  { head: ['Hình dạng,', 'kích thước (mm)'], w: 44 },
  { head: ['Ø', '(mm)'], w: 8 },
  { head: ['Chiều dài', '1 thanh (m)'], w: 15 },
  { head: ['Số', 'thanh'], w: 9 },
  { head: ['Tổng chiều', 'dài (m)'], w: 14 },
  { head: ['Khối', 'lượng (kg)'], w: 14 },
];
/** Hình thu nhỏ của thanh vẽ ở hệ giấy (mm) rồi nhân tỷ lệ của tờ. */
export function shapeAt(b: Builder, kind: BarShapeKind, x: number, y: number, w: number, h: number): void {
  const tb = new Builder(1);
  drawShape(tb, kind, x, y, w, h);
  for (const e of tb.ents) {
    if (e.t === 'line') b.line(e.layer, e.x1 * b.s, e.y1 * b.s, e.x2 * b.s, e.y2 * b.s);
    else if (e.t === 'circle') b.circle(e.layer, e.cx * b.s, e.cy * b.s, e.r * b.s);
  }
}

export const SET_W = COLS.reduce((a, c) => a + c.w, 0);
const ROW_H = 5.8;
const HEAD_H = 10;

interface Area {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/**
 * Vẽ bảng vào `area` (mm giấy; y1 là mép trên): tối đa hai cột bảng cạnh nhau, mỗi cột lấp từ trên xuống.
 * Trả về các nhóm chưa vẽ hết (để sang tờ sau). Một nhóm có thể bị cắt ở cuối cột (phần còn lại ở cột kế).
 */
export function drawSchedule(b: Builder, groups: SchedGroup[], area: Area, reserveBottom = 0): SchedGroup[] {
  const s = b.s;
  const sets = Math.max(1, Math.min(2, Math.floor((area.x1 - area.x0 + 4) / (SET_W + 4))));
  const queue = groups.map((g) => ({ ...g, rows: [...g.rows] }));
  const L = (x1: number, y1: number, x2: number, y2: number) => b.line('KHUNG', x1 * s, y1 * s, x2 * s, y2 * s);
  const T = (x: number, y: number, t: string, h = 1.9, align: 'l' | 'c' | 'r' = 'c', rot = 0) => b.text('TEXT', x * s, y * s, t, h, align, rot);
  for (let set = 0; set < sets; set++) {
    const x0 = area.x0 + set * (SET_W + 4);
    let y = area.y1;
    // tiêu đề cột
    let x = x0;
    L(x0, y, x0 + SET_W, y);
    COLS.forEach((c) => {
      T(x + c.w / 2, y - 4.2, c.head[0]);
      T(x + c.w / 2, y - 8, c.head[1]);
      x += c.w;
    });
    y -= HEAD_H;
    L(x0, y, x0 + SET_W, y);
    const yMin = area.y0 + reserveBottom;
    const top = y;
    while (queue.length && y - ROW_H >= yMin) {
      const g = queue[0];
      const fit = Math.min(g.rows.length, Math.floor((y - yMin) / ROW_H));
      const part = g.rows.splice(0, fit);
      const gTop = y;
      for (const r of part) {
        const yb = y - ROW_H;
        let cx = x0 + COLS[0].w;
        // số hiệu: vòng tròn
        const markX = cx + COLS[1].w / 2;
        b.circle('KT', markX * s, (yb + ROW_H / 2) * s, 2.3 * s);
        T(markX, yb + ROW_H / 2 - 0.7, r.mark, 1.6);
        cx += COLS[1].w;
        // hình dạng
        shapeAt(b, r.shape, cx, yb, COLS[2].w, ROW_H);
        b.text('TEXT', (cx + COLS[2].w / 2) * s, (yb + ROW_H - 1.8) * s, String(Math.round(r.length)), 1.5, 'c');
        cx += COLS[2].w;
        const vals = [String(r.dia), fmt(r.length / 1000, 2), String(r.count), fmt((r.length * r.count) / 1000, 2), fmt(r.kg, 2)];
        for (let k = 0; k < vals.length; k++) {
          T(cx + COLS[3 + k].w / 2, yb + ROW_H / 2 - 0.7, vals[k], 1.8);
          cx += COLS[3 + k].w;
        }
        L(x0 + COLS[0].w, yb, x0 + SET_W, yb);
        y = yb;
      }
      // ô tên kết cấu gộp (chữ dọc) và đường kẻ nhóm
      const gh = gTop - y;
      L(x0, y, x0 + SET_W, y);
      const nm = g.name + (part.length < g.rows.length + part.length && g.rows.length ? ' …' : '');
      const th = Math.max(1.3, Math.min(1.9, (gh - 1) / (nm.length * 0.62)));
      T(x0 + COLS[0].w / 2 + 0.7, gTop - gh / 2 - (nm.length * th * 0.62) / 2, nm, th, 'l', 90);
      if (!g.rows.length) queue.shift();
    }
    // khung cột bảng
    const yEnd = y;
    let vx = x0;
    L(x0, top, x0, yEnd);
    for (const c of COLS) {
      vx += c.w;
      L(vx, top + HEAD_H, vx, yEnd);
    }
    L(x0, top + HEAD_H, x0, top);
    if (!queue.length) {
      // khối Tổng (kg) ngay dưới bảng ở cột cuối cùng đã dùng
      void 0;
      break;
    }
  }
  return queue;
}

/** Khối "Tổng (kg)" theo Ø ≤ 10 / Ø > 10 của từng phần; (x0, y1) là góc trên trái. */
export function drawTotals(b: Builder, res: GaResult, x0: number, y1: number, w: number): void {
  const s = b.s;
  const parts: RebarPart[] = ['bottom', 'wall', 'roof', 'neck'];
  const cw = w / (1 + parts.length * 2);
  const L = (a: number, y: number, c: number, y2: number) => b.line('KHUNG', a * s, y * s, c * s, y2 * s);
  const T = (x: number, y: number, t: string, h = 1.7) => b.text('TEXT', x * s, y * s, t, h, 'c');
  L(x0, y1, x0 + w, y1);
  L(x0, y1 - 5, x0 + w, y1 - 5);
  L(x0, y1 - 10, x0 + w, y1 - 10);
  L(x0, y1 - 15, x0 + w, y1 - 15);
  T(x0 + cw / 2, y1 - 3.5, 'Tổng');
  T(x0 + cw / 2, y1 - 8.5, '(kg)');
  T(x0 + cw / 2, y1 - 13.5, fmt(res.rebar.totalKg, 2), 1.7);
  parts.forEach((p, i) => {
    const px = x0 + cw * (1 + i * 2);
    T(px + cw, y1 - 3.5, PART_LABEL[p]);
    T(px + cw / 2, y1 - 8.5, 'Ø≤10');
    T(px + cw * 1.5, y1 - 8.5, 'Ø>10');
    T(px + cw / 2, y1 - 13.5, fmt(res.rebar.byPart[p].le10, 2), 1.6);
    T(px + cw * 1.5, y1 - 13.5, fmt(res.rebar.byPart[p].gt10, 2), 1.6);
    L(px, y1, px, y1 - 15);
    L(px + cw, y1 - 5, px + cw, y1 - 15);
  });
  L(x0, y1, x0, y1 - 15);
  L(x0 + cw, y1, x0 + cw, y1 - 15);
  L(x0 + w, y1, x0 + w, y1 - 15);
}

/** Vùng bảng: từ x0 tới mép phải trong, từ mép dưới trong tới mép trên trong của khung. */
export function tableArea(x0: number): Area {
  return { x0, x1: A3.w - FRAME.r - 3, y0: FRAME.b + 4, y1: A3.h - FRAME.t - 3 };
}

export { vhgFrame };
