/**
 * Sinh bộ thanh cốt thép của một hố ga theo các quy tắc cấu hình trong HDSD (chương 2):
 * lưới "Chia đều"/"Theo mật độ", thanh 0M/1M/2M, bẻ móc "Theo KC"/"Theo ĐK", giảm thép/mật độ thép ngang,
 * thép buộc C/Z/U, thép gia cường lỗ cống/lỗ thăm, thang thép, thép chốt, móc nâng, thép hình.
 * Các quy tắc phát triển chiều dài là của ứng dụng này (không sao chép từ VHGpro); kết quả dùng chung cho
 * bảng chiết tính và bản vẽ nên luôn khớp nhau.
 */
import type { GaConfig, GaKindInfo, GaRow } from './types';
import {
  parseAngle,
  parseAnchor,
  parseDims,
  parseHooks,
  parseLift,
  parseRebar,
  reduceDia,
  rebarKgPerM,
  type RebarSpec,
} from './parse';
import { dims, neckOf, openings, totalHeight, type WallOpening } from './geometry';

export type RebarPart = 'bottom' | 'wall' | 'roof' | 'neck' | 'lid' | 'inlet';
export const PART_LABEL: Record<RebarPart, string> = {
  bottom: 'Bản đáy',
  wall: 'Tường',
  roof: 'Trần',
  neck: 'Cổ',
  lid: 'Tấm nắp',
  inlet: 'Cửa thu',
};
export const PART_ORDER: RebarPart[] = ['bottom', 'wall', 'roof', 'neck', 'inlet', 'lid'];

export interface BarGroup {
  mark: string;
  part: RebarPart;
  label: string;
  dia: number;
  /** chiều dài triển khai một thanh (mm) */
  length: number;
  /** số thanh (cho một ga) */
  count: number;
  /** khoảng cách thực tế giữa các thanh (mm), nếu là lưới */
  step?: number;
  hooks: number;
}

export interface AngleItem {
  label: string;
  name: string;
  /** chiều dài (m), cho một ga */
  length: number;
  kgPerM: number;
  count: number;
  kg: number;
}

export interface GaRebar {
  groups: BarGroup[];
  angles: AngleItem[];
  /** kg theo phần (D ≤ 10 / D > 10) cho một ga */
  byPart: Record<RebarPart, { le10: number; gt10: number }>;
  angleKg: number;
  totalKg: number;
}

export const barKg = (g: Pick<BarGroup, 'dia' | 'length' | 'count'>): number => (g.length / 1000) * g.count * rebarKgPerM(g.dia);

/* ------------------------------------------------------------------ tiện ích lưới */

export interface Spaced {
  n: number;
  step: number;
  /** vị trí các thanh, tính từ đầu khoảng (mm) */
  pos: number[];
}

/** Bố trí thanh trên đoạn có `span` (khoảng giữa tim thanh đầu và cuối). */
/** `extra`: số thanh thêm vào ⌈span/s⌉; VHGpro dùng 2 cho lưới đáy và thép đứng tường (đối chiếu bản vẽ mẫu), các nơi khác 1. */
export function spaced(span: number, spacing: number, mode: GaConfig['fmt']['mesh'], extra = 1): Spaced {
  if (!(span > 0) || !(spacing > 0)) return { n: 1, step: 0, pos: [Math.max(0, span) / 2] };
  if (mode === 'Chia đều') {
    // đối chiếu bản vẽ mẫu của VHGpro: số khoảng = ⌈span/s⌉ + 1 (ví dụ span 1710, A150 → 14 thanh; span 2460 → 19 thanh)
    const n = Math.ceil(span / spacing - 1e-9) + extra;
    const step = span / (n - 1);
    return { n, step, pos: Array.from({ length: n }, (_, i) => i * step) };
  }
  const n = Math.floor(span / spacing + 1e-9) + 1;
  const rest = span - (n - 1) * spacing;
  return { n, step: spacing, pos: Array.from({ length: n }, (_, i) => rest / 2 + i * spacing) };
}

function hookLen(cfg: GaConfig, thk: number, dia: number, cover: number): number {
  const byStruct = Math.max(0, thk - 2 * cover);
  return cfg.fmt.hook === 'Theo KC' ? byStruct : Math.min(cfg.fmt.hookN * dia, byStruct);
}

/** Cắt đoạn [a,b] bởi các khoảng bị loại (lỗ). Trả về các đoạn còn lại có chiều dài > 0. */
export function cutSegment(a: number, b: number, cuts: [number, number][], minLen = 1): [number, number][] {
  let segs: [number, number][] = [[a, b]];
  for (const [c0, c1] of cuts) {
    const next: [number, number][] = [];
    for (const [s0, s1] of segs) {
      if (c1 <= s0 || c0 >= s1) next.push([s0, s1]);
      else {
        if (c0 > s0) next.push([s0, c0]);
        if (c1 < s1) next.push([c1, s1]);
      }
    }
    segs = next;
  }
  return segs.filter(([s0, s1]) => s1 - s0 > minLen);
}

/** Tường đặt thang thép (0..3) hoặc null nếu "Không". `Theo vị trí cổ` lấy tường của cổ ga (cạnh đầu tiên khi cổ ở góc). */
export function ladderWall(cfg: GaConfig, hasNeck: boolean): 0 | 1 | 2 | 3 | null {
  const pos = cfg.ladder.pos;
  if (!pos || /^kh[oô]ng$/i.test(pos) || !(cfg.ladder.dia > 0)) return null;
  const direct = /^T([1-4])$/.exec(pos.trim());
  if (direct) return (Number(direct[1]) - 1) as 0 | 1 | 2 | 3;
  if (!hasNeck) return 0;
  const m = /T([1-4])/.exec(cfg.neck.pos);
  return m ? ((Number(m[1]) - 1) as 0 | 1 | 2 | 3) : 0;
}

/** Cao độ z (mm, từ mặt trong bản đáy) của các bậc thang: bậc đầu cách đỉnh `A`, sau đó mỗi `B`, dừng cách đáy 200. */
export function ladderLevels(row: GaRow, cfg: GaConfig, info: GaKindInfo): number[] {
  const dn = parseDims(cfg.ladder.dens);
  if (!dn || dn.length < 2 || !(dn[1] > 0)) return [];
  const top = row.H + (info.hasNeck ? row.roof.t + row.neck.h : row.roof.t);
  const out: number[] = [];
  for (let z = top - dn[0]; z >= 200; z -= dn[1]) out.push(z);
  return out;
}

/** Vị trí thép buộc (u, v) trên mặt rộng `w × h` tâm ở (0, h/2); "Lệch": hàng lẻ so le nửa bước và ít hơn một thanh. */
export function tieGrid(w: number, h: number, spacing: number, stagger: 'Đều' | 'Lệch'): [number, number][] {
  if (!(w > 0) || !(h > 0) || !(spacing > 0)) return [];
  const nx = Math.ceil(w / spacing);
  const ny = Math.ceil(h / spacing);
  const out: [number, number][] = [];
  for (let j = 0; j < ny; j++) {
    const v = ((j + 0.5) * h) / ny;
    const odd = stagger === 'Lệch' && j % 2 === 1;
    for (let i = odd ? 1 : 0; i < nx; i++) out.push([-w / 2 + (odd ? i : i + 0.5) * (w / nx), v]);
  }
  return out;
}

/* ---------------------------------------------------------------- lưới thép tường (dùng chung cho chiết tính và bản vẽ) */

export interface PanelVBar {
  u: number;
  z0: number;
  z1: number;
  hooks: number;
}
export interface PanelHBar {
  z: number;
  u0: number;
  u1: number;
  hooks: number;
}
export interface WallPanel {
  wall: 0 | 1 | 2 | 3;
  layer: 'out' | 'in';
  label: string;
  /** bề rộng tấm tường (ngoài: L + 2·dày, trong: L) */
  width: number;
  height: number;
  specV: RebarSpec;
  specH: RebarSpec;
  hookV: number;
  hookH: number;
  stepV: number;
  stepH: number;
  vert: PanelVBar[];
  horiz: PanelHBar[];
  /** vị trí thép buộc (chỉ lớp ngoài mang thép buộc của tường) */
  ties: [number, number][];
}

/** Lưới thép 4 tường × 2 lớp. Hệ phẳng của tường: u dọc tường (tâm = tim tường), z từ mặt trong bản đáy. */
export function wallPanels(row: GaRow, cfg: GaConfig, cat: import('./parse').PipeCatalog, info: GaKindInfo): WallPanel[] {
  const d = dims(row, cfg);
  const ops = openings(row, cfg, cat);
  const cw = cfg.cover.wall;
  const integral = info.hasNeck && !info.precastRoof;
  const embedTop = integral ? d.tr - cfg.cover.roof : -cw;
  const embedBot = d.tb - cfg.cover.bottom;
  const hkAnchor = Math.min(d.tb, integral ? d.tr : d.tb);
  const out: WallPanel[] = [];
  const tieSpec = parseRebar(cfg.ties.spec);
  for (let i = 0; i < 4; i++) {
    const Li = i === 0 || i === 2 ? d.L : d.B;
    const Lo = Li + 2 * d.tw;
    const wo = ops.filter((o) => o.wall === i);
    const layers: { layer: 'out' | 'in'; spec: RebarSpec | null; width: number; hooks: 0 | 1 | 2 }[] = [
      { layer: 'out', spec: parseRebar(row.wall.out), width: Lo, hooks: parseHooks(cfg.fmt.wallOut) },
      { layer: 'in', spec: parseRebar(row.wall.in), width: Li, hooks: parseHooks(cfg.fmt.wallIn) },
    ];
    for (const L of layers) {
      if (!L.spec) continue;
      const specV = L.spec;
      const dH = reduceDia(specV.dia, cfg.wall.dRed);
      const specH: RebarSpec = { dia: dH, spacing: specV.spacing + cfg.wall.horizAdj };
      const hookV = hookLen(cfg, hkAnchor, specV.dia, cw);
      const hookH = hookLen(cfg, d.tw, dH, cw);
      const vert: PanelVBar[] = [];
      const av = spaced(L.width - 2 * cw, specV.spacing, cfg.fmt.mesh, 2);
      for (let k = 0; k < av.n; k++) {
        const u = -L.width / 2 + cw + av.pos[k];
        const cuts: [number, number][] = [];
        for (const o of wo) if (Math.abs(u - o.uc) <= o.w / 2 + cfg.cover.pipe) cuts.push([o.z0 - cfg.cover.pipe, o.z1 + cfg.cover.pipe]);
        for (const [s0, s1] of cutSegment(-embedBot, d.H + embedTop, cuts, 150)) vert.push({ u, z0: s0, z1: s1, hooks: cuts.length === 0 ? L.hooks : 0 });
      }
      const horiz: PanelHBar[] = [];
      const ah = spaced(d.H - 2 * cw, specH.spacing, cfg.fmt.mesh);
      for (let k = 0; k < ah.n; k++) {
        const z = cw + ah.pos[k];
        const cuts: [number, number][] = [];
        for (const o of wo) if (z >= o.z0 - cfg.cover.pipe && z <= o.z1 + cfg.cover.pipe) cuts.push([o.uc - o.w / 2 - cfg.cover.pipe, o.uc + o.w / 2 + cfg.cover.pipe]);
        // thép ngang lớp trong dài bằng lớp ngoài (đối chiếu VHGpro: cả hai lớp L = 2250 với tường dài trong 2000, dày 150)
        for (const [s0, s1] of cutSegment(-Lo / 2 + cw, Lo / 2 - cw, cuts, 150)) horiz.push({ z, u0: s0, u1: s1, hooks: cuts.length === 0 ? L.hooks : 0 });
      }
      out.push({
        wall: i as 0 | 1 | 2 | 3,
        layer: L.layer,
        label: `Tường ${i + 1} lớp ${L.layer === 'out' ? 'ngoài' : 'trong'}`,
        width: L.width,
        height: d.H,
        specV,
        specH,
        hookV,
        hookH,
        stepV: av.step,
        stepH: ah.step,
        vert,
        horiz,
        ties: L.layer === 'out' && tieSpec ? tieGrid(Li, d.H, tieSpec.spacing, cfg.ties.stagger) : [],
      });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ bộ gom thanh */

class Collector {
  private map = new Map<string, BarGroup>();
  angles: AngleItem[] = [];
  constructor(private prefixes: GaConfig['fmt']['prefixes']) {}
  add(part: RebarPart, label: string, dia: number, length: number, count: number, hooks = 0, step?: number): void {
    if (!(dia > 0) || !(length > 1) || !(count > 0)) return;
    const len = Math.round(length);
    const key = `${part}|${label}|${dia}|${len}|${hooks}`;
    const ex = this.map.get(key);
    if (ex) ex.count += count;
    else this.map.set(key, { mark: '', part, label, dia, length: len, count, hooks, step });
  }
  addAngle(label: string, name: string, lengthM: number, count: number, table: Record<string, number>): void {
    const kgPerM = table[name] ?? 0;
    if (!(lengthM > 0) || !(count > 0)) return;
    this.angles.push({ label, name, length: lengthM, kgPerM, count, kg: lengthM * count * kgPerM });
  }
  finish(): BarGroup[] {
    const prefixFor = (p: RebarPart) => (p === 'bottom' ? this.prefixes.bottom : p === 'wall' ? this.prefixes.wall : p === 'roof' ? this.prefixes.roof : p === 'neck' ? this.prefixes.neck : this.prefixes.lid);
    const counters: Partial<Record<RebarPart, number>> = {};
    const out: BarGroup[] = [];
    for (const part of PART_ORDER) {
      for (const g of this.map.values()) {
        if (g.part !== part) continue;
        counters[part] = (counters[part] ?? 0) + 1;
        const p = part === 'inlet' ? 'S' : prefixFor(part);
        out.push({ ...g, mark: `${p}${counters[part]}` });
      }
    }
    return out;
  }
}

/** Lưới hai phương chữ nhật `w × h` (mm, kích thước bao), cho các lớp thép bản. */
function meshRect(
  col: Collector,
  cfg: GaConfig,
  part: RebarPart,
  label: string,
  spec: RebarSpec | null,
  w: number,
  h: number,
  cover: number,
  thk: number,
  hooks: 0 | 1 | 2,
  holes: { cx: number; cy: number; a: number; b: number; round: boolean }[] = [],
  mult = 1,
): void {
  if (!spec) return;
  const hk = hookLen(cfg, thk, spec.dia, cover);
  const mode = cfg.fmt.mesh;
  // bố trí theo trục toạ độ có gốc ở tâm lưới
  const ex = part === 'bottom' ? 2 : 1;
  const ax = spaced(w - 2 * cover, spec.spacing, mode, ex);
  const ay = spaced(h - 2 * cover, spec.spacing, mode, ex);
  // thanh phương X (nằm ngang), đặt theo y
  for (let i = 0; i < ay.n; i++) {
    const y = -h / 2 + cover + ay.pos[i];
    const cuts: [number, number][] = [];
    for (const o of holes) {
      const half = o.round ? Math.sqrt(Math.max(0, (o.a / 2) ** 2 - (y - o.cy) ** 2)) : Math.abs(y - o.cy) <= o.b / 2 ? o.a / 2 : -1;
      if (half > 0) cuts.push([o.cx - half, o.cx + half]);
    }
    const segs = cutSegment(-w / 2 + cover, w / 2 - cover, cuts);
    const full = segs.length === 1 && cuts.length === 0;
    for (const [s0, s1] of segs) col.add(part, `${label} – phương X`, spec.dia, s1 - s0 + (full ? hooks * hk : 0), mult, full ? hooks : 0, ay.step);
  }
  for (let i = 0; i < ax.n; i++) {
    const x = -w / 2 + cover + ax.pos[i];
    const cuts: [number, number][] = [];
    for (const o of holes) {
      const half = o.round ? Math.sqrt(Math.max(0, (o.a / 2) ** 2 - (x - o.cx) ** 2)) : Math.abs(x - o.cx) <= o.a / 2 ? o.b / 2 : -1;
      if (half > 0) cuts.push([o.cy - half, o.cy + half]);
    }
    const segs = cutSegment(-h / 2 + cover, h / 2 - cover, cuts);
    const full = segs.length === 1 && cuts.length === 0;
    for (const [s0, s1] of segs) col.add(part, `${label} – phương Y`, spec.dia, s1 - s0 + (full ? hooks * hk : 0), mult, full ? hooks : 0, ax.step);
  }
}

/** Thép buộc dạng lưới trên mặt rộng `area` (mm²), bề dày kết cấu `thk`. */
function tiesFor(col: Collector, cfg: GaConfig, part: RebarPart, label: string, shape: string, w: number, h: number, thk: number, cover: number, spec = cfg.ties.spec, count?: number): void {
  const t = parseRebar(spec);
  if (!t || !(w > 0) || !(h > 0)) return;
  const nx = Math.ceil(w / t.spacing);
  const ny = Math.ceil(h / t.spacing);
  // Lệch: các hàng chẵn/lẻ so le nửa bước nên hàng lệch ít hơn một thanh
  const n = count ?? tieGrid(w, h, t.spacing, cfg.ties.stagger).length;
  const core = Math.max(0, thk - 2 * cover);
  let len = core;
  if (/C$/i.test(shape.trim())) len = core + 2 * cfg.ties.hookC;
  else if (/Z$/i.test(shape.trim())) len = core + 2 * cfg.ties.hookZU;
  else len = 2 * core + 2 * cfg.ties.hookZU + cfg.ties.hookMid; // chữ U: hai chân xuyên chiều dày (VHGpro: 2·110 + 2·100 + 200 = 620 với đáy 150, bảo vệ 20)
  col.add(part, `${label} – thép buộc ${shape}`, t.dia, len, n, 0, t.spacing);
}

/** Thép gia cường quanh lỗ (cống/rãnh hoặc lỗ thăm) trên mặt phẳng, cho mỗi lớp thép. */
function holeRing(
  col: Collector,
  cfg: GaConfig,
  part: RebarPart,
  label: string,
  prefix: string,
  dia: number,
  form: string,
  count: number,
  ext: number,
  w: number,
  h: number,
  round: boolean,
  layers: number,
  kind: 'pipe' | 'man' = 'pipe',
): void {
  if (!(dia > 0) || !(count > 0)) return;
  const lap = cfg.ties.lap * dia;
  const bo = /Bo/i.test(form);
  const xien = /Xi[eê]n/i.test(form);
  const vuong = /Vu[oô]ng/i.test(form);
  for (let l = 0; l < layers; l++) {
    const tag = `${prefix} – ${label}`;
    if (round) {
      if (bo) col.add(part, `${tag} (bo)`, dia, Math.PI * (w + 2 * cfg.cover.pipe) + lap, 1);
      if (xien) col.add(part, `${tag} (xiên)`, dia, 0.7071 * w + 2 * ext, 4 * count);
      if (vuong) col.add(part, `${tag} (vuông)`, dia, w + 2 * ext, 4 * count);
    } else {
      // lỗ thăm chữ nhật: "Bo" = một vòng đai kín, "Vuông" = 4·count thanh bao
      if (kind === 'man' && bo) col.add(part, `${tag} (bo)`, dia, 2 * (w + h) + 4 * cfg.cover.pipe + lap, 1);
      if (kind === 'man' ? vuong : bo || vuong || xien) {
        col.add(part, `${tag} (ngang)`, dia, w + 2 * ext, 2 * count);
        col.add(part, `${tag} (đứng)`, dia, h + 2 * ext, 2 * count);
      }
    }
  }
}

const sumPart = (groups: BarGroup[]): GaRebar['byPart'] => {
  const out = Object.fromEntries(PART_ORDER.map((p) => [p, { le10: 0, gt10: 0 }])) as GaRebar['byPart'];
  for (const g of groups) {
    const kg = barKg(g);
    if (g.dia <= 10) out[g.part].le10 += kg;
    else out[g.part].gt10 += kg;
  }
  return out;
};

/* ------------------------------------------------------------------ chính */

export function computeRebar(row: GaRow, cfg: GaConfig, cat: import('./parse').PipeCatalog, info: GaKindInfo, angleTable: Record<string, number>): GaRebar {
  const col = new Collector(cfg.fmt.prefixes);
  const d = dims(row, cfg);
  const neck = neckOf(row, cfg, info.hasNeck);
  const ops = openings(row, cfg, cat);
  const pl = cfg.pipeHole;

  // ---------------- bản đáy
  {
    const cb = cfg.cover.bottom;
    const w = 2 * d.bx;
    const h = 2 * d.by;
    const lowSpec = parseRebar(row.bottom.low);
    const upSpec = parseRebar(row.bottom.up);
    meshRect(col, cfg, 'bottom', 'Đáy lớp dưới', lowSpec, w, h, cb, d.tb, parseHooks(cfg.fmt.bottomLow));
    meshRect(col, cfg, 'bottom', 'Đáy lớp trên', upSpec, w, h, cb, d.tb, parseHooks(cfg.fmt.bottomUp));
    if (cfg.bottom.chamfer > 0 && cfg.bottom.chamferDia > 0) {
      const sp = parseRebar(row.wall.in)?.spacing ?? 150;
      const per = 2 * (d.L + d.B);
      const n = Math.ceil(per / sp);
      col.add('bottom', 'Thép vát góc đáy–tường', cfg.bottom.chamferDia, Math.SQRT2 * cfg.bottom.chamfer + 2 * cfg.bottom.hook, n, 2, sp);
    }
    tiesFor(col, cfg, 'bottom', 'Đáy', cfg.ties.bottom, w - 2 * cb, h - 2 * cb, d.tb, cb);
  }

  // ---------------- tường
  {
    const cw = cfg.cover.wall;
    const integral = info.hasNeck && !info.precastRoof;
    const embedTop = integral ? d.tr - cfg.cover.roof : -cw;
    const embedBot = d.tb - cfg.cover.bottom;
    for (const P of wallPanels(row, cfg, cat, info)) {
      for (const v of P.vert) col.add('wall', `${P.label} – thép đứng`, P.specV.dia, v.z1 - v.z0 + v.hooks * P.hookV, 1, v.hooks, P.stepV);
      for (const h of P.horiz) col.add('wall', `${P.label} – thép ngang`, P.specH.dia, h.u1 - h.u0 + h.hooks * P.hookH, 1, h.hooks, P.stepH);
      for (const o of ops.filter((q) => q.wall === P.wall)) {
        holeRing(col, cfg, 'wall', `lỗ ${o.pipe.spec} (${P.layer === 'out' ? 'ngoài' : 'trong'})`, pl.prefix, pl.dia, pl.form, pl.count, pl.ext, o.w, o.h, o.round, 1);
      }
      if (P.layer === 'out') {
        const Li = P.wall % 2 === 0 ? d.L : d.B;
        tiesFor(col, cfg, 'wall', `Tường ${P.wall + 1}`, cfg.ties.wall, Li, d.H, d.tw, cw, cfg.ties.spec, P.ties.length);
      }
    }
    // thép hình viền đỉnh tường (ga không cổ)
    if (!info.hasNeck && cfg.wall.topChamfer.on) {
      const a = parseAngle(cfg.wall.topChamfer.angle);
      const sz = parseDims(cfg.wall.topChamfer.size);
      if (a && sz) {
        const per = (2 * (d.L + sz[0] * 2 + d.B + sz[0] * 2)) / 1000;
        const n = cfg.wall.topChamfer.pos.length || 1;
        col.addAngle('Thép góc viền đỉnh tường', a.name, per, n, angleTable);
        const an = parseAnchor(cfg.wall.topChamfer.anchor);
        if (an) col.add('wall', 'Râu neo thép góc đỉnh tường', an.dia, an.len, Math.ceil((per * 1000) / an.spacing) * n);
      }
    }
    // thang thép
    const ld = cfg.ladder;
    if (ladderWall(cfg, info.hasNeck) !== null) {
      const sz = parseDims(ld.size);
      const n = ladderLevels(row, cfg, info).length;
      if (sz && sz.length === 3) col.add('wall', `${ld.prefix} – thang thép`, ld.dia, sz[2] + 2 * sz[1] + 2 * sz[0], n);
    }
  }

  // ---------------- trần / tấm nắp
  if (info.hasNeck) {
    const cr = cfg.cover.roof;
    const w = d.L + 2 * d.tw;
    const h = d.B + 2 * d.tw;
    const hole = neck ? { cx: neck.cx, cy: neck.cy, a: neck.a, b: neck.b, round: neck.round } : undefined;
    // lỗ cổ nằm trong hệ ga; lưới trần có tâm tại tâm ga
    const holes = hole ? [hole] : [];
    meshRect(col, cfg, 'roof', 'Trần lớp trên', parseRebar(row.roof.up), w, h, cr, d.tr, parseHooks(cfg.fmt.roofUp), holes);
    meshRect(col, cfg, 'roof', 'Trần lớp dưới', parseRebar(row.roof.low), w, h, cr, d.tr, parseHooks(cfg.fmt.roofLow), holes);
    if (!info.precastRoof && cfg.roof.chamfer > 0 && cfg.roof.chamferDia > 0) {
      const sp = parseRebar(row.wall.in)?.spacing ?? 150;
      col.add('roof', 'Thép vát góc tường–trần', cfg.roof.chamferDia, Math.SQRT2 * cfg.roof.chamfer + 2 * cfg.roof.hook, Math.ceil((2 * (d.L + d.B)) / sp), 2, sp);
    }
    if (neck) {
      const mh = cfg.manHole;
      holeRing(col, cfg, 'roof', 'lỗ thăm (lớp trên)', mh.prefix, mh.dia, mh.form, mh.count, mh.ext, neck.a, neck.b, neck.round, 1, 'man');
      holeRing(col, cfg, 'roof', 'lỗ thăm (lớp dưới)', mh.prefix, mh.dia, mh.form, mh.count, mh.ext, neck.a, neck.b, neck.round, 1, 'man');
    }
    tiesFor(col, cfg, 'roof', 'Trần', cfg.ties.roof, w - 2 * cr, h - 2 * cr, d.tr, cr);
    if (info.precastRoof) {
      const pc = cfg.precast;
      if (pc.pin) {
        const sp = parseRebar(pc.pinSpec);
        if (sp) {
          const per = 2 * (d.L + d.B + 2 * d.tw);
          const n = Math.ceil(per / sp.spacing);
          col.add('roof', 'Chốt thép tường–trần', sp.dia, pc.pinLen, n);
        }
      }
      const lf = parseLift(pc.lift);
      const ls = parseDims(pc.liftSize);
      if (lf && ls && ls.length === 3) col.add('roof', 'Móc nâng trần', lf.dia, 2 * (ls[0] + ls[1]) + ls[2], lf.n);
    }
  }

  // ---------------- cổ ga
  if (neck && cfg.neck.structure === 'BTCT') {
    const cn = cfg.cover.neck;
    const V = row.neck.t;
    const h = row.neck.h;
    const outSpec = parseRebar(row.neck.out);
    const inSpec = parseRebar(row.neck.in);
    const per = (a: number, b: number, round: boolean) => (round ? Math.PI * a : 2 * (a + b));
    const lay = [
      { label: 'Cổ lớp ngoài', spec: outSpec, a: neck.a + 2 * V - 2 * cn, b: neck.b + 2 * V - 2 * cn, hooks: parseHooks(cfg.fmt.neckOut) },
      { label: 'Cổ lớp trong', spec: inSpec, a: neck.a + 2 * cn, b: neck.b + 2 * cn, hooks: parseHooks(cfg.fmt.neckIn) },
    ];
    for (const L of lay) {
      if (!L.spec) continue;
      const pr = per(L.a, L.b, neck.round);
      const nV = Math.ceil(pr / L.spec.spacing);
      const embed = d.tr - cfg.cover.roof;
      const hk = hookLen(cfg, d.tr, L.spec.dia, cn);
      col.add('neck', `${L.label} – thép đứng`, L.spec.dia, h + embed - cn + L.hooks * hk, nV, L.hooks, L.spec.spacing);
      const dH = reduceDia(L.spec.dia, cfg.neck.dRed);
      const spH = L.spec.spacing + cfg.neck.horizAdj;
      const ah = spaced(h - 2 * cn, spH, cfg.fmt.mesh);
      col.add('neck', `${L.label} – đai ngang`, dH, pr + cfg.ties.lap * dH, ah.n, 0, ah.step);
    }
    tiesFor(col, cfg, 'neck', 'Cổ', cfg.ties.neck, neck.round ? Math.PI * (neck.a + V) : 2 * (neck.a + neck.b + 2 * V), h, V, cn);
    if (cfg.neck.chamfer) {
      const cs = parseDims(cfg.neck.chamferSize);
      const ang = parseAngle(cfg.neck.angle);
      if (cs && ang) {
        const pr = (neck.round ? Math.PI * (neck.a + 2 * cs[0]) : 2 * (neck.a + neck.b + 4 * cs[0])) / 1000;
        const n = Math.max(1, cfg.neck.anglePos.length);
        col.addAngle('Thép góc viền cổ', ang.name, pr, n, angleTable);
        const an = parseAnchor(cfg.neck.anchor);
        if (an) col.add('neck', 'Râu neo thép góc cổ', an.dia, an.len, Math.ceil((pr * 1000) / an.spacing) * n);
      }
    }
  }

  // ---------------- tấm nắp đúc sẵn
  {
    const lidQ = cfg.lid.type === 'BTCT' ? lidSlabs(row, cfg, info) : null;
    if (lidQ) {
      const { n, len, wid, thick } = lidQ;
      const cl = cfg.cover.lid;
      const low = info.hasNeck ? ({ dia: cfg.lid.dLow, spacing: cfg.lid.density } as RebarSpec) : parseRebar(row.roof.low);
      const up = info.hasNeck ? (cfg.lid.dUp > 0 ? ({ dia: cfg.lid.dUp, spacing: cfg.lid.density } as RebarSpec) : null) : parseRebar(row.roof.up);
      const hkLid = parseHooks(info.hasNeck ? '0M' : cfg.fmt.roofLow);
      meshRect(col, cfg, 'lid', 'Tấm nắp lớp dưới', low, len, wid, cl, thick, hkLid, [], n);
      meshRect(col, cfg, 'lid', 'Tấm nắp lớp trên', up, len, wid, cl, thick, hkLid, [], n);
      if (up) tiesFor(col, cfg, 'lid', 'Tấm nắp', cfg.lid.tieShape, len * n, wid, thick, cl, cfg.lid.tie);
      const ang = parseAngle(cfg.lid.angle);
      if (ang && cfg.lid.angleCount > 0) {
        const per = (2 * (len + wid)) / 1000;
        col.addAngle('Thép góc viền tấm nắp', ang.name, per, n * cfg.lid.angleCount, angleTable);
        const an = parseAnchor(cfg.lid.anchor);
        if (an) col.add('lid', 'Râu neo thép góc tấm nắp', an.dia, an.len, Math.ceil((per * 1000) / an.spacing) * n * cfg.lid.angleCount);
      }
      const lf = parseLift(cfg.lid.lift);
      const ls = parseDims(cfg.lid.liftSize);
      if (lf && ls && ls.length === 3) col.add('lid', 'Móc nâng tấm nắp', lf.dia, 2 * (ls[0] + ls[1]) + ls[2], lf.n * n);
    }
  }

  // ---------------- cửa thu
  if (info.hasInlet) inletRebar(col, row, cfg);

  const groups = col.finish();
  const byPart = sumPart(groups);
  const angleKg = col.angles.reduce((s, a) => s + a.kg, 0);
  let steel = 0;
  for (const g of groups) steel += barKg(g);
  void totalHeight;
  return { groups, angles: col.angles, byPart, angleKg, totalKg: steel + angleKg };
}

export interface LidSlabs {
  n: number;
  len: number;
  wid: number;
  thick: number;
}

/** Kích thước tấm nắp (mm) – cùng quy ước với chiết tính khối lượng. */
export function lidSlabs(row: GaRow, cfg: GaConfig, info: GaKindInfo): LidSlabs | null {
  if (cfg.lid.type !== 'BTCT' || !(cfg.lid.nSlabs > 0)) return null;
  const n = cfg.lid.nSlabs;
  const gap = cfg.lid.gap;
  const d = dims(row, cfg);
  let rx: number;
  let ry: number;
  let thick: number;
  let chamOn: boolean;
  if (info.hasNeck) {
    const neck = neckOf(row, cfg, true);
    if (!neck) return null;
    const cham = cfg.neck.chamfer ? parseDims(cfg.neck.chamferSize) : null;
    chamOn = !!cham;
    rx = cham ? neck.a + 2 * cham[0] : neck.a + 2 * row.neck.t;
    ry = cham ? neck.b + 2 * cham[0] : neck.b + 2 * row.neck.t;
    thick = cfg.lid.height + (cham ? cham[1] : 0);
  } else {
    const tc = cfg.wall.topChamfer.on ? parseDims(cfg.wall.topChamfer.size) : null;
    chamOn = !!tc;
    const ext = tc ? tc[0] : d.tw;
    rx = d.L + 2 * ext;
    ry = d.B + 2 * ext;
    thick = row.roof.t;
  }
  const split = (full: number) => (chamOn ? (full - (n + 1) * gap) / n : (full - (n - 1) * gap) / n);
  const whole = (full: number) => (chamOn ? full - 2 * gap : full);
  const len = cfg.lid.dir === 'Dọc' ? split(rx) : whole(rx);
  const wid = cfg.lid.dir === 'Dọc' ? whole(ry) : split(ry);
  return { n, len, wid, thick };
}

function inletRebar(col: Collector, row: GaRow, cfg: GaConfig): void {
  const c = cfg.inlet;
  if (c.structure !== 'BTCT') return;
  const dm = parseDims(c.hole);
  const cl = parseDims(c.clear);
  const th = parseDims(c.thick);
  const bm = parseDims(c.beam);
  const mesh = parseRebar(c.mesh);
  if (!dm || !cl || !th || !mesh) return;
  const cv = cfg.cover.inlet;
  const Wo = dm[0] + 2 * th[0];
  const Lo = cl[0] + th[0];
  // đáy
  meshRect(col, cfg, 'inlet', 'Cửa thu – đáy', mesh, Wo, Lo, cv, th[1], 0);
  // 3 tường (một lớp): thanh đứng và ngang
  const wallLen = [Lo, Lo, dm[0]];
  wallLen.forEach((wl, i) => {
    const av = spaced(wl - 2 * cv, mesh.spacing, cfg.fmt.mesh);
    col.add('inlet', 'Cửa thu – tường thép đứng', mesh.dia, cl[1] + th[1] - 2 * cv + 100, av.n);
    const ah = spaced(cl[1] - 2 * cv, mesh.spacing, cfg.fmt.mesh);
    col.add('inlet', 'Cửa thu – tường thép ngang', mesh.dia, wl - 2 * cv, ah.n);
    void i;
  });
  const main = parseLift(c.beamMain);
  const st = parseRebar(c.beamStirrup);
  if (bm && main) {
    const run = 2 * Lo + Wo;
    col.add('inlet', 'Giằng đỉnh cửa thu – thép chủ', main.dia, run, main.n);
    if (st) col.add('inlet', 'Giằng đỉnh cửa thu – đai', st.dia, 2 * (bm[0] - 2 * cv + bm[1] - 2 * cv) + 100, Math.ceil(run / st.spacing) + 1);
  }
}

export type { WallOpening };
