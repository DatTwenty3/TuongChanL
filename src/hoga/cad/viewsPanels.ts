/**
 * Các hình "lớp thép" của bản vẽ theo kiểu VHGpro: mỗi hình là mặt bằng một lớp thép của bản đáy / trần hoặc mặt đứng
 * lớp thép của một tường — thanh đỏ, thép buộc là dấu X vàng, số hiệu thanh trong vòng tròn kèm Ø và bước,
 * chuỗi kích thước kiểu "12x146.4=1757" theo vị trí thanh. Dữ liệu lấy từ cùng bộ thanh dùng cho bảng chiết tính.
 */
import { Builder } from './ents';
import { circlePoly, fmtMm, rectPoly, type Ctx, type View } from './views';
import { parseRebar } from '../engine/parse';
import { spaced, tieGrid, wallPanels, type BarGroup } from '../engine/rebar';

/** Dấu X (thép buộc) tại (x, y), nửa cạnh `r`. */
function xMark(b: Builder, x: number, y: number, r: number): void {
  b.line('THEP2', x - r, y - r, x + r, y + r);
  b.line('THEP2', x - r, y + r, x + r, y - r);
}

/** Số hiệu thanh: đường dẫn từ vị trí thanh (bx,by) tới vòng tròn tâm (cx,cy), kèm "Ø.." và "@.." cạnh vòng tròn. */
function markBubble(b: Builder, bar: [number, number], at: [number, number], mark: string, dia: number, spacing: number | null, textSide: 1 | -1 = 1): void {
  const r = b.paper(2.8);
  b.line('NET', bar[0], bar[1], at[0], at[1]);
  b.circle('KT', at[0], at[1], r);
  b.text('TEXT', at[0], at[1] - b.paper(0.8), mark, 2, 'c');
  const tx = at[0] + textSide * (r + b.paper(1));
  b.text('TEXT', tx, at[1] + b.paper(0.5), `Ø${dia}`, 2, textSide === 1 ? 'l' : 'r');
  if (spacing) b.text('TEXT', tx, at[1] - b.paper(2.2), `@${Math.round(spacing)}`, 2, textSide === 1 ? 'l' : 'r');
}

/** Chuỗi kích thước theo vị trí các thanh: khoảng từ mép tới thanh đầu, các nhóm bước đều "nxS=T", khoảng từ thanh cuối tới mép. */
function barChain(b: Builder, kind: 'h' | 'v', coords: number[], lo: number, hi: number, pos: number, ref: number): void {
  const c = [...coords].sort((p, q) => p - q).filter((v, i, a) => i === 0 || v - a[i - 1] > 0.6);
  if (!c.length) return;
  const seg = (a: number, z: number, label: string) => (kind === 'h' ? b.dimH(a, z, pos, ref, label) : b.dimV(a, z, pos, ref, label));
  if (c[0] - lo > 0.5) seg(lo, c[0], fmtMm(c[0] - lo));
  let i = 0;
  while (i < c.length - 1) {
    const step = c[i + 1] - c[i];
    let j = i + 1;
    while (j + 1 < c.length && Math.abs(c[j + 1] - c[j] - step) < 0.6) j++;
    const n = j - i;
    seg(c[i], c[j], n > 1 ? `${n}x${step.toFixed(1)}=${Math.round(n * step)}` : fmtMm(step));
    i = j;
  }
  if (hi - c[c.length - 1] > 0.5) seg(c[c.length - 1], hi, fmtMm(hi - c[c.length - 1]));
}

const biggest = (gs: BarGroup[]): BarGroup | null => (gs.length ? gs.reduce((a, x) => (x.length * x.count > a.length * a.count ? x : a)) : null);
const pickGroup = (c: Ctx, part: string, re: RegExp): BarGroup | null => biggest(c.res.rebar.groups.filter((g) => g.part === part && re.test(g.label)));

/* ================================================================== BẢN ĐÁY / TRẦN – MỘT LỚP THÉP */

export function slabPanel(c: Ctx, s: number, part: 'bottom' | 'roof', layer: 'low' | 'up'): View {
  const b = new Builder(s);
  const { d, cfg, row } = c;
  const isBottom = part === 'bottom';
  const w = isBottom ? 2 * d.bx : 2 * d.ox;
  const h = isBottom ? 2 * d.by : 2 * d.oy;
  const cover = isBottom ? cfg.cover.bottom : cfg.cover.roof;
  const spec = parseRebar(isBottom ? (layer === 'low' ? row.bottom.low : row.bottom.up) : layer === 'low' ? row.roof.low : row.roof.up);
  const hole = !isBottom && c.neck ? c.neck : null;
  b.rect('KC', -w / 2, -h / 2, w / 2, h / 2);
  if (isBottom) {
    b.rect('LOT', -d.ox, -d.oy, d.ox, d.oy);
    b.rect('LOT', -d.L / 2, -d.B / 2, d.L / 2, d.B / 2);
  }
  if (hole) {
    if (hole.round) b.circle('KC', hole.cx, hole.cy, hole.a / 2);
    else b.rect('KC', hole.cx - hole.a / 2, hole.cy - hole.b / 2, hole.cx + hole.a / 2, hole.cy + hole.b / 2);
  }
  const holeHalf = (axisIsX: boolean, p: number): number => {
    if (!hole) return -1;
    if (hole.round) return Math.sqrt(Math.max(0, (hole.a / 2) ** 2 - (p - (axisIsX ? hole.cy : hole.cx)) ** 2));
    return Math.abs(p - (axisIsX ? hole.cy : hole.cx)) <= (axisIsX ? hole.b : hole.a) / 2 ? (axisIsX ? hole.a : hole.b) / 2 : -1;
  };
  const xs: number[] = [];
  const ys: number[] = [];
  if (spec) {
    const ex = isBottom ? 2 : 1;
    const ax = spaced(w - 2 * cover, spec.spacing, cfg.fmt.mesh, ex);
    const ay = spaced(h - 2 * cover, spec.spacing, cfg.fmt.mesh, ex);
    for (const p of ay.pos) {
      const y = -h / 2 + cover + p;
      ys.push(y);
      let segs: [number, number][] = [[-w / 2 + cover, w / 2 - cover]];
      const hh = holeHalf(true, y);
      if (hh > 0) segs = [[segs[0][0], hole!.cx - hh], [hole!.cx + hh, segs[0][1]]].filter(([a2, b2]) => b2 > a2) as [number, number][];
      for (const [a2, b2] of segs) b.line('THEP', a2, y, b2, y);
    }
    for (const p of ax.pos) {
      const x = -w / 2 + cover + p;
      xs.push(x);
      let segs: [number, number][] = [[-h / 2 + cover, h / 2 - cover]];
      const hh = holeHalf(false, x);
      if (hh > 0) segs = [[segs[0][0], hole!.cy - hh], [hole!.cy + hh, segs[0][1]]].filter(([a2, b2]) => b2 > a2) as [number, number][];
      for (const [a2, b2] of segs) b.line('THEP', x, a2, x, b2);
    }
  }
  // thép buộc: dấu X vàng
  const tieSpec = parseRebar(isBottom ? cfg.ties.bottom : cfg.ties.roof);
  if (tieSpec && spec) {
    const tw = w - 2 * cover;
    const th = h - 2 * cover;
    for (const [u, v] of tieGrid(tw, th, tieSpec.spacing, cfg.ties.stagger)) {
      const x = u;
      const y = -th / 2 + v;
      if (hole && holeHalf(true, y) > 0 && Math.abs(x - hole.cx) < holeHalf(true, y)) continue;
      xMark(b, x, y, b.paper(1.1));
    }
  }
  // số hiệu thanh
  const part2 = isBottom ? 'bottom' : 'roof';
  const nm = isBottom ? 'Đáy' : 'Trần';
  const lay = layer === 'low' ? 'dưới' : 'trên';
  const gX = pickGroup(c, part2, new RegExp(`^${nm} lớp ${lay} – phương X`));
  const gY = pickGroup(c, part2, new RegExp(`^${nm} lớp ${lay} – phương Y`));
  const gT = pickGroup(c, part2, new RegExp(`^${nm} – thép buộc`));
  if (gX && ys.length) markBubble(b, [-w / 2 + cover, ys[Math.min(2, ys.length - 1)]], [-w / 2 - b.paper(21), ys[Math.min(2, ys.length - 1)]], gX.mark, gX.dia, gX.step ?? spec?.spacing ?? null, 1);
  if (gY && xs.length) markBubble(b, [xs[1] ?? xs[0], -h / 2 + cover], [xs[1] ?? xs[0], -h / 2 - b.paper(19)], gY.mark, gY.dia, gY.step ?? spec?.spacing ?? null, 1);
  if (gT && tieSpec) markBubble(b, [w / 4, -h / 4], [w / 2 - b.paper(6), -h / 2 - b.paper(19)], gT.mark, gT.dia, gT.step ?? tieSpec.spacing, 1);
  // kích thước
  b.dimH(-w / 2, w / 2, h / 2 + b.paper(16), h / 2, fmtMm(w));
  barChain(b, 'h', xs, -w / 2, w / 2, -h / 2 - b.paper(9), -h / 2);
  b.dimV(-h / 2, h / 2, w / 2 + b.paper(16), w / 2, fmtMm(h));
  barChain(b, 'v', ys, -h / 2, h / 2, -w / 2 - b.paper(9), -w / 2);
  if (isBottom) {
    b.dimH(-d.ox, d.ox, h / 2 + b.paper(8), h / 2, fmtMm(2 * d.ox));
    b.dimV(-d.oy, d.oy, w / 2 + b.paper(8), w / 2, fmtMm(2 * d.oy));
  }
  void circlePoly;
  void rectPoly;
  return { id: `slab_${part}_${layer}`, title: `${isBottom ? 'BẢN ĐÁY' : 'TRẦN'} - LỚP ${layer === 'low' ? 'DƯỚI' : 'TRÊN'}`, ents: b.ents };
}

/* ================================================================== TƯỜNG – MỘT LỚP THÉP */

export function wallPanel(c: Ctx, s: number, wall: 0 | 1 | 2 | 3, layer: 'out' | 'in'): View | null {
  const P = wallPanels(c.row, c.cfg, c.cat, c.info).find((p) => p.wall === wall && p.layer === layer);
  if (!P) return null;
  const b = new Builder(s);
  const { d, cfg } = c;
  const W = P.width;
  const H = d.H;
  const Wo = (wall % 2 === 0 ? d.L : d.B) + 2 * d.tw;
  // mép tường và bản đáy phía dưới (nhô ra mỗi bên)
  b.rect('KC', -W / 2, 0, W / 2, H);
  b.rect('KC', -Wo / 2 - cfg.bottom.ext, -d.tb, Wo / 2 + cfg.bottom.ext, 0);
  for (const o of c.ops.filter((q) => q.wall === wall)) {
    if (o.round) b.poly('CONG', circlePoly(o.uc, o.z0 + o.h / 2, o.w / 2, 48), true);
    else b.rect('CONG', o.uc - o.w / 2, o.z0, o.uc + o.w / 2, o.z1);
  }
  for (const v of P.vert) b.line('THEP', v.u, v.z0, v.u, v.z1);
  for (const hz of P.horiz) b.line('THEP', hz.u0, hz.z, hz.u1, hz.z);
  for (const [u, z] of P.ties) xMark(b, u, z, b.paper(1.1));
  // số hiệu thanh
  const side = layer === 'out' ? 'ngoài' : 'trong';
  const gV = pickGroup(c, 'wall', new RegExp(`^Tường ${wall + 1} lớp ${side} – thép đứng`));
  const gH = pickGroup(c, 'wall', new RegExp(`^Tường ${wall + 1} lớp ${side} – thép ngang`));
  const gT = layer === 'out' ? pickGroup(c, 'wall', new RegExp(`^Tường ${wall + 1} – thép buộc`)) : null;
  const v1 = P.vert[Math.min(2, P.vert.length - 1)];
  const h1 = P.horiz[Math.min(2, P.horiz.length - 1)];
  if (gH && h1) markBubble(b, [h1.u0, h1.z], [-W / 2 - b.paper(20), h1.z], gH.mark, gH.dia, gH.step ?? P.stepH, 1);
  if (gV && v1) markBubble(b, [v1.u, v1.z0], [v1.u, -d.tb - b.paper(18)], gV.mark, gV.dia, gV.step ?? P.stepV, 1);
  if (gT && P.ties.length) markBubble(b, P.ties[P.ties.length - 1], [W / 2 - b.paper(8), -d.tb - b.paper(18)], gT.mark, gT.dia, gT.step ?? null, 1);
  // kích thước: tổng và chuỗi theo vị trí thanh
  b.dimH(-W / 2, W / 2, H + b.paper(8), H, fmtMm(W));
  barChain(b, 'h', P.vert.map((v) => v.u), -W / 2, W / 2, -d.tb - b.paper(9), -d.tb);
  b.dimV(-d.tb, H, W / 2 + b.paper(8), W / 2, fmtMm(H + d.tb));
  barChain(b, 'v', P.horiz.map((q) => q.z), 0, H, -W / 2 - b.paper(9), -W / 2);
  return { id: `wallPanel${wall}${layer}`, title: `TƯỜNG T${wall + 1} - LỚP ${side.toUpperCase()}`, ents: b.ents };
}
