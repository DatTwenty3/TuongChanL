import type { TwoLayerReductionResult, TwoLayerReductionRow } from '../types/project';
import { TABLE_3_6_BETA } from '../data/tables22tcn211';

export interface SimplePavementLayer {
  tenVatLieu: string;
  h_cm: number;
  E_MPa: number;
}

/**
 * Delphi Math.RoundTo(Value, Digit) — IEEE-754 round-half-to-even (banker's rounding).
 * Example: roundTo(9.1245, -3) === 9.124, roundTo(20.61658, -3) === 20.617.
 */
export function roundTo(value: number, digit: number): number {
  if (!Number.isFinite(value)) return value;
  const factor = Math.pow(10, -digit);
  const scaled = value * factor;
  const sign = scaled < 0 ? -1 : 1;
  const absScaled = Math.abs(scaled);
  const floorVal = Math.floor(absScaled);
  const frac = absScaled - floorVal;
  let rounded: number;
  if (Math.abs(frac - 0.5) < 1e-12) {
    rounded = floorVal % 2 === 0 ? floorVal : floorVal + 1;
  } else {
    rounded = Math.round(absScaled);
  }
  const res = (sign * rounded) / factor;
  return Object.is(res, -0) ? 0 : res;
}

/**
 * Thickness correction factor beta from 22TCN 211-06 Table 3-6 & Eq. 6 (`ADMv2.exe`).
 * - For H/D <= 2.0: piecewise-linear interpolation of Table 3-6 [0.50 .. 2.00].
 *   (Clamped smoothly via Eq. 6 when 0 < H/D < 0.50 to avoid zero/negative modulus.)
 * - For H/D > 2.0: RoundTo(1.114 * (H/D)^0.12, -3).
 */
export function computeBeta(H_over_D: number): number {
  if (H_over_D <= 0) return 1.0;
  if (H_over_D > 2.0) {
    return roundTo(1.114 * Math.pow(H_over_D, 0.12), -3);
  }
  if (H_over_D < 0.5) {
    return roundTo(1.114 * Math.pow(H_over_D, 0.12), -3);
  }
  for (let i = 0; i < TABLE_3_6_BETA.length - 1; i++) {
    const b0 = TABLE_3_6_BETA[i];
    const b1 = TABLE_3_6_BETA[i + 1];
    if (H_over_D >= b0.H_over_D && H_over_D <= b1.H_over_D) {
      const t = (H_over_D - b0.H_over_D) / (b1.H_over_D - b0.H_over_D);
      return b0.beta + t * (b1.beta - b0.beta);
    }
  }
  return TABLE_3_6_BETA[TABLE_3_6_BETA.length - 1].beta;
}

/**
 * Reduces a multi-layer pavement stack (ordered top-down) bottom-up two layers at a time
 * using TCCS 38:2022 Eq. (5)–(6):
 *   k = h2 / h1, t = E2 / E1
 *   E'tb = E1 * ((1 + k * t^(1/3)) / (1 + k))^3
 *   Htb = h1 + h2
 * Then computes beta (Table 11) and Etb_dc = min(RoundTo(Etb' * beta, -3), max(Ei))
 * per TCCS 38:2022 Table 11 Note 2.
 */
export function reduceTwoLayerSystem(
  layersTopDown: SimplePavementLayer[],
  D_cm: number,
): TwoLayerReductionResult {
  if (layersTopDown.length === 0) {
    return {
      rows: [],
      H_total_cm: 0,
      H_over_D: 0,
      EtbPrime_MPa: 0,
      beta: 1.0,
      Etb_dc_MPa: 0,
      maxLayerE_MPa: 0,
      etbCapped: false,
    };
  }

  const n = layersTopDown.length;
  const rowsReversed: TwoLayerReductionRow[] = [];

  const bottom = layersTopDown[n - 1];
  let H1 = bottom.h_cm;
  let E1 = bottom.E_MPa;
  let maxE = bottom.E_MPa;

  rowsReversed.push({
    layerOrder: n,
    tenVatLieu: bottom.tenVatLieu,
    E_MPa: bottom.E_MPa,
    t_E1_E2: null,
    h_cm: bottom.h_cm,
    k_h1_h2: null,
    Htb_cm: H1,
    EtbPrime_MPa: E1,
  });

  for (let i = n - 2; i >= 0; i--) {
    const upper = layersTopDown[i];
    const h2 = upper.h_cm;
    const E2 = upper.E_MPa;
    if (E2 > maxE) maxE = E2;

    const k = H1 > 0 ? h2 / H1 : 0;
    const t = E1 > 0 ? E2 / E1 : 1;
    const Htb = H1 + h2;
    const Etb = E1 * Math.pow((1 + k * Math.cbrt(t)) / (1 + k), 3);

    rowsReversed.push({
      layerOrder: i + 1,
      tenVatLieu: upper.tenVatLieu,
      E_MPa: E2,
      t_E1_E2: t,
      h_cm: h2,
      k_h1_h2: k,
      Htb_cm: Htb,
      EtbPrime_MPa: Etb,
    });

    H1 = Htb;
    E1 = Etb;
  }

  const rows = rowsReversed.reverse();
  const H_total_cm = H1;
  const H_over_D = D_cm > 0 ? H_total_cm / D_cm : 0;
  const EtbPrime_MPa = E1;
  const beta = computeBeta(H_over_D);
  const rawEtbDc = roundTo(EtbPrime_MPa * beta, -3);
  const etbCapped = maxE > 0 && rawEtbDc > maxE;
  const Etb_dc_MPa = maxE > 0 ? Math.min(rawEtbDc, maxE) : rawEtbDc;

  return {
    rows,
    H_total_cm,
    H_over_D,
    EtbPrime_MPa,
    beta,
    Etb_dc_MPa,
    maxLayerE_MPa: maxE,
    etbCapped,
  };
}
