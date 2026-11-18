import type { SubgradeConfig } from '../types/project';
import { SOIL_MOISTURE_TABLES, type SoilMoistureRow } from '../data/tables22tcn211';

function interpRows(rows: SoilMoistureRow[], a: number): { E0: number; phi: number; C: number } {
  const minA = rows[0].a;
  const maxA = rows[rows.length - 1].a;
  const clamped = Math.min(maxA, Math.max(minA, a));

  for (let i = 0; i < rows.length - 1; i++) {
    const r0 = rows[i];
    const r1 = rows[i + 1];
    if (clamped >= r0.a && clamped <= r1.a) {
      const t = r1.a === r0.a ? 0 : (clamped - r0.a) / (r1.a - r0.a);
      return {
        E0: r0.E0 + t * (r1.E0 - r0.E0),
        phi: r0.phi + t * (r1.phi - r0.phi),
        C: r0.C + t * (r1.C - r0.C),
      };
    }
  }
  const last = rows[rows.length - 1];
  return { E0: last.E0, phi: last.phi, C: last.C };
}

function interpGravelE0(a: number): number {
  const rows = SOIL_MOISTURE_TABLES.LanSoiSan_E0;
  const clamped = Math.min(rows[rows.length - 1].a, Math.max(rows[0].a, a));
  for (let i = 0; i < rows.length - 1; i++) {
    const r0 = rows[i];
    const r1 = rows[i + 1];
    if (clamped >= r0.a && clamped <= r1.a) {
      const t = (clamped - r0.a) / (r1.a - r0.a);
      return r0.E0 + t * (r1.E0 - r0.E0);
    }
  }
  return rows[rows.length - 1].E0;
}

/**
 * Resolves subgrade soil parameters (E0, phi, C) by relative moisture a = Wtn / Wnh
 * per TCCS 38:2022/TCĐBVN Appendix B Table B.4 (including Note 3 +20% E0 for improved compaction).
 */
export function resolveSubgradeByMoisture(
  loaiDat: string,
  a: number,
  _K: number,
  lanSoiSan: boolean,
  damNenCaiTien = false,
): { E0_MPa: number; phi_deg: number; C_MPa: number } {
  const normalized = loaiDat.trim().toLowerCase();
  let res: { E0: number; phi: number; C: number };

  if (normalized === 'sét' || normalized === 'á sét') {
    res = interpRows(SOIL_MOISTURE_TABLES.Set_and_ASet, a);
  } else if (
    normalized === 'á sét nhẹ' ||
    normalized === 'á cát bụi nặng' ||
    normalized === 'á sét bụi nặng'
  ) {
    res = interpRows(SOIL_MOISTURE_TABLES.ASetNhe_and_ACatBuiNang, a);
  } else if (normalized === 'á cát nhẹ' || normalized === 'á cát') {
    res = interpRows(SOIL_MOISTURE_TABLES.ACatNhe_and_ACat, a);
  } else if (normalized === 'cát mịn') {
    res = {
      E0: SOIL_MOISTURE_TABLES.CatMin.E0,
      phi: SOIL_MOISTURE_TABLES.CatMin.phi,
      C: SOIL_MOISTURE_TABLES.CatMin.C,
    };
  } else if (normalized.includes('bazan')) {
    res = interpRows(SOIL_MOISTURE_TABLES.DatBazanTayNguyen, a);
  } else {
    res = interpRows(SOIL_MOISTURE_TABLES.Set_and_ASet, a);
  }

  const baseE0 = lanSoiSan ? interpGravelE0(a) : res.E0;
  const E0_MPa = damNenCaiTien ? baseE0 * 1.2 : baseE0;
  return {
    E0_MPa: Number(E0_MPa.toFixed(4)),
    phi_deg: Number(res.phi.toFixed(4)),
    C_MPa: Number(res.C.toFixed(6)),
  };
}

/**
 * Estimates subgrade resilient modulus E0 (MPa) from CBR (%) per TCCS 38:2022 Appendix B Eqs. (B.1)/(B.2).
 */
export function computeE0FromCbr(cbrPercent: number, isSandFill = false): number {
  const cbr = Math.max(0, cbrPercent);
  if (cbr === 0) return isSandFill ? 12.48 : 0;
  const val = isSandFill ? 4.68 * cbr + 12.48 : 7.93 * Math.pow(cbr, 0.85);
  return Number(val.toFixed(2));
}

export function resolveSubgrade(subgrade: SubgradeConfig): {
  E0_MPa: number;
  phi_deg: number;
  C_MPa: number;
} {
  if (subgrade.xacDinhTheoDoAm) {
    return resolveSubgradeByMoisture(
      subgrade.loaiDat,
      subgrade.doAmTuongDoi_a,
      subgrade.doChatYeuCau_K,
      subgrade.lanSoiSan,
      subgrade.damNenCaiTien ?? false,
    );
  }
  return {
    E0_MPa: subgrade.E0_MPa,
    phi_deg: subgrade.phi_deg,
    C_MPa: subgrade.C_MPa,
  };
}
