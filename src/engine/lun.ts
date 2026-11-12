/**
 * Độ lún cố kết của nền dưới bản đáy tường – mô đun mở rộng (không có trong ứng dụng gốc).
 *
 * Dựng theo bảng tính tham khảo `bang tinh/01. KIỂM TOÁN LÚN NỀN ĐẮP_Hay dung.xlsm`:
 *  - phân tầng lấy tổng, mỗi phân tố dày `dz` (1 m), ứng suất tính tại giữa phân tố;
 *  - ba trường hợp cố kết theo C_c, C_r, áp lực tiền cố kết P_c;
 *  - dừng tính khi σ_z / σ_vz < 0,15; tổng lún S = m·S_c (m = 1,2);
 *  - lún theo thời gian: C_v trung bình, T_v = C_v·t/H², tra U_v theo T_v.
 * Bảng gốc tính cho nền đường đắp (tải hình thang – hệ số Osterberg). Với tường chắn, tải gây lún là áp lực
 * tiêu chuẩn dưới đáy móng (tải băng) và – tùy chọn – phần đất đắp sau gót (tải nửa mặt phẳng).
 *
 * Nguyên tắc: `project.lun` vắng mặt = tắt hoàn toàn. Đơn vị: m, kN/m³, kPa; C_v tính bằng 10⁻⁴ cm²/s.
 */

import type { LunConfig, LunLayer } from '../types/project.ts';
import type { EngineCheckItem, EngineProject } from './types.ts';

let _uid = 0;
function uid(): string {
  _uid += 1;
  return `s${Date.now().toString(36)}${_uid.toString(36)}`;
}

export function lunOn(P: { lun?: LunConfig | undefined } | null | undefined): boolean {
  return Boolean(P && P.lun && P.lun.on);
}

export function lunNewLayer(over: Partial<LunLayer> = {}): LunLayer {
  return { id: uid(), name: 'Lớp đất', thk: 5, gamma: 17, e0: 1.1, Cv: 7, Cc: 0.3, Cr: 0.05, Pc: 60, ...over };
}

/** Giá trị khởi tạo khi bật tính lún – địa tầng chỉ là ví dụ để bắt đầu nhập. */
export function lunDefaults(): LunConfig {
  return {
    on: true,
    hw: 0.5,
    hm: 1,
    layers: [
      lunNewLayer({ id: 's1', name: 'Lớp 1 – sét dẻo mềm', thk: 3, gamma: 18, e0: 1.05, Cv: 7.3, Cc: 0.29, Cr: 0.04, Pc: 85 }),
      lunNewLayer({ id: 's2', name: 'Lớp 2 – bùn sét', thk: 12, gamma: 16.5, e0: 1.4, Cv: 6.8, Cc: 0.45, Cr: 0.06, Pc: 60 }),
      lunNewLayer({ id: 's3', name: 'Lớp 3 – cát chặt vừa', thk: 6, gamma: 19.5, e0: 0.7, Cv: 0, Cc: 0, Cr: 0, Pc: 0 }),
    ],
    dz: 1,
    stop: 0.15,
    m: 1.2,
    Slim: 40,
    drain: 1,
    years: 20,
    backfill: true,
  };
}

/** Chuẩn hóa `P.lun` tại chỗ. No-op khi vắng mặt; idempotent. */
export function lunEnsure(P: EngineProject): LunConfig | undefined {
  const q = P.lun;
  if (!q || typeof q !== 'object') return undefined;
  const d = lunDefaults() as unknown as Record<string, unknown>;
  const dst = q as unknown as Record<string, unknown>;
  for (const k of Object.keys(d)) {
    if (k !== 'layers' && dst[k] === undefined) dst[k] = d[k];
  }
  if (!Array.isArray(q.layers)) q.layers = lunDefaults().layers;
  const seen = new Set<string>();
  q.layers = q.layers.map((l) => {
    const m = Object.assign(lunNewLayer(), l);
    if (!m.id || seen.has(m.id)) m.id = uid();
    seen.add(m.id);
    return m;
  });
  return q;
}

// ---------------------------------------------------------------------------
// Hệ số ứng suất thẳng đứng
// ---------------------------------------------------------------------------

/** Tải băng đều rộng B, điểm tại trục giữa, sâu z: K = (2β + sin 2β)/π với β = arctg(B/2z). */
export function lunStripK(B: number, z: number): number {
  if (z <= 1e-9) return 1;
  const b = Math.atan(B / (2 * z));
  return (2 * b + Math.sin(2 * b)) / Math.PI;
}

/**
 * Tải đều trên nửa mặt phẳng, điểm nằm NGOÀI vùng tải cách mép một đoạn x ≥ 0, sâu z:
 * K = (π/2 − arctg(x/z) − x·z/(x² + z²))/π (x = 0 → 0,5).
 */
export function lunHalfK(x: number, z: number): number {
  if (z <= 1e-9) return x <= 1e-9 ? 0.5 : 0;
  return (Math.PI / 2 - Math.atan(x / z) - (x * z) / (x * x + z * z)) / Math.PI;
}

/**
 * Hệ số Osterberg cho NỬA nền đắp hình thang (mái dốc rộng a, nửa mặt nền rộng b), điểm dưới tim nền, sâu z:
 * I = [((a + b)/a)·(α₁ + α₂) − (b/a)·α₂]/π, α₂ = arctg(b/z), α₁ = arctg((a + b)/z) − α₂.
 * Toàn bộ nền đắp đối xứng: 2·I. Đây là hàm `Igt` của bảng tính.
 */
export function lunEmbankI(a: number, b: number, z: number): number {
  if (z <= 1e-9) return 0.5;
  const a2 = Math.atan(b / z);
  const a1 = Math.atan((a + b) / z) - a2;
  if (a <= 1e-9) return a2 / Math.PI;
  return (((a + b) / a) * (a1 + a2) - (b / a) * a2) / Math.PI;
}

/** Bảng U_v – T_v của bảng tính (sheet "UV"). */
export const LUN_UV_T: readonly number[] = [0, 0, 0.004, 0.008, 0.012, 0.02, 0.028, 0.036, 0.048, 0.06, 0.072, 0.1, 0.125, 0.167, 0.2, 0.25, 0.3, 0.35, 0.4, 0.5, 0.6, 0.8, 1, 2];
export const LUN_UV_U: readonly number[] = [0, 0.08, 0.08, 0.104, 0.125, 0.16, 0.189, 0.214, 0.247, 0.276, 0.303, 0.357, 0.399, 0.461, 0.504, 0.562, 0.631, 0.65, 0.698, 0.764, 0.816, 0.887, 0.931, 0.994];

/** Độ cố kết U_v theo nhân tố thời gian T_v: nội suy tuyến tính trong bảng; T_v ≤ 0 → 0; T_v ≥ 2 → 0,994. */
export function lunU(Tv: number): number {
  if (!(Tv > 0)) return 0;
  const T = LUN_UV_T;
  const U = LUN_UV_U;
  const n = T.length;
  if (Tv >= T[n - 1]) return U[n - 1];
  let i = 0;
  for (let k = 0; k < n - 1; k++) if (T[k] <= Tv) i = k;
  const d = T[i + 1] - T[i];
  return d > 0 ? U[i] + ((U[i + 1] - U[i]) * (Tv - T[i])) / d : U[i + 1];
}

// ---------------------------------------------------------------------------
// Tính lún
// ---------------------------------------------------------------------------

export interface LunRow {
  /** Chỉ số lớp đất (từ 0) và tên. */
  li: number;
  name: string;
  /** Bề dày phân tố và độ sâu giữa phân tố tính từ mặt bắt đầu (đáy móng), m. */
  h: number;
  z: number;
  /** Dung trọng dùng để tính ứng suất bản thân (đẩy nổi khi dưới mực nước). */
  gEff: number;
  /** Ứng suất bản thân σ_vz, ứng suất gây lún σ_z, áp lực tiền cố kết (kPa). */
  sv: number;
  sz: number;
  Pc: number;
  /** Trường hợp cố kết: 1 thường / chưa cố kết, 2 quá cố kết (σ_vz + σ_z < P_c), 3 quá cố kết vượt P_c. */
  cs: 1 | 2 | 3;
  /** Độ lún của phân tố (m). */
  s: number;
  ratio: number;
  /** Phân tố có được cộng vào độ lún không (σ_z/σ_vz ≥ ngưỡng dừng và nằm dưới mặt bắt đầu tính). */
  on: boolean;
  /** Nằm trong vùng không tính lún (ví dụ thân khối cừ tràm). */
  skip: boolean;
}

export interface LunCalcInput {
  layers: readonly LunLayer[];
  /** Mực nước ngầm dưới mặt đất tự nhiên (m) và độ sâu mặt z = 0 dưới mặt đất tự nhiên (m). */
  hw: number;
  hm: number;
  dz: number;
  stop: number;
  /** Dung trọng nước (kN/m³). */
  gw: number;
  /** Ứng suất gây lún (kPa) tại độ sâu z (m) dưới mặt z = 0. */
  load: (z: number) => number;
  /** Không tính lún cho phần trên độ sâu này (m) – vẫn tính trọng lượng. */
  zStart?: number;
}

export interface LunCalc {
  rows: LunRow[];
  /** Ứng suất bản thân tại mặt z = 0 (kPa). */
  sv0: number;
  /** Độ lún cố kết S_c (m) và chiều sâu vùng tính lún Z_a (m). */
  Sc: number;
  Za: number;
}

/** Trọng lượng đẩy nổi như bảng tính: γ − γ_w khi phân tố nằm dưới mực nước và γ > γ_w. */
function gammaEff(gamma: number, depthFromSurface: number, hw: number, gw: number): number {
  return depthFromSurface > hw && gamma > gw ? gamma - gw : gamma;
}

/** Phân tầng lấy tổng: mỗi lớp chia thành các phân tố dày `dz` và một phân tố dư ở cuối lớp. */
export function lunCalc(I: LunCalcInput): LunCalc {
  const dz = I.dz > 0.05 ? I.dz : 1;
  const zStart = Math.max(0, I.zStart ?? 0);
  const first = I.layers[0];
  const sv0 = first ? gammaEff(first.gamma, I.hm / 2, I.hw, I.gw) * Math.max(0, I.hm) : 0;
  const rows: LunRow[] = [];
  let top = 0;
  let cum = sv0;
  I.layers.forEach((l, li) => {
    const thk = Math.max(0, l.thk);
    const bot = top + thk;
    // điểm chia trong lớp: bội số của dz kể từ đỉnh lớp, thêm mặt bắt đầu tính nếu cắt qua lớp
    const cuts: number[] = [];
    for (let k = 1; top + k * dz < bot - 1e-9; k++) cuts.push(top + k * dz);
    if (zStart > top + 1e-9 && zStart < bot - 1e-9 && !cuts.some((c) => Math.abs(c - zStart) < 1e-9)) cuts.push(zStart);
    cuts.sort((a, b) => a - b);
    let a = top;
    [...cuts, bot].forEach((b) => {
      const h = b - a;
      if (h <= 1e-9) return;
      const z = a + h / 2;
      const gEff = gammaEff(l.gamma, I.hm + z, I.hw, I.gw);
      const sv = cum + (gEff * h) / 2;
      cum += gEff * h;
      const skip = z < zStart;
      const sz = skip ? 0 : Math.max(0, I.load(z));
      const k = h / (1 + l.e0);
      let cs: 1 | 2 | 3 = 1;
      let s = 0;
      if (!skip && sv > 0 && sz > 0) {
        if (sv >= l.Pc) {
          cs = 1;
          s = k * l.Cc * Math.log10((sv + sz) / sv);
        } else if (sv + sz < l.Pc) {
          cs = 2;
          s = k * l.Cr * Math.log10((sv + sz) / sv);
        } else {
          cs = 3;
          s = k * (l.Cr * Math.log10(l.Pc / sv) + l.Cc * Math.log10((sv + sz) / l.Pc));
        }
      }
      const ratio = sv > 0 ? sz / sv : 0;
      rows.push({ li, name: l.name, h, z, gEff, sv, sz, Pc: l.Pc, cs, s, ratio, on: !skip && ratio >= I.stop, skip });
      a = b;
    });
    top = bot;
  });
  const act = rows.filter((r) => r.on);
  return { rows, sv0, Sc: act.reduce((t, r) => t + r.s, 0), Za: act.reduce((t, r) => t + r.h, 0) };
}

export interface LunTimeRow {
  t: number;
  Tv: number;
  U: number;
  /** Độ lún đã xảy ra và độ lún còn lại (m), tính trên S_c như bảng tính. */
  St: number;
  Sr: number;
}

/**
 * C_v trung bình của vùng đất yếu (các phân tố có C_v > 0): C_vtb = z_a²/(Σ h_i/√C_vi)², đơn vị 10⁻⁴ cm²/s;
 * z_a = tổng bề dày các phân tố đó.
 */
export function lunCvAvg(rows: readonly LunRow[], layers: readonly LunLayer[]): { Cv: number; za: number } {
  let za = 0;
  let sum = 0;
  rows.forEach((r) => {
    const cv = layers[r.li]?.Cv ?? 0;
    if (r.skip || !(cv > 0)) return;
    za += r.h;
    sum += r.h / Math.sqrt(cv);
  });
  return { Cv: sum > 0 ? (za * za) / (sum * sum) : 0, za };
}

/** Lún theo thời gian từng năm (1 năm = 360 ngày như bảng tính). `H` = chiều sâu vùng tính lún (m). */
export function lunTime(Sc: number, Cv: number, H: number, drain: 1 | 2, years: number): LunTimeRow[] {
  const out: LunTimeRow[] = [];
  const Hd = (drain === 1 ? H : H / 2) * 100; // cm
  for (let t = 0; t <= Math.max(0, Math.round(years)); t++) {
    const sec = t * 12 * 30 * 24 * 3600;
    const Tv = Hd > 0 ? ((Cv * 1e-4) / (Hd * Hd)) * sec : 0;
    const U = lunU(Tv);
    out.push({ t, Tv, U, St: Sc * U, Sr: Sc - Sc * U });
  }
  return out;
}

export interface LunWallInput {
  /** Bề rộng bản đáy (m) và áp lực tiêu chuẩn trung bình dưới đáy p = N/B (kPa). */
  B: number;
  p: number;
  pAt: string;
  /** Chiều cao đất đắp sau gót tính từ đáy bản đáy (m) và dung trọng đất đắp (kN/m³). */
  Hfill: number;
  gFill: number;
  /** Cừ tràm (nếu có): chiều dài cừ và bề rộng móng khối quy ước (m). */
  cu?: { L: number; Bqu: number } | null;
}

export interface LunResult extends LunCalc {
  B: number;
  /** Bề rộng và độ sâu mặt truyền tải (đáy móng hoặc đáy khối cừ). */
  Bq: number;
  z0: number;
  p: number;
  pAt: string;
  /** Áp lực gây lún tại mặt truyền tải và tải đất đắp sau gót (kPa). */
  pNet: number;
  qBack: number;
  /** Tổng độ lún S = m·S_c (m). */
  S: number;
  Cv: number;
  zaCv: number;
  time: LunTimeRow[];
  /** Hệ số sử dụng S/[S]. */
  v: number;
  warn: string[];
}

/**
 * Độ lún của nền dưới bản đáy tường tại trục giữa đáy:
 *  - áp lực gây lún p_gl = p − σ_bt(đáy móng), đặt trên bề rộng B (có cừ tràm: đặt tại mũi cừ trên bề rộng B_qu,
 *    cường độ p_gl·B/B_qu, bỏ qua lún trong thân khối cừ);
 *  - đất đắp sau gót (tùy chọn): tải nửa mặt phẳng q = γ_đ·H_đ − σ_bt, mép cách trục đáy B/2.
 */
export function lunRun(q: LunConfig, W: LunWallInput, gw = 10): LunResult {
  const warn: string[] = [];
  const first = q.layers[0];
  const sv0 = first ? gammaEff(first.gamma, q.hm / 2, q.hw, gw) * Math.max(0, q.hm) : 0;
  const pNet0 = Math.max(0, W.p - sv0);
  const z0 = W.cu ? Math.max(0, W.cu.L) : 0;
  const Bq = W.cu ? W.cu.Bqu : W.B;
  const pNet = Bq > 0 ? (pNet0 * W.B) / Bq : 0;
  const qBack = q.backfill ? Math.max(0, W.gFill * W.Hfill - sv0) : 0;
  const load = (z: number): number =>
    pNet * lunStripK(Bq, Math.max(0, z - z0)) + (qBack > 0 ? qBack * lunHalfK(W.B / 2, z) : 0);
  const calc = lunCalc({ layers: q.layers, hw: q.hw, hm: q.hm, dz: q.dz, stop: q.stop, gw, load, zStart: z0 });
  const total = q.layers.reduce((t, l) => t + Math.max(0, l.thk), 0);
  const last = calc.rows[calc.rows.length - 1];
  if (last && last.on) warn.push('Phân tố cuối cùng vẫn còn tính lún: địa tầng khai báo chưa đủ sâu, độ lún có thể bị thiếu.');
  if (z0 >= total) warn.push('Mũi cừ nằm dưới đáy địa tầng đã khai báo: không có lớp nào để tính lún.');
  if (W.p <= sv0) warn.push('Áp lực đáy móng không lớn hơn áp lực bản thân của đất tại đáy móng: không có tải gây lún từ tường.');
  const cv = lunCvAvg(calc.rows, q.layers);
  const S = q.m * calc.Sc;
  const lim = q.Slim / 100;
  return {
    ...calc,
    B: W.B,
    Bq,
    z0,
    p: W.p,
    pAt: W.pAt,
    pNet,
    qBack,
    S,
    Cv: cv.Cv,
    zaCv: cv.za,
    time: lunTime(calc.Sc, cv.Cv, calc.Za, q.drain === 2 ? 2 : 1, q.years),
    v: lim > 0 ? S / lim : 99,
    warn,
  };
}

const TIP_LUN = 'Tổng độ lún cố kết S = m·Sc so với độ lún giới hạn cho phép (≤ 1 là đạt)';

export function lunCheckItems(r: LunResult | null): EngineCheckItem[] {
  if (!r) return [];
  return [{ id: 'lun-s', t: 'Độ lún cố kết', v: Number.isFinite(r.v) ? r.v : 99, ok: r.v <= 1, tip: TIP_LUN }];
}
