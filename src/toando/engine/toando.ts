import type { ToanDoId, ToanDoLookupInput, ToanDoLookupResult } from '../types/project';
import { TOANDO_CURVES } from '../data/toandoCurves';

function lerp(x1: number, x2: number, y1: number, y2: number, x: number): number {
  if (x1 === x2) return y1;
  return y1 + ((x - x1) * (y2 - y1)) / (x2 - x1);
}

function interpScalarKnots(
  knots: ReadonlyArray<{ readonly x: number; readonly y: number }>,
  x: number,
): number {
  if (x <= knots[0].x) return knots[0].y;
  if (x >= knots[knots.length - 1].x) return knots[knots.length - 1].y;
  for (let i = 0; i < knots.length - 1; i++) {
    const k0 = knots[i];
    const k1 = knots[i + 1];
    if (x >= k0.x && x <= k1.x) {
      return lerp(k0.x, k1.x, k0.y, k1.y, x);
    }
  }
  return knots[knots.length - 1].y;
}

function interpPolyKnots(
  knots: ReadonlyArray<{ readonly x: number; readonly y: readonly number[] }>,
  x: number,
): number[] {
  if (x <= knots[0].x) return [...knots[0].y];
  if (x >= knots[knots.length - 1].x) return [...knots[knots.length - 1].y];
  for (let i = 0; i < knots.length - 1; i++) {
    const k0 = knots[i];
    const k1 = knots[i + 1];
    if (x >= k0.x && x <= k1.x) {
      return k0.y.map((v, idx) => lerp(k0.x, k1.x, v, k1.y[idx], x));
    }
  }
  return [...knots[knots.length - 1].y];
}

function evalPolyDesc(coeffs: readonly number[], x: number): number {
  let acc = 0;
  for (let i = 0; i < coeffs.length; i++) {
    acc = acc * x + coeffs[i];
  }
  return acc;
}

function interpRaySlope(
  rayValues: readonly number[],
  raySlopes: readonly number[],
  targetRay: number,
): number | null {
  if (rayValues.length === 0) return null;
  const minR = Math.min(...rayValues);
  const maxR = Math.max(...rayValues);
  const clamped = Math.min(maxR, Math.max(minR, targetRay));
  for (let i = 0; i < rayValues.length - 1; i++) {
    const r0 = rayValues[i];
    const r1 = rayValues[i + 1];
    const lo = Math.min(r0, r1);
    const hi = Math.max(r0, r1);
    if (clamped >= lo && clamped <= hi) {
      return lerp(r0, r1, raySlopes[i], raySlopes[i + 1], clamped);
    }
  }
  return raySlopes[0];
}

function interpCurveY(pts: ReadonlyArray<readonly [number, number]>, xPx: number): number | null {
  if (pts.length === 0) return null;
  const clamped = Math.min(pts[pts.length - 1][0], Math.max(pts[0][0], xPx));
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    if (clamped >= x0 && clamped <= x1) {
      return lerp(x0, x1, y0, y1, clamped);
    }
  }
  return pts[pts.length - 1][1];
}

function makeInvalid(id: ToanDoId, reason: string): ToanDoLookupResult {
  return {
    id,
    valid: false,
    value: null,
    displayValue: '#N/A',
    reason,
    segmentsPx: [],
  };
}

/**
 * Evaluates ADMv2.exe TTdo3_1 bilinear 41x37 grid (H/D <= 2.0) or Eq. (F-1) (H/D > 2.0).
 * Used internally by verification routines even when H/D > 2.0.
 */
export function evalToanDo31Internal(H_over_D: number, Eo_over_E1: number): number {
  const eoClamped = Math.min(0.9, Math.max(0.0, Eo_over_E1));
  const hd = Math.max(0.0, H_over_D);
  if (hd > 2.0) {
    if (eoClamped <= 0) return 0;
    const denom =
      (1 + eoClamped) / Math.sqrt(1 + 4 * hd * hd * Math.pow(eoClamped, -0.67)) + eoClamped;
    return (1.05 * eoClamped) / denom;
  }

  const { h_d_axis, eo_e1_axis, grid } = TOANDO_CURVES.math.toando_3_1;
  let r = 0;
  for (let i = 0; i < h_d_axis.length - 1; i++) {
    if (hd >= h_d_axis[i] && hd <= h_d_axis[i + 1]) {
      r = i;
      break;
    }
  }
  if (hd >= h_d_axis[h_d_axis.length - 1]) r = h_d_axis.length - 2;

  let c = 0;
  for (let j = 0; j < eo_e1_axis.length - 1; j++) {
    if (eoClamped >= eo_e1_axis[j] && eoClamped <= eo_e1_axis[j + 1]) {
      c = j;
      break;
    }
  }
  if (eoClamped >= eo_e1_axis[eo_e1_axis.length - 1]) c = eo_e1_axis.length - 2;

  const v0 = lerp(eo_e1_axis[c], eo_e1_axis[c + 1], grid[r][c], grid[r][c + 1], eoClamped);
  const v1 = lerp(
    eo_e1_axis[c],
    eo_e1_axis[c + 1],
    grid[r + 1][c],
    grid[r + 1][c + 1],
    eoClamped,
  );
  return lerp(h_d_axis[r], h_d_axis[r + 1], v0, v1, hd);
}

/**
 * Toán đồ 3-1 (Hình 3-1): Xác định tỷ số Ech.m / E1 từ H/D in [0, 2.0] và Eo/E1 in [0, 0.90].
 */
export function lookupToanDo31(H_over_D: number, Eo_over_E1: number): ToanDoLookupResult {
  if (
    !Number.isFinite(H_over_D) ||
    !Number.isFinite(Eo_over_E1) ||
    H_over_D < 0 ||
    H_over_D > 2.0 ||
    Eo_over_E1 < 0 ||
    Eo_over_E1 > 0.9
  ) {
    return makeInvalid('3-1', 'Ngoài miền tra cứu (H/D ∈ [0; 2,0], Eo/E1 ∈ [0; 0,90])');
  }

  const val = evalToanDo31Internal(H_over_D, Eo_over_E1);
  const xMin = 54;
  const xMax = 539;
  const yMin = 29;
  const yMax = 488;
  const xPx = xMin + (H_over_D / 2.0) * (xMax - xMin);
  const yPx = yMax - (Eo_over_E1 / 0.9) * (yMax - yMin);

  return {
    id: '3-1',
    valid: true,
    value: val,
    displayValue: val.toFixed(4),
    pointPx: { xPx, yPx, label: `Ech/E1 = ${val.toFixed(3)}` },
    segmentsPx: [
      { x1Px: xPx, y1Px: yMax, x2Px: xPx, y2Px: yPx, color: 'red' },
      { x1Px: xMin, y1Px: yPx, x2Px: xPx, y2Px: yPx, color: 'red' },
    ],
  };
}

function buildTwoQuadrantTrace(
  xVal: number,
  xMaxVal: number,
  xMinPx: number,
  xMaxPx: number,
  yTopPx: number,
  yBottomPx: number,
  curveVal: number,
  curveValues: readonly number[],
  curvesPx: ReadonlyArray<ReadonlyArray<readonly [number, number]>>,
  rayVal: number,
  rayValues: readonly number[],
  raySlopes: readonly number[],
  originX: number,
  originY: number,
  yellowMinPx: number,
  yellowMaxPx: number,
  yellowY: number,
  outVal: number,
  outMaxVal: number,
) {
  const xTopPx = xMinPx + (Math.min(xMaxVal, Math.max(0, xVal)) / xMaxVal) * (xMaxPx - xMinPx);
  const xOutPx =
    yellowMinPx + (Math.min(outMaxVal, Math.max(0, outVal)) / outMaxVal) * (yellowMaxPx - yellowMinPx);

  const slope = interpRaySlope(rayValues, raySlopes, rayVal);
  let yMidPx: number;
  if (slope !== null && slope > 0) {
    yMidPx = Math.min(yBottomPx, Math.max(yTopPx, originY - (xOutPx - originX) / slope));
  } else {
    const targetLog = Math.log(Math.max(1e-6, curveVal));
    const samples: Array<{ logVal: number; y: number }> = [];
    for (let i = 0; i < curveValues.length; i++) {
      const y = interpCurveY(curvesPx[i], xTopPx);
      if (y !== null) samples.push({ logVal: Math.log(curveValues[i]), y });
    }
    yMidPx = (yTopPx + yBottomPx) * 0.5;
    for (let i = 0; i < samples.length - 1; i++) {
      if (targetLog >= samples[i].logVal && targetLog <= samples[i + 1].logVal) {
        yMidPx = lerp(samples[i].logVal, samples[i + 1].logVal, samples[i].y, samples[i + 1].y, targetLog);
        break;
      }
    }
  }

  return {
    xOutPx,
    yMidPx,
    segmentsPx: [
      { x1Px: xTopPx, y1Px: yTopPx, x2Px: xTopPx, y2Px: yMidPx, color: 'red' as const },
      { x1Px: xTopPx, y1Px: yMidPx, x2Px: xOutPx, y2Px: yMidPx, color: 'red' as const },
      { x1Px: xOutPx, y1Px: yMidPx, x2Px: xOutPx, y2Px: yellowY, color: 'yellow' as const },
    ],
  };
}

/**
 * Evaluates ADMv2.exe TTdo3_2 exact polynomial + phi knot formula.
 */
export function evalToanDo32Internal(
  h_over_D: number,
  E1_over_E2: number,
  phi_deg: number,
): number {
  const { e1_e2_poly6_knots, phi_knots, divisor_scale } = TOANDO_CURVES.math.toando_3_2;
  const eClamped = Math.max(2.0, Math.min(50.0, E1_over_E2));
  const coeffs = interpPolyKnots(e1_e2_poly6_knots, eClamped);
  const kPhi = interpScalarKnots(phi_knots, Math.max(2.0, Math.min(46.0, phi_deg)));
  if (kPhi === 0) return 0;
  return Math.max(0, evalPolyDesc(coeffs, h_over_D) / (divisor_scale * kPhi));
}

/**
 * Toán đồ 3-2 (Hình 3-2): Xác định tỷ số τax/p với H/D in [0, 2.0], E1/E2 in [2, 50], phi in [2, 46].
 */
export function lookupToanDo32(
  h_over_D: number,
  E1_over_E2: number,
  phi_deg: number,
): ToanDoLookupResult {
  if (
    !Number.isFinite(h_over_D) ||
    !Number.isFinite(E1_over_E2) ||
    !Number.isFinite(phi_deg) ||
    h_over_D < 0 ||
    h_over_D > 2.0 ||
    E1_over_E2 < 2.0 ||
    E1_over_E2 > 50.0 ||
    phi_deg < 2.0 ||
    phi_deg > 46.0
  ) {
    return makeInvalid(
      '3-2',
      'Ngoài miền tra cứu (H/D ∈ [0; 2,0], E1/E2 ∈ [2; 50], φ ∈ [2; 46] độ)',
    );
  }

  const val = evalToanDo32Internal(h_over_D, E1_over_E2, phi_deg);
  if (val < 0 || val > 0.2) {
    return makeInvalid('3-2', 'Kết quả τax/p vượt quá miền trục [0; 0,20]');
  }

  const g = TOANDO_CURVES.pngGeometry.c32;
  const trace = buildTwoQuadrantTrace(
    h_over_D,
    2.0,
    39,
    719,
    9,
    383,
    E1_over_E2,
    g.curveValues,
    g.curvesPx,
    phi_deg,
    g.rayValues,
    g.raySlopes,
    g.originPx[0],
    g.originPx[1],
    40,
    701,
    415,
    val,
    0.2,
  );

  return {
    id: '3-2',
    valid: true,
    value: val,
    displayValue: val.toFixed(4),
    pointPx: { xPx: trace.xOutPx, yPx: 415, label: `τax/p = ${val.toFixed(4)}` },
    segmentsPx: trace.segmentsPx,
  };
}

/**
 * Evaluates ADMv2.exe TTdo3_3 exact polynomial + phi knot formula.
 */
export function evalToanDo33Internal(
  h_over_D: number,
  E1_over_E2: number,
  phi_deg: number,
): number {
  const { e1_e2_poly6_knots, phi_knots, divisor_scale } = TOANDO_CURVES.math.toando_3_3;
  if (E1_over_E2 < 5.0 || E1_over_E2 > 50.0) {
    return evalToanDo32Internal(h_over_D, E1_over_E2, phi_deg);
  }
  const coeffs = interpPolyKnots(e1_e2_poly6_knots, E1_over_E2);
  const kPhi = interpScalarKnots(phi_knots, Math.max(2.0, Math.min(46.0, phi_deg)));
  if (kPhi === 0) return 0;
  return Math.max(0, evalPolyDesc(coeffs, h_over_D) / (divisor_scale * kPhi));
}

/**
 * Toán đồ 3-3 (Hình 3-3): Xác định tỷ số τax/p với H/D in [0, 4.0], E1/E2 in [5, 50], phi in [2, 46].
 */
export function lookupToanDo33(
  h_over_D: number,
  E1_over_E2: number,
  phi_deg: number,
): ToanDoLookupResult {
  if (
    !Number.isFinite(h_over_D) ||
    !Number.isFinite(E1_over_E2) ||
    !Number.isFinite(phi_deg) ||
    h_over_D < 0 ||
    h_over_D > 4.0 ||
    E1_over_E2 < 5.0 ||
    E1_over_E2 > 50.0 ||
    phi_deg < 2.0 ||
    phi_deg > 46.0
  ) {
    return makeInvalid(
      '3-3',
      'Ngoài miền tra cứu (H/D ∈ [0; 4,0], E1/E2 ∈ [5; 50], φ ∈ [2; 46] độ)',
    );
  }

  const val = evalToanDo33Internal(h_over_D, E1_over_E2, phi_deg);
  if (val < 0 || val > 0.04) {
    return makeInvalid('3-3', 'Kết quả τax/p vượt quá miền trục [0; 0,04]');
  }

  const g = TOANDO_CURVES.pngGeometry.c33;
  const trace = buildTwoQuadrantTrace(
    h_over_D,
    4.0,
    59,
    699,
    11,
    395,
    E1_over_E2,
    g.curveValues,
    g.curvesPx,
    phi_deg,
    g.rayValues,
    g.raySlopes,
    g.originPx[0],
    g.originPx[1],
    60,
    700,
    424,
    val,
    0.04,
  );

  return {
    id: '3-3',
    valid: true,
    value: val,
    displayValue: val.toFixed(4),
    pointPx: { xPx: trace.xOutPx, yPx: 424, label: `τax/p = ${val.toFixed(4)}` },
    segmentsPx: trace.segmentsPx,
  };
}

/**
 * Evaluates ADMv2.exe TTdo3_4 exact piecewise-linear ray slope formula:
 *   tav = k(phi_deg) * H_cm / 100.0
 */
export function evalToanDo34Internal(H_cm: number, phi_deg: number): number {
  const { h_knots, divisor_scale } = TOANDO_CURVES.math.toando_3_4;
  if (phi_deg < 5.0 || phi_deg > 40.0) {
    return (0.005 - 0.0003 * phi_deg) * (H_cm / divisor_scale);
  }
  const kPhi = interpScalarKnots(h_knots, phi_deg);
  return (kPhi * H_cm) / divisor_scale;
}

/**
 * Toán đồ 3-4 (Hình 3-4): Xác định ứng suất cắt trượt do trọng lượng bản thân τav (MPa).
 */
export function lookupToanDo34(H_cm: number, phi_deg: number): ToanDoLookupResult {
  if (
    !Number.isFinite(H_cm) ||
    !Number.isFinite(phi_deg) ||
    H_cm < 0 ||
    H_cm > 100 ||
    phi_deg < 5 ||
    phi_deg > 40
  ) {
    return makeInvalid('3-4', 'Ngoài miền tra cứu (H ∈ [0; 100] cm, φ ∈ [5; 40] độ)');
  }

  const tav = evalToanDo34Internal(H_cm, phi_deg);
  const xMin = 199;
  const xMax = 465;
  const yZero = 181;
  const xPx = xMin + (H_cm / 100) * (xMax - xMin);
  const yPx =
    tav >= 0 ? yZero - (tav / 0.004) * (yZero - 29) : yZero + (-tav / 0.008) * (482 - yZero);

  return {
    id: '3-4',
    valid: true,
    value: tav,
    displayValue: tav.toFixed(5),
    pointPx: { xPx, yPx, label: `τav = ${tav.toFixed(5)}` },
    segmentsPx: [
      { x1Px: xPx, y1Px: yZero, x2Px: xPx, y2Px: yPx, color: 'red' },
      { x1Px: xMin, y1Px: yPx, x2Px: xPx, y2Px: yPx, color: 'yellow' },
    ],
  };
}

/**
 * Evaluates ADMv2.exe TTdo3_5 exact degree-6 polynomial over E1/Ech.m knots.
 */
export function evalToanDo35Internal(h_over_D: number, E1_over_Echm: number): number {
  const { e1_echm_poly6_knots } = TOANDO_CURVES.math.toando_3_5;
  const clampedRatio = Math.max(1.5, Math.min(100.0, E1_over_Echm));
  const coeffs = interpPolyKnots(e1_echm_poly6_knots, clampedRatio);
  return Math.max(0, evalPolyDesc(coeffs, h_over_D));
}

/**
 * Toán đồ 3-5 (Hình 3-5): Ứng suất kéo uốn đơn vị ở đáy lớp tầng mặt σku_bar.
 */
export function lookupToanDo35(h_over_D: number, E1_over_Echm: number): ToanDoLookupResult {
  if (
    !Number.isFinite(h_over_D) ||
    !Number.isFinite(E1_over_Echm) ||
    h_over_D < 0 ||
    h_over_D > 1.0 ||
    E1_over_Echm < 1.5 ||
    E1_over_Echm > 100.0
  ) {
    return makeInvalid('3-5', 'Ngoài miền tra cứu (H/D ∈ [0; 1,0], E1/Ech.m ∈ [1,5; 100])');
  }

  const sigmaBar = evalToanDo35Internal(h_over_D, E1_over_Echm);
  if (!Number.isFinite(sigmaBar) || sigmaBar < 0 || sigmaBar > 5.0) {
    return makeInvalid('3-5', 'Giá trị σku vượt quá giới hạn trục tung [0; 5,0]');
  }

  const xMin = 149;
  const xMax = 520;
  const yMin = 29;
  const yMax = 491;
  const xPx = xMin + h_over_D * (xMax - xMin);
  const yPx = yMax - (sigmaBar / 5.0) * (yMax - yMin);

  return {
    id: '3-5',
    valid: true,
    value: sigmaBar,
    displayValue: sigmaBar.toFixed(4),
    pointPx: { xPx, yPx, label: `σku = ${sigmaBar.toFixed(3)}` },
    segmentsPx: [
      { x1Px: xPx, y1Px: yMax, x2Px: xPx, y2Px: yPx, color: 'red' },
      { x1Px: xMin, y1Px: yPx, x2Px: xPx, y2Px: yPx, color: 'yellow' },
    ],
  };
}

/**
 * Evaluates ADMv2.exe TTdo3_6 exact degree-4 polynomial + E2/E3 knot formula.
 */
export function evalToanDo36Internal(
  h_over_D: number,
  E1_over_E2: number,
  E2_over_E3: number,
): number {
  const { e1_e2_poly4_knots, e2_e3_knots, divisor_scale } = TOANDO_CURVES.math.toando_3_6;
  const c12 = Math.max(1.0, Math.min(25.0, E1_over_E2));
  const c23 = Math.max(2.0, Math.min(25.0, E2_over_E3));
  const coeffs = interpPolyKnots(e1_e2_poly4_knots, c12);
  const k23 = interpScalarKnots(e2_e3_knots, c23);
  if (k23 === 0) return 0;
  return Math.max(0, evalPolyDesc(coeffs, h_over_D) / (divisor_scale * k23));
}

/**
 * Toán đồ 3-6 (Hình 3-6): Ứng suất kéo uốn đơn vị ở đáy lớp móng liền khối σku_bar.
 */
export function lookupToanDo36(
  h_over_D: number,
  E1_over_E2: number,
  E2_over_E3: number,
): ToanDoLookupResult {
  if (
    !Number.isFinite(h_over_D) ||
    !Number.isFinite(E1_over_E2) ||
    !Number.isFinite(E2_over_E3) ||
    h_over_D < 0 ||
    h_over_D > 2.0 ||
    E1_over_E2 < 1.0 ||
    E1_over_E2 > 25.0 ||
    E2_over_E3 < 2.0 ||
    E2_over_E3 > 25.0
  ) {
    return makeInvalid(
      '3-6',
      'Ngoài miền tra cứu (H/D ∈ [0; 2,0], E1/E2 ∈ [1; 25], E2/E3 ∈ [2; 25])',
    );
  }

  const val = evalToanDo36Internal(h_over_D, E1_over_E2, E2_over_E3);
  if (val < 0 || val > 1.0) {
    return makeInvalid('3-6', 'Kết quả σku vượt quá giới hạn trục [0; 1,0]');
  }

  const g = TOANDO_CURVES.pngGeometry.c36;
  const trace = buildTwoQuadrantTrace(
    h_over_D,
    2.0,
    149,
    505,
    11,
    456,
    E1_over_E2,
    g.curveValues,
    g.curvesPx,
    E2_over_E3,
    g.rayValues,
    g.raySlopes,
    g.originPx[0],
    g.originPx[1],
    150,
    506,
    492,
    val,
    1.0,
  );

  return {
    id: '3-6',
    valid: true,
    value: val,
    displayValue: val.toFixed(4),
    pointPx: { xPx: trace.xOutPx, yPx: 492, label: `σku = ${val.toFixed(4)}` },
    segmentsPx: trace.segmentsPx,
  };
}

export function lookupToanDo(input: ToanDoLookupInput): ToanDoLookupResult {
  switch (input.id) {
    case '3-1':
      return lookupToanDo31(input.x, input.yOrCurve);
    case '3-2':
      return lookupToanDo32(input.x, input.yOrCurve, input.ray ?? NaN);
    case '3-3':
      return lookupToanDo33(input.x, input.yOrCurve, input.ray ?? NaN);
    case '3-4':
      return lookupToanDo34(input.x, input.yOrCurve);
    case '3-5':
      return lookupToanDo35(input.x, input.yOrCurve);
    case '3-6':
      return lookupToanDo36(input.x, input.yOrCurve, input.ray ?? NaN);
  }
}
