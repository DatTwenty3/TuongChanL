// @ts-nocheck
/**
 * Bản quá độ — 7 hình minh hoạ SVG (Hình 1–7: `#dgQdSec`, `#dgQdLd`, `#dgQdVeh`, `#dgQdLL`, `#dgQdW`, `#dgQdM`, `#dgQdX`).
 *
 * Chuyển NGUYÊN VĂN từ `analysis-cau-cong/modules/07_approach_slab_and_culvert_soil.js` (`qdFigs` + các hàm vẽ
 * `qT/qL/qDH/qDV/qDVh/qAr/qHat/qPin/qRol/qSlab/qCorbel/qGround/qdSvg`); bản dựng lại trước đây thiếu hàm này nên
 * mục "Bản quá độ" hiện các khung hình trống. Chỉ đổi phần tham chiếu biến toàn cục (`MOR`, `mdOn`, `num`) sang import.
 * Đối chiếu từng ký tự SVG với bản gốc ở `tests/culvert/engine/approach_figs.test.ts`.
 * Giữ `@ts-nocheck` có chủ ý để mã vẽ không bị viết lại (rủi ro lệch hình); đừng "dọn" kiểu mà không chạy test đó.
 */

import { $, num } from '../context.ts';
import { getLatestMorResult, mdOn, moInputs } from './abutmentHeavy.ts';
import { QD } from './approachSlab.ts';

const qf = (x, d = 2) => {
  if (!isFinite(x)) return '-';
  const [i, f] = (+x).toFixed(d).split('.');
  return i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (f ? '.' + f : '');
};

function qdSvg(id, W, H, body) {
  const sv = $(id);
  if (!sv) return;
  sv.setAttribute("viewBox", `0 0 ${W} ${H}`);
  sv.setAttribute("width", W);
  sv.setAttribute("height", H);
  sv.innerHTML =
    `<defs><marker id="${id}A" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,1.5 L10,5 L0,8.5 z" fill="#c00000"/></marker><marker id="${id}K" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,1.5 L10,5 L0,8.5 z" fill="#222"/></marker><pattern id="${id}H" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M0,7 L7,0" stroke="#8a8a8a" stroke-width="0.6"/></pattern><pattern id="${id}S" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="0.9" fill="#a08050"/><circle cx="9" cy="9" r="0.9" fill="#a08050"/></pattern></defs>` +
    body;
}
const qT = (x, y, t, o) => {
  o = o || {};
  return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${o.fs || 12}"${o.a ? ` text-anchor="${o.a}"` : ""} fill="${o.c || "#111"}"${o.b ? ` font-weight="bold"` : ""}${o.i ? ` font-style="italic"` : ""}${o.rot ? ` transform="rotate(${o.rot} ${x.toFixed(1)} ${y.toFixed(1)})"` : ""} style="paint-order:stroke" stroke="#fff" stroke-width="3" stroke-linejoin="round">${t}</text>`;
};
const qL = (x1, y1, x2, y2, st) =>
  `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" ${st || 'stroke="#222" stroke-width="1"'}/>`;
const qDH = (x1, x2, y, t) =>
  qL(x1 - 4, y, x2 + 4, y, 'stroke="#333" stroke-width="0.7"') +
  [x1, x2]
    .map((x) => qL(x - 3.5, y + 3.5, x + 3.5, y - 3.5, 'stroke="#222" stroke-width="1.1"'))
    .join("") +
  qT((x1 + x2) / 2, y - 4, t, { a: "middle", fs: 11 });
const qDV = (y1, y2, x, t) =>
  qL(x, y1 - 4, x, y2 + 4, 'stroke="#333" stroke-width="0.7"') +
  [y1, y2]
    .map((y) => qL(x - 3.5, y + 3.5, x + 3.5, y - 3.5, 'stroke="#222" stroke-width="1.1"'))
    .join("") +
  qT(x - 5, (y1 + y2) / 2, t, { a: "middle", fs: 11, rot: -90 });

// ===== HÌNH MINH HOẠ BẢN QUÁ ĐỘ - bám theo các hình trong bảng tính Excel của công ty =====
// vạch kích thước đứng, chữ nằm ngang bên trái (kiểu Excel: had, hs, ts)
const qDVh = (y1, y2, x, t, side) => {
  const r = side === "r";
  return (
    qL(x, y1 - 4, x, y2 + 4, 'stroke="#333" stroke-width="0.7"') +
    [y1, y2]
      .map((y) => qL(x - 3.5, y + 3.5, x + 3.5, y - 3.5, 'stroke="#222" stroke-width="1.1"'))
      .join("") +
    qL(x - 12, y1, x + 12, y1, 'stroke="#999" stroke-width="0.5"') +
    qL(x - 12, y2, x + 12, y2, 'stroke="#999" stroke-width="0.5"') +
    qT(r ? x + 8 : x - 8, (y1 + y2) / 2 + 4, t, { a: r ? "start" : "end", fs: 11 })
  );
};
const qAr = (x1, y1, x2, y2, c, w) =>
  qL(
    x1,
    y1,
    x2,
    y2,
    `stroke="${c || "#c00000"}" stroke-width="${w || 1}" marker-end="url(#${c && c !== "#c00000" ? "__K" : "__A"})"`,
  );
// biểu đồ gạch đứng (kiểu Excel): f(x) giá trị, k px/đơn vị, vẽ xuống dưới khi dương
function qHat(X, xa, xb, y0, f, k, col) {
  let s = "",
    n = 80,
    pts = [];
  for (let i = 0; i <= n; i++) {
    const x = xa + ((xb - xa) * i) / n;
    pts.push(X(x).toFixed(1) + "," + (y0 + f(x) * k).toFixed(1));
  }
  const N = Math.max(4, Math.round((X(xb) - X(xa)) / 9));
  for (let i = 0; i <= N; i++) {
    const x = xa + ((xb - xa) * i) / N;
    s += qL(X(x), y0, X(x), y0 + f(x) * k, `stroke="${col}" stroke-width="0.6"`);
  }
  return (
    s +
    `<polyline points="${pts.join(" ")}" fill="none" stroke="${col}" stroke-width="1.4"/>` +
    qL(X(xa), y0, X(xb), y0, 'stroke="#222" stroke-width="0.9"')
  );
}
// gối cố định / di động có gạch đất
const qPin = (x, y) =>
  `<polygon points="${x},${y} ${x - 8},${y + 13} ${x + 8},${y + 13}" fill="#fff" stroke="#222" stroke-width="1.1"/>` +
  qL(x - 13, y + 14, x + 13, y + 14, 'stroke="#222"') +
  [0, 1, 2, 3, 4, 5]
    .map((i) =>
      qL(x - 12 + i * 5, y + 14, x - 15 + i * 5, y + 18, 'stroke="#222" stroke-width="0.6"'),
    )
    .join("");
const qRol = (x, y) =>
  `<circle cx="${x}" cy="${y + 7}" r="7" fill="#fff" stroke="#222" stroke-width="1.1"/>` +
  qL(x - 13, y + 14, x + 13, y + 14, 'stroke="#222"') +
  [0, 1, 2, 3, 4, 5]
    .map((i) =>
      qL(x - 12 + i * 5, y + 14, x - 15 + i * 5, y + 18, 'stroke="#222" stroke-width="0.6"'),
    )
    .join("");
// hình dạng bản quá độ theo Excel: đầu trái kê lên vai kê mố (Lc), đầu phải có dầm tăng cường Hh (L1 vát, L2 phẳng)
function qSlab(X, yS, ts, Hh, G, fill) {
  const L = G.L,
    xa = X(L - G.L2 - G.L1),
    xb = X(L - G.L2),
    th = Hh > ts + 1;
  const pts = th
    ? [
        [X(0), yS],
        [X(L), yS],
        [X(L), yS + Hh],
        [xb, yS + Hh],
        [xa, yS + ts],
        [X(0), yS + ts],
      ]
    : [
        [X(0), yS],
        [X(L), yS],
        [X(L), yS + ts],
        [X(0), yS + ts],
      ];
  return `<polygon points="${pts.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ")}" fill="${fill || "url(#__H)"}" stroke="#222" stroke-width="1.4"/>`;
}
function qCorbel(X, yS, ts, G, yEnd) {
  const xc = X(G.Lc),
    y1 = yS + ts;
  return `<polyline points="${xc},${y1} ${xc},${y1 + 18} ${X(0)},${y1 + 44} ${X(0)},${yEnd}" fill="none" stroke="#222" stroke-width="1.3"/>`;
}
const qGround = (x, y) =>
  [0, 1, 2, 3, 4]
    .map((i) => qL(x + i * 8, y + 10, x + i * 8 + 9, y, 'stroke="#444" stroke-width="0.8"'))
    .join("");
export function qdFigs(R) {
  const I = R.I,
    G = { L: I.L, Lc: I.Lc, L1: I.L1, L2: I.L2 },
    Hh = Math.max(I.Hh || 0, I.h);
  const fix = (id, s) =>
    s
      .replace(/__A/g, id + "A")
      .replace(/__H/g, id + "H")
      .replace(/__S/g, id + "S")
      .replace(/__K/g, id + "K");
  // ---------- Hình 1: cấu tạo bản quá độ kê lên gờ mố (theo loại mố) + mô hình tính toán ----------
  {
    const id = "dgQdSec",
      W = 760,
      L = I.L,
      h = I.h,
      hg = I.hg,
      ii = I.i,
      deo = mdOn();
    let M = {};
    try {
      M = moInputs();
    } catch (e) {}
    const G0 = getLatestMorResult()?.geo ?? null,
      nz = (v, d) => (isFinite(v) && v > 0 ? v : d);
    const t = nz(M.t, 0.4),
      jtm = nz(M.jtm, 1.5),
      d9 = nz(M.d9, 0.3),
      d2 = nz(M.d2, 0.3),
      d2b = isFinite(M.d2b) ? M.d2b : 0.2,
      a = nz(M.a, 1.2),
      dB = nz(M.d, 2),
      B1 = nz(M.b, deo ? 2 : 5),
      g = nz(M.g, 0.35),
      D = (num("D") / 1000) || 1;
    const xw2 = G0 ? G0.xw2 : 0,
      xw1 = G0 ? G0.xw1 : xw2 + a,
      xb = G0 ? G0.xb : xw2 + t + g,
      ub = xw2 - xb,
      hbg = M.goi === "K" ? Math.max(0.02, M.hbg || 0.02) : nz(M.hbg, 0.1) + nz(M.dkh, 0.15);
    const zEnd = hg + ii * L + Math.max(Hh, h),
      zLow = -(Math.max(zEnd, jtm + (deo ? Math.min(dB, 1.2) : 0.9)) + 0.35);
    const umin = Math.min(-t, ub) - 1.0,
      umax = L + 0.95,
      sc = Math.min(600 / (umax - umin), 130),
      X = (u) => 110 + (u - umin) * sc,
      y0 = 74,
      Y = (z) => y0 - z * sc;
    const P = (pts, st) =>
      `<polygon points="${pts.map((q) => X(q[0]).toFixed(1) + "," + Y(q[1]).toFixed(1)).join(" ")}" ${st}/>`;
    const conc = 'fill="#dde6ee" stroke="#111" stroke-width="1.5"';
    let s = `<defs><clipPath id="${id}C"><rect x="0" y="0" width="${W}" height="${Y(zLow).toFixed(1)}"/></clipPath></defs>`;
    const yLow = Y(zLow),
      brk = (u1, u2) => {
        const xa = X(u1) - 6,
          xc = X(u2) + 6,
          xm = (xa + xc) / 2;
        return `<polyline points="${xa},${yLow} ${xm - 6},${yLow} ${xm - 2},${yLow - 8} ${xm + 2},${yLow + 8} ${xm + 6},${yLow} ${xc},${yLow}" fill="none" stroke="#111" stroke-width="1"/>`;
      };
    // đất đắp sau mố và kết cấu áo đường
    s += P(
      [
        [0, -(I.h1n + I.h2n)],
        [umax, -(I.h1n + I.h2n)],
        [umax, zLow],
        [0, zLow],
      ],
      'fill="#f1e7cf" stroke="none"',
    );
    s +=
      P(
        [
          [-t, 0],
          [umax, 0],
          [umax, -I.h1n],
          [-t, -I.h1n],
        ],
        'fill="#bdbdbd" stroke="#555" stroke-width="0.6"',
      ) +
      P(
        [
          [0, -I.h1n],
          [umax, -I.h1n],
          [umax, -I.h1 - I.h2],
          [0, -I.h1 - I.h2],
        ],
        'fill="url(#__S)" stroke="#555" stroke-width="0.6"',
      );
    // kết cấu mố (cắt tại cao độ zLow)
    let sub = "";
    if (deo) {
      const uc1 = xw2 - B1 / 2,
        uc2 = xw2 + B1 / 2,
        zc = -jtm; // bệ mố dẻo dưới tường đỉnh, cọc tại tim bệ
      sub +=
        P(
          [
            [uc1, zc],
            [uc2, zc],
            [uc2, zc - dB],
            [uc1, zc - dB],
          ],
          conc,
        ) +
        P(
          [
            [-D / 2, zc - dB],
            [D / 2, zc - dB],
            [D / 2, zc - dB - 1.5],
            [-D / 2, zc - dB - 1.5],
          ].map((q) => [xw2 + q[0], q[1]]),
          'fill="#eee" stroke="#111" stroke-width="1.2"',
        );
      sub += P(
        [
          [ub - 0.3, zc],
          [ub + 0.3, zc],
          [ub + 0.3, zc + hbg],
          [ub - 0.3, zc + hbg],
        ],
        'fill="#bbb" stroke="#111"',
      );
    } else {
      const ua = xw2 - xw1; // tường thân mố nặng, tường đỉnh đặt trên phần sau tường thân
      sub +=
        P(
          [
            [ua, -jtm],
            [ua + a, -jtm],
            [ua + a, zLow - 1],
            [ua, zLow - 1],
          ],
          conc,
        ) +
        P(
          [
            [ub - 0.3, -jtm],
            [ub + 0.3, -jtm],
            [ub + 0.3, -jtm + hbg],
            [ub - 0.3, -jtm + hbg],
          ],
          'fill="#bbb" stroke="#111"',
        );
    }
    sub +=
      P(
        [
          [-t, 0],
          [0, 0],
          [0, -jtm],
          [-t, -jtm],
        ],
        conc,
      ) +
      P(
        [
          [0, -hg],
          [d9, -hg],
          [d9, -hg - d2],
          [0, -hg - d2 - d2b],
        ],
        conc,
      );
    // dầm chủ kê trên gối
    const zg = -jtm + hbg,
      ugr = -t - 0.05;
    sub += P(
      [
        [umin, -0.02],
        [ugr, -0.02],
        [ugr, zg],
        [umin, zg],
      ],
      'fill="#e8e8e8" stroke="#111" stroke-width="1.2"',
    );
    s += `<g clip-path="url(#${id}C)">${sub}</g>`;
    s += deo
      ? brk(xw2 - B1 / 2, xw2 + B1 / 2) +
        (zLow > -jtm - dB - 1.5 ? brk(xw2 - D / 2, xw2 + D / 2) : "")
      : brk(xw2 - xw1, xw2 - xw1 + a);
    // bản quá độ dốc i: đáy đầu bản tựa lên gờ, đỉnh gờ cố định sâu hg dưới đỉnh tường đỉnh (bản có thể lấn vào kết cấu áo đường)
    const zt = (u) => -hg + h - ii * u,
      sl = [
        [0, 0],
        [L, 0],
      ]
        .concat(
          Hh > h + 1e-6
            ? [
                [L, Hh],
                [L - I.L2, Hh],
                [L - I.L2 - I.L1, h],
              ]
            : [[L, h]],
        )
        .concat([[0, h]]);
    s += P(
      sl.map((q) => [q[0], zt(q[0]) - q[1]]),
      'fill="url(#__H)" stroke="#111" stroke-width="1.6"',
    );
    // ghi chú
    s +=
      qT(X(L * 0.55), Y(zt(L * 0.55) - h / 2) + 4, "Bản quá độ BTCT", {
        a: "middle",
        fs: 12,
        b: true,
      }) +
      (-(I.h1n + I.h2n) - zt(L * 0.72) > 0.15
        ? qT(X(L * 0.72), (Y(-(I.h1n + I.h2n)) + Y(zt(L * 0.72))) / 2 + 4, "Đất đắp", {
            a: "middle",
            fs: 11,
            i: true,
          })
        : "") +
      qT(X(L * 0.8), Y(-I.h1n / 2) + 4, "Kết cấu áo đường", { a: "middle", fs: 10 });
    s +=
      qL(
        X(d9 / 2),
        Y(-hg - d2 / 2),
        X(d9) + 40,
        Y(-hg - d2 / 2) + 34,
        'stroke="#444" stroke-width="0.7"',
      ) +
      qT(X(d9) + 42, Y(-hg - d2 / 2) + 38, deo ? "Mấu đỡ bản quá độ" : "Vai kê bản quá độ", {
        fs: 11,
      });
    s +=
      qT(X(-t / 2), Y(-jtm / 2) + 4, "Tường đỉnh", { a: "middle", fs: 10, rot: -90 }) +
      qT(X((umin + ugr) / 2), Y(zg / 2) + 4, "Dầm chủ", { a: "middle", fs: 11 });
    s += deo
      ? qT(X(xw2), Y(-jtm - Math.min(dB, -zLow - jtm) / 2) + 4, "Bệ mố", {
          a: "middle",
          fs: 11,
          b: true,
        })
      : qT(X(xw2 - xw1 + a / 2), Y((zLow - jtm) / 2) + 4, "Tường thân", {
          a: "middle",
          fs: 11,
          b: true,
        });
    // độ dốc
    {
      const u1 = L * 0.25,
        u2 = L * 0.45,
        zz = (u) => zt(u) + 0.12;
      s +=
        qL(
          X(u1),
          Y(zz(u1)),
          X(u2),
          Y(zz(u2)),
          'stroke="#c00000" stroke-width="1.2" marker-end="url(#__A)"',
        ) + qT(X(u1), Y(zz(u1)) - 6, `i = ${qf(I.ip, 1)}%`, { fs: 12, b: true, c: "#c00000" });
    }
    // kích thước
    const yd = Y(0) - 30;
    s +=
      qDH(X(0), X(L), yd, "Lts = " + qf(L, 2)) +
      qL(X(0), yd - 6, X(0), Y(0), 'stroke="#888" stroke-width="0.5"') +
      qL(X(L), yd - 6, X(L), Y(zt(L)), 'stroke="#888" stroke-width="0.5"');
    {
      const xl = X(umin) - 14;
      s +=
        qL(
          xl - 8,
          Y(-hg),
          X(d9),
          Y(-hg),
          'stroke="#c00000" stroke-width="0.6" stroke-dasharray="4 3"',
        ) +
        qL(xl - 8, Y(0), X(umin), Y(0), 'stroke="#999" stroke-width="0.5"') +
        qL(
          xl - 8,
          Y(-hg - d2 - d2b),
          X(0),
          Y(-hg - d2 - d2b),
          'stroke="#999" stroke-width="0.5" stroke-dasharray="3 3"',
        ) +
        qDVh(Y(0), Y(-hg), xl, `hg = ${qf(hg, 2)}`);
      s += qDVh(Y(-hg), Y(-hg - d2 - d2b), xl, deo ? "H9+H10" : "hvk");
    }
    {
      const xr = X(L) + 30;
      s += qDVh(Y(0), Y(zt(L)), xr, `HL = ${qf(I.HcE, 2)}`, "r");
      if (Hh > h + 1e-6) s += qDVh(Y(zt(L)), Y(zt(L) - Hh), xr + 0, `Hh = ${qf(Hh, 2)}`, "r");
    }
    s += qDH(X(0), X(I.Lc), Y(-hg - d2 - d2b) + 16, "Lc");
    // mô hình tính toán
    const yM = yLow + 56,
      xa = X(I.Lc),
      xc = X(I.Lc + R.Ltt),
      xm = X(I.xm);
    s +=
      qT(30, yM - 24, "Mô hình tính toán:", { fs: 12, b: true }) +
      qL(X(0), yM, X(L), yM, 'stroke="#111" stroke-width="3"') +
      qPin(xa, yM) +
      qRol(xc, yM);
    s +=
      qL(xm, yM - 14, xm, yM + 28, 'stroke="#c00000" stroke-width="0.8" stroke-dasharray="4 3"') +
      qT(xm + 4, yM - 16, "x = Lc + Ltt/2 (lấy hs)", { fs: 10, c: "#c00000" });
    const yDm = yM + 48;
    [
      [0, I.Lc, "Lc"],
      [I.Lc, I.Lc + R.Ltt, "Ltt = k.Lts"],
    ].forEach((c) => {
      s +=
        qL(X(c[0]), yDm - 10, X(c[0]), yDm + 4, 'stroke="#666" stroke-width="0.6"') +
        qL(X(c[1]), yDm - 10, X(c[1]), yDm + 4, 'stroke="#666" stroke-width="0.6"') +
        qDH(X(c[0]), X(c[1]), yDm, c[2]);
    });
    const v1 = [
      `Loại mố: ${deo ? "mố dẻo" : "mố nặng"}`,
      `hg = ${qf(hg, 2)} m (cố định)`,
      `i = ${qf(I.ip, 1)}%`,
      `Lts = ${qf(L, 2)} m`,
      `ts = ${qf(h, 2)} m`,
      `Lc = ${qf(I.Lc, 2)} m`,
      `Ltt = ${qf(R.Ltt, 3)} m`,
    ];
    const v2 = [
      `H0 = hg − ts = ${qf(I.Hc0, 3)} m`,
      `HL = H0 + i.Lts = ${qf(I.HcE, 3)} m`,
      `had = ${qf(I.h1n + I.h2n, 2)} m`,
      `hs = ${qf(I.hs, 3)} m`,
    ].concat(Hh > h + 1e-6 ? [`Hh = ${qf(Hh, 2)} m`] : []);
    const H = yDm + 52;
    s +=
      qT(W / 2, yDm + 26, v1.join(" ;  "), { a: "middle", fs: 11, c: "#0050b0" }) +
      qT(W / 2, yDm + 44, v2.join(" ;  "), { a: "middle", fs: 11, c: "#0050b0" });
    s += qT(
      W / 2,
      20,
      "CẤU TẠO BẢN QUÁ ĐỘ KÊ LÊN " +
        (deo ? "MẤU ĐỠ MỐ DẺO" : "VAI KÊ MỐ NẶNG") +
        " VÀ MÔ HÌNH TÍNH TOÁN",
      { a: "middle", fs: 13, b: true },
    );
    qdSvg(id, W, H, fix(id, s).replace(/__C/g, id + "C"));
  }
  // ---------- Hình 2: tải trọng tác dụng lên bản (Excel mục 4) ----------
  {
    const id = "dgQdLd",
      W = 760,
      H = 270,
      L = I.L,
      sc = 470 / L,
      X = (x) => 150 + x * sc,
      yR = 118,
      yS = 176,
      pT = 30,
      pH = Hh > I.h ? 46 : 30;
    let s = "";
    const xa = X(L * 0.3),
      xb = X(L * 0.62);
    s += qL(xa, 62, xb, 62, 'stroke="#c00000"');
    for (let i = 0; i <= 10; i++) {
      const x = xa + ((xb - xa) * i) / 10;
      s += qAr(x, 62, x, 82);
    }
    s += qL(X(L * 0.14), 88, X(L * 0.86), 88, 'stroke="#c00000"');
    for (let i = 0; i <= 14; i++) {
      const x = X(L * 0.14) + ((X(L * 0.86) - X(L * 0.14)) * i) / 14;
      s += qAr(x, 88, x, yR - 3);
    }
    s +=
      qT(xa - 8, 60, "Áp lực bánh xe", { a: "end", fs: 12 }) +
      qT(X(L * 0.14) - 8, 90, "LL, EV", { a: "end", fs: 12 });
    s +=
      `<rect x="${X(-0.2)}" y="${yR}" width="${(L + 0.4) * sc}" height="16" fill="url(#__S)" stroke="none"/>` +
      qL(X(-0.2), yR, X(L + 0.2), yR, 'stroke="#111" stroke-width="3"');
    s +=
      qL(X(L * 0.9), yR, X(L * 0.97), yR - 26, 'stroke="#444" stroke-width="0.7"') +
      qT(X(L * 0.97) + 2, yR - 28, "Mặt đường", { fs: 12 });
    for (let i = 0; i <= 14; i++) {
      const x = X(L * 0.14) + ((X(L * 0.86) - X(L * 0.14)) * i) / 14;
      s += qAr(x, yR + 20, x, yS - 3);
    }
    s +=
      qSlab(X, yS, pT, pH, G, "#fff") +
      qCorbel(X, yS, pT, G, H - 14) +
      qT(X(L * 0.45), yS + pT / 2 + 5, "Bản quá độ", { a: "middle", fs: 12, b: true });
    s += qT(W / 2, 20, "TẢI TRỌNG TÁC DỤNG LÊN BẢN QUÁ ĐỘ (DẢI RỘNG 1 m)", {
      a: "middle",
      fs: 13,
      b: true,
    });
    qdSvg(id, W, H, fix(id, s));
  }
  // ---------- Hình 3: hoạt tải HL-93 ----------
  {
    const id = "dgQdVeh",
      W = 760,
      H = 370;
    let s = "";
    const box = (x, y, t) =>
      `<rect x="${x}" y="${y}" width="${t.length * 7 + 20}" height="22" fill="#fff" stroke="#222"/>` +
      qT(x + 10, y + 16, t, { fs: 12 });
    const wheel = (x, y) =>
      `<circle cx="${x}" cy="${y}" r="14" fill="#333"/><circle cx="${x}" cy="${y}" r="6" fill="#ddd"/>`;
    const yG = 168,
      yW = yG - 14;
    // xe tải
    const a1 = 95,
      a2 = 255,
      a3 = 415;
    s += box(190, 30, "Xe tải thiết kế");
    s += `<path d="M62,${yW} L62,${yW - 38} L74,${yW - 62} L118,${yW - 62} L118,${yW}" fill="#fff" stroke="#222" stroke-width="1.3"/><rect x="78" y="${yW - 56}" width="32" height="18" fill="#fff" stroke="#222"/>`;
    s +=
      `<rect x="126" y="${yW - 76}" width="330" height="64" fill="#fff" stroke="#222" stroke-width="1.3"/>` +
      [0, 1, 2, 3, 4, 5, 6]
        .map((i) =>
          qL(132, yW - 68 + i * 8, 450, yW - 68 + i * 8, 'stroke="#999" stroke-width="0.8"'),
        )
        .join("");
    s +=
      qL(62, yW, 456, yW, 'stroke="#222" stroke-width="1.3"') +
      wheel(a1, yW) +
      wheel(a2, yW) +
      wheel(a3, yW);
    s +=
      qL(40, yG, 480, yG, 'stroke="#222" stroke-width="1.2"') +
      `<rect x="40" y="${yG}" width="440" height="5" fill="url(#__S)"/>`;
    [a1, a2, a3].forEach((x, i) => {
      s +=
        qL(x, yG + 4, x, yG + 30, 'stroke="#999" stroke-width="0.6"') +
        qAr(x, yG + 34, x, yG + 60, "#222", 1.4) +
        qT(x, yG + 76, ["P1 = 35 kN", "P2 = 145 kN", "P3 = 145 kN"][i], {
          a: "middle",
          fs: 11,
          b: true,
        });
    });
    s += qDH(a1, a2, yG + 24, "4,3 m") + qDH(a2, a3, yG + 24, "4,3 ÷ 9,0 m (dùng 4,3 m)");
    // xe hai trục
    const b1 = 575,
      b2 = 695;
    s += box(580, 30, "Xe hai trục thiết kế");
    s += `<path d="M540,${yW} L540,${yW - 38} L552,${yW - 62} L596,${yW - 62} L596,${yW}" fill="#fff" stroke="#222" stroke-width="1.3"/><rect x="556" y="${yW - 56}" width="32" height="18" fill="#fff" stroke="#222"/>`;
    s +=
      `<rect x="600" y="${yW - 30}" width="125" height="18" fill="#fff" stroke="#222" stroke-width="1.3"/>` +
      qL(540, yW, 725, yW, 'stroke="#222" stroke-width="1.3"') +
      wheel(b1, yW) +
      wheel(b2, yW);
    s +=
      qL(525, yG, 740, yG, 'stroke="#222" stroke-width="1.2"') +
      `<rect x="525" y="${yG}" width="215" height="5" fill="url(#__S)"/>`;
    [b1, b2].forEach((x, i) => {
      s +=
        qL(x, yG + 4, x, yG + 30, 'stroke="#999" stroke-width="0.6"') +
        qAr(x, yG + 34, x, yG + 60, "#222", 1.4) +
        qT(x, yG + 76, i ? "P2 = 110 kN" : "P1 = 110 kN", { a: "middle", fs: 11, b: true });
    });
    s += qDH(b1, b2, yG + 24, "1,2 m");
    // tải trọng làn
    const yL = 330;
    s +=
      box(70, yL - 48, "Tải trọng làn thiết kế") +
      qT(560, yL - 30, "9,3 kN/m", { a: "middle", fs: 12, b: true });
    s += qL(240, yL - 22, 740, yL - 22, 'stroke="#222"');
    for (let i = 0; i <= 25; i++) {
      const x = 240 + (500 * i) / 25;
      s += qAr(x, yL - 22, x, yL - 1, "#222", 0.8);
    }
    s +=
      qL(230, yL, 750, yL, 'stroke="#222" stroke-width="1.2"') +
      `<rect x="230" y="${yL}" width="520" height="5" fill="url(#__S)"/>`;
    s += qT(
      W / 2,
      H - 10,
      `Tải trọng làn phân bố trên bề rộng 3 m: plàn = m.9,3/3 = ${qf(R.LN, 3)} kN/m²`,
      { a: "middle", fs: 11, c: "#0050b0" },
    );
    qdSvg(id, W, H, fix(id, s));
  }
  // ---------- Hình 4: bề rộng tương đương E, Espan (Excel - trường hợp 1) ----------
  {
    const id = "dgQdLL",
      W = 760,
      H = 300,
      v = R.veh[0],
      q = v.patches[1] || v.patches[0],
      lt = R.Hc * 1000 < 600,
      sx = 0.075,
      u = [0.78, -0.62];
    const Ew = lt ? q.E : q.W,
      Ls = lt ? q.Esp : q.Lw,
      P0 = [372, 200],
      hp = Math.max(46, Math.min(95, R.Hc * 1000 * 0.13));
    let s = "";
    const pt = (c, dx, dl) => [c[0] + dx + dl * u[0], c[1] + dl * u[1]],
      ps = (a) => a.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
    // khối bản
    const d = 105,
      fl = [80, 230],
      fr = [600, 230],
      bl = pt(fl, 0, d),
      br = pt(fr, 0, d),
      t = 34;
    s +=
      `<polygon points="${ps([fl, fr, br, bl])}" fill="#f2f2f2" stroke="#222" stroke-width="1.2"/>` +
      `<polygon points="${ps([fl, fr, [fr[0], fr[1] + t], [fl[0], fl[1] + t]])}" fill="url(#__H)" stroke="#222" stroke-width="1.2"/>` +
      `<polygon points="${ps([fr, br, [br[0], br[1] + t], [fr[0], fr[1] + t]])}" fill="#ddd" stroke="#222" stroke-width="1.2"/>`;
    s += qT(fl[0] + 18, fl[1] + t / 2 + 5, "Bản quá độ", { fs: 12, b: true });
    // vệt phân bố trên mặt bản
    const e = (Ew * sx) / 2,
      l = (Ls * sx) / 2,
      Pb = [pt(P0, -e, -l), pt(P0, e, -l), pt(P0, e, l), pt(P0, -e, l)];
    s += `<polygon points="${ps(Pb)}" fill="#bdbdbd" stroke="#222" stroke-width="1"/>`;
    // vệt tiếp xúc bánh xe trên mặt đường
    const T0 = [P0[0], P0[1] - hp],
      ew = ((1800 + I.wt) * sx) / 2,
      lw = (I.LT * sx) / 2,
      Pt = [pt(T0, -ew, -lw), pt(T0, ew, -lw), pt(T0, ew, lw), pt(T0, -ew, lw)];
    s += `<polygon points="${ps(Pt)}" fill="none" stroke="#222" stroke-width="1"/>`;
    for (let i = 0; i < 4; i++)
      s += qL(Pt[i][0], Pt[i][1], Pb[i][0], Pb[i][1], 'stroke="#222" stroke-width="1"');
    // trục xe
    const wl = pt(T0, -900 * sx, 0),
      wr = pt(T0, 900 * sx, 0);
    s += qL(wl[0], wl[1] - 20, wr[0], wr[1] - 20, 'stroke="#222" stroke-width="4"');
    [wl, wr].forEach((w) => {
      s += `<ellipse cx="${w[0]}" cy="${w[1] - 14}" rx="12" ry="16" fill="#fff" stroke="#222" stroke-width="1.6"/>`;
    });
    s += qT(wl[0] - 40, wl[1] - 30, `P = ${v.axles[1] ? v.axles[1].P : v.axles[0].P} kN`, {
      a: "end",
      fs: 11,
      b: true,
    });
    // kích thước
    s += qDVh(T0[1], P0[1], Pt[3][0] - 40, `H = ${qf(R.Hc * 1000, 0)} mm`);
    const r1 = Pb[1],
      r2 = Pb[2];
    s +=
      qL(r1[0], r1[1], r1[0] + 60, r1[1], 'stroke="#666" stroke-width="0.6"') +
      qL(r2[0], r2[1], r2[0] + 40, r2[1], 'stroke="#666" stroke-width="0.6"') +
      qT(r1[0] + 64, r1[1] + 4, `${lt ? "Espan" : "Lw"} = ${qf(Ls, 0)} mm`, { fs: 11 });
    const m0 = [(Pb[0][0] + Pb[1][0]) / 2, (Pb[0][1] + Pb[1][1]) / 2];
    s +=
      qL(m0[0], m0[1], m0[0] + 20, m0[1] + 60, 'stroke="#666" stroke-width="0.6"') +
      qT(m0[0] + 24, m0[1] + 64, `${lt ? "E" : "Ww"} = ${qf(Ew, 0)} mm`, { fs: 11 });
    s += qT(br[0] - 70, br[1] - 10, "Phương dọc nhịp ↗", { a: "end", fs: 10, i: true, c: "#555" });
    s += qT(
      W / 2,
      20,
      lt
        ? "BỀ RỘNG TƯƠNG ĐƯƠNG KHI H < 600 mm (TCVN 11823-4, 6.2.10)"
        : "DIỆN TÍCH PHÂN BỐ BÁNH XE QUA ĐẤT ĐẮP KHI H ≥ 600 mm (TCVN 11823-3, 6.1.2.6)",
      { a: "middle", fs: 13, b: true },
    );
    qdSvg(id, W, H, fix(id, s));
  }
  // ---------- Hình 5: dầm giản đơn chịu tải dải đều W (Excel 5.2.1.1) ----------
  {
    const id = "dgQdW",
      W = 760,
      H = 400,
      L = R.Ltt,
      S = R.C[0],
      X = (x) => 170 + (x * 420) / L,
      yb = 96;
    let s = "";
    s += qL(X(0), 52, X(L), 52, 'stroke="#222"');
    for (let i = 0; i <= 14; i++) {
      const x = X((L * i) / 14);
      s += qAr(x, 52, x, yb - 3, "#222", 1);
    }
    s += qT(X(L / 2), 44, `W = ${qf(S.wU, 2)} kN/m`, { a: "middle", fs: 13, b: true });
    s +=
      qL(X(0) - 12, yb, X(L) + 12, yb, 'stroke="#111" stroke-width="5"') +
      qPin(X(0), yb + 3) +
      qRol(X(L), yb + 3) +
      qDH(X(0), X(L), yb + 40, `Ltt = ${qf(L, 3)} m`);
    const yM = 168,
      kM = 70 / Math.max(S.MU, 1e-9);
    s +=
      qHat(X, 0, L, yM, (x) => (S.wU * x * (L - x)) / 2, kM, "#222") +
      qDVh(yM, yM + S.MU * kM, X(0) - 20, "Mmax");
    s += qT(X(L / 2), yM + S.MU * kM + 20, `Mmax = W.Ltt²/8 = ${qf(S.MU, 2)} kN.m`, {
      a: "middle",
      fs: 12,
    });
    const yV = 318,
      kV = 44 / Math.max(S.VU, 1e-9);
    s +=
      qHat(X, 0, L, yV, (x) => -(S.wU * (L / 2 - x)), kV, "#222") +
      qDVh(yV - S.VU * kV, yV, X(0) - 20, "V");
    s += qT(X(L) + 14, yV - (S.VU * kV) / 2, `V = W.Ltt/2 = ${qf(S.VU, 2)} kN`, { fs: 12 });
    s += qT(W / 2, H - 8, "W = DC.γDC + EV.γEV + DW.γDW + LLlàn.γlàn (TTGH CĐ I)", {
      a: "middle",
      fs: 11,
      i: true,
      c: "#0050b0",
    });
    s += qT(W / 2, 20, "DẦM GIẢN ĐƠN CHỊU TẢI TRỌNG DẢI ĐỀU W", { a: "middle", fs: 13, b: true });
    qdSvg(id, W, H, fix(id, s));
  }
  // ---------- Hình 6: dầm giản đơn chịu tải trọng một phần LLxe = q (Excel 5.2.1.2) ----------
  {
    const id = "dgQdM",
      W = 760,
      H = 380,
      L = R.Ltt;
    let s = "";
    const pan = (ox, vh, mode) => {
      const X = (x) => ox + 30 + (x * 280) / L,
        yb = 110,
        env = vh.env,
        sh = mode === "M" ? env.sM : env.sV;
      const P = vh.patches
        .map((q) => ({ a: Math.max(0, sh + q.off), b: Math.min(L, sh + q.off + q.len), p: q.p }))
        .filter((q) => q.b > q.a);
      let t = "";
      t +=
        qL(X(0) - 8, yb, X(L) + 8, yb, 'stroke="#111" stroke-width="5"') +
        qPin(X(0), yb + 3) +
        qRol(X(L), yb + 3);
      P.forEach((q, i) => {
        t += qL(X(q.a), 62, X(q.b), 62, 'stroke="#c00000"');
        const n = Math.max(2, Math.round((X(q.b) - X(q.a)) / 14));
        for (let k = 0; k <= n; k++) {
          const x = X(q.a + ((q.b - q.a) * k) / n);
          t += qAr(x, 62, x, yb - 3);
        }
        if (i === 0) t += qDH(X(q.a), X(q.b), yb + 26, `b = ${qf(q.b - q.a, 3)}`);
      });
      if (P.length)
        t += qT((X(P[0].a) + X(P[P.length - 1].b)) / 2, 54, `LLxe = q = ${qf(P[0].p, 1)} kN/m`, {
          a: "middle",
          fs: 12,
          b: true,
          c: "#c00000",
        });
      t += qDH(X(0), X(L), yb + 50, `Ltt = ${qf(L, 3)} m`);
      const rr = P.map((q) => QD.patch(L, q.a, q.b, q.p)).filter(Boolean);
      if (mode === "M") {
        const f = (x) => rr.reduce((a, r) => a + r.M(x), 0),
          y0 = 196,
          k = 80 / Math.max(env.M, 1e-9);
        t += qHat(X, 0, L, y0, f, k, "#222") + qDVh(y0, y0 + env.M * k, X(L) + 12, "Mmax", "r");
        t += qT(ox + 180, y0 + k * env.M + 26, `Mmax,LL = ${qf(env.M, 2)} kN.m`, {
          a: "middle",
          fs: 12,
        });
      } else {
        const RA = rr.reduce((a, r) => a + r.RA, 0),
          RB = rr.reduce((a, r) => a + r.RB, 0),
          sg = RA >= RB ? 1 : -1,
          f = (x) => -rr.reduce((a, r) => a + r.V(x), 0),
          y0 = 236,
          k = 50 / Math.max(env.V, 1e-9);
        t +=
          qHat(X, 0, L, y0, f, k, "#222") +
          (sg > 0
            ? qDVh(y0 - env.V * k, y0, X(0) - 12, "Vmax")
            : qDVh(y0, y0 + env.V * k, X(L) + 12, "Vmax", "r")) +
          qT(ox + 180, y0 + 80, `Vmax,LL = ${qf(env.V, 2)} kN`, { a: "middle", fs: 12 });
      }
      t += qT(ox + 180, H - 12, mode === "M" ? "Sơ đồ để tính mô men" : "Sơ đồ để tính lực cắt", {
        a: "middle",
        fs: 13,
        c: "#c00000",
      });
      return t;
    };
    s += pan(10, R.vg, "M") + pan(390, R.vgV, "V");
    s += qT(W / 2, 20, `DẦM GIẢN ĐƠN CHỊU TẢI TRỌNG MỘT PHẦN LLxe = q (${R.vg.nm.toUpperCase()})`, {
      a: "middle",
      fs: 13,
      b: true,
    });
    qdSvg(id, W, H, fix(id, s));
  }
  // ---------- Hình 7: mặt cắt tính toán và sơ đồ ứng suất (Excel 6.2) ----------
  {
    const id = "dgQdX",
      W = 760,
      H = 330,
      sec = R.sec,
      h = I.h * 1000,
      bw = 170,
      hp = 200,
      x0 = 250,
      y0 = 56,
      Y = (y) => y0 + (y * hp) / h;
    let s = "";
    s +=
      `<rect x="${x0}" y="${y0}" width="${bw}" height="${hp}" fill="#fff7b0" stroke="#222" stroke-width="1.4"/>` +
      `<rect x="${x0}" y="${y0}" width="${bw}" height="${Math.max(5, (sec.a * hp) / h)}" fill="#bfbfbf"/>`;
    s += `<rect x="${x0 + 8}" y="${y0 + 8}" width="${bw - 16}" height="${hp - 16}" fill="none" stroke="#222" stroke-width="1.6"/>`;
    for (let i = 0; i < 9; i++) {
      const x = x0 + 16 + (i * (bw - 32)) / 8;
      s += `<circle cx="${x}" cy="${Y(sec.dps)}" r="3" fill="#222"/><circle cx="${x}" cy="${Y(sec.ds)}" r="4" fill="#222"/>`;
    }
    for (let i = 1; i < 4; i++) {
      const x = x0 + (bw * i) / 4;
      s += qL(x, y0 + 8, x, y0 + hp - 8, 'stroke="#222" stroke-width="0.8" stroke-dasharray="2 2"');
    }
    s +=
      qDV(Y(0), Y(h), x0 - 74, `h = ${qf(h, 0)}`) +
      qDV(Y(0), Y(sec.ds), x0 - 46, `ds = ${qf(sec.ds, 0)}`) +
      qDV(Y(0), Y(sec.dps), x0 - 16, `d's = ${qf(sec.dps, 0)}`);

    s +=
      qDH(x0, x0 + bw, y0 + hp + 24, "b = 1000 mm") +
      qT(
        x0 + bw / 2,
        y0 + hp + 42,
        `φ${qf(I.db, 0)} a${qf(I.sb, 0)} : As = ${qf(sec.As, 0)} mm² ; φ${qf(I.dt, 0)} a${qf(I.st, 0)} : A's = ${qf(sec.Asp, 0)} mm²`,
        { a: "middle", fs: 11 },
      );
    // sơ đồ ứng suất
    const xs = 530,
      ap = Math.max(5, (sec.a * hp) / h);
    s +=
      qL(xs, y0, xs, y0 + hp, 'stroke="#222" stroke-width="1.2"') +
      qL(x0 + bw, y0, xs, y0, 'stroke="#999" stroke-width="0.5" stroke-dasharray="3 2"') +
      qL(x0 + bw, y0 + hp, xs, y0 + hp, 'stroke="#999" stroke-width="0.5" stroke-dasharray="3 2"');
    s += `<rect x="${xs - 40}" y="${y0}" width="40" height="${ap}" fill="#bfbfbf" stroke="#222"/>`;
    for (let i = 0; i <= 3; i++) {
      const y = y0 + (ap * i) / 3;
      s += qL(xs + 40, y, xs + 2, y, 'stroke="#222" stroke-width="0.8" marker-end="url(#__K)"');
    }
    s +=
      qDVh(y0, y0 + ap, xs + 56, `a = ${qf(sec.a, 1)}`, "r") +
      qT(xs + 120, y0 + ap / 2 + 4, `0,85.f'c.a.b`, { fs: 11 });
    s +=
      qL(
        xs - 40,
        Y(sec.c),
        xs + 4,
        Y(sec.c),
        'stroke="#0050b0" stroke-width="0.8" stroke-dasharray="4 2"',
      ) + qT(xs - 44, Y(sec.c) + 14, `c = ${qf(sec.c, 1)}`, { a: "end", fs: 10, c: "#0050b0" });
    s +=
      qL(
        xs,
        Y(sec.ds),
        xs + 70,
        Y(sec.ds),
        'stroke="#222" stroke-width="1.6" marker-end="url(#__K)"',
      ) + qT(xs + 76, Y(sec.ds) + 4, `As.fy = ${qf((sec.As * sec.fy) / 1000, 1)} kN`, { fs: 11 });
    s += qT(xs + 16, Y(sec.dps) + 40, `A's.f'y: bỏ qua (thiên về an toàn)`, {
      fs: 10,
      i: true,
      c: "#555",
    });
    s += qT(W / 2, 20, "MẶT CẮT TÍNH TOÁN DẢI BẢN RỘNG 1 m VÀ SƠ ĐỒ ỨNG SUẤT", {
      a: "middle",
      fs: 13,
      b: true,
    });
    qdSvg(id, W, H, fix(id, s));
  }
}
