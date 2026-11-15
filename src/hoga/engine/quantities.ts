/**
 * Chiết tính khối lượng bê tông, ván khuôn, lớp lót, vữa, đào đắp cho từng ga (HDSD chương 4, sheet "KL HG").
 * Đơn vị đầu ra: m³, m², bộ. Khối lượng THÉP do `rebar.ts` tính (cùng bộ thanh dùng để vẽ).
 * Giá trị trả về là cho MỘT ga (nhân `row.count` ở bước tổng hợp).
 */
import type { GaConfig, GaKindInfo, GaRow } from './types';
import { parseDims, pipeOpening, type PipeCatalog, type PipeDef } from './parse';
import { dims, neckArea, neckOf, neckPerimeter, openings, type WallOpening } from './geometry';

const m = (x: number) => x / 1000;

export interface InletGeom {
  /** tường ga chứa cửa thu: 0..3 = T1..T4 */
  wall: number;
  holeW: number;
  holeH: number;
  clearLen: number;
  clearH: number;
  tw: number;
  tb: number;
  linerT: number;
  linerExt: number;
  beamB: number;
  beamH: number;
  /** kích thước ngoài */
  outerW: number;
  outerL: number;
  /** vị trí tâm lỗ dọc tường (mm, trong hệ ga) */
  along: number;
}

export interface InletQty {
  geom: InletGeom;
  liner: number;
  baseConc: number;
  wallConc: number;
  conc: number;
  beamConc: number;
  baseForm: number;
  wallForm: number;
  form: number;
  beamForm: number;
  /** trừ khỏi bê tông / ván khuôn của tường (hoặc cổ) ga */
  cutConc: number;
  cutForm: number;
}

export interface LidQty {
  n: number;
  len: number;
  wid: number;
  thick: number;
  conc: number;
  form: number;
}

export interface DigQty {
  hDig: number;
  hFill: number;
  baseL: number;
  baseB: number;
  topDigL: number;
  topDigB: number;
  topFillL: number;
  topFillB: number;
  dig: number;
  fillFull: number;
  minusLiner: number;
  /** đắp = prism đắp − lót − cát − phần kết cấu nằm trong hố móng */
  fill: number;
}

export interface GaQty {
  name: string;
  count: number;
  /** cao trình: đỉnh / đáy (m) hoặc null */
  levelTop: number | null;
  levelBottom: number | null;
  /** chiều cao ga từ mặt trong đáy đến đỉnh (m) */
  height: number;
  sand: number;
  liner1: number;
  bottomConc: number;
  bottomForm: number;
  wallConc: number;
  wallConcGross: number;
  wallConcCut: number[];
  wallForm: number;
  wallFormGross: number;
  wallFormCut: number[];
  wallRim: number;
  roofConc: number;
  roofForm: number;
  neckConc: number;
  neckForm: number;
  /** vữa chèn khe cống */
  mortarPipe: number;
  /** vữa đệm trần/nắp (m²) */
  mortarRoof: number;
  lidGang: number;
  lid: LidQty | null;
  inlet: InletQty | null;
  dig: DigQty;
}

function perimOpening(op: { w: number; h: number; round: boolean }, kind: PipeDef['kind']): number {
  if (op.round) return Math.PI * m(op.w);
  if (kind === 'ditch') return m(op.w) + 2 * m(op.h);
  return 2 * (m(op.w) + m(op.h));
}
function areaOpening(op: { w: number; h: number; round: boolean }): number {
  return op.round ? (Math.PI * m(op.w) * m(op.w)) / 4 : m(op.w) * m(op.h);
}

export function inletGeom(row: GaRow, cfg: GaConfig): InletGeom | null {
  const hole = parseDims(cfg.inlet.hole);
  const clear = parseDims(cfg.inlet.clear);
  const thick = parseDims(cfg.inlet.thick);
  const liner = parseDims(cfg.inlet.liner);
  const beam = parseDims(cfg.inlet.beam);
  if (!hole || !clear || !thick || hole.length < 2 || clear.length < 2 || thick.length < 2) return null;
  const s = cfg.inlet.side;
  const wall = /T1/.test(s) ? 0 : /T2/.test(s) ? 1 : /T3/.test(s) ? 2 : 3;
  const lenWall = wall === 0 || wall === 2 ? row.L : row.B;
  let along = 0;
  const q = (lenWall - hole[0]) / 2 - 0;
  if (/trái/i.test(s)) along = -q + 0;
  else if (/phải/i.test(s)) along = q;
  return {
    wall,
    holeW: hole[0],
    holeH: hole[1],
    clearLen: clear[0],
    clearH: clear[1],
    tw: thick[0],
    tb: thick[1],
    linerT: liner?.[0] ?? 0,
    linerExt: liner?.[1] ?? 0,
    beamB: beam?.[0] ?? 0,
    beamH: beam?.[1] ?? 0,
    outerW: hole[0] + 2 * thick[0],
    outerL: clear[0] + thick[0],
    along,
  };
}

function inletQty(row: GaRow, cfg: GaConfig): InletQty | null {
  const g = inletGeom(row, cfg);
  if (!g) return null;
  const Wo = m(g.outerW);
  const Lo = m(g.outerL);
  const tw = m(g.tw);
  const tb = m(g.tb);
  const hc = m(g.clearH);
  const baseConc = Wo * Lo * tb;
  const wallConc = (2 * Lo * tw + m(g.holeW) * tw) * hc;
  const run = 2 * Lo + Wo;
  const beamConc = run * m(g.beamB) * m(g.beamH);
  const liner = (Wo + 2 * m(g.linerExt)) * (Lo + m(g.linerExt)) * m(g.linerT);
  const baseForm = (2 * Lo + Wo) * tb;
  const wallForm = (2 * m(g.clearLen) + m(g.holeW)) * hc + (2 * Lo + Wo) * hc;
  const beamForm = 2 * m(g.beamH) * run;
  const thickWall = row.wall.t / 1000;
  const holeA = m(g.holeW) * m(g.holeH);
  const cutConc = -holeA * thickWall;
  const cutForm = -2 * holeA + 2 * (m(g.holeW) + m(g.holeH)) * thickWall;
  return {
    geom: g,
    liner,
    baseConc,
    wallConc,
    conc: baseConc + wallConc + beamConc,
    beamConc,
    baseForm,
    wallForm,
    form: baseForm + wallForm + beamForm,
    beamForm,
    cutConc,
    cutForm,
  };
}

/** Tấm nắp BTCT đúc sẵn: kích thước theo công thức "Tấm nắp BTCT" của KL HG. */
function lidQty(row: GaRow, cfg: GaConfig, info: GaKindInfo): LidQty | null {
  if (!(cfg.lid.type === 'BTCT' && cfg.lid.nSlabs > 0)) return null;
  const n = cfg.lid.nSlabs;
  const gap = m(cfg.lid.gap);
  const d = dims(row, cfg);
  let regionX: number;
  let regionY: number;
  let thick: number;
  if (info.hasNeck) {
    const neck = neckOf(row, cfg, true);
    if (!neck) return null;
    const cham = cfg.neck.chamfer ? parseDims(cfg.neck.chamferSize) : null;
    if (cham) {
      regionX = m(neck.a + 2 * cham[0]);
      regionY = m(neck.b + 2 * cham[0]);
      thick = m(cfg.lid.height + cham[1]);
    } else {
      regionX = m(neck.a + 2 * row.neck.t);
      regionY = m(neck.b + 2 * row.neck.t);
      thick = m(cfg.lid.height);
    }
    const chamOn = !!cham;
    const split = (full: number) => (chamOn ? (full - (n + 1) * gap) / n : (full - (n - 1) * gap) / n);
    const whole = chamOn ? (full: number) => full - 2 * gap : (full: number) => full;
    const len = cfg.lid.dir === 'Dọc' ? split(regionX) : whole(regionX);
    const wid = cfg.lid.dir === 'Dọc' ? whole(regionY) : split(regionY);
    return { n, len, wid, thick, conc: n * len * wid * thick, form: n * (len + wid) * 2 * thick };
  }
  // ga không cổ: tấm nắp phủ lên đỉnh tường (có thể đặt lõm trong vát đỉnh tường)
  const tc = cfg.wall.topChamfer.on ? parseDims(cfg.wall.topChamfer.size) : null;
  const ext = tc ? tc[0] : d.tw;
  regionX = m(d.L + 2 * ext);
  regionY = m(d.B + 2 * ext);
  thick = m(row.roof.t);
  const chamOn = !!tc;
  const split = (full: number) => (chamOn ? (full - (n + 1) * gap) / n : (full - (n - 1) * gap) / n);
  const whole = chamOn ? (full: number) => full - 2 * gap : (full: number) => full;
  const len = cfg.lid.dir === 'Dọc' ? split(regionX) : whole(regionX);
  const wid = cfg.lid.dir === 'Dọc' ? whole(regionY) : split(regionY);
  return { n, len, wid, thick, conc: n * len * wid * thick, form: n * (len + wid) * 2 * thick };
}

export function computeQty(row: GaRow, cfg: GaConfig, cat: PipeCatalog, info: GaKindInfo): GaQty {
  const d = dims(row, cfg);
  const L = m(d.L);
  const B = m(d.B);
  const H = m(d.H);
  const tb = m(d.tb);
  const S = m(d.tw);
  const T = m(d.tr);
  const ext = m(cfg.bottom.ext);
  const c5 = m(cfg.bottom.chamfer);
  const c6 = info.hasNeck && !info.precastRoof ? m(cfg.roof.chamfer) : 0;
  const neck = neckOf(row, cfg, info.hasNeck);
  const U = neck ? m(row.neck.h) : 0;
  const V = neck ? m(row.neck.t) : 0;
  const nA = neck ? neckArea(neck) / 1e6 : 0;
  const nP = neck ? neckPerimeter(neck) / 1000 : 0;
  const ops = openings(row, cfg, cat);

  // ------- lớp lót
  const l1 = { ext: m(cfg.liner.l1Ext), t: m(cfg.liner.l1T) };
  const l2 = { ext: m(cfg.liner.l2Ext), t: m(cfg.liner.l2T) };
  const sand = (L + 2 * (S + ext + l1.ext + l2.ext)) * (B + 2 * (S + ext + l1.ext + l2.ext)) * l2.t;
  const liner1 = (L + 2 * (S + ext + l1.ext)) * (B + 2 * (S + ext + l1.ext)) * l1.t;

  // ------- bản đáy
  const bx = L + 2 * (S + ext);
  const by = B + 2 * (S + ext);
  const bottomConc = bx * by * tb;
  const bottomForm = (bx + by) * 2 * tb;

  // ------- tường
  const notch = info.hasNeck ? null : cfg.wall.topChamfer.on ? parseDims(cfg.wall.topChamfer.size) : null;
  const notchArea = notch ? m(notch[0]) * m(notch[1]) : 0;
  const wallConcGross = ((L + S + (B + S)) * 2 * H * S + (L + B) * c5 * c5 + (L + B) * c6 * c6 - (notch ? 2 * (L + B) * notchArea : 0));
  const wallConcCut: number[] = [0, 0, 0, 0];
  const wallFormCut: number[] = [0, 0, 0, 0];
  let wallRim = 0;
  let mortarPipe = 0;
  for (const o of ops) {
    const op = { w: o.w, h: o.h, round: o.round };
    const outerOp = pipeOpening(o.pipe, 0);
    const a = areaOpening(op);
    wallConcCut[o.wall] = -a * S;
    wallFormCut[o.wall] = -2 * a;
    wallRim += perimOpening(op, o.pipe.kind) * S;
    mortarPipe += (a - areaOpening(outerOp)) * S;
  }
  const inlet = info.hasInlet ? inletQty(row, cfg) : null;
  const inletOnWall = inlet && cfg.inlet.place === 'Thân ga';
  if (inlet && inletOnWall) {
    wallConcCut[inlet.geom.wall] += inlet.cutConc;
    wallFormCut[inlet.geom.wall] += -2 * m(inlet.geom.holeW) * m(inlet.geom.holeH);
    wallRim += 2 * (m(inlet.geom.holeW) + m(inlet.geom.holeH)) * S;
  }
  const wallConc = wallConcGross + wallConcCut.reduce((p, q) => p + q, 0);
  const wallFormGross = ((L + B) * 2 + (L + 2 * S + B + 2 * S) * 2) * H;
  const wallForm = wallFormGross + wallFormCut.reduce((p, q) => p + q, 0) + wallRim;

  // ------- trần (có cổ) – hoặc tấm nắp riêng (không cổ, tính ở lid)
  let roofConc = 0;
  let roofForm = 0;
  if (info.hasNeck) {
    roofConc = ((L + 2 * S) * (B + 2 * S) - nA) * T;
    roofForm = ((L + 2 * S + B + 2 * S) * 2 * T + nP * T + L * B - nA);
  }

  // ------- cổ ga
  let neckConc = 0;
  let neckForm = 0;
  if (neck) {
    const cham = cfg.neck.chamfer ? parseDims(cfg.neck.chamferSize) : null;
    const cb = cham ? m(cham[0]) : 0;
    const ch = cham ? m(cham[1]) : 0;
    if (neck.round) {
      const D = m(neck.a);
      neckConc = Math.PI * (D + V) * V * U;
      if (cham) neckConc -= Math.PI * (D + cb) * cb * ch;
      neckForm = Math.PI * (2 * D + 2 * V) * U;
      if (cham) neckForm += Math.PI * (D + 2 * cb) * ch;
    } else {
      const a = m(neck.a);
      const b = m(neck.b);
      neckConc = (a + b + 2 * V) * 2 * V * U;
      if (cham) neckConc -= (a + b + 2 * cb) * 2 * cb * ch;
      neckForm = (a + b + 2 * V) * 4 * U;
      if (cham) neckForm += 2 * (a + b + 4 * cb) * ch;
    }
    if (inlet && cfg.inlet.place === 'Cổ ga') {
      neckConc += inlet.cutConc * (V / S) ;
      neckForm += inlet.cutForm;
    }
  }

  // ------- vữa đệm trần, nắp
  const mortarRoof = info.precastRoof ? (L + 2 * S) * (B + 2 * S) - L * B : 0;
  const lidGang = cfg.lid.type === 'Gang' ? 1 : 0;
  const lid = lidQty(row, cfg, info);

  // ------- đào đắp
  const lidH = info.hasNeck ? m(cfg.lid.height) : 0;
  // ga không cổ: tấm nắp đặt lõm vào vát đỉnh tường nên đỉnh ga thấp hơn đỉnh tường một đoạn bằng chiều cao vát
  const F = H + (info.hasNeck ? T + U + lidH : T - (notch ? m(notch[1]) : 0));
  const sandH = m(cfg.excavation.sandT);
  const hDig = F + tb + l1.t + sandH - m(cfg.excavation.h0Dig);
  const hFill = F + tb + l1.t + sandH - m(cfg.excavation.h0Fill);
  const baseL = L + (S + l1.ext + m(cfg.excavation.baseExt)) * 2;
  const baseB = B + (S + l1.ext + m(cfg.excavation.baseExt)) * 2;
  const slope = cfg.excavation.slope;
  const frustum = (h: number, a1: number, b1: number, a2: number, b2: number) => (h > 0 ? (1 / 3) * h * (a1 * b1 + a2 * b2 + Math.sqrt(a1 * b1 * a2 * b2)) : 0);
  const topDigL = baseL + 2 * slope * hDig;
  const topDigB = baseB + 2 * slope * hDig;
  const topFillL = baseL + 2 * slope * hFill;
  const topFillB = baseB + 2 * slope * hFill;
  const dig = frustum(hDig, baseL, baseB, topDigL, topDigB);
  const fillFull = frustum(hFill, baseL, baseB, topFillL, topFillB);
  const minusLiner = -(sand + liner1);
  const outerStruct = bx * by * tb + (L + 2 * S) * (B + 2 * S) * H + (info.hasNeck ? (L + 2 * S) * (B + 2 * S) * T + (neck ? m(neck.a + 2 * row.neck.t) * m(neck.b + 2 * row.neck.t) * U : 0) : (L + 2 * S) * (B + 2 * S) * T);
  const fill = Math.max(0, fillFull + minusLiner - outerStruct);

  const total = F + tb;
  const levelBottom = row.level ?? null;
  return {
    name: row.name,
    count: row.count,
    levelTop: levelBottom === null ? null : levelBottom + F,
    levelBottom,
    height: total,
    sand,
    liner1,
    bottomConc,
    bottomForm,
    wallConc,
    wallConcGross,
    wallConcCut,
    wallForm,
    wallFormGross,
    wallFormCut,
    wallRim,
    roofConc,
    roofForm,
    neckConc,
    neckForm,
    mortarPipe,
    mortarRoof,
    lidGang,
    lid,
    inlet,
    dig: { hDig, hFill, baseL, baseB, topDigL, topDigB, topFillL, topFillB, dig, fillFull, minusLiner, fill },
  };
}

export type { WallOpening };
