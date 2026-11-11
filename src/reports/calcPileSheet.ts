/**
 * Bảng tính móng cọc BTCT (TCVN 10304:2025): hiển thị ở tab con "Móng cọc" và được nối vào cuối
 * bảng tính chính khi bật cọc (xuất Word / PDF dùng lại HTML này).
 */

import { pileFromCalc, pileOn, type CalcRunResult, type EngineProject, type PileResult } from '../engine';
import { cnf } from './cfig';
import { sH2, sH3, sKL, sOk, sRow, sRowT, sTab, sTx } from './reportHelpers';

const METHOD_TXT: Record<string, string> = {
  tcvn: 'Theo chỉ tiêu cơ lý đất nền (Điều 7.2)',
  spt: 'Theo kết quả xuyên tiêu chuẩn SPT (Phụ lục D)',
  test: 'Theo thí nghiệm cọc (nhập trực tiếp)',
};
const TYPE_TXT: Record<string, string> = {
  sq: 'Cọc vuông BTCT đúc sẵn',
  phc: 'Cọc ly tâm ứng lực trước (PHC/PC)',
  bored: 'Cọc khoan nhồi',
};
const CLS_TXT: Record<string, string> = { C1: 'Cấp 1', C2: 'Cấp 2', C3: 'Cấp 3' };

const n = (x: number, d = 2): string => cnf(x, d);

function head(P: EngineProject, r: PileResult): string {
  const q = P.pile!;
  const g = r.grid;
  let h = sH2('Móng cọc BTCT – kiểm tra sức chịu tải theo TCVN 10304:2025');
  h += sRowT('Loại cọc', TYPE_TXT[q.type] ?? q.type);
  h += sRow('Kích thước tiết diện', q.type === 'sq' ? 'b' : 'D', n(q.size, 2), 'm');
  h += sRow('Chiều dài cọc dưới đáy đài', 'L', n(q.L, 2), 'm');
  h += sRow('Đáy đài cách mặt đất tự nhiên', 'z<sub>0</sub>', n(q.design.z0, 2), 'm');
  h += sRow('Số hàng cọc theo phương ngang', 'n<sub>x</sub>', g.rows.length, '');
  h += sRow('Số cọc trong một đơn nguyên', 'n', g.n, 'cọc');
  h += sRow('Bước tính tải trên một cọc dọc tường', 's', n(r.sEff, 2), 'm');
  h += sRowT('Phương pháp xác định sức chịu tải', METHOD_TXT[q.method] ?? q.method);
  h += sRow('Hệ số tin cậy về tầm quan trọng', 'γ<sub>n</sub>', n(r.gn, 2), '', CLS_TXT[q.design.cls] ?? '');
  return h;
}

function layersTable(P: EngineProject): string {
  const q = P.pile!;
  const rows: string[][] = [];
  let z = 0;
  const SOIL: Record<string, string> = { sand: 'Đất rời', clay: 'Đất dính', rock: 'Đá' };
  q.layers.forEach((l, i) => {
    rows.push([
      String(i + 1),
      l.name,
      SOIL[l.kind] ?? l.kind,
      `${n(z, 1)} – ${n(z + l.thk, 1)}`,
      n(l.gamma, 1),
      l.kind === 'clay' ? n(l.IL, 2) : '–',
      l.N > 0 ? n(l.N, 0) : '–',
    ]);
    z += l.thk;
  });
  return (
    sH3('Địa tầng (độ sâu từ đáy đài)') +
    sTab(['TT', 'Lớp đất', 'Loại', 'Độ sâu (m)', 'γ (kN/m³)', 'I<sub>L</sub>', 'N<sub>SPT</sub>'], rows, ['l', 'l', 'l', 'l', '', '', ''])
  );
}

function capacity(r: PileResult): string {
  const c = r.comp!;
  let h = sH3('Sức chịu tải cực hạn của cọc đơn khi nén');
  h += sRow('Diện tích tiết diện mũi cọc', 'A', n(c.A, 4), 'm²');
  h += sRow('Chu vi tiết diện cọc', 'u', n(c.u, 3), 'm');
  if (c.method !== 'test') {
    h += sRow('Sức kháng đơn vị dưới mũi cọc', 'q<sub>b</sub>', n(c.qb, 0), 'kPa', c.qbSrc);
    h += sRow('Hệ số điều kiện làm việc dưới mũi', 'γ<sub>R,R</sub>', n(c.gRR, 2), '');
    h += sRow('Hệ số điều kiện làm việc của cọc', 'γ<sub>c</sub>', n(c.gc, 2), '');
    if (c.rows.length) {
      h += sTab(
        ['Lớp đất', 'Từ (m)', 'Đến (m)', 'h<sub>i</sub> (m)', 'z (m)', 'f<sub>i</sub> (kPa)', 'γ<sub>R,f</sub>', 'γ<sub>R,f</sub>·f<sub>i</sub>·h<sub>i</sub> (kN/m)', 'Ghi chú'],
        c.rows.map((x) => [
          x.layer,
          n(x.from, 2),
          n(x.to, 2),
          n(x.hi, 2),
          n(x.zNat, 2),
          n(x.fi, 1),
          n(x.gRf, 2),
          n(x.term, 2),
          x.note ?? '',
        ]),
        ['l', '', '', '', '', '', '', '', 'l'],
      );
    }
    h += sRow('Thành phần sức kháng mũi', 'R<sub>b</sub> = γ<sub>R,R</sub>·q<sub>b</sub>·A', n(c.Rb, 1), 'kN');
    h += sRow('Thành phần ma sát hông', 'R<sub>f</sub> = u·Σγ<sub>R,f</sub>f<sub>i</sub>h<sub>i</sub>', n(c.Rf, 1), 'kN');
  }
  h += sRow('Sức chịu tải tiêu chuẩn của cọc', 'R<sub>k</sub>', n(c.Rk, 1), 'kN');
  h += sRow('Hệ số tin cậy theo đất', 'γ<sub>k</sub>', n(c.gk, 2), '', c.gkNote);
  h += sRow('Sức chịu tải tính toán', 'R<sub>d</sub> = R<sub>k</sub>/γ<sub>k</sub>', n(c.Rd, 1), 'kN');
  for (const t of c.notes) h += sTx(t);
  return h;
}

function reactions(r: PileResult): string {
  const nx = r.grid.rows.length;
  const head = ['Tổ hợp', 'N (kN/m)', 'e (m)'];
  for (let i = 0; i < nx; i++) head.push(`Hàng ${i + 1} (kN)`);
  const rows = r.reactions.map((x) => [
    x.nm,
    n(x.Nwall, 1),
    n(x.s, 3),
    ...x.rows.map((v) => n(v + r.WpComp, 1)),
  ]);
  let h = sH3('Phản lực đầu cọc theo các tổ hợp tải của tường');
  h += sTx(
    'Nd = N·s/n<sub>x</sub> + N·s·e·(x<sub>i</sub> − x<sub>c</sub>)/Σ(x<sub>j</sub> − x<sub>c</sub>)² (+ trọng lượng bản thân cọc); e là độ lệch tâm của hợp lực so với tâm các hàng cọc.',
  );
  h += sTab(head, rows, ['l', ...head.slice(1).map(() => '')]);
  h += sRow('Trọng lượng bản thân cọc', 'W<sub>p</sub>', n(r.Wp, 1), 'kN', r.WpComp ? `nhân hệ số 1,1 khi nén → ${n(r.WpComp, 1)} kN` : 'không kể');
  return h;
}

function verdict(r: PileResult): string {
  const c = r.comp!;
  let h = sH3('Kiểm tra');
  h += sRow('Tải nén lớn nhất lên một cọc', 'N<sub>d,max</sub>', n(r.NdMax, 1), 'kN', r.NdMaxAt);
  h += sRow('Điều kiện', 'γ<sub>n</sub>·N<sub>d</sub> ≤ R<sub>d</sub>', `${n(r.gn * r.NdMax, 1)} ≤ ${n(c.Rd, 1)}`, 'kN', `hệ số sử dụng ${n(r.vAxial ?? 0, 2)}`);
  h += sKL(
    (r.vAxial ?? 99) <= 1,
    `Cọc đủ khả năng chịu nén (${sOk(true)}).`,
    `Cọc không đủ khả năng chịu nén (${sOk(false)}).`,
  );
  if (r.NdTens > 0) {
    h += sRow('Lực nhổ lớn nhất lên một cọc', 'N<sub>d,nhổ</sub>', n(r.NdTens, 1), 'kN', r.NdTensAt);
    if (r.tens) {
      h += sRow('Sức chịu nhổ tiêu chuẩn', 'R<sub>k,nhổ</sub>', n(r.tens.Rk, 1), 'kN', `γ<sub>c</sub> = ${n(r.tens.gc, 1)}`);
      h += sRow('Sức chịu nhổ tính toán', 'R<sub>d,nhổ</sub>', n(r.tens.Rd, 1), 'kN', `γ<sub>k</sub> = ${n(r.tens.gk, 2)}`);
      h += sKL(
        (r.vUplift ?? 99) <= 1,
        'Cọc đủ khả năng chịu nhổ.',
        'Cọc không đủ khả năng chịu nhổ.',
      );
    } else {
      h += sTx('Chưa có công thức sức chịu nhổ cho phương pháp đã chọn.');
    }
  }
  return h;
}

/** HTML mục "Móng cọc" (rỗng khi tắt cọc). */
export function calcPileSheetHtml(P: EngineProject, R: CalcRunResult | null | undefined): string {
  if (!pileOn(P)) return '';
  const r = pileFromCalc(P, R);
  if (!r) {
    return sH2('Móng cọc BTCT') + sTx('Chưa tính được: kết quả tính tường chưa hợp lệ.');
  }
  let h = head(P, r) + layersTable(P);
  if (!r.ok || !r.comp) {
    h += sH3('Chưa đủ số liệu');
    for (const m of r.missing) h += `<p class="kl bad">${m}</p>`;
  } else {
    h += capacity(r) + reactions(r) + verdict(r);
  }
  if (r.warn.length) {
    h += sH3('Lưu ý');
    for (const w of r.warn) h += sTx(w);
  }
  h += sTx(
    'Ghi chú: tải trọng lấy từ các tổ hợp của tường theo TCVN 11823 (đã nhân hệ số), sức kháng của cọc theo TCVN 10304:2025; các bảng tra được nhúng sẵn, nội suy tuyến tính theo độ sâu và độ sệt.',
  );
  return h;
}
