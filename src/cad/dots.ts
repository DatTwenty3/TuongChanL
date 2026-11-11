import type { CadCircleEntity, CadContext, CadLayerId, Point2D } from '../types/project';
import type { Ents } from './ents';

export interface SettleDotsOpts {
  layers?: CadLayerId[];
  reach?: number;
}

type Seg5 = [number, number, number, number, number];

interface DotMeta {
  d: CadCircleEntity;
  nx: number;
  ny: number;
  nr: number;
  ins: boolean;
}

export function settleDots(E: Ents, _ctx: CadContext, o: SettleDotsOpts = {}): Ents {
  const rawDots = E.a.filter(
    (e): e is CadCircleEntity => e.k === 'C' && e.fill && (e.ly === 'RDOT' || e.ly === 'RDOTW'),
  );
  if (!rawDots.length) return E;

  const segs: Seg5[] = [];
  const lys: CadLayerId[] = o.layers || ['REB', 'OUT'];
  E.a.forEach((e) => {
    if (lys.indexOf(e.ly) < 0) return;
    if (e.k === 'L') segs.push([e.x1, e.y1, e.x2, e.y2, 0]);
    else if (e.k === 'P') {
      const n = e.pts.length;
      for (let i = 1; i < n; i++) {
        segs.push([e.pts[i - 1][0], e.pts[i - 1][1], e.pts[i][0], e.pts[i][1], e.w || 0]);
      }
      if (e.closed && n > 2) {
        segs.push([e.pts[n - 1][0], e.pts[n - 1][1], e.pts[0][0], e.pts[0][1], e.w || 0]);
      }
    }
  });
  if (!segs.length) return E;

  const near = (x: number, y: number, r: number): Seg5[] => {
    const out: Seg5[] = [];
    for (const s of segs) {
      if (
        Math.max(s[0], s[2]) < x - r ||
        Math.min(s[0], s[2]) > x + r ||
        Math.max(s[1], s[3]) < y - r ||
        Math.min(s[1], s[3]) > y + r
      ) {
        continue;
      }
      out.push(s);
    }
    return out;
  };

  const test = (
    d: CadCircleEntity,
    x: number,
    y: number,
    ss: Seg5[],
  ): { px: number; py: number; dist: number; dx: number; dy: number; L2: number; pen: number } | null => {
    let worst: { px: number; py: number; dist: number; dx: number; dy: number; L2: number } | null =
      null;
    let wpen = 1e-4;
    for (const s of ss) {
      const dx = s[2] - s[0];
      const dy = s[3] - s[1];
      const L2 = dx * dx + dy * dy;
      let t = L2 ? ((x - s[0]) * dx + (y - s[1]) * dy) / L2 : 0;
      t = Math.max(0, Math.min(1, t));
      const px = s[0] + t * dx;
      const py = s[1] + t * dy;
      const dist = Math.hypot(x - px, y - py);
      const pen = d.r + s[4] / 2 - dist;
      if (pen > wpen) {
        wpen = pen;
        worst = { px, py, dist, dx, dy, L2 };
      }
    }
    return worst ? { ...worst, pen: wpen } : null;
  };

  const polys: Point2D[][] =
    lys.indexOf('OUT') < 0
      ? []
      : E.a
          .filter(
            (e): e is Extract<typeof e, { k: 'P' }> =>
              e.ly === 'OUT' && e.k === 'P' && e.closed && e.pts.length >= 3,
          )
          .map((e) => e.pts);

  const inPoly = (x: number, y: number): boolean =>
    polys.some((pl) => {
      let c = false;
      for (let a = 0, b = pl.length - 1; a < pl.length; b = a++) {
        const u = pl[a];
        const v = pl[b];
        if (u[1] > y !== v[1] > y && x < ((v[0] - u[0]) * (y - u[1])) / (v[1] - u[1]) + u[0]) {
          c = !c;
        }
      }
      return c;
    });

  const meta = new Map<CadCircleEntity, DotMeta>();
  rawDots.forEach((d) => {
    meta.set(d, {
      d,
      nx: d.x,
      ny: d.y,
      nr: d.r,
      ins: polys.length > 0 && inPoly(d.x, d.y),
    });
  });

  const outside = (d: CadCircleEntity, x: number, y: number): boolean =>
    !!meta.get(d)!.ins && !inPoly(x, y);

  const others = rawDots;

  for (let pass = 0; pass < 2; pass++) {
    for (const d of rawDots) {
      const dm = meta.get(d)!;
      const ss = near(d.x, d.y, d.r + 6 + (o.reach || 0));
      for (let it = 0; it < 40; it++) {
        let moved = false;
        for (const s of ss) {
          const w = test(d, d.x, d.y, [s]);
          if (!w) continue;
          let ux: number;
          let uy: number;
          if (w.dist > 1e-6) {
            ux = (d.x - w.px) / w.dist;
            uy = (d.y - w.py) / w.dist;
          } else {
            const L = Math.sqrt(w.L2) || 1;
            const nx = -w.dy / L;
            const ny = w.dx / L;
            const cand: [Point2D, Point2D] = [
              [nx, ny],
              [-nx, -ny],
            ];
            const sc = ([vx, vy]: Point2D): number => {
              const x = d.x + vx * w.pen;
              const y = d.y + vy * w.pen;
              let m = outside(d, x, y) ? -1e6 : 1e9;
              for (const q of others) {
                if (q !== d) {
                  const dd = Math.hypot(q.x - x, q.y - y);
                  if (dd < m) m = dd;
                }
              }
              return m;
            };
            [ux, uy] = sc(cand[0]) >= sc(cand[1]) ? cand[0] : cand[1];
          }
          d.x += ux * w.pen;
          d.y += uy * w.pen;
          moved = true;
        }
        if (!moved) break;
      }
      if (outside(d, d.x, d.y)) {
        d.x = dm.nx;
        d.y = dm.ny;
      }
      if (
        test(d, d.x, d.y, ss) ||
        others.some((q) => q !== d && Math.hypot(q.x - d.x, q.y - d.y) < q.r + d.r - 0.03)
      ) {
        const x0 = d.x;
        const y0 = d.y;
        const ok = (x: number, y: number): boolean =>
          !outside(d, x, y) &&
          !test(d, x, y, ss) &&
          others.every((q) => q === d || Math.hypot(q.x - x, q.y - y) >= q.r + d.r - 0.03);

        let f: Point2D | null = null;
        let sup: { px: number; py: number; dx: number; dy: number; L: number; dist: number } | null =
          null;
        let sb = 1e9;
        for (const sg of ss) {
          const dx = sg[2] - sg[0];
          const dy = sg[3] - sg[1];
          const L2 = dx * dx + dy * dy;
          let t = L2 ? ((x0 - sg[0]) * dx + (y0 - sg[1]) * dy) / L2 : 0;
          t = Math.max(0, Math.min(1, t));
          const px = sg[0] + t * dx;
          const py = sg[1] + t * dy;
          const dist = Math.hypot(x0 - px, y0 - py);
          const e = Math.abs(dist - (d.r + sg[4] / 2));
          if (e < sb && e < 3 && L2 > 0) {
            sb = e;
            sup = { px, py, dx, dy, L: Math.sqrt(L2), dist };
          }
        }
        if (sup) {
          const tx = sup.dx / sup.L;
          const ty = sup.dy / sup.L;
          const nxs = sup.dist > 1e-6 ? (x0 - sup.px) / sup.dist : -ty;
          const nys = sup.dist > 1e-6 ? (y0 - sup.py) / sup.dist : tx;
          const off = sup.dist;
          for (let sl = 0.5; sl <= 6 * d.r && !f; sl += 0.5) {
            for (const sg of [1, -1]) {
              const x = sup.px + sg * sl * tx + nxs * off;
              const y = sup.py + sg * sl * ty + nys * off;
              if (ok(x, y)) {
                f = [x, y];
                break;
              }
            }
          }
        }
        for (let r = 0.25; r <= 5 * d.r && !f; r += 0.25) {
          for (let a = 0; a < 360 && !f; a += 7.5) {
            const x = x0 + r * Math.cos((a * Math.PI) / 180);
            const y = y0 + r * Math.sin((a * Math.PI) / 180);
            if (ok(x, y)) f = [x, y];
          }
        }
        if (f) {
          d.x = f[0];
          d.y = f[1];
        }
      }
    }
  }

  const bad = (d: CadCircleEntity, x: number, y: number, ss: Seg5[], oth?: CadCircleEntity[]): number => {
    const w = test(d, x, y, ss);
    let m = w ? w.pen : 0;
    for (const q of oth || others) {
      if (q !== d) {
        const ov = q.r + d.r - Math.hypot(q.x - x, q.y - y);
        if (ov > m) m = ov;
      }
    }
    return outside(d, x, y) ? Math.max(m, 100) : m;
  };

  const offs: Array<[number, number, number]> = [];
  {
    const st = 0.25;
    const R = 16;
    for (let i = -R / st; i <= R / st; i++) {
      for (let j = -R / st; j <= R / st; j++) {
        const dx = i * st;
        const dy = j * st;
        const rr = Math.hypot(dx, dy);
        if (rr <= R) offs.push([dx, dy, rr]);
      }
    }
    offs.sort((u, v) => u[2] - v[2]);
  }

  for (let it = 0; it < 2; it++) {
    for (const d of rawDots) {
      if (bad(d, d.x, d.y, near(d.x, d.y, d.r + 6 + (o.reach || 0))) <= 0.03) continue;
      const dm = meta.get(d)!;
      const reach = 2.7 * dm.nr;
      const ssN = near(dm.nx, dm.ny, reach + dm.nr + 6 + (o.reach || 0));
      const rMin = Math.max(d.rMin || 0, 0.6 * dm.nr);
      const rs: number[] = [];
      const nb = others.filter(
        (q) =>
          q !== d &&
          Math.hypot(q.x - dm.nx, q.y - dm.ny) <= reach + q.r + Math.max(dm.nr, d.rMin || 0) + 1e-6,
      );
      for (let k = 1; k > 0.55; k -= 0.1) {
        const v = Math.max(rMin, dm.nr * k);
        if (!rs.some((u) => Math.abs(u - v) < 1e-6)) rs.push(v);
      }
      let f: Point2D | null = null;
      for (const r1 of rs) {
        d.r = r1;
        for (const [dx, dy, rr] of offs) {
          if (rr > reach) break;
          const x = dm.nx + dx;
          const y = dm.ny + dy;
          if (bad(d, x, y, ssN, nb) <= 0.03) {
            f = [x, y];
            break;
          }
        }
        if (f) break;
      }
      if (!f) {
        d.r = Math.max(rMin, 0.7 * dm.nr);
        let bc = 1e18;
        for (const [dx, dy, rr] of offs) {
          if (rr > reach) break;
          const x = dm.nx + dx;
          const y = dm.ny + dy;
          const c = bad(d, x, y, ssN, nb) + 0.02 * rr;
          if (c < bc) {
            bc = c;
            f = [x, y];
          }
        }
      }
      if (f) {
        d.x = f[0];
        d.y = f[1];
      }
    }
  }
  return E;
}
