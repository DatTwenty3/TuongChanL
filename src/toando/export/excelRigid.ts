/**
 * Xuất Excel kiểm toán mặt đường cứng BTXM thông thường theo TCCS 39:2022/TCĐBVN.
 * Mọi ô tính toán là công thức Excel nối ô (đổi số liệu đầu vào là kết quả tự cập nhật),
 * kèm kết quả lưu sẵn từ engine; ghi chú số hiệu công thức dạng "Công thức (n) — Điều x.y.z".
 */
import ExcelJS from 'exceljs';
import { runRigidVerification } from '../engine';
import {
  GAMMA_R_BY_CLASS,
  RIGID_AGGREGATE_OPTIONS,
  RIGID_REGION_OPTIONS,
  RIGID_ROAD_CLASS_OPTIONS,
} from '../engine/rigid';
import type { ProjectState } from '../types/project';
import { addConclusionColorRule, SheetCursor } from './excelExport';
import {
  applyRowGridBorders,
  calcWrapHeight,
  COL_WIDTHS_11,
  COLOR_FAIL,
  COLOR_PASS,
  escFormulaStr,
  PAGE_SETUP_A4,
  setCellMarkup,
  setFormulaCell,
  setPlainCell,
  setupCenterContinuousRow,
} from './excelStyles';

const LEFT: Partial<ExcelJS.Alignment> = { horizontal: 'left', vertical: 'middle' };
const CENTER: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle', wrapText: true };

type Num = number;

interface LineOpts {
  /** Công thức Excel (không có dấu =) — vắng thì ghi giá trị tĩnh. */
  formula?: string;
  value: Num | string;
  unit?: string;
  numFmt?: string;
  note?: string;
  bold?: boolean;
  /** Tên ô để các dòng sau tham chiếu. */
  key?: string;
  /** Cột đặt công thức mô tả bằng chữ (dạng TeX rút gọn) ở cột 4 thay cho dấu "=". */
  eq?: string;
}

function populateRigidSheet(ws: ExcelJS.Worksheet, project: ProjectState): void {
  const v = runRigidVerification(project);
  const data = project.rigid;
  if (!data) throw new Error('Dự án chưa có dữ liệu mặt đường cứng.');
  const I = v.input;
  const R = v.res;
  const m2 = I.model === 2;
  const hasBase = m2 && I.Eb > 0 && I.hb > 0;

  ws.views = [{ showGridLines: true }];
  ws.pageSetup = PAGE_SETUP_A4;
  ws.columns = COL_WIDTHS_11.map((width) => ({ width }));
  const cursor = new SheetCursor(ws);

  /** Hàng của từng đại lượng (giá trị nằm ở cột F). */
  const ref: Record<string, number> = {};
  const F = (k: string): string => {
    const r = ref[k];
    if (r === undefined) throw new Error(`Thiếu ô tham chiếu ${k}`);
    return `$F$${r}`;
  };

  const line = (label: string, symbol: string, o: LineOpts): number => {
    const r = cursor.next(18.75);
    const row = ws.getRow(r);
    if (label) setCellMarkup(row.getCell(2), label, {}, LEFT);
    if (symbol) setCellMarkup(row.getCell(3), symbol, {}, LEFT);
    setCellMarkup(row.getCell(4), o.eq ?? '=', {}, LEFT);
    const font = { bold: o.bold };
    const align = { horizontal: 'left', vertical: 'middle' } as const;
    if (o.formula) {
      setFormulaCell(row.getCell(6), o.formula, o.value, font, align, o.numFmt);
    } else {
      setPlainCell(row.getCell(6), o.value, font, align, o.numFmt);
    }
    if (o.unit) setCellMarkup(row.getCell(7), o.unit, {}, LEFT);
    if (o.note) setPlainCell(row.getCell(8), o.note, {}, LEFT);
    if (o.key) ref[o.key] = r;
    return r;
  };

  // ---------------------------------------------------------------- tiêu đề
  const rTitle = cursor.next(18.75);
  setupCenterContinuousRow(ws, rTitle, 'BẢNG TÍNH KIỂM TOÁN MẶT ĐƯỜNG BÊ TÔNG XI MĂNG', { size: 14, bold: true }, 18.75);
  const rSub = cursor.next(17.25);
  setupCenterContinuousRow(ws, rSub, 'Theo tiêu chuẩn TCCS 39:2022/TCĐBVN', { size: 13, bold: true, italic: true }, 17.25);
  const rProj = cursor.next(17.25);
  setupCenterContinuousRow(
    ws,
    rProj,
    `Công trình: ${project.projectInfo.congTrinh || '—'}`,
    { size: 13, bold: true, italic: true },
    17.25
  );
  cursor.blank(12.75);

  // ---------------------------------------------------------------- I. số liệu
  cursor.sectionHeading('I. SỐ LIỆU ĐẦU VÀO:');
  cursor.sectionHeading('I.1. Thông tin chung:');
  const roadLbl = RIGID_ROAD_CLASS_OPTIONS.find((o) => o.value === data.roadClass)?.label ?? '';
  const regionLbl = RIGID_REGION_OPTIONS.find((o) => o.value === data.region)?.label ?? '';
  const aggLbl = RIGID_AGGREGATE_OPTIONS.find((o) => o.value === data.aggregate)?.label ?? '';
  const textLine = (label: string, value: string): void => {
    const r = cursor.next(15.75);
    setPlainCell(ws.getRow(r).getCell(2), label, {}, LEFT);
    setPlainCell(ws.getRow(r).getCell(6), value, {}, LEFT);
  };
  textLine('- Cấp hạng đường:', roadLbl);
  textLine('- Vùng khí hậu (Điều 8.2.8):', regionLbl);
  textLine('- Loại đá cốt liệu thô (Bảng 10):', aggLbl);
  textLine(
    '- Mô hình tính (Điều 8.2.1):',
    m2
      ? 'Mô hình 2 — tấm hai lớp tách rời trên nền đàn hồi nhiều lớp (Điều 8.4)'
      : 'Mô hình 1 — tấm một lớp trên nền đàn hồi nhiều lớp (Điều 8.3)'
  );
  textLine('- Lớp móng trên:', hasBase ? data.input.matBound : 'Vật liệu hạt (không gia cố chất liên kết)');
  cursor.blank(8);

  cursor.sectionHeading('I.2. Tấm BTXM:');
  line('- Chiều dày tấm:', 'h_{c}', { value: I.hc, unit: '(m)', numFmt: '0.000', key: 'hc' });
  line('- Chiều dài tấm (khoảng cách khe ngang):', 'L', { value: I.L, unit: '(m)', numFmt: '0.00', key: 'L' });
  line('- Chiều rộng tấm:', 'B', { value: I.B, unit: '(m)', numFmt: '0.00', key: 'B' });
  line('- Cường độ kéo uốn thiết kế yêu cầu:', 'f_{r}', {
    value: I.fr,
    unit: '(MPa)',
    numFmt: '0.00',
    key: 'fr',
    note: 'Điều 8.2.3',
  });
  line('- Mô đun đàn hồi tính toán:', 'E_{c}', { value: I.Ec, unit: '(MPa)', numFmt: '#,##0', key: 'Ec', note: 'Bảng 11' });
  line('- Hệ số Poisson:', 'μ_{c}', { value: I.muc, numFmt: '0.00', key: 'muc' });
  line('- Hệ số dãn nở nhiệt:', 'α_{c}', {
    value: I.ac,
    unit: '(1/°C)',
    numFmt: '0.0E+00',
    key: 'ac',
    note: 'Bảng 10',
  });
  line('- Gradien nhiệt độ lớn nhất:', 'T_{g}', { value: I.Tg, unit: '(°C/m)', numFmt: '0', key: 'Tg', note: 'Điều 8.2.8' });
  cursor.blank(8);

  cursor.sectionHeading('I.3. Tải trọng và hệ số:');
  line('- Trục đơn tính mỏi tiêu chuẩn:', 'P_{s}', { value: I.Ps, unit: '(kN)', numFmt: '0', key: 'Ps', note: 'Điều 8.2.6' });
  line('- Trục đơn nặng nhất thiết kế:', 'P_{m}', { value: I.Pmax, unit: '(kN)', numFmt: '0', key: 'Pm', note: 'Điều 8.2.7' });
  const rNeInput = line('- Số lần tác dụng của trục tiêu chuẩn tích lũy trên làn xe:', 'N_{e}', {
    value: I.Ne,
    unit: '(lần)',
    numFmt: '#,##0',
    key: 'Ne',
    note: data.neAuto ? 'Tính ở mục II' : 'Nhập trực tiếp',
  });
  line('- Hệ số triết giảm ứng suất do truyền tải ở khe nối:', 'k_{r}', { value: I.kr, numFmt: '0.00', key: 'kr', note: 'Điều 8.3.1' });
  line('- Hệ số tổng hợp xét tác dụng động:', 'k_{c}', { value: I.kc, numFmt: '0.00', key: 'kc', note: 'Điều 8.3.1' });
  line('- Hệ số độ tin cậy thiết kế:', 'γ_{r}', {
    value: I.gr,
    numFmt: '0.00',
    key: 'gr',
    note: `Bảng 9 (${GAMMA_R_BY_CLASS[data.roadClass].min}–${GAMMA_R_BY_CLASS[data.roadClass].max})`,
  });
  cursor.blank(8);

  cursor.sectionHeading('I.4. Nền đất và các lớp móng:');
  line('- Mô đun đàn hồi chung của nền đất:', 'E_{0}', {
    value: I.E0,
    unit: '(MPa)',
    numFmt: '0.00',
    key: 'E0',
    note: data.e0FromSubgrade ? 'Lấy từ mục Đất nền' : 'Nhập trực tiếp',
  });
  cursor.tableCaption('Bảng 1: Các lớp vật liệu hạt (từ trên xuống)');
  const rHdr = cursor.next(30);
  const hdr = ws.getRow(rHdr);
  setPlainCell(hdr.getCell(1), 'STT', {}, CENTER);
  setPlainCell(hdr.getCell(2), 'Lớp vật liệu hạt', {}, CENTER);
  setCellMarkup(hdr.getCell(6), 'E_{i} (MPa)', {}, CENTER);
  setCellMarkup(hdr.getCell(7), 'h_{i} (m)', {}, CENTER);
  setCellMarkup(hdr.getCell(8), 'h_{i}^{2} (m²)', {}, CENTER);
  setCellMarkup(hdr.getCell(9), 'h_{i}^{2}.E_{i}', {}, CENTER);
  applyRowGridBorders(ws, rHdr, { top: 'medium', bottom: 'medium', mergedSpans: [[2, 5]] });
  ws.mergeCells(rHdr, 2, rHdr, 5);
  const layers = I.layers.filter((l) => l.h > 0);
  const rL1 = rHdr + 1;
  layers.forEach((l, i) => {
    const r = cursor.next(calcWrapHeight(l.name, 38, 15.75));
    const row = ws.getRow(r);
    setPlainCell(row.getCell(1), i + 1, {}, CENTER, '0');
    setPlainCell(row.getCell(2), l.name, {}, { horizontal: 'left', vertical: 'middle', wrapText: true });
    setPlainCell(row.getCell(6), l.E, {}, CENTER, '#,##0');
    setPlainCell(row.getCell(7), l.h, {}, CENTER, '0.000');
    setFormulaCell(row.getCell(8), `G${r}^2`, l.h * l.h, {}, CENTER, '0.0000');
    setFormulaCell(row.getCell(9), `H${r}*F${r}`, l.h * l.h * l.E, {}, CENTER, '0.00');
    applyRowGridBorders(ws, r, {
      top: i === 0 ? 'medium' : 'hair',
      bottom: i === layers.length - 1 ? 'medium' : 'hair',
      mergedSpans: [[2, 5]],
    });
    ws.mergeCells(r, 2, r, 5);
  });
  const rLn = rHdr + layers.length;
  if (layers.length === 0) {
    cursor.prose(2, '(Không có lớp vật liệu hạt — nền đất chịu trực tiếp)', { italic: true });
  }
  if (hasBase) {
    cursor.blank(8);
    cursor.prose(2, `Lớp móng trên gia cố (${data.input.matBound}) — Mô hình 2:`);
    line('- Mô đun đàn hồi:', 'E_{b}', { value: I.Eb, unit: '(MPa)', numFmt: '#,##0', key: 'Eb' });
    line('- Chiều dày:', 'h_{b}', { value: I.hb, unit: '(m)', numFmt: '0.000', key: 'hb' });
    line('- Hệ số Poisson:', 'μ_{b}', { value: I.mub, numFmt: '0.00', key: 'mub', note: 'Điều 8.4.1' });
    line('- Cường độ kéo uốn thiết kế yêu cầu của móng trên:', 'f_{br}', {
      value: I.fbr,
      unit: '(MPa)',
      numFmt: '0.00',
      key: 'fbr',
      note: 'Bảng 3',
    });
    line('- Lớp cách ly bê tông nhựa giữa tấm và móng:', '', {
      value: I.caly === 1 ? 1 : 0,
      numFmt: '"= "0',
      key: 'caly',
      eq: '(1: có, 0: không)',
      note: 'Điều 8.4.5',
    });
  }
  cursor.blank(12.75);

  // ---------------------------------------------------------------- II. Ne
  if (data.neAuto) {
    const T = data.traffic;
    cursor.sectionHeading('II. SỐ TRỤC XE TÍCH LŨY TRÊN LÀN XE THIẾT KẾ N_{e}:', 18.75);
    cursor.prose(2, 'Quy đổi các trục đơn nặng về trục tiêu chuẩn P_{s} (Phụ lục A):');
    line('- ADTT hai chiều (xe 2 trục, 6 bánh trở lên):', 'ADTT', { value: T.adtt, unit: '(xe/ngày)', numFmt: '#,##0', key: 'adtt', note: 'Điều A.1' });
    line('- Hệ số phân phối theo chiều xe chạy:', 'f_{hướng}', { value: T.fhuong, numFmt: '0.00', key: 'fh' });
    line('- Hệ số phân phối theo làn:', 'f_{làn}', { value: T.flan, numFmt: '0.00', key: 'fl' });
    line('- Tổng số trục đơn trong 3000 xe điều tra:', 'n', { value: T.naxle, unit: '(trục)', numFmt: '#,##0', key: 'n', note: 'Điều A.7' });
    line('- Tốc độ tăng trưởng trung bình năm:', 'g_{r}', { value: T.grow, unit: '(%)', numFmt: '0.00', key: 'g' });
    line('- Thời hạn phục vụ thiết kế:', 't', { value: T.tyear, unit: '(năm)', numFmt: '0', key: 'ty', note: 'Bảng 9' });
    line('- Hệ số phân bố ngang vệt bánh xe:', 'η', { value: T.eta, numFmt: '0.00', key: 'eta', note: 'Bảng A.2' });
    cursor.tableCaption('Bảng 2: Phổ tải trọng trục đơn nặng điều tra');
    const rH2 = cursor.next(30);
    const h2 = ws.getRow(rH2);
    setPlainCell(h2.getCell(1), 'STT', {}, CENTER);
    setPlainCell(h2.getCell(2), 'Nhóm trục', {}, CENTER);
    setCellMarkup(h2.getCell(6), 'P_{i} (kN)', {}, CENTER);
    setCellMarkup(h2.getCell(7), 'p_{i} (%)', {}, CENTER);
    setCellMarkup(h2.getCell(8), 'k_{pi} = (P_{i}/P_{s})^{16}', {}, CENTER);
    setCellMarkup(h2.getCell(9), 'k_{pi}.p_{i}/100', {}, CENTER);
    applyRowGridBorders(ws, rH2, { top: 'medium', bottom: 'medium', mergedSpans: [[2, 5]] });
    ws.mergeCells(rH2, 2, rH2, 5);
    T.spec.forEach((s, i) => {
      const r = cursor.next(15.75);
      const row = ws.getRow(r);
      const kpi = Math.pow(s.P / I.Ps, 16);
      setPlainCell(row.getCell(1), i + 1, {}, CENTER, '0');
      setPlainCell(row.getCell(2), `Trục ${s.P} kN`, {}, LEFT);
      setPlainCell(row.getCell(6), s.P, {}, CENTER, '0');
      setPlainCell(row.getCell(7), s.p, {}, CENTER, '0.0');
      setFormulaCell(row.getCell(8), `(F${r}/${F('Ps')})^16`, kpi, {}, CENTER, '0.0000');
      setFormulaCell(row.getCell(9), `H${r}*G${r}/100`, (kpi * s.p) / 100, {}, CENTER, '0.0000');
      applyRowGridBorders(ws, r, {
        top: i === 0 ? 'medium' : 'hair',
        bottom: i === T.spec.length - 1 ? 'medium' : 'hair',
        mergedSpans: [[2, 5]],
      });
      ws.mergeCells(r, 2, r, 5);
    });
    const rS1 = rH2 + 1;
    const rSn = rH2 + T.spec.length;
    cursor.blank(8);
    line('- Số trục ngày đêm quy đổi, năm đầu khai thác:', 'N_{s1}', {
      formula: `${F('adtt')}*${F('fh')}*${F('fl')}*(${F('n')}/3000)*SUM(I${rS1}:I${rSn})`,
      value: v.ne.Ns1,
      unit: '(lần/ngày.làn)',
      numFmt: '0.0000',
      key: 'Ns1',
      note: 'Công thức (A.2) — Điều A.7',
    });
    line('- Số lần trục quy đổi tích lũy trong thời hạn phục vụ:', 'N_{e}', {
      formula: `IF(${F('g')}>0,${F('Ns1')}*365*((1+${F('g')}/100)^${F('ty')}-1)/(${F('g')}/100)*${F('eta')},${F('Ns1')}*365*${F('ty')}*${F('eta')})`,
      value: v.ne.Ne,
      unit: '(lần)',
      numFmt: '#,##0',
      key: 'NeCalc',
      bold: true,
      note: 'Công thức (A.3) — Điều A.8',
    });
    // nối ô Ne ở mục I.3 sang kết quả tính
    setFormulaCell(ws.getRow(rNeInput).getCell(6), `F${ref.NeCalc}`, I.Ne, {}, { horizontal: 'left', vertical: 'middle' }, '#,##0');
    cursor.blank(12.75);
  }

  // ---------------------------------------------------------------- III. tính toán
  cursor.sectionHeading('III. TÍNH ỨNG SUẤT KÉO UỐN TRONG TẤM BTXM:', 18.75);

  cursor.sectionHeading('III.1. Mô đun đàn hồi tương đương của nền và độ cứng của tấm:');
  if (layers.length > 0) {
    line('- Tổng chiều dày các lớp vật liệu hạt:', 'h_{x}', {
      formula: `SUM(G${rL1}:G${rLn})`,
      value: R.hx,
      unit: '(m)',
      numFmt: '0.000',
      key: 'hx',
      note: 'Công thức (15) — Điều 8.3.2',
    });
    line('- Mô đun đàn hồi tương đương của các lớp vật liệu hạt:', 'E_{x}', {
      formula: `SUM(I${rL1}:I${rLn})/SUM(H${rL1}:H${rLn})`,
      value: R.Ex,
      unit: '(MPa)',
      numFmt: '0.00',
      key: 'Ex',
      note: 'Công thức (13) — Điều 8.3.2',
    });
    line('- Hệ số hồi quy:', 'α', {
      formula: `0.86+0.26*LN(${F('hx')})`,
      value: R.alpha,
      numFmt: '0.0000',
      key: 'alpha',
      note: 'Công thức (14) — Điều 8.3.2',
    });
    line('- Mô đun đàn hồi tương đương của nền (tính từ đáy tấm):', 'E_{t}', {
      formula: `(${F('Ex')}/${F('E0')})^${F('alpha')}*${F('E0')}`,
      value: R.Et,
      unit: '(MPa)',
      numFmt: '0.00',
      key: 'Et',
      note: 'Công thức (12) — Điều 8.3.2',
    });
  } else {
    line('- Mô đun đàn hồi tương đương của nền (không có lớp hạt):', 'E_{t}', {
      formula: F('E0'),
      value: R.Et,
      unit: '(MPa)',
      numFmt: '0.00',
      key: 'Et',
      note: 'Điều 8.3.2',
    });
  }
  line('- Độ cứng chịu uốn của tấm BTXM:', 'D_{c}', {
    formula: `${F('Ec')}*${F('hc')}^3/(12*(1-${F('muc')}^2))`,
    value: R.Dc,
    unit: '(MN.m)',
    numFmt: '0.000',
    key: 'Dc',
    note: 'Công thức (11) — Điều 8.3.2',
  });
  if (hasBase) {
    line('- Độ cứng chịu uốn của lớp móng trên:', 'D_{b}', {
      formula: `${F('Eb')}*${F('hb')}^3/(12*(1-${F('mub')}^2))`,
      value: R.Db,
      unit: '(MN.m)',
      numFmt: '0.000',
      key: 'Db',
      note: 'Công thức (25) — Điều 8.4.1',
    });
    line('- Bán kính độ cứng tương đối của cả kết cấu:', 'r_{g}', {
      formula: `1.21*((${F('Dc')}+${F('Db')})/${F('Et')})^(1/3)`,
      value: R.rg,
      unit: '(m)',
      numFmt: '0.0000',
      key: 'R',
      note: 'Công thức (25) — Điều 8.4.1',
    });
  } else {
    line('- Bán kính độ cứng tương đối của tấm:', 'r', {
      formula: `1.21*(${F('Dc')}/${F('Et')})^(1/3)`,
      value: R.r,
      unit: '(m)',
      numFmt: '0.0000',
      key: 'R',
      note: 'Công thức (11) — Điều 8.3.2',
    });
  }
  cursor.blank(8);

  cursor.sectionHeading('III.2. Ứng suất kéo uốn do tải trọng xe:');
  line('- Hệ số mỏi:', 'k_{f}', {
    formula: `${F('Ne')}^0.057`,
    value: R.kf,
    numFmt: '0.0000',
    key: 'kf',
    note: 'Công thức (16) — Điều 8.3.3',
  });
  const sigFormula = (p: string): string =>
    hasBase
      ? `(1.45E-3/(1+${F('Db')}/${F('Dc')}))*${F('R')}^0.65*${F('hc')}^(-2)*${p}^0.94`
      : `1.47E-3*${F('R')}^0.7*${F('hc')}^(-2)*${p}^0.94`;
  const sigNote = hasBase ? 'Công thức (25) — Điều 8.4.1' : 'Công thức (11) — Điều 8.3.2';
  line('- Ứng suất kéo uốn do trục tính mỏi P_{s} trên tấm không liên kết 4 cạnh:', 'σ_{ps}', {
    formula: sigFormula(F('Ps')),
    value: R.sps,
    unit: '(MPa)',
    numFmt: '0.000',
    key: 'sps',
    note: sigNote,
  });
  line('- Ứng suất kéo uốn gây mỏi do tải trọng:', 'σ_{pr}', {
    eq: '= k_{r}.k_{f}.k_{c}.σ_{ps} =',
    formula: `${F('kr')}*${F('kf')}*${F('kc')}*${F('sps')}`,
    value: R.spr,
    unit: '(MPa)',
    numFmt: '0.000',
    key: 'spr',
    note: 'Công thức (10) — Điều 8.3.1',
  });
  line('- Ứng suất do trục đơn nặng nhất P_{m} trên tấm không liên kết 4 cạnh:', 'σ_{pm}', {
    formula: sigFormula(F('Pm')),
    value: R.spm,
    unit: '(MPa)',
    numFmt: '0.000',
    key: 'spm',
    note: sigNote,
  });
  line('- Ứng suất kéo uốn lớn nhất do trục nặng nhất:', 'σ_{pmax}', {
    eq: '= k_{r}.k_{c}.σ_{pm} =',
    formula: `${F('kr')}*${F('kc')}*${F('spm')}`,
    value: R.spmax,
    unit: '(MPa)',
    numFmt: '0.000',
    key: 'spmax',
    note: 'Công thức (20) — Điều 8.3.5',
  });
  cursor.blank(8);

  cursor.sectionHeading('III.3. Ứng suất kéo uốn do gradien nhiệt độ:');
  line('- Tham số:', 't', {
    eq: '= L/(3r) =',
    formula: `${F('L')}/(3*${F('R')})`,
    value: R.t,
    numFmt: '0.0000',
    key: 't',
    note: 'Công thức (23) — Điều 8.3.6',
  });
  const tt = F('t');
  const shch = `(SINH(${tt})*COS(${tt})+COSH(${tt})*SIN(${tt}))/(COS(${tt})*SIN(${tt})+SINH(${tt})*COSH(${tt}))`;
  if (hasBase) {
    line('- Độ cứng tiếp xúc theo phương dọc giữa tấm và móng:', 'k_{n}', {
      formula: `IF(${F('caly')}=1,3000,0.5/(${F('hc')}/${F('Ec')}+${F('hb')}/${F('Eb')}))`,
      value: R.kn,
      unit: '(MPa/m)',
      numFmt: '#,##0.00',
      key: 'kn',
      note: 'Công thức (28) — Điều 8.4.5',
    });
    line('- Hệ số xét trạng thái tiếp xúc giữa các lớp:', 'r_{β}', {
      formula: `((${F('Dc')}*${F('Db')})/((${F('Dc')}+${F('Db')})*${F('kn')}))^0.25`,
      value: R.rb,
      unit: '(m)',
      numFmt: '0.0000',
      key: 'rb',
      note: 'Công thức (28) — Điều 8.4.5',
    });
    line('- Hệ số liên quan đến kết cấu tấm hai lớp:', 'ζ', {
      formula: `-((${F('kn')}*${F('R')}^4-${F('Dc')})*${F('rb')}^3)/((${F('kn')}*${F('rb')}^4-${F('Dc')})*${F('R')}^3)`,
      value: R.zeta,
      numFmt: '0.0000',
      key: 'zeta',
      note: 'Công thức (28) — Điều 8.4.5',
    });
    line('- Hệ số ứng suất uốn vồng:', 'C_{L}', {
      formula: `1-(1/(1+${F('zeta')}))*${shch}`,
      value: R.CL,
      numFmt: '0.0000',
      key: 'CL',
      note: 'Công thức (28) — Điều 8.4.5',
    });
  } else {
    line('- Hệ số ứng suất uốn vồng do gradien nhiệt độ:', 'C_{L}', {
      formula: `1-${shch}`,
      value: R.CL,
      numFmt: '0.0000',
      key: 'CL',
      note: 'Công thức (23) — Điều 8.3.6',
    });
  }
  line('- Hệ số ứng suất nhiệt độ tổng hợp:', 'B_{L}', {
    eq: '= 1,77.e^{-4,48.h_{c}}.C_{L} - 0,131.(1 - C_{L}) =',
    formula: `1.77*EXP(-4.48*${F('hc')})*${F('CL')}-0.131*(1-${F('CL')})`,
    value: R.BL,
    numFmt: '0.0000',
    key: 'BL',
    note: 'Công thức (23) — Điều 8.3.6',
  });
  line('- Ứng suất kéo uốn lớn nhất do gradien nhiệt độ lớn nhất:', 'σ_{tmax}', {
    eq: '= α_{c}.h_{c}.E_{c}.T_{g}.B_{L}/2 =',
    formula: `${F('ac')}*${F('hc')}*${F('Ec')}*${F('Tg')}/2*${F('BL')}`,
    value: R.stmax,
    unit: '(MPa)',
    numFmt: '0.000',
    key: 'stmax',
    note: 'Công thức (22) — Điều 8.3.6',
  });
  const ratio = `${F('stmax')}/${F('fr')}`;
  line('- Hệ số mỏi nhiệt (bộ hệ số a_{t} = 0,841; b_{t} = 1,323; c_{t} = 0,058):', 'k_{t1}', {
    formula: `(${F('fr')}/${F('stmax')})*(0.841*(${ratio})^1.323-0.058)`,
    value: R.kt1,
    numFmt: '0.0000',
    key: 'kt1',
    note: 'Công thức (24) — Điều 8.3.7',
  });
  line('- Hệ số mỏi nhiệt (bộ hệ số a_{t} = 0,871; b_{t} = 1,287; c_{t} = 0,071):', 'k_{t2}', {
    formula: `(${F('fr')}/${F('stmax')})*(0.871*(${ratio})^1.287-0.071)`,
    value: R.kt2,
    numFmt: '0.0000',
    key: 'kt2',
    note: 'Công thức (24) — Điều 8.3.7',
  });
  line('- Lấy hệ số lớn hơn:', 'k_{t}', {
    eq: '= max(k_{t1}, k_{t2}) =',
    formula: `MAX(${F('kt1')},${F('kt2')})`,
    value: R.kt,
    numFmt: '0.0000',
    key: 'kt',
    note: 'Điều 8.3.7',
  });
  line('- Ứng suất kéo uốn gây mỏi do gradien nhiệt độ:', 'σ_{tr}', {
    eq: '= k_{t}.σ_{tmax} =',
    formula: `${F('kt')}*${F('stmax')}`,
    value: R.str,
    unit: '(MPa)',
    numFmt: '0.000',
    key: 'str',
    note: 'Công thức (21) — Điều 8.3.6',
  });
  if (hasBase) {
    cursor.blank(8);
    cursor.sectionHeading('III.4. Ứng suất kéo uốn trong lớp móng trên (bê tông nghèo, bê tông đầm lăn):');
    line('- Ứng suất ở đáy lớp móng trên do trục tính mỏi P_{s}:', 'σ_{bps}', {
      formula: `(1.41E-3/(1+${F('Dc')}/${F('Db')}))*${F('R')}^0.68*${F('hb')}^(-2)*${F('Ps')}^0.94`,
      value: R.sbps,
      unit: '(MPa)',
      numFmt: '0.000',
      key: 'sbps',
      note: 'Công thức (27) — Điều 8.4.2',
    });
    line('- Ứng suất kéo uốn gây mỏi trong lớp móng trên:', 'σ_{bpr}', {
      eq: '= k_{f}.k_{c}.σ_{bps} =',
      formula: `${F('Ne')}^0.065*${F('kc')}*${F('sbps')}`,
      value: R.sbpr,
      unit: '(MPa)',
      numFmt: '0.000',
      key: 'sbpr',
      note: 'Công thức (26) — Điều 8.4.2',
    });
  }
  cursor.blank(12.75);

  // ---------------------------------------------------------------- IV. kiểm toán
  cursor.sectionHeading('IV. KIỂM TOÁN THEO CÁC TRẠNG THÁI GIỚI HẠN:', 18.75);
  const cmpBlock = (
    title: string,
    lhsLabel: string,
    lhsFormula: string,
    lhsValue: number,
    rhsLabel: string,
    rhsKey: string,
    rhsValue: number,
    passed: boolean,
    note: string
  ): number => {
    cursor.prose(2, title);
    const r = cursor.next(18.75);
    const row = ws.getRow(r);
    setCellMarkup(row.getCell(2), lhsLabel, { bold: true }, { horizontal: 'center', vertical: 'middle' });
    ws.mergeCells(r, 2, r, 3);
    setFormulaCell(row.getCell(4), lhsFormula, lhsValue, { bold: true }, { horizontal: 'center', vertical: 'middle' }, '0.000');
    setFormulaCell(
      row.getCell(5),
      `IF(D${r}<=G${r},"<=",">")`,
      passed ? '<=' : '>',
      { bold: true },
      { horizontal: 'center', vertical: 'middle' }
    );
    setCellMarkup(row.getCell(6), rhsLabel, { bold: true }, { horizontal: 'center', vertical: 'middle' });
    setFormulaCell(row.getCell(7), F(rhsKey), rhsValue, { bold: true }, { horizontal: 'center', vertical: 'middle' }, '0.000');
    setPlainCell(row.getCell(8), '(MPa)', { bold: true }, LEFT);
    setPlainCell(row.getCell(9), note, {}, LEFT);
    return r;
  };
  const concRow = (rCmp: number, okText: string, failText: string, passed: boolean): void => {
    cursor.blank(8);
    const r = cursor.next(15.75);
    setFormulaCell(
      ws.getRow(r).getCell(2),
      `IF(D${rCmp}<=G${rCmp},"${escFormulaStr(okText)}","${escFormulaStr(failText)}")`,
      passed ? okText : failText,
      { bold: true, italic: true, color: passed ? COLOR_PASS : COLOR_FAIL },
      LEFT
    );
    addConclusionColorRule(ws, r);
    cursor.blank(8);
  };

  const c1 = v.checks[0];
  const r1 = cmpBlock(
    'a. Điều kiện mỏi do tải trọng và gradien nhiệt độ:',
    'γ_{r}.(σ_{pr} + σ_{tr}) =',
    `${F('gr')}*(${F('spr')}+${F('str')})`,
    c1.lhs,
    'f_{r} =',
    'fr',
    c1.rhs,
    c1.passed,
    'Công thức (6) — Điều 8.2.2'
  );
  concRow(
    r1,
    'Kết luận: Tấm BTXM đảm bảo điều kiện mỏi do tải trọng và gradien nhiệt độ.',
    'Kết luận: Tấm BTXM KHÔNG đảm bảo điều kiện mỏi do tải trọng và gradien nhiệt độ.',
    c1.passed
  );
  const c2 = v.checks[1];
  const r2 = cmpBlock(
    'b. Điều kiện chịu trục đơn nặng nhất và gradien nhiệt độ lớn nhất:',
    'γ_{r}.(σ_{pmax} + σ_{tmax}) =',
    `${F('gr')}*(${F('spmax')}+${F('stmax')})`,
    c2.lhs,
    'f_{r} =',
    'fr',
    c2.rhs,
    c2.passed,
    'Công thức (7) — Điều 8.2.2'
  );
  concRow(
    r2,
    'Kết luận: Tấm BTXM đảm bảo điều kiện chịu trục đơn nặng nhất và gradien nhiệt độ lớn nhất.',
    'Kết luận: Tấm BTXM KHÔNG đảm bảo điều kiện chịu trục đơn nặng nhất và gradien nhiệt độ lớn nhất.',
    c2.passed
  );
  if (hasBase && ref.fbr !== undefined) {
    const c3 = v.checks[2];
    const r3 = cmpBlock(
      'c. Điều kiện mỏi của lớp móng trên:',
      'γ_{r}.σ_{bpr} =',
      `${F('gr')}*${F('sbpr')}`,
      c3.lhs,
      'f_{br} =',
      'fbr',
      c3.rhs,
      c3.passed,
      'Công thức (8) — Điều 8.2.2'
    );
    concRow(
      r3,
      'Kết luận: Lớp móng trên đảm bảo điều kiện mỏi.',
      'Kết luận: Lớp móng trên KHÔNG đảm bảo điều kiện mỏi.',
      c3.passed
    );
  }

  const rMin = cursor.next(18.75);
  setPlainCell(
    ws.getRow(rMin).getCell(2),
    v.minHc !== null
      ? `- Chiều dày tấm nhỏ nhất thoả mãn các điều kiện (dò theo bước 5 mm): ${v.minHc.toFixed(3)} m`
      : '- Không tìm được chiều dày tấm ≤ 0,42 m thoả mãn các điều kiện trên.',
    { italic: true },
    LEFT
  );
  cursor.blank(12.75);

  // ---------------------------------------------------------------- V. khe nối
  cursor.sectionHeading('V. CẤU TẠO KHE NỐI (Điều 6):', 18.75);
  const J = v.joint;
  const jointRows: Array<[string, string]> = [
    ['- Chiều dày tấm dùng tra khe nối:', `${J.h.toFixed(1)} cm`],
    ['- Thanh liên kết khe dọc (đường kính × dài × cách) — Bảng 5:', J.tie],
    ['- Thanh truyền lực khe ngang (chiều dày tấm, đường kính, dài, cách) — Điều 6.2.6:', `${J.d[0]} cm: Ø${J.d[1]} mm, dài ${J.d[2]} mm, cách ${J.d[3]} mm`],
    ['- Chiều sâu cắt khe co giả (móng hạt/gia cố) — Điều 6.2.4:', J.doc_gia],
    ['- Khe co có thanh truyền lực:', J.co_thanh],
    ['- Khe co không có thanh truyền lực:', J.co_khong],
    ['- Số lần cắt khe:', J.catlan],
    ['- Chiều dài dải đoạn dãn:', J.dan_kc],
  ];
  for (const [label, val] of jointRows) {
    const r = cursor.next(calcWrapHeight(label + val, 100, 15.75));
    setPlainCell(ws.getRow(r).getCell(2), label, {}, LEFT);
    setPlainCell(ws.getRow(r).getCell(8), val, {}, LEFT);
  }
  cursor.blank(12.75);

  if (v.drain && data.drain) {
    const dr = v.drain;
    const dd = data.drain;
    const dc = dr.calc;
    cursor.sectionHeading('VI. KIỂM TOÁN THOÁT NƯỚC KẾT CẤU ÁO ĐƯỜNG (Điều 7):', 18.75);
    cursor.prose(
      2,
      dr.required
        ? 'Theo Điều 7.1.2: phải bố trí hệ thống thoát nước.'
        : 'Theo Điều 7.1.2: với số liệu đã nhập chưa bắt buộc bố trí hệ thống thoát nước.',
      { italic: true }
    );
    textLine(
      '- Kiểu hệ thống thoát nước (Điều 7.1.1):',
      dd.type === 'THAM' ? 'Có lớp móng thoát nước (Điều 7.3)' : 'Lớp móng trên không thấm nước — ống thoát nước dọc biên (Điều 7.2)'
    );
    line('- Suất nước thấm theo khe:', 'I_{c}', { value: dd.Ic, unit: '(m³/ngày.m)', numFmt: '0.00', key: 'dIc', note: 'Điều 7.1.4' });
    line('- Số làn xe trong phạm vi B:', 'N', { value: dd.N, numFmt: '0', key: 'dN' });
    line('- Số khe ngang, khe nứt trong phạm vi L:', 'n_{h}', { value: dd.nh, numFmt: '0', key: 'dnh' });
    line('- Bề rộng cùng độ dốc ngang:', 'B', { value: dd.B, unit: '(m)', numFmt: '0.00', key: 'dB' });
    line('- Khoảng cách khe ngang (chiều dài tấm):', 'L', {
      formula: F('L'),
      value: dr.L,
      unit: '(m)',
      numFmt: '0.00',
      key: 'dL',
    });
    line('- Độ dốc dọc:', 'i_{d}', { value: dd.id, unit: '(%)', numFmt: '0.00', key: 'did' });
    line('- Độ dốc ngang:', 'i_{n}', { value: dd.in_, unit: '(%)', numFmt: '0.00', key: 'din' });
    cursor.blank(8);
    line('- Số khe dọc và khe nứt dọc trong phạm vi B:', 'n_{z}', {
      eq: '= N + 1 =',
      formula: `${F('dN')}+1`,
      value: dc.nz,
      numFmt: '0',
      key: 'dnz',
      note: 'Điều 7.1.4',
    });
    line('- Lượng nước thấm qua mặt đường trên mỗi mét dài:', 'Q_{i}', {
      eq: '= I_{c}.(n_{z} + n_{h}.B/L) =',
      formula: `${F('dIc')}*(${F('dnz')}+${F('dnh')}*${F('dB')}/${F('dL')})`,
      value: dc.Qi,
      unit: '(m³/ngày.m)',
      numFmt: '0.000',
      key: 'dQi',
      bold: true,
      note: 'Công thức (1) — Điều 7.1.4',
    });
    line('- Chiều dài đường thấm:', 'L_{s}', {
      eq: '= B.√(1 + i_{d}²/i_{n}²) =',
      formula: `${F('dB')}*SQRT(1+${F('did')}^2/${F('din')}^2)`,
      value: dc.Ls,
      unit: '(m)',
      numFmt: '0.000',
      key: 'dLs',
      note: 'Công thức (3) — Điều 7.3.4',
    });

    const conds: string[] = [];
    const dCmp = (
      title: string,
      lhsLabel: string,
      lhsFormula: string,
      lhsValue: number,
      op: '<=' | '>=',
      rhsLabel: string,
      rhsFormula: string,
      rhsValue: number,
      passed: boolean,
      unit: string,
      note: string
    ): void => {
      cursor.prose(2, title);
      const r = cursor.next(18.75);
      const row = ws.getRow(r);
      const mid = { horizontal: 'center', vertical: 'middle' } as const;
      setCellMarkup(row.getCell(2), lhsLabel, { bold: true }, mid);
      ws.mergeCells(r, 2, r, 3);
      setFormulaCell(row.getCell(4), lhsFormula, lhsValue, { bold: true }, mid, '0.000');
      setFormulaCell(row.getCell(5), `IF(D${r}${op}G${r},"${op}","${op === '<=' ? '>' : '<'}")`, passed ? op : op === '<=' ? '>' : '<', { bold: true }, mid);
      setCellMarkup(row.getCell(6), rhsLabel, { bold: true }, mid);
      setFormulaCell(row.getCell(7), rhsFormula, rhsValue, { bold: true }, mid, '0.000');
      setPlainCell(row.getCell(8), unit, { bold: true }, LEFT);
      setPlainCell(row.getCell(9), note, {}, LEFT);
      conds.push(`D${r}${op}G${r}`);
    };

    cursor.blank(8);
    dCmp(
      'a. Chiều dài đường thấm:',
      'L_{s} =',
      F('dLs'),
      dc.Ls,
      '<=',
      '[L_{s}] =',
      String(dd.lsLimit),
      dd.lsLimit,
      dc.Ls <= dd.lsLimit,
      '(m)',
      'Điều 7.1.3'
    );
    if (dd.type === 'THAM') {
      line('- Hệ số thấm của vật liệu lớp móng thoát nước:', 'k_{b}', { value: dd.kb, unit: '(m/ngày)', numFmt: '0.0', key: 'dkb', note: 'Điều 7.3.2' });
      line('- Độ rỗng hữu hiệu:', 'n_{e}', { value: dd.ne, numFmt: '0.000', key: 'dne' });
      line('- Chiều dày lớp móng thoát nước:', 'h_{bt}', { value: dd.hbt, unit: '(m)', numFmt: '0.000', key: 'dhbt' });
      line('- Tốc độ thấm:', 'v_{s}', {
        eq: '= (1/n_{e}).k_{b}.√(i_{d}² + i_{n}²) =',
        formula: `(1/${F('dne')})*(${F('dkb')}/86400)*SQRT((${F('did')}/100)^2+(${F('din')}/100)^2)`,
        value: dc.vs,
        unit: '(m/s)',
        numFmt: '0.000E+00',
        key: 'dvs',
        note: 'Công thức (4) — Điều 7.3.4',
      });
      line('- Thời gian thấm nước ra khỏi lớp móng:', 't', {
        eq: '= L_{s}/(3600.v_{s}) =',
        formula: `${F('dLs')}/(3600*${F('dvs')})`,
        value: dc.t,
        unit: '(h)',
        numFmt: '0.000',
        key: 'dt',
        note: 'Công thức (2) — Điều 7.3.4',
      });
      line('- Khả năng thoát nước của lớp móng:', 'h_{bt}.1,0.v_{s}', {
        eq: '=',
        formula: `${F('dhbt')}*1*(${F('dvs')}*86400)`,
        value: dc.cap,
        unit: '(m³/ngày.m)',
        numFmt: '0.000',
        key: 'dcap',
        note: 'Công thức (5) — Điều 7.4.2',
      });
      cursor.blank(8);
      dCmp('b. Thời gian thấm nước:', 't =', F('dt'), dc.t, '<=', '[t] =', String(dd.tLimit), dd.tLimit, dc.t <= dd.tLimit, '(h)', 'Điều 7.1.3');
      dCmp(
        'c. Khả năng thoát nước của lớp móng thoát nước:',
        'h_{bt}.1,0.v_{s} =',
        F('dcap'),
        dc.cap,
        '>=',
        'Q_{i} =',
        F('dQi'),
        dc.Qi,
        dc.cap >= dc.Qi,
        '(m³/ngày.m)',
        'Công thức (5) — Điều 7.4.2'
      );
    } else {
      const pipeRow = (
        label: string,
        sym: string,
        key: string,
        value: number,
        unit: string,
        cond: (c: string) => string,
        ok: boolean,
        note: string
      ): void => {
        const r = line(label, sym, { value, unit, numFmt: '0.0', key, note });
        const row = ws.getRow(r);
        setFormulaCell(
          row.getCell(9),
          `IF(${cond(`F${r}`)},"Đạt","KHÔNG đạt")`,
          ok ? 'Đạt' : 'KHÔNG đạt',
          { bold: true },
          LEFT
        );
        addConclusionColorRule(ws, r, 'I');
        conds.push(cond(`F${r}`));
      };
      cursor.blank(8);
      cursor.prose(2, 'b. Cấu tạo ống thoát nước:');
      pipeRow('- Đường kính ống thoát nước dọc (80–100 mm):', 'Ø', 'dpd', dd.pipeDia, '(mm)', (c) => `AND(${c}>=80,${c}<=100)`, dd.pipeDia >= 80 && dd.pipeDia <= 100, 'Điều 7.2.2');
      pipeRow('- Độ dốc ống thoát nước dọc (≥ 0,3 %):', 'i_{ống dọc}', 'dpl', dd.pipeSlopeLong, '(%)', (c) => `${c}>=0.3`, dd.pipeSlopeLong >= 0.3, 'Điều 7.2.2');
      pipeRow('- Độ dốc ống thoát nước ngang (≥ 5 %):', 'i_{ống ngang}', 'dpc', dd.pipeSlopeCross, '(%)', (c) => `${c}>=5`, dd.pipeSlopeCross >= 5, 'Điều 7.2.3');
      pipeRow('- Khoảng cách ống thoát nước ngang (50–100 m):', 'a', 'dps', dd.pipeSpacing, '(m)', (c) => `AND(${c}>=50,${c}<=100)`, dd.pipeSpacing >= 50 && dd.pipeSpacing <= 100, 'Điều 7.2.3');
    }
    cursor.blank(8);
    const rDc = cursor.next(15.75);
    const okMsg = 'Kết luận: Hệ thống thoát nước đảm bảo các yêu cầu của Điều 7.';
    const failMsg = 'Kết luận: Hệ thống thoát nước KHÔNG đảm bảo các yêu cầu của Điều 7.';
    setFormulaCell(
      ws.getRow(rDc).getCell(2),
      `IF(AND(${conds.join(',')}),"${escFormulaStr(okMsg)}","${escFormulaStr(failMsg)}")`,
      dr.passed ? okMsg : failMsg,
      { bold: true, italic: true, color: dr.passed ? COLOR_PASS : COLOR_FAIL },
      LEFT
    );
    addConclusionColorRule(ws, rDc);
    cursor.blank(12.75);
  }

  if (v.warnings.length > 0) {
    cursor.sectionHeading(`${v.drain ? 'VII' : 'VI'}. LƯU Ý & CẢNH BÁO KỸ THUẬT:`);
    for (const w of v.warnings) cursor.prose(2, `⚠ ${w}`, { italic: true });
  }
}

export async function buildRigidWorkbook(project: ProjectState): Promise<ExcelJS.Workbook> {
  const WorkbookCtor =
    ExcelJS.Workbook ??
    (ExcelJS as unknown as { default?: { Workbook?: typeof ExcelJS.Workbook } }).default?.Workbook;
  if (!WorkbookCtor) throw new Error('Không thể khởi tạo ExcelJS.Workbook.');
  const wb = new WorkbookCtor();
  wb.creator = 'Mặt đường BTXM (TCCS 39:2022/TCĐBVN)';
  wb.created = new Date();
  const ws = wb.addWorksheet('Kiểm toán mặt đường cứng');
  populateRigidSheet(ws, project);
  return wb;
}

export async function exportRigidToXlsxBuffer(project: ProjectState): Promise<Uint8Array> {
  const wb = await buildRigidWorkbook(project);
  const raw = await wb.xlsx.writeBuffer();
  return raw instanceof Uint8Array ? raw : new Uint8Array(raw as ArrayBuffer);
}

export async function downloadRigidExcel(project: ProjectState, filename?: string): Promise<void> {
  const bytes = await exportRigidToXlsxBuffer(project);
  const blob = new Blob([bytes.buffer as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeBase =
    (project.projectInfo.congTrinh || 'KetQuaKiemToan_TCCS39_2022').replace(/[\\/:*?"<>|]/g, '_').trim() ||
    'KetQuaKiemToan_TCCS39_2022';
  link.href = url;
  link.download = filename || `${safeBase}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
