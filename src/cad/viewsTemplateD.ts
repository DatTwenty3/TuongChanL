import { isD } from '../engine';
import type { BarSpec, BarsResult, CadContext, Point2D, Project } from '../types/project';
import {
  bar,
  barLines,
  bigGap,
  calloutAH,
  type CalloutAHOpts,
  chainNote,
  dimBand,
  dimRaw,
  dimRows,
  type DimRowSpec,
  dot,
  freeGap,
  midGap,
  noteCad,
  spacingList,
  wBar,
} from './dimCallout';
import { settleDots } from './dots';
import { Ents, mkBox } from './ents';
import {
  ancBarOf,
  type BarSpecRuntime,
  blindOutline,
  blindT,
  DIMSTY,
  distr,
  dRingXs,
  fmt,
  textW,
} from './layers';
import {
  finishView,
  ribBreaks,
  ribOutline,
  secH,
  secSym,
  slabel,
  viewElevation,
} from './viewsCommon';

export const dTxt = (b: BarSpec, p: Project): string =>
  `${b.mark}-${p.labelUnit}${b.d}${b.a ? '-' + fmt(b.a * 10) : ''}`;

export const samePos = (a?: number[], b?: number[]): boolean =>
  !!a && !!b && a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-6);

export const uniq = (a: number[]): number[] =>
  [...new Set(a.map((v) => +v.toFixed(3)))].sort((u, v) => u - v);

type DLabCand = [Point2D, 1 | -1, number, CalloutAHOpts?];

export function dLab(
  E: Ents,
  ctx: CadContext,
  txt: string,
  cands: DLabCand[],
  base?: CalloutAHOpts,
): boolean {
  const mk = (o?: CalloutAHOpts): CalloutAHOpts =>
    Object.assign({ dots: true, reb: true, txtReb: true }, base || {}, o || {});
  for (const [pt, sg, up, o] of cands) {
    const op = mk(o);
    if (calloutAH(E, pt, sg, up, txt, '', ctx, Object.assign({ dry: true }, op))) {
      calloutAH(E, pt, sg, up, txt, '', ctx, op);
      return true;
    }
  }
  const [pt, sg, up, o] = cands[0];
  calloutAH(E, pt, sg, up, txt, '', ctx, mk(o));
  return false;
}

export const nearBy = <T>(arr: T[], y: number, f: (v: T) => number): T =>
  arr.reduce((m, q) => (Math.abs(f(q) - y) < Math.abs(f(m) - y) ? q : m), arr[0]);

export const dPvcY = (p: Project): number =>
  p.tBase + Math.min(200, Math.max(60, Math.round((p.H * 0.33) / 10) * 10));

export const dPvcXs = (p: Project): number[] => {
  const a = (p.pvc && p.pvc.a) || 150;
  return distr(p.Lu, a, a / 2);
};

export function viewSectionD(p: Project, res: BarsResult, ctx: CadContext): Ents {
  const E = new Ents();
  const g = res.g;
  const { mm } = ctx;
  const B = g.B;
  const tB = p.tBase;
  const yT = g.yTop;
  const tl = blindT(p);
  const k1 = res.bars.find((b) => b.key === 'k1');
  const ancH = k1 && k1.A ? k1.A.Lb : 0;
  const vt = Math.min(p.vtop || 0, p.H - 1);
  const SL = 0.2;
  const st0 = 20;
  const xe = (y: number): number => B + st0 + SL * y;
  const xt = (y: number): number => -st0 - SL * y;

  E.poly(g.out, 'OUT', { closed: true });
  const bo = blindOutline(p, g);
  if (bo) E.poly(bo, 'THIN');
  if (g.hyp) E.poly([g.hyp.T, g.hyp.E], 'HID');
  if (k1 && k1.A) {
    k1.A.xs.forEach((x) =>
      E.poly(
        [
          [x, -ancH],
          [x, k1.A!.Lc],
        ],
        'REB',
        { w: wBar(k1.d, ctx) },
      ),
    );
  }
  E.poly(
    [
      [B, 0],
      [B + st0, 0],
      [xe(yT), yT],
    ],
    'THIN',
  );
  E.poly(
    [
      [0, 0],
      [-st0, 0],
      [xt(tB), tB],
      [0, tB],
    ],
    'THIN',
  );
  const xl = xe(yT) + 100;
  E.poly(
    [
      [g.xbt, yT],
      [xl, yT],
    ],
    'CDTK',
  );
  const ang = (Math.atan2(yT, SL * yT) * 180) / Math.PI;
  const ar = (ang * Math.PI) / 180;
  const fill = {
    x: (g.xbt + xe(yT)) / 2 - mm(0.5),
    y: g.hyp ? Math.max(g.yR + 0.12 * (yT - g.yR), yT - 0.28 * (yT - tB)) : yT - 0.3 * (yT - tB),
  };
  E.text(fill.x, fill.y, 'Đắp vật liệu dạng hạt', mm(2), 'NOTE', { al: 'c' });
  E.lbl.push(
    mkBox(
      fill.x - textW('Đắp vật liệu dạng hạt', mm(2)) / 2,
      fill.y - mm(0.5),
      fill.x + textW('Đắp vật liệu dạng hạt', mm(2)) / 2,
      fill.y + mm(3),
    ),
  );
  E.text(xl - mm(1), yT + mm(1.2), 'CĐ thiết kế (đỉnh tường)', mm(2), 'NOTE', { al: 'r' });
  E.lbl.push(
    mkBox(xl - mm(1) - textW('CĐ thiết kế (đỉnh tường)', mm(2)), yT, xl, yT + mm(4)),
  );
  {
    const y0 = yT * 0.42;
    const x0 = xe(y0);
    const lab = '1:0,2';
    const tw = textW(lab, mm(2));
    const ox = -mm(1.6) * Math.sin(ar);
    const oy = mm(1.6) * Math.cos(ar);
    E.text(x0 - ox, y0 + oy, lab, mm(2), 'NOTE', { al: 'c', rot: -(180 - ang) });
    E.lbl.push(mkBox(x0 - tw / 2 - mm(2), y0 - mm(3.5), x0 + tw / 2 + mm(2), y0 + mm(3.5)));
  }
  {
    const pv = p.pvc || { d: 60, a: 150 };
    const yp = dPvcY(p);
    const r = Math.max(1.5, (pv.d || 60) / 20);
    const xb0 = g.xb(yp);
    const xf0 = g.xf(yp);
    const x1 = xf0 - 16;
    const sl = 0.04;
    const xs = xb0 + 15;
    const ys = yp;
    E.poly(
      [
        [xs, ys + r],
        [x1, ys + r - sl * (xs - x1)],
      ],
      'THIN',
    );
    E.poly(
      [
        [xs, ys - r],
        [x1, ys - r - sl * (xs - x1)],
      ],
      'THIN',
    );
    E.poly(
      [
        [xs, ys + r],
        [xs, ys - r],
      ],
      'THIN',
    );
    E.poly(
      [
        [x1, ys + r - sl * (xs - x1)],
        [x1, ys - r - sl * (xs - x1)],
      ],
      'THIN',
    );
    noteCad(
      E,
      [x1, ys - sl * (xs - x1)],
      -mm(7),
      mm(6.5),
      `Ống PVC ${p.labelUnit}${pv.d || 60} @${fmt((pv.a || 150) / 100, 2)}m/1 ống`,
      ctx,
    );
  }
  if (g.hyp) {
    const m: Point2D = [(g.hyp.T[0] + g.hyp.E[0]) / 2, (g.hyp.T[1] + g.hyp.E[1]) / 2];
    const txt = `Sườn dày ${fmt(p.rib.t * 10)}, cao ${fmt((g.yR - tB) * 10)}`;
    const tw = textW(txt, mm(2));
    E.text(m[0] - mm(3), m[1] - mm(4), txt, mm(2), 'NOTE', { al: 'r' });
    E.lbl.push(mkBox(m[0] - mm(3) - tw, m[1] - mm(4.5), m[0] - mm(3), m[1] - mm(1)));
  }
  if (k1 && k1.A) {
    const tx = k1.A.xs[k1.A.xs.length - 1];
    noteCad(
      E,
      [tx, -ancH * 0.7],
      Math.max(mm(6), B - tx + mm(3)),
      -mm(8),
      `Neo ${p.labelUnit}${k1.d} @${fmt((k1.a || 0) * 10)}×${fmt((k1.a || 0) * 10)}, L=${fmt(k1.A.L * 10)}`,
      ctx,
    );
  }
  E.env = { x0: xt(tB), y0: -Math.max(ancH, tl), x1: xe(yT), y1: yT };
  if (tl > 0) {
    noteCad(
      E,
      [B - mm(0.8), -tl / 2],
      mm(7),
      -mm(7),
      `Bê tông lót M100 dày ${fmt(tl * 10)}mm`,
      ctx,
    );
  }
  if (vt > 0) {
    const st = ctx.dst || DIMSTY.B;
    const asz = mm(st.asz);
    const x = g.xbt + mm(5.5);
    const y1 = yT;
    const y2 = yT - vt;
    dimRaw(E, [g.xbt, y1], [g.xbt, y2], [x, y1], [x, y2], undefined, ctx, { sh: 1 });
    const tw = textW(fmt(vt * 10), mm(st.txt)) * (st.wf || 1);
    const arrIn = vt >= tw + 2 * asz;
    const txtIn = vt >= tw + mm(0.8);
    let a = y2;
    let b = y1;
    if (!arrIn) {
      a -= 2 * asz;
      b += 2 * asz;
    }
    if (!txtIn) {
      const c0 = (y1 + y2) / 2 + (vt / 2 + tw / 2 + (arrIn ? mm(0.8) : 2.2 * asz));
      a = Math.min(a, c0 - tw / 2);
      b = Math.max(b, c0 + tw / 2);
    }
    (E.dz = E.dz || []).push(dimBand(true, x, a, b, mm));
  }
  dimRows(
    E,
    'B',
    [
      {
        lvl: 7.5,
        list: [
          [
            [0, 0],
            [g.t, 0],
          ],
          [
            [g.t, 0],
            [g.xbb, 0],
          ],
          [
            [g.xbb, 0],
            [B, 0],
          ],
        ],
      },
      {
        lvl: 13,
        list: [
          [
            [0, 0],
            [B, 0],
          ],
        ] as DimRowSpec['list'],
      },
    ],
    ctx,
  );
  dimRows(
    E,
    'L',
    [
      {
        lvl: 7.7,
        list: [
          [
            [0, 0],
            [0, tB],
          ],
          [
            [0, tB],
            [0, yT],
          ],
        ],
      },
      {
        lvl: 13,
        list: [
          [
            [0, 0],
            [0, yT],
          ],
        ],
      },
    ],
    ctx,
  );
  dimRows(
    E,
    'T',
    [{ lvl: 6.9, list: [[[g.xft, yT], [g.xbt, yT], undefined, { cut: 4.4, sh: 1 }]] }],
    ctx,
  );
  finishView(E, `Cấu tạo tường chắn H = ${fmt(p.H / 100, 2)} m`, slabel(ctx), ctx);
  return E;
}

export function viewElevationD(p: Project, res: BarsResult, ctx: CadContext): Ents {
  const E = viewElevation(p, res, ctx);
  const { mm } = ctx;
  const pv = p.pvc || { d: 60, a: 150 };
  const yp = dPvcY(p);
  const r = Math.max(1.5, (pv.d || 60) / 20);
  const T = E.a.find((e) => e.k === 'T' && e.s === 'MẶT TRƯỚC TƯỜNG');
  if (T && T.k === 'T') T.y += mm(7);
  const T2 = E.a.find((e) => e.k === 'T' && /nét đứt/.test(e.s));
  if (T2 && T2.k === 'T') T2.y += mm(7);
  dPvcXs(p).forEach((x) => E.circ(x, yp, r, 'THIN'));
  E.text(
    p.Lu / 2,
    yp - mm(5),
    `Ống PVC ${p.labelUnit}${pv.d || 60} @${fmt((pv.a || 150) / 100, 2)}m (cao độ +${fmt((yp - p.tBase) * 10)} so với mặt bản)`,
    mm(2),
    'NOTE',
    { al: 'c' },
  );
  return E;
}

export function viewSectionRebarD(
  p: Project,
  res: BarsResult,
  ctx: CadContext,
  cut?: string,
): Ents {
  const E = new Ents();
  const g = res.g;
  const { mm } = ctx;
  const c = p.cover;
  const B = g.B;
  const tB = p.tBase;
  const yT = g.yTop;
  const H = p.H;
  const rcut = cut === 'rib' && !!g.hyp;
  const by = (k: string): BarSpecRuntime | undefined =>
    res.bars.find((b) => b.key === k) as BarSpecRuntime | undefined;
  const RO: CalloutAHOpts = rcut ? { outside: true, txtReb: true } : {};
  const W = (cs: DLabCand[]): DLabCand[] =>
    cs.map(([a, b, c0, o]) => [a, b, c0, Object.assign({}, RO, o || {})]);

  const t1 = by('s1');
  const t2 = by('s2');
  const t3 = by('h1');
  const t3a = by('h1a');
  const t4 = by('t1');
  const b1 = by('b1');
  const b2 = by('b2');
  const b3 = by('l1');
  const b4 = by('u1');
  const b5 = by('w1');
  const b7 = by('k1');
  const t6 = by('r2');
  const t7 = by('r1');

  E.poly(rcut ? ribOutline(p, g) : g.out, 'OUT', { closed: true });
  if (g.hyp) E.poly([g.hyp.T, g.hyp.E], rcut ? 'OUT' : 'HID');
  if (rcut && g.hyp) E.poly([g.hyp.T, [g.xbb, tB]], 'THIN');

  const ancH = b7 && b7.A ? b7.A.Lb : 0;
  [t1, t2, b1, b2].forEach((b) => {
    if (b) bar(E, b.path, b.d, ctx);
  });
  if (b4) {
    [b4.path, b4.path.map((q) => [B - q[0], q[1]] as Point2D)].forEach((P) =>
      bar(E, P, b4.d, ctx),
    );
  }
  if (b5 && b5.xs) {
    b5.xs.forEach((x) =>
      E.poly(
        [
          [x, c],
          [x, tB - c],
        ],
        'REB',
        { w: wBar(b5.d, ctx) },
      ),
    );
  }
  if (b7 && b7.A) {
    b7.A.xs.forEach((x) =>
      E.poly(
        [
          [x, -ancH],
          [x, b7.A!.Lc],
        ],
        'REB',
        { w: wBar(b7.d, ctx) },
      ),
    );
  }
  if (t4 && t4.rows) {
    t4.rows.forEach((y) =>
      E.poly(
        [
          [g.xf(y) + c, y],
          [g.xb(y) - c, y],
        ],
        'REB',
        { w: wBar(t4.d, ctx) },
      ),
    );
  }
  const xeFn = (b: BarSpecRuntime, y: number): number =>
    typeof b.xe === 'function' ? b.xe(y) : b.xe || g.xb(y) - c;
  if (rcut && t6 && t6.rows && t6.xF !== undefined) {
    t6.rows.forEach((y) =>
      E.poly(
        [
          [t6.xF!, y],
          [xeFn(t6, y), y],
        ],
        'REB',
        { w: wBar(t6.d, ctx) },
      ),
    );
  }
  if (rcut && t7 && t7.diag) {
    t7.diag.forEach((q) => E.poly([q.A, q.B], 'REB2', { w: wBar(t7.d, ctx) }));
  }
  const toPt2D = (item: number[] | { x: number; y: number }): Point2D =>
    Array.isArray(item) ? [item[0], item[1]] : [item.x, item.y];
  [t3, t3a, b3].forEach((b) => {
    if (b && b.pts) b.pts.forEach((q) => {
      const pt = toPt2D(q);
      dot(E, pt[0], pt[1], b.d, ctx);
    });
  });
  settleDots(E, ctx, { layers: ['REB', 'REB2', 'OUT'] });
  E.env = { x0: 0, y0: -ancH, x1: B, y1: yT };
  const yAt = (f: number): number => tB + f * H;

  if (rcut && t6 && t6.rows && t6.rows.length && t6.xF !== undefined) {
    const y6 = t6.rows[Math.floor(t6.rows.length * 0.42)];
    const pt: Point2D = [t6.xF + (xeFn(t6, y6) - t6.xF) * 0.9, y6];
    dLab(E, ctx, dTxt(t6 as unknown as BarSpec, p), [
      [pt, 1, mm(5.8), { kind: 'line', outside: true }],
      [pt, 1, -mm(5.8), { kind: 'line', outside: true }],
      [pt, 1, mm(9.2), { kind: 'line', outside: true }],
    ]);
  }
  if (rcut && t7 && t7.diag && t7.diag.length) {
    const q = t7.diag[0];
    const pt: Point2D = [q.A[0] + (q.B[0] - q.A[0]) * 0.5, q.A[1] + (q.B[1] - q.A[1]) * 0.5];
    dLab(E, ctx, dTxt(t7 as unknown as BarSpec, p), [
      [pt, 1, -mm(5.8), { kind: 'line', outside: true }],
      [pt, 1, mm(5.8), { kind: 'line', outside: true }],
      [pt, 1, -mm(9.2), { kind: 'line', outside: true }],
    ]);
  }
  if (t3 && t3.pts && t3.pts.length) {
    const pts = t3.pts.map(toPt2D);
    const q = nearBy(pts, yAt(0.88), (v) => v[1]);
    dLab(E, ctx, dTxt(t3 as unknown as BarSpec, p), [
      [q, -1, 0, { straight: true, kind: 'dot' }],
      [q, -1, mm(5.8), { kind: 'dot' }],
    ]);
  }
  if (t2) {
    const y = yAt(0.66);
    const x = t2.path[1][0];
    dLab(E, ctx, dTxt(t2 as unknown as BarSpec, p), [
      [[x, y], -1, 0, { straight: true, kind: 'line' }],
      [[x, y], -1, mm(5.8), { kind: 'line' }],
    ]);
  }
  if (t3a && t3a.pts && t3a.pts.length) {
    const pts = t3a.pts.map(toPt2D);
    const q = nearBy(pts, yAt(0.82), (v) => v[1]);
    dLab(
      E,
      ctx,
      dTxt(t3a as unknown as BarSpec, p),
      W([
        [q, 1, 0, { straight: true, kind: 'dot' }],
        [q, 1, mm(5.8), { kind: 'dot', diag: 1 }],
      ]),
    );
  }
  if (t1) {
    const P0 = t1.path[1];
    const P1 = t1.path[2];
    const f = (y: number): Point2D => [P0[0] + ((P1[0] - P0[0]) * (P0[1] - y)) / (P0[1] - P1[1]), y];
    const cs: DLabCand[] = [0.5, 0.36, 0.24, 0.62]
      .map((fr): DLabCand => [f(yAt(fr)), 1, 0, { straight: true, kind: 'line' }])
      .concat([[f(yAt(0.5)), 1, mm(5.8), { kind: 'line', diag: 1 }]]);
    dLab(E, ctx, dTxt(t1 as unknown as BarSpec, p), W(cs));
  }
  if (t4 && t4.rows && t4.rows.length) {
    const y = nearBy(t4.rows, yAt(0.42), (v) => v);
    const q: Point2D = [g.xb(y) - c, y];
    dLab(
      E,
      ctx,
      dTxt(t4 as unknown as BarSpec, p),
      W([
        [q, 1, 0, { straight: true, kind: 'line' }],
        [q, 1, mm(5.8), { kind: 'line', diag: 1 }],
      ]),
    );
  }
  if (b2) {
    const y = b2.y || 0;
    const xs = [0.9, 0.97, 0.8].map((f) => f * B);
    dLab(
      E,
      ctx,
      dTxt(b2 as unknown as BarSpec, p),
      xs
        .map((x): DLabCand => [[x, y], 1, mm(9), { kind: 'line' }])
        .concat([[[0.4 * g.t, y], -1, mm(9), { kind: 'line' }]]),
    );
  }
  if (b4) {
    const x = b4.xw || c;
    const y = tB * 0.5;
    dLab(E, ctx, dTxt(b4 as unknown as BarSpec, p), [
      [[x, y], -1, 0, { straight: true, kind: 'line' }],
      [[x, y], -1, mm(6), { kind: 'line' }],
    ]);
  }
  if (b3 && b3.pts) {
    const pts = b3.pts.map(toPt2D);
    const lo = pts.filter((q) => Math.abs(q[1] - (b3.yl || 0)) < 1e-6);
    if (lo.length) {
      const ax = b7 && b7.A ? b7.A.xs : [];
      const okx = (q: Point2D): boolean => ax.every((a) => Math.abs(a - q[0]) > 9);
      const cand = lo
        .filter(okx)
        .sort((u, v) => Math.abs(u[0] - 0.62 * B) - Math.abs(v[0] - 0.62 * B));
      dLab(
        E,
        ctx,
        dTxt(b3 as unknown as BarSpec, p),
        cand
          .slice(0, 4)
          .map((q): DLabCand => [q, 1, -mm(11), { kind: 'dot' }])
          .concat([[lo[0], -1, -mm(11), { kind: 'dot' }]]),
      );
    }
  }
  if (b7 && b7.A && b7.A.xs.length) {
    const x = b7.A.xs[0];
    dLab(E, ctx, dTxt(b7 as unknown as BarSpec, p), [
      [[x, -ancH], -1, 0, { straight: true, kind: 'line' }],
      [[x, -ancH * 0.6], -1, -mm(6), { kind: 'line' }],
      [[x, -ancH * 0.6], -1, -mm(11), { kind: 'line' }],
    ]);
  }
  if (b1) {
    const x1 = Math.min(0.5 * B, 17.5);
    const x2 = x1 + 20;
    const dp = [8, 12, 16, 20];
    dLab(
      E,
      ctx,
      dTxt(b1 as unknown as BarSpec, p),
      dp.flatMap((d): DLabCand[] => [
        [[x1, b1.y || 0], -1, -mm(d) - ancH * 0.4, { kind: 'line' }],
        [[x2, b1.y || 0], -1, -mm(d) - ancH * 0.4, { kind: 'line' }],
      ]),
    );
  }
  if (b5 && b5.xs && b5.xs.length) {
    const x = b5.xs[b5.xs.length - 1];
    dLab(
      E,
      ctx,
      dTxt(b5 as unknown as BarSpec, p),
      W([
        [[x, tB * 0.5], 1, mm(2.6), { kind: 'line', diag: 1 }],
        [[x, tB * 0.5], 1, -mm(2.6), { kind: 'line', diag: 1 }],
        [[x, c], 1, -mm(12) - ancH, { kind: 'line' }],
      ]),
    );
  }
  dimRows(
    E,
    'B',
    [
      {
        lvl: 7.5,
        list: [
          [
            [0, 0],
            [g.t, 0],
          ],
          [
            [g.t, 0],
            [g.xbb, 0],
          ],
          [
            [g.xbb, 0],
            [B, 0],
          ],
        ],
      },
      {
        lvl: 13,
        list: [
          [
            [0, 0],
            [B, 0],
          ],
        ] as DimRowSpec['list'],
      },
    ],
    ctx,
  );
  dimRows(
    E,
    'L',
    [
      {
        lvl: 7.7,
        list: [
          [
            [0, 0],
            [0, tB],
          ],
          [
            [0, tB],
            [0, yT],
          ],
        ],
      },
    ],
    ctx,
  );
  dimRows(
    E,
    'T',
    [{ lvl: 6.9, list: [[[g.xft, yT], [g.xbt, yT], undefined, { cut: 4.4, sh: 1 }]] }],
    ctx,
  );
  finishView(
    E,
    rcut ? 'Mặt cắt sườn tăng cường' : p.type === 'rib' ? 'Mặt cắt b-b (giữa 2 sườn)' : 'Mặt cắt b-b',
    slabel(ctx),
    ctx,
  );
  return E;
}

export function viewElevRebarD(p: Project, res: BarsResult, ctx: CadContext): Ents {
  const E = new Ents();
  const g = res.g;
  const { mm } = ctx;
  const c = p.cover;
  const Lu = p.Lu;
  const tB = p.tBase;
  const yT = g.yTop;
  const zm = c + 2.5;
  const by = (k: string): BarSpecRuntime | undefined =>
    res.bars.find((b) => b.key === k) as BarSpecRuntime | undefined;

  const t1 = by('s1');
  const t2 = by('s2');
  const t3 = by('h1');
  const t4 = by('t1');
  const b3 = by('l1');
  const b4 = by('u1');

  E.rect(0, 0, Lu, yT, 'OUT');
  E.line(0, tB, Lu, tB, 'OUT');
  if (p.type === 'rib') {
    g.ribs.forEach((r) => {
      E.line(r.x0, tB, r.x0, g.yR, 'HID');
      E.line(r.x1, tB, r.x1, g.yR, 'HID');
    });
  }
  const vs1 = t1 && t1.pos ? t1.pos : [];
  const vs2 = t2 && t2.pos ? t2.pos : [];
  const hs = t3 && t3.rows ? t3.rows : [];
  vs1.forEach((x) => E.line(x, tB, x, yT - c, 'REB'));
  if (t2 && !samePos(vs1, vs2)) vs2.forEach((x) => E.line(x, tB, x, yT - c, 'REB'));
  hs.forEach((y) => E.line(zm, y, Lu - zm, y, 'REB'));
  const brow =
    b3 && b3.pts ? uniq(b3.pts.map((q) => (Array.isArray(q) ? q[1] : q.y))) : [];
  brow.forEach((y) => E.line(zm, y, Lu - zm, y, 'REB'));
  if (b4 && b4.pos && b4.yb !== undefined && b4.yu !== undefined) {
    b4.pos.forEach((x) => E.line(x, b4.yb!, x, b4.yu!, 'REB'));
  }
  if (t4 && t4.cols && t4.rows) {
    t4.cols.forEach((x) => t4.rows!.forEach((y) => dot(E, x, y, t4.d, ctx)));
  }
  settleDots(E, ctx, { layers: ['REB', 'OUT'] });

  const hs0 = secH(ctx);
  const zc = g.ribs.length > 1 ? (g.ribs[0].x1 + g.ribs[1].x0) / 2 : Lu / 2;
  E.env = { x0: 0, y0: 0, x1: Lu, y1: yT };
  secSym(E, ctx, [zc, yT + mm(3) + 2.49 * hs0], [0, -1], [-1, 0], 'b');
  secSym(E, ctx, [zc, -mm(3) - 2.49 * hs0], [0, 1], [-1, 0], 'b');
  secSym(E, ctx, [-mm(3) - 2.49 * hs0, tB * 0.28], [1, 0], [0, 1], 'f');
  secSym(E, ctx, [Lu + mm(3) + 2.49 * hs0, tB * 0.28], [-1, 0], [0, 1], 'f');

  const hsA = hs.slice().sort((u, v) => u - v);
  const yBot = tB;
  if (t1 && vs1.length) {
    chainNote(
      E,
      {
        axis: 'h',
        pos: bigGap(hsA, yBot, yT - c),
        list: vs1,
        side: -1,
        lines: [
          t2 && samePos(vs1, vs2)
            ? `${dTxt(t1 as unknown as BarSpec, p)} / ${dTxt(t2 as unknown as BarSpec, p)}`
            : dTxt(t1 as unknown as BarSpec, p),
        ],
        mark: '',
      },
      ctx,
    );
  }
  if (t2 && vs2.length && !samePos(vs1, vs2)) {
    chainNote(
      E,
      {
        axis: 'h',
        pos: bigGap(hsA, yBot, yT - c) + mm(2.2),
        list: vs2,
        side: -1,
        lines: [dTxt(t2 as unknown as BarSpec, p)],
        mark: '',
      },
      ctx,
    );
  }
  if (t3 && hs.length) {
    const t3a = by('h1a');
    chainNote(
      E,
      {
        axis: 'v',
        pos: midGap(vs1, 1),
        list: hs,
        side: 1,
        lines: [`${dTxt(t3 as unknown as BarSpec, p)} / ${dTxt((t3a || t3) as unknown as BarSpec, p)}`],
        mark: '',
      },
      ctx,
    );
  }
  if (t4 && t4.rows && t4.rows.length && t4.cols && t4.cols.length) {
    chainNote(
      E,
      {
        axis: 'h',
        pos: nearBy(t4.rows, tB + 0.5 * p.H, (v) => v),
        list: t4.cols,
        side: 1,
        kind: 'dot',
        lines: [dTxt(t4 as unknown as BarSpec, p)],
        mark: '',
      },
      ctx,
    );
  }
  if (b3 && brow.length) {
    const legs = uniq([
      0,
      Lu,
      vs1.length ? Math.min(...vs1) : 0,
      vs1.length ? Math.max(...vs1) : Lu,
      ...g.ribs.flatMap((r) => [r.x0, r.x1]),
    ]);
    let fa = 0;
    let fb = 0;
    for (let k = 1; k < legs.length; k++) {
      if (legs[k] - legs[k - 1] > fb - fa) {
        fa = legs[k - 1];
        fb = legs[k];
      }
    }
    const tw = textW(dTxt(b3 as unknown as BarSpec, p), mm(1.8));
    const bp = b4 && b4.pos ? b4.pos.slice().sort((u, v) => u - v) : [];
    const mids = bp
      .slice(1)
      .map((v, i) => (v + bp[i]) / 2)
      .filter((m) => m > fa + mm(1.5) && m + mm(4.5) + tw < fb - mm(1));
    chainNote(
      E,
      {
        axis: 'v',
        pos: mids.length ? mids[0] : midGap(vs1, Math.max(1, vs1.length - 3)),
        list: brow,
        side: -1,
        dx: mm(1),
        lines: [dTxt(b3 as unknown as BarSpec, p)],
        mark: '',
      },
      ctx,
    );
  }
  if (b4 && b4.pos && b4.pos.length && b4.yb !== undefined && b4.yu !== undefined) {
    chainNote(
      E,
      {
        axis: 'h',
        pos: (b4.yb + b4.yu) / 2 + 0.25 * (b4.yu - b4.yb),
        list: b4.pos,
        side: 1,
        lines: [dTxt(b4 as unknown as BarSpec, p)],
        mark: '',
      },
      ctx,
    );
  }
  dimRows(
    E,
    'B',
    [
      { lvl: 7.5, list: spacingList(vs1, 0, Lu, (x): Point2D => [x, 0]) },
      {
        lvl: 13,
        list: g.ribs.length
          ? (ribBreaks(p, g)
              .slice(1)
              .map((x, i) => [
                [ribBreaks(p, g)[i], 0],
                [x, 0],
              ]) as DimRowSpec['list'])
          : ([
              [
                [0, 0],
                [Lu, 0],
              ],
            ] as DimRowSpec['list']),
      },
      {
        lvl: 18.5,
        list: [
          [
            [0, 0],
            [Lu, 0],
          ],
        ] as DimRowSpec['list'],
      },
    ].filter((r) => r.list.length),
    ctx,
  );
  dimRows(
    E,
    'R',
    [
      { lvl: 7.7, list: spacingList(hs, tB, yT, (y) => [Lu, y]) },
      {
        lvl: 13,
        list: [
          [
            [Lu, 0],
            [Lu, tB],
          ],
          [
            [Lu, tB],
            [Lu, yT],
          ],
        ],
      },
    ],
    ctx,
  );
  finishView(
    E,
    'Mặt đứng bố trí thép',
    slabel(ctx) + `  –  nhìn từ phía đất đắp, đơn nguyên L = ${fmt(Lu / 100, 2)} m`,
    ctx,
  );
  return E;
}

export function viewSlabPlanD(p: Project, res: BarsResult, ctx: CadContext): Ents {
  const E = new Ents();
  const g = res.g;
  const { mm } = ctx;
  const c = p.cover;
  const Lu = p.Lu;
  const B = g.B;
  const zm = c + 2.5;
  const by = (k: string) => res.bars.find((b) => b.key === k);
  const b1 = by('b1');
  const b2 = by('b2');
  const b3 = by('l1');
  E.rect(0, 0, Lu, B, 'OUT');
  E.rect(0, g.t, Lu, g.xbb, 'HID');
  const ts = b1 && b1.pos ? b1.pos : b2 && b2.pos ? b2.pos : [];
  const ls = b3 ? dRingXs(B, b3.a || 15, c + 2.5) : [];
  ts.forEach((x) => E.line(x, c, x, B - c, 'REB'));
  ls.forEach((y) => E.line(zm, y, Lu - zm, y, 'REB'));
  E.env = { x0: 0, y0: 0, x1: Lu, y1: B };
  const lsA = ls.slice().sort((u, v) => u - v);
  const tsA = ts.slice().sort((u, v) => u - v);
  if (b1 && ts.length) {
    chainNote(
      E,
      {
        axis: 'h',
        pos: freeGap(lsA, Math.min(2, Math.max(0, lsA.length - 2)), [], mm(2.4)),
        list: ts,
        side: 1,
        lines: [b2 && samePos(ts, b2.pos) ? `${dTxt(b1, p)} / ${dTxt(b2, p)}` : dTxt(b1, p)],
        mark: '',
      },
      ctx,
    );
  }
  if (b2 && b2.pos && !samePos(ts, b2.pos)) {
    chainNote(
      E,
      {
        axis: 'h',
        pos: freeGap(lsA, Math.min(4, Math.max(0, lsA.length - 2)), [], mm(2.4)),
        list: b2.pos,
        side: 1,
        lines: [dTxt(b2, p)],
        mark: '',
      },
      ctx,
    );
  }
  if (b3 && ls.length) {
    chainNote(
      E,
      {
        axis: 'v',
        pos: freeGap(tsA, Math.max(0, tsA.length - 3), [], mm(2.4)),
        list: ls,
        side: -1,
        dx: mm(14),
        lines: [dTxt(b3, p)],
        mark: '',
      },
      ctx,
    );
  }
  dimRows(
    E,
    'T',
    [
      { lvl: 7.5, list: spacingList(ts, 0, Lu, (x) => [x, B]) },
      {
        lvl: 13,
        list: [
          [
            [0, B],
            [Lu, B],
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
      { lvl: 7.7, list: spacingList(ls, 0, B, (y) => [0, y]) },
      {
        lvl: 13,
        list: [
          [
            [0, 0],
            [0, g.t],
          ],
          [
            [0, g.t],
            [0, g.xbb],
          ],
          [
            [0, g.xbb],
            [0, B],
          ],
        ],
      },
      {
        lvl: 18.5,
        list: [
          [
            [0, 0],
            [0, B],
          ],
        ],
      },
    ],
    ctx,
  );
  finishView(E, 'Mặt cắt f-f', slabel(ctx) + '  –  thép bản đáy', ctx);
  return E;
}

export function viewDrillD(p: Project, res: BarsResult, ctx: CadContext): Ents {
  const E = new Ents();
  const g = res.g;
  const Lu = p.Lu;
  const B = g.B;
  const k1 = ancBarOf(res);
  E.rect(0, 0, Lu, B, 'OUT');
  if (k1 && k1.A) k1.A.xs.forEach((x) => k1.A!.zs.forEach((z) => dot(E, z, x, k1.d, ctx)));
  E.env = { x0: 0, y0: 0, x1: Lu, y1: B };
  if (k1 && k1.A && k1.A.xs.length && k1.A.zs.length) {
    const A = k1.A;
    const ysA = A.xs.slice().sort((u, v) => u - v);
    const row = ysA[Math.min(ysA.length - 1, Math.max(0, Math.floor(ysA.length / 2)))];
    const dl = isD(p)
      ? { lines: [dTxt(k1, p)], mark: '' }
      : { lines: barLines(k1, p), mark: String(k1.mark) };
    chainNote(E, Object.assign({ axis: 'h' as const, pos: row, list: A.zs, side: 1 as const, kind: 'dot' as const }, dl), ctx);
    dimRows(
      E,
      'T',
      [
        { lvl: 7.5, list: spacingList(A.zs, 0, Lu, (x) => [x, B]) },
        {
          lvl: 13,
          list: [
            [
              [0, B],
              [Lu, B],
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
        { lvl: 7.7, list: spacingList(A.xs, 0, B, (y) => [0, y]) },
        {
          lvl: 13,
          list: [
            [
              [0, 0],
              [0, B],
            ],
          ],
        },
      ],
      ctx,
    );
  }
  finishView(
    E,
    'Mặt bằng khoan cấy thép',
    slabel(ctx) +
      (k1 && k1.A
        ? `  –  thép ${p.labelUnit}${k1.d}, L = ${fmt(k1.A.L / 100, 2)} m @${fmt((k1.a || 0) * 10)}`
        : ''),
    ctx,
  );
  return E;
}

export function viewLuoi3D(p: Project, res: BarsResult, ctx: CadContext): Ents {
  const E = new Ents();
  const g = res.g;
  const { mm } = ctx;
  const c = p.cover;
  const B = g.B;
  const tB = p.tBase;
  const by = (k: string): BarSpecRuntime | undefined =>
    res.bars.find((b) => b.key === k) as BarSpecRuntime | undefined;
  const u2 = by('u2');
  const u3 = by('u3');
  E.rect(0, 0, B, tB, 'OUT');
  const hh = Math.min(30, 0.35 * tB);
  const w = g.xbb - g.t;
  const zz: Point2D[] = [
    [g.t, tB + hh],
    [g.t + 0.36 * w, tB + hh],
    [g.t + 0.44 * w, tB + hh + 5],
    [g.t + 0.52 * w, tB + hh - 5],
    [g.t + 0.6 * w, tB + hh + 5],
    [g.t + 0.66 * w, tB + hh],
    [g.xbb, tB + hh],
  ];
  E.poly([[g.t, tB], ...zz, [g.xbb, tB]], 'OUT');
  if (u2 && u2.xs && u2.yb !== undefined && u2.yu !== undefined) {
    u2.xs.forEach((x) => E.line(x, u2.yb!, x, u2.yu!, 'REB'));
  }
  if (u3 && u3.rows) u3.rows.forEach((y) => E.line(c, y, B - c, y, 'REB'));
  E.env = { x0: 0, y0: 0, x1: B, y1: tB + hh + 5 };
  if (u2 && u2.xs && u2.xs.length && u2.yb !== undefined && u2.yu !== undefined) {
    chainNote(
      E,
      {
        axis: 'h',
        pos: u2.yb + 0.2 * (u2.yu - u2.yb) - 0.4,
        list: u2.xs,
        side: 1,
        lines: [dTxt(u2 as unknown as BarSpec, p)],
        mark: '',
      },
      ctx,
    );
  }
  if (u3 && u3.rows && u3.rows.length) {
    chainNote(
      E,
      {
        axis: 'v',
        pos: u2 && u2.xs && u2.xs.length > 3 ? (u2.xs[2] + u2.xs[3]) / 2 : B / 2,
        list: u3.rows,
        side: -1,
        dx: mm(14),
        lines: [dTxt(u3 as unknown as BarSpec, p)],
        mark: '',
      },
      ctx,
    );
  }
  dimRows(
    E,
    'B',
    [
      { lvl: 7.5, list: u2 && u2.xs ? spacingList(u2.xs, 0, B, (x): Point2D => [x, 0]) : [] },
      {
        lvl: 13,
        list: [
          [
            [0, 0],
            [B, 0],
          ],
        ] as DimRowSpec['list'],
      },
    ].filter((r) => r.list.length),
    ctx,
  );
  dimRows(
    E,
    'L',
    [
      {
        lvl: 7.7,
        list: [
          [
            [0, 0],
            [0, tB],
          ],
        ],
      },
    ],
    ctx,
  );
  finishView(E, 'Lưới 3', slabel(ctx) + '  –  mặt đầu đơn nguyên', ctx);
  return E;
}

export function viewPlanD(p: Project, res: BarsResult, ctx: CadContext): Ents {
  const E = new Ents();
  const g = res.g;
  const { mm } = ctx;
  const Lu = p.Lu;
  const B = g.B;
  const hy = p.type === 'rib' ? g.hyp : null;
  const xe = hy ? hy.E[0] : B;
  E.rect(0, 0, Lu, B, 'OUT');
  E.line(0, g.t, Lu, g.t, 'OUT');
  E.line(0, g.xbt, Lu, g.xbt, 'OUT');
  E.line(0, g.xbb, Lu, g.xbb, 'THIN');
  if (hy) g.ribs.forEach((r) => E.rect(r.x0, hy.T[0], r.x1, xe, 'OUT'));
  E.text(Lu / 2, -mm(4), 'MẶT TRƯỚC', mm(2.2), 'NOTE', { al: 'c' });
  E.env = { x0: 0, y0: -mm(6), x1: Lu, y1: B };
  const b = hy ? ribBreaks(p, g) : [0, Lu];
  dimRows(
    E,
    'T',
    [
      {
        lvl: 7.5,
        list: b.slice(1).map((x, i) => [
          [b[i], B],
          [x, B],
        ]) as DimRowSpec['list'],
      },
      ...(b.length > 2
        ? [
            {
              lvl: 13,
              list: [
                [
                  [0, B],
                  [Lu, B],
                ],
              ] as DimRowSpec['list'],
            },
          ]
        : []),
    ],
    ctx,
  );
  dimRows(
    E,
    'L',
    [
      {
        lvl: 7.7,
        list: [
          [
            [0, 0],
            [0, g.t],
          ],
          [
            [0, g.t],
            [0, g.xbb],
          ],
          [
            [0, g.xbb],
            [0, B],
          ],
        ],
      },
      {
        lvl: 13,
        list: [
          [
            [0, 0],
            [0, B],
          ],
        ],
      },
    ],
    ctx,
  );
  if (hy && B - xe > 0.5) {
    dimRows(
      E,
      'R',
      [
        {
          lvl: 7.7,
          list: [
            [
              [Lu, xe],
              [Lu, B],
            ],
          ],
        },
      ],
      ctx,
    );
  }
  finishView(E, 'Mặt bằng', slabel(ctx), ctx);
  return E;
}
