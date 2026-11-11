import type {
  BarSpec,
  BarsResult,
  CadLayerDef,
  CadLayerId,
  DimStyle,
  GeomData,
  PaperSize,
  Point2D,
  Project,
  TemplateId,
} from '../types/project';

export const LAYERS: Record<CadLayerId, CadLayerDef> = {
  OUT: { n: 'BT_CHUNG', c: '#ffffff', cl: '#000000', ac: 7, lw: 0.35 },
  THIN: { n: 'NET_MANH', c: '#808080', cl: '#555555', ac: 8, lw: 0.15 },
  HID: { n: 'DUONG_KHUAT', c: '#2f6bff', cl: '#2a7f7f', ac: 160, lw: 0.15, lt: 'D' },
  AXIS: { n: 'TRUC', c: '#ff0000', cl: '#dd0000', ac: 1, lw: 0.13, lt: 'X' },
  DIM: { n: 'KICH_THUOC', c: '#808080', cl: '#808080', ac: 8, lw: 0.12 },
  NOTE: { n: 'GHI_CHU', c: '#00ff00', cl: '#008000', ac: 3, lw: 0.12 },
  CDO: { n: 'CDO', c: '#00ff00', cl: '#008000', ac: 3, lw: 0.12 },
  LBL: { n: 'CHU_SO', c: '#00ff00', cl: '#008000', ac: 3, lw: 0.12 },
  LEAD: { n: 'LEADER', c: '#808080', cl: '#808080', ac: 8, lw: 0.12 },
  SEC: { n: 'KY_HIEU_MC', c: '#00ffff', cl: '#008b8b', ac: 4, lw: 0.12 },
  COV: { n: 'LOP_LINE', c: '#00ff00', cl: '#2e8b2e', ac: 3, lw: 0.12 },
  REB: { n: 'THEP', c: '#ff0000', cl: '#e00000', ac: 1, lw: 0.25 },
  RDOT: { n: 'THEP_MC', c: '#ff0000', cl: '#e00000', ac: 1, lw: 0.15 },
  RDOTW: { n: 'THEP_CHAM', c: '#ffffff', cl: '#000000', ac: 7, lw: 0.15 },
  REB2: { n: 'THEP_XIEN', c: '#ffff00', cl: '#b8860b', ac: 2, lw: 0.25 },
  CDTK: { n: 'CAO_DO_TK', c: '#ff0000', cl: '#dd0000', ac: 1, lw: 0.13 },
  TBL: { n: 'BANG', c: '#ffffff', cl: '#000000', ac: 7, lw: 0.25 },
};

export const BG_DARK = '#212830';

export const PAPER: Record<PaperSize, [number, number]> = {
  A3: [420, 297],
  A2: [594, 420],
  A1: [841, 594],
  A0: [1189, 841],
};

export const SCALES: number[] = [10, 20, 25, 30, 35, 40, 50, 60, 70, 75, 80, 100, 150, 200, 250];

export const DIMSTY: Record<TemplateId, DimStyle> = {
  B: { exo: 1, exe: 0.5, asz: 1.25, gap: 0.5, txt: 1.8, wf: 0.75, cut: 3 },
  A: { exo: 0, exe: 0.5, asz: 1.8, gap: 0.56, txt: 2, wf: 1, cut: 3 },
  C: { exo: 6 / 7, exe: 6 / 7, asz: 8 / 7, gap: 6 / 7, txt: 2, wf: 1, cut: 3 },
  D: { exo: 0.75, exe: 0.75, asz: 1.1, gap: 0.6, txt: 1.8, wf: 1, cut: 3 },
};

export const BAR_TYPES: Record<string, string> = {
  s1: 'Thép đứng thân tường – mặt sau (phía đất)',
  s2: 'Thép đứng thân tường – mặt trước',
  h1: 'Thép ngang thân tường (2 mặt)',
  h1a: 'Thép ngang thân tường – mặt sau',
  b1: 'Thép bản đáy – lớp dưới (ngang)',
  b2: 'Thép bản đáy – lớp trên (ngang)',
  l1: 'Thép dọc bản đáy (2 lớp)',
  t1: 'Thép giằng thân tường',
  t1b: 'Thép giằng bản đáy',
  k1: 'Thép chân khóa chống cắt',
  an: 'Thép neo cắm vào nền đá',
  r1: 'Thép chủ sườn',
  r2: 'Thép ngang sườn (2 mặt)',
  r3: 'Thép đứng sườn (lưới 2 mặt)',
  e1: 'Thép dọc dầm biên',
  f1: 'Thép ôm chân dầm biên (đứng – đáy – chéo)',
  u1: 'Thép chữ U ở 2 đầu bản đáy (b4)',
  u2: 'Thép chữ U mặt đầu đơn nguyên – lưới 3 (b4a)',
  u3: 'Thép ngang mặt đầu đơn nguyên – lưới 3 (b6)',
  w1: 'Thép giằng bản đáy (b5)',
};

export function capFirst(s: string): string {
  const m = /\p{L}/u.exec(s);
  if (!m) return s;
  const c = s[m.index];
  const u = c.toUpperCase();
  return c === u ? s : s.slice(0, m.index) + u + s.slice(m.index + 1);
}

export function textW(s: string | number, h: number, bold?: boolean): number {
  let w = 0;
  for (const ch of String(s)) {
    w += /\p{Lu}/u.test(ch)
      ? 0.95
      : /\p{Ll}/u.test(ch)
        ? /[ilíìỉĩịjtfr]/.test(ch)
          ? 0.45
          : /[mwộởỡợ]/.test(ch)
            ? 0.95
            : 0.67
        : /\d/.test(ch)
          ? 0.78
          : ch === ' '
            ? 0.39
            : /[.,:;'|!]/.test(ch)
              ? 0.39
              : 0.7;
  }
  return w * h * (bold ? 1.07 : 1);
}

// ---------------------------------------------------------------------------
// Shared Pure CAD/3D Micro-Helpers (parity with `01`/`02`/`03`/`04`/`05`)
// ---------------------------------------------------------------------------

export const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));

export const fmt = (n: number, d = 1): string => {
  if (Math.abs(n - Math.round(n)) < 1e-6) return String(Math.round(n));
  return n.toFixed(d).replace('.', ',');
};

export const fmt2 = (n: number): string => n.toFixed(2).replace('.', ',');

export const unitW = (d: number): number => ((7850 * Math.PI) / 4) * (d / 1e3) * (d / 1e3);

export function distr(len: number, a: number, c: number): number[] {
  const span = Math.max(0, len - 2 * c);
  const n = Math.max(1, Math.floor(span / a + 1e-9) + 1);
  const first = c + (span - (n - 1) * a) / 2;
  return Array.from({ length: n }, (_, i) => first + i * a);
}

export const blindT = (p: Project): number => (p.blindOn === false ? 0 : p.tBlind || 0);

export function blindOutline(p: Project, g: GeomData): Point2D[] | null {
  const tl = blindT(p);
  if (tl <= 0) return null;
  if (g.beam) {
    const { w: bw, d: bd } = g.beam;
    const k = (Math.SQRT2 - 1) * tl;
    const B = g.B;
    return [
      [0, -bd],
      [0, -bd - tl],
      [bw + k, -bd - tl],
      [bw + bd + k, -tl],
      [B - bw - bd - k, -tl],
      [B - bw - k, -bd - tl],
      [B, -bd - tl],
      [B, -bd],
    ];
  }
  if (g.key && g.key.x0 <= 1e-6) {
    return [
      [0, -g.key.d],
      [0, -g.key.d - tl],
      [g.key.x1, -g.key.d - tl],
      [g.key.x1, -tl],
      [g.B, -tl],
      [g.B, 0],
    ];
  }
  if (g.key) {
    return [
      [0, 0],
      [0, -tl],
      [g.key.x0, -tl],
      [g.key.x0, -g.key.d - tl],
      [g.key.x1, -g.key.d - tl],
      [g.key.x1, -tl],
      [g.B, -tl],
      [g.B, 0],
    ];
  }
  return [
    [0, 0],
    [0, -tl],
    [g.B, -tl],
    [g.B, 0],
  ];
}

export const ckey = (m: string | number): string => 'c' + String(m).toLowerCase();

export const keyOn = (p: Project): boolean => {
  const ancActive = !!(p.anc && p.anc.on);
  const blocked = !!(p.tpl === 'A' && p.beam && p.beam.on) || (p.tpl !== 'D' && ancActive);
  return !!(p.key && p.key.on && !blocked);
};

const HK_TABLE: Record<number, number> = {
  12: 47,
  14: 55,
  16: 62,
  18: 70,
  20: 78,
  22: 85,
  25: 97,
  28: 110,
  32: 125,
};

export const hkB = (d: number): number => (HK_TABLE[d] || Math.round(3.9 * d)) / 10;

export function dRingXs(B: number, a: number, m: number): number[] {
  const xs: number[] = [];
  for (let x = m; x < B - m - 0.5 * a - 1e-9; x += a) xs.push(x);
  xs.push(B - m);
  return xs;
}

export const ancBarOf = (res: BarsResult): BarSpec | undefined =>
  res.bars.find((b) => b.A && (b.key === 'an' || b.key === 'k1'));

export interface BeamDotSpec {
  d: number;
  n?: number;
  b1d?: number;
  yl?: number;
  yu?: number;
  foot?: { A: Point2D; T: Point2D };
}

export function beamDots(g: GeomData, e1: BeamDotSpec, c: number): Array<{ x: number; y: number; beam: number }> {
  if (!g.beam || !e1) return [];
  const { w: bw, d: bd } = g.beam;
  const n = Math.max(2, Math.round(e1.n || 8));
  const r = e1.d / 20;
  const b1d = e1.b1d || e1.d;
  const hb = b1d / 20;
  const dl = hb + r;
  const x0 = c + hb;
  const yb = -bd + c + hb;
  const k = c * (Math.SQRT2 - 1);
  const y1 = c + hb;
  const A: Point2D = e1.foot ? e1.foot.A : [bw - k, yb];
  const B: Point2D = e1.foot ? e1.foot.T : [bw + bd - k + hb, y1];
  const ul = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1;
  const ux = (B[0] - A[0]) / ul;
  const uy = (B[1] - A[1]) / ul || 1e-9;
  const nx = -uy;
  const ny = ux;
  const yl = e1.yl !== undefined ? e1.yl : y1 + hb + r;
  const yu = e1.yu !== undefined ? e1.yu : yl + 66;
  const xl = x0 + dl;
  const yfb = yb + dl;
  const A2: Point2D = [A[0] + dl * nx, A[1] + dl * ny];
  const tC = (yfb - A2[1]) / uy;
  const xc = Math.max(xl, A2[0] + tC * ux);
  const tE = (yl - A2[1]) / uy;
  const PP: Point2D[] = [
    [xl, yl],
    [xl, yfb],
    [xc, yfb],
    [A2[0] + tE * ux, yl],
  ];
  const seg: number[] = [];
  for (let i = 1; i < PP.length; i++) {
    seg.push(Math.hypot(PP[i][0] - PP[i - 1][0], PP[i][1] - PP[i - 1][1]));
  }
  const S2 = seg.reduce((s, v) => s + v, 0);
  const S1 = Math.max(0, yu - yl);
  const n1 = S1 + S2 > 0 ? Math.min(n, Math.max(0, Math.round((n * S1) / (S1 + S2)))) : 0;
  const n2 = n - n1;
  const o: Array<{ x: number; y: number; beam: number }> = [];
  const add = (x: number, y: number) =>
    o.push({ x, y, beam: 0 }, { x: g.B - x, y, beam: 1 });
  for (let i = 1; i <= n1; i++) add(xl, yu - (S1 * i) / (n1 + 1));
  for (let i = 1; i <= n2; i++) {
    let s = (S2 * i) / (n2 + 1);
    let j = 0;
    while (j < seg.length - 1 && s > seg[j]) {
      s -= seg[j];
      j++;
    }
    const f = seg[j] > 0 ? s / seg[j] : 0;
    add(PP[j][0] + (PP[j + 1][0] - PP[j][0]) * f, PP[j][1] + (PP[j + 1][1] - PP[j][1]) * f);
  }
  return o;
}

// Runtime extended BarSpec fields produced by buildBarsB/C/D/G
export interface BarSpecRuntime extends Omit<BarSpec, 'pts' | 'xe'> {
  n?: number;
  xsT?: number[];
  xw?: number;
  yb?: number;
  zb?: number;
  pts?: Array<number[] | { x: number; y: number; beam?: number }>;
  xe?: ((y: number) => number) | number;
  foot?: { A: Point2D; T: Point2D };
  b1d?: number;
}

export interface TemplateCGeoEntry {
  dots?: Point2D[];
  lines?: Point2D[][];
}

export interface TemplateCGModel {
  l1: Point2D[][];
  l9: Point2D[][];
  l10: Point2D[][];
  l11: Point2D[][];
  l12: Point2D[][];
  l16: Point2D[][];
  p3: Point2D[];
  p4: Point2D[];
  p6: Point2D[];
  p7: Point2D[];
  p8: Point2D[];
  p13: Point2D[];
  dots: { d2: Point2D[]; d5: Point2D[]; d5a: Point2D[] };
  xs11: number[];
  rows: number[];
  x7: (y: number) => number;
  xOf: (y: number) => number;
  ticks: Point2D[];
  geo: Record<string, TemplateCGeoEntry>;
}
