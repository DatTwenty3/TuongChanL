import { CALC, WATER, calcGsOut, type RibCalcResult } from '../engine';
import type { EngineProject } from '../engine/types';
import type { Point2D } from '../types/project';
import { calcExtSum } from './calcExtFigures';
import { calcFeSheet } from './calcFeCharts';
import { calcFemSheet, calcGsSheet } from './calcGsFemCharts';
import { calcRbSheet, calcSheetHead } from './calcSheetHtml';
import { CFig, CF_CL, cfBody, cfGBox, cfNew, cnf } from './cfig';
import { sExp, sF, sFig, sH2, sH3, sKL, sOk, sRow, sTab, sTx, CD_LAB, sFootPress, sKeyE, sKeyU, sRC } from './reportHelpers';

export function cfRibPlan(R: RibCalcResult): string {
  const r = R.rg;
  const g = R.g;
  const bm = R.bm;
  const Lu = r.Lu;
  const tb = g.tb;
  const rl = Math.max(r.E[0] - g.xbb, 0.3);
  const mA = Math.max(bm.Mpos, bm.Mneg, 1e-9);
  const ma = 0.9;
  const v0 = -0.42;
  const D = cfNew([-0.5, Lu + 0.5, v0 - ma - 0.55, tb + rl + 0.3], 760, 640, 470, 42, 12);
  const fillS = 'fill="#d9d9d9" stroke="#222" stroke-width="1.3"';

  D.poly(
    [
      [0, 0],
      [Lu, 0],
      [Lu, tb],
      [0, tb],
    ],
    fillS,
  );

  r.ctr.forEach((c, i) => {
    D.poly(
      [
        [c - r.rt / 2, tb],
        [c + r.rt / 2, tb],
        [c + r.rt / 2, tb + rl],
        [c - r.rt / 2, tb + rl],
      ],
      fillS,
    );
    D.num([c, tb + rl + 0.02], String(i + 1), 'b');
  });

  const cuts = [0, ...r.ctr.map((c) => [c - r.rt / 2, c + r.rt / 2]).flat(), Lu];
  for (let i = 0; i < cuts.length; i += 2) {
    const a = cuts[i];
    const b = cuts[i + 1];
    if (b - a < 0.12) continue;
    const n = Math.max(1, Math.floor((b - a) / 0.75));
    for (let k = 0; k < n; k++) {
      D.arTo([a + ((b - a) * (k + 0.5)) / n, tb], [0, -1], 26, 'r', 1.3);
    }
  }

  D.t([(r.ctr[0] + (r.ctr[1] || r.ctr[0] + r.S)) / 2, tb + 0.62], 'p (kPa)', {
    a: 'middle',
    c: 'r',
    fs: 11,
    i: true,
  });

  const ypx = D.Y(tb + rl) - 20;
  const xs = [0, ...r.ctr, Lu];
  for (let i = 0; i < xs.length - 1; i++) {
    D.dimH(xs[i], xs[i + 1], ypx, cnf(xs[i + 1] - xs[i], 3), [tb + rl, tb + rl], { fs: 10 });
  }
  D.t([Lu, tb / 2], 'tb = ' + cnf(tb, 3) + ' m', { dx: 8, fs: 11 });
  D.t([r.ctr[0] + r.rt / 2, tb + rl / 2], 'tr = ' + cnf(r.rt, 2), { dx: 6, fs: 11 });
  D.ln([0, v0], [Lu, v0], 'stroke="#555" stroke-width="0.8"');

  const P: Point2D[] = [[0, v0]];
  bm.samples.forEach(([x, m]) => P.push([x, v0 - (m / mA) * ma]));
  P.push([Lu, v0]);
  D.poly(P, 'fill="rgba(0,80,176,0.12)" stroke="#0050b0" stroke-width="1.3"');

  bm.sup.forEach((x, i) =>
    D.t([x, v0 - (bm.Ms[i] / mA) * ma], cnf(bm.Ms[i], 3), {
      a: 'middle',
      dy: bm.Ms[i] < 0 ? -5 : 13,
      c: 'b',
      fs: 11,
    }),
  );

  bm.spans.forEach((s) => {
    if (s.Mmax > 0.02 * mA) {
      D.t([s.xm, v0 - (s.Mmax / mA) * ma], cnf(s.Mmax, 3), {
        a: 'middle',
        dy: 14,
        c: 'b',
        fs: 11,
      });
    }
  });

  D.t(
    [Lu / 2, v0 - ma - 0.38],
    'Mômen uốn của dầm liên tục do tải phân bố đều 1 kN/m (kN.m); dương: căng mặt trước',
    { a: 'middle', fs: 11, i: true, c: 'b' },
  );

  return D.svg();
}

export function cfRibElev(R: RibCalcResult): string {
  const g = R.g;
  const r = R.rg;
  const rr = R.rib.rr;
  const pr = R.press;
  const bx0 = cfGBox(R as never, 0.55);
  const xp = Math.max(g.B, r.E[0]) + 1.25;
  const x1 = Math.max(bx0[1], xp + 1.35) + 1;
  const D = cfNew([bx0[0], x1, bx0[2], bx0[3]], 760, 660, 520, 14, 14);
  cfBody(D, R as never, { deep: 0.6 });
  D.poly(r.tri, 'fill="rgba(0,80,176,0.14)" stroke="#0050b0" stroke-width="1.5"');
  D.t([r.cx, r.cy], 'sườn', { a: 'middle', c: 'b', fs: 12, i: true });

  const CL = ['r', 'b', 'g', 'o', 'm', 'k'];
  const xh = R.geo.xh;
  const off = (q: { ok: number }) => q.ok / r.cosB;

  rr.gr.forEach((q, i) => {
    const c = CL[i % CL.length];
    const yt = q.ys;
    const A: Point2D = [xh(yt) - off(q), yt];
    const B: Point2D = [xh(r.yb) - off(q), r.yb];
    D.ln(A, B, `stroke="${CF_CL[c]}" stroke-width="2.2"`);
    D.dot(A, c, 2.6);
    D.t(A, `N${i + 1}: ${rr.nb}Φ${cnf(rr.d, 0)}`, {
      dx: -7,
      dy: i % 2 ? 14 : -3,
      a: 'end',
      c,
      fs: 11,
      b: true,
    });
  });

  const ytop = g.yT;
  const ybot = r.yb;
  const sc = 1.35 / Math.max(pr.pU(ytop - ybot), 1e-9);
  const Z = [0, 0.25, 0.5, 0.75, 1].map((f) => f * (ytop - ybot));
  const tails: Point2D[] = Z.map((z) => [xp + pr.pU(z) * sc, ytop - z]);
  D.pl([[xp, ytop], ...tails, [xp, ybot]], 'stroke="#c00000" stroke-width="1.2"');
  Z.forEach((z) => {
    if (z > 0 || pr.pU(0) > 1e-6) {
      D.arTo([xp, ytop - z], [-1, 0], Math.max(pr.pU(z) * sc * D.sc, 6), 'r', 1.2);
    }
  });
  D.t(tails[0], cnf(pr.pU(0), 1) + ' kPa', { dx: 6, dy: -4, c: 'r', fs: 11 });
  D.t(tails[tails.length - 1], cnf(pr.pU(ytop - ybot), 1) + ' kPa', {
    dx: 6,
    dy: 10,
    c: 'r',
    fs: 11,
  });
  D.t([xp + 0.1, (ytop + ybot) / 2], 'p tính toán', { dx: 4, c: 'r', fs: 11, i: true });
  D.dimV(r.yb, r.yR, D.X(r.E[0]) + 26, 'hs = ' + cnf(r.yR - r.yb, 3), [r.E[0], r.T[0]], {
    fs: 10,
  });
  D.dimH(g.xbb, r.E[0], D.Y(r.yb) + 18, 'Lr = ' + cnf(r.E[0] - g.xbb, 3), [r.yb, r.yb], {
    fs: 10,
  });
  D.ln(
    [g.xfb - 0.25, r.yb],
    [r.E[0] + 0.25, r.yb],
    'stroke="#1b7a2a" stroke-width="1.1" stroke-dasharray="8,3,2,3"',
  );
  D.t([r.E[0] + 0.25, r.yb], 'A', { dx: 6, dy: 4, b: true, c: 'g' });
  D.t([g.xfb - 0.25, r.yb], 'A', { dx: -6, dy: 4, a: 'end', b: true, c: 'g' });

  return D.svg();
}

export function cfRibChart(R: RibCalcResult): string {
  const rib = R.rib;
  const r = R.rg;
  const rr = rib.rr;
  const pts = rib.pts.slice().sort((a, b) => a.y - b.y);
  const W = 760;
  const ml = 74;
  const mr = 24;
  const mt = 30;
  const mb = 46;
  const hh = 360;
  const H = hh + mt + mb;
  const D = CFig(W, H);
  const mx = Math.max(...pts.map((p) => Math.max(p.Mu, p.Mr)), 1) * 1.06;
  const y0 = r.yb;
  const y1 = r.yR;
  const pw = W - ml - mr;
  const X = (m: number) => ml + (m / mx) * pw;
  const Y = (y: number) => mt + ((y1 - y) / (y1 - y0)) * hh;

  const nice = (() => {
    const t = mx / 6;
    const e = Math.pow(10, Math.floor(Math.log10(t)));
    const f = t / e;
    return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * e;
  })();

  for (let m = 0; m <= mx + 1e-9; m += nice) {
    D.lp(X(m), mt, X(m), mt + hh, 'stroke="#ddd" stroke-width="0.6"');
    D.tp(X(m), mt + hh + 15, cnf(m, m < 10 ? 1 : 0), { a: 'middle', fs: 11, free: true });
  }

  const sy = y1 - y0 > 6 ? 2 : 1;
  for (let y = Math.ceil(y0 / sy) * sy; y <= y1 + 1e-9; y += sy) {
    D.lp(ml, Y(y), ml + pw, Y(y), 'stroke="#ddd" stroke-width="0.6"');
    D.tp(ml - 6, Y(y) + 4, cnf(y, 1), { a: 'end', fs: 11, free: true });
  }

  D.lp(ml, mt, ml, mt + hh, 'stroke="#222" stroke-width="1"');
  D.lp(ml, mt + hh, ml + pw, mt + hh, 'stroke="#222" stroke-width="1"');

  const poly = (k: 'Mu' | 'Mr', c: string, w: number, dash?: string) => {
    D.s += `<polyline fill="none" stroke="${c}" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ''} points="${pts.map((p) => X(p[k]).toFixed(1) + ',' + Y(p.y).toFixed(1)).join(' ')}"/>`;
  };
  poly('Mu', CF_CL.r, 2);
  poly('Mr', CF_CL.b, 2);

  rr.gr.forEach((q, i) => {
    if (i === 0) return;
    const y = q.ys;
    if (y > y0 && y < y1) {
      D.lp(
        ml,
        Y(y),
        ml + pw,
        Y(y),
        `stroke="${CF_CL.g}" stroke-width="0.9" stroke-dasharray="6,3"`,
      );
      D.tp(ml + pw - 4, Y(y) - 4, `cắt nhóm N${i + 1} (y = ${cnf(y, 2)} m)`, {
        a: 'end',
        fs: 10,
        c: 'g',
      });
    }
  });

  const at = (f: number) =>
    pts.reduce((a, p) =>
      Math.abs(p.y - (y0 + f * (y1 - y0))) < Math.abs(a.y - (y0 + f * (y1 - y0))) ? p : a,
    );
  const pu = at(0.3);
  const pm = at(0.85);

  D.tp(X(pu.Mu) + 9, Y(pu.y) + 4, 'Mu (nhu cầu)', { c: 'r', fs: 12, b: true });
  D.tp(X(pm.Mr) + 9, Y(pm.y) + 4, 'Mr = φMn (khả năng)', { c: 'b', fs: 12, b: true });
  D.tp(ml + pw / 2, H - 6, 'Mômen M tại mặt cắt nằm ngang (kN.m)', {
    a: 'middle',
    fs: 12,
    free: true,
  });
  D.tp(14, mt + hh / 2, 'Cao độ y (m)', { a: 'middle', fs: 12, rot: -90, free: true });

  return D.svg();
}

export function calcRibDims(_P: EngineProject, R: RibCalcResult): string {
  const tf = cnf;
  const r = R.rg;
  let h = sTx(
    '<b>Sườn tăng cường.</b> Tường chia thành các đơn vị dài Lu giữa hai khe biến dạng; trong mỗi đơn vị bố trí ' +
      r.n +
      ' sườn BTCT vuông góc với mặt tường, ngàm vào bản đáy. Bản mặt tường làm việc như dầm liên tục nằm ngang tựa trên các sườn (có phần hẫng ở hai đầu đơn vị); mỗi sườn là công xôn tiết diện chữ T (cánh là bản mặt tường), ngàm vào bản đáy.',
  );
  h +=
    sRow('Chiều dài đơn vị tường giữa hai khe biến dạng', 'Lu', tf(r.Lu, 3), 'm') +
    sRow('Số sườn trong một đơn vị tường', 'n', String(r.n), '') +
    sRow('Khoảng cách tim - tim các sườn', 'S', tf(r.S, 3), 'm') +
    sRow(
      'Khoảng cách từ đầu đơn vị đến tim sườn đầu ; từ tim sườn cuối đến đầu kia',
      'eL ; eR',
      tf(r.eL, 3) + ' ; ' + tf(r.eR, 3),
      'm',
    ) +
    sRow('Bề dày sườn', 'tr', tf(r.rt, 3), 'm') +
    sRow(
      'Cao độ đỉnh sườn (tính từ đáy bản đáy) ; chiều cao phần tường hẫng trên đỉnh sườn',
      'yR ; hovh',
      tf(r.yR, 3) + ' ; ' + tf(R.hOvh, 3),
      'm',
    ) +
    sRow(
      'Cạnh huyền của sườn: điểm trên (mặt sau tường) T(x ; y)',
      'T',
      tf(r.T[0], 3) + ' ; ' + tf(r.T[1], 3),
      'm',
    ) +
    sRow(
      'Cạnh huyền của sườn: điểm dưới (mặt bản đáy) E(x ; y)',
      'E',
      tf(r.E[0], 3) + ' ; ' + tf(r.E[1], 3),
      'm',
    ) +
    sRow(
      'Góc nghiêng của cạnh huyền so với phương thẳng đứng ; tanβ',
      'β ; tanβ',
      tf((Math.atan(r.tanB) * 180) / Math.PI, 2) + ' ; ' + tf(r.tanB, 4),
      'độ',
    ) +
    sRow('Diện tích mặt cắt đứng của sườn (phần nhô ra sau mặt tường)', 'Ar', tf(r.Atri, 3), 'm²') +
    sRow('Hệ số quy đổi về 1 m dài tường ψ = n.tr / Lu', 'ψ', tf(r.psi, 4), '') +
    sRow(
      'Trọng lượng sườn quy về 1 m dài tường ; trọng lượng đất bị sườn chiếm chỗ',
      'Wr ; Ws',
      tf(r.Wr, 2) + ' ; ' + tf(r.Ws, 2),
      'kN/m',
    );
  return h;
}

export function calcRibRebarRows(P: EngineProject, R: RibCalcResult): string {
  const tf = cnf;
  const RB = R.RB;
  const rr = R.rib.rr;
  const cv = R.cov;
  const tplC = P.tpl === 'C';
  const rw = (l: string, o: { d: number; a?: number }) =>
    sRow(l, 'Φ ; a', tf(o.d, 0) + ' ; ' + tf((o.a ?? 0) * 10, 0), 'mm');

  let h =
    sRow(
      'Từ mặt bê tông đến tâm thanh ngang của bản mặt (mặt trước ; mặt sau): c' +
        (tplC ? ' + Φđứng' : '') +
        ' + Φ/2',
      'dc',
      tf(cv.covFr + RB.h1.d / 2, 1) + ' ; ' + tf(cv.covBk + RB.h1.d / 2, 1),
      'mm',
    ) +
    sRow(
      'Từ mặt bê tông đến tâm thanh đứng của bản mặt (mặt trước ; mặt sau): ' +
        (tplC ? 'c + Φ/2' : 'c + Φngang + Φ/2'),
      'dc',
      tf(cv.covVf + RB.s2.d / 2, 1) + ' ; ' + tf(cv.covVb + RB.s1.d / 2, 1),
      'mm',
    ) +
    sRow(
      'Từ mặt bê tông đến tâm thanh dọc tường của bản đáy: c + Φ(lớp ngoài) + Φ/2',
      'dc',
      tf(P.cover * 10 + RB.b1.d + RB.l1.d / 2, 1),
      'mm',
    ) +
    sTx('Cốt thép chủ (đường kính Φ và khoảng cách a):') +
    rw('Bản mặt - thép ngang (mỗi mặt; chịu uốn giữa các sườn, chống co ngót)', RB.h1) +
    rw('Bản mặt - thép đứng mặt sau (phía đất đắp)', RB.s1) +
    rw('Bản mặt - thép đứng mặt trước', RB.s2);

  h += tplC
    ? rw('Bản đáy - thép ngang vuông góc mặt tường (hai lớp)', RB.b1)
    : rw('Bản đáy - thép lớp dưới (vuông góc mặt tường)', RB.b1) +
      rw('Bản đáy - thép lớp trên (vuông góc mặt tường)', RB.b2);

  h +=
    rw('Bản đáy - thép dọc tường (chịu uốn của gót giữa các sườn; co ngót)', RB.l1) +
    sRow(
      `Sườn - thép chủ bám cạnh huyền: ${rr.nb} thanh mỗi nhóm, ${rr.ng} nhóm, khoảng cách giữa các nhóm ${tf(rr.sp * 10, 0)} mm`,
      'Φ',
      tf(rr.d, 0),
      'mm',
    ) +
    sRow(
      'Sườn - thép ngang (giằng bản mặt và đai chịu cắt; hai thanh mỗi hàng)',
      'Φ ; a',
      tf(RB.r2.d, 0) + ' ; ' + tf((RB.r2.a ?? 0) * 10, 0),
      'mm',
    ) +
    (RB.r3
      ? sRow(
          'Sườn - thép đứng (treo bản đáy vào sườn; hai thanh mỗi hàng)',
          'Φ ; a',
          tf(RB.r3.d, 0) + ' ; ' + tf((RB.r3.a ?? 0) * 10, 0),
          'mm',
        )
      : '');

  return h;
}

export function sRibRC(
  R: RibCalcResult,
  pt: RibCalcResult['rib']['pts'][number],
  full: boolean,
): string {
  const tf = cnf;
  const M = R.M;
  const rib = R.rib;
  const rr = rib.rr;
  const r = R.rg;
  const fl = pt.fl;
  const sh = pt.sh;
  const sec = pt.sec;
  const cr = rib.cr!;
  const mr = rib.minR!;
  const cs = r.cosB;

  let h = sTx(
    `<b>a) Sức kháng uốn</b> (TCVN 11823-5, Điều 7.3.2 ; φ theo Điều 5.4.2). Mặt cắt nằm ngang tại cao độ y = ${tf(pt.y, 3)} m (cách đỉnh tường Z = ${tf(pt.Z, 3)} m): bản cánh là bản mặt tường (bf × ts), sườn rộng tr; cốt thép chủ nghiêng theo cạnh huyền nên chỉ phát huy thành phần đứng As = n.cosβ.Ab.`,
  );
  h += sF(
    String.raw`a = \dfrac{A_s f_y}{0.85\,f'_c\,b_f}\ \le t_s\ ;\quad M_n = A_s f_y\left(d_s - \dfrac{a}{2}\right)\ ;\quad M_r = \phi\,M_n \ge M_u\ ;\quad b_f = \min(S\ ;\ 12\,t_s + t_r)`,
  );
  h +=
    sRow(
      'Bề dày bản cánh (bản mặt tường) tại mặt cắt ; bề rộng cánh hữu hiệu (TCVN 11823-4, Điều 6.2.6)',
      'ts ; bf',
      tf(sec.ts * 1e3, 0) + ' ; ' + tf(sec.bf * 1e3, 0),
      'mm',
    ) +
    sRow('Chiều cao mặt cắt (từ mặt trước tường đến cạnh huyền)', 'h', tf(sec.h * 1e3, 0), 'mm') +
    sRow(
      'Số thanh chủ đã phát huy đủ cường độ tại mặt cắt (nhóm cắt dần tính theo chiều dài phát triển)',
      'n',
      tf(sec.n, 2),
      'thanh',
    ) +
    sRow(
      'Diện tích cốt thép chịu kéo hữu hiệu (thành phần đứng) As = n.cosβ.Ab ; cosβ = ' + tf(cs, 4),
      'As',
      tf(fl.As, 1),
      'mm²',
    ) +
    sRow(
      'Khoảng cách theo phương ngang từ cạnh huyền đến trọng tâm cốt thép chủ',
      'dc',
      tf(sec.dcm * 1e3, 1),
      'mm',
    ) +
    sRow('Chiều cao có hiệu', 'ds', tf(fl.ds, 1), 'mm') +
    sRow(
      'Chiều cao vùng nén ; khối ứng suất chữ nhật',
      'c ; a',
      tf(fl.c, 1) + ' ; ' + tf(fl.a, 1),
      'mm',
    ) +
    sRow('Kiểm tra a ≤ ts (vùng nén nằm trong bản cánh)', '', '', '', sOk(pt.tOk)) +
    sRow(
      'Biến dạng cốt thép chịu kéo ; hệ số sức kháng',
      'εt ; φ',
      tf(fl.et, 4) + ' ; ' + tf(fl.phi, 3),
      '',
    ) +
    sRow(
      'Sức kháng uốn danh định ; tính toán',
      'Mn ; Mr',
      tf(fl.Mn, 2) + ' ; ' + tf(pt.Mr, 2),
      'kN.m',
    ) +
    sRow('Mômen tính toán (CĐ I-b)', 'Mu', tf(pt.Mu, 2), 'kN.m') +
    sRow('Kiểm tra Mr ≥ Mu', '', '', '', sOk(pt.rM >= 1 && pt.tOk));

  if (R.E && pt.Me != null) {
    h += sRow(
      'Tổ hợp Đặc biệt I (động đất; φ = 1,0; kể quán tính của sườn): mômen tính toán ; sức kháng uốn Mn',
      'Mu,ĐB ; Mn',
      tf(pt.Me, 2) + ' ; ' + tf(pt.MrE, 2),
      'kN.m',
      sOk(pt.rMe >= 1),
    );
  }
  if (!full) return h;

  h += sTx(
    '<b>b) Lượng cốt thép tối thiểu</b> (TCVN 11823-5, Điều 7.3.3.2): Mr ≥ min(Mcr ; 1,33Mu), Sc là mô đun chống uốn của mặt cắt chữ T đối với thớ chịu kéo.',
  );
  h += sF(
    String.raw`M_{cr} = \gamma_3\,\gamma_1\,f_r\,S_c\ ;\quad f_r = 0.63\sqrt{f'_c}\ ;\quad \gamma_1 = 1.6\ ;\ \gamma_3 = f_y/f_u`,
  );
  h +=
    sRow(
      'Mô đun chống uốn mặt cắt chữ T ; cường độ chịu kéo khi uốn',
      'Sc ; fr',
      sExp(mr.Sc, 3) + ' ; ' + tf(M.fr, 3),
      'mm³ ; MPa',
    ) +
    sRow(
      'Mômen nứt ; 1,33Mu',
      'Mcr ; 1,33Mu',
      tf(mr.Mcr, 2) + ' ; ' + tf(1.33 * mr.Mu, 2),
      'kN.m',
    ) +
    sRow('Kiểm tra Mr ≥ min(Mcr ; 1,33Mu)', '', '', '', sOk(mr.ok));

  h += sTx(
    `<b>c) Kiểm soát nứt</b> (TCVN 11823-5, Điều 7.3.4 ; TTGH Sử dụng I, M = ${tf(pt.Ms, 2)} kN.m ; điều kiện tiếp xúc loại ${M.ge >= 1 ? '1' : '2'}, γe = ${tf(M.ge, 2)}). Lớp thép sát cạnh huyền (nhóm N1) đặt ${rr.nb} thanh theo bề dày sườn nên khoảng cách s là khoảng cách giữa các thanh trong lớp; dc là khoảng cách từ cạnh huyền đến tâm thanh gần nhất.`,
  );
  h += sF(
    String.raw`s \le \dfrac{123000\,\gamma_e}{\beta_s\,f_{ss}} - 2\,d_c\ ;\quad \beta_s = 1 + \dfrac{d_c}{0.7\,(h - d_c)}\ ;\quad f_{ss} = \dfrac{M_s}{A_s\,j\,d_s} \le 0.6\,f_y`,
  );
  h +=
    sRow(
      'Ứng suất kéo thớ biên khi chưa nứt (tiết diện chữ nhật bf × h) ; 0,8fr',
      'fct ; 0,8fr',
      tf(cr.fct, 3) + ' ; ' + tf(0.8 * M.fr, 3),
      'MPa',
    ) +
    sRow(
      'Khoảng cách từ cạnh huyền đến tâm thanh gần nhất (vuông góc cạnh huyền)',
      'dc',
      tf(rr.gr[0].ok * 1e3, 1),
      'mm',
    ) +
    sRow('Hệ số k ; j', 'k ; j', tf(cr.k, 4) + ' ; ' + tf(cr.j, 4), '') +
    sRow('Ứng suất cốt thép khi sử dụng', 'fss', tf(cr.fss, 2), 'MPa') +
    sRow('Hệ số βs', 'βs', tf(cr.bs, 4), '') +
    sRow(
      'Khoảng cách cốt thép lớn nhất ; bố trí',
      'smax ; s',
      tf(cr.smax, 0) + ' ; ' + tf(cr.sb, 0),
      'mm',
    ) +
    sRow('Kiểm tra s ≤ smax', '', '', '', sOk(cr.ok));

  h += sTx(
    `<b>d) Sức kháng cắt</b> (TCVN 11823-5, Điều 8.3.3, 8.3.4.2 ; φv = 0,90). Bề rộng bụng bv = tr; cốt đai là thép ngang của sườn Φ${tf(R.RB.r2.d, 0)} a ${tf((R.RB.r2.a ?? 0) * 10, 0)} mm (hai thanh mỗi hàng). Thành phần ngang của lực kéo trong thanh chủ nghiêng chịu một phần lực cắt: Vch = Mu.tanβ / jd.`,
  );
  h += sF(
    String.raw`V_{eff} = V_u - V_{ch}\ ;\quad V_{ch} = \dfrac{M_u\tan\beta}{j_d}\ ;\quad V_r = \phi_v (V_c + V_s)\ ;\quad V_c = 0.083\,\beta_c\sqrt{f'_c}\,b_v\,d_v\ ;\quad V_s = \dfrac{A_v f_y d_v}{s\,\tan\theta}`,
  );
  h +=
    sRow(
      'Lực cắt ngang tính toán ; thành phần chịu bởi thanh chủ nghiêng (tanβ = ' +
        tf(r.tanB, 4) +
        ')',
      'Vu ; Vch',
      tf(pt.Vu, 2) + ' ; ' + tf(pt.Vch, 2),
      'kN',
    ) +
    sRow('Lực cắt tính toán còn lại', 'Veff', tf(pt.Veff, 2), 'kN') +
    sRow(
      'Chiều cao chịu cắt có hiệu ; bề rộng bụng',
      'dv ; bv',
      tf(sh.dv, 1) + ' ; ' + tf(r.rt * 1e3, 0),
      'mm',
    ) +
    sRow(
      'Diện tích đai trong một hàng ; khoảng cách ; Avmin',
      'Av ; s ; Avmin',
      tf(sh.Av, 1) + ' ; ' + tf((R.RB.r2.a ?? 0) * 10, 0) + ' ; ' + tf(sh.Avmin, 1),
      'mm² ; mm ; mm²',
    ) +
    sRow(
      'Biến dạng dọc cốt thép chịu kéo ; tham số khoảng cách vết nứt',
      'εs ; sxe',
      tf(sh.es * 1e3, 4) + '‰ ; ' + tf(sh.sxe, 1),
      '; mm',
    ) +
    sRow('Hệ số β ; góc θ', 'β ; θ', tf(sh.beta, 3) + ' ; ' + tf(sh.th, 1), '; độ') +
    sRow(
      'Sức kháng cắt của bê tông ; của cốt đai',
      'Vc ; Vs',
      tf(sh.Vc, 2) + ' ; ' + tf(sh.Vs, 2),
      'kN',
    ) +
    sRow(
      'Sức kháng cắt tính toán ; giới hạn 0,25f\'c.bv.dv',
      'Vr ; Vlim',
      tf(sh.Vr, 2) + ' ; ' + tf(sh.Vlim, 2),
      'kN',
    ) +
    sRow('Kiểm tra Vr ≥ Veff', '', '', '', sOk(pt.rV >= 1));

  if (R.E && pt.she) {
    h += sRow(
      'Tổ hợp Đặc biệt I (φv = 1,0): lực cắt còn lại ; sức kháng cắt',
      'Veff,ĐB ; Vr',
      tf(pt.Veffe, 2) + ' ; ' + tf(pt.she.Vr, 2),
      'kN',
      sOk(pt.rVe >= 1),
    );
  }
  return h;
}

export function calcSheetRib(P: EngineProject, R: RibCalcResult): string {
  const o = calcSheetHead(P, R);
  let h = o.h;
  let sec = o.sec;
  const tf = cnf;
  const I = R.I;
  const M = R.M;
  const r = R.rg;
  const pr = R.press;
  const bm = R.bm;
  const rho = R.rho;
  const rib = R.rib;
  const rr = rib.rr;
  const RB = R.RB;
  const g = R.g;
  const face: [string, string] = ['mặt trước', 'mặt sau (phía đất đắp)'];
  const FCb = CALC.COMB[1].f;

  const lvTab = (rows: RibCalcResult['stem']['rows']) =>
    sTab(
      [
        'Cao độ y (m)',
        'Z (m)',
        'ts (mm)',
        'pu (kPa)',
        ...(R.E ? ['pĐB (kPa)'] : []),
        'Mu- (kN.m)',
        'Mu+ (kN.m)',
        'Vu (kN)',
        'Hệ số sử dụng',
        'Kết quả',
      ],
      rows.map((q) => [
        tf(q.y, 3),
        tf(q.Z, 3),
        tf(q.ts * 1e3, 0),
        tf(q.pu, 2),
        ...(R.E ? [tf(q.pe, 2)] : []),
        tf(q.Mnu, 2),
        tf(q.Mpu, 2),
        tf(q.Vu, 2),
        tf(q.util, 3),
        sOk(q.ok),
      ]),
    );

  h +=
    sH2(`${sec}.&nbsp;&nbsp;KIỂM TOÁN BẢN MẶT TƯỜNG GIỮA CÁC SƯỜN - TCVN 11823-5`) +
    sTx(
      `Bê tông f'c = ${tf(I.fc, 1)} MPa, Ec = ${tf(M.Ec, 1)} MPa, β1 = ${tf(M.b1, 3)}; cốt thép fy = ${tf(I.fy, 0)} MPa, Es = 200000 MPa.`,
    ) +
    sH3(`${sec}.1. Sơ đồ tính`) +
    sTx(
      `Bản mặt tường tính theo từng dải ngang cao 1 m: dầm liên tục EI không đổi, dài Lu = ${tf(r.Lu, 3)} m, các gối là ${r.n} sườn (tim cách nhau S = ${tf(r.S, 3)} m), hai đầu hẫng eL = ${tf(r.eL, 3)} m và eR = ${tf(r.eR, 3)} m. Tải trọng là áp lực đất ngang p(Z) tăng theo độ sâu Z kể từ đỉnh tường, coi không đổi trong từng dải. Mômen dương (giữa nhịp) căng mặt trước, mômen âm (trên gối sườn) căng mặt sau.`,
    ) +
    sFig(
      cfRibPlan(R),
      'Mặt bằng đơn vị tường (mặt cắt ngang ở mức đỉnh bản đáy) và mômen của dầm liên tục do tải 1 kN/m',
    ) +
    sH3(`${sec}.2. Áp lực ngang lên bản mặt`) +
    sTx(
      `Lực ngang trên lưng tường đứng (mục 4, cao ${tf(pr.Hs, 3)} m): EH = ${tf(pr.EH, 2)} kN, ES = ${tf(pr.ES, 2)} kN, LS = ${tf(pr.LS, 2)} kN. Phân bố: đất đắp - theo ứng suất có hiệu thẳng đứng, tải chất thêm và hoạt tải - chữ nhật${R.W ? '; áp lực nước lỗ rỗng sau lưng trừ áp lực nước phía trước (không âm) cộng thêm' : ''}.`,
    ) +
    (R.W
      ? sF(
          String.raw`p(Z) = \eta\left[\gamma_{EH}\,k_{eff}\,\sigma'_v(Z) + \gamma_{ES}\,p_q + \gamma_{LS}\,p_l + \gamma_{WA}\,p_w(Z)\right]\ ;\quad \sigma'_v = \gamma_s Z\ (Z \le Z_w)\ ;\ \ \gamma_s Z_w + \gamma'(Z - Z_w)\ (Z > Z_w)`,
        ) +
        sF(
          String.raw`p_w(Z) = \gamma_w\left[\max(0,\ Z - Z_w) - \max(0,\ h_F - y_T + Z)\right]\ ;\quad k_{eff} = \dfrac{EH}{\int_0^{H_s}\sigma'_v\,dZ}`,
        )
      : sF(
          String.raw`p(Z) = \eta\left(\gamma_{EH}\,p_a\,Z + \gamma_{ES}\,p_q + \gamma_{LS}\,p_l\right)\ ;\quad p_a = \dfrac{2\,EH}{H_s^2}\ ;\quad p_q = \dfrac{ES}{H_s}\ ;\quad p_l = \dfrac{LS}{H_s}`,
        )) +
    (R.W
      ? sRow(
          'Độ sâu mực nước ngầm sau lưng kể từ đỉnh tường ; hệ số áp lực đất hữu hiệu quy đổi',
          'Zw ; keff',
          tf(pr.Zw, 3) + ' ; ' + tf(pr.kEff, 4),
          'm ; ',
        ) +
        sRow(
          "Trọng lượng riêng đẩy nổi của đất đắp γ' = γsat − γw ; áp lực đều do tải chất thêm ; do hoạt tải",
          "γ' ; pq ; pl",
          tf(Math.max(1, I.gsat - WATER.GW), 2) + ' ; ' + tf(pr.pq, 3) + ' ; ' + tf(pr.pl, 3),
          'kN/m³ ; kPa ; kPa',
        )
      : sRow(
          'Hệ số áp lực đất đắp theo độ sâu ; áp lực đều do tải chất thêm ; do hoạt tải',
          'pa ; pq ; pl',
          tf(pr.pa, 3) + ' ; ' + tf(pr.pq, 3) + ' ; ' + tf(pr.pl, 3),
          'kN/m³ ; kPa ; kPa',
        )) +
    sRow(
      'Hệ số tải trọng CĐ I-b của EH ; ES ; LS (đã nhân η = ' + tf(I.eta, 2) + ')',
      'γEH ; γES ; γLS',
      tf(FCb.EH * I.eta, 3) + ' ; ' + tf(FCb.ES * I.eta, 3) + ' ; ' + tf(FCb.LSh * I.eta, 3),
      '',
    ) +
    (R.W
      ? sTx(
          'Áp lực tính toán và áp lực sử dụng lấy theo công thức trên tại từng cao độ (cột pu ở bảng mục ' +
            sec +
            '.4); áp lực sử dụng (TTGH Sử dụng I) có các hệ số bằng 1,0.',
        )
      : sRow(
          'Áp lực tính toán p = au.Z + uu',
          'au ; uu',
          tf(pr.au, 3) + ' ; ' + tf(pr.uu, 3),
          'kN/m³ ; kPa',
        ) +
        sRow(
          'Áp lực sử dụng p = as.Z + us (TTGH Sử dụng I)',
          'as ; us',
          tf(pr.as_, 3) + ' ; ' + tf(pr.us, 3),
          'kN/m³ ; kPa',
        )) +
    (R.E
      ? sTx(
          `<b>Tổ hợp Đặc biệt I (động đất):</b> thêm gia tăng áp lực đất ΔPAE = ${tf(pr.dPE, 2)} kN phân bố tuyến tính theo độ sâu, hợp lực cách chân tường đứng 0,6Hs (mục 4), và lực quán tính của bản mặt kh.γc.ts; hệ số tải trọng của EH, ES, WA, EQ lấy theo mục 5, η = 1,0.`,
        ) +
        sF(
          String.raw`p_E(Z) = \gamma_{EH}\,p_{e}(Z) + \gamma_{ES}\,p_q + \gamma_{EQ}\,p_l + p_w(Z) + \Delta p(Z) + k_h\,\gamma_c\,t_s\ ;\quad \Delta p(Z) = q_E\left(1.6 - 1.2\,\dfrac{Z}{H_s}\right)\ ;\quad q_E = \dfrac{\Delta P_{AE}}{H_s}`,
        ) +
        sRow(
          'Cường độ phân bố trung bình do ΔPAE ; hệ số kh',
          'qE ; kh',
          tf(pr.qE, 3) + ' ; ' + tf(R.E.kh, 3),
          'kPa ; ',
        )
      : '') +
    sH3(
      `${sec}.3. Hệ số nội lực của dầm liên tục (tải 1 kN/m, giải bằng phương pháp phần tử hữu hạn dầm)`,
    ) +
    sTab(
      [
        'Gối (sườn)',
        'x (m)',
        'Phản lực R (kN)',
        'Mômen gối (kN.m)',
        'Cắt trái (kN)',
        'Cắt phải (kN)',
      ],
      bm.sup.map((x, i) => [
        String(i + 1),
        tf(x, 3),
        tf(bm.R[i], 4),
        tf(bm.Ms[i], 4),
        tf(bm.Vs[i].l, 4),
        tf(bm.Vs[i].r, 4),
      ]),
    ) +
    sTab(
      ['Nhịp', 'Từ x (m)', 'Đến x (m)', 'Mômen dương lớn nhất (kN.m)', 'Tại x (m)'],
      bm.spans.map((s, i) => [String(i + 1), tf(s.a, 3), tf(s.b, 3), tf(s.Mmax, 4), tf(s.xm, 3)]),
      ['c', '', '', '', ''],
    ) +
    sRow(
      'Mômen dương lớn nhất ; mômen âm lớn nhất ; lực cắt lớn nhất tại tim gối',
      'M+ ; M- ; Vmax',
      tf(bm.Mpos, 4) + ' ; ' + tf(bm.Mneg, 4) + ' ; ' + tf(bm.Vmax, 4),
      '(trên 1 kN/m)',
    ) +
    sRow(
      'Phản lực lớn nhất của một sườn ρ (tải lên sườn trên 1 kN/m áp lực)',
      'ρ',
      tf(rho, 4),
      'm',
    ) +
    sH3(`${sec}.4. Nội lực và kiểm toán theo chiều cao`) +
    sTx(
      'Mômen và lực cắt của dải cao 1 m lấy bằng hệ số nội lực nhân với áp lực tính toán tại độ sâu Z; lực cắt kiểm tra tại mặt cắt cách mép sườn một đoạn dv. Mỗi cao độ kiểm tra uốn (hai dấu), cốt thép tối thiểu, nứt, cắt; hệ số sử dụng là lớn nhất của các kiểm tra.',
    ) +
    lvTab(R.stem.rows);

  const gv = R.stem.gov;
  h +=
    sTx(
      `<b>Cao độ bất lợi nhất: y = ${tf(gv.y, 3)} m (Z = ${tf(gv.Z, 3)} m), bản mặt dày ${tf(gv.ts * 1e3, 0)} mm.</b> Mômen dương gây kéo mặt trước, mômen âm gây kéo mặt sau.`,
    ) + sRC(gv.S as never, M as never, gv.rc as never, face);

  if (R.vert.ov) {
    const ov = R.vert.ov;
    h +=
      sH3(
        `${sec}.5. Phần tường hẫng phía trên đỉnh sườn (cao ${tf(ov.Z, 3)} m): công xôn theo phương đứng`,
      ) +
      sTx(
        `Phần tường nằm trên đỉnh sườn không có gối tựa ngang, làm việc như công xôn đứng ngàm tại cao độ đỉnh sườn, bề dày ${tf(ov.ts * 1e3, 0)} mm; áp lực ngang tính từ đỉnh tường đến cao độ ngàm. Mômen gây kéo mặt sau (thép đứng mặt sau).`,
      ) +
      sRC(ov.S as never, M as never, ov.rc as never, ['mặt trước', 'mặt sau (phía đất đắp)']);
  }

  h += sKL(
    R.ok.stem,
    'Bản mặt tường ĐẠT YÊU CẦU.',
    'Bản mặt tường KHÔNG ĐẠT - cần tăng bề dày, thép ngang hoặc giảm khoảng cách giữa các sườn.',
  );
  sec++;

  const base = rib.base!;
  const gvr = rib.gov!;
  h +=
    sH2(`${sec}.&nbsp;&nbsp;KIỂM TOÁN SƯỜN TĂNG CƯỜNG - TCVN 11823-5`) +
    sH3(`${sec}.1. Sơ đồ tính và tải trọng`) +
    sTx(
      `Mỗi sườn là công xôn đứng ngàm tại đỉnh bản đáy, tiết diện chữ T (bản cánh là bản mặt tường, bề rộng hữu hiệu bf = min(S ; 12ts + tr) - TCVN 11823-4, Điều 6.2.6), chịu phản lực gối của dầm liên tục ở mục ${sec - 1}.3. Lấy sườn chịu phản lực lớn nhất để tính cho tất cả các sườn. Tải trọng trên một đơn vị chiều cao sườn là q(Z) = ρ.p(Z).`,
    ) +
    (R.feBasis === 'fe'
      ? sTx(
          `<b>Nội lực của sườn (Mu, Ms, Mđb, Vu) lấy từ mô hình phần tử hữu hạn tấm 3D ở mục ${sec + 3}</b> thay cho công thức công xôn dưới đây; mô hình tính tay được giữ lại để đối chiếu (so sánh ở mục ${sec + 3}.4). Các bước kiểm tra uốn, cốt thép tối thiểu, nứt, cắt dưới đây không đổi.`,
        )
      : '') +
    sF(
      String.raw`M_u(Z) = \rho\left(\dfrac{a_u Z^3}{6} + \dfrac{u_u Z^2}{2}\right)\ ;\quad V_u(Z) = \rho\left(\dfrac{a_u Z^2}{2} + u_u Z\right)`,
    ) +
    sFig(
      cfRibElev(R),
      'Mặt cắt dọc sườn: cạnh huyền, các nhóm thép chủ N1 - N' +
        rr.ng +
        ' và áp lực ngang lên bản mặt (A - A: mặt cắt chân sườn)',
    ) +
    sH3(`${sec}.2. Cốt thép chủ của sườn`) +
    sTx(
      `Thép chủ chịu kéo bám theo cạnh huyền, ${rr.nb} thanh Φ${tf(rr.d, 0)} mỗi nhóm, ${rr.ng} nhóm xếp lớp theo hướng vuông góc với cạnh huyền, khoảng cách giữa các nhóm ${tf(rr.sp * 10, 0)} mm. Nhóm N1 chạy suốt chiều cao sườn; các nhóm sau cắt dần theo bản vẽ. Thanh chỉ phát huy đủ cường độ sau một đoạn phát triển ldb kể từ đầu thanh (TCVN 11823-5, Điều 11.2.1.1), phát triển tuyến tính trên đoạn này.`,
    ) +
    sF(
      String.raw`l_{db} = \max\left(\dfrac{0.02\,A_b\,f_y}{\sqrt{f'_c}}\ ;\ 0.06\,d_b\,f_y\right)`,
    ) +
    sRow(
      'Chiều dài phát triển cơ bản (dọc thanh) ; hình chiếu đứng ldb.cosβ',
      'ldb ; ldb.cosβ',
      tf((rib.ldb ?? 0) * 1e3, 0) + ' ; ' + tf((rib.ldv ?? 0) * 1e3, 0),
      'mm',
    ) +
    sTab(
      [
        'Nhóm',
        'Số thanh',
        'Φ (mm)',
        'Cách cạnh huyền (mm)',
        'Đầu thanh ở cao độ y (m)',
        'Cách đỉnh tường Z (m)',
      ],
      rr.gr.map((q, i) => [
        'N' + (i + 1),
        String(rr.nb),
        tf(rr.d, 0),
        tf(q.ok * 1e3, 1),
        tf(q.ys, 3),
        tf(R.geo.yT - q.ys, 3),
      ]),
      ['c', '', '', '', '', ''],
    ) +
    sFig(cfRibChart(R), 'Biểu đồ mômen tính toán Mu và sức kháng Mr của sườn dọc chiều cao') +
    sH3(`${sec}.3. Mặt cắt chân sườn (mặt cắt A - A, y = ${tf(base.y, 3)} m)`) +
    sRibRC(R, base, true);

  const rowsAll = rib.pts.slice().sort((a, b) => a.y - b.y);
  const pick = rowsAll.filter((p, i) => p.grp >= 0 || i % 6 === 0 || i === rowsAll.length - 1);

  h +=
    sH3(`${sec}.4. Kiểm tra dọc chiều cao sườn`) +
    sTx(
      `Tại mỗi cao độ kiểm tra Mr ≥ Mu và Vr ≥ Veff với số thanh chủ đã phát huy tại mặt cắt đó (các cao độ có ghi nhóm là đầu thanh hoặc điểm phát triển đủ của nhóm tương ứng). Hệ số sử dụng lớn nhất ${tf(gvr.util, 3)} tại y = ${tf(gvr.y, 3)} m.`,
    ) +
    sTab(
      [
        'y (m)',
        'Z (m)',
        'h (mm)',
        'Số thanh hữu hiệu',
        'Mu (kN.m)',
        'Mr (kN.m)',
        'Mu / Mr',
        'Veff (kN)',
        'Vr (kN)',
        'Veff / Vr',
        'Kết quả',
      ],
      pick.map((p) => [
        tf(p.y, 3) + (p.grp >= 0 ? ` (N${p.grp + 1}${p.end ? ' - đầu' : ' - đủ'})` : ''),
        tf(p.Z, 3),
        tf(p.sec.h * 1e3, 0),
        tf(p.sec.n, 2),
        tf(p.Mu, 1),
        tf(p.Mr, 1),
        tf(p.Mu / Math.max(p.Mr, 1e-9), 3),
        tf(p.Veff, 1),
        tf(p.sh.Vr, 1),
        tf(p.Veff / Math.max(p.sh.Vr, 1e-9), 3),
        sOk(p.rM >= 1 && p.rV >= 1 && p.tOk),
      ]),
    );

  if (gvr !== base && gvr.util > base.util + 1e-9) {
    h +=
      sTx(`<b>Mặt cắt bất lợi nhất y = ${tf(gvr.y, 3)} m</b> (hệ số sử dụng ${tf(gvr.util, 3)}):`) +
      sRibRC(R, gvr, false);
  }

  const t2 = R.tie2;
  const t3 = R.tie3;
  h +=
    sH3(`${sec}.5. Thép ngang của sườn - giằng bản mặt vào sườn`) +
    sTx(
      `Phản lực của bản mặt truyền vào sườn qua các thanh ngang Φ${tf(RB.r2.d, 0)} đặt cách nhau a = ${tf((RB.r2.a ?? 0) * 10, 0)} mm theo chiều cao (hai thanh mỗi hàng, một thanh mỗi mặt sườn). Kiểm tra hàng thấp nhất (áp lực lớn nhất); tác dụng giằng và tác dụng chịu cắt kiểm tra riêng, không cộng.`,
    ) +
    sF(String.raw`T = \rho\,p_u\,a\ \le\ 0.9\,f_y\,A_{s,2}`) +
    sRow(
      'Cao độ hàng thanh thấp nhất ; độ sâu Z',
      'y ; Z',
      tf(t2.y, 3) + ' ; ' + tf(t2.Z, 3),
      'm',
    ) +
    sRow('Áp lực ngang tính toán tại hàng thanh', 'pu', tf(t2.pu, 2), 'kPa') +
    sRow('Lực kéo trong một hàng thanh giằng', 'T', tf(t2.T, 2), 'kN') +
    sRow('Sức kháng kéo của hai thanh 0,9.fy.2Ab', 'Tr', tf(t2.cap, 2), 'kN') +
    sRow('Kiểm tra T ≤ Tr', '', '', '', sOk(t2.ok)) +
    sKL(
      R.ok.rib && t2.ok,
      'Sườn ĐẠT YÊU CẦU về uốn, cốt thép tối thiểu, nứt, cắt và giằng.',
      'Sườn KHÔNG ĐẠT - cần tăng thép chủ, thép ngang hoặc bề dày sườn.',
    );
  sec++;

  const fs = R.toe;
  const T2 = R.toe2;
  const hl = R.heel;
  const hg = hl.gov;

  h +=
    sH2(`${sec}.&nbsp;&nbsp;KIỂM TOÁN BẢN ĐÁY BTCT - TCVN 11823-5`) +
    sTx(
      `Phản lực nền phân bố tuyến tính theo tải trọng tính toán (TCVN 11823-10, Điều 6.5): ${sFootPress(fs as never)}.`,
    ) +
    sH3(`${sec}.1. Mũi bản đáy (công xôn ngàm tại mép trước tường, h = ${tf(I.hm * 1e3, 0)} mm)`) +
    sTx(
      `Mũi nằm ngoài phạm vi sườn nên tính như công xôn: phản lực nền trên mũi trừ trọng lượng bản thân mũi (hệ số 0,9 - có lợi): ${[
        sKeyU(fs as never),
        sKeyE(fs as never),
      ]
        .filter((k): k is NonNullable<typeof k> => Boolean(k))
        .map((k) => {
          const entry = fs[k]!;
          return `${CD_LAB[k]} M = ${tf(entry.Mr, 2)} − ${tf(entry.Md, 2)} = ${tf(entry.M, 2)} kN.m, V = ${tf(entry.V, 2)} kN`;
        })
        .join('; ')}. Mômen dương gây kéo thớ dưới.`,
    ) +
    sRC(T2.Sx as never, M as never, T2.rc as never, ['thớ dưới', 'thớ trên']) +
    sH3(`${sec}.2. Gót bản đáy (dầm liên tục nằm ngang trên các sườn)`) +
    sTx(
      `Gót tính theo từng dải rộng 1 m theo phương vuông góc mặt tường, làm việc như dầm liên tục dọc theo chiều dài tường, tựa trên các sườn (cùng sơ đồ mục ${sec - 2}.1). Tải trọng của dải là tải trọng thẳng đứng trên gót (bản thân, đất đắp, tải chất thêm, hoạt tải) trừ phản lực nền: w = ΣγiQi − q(x), hướng xuống là dương. Hệ số nội lực lấy ở mục ${sec - 2}.3; kiểm tra tại ${hl.rows.length} mặt cắt từ mép sau tường đến mép gót, bản dày thay đổi theo mặt vát.`,
    ) +
    sTab(
      [
        'x (m)',
        'h (mm)',
        ...(['Ia', 'Ib', 'Ic', 'Ea', 'Eb'] as const)
          .filter((k) => hl.rows[0].w[k] != null)
          .map((k) => 'w ' + CD_LAB[k] + ' (kPa)'),
        'w SD I (kPa)',
      ],
      hl.rows.map((q) => [
        tf(q.x, 3),
        tf(q.t * 1e3, 0),
        ...(['Ia', 'Ib', 'Ic', 'Ea', 'Eb'] as const)
          .filter((k) => q.w[k] != null)
          .map((k) => tf(q.w[k], 2)),
        tf(q.w.SD, 2),
      ]),
    ) +
    sTab(
      [
        'x (m)',
        'M thớ dưới (kN.m)',
        'M thớ trên (kN.m)',
        ...(R.E ? ['M thớ dưới ĐB (kN.m)', 'M thớ trên ĐB (kN.m)'] : []),
        'Vu (kN)',
        'Hệ số sử dụng',
        'Kết quả',
      ],
      hl.rows.map((q) => [
        tf(q.x, 3),
        tf(q.Mbot, 2),
        tf(q.Mtop, 2),
        ...(R.E ? [tf(q.MbotE, 2), tf(q.MtopE, 2)] : []),
        tf(q.Vu, 2),
        tf(q.util, 3),
        sOk(q.ok),
      ]),
    ) +
    sTx(
      `<b>Mặt cắt bất lợi nhất: x = ${tf(hg.x, 3)} m (h = ${tf(hg.t * 1e3, 0)} mm).</b> Thép dọc tường của bản đáy Φ${tf(RB.l1.d, 0)} a ${tf((RB.l1.a ?? 0) * 10, 0)} mm (hai lớp, đặt trong lớp thép vuông góc mặt tường).`,
    ) +
    sRC(hg.S as never, M as never, hg.rc as never, ['thớ dưới', 'thớ trên']);

  if (!t3.na && RB.r3) {
    h +=
      sH3(`${sec}.3. Thép đứng của sườn - treo bản đáy vào sườn`) +
      sTx(
        `Tải trọng xuống trên gót truyền vào sườn qua các thanh đứng Φ${tf(RB.r3.d, 0)} đặt cách nhau a = ${tf((RB.r3.a ?? 0) * 10, 0)} mm dọc theo chiều dài sườn (hai thanh mỗi hàng). Lực kéo mỗi hàng T = ρ.wmax.a với wmax là tải xuống lớn nhất (các tổ hợp cường độ) trên phần gót có sườn.`,
      ) +
      sRow('Tải xuống lớn nhất trên gót', 'wmax', tf(t3.w, 2), 'kPa') +
      sRow('Lực kéo trong một hàng thanh', 'T', tf(t3.T, 2), 'kN') +
      sRow('Sức kháng kéo của hai thanh 0,9.fy.2Ab', 'Tr', tf(t3.cap, 2), 'kN') +
      sRow('Kiểm tra T ≤ Tr', '', '', '', sOk(t3.ok));
  }

  h += sKL(
    R.ok.toe && R.ok.heel && t3.ok,
    'Bản đáy ĐẠT YÊU CẦU.',
    'Bản đáy KHÔNG ĐẠT - cần tăng chiều dày hoặc cốt thép.',
  );
  sec++;

  const sk = R.shk;
  const bh = g.Hst * 1e3;
  const tm = g.tmean * 1e3;
  const Lu = r.Lu * 1e3;
  const hm = I.hm * 1e3;
  const shRow = (
    nm: string,
    v: { As: number; req: number; s: number; smax: number; ok: boolean },
    b: number,
    hh: number,
    oo: { d: number; a?: number },
  ) => [
    nm,
    tf(b, 0) + ' ; ' + tf(hh, 0),
    `Φ${tf(oo.d, 0)} a ${tf((oo.a ?? 0) * 10, 0)}`,
    tf(v.As, 3),
    tf(v.req, 3),
    tf(v.s, 0) + ' ; ' + tf(v.smax, 0),
    sOk(v.ok),
  ];

  h +=
    sH2(`${sec}.&nbsp;&nbsp;CỐT THÉP CHỐNG CO NGÓT VÀ NHIỆT ĐỘ - TCVN 11823-5, ĐIỀU 10.8`) +
    sF(
      String.raw`A_s \ge \dfrac{0.75\,b\,h}{2\,(b + h)\,f_y}\ ;\quad 0.233 \le A_s \le 1.27\ (\text{mm}^2/\text{mm})\ ;\quad s \le \min(3h\ ;\ 450\ \text{mm})`,
    ) +
    sTx(
      'b là kích thước của mặt cắt vuông góc với phương thanh thép (cạnh dài của bộ phận), h là bề dày. Mỗi thanh kiểm tra cho một mặt.',
    ) +
    sTab(
      [
        'Bộ phận',
        'b ; h (mm)',
        'Cốt thép mỗi mặt',
        'As (mm²/mm)',
        'As yêu cầu (mm²/mm)',
        's ; smax (mm)',
        'Kết quả',
      ],
      [
        shRow('Bản mặt - thép ngang', sk.h1, bh, tm, RB.h1),
        shRow('Bản mặt - thép đứng mặt trước', sk.s2, Lu, tm, RB.s2),
        shRow('Bản mặt - thép đứng mặt sau', sk.s1, Lu, tm, RB.s1),
        shRow('Bản đáy - thép dọc tường', sk.l1, g.B * 1e3, hm, RB.l1),
        shRow('Bản đáy - thép vuông góc mặt tường (lớp trên)', sk.b2, Lu, hm, RB.b2),
      ],
    ) +
    sKL(
      R.ok.sh,
      'Cốt thép phân bố ĐẠT YÊU CẦU.',
      'Cốt thép phân bố KHÔNG ĐẠT - cần tăng đường kính hoặc giảm khoảng cách.',
    );
  sec++;

  if (R.fe && !R.fe.err) {
    const oFE = calcFeSheet(P, R, sec);
    h += oFE.h;
    sec = oFE.sec;
  }
  {
    const oFem = calcFemSheet(P, R, sec);
    h += oFem.h;
    sec = oFem.sec;
  }
  {
    const oGs = calcGsSheet(P, R, sec);
    h += oGs.h;
    sec = oGs.sec;
  }
  {
    const oRb = calcRbSheet(P, R, sec);
    h += oRb.h;
    sec = oRb.sec;
  }

  h +=
    sH2(`${sec}.&nbsp;&nbsp;GIẢ THIẾT TÍNH TOÁN VÀ CÁC KIỂM TRA KHÁC`) +
    sTx(
      '- Ổn định tổng thể, trượt, lệch tâm, sức kháng nền tính cho 1 m dài tường, trọng lượng sườn quy đều theo chiều dài tường (hệ số ψ), khối đất bị sườn chiếm chỗ trừ khỏi EV.',
    ) +
    sTx(
      '- Bản mặt tường tính một phương theo phương ngang (dầm liên tục trên các sườn); không kể uốn theo phương đứng giữa bản đáy và đỉnh sườn, không kể mômen xoắn và sự làm việc không gian của bản mặt với bản đáy.',
    ) +
    sTx(
      '- Phản lực của dầm liên tục lấy theo sườn chịu phản lực lớn nhất cho mọi sườn; mặt cắt chữ T của sườn có bản cánh là bản mặt tường, vùng nén nằm trong bản cánh.',
    ) +
    sTx(
      '- Neo thép chủ của sườn vào bản đáy và nối thép giữa sườn, bản mặt, bản đáy theo cấu tạo bản vẽ, chưa tính ma sát cắt tại mối nối sườn - bản đáy.',
    ) +
    sTx(
      '- Bỏ qua sức kháng bị động của đất trước mũi' +
        (P.tpl === 'C' ? ' và của chân khay' : '') +
        ' (thiên về an toàn).' +
        (() => {
          const ms = [
            !R.W ? 'áp lực nước, thấm' : '',
            !R.slope && !calcGsOut(P) ? 'ổn định tổng thể mái dốc' : '',
            !R.E ? 'động đất' : '',
          ].filter(Boolean);
          return ms.length ? ' Chưa xét ' + ms.join(', ') + '.' : '';
        })(),
    ) +
    (R.W
      ? sTx(
          '- Nước ngầm: áp lực nước lên bản mặt tường tính thủy tĩnh (sau lưng trừ phía trước); lực đẩy ngược dưới đáy bản đáy lấy theo mục 4; hệ thống thoát nước sau lưng tường (nếu có) không được kể là làm giảm mực nước.',
        )
      : '') +
    (R.E
      ? sTx(
          '- Động đất: giả tĩnh; lực quán tính của sườn và bản mặt kể vào nội lực của bản mặt/sườn; kết cấu kiểm tra ở tổ hợp Đặc biệt I với φ = 1,0 (TCVN 11823-5).',
        )
      : '') +
    sTx(
      '- Khe biến dạng chia tường thành các đơn vị độc lập; kết quả tính cho một đơn vị đại diện.',
    );
  sec++;

  const SUM: Array<[string, string, boolean | string]> = [
    ['Độ lệch tâm của hợp lực', 'TCVN 11823-11, Điều 6.3.3', R.ok.e],
    ['Trượt theo đáy móng', 'TCVN 11823-10, Điều 6.3.4', R.ok.sl],
    ['Sức kháng đỡ của nền', 'TCVN 11823-10, Điều 6.3.1, 6.3.2', R.ok.br],
    ...(R.an && !R.an.dw
      ? [['Chiều dài neo thép vào đá', 'TCVN 11823-5, Điều 11.2.1.1', Boolean(R.ok.an)] as [string, string, boolean]]
      : []),
    ...calcExtSum(R),
    ['Bản mặt tường: uốn, cốt thép tối thiểu, nứt, cắt', 'TCVN 11823-5, Điều 7.3, 8.3', R.ok.stem],
    ['Sườn - thép chủ: uốn, cốt thép tối thiểu, nứt, cắt', 'TCVN 11823-5, Điều 7.3, 8.3', R.ok.rib],
    ['Sườn - thép giằng ngang và thép đứng (kéo)', 'TCVN 11823-5, Điều 5.4.2', R.ok.tie],
    ['Bản đáy - mũi: uốn, cốt thép tối thiểu, nứt, cắt', 'TCVN 11823-5, Điều 7.3, 8.3', R.ok.toe],
    ['Bản đáy - gót: uốn, cốt thép tối thiểu, nứt, cắt', 'TCVN 11823-5, Điều 7.3, 8.3', R.ok.heel],
    ['Cốt thép co ngót và nhiệt độ', 'TCVN 11823-5, Điều 10.8', R.ok.sh],
  ];

  h +=
    sH2(`${sec}.&nbsp;&nbsp;TỔNG HỢP KẾT QUẢ KIỂM TOÁN`) +
    sTab(
      ['STT', 'Hạng mục kiểm toán', 'Căn cứ', 'Kết quả'],
      SUM.map((q, i) => [
        String(i + 1),
        q[0],
        q[1],
        typeof q[2] === 'boolean' ? sOk(q[2]) : q[2],
      ]),
      ['c', 'l', 'l', 'c'],
    ) +
    `<p class="kl ${R.ok.all ? 'ok' : 'bad'}">KẾT LUẬN CHUNG: ${R.ok.all ? 'TƯỜNG CHẮN ĐẠT YÊU CẦU THEO TẤT CẢ CÁC HẠNG MỤC KIỂM TOÁN.' : 'TƯỜNG CHẮN KHÔNG ĐẠT - XEM CÁC HẠNG MỤC KHÔNG ĐẠT Ở BẢNG TRÊN.'}</p>`;

  return h;
}
