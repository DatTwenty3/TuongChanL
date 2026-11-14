import * as ExcelJSLib from 'exceljs';
import type { Alignment, Border, Borders, Fill, Font, Workbook, Worksheet } from 'exceljs';
import {
  IT_TAB,
  OBJ_TABS,
  type AppMode,
  type DividerMode,
  type ExportScope,
} from '../types/project.ts';
import {
  CDL,
  exportPlot3dPng,
  type Pm3dSectionInput,
  type Pm3dStateStore,
} from '../graphics/plots3d.ts';
import { eqPng, eqSize, svgPng, type MathRasterizer } from '../graphics/texMath.ts';
import { normalizeAppMode, resolveOpenTabInfo } from './projectIo.ts';

type ExcelWorkbookCtor = typeof Workbook;

const ExcelNs = ExcelJSLib as unknown as {
  Workbook?: ExcelWorkbookCtor;
  default?: { Workbook?: ExcelWorkbookCtor };
};
const WorkbookCtor = (ExcelNs.Workbook ?? ExcelNs.default?.Workbook) as ExcelWorkbookCtor;

export interface WorkbookMargins {
  left: number;
  right: number;
  top: number;
  bottom: number;
  header: number;
  footer: number;
}

export interface WorkbookBlock {
  s: number;
  e: number;
  glue: boolean | '__done';
}

export interface WorkbookGroup {
  s: number;
  e: number;
}

export interface WorkbookImageEntry {
  b64: string;
  tl: { col: number; row: number };
  ext: { width: number; height: number };
}

export interface WorkbookMeta {
  name: string;
  ws: Worksheet;
  scale: number;
  widths: number[];
  imgs: WorkbookImageEntry[];
  breaks: Set<number>;
  foot: string;
  HEADROWS: number;
  last: number;
  MG: WorkbookMargins;
  divider?: boolean;
  xc?: number;
  groups?: WorkbookGroup[];
}

export interface PmChartCurvePoint {
  Pn: number;
  Mn: number;
  phi: number;
  P: number;
  M: number;
}

export interface PmChartCurveData {
  cap: number;
  pts: PmChartCurvePoint[];
}

export interface PmChartExportData {
  cd: PmChartCurveData;
  db: PmChartCurveData;
}

export interface BuildWorkbookResolvers {
  supK?: () => boolean;
  ltnOn?: () => boolean;
  mdOn?: () => boolean;
  sfmOn?: () => boolean;
  trOn?: () => boolean;
  dcOn?: () => boolean;
  sfdOn?: () => boolean;
  sctSep?: () => boolean;
  sctNm?: (id: string, def: [string, string]) => [string, string];
  sctSheetNm?: (prefix: string, name: string) => string;
  objMode?: () => 'all' | 'dam' | 'mo' | 'tru';
  objOn?: (tabId: number) => boolean;
  itList?: () => Array<[string, 'sup' | 'mo' | 'tru' | 'qd', string, number[], string]>;
  kcpdG?: () => Array<{ g: string; t: string; na?: boolean; subs: string[] }>;
}

export interface BuildWorkbookOptions {
  mode?: AppMode;
  scope?: ExportScope;
  dividerMode?: DividerMode;
  activeTabId?: number | string;
  documentRoot?: ParentNode | null;
  onPrepareAll?: () => void | Promise<void>;
  buildPmChartData?: () => PmChartExportData | null;
  st3?: Pm3dStateStore | null;
  renderPlotlyImage?: (
    st: 'CD' | 'DB',
    width: number,
    height: number,
    scale: number,
  ) => Promise<string>;
  eqRasterizer?: MathRasterizer;
  svgRasterizer?: MathRasterizer;
  resolvers?: BuildWorkbookResolvers;
}

export interface BuildWorkbookResult {
  wb: Workbook;
  metas: WorkbookMeta[];
  buffer: Uint8Array;
}

const DEFAULT_MG: WorkbookMargins = {
  left: 0.5,
  right: 0.4,
  top: 0.4,
  bottom: 0.5,
  header: 0.25,
  footer: 0.25,
};

const BASE_WIDTHS = [1.5, 4.5, 8, 9.5, 8.5, 8.5, 8.5, 8.5, 8, 9.5, 8, 9.5];
const PW_IN = 8.27;
const PH_IN = 11.69;
const FONT_NAME = 'Times New Roman';

/**
 * Convert 1-based column index (`1 -> 'A'`, `27 -> 'AA'`) to Excel A1 column reference.
 */
export function colLetter(n: number): string {
  let num = Math.max(1, Math.floor(n));
  let out = '';
  while (num > 0) {
    const rem = (num - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    num = Math.floor((num - 1) / 26);
  }
  return out;
}

function sanitizeSheetName(name: string, usedNames: Set<string>): string {
  const cleaned = String(name || 'Sheet')
    .replace(/[:\\/?*\[\]]/g, '')
    .trim()
    .slice(0, 31) || 'Sheet';
  if (!usedNames.has(cleaned)) {
    usedNames.add(cleaned);
    return cleaned;
  }
  for (let i = 2; i < 100; i++) {
    const suf = ` (${i})`;
    const candidate = cleaned.slice(0, 31 - suf.length) + suf;
    if (!usedNames.has(candidate)) {
      usedNames.add(candidate);
      return candidate;
    }
  }
  return cleaned;
}

/**
 * Extract formatted calculation cell text cleanly matching `18_appmode_export_xlsx_pdf.js:234-248`.
 */
export function cellText(node: Element): string {
  const doc = node.ownerDocument ?? document;
  const clone = node.cloneNode(true) as Element;
  clone.querySelectorAll('.noprint').forEach((e) => e.remove());
  const srcs = Array.from(node.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input,select')).filter(
    (e) => !e.closest('.noprint'),
  );
  clone.querySelectorAll('input,select').forEach((el, i) => {
    const src = srcs[i];
    if (!src) return;
    let val = '';
    if (src.tagName === 'SELECT') {
      const sel = src as HTMLSelectElement;
      const opt = sel.options[sel.selectedIndex];
      val = opt ? opt.text : sel.value;
    } else {
      val = (src as HTMLInputElement).value;
    }
    const prefix = i > 0 && srcs[i - 1]?.parentNode === src.parentNode ? ' / ' : '';
    el.replaceWith(doc.createTextNode(prefix + val));
  });
  return (clone.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Parse strict numeric cell strings into Excel numeric value + fixed decimal display format.
 */
export function asNum(text: string): { v: number; fmt: string } | null {
  if (/^-?\d+(\.\d+)?$/.test(text)) {
    const dec = (text.split('.')[1] ?? '').length;
    return { v: parseFloat(text), fmt: dec ? '0.' + '0'.repeat(dec) : '0' };
  }
  return null;
}

function getEl<T extends HTMLElement = HTMLElement>(root: ParentNode, id: string): T | null {
  if ('getElementById' in root && typeof root.getElementById === 'function') {
    return root.getElementById(id) as T | null;
  }
  return root.querySelector<T>(`[id="${id}"]`);
}

function getVal(root: ParentNode, id: string): string {
  const el = getEl<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(root, id);
  return el ? String(el.value ?? '') : '';
}

function getNum(root: ParentNode, id: string, fallback = 0): number {
  const v = parseFloat(getVal(root, id).replace(',', '.'));
  return Number.isFinite(v) ? v : fallback;
}

function createDefaultResolvers(root: ParentNode): Required<BuildWorkbookResolvers> {
  const itOff = (): Set<string> =>
    new Set(
      getVal(root, 'tq_off')
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
    );
  const ikOn = (k: string): boolean => !itOff().has(String(k));
  const itOn = (t: number): boolean => {
    const k = IT_TAB[t as keyof typeof IT_TAB];
    return !k || ikOn(k);
  };
  const supK = (): boolean => getVal(root, 'sp_sup') === 'K';
  const ltnOn = (): boolean => getVal(root, 'tq_bltn') === '1';
  const mdOn = (): boolean => getVal(root, 'tq_mot') === 'deo';
  const sfmOn = (): boolean => getVal(root, 'mo_fnd') === 'nong' && !mdOn();
  const trOn = (): boolean => getVal(root, 'tq_kn') === 'n' && getVal(root, 'tq_tru') === 'deo';
  const dcOn = (): boolean => getVal(root, 'tq_kn') === 'n' && getVal(root, 'tq_tru') === 'dac';
  const sfdOn = (): boolean => getVal(root, 'dt_fnd') === 'nong' && dcOn();
  const sctSep = (): boolean => getVal(root, 'tq_sct') === '1';

  const sctNm = (id: string, def: [string, string]): [string, string] => {
    const parts = getVal(root, id)
      .split(/[,;]/)
      .map((x) => x.trim())
      .filter(Boolean);
    return [parts[0] || def[0], parts[1] || (parts[0] && parts[0] !== def[0] ? parts[0] + ' (2)' : def[1])];
  };

  const sctSheetNm = (p: string, n: string): string =>
    (p + n).replace(/[:\\/?*\[\]]/g, '').slice(0, 31);

  const sctSplit = (arr: string[], kind: 'm' | 't'): string[] => {
    if (!sctSep()) return arr;
    const n = kind === 'm' ? sctNm('tq_mo', ['M1', 'M2']) : sctNm('td_name', ['T1', 'T2']);
    const w = kind === 'm' ? 'mố' : 'trụ';
    return arr.flatMap((x) =>
      x === 'Sức chịu tải của cọc theo đất nền' ? [`${x} - ${w} ${n[0]}`, `${x} - ${w} ${n[1]}`] : [x],
    );
  };

  const objMode = (): 'all' | 'dam' | 'mo' | 'tru' => {
    const v = getVal(root, 'tq_obj');
    if (v === 'dam' || v === 'mo' || v === 'tru') return v;
    return 'all';
  };

  const objOn = (tabId: number): boolean => {
    if (tabId === 7) return true;
    if (!itOn(tabId)) return false;
    const m = objMode();
    if (m === 'all') return true;
    return (OBJ_TABS[m] as readonly number[]).includes(tabId);
  };

  const itList = (): Array<[string, 'sup' | 'mo' | 'tru' | 'qd', string, number[], string]> => {
    const L: Array<[string, 'sup' | 'mo' | 'tru' | 'qd', string, number[], string]> = [
      ['8', 'sup', 'Dầm giữa', [8], 'Kiểm toán dầm giữa'],
      ['9', 'sup', 'Dầm biên', [9], 'Kiểm toán dầm biên'],
      ['10', 'sup', 'Bản mặt cầu', [10], 'Kiểm toán bản mặt cầu'],
      [
        '11',
        'sup',
        supK() ? 'Kê dầm trên mố, trụ' : 'Gối cầu',
        [11],
        supK() ? 'Kiểm toán kê dầm trên mố, trụ' : 'Kiểm toán gối cầu',
      ],
    ];
    if (ltnOn()) L.push(['12', 'sup', 'Bản liên tục nhiệt', [12], 'Kiểm toán bản liên tục nhiệt']);
    L.push(
      ['13', 'sup', 'Khe co giãn', [13], 'Tính toán khe co giãn'],
      ['14', 'sup', 'Gờ lan can', [14], 'Kiểm toán gờ lan can'],
      ['mtt', 'mo', 'Tải trọng, tổ hợp tải trọng', [4], 'Tải trọng và tổ hợp tải trọng'],
      ['mmc', 'mo', 'Mặt cắt mố', [5], 'Kiểm toán các mặt cắt của mố'],
    );
    if (sfmOn()) {
      L.push(
        ['mnl', 'mo', 'Nền móng nông', [52], 'Kiểm toán nền móng nông'],
        ['mbe', 'mo', 'Bệ móng', [6], 'Kiểm toán bệ móng'],
      );
    } else {
      L.push(
        ['mnl', 'mo', 'Nội lực đầu cọc', [1], 'Nội lực đầu cọc'],
        ['mbe', 'mo', mdOn() ? 'Bệ mố' : 'Bệ cọc', [6], mdOn() ? 'Kiểm toán bệ mố' : 'Kiểm toán bệ cọc'],
        ['msc', 'mo', 'Sức chịu tải cọc theo đất nền', [2, 56], 'Sức chịu tải của cọc theo đất nền'],
        ['mvl', 'mo', 'Cọc theo vật liệu', [3], 'Kiểm toán cọc theo vật liệu'],
      );
    }
    if (trOn()) {
      L.push(
        ['ttt', 'tru', 'Tải trọng, tổ hợp tải trọng', [20], 'Tải trọng và tổ hợp tải trọng'],
        ['tnl', 'tru', 'Nội lực trụ (mô hình khung)', [21], 'Nội lực trụ (mô hình khung)'],
        ['txm', 'tru', 'Xà mũ, giằng', [22], 'Kiểm toán xà mũ, giằng'],
        ['tth', 'tru', 'Thân trụ theo vật liệu', [26], 'Kiểm toán thân trụ theo vật liệu'],
        ['tnc', 'tru', 'Nội lực cọc', [23], 'Nội lực cọc'],
        ['tsc', 'tru', 'Sức chịu tải cọc theo đất nền', [24, 57], 'Sức chịu tải của cọc theo đất nền'],
        ['tvl', 'tru', 'Cọc theo vật liệu', [25], 'Kiểm toán cọc theo vật liệu'],
      );
    } else if (dcOn()) {
      L.push(
        ['ttt', 'tru', 'Tải trọng, tổ hợp tải trọng', [20], 'Tải trọng và tổ hợp tải trọng'],
        ['txm', 'tru', 'Xà mũ', [46], 'Kiểm toán xà mũ'],
        ['tth', 'tru', 'Thân trụ theo vật liệu', [47], 'Kiểm toán thân trụ theo vật liệu'],
      );
      if (sfdOn()) {
        L.push(
          ['tnc', 'tru', 'Nền móng nông', [53], 'Kiểm toán nền móng nông'],
          ['tbe', 'tru', 'Bệ trụ', [48], 'Kiểm toán bệ trụ'],
        );
      } else {
        L.push(
          ['tnc', 'tru', 'Nội lực đầu cọc', [49], 'Nội lực đầu cọc'],
          ['tbe', 'tru', 'Bệ trụ', [48], 'Kiểm toán bệ trụ'],
          ['tsc', 'tru', 'Sức chịu tải cọc theo đất nền', [50, 58], 'Sức chịu tải của cọc theo đất nền'],
          ['tvl', 'tru', 'Cọc theo vật liệu', [51], 'Kiểm toán cọc theo vật liệu'],
        );
      }
    }
    L.push(['qd', 'qd', 'Bản quá độ', [43], 'Kiểm toán bản quá độ']);
    return L;
  };

  const kcpdG = (): Array<{ g: string; t: string; na?: boolean; subs: string[] }> => {
    const om = objMode();
    const L = itList();
    const G: Array<{ g: string; t: string; na?: boolean; subs: string[] }> = [];
    const igOn = (g: string) => L.some((x) => x[1] === g && ikOn(x[0]));
    const sub = (g: 'mo' | 'tru', kind: 'm' | 't') =>
      sctSplit(
        L.filter((x) => x[1] === g && ikOn(x[0])).map((x) => x[4]),
        kind,
      );
    const mo = getVal(root, 'tq_mo').trim();
    const tnm = getVal(root, 'td_name').trim();
    const nt = Math.max(0, Math.round(getNum(root, 'tq_nt', 0)));

    if (om !== 'tru' && igOn('mo')) {
      G.push({ g: 'mo', t: 'Kiểm toán mố' + (mo ? ' ' + mo : ''), subs: sub('mo', 'm') });
    }
    if (om !== 'mo') {
      if (trOn() && igOn('tru')) {
        G.push({ g: 'tru', t: 'Kiểm toán trụ dẻo' + (tnm ? ' ' + tnm : ''), subs: sub('tru', 't') });
      } else if (dcOn() && igOn('tru')) {
        G.push({ g: 'tru', t: 'Kiểm toán trụ đặc' + (tnm ? ' ' + tnm : ''), subs: sub('tru', 't') });
      } else if (getVal(root, 'tq_kn') === 'n') {
        const prefixName = getVal(root, 'tq_tru') === 'dac' ? 'đặc' : 'dẻo';
        const suffix = nt > 0 ? ' ' + Array.from({ length: nt }, (_, i) => `T${i + 1}`).join(', ') : '';
        G.push({ g: 'tru', t: `Kiểm toán trụ ${prefixName}${suffix}`, na: true, subs: [] });
      }
    }
    if (om !== 'tru' && ikOn('qd')) {
      G.push({ g: 'qd', t: 'Kiểm toán bản quá độ', subs: [] });
    }
    return G;
  };

  return {
    supK,
    ltnOn,
    mdOn,
    sfmOn,
    trOn,
    dcOn,
    sfdOn,
    sctSep,
    sctNm,
    sctSheetNm,
    objMode,
    objOn,
    itList,
    kcpdG,
  };
}

const PILE_BAR_AREA: Readonly<Record<number, number>> = {
  10: 78.5,
  12: 113.1,
  14: 154,
  16: 201,
  18: 254.5,
  20: 314,
  22: 380.1,
  25: 491,
  28: 616,
  32: 804,
};

function computeCurvePoints(S: Pm3dSectionInput, phc: number, pht: number): PmChartCurveData {
  const pts: PmChartCurvePoint[] = [
    { Pn: (-S.fy * S.As) / 1000, Mn: 0, phi: pht, P: (-pht * S.fy * S.As) / 1000, M: 0 },
  ];
  const R = S.R;
  const dt = S.bars.length ? R - Math.min(...S.bars.map((b) => b.y)) : S.D;

  for (const r of CDL) {
    const c = r * S.D;
    const a = Math.min(S.b1 * c, S.D);
    const th = 2 * Math.acos(Math.max(-1, Math.min(1, (R - a) / R)));
    let P = (S.a1 * S.fc * R * R * (th - Math.sin(th))) / 2;
    let M = ((S.a1 * S.fc * 2) / 3) * R ** 3 * Math.sin(th / 2) ** 3;
    for (const b of S.bars) {
      const d = R - b.y;
      const e = (0.003 * (c - d)) / c;
      let fs = Math.max(-S.fy, Math.min(S.fy, S.Es * e));
      if (d < a && e > 0) fs -= S.a1 * S.fc;
      P += fs * b.a;
      M += fs * b.a * b.y;
    }
    const et = (0.003 * (dt - c)) / c;
    const denom = S.etl - S.ecl;
    const rawPhi = Math.abs(denom) > 1e-12 ? phc + ((pht - phc) * (et - S.ecl)) / denom : phc;
    const phi = Math.min(pht, Math.max(phc, rawPhi));
    const Pn = P / 1000;
    const Mn = M / 1e6;
    pts.push({ Pn, Mn, phi, P: phi * Pn, M: phi * Mn });
  }
  return { cap: phc * S.kP * S.Po, pts };
}

function buildFallbackPmChartFromDom(root: ParentNode): PmChartExportData {
  const D = Math.max(100, getNum(root, 'D', 1000));
  const R = D / 2;
  const bars: Array<{ x: number; y: number; a: number }> = [];
  let As = 0;
  for (let L = 1; L <= 3; L++) {
    const n = Math.round(getNum(root, `n${L}`, L === 1 ? 16 : 0));
    const d = getNum(root, `d${L}`, L === 1 ? 25 : 0);
    const c = getNum(root, `c${L}`, 100);
    if (n > 0 && d > 0) {
      const a = PILE_BAR_AREA[d] ?? (Math.PI * d * d) / 4;
      As += n * a;
      for (let i = 0; i < n; i++) {
        const t = ((90 - (360 * i) / n) * Math.PI) / 180;
        bars.push({ x: (R - c) * Math.cos(t), y: (R - c) * Math.sin(t), a });
      }
    }
  }
  const fc = Math.max(10, getNum(root, 'fc', 30));
  const fy = Math.max(100, getNum(root, 'fy', 400));
  const Es = 200000;
  const Ac = Math.PI * R * R;
  const a1 = Math.min(0.85, Math.max(0.75, 0.85 - (0.02 * (fc - 69)) / 7));
  const b1 = Math.min(0.85, Math.max(0.65, 0.85 - (0.05 * (fc - 28)) / 7));
  const lin = (x: number, xs: number[], ys: number[]) => {
    if (x <= xs[0]) return ys[0];
    for (let i = 0; i < xs.length - 1; i++) {
      if (x <= xs[i + 1]) return ys[i] + ((x - xs[i]) * (ys[i + 1] - ys[i])) / (xs[i + 1] - xs[i]);
    }
    return ys[ys.length - 1];
  };
  const ecl = fy <= 414 ? fy / Es : lin(fy, [414, 517, 552, 690], [0.002, 0.0028, 0.003, 0.004]);
  const etl = lin(fy, [517, 690], [0.005, 0.008]);
  const kP = getVal(root, 'tie') === 'T' ? 0.8 : 0.85;
  const Po = (a1 * fc * (Ac - As) + fy * As) / 1000;
  const sec: Pm3dSectionInput = { D, R, bars, As, fc, fy, Es, a1, b1, ecl, etl, kP, Po };

  const phic = getNum(root, 'phic', 0.75);
  const phit = getNum(root, 'phit', 0.9);
  const phicE = getNum(root, 'phicE', 1.0);
  const phitE = getNum(root, 'phitE', 1.0);

  return {
    cd: computeCurvePoints(sec, phic, phit),
    db: computeCurvePoints(sec, phicE, phitE),
  };
}

/**
 * Construct an ExcelJS workbook + layout metadata (`METAS`) ready for `.xlsx` download and
 * byte-identical `.pdf` replay (`18_appmode_export_xlsx_pdf.js:342-1351`).
 */
export async function buildWB(options: BuildWorkbookOptions = {}): Promise<BuildWorkbookResult> {
  if (options.onPrepareAll) {
    await options.onPrepareAll();
  }

  const root: ParentNode =
    options.documentRoot ?? (typeof document !== 'undefined' ? document : ({} as ParentNode));
  const def = createDefaultResolvers(root);
  const R: Required<BuildWorkbookResolvers> = { ...def, ...(options.resolvers ?? {}) };

  const rawMode =
    options.mode ??
    (getVal(root, 'appMode') as AppMode | '') ??
    'cau';
  const APPMODE = normalizeAppMode(rawMode);

  const wb = new WorkbookCtor();
  wb.creator = '';
  const METAS: WorkbookMeta[] = [];
  const usedSheetNames = new Set<string>();

  const MG: WorkbookMargins = { ...DEFAULT_MG };
  const widths = [...BASE_WIDTHS];
  const NC = widths.length;
  const contentPt = widths.reduce((t, w) => t + w * 7 + 5, 0) * 0.75;
  const scale = Math.min(100, Math.floor((((PW_IN - MG.left - MG.right) * 72) / contentPt) * 100));

  const pane = (id: string): HTMLElement | null => getEl(root, id);
  const PROJ = 'querySelector' in root ? root.querySelector<HTMLElement>('.proj') : null;

  const supTitle = R.supK() ? '4. Ke dam tren mo tru' : '4. Goi cau';
  const rawBridgeSheets: Array<[string, HTMLElement | null]> = [
    ['0. Tong quan', pane('tab7')],
    ['1. Dam giua', pane('tab8')],
    ['2. Dam bien', pane('tab9')],
    ['3. Ban mat cau', pane('tab10')],
    [supTitle, pane('tab11')],
    ['5. Ban lien tuc nhiet', pane('tab12')],
    ['6. Khe co gian', pane('tab13')],
    ['7. Go lan can', pane('tab14')],
    ['6. Tai trong mo', pane('tab4')],
    ['7. KT mat cat mo', pane('tab5')],
    ...(R.sfmOn()
      ? ([
          ['8. Nen mong nong', pane('tab52')],
          ['9. KT be mong', pane('tab6')],
        ] as Array<[string, HTMLElement | null]>)
      : ([
          ['8. Noi luc dau coc', pane('tab1')],
          [R.mdOn() ? '9. KT be mo' : '9. KT be coc', pane('tab6')],
          [
            R.sctSep()
              ? R.sctSheetNm('10. SCT coc mo ', R.sctNm('tq_mo', ['M1', 'M2'])[0])
              : '10. SCT theo dat nen',
            pane('tab2'),
          ],
          ...(R.sctSep()
            ? ([
                [
                  R.sctSheetNm('10. SCT coc mo ', R.sctNm('tq_mo', ['M1', 'M2'])[1]),
                  pane('tab56'),
                ],
              ] as Array<[string, HTMLElement | null]>)
            : []),
          ['11. KT coc vat lieu', pane('tab3')],
        ] as Array<[string, HTMLElement | null]>)),
    ...(R.trOn()
      ? ([
          ['14. Tai trong tru', pane('tab20')],
          ['15. Noi luc tru', pane('tab21')],
          ['16. KT xa mu giang', pane('tab22')],
          ['17. KT than tru', pane('tab26')],
          ['18. Noi luc coc tru', pane('tab23')],
          [
            R.sctSep()
              ? R.sctSheetNm('19. SCT coc tru ', R.sctNm('td_name', ['T1', 'T2'])[0])
              : '19. SCT coc tru',
            pane('tab24'),
          ],
          ...(R.sctSep()
            ? ([
                [
                  R.sctSheetNm('19. SCT coc tru ', R.sctNm('td_name', ['T1', 'T2'])[1]),
                  pane('tab57'),
                ],
              ] as Array<[string, HTMLElement | null]>)
            : []),
          ['20. KT coc tru', pane('tab25')],
        ] as Array<[string, HTMLElement | null]>)
      : []),
    ...(R.dcOn()
      ? ([
          ['14. Tai trong tru', pane('tab20')],
          ['15. KT xa mu tru', pane('tab46')],
          ['16. KT than tru', pane('tab47')],
          ...(R.sfdOn()
            ? ([
                ['17. Nen mong nong tru', pane('tab53')],
                ['18. KT be tru', pane('tab48')],
              ] as Array<[string, HTMLElement | null]>)
            : ([
                ['17. Noi luc coc tru', pane('tab49')],
                ['18. KT be tru', pane('tab48')],
                [
                  R.sctSep()
                    ? R.sctSheetNm('19. SCT coc tru ', R.sctNm('td_name', ['T1', 'T2'])[0])
                    : '19. SCT coc tru',
                  pane('tab50'),
                ],
                ...(R.sctSep()
                  ? ([
                      [
                        R.sctSheetNm('19. SCT coc tru ', R.sctNm('td_name', ['T1', 'T2'])[1]),
                        pane('tab58'),
                      ],
                    ] as Array<[string, HTMLElement | null]>)
                  : []),
                ['20. KT coc tru', pane('tab51')],
              ] as Array<[string, HTMLElement | null]>)),
        ] as Array<[string, HTMLElement | null]>)
      : []),
    [(R.trOn() || R.dcOn() ? '21' : '14') + '. Ban qua do', pane('tab43')],
  ];

  const rawSheetDefs: Array<[string, HTMLElement | null]> =
    APPMODE === 'tl'
      ? [
          ['1. So lieu - tai trong', pane('tab61')],
          ['2. Kiem toan', pane('tab62')],
        ]
      : APPMODE === 'tvc'
        ? [['Thuy van cong', pane('tab70')]]
        : APPMODE === 'tv'
          ? [['Thuy van cau', pane('tab54')]]
          : APPMODE === 'tc'
            ? [
                ['1. So lieu - tai trong', pane('tab41')],
                ['2. Kiem toan', pane('tab42')],
              ]
            : APPMODE === 'ct'
              ? [
                  ['1. So lieu - noi luc', pane('tab18')],
                  ['2. Cot thep - kiem toan', pane('tab19')],
                ]
              : APPMODE === 'ch'
                ? [
                    ['1. So lieu - noi luc', pane('tab15')],
                    ['2. Kiem toan', pane('tab16')],
                    ['3. Kiem toan nen mong', pane('tab44')],
                    ['PL1. He so nen', pane('tab17')],
                  ]
                : rawBridgeSheets;

  const SHEETS: Array<[string, HTMLElement]> = rawSheetDefs
    .filter((pair): pair is [string, HTMLElement] => {
      const p = pair[1];
      if (!p) return false;
      if (APPMODE !== 'cau') return true;
      const tabNum = Number(p.id.slice(3));
      return (
        R.objOn(tabNum) &&
        (p.id !== 'tab12' || R.ltnOn()) &&
        Array.from(p.children).some(
          (e) => !e.classList.contains('noprint') && !e.classList.contains('ttl'),
        )
      );
    })
    .map(([nm, p], idx): [string, HTMLElement] => [nm.replace(/^\d+\./, `${idx}.`), p]);

  const activeScope =
    options.scope ??
    (getVal(root, 'expScope') === 'one' ? 'one' : 'all');

  const ONE =
    activeScope === 'one'
      ? options.activeTabId != null
        ? { id: `tab${String(options.activeTabId).replace(/^tab/, '')}` }
        : resolveOpenTabInfo({ scope: 'one', documentRoot: root })
      : null;

  if (ONE) {
    const keep = SHEETS.filter(([, p]) => p.id === ONE.id);
    if (!keep.length) {
      throw new Error('Tab đang mở không có nội dung để xuất.');
    }
    SHEETS.splice(0, SHEETS.length, ...keep.map(([nm, p]): [string, HTMLElement] => [nm.replace(/^\d+\.\s*/, ''), p]));
  }

  const rawNg = options.dividerMode ?? Number(getVal(root, 'tq_ngan') || '0');
  const NG: DividerMode = ONE ? 0 : rawNg === 2 ? 2 : rawNg === 1 ? 1 : 0;
  const hasSheet = (id: string) => SHEETS.some(([, p]) => p.id === id);

  interface DividerSpec {
    div: [string, string];
    list: string[];
    name: string;
  }
  interface SheetSpec {
    sheet: [string, HTMLElement];
    els?: Element[];
  }
  type PlanEntry = DividerSpec | SheetSpec;

  const PLAN: PlanEntry[] = [];
  const supItems = (
    [
      ['tab8', 'KIỂM TOÁN DẦM GIỮA'],
      ['tab9', 'KIỂM TOÁN DẦM BIÊN'],
      ['tab10', 'KIỂM TOÁN BẢN MẶT CẦU'],
      ['tab11', R.supK() ? 'KIỂM TOÁN KÊ DẦM TRÊN MỐ, TRỤ' : 'KIỂM TOÁN GỐI CẦU'],
      ['tab12', 'KIỂM TOÁN BẢN LIÊN TỤC NHIỆT'],
      ['tab13', 'TÍNH TOÁN KHE CO GIÃN'],
      ['tab14', 'KIỂM TOÁN GỜ LAN CAN'],
    ] as const
  ).filter(([id]) => hasSheet(id));

  const ITL = R.itList();
  const SUBG = R.kcpdG()
    .filter((g) => !g.na)
    .map((g) => {
      const ids = new Set(ITL.filter((x) => x[1] === g.g).flatMap((x) => x[3].map((n) => `tab${n}`)));
      const found = SHEETS.find(([, p]) => ids.has(p.id));
      return { ...g, first: found ? found[1].id : null };
    })
    .filter((g): g is { g: string; t: string; na?: boolean; subs: string[]; first: string } => !!g.first);

  const sub0 = SUBG.length ? SUBG[0].first : null;

  for (const sh of SHEETS) {
    const id = sh[1].id;
    if (id === 'tab7') {
      const ch = Array.from(sh[1].children);
      const k = ch.findIndex((e) => e.tagName === 'H2');
      if (k > 0) {
        PLAN.push({ sheet: ['0. Muc luc', sh[1]], els: ch.slice(0, k) });
        if (NG) {
          PLAN.push({
            div: ['PHẦN I', 'TỔNG QUAN'],
            list: [
              '1. Tổng quan',
              '2. Tiêu chuẩn thiết kế',
              '3. Cơ sở tính toán',
              '4. Kích thước kết cấu',
            ],
            name: 'Ngan I',
          });
        }
        PLAN.push({ sheet: ['0. Tong quan', sh[1]], els: ch.slice(k) });
        continue;
      }
    }
    if (NG && id === supItems[0]?.[0]) {
      PLAN.push({
        div: ['PHẦN II', 'KẾT CẤU PHẦN TRÊN'],
        list: supItems.map(([, t], i) => `${i + 1}. ${t.charAt(0)}${t.slice(1).toLowerCase()}`),
        name: 'Ngan II',
      });
    }
    if (NG === 2) {
      const idx = supItems.findIndex(([x]) => x === id);
      if (idx >= 0) {
        PLAN.push({ div: [`II.${idx + 1}`, supItems[idx][1]], list: [], name: `Ngan II.${idx + 1}` });
      }
    }
    if (NG && id === sub0) {
      PLAN.push({
        div: ['PHẦN III', 'KẾT CẤU PHẦN DƯỚI'],
        list: SUBG.map((g, k) => `${k + 1}. ${g.t}`),
        name: 'Ngan III',
      });
    }
    if (NG === 2) {
      const gi = SUBG.findIndex((g) => g.first === id);
      if (gi >= 0) {
        PLAN.push({
          div: [`III.${gi + 1}`, SUBG[gi].t.toUpperCase()],
          list: SUBG[gi].subs.map((x, j) => `${gi + 1}.${j + 1}. ${x}`),
          name: `Ngan III.${gi + 1}`,
        });
      }
    }
    PLAN.push({ sheet: sh });
  }

  const addDiv = (D: DividerSpec) => {
    const safeName = sanitizeSheetName(D.name, usedSheetNames);
    const ws = wb.addWorksheet(safeName, {
      views: [{ style: 'pageBreakPreview', zoomScale: 100, zoomScaleNormal: 100, showGridLines: false }],
      pageSetup: {
        paperSize: 9,
        orientation: 'portrait',
        fitToPage: false,
        scale,
        horizontalCentered: true,
        margins: MG,
      },
    });
    widths.forEach((w, i) => {
      ws.getColumn(i + 1).width = w;
    });
    let r = 1;
    const lines = PROJ ? Array.from(PROJ.querySelectorAll<HTMLElement>('p[data-fmt]')) : [];
    lines.forEach((p) => {
      const inp = p.querySelector<HTMLInputElement>('input');
      if (!inp || inp.id === 'pj4') return;
      const v = inp.value.trim().toUpperCase();
      ws.mergeCells(r, 1, r, NC);
      const c = ws.getCell(r, 1);
      c.value = (p.dataset.fmt ?? '{v}').replace('{v}', v);
      c.font = { name: 'Arial', size: 11, color: { argb: 'FF000000' } };
      c.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.getRow(r).height = 20;
      for (let j = 1; j <= NC; j++) {
        ws.getCell(r, j).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCFFFF' } };
      }
      r += 1;
    });
    if (r > 1) {
      for (let j = 1; j <= NC; j++) {
        ws.getCell(r - 1, j).border = { bottom: { style: 'double', color: { argb: 'FF0000FF' } } };
      }
    }
    const HEADROWS = r - 1;
    const titleH = HEADROWS * 20;
    const avail = ((PH_IN - MG.top - MG.bottom) * 72) / (scale / 100) - titleH;
    const body = [
      ...D.div.map((t, i) => ({ t, size: i ? 18 : 14, bold: true, h: i ? 34 : 24, left: false })),
      ...(D.list.length ? [{ t: '', size: 11, bold: false, h: 16, left: false }] : []),
      ...D.list.map((t) => ({ t, size: 12, bold: false, h: 20, left: true })),
    ];
    const bh = body.reduce((a, b) => a + b.h, 0);
    ws.getRow(r).height = Math.min(409, Math.max(20, (avail - bh) / 2));
    r += 1;
    const lc = 5;
    body.forEach((b) => {
      ws.mergeCells(r, b.left ? lc : 1, r, NC);
      const c = ws.getCell(r, b.left ? lc : 1);
      c.value = b.t;
      c.font = { name: FONT_NAME, size: b.size, bold: !!b.bold };
      c.alignment = { horizontal: b.left ? 'left' : 'center', vertical: 'middle', wrapText: true };
      ws.getRow(r).height = b.h;
      r += 1;
    });
    ws.pageSetup.printArea = `A1:${colLetter(NC)}${r - 1}`;
    METAS.push({
      name: safeName,
      ws,
      scale,
      widths: [...widths],
      imgs: [],
      breaks: new Set(),
      foot: '',
      HEADROWS: 0,
      last: r - 1,
      MG,
      divider: true,
    });
  };

  let mc2d: CanvasRenderingContext2D | null = null;
  if (typeof document !== 'undefined') {
    try {
      const cv = document.createElement('canvas');
      mc2d = typeof cv.getContext === 'function' ? cv.getContext('2d') : null;
    } catch {
      mc2d = null;
    }
  }

  for (const PL of PLAN) {
    if ('div' in PL) {
      addDiv(PL);
      continue;
    }

    const [rawSheetName, PANE] = PL.sheet;
    const SHEETNAME = sanitizeSheetName(rawSheetName, usedSheetNames);
    const ws = wb.addWorksheet(SHEETNAME, {
      views: [{ style: 'pageBreakPreview', zoomScale: 100, zoomScaleNormal: 100, showGridLines: false }],
      pageSetup: {
        paperSize: 9,
        orientation: 'portrait',
        fitToPage: false,
        scale,
        horizontalCentered: true,
        margins: MG,
      },
    });

    const SUPT = ['tab8', 'tab9', 'tab10', 'tab11', 'tab12', 'tab13', 'tab14'].includes(PANE.id);
    const FOOT =
      PANE.id === 'tab7'
        ? 'Tổng quan'
        : SUPT
          ? getVal(root, 'sp_hm')
          : getVal(root, 'pj4');

    ws.headerFooter = {
      oddFooter:
        '&L&"Times New Roman,Italic"&9' +
        FOOT.replace(/&/g, '&&') +
        '&R&"Times New Roman"&9Trang &P/&N',
    };

    widths.forEach((w, i) => {
      ws.getColumn(i + 1).width = w;
    });
    const colPx = widths.map((w) => Math.round(w * 7 + 5));
    const totPx = colPx.reduce((a, b) => a + b, 0);

    const TW = (t: string, pt: number, bold: boolean): number => {
      if (mc2d) {
        mc2d.font = `${bold ? 'bold ' : ''}${(pt * 4) / 3}px 'Times New Roman',Tinos,serif`;
        return mc2d.measureText(t).width * 1.005;
      }
      return String(t).length * pt * 0.72 * (bold ? 1.05 : 1);
    };

    const pxW = (c1: number, n: number): number =>
      widths
        .concat(Array<number>(60).fill(6.5))
        .slice(c1 - 1, c1 - 1 + n)
        .reduce((t, w) => t + Math.round(w * 7 + 5), 0) - 6;

    const NL = (t: string, px: number, pt: number, bold: boolean): number => {
      const effPx = Math.max(12, px);
      let n = 0;
      String(t)
        .split(/\n/)
        .forEach((par) => {
          let ln = '';
          n += 1;
          for (const w of par.split(/\s+/)) {
            const s2 = ln ? `${ln} ${w}` : w;
            if (ln && TW(s2, pt, bold) > effPx) {
              n += 1;
              ln = w;
            } else {
              ln = s2;
            }
            const ww = TW(ln, pt, bold);
            if (ww > effPx) {
              n += Math.ceil(ww / effPx) - 1;
              ln = '';
            }
          }
        });
      return Math.max(1, n);
    };

    const imgCol = (W: number): number => {
      let off = Math.max(0, (totPx - W) / 2);
      let i = 0;
      while (i < colPx.length - 1 && off >= colPx[i]) {
        off -= colPx[i];
        i += 1;
      }
      return i + off / colPx[i];
    };

    const tblCol = (n: number): number => {
      let best = 1;
      let bd = 1e9;
      for (let c = 1; c <= NC - n + 1; c++) {
        const L = widths.slice(0, c - 1).reduce((a, b) => a + b, 0);
        const Rw = widths.slice(c - 1 + n).reduce((a, b) => a + b, 0);
        if (Math.abs(L - Rw) < bd) {
          bd = Math.abs(L - Rw);
          best = c;
        }
      }
      return best;
    };

    const thin: Border = { style: 'thin', color: { argb: 'FF9AA3A9' } };
    const box: Partial<Borders> = { top: thin, left: thin, bottom: thin, right: thin };
    const IN: Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF99' } };
    const HD: Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBE5F1' } };
    const GR: Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };

    let r = 1;
    const blocks: WorkbookBlock[] = [];
    let HEADROWS = 0;
    const EQQ: Array<{ svg: SVGElement; row: number; hPt: number; W: number; H: number }> = [];
    const META: WorkbookMeta = {
      name: SHEETNAME,
      ws,
      scale,
      widths: [...widths],
      imgs: [],
      breaks: new Set<number>(),
      foot: FOOT,
      HEADROWS: 0,
      last: 1,
      MG,
    };
    METAS.push(META);

    const tblSpans = (el: HTMLTableElement, ncol: number): number[] => {
      const cp = totPx / NC;
      const mx = Array<number>(ncol).fill(0);
      Array.from(el.rows).forEach((tr) => {
        let ci = 0;
        Array.from(tr.cells).forEach((td) => {
          const cs = td.colSpan || 1;
          if (cs === 1 && ci < ncol) {
            const t = cellText(td);
            mx[ci] = Math.max(
              mx[ci],
              td.tagName === 'TH'
                ? Math.max(...t.split(/\s+/).map((w) => TW(w, 10, true)))
                : TW(t, 10, false),
            );
          }
          ci += cs;
        });
      });
      const sp = mx.map((w) => Math.max(1, Math.min(7, Math.ceil((w + 10) / (cp * 1.15)))));
      while (sp.reduce((a, b) => a + b, 0) > NC) {
        const i = sp.indexOf(Math.max(...sp));
        if (sp[i] <= 1) break;
        sp[i] -= 1;
      }
      return sp;
    };

    const addImg = (
      b64: string,
      tl: { col: number; row: number },
      ext: { width: number; height: number },
    ) => {
      const id = wb.addImage({ base64: b64, extension: 'png' });
      ws.addImage(id, { tl, ext });
      META.imgs.push({ b64, tl, ext });
    };

    interface PutOpts {
      text?: boolean;
      bold?: boolean;
      italic?: boolean;
      color?: string;
      input?: boolean;
      fill?: Fill | null;
      border?: boolean;
      h?: Alignment['horizontal'];
      wrap?: boolean;
    }

    const put = (row: number, col: number, text: string, o: PutOpts = {}) => {
      const c = ws.getCell(row, col);
      const n = o.text ? null : asNum(text);
      c.value = n ? n.v : text;
      if (n) c.numFmt = n.fmt;
      const font: Partial<Font> = {
        name: FONT_NAME,
        size: 11,
        bold: !!o.bold,
        italic: !!o.italic,
        color: { argb: o.color || (o.input ? 'FF0000FF' : 'FF000000') },
      };
      c.font = font;
      if (o.input) c.fill = IN;
      if (o.fill) c.fill = o.fill;
      if (o.border) c.border = box;
      c.alignment = {
        vertical: 'middle',
        horizontal: o.h ?? (n ? 'right' : 'left'),
        wrapText: !!o.wrap,
      };
      return c;
    };

    const okColor = (t: string): string | null =>
      /^(OK|O\.K\.|ĐẠT|CỌC ĐẠT)/.test(t) || /Check: OK/.test(t) || /^<\s*22/.test(t)
        ? 'FF006B2D'
        : /NG|N\.G\.|KHÔNG ĐẠT|CẦN XÉT/.test(t)
          ? 'FFC00000'
          : null;

    const wrapLong = (row: number, c1: number, c2: number, cell: ExcelJSLib.Cell) => {
      const t = String(cell.value == null ? '' : cell.value);
      const b = !!(cell.font && cell.font.bold);
      const px = pxW(c1, c2 - c1 + 1);
      if (TW(t, 11, b) <= px) return;
      const nl = NL(t, px, 11, b);
      ws.mergeCells(row, c1, row, c2);
      cell.alignment = { ...cell.alignment, wrapText: true, vertical: 'top' };
      ws.getRow(row).height = Math.max(ws.getRow(row).height || 15, 15 * nl);
    };

    const writeRow = (sp: Element[]) => {
      const T = (i: number) => (sp[i] && !sp[i].classList.contains('noprint') ? cellText(sp[i]) : '');
      const no = T(0);
      let lab = T(1);
      const sym = T(2);
      const val = T(3);
      const unit = T(4);
      let note = T(5);

      const mEl = sp[1] ? sp[1].querySelector<SVGElement>('.m svg') : null;
      if (mEl) {
        lab = '';
        const im = eqSize(mEl);
        const hPt = Math.max(15, im.H * 0.75 + 6);
        ws.getRow(r).height = Math.max(ws.getRow(r).height || 15, hPt);
        EQQ.push({ svg: mEl, row: r, hPt, ...im });
      }
      if (note && note.length > 10 && !okColor(note)) {
        lab = lab + (lab ? ' ' : '') + note;
        note = '';
      }
      if (no) put(r, 2, no, { text: true });
      if (lab) {
        const c = put(r, 3, lab, {
          text: true,
          bold: !!(sp[1]?.querySelector('b') && !sp[1]?.querySelector('input')),
        });
        wrapLong(r, 3, sym || val ? 8 : NC, c);
      }
      if (sym) put(r, 9, sym, { italic: true, h: 'right', text: true });
      if (val) {
        const isIn = !!(sp[3] && sp[3].querySelector('input:not([readonly])'));
        put(r, 10, val, { input: isIn, border: isIn, h: 'right' });
      }
      if (unit) put(r, 11, unit, { text: true });
      if (note) {
        note = note.replace(/^Check:\s*/, '');
        const c = put(r, 12, note, { text: true, bold: true });
        c.alignment = { ...c.alignment, shrinkToFit: true };
        const k = okColor(note);
        if (k) c.font = { ...c.font, color: { argb: k } };
        if (note.length > 7) {
          if (!unit) {
            ws.mergeCells(r, 11, r, 12);
            const m = ws.getCell(r, 11);
            m.value = note;
            m.font = c.font;
            m.alignment = { wrapText: true, vertical: 'middle' };
            ws.getRow(r).height = Math.max(
              ws.getRow(r).height || 15,
              15 * NL(note, pxW(11, 2), 11, true),
            );
          } else {
            c.alignment = { wrapText: true, vertical: 'middle' };
            ws.getRow(r).height = Math.max(
              ws.getRow(r).height || 15,
              15 * NL(note, pxW(12, 1), 11, true),
            );
          }
        }
      }
      r += 1;
    };

    const isHeadRow = (el: Element): boolean =>
      el.classList.contains('row') &&
      !el.classList.contains('f') &&
      !el.children[3] &&
      !el.children[2];

    const flattenEls = (els: Element[]): Element[] =>
      els.flatMap((e) => {
        const he = e as HTMLElement;
        const hiddenSection =
          (APPMODE === 'tc' ||
            /^(chn_|qd_|mn_|md_|dc_|tdo_|hv_|tl_|o_tl_|tvc_|o_tvc_|kdK$)/.test(e.id || '')) &&
          he.style &&
          he.style.display === 'none';
        if (hiddenSection) return [];
        const unwrapDiv =
          e.tagName === 'DIV' &&
          !e.className &&
          ((APPMODE === 'tc' && /^tc_/.test(e.id)) ||
            /^(chn_|qd_|mn_|md_|dc_|tdo_|hv_|tl_|o_tl_|tvc_|o_tvc_|kdK$)/.test(e.id || ''));
        if (unwrapDiv) return flattenEls(Array.from(e.children));
        return [e];
      });

    const inputEls: Element[] = [
      ...(PROJ ? [PROJ] : []),
      ...(PL.els ? PL.els : Array.from(PANE.children)),
    ];

    for (const el of flattenEls(inputEls)) {
      const start = r;
      let glue: boolean | '__done' = false;
      if (el.classList.contains('noprint')) continue;

      if (el.classList.contains('proj')) {
        const lines = Array.from(el.querySelectorAll<HTMLElement>('p[data-fmt]'));
        lines.forEach((p, i) => {
          const inp = p.querySelector<HTMLInputElement>('input');
          if (!inp) return;
          const v = (
            inp.id === 'pj4' && PANE.id === 'tab7'
              ? 'TỔNG QUAN'
              : inp.id === 'pj4' && SUPT
                ? getVal(root, 'sp_hm')
                : inp.value
          )
            .trim()
            .toUpperCase();
          ws.mergeCells(r, 1, r, NC);
          const c = ws.getCell(r, 1);
          c.value = (p.dataset.fmt ?? '{v}').replace('{v}', v);
          c.font = { name: 'Arial', size: 11, color: { argb: 'FF000000' } };
          c.alignment = { horizontal: 'center', vertical: 'middle' };
          ws.getRow(r).height = 20;
          for (let j = 1; j <= NC; j++) {
            const cc = ws.getCell(r, j);
            cc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCFFFF' } };
            cc.border =
              i === lines.length - 1
                ? { bottom: { style: 'double', color: { argb: 'FF0000FF' } } }
                : {};
          }
          r += 1;
        });
        ws.getRow(r).height = 9;
        HEADROWS = r;
        ws.pageSetup.printTitlesRow = `1:${HEADROWS}`;
        r += 1;
        continue;
      }

      if (el.classList.contains('mcoc')) continue;

      if (el.classList.contains('tqtoc')) {
        for (const ch of Array.from(el.children)) {
          const t = cellText(ch);
          if (!t) continue;
          const s0 = r;
          if (ch.tagName === 'H2') put(r, 2, t, { bold: true, text: true });
          else put(r, ch.classList.contains('sub') ? 4 : 3, t, { text: true });
          r += 1;
          blocks.push({ s: s0, e: r - 1, glue: ch.tagName === 'H2' });
        }
        r += 1;
        continue;
      }

      if (el.classList.contains('tqbox')) {
        const ta = el.querySelector<HTMLTextAreaElement>('textarea');
        const lines = (ta?.value ?? '')
          .split(/\r?\n/)
          .map((x) => x.trim())
          .filter(Boolean);
        for (const line of lines) {
          const s0 = r;
          const c = put(r, 3, line, { text: true });
          const px = pxW(3, NC - 2);
          if (TW(line, 11, false) > px) {
            ws.mergeCells(r, 3, r, NC);
            c.alignment = { ...c.alignment, wrapText: true, vertical: 'top' };
            ws.getRow(r).height = 15 * NL(line, px, 11, false);
          }
          r += 1;
          blocks.push({ s: s0, e: r - 1, glue: false });
        }
        continue;
      }

      if (el.classList.contains('ttl')) {
        ws.mergeCells(r, 1, r, NC);
        const c = ws.getCell(r, 1);
        c.value = cellText(el);
        c.font = { name: FONT_NAME, size: 13, bold: true };
        c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        ws.getRow(r).height = String(c.value).length > 62 ? 38 : 22;
        ws.getRow(r + 1).height = 6;
        r += 2;
        blocks.push({ s: start, e: r - 1, glue: true });
        continue;
      }

      if (/^H[123]$/.test(el.tagName) || el.tagName === 'P') {
        const t = cellText(el);
        if (!t) continue;
        if (
          el.tagName === 'P' &&
          (/^(Hình|Bảng)\s+\d+[a-z]?\s*[-–.:]/.test(t) ||
            (/^Bảng\s/.test(t) && !!el.nextElementSibling && el.nextElementSibling.tagName === 'TABLE'))
        ) {
          const c = put(r, 1, t, { text: true, italic: el.classList.contains('small') });
          ws.mergeCells(r, 1, r, NC);
          c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
          const nl = NL(t, pxW(1, NC), 11, false);
          ws.getRow(r).height = Math.max(ws.getRow(r).height || 15, 15 * nl);
          r += 1;
          blocks.push({ s: start, e: r - 1, glue: /^Bảng/.test(t) });
          continue;
        }
        const isH = el.tagName !== 'P';
        const col = el.tagName === 'H1' || el.tagName === 'H2' ? 2 : 3;
        const c = put(r, col, t, {
          bold: isH,
          text: true,
          italic: el.classList.contains('small') && !el.querySelector('input'),
        });
        const k = okColor(t);
        if (k && el.id) c.font = { ...c.font, color: { argb: k }, bold: true };
        wrapLong(r, col, NC, c);
        r += 1;
        glue =
          isH ||
          /Result (diagram|table)/.test(t) ||
          (el.classList.contains('small') && /^(Mặt tương tác|Khi mở)/.test(t));
      } else if (el.tagName === 'HR') {
        r += 1;
      } else if (el.classList.contains('row')) {
        writeRow(Array.from(el.children));
        glue = isHeadRow(el) || /Toạ độ|Mặt cắt ngang|Xác định β/.test(cellText(el));
      } else if (/^(T_|C_)?bt$/.test(el.id) || el.classList.contains('rows')) {
        for (const rowEl of Array.from(el.querySelectorAll('.row'))) {
          writeRow(Array.from(rowEl.children));
        }
      } else if (el.tagName === 'TABLE') {
        const tbl = el as HTMLTableElement;
        if (!tbl.rows.length) continue;
        const occ0: Record<string, 1> = {};
        let ncol = 0;
        Array.from(tbl.rows).forEach((tr, ri) => {
          let ci = 0;
          Array.from(tr.cells).forEach((td) => {
            while (occ0[`${ri},${ci}`]) ci += 1;
            const rs = td.rowSpan || 1;
            const cs = td.colSpan || 1;
            for (let a = 0; a < rs; a++) {
              for (let b = 0; b < cs; b++) occ0[`${ri + a},${ci + b}`] = 1;
            }
            ci += cs;
            ncol = Math.max(ncol, ci);
          });
        });

        const SP = ncol <= 5 ? tblSpans(tbl, ncol) : Array<number>(ncol).fill(1);
        const PRE = SP.map((_, j) => SP.slice(0, j).reduce((a, b) => a + b, 0));
        const TOT = SP.reduce((a, b) => a + b, 0);
        const occ: Record<string, 1> = {};
        const WIDE = ncol >= NC;
        const c0 = WIDE ? 1 : tblCol(Math.min(TOT, NC));
        let maxR = 0;
        if (WIDE) META.xc = Math.max(META.xc ?? 0, ncol + 1 - NC);

        const colOf = (j: number) => (WIDE ? (j === 0 ? 1 : j + 2) : c0 + PRE[Math.min(j, ncol - 1)]);
        const endOf = (j: number) =>
          WIDE
            ? j === 0
              ? 2
              : j + 2
            : c0 + PRE[Math.min(j, ncol - 1)] + SP[Math.min(j, ncol - 1)] - 1;

        Array.from(tbl.rows).forEach((tr, ri) => {
          let ci = 0;
          Array.from(tr.cells).forEach((td) => {
            while (occ[`${ri},${ci}`]) ci += 1;
            const rs = td.rowSpan || 1;
            const cs = td.colSpan || 1;
            const t = cellText(td);
            const isH = td.tagName === 'TH';
            const grp = tr.classList.contains('grp');
            const isIn = !!td.querySelector('input');
            const CI = colOf(ci);
            const CS = endOf(ci + cs - 1) - CI + 1;

            const c = put(r + ri, CI, t, {
              bold: isH || grp,
              border: true,
              fill: isH ? HD : grp ? GR : null,
              input: isIn,
              h:
                isH || td.classList.contains('c')
                  ? 'center'
                  : td.classList.contains('l') || grp
                    ? 'left'
                    : undefined,
              wrap: isH,
            });
            c.font = { ...c.font, size: 10 };
            if (!isH && CS === 1) {
              if (!isIn && TW(t, 10, !!c.font.bold) > pxW(CI, 1)) {
                c.alignment = { ...c.alignment, wrapText: true, vertical: 'middle' };
                ws.getRow(r + ri).height = Math.max(
                  ws.getRow(r + ri).height || 15,
                  13 * NL(t, pxW(CI, 1), 10, !!c.font.bold) + 3,
                );
              } else {
                c.alignment = { ...c.alignment, shrinkToFit: true };
              }
            }
            const k = td.classList.contains('ok')
              ? 'FF006B2D'
              : td.classList.contains('bad')
                ? 'FFC00000'
                : null;
            if (k) c.font = { ...c.font, color: { argb: k }, bold: true };
            for (let a = 0; a < rs; a++) {
              for (let b = 0; b < cs; b++) occ[`${ri + a},${ci + b}`] = 1;
            }
            for (let a = 0; a < rs; a++) {
              for (let b = 0; b < CS; b++) {
                if (a || b) {
                  const cc = ws.getCell(r + ri + a, CI + b);
                  cc.border = box;
                  if (isH) cc.fill = HD;
                  if (grp) cc.fill = GR;
                }
              }
            }
            if (rs > 1 || CS > 1) ws.mergeCells(r + ri, CI, r + ri + rs - 1, CI + CS - 1);
            if (isH && rs === 1 && TW(t, 10, true) > pxW(CI, CS)) {
              ws.getRow(r + ri).height = Math.max(
                ws.getRow(r + ri).height || 15,
                13 * NL(t, pxW(CI, CS), 10, true) + 4,
              );
            }
            if (!isH && CS > 1 && rs === 1) {
              const px = pxW(CI, CS);
              if (TW(t, c.font.size || 10, !!c.font.bold) > px) {
                c.alignment = { ...c.alignment, wrapText: true, vertical: 'middle' };
                ws.getRow(r + ri).height = Math.max(
                  ws.getRow(r + ri).height || 15,
                  13 * NL(t, px, c.font.size || 10, !!c.font.bold) + 3,
                );
              }
            }
            ci += cs;
            maxR = Math.max(maxR, ri + rs);
          });
        });

        for (let i = 0; i < maxR; i++) {
          if (!ws.getRow(r + i).height) ws.getRow(r + i).height = 15;
        }
        ws.getRow(r + maxR).height = 6;
        r += maxR + 1;

        if (maxR > 6) {
          const okRows = Array<boolean>(maxR + 1).fill(true);
          const occ2: Record<string, 1> = {};
          Array.from(tbl.rows).forEach((tr, ri) => {
            let ci = 0;
            Array.from(tr.cells).forEach((td) => {
              while (occ2[`${ri},${ci}`]) ci += 1;
              const rs = td.rowSpan || 1;
              const cs = td.colSpan || 1;
              for (let a = 0; a < rs; a++) {
                for (let b = 0; b < cs; b++) occ2[`${ri + a},${ci + b}`] = 1;
              }
              for (let a = 1; a < rs; a++) okRows[ri + a] = false;
              ci += cs;
            });
          });
          let nh = 0;
          while (nh < tbl.rows.length && Array.from(tbl.rows[nh].cells).some((c) => c.tagName === 'TH')) {
            nh += 1;
          }
          let s0 = start;
          const k = nh + 2;
          for (let i = k; i < maxR; i++) {
            if (okRows[i]) {
              blocks.push({ s: s0, e: start + i - 1, glue: s0 === start && !!glue });
              s0 = start + i;
            }
          }
          blocks.push({ s: s0, e: r - 1, glue: false });
          glue = '__done';
        }
      } else if (el.classList.contains('p3wrap')) {
        if (!options.st3 && !options.renderPlotlyImage) continue;
        for (const st of ['CD', 'DB'] as const) {
          const s0 = r;
          try {
            const W = 600;
            const H = 450;
            const b64 = options.renderPlotlyImage
              ? await options.renderPlotlyImage(st, W, H, 2)
              : await exportPlot3dPng(options.st3!, st, W, H, 2);
            addImg(b64, { col: imgCol(W), row: r - 1 }, { width: W, height: H });
            r += Math.ceil(H / 20) + 1;
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            put(r, 3, `(Không xuất được hình 3D: ${msg})`, { text: true, italic: true });
            r += 1;
          }
          blocks.push({ s: s0, e: r - 1, glue: false });
        }
        continue;
      } else if (el.tagName === 'IMG') {
        const imgEl = el as HTMLImageElement;
        const W0 = Number(imgEl.getAttribute('width')) || imgEl.naturalWidth || 400;
        const H0 = Number(imgEl.getAttribute('height')) || imgEl.naturalHeight || 300;
        const kk = Math.min(1, 640 / W0);
        const W = Math.round(W0 * kk);
        const H = Math.round(H0 * kk);
        try {
          const cv = document.createElement('canvas');
          cv.width = imgEl.naturalWidth || W;
          cv.height = imgEl.naturalHeight || H;
          const x = cv.getContext('2d');
          if (!x) throw new Error('Canvas 2D unavailable');
          x.fillStyle = '#fff';
          x.fillRect(0, 0, cv.width, cv.height);
          x.drawImage(imgEl, 0, 0);
          addImg(cv.toDataURL('image/png'), { col: imgCol(W), row: r - 1 }, { width: W, height: H });
          r += Math.ceil(H / 20);
          ws.getRow(r).height = 6;
          r += 1;
        } catch {
          // Skip bitmap rasterization if headless canvas context is unavailable
        }
      } else if (el.tagName.toLowerCase() === 'svg') {
        const svgEl = el as SVGElement & HTMLElement;
        if (!svgEl.childElementCount || svgEl.style?.display === 'none') continue;
        try {
          const im = await svgPng(svgEl, { rasterize: options.svgRasterizer });
          const pair = svgEl.id === 'dgMo' || svgEl.id === 'dgMoT';
          const kk = Math.min(1, 640 / im.W) * (pair ? 0.9 : 1);
          const W = Math.round(im.W * kk);
          const H = Math.round(im.H * kk);
          if (svgEl.id === 'dgMo') glue = true;
          addImg(im.b64, { col: imgCol(W), row: r - 1 }, { width: W, height: H });
          r += Math.ceil(H / 20);
          ws.getRow(r).height = 6;
          r += 1;
        } catch {
          // Graceful fallback when running in jsdom without 2D canvas
        }
      } else {
        continue;
      }

      if (r > start && glue !== '__done') {
        blocks.push({ s: start, e: r - 1, glue });
      }
    }

    for (const q of EQQ) {
      try {
        const b64 = await eqPng(q.svg, q.W, q.H, { rasterize: options.eqRasterizer });
        const rowPx = q.hPt / 0.75;
        addImg(
          b64,
          { col: 2.35, row: q.row - 1 + Math.max(0, (rowPx - q.H) / 2 / rowPx) },
          { width: q.W, height: q.H },
        );
      } catch {
        // Ignore headless equation raster failures gracefully
      }
    }

    const rowH = (i: number) => ws.getRow(i).height || 15;
    const titleH = Array.from({ length: HEADROWS }, (_, i) => rowH(i + 1)).reduce((a, b) => a + b, 0);
    const avail = (((PH_IN - MG.top - MG.bottom) * 72) / (scale / 100) - titleH) * 0.97;

    const groups: WorkbookGroup[] = [];
    let cur: WorkbookGroup | null = null;
    for (const bk of blocks) {
      if (!cur) cur = { s: bk.s, e: bk.e };
      else cur.e = bk.e;
      if (!bk.glue) {
        groups.push(cur);
        cur = null;
      }
    }
    if (cur) groups.push(cur);
    META.groups = groups;

    let used = 0;
    for (const g of groups) {
      if (g.s <= HEADROWS) continue;
      let h = 0;
      for (let i = g.s; i <= g.e; i++) h += rowH(i);
      if (used > 0 && used + h > avail) {
        ws.getRow(g.s - 1).addPageBreak();
        META.breaks.add(g.s);
        used = 0;
      }
      if (!Number.isFinite(h)) h = 0;
      used += h;
      if (avail > 0 && used > avail) used %= avail;
    }

    for (let i = 1; i < r; i++) {
      if (!ws.getRow(i).height) ws.getRow(i).height = 15;
    }

    const xc = META.xc ?? 0;
    if (xc > 0) {
      const wE = widths.concat(Array<number>(xc).fill(6.5));
      wE.forEach((w, i) => {
        ws.getColumn(i + 1).width = w;
      });
      const cp = wE.reduce((t, w) => t + w * 7 + 5, 0) * 0.75;
      const sc = Math.min(100, Math.floor((((PW_IN - MG.left - MG.right) * 72) / cp) * 100));
      ws.pageSetup.scale = sc;
      META.scale = sc;
      META.widths = wE;
    }

    const lastRow = Math.max(1, r - 1);
    ws.pageSetup.printArea = `A1:${colLetter(NC + xc)}${lastRow}`;
    META.HEADROWS = HEADROWS;
    META.last = lastRow;
    META.MG = MG;
  }

  // Conditional "Bieu do tuong tac" numeric P-M curve sheet in bridge mode
  if (APPMODE === 'cau' && (!ONE || ONE.id === 'tab3')) {
    const pmData = options.buildPmChartData ? options.buildPmChartData() : buildFallbackPmChartFromDom(root);
    if (pmData) {
      const thin: Border = { style: 'thin', color: { argb: 'FF9AA3A9' } };
      const box: Partial<Borders> = { top: thin, left: thin, bottom: thin, right: thin };
      const HD: Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBE5F1' } };
      const ws2 = wb.addWorksheet(sanitizeSheetName('Bieu do tuong tac', usedSheetNames), {
        views: [{ style: 'pageBreakPreview', zoomScale: 100, zoomScaleNormal: 100 }],
        pageSetup: {
          paperSize: 9,
          orientation: 'portrait',
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
          margins: MG,
        },
      });
      const curves: Array<[string, PmChartCurveData]> = [
        ['TTGH Cường độ và Sử dụng', pmData.cd],
        ['TTGH Đặc biệt', pmData.db],
      ];
      curves.forEach(([nm, C], j) => {
        const c0 = 1 + j * 5;
        ws2.getCell(1, c0).value = nm;
        ws2.getCell(1, c0).font = { name: FONT_NAME, bold: true };
        ws2.getCell(2, c0).value = 'φPr,max (kN)';
        ws2.getCell(2, c0 + 1).value = +C.cap.toFixed(1);
        ['Pn (kN)', 'Mn (kN.m)', 'φ', 'φPn (kN)', 'φMn (kN.m)'].forEach((h, i) => {
          const c = ws2.getCell(4, c0 + i);
          c.value = h;
          c.font = { name: FONT_NAME, bold: true };
          c.fill = HD;
          c.border = box;
          ws2.getColumn(c0 + i).width = 12;
        });
        C.pts.forEach((p, i) => {
          [p.Pn, p.Mn, p.phi, p.P, p.M].forEach((v, k) => {
            const c = ws2.getCell(5 + i, c0 + k);
            c.value = +v.toFixed(k === 2 ? 3 : 1);
            c.numFmt = k === 2 ? '0.000' : '0.0';
            c.font = { name: FONT_NAME };
          });
        });
      });
    }
  }

  const rawBuf = await wb.xlsx.writeBuffer();
  const buffer = rawBuf instanceof Uint8Array ? rawBuf : new Uint8Array(rawBuf);
  return { wb, metas: METAS, buffer };
}

/**
 * Generate raw `.xlsx` bytes via `buildWB()` matching `18_appmode_export_xlsx_pdf.js:339-341`.
 */
export async function buildXlsx(options: BuildWorkbookOptions = {}): Promise<Uint8Array> {
  const { buffer } = await buildWB(options);
  return buffer;
}
