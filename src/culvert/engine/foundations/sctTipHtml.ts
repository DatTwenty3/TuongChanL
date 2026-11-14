// @ts-nocheck
/**
 * Cọc khoan nhồi — phần "Sức kháng mũi cọc" của bảng tính sức chịu tải theo đất nền (`#s2tip`).
 *
 * Chuyển NGUYÊN VĂN từ `analysis-cau-cong/modules/12_piles_geotech_mcoc_and_pm3d.js` (khối "// mũi cọc" của `sctRender`).
 * Bản dựng lại trước đây chỉ in công thức, bỏ các dòng diễn giải và giá trị trung gian (qu, GSI / mi / Dd, A, qp,HB,
 * hệ số nhóm η, φqp, Rp,CĐ / Rp,ĐB…) nên bảng tính thiếu bước. Giữ `@ts-nocheck` có chủ ý (mã chuyển nguyên văn);
 * đối chiếu bằng `tests/qa/ui_diff_original.mjs`.
 */

import { $, FR, fx, num } from '../context.ts';

export function sctTipHtml(R) {
  // Chữ mô tả mức xáo trộn Dđ; môi trường không DOM (kiểm thử headless) → chuỗi rỗng thay vì lỗi
  const dTxt = () => {
    const e = $("s2_Dd");
    const o = e && e.selectedOptions && e.selectedOptions[0];
    return o ? String(o.text).toLowerCase() : "";
  };
  const T = R.tip,
    row = (lab, sym, val, unit) =>
      `<div class="row"><span></span><span>${lab}</span><span class="sym">${sym || ""}</span><span class="val">${val ?? ""}</span><span class="unit">${unit || ""}</span></div>`;
  let h =
    row("Lớp đất tại mũi cọc: lớp " + T.name + " (" + T.type + ")") +
    row("Ứng suất hữu hiệu thẳng đứng tại mũi cọc", "σ'v", fx(T.sv, 1), "kPa");
  const fr = (t, sym, val, unit) =>
    FR(
      t,
      `<span class="sym">${sym || ""}</span><span class="val">${val ?? ""}</span><span class="unit">${unit || ""}</span>`,
    );
  if (T.type === "Sét")
    h +=
      row(
        "Cường độ kháng cắt không thoát nước (tương quan thực nghiệm theo SPT, tiêu chuẩn không quy định)",
      ) +
      fr(
        String.raw`S_u = k\,N_{60}\ (\mathrm{kPa}) \le 0.25\ \mathrm{MPa}`,
        "Su",
        fx(T.Su, 1),
        "kPa",
      ) +
      row(
        "Hệ số sức chịu tải, Z - chiều sâu chôn cọc (TCVN 11823-10:2017, Điều 8.3.5.1.3, PT 89)",
      ) +
      fr(String.raw`N_c = 6\left(1 + 0.2\,\dfrac{Z}{D}\right) \le 9`, "Nc", fx(T.Nc0, 3)) +
      (T.weak
        ? row(
            "Su < 0,024 MPa trong phạm vi 2D dưới chân cọc: Nc nhân với 0,67 (Điều 8.3.5.1.3)",
            "Nc",
            fx(T.Nc, 3),
          )
        : "") +
      row("Sức kháng mũi đơn vị (Điều 8.3.5.1.3, PT 88)") +
      fr(String.raw`q_p = N_c\,S_u \le 4.0\ \mathrm{MPa}`, "qp", fx(T.qpk, 1), "kPa");
  else if (T.type === "Cát" || T.type === "Cuội")
    h +=
      row(
        "Số búa SPT hiệu chỉnh tại mũi cọc" +
          (T.zSPT != null ? " (điểm SPT cao độ " + fx(T.zSPT, 3) + " m)" : ""),
        "N60",
        fx(T.N60, 1),
      ) +
      row(
        "Sức kháng mũi đơn vị khi N60 &lt; 50, giới hạn 3,0 MPa (TCVN 11823-10:2017, Điều 8.3.5.2.3, PT 95)",
      ) +
      fr(String.raw`q_p = 0.057\,N_{60} \le 3.0\ \mathrm{MPa}`, "qp", fx(T.qpk, 1), "kPa");
  else if (T.type === "IGM") {
    h +=
      (T.zSPT != null
        ? row(
            "Số búa SPT tại mũi cọc lấy theo điểm thí nghiệm gần nhất ở cao độ " +
              fx(T.zSPT, 3) +
              " m",
          )
        : "") +
      row(
        "Lớp IGM loại " +
          ["", "I", "II", "III"][T.igc] +
          " tại mũi cọc (TCVN 11823-10:2017, Điều 8.3.5.5, Phụ lục B) ; N60 = " +
          fx(T.N60, 1) +
          " ; qu = " +
          fx(T.qu, 2) +
          " MPa",
      );
    if (T.igc === 1)
      h +=
        row(
          "PT B5: bản in TCVN ghi 6,35N (MPa) là sai đơn vị; hệ số gốc (Abu-Hejleh và cộng sự, 2003) tính bằng psi, quy đổi 1 psi = 0,006895 MPa",
        ) +
        fr(
          String.raw`q_{BN} = 6.35\,N\ (\mathrm{psi}) = 0.0438\,N_{60}\ (\mathrm{MPa})`,
          "qp",
          fx(T.qpk, 1),
          "kPa",
        );
    else
      h +=
        row(
          "Khoảng cách vết nứt sv ; độ mở vết nứt td ; chiều sâu ngàm vào lớp Ds: " +
            fx(T.sv_, 0) +
            " mm ; " +
            fx(T.td, 1) +
            " mm ; " +
            fx(T.Ds, 2) +
            " m (PT B6 - B8)",
        ) +
        fr(String.raw`K_{sp} = \dfrac{3 + s_v/B}{10\sqrt{1 + 300\,t_d/s_v}}`, "Ksp", fx(T.Ksp, 4)) +
        fr(String.raw`d = 1 + 0.4\,\dfrac{D_s}{B} \le 3.4`, "d", fx(T.dd, 3)) +
        fr(String.raw`q_{BN} = 3\,q_u\,K_{sp}\,d`, "qp", fx(T.qpk, 1), "kPa");
  } else {
    h += row(
      "Cường độ nén một trục của đá" +
        (T.quCap ? " (lớn hơn f'c nên lấy bằng f'c)" : "") +
        " ; phương pháp: " +
        (T.mode === "I" ? "đá liền khối, PT 98" : "đá nứt nẻ, PT 99 - 100"),
      "qu",
      fx(T.qu, 2),
      "MPa",
    );
    if (T.s != null)
      h +=
        row(
          "Chỉ số GSI ; hằng số mi ; hệ số xáo trộn Dđ (" +
            dTxt() +
            "): " +
            fx(num("s2_GSI"), 0) +
            " ; " +
            fx(num("s2_mi"), 1) +
            " ; " +
            fx(num("s2_Dd"), 1),
        ) +
        row("Các thông số Hoek - Brown của khối đá nứt nẻ (TCVN 11823-10:2017, Điều 4.6.4):") +
        fr(
          String.raw`s = \exp\left(\dfrac{GSI - 100}{9 - 3D_d}\right)`,
          "s",
          T.s.toExponential(3),
        ) +
        fr(
          String.raw`a = \dfrac{1}{2} + \dfrac{1}{6}\left(e^{-GSI/15} - e^{-20/3}\right)`,
          "a",
          fx(T.a, 4),
        ) +
        fr(
          String.raw`m_b = m_i\,\exp\left(\dfrac{GSI - 100}{28 - 14D_d}\right)`,
          "mb",
          fx(T.mb, 4),
        ) +
        row(
          "Sức kháng mũi đơn vị, σ'vb - ứng suất hữu hiệu tại chân cọc (TCVN 11823-10:2017, Điều 8.3.5.4.3, PT 99 - 100):",
        ) +
        fr(
          String.raw`A = \sigma'_{vb} + q_u\left(m_b\,\dfrac{\sigma'_{vb}}{q_u} + s\right)^{a}`,
          "A",
          fx(T.Aq, 1),
          "kPa",
        ) +
        fr(
          String.raw`q_p = A + q_u\left(m_b\,\dfrac{A}{q_u} + s\right)^{a}`,
          "qp,HB",
          fx(T.qpHB, 1),
          "kPa",
        ) +
        row("PT 98 là giới hạn trên của PT 99 (Điều 8.3.5.4.3)") +
        fr(String.raw`q_p = \min\left(q_{p,HB}\;;\;2.5\,q_u\right)`, "qp", fx(T.qpk, 1), "kPa");
    else
      h +=
        row(
          "Sức kháng mũi đơn vị, đá liền khối trong phạm vi 2B dưới chân cọc, ngàm > 1,5B (TCVN 11823-10:2017, Điều 8.3.5.4.3, PT 98)",
        ) + fr(String.raw`q_p = 2.5\,q_u`, "qp", fx(T.qpk, 1), "kPa");
  }
  h +=
    row("Sức kháng mũi danh định (Điều 8.3.5)") +
    fr(String.raw`R_p = q_p\,A_p`, "Rp", fx(T.Rn, 1), "kN") +
    row("Hệ số nhóm cọc (Điều 8.3.6)", "η", fx(T.eta, 3)) +
    row("Hệ số sức kháng mũi cọc (Bảng 10, Điều 5.5.2.4)", "φqp", fx(T.phi, 2)) +
    row("Sức kháng mũi tính toán TTGH Cường độ") +
    fr(String.raw`R_{p,CD} = \varphi_{qp}\,\eta\,R_p`, "Rp,CĐ", fx(T.Rcd, 1), "kN") +
    row("Sức kháng mũi TTGH Đặc biệt, φ = 1.0 (Điều 5.5.3.3)") +
    fr(String.raw`R_{p,DB} = \eta\,R_p`, "Rp,ĐB", fx(T.Rdb, 1), "kN");
  return h;
}
