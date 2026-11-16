/**
 * Thực thể CAD 2D trung gian (mm, y hướng lên). Cùng một danh sách thực thể được xuất ra SVG (xem trên web)
 * và DXF R12 (mở trong AutoCAD) nên hai kết quả luôn khớp nhau.
 */
import { PATTERNS, type PatternName } from './patterns';

export type LayerName = 'KC' | 'LOT' | 'CONG' | 'THEP' | 'THEP2' | 'THEP3' | 'THEP4' | 'KT' | 'TEXT' | 'TIEUDE' | 'HATCH' | 'TIM' | 'KHUNG' | 'NET';

export interface LayerDef {
  name: LayerName;
  label: string;
  /** màu ACI */
  aci: number;
  linetype: 'CONTINUOUS' | 'DASHED' | 'CENTER';
  /** bề dày nét (px khi xem) */
  weight: number;
  /** tên lớp trong tệp DXF – đặt theo bản vẽ mẫu của VHGpro (VHG-BT, VHG-Thep …) */
  dxf: string;
}

/**
 * Bảng lớp theo bản vẽ mẫu VHGpro: bê tông xanh lơ (4), cốt thép đỏ (1) / vàng (2, thép buộc) / tím nét đứt (6) / xám nét đứt (8),
 * kích thước xanh da trời (140), đường khuất xanh dương nét đứt (5), cống xanh dương (150), vật liệu xám (251), đường tim tím (6).
 * `TIEUDE` (tên hình, màu 3 xanh lá) dùng chung lớp VHG-Text với `TEXT` nhưng ghi màu riêng trên từng thực thể.
 */
export const LAYERS: LayerDef[] = [
  { name: 'KC', label: 'Kết cấu BTCT', aci: 4, linetype: 'CONTINUOUS', weight: 1.3, dxf: 'VHG-BT' },
  { name: 'LOT', label: 'Đường khuất', aci: 5, linetype: 'DASHED', weight: 1, dxf: 'VHG-Dashed' },
  { name: 'CONG', label: 'Cống, rãnh, vữa trát', aci: 150, linetype: 'CONTINUOUS', weight: 1.1, dxf: 'VHG-150' },
  { name: 'THEP', label: 'Cốt thép', aci: 1, linetype: 'CONTINUOUS', weight: 1.5, dxf: 'VHG-Thep' },
  { name: 'THEP2', label: 'Thép buộc, thép lớp 2', aci: 2, linetype: 'CONTINUOUS', weight: 1.2, dxf: 'VHG-Thep2' },
  { name: 'THEP3', label: 'Thép khuất', aci: 6, linetype: 'DASHED', weight: 1, dxf: 'VHG-Thep3' },
  { name: 'THEP4', label: 'Thép khuất (lớp kia)', aci: 8, linetype: 'DASHED', weight: 1, dxf: 'VHG-Thep4' },
  { name: 'KT', label: 'Kích thước', aci: 140, linetype: 'CONTINUOUS', weight: 0.8, dxf: 'VHG-Dim' },
  { name: 'TEXT', label: 'Ghi chú', aci: 7, linetype: 'CONTINUOUS', weight: 0.8, dxf: 'VHG-Text' },
  { name: 'TIEUDE', label: 'Tên hình', aci: 3, linetype: 'CONTINUOUS', weight: 0.8, dxf: 'VHG-Text' },
  { name: 'HATCH', label: 'Ký hiệu vật liệu', aci: 251, linetype: 'CONTINUOUS', weight: 0.6, dxf: 'VHG-VL' },
  { name: 'TIM', label: 'Đường tim', aci: 6, linetype: 'CENTER', weight: 0.8, dxf: 'VHG-Center' },
  { name: 'NET', label: 'Đường dẫn chú thích', aci: 140, linetype: 'CONTINUOUS', weight: 0.7, dxf: 'VHG-Dim' },
  { name: 'KHUNG', label: 'Khung bản vẽ, bảng', aci: 140, linetype: 'CONTINUOUS', weight: 1.1, dxf: 'VHG-140' },
];

/** Các lớp DXF (không trùng tên): lớp dùng chung giữ định nghĩa của lớp đầu tiên khai báo (VHG-Text lấy màu của TEXT). */
export const DXF_LAYERS: LayerDef[] = LAYERS.filter((l, i) => LAYERS.findIndex((o) => o.dxf === l.dxf) === i);

const LAYER_BY_NAME = new Map(LAYERS.map((l) => [l.name, l]));
/** Tên lớp DXF của một lớp nội bộ, và màu ACI ghi riêng trên thực thể khi lớp DXF dùng chung nhưng màu khác. */
export function dxfLayerOf(name: LayerName): { layer: string; aci?: number } {
  const l = LAYER_BY_NAME.get(name)!;
  const first = DXF_LAYERS.find((o) => o.dxf === l.dxf)!;
  return { layer: l.dxf, aci: first.aci !== l.aci ? l.aci : undefined };
}

export interface LineEnt {
  t: 'line';
  layer: LayerName;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
export interface PolyEnt {
  t: 'poly';
  layer: LayerName;
  pts: [number, number][];
  closed: boolean;
  /** tô đặc (vòng tròn thép) – chỉ dùng cho SVG; DXF vẽ polyline kín */
  fill?: boolean;
}
export interface CircleEnt {
  t: 'circle';
  layer: LayerName;
  cx: number;
  cy: number;
  r: number;
  fill?: boolean;
}
export interface TextEnt {
  t: 'text';
  layer: LayerName;
  x: number;
  y: number;
  h: number;
  s: string;
  /** căn lề: l | c | r */
  align?: 'l' | 'c' | 'r';
  /** góc xoay (độ) */
  rot?: number;
  bold?: boolean;
}
/**
 * Tô vật liệu: các vòng kín (quy tắc chẵn/lẻ). Hai kiểu:
 *  - đường song song: `angle` + `gap` (mm mô hình), DXF ghi mẫu ANSI31 với khoảng cách tuỳ chỉnh;
 *  - mẫu chuẩn: `pattern` + `pscale` (hệ số nhân định nghĩa mẫu theo inch), như HATCH của VHGpro (ví dụ ANSI32 × 4·tỷ lệ).
 */
export interface HatchEnt {
  t: 'hatch';
  layer: LayerName;
  loops: [number, number][][];
  angle: number;
  gap: number;
  pattern?: PatternName;
  pscale?: number;
}
/** Kích thước thẳng. `kind` h: đo theo x, đường kích thước tại y = `pos`; v: đo theo y, tại x = `pos`. Xuất DXF thành DIMENSION. */
export interface DimEnt {
  t: 'dim';
  layer: LayerName;
  kind: 'h' | 'v';
  /** hai điểm gốc đo (cho h: x1,x2 và yRef; cho v: y1,y2 và xRef) */
  a: number;
  b: number;
  ref: number;
  pos: number;
  text: string;
  /** mẫu số tỷ lệ bản vẽ khi dựng kích thước (đặt cỡ chữ, vạch xiên) */
  s: number;
}
export type Ent = LineEnt | PolyEnt | CircleEnt | TextEnt | HatchEnt | DimEnt;

/** Chuyển kích thước thành các đoạn thẳng, vạch xiên và chữ (dùng cho SVG, DXF R12 và khối ẩn *D của DXF R2000). */
export function dimGeometry(e: DimEnt): (LineEnt | TextEnt)[] {
  const out: (LineEnt | TextEnt)[] = [];
  const P = (mm: number) => mm * e.s;
  const L = (x1: number, y1: number, x2: number, y2: number) => out.push({ t: 'line', layer: 'KT', x1, y1, x2, y2 });
  const ex = P(1.2);
  const tk = P(1);
  const txt = (x: number, y: number, rot: number) => out.push({ t: 'text', layer: 'KT', x, y, h: P(2.2), s: e.text, align: 'c', rot });
  if (e.kind === 'h') {
    const dir = e.pos >= e.ref ? 1 : -1;
    L(e.a, e.ref + dir * P(1), e.a, e.pos + dir * ex);
    L(e.b, e.ref + dir * P(1), e.b, e.pos + dir * ex);
    L(e.a - ex, e.pos, e.b + ex, e.pos);
    L(e.a - tk, e.pos - tk, e.a + tk, e.pos + tk);
    L(e.b - tk, e.pos - tk, e.b + tk, e.pos + tk);
    txt((e.a + e.b) / 2, e.pos + (dir > 0 ? P(0.8) : -P(3.3)), 0);
  } else {
    const dir = e.pos >= e.ref ? 1 : -1;
    L(e.ref + dir * P(1), e.a, e.pos + dir * ex, e.a);
    L(e.ref + dir * P(1), e.b, e.pos + dir * ex, e.b);
    L(e.pos, e.a - ex, e.pos, e.b + ex);
    L(e.pos - tk, e.a - tk, e.pos + tk, e.a + tk);
    L(e.pos - tk, e.b - tk, e.pos + tk, e.b + tk);
    txt(e.pos + (dir > 0 ? P(2.8) : -P(0.8)), (e.a + e.b) / 2, 90);
  }
  return out;
}

/** Khai triển các thực thể ngữ nghĩa (HATCH, DIMENSION) thành thực thể hình học cơ bản. */
export function expandEnts(ents: Ent[]): Ent[] {
  const out: Ent[] = [];
  for (const e of ents) {
    if (e.t === 'hatch') {
      const segs = e.pattern ? patternSegments(e.loops, e.pattern, e.pscale ?? 1) : hatchLines(e.loops, e.angle, e.gap);
      for (const [a, b, c, d] of segs) out.push({ t: 'line', layer: e.layer, x1: a, y1: b, x2: c, y2: d });
    } else if (e.t === 'dim') out.push(...dimGeometry(e));
    else out.push(e);
  }
  return out;
}

export interface BBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export function bboxOf(ents: Ent[]): BBox {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const p = (x: number, y: number) => {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  };
  for (const e of ents) {
    if (e.t === 'hatch') e.loops.forEach((l) => l.forEach(([x, y]) => p(x, y)));
    else if (e.t === 'dim') {
      const g = bboxOf(dimGeometry(e));
      p(g.x0, g.y0);
      p(g.x1, g.y1);
    } else if (e.t === 'line') {
      p(e.x1, e.y1);
      p(e.x2, e.y2);
    } else if (e.t === 'poly') e.pts.forEach(([x, y]) => p(x, y));
    else if (e.t === 'circle') {
      p(e.cx - e.r, e.cy - e.r);
      p(e.cx + e.r, e.cy + e.r);
    } else {
      const w = e.s.length * e.h * 0.62;
      const ax = e.align === 'c' ? -w / 2 : e.align === 'r' ? -w : 0;
      if (!e.rot) {
        p(e.x + ax, e.y);
        p(e.x + ax + w, e.y + e.h);
      } else {
        p(e.x, e.y);
        p(e.x + e.h, e.y + w);
      }
    }
  }
  if (!Number.isFinite(x0)) return { x0: 0, y0: 0, x1: 0, y1: 0 };
  return { x0, y0, x1, y1 };
}

export function translate(ents: Ent[], dx: number, dy: number): Ent[] {
  return ents.map((e): Ent => {
    switch (e.t) {
      case 'line':
        return { ...e, x1: e.x1 + dx, y1: e.y1 + dy, x2: e.x2 + dx, y2: e.y2 + dy };
      case 'poly':
        return { ...e, pts: e.pts.map(([x, y]) => [x + dx, y + dy] as [number, number]) };
      case 'circle':
        return { ...e, cx: e.cx + dx, cy: e.cy + dy };
      case 'hatch':
        return { ...e, loops: e.loops.map((l) => l.map(([x, y]) => [x + dx, y + dy] as [number, number])) };
      case 'dim':
        return e.kind === 'h' ? { ...e, a: e.a + dx, b: e.b + dx, ref: e.ref + dy, pos: e.pos + dy } : { ...e, a: e.a + dy, b: e.b + dy, ref: e.ref + dx, pos: e.pos + dx };
      default:
        return { ...e, x: e.x + dx, y: e.y + dy };
    }
  });
}

/** Bộ dựng thực thể; `s` là mẫu số tỷ lệ bản vẽ (1/s) để đặt cỡ chữ, nét, mũi tên theo mm trên giấy. */
export class Builder {
  ents: Ent[] = [];
  constructor(public s: number) {}
  /** mm trên giấy → mm trong mô hình */
  paper(mm: number): number {
    return mm * this.s;
  }
  line(layer: LayerName, x1: number, y1: number, x2: number, y2: number): void {
    this.ents.push({ t: 'line', layer, x1, y1, x2, y2 });
  }
  poly(layer: LayerName, pts: [number, number][], closed = true, fill = false): void {
    this.ents.push({ t: 'poly', layer, pts, closed, fill });
  }
  rect(layer: LayerName, x0: number, y0: number, x1: number, y1: number): void {
    this.poly(layer, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], true);
  }
  circle(layer: LayerName, cx: number, cy: number, r: number, fill = false): void {
    this.ents.push({ t: 'circle', layer, cx, cy, r, fill });
  }
  text(layer: LayerName, x: number, y: number, s: string, hPaper = 2.5, align: 'l' | 'c' | 'r' = 'l', rot = 0, bold = false): void {
    this.ents.push({ t: 'text', layer, x, y, h: this.paper(hPaper), s, align, rot, bold });
  }
  /** Tô vật liệu: các đường song song cắt đa giác (hỗ trợ lỗ – quy tắc chẵn/lẻ). */
  hatch(polys: [number, number][][], angleDeg = 45, gapPaper = 2.2, layer: LayerName = 'HATCH'): void {
    if (polys.length) this.ents.push({ t: 'hatch', layer, loops: polys, angle: angleDeg, gap: this.paper(gapPaper) });
  }
  /** Tô theo mẫu chuẩn AutoCAD (ANSI32, AR-CONC …): hệ số mẫu = `k` × mẫu số tỷ lệ bản vẽ (VHGpro: ANSI* ×4, AR-CONC ×0,4). */
  hatchPat(polys: [number, number][][], pattern: PatternName, k: number, layer: LayerName = 'HATCH'): void {
    if (polys.length) this.ents.push({ t: 'hatch', layer, loops: polys, angle: 0, gap: 0, pattern, pscale: k * this.s });
  }
  /** Kích thước thẳng nằm ngang: từ x1 đến x2, đường kích thước tại y; điểm gốc đối tượng tại yRef. */
  dimH(x1: number, x2: number, y: number, yRef: number, label?: string): void {
    this.ents.push({ t: 'dim', layer: 'KT', kind: 'h', a: x1, b: x2, ref: yRef, pos: y, text: label ?? String(Math.round(Math.abs(x2 - x1))), s: this.s });
  }
  dimV(y1: number, y2: number, x: number, xRef: number, label?: string): void {
    this.ents.push({ t: 'dim', layer: 'KT', kind: 'v', a: y1, b: y2, ref: xRef, pos: x, text: label ?? String(Math.round(Math.abs(y2 - y1))), s: this.s });
  }
}

/** Các đoạn thẳng tô vật liệu cho tập đa giác (even-odd). */
export function hatchLines(polys: [number, number][][], angleDeg: number, gap: number): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  if (!(gap > 0)) return out;
  const a = (angleDeg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  // xoay hệ trục sao cho đường tô nằm ngang: x' = x c + y s ; y' = -x s + y c
  const rot = polys.map((p) => p.map(([x, y]) => [x * c + y * s, -x * s + y * c] as [number, number]));
  let ymin = Infinity;
  let ymax = -Infinity;
  for (const p of rot) for (const [, y] of p) {
    ymin = Math.min(ymin, y);
    ymax = Math.max(ymax, y);
  }
  if (!Number.isFinite(ymin)) return out;
  const start = Math.ceil(ymin / gap) * gap + gap * 0.01;
  for (let y = start; y < ymax; y += gap) {
    const xs: number[] = [];
    for (const p of rot) {
      for (let i = 0; i < p.length; i++) {
        const [x1, y1] = p[i];
        const [x2, y2] = p[(i + 1) % p.length];
        if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) xs.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
      }
    }
    xs.sort((m, n) => m - n);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      // quay ngược về hệ gốc
      const ax = xs[i] * c - y * s;
      const ay = xs[i] * s + y * c;
      const bx = xs[i + 1] * c - y * s;
      const by = xs[i + 1] * s + y * c;
      out.push([ax, ay, bx, by]);
    }
  }
  return out;
}

/**
 * Các đoạn thẳng của một mẫu tô chuẩn bên trong tập đa giác (quy tắc chẵn/lẻ), có xử lý nét đứt / chấm theo định nghĩa mẫu.
 * Dùng cho SVG và DXF R12; DXF R2000 ghi HATCH thật nên AutoCAD tự tô.
 */
export function patternSegments(loops: [number, number][][], name: PatternName, scale: number, maxLines = 6000): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  let bx0 = Infinity;
  let by0 = Infinity;
  let bx1 = -Infinity;
  let by1 = -Infinity;
  for (const l of loops) {
    for (const [x, y] of l) {
      bx0 = Math.min(bx0, x);
      by0 = Math.min(by0, y);
      bx1 = Math.max(bx1, x);
      by1 = Math.max(by1, y);
    }
  }
  if (!Number.isFinite(bx0) || !(scale > 0)) return out;
  const corners: [number, number][] = [[bx0, by0], [bx1, by0], [bx1, by1], [bx0, by1]];
  for (const [ang, px, py, ox, oy, dashes] of PATTERNS[name]) {
    const th = (ang * Math.PI) / 180;
    const ux = Math.cos(th);
    const uy = Math.sin(th);
    const nx = -uy;
    const ny = ux;
    const Px = px * scale;
    const Py = py * scale;
    const Ox = ox * scale;
    const Oy = oy * scale;
    const dn = Ox * nx + Oy * ny;
    if (Math.abs(dn) < 1e-9) continue;
    const ks = corners.map(([x, y]) => ((x - Px) * nx + (y - Py) * ny) / dn);
    const k0 = Math.floor(Math.min(...ks));
    const k1 = Math.ceil(Math.max(...ks));
    if (k1 - k0 > maxLines) continue;
    const D = dashes.map((v) => v * scale);
    const period = D.reduce((a, v) => a + Math.abs(v), 0);
    const dot = 0.02 * scale;
    for (let k = k0; k <= k1; k++) {
      const lx = Px + k * Ox;
      const ly = Py + k * Oy;
      const ts: number[] = [];
      for (const lp of loops) {
        for (let i = 0; i < lp.length; i++) {
          const [x1, y1] = lp[i];
          const [x2, y2] = lp[(i + 1) % lp.length];
          const d1 = (x1 - lx) * nx + (y1 - ly) * ny;
          const d2 = (x2 - lx) * nx + (y2 - ly) * ny;
          if ((d1 <= 0 && d2 > 0) || (d2 <= 0 && d1 > 0)) {
            const f = d1 / (d1 - d2);
            ts.push((x1 + f * (x2 - x1) - lx) * ux + (y1 + f * (y2 - y1) - ly) * uy);
          }
        }
      }
      ts.sort((a, b) => a - b);
      for (let i = 0; i + 1 < ts.length; i += 2) {
        const t0 = ts[i];
        const t1 = ts[i + 1];
        const seg = (a: number, b: number) => out.push([lx + a * ux, ly + a * uy, lx + b * ux, ly + b * uy]);
        if (!D.length || period < 1e-9) {
          seg(t0, t1);
          continue;
        }
        let t = Math.floor(t0 / period) * period;
        while (t < t1) {
          for (const v of D) {
            const len = Math.abs(v);
            if (v === 0) {
              if (t >= t0 && t <= t1) seg(t, t + dot);
            } else if (v > 0) {
              const a = Math.max(t, t0);
              const b = Math.min(t + len, t1);
              if (b > a) seg(a, b);
            }
            t += len;
            if (t >= t1) break;
          }
        }
      }
    }
  }
  return out;
}
