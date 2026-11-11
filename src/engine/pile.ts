/**
 * Móng cọc BTCT – dữ liệu mặc định, chuẩn hóa và tiện ích dùng chung.
 *
 * Đây là mô đun mở rộng (không có trong ứng dụng gốc). Nguyên tắc:
 *  - `project.pile` vắng mặt = tắt hoàn toàn; mọi hàm ở đây là no-op khi đó, nên kết quả
 *    của tường (đối chiếu bản gốc) không thay đổi.
 *  - Sức chịu tải cọc theo đất nền tính theo TCVN 10304:2025 (bảng tra nhúng sẵn ở
 *    `tcvn10304Data.ts`, tra theo từng lớp đất); các số hình học / địa tầng mặc định chỉ là
 *    ví dụ để bắt đầu nhập, KHÔNG phải số liệu thiết kế.
 *  - Đơn vị: m, kN, kPa.
 */

import type { PileCage, PileConfig, PileDesign, PileSoilLayer } from '../types/project.ts';
import type { EngineProject } from './types.ts';

let _uid = 0;

/** Sinh id ngắn, duy nhất trong phiên làm việc (dùng làm React key cho thẻ lớp đất). */
export function pileUid(prefix = 'p'): string {
  _uid += 1;
  return `${prefix}${Date.now().toString(36)}${_uid.toString(36)}`;
}

export function pileOn(P: { pile?: PileConfig | undefined } | null | undefined): boolean {
  return Boolean(P && P.pile && P.pile.on);
}

export function pileNewLayer(over: Partial<PileSoilLayer> = {}): PileSoilLayer {
  return {
    id: pileUid('l'),
    name: 'Lớp đất',
    kind: 'clay',
    thk: 5,
    gamma: 18,
    c: 0,
    phi: 0,
    Su: 0,
    IL: 0.5,
    N: 0,
    E: 10,
    grain: 'medium',
    clayType: 'clay',
    kf: 1,
    kb: 1,
    K: null,
    ...over,
  };
}

/** Ví dụ lồng thép để bắt đầu nhập – KHÔNG phải kết quả thiết kế (kiểm tra kết cấu ở giai đoạn sau). */
export function pileCageDefaults(): PileCage {
  return { nMain: 4, dMain: 16, dHoop: 6, sEnd: 0.1, sMid: 0.2, Lend: 1.5, hook: 100 };
}

export function pileDesignDefaults(): PileDesign {
  return {
    cls: 'C2',
    z0: 1,
    install: 'hammer',
    gRR: 1,
    gRf: 1,
    bored: 'wet',
    srLow: false,
    tipClosed: true,
    selfWeight: true,
    testKind: 'static',
  };
}

/**
 * Giá trị khởi tạo khi người dùng bật móng cọc. Các số hình học / địa tầng chỉ là ví dụ
 * để bắt đầu nhập, KHÔNG phải số liệu thiết kế.
 */
export function pileDefaults(): PileConfig {
  return {
    on: true,
    type: 'sq',
    size: 0.3,
    wall: 0,
    L: 18,
    embed: 0.1,
    concrete: 'M300',
    steel: 'CB400-V',
    cover: 50,

    nx: 2,
    sx: 1.2,
    centered: true,
    x0: 0.5,
    sy: 1.2,
    stagger: false,

    cage: pileCageDefaults(),
    layers: [
      pileNewLayer({
        id: 'l1',
        name: 'Lớp 1 – bùn sét',
        kind: 'clay',
        thk: 10,
        gamma: 15,
        c: 10,
        phi: 5,
        Su: 15,
        IL: 1,
        N: 2,
        E: 3,
        clayType: 'clay',
      }),
      pileNewLayer({
        id: 'l2',
        name: 'Lớp 2 – sét dẻo cứng',
        kind: 'clay',
        thk: 8,
        gamma: 18,
        c: 30,
        phi: 14,
        Su: 60,
        IL: 0.3,
        N: 12,
        E: 15,
        clayType: 'clay',
      }),
      pileNewLayer({
        id: 'l3',
        name: 'Lớp 3 – cát vừa',
        kind: 'sand',
        thk: 10,
        gamma: 19,
        c: 0,
        phi: 30,
        Su: 0,
        IL: 0,
        N: 25,
        E: 30,
        grain: 'medium',
      }),
    ],
    method: 'tcvn',
    Qtest: null,
    design: pileDesignDefaults(),

    ignoreShallow: true,
  };
}

/**
 * Chuẩn hóa `P.pile` tại chỗ (điền các trường còn thiếu, ví dụ file cũ hơn).
 * No-op khi `P.pile` vắng mặt, và idempotent khi dữ liệu đã đầy đủ.
 */
export function pileEnsure(P: EngineProject): PileConfig | undefined {
  const q = P.pile;
  if (!q || typeof q !== 'object') return undefined;
  const d = pileDefaults();
  const dst = q as unknown as Record<string, unknown>;
  const src = d as unknown as Record<string, unknown>;
  for (const k of Object.keys(src)) {
    if (k === 'layers' || k === 'cage' || k === 'design') continue;
    if (dst[k] === undefined) dst[k] = src[k];
  }
  q.cage = Object.assign({}, d.cage, q.cage);
  q.design = Object.assign({}, d.design, q.design);
  if (!Array.isArray(q.layers)) q.layers = d.layers;
  const seen = new Set<string>();
  q.layers = q.layers.map((l) => {
    const m = Object.assign(pileNewLayer(), l);
    if (!m.id || seen.has(m.id)) m.id = pileUid('l');
    seen.add(m.id);
    return m;
  });
  return q;
}
