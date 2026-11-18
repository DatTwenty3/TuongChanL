import type {
  DesignObjectType,
  ForecastConfig,
  RoadScale,
  RoadType,
  StandardAxleType,
  SurfaceGrade,
} from '../types/project';
import {
  TABLE_3_2_KCD_VONG,
  TABLE_3_4_EYC,
  TABLE_3_5_EMIN,
  TABLE_3_7_KCD_KEOUON,
  TABLE_3_7_KCD_TRUOT,
} from '../data/tables22tcn211';

function lookupSafetyMap(map: Record<string, number>, reliability: number): number {
  const key = reliability.toFixed(2);
  if (map[key] !== undefined) return map[key];
  const entries = Object.entries(map)
    .map(([k, v]) => ({ r: parseFloat(k), v }))
    .sort((a, b) => a.r - b.r);
  if (reliability <= entries[0].r) return entries[0].v;
  if (reliability >= entries[entries.length - 1].r) return entries[entries.length - 1].v;
  for (let i = 0; i < entries.length - 1; i++) {
    if (reliability >= entries[i].r && reliability <= entries[i + 1].r) {
      const t = (reliability - entries[i].r) / (entries[i + 1].r - entries[i].r);
      return entries[i].v + t * (entries[i + 1].v - entries[i].v);
    }
  }
  return entries[0].v;
}

export function computeKcd(doTinCayTK: number): {
  Kcd_vong: number;
  Kcd_truot: number;
  Kcd_keoUon: number;
} {
  return {
    Kcd_vong: lookupSafetyMap(TABLE_3_2_KCD_VONG, doTinCayTK),
    Kcd_truot: lookupSafetyMap(TABLE_3_7_KCD_TRUOT, doTinCayTK),
    Kcd_keoUon: lookupSafetyMap(TABLE_3_7_KCD_KEOUON, doTinCayTK),
  };
}

/**
 * Linearly interpolates TCCS 38:2022 Table 9 (formerly Table 3-4) Eyc (MPa)
 * across design daily standard axles Ntt. Returns 0 for B2 (not specified in Table 9).
 */
export function computeEyc(
  Ntt: number,
  tlTrucQuyDoi: StandardAxleType,
  loaiTangMat: SurfaceGrade,
): number {
  if (Ntt <= 0 || loaiTangMat === 'B2') return 0;
  const rows = TABLE_3_4_EYC[tlTrucQuyDoi];
  const validPoints = rows
    .map((r) => ({ n: r.Ntt, e: r[loaiTangMat] }))
    .filter((pt) => pt.e > 0);

  if (validPoints.length === 0) return 0;
  if (Ntt <= validPoints[0].n) return validPoints[0].e;
  const last = validPoints[validPoints.length - 1];
  if (Ntt >= last.n) return last.e;

  for (let i = 0; i < validPoints.length - 1; i++) {
    const p0 = validPoints[i];
    const p1 = validPoints[i + 1];
    if (Ntt >= p0.n && Ntt <= p1.n) {
      const t = (Ntt - p0.n) / (p1.n - p0.n);
      return p0.e + t * (p1.e - p0.e);
    }
  }
  return last.e;
}

/**
 * Looks up TCCS 38:2022 Table 10 (formerly Table 3-5) minimum required modulus Emin (MPa).
 * Returns 0 for B2 (not specified in Table 10).
 */
export function computeEmin(
  loaiDuong: RoadType,
  capDuong: string,
  loaiTangMat: SurfaceGrade,
  doiTuongTK: DesignObjectType = 'KCAD',
): number {
  if (loaiTangMat === 'B2') return 0;
  const list = TABLE_3_5_EMIN[loaiDuong];
  const match = list.find((item) => item.roadClass === capDuong);
  if (!match) return 0;
  if (doiTuongTK === 'LGC' && loaiDuong === 'DUONG_O_TO' && match.shoulder?.[loaiTangMat] !== undefined) {
    return match.shoulder[loaiTangMat] ?? 0;
  }
  return match[loaiTangMat] ?? 0;
}

export function computeDesignModulus(
  Ntt: number,
  roadScale: RoadScale,
  forecast: ForecastConfig,
  loaiTangMat: SurfaceGrade,
  doiTuongTK: DesignObjectType = 'KCAD',
): { Eyc_MPa: number; Emin_MPa: number; Ett_MPa: number } {
  const Eyc_MPa = computeEyc(Ntt, forecast.tlTrucQuyDoi_kN, loaiTangMat);
  const Emin_MPa = computeEmin(roadScale.loaiDuong, roadScale.capDuong, loaiTangMat, doiTuongTK);
  const Ett_MPa = Math.max(Eyc_MPa, Emin_MPa);
  return { Eyc_MPa, Emin_MPa, Ett_MPa };
}
