import { geom } from '../engine';
import type { BarsResult, CadCircleEntity, CadContext, Point2D, Project } from '../types/project';
import {
  bar,
  calloutM,
  type CalloutMSpec,
  calloutMPlan,
  CM_SHIFTS,
  dot,
  snapTo,
} from './dimCallout';
import { settleDots } from './dots';
import { Ents, mkBox } from './ents';
import { blindOutline, clamp, ckey, fmt, textW, type TemplateCGModel } from './layers';
import {
  ancLines,
  dimsSectionC,
  envSection,
  finishView,
  keyRebarC,
  ribCutLevel,
  secH,
  secSym,
  slabel,
} from './viewsCommon';

export { calloutM, calloutMPlan, CM_SHIFTS, snapTo };

export function viewSectionRebarC(
  p: Project,
  res: BarsResult,
  ctx: CadContext,
  mode?: string,
): Ents {
  const E = new Ents();
  const g = res.g;
  const G = res.G as unknown as TemplateCGModel;
  const { mm } = ctx;
  const c = p.cover;
  const rib = mode === 'rib';
  const yT = g.yTop;
  const B = g.B;
  const U = p.labelUnit;

  const mapX = (x: number): number =>
    x < 0
      ? x
      : x <= 90
        ? (x * g.t) / 90
        : x <= 150
          ? g.t + ((x - 90) * (g.xbb - g.t)) / 60
          : x <= 300
            ? g.xbb + ((x - 150) * (B - g.xbb)) / 150
            : B + (x - 300);

  const mapY = (y: number): number =>
    y < 0
      ? y
      : y <= 80
        ? (y * p.tBase) / 80
        : y <= 380
          ? p.tBase + ((y - 80) * (yT - p.tBase)) / 300
          : yT + (y - 380);

  const S1 = (x: number, y: number): Point2D => [mapX(x), mapY(y)];
  const rbEntry = (m: string) => p.rb[ckey(m)] || { d: 12, a: 20 };
  const dd = (m: string): number => rbEntry(m).d;

  const gk = g.key;
  const g0 = gk ? geom(Object.assign({}, p, { key: Object.assign({}, p.key, { on: false }) })) : g;
  E.poly(g0.out, 'OUT', { closed: true });
  if (g.hyp) E.poly([g.hyp.T, g.hyp.E], 'OUT');

  const an = res.bars.find((b) => b.key === 'an' && b.A) || null;
  const on = (m: string): boolean => (m === '17' ? !!an : rbEntry(m).on !== false);
  const L = (m: string, ls: Point2D[][]): void => {
    if (on(m)) ls.forEach((l) => bar(E, l, dd(m), ctx));
  };

  L('1', G.l1);
  L('9', G.l9);
  L('3', [G.p3]);
  L('4', [G.p4]);
  L('6', [G.p6]);
  L('7', [G.p7]);
  L('8', [G.p8]);
  if (an) ancLines(E, an, ctx);
  if (!rib) {
    L('10', G.l10);
    L('16', G.l16);
  } else {
    L('11', G.l11);
    L('12', G.l12);
    L('13', [G.p13]);
    if (on('15')) {
      G.ticks.forEach((q) => {
        const h = mm(1.3);
        const cs = 0.777;
        const sn = -0.629;
        E.line(q[0] - h * cs, q[1] - h * sn, q[0] + h * cs, q[1] + h * sn, 'REB');
      });
    }
  }
  if (on('2')) G.dots.d2.forEach((q) => dot(E, q[0], q[1], dd('2'), ctx));
  if (on('5')) G.dots.d5.forEach((q) => dot(E, q[0], q[1], dd('5'), ctx));
  if (on('5A')) G.dots.d5a.forEach((q) => dot(E, q[0], q[1], dd('5A'), ctx));
  settleDots(E, ctx);

  let g1 = g;
  if (gk) {
    const kdr = keyRebarC(E, p, g, dd('2'), ctx);
    g1 = Object.assign({}, g, { key: Object.assign({}, gk, { d: kdr }) });
    settleDots(E, ctx, { layers: ['REB', 'COV', 'OUT'] });
    const kx = gk.x1;
    const ky = -0.5 * kdr;
    const TH = mm(2);
    const ex = kx + mm(8);
    const ey = ky - mm(6);
    const w = textW('Chân khay', TH) + mm(1.5);
    E.line(kx, ky, ex, ey, 'LEAD');
    E.line(ex, ey, ex + w, ey, 'LEAD');
    E.text(ex + mm(0.6), ey + mm(0.6), 'Chân khay', TH, 'LBL');
    E.lbl.push(mkBox(kx, ey - mm(0.3), ex + w, ey + mm(3)));
  }

  const bo = blindOutline(p, g1);
  if (bo) E.poly(bo, 'THIN');
  E.env = envSection(p, g1);

  const hs = secH(ctx);
  const SL = 2.49 * hs;
  const xc1 = mapX(233.1);
  const y3 = ribCutLevel(p, res);
  const y4 = c + (dd('1') + dd('2')) / 10 + 1;
  const xr = B + mm(32.3);
  secSym(E, ctx, [xc1, yT + mm(14) + SL], [0, -1], [-1, 0], '1');
  secSym(E, ctx, [xc1, -Math.max(mm(7), an && an.A ? an.A.Lb + mm(1.5) : 0) - SL], [0, 1], [-1, 0], '1');
  secSym(E, ctx, [xr, y3], [-1, 0], [0, -1], '3');
  secSym(E, ctx, [xr, y4], [-1, 0], [0, -1], '4');

  const lab = (m: string): string[] => [`${U}${dd(m)}`, `a=${fmt((rbEntry(m).a || 0) * 10)}`];
  const T = (k: string, ...pts: Point2D[]): Point2D[] =>
    pts.map((q) => snapTo(G.geo[k] || {}, S1(q[0], q[1])));

  const sp = (
    m: string,
    bub: 'L' | 'R',
    k: string,
    pts: Point2D[],
    el: Point2D | null,
    end: Point2D,
    via?: Point2D[],
  ): CalloutMSpec => ({
    mark: m,
    bub,
    tg: T(k, ...pts),
    kind: G.geo[k] && G.geo[k].dots ? 'dot' : 'line',
    el: el ? S1(el[0], el[1]) : null,
    end: S1(end[0], end[1]),
    via: (via || []).map((q) => S1(q[0], q[1])),
    lines: lab(m.toUpperCase()),
  });

  const specs: CalloutMSpec[] = [];
  specs.push(
    sp(
      '5A',
      'L',
      'c5a',
      [
        [125.1, 372.6],
        [142.8, 373.2],
      ],
      [60.6, 447.6],
      [4.9, 447.6],
    ),
  );
  specs.push(sp('8', 'L', 'c8', [[134.9, 375]], [134.9, 353.9], [50, 353.9]));
  if (!rib) {
    specs.push(
      sp(
        '5',
        'L',
        'c5',
        [
          [112.7, 221],
          [142.8, 239.5],
          [120.2, 319.1],
          [142.8, 279.5],
        ],
        [60.6, 268.4],
        [4.9, 268.4],
      ),
    );
    specs.push(sp('7', 'L', 'c7', [[106.5, 184.7]], null, [40.3, 184.7]));
    specs.push(
      sp(
        '16',
        'R',
        'c16',
        [
          [132, 204.5],
          [132, 303.8],
        ],
        [132, 265.7],
        [217.7, 265.7],
      ),
    );
    specs.push(sp('6', 'R', 'c6', [[145, 191.2]], null, [226, 191.2]));
    specs.push(sp('4', 'R', 'c4', [[144, 73]], [236.2, 143.4], [296.2, 143.4]));
    specs.push(
      sp(
        '1',
        'R',
        'c1',
        [
          [187.7, 5],
          [187.7, 45],
        ],
        [187.7, 83.5],
        [248.7, 83.5],
      ),
    );
    specs.push(
      sp(
        '2',
        'R',
        'c2',
        [
          [255, 43],
          [270.7, 7],
          [293, 43],
        ],
        [348.6, 98.3],
        [403.8, 98.3],
      ),
    );
    specs.push(
      sp(
        '10',
        'R',
        'c10',
        [
          [210.5, 28.2],
          [254.8, 28.2],
        ],
        null,
        [391.4, 28.2],
      ),
    );
    specs.push(
      sp(
        '9',
        'L',
        'c9',
        [
          [295, 20],
          [5, 20],
        ],
        [-27.8, 20],
        [-81.2, -63.1],
        [[-27.8, -63.1]],
      ),
    );
  } else {
    specs.push(sp('7', 'L', 'c7', [[109.8, 210.7]], null, [40.6, 210.7]));
    {
      const y11 = mapY(71.9);
      specs.push({
        mark: '11',
        bub: 'R',
        kind: 'line',
        tg: G.xs11.map((x) => snapTo(G.geo.c11 || {}, [x, y11])),
        el: null,
        end: S1(414.4, 71.9),
        via: [],
        lines: lab('11'),
      });
    }
    const cols = [g.xbb - c, ...G.xs11].sort((u, v) => u - v);
    const xv0 = mapX(162.8);
    let xv = xv0;
    let bd = 1e18;
    for (let i = 1; i < cols.length; i++) {
      const m = (cols[i - 1] + cols[i]) / 2;
      if (cols[i] - cols[i - 1] > 8 && Math.abs(m - xv0) < bd) {
        bd = Math.abs(m - xv0);
        xv = m;
      }
    }
    const rowsT: Point2D[] = G.rows.map((y) => {
      const a = G.x7(y) + 1;
      const b = G.xOf(y) - 1;
      return [clamp(xv, a, b), y];
    });
    const s12: CalloutMSpec = {
      mark: '12',
      bub: 'R',
      kind: 'line',
      tg: rowsT,
      el: S1(162.8, 259.4),
      end: S1(301.6, 259.4),
      via: [],
      lines: lab('12'),
    };
    s12.el![0] = xv;
    specs.push(s12);
    specs.push(sp('13', 'R', 'c13', [[199.4, 196.5]], [246.5, 197.7], [308.3, 197.7]));
    specs.push({
      mark: '15',
      bub: 'R',
      kind: 'line',
      tg: G.ticks.map((q) => [q[0], q[1]] as Point2D),
      el: S1(274.4, 129.3),
      end: S1(341.8, 129.3),
      via: [],
      lines: lab('15'),
    });
  }
  if (on('3')) {
    const dots = E.a.filter((e): e is CadCircleEntity => e.k === 'C' && e.ly === 'RDOT');
    const a3 = G.p3[1];
    const b3 = G.p3[2];
    let q3: Point2D | null = null;
    let bd3 = -1;
    for (let i = 0; i <= 90; i++) {
      const f = 0.06 + (0.88 * i) / 90;
      const q: Point2D = [a3[0] + (b3[0] - a3[0]) * f, a3[1] + (b3[1] - a3[1]) * f];
      if (q[0] > g.t * 0.97) continue;
      const d = dots.reduce((m, o) => Math.min(m, Math.hypot(o.x - q[0], o.y - q[1])), 1e9);
      if (d > bd3 + 1e-9) {
        bd3 = d;
        q3 = q;
      }
    }
    if (q3) {
      specs.push({
        mark: '3',
        bub: 'L',
        kind: 'line',
        tg: [q3],
        el: [q3[0], mapY(118)],
        end: [mapX(10), mapY(118)],
        via: [],
        lines: lab('3'),
      });
    }
  }
  if (an && an.A) {
    const xs = an.A.xs;
    const yL = -0.5 * an.A.Lb;
    specs.push({
      mark: '17',
      bub: 'R',
      kind: 'line',
      tg: xs.slice(Math.max(0, xs.length - 2)).map((x) => [x, yL] as Point2D),
      el: null,
      end: [B + mm(17.5), yL],
      via: [],
      lines: [`${U}${an.d}`, `a=${fmt((an.a || 0) * 10)}`],
    });
  }

  const edges = (pts: Point2D[]): Array<[Point2D, Point2D]> =>
    pts.map((q, i) => [q, pts[(i + 1) % pts.length]]);
  const obst: Array<[Point2D, Point2D]> = [
    ...edges(g0.out),
    ...(g.hyp ? [[g.hyp.T, g.hyp.E] as [Point2D, Point2D]] : []),
    ...(gk && g1.key
      ? [
          [
            [gk.x0, 0],
            [gk.x0, -g1.key.d],
          ] as [Point2D, Point2D],
          [
            [gk.x1, 0],
            [gk.x1, -g1.key.d],
          ] as [Point2D, Point2D],
        ]
      : []),
  ];

  specs.filter((s) => on(String(s.mark).toUpperCase())).forEach((s) => calloutM(E, s, ctx, obst));
  const nz = (E.dz || []).length;
  dimsSectionC(E, p, g1, ctx, { rebar: true });
  const xl = Math.min(
    -mm(30),
    Math.min(
      0,
      ...(E.dz || [])
        .slice(nz)
        .filter((b) => b.x1 < 0)
        .map((b) => b.x0),
    ) -
      mm(1.5) -
      SL,
  );
  secSym(E, ctx, [xl, y3], [1, 0], [0, -1], '3');
  secSym(E, ctx, [xl, y4], [1, 0], [0, -1], '4');
  finishView(
    E,
    'Mặt cắt 2-2',
    rib ? slabel(ctx) : `${slabel(ctx)} – không thể hiện thép tường cánh`,
    ctx,
  );
  return E;
}
