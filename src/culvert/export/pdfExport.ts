import { jsPDF } from 'jspdf';
import type { Borders, Cell, Worksheet } from 'exceljs';
import { STATIC_FONT_FILES } from '../types/project.ts';
import type { PdfPageDebugEntry } from '../types/ambient.d.ts';
import {
  buildWB,
  type BuildWorkbookOptions,
  type BuildWorkbookResult,
  type WorkbookMargins,
  type WorkbookMeta,
} from './excelExport.ts';

export interface PdfFontSpec {
  fam: 'T' | 'A';
  st: 'normal' | 'bold' | 'italic' | 'bolditalic';
  relPath: (typeof STATIC_FONT_FILES)[number];
  vfsFile: string;
}

export interface PdfFontEntry {
  fam: 'T' | 'A';
  st: 'normal' | 'bold' | 'italic' | 'bolditalic';
  file: string;
  b64: string;
}

export interface LoadPdfFontsOptions {
  fontProvider?: (relPath: string) => Promise<ArrayBuffer | Uint8Array> | ArrayBuffer | Uint8Array;
  fonts?: PdfFontEntry[];
  bypassCache?: boolean;
}

export interface BuildPdfOptions extends BuildWorkbookOptions, LoadPdfFontsOptions {
  workbookResult?: BuildWorkbookResult;
}

export interface BuildPdfResult {
  blob: Blob;
  bytes: Uint8Array;
  pages: PdfPageDebugEntry[];
  metas: WorkbookMeta[];
  wb: BuildWorkbookResult['wb'];
}

interface MergeRect {
  t: number;
  l: number;
  b: number;
  r: number;
}

interface PageSegment {
  M: WorkbookMeta;
  ws: Worksheet;
  s: number;
  colX: number[];
  colW: number[];
  merges: Record<string, MergeRect>;
  slave: Record<string, MergeRect>;
  top: number;
  headH: number;
  rh: (i: number) => number;
  rows: number[];
}

interface PdfPageLayout {
  M: WorkbookMeta;
  ws: Worksheet;
  s: number;
  colX: number[];
  colW: number[];
  merges: Record<string, MergeRect>;
  slave: Record<string, MergeRect>;
  top: number;
  headH: number;
  rh: (i: number) => number;
  segs: PageSegment[];
  sig: string | null;
  coalesced: boolean;
}

/**
 * Local static TrueType font table served from `public/fonts/` (`18_appmode_export_xlsx_pdf.js:1394-1400`).
 */
export const PDF_FONT_SPECS: readonly PdfFontSpec[] = [
  { fam: 'T', st: 'normal', relPath: 'fonts/Tinos_400Regular.ttf', vfsFile: 'Tnormal.ttf' },
  { fam: 'T', st: 'bold', relPath: 'fonts/Tinos_700Bold.ttf', vfsFile: 'Tbold.ttf' },
  {
    fam: 'T',
    st: 'italic',
    relPath: 'fonts/Tinos_400Regular_Italic.ttf',
    vfsFile: 'Titalic.ttf',
  },
  {
    fam: 'T',
    st: 'bolditalic',
    relPath: 'fonts/Tinos_700Bold_Italic.ttf',
    vfsFile: 'Tbolditalic.ttf',
  },
  { fam: 'A', st: 'normal', relPath: 'fonts/Arimo_400Regular.ttf', vfsFile: 'Anormal.ttf' },
] as const;

let cachedPdfFonts: PdfFontEntry[] | null = null;

/**
 * Resolve Vite-base-aware static local URL for `/fonts/*.ttf` (zero external CDN URLs).
 */
export function getLocalFontUrl(relPath: string): string {
  const env = (import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env;
  const rawBase = env?.BASE_URL ?? '/';
  const base = rawBase.endsWith('/') ? rawBase : rawBase + '/';
  const cleanRel = relPath.replace(/^\/+/, '');
  return base + cleanRel;
}

const B64_ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function encodeBytesBase64Fallback(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const has1 = i + 1 < bytes.length;
    const has2 = i + 2 < bytes.length;
    const b1 = has1 ? bytes[i + 1] : 0;
    const b2 = has2 ? bytes[i + 2] : 0;
    const triple = (b0 << 16) | (b1 << 8) | b2;
    out += B64_ALPHA[(triple >> 18) & 63];
    out += B64_ALPHA[(triple >> 12) & 63];
    out += has1 ? B64_ALPHA[(triple >> 6) & 63] : '=';
    out += has2 ? B64_ALPHA[triple & 63] : '=';
  }
  return out;
}

/**
 * Convert raw TTF byte array/buffer into Base64 string without exceeding stack limits (`8192` chunking).
 */
export function ab64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (typeof btoa === 'function') {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) {
      const chunk = bytes.subarray(i, i + 8192);
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  }
  return encodeBytesBase64Fallback(bytes);
}

/**
 * Clear in-memory cached Base64 TTF payloads (useful between tests).
 */
export function clearPdfFontCache(): void {
  cachedPdfFonts = null;
}

async function fetchLocalFontBytes(relPath: string): Promise<ArrayBuffer> {
  const url = getLocalFontUrl(relPath);
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Không tải được font cục bộ ${url} (HTTP ${resp.status}).`);
  }
  return resp.arrayBuffer();
}

/**
 * Load all 5 offline Vietnamese TTF fonts (`Arimo_400Regular` + `Tinos_*`) from `public/fonts/`.
 */
export async function pdfFonts(options?: LoadPdfFontsOptions): Promise<PdfFontEntry[]> {
  if (options?.fonts && options.fonts.length) {
    return options.fonts;
  }
  if (!options?.fontProvider && !options?.bypassCache && cachedPdfFonts) {
    return cachedPdfFonts;
  }

  const provider = options?.fontProvider ?? fetchLocalFontBytes;
  const buffers = await Promise.all(
    PDF_FONT_SPECS.map((spec) => Promise.resolve(provider(spec.relPath))),
  );

  const loaded: PdfFontEntry[] = PDF_FONT_SPECS.map((spec, i) => ({
    fam: spec.fam,
    st: spec.st,
    file: spec.vfsFile,
    b64: ab64(buffers[i]),
  }));

  if (!options?.fontProvider) {
    cachedPdfFonts = loaded;
  }
  return loaded;
}

/**
 * Render an ExcelJS workbook + `METAS` into exact A4 multi-page PDF bytes + layout telemetry.
 */
export async function buildPdfData(options: BuildPdfOptions = {}): Promise<BuildPdfResult> {
  const fonts = await pdfFonts(options);
  const wbResult = options.workbookResult ?? (await buildWB(options));
  const { wb, metas } = wbResult;

  const doc = new jsPDF({
    unit: 'pt',
    format: 'a4',
    orientation: 'portrait',
    compress: true,
  });

  fonts.forEach((f) => {
    doc.addFileToVFS(f.file, f.b64);
    doc.addFont(f.file, f.fam, f.st);
  });

  const PWp = 595.28;
  const PHp = 841.89;
  const IN = 72;
  const pages: PdfPageLayout[] = [];
  const cursor: { pg: PdfPageLayout | null; y: number; av: number } = {
    pg: null,
    y: 0,
    av: 0,
  };

  for (const M of metas) {
    const ws = M.ws;
    const s = M.scale / 100;
    const MG: WorkbookMargins = M.MG;
    const rh = (i: number) => (ws.getRow(i).height || 15) * s;
    const colW = M.widths.map((w) => (w * 7 + 5) * 0.75 * s);
    const Wc = colW.reduce((a, b) => a + b, 0);
    const x0 = MG.left * IN + (PWp - (MG.left + MG.right) * IN - Wc) / 2;
    const colX = [x0];
    colW.forEach((w, i) => colX.push(colX[i] + w));

    const headH = Array.from({ length: M.HEADROWS }, (_, i) => rh(i + 1)).reduce((a, b) => a + b, 0);
    const top = MG.top * IN;
    const avail = PHp - MG.bottom * IN - top - headH;

    const merges: Record<string, MergeRect> = {};
    const slave: Record<string, MergeRect> = {};
    const mergeRefs = ((ws.model as unknown as { merges?: string[] }).merges ?? []) as string[];
    mergeRefs.forEach((ref) => {
      const [p, q] = ref.split(':');
      const c1 = ws.getCell(p);
      const c2 = ws.getCell(q);
      const rect: MergeRect = {
        t: Number(c1.row),
        l: Number(c1.col),
        b: Number(c2.row),
        r: Number(c2.col),
      };
      merges[`${rect.t},${rect.l}`] = rect;
      for (let i = rect.t; i <= rect.b; i++) {
        for (let j = rect.l; j <= rect.r; j++) {
          if (i !== rect.t || j !== rect.l) {
            slave[`${i},${j}`] = rect;
          }
        }
      }
    });

    const base = { M, ws, s, colX, colW, merges, slave, top, headH, rh };
    const sig = M.divider
      ? null
      : Array.from({ length: M.HEADROWS }, (_, i) => JSON.stringify(ws.getRow(i + 1).values)).join(
          '#',
        ) +
        '@' +
        M.foot +
        '@' +
        M.scale;

    const newPage = (coalesced = false) => {
      cursor.pg = { ...base, segs: [], sig, coalesced };
      pages.push(cursor.pg);
      cursor.y = 0;
      cursor.av = avail;
    };

    const seg = (): PageSegment => {
      const q: PageSegment = { ...base, rows: [] };
      cursor.pg!.segs.push(q);
      return q;
    };

    if (M.divider) {
      newPage(false);
      const q = seg();
      for (let i = M.HEADROWS + 1; i <= M.last; i++) q.rows.push(i);
      cursor.pg = null;
      continue;
    }

    const cov = new Int32Array(M.last + 2).fill(-1);
    (M.groups ?? []).forEach((g, k) => {
      for (let i = Math.max(g.s, M.HEADROWS + 1); i <= g.e; i++) cov[i] = k;
    });
    const GR: Array<{ k: number; s: number; e: number }> = [];
    for (let i = M.HEADROWS + 1; i <= M.last; i++) {
      const k = cov[i];
      const L = GR[GR.length - 1];
      if (L && (k < 0 || L.k === k)) L.e = i;
      else GR.push({ k, s: i, e: i });
    }

    if (cursor.pg && cursor.pg.sig === sig && cursor.av - cursor.y >= 0.15 * cursor.av) {
      cursor.y += 8 * s;
      cursor.pg.coalesced = true;
    } else {
      newPage(false);
    }

    let q = seg();
    for (const g of GR) {
      let h = 0;
      for (let i = g.s; i <= g.e; i++) h += rh(i);
      if (cursor.y > 0 && cursor.y + h > cursor.av && h <= cursor.av) {
        newPage(false);
        q = seg();
      }
      for (let i = g.s; i <= g.e; i++) {
        const hi = rh(i);
        if (cursor.y > 0 && cursor.y + hi > cursor.av) {
          newPage(false);
          q = seg();
        }
        q.rows.push(i);
        cursor.y += hi;
      }
    }
  }

  const telemetry: PdfPageDebugEntry[] = pages.map((pg, idx) => ({
    sheetName: pg.M.name,
    page: idx + 1,
    rows: pg.segs.reduce((acc, s) => acc + s.rows.length, 0) + pg.M.HEADROWS,
    widthPt: PWp,
    heightPt: PHp,
    coalesced: pg.coalesced,
  }));

  if (typeof window !== 'undefined') {
    window.__PDFPAGES = telemetry;
  }

  const N = pages.filter((P) => !P.M.divider).length;
  let PN = 0;

  const argb = (a?: string): [number, number, number] => {
    const hex = (a || 'FF000000').slice(-6);
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
  };

  const fmtV = (c: Cell): string => {
    const v = c.value;
    if (v == null) return '';
    if (typeof v === 'number') {
      const m = /^0(?:\.(0+))?$/.exec(c.numFmt || '');
      return m ? v.toFixed(m[1] ? m[1].length : 0) : String(+v.toFixed(10));
    }
    if (typeof v === 'object') {
      if ('richText' in v && Array.isArray(v.richText)) {
        return v.richText.map((t) => t.text).join('');
      }
      if ('result' in v && v.result !== undefined) {
        return String(v.result);
      }
      return '';
    }
    return String(v);
  };

  const setFont = (f: Cell['font'] | undefined, s: number) => {
    const font = f || {};
    const fam = /arial/i.test(font.name || '') ? 'A' : 'T';
    const st =
      fam === 'A'
        ? 'normal'
        : font.bold && font.italic
          ? 'bolditalic'
          : font.bold
            ? 'bold'
            : font.italic
              ? 'italic'
              : 'normal';
    doc.setFont(fam, st);
    doc.setFontSize((font.size || 11) * s);
    doc.setTextColor(...argb(font.color?.argb));
  };

  const drawBorderLine = (
    b: Partial<Borders>['top'] | undefined,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    s: number,
  ) => {
    if (!b || !b.style) return;
    doc.setDrawColor(...argb(b.color?.argb));
    doc.setLineWidth(b.style === 'medium' ? 1.2 * s : b.style === 'double' ? 0.6 * s : 0.5 * s);
    doc.line(x1, y1, x2, y2);
    if (b.style === 'double') {
      const dy = y1 === y2 ? 1.6 * s : 0;
      const dx = x1 === x2 ? 1.6 * s : 0;
      doc.line(x1 + dx, y1 + dy, x2 + dx, y2 + dy);
    }
  };

  const drawRow = (P: PageSegment | PdfPageLayout, i: number, y: number) => {
    const { ws, s, colX, colW, merges, slave } = P;
    const h = P.rh(i);
    const row = ws.getRow(i);
    const NC = colW.length;

    // 1. Background fills & borders
    for (let j = 1; j <= NC; j++) {
      if (slave[`${i},${j}`]) continue;
      const R = merges[`${i},${j}`];
      const c = row.getCell(j);
      const x1 = colX[j - 1];
      const x2 = colX[R ? R.r : j];
      const y1 = y;
      let y2 = y;
      if (R) {
        for (let k = i; k <= R.b; k++) y2 += P.rh(k);
      } else {
        y2 += h;
      }
      const fl =
        c.fill && c.fill.type === 'pattern' && c.fill.fgColor ? c.fill.fgColor.argb : undefined;
      if (fl && !/FFFFFFFF$/i.test(fl)) {
        doc.setFillColor(...argb(fl));
        doc.rect(x1, y1, x2 - x1, y2 - y1, 'F');
      }
      const bd = c.border || {};
      const bb = R ? ws.getCell(R.b, R.r).border || {} : bd;
      const br = R ? ws.getCell(R.t, R.r).border || {} : bd;
      drawBorderLine(bd.top, x1, y1, x2, y1, s);
      drawBorderLine(bd.left, x1, y1, x1, y2, s);
      drawBorderLine(bb.bottom || bd.bottom, x1, y2, x2, y2, s);
      drawBorderLine(br.right || bd.right, x2, y1, x2, y2, s);
    }

    // 2. Text & wrapping / shrinking / spillover
    for (let j = 1; j <= NC; j++) {
      if (slave[`${i},${j}`]) continue;
      const c = row.getCell(j);
      const t = fmtV(c);
      if (!t) continue;

      const R = merges[`${i},${j}`];
      const al = c.alignment || {};
      const x1 = colX[j - 1];
      let x2 = colX[R ? R.r : j];
      let y2 = y;
      if (R) {
        for (let k = i; k <= R.b; k++) y2 += P.rh(k);
      } else {
        y2 += h;
      }

      setFont(c.font, s);
      const pad = 2.2 * s;
      let fs = ((c.font && c.font.size) || 11) * s;
      const wAvail = Math.max(4, x2 - x1 - 2 * pad);

      if (al.wrapText) {
        let lines = doc.splitTextToSize(t, wAvail) as string[];
        let lh = fs * 1.15;
        let th = lines.length * lh;
        for (let q = 0; q < 12 && th > y2 - y + 1; q++) {
          fs *= 0.93;
          doc.setFontSize(fs);
          lines = doc.splitTextToSize(t, wAvail) as string[];
          lh = fs * 1.15;
          th = lines.length * lh;
        }
        const ty =
          al.vertical === 'top' ? y + pad + fs * 0.85 : y + (y2 - y - th) / 2 + fs * 0.85;
        lines.forEach((L, k) => {
          const tx =
            al.horizontal === 'center'
              ? (x1 + x2) / 2
              : al.horizontal === 'right'
                ? x2 - pad
                : x1 + pad;
          const alignOpt =
            al.horizontal === 'center'
              ? 'center'
              : al.horizontal === 'right'
                ? 'right'
                : 'left';
          doc.text(L, tx, ty + k * lh, { align: alignOpt });
        });
        continue;
      }

      let tw = doc.getTextWidth(t);
      if (al.shrinkToFit && tw > wAvail && tw > 0) {
        fs = (fs * wAvail) / tw;
        doc.setFontSize(fs);
        tw = wAvail;
      }
      if (!R && (al.horizontal || 'left') === 'left' && tw > wAvail) {
        let k = j + 1;
        while (k <= NC && tw > x2 - x1 - 2 * pad) {
          const n = row.getCell(k);
          if (fmtV(n) || slave[`${i},${k}`] || merges[`${i},${k}`]) break;
          x2 = colX[k];
          k += 1;
        }
      }
      const ty = al.vertical === 'top' ? y + pad + fs * 0.85 : y + (y2 - y) / 2 + fs * 0.33;
      const hz = al.horizontal || (typeof c.value === 'number' ? 'right' : 'left');
      if (hz === 'center') doc.text(t, (x1 + x2) / 2, ty, { align: 'center' });
      else if (hz === 'right') doc.text(t, x2 - pad, ty, { align: 'right' });
      else doc.text(t, x1 + pad, ty);
    }
  };

  pages.forEach((PP, pi) => {
    if (pi) doc.addPage('a4', 'portrait');
    let y = PP.top;
    for (let i = 1; i <= PP.M.HEADROWS; i++) {
      drawRow(PP, i, y);
      y += PP.rh(i);
    }

    PP.segs.forEach((S, k) => {
      if (k) y += 8 * S.s;
      const yStart: Record<number, number> = {};
      for (const i of S.rows) {
        yStart[i] = y;
        drawRow(S, i, y);
        y += S.rh(i);
      }
      for (const im of S.M.imgs) {
        const r0 = Math.floor(im.tl.row) + 1;
        if (!(r0 in yStart)) continue;
        const fr = im.tl.row - Math.floor(im.tl.row);
        const c0 = Math.floor(im.tl.col);
        const fc = im.tl.col - c0;
        const colBaseX = S.colX[c0] ?? S.colX[0] ?? 0;
        const colBaseW = S.colW[c0] ?? 0;
        const x = colBaseX + fc * colBaseW;
        const yy = yStart[r0] + fr * S.rh(r0);
        const w = im.ext.width * 0.75 * S.s;
        const hh = im.ext.height * 0.75 * S.s;
        try {
          doc.addImage(im.b64, 'PNG', x, yy, w, hh, undefined, 'FAST');
        } catch {
          // Ignore malformed/headless image frames without aborting document generation
        }
      }
    });

    if (PP.M.divider) return;
    PN += 1;
    doc.setFont('T', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    const fy = PHp - PP.M.MG.footer * IN;
    if (PP.M.foot) doc.text(PP.M.foot, PP.M.MG.left * IN, fy);
    doc.setFont('T', 'normal');
    doc.text(`Trang ${PN}/${N}`, PWp - PP.M.MG.right * IN, fy, { align: 'right' });
  });

  const arrayBuf = doc.output('arraybuffer');
  const bytes = new Uint8Array(arrayBuf);
  const blob = new Blob([bytes], { type: 'application/pdf' });

  return { blob, bytes, pages: telemetry, metas, wb };
}

/**
 * Generate a multi-page A4 PDF `Blob` embedding Vietnamese TrueType fonts (`18_appmode_export_xlsx_pdf.js:1435-1737`).
 */
export async function buildPdf(options: BuildPdfOptions = {}): Promise<Blob> {
  const { blob } = await buildPdfData(options);
  return blob;
}
