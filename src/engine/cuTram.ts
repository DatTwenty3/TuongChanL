/**
 * Móng cừ tràm gia cố nền dưới bản đáy tường – mô đun mở rộng (không có trong ứng dụng gốc).
 *
 * Dựng theo hai bảng tính tham khảo trong thư mục `bang tinh/`:
 *  (1) "01.MÓNG CỪ TRÀM" – sức chịu tải của khối móng cừ tràm (tham khảo ThS Lê Anh Hoàng):
 *      R_tc của nền tự nhiên; Q_m = (γ·Z·N'q + c·N'c)·F_m; Q_f = c·F_xq; Q_tk = Q_m/FS + Q_f/FS.
 *  (2) "tinh_nen_mong_cong tron60" – sức chịu tải của từng cây cừ theo đất nền (20TCN 21-86):
 *      Q_c = m·(m_R·R·F + u·Σ m_f·f_i·l_i); số cây cần trên 1 m²; bề rộng móng khối quy ước
 *      B_qu = B + 2·L·tg(φ/4); sức chịu tải của đất dưới mũi cừ (đáy khối quy ước).
 *
 * Nguyên tắc: `project.cu` vắng mặt = tắt hoàn toàn (mọi hàm ở đây là no-op), kết quả tường không đổi.
 * Đơn vị: m, kN, kPa (riêng đường kính cừ nhập bằng cm). 1 T/m² của bảng tính (2) = 10 kPa.
 */

import type { CuTramConfig } from '../types/project.ts';
import type { EngineCheckItem, EngineProject } from './types.ts';

export function cuOn(P: { cu?: CuTramConfig | undefined } | null | undefined): boolean {
  return Boolean(P && P.cu && P.cu.on);
}

/** Giá trị khởi tạo khi bật cừ tràm – số liệu đất chỉ là ví dụ để bắt đầu nhập. */
export function cuDefaults(): CuTramConfig {
  return {
    on: true,
    d: 8,
    L: 4.5,
    n: 25,
    hm: 1.5,
    phi: 4,
    gamma: 16,
    c: 8,
    gammaAbove: null,
    m1: 1.1,
    m2: 1.1,
    ktc: 1,
    fsTip: 1.5,
    fsSide: 1.5,
    Rtip: 875,
    m: 1,
    mR: 0.9,
    mf: 1,
    ktcBlock: 0.85,
    ignoreShallow: true,
  };
}

/** Chuẩn hóa `P.cu` tại chỗ (điền trường thiếu). No-op khi vắng mặt; idempotent. */
export function cuEnsure(P: EngineProject): CuTramConfig | undefined {
  const q = P.cu;
  if (!q || typeof q !== 'object') return undefined;
  const d = cuDefaults() as unknown as Record<string, unknown>;
  const dst = q as unknown as Record<string, unknown>;
  for (const k of Object.keys(d)) {
    if (dst[k] === undefined) dst[k] = d[k];
  }
  return q;
}

/**
 * Hệ số sức chịu tải Terzaghi cho trường hợp cắt cục bộ N'c, N'q, N'γ theo φ (độ, 0…50) –
 * bảng trong sheet "Vật liệu" của bảng tính (1).
 */
export const CU_TERZAGHI: ReadonlyArray<readonly [number, number, number]> = [
  [5.7, 1, 0], [5.9, 1.07, 0.005], [6.1, 1.14, 0.02], [6.3, 1.22, 0.04], [6.51, 1.3, 0.055],
  [6.74, 1.39, 0.074], [6.97, 1.49, 0.1], [7.22, 1.59, 0.128], [7.47, 1.7, 0.16], [7.74, 1.82, 0.2],
  [8.02, 1.94, 0.24], [8.32, 2.08, 0.3], [8.63, 2.22, 0.35], [8.96, 2.38, 0.42], [9.31, 2.55, 0.48],
  [9.67, 2.73, 0.57], [10.06, 2.92, 0.67], [10.47, 3.13, 0.76], [10.9, 3.36, 0.88], [11.36, 3.61, 1.03],
  [11.85, 3.88, 1.12], [12.37, 4.17, 1.35], [12.92, 4.48, 1.55], [13.51, 4.82, 1.74], [14.14, 5.2, 1.97],
  [14.8, 5.6, 2.25], [15.53, 6.05, 2.59], [16.3, 6.54, 2.88], [17.13, 7.07, 3.29], [18.03, 7.66, 3.76],
  [18.99, 8.31, 4.39], [20.03, 9.03, 4.83], [21.16, 9.82, 5.51], [22.39, 10.69, 6.32], [23.72, 11.67, 7.22],
  [25.18, 12.75, 8.35], [26.77, 13.97, 9.41], [28.51, 15.32, 10.9], [30.43, 16.85, 12.75], [32.53, 18.56, 14.71],
  [34.87, 20.5, 17.22], [37.45, 22.7, 19.75], [40.33, 25.21, 22.5], [43.54, 28.06, 26.25], [47.13, 31.34, 30.4],
  [51.17, 35.11, 36], [55.73, 39.48, 41.7], [60.91, 44.45, 49.3], [66.8, 50.46, 59.25], [73.55, 57.41, 71.45],
  [81.31, 65.6, 85.75],
];

/** Tra N'c, N'q, N'γ theo φ (độ), nội suy tuyến tính giữa hai dòng; kẹp trong 0…50°. */
export function cuTerzaghi(phi: number): { Nc: number; Nq: number; Ng: number } {
  const p = Math.max(0, Math.min(50, Number.isFinite(phi) ? phi : 0));
  const i = Math.min(49, Math.floor(p));
  const t = p - i;
  const a = CU_TERZAGHI[i];
  const b = CU_TERZAGHI[i + 1];
  return { Nc: a[0] + (b[0] - a[0]) * t, Nq: a[1] + (b[1] - a[1]) * t, Ng: a[2] + (b[2] - a[2]) * t };
}

/**
 * Hệ số A, B, D của công thức R_tc (TCXD 45-78 / TCVN 9362) theo φ (độ):
 * A = 0,25π/(cotgφ + φ − π/2); B = 1 + 4A; D = π·cotgφ/(cotgφ + φ − π/2). φ = 0 → A = 0, B = 1, D = π.
 */
export function cuABD(phi: number): { A: number; B: number; D: number } {
  const f = (Math.max(0, phi) * Math.PI) / 180;
  if (f < 1e-9) return { A: 0, B: 1, D: Math.PI };
  const cot = 1 / Math.tan(f);
  const den = cot + f - Math.PI / 2;
  const A = (0.25 * Math.PI) / den;
  return { A, B: 1 + A / 0.25, D: (Math.PI * cot) / den };
}

/** R_tc = m1·m2/k_tc · (A·b·γ + B·h·γ' + D·c) – sức chịu tải tiêu chuẩn của nền tự nhiên (kPa). */
export function cuRtc(a: {
  A: number;
  B: number;
  D: number;
  b: number;
  h: number;
  gamma: number;
  gammaAbove: number;
  c: number;
  m1: number;
  m2: number;
  ktc: number;
}): number {
  return ((a.m1 * a.m2) / a.ktc) * (a.A * a.b * a.gamma + a.B * a.h * a.gammaAbove + a.D * a.c);
}

export interface CuBlockResult {
  /** Diện tích đáy móng F_m (m²) và diện tích xung quanh khối cừ F_xq (m²). */
  Am: number;
  Fxq: number;
  Nc: number;
  Nq: number;
  Ng: number;
  /** Khả năng chịu mũi và bám dính xung quanh của cả khối (kN). */
  Qm: number;
  Qf: number;
  Qu: number;
  /** Sức chịu tải thiết kế của khối (kN) và trên 1 m² đáy móng (kPa). */
  Qtk: number;
  qtk: number;
}

/**
 * Sức chịu tải của khối móng cừ tràm – bảng tính (1):
 * F_xq = 2(B_m + L_m)·L_cừ; Q_m = (γ·(h_m + L_cừ)·N'q + c·N'c)·F_m; Q_f = c·F_xq; Q_tk = Q_m/FS_m + Q_f/FS_f.
 */
export function cuBlock(a: {
  Bm: number;
  Lm: number;
  hm: number;
  L: number;
  phi: number;
  gamma: number;
  c: number;
  fsTip: number;
  fsSide: number;
}): CuBlockResult {
  const Am = a.Bm * a.Lm;
  const Fxq = 2 * (a.Bm + a.Lm) * a.L;
  const { Nc, Nq, Ng } = cuTerzaghi(a.phi);
  const Qm = (a.gamma * (a.hm + a.L) * Nq + a.c * Nc) * Am;
  const Qf = Fxq * a.c;
  const Qtk = Qm / a.fsTip + Qf / a.fsSide;
  return { Am, Fxq, Nc, Nq, Ng, Qm, Qf, Qu: Qm + Qf, Qtk, qtk: Am > 0 ? Qtk / Am : 0 };
}

/**
 * Ma sát bên tiêu chuẩn f (kPa) của bùn sét theo độ sâu z (m) tính từ đỉnh cừ – quy tắc dùng trong
 * bảng tính (2): 1–2 m: 2 + 2(z−1); 2–3 m: 4 + (z−2); 3–4 m: 5; 4–5 m: 5 + (z−4); ngoài khoảng: 2 (z < 1) hoặc 6.
 */
export function cuSideF(z: number): number {
  if (z < 1) return 2;
  if (z <= 2) return 2 + 2 * (z - 1);
  if (z <= 3) return 4 + (z - 2);
  if (z <= 4) return 5;
  if (z <= 5) return 5 + (z - 4);
  return 6;
}

export interface CuSeg {
  l: number;
  /** Độ sâu dùng để tra f (m, từ đỉnh cừ). */
  z: number;
  f: number;
}

/**
 * Chia thân cừ thành các đoạn ≤ 2 m và tra f cho từng đoạn như bảng tính (2): đoạn đầu tra tại
 * đáy đoạn (z = l₁), các đoạn sau tra tại giữa đoạn.
 */
export function cuSegments(L: number): CuSeg[] {
  const out: CuSeg[] = [];
  let top = 0;
  let rest = Math.max(0, L);
  while (rest > 1e-9) {
    const l = Math.min(2, rest);
    const z = out.length === 0 ? l : top + l / 2;
    out.push({ l, z, f: cuSideF(z) });
    top += l;
    rest -= l;
  }
  return out;
}

export interface CuSingleResult {
  /** Tiết diện ngang (m²) và chu vi (m) của một cây cừ. */
  F: number;
  u: number;
  segs: CuSeg[];
  sumFl: number;
  /** Phần chống mũi và phần ma sát của một cây (kN). */
  Qtip: number;
  Qside: number;
  Qc: number;
}

/** Sức chịu tải của một cây cừ theo đất nền (20TCN 21-86): Q_c = m·(m_R·R·F + u·m_f·Σ f_i·l_i). */
export function cuSingle(a: { d: number; L: number; Rtip: number; m: number; mR: number; mf: number }): CuSingleResult {
  const dm = a.d / 100;
  const F = (Math.PI * dm * dm) / 4;
  const u = Math.PI * dm;
  const segs = cuSegments(a.L);
  const sumFl = segs.reduce((s, x) => s + x.f * x.l, 0);
  const Qtip = a.m * a.mR * a.Rtip * F;
  const Qside = a.m * u * a.mf * sumFl;
  return { F, u, segs, sumFl, Qtip, Qside, Qc: Qtip + Qside };
}

/** Bề rộng móng khối quy ước: B_qu = B + 2·L·tg(φ/4). */
export function cuBqu(B: number, L: number, phi: number): number {
  return B + 2 * L * Math.tan(((phi / 4) * Math.PI) / 180);
}

/**
 * Sức chịu tải của đất dưới đáy móng khối quy ước – bảng tính (2), theo 20TCN 45-78:
 * R = (m1·m2/k_tc)·(1,1·A·B_M·γ_II + 1,1·B·H_M·γ'_II + 3·D·c_II).
 */
export function cuRBlock(a: {
  A: number;
  B: number;
  D: number;
  BM: number;
  HM: number;
  gamma: number;
  gammaAbove: number;
  c: number;
  m1m2: number;
  ktc: number;
}): number {
  return (a.m1m2 / a.ktc) * (1.1 * a.A * a.BM * a.gamma + 1.1 * a.B * a.HM * a.gammaAbove + 3 * a.D * a.c);
}

/** Một tổ hợp tải của tường tại đáy bản đáy (trên 1 m dài). */
export interface CuWallCombo {
  k: string;
  nm: string;
  /** Lực đứng (kN/m). */
  N: number;
  /** Độ lệch tâm của hợp lực so với tâm đáy (m). */
  s: number;
}

export interface CuResult {
  /** Bề rộng bản đáy và chiều dài đơn nguyên (m). */
  B: number;
  Lu: number;
  nTotal: number;
  /** Khoảng cách tim cừ theo lưới vuông (m). */
  spacing: number;
  abd: { A: number; B: number; D: number };
  /** Sức chịu tải tiêu chuẩn của nền tự nhiên khi chưa có cừ (kPa). */
  Rtc: number;
  block: CuBlockResult;
  single: CuSingleResult;
  /** Sức chịu tải của các cây cừ trên 1 m² với mật độ đã chọn (kPa). */
  qPiles: number;
  /** Áp lực đáy móng: tổ hợp sử dụng (tiêu chuẩn) và tổ hợp cường độ lớn nhất (tính toán), kPa. */
  pSd: number;
  pSdAt: string;
  pTt: number;
  pTtAt: string;
  /** Số cây cần trên 1 m² (chưa làm tròn / làm tròn lên). */
  nReqRaw: number;
  nReq: number;
  Bqu: number;
  HM: number;
  sigBt: number;
  sigBase: number;
  RBase: number;
  /** Hệ số sử dụng (≤ 1 là đạt). */
  vBlock: number;
  vCount: number;
  vBase: number;
  warn: string[];
}

function pressure(c: CuWallCombo, B: number): number {
  // Phân bố đều trên bề rộng hữu hiệu B − 2e (như kiểm tra nền đất của TCVN 11823-10)
  const be = Math.max(0.1 * B, B - 2 * Math.abs(c.s));
  return c.N / be;
}

/**
 * Tính toàn bộ móng cừ tràm cho tường: `B`, `Lu` tính bằng m; `combos` là các tổ hợp của tường.
 * Áp lực tiêu chuẩn lấy từ tổ hợp sử dụng (k = 'SD'), áp lực tính toán là lớn nhất của các tổ hợp còn lại.
 */
export function cuRun(q: CuTramConfig, combos: readonly CuWallCombo[], B: number, Lu: number): CuResult {
  const warn: string[] = [];
  const gAbove = q.gammaAbove ?? q.gamma;
  const abd = cuABD(q.phi);
  const Rtc = cuRtc({ ...abd, b: B, h: q.hm, gamma: q.gamma, gammaAbove: gAbove, c: q.c, m1: q.m1, m2: q.m2, ktc: q.ktc });
  const block = cuBlock({ Bm: B, Lm: Lu, hm: q.hm, L: q.L, phi: q.phi, gamma: q.gamma, c: q.c, fsTip: q.fsTip, fsSide: q.fsSide });
  const single = cuSingle({ d: q.d, L: q.L, Rtip: q.Rtip, m: q.m, mR: q.mR, mf: q.mf });

  let pSd = 0;
  let pSdAt = '';
  let pTt = 0;
  let pTtAt = '';
  combos.forEach((c) => {
    const p = pressure(c, B);
    if (c.k === 'SD') {
      if (p > pSd) {
        pSd = p;
        pSdAt = c.nm;
      }
    } else if (p > pTt) {
      pTt = p;
      pTtAt = c.nm;
    }
  });
  if (!pSdAt) {
    // không có tổ hợp sử dụng: dùng tạm áp lực tính toán (thiên về an toàn)
    pSd = pTt;
    pSdAt = pTtAt;
  }

  const nReqRaw = single.Qc > 0 ? pTt / single.Qc : Infinity;
  const nReq = Number.isFinite(nReqRaw) ? Math.ceil(nReqRaw - 1e-9) : 0;
  const qPiles = q.n * single.Qc;

  const Bqu = cuBqu(B, q.L, q.phi);
  const HM = q.hm + q.L;
  const sigBt = q.gamma * HM;
  const sigBase = sigBt + pTt;
  const RBase = cuRBlock({ ...abd, BM: Bqu, HM, gamma: q.gamma, gammaAbove: gAbove, c: q.c, m1m2: 1, ktc: q.ktcBlock });

  const spacing = q.n > 0 ? 1 / Math.sqrt(q.n) : 0;
  if (q.n < 16 || q.n > 36) warn.push('Mật độ cừ tràm thông thường 16–36 cây/m² (phổ biến 25 cây/m²).');
  if (q.L < 2 || q.L > 5) warn.push('Chiều dài cừ tràm thông thường 2–5 m.');
  if (q.d < 4 || q.d > 12) warn.push('Đường kính thân cừ tràm thông thường 6–10 cm.');
  if (spacing > 0 && spacing < (3 * q.d) / 100 - 1e-9) {
    warn.push('Khoảng cách tim cừ nhỏ hơn 3 lần đường kính: cừ làm việc như một khối, số cây tăng thêm ít hiệu quả.');
  }

  return {
    B,
    Lu,
    nTotal: Math.round(q.n * B * Lu),
    spacing,
    abd,
    Rtc,
    block,
    single,
    qPiles,
    pSd,
    pSdAt,
    pTt,
    pTtAt,
    nReqRaw,
    nReq,
    Bqu,
    HM,
    sigBt,
    sigBase,
    RBase,
    vBlock: block.qtk > 0 ? pSd / block.qtk : 99,
    vCount: q.n > 0 && Number.isFinite(nReqRaw) ? nReqRaw / q.n : 99,
    vBase: RBase > 0 ? sigBase / RBase : 99,
    warn,
  };
}

const TIP_BLOCK = 'Áp lực tiêu chuẩn dưới đáy móng / sức chịu tải thiết kế của khối móng cừ tràm (≤ 1 là đạt)';
const TIP_COUNT = 'Số cây cừ cần trên 1 m² (theo sức chịu tải từng cây, 20TCN 21-86) / mật độ đã chọn (≤ 1 là đạt)';
const TIP_BASE = 'Ứng suất tại đáy móng khối quy ước / sức chịu tải của đất dưới mũi cừ (≤ 1 là đạt)';

/** Các mục kiểm tra hiển thị ở thanh bên (rỗng khi không có kết quả). */
export function cuCheckItems(r: CuResult | null): EngineCheckItem[] {
  if (!r) return [];
  const cap = (v: number) => (Number.isFinite(v) ? v : 99);
  return [
    { id: 'cu-block', t: 'Cừ tràm – khối móng', v: cap(r.vBlock), ok: r.vBlock <= 1, tip: TIP_BLOCK },
    { id: 'cu-count', t: 'Cừ tràm – mật độ cây', v: cap(r.vCount), ok: r.vCount <= 1, tip: TIP_COUNT },
    { id: 'cu-base', t: 'Cừ tràm – đất dưới mũi', v: cap(r.vBase), ok: r.vBase <= 1, tip: TIP_BASE },
  ];
}

export interface CuGrid {
  nx: number;
  nz: number;
  n: number;
  /** Bước lưới theo bề rộng bản đáy và theo chiều dài tường (m). */
  sx: number;
  sz: number;
}

/**
 * Lưới đóng cừ dưới bản đáy (ô vuông gần đúng theo mật độ): số hàng theo bề rộng B và theo chiều dài
 * đơn nguyên Lu (m). Dùng chung cho khối lượng và mô hình 3D.
 */
export function cuGrid(q: Pick<CuTramConfig, 'n'>, B: number, Lu: number): CuGrid {
  const s = q.n > 0 ? 1 / Math.sqrt(q.n) : 1;
  const nx = Math.max(1, Math.round(B / s));
  const nz = Math.max(1, Math.round(Lu / s));
  return { nx, nz, n: nx * nz, sx: B / nx, sz: Lu / nz };
}
