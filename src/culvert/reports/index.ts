/**
 * BangTinhCauCong Web App — Unified Visual Report Barrel & Hook Registration
 *
 * Clean-room barrel exporting all structural, geotechnical, bridge, culvert,
 * retaining wall, hydrology, and DEM SVG/3D report builders along with
 * `registerDefaultVisualHooks()` and `resetVisualReportHooksForTest()`.
 *
 * Clean-room standalone implementation with zero external CDN URLs.
 */

import {
  clearVisualHooks,
  getVisualHooks,
  registerVisualHooks,
  type VisualReportHooks,
} from '../engine/context.ts';
import { qdFigs } from '../engine/bridge/approachSlabFigs.ts';
import { damRender } from '../engine/bridge/girderHollowRender.ts';
import { mathAll } from '../graphics/texMath.ts';
import { getBridgeReportHooks } from './bridgeReports.ts';
import { getCulvertWallReportHooks } from './culvertWallReports.ts';
import { getFoundationReportHooks } from './foundationReports.ts';
import {
  getHydroDemReportHooks,
  hvStMap,
  type HydroDemReportHooks,
} from './hydroDemReports.ts';

export * from './foundationReports.ts';
export * from './culvertWallReports.ts';
export * from './hydroDemReports.ts';
export * from './bridgeReports.ts';

/**
 * Combined default visual report hooks type including the extended
 * `renderBridgeStationMap` hook consumed by `src/engine/hydrology/bridgeHydro.ts`.
 */
export type DefaultVisualReportHooks = VisualReportHooks &
  Pick<HydroDemReportHooks, 'renderBridgeStationMap'> & {
    /** Bản quá độ: vẽ 7 hình SVG (`approachSlabFigs.ts`); `qdStep` gọi hook này sau khi tính xong. */
    renderApproachSlab?: (payload: { result: Parameters<typeof qdFigs>[0] }) => void;
  };

/**
 * Build the complete merged visual report hooks object combining foundations,
 * culverts/walls, hydrology/DEM, all 6 bridge modules, station map rendering,
 * and headless-safe MathJax reflow (`renderMath`).
 */
export function getDefaultVisualHooks(): Partial<DefaultVisualReportHooks> {
  return {
    ...getFoundationReportHooks(),
    ...getCulvertWallReportHooks(),
    ...getHydroDemReportHooks(),
    ...getBridgeReportHooks(),
    renderBridgeStationMap: hvStMap,
    renderApproachSlab: ({ result }) => qdFigs(result),
    // Dầm bản rỗng DƯL: hình vẽ (bridgeReports) + bảng số liệu / kết quả kiểm toán (`damRender`, chuyển từ bản gốc)
    renderGirderHollow: (payload) => {
      const hooks = getBridgeReportHooks();
      hooks.renderGirderHollow?.(payload);
      const res = payload?.result as
        | { I?: unknown; LIM?: unknown; GG?: Record<string, unknown>; g?: unknown; b?: unknown }
        | undefined;
      if (!res || !res.I || !res.LIM || !res.GG) return;
      for (const k of ['g', 'b'] as const) {
        const R = res[k];
        const G = res.GG[k];
        if (!R || !G) continue;
        try {
          damRender(k, R, res.I, G, res.LIM);
        } catch (err) {
          console.error(err);
        }
      }
    },
    renderMath: () => {
      if (typeof document === 'undefined') return;
      try {
        mathAll();
      } catch (err) {
        console.error(err);
      }
    },
  };
}

/**
 * Register all default visual report hooks on the engine registry (`context.ts`)
 * and return the active hook registry snapshot.
 */
export function registerDefaultVisualHooks(): VisualReportHooks {
  const hooks = getDefaultVisualHooks();
  registerVisualHooks(hooks);
  return getVisualHooks();
}

/**
 * Clear all registered visual report hooks (for deterministic unit/parity tests).
 */
export function resetVisualReportHooksForTest(): void {
  clearVisualHooks();
}
