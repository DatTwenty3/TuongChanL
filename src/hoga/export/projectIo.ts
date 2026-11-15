import type { GaConfig, GaRow, HoGaProject } from '../engine/types';
import { GA_KINDS } from '../engine/types';
import { defaultConfig, defaultProject } from '../engine/defaults';

export const PROJECT_EXT = '.hoga.json';

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Gộp `patch` lên `base` theo cấu trúc của `base` (khoá lạ bị bỏ, kiểu sai bị bỏ). */
export function deepMerge<T>(base: T, patch: unknown): T {
  if (Array.isArray(base)) {
    if (!Array.isArray(patch)) return base;
    return base.map((b, i) => (i < patch.length ? deepMerge(b, patch[i]) : b)) as unknown as T;
  }
  if (isObj(base)) {
    if (!isObj(patch)) return base;
    const out: Json = {};
    for (const k of Object.keys(base)) out[k] = k in patch ? deepMerge(base[k], patch[k]) : base[k];
    return out as T;
  }
  if (typeof base === typeof patch) return patch as T;
  return base;
}

export function serializeProject(p: HoGaProject): string {
  return JSON.stringify({ format: 'ledat-hoga', version: 1, project: p }, null, 1);
}

function catalogOf(v: unknown, fallback: HoGaProject['catalog']): HoGaProject['catalog'] {
  if (!isObj(v)) return fallback;
  const arr = <K extends keyof HoGaProject['catalog']>(k: K): HoGaProject['catalog'][K] => (Array.isArray(v[k]) ? (v[k] as HoGaProject['catalog'][K]) : fallback[k]);
  return { round: arr('round'), box: arr('box'), ditch: arr('ditch') };
}

export function parseProject(text: string): HoGaProject {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Tệp không phải JSON hợp lệ.');
  }
  const p = isObj(data) && isObj(data.project) ? data.project : isObj(data) ? data : null;
  if (!p || typeof p.kind !== 'string' || !(p.kind in GA_KINDS)) throw new Error('Tệp dự án không đúng định dạng (thiếu loại ga).');
  const kind = p.kind as HoGaProject['kind'];
  const base = defaultProject(kind);
  const rows: GaRow[] = Array.isArray(p.rows) ? (p.rows as unknown[]).map((r) => deepMerge(base.rows[0], r) as GaRow) : base.rows;
  const config: GaConfig = deepMerge(defaultConfig(kind), p.config);
  return {
    kind,
    title: typeof p.title === 'string' ? p.title : base.title,
    rows,
    config,
    catalog: catalogOf(p.catalog, base.catalog),
    angles: isObj(p.angles) ? ({ ...base.angles, ...(p.angles as Record<string, number>) }) : base.angles,
  };
}

export const baseName = (title: string): string =>
  (title || 'ho-ga')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .slice(0, 40)
    .replace(/[^\w]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'ho_ga';
