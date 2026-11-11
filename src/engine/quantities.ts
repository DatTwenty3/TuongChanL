/**
 * Material quantity takeoff (`quantities`) — concrete volume by member, lean
 * concrete blinding, formwork area, steel mass & length by diameter, and steel
 * density ratio (kg/m3), ported faithfully from `01_project_geom.js#L999-1077`.
 */

import { areaClipY } from './geom.ts';
import { clamp, polyArea, unitW } from './presets.ts';
import { buildBars } from './rebar.ts';
import type {
  BarsResult,
  EngineBarsResult,
  EngineProject,
  QuantitiesResult,
} from './types.ts';

export function quantities(
  p: EngineProject,
  res: BarsResult | EngineBarsResult = buildBars(p),
): QuantitiesResult {
  const g = res.g;
  const Lu = p.Lu;
  const out = g.out;
  const yb = Math.max(p.tBase, g.tH, p.tTip);
  const aKey = g.dn > 0 ? areaClipY(out, 0, false) : 0;
  const aFoot = areaClipY(out, yb, false) - aKey;
  const aStem = areaClipY(out, yb, true);
  const nR = p.type === 'rib' && g.hyp ? g.ribs.length : 0;
  const rt = nR ? p.rib.t : 0;
  const aRib = nR && g.hyp ? polyArea(g.hyp.tri) : 0;

  const conc = {
    foot: (aFoot * Lu) / 1e6,
    stem: (aStem * Lu) / 1e6,
    key: (aKey * Lu) / 1e6,
    rib: (aRib * rt * nR) / 1e6,
    tot: 0,
  };
  conc.tot = conc.foot + conc.stem + conc.key + conc.rib;
  const vol = conc.tot;

  const tl = p.blindOn === false ? 0 : p.tBlind || 0;
  const blind = tl > 0 ? (g.B * tl * Lu) / 1e6 : 0;
  const bay = Lu - nR * rt;

  let fFoot = 0;
  let fStem = 0;
  for (let i = 0; i < out.length; i++) {
    const a = out[i];
    const b = out[(i + 1) % out.length];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const L = Math.hypot(dx, dy);
    if (L < 1e-6 || (a[1] <= 1e-6 && b[1] <= 1e-6)) continue;
    if (Math.abs(dx) / L > 0.866) continue;
    const stem = (a[1] + b[1]) / 2 > yb + 1e-6;
    let A = L * Lu;
    if (nR && stem && dy > 0.5 * L) {
      const f = clamp((g.yR - a[1]) / (b[1] - a[1]), 0, 1);
      A = L * (1 - f) * Lu + L * f * bay;
    }
    if (stem) fStem += A;
    else fFoot += A;
  }

  const ends = p.formEnds !== false;
  if (ends) {
    fFoot += 2 * (aFoot + aKey);
    fStem += 2 * aStem;
  }
  let fRib = 0;
  if (nR && g.hyp) {
    const T = g.hyp.T;
    const E = g.hyp.E;
    const hl = Math.hypot(E[0] - T[0], E[1] - T[1]);
    fRib = (2 * aRib + (Math.abs(E[0] - T[0]) / hl <= 0.866 ? hl * rt : 0)) * nR;
  }

  const form = { foot: fFoot / 1e4, stem: fStem / 1e4, rib: fRib / 1e4, ends, tot: 0 };
  form.tot = form.foot + form.stem + form.rib;

  const byD: Record<number, { len: number; kg: number }> = {};
  let totKg = 0;
  res.bars.forEach((b) => {
    const len = b.items.reduce((s, v) => s + v, 0) / 1e3;
    const kg = len * unitW(b.d);
    b.totLen = len;
    b.kg = kg;
    b.minL = Math.min(...b.items);
    b.maxL = Math.max(...b.items);
    byD[b.d] = byD[b.d] || { len: 0, kg: 0 };
    byD[b.d].len += len;
    byD[b.d].kg += kg;
    totKg += kg;
  });

  return {
    vol,
    conc,
    blind,
    form,
    byD,
    totKg,
    ratio: totKg / vol,
  };
}
