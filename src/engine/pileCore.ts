/**
 * Móng cọc BTCT – sức chịu tải dọc trục và phản lực đầu cọc theo TCVN 10304:2025.
 *
 *  - Công thức (2): γn·Nd ≤ Rd = Rk/γk.
 *  - Cọc đóng / ép (Điều 7.2.2): Rk = γc (γR,R qb A + u Σ γR,f fi hi), qb theo Bảng 2, fi theo Bảng 3,
 *    γR,R và γR,f theo Bảng 4.
 *  - Cọc nhồi / khoan (Điều 7.2.3): cùng công thức (13); qb cát theo (14) + Bảng 7, qb sét theo Bảng 8;
 *    γR,f theo Bảng 6.
 *  - Theo SPT: Phụ lục D (Bảng D.1). Theo thí nghiệm: Rk nhập trực tiếp.
 *  - Cọc chịu kéo: công thức (11)/(16).
 *  - Nd theo công thức (3): Nd = Nd,f/n ± Mx·y/Σyi² (móng một hướng).
 *
 * Đơn vị: m, kN, kPa. Độ sâu cho bảng tra tính từ mặt đất tự nhiên (design.z0 + độ sâu từ đáy đài).
 */

import type { PileConfig, PileSoilLayer } from '../types/project.ts';
import { pileArea, pileGrid, type PileGrid } from './pileGeom.ts';
import { pileOn } from './pile.ts';
import {
  GAMMA_N,
  boredGammaRf,
  drivenCoef,
  fiDriven,
  gammaCTension,
  gammaKCompression,
  gammaKTension,
  openHollowTipCoef,
  qbBoredClay,
  qbBoredSand,
  qbDriven,
  type TableSoil,
} from './tcvn10304.ts';
import type { EngineProject } from './types.ts';

/** Phản lực của tường tại đáy bản đáy cho một tổ hợp (trên 1 m dài tường). */
export interface PileWallCombo {
  k: string;
  nm: string;
  /** Lực đứng (kN/m), dương hướng xuống. */
  N: number;
  /** Độ lệch tâm của hợp lực so với tâm đáy đài (m): dương về phía gót, âm về phía mũi. */
  s: number;
  /** Lực ngang (kN/m). */
  H: number;
}

export interface PileSkinRow {
  layer: string;
  kind: 'sand' | 'clay';
  /** Độ sâu từ đáy đài (m). */
  from: number;
  to: number;
  hi: number;
  /** Độ sâu trung bình tính từ mặt đất tự nhiên (m). */
  zNat: number;
  fi: number;
  gRf: number;
  /** γR,f·fi·hi (kN/m chu vi). */
  term: number;
  note?: string;
}

export interface PileCapacity {
  method: PileConfig['method'];
  A: number;
  u: number;
  /** Sức kháng đơn vị dưới mũi (kPa). */
  qb: number;
  qbSrc: string;
  gRR: number;
  gc: number;
  /** Thành phần mũi và thân (kN). */
  Rb: number;
  Rf: number;
  Rk: number;
  rows: PileSkinRow[];
  tipLayer: string;
  tipZNat: number;
  notes: string[];
}

export interface PileReaction {
  k: string;
  nm: string;
  Nwall: number;
  s: number;
  /** Phản lực đầu cọc từng hàng (kN, chưa gồm trọng lượng bản thân cọc), dương = nén. */
  rows: number[];
}

export interface PileResult {
  grid: PileGrid;
  /** Có tính được sức chịu tải hay không (đủ số liệu). */
  ok: boolean;
  missing: string[];
  warn: string[];
  gn: number;
  comp?: PileCapacity & { gk: number; gkNote: string; Rd: number };
  tens?: { Rk: number; gc: number; gk: number; Rd: number };
  reactions: PileReaction[];
  /** Trọng lượng bản thân cọc (kN): nhân hệ số khi nén / khi kéo. */
  Wp: number;
  WpComp: number;
  WpTens: number;
  /** Tải nén lớn nhất lên một cọc (kN) và nơi xảy ra. */
  NdMax: number;
  NdMaxAt: string;
  /** Lực kéo lớn nhất lên một cọc (kN); 0 nếu không có cọc chịu kéo. */
  NdTens: number;
  NdTensAt: string;
  /** Hệ số sử dụng γn·Nd/Rd khi nén / khi kéo (null nếu không áp dụng). */
  vAxial: number | null;
  vUplift: number | null;
  /** Bước cọc hiệu dụng dọc tường (m) dùng quy đổi tải trên 1 m dài ra mỗi cọc. */
  sEff: number;
  /** Khoảng cách tim cọc nhỏ nhất (m). */
  minSpacing: number;
}

const GAMMA_CONC = 25; // kN/m³, bê tông cốt thép
const GF_COMP = 1.1;
const GF_TENS = 0.9;

const tableSoil = (l: PileSoilLayer): TableSoil => ({
  kind: l.kind === 'sand' ? 'sand' : 'clay',
  grain: l.grain,
  IL: l.IL,
  clayType: l.clayType,
});

interface Seg {
  layer: PileSoilLayer;
  from: number;
  to: number;
}

/** Các đoạn của cọc theo từng lớp đất (độ sâu từ đáy đài, m). */
function segments(q: PileConfig): { segs: Seg[]; covered: number } {
  const segs: Seg[] = [];
  let z = 0;
  for (const l of q.layers) {
    const z1 = z + Math.max(0, l.thk);
    const a = Math.max(z, 0);
    const b = Math.min(z1, q.L);
    if (b > a + 1e-9) segs.push({ layer: l, from: a, to: b });
    z = z1;
  }
  return { segs, covered: z };
}

/** Chia mỗi đoạn thành các lớp đồng nhất dày ≤ 2 m (Chú thích 2 của Bảng 3). */
function split2m(segs: Seg[]): Seg[] {
  const out: Seg[] = [];
  for (const s of segs) {
    const len = s.to - s.from;
    const n = Math.max(1, Math.ceil(len / 2 - 1e-9));
    const h = len / n;
    for (let i = 0; i < n; i++) out.push({ layer: s.layer, from: s.from + i * h, to: s.from + (i + 1) * h });
  }
  return out;
}

const fmtN = (x: number, d = 2): string => x.toFixed(d).replace('.', ',');

interface CapOut {
  cap?: PileCapacity;
  missing: string[];
  warn: string[];
}

/** Sức chịu tải tiêu chuẩn Rk khi nén theo phương pháp đã chọn. */
export function pileCapacityCompression(P: EngineProject): CapOut {
  const q = P.pile as PileConfig;
  const warn: string[] = [];
  const missing: string[] = [];
  const A = pileAreaBearing(q);
  const u = q.type === 'sq' ? 4 * q.size : Math.PI * q.size;

  if (q.method === 'test') {
    if (!(q.Qtest != null && q.Qtest > 0)) {
      missing.push('Chưa nhập sức chịu tải giới hạn của cọc từ thí nghiệm.');
      return { missing, warn };
    }
    return {
      missing,
      warn,
      cap: {
        method: 'test',
        A,
        u,
        qb: 0,
        qbSrc: 'nhập từ thí nghiệm',
        gRR: 1,
        gc: 1,
        Rb: 0,
        Rf: 0,
        Rk: q.Qtest,
        rows: [],
        tipLayer: '',
        tipZNat: P.pile!.design.z0 + q.L,
        notes: ['Rk lấy bằng sức chịu tải giới hạn từ thí nghiệm do người dùng nhập.'],
      },
    };
  }

  const { segs, covered } = segments(q);
  if (covered + 1e-9 < q.L) {
    missing.push(
      `Địa tầng mới dài ${fmtN(covered, 1)} m, chưa phủ hết chiều dài cọc ${fmtN(q.L, 1)} m dưới đáy đài.`,
    );
  }
  if (!segs.length) missing.push('Chưa có lớp đất nào nằm trong phạm vi chiều dài cọc.');
  if (segs.some((s) => s.layer.kind === 'rock')) {
    missing.push('Mô đun chưa hỗ trợ lớp đá trong phạm vi cọc / dưới mũi cọc (cọc chống tựa đá).');
  }
  if (missing.length) return { missing, warn };

  const z0 = q.design.z0;
  const tipSeg = segs[segs.length - 1];
  const tipLayer = tipSeg.layer;
  const tipSoil = tableSoil(tipLayer);
  const zTip = z0 + q.L;

  if (q.method === 'spt') return pileCapacitySpt(P, segs, A, u, tipLayer, zTip, warn);

  const pieces = split2m(segs);
  const rows: PileSkinRow[] = [];
  const notes: string[] = [];
  const driven = q.type !== 'bored';
  const dInner = Math.max(0, q.size - 2 * q.wall);

  // --- sức kháng đơn vị dưới mũi qb và γR,R
  let qb = 0;
  let qbSrc = '';
  let gRR = 1;
  let gc = 1;
  if (driven) {
    const dc = drivenCoef(q.design.install, tipSoil, tipSoil, { gRR: q.design.gRR, gRf: q.design.gRf });
    gRR = dc.gRR;
    if (q.type === 'phc' && !q.design.tipClosed && q.design.install === 'hammer') {
      gRR = openHollowTipCoef(dInner);
      notes.push(`Cọc ly tâm mũi hở hạ bằng búa: γR,R = ${fmtN(gRR, 1)} theo Bảng 4 (đường kính lòng cọc ${fmtN(dInner)} m).`);
    }
    const lk = qbDriven(zTip, tipSoil);
    if (lk.clamped) warn.push(`qb (Bảng 2): ${lk.clamped}.`);
    qb = lk.v * tipLayer.kb;
    if (tipLayer.kb > 1) qb = Math.min(qb, 20000);
    qbSrc = `Bảng 2, mũi cọc ở độ sâu ${fmtN(zTip, 1)} m, ${soilText(tipLayer)}${tipLayer.kb !== 1 ? `, hệ số hiệu chỉnh ${fmtN(tipLayer.kb)}` : ''}`;
  } else {
    gRR = 1;
    if (tipSoil.kind === 'sand') {
      const gAbove = meanGammaAbove(q, z0, q.L);
      const b = qbBoredSand({ phi: tipLayer.phi, d: q.size, h: zTip, gammaTipEff: tipLayer.gamma, gammaAbove: gAbove });
      const tab2 = qbDriven(zTip, tipSoil).v;
      qb = Math.min(b.v, tab2) * tipLayer.kb;
      if (b.alpha.clamped) warn.push(`qb (Bảng 7): ${b.alpha.clamped}.`);
      qbSrc = `công thức (14): α1=${fmtN(b.alpha.a1, 1)}, α2=${fmtN(b.alpha.a2, 1)}, α3=${fmtN(b.alpha.a3)}, α4=${fmtN(b.alpha.a4)}, φ=${fmtN(tipLayer.phi, 1)}°, h=${fmtN(zTip, 1)} m` +
        (b.v > tab2 ? `; bị khống chế bởi Bảng 2 (${fmtN(tab2, 0)} kPa)` : '');
    } else {
      const lk = qbBoredClay(zTip, tipLayer.IL);
      if (!lk) {
        missing.push(
          `Bảng 8 không có giá trị qb cho mũi cọc ở độ sâu ${fmtN(zTip, 1)} m với IL = ${fmtN(tipLayer.IL)}; cần thí nghiệm nén tĩnh cọc (Điều 7.2.3.5).`,
        );
        return { missing, warn };
      }
      if (lk.clamped) warn.push(`qb (Bảng 8): ${lk.clamped}.`);
      qb = lk.v * tipLayer.kb;
      qbSrc = `Bảng 8, mũi cọc ở độ sâu ${fmtN(zTip, 1)} m, IL = ${fmtN(tipLayer.IL)}`;
    }
    gc = tipSoil.kind === 'clay' && q.design.srLow ? 0.8 : 1.0;
    if (gc < 1) notes.push('γc = 0,8: mũi cọc tựa đất loại sét có Sr < 0,85 (Điều 7.2.3.1).');
  }

  // --- ma sát hông
  let sumTerm = 0;
  for (const s of pieces) {
    const soil = tableSoil(s.layer);
    const hi = s.to - s.from;
    const zNat = z0 + (s.from + s.to) / 2;
    const lk = fiDriven(zNat, soil);
    if (lk.clamped) warn.push(`fi (Bảng 3), lớp "${s.layer.name}": ${lk.clamped}.`);
    const fi = lk.v * s.layer.kf;
    const gRf = driven
      ? drivenCoef(q.design.install, tipSoil, soil, { gRR: q.design.gRR, gRf: q.design.gRf }).gRf
      : boredGammaRf(q.design.bored, soil);
    const term = gRf * fi * hi;
    sumTerm += term;
    rows.push({
      layer: s.layer.name,
      kind: soil.kind,
      from: s.from,
      to: s.to,
      hi,
      zNat,
      fi,
      gRf,
      term,
    });
  }

  const Rb = gRR * qb * A;
  const Rf = u * sumTerm;
  const Rk = gc * (Rb + Rf);
  return {
    missing,
    warn,
    cap: { method: 'tcvn', A, u, qb, qbSrc, gRR, gc, Rb, Rf, Rk, rows, tipLayer: tipLayer.name, tipZNat: zTip, notes },
  };
}

function pileAreaBearing(q: PileConfig): number {
  // Diện tích tựa: tiết diện nguyên (cọc đặc / rỗng mũi kín); cọc ly tâm mũi hở dùng tiết diện ngang nguyên
  // kèm hệ số γR,R của Bảng 4 hàng 5.
  if (q.type === 'sq') return q.size * q.size;
  return (Math.PI * q.size * q.size) / 4;
}

const soilText = (l: PileSoilLayer): string =>
  l.kind === 'sand'
    ? `cát ${{ gravelly: 'lẫn sỏi sạn', coarse: 'thô', medium: 'vừa', fine: 'mịn', silt: 'bụi' }[l.grain]}`
    : `đất sét IL = ${fmtN(l.IL)}`;

/** γ trung bình của đất phía trên mũi cọc (kể cả đoạn từ mặt đất tự nhiên đến đáy đài). */
function meanGammaAbove(q: PileConfig, z0: number, L: number): number {
  const { segs } = segments(q);
  const first = q.layers[0]?.gamma ?? 18;
  let w = z0 * first;
  let h = z0;
  for (const s of segs) {
    const len = Math.min(s.to, L) - s.from;
    w += len * s.layer.gamma;
    h += len;
  }
  return h > 0 ? w / h : first;
}

/** Phụ lục D – sức chịu tải giới hạn theo SPT (Bảng D.1). */
function pileCapacitySpt(
  P: EngineProject,
  segs: Seg[],
  A: number,
  u: number,
  tipLayer: PileSoilLayer,
  zTip: number,
  warn: string[],
): CapOut {
  const q = P.pile as PileConfig;
  const missing: string[] = [];
  const bored = q.type === 'bored';
  const d = q.size;
  const notes: string[] = [];

  // N trung bình: cọc đóng (ép) trong khoảng 1d dưới và 4d trên mũi; cọc khác 1d dưới và 1d trên mũi
  const up = bored ? 1 * d : 4 * d;
  const dn = 1 * d;
  const lo = Math.max(0, q.L - up);
  const hi = q.L + dn;
  let sw = 0;
  let sl = 0;
  let z = 0;
  for (const l of q.layers) {
    const z1 = z + Math.max(0, l.thk);
    const a = Math.max(z, lo);
    const b = Math.min(z1, hi);
    if (b > a) {
      sw += Math.min(100, l.N) * (b - a);
      sl += b - a;
    }
    z = z1;
  }
  const Nbar = sl > 0 ? sw / sl : Math.min(100, tipLayer.N);
  if (z + 1e-9 < hi) warn.push('Địa tầng không phủ hết 1d dưới mũi cọc: chỉ số N trung bình lấy trên phần có số liệu.');

  const cuOf = (l: PileSoilLayer): number => (l.Su > 0 ? l.Su : 6.25 * l.N);
  const tipSand = tipLayer.kind === 'sand';

  // η: hiệu quả cản mũi (cọc đóng / ép)
  let eta = 1;
  if (!bored && q.type === 'phc' && !q.design.tipClosed) {
    const dint = Math.max(0.01, q.size - 2 * q.wall);
    // L: chiều sâu ngàm trong lớp chịu lực = tổng chiều dài cọc nằm trong lớp mũi
    const emb = segs.filter((s) => s.layer === tipLayer).reduce((t, s) => t + (s.to - s.from), 0);
    const r = emb / dint;
    eta = r > 5 ? 0.8 : 0.16 * r;
    if (r < 2) warn.push('L/dint < 2: tiêu chuẩn chưa quy định η cho cọc mũi hở; đang lấy η = 0,16·L/dint.');
    notes.push(`η = ${fmtN(eta)} (cọc mũi hở, L/dint = ${fmtN(r, 1)}).`);
  }

  const qbCap = bored ? 7500 : 18000;
  let qb: number;
  let qbSrc: string;
  if (tipSand) {
    qb = bored ? 120 * Nbar : 300 * eta * Nbar;
    qbSrc = `Bảng D.1: ${bored ? '120' : '300η'}·N̄ với N̄ = ${fmtN(Nbar, 1)} (đất rời)`;
  } else {
    qb = 6 * cuOf(tipLayer);
    qbSrc = `Bảng D.1: 6·cu với cu = ${fmtN(cuOf(tipLayer), 1)} kPa (đất dính)`;
  }
  const qbRaw = qb;
  qb = Math.min(qb, qbCap);
  if (qb < qbRaw) qbSrc += `; giới hạn cận trên ${fmtN(qbCap, 0)} kPa`;

  // ma sát hông theo từng lớp
  const rows: PileSkinRow[] = [];
  let sumTerm = 0;
  for (const s of segs) {
    const l = s.layer;
    const hiL = s.to - s.from;
    let fiV: number;
    let note: string;
    if (l.kind === 'sand') {
      const Ns = Math.min(100, l.N);
      const raw = bored ? 3.3 * Ns : 2.0 * Ns;
      const cap = bored ? 165 : 100;
      fiV = Math.min(raw, cap);
      note = `fs = ${bored ? '3,3' : '2,0'}·Ns, Ns = ${fmtN(Ns, 0)}${raw > cap ? ` (giới hạn ${cap})` : ''}`;
    } else {
      const cu = cuOf(l);
      const raw = bored ? cu : 0.8 * cu;
      fiV = Math.min(raw, 100);
      note = `fc = ${bored ? '' : '0,8·'}cu, cu = ${fmtN(cu, 1)}${raw > 100 ? ' (giới hạn 100)' : ''}`;
    }
    const term = fiV * hiL;
    sumTerm += term;
    rows.push({
      layer: l.name,
      kind: l.kind === 'sand' ? 'sand' : 'clay',
      from: s.from,
      to: s.to,
      hi: hiL,
      zNat: q.design.z0 + (s.from + s.to) / 2,
      fi: fiV,
      gRf: 1,
      term,
      note,
    });
  }

  const Rb = qb * A;
  const Rf = u * sumTerm;
  return {
    missing,
    warn,
    cap: {
      method: 'spt',
      A,
      u,
      qb,
      qbSrc,
      gRR: 1,
      gc: 1,
      Rb,
      Rf,
      Rk: Rb + Rf,
      rows,
      tipLayer: tipLayer.name,
      tipZNat: zTip,
      notes,
    },
  };
}

/** Sức chịu tải tiêu chuẩn Rk khi kéo (công thức 11 / 16) – chỉ cho phương pháp tra bảng. */
export function pileTension(P: EngineProject, cap: PileCapacity, nPiles: number): { Rk: number; gc: number; gk: number; Rd: number } | undefined {
  const q = P.pile as PileConfig;
  if (q.method !== 'tcvn') return undefined;
  const gc = gammaCTension(q.L);
  const Rk = gc * cap.u * cap.rows.reduce((t, r) => t + r.term, 0);
  const gk = gammaKTension(nPiles);
  return { Rk, gc, gk, Rd: Rk / gk };
}

/** Phản lực đầu cọc từng hàng cho một tổ hợp: Nd = N/nx + N·e·(xi − xc)/Σ(xj − xc)². */
export function pileRowLoads(grid: PileGrid, combo: PileWallCombo, sEff: number): number[] {
  const xs = grid.rows.map((r) => r.x / 100);
  const nx = xs.length;
  const Ncell = combo.N * sEff;
  const xc = xs.reduce((a, b) => a + b, 0) / nx;
  const xR = grid.B / 100 / 2 + combo.s; // vị trí hợp lực tính từ mép mũi (m)
  const e = xR - xc;
  const J = xs.reduce((t, x) => t + (x - xc) ** 2, 0);
  return xs.map((x) => Ncell / nx + (J > 1e-9 ? (Ncell * e * (x - xc)) / J : 0));
}

export function pileRun(P: EngineProject, wall: PileWallCombo[], B: number): PileResult | null {
  if (!pileOn(P) || !P.pile) return null;
  const q = P.pile;
  const grid = pileGrid(P, B);
  if (!grid) return null;
  const warn: string[] = [...grid.warn];
  const gn = GAMMA_N[q.design.cls];

  const nz = Math.max(1, Math.max(...grid.rows.map((r) => r.zs.length)));
  const sEff = grid.Lu / 100 / nz;
  const ds = [] as number[];
  if (grid.rows.length > 1) {
    for (let i = 1; i < grid.rows.length; i++) ds.push(Math.abs(grid.rows[i].x - grid.rows[i - 1].x) / 100);
  }
  if (nz > 1) ds.push(Math.max(0.01, q.sy));
  if (q.stagger && grid.rows.length > 1 && nz > 1) ds.push(Math.hypot(q.sx, q.sy / 2));
  const minSpacing = ds.length ? Math.min(...ds) : Infinity;
  if (Number.isFinite(minSpacing)) {
    if (q.type !== 'bored') {
      if (minSpacing + 1e-9 < 3 * q.size) {
        warn.push(`Khoảng cách tim cọc ${fmtN(minSpacing)} m nhỏ hơn 3d = ${fmtN(3 * q.size)} m (Điều 8.13).`);
      }
    } else if (minSpacing - q.size + 1e-9 < 1.0) {
      warn.push(`Khoảng cách thông thủy giữa các cọc khoan ${fmtN(minSpacing - q.size)} m nhỏ hơn 1,0 m (Điều 8.13).`);
    }
  }

  const reactions: PileReaction[] = wall.map((c) => ({
    k: c.k,
    nm: c.nm,
    Nwall: c.N,
    s: c.s,
    rows: pileRowLoads(grid, c, sEff),
  }));
  if (grid.rows.length === 1 && wall.some((c) => Math.abs(c.s) > 0.02)) {
    warn.push('Chỉ có một hàng cọc: không chịu được mô men lệch tâm của hợp lực; cần ít nhất hai hàng cọc.');
  }

  const Wp = pileArea(q) * q.L * GAMMA_CONC;
  const wOn = q.design.selfWeight;
  const WpComp = wOn ? Wp * GF_COMP : 0;
  const WpTens = wOn ? Wp * GF_TENS : 0;

  let NdMax = -Infinity;
  let NdMaxAt = '';
  let NdTens = 0;
  let NdTensAt = '';
  for (const r of reactions) {
    r.rows.forEach((n, i) => {
      const comp = n + WpComp;
      if (comp > NdMax) {
        NdMax = comp;
        NdMaxAt = `${r.nm} – hàng ${i + 1}`;
      }
      const tens = -n - WpTens;
      if (tens > NdTens) {
        NdTens = tens;
        NdTensAt = `${r.nm} – hàng ${i + 1}`;
      }
    });
  }
  if (!Number.isFinite(NdMax)) NdMax = 0;

  const capOut = pileCapacityCompression(P);
  warn.push(...capOut.warn);
  const base = {
    grid,
    missing: capOut.missing,
    warn,
    gn,
    reactions,
    Wp,
    WpComp,
    WpTens,
    NdMax,
    NdMaxAt,
    NdTens,
    NdTensAt,
    sEff,
    minSpacing,
  };
  if (!capOut.cap) {
    return { ...base, ok: false, vAxial: null, vUplift: null };
  }

  const cap = capOut.cap;
  const gk = gammaKCompression(q.method, q.design.testKind, grid.n, NdMax, q.type);
  const Rd = cap.Rk / gk.v;
  const vAxial = Rd > 0 ? (gn * NdMax) / Rd : Infinity;

  let tens: PileResult['tens'];
  let vUplift: number | null = null;
  if (NdTens > 0) {
    tens = pileTension(P, cap, grid.n);
    if (tens) vUplift = tens.Rd > 0 ? (gn * NdTens) / tens.Rd : Infinity;
    else warn.push('Có cọc chịu kéo nhưng phương pháp đã chọn (SPT / thí nghiệm) chưa có công thức sức chịu kéo; chuyển sang phương pháp tra bảng hoặc thí nghiệm nhổ.');
  }

  return {
    ...base,
    ok: true,
    comp: { ...cap, gk: gk.v, gkNote: gk.note, Rd },
    tens,
    vAxial,
    vUplift,
  };
}
