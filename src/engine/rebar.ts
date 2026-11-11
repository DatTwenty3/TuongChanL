/**
 * Rebar builders, bar marking, spacing/length/cover checks, and bar list
 * aggregation ported faithfully from `01_project_geom.js`,
 * `03_template_b_canti.js`, `04_template_c_ke.js`, and
 * `05_template_d_anchor_rebar.js`.
 */

import {
  ancWarn,
  anchorBar,
  b2PathB,
  dAnchors,
  dLayers,
  dRibDiag,
  dRing,
  dRingXs,
  geom,
  ringB,
  tieRowsB,
  tieXsB,
} from './geom.ts';
import {
  C_LTB,
  C_MARKS,
  C_NAME,
  KE_TAB,
  ROLE_NAME,
  ancEnsure,
  ckey,
  clamp,
  distr,
  fmt,
  hkB,
  isB,
  isC,
  isD,
  n5sig,
  pathLen,
  presetKe,
  unitW,
} from './presets.ts';
import type {
  BarSpec,
  BarsResult,
  EngineBarSpec,
  EngineBarsResult,
  EngineCBarsGeometry,
  EngineCDots,
  EngineGeomData,
  EngineProject,
  Point2D,
} from './types.ts';

export interface ListedBarSpec extends EngineBarSpec {
  count: number;
  totLen: number;
  kg: number;
  minL: number;
  maxL: number;
}

export function numberMarks(R: EngineBarSpec[]): void {
  const hh = R.find((b) => b.key === 'h1');
  const ll = R.find((b) => b.key === 'l1');
  const same = hh && ll && hh.d === ll.d;
  let n = 0;
  R.forEach((b) => {
    if (b.key === 'l1' && same) {
      b.mark = hh.mark;
      return;
    }
    if (b.key === 't1b' || b.key === 'f1') {
      b.mark = 0;
      return;
    }
    if (/^r1[b-f]$/.test(b.key)) {
      b.mark = 0;
      return;
    }
    b.mark = ++n;
    if (b.key === 't1' && R.some((x) => x.key === 't1b')) b.mark = n + 'a';
  });
  const t1 = R.find((b) => b.key === 't1');
  const t1b = R.find((b) => b.key === 't1b');
  if (t1 && t1b) t1b.mark = String(parseInt(String(t1.mark), 10)) + 'b';
  const b1m = R.find((b) => b.key === 'b1');
  const f1m = R.find((b) => b.key === 'f1');
  if (f1m) f1m.mark = b1m ? String(b1m.mark) + 'a' : String(++n);
  const r1 = R.find((b) => b.key === 'r1');
  R.forEach((b) => {
    if (r1 && /^r1[b-f]$/.test(b.key)) {
      b.mark = String(r1.mark) + 'abcde'['bcdef'.indexOf(b.key[2])];
    }
  });
}

export function ribCuts(p: EngineProject, g: EngineGeomData, ng: number): number[] {
  const r1 = p.rb.r1;
  const hmax = g.yR - p.tBase;
  if (Array.isArray(r1.cuts) && r1.cuts.length >= ng - 1) return r1.cuts.slice(0, ng - 1);
  const F: Record<number, number[]> = {
    2: [0.55],
    3: [0.65, 0.35],
    4: [0.65, 0.39, 0.195],
    5: [0.75, 0.55, 0.37, 0.18],
    6: [0.8, 0.64, 0.48, 0.32, 0.16],
  };
  return (F[ng] || []).map((f) => Math.round((hmax * f) / 10) * 10);
}

export function ribBarSet(p: EngineProject, g: EngineGeomData, yEnd: number): EngineBarSpec[] {
  const c = p.cover;
  const rb = p.rb;
  const B = g.B;
  const lm = (v: number) => Math.round(v * 10);
  const R: EngineBarSpec[] = [];
  const on = (k: string) => Boolean(rb[k] && rb[k].on !== false);
  const nR = g.ribs.length;
  const { T, E } = g.hyp!;
  const yR = g.yR;
  const ux = E[0] - T[0];
  const uy = E[1] - T[1];
  const L = Math.hypot(ux, uy);
  const u: Point2D = [ux / L, uy / L];
  const nn: Point2D = [u[1], -u[0]];
  const yh = (x: number) => T[1] + (uy * (x - T[0])) / ux;
  const xh = (y: number) => T[0] + (ux * (T[1] - y)) / (T[1] - E[1]);

  if (on('r1')) {
    const d = rb.r1.d;
    const nb = rb.r1.n || 2;
    const ng = clamp(Math.round(rb.r1.ng || 1), 1, 6);
    const sp = rb.r1.sp || 10;
    const la = rb.r1.la || 15;
    const cuts = ribCuts(p, g, ng);
    const o0 = c + rb.r2.d / 10 + d / 20;
    for (let k = 0; k < ng; k++) {
      const ok = o0 + k * sp;
      const P0: Point2D = [T[0] + nn[0] * ok, T[1] + nn[1] * ok];
      const ys = k === 0 ? yR - c : p.tBase + cuts[k - 1];
      const s0 = (ys - P0[1]) / u[1];
      const S: Point2D = [P0[0] + u[0] * s0, ys];
      const hk = clamp(S[0] - (g.xf(Math.min(ys, g.yTop)) + c), 10, 40);
      const xe = B - c - d / 20 - k * la;
      const s1 = (xe - P0[0]) / u[0];
      const Pe: Point2D = [xe, P0[1] + u[1] * s1];
      if (Pe[1] < yEnd + 1) continue;
      const path: Point2D[] = [[S[0] - hk, ys], S, Pe, [xe, yEnd]];
      const items: number[] = [];
      for (let i = 0; i < nR * nb; i++) items.push(lm(pathLen(path)));
      const dl = (m: number, n2: number) =>
        Math.hypot(path[n2][0] - path[m][0], path[n2][1] - path[m][1]);
      R.push({
        key: k === 0 ? 'r1' : 'r1' + 'bcdef'[k - 1],
        mark: 0,
        name: ROLE_NAME.r1 + (ng > 1 ? ` – nhóm ${k + 1}` : ''),
        d,
        n: nb,
        path,
        items,
        perRib: nb,
        grp: k,
        ng,
        P0,
        u,
        ys,
        ok,
        a: 0,
        shape: {
          pts: [
            [0, 1],
            [0.22, 1],
            [0.78, 0.26],
            [0.78, 0],
          ],
          lens: [dl(0, 1), dl(1, 2), dl(2, 3)],
        },
      });
    }
  }
  if (on('r2')) {
    const d = rb.r2.d;
    const rows = distr(yR - p.tBase, rb.r2.a || 20, c + 3).map((v) => p.tBase + v);
    const items: number[] = [];
    const hk = d;
    let wMid = 50;
    rows.forEach((y, i) => {
      const w = xh(y) - c - (g.xf(y) + c) + hk;
      if (i === Math.floor(rows.length / 2)) wMid = w;
      for (let k = 0; k < nR * 2; k++) items.push(lm(w));
    });
    R.push({
      key: 'r2',
      mark: 0,
      name: ROLE_NAME.r2,
      d,
      a: rb.r2.a,
      rows,
      path: [
        [0, 0],
        [wMid, 0],
      ],
      straight: true,
      items,
    });
  }
  if (on('r3') && rb.r3.on) {
    const a = rb.r3.a || 20;
    const d = rb.r3.d;
    const xs: number[] = [];
    const items: number[] = [];
    const y0 = c + rb.b1.d / 10 + 1;
    for (let x = g.xbb + 10; yh(x) - p.tBase > 12 && x < B - c; x += a) xs.push(x);
    xs.forEach((x) => {
      for (let k = 0; k < nR * 2; k++) items.push(lm(yh(x) - c - y0));
    });
    if (xs.length) {
      const xm = xs[Math.floor(xs.length / 2)];
      R.push({
        key: 'r3',
        mark: 0,
        name: ROLE_NAME.r3,
        d,
        a,
        xs,
        y0,
        path: [
          [0, 0],
          [yh(xm) - c - y0, 0],
        ],
        straight: true,
        items,
      });
    }
  }
  return R;
}

export function footTop(
  A: Point2D,
  yt: number,
  l1: { xs?: number[]; yl?: number; yu?: number; d: number } | undefined,
  df: number,
): Point2D {
  const x45 = A[0] + (yt - A[1]);
  if (!l1 || !l1.xs || !l1.xs.length || !(yt > A[1])) return [x45, yt];
  const ROW_OFF = 2.4;
  const rows = [
    l1.yl === undefined ? undefined : l1.yl + ROW_OFF,
    l1.yu === undefined ? undefined : l1.yu - ROW_OFF,
  ].filter((v): v is number => v !== undefined && v > A[1] && v < yt + 1e-6);
  const need = Math.max((l1.d + df) / 20 + 0.35, 5.5);
  const xs = l1.xs;
  const clr = (x3: number) => {
    const ux = x3 - A[0];
    const uy = yt - A[1];
    const L = Math.hypot(ux, uy);
    let m = 1e9;
    rows.forEach((y) => {
      const xd = A[0] + ((y - A[1]) * ux) / uy;
      xs.forEach((x) => {
        if (Math.abs(x - xd) < 40) m = Math.min(m, (Math.abs(x - xd) * uy) / L);
      });
    });
    return m;
  };
  let best = x45;
  let bc = clr(x45);
  if (bc >= need) return [x45, yt];
  for (let dx = 0.25; dx <= 24 && x45 - dx > A[0] + 5; dx += 0.25) {
    const c1 = clr(x45 - dx);
    if (c1 >= need) return [x45 - dx, yt];
    if (c1 > bc) {
      bc = c1;
      best = x45 - dx;
    }
  }
  return [best, yt];
}

export function beamDots(
  g: EngineGeomData,
  e1: Pick<EngineBarSpec, 'n' | 'd' | 'b1d' | 'foot' | 'yl' | 'yu'> | undefined,
  c: number,
): { x: number; y: number; beam: number }[] {
  if (!g.beam || !e1) return [];
  const { w: bw, d: bd } = g.beam;
  const n = Math.max(2, Math.round(e1.n || 8));
  const r = e1.d / 20;
  const b1d = e1.b1d || e1.d;
  const hb = b1d / 20;
  const dl = hb + r;
  const x0 = c + hb;
  const yb = -bd + c + hb;
  const k = c * (Math.SQRT2 - 1);
  const y1 = c + hb;
  const A: Point2D = e1.foot ? e1.foot.A : [bw - k, yb];
  const B: Point2D = e1.foot ? e1.foot.T : [bw + bd - k + hb, y1];
  const ul = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1;
  const ux = (B[0] - A[0]) / ul;
  const uy = (B[1] - A[1]) / ul || 1e-9;
  const nx = -uy;
  const ny = ux;
  const yl = e1.yl !== undefined ? e1.yl : y1 + hb + r;
  const yu = e1.yu !== undefined ? e1.yu : yl + 66;
  const xl = x0 + dl;
  const yfb = yb + dl;
  const A2: Point2D = [A[0] + dl * nx, A[1] + dl * ny];
  const tC = (yfb - A2[1]) / uy;
  const xc = Math.max(xl, A2[0] + tC * ux);
  const tE = (yl - A2[1]) / uy;
  const PP: Point2D[] = [
    [xl, yl],
    [xl, yfb],
    [xc, yfb],
    [A2[0] + tE * ux, yl],
  ];
  const seg: number[] = [];
  for (let i = 1; i < PP.length; i++) {
    seg.push(Math.hypot(PP[i][0] - PP[i - 1][0], PP[i][1] - PP[i - 1][1]));
  }
  const S2 = seg.reduce((s, v) => s + v, 0);
  const S1 = Math.max(0, yu - yl);
  const n1 = S1 + S2 > 0 ? Math.min(n, Math.max(0, Math.round((n * S1) / (S1 + S2)))) : 0;
  const n2 = n - n1;
  const o: { x: number; y: number; beam: number }[] = [];
  const add = (x: number, y: number) =>
    o.push({ x, y, beam: 0 }, { x: g.B - x, y, beam: 1 });
  for (let i = 1; i <= n1; i++) add(xl, yu - (S1 * i) / (n1 + 1));
  for (let i = 1; i <= n2; i++) {
    let s = (S2 * i) / (n2 + 1);
    let j = 0;
    while (j < seg.length - 1 && s > seg[j]) {
      s -= seg[j];
      j++;
    }
    const f = seg[j] > 0 ? s / seg[j] : 0;
    add(PP[j][0] + (PP[j + 1][0] - PP[j][0]) * f, PP[j][1] + (PP[j + 1][1] - PP[j][1]) * f);
  }
  return o;
}

export function buildBars(p: EngineProject): EngineBarsResult {
  ancEnsure(p);
  return isB(p)
    ? buildBarsB(p)
    : isC(p)
      ? buildBarsC(p)
      : isD(p)
        ? buildBarsD(p)
        : buildBarsG(p);
}

export function buildBarsG(p: EngineProject): EngineBarsResult {
  const g = geom(p);
  const c = p.cover;
  const rb = p.rb;
  const Lu = p.Lu;
  const B = g.B;
  const t = g.t;
  const R: EngineBarSpec[] = [];
  const warn: string[] = [];
  const on = (k: string) => Boolean(rb[k] && rb[k].on !== false);
  const dH = rb.h1.d;
  const offV = (d: number) => c + dH / 10 + d / 20;
  const yb1 = c + rb.b1.d / 10 + rb.l1.d / 10 + rb.s1.d / 20;
  const yb2 = yb1 + rb.s1.d / 20 + rb.s2.d / 20;
  const add = (o: EngineBarSpec) => {
    o.mark = R.length + 1;
    o.count = o.items.length;
    R.push(o);
    return o;
  };
  const arr = (n: number, v: number) => Array.from({ length: n }, () => v);
  const lm = (v: number) => Math.round(v * 10);

  {
    const d = rb.s1.d;
    const o = offV(d);
    const xs = g.xbb - o;
    const leg = clamp((14 * d) / 10, 20, Math.max(20, xs - c - 2));
    const capH = p.cap && p.cap.w > 0 ? p.cap.hv + p.cap.hs : 0;
    const yk = p.tBase + p.H - capH;
    const path: Point2D[] =
      capH > 0
        ? [
            [g.xbt - o, g.yTop - c],
            [g.xbt - o, yk],
            [xs, p.tBase],
            [xs, yb1],
            [xs - leg, yb1],
          ]
        : [
            [g.xbt - o, g.yTop - c],
            [xs, p.tBase],
            [xs, yb1],
            [xs - leg, yb1],
          ];
    const pos = distr(Lu, rb.s1.a || 20, c);
    add({
      key: 's1',
      mark: 0,
      name: ROLE_NAME.s1,
      d,
      a: rb.s1.a,
      path,
      pos,
      items: arr(pos.length, lm(pathLen(path))),
    });
  }

  {
    const d = rb.s2.d;
    const o = offV(d);
    const x = t + o;
    const leg = clamp((14 * d) / 10, 15, Math.max(15, B - x - c));
    const path: Point2D[] = g.sf
      ? [
          [g.xft + o, g.yTop - c],
          [x, p.tBase],
          [x, yb2],
          [x + leg, yb2],
        ]
      : [
          [x, g.yTop - c],
          [x, yb2],
          [x + leg, yb2],
        ];
    const pos = distr(Lu, rb.s2.a || 20, c);
    add({
      key: 's2',
      mark: 0,
      name: ROLE_NAME.s2,
      d,
      a: rb.s2.a,
      path,
      pos,
      items: arr(pos.length, lm(pathLen(path))),
    });
  }

  {
    const d = dH;
    const rows = distr(p.H, rb.h1.a || 20, c + 2).map((v) => p.tBase + v);
    const len = lm(Lu - 2 * Math.min(c, 5));
    add({
      key: 'h1',
      mark: 0,
      name: ROLE_NAME.h1,
      d,
      a: rb.h1.a,
      rows,
      path: [
        [0, 0],
        [Lu - 2 * c, 0],
      ],
      straight: true,
      items: arr(rows.length * 2, len),
    });
  }

  {
    const d = rb.b1.d;
    const y = c + d / 20;
    const x0 = c + d / 20;
    const x1 = B - c - d / 20;
    let path: Point2D[] = [
      [x0, p.tTip - c],
      [x0, y],
      [x1, y],
      [x1, p.tBase - c],
    ];
    if (g.beam) {
      path = [
        [x0, y],
        [x1, y],
      ];
    }
    const pos = distr(Lu, rb.b1.a || 20, c);
    add({
      key: 'b1',
      mark: 0,
      name: ROLE_NAME.b1,
      d,
      a: rb.b1.a,
      path,
      pos,
      y,
      items: arr(pos.length, lm(pathLen(path))),
    });
  }

  {
    const d = rb.b2.d;
    const y = p.tBase - c - d / 20;
    const x0 = c + d / 20;
    const x1 = B - c - d / 20;
    const hk2 = 97 / 10;
    const yt0 = p.tTip - c - d / 20;
    const path: Point2D[] = [
      [x0, Math.max(c + 2, yt0 - hk2)],
      [x0, yt0],
      [t, y],
      [x1, y],
      [x1, Math.max(c + 2, y - hk2)],
    ];
    const pos = distr(Lu, rb.b2.a || 20, c);
    add({
      key: 'b2',
      mark: 0,
      name: ROLE_NAME.b2,
      d,
      a: rb.b2.a,
      path,
      pos,
      y,
      items: arr(pos.length, lm(pathLen(path))),
    });
  }

  {
    const d = rb.l1.d;
    const yl = c + rb.b1.d / 10 + d / 20;
    const yu = p.tBase - c - rb.b2.d / 10 - d / 20;
    const xs = distr(B, rb.l1.a || 20, c);
    add({
      key: 'l1',
      mark: 0,
      name: ROLE_NAME.l1,
      d,
      a: rb.l1.a,
      xs,
      yl,
      yu,
      path: [
        [0, 0],
        [Lu - 2 * c, 0],
      ],
      straight: true,
      items: arr(xs.length * 2, lm(Lu - 2 * Math.min(c, 5))),
    });
  }

  if (g.beam) {
    const b1b = R.find((b) => b.key === 'b1')!;
    const b2b = R.find((b) => b.key === 'b2')!;
    const l1b = R.find((b) => b.key === 'l1')!;
    const d = rb.b1.d;
    const { w: bw, d: bd } = g.beam;
    const x0 = c + d / 20;
    const yb = -bd + c + d / 20;
    const k = c * (Math.SQRT2 - 1);
    const A: Point2D = [bw - k, yb];
    const T = footTop(A, b2b.y!, l1b, d);
    const path: Point2D[] = [[x0, p.tTip - c], [x0, yb], A, T];
    add({
      key: 'f1',
      mark: 0,
      name: ROLE_NAME.f1,
      d,
      a: rb.b1.a,
      path,
      pos: b1b.pos,
      mirror: true,
      dup: true,
      A,
      T,
      items: arr(2 * b1b.pos!.length, lm(pathLen(path))),
    });
  }

  if (g.beam && on('e1')) {
    const d = rb.e1.d;
    const n = Math.max(2, Math.round(rb.e1.n || 8));
    const l1b = R.find((b) => b.key === 'l1');
    const f1b = R.find((b) => b.key === 'f1');
    add({
      key: 'e1',
      mark: 0,
      name: ROLE_NAME.e1,
      d,
      n,
      b1d: rb.b1.d,
      yl: l1b ? l1b.yl : undefined,
      yu: l1b ? l1b.yu : undefined,
      foot: f1b ? { A: f1b.A as Point2D, T: f1b.T! } : undefined,
      path: [
        [0, 0],
        [Lu - 2 * c, 0],
      ],
      straight: true,
      items: arr(2 * n, lm(Lu - 2 * Math.min(c, 5))),
      perBeam: n,
    });
  }

  if (p.type !== 'rib' && on('t1')) {
    const d = rb.t1.d;
    const rows = distr(p.H, rb.t1.a || 100, c + 5).map((v) => p.tBase + v);
    const cols = distr(Lu, rb.t1.ah || rb.t1.a || 100, c + 5);
    const hk = d;
    const nl = Math.ceil(rows.length / 2);
    const grp = [rows.slice(nl), rows.slice(0, nl)].filter((r) => r.length);
    grp.forEach((rs, gi) => {
      const Lg =
        rs.reduce((s, y) => s + (g.xb(y) - g.xf(y)), 0) / rs.length - 2 * c + 2 * hk;
      const items: number[] = [];
      rs.forEach(() => cols.forEach(() => items.push(lm(Lg))));
      add({
        key: gi === 0 ? 't1' : 't1b',
        mark: 0,
        name: ROLE_NAME.t1 + (grp.length > 1 ? (gi === 0 ? ' – nửa trên' : ' – nửa dưới') : ''),
        d,
        a: rb.t1.a,
        ah: rb.t1.ah,
        rows: rs,
        cols,
        path: [
          [0, 0],
          [Lg, 0],
        ],
        straight: true,
        items,
        tie: true,
      });
    });
  }

  if (p.type === 'rib' && g.hyp) {
    ribBarSet(p, g, c + rb.b1.d / 10 + rb.l1.d / 10 + (rb.r1.d || 22) / 20).forEach(add);
  }

  if (g.key && on('k1')) {
    const d = rb.k1.d;
    const yBot = -g.key.d + c + d / 20;
    const yTopK = p.tBase - c - rb.b2.d / 10 - d / 20 - 2;
    const xl = g.key.x0 + c + d / 20;
    const xr = g.key.x1 - c - d / 20;
    const yT2 = Math.min(-g.key.d + 130, yTopK);
    const path: Point2D[] = [
      [xl, yT2],
      [xl, yBot],
      [xr, yBot],
      [xr, yT2],
    ];
    const pos = distr(Lu, rb.k1.a || 50, c);
    add({
      key: 'k1',
      mark: 0,
      name: ROLE_NAME.k1,
      d,
      a: rb.k1.a,
      path,
      pos,
      items: arr(pos.length, lm(pathLen(path))),
    });
  }

  if (g.an && on('an')) add(anchorBar(p, g));

  {
    const ord = [
      's1',
      's2',
      'b1',
      'f1',
      'b2',
      'h1',
      't1',
      't1b',
      'k1',
      'an',
      'l1',
      'e1',
      'r3',
      'r1',
      'r1b',
      'r1c',
      'r1d',
      'r1e',
      'r1f',
      'r2',
    ];
    R.sort((x, y) => ord.indexOf(x.key) - ord.indexOf(y.key));
    numberMarks(R);
  }

  R.forEach((b) => {
    const aa = b.a;
    if (aa && !b.dup) {
      const clear = aa * 10 - b.d;
      const minC = Math.max(1.5 * b.d, 38);
      if (clear < minC && b.key !== 't1') {
        warn.push(
          `Mác ${b.mark} (${b.name}): khoảng hở ${Math.round(clear)} mm < ${Math.round(minC)} mm (TCVN 11823 – 5.10.3.1)`,
        );
      }
      if (aa > 45 && b.key !== 'k1' && b.key !== 't1' && b.key !== 'an') {
        warn.push(`Mác ${b.mark} (${b.name}): bước ${aa} cm > 45 cm`);
      }
    }
    if (Math.max(...b.items) > 11700) {
      warn.push(
        `Mác ${b.mark} (${b.name}): thanh dài ${fmt(Math.max(...b.items) / 1e3, 2)} m > 11,7 m – cần chia và nối`,
      );
    }
  });
  if (c < 4) warn.push('Lớp bảo vệ < 4 cm.');
  if (p.tsb < p.tst) warn.push('Bề dày chân thân tường nhỏ hơn đỉnh.');
  warn.push(...ancWarn(p, g));
  return { bars: R, warn, g };
}

export function buildBarsB(p: EngineProject): EngineBarsResult {
  const g = geom(p);
  const c = p.cover;
  const rb = p.rb;
  const Lu = p.Lu;
  const B = g.B;
  const yT = g.yTop;
  const R: EngineBarSpec[] = [];
  const warn: string[] = [];
  const lm = (v: number) => Math.round(v * 10);
  const arr = (n: number, v: number) => Array.from({ length: n }, () => v);
  const on = (k: string) => Boolean(rb[k] && rb[k].on !== false);
  const add = (o: EngineBarSpec) => {
    o.count = o.items.length;
    R.push(o);
    return o;
  };
  const ring = ringB(p, g);

  {
    const d = rb.s1.d;
    const x1 = g.xbb - c;
    const top = Math.max(0, p.tst - 2 * c);
    const ft = hkB(d);
    const path: Point2D[] = [
      [x1 - top, yT - c],
      [x1, yT - c],
      [x1, c],
      [x1 - ft, c],
    ];
    const pos = distr(Lu, rb.s1.a || 10, c);
    add({
      key: 's1',
      mark: 0,
      name: ROLE_NAME.s1,
      d,
      a: rb.s1.a,
      path,
      pos,
      items: arr(pos.length, lm(pathLen(path))),
      shape: {
        pts: [
          [-0.16, 1],
          [0, 1],
          [0, 0],
          [-0.07, 0],
        ],
        lens: [top, yT - 2 * c, ft],
      },
    });
  }

  {
    const d = rb.s2.d;
    const h = hkB(d);
    const pt: Point2D = [g.xf(yT - c) + c, yT - c];
    const pb: Point2D = [g.xf(c) + c, c];
    const path: Point2D[] = [[pt[0] + h, pt[1]], pt, pb, [pb[0] + h, pb[1]]];
    const pos = distr(Lu, rb.s2.a || 10, c);
    add({
      key: 's2',
      mark: 0,
      name: ROLE_NAME.s2,
      d,
      a: rb.s2.a,
      path,
      pos,
      items: arr(pos.length, lm(pathLen(path))),
      shape: {
        pts: [
          [0.2, 1],
          [0.1, 1],
          [0, 0],
          [0.1, 0],
        ],
        lens: [h, Math.hypot(pt[0] - pb[0], pt[1] - pb[1]), h],
      },
    });
  }

  {
    const d = rb.b1.d;
    const lt = p.tTip - 2 * c;
    const lh = g.tH - 2 * c;
    const path: Point2D[] = [
      [c, p.tTip - c],
      [c, c],
      [B - c, c],
      [B - c, g.tH - c],
    ];
    const pos = distr(Lu, rb.b1.a || 10, c);
    add({
      key: 'b1',
      mark: 0,
      name: ROLE_NAME.b1,
      d,
      a: rb.b1.a,
      path,
      pos,
      y: c,
      items: arr(pos.length, lm(pathLen(path))),
      shape: {
        pts: [
          [0, 0.3],
          [0, 0],
          [1, 0],
          [1, 0.3],
        ],
        lens: [lt, B - 2 * c, lh],
      },
    });
  }

  {
    const d = rb.b2.d;
    const path = b2PathB(p, g);
    const pos = distr(Lu, rb.b2.a || 10, c);
    const L: number[] = [];
    for (let i = 1; i < path.length; i++) {
      L.push(Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
    }
    add({
      key: 'b2',
      mark: 0,
      name: ROLE_NAME.b2,
      d,
      a: rb.b2.a,
      path,
      pos,
      y: p.tBase - c,
      items: arr(pos.length, lm(pathLen(path))),
      shape: {
        pts: [
          [0, -0.08],
          [0, 0],
          [0.33, 0.06],
          [0.55, 0.06],
          [1, 0],
          [1, -0.08],
        ],
        lens: L,
      },
    });
  }

  {
    const len = lm(Lu - 2 * Math.min(c, 5));
    const dH = rb.h1.d;
    const dL = rb.l1.d;
    const rows = distr(p.H, rb.h1.a || 20, c).map((v) => p.tBase + v);
    const xs = distr(B, rb.l1.a || 20, c);
    const nS = ring.stem.length;
    const nL =
      p.n5sig && p.n5cad && p.n5sig === n5sig(p) ? Math.max(0, p.n5cad - nS) : ring.slab.length;
    add({
      key: 'h1',
      mark: 0,
      name: ROLE_NAME.h1,
      d: dH,
      a: rb.h1.a,
      rows,
      pts: ring.stem,
      path: [
        [0, 0],
        [Lu - 2 * c, 0],
      ],
      straight: true,
      items: arr(nS, len),
    });
    add({
      key: 'l1',
      mark: 0,
      name: ROLE_NAME.l1,
      d: dL,
      a: rb.l1.a,
      xs,
      yl: c,
      yu: p.tBase - c,
      pts: ring.slab,
      path: [
        [0, 0],
        [Lu - 2 * c, 0],
      ],
      straight: true,
      items: arr(nL, len),
    });
  }

  if (on('t1')) {
    const d = rb.t1.d;
    const h = hkB(d);
    const cols = distr(Lu, rb.t1.ah || 100, c + 5);
    const rows = tieRowsB(p, g);
    const w = rows.map((y) => g.xb(y) - g.xf(y) - 2 * c);
    const mean = w.reduce((s, v) => s + v, 0) / w.length;
    const Lg = mean + 2 * h;
    const items: number[] = [];
    rows.forEach(() => cols.forEach(() => items.push(lm(Lg))));
    add({
      key: 't1',
      mark: 0,
      name: ROLE_NAME.t1 + ' – ngang thân',
      d,
      a: rb.t1.a,
      ah: rb.t1.ah,
      rows,
      cols,
      path: [
        [0, 0],
        [Lg, 0],
      ],
      straight: true,
      items,
      tie: true,
      shape: {
        pts: [
          [0, -0.12],
          [0, 0],
          [1, 0],
          [1, -0.12],
        ],
        lens: [h, mean, h],
        lab: [null, `${fmt(Math.min(...w) * 10)}-${fmt(Math.max(...w) * 10)}`, null],
      },
    });
    const xsT = tieXsB(p, g);
    const w2 = xsT.map((x) => g.topY(x) - 2 * c);
    const m2 = w2.reduce((s, v) => s + v, 0) / w2.length;
    const L2 = m2 + 2 * h;
    const it2: number[] = [];
    xsT.forEach(() => cols.forEach(() => it2.push(lm(L2))));
    add({
      key: 't1b',
      mark: 0,
      name: ROLE_NAME.t1 + ' – đứng trong bản',
      d,
      a: rb.t1.a,
      ah: rb.t1.ah,
      rows: xsT,
      cols,
      xsT,
      path: [
        [0, 0],
        [L2, 0],
      ],
      straight: true,
      items: it2,
      tie: true,
      shape: {
        pts: [
          [0, -0.12],
          [0, 0],
          [1, 0],
          [1, -0.12],
        ],
        lens: [h, m2, h],
        lab: [null, `${fmt(Math.min(...w2) * 10)}-${fmt(Math.max(...w2) * 10)}`, null],
      },
    });
  }

  if (g.key && on('k1')) {
    const d = rb.k1.d;
    const xl = g.key.x0 + c;
    const xr = g.key.x1 - c;
    const yb = -g.key.d + c;
    const yu = 50;
    const path: Point2D[] = [
      [xl, yu],
      [xl, yb],
      [xr, yb],
      [xr, yu],
    ];
    const pos = distr(Lu, rb.k1.a || 50, c);
    add({
      key: 'k1',
      mark: 0,
      name: ROLE_NAME.k1,
      d,
      a: rb.k1.a,
      path,
      pos,
      items: arr(pos.length, lm(pathLen(path))),
      shape: {
        pts: [
          [0, 1],
          [0, 0],
          [0.5, 0],
          [0.5, 1],
        ],
        lens: [yu - yb, xr - xl, yu - yb],
      },
    });
  }

  if (g.an && on('an')) add(anchorBar(p, g));
  if (p.type === 'rib' && g.hyp) {
    ribBarSet(p, g, c + rb.b1.d / 20 + (rb.r1.d || 22) / 20 + 1).forEach(add);
  }

  const ord = [
    's1',
    's2',
    'b1',
    'b2',
    'h1',
    'l1',
    't1',
    't1b',
    'k1',
    'an',
    'r3',
    'r1',
    'r1b',
    'r1c',
    'r1d',
    'r1e',
    'r1f',
    'r2',
  ];
  R.sort((x, y) => ord.indexOf(x.key) - ord.indexOf(y.key));
  R.forEach((b) => {
    b.mark = 0;
  });
  numberMarks(R);

  warn.push(...ancWarn(p, g));
  R.forEach((b) => {
    const aa = b.a;
    if (aa && b.key !== 't1' && b.key !== 't1b') {
      const clear = aa * 10 - b.d;
      if (clear < Math.max(1.5 * b.d, 38)) {
        warn.push(
          `Mác ${b.mark} (${b.name}): khoảng hở ${Math.round(clear)} mm < ${Math.round(Math.max(1.5 * b.d, 38))} mm (TCVN 11823 – 5.10.3.1)`,
        );
      }
    }
    if (Math.max(...b.items) > 11700) {
      warn.push(
        `Mác ${b.mark} (${b.name}): thanh dài ${fmt(Math.max(...b.items) / 1e3, 2)} m > 11,7 m – cần chia và nối`,
      );
    }
  });
  if (p.tsb < p.tst) warn.push('Bề dày chân thân tường nhỏ hơn đỉnh.');
  return { bars: R, warn, g };
}

export function barList(res: BarsResult | EngineBarsResult): ListedBarSpec[] {
  if (res._list) return res._list as ListedBarSpec[];
  const m = new Map<string, ListedBarSpec>();
  (res.bars as EngineBarSpec[]).forEach((b) => {
    const k = b.mark + '|' + b.d;
    if (!m.has(k)) {
      m.set(k, Object.assign({}, b, { items: b.items.slice() }) as ListedBarSpec);
    } else {
      m.get(k)!.items.push(...b.items);
    }
  });
  const list = [...m.values()].map((b) => {
    b.count = b.items.length;
    b.totLen = b.items.reduce((s, v) => s + v, 0) / 1e3;
    b.kg = b.totLen * unitW(b.d);
    b.minL = Math.min(...b.items);
    b.maxL = Math.max(...b.items);
    return b;
  });
  (res as EngineBarsResult)._list = list;
  return list;
}

export function cBars(p: EngineProject, g: EngineGeomData): EngineCBarsGeometry {
  const c = p.cover;
  const B = g.B;
  const t = g.t;
  const xbb = g.xbb;
  const yT = g.yTop;
  const tb = p.tBase;
  const tH = g.tH;
  const tf = Math.min(p.toeFlat || 0, t);
  const hl = B - xbb;
  const sl = (tb - p.tTip) / Math.max(1e-9, t - tf);
  const kk = Math.sqrt(1 + sl * sl);
  const yt1 = Math.min(p.tTip, tH) - c;
  const y3 = (x: number) => p.tTip + sl * (x - tf) - c * kk;
  const xt7 = g.xft + c - 0.3;
  const xb7 = t + 0.2;
  const x7 = (y: number) => xb7 + ((xt7 - xb7) * (y - c)) / Math.max(1e-9, yT - 2 * c);
  const G = { c, yt1, y3, x7, hl, B, yT } as EngineCBarsGeometry;

  G.l1 = [
    [
      [c, c],
      [B - c, c],
    ],
    [
      [c, yt1],
      [B - c, yt1],
    ],
  ];
  G.l9 = [
    [
      [c, c],
      [c, yt1],
    ],
    [
      [B - c, c],
      [B - c, yt1],
    ],
  ];
  G.xs10 = [xbb + 0.403 * hl, xbb + 0.699 * hl];
  G.l10 = G.xs10.map((x) => [
    [x, c],
    [x, yt1],
  ]);
  const e3 = y3(xbb - c);
  G.p3 = [
    [c, c],
    [c, y3(c)],
    [xbb - c, e3],
    [xbb - c, e3 + 41],
  ];
  const m4 = 1.059;
  const xb4 = xbb + 58.3;
  const f = (p.tsb - p.tst) / p.H;
  const y4 = Math.min(yT - 20, (xb4 + c / m4 - t + f * tb - 4.5) / (1 / m4 + f));
  G.p4 = [
    [xb4 - (y4 - c) / m4, y4],
    [xb4, c],
  ];
  G.p6 = [
    [xbb - c, c],
    [xbb - c, yT - c],
  ];
  G.p7 = [
    [xb7, c],
    [xt7, yT - c],
  ];
  G.p8 = [
    [xt7, yT - c],
    [xbb - c, yT - c],
  ];
  G.lv = [];
  for (let k = 2; 100 * k + 2.2 <= yT - c - 10; k++) G.lv.push(100 * k + 2.2);
  G.l16 = G.lv.map((y) => [
    [x7(y), y],
    [xbb - c, y],
  ]);

  const { T, E: Eh } = g.hyp!;
  const Lh = Math.hypot(Eh[0] - T[0], Eh[1] - T[1]);
  const ux = (Eh[0] - T[0]) / Lh;
  const uy = (Eh[1] - T[1]) / Lh;
  const O: Point2D = [T[0] + uy * c, T[1] - ux * c];
  const xOf = (y: number) => O[0] + (ux * (y - O[1])) / uy;
  const yOf = (x: number) => O[1] + (uy * (x - O[0])) / ux;
  G.xOf = xOf;
  G.yOf = yOf;
  let y13 = yT - 13.6;
  {
    const hh = (y: number) => xOf(y) - g.xf(y) - c;
    const h0 = hh(0);
    const s = (hh(1e3) - h0) / 1e3;
    if (hh(y13) < 0 && Math.abs(s) > 1e-9) {
      const yr = -h0 / s;
      if (yr > c && yr < y13) y13 = yr;
    }
  }
  G.p13 = [
    [xOf(y13), y13],
    [xOf(c), c],
  ];
  const yR = g.yR;
  const rows = [tH + 15.2];
  const yt = yR - 16.2;
  const a12 = (p.rb.c12 && p.rb.c12.a) || 20;
  for (let y = tH + 33.4; y <= yt - 20 + 0.4; y += a12) rows.push(y);
  rows.push(yt);
  G.rows = rows;
  G.l12 = rows.map((y) => [
    [x7(y), y],
    [xOf(y), y],
  ]);
  const a11 = (p.rb.c11 && p.rb.c11.a) || 20;
  const xs11 = [xbb + 4.9];
  for (
    let x = xbb + 21;
    yOf(x) >= tH + 15 && x < B - (p.rib.end || 0) && xs11.length < 60;
    x += a11
  ) {
    xs11.push(x);
  }
  G.xs11 = xs11;
  G.l11 = xs11.map((x) => [
    [x, c + 2],
    [x, yOf(x)],
  ]);
  G.ticks = [];
  for (let i = 2; i < rows.length - 1 && G.ticks.length < 8; i += 2) {
    G.ticks.push([xs11[Math.min(2, xs11.length - 1)], rows[i]]);
  }
  return G;
}

export function cDots(
  p: EngineProject,
  g: EngineGeomData,
  G: EngineCBarsGeometry,
  n2: number,
  n5: number,
): EngineCDots {
  const c = p.cover;
  const B = g.B;
  const t = g.t;
  const xbb = g.xbb;
  const yT = g.yTop;
  const tb = p.tBase;
  const r = 2;
  const nb = Math.max(2, Math.round((n2 + 2) / 2));
  const nt = Math.max(1, n2 - nb);
  const ev = (n: number, a: number, b: number) =>
    Array.from({ length: n }, (_, i) => (n > 1 ? a + ((b - a) * i) / (n - 1) : (a + b) / 2));
  const d2: Point2D[] = [];
  ev(nb, c + r, B - c - r).forEach((x) => d2.push([x, c + r]));
  ev(nt, c + r, B - c - r).forEach((x) => d2.push([x, G.yt1 - r]));
  const nf = Math.max(2, Math.round((n5 - 4) / 2));
  const d5: Point2D[] = [];
  ev(nf, tb - 0.5, yT - 20.5).forEach((y) => {
    d5.push([xbb - c - 2.2, y]);
    d5.push([G.x7(y) + 2, y]);
  });
  d5.push([t + 7.5, tb - 18.3], [xbb + 8.3, tb - 18.8]);
  [0.59, 0.85].forEach((f) => {
    const x = f * t;
    d5.push([x, G.y3(x) - 1.85]);
  });
  const d5a: Point2D[] = [
    [g.xft + c + 0.1, yT - 7.4],
    [xbb - 7.2, yT - 6.8],
  ];
  return { d2, d5, d5a };
}

export function cFormula(
  p: EngineProject,
  g: EngineGeomData,
  G: EngineCBarsGeometry,
): Record<string, [number, number]> {
  const c = p.cover;
  const B = g.B;
  const Lu = p.Lu;
  const nR = g.ribs.length;
  const rb = p.rb;
  const a = (m: string) => rb[ckey(m)].a || 20;
  const yT = g.yTop;
  const F: Record<string, [number, number]> = {};
  const len = (pts: Point2D[]) => pathLen(pts);
  F['1'] = [2 * Math.round(Lu / a('1')), Math.ceil(B - 2 * c)];
  const nb = Math.ceil((B - 2 * c) / a('2'));
  F['2'] = [2 * nb - 2, Lu - 10];
  F['3'] = [Math.round(Lu / a('3')), Math.ceil(len(G.p3))];
  F['4'] = [Math.round(Lu / a('4')), Math.ceil(len(G.p4)) + 80];
  const nf = Math.floor((yT - 20.5 - (p.tBase - 0.5)) / a('5') + 1e-9) + 1;
  F['5'] = [2 * nf + 4, Lu - 10];
  F['5A'] = [rb.c5a.n || 2, Lu + 50];
  F['6'] = [Math.round(Lu / a('6')), Math.ceil(yT - 2 * c) + 40];
  F['7'] = [Math.round(Lu / a('7')), Math.ceil(len(G.p7)) + 40];
  F['8'] = [Math.round(Lu / a('8')), Math.round(len(G.p8)) + 40];
  F['9'] = [2 * Math.round(Lu / a('9')), Math.ceil(G.yt1 - c) + 40];
  F['10'] = [
    2 * (nR - 1) * Math.max(1, Math.round(p.rib.gap / a('10'))),
    Math.ceil(G.yt1 - c) + 20,
  ];
  const tops = G.xs11.map((x) => G.yOf(x));
  const mean = (v: number[]) => v.reduce((s, q) => s + q, 0) / Math.max(1, v.length);
  F['11'] = [nR * 2 * G.xs11.length, Math.round(mean(tops) + 30)];
  F['12'] = [nR * 2 * G.rows.length, Math.round(mean(G.l12.map((l) => l[1][0] - l[0][0])))];
  F['13'] = [nR * (rb.c13.n || 2), Math.round(len(G.p13))];
  F['14'] = [nR * G.rows.length, 60];
  F['15'] = [nR * Math.max(2, Math.round(F['13'][1] / 160)), 30];
  F['16'] = [
    2 * (nR - 1) * G.lv.length,
    Math.round(mean(G.l16.map((l) => l[1][0] - l[0][0])) + 5) + 10,
  ];
  return F;
}

export function buildBarsC(p: EngineProject): EngineBarsResult {
  if (!p.rb.c1) Object.assign(p.rb, presetKe({}, p.keIdx || 0).rb);
  const idx = p.keIdx || 0;
  const row = KE_TAB[idx];
  const g = geom(p);
  const G = cBars(p, g);
  const warn: string[] = [];
  const F = cFormula(p, g, G);
  const rb = p.rb;
  const p0 = presetKe({}, idx);
  const g0 = geom(p0);
  const F0 = cFormula(p0, g0, cBars(p0, g0));
  let edited = false;
  const on = (m: string) => rb[ckey(m)].on !== false;
  const nl = (m: string): [number, number] => {
    const f = F[m];
    const f0 = F0[m];
    const r = row.c[m];
    if (!r) return f;
    if (f[0] !== f0[0] || f[1] !== f0[1]) edited = true;
    return [Math.max(1, r[0] + f[0] - f0[0]), Math.max(1, r[1] + f[1] - f0[1])];
  };
  const rbG = {
    s1: rb.c6,
    s2: rb.c7,
    h1: rb.c5,
    l1: rb.c2,
    b1: rb.c1,
    b2: rb.c1,
    t1: { d: 12, a: 100, ah: 100, on: false },
    k1: { d: 16, a: 50, on: false },
    r1: Object.assign({}, rb.c13, { n: rb.c13.n || 2 }),
    r2: rb.c12,
    r3: Object.assign({}, rb.c11, { on: true }),
  };
  const base = buildBarsG(Object.assign({}, p, { rb: rbG }));
  const MAPC: Record<string, string> = {
    s1: '6',
    s2: '7',
    h1: '5',
    l1: '2',
    b1: '1',
    b2: '1',
    r1: '13',
    r2: '12',
    r3: '11',
  };
  const R: EngineBarSpec[] = [];
  base.bars.forEach((b) => {
    const m = MAPC[b.key];
    if (!m || !on(m)) return;
    const [n, L] = nl(m);
    const cnt = m === '1' ? Math.round(n / 2) : n;
    b.mark = m;
    b.name = C_NAME[m];
    b.ltb = C_LTB.has(m);
    b.items = Array(cnt).fill(Math.round(L * 10));
    b.count = cnt;
    b.d = rb[ckey(m)].d;
    b.a = rb[ckey(m)].a;
    b.shapeKey = m;
    R.push(b);
  });
  ['1', '2', '5', '6', '7', '11', '12', '13'].forEach((m) => {
    if (on(m) && !R.some((b) => b.mark === m)) {
      const [n, L] = nl(m);
      const r = rb[ckey(m)];
      R.push({
        key: ckey(m),
        name: C_NAME[m],
        d: r.d,
        a: r.a,
        mark: m,
        path: [
          [0, 0],
          [L, 0],
        ],
        straight: true,
        count: n,
        items: Array(n).fill(Math.round(L * 10)),
        ltb: C_LTB.has(m),
      });
    }
  });
  const dots = cDots(p, g, G, nl('2')[0], nl('5')[0]);
  const ex = (m: string, path: Point2D[], extra?: Partial<EngineBarSpec>) => {
    if (!on(m)) return;
    const [n, L] = nl(m);
    const r = rb[ckey(m)];
    R.push(
      Object.assign(
        {
          key: ckey(m),
          name: C_NAME[m],
          d: r.d,
          a: r.a,
          mark: m,
          path,
          count: n,
          items: Array(n).fill(Math.round(L * 10)),
          ltb: C_LTB.has(m),
        },
        extra || {},
      ),
    );
  };
  {
    const dx3 = G.p3[2][0] - G.p3[1][0];
    const dy3 = G.p3[2][1] - G.p3[1][1];
    const l1 = G.p3[1][1] - G.p3[0][1];
    ex('3', G.p3, {
      shape: {
        pts: [
          [0, 0],
          [0, l1],
          [dx3, l1 + dy3],
          [dx3, l1 + dy3 + 41],
        ],
        lens: [l1, Math.hypot(dx3, dy3), 41],
      },
    });
  }
  {
    const dx4 = G.p4[1][0] - G.p4[0][0];
    const dy4 = G.p4[1][1] - G.p4[0][1];
    ex('4', G.p4, {
      shape: {
        pts: [
          [1.5, 40],
          [0, 0],
          [dx4, dy4],
          [dx4 + 40, dy4],
        ],
        lens: [40, Math.hypot(dx4, dy4), 40],
      },
    });
  }
  ex(
    '5A',
    [
      [0, 0],
      [p.Lu, 0],
    ],
    {
      shape: {
        pts: [
          [0, 0],
          [p.Lu, 0],
          [p.Lu + 50, 0],
        ],
        lens: [p.Lu, 50],
      },
    },
  );
  ex('8', G.p8, {
    shape: {
      pts: [
        [0, -20],
        [0, 0],
        [20, 0],
        [20, -20],
      ],
      lens: [20, 20, 20],
    },
  });
  ex('9', G.l9[0], {
    shape: {
      pts: [
        [20, 40],
        [0, 40],
        [0, 0],
        [20, 0],
      ],
      lens: [20, 40, 20],
    },
  });
  ex('10', G.l10[0], {
    shape: {
      pts: [
        [-10, 40],
        [0, 40],
        [0, 0],
        [-10, 0],
      ],
      lens: [10, 40, 10],
    },
  });
  ex(
    '14',
    [
      [0, 0],
      [60, 0],
    ],
    {
      shape: {
        pts: [
          [20, 20],
          [0, 20],
          [0, 0],
          [20, 0],
        ],
        lens: [20, 20, 20],
      },
    },
  );
  ex(
    '15',
    [
      [0, 0],
      [30, 0],
    ],
    {
      shape: {
        pts: [
          [5, 20],
          [0, 20],
          [0, 0],
          [5, 0],
        ],
        lens: [5, 20, 5],
      },
    },
  );
  ex(
    '16',
    G.l16[0] || [
      [0, 0],
      [40, 0],
    ],
    {
      shape: {
        pts: [
          [5, 37],
          [0, 37],
          [0, 0],
          [5, 0],
        ],
        lens: [5, 37, 5],
        lab: [null, null, null],
      },
    },
  );
  const sh = (m: string, o: EngineBarSpec['shape']) => {
    const b = R.find((x) => x.mark === m && !x.shape);
    if (b) b.shape = o;
  };
  const L = (m: string) => nl(m)[1];
  sh('1', {
    pts: [
      [0, 0],
      [1, 0],
    ],
    lens: [L('1')],
  });
  sh('2', {
    pts: [
      [0, 0],
      [1, 0],
    ],
    lens: [L('2')],
  });
  sh('5', {
    pts: [
      [0, 0],
      [1, 0],
    ],
    lens: [L('5')],
  });
  sh('6', {
    pts: [
      [0, 370],
      [0, 0],
      [40, 0],
    ],
    lens: [L('6') - 40, 40],
    lab: ['ltb=' + fmt(Math.round((L('6') - 40) * 10)), null],
  });
  sh('7', {
    pts: [
      [3.45, 370],
      [0, 0],
      [40, 0],
    ],
    lens: [L('7') - 40, 40],
    lab: ['ltb=' + fmt(Math.round((L('7') - 40) * 10)), null],
  });
  sh('11', {
    pts: [
      [0, 190],
      [0, 0],
      [30, 0],
    ],
    lens: [L('11') - 30, 30],
    lab: ['ltb=' + fmt(Math.round((L('11') - 30) * 10)), null],
  });
  sh('12', {
    pts: [
      [0, 0],
      [1, 0],
    ],
    lens: [L('12')],
    lab: ['ltb=' + fmt(L('12') * 10)],
  });
  sh('13', {
    pts: [
      [0, 360],
      [160, 0],
    ],
    lens: [L('13')],
    lab: ['ltb=' + fmt(L('13') * 10)],
  });
  R.forEach((b) => {
    b.pathShape = !!b.shape;
  });
  R.sort((x, y) => C_MARKS.indexOf(String(x.mark)) - C_MARKS.indexOf(String(y.mark)));
  if (g.an && rb.an && rb.an.on !== false) {
    const ab = anchorBar(p, g);
    ab.mark = '17';
    ab.count = ab.items.length;
    ab.shape = {
      pts: [
        [0, 0],
        [1, 0],
      ],
      lens: [(ab.A as { L: number }).L],
    };
    ab.pathShape = true;
    ab.ltb = false;
    R.push(ab);
  }
  R.forEach((b) => {
    if (b.a && b.key !== 'c5a' && b.mark !== '10' && b.mark !== '15' && b.mark !== '16') {
      const clear = b.a * 10 - b.d;
      const minC = Math.max(1.5 * b.d, 38);
      if (clear < minC) {
        warn.push(
          `Mác ${b.mark} (${b.name}): khoảng hở ${Math.round(clear)} mm < ${Math.round(minC)} mm (TCVN 11823 – 5.10.3.1)`,
        );
      }
    }
    if (b.mark !== '5A' && Math.max(...b.items) > 11700) {
      warn.push(
        `Mác ${b.mark} (${b.name}): thanh dài ${fmt(Math.max(...b.items) / 1e3, 2)} m > 11,7 m – cần chia và nối`,
      );
    }
  });
  if (edited) {
    warn.push(
      `Đã sửa kích thước/bước thép so với số liệu mẫu CAD (H = ${fmt(row.H / 100, 2)} m): số lượng và chiều dài thanh = số liệu CAD + phần chênh tính theo công thức (gần đúng) – cần kiểm tra lại.`,
    );
  }
  if (p.tsb < p.tst) warn.push('Bề dày chân thân tường nhỏ hơn đỉnh.');
  warn.push(...ancWarn(p, g));
  G.dots = dots;
  G.geo = {
    c1: { lines: G.l1 },
    c2: { dots: dots.d2 },
    c3: { lines: [G.p3] },
    c4: { lines: [G.p4] },
    c5: { dots: dots.d5 },
    c5a: { dots: dots.d5a },
    c6: { lines: [G.p6] },
    c7: { lines: [G.p7] },
    c8: { lines: [G.p8] },
    c9: { lines: G.l9 },
    c10: { lines: G.l10 },
    c11: { lines: G.l11 },
    c12: { lines: G.l12 },
    c13: { lines: [G.p13] },
    c16: { lines: G.l16 },
  };
  return { bars: R, warn, g, G, cad: !edited };
}

export function buildBarsD(p: EngineProject): EngineBarsResult {
  const g = geom(p);
  const c = p.cover;
  const rb = p.rb;
  const Lu = p.Lu;
  const B = g.B;
  const t = g.t;
  const yT = g.yTop;
  const tB = p.tBase;
  const R: EngineBarSpec[] = [];
  const warn: string[] = [];
  const lm = (v: number) => Math.round(v * 10);
  const arr = (n: number, v: number) => Array.from({ length: n }, () => v);
  const on = (k: string) => Boolean(rb[k] && rb[k].on !== false);
  const L = dLayers(p);
  const add = (o: EngineBarSpec) => {
    o.count = o.items.length;
    R.push(o);
    return o;
  };
  const zm = c + 2.5;
  const zpos = (a: number) => distr(Lu, a, zm);
  const vt = Math.min(p.vtop || 0, p.H - 1);
  const nRib = p.type === 'rib' && g.hyp ? g.ribs.length : 0;
  const N = {
    s1: 'Thép đứng thân – mặt sau, chân uốn vào bản đáy',
    s2: 'Thép đứng thân – mặt trước',
    h1: 'Thép ngang thân – mặt trước',
    h1a: 'Thép ngang thân – mặt sau',
    t1: 'Thép giằng thân',
    b1: 'Thép bản đáy – lớp dưới, ngang',
    b2: 'Thép bản đáy – lớp trên, ngang',
    l1: 'Thép dọc bản đáy – vòng chấm',
    u1: 'Thép chữ U ở 2 đầu bản đáy',
    u2: 'Thép chữ U mặt đầu đơn nguyên – lưới 3',
    u3: 'Thép ngang mặt đầu đơn nguyên – lưới 3',
    w1: 'Thép giằng bản đáy',
    k1: 'Thép neo vào đá',
    r2: 'Thép ngang sườn',
    r1: 'Thép xiên sườn',
  };

  if (on('s1')) {
    const d = rb.s1.d;
    const o = c + d / 20;
    const xv = g.xbt - o;
    const yk = yT - vt;
    const xs = g.xb(L.yf1) - o;
    const xe = B - c;
    const path: Point2D[] =
      vt > 0
        ? [
            [xv, yT - c],
            [xv, yk],
            [xs, L.yf1],
            [xe, L.yf1],
          ]
        : [
            [xv, yT - c],
            [xs, L.yf1],
            [xe, L.yf1],
          ];
    const pos = zpos(rb.s1.a || 20);
    const ln = path.slice(1).map((q, i) => Math.hypot(q[0] - path[i][0], q[1] - path[i][1]));
    add({
      key: 's1',
      mark: 't1',
      name: N.s1,
      d,
      a: rb.s1.a,
      path,
      pos,
      yF: L.yf1,
      items: arr(pos.length, lm(pathLen(path))),
      shape: {
        pts:
          vt > 0
            ? [
                [0, 1],
                [0, 0.82],
                [0.1, 0],
                [0.62, 0],
              ]
            : [
                [0, 1],
                [0.1, 0],
                [0.62, 0],
              ],
        lens: ln,
      },
    });
  }
  if (on('s2')) {
    const d = rb.s2.d;
    const x = t + c + d / 20;
    const hk = 30;
    const path: Point2D[] = [
      [x + hk, yT - c],
      [x, yT - c],
      [x, L.yf2],
      [x + hk, L.yf2],
    ];
    const pos = zpos(rb.s2.a || 20);
    add({
      key: 's2',
      mark: 't2',
      name: N.s2,
      d,
      a: rb.s2.a,
      path,
      pos,
      yF: L.yf2,
      items: arr(pos.length, lm(pathLen(path))),
      shape: {
        pts: [
          [0.25, 1],
          [0, 1],
          [0, 0],
          [0.25, 0],
        ],
        lens: [hk, yT - c - L.yf2, hk],
      },
    });
  }
  if (on('h1')) {
    const d = rb.h1.d;
    const rows = distr(p.H, rb.h1.a || 20, c).map((v) => tB + v);
    const len = Lu - 2 * zm + 80;
    const dV1 = rb.s1.d;
    const dV2 = rb.s2.d;
    const xF = t + c + dV2 / 10 + d / 20;
    const xB = (y: number) => g.xb(y) - (c + dV1 / 10 + d / 20);
    const sh = {
      pts: [
        [0, 0.3],
        [0, 0],
        [1, 0],
        [1, 0.3],
      ] as Point2D[],
      lens: [40, Lu - 2 * zm, 40],
    };
    add({
      key: 'h1',
      mark: 't3',
      name: N.h1,
      d,
      a: rb.h1.a,
      rows,
      xF,
      pts: rows.map((y): Point2D => [xF, y]),
      path: [
        [0, 0],
        [Lu - 2 * zm, 0],
      ],
      straight: true,
      items: arr(rows.length, lm(len)),
      shape: sh,
      hook: 40,
    });
    add({
      key: 'h1a',
      mark: 't3a',
      name: N.h1a,
      d,
      a: rb.h1.a,
      rows,
      xB,
      pts: rows.map((y): Point2D => [xB(y), y]),
      path: [
        [0, 0],
        [Lu - 2 * zm, 0],
      ],
      straight: true,
      items: arr(rows.length, lm(len)),
      shape: sh,
      hook: 40,
    });
  }
  if (on('t1')) {
    const d = rb.t1.d;
    const a = rb.t1.a || 60;
    const ah = rb.t1.ah || a;
    const rows: number[] = [];
    for (let y = tB + 26.6; y <= yT - c + 1e-9; y += a) rows.push(y);
    const cols = distr(Lu, ah, c + 15);
    const hk = d;
    const w = rows.map((y) => g.xb(y) - g.xf(y) - 2 * c);
    const mean = w.reduce((s, v) => s + v, 0) / (w.length || 1);
    const Lg = mean + 2 * hk;
    const items: number[] = [];
    rows.forEach(() => cols.forEach(() => items.push(lm(Lg))));
    if (rows.length) {
      add({
        key: 't1',
        mark: 't4',
        name: N.t1,
        d,
        a,
        ah,
        rows,
        cols,
        path: [
          [0, 0],
          [Lg, 0],
        ],
        straight: true,
        items,
        tie: true,
        shape: {
          pts: [
            [0, -0.12],
            [0, 0],
            [1, 0],
            [1, -0.12],
          ],
          lens: [hk, mean, hk],
          lab: [
            null,
            `${Math.round(Math.min(...w) * 10)}-${Math.round(Math.max(...w) * 10)}`,
            null,
          ],
        },
      });
    }
  }
  if (on('b1')) {
    const d = rb.b1.d;
    const pos = zpos(rb.b1.a || 20);
    add({
      key: 'b1',
      mark: 'b1',
      name: N.b1,
      d,
      a: rb.b1.a,
      path: [
        [c, L.yb1],
        [B - c, L.yb1],
      ],
      pos,
      y: L.yb1,
      straight: true,
      items: arr(pos.length, lm(B - 2 * c)),
    });
  }
  if (on('b2')) {
    const d = rb.b2.d;
    const pos = zpos(rb.b2.a || 20);
    add({
      key: 'b2',
      mark: 'b2',
      name: N.b2,
      d,
      a: rb.b2.a,
      path: [
        [c, L.yb2],
        [B - c, L.yb2],
      ],
      pos,
      y: L.yb2,
      straight: true,
      items: arr(pos.length, lm(B - 2 * c)),
    });
  }
  if (on('l1')) {
    const d = rb.l1.d;
    const pts = dRing(p, g);
    add({
      key: 'l1',
      mark: 'b3',
      name: N.l1,
      d,
      a: rb.l1.a,
      pts,
      yl: L.ylo,
      yu: L.yup,
      path: [
        [0, 0],
        [Lu - 2 * zm, 0],
      ],
      straight: true,
      items: arr(pts.length, lm(Lu - 2 * zm)),
    });
  }
  if (on('u1')) {
    const d = rb.u1.d;
    const pos = zpos(rb.u1.a || 20);
    const yb = 10;
    const yu = tB - 10;
    const web = yu - yb;
    const hk = 30;
    const xw = c + d / 20;
    const items = arr(2 * pos.length, lm(web + 2 * hk));
    add({
      key: 'u1',
      mark: 'b4',
      name: N.u1,
      d,
      a: rb.u1.a,
      pos,
      yb,
      yu,
      xw,
      hk,
      path: [
        [xw + hk, yu],
        [xw, yu],
        [xw, yb],
        [xw + hk, yb],
      ],
      items,
      dup: true,
      shape: {
        pts: [
          [0.25, 1],
          [0, 1],
          [0, 0],
          [0.25, 0],
        ],
        lens: [hk, web, hk],
      },
    });
  }
  if (on('u2')) {
    const d = rb.u2.d;
    const xs = dRingXs(B, rb.u2.a || 20, c + 2.5);
    const hk = 30;
    const zw = c + d / 20;
    const yb =
      Math.max(
        10 + (rb.u1.d + d) / 20,
        10 + (d + rb.u3.d) / 20,
        L.yf1 + (rb.s1.d + d) / 20,
        L.yf2 + (rb.s2.d + d) / 20,
      ) + 0.1;
    const yu = tB - yb;
    const web = yu - yb;
    add({
      key: 'u2',
      mark: 'b4a',
      name: N.u2,
      d,
      a: rb.u2.a,
      xs,
      yb,
      yu,
      zw,
      hk,
      path: [
        [zw + hk, yu],
        [zw, yu],
        [zw, yb],
        [zw + hk, yb],
      ],
      items: arr(2 * xs.length, lm(web + 2 * hk)),
      dup: true,
      shape: {
        pts: [
          [0.25, 1],
          [0, 1],
          [0, 0],
          [0.25, 0],
        ],
        lens: [hk, web, hk],
      },
    });
    if (on('u3')) {
      const d3 = rb.u3.d;
      const a3 = rb.u3.a || 0;
      const n3 = Math.max(2, Math.round((tB - 20) / (a3 > 0 ? a3 : 20)) + 1);
      const rows = Array.from({ length: n3 }, (_, i) => 10 + (i * (tB - 20)) / (n3 - 1));
      const zb = c + d / 10 + d3 / 20;
      add({
        key: 'u3',
        mark: 'b6',
        name: N.u3,
        d: d3,
        a: 0,
        rows,
        zb,
        path: [
          [c, 0],
          [B - c, 0],
        ],
        straight: true,
        items: arr(2 * n3, lm(B - 2 * c)),
        dup: true,
      });
    }
  }
  if (on('w1')) {
    const d = rb.w1.d;
    const a = rb.w1.a || 60;
    const xs: number[] = [];
    for (let x = B - 71; x > g.xbb + 4 + 1e-9; x -= a) xs.push(x);
    xs.reverse();
    const zs = distr(Lu, a, c + 15);
    const len = tB - 2 * c + 2 * d;
    const items: number[] = [];
    xs.forEach(() => zs.forEach(() => items.push(lm(len))));
    if (xs.length) {
      add({
        key: 'w1',
        mark: 'b5',
        name: N.w1,
        d,
        a,
        xs,
        zs,
        rows: xs,
        cols: zs,
        path: [
          [0, 0],
          [len, 0],
        ],
        straight: true,
        items,
        tie: true,
        shape: {
          pts: [
            [0, -0.12],
            [0, 0],
            [1, 0],
            [1, -0.12],
          ],
          lens: [d, tB - 2 * c, d],
        },
      });
    }
  }
  if (g.an && on('k1')) {
    const A = dAnchors(p, g);
    const d = rb.k1.d;
    add({
      key: 'k1',
      mark: 'b7',
      name: N.k1,
      d,
      a: rb.k1.a,
      A,
      path: [
        [0, 0],
        [A.L, 0],
      ],
      straight: true,
      items: arr(A.xs.length * A.zs.length, lm(A.L)),
    });
  }
  if (nRib && g.hyp) {
    const { T, E } = g.hyp;
    const ux = E[0] - T[0];
    const uy = E[1] - T[1];
    const sinT = Math.abs(uy) / Math.hypot(ux, uy);
    const xh = (y: number) => T[0] + (ux * (T[1] - y)) / (T[1] - E[1]);
    const xF = t + c + rb.s2.d / 20;
    if (on('r2')) {
      const d = rb.r2.d;
      const a = rb.r2.a || 20;
      const rows: number[] = [];
      const y0 = tB + c + 1.6;
      for (let y = y0; y <= g.yR - 30 + 1e-9; y += a) rows.push(y);
      const xe = (y: number) => xh(y) - (c + d / 20) / sinT;
      const items: number[] = [];
      rows.forEach((y) => {
        for (let k = 0; k < nRib * 2; k++) items.push(lm(xe(y) - xF));
      });
      const mid = rows[Math.floor(rows.length / 2)];
      if (rows.length) {
        add({
          key: 'r2',
          mark: 't6',
          name: N.r2,
          d,
          a,
          rows,
          xF,
          xe,
          path: [
            [0, 0],
            [xe(mid) - xF, 0],
          ],
          straight: true,
          items,
          per: 2,
        });
      }
    }
    if (on('r1')) {
      const d = rb.r1.d;
      const dg = dRibDiag(p, g, xF, B - c, L.ylo + rb.l1.d / 20 + d / 20);
      const items: number[] = [];
      dg.forEach((q) => {
        for (let k = 0; k < nRib * 2; k++) items.push(lm(q.len));
      });
      const mx = dg.length ? dg.reduce((s, q) => Math.max(s, q.len), 0) : 0;
      if (dg.length) {
        add({
          key: 'r1',
          mark: 't7',
          name: N.r1,
          d,
          a: rb.r1.a,
          diag: dg,
          xF,
          path: [
            [0, 0],
            [mx, 0],
          ],
          straight: true,
          items,
          per: 2,
          minL: undefined,
        });
      }
    }
  }
  const ord = [
    't1',
    't2',
    't3',
    't3a',
    't4',
    't6',
    't7',
    'b1',
    'b2',
    'b3',
    'b4',
    'b4a',
    'b5',
    'b6',
    'b7',
  ];
  R.sort((x, y) => ord.indexOf(String(x.mark)) - ord.indexOf(String(y.mark)));
  R.forEach((b) => {
    const aa = b.a;
    if (aa && !b.dup) {
      const clear = aa * 10 - b.d;
      if (clear < Math.max(1.5 * b.d, 38)) {
        warn.push(
          `Mác ${b.mark} (${b.name}): khoảng hở ${Math.round(clear)} mm < ${Math.round(Math.max(1.5 * b.d, 38))} mm (TCVN 11823 – 5.10.3.1)`,
        );
      }
    }
    if (Math.max(...b.items) > 11700) {
      warn.push(
        `Mác ${b.mark} (${b.name}): thanh dài ${fmt(Math.max(...b.items) / 1e3, 2)} m > 11,7 m – cần chia và nối`,
      );
    }
  });
  if (c < 4) warn.push('Lớp bảo vệ < 4 cm.');
  warn.push(...ancWarn(p, g));
  return { bars: R, warn, g };
}

export type { BarSpec, BarsResult };
