/**
 * Bảng tính lún cố kết của nền dưới bản đáy: hiển thị ở tab con "Lún" và được nối vào cuối bảng tính chính
 * khi bật (xuất Word / PDF dùng lại HTML này).
 */

import { cuOn, lunFromCalc, lunOn, type CalcRunResult, type EngineProject, type LunResult } from '../engine';
import { cnf } from './cfig';
import { sH2, sH3, sKL, sOk, sRow, sRowT, sTab, sTx } from './reportHelpers';

const n = (x: number, d = 2): string => cnf(x, d);
const CS: Record<number, string> = { 1: 'TH1', 2: 'TH2', 3: 'TH3' };

function inputs(P: EngineProject, r: LunResult): string {
  const q = P.lun!;
  const hm = cuOn(P) ? P.cu!.hm : q.hm;
  let h = sH2('Độ lún cố kết của nền dưới bản đáy');
  h += sRow('Bề rộng bản đáy', 'B', n(r.B, 2), 'm');
  h += sRow('Đáy bản đáy dưới mặt đất tự nhiên', 'h<sub>m</sub>', n(hm, 2), 'm');
  h += sRow('Mực nước ngầm dưới mặt đất tự nhiên', 'h<sub>w</sub>', n(q.hw, 2), 'm');
  h += sRow('Áp lực tiêu chuẩn trung bình dưới đáy móng', 'p = N/B', n(r.p, 1), 'kPa', r.pAt);
  h += sRow('Áp lực bản thân của đất tại đáy móng', 'σ<sub>bt</sub>', n(r.sv0, 1), 'kPa');
  if (r.z0 > 0) {
    h += sRow('Mặt truyền tải: mũi cừ tràm, sâu dưới đáy móng', 'z<sub>0</sub>', n(r.z0, 2), 'm');
    h += sRow('Bề rộng móng khối quy ước', 'B<sub>qu</sub>', n(r.Bq, 3), 'm');
    h += sRow('Áp lực gây lún tại mũi cừ', 'p<sub>gl</sub> = (p − σ<sub>bt</sub>)·B/B<sub>qu</sub>', n(r.pNet, 1), 'kPa');
  } else {
    h += sRow('Áp lực gây lún tại đáy móng', 'p<sub>gl</sub> = p − σ<sub>bt</sub>', n(r.pNet, 1), 'kPa');
  }
  h += sRow(
    'Tải của đất đắp sau gót tường',
    'q',
    n(r.qBack, 1),
    'kPa',
    q.backfill ? 'tải nửa mặt phẳng, mép cách trục đáy B/2' : 'không kể',
  );
  return h;
}

function layers(P: EngineProject): string {
  const q = P.lun!;
  let z = 0;
  const rows = q.layers.map((l, i) => {
    const row = [
      String(i + 1),
      l.name,
      n(l.thk, 2),
      n(z + l.thk, 2),
      n(l.gamma, 1),
      n(l.e0, 3),
      l.Cv > 0 ? n(l.Cv, 2) : '–',
      l.Cc > 0 ? n(l.Cc, 3) : '–',
      l.Cc > 0 ? n(l.Cr, 3) : '–',
      l.Pc > 0 ? n(l.Pc, 1) : '–',
    ];
    z += l.thk;
    return row;
  });
  return (
    sH3('1. Số liệu đất nền (độ sâu tính từ đáy bản đáy)') +
    sTab(
      ['TT', 'Lớp đất', 'Dày (m)', 'Đáy lớp (m)', 'γ (kN/m³)', 'e<sub>0</sub>', 'C<sub>v</sub> (10⁻⁴ cm²/s)', 'C<sub>c</sub>', 'C<sub>r</sub>', 'P<sub>c</sub> (kPa)'],
      rows,
      ['l', 'l', '', '', '', '', '', '', '', ''],
    )
  );
}

function theory(): string {
  let h = sH3('2. Lý thuyết tính toán');
  h += sTx('Độ lún cố kết S<sub>c</sub> tính theo phương pháp phân tầng lấy tổng; với mỗi phân tố dày H<sub>i</sub>, ứng suất bản thân σ<sub>vz</sub> và ứng suất gây lún σ<sub>z</sub> lấy tại giữa phân tố:');
  h += sTx('TH1 – đất cố kết thường hoặc chưa cố kết (σ<sub>vz</sub> ≥ P<sub>c</sub>): S<sub>i</sub> = H<sub>i</sub>/(1 + e<sub>0</sub>)·C<sub>c</sub>·lg((σ<sub>vz</sub> + σ<sub>z</sub>)/σ<sub>vz</sub>).');
  h += sTx('TH2 – đất quá cố kết, σ<sub>vz</sub> + σ<sub>z</sub> &lt; P<sub>c</sub>: S<sub>i</sub> = H<sub>i</sub>/(1 + e<sub>0</sub>)·C<sub>r</sub>·lg((σ<sub>vz</sub> + σ<sub>z</sub>)/σ<sub>vz</sub>).');
  h += sTx('TH3 – đất quá cố kết, σ<sub>vz</sub> + σ<sub>z</sub> ≥ P<sub>c</sub>: S<sub>i</sub> = H<sub>i</sub>/(1 + e<sub>0</sub>)·[C<sub>r</sub>·lg(P<sub>c</sub>/σ<sub>vz</sub>) + C<sub>c</sub>·lg((σ<sub>vz</sub> + σ<sub>z</sub>)/P<sub>c</sub>)].');
  h += sTx('Ứng suất gây lún tại trục giữa đáy: σ<sub>z</sub> = p<sub>gl</sub>·K + q·K<sub>q</sub>, với K = (2β + sin 2β)/π, β = arctg(B/2z) (tải băng) và K<sub>q</sub> = (π/2 − arctg(x/z) − x·z/(x² + z²))/π, x = B/2 (đất đắp sau gót).');
  return h;
}

function table(P: EngineProject, r: LunResult): string {
  const q = P.lun!;
  const rows = r.rows.map((x, i) => [
    String(i + 1),
    x.name,
    n(x.h, 2),
    n(x.z, 2),
    n(x.sv, 1),
    n(x.sz, 1),
    x.Pc > 0 ? n(x.Pc, 1) : '–',
    n(x.ratio, 2),
    x.skip ? 'trong khối cừ' : x.on ? CS[x.cs] : 'dừng',
    x.on ? n(x.s * 100, 2) : '–',
  ]);
  let h = sH3('3. Kết quả tính lún');
  h += sTab(
    ['TT', 'Lớp', 'H<sub>i</sub> (m)', 'z (m)', 'σ<sub>vz</sub> (kPa)', 'σ<sub>z</sub> (kPa)', 'P<sub>c</sub> (kPa)', 'σ<sub>z</sub>/σ<sub>vz</sub>', 'Trường hợp', 'S<sub>i</sub> (cm)'],
    rows,
    ['l', 'l', '', '', '', '', '', '', 'l', ''],
  );
  h += sTx(`Dừng tính lún khi σ<sub>z</sub>/σ<sub>vz</sub> &lt; ${n(q.stop, 2)}.`);
  h += sRow('Chiều sâu vùng tính lún', 'Z<sub>a</sub>', n(r.Za, 2), 'm');
  h += sRow('Độ lún cố kết', 'S<sub>c</sub>', n(r.Sc * 100, 2), 'cm');
  h += sRow('Tổng độ lún', `S = ${n(q.m, 2)}·S<sub>c</sub>`, n(r.S * 100, 2), 'cm');
  return h;
}

function time(P: EngineProject, r: LunResult): string {
  const q = P.lun!;
  if (!(r.Cv > 0) || !(r.Za > 0)) {
    return sH3('4. Dự báo độ lún theo thời gian') + sTx('Không có lớp nào khai báo C<sub>v</sub> &gt; 0 trong vùng tính lún nên không dự báo được.');
  }
  const pick = r.time.filter((t) => t.t <= 5 || t.t % 5 === 0 || t.t === q.years);
  let h = sH3('4. Dự báo độ lún theo thời gian');
  h += sRow('Hệ số cố kết trung bình', 'C<sub>vtb</sub> = z<sub>a</sub>²/(Σ h<sub>i</sub>/√C<sub>vi</sub>)²', n(r.Cv, 3), '10⁻⁴ cm²/s', `z<sub>a</sub> = ${n(r.zaCv, 2)} m`);
  h += sRowT('Điều kiện thoát nước', q.drain === 2 ? 'Hai chiều (H = Z<sub>a</sub>/2)' : 'Một chiều (H = Z<sub>a</sub>)');
  h += sTx('T<sub>v</sub> = C<sub>vtb</sub>·t/H²; U<sub>v</sub> tra bảng theo T<sub>v</sub>; S<sub>t</sub> = S<sub>c</sub>·U<sub>v</sub>; S<sub>r</sub> = S<sub>c</sub> − S<sub>t</sub> (1 năm = 360 ngày).');
  h += sTab(
    ['t (năm)', 'T<sub>v</sub>', 'U<sub>v</sub> (%)', 'S<sub>t</sub> (cm)', 'S<sub>r</sub> (cm)'],
    pick.map((t) => [String(t.t), n(t.Tv, 4), n(t.U * 100, 1), n(t.St * 100, 2), n(t.Sr * 100, 2)]),
    ['', '', '', '', ''],
  );
  return h;
}

/** HTML mục "Lún" (rỗng khi tắt). */
export function calcLunSheetHtml(P: EngineProject, R: CalcRunResult | null | undefined): string {
  if (!lunOn(P)) return '';
  const r = lunFromCalc(P, R);
  if (!r) return sH2('Độ lún cố kết') + sTx('Chưa tính được: kết quả tính tường chưa hợp lệ.');
  const q = P.lun!;
  let h = inputs(P, r) + layers(P) + theory() + table(P, r) + time(P, r);
  h += sH3('5. Kết luận');
  h += sRow('Điều kiện', 'S ≤ [S]', `${n(r.S * 100, 1)} ≤ ${n(q.Slim, 0)}`, 'cm', `hệ số sử dụng ${n(r.v, 2)}`);
  h += sKL(
    r.v <= 1,
    `Đất nền đảm bảo điều kiện độ lún (${sOk(true)}).`,
    `Đất nền không đảm bảo điều kiện độ lún – cần có biện pháp gia cố (${sOk(false)}).`,
  );
  if (r.warn.length) {
    h += sH3('Lưu ý');
    for (const w of r.warn) h += sTx(w);
  }
  h += sTx(
    'Ghi chú: phương pháp và các hệ số theo bảng tính dự báo độ lún nền đắp (phân tầng lấy tổng, S = m·S<sub>c</sub>); tải gây lún của tường lấy từ tổ hợp sử dụng theo TCVN 11823. Chưa xét lún tức thời riêng, lún từ biến và ảnh hưởng của quá trình thi công.',
  );
  return h;
}
