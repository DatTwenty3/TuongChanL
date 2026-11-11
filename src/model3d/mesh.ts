import type { EngineBarsResult, EngineProject } from '../engine';
import { blindOutline, blindT } from '../cad/layers';
import type { BarsResult, M3MeshData, M3TubeRange, Point2D, Point3D, Project } from '../types/project';

export interface M3PrismOptions {
  keep?: (a: Point2D, b: Point2D) => boolean;
}

export interface M3TubeRawChunk {
  v: number[];
  i: number[];
  nv: number;
}

export interface M3TubeFinishChunk {
  v: Float32Array;
  i: Uint16Array;
  nv: number;
}

export interface M3ConcreteMeshes {
  conc: M3Mesh;
  lean: M3Mesh;
  soil: M3Mesh;
}

export function m3Clean(poly: Point2D[]): Point2D[] {
  const a: Point2D[] = poly.map((q) => [q[0], q[1]]);
  const eq = (u: Point2D, v: Point2D) =>
    Math.abs(u[0] - v[0]) < 1e-6 && Math.abs(u[1] - v[1]) < 1e-6;
  let ch = true;
  while (ch && a.length > 3) {
    ch = false;
    for (let i = 0; i < a.length; i++) {
      const p0 = a[(i + a.length - 1) % a.length];
      const p1 = a[i];
      const p2 = a[(i + 1) % a.length];
      if (eq(p0, p1)) {
        a.splice(i, 1);
        ch = true;
        break;
      }
      const cr = (p1[0] - p0[0]) * (p2[1] - p1[1]) - (p1[1] - p0[1]) * (p2[0] - p1[0]);
      if (Math.abs(cr) < 1e-7) {
        a.splice(i, 1);
        ch = true;
        break;
      }
    }
  }
  return a;
}

export function m3Tri(a: Point2D[]): [number, number, number][] {
  const n = a.length;
  const idx = Array.from({ length: n }, (_, i) => i);
  const out: [number, number, number][] = [];
  const inside = (p: Point2D, A: Point2D, B: Point2D, C: Point2D) => {
    const s1 = (B[0] - A[0]) * (p[1] - A[1]) - (B[1] - A[1]) * (p[0] - A[0]);
    const s2 = (C[0] - B[0]) * (p[1] - B[1]) - (C[1] - B[1]) * (p[0] - B[0]);
    const s3 = (A[0] - C[0]) * (p[1] - C[1]) - (A[1] - C[1]) * (p[0] - C[0]);
    return s1 > 1e-7 && s2 > 1e-7 && s3 > 1e-7;
  };
  let guard = 0;
  while (idx.length > 3 && guard++ < 5e3) {
    let done = false;
    for (let i = 0; i < idx.length && !done; i++) {
      const i0 = idx[(i + idx.length - 1) % idx.length];
      const i1 = idx[i];
      const i2 = idx[(i + 1) % idx.length];
      const A = a[i0];
      const B = a[i1];
      const C = a[i2];
      if ((B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]) <= 1e-9) continue;
      if (idx.some((j) => j !== i0 && j !== i1 && j !== i2 && inside(a[j], A, B, C))) continue;
      out.push([i0, i1, i2]);
      idx.splice(i, 1);
      done = true;
    }
    if (!done) idx.splice(0, 1);
  }
  if (idx.length === 3) out.push([idx[0], idx[1], idx[2]]);
  return out;
}

export class M3Mesh implements M3MeshData {
  p: number[] = [];
  n: number[] = [];
  i: number[] = [];
  l: number[] = [];

  v(x: number, y: number, z: number, nx: number, ny: number, nz: number): number {
    this.p.push(x, y, z);
    this.n.push(nx, ny, nz);
    return this.p.length / 3 - 1;
  }

  line(a: Point3D, b: Point3D): void {
    this.l.push(a[0], a[1], a[2], b[0], b[1], b[2]);
  }

  prism(poly: Point2D[], z0: number, z1: number, o: M3PrismOptions = {}): void {
    let a = m3Clean(poly);
    if (a.length < 3) return;
    let ar = 0;
    for (let i = 0; i < a.length; i++) {
      const p = a[i];
      const q = a[(i + 1) % a.length];
      ar += p[0] * q[1] - q[0] * p[1];
    }
    if (ar < 0) a = a.slice().reverse();
    const n = a.length;
    const tris = m3Tri(a);
    const keep = o.keep || (() => true);
    [z0, z1].forEach((z, k) => {
      const base = a.map((q) => this.v(q[0], q[1], z, 0, 0, k ? 1 : -1));
      tris.forEach(([i0, i1, i2]) => {
        if (k) this.i.push(base[i0], base[i1], base[i2]);
        else this.i.push(base[i0], base[i2], base[i1]);
      });
    });
    for (let i = 0; i < n; i++) {
      const p = a[i];
      const q = a[(i + 1) % n];
      if (keep(p, q)) {
        const dx = q[0] - p[0];
        const dy = q[1] - p[1];
        const L = Math.hypot(dx, dy) || 1;
        const nx = dy / L;
        const ny = -dx / L;
        const A = this.v(p[0], p[1], z0, nx, ny, 0);
        const B = this.v(q[0], q[1], z0, nx, ny, 0);
        const C = this.v(q[0], q[1], z1, nx, ny, 0);
        const D = this.v(p[0], p[1], z1, nx, ny, 0);
        this.i.push(A, B, C, A, C, D);
      }
      this.line([p[0], p[1], z0], [q[0], q[1], z0]);
      this.line([p[0], p[1], z1], [q[0], q[1], z1]);
      this.line([p[0], p[1], z0], [p[0], p[1], z1]);
    }
  }
}

export const m3sub = (a: Point3D, b: Point3D): Point3D => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

export const m3dot = (a: Point3D, b: Point3D): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export const m3cross = (a: Point3D, b: Point3D): Point3D => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

export const m3norm = (a: Point3D): Point3D => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

export function m3rot(w: Point3D, a: Point3D, b: Point3D): Point3D {
  const k = m3cross(a, b);
  const s = Math.hypot(k[0], k[1], k[2]);
  const c = m3dot(a, b);
  if (s < 1e-9) return [w[0], w[1], w[2]];
  const kn: Point3D = [k[0] / s, k[1] / s, k[2] / s];
  const kw = m3cross(kn, w);
  const kd = m3dot(kn, w) * (1 - c);
  return [
    w[0] * c + kw[0] * s + kn[0] * kd,
    w[1] * c + kw[1] * s + kn[1] * kd,
    w[2] * c + kw[2] * s + kn[2] * kd,
  ];
}

export class M3Tubes {
  S: number;
  maxV: number;
  chunks: M3TubeRawChunk[] = [];
  cur!: M3TubeRawChunk;

  constructor(sides = 6, maxV = 6e4) {
    this.S = sides;
    this.maxV = maxV;
    this.newChunk();
  }

  newChunk(): void {
    this.cur = { v: [], i: [], nv: 0 };
    this.chunks.push(this.cur);
  }

  add(pts: Point3D[], R: number): M3TubeRange | null {
    if (!pts.length) return null;
    const P: Point3D[] = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const a = P[P.length - 1];
      const b = pts[i];
      if (Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) > 1e-4) P.push(b);
    }
    if (P.length < 2) return null;
    const parts: Point3D[][] = [[P[0]]];
    for (let i = 1; i < P.length; i++) {
      parts[parts.length - 1].push(P[i]);
      if (
        i < P.length - 1 &&
        m3dot(m3norm(m3sub(P[i], P[i - 1])), m3norm(m3sub(P[i + 1], P[i]))) < -0.85
      ) {
        parts.push([P[i]]);
      }
    }
    const need = parts.reduce((s, q) => s + (q.length + 2) * (this.S + 1) + 2, 0);
    if (this.cur.nv + need > this.maxV) this.newChunk();
    const ch = this.cur;
    const i0 = ch.i.length;
    parts.forEach((q) => {
      if (q.length > 1) this.part(q, R);
    });
    return { ci: this.chunks.length - 1, i0, n: ch.i.length - i0 };
  }

  part(P: Point3D[], R: number): void {
    const S = this.S;
    const ch = this.cur;
    const n = P.length;
    const T: Point3D[] = [];
    for (let j = 0; j < n - 1; j++) T.push(m3norm(m3sub(P[j + 1], P[j])));
    const ref: Point3D = Math.abs(T[0][1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    let u = m3norm(m3cross(T[0], ref));
    let v = m3cross(T[0], u);

    const push = (c: Point3D, off: Point3D, nr: Point3D): number => {
      ch.v.push(c[0], c[1], c[2], off[0], off[1], off[2], nr[0], nr[1], nr[2], R);
      return ch.nv++;
    };

    const ring = (
      c: Point3D,
      uu: Point3D,
      vv: Point3D,
      uu2: Point3D,
      vv2: Point3D,
      tin: Point3D,
      nm: Point3D | null,
    ): number[] => {
      const r: number[] = [];
      for (let k = 0; k < S; k++) {
        const th = (2 * Math.PI * k) / S;
        const cs = Math.cos(th);
        const sn = Math.sin(th);
        const d1: Point3D = [
          cs * uu[0] + sn * vv[0],
          cs * uu[1] + sn * vv[1],
          cs * uu[2] + sn * vv[2],
        ];
        const d2: Point3D = [
          cs * uu2[0] + sn * vv2[0],
          cs * uu2[1] + sn * vv2[1],
          cs * uu2[2] + sn * vv2[2],
        ];
        let off: Point3D = [R * d1[0], R * d1[1], R * d1[2]];
        if (nm) {
          const s = (-R * m3dot(d1, nm)) / Math.max(0.2, m3dot(tin, nm));
          off = [off[0] + s * tin[0], off[1] + s * tin[1], off[2] + s * tin[2]];
        }
        r.push(push(c, off, m3norm([d1[0] + d2[0], d1[1] + d2[1], d1[2] + d2[2]])));
      }
      return r;
    };

    const rings: number[][] = [];
    for (let j = 0; j < n; j++) {
      if (j === 0) rings.push(ring(P[0], u, v, u, v, T[0], null));
      else if (j === n - 1) rings.push(ring(P[j], u, v, u, v, T[j - 1], null));
      else {
        const nm = m3norm([T[j - 1][0] + T[j][0], T[j - 1][1] + T[j][1], T[j - 1][2] + T[j][2]]);
        const u2 = m3rot(u, T[j - 1], T[j]);
        const v2 = m3rot(v, T[j - 1], T[j]);
        rings.push(ring(P[j], u, v, u2, v2, T[j - 1], nm));
        u = u2;
        v = v2;
      }
    }

    for (let j = 0; j < n - 1; j++) {
      for (let k = 0; k < S; k++) {
        const kk = (k + 1) % S;
        const A = rings[j][k];
        const B = rings[j][kk];
        const C = rings[j + 1][kk];
        const D = rings[j + 1][k];
        ch.i.push(A, B, C, A, C, D);
      }
    }

    const cap = (c: Point3D, t: Point3D, sgn: number, jr: { u: Point3D; v: Point3D }) => {
      const nr: Point3D = [t[0] * sgn, t[1] * sgn, t[2] * sgn];
      const cc = push(c, [0, 0, 0], nr);
      const ids: number[] = [];
      for (let k = 0; k < S; k++) {
        const th = (2 * Math.PI * k) / S;
        const cs = Math.cos(th);
        const sn = Math.sin(th);
        const uu = jr.u;
        const vv = jr.v;
        ids.push(
          push(
            c,
            [
              R * (cs * uu[0] + sn * vv[0]),
              R * (cs * uu[1] + sn * vv[1]),
              R * (cs * uu[2] + sn * vv[2]),
            ],
            nr,
          ),
        );
      }
      for (let k = 0; k < S; k++) {
        const kk = (k + 1) % S;
        if (sgn < 0) ch.i.push(cc, ids[kk], ids[k]);
        else ch.i.push(cc, ids[k], ids[kk]);
      }
    };

    const u0 = m3norm(m3cross(T[0], ref));
    const v0 = m3cross(T[0], u0);
    cap(P[0], T[0], -1, { u: u0, v: v0 });
    cap(P[n - 1], T[n - 2], 1, { u, v });
  }

  finish(): M3TubeFinishChunk[] {
    return this.chunks
      .filter((c) => c.nv > 0)
      .map((c) => ({ v: new Float32Array(c.v), i: new Uint16Array(c.i), nv: c.nv }));
  }
}

export function m3Concrete(
  pIn: Project | EngineProject,
  resIn: BarsResult | EngineBarsResult,
): M3ConcreteMeshes {
  const p = pIn as Project;
  const res = resIn as BarsResult;
  const g = res.g;
  const Lu = p.Lu;
  const B = g.B;
  const tl = blindT(p);
  const eq = (u: Point2D, v: Point2D) =>
    Math.abs(u[0] - v[0]) < 1e-6 && Math.abs(u[1] - v[1]) < 1e-6;
  const conc = new M3Mesh();
  const lean = new M3Mesh();
  const soil = new M3Mesh();

  conc.prism(g.out, 0, Lu);
  if (p.type === 'rib' && g.hyp) {
    const { T, E, tri } = g.hyp;
    g.ribs.forEach((r) =>
      conc.prism(tri, r.x0, r.x1, {
        keep: (a, b) => (eq(a, E) && eq(b, T)) || (eq(a, T) && eq(b, E)),
      }),
    );
  }

  if (tl > 0) {
    const k = g.key;
    if (g.beam) {
      const bo = blindOutline(p, g);
      const o = g.out;
      const iB = o.findIndex((q) => Math.abs(q[0] - B) < 1e-6);
      if (bo && iB >= 0) lean.prism(bo.concat(o.slice(0, iB + 1).reverse()), 0, Lu);
    } else {
      const R: [number, number, number, number][] = !k
        ? [[0, B, -tl, 0]]
        : k.x0 <= 1e-6
          ? [
              [0, k.x1, -k.d - tl, -k.d],
              [k.x1, B, -tl, 0],
            ]
          : [
              [0, k.x0, -tl, 0],
              [k.x0, k.x1, -k.d - tl, -k.d],
              [k.x1, B, -tl, 0],
            ];
      R.forEach((r) => {
        if (r[1] - r[0] > 1e-6) {
          lean.prism(
            [
              [r[0], r[2]],
              [r[1], r[2]],
              [r[1], r[3]],
              [r[0], r[3]],
            ],
            0,
            Lu,
          );
        }
      });
    }
  }

  {
    const hn = Math.min(p.haunch || 0, B - g.xbb);
    const yc = g.yTop - (g.cap ? g.cap.hv + g.cap.hs : 0);
    const ch: Point2D[] = [[B, g.tH]];
    if (hn > 0) ch.push([g.xbb + hn, g.tH]);
    if (g.fil > 0) ch.push([g.xbb + g.fil, p.tBase], [g.xbb, p.tBase + g.fil]);
    else ch.push([g.xbb, p.tBase]);
    if (g.cap) ch.push([g.xb(yc), yc], [g.xcap, g.yTop - g.cap.hv], [g.xcap, g.yTop]);
    else ch.push([g.xbt, g.yTop]);

    const fm = p.fillMode || 'none';
    const fh = Math.max(0, p.fillH || 0);
    const mS = fm === '1' || fm === '1.5' ? parseFloat(fm) : 0;
    const top = ch[ch.length - 1];
    const xs0 = top[0];
    const yS = fm === 'none' || fh <= 0 ? g.yTop : g.yTop + fh;
    const xe = Math.max(B, xs0 + mS * fh) + Math.max(150, 0.2 * p.H);
    const poly = ch.slice().reverse();
    poly.push([B, 0], [xe, 0], [xe, yS]);
    if (mS > 0 && fh > 0) poly.push([xs0 + mS * fh, yS]);
    else if (fm !== 'none' && fh > 0) poly.push([xs0, yS]);
    soil.prism(poly, 0, Lu);
  }

  return { conc, lean, soil };
}
