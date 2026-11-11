import { PDFDocument, StandardFonts, rgb, type PDFPage } from 'pdf-lib';
import { toSVG } from '../cad/svg';
import { LAYERS } from '../cad/layers';
import {
  calcEnsureAll,
  calcRun,
  type CalcRunResult,
  type CalcValidResult,
  type EngineProject,
} from '../engine';
import { calcSheetHTML } from '../reports/calcSheetHtml';
import type { CadLayerId, CadSheet } from '../types/project';
import { dxSvgPng } from './docx';
import { baseName, downloadFile } from './projectIo';

const mmToPt = (mm: number): number => (mm * 72) / 25.4;

function hexToRgb(hex: string) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return rgb(0, 0, 0);
  return rgb(parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255);
}

function collectDocumentCss(): string {
  if (typeof document === 'undefined') return '';
  const chunks: string[] = [];
  for (const sheet of Array.from(document.styleSheets || [])) {
    try {
      const rules = Array.from(sheet.cssRules || []);
      chunks.push(rules.map((r) => r.cssText).join('\n'));
    } catch {
      // Cross-origin stylesheet ignored
    }
  }
  if (!chunks.length) {
    for (const s of Array.from(document.querySelectorAll('style'))) {
      chunks.push(s.textContent || '');
    }
  }
  return chunks.join('\n');
}

export async function printDoc(doc: string): Promise<void> {
  if (typeof document === 'undefined') return;
  const f = document.createElement('iframe');
  f.setAttribute('style', 'position:fixed;right:0;bottom:0;width:0;height:0;border:0');
  document.body.append(f);
  const w = f.contentWindow;
  if (!w) {
    f.remove();
    return;
  }
  const d = w.document;
  d.open();
  d.write(doc);
  d.close();
  await new Promise<void>((resolve) => {
    setTimeout(() => {
      try {
        w.focus();
        w.print();
      } catch (e) {
        console.error(e);
      }
      setTimeout(() => {
        f.remove();
        resolve();
      }, 2000);
    }, 400);
  });
}

export function buildCadPrintHtml(
  P: Pick<EngineProject, 'name'>,
  sh: CadSheet,
  sheetIdx: number,
): string {
  const pw = Math.ceil((sh.W * 10) / sh.S);
  const ph = Math.ceil((sh.H * 10) / sh.S);
  return `<!doctype html><html><head><meta charset="utf-8"><title>${baseName(P.name)}_to${sheetIdx + 1}</title><style>@page{size:${pw}mm ${ph}mm;margin:0}html,body{margin:0;padding:0}svg{display:block;width:${pw}mm;height:${ph}mm}</style></head><body>${toSVG(sh, { w: `${pw}mm`, h: `${ph}mm`, theme: 'light' })}</body></html>`;
}

export function calcPrintDoc(P: EngineProject, R: CalcRunResult): string {
  const html = calcSheetHTML(P, R);
  const css = collectDocumentCss();
  return `<!doctype html><html><head><meta charset="utf-8"><title>${baseName(P.name)}_tinh-toan</title><style>${css}\n@page{size:A4;margin:14mm 10mm}html,body{height:auto!important;display:block!important;background:#fff!important;margin:0}.csheet{width:772px!important;zoom:.9;margin:0!important;padding:0!important;box-shadow:none!important}</style></head><body><div class="csheet">${html}</div></body></html>`;
}

export async function printCadSheet(
  P: Pick<EngineProject, 'name'>,
  sh: CadSheet,
  sheetIdx: number,
): Promise<void> {
  await printDoc(buildCadPrintHtml(P, sh, sheetIdx));
}

export async function printCalcReport(
  P: EngineProject,
  onProgress?: (msg: string) => void,
): Promise<void> {
  let R = calcRun(P);
  try {
    R = await calcEnsureAll(P, (t) => onProgress?.(t));
  } catch (e) {
    console.error(e);
  }
  await printDoc(calcPrintDoc(P, R));
}

async function svgToPngBytes(
  svgMarkup: string,
  widthPx: number,
  heightPx: number,
): Promise<Uint8Array | null> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return null;
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(widthPx));
  cv.height = Math.max(1, Math.round(heightPx));
  const cx = cv.getContext('2d');
  if (!cx) return null;

  const url = URL.createObjectURL(new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    await new Promise<void>((ok, no) => {
      img.onload = () => ok();
      img.onerror = () => no(new Error('SVG raster load failed'));
      img.src = url;
    });
    cx.fillStyle = '#ffffff';
    cx.fillRect(0, 0, cv.width, cv.height);
    cx.drawImage(img, 0, 0, cv.width, cv.height);
    const blob = await new Promise<Blob | null>((ok) => cv.toBlob(ok, 'image/png'));
    return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function drawCadVectorFallback(page: PDFPage, sh: CadSheet, pageW: number, pageH: number): void {
  const k = Math.min(pageW / Math.max(sh.W, 1), pageH / Math.max(sh.H, 1));
  const colOf = (ly: CadLayerId) => hexToRgb(LAYERS[ly]?.cl || '#000000');
  const mm = (v: number) => ((v * sh.S) / 10) * k;

  for (const e of sh.E.a) {
    const color = colOf(e.ly);
    if (e.k === 'L') {
      page.drawLine({
        start: { x: e.x1 * k, y: e.y1 * k },
        end: { x: e.x2 * k, y: e.y2 * k },
        thickness: Math.max(0.25, mm(LAYERS[e.ly].lw)),
        color,
      });
    } else if (e.k === 'P' && e.pts.length >= 2) {
      const th = Math.max(0.25, (e.w ? e.w * k : mm(LAYERS[e.ly].lw)));
      const n = e.pts.length;
      for (let i = 0; i < (e.closed ? n : n - 1); i++) {
        const a = e.pts[i];
        const b = e.pts[(i + 1) % n];
        page.drawLine({
          start: { x: a[0] * k, y: a[1] * k },
          end: { x: b[0] * k, y: b[1] * k },
          thickness: th,
          color,
        });
      }
    } else if (e.k === 'C') {
      page.drawCircle({
        x: e.x * k,
        y: e.y * k,
        size: Math.max(0.4, e.r * k),
        color: e.fill ? color : undefined,
        borderColor: color,
        borderWidth: e.fill ? 0 : Math.max(0.25, mm(LAYERS[e.ly].lw)),
      });
    }
  }
}

export async function exportCadPdfBytes(sh: CadSheet): Promise<Uint8Array> {
  const pw = Math.max(20, Math.ceil((sh.W * 10) / sh.S));
  const ph = Math.max(20, Math.ceil((sh.H * 10) / sh.S));
  const pageW = mmToPt(pw);
  const pageH = mmToPt(ph);

  const doc = await PDFDocument.create();
  const page = doc.addPage([pageW, pageH]);

  // Rasterize light CAD SVG to crisp high-DPI PNG so Vietnamese labels, arcs, hatches & halos stay pixel-exact
  const pxScale = Math.min(4.2, 4200 / Math.max(pw, ph));
  const svgMarkup = toSVG(sh, { w: `${pw}mm`, h: `${ph}mm`, theme: 'light' });
  const pngBytes = await svgToPngBytes(svgMarkup, pw * pxScale, ph * pxScale);

  if (pngBytes && pngBytes.length > 0) {
    const img = await doc.embedPng(pngBytes);
    page.drawImage(img, { x: 0, y: 0, width: pageW, height: pageH });
  } else {
    drawCadVectorFallback(page, sh, pageW, pageH);
  }

  return doc.save();
}

export async function exportCadPdf(
  P: Pick<EngineProject, 'name'>,
  sh: CadSheet,
  sheetIdx: number,
): Promise<string> {
  const bytes = await exportCadPdfBytes(sh);
  const filename = `${baseName(P.name)}_to${sheetIdx + 1}.pdf`;
  downloadFile(filename, bytes, 'application/pdf');
  return filename;
}

const ASCII_VI_REPLACEMENTS: Array<[RegExp, string]> = [
  [/[àáảãạăằắẳẵặâầấẩẫậ]/g, 'a'],
  [/[ÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬ]/g, 'A'],
  [/[èéẻẽẹêềếểễệ]/g, 'e'],
  [/[ÈÉẺẼẸÊỀẾỂỄỆ]/g, 'E'],
  [/[ìíỉĩị]/g, 'i'],
  [/[ÌÍỈĨỊ]/g, 'I'],
  [/[òóỏõọôồốổỗộơờớởỡợ]/g, 'o'],
  [/[ÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢ]/g, 'O'],
  [/[ùúủũụưừứửữự]/g, 'u'],
  [/[ÙÚỦŨỤƯỪỨỬỮỰ]/g, 'U'],
  [/[ỳýỷỹỵ]/g, 'y'],
  [/[ỲÝỶỸỴ]/g, 'Y'],
  [/đ/g, 'd'],
  [/Đ/g, 'D'],
  [/[Φφ]/g, 'Phi'],
  [/[≥]/g, '>='],
  [/[≤]/g, '<='],
  [/[≠]/g, '!='],
  [/[×]/g, 'x'],
  [/[−–—]/g, '-'],
  [/[·•]/g, '.'],
  [/[³]/g, '3'],
  [/[²]/g, '2'],
  [/[^\x20-\x7E]/g, ' '],
];

function toWinAnsiSafe(s: string): string {
  let r = s;
  for (const [re, rep] of ASCII_VI_REPLACEMENTS) r = r.replace(re, rep);
  return r.replace(/\s+/g, ' ').trim();
}

interface PdfCanvasBlock {
  h: number;
  keepNext?: boolean;
  draw: (cx: CanvasRenderingContext2D, y: number) => void;
}

function wrapCanvasText(
  cx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  if (!words.length) return [''];
  const lines: string[] = [];
  let line = words[0];
  for (let i = 1; i < words.length; i++) {
    const cand = `${line} ${words[i]}`;
    if (cx.measureText(cand).width <= maxWidth) line = cand;
    else {
      lines.push(line);
      line = words[i];
    }
  }
  lines.push(line);
  return lines;
}

function fxReadableText(el: Element): string {
  const tex = el.getAttribute('data-tex');
  const walk = (n: Node): string => {
    if (n.nodeType === 3) return n.nodeValue || '';
    if (n.nodeType !== 1) return '';
    const nodeEl = n as Element;
    if (nodeEl.classList.contains('tf')) {
      const ch = Array.from(nodeEl.children);
      const tu = ch.find((c) => c.classList.contains('tu'));
      const td = ch.find((c) => c.classList.contains('td'));
      return `(${tu ? walk(tu) : ''})/(${td ? walk(td) : ''})`;
    }
    if (nodeEl.classList.contains('tss')) {
      const ch = Array.from(nodeEl.children);
      const sup = ch[0] ? walk(ch[0]) : '';
      const sub = ch[1] ? walk(ch[1]) : '';
      return `${sub ? `_${sub}` : ''}${sup ? `^${sup}` : ''}`;
    }
    return Array.from(n.childNodes).map(walk).join('');
  };
  const txt = walk(el).replace(/\s+/g, ' ').trim();
  if (txt) return txt;
  return tex ? tex.replace(/\\[a-zA-Z]+/g, ' ').replace(/[{}]/g, '') : '';
}

async function buildCalcCanvasPages(html: string): Promise<Uint8Array[] | null> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return null;
  const measureCv = document.createElement('canvas');
  measureCv.width = 1240;
  measureCv.height = 1754;
  const mcx = measureCv.getContext('2d');
  if (!mcx) return null;

  const PW = 1240; // A4 @ 150 dpi
  const PH = 1754;
  const ML = 76;
  const MR = 64;
  const MT = 70;
  const MB = 78;
  const CW = PW - ML - MR;
  const FONT = '"Times New Roman", Times, Georgia, serif';

  const dom = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const kids = Array.from(dom.body.children);
  const blocks: PdfCanvasBlock[] = [];

  for (const e of kids) {
    const tg = e.tagName;
    const cl = e.classList;

    if (tg === 'H1') {
      mcx.font = `bold 24px ${FONT}`;
      const lines = wrapCanvasText(mcx, e.textContent || '', CW);
      const lh = 32;
      blocks.push({
        h: lines.length * lh + 18,
        keepNext: true,
        draw: (cx, y) => {
          cx.font = `bold 24px ${FONT}`;
          cx.fillStyle = '#0e6ba8';
          cx.textAlign = 'center';
          lines.forEach((l, i) => cx.fillText(l, PW / 2, y + 24 + i * lh));
          cx.textAlign = 'left';
        },
      });
    } else if (tg === 'H2') {
      mcx.font = `bold 20px ${FONT}`;
      const lines = wrapCanvasText(mcx, e.textContent || '', CW);
      const lh = 26;
      blocks.push({
        h: lines.length * lh + 20,
        keepNext: true,
        draw: (cx, y) => {
          cx.font = `bold 20px ${FONT}`;
          cx.fillStyle = '#0e6ba8';
          lines.forEach((l, i) => cx.fillText(l, ML, y + 24 + i * lh));
          cx.strokeStyle = '#c9d7e4';
          cx.lineWidth = 1.5;
          cx.beginPath();
          cx.moveTo(ML, y + lines.length * lh + 10);
          cx.lineTo(ML + CW, y + lines.length * lh + 10);
          cx.stroke();
        },
      });
    } else if (tg === 'H3') {
      mcx.font = `bold 17px ${FONT}`;
      const lines = wrapCanvasText(mcx, e.textContent || '', CW);
      const lh = 22;
      blocks.push({
        h: lines.length * lh + 14,
        keepNext: true,
        draw: (cx, y) => {
          cx.font = `bold 17px ${FONT}`;
          cx.fillStyle = '#1d2730';
          lines.forEach((l, i) => cx.fillText(l, ML, y + 20 + i * lh));
        },
      });
    } else if (tg === 'DIV' && cl.contains('cr') && !cl.contains('f') && e.children.length >= 4) {
      const ch = Array.from(e.children);
      const vt = e.querySelector('.vt');
      const lab = (ch[1]?.textContent || '').trim();
      const sym = (ch[2]?.textContent || '').trim();
      const val = (vt ? vt.textContent : ch[3]?.textContent || '').trim();
      const unit = vt ? '' : (ch[4]?.textContent || '').trim();
      const note = vt ? '' : (ch[5]?.textContent || '').trim();
      const isOk = /\bĐạt\b/.test(note);
      const isBad = /Không đạt/.test(note);

      mcx.font = `16px ${FONT}`;
      const labLines = wrapCanvasText(mcx, lab, 460);
      const lh = 21;
      const h = Math.max(24, labLines.length * lh + 6);
      blocks.push({
        h,
        draw: (cx, y) => {
          cx.font = `16px ${FONT}`;
          cx.fillStyle = '#111';
          labLines.forEach((l, i) => cx.fillText(l, ML + 28, y + 17 + i * lh));
          cx.font = `italic 16px ${FONT}`;
          cx.textAlign = 'right';
          cx.fillText(sym, ML + 600, y + 17);
          cx.font = vt ? `bold 16px ${FONT}` : `16px ${FONT}`;
          if (vt) {
            cx.textAlign = 'left';
            cx.fillText(val, ML + 620, y + 17);
          } else {
            cx.fillText(val, ML + 780, y + 17);
            cx.textAlign = 'left';
            cx.fillStyle = '#444';
            cx.fillText(unit, ML + 794, y + 17);
            cx.font = `bold 16px ${FONT}`;
            cx.fillStyle = isOk ? '#1b7f4b' : isBad ? '#c00000' : '#111';
            cx.fillText(note, ML + 915, y + 17);
          }
          cx.textAlign = 'left';
        },
      });
    } else if (tg === 'DIV' && cl.contains('f')) {
      const fx = e.querySelector('.fx');
      const txt = fx ? fxReadableText(fx) : (e.textContent || '').trim();
      mcx.font = `italic 16px ${FONT}`;
      const lines = wrapCanvasText(mcx, txt, CW - 90);
      const lh = 22;
      blocks.push({
        h: lines.length * lh + 16,
        draw: (cx, y) => {
          cx.fillStyle = '#f6f8fa';
          cx.fillRect(ML + 36, y + 3, CW - 54, lines.length * lh + 10);
          cx.font = `italic 16px ${FONT}`;
          cx.fillStyle = '#111';
          lines.forEach((l, i) => cx.fillText(l, ML + 50, y + 22 + i * lh));
        },
      });
    } else if (tg === 'DIV' && cl.contains('figw')) {
      const svg = e.querySelector('svg');
      if (!svg) continue;
      const vb = (svg.getAttribute('viewBox') || '0 0 600 400').split(/\s+/).map(Number);
      const W = vb[2] || 600;
      const H = vb[3] || 400;
      const pic = await dxSvgPng(svg, W, H, 2);
      const blobUrl = URL.createObjectURL(
        new Blob([new Uint8Array(pic.d)], {
          type: pic.ext === 'jpg' ? 'image/jpeg' : 'image/png',
        }),
      );
      try {
        const img = new Image();
        await new Promise<void>((ok, no) => {
          img.onload = () => ok();
          img.onerror = () => no(new Error('fig img load failed'));
          img.src = blobUrl;
        });
        const maxW = CW - 20;
        const maxH = 540;
        const sc = Math.min(maxW / W, maxH / H, 1.35);
        const dw = W * sc;
        const dh = H * sc;
        blocks.push({
          h: dh + 14,
          keepNext: true,
          draw: (cx, y) => {
            cx.drawImage(img, ML + (CW - dw) / 2, y + 6, dw, dh);
          },
        });
      } catch {
        // Skip figure if raster fails in test env
      } finally {
        URL.revokeObjectURL(blobUrl);
      }
    } else if (tg === 'TABLE') {
      const rows = Array.from(e.querySelectorAll('tr'));
      const cells = rows.map((r) => Array.from(r.children));
      const nc = Math.max(1, ...cells.map((r) => r.length));
      const colW = Array<number>(nc).fill(4);
      cells.forEach((r, ri) =>
        r.forEach((c, i) => {
          const t = (c.textContent || '').replace(/\s+/g, ' ').trim();
          const len = ri === 0 ? Math.max(t.length * 0.65, 5) : Math.max(t.length, 4);
          colW[i] = Math.max(colW[i], Math.min(len, 34));
        }),
      );
      const sumW = colW.reduce((a, b) => a + b, 0);
      const widths = colW.map((w) => (CW * w) / sumW);
      const fontSz = nc <= 5 ? 15 : nc <= 8 ? 13.5 : 12;
      const lh = nc <= 5 ? 19 : 17;

      const rowSpecs = cells.map((r, ri) => {
        const isHead = ri === 0 || r.some((c) => c.tagName === 'TH');
        const cellLines = Array.from({ length: nc }, (_, i) => {
          const c = r[i];
          const txt = c ? (c.textContent || '').replace(/\s+/g, ' ').trim() : '';
          mcx.font = `${isHead ? 'bold ' : ''}${fontSz}px ${FONT}`;
          return wrapCanvasText(mcx, txt, Math.max(24, widths[i] - 10));
        });
        const maxLines = Math.max(1, ...cellLines.map((ls) => ls.length));
        return { r, isHead, cellLines, rowH: maxLines * lh + 10 };
      });

      // Emit row-by-row chunks (with small gaps) so tall tables cleanly split across A4 pages
      rowSpecs.forEach((spec, ri) => {
        blocks.push({
          h: spec.rowH + (ri === rowSpecs.length - 1 ? 12 : 0),
          keepNext: ri === 0,
          draw: (cx, y) => {
            let x = ML;
            for (let i = 0; i < nc; i++) {
              const w = widths[i];
              const c = spec.r[i];
              if (spec.isHead) {
                cx.fillStyle = '#dbe5f1';
                cx.fillRect(x, y, w, spec.rowH);
              }
              cx.strokeStyle = '#9aa3a9';
              cx.lineWidth = 1;
              cx.strokeRect(x, y, w, spec.rowH);
              const lines = spec.cellLines[i];
              const txtAll = lines.join(' ');
              const isOk = /\bĐạt\b/.test(txtAll);
              const isBad = /Không đạt/.test(txtAll);
              cx.font = `${spec.isHead || isOk || isBad ? 'bold ' : ''}${fontSz}px ${FONT}`;
              cx.fillStyle = isOk ? '#1b7f4b' : isBad ? '#c00000' : '#111';
              const align = spec.isHead
                ? 'center'
                : c?.classList.contains('l')
                  ? 'left'
                  : c?.classList.contains('c')
                    ? 'center'
                    : 'right';
              cx.textAlign = align;
              const tx = align === 'center' ? x + w / 2 : align === 'left' ? x + 5 : x + w - 5;
              lines.forEach((l, li) => cx.fillText(l, tx, y + lh - 1 + li * lh));
              cx.textAlign = 'left';
              x += w;
            }
          },
        });
      });
    } else {
      const txt = (e.textContent || '').replace(/\s+/g, ' ').trim();
      if (!txt) continue;
      const isCap = tg === 'P' && cl.contains('cap');
      const isSmall = tg === 'P' && cl.contains('small');
      const isKl = tg === 'P' && cl.contains('kl');
      const sz = isCap || isSmall ? 14.5 : 16;
      const lh = isCap || isSmall ? 19 : 22;
      const fontPrefix = isKl ? 'bold ' : isCap ? 'italic ' : '';
      mcx.font = `${fontPrefix}${sz}px ${FONT}`;
      const indent = isSmall || isKl ? 32 : 0;
      const lines = wrapCanvasText(mcx, txt, CW - indent);
      blocks.push({
        h: lines.length * lh + (isKl ? 16 : 8),
        draw: (cx, y) => {
          cx.font = `${fontPrefix}${sz}px ${FONT}`;
          cx.fillStyle = isKl
            ? cl.contains('ok')
              ? '#1b7f4b'
              : cl.contains('bad')
                ? '#c00000'
                : '#111'
            : isSmall
              ? '#555b60'
              : '#111';
          if (isCap) {
            cx.textAlign = 'center';
            lines.forEach((l, i) => cx.fillText(l, PW / 2, y + lh - 2 + i * lh));
            cx.textAlign = 'left';
          } else {
            lines.forEach((l, i) => cx.fillText(l, ML + indent, y + lh - 2 + i * lh));
          }
        },
      });
    }
  }

  // Paginate blocks onto A4 canvases
  const pages: PdfCanvasBlock[][] = [];
  const maxContentH = PH - MT - MB;
  let curPage: PdfCanvasBlock[] = [];
  let curY = 0;

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const nextH = b.keepNext && i + 1 < blocks.length ? b.h + Math.min(blocks[i + 1].h, 180) : b.h;
    if (curPage.length > 0 && curY + nextH > maxContentH) {
      pages.push(curPage);
      curPage = [];
      curY = 0;
    }
    curPage.push(b);
    curY += b.h;
  }
  if (curPage.length > 0 || pages.length === 0) pages.push(curPage);

  const outPngs: Uint8Array[] = [];
  const totalPages = pages.length;
  for (let pi = 0; pi < totalPages; pi++) {
    const cv = document.createElement('canvas');
    cv.width = PW;
    cv.height = PH;
    const cx = cv.getContext('2d');
    if (!cx) return null;
    cx.fillStyle = '#ffffff';
    cx.fillRect(0, 0, PW, PH);
    let y = MT;
    for (const blk of pages[pi]) {
      blk.draw(cx, y);
      y += blk.h;
    }
    cx.font = `14px ${FONT}`;
    cx.fillStyle = '#666';
    cx.textAlign = 'center';
    cx.fillText(`Trang ${pi + 1} / ${totalPages}`, PW / 2, PH - 30);
    cx.textAlign = 'left';

    const blob = await new Promise<Blob | null>((ok) => cv.toBlob(ok, 'image/png'));
    if (!blob) return null;
    outPngs.push(new Uint8Array(await blob.arrayBuffer()));
  }
  return outPngs;
}

export async function exportCalcPdfBytes(P: EngineProject, R: CalcRunResult): Promise<Uint8Array> {
  const html = calcSheetHTML(P, R);
  const A4_W = 595.28;
  const A4_H = 841.89;
  const doc = await PDFDocument.create();

  const canvasPages = await buildCalcCanvasPages(html);
  if (canvasPages && canvasPages.length > 0) {
    for (const png of canvasPages) {
      const page = doc.addPage([A4_W, A4_H]);
      const img = await doc.embedPng(png);
      page.drawImage(img, { x: 0, y: 0, width: A4_W, height: A4_H });
    }
    return doc.save();
  }

  // Headless / no-canvas fallback (e.g. jsdom tests): WinAnsi structured A4 text pagination
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const dom = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  let page = doc.addPage([A4_W, A4_H]);
  let y = A4_H - 42;
  const maxW = A4_W - 84;

  const ensureLine = (h: number) => {
    if (y - h < 42) {
      page = doc.addPage([A4_W, A4_H]);
      y = A4_H - 42;
    }
  };

  for (const e of Array.from(dom.body.children)) {
    const raw = (e.textContent || '').trim();
    if (!raw) continue;
    const isHeading = e.tagName === 'H1' || e.tagName === 'H2' || e.tagName === 'H3';
    const sz = e.tagName === 'H1' ? 12 : e.tagName === 'H2' ? 10.5 : 9;
    const safe = toWinAnsiSafe(raw);
    const words = safe.split(' ').filter(Boolean);
    const fUse = isHeading ? fontBold : font;
    let cur = '';
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (fUse.widthOfTextAtSize(next, sz) > maxW && cur) {
        ensureLine(sz + 4);
        page.drawText(cur, { x: 42, y, size: sz, font: fUse, color: rgb(0.1, 0.1, 0.1) });
        y -= sz + 4;
        cur = w;
      } else {
        cur = next;
      }
    }
    if (cur) {
      ensureLine(sz + 6);
      page.drawText(cur, { x: 42, y, size: sz, font: fUse, color: rgb(0.1, 0.1, 0.1) });
      y -= sz + 6;
    }
  }

  return doc.save();
}

export async function exportCalcPdf(
  P: EngineProject,
  onProgress?: (msg: string) => void,
): Promise<string> {
  let R = calcRun(P);
  if ('error' in R && R.error) throw new Error(R.error);
  R = await calcEnsureAll(P, (t) => onProgress?.(t));
  if ('error' in R && R.error) throw new Error(R.error);
  if ('unsupported' in R && R.unsupported) throw new Error(R.msg);
  onProgress?.('Đang tạo PDF…');
  const bytes = await exportCalcPdfBytes(P, R as CalcValidResult);
  const filename = `${baseName(P.name)}_tinh-toan.pdf`;
  downloadFile(filename, bytes, 'application/pdf');
  return filename;
}
