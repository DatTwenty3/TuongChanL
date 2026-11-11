/**
 * Wall cross-section geometry builders, rock anchor grids & warnings, fill
 * parameters, and template-specific layout helpers ported faithfully from
 * `01_project_geom.js`, `03_template_b_canti.js`, `04_template_c_ke.js`,
 * `05_template_d_anchor_rebar.js`, and `10_calc_orchestrator.js`.
 */

import {
  C_MARKS,
  D_ROLES,
  ROLE_NAME,
  ancKey,
  ancOn,
  beamOn,
  blindT,
  ckey,
  clamp,
  distr,
  fmt,
  hkB,
  keyOn,
  polyArea,
} from './presets.ts';
import type {
  AnchorGrid,
  EngineBarDiagLine,
  EngineBarSpec,
  EngineCalcGeomData,
  EngineDLayers,
  EngineGeomData,
  EngineKeyLayoutC,
  EngineProject,
  FillParams,
  GeomBeam,
  GeomKey,
  GeomRibHyp,
  GeomRibSpan,
  Point2D,
  RingPointTuple,
} from './types.ts';

// Local pure polygon helpers matching `09_calc_core.js` bit-for-bit to keep `geom.ts` dependency-acyclic.
const rad2deg = (r: number): number => (r * 180) / Math.PI;

function signedPolyArea(P: Point2D[]): number {
  let a = 0;
  for (let i = 0; i < P.length; i++) {
    const p = P[i],
      q = P[(i + 1) % P.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

function clipPolyY(P: Point2D[], yc: number, keepAbove: boolean): Point2D[] {
  const out: Point2D[] = [],
    ins = (p: Point2D) => (keepAbove ? p[1] >= yc - 1e-12 : p[1] <= yc + 1e-12);
  for (let i = 0; i < P.length; i++) {
    const a = P[i],
      b = P[(i + 1) % P.length],
      ia = ins(a),
      ib = ins(b);
    if (ia) out.push(a);
    if (ia !== ib) {
      const t = (yc - a[1]) / (b[1] - a[1]);
      out.push([a[0] + t * (b[0] - a[0]), yc]);
    }
  }
  return out;
}

export function ancGrid(p: EngineProject, g: Pick<EngineGeomData, 'B' | 'topY'>): AnchorGrid {
  const r = (p.rb && p.rb[ancKey(p)]) || ({} as { d?: number; a?: number }),
    a = ((r.a && r.a > 0 ? r.a : p.anc.a) || 60) as number,
    L = Math.max(10, p.anc.L || 100),
    c = p.cover;
  const nx = Math.max(1, Math.floor((g.B - 50) / a + 1e-9) + 1),
    nz = Math.max(1, Math.floor((p.Lu - 50) / a + 1e-9) + 1);
  const x0 = (g.B - (nx - 1) * a) / 2,
    z0 = (p.Lu - (nz - 1) * a) / 2;
  const xs = Array.from({ length: nx }, (_, i) => x0 + i * a),
    zs = Array.from({ length: nz }, (_, i) => z0 + i * a);
  const tMin = Math.min(...xs.map((x) => g.topY(x))),
    Lc = Math.min(L / 2, Math.max(10, tMin - c));
  return { xs, zs, a, L, Lc, Lb: L - Lc, tMin };
}

export function anchorBar(p: EngineProject, g: EngineGeomData): EngineBarSpec {
  const rb = (p.rb && p.rb[ancKey(p)]) || { d: 32, a: 60 },
    A = g.an || ancGrid(p, g),
    n = A.xs.length * A.zs.length;
  return {
    key: ancKey(p),
    mark: 0,
    name: ROLE_NAME.an,
    d: rb.d,
    a: rb.a,
    A,
    path: [
      [0, 0],
      [A.L, 0],
    ],
    straight: true,
    items: Array.from({ length: n }, () => Math.round(A.L * 10)),
  };
}

export const ancBarOf = (res: { bars: EngineBarSpec[] }): EngineBarSpec | undefined =>
  res.bars.find((b) => Boolean(b.A && (b.key === 'an' || b.key === 'k1')));

export function ancWarn(p: EngineProject, g: EngineGeomData): string[] {
  const A = g.an,
    w: string[] = [];
  if (!A) return w;
  const Lr = A.Lb - blindT(p);
  if (A.Lc < A.L / 2 - 1e-6)
    w.push(
      `Neo đá: bản đáy chỉ dày ${fmt(A.tMin)} cm tại hàng neo nên phần neo trong bản bị khống chế ${fmt(A.Lc)} cm (bề dày bản − lớp bảo vệ), còn ${fmt(A.Lb)} cm nằm dưới đáy bản.`,
    );
  if (Lr < 5)
    w.push(
      `Neo đá: chiều dài neo L = ${fmt(A.L)} cm quá ngắn – chỉ ${fmt(Math.max(0, Lr))} cm ăn vào đá.`,
    );
  return w;
}

export function geom(p: EngineProject): EngineGeomData {
  const t = p.toe,
    B = p.toe + p.tsb + p.heel,
    yTop = p.tBase + p.H;
  const sf = !!p.slopeFront;
  const xbb = t + p.tsb,
    xbt = sf ? xbb : t + p.tst;
  const vt = p.tpl === 'D' ? clamp(p.vtop || 0, 0, p.H - 1) : 0;
  const capH = p.tpl === 'A' && p.cap && p.cap.w > 0 ? p.cap.hv + p.cap.hs : vt;
  const xb = (y: number) =>
    xbb - ((xbb - xbt) * (Math.min(y, p.tBase + p.H - capH) - p.tBase)) / (p.H - capH);
  const xf = sf ? (y: number) => t + ((p.tsb - p.tst) * (y - p.tBase)) / p.H : () => t;
  const xft = xf(p.tBase + p.H);
  const tH = p.tTipH != null ? p.tTipH : p.tpl === 'B' ? p.tTip : p.tBase;
  const tf = Math.min(p.toeFlat || 0, t),
    hn = Math.min(p.haunch || 0, B - xbb);
  const topY = (x: number) =>
    x <= tf
      ? p.tTip
      : x <= t
        ? p.tTip + ((p.tBase - p.tTip) * (x - tf)) / Math.max(1e-9, t - tf)
        : x <= xbb
          ? p.tBase
          : hn > 0
            ? x < xbb + hn
              ? p.tBase + ((tH - p.tBase) * (x - xbb)) / hn
              : tH
            : p.tBase + ((tH - p.tBase) * (x - xbb)) / Math.max(1e-9, B - xbb);
  const A = p.tpl === 'A',
    fil = A ? Math.max(0, p.fil || 0) : 0,
    cap = A && p.cap && p.cap.w > 0 ? p.cap : null;
  const beam: GeomBeam | null = beamOn(p) && p.beam ? { w: p.beam.w, d: p.beam.d } : null;
  let key: GeomKey | null = null;
  if (keyOn(p)) {
    const x0 = p.key.toeEnd ? 0 : t + p.tsb / 2 - p.key.w / 2 + (p.key.dx || 0);
    key = { x0, x1: x0 + p.key.w, d: p.key.d, xc: x0 + p.key.w / 2, toe: !!p.key.toeEnd };
  }
  const dn = Math.max(key ? key.d : 0, beam ? beam.d : 0);
  const out: Point2D[] = [];
  if (beam)
    out.push(
      [0, -beam.d],
      [beam.w, -beam.d],
      [beam.w + beam.d, 0],
      [B - beam.w - beam.d, 0],
      [B - beam.w, -beam.d],
      [B, -beam.d],
    );
  else {
    out.push([0, 0]);
    if (key) out.push([key.x0, 0], [key.x0, -key.d], [key.x1, -key.d], [key.x1, 0]);
    out.push([B, 0]);
  }
  out.push([B, tH]);
  if (hn > 0) out.push([xbb + hn, tH]);
  if (fil > 0) out.push([xbb + fil, p.tBase], [xbb, p.tBase + fil]);
  else out.push([xbb, p.tBase]);
  let xcap = xbt;
  if (cap) {
    const yc = yTop - cap.hv - cap.hs;
    xcap = t + cap.w;
    out.push([xb(yc), yc], [xcap, yTop - cap.hv], [xcap, yTop]);
  } else {
    if (vt > 0) out.push([xbt, yTop - vt]);
    out.push([xbt, yTop]);
  }
  out.push([xft, yTop]);
  if (fil > 0) out.push([t, p.tBase + fil], [t - fil, p.tBase]);
  else out.push([t, p.tBase]);
  if (tf > 0) out.push([tf, p.tTip]);
  out.push([0, p.tTip]);
  const ribs: GeomRibSpan[] = [],
    yR = yTop - p.rib.drop;
  let hyp: GeomRibHyp | null = null;
  if (p.type === 'rib') {
    const rt = p.rib.t,
      gap = p.rib.gap;
    const n = Math.max(1, Math.floor((p.Lu - 2 * p.rib.edge + gap) / (gap + rt) + 1e-9));
    const start = (p.Lu - (n * rt + (n - 1) * gap)) / 2;
    for (let i = 0; i < n; i++)
      ribs.push({ x0: start + i * (rt + gap), x1: start + i * (rt + gap) + rt });
    const T: Point2D = [xb(yR), yR],
      E: Point2D = [B - (p.rib.end || 0), p.rib.end ? tH : p.tpl === 'B' ? tH : p.tBase];
    hyp = {
      T,
      E,
      tri: hn > 0 ? [T, [xbb, p.tBase], [xbb + hn, tH], E] : [T, [xbb, p.tBase], E],
    };
  }
  const G: EngineGeomData = {
    t,
    B,
    yTop,
    xbb,
    xbt,
    xb,
    xf,
    xft,
    sf,
    key,
    beam,
    cap,
    fil,
    xcap,
    dn,
    out,
    ribs,
    yR,
    hyp,
    c: p.cover,
    tH,
    topY,
    an: null,
    dxt: dn,
  };
  if (ancOn(p) && p.anc && p.Lu > 0) {
    G.an = ancGrid(p, G);
    G.dxt = Math.max(dn, G.an.Lb);
  }
  return G;
}

export function rolesOf(p: EngineProject): string[] {
  if (p.tpl === 'C') return ancOn(p) ? [...C_MARKS.map(ckey), 'an'] : C_MARKS.map(ckey);
  if (p.tpl === 'D') return D_ROLES(p);
  const base = ['s1', 's2', 'h1', 'b1', 'b2', 'l1'];
  if (p.type === 'rib') base.push('r1', 'r2', 'r3');
  if (p.type !== 'rib' || p.tpl === 'B') base.push('t1');
  if (keyOn(p)) base.push('k1');
  if (ancOn(p)) base.push('an');
  if (beamOn(p) && p.rb.e1) base.push('e1');
  return base;
}

export function calcFill(P: Pick<EngineProject, 'fillMode' | 'fillH'>): FillParams {
  const fm = P.fillMode || 'none',
    fh = Math.max(0, P.fillH || 0) / 100;
  if (fm === 'none' || !(fh > 0)) return { Hs: 0, m: 1.5, mode: 'none' };
  if (fm === 'flat') return { Hs: fh, m: 0, mode: 'flat' };
  return { Hs: fh, m: parseFloat(fm), mode: fm };
}

export function calcGeomP(P: EngineProject, fill?: FillParams): EngineCalcGeomData {
  fill = fill || calcFill(P);
  const g0 = geom(P),
    k = 0.01;
  const yF = Math.max(P.tBase, g0.tH, P.tTip) * k;
  const out: Point2D[] = g0.out.map((p) => [p[0] * k, p[1] * k]);
  const foot = clipPolyY(out, yF, false),
    stem = clipPolyY(out, yF, true);
  const B = g0.B * k,
    yT = g0.yTop * k;
  const xf = (y: number) => g0.xf(y / k) * k,
    xb = (y: number) => g0.xb(y / k) * k;
  const xfb = xf(yF),
    xbb = xb(yF),
    xft = g0.xft * k,
    xbt = (g0.cap ? g0.xcap : g0.xbt) * k;
  const topF = (x: number) => g0.topY(x / k) * k;
  const { Hs, m } = fill;
  const yG = (x: number) =>
    x <= xbt ? yT : yT + (Hs > 1e-9 ? Math.min(Hs, (x - xbt) / Math.max(m, 1e-9)) : 0);
  const A: Point2D = [B, 0],
    T: Point2D = [B, yG(B)],
    Hp = T[1];
  const slopeReach = Hs > 1e-9 && xbt + m * Hs > B + 1e-9;
  const Gv: Point2D[] = [T];
  if (slopeReach) Gv.push([xbt + m * Hs, yT + Hs]);
  const betaV = slopeReach ? rad2deg(Math.atan(1 / m)) : 0;
  const O = g0.out,
    iB = O.findIndex((p) => Math.abs(p[0] - g0.B) < 1e-6 && Math.abs(p[1] - g0.tH) < 1e-6);
  const iT = O.findIndex((p, i) => i > iB && Math.abs(p[1] - g0.yTop) < 1e-6);
  const back: Point2D[] = O.slice(iB, iT + 1).map((p) => [p[0] * k, p[1] * k]);
  const ev: Point2D[] = [T];
  if (Hs > 1e-9 && xbt + m * Hs < B - 1e-9) ev.push([xbt + m * Hs, yT + Hs]);
  back
    .slice()
    .reverse()
    .forEach((p) => ev.push(p));
  const Hst = yT - yF,
    As = Math.abs(signedPolyArea(stem));
  const front: Point2D[] = [
    [0, 0],
    [0, topF(0)],
  ];
  for (let i = 1; i <= 8; i++) {
    const x = (xfb * i) / 8;
    front.push([x, topF(x)]);
  }
  for (let i = 1; i <= 12; i++) {
    const y = yF + ((yT - yF) * i) / 12;
    front.push([xf(y), y]);
  }
  return {
    B,
    Bs: B,
    eps: 0,
    C0: [B / 2, 0],
    yF,
    yT,
    tb: xbb - xfb,
    xfb,
    xbb,
    xft,
    xbt,
    xf,
    xb,
    topF,
    yG,
    A,
    T,
    Hp,
    Gv,
    betaV,
    foot,
    stem,
    ev,
    Hst,
    tmean: Hst > 0 ? As / Hst : 0,
    back,
    hf: 0,
    g0,
    front,
  };
}

export function areaClipY(pts: Point2D[], y0: number, up: boolean): number {
  const inside = (q: Point2D) => (up ? q[1] >= y0 - 1e-9 : q[1] <= y0 + 1e-9),
    o: Point2D[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i],
      b = pts[(i + 1) % pts.length],
      ia = inside(a),
      ib = inside(b);
    if (ia) o.push(a);
    if (ia !== ib) {
      const t = (y0 - a[1]) / (b[1] - a[1]);
      o.push([a[0] + t * (b[0] - a[0]), y0]);
    }
  }
  return o.length < 3 ? 0 : polyArea(o);
}

// ---------------------------------------------------------------------------
// Template B Helpers
// ---------------------------------------------------------------------------

export const tieY0 = (p: Pick<EngineProject, 'tBase'>): number => p.tBase + 80;

export const tieY1 = (
  p: Pick<EngineProject, 'cover'>,
  g: Pick<EngineGeomData, 'yTop' | 'topY'>,
  x?: number,
): number => (x === undefined ? g.yTop - p.cover : g.topY(x) - p.cover);

export function tieRowsB(p: EngineProject, g: EngineGeomData): number[] {
  const c = p.cover,
    stp = (p.rb.t1 && p.rb.t1.a) || 100,
    rows: number[] = [];
  for (let y = g.yTop - c; y >= p.tBase + 80 - 1e-6; y -= stp) rows.push(y);
  if (!rows.length) rows.push(p.tBase + p.H / 2);
  return rows;
}

export function tieXsB(p: EngineProject, g: EngineGeomData): number[] {
  const c = p.cover,
    B = g.B;
  let xs: number[];
  if (p.tieCad && Array.isArray(p.tieCad) && p.tieCad.length > 1 && p.tieB)
    xs = p.tieCad.map((x) => c + ((x - 7.5) * (B - 2 * c)) / (p.tieB! - 15));
  else {
    const xa = c + 100,
      xb = B - c - 100,
      ni = xb > xa ? Math.max(1, Math.ceil((xb - xa) / 350 - 1e-9)) : 0;
    xs = ni ? Array.from({ length: ni + 1 }, (_, i) => xa + ((xb - xa) * i) / ni) : [B / 2];
  }
  return xs.map((x) => Math.min(B - c, Math.max(c, x)));
}

export function b2PathB(p: EngineProject, g: EngineGeomData): Point2D[] {
  const c = p.cover,
    B = g.B,
    t = g.t,
    h = hkB(p.rb.b2.d),
    ts = (x: number) => g.topY(x) - c;
  return [
    [c, ts(c) - h],
    [c, ts(c)],
    [t + c, p.tBase - c],
    [g.xbb - c, p.tBase - c],
    [B - c, ts(B - c)],
    [B - c, ts(B - c) - h],
  ];
}

export function ringB(
  p: EngineProject,
  g: EngineGeomData,
): { stem: RingPointTuple[]; slab: RingPointTuple[] } {
  const c = p.cover,
    rb = p.rb,
    B = g.B,
    yT = g.yTop,
    xbb = g.xbb,
    tB = p.tBase,
    on = (k: string) => Boolean(rb[k] && rb[k].on !== false);
  const aS = Math.max(5, rb.h1.a || 20),
    aL = Math.max(5, rb.l1.a || 20),
    dH = rb.h1.d,
    dL = rb.l1.d;
  const dS1 = rb.s1.d,
    dS2 = rb.s2.d,
    d3 = rb.b1.d,
    d4 = rb.b2.d,
    dT = on('t1') ? rb.t1.d : 0,
    dK = rb.k1 ? rb.k1.d : 16;
  const off = (dv: number, dd: number) => (dv + dd) / 20;
  const split = (L: number, a: number) => Math.max(1, Math.ceil(L / a - 0.1));
  const stem: RingPointTuple[] = [],
    slab: RingPointTuple[] = [];
  const sl = (g.xf(yT) - g.xf(yT - 100)) / 100,
    sq = Math.sqrt(1 + sl * sl);
  const oB = off(dS1, dH),
    oF = off(dS2, dH),
    o3H = off(d3, dH),
    o4H = off(d4, dH);
  const xB = xbb - c - oB,
    xFr = (y: number) => g.xf(y) + c + oF * sq;
  const rowS = tB - c - o4H,
    botB = c + Math.max(o3H, oB),
    botF = c + Math.max(o3H, oF),
    topB = yT - c - Math.max(oB, oF),
    topF = topB;
  const tr = on('t1') ? tieRowsB(p, g) : [],
    clrT = off(dT, dH) + 0.05;
  const nudge = (y: number) => {
    for (const yr of tr) if (Math.abs(y - yr) < clrT) return yr - clrT;
    return y;
  };
  const chainY = (yTop: number, yBot: number): [number, number][] => {
    const r: [number, number][] = [];
    if (yTop - rowS > 1) {
      const n1 = split(yTop - rowS, aS);
      for (let i = 0; i <= n1; i++) r.push([yTop + ((rowS - yTop) * i) / n1, -1]);
    } else r.push([yTop, -1]);
    const yr = r[r.length - 1][0],
      n2 = split(yr - yBot, aS);
    for (let i = 1; i <= n2; i++) r.push([yr + ((yBot - yr) * i) / n2, i === n2 ? 1 : 0]);
    return r;
  };
  chainY(topB, botB).forEach(([y, k]) => stem.push([xB, nudge(y), -1, k]));
  chainY(topF, botF).forEach(([y, k]) => stem.push([xFr(y), nudge(y), 1 / sq, -sl / sq + k]));

  const o3L = off(d3, dL),
    o4L = off(d4, dL),
    oTL = dT ? off(dT, dL) : 0;
  const xl = c + Math.max(o3L, o4L, oTL),
    xr = B - xl,
    yb = c + o3L;
  const V4 = b2PathB(p, g).slice(1, 5);
  const seg4 = (x: number) => {
    let k = 0;
    while (k < V4.length - 2 && x > V4[k + 1][0]) k++;
    return k;
  };
  const y4 = (x: number) => {
    const k = seg4(x),
      A = V4[k],
      Bq = V4[k + 1],
      f = Bq[0] > A[0] ? (x - A[0]) / (Bq[0] - A[0]) : 0;
    return A[1] + (Bq[1] - A[1]) * f;
  };
  const slp = (x: number) => {
    let m = 0,
      sg = 0;
    for (let k = 0; k + 1 < V4.length; k++) {
      const A = V4[k],
        Bq = V4[k + 1];
      if (Bq[0] - A[0] < 1e-9) continue;
      if (x >= A[0] - 1 && x <= Bq[0] + 1) {
        const s = (Bq[1] - A[1]) / (Bq[0] - A[0]);
        if (Math.abs(s) >= m) {
          m = Math.abs(s);
          sg = s;
        }
      }
    }
    return sg;
  };
  const yTopRow = (x: number) => {
    const s = slp(x);
    return y4(x) - o4L * Math.sqrt(1 + s * s);
  };
  const nTop = (x: number): Point2D => {
    const s = slp(x),
      q = Math.sqrt(1 + s * s);
    return [s / q, -1 / q];
  };
  const rowX = (xa: number, xb: number) => {
    const n = split(xb - xa, aL),
      r: number[] = [];
    for (let i = 1; i < n; i++) r.push(xa + ((xb - xa) * i) / n);
    return r;
  };
  const arcX = (xa: number, xb: number) => {
    if (xb - xa < 1e-6) return [];
    const N = 400,
      xs: number[] = [],
      cum: number[] = [0];
    for (let i = 0; i <= N; i++) xs.push(xa + ((xb - xa) * i) / N);
    for (let i = 1; i <= N; i++)
      cum.push(cum[i - 1] + Math.hypot(xs[i] - xs[i - 1], yTopRow(xs[i]) - yTopRow(xs[i - 1])));
    const L = cum[N],
      n = split(L, aL),
      r: number[] = [];
    for (let k = 1; k < n; k++) {
      const tg = (L * k) / n;
      let j = 1;
      while (j < N && cum[j] < tg) j++;
      const f = (tg - cum[j - 1]) / (cum[j] - cum[j - 1] || 1);
      r.push(xs[j - 1] + (xs[j] - xs[j - 1]) * f);
    }
    return r;
  };
  const vlines = (yAt: number): [number, number, number | null][] => {
    const V: [number, number, number | null][] = [];
    if (on('t1'))
      tieXsB(p, g).forEach((x) => {
        if (x > c + 1 && x < B - c - 1) V.push([x, dT, null]);
      });
    if (g.key && on('k1')) V.push([g.key.x0 + c, dK, 50], [g.key.x1 - c, dK, 50]);
    V.push([xbb - c, dS1, null], [g.xf(yAt) + c, dS2, null]);
    return V;
  };
  const avoid = (xs: number[], lo: number, hi: number, yOf: (x: number) => number) =>
    xs.map((x): [number] | [number, number, number] => {
      const y = yOf(x),
        V = vlines(y).filter((v) => v[2] === null || y <= v[2] + 1);
      for (const v of V) {
        const clr = off(v[1], dL) + 0.05;
        if (Math.abs(x - v[0]) < clr) {
          const cand = [v[0] - clr, v[0] + clr]
            .filter((q) => q > lo + 0.25 * aL && q < hi - 0.25 * aL)
            .sort((m, n) => Math.abs(m - x) - Math.abs(n - x));
          x = cand.length ? cand[0] : x < v[0] ? v[0] - clr : v[0] + clr;
        }
      }
      const nv = V.filter((v) => Math.abs(x - v[0]) < 6).sort(
        (m, n) => Math.abs(x - m[0]) - Math.abs(x - n[0]),
      )[0];
      return nv ? [x, nv[0], nv[1]] : [x];
    });
  const fixedX = (ys: number[]) => {
    const xf0 = xFr(ys[0]),
      xs = [xl, xf0, xB, xr].filter(
        (v, i, a) => i === 0 || i === a.length - 1 || (v > xl + 1 && v < xr - 1),
      );
    return xs.sort((m, n) => m - n);
  };
  const FB = fixedX([botF]),
    FT = fixedX([rowS]);
  slab.push([xl, yb, 1, 1], [xr, yb, -1, 1]);
  for (let i = 0; i + 1 < FB.length; i++)
    avoid(rowX(FB[i], FB[i + 1]), FB[i], FB[i + 1], () => yb).forEach(([x, vx, vd]) =>
      slab.push([x, yb, 0, 1, vx, vd]),
    );
  {
    const ytl = yTopRow(xl),
      ytr = yTopRow(xr),
      nl = nTop(xl),
      nr = nTop(xr);
    slab.push([xl, ytl, 1 + nl[0], nl[1]], [xr, ytr, -1 + nr[0], nr[1]]);
    for (let i = 0; i + 1 < FT.length; i++)
      avoid(arcX(FT[i], FT[i + 1]), FT[i], FT[i + 1], (x) => yTopRow(x)).forEach(([x, vx, vd]) => {
        const n = nTop(x);
        slab.push([x, yTopRow(x), n[0], n[1], vx, vd]);
      });
    const col = (x: number, sx: number, y0: number, y1: number) => {
      const n = split(y1 - y0, aL);
      for (let i = 1; i < n; i++) slab.push([x, y0 + ((y1 - y0) * i) / n, sx, 0]);
    };
    col(xl, 1, yb, ytl);
    col(xr, -1, yb, ytr);
  }
  if (g.key) {
    const k = g.key,
      oK = off(dK, dL),
      xa = k.x0 + c + oK,
      xz = k.x1 - c - oK,
      yk = -k.d + c + oK;
    if (xz - xa > 0.5) {
      slab.push([xa, yk, 1, 1], [xz, yk, -1, 1]);
      rowX(xa, xz).forEach((x) => slab.push([x, yk, 0, 1]));
      for (let y = yk + aL; y <= -5 + 1e-6; y += aL) slab.push([xa, y, 1, 0], [xz, y, -1, 0]);
    } else slab.push([(xa + xz) / 2, yk, 0, 1]);
  }
  return { stem, slab };
}

// ---------------------------------------------------------------------------
// Template C Helpers
// ---------------------------------------------------------------------------

export function keyLayoutC(p: EngineProject, g: EngineGeomData, off = 2): EngineKeyLayoutC {
  const k = g.key!,
    c = p.cover,
    a = Math.max(5, (p.rb.c2 && p.rb.c2.a) || 20),
    rows: number[] = [],
    ties: number[] = [],
    yb = -(k.d - c);
  for (let y = -9.7; y >= -(k.d - 9) - 1e-6; y -= a) rows.push(y);
  const yLim = -(k.d - 9.1);
  if (rows[rows.length - 1] - yLim > 0.35 * a) rows.push(yLim);
  rows.forEach((y, i) => {
    if (i >= 2 && i % 2 === 0 && y + off > yb + 8) ties.push(y + off);
  });
  return { xl: k.x0 + c, xr: k.x1 - c, yb, rows, ties, a };
}

// ---------------------------------------------------------------------------
// Template D Helpers
// ---------------------------------------------------------------------------

export function dLayers(p: EngineProject): EngineDLayers {
  const c = p.cover,
    rb = p.rb,
    tB = p.tBase;
  const yb1 = c + rb.b1.d / 20,
    ylo = c + rb.b1.d / 10 + rb.l1.d / 20,
    yb2 = tB - c - rb.b2.d / 20,
    yup = tB - c - rb.b2.d / 10 - rb.l1.d / 20;
  return {
    yb1,
    ylo,
    yb2,
    yup,
    yf1: ylo + rb.l1.d / 20 + rb.s1.d / 20,
    yf2: ylo + rb.l1.d / 20 + rb.s2.d / 20,
  };
}

export function dRingXs(B: number, a: number, m: number): number[] {
  const xs: number[] = [];
  for (let x = m; x < B - m - 0.5 * a - 1e-9; x += a) xs.push(x);
  xs.push(B - m);
  return xs;
}

export function dRing(p: EngineProject, g: Pick<EngineGeomData, 'B'>): Point2D[] {
  const c = p.cover,
    rb = p.rb,
    L = dLayers(p),
    a = rb.l1.a || 20,
    m = c + 2.5,
    xs = dRingXs(g.B, a, m),
    pts: Point2D[] = [];
  xs.forEach((x) => pts.push([x, L.ylo]));
  xs.forEach((x) => pts.push([x, L.yup]));
  for (let y = L.ylo + a; y < L.yup - a / 2 - 1e-9; y += a) {
    pts.push([m, y]);
    pts.push([g.B - m, y]);
  }
  return pts;
}

export const dAnchors = (p: EngineProject, g: EngineGeomData): AnchorGrid => g.an || ancGrid(p, g);

export function dRibDiag(
  p: EngineProject,
  g: EngineGeomData,
  xf: number,
  xe: number,
  yfl: number,
): EngineBarDiagLine[] {
  const { T, E } = g.hyp!,
    rb = p.rb,
    c = p.cover,
    d = rb.r1.d,
    a = rb.r1.a || 20,
    ux = E[0] - T[0],
    uy = E[1] - T[1],
    L = Math.hypot(ux, uy),
    u: Point2D = [ux / L, uy / L];
  const nn: Point2D = [-Math.abs(u[1]), -Math.abs(u[0])];
  const dc = (xf - T[0]) * nn[0] + (p.tBase - T[1]) * nn[1],
    out: EngineBarDiagLine[] = [];
  for (let k = 0; k < 200; k++) {
    const off = c + d / 20 + k * a;
    if (off > dc + 1e-6) break;
    const P0: Point2D = [T[0] + nn[0] * off, T[1] + nn[1] * off],
      sA = (xf - P0[0]) / u[0],
      A: Point2D = [xf, P0[1] + u[1] * sA];
    const sB = Math.min((yfl - P0[1]) / u[1], (xe - P0[0]) / u[0]),
      Bp: Point2D = [P0[0] + u[0] * sB, P0[1] + u[1] * sB];
    if (Bp[0] - A[0] < 5) continue;
    out.push({ k, A, B: Bp, len: Math.hypot(Bp[0] - A[0], Bp[1] - A[1]) });
  }
  return out;
}
