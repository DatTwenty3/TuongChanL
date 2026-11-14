/**
 * BangTinhCauCong Web App — Bridge Deck Crossfall, Girder Layout, Precast Stay-in-Place
 * Panel Geometry, Superstructure Dead-Load Distribution & Scope Link Helpers.
 *
 * Clean-room TypeScript port of:
 *  - `XFmk`, `XFgir`, `ITOP`, `IPAN`, `SUPDIST` (`13_pier_flexible_tr.js:10-188`)
 *  - `spXF`, `xfLink` (`10_superstructure_ui_and_deck_joints.js:11-37, 924-973`)
 *  - `moXF` (`08_flexible_abutment_md.js:10-34`)
 *  - `OBJ_TABS`, `objMode`, `objLinkOff`, `objOn`, `objUnlock` (`16_dem_watershed_ocr_dxf_import.js:4106-4139`)
 */

import { IT_TAB, OBJ_TABS, type ObjScope, type Point2D, type TabId } from '../../types/project';
import { $, num, v } from '../context';

export type CapSlopeMode = 'theo' | 'phang' | 'rieng';
export type GirderPlacementMode = 'doc' | 'bang';

export interface CrossfallConfig {
  iL?: number | string;
  iR?: number | string;
  yc?: number | string;
  mode?: CapSlopeMode | string;
  mL?: number | string;
  mR?: number | string;
  gpl?: GirderPlacementMode | string;
}

export interface GirderElevationOffsetResult {
  dG: number[];
  dGc: number | null;
  Atd: number;
  y1?: number;
  y2?: number;
}

export interface PedestalHeightResult {
  h: number[];
  m: number;
  dG: number[];
  dGc?: number | null;
  Atd?: number;
  y1?: number;
  y2?: number;
}

export interface CrossfallModel {
  iL: number;
  iR: number;
  yc: number;
  mode: string;
  mL: number;
  mR: number;
  dD: (y: number) => number;
  dM: (y: number) => number;
  hk: (ys: number[], h0: number) => PedestalHeightResult;
  gir: (ys: number[]) => GirderElevationOffsetResult;
  gpl: GirderPlacementMode;
  avg: (fn: (y: number) => number, a: number, b: number) => number;
  flat: boolean;
  same: boolean;
}

export function XFmk(o: CrossfallConfig = {}): CrossfallModel {
  const n = (val: unknown): number => (Number.isFinite(Number(val)) ? Number(val) : 0);
  const iL = n(o.iL);
  const iR = n(o.iR);
  const yc = n(o.yc);
  const mode = o.mode || 'theo';
  const mL = mode === 'phang' ? 0 : mode === 'rieng' ? n(o.mL) : iL;
  const mR = mode === 'phang' ? 0 : mode === 'rieng' ? n(o.mR) : iR;
  const f = (a: number, b: number) => (y: number) =>
    (y < yc ? a * (yc - y) : b * (y - yc)) / 100;
  const dD = f(iL, iR);
  const dM = f(mL, mR);
  const gpl: GirderPlacementMode = o.gpl === 'bang' ? 'bang' : 'doc';

  const gir = (ys: number[]): GirderElevationOffsetResult => {
    if (!ys.length) return { dG: [], dGc: 0, Atd: 0 };
    if (gpl !== 'bang') return { dG: ys.map(dD), dGc: null, Atd: 0 };
    const y1 = Math.min(...ys);
    const y2 = Math.max(...ys);
    const dGc = Math.max(dD(y1), dD(y2));
    let A = 0;
    const N = 200;
    for (let i = 0; i < N; i++) {
      const y = y1 + ((i + 0.5) * (y2 - y1)) / N;
      A += (Math.max(0, dGc - dD(y)) * (y2 - y1)) / N;
    }
    return { dG: ys.map(() => dGc), dGc, Atd: A, y1, y2 };
  };

  const hk = (ys: number[], h0: number): PedestalHeightResult => {
    if (!ys.length) return { h: [], m: 0, dG: [] };
    const g = gir(ys);
    const dz = ys.map((y, j) => dM(y) - g.dG[j]);
    const m = Math.min(...dz);
    return {
      h: dz.map((val) => h0 + val - m),
      m,
      dG: g.dG,
      dGc: g.dGc,
      Atd: g.Atd,
      y1: g.y1,
      y2: g.y2,
    };
  };

  const avg = (fn: (y: number) => number, a: number, b: number): number => {
    if (b <= a) return 0;
    let s = 0;
    const N = 200;
    for (let i = 0; i < N; i++) s += fn(a + ((i + 0.5) * (b - a)) / N);
    return s / N;
  };

  return {
    iL,
    iR,
    yc,
    mode,
    mL,
    mR,
    dD,
    dM,
    hk,
    gir,
    gpl,
    avg,
    flat: mL === 0 && mR === 0,
    same: mL === iL && mR === iR,
  };
}

export function XFgir(Ng: number, S: number, Sb?: number): number[] {
  const nGir = Math.max(1, Math.round(Ng));
  if (nGir === 1) return [0];
  const sp: number[] = [];
  for (let i = 0; i < nGir - 1; i++) {
    sp.push(i === 0 || i === nGir - 2 ? Sb || S : S);
  }
  const L = sp.reduce((a, b) => a + b, 0);
  const ys = [-L / 2];
  sp.forEach((d) => ys.push(ys[ys.length - 1] + d));
  return ys;
}

export interface ITopFlangeGeom {
  a: number;
  c: number;
  h6: number;
}

export function ITOP(P: ReadonlyArray<Point2D> | null | undefined, H: number): ITopFlangeGeom {
  const pts = (P || []).map((p): Point2D => [Math.abs(p[0]), p[1]]);
  const top = pts.filter((p) => p[1] > H - 1);
  const a = top.length ? Math.max(...top.map((p) => p[0])) : 325;
  const lo = pts.filter((p) => p[1] < H - 1 && p[1] > H - 400);
  if (!lo.length) return { a, c: a, h6: 0 };
  const yE = Math.max(...lo.map((p) => p[1]));
  const c = Math.max(...lo.filter((p) => Math.abs(p[1] - yE) < 1).map((p) => p[0]));
  return c > a + 1 ? { a, c, h6: H - yE } : { a, c: a, h6: 0 };
}

export interface IPanDrawOptions {
  xg: number[];
  geo: ITopFlangeGeom[];
  tp: number;
  zgt: (i: number) => number;
  zsb: (x: number) => number;
  xL: number;
  xR: number;
  P: (x: number, z: number) => Point2D;
  poly: (pts: Point2D[], fill: string) => void;
  fp: string;
  fd: string;
}

export function IPAN(o: IPanDrawOptions): Point2D | null {
  const n = o.xg.length;
  const P = o.P;
  const g = o.geo;
  const tp = o.tp;
  let lab: Point2D | null = null;
  for (let i = 0; i + 1 < n; i++) {
    const xa = o.xg[i] + g[i].a;
    const xb = o.xg[i + 1] - g[i + 1].a;
    if (xb - xa <= 0) continue;
    const za = o.zgt(i) - g[i].h6;
    const zb = o.zgt(i + 1) - g[i + 1].h6;
    o.poly([P(xa, za), P(xb, zb), P(xb, zb + tp), P(xa, za + tp)], o.fp);
    if (lab == null) lab = [(xa + xb) / 2, (za + zb) / 2 + tp / 2];
    if (o.zsb(xa) > za + tp + 1e-9 || o.zsb(xb) > zb + tp + 1e-9) {
      o.poly([P(xa, za + tp), P(xb, zb + tp), P(xb, o.zsb(xb)), P(xa, o.zsb(xa))], o.fd);
    }
  }
  for (let i = 0; i < n; i++) {
    const a = o.xg[i] - g[i].a;
    const b = o.xg[i] + g[i].a;
    const z = o.zgt(i);
    if (o.zsb(a) > z + 1e-9 || o.zsb(b) > z + 1e-9) {
      o.poly([P(a, z), P(b, z), P(b, o.zsb(b)), P(a, o.zsb(a))], o.fd);
    }
  }
  if (n > 0) {
    (
      [
        [0, -1, o.xL],
        [n - 1, 1, o.xR],
      ] as const
    ).forEach(([i, sg, xe]) => {
      const xa = o.xg[i] + sg * g[i].a;
      const xc = o.xg[i] + sg * g[i].c;
      const zl = o.zgt(i) - g[i].h6;
      if (sg * (xe - xc) <= 0) return;
      o.poly([P(xa, o.zsb(xa)), P(xe, o.zsb(xe)), P(xc, zl), P(xa, zl)], o.fd);
    });
  }
  return lab;
}

export interface SupDistInput {
  Wd: number;
  bl: number;
  br: number;
  wp?: number;
  wpA?: number;
  wpB?: number;
  DC: number;
  DCe?: number;
  DCs?: number;
  DW?: number;
}

export interface SupDistResult {
  dc: number[];
  dw: number[];
}

export function SUPDIST(xg: number[], o: SupDistInput): SupDistResult {
  const nb = xg.length;
  const dc = new Array<number>(nb).fill(0);
  const dw = new Array<number>(nb).fill(0);
  const lev = (x: number, P: number, out: number[]) => {
    if (nb === 1) {
      out[0] += P;
      return;
    }
    let j = 0;
    if (x <= xg[0]) j = 0;
    else if (x >= xg[nb - 1]) j = nb - 2;
    else {
      while (j < nb - 2 && x > xg[j + 1]) j++;
    }
    const a = xg[j];
    const b = xg[j + 1];
    out[j] += (P * (b - x)) / (b - a);
    out[j + 1] += (P * (x - a)) / (b - a);
  };
  const W = o.Wd;
  const wA = Math.max(0, o.wpA != null ? o.wpA : o.wp || 0);
  const wB = Math.max(0, o.wpB != null ? o.wpB : o.wp || 0);
  const pl = Math.max(0, o.bl - wA);
  const pr = Math.max(0, o.br - wB);
  const DCe = Math.max(0, o.DCe || 0);
  const DCs = Math.max(0, o.DCs || 0);
  const rest = o.DC - DCe - DCs;
  if (!(nb > 0)) return { dc, dw };
  if (DCe > 0 && rest >= 0) {
    lev(-W / 2 + pl / 2, DCe / 2, dc);
    lev(W / 2 - pr / 2, DCe / 2, dc);
    if (DCs > 0 && wA + wB > 0) {
      for (let k = 0; k < 4; k++) {
        if (wA > 0) lev(-W / 2 + pl + (wA * (k + 0.5)) / 4, (DCs * wA) / (wA + wB) / 4, dc);
        if (wB > 0) lev(W / 2 - pr - (wB * (k + 0.5)) / 4, (DCs * wB) / (wA + wB) / 4, dc);
      }
    }
    for (let j = 0; j < nb; j++) dc[j] += rest / nb;
  } else {
    for (let j = 0; j < nb; j++) dc[j] += o.DC / nb;
  }
  const a = -W / 2 + o.bl;
  const b = W / 2 - o.br;
  if ((o.DW || 0) > 0 && b > a) {
    const m = 40;
    for (let k = 0; k < m; k++) lev(a + ((b - a) * (k + 0.5)) / m, (o.DW || 0) / m, dw);
  } else {
    for (let j = 0; j < nb; j++) dw[j] += (o.DW || 0) / nb;
  }
  return { dc, dw };
}

export interface SpXfResult {
  XF: CrossfallModel;
  ys: number[];
  g: GirderElevationOffsetResult;
  hsxG: number;
  hsxB: number;
}

export function spXF(I: { Ng: number; S: number; icL?: number; icR?: number; icy?: number; gpl?: string }): SpXfResult {
  const XF = XFmk({
    iL: I.icL != null ? I.icL : num('sp_icL'),
    iR: I.icR != null ? I.icR : num('sp_icR'),
    yc: I.icy != null ? I.icy : num('sp_icy'),
    gpl: I.gpl != null ? I.gpl : v('sp_gpl', 'doc'),
  });
  const ys = XFgir(I.Ng, I.S, I.S);
  const g = XF.gir(ys);
  const ex = (j: number): number => {
    if (g.dGc == null) return 0;
    const a = ys[j] - I.S / 2;
    const b = ys[j] + I.S / 2;
    let s = 0;
    const N = 60;
    for (let i = 0; i < N; i++) {
      const y = a + ((i + 0.5) * (b - a)) / N;
      if ((g.y1 != null && y < g.y1 - 1e-9) || (g.y2 != null && y > g.y2 + 1e-9)) continue;
      s += Math.max(0, g.dGc - XF.dD(y)) / N;
    }
    return s;
  };
  const n = ys.length;
  const xG = n > 2 ? Math.max(...ys.slice(1, -1).map((_, j) => ex(j + 1))) : ex(0);
  const xB = Math.max(ex(0), ex(n - 1));
  return { XF, ys, g, hsxG: xG, hsxB: xB };
}

export interface MoXfInputLike {
  icr?: number;
  icrR?: number;
  icy?: number;
  ixm?: string;
  ix?: number;
  ixR?: number;
  gpl?: string;
  dkn: number;
  Ng?: number;
  L?: number;
  ut?: number;
  up?: number;
  Sg?: number;
  Sb?: number;
  dkh: number;
}

export interface MoXfResult {
  XF: CrossfallModel;
  ys: number[];
  HK: PedestalHeightResult;
  sumH: number;
  dV: number;
  GY: number[];
  Atd: number;
}

export function moXF(I: MoXfInputLike, w?: number): MoXfResult {
  const XF = XFmk({
    iL: I.icr,
    iR: I.icrR != null ? I.icrR : I.icr,
    yc: I.icy || 0,
    mode: I.ixm || 'theo',
    mL: I.ix,
    mR: I.ixR != null ? I.ixR : I.ix,
    gpl: I.gpl,
  });
  const n = Math.max(0, Math.round(I.dkn));
  const Ng = Math.max(1, Math.round(I.Ng || 1));
  const wcl = (I.L || 0) - (I.ut || 0) - (I.up || 0);
  const ys =
    n === Ng
      ? XFgir(Ng, I.Sg || 1, I.Sb || I.Sg || 1)
      : [...Array(n)].map((_, i) => -wcl / 2 + (wcl * (i + 0.5)) / Math.max(n, 1));
  const HK = XF.hk(ys, I.dkh);
  const sumH = HK.h.reduce((t, h) => t + h, 0);
  const W = w != null ? w : wcl;
  const dV = W > 0 ? XF.avg(XF.dM, -W / 2, W / 2) * W : 0;
  const GY = XFgir(Math.max(1, Math.round(I.Ng || 1)), I.Sg || 1, I.Sb || I.Sg || 1);
  const TD = XF.gir(GY);
  return { XF, ys, HK, sumH, dV, GY, Atd: TD.Atd };
}

export function objMode(): ObjScope {
  const val = v('tq_obj', 'all');
  if (val === 'dam' || val === 'mo' || val === 'tru') return val;
  return 'all';
}

export function objLinkOff(): boolean {
  const m = objMode();
  return m === 'mo' || m === 'tru';
}

export function itOffSet(): Set<string> {
  const raw = v('tq_off', '');
  return new Set(
    String(raw || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean),
  );
}

export function itOn(tabId: number | string): boolean {
  const k = IT_TAB[Number(tabId) as TabId];
  return !k || !itOffSet().has(k);
}

export function objOn(tabId: number | string): boolean {
  const t = Number(tabId) as TabId;
  const m = objMode();
  if (t === 7) return true;
  if (!itOn(t)) return false;
  if (m === 'all') return true;
  return (OBJ_TABS[m] || []).includes(t);
}

export function objUnlock(): void {
  if (typeof document === 'undefined') return;
  document
    .querySelectorAll<HTMLInputElement | HTMLSelectElement>('[id^="mo_"].lnk,[id^="td_"].lnk')
    .forEach((e) => {
      if (e.id === 'mo_d1') return;
      if ('readOnly' in e) e.readOnly = false;
      e.disabled = false;
      e.classList.remove('lnk');
      e.title = '';
    });
  const n = $('moLnkNote');
  if (n) {
    n.textContent =
      'Tính riêng mố: nhập trực tiếp số liệu kết cấu nhịp, gối (không lấy từ sheet dầm, gối).';
  }
}

export function xfLink(): void {
  if (objLinkOff()) return;
  const setLinked = (id: string, val: string | number | null | undefined, sel?: boolean) => {
    const e = $(id);
    if (!e || val == null) return;
    const s = String(val);
    if (e.value !== s) e.value = s;
    if (sel) e.disabled = false;
    e.readOnly = true;
    e.classList?.add('lnk');
    e.title = 'Lấy từ sheet kiểm toán dầm (dốc ngang mặt cầu, bố trí dầm)';
  };
  const getVal = (id: string) => v(id, '');
  (
    [
      ['mo_icr', 'sp_icL'],
      ['mo_icrR', 'sp_icR'],
      ['mo_icy', 'sp_icy'],
      ['td_icL', 'sp_icL'],
      ['td_icR', 'sp_icR'],
      ['td_icy', 'sp_icy'],
    ] as const
  ).forEach(([a, b]) => setLinked(a, getVal(b)));
  (['mo_gpl', 'td_gpl'] as const).forEach((a) => {
    const e = $(a);
    if (e) {
      const gplVal = getVal('sp_gpl');
      if (e.value !== gplVal) e.value = gplVal;
      e.classList?.add('lnk');
      e.title = 'Lấy từ sheet kiểm toán dầm';
    }
  });
  const ng = parseFloat(getVal('sp_Ng'));
  if (ng > 0) {
    setLinked('mo_dkn', Math.round(ng));
    const e = $('mo_dkn');
    if (e) e.title = 'Mỗi dầm chủ một đá kê gối (lấy theo số dầm ở sheet kiểm toán dầm)';
  }
  if (getVal('sp_type') === 'I') {
    const eVt = $('mo_vt');
    if (eVt && !(parseFloat(eVt.value) > 0)) eVt.value = '0.3';
    const ek = $('mo_kt');
    if (ek && !(parseFloat(ek.value) > 0)) ek.value = getVal('mo_jtm');
  }
}
