/**
 * Các hình vẽ và ký hiệu riêng của bộ bản vẽ theo kiểu bản mẫu VHGpro: tên hình màu xanh lá kèm dòng "Tỷ lệ 1:n",
 * mặt bằng hố ga nhìn từ trên (nét khuất xanh dương), ký hiệu mặt cắt hình tròn có mũi tên, chú thích có đường dẫn
 * và gạch chân, mặt bằng lưới thép tường, và các tờ "lớp thép" (mặt bằng một lớp thép kèm chuỗi kích thước, số hiệu tròn).
 * Hình học lấy từ cùng mô hình dùng cho bóc khối lượng nên số liệu luôn khớp bảng chiết tính.
 */
import { Builder, type Ent, type LayerName } from './ents';
import { circlePoly, fmtMm, gapsOf, lidDraw, neckOutline, rectPoly, subtractGaps, wallXY, type Ctx, type Pt, type View } from './views';
import { wallInnerLen } from '../engine/geometry';
import { parseDims, parseRebar } from '../engine/parse';
import { lidSlabs, spaced, tieGrid, wallPanels, type WallPanel } from '../engine/rebar';

/** Tên hình (xanh lá, 3 mm) và dòng tỷ lệ (2 mm) bên dưới — như khối TenMC của VHGpro. `y` là đường chuẩn của tên hình. */
export function figureTitle(b: Builder, cx: number, y: number, title: string): void {
  b.text('TIEUDE', cx, y, title, 3, 'c');
  b.text('TEXT', cx, y - b.paper(5.2), `Tỷ lệ 1:${b.s}`, 2, 'c');
}

/** Chú thích có đường dẫn: đoạn dẫn từ (px,py) tới (tx,ty), rồi đường gạch chân ngang chứa chữ (về phía `dir`). */
export function leaderNote(b: Builder, px: number, py: number, tx: number, ty: number, text: string, dir: 1 | -1 = 1, dot = false): void {
  const len = b.paper(1.8) + text.length * b.paper(2) * 0.55;
  b.line('NET', px, py, tx, ty);
  b.line('NET', tx, ty, tx + dir * len, ty);
  b.text('TEXT', dir === 1 ? tx + b.paper(0.8) : tx - b.paper(0.8), ty + b.paper(0.8), text, 2, dir === 1 ? 'l' : 'r');
  if (dot) b.circle('THEP', px, py, b.paper(0.35), true);
}

/** Ký hiệu mặt cắt: vòng tròn có chữ, tam giác đặc chỉ hướng nhìn (dir: l|r|u|d) và đoạn vạch cắt. */
export function sectionBubble(b: Builder, x: number, y: number, letter: string, dir: 'l' | 'r' | 'u' | 'd'): void {
  const r = b.paper(2.4);
  b.circle('KT', x, y, r);
  b.text('TEXT', x, y - b.paper(1), letter, 2.75, 'c', 0, true);
  const k = b.paper(2.2);
  const t = b.paper(1.6);
  const [ax, ay] = dir === 'l' ? [-1, 0] : dir === 'r' ? [1, 0] : dir === 'u' ? [0, 1] : [0, -1];
  const [px, py] = [-ay, ax];
  const base: Pt = [x + ax * r, y + ay * r];
  const tip: Pt = [x + ax * (r + k), y + ay * (r + k)];
  b.poly('KT', [tip, [base[0] + px * t, base[1] + py * t], [base[0] - px * t, base[1] - py * t]], true, true);
}

/** Đường kẻ đứt (zigzag) báo đoạn cống bị cắt ngắn, vuông góc hướng cống (u dọc theo p→q). */
function breakLine(b: Builder, p: Pt, q: Pt, layer: LayerName = 'CONG'): void {
  const mx = (p[0] + q[0]) / 2;
  const my = (p[1] + q[1]) / 2;
  const dx = q[0] - p[0];
  const dy = q[1] - p[1];
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const z = b.paper(1.2);
  const a: Pt = [mx - ux * b.paper(1.6), my - uy * b.paper(1.6)];
  const c: Pt = [mx + ux * b.paper(1.6), my + uy * b.paper(1.6)];
  b.poly(layer, [p, a, [a[0] + nx * z, a[1] + ny * z], [c[0] - nx * z, c[1] - ny * z], c, q], false);
}

/** Nắp gang tròn dạng ký hiệu (không sao chép khối của hãng): vành ngoài, vành trong, 8 rãnh cung, lưới ô và chốt giữa. */
function roundLidSymbol(b: Builder, cx: number, cy: number, r: number): void {
  b.circle('KC', cx, cy, r);
  b.circle('KC', cx, cy, r * 0.93);
  b.circle('KC', cx, cy, r * 0.66);
  for (let i = 0; i < 8; i++) {
    const a0 = (i * Math.PI) / 4 + 0.12;
    const a1 = ((i + 1) * Math.PI) / 4 - 0.12;
    const arc = (rr: number): Pt[] => Array.from({ length: 7 }, (_, k) => [cx + rr * Math.cos(a0 + ((a1 - a0) * k) / 6), cy + rr * Math.sin(a0 + ((a1 - a0) * k) / 6)] as Pt);
    b.poly('KC', [...arc(r * 0.86), ...arc(r * 0.74).reverse()], true);
  }
  b.hatchPat([circlePoly(cx, cy, r * 0.62)], 'ANSI37', 12);
  b.circle('KC', cx, cy, r * 0.1);
}

/* ================================================================== MẶT BẰNG HỐ GA (nhìn từ trên) */

export function planTop(c: Ctx, s: number): View {
  const b = new Builder(s);
  const { d, cfg, row } = c;
  // đường bao: bản đáy (ngoài cùng), thân/trần ga; nét khuất: mặt trong tường
  b.rect('KC', -d.bx, -d.by, d.bx, d.by);
  b.rect('KC', -d.ox, -d.oy, d.ox, d.oy);
  b.rect('LOT', -d.L / 2, -d.B / 2, d.L / 2, d.B / 2);
  const c5 = cfg.bottom.chamfer;
  if (c5 > 0) b.poly('THEP4', rectPoly(-d.L / 2 + c5, -d.B / 2 + c5, d.L / 2 - c5, d.B / 2 - c5), true);

  // cổ ga + nắp
  if (c.neck) {
    const n = c.neck;
    neckOutline(b, n, row.neck.t, 'KC');
    if (cfg.lid.type === 'Gang' && n.round) roundLidSymbol(b, n.cx, n.cy, n.a / 2 - 6);
    else lidDraw(c, b, n.cx, n.cy, n.a, n.b, n.round, row.neck.t, cfg.neck.chamfer ? (parseDims(cfg.neck.chamferSize)?.[0] ?? 0) : 0);
  } else {
    const sl = lidSlabs(row, cfg, c.info);
    if (sl) {
      const tc = cfg.wall.topChamfer.on ? parseDims(cfg.wall.topChamfer.size) : null;
      const ext = tc ? tc[0] : d.tw;
      for (let k = 0; k < sl.n; k++) {
        if (cfg.lid.dir === 'Dọc') {
          const x0 = -(d.L + 2 * ext) / 2 + (tc ? cfg.lid.gap : 0) + k * (sl.len + cfg.lid.gap);
          b.rect('KC', x0, -sl.wid / 2, x0 + sl.len, sl.wid / 2);
        } else {
          const y0 = -(d.B + 2 * ext) / 2 + (tc ? cfg.lid.gap : 0) + k * (sl.wid + cfg.lid.gap);
          b.rect('KC', -sl.len / 2, y0, sl.len / 2, y0 + sl.wid);
        }
      }
    }
  }

  // cống / rãnh xuyên tường: đoạn nhô ra (nét liền xanh dương), đoạn trong tường (nét khuất), tim cống, đầu cống có đường đứt
  const stub = 420;
  const pipeDims: { wall: number; ys: number[]; n: number }[] = [];
  for (const o of c.ops) {
    const i = o.wall;
    const nIn = i % 2 === 0 ? d.B / 2 : d.L / 2;
    const pc = (u: number, n: number): Pt => wallXY(i, o.uc + u, n);
    const half = o.outerW / 2;
    const bore = o.w / 2 - cfg.pipeHole.plaster;
    const nOut = nIn + d.tw + stub;
    for (const sg of [-1, 1]) {
      const a1 = pc(sg * half, nIn + d.tw);
      const a2 = pc(sg * half, nOut);
      b.line('CONG', a1[0], a1[1], a2[0], a2[1]);
      const e1 = pc(sg * bore, nIn + d.tw);
      const e2 = pc(sg * bore, nOut);
      b.line('CONG', e1[0], e1[1], e2[0], e2[1]);
      const h1 = pc(sg * bore, nIn);
      const h2 = pc(sg * bore, nIn + d.tw);
      b.line('LOT', h1[0], h1[1], h2[0], h2[1]);
    }
    breakLine(b, pc(-half, nOut), pc(half, nOut));
    const m1 = pc(0, nIn - b.paper(4));
    const m2 = pc(0, nOut + b.paper(4));
    b.line('TIM', m1[0], m1[1], m2[0], m2[1]);
    const cy = wallXY(i, o.uc, 0);
    const ys = i % 2 === 1 ? [cy[1] - half, cy[1] - bore, cy[1] + bore, cy[1] + half] : [cy[0] - half, cy[0] - bore, cy[0] + bore, cy[0] + half];
    pipeDims.push({ wall: i, ys, n: nOut });
  }

  // kích thước: chuỗi dưới (bản đáy – tường – lòng ga) và tổng; chuỗi phải; chuỗi theo vị trí cống
  const reach = (wall: number): number => (c.ops.some((o) => o.wall === wall) ? stub : 0);
  const yTop = Math.max(d.by, d.oy + reach(0));
  const yBot = Math.max(d.by, d.oy + reach(2));
  const xRight = Math.max(d.bx, d.ox + reach(1));
  const xLeft = Math.max(d.bx, d.ox + reach(3));
  const gy = -yBot - b.paper(8);
  const xs = [-d.bx, -d.ox, -d.L / 2, d.L / 2, d.ox, d.bx];
  for (let k = 0; k + 1 < xs.length; k++) b.dimH(xs[k], xs[k + 1], gy, -d.by, fmtMm(xs[k + 1] - xs[k]));
  b.dimH(-d.bx, d.bx, gy - b.paper(7), -d.by, fmtMm(2 * d.bx));
  const gx = xRight + b.paper(8);
  const ysr = [-d.by, -d.oy, -d.B / 2, d.B / 2, d.oy, d.by];
  for (let k = 0; k + 1 < ysr.length; k++) b.dimV(ysr[k], ysr[k + 1], gx, d.bx, fmtMm(ysr[k + 1] - ysr[k]));
  b.dimV(-d.by, d.by, gx + b.paper(7), d.bx, fmtMm(2 * d.by));
  for (const pd of pipeDims) {
    if (pd.wall % 2 === 0) continue; // chuỗi đứng chỉ cho cống trên tường T2/T4
    const sg = pd.wall === 1 ? 1 : -1;
    const x = sg * (pd.n + b.paper(6));
    const ysAll = [-d.B / 2, ...pd.ys, d.B / 2].sort((p, q) => p - q);
    for (let k = 0; k + 1 < ysAll.length; k++) if (ysAll[k + 1] - ysAll[k] > 1) b.dimV(ysAll[k], ysAll[k + 1], x, sg * (d.ox + stub), fmtMm(ysAll[k + 1] - ysAll[k]));
  }

  // ký hiệu mặt cắt: A-A (cắt ngang theo bề rộng ga) ở trên/dưới, B-B (cắt dọc theo chiều dài) ở hai bên
  sectionBubble(b, 0, yTop + b.paper(14), 'A', 'l');
  sectionBubble(b, 0, -yBot - b.paper(24), 'A', 'l');
  sectionBubble(b, -xLeft - b.paper(14), b.paper(-2), 'B', 'u');
  sectionBubble(b, xRight + b.paper(26), b.paper(-2), 'B', 'u');
  return { id: 'planTop', title: `MẶT BẰNG HỐ GA ${row.name}`, ents: b.ents };
}

/* ================================================================== MẶT BẰNG LƯỚI THÉP TƯỜNG */

export function wallMeshPlan(c: Ctx, s: number): View {
  const b = new Builder(s);
  const { d, cfg, row } = c;
  b.rect('KC', -d.bx, -d.by, d.bx, d.by);
  // lưới bản đáy lớp dưới (nét đứt xám) nhìn xuyên qua
  const low = parseRebar(row.bottom.low);
  const cb = cfg.cover.bottom;
  if (low) {
    const w = 2 * d.bx;
    const h = 2 * d.by;
    for (const p of spaced(h - 2 * cb, low.spacing, cfg.fmt.mesh, 2).pos) b.line('THEP4', -d.bx + cb, -d.by + cb + p, d.bx - cb, -d.by + cb + p);
    for (const p of spaced(w - 2 * cb, low.spacing, cfg.fmt.mesh, 2).pos) b.line('THEP4', -d.bx + cb + p, -d.by + cb, -d.bx + cb + p, d.by - cb);
  }
  // 4 tường × 2 lớp: mỗi lớp là một đoạn nét đứt tím dọc tường, các thanh đứng là chấm đỏ
  const panels = wallPanels(row, cfg, c.cat, c.info);
  const cw = cfg.cover.wall;
  const label = (i: number, layer: 'out' | 'in') => `T${i + 1} - ${layer === 'out' ? 'ngoài' : 'trong'}`;
  for (const P of panels) {
    const i = P.wall;
    const nIn = i % 2 === 0 ? d.B / 2 : d.L / 2;
    const n = P.layer === 'out' ? nIn + d.tw - cw : nIn + cw;
    const half = P.width / 2;
    const p = wallXY(i, -half + (P.layer === 'out' ? 0 : 0), n);
    const q = wallXY(i, half, n);
    b.line('THEP3', p[0], p[1], q[0], q[1]);
    for (const v of P.vert) {
      const t = wallXY(i, v.u, n);
      b.circle('THEP', t[0], t[1], Math.max(b.paper(0.45), 3), true);
    }
    // chú thích ở giữa tường, dẫn ra ngoài (lớp ngoài) hoặc vào trong (lớp trong)
    const mid = wallXY(i, 0, n);
    const out = P.layer === 'out';
    const dist = out ? b.paper(10 + 3 * (i % 2)) : b.paper(5);
    const lead = wallXY(i, 0, n + (out ? dist : -dist));
    const dirx = i === 1 ? 1 : i === 3 ? -1 : 1;
    if (i % 2 === 0) leaderNote(b, mid[0], mid[1], lead[0], lead[1] + (i === 0 ? 0 : 0), label(i, P.layer), dirx as 1 | -1);
    else leaderNote(b, mid[0], mid[1], lead[0], lead[1] + b.paper(i === 1 ? 4 : -4), label(i, P.layer), dirx as 1 | -1);
  }
  // kích thước tổng
  const gy = d.by + b.paper(8);
  b.dimH(-d.bx, d.bx, gy + b.paper(7), d.by, fmtMm(2 * d.bx));
  b.dimH(-d.ox, d.ox, gy, d.by, fmtMm(2 * d.ox));
  const gx = d.bx + b.paper(8);
  b.dimV(-d.oy, d.oy, gx, d.bx, fmtMm(2 * d.oy));
  b.dimV(-d.by, d.by, gx + b.paper(7), d.bx, fmtMm(2 * d.by));
  void gapsOf;
  void subtractGaps;
  void wallInnerLen;
  return { id: 'wallMesh', title: 'MẶT BẰNG LƯỚI THÉP TƯỜNG', ents: b.ents };
}

