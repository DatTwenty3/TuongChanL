/** Hình cốt thép cổ ga cho tờ 4: mặt bằng thép cổ (hai vòng thép, thanh đứng là chấm) và mặt cắt A-A / B-B của cổ. */
import { Builder } from './ents';
import { fmtMm, rectPoly, type Ctx, type Pt, type View } from './views';
import { leaderNote, sectionBubble } from './viewsVhg';
import { parseRebar } from '../engine/parse';
import { spaced } from '../engine/rebar';

/** `n` điểm chia đều theo chu vi hình tròn bán kính r hoặc hình chữ nhật a × b (tâm 0,0). */
function perimeterPoints(round: boolean, a: number, bw: number, n: number): Pt[] {
  const out: Pt[] = [];
  if (round) {
    for (let i = 0; i < n; i++) out.push([(a / 2) * Math.cos((2 * Math.PI * i) / n), (a / 2) * Math.sin((2 * Math.PI * i) / n)]);
    return out;
  }
  const per = 2 * (a + bw);
  for (let i = 0; i < n; i++) {
    let t = (i * per) / n;
    if (t < a) out.push([-a / 2 + t, bw / 2]);
    else if ((t -= a) < bw) out.push([a / 2, bw / 2 - t]);
    else if ((t -= bw) < a) out.push([a / 2 - t, -bw / 2]);
    else out.push([-a / 2, -bw / 2 + (t - a)]);
  }
  return out;
}

export function neckPlan(c: Ctx, s: number): View | null {
  const n = c.neck;
  if (!n) return null;
  const b = new Builder(s);
  const { cfg, row } = c;
  const t = row.neck.t;
  const cn = cfg.cover.neck;
  const outer = (k: number): [number, number, number] => [n.a + 2 * k, n.b + 2 * k, 0];
  const draw = (k: number): void => {
    const [oa, ob] = outer(k);
    if (n.round) b.circle('KC', 0, 0, oa / 2);
    else b.rect('KC', -oa / 2, -ob / 2, oa / 2, ob / 2);
  };
  draw(0);
  draw(t);
  // vòng thép (đai ngang) và thanh đứng (chấm): lớp ngoài cách mặt ngoài `cn`, lớp trong cách mặt trong `cn`
  const o = parseRebar(row.neck.out);
  const i2 = parseRebar(row.neck.in);
  const ring = (k: number, layer: 'THEP' | 'THEP2'): void => {
    const [oa, ob] = outer(k);
    if (n.round) b.circle(layer, 0, 0, oa / 2);
    else b.rect(layer, -oa / 2, -ob / 2, oa / 2, ob / 2);
  };
  if (o) ring(t - cn, 'THEP');
  if (i2) ring(cn, 'THEP');
  const nv = (g: RegExp): number => c.res.rebar.groups.filter((q) => q.part === 'neck' && g.test(q.label)).reduce((m, q) => Math.max(m, q.count), 0);
  const nOut = nv(/lớp ngoài – thép đứng/);
  const nIn = nv(/lớp trong – thép đứng/);
  const dotR = Math.max(b.paper(0.45), 3);
  if (o && nOut > 0) for (const [x, y] of perimeterPoints(n.round, n.a + 2 * (t - cn - o.dia), n.b + 2 * (t - cn - o.dia), nOut)) b.circle('THEP', x, y, dotR, true);
  if (i2 && nIn > 0) for (const [x, y] of perimeterPoints(n.round, n.a + 2 * (cn + i2.dia), n.b + 2 * (cn + i2.dia), nIn)) b.circle('THEP', x, y, dotR, true);
  // đường tim + kích thước
  const ext = b.paper(6);
  const hw = (n.a + 2 * t) / 2;
  const hh = (n.round ? n.a + 2 * t : n.b + 2 * t) / 2;
  b.line('TIM', -hw - ext, 0, hw + ext, 0);
  b.line('TIM', 0, -hh - ext, 0, hh + ext);
  b.dimH(-n.a / 2, n.a / 2, hh + b.paper(8), hh, fmtMm(n.a));
  b.dimH(-hw, hw, hh + b.paper(15), hh, fmtMm(n.a + 2 * t));
  b.dimV(-hh, hh, hw + b.paper(8), hw, fmtMm(2 * hh));
  sectionBubble(b, 0, hh + b.paper(22), 'A', 'l');
  sectionBubble(b, 0, -hh - b.paper(12), 'A', 'l');
  sectionBubble(b, -hw - b.paper(12), 0, 'B', 'u');
  sectionBubble(b, hw + b.paper(24), 0, 'B', 'u');
  if (o) leaderNote(b, hw - t / 2, hh * 0.3, hw + b.paper(14), hh * 0.55, `Ø${o.dia}${cfg.fmt.densSym}${o.spacing}`, 1, true);
  return { id: 'neckPlan', title: 'MẶT BẰNG THÉP CỔ GA', ents: b.ents };
}

export function neckSection(c: Ctx, s: number, id: 'A' | 'B'): View | null {
  const n = c.neck;
  if (!n) return null;
  const b = new Builder(s);
  const { cfg, row } = c;
  const t = row.neck.t;
  const h = row.neck.h;
  const w = id === 'A' ? n.a : n.round ? n.a : n.b;
  const cn = cfg.cover.neck;
  const left = rectPoly(-w / 2 - t, 0, -w / 2, h);
  const right = rectPoly(w / 2, 0, w / 2 + t, h);
  b.hatchPat([left, right], 'ANSI32', 4);
  b.hatchPat([left, right], 'AR-CONC', 0.4);
  b.poly('KC', left, true);
  b.poly('KC', right, true);
  const o = parseRebar(row.neck.out);
  const i2 = parseRebar(row.neck.in);
  for (const sg of [-1, 1]) {
    if (o) b.line('THEP', sg * (w / 2 + t - cn), 0, sg * (w / 2 + t - cn), h - cn);
    if (i2) b.line('THEP', sg * (w / 2 + cn), 0, sg * (w / 2 + cn), h - cn);
  }
  const rings = (spec: ReturnType<typeof parseRebar>, x: number): void => {
    if (!spec) return;
    for (const p of spaced(h - 2 * cn, spec.spacing + cfg.neck.horizAdj, cfg.fmt.mesh).pos) b.circle('THEP', x, cn + p, Math.max(b.paper(0.45), 3), true);
  };
  for (const sg of [-1, 1]) {
    rings(o, sg * (w / 2 + t - cn - (o?.dia ?? 0)));
    rings(i2, sg * (w / 2 + cn + (i2?.dia ?? 0)));
  }
  b.line('TIM', 0, -b.paper(3), 0, h + b.paper(4));
  b.dimH(-w / 2, w / 2, -b.paper(8), 0, fmtMm(w));
  b.dimH(-w / 2 - t, w / 2 + t, -b.paper(15), 0, fmtMm(w + 2 * t));
  b.dimV(0, h, w / 2 + t + b.paper(8), w / 2 + t, fmtMm(h));
  if (o) leaderNote(b, w / 2 + t - cn, h * 0.6, w / 2 + t + b.paper(16), h * 0.8, `Ø${o.dia}${cfg.fmt.densSym}${o.spacing}`, 1, true);
  return { id: `neckSection${id}`, title: `MẶT CẮT ${id}-${id}`, ents: b.ents };
}
