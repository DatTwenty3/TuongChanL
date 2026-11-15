/**
 * Thực thể CAD 2D trung gian (mm, y hướng lên). Cùng một danh sách thực thể được xuất ra SVG (xem trên web)
 * và DXF R12 (mở trong AutoCAD) nên hai kết quả luôn khớp nhau.
 */
export type LayerName = 'KC' | 'LOT' | 'CONG' | 'THEP' | 'KT' | 'TEXT' | 'HATCH' | 'TIM' | 'KHUNG' | 'NET';

export interface LayerDef {
  name: LayerName;
  label: string;
  /** màu ACI */
  aci: number;
  linetype: 'CONTINUOUS' | 'DASHED' | 'CENTER';
  /** bề dày nét (px khi xem) */
  weight: number;
}

export const LAYERS: LayerDef[] = [
  { name: 'KC', label: 'Kết cấu BTCT', aci: 4, linetype: 'CONTINUOUS', weight: 1.4 },
  { name: 'LOT', label: 'Lớp lót, đường khuất', aci: 6, linetype: 'DASHED', weight: 1 },
  { name: 'CONG', label: 'Cống, rãnh, vữa trát', aci: 5, linetype: 'CONTINUOUS', weight: 1.1 },
  { name: 'THEP', label: 'Cốt thép', aci: 1, linetype: 'CONTINUOUS', weight: 1.6 },
  { name: 'KT', label: 'Kích thước', aci: 3, linetype: 'CONTINUOUS', weight: 0.8 },
  { name: 'TEXT', label: 'Ghi chú', aci: 7, linetype: 'CONTINUOUS', weight: 0.8 },
  { name: 'HATCH', label: 'Ký hiệu vật liệu', aci: 8, linetype: 'CONTINUOUS', weight: 0.6 },
  { name: 'TIM', label: 'Đường tim', aci: 1, linetype: 'CENTER', weight: 0.8 },
  { name: 'NET', label: 'Nét mảnh', aci: 9, linetype: 'CONTINUOUS', weight: 0.6 },
  { name: 'KHUNG', label: 'Khung tên, bảng', aci: 7, linetype: 'CONTINUOUS', weight: 1.2 },
];

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
/** Tô vật liệu: các vòng kín (quy tắc chẵn/lẻ), góc và khoảng cách nét (mm mô hình). Xuất DXF thành HATCH thật. */
export interface HatchEnt {
  t: 'hatch';
  layer: LayerName;
  loops: [number, number][][];
  angle: number;
  gap: number;
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
      for (const [a, b, c, d] of hatchLines(e.loops, e.angle, e.gap)) out.push({ t: 'line', layer: e.layer, x1: a, y1: b, x2: c, y2: d });
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
