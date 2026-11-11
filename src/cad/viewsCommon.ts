import { isB, isC, keyLayoutC } from '../engine';
import type {
  BarSpec,
  BarsResult,
  CadContext,
  GeomData,
  Point2D,
  Project,
  QuantitiesResult,
} from '../types/project';
import {
  bar,
  barLines,
  bigGap,
  callout,
  calloutAH,
  calloutMin,
  cbl,
  chainNote,
  dimBand,
  dimRaw,
  type DimRowItem,
  dimRows,
  type DimRowSpec,
  dot,
  dotR,
  dotT,
  fanLabels,
  freeGap,
  lrSegs,
  midGap,
  noteCad,
  spacingList,
  wBar,
} from './dimCallout';
import { settleDots } from './dots';
import { type CadBoxMeta, Ents, mkBox } from './ents';
import {
  type BarSpecRuntime,
  beamDots,
  blindOutline,
  blindT,
  clamp,
  fmt,
  textW,
} from './layers';

export const DL1 = 8;
export const DL2 = 16;

export interface QtyGroup {
  label: string[];
  rows: Array<[string, number]>;
}

export function qtyGroups(p: Project, q: QuantitiesResult): QtyGroup[] {
  const c = q.conc;
  const f = q.form;
  const G: QtyGroup[] = [];
  const fo = isC(p) ? 'Bản đáy' : 'Móng tường';
  const st = isC(p) ? 'Thân khối kè' : 'Thân tường';
  const ky = isC(p) ? 'Chân khay' : 'Chân khóa';
  const sn = 'Sườn tăng cường';
  const rc: Array<[string, number]> = [
    [fo, c.foot],
    [st, c.stem],
  ];
  if (c.key > 1e-9) rc.push([ky, c.key]);
  if (c.rib > 1e-9) rc.push([sn, c.rib]);
  rc.push(['Cộng', c.tot]);
  G.push({ label: [(isB(p) ? 'BTXM ' : 'Bê tông ') + p.concrete, '(m³)'], rows: rc });
  if (q.blind > 1e-9) G.push({ label: ['Bê tông lót', 'M100 (m³)'], rows: [['', q.blind]] });
  const rf: Array<[string, number]> = [
    [fo, f.foot],
    [st, f.stem],
  ];
  if (f.rib > 1e-9) rf.push([sn, f.rib]);
  rf.push(['Cộng', f.tot]);
  G.push({ label: ['Ván khuôn', '(m²)'], rows: rf });
  return G;
}

export function coreX(E: Ents): [number, number] {
  let x0 = 1e18;
  let x1 = -1e18;
  const P = (x: number): void => {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
  };
  for (const e of E.a) {
    if (e.ly !== 'OUT') continue;
    if (e.k === 'L') {
      P(e.x1);
      P(e.x2);
    } else if (e.k === 'P') {
      e.pts.forEach((q) => P(q[0]));
    }
  }
  if (x0 > x1) {
    const b = E.bbox();
    return [b.x0, b.x1];
  }
  return [x0, x1];
}

export function finishView(E: Ents, title: string, subt: string, ctx: CadContext): Ents {
  const { mm } = ctx;
  const bb = E.bbox();
  const [c0, c1] = coreX(E);
  const cx = (c0 + c1) / 2;
  const y = bb.y0 - mm(8);
  E.text(cx, y, title.toUpperCase(), mm(3), 'CDO', { al: 'c' });
  if (subt) E.text(cx, y - mm(3.8), subt, mm(1.8), 'CDO', { al: 'c' });
  return E;
}

export function sub<T>(_E: Ents, arr: T, _aCm?: number, _ctx?: CadContext): T {
  return arr;
}

export const slabel = (ctx: CadContext): string => `TỈ LỆ 1:${ctx.S}`;

export const hatchSoil = (): null => null;

export const t1Lines = (t1: BarSpec, p: Project): string[] => [
  `${p.labelUnit}${t1.d}`,
  `a=${fmt((t1.a || 0) * 10)}${t1.ah && t1.ah !== t1.a ? 'x' + fmt(t1.ah * 10) : ''}`,
];

export const envSection = (p: Project, g: GeomData) => ({
  x0: 0,
  y0: -Math.max((g.dn || 0) + blindT(p), g.an ? g.an.Lb : 0),
  x1: g.B,
  y1: g.yTop,
});

export function ancLines(E: Ents, an: BarSpec, ctx: CadContext): void {
  if (!an.A) return;
  const r = ctx.mm(0.3);
  an.A.xs.forEach((x) => {
    E.poly(
      [
        [x, -an.A!.Lb],
        [x, an.A!.Lc],
      ],
      'REB',
      { w: wBar(an.d, ctx) },
    );
    E.lbl.push(mkBox(x - r, -an.A!.Lb, x + r, an.A!.Lc, { s: 1, o: 'v' }));
  });
}

export function keyDepthDim(E: Ents, g: GeomData, ctx: CadContext): void {
  if (!g.key || g.key.toe) return;
  const { mm } = ctx;
  const kd = g.key.d;
  const x = g.key.x0 - mm(2.6);
  dimRaw(E, [g.key.x0, 0], [g.key.x0, -kd], [x, 0], [x, -kd], undefined, ctx);
  (E.dz = E.dz || []).push(dimBand(true, x, -kd, 0, mm));
}

export function dimsSection(
  E: Ents,
  p: Project,
  g: GeomData,
  ctx: CadContext,
  o: { fillTop?: number; noKey?: boolean } = {},
): void {
  const kd = g.key ? g.key.d : 0;
  const B = g.B;
  const left: Array<[Point2D, Point2D] | null> = [
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
  ];
  if (o.fillTop && o.fillTop > g.yTop + 0.5) {
    left.push([
      [0, g.yTop],
      [0, o.fillTop],
    ]);
  }
  const bottomRows: DimRowSpec[] = [
    ...(g.key
      ? [{ lvl: 4.8, list: [[[g.key.x0, -kd], [g.key.x1, -kd], undefined, { cut: 3 }] as DimRowItem<Point2D>] }]
      : []),
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
      ],
    },
  ];
  dimRows(E, 'B', bottomRows, ctx);
  dimRows(E, 'L', [{ lvl: 7.7, list: left.map((item) => item) }], ctx);
  dimRows(
    E,
    'T',
    [{ lvl: 6.9, list: [[[g.xft, g.yTop], [g.xbt, g.yTop], undefined, { cut: 4.4, sh: 1 }]] }],
    ctx,
  );
  if (!o.noKey) keyDepthDim(E, g, ctx);
  if (Math.abs(g.tH - p.tTip) > 1e-6) {
    dimRows(
      E,
      'R',
      [
        {
          lvl: 7.7,
          list: [
            [
              [B, 0],
              [B, g.tH],
            ],
          ],
        },
      ],
      ctx,
    );
  }
}

export function dimsSectionA(
  E: Ents,
  p: Project,
  g: GeomData,
  ctx: CadContext,
  o: { fillTop?: number; noKey?: boolean } = {},
): void {
  const B = g.B;
  const bm = g.beam;
  const yT = g.yTop;
  const cp = g.cap;
  const bd = bm ? bm.d : 0;
  const bw = bm ? bm.w : 0;
  const left: Array<[Point2D, Point2D] | null> = [
    [
      [0, -bd],
      [0, p.tBase],
    ],
    [
      [0, p.tBase],
      [0, yT],
    ],
  ];
  if (o.fillTop && o.fillTop > yT + 0.5) {
    left.push([
      [0, yT],
      [0, o.fillTop],
    ]);
  }
  const bottomRows: DimRowSpec[] = [
    ...(bm
      ? [
          {
            lvl: 4.8,
            list: [
              [
                [0, -bd],
                [bw, -bd],
              ],
              [
                [bw, -bd],
                [bw + bd, 0],
              ],
              [
                [B - bw - bd, 0],
                [B - bw, -bd],
              ],
              [
                [B - bw, -bd],
                [B, -bd],
              ],
            ] as DimRowSpec['list'],
          },
        ]
      : []),
    ...(g.key
      ? [
          {
            lvl: bm ? 10.5 : 4.8,
            list: [[[g.key.x0, -g.key.d], [g.key.x1, -g.key.d], undefined, { cut: 3 }] as DimRowSpec['list'][number]],
          },
        ]
      : []),
    {
      lvl: bm ? 16 : 7.5,
      list: [
        [
          [0, -bd],
          [B, -bd],
        ],
      ],
    },
  ];
  dimRows(E, 'B', bottomRows, ctx);
  dimRows(E, 'L', [{ lvl: 7.7, list: left }], ctx);
  if (cp) {
    dimRows(
      E,
      'T',
      [
        {
          lvl: 6.9,
          list: [
            [
              [g.xft, yT],
              [g.xbt, yT],
            ],
            [
              [g.xbt, yT],
              [g.xcap, yT],
            ],
          ],
        },
        {
          lvl: 12.5,
          list: [
            [
              [g.xft, yT],
              [g.xcap, yT],
            ],
          ],
        },
      ],
      ctx,
    );
  } else {
    dimRows(
      E,
      'T',
      [{ lvl: 6.9, list: [[[g.xft, yT], [g.xbt, yT], undefined, { cut: 4.4, sh: 1 }]] }],
      ctx,
    );
  }
  if (!o.noKey) keyDepthDim(E, g, ctx);
}

export function capDimsA(E: Ents, g: GeomData, ctx: CadContext): void {
  const cp = g.cap;
  if (!cp) return;
  const { mm } = ctx;
  const st = ctx.dst;
  const asz = mm(st.asz);
  const yT = g.yTop;
  const x = g.xcap + mm(5.5);
  const y1 = yT;
  const y2 = yT - cp.hv;
  const y3 = y2 - cp.hs;
  dimRaw(E, [g.xcap, y1], [g.xcap, y2], [x, y1], [x, y2], undefined, ctx, { sh: 1 });
  dimRaw(E, [g.xbt, y3], [g.xcap, y2], [x, y3], [x, y2], undefined, ctx, { sh: -1 });
  for (const [lo, hi, dir] of [
    [y2, y1, 1],
    [y3, y2, -1],
  ] as const) {
    const L = hi - lo;
    const tw = textW(fmt(L * 10), mm(st.txt)) * (st.wf || 1);
    const arrIn = L >= tw + 2 * asz;
    const txtIn = L >= tw + mm(0.8);
    let a = lo;
    let b = hi;
    if (!arrIn) {
      a -= 2 * asz;
      b += 2 * asz;
    }
    if (!txtIn) {
      const c = (lo + hi) / 2 + dir * (L / 2 + tw / 2 + (arrIn ? mm(0.8) : 2.2 * asz));
      a = Math.min(a, c - tw / 2);
      b = Math.max(b, c + tw / 2);
    }
    (E.dz = E.dz || []).push(dimBand(true, x, a, b, mm));
  }
}

export function dimsSectionC(
  E: Ents,
  p: Project,
  g: GeomData,
  ctx: CadContext,
  o: { kdLabel?: string; rebar?: boolean } = {},
): void {
  const { mm } = ctx;
  const kd = g.key ? g.key.d : 0;
  const kl = o.kdLabel;
  const tl = blindT(p);
  const B = g.B;
  const yT = g.yTop;
  const tf = Math.min(p.toeFlat || 0, g.t);
  const hn = Math.min(p.haunch || 0, B - g.xbb);
  const xs = [0, ...(tf > 1e-6 ? [tf] : []), g.t, g.xbb, ...(hn > 1e-6 ? [g.xbb + hn] : []), B];
  dimRows(
    E,
    'B',
    [
      ...(g.key
        ? [{ lvl: 4.8, list: [[[g.key.x0, -kd], [g.key.x1, -kd], undefined, { cut: 3 }] as DimRowSpec['list'][number]] }]
        : []),
      ...(o.rebar
        ? []
        : [
            {
              lvl: 7.5,
              list: xs.slice(1).map((x, i) => [
                [xs[i], 0],
                [x, 0],
              ]) as DimRowSpec['list'],
            },
          ]),
      {
        lvl: o.rebar ? 7.5 : 13,
        list: [
          [
            [0, 0],
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
        lvl: 7.7,
        list: [
          tl > 0
            ? [
                [0, -tl],
                [0, 0],
              ]
            : null,
          [
            [0, 0],
            [0, p.tTip],
          ],
          // dimStem: tách "bản đáy" và "thân H" để kích thước ghi đúng chiều cao đã chọn
          ...(p.dimStem && p.tBase > p.tTip + 1e-6
            ? [
                [
                  [0, p.tTip],
                  [0, p.tBase],
                ] as [Point2D, Point2D],
                [
                  [0, p.tBase],
                  [0, yT],
                ] as [Point2D, Point2D],
              ]
            : [
                [
                  [0, p.tTip],
                  [0, yT],
                ] as [Point2D, Point2D],
              ]),
        ],
      },
      {
        lvl: 13,
        list: [
          g.key && tl > 0
            ? [
                [0, -kd - tl],
                [0, -kd],
              ]
            : null,
          g.key ? [[0, -kd], [0, 0], kl, kl ? { dxfTxt: kl } : undefined] : null,
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
  if (g.hyp) {
    const x = g.xbt + mm(9.5);
    dimRaw(E, [g.xbt, yT], [g.xbt, g.yR], [x, yT], [x, g.yR], undefined, ctx);
    (E.dz = E.dz || []).push(mkBox(g.xbt, g.yR, x + mm(4), yT));
  }
}

export const secH = (ctx: CadContext): number => ctx.mm(1.32 * ctx.dst.txt);

export function secSym(
  E: Ents,
  ctx: CadContext,
  O: Point2D,
  n: Point2D,
  v: Point2D,
  label: string,
): CadBoxMeta {
  const h = secH(ctx);
  const P = (a: number, b: number): Point2D => [O[0] + n[0] * a + v[0] * b, O[1] + n[1] * a + v[1] * b];
  const I = P(2.49 * h, 0);
  const tip = P(0, 2 * h);
  const ap = P(h, 0);
  const w = textW(label, h);
  E.poly([I, O, tip, ap], 'SEC');
  const ext = Math.abs(v[0]) > 0.5 ? w : h;
  const c = P(1.55 * h, 0.8 * h + ext / 2);
  E.text(c[0], c[1] - h / 2, label, h, 'LBL', { al: 'c' });
  const pts: Point2D[] = [I, O, tip, ap, [c[0] - w / 2, c[1] - h / 2], [c[0] + w / 2, c[1] + h / 2]];
  const m = ctx.mm(0.8);
  const box = mkBox(
    Math.min(...pts.map((q) => q[0])) - m,
    Math.min(...pts.map((q) => q[1])) - m,
    Math.max(...pts.map((q) => q[0])) + m,
    Math.max(...pts.map((q) => q[1])) + m,
  );
  E.lbl.push(mkBox(box.x0, box.y0, box.x1, box.y1));
  return box;
}

export function ccNotes(E: Ents, g: GeomData, p: Project, tl: number, ctx: CadContext): void {
  const { mm } = ctx;
  const TH = mm(2);
  const B = g.B;
  const xt = B + mm(8);
  const its: Array<{ text: string; pts: Point2D[]; y: number }> = [
    { text: `BT tường chắn ${p.concrete}`, pts: [[B - mm(3), p.tBase * 0.5]], y: p.tBase * 0.5 },
  ];
  if (tl > 0) {
    const y2 = -tl - mm(4.2);
    const p0: Point2D = [B - mm(1.2), -tl / 2];
    its.push({
      text: `BT lót móng M100 dày ${fmt(tl * 10)}mm`,
      pts: [p0, [p0[0] + (p0[1] - y2), y2]],
      y: y2,
    });
  }
  its.forEach((it) => {
    const x1 = xt + textW(it.text, TH) + mm(2);
    E.poly(it.pts.concat([[x1, it.y]]), 'LEAD');
    E.text(xt + mm(1), it.y + mm(0.6), it.text, TH, 'NOTE', { al: 'l' });
    E.lbl.push(
      mkBox(
        Math.min(...it.pts.map((q) => q[0])),
        Math.min(...it.pts.map((q) => q[1]), it.y) - mm(0.3),
        x1,
        it.y + mm(3),
      ),
    );
  });
}

export function viewSection(p: Project, res: BarsResult, ctx: CadContext): Ents {
  const C = isC(p);
  const E = new Ents();
  const g = res.g;
  const { mm } = ctx;
  const tl = blindT(p);
  const kd = g.dn || 0;
  E.poly(g.out, 'OUT', { closed: true });
  const bo = blindOutline(p, g);
  if (bo) E.poly(bo, 'THIN');
  const an = res.bars.find((b) => b.key === 'an');
  if (an && an.A) {
    ancLines(E, an, ctx);
    const tx = an.A.xs[an.A.xs.length - 1];
    noteCad(
      E,
      [tx, -0.7 * an.A.Lb],
      Math.max(mm(6), g.B - tx + mm(3)),
      -mm(8),
      `Neo ${p.labelUnit}${an.d} @${fmt((an.a || 0) * 10)}×${fmt((an.a || 0) * 10)}, L=${fmt(an.A.L * 10)}`,
      ctx,
    );
  }
  const fm = p.fillMode || 'none';
  const fh = Math.max(0, p.fillH || 0);
  const mS = fm === '1' || fm === '1.5' ? parseFloat(fm) : 0;
  const xe = Math.max(g.B + mm(14), mS && fh > 0 ? g.xbt + mS * fh + mm(8) : 0);
  let yS = g.yTop;
  if (fm === 'none' || fh <= 0) {
    if (!C) E.line(g.xcap, g.yTop, xe, g.yTop, 'THIN');
  } else if (fm === 'flat') {
    yS = g.yTop + fh;
    E.poly(
      [
        [g.xbt, g.yTop],
        [g.xbt, yS],
        [xe, yS],
      ],
      'THIN',
    );
  } else {
    yS = g.yTop + fh;
    E.poly(
      [
        [g.xbt, g.yTop],
        [g.xbt + mS * fh, yS],
        [xe, yS],
      ],
      'THIN',
    );
    const lab = 'Mái dốc 1:' + (fm === '1' ? '1' : '1,5');
    const tw = textW(lab, mm(2.4));
    const sl = fh * Math.hypot(1, mS);
    const ang = (Math.atan(1 / mS) * 180) / Math.PI;
    const ar = (ang * Math.PI) / 180;
    if (sl >= tw + mm(10)) {
      const tc = clamp(0.72, (tw / 2 + mm(8)) / sl, 1 - (tw / 2 + mm(2.5)) / sl);
      const cx = g.xbt + mS * fh * tc - mm(1.2) * Math.sin(ar);
      const cy = g.yTop + fh * tc + mm(1.2) * Math.cos(ar);
      E.text(cx, cy, lab, mm(2.4), 'NOTE', { al: 'c', rot: ang });
      const hx = (tw / 2) * Math.cos(ar) + mm(1.8) * Math.sin(ar);
      const hy = (tw / 2) * Math.sin(ar) + mm(1.8) * Math.cos(ar);
      E.lbl.push(mkBox(cx - hx, cy - hy, cx + hx, cy + hy));
    } else {
      const lx = g.xbt + mS * fh + mm(2.5);
      const ly = yS + mm(1.4);
      E.text(lx, ly, lab, mm(2.4), 'NOTE', { al: 'l' });
      E.lbl.push(mkBox(lx, ly - mm(0.4), lx + tw, ly + mm(3)));
    }
  }
  if (!C) {
    E.text(g.xbb + (g.B - g.xbb) * 0.8, p.tBase + p.H * 0.6, 'ĐẤT ĐẮP', mm(3.2), 'NOTE', {
      al: 'c',
    });
  }
  if (p.type === 'rib' && g.hyp) {
    E.poly([g.hyp.T, g.hyp.E], C ? 'OUT' : 'HID');
    if (!C) {
      E.text(
        (g.hyp.T[0] + g.hyp.E[0]) / 2 - mm(3),
        (g.hyp.T[1] + g.hyp.E[1]) / 2 - mm(4),
        'Sườn (phía sau)',
        mm(2.2),
        'NOTE',
        { al: 'r' },
      );
    }
  }
  if (!C) {
    const txt = `BTCT ${p.concrete}`;
    const hw = g.B - g.xbb;
    const th0 = mm(2.8);
    const tw0 = textW(txt, th0);
    const th = tw0 > hw * 0.78 ? (th0 * hw * 0.78) / tw0 : th0;
    if (an) noteCad(E, [g.B - mm(1.5), g.topY(g.B) - mm(1.5)], mm(5), mm(6), txt, ctx);
    else E.text(g.xbb + hw * 0.5, p.tBase * 0.5 - (th / 2.8) * 1.2, txt, th, 'NOTE', { al: 'c' });
  }
  E.env = envSection(p, g);
  if (!C) capDimsA(E, g, ctx);
  if (C) {
    const hs = secH(ctx);
    const xc1 = g.B * 0.7745 + hs;
    secSym(E, ctx, [xc1, g.yTop + mm(3) + 2.49 * hs], [0, -1], [-1, 0], '1');
    secSym(E, ctx, [xc1, -tl - mm(2.5) - 2.49 * hs], [0, 1], [-1, 0], '1');
    ccNotes(E, g, p, tl, ctx);
    if (g.key) noteCad(E, [g.key.x1, -kd * 0.5], mm(5), 0, 'Chân khay', ctx);
    dimsSectionC(E, p, g, ctx);
  } else {
    if (tl > 0) {
      noteCad(
        E,
        [g.B - mm(0.8), -tl / 2],
        mm(7),
        -mm(7),
        `Bê tông lót M100 dày ${fmt(tl * 10)}mm`,
        ctx,
      );
    }
    (g.beam || g.cap ? dimsSectionA : dimsSection)(E, p, g, ctx, { fillTop: yS });
  }
  finishView(
    E,
    C ? 'Mặt cắt 2-2' : p.type === 'rib' ? 'Mặt cắt ngang (giữa 2 sườn)' : 'Mặt cắt ngang đại diện',
    slabel(ctx),
    ctx,
  );
  return E;
}

export function ribBreaks(p: Project, g: GeomData): number[] {
  const b = [0];
  g.ribs.forEach((r) => {
    b.push(r.x0, r.x1);
  });
  b.push(p.Lu);
  return b;
}

export function viewElevation(p: Project, res: BarsResult, ctx: CadContext): Ents {
  const E = new Ents();
  const g = res.g;
  const { mm } = ctx;
  const Lu = p.Lu;
  const tl = blindT(p);
  const kd = g.dn || 0;
  E.rect(0, 0, Lu, p.tBase, 'OUT');
  E.rect(0, p.tBase, Lu, g.yTop, 'OUT');
  if (tl > 0) {
    E.rect(0, -tl - (g.key && g.key.toe ? kd : 0), Lu, g.key && g.key.toe ? -kd : 0, 'THIN');
  }
  if (g.key) {
    if (g.key.toe) E.rect(0, -kd, Lu, 0, 'OUT');
    else {
      E.poly(
        [
          [0, 0],
          [0, -kd],
          [Lu, -kd],
          [Lu, 0],
        ],
        'HID',
      );
    }
  }
  if (p.type === 'rib') {
    g.ribs.forEach((r) => {
      E.line(r.x0, p.tBase, r.x0, g.yR, 'HID');
      E.line(r.x1, p.tBase, r.x1, g.yR, 'HID');
    });
  }
  E.text(Lu / 2, g.yTop * 0.5, 'MẶT TRƯỚC TƯỜNG', mm(3.2), 'NOTE', { al: 'c' });
  if (p.type === 'rib') {
    E.text(Lu / 2, g.yTop * 0.5 - mm(5), '(đường nét đứt: sườn phía sau)', mm(2.2), 'NOTE', {
      al: 'c',
    });
  }
  E.env = { x0: 0, y0: -kd - tl, x1: Lu, y1: g.yTop };
  {
    const b = p.type === 'rib' ? ribBreaks(p, g) : [0, Lu];
    dimRows(
      E,
      'B',
      [
        {
          lvl: 7.5,
          list: b.slice(1).map((x, i) => [
            [b[i], 0],
            [x, 0],
          ]) as DimRowSpec['list'],
        },
        ...(b.length > 2
          ? [
              {
                lvl: 13,
                list: [
                  [
                    [0, 0],
                    [Lu, 0],
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
      'R',
      [
        {
          lvl: 7.7,
          list: [
            [
              [Lu, 0],
              [Lu, p.tBase],
            ],
            [
              [Lu, p.tBase],
              [Lu, g.yTop],
            ],
          ],
        },
      ],
      ctx,
    );
    if (g.key && g.key.toe) {
      dimRows(
        E,
        'L',
        [
          {
            lvl: 7.7,
            list: [
              tl > 0
                ? [
                    [0, -kd - tl],
                    [0, -kd],
                  ]
                : null,
              [
                [0, -kd],
                [0, 0],
              ],
            ],
          },
        ],
        ctx,
      );
    }
  }
  E.text(0, g.yTop + mm(2), 'Khe lún', mm(2.2), 'NOTE', { al: 'c' });
  E.text(Lu, g.yTop + mm(2), 'Khe lún', mm(2.2), 'NOTE', { al: 'c' });
  finishView(E, 'Mặt đứng', slabel(ctx) + `  –  đơn nguyên L = ${fmt(p.Lu / 100, 2)} m`, ctx);
  return E;
}

export function viewPlan(p: Project, res: BarsResult, ctx: CadContext): Ents {
  const E = new Ents();
  const g = res.g;
  const { mm } = ctx;
  const Lu = p.Lu;
  E.rect(0, 0, Lu, g.B, 'OUT');
  E.line(0, g.t, Lu, g.t, 'OUT');
  E.line(0, g.xbt, Lu, g.xbt, 'OUT');
  if (g.sf) E.line(0, g.xft, Lu, g.xft, 'OUT');
  E.line(0, g.xbb, Lu, g.xbb, 'THIN');
  if (g.key) {
    if (g.key.toe) E.line(0, g.key.x1, Lu, g.key.x1, 'HID');
    else E.rect(0, g.key.x0, Lu, g.key.x1, 'HID');
  }
  if (p.type === 'rib' && g.hyp) {
    g.ribs.forEach((r) => E.rect(r.x0, g.hyp!.T[0], r.x1, g.B, 'OUT'));
  }
  E.text(Lu / 2, -mm(4), 'MẶT TRƯỚC', mm(2.2), 'NOTE', { al: 'c' });
  E.env = { x0: 0, y0: -mm(6), x1: Lu, y1: g.B };
  {
    const b = p.type === 'rib' ? ribBreaks(p, g) : [0, Lu];
    dimRows(
      E,
      'T',
      [
        {
          lvl: 7.5,
          list: b.slice(1).map((x, i) => [
            [b[i], g.B],
            [x, g.B],
          ]) as DimRowSpec['list'],
        },
        ...(b.length > 2
          ? [
              {
                lvl: 13,
                list: [
                  [
                    [0, g.B],
                    [Lu, g.B],
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
              [0, g.B],
            ],
          ],
        },
        {
          lvl: 13,
          list: [
            [
              [0, 0],
              [0, g.B],
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

export function keyRebarC(E: Ents, p: Project, g: GeomData, d: number, ctx: CadContext): number {
  const k = g.key!;
  const c = p.cover;
  const x0 = k.x0;
  const x1 = k.x1;
  const kdr = k.d;
  const L = keyLayoutC(p, g, dotR(d, ctx) + 0.06);
  const xl = L.xl;
  const xr = L.xr;
  const yb = L.yb;
  E.line(x0, 0, x0, -kdr, 'OUT');
  E.line(x1, 0, x1, -kdr, 'OUT');
  E.line(x0, -kdr, x1, -kdr, 'OUT');
  E.line(xl, Math.min(p.tTip - c, 60), xl, yb, 'COV');
  E.line(xr, c - 0.9, xr, yb, 'COV');
  E.line(xl, yb, xr, yb, 'COV');
  L.ties.forEach((y) => E.line(xl, y, xr, y, 'COV'));
  L.rows.forEach((y) => {
    dot(E, xl + 2, y, d, ctx);
    dot(E, xr - 2, y, d, ctx);
  });
  return kdr;
}

export function ribOutline(p: Project, g: GeomData): Point2D[] {
  const o = g.out;
  const h = g.hyp;
  if (!h) return o;
  const iB = o.findIndex((q) => Math.abs(q[0] - g.B) < 1e-6 && Math.abs(q[1] - g.tH) < 1e-6);
  if (iB < 0) return o;
  let j = iB + 1;
  while (j < o.length && o[j][1] < h.T[1] - 1e-6) j++;
  const out = o.slice(0, iB + 1);
  const same = (a: Point2D | undefined, b: Point2D | undefined): boolean =>
    !!a && !!b && Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;
  if (!same(h.E, o[iB])) out.push(h.E);
  if (!same(h.T, o[j])) out.push(h.T);
  return out.concat(o.slice(j));
}

export function ribCutBars(E: Ents, p: Project, res: BarsResult, ctx: CadContext): void {
  const g = res.g;
  if (!g.hyp) return;
  const c = p.cover;
  const by = (k: string) => res.bars.find((b) => b.key === k);
  const { T, E: Ee } = g.hyp;
  const yh = (x: number): number => T[1] + ((Ee[1] - T[1]) * (x - T[0])) / (Ee[0] - T[0]);
  const xh = (y: number): number => T[0] + ((Ee[0] - T[0]) * (T[1] - y)) / (T[1] - Ee[1]);
  res.bars.filter((b) => /^r1[b-f]?$/.test(b.key)).forEach((b) => bar(E, b.path, b.d, ctx));
  const r2 = by('r2');
  const r3 = by('r3');
  if (r2 && r2.rows) {
    r2.rows.forEach((y) =>
      E.poly(
        [
          [g.xf(y) + c, y],
          [xh(y) - c, y],
        ],
        'REB',
        { w: wBar(r2.d, ctx) },
      ),
    );
  }
  if (r3 && r3.xs) {
    r3.xs.forEach((x) =>
      E.poly(
        [
          [x, r3.y0 || 0],
          [x, yh(x) - c],
        ],
        'REB',
        { w: wBar(r3.d, ctx) },
      ),
    );
  }
}

export function ribCutNotes(E: Ents, p: Project, res: BarsResult, ctx: CadContext): void {
  const g = res.g;
  if (!g.hyp) return;
  const { mm } = ctx;
  const c = p.cover;
  const by = (k: string) => res.bars.find((b) => b.key === k);
  const { T, E: Ee } = g.hyp;
  const yh = (x: number): number => T[1] + ((Ee[1] - T[1]) * (x - T[0])) / (Ee[0] - T[0]);
  const lbl = (b: BarSpec): string[] => barLines(b, p);
  const mk = (b: BarSpec): string => String(b.mark);
  const r1s = res.bars.filter((b) => /^r1[b-f]?$/.test(b.key));
  const r2 = by('r2');
  const r3 = by('r3');
  [p.tBase]
    .concat(r1s.length > 1 ? r1s.slice(1).map((b) => b.ys || p.tBase) : [])
    .forEach((y) =>
      (E.chn = E.chn || []).push(mkBox(g.B, y - mm(0.5), g.B + mm(80), y + mm(0.5), { o: 'h' })),
    );
  if (r3 && r3.xs && r3.xs.length) {
    const rows = r2 && r2.rows ? r2.rows.slice().sort((u, v) => u - v) : [p.tBase + 20, p.tBase + 40];
    let pos =
      rows[1] !== undefined
        ? (rows[1] + rows[2 > rows.length - 1 ? rows.length - 1 : 2]) / 2
        : rows[0] + 10;
    if (isB(p) && rows.length > 2) {
      const want = p.tBase + 0.2 * p.H;
      const g2 = 2 * mm(0.45);
      const hs = [
        ...new Set(
          lrSegs(E)
            .filter(([a, b]) => Math.abs(a[1] - b[1]) < 1e-6 && Math.abs(a[0] - b[0]) > mm(1.5))
            .map(([a]) => +a[1].toFixed(2)),
        ),
      ].sort((u, v) => u - v);
      let best: number | null = null;
      for (let i = 1; i < hs.length; i++) {
        if (hs[i] - hs[i - 1] < g2 || hs[i - 1] < p.tBase - 1e-6) continue;
        const m = (hs[i] + hs[i - 1]) / 2;
        if (best === null || Math.abs(m - want) < Math.abs(best - want)) best = m;
      }
      if (best !== null) pos = best;
      else {
        let p2: number | null = null;
        for (let i = 1; i < rows.length; i++) {
          const m = (rows[i - 1] + rows[i]) / 2;
          if (p2 === null || Math.abs(m - want) < Math.abs(p2 - want)) p2 = m;
        }
        if (p2 !== null) pos = p2;
      }
    }
    const lst = r3.xs.filter((x) => yh(x) - c > pos + mm(1));
    if (lst.length) {
      chainNote(E, { axis: 'h', pos, list: lst, side: -1, lines: lbl(r3), mark: mk(r3) }, ctx);
    }
  }
  if (r2 && r2.rows && r2.rows.length) {
    const yMax = Math.max(...r2.rows);
    const px = (g.xf(yMax) + g.xb(yMax)) / 2;
    let topR = -1e18;
    (g.out || []).forEach((q) => {
      if (q[1] > g.yTop - 1e-6) topR = Math.max(topR, q[0]);
    });
    const dxR = topR > -1e17 ? topR - px + mm(1.5) + calloutMin(lbl(r2), mk(r2), ctx) : mm(10);
    chainNote(
      E,
      {
        axis: 'v',
        pos: px,
        list: r2.rows,
        side: 1,
        lines: lbl(r2),
        mark: mk(r2),
        dx: Math.max(mm(10), dxR),
      },
      ctx,
    );
  }
  const colsX = r3 && r3.xs ? r3.xs : [];
  const usedX: number[] = [];
  r1s.forEach((b, k) => {
    const [, S, Pe] = b.path;
    const f0 = k === 0 ? 0.3 : 0.2;
    let f = f0;
    let bp = 1e18;
    for (let i = 0; i <= 240; i++) {
      const ff = 0.06 + (0.6 * i) / 240;
      const x = S[0] + (Pe[0] - S[0]) * ff;
      const dm = colsX.length ? Math.min(...colsX.map((v) => Math.abs(v - x))) : 1e9;
      const pen =
        0.1 * Math.abs(ff - f0) +
        (2 * Math.max(0, mm(1.1) - dm)) / mm(1.1) +
        (usedX.some((u) => Math.abs(u - x) < mm(1.3)) ? 1 : 0);
      if (pen < bp - 1e-12) {
        bp = pen;
        f = ff;
      }
    }
    const pt: Point2D = [S[0] + (Pe[0] - S[0]) * f, S[1] + (Pe[1] - S[1]) * f];
    usedX.push(pt[0]);
    cbl(E, pt, mm(14), mm(5 + 2 * k), lbl(b), mk(b), ctx, { kind: 'line', outY: 1, reb: true });
  });
}

export function ribCutDims(
  E: Ents,
  p: Project,
  res: BarsResult,
  ctx: CadContext,
  l0: number,
): void {
  const g = res.g;
  const r1s = res.bars.filter((b) => /^r1[b-f]?$/.test(b.key));
  const cuts = r1s.length > 1 ? r1s.slice(1).map((b) => (b.ys || p.tBase) - p.tBase) : [];
  const rr = cuts.slice().reverse();
  if (rr.length) {
    dimRows(
      E,
      'R',
      rr.map((h, i) => ({
        lvl: l0 + 5.5 * i,
        list: [
          [
            [g.B, p.tBase],
            [g.B, p.tBase + h],
          ],
        ],
      })),
      ctx,
    );
  }
}

export function viewSectionRebar(
  p: Project,
  res: BarsResult,
  ctx: CadContext,
  cut?: string,
): Ents {
  const E = new Ents();
  const g = res.g;
  const { mm } = ctx;
  const c = p.cover;
  const kd = g.dn || 0;
  const rcut = cut === 'rib';
  E.poly(rcut ? ribOutline(p, g) : g.out, 'OUT', { closed: true });
  if (p.type === 'rib' && g.hyp) E.poly([g.hyp.T, g.hyp.E], rcut ? 'OUT' : 'HID');
  const by = (k: string) => res.bars.find((b) => b.key === k);
  const l1 = by('l1');
  const b1r = by('b1');
  const b2r = by('b2');
  const Rl = l1 ? dotR(l1.d, ctx) : 0;
  const yRowL = l1 && b1r ? (b1r.y || 0) + wBar(b1r.d, ctx) / 2 + Rl + 0.02 : l1 ? l1.yl || 0 : 0;
  const yRowU = l1 && b2r ? (b2r.y || 0) - wBar(b2r.d, ctx) / 2 - Rl - 0.02 : l1 ? l1.yu || 0 : 0;
  const footUp = (b: BarSpec): Point2D[] => {
    const P = b.path.map((q) => [q[0], q[1]] as Point2D);
    const n = P.length;
    if (!l1 || n < 3 || Math.abs(P[n - 1][1] - P[n - 2][1]) > 1e-9) return P;
    const yl = yRowL + Rl + wBar(b.d, ctx) / 2 + 0.02;
    if (P[n - 2][1] < yl) {
      P[n - 2][1] = yl;
      P[n - 1][1] = yl;
    }
    return P;
  };
  (['s1', 's2', 'b1', 'b2', 'k1'] as const).forEach((k) => {
    const b = by(k);
    if (b) bar(E, k === 's1' || k === 's2' ? footUp(b) : b.path, b.d, ctx);
  });
  const an = by('an');
  if (an) ancLines(E, an, ctx);
  const f1 = by('f1');
  if (f1) {
    [f1.path, f1.path.map((q) => [g.B - q[0], q[1]] as Point2D)].forEach((P) => bar(E, P, f1.d, ctx));
  }
  const h1 = by('h1');
  const t1 = by('t1');
  const s1 = by('s1');
  const s2 = by('s2');
  const e1 = by('e1');
  if (h1 && h1.rows) {
    h1.rows.forEach((y) => {
      dot(E, g.xf(y) + c + h1.d / 20, y, h1.d, ctx);
      dot(E, g.xb(y) - c - h1.d / 20, y, h1.d, ctx);
    });
  }
  if (l1 && l1.xs) {
    l1.xs.forEach((x) => {
      dot(E, x, yRowL, l1.d, ctx);
      dot(
        E,
        x,
        x < g.t && Math.abs(p.tBase - p.tTip) > 1e-6
          ? p.tTip + ((p.tBase - p.tTip) * x) / g.t - c - (b2r ? b2r.d : 12) / 10 - l1.d / 20
          : yRowU,
        l1.d,
        ctx,
      );
    });
  }
  const t1b = by('t1b');
  if (t1 && t1.rows) {
    t1.rows.concat(t1b && t1b.rows ? t1b.rows : []).forEach((y) =>
      E.poly(
        [
          [g.xf(y) + c, y],
          [g.xb(y) - c, y],
        ],
        'REB',
        { w: wBar(t1.d, ctx) },
      ),
    );
  }
  if (e1) {
    beamDots(g, e1 as unknown as BarSpecRuntime, c).forEach((q) => dot(E, q.x, q.y, e1.d, ctx));
  }
  if (rcut) ribCutBars(E, p, res, ctx);
  settleDots(E, ctx);
  const bo = blindOutline(p, g);
  if (bo) E.poly(bo, 'THIN');
  E.line(g.xcap, g.yTop, g.B + mm(14), g.yTop, 'THIN');
  E.env = envSection(p, g);
  capDimsA(E, g, ctx);
  keyDepthDim(E, g, ctx);
  if (rcut) ribCutNotes(E, p, res, ctx);
  const lbl = (k: string): string[] => {
    const b = by(k);
    return b ? barLines(b, p) : [];
  };
  const mk = (k: string): string => {
    const b = by(k);
    return b ? String(b.mark) : '';
  };
  const yMid = p.tBase + p.H * 0.6;
  const yLow = p.tBase + p.H * 0.3;
  const U = p.labelUnit;
  const dh = h1 ? h1.d : 12;
  const A = p.tpl === 'A';
  const tA = (b: BarSpec): string => {
    const bn = (b as unknown as BarSpecRuntime).n;
    return bn ? `${bn}${U}${b.d}` : `${U}${b.d},a=${fmt((b.a || 0) * 10)}`;
  };
  const rowsY = h1 && h1.rows ? h1.rows.slice().sort((u, v) => u - v) : [];
  const gapYs = (y0: number, lo: number, hi: number): number[] => {
    const r = rowsY.filter((v) => v >= lo && v <= hi);
    const m: number[] = [];
    for (let i = 1; i < r.length; i++) m.push((r[i] + r[i - 1]) / 2);
    return m.sort((u, v) => Math.abs(u - y0) - Math.abs(v - y0)).slice(0, 16);
  };
  const ca = (
    pt: Point2D,
    sg: 1 | -1,
    len: number,
    b: BarSpec | undefined,
    kind?: 'line' | 'dot',
    slide?: (y: number) => Point2D,
  ): void => {
    if (!b) return;
    const base = { ring: true, kind, minL: 0.6 * mm(len), dots: true };
    const tx = tA(b);
    const mkS = String(b.mark);
    if (slide) {
      for (const y of gapYs(pt[1], p.tBase + 0.04 * p.H, p.tBase + 0.92 * p.H)) {
        const q = slide(y);
        const o2 = Object.assign({ straight: true }, base);
        if (calloutAH(E, q, sg, 0, tx, mkS, ctx, Object.assign({ dry: true }, o2))) {
          calloutAH(E, q, sg, 0, tx, mkS, ctx, o2);
          return;
        }
      }
    }
    calloutAH(E, pt, sg, 0.8 * mm(len), tx, mkS, ctx, base);
  };
  if (A) {
    if (s1 && rcut && g.hyp) {
      const { T: hT, E: hE } = g.hyp;
      const xhy = (y: number): number => hT[0] + ((hE[0] - hT[0]) * (hT[1] - y)) / (hT[1] - hE[1]);
      const hs = [
        ...new Set(
          lrSegs(E)
            .filter(([a, b]) => Math.abs(a[1] - b[1]) < 1e-6 && Math.abs(a[0] - b[0]) > mm(1.5))
            .map(([a]) => +a[1].toFixed(2)),
        ),
      ].sort((u, v) => u - v);
      let yG = yMid;
      let bd = 1e18;
      for (let i = 1; i < hs.length; i++) {
        if (hs[i] - hs[i - 1] < 2 * mm(0.45) || hs[i - 1] < p.tBase) continue;
        const m = (hs[i] + hs[i - 1]) / 2;
        if (Math.abs(m - yMid) < bd) {
          bd = Math.abs(m - yMid);
          yG = m;
        }
      }
      const px = g.xb(yG) - c - dh / 10 - s1.d / 20;
      const tx = tA(s1);
      calloutAH(E, [px, yG], 1, 0, tx, String(s1.mark), ctx, {
        straight: true,
        reb: true,
        ring: true,
        minL: xhy(yG) - px + textW(tx, mm(1.8)) + mm(2.6),
      });
    } else if (s1) {
      ca([g.xb(yMid) - c - dh / 10 - s1.d / 20, yMid], 1, 9, s1, undefined, (y) => [
        g.xb(y) - c - dh / 10 - s1.d / 20,
        y,
      ]);
    }
    if (s2) {
      ca(
        [g.xf(yMid - p.H * 0.25) + c + dh / 10 + s2.d / 20, yMid - p.H * 0.25],
        -1,
        9,
        s2,
        undefined,
        (y) => [g.xf(y) + c + dh / 10 + s2.d / 20, y],
      );
    }
    if (h1 && h1.rows && h1.rows.length) {
      const y = h1.rows[Math.floor(h1.rows.length * 0.85)];
      ca([g.xf(y) + c + h1.d / 20, y], -1, 12, h1, 'dot');
    }
    const yUp = t1b && t1 && t1.rows ? t1.rows[Math.floor(t1.rows.length / 2)] : yLow;
    if (t1 && (t1 as BarSpec & { on?: boolean }).on !== false) {
      ca([(g.xf(yUp) + g.xb(yUp)) / 2, yUp], -1, 10, t1);
    }
  } else {
    if (s1) {
      callout(
        E,
        [g.xb(yMid) - c - dh / 10 - s1.d / 20, yMid],
        mm(14),
        mm(5),
        lbl('s1'),
        mk('s1'),
        ctx,
      );
    }
    if (s2) {
      callout(
        E,
        [g.xf(yMid) + c + dh / 10 + s2.d / 20, yMid],
        -mm(14),
        mm(3),
        lbl('s2'),
        mk('s2'),
        ctx,
      );
    }
    if (h1 && h1.rows && h1.rows.length) {
      const y = h1.rows[Math.floor(h1.rows.length * 0.85)];
      callout(E, [g.xf(y) + c + h1.d / 20, y], -mm(14), mm(10), lbl('h1'), mk('h1'), ctx, {
        kind: 'dot',
      });
    }
    const yUp = t1b && t1 && t1.rows ? t1.rows[Math.floor(t1.rows.length / 2)] : yLow;
    if (t1) {
      callout(E, [(g.xf(yUp) + g.xb(yUp)) / 2, yUp], -mm(16), mm(6), t1Lines(t1, p), mk('t1'), ctx);
    }
    if ((t1b || t1) && t1) {
      const yy = t1b && t1b.rows ? t1b.rows[Math.floor(t1b.rows.length / 2)] : yLow;
      callout(
        E,
        [(g.xf(yy) + g.xb(yy)) / 2, yy],
        -mm(14),
        -mm(4),
        t1Lines(t1, p),
        mk(t1b ? 't1b' : 't1'),
        ctx,
      );
    }
  }
  const b1 = by('b1');
  const b2 = by('b2');
  const sl = (
    k: string,
    pt: Point2D,
    dx: number,
    dy: number,
    ring?: boolean,
    kind?: 'line' | 'dot',
    straight?: boolean,
  ): void => {
    const b = by(k);
    if (!b) return;
    if (A) {
      calloutAH(E, pt, dx < 0 ? -1 : 1, dy, tA(b), String(b.mark), ctx, {
        ring,
        kind,
        minL: Math.abs(dx),
        straight,
      });
    } else {
      callout(E, pt, dx, dy, lbl(k), mk(k), ctx, { kind });
    }
  };
  if (A && rcut && b2) {
    const pR: Point2D = [g.xbb + (g.B - g.xbb) * 0.75, b2.y || 0];
    const tx = tA(b2);
    const mkS = String(b2.mark);
    const opt = { ring: true, minL: mm(12), txtReb: true };
    if (calloutAH(E, pR, 1, mm(9), tx, mkS, ctx, Object.assign({ dry: true }, opt))) {
      calloutAH(E, pR, 1, mm(9), tx, mkS, ctx, opt);
    } else {
      const q0 = b2.path[1];
      const q1 = b2.path[2];
      calloutAH(E, [(q0[0] + q1[0]) / 2, (q0[1] + q1[1]) / 2], -1, mm(9), tx, mkS, ctx, {
        ring: true,
        minL: mm(12),
      });
    }
  } else {
    sl('b2', [g.xbb + (g.B - g.xbb) * 0.75, b2 ? b2.y || 0 : 0], mm(12), mm(9), true);
  }
  sl('b1', [g.xbb + (g.B - g.xbb) * 0.55, b1 ? b1.y || 0 : 0], mm(12), -mm(10) - kd, true);
  if (l1 && l1.xs && l1.xs.length) {
    sl(
      'l1',
      [l1.xs[Math.max(1, Math.floor(l1.xs.length * 0.3))], l1.yl || 0],
      -mm(12),
      -mm(10) - kd,
      true,
      'dot',
    );
  }
  if (A && f1 && g.beam) {
    const tx = tA(f1);
    const mkS = String(f1.mark);
    const yl0 = l1 && l1.yl !== undefined ? l1.yl : 8;
    const yu0 = l1 && l1.yu !== undefined ? l1.yu : p.tBase - 8;
    const base = { ring: true, straight: true, minL: mm(9), dots: true };
    const ys = [0.5, 0.35, 0.65, 0.2, 0.8]
      .map((f) => yl0 + (yu0 - yl0) * f)
      .concat([-0.3, -0.5, -0.7].map((f) => f * g.beam!.d));
    let done = false;
    for (const sd of [-1, 1] as const) {
      for (const y of ys) {
        const pt: Point2D = [sd < 0 ? f1.path[0][0] : g.B - f1.path[0][0], y];
        if (calloutAH(E, pt, sd, 0, tx, mkS, ctx, Object.assign({ dry: true }, base))) {
          calloutAH(E, pt, sd, 0, tx, mkS, ctx, base);
          done = true;
          break;
        }
      }
      if (done) break;
    }
    if (!done) calloutAH(E, [f1.path[0][0], ys[0]], -1, 0, tx, mkS, ctx, base);
  }
  const k1b = by('k1');
  if (k1b && g.key) {
    sl(
      'k1',
      [g.key.x1 - c - k1b.d / 20, -g.key.d * 0.55],
      mm(10),
      A ? 0 : -mm(5),
      true,
      undefined,
      true,
    );
  }
  if (an && an.A && an.A.xs.length) {
    sl(
      'an',
      [an.A.xs[an.A.xs.length - 1], -0.6 * an.A.Lb],
      mm(10),
      A ? 0 : -mm(5),
      true,
      undefined,
      true,
    );
  }
  if (e1 && g.beam) {
    const bd = beamDots(g, e1 as unknown as BarSpecRuntime, c);
    [0, 1].forEach((side) => {
      const cx0 = side ? g.B : 0;
      const ds = bd.filter((q) => q.beam === side);
      if (!ds.length) return;
      const q = ds.reduce(
        (m, v) =>
          Math.hypot(v.x - cx0, v.y + g.beam!.d) < Math.hypot(m.x - cx0, m.y + g.beam!.d) - 1e-6
            ? v
            : m,
        ds[0],
      );
      calloutAH(E, [q.x, q.y], side ? 1 : -1, -mm(7), tA(e1), String(e1.mark), ctx, {
        ring: true,
        kind: 'dot',
        minL: mm(10),
        dots: true,
      });
    });
  }
  (g.beam || g.cap ? dimsSectionA : dimsSection)(E, p, g, ctx, { noKey: true });
  if (rcut) {
    ribCutDims(E, p, res, ctx, !g.beam && !g.cap && Math.abs(g.tH - p.tTip) > 1e-6 ? 13 : 7.7);
  }
  finishView(
    E,
    rcut
      ? 'Cốt thép tường sườn'
      : p.type === 'rib'
        ? 'Mặt cắt ngang (giữa 2 sườn)'
        : 'Mặt cắt ngang',
    slabel(ctx),
    ctx,
  );
  return E;
}

export function viewElevRebar(
  p: Project,
  res: BarsResult,
  ctx: CadContext,
  face: 'back' | 'front',
): Ents {
  const E = new Ents();
  const g = res.g;
  const { mm } = ctx;
  const c = p.cover;
  const Lu = p.Lu;
  const by = (k: string) => res.bars.find((b) => b.key === k);
  E.rect(0, 0, Lu, g.yTop, 'OUT');
  E.line(0, p.tBase, Lu, p.tBase, 'OUT');
  if (p.type === 'rib') {
    g.ribs.forEach((r) => {
      E.line(r.x0, p.tBase, r.x0, g.yR, 'HID');
      E.line(r.x1, p.tBase, r.x1, g.yR, 'HID');
    });
  }
  const vb = by(face === 'back' ? 's1' : 's2');
  const h1 = by('h1');
  const b1 = by('b1');
  const l1 = by('l1');
  const s1 = by('s1');
  const yBot = vb
    ? face === 'back'
      ? c + (b1 ? b1.d : 12) / 10 + (l1 ? l1.d : 12) / 10 + vb.d / 20
      : c + (b1 ? b1.d : 12) / 10 + (l1 ? l1.d : 12) / 10 + (s1 ? s1.d : 12) / 10 + vb.d / 20
    : p.tBase;
  const vs = vb && vb.pos ? vb.pos : [];
  const hs = h1 && h1.rows ? h1.rows : [];
  vs.forEach((x) => E.line(x, g.yTop - c, x, yBot, 'REB'));
  hs.forEach((y) => E.line(c, y, Lu - c, y, 'REB'));
  E.env = { x0: 0, y0: 0, x1: Lu, y1: g.yTop };
  const lbl = (k: string): string[] => {
    const b = by(k);
    return b ? barLines(b, p) : [];
  };
  const hsA = hs.slice().sort((u, v) => u - v);
  if (vb && vs.length) {
    chainNote(
      E,
      {
        axis: 'h',
        pos: bigGap(hsA, yBot, g.yTop - c),
        list: vs,
        side: -1,
        lines: lbl(vb.key),
        mark: String(vb.mark),
      },
      ctx,
    );
  }
  if (h1 && hs.length) {
    chainNote(
      E,
      { axis: 'v', pos: midGap(vs, 1), list: hs, side: 1, lines: lbl('h1'), mark: String(h1.mark) },
      ctx,
    );
  }
  dimRows(
    E,
    'B',
    [
      { lvl: 7.5, list: spacingList(vs, 0, Lu, (x) => [x, yBot]) },
      {
        lvl: 13,
        list: [
          [
            [0, 0],
            [Lu, 0],
          ],
        ],
      },
    ],
    ctx,
  );
  dimRows(
    E,
    'R',
    [
      { lvl: 7.7, list: spacingList(hs, p.tBase, g.yTop, (y) => [Lu, y]) },
      {
        lvl: 13,
        list: [
          [
            [Lu, 0],
            [Lu, p.tBase],
          ],
          [
            [Lu, p.tBase],
            [Lu, g.yTop],
          ],
        ],
      },
    ],
    ctx,
  );
  finishView(
    E,
    isC(p)
      ? 'Mặt cắt 1-1'
      : face === 'back'
        ? 'Thép mặt tường phía giáp đất'
        : 'Thép mặt tường phía mặt trước',
    slabel(ctx),
    ctx,
  );
  return E;
}

export function viewBaseRebar(
  p: Project,
  res: BarsResult,
  ctx: CadContext,
  layer: 'top' | 'bottom',
): Ents {
  const E = new Ents();
  const g = res.g;
  const { mm } = ctx;
  const c = p.cover;
  const Lu = p.Lu;
  const by = (k: string) => res.bars.find((b) => b.key === k);
  E.rect(0, 0, Lu, g.B, 'OUT');
  E.rect(0, g.t, Lu, g.xbb, 'HID');
  if (g.key && !g.key.toe) E.rect(0, g.key.x0, Lu, g.key.x1, 'HID');
  const tr = by(layer === 'top' ? 'b2' : 'b1');
  const l1 = by('l1');
  const k1 = by('k1');
  const ts = tr && tr.pos ? tr.pos : [];
  const ls = l1 && l1.xs ? l1.xs : [];
  const minGap = (arr: number[]): number => {
    const a = arr.slice().sort((u, v) => u - v);
    let m = 1e9;
    for (let i = 1; i < a.length; i++) {
      if (a[i] - a[i - 1] > 1e-6) m = Math.min(m, a[i] - a[i - 1]);
    }
    return m;
  };
  const cp: CadContext = ctx.tang
    ? Object.assign({}, ctx, {
        rCap: Math.min(ctx.rCap || 1e9, 0.42 * Math.min(minGap(ts), minGap(ls))),
      })
    : ctx;
  ts.forEach((x) => E.line(x, c, x, g.B - c, 'REB'));
  ls.forEach((y) => E.line(c, y, Lu - c, y, 'REB'));
  if (layer === 'bottom' && k1 && k1.pos && g.key) {
    k1.pos.forEach((x) => {
      dot(E, x, g.key!.x0 + c + k1.d / 20, k1.d, cp);
      dot(E, x, g.key!.x1 - c - k1.d / 20, k1.d, cp);
    });
  }
  settleDots(E, cp);
  E.env = { x0: 0, y0: 0, x1: Lu, y1: g.B };
  const lbl = (k: string): string[] => {
    const b = by(k);
    return b ? barLines(b, p) : [];
  };
  const lsA = ls.slice().sort((u, v) => u - v);
  const tsA = ts.slice().sort((u, v) => u - v);
  const kRows =
    layer === 'bottom' && k1 && g.key ? [g.key.x0 + c + k1.d / 20, g.key.x1 - c - k1.d / 20] : [];
  const kCols = layer === 'bottom' && k1 && k1.pos ? k1.pos : [];
  if (tr && ts.length) {
    chainNote(
      E,
      {
        axis: 'h',
        pos: freeGap(lsA, Math.min(2, Math.max(0, lsA.length - 2)), kRows, mm(2.4)),
        list: ts,
        side: 1,
        lines: lbl(tr.key),
        mark: String(tr.mark),
      },
      ctx,
    );
  }
  if (l1 && ls.length) {
    chainNote(
      E,
      {
        axis: 'v',
        pos: freeGap(tsA, Math.max(0, tsA.length - 3), kCols, mm(2.4)),
        list: ls,
        side: -1,
        dx: mm(14),
        lines: lbl('l1'),
        mark: String(l1.mark),
      },
      ctx,
    );
  }
  if (layer === 'bottom' && k1 && k1.pos && g.key) {
    chainNote(
      E,
      {
        axis: 'h',
        pos: g.key.x1 - c - k1.d / 20,
        list: k1.pos,
        side: 1,
        kind: 'dot',
        lines: lbl('k1'),
        mark: String(k1.mark),
      },
      ctx,
    );
  }
  {
    const rows: DimRowSpec[] = [{ lvl: 0, list: spacingList(ts, 0, Lu, (x) => [x, g.B]) }];
    if (layer === 'bottom' && k1 && k1.pos && g.key) {
      rows.push({ lvl: 0, list: spacingList(k1.pos, 0, Lu, (x) => [x, g.key!.x1]) });
    }
    rows.push({
      lvl: 0,
      list: [
        [
          [0, g.B],
          [Lu, g.B],
        ],
      ],
    });
    rows.forEach((r, i) => {
      r.lvl = 7.5 + 5.5 * i;
    });
    dimRows(E, 'T', rows, ctx);
  }
  dimRows(
    E,
    'L',
    [
      { lvl: 7.7, list: spacingList(ls, 0, g.B, (y) => [0, y]) },
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
            [0, g.B],
          ],
        ],
      },
      {
        lvl: 18.5,
        list: [
          [
            [0, 0],
            [0, g.B],
          ],
        ],
      },
    ],
    ctx,
  );
  finishView(
    E,
    isC(p)
      ? 'Mặt cắt 4-4'
      : layer === 'top'
        ? 'Mặt bằng thép bản đáy lớp trên'
        : 'Mặt bằng thép bản đáy lớp dưới',
    slabel(ctx),
    ctx,
  );
  return E;
}

export function ribCutLevel(p: Project, res: BarsResult): number {
  const r1all = res.bars.filter((b) => /^r1[b-f]?$/.test(b.key) && b.P0);
  const minS = r1all.length > 1 ? Math.min(...r1all.map((b) => b.ys || 0)) - p.tBase : 0;
  return p.tBase + (minS > 0 ? Math.min(p.H / 2, Math.max(60, 0.8 * minS)) : p.H / 2);
}

export function viewRibPlanCut(p: Project, res: BarsResult, ctx: CadContext): Ents {
  const E = new Ents();
  const g = res.g;
  const { mm } = ctx;
  const c = p.cover;
  const Lu = p.Lu;
  const by = (k: string) => res.bars.find((b) => b.key === k);
  const yc = ribCutLevel(p, res);
  const xs = g.xb(yc);
  const xfc = g.xf(yc);
  const { T, E: Ee } = g.hyp!;
  const xh = T[0] + ((Ee[0] - T[0]) * (T[1] - yc)) / (T[1] - Ee[1]);
  const pts: Point2D[] = [
    [0, xfc],
    [Lu, xfc],
    [Lu, xs],
  ];
  for (let i = g.ribs.length - 1; i >= 0; i--) {
    const r = g.ribs[i];
    pts.push([r.x1, xs], [r.x1, xh], [r.x0, xh], [r.x0, xs]);
  }
  pts.push([0, xs]);
  E.poly(pts, 'OUT', { closed: true });
  const h1 = by('h1');
  const s1 = by('s1');
  const s2 = by('s2');
  const r1 = by('r1');
  const r2 = by('r2');
  const dh1 = h1 ? h1.d : 12;
  const o = (d: number): number => c + dh1 / 10 + d / 20;
  const cx: CadContext = ctx.tang
    ? Object.assign({}, ctx, {
        rCap: Math.min(
          ctx.rCap || 1e9,
          0.38 *
            Math.min(
              (p.rb.s1 && p.rb.s1.a) || 10,
              (p.rb.s2 && p.rb.s2.a) || 10,
              (p.rb.r1 && p.rb.r1.sp) || 10,
            ),
        ),
      })
    : ctx;
  if (h1) {
    E.poly(
      [
        [c, xfc + c + h1.d / 20],
        [Lu - c, xfc + c + h1.d / 20],
      ],
      'REB',
      { w: wBar(h1.d, ctx) },
    );
    E.poly(
      [
        [c, xs - c - h1.d / 20],
        [Lu - c, xs - c - h1.d / 20],
      ],
      'REB',
      { w: wBar(h1.d, ctx) },
    );
  }
  const legsX: number[] = [];
  if (cx.tang && r2) {
    g.ribs.forEach((r) => legsX.push(r.x0 + c + r2.d / 20, r.x1 - c - r2.d / 20));
  }
  const avoidLegs = (pos: number[], d: number): number[] => {
    if (!legsX.length || !r2) return pos;
    const R = dotR(d, cx);
    const w = R + r2.d / 20 + 0.3;
    const gap = 2 * R + 0.3;
    const outX: number[] = [];
    let prev = -1e9;
    pos
      .slice()
      .sort((u, v) => u - v)
      .forEach((x) => {
        let v = Math.max(x, prev + gap);
        for (let it = 0; it < 6; it++) {
          const L = legsX.find((l) => Math.abs(v - l) < w - 1e-6);
          if (L === undefined) break;
          v = v <= L && L - w >= prev + gap && v - (L - w) <= L + w - v ? L - w : L + w;
        }
        outX.push(v);
        prev = v;
      });
    return outX;
  };
  if (s2 && s2.pos) {
    avoidLegs(s2.pos, s2.d).forEach((x) => dotT(E, x, xfc + o(s2.d), s2.d, cx, 0, 1));
  }
  if (s1 && s1.pos) {
    avoidLegs(s1.pos, s1.d).forEach((x) => dotT(E, x, xs - o(s1.d), s1.d, cx, 0, -1));
  }
  if (r2) {
    g.ribs.forEach((r) => {
      const q = r2.d / 20;
      E.poly(
        [
          [r.x0 + c + q, xfc + c + 2 * q],
          [r.x0 + c + q, xh - c - q],
          [r.x1 - c - q, xh - c - q],
          [r.x1 - c - q, xfc + c + 2 * q],
        ],
        'REB',
        { w: wBar(r2.d, ctx) },
      );
    });
  }
  const dr2 = r2 ? r2.d : 12;
  const r1at = (b: BarSpec): number | null =>
    b.P0 && b.u && b.ys !== undefined
      ? yc <= b.ys + 1e-6
        ? b.P0[0] + (b.u[0] * (yc - b.P0[1])) / b.u[1]
        : null
      : xh - c - dr2 / 10 - b.d / 20;
  const r1s = res.bars.filter((b) => /^r1[b-f]?$/.test(b.key));
  const r1x = (r: { x0: number; x1: number }, b: BarSpec, i: number): number => {
    const bn = (b as unknown as BarSpecRuntime).n || 1;
    return (
      r.x0 +
      c +
      dr2 / 10 +
      b.d / 20 +
      (bn > 1
        ? (i * (p.rib.t - 2 * c - (2 * dr2) / 10 - b.d / 10)) / (bn - 1)
        : (p.rib.t - 2 * c) / 2 - dr2 / 10 - b.d / 20)
    );
  };
  const r1d: Array<{ r: { x0: number; x1: number }; x: number; y: number; R: number }> = [];
  const occ: Array<{ y: number; R: number }> = [];
  r1s.forEach((b) => {
    const yy = r1at(b);
    if (yy === null) return;
    const bn = (b as unknown as BarSpecRuntime).n || 1;
    g.ribs.forEach((r) => {
      for (let i = 0; i < bn; i++) {
        const ux = bn > 1 ? (i === 0 ? 1 : i === bn - 1 ? -1 : 0) : 0;
        const k = cx.tang ? Math.max(0, dotR(b.d, cx) - b.d / 20) : 0;
        const px = r1x(r, b, i) + k * ux;
        const py = yy - k;
        dot(E, px, py, b.d, cx);
        r1d.push({ r, x: px, y: py, R: dotR(b.d, cx) });
        occ.push({ y: py, R: dotR(b.d, cx) });
      }
    });
  });
  const r3 = by('r3');
  if (r3 && r2 && r3.xs) {
    g.ribs.forEach((r) => {
      const R3 = dotR(r3.d, cx);
      const k3 = cx.tang ? Math.max(0, R3 - r3.d / 20) : 0;
      const yLo = xs + (cx.tang ? R3 + 0.3 : 0);
      const yHi = xh - c - r2.d / 10 - (cx.tang ? R3 : 2);
      (
        [
          [r.x0 + c + r2.d / 10 + r3.d / 20 + k3, 1],
          [r.x1 - c - r2.d / 10 - r3.d / 20 - k3, -1],
        ] as const
      ).forEach(([px]) => {
        const placed: number[] = [];
        r3.xs!
          .filter((x) => x < xh - c - r2.d / 10 - 2)
          .slice()
          .sort((u, v) => u - v)
          .forEach((x) => {
            let y = x;
            if (cx.tang) {
              const ok = (yy: number): boolean =>
                yy >= yLo &&
                yy <= yHi &&
                r1d.every((oo) => oo.r !== r || Math.hypot(oo.x - px, oo.y - yy) >= oo.R + R3 + 0.3) &&
                placed.every((q) => Math.abs(q - yy) >= 2 * R3 + 0.3);
              let f: number | null = null;
              for (let dlt = 0; dlt <= (r3.a || 10) / 2 + 1e-6 && f === null; dlt += 0.5) {
                if (ok(x + dlt)) f = x + dlt;
                else if (dlt > 0 && ok(x - dlt)) f = x - dlt;
              }
              if (f === null) return;
              y = f;
            }
            placed.push(y);
            occ.push({ y, R: R3 });
            dot(E, px, y, r3.d, cx);
          });
      });
    });
  }
  if (cx.tang) settleDots(E, cx);
  E.env = { x0: 0, y0: xfc, x1: Lu, y1: xh };
  const b = ribBreaks(p, g);
  {
    const ch = (E.chn = E.chn || []);
    const t = mm(0.35);
    [xfc, xs].forEach((y) => ch.push(mkBox(-mm(9), y - t, 0, y + t, { o: 'h' })));
  }
  if (s2 && s2.pos) {
    const ch = (E.chn = E.chn || []);
    const t = mm(0.35);
    [
      ...new Set(
        spacingList(s2.pos, 0, Lu, (x) => x)
          .flatMap((d) => [d[0], d[1]])
          .map((v) => +v.toFixed(3)),
      ),
    ].forEach((x) => ch.push(mkBox(x - t, xfc - mm(14), x + t, xfc, { o: 'v' })));
  }
  const lbl = (k: string): string[] => {
    const b0 = by(k);
    return b0 ? barLines(b0, p) : [];
  };
  const mk = (k: string): string => {
    const b0 = by(k);
    return b0 ? String(b0.mark) : '';
  };
  const r0 = g.ribs[Math.min(1, g.ribs.length - 1)];
  let y2: number | null = null;
  let lowChain = false;
  if (r2) {
    const q2 = r2.d / 20;
    const legs: number[] = [];
    g.ribs.forEach((r) => legs.push(r.x0 + c + q2, r.x1 - c - q2));
    const rows3 =
      r3 && r3.xs ? r3.xs.filter((x) => x < xh - c - r2.d / 10 - 2).sort((u, v) => u - v) : [];
    const mids: number[] = [];
    for (let i = 1; i < rows3.length; i++) mids.push((rows3[i - 1] + rows3[i]) / 2);
    const yT2 = xs + 0.55 * (xh - xs);
    let cand = mids.slice().sort((u, v) => Math.abs(u - yT2) - Math.abs(v - yT2));
    if (ctx.tang) {
      const free = cand.filter((m) => occ.every((oo) => Math.abs(oo.y - m) >= oo.R + mm(0.35) + 0.3));
      if (free.length) cand = free;
    }
    y2 = cand.length ? cand[0] : yT2;
    if (r3 && r3.xs && !(isB(p) && r1 && r1.P0 && r1s.some((oo) => r1at(oo) !== null))) {
      const rr3 = r3.xs.filter((x) => x < xh - c - 4);
      const okY = (m: number): boolean =>
        rr3.some(
          (y) =>
            Math.min(
              y - mm(2.7) - xs,
              Math.max(m - mm(0.35) - (y + mm(2.9)), y - mm(2.7) - (m + mm(0.35))),
            ) >= mm(0.2),
        );
      const f = cand.find(okY);
      if (f !== undefined) y2 = f;
      else if (rr3.length && !okY(y2)) {
        y2 = Math.min(xs + mm(3.4), xh - c - r2.d / 10 - 1);
        lowChain = true;
      }
    }
    chainNote(
      E,
      { axis: 'h', pos: y2, list: legs, side: -1, lines: barLines(r2, p), mark: mk('r2') },
      ctx,
    );
  }
  if (h1) {
    const gx0 =
      g.ribs.length > 1
        ? (g.ribs[0].x1 + g.ribs[1].x0) / 2
        : g.ribs.length === 1
          ? g.ribs[0].x0 / 2
          : Lu / 2;
    const sp1 = (s1 && s1.pos ? s1.pos : s2 && s2.pos ? s2.pos : [gx0]).slice().sort((u, v) => u - v);
    let gx = gx0;
    let bd = 1e18;
    for (let i = 1; i < sp1.length; i++) {
      const m = (sp1[i - 1] + sp1[i]) / 2;
      if (Math.abs(m - gx0) < bd) {
        bd = Math.abs(m - gx0);
        gx = m;
      }
    }
    chainNote(
      E,
      {
        axis: 'v',
        pos: gx,
        list: [xfc + c + h1.d / 20, xs - c - h1.d / 20],
        side: -1,
        dx: mm(14),
        lines: lbl('h1'),
        mark: mk('h1'),
      },
      ctx,
    );
  }
  const aS = mm(1.6);
  const r1v =
    r1 && r1.P0
      ? r1s.map((b0) => ({ b: b0, yy: r1at(b0) })).filter((oo): oo is { b: BarSpec; yy: number } => oo.yy !== null)
      : [];
  const stackR = isB(p) && r1v.length > 0 && !!r2;
  if (stackR) {
    const rr = g.ribs[g.ribs.length - 1];
    const specs = r1v.map((oo) => ({
      pt: [r1x(rr, oo.b, ((oo.b as unknown as BarSpecRuntime).n || 1) - 1), oo.yy] as Point2D,
      lines: barLines(oo.b, p),
      mark: oo.b.mark,
    }));
    if (r3 && r3.xs && r2) {
      const xx = r3.xs.filter((x) => x < xh - c - r2.d / 10 - 2).sort((u, v) => u - v);
      const t3 = xx.find((y) => y >= xs + mm(3.2)) !== undefined ? xx.find((y) => y >= xs + mm(3.2)) : xx[xx.length - 1];
      if (t3 !== undefined) {
        specs.push({
          pt: [rr.x1 - c - r2.d / 10 - r3.d / 20, t3],
          lines: barLines(r3, p),
          mark: r3.mark,
        });
      }
    }
    fanLabels(E, specs, ctx, { yMin: xs, xMax: Lu - 10 - mm(1.5), xBeyond: Lu + mm(2.5) });
  } else if (r1 && r1.P0) {
    r1s.forEach((b0, k) => {
      const yy = r1at(b0);
      if (yy === null) return;
      const r = g.ribs[k % g.ribs.length];
      const sameRib = k >= g.ribs.length;
      cbl(
        E,
        [r1x(r, b0, ((b0 as unknown as BarSpecRuntime).n || 1) - 1), yy],
        mm(14),
        0,
        barLines(b0, p),
        String(b0.mark),
        ctx,
        sameRib
          ? { asz: aS, kind: 'dot', outY: -1, diag: 1, reb: !!ctx.tplA }
          : { asz: aS, kind: 'dot', fixY: true },
      );
    });
  } else if (r1 && r0) {
    cbl(
      E,
      [r0.x0 + p.rib.t / 2, xh - c - dr2 / 10 - r1.d / 20],
      isC(p) ? -mm(13) : mm(3),
      isC(p) ? mm(11) : mm(14),
      barLines(r1, p),
      mk('r1'),
      ctx,
      { asz: aS, kind: 'dot' },
    );
  }
  if (r3 && r3.xs && !stackR && r0) {
    const xx = r3.xs.filter((x) => x < xh - c - 4);
    if (xx.length) {
      const mid = xx[Math.floor(xx.length / 2)];
      const clr = (y: number): number =>
        Math.min(
          y - mm(2.7) - xs,
          y2 === null
            ? 1e9
            : Math.max(y2 - mm(0.35) - (y + mm(2.9)), y - mm(2.7) - (y2 + mm(0.35))),
        );
      const okR = xx.filter((y) => clr(y) >= mm(0.2));
      const pool = okR.length ? okR : [xx.reduce((best, y) => (clr(y) > clr(best) ? y : best), xx[0])];
      const ty = pool.reduce((best, y) => (Math.abs(y - mid) < Math.abs(best - mid) ? y : best), pool[0]);
      const px3 = r0.x1 - c - dr2 / 10 - r3.d / 20;
      if (!okR.length && lowChain) {
        const yt = xx[xx.length - 1];
        cbl(
          E,
          [px3, yt],
          mm(14),
          Math.max(mm(4), (y2 === null ? xs : y2) + mm(0.35) + mm(2.9) + mm(0.4) - yt),
          barLines(r3, p),
          mk('r3'),
          ctx,
          { asz: aS, kind: 'dot', outY: 1, diag: 1 },
        );
      } else {
        cbl(E, [px3, ty], mm(14), 0, barLines(r3, p), mk('r3'), ctx, {
          asz: aS,
          kind: 'dot',
          fixY: true,
        });
      }
    }
  }
  const one = g.ribs.length === 1;
  const near = (arr: number[], x: number): number =>
    arr.reduce((m, v) => (Math.abs(v - x) < Math.abs(m - x) ? v : m), arr[0]);
  const rsp = one ? (g.ribs[0].x1 + Lu) / 2 : 0;
  const oneL = one && isB(p);
  const inGap = (x: number): boolean => g.ribs.every((r) => x < r.x0 - mm(1.5) || x > r.x1 + mm(1.5));
  const gapPos = (pos: number[], w: number): number => {
    if (isC(p)) return w;
    const ok = pos.filter(inGap);
    return ok.length ? near(ok, w) : w;
  };
  const tryDots = (
    pos: number[],
    w: number,
    draw: (x: number) => boolean | { ok?: boolean } | null | void,
  ): number => {
    const cands = isC(p)
      ? [w]
      : [w].concat(
          pos
            .filter((x) => inGap(x) && x !== w)
            .sort((u, v) => Math.abs(u - w) - Math.abs(v - w))
            .slice(0, 80),
        );
    for (const x of cands) {
      const na = E.a.length;
      const nl = E.lbl.length;
      const r = draw(x);
      if (r !== false && (!r || typeof r !== 'object' || r.ok !== false)) return x;
      E.a.length = na;
      E.lbl.length = nl;
    }
    draw(w);
    return w;
  };
  if (s1 && s1.pos && s1.pos.length) {
    const dr1 = (x: number) =>
      cbl(
        E,
        [x, xs - o(s1.d)],
        oneL ? -mm(6) : mm(6),
        isC(p) || one ? mm(9) : -mm(14),
        lbl('s1'),
        mk('s1'),
        ctx,
        { kind: 'dot' },
      );
    if (oneL) dr1(near(s1.pos, g.ribs[0].x0 * 0.72));
    else if (one) dr1(near(s1.pos, (rsp + Lu) / 2));
    else {
      tryDots(s1.pos, gapPos(s1.pos, s1.pos[Math.floor(s1.pos.length / 2) + 1] || s1.pos[0]), dr1);
    }
  }
  if (s2 && s2.pos && s2.pos.length) {
    const dr2 = (x: number) =>
      cbl(E, [x, xfc + o(s2.d)], mm(6), -mm(8), lbl('s2'), mk('s2'), ctx, { kind: 'dot' });
    if (one) dr2(near(s2.pos, rsp));
    else tryDots(s2.pos, gapPos(s2.pos, s2.pos[Math.floor(s2.pos.length / 2)]), dr2);
  }
  dimRows(
    E,
    'T',
    [
      { lvl: 7.5, list: s1 && s1.pos ? spacingList(s1.pos, 0, Lu, (x) => [x, xs - o(s1.d)]) : [] },
      {
        lvl: 13,
        list: b.slice(1).map((x, i) => [
          [b[i], xh],
          [x, xh],
        ]) as DimRowSpec['list'],
      },
      {
        lvl: 18.5,
        list: [
          [
            [0, xh],
            [Lu, xh],
          ],
        ],
      },
    ],
    ctx,
  );
  dimRows(
    E,
    'B',
    [{ lvl: 7.5, list: s2 && s2.pos ? spacingList(s2.pos, 0, Lu, (x) => [x, xfc + o(s2.d)]) : [] }],
    ctx,
  );
  {
    const tlStr = String(Math.round((xs - xfc) * 10));
    dimRows(E, 'L', [{ lvl: 7.7, list: [[[0, xfc], [0, xs], tlStr, { dxfTxt: tlStr }]] }], ctx);
  }
  finishView(
    E,
    isC(p) ? 'Mặt cắt 3-3' : `Mặt cắt ngang thân tường tại cao độ +${fmt(yc * 10)}`,
    slabel(ctx),
    ctx,
  );
  return E;
}
