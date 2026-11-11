import { ancBarOf } from '../cad/layers';
import { CALC } from '../engine';
import type {
  BarsResult,
  BarSpec,
  CalcGlobalComboResult,
  CalcRunCantileverResult,
  CalcRunRibbedResult,
  Point2D,
  Project,
} from '../types/project';
import {
  CF_CL,
  cfBody,
  cfBox,
  cfGBox,
  cfNew,
  cfPlace,
  cfW,
  cdLab,
  cnf,
  type CFigLabel,
  type CFigLabelOpts,
} from './cfig';

type ReportCalcResult = CalcRunCantileverResult | CalcRunRibbedResult;

interface LoadRecord {
  ty: string;
  nm: string;
  Fx: number;
  Fy: number;
  x: number;
  y: number;
}

interface ExtStemLike {
  Hs: number;
  w: { F: Point2D };
}

interface AnchorRowLike {
  x: number;
}

export function cfSection(R: ReportCalcResult): string {
  const g = R.g as ReportCalcResult['g'] & { C0: Point2D };
  const I = R.I;
  const bx = cfGBox(R, 0.6);
  const yk = Math.min(...g.foot.map((p) => p[1]));
  bx[2] -= 0.55;
  const D = cfNew(bx, 760, 600, 540, 34, 12);
  cfBody(D, R, { deep: R.an ? I.aLr + 0.4 : 0.8 });
  const rg = (R as CalcRunRibbedResult).rg as
    | { tri: Point2D[]; cx: number; cy: number }
    | undefined;
  if (rg) {
    D.poly(
      rg.tri,
      'fill="rgba(0,80,176,0.14)" stroke="#0050b0" stroke-width="1.3" stroke-dasharray="6,3"',
    );
    D.t([rg.cx, rg.cy], 'sườn', { a: 'middle', c: 'b', fs: 11, i: true });
  }
  D.ln(g.A, g.T, 'stroke="#c00000" stroke-width="1.2" stroke-dasharray="7,4"');
  D.t(g.A, 'A', { dx: 6, dy: 14, b: true, c: 'r' });
  D.t(g.T, 'T', { dx: 6, dy: -6, b: true, c: 'r' });
  D.dot([0, 0]);
  D.t([0, 0], 'O', { dx: -14, dy: 14, b: true });
  D.dot(g.C0, 'b');
  D.t(g.C0, 'C', { dx: -4, dy: 16, b: true, c: 'b' });
  const an = R.an as { rows: AnchorRowLike[] } | null;
  if (an) {
    an.rows.forEach((r) =>
      D.ln(
        [r.x, Math.min(I.aLc, g.yF - 0.05)],
        [r.x, -I.aLr],
        'stroke="#c06000" stroke-width="2.2"',
      ),
    );
  }
  const Y0 = D.Y(yk) + 20;
  const Y1 = Y0 + 22;
  const g0 = g as unknown as {
    xfb: number;
    xbb: number;
    xft: number;
    xbt: number;
    tb: number;
    B: number;
    yF: number;
    yT: number;
    Hp: number;
  };
  D.dimH(0, g0.xfb, Y0, 'b1 = ' + cnf((I as unknown as { b1: number }).b1), [0, 0]);
  D.dimH(g0.xfb, g0.xbb, Y0, 'tb = ' + cnf(g0.tb), [g0.yF, g0.yF]);
  D.dimH(g0.xbb, g0.B, Y0, 'b4 = ' + cnf((I as unknown as { b4: number }).b4), [0, 0]);
  D.dimH(0, g0.B, Y1, 'B = ' + cnf(g0.B), [0, 0]);
  D.dimH(
    g0.xft,
    g0.xft + (I as unknown as { t: number }).t,
    D.Y(g0.yT) - 14,
    't = ' + cnf((I as unknown as { t: number }).t),
    [g0.yT, g0.yT],
  );
  const XL = D.X(0) - 30;
  D.dimV(0, g0.yF, XL, 'hm = ' + cnf(g0.yF), [0, 0]);
  D.dimV(g0.yF, g0.yT, XL, 'H = ' + cnf(g0.yT - g0.yF), [g0.xfb, g0.xft]);
  D.dimV(0, g0.Hp, D.X(g0.B) + 28, "H' = " + cnf(g0.Hp, 3), [g0.B, g0.B]);
  if (I.ht < g0.yF - 1e-9) {
    D.t([0, I.ht], 'ht = ' + cnf(I.ht), { dx: -8, dy: -6, a: 'end', fs: 11 });
  }
  const hh = (I as unknown as { hh: number }).hh;
  if (hh < g0.yF - 1e-9) {
    D.t([g0.B, hh], 'hh = ' + cnf(hh), { dx: 8, dy: -6, fs: 11 });
  }
  if (I.Hs > 1e-9 && I.m > 1e-9) {
    D.t([g0.xbt + (I.m * I.Hs) / 2, g0.yT + I.Hs / 2], '1 : ' + cnf(I.m), {
      dx: -10,
      dy: -8,
      a: 'end',
      fs: 11,
      i: true,
    });
  }
  if (an && an.rows.length > 0) {
    D.t([an.rows[0].x, -I.aLr / 2], `neo Φ${cnf(I.ad, 0)}, Lr = ${cnf(I.aLr)} m`, {
      dx: 8,
      fs: 11,
      c: 'o',
    });
  }
  return D.svg();
}

export function cfWeights(R: ReportCalcResult): string {
  const g = R.g;
  const D = cfNew(cfGBox(R, 0.4), 760, 560, 400, 12, 12);
  D.poly(g.foot, 'fill="#e8e8e8" stroke="#222"');
  D.poly(g.stem, 'fill="#e8e8e8" stroke="#222"');
  D.poly(g.ev, 'fill="#f3ead8" stroke="#8a6d3b" stroke-dasharray="5,3"');
  const rg = (R as CalcRunRibbedResult).rg as
    | { tri: Point2D[]; E: Point2D; T: Point2D; yb: number }
    | undefined;
  if (rg) D.poly(rg.tri, 'fill="rgba(0,80,176,0.12)" stroke="#0050b0" stroke-dasharray="6,3"');
  const loads = R.Ld.L as LoadRecord[];
  loads
    .filter((l) => l.ty === 'DC' || l.ty === 'EV')
    .forEach((l, i) =>
      D.num(
        [
          l.x + (rg && /^Đất bị sườn/.test(l.nm) ? 0.1 * (rg.E[0] - rg.T[0]) : 0),
          l.y - (rg && /^Đất bị sườn/.test(l.nm) ? 0.08 * (rg.T[1] - rg.yb) : 0),
        ],
        String(i + 1),
        l.ty === 'EV' ? 'o' : 'k',
      ),
    );
  D.ln(g.A, g.T, 'stroke="#c00000" stroke-dasharray="7,4"');
  return D.svg();
}

export function cfPressure(R: CalcRunCantileverResult): string {
  const g = R.g;
  const I = R.I;
  const Ld = R.Ld as unknown as { w0: { F: Point2D }; PLS: number };
  const st = R.st as unknown as ExtStemLike;
  const yk = Math.min(...g.foot.map((p) => p[1]));
  const D = cfNew(
    [-0.6, g.B + 2.6, yk - 0.3, g.yT + 0.5 + Math.max(0, I.Hs)],
    760,
    640,
    440,
    22,
    12,
  );
  D.poly(g.foot, 'fill="#e8e8e8" stroke="#222"');
  D.poly(g.stem, 'fill="#e8e8e8" stroke="#222"');
  D.ln(g.A, g.T, 'stroke="#c00000" stroke-dasharray="7,4"');
  const Hp = g.Hp;
  const ph = (-Ld.w0.F[0] * 2) / Hp;
  const sc = 1.6 / Math.max(ph, 1e-6);
  D.poly(
    [
      [g.B, Hp],
      [g.B, 0],
      [g.B + ph * sc, 0],
    ],
    'fill="rgba(192,0,0,0.12)" stroke="#c00000"',
  );
  D.t([g.B + ph * sc, 0], cnf(ph, 1) + ' kPa', { dx: 4, dy: -4, c: 'r', fs: 11 });
  D.arTo([g.B, Hp / 3], [-1, 0], 60, 'r');
  D.t([g.B + 0.2, Hp / 3], 'Pa,h = ' + cnf(-Ld.w0.F[0]), { dx: 8, dy: -6, c: 'r', fs: 11 });
  if (Ld.PLS > 0) {
    const pl = Ld.PLS / Hp;
    const x0 = g.B + ph * sc + 0.15;
    D.poly(
      [
        [x0, Hp],
        [x0, 0],
        [x0 + pl * sc, 0],
        [x0 + pl * sc, Hp],
      ],
      'fill="rgba(0,80,176,0.10)" stroke="#0050b0"',
    );
    D.t([x0 + pl * sc, Hp / 2], 'LS: ' + cnf(pl, 2) + ' kPa', { dx: 4, c: 'b', fs: 11 });
  }
  const ps = (-st.w.F[0] * 2) / st.Hs;
  const s2 = 1 / Math.max(ps, 1e-6);
  const xb = g.xbb;
  const yb = g.yF;
  D.poly(
    [
      [g.xbt, g.yT],
      [xb, yb],
      [xb + ps * s2, yb],
    ],
    'fill="rgba(138,43,226,0.10)" stroke="#8a2be2"',
  );
  D.t([xb + ps * s2, yb], cnf(ps, 1) + ' kPa', { dx: 4, dy: -6, c: 'm', fs: 11 });
  D.t([g.xbb + 0.15, yb + st.Hs * 0.75], 'áp lực trên lưng tường đứng', {
    c: 'm',
    fs: 11,
    i: true,
  });
  D.t(g.T, 'mặt phẳng AT', { dx: 6, dy: -6, c: 'r', fs: 11, i: true });
  return D.svg();
}

export function cfBase(R: ReportCalcResult): string {
  const g = R.g;
  const S: CalcGlobalComboResult[] = R.C.filter((c) => !c.sd);
  const D = cfNew(
    [-0.7, g.B + 1.1, -(0.25 + 1.2 * S.length + 0.35), g.yF + 0.15],
    760,
    640,
    300,
    10,
    10,
  );
  D.rp(
    D.X(0),
    D.Y(g.yF),
    D.X(g.B) - D.X(0),
    D.Y(0) - D.Y(g.yF),
    'fill="#e8e8e8" stroke="#222"',
  );
  const qm = Math.max(...S.map((c) => CALC.press(c.N, c.s, g.B).qmax), 1);
  const sc = 1 / qm;
  const cols = ['r', 'b', 'g', 'o', 'm', 'k'] as const;
  const fills: Record<(typeof cols)[number], string> = {
    r: 'rgba(192,0,0,0.12)',
    b: 'rgba(0,80,176,0.12)',
    g: 'rgba(27,122,42,0.12)',
    o: 'rgba(192,96,0,0.12)',
    m: 'rgba(138,43,226,0.12)',
    k: 'rgba(0,0,0,0.08)',
  };
  S.forEach((c, k) => {
    const p = CALC.press(c.N, c.s, g.B);
    const y0 = -0.15 - k * 1.2;
    const P: Point2D[] = [];
    for (let i = 0; i <= 40; i++) {
      const x = (g.B * i) / 40;
      P.push([x, y0 - p.q(x) * sc]);
    }
    const cc = cols[k % 6];
    D.poly([[0, y0], ...P, [g.B, y0]], `fill="${fills[cc]}" stroke="${CF_CL[cc]}"`);
    D.t([0, y0 - p.q1 * sc], cnf(p.q1, 1), { dx: -4, a: 'end', fs: 11, c: cc });
    D.t([g.B, y0 - p.q2 * sc], cnf(p.q2, 1), { dx: 4, fs: 11, c: cc });
    D.t([g.B, y0 - 0.55], cdLab(c) + ' (kPa)', { dx: 12, fs: 11, b: true, c: cc });
  });
  return D.svg();
}

export function cfAnchor(R: ReportCalcResult): string {
  const an = R.an as { rows: AnchorRowLike[] } | null;
  if (!an) return '';
  const g = R.g;
  const I = R.I;
  const D = cfNew([-0.5, g.B + 0.5, -I.aLr - 0.5, g.yF + 0.5], 760, 640, 320, 22, 12);
  D.poly(
    [
      [-0.5, 0],
      [g.B + 0.5, 0],
      [g.B + 0.5, -I.aLr - 0.5],
      [-0.5, -I.aLr - 0.5],
    ],
    `fill="url(#${D.id}R)" stroke="none"`,
  );
  D.ln([-0.5, 0], [g.B + 0.5, 0], 'stroke="#8a6d3b"');
  D.poly(g.foot, 'fill="#e0e0e0" stroke="#222" stroke-width="1.3"');
  an.rows.forEach((r, i) => {
    const hw = I.aDh / 2e3;
    D.poly(
      [
        [r.x - hw, 0],
        [r.x + hw, 0],
        [r.x + hw, -I.aLr],
        [r.x - hw, -I.aLr],
      ],
      'fill="#bdbdbd" stroke="#666"',
    );
    D.ln(
      [r.x, I.aLc > 0 ? Math.min(I.aLc, g.yF - 0.05) : 0],
      [r.x, -I.aLr],
      'stroke="#c06000" stroke-width="2.4"',
    );
    D.dimH(0, r.x, D.Y(g.yF) - 14 - 16 * i, 'x = ' + cnf(r.x), [g.yF, g.yF], { fs: 10 });
  });
  const r0 = an.rows[0];
  D.dimV(-I.aLr, 0, D.X(r0.x) - 34, 'Lr = ' + cnf(I.aLr), [r0.x, r0.x], { fs: 10 });
  D.dimV(0, Math.min(I.aLc, g.yF), D.X(r0.x) + 30, 'La = ' + cnf(I.aLc), [r0.x, r0.x], {
    fs: 10,
  });
  D.t([r0.x, -I.aLr / 2], `Φ${cnf(I.ad, 0)} trong lỗ khoan D${cnf(I.aDh, 0)}`, {
    dx: 12,
    fs: 11,
    c: 'o',
  });
  return D.svg();
}

export function cfRC(R: ReportCalcResult): string {
  const g = R.g;
  const I = R.I as ReportCalcResult['I'] & {
    hh: number;
    sbd: number;
    sbs: number;
    sfd: number;
    sfs: number;
    ftd: number;
    fts: number;
    fbd: number;
    fbs: number;
  };
  const yk = Math.min(...g.foot.map((p) => p[1]));
  const D = cfNew([-0.5, g.B + 0.5, Math.min(yk, 0) - 0.45, g.yT + 0.3], 760, 600, 520, 14, 14);
  D.poly(g.foot, 'fill="#efefef" stroke="#222"');
  D.poly(g.stem, 'fill="#efefef" stroke="#222"');
  const c = I.cov / 1e3;
  const cb = I.covB / 1e3;
  const ct = (I.covT != null ? I.covT : I.cov) / 1e3;
  D.pl(
    [
      [g.xbb - c, g.yT - c],
      [g.xbb - c, cb + 0.03],
      [g.B - c, cb + 0.03],
    ],
    'stroke="#c00000" stroke-width="1.6"',
  );
  D.pl(
    [
      [g.xft + c, g.yT - c],
      [g.xfb + c, cb + 0.03],
      [c, cb + 0.03],
    ],
    'stroke="#0050b0" stroke-width="1.4"',
  );
  D.pl(
    [
      [c, cb],
      [g.B - c, cb],
    ],
    'stroke="#0050b0" stroke-width="1.6"',
  );
  D.pl(
    [
      [c, I.ht - ct],
      [g.xfb, g.yF - ct],
      [g.xbb, g.yF - ct],
      [g.B - c, I.hh - ct],
    ],
    'stroke="#c00000" stroke-width="1.6"',
  );
  const cut = (a: Point2D, b: Point2D, t: string) => {
    D.ln(a, b, 'stroke="#1b7a2a" stroke-width="1.2" stroke-dasharray="8,3,2,3"');
    D.t(a, t, { dx: -6, dy: 4, a: 'end', b: true, c: 'g' });
    D.t(b, t, { dx: 6, dy: 4, b: true, c: 'g' });
  };
  cut([g.xfb - 0.25, g.yF], [g.xbb + 0.25, g.yF], '1');
  cut([g.xfb, -0.25], [g.xfb, g.yF + 0.25], '2');
  cut([g.xbb, -0.25], [g.xbb, g.yF + 0.25], '3');
  D.t([g.xbb, g.yF + (g.yT - g.yF) * 0.55], `Φ${cnf(I.sbd, 0)} a ${cnf(I.sbs, 0)}`, {
    dx: 8,
    c: 'r',
    fs: 11,
  });
  D.t([g.xfb, g.yF + (g.yT - g.yF) * 0.55], `Φ${cnf(I.sfd, 0)} a ${cnf(I.sfs, 0)}`, {
    dx: -8,
    a: 'end',
    c: 'b',
    fs: 11,
  });
  D.t([(g.xbb + g.B) / 2, g.yF], `Φ${cnf(I.ftd, 0)} a ${cnf(I.fts, 0)}`, {
    dy: -8,
    a: 'middle',
    c: 'r',
    fs: 11,
  });
  D.t([g.xfb / 2, 0], `Φ${cnf(I.fbd, 0)} a ${cnf(I.fbs, 0)}`, {
    dy: 16,
    a: 'middle',
    c: 'b',
    fs: 11,
  });
  return D.svg();
}

const CF_LDN: Array<[RegExp, string, string]> = [
  [/^Tường đứng/, 'W tường', 'k'],
  [/^Bản đáy/, 'W móng', 'k'],
  [/^Sườn tăng cường/, 'W sườn', 'k'],
  [/^Đất bị sườn/, 'ΔW đất (sườn chiếm chỗ)', 'o'],
  [/^Đất đắp trên gót.*trên mực/, 'W đất (trên MNN)', 'o'],
  [/^Đất đắp trên gót.*dưới mực/, 'W đất (dưới MNN)', 'o'],
  [/^Đất đắp/, 'W đất', 'o'],
  [/^Áp lực đất chủ động/, 'Ea', 'r'],
  [/^Tải chất thêm q - áp lực ngang/, 'Eaq', 'r'],
  [/^Hoạt tải phân bố qL - thành phần ngang/, 'EqL', 'r'],
  [/^Hoạt tải chất thêm LS - thành phần ngang/, 'PLS', 'r'],
  [/^Áp lực nước sau lưng/, 'Pw sau lưng', 'b'],
  [/^Áp lực nước phía trước/, 'Pw phía trước', 'b'],
  [/^Đẩy ngược/, 'U đẩy ngược', 'b'],
  [/^Gia tăng áp lực đất/, 'ΔPAE', 'm'],
  [/^Lực quán tính của tường/, 'Fqt tường', 'm'],
  [/^Lực quán tính của khối đất/, 'Fqt đất', 'm'],
  [/^Lực quán tính/, 'Fqt', 'm'],
];

export function cfLoads(R: ReportCalcResult): string {
  const g = R.g;
  const I = R.I;
  const Ld = R.Ld;
  const Wt = R.W;
  const SD = R.SD;
  const f1 = (v: number) => (+v).toFixed(1);
  const hasQ = I.q > 1e-9;
  const hasL = I.qL > 1e-9;
  const yk = Math.min(...g.foot.map((p) => p[1]));
  const xr = Math.max(g.B + 2, g.xbt + (I.Hs > 1e-9 && I.m > 1e-9 ? I.m * I.Hs : 0) + 1.2);
  const yTop = g.yT + Math.max(I.Hs, 0) + 0.1;
  const hasHF = !!(Wt && Wt.hF > 1e-9);
  const top = 26 + (hasQ ? 50 : 0) + (hasL ? 50 : 0);
  let xl = -1.5;
  let low = Math.min(-1.6, yk - 0.5);
  for (let k = 0; k < 5; k++) {
    const sc = Math.min(680 / (xr - xl), 560 / (yTop - low));
    if (SD) low = Math.min(-1.6, yk - (Math.max(30, Math.min(62, sc * 1.25)) + 40) / sc);
    if (hasHF) xl = Math.max(-4.2, Math.min(-1.5, -(0.3 + 175 / sc)));
  }
  const D = cfNew([xl, xr, low, yTop], 760, 680, 560, top, 16);
  cfBody(D, R, { xr, xl, deep: -low });
  [g.foot, g.stem].forEach((pl) => {
    for (let i = 0; i < pl.length; i++) {
      const a = pl[i];
      const b = pl[(i + 1) % pl.length];
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 1e-9) {
        D.seg.push([D.X(a[0]), D.Y(a[1]), D.X(b[0]), D.Y(b[1])]);
      }
    }
  });
  D.ln(g.A, g.T, 'stroke="#c00000" stroke-width="1" stroke-dasharray="7,4"');
  const x0 = g.xbt;
  const x1 = xr - 0.3;
  const gy = (x: number) => g.yG(x);
  const surf = (q: number, nm: string, c: string, lift: number) => {
    const n = Math.max(3, Math.floor((D.X(x1) - D.X(x0)) / 34));
    const pts: Point2D[] = [];
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n;
      const yp = D.Y(gy(x)) - lift;
      pts.push([D.X(x), yp]);
      D.arp(D.X(x), yp - 34, D.X(x), yp - 1, c, 1.4);
    }
    D.lp(
      pts[0][0],
      pts[0][1] - 34,
      pts[n][0],
      pts[n][1] - 34,
      `stroke="${CF_CL[c]}" stroke-width="1.4"`,
    );
    D.tp(pts[0][0] + 4, pts[0][1] - 40, `${nm} = ${cnf(q, 1)} kPa`, {
      fs: 12,
      b: true,
      c,
      free: true,
    });
  };
  if (hasQ) surf(I.q, 'q (ES)', 'o', 0);
  if (hasL) surf(I.qL, 'qL (LS)', 'b', hasQ ? 46 : 0);
  if (Wt) {
    const lv = (y: number, xa: number, xb: number, t: string, xm: number) => {
      const py = D.Y(y);
      const px = D.X(xm);
      D.ln([xa, y], [xb, y], 'stroke="#0050b0" stroke-width="1.2" stroke-dasharray="7,3"');
      D.s += `<polygon points="${f1(px - 6)},${f1(py - 10)} ${f1(px + 6)},${f1(py - 10)} ${f1(px)},${f1(py - 1)}" fill="#fff" stroke="#0050b0" stroke-width="1.1"/>`;
      D.tp(px + 9, py - 14, t, { fs: 11, c: 'b' });
    };
    const yb = Math.min(Math.max(Wt.hB, 0), g.yT + Math.max(I.Hs, 0));
    lv(yb, yb <= g.yF ? g.xbb : g.xb(yb), xr, `MNN sau lưng hB = ${cnf(Wt.hB, 2)} m`, xr - 1.1);
    if (Wt.hF > 1e-9) lv(Wt.hF, xl, 0, `MNN trước hF = ${cnf(Wt.hF, 2)} m`, xl + 0.3);
  }
  const used: Record<string, number> = {};
  const LB: Array<{ lab: CFigLabel; pts: Point2D[]; c: string }> = [];
  (Ld.L as LoadRecord[]).forEach((l) => {
    if (Math.hypot(l.Fx, l.Fy) < 1e-6) return;
    if (/ trên gót|thành phần đứng/.test(l.nm) && l.ty !== 'DC' && l.ty !== 'EV') return;
    const d = CF_LDN.find((q) => q[0].test(l.nm));
    if (!d && !['DC', 'EV', 'EH', 'WA', 'EQ'].includes(l.ty)) return;
    const lab = d ? d[1] : l.ty;
    const c = d ? d[2] : 'k';
    const F = Math.hypot(l.Fx, l.Fy);
    const u: Point2D = [l.Fx / F, l.Fy / F];
    const horiz = Math.abs(u[0]) > Math.abs(u[1]);
    const Lpx = horiz ? 44 : 32;
    const px = D.X(l.x);
    let py = D.Y(l.y);
    const key = Math.round(px / 6) + ',' + Math.round(py / 6);
    const k = (used[key] = (used[key] || 0) + 1);
    py -= (k - 1) * 17;
    const tx = px - u[0] * Lpx;
    const ty = py + u[1] * Lpx;
    D.arp(tx, ty, px, py, c, 2);
    if (l.ty === 'DC' || l.ty === 'EV') D.dot([l.x, l.y], c, 2.6);
    const txt = `${lab} = ${cnf(F, 1)} kN`;
    if (horiz) {
      D.tp(u[0] < 0 ? tx + 4 : tx - 4, ty - 5, txt, {
        fs: 11.5,
        b: true,
        c,
        a: u[0] < 0 ? 'start' : 'end',
      });
    } else {
      D.tp(tx + 6, u[1] < 0 ? ty - 5 : ty + 13, txt, { fs: 11.5, b: true, c });
    }
    LB.push({
      lab: D.lab[D.lab.length - 1],
      pts: [0, 0.25, 0.5, 0.75, 1].map((t) => [tx + (px - tx) * t, ty + (py - ty) * t]),
      c,
    });
  });
  if (SD) {
    const p = CALC.press(SD.N, SD.s, g.B);
    const x = (i: number) => (g.B * i) / 24;
    const yb = D.Y(yk) + 8;
    const Hm = Math.max(30, Math.min(62, D.sc * 1.25));
    const sc = Hm / Math.max(p.qmax, 1e-9);
    const pts: Point2D[] = [];
    const yEnd = (xx: number) => {
      const v = g.foot.filter((q) => Math.abs(q[0] - xx) < 1e-9).map((q) => q[1]);
      return v.length ? Math.min(0, ...v) : 0;
    };
    [0, g.B].forEach((xx) =>
      D.lp(
        D.X(xx),
        D.Y(yEnd(xx)),
        D.X(xx),
        yb,
        'stroke="#1b7a2a" stroke-width="0.9" stroke-dasharray="3,3"',
      ),
    );
    for (let i = 0; i <= 24; i++) pts.push([D.X(x(i)), yb + p.q(x(i)) * sc]);
    {
      const ring: Point2D[] = [[D.X(0), yb], ...pts, [D.X(g.B), yb]];
      for (let i = 1; i < ring.length; i++) {
        D.seg.push([ring[i - 1][0], ring[i - 1][1], ring[i][0], ring[i][1]]);
      }
      D.seg.push([ring[ring.length - 1][0], ring[ring.length - 1][1], ring[0][0], ring[0][1]]);
    }
    D.s += `<polygon points="${f1(D.X(0))},${f1(yb)} ${pts.map((q) => f1(q[0]) + ',' + f1(q[1])).join(' ')} ${f1(D.X(g.B))},${f1(yb)}" fill="rgba(27,122,42,0.15)" stroke="${CF_CL.g}" stroke-width="1.4"/>`;
    for (let i = 1; i < 12; i++) {
      const xi = x(2 * i);
      const h = p.q(xi) * sc;
      if (h > 6) D.arp(D.X(xi), yb + h, D.X(xi), yb + 1, 'g', 1.2);
    }
    D.tp(
      D.X(0) - 4,
      yb + p.q1 * sc + 4,
      `${p.q1 >= p.q2 ? 'Pmax' : 'Pmin'} = ${cnf(p.q1, 1)} kPa`,
      { fs: 11.5, b: true, c: 'g', a: 'end', free: true },
    );
    D.tp(
      D.X(g.B) + 4,
      yb + p.q2 * sc + 4,
      `${p.q2 > p.q1 ? 'Pmax' : 'Pmin'} = ${cnf(p.q2, 1)} kPa`,
      { fs: 11.5, b: true, c: 'g', free: true },
    );
  }
  cfPlace(D);
  LB.forEach((q) => {
    const b = cfBox(q.lab, 0, 0);
    let best: { dd: number; cx: number; cy: number; t: Point2D } | null = null;
    q.pts.forEach((t) => {
      const cx = Math.max(b[0], Math.min(b[2], t[0]));
      const cy = Math.max(b[1], Math.min(b[3], t[1]));
      const dd = Math.hypot(cx - t[0], cy - t[1]);
      if (!best || dd < best.dd) best = { dd, cx, cy, t };
    });
    if (best !== null) {
      const hit = best as { dd: number; cx: number; cy: number; t: Point2D };
      if (hit.dd > 9) {
        D.lp(
          hit.cx,
          hit.cy,
          hit.t[0],
          hit.t[1],
          `stroke="${CF_CL[q.c] || q.c}" stroke-width="0.9"`,
        );
      }
    }
  });
  D.lab.forEach((L) => {
    L.o.fixed = true;
  });
  return D.svg();
}

export function cfRbScheme(P: Project, R: ReportCalcResult, res: BarsResult): string {
  const g = R.g;
  const yk = Math.min(...g.foot.map((p) => p[1]));
  const by = (k: string) => res.bars.find((b) => b.key === k);
  const byM = (m: string) => res.bars.find((b) => String(b.mark) === String(m));
  const cm = (a: Point2D[]): Point2D[] => a.map((p) => [p[0] / 100, p[1] / 100]);
  const ancB = ancBarOf(res) || null;
  const AG = ancB && ancB.A;
  const D = cfNew(
    [-0.7, g.B + 1.1, Math.min(yk, AG ? -AG.Lb / 100 : 0) - 0.55, g.yT + 0.45],
    760,
    640,
    560,
    14,
    14,
  );
  const px = (q: Point2D): Point2D => [D.X(q[0]), D.Y(q[1])];
  const segs = (pts: Point2D[]) => {
    for (let i = 1; i < pts.length; i++) {
      const a = px(pts[i - 1]);
      const b = px(pts[i]);
      D.seg.push([a[0], a[1], b[0], b[1]]);
    }
  };
  const fl = 'fill="#efefef" stroke="none"';
  const ol = 'stroke="#222" stroke-width="1.3"';
  const eq = (a: number, b: number) => Math.abs(a - b) < 1e-9;
  D.poly(g.foot, fl);
  D.poly(g.stem, fl);
  {
    const f = g.foot;
    const n = f.length;
    for (let i = 0; i < n; i++) {
      const a = f[i];
      const b = f[(i + 1) % n];
      if (eq(a[0], b[0]) && eq(a[1], b[1])) continue;
      if (
        eq(a[1], g.yF) &&
        eq(b[1], g.yF) &&
        Math.min(a[0], b[0]) >= g.xfb - 1e-9 &&
        Math.max(a[0], b[0]) <= g.xbb + 1e-9
      ) {
        continue;
      }
      D.ln(a, b, ol);
      const pa = px(a);
      const pb = px(b);
      D.seg.push([pa[0], pa[1], pb[0], pb[1]]);
    }
  }
  {
    const s = g.stem;
    D.pl(s, ol);
    segs(s);
  }
  const CL: Record<string, string> = {
    s1: 'r',
    s2: 'b',
    b2: 'g',
    b1: 'o',
    h1: 'm',
    h1a: 'm',
    l1: 'k',
  };
  const drawn: Array<{ k: string; b: BarSpec; pts: Point2D[]; m?: Point2D }> = [];
  const tag = (b: BarSpec) =>
    `(${b.mark}) Φ${cnf(b.d, 0)}${b.a && b.a > 0 ? ' a' + cnf(b.a * 10, 0) : ''}`;
  const lenOf = (pts: Point2D[]) => {
    let L = 0;
    for (let i = 1; i < pts.length; i++) {
      L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    }
    return L;
  };
  const longest = (pts: Point2D[]): { L: number; a: Point2D; b: Point2D; m: Point2D } => {
    let best: { L: number; a: Point2D; b: Point2D; m: Point2D } | null = null;
    for (let i = 1; i < pts.length; i++) {
      const L = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (!best || L > best.L) {
        best = {
          L,
          a: pts[i - 1],
          b: pts[i],
          m: [(pts[i][0] + pts[i - 1][0]) / 2, (pts[i][1] + pts[i - 1][1]) / 2],
        };
      }
    }
    return best || { L: 0, a: pts[0] || [0, 0], b: pts[0] || [0, 0], m: pts[0] || [0, 0] };
  };
  const real = (b: BarSpec) =>
    Array.isArray(b.path) &&
    b.path.length >= 2 &&
    !(b.path[0][0] === 0 && b.path[0][1] === 0 && b.path.every((q) => q[1] === 0));
  const stroke = (c: string) => `stroke="${CF_CL[c] || c}" stroke-width="2.2" stroke-linejoin="round"`;
  const LB: Array<{ lab: CFigLabel; tgt: Point2D; c: string }> = [];
  const label = (tgt: Point2D, text: string, c: string, o?: CFigLabelOpts) => {
    const t = px(tgt);
    D.tp(
      t[0] + ((o && o.dx) || 0),
      t[1] + ((o && o.dy) || 0),
      text,
      Object.assign({ b: true, fs: 12, c }, o),
    );
    LB.push({ lab: D.lab[D.lab.length - 1], tgt: t, c });
  };
  const dotsOf = (pts: Point2D[], c: string) =>
    pts.forEach((q) => {
      D.dot(q, c, 2.7);
      const t = px(q);
      D.obs.push([t[0] - 3, t[1] - 3, t[0] + 3, t[1] + 3]);
    });
  const nearest = (pts: Point2D[], f: (p: Point2D) => number) =>
    pts.reduce((a, q) => (f(q) < f(a) ? q : a), pts[0]);
  const keyIv: Array<[number, number]> = [];
  {
    const f = g.foot;
    const n = f.length;
    let st = f.findIndex((q) => q[1] >= -1e-6);
    if (st < 0) st = 0;
    let cur: [number, number] | null = null;
    for (let k = 1; k <= n; k++) {
      const q = f[(st + k) % n];
      if (q[1] < -1e-6) {
        if (!cur) cur = [q[0], q[0]];
        cur[0] = Math.min(cur[0], q[0]);
        cur[1] = Math.max(cur[1], q[0]);
      } else if (cur) {
        keyIv.push(cur);
        cur = null;
      }
    }
    if (cur) keyIv.push(cur);
  }
  const hwOf = (text: string) => cfW(text, { b: true, fs: 12 }) / 2 / D.sc + 0.1;
  const freeX = (x0: number, x1: number, text: string) => {
    const hw = hwOf(text);
    const c = [
      (x0 + x1) / 2,
      x0 + (x1 - x0) * 0.25,
      x0 + (x1 - x0) * 0.75,
      x0 + (x1 - x0) * 0.1,
      x0 + (x1 - x0) * 0.9,
    ];
    return (
      c.find((x) => keyIv.every((iv) => x + hw < iv[0] - 0.05 || x - hw > iv[1] + 0.05)) ?? c[0]
    );
  };
  const yAt = (pts: Point2D[], x: number, top: boolean) => {
    let r: number | null = null;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      if (
        Math.abs(b[0] - a[0]) < 1e-9 ||
        x < Math.min(a[0], b[0]) - 1e-9 ||
        x > Math.max(a[0], b[0]) + 1e-9
      ) {
        continue;
      }
      const y = a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
      if (r === null || (top ? y > r : y < r)) r = y;
    }
    return r;
  };
  if (AG && ancB) {
    const y1 = AG.Lc / 100;
    const y0 = -AG.Lb / 100;
    const xs = AG.xs.map((x) => x / 100);
    xs.forEach((x) => {
      D.ln([x, y1], [x, y0], `stroke="${CF_CL.n}" stroke-width="2.4"`);
      D.seg.push([D.X(x), D.Y(y1), D.X(x), D.Y(y0)]);
    });
    label([xs[xs.length - 1], y0 * 0.55], tag(ancB), 'n', { dx: 10, dy: 4 });
  }
  const geo = res.G && (res.G as { geo?: Record<string, { lines?: Point2D[][]; dots?: Point2D[] }> }).geo;
  if (geo) {
    const GL = (k: string): Point2D[][] => ((geo[k] && geo[k].lines) || []).map(cm);
    const GD = (k: string): Point2D[] =>
      ((geo[k] && geo[k].dots) || []).map((q) => [q[0] / 100, q[1] / 100]);
    (
      [
        ['c3', '3', 'g'],
        ['c4', '4', 't'],
        ['c1', '1', 'o'],
        ['c6', '6', 'r'],
        ['c7', '7', 'b'],
      ] as const
    ).forEach(([k, m, c]) => {
      const b = byM(m);
      if (!b) return;
      const ls = GL(k);
      if (!ls.length) return;
      ls.forEach((pl) => {
        D.pl(pl, stroke(c));
        segs(pl);
      });
      if (m === '1') {
        const lo = ls.reduce((a, q) => (q[0][1] < a[0][1] ? q : a), ls[0]);
        const up = ls.reduce((a, q) => (q[0][1] > a[0][1] ? q : a), ls[0]);
        const xl = freeX(lo[0][0], lo[lo.length - 1][0], tag(b));
        const xu = g.xbb + (lo[lo.length - 1][0] - g.xbb) * 0.7;
        label([xl, lo[0][1]], tag(b), c, { dy: 22, a: 'middle' });
        if (up !== lo) label([xu, up[0][1]], tag(b), c, { dy: -20, a: 'middle' });
      } else {
        const L = ls.reduce((a, q) => (lenOf(q) > lenOf(a) ? q : a), ls[0]);
        const lg = longest(L);
        label(
          lg.m,
          tag(b),
          c,
          m === '7'
            ? { dx: -12, dy: 4, a: 'end' }
            : m === '4'
              ? { dx: 12, dy: -6 }
              : m === '3'
                ? { dx: -14, dy: -8, a: 'end' }
                : { dx: 12, dy: 4 },
        );
      }
    });
    (
      [
        ['c2', '2', 'k'],
        ['c5', '5', 'm'],
        ['c5a', '5A', 'm'],
      ] as const
    ).forEach(([k, m, c]) => {
      const b = byM(m);
      const ds = GD(k);
      if (!b || !ds.length) return;
      dotsOf(ds, c);
      const yt = g.yF + (g.yT - g.yF) * (m === '5' ? 0.75 : 0.9);
      const q =
        m === '2'
          ? nearest(ds, (p) => (p[1] > g.yF * 0.5 ? 1e3 : 0) + Math.abs(p[0] - g.B * 0.85))
          : nearest(
              ds,
              (p) => (p[0] < (g.xfb + g.xbb) / 2 ? 0 : 1e3) + Math.abs(p[1] - yt),
            );
      label(
        q,
        tag(b),
        c,
        m === '2'
          ? { dx: 10, dy: 26 }
          : m === '5'
            ? { dx: -10, dy: 4, a: 'end' }
            : { dx: 10, dy: -8 },
      );
    });
  } else {
    ['s2', 's1', 'b1', 'b2'].forEach((k) => {
      const b = by(k);
      if (!b || !real(b) || !b.path) return;
      const pts = cm(b.path);
      D.pl(pts, stroke(CL[k]));
      segs(pts);
      drawn.push({ k, b, pts, m: longest(pts).m });
    });
    ['h1', 'h1a', 'l1'].forEach((k) => {
      const b = by(k) as (BarSpec & { rows?: number[]; xs?: number[]; yl?: number; yu?: number }) | undefined;
      if (!b) return;
      let pts: Point2D[] | null = null;
      if (Array.isArray(b.pts) && b.pts.length) {
        pts = cm(b.pts as unknown as Point2D[]);
      } else if (k === 'h1' && Array.isArray(b.rows) && b.rows.length) {
        const off = (P.cover * 10 + b.d / 2) / 1e3;
        pts = [];
        b.rows.forEach((y) => {
          const ym = y / 100;
          pts!.push([g.xf(ym) + off, ym], [g.xb(ym) - off, ym]);
        });
      } else if (k === 'l1' && Array.isArray(b.xs) && b.xs.length && b.yl != null && b.yu != null) {
        pts = [];
        b.xs.forEach((x) => pts!.push([x / 100, b.yl! / 100], [x / 100, b.yu! / 100]));
      }
      if (!pts || !pts.length) return;
      dotsOf(pts, CL[k]);
      drawn.push({ k, b, pts });
    });
    const dm = (k: string) => drawn.find((q) => q.k === k);
    const yt = g.yF + (g.yT - g.yF) * 0.8;
    const dS1 = dm('s1');
    if (dS1 && dS1.m) label(dS1.m, tag(dS1.b), CL.s1, { dx: 12, dy: 4 });
    const dS2 = dm('s2');
    if (dS2 && dS2.m) label(dS2.m, tag(dS2.b), CL.s2, { dx: -12, dy: 4, a: 'end' });
    const dB2 = dm('b2');
    if (dB2) {
      const xh = Math.max(g.xbb, g.xbt || 0) + 0.15;
      const x = (xh + g.B) / 2;
      const y = yAt(dB2.pts, x, true);
      label(y == null ? (dB2.m || [x, g.yF]) : [x, y], tag(dB2.b), CL.b2, {
        dy: -20,
        a: 'middle',
      });
    }
    const dB1 = dm('b1');
    if (dB1) {
      const lg = longest(dB1.pts);
      const x = freeX(Math.min(lg.a[0], lg.b[0]), Math.max(lg.a[0], lg.b[0]), tag(dB1.b));
      const y = yAt(dB1.pts, x, false);
      label(y == null ? (dB1.m || [x, 0]) : [x, y], tag(dB1.b), CL.b1, {
        dy: 20,
        a: 'middle',
      });
    }
    const dH1 = dm('h1');
    const hf =
      dH1 &&
      nearest(dH1.pts, (q) => (q[0] < (g.xfb + g.xbb) / 2 ? 0 : 1e3) + Math.abs(q[1] - yt));
    if (hf && dH1) label(hf, tag(dH1.b), CL.h1, { dx: -10, dy: 4, a: 'end' });
    const dH1a = dm('h1a');
    const ha = dH1a && nearest(dH1a.pts, (q) => Math.abs(q[1] - yt) - q[0] * 0.001);
    if (ha && dH1a) label(ha, tag(dH1a.b), CL.h1a, { dx: 12, dy: 4 });
    const dL1 = dm('l1');
    const lp =
      dL1 &&
      nearest(dL1.pts, (q) => (q[1] > g.yF * 0.5 ? 1e3 : 0) + Math.abs(q[0] - g.B * 0.82));
    if (lp && dL1) label(lp, tag(dL1.b), CL.l1, { dx: 10, dy: 22 });
  }
  cfPlace(D);
  LB.forEach((q) => {
    const b = cfBox(q.lab, 0, 0);
    const cx = Math.max(b[0], Math.min(b[2], q.tgt[0]));
    const cy = Math.max(b[1], Math.min(b[3], q.tgt[1]));
    if (Math.hypot(cx - q.tgt[0], cy - q.tgt[1]) > 15) {
      D.lp(cx, cy, q.tgt[0], q.tgt[1], `stroke="${CF_CL[q.c] || q.c}" stroke-width="0.9"`);
    }
  });
  D.lab.forEach((L) => {
    L.o.fixed = true;
  });
  return D.svg();
}
