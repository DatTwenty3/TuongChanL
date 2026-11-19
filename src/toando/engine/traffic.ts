import type {
  DesignObjectType,
  ForecastConfig,
  RoadScale,
  TrafficSummary,
  VehicleConversionRow,
  VehicleRow,
} from '../types/project';
import { createDefaultVehicleRows } from '../data/sampleVd';
import { roundTo } from './reduction';

export function createDefaultVehicles(): VehicleRow[] {
  return createDefaultVehicleRows();
}

/**
 * Lane distribution factor f_L per TCCS 38:2022/TCĐBVN §7.9 (roadway) & §7.11 (reinforced shoulder LGC).
 */
export function computeLaneFactor(
  soLanXe: number,
  gpcGiua: boolean,
  doiTuongTK: DesignObjectType = 'KCAD',
): number {
  let fL: number;
  if (soLanXe <= 1) {
    fL = 1.0;
  } else if (soLanXe <= 3) {
    fL = 0.55;
  } else if (soLanXe < 6) {
    fL = gpcGiua ? 0.35 : 0.55;
  } else {
    fL = gpcGiua ? 0.3 : 0.35;
  }

  if (doiTuongTK === 'LGC') {
    const lgcRatio = soLanXe <= 2 ? 0.5 : soLanXe === 3 ? 0.425 : 0.35;
    return Number((fL * lgcRatio).toFixed(5));
  }
  return fL;
}

export function computeC1(soTrucSau: number, khoangCachTrucSau_m: number): number {
  if (soTrucSau <= 1) return 1.0;
  if (khoangCachTrucSau_m >= 3.0) return soTrucSau;
  return 1.0 + 1.2 * (soTrucSau - 1);
}

export function computeRearC2(cumBanh: VehicleRow['cumBanhTrucSau']): number {
  if (cumBanh === 'DON') return 6.4;
  if (cumBanh === 'BON') return 0.38;
  return 1.0;
}

const AXLE_CUTOFF_KN = 25.0;

/** Sai lệch tối đa (trục/ngày.đêm) giữa Ntk lưu trong file và tổng bảng xe để còn tin giá trị lưu. */
export const STORED_NTK_TOLERANCE = 0.5;

/**
 * Converts vehicle composition to equivalent standard axles Ntk, lane daily Ntt,
 * and cumulative standard axles Ne over the design period (ADMv2.exe Class_Xe exact rounding):
 * - Axles < 25.0 kN are excluded.
 * - Front axle Ni_truoc = RoundTo(raw, -3) (IEEE banker's rounding).
 * - Rear axle Ni_sau = RoundTo(raw, 0) (IEEE banker's rounding).
 */
export function computeTrafficSummary(
  vehicles: VehicleRow[],
  forecast: ForecastConfig,
  roadScale: RoadScale,
  storedNtkOverride?: number,
  doiTuongTK: DesignObjectType = 'KCAD',
): TrafficSummary {
  const Ptt = forecast.tlTrucQuyDoi_kN || 100;

  const conversions: VehicleConversionRow[] = vehicles.map((v, idx) => {
    const C1_truoc = 1.0;
    const C2_truoc = 6.4;
    const C1_sau = computeC1(v.soTrucSau, v.khoangCachTrucSau_m);
    const C2_sau = computeRearC2(v.cumBanhTrucSau);

    const ni = Math.max(0, v.luuLuong_xeNgDem);
    const pTruoc = v.tlTrucTruoc_kN;
    const pSau = v.tlTrucSau_kN;

    const rawFront =
      pTruoc >= AXLE_CUTOFF_KN ? C1_truoc * C2_truoc * ni * Math.pow(pTruoc / Ptt, 4.4) : 0;
    const rawRear =
      v.soTrucSau > 0 && pSau >= AXLE_CUTOFF_KN
        ? C1_sau * C2_sau * ni * Math.pow(pSau / Ptt, 4.4)
        : 0;

    const Ni_truoc = roundTo(rawFront, -3);
    const Ni_sau = roundTo(rawRear, 0);

    return {
      vehicleIndex: idx,
      tenXe: v.tenXe,
      tlTrucTruoc_kN: pTruoc,
      tlTrucSau_kN: pSau,
      C1_truoc,
      C2_truoc,
      C1_sau,
      C2_sau,
      luuLuong_xeNgDem: ni,
      Ni_truoc,
      Ni_sau,
      Ni_tong: roundTo(Ni_truoc + Ni_sau, -3),
    };
  });

  const computedNtk = roundTo(
    conversions.reduce((acc, r) => acc + r.Ni_tong, 0),
    -3,
  );
  // Giá trị Ntk lưu trong file .adm chỉ được dùng khi KHỚP với bảng xe (sai khác ≤ 0,5 trục/ngày.đêm, tức
  // chênh lệch làm tròn). Nếu file ghi một con số khác hẳn tổng các dòng quy đổi (file cũ/đã sửa tay) thì lấy
  // theo bảng xe, để tổng hiển thị luôn bằng tổng các dòng đang thấy.
  const storedMatchesRows =
    storedNtkOverride !== undefined && Math.abs(storedNtkOverride - computedNtk) <= STORED_NTK_TOLERANCE;
  const Ntk_trucNgDem = forecast.khongCoSoLieuDieuTra
    ? Math.max(0, forecast.llNamTTDirect_trucNgDem)
    : storedMatchesRows
      ? (storedNtkOverride as number)
      : computedNtk;

  const fL =
    roadScale.heSoLan_fL > 0
      ? roadScale.heSoLan_fL
      : computeLaneFactor(roadScale.soLanXe, roadScale.gpcGiua, doiTuongTK);
  const Ntt_trucLanNgDem = Ntk_trucNgDem * fL;

  const t = Math.max(1, forecast.thoiHanTK_nam);
  const q = Math.max(0, forecast.quyLuatTangTruong_q);

  let Ne_truc: number;
  if (q === 0) {
    Ne_truc = t * 365 * Ntt_trucLanNgDem;
  } else if (forecast.namTinhToan === 'NAM_DAU') {
    Ne_truc = ((Math.pow(1 + q, t) - 1) / q) * 365 * Ntt_trucLanNgDem;
  } else {
    Ne_truc =
      ((Math.pow(1 + q, t) - 1) / (q * Math.pow(1 + q, t - 1))) * 365 * Ntt_trucLanNgDem;
  }

  return {
    conversions,
    Ntk_trucNgDem,
    Ntt_trucLanNgDem,
    Ne_truc,
  };
}
