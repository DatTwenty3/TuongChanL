import { VENDOR_ASSET_PATHS } from '../types/project.ts';
import type { MathJaxBrowserGlobal } from '../types/ambient.d.ts';

/**
 * Shared TeX -> SVG cache keyed by raw TeX source string (`02_core_utils_and_column_pm.js:25`).
 */
export const TEXC = new Map<string, string>();

/**
 * Scale factor converting MathJax `ex` dimensions into PNG raster pixels (`18_appmode_export_xlsx_pdf.js:283`).
 */
export const EXPX = 7.2;

export type MathRasterizer = (
  svgMarkup: string,
  pixelWidth: number,
  pixelHeight: number,
) => Promise<string> | string;

export interface RasterizeOptions {
  rasterize?: MathRasterizer;
  timeoutMs?: number;
}

export interface SvgPngResult {
  b64: string;
  W: number;
  H: number;
}

let mathJaxLoadPromise: Promise<MathJaxBrowserGlobal | null> | null = null;

function escAttr(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Build offline local script URL for MathJax (`vendor/mathjax/tex-svg.js`, zero CDN URLs).
 */
export function getMathJaxScriptUrl(): string {
  const env = (import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env;
  const rawBase = env?.BASE_URL ?? '/';
  const base = rawBase.endsWith('/') ? rawBase : rawBase + '/';
  return base + VENDOR_ASSET_PATHS.mathjaxTexSvg;
}

/**
 * Wrap a TeX formula into an inline `<span class="m" data-tex="..."></span>` placeholder.
 */
export const MX = (tex: string): string => `<span class="m" data-tex="${escAttr(tex)}"></span>`;

/**
 * Wrap a TeX formula row (`<div class="row f"><span></span><span>...</span>...</div>`).
 */
export const FR = (tex: string, rest = ''): string =>
  `<div class="row f"><span></span><span>${MX(tex)}</span>${rest}</div>`;

/**
 * Synchronous offline TeX-to-plain/Unicode text fallback matching `02_core_utils_and_column_pm.js:32-36`.
 */
export function texToUnicode(tex: string): string {
  return String(tex)
    .replace(/\\(dfrac|frac)\{([^{}]*)\}\{([^{}]*)\}/g, '($2)/($3)')
    .replace(/\\[a-zA-Z]+/g, ' ')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Render all `.m[data-tex]` elements using `window.MathJax.tex2svg` (cached in `TEXC`)
 * or synchronous `texToUnicode` offline fallback when MathJax is not yet loaded.
 */
export function mathAll(root?: ParentNode | null): number {
  const container = root ?? (typeof document !== 'undefined' ? document : null);
  if (!container) return 0;

  const mj = typeof window !== 'undefined' ? window.MathJax : undefined;
  const ok = !!(mj && typeof mj.tex2svg === 'function');
  let updated = 0;

  container.querySelectorAll<HTMLElement>('.m').forEach((el) => {
    const tex = el.dataset.tex ?? '';
    const tag = (ok ? '1' : '0') + tex;
    if (el.dataset.r === tag) return;

    if (!ok || !mj?.tex2svg) {
      el.textContent = texToUnicode(tex);
      el.dataset.r = tag;
      updated += 1;
      return;
    }

    let svgHtml = TEXC.get(tex);
    if (!svgHtml) {
      try {
        const rendered = mj.tex2svg(tex, { display: false });
        const svgEl = rendered.querySelector('svg');
        svgHtml = svgEl ? svgEl.outerHTML : escAttr(tex);
      } catch {
        svgHtml = tex;
      }
      TEXC.set(tex, svgHtml);
    }

    el.innerHTML = svgHtml;
    el.dataset.r = tag;
    updated += 1;
  });

  return updated;
}

/**
 * Pre-configure `window.MathJax` offline and load `/vendor/mathjax/tex-svg.js` from local static assets.
 */
export function loadMathJax(scriptUrl = getMathJaxScriptUrl()): Promise<MathJaxBrowserGlobal | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(null);
  }
  if (window.MathJax && typeof window.MathJax.tex2svg === 'function') {
    return Promise.resolve(window.MathJax);
  }
  if (mathJaxLoadPromise) {
    return mathJaxLoadPromise;
  }

  mathJaxLoadPromise = new Promise<MathJaxBrowserGlobal | null>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-offline-mathjax="1"]');
    if (existing && window.MathJax && typeof window.MathJax.tex2svg === 'function') {
      resolve(window.MathJax);
      return;
    }

    const prevConfig = window.MathJax ?? {};
    window.MathJax = {
      ...prevConfig,
      tex: { ...(prevConfig.tex ?? {}) },
      svg: { fontCache: 'none', ...(prevConfig.svg ?? {}) },
      options: { enableMenu: false, ...(prevConfig.options ?? {}) },
      startup: {
        ...(prevConfig.startup ?? {}),
        typeset: false,
        ready() {
          window.MathJax?.startup?.defaultReady?.();
          mathAll();
          resolve(window.MathJax ?? null);
        },
      },
    };

    const script = document.createElement('script');
    script.src = scriptUrl;
    script.async = true;
    script.dataset.offlineMathjax = '1';
    script.onload = () => {
      if (window.MathJax && typeof window.MathJax.tex2svg === 'function') {
        resolve(window.MathJax);
      }
    };
    script.onerror = () => {
      mathJaxLoadPromise = null;
      resolve(null);
    };
    document.head.appendChild(script);
  });

  return mathJaxLoadPromise;
}

/**
 * Compute target PNG pixel size `(W, H)` for a rendered MathJax SVG (`EXPX = 7.2`, max `600 px`).
 */
export function eqSize(svg: SVGElement): { W: number; H: number } {
  const w = parseFloat(svg.getAttribute('width') ?? '') || 10;
  const h = parseFloat(svg.getAttribute('height') ?? '') || 2;
  const k = Math.min(EXPX, 600 / w);
  return { W: Math.round(w * k), H: Math.round(h * k) };
}

function serializeSvgElement(svg: SVGElement): string {
  const raw =
    typeof XMLSerializer !== 'undefined'
      ? new XMLSerializer().serializeToString(svg)
      : svg.outerHTML;
  return raw.includes('xmlns=') ? raw : raw.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
}

function has2dCanvasContext(): boolean {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return false;
  try {
    const cv = document.createElement('canvas');
    return typeof cv.getContext === 'function' && !!cv.getContext('2d');
  } catch {
    return false;
  }
}

function rasterizeSvgDataUri(
  svgMarkup: string,
  pixelW: number,
  pixelH: number,
  timeoutMs = 4000,
): Promise<string> {
  if (!has2dCanvasContext()) {
    return Promise.reject(new Error('Canvas 2D context is unavailable for SVG rasterization.'));
  }

  return new Promise<string>((resolve, reject) => {
    const img = new Image();
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error('Timed out rasterizing SVG image.'));
    }, timeoutMs);

    img.onload = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        const cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.round(pixelW));
        cv.height = Math.max(1, Math.round(pixelH));
        const ctx = cv.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2D context missing.'));
          return;
        }
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.drawImage(img, 0, 0, cv.width, cv.height);
        resolve(cv.toDataURL('image/png'));
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err instanceof Error ? err : new Error('Failed to load SVG into Image.'));
    };

    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgMarkup);
  });
}

/**
 * Rasterize a MathJax equation SVG at `3x` resolution onto an opaque white `#fff` PNG data URL.
 */
export async function eqPng(
  svg: SVGElement,
  W: number,
  H: number,
  opts?: RasterizeOptions,
): Promise<string> {
  const clone = svg.cloneNode(true) as SVGElement;
  clone.setAttribute('width', String(W));
  clone.setAttribute('height', String(H));
  clone.removeAttribute('style');
  if (!clone.getAttribute('xmlns')) {
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }
  clone.setAttribute('color', '#000');

  const xml = serializeSvgElement(clone).replace(/currentColor/g, '#000');
  const k = 3;
  if (opts?.rasterize) {
    return opts.rasterize(xml, W * k, H * k);
  }
  return rasterizeSvgDataUri(xml, W * k, H * k, opts?.timeoutMs);
}

/**
 * Rasterize a report SVG figure at `2x` resolution onto an opaque white `#fff` PNG data URL.
 */
export async function svgPng(svg: SVGElement, opts?: RasterizeOptions): Promise<SvgPngResult> {
  const xml = serializeSvgElement(svg);
  const W = Number(svg.getAttribute('width')) || 560;
  const H = Number(svg.getAttribute('height')) || 300;
  const k = 2;

  const b64 = opts?.rasterize
    ? await opts.rasterize(xml, W * k, H * k)
    : await rasterizeSvgDataUri(xml, W * k, H * k, opts?.timeoutMs);

  return { b64, W, H };
}
