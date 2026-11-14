/**
 * BangTinhCauCong Web App — Standard Reference Lookup Tables (`LK` / `MAP`),
 * Caption Centering, Table Auto-Fit & Formula Shrink Utilities.
 *
 * Clean-room TypeScript port of `analysis-cau-cong/modules/19_lookup_caption_mode_guard.js`
 * (lines 1–950), adapted to safely execute in Browser, React StrictMode, jsdom, and Node.
 */

import { $, CONTEXT_PREFIXES, getOutputValue } from '../context';

// ---------------------------------------------------------------------------
// 1. Verbatim Lookup Modal / Table / SVG Styles (lines 5–19)
// ---------------------------------------------------------------------------

export const LOOKUP_TRIGGER_STYLE_CSS = `.tra{font:bold 12px var(--f-sheet);color:#1f4e79;background:#fff;border:1px solid #1f4e79;border-radius:3px;padding:0 6px;margin-left:6px;cursor:pointer;vertical-align:1px;line-height:16px}
.tra:hover{background:#1f4e79;color:#fff}.tra:focus-visible{outline:2px solid var(--in-ink);outline-offset:1px}`;

export const LOOKUP_STYLE_CSS = `#lkBg{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:50;display:flex;align-items:flex-start;justify-content:center;padding:4vh 16px}
#lkBg[hidden]{display:none}
#lkBox{background:#fff;color:var(--ink);width:min(880px,100%);max-height:92vh;overflow:auto;box-shadow:0 4px 18px rgba(0,0,0,.35);border-radius:4px;font:15px/1.35 var(--f-sheet)}
#lkHd{position:sticky;top:0;background:#1f4e79;color:#fff;display:flex;align-items:center;gap:10px;padding:8px 14px;font-weight:bold}
#lkHd span{flex:1}#lkHd button{font:bold 15px var(--f-sheet);background:#fff;color:#1f4e79;border:0;border-radius:3px;padding:2px 10px;cursor:pointer}
#lkBd{padding:10px 16px 16px}#lkBd h4{margin:12px 0 4px;font-size:15px}#lkBd p{margin:4px 0}
#lkBd table{border-collapse:collapse;margin:4px auto 8px;font-variant-numeric:tabular-nums}
#lkBd th,#lkBd td{border:1px solid var(--rule);padding:2px 7px;text-align:center}
#lkBd th{background:var(--head)}#lkBd td.l{text-align:left}
#lkBd td[data-v]{color:var(--in-ink);text-decoration:underline;cursor:pointer;font-weight:bold}
#lkBd td[data-v]:hover{background:var(--in-bg)}
#lkBd .hint{font-size:13px;color:var(--muted)}#lkBd .warn{font-size:13px;background:#fff4ce;border:1px solid #e0c060;padding:4px 8px;margin:6px 0}
#lkBd svg{display:block;margin:6px auto}#lkBd svg text{font-family:var(--f-sheet);font-size:12px;fill:#000}`;

// ---------------------------------------------------------------------------
// 2. Public Types & Contracts
// ---------------------------------------------------------------------------

export interface LookupEntry {
  id: string;
  t: string;
  f: () => string;
}

export type LookupTargetSpec = string | { q: string; p?: boolean };

export interface LookupBinding {
  k: string;
  w: LookupTargetSpec;
}

export interface ResolvedLookupBinding extends LookupBinding {
  host: Element;
  target: HTMLInputElement | HTMLSelectElement | null;
}

// ---------------------------------------------------------------------------
// 3. Internal HTML / Numeric Helpers (lines 31–42)
// ---------------------------------------------------------------------------

interface CellSpec {
  v?: number | string;
  t?: string;
  l?: number | boolean;
  for?: string;
  cs?: number;
  rs?: number;
}

type CellInput = string | CellSpec;

const vn = (x: number | string): string => String(x).replace('.', ',');

const T = (head: readonly string[], rows: readonly CellInput[][]): string =>
  `<table><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr>${rows
    .map(
      (r) =>
        `<tr>${r
          .map((c) =>
            typeof c === 'object' && c
              ? `<td${c.v !== undefined ? ` data-v="${c.v}"` : ''}${c.l ? ' class="l"' : ''}${c.for ? ` data-for="${c.for}"` : ''}${c.cs ? ` colspan="${c.cs}"` : ''}${c.rs ? ` rowspan="${c.rs}"` : ''}>${c.t !== undefined ? c.t : vn(c.v!)}</td>`
              : `<td>${c}</td>`,
          )
          .join('')}</tr>`,
    )
    .join('')}</table>`;

const L = (t: string): CellSpec => ({ t, l: 1 });
const P = (v: number | string, t?: string): CellSpec => ({ v, t: t !== undefined ? t : vn(v) });
const HINT = '<p class="hint">Bấm vào giá trị gạch chân để điền vào ô nhập.</p>';
const CHK =
  '<p class="warn">Bảng số hoá lại để tra nhanh; khi lập hồ sơ chính thức cần đối chiếu bản in tiêu chuẩn.</p>';

function fg(id: string): number {
  const e = $(id);
  if (e) {
    const raw = e.textContent ?? '';
    const parsed = parseFloat(String(raw).replace(',', '.'));
    if (Number.isFinite(parsed)) return parsed;
  }
  const out = getOutputValue(id);
  if (out != null) {
    const parsed = parseFloat(String(out).replace(',', '.'));
    if (Number.isFinite(parsed)) return parsed;
  }
  return NaN;
}

// ---------------------------------------------------------------------------
// 4. All 20 Standard Lookup Tables (`LK`) (lines 44–793)
// ---------------------------------------------------------------------------

export const LK: Record<string, { t: string; f: () => string }> = {
  uw: {
    t: 'TCVN 11823-3:2017, Bảng 6 - Khối lượng riêng',
    f: () =>
      HINT +
      T(
        ['Vật liệu', '', 'Khối lượng riêng (kg/m³)', 'Dùng trong bảng tính (T/m³)'],
        [
          [L('Hợp kim nhôm'), '', '2800', P(2.8)],
          [L('Lớp phủ bằng bitum (bê tông atphan)'), '', '2250', P(2.25)],
          [L('Gang'), '', '7200', P(7.2)],
          [L('Xỉ than'), '', '960', P(0.96)],
          [L('Cát, bột hoặc sét đầm chặt'), '', '1925', P(1.925)],
          [{ t: 'Bê tông', l: 1, rs: 4 }, L('Tỷ trọng nhẹ'), '1775', P(1.775)],
          [L('Nhẹ có cát'), '1925', P(1.925)],
          [L("Thường, f'c ≤ 35 MPa"), '2320', P(2.32)],
          [L("Thường, 35 &lt; f'c ≤ 105 MPa"), "2240 + 2,29f'c", '—'],
          [L('Cát, bột hoặc sỏi rời'), '', '1600', P(1.6)],
          [L('Sét mềm'), '', '1600', P(1.6)],
          [L('Sỏi, đá dăm, ba lát đã lu lèn'), '', '2250', P(2.25)],
          [L('Thép'), '', '7850', P(7.85)],
          [L('Đá xây'), '', '2725', P(2.725)],
          [{ t: 'Gỗ', l: 1, rs: 2 }, L('Cứng'), '960', P(0.96)],
          [L('Mềm'), '800', P(0.8)],
          [{ t: 'Nước', l: 1, rs: 2 }, L('Nước ngọt'), '1000', P(1)],
          [L('Nước mặn'), '1025', P(1.025)],
        ],
      ) +
      '<p>Bê tông cốt thép: lấy khối lượng riêng bê tông cộng thêm khoảng 80 kg/m³ cho cốt thép (chú giải Điều 5.1). Với hàm lượng thép lớn của mố, trụ, thực tế thường lấy 2500 kg/m³: ' +
      T(['Bê tông cốt thép thường dùng'], [[P(2.5, '2,50 T/m³')]]) +
      '</p>',
  },
  IM: {
    t: 'TCVN 11823-3:2017, Bảng 10 - Lực xung kích IM',
    f: () =>
      HINT +
      T(
        ['Cấu kiện', 'TTGH', 'IM'],
        [
          [L('Mối nối bản mặt cầu'), 'Tất cả các TTGH', P(0.75, '75 %')],
          [
            { t: 'Tất cả các cấu kiện khác', l: 1, rs: 2 },
            'TTGH Mỏi và đứt gãy',
            P(0.15, '15 %'),
          ],
          ['Tất cả các TTGH khác', P(0.33, '33 %')],
        ],
      ) +
      '<p>Điều 6.2.1: không áp dụng lực xung kích cho tải trọng người đi bộ, tải trọng làn; cho tường chắn không chịu phản lực thẳng đứng từ kết cấu phần trên; cho các bộ phận móng nằm hoàn toàn dưới mặt đất.</p>',
  },
  mL: {
    t: 'TCVN 11823-3:2017, Bảng 7 - Hệ số làn xe mL',
    f: () =>
      T(
        ['Số làn chất tải', 'Hệ số làn mL'],
        [
          ['1', '1,20'],
          ['2', '1,00'],
          ['3', '0,85'],
          ['&gt; 3', '0,65'],
        ],
      ) +
      '<p>Số làn thiết kế (Điều 6.1.1.1): n = INT(w/3600), w là bề rộng phần xe chạy giữa hai đá vỉa hoặc rào chắn (mm); 6000 ≤ w ≤ 7200 mm lấy 2 làn, mỗi làn rộng w/2. Không áp dụng mL khi kiểm tra mỏi.</p>',
  },
  V: {
    t: 'Tốc độ thiết kế theo cấp đường',
    f: () =>
      HINT +
      '<h4>TCVN 4054:2005 - Đường ô tô, Bảng 4: Tốc độ thiết kế (km/h)</h4>' +
      T(
        ['Cấp thiết kế', 'I', 'II', 'III', 'IV', 'V', 'VI'],
        [
          [L('Đồng bằng và đồi'), P(120), P(100), P(80), P(60), P(40), P(30)],
          [L('Núi'), '—', '—', P(60), P(40), P(30), P(20)],
        ],
      ) +
      '<h4>TCVN 10380:2014 - Đường giao thông nông thôn, Bảng 3: Tốc độ thiết kế (km/h)</h4>' +
      T(
        ['Cấp kỹ thuật', 'A', 'B', 'C', 'D'],
        [
          [L('Địa hình thông thường'), P(30), P(20), P(15), '—'],
          [L('Miền núi (độ dốc ngang &gt; 30 %)'), P(20), P(15), P(10), '—'],
        ],
      ) +
      '<p>Cấp D không dành cho xe cơ giới. Tốc độ chỉ dùng để tính lực ly tâm CE (cầu cong); cầu thẳng (R = 0) không ảnh hưởng kết quả.</p>',
  },
  del: {
    t: 'TCVN 11823-3:2017, Bảng 20 - Góc ma sát giữa các vật liệu khác nhau',
    f: () =>
      '<p class="hint">Bấm vào góc δ để điền; với khoảng giá trị lấy cận dưới (thiên về an toàn khi tính Ka).</p>' +
      T(
        ['Vật liệu tiếp xúc', 'Góc ma sát δ (độ)', 'Hệ số ma sát tanδ'],
        [
          [{ t: '<b>Bê tông khối trên các nền sau:</b>', l: 1, cs: 3 }],
          [L('Đá sạch, nguyên khối'), P(35), '0,70'],
          [L('Sỏi sạch, hỗn hợp sỏi - cát, cát thô'), P(29, '29 - 31'), '0,55 - 0,60'],
          [
            L(
              'Cát sạch hạt mịn đến trung, cát pha bột hạt trung đến thô, sỏi pha bột hoặc pha sét',
            ),
            P(24, '24 - 29'),
            '0,45 - 0,55',
          ],
          [
            L('Cát mịn sạch, cát hạt mịn đến trung pha bột hoặc pha sét'),
            P(19, '19 - 24'),
            '0,34 - 0,45',
          ],
          [L('Bột cát mịn, bột không dẻo'), P(17, '17 - 19'), '0,31 - 0,34'],
          [
            L('Sét tàn tích hoặc sét tiền cố kết rất cứng và cứng'),
            P(22, '22 - 26'),
            '0,40 - 0,50',
          ],
          [L('Sét và sét pha bột cứng vừa và cứng'), P(17, '17 - 19'), '0,30 - 0,35'],
          [
            {
              t: 'Khối xây trên các nền trên có cùng hệ số ma sát như bê tông khối.',
              l: 1,
              cs: 3,
            },
          ],
          [{ t: '<b>Cọc ván thép tiếp xúc với:</b>', l: 1, cs: 3 }],
          [L('Sỏi sạch, hỗn hợp sỏi - cát, đá đắp cấp phối tốt có đá hộc'), P(22), '0,40'],
          [L('Cát sạch, hỗn hợp sỏi - cát pha bột, đá cứng đắp một cỡ hạt'), P(17), '0,30'],
          [L('Cát pha bột, sỏi hoặc cát lẫn bột hoặc sét'), P(14), '0,25'],
          [L('Bột cát mịn, bột không dẻo'), P(11), '0,20'],
          [
            {
              t: '<b>Bê tông đúc sẵn, bê tông đổ trong ván khuôn hoặc cọc ván bê tông tiếp xúc với:</b>',
              l: 1,
              cs: 3,
            },
          ],
          [
            L('Sỏi sạch, hỗn hợp sỏi - cát, đá đắp cấp phối tốt có đá hộc'),
            P(22, '22 - 26'),
            '0,40 - 0,50',
          ],
          [
            L('Cát sạch, hỗn hợp sỏi - cát pha bột, đá cứng đắp một cỡ hạt'),
            P(17, '17 - 22'),
            '0,30 - 0,40',
          ],
          [L('Cát pha bột, sỏi hoặc cát lẫn bột hoặc sét'), P(17), '0,30'],
          [L('Bột cát mịn, bột không dẻo'), P(14), '0,25'],
          [{ t: '<b>Các vật liệu kết cấu khác nhau:</b>', l: 1, cs: 3 }],
          [
            L('Khối xây trên khối xây, đá mácma và biến chất: đá mềm đã đẽo trên đá mềm đã đẽo'),
            P(35),
            '0,70',
          ],
          [L('Đá cứng đã đẽo trên đá mềm đã đẽo'), P(33), '0,65'],
          [L('Đá cứng đã đẽo trên đá cứng đã đẽo'), P(29), '0,55'],
          [L('Khối xây trên gỗ theo hướng ngang thớ'), P(26), '0,50'],
          [L('Thép trên thép tại khoá cọc ván'), P(17), '0,30'],
        ],
      ),
  },
  lf: {
    t: 'TCVN 11823-3:2017, Bảng 3 và Bảng 4 - Hệ số tải trọng',
    f: () => {
      const gEl = $('mo_gEQ');
      const g = gEl ? gEl.value : '0,5';
      return (
        '<h4>Bảng 3 - Tổ hợp và hệ số tải trọng</h4>' +
        T(
          [
            'TTGH',
            'DC DD DW<br>EH EV ES<br>EL PS CR SH',
            'LL IM CE<br>BR PL LS',
            'WA',
            'WS',
            'WL',
            'FR',
            'TU',
            'TG',
            'SE',
            'EQ',
            'IC CT CV',
          ],
          [
            [
              'Cường độ I',
              'γp',
              '1,75',
              '1,00',
              '—',
              '—',
              '1,00',
              '0,50/1,20',
              'γTG',
              'γSE',
              '—',
              '—',
            ],
            [
              'Cường độ II',
              'γp',
              '1,35',
              '1,00',
              '—',
              '—',
              '1,00',
              '0,50/1,20',
              'γTG',
              'γSE',
              '—',
              '—',
            ],
            [
              'Cường độ III',
              'γp',
              '—',
              '1,00',
              '1,40',
              '—',
              '1,00',
              '0,50/1,20',
              'γTG',
              'γSE',
              '—',
              '—',
            ],
            ['Cường độ IV', 'γp', '—', '1,00', '—', '—', '1,00', '0,50/1,20', '—', '—', '—', '—'],
            [
              'Cường độ V',
              'γp',
              '1,35',
              '1,00',
              '0,40',
              '1,00',
              '1,00',
              '0,50/1,20',
              'γTG',
              'γSE',
              '—',
              '—',
            ],
            ['Đặc biệt I', 'γp', 'γEQ', '1,00', '—', '—', '1,00', '—', '—', '—', '1,00', '—'],
            ['Đặc biệt II', 'γp', '0,50', '1,00', '—', '—', '1,00', '—', '—', '—', '—', '1,00'],
            [
              'Sử dụng I',
              '1,00',
              '1,00',
              '1,00',
              '0,30',
              '1,00',
              '1,00',
              '1,00/1,20',
              'γTG',
              'γSE',
              '—',
              '—',
            ],
            [
              'Sử dụng II',
              '1,00',
              '1,30',
              '1,00',
              '—',
              '—',
              '1,00',
              '1,00/1,20',
              '—',
              '—',
              '—',
              '—',
            ],
            [
              'Sử dụng III',
              '1,00',
              '0,80',
              '1,00',
              '—',
              '—',
              '1,00',
              '1,00/1,20',
              'γTG',
              'γSE',
              '—',
              '—',
            ],
            [
              'Sử dụng IV',
              '1,00',
              '—',
              '1,00',
              '0,70',
              '—',
              '1,00',
              '1,00/1,20',
              '—',
              '1,00',
              '—',
              '—',
            ],
            ['Mỏi I', '—', '1,50', '—', '—', '—', '—', '—', '—', '—', '—', '—'],
            ['Mỏi II', '—', '0,75', '—', '—', '—', '—', '—', '—', '—', '—', '—'],
          ],
        ) +
        '<p>TU: giá trị lớn dùng khi tính biến dạng, giá trị nhỏ dùng cho các hiệu ứng lực khác. Gió trong Cường độ V và Sử dụng I tính với tốc độ gió 25 m/s. γEQ (hoạt tải trong tổ hợp động đất) xác định theo dự án; thường lấy 0,5 (bảng tính: γEQ = ' +
        g +
        ').</p>' +
        HINT +
        T(
          ['Số liệu', 'Giá trị thường dùng'],
          [
            [
              L('Tốc độ gió V2 cho Cường độ V, Sử dụng I (m/s)'),
              { v: 25, t: '25', for: 'mo_V25' },
            ],
            [L('γEQ'), { v: 0, t: '0', for: 'mo_gEQ' }],
            [L('γEQ'), { v: 0.5, t: '0,5', for: 'mo_gEQ' }],
            [L('γEQ'), { v: 1, t: '1,0', for: 'mo_gEQ' }],
          ],
        ) +
        '<h4>Bảng 4 - Hệ số tải trọng cho tải trọng thường xuyên γp</h4>' +
        T(
          ['Loại tải trọng', '', 'Lớn nhất', 'Nhỏ nhất'],
          [
            [{ t: 'DC: cấu kiện và các thiết bị phụ', l: 1, cs: 2 }, '1,25', '0,90'],
            [{ t: 'DC: chỉ dùng cho Cường độ IV', l: 1, cs: 2 }, '1,50', '0,90'],
            [
              { t: 'DD: ma sát âm', l: 1, rs: 3 },
              L('Cọc, phương pháp α Tomlinson'),
              '1,40',
              '0,25',
            ],
            [L('Cọc, phương pháp λ'), '1,05', '0,30'],
            [L("Cọc khoan, phương pháp O'Neill và Reese (1999)"), '1,25', '0,35'],
            [{ t: 'DW: lớp phủ mặt cầu và các tiện ích', l: 1, cs: 2 }, '1,50', '0,65'],
            [{ t: 'EH: áp lực đất nằm ngang', l: 1, rs: 3 }, L('Chủ động'), '1,50', '0,90'],
            [L('Tĩnh'), '1,35', '0,90'],
            [L('Áp lực đất biểu kiến cho tường neo'), '1,35', '—'],
            [{ t: 'EL: ứng suất do thi công tích luỹ', l: 1, cs: 2 }, '1,00', '1,00'],
            [{ t: 'EV: áp lực đất thẳng đứng', l: 1, rs: 6 }, L('Ổn định tổng thể'), '1,00', '—'],
            [L('Tường chắn và mố'), '1,35', '1,00'],
            [L('Kết cấu vùi cứng'), '1,30', '0,90'],
            [L('Khung cứng'), '1,35', '0,90'],
            [L('Kết cấu vùi mềm (trừ cống hộp thép)'), '1,95', '0,90'],
            [L('Cống hộp thép mềm'), '1,50', '0,90'],
            [{ t: 'ES: tải trọng đất chất thêm', l: 1, cs: 2 }, '1,50', '0,75'],
          ],
        ) +
        CHK
      );
    },
  },
  mu: {
    t: 'TCVN 11823-14:2017 - Hệ số ma sát của mặt trượt PTFE (tham khảo)',
    f: () =>
      HINT +
      T(
        ['Loại PTFE', 'Nhiệt độ', '3,5 MPa', '7 MPa', '14 MPa', '≥ 21 MPa'],
        [
          [
            { t: 'Tấm có lỗ, bôi trơn', l: 1, rs: 2 },
            '20 °C',
            P(0.04),
            P(0.03),
            P(0.025),
            P(0.02),
          ],
          ['-25 °C', P(0.1), P(0.07), P(0.06), P(0.04)],
          [{ t: 'Tấm không độn', l: 1, rs: 2 }, '20 °C', P(0.08), P(0.07), P(0.05), P(0.03)],
          ['-25 °C', P(0.2), P(0.18), P(0.13), P(0.1)],
          [{ t: 'Tấm có độn', l: 1, rs: 2 }, '20 °C', P(0.24), P(0.17), P(0.09), P(0.06)],
          ['-25 °C', P(0.44), P(0.32), P(0.25), P(0.2)],
          [{ t: 'Sợi dệt', l: 1, rs: 2 }, '20 °C', P(0.08), P(0.07), P(0.06), P(0.045)],
          ['-25 °C', P(0.2), P(0.18), P(0.13), P(0.1)],
        ],
      ) +
      '<p>Áp lực tính bằng phản lực tĩnh tải chia diện tích mặt trượt; nội suy tuyến tính. Gối cao su và gối cố định không có lực ma sát FR (bảng tính tự bỏ qua). Gối trượt thép trên thép không có lớp PTFE: lấy theo catalogue hoặc thí nghiệm.</p>' +
      CHK,
  },
  VB: {
    t: 'TCVN 11823-3:2017, Bảng 13 - Tốc độ gió cơ bản VB',
    f: () =>
      HINT +
      T(
        ['Vùng gió', 'I', 'II', 'III', 'IV'],
        [[L('VB (m/s)'), P(1, '38'), P(2, '45'), P(3, '53'), P(4, '59')]],
      ) +
      '<p>Vùng gió của địa danh tra theo phân vùng áp lực gió trên lãnh thổ Việt Nam (QCVN 02:2022/BXD, phụ lục phân vùng theo đơn vị hành chính). VB là tốc độ gió giật 3 s, chu kỳ lặp 100 năm.</p>',
  },
  S: {
    t: 'TCVN 11823-3:2017, Bảng 14 - Hệ số điều chỉnh S',
    f: () =>
      HINT +
      T(
        [
          'Độ cao mặt cầu trên mặt đất xung quanh hoặc mặt nước (m)',
          'Khu vực lộ thiên hoặc mặt nước thoáng',
          'Khu vực có rừng hoặc nhà cửa, cây và nhà cao tối đa khoảng 10 m',
          'Khu vực có nhà cửa với đa số nhà cao trên 10 m',
        ],
        [
          ['10', P(1.09), P(1), P(0.81)],
          ['20', P(1.14), P(1.06), P(0.89)],
          ['30', P(1.17), P(1.1), P(0.94)],
          ['40', P(1.2), P(1.13), P(0.98)],
          ['50', P(1.21), P(1.16), P(1.01)],
        ],
      ) +
      '<p>Độ cao trung gian nội suy tuyến tính; dưới 10 m lấy như 10 m.</p>' +
      CHK,
  },
  Cd: {
    t: 'Hệ số cản Cd của kết cấu nhịp theo b/d (Hình 8.1.2.1-1)',
    f: () => {
      const bd = fg('o_mobd'),
        cd = (x: number) => Math.max(1.3, Math.min(2.4, 2.5 - 0.3 * x)),
        W = 520,
        H = 280,
        X = (x: number) => 60 + (x / 12) * 430,
        Y = (y: number) => 240 - (y / 2.5) * 210;
      let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect x="60" y="30" width="430" height="210" fill="none" stroke="#999"/>`;
      for (let x = 0; x <= 12; x += 1)
        s += `<line x1="${X(x)}" y1="30" x2="${X(x)}" y2="240" stroke="#ddd"/><text x="${X(x)}" y="256" text-anchor="middle">${x}</text>`;
      for (let y = 0; y <= 2.5; y += 0.5)
        s += `<line x1="60" y1="${Y(y)}" x2="490" y2="${Y(y)}" stroke="#ddd"/><text x="54" y="${Y(y) + 4}" text-anchor="end">${vn(y.toFixed(1))}</text>`;
      s += `<polyline fill="none" stroke="#1f4e79" stroke-width="2" points="${[0, 0.5, 4, 12].map((x) => X(x) + ',' + Y(cd(x))).join(' ')}"/>`;
      s += `<text x="275" y="274" text-anchor="middle">b/d</text><text x="18" y="135" transform="rotate(-90 18 135)" text-anchor="middle">Cd</text>`;
      if (Number.isFinite(bd)) {
        const x = Math.min(bd, 12);
        s += `<line x1="${X(x)}" y1="240" x2="${X(x)}" y2="${Y(cd(bd))}" stroke="#c00000" stroke-dasharray="4 3"/><circle cx="${X(x)}" cy="${Y(cd(bd))}" r="4" fill="#c00000"/><text x="${X(x) + 6}" y="${Y(cd(bd)) - 8}" fill="#c00000">b/d = ${vn(bd.toFixed(2))} → Cd = ${vn(cd(bd).toFixed(2))}</text>`;
      }
      s += '</svg>';
      return (
        s +
        '<p>b - tổng bề rộng kết cấu nhịp; d - chiều cao kết cấu nhịp kể cả lan can đặc (hoặc chiều cao xe 1,8 m khi có hoạt tải), tính vuông góc với hướng gió. Đường cong: Cd = 2,5 - 0,3.b/d, giới hạn 1,3 ≤ Cd ≤ 2,4 (cùng nguồn gốc với EN 1991-1-4, Hình 8.3).</p>' +
        (Number.isFinite(bd)
          ? HINT +
            T(['b/d hiện tại', 'Cd tra được'], [[vn(bd.toFixed(3)), P(+cd(bd).toFixed(2))]])
          : '') +
        '<p class="warn">Đường cong số hoá dạng tuyến tính; khi lập hồ sơ chính thức cần đối chiếu Hình 8.1.2.1-1 bản in TCVN 11823-3.</p>'
      );
    },
  },
  heq: {
    t: 'TCVN 11823-3:2017, Bảng 22 và 11.6.4-2 - Chiều cao đất tương đương heq',
    f: () =>
      '<h4>Bảng 22 - Mố cầu vuông góc với dòng xe</h4>' +
      T(
        ['Chiều cao mố H (m)', 'heq (m)'],
        [
          ['≤ 1,5', '1,2'],
          ['3,0', '0,9'],
          ['≥ 6,0', '0,6'],
        ],
      ) +
      '<h4>Bảng 23 - Tường chắn song song với dòng xe (tường cánh)</h4>' +
      T(
        [
          'Chiều cao tường H (m)',
          'heq (m), khoảng cách từ lưng tường đến mép xe = 0,0 m',
          'heq (m), khoảng cách ≥ 0,3 m',
        ],
        [
          ['≤ 1,5', '1,5', '0,6'],
          ['3,0', '1,05', '0,6'],
          ['≥ 6,0', '0,6', '0,6'],
        ],
      ) +
      '<p>Chiều cao tường lấy từ mặt đất đến đáy móng (hoặc đáy mặt cắt đang xét); giá trị trung gian nội suy tuyến tính. Bảng tính dùng Bảng 22 cho tường thân, tường đỉnh và tường cánh.</p>',
  },
  soil: {
    t: 'TCVN 11823-3:2017, Điều 9.5 - Loại đất nền và hệ số thực địa S',
    f: () =>
      HINT +
      T(
        ['Loại', 'Mô tả', 'S'],
        [
          [
            'I',
            L(
              'Đá mọi loại (dạng phiến hoặc kết tinh, vận tốc sóng cắt &gt; 765 m/s); hoặc đất cứng dày dưới 60 m nằm trên đá, là trầm tích ổn định của cát, cuội sỏi hoặc sét cứng',
            ),
            P(1, '1,0'),
          ],
          [
            'II',
            L(
              'Đất dính cứng hoặc đất rời sâu, chiều dày trên 60 m nằm trên đá, là trầm tích ổn định của cát, cuội sỏi hoặc sét cứng',
            ),
            P(2, '1,2'),
          ],
          [
            'III',
            L(
              'Sét mềm đến cứng vừa và cát, có từ 9 m trở lên sét mềm đến cứng vừa, có hoặc không xen kẹp cát hoặc đất rời khác',
            ),
            P(3, '1,5'),
          ],
          ['IV', L('Sét mềm hoặc bùn dày trên 12 m'), P(4, '2,0')],
        ],
      ) +
      '<p>Khi không đủ số liệu để chọn, dùng loại II. Loại III, IV và Tm &lt; 0,3 s: Csm = A(0,8 + 4Tm).</p>',
  },
  R: {
    t: 'TCVN 11823-3:2017, Bảng 18 và Bảng 19 - Hệ số điều chỉnh đáp ứng R',
    f: () =>
      HINT +
      '<h4>Bảng 18 - Kết cấu phần dưới</h4>' +
      T(
        ['Kết cấu phần dưới', 'Rất quan trọng', 'Thiết yếu', 'Khác'],
        [
          [L('Trụ kiểu tường, theo phương kích thước lớn'), P(1.5), P(1.5), P(2)],
          [L('Bệ cọc BTCT: chỉ có cọc thẳng đứng'), P(1.5), P(2), P(3)],
          [L('Bệ cọc BTCT: có cọc xiên'), P(1.5), P(1.5), P(2)],
          [L('Cột đơn'), P(1.5), P(2), P(3)],
          [L('Bệ cọc thép hoặc liên hợp: chỉ có cọc thẳng đứng'), P(1.5), P(3.5), P(5)],
          [L('Bệ cọc thép hoặc liên hợp: có cọc xiên'), P(1.5), P(2), P(3)],
          [L('Khung nhiều cột'), P(1.5), P(3.5), P(5)],
        ],
      ) +
      '<h4>Bảng 19 - Các liên kết</h4>' +
      T(
        ['Liên kết', 'Mọi loại tầm quan trọng'],
        [
          [L('Kết cấu phần trên với mố'), P(0.8)],
          [L('Khe co giãn trong một nhịp'), P(0.8)],
          [L('Cột, trụ, bệ cọc với xà mũ hoặc kết cấu phần trên'), P(1)],
          [L('Cột hoặc trụ với móng'), P(1)],
        ],
      ) +
      '<p>Mố không có trong Bảng 18; áp lực đất khi động đất của mố tính theo Mononobe - Okabe (Điều 11.6.5). R chỉ dùng khi chọn phương pháp hệ số đáp ứng Csm.W/R.</p>',
  },
  G: {
    t: 'TCVN 11823-14:2017 - Đặc tính cao su gối theo độ cứng',
    f: () =>
      T(
        ['Độ cứng (Shore A)', '50', '60', '70'],
        [
          [L('Mô đun chống cắt G ở 23 °C (MPa)'), '0,66 - 0,90', '0,90 - 1,38', '1,38 - 2,07'],
          [L('Độ võng từ biến 25 năm / độ võng tức thời'), '0,25', '0,35', '0,45'],
        ],
      ) +
      '<p>Nhập G theo catalogue gối hoặc chỉ dẫn kỹ thuật (đơn vị kPa trong bảng tính, 1 MPa = 1000 kPa). G lớn cho lực TU lớn hơn, thiên về an toàn khi kiểm toán mố.</p>' +
      CHK,
  },
  grade: {
    t: 'TCVN 1651-2:2018 - Thép thanh vằn, đặc tính cơ học',
    f: () =>
      HINT +
      T(
        ['Mác thép', 'Giới hạn chảy fy (MPa)', 'Giới hạn bền kéo fu (MPa)', 'Độ giãn dài A5 (%)'],
        [
          [P(300, 'CB300-V'), '300', '450', '16'],
          [P(400, 'CB400-V'), '400', '570', '14'],
          [P(500, 'CB500-V'), '500', '650', '14'],
        ],
      ) +
      '<p>Các giá trị là giá trị nhỏ nhất. Thép CB240-T (thép tròn trơn, TCVN 1651-1:2018): fy = 240 MPa, fu = 380 MPa.</p>',
  },
  g13: {
    t: 'TCVN 11823-5:2017, Điều 7.3.3.2 - Hệ số γ1, γ2, γ3 tính mômen nứt',
    f: () =>
      T(
        ['Hệ số', 'Trường hợp', 'Giá trị'],
        [
          [
            { t: 'γ1 - hệ số biến động cường độ chịu kéo khi uốn', rs: 2 },
            L('Kết cấu đốt đúc sẵn'),
            '1,2',
          ],
          [L('Các kết cấu bê tông khác'), '1,6'],
          [{ t: 'γ2 - hệ số biến động ứng suất trước', rs: 2 }, L('Cáp dính bám'), '1,1'],
          [L('Cáp không dính bám'), '1,0'],
          [
            { t: 'γ3 - tỷ số giới hạn chảy / giới hạn bền của cốt thép', rs: 4 },
            L('Thép A615 cấp 420'),
            '0,67',
          ],
          [L('Thép A706 cấp 420'), '0,75'],
          [L('Thép A615 cấp 520'), '0,76'],
          [L('Kết cấu bê tông dự ứng lực'), '1,00'],
        ],
      ) + '<p>Với thép theo TCVN 1651-2, bảng tính lấy γ3 = fy/fu của mác thép đã chọn.</p>',
  },
  exp: {
    t: 'TCVN 11823-5:2017, Điều 7.3.4 - Hệ số điều kiện phơi lộ γe',
    f: () =>
      HINT +
      T(
        ['Cấp phơi lộ', 'Áp dụng', 'γe'],
        [
          [
            P(1, 'Cấp 1'),
            L('Khi vết nứt chấp nhận được do mỹ quan thấp hoặc khả năng ăn mòn thấp'),
            '1,00',
          ],
          [
            P(2, 'Cấp 2'),
            L(
              'Kết cấu phần dưới, kết cấu tiếp xúc với nước hoặc đất, khi cần chống ăn mòn; mặt cắt ngang bản mặt cầu bê tông',
            ),
            '0,75',
          ],
        ],
      ),
  },
  Kp: {
    t: 'TCVN 10304:2014, Phụ lục A, Bảng A.1 - Hệ số tỷ lệ K',
    f: () =>
      T(
        [
          'Đất quanh cọc và đặc trưng',
          'Cọc đóng (kN/m⁴)',
          'Cọc khoan nhồi, cọc ống (kN/m⁴)',
          'Cọc khoan nhồi (≈ T/m⁴)',
        ],
        [
          [
            L('Sét và á sét dẻo chảy (0,75 &lt; IL ≤ 1); bùn'),
            '650 - 2500',
            '500 - 2000',
            '50 - 200',
          ],
          [
            L(
              'Sét và á sét dẻo mềm (0,5 &lt; IL ≤ 0,75); á cát dẻo (0 ≤ IL ≤ 1); cát bột (0,6 ≤ e ≤ 0,8)',
            ),
            '2000 - 5000',
            '2000 - 4000',
            '200 - 400',
          ],
          [
            L(
              'Sét và á sét dẻo cứng, nửa cứng (0 ≤ IL ≤ 0,5); á cát cứng (IL &lt; 0); cát nhỏ (0,6 ≤ e ≤ 0,75); cát hạt trung (0,55 ≤ e ≤ 0,7)',
            ),
            '5000 - 8000',
            '4000 - 6000',
            '400 - 600',
          ],
          [
            L('Sét và á sét cứng (IL &lt; 0); cát thô (0,55 ≤ e ≤ 0,7)'),
            '8000 - 13000',
            '6000 - 10000',
            '600 - 1000',
          ],
          [
            L('Cát sỏi (0,55 ≤ e ≤ 0,7); cuội sỏi có cát lấp nhét'),
            '—',
            '10000 - 20000',
            '1000 - 2000',
          ],
        ],
      ) +
      '<p>Giá trị nhỏ ứng với IL, e lớn trong khoảng; giá trị lớn ứng với IL, e nhỏ (nội suy). Đất nhiều lớp trong phạm vi chiều sâu ảnh hưởng hM = 2(d + 1) m tính K trung bình theo các lớp. Bảng tính dùng đơn vị T/m⁴ (1 T/m⁴ ≈ 9,81 kN/m⁴).</p>' +
      CHK,
  },
  Kef: {
    t: 'TCVN 11823-4:2017, Điều 6.2.5 - Hệ số chiều dài hữu hiệu K',
    f: () => {
      const cs: readonly [string, string, number, number][] = [
        ['a', 'Ngàm - ngàm', 0.5, 0.65],
        ['b', 'Ngàm - khớp', 0.7, 0.8],
        ['c', 'Ngàm - ngàm trượt', 1, 1.2],
        ['d', 'Khớp - khớp', 1, 1],
        ['e', 'Ngàm - tự do', 2, 2.1],
        ['f', 'Khớp - ngàm trượt', 2, 2],
      ];
      const fix = (x: number, y: number, up: boolean) =>
        `<line x1="${x - 14}" y1="${y}" x2="${x + 14}" y2="${y}" stroke="#000" stroke-width="2"/>` +
        Array.from(
          { length: 5 },
          (_, i) =>
            `<line x1="${x - 12 + i * 6}" y1="${y}" x2="${x - 16 + i * 6}" y2="${y + (up ? -6 : 6)}" stroke="#000"/>`,
        ).join('');
      const pin = (x: number, y: number, up: boolean) =>
        `<polygon points="${x},${y} ${x - 8},${y + (up ? -12 : 12)} ${x + 8},${y + (up ? -12 : 12)}" fill="none" stroke="#000"/>`;
      const slide = (x: number, y: number) =>
        `<line x1="${x - 14}" y1="${y}" x2="${x + 14}" y2="${y}" stroke="#000" stroke-width="2"/><circle cx="${x - 7}" cy="${y - 5}" r="3" fill="none" stroke="#000"/><circle cx="${x + 7}" cy="${y - 5}" r="3" fill="none" stroke="#000"/><line x1="${x - 14}" y1="${y - 10}" x2="${x + 14}" y2="${y - 10}" stroke="#000"/>`;
      const top = ['fix', 'fix', 'slide', 'pin', 'free', 'slide'] as const;
      const bot = ['fix', 'pin', 'fix', 'pin', 'fix', 'pin'] as const;
      const shape = [
        'M0 0 C-14 30,-14 70,0 100',
        'M0 0 C-12 40,-16 75,0 100',
        'M14 0 C14 40,0 60,0 100',
        'M0 0 C-16 35,-16 65,0 100',
        'M22 0 C18 40,6 75,0 100',
        'M22 0 C22 50,0 70,0 100',
      ];
      let s = '<svg width="660" height="200" viewBox="0 0 660 200">';
      cs.forEach((c, i) => {
        const x = 55 + i * 110,
          y0 = 30,
          y1 = 130;
        s += `<line x1="${x}" y1="${y0}" x2="${x}" y2="${y1}" stroke="#999" stroke-dasharray="4 3"/><path d="${shape[i]}" transform="translate(${x},${y0})" fill="none" stroke="#1f4e79" stroke-width="2"/>`;
        const tx = x + (top[i] === 'slide' || top[i] === 'free' ? (i === 2 ? 14 : 22) : 0);
        s +=
          top[i] === 'fix'
            ? fix(x, y0, true)
            : top[i] === 'pin'
              ? pin(x, y0, true)
              : top[i] === 'slide'
                ? slide(tx, y0)
                : '';
        s += bot[i] === 'fix' ? fix(x, y1, false) : pin(x, y1, false);
        s += `<text x="${x}" y="${y1 + 32}" text-anchor="middle">(${c[0]})</text><text x="${x}" y="${y1 + 48}" text-anchor="middle" font-size="11">${c[1]}</text>`;
      });
      s += '</svg>';
      return (
        s +
        HINT +
        T(
          ['Sơ đồ', '(a)', '(b)', '(c)', '(d)', '(e)', '(f)'],
          [
            [L('K lý thuyết'), ...cs.map((c) => vn(c[2]))],
            [L('K kiến nghị thiết kế'), ...cs.map((c) => P(c[3]))],
          ],
        ) +
        '<p>Ngàm: xoay và chuyển vị đều bị ngăn cản; khớp: chuyển vị bị ngăn cản, xoay tự do; ngàm trượt: xoay bị ngăn cản, chuyển vị ngang tự do; tự do: xoay và chuyển vị tự do. Cọc ngàm vào bệ, đỉnh bệ chuyển vị ngang tự do thường lấy sơ đồ (c), K = 1,2.</p>'
      );
    },
  },
  phig: {
    t: 'TCVN 11823-10:2017, Bảng 10 - Hệ số sức kháng của cọc khoan nhồi',
    f: () =>
      HINT +
      T(
        ['Phương pháp / đất / điều kiện', '', 'φ'],
        [
          [
            { t: 'Sức kháng nén dọc trục danh định của cọc đơn', l: 1, rs: 8 },
            L('Sức kháng thân cọc trong sét, phương pháp α'),
            P(0.45),
          ],
          [L('Sức kháng mũi trong sét, ứng suất tổng'), P(0.4)],
          [L('Sức kháng thân cọc trong cát, phương pháp β'), P(0.55)],
          [L('Sức kháng mũi trong cát'), P(0.5)],
          [L('Sức kháng thân cọc trong IGM'), P(0.6)],
          [L('Sức kháng mũi trong IGM'), P(0.55)],
          [L('Sức kháng thân cọc trong đá'), P(0.55)],
          [L('Sức kháng mũi trong đá'), P(0.5)],
          [L('Phá hoại khối'), L('Sét'), P(0.55)],
          [{ t: 'Sức kháng nhổ của cọc đơn', l: 1, rs: 3 }, L('Sét, phương pháp α'), P(0.35)],
          [L('Cát, phương pháp β'), P(0.45)],
          [L('Đá'), P(0.4)],
          [L('Sức kháng nhổ của nhóm cọc'), L('Cát và sét'), P(0.45)],
          [L('Sức kháng ngang'), L('Mọi loại vật liệu'), P(1)],
          [L('Thử tải tĩnh (nén)'), L('Mọi loại vật liệu'), P(0.7)],
          [L('Thử tải tĩnh (nhổ)'), L('Mọi loại vật liệu'), P(0.6)],
        ],
      ) +
      CHK,
  },
};

export const LOOKUP_KEYS: readonly string[] = Object.freeze(Object.keys(LK));

// ---------------------------------------------------------------------------
// 5. All 30 Host Element Bindings (`MAP`) (lines 795–826)
// ---------------------------------------------------------------------------

export const LOOKUP_MAP: readonly [string, LookupTargetSpec][] = [
  ['uw', 'mo_gsuT'],
  ['uw', 'mo_gcT'],
  ['uw', 'mo_gsT'],
  ['IM', 'mo_IM'],
  ['IM', 'mo_IMon'],
  ['mL', { q: 'mL theo Bảng 7' }],
  ['V', 'mo_Vce'],
  ['del', 'mo_del'],
  ['mu', 'mo_mu'],
  ['VB', 'mo_wz'],
  ['S', 'mo_S'],
  ['Cd', 'mo_Cd1'],
  ['lf', 'mo_V25'],
  ['lf', 'mo_gEQ'],
  ['lf', { q: 'Hệ số tải trọng theo TCVN 11823-3, Bảng 3', p: true }],
  ['heq', { q: 'heq nội suy theo chiều cao tường H' }],
  ['heq', 'o_moWhe'],
  ['soil', 'mo_soil'],
  ['R', 'mo_Rpd'],
  ['R', 'mo_Rlk'],
  ['G', 'mo_Gb'],
  ['grade', 'rc_grade'],
  ['g13', 'o_rcg1'],
  ['g13', 'o_rcg3'],
  ['exp', 'rc_exp'],
  ['Kp', 'mc_md'],
  ['Kp', 'mc_mb'],
  ['Kp', 'mc_m'],
  ['Kef', 'Kef'],
  ['phig', 's2_phig'],
];

export const LOOKUP_BINDINGS: readonly LookupBinding[] = LOOKUP_MAP.map(([k, w]) => ({ k, w }));

// ---------------------------------------------------------------------------
// 6. Lookup Query & Host Resolution Helpers
// ---------------------------------------------------------------------------

export function getLookupEntry(key: string): LookupEntry | null {
  const entry = Object.prototype.hasOwnProperty.call(LK, key) ? LK[key] : undefined;
  return entry ? { id: key, t: entry.t, f: entry.f } : null;
}

export function getLookupTargetForField(fieldId: string): string | null {
  if (!fieldId) return null;
  for (const [k, w] of LOOKUP_MAP) {
    if (typeof w === 'string' && w === fieldId) return k;
  }
  for (const prefix of CONTEXT_PREFIXES) {
    if (prefix && fieldId.startsWith(prefix)) {
      const stripped = fieldId.slice(prefix.length);
      for (const [k, w] of LOOKUP_MAP) {
        if (typeof w === 'string' && w === stripped) return k;
      }
    }
  }
  return null;
}

function findElementByIdInRoot(root: Document | Element, id: string): Element | null {
  if ('getElementById' in root && typeof root.getElementById === 'function') {
    return root.getElementById(id);
  }
  if ('id' in root && root.id === id) return root;
  if (typeof root.querySelector === 'function') {
    const escaped = id.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return root.querySelector(`[id="${escaped}"]`);
  }
  return null;
}

export function resolveLookupBindings(root?: Document | Element): ResolvedLookupBinding[] {
  const scope = root ?? (typeof document !== 'undefined' ? document : null);
  if (!scope || typeof scope.querySelectorAll !== 'function') return [];

  const resolved: ResolvedLookupBinding[] = [];
  for (const [k, w] of LOOKUP_MAP) {
    let host: Element | undefined;
    let target: HTMLInputElement | HTMLSelectElement | null = null;

    if (typeof w === 'string') {
      const el = findElementByIdInRoot(scope, w);
      if (!el || typeof el.closest !== 'function') continue;
      const row = el.closest('.row');
      if (!row) continue;
      target = /^(INPUT|SELECT)$/i.test(el.tagName)
        ? (el as HTMLInputElement | HTMLSelectElement)
        : null;
      host = row.children[1];
      if (!host) continue;
    } else {
      const selector = w.p ? 'p.small' : '.row>span:nth-child(2)';
      const candidates = Array.from(scope.querySelectorAll(selector));
      if (
        !w.p &&
        'matches' in scope &&
        typeof scope.matches === 'function' &&
        scope.matches('.row') &&
        scope.children[1]?.tagName === 'SPAN'
      ) {
        candidates.unshift(scope.children[1]);
      }
      host = candidates.find((x) => (x.textContent ?? '').includes(w.q));
      if (!host) continue;
    }

    resolved.push({ k, w, host, target });
  }
  return resolved;
}

// ---------------------------------------------------------------------------
// 7. Idempotent DOM / Legacy Pane Binder (lines 20–30, 827–892)
// ---------------------------------------------------------------------------

interface ModalState {
  cur: HTMLInputElement | HTMLSelectElement | null;
}

const docStates = new WeakMap<Document, ModalState>();
const keydownBoundDocs = new WeakSet<Document>();
const boundModalNodes = new WeakSet<Element>();

function getDocState(doc: Document): ModalState {
  let st = docStates.get(doc);
  if (!st) {
    st = { cur: null };
    docStates.set(doc, st);
  }
  return st;
}

export function initLookupBindings(root?: Document): void {
  const doc = root ?? (typeof document !== 'undefined' ? document : null);
  if (!doc || !doc.body) return;

  const state = getDocState(doc);

  if (!doc.getElementById('lkStyle')) {
    const st = doc.createElement('style');
    st.id = 'lkStyle';
    st.textContent = `${LOOKUP_TRIGGER_STYLE_CSS}\n${LOOKUP_STYLE_CSS}`;
    (doc.head ?? doc.body).appendChild(st);
  }

  let bg = doc.getElementById('lkBg') as HTMLElement | null;
  if (!bg) {
    bg = doc.createElement('div');
    bg.id = 'lkBg';
    bg.hidden = true;
    bg.className = 'noprint';
    bg.innerHTML =
      '<div id="lkBox" role="dialog" aria-modal="true" aria-labelledby="lkTt"><div id="lkHd"><span id="lkTt"></span><button type="button" id="lkX">Đóng</button></div><div id="lkBd"></div></div>';
    doc.body.appendChild(bg);
  }

  const close = () => {
    const bgEl = doc.getElementById('lkBg') as HTMLElement | null;
    if (bgEl) bgEl.hidden = true;
    if (state.cur && typeof state.cur.focus === 'function') state.cur.focus();
  };

  const open = (k: string, target: HTMLInputElement | HTMLSelectElement | null) => {
    const d = getLookupEntry(k);
    if (!d) return;
    const bgEl = doc.getElementById('lkBg') as HTMLElement | null;
    const tt = doc.getElementById('lkTt');
    const bd = doc.getElementById('lkBd');
    const btnX = doc.getElementById('lkX') as HTMLButtonElement | null;
    if (!bgEl || !tt || !bd) return;
    state.cur = target;
    tt.textContent = d.t;
    bd.innerHTML = d.f();
    bgEl.hidden = false;
    if (btnX && typeof btnX.focus === 'function') btnX.focus();
  };

  if (!boundModalNodes.has(bg)) {
    boundModalNodes.add(bg);
    bg.addEventListener('click', (e) => {
      if (e.target === bg) close();
    });

    const lkX = doc.getElementById('lkX') as HTMLButtonElement | null;
    if (lkX && !boundModalNodes.has(lkX)) {
      boundModalNodes.add(lkX);
      lkX.addEventListener('click', close);
    }

    const lkBd = doc.getElementById('lkBd');
    if (lkBd && !boundModalNodes.has(lkBd)) {
      boundModalNodes.add(lkBd);
      lkBd.addEventListener('click', (e) => {
        const targetNode = e.target as Element | null;
        const td =
          targetNode && typeof targetNode.closest === 'function'
            ? (targetNode.closest('td[data-v]') as HTMLElement | null)
            : null;
        if (!td || !state.cur || !/^(INPUT|SELECT)$/i.test(state.cur.tagName)) return;
        if (td.dataset.for && td.dataset.for !== state.cur.id) return;
        const val = td.dataset.v;
        if (val == null) return;
        if (state.cur.tagName.toUpperCase() === 'SELECT') {
          const sel = state.cur as HTMLSelectElement;
          if (!Array.from(sel.options).some((o) => o.value === val)) return;
        }
        state.cur.value = val;
        const EvtCtor = doc.defaultView?.Event ?? Event;
        state.cur.dispatchEvent(new EvtCtor('input', { bubbles: true }));
        state.cur.dispatchEvent(new EvtCtor('change', { bubbles: true }));
        close();
      });
    }
  }

  if (!keydownBoundDocs.has(doc)) {
    keydownBoundDocs.add(doc);
    doc.addEventListener('keydown', (e) => {
      const bgEl = doc.getElementById('lkBg') as HTMLElement | null;
      if (e.key === 'Escape' && bgEl && !bgEl.hidden) close();
    });
  }

  for (const { k, host, target } of resolveLookupBindings(doc)) {
    if (host.querySelector(`.tra[data-k="${k}"]`)) continue;
    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.className = 'tra noprint';
    btn.textContent = 'Tra';
    btn.title = 'Tra bảng, hình trong tiêu chuẩn';
    btn.dataset.k = k;
    btn.addEventListener('click', () => open(k, target));
    host.appendChild(btn);
  }
}

// ---------------------------------------------------------------------------
// 8. Caption Centering & Table / Formula Auto-Fit (lines 897–945)
// ---------------------------------------------------------------------------

const CAPTION_RX = /^(Hình|Bảng)\s+\d+[a-z]?\s*[-–.:]/;

export function formatCaptionsAndTables(root?: ParentNode): void {
  const container: ParentNode | null = root ?? (typeof document !== 'undefined' ? document : null);
  if (!container || typeof container.querySelectorAll !== 'function') return;

  // run0(): center captions and table titles
  container.querySelectorAll('p.cap:not(.ctr),p.small:not(.ctr)').forEach((p) => {
    const s = (p.textContent ?? '').trim();
    if (
      CAPTION_RX.test(s) ||
      (/^Bảng\s/.test(s) &&
        p.nextElementSibling &&
        p.nextElementSibling.tagName.toUpperCase() === 'TABLE')
    ) {
      p.classList.add('ctr');
    }
  });

  // fitT(): narrow <=5-col tables outside #tab60, and shrink wide formulas
  container.querySelectorAll('table.dt:not(.fitc)').forEach((el) => {
    const tb = el as HTMLTableElement;
    tb.classList.add('fitc');
    const r0 = tb.rows?.[0];
    if (!r0) return;
    let n = 0;
    Array.from(r0.cells ?? []).forEach((c) => {
      n += c.colSpan || 1;
    });
    const inTab60 = typeof tb.closest === 'function' && Boolean(tb.closest('#tab60'));
    if (n <= 5 && !inTab60) tb.classList.add('fit');
  });

  // công thức dài: thu cỡ chữ cho vừa ô, không tràn ra lề giấy
  container.querySelectorAll('.row>span:nth-child(2)').forEach((el) => {
    const sp = el as HTMLElement;
    const m = sp.querySelector('.m') as HTMLElement | null;
    const row = sp.parentElement;
    if (!m || !row || !sp.clientWidth || row.classList.contains('wide')) return;
    m.style.fontSize = '';
    const need = sp.scrollWidth;
    const have = sp.clientWidth;
    if (!Number.isFinite(need) || !Number.isFinite(have) || have <= 0 || need <= have + 1) return;
    const k = ((100 * have) / need) * 0.98;
    if (k >= 85) {
      m.style.fontSize = `${Math.floor(k)}%`;
      return;
    }
    // quá dài: công thức chiếm hết dòng, ký hiệu - giá trị - đơn vị xuống dòng dưới
    row.classList.add('wide');
    const n2 = sp.scrollWidth;
    const h2 = sp.clientWidth;
    if (Number.isFinite(n2) && Number.isFinite(h2) && h2 > 0 && n2 > h2 + 1) {
      m.style.fontSize = `${Math.max(60, Math.floor(((100 * h2) / n2) * 0.98))}%`;
    }
  });
}
