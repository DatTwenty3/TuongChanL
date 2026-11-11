import type {
  CadCircleEntity,
  CadContext,
  CadDimEntity,
  Point2D,
  Project,
} from '../types/project';
import { type CadBoxMeta, type Ents, mkBox } from './ents';
import { clamp, DIMSTY, fmt, type TemplateCGeoEntry, textW } from './layers';

let DIM_ID = 0;

export function resetDimId(start = 0): void {
  DIM_ID = start;
}

export interface DimOpts {
  out?: boolean;
  sh?: number;
  tx?: number;
  dxfTxt?: string;
  d?: number;
  fixed?: boolean;
  at?: number;
  cut?: number;
}

export type DimSide = 'L' | 'R' | 'B' | 'T';

export type DimRowItem<T = Point2D> = [T, T, string?, DimOpts?];

export interface DimRowSpec {
  lvl: number;
  list: Array<DimRowItem<Point2D> | null | undefined>;
}

export function dimRaw(
  E: Ents,
  la: Point2D,
  lb: Point2D,
  a2: Point2D,
  b2: Point2D,
  label: string | undefined,
  ctx: CadContext,
  o: DimOpts = {},
): void {
  const { mm } = ctx;
  const st = ctx.dst || DIMSTY.B;
  const i0 = E.a.length;
  const dx = b2[0] - a2[0];
  const dy = b2[1] - a2[1];
  const L = Math.hypot(dx, dy);
  if (L < 1e-6) return;
  const ux = dx / L;
  const uy = dy / L;
  let nx = a2[0] - la[0];
  let ny = a2[1] - la[1];
  const nl = Math.hypot(nx, ny);
  if (nl < 1e-9) {
    nx = -uy;
    ny = ux;
  } else {
    nx /= nl;
    ny /= nl;
  }
  const gap = mm(st.exo);
  const ext = mm(st.exe);
  const asz = mm(st.asz);
  const txt = label === undefined ? fmt(L * 10) : label;
  const tw = textW(txt, mm(st.txt)) * (st.wf || 1);
  const arrIn = o.out ? L >= 2.4 * asz : L >= tw + 2 * asz;
  const txtIn = !o.out && L >= tw + mm(0.8);

  E.line(la[0] + nx * gap, la[1] + ny * gap, a2[0] + nx * ext, a2[1] + ny * ext, 'DIM');
  E.line(lb[0] + nx * gap, lb[1] + ny * gap, b2[0] + nx * ext, b2[1] + ny * ext, 'DIM');
  E.line(a2[0], a2[1], b2[0], b2[1], 'DIM');
  if (arrIn) {
    E.arrow(a2[0], a2[1], ux, uy, asz, asz / 3);
    E.arrow(b2[0], b2[1], -ux, -uy, asz, asz / 3);
  } else {
    E.arrow(a2[0], a2[1], -ux, -uy, asz, asz / 3);
    E.arrow(b2[0], b2[1], ux, uy, asz, asz / 3);
    E.line(a2[0] - ux * 2 * asz, a2[1] - uy * 2 * asz, a2[0], a2[1], 'DIM');
    E.line(b2[0], b2[1], b2[0] + ux * 2 * asz, b2[1] + uy * 2 * asz, 'DIM');
  }

  let ang = (Math.atan2(uy, ux) * 180) / Math.PI;
  if (ang > 90.01 || ang <= -89.99) ang += 180;
  const r = (ang * Math.PI) / 180;
  const up: Point2D = [-Math.sin(r), Math.cos(r)];
  let sh = 0;
  if (!txtIn) {
    const dir = o.sh || ((E._sd = (E._sd || 0) + 1) % 2 ? 1 : -1);
    sh = dir * (L / 2 + tw / 2 + (arrIn ? mm(0.8) : 2.2 * asz));
  }
  sh += o.tx || 0;
  const m: Point2D = [
    (a2[0] + b2[0]) / 2 + up[0] * mm(st.gap) + Math.cos(r) * sh,
    (a2[1] + b2[1]) / 2 + up[1] * mm(st.gap) + Math.sin(r) * sh,
  ];
  E.text(m[0], m[1], txt, mm(st.txt), 'DIM', { al: 'c', va: 'b', rot: ang, wf: st.wf || 1 });
  const lastEnt = E.a[E.a.length - 1];
  if (lastEnt.k === 'T') lastEnt.col = 3;

  const id = ++DIM_ID;
  for (let i = i0; i < E.a.length; i++) {
    const ent = E.a[i];
    if (ent.k !== 'DM') ent.dm = id;
  }
  const hor = Math.abs(dy) < 1e-6;
  const ver = Math.abs(dx) < 1e-6;
  const dm: CadDimEntity = {
    k: 'DM',
    id,
    a: [la[0], la[1]],
    b: [lb[0], lb[1]],
    dl: [a2[0], a2[1]],
    tm: [m[0], m[1]],
    typ: hor || ver ? 0 : 1,
    ang: hor ? 0 : 90,
    ly: 'DIM',
    txt: o.dxfTxt,
  };
  E.a.push(dm);
}

export function dim(
  E: Ents,
  a: Point2D,
  b: Point2D,
  off: number,
  label: string | undefined,
  ctx: CadContext,
): void {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const L = Math.hypot(dx, dy);
  if (L < 1e-6) return;
  const ux = dx / L;
  const uy = dy / L;
  const s = off >= 0 ? 1 : -1;
  const nx = -uy * s;
  const ny = ux * s;
  const ao = Math.abs(off);
  dimRaw(E, a, b, [a[0] + nx * ao, a[1] + ny * ao], [b[0] + nx * ao, b[1] + ny * ao], label, ctx);
}

export function dimGeo(
  E: Ents,
  side: DimSide,
  _ctx: CadContext,
): { vert: boolean; edge: number; sg: number } {
  const env = E.env!;
  const vert = side === 'L' || side === 'R';
  return {
    vert,
    edge: side === 'L' ? env.x0 : side === 'R' ? env.x1 : side === 'B' ? env.y0 : env.y1,
    sg: side === 'L' || side === 'B' ? -1 : 1,
  };
}

export function dimBand(
  vert: boolean,
  ln: number,
  lo: number,
  hi: number,
  mm: (v: number) => number,
): CadBoxMeta {
  return vert
    ? mkBox(ln - mm(3.4), lo, ln + mm(0.6), hi)
    : mkBox(lo, ln - mm(0.6), hi, ln + mm(3.4));
}

export function dimLevel(
  E: Ents,
  side: DimSide,
  spans: Array<[number, number]>,
  lvl: number,
  ctx: CadContext,
  fixed?: boolean,
): number {
  const { mm } = ctx;
  const { vert, edge, sg } = dimGeo(E, side, ctx);
  let d = mm(lvl);
  let n = 0;
  const obs = (): CadBoxMeta[] => E.lbl.concat(E.dz || []);
  const hit = (dd: number): boolean =>
    spans.some(([lo, hi]) => {
      const b = dimBand(vert, edge + sg * dd, lo, hi, mm);
      return obs().some((l) => b.x0 < l.x1 && b.x1 > l.x0 && b.y0 < l.y1 && b.y1 > l.y0);
    });
  if (!fixed) while (hit(d) && n++ < 24) d += mm(1.25);
  return d;
}

export function dimE(
  E: Ents,
  a: Point2D,
  b: Point2D,
  side: DimSide,
  lvl: number,
  label: string | undefined,
  ctx: CadContext,
  o: DimOpts = {},
): number {
  const env = E.env;
  const { mm } = ctx;
  const vert = side === 'L' || side === 'R';
  if (!env) {
    dim(
      E,
      a,
      b,
      vert ? (side === 'L' ? mm(lvl) : -mm(lvl)) : side === 'T' ? -mm(lvl) : mm(lvl),
      label,
      ctx,
    );
    return mm(lvl);
  }
  const { edge, sg } = dimGeo(E, side, ctx);
  const st = ctx.dst || DIMSTY.B;
  const lo = vert ? Math.min(a[1], b[1]) : Math.min(a[0], b[0]);
  const hi = vert ? Math.max(a[1], b[1]) : Math.max(a[0], b[0]);
  const ext = hi - lo < mm(9) ? mm(5.5) : 0;
  const d = o.d !== undefined ? o.d : dimLevel(E, side, [[lo - ext, hi + ext]], lvl, ctx, o.fixed);
  const org =
    o.at !== undefined
      ? o.at
      : edge + sg * (mm(o.cut !== undefined ? o.cut : st.cut || 3) - mm(st.exo));
  const la: Point2D = ctx.legFull ? a : vert ? [org, a[1]] : [a[0], org];
  const lb: Point2D = ctx.legFull ? b : vert ? [org, b[1]] : [b[0], org];
  const a2: Point2D = vert ? [edge + sg * d, a[1]] : [a[0], edge + sg * d];
  const b2: Point2D = vert ? [edge + sg * d, b[1]] : [b[0], edge + sg * d];
  dimRaw(E, la, lb, a2, b2, label, ctx, o);
  (E.dz = E.dz || []).push(dimBand(vert, edge + sg * d, lo - ext, hi + ext, mm));
  return d;
}

export function dimRows(E: Ents, side: DimSide, rows: DimRowSpec[], ctx: CadContext): void {
  const { mm } = ctx;
  const vert = side === 'L' || side === 'R';
  let shift = 0;

  rows.forEach((r, ri) => {
    const L = r.list.filter((it): it is DimRowItem<Point2D> => Boolean(it));
    if (!L.length) return;
    const forb: number[] = [];
    rows.slice(ri + 1).forEach((r2) =>
      r2.list
        .filter((it): it is DimRowItem<Point2D> => Boolean(it))
        .forEach(([a, b]) => {
          forb.push(vert ? a[1] : a[0], vert ? b[1] : b[0]);
        }),
    );

    const spans: Array<[number, number]> = L.map(([a, b]) => {
      const lo = vert ? Math.min(a[1], b[1]) : Math.min(a[0], b[0]);
      const hi = vert ? Math.max(a[1], b[1]) : Math.max(a[0], b[0]);
      const ext = hi - lo < mm(9) ? mm(5.5) : 0;
      return [lo - ext, hi + ext];
    });

    const d = dimLevel(E, side, spans, r.lvl + shift / mm(1), ctx, false);
    shift = d - mm(r.lvl);

    {
      const { edge, sg } = dimGeo(E, side, ctx);
      const ln = edge + sg * d;
      E.a.forEach((e) => {
        if (e.ly !== 'LEAD') return;
        const sgs: Array<[number, number, number, number]> =
          e.k === 'L'
            ? [[e.x1, e.y1, e.x2, e.y2]]
            : e.k === 'P'
              ? e.pts.slice(1).map((q, i) => [e.pts[i][0], e.pts[i][1], q[0], q[1]])
              : [];
        sgs.forEach(([x1, y1, x2, y2]) => {
          const u1 = vert ? x1 : y1;
          const u2 = vert ? x2 : y2;
          if (Math.abs(u2 - u1) < 1e-9 || (u1 - ln) * (u2 - ln) > 0) return;
          const t = (ln - u1) / (u2 - u1);
          forb.push(vert ? y1 + (y2 - y1) * t : x1 + (x2 - x1) * t);
        });
      });
    }

    const key = ([a, b]: DimRowItem<Point2D>): number =>
      vert ? Math.min(a[1], b[1]) : Math.min(a[0], b[0]);
    const ord = L.slice().sort((u, v) => key(u) - key(v));
    const wdt = (it: DimRowItem<Point2D>): number =>
      vert ? Math.abs(it[0][1] - it[1][1]) : Math.abs(it[0][0] - it[1][0]);

    const shOf = (it: DimRowItem<Point2D>): number | undefined => {
      const i = ord.indexOf(it);
      const n = ord.length;
      if (n < 2) return undefined;
      if (i === 0) return -1;
      if (i === n - 1) return 1;
      const wl = wdt(ord[i - 1]);
      const wr = wdt(ord[i + 1]);
      return wl > wr + 1e-6 ? -1 : wr > wl + 1e-6 ? 1 : i % 2 ? 1 : -1;
    };

    const st = ctx.dst || DIMSTY.B;
    const asz = mm(st.asz);
    const tx = new Map<DimRowItem<Point2D>, number>();
    const gapT = mm(0.7);

    const ivl = (it: DimRowItem<Point2D>) => {
      const [a, b, label, o] = it;
      const lo = vert ? Math.min(a[1], b[1]) : Math.min(a[0], b[0]);
      const hi = vert ? Math.max(a[1], b[1]) : Math.max(a[0], b[0]);
      const Ln = hi - lo;
      const tw = textW(label === undefined ? fmt(Ln * 10) : label, mm(st.txt)) * (st.wf || 1);
      const inSeg = Ln >= tw + mm(0.8);
      const dir = (o && o.sh) || shOf(it) || 1;
      const c =
        (lo + hi) / 2 + (inSeg ? 0 : dir * (Ln / 2 + tw / 2 + 2.2 * asz)) + (tx.get(it) || 0);
      return {
        inSeg,
        c,
        s: c - tw / 2,
        e: c + tw / 2,
        slack: inSeg ? Math.max(0, (Ln - tw) / 2 - mm(0.4)) : 0,
      };
    };

    if (ord.length > 1) {
      for (let i = 1; i < ord.length; i++) {
        const A = ivl(ord[i - 1]);
        const B = ivl(ord[i]);
        let ov = A.e + gapT - B.s;
        if (ov <= 0) continue;
        if (B.inSeg) {
          const m = Math.min(ov, B.slack);
          tx.set(ord[i], (tx.get(ord[i]) || 0) + m);
          ov -= m;
        }
        if (ov > 1e-9 && A.inSeg) {
          const m = Math.min(ov, A.slack);
          tx.set(ord[i - 1], (tx.get(ord[i - 1]) || 0) - m);
          ov -= m;
        }
      }
    }

    const gm = mm(0.6);
    const hitF = (c: number, tw: number): boolean =>
      forb.some((f) => f > c - tw / 2 - gm + 1e-6 && f < c + tw / 2 + gm - 1e-6);

    const avoid = (it: DimRowItem<Point2D>): DimOpts | null => {
      if (!forb.length) return null;
      const [a, b, label, o] = it;
      if (o && (o.sh || o.tx !== undefined || o.out)) return null;
      const lo = vert ? Math.min(a[1], b[1]) : Math.min(a[0], b[0]);
      const hi = vert ? Math.max(a[1], b[1]) : Math.max(a[0], b[0]);
      const Ln = hi - lo;
      const mid = (lo + hi) / 2;
      const tw = textW(label === undefined ? fmt(Ln * 10) : label, mm(st.txt)) * (st.wf || 1);
      const inSeg = Ln >= tw + mm(0.8);
      if (!hitF(ivl(it).c, tw)) return null;
      if (inSeg) {
        const slack = (Ln - tw) / 2 - mm(0.4);
        const cand: number[] = [];
        forb.forEach((f) => {
          cand.push(f + tw / 2 + gm, f - tw / 2 - gm);
        });
        const ok = cand
          .filter((c) => Math.abs(c - mid) <= slack + 1e-9 && !hitF(c, tw))
          .sort((u, v) => Math.abs(u - mid) - Math.abs(v - mid));
        if (ok.length) return { tx: ok[0] - mid };
      }
      const g = inSeg && Ln >= 2.4 * asz ? mm(0.8) : 2.2 * asz;
      const dir0 = shOf(it) || 1;
      const others = L.filter((x) => x !== it).map(ivl);
      for (const e of [0, 0.5, 1, 1.5, 2, 3]) {
        for (const dd of [dir0, -dir0]) {
          const c = mid + dd * (Ln / 2 + tw / 2 + g + mm(e));
          if (hitF(c, tw) || others.some((q) => c - tw / 2 < q.e + gapT && c + tw / 2 > q.s - gapT)) {
            continue;
          }
          return { out: inSeg ? true : undefined, sh: dd, tx: dd * mm(e) };
        }
      }
      return null;
    };

    L.forEach((it) => {
      const [a, b, label, o] = it;
      dimE(
        E,
        a,
        b,
        side,
        r.lvl,
        label,
        ctx,
        Object.assign({ sh: shOf(it), tx: tx.get(it) || 0 }, o, { d }, avoid(it) || {}),
      );
    });
  });
}

export function spacingList<T>(pos: number[], lo: number, hi: number, mk: (v: number) => T): DimRowItem<T>[] {
  const P = pos.slice().sort((u, v) => u - v);
  const out: DimRowItem<T>[] = [];
  const eps = 0.06;
  if (!P.length) return out;
  if (P[0] - lo > eps) out.push([mk(lo), mk(P[0])]);
  for (let i = 0; i < P.length - 1; ) {
    const st = P[i + 1] - P[i];
    let j = i + 1;
    while (j < P.length - 1 && Math.abs(P[j + 1] - P[j] - st) < eps) j++;
    const n = j - i;
    const tot = P[j] - P[i];
    out.push(
      n === 1
        ? [mk(P[i]), mk(P[j])]
        : [
            mk(P[i]),
            mk(P[j]),
            `${n}x${fmt(st * 10)}=${fmt(tot * 10)}`,
            { dxfTxt: `${n}x${fmt(st * 10)}=<>` },
          ],
    );
    i = j;
  }
  if (hi - P[P.length - 1] > eps) out.push([mk(P[P.length - 1]), mk(hi)]);
  return out;
}

export function pipPoly(P: readonly Point2D[], x: number, y: number): boolean {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    if (
      P[i][1] > y !== P[j][1] > y &&
      x < ((P[j][0] - P[i][0]) * (y - P[i][1])) / (P[j][1] - P[i][1]) + P[i][0]
    ) {
      c = !c;
    }
  }
  return c;
}

export function segBox(x1: number, y1: number, x2: number, y2: number, b: { x0: number; x1: number; y0: number; y1: number }): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const P = [-dx, dx, -dy, dy];
  const Q = [x1 - b.x0, b.x1 - x1, y1 - b.y0, b.y1 - y1];
  for (let i = 0; i < 4; i++) {
    if (Math.abs(P[i]) < 1e-12) {
      if (Q[i] < 0) return false;
      continue;
    }
    const r = Q[i] / P[i];
    if (P[i] < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
  }
  return true;
}

export function lrSegs(E: Ents): Array<[Point2D, Point2D]> {
  const r: Array<[Point2D, Point2D]> = [];
  for (const e of E.a) {
    if (e.ly !== 'REB' && e.ly !== 'REB2') continue;
    if (e.k === 'L') {
      r.push([
        [e.x1, e.y1],
        [e.x2, e.y2],
      ]);
    } else if (e.k === 'P') {
      for (let k = 1; k < e.pts.length; k++) r.push([e.pts[k - 1], e.pts[k]]);
      if (e.closed) r.push([e.pts[e.pts.length - 1], e.pts[0]]);
    }
  }
  return r;
}

export function lrHit(
  reb: Array<[Point2D, Point2D]>,
  a: Point2D,
  b: Point2D,
  mm: (v: number) => number,
): boolean {
  const la = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (la < mm(0.8)) return false;
  const ux = (b[0] - a[0]) / la;
  const uy = (b[1] - a[1]) / la;
  for (const [c, d] of reb) {
    const lc = Math.hypot(d[0] - c[0], d[1] - c[1]);
    if (lc < mm(0.8)) continue;
    if (Math.abs(ux * (d[1] - c[1]) - uy * (d[0] - c[0])) / lc > 0.07) continue;
    const t0 = (c[0] - a[0]) * ux + (c[1] - a[1]) * uy;
    const t1 = (d[0] - a[0]) * ux + (d[1] - a[1]) * uy;
    const lo = Math.max(0, Math.min(t0, t1));
    const hi = Math.min(la, Math.max(t0, t1));
    if (hi - lo > mm(0.8) && Math.abs((c[0] - a[0]) * uy - (c[1] - a[1]) * ux) < mm(0.5)) {
      return true;
    }
  }
  return false;
}

export function calloutMin(lines: string | string[], mark: string | number, ctx: CadContext): number {
  const { mm } = ctx;
  const ls = ([] as string[]).concat(lines).filter(Boolean);
  const mk = String(mark);
  const R = mm(mk.length > 1 ? 2.4 : 1.92);
  const tw = Math.max(0, ...ls.map((s) => textW(s, mm(2)))) * 0.7 + mm(0.4);
  return R + tw + 2 * mm(1.5);
}

function chnHitBox(E: Ents, bx: CadBoxMeta): boolean {
  return (E.chn || []).some((q) => bx.x0 < q.x1 && bx.x1 > q.x0 && bx.y0 < q.y1 && bx.y1 > q.y0);
}

function chnHitLead(E: Ents, r: CadBoxMeta): boolean {
  if (r.dg) return false;
  const o: 'h' | 'v' = r.x1 - r.x0 >= r.y1 - r.y0 ? 'h' : 'v';
  return (E.chn || []).some(
    (q) => q.o === o && r.x0 < q.x1 && r.x1 > q.x0 && r.y0 < q.y1 && r.y1 > q.y0,
  );
}

function hitStrip(E: Ents, r: CadBoxMeta): boolean {
  return E.lbl
    .concat(E.dz || [])
    .some(
      (q) =>
        r.x0 < q.x1 &&
        r.x1 > q.x0 &&
        r.y0 < q.y1 &&
        r.y1 > q.y0 &&
        !(q.s && r.o && q.o && q.o !== r.o),
    );
}

export function dotAt(E: Ents, pt: Point2D, tol: number): CadCircleEntity | null {
  let best: CadCircleEntity | null = null;
  let bd = 1e18;
  for (const e of E.a) {
    if (e.k === 'C' && (e.ly === 'RDOT' || e.ly === 'RDOTW')) {
      const q = Math.hypot(e.x - pt[0], e.y - pt[1]);
      if (q < bd) {
        bd = q;
        best = e;
      }
    }
  }
  return best && bd <= tol ? best : null;
}

export interface LeadEndOpts {
  kind?: string;
  asz?: number;
  maxLen?: number;
}

export function leadEnd(
  E: Ents,
  pt: Point2D,
  ux: number,
  uy: number,
  ctx: CadContext,
  o: LeadEndOpts = {},
): Point2D {
  const { mm } = ctx;
  if (o.kind === 'dot') {
    const dt = dotAt(E, pt, mm(1.3));
    const c: Point2D = dt ? [dt.x, dt.y] : pt;
    const R = Math.max(mm(0.56), (dt ? dt.r : mm(0.38)) + mm(0.24));
    E.circ(c[0], c[1], R, 'LEAD');
    return [c[0] + ux * R, c[1] + uy * R];
  }
  const len = Math.min(o.asz || mm(1.9), o.maxLen || 1e9);
  if (len > mm(0.3)) E.arrow(pt[0], pt[1], ux, uy, len, len * 0.36, 'LEAD');
  return pt;
}

export interface CalloutOpts {
  ring?: boolean;
  kind?: string;
  chain?: boolean;
  slide?: (y: number) => Point2D | null;
  reb?: boolean;
  diag?: number;
  colX?: number;
  fixY?: boolean;
  ys?: number[];
  outY?: number;
  asz?: number;
  outside?: boolean;
  minL?: number;
  straight?: boolean;
  oneWay?: boolean;
  dots?: boolean;
  txtReb?: boolean;
  dry?: boolean;
  bub?: boolean;
}

export type CalloutAHOpts = CalloutOpts;

export function callout(
  E: Ents,
  ptIn: Point2D,
  dx: number,
  dy: number,
  linesIn: string | string[],
  markIn: string | number,
  ctx: CadContext,
  o: CalloutOpts = {},
): { cx: number; cy: number; ok: boolean } {
  const { mm } = ctx;
  const sg = dx >= 0 ? 1 : -1;
  let pt: Point2D = ptIn;
  const lines = ([] as string[]).concat(linesIn).filter(Boolean);
  const mark = String(markIn);
  if ((o.ring || o.kind === 'dot') && !o.chain) {
    const dt = dotAt(E, pt, mm(1.3));
    if (dt) pt = [dt.x, dt.y];
  }
  const TH = mm(2);
  const WF = 0.7;
  const R = mm(mark.length > 1 ? 2.4 : 1.92);
  const gT = mm(1.5);
  const tw = Math.max(0, ...lines.map((s) => textW(s, TH))) * WF + mm(0.4);
  const minOff = R + tw + 2 * gT;
  const ptAt = (y: number): Point2D | null => (o.slide ? o.slide(y) : pt);

  let cx = pt[0] + sg * Math.max(Math.abs(dx), minOff);
  let cy = pt[1] + dy;

  const box = (y: number, x = cx): CadBoxMeta =>
    mkBox(
      sg > 0 ? x - R - tw - 2 * gT : x - R,
      y - mm(2.7),
      sg > 0 ? x + R : x + R + tw + 2 * gT,
      y + mm(2.9),
    );

  const geo = ctx.geoHit
    ? E.a.filter((e) => e.ly === 'OUT' || e.ly === 'THIN' || e.ly === 'HID')
    : null;
  const hitGeo = (bx: CadBoxMeta): boolean =>
    Boolean(
      geo &&
        geo.some((e) =>
          e.k === 'L'
            ? segBox(e.x1, e.y1, e.x2, e.y2, bx)
            : e.k === 'P' &&
              (e.pts.some(
                (q, i) => i > 0 && segBox(e.pts[i - 1][0], e.pts[i - 1][1], q[0], q[1], bx),
              ) ||
                (e.closed &&
                  segBox(
                    e.pts[e.pts.length - 1][0],
                    e.pts[e.pts.length - 1][1],
                    e.pts[0][0],
                    e.pts[0][1],
                    bx,
                  ))),
        ),
    );
  const hitLbl = (bx: CadBoxMeta): boolean =>
    E.lbl
      .concat(E.dz || [])
      .some((q) => bx.x0 < q.x1 && bx.x1 > q.x0 && bx.y0 < q.y1 && bx.y1 > q.y0);
  const conc = ctx.geoHit
    ? E.a.filter(
        (e): e is Extract<typeof e, { k: 'P' }> =>
          e.k === 'P' && e.ly === 'OUT' && e.closed,
      )
    : [];
  const inConc = (x: number, y: number): boolean => conc.some((e) => pipPoly(e.pts, x, y));
  const reb = o.reb ? lrSegs(E) : null;

  const lrBad = (x: number, y: number): boolean => {
    if (!reb) return false;
    const T = ptAt(y);
    if (!T) return false;
    const ex = x - sg * R;
    const el = Math.abs(y - T[1]) > 1e-6;
    const sx = el && o.diag ? T[0] + sg * Math.abs(y - T[1]) * o.diag : T[0];
    return lrHit(reb, [sx, y], [ex, y], mm) || (el && lrHit(reb, T, [sx, y], mm));
  };

  const lead = (x: number, y: number): CadBoxMeta[] => {
    const T = ptAt(y) || pt;
    const ex = x - sg * R;
    const el = Math.abs(y - T[1]) > 1e-6;
    const sxx = el && o.diag ? T[0] + sg * Math.abs(y - T[1]) * o.diag : T[0];
    const r: CadBoxMeta[] = [
      mkBox(Math.min(sxx, ex), y - mm(0.3), Math.max(sxx, ex), y + mm(0.3), { s: 1, o: 'h' }),
    ];
    if (el) {
      if (o.diag) {
        const Ld = Math.hypot(sxx - T[0], y - T[1]);
        const nn = Math.max(4, Math.ceil(Ld / mm(0.7)));
        for (let i = 0; i <= nn; i++) {
          const t = i / nn;
          const qx = T[0] + (sxx - T[0]) * t;
          const qy = T[1] + (y - T[1]) * t;
          r.push(mkBox(qx - mm(0.3), qy - mm(0.3), qx + mm(0.3), qy + mm(0.3), { dg: 1 }));
        }
      } else {
        r.push(
          mkBox(T[0] - mm(0.3), Math.min(T[1], y), T[0] + mm(0.3), Math.max(T[1], y), {
            s: 1,
            o: 'v',
          }),
        );
      }
    }
    return r;
  };

  const bad = (x: number, y: number): boolean => {
    if (!ptAt(y)) return true;
    const bx = box(y, x);
    return (
      hitLbl(bx) ||
      chnHitBox(E, bx) ||
      hitGeo(bx) ||
      inConc(x, y) ||
      inConc(x - sg * (R + tw / 2 + gT), y) ||
      lead(x, y).some((r) => hitStrip(E, r) || chnHitLead(E, r)) ||
      lrBad(x, y)
    );
  };

  const cxB = (y: number): number => {
    if (o.colX !== undefined) return o.colX;
    const T = ptAt(y) || pt;
    return (
      T[0] +
      sg *
        Math.max(
          Math.abs(dx),
          (o.diag && Math.abs(y - T[1]) > 1e-6 ? Math.abs(y - T[1]) * o.diag : 0) + minOff,
        )
    );
  };

  cx = cxB(cy);
  const cy0 = cy;
  const cx0 = cx;
  let k = 0;
  while (bad(cx, cy) && k++ < 14) cx += sg * mm(2);
  if (bad(cx, cy) && !o.fixY) {
    cx = cx0;
    let found = false;
    const stp = o.reb ? mm(1.1) : mm(4);
    const nmx = o.reb ? 48 : 12;
    if (o.ys) {
      for (const yy of o.ys) {
        const xx = cxB(yy);
        if (!bad(xx, yy)) {
          cy = yy;
          cx = xx;
          found = true;
          break;
        }
      }
    } else {
      for (let n = 1; n <= nmx && !found; n++) {
        const s = stp * Math.ceil(n / 2) * (n % 2 ? 1 : -1);
        if (o.outY && Math.sign(s) !== Math.sign(o.outY)) continue;
        const yy = cy0 + s;
        const xx = cxB(yy);
        if (!bad(xx, yy)) {
          cy = yy;
          cx = xx;
          found = true;
        }
      }
    }
    if (!found) cy = cy0;
  }

  const okF = !bad(cx, cy);
  if (!okF) {
    cx = cx0;
    cy = cy0;
  }
  E.lbl.push(box(cy, cx));
  lead(cx, cy).forEach((q) => E.lbl.push(q));

  const P = ptAt(cy) || pt;
  const ex = cx - sg * R;
  const elbow = Math.abs(cy - P[1]) > 1e-6;
  const sx = elbow && o.diag ? P[0] + sg * Math.abs(cy - P[1]) * o.diag : P[0];
  const vx = elbow ? sx - P[0] : sg;
  const vy = elbow ? cy - P[1] : 0;
  const vl = Math.hypot(vx, vy) || 1;
  const st = o.chain
    ? P
    : leadEnd(E, P, vx / vl, vy / vl, ctx, {
        kind: o.ring ? 'dot' : o.kind,
        asz: o.asz,
        maxLen: 0.6 * (elbow ? vl : Math.abs(ex - P[0])),
      });
  if (elbow) E.line(st[0], st[1], sx, cy, 'LEAD');
  E.line(elbow ? sx : st[0], cy, ex, cy, 'LEAD');
  E.circ(cx, cy, R, 'LEAD');
  E.text(cx, cy - mm(1.11), mark, mm(2.5), 'LBL', { al: 'c' });
  const mx = ex - sg * (gT + tw / 2);
  if (lines[0]) E.text(mx, cy + mm(0.67), lines[0], TH, 'LBL', { al: 'c', wf: WF });
  if (lines[1]) E.text(mx, cy - mm(2.47), lines[1], TH, 'LBL', { al: 'c', wf: WF });
  return { cx, cy, ok: okF };
}

export function calloutA(
  E: Ents,
  pt: Point2D,
  sg: number,
  dx: number,
  dy: number,
  text: string,
  mark: string | number,
  ctx: CadContext,
  o: CalloutOpts = {},
): void {
  const { mm } = ctx;
  const th = Math.atan(0.2);
  const c = Math.cos(th);
  const s = Math.sin(th);
  const TH = mm(1.8);
  const Lm = mm(14.5);
  const Lt = mm(4.3);
  const w = textW(text, TH);
  const Lmain = Math.max(Lm, w + mm(2.2));
  let e0: Point2D = [pt[0] + dx, pt[1] + dy];

  const mk = (p0: Point2D): { M: Point2D; T: Point2D } => {
    const M: Point2D = [p0[0] + sg * c * Lmain, p0[1] + sg * s * Lmain];
    const T: Point2D = [M[0] + sg * c * Lt, M[1] + sg * s * Lt];
    return { M, T };
  };

  const box = (p0: Point2D): CadBoxMeta => {
    const { T } = mk(p0);
    const xs = [pt[0], p0[0], T[0]];
    const ys = [pt[1], p0[1], T[1]];
    return mkBox(
      Math.min(...xs) - mm(0.5),
      Math.min(...ys) - mm(0.8),
      Math.max(...xs) + mm(0.5),
      Math.max(...ys) + mm(2.6),
    );
  };

  const hit = (b: CadBoxMeta): boolean =>
    E.lbl
      .concat(E.dz || [])
      .some((q) => b.x0 < q.x1 && b.x1 > q.x0 && b.y0 < q.y1 && b.y1 > q.y0);
  const geo = E.a.filter((e) => e.ly === 'OUT' || e.ly === 'THIN' || e.ly === 'HID');
  const hitGeo = (bx: CadBoxMeta): boolean =>
    geo.some((e) =>
      e.k === 'L'
        ? segBox(e.x1, e.y1, e.x2, e.y2, bx)
        : e.k === 'P' &&
          (e.pts.some(
            (q, i) => i > 0 && segBox(e.pts[i - 1][0], e.pts[i - 1][1], q[0], q[1], bx),
          ) ||
            (e.closed &&
              segBox(
                e.pts[e.pts.length - 1][0],
                e.pts[e.pts.length - 1][1],
                e.pts[0][0],
                e.pts[0][1],
                bx,
              ))),
    );
  const zone = (p0: Point2D): CadBoxMeta => {
    const { M, T } = mk(p0);
    const xa = sg > 0 ? M[0] - w - mm(1.8) : T[0];
    const xb = sg > 0 ? T[0] : M[0] + w + mm(1.8);
    return mkBox(xa, Math.min(M[1], T[1]) - mm(1), xb, Math.max(M[1], T[1], p0[1]) + mm(2.8));
  };

  for (let k = 0, step = mm(4.5); (hit(box(e0)) || hitGeo(zone(e0))) && k < 10; k++) {
    e0 = [pt[0] + dx, pt[1] + dy + step * (k % 2 ? -1 : 1) * Math.ceil((k + 1) / 2)];
  }
  const { M, T } = mk(e0);
  const lx = e0[0] - pt[0];
  const ly = e0[1] - pt[1];
  const ll = Math.hypot(lx, ly) || 1;
  const st = leadEnd(E, pt, lx / ll, ly / ll, ctx, { kind: o.kind, maxLen: 0.6 * ll });
  E.poly([st, e0, M, T], 'LEAD');
  const up = mm(0.52);
  const along = sg > 0 ? -mm(1.4) : mm(0.4);
  const anc = M;
  E.text(anc[0] + c * along - s * up, anc[1] + s * along + c * up, text, TH, 'LBL', {
    al: sg > 0 ? 'r' : 'l',
    rot: 11.3,
  });
  E.text((M[0] + T[0]) / 2, (M[1] + T[1]) / 2, String(mark), TH, 'LBL', {
    al: 'c',
    va: 'm',
    rot: 11.3,
  });
  E.lbl.push(box(e0));
}

export function calloutAH(
  E: Ents,
  ptIn: Point2D,
  sg: number,
  up: number,
  text: string,
  markIn: string | number,
  ctx: CadContext,
  o: CalloutOpts = {},
): boolean | { ok: boolean } {
  const { mm } = ctx;
  const TH = mm(1.8);
  const Rr = mm(2.16);
  const mark = String(markIn);
  const noMk = mark === '';
  const ring = !!o.ring && !noMk;
  const tail = ring ? 2 * Rr : noMk ? mm(0.8) : mm(4.8);
  const tw = textW(text, TH);
  const env = E.env;
  const DG = o.diag ? Number(o.diag) || 1 : 0;

  let pt: Point2D = ptIn;
  if (o.kind === 'dot' && !o.chain) {
    const dt = dotAt(E, pt, mm(1.3));
    if (dt) pt = [dt.x, dt.y];
  }

  let L0 = Math.max(mm(14.8), tw + mm(3.5), o.minL || 0);
  if (o.outside && env) {
    L0 = Math.max(L0, (sg < 0 ? pt[0] - env.x0 : env.x1 - pt[0]) + tw + mm(2.4));
  }

  const geo = E.a.filter((e) => e.ly === 'OUT' || e.ly === 'THIN' || e.ly === 'HID');
  const hitGeo = (bx: CadBoxMeta): boolean =>
    geo.some((e) =>
      e.k === 'L'
        ? segBox(e.x1, e.y1, e.x2, e.y2, bx)
        : e.k === 'P' &&
          (e.pts.some(
            (q, i) => i > 0 && segBox(e.pts[i - 1][0], e.pts[i - 1][1], q[0], q[1], bx),
          ) ||
            (e.closed &&
              segBox(
                e.pts[e.pts.length - 1][0],
                e.pts[e.pts.length - 1][1],
                e.pts[0][0],
                e.pts[0][1],
                bx,
              ))),
    );
  const hitLbl = (bx: CadBoxMeta): boolean =>
    E.lbl
      .concat(E.dz || [])
      .some((q) => bx.x0 < q.x1 && bx.x1 > q.x0 && bx.y0 < q.y1 && bx.y1 > q.y0);

  const zone = (u: number, L: number): CadBoxMeta => {
    const y = pt[1] + u;
    const M = pt[0] + sg * L;
    const xs = [M - sg * (mm(0.43) + tw), M + sg * tail];
    return mkBox(
      Math.min(...xs) - mm(0.3),
      y - (ring ? Rr : mm(1.4)),
      Math.max(...xs) + mm(0.3),
      y + Math.max(mm(2.9), ring ? Rr : 0),
    );
  };

  const elbX = (u: number): number =>
    DG && Math.abs(u) > 1e-6 ? pt[0] + sg * Math.abs(u) * DG : pt[0];

  const strips = (u: number, L: number): CadBoxMeta[] => {
    const y = pt[1] + u;
    const M = pt[0] + sg * L;
    const ex = elbX(u);
    const r: CadBoxMeta[] = [
      mkBox(Math.min(ex, M), y - mm(0.3), Math.max(ex, M), y + mm(0.3), { s: 1, o: 'h' }),
    ];
    if (Math.abs(u) > 1e-6) {
      if (DG) {
        const n = Math.max(4, Math.ceil(Math.hypot(ex - pt[0], u) / mm(0.7)));
        for (let i = 0; i <= n; i++) {
          const t = i / n;
          const qx = pt[0] + (ex - pt[0]) * t;
          const qy = pt[1] + u * t;
          r.push(
            mkBox(qx - mm(0.3), qy - mm(0.3), qx + mm(0.3), qy + mm(0.3), { s: 1, dg: 1 }),
          );
        }
      } else {
        r.push(
          mkBox(pt[0] - mm(0.3), Math.min(pt[1], y), pt[0] + mm(0.3), Math.max(pt[1], y), {
            s: 1,
            o: 'v',
          }),
        );
      }
    }
    return r;
  };

  const outOK = (u: number, L: number): boolean => {
    if (!o.outside || !env) return true;
    const z = zone(u, L);
    return sg < 0 ? z.x1 <= env.x0 : z.x0 >= env.x1;
  };

  const dotsC = o.dots
    ? E.a.filter(
        (e): e is CadCircleEntity =>
          e.k === 'C' &&
          (e.ly === 'RDOT' || e.ly === 'RDOTW') &&
          !(o.kind === 'dot' && Math.hypot(e.x - pt[0], e.y - pt[1]) < mm(1.3)),
      )
    : null;
  const dotHit = (r: CadBoxMeta): boolean =>
    Boolean(
      dotsC &&
        dotsC.some((q) => {
          const ddx = Math.max(r.x0 - q.x, 0, q.x - r.x1);
          const ddy = Math.max(r.y0 - q.y, 0, q.y - r.y1);
          return ddx * ddx + ddy * ddy < (q.r + mm(0.15)) ** 2;
        }),
    );

  const reb = o.reb ? lrSegs(E) : null;
  const rebTxt = o.txtReb ? lrSegs(E) : null;
  const lrBad = (u: number, L: number): boolean =>
    Boolean(
      reb &&
        (lrHit(reb, [elbX(u), pt[1] + u], [pt[0] + sg * L, pt[1] + u], mm) ||
          (Math.abs(u) > 1e-6 && lrHit(reb, pt, [elbX(u), pt[1] + u], mm))),
    );

  const bad = (u: number, L: number): boolean => {
    const z = zone(u, L);
    return (
      hitGeo(z) ||
      hitLbl(z) ||
      chnHitBox(E, z) ||
      strips(u, L).some((r) => hitStrip(E, r) || chnHitLead(E, r) || (dotsC !== null && dotHit(r))) ||
      !outOK(u, L) ||
      lrBad(u, L) ||
      Boolean(rebTxt && rebTxt.some(([a, b]) => segBox(a[0], a[1], b[0], b[1], z)))
    );
  };

  const dir = up >= 0 ? 1 : -1;
  const u0 = Math.abs(up) > 1e-9 ? up : o.straight ? 0 : mm(5.8);
  const us = [u0];
  const ds = o.reb ? mm(1.1) : mm(3.4);
  const nk = o.reb ? 3 : 1;
  if (!o.straight) {
    if (o.oneWay) for (let k = 1; k <= 8 * nk; k++) us.push(u0 + dir * ds * k);
    else for (let k = 1; k <= 6 * nk; k++) us.push(u0 + dir * ds * k, u0 - dir * ds * k);
  }

  let pick: [number, number] | null = null;
  const Lb = (u: number): number => L0 + (DG ? Math.abs(u) * DG : 0);
  for (const u of us) {
    if (!o.straight && Math.abs(u) < mm(2)) continue;
    for (let k = 0; k <= 14 && !pick; k++) {
      if (!bad(u, Lb(u) + k * mm(2))) pick = [u, Lb(u) + k * mm(2)];
    }
    if (pick) break;
  }
  if (o.dry) return !!pick;

  const [u, L] = pick || [u0, Lb(u0)];
  const y = pt[1] + u;
  const M = pt[0] + sg * L;
  const vert = Math.abs(u) > 1e-6;
  const ex = elbX(u);
  const dxv = vert ? ex - pt[0] : sg * L;
  const dyv = vert ? u : 0;
  const lenv = Math.hypot(dxv, dyv) || 1;
  const st = o.chain
    ? pt
    : leadEnd(E, pt, dxv / lenv, dyv / lenv, ctx, { kind: o.kind, maxLen: 0.6 * lenv });
  E.poly(vert ? [st, [ex, y], [M, y]] : [st, [M, y]], 'LEAD');
  E.text(M - sg * mm(ring ? 0.32 : 0.43), y + mm(0.99), text, TH, 'LBL', {
    al: sg < 0 ? 'l' : 'r',
  });
  if (ring) E.circ(M + sg * Rr, y, Rr, 'LEAD');
  E.text(M + sg * Rr, y, mark, TH, 'LBL', { al: 'c', va: 'm' });
  E.lbl.push(zone(u, L));
  strips(u, L).forEach((q) => E.lbl.push(q));
  return { ok: !!pick };
}

export function cbl(
  E: Ents,
  pt: Point2D,
  dx: number,
  dy: number,
  lines: string | string[],
  mark: string | number,
  ctx: CadContext,
  o: CalloutOpts = {},
): boolean | { ok: boolean } | { cx: number; cy: number; ok: boolean } {
  if (!ctx.tplA) return callout(E, pt, dx, dy, lines, mark, ctx, o);
  const ls = ([] as string[]).concat(lines).filter(Boolean);
  const text = ls.length > 1 && /^a=/.test(ls[1]) ? ls[0] + ',' + ls[1] : ls.join(' ');
  const up = o.outY ? Math.sign(o.outY) * Math.max(Math.abs(dy), ctx.mm(5.8)) : dy;
  return calloutAH(E, pt, dx < 0 ? -1 : 1, up, text, String(mark), ctx, {
    outside: !!o.outside,
    minL: o.outside ? 0 : Math.abs(dx),
    ring: true,
    kind: o.kind,
    chain: o.chain,
    straight: o.fixY && Math.abs(dy) < 1e-9,
    oneWay: !!o.outY,
    reb: o.reb,
    diag: o.diag,
  });
}

export interface ChainNoteSpec {
  axis: 'h' | 'v';
  pos: number;
  list: number[];
  side: number;
  kind?: string;
  dx?: number;
  lines: string | string[];
  mark: string | number;
  opt?: CalloutOpts;
}

export function chainNote(E: Ents, c: ChainNoteSpec, ctx: CadContext): void {
  const { mm } = ctx;
  const env = E.env!;
  const hz = c.axis === 'h';
  const sg = c.side < 0 ? -1 : 1;
  const isDot = c.kind === 'dot';
  const L = [...new Set(c.list.map((v) => +v.toFixed(4)))].sort((a, b) =>
    sg < 0 ? a - b : b - a,
  );
  if (!L.length) return;
  const P = (v: number): Point2D => (hz ? [v, c.pos] : [c.pos, v]);
  const ux = hz ? sg : 0;
  const uy = hz ? 0 : sg;
  let g0 = 1e18;
  for (let i = 1; i < L.length; i++) g0 = Math.min(g0, Math.abs(L[i] - L[i - 1]));
  const al = L.length > 1 ? clamp(0.55 * g0, mm(0.55), mm(1.8)) : mm(1.8);
  let st = P(L[0]);
  if (isDot) {
    const d0 = dotAt(E, P(L[0]), mm(1.3));
    const Rr = Math.max(mm(0.56), (d0 ? d0.r : mm(0.38)) + mm(0.24));
    L.forEach((v, i) => {
      const q = P(v);
      const dt = dotAt(E, q, mm(1.3));
      const cc: Point2D = dt ? [dt.x, dt.y] : q;
      E.circ(cc[0], cc[1], Rr, 'LEAD');
      if (i) {
        const w = L[i - 1];
        const a = Math.abs(v - w);
        if (a > 2 * Rr + 1e-6) {
          const s = Math.sign(v - w);
          const A = P(w + s * Rr);
          const B = P(v - s * Rr);
          E.line(A[0], A[1], B[0], B[1], 'LEAD');
        }
      }
    });
    const c0: Point2D = d0 ? [d0.x, d0.y] : st;
    st = [c0[0] + ux * Rr, c0[1] + uy * Rr];
  } else {
    const a = P(L[0]);
    const b = P(L[L.length - 1]);
    E.line(a[0], a[1], b[0], b[1], 'LEAD');
    L.forEach((v) => {
      const q = P(v);
      E.arrow(q[0], q[1], ux, uy, al, al * 0.4, 'LEAD');
    });
  }
  const o: CalloutOpts = { chain: true, kind: c.kind, ...(c.opt || {}) };
  if (hz) {
    cbl(
      E,
      st,
      sg * (Math.abs(st[0] - (sg < 0 ? env.x0 : env.x1)) + mm(7)),
      0,
      c.lines,
      c.mark,
      ctx,
      Object.assign(o, { fixY: true, outside: true, bub: true }),
    );
  } else {
    cbl(
      E,
      st,
      c.dx !== undefined ? c.dx : -mm(14),
      (sg < 0 ? env.y0 : env.y1) - st[1] + sg * mm(7),
      c.lines,
      c.mark,
      ctx,
      Object.assign(o, { outY: sg, bub: true }),
    );
  }
  {
    const a = P(L[0]);
    const b = P(L[L.length - 1]);
    const t = mm(0.35);
    (E.chn = E.chn || []).push(
      hz
        ? mkBox(Math.min(a[0], b[0]), c.pos - t, Math.max(a[0], b[0]), c.pos + t, { o: 'h' })
        : mkBox(c.pos - t, Math.min(a[1], b[1]), c.pos + t, Math.max(a[1], b[1]), { o: 'v' }),
    );
  }
}

export const bigGap = (arr: readonly number[], lo: number, hi: number): number => {
  const a = [lo, ...arr.filter((v) => v > lo && v < hi).sort((u, v) => u - v), hi];
  let b = -1;
  let m = (lo + hi) / 2;
  for (let i = 1; i < a.length; i++) {
    if (a[i] - a[i - 1] > b) {
      b = a[i] - a[i - 1];
      m = (a[i] + a[i - 1]) / 2;
    }
  }
  return m;
};

export const freeGap = (
  arr: readonly number[],
  i: number,
  away: readonly number[],
  minD: number,
): number => {
  const a = arr.slice().sort((u, v) => u - v);
  if (a.length < 2) return a[0];
  const cand: number[] = [];
  for (let k = 0; k < a.length - 1; k++) cand.push((a[k] + a[k + 1]) / 2);
  const ok = cand.filter((m) => !(away || []).some((q) => Math.abs(q - m) < minD));
  const pool = ok.length ? ok : cand;
  const pref = cand[Math.max(0, Math.min(cand.length - 1, i))];
  return pool.reduce((b, m) => (Math.abs(m - pref) < Math.abs(b - pref) ? m : b), pool[0]);
};

export const midGap = (arr: readonly number[], i: number): number => {
  const a = arr.slice().sort((u, v) => u - v);
  const k = Math.max(0, Math.min(a.length - 2, i));
  return a.length > 1 ? (a[k] + a[k + 1]) / 2 : a[0];
};

export interface FanLabelSpec {
  pt: Point2D;
  lines: string | string[];
  mark: string | number;
}

export interface FanLabelsOpts {
  yMin?: number;
  xMax?: number;
  xBeyond?: number;
}

export function fanLabels(
  E: Ents,
  specs: FanLabelSpec[],
  ctx: CadContext,
  o: FanLabelsOpts = {},
): void {
  const { mm } = ctx;
  const TH = mm(2);
  const WF = 0.7;
  const gT = mm(1.5);
  const pitch = mm(6.4);
  const geo = E.a.filter((e) => e.ly === 'OUT' || e.ly === 'THIN' || e.ly === 'HID');

  const it = specs
    .map((s) => {
      const ls = ([] as string[]).concat(s.lines).filter(Boolean);
      const mark = String(s.mark);
      const R = mm(mark.length > 1 ? 2.4 : 1.92);
      const tw = Math.max(0, ...ls.map((l) => textW(l, TH))) * WF + mm(0.4);
      return { pt: s.pt, ls, mark, R, tw };
    })
    .sort((u, v) => u.pt[1] - v.pt[1]);
  if (!it.length) return;

  const twM = Math.max(...it.map((s) => s.tw));
  const xd = Math.max(...it.map((s) => s.pt[0]));
  const yLo = o.yMin !== undefined ? o.yMin + mm(3.4) : -1e18;

  const hitGeo = (bx: CadBoxMeta): boolean =>
    geo.some((e) =>
      e.k === 'L'
        ? segBox(e.x1, e.y1, e.x2, e.y2, bx)
        : e.k === 'P' &&
          (e.pts.some(
            (q, i) => i > 0 && segBox(e.pts[i - 1][0], e.pts[i - 1][1], q[0], q[1], bx),
          ) ||
            (e.closed &&
              segBox(
                e.pts[e.pts.length - 1][0],
                e.pts[e.pts.length - 1][1],
                e.pts[0][0],
                e.pts[0][1],
                bx,
              ))),
    );
  const hitLbl = (bx: CadBoxMeta): boolean =>
    E.lbl
      .concat(E.dz || [])
      .some((q) => bx.x0 < q.x1 && bx.x1 > q.x0 && bx.y0 < q.y1 && bx.y1 > q.y0) ||
    chnHitBox(E, bx);

  const lay = (xs: number, y0: number) =>
    it.map((s, k) => {
      const cy = y0 + k * pitch;
      const ex = xs + twM + 2 * gT;
      const cx = ex + s.R;
      return {
        s,
        cy,
        ex,
        cx,
        box: mkBox(xs, cy - mm(2.7), cx + s.R, cy + mm(2.9)),
      };
    });

  const strips = (xs: number, L: ReturnType<typeof lay>): CadBoxMeta[] => {
    const r: CadBoxMeta[] = [];
    L.forEach((q) => {
      const ax = q.s.pt[0];
      const ay = q.s.pt[1];
      const n = Math.max(4, Math.ceil(Math.hypot(xs - ax, q.cy - ay) / mm(0.8)));
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        const x = ax + (xs - ax) * t;
        const y = ay + (q.cy - ay) * t;
        r.push(mkBox(x - mm(0.3), y - mm(0.3), x + mm(0.3), y + mm(0.3)));
      }
      r.push(mkBox(xs, q.cy - mm(0.3), q.ex, q.cy + mm(0.3)));
    });
    return r;
  };

  const bad = (xs: number, y0: number): boolean => {
    const L = lay(xs, y0);
    return L.some((q) => hitGeo(q.box) || hitLbl(q.box)) || strips(xs, L).some((r) => hitLbl(r));
  };

  let xs = xd + mm(12);
  let y0 = Math.max(it[0].pt[1] + mm(3.6), yLo);
  let ok = false;
  const base = y0;
  const Ws = twM + 2 * gT + 2 * Math.max(...it.map((s) => s.R));
  const xMax = o.xMax !== undefined ? o.xMax : 1e18;

  for (let dy = 0; dy <= 30 && !ok; dy++) {
    for (const D of [12, 10, 8.5, 7]) {
      const x = xd + mm(D);
      if (x + Ws <= xMax && !bad(x, base + dy * mm(1))) {
        xs = x;
        y0 = base + dy * mm(1);
        ok = true;
        break;
      }
    }
  }
  for (let dy = 0; dy <= 30 && !ok; dy++) {
    for (let k = 0; k <= 14 && !ok; k++) {
      const x = Math.max(xd + mm(12), o.xBeyond !== undefined ? o.xBeyond : 0) + k * mm(2);
      if (!bad(x, base + dy * mm(1))) {
        xs = x;
        y0 = base + dy * mm(1);
        ok = true;
      }
    }
  }

  const L = lay(xs, y0);
  L.forEach((q) => {
    const ux = xs - q.s.pt[0];
    const uy = q.cy - q.s.pt[1];
    const ul = Math.hypot(ux, uy) || 1;
    const st = leadEnd(E, q.s.pt, ux / ul, uy / ul, ctx, { kind: 'dot' });
    E.line(st[0], st[1], xs, q.cy, 'LEAD');
    E.line(xs, q.cy, q.cx - q.s.R, q.cy, 'LEAD');
    E.circ(q.cx, q.cy, q.s.R, 'LEAD');
    E.text(q.cx, q.cy - mm(1.11), q.s.mark, mm(2.5), 'LBL', { al: 'c' });
    const mx = q.ex - gT - q.s.tw / 2;
    if (q.s.ls[0]) E.text(mx, q.cy + mm(0.67), q.s.ls[0], TH, 'LBL', { al: 'c', wf: WF });
    if (q.s.ls[1]) E.text(mx, q.cy - mm(2.47), q.s.ls[1], TH, 'LBL', { al: 'c', wf: WF });
    E.lbl.push(q.box);
  });
  strips(xs, L).forEach((r) => E.lbl.push(r));
}

export function noteCad(
  E: Ents,
  pt: Point2D,
  dx: number,
  dy: number,
  text: string,
  ctx: CadContext,
  _o: Record<string, unknown> = {},
): void {
  const { mm } = ctx;
  const sg = dx >= 0 ? 1 : -1;
  const ex = pt[0] + dx;
  const ey = pt[1] + dy;
  const TH = mm(2);
  const Lu = textW(text, TH) + mm(1.2);
  E.line(pt[0], pt[1], ex, ey, 'LEAD');
  E.line(ex, ey, ex + sg * Lu, ey, 'LEAD');
  E.text(sg > 0 ? ex + mm(0.5) : ex - mm(0.5), ey + mm(0.6), text, TH, 'NOTE', {
    al: sg > 0 ? 'l' : 'r',
  });
  const x0 = Math.min(ex, ex + sg * Lu);
  const x1 = Math.max(ex, ex + sg * Lu);
  E.lbl.push(mkBox(x0, ey - mm(0.3), x1, ey + mm(3)));
}

export function plainNote(
  E: Ents,
  pt: Point2D,
  dx: number,
  dy: number,
  text: string,
  ctx: CadContext,
): void {
  const { mm } = ctx;
  const sg = dx >= 0 ? 1 : -1;
  const ex = pt[0] + dx;
  const ey = pt[1] + dy;
  E.line(pt[0], pt[1], ex, ey, 'LEAD');
  E.line(ex, ey, ex + sg * mm(2), ey, 'LEAD');
  E.text(ex + sg * mm(2.8), ey - mm(1.2), text, mm(2), 'NOTE', { al: sg > 0 ? 'l' : 'r' });
}

export const barLines = (
  b: { n?: number; d: number; a?: number },
  p: Project,
): string[] =>
  b.n ? [`${b.n}${p.labelUnit}${b.d}`] : [`${p.labelUnit}${b.d}`, b.a ? `a=${fmt(b.a * 10)}` : ''];

export const barLabel = (
  b: { n?: number; d: number; a?: number },
  p: Project,
): string => barLines(b, p).filter(Boolean).join(' ');

export function wBar(d: number, _ctx: CadContext): number {
  return d / 10;
}

export const dotR = (d: number, ctx: CadContext): number => {
  const r = Math.max(d / 20, ctx.mm(ctx.rDot || 0.38));
  return ctx.rCap ? Math.min(r, Math.max(d / 20, ctx.rCap)) : r;
};

export function dot(E: Ents, x: number, y: number, d: number, ctx: CadContext): void {
  E.circ(x, y, dotR(d, ctx), ctx.dotLy || 'RDOT', { fill: true, rMin: d / 20 });
}

export function dotT(
  E: Ents,
  x: number,
  y: number,
  d: number,
  ctx: CadContext,
  ux: number,
  uy: number,
): void {
  const k = ctx.tang ? Math.max(0, dotR(d, ctx) - d / 20) : 0;
  dot(E, x + k * ux, y + k * uy, d, ctx);
}

export function bar(
  E: Ents,
  pts: readonly Point2D[],
  d: number,
  ctx: CadContext,
  o: { closed?: boolean } = {},
): void {
  E.poly(pts, 'REB', { w: wBar(d, ctx), closed: !!o.closed });
}

// ---------------------------------------------------------------------------
// Template C Radial Callout Solver (`CM_SHIFTS`, `snapTo`, `calloutMPlan`, `calloutM`)
// ---------------------------------------------------------------------------

export function snapTo(geo: TemplateCGeoEntry, q: Point2D): Point2D {
  let best: Point2D = q;
  let bd = 1e18;
  (geo.dots || []).forEach((o) => {
    const d = Math.hypot(o[0] - q[0], o[1] - q[1]);
    if (d < bd) {
      bd = d;
      best = o;
    }
  });
  (geo.lines || []).forEach((l) => {
    for (let i = 1; i < l.length; i++) {
      const a = l[i - 1];
      const b = l[i];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const L2 = dx * dx + dy * dy || 1e-9;
      const s = clamp(((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / L2, 0, 1);
      const o: Point2D = [a[0] + dx * s, a[1] + dy * s];
      const d = Math.hypot(o[0] - q[0], o[1] - q[1]);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
  });
  return best;
}

export const CM_SHIFTS: Array<[number, number]> = (() => {
  const r: Array<[number, number]> = [];
  [0, 1.2, -1.2, 2.4, -2.4, 3.6, -3.6, 4.8, -4.8, 6.4, -6.4, 8.4, -8.4, 11, -11].forEach((sy) =>
    [0, -3, 3, -6, 6, -9, 9, -13, 13, -18].forEach((sx) => r.push([sx, sy])),
  );
  return r.sort((u, v) => Math.hypot(u[0] * 0.7, u[1]) - Math.hypot(v[0] * 0.7, v[1]));
})();

export interface CalloutMSpec {
  mark: string | number;
  bub: 'L' | 'R';
  tg: Point2D[];
  kind?: string;
  el: Point2D | null;
  end: Point2D;
  via?: Point2D[];
  lines: string | string[];
}

export interface CalloutMPlanResult {
  legs: Array<[Point2D, Point2D]>;
  draw: () => void;
  boxes: CadBoxMeta[];
}

export function calloutMPlan(
  E: Ents,
  sp: CalloutMSpec,
  ctx: CadContext,
  obst: Array<[Point2D, Point2D]> | undefined,
  sh: Point2D,
): CalloutMPlanResult | null {
  if (!sp.el && sh[0]) return null;
  const { mm } = ctx;
  const { tg, via = [], bub } = sp;
  const mark = String(sp.mark);
  const lines = ([] as string[]).concat(sp.lines).filter(Boolean);
  const R = mark.length > 1 ? mm(2.41) : mm(1.94);
  const TH = mm(2);
  const w = Math.max(0, ...lines.map((s) => textW(s, TH))) + mm(0.4);
  const dir = bub === 'R' ? 1 : -1;
  const base0 =
    sp.el || tg.reduce((a, q) => (dir > 0 ? (q[0] < a[0] ? q : a) : q[0] > a[0] ? q : a), tg[0]);
  let el: Point2D | null = sp.el ? [sp.el[0] + sh[0], sp.el[1] + sh[1]] : null;
  if (!el && sh[1]) {
    el = [
      (dir > 0 ? Math.max(...tg.map((q) => q[0])) : Math.min(...tg.map((q) => q[0]))) +
        dir * mm(2.4),
      base0[1] + sh[1],
    ];
  }
  const base = el || base0;
  const last = via.length
    ? via[via.length - 1]
    : el || tg.reduce((a, q) => (dir > 0 ? (q[0] > a[0] ? q : a) : q[0] < a[0] ? q : a), tg[0]);
  let ex = sp.end[0] + (sp.el ? sh[0] : 0);
  let ey = sp.end[1] + (sp.el ? sh[1] : 0);
  const run = mm(7.8);
  if (dir * (ex - last[0]) < run) ex = last[0] + dir * run;
  if (!el && !via.length) ey = base[1];
  if (el && dir > 0) {
    const xT0 = ex - mm(1.9) - w;
    if (xT0 < el[0] + mm(1)) ex += el[0] + mm(1) - xT0;
  }
  let tx = ex;
  const xTof = (t: number): number => (dir > 0 ? t - mm(1.9) - w : t + mm(1.2));
  const ringX0 = (e: number): number => (dir > 0 ? e : e - 2 * R);

  if (obst && obst.length) {
    const gap = mm(0.9);
    const yl = ey - mm(3.3);
    const yh = ey + mm(3.1);
    const bands: Array<[number, number]> = [];
    for (const [a, b] of obst) {
      if (Math.abs(a[1] - b[1]) < 1e-9) continue;
      const t0 = (yl - a[1]) / (b[1] - a[1]);
      const t1 = (yh - a[1]) / (b[1] - a[1]);
      const lo = Math.max(0, Math.min(t0, t1));
      const hi = Math.min(1, Math.max(t0, t1));
      if (lo > hi) continue;
      const xa = a[0] + (b[0] - a[0]) * lo;
      const xb = a[0] + (b[0] - a[0]) * hi;
      bands.push([Math.min(xa, xb), Math.max(xa, xb)]);
    }
    const need = (z0: number, z1: number): number => {
      let d = 0;
      for (const [x0, x1] of bands) {
        if (x1 < z0 - gap || x0 > z1 + gap) continue;
        d = Math.max(d, dir > 0 ? x1 + gap - z0 : z1 + gap - x0);
      }
      return d;
    };
    for (let it = 0; it < 8; it++) {
      const xT = xTof(tx);
      const dT = need(xT, xT + w);
      if (dT > 1e-6) {
        tx += dir * dT;
        ex += dir * dT;
        continue;
      }
      const r0 = ringX0(ex);
      const dR = need(r0, r0 + 2 * R);
      if (dR > 1e-6) {
        ex += dir * dR;
        continue;
      }
      break;
    }
  }

  {
    const gap = mm(0.8);
    const yl = ey - mm(3.3);
    const yh = ey + mm(3.1);
    for (let it = 0; it < 8; it++) {
      const xT = xTof(tx);
      const r0 = ringX0(ex);
      const hx0 = Math.min(xT, r0);
      const hx1 = Math.max(xT + w, r0 + 2 * R);
      let d = 0;
      for (const L of E.lbl) {
        if (L.y1 < yl || L.y0 > yh || L.x1 < hx0 - gap || L.x0 > hx1 + gap) continue;
        d = Math.max(d, dir > 0 ? L.x1 + gap - hx0 : hx1 - (L.x0 - gap));
      }
      if (d <= 1e-6) break;
      tx += dir * d;
      ex += dir * d;
    }
  }

  let xTf = xTof(tx);
  if (el && dir > 0) xTf = Math.max(xTf, el[0] + mm(1));
  const pl: Point2D[] = [base, ...via, [ex, ey]];
  const legs: Array<[Point2D, Point2D]> = [];
  if (el) {
    tg.forEach((q) => {
      if (Math.hypot(q[0] - el![0], q[1] - el![1]) > 1e-6) legs.push([q, el!]);
    });
  }
  for (let i = 1; i < pl.length; i++) legs.push([pl[i - 1], pl[i]]);
  const kind = sp.kind || 'line';

  const boxes: CadBoxMeta[] = [
    mkBox(xTf, ey - mm(3.4), xTf + w, ey + mm(3.3)),
    mkBox(ringX0(ex), ey - R, ringX0(ex) + 2 * R, ey + R),
  ];

  const draw = (): void => {
    const nT = legs.length - (pl.length - 1);
    const unit = (a: Point2D, b: Point2D): [number, number, number] => {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      return [(b[0] - a[0]) / L, (b[1] - a[1]) / L, L];
    };
    legs.forEach(([a, b], i) => {
      if (i >= nT) return;
      const [ux, uy, L] = unit(a, b);
      const st = leadEnd(E, a, ux, uy, ctx, { kind, maxLen: 0.5 * L });
      E.line(st[0], st[1], b[0], b[1], 'LEAD');
    });
    const P = pl.slice();
    if (!el) {
      const [ux, uy, L] = unit(P[0], P[1]);
      const ins = tg.slice().sort((u, v) => ux * (u[0] - v[0]) + uy * (u[1] - v[1]));
      let gmin = L;
      for (let i = 1; i < ins.length; i++) {
        gmin = Math.min(
          gmin,
          Math.hypot(ins[i][0] - ins[i - 1][0], ins[i][1] - ins[i - 1][1]) || gmin,
        );
      }
      ins.forEach((q, i) => {
        const st = leadEnd(E, q, ux, uy, ctx, {
          kind,
          maxLen: Math.max(mm(0.55), 0.55 * (ins.length > 1 ? gmin : L)),
        });
        if (i === 0) P[0] = st;
      });
    }
    E.poly(P, 'LEAD');
    E.circ(ex + dir * R, ey, R, 'LEAD');
    E.text(ex + dir * R, ey - 0.36 * mm(2.4), mark, mm(2.4), 'LBL', { al: 'c' });
    const xT = xTf;
    if (lines[0]) E.text(xT, ey + mm(0.94), lines[0], TH, 'LBL');
    if (lines[1]) E.text(xT, ey - mm(2.64), lines[1], TH, 'LBL');
    const xs = [ex + dir * 2 * R, xT, xT + w, ...(el ? [el[0]] : []), base[0]];
    E.lbl.push(mkBox(Math.min(...xs), ey - mm(3.6), Math.max(...xs), ey + mm(3.2)));
    (E.lgsSegs = E.lgsSegs || []).push(...legs);
    (E.tbx = E.tbx || []).push(...boxes);
  };

  return { legs, draw, boxes };
}

export function calloutM(
  E: Ents,
  sp: CalloutMSpec,
  ctx: CadContext,
  obst?: Array<[Point2D, Point2D]>,
): void {
  const reb = lrSegs(E);
  let first: CalloutMPlanResult | null = null;
  let fb: CalloutMPlanResult | null = null;
  const clash = (pl: CalloutMPlanResult): boolean =>
    (E.lgsSegs || [])
      .concat(obst || [])
      .some((s) => pl.boxes.some((bx) => segBox(s[0][0], s[0][1], s[1][0], s[1][1], bx))) ||
    (E.tbx || []).some((bx) => pl.legs.some(([a, b]) => segBox(a[0], a[1], b[0], b[1], bx)));
  const hit = (pl: CalloutMPlanResult): boolean =>
    pl.legs.some(([a, b]) => lrHit(reb, a, b, ctx.mm));

  for (const s of CM_SHIFTS) {
    const pl = calloutMPlan(E, sp, ctx, obst, [ctx.mm(s[0]), ctx.mm(s[1])]);
    if (!pl) continue;
    first = first || pl;
    if (!fb) {
      if (hit(pl)) continue;
      fb = pl;
      if (!clash(pl)) {
        pl.draw();
        return;
      }
      continue;
    }
    if (clash(pl) || hit(pl)) continue;
    pl.draw();
    return;
  }
  (fb || first)?.draw();
}
