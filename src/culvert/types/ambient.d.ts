/**
 * Ambient TypeScript declarations for bundled browser dependencies lacking
 * complete `.d.ts` definitions and runtime globals exposed by offline scripts.
 */

declare module 'geotiff' {
  export interface GeoKeys {
    GTModelTypeGeoKey?: number;
    GeographicTypeGeoKey?: number;
    ProjectedCSTypeGeoKey?: number;
    [key: string]: unknown;
  }

  export interface ReadRastersOptions {
    window?: [number, number, number, number];
    samples?: number[];
    interleave?: boolean;
    width?: number;
    height?: number;
  }

  export type TypedRasterArray =
    | Int8Array
    | Uint8Array
    | Int16Array
    | Uint16Array
    | Int32Array
    | Uint32Array
    | Float32Array
    | Float64Array;

  export interface GeoTIFFImage {
    getWidth(): number;
    getHeight(): number;
    getBoundingBox(): [number, number, number, number];
    getOrigin(): [number, number, number];
    getResolution(referenceImage?: GeoTIFFImage): [number, number, number];
    getGeoKeys(): GeoKeys;
    getGDALNoData(): number | null;
    readRasters(options?: ReadRastersOptions): Promise<TypedRasterArray[] & { width: number; height: number }>;
  }

  export interface GeoTIFF {
    getImage(index?: number): Promise<GeoTIFFImage>;
    getImageCount(): Promise<number>;
  }

  export function fromArrayBuffer(arrayBuffer: ArrayBuffer): Promise<GeoTIFF>;
  export function fromBlob(blob: Blob): Promise<GeoTIFF>;
  export function fromUrl(url: string, headers?: Record<string, string>): Promise<GeoTIFF>;
}

declare module 'plotly.js-dist-min' {
  export interface PlotlyTrace {
    type?: string;
    mode?: string;
    name?: string;
    x?: unknown[];
    y?: unknown[];
    z?: unknown[];
    text?: string | string[];
    opacity?: number;
    colorscale?: unknown;
    showscale?: boolean;
    contours?: Record<string, unknown>;
    marker?: Record<string, unknown>;
    line?: Record<string, unknown>;
    hovertemplate?: string;
    [key: string]: unknown;
  }

  export interface PlotlyLayout {
    title?: string | Record<string, unknown>;
    margin?: { l?: number; r?: number; t?: number; b?: number };
    scene?: Record<string, unknown>;
    showlegend?: boolean;
    legend?: Record<string, unknown>;
    autosize?: boolean;
    width?: number;
    height?: number;
    [key: string]: unknown;
  }

  export interface PlotlyConfig {
    responsive?: boolean;
    displayModeBar?: boolean | 'hover';
    displaylogo?: boolean;
    locale?: string;
    [key: string]: unknown;
  }

  export interface PlotlyToImageOptions {
    format: 'png' | 'jpeg' | 'webp' | 'svg';
    width?: number;
    height?: number;
    scale?: number;
  }

  export interface PlotlyHTMLElement extends HTMLElement {
    data?: PlotlyTrace[];
    layout?: PlotlyLayout;
  }

  export function newPlot(
    root: HTMLElement | string,
    data: PlotlyTrace[],
    layout?: PlotlyLayout,
    config?: PlotlyConfig,
  ): Promise<PlotlyHTMLElement>;

  export function react(
    root: HTMLElement | string,
    data: PlotlyTrace[],
    layout?: PlotlyLayout,
    config?: PlotlyConfig,
  ): Promise<PlotlyHTMLElement>;

  export function relayout(root: HTMLElement | string, update: Partial<PlotlyLayout>): Promise<PlotlyHTMLElement>;
  export function purge(root: HTMLElement | string): void;
  export function toImage(root: HTMLElement | string, opts: PlotlyToImageOptions): Promise<string>;

  export const Plots: {
    resize(root: HTMLElement | string): Promise<PlotlyHTMLElement> | void;
  };

  const PlotlyDefault: {
    newPlot: typeof newPlot;
    react: typeof react;
    relayout: typeof relayout;
    purge: typeof purge;
    toImage: typeof toImage;
    Plots: typeof Plots;
  };

  export default PlotlyDefault;
}

declare module 'mathjax' {
  export interface MathJaxNodeConfig {
    loader?: { load?: string[]; [key: string]: unknown };
    tex?: Record<string, unknown>;
    svg?: Record<string, unknown>;
    [key: string]: unknown;
  }

  export interface MathJaxInstance {
    tex2svg?(tex: string, options?: { display?: boolean; em?: number; ex?: number; containerWidth?: number }): HTMLElement;
    tex2svgPromise?(tex: string, options?: { display?: boolean }): Promise<HTMLElement>;
    startup?: { promise?: Promise<void>; defaultReady?: () => void };
    [key: string]: unknown;
  }

  export function init(config?: MathJaxNodeConfig): Promise<MathJaxInstance>;
}

export interface MathJaxBrowserGlobal {
  loader?: { paths?: Record<string, string>; [key: string]: unknown };
  tex?: { inlineMath?: [string, string][]; [key: string]: unknown };
  svg?: { fontCache?: string; [key: string]: unknown };
  options?: { enableMenu?: boolean; enableAssistiveMml?: boolean; [key: string]: unknown };
  startup?: { typeset?: boolean; ready?: () => void; defaultReady?: () => void; promise?: Promise<void> };
  tex2svg?: (tex: string, options?: { display?: boolean; em?: number; ex?: number }) => HTMLElement;
  tex2svgPromise?: (tex: string, options?: { display?: boolean }) => Promise<HTMLElement>;
}

export interface PdfPageDebugEntry {
  sheetName: string;
  page: number;
  rows: number;
  widthPt: number;
  heightPt: number;
  coalesced?: boolean;
}

declare global {
  interface Window {
    MathJax?: MathJaxBrowserGlobal;
    __PDFPAGES?: PdfPageDebugEntry[];
    __biOK?: Record<string, boolean>;
    __ckErr?: string[];
    __ckModeOK?: number;
  }
}

export {};
