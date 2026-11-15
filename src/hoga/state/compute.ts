import { useMemo } from 'react';
import type { HoGaProject } from '../engine/types';
import { computeAll, summarize, type GaResult, type ThklItem } from '../engine/summary';
import { validateRow, type Warning } from '../engine/validate';
import { GA_KINDS } from '../engine/types';

export interface Computed {
  results: GaResult[];
  items: ThklItem[];
  warnings: Warning[][];
}

const cache = new WeakMap<HoGaProject, Computed>();

export function compute(p: HoGaProject): Computed {
  const hit = cache.get(p);
  if (hit) return hit;
  const info = GA_KINDS[p.kind];
  const results = computeAll(p);
  const out: Computed = {
    results,
    items: summarize(p, results),
    warnings: p.rows.map((r) => validateRow(r, p.config, p.catalog, info)),
  };
  cache.set(p, out);
  return out;
}

export function useComputed(p: HoGaProject): Computed {
  return useMemo(() => compute(p), [p]);
}
