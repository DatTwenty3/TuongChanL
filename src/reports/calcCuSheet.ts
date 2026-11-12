/**
 * Bảng tính móng cừ tràm: hiển thị ở tab con "Cừ tràm" và được nối vào cuối bảng tính chính khi bật
 * (xuất Word / PDF dùng lại HTML này).
 */

import { cuFromCalc, cuOn, type CalcRunResult, type CuResult, type EngineProject } from '../engine';
import { cnf } from './cfig';
import { sH2, sH3, sKL, sOk, sRow, sRowT, sTab, sTx } from './reportHelpers';

const n = (x: number, d = 2): string => cnf(x, d);

function inputs(P: EngineProject, r: CuResult): string {
  const q = P.cu!;
  let h = sH2('Móng cừ tràm gia cố nền dưới bản đáy');
  h += sRow('Đường kính thân trung bình', 'd', n(q.d, 1), 'cm');
  h += sRow('Chiều dài cừ', 'L<sub>cừ</sub>', n(q.L, 2), 'm');
  h += sRow('Mật độ đóng', 'n', n(q.n, 0), 'cây/m²', `khoảng cách tim ≈ ${n(r.spacing * 100, 0)} cm; ${r.nTotal} cây trong một đơn nguyên`);
  h += sRow('Bề rộng bản đáy', 'B<sub>m</sub>', n(r.B, 2), 'm');
  h += sRow('Chiều dài đơn nguyên', 'L<sub>m</sub>', n(r.Lu, 2), 'm');
  h += sRow('Chiều sâu chôn móng', 'h<sub>m</sub>', n(q.hm, 2), 'm');
  h += sRow('Góc ma sát trong của đất yếu', 'φ', n(q.phi, 2), 'độ');
  h += sRow('Dung trọng của đất yếu', 'γ', n(q.gamma, 2), 'kN/m³');
  h += sRow('Lực dính của đất yếu', 'c', n(q.c, 2), 'kPa');
  h += sRow('Dung trọng đất trên đáy móng', 'γ’', n(q.gammaAbove ?? q.gamma, 2), 'kN/m³');
  return h;
}

function natural(P: EngineProject, r: CuResult): string {
  const q = P.cu!;
  let h = sH3('1. Sức chịu tải của đất nền khi chưa có cừ tràm');
  h += sTx('R<sub>tc</sub> = m<sub>1</sub>·m<sub>2</sub>/k<sub>tc</sub> · (A·B<sub>m</sub>·γ + B·h<sub>m</sub>·γ’ + D·c); A = 0,25π/(cotgφ + φ − π/2), B = 1 + 4A, D = π·cotgφ/(cotgφ + φ − π/2).');
  h += sRow('Hệ số', 'A ; B ; D', `${n(r.abd.A, 4)} ; ${n(r.abd.B, 4)} ; ${n(r.abd.D, 4)}`, '');
  h += sRow('Hệ số', 'm<sub>1</sub> ; m<sub>2</sub> ; k<sub>tc</sub>', `${n(q.m1, 2)} ; ${n(q.m2, 2)} ; ${n(q.ktc, 2)}`, '');
  h += sRow('Sức chịu tải tiêu chuẩn của nền tự nhiên', 'R<sub>tc</sub>', n(r.Rtc, 1), 'kPa');
  h += sRow('Áp lực tiêu chuẩn dưới đáy móng', 'p<sub>tc</sub>', n(r.pSd, 1), 'kPa', r.pSdAt);
  h += sTx(
    r.pSd <= r.Rtc
      ? 'Nền tự nhiên đủ khả năng chịu áp lực tiêu chuẩn; cừ tràm làm tăng độ an toàn và giảm lún.'
      : 'Nền tự nhiên không đủ khả năng chịu lực: cần gia cố nền.',
  );
  return h;
}

function block(P: EngineProject, r: CuResult): string {
  const q = P.cu!;
  const b = r.block;
  let h = sH3('2. Khả năng chịu tải của khối móng cừ tràm');
  h += sTx('Khối đất – cừ làm việc như một móng sâu: Q<sub>m</sub> = (γ·Z·N’<sub>q</sub> + c·N’<sub>c</sub>)·F<sub>m</sub> với Z = h<sub>m</sub> + L<sub>cừ</sub>; Q<sub>f</sub> = c·F<sub>xq</sub>; Q<sub>tk</sub> = Q<sub>m</sub>/FS<sub>m</sub> + Q<sub>f</sub>/FS<sub>f</sub>.');
  h += sRow('Hệ số sức chịu tải (cắt cục bộ)', 'N’<sub>c</sub> ; N’<sub>q</sub> ; N’<sub>γ</sub>', `${n(b.Nc, 2)} ; ${n(b.Nq, 2)} ; ${n(b.Ng, 3)}`, '');
  h += sRow('Diện tích đáy móng', 'F<sub>m</sub>', n(b.Am, 2), 'm²');
  h += sRow('Diện tích xung quanh khối cừ', 'F<sub>xq</sub> = 2(B<sub>m</sub> + L<sub>m</sub>)·L<sub>cừ</sub>', n(b.Fxq, 1), 'm²');
  h += sRow('Khả năng chịu mũi', 'Q<sub>m</sub>', n(b.Qm, 0), 'kN');
  h += sRow('Khả năng bám dính xung quanh', 'Q<sub>f</sub>', n(b.Qf, 0), 'kN');
  h += sRow('Hệ số an toàn', 'FS<sub>m</sub> ; FS<sub>f</sub>', `${n(q.fsTip, 2)} ; ${n(q.fsSide, 2)}`, '');
  h += sRow('Sức chịu tải thiết kế của khối', 'Q<sub>tk</sub>', n(b.Qtk, 0), 'kN');
  h += sRow('Sức chịu tải thiết kế trên 1 m²', 'q<sub>tk</sub> = Q<sub>tk</sub>/F<sub>m</sub>', n(b.qtk, 1), 'kPa');
  h += sRow('Điều kiện', 'p<sub>tc</sub> ≤ q<sub>tk</sub>', `${n(r.pSd, 1)} ≤ ${n(b.qtk, 1)}`, 'kPa', `hệ số sử dụng ${n(r.vBlock, 2)}`);
  h += sKL(r.vBlock <= 1, `Khối móng cừ tràm đủ khả năng chịu tải (${sOk(true)}).`, `Khối móng cừ tràm không đủ khả năng chịu tải (${sOk(false)}).`);
  return h;
}

function single(P: EngineProject, r: CuResult): string {
  const q = P.cu!;
  const s = r.single;
  let h = sH3('3. Sức chịu tải của từng cây cừ và số cây cần thiết');
  h += sTx('Q<sub>c</sub> = m·(m<sub>R</sub>·R·F + u·Σ m<sub>f</sub>·f<sub>i</sub>·l<sub>i</sub>) – tính như móng cọc đài thấp theo đất nền.');
  h += sRow('Tiết diện ngang của cừ', 'F', n(s.F * 1e4, 1), 'cm²');
  h += sRow('Chu vi tiết diện', 'u', n(s.u, 4), 'm');
  h += sRow('Sức chống của đất dưới mũi cừ', 'R', n(q.Rtip, 0), 'kPa');
  h += sTab(
    ['Đoạn', 'l<sub>i</sub> (m)', 'Độ sâu tra (m)', 'f<sub>i</sub> (kPa)', 'f<sub>i</sub>·l<sub>i</sub> (kN/m)'],
    s.segs.map((x, i) => [String(i + 1), n(x.l, 2), n(x.z, 2), n(x.f, 1), n(x.f * x.l, 2)]),
    ['l', '', '', '', ''],
  );
  h += sRow('Tổng ma sát bên', 'Σ f<sub>i</sub>·l<sub>i</sub>', n(s.sumFl, 2), 'kN/m');
  h += sRow('Hệ số', 'm ; m<sub>R</sub> ; m<sub>f</sub>', `${n(q.m, 2)} ; ${n(q.mR, 2)} ; ${n(q.mf, 2)}`, '');
  h += sRow('Sức chịu tải của một cây cừ', 'Q<sub>c</sub>', n(s.Qc, 2), 'kN', `mũi ${n(s.Qtip, 2)} + ma sát ${n(s.Qside, 2)}`);
  h += sRow('Áp lực tính toán dưới đáy móng', 'p<sub>tt</sub>', n(r.pTt, 1), 'kPa', r.pTtAt);
  h += sRow('Số cây cần trên 1 m²', 'n<sub>yc</sub> = p<sub>tt</sub>/Q<sub>c</sub>', `${n(r.nReqRaw, 1)} → ${r.nReq}`, 'cây/m²');
  h += sRow('Điều kiện', 'n<sub>yc</sub> ≤ n', `${r.nReq} ≤ ${n(q.n, 0)}`, 'cây/m²', `hệ số sử dụng ${n(r.vCount, 2)}`);
  h += sKL(r.vCount <= 1, `Mật độ cừ đã chọn đủ chịu lực (${sOk(true)}).`, `Mật độ cừ đã chọn chưa đủ: cần tăng số cây hoặc chiều dài cừ (${sOk(false)}).`);
  return h;
}

function base(P: EngineProject, r: CuResult): string {
  const q = P.cu!;
  let h = sH3('4. Kiểm tra đất dưới mũi cừ (đáy móng khối quy ước)');
  h += sTx('B<sub>qu</sub> = B<sub>m</sub> + 2·L<sub>cừ</sub>·tg(φ/4); σ = σ<sub>bt</sub> + p<sub>tt</sub> ≤ R = (1/k<sub>tc</sub>)·(1,1·A·B<sub>qu</sub>·γ + 1,1·B·H<sub>M</sub>·γ’ + 3·D·c).');
  h += sRow('Bề rộng móng khối quy ước', 'B<sub>qu</sub>', n(r.Bqu, 3), 'm');
  h += sRow('Chiều sâu đáy khối quy ước', 'H<sub>M</sub> = h<sub>m</sub> + L<sub>cừ</sub>', n(r.HM, 2), 'm');
  h += sRow('Áp lực bản thân tại đáy khối', 'σ<sub>bt</sub> = γ·H<sub>M</sub>', n(r.sigBt, 1), 'kPa');
  h += sRow('Ứng suất tại đáy khối quy ước', 'σ', n(r.sigBase, 1), 'kPa');
  h += sRow('Sức chịu tải của đất dưới mũi cừ', 'R', n(r.RBase, 1), 'kPa', `k<sub>tc</sub> = ${n(q.ktcBlock, 2)}`);
  h += sRow('Điều kiện', 'σ ≤ R', `${n(r.sigBase, 1)} ≤ ${n(r.RBase, 1)}`, 'kPa', `hệ số sử dụng ${n(r.vBase, 2)}`);
  h += sKL(r.vBase <= 1, `Đất dưới mũi cừ đủ khả năng chịu lực (${sOk(true)}).`, `Đất dưới mũi cừ không đủ khả năng chịu lực (${sOk(false)}).`);
  return h;
}

/** HTML mục "Cừ tràm" (rỗng khi tắt). */
export function calcCuSheetHtml(P: EngineProject, R: CalcRunResult | null | undefined): string {
  if (!cuOn(P)) return '';
  const r = cuFromCalc(P, R);
  if (!r) {
    return sH2('Móng cừ tràm') + sTx('Chưa tính được: kết quả tính tường chưa hợp lệ.');
  }
  let h = inputs(P, r) + natural(P, r) + block(P, r) + single(P, r) + base(P, r);
  if (r.warn.length) {
    h += sH3('Lưu ý');
    for (const w of r.warn) h += sTx(w);
  }
  h += sRowT('Căn cứ', 'Tính toán và thiết kế móng cừ tràm (ThS Lê Anh Hoàng); 20TCN 21-86; 20TCN 45-78.');
  h += sTx(
    'Ghi chú: áp lực dưới đáy móng lấy từ các tổ hợp của tường theo TCVN 11823, phân bố đều trên bề rộng hữu hiệu B − 2e (p<sub>tc</sub> từ tổ hợp sử dụng, p<sub>tt</sub> từ tổ hợp cường độ lớn nhất). Chưa tính lún của móng khối quy ước; kết quả cần được kiểm chứng bằng thí nghiệm nén tĩnh trên 1 m² cừ tràm.',
  );
  return h;
}
