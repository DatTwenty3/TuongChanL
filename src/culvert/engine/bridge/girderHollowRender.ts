// @ts-nocheck
/**
 * Dầm bản rỗng DƯL / dầm bản BTCT (tab "Dầm giữa", "Dầm biên"): bảng số liệu + kết quả kiểm toán.
 *
 * Chuyển NGUYÊN VĂN `damRender` (và `okc2`, `klAppend`) từ `analysis-cau-cong/modules/10_superstructure_ui_and_deck_joints.js`.
 * Bản dựng lại trước đây chỉ vẽ hình, bỏ sót phần điền bảng / ô kết quả (`#tbgSec`, `#o_g_Lh`, `#tbgMU`…) nên hai tab này trống.
 * Hình vẽ (`damDraw`) vẫn do `reports/bridgeReports.ts` (hook `renderGirderHollow`) phụ trách nên lời gọi `damDraw` cuối hàm được bỏ.
 * Giữ `@ts-nocheck` có chủ ý để mã không bị viết lại; đối chiếu với bản gốc ở `tests/qa/ui_diff_original.mjs`.
 */

import { $, fx } from '../context.ts';

const okc2 = (ok) => `<td class="c ${ok ? "ok" : "bad"}">${ok ? "OK" : "NG"}</td>`;
function klAppend(id, ok, cols, note) {
  const e = document.getElementById(id) || $(id);
  if (!e) return;
  e.insertAdjacentHTML(
    "beforeend",
    `<tr><td class="l" colspan="${cols - 2}"><b>KẾT LUẬN</b>${note ? " " + note : ""}</td><td class="c ${ok ? "ok" : "bad"}" colspan="2"><b>${ok ? "ĐẠT" : "KHÔNG ĐẠT"}</b></td></tr>`,
  );
}

export function damRender(k, R, I, G, LIM) {
  const set = (id, v, d) => {
    const e = $(id);
    if (e) e.textContent = typeof v === "number" ? fx(v, d) : v;
  };
  const okn = (id, ok, t) => {
    const e = $(id + "n");
    if (e) {
      e.textContent = t || (ok ? "OK" : "NG");
      e.className = "note " + (ok ? "ok" : "bad");
    }
  };
  const tb = (id, h) => {
    const e = $(`tb${k}${id}`);
    if (e) e.innerHTML = h;
  };
  set(`o_${k}_Lh`, R.Lh / 2, 0);
  set(`o_${k}_ncs`, R.ncs, 4);
  set(`o_${k}_lt`, R.lt, 0);
  // ---- đặc trưng hình học ----
  const H = R.H,
    row = (nm, S, top) =>
      `<tr><td class="l" colspan="3">${nm}</td><td>${fx(S.A / 1e6, 4)}</td><td>${fx(S.yb, 1)}</td><td>${fx(top - S.yb, 1)}</td><td>${fx(S.I / 1e12, 5)}</td><td>${fx(S.I / S.yb / 1e9, 5)}</td><td>${fx(S.I / (top - S.yb) / 1e9, 5)}</td></tr>`;
  tb(
    "Sec",
    `<tr><th colspan="3">Mặt cắt</th><th>A (m2)</th><th>yb (mm)</th><th>yt (mm)</th><th>I (m4)</th><th>Sb (m3)</th><th>St (m3)</th></tr>` +
      row("Đặc đầu dầm", R.S_e, H) +
      row("Rỗng (đoạn giữa hai đầu)", R.S_h, H) +
      row("Đặc giữa nhịp", R.S_s, H) +
      row("Liên hợp - đoạn rỗng", R.Sc_h, H) +
      row("Liên hợp - đặc giữa nhịp", R.Sc_s, H) +
      `<tr><td class="l" colspan="9">Liên hợp: bản dày ts = ${fx(R.hs, 0)} mm, rộng S = ${fx(R.bd, 0)} mm, quy đổi n = ${fx(R.ncs, 4)}; yt của mặt cắt liên hợp tính đến mặt trên dầm.</td></tr>`,
  );
  // ---- cáp ----
  const brg = R.brg;
  tb(
    "Str",
    `<tr><th>Hàng</th><th>y (mm)</th><th>Số tao</th><th colspan="4">Tao số</th><th>Bọc ống (mm)</th><th>Dính bám từ x (m)</th><th>Đủ lực từ x (m)</th></tr>` +
      R.groups
        .map((g) => {
          const row = G.strands.find((s) => s[0] === g.ids[0]);
          return `<tr><td class="c">${row ? row[1] : ""}</td><td>${fx(g.y, 0)}</td><td class="c">${g.n}</td><td class="l" colspan="4">${g.ids.join(", ")}</td><td>${fx(g.l0, 0)}</td><td>${fx((g.l0 - brg) / 1000, 3)}</td><td>${fx((g.l0 + R.lt - brg) / 1000, 3)}</td></tr>`;
        })
        .join("") +
      `<tr><td class="l" colspan="2">Tổng</td><td class="c">${R.nstr}</td><td class="l" colspan="7">Aps = ${fx(R.nstr * I.Ap1, 1)} mm2 ; Pj = ${fx((R.nstr * I.Ap1 * I.fpjr * I.fpu) / 1000, 1)} kN</td></tr>`,
  );
  const tag = (r) => (r.tag === "v" ? " (cắt)" : r.tag === "g" ? " (mép gối)" : "");
  tb(
    "Xs",
    `<tr><th colspan="2">x (m)</th><th colspan="2">Loại mặt cắt</th><th>Số tao có hiệu</th><th>Aps (mm2)</th><th>ycg (mm)</th><th>e (mm)</th><th>ec (mm)</th></tr>` +
      R.res
        .map(
          (r) =>
            `<tr><td class="l" colspan="2">${fx(r.x, 3)}${tag(r)}</td><td class="l" colspan="2">${r.stype}</td><td>${fx(r.nb, 2)}</td><td>${fx(r.Aps, 1)}</td><td>${fx(r.ycg, 1)}</td><td>${fx(r.e, 1)}</td><td>${fx(r.ec, 1)}</td></tr>`,
        )
        .join(""),
  );
  const Db = R.debond,
    okD = (b) => `<td class="c ${b ? "ok" : "bad"}">${b ? "OK" : "NG"}</td>`;
  tb(
    "Db",
    `<tr><th colspan="5">Nội dung</th><th colspan="2">Thực tế</th><th colspan="2">Giới hạn</th><th>KL</th></tr>` +
      `<tr><td class="l" colspan="5">Số tao bọc ống / tổng số tao</td><td colspan="2">${Db.n}/${Db.tot} = ${fx(100 * Db.ratio, 1)}%</td><td class="c" colspan="2">≤ 25%</td>${Db.totOK ? okD(true) : Db.otherOK ? '<td class="c" style="color:#b45309;font-weight:bold">Chênh TCVN*</td>' : okD(false)}</tr>` +
      Object.entries(Db.rows)
        .map(
          ([r, o]) =>
            `<tr><td class="l" colspan="5">Hàng ${r}: số tao bọc ống / số tao của hàng</td><td colspan="2">${o.d}/${o.n} = ${fx((100 * o.d) / o.n, 1)}%</td><td class="c" colspan="2">≤ 40%</td>${okD(o.d <= 0.4 * o.n + 1e-9)}</tr>`,
        )
        .join("") +
      `<tr><td class="l" colspan="5">Số tao kết thúc bọc ống tại cùng 1 mặt cắt (lớn nhất)</td><td colspan="2">${Db.maxEnd}</td><td class="c" colspan="2">≤ ${fx(Db.limEnd, 1)}</td>${okD(Db.maxEnd <= Db.limEnd)}</tr>` +
      `<tr><td class="l" colspan="5">Bố trí đối xứng qua tim dầm, cùng chiều dài bọc</td><td colspan="2">${Db.symOK ? "Có" : "Không"}</td><td class="c" colspan="2">Đối xứng</td>${okD(Db.symOK)}</tr>` +
      `<tr><td class="l" colspan="5">Tao ngoài cùng của mỗi hàng dính bám hoàn toàn</td><td colspan="2">${Db.outerOK ? "Có" : "Không"}</td><td class="c" colspan="2">Dính bám</td>${okD(Db.outerOK)}</tr>` +
      (!Db.totOK && Db.otherOK
        ? `<tr><td class="l" colspan="10">(*) Vượt giới hạn 25% tổng số tao (${Db.n} tao so với cho phép ${fx(0.25 * Db.tot, 2)} tao). Xem luận chứng chấp nhận ở bảng tổng hợp kết quả (mục 11).</td></tr>`
        : ""),
  );
  // ---- tải trọng ----
  const Ld = R.loads;
  set(`o_${k}_DC1`, Ld.DC1, 3);
  set(`o_${k}_DC2`, Ld.DC2, 3);
  set(`o_${k}_DC3`, Ld.DC3, 3);
  set(`o_${k}_DC4`, Ld.DC4, 3);
  if (k === "b") set("o_b_de", G.de, 0);
  set(`o_${k}_wPL`, Ld.wPL, 3);
  set(`o_${k}_DW`, Ld.DW, 3);
  const D = R.DF;
  set(`o_${k}_J`, D.J.toExponential(4));
  set(`o_${k}_K`, D.k, 4);
  const rg = (b) => (b ? "Thỏa mãn" : "Ngoài phạm vi");
  tb(
    "DF",
    `<tr><th colspan="3">Đại lượng</th><th>Ký hiệu</th><th colspan="2">Giá trị</th><th colspan="3">Phạm vi áp dụng</th></tr>` +
      [
        ["Bề rộng dầm", "b (mm)", fx(D.b, 0), "900 ≤ b ≤ 1500", D.range.b],
        ["Chiều dài nhịp tính toán", "L (mm)", fx(R.Ls, 0), "6000 ≤ L ≤ 37000", D.range.L],
        ["Số dầm", "Nb", String(I.Ng), "5 ≤ Nb ≤ 20", D.range.Nb],
        [
          "Mômen quán tính mặt cắt liên hợp (đoạn rỗng)",
          "I (mm4)",
          D.Ig.toExponential(4),
          "1,7.10¹⁰ ≤ I ≤ 2,5.10¹¹",
          D.range.I,
        ],
        ["Hằng số xoắn", "J (mm4)", D.J.toExponential(4), "1,0.10¹⁰ ≤ J ≤ 2,5.10¹¹", D.range.J],
        [
          "Bản trên lỗ ; bản trên liên hợp quy đổi (tt + n.ts) ; bản dưới ; sườn ngoài",
          "tt ; ttc ; tb ; tw (mm)",
          fx(D.tt, 0) + " ; " + fx(D.ttc, 0) + " ; " + fx(D.tb, 0) + " ; " + fx(D.tw, 0),
          "",
          true,
        ],
        ["Kích thước hộp quy đổi", "b0 ; d0 (mm)", fx(D.b0, 0) + " ; " + fx(D.d0, 0), "", true],
        ["Tỷ số", "I/J", fx(D.IJ, 4), "", true],
      ]
        .map(
          (r) =>
            `<tr><td class="l" colspan="3">${r[0]}</td><td class="c">${r[1]}</td><td colspan="2">${r[2]}</td><td class="c" colspan="3">${r[3] ? r[3] + " : " + rg(r[4]) : ""}</td></tr>`,
        )
        .join(""),
  );
  let dfr =
    `<tr><th colspan="4">Trường hợp</th><th colspan="2">Mômen gM</th><th colspan="2">Lực cắt gV</th></tr>` +
    `<tr><td class="l" colspan="4">Dầm giữa - 1 làn chất tải</td><td colspan="2">${fx(D.M1, 4)}</td><td colspan="2">${fx(D.V1, 4)}</td></tr><tr><td class="l" colspan="4">Dầm giữa - 2 làn trở lên</td><td colspan="2">${fx(D.M2, 4)}</td><td colspan="2">${fx(D.V2, 4)}</td></tr>`;
  if (R.kind === "bien")
    dfr +=
      (D.fromG
        ? `<tr><td class="l" colspan="8">Dầm biên: g = e × g(dầm giữa); các hệ số g dầm giữa và I, J ở trên lấy theo mặt cắt dầm giữa (TCVN 11823-4, Điều 6.2.2.2.2 ; 6.2.2.3.2).</td></tr>`
        : "") +
      `<tr><td class="l" colspan="4">Dầm biên, de = ${fx(D.de, 0)} mm - hệ số e (1 làn ; 2 làn)</td><td colspan="2">${fx(D.eM1, 4)} ; ${fx(D.eM2, 4)}</td><td colspan="2">${fx(D.eV1, 4)} ; ${fx(D.eV2 * D.fb, 4)}</td></tr>` +
      `<tr><td class="l" colspan="8">Phạm vi áp dụng: mômen de ≤ 600 mm (Bảng 8) : ${D.deOutM ? "Ngoài phạm vi" : "Thỏa mãn"} ; lực cắt 300 ≤ de ≤ 600 mm (Bảng 12) : ${D.deOutV ? "Ngoài phạm vi" : "Thỏa mãn"}.${D.deOutM || D.deOutV ? ` Trường hợp ngoài phạm vi dùng quy tắc đòn bẩy (Điều 6.2.2.3.2): g = ${fx(D.lev, 4)} ; lấy giá trị lớn hơn của công thức và quy tắc đòn bẩy (AASHTO LRFD 7th Ed. (2014), Bảng 4.6.2.2.3b-1 chỉ giới hạn de ≤ 600 mm).` : ""} Với de < 0 hệ số e lấy ≥ 1,0.</td></tr>` +
      `<tr><td class="l" colspan="4">Dầm biên - 1 làn chất tải</td><td colspan="2">${fx(D.M1e, 4)}</td><td colspan="2">${fx(D.V1e, 4)}</td></tr><tr><td class="l" colspan="4">Dầm biên - 2 làn trở lên</td><td colspan="2">${fx(D.M2e, 4)}</td><td colspan="2">${fx(D.V2e, 4)}</td></tr>`;
  dfr +=
    `<tr><td class="l" colspan="4">Giá trị lớn hơn (chưa xét gối chéo)</td><td colspan="2">${fx(D.M0, 4)}</td><td colspan="2">${fx(D.V0, 4)}</td></tr>` +
    `<tr><td class="l" colspan="4">Hệ số hiệu chỉnh gối chéo θ = ${fx(D.th, 1)}° : mômen 1,05 - 0,25.tanθ ≤ 1,0 (Bảng 9) ; lực cắt 1 + L.√tanθ/(90.d), d = ${fx(R.H || 0, 0)} mm (Bảng 13, áp dụng cho mọi dầm, lấy không đổi trên toàn nhịp - thiên về an toàn)${D.th > 60 ? " ; θ > 60°: ngoài phạm vi, lấy θ = 60°" : ""}</td><td colspan="2">${fx(D.cM, 4)}</td><td colspan="2">${fx(D.cV, 4)}</td></tr>`;
  if (D.levB)
    dfr += `<tr><td class="l" colspan="8">b = ${fx(D.b, 0)} mm ngoài phạm vi Bảng 6, 11: hoạt tải lấy theo quy tắc đòn bẩy (TCVN 11823-4, Điều 6.2.2.1), g = ${fx(D.lev, 4)}; giá trị dùng tính toán không nhỏ hơn giá trị này.</td></tr>`;
  dfr += `<tr><td class="l" colspan="4"><b>Hệ số phân bố dùng tính toán</b></td><td colspan="2"><b>${fx(D.M, 4)}</b></td><td colspan="2"><b>${fx(D.V, 4)}</b></td></tr>`;
  tb("DF2", dfr);
  tb(
    "MV",
    `<tr><th>x (m)</th><th>M DC1</th><th>M DC2,3</th><th>M DC4</th><th>M DW</th><th>M xe</th><th>M làn</th><th>M LL</th><th>V DC</th><th>V DW</th><th>V LL</th></tr>` +
      `<tr><td class="c" colspan="11">Mômen (kN.m) ; lực cắt (kN) ; M xe, M làn: 1 làn, chưa nhân g và IM ; M LL, V LL: đã nhân g, IM${R.loads.wPL > 0 ? " và đã cộng tải trọng người đi bộ PL = " + fx(R.loads.wPL, 3) + " kN/m (không nhân g, IM)" : ""}</td></tr>` +
      R.res
        .map(
          (r) =>
            `<tr><td class="c">${fx(r.x, 3)}</td><td>${fx(r.M1, 1)}</td><td>${fx(r.M2, 1)}</td><td>${fx(r.M3, 1)}</td><td>${fx(r.MW, 1)}</td><td>${fx(r.MLLv, 1)}</td><td>${fx(r.MLLl, 1)}</td><td>${fx(r.MLL, 1)}</td><td>${fx(r.VDC1 + r.VDC2 + r.VDC3, 1)}</td><td>${fx(r.VDW, 1)}</td><td>${fx(r.VLL, 1)}</td></tr>`,
        )
        .join(""),
  );
  tb(
    "MU",
    `<tr><th colspan="2">x (m)</th><th>M DC</th><th>M DW</th><th>M LL</th><th>Mu (kN.m)</th><th>V DC</th><th>V DW</th><th>V LL</th><th>Vu (kN)</th></tr>` +
      R.res
        .map(
          (r) =>
            `<tr><td class="c" colspan="2">${fx(r.x, 3)}</td><td>${fx(r.M1 + r.M2 + r.M3, 1)}</td><td>${fx(r.MW, 1)}</td><td>${fx(r.MLL, 1)}</td><td><b>${fx(r.Mu, 1)}</b></td><td>${fx(r.VDC1 + r.VDC2 + r.VDC3, 1)}</td><td>${fx(r.VDW, 1)}</td><td>${fx(r.VLL, 1)}</td><td><b>${fx(r.Vu, 1)}</b></td></tr>`,
        )
        .join(""),
  );
  // ---- co ngót, từ biến ----
  const s = R.shr;
  tb(
    "Sh",
    `<tr><th colspan="5">Đại lượng</th><th>Ký hiệu</th><th>Giá trị</th></tr>` +
      [
        ["Tỷ số thể tích/bề mặt của dầm", "V/S (mm)", fx(s.VS, 1)],
        ["Hệ số ảnh hưởng V/S", "ks", fx(s.ks, 3)],
        ["Hệ số độ ẩm co ngót / từ biến", "khs ; khc", fx(s.khs, 4) + " ; " + fx(s.khc, 4)],
        ["Hệ số cường độ bê tông dầm", "kf", fx(s.kf, 4)],
        [
          "Hệ số thời gian: (td - ti) ; (tf - ti) ; (tf - td)",
          "ktd",
          fx(s.ktd_di, 4) + " ; " + fx(s.ktd_fi, 4) + " ; " + fx(s.ktd_fd, 4),
        ],
        ["Hệ số từ biến dầm", "ψb(tf,ti)", fx(s.psi_fi, 4)],
        ["", "ψb(td,ti)", fx(s.psi_di, 4)],
        ["", "ψb(tf,td)", fx(s.psi_fd, 4)],
        [
          "Thời gian bảo dưỡng dầm trước khi để khô (ngày) ; hệ số tăng co ngót (Điều 4.2.3.3)",
          "tc ; k",
          fx(s.tcur, 0) + " ; " + fx(s.kc5, 2),
        ],
        ["Co ngót dầm từ lúc truyền lực đến lúc đổ bản", "εbid", s.eps_bid.toExponential(4)],
        ["Co ngót dầm từ lúc đổ bản đến thời điểm cuối", "εbdf", s.eps_bdf.toExponential(4)],
        [
          "Bản mặt cầu: V/S ; ks ; kf",
          "",
          fx(s.VSd, 0) + " ; " + fx(s.ksd, 3) + " ; " + fx(s.kfd, 4),
        ],
        ["Co ngót bản từ lúc đổ đến thời điểm cuối", "εddf", s.eps_ddf.toExponential(4)],
        ["Hệ số từ biến bản", "ψd(tf,td)", fx(s.psi_d, 4)],
      ]
        .map(
          (r) =>
            `<tr><td class="l" colspan="5">${r[0]}</td><td class="c">${r[1]}</td><td>${r[2]}</td></tr>`,
        )
        .join(""),
  );
  tb(
    "Ls",
    `<tr><th>x (m)</th><th>fcgp</th><th>ΔfpES</th><th>ΔfpR1</th><th>ΔfpSR</th><th>ΔfpCR</th><th>ΔfpSD</th><th>ΔfpCD</th><th>ΔfpSS</th><th>ΔfpT</th><th>fpe</th></tr>` +
      `<tr><td class="c" colspan="11">MPa ; fpj = ${fx(I.fpjr * I.fpu, 1)} MPa ; ΔfpR2 = ΔfpR1</td></tr>` +
      R.res
        .map(
          (r) =>
            `<tr><td class="c">${fx(r.x, 3)}</td><td>${fx(r.fcgp, 2)}</td><td>${fx(r.dES, 1)}</td><td>${fx(r.dR1, 1)}</td><td>${fx(r.dSR, 1)}</td><td>${fx(r.dCR, 1)}</td><td>${fx(r.dSD, 1)}</td><td>${fx(r.dCD, 1)}</td><td>${fx(r.dSS, 1)}</td><td><b>${fx(r.dT, 1)}</b></td><td>${fx(r.fpe, 1)}</td></tr>`,
        )
        .join(""),
  );
  // ---- ứng suất ----
  const okTr = (r) =>
    r.ft_tr <= LIM.trC && r.fb_tr <= LIM.trC && Math.min(r.ft_tr, r.fb_tr) >= -r.trT.lim - 1e-9;
  tb(
    "Tr",
    `<tr><th colspan="2">x (m)</th><th>Pt (kN)</th><th>f trên</th><th>f dưới</th><th>T kéo (kN)</th><th>As yêu cầu</th><th>As có</th><th>[kéo]</th><th>KL</th></tr>` +
      R.res
        .map(
          (r) =>
            `<tr><td class="c" colspan="2">${fx(r.x, 3)}</td><td>${fx(r.Pt, 1)}</td><td>${fx(r.ft_tr, 2)}</td><td>${fx(r.fb_tr, 2)}</td><td>${fx(r.trT.T, 1)}</td><td>${fx(r.trT.Areq, 0)}</td><td>${fx(r.trT.Aprov, 0)}</td><td>${fx(-r.trT.lim, 2)}</td>${okc2(okTr(r))}</tr>`,
        )
        .join("") +
      `<tr><td class="l" colspan="10">Nén ≤ 0,60f'ci = ${fx(LIM.trC, 2)} MPa. Kéo: ≥ -0,25√f'ci ≤ 1,38 MPa; nếu cốt thép dính bám (tao cáp, cốt thép dọc) trong vùng kéo đủ chịu lực kéo T ở ứng suất ${fx(R.fsT, 0)} MPa (0,5fy ≤ 210 MPa) thì ≥ -0,63√f'ci (Bảng 7). As tính bằng mm2.</td></tr>`,
  );
  const T = R.TG,
    gT = T.g,
    tgT = gT * Math.max(T.pos.gt, T.neg.gt, 0),
    tgB = gT * Math.min(T.pos.gb, T.neg.gb, 0),
    tgD = gT * Math.max(T.pos.dk, T.neg.dk, 0);
  tb(
    "TG",
    `<tr><th colspan="3">Gradien nhiệt</th><th colspan="2">Thớ trên bản (MPa)</th><th colspan="2">Thớ trên dầm (MPa)</th><th colspan="2">Thớ dưới dầm (MPa)</th></tr>` +
      [
        ["Dương (T1 = " + fx(I.TGp[0], 0) + " ; T2 = " + fx(I.TGp[1], 0) + " °C)", T.pos],
        ["Âm (T1 = " + fx(I.TGn[0], 0) + " ; T2 = " + fx(I.TGn[1], 0) + " °C)", T.neg],
      ]
        .map(
          ([n, o]) =>
            `<tr><td class="l" colspan="3">${n}</td><td colspan="2">${fx(o.dk, 3)}</td><td colspan="2">${fx(o.gt, 3)}</td><td colspan="2">${fx(o.gb, 3)}</td></tr>`,
        )
        .join("") +
      `<tr><td class="l" colspan="3">Giá trị bất lợi nhân γTG = ${fx(gT, 2)}</td><td colspan="2">${fx(tgD, 3)}</td><td colspan="2">${fx(tgT, 3)}</td><td colspan="2">${fx(tgB, 3)}</td></tr>`,
  );
  R.res.forEach((r) => {
    r.ftIT = r.ftI + tgT;
    r.fbIIIT = r.fbIII + tgB;
    r.fdIT = r.fdI + tgD;
  });
  const okSv = (r) =>
    r.ftP <= LIM.svP &&
    r.ftIT <= LIM.svI &&
    r.fbIIIT >= -LIM.svT - 1e-9 &&
    r.fdP <= LIM.dkP &&
    r.fdIT <= LIM.dkI;
  tb(
    "Sv",
    `<tr><th colspan="2">x (m)</th><th>Pe (kN)</th><th>Trên dầm, TX</th><th>Trên dầm, SD I + TG</th><th>Dưới dầm, SD III + TG</th><th>Bản, TX</th><th>Bản, SD I + TG</th><th>KL</th></tr>` +
      `<tr><td class="c" colspan="3">Giới hạn (MPa)</td><td>≤ ${fx(LIM.svP, 2)}</td><td>≤ ${fx(LIM.svI, 2)}</td><td>≥ ${fx(-LIM.svT, 2)}</td><td>≤ ${fx(LIM.dkP, 2)}</td><td>≤ ${fx(LIM.dkI, 2)}</td><td></td></tr>` +
      R.res
        .map(
          (r) =>
            `<tr><td class="c" colspan="2">${fx(r.x, 3)}</td><td>${fx(r.Pe, 1)}</td><td>${fx(r.ftP, 2)}</td><td>${fx(r.ftIT, 2)}</td><td>${fx(r.fbIIIT, 2)}</td><td>${fx(r.fdP, 2)}</td><td>${fx(r.fdIT, 2)}</td>${okc2(okSv(r))}</tr>`,
        )
        .join("") +
      `<tr><td class="l" colspan="9">Các cột SD I, SD III đã cộng γTG x ứng suất do gradien nhiệt bất lợi (bảng trên); TX - DƯL + tải trọng thường xuyên.</td></tr>`,
  );
  tb(
    "Ft",
    `<tr><th colspan="2">x (m)</th><th>M mỏi (kN.m)</th><th>f trên dầm (MPa)</th><th>0,40 f'c</th><th>KL</th></tr>` +
      R.res
        .map(
          (r) =>
            `<tr><td class="c" colspan="2">${fx(r.x, 3)}</td><td>${fx(r.Mfat, 1)}</td><td>${fx(r.ftFat, 2)}</td><td>${fx(LIM.fat, 2)}</td>${okc2(r.ftFat <= LIM.fat)}</tr>`,
        )
        .join(""),
  );
  const okL = (o) => o.ft <= LIM.trC && o.fb <= LIM.trC && Math.min(o.ft, o.fb) >= -o.tc.lim - 1e-9;
  tb(
    "Lift",
    `<tr><th colspan="2">Mặt cắt</th><th>x từ đầu dầm (mm)</th><th>Hệ số động</th><th>M (kN.m)</th><th>Pt (kN)</th><th>f trên</th><th>f dưới</th><th>[kéo]</th><th>KL</th></tr>` +
      R.lift
        .map(
          (o) =>
            `<tr><td class="l" colspan="2">${o.nm}</td><td>${fx(o.x, 0)}</td><td>${fx(o.kd, 2)}</td><td>${fx(o.M, 1)}</td><td>${fx(o.Pt, 1)}</td><td>${fx(o.ft, 2)}</td><td>${fx(o.fb, 2)}</td><td>${fx(-o.tc.lim, 2)}</td>${okc2(okL(o))}</tr>`,
        )
        .join("") +
      `<tr><td class="l" colspan="10">Giới hạn như giai đoạn truyền lực: nén ≤ ${fx(LIM.trC, 2)} MPa ; kéo theo Bảng 7 (có xét cốt thép dính bám trong vùng kéo như mục trên).</td></tr>`,
  );
  // ---- uốn ----
  tb(
    "Fl",
    `<tr><th colspan="2">x (m)</th><th>c (mm)</th><th>a (mm)</th><th>εt</th><th>φ</th><th>ΣApsfpx (kN)</th><th>Mn</th><th>Mr</th><th>Mu</th><th>KL</th></tr>` +
      R.res
        .map(
          (r) =>
            `<tr><td class="c" colspan="2">${fx(r.x, 3)}</td><td>${fx(r.c, 1)}</td><td>${fx(r.a, 1)}${r.web ? "*" : ""}</td><td>${fx(r.et, 4)}</td><td>${fx(r.phi, 3)}</td><td>${fx(r.T, 1)}</td><td>${fx(r.Mn, 1)}</td><td>${fx(r.Mr, 1)}</td><td>${fx(r.Mu, 1)}</td>${okc2(r.Mr >= r.Mu - 1e-9)}</tr>`,
        )
        .join("") +
      `<tr><td class="l" colspan="11">(*) a > ts: vùng nén gồm toàn bộ bản mặt cầu và phần trên dầm (bề rộng dầm tại cao độ tương ứng, f'c dầm).</td></tr>`,
  );
  set(`o_${k}_g1`, I.g1, 1);
  tb(
    "Mn",
    `<tr><th colspan="2">x (m)</th><th>fcpe (MPa)</th><th>Mdnc</th><th>Sc (m3)</th><th>Snc (m3)</th><th>Mcr</th><th>1,33Mu</th><th>Mr</th><th>KL</th></tr>` +
      R.res
        .filter((r) => r.x > 0)
        .map(
          (r) =>
            `<tr><td class="c" colspan="2">${fx(r.x, 3)}</td><td>${fx(r.fcpe, 2)}</td><td>${fx(r.Mdnc, 1)}</td><td>${fx(r.Scm / 1e9, 5)}</td><td>${fx(r.Snc / 1e9, 5)}</td><td>${fx(r.Mcr, 1)}</td><td>${fx(1.33 * r.Mu, 1)}</td><td>${fx(r.Mr, 1)}</td>${okc2(r.Mr >= r.Mmin - 1e-9)}</tr>`,
        )
        .join(""),
  );
  // ---- cắt ----
  set(`o_${k}_xv`, R.xv / 1000, 3);
  tb(
    "Vs",
    `<tr><th>x (m)</th><th>dv (mm)</th><th>bv (mm)</th><th>εs.10³</th><th>β</th><th>θ (độ)</th><th>Vc</th><th>Vs</th><th>Vr</th><th>Vu</th><th>KL</th></tr>` +
      R.res
        .map(
          (r) =>
            `<tr><td class="c">${fx(r.x, 3)}</td><td>${fx(r.dv, 0)}</td><td>${fx(r.bv, 0)}</td><td>${fx(r.es, 3)}</td><td>${fx(r.beta, 3)}</td><td>${fx(r.th, 2)}</td><td>${fx(r.Vc, 1)}</td><td>${fx(r.Vs, 1)}</td><td>${fx(r.Vr, 1)}</td><td>${fx(r.Vu, 1)}</td>${okc2(r.Vr >= r.Vu - 1e-9)}</tr>`,
        )
        .join("") +
      `<tr><td class="l" colspan="11">Vc, Vs, Vr, Vu: kN ; bước cốt đai s xem bảng dưới. Vr = 0,9.min(Vc + Vs ; 0,25f'c.bv.dv).</td></tr>`,
  );
  tb(
    "Vd",
    `<tr><th colspan="2">x (m)</th><th>Av (mm2)</th><th>Avmin (mm2)</th><th>vu (MPa)</th><th>0,125f'c</th><th>smax (mm)</th><th>s (mm)</th><th>KL</th></tr>` +
      R.res
        .map(
          (r) =>
            `<tr><td class="c" colspan="2">${fx(r.x, 3)}</td><td>${fx(r.Av, 0)}</td><td>${fx(r.Avmin, 0)}</td><td>${fx(r.vu, 3)}</td><td>${fx(0.125 * I.fc, 2)}</td><td>${fx(r.smax, 0)}</td><td>${fx(r.s, 0)}</td>${okc2(r.Av >= r.Avmin - 1e-9 && r.s <= r.smax + 1e-9)}</tr>`,
        )
        .join(""),
  );
  tb(
    "Lg",
    `<tr><th colspan="2">x (m)</th><th colspan="2">Lực kéo yêu cầu (kN)</th><th colspan="2">Lực kéo của cáp ΣApsfpx (kN)</th><th>KL</th></tr>` +
      R.res
        .map(
          (r) =>
            `<tr><td class="c" colspan="2">${fx(r.x, 3)}${tag(r)}</td><td colspan="2">${fx(r.Treq, 1)}</td><td colspan="2">${fx(r.Tprov, 1)}</td>${okc2(r.Tprov >= r.Treq - 1e-9)}</tr>`,
        )
        .join(""),
  );
  // ---- tiếp xúc ----
  set(
    `o_${k}_ift`,
    `${R.IF.t}: c = ${fx(R.IF.c, 2)} MPa ; μ = ${fx(R.IF.mu, 1)} ; K1 = ${fx(R.IF.K1, 1)} ; K2 = ${fx(R.IF.K2, 1)} MPa`,
  );
  tb(
    "If",
    `<tr><th colspan="2">x (m)</th><th>Vu (kN)</th><th>dvi (mm)</th><th>Vui (N/mm)</th><th>s (mm)</th><th>Acv (mm2/mm)</th><th>Avf (mm2/mm)</th><th>Vri (N/mm)</th><th>KL</th></tr>` +
      R.res
        .map(
          (r) =>
            `<tr><td class="c" colspan="2">${fx(r.x, 3)}</td><td>${fx(r.Vu, 1)}</td><td>${fx(r.dvi, 0)}</td><td>${fx(r.Vui, 1)}</td><td>${fx(r.s, 0)}</td><td>${fx(r.Acv, 0)}</td><td>${fx(r.Avf / r.s, 3)}</td><td>${fx(r.Vri, 1)}</td>${okc2(r.Vri >= r.Vui - 1e-9 && r.Avf / r.s >= r.Avfmin - 1e-9 && r.s <= 600)}</tr>`,
        )
        .join(""),
  );
  // ---- vùng neo ----
  const A = R.anch;
  set(`o_${k}_bw`, A.b, 0);
  set(`o_${k}_h4`, A.h4, 1);
  set(`o_${k}_AsL`, A.AsL, 0);
  set(`o_${k}_nS`, A.nS, 0);
  set(`o_${k}_AsS`, A.AsS, 0);
  set(`o_${k}_Asz`, A.Asz, 0);
  set(`o_${k}_Pi`, A.Pi, 1);
  set(`o_${k}_Pr`, A.Pr, 1);
  okn(`o_${k}_Pr`, A.Pr >= A.req, (A.Pr >= A.req ? "OK" : "NG") + " ≥ 0,04Pi = " + fx(A.req, 1));
  // ---- độ võng ----
  const C = R.camber;
  set(`o_${k}_d0`, C.d0, 1);
  set(`o_${k}_dps`, C.dps, 1);
  set(`o_${k}_dsw`, C.dsw, 1);
  set(`o_${k}_rLT`, C.rLT, 4);
  set(`o_${k}_dtd`, C.dtd, 1);
  set(`o_${k}_ddk`, C.dDeck, 1);
  set(`o_${k}_dfn`, C.dtd - C.dDeck, 1);
  set(`o_${k}_DFd`, C.DFd, 4);
  set(`o_${k}_dl1`, C.dLL1, 2);
  set(`o_${k}_dl2`, C.dLL2, 2);
  set(`o_${k}_dlim`, C.lim, 2);
  const dmax = Math.max(C.dLL1, C.dLL2);
  okn(`o_${k}_dlim`, dmax <= C.lim, (dmax <= C.lim ? "OK" : "NG") + ": max = " + fx(dmax, 2));
  set(`o_${k}_RDC`, R.Rg.DC, 1);
  set(`o_${k}_RDW`, R.Rg.DW, 1);
  // ---- tổng hợp ----
  const mx = (f) =>
    R.res.reduce(
      (a, r) => {
        const v = f(r);
        return v > a.v ? { v, r } : a;
      },
      { v: -1e9, r: null },
    );
  const nOut = ["L", "Nb", "I", "J", "th"].filter(
    (q) => R.DF.range && R.DF.range[q] === false,
  ).length;
  const items = [
    [
      "Hệ số phân bố gần đúng: số tham số ngoài phạm vi Bảng 6, 11 (L, Nb, I, J, θ) - ngoài phạm vi phải phân tích theo Điều 6.3 Phần 4",
      String(nOut),
      "= 0",
      nOut === 0,
    ],
    [
      "Nén khi truyền lực (MPa)",
      Math.max(...R.res.map((r) => Math.max(r.ft_tr, r.fb_tr))),
      "≤ " + fx(LIM.trC, 2),
      Math.max(...R.res.map((r) => Math.max(r.ft_tr, r.fb_tr))) <= LIM.trC,
    ],
    [
      "Kéo khi truyền lực (MPa)",
      Math.min(...R.res.map((r) => Math.min(r.ft_tr, r.fb_tr))),
      "Bảng 7",
      R.res.every(okTr),
    ],
    [
      "Nén thớ trên dầm, Sử dụng I + TG (MPa)",
      Math.max(...R.res.map((r) => r.ftIT)),
      "≤ " + fx(LIM.svI, 2),
      Math.max(...R.res.map((r) => r.ftIT)) <= LIM.svI,
    ],
    [
      "Nén thớ trên dầm, thường xuyên (MPa)",
      Math.max(...R.res.map((r) => r.ftP)),
      "≤ " + fx(LIM.svP, 2),
      Math.max(...R.res.map((r) => r.ftP)) <= LIM.svP,
    ],
    [
      "Ứng suất thớ dưới dầm, Sử dụng III + TG (MPa)",
      Math.min(...R.res.map((r) => r.fbIIIT)),
      "≥ " + fx(-LIM.svT, 2),
      Math.min(...R.res.map((r) => r.fbIIIT)) >= -LIM.svT - 1e-9,
    ],
    [
      "Nén bản mặt cầu, Sử dụng I + TG (MPa)",
      Math.max(...R.res.map((r) => r.fdIT)),
      "≤ " + fx(LIM.dkI, 2),
      Math.max(...R.res.map((r) => r.fdIT)) <= LIM.dkI,
    ],
    [
      "Mu/Mr lớn nhất",
      Math.max(...R.res.map((r) => (r.Mr > 0 ? r.Mu / r.Mr : 0))),
      "≤ 1",
      Math.max(...R.res.map((r) => (r.Mr > 0 ? r.Mu / r.Mr : 0))) <= 1,
    ],
    [
      "fpe nhỏ nhất / fpu (điều kiện dùng PT 23, Điều 7.3.1.1)",
      Math.min(...R.res.filter((r) => r.nb > 0).map((r) => r.fpe)) / I.fpu,
      "≥ 0,5",
      Math.min(...R.res.filter((r) => r.nb > 0).map((r) => r.fpe)) >= 0.5 * I.fpu - 1e-9,
    ],
    [
      "Ứng suất kéo căng fpj / fpu (Điều 9.3, tao tự chùng thấp căng trước)",
      I.fpjr,
      "≤ 0,75",
      I.fpjr <= 0.75 + 1e-9,
    ],
    [
      "Vu/Vr lớn nhất",
      Math.max(...R.res.map((r) => r.Vu / r.Vr)),
      "≤ 1",
      Math.max(...R.res.map((r) => r.Vu / r.Vr)) <= 1,
    ],
    [
      "Cốt thép dọc chịu kéo do cắt (Điều 8.3.5): yêu cầu / có",
      Math.max(...R.res.map((r) => r.Treq / r.Tprov)),
      "≤ 1",
      Math.max(...R.res.map((r) => r.Treq / r.Tprov)) <= 1,
    ],
    [
      "Cắt trượt mặt tiếp xúc Vui/Vri ; Avf ≥ Avf,min",
      Math.max(...R.res.map((r) => r.Vui / r.Vri)),
      "≤ 1",
      Math.max(...R.res.map((r) => r.Vui / r.Vri)) <= 1 &&
        R.res.every((r) => r.Avf / r.s >= r.Avfmin - 1e-9),
    ],
    ["Độ võng do hoạt tải (mm)", dmax, "≤ " + fx(C.lim, 2), dmax <= C.lim],
    [
      "Ứng suất cáp sau mất mát fpe lớn nhất (MPa)",
      Math.max(...R.res.map((r) => r.fpe)),
      "≤ 0,8fpy = " + fx(0.8 * I.fpyr * I.fpu, 1),
      Math.max(...R.res.map((r) => r.fpe)) <= 0.8 * I.fpyr * I.fpu,
    ],
    [
      "Cẩu lắp: ứng suất kéo nhỏ nhất (MPa)",
      Math.min(...R.lift.map((o) => Math.min(o.ft, o.fb))),
      "Bảng 7",
      R.lift.every(okL),
    ],
    ["Vùng neo: Pr / 0,04Pi", R.anch.Pr / R.anch.req, "≥ 1", R.anch.Pr >= R.anch.req],
    [
      "Mỏi: 0,5(DƯL + thường xuyên) + Mỏi I (MPa)",
      Math.max(...R.res.map((r) => r.ftFat)),
      "≤ " + fx(LIM.fat, 2),
      R.res.every((r) => r.ftFat <= LIM.fat),
    ],
    [
      "Nén bản mặt cầu, thường xuyên (MPa)",
      Math.max(...R.res.map((r) => r.fdP)),
      "≤ " + fx(LIM.dkP, 2),
      R.res.every((r) => r.fdP <= LIM.dkP),
    ],
    [
      "Cốt thép tối thiểu: Mr / min(Mcr ; 1,33Mu) nhỏ nhất",
      Math.min(...R.res.filter((r) => r.x > 0).map((r) => (r.Mmin > 0 ? r.Mr / r.Mmin : 99))),
      "≥ 1",
      R.res.filter((r) => r.x > 0).every((r) => r.Mr >= r.Mmin - 1e-9),
    ],
    [
      "Cốt thép đai: Av ≥ Av,min ; s ≤ smax",
      Math.min(...R.res.map((r) => (r.Avmin > 0 ? r.Av / r.Avmin : 99))),
      "≥ 1",
      R.res.every((r) => r.Av >= r.Avmin - 1e-9 && r.s <= r.smax + 1e-9),
    ],
    [
      "Tao mất dính bám (Điều 11.4.3): tỷ lệ bọc ống",
      Db.ratio,
      "≤ 0,25 và các điều kiện khác",
      Db.ok,
    ],
  ];
  const dbStar = !Db.ok && Db.otherOK && items.slice(0, -1).every((it) => it[3] === true);
  if (dbStar) items[items.length - 1][3] = "star";
  tb(
    "Sum",
    `<tr><th colspan="5">Hạng mục kiểm toán</th><th colspan="2">Giá trị bất lợi</th><th colspan="2">Giới hạn</th><th>KL</th></tr>` +
      items
        .map(
          (it) =>
            `<tr><td class="l" colspan="5">${it[0]}</td><td colspan="2">${typeof it[1] === "number" ? fx(it[1], 3) : it[1]}</td><td class="c" colspan="2">${it[2]}</td>${it[3] === "star" ? '<td class="c" style="color:#b45309;font-weight:bold">Chênh TCVN*</td>' : okc2(it[3])}</tr>`,
        )
        .join("") +
      (dbStar
        ? `<tr><td class="l" colspan="10">(*) Tỷ lệ tao bọc ống ${fx(100 * Db.ratio, 1)}% vượt giới hạn 25% của Điều 11.4.3. Đây là điểm không thỏa mãn quy định của Điều 11.4.3, chỉ áp dụng khi được chủ đầu tư và cơ quan thẩm định chấp thuận bằng văn bản. Căn cứ đề nghị: (1) các điều kiện còn lại của Điều 11.4.3 đều thỏa mãn; (2) yêu cầu của chính Điều 11.4.3 "chiều dài mất dính bám phải đảm bảo sức kháng phát triển đầy đủ ở mọi mặt cắt và tất cả các trạng thái giới hạn đều thỏa mãn" đã được kiểm toán trực tiếp tại mọi mặt cắt (ứng suất, uốn, cắt, cốt thép dọc chịu kéo do cắt, vùng neo - các mục trên đều đạt).</td></tr>`
        : ""),
  );
  R.allOK = items.every((it) => it[3] === true || it[3] === "star");
  klAppend(
    `tb${k}Sum`,
    R.allOK,
    10,
    dbStar ? "(có một điểm chênh TCVN cần được chấp thuận, đánh dấu *)" : "",
  );
}
