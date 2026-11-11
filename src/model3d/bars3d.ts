import { m3Ground } from './ground3d';
import {
  dLayers,
  type EngineBarsResult,
  type EngineProject,
  isC,
  isD,
  keyLayoutC,
  pileGrid,
  pileOn,
} from '../engine';
import {
  beamDots,
  blindT,
  ckey,
  hkB,
  type BarSpecRuntime,
  type BeamDotSpec,
  type TemplateCGModel,
} from '../cad/layers';
import type {
  AnchorGrid,
  BarDiagLine,
  BarDotCoord,
  BarSpec,
  BarsResult,
  M3BarGroup,
  Model3DData,
  Point2D,
  Point3D,
  Project,
} from '../types/project';
import { m3Concrete } from './mesh';
import { m3PileGroups, m3PileMesh } from './piles3d';

type PtLike = Point2D | number[] | BarDotCoord;

const ptXY = (q: PtLike): [number, number] =>
  Array.isArray(q) ? [q[0], q[1]] : [q.x, q.y];

const evalNumOrFn = (
  v: ((y: number) => number) | number | undefined,
  y: number,
  fallback = 0,
): number => (typeof v === 'function' ? v(y) : v !== undefined ? v : fallback);

const isAnchorGrid = (a: AnchorGrid | Point2D | undefined): a is AnchorGrid =>
  !!a && !Array.isArray(a) && Array.isArray((a as AnchorGrid).xs);

export function m3Bars(
  pIn: Project | EngineProject,
  resIn: BarsResult | EngineBarsResult,
): M3BarGroup[] {
  const p = pIn as Project;
  const res = resIn as BarsResult;
  const g = res.g;
  const c = p.cover;
  const Lu = p.Lu;
  const groups: M3BarGroup[] = [];
  const by = (k: string): BarSpec | undefined => res.bars.find((b) => b.key === k);
  const sz = (x: number, y: number, z0 = c, z1 = Lu - c): Point3D[] => [
    [x, y, z0],
    [x, y, z1],
  ];
  const push = (o: M3BarGroup): void => {
    o.id = 'g' + groups.length;
    if (o.bars.length) groups.push(o);
  };

  if (isC(p)) return m3BarsC(p, res, push, groups);
  if (isD(p)) return m3BarsD(p, res, push, groups);

  const R2 = by('r2')?.d ?? p.rb.r2?.d ?? 12;
  const hy = g.hyp;

  res.bars.forEach((b) => {
    const br = b as unknown as BarSpecRuntime;
    const d = b.d;
    const out: Point3D[][] = [];

    if (/^r1[b-f]?$/.test(b.key)) {
      const nb = br.n || 1;
      g.ribs.forEach((r) => {
        const t = r.x1 - r.x0;
        for (let i = 0; i < nb; i++) {
          const z =
            r.x0 +
            c +
            R2 / 10 +
            d / 20 +
            (nb > 1
              ? (i * (t - 2 * c - (2 * R2) / 10 - d / 10)) / (nb - 1)
              : (t - 2 * c) / 2 - R2 / 10 - d / 20);
          out.push(b.path.map((q): Point3D => [q[0], q[1], z]));
        }
      });
    } else {
      switch (b.key) {
        case 's1':
        case 's2':
        case 'b1':
        case 'b2':
        case 'k1':
          (b.pos || []).forEach((z) =>
            out.push(b.path.map((q): Point3D => [q[0], q[1], z])),
          );
          break;
        case 'an': {
          if (isAnchorGrid(b.A)) {
            const A = b.A;
            A.xs.forEach((x) =>
              A.zs.forEach((z) =>
                out.push([
                  [x, -A.Lb, z],
                  [x, A.Lc, z],
                ]),
              ),
            );
          }
          break;
        }
        case 'f1':
          (b.pos || []).forEach((z) => {
            out.push(b.path.map((q): Point3D => [q[0], q[1], z]));
            out.push(b.path.map((q): Point3D => [g.B - q[0], q[1], z]));
          });
          break;
        case 'h1':
          if (br.pts) {
            br.pts.forEach((q) => {
              const [qx, qy] = ptXY(q);
              out.push(sz(qx, qy));
            });
          } else {
            (b.rows || []).forEach((y) => {
              out.push(sz(g.xf(y) + c + d / 20, y));
              out.push(sz(g.xb(y) - c - d / 20, y));
            });
          }
          break;
        case 'l1':
          if (br.pts) {
            br.pts.forEach((q) => {
              const [qx, qy] = ptXY(q);
              out.push(sz(qx, qy));
            });
          } else {
            const b2 = by('b2');
            const b1 = by('b1');
            const xm = c + (b1 ? b1.d : 12) / 10 + d / 20;
            const feet = res.bars
              .filter((q) => /^r1[b-f]?$/.test(q.key) && q.path && q.path.length > 1)
              .map((q) => ({ x: q.path[q.path.length - 1][0], R: q.d / 20 }));
            const yl = b.yl ?? c;
            const yu = b.yu ?? p.tBase - c;
            (b.xs || []).forEach((x0) => {
              let x = Math.min(Math.max(x0, xm), g.B - xm);
              feet.forEach((f) => {
                if (Math.abs(x - f.x) < f.R + d / 20) x = f.x - f.R - d / 20 - 0.05;
              });
              out.push(sz(x, yl));
              out.push(
                sz(
                  x,
                  x < g.t
                    ? p.tTip +
                        ((p.tBase - p.tTip) * x) / g.t -
                        c -
                        (b2 ? b2.d : 12) / 10 -
                        d / 20
                    : yu,
                ),
              );
            });
          }
          break;
        case 'e1': {
          const legs = res.bars
            .filter((q) => /^r1[b-f]?$/.test(q.key) && q.path && q.path.length > 1)
            .map((q) => {
              const a = q.path[q.path.length - 2];
              const z = q.path[q.path.length - 1];
              return { x: z[0], y0: Math.min(a[1], z[1]), y1: Math.max(a[1], z[1]), R: q.d / 20 };
            });
          beamDots(g, b as unknown as BeamDotSpec, c).forEach((q) => {
            let x = q.x;
            legs.forEach((f) => {
              if (
                q.y > f.y0 - f.R - d / 20 &&
                q.y < f.y1 + f.R + d / 20 &&
                Math.abs(x - f.x) < f.R + d / 20
              ) {
                x = f.x - f.R - d / 20 - 0.05;
              }
            });
            out.push(sz(x, q.y));
          });
          break;
        }
        case 't1':
        case 't1b': {
          const h = hkB(d);
          if (br.xsT) {
            br.xsT.forEach((x) =>
              (b.cols || []).forEach((z) => {
                const y1 = g.topY(x) - c;
                const sg = x < g.B / 2 ? 1 : -1;
                out.push([
                  [x + sg * h, c, z],
                  [x, c, z],
                  [x, y1, z],
                  [x + sg * h, y1, z],
                ]);
              }),
            );
          } else {
            (b.rows || []).forEach((y) =>
              (b.cols || []).forEach((z) => {
                const xa = g.xf(y) + c;
                const xb = g.xb(y) - c;
                out.push([
                  [xa, y - h, z],
                  [xa, y, z],
                  [xb, y, z],
                  [xb, y - h, z],
                ]);
              }),
            );
          }
          break;
        }
        case 'r2': {
          if (hy) {
            const { T, E } = hy;
            const q = d / 20;
            const xh = (y: number) => T[0] + ((E[0] - T[0]) * (T[1] - y)) / (T[1] - E[1]);
            g.ribs.forEach((r) =>
              (b.rows || []).forEach((y) => {
                const xa = g.xf(y) + c + 2 * q;
                const xe = xh(y) - c - q;
                const za = r.x0 + c + q;
                const zb = r.x1 - c - q;
                out.push([
                  [xa, y, za],
                  [xe, y, za],
                  [xe, y, zb],
                  [xa, y, zb],
                ]);
              }),
            );
          }
          break;
        }
        case 'r3': {
          if (hy) {
            const { T, E } = hy;
            const yh = (x: number) => T[1] + ((E[1] - T[1]) * (x - T[0])) / (E[0] - T[0]);
            const y0 = b.y0 ?? 0;
            g.ribs.forEach((r) =>
              (b.xs || []).forEach((x) =>
                [r.x0 + c + R2 / 10 + d / 20, r.x1 - c - R2 / 10 - d / 20].forEach((z) =>
                  out.push([
                    [x, y0, z],
                    [x, yh(x) - c, z],
                  ]),
                ),
              ),
            );
          }
          break;
        }
      }
    }

    push({
      key: b.key,
      mark: String(b.mark),
      name: b.name,
      d,
      count: b.count ?? b.items.length,
      bars: out,
      bs: [b],
      per: b.key === 'r2' ? 2 : 0,
    });
  });

  return groups;
}

interface CMarkInfo {
  mark: string;
  name: string;
  d: number;
  count: number;
  a: number | undefined;
  bs: BarSpec[];
}

export function m3BarsC(
  p: Project,
  res: BarsResult,
  push: (o: M3BarGroup) => void,
  groups: M3BarGroup[],
): M3BarGroup[] {
  const g = res.g;
  const G = res.G as unknown as TemplateCGModel | undefined;
  if (!G || !g.hyp) return groups;

  const c = p.cover;
  const Lu = p.Lu;
  const nR = g.ribs.length;
  const xbb = g.xbb;
  const yT = g.yTop;
  const B = g.B;
  const rib = g.ribs;

  const info: Record<string, CMarkInfo> = {};
  res.bars.forEach((b) => {
    const m = String(b.mark);
    const o =
      info[m] || (info[m] = { mark: m, name: b.name, d: b.d, count: 0, a: b.a, bs: [] });
    o.count += b.count ?? b.items.length;
    o.bs.push(b);
  });

  const zs = (n: number, z0 = c, z1 = Lu - c): number[] =>
    n <= 1 ? [(z0 + z1) / 2] : Array.from({ length: n }, (_, i) => z0 + ((z1 - z0) * i) / (n - 1));
  const sz = (x: number, y: number, z0 = 5, z1 = Lu - 5): Point3D[] => [
    [x, y, z0],
    [x, y, z1],
  ];
  const add = (m: string, bars: Point3D[][], extra?: Partial<M3BarGroup>): void => {
    const o = info[m];
    if (o) {
      push(
        Object.assign(
          { key: ckey(m), mark: m, name: o.name, d: o.d, count: o.count, bars, bs: o.bs },
          extra || {},
        ),
      );
    }
  };

  const d12 = info['12'] ? info['12'].d : 12;
  const tR = nR ? rib[0].x1 - rib[0].x0 : 30;
  const T = g.hyp.T;
  const E = g.hyp.E;
  const hl = Math.hypot(E[0] - T[0], E[1] - T[1]) || 1;
  const ux = (E[0] - T[0]) / hl;
  const uy = (E[1] - T[1]) / hl;
  const nO: Point2D = [-uy, ux];
  const inRib = (r: { x0: number; x1: number }, dd: number, side: number) =>
    side ? r.x1 - c - d12 / 10 - dd / 20 : r.x0 + c + d12 / 10 + dd / 20;
  const line3 = (l: Point2D[], z: number): Point3D[] => l.map((q) => [q[0], q[1], z]);

  if (info['1']) {
    const n = Math.ceil(info['1'].count / 2);
    const Z = zs(n);
    add(
      '1',
      G.l1.flatMap((l) => Z.map((z) => line3(l, z))),
    );
  }
  if (info['2']) {
    add(
      '2',
      G.dots.d2.map((q) => sz(q[0], q[1])),
    );
  }
  if (info['3']) {
    add(
      '3',
      zs(info['3'].count).map((z) => line3(G.p3, z)),
    );
  }
  if (info['4'] && G.p4.length >= 2) {
    const a = G.p4[0];
    const b = G.p4[1];
    add(
      '4',
      zs(info['4'].count).map((z) => [
        [a[0] + 1.5, a[1] + 40, z],
        [a[0], a[1], z],
        [b[0], b[1], z],
        [b[0] + 40, b[1], z],
      ]),
    );
  }
  if (info['5']) {
    add(
      '5',
      G.dots.d5.map((q) => sz(q[0], q[1])),
    );
  }
  if (info['5A']) {
    const allItems = info['5A'].bs.flatMap((b) => b.items);
    const L = (allItems.length ? Math.max(...allItems) : 0) / 10;
    add(
      '5A',
      G.dots.d5a.map((q) => sz(q[0], q[1], 5, 5 + L)),
    );
  }
  if (info['6']) {
    add(
      '6',
      zs(info['6'].count).map((z) => [
        [xbb - c, yT - c, z],
        [xbb - c, c, z],
        [xbb - c + 40, c, z],
      ]),
    );
  }
  if (info['7'] && G.p7.length >= 2) {
    const a = G.p7[0];
    const b = G.p7[1];
    add(
      '7',
      zs(info['7'].count).map((z) => [
        [b[0], b[1], z],
        [a[0], a[1], z],
        [a[0] + 40, a[1], z],
      ]),
    );
  }
  if (info['8'] && G.p8.length >= 2) {
    const a = G.p8[0];
    const b = G.p8[1];
    add(
      '8',
      zs(info['8'].count).map((z) => [
        [a[0], a[1] - 20, z],
        [a[0], a[1], z],
        [b[0], b[1], z],
        [b[0], b[1] - 20, z],
      ]),
    );
  }
  if (info['9'] && G.l9.length >= 1) {
    const n = Math.ceil(info['9'].count / 2);
    const Z = zs(n);
    const yb = G.l9[0][0][1];
    const yt = G.l9[0][1][1];
    add(
      '9',
      Z.flatMap((z): Point3D[][] => [
        [
          [c + 20, yt, z],
          [c, yt, z],
          [c, yb, z],
          [c + 20, yb, z],
        ],
        [
          [B - c - 20, yt, z],
          [B - c, yt, z],
          [B - c, yb, z],
          [B - c - 20, yb, z],
        ],
      ]),
    );
  }
  if (info['10'] && nR > 1) {
    const m = Math.max(1, Math.round(info['10'].count / (2 * (nR - 1))));
    const a = info['10'].a || 60;
    const out: Point3D[][] = [];
    for (let i = 0; i < nR - 1; i++) {
      const z0 = rib[i].x1;
      const z1 = rib[i + 1].x0;
      const sp = m > 1 ? Math.min(a, (z1 - z0) / m) : 0;
      for (let k = 0; k < m; k++) {
        const z = (z0 + z1) / 2 + (k - (m - 1) / 2) * sp;
        G.l10.forEach((l) =>
          out.push([
            [l[0][0] - 10, l[1][1], z],
            [l[0][0], l[1][1], z],
            [l[0][0], l[0][1], z],
            [l[0][0] - 10, l[0][1], z],
          ]),
        );
      }
    }
    add('10', out);
  }
  if (nR) {
    if (info['11']) {
      const out: Point3D[][] = [];
      rib.forEach((r) =>
        G.l11.forEach((l) =>
          [inRib(r, info['11'].d, 0), inRib(r, info['11'].d, 1)].forEach((z) =>
            out.push([
              [l[0][0], l[0][1], z],
              [l[1][0], l[1][1], z],
            ]),
          ),
        ),
      );
      add('11', out);
    }
    if (info['12']) {
      const q = d12 / 20;
      const out: Point3D[][] = [];
      rib.forEach((r) =>
        G.l12.forEach((l) => {
          const y = l[0][1];
          const xa = l[0][0];
          const xe = l[1][0] - q;
          const za = r.x0 + c + q;
          const zb = r.x1 - c - q;
          out.push([
            [xa, y, za],
            [xe, y, za],
            [xe, y, zb],
            [xa, y, zb],
          ]);
        }),
      );
      add('12', out, { per: 2 });
    }
    if (info['13']) {
      const n = Math.max(1, Math.round(info['13'].count / nR));
      const dd = info['13'].d;
      const out: Point3D[][] = [];
      rib.forEach((r) => {
        for (let i = 0; i < n; i++) {
          const z =
            r.x0 +
            c +
            d12 / 10 +
            dd / 20 +
            (n > 1
              ? (i * (tR - 2 * c - (2 * d12) / 10 - dd / 10)) / (n - 1)
              : (tR - 2 * c) / 2 - d12 / 10 - dd / 20);
          out.push(line3(G.p13, z));
        }
      });
      add('13', out);
    }
    if (info['14']) {
      const out: Point3D[][] = [];
      const dd = info['14'].d;
      rib.forEach((r) =>
        G.rows.forEach((y) => {
          const xh = G.xOf(y) - d12 / 5 - dd / 20;
          const za = inRib(r, dd, 0);
          const zb = inRib(r, dd, 1);
          out.push([
            [xh - 20, y, za],
            [xh, y, za],
            [xh, y, zb],
            [xh - 20, y, zb],
          ]);
        }),
      );
      add('14', out);
    }
    if (info['15'] && G.p13.length >= 2) {
      const n = Math.max(1, Math.round(info['15'].count / nR));
      const d13 = info['13'] ? info['13'].d : 25;
      const dd = info['15'].d;
      const a = G.p13[0];
      const b = G.p13[1];
      const out: Point3D[][] = [];
      const off = d13 / 20 + dd / 20;
      rib.forEach((r) => {
        for (let k = 0; k < n; k++) {
          const f = (k + 0.5) / n;
          const bx = a[0] + (b[0] - a[0]) * f + nO[0] * off;
          const by = a[1] + (b[1] - a[1]) * f + nO[1] * off;
          const za = r.x0 + c;
          const zb = r.x1 - c;
          out.push([
            [bx - nO[0] * 5, by - nO[1] * 5, za],
            [bx, by, za],
            [bx, by, zb],
            [bx - nO[0] * 5, by - nO[1] * 5, zb],
          ]);
        }
      });
      add('15', out);
    }
  }
  if (info['16'] && nR > 1 && G.l16.length) {
    const m = Math.max(1, Math.round(info['16'].count / ((nR - 1) * G.l16.length)));
    const a = info['16'].a || 100;
    const out: Point3D[][] = [];
    for (let i = 0; i < nR - 1; i++) {
      const z0 = rib[i].x1;
      const z1 = rib[i + 1].x0;
      const sp = m > 1 ? Math.min(a, (z1 - z0) / (m + 1)) : 0;
      for (let k = 0; k < m; k++) {
        const z = (z0 + z1) / 2 + (k - (m - 1) / 2) * sp;
        G.l16.forEach((l) =>
          out.push([
            [l[0][0], l[0][1] - 5, z],
            [l[0][0], l[0][1], z],
            [l[1][0], l[1][1], z],
            [l[1][0], l[1][1] - 5, z],
          ]),
        );
      }
    }
    add('16', out);
  }
  if (info['17'] && info['17'].bs.length && isAnchorGrid(info['17'].bs[0].A)) {
    const A = info['17'].bs[0].A;
    const out: Point3D[][] = [];
    A.xs.forEach((x) =>
      A.zs.forEach((z) =>
        out.push([
          [x, -A.Lb, z],
          [x, A.Lc, z],
        ]),
      ),
    );
    push({
      key: 'an',
      mark: '17',
      name: info['17'].name,
      d: info['17'].d,
      count: info['17'].count,
      bars: out,
      bs: info['17'].bs,
    });
  }
  if (g.key && info['2']) {
    const dSt = info['9'] ? info['9'].d : 12;
    const KL = keyLayoutC(p, g, info['2'].d / 20 + dSt / 20);
    const xl = KL.xl;
    const xr = KL.xr;
    const yb = KL.yb;
    const d2 = info['2'].d;
    const bars: Point3D[][] = [];
    KL.rows.forEach((y) => {
      bars.push(sz(xl + 2, y));
      bars.push(sz(xr - 2, y));
    });
    push({
      key: 'ckhay',
      mark: 'KH',
      name: 'Thép chân khay (theo mặt cắt 2-2: thép dọc + đai)',
      d: d2,
      count: bars.length,
      bars,
      bs: [],
      note: 'Thép trong chân khay vẽ đủ chiều sâu thật, hàng thép dọc đúng bước thanh mác 2 như mặt cắt 2-2 của bản vẽ; không có trong bảng thống kê.',
    });
    const Z = zs(Math.max(2, Math.round(Lu / 20)));
    const st: Point3D[][] = [];
    Z.forEach((z) => {
      st.push([
        [xl, c, z],
        [xl, yb, z],
        [xr, yb, z],
        [xr, c, z],
      ]);
      KL.ties.forEach((y) =>
        st.push([
          [xl, y, z],
          [xr, y, z],
        ]),
      );
    });
    push({
      key: 'ckhay2',
      mark: 'KH',
      name: 'Đai chân khay (bước 200, theo hình vẽ)',
      d: dSt,
      count: st.length,
      bars: st,
      bs: [],
      note: 'Đai chân khay vẽ theo mặt cắt 2-2 của bản vẽ (bước 200 để minh họa).',
    });
  }

  return groups;
}

export function m3BarsD(
  p: Project,
  res: BarsResult,
  push: (o: M3BarGroup) => void,
  groups: M3BarGroup[],
): M3BarGroup[] {
  const g = res.g;
  const c = p.cover;
  const Lu = p.Lu;
  const B = g.B;
  const tB = p.tBase;
  const zm = c + 2.5;
  const yT = g.yTop;
  const by = (k: string): BarSpec | undefined => res.bars.find((b) => b.key === k);
  const hy = p.type === 'rib' && g.hyp ? g.hyp : null;
  const L3 = (path: Point2D[], z: number): Point3D[] => path.map((q) => [q[0], q[1], z]);
  const add = (b: BarSpec | undefined, bars: Point3D[][], extra?: Partial<M3BarGroup>): void => {
    if (b) {
      push(
        Object.assign(
          {
            key: b.key,
            mark: String(b.mark),
            name: b.name,
            d: b.d,
            count: b.count ?? b.items.length,
            bars,
            bs: [b],
          },
          extra || {},
        ),
      );
    }
  };

  const dzV = 3.5;
  ['s1', 's2'].forEach((k) => {
    const b = by(k);
    if (b) {
      add(
        b,
        (b.pos || []).map((z) => L3(b.path, z + (z > Lu - 25 ? -dzV : dzV))),
      );
    }
  });
  ['b1', 'b2'].forEach((k) => {
    const b = by(k);
    if (b) {
      add(
        b,
        (b.pos || []).map((z) => L3(b.path, z)),
      );
    }
  });

  {
    const hF = by('h1');
    const hB = by('h1a');
    const hT = (r: number) => (r > yT - c - 0.5 ? r - 1.6 : r);
    [hF, hB].forEach((b) => {
      if (!b) return;
      const front = b === hF;
      const hk = b.hook || 40;
      const dz = front ? 0 : b.d / 10 + 1.4;
      const sg = front ? 1 : -1;
      const za = zm + dz;
      const zb = Lu - zm - dz;
      const out: Point3D[][] = [];
      (b.rows || []).forEach((y0) => {
        const y = hT(y0);
        const xF = hF ? (hF.xF ?? 0) : 0;
        const xBv = hB ? evalNumOrFn(hB.xB, y0, 0) : 0;
        const x = front ? xF : xBv;
        const room = hF && hB ? xBv - xF : hk;
        const h = Math.max(5, Math.min(hk, room - 1.4));
        out.push([
          [x + sg * h, y, za],
          [x, y, za],
          [x, y, zb],
          [x + sg * h, y, zb],
        ]);
      });
      add(b, out);
    });
  }

  const obs: Array<{ a: Point2D; b: Point2D; R: number }> = [];
  const addPath = (path: Point2D[], R: number) =>
    path.slice(1).forEach((q, i) => obs.push({ a: path[i], b: q, R }));
  {
    const s1 = by('s1');
    const s2 = by('s2');
    const w1 = by('w1');
    const k1 = by('k1');
    if (s1) addPath(s1.path, s1.d / 20);
    if (s2) addPath(s2.path, s2.d / 20);
    if (w1) {
      (w1.xs || []).forEach((x) =>
        addPath(
          [
            [x + w1.d, c + w1.d / 20],
            [x, c + w1.d / 20],
            [x, tB - c - w1.d / 20],
            [x + w1.d, tB - c - w1.d / 20],
          ],
          w1.d / 20,
        ),
      );
    }
    if (k1 && isAnchorGrid(k1.A)) {
      const kA = k1.A;
      kA.xs.forEach((x) => obs.push({ a: [x, -kA.Lb], b: [x, kA.Lc], R: k1.d / 20 }));
    }
  }

  const pdist = (q: Point2D, a: Point2D, b: Point2D) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const L2 = dx * dx + dy * dy || 1;
    const s = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / L2));
    return Math.hypot(q[0] - a[0] - s * dx, q[1] - a[1] - s * dy);
  };
  const nudgeX = (x: number, ys: number[], R: number, taken?: Point2D[]) => {
    for (const dx of [0, 2.5, -2.5, 3.5, -3.5, 5, -5, 6.5, -6.5]) {
      const xx = x + dx;
      if (xx < c + R || xx > B - c - R) continue;
      if (
        ys.every((y) => obs.every((o) => pdist([xx, y], o.a, o.b) >= o.R + R - 0.12)) &&
        (!taken ||
          ys.every((y) => taken.every((q) => Math.hypot(q[0] - xx, q[1] - y) >= 2 * R + 0.2)))
      ) {
        return xx;
      }
    }
    return x;
  };

  const t4 = by('t1');
  if (t4) {
    const h = t4.d;
    const out: Point3D[][] = [];
    (t4.rows || []).forEach((y) =>
      (t4.cols || []).forEach((z) => {
        const xa = g.xf(y) + c;
        const xb = g.xb(y) - c;
        out.push([
          [xa, y - h, z],
          [xa, y, z],
          [xb, y, z],
          [xb, y - h, z],
        ]);
      }),
    );
    add(t4, out);
  }

  const b3 = by('l1');
  if (b3) {
    const b3r = b3 as unknown as BarSpecRuntime;
    const done: Point2D[] = [];
    const R3 = b3.d / 20;
    add(
      b3,
      (b3r.pts || []).map((q): Point3D[] => {
        const [qx, qy] = ptXY(q);
        const x = nudgeX(qx, [qy], R3, done);
        done.push([x, qy]);
        return [
          [x, qy, zm],
          [x, qy, Lu - zm],
        ];
      }),
    );
  }

  const u1 = by('u1');
  if (u1) {
    const out: Point3D[][] = [];
    (u1.pos || []).forEach((z) => {
      out.push(L3(u1.path, z));
      out.push(u1.path.map((q): Point3D => [B - q[0], q[1], z]));
    });
    add(u1, out);
  }

  const u2 = by('u2');
  if (u2) {
    const u2r = u2 as unknown as BarSpecRuntime;
    const out: Point3D[][] = [];
    const R2u = u2.d / 20;
    const yb = u2r.yb ?? 0;
    const yu = u2.yu ?? tB;
    (u2.xs || []).forEach((x0) => {
      const x = nudgeX(x0, [yb, yu], R2u);
      out.push(u2.path.map((q): Point3D => [x, q[1], q[0]]));
      out.push(u2.path.map((q): Point3D => [x, q[1], Lu - q[0]]));
    });
    add(u2, out);
  }

  const u3 = by('u3');
  if (u3) {
    const u3r = u3 as unknown as BarSpecRuntime;
    const zb = u3r.zb ?? c;
    const out: Point3D[][] = [];
    (u3.rows || []).forEach((y) => {
      out.push([
        [c, y, zb],
        [B - c, y, zb],
      ]);
      out.push([
        [c, y, Lu - zb],
        [B - c, y, Lu - zb],
      ]);
    });
    add(u3, out);
  }

  const w1 = by('w1');
  if (w1) {
    const out: Point3D[][] = [];
    const hk = w1.d;
    const y0 = c + w1.d / 20;
    const y1 = tB - c - w1.d / 20;
    (w1.xs || []).forEach((x) =>
      (w1.zs || []).forEach((z) =>
        out.push([
          [x + hk, y0, z],
          [x, y0, z],
          [x, y1, z],
          [x + hk, y1, z],
        ]),
      ),
    );
    add(w1, out);
  }

  const k1 = by('k1');
  if (k1 && isAnchorGrid(k1.A)) {
    const A = k1.A;
    const out: Point3D[][] = [];
    A.xs.forEach((x) =>
      A.zs.forEach((z) =>
        out.push([
          [x, -A.Lb, z],
          [x, A.Lc, z],
        ]),
      ),
    );
    add(k1, out);
  }

  if (hy) {
    const t6 = by('r2');
    const t7 = by('r1');
    const d6 = t6 ? t6.d : 12;
    if (t6) {
      const t6r = t6 as unknown as BarSpecRuntime;
      const xF6 = t6.xF ?? 0;
      const out: Point3D[][] = [];
      g.ribs.forEach((r) =>
        [r.x0 + c + t6.d / 20, r.x1 - c - t6.d / 20].forEach((z) =>
          (t6.rows || []).forEach((y) =>
            out.push([
              [xF6, y, z],
              [evalNumOrFn(t6r.xe, y, xF6), y, z],
            ]),
          ),
        ),
      );
      add(t6, out);
    }
    if (t7) {
      const Lr = dLayers(p);
      const rb = p.rb;
      const yfl = Lr.ylo + rb.l1.d / 20 + t7.d / 20;
      const xe = B - c;
      const R7 = t7.d / 20;
      const xF7 = t7.xF ?? 0;
      const h1 = by('h1');
      const h1a = by('h1a');
      const l1 = by('l1');
      const hTop = (r: number) => (r > yT - c - 0.5 ? r - 1.6 : r);
      const Z: Array<[number, number, number]> = [];
      if (h1) (h1.rows || []).forEach((y) => Z.push([h1.xF ?? 0, hTop(y), h1.d / 20]));
      if (h1a) {
        (h1a.rows || []).forEach((y) =>
          Z.push([evalNumOrFn(h1a.xB, y, 0), hTop(y), h1a.d / 20]),
        );
      }
      if (l1) {
        ((l1 as unknown as BarSpecRuntime).pts || []).forEach((q) => {
          const [qx, qy] = ptXY(q);
          Z.push([qx, qy, l1.d / 20]);
        });
      }
      const pd = (q: Point2D, a: Point2D, b: Point2D) => {
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const L2 = dx * dx + dy * dy || 1;
        const s = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / L2));
        return Math.hypot(q[0] - a[0] - s * dx, q[1] - a[1] - s * dy);
      };
      const lines = (t7.diag || []).map((q: BarDiagLine) => {
        const L = Math.hypot(q.B[0] - q.A[0], q.B[1] - q.A[1]) || 1;
        const u: Point2D = [(q.B[0] - q.A[0]) / L, (q.B[1] - q.A[1]) / L];
        const nn: Point2D = [-Math.abs(u[1]), -Math.abs(u[0])];
        const clipB = Math.abs(q.B[1] - yfl) < 1e-6;
        let best: { A: Point2D; B: Point2D; bad: number } | null = null;
        for (const dl of [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, -0.4]) {
          const P0: Point2D = [q.A[0] + nn[0] * dl, q.A[1] + nn[1] * dl];
          const sA = (xF7 - P0[0]) / u[0];
          const A: Point2D = [xF7, P0[1] + u[1] * sA];
          const sB = clipB ? (yfl - P0[1]) / u[1] : (xe - P0[0]) / u[0];
          const Bp: Point2D = [P0[0] + u[0] * sB, P0[1] + u[1] * sB];
          if (Bp[0] - A[0] < 5 || Bp[1] < c + R7 + 0.05) continue;
          const bad = Z.filter((z) => pd([z[0], z[1]], A, Bp) < z[2] + R7 - 0.02).length;
          if (!best || bad < best.bad) best = { A, B: Bp, bad };
          if (!bad) break;
        }
        return best || { A: q.A, B: q.B, bad: 0 };
      });
      const out: Point3D[][] = [];
      g.ribs.forEach((r) =>
        [r.x0 + c + d6 / 10 + t7.d / 20, r.x1 - c - d6 / 10 - t7.d / 20].forEach((z) =>
          lines.forEach((q) =>
            out.push([
              [q.A[0], q.A[1], z],
              [q.B[0], q.B[1], z],
            ]),
          ),
        ),
      );
      add(t7, out);
    }
  }

  return groups;
}

export function model3D(
  pIn: Project | EngineProject,
  resIn: BarsResult | EngineBarsResult,
): Model3DData {
  const p = pIn as Project;
  const res = resIn as BarsResult;
  const g = res.g;
  const tl = blindT(p);
  const ms = m3Concrete(p, res);
  const groups = m3Bars(p, res);
  groups.forEach((gr) => {
    gr.R = gr.d / 20;
  });
  // Móng cọc (tùy chọn): thêm khối cọc + lồng thép; tắt thì mô hình giữ nguyên.
  const on = pileOn(p);
  const pileMesh = on ? m3PileMesh(p, res) : null;
  if (on) groups.push(...m3PileGroups(p, res, groups.length));
  const pileDepth = on ? pileGrid(p, g.B)?.L ?? 0 : 0;
  return {
    conc: ms.conc,
    lean: ms.lean,
    soil: ms.soil,
    ...(pileMesh ? { pile: pileMesh } : {}),
    ground: m3Ground(p, res),
    groups,
    bbox: {
      x0: 0,
      x1: g.B,
      y0: -Math.max((g.dn || 0) + tl, g.an ? g.an.Lb : 0, pileDepth),
      y1: g.yTop,
      z0: 0,
      z1: p.Lu,
    },
    sig: [p.tpl, p.type, p.H, p.Lu, g.B, ...(on ? ['pile', Math.round(pileDepth)] : [])].join('|'),
  };
}
