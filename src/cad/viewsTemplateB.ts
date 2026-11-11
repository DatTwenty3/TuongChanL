import { barList } from '../engine';
import type { BarSpec, BarsResult, CadContext, Point2D, Project, QuantitiesResult } from '../types/project';
import {
  bar,
  barLines,
  callout,
  calloutMin,
  type CalloutOpts,
  type DimRowItem,
  dimRows,
  dot,
  dotR,
  wBar,
} from './dimCallout';
import { settleDots } from './dots';
import { Ents, mkBox } from './ents';
import { type BarSpecRuntime, blindOutline, fmt, unitW } from './layers';
import {
  ancLines,
  envSection,
  finishView,
  keyDepthDim,
  qtyGroups,
  ribCutBars,
  ribCutDims,
  ribCutNotes,
  ribOutline,
  slabel,
} from './viewsCommon';

const rb1 = (p: Project, k: 'a' | 'd' | 'n' | 'ah'): number => {
  const entry = p.rb.t1;
  if (!entry) return 0;
  const val = entry[k];
  return typeof val === 'number' ? val : 0;
};

interface ColumnCallSpec {
  pt: Point2D;
  dy: number;
  b: BarSpec;
  dmin: number;
  o: CalloutOpts & { colX?: number };
}

export function viewSectionRebarB(
  p: Project,
  res: BarsResult,
  ctx: CadContext,
  cut?: string,
): Ents {
  const E = new Ents();
  const g = res.g;
  const { mm } = ctx;
  const c = p.cover;
  const kd = g.key ? g.key.d : 0;
  const H = p.H;
  const t = g.t;
  const B = g.B;
  const rcut = cut === 'rib' && !!g.hyp;
  const by = (k: string): BarSpecRuntime | undefined =>
    res.bars.find((b) => b.key === k) as BarSpecRuntime | undefined;

  const h1 = by('h1');
  const l1 = by('l1');
  const t1 = by('t1');
  const t1b = by('t1b');
  const s1 = by('s1');
  const s2 = by('s2');
  const b1 = by('b1');
  const b2 = by('b2');
  const k1 = by('k1');

  E.poly(rcut ? ribOutline(p, g) : g.out, 'OUT', { closed: true });
  if (p.type === 'rib' && g.hyp) E.poly([g.hyp.T, g.hyp.E], rcut ? 'OUT' : 'HID');
  [s1, s2, b1, b2, k1].forEach((b) => {
    if (b) bar(E, b.path, b.d, ctx);
  });
  const an = by('an');
  if (an) ancLines(E, an as unknown as BarSpec, ctx);

  const tk = mm(1.2);
  const tick = (x: number, y: number): void => {
    E.line(x - tk, y - tk, x + tk, y + tk, 'LEAD');
  };

  if (t1 && t1.rows && t1.rows.length) {
    const rs = t1.rows.slice().sort((u, v) => u - v);
    const tk6 = rs.length > 1 ? rs.slice(0, -1) : rs;
    const yt = tk6[tk6.length - 1];
    const x1 = g.xbb - c;
    const xd = x1 - 0.55 * (x1 - (g.xf(yt) + c));
    t1.rows.forEach((y) =>
      E.poly(
        [
          [g.xf(y) + c, y],
          [x1, y],
        ],
        'REB',
        { w: wBar(t1.d, ctx) },
      ),
    );
    tk6.forEach((y) => tick(xd, y));
    E.line(xd, tk6[0], xd, yt, 'LEAD');
  }
  if (t1b && t1b.xsT && t1b.xsT.length) {
    t1b.xsT.forEach((x) =>
      E.poly(
        [
          [x, c],
          [x, g.topY(x) - c],
        ],
        'REB',
        { w: wBar(t1b.d, ctx) },
      ),
    );
    const y = p.tBase * 0.6;
    const xa = t1b.xsT[0];
    const xb = t1b.xsT[t1b.xsT.length - 1];
    if (xb > xa) E.line(xa, y, xb, y, 'LEAD');
    t1b.xsT.forEach((x) => tick(x, y));
  }

  const dotPts = (b: BarSpecRuntime | undefined): Point2D[] =>
    b && b.pts
      ? b.pts.map((item) => {
          const q = Array.isArray(item) ? item : [item.x, item.y, 0, 0];
          const rd = dotR(b.d, ctx);
          const k = rd - b.d / 20;
          let x = q[0] + k * (q[2] || 0);
          if (q[4] != null && q[5] != null) {
            const need = rd + q[5] / 20 + 0.05;
            if (Math.abs(x - q[4]) < need) x = q[4] + (x < q[4] ? -1 : 1) * need;
          }
          return [x, q[1] + k * (q[3] || 0)] as Point2D;
        })
      : [];

  const h1p = dotPts(h1);
  const l1p = dotPts(l1);
  if (h1) h1p.forEach((q) => dot(E, q[0], q[1], h1.d, ctx));
  if (l1) l1p.forEach((q) => dot(E, q[0], q[1], l1.d, ctx));
  if (rcut) ribCutBars(E, p, res, ctx);
  settleDots(E, ctx);

  if (p.H > 200 && !rcut) {
    const yj = p.tBase + 115;
    const x0 = g.xf(yj);
    const x1 = g.xb(yj);
    E.line(x0, yj, x1, yj, 'LEAD');
    E.text(x0 - mm(4), yj - mm(0.8), 'cj', mm(2), 'LBL', { al: 'c', wf: 0.7 });
    E.text(x1 + mm(4), yj - mm(0.8), 'cj', mm(2), 'LBL', { al: 'c', wf: 0.7 });
  }
  const bo = blindOutline(p, g);
  if (bo) E.poly(bo, 'THIN');
  E.env = envSection(p, g);
  keyDepthDim(E, g, ctx);
  if (rcut) ribCutNotes(E, p, res, ctx);

  const lbl = (b: BarSpec): string[] => barLines(b, p);
  const mk = (b: BarSpec): string => String(b.mark);
  const yAt = (f: number): number => g.yTop - f * H;

  [0, c, B - c, B, ...(g.key ? [g.key.x0, g.key.x1] : [])].forEach((x) =>
    (E.chn = E.chn || []).push(
      mkBox(x - mm(0.3), -Math.max(kd, g.dxt || 0) - mm(7), x + mm(0.3), 0, { o: 'v' }),
    ),
  );

  const Ls: ColumnCallSpec[] = [];
  const Rs: ColumnCallSpec[] = [];
  const push = (
    arr: ColumnCallSpec[],
    pt: Point2D,
    dy: number,
    b: BarSpecRuntime | undefined,
    dmin: number,
    o: CalloutOpts = {},
  ): void => {
    if (b) arr.push({ pt, dy, b: b as unknown as BarSpec, dmin, o });
  };

  if (h1 && h1p.length) {
    const q = h1p
      .filter((v) => v[0] < g.xbb - 2 * c && v[1] > p.tBase + 5)
      .sort((u, v) => Math.abs(u[1] - yAt(0.37)) - Math.abs(v[1] - yAt(0.37)));
    push(Ls, q[0] || h1p[0], 0, h1, 14, { ring: true });
  }
  {
    const y = yAt(0.62);
    push(
      Ls,
      [g.xf(y) + c, y],
      0,
      s2,
      14,
      rcut
        ? { slide: (yy) => (yy > p.tBase + 25 && yy < g.yTop - 15 ? [g.xf(yy) + c, yy] : null) }
        : {},
    );
  }
  const x4 = Math.max(c + 5, 0.8 * t);
  const ty4 = g.topY(x4);
  push(Ls, [x4, ty4 - c], ty4 + mm(6.4) - (ty4 - c), b2, 11.5);
  push(Ls, [x4, c], -mm(4.9) - c, b1, 11.5);
  push(
    Rs,
    [g.xbb - c, yAt(0.34)],
    0,
    s1,
    16,
    rcut ? { slide: (yy) => (yy > p.tBase + 25 && yy < g.yTop - 15 ? [g.xbb - c, yy] : null) } : {},
  );
  if (t1 && t1.rows && t1.rows.length) {
    const hs = (E.chn || []).filter(
      (q) => (q as unknown as { o?: string }).o === 'h' && q.x0 >= B - 1,
    );
    const clr = (y: number): boolean => hs.every((q) => Math.abs(y - (q.y0 + q.y1) / 2) > mm(3.6));
    const rs = t1.rows.slice().sort((u, v) => Math.abs(u - yAt(0.6)) - Math.abs(v - yAt(0.6)));
    const y = rcut ? (rs.find(clr) !== undefined ? rs.find(clr)! : rs[0]) : rs[0];
    push(
      Rs,
      [g.xbb - c, y],
      0,
      Object.assign({}, t1, { n: 0 }),
      16,
      rcut
        ? {
            slide: (yy) => (rs.some((r) => Math.abs(r - yy) < 1e-6) ? [g.xbb - c, yy] : null),
            ys: rs.filter(clr).concat(rs.filter((r) => !clr(r))),
          }
        : {},
    );
  }
  if (t1b && t1b.xsT && t1b.xsT.length) {
    const x = t1b.xsT.find((v) => v > g.xbb + 20) || t1b.xsT[t1b.xsT.length - 1];
    const ty = g.topY(x);
    push(
      Rs,
      [x, ty - c],
      ty + mm(7.2) - (ty - c),
      Object.assign({}, t1b, { n: 0 }),
      11.5,
      rcut ? { diag: 1 } : {},
    );
  }
  if (k1 && g.key) push(Rs, [g.key.x1 - c, -0.62 * kd], 0, k1, 14);
  if (an && an.A && an.A.xs.length) {
    push(Rs, [an.A.xs[an.A.xs.length - 1], -0.6 * an.A.Lb], 0, an, 14);
  }

  const labelOf = (s: ColumnCallSpec): string[] =>
    s.b.key === 't1' || s.b.key === 't1b'
      ? [`${p.labelUnit}${s.b.d}`, `a=${fmt(rb1(p, 'a') * 10)}`]
      : lbl(s.b);

  const column = (arr: ColumnCallSpec[], sgn: number): void => {
    if (!arr.length) return;
    const need = arr.map((s) => Math.max(mm(s.dmin), calloutMin(labelOf(s), mk(s.b), ctx)));
    let col =
      sgn < 0
        ? Math.min(...arr.map((s, i) => s.pt[0] - need[i]))
        : Math.max(...arr.map((s, i) => s.pt[0] + need[i]));
    if (sgn > 0 && p.type === 'rib') {
      col = Math.max(
        col,
        B + mm(1.5) + Math.max(...arr.map((s) => calloutMin(labelOf(s), mk(s.b), ctx))),
      );
    }
    arr.forEach((s) =>
      callout(
        E,
        s.pt,
        col - s.pt[0],
        s.dy,
        labelOf(s),
        mk(s.b),
        ctx,
        rcut ? Object.assign({ reb: true }, s.o, s.o.slide ? { colX: col } : {}) : s.o,
      ),
    );
  };
  column(Ls, -1);
  column(Rs, 1);

  dimRows(
    E,
    'B',
    [
      ...(g.key
        ? [{ lvl: 3, list: [[[g.key.x0, -kd], [g.key.x1, -kd], undefined, { cut: 1 }] as DimRowItem<Point2D>] }]
        : []),
      {
        lvl: 6.5,
        list: [
          [
            [0, 0],
            [c, 0],
          ],
          [
            [c, 0],
            [B - c, 0],
          ],
          [
            [B - c, 0],
            [B, 0],
          ],
        ],
      },
    ],
    ctx,
  );
  dimRows(
    E,
    'L',
    [
      {
        lvl: 6.5,
        list: [
          [
            [0, 0],
            [0, c],
          ],
          [
            [0, c],
            [0, p.tTip - c],
          ],
          [
            [0, p.tTip - c],
            [0, p.tTip],
          ],
        ],
      },
      {
        lvl: 12,
        list: [
          [
            [0, 0],
            [0, p.tTip],
          ],
          p.tBase > p.tTip + 1e-6
            ? [
                [0, p.tTip],
                [0, p.tBase],
              ]
            : null,
          [
            [0, p.tBase],
            [0, g.yTop],
          ],
        ],
      },
    ],
    ctx,
  );
  dimRows(
    E,
    'T',
    [
      {
        lvl: 2.9,
        list: [
          [[g.xft, g.yTop], [g.xft + c, g.yTop], undefined, { cut: 1 }],
          [[g.xbt - c, g.yTop], [g.xbt, g.yTop], undefined, { cut: 1 }],
        ],
      },
      { lvl: 5.5, list: [[[g.xft, g.yTop], [g.xbt, g.yTop], undefined, { cut: 1 }]] },
    ],
    ctx,
  );
  if (rcut) ribCutDims(E, p, res, ctx, 7.7);
  finishView(
    E,
    rcut ? 'Cốt thép tường sườn' : `Chi tiết tường chắn bê tông cốt thép H=${fmt(p.H / 100)}m`,
    slabel(ctx),
    ctx,
  );
  return E;
}

export function viewBarTableB(
  p: Project,
  res: BarsResult,
  q: QuantitiesResult,
  ctx: CadContext,
): Ents {
  const E = new Ents();
  const { mm } = ctx;
  const cols = [14, 17, 24, 17, 22, 22, 24];
  const RH = 6.5;
  const HH = 14;
  const X = (v: number): number => mm(v);
  const Y = (v: number): number => -mm(v);
  const list = barList(res);
  const hdr = [
    ['TÊN', 'THANH'],
    ['ĐƯỜNG', 'KÍNH', '(mm)'],
    ['CHIỀU DÀI', '1 THANH', '(mm)'],
    ['SỐ', 'LƯỢNG', '(thanh)'],
    ['TỔNG', 'CHIỀU DÀI', '(m)'],
    ['TRỌNG', 'LƯỢNG', '(kg/m)'],
    ['KHỐI', 'LƯỢNG', '(kg)'],
  ];
  const W = cols.reduce((s, v) => s + v, 0);
  const xs = [0];
  cols.forEach((w) => xs.push(xs[xs.length - 1] + w));
  const nf = (v: number, d = 2): string => v.toFixed(d).replace('.', ',');
  const ni = (v: number): string => String(Math.round(v));
  const g1 = list.filter((b) => b.d > 10 && b.d <= 18).reduce((s, b) => s + (b.kg || 0), 0);
  const g2 = list.filter((b) => b.d > 18).reduce((s, b) => s + (b.kg || 0), 0);
  const g0 = list.filter((b) => b.d <= 10).reduce((s, b) => s + (b.kg || 0), 0);
  const U = p.labelUnit;
  const tot: Array<[string, number]> = [
    [`10< ${U} <=18`, g1],
    [`${U} >18`, g2],
  ];
  if (g0 > 0) tot.unshift([`${U} <=10`, g0]);
  const QG = qtyGroups(p, q);
  const nq = QG.reduce((s, gr) => s + gr.rows.length, 0) + 1;
  const H = HH + (list.length + tot.length + nq) * RH;
  const y0 = 12;

  E.text(X(W / 2), Y(0), 'KHỐI LƯỢNG TƯỜNG CHẮN', mm(3.2), 'NOTE', { al: 'c' });
  E.text(X(W / 2), Y(5), `(TÍNH CHO ${fmt(p.Lu / 100)}M DÀI TƯỜNG CHẮN)`, mm(2.4), 'NOTE', {
    al: 'c',
  });
  E.rect(X(0), Y(y0), X(W), Y(y0 + H), 'TBL');
  xs.slice(1, -1).forEach((x) =>
    E.line(X(x), Y(y0), X(x), Y(y0 + H - (tot.length + nq) * RH), 'TBL'),
  );
  E.line(X(0), Y(y0 + HH), X(W), Y(y0 + HH), 'TBL');
  hdr.forEach((ls, i) =>
    ls.forEach((s, j) =>
      E.text(
        X(xs[i] + cols[i] / 2),
        Y(y0 + HH / 2 + (j - (ls.length - 1) / 2) * 3.3),
        s,
        mm(2.1),
        'NOTE',
        { al: 'c', va: 'm', raw: true },
      ),
    ),
  );
  list.forEach((b, i) => {
    const yc = y0 + HH + i * RH + RH / 2;
    E.line(X(0), Y(y0 + HH + (i + 1) * RH), X(W), Y(y0 + HH + (i + 1) * RH), 'TBL');
    const cell = (c: number, s: string | number): void => {
      E.text(X(xs[c] + cols[c] / 2), Y(yc), String(s), mm(2.3), 'NOTE', { al: 'c', va: 'm' });
    };
    const minL = b.minL ?? 0;
    const maxL = b.maxL ?? minL;
    cell(0, b.mark);
    cell(1, b.d);
    cell(
      2,
      minL === maxL
        ? ni(minL)
        : ni(b.items.reduce((s, v) => s + v, 0) / Math.max(1, b.items.length)),
    );
    cell(3, b.count ?? b.items.length);
    cell(4, nf(b.totLen ?? 0));
    cell(5, nf(unitW(b.d)));
    cell(6, nf(b.kg ?? 0));
  });
  tot.forEach((r, i) => {
    const yt = y0 + HH + list.length * RH + i * RH;
    const yc = yt + RH / 2;
    E.line(X(i ? xs[2] : 0), Y(yt), X(W), Y(yt), 'TBL');
    E.line(X(xs[2]), Y(yt), X(xs[2]), Y(yt + RH), 'TBL');
    E.line(X(xs[6]), Y(yt), X(xs[6]), Y(yt + RH), 'TBL');
    if (i === 0) {
      E.text(X(xs[2] / 2), Y(yc + ((tot.length - 1) * RH) / 2), 'TỔNG CỘNG', mm(2.3), 'NOTE', {
        al: 'c',
        va: 'm',
      });
    }
    E.text(X((xs[2] + xs[6]) / 2), Y(yc), r[0], mm(2.3), 'NOTE', { al: 'c', va: 'm' });
    E.text(X((xs[6] + xs[7]) / 2), Y(yc), nf(r[1]), mm(2.3), 'NOTE', { al: 'c', va: 'm' });
  });
  let yq = y0 + HH + (list.length + tot.length) * RH;
  const txtCell = (x: number, yc: number, s: string, bold?: boolean): void => {
    E.text(X(x), Y(yc), s, mm(2.3), 'NOTE', { al: 'c', va: 'm', bold, raw: true });
  };
  const row = (first: boolean, name: string, val: string, bold: boolean, merged = false): void => {
    const yc = yq + RH / 2;
    E.line(X(first ? 0 : xs[2]), Y(yq), X(W), Y(yq), 'TBL');
    E.line(X(xs[6]), Y(yq), X(xs[6]), Y(yq + RH), 'TBL');
    if (!merged) E.line(X(xs[2]), Y(yq), X(xs[2]), Y(yq + RH), 'TBL');
    if (name) txtCell((merged ? xs[0] + xs[6] : xs[2] + xs[6]) / 2, yc, name, bold);
    txtCell((xs[6] + xs[7]) / 2, yc, val, bold);
    yq += RH;
  };
  QG.forEach((gr) => {
    if (gr.rows.length === 1) {
      row(true, gr.label.join(' '), nf(gr.rows[0][1]), false, true);
      return;
    }
    const y1 = yq;
    gr.rows.forEach((r, i) => row(i === 0, r[0], nf(r[1]), r[0] === 'Cộng'));
    gr.label.forEach((s, j) =>
      txtCell(xs[2] / 2, (y1 + yq) / 2 + (j - (gr.label.length - 1) / 2) * 3.3, s),
    );
  });
  row(true, 'Hàm lượng thép / bê tông (kg/m³)', nf(q.ratio, 1), false, true);
  return E;
}
