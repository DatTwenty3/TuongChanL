import ExcelJS from 'exceljs';
import type {
  AlternativeVerificationResult,
  DistressSeverity,
  EchCuMethod,
  FullVerificationResult,
  PavementAlternative,
  ProjectState,
  RehabStrategy,
  TwoLayerReductionResult,
  WheelGroupType,
} from '../types/project';
import {
  applyRowGridBorders,
  buildBetaFormula,
  buildKcdDvFormula,
  buildKcdTrKuFormula,
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

function fmt(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return n.toFixed(digits);
}

function wheelGroupLabel(w: WheelGroupType): string {
  switch (w) {
    case 'DON':
      return 'Cụm bánh đơn';
    case 'DOI':
      return 'Cụm bánh đôi';
    case 'BON':
      return 'Cụm bánh bốn';
  }
}

function surfaceGradeLabel(grade: ProjectState['designParams']['loaiTangMat']): string {
  switch (grade) {
    case 'A1':
      return 'Cấp cao A1';
    case 'A2':
      return 'Cấp cao A2';
    case 'B1':
      return 'Cấp thấp B1';
    case 'B2':
      return 'Cấp thấp B2';
  }
}

function rehabStrategyLabel(strategy: RehabStrategy): string {
  switch (strategy) {
    case 'DIRECT_OVERLAY':
      return 'Tăng cường trực tiếp lên mặt đường cũ (§10.1.4.3)';
    case 'MILL_AND_OVERLAY':
      return 'Cào bóc tầng mặt hư hỏng, tận dụng móng cũ + tăng cường (§10.1.4.3)';
    case 'FULL_REBUILD':
      return 'Cải tạo toàn bộ kết cấu từ nền trở lên (§10.1.4.3)';
  }
}

function echCuMethodLabel(method?: EchCuMethod): string {
  switch (method) {
    case 'BENKELMAN':
      return 'Phương pháp A — Cần đo võng Benkelman (TCVN 8867, §10.3.2)';
    case 'DIRECT_FWD':
      return 'Phương pháp B — Nhập trực tiếp Ech,cũ / FWD (TCVN 8867 / TCVN 8861)';
    case 'LAYER_STACK':
      return 'Phương pháp C — Quy đổi từ các lớp kết cấu cũ giữ lại + nền đất (§10.3.3)';
    default:
      return 'Xác định theo Chương 10';
  }
}

function distressSeverityLabel(sev: DistressSeverity): string {
  switch (sev) {
    case 'NONE':
      return 'Không có';
    case 'NHE':
      return 'Nhẹ';
    case 'VUA':
      return 'Vừa';
    case 'NANG':
      return 'Nặng';
  }
}

export function sanitizeSheetName(raw: string, used: Set<string>): string {
  const cleaned = raw.replace(/[\\/?*[\]:]/g, '_').trim() || 'PhuongAn';
  const base = cleaned.slice(0, 31);
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let idx = 2;
  while (idx < 100) {
    const suffix = ` (${idx})`;
    const candidate = base.slice(0, 31 - suffix.length) + suffix;
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
    idx += 1;
  }
  const fallback = `PA_${used.size + 1}`;
  used.add(fallback);
  return fallback;
}

/**
 * Dòng "Kết luận: … KHÔNG đảm bảo …" đổi màu theo kết quả tính lại trong Excel:
 * có chữ "KHÔNG" → đỏ, ngược lại → xanh (định dạng có điều kiện, không phụ thuộc màu lưu sẵn).
 */
export function addConclusionColorRule(ws: ExcelJS.Worksheet, row: number, col = 'B'): void {
  const ref = `${col}${row}`;
  const failTest = `ISNUMBER(SEARCH("KHÔNG",$${col}$${row}))`;
  ws.addConditionalFormatting({
    ref,
    rules: [
      {
        type: 'expression',
        priority: 1,
        formulae: [failTest],
        style: { font: { color: { argb: COLOR_FAIL } } },
      },
      {
        type: 'expression',
        priority: 2,
        formulae: [`NOT(${failTest})`],
        style: { font: { color: { argb: COLOR_PASS } } },
      },
    ],
  });
}

interface SourceLayerRef {
  row: number;
  sheetTable: 'B3' | 'B3B';
  kHh?: number;
}

export class SheetCursor {
  private row = 0;
  constructor(private readonly ws: ExcelJS.Worksheet) {}

  next(heightPt = 15.75): number {
    this.row += 1;
    this.ws.getRow(this.row).height = heightPt;
    return this.row;
  }

  blank(heightPt = 12.75): number {
    return this.next(heightPt);
  }

  sectionHeading(text: string, heightPt = 15.75): number {
    const r = this.next(heightPt);
    setCellMarkup(
      this.ws.getRow(r).getCell(1),
      text,
      { bold: true, underline: true },
      { horizontal: 'left', vertical: 'middle' }
    );
    return r;
  }

  subStepHeading(letter: string, markup: string, heightPt = 15.75): number {
    const r = this.next(heightPt);
    const row = this.ws.getRow(r);
    setPlainCell(
      row.getCell(1),
      letter,
      { bold: true, underline: true },
      { horizontal: 'right', vertical: 'middle' }
    );
    setCellMarkup(
      row.getCell(2),
      markup,
      { bold: true, underline: true },
      { horizontal: 'left', vertical: 'middle' }
    );
    return r;
  }

  tableCaption(text: string): number {
    const r = this.next(26.25);
    setPlainCell(
      this.ws.getRow(r).getCell(2),
      text,
      { bold: true, italic: true },
      { horizontal: 'left', vertical: 'middle' }
    );
    return r;
  }

  prose(col: number, markup: string, opts?: { height?: number; italic?: boolean; bold?: boolean }): number {
    const plain = markup.replace(/(_|\^)\{([^}]*)\}/g, '$2');
    const shouldWrap = col === 2 && plain.length > 88;
    const h = opts?.height ?? (shouldWrap ? calcWrapHeight(plain, 106, 16.5) : 15.75);
    const r = this.next(h);
    setCellMarkup(
      this.ws.getRow(r).getCell(col),
      markup,
      { italic: opts?.italic, bold: opts?.bold },
      { horizontal: 'left', vertical: 'middle', wrapText: shouldWrap }
    );
    if (shouldWrap) {
      this.ws.mergeCells(r, 2, r, 11);
    }
    return r;
  }
}

function writeReductionTable(
  ws: ExcelJS.Worksheet,
  cursor: SheetCursor,
  reduction: TwoLayerReductionResult,
  modulusMarkup: string,
  modulusColInB3: 'F' | 'G' | 'H',
  sourceRefs?: Array<SourceLayerRef | null>
): { rTop: number; rBot: number } {
  const rHdr = cursor.next(30.0);
  const hdrRow = ws.getRow(rHdr);
  const hdrAlign: Partial<ExcelJS.Alignment> = {
    horizontal: 'center',
    vertical: 'middle',
    wrapText: true,
  };
  setPlainCell(hdrRow.getCell(1), 'STT', {}, hdrAlign);
  setPlainCell(hdrRow.getCell(2), 'Lớp vật liệu (từ trên xuống)', {}, hdrAlign);
  setCellMarkup(hdrRow.getCell(6), modulusMarkup, {}, hdrAlign);
  setCellMarkup(hdrRow.getCell(7), 't = E_{2}/E_{1}', {}, hdrAlign);
  setCellMarkup(hdrRow.getCell(8), 'h_{i} (cm)', {}, hdrAlign);
  setCellMarkup(hdrRow.getCell(9), 'k = h_{2}/h_{1}', {}, hdrAlign);
  setCellMarkup(hdrRow.getCell(10), 'H_{tb} (cm)', {}, hdrAlign);
  setCellMarkup(hdrRow.getCell(11), "E'_{tb} (MPa)", {}, hdrAlign);
  applyRowGridBorders(ws, rHdr, { top: 'medium', bottom: 'medium', mergedSpans: [[2, 5]] });
  ws.mergeCells(rHdr, 2, rHdr, 5);

  const count = reduction.rows.length;
  const rTop = rHdr + 1;
  const rBot = rHdr + count;

  for (let i = 0; i < count; i += 1) {
    const item = reduction.rows[i];
    const r = cursor.next(calcWrapHeight(item.tenVatLieu, 38, 15.75));
    const row = ws.getRow(r);
    const isFirst = i === 0;
    const isLast = i === count - 1;
    const src = sourceRefs ? sourceRefs[i] : null;

    setPlainCell(row.getCell(1), i + 1, {}, { horizontal: 'center', vertical: 'middle' }, '0');
    setPlainCell(
      row.getCell(2),
      item.tenVatLieu,
      {},
      { horizontal: 'left', vertical: 'middle', wrapText: true }
    );

    if (src) {
      const eExpr =
        src.sheetTable === 'B3B' && src.kHh !== undefined && src.kHh < 1
          ? `${modulusColInB3}${src.row}*I${src.row}`
          : `${modulusColInB3}${src.row}`;
      setFormulaCell(
        row.getCell(6),
        eExpr,
        Number(item.E_MPa.toFixed(2)),
        {},
        { horizontal: 'center', vertical: 'middle' },
        'General'
      );
      setFormulaCell(
        row.getCell(8),
        `E${src.row}`,
        Number(item.h_cm.toFixed(2)),
        {},
        { horizontal: 'center', vertical: 'middle' },
        'General'
      );
    } else {
      setPlainCell(
        row.getCell(6),
        Number(item.E_MPa.toFixed(2)),
        {},
        { horizontal: 'center', vertical: 'middle' },
        'General'
      );
      setPlainCell(
        row.getCell(8),
        Number(item.h_cm.toFixed(2)),
        {},
        { horizontal: 'center', vertical: 'middle' },
        'General'
      );
    }

    if (isLast) {
      setPlainCell(row.getCell(7), 0, {}, { horizontal: 'center', vertical: 'middle' }, '0.000');
      setPlainCell(row.getCell(9), 0, {}, { horizontal: 'center', vertical: 'middle' }, '0.000');
      setFormulaCell(
        row.getCell(10),
        `H${r}`,
        Number(item.Htb_cm.toFixed(2)),
        {},
        { horizontal: 'center', vertical: 'middle' },
        'General'
      );
      setFormulaCell(
        row.getCell(11),
        `F${r}`,
        Number(item.EtbPrime_MPa.toFixed(2)),
        {},
        { horizontal: 'center', vertical: 'middle' },
        '0.00'
      );
    } else {
      setFormulaCell(
        row.getCell(7),
        `F${r}/K${r + 1}`,
        Number((item.t_E1_E2 ?? 0).toFixed(3)),
        {},
        { horizontal: 'center', vertical: 'middle' },
        '0.000'
      );
      setFormulaCell(
        row.getCell(9),
        `H${r}/J${r + 1}`,
        Number((item.k_h1_h2 ?? 0).toFixed(3)),
        {},
        { horizontal: 'center', vertical: 'middle' },
        '0.000'
      );
      setFormulaCell(
        row.getCell(10),
        `H${r}+J${r + 1}`,
        Number(item.Htb_cm.toFixed(2)),
        {},
        { horizontal: 'center', vertical: 'middle' },
        'General'
      );
      setFormulaCell(
        row.getCell(11),
        `K${r + 1}*((1+I${r}*G${r}^(1/3))/(1+I${r}))^3`,
        Number(item.EtbPrime_MPa.toFixed(2)),
        {},
        { horizontal: 'center', vertical: 'middle' },
        '0.00'
      );
    }

    applyRowGridBorders(ws, r, {
      top: isFirst ? 'medium' : 'hair',
      bottom: isLast ? 'medium' : 'hair',
      mergedSpans: [[2, 5]],
    });
    ws.mergeCells(r, 2, r, 5);
  }

  return { rTop, rBot };
}

function writeTwoLayerBetaBlock(
  ws: ExcelJS.Worksheet,
  cursor: SheetCursor,
  rTop: number,
  rBot: number,
  rD: number,
  reduction: TwoLayerReductionResult,
  options?: { includeLayerSummary?: boolean }
): { rHD: number; rBeta: number; rEtbPrime: number; rEtbDc: number } {
  const rHD = cursor.next(15.75);
  setPlainCell(ws.getRow(rHD).getCell(3), 'H/D', {}, { horizontal: 'left', vertical: 'middle' });
  setPlainCell(ws.getRow(rHD).getCell(4), '=', {}, { horizontal: 'left', vertical: 'middle' });
  setFormulaCell(
    ws.getRow(rHD).getCell(6),
    `J${rTop}/$F$${rD}`,
    Number(reduction.H_over_D.toFixed(3)),
    {},
    { horizontal: 'left', vertical: 'middle' },
    '0.000'
  );

  cursor.prose(2, 'Tra Bảng 11, hệ số điều chỉnh β:');

  const rBeta = cursor.next(15.75);
  setPlainCell(ws.getRow(rBeta).getCell(3), 'β', {}, { horizontal: 'left', vertical: 'middle' });
  setPlainCell(ws.getRow(rBeta).getCell(4), '=', {}, { horizontal: 'left', vertical: 'middle' });
  setFormulaCell(
    ws.getRow(rBeta).getCell(6),
    buildBetaFormula(`F${rHD}`),
    Number(reduction.beta.toFixed(3)),
    {},
    { horizontal: 'left', vertical: 'middle' },
    '0.000'
  );

  cursor.prose(2, 'Từ bảng kết quả tính đổi trên, ta có:');

  const rEtbPrime = cursor.next(18.75);
  setCellMarkup(ws.getRow(rEtbPrime).getCell(3), "E'_{tb}", {}, { horizontal: 'left', vertical: 'middle' });
  setPlainCell(ws.getRow(rEtbPrime).getCell(4), '=', {}, { horizontal: 'left', vertical: 'middle' });
  setFormulaCell(
    ws.getRow(rEtbPrime).getCell(6),
    `K${rTop}`,
    Number(reduction.EtbPrime_MPa.toFixed(2)),
    {},
    { horizontal: 'left', vertical: 'middle' },
    '0.00'
  );
  setPlainCell(ws.getRow(rEtbPrime).getCell(7), '(MPa)', {}, { horizontal: 'left', vertical: 'middle' });

  cursor.prose(
    2,
    reduction.etbCapped
      ? `Mô đun đàn hồi trung bình điều chỉnh dùng để tính toán (kẹp trần max(Ei) = ${fmt(reduction.maxLayerE_MPa, 2)} MPa theo Bảng 11 Chú thích 2):`
      : 'Mô đun đàn hồi trung bình điều chỉnh dùng để tính toán:'
  );

  const rEtbDc = cursor.next(18.75);
  setCellMarkup(ws.getRow(rEtbDc).getCell(3), 'E_{tb}^{đc}', {}, { horizontal: 'left', vertical: 'middle' });
  setCellMarkup(ws.getRow(rEtbDc).getCell(4), "= β * E'_{tb} =", {}, { horizontal: 'left', vertical: 'middle' });
  setFormulaCell(
    ws.getRow(rEtbDc).getCell(6),
    `MIN(ROUND(F${rBeta}*F${rEtbPrime},3),MAX(F${rTop}:F${rBot}))`,
    Number(reduction.Etb_dc_MPa.toFixed(2)),
    {},
    { horizontal: 'left', vertical: 'middle' },
    '0.00'
  );
  setPlainCell(ws.getRow(rEtbDc).getCell(7), '(MPa)', {}, { horizontal: 'left', vertical: 'middle' });
  setPlainCell(
    ws.getRow(rEtbDc).getCell(8),
    'Công thức (6) — Điều 9.2.4',
    {},
    { horizontal: 'left', vertical: 'middle' }
  );

  if (options?.includeLayerSummary) {
    cursor.prose(2, 'Vậy kết cấu nhiều lớp được đưa về hệ 2 lớp, với lớp trên:');
    const rSumH = cursor.next(15.75);
    setPlainCell(ws.getRow(rSumH).getCell(3), '- Chiều dày:', {}, { horizontal: 'left', vertical: 'middle' });
    setPlainCell(ws.getRow(rSumH).getCell(6), 'H', {}, { horizontal: 'left', vertical: 'middle' });
    setFormulaCell(
      ws.getRow(rSumH).getCell(7),
      `J${rTop}`,
      Number(reduction.H_total_cm.toFixed(2)),
      {},
      { horizontal: 'left', vertical: 'middle' },
      Number.isInteger(reduction.H_total_cm) ? '"= "0' : '"= "0.00'
    );
    setPlainCell(ws.getRow(rSumH).getCell(8), '(cm)', {}, { horizontal: 'left', vertical: 'middle' });

    const rSumE = cursor.next(18.75);
    setPlainCell(
      ws.getRow(rSumE).getCell(3),
      '- Mô đun đàn hồi trung bình:',
      {},
      { horizontal: 'left', vertical: 'middle' }
    );
    setCellMarkup(ws.getRow(rSumE).getCell(6), 'E_{tb}^{đc}', {}, { horizontal: 'left', vertical: 'middle' });
    setFormulaCell(
      ws.getRow(rSumE).getCell(7),
      `F${rEtbDc}`,
      Number(reduction.Etb_dc_MPa.toFixed(2)),
      {},
      { horizontal: 'left', vertical: 'middle' },
      '"= "0.00'
    );
    setPlainCell(ws.getRow(rSumE).getCell(8), '(MPa)', {}, { horizontal: 'left', vertical: 'middle' });
  }

  return { rHD, rBeta, rEtbPrime, rEtbDc };
}

function writeEquivEchBlock(
  ws: ExcelJS.Worksheet,
  cursor: SheetCursor,
  rEtbDc: number,
  rHD: number,
  foundationCellRef: string,
  foundationModulus: number,
  etbDcVal: number,
  hOverD: number,
  echOverE1: number | null,
  echVal: number,
  usedFormulaF1: boolean,
  isRehabFoundation: boolean,
  isDeflectionSection: boolean
): { rEchm: number } {
  const e0Ratio = etbDcVal > 0 ? foundationModulus / etbDcVal : 0;

  const rE1 = cursor.next(18.75);
  setCellMarkup(ws.getRow(rE1).getCell(3), 'E_{1}', {}, { horizontal: 'left', vertical: 'middle' });
  setCellMarkup(ws.getRow(rE1).getCell(4), '= E_{tb}^{đc} =', {}, { horizontal: 'left', vertical: 'middle' });
  setFormulaCell(
    ws.getRow(rE1).getCell(6),
    `F${rEtbDc}`,
    Number(etbDcVal.toFixed(2)),
    {},
    { horizontal: 'left', vertical: 'middle' },
    '0.00'
  );
  setPlainCell(ws.getRow(rE1).getCell(7), '(MPa)', {}, { horizontal: 'left', vertical: 'middle' });

  const rE0E1 = cursor.next(18.75);
  setCellMarkup(
    ws.getRow(rE0E1).getCell(3),
    isRehabFoundation ? "E'_{0}/E_{1}" : 'E_{0}/E_{1}',
    {},
    { horizontal: 'left', vertical: 'middle' }
  );
  setPlainCell(ws.getRow(rE0E1).getCell(4), '=', {}, { horizontal: 'left', vertical: 'middle' });
  setFormulaCell(
    ws.getRow(rE0E1).getCell(6),
    `${foundationCellRef}/F${rE1}`,
    Number(e0Ratio.toFixed(3)),
    {},
    { horizontal: 'left', vertical: 'middle' },
    '0.000'
  );

  const rHD2 = cursor.next(15.75);
  setPlainCell(ws.getRow(rHD2).getCell(3), 'H/D', {}, { horizontal: 'left', vertical: 'middle' });
  setPlainCell(ws.getRow(rHD2).getCell(4), '=', {}, { horizontal: 'left', vertical: 'middle' });
  setFormulaCell(
    ws.getRow(rHD2).getCell(6),
    `F${rHD}`,
    Number(hOverD.toFixed(3)),
    {},
    { horizontal: 'left', vertical: 'middle' },
    '0.000'
  );

  let rEchm: number;
  if (!usedFormulaF1) {
    cursor.prose(
      2,
      isRehabFoundation
        ? "Tra toán đồ Hình 2, với các thông số H/D và E'_{0}/E_{1} ở trên, ta xác định được:"
        : 'Tra toán đồ Hình 2, với các thông số H/D và E_{0}/E_{1} ở trên, ta xác định được:',
      { height: 18.75 }
    );
    const rRatio = cursor.next(18.75);
    setCellMarkup(ws.getRow(rRatio).getCell(3), 'E_{ch.m}/E_{1}', {}, { horizontal: 'left', vertical: 'middle' });
    setPlainCell(ws.getRow(rRatio).getCell(4), '=', {}, { horizontal: 'left', vertical: 'middle' });
    setPlainCell(
      ws.getRow(rRatio).getCell(6),
      Number((echOverE1 ?? 0).toFixed(6)),
      {},
      { horizontal: 'left', vertical: 'middle' },
      '0.000'
    );

    cursor.prose(2, 'Mô đun đàn hồi chung của kết cấu:');
    rEchm = cursor.next(18.75);
    setCellMarkup(ws.getRow(rEchm).getCell(3), 'E_{ch.m}', {}, { horizontal: 'left', vertical: 'middle' });
    setPlainCell(ws.getRow(rEchm).getCell(4), '=', {}, { horizontal: 'left', vertical: 'middle' });
    setFormulaCell(
      ws.getRow(rEchm).getCell(6),
      `ROUND(F${rRatio}*F${rE1},3)`,
      Number(echVal.toFixed(3)),
      { bold: isDeflectionSection },
      { horizontal: 'left', vertical: 'middle' },
      '0.00'
    );
    setPlainCell(ws.getRow(rEchm).getCell(7), '(MPa)', {}, { horizontal: 'left', vertical: 'middle' });
  } else {
    cursor.prose(
      2,
      `Sử dụng Công thức (E.1) — Phụ lục E${isRehabFoundation ? ` với Eo' = Ech,cũ = ${fmt(foundationModulus, 2)} MPa` : ''}:`
    );
    rEchm = cursor.next(18.75);
    setCellMarkup(ws.getRow(rEchm).getCell(3), 'E_{ch.m}', {}, { horizontal: 'left', vertical: 'middle' });
    setPlainCell(ws.getRow(rEchm).getCell(4), '=', {}, { horizontal: 'left', vertical: 'middle' });
    setFormulaCell(
      ws.getRow(rEchm).getCell(6),
      `ROUND((1.05*${foundationCellRef})/((1+F${rE0E1})/SQRT(1+4*F${rHD2}^2*F${rE0E1}^(-0.67))+F${rE0E1}),3)`,
      Number(echVal.toFixed(3)),
      { bold: isDeflectionSection },
      { horizontal: 'left', vertical: 'middle' },
      '0.00'
    );
    setPlainCell(ws.getRow(rEchm).getCell(7), '(MPa)', {}, { horizontal: 'left', vertical: 'middle' });
  }

  return { rEchm };
}

function buildWeightedModulusFormula(
  refs: SourceLayerRef[],
  hCol: 'E',
  eCol: 'H'
): { hFormula: string; eFormula: string } {
  if (refs.length === 0) {
    return { hFormula: '0', eFormula: '0' };
  }
  // Group contiguous runs on the same table without custom kHh < 1
  const hTerms: string[] = [];
  const eNumTerms: string[] = [];

  let idx = 0;
  while (idx < refs.length) {
    const start = refs[idx];
    if (start.sheetTable === 'B3B' && start.kHh !== undefined && start.kHh < 1) {
      hTerms.push(`${hCol}${start.row}`);
      eNumTerms.push(`${eCol}${start.row}*I${start.row}*${hCol}${start.row}`);
      idx += 1;
      continue;
    }
    let endIdx = idx;
    while (
      endIdx + 1 < refs.length &&
      refs[endIdx + 1].sheetTable === start.sheetTable &&
      !(refs[endIdx + 1].sheetTable === 'B3B' && (refs[endIdx + 1].kHh ?? 1) < 1) &&
      refs[endIdx + 1].row === refs[endIdx].row + 1
    ) {
      endIdx += 1;
    }
    const end = refs[endIdx];
    if (end.row === start.row) {
      hTerms.push(`${hCol}${start.row}`);
      eNumTerms.push(`${eCol}${start.row}*${hCol}${start.row}`);
    } else {
      hTerms.push(`SUM(${hCol}${start.row}:${hCol}${end.row})`);
      eNumTerms.push(`SUMPRODUCT(${eCol}${start.row}:${eCol}${end.row},${hCol}${start.row}:${hCol}${end.row})`);
    }
    idx = endIdx + 1;
  }

  const hFormula = hTerms.length === 1 && hTerms[0].startsWith('SUM(') ? hTerms[0] : `SUM(${hTerms.join(',')})`;
  const numExpr = eNumTerms.join('+');
  const eFormula = `(${numExpr})/${hFormula}`;
  return { hFormula, eFormula };
}

function populateAlternativeSheet(
  ws: ExcelJS.Worksheet,
  project: ProjectState,
  verification: FullVerificationResult,
  alt: PavementAlternative,
  altRes: AlternativeVerificationResult
): void {
  const { traffic, subgradeResolved, modulusResolved } = verification;
  const { projectInfo, roadScale, forecast, subgrade, designParams, rehabilitation } = project;
  const rehabSummary = altRes.rehabSummary;
  const isCaiTao = (rehabSummary?.loaiTK ?? projectInfo.loaiTK) === 'CAI_TAO';
  const effectiveStrategy = rehabSummary?.strategy ?? rehabilitation?.strategy ?? 'DIRECT_OVERLAY';
  const isRehabOverlay = isCaiTao && effectiveStrategy !== 'FULL_REBUILD';

  ws.views = [{ showGridLines: true }];
  ws.pageSetup = PAGE_SETUP_A4;
  ws.columns = COL_WIDTHS_11.map((width) => ({ width }));

  const cursor = new SheetCursor(ws);

  // =========================================================================
  // HEADER (R1..R4) — CenterContinuous across A..K, zero background fill
  // =========================================================================
  const rTitle = cursor.next(18.75);
  setupCenterContinuousRow(
    ws,
    rTitle,
    isCaiTao ? 'BẢNG TÍNH KẾT CẤU TĂNG CƯỜNG, CẢI TẠO ÁO ĐƯỜNG CŨ' : 'BẢNG TÍNH KẾT CẤU ÁO ĐƯỜNG',
    { size: 14, bold: true },
    18.75
  );

  const rSub = cursor.next(17.25);
  setupCenterContinuousRow(
    ws,
    rSub,
    isCaiTao
      ? 'Theo tiêu chuẩn TCCS 38:2022/TCĐBVN (Chương 10)'
      : 'Theo tiêu chuẩn TCCS 38:2022/TCĐBVN',
    { size: 13, bold: true, italic: true },
    17.25
  );

  const rProj = cursor.next(17.25);
  setupCenterContinuousRow(
    ws,
    rProj,
    `Công trình: ${projectInfo.congTrinh || '—'}`,
    { size: 13, bold: true, italic: true },
    17.25
  );

  cursor.blank(12.75);

  // =========================================================================
  // SECTION I: TÍNH SỐ TRỤC XE TÍNH TOÁN
  // =========================================================================
  cursor.sectionHeading('I. TÍNH SỐ TRỤC XE TÍNH TOÁN:');
  cursor.sectionHeading('I.1. Số liệu ban đầu:');

  const rPtt = cursor.next(30.0);
  setCellMarkup(
    ws.getRow(rPtt).getCell(2),
    '- Tải trọng trục tính toán tiêu chuẩn P_{tt} (kN) (Bảng 6):',
    {},
    { horizontal: 'left', vertical: 'middle', wrapText: true }
  );
  ws.mergeCells(rPtt, 2, rPtt, 6);
  setPlainCell(
    ws.getRow(rPtt).getCell(7),
    forecast.tlTrucQuyDoi_kN,
    {},
    { horizontal: 'left', vertical: 'middle' },
    '0'
  );

  const rObj = cursor.next(18.75);
  const objLabel = projectInfo.doiTuongTK === 'LGC' ? 'Lề gia cố' : 'Áo đường';
  setCellMarkup(
    ws.getRow(rObj).getCell(2),
    '- Tính N_{tt} để thiết kế kết cấu:',
    {},
    { horizontal: 'left', vertical: 'middle' }
  );
  setPlainCell(
    ws.getRow(rObj).getCell(7),
    objLabel,
    {},
    { horizontal: 'left', vertical: 'middle' }
  );

  const rLanes = cursor.next(18.75);
  setCellMarkup(
    ws.getRow(rLanes).getCell(2),
    '- Số làn xe thiết kế n_{làn} (làn):',
    {},
    { horizontal: 'left', vertical: 'middle' }
  );
  setPlainCell(
    ws.getRow(rLanes).getCell(7),
    roadScale.soLanXe,
    {},
    { horizontal: 'left', vertical: 'middle' },
    '0'
  );

  const rMedian = cursor.next(15.75);
  setPlainCell(
    ws.getRow(rMedian).getCell(2),
    '- Dải phân cách giữa:',
    {},
    { horizontal: 'left', vertical: 'middle' }
  );
  setPlainCell(
    ws.getRow(rMedian).getCell(7),
    roadScale.gpcGiua ? 'Có dải phân cách' : 'Không có dải phân cách',
    {},
    { horizontal: 'left', vertical: 'middle' }
  );

  const rFl = cursor.next(18.75);
  setCellMarkup(
    ws.getRow(rFl).getCell(2),
    '- Hệ số phân phối số trục xe tính toán trên mỗi làn xe f_{L} =',
    {},
    { horizontal: 'left', vertical: 'middle' }
  );
  setPlainCell(
    ws.getRow(rFl).getCell(7),
    Number(roadScale.heSoLan_fL.toFixed(5)),
    {},
    { horizontal: 'left', vertical: 'middle' },
    projectInfo.doiTuongTK === 'LGC' ? '0.000' : '0.00'
  );

  // Bảng 1
  cursor.tableCaption(
    'Bảng 1: Dự báo thành phần xe thông qua mặt cắt ngang điển hình ở năm cuối thời hạn thiết kế'
  );

  const rB1H1 = cursor.next(18.75);
  const rB1H2 = cursor.next(30.0);
  const b1Align: Partial<ExcelJS.Alignment> = {
    horizontal: 'center',
    vertical: 'middle',
    wrapText: true,
  };
  const b1R1 = ws.getRow(rB1H1);
  const b1R2 = ws.getRow(rB1H2);
  setPlainCell(b1R1.getCell(1), 'STT', {}, b1Align);
  setPlainCell(b1R1.getCell(2), 'Loại xe', {}, b1Align);
  setCellMarkup(b1R1.getCell(6), 'Trọng lượng trục P_{i} (kN)', {}, b1Align);
  setPlainCell(b1R2.getCell(6), 'Trục trước', {}, b1Align);
  setPlainCell(b1R2.getCell(7), 'Trục sau', {}, b1Align);
  setPlainCell(b1R1.getCell(8), 'Số trục sau (trục)', {}, b1Align);
  setCellMarkup(b1R1.getCell(9), 'Số bánh của 1 cụm bánh ở trục sau n_{b}', {}, b1Align);
  setCellMarkup(b1R1.getCell(10), 'Khoảng cách giữa các trục sau L_{tr} (m)', {}, b1Align);
  setPlainCell(b1R1.getCell(11), 'Lưu lượng xe 2 chiều (xe/ng.đêm)', {}, b1Align);

  applyRowGridBorders(ws, rB1H1, {
    top: 'medium',
    bottom: 'thin',
    mergedSpans: [
      [2, 5],
      [6, 7],
    ],
  });
  applyRowGridBorders(ws, rB1H2, {
    top: 'thin',
    bottom: 'medium',
    mergedSpans: [[2, 5]],
  });
  // Clear horizontal divider inside vertically-merged header columns
  for (const c of [1, 2, 3, 4, 5, 8, 9, 10, 11]) {
    b1R1.getCell(c).border = { ...b1R1.getCell(c).border, bottom: undefined };
    b1R2.getCell(c).border = { ...b1R2.getCell(c).border, top: undefined };
  }
  ws.mergeCells(rB1H1, 1, rB1H2, 1);
  ws.mergeCells(rB1H1, 2, rB1H2, 5);
  ws.mergeCells(rB1H1, 6, rB1H1, 7);
  ws.mergeCells(rB1H1, 8, rB1H2, 8);
  ws.mergeCells(rB1H1, 9, rB1H2, 9);
  ws.mergeCells(rB1H1, 10, rB1H2, 10);
  ws.mergeCells(rB1H1, 11, rB1H2, 11);

  const b1Rows: number[] = [];
  const vehCount = project.vehicles.length;
  project.vehicles.forEach((v, idx) => {
    const r = cursor.next(calcWrapHeight(v.tenXe, 38, 15.75));
    b1Rows.push(r);
    const row = ws.getRow(r);
    const isFirst = idx === 0;
    const isLast = idx === vehCount - 1;
    setPlainCell(row.getCell(1), idx + 1, {}, { horizontal: 'center', vertical: 'middle' }, '0');
    setPlainCell(row.getCell(2), v.tenXe, {}, { horizontal: 'left', vertical: 'middle', wrapText: true });
    setPlainCell(
      row.getCell(6),
      v.tlTrucTruoc_kN > 0 ? Number(v.tlTrucTruoc_kN.toFixed(2)) : '-',
      {},
      { horizontal: 'center', vertical: 'middle' },
      v.tlTrucTruoc_kN > 0 ? 'General' : undefined
    );
    setPlainCell(
      row.getCell(7),
      v.tlTrucSau_kN > 0 ? Number(v.tlTrucSau_kN.toFixed(2)) : '-',
      {},
      { horizontal: 'center', vertical: 'middle' },
      v.tlTrucSau_kN > 0 ? 'General' : undefined
    );
    setPlainCell(
      row.getCell(8),
      v.soTrucSau > 0 ? v.soTrucSau : '-',
      {},
      { horizontal: 'center', vertical: 'middle' },
      v.soTrucSau > 0 ? '0' : undefined
    );
    setPlainCell(
      row.getCell(9),
      v.soTrucSau > 0 ? wheelGroupLabel(v.cumBanhTrucSau) : '-',
      {},
      { horizontal: 'center', vertical: 'middle' }
    );
    setPlainCell(
      row.getCell(10),
      v.soTrucSau > 1 ? Number(v.khoangCachTrucSau_m.toFixed(2)) : '-',
      {},
      { horizontal: 'center', vertical: 'middle' },
      v.soTrucSau > 1 ? 'General' : undefined
    );
    setPlainCell(
      row.getCell(11),
      v.luuLuong_xeNgDem,
      {},
      { horizontal: 'center', vertical: 'middle' },
      '#,##0'
    );
    applyRowGridBorders(ws, r, {
      top: isFirst ? 'medium' : 'hair',
      bottom: isLast ? 'medium' : 'hair',
      mergedSpans: [[2, 5]],
    });
    ws.mergeCells(r, 2, r, 5);
  });

  cursor.blank(12.75);

  // I.2 Tổng số trục xe quy đổi & Bảng 2
  cursor.sectionHeading('I.2. Tổng số trục xe sau khi quy đổi về trục tính toán N_{tk}:', 18.75);
  cursor.prose(1, 'Công thức tính:');
  const rFml1 = cursor.next(18.75);
  setCellMarkup(
    ws.getRow(rFml1).getCell(2),
    'N_{tk} = ΣN_{i} = ΣC_{1}.C_{2}.n_{i}.(P_{i}/P_{tt})^{4.4}',
    {},
    { horizontal: 'left', vertical: 'middle' }
  );
  setPlainCell(ws.getRow(rFml1).getCell(6), '(Trục/ngày.đêm)', {}, { horizontal: 'left', vertical: 'middle' });
  setPlainCell(ws.getRow(rFml1).getCell(8), 'Công thức (1) — Điều 7.7', {}, { horizontal: 'left', vertical: 'middle' });

  const rFml2 = cursor.next(18.75);
  setPlainCell(ws.getRow(rFml2).getCell(2), 'Trong đó:', {}, { horizontal: 'left', vertical: 'middle' });
  setCellMarkup(ws.getRow(rFml2).getCell(3), 'C_{1} = 1 + 1.2(m-1)', {}, { horizontal: 'left', vertical: 'middle' });
  setPlainCell(ws.getRow(rFml2).getCell(8), 'Công thức (2) — Điều 7.7', {}, { horizontal: 'left', vertical: 'middle' });

  cursor.prose(3, 'm: Số trục xe của 1 cụm trục');
  cursor.prose(3, 'n_{i}: Số lần tác dụng của loại tải trọng trục cần được quy đổi', { height: 18.75 });

  cursor.tableCaption('Bảng 2: Bảng tính số trục xe quy đổi về trục xe tính toán');

  const rB2H = cursor.next(30.0);
  const b2HdrRow = ws.getRow(rB2H);
  setPlainCell(b2HdrRow.getCell(1), 'STT', {}, b1Align);
  setPlainCell(b2HdrRow.getCell(2), 'Loại xe', {}, b1Align);
  setCellMarkup(b2HdrRow.getCell(6), 'P_{i} (kN)', {}, b1Align);
  setCellMarkup(b2HdrRow.getCell(7), 'P_{tt} (kN)', {}, b1Align);
  setCellMarkup(b2HdrRow.getCell(8), 'C_{1}', {}, b1Align);
  setCellMarkup(b2HdrRow.getCell(9), 'C_{2}', {}, b1Align);
  setCellMarkup(b2HdrRow.getCell(10), 'n_{i} (xe/ng.đêm)', {}, b1Align);
  setCellMarkup(b2HdrRow.getCell(11), 'N_{i} (trục/ng.đêm)', {}, b1Align);
  applyRowGridBorders(ws, rB2H, { top: 'medium', bottom: 'medium', mergedSpans: [[2, 5]] });
  ws.mergeCells(rB2H, 2, rB2H, 5);

  const b2FirstRow = rB2H + 1;
  const centerWrap: Partial<ExcelJS.Alignment> = {
    horizontal: 'center',
    vertical: 'middle',
    wrapText: true,
  };
  const leftWrap: Partial<ExcelJS.Alignment> = {
    horizontal: 'left',
    vertical: 'middle',
    wrapText: true,
  };

  traffic.conversions.forEach((conv, idx) => {
    const r1 = b1Rows[idx];
    const v = project.vehicles[idx];
    const rF = cursor.next(15.75);
    const rR = cursor.next(15.75);
    const rowF = ws.getRow(rF);
    const rowR = ws.getRow(rR);
    const isFirstVeh = idx === 0;

    setPlainCell(rowF.getCell(1), idx + 1, {}, centerWrap, '0');
    setPlainCell(rowF.getCell(2), conv.tenXe, {}, leftWrap);
    setPlainCell(rowF.getCell(5), 'Trục trước', {}, leftWrap);
    setPlainCell(rowR.getCell(5), 'Trục sau', {}, leftWrap);

    // Front axle formulas
    setFormulaCell(
      rowF.getCell(6),
      `F${r1}`,
      v && v.tlTrucTruoc_kN > 0 ? Number(v.tlTrucTruoc_kN.toFixed(2)) : '-',
      {},
      centerWrap,
      v && v.tlTrucTruoc_kN > 0 ? 'General' : undefined
    );
    setFormulaCell(rowF.getCell(7), `$G$${rPtt}`, forecast.tlTrucQuyDoi_kN, {}, centerWrap, '0');
    setPlainCell(rowF.getCell(8), 1, {}, centerWrap, 'General');
    setFormulaCell(
      rowF.getCell(9),
      `IF(ISNUMBER(F${rF}),6.4,0)`,
      v && v.tlTrucTruoc_kN > 0 ? 6.4 : 0,
      {},
      centerWrap,
      'General'
    );
    setFormulaCell(rowF.getCell(10), `K${r1}`, conv.luuLuong_xeNgDem, {}, centerWrap, '#,##0');
    setFormulaCell(
      rowF.getCell(11),
      `IF(OR(NOT(ISNUMBER(F${rF})),F${rF}<25),0,ROUND(H${rF}*I${rF}*J${rF}*(F${rF}/G${rF})^4.4,3))`,
      Number(conv.Ni_truoc.toFixed(3)),
      {},
      centerWrap,
      conv.Ni_truoc === 0 ? '0' : '0.000'
    );

    // Rear axle formulas
    setFormulaCell(
      rowR.getCell(6),
      `G${r1}`,
      v && v.tlTrucSau_kN > 0 ? Number(v.tlTrucSau_kN.toFixed(2)) : '-',
      {},
      centerWrap,
      v && v.tlTrucSau_kN > 0 ? 'General' : undefined
    );
    setFormulaCell(rowR.getCell(7), `$G$${rPtt}`, forecast.tlTrucQuyDoi_kN, {}, centerWrap, '0');
    setFormulaCell(
      rowR.getCell(8),
      `IF(NOT(ISNUMBER(H${r1})),0,IF(H${r1}<=1,1,IF(AND(ISNUMBER(J${r1}),J${r1}>=3),H${r1},1+1.2*(H${r1}-1))))`,
      v && v.soTrucSau > 0 ? Number(conv.C1_sau.toFixed(2)) : 0,
      {},
      centerWrap,
      'General'
    );
    setFormulaCell(
      rowR.getCell(9),
      `IF(I${r1}="Cụm bánh đơn",6.4,IF(I${r1}="Cụm bánh đôi",1,IF(I${r1}="Cụm bánh bốn",0.38,0)))`,
      v && v.soTrucSau > 0 ? Number(conv.C2_sau.toFixed(2)) : 0,
      {},
      centerWrap,
      'General'
    );
    setFormulaCell(rowR.getCell(10), `K${r1}`, conv.luuLuong_xeNgDem, {}, centerWrap, '#,##0');
    setFormulaCell(
      rowR.getCell(11),
      `IF(OR(NOT(ISNUMBER(F${rR})),F${rR}<25),0,ROUND(H${rR}*I${rR}*J${rR}*(F${rR}/G${rR})^4.4,0))`,
      Number(conv.Ni_sau.toFixed(0)),
      {},
      centerWrap,
      '0'
    );

    applyRowGridBorders(ws, rF, {
      top: isFirstVeh ? 'medium' : 'hair',
      bottom: 'hair',
      mergedSpans: [[2, 4]],
    });
    applyRowGridBorders(ws, rR, {
      top: 'hair',
      bottom: 'hair',
      mergedSpans: [[2, 4]],
    });
    for (const c of [1, 2, 3, 4]) {
      rowF.getCell(c).border = { ...rowF.getCell(c).border, bottom: undefined };
      rowR.getCell(c).border = { ...rowR.getCell(c).border, top: undefined };
    }
    ws.mergeCells(rF, 1, rR, 1);
    ws.mergeCells(rF, 2, rR, 4);
  });

  const b2LastDataRow = b2FirstRow + traffic.conversions.length * 2 - 1;
  const rTot = cursor.next(18.75);
  const totRow = ws.getRow(rTot);
  setCellMarkup(
    totRow.getCell(1),
    'Tổng số trục xe sau khi quy đổi N_{tk} (trục/ngày.đêm)',
    { bold: true },
    centerWrap
  );
  const sumNi = traffic.conversions.reduce((acc, c) => acc + c.Ni_truoc + c.Ni_sau, 0);
  const matchesVehicleSum = Math.abs(sumNi - traffic.Ntk_trucNgDem) <= 0.5;
  // N_tk làm tròn LÊN thành số nguyên (trừ khi nhập trực tiếp lưu lượng năm tính toán)
  const ntkRaw = Number(traffic.Ntk_trucNgDem.toFixed(3));
  const ntkShown = forecast.khongCoSoLieuDieuTra ? ntkRaw : Math.ceil(ntkRaw);
  const ntkFmt = Number.isInteger(ntkShown) ? '#,##0' : '#,##0.000';
  if (
    traffic.conversions.length > 0 &&
    !forecast.khongCoSoLieuDieuTra &&
    (project.storedNtk === undefined || matchesVehicleSum)
  ) {
    setFormulaCell(
      totRow.getCell(11),
      `ROUNDUP(ROUND(SUM(K${b2FirstRow}:K${b2LastDataRow}),3),0)`,
      ntkShown,
      { bold: true },
      centerWrap,
      ntkFmt
    );
  } else {
    setPlainCell(
      totRow.getCell(11),
      ntkShown,
      { bold: true },
      centerWrap,
      ntkFmt
    );
  }
  applyRowGridBorders(ws, rTot, { top: 'medium', bottom: 'medium', mergedSpans: [[1, 10]] });
  ws.mergeCells(rTot, 1, rTot, 10);

  cursor.blank(12.75);

  // I.3 Số trục xe tính toán Ntt
  cursor.sectionHeading('I.3. Số trục xe tính toán N_{tt}:', 18.75);
  const rNttEq = cursor.next(18.75);
  setCellMarkup(
    ws.getRow(rNttEq).getCell(2),
    forecast.khongCoSoLieuDieuTra
      ? 'Không có số liệu điều tra xe — nhập trực tiếp lưu lượng năm tính toán:'
      : 'N_{tt} = N_{tk} * f_{L}',
    {},
    { horizontal: 'left', vertical: 'middle' }
  );
  if (!forecast.khongCoSoLieuDieuTra) {
    setPlainCell(
      ws.getRow(rNttEq).getCell(8),
      'Công thức (3) — Điều 7.8',
      {},
      { horizontal: 'left', vertical: 'middle' }
    );
  }

  const rNtkLine = cursor.next(15.75);
  setCellMarkup(ws.getRow(rNtkLine).getCell(2), 'N_{tk} =', {}, { horizontal: 'right', vertical: 'middle' });
  setFormulaCell(
    ws.getRow(rNtkLine).getCell(3),
    `K${rTot}`,
    ntkShown,
    {},
    { horizontal: 'center', vertical: 'middle' },
    ntkFmt
  );
  setPlainCell(ws.getRow(rNtkLine).getCell(4), '(trục/ng.đêm)', {}, { horizontal: 'left', vertical: 'middle' });

  const nttDirectFmt = Number.isInteger(Number(traffic.Ntt_trucLanNgDem.toFixed(2)))
    ? '#,##0'
    : '#,##0.00';
  // N_tt làm tròn thống nhất thành số nguyên (từ N_tk đã làm tròn lên × f_L)
  const nttRounded = forecast.khongCoSoLieuDieuTra
    ? Number(traffic.Ntt_trucLanNgDem.toFixed(2))
    : Math.round(ntkShown * Number(roadScale.heSoLan_fL.toFixed(5)));
  const rNtt = cursor.next(18.75);
  setCellMarkup(ws.getRow(rNtt).getCell(2), 'N_{tt} =', {}, { horizontal: 'right', vertical: 'middle' });
  if (forecast.khongCoSoLieuDieuTra) {
    setPlainCell(
      ws.getRow(rNtt).getCell(3),
      Number(traffic.Ntt_trucLanNgDem.toFixed(2)),
      { bold: true },
      { horizontal: 'center', vertical: 'middle' },
      nttDirectFmt
    );
  } else {
    setFormulaCell(
      ws.getRow(rNtt).getCell(3),
      `ROUND(K${rTot}*G${rFl},0)`,
      nttRounded,
      { bold: true },
      { horizontal: 'center', vertical: 'middle' },
      '#,##0'
    );
  }
  setPlainCell(ws.getRow(rNtt).getCell(4), '(trục/làn.ngày đêm)', {}, { horizontal: 'left', vertical: 'middle' });

  cursor.blank(12.75);

  // =========================================================================
  // SECTION II: TÍNH KẾT CẤU ÁO ĐƯỜNG
  // =========================================================================
  cursor.sectionHeading(
    isCaiTao ? 'II. TÍNH KẾT CẤU TĂNG CƯỜNG, CẢI TẠO ÁO ĐƯỜNG CŨ:' : 'II. TÍNH KẾT CẤU ÁO ĐƯỜNG:'
  );
  cursor.sectionHeading('II.1. Số liệu chung:');

  if (isCaiTao) {
    const rKind = cursor.next(15.75);
    setPlainCell(ws.getRow(rKind).getCell(2), '- Loại thiết kế:', {}, { horizontal: 'left', vertical: 'middle' });
    setPlainCell(
      ws.getRow(rKind).getCell(6),
      'Cải tạo, nâng cấp (tăng cường áo đường cũ)',
      {},
      { horizontal: 'left', vertical: 'middle' }
    );

    const rStrat = cursor.next(15.75);
    setPlainCell(ws.getRow(rStrat).getCell(2), '- Giải pháp cải tạo:', {}, { horizontal: 'left', vertical: 'middle' });
    setPlainCell(
      ws.getRow(rStrat).getCell(6),
      rehabStrategyLabel(effectiveStrategy),
      {},
      { horizontal: 'left', vertical: 'middle' }
    );
  }

  const rObj2 = cursor.next(15.75);
  setPlainCell(ws.getRow(rObj2).getCell(2), '- Đối tượng tính toán:', {}, { horizontal: 'left', vertical: 'middle' });
  setFormulaCell(
    ws.getRow(rObj2).getCell(6),
    `G${rObj}`,
    objLabel,
    {},
    { horizontal: 'left', vertical: 'middle' }
  );

  const roadTypeStr = roadScale.loaiDuong === 'DUONG_DO_THI' ? 'Đường đô thị' : 'Đường ô tô';
  const gradeStr = surfaceGradeLabel(designParams.loaiTangMat);

  const rRoadType = cursor.next(15.75);
  setPlainCell(ws.getRow(rRoadType).getCell(2), '- Loại đường:', {}, { horizontal: 'left', vertical: 'middle' });
  setPlainCell(ws.getRow(rRoadType).getCell(6), roadTypeStr, {}, { horizontal: 'left', vertical: 'middle' });

  const rRoadClass = cursor.next(15.75);
  setPlainCell(ws.getRow(rRoadClass).getCell(2), '- Cấp đường:', {}, { horizontal: 'left', vertical: 'middle' });
  setPlainCell(ws.getRow(rRoadClass).getCell(6), roadScale.capDuong, {}, { horizontal: 'left', vertical: 'middle' });

  const rSurfGrade = cursor.next(15.75);
  setPlainCell(
    ws.getRow(rSurfGrade).getCell(2),
    isCaiTao ? '- Loại tầng mặt sau tăng cường/cải tạo:' : '- Loại tầng mặt thiết kế:',
    {},
    { horizontal: 'left', vertical: 'middle' }
  );
  setPlainCell(ws.getRow(rSurfGrade).getCell(6), gradeStr, {}, { horizontal: 'left', vertical: 'middle' });

  const rRel = cursor.next(15.75);
  setPlainCell(ws.getRow(rRel).getCell(2), '- Độ tin cậy thiết kế:', {}, { horizontal: 'left', vertical: 'middle' });
  setPlainCell(
    ws.getRow(rRel).getCell(6),
    Number(roadScale.doTinCayTK.toFixed(2)),
    {},
    { horizontal: 'left', vertical: 'middle' },
    '0.00'
  );

  const rYears = cursor.next(15.75);
  setPlainCell(ws.getRow(rYears).getCell(2), '- Thời hạn thiết kế t (năm):', {}, { horizontal: 'left', vertical: 'middle' });
  setPlainCell(
    ws.getRow(rYears).getCell(6),
    forecast.thoiHanTK_nam,
    {},
    { horizontal: 'left', vertical: 'middle' },
    '0'
  );

  const rNtt2 = cursor.next(18.75);
  setCellMarkup(
    ws.getRow(rNtt2).getCell(2),
    '- Số trục xe tính toán N_{tt} (trục/làn.ngày đêm):',
    {},
    { horizontal: 'left', vertical: 'middle' }
  );
  setFormulaCell(
    ws.getRow(rNtt2).getCell(6),
    `C${rNtt}`,
    nttRounded,
    {},
    { horizontal: 'left', vertical: 'middle' },
    forecast.khongCoSoLieuDieuTra ? nttDirectFmt : '#,##0'
  );

  const rQ = cursor.next(15.75);
  setPlainCell(
    ws.getRow(rQ).getCell(2),
    '- Tỷ lệ tăng trưởng trung bình năm q (%):',
    {},
    { horizontal: 'left', vertical: 'middle' }
  );
  setPlainCell(
    ws.getRow(rQ).getCell(6),
    Number((forecast.quyLuatTangTruong_q * 100).toFixed(2)),
    {},
    { horizontal: 'left', vertical: 'middle' },
    'General'
  );

  // II.2 Nền đường (mở rộng Chương 10 nếu CAI_TAO)
  let rEchCu: number | null = null;
  if (isCaiTao) {
    cursor.sectionHeading('II.2. Hiện trạng kết cấu cũ & Nền đường:');
    if (rehabilitation) {
      const { assessment } = rehabilitation;
      const segText = `${assessment.segmentName || '—'} (chiều dài ${fmt(assessment.segmentLength_m, 0)} m${assessment.segmentLength_m > 1000 ? ' — vượt 1000 m theo §10.3.1.2' : ''})`;
      const rSeg = cursor.next(calcWrapHeight(segText, 64, 15.75));
      setPlainCell(ws.getRow(rSeg).getCell(2), '- Phân đoạn điều tra (§10.3.1):', {}, { horizontal: 'left', vertical: 'middle' });
      setPlainCell(
        ws.getRow(rSeg).getCell(6),
        segText,
        {},
        { horizontal: 'left', vertical: 'middle', wrapText: true }
      );
      ws.mergeCells(rSeg, 6, rSeg, 11);

      const b13Text = `Mặt cũ ${surfaceGradeLabel(assessment.oldSurfaceGrade)}, Nứt: ${distressSeverityLabel(assessment.crackingLevel)}${assessment.pci !== null && assessment.pci !== undefined ? `, PCI = ${fmt(assessment.pci, 1)}` : ''}${assessment.ruttingDepth_mm !== undefined ? `, Vệt hằn bánh = ${fmt(assessment.ruttingDepth_mm, 1)} mm` : ''}${assessment.localizedSink_mm !== undefined ? `, Lún cục bộ = ${fmt(assessment.localizedSink_mm, 1)} mm` : ''}`;
      const rB13 = cursor.next(calcWrapHeight(b13Text, 64, 15.75));
      setPlainCell(
        ws.getRow(rB13).getCell(2),
        '- Kết cấu tầng mặt cũ & tình trạng Bảng 13:',
        {},
        { horizontal: 'left', vertical: 'middle' }
      );
      setPlainCell(
        ws.getRow(rB13).getCell(6),
        b13Text,
        {},
        { horizontal: 'left', vertical: 'middle', wrapText: true }
      );
      ws.mergeCells(rB13, 6, rB13, 11);

      if (assessment.hasReflectiveCrackRisk) {
        cursor.prose(
          2,
          '- Lưu ý nứt phản ánh (§10.2.3 & §5.2.5): Có lớp gia cố chất liên kết vô cơ cũ bên dưới.'
        );
      }
      if (assessment.hasWidening) {
        cursor.prose(
          2,
          '- Lưu ý mở rộng (§10.2.5): Có mở rộng mặt đường (tạo bậc cấp gối >= 0,3 m lên kết cấu cũ).'
        );
      }

      if (isRehabOverlay) {
        const effectiveMethod = rehabSummary?.echMethod ?? rehabilitation.echMethod;
        const echCuVal = altRes.deflection.foundationModulus_MPa ?? rehabSummary?.echCu_MPa ?? 0;

        const methText = echCuMethodLabel(effectiveMethod);
        const rMeth = cursor.next(calcWrapHeight(methText, 64, 15.75));
        setPlainCell(
          ws.getRow(rMeth).getCell(2),
          '- Phương pháp xác định Ech,cũ:',
          {},
          { horizontal: 'left', vertical: 'middle' }
        );
        setPlainCell(
          ws.getRow(rMeth).getCell(6),
          methText,
          {},
          { horizontal: 'left', vertical: 'middle', wrapText: true }
        );
        ws.mergeCells(rMeth, 6, rMeth, 11);

        if (effectiveMethod === 'BENKELMAN') {
          const bk = rehabilitation.benkelman;
          const stats = rehabSummary?.benkelmanStats;
          const ltb = stats?.l_tb_mm ?? bk.l_tb_mm;
          const sMm = stats?.S_mm ?? bk.S_mm;
          const zAlpha = stats?.Z_alpha ?? bk.Z_alpha;
          const ldc = stats?.l_dc_mm ?? ltb + zAlpha * sMm;
          const ltt = stats?.l_tt_mm ?? ldc * bk.K_t * bk.K_am;
          const echBk = stats?.echCu_MPa ?? echCuVal;

          const rBk1 = cursor.next(18.75);
          setPlainCell(ws.getRow(rBk1).getCell(2), '  + Thông số đo Benkelman (TCVN 8867):', {}, { horizontal: 'left', vertical: 'middle' });
          ws.mergeCells(rBk1, 2, rBk1, 5);
          setCellMarkup(ws.getRow(rBk1).getCell(6), 'p_{đo} =', {}, { horizontal: 'right', vertical: 'middle' });
          setPlainCell(ws.getRow(rBk1).getCell(7), bk.p_do_MPa, {}, { horizontal: 'center', vertical: 'middle' }, '0.00');
          setCellMarkup(ws.getRow(rBk1).getCell(8), 'D_{đo} =', {}, { horizontal: 'right', vertical: 'middle' });
          setPlainCell(ws.getRow(rBk1).getCell(9), bk.D_do_cm, {}, { horizontal: 'center', vertical: 'middle' }, '0.0');
          setPlainCell(ws.getRow(rBk1).getCell(10), 'μ =', {}, { horizontal: 'right', vertical: 'middle' });
          setPlainCell(ws.getRow(rBk1).getCell(11), bk.mu, {}, { horizontal: 'center', vertical: 'middle' }, '0.00');

          const rBk2 = cursor.next(18.75);
          setCellMarkup(ws.getRow(rBk2).getCell(3), 'l_{tb} =', {}, { horizontal: 'right', vertical: 'middle' });
          setPlainCell(ws.getRow(rBk2).getCell(4), ltb, {}, { horizontal: 'center', vertical: 'middle' }, '0.000');
          setPlainCell(ws.getRow(rBk2).getCell(5), 'S =', {}, { horizontal: 'right', vertical: 'middle' });
          setPlainCell(ws.getRow(rBk2).getCell(6), sMm, {}, { horizontal: 'center', vertical: 'middle' }, '0.000');
          setCellMarkup(ws.getRow(rBk2).getCell(7), 'Z_{α} =', {}, { horizontal: 'right', vertical: 'middle' });
          setPlainCell(ws.getRow(rBk2).getCell(8), zAlpha, {}, { horizontal: 'center', vertical: 'middle' }, '0.000');
          setCellMarkup(ws.getRow(rBk2).getCell(9), 'K_{t} =', {}, { horizontal: 'right', vertical: 'middle' });
          setPlainCell(ws.getRow(rBk2).getCell(10), bk.K_t, {}, { horizontal: 'center', vertical: 'middle' }, '0.00');

          const rBk3 = cursor.next(18.75);
          setCellMarkup(ws.getRow(rBk3).getCell(3), 'K_{ẩm} =', {}, { horizontal: 'right', vertical: 'middle' });
          setPlainCell(ws.getRow(rBk3).getCell(4), bk.K_am, {}, { horizontal: 'center', vertical: 'middle' }, '0.00');
          setCellMarkup(ws.getRow(rBk3).getCell(5), 'l_{đc} =', {}, { horizontal: 'right', vertical: 'middle' });
          setFormulaCell(
            ws.getRow(rBk3).getCell(6),
            `D${rBk2}+H${rBk2}*F${rBk2}`,
            ldc,
            {},
            { horizontal: 'center', vertical: 'middle' },
            '0.000'
          );
          setCellMarkup(ws.getRow(rBk3).getCell(7), 'l_{tt} =', {}, { horizontal: 'right', vertical: 'middle' });
          setFormulaCell(
            ws.getRow(rBk3).getCell(8),
            `F${rBk3}*J${rBk2}*D${rBk3}`,
            ltt,
            {},
            { horizontal: 'center', vertical: 'middle' },
            '0.000'
          );

          rEchCu = cursor.next(30.0);
          setPlainCell(
            ws.getRow(rEchCu).getCell(2),
            '- Mô đun đàn hồi chung áo đường cũ Ech,cũ (MPa):',
            {},
            { horizontal: 'left', vertical: 'middle', wrapText: true }
          );
          ws.mergeCells(rEchCu, 2, rEchCu, 5);
          setFormulaCell(
            ws.getRow(rEchCu).getCell(6),
            `ROUND(10*G${rBk1}*I${rBk1}*(1-K${rBk1}^2)/H${rBk3},2)`,
            Number(echBk.toFixed(2)),
            { bold: true },
            { horizontal: 'left', vertical: 'middle' },
            '0.00'
          );
          setPlainCell(ws.getRow(rEchCu).getCell(7), '(MPa)', {}, { horizontal: 'left', vertical: 'middle' });
        } else if (effectiveMethod === 'DIRECT_FWD') {
          const rFwd = cursor.next(18.75);
          setPlainCell(ws.getRow(rFwd).getCell(2), '  + Giá trị nhập trực tiếp:', {}, { horizontal: 'left', vertical: 'middle' });
          setCellMarkup(ws.getRow(rFwd).getCell(5), 'E_{ch,cũ} =', {}, { horizontal: 'right', vertical: 'middle' });
          setPlainCell(
            ws.getRow(rFwd).getCell(6),
            rehabilitation.directEchCu_MPa,
            {},
            { horizontal: 'center', vertical: 'middle' },
            '0.00'
          );
          setCellMarkup(ws.getRow(rFwd).getCell(7), 'K_{đc} =', {}, { horizontal: 'right', vertical: 'middle' });
          setPlainCell(
            ws.getRow(rFwd).getCell(8),
            rehabilitation.directKdc,
            {},
            { horizontal: 'center', vertical: 'middle' },
            '0.000'
          );

          rEchCu = cursor.next(30.0);
          setPlainCell(
            ws.getRow(rEchCu).getCell(2),
            '- Mô đun đàn hồi chung áo đường cũ Ech,cũ (MPa):',
            {},
            { horizontal: 'left', vertical: 'middle', wrapText: true }
          );
          ws.mergeCells(rEchCu, 2, rEchCu, 5);
          setFormulaCell(
            ws.getRow(rEchCu).getCell(6),
            `ROUND(F${rFwd}*H${rFwd},2)`,
            Number(echCuVal.toFixed(2)),
            { bold: true },
            { horizontal: 'left', vertical: 'middle' },
            '0.00'
          );
          setPlainCell(ws.getRow(rEchCu).getCell(7), '(MPa)', {}, { horizontal: 'left', vertical: 'middle' });
        } else {
          const red = rehabSummary?.existingReduction;
          cursor.prose(
            2,
            `  + Quy đổi ${rehabilitation.existingLayers.length} lớp kết cấu cũ giữ lại trên nền E0 = ${fmt(subgradeResolved.E0_MPa, 2)} MPa${red ? ` (H_cũ = ${fmt(red.H_total_cm, 2)} cm, Etb^đc = ${fmt(red.Etb_dc_MPa, 2)} MPa)` : ''} ⇒ Ech,cũ = ${fmt(echCuVal, 2)} MPa`
          );
          rEchCu = cursor.next(30.0);
          setPlainCell(
            ws.getRow(rEchCu).getCell(2),
            '- Mô đun đàn hồi chung áo đường cũ Ech,cũ (MPa):',
            {},
            { horizontal: 'left', vertical: 'middle', wrapText: true }
          );
          ws.mergeCells(rEchCu, 2, rEchCu, 5);
          setPlainCell(
            ws.getRow(rEchCu).getCell(6),
            Number(echCuVal.toFixed(2)),
            { bold: true },
            { horizontal: 'left', vertical: 'middle' },
            '0.00'
          );
          setPlainCell(ws.getRow(rEchCu).getCell(7), '(MPa)', {}, { horizontal: 'left', vertical: 'middle' });
        }

        if (
          rehabilitation.totalExistingThickness_cm !== undefined &&
          rehabilitation.totalExistingThickness_cm > 0
        ) {
          const rHcu = cursor.next(30.0);
          setPlainCell(
            ws.getRow(rHcu).getCell(2),
            '- Tổng chiều dày kết cấu cũ giữ lại H_cũ (cm):',
            {},
            { horizontal: 'left', vertical: 'middle', wrapText: true }
          );
          ws.mergeCells(rHcu, 2, rHcu, 5);
          setPlainCell(
            ws.getRow(rHcu).getCell(6),
            Number(rehabilitation.totalExistingThickness_cm.toFixed(2)),
            {},
            { horizontal: 'left', vertical: 'middle' },
            'General'
          );
          setPlainCell(ws.getRow(rHcu).getCell(7), '(cm)', {}, { horizontal: 'left', vertical: 'middle' });
        }
      }
    }
  } else {
    cursor.sectionHeading('II.2. Nền đường:');
  }

  const soilDesc = subgrade.xacDinhTheoDoAm
    ? `${subgrade.loaiDat} (a = ${fmt(subgrade.doAmTuongDoi_a, 2)}, K = ${fmt(subgrade.doChatYeuCau_K, 2)}${subgrade.damNenCaiTien ? ', đầm nén cải tiến +20% E0 theo Bảng B.4' : ''})`
    : subgrade.loaiDat;
  const rSoil = cursor.next(calcWrapHeight(soilDesc, 64, 15.75));
  setPlainCell(
    ws.getRow(rSoil).getCell(2),
    isCaiTao ? '- Đất nền đường cũ (§9.2.5.5, §10.3.3):' : '- Đất đắp nền đường:',
    {},
    { horizontal: 'left', vertical: 'middle' }
  );
  setPlainCell(
    ws.getRow(rSoil).getCell(6),
    soilDesc,
    {},
    { horizontal: 'left', vertical: 'middle', wrapText: true }
  );
  ws.mergeCells(rSoil, 6, rSoil, 11);

  const rE0 = cursor.next(18.75);
  setCellMarkup(
    ws.getRow(rE0).getCell(2),
    isCaiTao ? '- Mô đun đàn hồi nền cũ E_{o} (MPa):' : '- Mô đun đàn hồi E_{o} (MPa):',
    {},
    { horizontal: 'left', vertical: 'middle' }
  );
  setPlainCell(
    ws.getRow(rE0).getCell(6),
    Number(subgradeResolved.E0_MPa.toFixed(2)),
    {},
    { horizontal: 'left', vertical: 'middle' },
    'General'
  );

  const rC = cursor.next(15.75);
  setPlainCell(ws.getRow(rC).getCell(2), '- Lực dính C (MPa):', {}, { horizontal: 'left', vertical: 'middle' });
  setPlainCell(
    ws.getRow(rC).getCell(6),
    Number(subgradeResolved.C_MPa.toFixed(4)),
    {},
    { horizontal: 'left', vertical: 'middle' },
    '0.0000'
  );

  const rPhi = cursor.next(15.75);
  setPlainCell(ws.getRow(rPhi).getCell(2), '- Góc ma sát φ (độ):', {}, { horizontal: 'left', vertical: 'middle' });
  setPlainCell(
    ws.getRow(rPhi).getCell(6),
    Number(subgradeResolved.phi_deg.toFixed(2)),
    {},
    { horizontal: 'left', vertical: 'middle' },
    'General'
  );

  // II.3 Tải trọng
  cursor.sectionHeading('II.3 Tải trọng:');
  const rLoadType = cursor.next(15.75);
  setPlainCell(ws.getRow(rLoadType).getCell(2), '- Tải trọng tác dụng:', {}, { horizontal: 'left', vertical: 'middle' });
  setPlainCell(
    ws.getRow(rLoadType).getCell(6),
    forecast.taiTrongTrucTacDung === 'BANH_DON'
      ? 'Cụm bánh đơn (tải trọng trục đặc biệt)'
      : 'Cụm bánh đôi (tải trọng trục tiêu chuẩn)',
    {},
    { horizontal: 'left', vertical: 'middle' }
  );

  const rP = cursor.next(15.75);
  setPlainCell(
    ws.getRow(rP).getCell(2),
    '- Tải trọng trục tính toán tiêu chuẩn P (kN):',
    {},
    { horizontal: 'left', vertical: 'middle' }
  );
  setFormulaCell(
    ws.getRow(rP).getCell(6),
    `G${rPtt}`,
    forecast.tlTrucQuyDoi_kN,
    {},
    { horizontal: 'left', vertical: 'middle' },
    '0'
  );

  const rPressure = cursor.next(15.75);
  setPlainCell(
    ws.getRow(rPressure).getCell(2),
    '- Áp lực tính toán lên mặt đường p (MPa):',
    {},
    { horizontal: 'left', vertical: 'middle' }
  );
  setPlainCell(
    ws.getRow(rPressure).getCell(6),
    Number(forecast.apLucBanh_p_MPa.toFixed(2)),
    {},
    { horizontal: 'left', vertical: 'middle' },
    '0.00'
  );

  const rD = cursor.next(15.75);
  setPlainCell(
    ws.getRow(rD).getCell(2),
    '- Đường kính vệt bánh xe D (cm):',
    {},
    { horizontal: 'left', vertical: 'middle' }
  );
  setPlainCell(
    ws.getRow(rD).getCell(6),
    Number(forecast.duongKinhVetBanh_D_cm.toFixed(2)),
    {},
    { horizontal: 'left', vertical: 'middle' },
    'General'
  );

  // II.4 Xác định mô đun đàn hồi yêu cầu Eyc
  cursor.sectionHeading('II.4. Xác định mô đun đàn hồi yêu cầu E_{yc}:', 18.75);
  cursor.prose(
    2,
    `- Tra Bảng 9 với P_{tt} = ${forecast.tlTrucQuyDoi_kN} kN (Bảng 6), mặt đường ${gradeStr}, số trục xe tính toán N_{tt} = ${forecast.khongCoSoLieuDieuTra ? fmt(nttRounded, 2) : nttRounded}, ta được:`,
    { height: 18.75 }
  );

  const rEyc = cursor.next(18.75);
  setCellMarkup(ws.getRow(rEyc).getCell(4), 'E_{yc} =', {}, { horizontal: 'right', vertical: 'middle' });
  setPlainCell(
    ws.getRow(rEyc).getCell(5),
    Number(modulusResolved.Eyc_MPa.toFixed(3)),
    { bold: true },
    { horizontal: 'center', vertical: 'middle' },
    '0.00'
  );
  setPlainCell(ws.getRow(rEyc).getCell(6), '(MPa)', {}, { horizontal: 'left', vertical: 'middle' });

  cursor.prose(
    2,
    `- Tra Bảng 10 với loại đường: ${roadTypeStr}, cấp đường: ${roadScale.capDuong}, mặt đường: ${gradeStr}`
  );
  cursor.prose(2, 'ta được mô đun đàn hồi tối thiểu:');

  const rEmin = cursor.next(18.75);
  setCellMarkup(ws.getRow(rEmin).getCell(4), 'E_{yc min} =', {}, { horizontal: 'left', vertical: 'middle' });
  setPlainCell(
    ws.getRow(rEmin).getCell(5),
    Number(modulusResolved.Emin_MPa.toFixed(3)),
    { bold: true },
    { horizontal: 'center', vertical: 'middle' },
    '0.00'
  );
  setPlainCell(ws.getRow(rEmin).getCell(6), '(MPa)', {}, { horizontal: 'left', vertical: 'middle' });

  cursor.prose(2, '- Mô đun đàn hồi yêu cầu dùng để tính toán:');

  const rEycTt = cursor.next(18.75);
  setCellMarkup(
    ws.getRow(rEycTt).getCell(4),
    'E_{yc}^{tt} = max(E_{yc}, E_{yc min}) =',
    {},
    { horizontal: 'right', vertical: 'middle' }
  );
  setFormulaCell(
    ws.getRow(rEycTt).getCell(5),
    `MAX(E${rEyc},E${rEmin})`,
    Number(modulusResolved.Ett_MPa.toFixed(3)),
    { bold: true },
    { horizontal: 'center', vertical: 'middle' },
    '0.00'
  );
  setPlainCell(ws.getRow(rEycTt).getCell(6), '(MPa)', {}, { horizontal: 'left', vertical: 'middle' });

  // II.5 Kết cấu áo đường & Bảng 3
  cursor.sectionHeading(isRehabOverlay ? 'II.5. Kết cấu áo đường tăng cường:' : 'II.5. Kết cấu áo đường:');
  const rCount = cursor.next(15.75);
  setPlainCell(
    ws.getRow(rCount).getCell(2),
    isRehabOverlay ? 'Tổng số lớp áo đường tăng cường:' : 'Tổng số lớp áo đường:',
    {},
    { horizontal: 'left', vertical: 'middle' }
  );
  ws.mergeCells(rCount, 2, rCount, 5);

  cursor.tableCaption('Bảng 3: Bảng các lớp kết cấu áo đường');
  const rB3H = cursor.next(30.0);
  const b3Hdr = ws.getRow(rB3H);
  setPlainCell(b3Hdr.getCell(1), 'STT', {}, b1Align);
  setPlainCell(b3Hdr.getCell(2), 'Lớp vật liệu (từ trên xuống)', {}, b1Align);
  setPlainCell(b3Hdr.getCell(5), 'H (cm)', {}, b1Align);
  setCellMarkup(b3Hdr.getCell(6), 'E_{v} (MPa)', {}, b1Align);
  setCellMarkup(b3Hdr.getCell(7), 'E_{tr} (MPa)', {}, b1Align);
  setCellMarkup(b3Hdr.getCell(8), 'E_{ku} (MPa)', {}, b1Align);
  setCellMarkup(b3Hdr.getCell(9), 'R_{ku} (MPa)', {}, b1Align);
  setPlainCell(b3Hdr.getCell(10), 'C (MPa)', {}, b1Align);
  setPlainCell(b3Hdr.getCell(11), 'φ (độ)', {}, b1Align);
  applyRowGridBorders(ws, rB3H, { top: 'medium', bottom: 'medium', mergedSpans: [[2, 4]] });
  ws.mergeCells(rB3H, 2, rB3H, 4);

  const b3RowById = new Map<string, number>();
  const b3Start = rB3H + 1;
  alt.layers.forEach((l, idx) => {
    const displayName = l.isBuVenh
      ? `${l.tenVatLieu} (Lớp bù vênh — không tính cường độ (§10.2.1.2))`
      : l.tenVatLieu;
    const r = cursor.next(calcWrapHeight(displayName, 26, 16.5));
    b3RowById.set(l.id, r);
    const row = ws.getRow(r);
    const isFirst = idx === 0;
    const isLast = idx === alt.layers.length - 1;

    setPlainCell(row.getCell(1), idx + 1, {}, { horizontal: 'center', vertical: 'middle' }, '0');
    setPlainCell(
      row.getCell(2),
      displayName,
      {},
      { horizontal: 'left', vertical: 'middle', wrapText: true }
    );
    setPlainCell(row.getCell(5), Number(l.chieuDay_cm.toFixed(2)), {}, { horizontal: 'center', vertical: 'middle' }, 'General');
    setPlainCell(row.getCell(6), Number(l.E_vong_30C.toFixed(2)), {}, { horizontal: 'center', vertical: 'middle' }, 'General');
    setPlainCell(row.getCell(7), Number(l.E_truot_60C.toFixed(2)), {}, { horizontal: 'center', vertical: 'middle' }, 'General');
    setPlainCell(row.getCell(8), Number(l.E_keoUon_10_15C.toFixed(2)), {}, { horizontal: 'center', vertical: 'middle' }, 'General');
    setPlainCell(row.getCell(9), Number(l.Rku_MPa.toFixed(2)), {}, { horizontal: 'center', vertical: 'middle' }, '0.0');
    setPlainCell(row.getCell(10), Number(l.C_MPa.toFixed(4)), {}, { horizontal: 'center', vertical: 'middle' }, 'General');
    setPlainCell(row.getCell(11), Number(l.phi_deg.toFixed(2)), {}, { horizontal: 'center', vertical: 'middle' }, 'General');
    applyRowGridBorders(ws, r, {
      top: isFirst ? 'medium' : 'hair',
      bottom: isLast ? 'medium' : 'hair',
      mergedSpans: [[2, 4]],
    });
    ws.mergeCells(r, 2, r, 4);
  });
  const b3End = rB3H + alt.layers.length;

  // Populate COUNTA for total layer count now that b3Start..b3End is known
  if (alt.layers.length > 0) {
    setFormulaCell(
      ws.getRow(rCount).getCell(6),
      `COUNTA(A${b3Start}:A${b3End})`,
      alt.layers.length,
      {},
      { horizontal: 'center', vertical: 'middle' },
      '0'
    );
  } else {
    setPlainCell(ws.getRow(rCount).getCell(6), 0, {}, { horizontal: 'center', vertical: 'middle' }, '0');
  }
  setPlainCell(ws.getRow(rCount).getCell(7), 'lớp', {}, { horizontal: 'left', vertical: 'middle' });

  const b3bRowById = new Map<string, { row: number; kHh: number }>();
  if (isCaiTao && rehabilitation && rehabilitation.existingLayers.length > 0) {
    cursor.blank(12.75);
    cursor.tableCaption('Bảng 3b: Các lớp kết cấu cũ giữ lại');
    const rB3bH = cursor.next(30.0);
    const b3bHdr = ws.getRow(rB3bH);
    setPlainCell(b3bHdr.getCell(1), 'STT', {}, b1Align);
    setPlainCell(b3bHdr.getCell(2), 'Lớp vật liệu cũ giữ lại', {}, b1Align);
    setPlainCell(b3bHdr.getCell(5), 'H (cm)', {}, b1Align);
    setCellMarkup(b3bHdr.getCell(6), 'E_{v} (MPa)', {}, b1Align);
    setCellMarkup(b3bHdr.getCell(7), 'E_{tr} (MPa)', {}, b1Align);
    setCellMarkup(b3bHdr.getCell(8), 'E_{ku} (MPa)', {}, b1Align);
    setCellMarkup(b3bHdr.getCell(9), 'K_{hh}', {}, b1Align);
    setPlainCell(b3bHdr.getCell(10), 'C (MPa)', {}, b1Align);
    setPlainCell(b3bHdr.getCell(11), 'φ (độ)', {}, b1Align);
    applyRowGridBorders(ws, rB3bH, { top: 'medium', bottom: 'medium', mergedSpans: [[2, 4]] });
    ws.mergeCells(rB3bH, 2, rB3bH, 4);

    rehabilitation.existingLayers.forEach((l, idx) => {
      const r = cursor.next(calcWrapHeight(l.tenVatLieu, 26, 16.5));
      b3bRowById.set(l.id, { row: r, kHh: l.K_hh });
      const row = ws.getRow(r);
      const isFirst = idx === 0;
      const isLast = idx === rehabilitation.existingLayers.length - 1;
      setPlainCell(row.getCell(1), idx + 1, {}, { horizontal: 'center', vertical: 'middle' }, '0');
      setPlainCell(row.getCell(2), l.tenVatLieu, {}, { horizontal: 'left', vertical: 'middle', wrapText: true });
      setPlainCell(row.getCell(5), Number(l.chieuDay_cm.toFixed(2)), {}, { horizontal: 'center', vertical: 'middle' }, 'General');
      setPlainCell(row.getCell(6), Number(l.E_vong_30C.toFixed(2)), {}, { horizontal: 'center', vertical: 'middle' }, 'General');
      setPlainCell(row.getCell(7), Number(l.E_truot_60C.toFixed(2)), {}, { horizontal: 'center', vertical: 'middle' }, 'General');
      setPlainCell(row.getCell(8), Number(l.E_keoUon_10_15C.toFixed(2)), {}, { horizontal: 'center', vertical: 'middle' }, 'General');
      setPlainCell(row.getCell(9), Number(l.K_hh.toFixed(2)), {}, { horizontal: 'center', vertical: 'middle' }, '0.00');
      setPlainCell(row.getCell(10), Number(l.C_MPa.toFixed(4)), {}, { horizontal: 'center', vertical: 'middle' }, 'General');
      setPlainCell(row.getCell(11), Number(l.phi_deg.toFixed(2)), {}, { horizontal: 'center', vertical: 'middle' }, 'General');
      applyRowGridBorders(ws, r, {
        top: isFirst ? 'medium' : 'hair',
        bottom: isLast ? 'medium' : 'hair',
        mergedSpans: [[2, 4]],
      });
      ws.mergeCells(r, 2, r, 4);
    });
  }

  cursor.blank(12.75);

  // =========================================================================
  // SECTION III: KIỂM TOÁN
  // =========================================================================
  cursor.sectionHeading('III. KIỂM TOÁN:');

  // III.1 Độ võng đàn hồi
  const def = altRes.deflection;
  const foundationE = def.foundationModulus_MPa ?? rehabSummary?.echCu_MPa ?? subgradeResolved.E0_MPa;
  const foundationRef = isRehabOverlay && rEchCu !== null ? `$F$${rEchCu}` : `$F$${rE0}`;
  const hasOverlayLayers = def.reduction.rows.length > 0 && def.reduction.H_total_cm > 0;

  cursor.sectionHeading(
    isRehabOverlay
      ? 'III.1. Kiểm tra tiêu chuẩn độ võng đàn hồi đối với kết cấu tăng cường (Điều 10.4.2):'
      : 'III.1. Kiểm tra tiêu chuẩn độ võng đàn hồi đối với kết cấu áo đường:'
  );

  if (isRehabOverlay) {
    cursor.prose(
      2,
      `Nền tương đương dưới lớp tăng cường (Điều 10.4.2): Eo' = Ech,cũ = ${fmt(foundationE, 2)} MPa (${echCuMethodLabel(rehabSummary?.echMethod)}).`
    );
    if (rehabSummary?.excludedBuVenhLayers && rehabSummary.excludedBuVenhLayers.length > 0) {
      cursor.prose(
        2,
        `Ghi chú lớp bù vênh (§10.2.1.2): ${rehabSummary.excludedBuVenhLayers
          .map((l) => `${l.layerName} (${fmt(l.chieuDay_cm, 1)} cm)`)
          .join(', ')} không được tính vào cường độ chung.`
      );
    }
  }

  let rDefEchm: number;
  if (isRehabOverlay && !hasOverlayLayers) {
    cursor.prose(
      2,
      `Không có lớp tăng cường chịu lực mới (chỉ bù vênh/bảo vệ), do đó Ech.m = Ech,cũ = ${fmt(def.Ech_MPa, 2)} MPa.`
    );
    rDefEchm = cursor.next(18.75);
    setCellMarkup(ws.getRow(rDefEchm).getCell(3), 'E_{ch.m}', {}, { horizontal: 'left', vertical: 'middle' });
    setCellMarkup(ws.getRow(rDefEchm).getCell(4), '= E_{ch,cũ} =', {}, { horizontal: 'left', vertical: 'middle' });
    if (rEchCu !== null) {
      setFormulaCell(
        ws.getRow(rDefEchm).getCell(6),
        `F${rEchCu}`,
        Number(def.Ech_MPa.toFixed(2)),
        { bold: true },
        { horizontal: 'left', vertical: 'middle' },
        '0.00'
      );
    } else {
      setPlainCell(
        ws.getRow(rDefEchm).getCell(6),
        Number(def.Ech_MPa.toFixed(2)),
        { bold: true },
        { horizontal: 'left', vertical: 'middle' },
        '0.00'
      );
    }
    setPlainCell(ws.getRow(rDefEchm).getCell(7), '(MPa)', {}, { horizontal: 'left', vertical: 'middle' });
  } else {
    cursor.subStepHeading('a.', 'Quy đổi về hệ 2 lớp:');
    cursor.prose(2, 'Việc quy đổi từng 2 lớp một từ dưới lên được thực hiện theo công thức sau:');
    const rEq5 = cursor.next(18.75);
    setCellMarkup(
      ws.getRow(rEq5).getCell(3),
      "E'_{tb} = E_{1}.[(1+k.t^{1/3})/(1+k)]^{3}",
      {},
      { horizontal: 'left', vertical: 'middle' }
    );
    setPlainCell(
      ws.getRow(rEq5).getCell(7),
      'Công thức (5) — Điều 9.2.4',
      {},
      { horizontal: 'left', vertical: 'middle' }
    );
    cursor.prose(3, 'Trong đó: k = h_{2}/h_{1}; t = E_{2}/E_{1}', { height: 18.75 });
    cursor.prose(4, 'h_{tb} = h_{1} + h_{2}', { height: 18.75 });
    cursor.prose(2, 'Kết quả tính đổi thể hiện ở bảng sau:');
    cursor.blank(12.75);

    const defActiveLayers = alt.layers.filter(
      (l) => (!isRehabOverlay || !l.isBuVenh) && l.chieuDay_cm > 0 && l.E_vong_30C > 0
    );
    const defSourceRefs: Array<SourceLayerRef | null> =
      defActiveLayers.length === def.reduction.rows.length
        ? defActiveLayers.map((l) => {
            const row = b3RowById.get(l.id);
            return row !== undefined ? { row, sheetTable: 'B3' } : null;
          })
        : def.reduction.rows.map(() => null);

    const { rTop, rBot } = writeReductionTable(
      ws,
      cursor,
      def.reduction,
      'E_{v} (MPa)',
      'F',
      defSourceRefs
    );

    cursor.subStepHeading('b.', 'Tính E_{tb}^{đc}:', 18.75);
    const { rHD, rEtbDc } = writeTwoLayerBetaBlock(
      ws,
      cursor,
      rTop,
      rBot,
      rD,
      def.reduction,
      { includeLayerSummary: true }
    );

    cursor.subStepHeading('c.', 'Tính E_{ch.m} của kết cấu:', 18.75);
    const eqRes = writeEquivEchBlock(
      ws,
      cursor,
      rEtbDc,
      rHD,
      foundationRef,
      foundationE,
      def.reduction.Etb_dc_MPa,
      def.H_over_D,
      def.Ech_over_E1,
      def.Ech_MPa,
      def.usedFormulaF1,
      isRehabOverlay,
      true
    );
    rDefEchm = eqRes.rEchm;

    if (def.e0RatioExtrapolated) {
      cursor.prose(
        2,
        `Lưu ý nội suy biên Hình 2: Tỷ số Eo'/E1 = ${fmt(def.E0_over_Etbdc, 4)} ∈ (0,90; 1,00] vượt cận trên 0,90 của Hình 2 (đã nội suy tuyến tính giữa 0,90 và 1,00).`,
        { italic: true }
      );
    }
  }

  cursor.subStepHeading('d.', 'Kiểm tra điều kiện về độ võng đàn hồi:');
  const rDefRel = cursor.next(15.75);
  setPlainCell(ws.getRow(rDefRel).getCell(2), 'Độ tin cậy thiết kế', {}, { horizontal: 'left', vertical: 'middle' });
  setFormulaCell(
    ws.getRow(rDefRel).getCell(4),
    `$F$${rRel}`,
    Number(roadScale.doTinCayTK.toFixed(2)),
    {},
    { horizontal: 'left', vertical: 'middle' },
    '"= "0.00'
  );
  cursor.prose(2, 'Tra Bảng 8 được hệ số cường độ về độ võng:');
  const rKcdDv = cursor.next(18.75);
  setCellMarkup(ws.getRow(rKcdDv).getCell(3), 'K_{cđ}^{đv}', {}, { horizontal: 'left', vertical: 'middle' });
  setFormulaCell(
    ws.getRow(rKcdDv).getCell(4),
    buildKcdDvFormula(`$F$${rRel}`),
    Number(def.Kcd_dv.toFixed(2)),
    {},
    { horizontal: 'left', vertical: 'middle' },
    '"= "0.00'
  );

  const rDefReq = cursor.next(18.75);
  setCellMarkup(ws.getRow(rDefReq).getCell(3), 'K_{cđ}^{đv} * E_{yc}', {}, { horizontal: 'left', vertical: 'middle' });
  setPlainCell(ws.getRow(rDefReq).getCell(4), '=', {}, { horizontal: 'left', vertical: 'middle' });
  setFormulaCell(
    ws.getRow(rDefReq).getCell(6),
    `D${rKcdDv}*E${rEycTt}`,
    Number(def.Eyc_required_MPa.toFixed(2)),
    {},
    { horizontal: 'left', vertical: 'middle' },
    '0.00'
  );
  setPlainCell(ws.getRow(rDefReq).getCell(7), '(MPa)', {}, { horizontal: 'left', vertical: 'middle' });

  const rDefCmp = cursor.next(18.75);
  const defCmpRow = ws.getRow(rDefCmp);
  setCellMarkup(defCmpRow.getCell(2), 'E_{ch.m} =', { bold: true }, { horizontal: 'left', vertical: 'middle' });
  setFormulaCell(
    defCmpRow.getCell(3),
    `F${rDefEchm}`,
    Number(def.Ech_MPa.toFixed(2)),
    { bold: true },
    { horizontal: 'center', vertical: 'middle' },
    '0.00'
  );
  setFormulaCell(
    defCmpRow.getCell(4),
    `IF(C${rDefCmp}>=F${rDefCmp},">=","<")`,
    def.passed ? '>=' : '<',
    { bold: true },
    { horizontal: 'center', vertical: 'middle' }
  );
  setCellMarkup(defCmpRow.getCell(5), 'K_{cđ}^{đv} * E_{yc} =', { bold: true }, { horizontal: 'left', vertical: 'middle' });
  setFormulaCell(
    defCmpRow.getCell(6),
    `F${rDefReq}`,
    Number(def.Eyc_required_MPa.toFixed(2)),
    { bold: true },
    { horizontal: 'center', vertical: 'middle' },
    '0.00'
  );
  setPlainCell(defCmpRow.getCell(7), '(MPa)', { bold: true }, { horizontal: 'left', vertical: 'middle' });
  setPlainCell(
    defCmpRow.getCell(8),
    'Công thức (4) — Điều 9.2.1',
    {},
    { horizontal: 'left', vertical: 'middle' }
  );

  cursor.blank(12.75);
  const rDefConc = cursor.next(15.75);
  const defPassMsg = isRehabOverlay
    ? 'Kết luận: Kết cấu tăng cường đảm bảo tiêu chuẩn về độ võng đàn hồi.'
    : 'Kết luận: Kết cấu đảm bảo tiêu chuẩn về độ võng đàn hồi.';
  const defFailMsg = isRehabOverlay
    ? 'Kết luận: Kết cấu tăng cường KHÔNG đảm bảo tiêu chuẩn về độ võng đàn hồi.'
    : 'Kết luận: Kết cấu KHÔNG đảm bảo tiêu chuẩn về độ võng đàn hồi.';
  setFormulaCell(
    ws.getRow(rDefConc).getCell(2),
    `IF(C${rDefCmp}>=F${rDefCmp},"${escFormulaStr(defPassMsg)}","${escFormulaStr(defFailMsg)}")`,
    def.passed ? defPassMsg : defFailMsg,
    { bold: true, italic: true, color: def.passed ? COLOR_PASS : COLOR_FAIL },
    { horizontal: 'left', vertical: 'middle' }
  );
  addConclusionColorRule(ws, rDefConc);

  cursor.blank(12.75);

  // =========================================================================
  // III.2 Kiểm tra tiêu chuẩn cắt trượt
  // =========================================================================
  const grade = designParams.loaiTangMat;
  const isLowGradeSurface = grade === 'B1' || grade === 'B2';
  cursor.sectionHeading(
    'III.2. Kiểm tra tiêu chuẩn cắt trượt trong nền đất và các lớp vật liệu kém dính kết:',
    18.75
  );

  if (isRehabOverlay) {
    if (rehabSummary?.shearOldStackUsed) {
      cursor.prose(
        2,
        'Phạm vi tính đổi cắt trượt Chương 10 (Điều 10.4.2 & 9.3): sử dụng chuỗi lớp đầy đủ [lớp tăng cường mới + lớp cũ giữ lại] trên đất nền cũ.'
      );
    }
    if (rehabSummary?.subgradeShearSkippedReason) {
      cursor.prose(2, `⚠ ${rehabSummary.subgradeShearSkippedReason}`, { italic: true });
    }
  }

  if (!altRes.shearApplicable) {
    cursor.prose(
      2,
      isLowGradeSurface
        ? `Không yêu cầu kiểm toán cắt trượt đối với tầng mặt cấp thấp ${grade} (theo Điều 9.1.4.3 & 9.3.1).`
        : 'Không yêu cầu kiểm toán cắt trượt.'
    );
  } else if (altRes.shearTargets.length === 0) {
    cursor.prose(
      2,
      rehabSummary?.subgradeShearSkippedReason ||
        'Chưa có đối tượng kiểm toán cắt trượt (thiếu thông số chiều dày kết cấu cũ H_cũ hoặc lớp vật liệu kém dính kết).'
    );
  } else {
    // Prepare lookup refs for structural layers in Bảng 3 (+ Bảng 3b for CAI_TAO)
    const overlayShear = alt.layers.filter(
      (l) => (!isRehabOverlay || !l.isBuVenh) && l.chieuDay_cm > 0 && l.E_truot_60C > 0
    );
    const existingShear =
      isRehabOverlay && rehabilitation
        ? rehabilitation.existingLayers.filter((l) => !l.isBuVenh && l.chieuDay_cm > 0 && l.E_truot_60C > 0)
        : [];
    const combinedShearSources: Array<SourceLayerRef | null> = [
      ...overlayShear.map((l): SourceLayerRef | null => {
        const row = b3RowById.get(l.id);
        return row !== undefined ? { row, sheetTable: 'B3' } : null;
      }),
      ...existingShear.map((l): SourceLayerRef | null => {
        const info = b3bRowById.get(l.id);
        return info ? { row: info.row, sheetTable: 'B3B', kHh: info.kHh } : null;
      }),
    ];

    altRes.shearTargets.forEach((st, idx) => {
      const letter = `${String.fromCharCode(97 + idx)}.`;
      cursor.subStepHeading(
        letter,
        st.isSubgrade
          ? isRehabOverlay
            ? 'Kiểm tra đất nền cũ (Chương 10):'
            : 'Kiểm tra đất nền:'
          : `Kiểm tra lớp ${st.targetName}:`
      );
      cursor.prose(2, 'Tính đổi các lớp bên trên về 1 lớp, thể hiện ở bảng sau:');
      cursor.blank(12.75);

      const aboveSourceRefs =
        st.reductionAbove.rows.length <= combinedShearSources.length
          ? combinedShearSources.slice(0, st.reductionAbove.rows.length)
          : st.reductionAbove.rows.map(() => null);

      const { rTop, rBot } = writeReductionTable(
        ws,
        cursor,
        st.reductionAbove,
        'E_{tr} (MPa)',
        'G',
        aboveSourceRefs
      );

      cursor.blank(12.75);
      const { rHD, rEtbDc } = writeTwoLayerBetaBlock(ws, cursor, rTop, rBot, rD, st.reductionAbove);

      const figShear = st.usedToanDo === '3-3' || st.H_over_D > 2.0 ? 'Hình 5' : 'Hình 4';
      cursor.prose(2, `Sử dụng toán đồ ${figShear}, với các thông số sau:`);

      const rHD2 = cursor.next(15.75);
      setPlainCell(ws.getRow(rHD2).getCell(3), 'H/D', {}, { horizontal: 'left', vertical: 'middle' });
      setPlainCell(ws.getRow(rHD2).getCell(4), '=', {}, { horizontal: 'left', vertical: 'middle' });
      setFormulaCell(
        ws.getRow(rHD2).getCell(6),
        `F${rHD}`,
        Number(st.H_over_D.toFixed(3)),
        {},
        { horizontal: 'left', vertical: 'middle' },
        '0.000'
      );

      const rE1 = cursor.next(18.75);
      setCellMarkup(ws.getRow(rE1).getCell(3), 'E_{1}', {}, { horizontal: 'left', vertical: 'middle' });
      setCellMarkup(ws.getRow(rE1).getCell(4), '= E_{tb}^{đc} =', {}, { horizontal: 'left', vertical: 'middle' });
      setFormulaCell(
        ws.getRow(rE1).getCell(6),
        `F${rEtbDc}`,
        Number(st.E1_MPa.toFixed(2)),
        {},
        { horizontal: 'left', vertical: 'middle' },
        '0.00'
      );
      setPlainCell(ws.getRow(rE1).getCell(7), '(MPa)', {}, { horizontal: 'left', vertical: 'middle' });

      const rE2 = cursor.next(18.75);
      setCellMarkup(ws.getRow(rE2).getCell(3), 'E_{2}', {}, { horizontal: 'left', vertical: 'middle' });
      setCellMarkup(
        ws.getRow(rE2).getCell(4),
        st.isSubgrade ? '= E_{0} =' : '= E_{ch} =',
        {},
        { horizontal: 'left', vertical: 'middle' }
      );
      if (st.isSubgrade) {
        setFormulaCell(
          ws.getRow(rE2).getCell(6),
          `$F$${rE0}`,
          Number(st.E2_MPa.toFixed(2)),
          {},
          { horizontal: 'left', vertical: 'middle' },
          '0.00'
        );
      } else {
        setPlainCell(
          ws.getRow(rE2).getCell(6),
          Number(st.E2_MPa.toFixed(2)),
          {},
          { horizontal: 'left', vertical: 'middle' },
          '0.00'
        );
      }
      setPlainCell(ws.getRow(rE2).getCell(7), '(MPa)', {}, { horizontal: 'left', vertical: 'middle' });

      const rE1E2 = cursor.next(18.75);
      setCellMarkup(ws.getRow(rE1E2).getCell(3), 'E_{1}/E_{2}', {}, { horizontal: 'left', vertical: 'middle' });
      setPlainCell(ws.getRow(rE1E2).getCell(4), '=', {}, { horizontal: 'left', vertical: 'middle' });
      setFormulaCell(
        ws.getRow(rE1E2).getCell(6),
        `F${rE1}/F${rE2}`,
        Number(st.E1_over_E2.toFixed(3)),
        {},
        { horizontal: 'left', vertical: 'middle' },
        '0.000'
      );

      const targetB3Row = st.targetId ? b3RowById.get(st.targetId) : undefined;
      const targetB3bInfo = st.targetId ? b3bRowById.get(st.targetId) : undefined;
      const targetRowRef = targetB3Row ?? targetB3bInfo?.row;

      const rPhiSt = cursor.next(15.75);
      setPlainCell(ws.getRow(rPhiSt).getCell(3), 'φ', {}, { horizontal: 'left', vertical: 'middle' });
      setPlainCell(ws.getRow(rPhiSt).getCell(4), '=', {}, { horizontal: 'left', vertical: 'middle' });
      if (st.isSubgrade) {
        setFormulaCell(
          ws.getRow(rPhiSt).getCell(6),
          `$F$${rPhi}`,
          Number(st.phi_deg.toFixed(2)),
          {},
          { horizontal: 'left', vertical: 'middle' },
          'General'
        );
      } else if (targetRowRef !== undefined) {
        setFormulaCell(
          ws.getRow(rPhiSt).getCell(6),
          `K${targetRowRef}`,
          Number(st.phi_deg.toFixed(2)),
          {},
          { horizontal: 'left', vertical: 'middle' },
          'General'
        );
      } else {
        setPlainCell(
          ws.getRow(rPhiSt).getCell(6),
          Number(st.phi_deg.toFixed(2)),
          {},
          { horizontal: 'left', vertical: 'middle' },
          'General'
        );
      }
      setPlainCell(ws.getRow(rPhiSt).getCell(7), '(độ)', {}, { horizontal: 'left', vertical: 'middle' });

      cursor.prose(2, 'Tra toán đồ, ta được:');
      const rTaxP = cursor.next(18.75);
      setCellMarkup(ws.getRow(rTaxP).getCell(3), 'T_{ax}/p', {}, { horizontal: 'left', vertical: 'middle' });
      setPlainCell(ws.getRow(rTaxP).getCell(4), '=', {}, { horizontal: 'left', vertical: 'middle' });
      setPlainCell(
        ws.getRow(rTaxP).getCell(5),
        Number(st.tax_over_p.toFixed(4)),
        {},
        { horizontal: 'left', vertical: 'middle' },
        '0.0000'
      );

      const rPSt = cursor.next(15.75);
      setPlainCell(ws.getRow(rPSt).getCell(3), 'p', {}, { horizontal: 'left', vertical: 'middle' });
      setPlainCell(ws.getRow(rPSt).getCell(4), '=', {}, { horizontal: 'left', vertical: 'middle' });
      setFormulaCell(
        ws.getRow(rPSt).getCell(5),
        `$F$${rPressure}`,
        Number(forecast.apLucBanh_p_MPa.toFixed(2)),
        {},
        { horizontal: 'left', vertical: 'middle' },
        '0.00'
      );
      setPlainCell(ws.getRow(rPSt).getCell(6), '(MPa)', {}, { horizontal: 'left', vertical: 'middle' });

      cursor.prose(2, 'Ứng suất cắt hoạt động do tải trọng bánh xe tính toán gây ra:');
      const rTax = cursor.next(18.75);
      setCellMarkup(ws.getRow(rTax).getCell(3), 'T_{ax}', {}, { horizontal: 'left', vertical: 'middle' });
      setPlainCell(ws.getRow(rTax).getCell(4), '=', {}, { horizontal: 'left', vertical: 'middle' });
      setFormulaCell(
        ws.getRow(rTax).getCell(6),
        `E${rTaxP}*E${rPSt}`,
        Number(st.tax_MPa.toFixed(4)),
        {},
        { horizontal: 'left', vertical: 'middle' },
        '0.0000'
      );
      setPlainCell(ws.getRow(rTax).getCell(7), '(MPa)', {}, { horizontal: 'left', vertical: 'middle' });

      cursor.prose(2, 'Sử dụng toán đồ Hình 6, với các thông số:');
      const rTavIn = cursor.next(15.75);
      setPlainCell(ws.getRow(rTavIn).getCell(3), 'H =', {}, { horizontal: 'left', vertical: 'middle' });
      setFormulaCell(
        ws.getRow(rTavIn).getCell(4),
        `J${rTop}`,
        Number(st.H_cm.toFixed(2)),
        {},
        { horizontal: 'center', vertical: 'middle' },
        'General'
      );
      setPlainCell(ws.getRow(rTavIn).getCell(5), '(cm)  và', {}, { horizontal: 'center', vertical: 'middle' });
      setPlainCell(ws.getRow(rTavIn).getCell(6), 'φ =', {}, { horizontal: 'right', vertical: 'middle' });
      setFormulaCell(
        ws.getRow(rTavIn).getCell(7),
        `F${rPhiSt}`,
        Number(st.phi_deg.toFixed(2)),
        {},
        { horizontal: 'center', vertical: 'middle' },
        'General'
      );
      setPlainCell(ws.getRow(rTavIn).getCell(8), '(độ)', {}, { horizontal: 'left', vertical: 'middle' });

      cursor.prose(2, 'Tra được ứng suất cắt hoạt động do trọng lượng bản thân các lớp kết cấu gây ra:');
      const rTav = cursor.next(18.75);
      setCellMarkup(ws.getRow(rTav).getCell(3), 'T_{av}', {}, { horizontal: 'left', vertical: 'middle' });
      setPlainCell(ws.getRow(rTav).getCell(4), '=', {}, { horizontal: 'left', vertical: 'middle' });
      setPlainCell(
        ws.getRow(rTav).getCell(5),
        Number(st.tav_MPa.toFixed(5)),
        {},
        { horizontal: 'left', vertical: 'middle' },
        '0.0000'
      );
      setPlainCell(ws.getRow(rTav).getCell(6), '(MPa)', {}, { horizontal: 'left', vertical: 'middle' });

      const rCohHdr = cursor.next(18.75);
      setPlainCell(ws.getRow(rCohHdr).getCell(2), 'Lực dính tính toán:', {}, { horizontal: 'left', vertical: 'middle' });
      setCellMarkup(ws.getRow(rCohHdr).getCell(4), 'C_{tt} = C.K_{1}.K_{2}.K_{3}', {}, { horizontal: 'left', vertical: 'middle' });

      const rCVal = cursor.next(15.75);
      setPlainCell(ws.getRow(rCVal).getCell(2), 'Trong đó:', {}, { horizontal: 'left', vertical: 'middle' });
      setPlainCell(ws.getRow(rCVal).getCell(3), 'C', {}, { horizontal: 'left', vertical: 'middle' });
      setPlainCell(ws.getRow(rCVal).getCell(4), '=', {}, { horizontal: 'left', vertical: 'middle' });
      if (st.isSubgrade) {
        setFormulaCell(
          ws.getRow(rCVal).getCell(5),
          `$F$${rC}`,
          Number(st.C_MPa.toFixed(4)),
          {},
          { horizontal: 'left', vertical: 'middle' },
          '0.0000'
        );
      } else if (targetRowRef !== undefined) {
        setFormulaCell(
          ws.getRow(rCVal).getCell(5),
          `J${targetRowRef}`,
          Number(st.C_MPa.toFixed(4)),
          {},
          { horizontal: 'left', vertical: 'middle' },
          '0.0000'
        );
      } else {
        setPlainCell(
          ws.getRow(rCVal).getCell(5),
          Number(st.C_MPa.toFixed(4)),
          {},
          { horizontal: 'left', vertical: 'middle' },
          '0.0000'
        );
      }
      setPlainCell(ws.getRow(rCVal).getCell(6), '(MPa)', {}, { horizontal: 'left', vertical: 'middle' });

      const rK1 = cursor.next(18.75);
      setCellMarkup(ws.getRow(rK1).getCell(3), 'K_{1}', {}, { horizontal: 'left', vertical: 'middle' });
      setPlainCell(ws.getRow(rK1).getCell(4), '=', {}, { horizontal: 'left', vertical: 'middle' });
      setPlainCell(ws.getRow(rK1).getCell(5), Number(st.k1.toFixed(2)), {}, { horizontal: 'left', vertical: 'middle' }, '0.00');
      setPlainCell(ws.getRow(rK1).getCell(6), objLabel, {}, { horizontal: 'left', vertical: 'middle' });

      const rNttSt = cursor.next(18.75);
      setCellMarkup(ws.getRow(rNttSt).getCell(3), 'N_{tt}', {}, { horizontal: 'left', vertical: 'middle' });
      setPlainCell(ws.getRow(rNttSt).getCell(4), '=', {}, { horizontal: 'left', vertical: 'middle' });
      setFormulaCell(
        ws.getRow(rNttSt).getCell(5),
        `$F$${rNtt2}`,
        nttRounded,
        {},
        { horizontal: 'left', vertical: 'middle' },
        '#,##0'
      );
      setPlainCell(ws.getRow(rNttSt).getCell(6), '(trục/làn.ngày đêm)', {}, { horizontal: 'left', vertical: 'middle' });

      const rK2 = cursor.next(18.75);
      setCellMarkup(ws.getRow(rK2).getCell(3), 'K_{2}', {}, { horizontal: 'left', vertical: 'middle' });
      setPlainCell(ws.getRow(rK2).getCell(4), '=', {}, { horizontal: 'left', vertical: 'middle' });
      if (projectInfo.doiTuongTK === 'LGC') {
        setPlainCell(
          ws.getRow(rK2).getCell(5),
          Number(st.k2.toFixed(2)),
          {},
          { horizontal: 'left', vertical: 'middle' },
          'General'
        );
      } else {
        setFormulaCell(
          ws.getRow(rK2).getCell(5),
          `IF($F$${rNtt2}<100,1,IF($F$${rNtt2}<1000,0.8,IF($F$${rNtt2}<5000,0.65,0.6)))`,
          Number(st.k2.toFixed(2)),
          {},
          { horizontal: 'left', vertical: 'middle' },
          'General'
        );
      }
      setPlainCell(ws.getRow(rK2).getCell(6), '(tra Bảng 12)', {}, { horizontal: 'left', vertical: 'middle' });

      const rSoilLbl = cursor.next(15.75);
      setPlainCell(
        ws.getRow(rSoilLbl).getCell(2),
        st.isSubgrade ? 'Đất nền là:' : 'Lớp kiểm tra là:',
        {},
        { horizontal: 'left', vertical: 'middle' }
      );
      setPlainCell(
        ws.getRow(rSoilLbl).getCell(4),
        st.isSubgrade ? subgrade.loaiDat : st.targetName,
        {},
        { horizontal: 'left', vertical: 'middle' }
      );

      const rK3 = cursor.next(18.75);
      setPlainCell(ws.getRow(rK3).getCell(2), 'Do đó:', {}, { horizontal: 'left', vertical: 'middle' });
      setCellMarkup(ws.getRow(rK3).getCell(3), 'K_{3}', {}, { horizontal: 'left', vertical: 'middle' });
      setPlainCell(ws.getRow(rK3).getCell(4), '=', {}, { horizontal: 'left', vertical: 'middle' });
      setPlainCell(ws.getRow(rK3).getCell(5), Number(st.k3.toFixed(2)), {}, { horizontal: 'left', vertical: 'middle' }, 'General');

      const rCtt = cursor.next(18.75);
      setPlainCell(ws.getRow(rCtt).getCell(2), 'Vậy:', {}, { horizontal: 'left', vertical: 'middle' });
      setCellMarkup(ws.getRow(rCtt).getCell(3), 'C_{tt}', {}, { horizontal: 'left', vertical: 'middle' });
      setPlainCell(ws.getRow(rCtt).getCell(4), '=', {}, { horizontal: 'left', vertical: 'middle' });
      setFormulaCell(
        ws.getRow(rCtt).getCell(6),
        `E${rCVal}*E${rK1}*E${rK2}*E${rK3}`,
        Number(st.Ctt_MPa.toFixed(4)),
        {},
        { horizontal: 'left', vertical: 'middle' },
        '0.0000'
      );
      setPlainCell(ws.getRow(rCtt).getCell(7), '(MPa)', {}, { horizontal: 'left', vertical: 'middle' });
      setPlainCell(
        ws.getRow(rCtt).getCell(8),
        'Công thức (8) — Điều 9.3.4',
        {},
        { horizontal: 'left', vertical: 'middle' }
      );

      const rShRel = cursor.next(15.75);
      setPlainCell(ws.getRow(rShRel).getCell(2), 'Độ tin cậy thiết kế', {}, { horizontal: 'left', vertical: 'middle' });
      setFormulaCell(
        ws.getRow(rShRel).getCell(4),
        `$F$${rRel}`,
        Number(roadScale.doTinCayTK.toFixed(2)),
        {},
        { horizontal: 'left', vertical: 'middle' },
        '"= "0.00'
      );

      cursor.prose(2, 'Tra Bảng 8, ta được hệ số cường độ về cắt trượt:');
      const rKcdTr = cursor.next(18.75);
      setCellMarkup(ws.getRow(rKcdTr).getCell(3), 'K_{cđ}^{tr}', {}, { horizontal: 'left', vertical: 'middle' });
      setFormulaCell(
        ws.getRow(rKcdTr).getCell(4),
        buildKcdTrKuFormula(`$F$${rRel}`),
        Number(st.Kcd_tr.toFixed(2)),
        {},
        { horizontal: 'left', vertical: 'middle' },
        '"= "0.00'
      );

      cursor.prose(2, 'Kiểm tra điều kiện về cắt trượt:');
      const rTauTot = cursor.next(18.75);
      setCellMarkup(ws.getRow(rTauTot).getCell(3), 'T_{ax} + T_{av}', {}, { horizontal: 'left', vertical: 'middle' });
      setPlainCell(ws.getRow(rTauTot).getCell(4), '=', {}, { horizontal: 'left', vertical: 'middle' });
      setFormulaCell(
        ws.getRow(rTauTot).getCell(6),
        `F${rTax}+E${rTav}`,
        Number(st.tau_total_MPa.toFixed(4)),
        {},
        { horizontal: 'left', vertical: 'middle' },
        '0.0000'
      );
      setPlainCell(ws.getRow(rTauTot).getCell(7), '(MPa)', {}, { horizontal: 'left', vertical: 'middle' });

      const rTauAllow = cursor.next(18.75);
      setCellMarkup(ws.getRow(rTauAllow).getCell(3), 'C_{tt}/K_{cđ}^{tr}', {}, { horizontal: 'left', vertical: 'middle' });
      setPlainCell(ws.getRow(rTauAllow).getCell(4), '=', {}, { horizontal: 'left', vertical: 'middle' });
      setFormulaCell(
        ws.getRow(rTauAllow).getCell(6),
        `F${rCtt}/D${rKcdTr}`,
        Number(st.tau_allow_MPa.toFixed(4)),
        {},
        { horizontal: 'left', vertical: 'middle' },
        '0.0000'
      );
      setPlainCell(ws.getRow(rTauAllow).getCell(7), '(MPa)', {}, { horizontal: 'left', vertical: 'middle' });

      const rShCmp = cursor.next(18.75);
      const shCmpRow = ws.getRow(rShCmp);
      setCellMarkup(shCmpRow.getCell(2), 'T_{ax} + T_{av} =', { bold: true }, { horizontal: 'left', vertical: 'middle' });
      setFormulaCell(
        shCmpRow.getCell(3),
        `F${rTauTot}`,
        Number(st.tau_total_MPa.toFixed(4)),
        { bold: true },
        { horizontal: 'center', vertical: 'middle' },
        '0.0000'
      );
      setFormulaCell(
        shCmpRow.getCell(4),
        `IF(C${rShCmp}<=F${rShCmp},"<=",">")`,
        st.passed ? '<=' : '>',
        { bold: true },
        { horizontal: 'center', vertical: 'middle' }
      );
      setCellMarkup(shCmpRow.getCell(5), 'C_{tt}/K_{cđ}^{tr} =', { bold: true }, { horizontal: 'left', vertical: 'middle' });
      setFormulaCell(
        shCmpRow.getCell(6),
        `F${rTauAllow}`,
        Number(st.tau_allow_MPa.toFixed(4)),
        { bold: true },
        { horizontal: 'center', vertical: 'middle' },
        '0.0000'
      );
      setPlainCell(shCmpRow.getCell(7), '(MPa)', { bold: true }, { horizontal: 'left', vertical: 'middle' });
      setPlainCell(
        shCmpRow.getCell(8),
        'Công thức (7) — Điều 9.3.1',
        {},
        { horizontal: 'left', vertical: 'middle' }
      );

      cursor.blank(12.75);
      const passConc = st.isSubgrade
        ? isRehabOverlay
          ? 'Kết luận: Đất nền cũ đảm bảo điều kiện cân bằng trượt.'
          : 'Kết luận: Đất nền đảm bảo điều kiện cân bằng trượt.'
        : `Kết luận: Lớp ${st.targetName} đảm bảo điều kiện cân bằng trượt.`;
      const failConc = st.isSubgrade
        ? isRehabOverlay
          ? 'Kết luận: Đất nền cũ KHÔNG đảm bảo điều kiện cân bằng trượt.'
          : 'Kết luận: Đất nền KHÔNG đảm bảo điều kiện cân bằng trượt.'
        : `Kết luận: Lớp ${st.targetName} KHÔNG đảm bảo điều kiện cân bằng trượt.`;

      const rShConc = cursor.next(15.75);
      setFormulaCell(
        ws.getRow(rShConc).getCell(2),
        `IF(C${rShCmp}<=F${rShCmp},"${escFormulaStr(passConc)}","${escFormulaStr(failConc)}")`,
        st.passed ? passConc : failConc,
        { bold: true, italic: true, color: st.passed ? COLOR_PASS : COLOR_FAIL },
        { horizontal: 'left', vertical: 'middle' }
      );
      addConclusionColorRule(ws, rShConc);
      cursor.blank(12.75);
    });
  }

  // =========================================================================
  // III.3 Kiểm tra tiêu chuẩn chịu kéo uốn trong các lớp vật liệu liền khối
  // =========================================================================
  cursor.sectionHeading('III.3. Kiểm tra tiêu chuẩn chịu kéo uốn trong các lớp vật liệu liền khối:');

  if (!altRes.flexuralApplicable || altRes.flexuralLayers.length === 0) {
    cursor.prose(
      2,
      isLowGradeSurface
        ? `Không yêu cầu kiểm toán chịu kéo uốn đối với tầng mặt cấp thấp ${grade} (theo Điều 9.1.4.3 & 9.4.1).`
        : 'Không có lớp vật liệu liền khối cần kiểm toán chịu kéo uốn (theo Điều 9.4.1).'
    );
  } else {
    const overlayFlexLayers = alt.layers.filter(
      (l) => (!isRehabOverlay || !l.isBuVenh) && l.chieuDay_cm > 0 && l.E_vong_30C > 0
    );
    const existingFlexLayers =
      isRehabOverlay && rehabilitation
        ? rehabilitation.existingLayers.filter((l) => !l.isBuVenh && l.chieuDay_cm > 0 && l.E_vong_30C > 0)
        : [];
    const combinedFlexSources: Array<SourceLayerRef | null> = [
      ...overlayFlexLayers.map((l): SourceLayerRef | null => {
        const row = b3RowById.get(l.id);
        return row !== undefined ? { row, sheetTable: 'B3' } : null;
      }),
      ...existingFlexLayers.map((l): SourceLayerRef | null => {
        const info = b3bRowById.get(l.id);
        return info ? { row: info.row, sheetTable: 'B3B', kHh: info.kHh } : null;
      }),
    ];

    altRes.flexuralLayers.forEach((fl, idx) => {
      const letter = `${String.fromCharCode(97 + idx)}.`;
      cursor.subStepHeading(letter, `Kiểm tra lớp ${idx + 1}: ${fl.layerName}:`);

      // Determine where fl sits in combinedFlexSources
      const isRetainedExisting = fl.layerName.includes('(lớp cũ giữ lại)');
      let flPos = overlayFlexLayers.findIndex((l) => l.id === fl.layerId);
      if (flPos < 0 && isRetainedExisting) {
        const exPos = existingFlexLayers.findIndex((l) => l.id === fl.layerId);
        if (exPos >= 0) flPos = overlayFlexLayers.length + exPos;
      }

      const flFoundationE =
        isRehabOverlay && !isRetainedExisting ? foundationE : subgradeResolved.E0_MPa;
      const flFoundationRef =
        isRehabOverlay && !isRetainedExisting && rEchCu !== null ? `$F$${rEchCu}` : `$F$${rE0}`;
      const flRehabFoundation = isRehabOverlay && !isRetainedExisting;

      let rEchmFlex: number;
      if (fl.reductionBelow && fl.reductionBelow.rows.length > 0) {
        const belowStart = flPos >= 0 ? flPos + 1 : -1;
        const belowRefs =
          belowStart >= 0 && belowStart + fl.reductionBelow.rows.length <= combinedFlexSources.length
            ? combinedFlexSources.slice(belowStart, belowStart + fl.reductionBelow.rows.length)
            : fl.reductionBelow.rows.map(() => null);

        cursor.prose(
          2,
          flRehabFoundation
            ? `Xác định E_{ch.m} ở dưới lớp ${fl.layerName} (trên nền tương đương E'_{0} = E_{ch,cũ} = ${fmt(flFoundationE, 2)} MPa, Điều 10.4.2 & 9.4.2):`
            : `Xác định E_{ch.m} ở dưới lớp ${fl.layerName}:`,
          { height: 18.75 }
        );
        cursor.prose(2, 'Tính đổi các lớp bên dưới về một lớp thể hiện ở bảng sau:');
        cursor.blank(12.75);

        const { rTop, rBot } = writeReductionTable(
          ws,
          cursor,
          fl.reductionBelow,
          'E_{ku} (MPa)',
          'H',
          belowRefs
        );
        cursor.blank(12.75);
        const { rHD, rEtbDc } = writeTwoLayerBetaBlock(
          ws,
          cursor,
          rTop,
          rBot,
          rD,
          fl.reductionBelow
        );
        const usedEqE1 = fl.reductionBelow.H_over_D > 2.0;
        const rawRatio =
          fl.reductionBelow.Etb_dc_MPa > 0 ? fl.Echm_MPa / fl.reductionBelow.Etb_dc_MPa : 0;
        const eqRes = writeEquivEchBlock(
          ws,
          cursor,
          rEtbDc,
          rHD,
          flFoundationRef,
          flFoundationE,
          fl.reductionBelow.Etb_dc_MPa,
          fl.reductionBelow.H_over_D,
          usedEqE1 ? null : rawRatio,
          fl.Echm_MPa,
          usedEqE1,
          flRehabFoundation,
          false
        );
        rEchmFlex = eqRes.rEchm;
      } else {
        cursor.prose(2, 'Xác định Ech.m trên mặt kết cấu áo đường cũ (Điều 10.4.2 & 9.4.2):');
        rEchmFlex = cursor.next(18.75);
        setCellMarkup(ws.getRow(rEchmFlex).getCell(3), 'E_{ch.m}', {}, { horizontal: 'left', vertical: 'middle' });
        setCellMarkup(ws.getRow(rEchmFlex).getCell(4), '= E_{ch,cũ} =', {}, { horizontal: 'left', vertical: 'middle' });
        if (rEchCu !== null) {
          setFormulaCell(
            ws.getRow(rEchmFlex).getCell(6),
            `F${rEchCu}`,
            Number(fl.Echm_MPa.toFixed(2)),
            {},
            { horizontal: 'left', vertical: 'middle' },
            '0.00'
          );
        } else {
          setPlainCell(
            ws.getRow(rEchmFlex).getCell(6),
            Number(fl.Echm_MPa.toFixed(2)),
            {},
            { horizontal: 'left', vertical: 'middle' },
            '0.00'
          );
        }
        setPlainCell(ws.getRow(rEchmFlex).getCell(7), '(MPa)', {}, { horizontal: 'left', vertical: 'middle' });
      }

      const layerSourceRef = flPos >= 0 ? combinedFlexSources[flPos] : null;
      const srcRkuRef =
        !isRetainedExisting && b3RowById.has(fl.layerId) ? `I${b3RowById.get(fl.layerId)!}` : null;

      let rSigBar: number;
      if (fl.isSurfaceLayer) {
        cursor.prose(
          2,
          `Tra toán đồ Hình 7${fl.usedAnalyticalFallback ? ' (dùng công thức giải tích Phụ lục E (E.2)–(E.3))' : ''} với các thông số sau:`
        );

        const topRefs =
          flPos >= 0
            ? combinedFlexSources.slice(0, flPos + 1).filter((r): r is SourceLayerRef => r !== null)
            : [];
        const hasFullTopRefs = flPos >= 0 && topRefs.length === flPos + 1;

        const rH = cursor.next(15.75);
        setPlainCell(ws.getRow(rH).getCell(3), 'h', {}, { horizontal: 'left', vertical: 'middle' });
        setPlainCell(ws.getRow(rH).getCell(4), '=', {}, { horizontal: 'left', vertical: 'middle' });
        if (hasFullTopRefs) {
          const { hFormula, eFormula } = buildWeightedModulusFormula(topRefs, 'E', 'H');
          setFormulaCell(
            ws.getRow(rH).getCell(6),
            hFormula,
            Number(fl.h1_cm.toFixed(2)),
            {},
            { horizontal: 'left', vertical: 'middle' },
            'General'
          );
          setPlainCell(ws.getRow(rH).getCell(7), '(cm)', {}, { horizontal: 'left', vertical: 'middle' });

          const rE1Fl = cursor.next(18.75);
          setCellMarkup(ws.getRow(rE1Fl).getCell(3), 'E_{1}', {}, { horizontal: 'left', vertical: 'middle' });
          setCellMarkup(
            ws.getRow(rE1Fl).getCell(4),
            topRefs.length === 1 ? '= E_{ku} =' : '= Σ(E_{i}*h_{i})/Σh =',
            {},
            { horizontal: 'left', vertical: 'middle' }
          );
          setFormulaCell(
            ws.getRow(rE1Fl).getCell(6),
            topRefs.length === 1
              ? topRefs[0].sheetTable === 'B3B' && (topRefs[0].kHh ?? 1) < 1
                ? `H${topRefs[0].row}*I${topRefs[0].row}`
                : `H${topRefs[0].row}`
              : eFormula,
            Number(fl.E1_MPa.toFixed(2)),
            {},
            { horizontal: 'left', vertical: 'middle' },
            '0.00'
          );
          setPlainCell(ws.getRow(rE1Fl).getCell(7), '(MPa)', {}, { horizontal: 'left', vertical: 'middle' });

          const rRat1 = cursor.next(18.75);
          setCellMarkup(ws.getRow(rRat1).getCell(3), 'E_{1}/E_{ch.m}', {}, { horizontal: 'left', vertical: 'middle' });
          setPlainCell(ws.getRow(rRat1).getCell(4), '=', {}, { horizontal: 'left', vertical: 'middle' });
          setFormulaCell(
            ws.getRow(rRat1).getCell(6),
            `F${rE1Fl}/F${rEchmFlex}`,
            Number(fl.ratio1.toFixed(3)),
            {},
            { horizontal: 'left', vertical: 'middle' },
            '0.000'
          );

          const rHDFlex = cursor.next(15.75);
          setPlainCell(ws.getRow(rHDFlex).getCell(3), 'h/D', {}, { horizontal: 'left', vertical: 'middle' });
          setPlainCell(ws.getRow(rHDFlex).getCell(4), '=', {}, { horizontal: 'left', vertical: 'middle' });
          setFormulaCell(
            ws.getRow(rHDFlex).getCell(6),
            `F${rH}/$F$${rD}`,
            Number(fl.H_over_D.toFixed(3)),
            {},
            { horizontal: 'left', vertical: 'middle' },
            '0.000'
          );
        } else {
          setPlainCell(
            ws.getRow(rH).getCell(6),
            Number(fl.h1_cm.toFixed(2)),
            {},
            { horizontal: 'left', vertical: 'middle' },
            'General'
          );
          setPlainCell(ws.getRow(rH).getCell(7), '(cm)', {}, { horizontal: 'left', vertical: 'middle' });
        }
      } else {
        cursor.prose(
          2,
          `Tra toán đồ Hình 8${fl.usedAnalyticalFallback ? ' (dùng công thức giải tích Phụ lục E (E.4))' : ''} với các thông số sau:`
        );

        const aboveRefs =
          flPos > 0
            ? combinedFlexSources.slice(0, flPos).filter((r): r is SourceLayerRef => r !== null)
            : [];
        const hasAllAboveRefs = flPos > 0 && aboveRefs.length === flPos;

        const rH = cursor.next(18.75);
        setPlainCell(ws.getRow(rH).getCell(3), 'h', {}, { horizontal: 'left', vertical: 'middle' });
        setCellMarkup(ws.getRow(rH).getCell(4), '= Σh_{i} =', {}, { horizontal: 'left', vertical: 'middle' });
        if (hasAllAboveRefs && layerSourceRef) {
          const packRefs = [...aboveRefs, layerSourceRef];
          const { hFormula: hPackFormula } = buildWeightedModulusFormula(packRefs, 'E', 'H');
          const { eFormula: e1AboveFormula } = buildWeightedModulusFormula(aboveRefs, 'E', 'H');

          setFormulaCell(
            ws.getRow(rH).getCell(5),
            hPackFormula,
            Number(fl.h1_cm.toFixed(2)),
            {},
            { horizontal: 'left', vertical: 'middle' },
            'General'
          );
          setPlainCell(ws.getRow(rH).getCell(6), '(cm)', {}, { horizontal: 'left', vertical: 'middle' });

          const rE1Fl = cursor.next(18.75);
          setCellMarkup(ws.getRow(rE1Fl).getCell(3), 'E_{1}', {}, { horizontal: 'left', vertical: 'middle' });
          setCellMarkup(ws.getRow(rE1Fl).getCell(4), '= Σ(E_{i}*h_{i})/Σh =', {}, { horizontal: 'left', vertical: 'middle' });
          setFormulaCell(
            ws.getRow(rE1Fl).getCell(6),
            e1AboveFormula,
            Number(fl.E1_MPa.toFixed(2)),
            {},
            { horizontal: 'left', vertical: 'middle' },
            '0.00'
          );
          setPlainCell(ws.getRow(rE1Fl).getCell(7), '(MPa)', {}, { horizontal: 'left', vertical: 'middle' });

          const rE2Fl = cursor.next(18.75);
          setCellMarkup(ws.getRow(rE2Fl).getCell(3), 'E_{2}', {}, { horizontal: 'left', vertical: 'middle' });
          setPlainCell(ws.getRow(rE2Fl).getCell(4), '=', {}, { horizontal: 'left', vertical: 'middle' });
          setFormulaCell(
            ws.getRow(rE2Fl).getCell(6),
            layerSourceRef.sheetTable === 'B3B' && (layerSourceRef.kHh ?? 1) < 1
              ? `H${layerSourceRef.row}*I${layerSourceRef.row}`
              : `H${layerSourceRef.row}`,
            Number(fl.E2_MPa.toFixed(2)),
            {},
            { horizontal: 'left', vertical: 'middle' },
            '0.00'
          );
          setPlainCell(ws.getRow(rE2Fl).getCell(7), '(MPa)', {}, { horizontal: 'left', vertical: 'middle' });

          const rE3Fl = cursor.next(18.75);
          setCellMarkup(ws.getRow(rE3Fl).getCell(3), 'E_{3}', {}, { horizontal: 'left', vertical: 'middle' });
          setCellMarkup(ws.getRow(rE3Fl).getCell(4), '= E_{ch.m} =', {}, { horizontal: 'left', vertical: 'middle' });
          setFormulaCell(
            ws.getRow(rE3Fl).getCell(5),
            `F${rEchmFlex}`,
            Number(fl.Echm_MPa.toFixed(2)),
            {},
            { horizontal: 'left', vertical: 'middle' },
            '0.00'
          );
          setPlainCell(ws.getRow(rE3Fl).getCell(6), '(MPa)', {}, { horizontal: 'left', vertical: 'middle' });

          const rHDFlex = cursor.next(15.75);
          setPlainCell(ws.getRow(rHDFlex).getCell(3), 'h/D', {}, { horizontal: 'left', vertical: 'middle' });
          setPlainCell(ws.getRow(rHDFlex).getCell(4), '=', {}, { horizontal: 'left', vertical: 'middle' });
          setFormulaCell(
            ws.getRow(rHDFlex).getCell(5),
            `E${rH}/$F$${rD}`,
            Number(fl.H_over_D.toFixed(3)),
            {},
            { horizontal: 'left', vertical: 'middle' },
            '0.000'
          );

          const rRat1 = cursor.next(18.75);
          setCellMarkup(ws.getRow(rRat1).getCell(3), 'E_{1}/E_{2}', {}, { horizontal: 'left', vertical: 'middle' });
          setPlainCell(ws.getRow(rRat1).getCell(4), '=', {}, { horizontal: 'left', vertical: 'middle' });
          setFormulaCell(
            ws.getRow(rRat1).getCell(6),
            `F${rE1Fl}/F${rE2Fl}`,
            Number(fl.ratio1.toFixed(3)),
            {},
            { horizontal: 'left', vertical: 'middle' },
            '0.000'
          );

          const rRat2 = cursor.next(18.75);
          setCellMarkup(ws.getRow(rRat2).getCell(3), 'E_{2}/E_{3}', {}, { horizontal: 'left', vertical: 'middle' });
          setPlainCell(ws.getRow(rRat2).getCell(4), '=', {}, { horizontal: 'left', vertical: 'middle' });
          setFormulaCell(
            ws.getRow(rRat2).getCell(6),
            `F${rE2Fl}/E${rE3Fl}`,
            Number((fl.ratio2 ?? 0).toFixed(3)),
            {},
            { horizontal: 'left', vertical: 'middle' },
            '0.000'
          );
        } else {
          setPlainCell(
            ws.getRow(rH).getCell(5),
            Number(fl.h1_cm.toFixed(2)),
            {},
            { horizontal: 'left', vertical: 'middle' },
            'General'
          );
          setPlainCell(ws.getRow(rH).getCell(6), '(cm)', {}, { horizontal: 'left', vertical: 'middle' });
        }
      }

      cursor.prose(2, 'Tra được ứng suất kéo uốn đơn vị:');
      rSigBar = cursor.next(18.75);
      setCellMarkup(ws.getRow(rSigBar).getCell(3), '[ σ_{ku} ]', {}, { horizontal: 'left', vertical: 'middle' });
      setPlainCell(ws.getRow(rSigBar).getCell(4), '=', {}, { horizontal: 'left', vertical: 'middle' });
      setPlainCell(
        ws.getRow(rSigBar).getCell(5),
        Number(fl.sigma_ku_bar.toFixed(5)),
        {},
        { horizontal: 'left', vertical: 'middle' },
        '0.0000'
      );

      cursor.prose(
        2,
        `Tải trọng tác dụng là: ${forecast.taiTrongTrucTacDung === 'BANH_DON' ? 'Cụm bánh đơn (tải trọng trục đặc biệt)' : 'Cụm bánh đôi (tải trọng trục tiêu chuẩn)'}`
      );
      const rKb = cursor.next(18.75);
      setPlainCell(ws.getRow(rKb).getCell(2), 'Do đó:', {}, { horizontal: 'left', vertical: 'middle' });
      setCellMarkup(ws.getRow(rKb).getCell(3), 'k_{b}', {}, { horizontal: 'left', vertical: 'middle' });
      setPlainCell(ws.getRow(rKb).getCell(4), '=', {}, { horizontal: 'left', vertical: 'middle' });
      setPlainCell(ws.getRow(rKb).getCell(5), Number(fl.kb.toFixed(2)), {}, { horizontal: 'left', vertical: 'middle' }, '0.00');

      cursor.prose(2, `Ứng suất kéo uốn lớn nhất phát sinh ở đáy lớp ${fl.layerName}:`);
      const rSigKu = cursor.next(18.75);
      setCellMarkup(ws.getRow(rSigKu).getCell(3), 'σ_{ku}', {}, { horizontal: 'left', vertical: 'middle' });
      setCellMarkup(
        ws.getRow(rSigKu).getCell(4),
        '= [ σ_{ku} ] * p * k_{b} =',
        {},
        { horizontal: 'left', vertical: 'middle' }
      );
      ws.mergeCells(rSigKu, 4, rSigKu, 5);
      setFormulaCell(
        ws.getRow(rSigKu).getCell(6),
        `E${rSigBar}*$F$${rPressure}*E${rKb}`,
        Number(fl.sigma_ku_MPa.toFixed(3)),
        {},
        { horizontal: 'left', vertical: 'middle' },
        '0.000'
      );
      setPlainCell(ws.getRow(rSigKu).getCell(7), '(MPa)', {}, { horizontal: 'left', vertical: 'middle' });
      setPlainCell(
        ws.getRow(rSigKu).getCell(8),
        'Công thức (10) — Điều 9.4.2',
        {},
        { horizontal: 'left', vertical: 'middle' }
      );

      const eqCode = forecast.namTinhToan === 'NAM_DAU' ? '(A.2)' : '(A.3)';
      cursor.prose(
        2,
        `Số trục xe tiêu chuẩn tích lũy trong suốt thời hạn thiết kế (dùng Công thức ${eqCode}, Phụ lục A):`
      );
      const rNeEq = cursor.next(18.75);
      setCellMarkup(ws.getRow(rNeEq).getCell(3), 'N_{e} =', {}, { horizontal: 'right', vertical: 'middle' });
      setCellMarkup(
        ws.getRow(rNeEq).getCell(4),
        forecast.quyLuatTangTruong_q === 0
          ? 't * 365 * N_{tt}'
          : forecast.namTinhToan === 'NAM_DAU'
            ? '([(1+q)^{t}-1]/q)*365*N_{tt}'
            : '([(1+q)^{t}-1]/[q*(1+q)^{(t-1)}])*365*N_{tt}',
        {},
        { horizontal: 'left', vertical: 'middle' }
      );

      const rNe = cursor.next(15.75);
      setPlainCell(ws.getRow(rNe).getCell(3), '=', {}, { horizontal: 'right', vertical: 'middle' });
      const neFormula =
        forecast.quyLuatTangTruong_q === 0
          ? `$F$${rYears}*365*$F$${rNtt2}`
          : forecast.namTinhToan === 'NAM_DAU'
            ? `((1+$F$${rQ}/100)^$F$${rYears}-1)/($F$${rQ}/100)*365*$F$${rNtt2}`
            : `((1+$F$${rQ}/100)^$F$${rYears}-1)/(($F$${rQ}/100)*(1+$F$${rQ}/100)^($F$${rYears}-1))*365*$F$${rNtt2}`;
      setFormulaCell(
        ws.getRow(rNe).getCell(4),
        neFormula,
        Math.round(traffic.Ne_truc),
        {},
        { horizontal: 'center', vertical: 'middle' },
        '#,##0'
      );
      setPlainCell(ws.getRow(rNe).getCell(5), '(Trục)', {}, { horizontal: 'left', vertical: 'middle' });

      cursor.prose(2, `Vật liệu kiểm tra là ${fl.layerName}, vậy hệ số k_{1}:`, { height: 18.75 });
      const rK1Eq = cursor.next(18.75);
      setCellMarkup(ws.getRow(rK1Eq).getCell(3), 'k_{1} =', {}, { horizontal: 'right', vertical: 'middle' });
      setCellMarkup(
        ws.getRow(rK1Eq).getCell(4),
        fl.materialClass === 'BTN'
          ? '11.11 / N_{e}^{0.22}'
          : fl.materialClass === 'DA_SOI_GC'
            ? '2.86 / N_{e}^{0.11}'
            : '2.22 / N_{e}^{0.11}',
        {},
        { horizontal: 'left', vertical: 'middle' }
      );
      setPlainCell(
        ws.getRow(rK1Eq).getCell(7),
        fl.materialClass === 'BTN'
          ? 'Công thức (12) — Điều 9.4.3'
          : fl.materialClass === 'DA_SOI_GC'
            ? 'Công thức (13) — Điều 9.4.3'
            : 'Công thức (14) — Điều 9.4.3',
        {},
        { horizontal: 'left', vertical: 'middle' }
      );

      const rK1Fl = cursor.next(15.75);
      setPlainCell(ws.getRow(rK1Fl).getCell(3), '=', {}, { horizontal: 'right', vertical: 'middle' });
      setFormulaCell(
        ws.getRow(rK1Fl).getCell(4),
        fl.materialClass === 'BTN'
          ? `11.11/D${rNe}^0.22`
          : fl.materialClass === 'DA_SOI_GC'
            ? `2.86/D${rNe}^0.11`
            : `2.22/D${rNe}^0.11`,
        Number(fl.k1.toFixed(4)),
        {},
        { horizontal: 'left', vertical: 'middle' },
        '0.0000'
      );

      const rK2Fl = cursor.next(18.75);
      setCellMarkup(ws.getRow(rK2Fl).getCell(3), 'k_{2} =', {}, { horizontal: 'right', vertical: 'middle' });
      setPlainCell(ws.getRow(rK2Fl).getCell(4), Number(fl.k2.toFixed(2)), {}, { horizontal: 'left', vertical: 'middle' }, 'General');

      cursor.prose(2, `Cường độ chịu kéo uốn tính toán của lớp ${fl.layerName}:`);
      const rRttEq = cursor.next(18.75);
      setCellMarkup(ws.getRow(rRttEq).getCell(3), 'R_{tt}^{ku} =', {}, { horizontal: 'right', vertical: 'middle' });
      setCellMarkup(ws.getRow(rRttEq).getCell(4), 'k_{1} * k_{2} * R_{ku}', {}, { horizontal: 'left', vertical: 'middle' });
      setPlainCell(
        ws.getRow(rRttEq).getCell(7),
        'Công thức (11) — Điều 9.4.3',
        {},
        { horizontal: 'left', vertical: 'middle' }
      );

      const rRtt = cursor.next(15.75);
      setPlainCell(ws.getRow(rRtt).getCell(3), '=', {}, { horizontal: 'right', vertical: 'middle' });
      setFormulaCell(
        ws.getRow(rRtt).getCell(4),
        srcRkuRef ? `D${rK1Fl}*D${rK2Fl}*${srcRkuRef}` : `D${rK1Fl}*D${rK2Fl}*${fl.Rku_MPa}`,
        Number(fl.Rtt_ku_MPa.toFixed(3)),
        {},
        { horizontal: 'left', vertical: 'middle' },
        '0.000'
      );
      setPlainCell(ws.getRow(rRtt).getCell(5), '(MPa)', {}, { horizontal: 'left', vertical: 'middle' });

      const rFlRel = cursor.next(15.75);
      setPlainCell(ws.getRow(rFlRel).getCell(2), 'Độ tin cậy thiết kế', {}, { horizontal: 'left', vertical: 'middle' });
      setFormulaCell(
        ws.getRow(rFlRel).getCell(4),
        `$F$${rRel}`,
        Number(roadScale.doTinCayTK.toFixed(2)),
        {},
        { horizontal: 'left', vertical: 'middle' },
        '"= "0.00'
      );

      cursor.prose(2, 'Tra Bảng 8, hệ số cường độ về chịu kéo uốn:');
      const rKcdKu = cursor.next(18.75);
      setCellMarkup(ws.getRow(rKcdKu).getCell(3), 'K_{cđ}^{ku}', {}, { horizontal: 'left', vertical: 'middle' });
      setFormulaCell(
        ws.getRow(rKcdKu).getCell(4),
        buildKcdTrKuFormula(`$F$${rRel}`),
        Number(fl.Kcd_ku.toFixed(2)),
        {},
        { horizontal: 'left', vertical: 'middle' },
        '"= "0.00'
      );

      const rRAllow = cursor.next(18.75);
      setCellMarkup(ws.getRow(rRAllow).getCell(3), 'R_{tt}^{ku}/K_{cđ}^{ku}', {}, { horizontal: 'left', vertical: 'middle' });
      setPlainCell(ws.getRow(rRAllow).getCell(4), '=', {}, { horizontal: 'left', vertical: 'middle' });
      setFormulaCell(
        ws.getRow(rRAllow).getCell(6),
        `D${rRtt}/D${rKcdKu}`,
        Number(fl.R_allow_MPa.toFixed(3)),
        {},
        { horizontal: 'left', vertical: 'middle' },
        '0.000'
      );
      setPlainCell(ws.getRow(rRAllow).getCell(7), '(MPa)', {}, { horizontal: 'left', vertical: 'middle' });

      const rFlCmp = cursor.next(18.75);
      const flCmpRow = ws.getRow(rFlCmp);
      setCellMarkup(flCmpRow.getCell(2), 'σ_{ku} =', { bold: true }, { horizontal: 'center', vertical: 'middle' });
      setFormulaCell(
        flCmpRow.getCell(3),
        `F${rSigKu}`,
        Number(fl.sigma_ku_MPa.toFixed(3)),
        { bold: true },
        { horizontal: 'center', vertical: 'middle' },
        '0.000'
      );
      setFormulaCell(
        flCmpRow.getCell(4),
        `IF(C${rFlCmp}<=F${rFlCmp},"<=",">")`,
        fl.passed ? '<=' : '>',
        { bold: true },
        { horizontal: 'center', vertical: 'middle' }
      );
      setCellMarkup(flCmpRow.getCell(5), 'R_{tt}^{ku}/K_{cđ}^{ku} =', { bold: true }, { horizontal: 'center', vertical: 'middle' });
      setFormulaCell(
        flCmpRow.getCell(6),
        `F${rRAllow}`,
        Number(fl.R_allow_MPa.toFixed(3)),
        { bold: true },
        { horizontal: 'center', vertical: 'middle' },
        '0.000'
      );
      setPlainCell(flCmpRow.getCell(7), '(MPa)', { bold: true }, { horizontal: 'left', vertical: 'middle' });
      setPlainCell(
        flCmpRow.getCell(8),
        'Công thức (9) — Điều 9.4.1',
        {},
        { horizontal: 'left', vertical: 'middle' }
      );

      cursor.blank(12.75);
      const flPassMsg = `Kết luận: Lớp ${fl.layerName} đảm bảo tiêu chuẩn chịu kéo uốn.`;
      const flFailMsg = `Kết luận: Lớp ${fl.layerName} KHÔNG đảm bảo tiêu chuẩn chịu kéo uốn.`;
      const rFlConc = cursor.next(15.75);
      setFormulaCell(
        ws.getRow(rFlConc).getCell(2),
        `IF(C${rFlCmp}<=F${rFlCmp},"${escFormulaStr(flPassMsg)}","${escFormulaStr(flFailMsg)}")`,
        fl.passed ? flPassMsg : flFailMsg,
        { bold: true, italic: true, color: fl.passed ? COLOR_PASS : COLOR_FAIL },
        { horizontal: 'left', vertical: 'middle' }
      );
      addConclusionColorRule(ws, rFlConc);
      cursor.blank(12.75);
    });
  }

  if (isRehabOverlay && rehabSummary?.warnings && rehabSummary.warnings.length > 0) {
    cursor.sectionHeading('III.4. Lưu ý & Cảnh báo kỹ thuật (Chương 10 — TCCS 38:2022/TCĐBVN):');
    for (const w of Array.from(new Set(rehabSummary.warnings))) {
      cursor.prose(2, `⚠ ${w}`, { italic: true });
    }
  }
}

export async function buildVerificationWorkbook(
  project: ProjectState,
  verification: FullVerificationResult,
  selectedAlternativeIds?: string[]
): Promise<ExcelJS.Workbook> {
  const WorkbookCtor =
    ExcelJS.Workbook ??
    (ExcelJS as unknown as { default?: { Workbook?: typeof ExcelJS.Workbook } }).default?.Workbook;
  if (!WorkbookCtor) {
    throw new Error('Không thể khởi tạo ExcelJS.Workbook.');
  }
  const wb = new WorkbookCtor();
  wb.creator = 'Áo đường mềm (TCCS 38:2022/TCĐBVN)';
  wb.created = new Date();

  const targetIds =
    selectedAlternativeIds && selectedAlternativeIds.length > 0
      ? new Set(selectedAlternativeIds)
      : null;

  const selectedAlts = project.alternatives.filter((alt) => {
    if (targetIds && !targetIds.has(alt.id)) return false;
    return Boolean(verification.alternatives[alt.id]);
  });

  if (selectedAlts.length === 0) {
    throw new Error('Không có phương án kết cấu hợp lệ đã chạy kiểm toán để xuất Excel.');
  }

  const usedNames = new Set<string>();
  for (const alt of selectedAlts) {
    const altRes = verification.alternatives[alt.id];
    const sheetName = sanitizeSheetName(alt.name, usedNames);
    const ws = wb.addWorksheet(sheetName);
    populateAlternativeSheet(ws, project, verification, alt, altRes);
  }

  return wb;
}

export async function exportVerificationToXlsxBuffer(
  project: ProjectState,
  verification: FullVerificationResult,
  selectedAlternativeIds?: string[]
): Promise<Uint8Array> {
  const wb = await buildVerificationWorkbook(project, verification, selectedAlternativeIds);
  const raw = await wb.xlsx.writeBuffer();
  return raw instanceof Uint8Array ? raw : new Uint8Array(raw as ArrayBuffer);
}

export async function downloadVerificationExcel(
  project: ProjectState,
  verification: FullVerificationResult,
  selectedAlternativeIds?: string[],
  filename?: string
): Promise<void> {
  const bytes = await exportVerificationToXlsxBuffer(
    project,
    verification,
    selectedAlternativeIds
  );
  const blob = new Blob([bytes.buffer as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeBase =
    (project.projectInfo.congTrinh || 'KetQuaKiemToan_TCCS38_2022')
      .replace(/[\\/:*?"<>|]/g, '_')
      .trim() || 'KetQuaKiemToan_TCCS38_2022';
  link.href = url;
  link.download = filename || `${safeBase}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
