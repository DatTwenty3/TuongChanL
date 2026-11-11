/**
 * Nhãn chú thích các lớp đất chĩa ra từ mô hình 3D (hiển thị, mở rộng).
 * Hàm thuần: nhận vị trí điểm neo trên màn hình và cỡ ô nhãn, trả vị trí ô nhãn đã tránh chồng
 * lên nhau và điểm gấp của đường chĩa. Phần chiếu 3D → màn hình nằm ở `V3.toScreen`.
 */

export interface SoilLabelInput {
  id: string;
  /** Điểm neo (px) trên mép khối đất. */
  ax: number;
  ay: number;
  /** Bên đặt nhãn: R = bên phải mô hình, L = bên trái. */
  side: 'L' | 'R';
  w: number;
  h: number;
}

export interface SoilLabelPos extends SoilLabelInput {
  /** Góc trên trái của ô nhãn (px). */
  x: number;
  y: number;
  /** Điểm gấp và điểm chạm ô nhãn của đường chĩa. */
  bx: number;
  by: number;
  ex: number;
  ey: number;
}

export interface SoilLabelOptions {
  margin?: number;
  gap?: number;
  /** Khoảng cách ngang từ mép mô hình tới cột nhãn. */
  offset?: number;
  /** Bề ngang bên phải bị chú giải che (px). */
  reserveRight?: number;
}

function stack(items: SoilLabelPos[], top: number, bottom: number, gap: number): void {
  items.sort((a, b) => a.y + a.h / 2 - (b.y + b.h / 2));
  for (let i = 0; i < items.length; i++) {
    const min = i === 0 ? top : items[i - 1].y + items[i - 1].h + gap;
    if (items[i].y < min) items[i].y = min;
  }
  const last = items[items.length - 1];
  if (last && last.y + last.h > bottom) {
    last.y = bottom - last.h;
    for (let i = items.length - 2; i >= 0; i--) {
      const max = items[i + 1].y - gap - items[i].h;
      if (items[i].y > max) items[i].y = max;
    }
  }
  if (items.length && items[0].y < top) items[0].y = top;
}

export function layoutSoilLabels(
  input: readonly SoilLabelInput[],
  W: number,
  H: number,
  opt: SoilLabelOptions = {},
): SoilLabelPos[] {
  const margin = opt.margin ?? 8;
  const gap = opt.gap ?? 6;
  const offset = opt.offset ?? 42;
  const reserve = Math.max(0, opt.reserveRight ?? 0);
  const out: SoilLabelPos[] = [];

  (['R', 'L'] as const).forEach((side) => {
    const grp = input.filter((i) => i.side === side);
    if (!grp.length) return;
    const w = Math.max(...grp.map((g) => g.w));
    const items: SoilLabelPos[] = grp.map((g) => ({
      ...g,
      w,
      x: 0,
      y: g.ay - g.h / 2,
      bx: 0,
      by: 0,
      ex: 0,
      ey: 0,
    }));
    if (side === 'R') {
      const far = Math.max(...grp.map((g) => g.ax));
      const x = Math.max(margin, Math.min(far + offset, W - reserve - w - margin));
      items.forEach((it) => (it.x = x));
    } else {
      const far = Math.min(...grp.map((g) => g.ax));
      const x = Math.min(Math.max(margin, far - offset - w), W - w - margin);
      items.forEach((it) => (it.x = x));
    }
    stack(items, margin, H - margin, gap);
    items.forEach((it) => {
      it.ey = it.y + it.h / 2;
      it.ex = side === 'R' ? it.x : it.x + it.w;
      const dir = side === 'R' ? -1 : 1;
      it.bx = it.ex + dir * 14;
      it.by = it.ey;
      // neo nằm sau điểm gấp (nhãn sát mô hình): nối thẳng
      if ((side === 'R' && it.ax >= it.bx) || (side === 'L' && it.ax <= it.bx)) {
        it.bx = it.ax;
        it.by = it.ey;
      }
      out.push(it);
    });
  });
  return out;
}
