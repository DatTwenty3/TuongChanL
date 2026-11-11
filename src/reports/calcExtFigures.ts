import {
  WATER,
  type CantiCalcResult,
  type RibCalcResult,
  type SlopeRunResult,
} from '../engine';
import type { EngineProject } from '../engine/types';
import type { Point2D } from '../types/project';
import { gsK } from './calcGsFemCharts';
import { cfBody, cfGline, cfNew, cnf, getReportState } from './cfig';
import { sF, sFig, sH2, sH3, sKL, sOk, sRow, sRowT, sTab, sTx } from './reportHelpers';

export type ExtReportResult = CantiCalcResult | RibCalcResult;

const xAtYPoly = (poly: Point2D[], y: number): number | null => {
  for (let i = 0; i + 1 < poly.length; i++) {
    const a = poly[i];
    const b = poly[i + 1];
    if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
      return a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]);
    }
  }
  return null;
};

const cxBlue = 'fill="rgba(0,80,176,0.16)" stroke="#0050b0" stroke-width="1.2"';

function cxWT(D: ReturnType<typeof cfNew>, x: number, y: number): void {
  const px = D.X(x);
  const py = D.Y(y);
  D.lp(px - 6, py - 9, px + 6, py - 9, 'stroke="#0050b0" stroke-width="1"');
  D.lp(px - 6, py - 9, px, py, 'stroke="#0050b0" stroke-width="1"');
  D.lp(px + 6, py - 9, px, py, 'stroke="#0050b0" stroke-width="1"');
}

export function cfWater(R: ExtReportResult): string {
  const g = R.g;
  const I = R.I;
  const W = R.W!;
  const gw = W.gw;
  const xl = -2.8;
  const xrr = g.B + 4.4;
  const deep = 2.7;
  const top = Math.max(g.yT + Math.max(0, I.Hs) + 0.4, W.hB + 0.6, W.hF + 0.5);
  const ubs: Point2D[] = [];
  for (let i = 0; i <= 40; i++) {
    const x = (g.B * i) / 40;
    ubs.push([x, W.ub(x)]);
  }
  const bk: Point2D[] = [];
  for (let i = 0; i <= 24; i++) {
    const y = (W.hB * i) / 24;
    bk.push([y, W.u(g.B, y, 'B')]);
  }
  const um = Math.max(gw * W.hB, gw * W.hF, ...ubs.map((p) => p[1]), 1);
  const ps = 2 / um;
  const D = cfNew([xl, xrr, -deep, top], 760, 680, 560, 22, 12);
  D.poly(
    [
      [g.xbb, 0],
      [xrr, 0],
      [xrr, W.hB],
      [g.xbb, W.hB],
    ],
    'fill="rgba(60,120,220,0.10)" stroke="none"',
  );
  D.poly(
    [
      [xl, 0],
      [0, 0],
      [0, W.hF],
      [xl, W.hF],
    ],
    'fill="rgba(60,120,220,0.10)" stroke="none"',
  );
  if (!I.rock) {
    D.poly(
      [
        [xl, -deep],
        [xrr, -deep],
        [xrr, 0],
        [xl, 0],
      ],
      'fill="rgba(60,120,220,0.10)" stroke="none"',
    );
  }
  cfBody(D, R as never, { deep, xl, xr: xrr });
  if (W.mode === 'fd' && W.seep) {
    const S = W.seep;
    const dH = W.hB - W.hF;
    for (let k = 1; k < 10; k++) {
      WATER.contourLines(
        S.xc,
        S.yc,
        (i, j) => S.H[i * S.ny + j],
        null,
        W.hF + (dH * k) / 10,
      ).forEach((line) => D.pl(line, 'stroke="#2f6fbf" stroke-width="0.7" opacity="0.8"'));
    }
  }
  const xbk = xAtYPoly(
    [
      [g.xbb, g.yF],
      [g.xbt, g.yT],
    ],
    W.hB,
  );
  const xfk = xAtYPoly(g.front, W.hF);
  D.ln(
    [xbk != null ? Math.max(xbk, g.xbb - 0.4) : g.xbb, W.hB],
    [xrr, W.hB],
    'stroke="#0050b0" stroke-width="1.4" stroke-dasharray="9,3"',
  );
  cxWT(D, xrr - 0.5, W.hB);
  D.ln(
    [xl, W.hF],
    [xfk != null ? xfk : 0, W.hF],
    'stroke="#0050b0" stroke-width="1.4" stroke-dasharray="9,3"',
  );
  cxWT(D, xl + 0.5, W.hF);
  D.ln(g.A, g.T, 'stroke="#c00000" stroke-width="1.1" stroke-dasharray="7,4"');
  D.poly(
    [
      [g.B, W.hB],
      [g.B, 0],
      ...bk.map(([y, u]): Point2D => [g.B + u * ps, y]),
    ],
    cxBlue,
  );
  D.t([g.B + bk[0][1] * ps, 0], cnf(bk[0][1], 1) + ' kPa', { dx: 4, dy: -4, c: 'b', fs: 11 });
  const lb = W.L.find((l) => l.sub === 'back');
  if (lb) {
    D.arTo([g.B, lb.y], [-1, 0], 56, 'b', 2.2);
    D.t([g.B, lb.y], 'Pw,s = ' + cnf(-lb.Fx, 1) + ' kN/m', {
      dx: 62,
      dy: -6,
      c: 'b',
      fs: 11,
      b: true,
    });
  }
  D.poly(
    [
      [0, 0],
      [g.B, 0],
      ...ubs
        .slice()
        .reverse()
        .map(([x, u]): Point2D => [x, -u * ps]),
    ],
    cxBlue,
  );
  D.t([0, -ubs[0][1] * ps], cnf(ubs[0][1], 1) + ' kPa', {
    dx: -4,
    dy: 12,
    a: 'end',
    c: 'b',
    fs: 11,
  });
  D.t([g.B, -ubs[40][1] * ps], cnf(ubs[40][1], 1) + ' kPa', { dx: 4, dy: 12, c: 'b', fs: 11 });
  if (W.U > 1e-9) {
    D.arTo([W.xU, 0], [0, 1], 46, 'b', 2.2);
    D.t([W.xU, 0], 'U = ' + cnf(W.U, 1) + ' kN/m', { dx: 8, dy: 40, c: 'b', fs: 11, b: true });
  }
  let mxF = 0;
  let pF: Point2D | null = null;
  for (let s = 0; s + 1 < g.front.length; s++) {
    const a = g.front[s];
    const b = g.front[s + 1];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 1e-9) continue;
    const nx = -(b[1] - a[1]) / L;
    const ny = (b[0] - a[0]) / L;
    const pts: Array<[number, number, number]> = [];
    for (let k = 0; k <= 12; k++) {
      const t = k / 12;
      const x = a[0] + t * (b[0] - a[0]);
      const y = a[1] + t * (b[1] - a[1]);
      pts.push([x, y, W.u(x, y, 'F')]);
    }
    if (!pts.some((p) => p[2] > 1e-6)) continue;
    D.poly(
      [
        ...pts.map((p): Point2D => [p[0], p[1]]),
        ...pts
          .slice()
          .reverse()
          .map((p): Point2D => [p[0] + nx * p[2] * ps, p[1] + ny * p[2] * ps]),
      ],
      cxBlue,
    );
    pts.forEach((p) => {
      if (p[2] > mxF) {
        mxF = p[2];
        pF = [p[0] + nx * p[2] * ps, p[1] + ny * p[2] * ps];
      }
    });
  }
  if (pF) D.t(pF, cnf(mxF, 1) + ' kPa', { dx: -4, dy: 12, a: 'end', c: 'b', fs: 11 });
  D.dimV(0, W.hB, D.X(xrr) - 16, 'hB = ' + cnf(W.hB, 2));
  D.dimV(0, W.hF, D.X(xl) + 22, 'hF = ' + cnf(W.hF, 2));
  D.t([xrr - 0.5, W.hB], 'mực nước ngầm sau lưng', {
    dx: -12,
    dy: -14,
    a: 'end',
    c: 'b',
    fs: 11,
    i: true,
  });
  D.t([xl + 0.5, W.hF], 'mực nước phía trước', { dx: 12, dy: -14, c: 'b', fs: 11, i: true });
  return D.svg();
}

export function cfSeismic(R: ExtReportResult): string {
  const g = R.g;
  const I = R.I;
  const E = R.E!;
  const eq = R.Ld.eqi!;
  const we = eq.we;
  const top = g.yT + Math.max(0, I.Hs) + 0.7;
  const xl = -3.2;
  const xr = Math.max(g.B + 5.4, we.C ? we.C[0] + 1 : 0);
  const D = cfNew([xl, xr, -0.9, top], 760, 680, 460, 22, 12);
  cfBody(D, R as never, { deep: 0.9, xl, xr });
  D.ln(g.A, g.T, 'stroke="#c00000" stroke-width="1.2" stroke-dasharray="7,4"');
  if (we.C) {
    const G = cfGline(R as never);
    const poly: Point2D[] = [g.A, g.T];
    G.forEach((p) => {
      if (p[0] < we.C![0] - 1e-6 && p[0] > g.T[0] + 1e-6) poly.push(p);
    });
    poly.push(we.C);
    D.poly(poly, 'fill="rgba(138,43,226,0.10)" stroke="none"');
    D.ln(g.A, we.C, 'stroke="#8a2be2" stroke-width="1.5" stroke-dasharray="6,3"');
    D.t(
      [g.A[0] + 0.45 * (we.C[0] - g.A[0]), g.A[1] + 0.45 * (we.C[1] - g.A[1])],
      'mặt trượt ρE = ' + cnf(we.rho, 1) + '°',
      { dx: 10, dy: 12, c: 'm', fs: 11, i: true },
    );
  }
  const Ld = R.Ld;
  const PA = Ld.w0.P;
  const dPE = eq.dPE;
  const Fm = Math.max(PA, eq.dPE, eq.gd ? E.kh * eq.gd.W : 0, eq.ge ? E.kh * eq.ge.W : 0, 1e-6);
  const len = (F: number) => 30 + (90 * F) / Fm;
  const lE = Ld.L.find((l) => l.dyn);
  D.arTo([g.B, g.Hp / 3], [-Ld.w0.dP[0], -Ld.w0.dP[1]], len(PA), 'k', 1.8);
  D.t([g.B, g.Hp / 3], 'PA = ' + cnf(PA, 1) + " kN/m (H'/3)", { dx: len(PA) + 8, dy: 4, fs: 11 });
  if (lE && dPE > 1e-9) {
    D.arTo([g.B, 0.6 * g.Hp], [lE.Fx, lE.Fy], len(dPE), 'r', 2.2);
    D.t([g.B, 0.6 * g.Hp], 'ΔPAE = ' + cnf(dPE, 1) + " kN/m (0,6H')", {
      dx: len(dPE) + 8,
      dy: 4,
      c: 'r',
      fs: 11,
      b: true,
    });
  }
  if (eq.gd) {
    D.dot([eq.gd.x, eq.gd.y], 'k');
    D.arFr([eq.gd.x, eq.gd.y], [-1, 0], len(E.kh * eq.gd.W), 'o', 2.2);
    D.t([eq.gd.x, eq.gd.y], 'kh.Wt = ' + cnf(E.kh * eq.gd.W, 1) + ' kN/m', {
      dx: -len(E.kh * eq.gd.W) - 4,
      dy: -6,
      a: 'end',
      c: 'o',
      fs: 11,
      b: true,
    });
  }
  if (eq.ge) {
    D.dot([eq.ge.x, eq.ge.y], 'k');
    D.arFr([eq.ge.x, eq.ge.y], [-1, 0], len(E.kh * eq.ge.W), 'o', 2.2);
    D.t([eq.ge.x, eq.ge.y], 'kh.Ws = ' + cnf(E.kh * eq.ge.W, 1) + ' kN/m', {
      dx: 10,
      dy: -8,
      c: 'o',
      fs: 11,
      b: true,
    });
  }
  D.t([xl + 0.2, top - 0.3], 'kh = ' + cnf(E.kh, 3) + ' ;  kv = ' + cnf(E.kv, 3), {
    fs: 12,
    b: true,
  });
  D.t(
    [xl + 0.2, top - 0.3],
    'θ = arctan[kh/(1 − kv)] = ' + cnf((Math.atan(E.kh / (1 - E.kv)) * 180) / Math.PI, 2) + '°',
    { dy: 18, fs: 11, i: true },
  );
  return D.svg();
}

export function cfSlope(R: ExtReportResult): string {
  const S = R.slope as SlopeRunResult & { reqLab?: string };
  const g = R.g;
  const I = R.I;
  const M = S.M;
  const Df = S.Df ?? 0;
  const T = S.T ?? 1;
  const xL = S.xL ?? 0;
  const xR = S.xR ?? 0;
  const xc = S.xc ?? 0;
  const yc = S.yc ?? 0;
  const Rr = S.R ?? 0;
  const top = Math.max(yc, g.yT + Math.max(0, I.Hs)) + 0.7;
  const bx: [number, number, number, number] = [
    Math.min(xL, xc, -1.5) - 1,
    Math.max(xR, xc, g.B + 1.5) + 1,
    -(T + 0.7),
    top,
  ];
  const D = cfNew(bx, 760, 680, 560, 22, 12);
  const xA = bx[0];
  const xB = bx[1];
  const yg = (x: number) => M.ground(x);
  const GL: Point2D[] = [[g.xbt, g.yT]];
  if (I.Hs > 1e-9) GL.push([g.xbt + I.m * I.Hs, g.yT + I.Hs]);
  GL.push([xB, GL[GL.length - 1][1]]);
  D.poly(
    [
      [xA, 0],
      [xB, 0],
      [xB, -T],
      [xA, -T],
    ],
    `fill="url(#${D.id}${I.rock ? 'R' : 'S'})" stroke="none"`,
  );
  D.ln([xA, 0], [xB, 0], 'stroke="#8a6d3b" stroke-width="1"');
  D.ln([xA, -T], [xB, -T], 'stroke="#8a6d3b" stroke-width="1" stroke-dasharray="8,4"');
  D.t([xB, -T], 'T = ' + cnf(T, 2) + ' m', { dx: -6, dy: -5, a: 'end', fs: 11, i: true });
  const fillPoly: Point2D[] = ([[g.xbb, 0] as Point2D, [g.B, 0] as Point2D, ...GL.slice(), [xB, 0] as Point2D] as Point2D[]).filter(
    (p, i, a) => i === 0 || p[0] !== a[i - 1][0] || p[1] !== a[i - 1][1],
  );
  D.poly(
    fillPoly,
    `fill="url(#${D.id}S)" stroke="none"`,
  );
  D.gnd(GL);
  if (Df > 1e-9) {
    D.poly(
      [
        [xA, 0],
        [0, 0],
        [0, I.ht],
        [g.xfb, g.yF],
        [g.xfb, Math.max(Df, g.yF)],
        [xA, Df],
      ],
      `fill="url(#${D.id}S)" stroke="none"`,
    );
    D.gnd([
      [xA, Df],
      [g.xfb, Df],
    ]);
  }
  D.poly(g.foot, 'fill="#d9d9d9" stroke="#222" stroke-width="1.4"');
  D.poly(g.stem, 'fill="#d9d9d9" stroke="#222" stroke-width="1.4"');
  if (R.W) {
    D.ln(
      [g.xbb, R.W.hB],
      [xB, R.W.hB],
      'stroke="#0050b0" stroke-width="1.2" stroke-dasharray="9,3"',
    );
    D.ln([xA, R.W.hF], [0, R.W.hF], 'stroke="#0050b0" stroke-width="1.2" stroke-dasharray="9,3"');
  }
  const topAt = (x: number) => {
    let t = -Infinity;
    [g.foot, g.stem].forEach((P) => {
      for (let i = 0; i < P.length; i++) {
        const a = P[i];
        const b = P[(i + 1) % P.length];
        if ((a[0] <= x && b[0] > x) || (b[0] <= x && a[0] > x)) {
          t = Math.max(t, a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]));
        }
      }
    });
    return x < 0
      ? Df
      : x > g.B
        ? yg(x)
        : isFinite(t)
          ? Math.max(t, x < g.xfb ? Df : x > g.xbb ? yg(x) : t)
          : yg(x);
  };
  const arc = (x: number) => yc - Math.sqrt(Math.max(0, Rr * Rr - (x - xc) * (x - xc)));
  const slices = S.slices || [];
  const nS = slices.length || 1;
  const bW = (xR - xL) / nS;
  for (let i = 0; i <= nS; i++) {
    const x = xL + i * bW;
    D.ln([x, arc(x)], [x, topAt(x)], 'stroke="#9a9a9a" stroke-width="0.5"');
  }
  const P: Point2D[] = [];
  for (let i = 0; i <= 80; i++) {
    const x = xL + ((xR - xL) * i) / 80;
    P.push([x, arc(x)]);
  }
  D.pl(P, 'stroke="#c00000" stroke-width="2"');
  D.ln([xc, yc], [xL, arc(xL)], 'stroke="#555" stroke-width="0.8" stroke-dasharray="5,3"');
  D.ln([xc, yc], [xR, arc(xR)], 'stroke="#555" stroke-width="0.8" stroke-dasharray="5,3"');
  D.dot([xc, yc], 'r', 3.6);
  D.t([xc, yc], 'tâm (' + cnf(xc, 2) + ' ; ' + cnf(yc, 2) + ')', {
    dx: 8,
    dy: -6,
    c: 'r',
    fs: 11,
    b: true,
  });
  D.t([(xc + xL) / 2, (yc + arc(xL)) / 2], 'R = ' + cnf(Rr, 2) + ' m', {
    dx: -8,
    a: 'end',
    fs: 11,
    i: true,
  });
  D.dot([xL, arc(xL)], 'k', 2.6);
  D.dot([xR, arc(xR)], 'k', 2.6);
  D.t([xR, arc(xR)], 'x = ' + cnf(xR, 2), { dx: 6, dy: -8, fs: 11 });
  D.t([xL, arc(xL)], 'x = ' + cnf(xL, 2), { dx: -6, dy: -8, a: 'end', fs: 11 });
  D.t(
    [bx[0] + 0.3, top - 0.35],
    'FS = ' +
      cnf(S.FS, 3) +
      (S.ok ? '  ≥  ' : '  <  ') +
      (S.reqLab || '1/φ') +
      ' = ' +
      cnf(S.FSreq, 3),
    { fs: 12, b: true, c: S.ok ? 'g' : 'r' },
  );
  return D.svg();
}

export function calcExtInputs(_P: EngineProject, R: ExtReportResult): string {
  const tf = cnf;
  const I = R.I;
  const W = R.W;
  const E = R.E;
  const S = R.slope;
  let h = '';
  let n = 5;
  if (W) {
    h +=
      sH3(`3.${n++}. Nước ngầm và thấm - TCVN 11823-3, Điều 7.1, 7.2, 11.3`) +
      sTx(
        'Cao độ mực nước đo từ đáy bản đáy. Phía sau tường mực nước ngầm nằm ngang ở cao độ hB, phía trước mũi ở cao độ hF. Đất dưới mực nước ngầm tính với trọng lượng riêng bão hòa γsat; áp lực đất chủ động tính theo ứng suất có hiệu (γ\' = γsat − γw, γw = 9,81 kN/m³) và áp lực nước lỗ rỗng tính riêng (TCVN 11823-3, Điều 11.3).',
      ) +
      sRow(
        'Cao độ mực nước ngầm sau lưng tường',
        'hB',
        tf(W.hBraw, 2),
        'm',
        W.hBraw !== W.hB ? 'lấy ' + tf(W.hB, 2) : '',
      ) +
      sRow(
        'Cao độ mực nước phía trước tường',
        'hF',
        tf(W.hFraw, 2),
        'm',
        W.hFraw !== W.hF ? 'lấy ' + tf(W.hF, 2) : '',
      ) +
      sRow('Trọng lượng riêng bão hòa của đất đắp sau lưng', 'γsat', tf(I.gsat, 2), 'kN/m³') +
      (I.rock ? '' : sRow('Trọng lượng riêng bão hòa của đất nền', 'γsat,n', tf(I.gfs, 2), 'kN/m³')) +
      sRowT(
        'Sơ đồ xác định áp lực nước lỗ rỗng',
        W.mode === 'hs'
          ? 'Thủy tĩnh: cột nước dưới đáy móng giảm tuyến tính từ gót đến mũi'
          : 'Thấm ổn định hai chiều (phương pháp thể tích hữu hạn)',
      ) +
      (W.mode === 'fd'
        ? sRow('Chiều dày lớp đất thấm dưới đáy móng (đáy lớp không thấm)', 'Tn', tf(I.Tn, 2), 'm') +
          sRow(
            'Hệ số thấm đất đắp sau lưng: phương ngang ; phương đứng',
            'Kx ; Ky',
            gsK(I.kbx) + ' ; ' + gsK(I.kby),
            'm/s',
          ) +
          sRow(
            I.rock
              ? 'Hệ số thấm khối đá nền: phương ngang ; phương đứng'
              : 'Hệ số thấm đất nền dưới đáy móng: phương ngang ; phương đứng',
            'Kx ; Ky',
            gsK(I.kfx) + ' ; ' + gsK(I.kfy),
            'm/s',
          )
        : '') +
      (I.rock ? '' : sRow('Hệ số an toàn tối thiểu chống xói ngầm, đẩy trồi', 'FSp', tf(I.FSp, 2), ''));
    W.warn.forEach((t) => {
      h += sTx('Lưu ý: ' + t);
    });
  }
  if (E) {
    h +=
      sH3(`3.${n++}. Động đất - TCVN 11823-3, Điều 10, 11.4 ; TCVN 11823-11, Điều 6.5 và Phụ lục A`) +
      sTx(
        'Tính theo phương pháp giả tĩnh Mononobe-Okabe: áp lực đất chủ động có kể đến gia tốc ngang kh.g và gia tốc đứng kv.g của nền; tường và khối đất trên gót chịu lực quán tính kh.W (hướng ra phía mũi) và kv.W. Nước và tải trọng chất thêm q, qL không kể quán tính.',
      ) +
      sRow('Hệ số gia tốc nền (gia tốc đỉnh đã hiệu chỉnh hệ số nền As)', 'A', tf(E.A, 3), 'g') +
      sRowT(
        'Hệ số động đất ngang kh',
        (
          {
            half: 'Tường cho phép chuyển vị ngang 25 - 50 mm: kh = 0,5A',
            full: 'Tường không cho phép chuyển vị: kh = A',
            tay: 'Nhập trực tiếp',
          } as Record<string, string>
        )[E.km] || '',
      ) +
      sRow('Hệ số động đất ngang ; đứng', 'kh ; kv', tf(E.kh, 3) + ' ; ' + tf(E.kv, 3), '') +
      sRow('Hệ số hoạt tải trong tổ hợp Đặc biệt (TCVN 11823-3, Bảng 3)', 'γEQ', tf(E.gq, 2), '') +
      sRow(
        'Hệ số sức kháng tổ hợp Đặc biệt: kết cấu BTCT ; trượt ; sức kháng đỡ của nền',
        'φ',
        tf(1, 2) + ' ; ' + tf(E.phiS, 2) + ' ; ' + tf(E.phiB, 2),
        '',
      );
  }
  if (S) {
    h +=
      sH3(`3.${n++}. Ổn định tổng thể - TCVN 11823-11, Điều 6.2.3`) +
      sTx(
        'Kiểm tra cung trượt tròn đi qua nền dưới đáy bản đáy, cắt qua đất đắp phía sau và thoát lên mặt đất phía trước mũi. Khối tường (bản đáy, tường đứng) là vật thể cứng; tải trọng lấy ở trạng thái sử dụng (hệ số 1,0).',
      ) +
      sRow('Bề dày lớp nền được xét trong cung trượt (tính từ đáy bản đáy)', 'T', tf(I.bsT, 2), 'm') +
      sRow('Hệ số sức kháng ổn định tổng thể (TCVN 11823-11, Điều 6.2.3)', 'φ', tf(I.bsPhiR, 2), '') +
      sRow('Hệ số an toàn tối thiểu tương đương', 'FSmin = 1/φ', tf(1 / I.bsPhiR, 3), '');
  }
  return h;
}

export function calcExtLoads(_P: EngineProject, R: ExtReportResult): { h: string; n: number } {
  const tf = cnf;
  const I = R.I;
  const g = R.g;
  const W = R.W;
  const E = R.E;
  const Ld = R.Ld;
  let h = '';
  let n = 4;
  const row = (l: { nm?: string; Fy: number; Fx: number; x: number; y: number }) => [
    l.nm || '',
    tf(-l.Fy, 2),
    tf(-l.Fx, 2),
    tf(l.x, 3),
    tf(l.y, 3),
  ];
  if (W) {
    h +=
      sH3(`4.${n++}. Áp lực nước và đẩy ngược (WA) - TCVN 11823-3, Điều 7.1, 7.2`) +
      sTx(
        W.mode === 'hs'
          ? 'Áp lực nước lỗ rỗng thủy tĩnh u = γw.(h − y): sau lưng h = hB, phía trước h = hF; dưới đáy móng cột nước h(x) giảm tuyến tính từ hB tại mép gót đến hF tại mép mũi.'
          : 'Cột nước h(x, y) lấy từ lời giải thấm ổn định hai chiều (phương trình Laplace, tường và bản đáy không thấm, mực nước sau lưng hB và phía trước hF là biên cột nước không đổi); áp lực nước lỗ rỗng u = γw.(h − y). Các lực nước đều là tích phân của u trên biên của khối tính (tường + khối đất trên gót).',
      ) +
      sF(
        String.raw`u = \gamma_w\,(h - y)\ ;\quad U = \int_0^B u(x)\,dx\ ;\quad P_{w,s} = \int u\,dy\quad (\text{TCVN 11823-3, Điều 7.1, 7.2})`,
      ) +
      sTab(['Thành phần', 'V (kN)', 'H (kN)', 'x (m)', 'y (m)'], W.L.map(row)) +
      sTx(
        `Đẩy ngược: U = ${tf(W.U, 2)} kN tại x = ${tf(W.xU, 3)} m (kể từ mép mũi), trừ vào trọng lượng khi tính lực thẳng đứng. Đất đắp trên gót tính trọng lượng toàn phần (γ phía trên mực nước, γsat phía dưới); áp lực đất chủ động tính với γ' = ${tf(Math.max(1, I.gsat - WATER.GW), 2)} kN/m³ dưới mực nước ngầm (mục 4.2). Hệ số tải trọng của WA bằng 1,0 (TCVN 11823-3, Bảng 4).`,
      ) +
      sFig(
        cfWater(R),
        'Mực nước ngầm, áp lực nước lên tường và đẩy ngược dưới đáy bản đáy' +
          (W.mode === 'fd' ? ' (đường đồng cột nước cách nhau ΔH/10)' : ''),
      );
  }
  if (E && Ld.eqi) {
    const eq = Ld.eqi;
    const we = eq.we;
    const th = (Math.atan(E.kh / (1 - E.kv)) * 180) / Math.PI;
    h +=
      sH3(`4.${n++}. Tải trọng động đất (EQ) - phương pháp giả tĩnh Mononobe-Okabe`) +
      sTx(
        `Gia tăng áp lực đất chủ động do động đất ΔPAE = PAE − PA, trong đó PAE là lực đẩy chủ động lớn nhất của nêm trượt chịu thêm lực quán tính ngang kh.Ws và đứng kv.Ws của khối đất trong nêm (hệ số KAE của Mononobe-Okabe, tính bằng nêm thử cùng giả thiết và cùng mặt phẳng AT như PA); ΔPAE đặt cách đáy bản đáy 0,6H' (TCVN 11823-11, Phụ lục A). Lực quán tính của tường (kể cả sườn) và của khối đất trên gót đặt tại trọng tâm, hướng ra phía mũi.`,
      ) +
      sF(
        String.raw`\theta_{MO} = \arctan\dfrac{k_h}{1 - k_v}\ ;\quad K_{AE} = \dfrac{2\,P_{AE}}{\gamma_s H'^2}\ ;\quad \Delta P_{AE} = P_{AE} - P_A\ ;\quad F_i = k_h\,W`,
      ) +
      sTab(
        ['Đại lượng', 'Ký hiệu', 'Giá trị', 'Đơn vị'],
        [
          ['Hệ số gia tốc nền', 'A', tf(E.A, 3), 'g'],
          ['Hệ số động đất ngang ; đứng', 'kh ; kv', tf(E.kh, 3) + ' ; ' + tf(E.kv, 3), ''],
          ['Góc quán tính', 'θMO', tf(th, 2), 'độ'],
          ['Lực đẩy chủ động tĩnh', 'PA', tf(Ld.w0.P, 2), 'kN'],
          [
            'Lực đẩy chủ động khi có động đất ; góc mặt trượt',
            'PAE ; ρE',
            tf(we.P, 2) + ' ; ' + tf(we.rho, 1),
            'kN ; độ',
          ],
          ['Hệ số áp lực đất khi có động đất', 'KAE', tf((2 * we.P) / (I.gs * g.Hp * g.Hp), 4), ''],
          [
            'Gia tăng áp lực đất do động đất ; điểm đặt cách đáy',
            "ΔPAE ; 0,6H'",
            tf(eq.dPE, 2) + ' ; ' + tf(0.6 * g.Hp, 3),
            'kN ; m',
          ],
          ...(eq.gd
            ? [
                [
                  'Trọng lượng tường ; lực quán tính ngang kh.W',
                  'Wt ; kh.Wt',
                  tf(eq.gd.W, 2) + ' ; ' + tf(E.kh * eq.gd.W, 2),
                  'kN',
                ],
              ]
            : []),
          ...(eq.ge
            ? [
                [
                  'Trọng lượng đất trên gót ; lực quán tính ngang kh.W',
                  'Ws ; kh.Ws',
                  tf(eq.ge.W, 2) + ' ; ' + tf(E.kh * eq.ge.W, 2),
                  'kN',
                ],
              ]
            : []),
        ],
      ) +
      sTx(
        'Tổ hợp Đặc biệt I (động đất) xét theo Bảng 3 (mục 5): không đồng thời với hoạt tải xe; hoạt tải chất thêm lấy hệ số γEQ. Áp lực nước động (nếu có) chưa kể - tường chắn đất không tiếp xúc nước mặt.',
      ) +
      sFig(
        cfSeismic(R),
        'Sơ đồ lực động đất giả tĩnh: lực quán tính của tường, của khối đất trên gót và gia tăng áp lực đất ΔPAE',
      );
  }
  return { h, n };
}

export function calcExtChecks(
  _P: EngineProject,
  R: ExtReportResult,
  sec: number,
): { h: string; sec: number } {
  const tf = cnf;
  const I = R.I;
  const W = R.W;
  const S = R.slope;
  let h = '';
  if (W && W.pip) {
    const p = W.pip;
    h += sH2(
      `${sec}.&nbsp;&nbsp;KIỂM TRA XÓI NGẦM VÀ ĐẨY TRỒI PHÍA TRƯỚC MŨI - TCVN 11823-11, ĐIỀU 6.3.4`,
    );
    if (p.kind === 'rock') {
      h += sTx(
        'Nền đá: không xét xói ngầm của đất nền. Nước thấm qua khe nứt, mặt tiếp xúc bê tông - đá và lớp đất đắp được thu về hệ thống thoát nước sau lưng tường (lớp lọc, ống thoát nước); tải trọng nước và đẩy ngược đã kể ở mục 4.',
      );
    } else if (p.kind === 'none') {
      h += sTx(
        'Mực nước hai phía bằng nhau (hB = hF): không có chênh cột nước, không có dòng thấm - không xét xói ngầm.',
      );
    } else if (p.kind === 'prism') {
      h +=
        sTx(
          `Dòng thấm từ phía sau đi dưới đáy móng rồi thoát lên phía trước mũi. Kiểm tra theo Terzaghi: lăng trụ đất sát mũi rộng D/2, cao D (D = chiều sâu chôn móng ${tf(p.D, 2)} m) không bị đẩy trồi: trọng lượng có hiệu W' của lăng trụ phải lớn hơn áp lực nước thấm U do cột nước dư trung bình Δh.`,
        ) +
        sF(
          String.raw`FS = \dfrac{W'}{U}\ ;\quad W' = \sigma'_v\,\dfrac{D}{2}\ ;\quad U = \gamma_w\,\Delta h\,\dfrac{D}{2}\ \ge FS_p`,
        ) +
        sRow('Cột nước dư trung bình trên đáy lăng trụ', 'Δh', tf(p.dh, 3), 'm') +
        sRow('Ứng suất có hiệu thẳng đứng ở đáy lăng trụ', "σ'v", tf(p.sv, 2), 'kPa') +
        sRow('Trọng lượng có hiệu của lăng trụ', "W'", tf(p.Wp, 2), 'kN/m') +
        sRow('Áp lực nước thấm đẩy lên lăng trụ', 'U', tf(p.Uex, 2), 'kN/m') +
        sRow(
          'Gradien thủy lực trung bình ; lớn nhất thoát ra mặt đất sát mũi (tham khảo)',
          'itb ; imax',
          tf(p.iavg, 3) + ' ; ' + tf(p.imax, 3),
          '',
        ) +
        sRow("Gradien tới hạn icr = γ'/γw", 'icr', tf(p.icr, 3), '') +
        sRow(
          'Hệ số an toàn ; yêu cầu',
          'FS ; FSp',
          tf(p.FS, 2) + ' ; ' + tf(p.FSreq, 2),
          '',
          sOk(p.ok),
        );
    } else {
      h +=
        sTx(
          'Sơ đồ thủy tĩnh: đánh giá gradien thủy lực trung bình theo đường thấm dưới đáy móng (đường thấm Lc = B, cộng 2 lần chiều sâu chân khay nếu có) so với gradien tới hạn của đất.',
        ) +
        sF(
          String.raw`i_{tb} = \dfrac{\Delta H}{L_c}\ ;\quad i_{cr} = \dfrac{\gamma'}{\gamma_w}\ ;\quad FS = \dfrac{i_{cr}}{i_{tb}} \ge FS_p`,
        ) +
        sRow('Chênh cột nước ; chiều dài đường thấm', 'ΔH ; Lc', tf(p.dH, 3) + ' ; ' + tf(p.Lc, 3), 'm') +
        sRow('Gradien thủy lực trung bình', 'itb', tf(p.iavg, 4), '') +
        sRow("Gradien tới hạn của đất nền icr = γ'/γw", 'icr', tf(p.icr, 3), '') +
        sRow(
          'Hệ số an toàn ; yêu cầu',
          'FS ; FSp',
          tf(p.FS, 2) + ' ; ' + tf(p.FSreq, 2),
          '',
          sOk(p.ok),
        );
    }
    if (p.kind !== 'rock' && p.kind !== 'none') {
      h += sKL(
        p.ok,
        'Không xảy ra xói ngầm, đẩy trồi phía trước mũi.',
        'Có nguy cơ xói ngầm, đẩy trồi phía trước mũi - cần tăng chiều sâu chôn móng, làm chân khay, tầng lọc hoặc hạ mực nước.',
      );
    }
    sec++;
  }
  if (S) {
    h +=
      sH2(
        `${sec}.&nbsp;&nbsp;KIỂM TOÁN ỔN ĐỊNH TỔNG THỂ - CUNG TRƯỢT TRÒN (BISHOP) - TCVN 11823-11, ĐIỀU 6.2.3`,
      ) +
      sTx(
        'Khối đất phía trên cung trượt chia thành các thớ thẳng đứng. Hệ số an toàn FS tính theo phương pháp Bishop đơn giản hóa, lặp trên FS; cung nguy hiểm nhất tìm bằng lưới tâm (xc, yc) và cao độ đáy cung, sau đó tinh chỉnh cục bộ. Cung phải đi dưới đáy bản đáy (cả hai đầu mút bản đáy), vào mặt đất đắp phía sau và thoát lên mặt đất phía trước mũi. Ổn định đạt khi φ.(sức kháng) ≥ (lực gây trượt), tức FS ≥ 1/φ.',
      ) +
      sF(
        String.raw`FS = \dfrac{\sum \dfrac{c'\,b + (W - u\,b)\tan\phi'}{m_\alpha}}{\sum W \sin\alpha}\ ;\quad m_\alpha = \cos\alpha\left(1 + \dfrac{\tan\alpha\,\tan\phi'}{FS}\right)`,
      );
    const bk = S.M.bkf;
    const fn = S.M.fnd;
    h += sTab(
      ['Vùng', 'Lực dính c (kPa)', 'Góc ma sát φ (độ)', 'γ (kN/m³)', 'γsat (kN/m³)'],
      [
        ['Đất đắp sau lưng', tf(bk.c, 1), tf(bk.phi, 1), tf(bk.g, 2), tf(bk.gs, 2)],
        [
          I.rock ? 'Khối đá nền' : fn.total ? 'Đất nền dính (Su, φ = 0)' : 'Đất nền',
          tf(fn.c, 1),
          tf(fn.phi, 1),
          tf(fn.g, 2),
          tf(fn.gs, 2),
        ],
      ],
    );
    if (S.none || !S.slices) {
      h +=
        sTx(
          'Không tìm được cung trượt hợp lệ trong miền khảo sát: kiểm tra lại bề dày lớp nền T và số liệu địa chất.',
        ) + sKL(false, '', 'Không xác định được cung trượt - cần xem lại số liệu.');
    } else {
      h +=
        sFig(cfSlope(R), 'Cung trượt nguy hiểm nhất và các thớ chia (phương pháp Bishop)') +
        sRow(
          'Tâm cung trượt (hệ tọa độ O ở mép mũi, đáy bản đáy)',
          'xc ; yc',
          tf(S.xc, 3) + ' ; ' + tf(S.yc, 3),
          'm',
        ) +
        sRow('Bán kính ; cao độ đáy cung', 'R ; ymin', tf(S.R, 3) + ' ; ' + tf(S.ylow, 3), 'm') +
        sRow(
          'Điểm thoát phía trước mũi ; điểm vào trên mặt đất đắp',
          'xL ; xR',
          tf(S.xL, 3) + ' ; ' + tf(S.xR, 3),
          'm',
        ) +
        sRow(
          'Tổng trọng lượng khối trượt ; tổng lực gây trượt',
          'ΣW ; ΣW.sinα',
          tf(S.sumW, 1) + ' ; ' + tf(S.drive, 1),
          'kN/m',
        ) +
        sRow(
          'Hệ số an toàn nhỏ nhất ; yêu cầu FS ≥ 1/φ',
          'FS ; FSmin',
          tf(S.FS, 3) + ' ; ' + tf(S.FSreq, 3),
          '',
          sOk(S.ok),
        ) +
        sTx(
          'Chưa kể sức kháng của sườn tăng cường (nếu có) và của neo/chốt - thiên về an toàn.' +
            (R.W
              ? R.W.seep
                ? ' Áp lực nước lỗ rỗng u lấy tại đáy từng thớ theo lời giải thấm ổn định hai chiều (u = γw.(h − y)), cùng trường cột nước đã dùng cho lực đẩy ngược.'
                : ' Áp lực nước lỗ rỗng u lấy theo sơ đồ thủy tĩnh với mực nước ngầm nội suy giữa hF và hB.'
              : ''),
        ) +
        sKL(
          S.ok,
          'Ổn định tổng thể ĐẠT YÊU CẦU.',
          'Ổn định tổng thể KHÔNG ĐẠT - cần mở rộng bản đáy, đào sâu đáy móng, gia cố nền hoặc giảm tải phía sau tường.',
        );
    }
    sec++;
  }
  return { h, sec };
}

export function calcExtSum(R: ExtReportResult): Array<[string, string, boolean | string]> {
  const rows: Array<[string, string, boolean | string]> = [];
  if (R.W && R.W.pip && R.W.pip.kind !== 'none' && R.W.pip.kind !== 'rock') {
    rows.push(['Xói ngầm, đẩy trồi phía trước mũi', 'TCVN 11823-11, Điều 6.3.4', Boolean(R.ok.pip)]);
  }
  if (R.slope) {
    rows.push(['Ổn định tổng thể (cung trượt tròn Bishop)', 'TCVN 11823-11, Điều 6.2.3', !!R.ok.slope]);
  }
  const feExt = R.fe as (NonNullable<ExtReportResult['fe']> & { secNo?: number }) | undefined;
  if (feExt && !feExt.err && feExt.secNo) {
    rows.push([
      'Mô hình phần tử hữu hạn tấm 3D: ' + ((R as RibCalcResult).rg ? 'thân, bản đáy, sườn' : 'thân, bản đáy'),
      'Mục ' +
        feExt.secNo +
        (feExt.basis === 'fe' ? '' : ' (đối chiếu, không tính vào kết luận chung)'),
      feExt.basis === 'fe' ? !!feExt.ok : `Hệ số sử dụng ${cnf(feExt.util, 3)}`,
    ]);
  }
  const state = getReportState();
  if (state.femSecNo) {
    rows.push([
      'Phân tích phần tử hữu hạn 2D đất - tường (đất Mohr-Coulomb)',
      'Mục ' + state.femSecNo + ' (tham khảo, không tính vào kết luận chung)',
      'Tham khảo',
    ]);
  }
  if (state.gsSecNo) {
    rows.push([
      'Phân tích ổn định tổng thể (hệ số an toàn trượt, lật, cung trượt, giảm cường độ)',
      'Mục ' + state.gsSecNo + ' (tham khảo, không tính vào kết luận chung)',
      'Tham khảo',
    ]);
  }
  return rows;
}
