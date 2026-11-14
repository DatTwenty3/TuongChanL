/**
 * BangTinhCauCong Web App — Bridge Superstructure, Abutment & Pier Visual Reports
 *
 * Clean-room TypeScript implementation of Step 5.6 (part 4) connecting `VisualReportHooks`
 * in `src/engine/context.ts` to SVG diagram generators, headless fallbacks, and MathJax
 * reflow for all 6 bridge solver modules:
 *  - Hollow / RC Slab Girder (`girderHollow.ts`): `damDrawCS`, `damDraw`, `damDrawLL`,
 *    `damDrawCharts`, `rcgSecSvg`, `rcgElevSvg`, `rcgCharts`, `renderGirderHollowVisuals`
 *  - Post-Tensioned I-Girder (`girderI.ts`): `renderGirderIVisuals` (reuses `GID` + `damDrawCS`)
 *  - Heavy Gravity Abutment (`abutmentHeavy.ts`): `drawMo`, `drawMoT`, `drawCsm`, `drawCS`,
 *    `renderAbutmentHeavyVisuals` (+ `sfCapFig` for shallow footing caps)
 *  - Flexible Abutment (`abutmentFlex.ts`): `renderAbutmentFlexVisuals` (reuses `mdDraw`,
 *    `mdCapDraw`, `mdThan`, `mdWingAll`, `mdContour`)
 *  - Flexible Multi-Column Pier (`pierFlex.ts`): `drawPierFlexSummarySvg`, `renderPierFlexVisuals`
 *  - Solid Pier (`pierSolid.ts`): `drawPierSolidSummarySvg`, `renderPierSolidVisuals` (+ `sfCapFig`)
 *
 * Strictly null-safe and headless-safe (`typeof document !== 'undefined'`).
 * Clean-room standalone implementation with zero external CDN URLs.
 */

import type {
  AbutmentResult,
  GirderResult,
  PierResult,
  Point2D,
} from '../types/project.ts';
import {
  fx,
  num,
  registerVisualHooks,
  setOutputValue,
  type VisualReportHooks,
} from '../engine/context.ts';
import {
  DGSTY,
  dgChart,
  dgDefs,
  dgKit,
  dgPut,
  svgKit,
  vSvg,
  xEdges,
} from '../graphics/svgPrimitives.ts';
import { mathAll } from '../graphics/texMath.ts';
import { IPAN, ITOP, moXF, spXF } from '../engine/bridge/crossfall.ts';
import {
  evalDamLimits,
  getLatestDamResult,
  getLatestLim,
  getLatestRcgResult,
  girderInputs,
  supK,
  type DamCalcResult,
  type DamCompositeResult,
  type DamGirderInput,
  type DamLimits,
  type DamSpInput,
  type RcCalcResult,
  type RcInput,
} from '../engine/bridge/girderHollow.ts';
import {
  GID,
  getLatestGirResult,
  type GiCompositeResult,
} from '../engine/bridge/girderI.ts';
import {
  MO,
  getLatestCapResult,
  getLatestMorResult,
  getLatestRcmResult,
  moInputs,
  type CapRuntimeState,
  type MoCalcResult,
  type MoInput,
  type RcMRuntimeState,
} from '../engine/bridge/abutmentHeavy.ts';
import {
  getLatestMdCapResult,
  getLatestMdStmResult,
  mdCapDraw,
  mdDraw,
  mdOn,
  mdThan,
  mdWingAll,
  moHKtab,
  type MdCapRuntimeState,
  type MdStmRuntimeState,
  type MdWingResult,
} from '../engine/bridge/abutmentFlex.ts';
import {
  getLatestTrCheck,
  getLatestTrResult,
  trFigEl,
  trFigIL,
  trFigLane,
  trFigMod,
  trFigSec,
  type TrCalcResult,
  type TrCheckResult,
} from '../engine/bridge/pierFlex.ts';
import {
  getLatestDcResult,
  getLatestDcSfdResult,
  type DcCalcResult,
  type DcSfCapFigDescriptor,
} from '../engine/bridge/pierSolid.ts';
import {
  renderShallowFdnFigsHook,
  sfCapFig,
  type ShallowCapLoadInput,
  type ShallowCapMetaInput,
} from './foundationReports.ts';

// ---------------------------------------------------------------------------
// 0. Null-Safe & Headless-Safe DOM / SVG / MathJax Helpers
// ---------------------------------------------------------------------------

export type BridgeSvgTarget = SVGElement | string | null | undefined;

export interface BridgeGirderShapeMeta {
  dd: Point2D[];
  voids?: ReadonlyArray<readonly number[]>;
  H: number;
  noJoint?: boolean;
  lbl?: string;
  de?: number;
}

export interface GirderHollowBranchVisuals {
  sec: string;
  elv: string;
  ll: string;
  charts: Record<string, string>;
}

export interface GirderHollowVisualResult {
  type: 'PC' | 'RC';
  crossSectionSvg: string;
  branches: Partial<Record<'g' | 'b', GirderHollowBranchVisuals>>;
  rendered: boolean;
}

export interface GirderIVisualResult {
  crossSectionSvg: string;
  secMiddleSvg: string;
  cabMiddleSvg: string;
  secEdgeSvg: string;
  cabEdgeSvg: string;
  rendered: boolean;
}

export interface AbutmentHeavyVisualResult {
  kind: 'mo' | 'rc' | 'cap' | 'summary';
  dgMo?: string;
  dgMoT?: string;
  dgCsm?: string;
  dgMoCS?: string;
  dgSfCap6?: string;
  rcSummarySvg?: string;
  rendered: boolean;
}

export interface AbutmentFlexVisualResult {
  kind: 'mo' | 'mdCap' | 'mdWing' | 'mdThan' | 'mdWingAll' | 'summary';
  longitudinal?: string;
  elevation?: string;
  loads?: string;
  cap?: string;
  diagrams?: Record<string, string>;
  wxSvg?: string;
  wySvg?: string;
  thanSvg?: string;
  wingSvgs?: Record<string, string>;
  rendered: boolean;
}

export interface PierVisualResult {
  summarySvg: string;
  sfCapSvg?: string;
  rendered: boolean;
}

export interface BridgeSummaryVisuals {
  girderHollow: GirderHollowVisualResult | null;
  girderI: GirderIVisualResult | null;
  abutmentHeavy: AbutmentHeavyVisualResult | null;
  abutmentFlex: AbutmentFlexVisualResult | null;
  pierFlex: PierVisualResult | null;
  pierSolid: PierVisualResult | null;
}

function hasDom(): boolean {
  return typeof document !== 'undefined';
}

function resolveDomElement(id: string): HTMLElement | null {
  if (!hasDom()) return null;
  return document.getElementById(id);
}

function resolveRealSvg(target: BridgeSvgTarget, defaultId: string): SVGElement | null {
  if (target === null) return null;
  if (target !== undefined) {
    if (typeof target !== 'string') return target;
    const el = resolveDomElement(target);
    return el && typeof el.setAttribute === 'function' ? (el as unknown as SVGElement) : null;
  }
  const el = resolveDomElement(defaultId);
  return el && typeof el.setAttribute === 'function' ? (el as unknown as SVGElement) : null;
}

function storeSvgOutput(target: BridgeSvgTarget, defaultId: string, svg: string): void {
  if (target === undefined) {
    setOutputValue(defaultId, svg);
  } else if (typeof target === 'string') {
    setOutputValue(target, svg);
  } else if (target && typeof target === 'object' && 'id' in target && target.id) {
    setOutputValue(String(target.id), svg);
  }
}

function writeDirectSvg(
  target: BridgeSvgTarget,
  defaultId: string,
  W: number,
  H: number,
  inner: string,
  attrW?: number,
  attrH?: number,
): string {
  const hr = Math.round(H);
  const wAttr = Math.round(attrW ?? W);
  const hAttr = Math.round(attrH ?? hr);
  const sv = resolveRealSvg(target, defaultId);
  if (sv) {
    sv.setAttribute?.('viewBox', `0 0 ${W} ${hr}`);
    sv.setAttribute?.('width', String(wAttr));
    sv.setAttribute?.('height', String(hAttr));
    sv.innerHTML = inner;
  }
  const fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${hr}" width="${wAttr}" height="${hAttr}">${inner}</svg>`;
  storeSvgOutput(target, defaultId, fullSvg);
  return fullSvg;
}

function applyRcgSvg(
  id: string,
  W: number,
  H: number,
  body: string,
  target?: BridgeSvgTarget,
): string {
  const hr = Math.round(H);
  const inner = `${DGSTY}${dgDefs(id)}<rect width="${W}" height="${hr}" fill="#fff"/>${body}`;
  const fullSvg = `<svg class="dg" xmlns="http://www.w3.org/2000/svg" id="${id}" width="${W}" height="${hr}" viewBox="0 0 ${W} ${hr}" role="img">${inner}</svg>`;
  const sv = resolveRealSvg(target, id);
  if (sv) {
    sv.setAttribute?.('width', String(W));
    sv.setAttribute?.('height', String(hr));
    sv.setAttribute?.('viewBox', `0 0 ${W} ${hr}`);
    sv.innerHTML = inner;
  }
  storeSvgOutput(target, id, fullSvg);
  return fullSvg;
}

function runMathSafe(rootId?: string): void {
  if (!hasDom()) return;
  try {
    const root = rootId ? resolveDomElement(rootId) : null;
    mathAll((root as ParentNode | null) ?? document);
  } catch {
    // Non-blocking in partial/headless test environments
  }
}

function escSvg(raw: string | number | null | undefined): string {
  return String(raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function propNum(obj: unknown, key: string, fallback = 0): number {
  if (!obj || typeof obj !== 'object') return fallback;
  const raw = (obj as Record<string, unknown>)[key];
  if (raw === undefined || raw === null || raw === '') return fallback;
  const val = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.'));
  return Number.isFinite(val) ? val : fallback;
}

// ---------------------------------------------------------------------------
// 1. Bridge Superstructure: Hollow PC, RC Slab & I-Girder SVGs (`04`, `05`, `10`)
// ---------------------------------------------------------------------------

/**
 * Draw full bridge deck transverse cross-section (`#dgSpCS`) for hollow PC,
 * RC slab, or prestressed I-girder bridges including crossfall & precast panels.
 */
export function damDrawCS(
  I: DamSpInput | null | undefined,
  Gg: BridgeGirderShapeMeta | null | undefined,
  Gb?: BridgeGirderShapeMeta | null,
  target?: BridgeSvgTarget,
): string {
  if (!I || !Gg || !Array.isArray(Gg.dd) || Gg.dd.length < 3 || !(I.Wb > 0)) {
    return '';
  }
  const edgeMeta = Gb && Array.isArray(Gb.dd) && Gb.dd.length >= 3 ? Gb : Gg;
  const id = 'SpCS';
  const Wb = I.Wb * 1000;
  const Wpa = I.Wpa * 1000;
  const Ng = Math.max(1, Math.round(I.Ng));
  const S = I.S * 1000;
  const H = Gg.H || 650;
  const hs = I.hs * 1000;
  const Hpa = I.Hpa * 1000;
  const Hra = ((I as unknown as { Hra?: number }).Hra ?? num('sp_Hra')) * 1000;
  const Hsu = I.Hsu * 1000;
  const tpanInput = (I as unknown as { tpan?: number }).tpan;
  const tpI = Gg.noJoint && Ng > 1 ? ((tpanInput ?? num('gi_tpan')) || 0) * 1000 : 0;
  const IGg = ITOP(Gg.dd, H);
  const IGb = ITOP(edgeMeta.dd, H);
  const HS = H + (tpI > 0 ? Math.max(0, tpI - IGg.h6) : 0);

  const W = 760;
  const k = (W - 150) / Math.max(Wb, 1);
  const x0 = 60;
  const ytop = 70;
  const y0 = ytop + (Hra + Hpa + Hsu + hs + HS) * k;
  const X = (x: number) => x0 + (x + Wb / 2) * k;
  const Y = (y: number) => y0 - y * k;
  const d = dgKit(id);

  const xc = (i: number) => (i - (Ng - 1) / 2) * S;
  const mir = (P: readonly Point2D[]): Point2D[] => P.map(([x, y]) => [-x, y] as Point2D).reverse();
  const XS = spXF(I);
  const dDm = (x: number) => XS.XF.dD(x / 1000) * 1000;
  const gB = XS.g.dGc != null;
  const gDm = (i: number) => (gB ? (XS.g.dGc ?? 0) * 1000 : dDm(xc(i)));
  const ysW: number[] = [
    -Wb / 2,
    ...(XS.XF.yc * 1000 > -Wb / 2 && XS.XF.yc * 1000 < Wb / 2 ? [XS.XF.yc * 1000] : []),
    Wb / 2,
  ];

  const girders: Array<{
    P: Point2D[];
    vd: number[][];
    ed: boolean;
  }> = [];
  for (let i = 0; i < Ng; i++) {
    const ed = (i === 0 || i === Ng - 1) && Ng > 1;
    const G = ed ? edgeMeta : Gg;
    let P = G.dd;
    if (i === Ng - 1 && Ng > 1) P = mir(P);
    const vd = (G.voids || []).map((v) => [
      i === Ng - 1 && Ng > 1 ? -v[0] : v[0],
      ...v.slice(1),
    ]);
    girders.push({
      P: P.map(([x, y]) => [x + xc(i), y] as Point2D),
      vd: vd.map((v) => [v[0] + xc(i), ...v.slice(1)]),
      ed,
    });
  }

  // Longitudinal cast-in-place joints between girders
  for (let i = 0; i + 1 < Ng && !Gg.noJoint; i++) {
    const A = girders[i].P;
    const B = girders[i + 1].P;
    const L1: Point2D[] = [];
    const R1: Point2D[] = [];
    for (let y = 4; y <= H; y += 4) {
      const ea = xEdges(A, Math.min(y, H - 0.01));
      const eb = xEdges(B, Math.min(y, H - 0.01));
      if (!ea.length || !eb.length) continue;
      const xa = ea[ea.length - 1];
      const xb = eb[0];
      if (xb - xa > 0.5) {
        const dj = (gDm(i) + gDm(i + 1)) / 2;
        L1.push([X(xa), Y(y - dj)]);
        R1.push([X(xb), Y(y - dj)]);
      }
    }
    if (L1.length > 1) d.poly([...L1, ...R1.reverse()], `url(#hD${id})`, 't');
  }

  girders.forEach((g, i) => {
    const dz = gDm(i);
    d.poly(
      g.P.map(([x, y]) => [X(x), Y(y - dz)] as Point2D),
      `url(#hC${id})`,
    );
    g.vd.forEach((v) => {
      d.s += vSvg([v[0], v[1] - dz, ...v.slice(2)], X, Y, k);
    });
  });

  if (tpI > 0) {
    const lab = IPAN({
      xg: Array.from({ length: Ng }, (_, i) => xc(i)),
      geo: Array.from({ length: Ng }, (_, i) => ((i === 0 || i === Ng - 1) && Ng > 1 ? IGb : IGg)),
      tp: tpI,
      zgt: (i) => H - gDm(i),
      zsb: (x) => (gB ? HS - (XS.g.dGc ?? 0) * 1000 : HS - dDm(x)),
      xL: -Wb / 2,
      xR: Wb / 2,
      P: (x, z) => [X(x), Y(z)],
      poly: (p, f) => d.poly(p, f),
      fp: '#c9d6e3',
      fd: `url(#hD${id})`,
    });
    if (lab) {
      const xm = lab[0];
      const ym = Y(lab[1]);
      d.L(X(xm), ym, X(xm), ym + 58, 't');
      d.T(X(xm), ym + 70, 'Tấm BTCT đúc sẵn', 'middle', 'class="s"');
      d.T(
        X(xm),
        ym + 84,
        `tp = ${fx(tpI, 0)} (kê lên gờ dưới cánh dầm)`,
        'middle',
        'class="s"',
      );
    }
  }

  // Deck slab & wearing course
  if (gB) {
    d.poly(
      [
        ...ysW.map((x) => [X(x), Y(HS + hs - dDm(x))] as Point2D),
        [X(Wb / 2), Y(HS - (XS.g.dGc ?? 0) * 1000)],
        [X(-Wb / 2), Y(HS - (XS.g.dGc ?? 0) * 1000)],
      ],
      `url(#hD${id})`,
    );
  } else {
    d.poly(
      [
        ...ysW.map((x) => [X(x), Y(HS + hs - dDm(x))] as Point2D),
        ...ysW
          .slice()
          .reverse()
          .map((x) => [X(x), Y(HS - dDm(x))] as Point2D),
      ],
      `url(#hD${id})`,
    );
  }

  const WPL = (I.WPL || 0) * 1000;
  const tPL = WPL > 0 ? (I.APL > 0 ? Math.min(400, (I.APL / 2 / (WPL / 1000)) * 1000) : 250) : 0;
  if (Hsu > 0) {
    const xa = -Wb / 2 + Wpa + WPL;
    const xb = Wb / 2 - Wpa - WPL;
    const pp = [xa, ...ysW.filter((x) => x > xa && x < xb), xb];
    d.poly(
      [
        ...pp.map((x) => [X(x), Y(HS + hs + Hsu - dDm(x))] as Point2D),
        ...pp
          .slice()
          .reverse()
          .map((x) => [X(x), Y(HS + hs - dDm(x))] as Point2D),
      ],
      '#bbb',
      't',
    );
    [-1, 1].forEach((sg) => {
      const ii = sg < 0 ? XS.XF.iL : XS.XF.iR;
      if (!ii) return;
      const x = (XS.XF.yc * 1000 + sg * (Wb / 2 - Wpa)) / 2;
      d.T(X(x), Y(HS + hs + Hsu - dDm(x)) - 8, `${fx(Math.abs(ii), 1)}%`, 'middle', 'class="s"');
    });
  }

  if (WPL > 0) {
    [-1, 1].forEach((sg) => {
      const xa = sg < 0 ? -Wb / 2 + Wpa : Wb / 2 - Wpa - WPL;
      d.poly(
        [
          [X(xa), Y(HS + hs)],
          [X(xa + WPL), Y(HS + hs)],
          [X(xa + WPL), Y(HS + hs + tPL)],
          [X(xa), Y(HS + hs + tPL)],
        ],
        `url(#hP${id})`,
      );
    });
  }

  const yb = HS + hs;
  [-1, 1].forEach((sg) => {
    const xo = (sg * Wb) / 2;
    const xi = sg * (Wb / 2 - Wpa);
    const wt = Math.min(Wpa, 200);
    const m = -sg;
    const dz = dDm(xo);
    const P = (
      WPL > 0
        ? [
            [xo, yb],
            [xo, yb + Hpa],
            [xo + m * wt, yb + Hpa],
            [xo + m * wt, yb + tPL],
            [xi, yb + tPL],
            [xi, yb],
          ]
        : [
            [xo, yb],
            [xo, yb + Hpa],
            [xo + m * wt, yb + Hpa],
            [xo + m * (wt + 60), yb + Hpa * 0.55],
            [xi, yb + Hpa * 0.12],
            [xi, yb],
          ]
    ).map(([x, y]) => [X(x), Y(y - dz)] as Point2D);
    d.poly(P, `url(#hD${id})`);
    if (Hra > 0) {
      const xp = X(xo + m * wt * 0.5);
      d.s += `<rect class="l" x="${(xp - 4).toFixed(1)}" y="${Y(yb + Hpa + Hra - dz).toFixed(1)}" width="8" height="${(Hra * k).toFixed(1)}" style="fill:#fff"/><circle class="l" cx="${xp.toFixed(1)}" cy="${(Y(yb + Hpa + Hra - dz) + 6).toFixed(1)}" r="5" style="fill:#fff"/>`;
    }
  });

  d.L(X(0), 48, X(0), Y(0) + 8, 'c');
  d.T(X(0) + 5, Y(yb + Hpa * 0.5), 'Tim cầu', 'start');

  // Top horizontal dimensions
  d.dimH(X(-Wb / 2), X(Wb / 2), 18, `Wb = ${fx(Wb, 0)}`, Y(yb + Hpa));
  d.dimH(X(-Wb / 2), X(-Wb / 2 + Wpa), 40, fx(Wpa, 0));
  d.dimH(X(Wb / 2 - Wpa), X(Wb / 2), 40, fx(Wpa, 0));
  if (WPL > 0) {
    d.dimH(X(-Wb / 2 + Wpa), X(-Wb / 2 + Wpa + WPL), 40, fx(WPL, 0));
    d.dimH(X(Wb / 2 - Wpa - WPL), X(Wb / 2 - Wpa), 40, fx(WPL, 0));
  }
  d.dimH(
    X(-Wb / 2 + Wpa + WPL),
    X(Wb / 2 - Wpa - WPL),
    40,
    `W = ${fx(Wb - 2 * Wpa - 2 * WPL, 0)} (${I.nL} làn thiết kế)`,
  );
  [-Wb / 2 + Wpa, Wb / 2 - Wpa, -Wb / 2 + Wpa + WPL, Wb / 2 - Wpa - WPL].forEach((x) =>
    d.L(X(x), 36, X(x), Y(yb + Math.max(tPL, Hpa * 0.12)) - 2),
  );

  // Bottom dimensions: girder spacing & de
  const yS = Y(0) + 40;
  const ed = Wb / 2 - ((Ng - 1) * S) / 2;
  for (let i = 0; i < Ng; i++) d.L(X(xc(i)), Y(0) + 20, X(xc(i)), yS + 4, 'd');
  d.dimH(X(-Wb / 2), X(xc(0)), yS, fx(ed, 0));
  if (Ng > 1) {
    d.dimH(
      X(xc(0)),
      X(xc(Ng - 1)),
      yS,
      `${Ng - 1} x S = ${Ng - 1} x ${fx(S, 0)} = ${fx((Ng - 1) * S, 0)}`,
    );
  }
  d.dimH(X(xc(Ng - 1)), X(Wb / 2), yS, fx(ed, 0));
  d.L(X(-Wb / 2), Y(0), X(-Wb / 2), yS + 4);
  d.L(X(Wb / 2), Y(0), X(Wb / 2), yS + 4);
  if (edgeMeta.de != null && Ng > 1) {
    const xcurb = -Wb / 2 + Wpa + WPL;
    const xweb = xcurb - edgeMeta.de;
    const yD = yS + 30;
    d.L(X(xweb), Y(H * 0.5), X(xweb), yD + 4, 'd');
    d.L(X(xcurb), Y(yb), X(xcurb), yD + 4, 'd');
    d.dimH(Math.min(X(xweb), X(xcurb)), Math.max(X(xweb), X(xcurb)), yD, '');
    d.T(
      Math.max(X(xweb), X(xcurb)) + 6,
      yD + 4,
      `de = ${fx(edgeMeta.de, 0)} mm (tim sườn ngoài dầm biên → mép trong ${
        WPL > 0 ? 'bó vỉa lề đi bộ' : 'gờ lan can'
      }; âm khi sườn nằm phía ngoài)`,
      'start',
      'class="s"',
    );
  }

  // Right vertical dimensions
  const xv = X(Wb / 2) + 24;
  if (Hra > 0) d.dimV(xv, Y(yb + Hpa + Hra), Y(yb + Hpa), `Hra = ${fx(Hra, 0)}`);
  d.dimV(xv, Y(yb + Hpa), Y(yb), `Hpa = ${fx(Hpa, 0)}`);
  d.dimV(xv, Y(yb), Y(HS), `ts = ${fx(hs, 0)}`);
  if (HS > H + 1e-6) d.dimV(xv, Y(HS), Y(H), fx(HS - H, 0));
  d.dimV(xv, Y(H), Y(0), `H = ${fx(H, 0)}`);

  const yN = Y(0) + (edgeMeta.de != null && Ng > 1 ? 104 : 76);
  d.T(X(xc(0)), Y(0) + 15, 'Dầm biên', 'middle', 'class="s"');
  if (Ng > 1) d.T(X(xc(Ng - 1)), Y(0) + 15, 'Dầm biên', 'middle', 'class="s"');
  if (Ng > 2) d.T(X(xc(Math.floor((Ng - 1) / 2))), Y(0) + 15, 'Dầm giữa', 'middle', 'class="s"');
  d.T(
    W / 2,
    yN,
    `Mặt cắt ngang: ${Ng} ${Gg.lbl || (Gg.noJoint ? 'dầm I BTCT DƯL' : 'dầm bản rỗng')} H = ${fx(H, 0)} ; ts = ${fx(hs, 0)} ; gờ Wpa = ${fx(Wpa, 0)}${
      WPL > 0 ? ` ; lề đi bộ WPL = ${fx(WPL, 0)}` : ''
    } (mm)`,
    'middle',
    'font-style="italic"',
  );

  const svg = dgPut(resolveRealSvg(target, 'dgSpCS'), W, yN + 14, d.s, id);
  storeSvgOutput(target, 'dgSpCS', svg);
  return svg;
}

/**
 * Draw HL-93 live-load influence line placement (`#dg${k}LL`) for hollow PC or RC slab girders.
 */
export function damDrawLL(
  k: string,
  R: { Ls: number; xv: number; type?: string } | null | undefined,
  I?: Pick<DamSpInput, 'sup'> | null,
  target?: BridgeSvgTarget,
): string {
  if (!R || !(R.Ls > 0)) return '';
  const defaultId = `dg${k}LL`;
  const id = `${k}LL`;
  const Lm = R.Ls / 1000;
  const W = 740;
  const x0 = 60;
  const kx = (W - 120) / Lm;
  const X = (x: number) => x0 + x * kx;
  const d = dgKit(id);

  const truck: ReadonlyArray<readonly [number, number]> = [
    [0, 35],
    [4.3, 145],
    [8.6, 145],
  ];
  const truckR: ReadonlyArray<readonly [number, number]> = [
    [0, 145],
    [4.3, 145],
    [8.6, 35],
  ];
  const tandem: ReadonlyArray<readonly [number, number]> = [
    [0, 110],
    [1.2, 110],
  ];

  const Mi = (x: number, a: number) =>
    a < 0 || a > Lm ? 0 : a <= x ? (a * (Lm - x)) / Lm : (x * (Lm - a)) / Lm;
  const Vi = (x: number, a: number) =>
    a < 0 || a > Lm ? 0 : a < x ? -a / Lm : (Lm - a) / Lm;

  const best = (x: number, f: (xx: number, aa: number) => number) => {
    let b: {
      v: number;
      nm: string;
      veh: ReadonlyArray<readonly [number, number]>;
      pos: number;
    } = { v: -1e9, nm: 'Xe tải thiết kế', veh: truck, pos: 0 };
    for (const [nm, veh] of [
      ['Xe tải thiết kế', truck] as const,
      ['Xe tải thiết kế', truckR] as const,
      ['Xe hai trục thiết kế', tandem] as const,
    ]) {
      for (let pos = -9; pos <= Lm + 0.001; pos += 0.01) {
        const v = veh.reduce(
          (t, [p, w]) => t + w * f(x, pos + p + (f === Vi ? 1e-6 : 0)),
          0,
        );
        if (v > b.v + 1e-9) b = { v, nm, veh, pos };
      }
    }
    return b;
  };

  const panel = (
    y0: number,
    x: number,
    f: (xx: number, aa: number) => number,
    title: string,
    unit: string,
    lane: readonly [number, number],
  ): number => {
    const b = best(x, f);
    const ext = Math.max(1e-6, f === Mi ? (x * (Lm - x)) / Lm : Math.max((Lm - x) / Lm, x / Lm));
    d.T(20, y0 + 14, title, 'start', 'font-weight="bold"');

    const yg = y0 + 92;
    d.s += `<rect class="l" x="${X(0)}" y="${yg}" width="${(Lm * kx).toFixed(1)}" height="10" style="fill:url(#hC${id})"/>`;
    d.s += `<polygon class="t" points="${X(0)},${yg + 10} ${X(0) - 7},${yg + 22} ${X(0) + 7},${yg + 22}" style="fill:#fff"/><circle class="t" cx="${X(Lm)}" cy="${yg + 16}" r="6" style="fill:#fff"/>`;

    const la = lane[0];
    const lb = lane[1];
    const yl = yg - 22;
    d.L(X(la), yl, X(lb), yl);
    const nArr = Math.max(2, Math.round((lb - la) / 0.9));
    for (let i = 0; i <= nArr; i++) {
      const xx = la + ((lb - la) * i) / nArr;
      d.A(X(xx), yl, X(xx), yg - 2);
    }
    d.T(X((la + lb) / 2), yl - 4, 'Tải trọng làn 9,3 kN/m', 'middle', 'class="s"');

    const ax = b.veh
      .map(([p, w]) => [b.pos + p, w] as const)
      .filter(([a]) => a >= 0 && a <= Lm);
    ax.forEach(([a, w]) => {
      d.A(X(a), y0 + 30, X(a), yl - 14);
      d.T(X(a), y0 + 27, `${fx(w, 0)} kN`, 'middle', 'class="s"');
    });
    for (let i = 0; i + 1 < ax.length; i++) {
      d.dimH(X(ax[i][0]), X(ax[i + 1][0]), y0 + 44, `${fx(ax[i + 1][0] - ax[i][0], 1)} m`);
    }

    const yA = yg + 42;
    const sc = 58 / ext;
    const Yv = (v: number) => yA + v * sc;
    d.L(X(0), yA, X(Lm), yA);
    const pts: Point2D[] =
      f === Mi
        ? [
            [0, 0],
            [x, Mi(x, x)],
            [Lm, 0],
          ]
        : [
            [0, 0],
            [x, -x / Lm],
            [x, (Lm - x) / Lm],
            [Lm, 0],
          ];
    d.s += `<polygon points="${pts.map(([a, v]) => `${X(a).toFixed(1)},${Yv(v).toFixed(1)}`).join(' ')}" style="fill:#f2f2f2;stroke:#000;stroke-width:1"/>`;
    ax.forEach(([a]) => {
      const val = f(x, a + (f === Vi ? 1e-6 : 0));
      d.L(X(a), yA, X(a), Yv(val), 'd');
      d.T(X(a) + 3, Yv(val) + (val >= 0 ? 12 : -4), fx(val, 3), 'start', 'class="s"');
    });

    const ymax = Yv(f === Mi ? Mi(x, x) : (Lm - x) / Lm);
    d.L(X(x), yA - 12, X(x), ymax + 4, 'c');
    d.T(X(x) + 4, yA - 4, `x = ${fx(x, 3)} m`, 'start', 'class="s"');
    const yd = ymax + 34;
    d.dimH(X(0), X(Lm), yd, `Ls = ${fx(Lm, 2)} m`);
    d.L(X(0), yA, X(0), yd + 4);
    d.L(X(Lm), yA, X(Lm), yd + 4);
    const laneV = f === Mi ? (9.3 * x * (Lm - x)) / 2 : (9.3 * (Lm - x) ** 2) / (2 * Lm);
    d.T(
      X(0),
      yd + 18,
      `${b.nm}: Σ Pi.yi = ${fx(b.v, 2)} ${unit} ; tải trọng làn: ${fx(laneV, 2)} ${unit} (1 làn, chưa nhân hệ số phân bố g và IM)`,
      'start',
      'class="s"',
    );
    return yd + 30;
  };

  const y1 = panel(0, Lm / 2, Mi, 'a) Mômen tại giữa nhịp - đường ảnh hưởng M', 'kN.m', [0, Lm]);
  const xv = Math.min(Lm * 0.49, Math.max(0.01, R.xv / 1000));
  const useK = I ? I.sup === 'K' : supK();
  const y2 = panel(
    y1 + 6,
    xv,
    Vi,
    `b) Lực cắt tại mặt cắt tới hạn x = ${useK ? 'dv + (bk - a0)' : 'dv + bg/2'} - đường ảnh hưởng V`,
    'kN',
    [xv, Lm],
  );
  d.T(
    W / 2,
    y2 + 6,
    'Xếp hoạt tải HL-93 bất lợi nhất trên đường ảnh hưởng (TCVN 11823-3, Điều 6.1.2 và 6.1.3.1)',
    'middle',
    'font-style="italic"',
  );

  const svg = dgPut(resolveRealSvg(target, defaultId), W, y2 + 18, d.s, id);
  storeSvgOutput(target, defaultId, svg);
  return svg;
}

/**
 * Draw 4 longitudinal stress/flexure/shear charts (`#dg${k}StT`, `StS`, `Mu`, `Vu`) for hollow PC girder.
 */
export function damDrawCharts(
  k: string,
  R: DamCalcResult | null | undefined,
  I: DamSpInput | null | undefined,
  limOverride?: DamLimits | null,
): Record<string, string> {
  if (!R || !I || !Array.isArray(R.res) || !R.res.length) return {};
  const Ls = R.Ls / 1000;
  const r = R.res.filter((o) => o.hollow || o.x < Ls / 4);
  const P = (f: (o: DamCalcResult['res'][number]) => number): Point2D[] => r.map((o) => [o.x, f(o)]);
  const PH = (f: (o: DamCalcResult['res'][number]) => number): Point2D[] =>
    R.res.filter((o) => o.hollow).map((o) => [o.x, f(o)]);
  const xl = 'Khoảng cách từ tim gối (m)';
  const lim = limOverride ?? getLatestLim() ?? evalDamLimits(I);

  const drawOne = (suffix: string, opts: Parameters<typeof dgChart>[2]): string => {
    const domId = `dg${k}${suffix}`;
    const svg = dgChart(resolveRealSvg(undefined, domId), `${k}${suffix}`, opts);
    setOutputValue(domId, svg);
    return svg;
  };

  const stT = drawOne('StT', {
    Ls,
    title: 'KIỂM TRA ỨNG SUẤT - GIAI ĐOẠN TRUYỀN LỰC',
    xl,
    yl: 'Ứng suất (MPa)',
    series: [
      { n: 'Thớ trên dầm', pts: P((o) => o.ft_tr), c: '#0000ff' },
      { n: 'Thớ dưới dầm', pts: P((o) => o.fb_tr), c: '#ff0000' },
    ],
    hl: [
      { y: lim.trC, n: "Giới hạn nén 0,6f'ci", c: '#993300' },
      { y: -lim.trT, n: "Giới hạn kéo 0,25√f'ci", c: '#000080', da: '6,3' },
    ],
  });

  const stS = drawOne('StS', {
    Ls,
    title: 'KIỂM TRA ỨNG SUẤT - GIAI ĐOẠN KHAI THÁC (SỬ DỤNG I, III + TG)',
    xl,
    yl: 'Ứng suất (MPa)',
    series: [
      { n: 'Thớ trên dầm (SD I)', pts: P((o) => o.ftIT ?? o.ftI), c: '#0000ff' },
      { n: 'Thớ dưới dầm (SD III)', pts: P((o) => o.fbIIIT ?? o.fbIII), c: '#ff0000' },
    ],
    hl: [
      { y: lim.svI, n: "Giới hạn nén 0,6f'c", c: '#993300' },
      { y: -lim.svT, n: 'Giới hạn kéo', c: '#000080', da: '6,3' },
    ],
  });

  const mu = drawOne('Mu', {
    Ls,
    title: 'SỨC KHÁNG UỐN',
    xl,
    yl: 'Mômen (kN.m)',
    series: [
      { n: 'Sức kháng uốn Mr', pts: P((o) => o.Mr), c: '#ff0000', da: '4,3' },
      { n: 'Mômen tính toán Mu', pts: P((o) => o.Mu), c: '#0000ff' },
    ],
  });

  const vu = drawOne('Vu', {
    Ls,
    title: 'SỨC KHÁNG CẮT',
    xl,
    yl: 'Lực cắt (kN)',
    series: [
      { n: 'Sức kháng cắt Vr (đoạn rỗng)', pts: PH((o) => o.Vr), c: '#ff0000', da: '4,3' },
      { n: 'Lực cắt tính toán Vu', pts: P((o) => o.Vu), c: '#0000ff' },
    ],
    note: `Đoạn đặc đầu dầm và giữa nhịp có Vr lớn hơn nhiều (xem bảng). Mặt cắt tới hạn về cắt cách tim gối ${fx(
      R.xv / 1000,
      3,
    )} m.`,
  });

  return { stT, stS, mu, vu };
}

/**
 * Draw hollow-core PC girder section, elevation, live-load & capacity charts for branch `k`.
 */
export function damDraw(
  k: 'g' | 'b',
  R: DamCalcResult | null | undefined,
  G: DamGirderInput | null | undefined,
  I: DamSpInput | null | undefined,
  lim?: DamLimits | null,
): GirderHollowBranchVisuals {
  if (!R || !G || !I || !Array.isArray(G.dd) || G.dd.length < 3) {
    return { sec: '', elv: '', ll: '', charts: {} };
  }

  let sec = '';
  {
    const domId = `dg${k}Sec`;
    const id = `${k}Sec`;
    const W = 700;
    const H0 = R.H;
    const hs = R.hsw;
    const bd = R.bd;
    const xs = G.dd.map((p) => p[0]);
    const xmin = Math.min(...xs, -bd / 2);
    const xmax = Math.max(...xs, bd / 2);
    const kk = Math.min((W - 230) / Math.max(xmax - xmin, 1), 330 / Math.max(H0 + hs, 1));
    const x0 = 90;
    const Hpx = Math.round((H0 + hs) * kk + 150);
    const X = (x: number) => x0 + (x - xmin) * kk;
    const Y = (y: number) => 50 + (H0 + hs - y) * kk;
    const d = dgKit(id);

    d.poly(
      [
        [X(-bd / 2), Y(H0)],
        [X(bd / 2), Y(H0)],
        [X(bd / 2), Y(H0 + hs)],
        [X(-bd / 2), Y(H0 + hs)],
      ],
      `url(#hD${id})`,
    );
    d.poly(
      G.dd.map((p) => [X(p[0]), Y(p[1])] as Point2D),
      `url(#hC${id})`,
    );
    (G.voids || []).forEach((v) => {
      d.s += vSvg(v, X, Y, kk);
    });

    if (G.strands.length) {
      const ymin = Math.min(...G.strands.map((t) => t[3]));
      G.strands.forEach((st) => {
        const deb = st[4] > 0;
        d.s += `<circle cx="${X(st[2]).toFixed(1)}" cy="${Y(st[3]).toFixed(1)}" r="${Math.max(3.2, (I.db / 2) * kk).toFixed(1)}" fill="${deb ? '#fff' : '#000'}" stroke="#000" stroke-width="1.2"/>`;
        d.T(X(st[2]), Y(st[3]) + (st[3] > ymin ? -7 : 15), String(st[0]), 'middle', 'class="s"');
      });
      const rows = [...new Set(G.strands.map((s) => s[3]))].sort((a, b) => a - b);
      rows.forEach((y) => {
        const xm = Math.min(...G.strands.filter((s) => s[3] === y).map((s) => s[2]));
        d.L(X(xmin) - 40, Y(y), X(xm) - 6, Y(y), 'd');
        d.T(X(xmin) - 44, Y(y) + 4, `y = ${fx(y, 0)}`, 'end', 'class="s"');
      });
    }

    const xr = X(xmax) + 22;
    d.dimV(xr, Y(H0 + hs), Y(H0), `ts = ${fx(hs, 0)}`);
    d.dimV(xr, Y(H0), Y(0), `H = ${fx(H0, 0)}`);
    if (G.voids.length) {
      const v0 = G.voids[0];
      const vy = v0[1];
      d.L(X(v0[0]), Y(vy), X(v0[0]) + 40, Y(vy) - 40);
      d.T(
        X(v0[0]) + 42,
        Y(vy) - 42,
        v0.length >= 5
          ? `Lỗ rỗng ${fx(v0[2], 0)}x${fx(v0[3], 0)}`
          : `Lỗ rỗng D${fx(v0[2], 0)}`,
        'start',
      );
    }
    d.dimH(X(-bd / 2), X(bd / 2), 26, `b = S = ${fx(bd, 0)}`, Y(H0 + hs));
    const wb = xEdges(G.dd, 1);
    if (wb.length > 1) {
      d.dimH(
        X(wb[0]),
        X(wb[wb.length - 1]),
        Y(0) + 24,
        `bđáy = ${fx(wb[wb.length - 1] - wb[0], 0)}`,
        Y(0),
      );
    }

    const ly = Hpx - 40;
    d.s += `<circle cx="110" cy="${ly}" r="5" fill="#000"/>`;
    d.T(122, ly + 4, 'Tao dính bám suốt chiều dài', 'start');
    d.s += `<circle cx="340" cy="${ly}" r="5" fill="#fff" stroke="#000" stroke-width="1.2"/>`;
    d.T(352, ly + 4, 'Tao bọc ống (mất dính bám) ở đầu dầm', 'start');
    d.T(
      W / 2,
      Hpx - 14,
      `Mặt cắt đoạn rỗng ${R.kind === 'giua' ? 'dầm giữa' : 'dầm biên'}: ${R.nstr} tao D${fx(I.db, 1)} ; bản mặt cầu quy về bề rộng b = S (kích thước: mm)`,
      'middle',
      'font-style="italic"',
    );
    sec = dgPut(resolveRealSvg(undefined, domId), W, Hpx, d.s, id);
    setOutputValue(domId, sec);
  }

  let elv = '';
  {
    const domId = `dg${k}Elv`;
    const id = `${k}Elv`;
    const W = 700;
    const half = Math.max(1, R.L / 2);
    const kx = (W - 290) / half;
    const rows = R.groups || [];
    const Hpx = 96 + rows.length * 26 + 46;
    const X = (x: number) => 120 + x * kx;
    const d = dgKit(id);

    d.poly(
      [
        [X(0), 40],
        [X(half), 40],
        [X(half), 62],
        [X(0), 62],
      ],
      `url(#hC${id})`,
      't',
    );
    const segs: Array<[number, number]> = [];
    let x0 = R.Lend;
    (R.SOL || [])
      .slice()
      .sort((p, q) => p[0] - q[0])
      .forEach((z) => {
        segs.push([x0, z[0]]);
        x0 = z[1];
      });
    segs.push([x0, half - R.Lmid / 2]);
    segs.forEach(([a, b]) => {
      if (b - a < 1) return;
      d.s += `<rect class="t" x="${X(a).toFixed(1)}" y="44" width="${((b - a) * kx).toFixed(1)}" height="14" style="fill:#fff"/>`;
      if ((b - a) * kx > 70) d.T(X((a + b) / 2), 55, 'Đoạn rỗng', 'middle', 'class="s"');
    });
    d.T(X(R.Lend / 2), 35, 'Đặc', 'middle', 'class="s"');

    const yb = Hpx - 36;
    d.L(X(R.brg), 34, X(R.brg), yb, 'c');
    d.T(X(R.brg), yb + 14, 'Tim gối');
    d.L(X(half), 34, X(half), yb, 'c');
    d.T(X(half), yb + 14, 'Giữa nhịp');
    d.s += `<polygon class="t" points="${X(R.brg)},62 ${X(R.brg) - 7},74 ${X(R.brg) + 7},74" style="fill:#fff"/>`;

    const fmtIds = (ids: number[]): string => {
      const o: string[] = [];
      let a = ids[0];
      let b = ids[0];
      for (let i = 1; i <= ids.length; i++) {
        const c = ids[i];
        if (c === b + 1) {
          b = c;
          continue;
        }
        o.push(b > a + 1 ? `${a}-${b}` : b > a ? `${a},${b}` : String(a));
        a = b = c;
      }
      return o.join(',');
    };

    rows.forEach((g, i) => {
      const y = 88 + i * 26;
      d.T(112, y + 4, `y = ${fx(g.y, 0)}: ${g.n} tao`, 'end', 'class="s"');
      if (g.l0 > 0) {
        d.L(X(0), y, X(g.l0), y, 'd');
        d.T(X(g.l0 / 2), y - 5, `bọc ống ${fx(g.l0, 0)}`, 'middle', 'class="s"');
        d.L(X(g.l0), y - 4, X(g.l0), y + 4);
      }
      d.s += `<line x1="${X(g.l0).toFixed(1)}" y1="${y}" x2="${X(half).toFixed(1)}" y2="${y}" stroke="#000" stroke-width="2"/>`;
      d.T(
        X(half) + 6,
        y + 4,
        `tao ${fmtIds(g.ids.slice().sort((p, q) => p - q))}`,
        'start',
        'class="s"',
      );
    });
    d.T(
      W / 2,
      Hpx - 6,
      'Bố trí cáp dự ứng lực theo chiều dài (1/2 dầm, tính từ đầu dầm; nét đứt: đoạn bọc ống mất dính bám)',
      'middle',
      'font-style="italic"',
    );
    elv = dgPut(resolveRealSvg(undefined, domId), W, Hpx, d.s, id);
    setOutputValue(domId, elv);
  }

  const ll = damDrawLL(k, R, I);
  const charts = damDrawCharts(k, R, I, lim);
  return { sec, elv, ll, charts };
}

/**
 * Draw RC slab girder cross-section with open stirrups and longitudinal bars (`#dgrSec` / `#dgrbSec`).
 */
export function rcgSecSvg(
  id: string,
  G: RcInput | null | undefined,
  R: RcCalcResult | null | undefined,
  edge: boolean,
  target?: BridgeSvgTarget,
): string {
  if (!G || !R || !Array.isArray(R.P) || R.P.length < 3) return '';
  const W = 760;
  const P = R.P;
  const H = R.H;
  const hs = R.hsw;
  const beff = R.beff;
  const xd0 = R.xdk - beff / 2;
  const xd1 = R.xdk + beff / 2;
  const xs = P.map((p) => p[0]);
  const xmin = Math.min(...xs, xd0);
  const xmax = Math.max(...xs, xd1);
  const k = Math.min((W - 370) / Math.max(xmax - xmin, 1), 300 / Math.max(H + hs, 1));
  const x0 = 175;
  const X = (x: number) => x0 + (x - xmin) * k;
  const Y = (y: number) => 74 + (H + hs - y) * k;
  const d = dgKit(id);
  const Hp = Math.round((H + hs) * k + 182);

  d.poly(
    [
      [X(xd0), Y(H)],
      [X(xd1), Y(H)],
      [X(xd1), Y(H + hs)],
      [X(xd0), Y(H + hs)],
    ],
    `url(#hD${id})`,
  );
  d.poly(
    P.map((p) => [X(p[0]), Y(p[1])] as Point2D),
    `url(#hC${id})`,
  );
  (R.voids || []).forEach((v) => {
    d.s += vSvg(v, X, Y, k);
  });

  let lmax = -Infinity;
  let rmin = Infinity;
  for (let y = 1; y < H; y += 2) {
    const e = xEdges(P, y);
    if (e.length > 1) {
      lmax = Math.max(lmax, e[0]);
      rmin = Math.min(rmin, e[e.length - 1]);
    }
  }
  if (!Number.isFinite(lmax) || !Number.isFinite(rmin)) {
    lmax = Math.min(...xs);
    rmin = Math.max(...xs);
  }
  const cv = Math.max(20, R.bot.y - R.bot.d / 2 - G.sd);
  const sl = lmax + cv + G.sd / 2;
  const sr = rmin - cv - G.sd / 2;
  const sb = cv + G.sd / 2;
  const stp = H + 0.6 * hs;
  d.s += `<path d="M${X(sl).toFixed(1)},${Y(stp).toFixed(1)} L${X(sl).toFixed(1)},${Y(sb).toFixed(1)} L${X(sr).toFixed(1)},${Y(sb).toFixed(1)} L${X(sr).toFixed(1)},${Y(stp).toFixed(1)}" style="fill:none;stroke:#c00000;stroke-width:1.3"/>`;

  const used: number[] = [];
  R.bars.forEach((b) => {
    const l = sl + G.sd / 2 + b.d / 2;
    const r = sr - G.sd / 2 - b.d / 2;
    const n = b.n;
    for (let i = 0; i < n; i++) {
      const x = n > 1 ? l + ((r - l) * i) / (n - 1) : (l + r) / 2;
      d.s += `<circle cx="${X(x).toFixed(1)}" cy="${Y(b.y).toFixed(1)}" r="${Math.max(2.2, (b.d / 2) * k).toFixed(1)}" fill="#000"/>`;
    }
    let yl = Y(b.y);
    while (used.some((u) => Math.abs(u - yl) < 13)) yl -= 13;
    used.push(yl);
    d.L(X(r) + Math.max(3, (b.d / 2) * k), Y(b.y), X(xmax) + 18, yl, 't');
    d.T(
      X(xmax) + 22,
      yl + 4,
      `${b.n}Φ${fx(b.d, 0)} (${b.top ? 'mặt trên' : 'đáy dầm'}, As = ${fx(b.A, 0)} mm²)`,
      'start',
      'class="s"',
    );
  });

  const xl = X(xmin) - 24;
  const xl2 = X(xmin) - 104;
  let y0 = 0;
  (
    [
      ['h5', G.h5],
      ['h4', G.h4],
      ['h3', G.h3],
      ['h2', G.h2],
      ['h1', G.h1],
    ] as const
  ).forEach(([nm, h]) => {
    if (h > 0.5) d.dimV(xl, Y(y0 + h), Y(y0), `${nm} = ${fx(h, 0)}`, -1);
    y0 += h;
  });
  d.dimV(xl, Y(H + hs), Y(H), `ts = ${fx(hs, 0)}`, -1);
  d.dimV(xl2, Y(H), Y(0), `H = ${fx(H, 0)}`, -1);
  d.dimH(
    X(xd0),
    X(xd1),
    26,
    `b = ${fx(beff, 0)}${edge ? ' (S/2 + phần hẫng)' : ' (= S)'}`,
    Y(H + hs),
  );
  const et = xEdges(P, H - 0.5);
  const eb = xEdges(P, 0.5);
  if (et.length > 1) {
    d.dimH(X(et[0]), X(et[et.length - 1]), 50, `bt = ${fx(et[et.length - 1] - et[0], 0)}`);
    d.L(X(et[0]), 54, X(et[0]), Y(H), 'g');
    d.L(X(et[et.length - 1]), 54, X(et[et.length - 1]), Y(H), 'g');
  }
  if (eb.length > 1) {
    d.dimH(
      X(eb[0]),
      X(eb[eb.length - 1]),
      Y(0) + 24,
      `${edge ? 'bd,biên = ' : 'bd = '}${fx(eb[eb.length - 1] - eb[0], 0)}`,
      Y(0),
    );
  }
  d.L(X(0), Y(0) + 8, X(0), Y(H + hs) - 8, 'c');
  d.T(X(0) + 4, Y(0) + 44, 'Tim dầm', 'start', 'class="s"');
  d.T(
    W / 2,
    Hp - 30,
    `Mặt cắt ngang ${edge ? 'dầm biên' : 'dầm giữa'} và dải bản mặt cầu tham gia làm việc (kích thước: mm)`,
    'middle',
    'font-style="italic"',
  );
  d.T(
    W / 2,
    Hp - 12,
    `Cốt đai ${G.sn} nhánh Φ${fx(G.sd, 0)} (nét đỏ) ; ${
      G.cn > 0
        ? `cốt thép liên kết dầm - bản: ${G.cn} nhánh Φ${fx(G.cd, 0)} kéo dài vào bản mặt cầu`
        : 'cốt đai kéo dài vào bản mặt cầu'
    }`,
    'middle',
    'class="s"',
  );

  return applyRcgSvg(id, W, Hp, d.s, target);
}

/**
 * Draw RC slab girder longitudinal elevation & stirrup zones (`#dgrElv`).
 */
export function rcgElevSvg(
  id: string,
  R: RcCalcResult | null | undefined,
  I: DamSpInput | null | undefined,
  G: RcInput | null | undefined,
  target?: BridgeSvgTarget,
): string {
  if (!R || !I || !G || !(R.L > 0)) return '';
  const W = 760;
  const Lt = R.L;
  const a0 = R.a0;
  const k = (W - 120) / Lt;
  const x0 = 60;
  const X = (x: number) => x0 + x * k;
  const d = dgKit(id);
  const H = R.H;
  const hs = R.hsw;
  const yT = 62;
  const Y = (y: number) => yT + (H + hs - y) * k;
  const K = I.sup === 'K';
  const bk1 = (I.bk1 || 0) * 1000;
  const bk2 = (I.bk2 || 0) * 1000;
  const tp = (I.tpad || 0.02) * 1000;
  const yb = Y(0);

  d.s += `<rect class="l" x="${X(0)}" y="${Y(H + hs).toFixed(1)}" width="${(Lt * k).toFixed(1)}" height="${(hs * k).toFixed(1)}" style="fill:url(#hD${id})"/>`;
  d.s += `<rect class="l" x="${X(0)}" y="${Y(H).toFixed(1)}" width="${(Lt * k).toFixed(1)}" height="${(H * k).toFixed(1)}" style="fill:url(#hC${id})"/>`;

  const tpx = K ? Math.max(1.5, tp * k) : 0;
  const sup = (xa: number, xb: number, lab: string) => {
    const x1 = Math.min(X(xa), X(xb));
    const w = Math.abs(X(xb) - X(xa));
    d.s += `<rect class="l" x="${x1.toFixed(1)}" y="${(yb + tpx + (K ? 0 : 8)).toFixed(1)}" width="${w.toFixed(1)}" height="30" style="fill:#e8e8e8"/>`;
    d.T(x1 + w / 2, yb + tpx + (K ? 0 : 8) + 19, lab, 'middle', 'class="s"');
  };

  if (K) {
    sup(-420, bk1, 'Mũ mố');
    sup(Lt - bk2, Lt + 420, 'Xà mũ trụ');
    (
      [
        [0, bk1],
        [Lt - bk2, Lt],
      ] as const
    ).forEach(([a, b]) => {
      d.s += `<rect x="${X(a).toFixed(1)}" y="${yb.toFixed(1)}" width="${((b - a) * k).toFixed(1)}" height="${tpx.toFixed(1)}" style="fill:#333"/>`;
    });
  } else {
    const bg = I.bg * 1000;
    [a0, Lt - a0].forEach((x) => {
      d.s += `<rect x="${X(x - bg / 2).toFixed(1)}" y="${yb.toFixed(1)}" width="${(bg * k).toFixed(1)}" height="8" style="fill:#333"/>`;
    });
    sup(-420, a0 + 250, 'Đá kê, mũ mố');
    sup(Lt - a0 - 250, Lt + 420, 'Đá kê, xà mũ');
  }

  [a0, Lt - a0].forEach((x) => {
    d.L(X(x), Y(H + hs) - 14, X(x), yb + 90, 'c');
    d.T(X(x), Y(H + hs) - 18, 'Tim kê', 'middle', 'class="s"');
  });

  let yd = yb + 52;
  if (K) {
    d.dimH(X(0), X(bk1), yd, `bk1 = ${fx(bk1, 0)}`);
    d.dimH(X(Lt - bk2), X(Lt), yd, `bk2 = ${fx(bk2, 0)}`);
    d.L(X(bk1), yb + 30, X(bk1), yd + 4);
    d.L(X(Lt - bk2), yb + 30, X(Lt - bk2), yd + 4);
    yd += 26;
  }
  d.dimH(X(0), X(a0), yd, fx(a0, 0));
  d.dimH(X(a0), X(Lt - a0), yd, `Ls = ${fx(Lt - 2 * a0, 0)}`);
  d.dimH(X(Lt - a0), X(Lt), yd, fx(a0, 0));
  d.dimH(X(0), X(Lt), yd + 26, `Lt = ${fx(Lt, 0)}`);
  d.L(X(0), Y(0), X(0), yd + 30);
  d.L(X(Lt), Y(0), X(Lt), yd + 30);

  const ys = Y(H + hs) - 34;
  G.sz.forEach((z) => {
    const a = Math.max(0, z[0]);
    const b = Math.min(Lt, z[1]);
    if (b <= a) return;
    d.L(X(a), ys - 4, X(a), ys + 4);
    d.L(X(b), ys - 4, X(b), ys + 4);
    d.L(X(a), ys, X(b), ys, 't');
    if ((b - a) * k > 70) {
      d.T(
        X((a + b) / 2),
        ys - 6,
        `Cốt đai @ ${fx(z[2], 0)}${z.length > 3 && (z[3] ?? 0) > 0 ? ` (${z[3]} nhánh)` : ''}`,
        'middle',
        'class="s"',
      );
    }
  });

  d.T(
    W / 2,
    yd + 52,
    `Sơ đồ dầm trên mố, trụ (kích thước: mm) ; dầm giản đơn nhịp tính toán Ls${
      K ? ` ; dầm kê trực tiếp qua lớp đệm dày ${fx(tp, 0)} mm` : ''
    }`,
    'middle',
    'font-style="italic"',
  );

  return applyRcgSvg(id, W, yd + 62, d.s, target);
}

/**
 * Draw RC slab girder flexural & shear capacity charts (`#dgr${k}Mu`, `#dgr${k}Vu`).
 */
export function rcgCharts(
  k: 'g' | 'b',
  R: RcCalcResult | null | undefined,
): Record<string, string> {
  if (!R || !Array.isArray(R.res) || !R.res.length) return {};
  const Ls = R.Ls / 1000;
  const xl = 'Khoảng cách từ tim kê dầm (m)';
  const hp = (f: (o: RcCalcResult['res'][number]) => number): Point2D[] =>
    R.res.map((o) => [o.x, f(o)]);

  const muId = `dgr${k}Mu`;
  const mu = dgChart(resolveRealSvg(undefined, muId), `r${k}Mu`, {
    Ls,
    title: 'SỨC KHÁNG UỐN',
    xl,
    yl: 'Mômen (kN.m)',
    series: [
      { n: 'Sức kháng uốn Mr', pts: hp((o) => o.Mr), c: '#ff0000', da: '4,3' },
      { n: 'Mômen tính toán Mu', pts: hp((o) => o.Mu), c: '#0000ff' },
      { n: 'Mômen thi công Mu,I', pts: hp((o) => o.Mu1), c: '#008000', da: '2,2' },
    ],
  });
  setOutputValue(muId, mu);

  const rv = R.res.filter((o) => o.x >= R.xv / 1000 - 1e-6);
  const vuId = `dgr${k}Vu`;
  const vu = dgChart(resolveRealSvg(undefined, vuId), `r${k}Vu`, {
    Ls,
    title: 'SỨC KHÁNG CẮT',
    xl,
    yl: 'Lực cắt (kN)',
    series: [
      { n: 'Sức kháng cắt Vr', pts: rv.map((o) => [o.x, o.Vr] as Point2D), c: '#ff0000', da: '4,3' },
      { n: 'Lực cắt tính toán Vu', pts: R.res.map((o) => [o.x, o.Vu] as Point2D), c: '#0000ff' },
    ],
    note: `Mặt cắt tới hạn về cắt cách tim kê dầm ${fx(
      R.xv / 1000,
      3,
    )} m ; đoạn từ tim kê đến mặt cắt tới hạn thiết kế theo lực cắt tại mặt cắt tới hạn (Điều 8.3.2).`,
  });
  setOutputValue(vuId, vu);

  return { mu, vu };
}

/**
 * Visual report handler for `girderHollow.ts` (`DAM` pre-tensioned hollow slab & `RCG` RC slab).
 */
export function renderGirderHollowVisuals(
  resultArg?: DamCompositeResult | GirderResult | null,
): GirderHollowVisualResult {
  const raw =
    (resultArg && 'I' in resultArg ? resultArg : null) ??
    getLatestDamResult() ??
    getLatestRcgResult();

  if (!raw) {
    if (resultArg && 'spType' in resultArg) {
      const gr = resultArg as GirderResult;
      const gPts = Array.isArray(gr.g?.dd) ? gr.g.dd : [];
      const bPts = Array.isArray(gr.b?.dd) ? gr.b.dd : gPts;
      const summarySvg =
        gPts.length >= 3
          ? (() => {
              const W = 700;
              const Hpx = 240;
              const xs = gPts.map((p) => p[0]);
              const ys = gPts.map((p) => p[1]);
              const xmin = Math.min(...xs);
              const xmax = Math.max(...xs);
              const ymin = Math.min(...ys, 0);
              const ymax = Math.max(...ys, gr.g.H || 650);
              const k = Math.min(360 / Math.max(xmax - xmin, 1), 150 / Math.max(ymax - ymin, 1));
              const X = (x: number) => W / 2 + (x - (xmin + xmax) / 2) * k;
              const Y = (y: number) => 190 - (y - ymin) * k;
              const d = dgKit('GhSum');
              d.poly(
                gPts.map((p) => [X(p[0]), Y(p[1])] as Point2D),
                'url(#hCGhSum)',
              );
              d.T(
                W / 2,
                222,
                `Mặt cắt dầm (${gr.spType}): H = ${fx(gr.g.H, 0)} mm, Ls = ${fx(gr.g.Ls, 0)} mm`,
                'middle',
                'class="s"',
              );
              const out = dgPut(resolveRealSvg(undefined, 'dgSpCS'), W, Hpx, d.s, 'GhSum');
              setOutputValue('dgSpCS', out);
              return out;
            })()
          : '';
      return {
        type: gr.spType === 'RC' ? 'RC' : 'PC',
        crossSectionSvg: summarySvg,
        branches: bPts.length ? {} : {},
        rendered: Boolean(summarySvg),
      };
    }
    return { type: 'PC', crossSectionSvg: '', branches: {}, rendered: false };
  }

  const branches: Partial<Record<'g' | 'b', GirderHollowBranchVisuals>> = {};

  if (raw.type === 'RC') {
    const G0 = raw.G0 as RcInput | undefined;
    const gRes = raw.g as RcCalcResult | undefined;
    const bRes = raw.b as RcCalcResult | undefined;
    const gg = (raw.GG || {}) as {
      g?: BridgeGirderShapeMeta;
      b?: BridgeGirderShapeMeta;
    };

    const gSec = G0 && gRes ? rcgSecSvg('dgrSec', G0, gRes, false) : '';
    const gElv = G0 && gRes ? rcgElevSvg('dgrElv', gRes, raw.I, G0) : '';
    if (G0 && bRes) {
      rcgSecSvg('dgrbSec', G0, bRes, true);
    }

    if (gRes) {
      branches.g = {
        sec: gSec,
        elv: gElv,
        ll: damDrawLL('rg', gRes, raw.I),
        charts: rcgCharts('g', gRes),
      };
    }
    if (bRes) {
      branches.b = {
        sec: getBranchSvgFallback('dgrbSec'),
        elv: '',
        ll: damDrawLL('rb', bRes, raw.I),
        charts: rcgCharts('b', bRes),
      };
    }
    const crossSectionSvg = damDrawCS(
      raw.I,
      gg.g ?? (gRes ? { dd: gRes.P, voids: gRes.voids, H: gRes.H, noJoint: false } : null),
      gg.b ?? (bRes ? { dd: bRes.P, voids: bRes.voids, H: bRes.H, noJoint: false, de: bRes.DF.de } : null),
    );
    runMathSafe();
    return {
      type: 'RC',
      crossSectionSvg,
      branches,
      rendered: Boolean(crossSectionSvg || gSec || gElv),
    };
  }

  const gg = (raw.GG || {}) as Record<string, DamGirderInput | undefined>;
  const gRes = raw.g as DamCalcResult | undefined;
  const bRes = raw.b as DamCalcResult | undefined;
  for (const k of ['g', 'b'] as const) {
    const res = k === 'g' ? gRes : bRes;
    if (!res) continue;
    let G = gg[k];
    if (!G) {
      try {
        G = girderInputs(k);
      } catch {
        G = undefined;
      }
    }
    if (G && Array.isArray(G.dd) && G.dd.length >= 3) {
      branches[k] = damDraw(k, res, G, raw.I, raw.LIM);
    }
  }
  const gShape =
    gg.g ?? (gRes?.res?.[0]?.P ? { dd: gRes.res[0].P, voids: [], H: gRes.H, noJoint: false } : null);
  const bShape =
    gg.b ??
    (bRes?.res?.[0]?.P
      ? { dd: bRes.res[0].P, voids: [], H: bRes.H, noJoint: false, de: bRes.DF?.de }
      : gShape);
  const crossSectionSvg = damDrawCS(raw.I, gShape, bShape);
  runMathSafe();
  return {
    type: 'PC',
    crossSectionSvg,
    branches,
    rendered: Boolean(crossSectionSvg || branches.g?.sec || branches.b?.sec),
  };
}

function getBranchSvgFallback(id: string): string {
  const el = resolveDomElement(id);
  return el ? el.outerHTML : '';
}

/**
 * Visual report handler for `girderI.ts` (`GI` post-tensioned I-girder).
 */
export function renderGirderIVisuals(
  resultArg?: GiCompositeResult | GirderResult | null,
): GirderIVisualResult {
  const raw =
    (resultArg && 'G0' in resultArg && resultArg.type === 'I' ? resultArg : null) ??
    getLatestGirResult();

  if (!raw) {
    return {
      crossSectionSvg: '',
      secMiddleSvg: '',
      cabMiddleSvg: '',
      secEdgeSvg: '',
      cabEdgeSvg: '',
      rendered: false,
    };
  }

  const crossSectionSvg = damDrawCS(raw.I, raw.GG?.g, raw.GG?.b);
  const secMiddleSvg = GID.sec('dgiSec', raw.G0, raw.g);
  const cabMiddleSvg = GID.cab('dgiCab', raw.G0, raw.g);
  const secEdgeSvg = GID.sec('dgib_Sec', raw.G0, raw.b);
  const cabEdgeSvg = GID.cab('dgib_Cab', raw.G0, raw.b);

  if (hasDom()) {
    const svSec = resolveDomElement('dgiSec');
    if (svSec) svSec.outerHTML = secMiddleSvg.replace('<svg ', '<svg data-sp="I" ');
    const svCab = resolveDomElement('dgiCab');
    if (svCab) svCab.outerHTML = cabMiddleSvg.replace('<svg ', '<svg data-sp="I" ');
  }
  setOutputValue('dgiSec', secMiddleSvg);
  setOutputValue('dgiCab', cabMiddleSvg);
  setOutputValue('dgib_Sec', secEdgeSvg);
  setOutputValue('dgib_Cab', cabEdgeSvg);
  runMathSafe();

  return {
    crossSectionSvg,
    secMiddleSvg,
    cabMiddleSvg,
    secEdgeSvg,
    cabEdgeSvg,
    rendered: Boolean(crossSectionSvg || secMiddleSvg || cabMiddleSvg),
  };
}


// ---------------------------------------------------------------------------
// 2. Heavy Gravity Abutment SVGs (`drawMo`, `drawMoT`, `drawCsm`, `drawCS`)
// ---------------------------------------------------------------------------

/**
 * Longitudinal section diagram of the gravity / heavy abutment (`#dgMo`),
 * chaining `drawMoT` for the transverse section (`#dgMoT`).
 * Exact port of `drawMo` (`03_abutment_loads_and_rc.js:1279-1487`).
 */
export function drawMo(
  I: MoInput,
  R: MoCalcResult,
  target?: BridgeSvgTarget,
  targetT?: BridgeSvgTarget,
): { dgMo: string; dgMoT: string } {
  const G = R.geo;
  if (!G) {
    return { dgMo: '', dgMoT: '' };
  }

  const b2 = G.b2;
  const xw1 = G.xw1;
  const xw2 = G.xw2;
  const zct = G.zct;
  const zwt = G.zwt;
  const ztop = G.ztop;
  const d = I.d;
  const f = I.f;
  const t = I.t;
  const hct = G.hct;
  const b3 = I.b3;
  const b4 = Math.max(G.b4, 0);
  const bga = propNum(I, 'bga', 0.5);
  const kt = propNum(I, 'kt', 0);
  const vt = propNum(I, 'vt', 0);
  const cf = propNum(I, 'cf', 0);
  const hg = propNum(I, 'hg', 0);
  const d1 = propNum(I, 'd1', 0);
  const d2 = propNum(I, 'd2', 0);
  const d2b = propNum(I, 'd2b', 0);
  const d4 = propNum(I, 'd4', 0);
  const d5 = propNum(I, 'd5', 0);
  const d9 = propNum(I, 'd9', 0);
  const dkx = propNum(I, 'dkx', 0.25);
  const a0 = propNum(I, 'a0', 0.3);
  const gVal = propNum(I, 'g', 0.55);
  const wc = propNum(I, 'wc', 0);
  const jtm = propNum(I, 'jtm', 0);
  const ELmc = propNum(I, 'ELmc', 0);
  const ELbe = propNum(I, 'ELbe', 0);

  const xmin = Math.min(-I.b / 2, xw2 - b3 - b4);
  const xmax = I.b / 2;
  const zmax = Math.max(ztop, zct + hct + hg, 0.5);
  const W = 760;
  const padL = 135;
  const padR = 175;
  const padT = 70;
  const padB = 75;
  const k = Math.min((W - padL - padR) / Math.max(xmax - xmin, 0.5), 520 / (zmax + 0.01));
  const H = Math.round(padT + zmax * k + padB);
  const X = (x: number) => padL + (x - xmin) * k;
  const Z = (z: number) => padT + (zmax - z) * k;
  const id = 'M';

  let s = `<rect width="${W}" height="${H}" fill="#fff"/>` + svgKit(id).head;
  const P = (pts: Point2D[], fill = 'url(#hcM)', st = '#1f4e79', da = '') => {
    s += `<polygon points="${pts.map(([x, z]) => `${X(x).toFixed(1)},${Z(z).toFixed(1)}`).join(' ')}" fill="${fill}" stroke="${st}" stroke-width="1.3" ${da ? `stroke-dasharray="${da}"` : ''}/>`;
  };
  const L = (x1: number, y1: number, x2: number, y2: number, c = '#555', w = 0.7, da = '') => {
    s += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${c}" stroke-width="${w}" ${da ? `stroke-dasharray="${da}"` : ''}/>`;
  };
  const T = (x: number, y: number, tx: string, a = 'middle', ex = '') => {
    s += `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${a}" font-size="12" ${ex}>${tx}</text>`;
  };
  const ar = `marker-start="url(#arM)" marker-end="url(#arM)"`;
  const dH = (
    xa: number,
    xb: number,
    y: number,
    tx: string,
    ext1: number | null,
    ext2: number | null,
  ) => {
    if (Math.abs(xb - xa) < 1e-6) return;
    const a = X(xa);
    const bx = X(xb);
    s += `<line x1="${a}" y1="${y}" x2="${bx}" y2="${y}" stroke="#333" stroke-width="0.7" ${ar}/>`;
    if (ext1 != null) L(a, ext1, a, y + (y > ext1 ? 4 : -4));
    if (ext2 != null) L(bx, ext2, bx, y + (y > ext2 ? 4 : -4));
    T((a + bx) / 2, y - 3, tx);
  };
  const dV = (
    x: number,
    za: number,
    zb: number,
    tx: string,
    side = 1,
    ext: number | null = null,
  ) => {
    if (Math.abs(zb - za) < 1e-6) return;
    const a = Z(za);
    const bz = Z(zb);
    s += `<line x1="${x}" y1="${a}" x2="${x}" y2="${bz}" stroke="#333" stroke-width="0.7" ${ar}/>`;
    if (ext != null) {
      L(ext, a, x + 4 * side, a);
      L(ext, bz, x + 4 * side, bz);
    }
    T(x + side * 4, (a + bz) / 2 + 4, tx, side > 0 ? 'start' : 'end');
  };
  const vf = (n: number) => fx(n, 2);

  // Wing wall (dashed, background) + curb
  const xe = xw2 - b3;
  const xg = xe - b4;
  const zt = zct + hct;
  P(
    [
      [xw2, zct],
      [xw2, zt],
      [xg, zt],
      [xg, zt - d4],
      [xe, zt - d4 - d5],
      [xe, zct],
    ],
    '#f4f4f4',
    '#888',
    '5,3',
  );
  if (hg > 0) {
    P(
      [
        [xw2, zt],
        [xw2, zt + hg],
        [xg, zt + hg],
        [xg, zt],
      ],
      '#f4f4f4',
      '#888',
      '5,3',
    );
  }

  // Footing, stem, backwall, approach slab corbel
  P([
    [-I.b / 2, 0],
    [I.b / 2, 0],
    [I.b / 2, d],
    [xw1, d + f],
    [xw2, d + f],
    [-I.b / 2, d],
  ]);
  P([
    [xw1, zct],
    [xw1, zwt],
    [xw2 + t, zwt],
    [xw2 + t, ztop],
    [xw2, ztop],
    [xw2, zct],
  ]);
  const zc = ztop - d1;
  P([
    [xw2, zc],
    [xw2 - d9, zc],
    [xw2 - d9, zc - d2],
    [xw2, zc - d2 - d2b],
  ]);

  // Bearing pedestal, bearing, superstructure outline
  const xb = G.xb;
  const wdk = I.goi === 'K' ? bga || 0.5 : dkx;
  s += `<rect x="${X(xb - wdk / 2)}" y="${Z(G.zbg)}" width="${wdk * k}" height="${Math.max(2, (G.zbg - zwt) * k)}" fill="#555"/>`;
  const xge = xb - a0;
  s += `<rect x="${X(xge)}" y="${Z(ztop)}" width="${(xmax - xge) * k}" height="${(ztop - G.zbg) * k}" fill="#e6efdf" stroke="#4a6b3a"/>`;
  T((X(xge) + X(xmax)) / 2, Z(ztop) - 5, 'Kết cấu nhịp', 'middle', 'fill="#4a6b3a"');
  L(X(xb), Z(G.zbg) + 2, X(xb), Z(zwt) - 2, '#c00000', 0.8, '4,2');

  // Cheek walls behind bridge seat
  if (kt > 0 && vt > 0) {
    P(
      [
        [xw2 + t, zwt],
        [xw1, zwt],
        [xw1, zwt + kt],
        [xw2 + t, zwt + kt],
      ],
      'none',
      '#1f4e79',
      '6,3',
    );
    T(
      X(xw2 + t) + 3,
      Z(zwt + kt * 0.35),
      'Tường tai',
      'start',
      'font-style="italic" font-size="11"',
    );
    T(X(xw2 + t) + 3, Z(zwt + kt * 0.35) + 13, `k = ${vf(kt)}`, 'start', 'font-size="11"');
  }

  // Backfill & ground line
  L(X(xmin) - 10, Z(zt), X(xw2), Z(zt), '#8a6d3b', 1.4);
  T(X(xmin) + 4, Z(zt) - 5, 'Đất đắp', 'start', 'fill="#8a6d3b"');
  if (cf > 0) {
    L(X(xw1), Z(d + cf), X(I.b / 2) + 20, Z(d + cf), '#8a6d3b', 1.4);
    T(X(I.b / 2) + 22, Z(d + cf) + 4, 'GL', 'start');
  }

  // Origin & X-axis
  s += `<circle cx="${X(0)}" cy="${Z(0)}" r="3" fill="#1f4e79"/><line x1="${X(0)}" y1="${Z(0) - 8}" x2="${X(0) + 30}" y2="${Z(0) - 8}" stroke="#1f4e79" marker-end="url(#arM)"/>`;
  T(X(0) + 36, Z(0) - 4, 'X', 'start', 'fill="#1f4e79"');
  T(X(0) - 4, Z(0) - 11, 'O', 'end', 'fill="#1f4e79"');

  // Bottom dimensions
  const yb1 = Z(0) + 20;
  const yb2 = Z(0) + 42;
  dH(xw1, I.b / 2, yb1, `b1 = ${vf(I.b1)}`, Z(0), Z(d));
  dH(xw2, xw1, yb1, `a = ${vf(I.a)}`, Z(0), Z(0));
  dH(-I.b / 2, xw2, yb1, `b2 = ${vf(b2)}`, Z(d), Z(0));
  dH(-I.b / 2, I.b / 2, yb2, `b = ${vf(I.b)}`, null, null);

  // Top dimensions
  const yt1 = Z(zmax) - 14;
  const yt2 = Z(zmax) - 36;
  const yt3 = Z(zmax) - 56;
  dH(xg, xe, yt1, `b4 = ${vf(b4)}`, Z(zt), null);
  dH(xe, xw2, yt1, `b3 = ${vf(b3)}`, null, null);
  dH(xw2, xw2 + t, yt1, 't', null, Z(ztop));
  dH(xw2 + t, xw1, yt1, `n = ${vf(G.n)}`, null, Z(zwt));
  dH(xg, xw2 + t, yt2, `wc = ${vf(wc)}`, null, null);
  dH(xw1 - gVal, xw1, Z(zwt) + 14, 'g', null, null);
  T(X(xw2 + t / 2), yt3 + 4, `t = ${vf(t)}`);

  // Left vertical dimensions (wing wall)
  const xl1 = X(xmin) - 12;
  const xl2 = X(xmin) - 62;
  dV(xl1, zt, zt + hg, `hg = ${vf(hg)}`, -1);
  dV(xl1, zt - d4, zt, `d4 = ${vf(d4)}`, -1);
  dV(xl1, zt - d4 - d5, zt - d4, `d5 = ${vf(d5)}`, -1);
  dV(xl2, zct, zt, `hc = ${vf(hct)}`, -1);
  dV(xl2, 0, d, `d = ${vf(d)}`, -1);
  if (f > 0) dV(xl1, d, d + f, 'f', -1);

  // Approach slab corbel dimensions
  const xc1 = X(xw2 - d9) - 8;
  dV(xc1, zc - d2, zc, 'd2', -1);
  dV(xc1 - 26, zc - d2 - d2b, zc - d2, "d'2", -1);
  dV(X(xw2) + 6, zc, ztop, 'd1', 1);
  dH(xw2 - d9, xw2, Z(zc) - 6, 'd9', null, null);
  dV(X(xw2) - 10, zct, zc - d2 - d2b, `d3 = ${vf(G.d3)}`, -1);

  // Right vertical dimensions & elevations
  const xr1 = X(I.b / 2) + 16;
  const xr2 = X(I.b / 2) + 44;
  dV(xr1, 0, d, 'd', 1);
  dV(xr1, zct, zwt, `htm = ${vf(G.htm)}`, 1);
  dV(xr1, zwt, ztop, `jtm = ${vf(jtm)}`, 1);
  if (cf > 0) dV(xr2, d, d + cf, `c = ${vf(cf)}`, 1);

  const el = (z: number, lab: string) => {
    const x = X(I.b / 2) + 92;
    s += `<path d="M${x} ${Z(z)} l-6 -9 h12 z" fill="#c00000"/>`;
    L(x - 14, Z(z), x + 50, Z(z), '#c00000', 1);
    T(x + 8, Z(z) - 3, lab, 'start', 'fill="#c00000"');
  };
  el(ztop, `EL1 = ${fx(ELmc, 3)}`);
  el(zct, `EL2 = ${fx(ELbe, 3)}`);
  el(0, `EL3 = ${fx(G.ELbot, 3)}`);
  T(W / 2, H - 6, 'MẶT CẮT DỌC MỐ', 'middle', 'font-weight="bold"');

  const dgMo = writeDirectSvg(
    target,
    'dgMo',
    W,
    H,
    s,
    Math.round(W * 0.72),
    Math.round(H * 0.72),
  );
  const dgMoT = drawMoT(I, R, targetT);
  return { dgMo, dgMoT };
}

/**
 * Transverse section diagram of the heavy abutment looking from the span (`#dgMoT`).
 * Exact port of `drawMoT` (`03_abutment_loads_and_rc.js:1488-1695`).
 */
export function drawMoT(I: MoInput, R: MoCalcResult, target?: BridgeSvgTarget): string {
  const G = R.geo;
  if (!G) return '';

  const Lf = I.Lf;
  const L0 = I.L;
  const d = I.d;
  const zct = G.zct;
  const zwt = G.zwt;
  const ztop = G.ztop;
  const hct = G.hct;
  const hg = propNum(I, 'hg', 0);
  const ut = propNum(I, 'ut', 0);
  const up = propNum(I, 'up', 0);
  const b9 = propNum(I, 'b9', 0);
  const jtm = propNum(I, 'jtm', 0);
  const kt = propNum(I, 'kt', 0);
  const vt = propNum(I, 'vt', 0);
  const dky = propNum(I, 'dky', 0.8);
  const nbg = propNum(I, 'nbg', 0);
  const bgb = propNum(I, 'bgb', 0.2);
  const Sg = propNum(I, 'Sg', 1);

  const zmax = Math.max(ztop, zct + hct + hg, 0.5);
  const W = 760;
  const padL = 120;
  const padR = 190;
  const padT = 60;
  const padB = 70;
  const k = Math.min((W - padL - padR) / Math.max(Lf, L0, 0.5), 440 / zmax);
  const H = Math.round(padT + zmax * k + padB);
  const xs0 = -Math.max(Lf, L0) / 2;
  const X = (y: number) => padL + (y - xs0) * k;
  const Z = (z: number) => padT + (zmax - z) * k;

  let s = `<rect width="${W}" height="${H}" fill="#fff"/>` + svgKit('T').head;
  const P = (pts: Point2D[], fill = 'url(#hcT)', st = '#1f4e79', da = '') => {
    s += `<polygon points="${pts.map(([y, z]) => `${X(y).toFixed(1)},${Z(z).toFixed(1)}`).join(' ')}" fill="${fill}" stroke="${st}" stroke-width="1.3" ${da ? `stroke-dasharray="${da}"` : ''}/>`;
  };
  const Ln = (x1: number, y1: number, x2: number, y2: number, c = '#555', w = 0.7, da = '') => {
    s += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${c}" stroke-width="${w}" ${da ? `stroke-dasharray="${da}"` : ''}/>`;
  };
  const T = (x: number, y: number, tx: string, a = 'middle', ex = '') => {
    s += `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${a}" font-size="12" ${ex}>${tx}</text>`;
  };
  const ar = `marker-start="url(#arT)" marker-end="url(#arT)"`;
  const vf = (n: number) => fx(n, 2);
  const dH = (
    ya: number,
    yb: number,
    yy: number,
    tx: string,
    e1: number | null,
    e2: number | null,
  ) => {
    if (Math.abs(yb - ya) < 1e-6) return;
    const a = X(ya);
    const b = X(yb);
    s += `<line x1="${a}" y1="${yy}" x2="${b}" y2="${yy}" stroke="#333" stroke-width="0.7" ${ar}/>`;
    if (e1 != null) Ln(a, e1, a, yy + (yy > e1 ? 4 : -4));
    if (e2 != null) Ln(b, e2, b, yy + (yy > e2 ? 4 : -4));
    T((a + b) / 2, yy - 3, tx);
  };
  const dV = (x: number, za: number, zb: number, tx: string, side = 1) => {
    if (Math.abs(zb - za) < 1e-6) return;
    s += `<line x1="${x}" y1="${Z(za)}" x2="${x}" y2="${Z(zb)}" stroke="#333" stroke-width="0.7" ${ar}/>`;
    T(x + side * 4, (Z(za) + Z(zb)) / 2 + 4, tx, side > 0 ? 'start' : 'end');
  };

  const yl = -L0 / 2;
  const yr = L0 / 2;
  const zt = zct + hct;
  const XX = moXF(I);
  const dmF = XX.XF.dM;
  const yk = XX.XF.yc;
  const zl = zwt - dmF(yl + ut);
  const zr = zwt - dmF(yr - up);
  const crn = yk > yl + ut && yk < yr - up;

  // Footing
  P([
    [-Lf / 2, 0],
    [Lf / 2, 0],
    [Lf / 2, d],
    [-Lf / 2, d],
  ]);

  // Stem & backwall above bridge seat
  P([[yl + ut, zct], [yr - up, zct], [yr - up, zr], ...(crn ? ([[yk, zwt]] as Point2D[]) : []), [yl + ut, zl]]);
  P(
    [
      [yl + ut, zl],
      ...(crn ? ([[yk, zwt]] as Point2D[]) : []),
      [yr - up, zr],
      [yr - up, zr + jtm],
      ...(crn ? ([[yk, ztop]] as Point2D[]) : []),
      [yl + ut, zl + jtm],
    ],
    '#eef2f6',
  );

  // Side wing walls & curbs
  if (ut > 0) {
    P([
      [yl, zct],
      [yl + ut, zct],
      [yl + ut, zt],
      [yl, zt],
    ]);
  }
  if (up > 0) {
    P([
      [yr - up, zct],
      [yr, zct],
      [yr, zt],
      [yr - up, zt],
    ]);
  }
  if (hg > 0) {
    if (ut > 0) {
      P(
        [
          [yl, zt],
          [yl + ut, zt],
          [yl + ut, zt + hg],
          [yl, zt + hg],
        ],
        '#f4f4f4',
        '#888',
      );
    }
    if (up > 0) {
      P(
        [
          [yr - up, zt],
          [yr, zt],
          [yr, zt + hg],
          [yr - up, zt + hg],
        ],
        '#f4f4f4',
        '#888',
      );
    }
  }

  // Stem chamfer (dashed background)
  if (b9 > 0) {
    Ln(X(yl + ut + b9), Z(zct), X(yl + ut + b9), Z(zct + G.hJ), '#888', 0.8, '4,3');
    Ln(X(yr - up - b9), Z(zct), X(yr - up - b9), Z(zct + G.hJ), '#888', 0.8, '4,3');
  }

  // Pedestals & bearings
  const wcl = L0 - ut - up;
  for (let i = 0; i < XX.ys.length; i++) {
    const yc = XX.ys[i];
    const z0 = zwt - dmF(yc);
    const hkk = XX.HK.h[i] ?? 0;
    const hv = Math.max(hkk, 0.05);
    const ngk = Math.max(1, Math.round((nbg || XX.ys.length) / Math.max(XX.ys.length, 1)));
    const gw = Math.min(bgb > 0 ? bgb : 0.2, dky / (ngk + 0.6));
    const dsp = ngk > 1 ? Math.max(1.4 * gw, Math.min(Sg / ngk, (dky - gw) / (ngk - 1))) : 0;
    s += `<rect x="${X(yc - dky / 2)}" y="${Z(z0 + hv)}" width="${dky * k}" height="${hv * k}" fill="#bfc6cd" stroke="#333" stroke-width="0.6"/>`;
    for (let q = 0; q < ngk; q++) {
      const yo = yc + (q - (ngk - 1) / 2) * dsp;
      s += `<rect x="${X(yo - gw / 2)}" y="${Z(z0 + hv + 0.05)}" width="${gw * k}" height="${Math.max(2, 0.05 * k)}" fill="#333"/>`;
    }
  }

  // Cheek walls (I-girder spans)
  if (kt > 0 && vt > 0) {
    (
      [
        [yl + ut, yl + ut + vt, zl],
        [yr - up - vt, yr - up, zr],
      ] as const
    ).forEach(([a, b, z]) => {
      P(
        [
          [a, z],
          [b, z],
          [b, z + kt],
          [a, z + kt],
        ],
        'url(#hcT)',
      );
      s += `<text x="${(X((a + b) / 2) + 4).toFixed(1)}" y="${Z(z + kt / 2).toFixed(1)}" font-size="11" transform="rotate(-90 ${(X((a + b) / 2) + 4).toFixed(1)} ${Z(z + kt / 2).toFixed(1)})" text-anchor="middle">Tường tai</text>`;
    });
  }

  // Centerline & horizontal dimensions
  Ln(X(0), Z(zmax) - 8, X(0), Z(0) + 8, '#555', 0.8, '8,3,2,3');
  T(X(0) + 4, Z(zmax) + 12, 'Tim mố', 'start');
  const y1 = Z(zmax) - 22;
  const y2 = Z(zmax) - 42;
  dH(yl, yl + ut, y1, 'ut', Z(zt + hg), null);
  dH(yl + ut, yr - up, y1, `L - ut - up = ${vf(wcl)}`, null, null);
  dH(yr - up, yr, y1, 'up', null, Z(zt + hg));
  dH(yl, yr, y2, `L = ${vf(L0)}`, null, null);
  dH(-Lf / 2, Lf / 2, Z(0) + 24, `Lf = ${vf(Lf)}`, Z(0), Z(0));

  T(X(yl + ut + 0.5 * wcl), Z(zct) - 8, 'Tường thân (mặt trước)');
  T(X(yl + ut + 0.5 * wcl), (Z(zwt) + Z(ztop)) / 2 + 4, 'Tường đỉnh (phía sau)');
  if (b9 > 0) {
    dH(yl + ut, yl + ut + b9, Z(zct) - 24, 'b9', null, null);
    dH(yr - up - b9, yr - up, Z(zct) - 24, 'b9', null, null);
  }
  (
    [
      [yl + ut / 2, ut],
      [yr - up / 2, up],
    ] as const
  ).forEach(([yc, u]) => {
    if (u > 0) {
      s += `<text x="${X(yc) + 4}" y="${Z(zct + hct / 2)}" font-size="11" transform="rotate(-90 ${X(yc) + 4} ${Z(zct + hct / 2)})" text-anchor="middle">Tường cánh</text>`;
    }
  });

  // Vertical dimensions
  const xl1 = X(-Math.max(Lf, L0) / 2) - 14;
  dV(xl1, 0, d, `d = ${vf(d)}`, -1);
  dV(xl1, zct, zt, `hc = ${vf(hct)}`, -1);
  if (hg > 0) dV(xl1, zt, zt + hg, `hg = ${vf(hg)}`, -1);

  const xr1 = X(Math.max(Lf, L0) / 2) + 16;
  dV(xr1, zct, zwt, `htm = ${vf(G.htm)}`, 1);
  dV(xr1, zwt, ztop, `jtm = ${vf(jtm)}`, 1);
  dV(xr1 + 80, zct, ztop, `hl = ${vf(G.hEdge)}`, 1);

  (
    [
      [XX.XF.mL, (yl + ut + yk) / 2],
      [XX.XF.mR, (yr - up + yk) / 2],
    ] as const
  ).forEach(([ii, y]) => {
    if (ii) T(X(y), Z(zwt - dmF(y)) - 6, `mũ ${fx(ii, 1)}%`);
  });

  T(W / 2, H - 6, 'MẶT CẮT NGANG MỐ (NHÌN TỪ PHÍA NHỊP)', 'middle', 'font-weight="bold"');

  return writeDirectSvg(
    target,
    'dgMoT',
    W,
    H,
    s,
    Math.round(W * 0.68),
    Math.round(H * 0.68),
  );
}

/**
 * Seismic elastic response spectrum `Csm - T` chart (`#dgCsm`).
 * Exact port of `drawCsm` (`03_abutment_loads_and_rc.js:1698-1734`).
 */
export function drawCsm(I: MoInput, R: MoCalcResult, target?: BridgeSvgTarget): string {
  const A = propNum(I, 'A', 0.1);
  const S = R.EQ?.S ?? propNum(I, 'S', 1);
  const soil = propNum(I, 'soil', 3);
  const eqm = String((I as Record<string, unknown>).eqm ?? 'R');
  const TmInput = propNum(I, 'Tm', 0.3);

  const W = 600;
  const H = 270;
  const x0 = 60;
  const y0 = 225;
  const xw = W - 90;
  const yh = 190;
  const Tm = 10;
  const cs = (T: number) => MO.csm(A, S, soil, T);
  const ymax = Math.max(0.05, Math.ceil(2.5 * A * 1.1 * 100) / 100);
  const X = (t: number) => x0 + (t / Tm) * xw;
  const Y = (c: number) => y0 - (c / ymax) * yh;

  let s = `<rect width="${W}" height="${H}" fill="#fff"/><text x="${W / 2}" y="16" text-anchor="middle" font-weight="bold">Quan hệ Csm - T (A = ${fx(A, 2)}, S = ${fx(S, 1)})</text>`;
  for (let t = 0; t <= Tm; t += 1) {
    s += `<line x1="${X(t)}" y1="${y0}" x2="${X(t)}" y2="${y0 - yh}" stroke="#ddd"/><text x="${X(t)}" y="${y0 + 16}" text-anchor="middle">${t}</text>`;
  }
  for (let k = 0; k <= 5; k++) {
    const c = (ymax * k) / 5;
    s += `<line x1="${x0}" y1="${Y(c)}" x2="${x0 + xw}" y2="${Y(c)}" stroke="#ddd"/><text x="${x0 - 6}" y="${Y(c) + 4}" text-anchor="end">${fx(c, 3)}</text>`;
  }
  let d = '';
  for (let i = 0; i <= 400; i++) {
    const t = Math.max(0.001, (i / 400) * Tm);
    d += `${i ? 'L' : 'M'}${X(t).toFixed(1)} ${Y(cs(t)).toFixed(1)}`;
  }
  s += `<path d="${d}" fill="none" stroke="#1f4e79" stroke-width="2"/><line x1="${x0}" y1="${y0}" x2="${x0 + xw}" y2="${y0}" stroke="#000"/><line x1="${x0}" y1="${y0}" x2="${x0}" y2="${y0 - yh}" stroke="#000"/>`;
  s += `<text x="${x0 + xw / 2}" y="${H - 6}" text-anchor="middle">Chu kỳ T (s)</text><text x="14" y="${y0 - yh / 2}" transform="rotate(-90 14 ${y0 - yh / 2})" text-anchor="middle">Csm</text>`;
  if (eqm === 'R') {
    const c = cs(TmInput);
    s += `<circle cx="${X(TmInput)}" cy="${Y(c)}" r="4" fill="#c00000"/><text x="${X(TmInput) + 8}" y="${Y(c) - 6}" fill="#c00000">Tm = ${fx(TmInput, 2)} s ; Csm = ${fx(c, 4)}</text>`;
  }

  return writeDirectSvg(target, 'dgCsm', W, H, s);
}

/**
 * Superstructure cross-section schematic rendered from abutment inputs (`#dgMoCS`).
 * Exact port of `drawCS` (`03_abutment_loads_and_rc.js:1737-2058`).
 */
export function drawCS(I: MoInput, target?: BridgeSvgTarget): string {
  try {
    moHKtab(I);
  } catch (e) {
    console.error(e);
  }

  const raw = I as Record<string, unknown>;
  const Wb = propNum(raw, 'Wb', 7) || 7;
  const Hd = propNum(raw, 'Hd', 0.18);
  const Hg = propNum(raw, 'Hg', 0.65);
  const Hpa = propNum(raw, 'Hpa', 0.6);
  const Hra = propNum(raw, 'Hra', 0.61);
  const Hsu = propNum(raw, 'Hsu', 0);
  const Ng = Math.max(1, Math.round(propNum(raw, 'Ng', 7)));
  const Sg = propNum(raw, 'Sg', 1) || 1;
  const Sb = propNum(raw, 'Sb', Sg) || Sg;
  const Wpat = propNum(raw, 'Wpat', 0.5);
  const Wpap = propNum(raw, 'Wpap', 0.5);
  const WPLt = propNum(raw, 'WPLt', 0);
  const WPLp = propNum(raw, 'WPLp', 0);
  const dtype = String(raw.dtype ?? 'C');
  const gtype = String(raw.gtype ?? 'B');
  const gpl = String(raw.gpl ?? 'doc');
  const tpan = propNum(raw, 'tpan', 0.08);

  const W = 760;
  const k = 560 / Wb;
  const Htot = Hra + Hpa + Hd + Hg;
  const kv = Math.max(k, 170 / Math.max(Htot, 0.5));
  const x0 = 50;
  const yDeck = 40 + (Hra + Hpa) * kv + 30;
  const X = (x: number) => x0 + (x + Wb / 2) * k;
  const XC = moXF(I).XF;
  const wRd = Math.max(0.1, Wb / 2 - Wpat - WPLt);
  const crown = (x: number) => {
    const xx = Math.max(-wRd, Math.min(wRd, x));
    return Math.max(XC.dD(-wRd), XC.dD(wRd)) - XC.dD(xx);
  };
  const Yd = (x: number, dz: number) => yDeck - (crown(x) + dz) * kv;
  const H = Math.round(yDeck + (Hd + Hg) * kv + 70);

  let s = `<rect width="${W}" height="${H}" fill="#fff"/><defs><marker id="arCS" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 2 L10 5 L0 8 z" fill="#333"/></marker>
   <pattern id="htC" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="#c00000" stroke-width="0.8"/></pattern>
   <pattern id="htD" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><line x1="0" y1="0" x2="0" y2="7" stroke="#d4b100" stroke-width="0.8"/></pattern>
   <pattern id="htP" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="#c000c0" stroke-width="0.8"/></pattern></defs>`;
  const L = (x1: number, y1: number, x2: number, y2: number, c = '#333', w = 0.8, da = '') => {
    s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${w}" ${da ? `stroke-dasharray="${da}"` : ''}/>`;
  };
  const T = (x: number, y: number, t: string, a = 'middle', extra = '') => {
    s += `<text x="${x}" y="${y}" text-anchor="${a}" ${extra}>${t}</text>`;
  };
  const dimH = (xa: number, xb: number, y: number, t: string) => {
    if (Math.abs(xb - xa) < 1e-6) return;
    L(X(xa), y, X(xb), y);
    s += `<line x1="${X(xa)}" y1="${y}" x2="${X(xb)}" y2="${y}" stroke="#333" marker-start="url(#arCS)" marker-end="url(#arCS)"/>`;
    T((X(xa) + X(xb)) / 2, y - 4, t);
  };
  const dimV = (x: number, ya: number, yb: number, t: string) => {
    if (Math.abs(yb - ya) < 1) return;
    s += `<line x1="${x}" y1="${ya}" x2="${x}" y2="${yb}" stroke="#333" marker-start="url(#arCS)" marker-end="url(#arCS)"/>`;
    L(x - 8, ya, x + 4, ya);
    L(x - 8, yb, x + 4, yb);
    T(x + 8, (ya + yb) / 2 + 4, t, 'start');
  };

  const xl = -Wb / 2;
  const xr = Wb / 2;
  const dk: Point2D[] = [];
  for (let i = 0; i <= 40; i++) {
    const x = xl + (Wb * i) / 40;
    dk.push([X(x), Yd(x, 0)]);
  }
  const e0 = (Ng >= 3 ? 2 * Sb + (Ng - 3) * Sg : Ng === 2 ? Sb : 0) / 2;
  const yBf = gpl === 'bang' ? Math.max(Yd(-e0, 0), Yd(e0, 0)) + Hd * kv : null;
  const topPts = dk.map((p) => p.join(',')).join(' ');
  const botPts = dk
    .slice()
    .reverse()
    .map((p) => [p[0], yBf != null ? yBf : p[1] + Hd * kv].join(','))
    .join(' ');
  s += `<polygon points="${topPts} ${botPts}" fill="url(#htD)" stroke="#000" stroke-width="1.2"/>`;

  if (Hsu > 0 && dtype !== 'D') {
    const xa = xl + Wpat + WPLt;
    const xb = xr - Wpap - WPLp;
    const pts: Point2D[] = [];
    for (let i = 0; i <= 30; i++) {
      const x = xa + ((xb - xa) * i) / 30;
      pts.push([X(x), Yd(x, 0)]);
    }
    s += `<polygon points="${pts.map((p) => p.join(',')).join(' ')} ${pts
      .slice()
      .reverse()
      .map((p) => [p[0], p[1] - Hsu * kv].join(','))
      .join(' ')}" fill="#bbb" stroke="#000" stroke-width="0.8"/>`;
  }

  const side = (xa: number, w: number) => {
    if (w <= 0) return;
    const hh = Math.min(0.25, Hpa * 0.4);
    s += `<rect x="${X(xa)}" y="${Yd(xa, 0) - hh * kv}" width="${w * k}" height="${hh * kv}" fill="url(#htP)" stroke="#000"/>`;
  };
  side(xl + Wpat, WPLt);
  side(xr - Wpap - WPLp, WPLp);

  const barrier = (xa: number, w: number, dir: number, pl: number) => {
    if (w <= 0) return;
    const yb = Yd(xa, 0);
    const yt = yb - Hpa * kv;
    const xo = dir > 0 ? X(xa) : X(xa + w);
    const xi = dir > 0 ? X(xa + w) : X(xa);
    const m = dir;
    const wt = Math.min(w, 0.2) * k;
    const hs = Math.min(0.25, Hpa * 0.4) * kv;
    const pts =
      pl > 0
        ? `${xo},${yb} ${xo},${yt} ${xo + m * wt},${yt} ${xo + m * wt},${yb - hs} ${xi},${yb - hs} ${xi},${yb}`
        : `${xo},${yb} ${xo},${yt} ${xo + m * wt},${yt} ${xo + m * (wt + 0.06 * k)},${yb - Hpa * kv * 0.45} ${xi},${yb - Hpa * kv * 0.12} ${xi},${yb}`;
    s += `<polygon points="${pts}" fill="url(#htD)" stroke="#000" stroke-width="1.2"/>`;
    if (Hra > 0) {
      const xp = xo + m * wt * 0.5;
      s += `<rect x="${xp - 4}" y="${yt - Hra * kv}" width="8" height="${Hra * kv}" fill="#fff" stroke="#000"/><circle cx="${xp}" cy="${yt - Hra * kv + 6}" r="5" fill="#fff" stroke="#000"/>`;
    }
  };
  barrier(xl, Wpat, 1, WPLt);
  barrier(xr - Wpap, Wpap, -1, WPLp);

  const ext = Ng >= 3 ? 2 * Sb + (Ng - 3) * Sg : Ng === 2 ? Sb : 0;
  const xs: number[] = [];
  for (let i = 0; i < Ng; i++) {
    if (i === 0) xs.push(-ext / 2);
    else xs.push(xs[i - 1] + ((i === 1 || i === Ng - 1) && Ng > 2 ? Sb : Sg));
  }

  const latestSupGG = getLatestDamResult()?.GG ?? getLatestGirResult()?.GG ?? null;
  const gShape = latestSupGG?.g as unknown as
    | { dd: Point2D[]; H: number; noJoint?: boolean }
    | null
    | undefined;
  const GGr =
    gShape && typeof gShape === 'object' && gShape.noJoint
      ? (latestSupGG as unknown as {
          g: { dd: Point2D[]; H: number; noJoint?: boolean };
          b?: { dd: Point2D[]; H: number; noJoint?: boolean };
        })
      : null;

  const GB = gpl === 'bang';
  const TPI = dtype === 'P' && gtype === 'I' && Ng > 1 ? tpan * kv : 0;
  const H6I = (() => {
    try {
      const q = GGr?.g;
      return q?.noJoint ? (ITOP(q.dd, q.H).h6 / q.H) * Hg * kv : 0;
    } catch {
      return 0;
    }
  })();
  const ytL = Math.max(Yd(xs[0], 0), Yd(xs[xs.length - 1], 0)) + Hd * kv;
  const ytG = (xc: number) => (GB ? ytL : Yd(xc, 0) + Hd * kv) + Math.max(0, TPI - H6I);
  const hwOf = (P: Point2D[]) => {
    if (!GGr) return 0;
    const t = (P || []).filter((p) => p[1] > (GGr.g.H || 1650) - 1).map((p) => Math.abs(p[0]));
    return t.length ? Math.max(...t) / 1000 : 0;
  };
  const HWI =
    gtype === 'I'
      ? GGr
        ? xs.map((_, i) => hwOf(((i === 0 || i === Ng - 1) && Ng > 1 ? GGr.b || GGr.g : GGr.g).dd) || 0.325)
        : xs.map(() => Math.min(0.8 * Math.min(Sg, Sb), 1.1) / 2)
      : [];

  if (gtype === 'I' && GGr) {
    const Hm = GGr.g.H || 1650;
    xs.forEach((xc, i) => {
      const ed = (i === 0 || i === Ng - 1) && Ng > 1;
      let P = (ed ? GGr.b || GGr.g : GGr.g).dd;
      if (i === Ng - 1 && Ng > 1) P = P.map(([x, y]) => [-x, y] as Point2D).reverse();
      const yt = ytG(xc);
      s += `<polygon points="${P.map(([u, v]) => `${X(xc + u / 1000)},${yt + ((Hm - v) / Hm) * Hg * kv}`).join(' ')}" fill="url(#htC)" stroke="#000" stroke-width="1.1"/>`;
    });
  } else if (gtype === 'I') {
    const bf = Math.min(0.8 * Math.min(Sg, Sb), 1.1);
    const bb = Math.min(0.65, 0.7 * bf);
    const tw = 0.18;
    xs.forEach((xc) => {
      const yt = ytG(xc);
      const h = Hg * kv;
      const X1 = (v: number) => X(xc + v);
      const tf = 0.12 * h;
      const tb = 0.2 * h;
      const P: Point2D[] = [
        [-bf / 2, 0],
        [bf / 2, 0],
        [bf / 2, tf],
        [tw / 2, tf * 2],
        [tw / 2, h - tb - tf],
        [bb / 2, h - tb],
        [bb / 2, h],
        [-bb / 2, h],
        [-bb / 2, h - tb],
        [-tw / 2, h - tb - tf],
        [-tw / 2, tf * 2],
        [-bf / 2, tf],
      ];
      s += `<polygon points="${P.map(([u, v]) => `${X1(u)},${yt + v}`).join(' ')}" fill="url(#htC)" stroke="#000" stroke-width="1.1"/>`;
    });
  } else {
    xs.forEach((xc, i) => {
      const wL = i === 0 ? Math.min(Sb, Sg) : i === 1 && Ng > 2 ? Sb : Sg;
      const wR = i === Ng - 1 ? Math.min(Sb, Sg) : i === Ng - 2 && Ng > 2 ? Sb : Sg;
      const wa = xc - wL / 2 + 0.01;
      const wbx = xc + wR / 2 - 0.01;
      const yt = ytG(xc);
      const h = Hg * kv;
      s += `<rect x="${X(wa)}" y="${yt}" width="${Math.max(2, (wbx - wa) * k)}" height="${h}" fill="url(#htC)" stroke="#000" stroke-width="1.1"/>`;
      const r = Math.max(1.5, Math.min(0.3 * Hg, 0.22 * (wbx - wa)) * k);
      [-0.25, 0.25].forEach((f) => {
        const cx = X(xc + f * (wbx - wa));
        s += `<circle cx="${cx}" cy="${yt + h / 2}" r="${r}" fill="#fff" stroke="#000"/><line x1="${cx - r * 0.5}" y1="${yt + h / 2}" x2="${cx + r * 0.5}" y2="${yt + h / 2}" stroke="#000"/><line x1="${cx}" y1="${yt + h / 2 - r * 0.5}" x2="${cx}" y2="${yt + h / 2 + r * 0.5}" stroke="#000"/>`;
      });
    });
  }

  if (TPI > 0) {
    const ysb = (x: number) => (GB ? ytL : Yd(x, 0) + Hd * kv);
    const GQ = GGr
      ? [GGr.g, GGr.b || GGr.g].map((q) => {
          const t = ITOP(q.dd, q.H || 1650);
          const sy = (Hg * kv) / (q.H || 1650);
          return { a: t.a / 1000, c: t.c / 1000, h6: t.h6 * sy };
        })
      : null;
    IPAN({
      xg: xs,
      geo: xs.map((_, i) =>
        GQ
          ? GQ[(i === 0 || i === Ng - 1) && Ng > 1 ? 1 : 0]
          : { a: HWI[i] * 0.75, c: HWI[i], h6: TPI },
      ),
      tp: TPI,
      zgt: (i) => -ytG(xs[i]),
      zsb: (x) => -ysb(x),
      xL: xl,
      xR: xr,
      P: (x, z) => [X(x), -z],
      poly: (P, f) => {
        s += `<polygon points="${P.map((p) => p.join(',')).join(' ')}" fill="${f}" stroke="#000" stroke-width="0.8"/>`;
      },
      fp: '#c9d6e3',
      fd: 'url(#htD)',
    });
  }

  // Centerline & crossfall callouts
  L(X(0), yDeck - (Hra + Hpa) * kv - 20, X(0), yDeck + (Hd + Hg) * kv + 12, '#555', 0.8, '8,3,2,3');
  T(X(0) - 4, yDeck - (Hra + Hpa) * kv - 8, 'Tim cầu', 'end');
  [-1, 1].forEach((sg) => {
    const ii = sg < 0 ? XC.iL : XC.iR;
    if (!ii) return;
    const x = (XC.yc + sg * wRd) / 2;
    const y = Yd(x, 0) - 12;
    const dr = sg * Math.sign(ii);
    s += `<line x1="${X(x) - 18 * dr}" y1="${y}" x2="${X(x) + 18 * dr}" y2="${y + 3}" stroke="#333" marker-end="url(#arCS)"/>`;
    T(X(x), y - 5, `${fx(Math.abs(ii), 1)}%`);
  });

  {
    const dt = dtype || 'C';
    const lay =
      dt === 'D'
        ? [`Bản BTCT xe chạy trực tiếp, Hd = ${fx(Hd, 3)} m`]
        : [
            ...(Hsu > 0 ? ['Lớp bê tông nhựa', 'Lớp phòng nước'] : []),
            `${dt === 'P' ? 'Bản BTCT trên tấm đúc sẵn' : 'Lớp BTCT bản mặt cầu'}, Hd = ${fx(Hd, 3)} m`,
          ];
    const xL = X(Wb * 0.03);
    const y1 = Yd(0, 0) - 22 - lay.length * 17;
    L(xL, y1 - 12, xL, Yd(Wb * 0.03, 0) + Hd * kv * 0.5);
    lay.forEach((t, i) => {
      const y = y1 + i * 17;
      T(xL + 4, y, t, 'start');
      L(xL, y + 3, xL + Math.min(260, 6 + t.length * 5.9), y + 3);
    });
  }

  const yA = 18;
  const yB = 36;
  dimH(xl, xr, yA, `Wb = ${fx(Wb, 2)}`);
  const seg: Array<[number, number, string]> = [
    [xl, xl + Wpat, 'Wpa'],
    [xl + Wpat, xl + Wpat + WPLt, 'WPL'],
    [xl + Wpat + WPLt, xr - Wpap - WPLp, `WLL = ${fx(Wb - Wpat - Wpap - WPLt - WPLp, 2)}`],
    [xr - Wpap - WPLp, xr - Wpap, 'WPL'],
    [xr - Wpap, xr, 'Wpa'],
  ];
  seg.forEach(([a, b, t]) => {
    if (b - a > 1e-6) {
      dimH(a, b, yB, t.length < 4 ? ((b - a) * k > 85 ? `${t} = ${fx(b - a, 2)}` : t) : t);
    }
  });
  L(X(xl), yA - 6, X(xl), yDeck);
  L(X(xr), yA - 6, X(xr), yDeck);

  const xv = X(xr) + 28;
  const ydt = Yd(xr, 0);
  dimV(xv, ydt - (Hpa + Hra) * kv, ydt - Hpa * kv, `Hra = ${fx(Hra, 2)}`);
  dimV(xv, ydt - Hpa * kv, ydt, `Hpa = ${fx(Hpa, 2)}`);
  dimV(xv, ydt, ydt + Hd * kv, `Hd = ${fx(Hd, 2)}`);
  dimV(xv, ydt + Hd * kv, ydt + (Hd + Hg) * kv, `Hg = ${fx(Hg, 2)}`);

  const yS = yDeck + (Hd + Hg) * kv + 30;
  xs.forEach((x) => L(X(x), yS - 26, X(x), yS + 4, '#777', 0.6, '3,3'));
  if (Ng >= 3) {
    dimH(xs[0], xs[1], yS, `Sb = ${fx(Sb, 2)}`);
    dimH(xs[1], xs[Ng - 2], yS, `${Ng - 3}@Sg = ${fx((Ng - 3) * Sg, 2)}`);
    dimH(xs[Ng - 2], xs[Ng - 1], yS, `Sb = ${fx(Sb, 2)}`);
  } else if (Ng === 2) {
    dimH(xs[0], xs[1], yS, `Sb = ${fx(Sb, 2)}`);
  }

  T(
    W / 2,
    yS + 30,
    `${gtype === 'I' ? 'Dầm I BTCT DƯL' : gtype === 'R' ? 'Dầm bản BTCT' : 'Dầm bản BTCT DƯL'}, ${Ng} dầm ; Wpa = ${fx(Wpat, 2)} / ${fx(Wpap, 2)} m ; WPL = ${fx(WPLt, 2)} / ${fx(WPLp, 2)} m`,
    'middle',
    'font-style="italic"',
  );

  return writeDirectSvg(target, 'dgMoCS', W, H, s, W, H);
}

function drawAbutmentHeavyRcSummarySvg(
  rcm: RcMRuntimeState | null | undefined,
  mor: MoCalcResult | null | undefined,
): string {
  const entries = Object.entries(rcm?.res ?? {}).filter(([, val]) => Boolean(val));
  const W = 720;
  const rowH = 26;
  const H = Math.max(150, 74 + Math.max(1, entries.length) * rowH);
  const d = dgKit('MoRcSum');
  d.s += `<text x="${W / 2}" y="22" class="b" font-size="13" text-anchor="middle" fill="#1f4e79">TỔNG HỢP KIỂM TOÁN BTCT MỐ NẶNG (${rcm?.ok ? 'ĐẠT' : 'CHƯA ĐẠT'})</text>`;
  d.s += `<text x="24" y="46" class="s" fill="#475569">Mặt cắt / Hạng mục</text><text x="290" y="46" class="s" fill="#475569">gM min</text><text x="410" y="46" class="s" fill="#475569">gV min</text><text x="530" y="46" class="s" fill="#475569">Kết luận</text>`;
  d.L(20, 52, W - 20, 52);

  if (entries.length === 0) {
    d.s += `<text x="${W / 2}" y="96" class="s" text-anchor="middle" fill="#64748b">Chưa có kết quả kiểm toán mặt cắt BTCT mố nặng (${mor ? `${mor.err.length} lỗi địa kỹ thuật` : 'chưa chạy'}).</text>`;
  } else {
    entries.forEach(([key, sec], idx) => {
      if (!sec) return;
      const y = 72 + idx * rowH;
      const gM = sec.gM?.rM ?? null;
      const gV = sec.gV?.rV ?? null;
      const ok = sec.ok !== false && (gM == null || gM >= 1) && (gV == null || gV >= 1);
      d.s += `<text x="24" y="${y}" font-size="11">${escSvg(key)}</text>`;
      d.s += `<text x="290" y="${y}" font-size="11">${gM == null ? '-' : fx(gM, 2)}</text>`;
      d.s += `<text x="410" y="${y}" font-size="11">${gV == null ? '-' : fx(gV, 2)}</text>`;
      d.s += `<text x="530" y="${y}" font-size="11" font-weight="bold" fill="${ok ? '#15803d' : '#b91c1c'}">${ok ? 'OK' : 'NG'}</text>`;
    });
  }
  const svg = dgPut(undefined, W, H, d.s, 'MoRcSum');
  setOutputValue('dgMoRcSummary', svg);
  return svg;
}

/**
 * Visual report handler for `abutmentHeavy.ts`.
 * Null-safe & headless-safe: generates `#dgMo`, `#dgMoT`, `#dgCsm`, `#dgMoCS`,
 * `#dgSfCap6` (via `sfCapFig`), and `#dgMoRcSummary`.
 */
export function renderAbutmentHeavyVisuals(payloadOrArg?: unknown): AbutmentHeavyVisualResult {
  const payload =
    payloadOrArg && typeof payloadOrArg === 'object'
      ? (payloadOrArg as Record<string, unknown>)
      : {};
  const kind = (typeof payload.kind === 'string' ? payload.kind : 'summary') as
    | 'mo'
    | 'rc'
    | 'cap'
    | 'summary';

  if (kind === 'cap' && payload.sfCapFig) {
    const sf = payload.sfCapFig as {
      svId: string;
      m: ShallowCapMetaInput;
      c: ShallowCapLoadInput;
      lab: readonly [string, string, string];
    };
    const dgSfCap6 = sfCapFig(sf.svId, sf.m, sf.c, sf.lab);
    if (dgSfCap6) setOutputValue(sf.svId, dgSfCap6);
    runMathSafe();
    return { kind: 'cap', dgSfCap6, rendered: Boolean(dgSfCap6) };
  }

  if (kind === 'rc') {
    const rcm = (payload.rcm as RcMRuntimeState | undefined) ?? getLatestRcmResult();
    const mor = (payload.mor as MoCalcResult | undefined) ?? getLatestMorResult();
    const rcSummarySvg = drawAbutmentHeavyRcSummarySvg(rcm, mor);
    runMathSafe();
    return { kind: 'rc', rcSummarySvg, rendered: Boolean(rcSummarySvg) };
  }

  const I = (payload.I as MoInput | undefined) ?? moInputs();
  const R = (payload.R as MoCalcResult | undefined) ?? getLatestMorResult();
  if (!R || !R.geo) {
    return { kind, rendered: false };
  }

  if (kind === 'mo' && payload.md) {
    // Flexible abutment renders #dgMd / #dgMdE / #dgMdL via `renderAbutmentFlexVisuals`,
    // while sharing #dgCsm and #dgMoCS if needed.
    runMathSafe();
    return { kind: 'mo', rendered: true };
  }

  const { dgMo, dgMoT } = drawMo(I, R);
  const dgCsm = drawCsm(I, R);
  const dgMoCS = drawCS(I);
  const rcm = getLatestRcmResult();
  const rcSummarySvg = rcm ? drawAbutmentHeavyRcSummarySvg(rcm, R) : undefined;
  runMathSafe();

  return {
    kind: kind === 'mo' ? 'mo' : 'summary',
    dgMo,
    dgMoT,
    dgCsm,
    dgMoCS,
    rcSummarySvg,
    rendered: Boolean(dgMo || dgMoT || dgCsm || dgMoCS),
  };
}

// ---------------------------------------------------------------------------
// 3. Flexible Abutment Visuals (`abutmentFlex.ts`)
// ---------------------------------------------------------------------------

/**
 * Visual report handler for `abutmentFlex.ts`.
 * Reuses `mdDraw`, `mdCapDraw`, `mdThan`, `mdWingAll`, `drawCsm`, and `drawCS`.
 */
export function renderAbutmentFlexVisuals(payloadOrArg?: unknown): AbutmentFlexVisualResult {
  const payload =
    payloadOrArg && typeof payloadOrArg === 'object'
      ? (payloadOrArg as Record<string, unknown>)
      : {};
  const kind = (typeof payload.kind === 'string' ? payload.kind : 'summary') as
    | 'mo'
    | 'mdCap'
    | 'mdWing'
    | 'mdThan'
    | 'mdWingAll'
    | 'summary';

  if (kind === 'mo') {
    const I = (payload.I as MoInput | undefined) ?? moInputs();
    const R = (payload.R as MoCalcResult | undefined) ?? getLatestMorResult();
    if (!R) return { kind: 'mo', rendered: false };
    const { longitudinal, elevation, loads } = mdDraw(I, R);
    if (longitudinal) setOutputValue('dgMd', longitudinal);
    if (elevation) setOutputValue('dgMdE', elevation);
    if (loads) setOutputValue('dgMdL', loads);
    drawCsm(I, R);
    drawCS(I);
    runMathSafe();
    return {
      kind: 'mo',
      longitudinal,
      elevation,
      loads,
      rendered: Boolean(longitudinal || elevation || loads),
    };
  }

  if (kind === 'mdCap') {
    const I = (payload.I as MoInput | undefined) ?? moInputs();
    const mor = (payload.R as MoCalcResult | undefined) ?? getLatestMorResult();
    const { cap: capSvg, diagrams = {} } = mdCapDraw(I, mor);
    if (capSvg) setOutputValue('dgMdC', capSvg);
    Object.entries(diagrams).forEach(([id, svg]) => {
      if (svg) setOutputValue(id, svg);
    });
    runMathSafe();
    return {
      kind: 'mdCap',
      cap: capSvg,
      diagrams,
      rendered: Boolean(capSvg || Object.keys(diagrams).length),
    };
  }

  if (kind === 'mdWing') {
    const wxSvg = typeof payload.wxSvg === 'string' ? payload.wxSvg : '';
    const wySvg = typeof payload.wySvg === 'string' ? payload.wySvg : '';
    if (wxSvg) setOutputValue('dgMdWx', wxSvg);
    if (wySvg) setOutputValue('dgMdWy', wySvg);
    runMathSafe();
    return {
      kind: 'mdWing',
      wxSvg,
      wySvg,
      rendered: Boolean(wxSvg || wySvg),
    };
  }

  if (kind === 'mdThan') {
    let thanSvg = typeof payload.svg === 'string' ? payload.svg : '';
    if (!thanSvg && payload.I && payload.R) {
      thanSvg = mdThan(payload.R as MoCalcResult, payload.I as MoInput);
    }
    if (thanSvg) setOutputValue('dgMdTh', thanSvg);
    runMathSafe();
    return {
      kind: 'mdThan',
      thanSvg,
      rendered: Boolean(thanSvg),
    };
  }

  if (kind === 'mdWingAll') {
    let wingSvgs =
      payload.svgs && typeof payload.svgs === 'object'
        ? (payload.svgs as Record<string, string>)
        : {};
    if (!Object.keys(wingSvgs).length && payload.R) {
      wingSvgs = mdWingAll(payload.R as MoCalcResult);
    }
    Object.entries(wingSvgs).forEach(([id, svg]) => {
      if (svg) setOutputValue(id, svg);
    });
    runMathSafe();
    return {
      kind: 'mdWingAll',
      wingSvgs,
      rendered: Object.keys(wingSvgs).length > 0,
    };
  }

  // Fallback summary path
  if (!mdOn()) {
    return { kind: 'summary', rendered: false };
  }
  const I = moInputs();
  const R = getLatestMorResult();
  if (!R) return { kind: 'summary', rendered: false };

  const { longitudinal, elevation, loads } = mdDraw(I, R);
  const { cap: capSvg, diagrams = {} } = mdCapDraw(I, R);
  const thanSvg = mdThan(R, I);
  const wingSvgs =
    R.WG && (R.WG as unknown as MdWingResult).plate?.comb ? mdWingAll(R) : {};
  drawCsm(I, R);
  drawCS(I);
  runMathSafe();

  return {
    kind: 'summary',
    longitudinal,
    elevation,
    loads,
    cap: capSvg,
    diagrams,
    thanSvg,
    wingSvgs,
    rendered: Boolean(longitudinal || elevation || capSvg || thanSvg),
  };
}

// ---------------------------------------------------------------------------
// 4. Pier Visuals (`pierFlex.ts` & `pierSolid.ts`)
// ---------------------------------------------------------------------------

/**
 * Render a compact, headless-safe schematic & utilization SVG for the flexible
 * multi-column pier (`pierFlex.ts`).
 */
export function drawPierFlexSummarySvg(
  R?: TrCalcResult | null,
  C?: TrCheckResult | null,
  summary?: PierResult | null,
  target?: BridgeSvgTarget,
): string {
  const raw = R ?? getLatestTrResult();
  const chk = C ?? getLatestTrCheck();
  if (!raw || !raw.I || !raw.G) return '';

  const I = raw.I;
  const G = raw.G;
  const W = 720;
  const H = 260;
  const d = dgKit('TdSum');

  const spanW = Math.max(I.Lc, propNum(I, 'Lf', I.Lc), 4);
  const topZ = G.ELt + Math.max(I.ktai, 0.2);
  const hf = propNum(I, 'Hf', 1.2);
  const botZ = G.ELs - hf - 0.5;
  const spanZ = Math.max(topZ - botZ, 3);
  const k = Math.min(280 / spanW, 185 / spanZ);
  const cx = 195;
  const X = (y: number) => cx + y * k;
  const Y = (z: number) => 28 + (topZ - z) * k;

  // Footing / pile cap
  const lf = propNum(I, 'Lf', Math.max(I.Lc * 0.9, 3));
  const bf = propNum(I, 'Bf', Math.max(I.b * 2, 2.5));
  d.poly(
    [
      [X(-lf / 2), Y(G.ELs)],
      [X(lf / 2), Y(G.ELs)],
      [X(lf / 2), Y(G.ELs - hf)],
      [X(-lf / 2), Y(G.ELs - hf)],
    ],
    '#e2e8f0',
  );

  // Columns
  const nCol = Math.max(1, Math.round(G.n || I.n));
  const halfColW = I.D / 2;
  const yCols = G.xs.length
    ? G.xs
    : nCol === 1
      ? [0]
      : Array.from({ length: nCol }, (_, idx) => (idx - (nCol - 1) / 2) * I.s);
  yCols.forEach((yc) => {
    d.poly(
      [
        [X(yc - halfColW), Y(G.ELs)],
        [X(yc + halfColW), Y(G.ELs)],
        [X(yc + halfColW), Y(G.ELcb)],
        [X(yc - halfColW), Y(G.ELcb)],
      ],
      '#cbd5e1',
    );
  });

  // Cap beam
  d.poly(
    [
      [X(-I.Lc / 2), Y(G.ELt - I.he)],
      [X(-I.Lc / 2 + I.lt), Y(G.ELcb)],
      [X(I.Lc / 2 - I.lt), Y(G.ELcb)],
      [X(I.Lc / 2), Y(G.ELt - I.he)],
      [X(I.Lc / 2), Y(G.ELt)],
      [X(-I.Lc / 2), Y(G.ELt)],
    ],
    '#f1f5f9',
  );

  // Right-hand KPI block
  const kx = 395;
  d.s += `<text x="${kx}" y="34" class="b" font-size="13" fill="#1f4e79">TRỤ CỘT THÂN MẢNH (${nCol} cột)</text>`;
  d.s += `<text x="${kx}" y="58" font-size="11">Xà mũ: Lc = ${fx(I.Lc, 2)} m × b = ${fx(I.b, 2)} m × h = ${fx(I.h, 2)} m</text>`;
  d.s += `<text x="${kx}" y="78" font-size="11">Thân cột: D = ${fx(I.D, 2)} m ; s = ${fx(I.s, 2)} m ; H = ${fx(G.Hc, 2)} m</text>`;
  d.s += `<text x="${kx}" y="98" font-size="11">Bệ móng: ${fx(bf, 2)} × ${fx(lf, 2)} × ${fx(hf, 2)} m (${G.pile ? 'Cọc' : 'Móng nông'})</text>`;

  const errList = raw.err ?? [];
  const okAll =
    summary?.okAll ??
    (chk ? Boolean(chk.SL?.ok ?? true) && errList.length === 0 : errList.length === 0);
  const maxU = summary?.stemCheck?.pmBiaxial?.maxUtilRatio ?? chk?.SL?.KluT ?? 0;
  d.s += `<text x="${kx}" y="124" font-size="11">Chỉ số kiểm toán max: ${fx(maxU, 3)}</text>`;
  d.s += `<text x="${kx}" y="148" font-size="12" font-weight="bold" fill="${okAll ? '#15803d' : '#b91c1c'}">Kết luận: ${okAll ? 'ĐẠT YÊU CẦU' : 'CÓ HẠNG MỤC NG'}</text>`;

  const resolvedTarget = target === undefined ? 'dgTdSummary' : target;
  const svg = dgPut(resolvedTarget, W, H, d.s, 'TdSum');
  storeSvgOutput(target, 'dgTdSummary', svg);
  return svg;
}

/**
 * Visual report handler for `pierFlex.ts`.
 * Re-invokes DOM drawers (`trFigEl`, `trFigIL`, `trFigLane`, `trFigMod`, `trFigSec`)
 * when DOM targets exist, and always emits headless-safe `#dgTdSummary`.
 */
export function renderPierFlexVisuals(payloadOrArg?: unknown): PierVisualResult {
  const payload =
    payloadOrArg && typeof payloadOrArg === 'object'
      ? (payloadOrArg as Record<string, unknown>)
      : {};
  const raw =
    (payload.raw as TrCalcResult | undefined) ?? getLatestTrResult();
  const check =
    (payload.check as TrCheckResult | undefined) ?? getLatestTrCheck();
  const summary =
    'okAll' in payload && 'variant' in payload
      ? (payload as unknown as PierResult)
      : (payload.summary as PierResult | undefined) ?? null;

  if (raw && hasDom()) {
    try {
      trFigEl(raw);
      if (raw.LD?.info?.LL?.LO) {
        trFigIL({ I: raw.I, LO: raw.LD.info.LL.LO });
      }
      trFigLane(raw);
      trFigMod(raw);
      if (check) trFigSec(raw, check);
    } catch (e) {
      console.error(e);
    }
  }

  const summarySvg = drawPierFlexSummarySvg(raw, check, summary);
  if (summarySvg) setOutputValue('dgTdSummary', summarySvg);
  runMathSafe();

  return {
    summarySvg,
    rendered: Boolean(summarySvg),
  };
}

/**
 * Render a compact, headless-safe schematic & utilization SVG for the solid pier
 * (`pierSolid.ts`).
 */
export function drawPierSolidSummarySvg(
  R?: DcCalcResult | null,
  summary?: PierResult | null,
  target?: BridgeSvgTarget,
): string {
  const raw = R ?? getLatestDcResult();
  if (!raw || !raw.Q || !raw.G) return '';

  const Q = raw.Q;
  const G = raw.G;
  const W = 720;
  const H = 260;
  const d = dgKit('DcSum');

  const spanW = Math.max(Q.B1, Q.B5, 4);
  const topZ = G.ELt + 0.5;
  const botZ = G.ELs - Q.H1 - 0.5;
  const spanZ = Math.max(topZ - botZ, 3);
  const k = Math.min(270 / spanW, 185 / spanZ);
  const cx = 195;
  const X = (y: number) => cx + y * k;
  const Y = (z: number) => 28 + (topZ - z) * k;

  // Footing
  d.poly(
    [
      [X(-Q.B1 / 2), Y(G.ELs)],
      [X(Q.B1 / 2), Y(G.ELs)],
      [X(Q.B1 / 2), Y(G.ELs - Q.H1)],
      [X(-Q.B1 / 2), Y(G.ELs - Q.H1)],
    ],
    '#e2e8f0',
  );
  // Pier body
  d.poly(
    [
      [X(-Q.B2 / 2), Y(G.ELs)],
      [X(Q.B2 / 2), Y(G.ELs)],
      [X(Q.B2 / 2), Y(G.ELcb)],
      [X(-Q.B2 / 2), Y(G.ELcb)],
    ],
    '#cbd5e1',
  );
  // Pier cap
  d.poly(
    [
      [X(-Q.B5 / 2), Y(G.ELcb)],
      [X(Q.B5 / 2), Y(G.ELcb)],
      [X(Q.B5 / 2), Y(G.ELt)],
      [X(-Q.B5 / 2), Y(G.ELt)],
    ],
    '#f1f5f9',
  );

  const kx = 390;
  d.s += `<text x="${kx}" y="34" class="b" font-size="13" fill="#1f4e79">TRỤ ĐẶC ĐÁY THẤP (DCT)</text>`;
  d.s += `<text x="${kx}" y="58" font-size="11">Xà mũ: B5 = ${fx(Q.B5, 2)} m × C5 = ${fx(Q.C5, 2)} m × H5 = ${fx(Q.H5, 2)} m</text>`;
  d.s += `<text x="${kx}" y="78" font-size="11">Thân trụ: B2 = ${fx(Q.B2, 2)} m × C2 = ${fx(Q.C2, 2)} m × H2 = ${fx(Q.H2, 2)} m</text>`;
  d.s += `<text x="${kx}" y="98" font-size="11">Bệ móng: B1 = ${fx(Q.B1, 2)} m × C1 = ${fx(Q.C1, 2)} m × H1 = ${fx(Q.H1, 2)} m</text>`;

  const okAll =
    summary?.okAll ??
    Boolean(
      (raw.capOK ?? true) &&
        (raw.colOK ?? true) &&
        (raw.beOK ?? true) &&
        (!raw.err || raw.err.length === 0),
    );
  const ratio = summary?.stemCheck?.pmBiaxial?.maxUtilRatio ?? raw.col?.maxRatio ?? 0;
  d.s += `<text x="${kx}" y="124" font-size="11">Hệ số P-M thân trụ max: ${fx(ratio, 3)}</text>`;
  d.s += `<text x="${kx}" y="148" font-size="12" font-weight="bold" fill="${okAll ? '#15803d' : '#b91c1c'}">Kết luận: ${okAll ? 'ĐẠT YÊU CẦU' : 'CÓ HẠNG MỤC NG'}</text>`;

  const resolvedTarget = target === undefined ? 'dgDcSummary' : target;
  const svg = dgPut(resolvedTarget, W, H, d.s, 'DcSum');
  storeSvgOutput(target, 'dgDcSummary', svg);
  return svg;
}

/**
 * Visual report handler for `pierSolid.ts`.
 * Delegates shallow footing cap diagrams (`#dgSfCap48`) to `sfCapFig` and
 * stores headless-safe summary SVGs (`#dgDcSummary`).
 */
export function renderPierSolidVisuals(payloadOrArg?: unknown): PierVisualResult {
  const payload =
    payloadOrArg && typeof payloadOrArg === 'object'
      ? (payloadOrArg as Record<string, unknown>)
      : {};
  const raw = (payload.raw as DcCalcResult | undefined) ?? getLatestDcResult();
  const summary = (payload.summary as PierResult | undefined) ?? null;
  const sf =
    (payload.sfCapFig as DcSfCapFigDescriptor | null | undefined) ??
    raw?.sfCapFig ??
    null;

  let sfCapSvg = '';
  if (sf) {
    sfCapSvg = sfCapFig(sf.svId, sf.m, sf.c, sf.lab);
    if (sfCapSvg) setOutputValue(sf.svId, sfCapSvg);
  }

  // Also ensure `sfd` result state is retained for callers querying `getLatestDcSfdResult`.
  void (payload.sfd ?? getLatestDcSfdResult());
  const summarySvg = drawPierSolidSummarySvg(raw, summary);
  if (summarySvg) setOutputValue('dgDcSummary', summarySvg);
  runMathSafe();

  return {
    summarySvg,
    sfCapSvg,
    rendered: Boolean(summarySvg || sfCapSvg),
  };
}

// ---------------------------------------------------------------------------
// 5. Bridge Summary & Hook Registration
// ---------------------------------------------------------------------------

/**
 * Render summary visuals across whichever bridge modules currently hold
 * computed runtime results. Safe in headless Node & DOM environments.
 */
export function renderBridgeSummaryVisuals(): BridgeSummaryVisuals {
  const girderHollow =
    getLatestDamResult() || getLatestRcgResult() ? renderGirderHollowVisuals() : null;
  const girderI = getLatestGirResult() ? renderGirderIVisuals() : null;
  const abutmentHeavy =
    getLatestMorResult() || getLatestRcmResult() ? renderAbutmentHeavyVisuals() : null;
  const abutmentFlex = mdOn() && getLatestMorResult() ? renderAbutmentFlexVisuals() : null;
  const pierFlex = getLatestTrResult() ? renderPierFlexVisuals() : null;
  const pierSolid = getLatestDcResult() ? renderPierSolidVisuals() : null;

  return {
    girderHollow,
    girderI,
    abutmentHeavy,
    abutmentFlex,
    pierFlex,
    pierSolid,
  };
}

/**
 * Return the `VisualReportHooks` adapter slice for all 6 bridge solver modules.
 */
export function getBridgeReportHooks(): Partial<VisualReportHooks> {
  return {
    renderMath: () => {
      runMathSafe();
    },
    renderGirderHollow: (payload) => {
      renderGirderHollowVisuals(
        payload?.result as GirderResult | DamCompositeResult | null | undefined,
      );
    },
    renderGirderI: (payload) => {
      renderGirderIVisuals(payload?.result as GirderResult | GiCompositeResult | null | undefined);
    },
    renderAbutmentHeavy: (payload) => {
      renderAbutmentHeavyVisuals(payload?.result);
    },
    renderAbutmentFlex: (payload) => {
      renderAbutmentFlexVisuals(payload?.result);
    },
    renderPierFlex: (payload) => {
      renderPierFlexVisuals(payload?.result);
    },
    renderPierSolid: (payload) => {
      renderPierSolidVisuals(payload?.result);
    },
  };
}

/**
 * Register all 6 bridge visual report hooks on the engine.
 */
export function registerBridgeVisualHooks(): void {
  registerVisualHooks(getBridgeReportHooks());
}
