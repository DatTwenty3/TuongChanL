import type ExcelJS from 'exceljs';

export const COL_WIDTHS_11: readonly number[] = [
  5.0,
  9.29,
  10.71,
  12.14,
  12.14,
  13.57,
  11.43,
  12.14,
  13.57,
  12.86,
  12.86,
];

export const PAGE_SETUP_A4: Partial<ExcelJS.PageSetup> = {
  paperSize: 9, // A4
  orientation: 'portrait',
  fitToPage: true,
  fitToWidth: 1,
  fitToHeight: 0,
  margins: {
    left: 0.75,
    right: 0.75,
    top: 1.0,
    bottom: 1.0,
    header: 0,
    footer: 0,
  },
  showGridLines: false, // printGridlines = false
};

export const COLOR_BLACK = 'FF000000';
export const COLOR_PASS = 'FF0000FF';
export const COLOR_FAIL = 'FFFF0000';

export interface TnrOptions {
  size?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
}

export function tnrFont(opts?: TnrOptions): Partial<ExcelJS.Font> {
  const font: Partial<ExcelJS.Font> = {
    name: 'Times New Roman',
    size: opts?.size ?? 12,
    color: { argb: opts?.color ?? COLOR_BLACK },
  };
  if (opts?.bold) font.bold = true;
  if (opts?.italic) font.italic = true;
  if (opts?.underline) font.underline = 'single';
  return font;
}

/**
 * Parses lightweight `_{sub}` and `^{sup}` markup into ExcelJS RichText runs using
 * pure Times New Roman (no legacy `symbol` font). Returns plain string if no sub/sup runs exist.
 */
export function rtValue(
  markup: string,
  opts?: TnrOptions
): string | ExcelJS.CellRichTextValue {
  if (!markup.includes('_{') && !markup.includes('^{')) {
    return markup;
  }

  const runs: ExcelJS.RichText[] = [];
  const tokenRe = /(_|\^)\{([^}]*)\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const makeRunFont = (vertAlign?: 'subscript' | 'superscript'): Partial<ExcelJS.Font> => {
    const f = tnrFont(opts);
    if (vertAlign) {
      f.vertAlign = vertAlign;
    }
    return f;
  };

  while ((match = tokenRe.exec(markup)) !== null) {
    if (match.index > lastIndex) {
      runs.push({
        text: markup.slice(lastIndex, match.index),
        font: makeRunFont(),
      });
    }
    const kind = match[1] === '_' ? 'subscript' : 'superscript';
    runs.push({
      text: match[2],
      font: makeRunFont(kind),
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < markup.length) {
    runs.push({
      text: markup.slice(lastIndex),
      font: makeRunFont(),
    });
  }

  return runs.length > 0 ? { richText: runs } : markup;
}

export function setCellMarkup(
  cell: ExcelJS.Cell,
  markup: string,
  opts?: TnrOptions,
  alignment?: Partial<ExcelJS.Alignment>
): void {
  cell.value = rtValue(markup, opts);
  cell.font = tnrFont(opts);
  if (alignment) {
    cell.alignment = alignment;
  }
}

export function setPlainCell(
  cell: ExcelJS.Cell,
  text: string | number,
  opts?: TnrOptions,
  alignment?: Partial<ExcelJS.Alignment>,
  numFmt?: string
): void {
  cell.value = text;
  cell.font = tnrFont(opts);
  if (alignment) {
    cell.alignment = alignment;
  }
  if (numFmt) {
    cell.numFmt = numFmt;
  }
}

export function setFormulaCell(
  cell: ExcelJS.Cell,
  formula: string,
  result: number | string | boolean,
  opts?: TnrOptions,
  alignment?: Partial<ExcelJS.Alignment>,
  numFmt?: string
): void {
  const cleanFormula = formula.startsWith('=') ? formula.slice(1) : formula;
  cell.value = { formula: cleanFormula, result };
  cell.font = tnrFont(opts);
  if (alignment) {
    cell.alignment = alignment;
  }
  if (numFmt) {
    cell.numFmt = numFmt;
  }
}

export function escFormulaStr(s: string): string {
  return s.replace(/"/g, '""');
}

export function buildBetaFormula(hdRef: string): string {
  return (
    `IF(${hdRef}<=0,1,` +
    `IF(${hdRef}<0.5,ROUND(1.114*${hdRef}^0.12,3),` +
    `IF(${hdRef}<=0.75,1.033+(${hdRef}-0.5)/0.25*(1.069-1.033),` +
    `IF(${hdRef}<=1,1.069+(${hdRef}-0.75)/0.25*(1.107-1.069),` +
    `IF(${hdRef}<=1.25,1.107+(${hdRef}-1)/0.25*(1.136-1.107),` +
    `IF(${hdRef}<=1.5,1.136+(${hdRef}-1.25)/0.25*(1.178-1.136),` +
    `IF(${hdRef}<=1.75,1.178+(${hdRef}-1.5)/0.25*(1.198-1.178),` +
    `IF(${hdRef}<=2,1.198+(${hdRef}-1.75)/0.25*(1.21-1.198),` +
    `ROUND(1.114*${hdRef}^0.12,3)))))))))`
  );
}

export function buildKcdDvFormula(relRef: string): string {
  return `IF(${relRef}>=0.98,1.29,IF(${relRef}>=0.95,1.17,IF(${relRef}>=0.9,1.1,IF(${relRef}>=0.85,1.06,1.02))))`;
}

export function buildKcdTrKuFormula(relRef: string): string {
  return `IF(${relRef}>=0.98,1.1,IF(${relRef}>=0.95,1,IF(${relRef}>=0.9,0.94,IF(${relRef}>=0.85,0.9,0.87))))`;
}

export function applyRowGridBorders(
  ws: ExcelJS.Worksheet,
  rowNumber: number,
  options: {
    top: ExcelJS.BorderStyle;
    bottom: ExcelJS.BorderStyle;
    mergedSpans?: Array<[number, number]>;
  }
): void {
  const row = ws.getRow(rowNumber);
  const insideMerged = new Set<number>();
  const leftOfSpan = new Set<number>();
  const rightOfSpan = new Set<number>();

  if (options.mergedSpans) {
    for (const [c1, c2] of options.mergedSpans) {
      leftOfSpan.add(c1);
      rightOfSpan.add(c2);
      for (let c = c1 + 1; c < c2; c += 1) {
        insideMerged.add(c);
      }
    }
  }

  for (let c = 1; c <= 11; c += 1) {
    const cell = row.getCell(c);
    const border: Partial<ExcelJS.Borders> = {
      top: { style: options.top },
      bottom: { style: options.bottom },
    };

    if (c === 1) {
      border.left = { style: 'medium' };
    } else if (!insideMerged.has(c) && !rightOfSpan.has(c) || leftOfSpan.has(c)) {
      border.left = { style: 'thin' };
    }

    if (c === 11) {
      border.right = { style: 'medium' };
    } else if (!insideMerged.has(c) && !leftOfSpan.has(c) || rightOfSpan.has(c)) {
      border.right = { style: 'thin' };
    }

    cell.border = border;
  }
}

export function setupCenterContinuousRow(
  ws: ExcelJS.Worksheet,
  rowNumber: number,
  text: string,
  fontOpts: TnrOptions,
  heightPt: number
): void {
  const row = ws.getRow(rowNumber);
  row.height = heightPt;
  const font = tnrFont(fontOpts);
  for (let c = 1; c <= 11; c += 1) {
    const cell = row.getCell(c);
    if (c === 1) {
      cell.value = text;
      cell.font = font;
    } else {
      cell.font = tnrFont({ size: 10 });
    }
    cell.alignment = { horizontal: 'centerContinuous', vertical: 'middle' };
  }
}

export function calcWrapHeight(text: string, charsPerLine: number, minHeight = 16.5): number {
  const lines = Math.max(1, Math.ceil(text.length / Math.max(10, charsPerLine)));
  return Math.max(minHeight, lines * 15.75 + (lines > 1 ? 3 : 0));
}
