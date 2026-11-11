/**
 * Bản vẽ móng cọc BTCT (mô đun mở rộng): mặt cắt bố trí, mặt bằng bố trí và chi tiết lồng thép.
 * Chỉ dùng các layer sẵn có; các view chỉ được thêm vào sheet khi bật móng cọc.
 * Toạ độ cm; cọc dài được thể hiện có đường cắt lìa, chiều dài thật ghi trong kích thước.
 */

import { type EngineProject, pileGrid, pileHoopLevels, pileMainOffsets } from '../engine';
import type { BarsResult, CadContext, PileConfig, Point2D, Project } from '../types/project';
import { dimRows, dot, noteCad, spacingList } from './dimCallout';
import { Ents } from './ents';
import { blindT, fmt } from './layers';
import { finishView, slabel } from './viewsCommon';

const TYPE_NAME: Record<PileConfig['type'], string> = {
  sq: 'cọc BTCT vuông đúc sẵn',
  rc: 'cọc BTCT tròn đặc đúc sẵn',
  phc: 'cọc ly tâm ứng lực trước',
  bored: 'cọc khoan nhồi',
};

const sizeText = (q: PileConfig): string =>
  q.type === 'sq'
    ? `${fmt(q.size * 1000)}x${fmt(q.size * 1000)}`
    : `D${fmt(q.size * 1000)}${q.type === 'phc' && q.wall > 0 ? `, t=${fmt(q.wall * 1000)}` : ''}`;

/** Có vẽ lồng thép / thống kê thép cọc hay không (cọc ly tâm là sản phẩm chế tạo sẵn). */
export const pileCageOn = (p: Project): boolean =>
  Boolean(p.pile && p.pile.on && p.pile.type !== 'phc' && p.pile.cage.nMain > 0);

/** Cắt đa giác theo nửa mặt phẳng y ≤ yc (Sutherland–Hodgman). */
function clipBelow(poly: readonly Point2D[], yc: number): Point2D[] {
  const out: Point2D[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const ain = a[1] <= yc + 1e-9;
    const bin = b[1] <= yc + 1e-9;
    if (ain) out.push([a[0], a[1]]);
    if (ain !== bin) {
      const t = (yc - a[1]) / (b[1] - a[1]);
      out.push([a[0] + (b[0] - a[0]) * t, yc]);
    }
  }
  return out;
}

/** Đường cắt lìa nằm ngang trên bề rộng cọc, dạng zig-zag. */
function breakMark(E: Ents, x0: number, x1: number, y: number, h: number): void {
  const w = x1 - x0;
  E.poly(
    [
      [x0 - w * 0.15, y],
      [x0 + w * 0.3, y],
      [x0 + w * 0.42, y + h],
      [x0 + w * 0.58, y - h],
      [x0 + w * 0.7, y],
      [x1 + w * 0.15, y],
    ],
    'THIN',
  );
}

export function viewPileSection(p: Project, res: BarsResult, ctx: CadContext): Ents {
  const E = new Ents();
  const { mm } = ctx;
  const g = res.g;
  const B = g.B;
  const q = p.pile as PileConfig;
  const grid = pileGrid(p as unknown as EngineProject, B);
  if (!grid) return E;

  // bản đáy (phần dưới) làm nền
  const yb = Math.max(p.tBase, g.tH, p.tTip);
  const slab = clipBelow(g.out, yb);
  if (slab.length >= 3) E.poly(slab, 'THIN', { closed: true });
  const tl = blindT(p);
  if (tl > 0) E.rect(0, -tl, B, 0, 'THIN');

  // chiều sâu thể hiện (cắt lìa khi cọc dài)
  const L = grid.L;
  const full = L <= 700;
  const Ltop = full ? L : 350;
  const Ltip = full ? 0 : 250;
  const gap = full ? 0 : 90;
  const yTipDraw = full ? -L : -(Ltop + gap + Ltip);
  const Y = (d: number): number | null => {
    if (full || d <= Ltop) return -d;
    if (d >= L - Ltip) return -(Ltop + gap + (d - (L - Ltip)));
    return null;
  };

  const xs = grid.rows.map((r) => r.x);
  const hw = grid.size / 2;
  const top = grid.embed;
  xs.forEach((x) => {
    if (full) {
      E.rect(x - hw, -L, x + hw, top, 'OUT');
    } else {
      E.rect(x - hw, -Ltop, x + hw, top, 'OUT');
      E.rect(x - hw, yTipDraw, x + hw, -(Ltop + gap), 'OUT');
      breakMark(E, x - hw, x + hw, -Ltop, mm(0.9));
      breakMark(E, x - hw, x + hw, -(Ltop + gap), mm(0.9));
    }
    E.line(x, top + mm(2), x, yTipDraw - mm(2), 'AXIS');
    if (grid.round && grid.wall > 0) {
      const wi = hw - grid.wall;
      E.line(x - wi, top, x - wi, full ? -L : -Ltop, 'HID');
      E.line(x + wi, top, x + wi, full ? -L : -Ltop, 'HID');
    }
  });

  // ranh giới các lớp đất và tên lớp
  let d = 0;
  q.layers.forEach((l, i) => {
    d += Math.max(0, l.thk) * 100;
    const y = Y(d);
    const xr = B + mm(3);
    if (y !== null && d < L - 1e-6) {
      E.line(-mm(2), y, B + mm(2), y, 'THIN');
    }
    const dm = d - Math.max(0, l.thk) * 50;
    const ym = Y(Math.min(dm, L));
    if (ym !== null && dm < L + 1e-6) {
      E.text(xr, ym - mm(0.8), `${i + 1}. ${l.name}`, mm(1.6), 'NOTE', { al: 'l' });
    }
  });

  const yTop = Math.max(yb, top);
  E.env = { x0: 0, y0: yTipDraw, x1: B, y1: yTop };
  const lvl = [{ lvl: 7.5, list: spacingList(xs, 0, B, (x) => [x, yTipDraw] as Point2D) }, { lvl: 13, list: [[[0, yTipDraw], [B, yTipDraw]] as [Point2D, Point2D]] }];
  dimRows(E, 'B', lvl, ctx);
  dimRows(
    E,
    'L',
    [
      {
        lvl: 7.5,
        list: [[[0, 0], [0, yTipDraw], fmt(L * 10)] as [Point2D, Point2D, string]],
      },
    ],
    ctx,
  );
  noteCad(
    E,
    [xs[xs.length - 1] + hw, -Math.min(L, Ltop) / 2],
    mm(10),
    0,
    `${TYPE_NAME[q.type]} ${sizeText(q)}, L = ${fmt(L / 100, 1)} m`,
    ctx,
  );

  finishView(E, 'Mặt cắt bố trí cọc', slabel(ctx) + `  –  ${grid.n} cọc / đơn nguyên`, ctx);
  return E;
}

export function viewPilePlan(p: Project, res: BarsResult, ctx: CadContext): Ents {
  const E = new Ents();
  const { mm } = ctx;
  const g = res.g;
  const B = g.B;
  const Lu = p.Lu;
  const q = p.pile as PileConfig;
  const grid = pileGrid(p as unknown as EngineProject, B);
  if (!grid) return E;

  E.rect(0, 0, Lu, B, 'OUT');
  [g.xbb, g.xft].forEach((x) => {
    if (Number.isFinite(x) && x > 0 && x < B) E.line(0, x, Lu, x, 'HID');
  });

  const hw = grid.size / 2;
  grid.pts.forEach(([x, z]) => {
    if (grid.round) {
      E.circ(z, x, hw, 'OUT');
      if (grid.wall > 0) E.circ(z, x, Math.max(0.5, hw - grid.wall), 'OUT');
    } else {
      E.rect(z - hw, x - hw, z + hw, x + hw, 'OUT');
    }
    const k = hw + mm(1.5);
    E.line(z - k, x, z + k, x, 'AXIS');
    E.line(z, x - k, z, x + k, 'AXIS');
  });

  E.env = { x0: 0, y0: 0, x1: Lu, y1: B };
  const row0 = grid.rows[0];
  dimRows(
    E,
    'T',
    [
      { lvl: 7.5, list: spacingList(row0.zs, 0, Lu, (z) => [z, B] as Point2D) },
      { lvl: 13, list: [[[0, B], [Lu, B]] as [Point2D, Point2D]] },
    ],
    ctx,
  );
  dimRows(
    E,
    'L',
    [
      { lvl: 7.7, list: spacingList(grid.rows.map((r) => r.x), 0, B, (y) => [0, y] as Point2D) },
      { lvl: 13, list: [[[0, 0], [0, B]] as [Point2D, Point2D]] },
    ],
    ctx,
  );
  finishView(
    E,
    'Mặt bằng bố trí cọc',
    slabel(ctx) +
      `  –  ${grid.n} cọc ${sizeText(q)}, bước ${fmt(q.sy * 1000)}${q.stagger ? ', so le' : ''}`,
    ctx,
  );
  return E;
}

export function viewPileCage(p: Project, res: BarsResult, ctx: CadContext): Ents {
  const E = new Ents();
  const { mm } = ctx;
  const q = p.pile as PileConfig;
  const grid = pileGrid(p as unknown as EngineProject, res.g.B);
  if (!grid) return E;
  const cg = q.cage;
  const S = grid.size;
  const cv = q.cover / 10;
  const dH = cg.dHoop / 10;
  const inset = cv + dH / 2;

  // ---- mặt cắt ngang
  if (grid.round) {
    E.circ(0, 0, S / 2, 'OUT');
    E.circ(0, 0, S / 2 - inset, 'REB');
  } else {
    E.rect(-S / 2, -S / 2, S / 2, S / 2, 'OUT');
    E.rect(-S / 2 + inset, -S / 2 + inset, S / 2 - inset, S / 2 - inset, 'REB');
  }
  pileMainOffsets(q).forEach(([dx, dz]) => dot(E, dx, dz, cg.dMain, ctx));
  E.env = { x0: -S / 2, y0: -S / 2, x1: S / 2, y1: S / 2 };
  dimRows(E, 'B', [{ lvl: 7.5, list: [[[-S / 2, -S / 2], [S / 2, -S / 2]] as [Point2D, Point2D]] }], ctx);
  noteCad(E, [S / 2 - inset, S / 2 - inset], mm(8), mm(6), `${cg.nMain}Φ${cg.dMain}`, ctx);
  noteCad(
    E,
    [-S / 2 + inset, 0],
    -mm(8),
    -mm(8),
    `Φ${cg.dHoop} a${fmt(cg.sEnd * 1000)}/${fmt(cg.sMid * 1000)}`,
    ctx,
  );

  // ---- mặt đứng (cắt lìa phần giữa)
  const L = q.L * 100;
  const Le = Math.min(Math.max(0, cg.Lend) * 100, L / 2);
  const zoneH = Math.min(Math.max(Le, 100), 200);
  const gap = 80;
  const full = L <= 2 * zoneH + gap;
  const x0 = S + mm(24);
  const x1 = x0 + S;
  const yTop = q.embed * 100;
  const yBot = full ? -L : -(2 * zoneH + gap);
  const levels = pileHoopLevels(q).map((m) => m * 100);
  const Yd = (d: number): number | null => {
    if (full) return -d;
    if (d <= zoneH) return -d;
    if (d >= L - zoneH) return -(zoneH + gap + (d - (L - zoneH)));
    return null;
  };
  if (full) {
    E.rect(x0, yBot, x1, yTop, 'OUT');
  } else {
    E.rect(x0, -zoneH, x1, yTop, 'OUT');
    E.rect(x0, yBot, x1, -(zoneH + gap), 'OUT');
    breakMark(E, x0, x1, -zoneH, mm(0.9));
    breakMark(E, x0, x1, -(zoneH + gap), mm(0.9));
  }
  // thép dọc
  const offs = pileMainOffsets(q);
  const xsMain = Array.from(new Set(offs.map((o) => Math.round(o[0] * 10) / 10))).sort((a, b) => a - b);
  const xc = (x0 + x1) / 2;
  xsMain.forEach((dx) => {
    if (full) E.poly([[xc + dx, yBot + cv], [xc + dx, yTop]], 'REB', { w: cg.dMain / 10 });
    else {
      E.poly([[xc + dx, -zoneH], [xc + dx, yTop]], 'REB', { w: cg.dMain / 10 });
      E.poly([[xc + dx, yBot + cv], [xc + dx, -(zoneH + gap)]], 'REB', { w: cg.dMain / 10 });
    }
  });
  // đai
  levels.forEach((d) => {
    const y = Yd(d);
    if (y === null) return;
    E.line(x0 + inset, y, x1 - inset, y, 'REB2');
  });

  E.env = { x0, y0: yBot, x1, y1: yTop };
  const rows: Array<[Point2D, Point2D, string?]> = [];
  rows.push([[x0, 0], [x0, -zoneH], `${fmt(Le * 10)} a${fmt(cg.sEnd * 1000)}`]);
  if (!full) {
    rows.push([[x0, -(zoneH + gap)], [x0, yBot], `${fmt(Le * 10)} a${fmt(cg.sEnd * 1000)}`]);
  }
  dimRows(E, 'L', [{ lvl: 7.5, list: rows }], ctx);
  noteCad(
    E,
    [x1, -zoneH / 2],
    mm(8),
    0,
    `Giữa cọc: Φ${cg.dHoop} a${fmt(cg.sMid * 1000)}`,
    ctx,
  );
  noteCad(E, [x1, yTop * 0.5], mm(8), mm(6), `L = ${fmt(L * 10)} (+${fmt(q.embed * 1000)} ngàm đài)`, ctx);

  finishView(
    E,
    'Chi tiết lồng thép cọc',
    slabel(ctx) + `  –  ${TYPE_NAME[q.type]} ${sizeText(q)}`,
    ctx,
  );
  return E;
}
