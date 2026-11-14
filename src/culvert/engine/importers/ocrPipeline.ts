/**
 * Clean-room Offline Tesseract OCR Pipeline for Engineering Tables & Longitudinal/Cross-Section Profiles
 *
 * Verbatim TypeScript port of `analysis-cau-cong/modules/16_dem_watershed_ocr_dxf_import.js` (`OCRK`, `OCRCOL`,
 * `ocrWorker`, `ocrPrep`, `ocrNums`, `ocrPaste`, `ocrStat`, `ocrOn`, `ocrProfile`), refactored for 100% offline
 * local vendor asset loading (zero CDN URLs, zero network fetches outside local bundle).
 */

import type { Worker, WorkerOptions } from 'tesseract.js';

/** tesseract.js chỉ nạp khi người dùng chạy OCR. */
const tess = () => import('tesseract.js');
import { VENDOR_ASSET_PATHS, type OcrResult } from '../../types/project';
import { dxsKm, dxsKmF } from './dxfParser';

// ============================================================================
// 1. Offline Asset Resolution & Tesseract Worker Configuration
// ============================================================================

export const OCRCOL: Readonly<Record<string, number>> = {
  hv_piers: 3,
  hv_rain: 2,
  hv_sec: 2,
};

export function resolveOfflineAsset(relPath: string): string {
  const env = (import.meta as { env?: { BASE_URL?: string } }).env;
  const baseRaw = (env && env.BASE_URL) || '/';
  const base = baseRaw.endsWith('/') ? baseRaw : baseRaw + '/';
  return base + String(relPath).replace(/^\/+/, '');
}

export function getOfflineTesseractOptions(): Partial<WorkerOptions> {
  return {
    workerPath: resolveOfflineAsset(VENDOR_ASSET_PATHS.tesseractWorker),
    corePath: resolveOfflineAsset(VENDOR_ASSET_PATHS.tesseractCoreDir),
    langPath: resolveOfflineAsset(VENDOR_ASSET_PATHS.tesseractLangDir),
    workerBlobURL: false,
    gzip: true,
  };
}

export const OCRK: {
  w: Worker | null;
  busy: boolean;
  opt: Partial<WorkerOptions>;
} = {
  w: null,
  busy: false,
  opt: getOfflineTesseractOptions(),
};

export async function ocrWorker(msg: (t: string, c?: string) => void = () => {}): Promise<Worker> {
  if (OCRK.w) return OCRK.w;
  msg('Đang tải bộ nhận dạng ký tự ngoại tuyến (lần đầu khoảng 5 - 10 giây)...');
  OCRK.opt = getOfflineTesseractOptions();
  const T = await tess();
  const w = await T.createWorker('eng', T.OEM.LSTM_ONLY, OCRK.opt);
  await w.setParameters({
    tessedit_char_whitelist: '0123456789.,-+ ',
    tessedit_pageseg_mode: (await tess()).PSM.SINGLE_BLOCK,
    preserve_interword_spaces: '1',
  });
  return (OCRK.w = w);
}

// ============================================================================
// 2. Image Binarization (Otsu), Table Line Stripping & Numeric Parsing
// ============================================================================

/** Computes global Otsu threshold on an 8-bit grayscale buffer. */
export function otsuThreshold(g: Uint8Array): number {
  const total = g.length;
  const hist = new Int32Array(256);
  for (let i = 0; i < total; i++) hist[g[i]]++;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sb = 0;
  let wb = 0;
  let best = 0;
  let th = 128;
  for (let t = 0; t < 256; t++) {
    wb += hist[t];
    if (!wb) continue;
    const wf = total - wb;
    if (!wf) break;
    sb += t * hist[t];
    const mb = sb / wb;
    const mf = (sum - sb) / wf;
    const v = wb * wf * (mb - mf) * (mb - mf);
    if (v > best) {
      best = v;
      th = t;
    }
  }
  return th;
}

/**
 * Strips long horizontal/vertical table grid lines from a binary foreground mask
 * (`1` = foreground ink, `0` = background; deleted pixels become `2`).
 */
export function stripTableLines(bwInput: Uint8Array, W: number, H: number): Uint8Array {
  const bw = bwInput.slice();
  const Lh = Math.max(60, W * 0.12);
  const Lv = Math.max(40, H * 0.25);
  const del = new Uint8Array(W * H);

  for (let y = 0; y < H; y++) {
    let x0 = -1;
    for (let xx = 0; xx <= W; xx++) {
      const on = xx < W && bw[y * W + xx] === 1;
      if (on && x0 < 0) x0 = xx;
      if (!on && x0 >= 0) {
        if (xx - x0 >= Lh) {
          for (let k2 = x0; k2 < xx; k2++) del[y * W + k2] = 1;
        }
        x0 = -1;
      }
    }
  }
  for (let xx = 0; xx < W; xx++) {
    let y0 = -1;
    for (let y = 0; y <= H; y++) {
      const on = y < H && bw[y * W + xx] === 1;
      if (on && y0 < 0) y0 = y;
      if (!on && y0 >= 0) {
        if (y - y0 >= Lv) {
          for (let k2 = y0; k2 < y; k2++) del[k2 * W + xx] = 1;
        }
        y0 = -1;
      }
    }
  }
  for (let i = 0; i < W * H; i++) {
    if (del[i]) bw[i] = 2;
  }
  return bw;
}

export function ocrPrep(
  img: CanvasImageSource & { width: number; height: number },
  kk?: number,
): HTMLCanvasElement {
  const k = Math.max(
    0.5,
    Math.min(
      kk || 3,
      4000 / Math.max(img.width, 1),
      Math.sqrt(8e6 / Math.max(1, img.width * img.height)),
    ),
  );
  const W = Math.round(img.width * k);
  const H = Math.round(img.height * k);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d');
  if (!x) throw new Error('2D canvas context unavailable for OCR preprocessing.');
  x.imageSmoothingQuality = 'high';
  x.drawImage(img, 0, 0, W, H);
  const d = x.getImageData(0, 0, W, H);
  const p = d.data;
  const g = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    g[i] = Math.round(0.299 * p[4 * i] + 0.587 * p[4 * i + 1] + 0.114 * p[4 * i + 2]);
  }
  const th = otsuThreshold(g);
  let dark = 0;
  for (let i = 0; i < W * H; i++) {
    if (g[i] <= th) dark++;
  }
  const inv = dark > (W * H) / 2;
  const rawBw = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    rawBw[i] = (g[i] <= th) !== inv ? 1 : 0;
  }
  const bw = stripTableLines(rawBw, W, H);
  for (let i = 0; i < W * H; i++) {
    const b = bw[i] === 1 ? 0 : 255;
    p[4 * i] = p[4 * i + 1] = p[4 * i + 2] = b;
    p[4 * i + 3] = 255;
  }
  x.putImageData(d, 0, 0);
  return c;
}

export function ocrNums(line: string): string[] {
  let t = String(line || '')
    .replace(/[—–]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return [];
  if (/\d\.\d/.test(t)) t = t.replace(/,/g, ' ');
  else t = t.replace(/(\d),(\d)/g, '$1.$2').replace(/,/g, ' ');
  return t.match(/[-+]?\d+(?:\.\d+)?/g) || [];
}

/**
 * Repairs numbers missing their decimal separator based on the dominant decimal-place
 * count and integer digit width in the corresponding column.
 */
export function repairMissingDecimals(inputRows: ReadonlyArray<ReadonlyArray<string>>): string[][] {
  const rows = inputRows.map((r) => r.slice());
  if (!rows.length) return rows;
  const ncol = Math.max(...rows.map((a) => a.length));
  for (let j = 0; j < ncol; j++) {
    const ds = rows
      .map((a) => a[j])
      .filter((v): v is string => Boolean(v && /\./.test(v)))
      .map((v) => v.split('.')[1].length);
    if (ds.length < rows.length * 0.5) continue;
    const dc: Record<number, number> = {};
    ds.forEach((d) => {
      dc[d] = (dc[d] || 0) + 1;
    });
    const d = +Object.keys(dc).sort((a, b) => dc[+b] - dc[+a])[0];
    const mags = rows
      .map((a) => a[j])
      .filter((v): v is string => Boolean(v && /\./.test(v)))
      .map((v) => v.split('.')[0].replace('-', '').length);
    const mg = Math.max(...mags);
    rows.forEach((a) => {
      const v = a[j];
      if (v && !/\./.test(v) && v.replace('-', '').length > mg && v.replace('-', '').length > d) {
        a[j] = v.slice(0, v.length - d) + '.' + v.slice(v.length - d);
      }
    });
  }
  return rows;
}

// ============================================================================
// 3. Longitudinal/Cross-Section Band Extractor (`ocrProfile`)
// ============================================================================

export interface OcrComponentBox {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  n: number;
}

export interface OcrMergedBox extends OcrComponentBox {
  m: OcrComponentBox[];
  rot?: boolean;
}

export interface OcrBandInfo {
  y0: number;
  y1: number;
  ticks: number[];
  lbl: OcrMergedBox[];
  rot: boolean;
  name: string;
}

export interface OcrProfileStructure {
  W: number;
  H: number;
  bk: number[];
  hl: Array<[number, number]>;
  vf: Array<[number, number]>;
  xL: number;
  xR: number;
  bands: OcrBandInfo[];
}

export function extractProfileStructure(
  px: Uint8ClampedArray,
  W: number,
  H: number,
): OcrProfileStructure | null {
  if (W < 3 * H) return null;
  const hist: Record<string, number> = {};
  for (let i = 0; i < W * H; i += 7) {
    const k = (px[4 * i] >> 3) + ',' + (px[4 * i + 1] >> 3) + ',' + (px[4 * i + 2] >> 3);
    hist[k] = (hist[k] || 0) + 1;
  }
  const bk = Object.keys(hist)
    .sort((a, b) => hist[b] - hist[a])[0]
    .split(',')
    .map((v) => +v * 8 + 4);

  const fg = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    fg[i] =
      Math.abs(px[4 * i] - bk[0]) +
        Math.abs(px[4 * i + 1] - bk[1]) +
        Math.abs(px[4 * i + 2] - bk[2]) >
      70
        ? 1
        : 0;
  }

  const rowC = (y: number): number => {
    let c = 0;
    for (let x = 0; x < W; x++) c += fg[y * W + x];
    return c;
  };
  const hl: Array<[number, number]> = [];
  for (let y = 0; y < H; y++) {
    if (rowC(y) > 0.6 * W) {
      if (hl.length && y - hl[hl.length - 1][1] <= 2) hl[hl.length - 1][1] = y;
      else hl.push([y, y]);
    }
  }
  if (hl.length < 4) return null;

  const yT = hl[0][0];
  const yB = hl[hl.length - 1][1];
  const colFull = (x: number): boolean => {
    let c = 0;
    for (let y = yT; y <= yB; y++) c += fg[y * W + x];
    return c > 0.9 * (yB - yT + 1);
  };
  const vf: Array<[number, number]> = [];
  for (let x = 0; x < W; x++) {
    if (colFull(x)) {
      if (vf.length && x - vf[vf.length - 1][1] <= 2) vf[vf.length - 1][1] = x;
      else vf.push([x, x]);
    }
  }
  const xL = (vf.find((v) => v[0] > 3 && v[0] < 0.3 * W) || [0, 0])[1] + 2;
  const xR = (vf.filter((v) => v[0] > 0.7 * W).map((v) => v[0])[0] || W) - 2;

  const bands: OcrBandInfo[] = [];
  for (let i = 0; i + 1 < hl.length; i++) {
    const y0 = hl[i][1] + 2;
    const y1 = hl[i + 1][0] - 2;
    if (y1 - y0 >= 8) {
      bands.push({ y0, y1, ticks: [], lbl: [], rot: false, name: '' });
    }
  }
  if (bands.length < 3) return null;

  for (const b of bands) {
    const h = b.y1 - b.y0 + 1;
    const tk: Array<[number, number]> = [];
    const m = new Uint8Array(W * h);
    for (let x = xL; x < xR; x++) {
      let c = 0;
      let run = 0;
      for (let y = b.y0; y <= b.y1; y++) {
        if (fg[y * W + x]) {
          run++;
          if (run > c) c = run;
        } else {
          run = 0;
        }
      }
      const tick = c >= 0.92 * h;
      if (tick) {
        if (tk.length && x - tk[tk.length - 1][1] <= 2) tk[tk.length - 1][1] = x;
        else tk.push([x, x]);
      } else {
        for (let y = b.y0; y <= b.y1; y++) m[(y - b.y0) * W + x] = fg[y * W + x];
      }
    }
    b.ticks = tk.map((t) => (t[0] + t[1]) / 2);

    const lab = new Int32Array(W * h).fill(-1);
    const comps: OcrComponentBox[] = [];
    for (let i = 0; i < W * h; i++) {
      if (!m[i] || lab[i] >= 0) continue;
      const q = [i];
      lab[i] = comps.length;
      let x0 = W;
      let x1 = 0;
      let y0 = h;
      let y1 = 0;
      let n = 0;
      while (q.length) {
        const j = q.pop()!;
        const xx = j % W;
        const yy = (j - xx) / W;
        n++;
        if (xx < x0) x0 = xx;
        if (xx > x1) x1 = xx;
        if (yy < y0) y0 = yy;
        if (yy > y1) y1 = yy;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const X2 = xx + dx;
            const Y2 = yy + dy;
            if (X2 < 0 || X2 >= W || Y2 < 0 || Y2 >= h) continue;
            const k = Y2 * W + X2;
            if (m[k] && lab[k] < 0) {
              lab[k] = comps.length;
              q.push(k);
            }
          }
        }
      }
      comps.push({ x0, x1, y0: y0 + b.y0, y1: y1 + b.y0, n });
    }

    const cs = comps.filter((c) => c.n >= 2 && (c.x1 - c.x0 + 1) * (c.y1 - c.y0 + 1) >= 4);
    const mg = (
      A: OcrComponentBox[],
      f: (g: OcrMergedBox, c: OcrComponentBox) => boolean,
    ): OcrMergedBox[] => {
      const G: OcrMergedBox[] = [];
      for (const c of A.slice().sort((a, z) => a.x0 - z.x0)) {
        const g = G.find((box) => f(box, c));
        if (g) {
          g.x0 = Math.min(g.x0, c.x0);
          g.x1 = Math.max(g.x1, c.x1);
          g.y0 = Math.min(g.y0, c.y0);
          g.y1 = Math.max(g.y1, c.y1);
          g.n += c.n;
          g.m.push(c);
        } else {
          G.push({ ...c, m: [c] });
        }
      }
      let ch = true;
      while (ch) {
        ch = false;
        for (let a = 0; a < G.length; a++) {
          for (let q = a + 1; q < G.length; q++) {
            if (f(G[a], G[q])) {
              const A2 = G[a];
              const B2 = G[q];
              A2.x0 = Math.min(A2.x0, B2.x0);
              A2.x1 = Math.max(A2.x1, B2.x1);
              A2.y0 = Math.min(A2.y0, B2.y0);
              A2.y1 = Math.max(A2.y1, B2.y1);
              A2.n += B2.n;
              A2.m = A2.m.concat(B2.m);
              G.splice(q, 1);
              ch = true;
              q--;
            }
          }
        }
      }
      return G;
    };

    const V = mg(
      cs,
      (g, c) => c.x0 <= g.x1 && c.x1 >= g.x0 && c.y0 <= g.y1 + 5 && c.y1 >= g.y0 - 5,
    );
    const tall = V.filter((g) => {
      const gh = g.y1 - g.y0 + 1;
      const gw = g.x1 - g.x0 + 1;
      return gh >= 0.4 * h && g.n >= 8 && (gh >= 2.2 * gw || (gh >= 1.35 * gw && g.m.length >= 2));
    }).map((g) => ({ ...g, rot: true }));
    const rest = V.filter((g) => !tall.some((t) => t.x0 === g.x0 && t.y0 === g.y0)).flatMap(
      (g) => g.m,
    );
    const hs = rest.map((c) => c.y1 - c.y0 + 1).sort((a, z) => a - z);
    const chh = hs[hs.length >> 1] || 9;
    const gx = Math.max(3, chh * 0.6);
    const Hg = mg(
      rest,
      (g, c) => c.y0 <= g.y1 && c.y1 >= g.y0 && c.x0 <= g.x1 + gx && c.x1 >= g.x0 - gx,
    )
      .filter((g) => g.n >= 8 && g.x1 - g.x0 + 1 >= chh * 1.2)
      .map((g) => ({ ...g, rot: false }));
    b.lbl = tall.concat(Hg).sort((a, z) => a.x0 - z.x0);
    b.rot = tall.length > Hg.length;
  }

  return { W, H, bk, hl, vf, xL, xR, bands };
}

export interface OcrProfileOutput {
  rows: Array<[number, number]>;
  bad: number[];
  n: number;
  chh: number;
  names: [string, string];
}

export async function ocrProfile(
  img: CanvasImageSource & { width: number; height: number },
  w: Worker,
  msg: (t: string, c?: string) => void = () => {},
): Promise<OcrProfileOutput | null> {
  const W = img.width;
  const H = img.height;
  if (W < 3 * H) return null;

  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const cx = cv.getContext('2d');
  if (!cx) return null;
  cx.drawImage(img, 0, 0);
  const px = cx.getImageData(0, 0, W, H).data;
  const stStruct = extractProfileStructure(px, W, H);
  if (!stStruct) return null;
  const { bk, hl, vf, xL, xR, bands } = stStruct;

  const winDebug = (window as unknown as Record<string, unknown>).__OD as
    | Record<string, unknown>
    | undefined;
  const debugBag: Record<string, unknown> = { W, H, hl, vf, xL, xR, nb: bands.length };
  (window as unknown as Record<string, unknown>).__OD = debugBag;
  void winDebug;

  msg('Ảnh dạng băng số liệu bản vẽ: đang tách hàng, cột...');

  await w.setParameters({
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZĐ ',
    tessedit_pageseg_mode: (await tess()).PSM.SINGLE_LINE,
  });

  const crop = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    rot: boolean,
    hTxt: number,
  ): HTMLCanvasElement => {
    const ww = x1 - x0 + 1;
    const hh = y1 - y0 + 1;
    const cw = rot ? hh : ww;
    const chh = rot ? ww : hh;
    const k = Math.max(1, Math.min(8, (hTxt || 40) / chh));
    const P = 12;
    const c = document.createElement('canvas');
    c.width = Math.round(cw * k) + 2 * P;
    c.height = Math.round(chh * k) + 2 * P;
    const g = c.getContext('2d')!;
    g.fillStyle = '#fff';
    g.fillRect(0, 0, c.width, c.height);
    const t = document.createElement('canvas');
    t.width = ww;
    t.height = hh;
    const tg = t.getContext('2d')!;
    const id = tg.createImageData(ww, hh);
    for (let y = 0; y < hh; y++) {
      for (let x = 0; x < ww; x++) {
        const q = 4 * ((y + y0) * W + x + x0);
        const dd =
          Math.abs(px[q] - bk[0]) + Math.abs(px[q + 1] - bk[1]) + Math.abs(px[q + 2] - bk[2]);
        const v = Math.max(0, Math.min(1, (dd - 30) / 160));
        const o = 4 * (y * ww + x);
        id.data[o] = id.data[o + 1] = id.data[o + 2] = Math.round(255 * (1 - v));
        id.data[o + 3] = 255;
      }
    }
    tg.putImageData(id, 0, 0);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.save();
    g.translate(P, P);
    if (rot) {
      g.translate(cw * k, 0);
      g.rotate(Math.PI / 2);
    }
    g.drawImage(t, 0, 0, ww * k, hh * k);
    g.restore();
    return c;
  };

  for (const b of bands) {
    try {
      const r = await w.recognize(crop(2, b.y0, Math.max(3, xL - 4), b.y1, false, 36));
      b.name = r.data.text.trim().toUpperCase();
    } catch {
      b.name = '';
    }
  }

  await w.setParameters({
    tessedit_char_whitelist: '0123456789.,-',
    tessedit_pageseg_mode: (await tess()).PSM.SINGLE_LINE,
  });

  const rotB = bands.filter((b) => b.rot && b.lbl.length >= 2);
  const horB = bands.filter((b) => b.lbl.length >= 1 && b.ticks.length >= 2);
  const nat = rotB.find((b) => /NH|NHI|TU N|TỰ/.test(b.name)) || rotB[rotB.length > 1 ? 1 : 0];
  const dis =
    horB.find((b) => /LY|LE|CU L/.test(b.name)) ||
    horB.sort((a, b) => b.ticks.length - a.ticks.length)[0];

  (window as unknown as Record<string, unknown>).__OD = {
    W,
    H,
    hl,
    vf,
    xL,
    xR,
    bands: bands.map((b) => ({
      y0: b.y0,
      y1: b.y1,
      rot: b.rot,
      n: b.lbl.length,
      nr: b.lbl.filter((g) => g.rot).length,
      ticks: b.ticks.length,
      name: b.name,
    })),
  };

  if (!nat || !dis) return null;

  type CandidateList = string[] & { cn: Record<string, number> };
  const rd = async (_b: OcrBandInfo, g: OcrMergedBox): Promise<CandidateList> => {
    const vs: Record<string, number> = {};
    const cn: Record<string, number> = {};
    for (const hT of [36, 46, 58, 70, 84]) {
      const r = await w.recognize(
        crop(
          Math.max(0, g.x0 - 1),
          Math.max(0, g.y0 - 1),
          Math.min(W - 1, g.x1 + 1),
          Math.min(H - 1, g.y1 + 1),
          Boolean(g.rot),
          hT,
        ),
      );
      const t = (r.data.text
        .replace(/,/g, '.')
        .replace(/\s+/g, '')
        .match(/-?\d+(?:\.\d+)?/) || [])[0];
      if (t) {
        vs[t] = (vs[t] || 0) + 1 + (/^\d+\.\d{1,3}$/.test(t) ? 1.5 : 0) + t.length * 0.01;
        cn[t] = (cn[t] || 0) + 1;
      }
    }
    const o = Object.keys(vs).sort((a, b) => vs[b] - vs[a]);
    return Object.assign(o, { cn });
  };

  let k = 0;
  const tot = nat.lbl.length + dis.lbl.length;
  interface TokenEntry {
    x: number;
    v: string;
    c: CandidateList;
  }
  const E: TokenEntry[] = [];
  const D: TokenEntry[] = [];

  for (const g of nat.lbl) {
    msg(`Đang đọc cao độ tự nhiên, cự ly (${++k}/${tot})...`);
    const c = await rd(nat, g);
    if (c.length) E.push({ x: (g.x0 + g.x1) / 2, v: c[0], c });
  }
  for (const g of dis.lbl) {
    msg(`Đang đọc cao độ tự nhiên, cự ly (${++k}/${tot})...`);
    const c = await rd(dis, g);
    if (c.length) D.push({ x: (g.x0 + g.x1) / 2, v: c[0], c });
  }

  await w.setParameters({
    tessedit_char_whitelist: '0123456789.,-+ ',
    tessedit_pageseg_mode: (await tess()).PSM.SINGLE_BLOCK,
  });

  const fix = (A: TokenEntry[]): void => {
    const ds = A.filter((a) => /\./.test(a.v)).map((a) => a.v.split('.')[1].length);
    if (!ds.length) return;
    const d = ds.sort(
      (a, b) => ds.filter((v) => v === b).length - ds.filter((v) => v === a).length,
    )[0];
    A.forEach((a) => {
      if (!/\./.test(a.v) && a.v.length > d) {
        a.v = a.v.slice(0, a.v.length - d) + '.' + a.v.slice(a.v.length - d);
      }
    });
  };
  fix(E);
  fix(D);

  const il = (t: string | number): number => String(t).split('.')[0].replace('-', '').length;
  let IL = 1;
  for (let L2 = 4; L2 >= 1; L2--) {
    if (E.filter((e) => e.c.some((t) => il(t) === L2 && /\./.test(t))).length >= 0.3 * E.length) {
      IL = L2;
      break;
    }
  }
  E.forEach((e) => {
    const c2 = e.c.find((t) => il(t) === IL && /\./.test(t));
    if (c2) e.v = c2;
  });

  const fixed = new Set<TokenEntry>();
  const ev = E.map((e) => +e.v)
    .filter((v) => Number.isFinite(v) && il(v) === IL)
    .sort((a, b) => a - b);
  const med = ev[ev.length >> 1];
  const dcs = E.map((e) => (String(e.v).split('.')[1] || '').length);
  const dmo = dcs
    .slice()
    .sort((a, b) => dcs.filter((v) => v === b).length - dcs.filter((v) => v === a).length)[0];

  E.forEach((e) => {
    const c2 = e.c.find(
      (t) => (t.split('.')[1] || '').length === dmo && Math.abs(+t - +e.v) < 1,
    );
    if ((String(e.v).split('.')[1] || '').length !== dmo) {
      if (c2) e.v = c2;
      else fixed.add(e);
    }
  });

  if (Number.isFinite(med) && med >= 10) {
    const mi = String(Math.floor(med));
    E.forEach((e) => {
      const v = +e.v;
      if (Number.isFinite(v) && Math.abs(v - med) <= 0.25 * med) return;
      const s0 = String(e.v);
      const cand = new Set(e.c);
      [s0, ...e.c].forEach((t) => {
        const ip = t.split('.')[0];
        if (ip.length < mi.length) cand.add(mi.slice(0, mi.length - ip.length) + t);
        if (ip.length > mi.length) cand.add(t.slice(ip.length - mi.length));
        if (ip.length === mi.length) cand.add(mi[0] + t.slice(1));
      });
      const best = [...cand]
        .map(Number)
        .filter(Number.isFinite)
        .sort((a, b) => Math.abs(a - med) - Math.abs(b - med))[0];
      if (best != null && Math.abs(best - med) <= 0.25 * med) {
        e.v = String(best);
        fixed.add(e);
      } else {
        fixed.add(e);
      }
    });
  }

  const T = [xL - 2, ...dis.ticks].sort((a, b) => a - b);
  const segD: Array<TokenEntry | null> = [];
  const segF: number[] = [];
  for (let i = 0; i + 1 < T.length; i++) {
    segD.push(D.find((q) => q.x > T[i] && q.x < T[i + 1]) || null);
  }
  const rat = segD
    .map((d, i) => (d && +d.v > 0 ? (T[i + 1] - T[i]) / +d.v : NaN))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  const sc = rat[rat.length >> 1];
  const ddc = D.map((d) => (d.v.split('.')[1] || '').length);
  const dm =
    ddc
      .slice()
      .sort((a, b) => ddc.filter((v) => v === b).length - ddc.filter((v) => v === a).length)[0] ||
    2;

  const seg = segD.map((d, i) => {
    if (i === 0 && !d) return null;
    const est = (T[i + 1] - T[i]) / sc;
    const tol = Math.max(0.08, 0.05 * est);
    const ok = d
      ? d.c
          .filter((t) => (t.split('.')[1] || '').length === dm && Math.abs(+t - est) <= tol)
          .map(Number)
      : [];
    if (ok.length) return ok[0];
    segF.push(i);
    return +est.toFixed(2);
  });

  let a = 0;
  while (a < seg.length && seg[a] == null) a++;
  let z = seg.length - 1;
  while (z >= 0 && seg[z] == null) z--;
  if (a > z) return null;

  E.forEach((e) => {
    if ((e.c.cn[e.v] || 0) < 2) fixed.add(e);
  });

  const st: Array<[number, number]> = [];
  let L = 0;
  const bad: number[] = [];
  for (let i = a; i <= z + 1; i++) {
    const xs = T[i];
    const e = E.reduce<TokenEntry | null>(
      (b, q) => (!b || Math.abs(q.x - xs) < Math.abs(b.x - xs) ? q : b),
      null,
    );
    const ok = Boolean(e && Math.abs(e.x - xs) <= Math.max(14, (nat.y1 - nat.y0) * 0.4));
    st.push([+L.toFixed(2), ok && e ? +e.v : NaN]);
    if (!ok || (e && fixed.has(e))) bad.push(+L.toFixed(2));
    if (i <= z) {
      if (seg[i] == null || segF.includes(i)) bad.push(+(L + (seg[i] || 0)).toFixed(2));
      L += seg[i] || 0;
    }
  }

  Object.assign((window as unknown as Record<string, unknown>).__OD as object, { E, D, T });
  const ws = nat.lbl.map((g) => g.x1 - g.x0 + 1).sort((p, q) => p - q);
  const chh = ws[ws.length >> 1] || 0;

  return {
    rows: st.filter((r) => Number.isFinite(r[1])),
    bad: [...new Set(bad)],
    n: st.length,
    chh,
    names: [nat.name, dis.name],
  };
}

// ============================================================================
// 4. Multi-Scale Clipboard Paste (`ocrPaste`) & DOM Binding (`initOcrDom`)
// ============================================================================

export function ocrStat(ta: HTMLElement): HTMLElement {
  let s = ta.nextElementSibling as HTMLElement | null;
  if (!s || !s.classList || !s.classList.contains('ocrSt')) {
    s = document.createElement('div');
    s.className = 'ocrSt small noprint';
    ta.after(s);
  }
  return s;
}

export function ocrOn(ta: Element | null): ta is HTMLTextAreaElement {
  return Boolean(
    ta && ta.tagName === 'TEXTAREA' && /^hv_/.test(ta.id) && !/stWhy/.test(ta.id),
  );
}

/** Runs multi-scale consensus [2, 2.5, 3, 3.5, 4] or longitudinal profile OCR on an image bitmap. */
export async function runOcrOnImage(
  targetId: string,
  img: CanvasImageSource & { width: number; height: number },
  msg: (t: string, c?: string) => void = () => {},
  startChainageRaw?: string,
): Promise<OcrResult | null> {
  const w = await ocrWorker(msg);
  msg('Đang đọc số trong ảnh...');
  const nc = OCRCOL[targetId] || 0;
  const scales = [2, 2.5, 3, 3.5, 4];
  const PR = await ocrProfile(img, w, msg).catch((e) => {
    console.error(e);
    return null;
  });
  if (PR && PR.rows.length >= 2) {
    const parsedOff = targetId === 'hv_sec' && startChainageRaw ? dxsKm(startChainageRaw) : NaN;
    const off = Number.isFinite(parsedOff) ? parsedOff : 0;
    const rows = PR.rows.map((a): [number, number] => [+(a[0] + off).toFixed(2), a[1]]);
    const text = rows.map((a) => a.join(' ')).join('\n');
    return {
      targetId,
      mode: 'profile',
      scalesEvaluated: [36, 46, 58, 70, 84],
      rowsParsed: rows.length,
      text,
    };
  }

  const runs: string[][][] = [];
  for (const kk of scales) {
    msg(`Đang đọc số trong ảnh (lượt ${runs.length + 1}/5)...`);
    const r = await w.recognize(ocrPrep(img, kk));
    let R = r.data.text
      .split(/\r?\n/)
      .map(ocrNums)
      .filter((a) => a.length >= 2);
    if (
      R.length >= 3 &&
      R.every((a) => a.length >= 3) &&
      R.filter((a, i) => i && +a[0] === +R[i - 1][0] + 1 && !/\./.test(a[0])).length >=
        R.length * 0.7
    ) {
      R = R.map((a) => a.slice(1));
    }
    runs.push(R);
  }

  const nr = +Object.entries(
    runs.reduce<Record<number, number>>((m, R) => ((m[R.length] = (m[R.length] || 0) + 1), m), {}),
  ).sort((a, b) => b[1] - a[1] || +b[0] - +a[0])[0][0];
  const use = runs.filter((R) => R.length === nr);
  if (!use.length || !use[0].length) return null;

  const pickedRows = use[0].map((_row, i) => {
    const lc: Record<number, number> = {};
    use.forEach((R) => {
      lc[R[i].length] = (lc[R[i].length] || 0) + 1;
    });
    const L = +Object.keys(lc).sort((a, b) => lc[+b] - lc[+a] || +b - +a)[0];
    const U = use.filter((R) => R[i].length === L);
    return Array.from({ length: L }, (_, j) => {
      const c: Record<string, number> = {};
      U.forEach((R) => {
        const v = R[i][j];
        if (v != null) c[v] = (c[v] || 0) + 1 + (/\./.test(v) ? 0.1 : 0);
      });
      return Object.keys(c).sort((a, b) => c[b] - c[a])[0];
    }).filter((v): v is string => v != null);
  });

  const repaired = repairMissingDecimals(pickedRows);
  const numRows = repaired.map((a) => a.map(Number).filter(Number.isFinite));
  const cnt: Record<number, number> = {};
  numRows.forEach((a) => {
    cnt[a.length] = (cnt[a.length] || 0) + 1;
  });
  const mode = nc || +Object.keys(cnt).sort((a, b) => cnt[+b] - cnt[+a])[0] || 2;
  const finalRows = numRows
    .map((a) => a.slice(0, mode))
    .filter((a) => a.length >= Math.min(2, mode));

  if (!finalRows.length) return null;
  return {
    targetId,
    mode: 'table',
    scalesEvaluated: scales,
    rowsParsed: finalRows.length,
    text: finalRows.map((a) => a.join(' ')).join('\n'),
  };
}

export async function ocrPaste(ta: HTMLTextAreaElement, file: Blob): Promise<void> {
  const st = ocrStat(ta);
  const msg = (t: string, c?: string): void => {
    st.innerHTML = t;
    st.style.color = c || '#555';
  };
  if (OCRK.busy) {
    msg('Đang đọc ảnh trước, chờ xong rồi dán lại.');
    return;
  }
  OCRK.busy = true;
  try {
    const img = await createImageBitmap(file);
    const w = await ocrWorker(msg);
    msg('Đang đọc số trong ảnh...');
    const nc = OCRCOL[ta.id] || 0;
    const runs: string[][][] = [];
    const PR = await ocrProfile(img, w, msg).catch((e) => {
      console.error(e);
      return null;
    });
    if (PR && PR.rows.length >= 2) {
      const old = ta.value;
      const sxe = document.getElementById('hv_sx0') as HTMLInputElement | null;
      const off =
        ta.id === 'hv_sec' && sxe && Number.isFinite(dxsKm(sxe.value)) ? dxsKm(sxe.value) : 0;
      if (off) {
        PR.rows.forEach((a) => (a[0] = +(a[0] + off).toFixed(2)));
        PR.bad = PR.bad.map((v) => +(v + off).toFixed(2));
      }
      ta.value = PR.rows.map((a) => a.join(' ')).join('\n');
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      ta.dispatchEvent(new Event('change', { bubbles: true }));
      msg(
        `Đã đọc băng số liệu bản vẽ: ${PR.rows.length} cọc, lý trình cộng dồn từ cự ly lẻ${off ? ' bắt đầu tại ' + dxsKmF(off) : ' bắt đầu từ 0 (nhập lý trình điểm đầu rồi bấm dời lý trình)'}, cao độ lấy ở hàng cao độ tự nhiên. ` +
          (PR.bad.length
            ? `<b>Cần soát lại</b> cọc lý trình ${PR.bad.join(', ')} (số đọc chưa chắc chắn). `
            : 'Đối chiếu lại với ảnh trước khi dùng. ') +
          (PR.chh && PR.chh < 12
            ? `<br><b>Chữ số trong ảnh quá nhỏ (cao khoảng ${PR.chh} điểm ảnh) nên dễ đọc sai</b>: phóng to bản vẽ khoảng 2 - 3 lần, chụp từng đoạn rồi dán lại; hoặc dùng lệnh XUATMC trong CAD (tệp XUATMC.lsp) để lấy số liệu chính xác. `
            : '') +
          `<a href="#" class="ocrUndo">Hoàn tác</a>`,
        PR.bad.length ? '#c00000' : '#006100',
      );
      const undoEl = st.querySelector('.ocrUndo') as HTMLAnchorElement | null;
      if (undoEl) {
        undoEl.onclick = (e) => {
          e.preventDefault();
          ta.value = old;
          ta.dispatchEvent(new Event('input', { bubbles: true }));
          ta.dispatchEvent(new Event('change', { bubbles: true }));
          msg('Đã hoàn tác.');
        };
      }
      return;
    }

    for (const kk of [2, 2.5, 3, 3.5, 4]) {
      msg(`Đang đọc số trong ảnh (lượt ${runs.length + 1}/5)...`);
      const r = await w.recognize(ocrPrep(img, kk));
      let R = r.data.text
        .split(/\r?\n/)
        .map(ocrNums)
        .filter((a) => a.length >= 2);
      if (
        R.length >= 3 &&
        R.every((a) => a.length >= 3) &&
        R.filter((a, i) => i && +a[0] === +R[i - 1][0] + 1 && !/\./.test(a[0])).length >=
          R.length * 0.7
      ) {
        R = R.map((a) => a.slice(1));
      }
      runs.push(R);
    }

    const nr = +Object.entries(
      runs.reduce<Record<number, number>>(
        (m, R) => ((m[R.length] = (m[R.length] || 0) + 1), m),
        {},
      ),
    ).sort((a, b) => b[1] - a[1] || +b[0] - +a[0])[0][0];
    const use = runs.filter((R) => R.length === nr);
    const picked = use[0].map((_row, i) => {
      const lc: Record<number, number> = {};
      use.forEach((R) => (lc[R[i].length] = (lc[R[i].length] || 0) + 1));
      const L = +Object.keys(lc).sort((a, b) => lc[+b] - lc[+a] || +b - +a)[0];
      const U = use.filter((R) => R[i].length === L);
      return Array.from({ length: L }, (_, j) => {
        const c: Record<string, number> = {};
        U.forEach((R) => {
          const v = R[i][j];
          if (v != null) c[v] = (c[v] || 0) + 1 + (/\./.test(v) ? 0.1 : 0);
        });
        return Object.keys(c).sort((a, b) => c[b] - c[a])[0];
      }).filter((v): v is string => v != null);
    });

    let rows = repairMissingDecimals(picked).map((a) => a.map(Number).filter(Number.isFinite));
    const cnt: Record<number, number> = {};
    rows.forEach((a) => (cnt[a.length] = (cnt[a.length] || 0) + 1));
    const mode = nc || +Object.keys(cnt).sort((a, b) => cnt[+b] - cnt[+a])[0] || 2;
    const odd = rows.filter((a) => a.length !== mode).length;
    rows = rows.map((a) => a.slice(0, mode)).filter((a) => a.length >= Math.min(2, mode));
    if (!rows.length) {
      msg(
        'Không đọc được dòng số nào trong ảnh. Chụp sát vùng bảng số, chữ rõ, không lẫn tiêu đề.',
        '#c00000',
      );
      return;
    }

    const old = ta.value;
    ta.value = rows.map((a) => a.join(' ')).join('\n');
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.dispatchEvent(new Event('change', { bubbles: true }));
    const nonInc =
      ta.id === 'hv_sec' ? rows.filter((a, i) => i && a[0] <= rows[i - 1][0]).length : 0;
    msg(
      `Đã đọc ${rows.length} dòng từ ảnh, ` +
        (odd || nonInc
          ? `<b>cần soát lại</b>: ${odd ? odd + ' dòng số lượng số khác thường' : ''}${odd && nonInc ? '; ' : ''}${nonInc ? nonInc + ' dòng lý trình không tăng dần' : ''}. `
          : 'đối chiếu lại với ảnh trước khi dùng. ') +
        `<a href="#" class="ocrUndo">Hoàn tác</a>`,
      odd || nonInc ? '#c00000' : '#006100',
    );
    const undoEl = st.querySelector('.ocrUndo') as HTMLAnchorElement | null;
    if (undoEl) {
      undoEl.onclick = (e) => {
        e.preventDefault();
        ta.value = old;
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.dispatchEvent(new Event('change', { bubbles: true }));
        msg('Đã hoàn tác.');
      };
    }
  } catch (e) {
    msg(
      'Lỗi đọc ảnh: ' + ((e instanceof Error ? e.message : String(e)) || ''),
      '#c00000',
    );
  } finally {
    OCRK.busy = false;
  }
}

export function initOcrDom(): () => void {
  if (typeof document === 'undefined') return () => {};
  const onPaste = (e: ClipboardEvent): void => {
    const ta = e.target as Element | null;
    if (!ocrOn(ta)) return;
    const it = [...((e.clipboardData || { items: [] }).items || [])].find((i) =>
      /^image\//.test(i.type),
    );
    if (!it) return;
    e.preventDefault();
    const f = it.getAsFile();
    if (f) void ocrPaste(ta, f);
  };
  document.addEventListener('paste', onPaste);
  document.querySelectorAll("textarea[id^='hv_']").forEach((ta) => {
    if (!ocrOn(ta)) return;
    const s = ocrStat(ta as HTMLElement);
    if (!s.innerHTML) {
      s.textContent =
        'Nhập nhanh: chụp màn hình bảng số liệu (Excel, bảng tính, bản vẽ...) rồi bấm vào ô và Ctrl+V, phần mềm tự đọc các con số.';
    }
  });
  return () => document.removeEventListener('paste', onPaste);
}
