import { type EngineBarsResult, type EngineProject, isB, isC, isD } from '../engine';
import type {
  BarsResult,
  CadContext,
  CadSheet,
  CadSheetDef,
  Project,
  QuantitiesResult,
} from '../types/project';
import { resetDimId } from './dimCallout';
import { Ents } from './ents';
import { DIMSTY, PAPER, SCALES } from './layers';
import { notesFor, viewBarShapes, viewBarTable, viewSummary } from './viewsSchedule';
import {
  viewBaseRebar,
  viewElevation,
  viewElevRebar,
  viewPlan,
  viewRibPlanCut,
  viewSection,
  viewSectionRebar,
} from './viewsCommon';
import { viewSectionRebarB } from './viewsTemplateB';
import { viewSectionRebarC } from './viewsTemplateC';
import {
  viewDrillD,
  viewElevationD,
  viewElevRebarD,
  viewLuoi3D,
  viewPlanD,
  viewSectionD,
  viewSectionRebarD,
  viewSlabPlanD,
} from './viewsTemplateD';

export const MARGIN = 8;

export function viewRibCut(p: Project, res: BarsResult, ctx: CadContext): Ents {
  return isB(p) ? viewSectionRebarB(p, res, ctx, 'rib') : viewSectionRebar(p, res, ctx, 'rib');
}

export const SHEET_DEFS: CadSheetDef[] = [
  {
    name: 'CHI TIẾT TƯỜNG CHẮN',
    views: (p, r, _q, c) =>
      isD(p)
        ? [viewSectionD(p, r, c), viewElevationD(p, r, c), viewPlanD(p, r, c)]
        : [viewSection(p, r, c), viewElevation(p, r, c), viewPlan(p, r, c)],
  },
  {
    name: 'BỐ TRÍ THÉP TƯỜNG CHẮN (1)',
    views: (p, r, _q, c) =>
      isD(p)
        ? [
            viewSectionRebarD(p, r, c, 'mid'),
            ...(p.type === 'rib' ? [viewSectionRebarD(p, r, c, 'rib')] : []),
            viewLuoi3D(p, r, c),
          ]
        : isB(p)
          ? p.type === 'rib'
            ? [viewSectionRebarB(p, r, c), viewRibCut(p, r, c), viewRibPlanCut(p, r, c)]
            : [viewSectionRebarB(p, r, c)]
          : isC(p)
            ? [viewSectionRebarC(p, r, c, 'plain'), viewSectionRebarC(p, r, c, 'rib')]
            : p.type === 'rib'
              ? [
                  viewSectionRebar(p, r, c, 'bay'),
                  viewRibCut(p, r, c),
                  viewRibPlanCut(p, r, c),
                  viewElevRebar(p, r, c, 'back'),
                ]
              : [
                  viewSectionRebar(p, r, c, 'bay'),
                  viewElevRebar(p, r, c, 'back'),
                  viewElevRebar(p, r, c, 'front'),
                ],
  },
  {
    name: 'BỐ TRÍ THÉP TƯỜNG CHẮN (2)',
    views: (p, r, _q, c) =>
      isD(p)
        ? [
            viewElevRebarD(p, r, c),
            viewSlabPlanD(p, r, c),
            ...(r.g.an ? [viewDrillD(p, r, c)] : []),
          ]
        : [
            ...(isB(p)
              ? [
                  viewElevRebar(p, r, c, 'back'),
                  viewElevRebar(p, r, c, 'front'),
                  viewBaseRebar(p, r, c, 'top'),
                  viewBaseRebar(p, r, c, 'bottom'),
                ]
              : isC(p)
                ? [
                    viewElevRebar(p, r, c, 'front'),
                    viewRibPlanCut(p, r, c),
                    viewBaseRebar(p, r, c, 'bottom'),
                  ]
                : p.type === 'rib'
                  ? [
                      viewBaseRebar(p, r, c, 'top'),
                      viewBaseRebar(p, r, c, 'bottom'),
                      viewElevRebar(p, r, c, 'front'),
                    ]
                  : [viewBaseRebar(p, r, c, 'top'), viewBaseRebar(p, r, c, 'bottom')]),
            ...(r.g.an ? [viewDrillD(p, r, c)] : []),
          ],
  },
  {
    name: 'CHI TIẾT CÁC THANH THÉP',
    noScale: true,
    views: (p, r, q, c) => [viewBarShapes(p, r, q, c)],
  },
  {
    name: 'BẢNG THỐNG KÊ KHỐI LƯỢNG',
    noScale: true,
    views: (p, r, q, c) =>
      isB(p) ? [viewBarTable(p, r, q, c)] : [viewBarTable(p, r, q, c), viewSummary(p, r, q, c)],
  },
];

export interface PlacedView {
  E: Ents;
  dx: number;
  dy: number;
}

export interface LayoutResult {
  pl: PlacedView[];
  bottom: number;
}

export function layoutViews(views: readonly Ents[], width: number, gap: number): LayoutResult {
  let x = 0;
  let top = 0;
  let rowH = 0;
  const pl: PlacedView[] = [];
  for (const E of views) {
    const bb = E.bbox();
    if (x + bb.w > width + 1e-6 && x > 0) {
      x = 0;
      top -= rowH + gap;
      rowH = 0;
    }
    pl.push({ E, dx: x - bb.x0, dy: top - bb.h - bb.y0 });
    x += bb.w + gap;
    rowH = Math.max(rowH, bb.h);
  }
  return { pl, bottom: top - rowH };
}

export function buildCluster(
  pIn: Project | EngineProject,
  resIn: BarsResult | EngineBarsResult,
  q: QuantitiesResult,
  idx: number,
  S: number,
): CadSheet {
  const p = pIn as Project;
  const res = resIn as BarsResult;
  const def = SHEET_DEFS[idx];
  const [pw, ph] = PAPER[p.paper] || PAPER.A1;
  const ctx: CadContext = {
    S,
    mm: (v) => (v * S) / 10,
    dst: DIMSTY[p.tpl] || DIMSTY.B,
    legFull: p.dimLeg === 'full',
    geoHit: true,
    tplA: p.tpl === 'A' || p.tpl === 'D',
    tang: true,
    dotLy: 'RDOTW',
    rDot: 0.6,
    rCap:
      0.3 *
      (p.tpl === 'C'
        ? Math.min(p.rb.c2?.a || 20, p.rb.c5?.a || 20)
        : Math.min(p.rb.h1?.a ?? 20, p.rb.l1?.a ?? 20)),
  };
  const views = def.views(p, res, q, ctx) as Ents[];
  const width = ctx.mm(pw - 2 * MARGIN);
  const gap = ctx.mm(10);
  const lay = layoutViews(views, width, gap);
  const nt = notesFor(p, idx, ctx);
  const E = new Ents();
  lay.pl.forEach((o) => E.add(o.E, o.dx, o.dy));
  const bb0 = E.bbox();
  if (nt.a.length) E.add(nt, bb0.x0, bb0.y0 - gap);
  const bb = E.bbox();
  const mg = ctx.mm(MARGIN);
  const F = new Ents();
  F.add(E, mg - bb.x0, mg - bb.y0);
  const W = bb.w + 2 * mg;
  const H = bb.h + 2 * mg;
  return {
    E: F,
    W,
    H,
    S,
    fits: W <= ctx.mm(pw) + 1e-6 && H <= ctx.mm(ph) + 1e-6,
    name: def.name,
    noScale: !!def.noScale,
    dst: ctx.dst,
  };
}

export function autoScale(
  p: Project | EngineProject,
  res: BarsResult | EngineBarsResult,
  q: QuantitiesResult,
): number {
  if (p.scale) return p.scale;
  let need = SCALES[0];
  SHEET_DEFS.forEach((d, i) => {
    if (d.noScale) return;
    const s = SCALES.find((S) => buildCluster(p, res, q, i, S).fits);
    need = Math.max(need, s || SCALES[SCALES.length - 1]);
  });
  return need;
}

export function buildSheet(
  p: Project | EngineProject,
  res: BarsResult | EngineBarsResult,
  q: QuantitiesResult,
  idx: number,
  S?: number,
): CadSheet {
  return buildCluster(p, res, q, idx, S || autoScale(p, res, q));
}

export function buildAllSheets(
  p: Project | EngineProject,
  res: BarsResult | EngineBarsResult,
  q: QuantitiesResult,
  S?: number,
): CadSheet[] {
  const scale = S || autoScale(p, res, q);
  resetDimId(0);
  return SHEET_DEFS.map((_, i) => buildCluster(p, res, q, i, scale));
}
