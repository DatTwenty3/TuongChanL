/**
 * Clean-room GeoTIFF DEM Loader & D8/Priority-Flood Watershed Extractor
 *
 * Verbatim TypeScript port of `analysis-cau-cong/modules/16_dem_watershed_ocr_dxf_import.js`
 * (`HVD`, `hdZst`, `hdMsg`, `hdOpts`, `HDSRC`, `hdLoadFiles`, `hdLoad`, `hdRun`, `hdShow`,
 * `hdDraw`, `hdFill`, `hdZip`, `hdSave`, `hdDxfFig`, `hdDxf`, `hdCopy`, `hvLVok`, `hvLV`),
 * refactored cleanly for direct ESM `geotiff` + `proj4` imports and offline `public/dem/*`
 * asset loading (zero CDN URLs, zero remote runtime bridges).
 */

import type { GeoTIFFImage } from 'geotiff';
import proj4 from 'proj4';
import {
  STATIC_DEM_FILES,
  type DemSourceKind,
  type DemWatershedResult,
  type Point2D,
} from '../../types/project';
import { HVSTL } from './stationsDb';

// ============================================================================
// 1. Offline Asset Resolution & Base64 Decoding Helpers
// ============================================================================

export const HDSRC: Readonly<Record<DemSourceKind, string>> = {
  cop: 'Copernicus GLO-30',
  srtm: 'SRTM 30 m',
  user: 'DEM tự nạp',
};

export function resolveDemAssetUrl(relPath: string): string {
  const env = (import.meta as { env?: { BASE_URL?: string } }).env;
  const baseRaw = (env && env.BASE_URL) || '/';
  const base = baseRaw.endsWith('/') ? baseRaw : baseRaw + '/';
  return base + String(relPath).replace(/^\/+/, '');
}

export function base64ToUint8Array(base64Text: string): Uint8Array {
  const clean = String(base64Text || '').replace(/\s+/g, '');
  const bin = atob(clean);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

function toArrayBuffer(buf: ArrayBuffer | ArrayBufferView): ArrayBuffer {
  if (buf instanceof ArrayBuffer) return buf;
  const view = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  const copy = new Uint8Array(view.byteLength);
  copy.set(view);
  return copy.buffer;
}

// ============================================================================
// 2. Types & State
// ============================================================================

export interface DemTile {
  name: string;
  src: DemSourceKind;
  sc: number;
  im: GeoTIFFImage;
  bb: [number, number, number, number];
  rx: number;
  ry: number;
  W: number;
  H: number;
  nd: number | null;
}

export interface DemGrid {
  z: Float32Array;
  nx: number;
  ny: number;
  w: number;
  n: number;
  rx: number;
  ry: number;
  dx: number;
  dy: number;
}

export interface D8FlowResult {
  dir: Int32Array;
  acc: Float64Array;
  ord: Int32Array;
}

export interface StreamBranch {
  P: number[];
  L: number;
}

export interface HvdRunOptions {
  ll: boolean;
  lon0: number;
  E: number;
  N: number;
  R?: number;
  thr: number;
  snap: number;
  two: boolean;
  mm?: string;
  src?: DemSourceKind;
  cmp?: boolean;
  ten?: string;
}

export interface HvdRunResult extends DemWatershedResult {
  G: DemGrid;
  f: Float64Array;
  F: D8FlowResult;
  M: Uint8Array;
  oi: number;
  isS: (i: number) => boolean;
  main: number[];
  br: StreamBranch[];
  brk: StreamBranch[];
  zo: number;
  pick: number | null;
  ten?: string;
}

interface HdCanvasBox {
  x: number;
  y: number;
  bw: number;
  bh: number;
  draw: () => void;
}

interface HdLayoutState {
  c0: number;
  r0: number;
  sx: number;
  sy: number;
  G: DemGrid;
  o: HvdRunOptions;
  boxes: Array<{ b: HdCanvasBox; L: Array<[string, string?, string?]>; sw: number }>;
  leads: number[][];
  dot: [number, number];
  out: [number, number];
  north: [number, number];
  r2: HvdRunResult | null;
}

export interface HvdState {
  tiles: DemTile[];
  busy: boolean;
  res: HvdRunResult | null;
  res2?: HvdRunResult | null;
  o?: HvdRunOptions;
  lastKey?: string;
  zst?: Record<string, { z: number | null; zm: number; zx: number; zn: number } | null>;
  zsrc?: DemSourceKind | null;
  view?: { c0: number; r0: number; sx: number; sy: number };
  lay?: HdLayoutState;
}

let onStepHook: (() => void) | null = null;

export function setDemStepHook(fn: (() => void) | null): void {
  onStepHook = fn;
}

// ============================================================================
// 3. `HVD` Watershed Engine (`geotiff` + `proj4` + Priority-Flood + D8)
// ============================================================================

const vnProjDef = (lon0: number): string =>
  `+proj=tmerc +lat_0=0 +lon_0=${lon0} +k=0.9999 +x_0=500000 +y_0=0 +ellps=WGS84 +towgs84=-191.90441429,-39.30318279,-111.45032835,-0.00928836,0.01975479,-0.00427372,0.252906278 +units=m +no_defs`;

const S: HvdState = {
  tiles: [],
  busy: false,
  res: null,
};

function libs(): Promise<void> {
  return Promise.resolve();
}

function toVN(lon0: number, lon: number, lat: number): Point2D {
  return proj4('WGS84', vnProjDef(lon0), [lon, lat]) as Point2D;
}

function fromVN(lon0: number, E: number, N: number): Point2D {
  return proj4(vnProjDef(lon0), 'WGS84', [E, N]) as Point2D;
}

async function addBuffer(
  buf: ArrayBuffer | ArrayBufferView,
  name: string,
  src?: DemSourceKind,
  sc?: number,
): Promise<DemTile> {
  await libs();
  const ab = toArrayBuffer(buf);
  // geotiff (+ bộ giải nén) chỉ nạp khi người dùng nạp DEM
  const { fromArrayBuffer } = await import('geotiff');
  const t = await fromArrayBuffer(ab);
  const im = await t.getImage();
  const gk = im.getGeoKeys() || {};
  if (gk.GTModelTypeGeoKey && gk.GTModelTypeGeoKey !== 2) {
    throw new Error(name + ': DEM phải ở hệ tọa độ địa lý WGS84 (kinh độ, vĩ độ).');
  }
  const fd = (
    im as GeoTIFFImage & { getFileDirectory?: () => Record<string, unknown> }
  ).getFileDirectory?.();
  const ndRaw = fd && fd.GDAL_NODATA != null ? parseFloat(String(fd.GDAL_NODATA)) : im.getGDALNoData();
  const nd = ndRaw != null && Number.isFinite(ndRaw) ? ndRaw : null;
  const bb = im.getBoundingBox();
  const r = im.getResolution();
  const tile: DemTile = {
    name,
    src: src || 'user',
    sc: sc || 1,
    im,
    bb,
    rx: r[0],
    ry: Math.abs(r[1]),
    W: im.getWidth(),
    H: im.getHeight(),
    nd,
  };
  S.tiles.push(tile);
  return tile;
}

async function grid(
  lon: number,
  lat: number,
  Rkm: number,
  src?: DemSourceKind,
): Promise<DemGrid> {
  const T = S.tiles.filter((t) => t.src === (src || 'user'));
  const t0 = T.find((t) => lon >= t.bb[0] && lon <= t.bb[2] && lat >= t.bb[1] && lat <= t.bb[3]);
  if (!t0) throw new Error('Vị trí công trình nằm ngoài phạm vi DEM đã nạp.');
  const rx = t0.rx;
  const ry = t0.ry;
  const dLat = Rkm / 111.32;
  const dLon = Rkm / (111.32 * Math.cos((lat * Math.PI) / 180));
  const w = lon - dLon;
  const n = lat + dLat;
  const nx = Math.round((2 * dLon) / rx);
  const ny = Math.round((2 * dLat) / ry);
  const z = new Float32Array(nx * ny).fill(NaN);

  for (const t of T) {
    const c0 = Math.floor((w - t.bb[0]) / t.rx);
    const r0 = Math.floor((t.bb[3] - n) / t.ry);
    const c1 = c0 + nx;
    const r1 = r0 + ny;
    const a0 = Math.max(0, c0);
    const b0 = Math.max(0, r0);
    const a1 = Math.min(t.W, c1);
    const b1 = Math.min(t.H, r1);
    if (a1 <= a0 || b1 <= b0) continue;
    const d = (await t.im.readRasters({
      window: [a0, b0, a1, b1],
      samples: [0],
      interleave: true,
    })) as unknown as ArrayLike<number>;
    const ww = a1 - a0;
    for (let r = b0; r < b1; r++) {
      for (let c = a0; c < a1; c++) {
        const v = d[(r - b0) * ww + (c - a0)];
        if (t.nd != null && v === t.nd) continue;
        const u = v * t.sc;
        if (u < -500 || u > 9000) continue;
        z[(r - r0) * nx + (c - c0)] = u;
      }
    }
  }

  const lat0 = n - (ny * ry) / 2;
  const my = 111132.954 - 559.822 * Math.cos((2 * lat0 * Math.PI) / 180);
  const mx =
    111412.84 * Math.cos((lat0 * Math.PI) / 180) - 93.5 * Math.cos((3 * lat0 * Math.PI) / 180);
  return { z, nx, ny, w, n, rx, ry, dx: rx * mx, dy: ry * my };
}

/** Priority-Flood + 1e-4 epsilon pit-filling (Barnes 2014). */
function fill(G: DemGrid): Float64Array {
  const { z, nx, ny } = G;
  const N = nx * ny;
  const f = new Float64Array(N);
  const done = new Uint8Array(N);
  const hp = new Int32Array(N + 8);
  const hv = new Float64Array(N + 8);
  let hn = 0;

  const push = (i: number, v: number): void => {
    let k = hn++;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (hv[p] <= v) break;
      hp[k] = hp[p];
      hv[k] = hv[p];
      k = p;
    }
    hp[k] = i;
    hv[k] = v;
  };

  const pop = (): number => {
    const i = hp[0];
    const last = hp[--hn];
    const lv = hv[hn];
    let k = 0;
    for (;;) {
      let c = 2 * k + 1;
      if (c >= hn) break;
      if (c + 1 < hn && hv[c + 1] < hv[c]) c++;
      if (hv[c] >= lv) break;
      hp[k] = hp[c];
      hv[k] = hv[c];
      k = c;
    }
    hp[k] = last;
    hv[k] = lv;
    return i;
  };

  for (let i = 0; i < N; i++) {
    const r = (i / nx) | 0;
    const c = i - r * nx;
    if (Number.isNaN(z[i])) {
      done[i] = 1;
      f[i] = -1e9;
      continue;
    }
    let edge = r === 0 || c === 0 || r === ny - 1 || c === nx - 1;
    if (!edge) {
      for (let a = -1; a <= 1 && !edge; a++) {
        for (let b = -1; b <= 1; b++) {
          if (Number.isNaN(z[i + a * nx + b])) {
            edge = true;
            break;
          }
        }
      }
    }
    if (edge) {
      done[i] = 1;
      f[i] = z[i];
      push(i, z[i]);
    }
  }

  while (hn) {
    const i = pop();
    const r = (i / nx) | 0;
    const c = i - r * nx;
    for (let a = -1; a <= 1; a++) {
      for (let b = -1; b <= 1; b++) {
        if (!a && !b) continue;
        const rr = r + a;
        const cc = c + b;
        if (rr < 0 || cc < 0 || rr >= ny || cc >= nx) continue;
        const j = rr * nx + cc;
        if (done[j]) continue;
        done[j] = 1;
        f[j] = Math.max(z[j], f[i] + 1e-4);
        push(j, f[j]);
      }
    }
  }
  return f;
}

/** D8 flow direction + Kahn topological flow accumulation. */
function flow(G: DemGrid, f: Float64Array): D8FlowResult {
  const { z, nx, ny, dx, dy } = G;
  const N = nx * ny;
  const dir = new Int32Array(N).fill(-1);
  const dd = Math.hypot(dx, dy);

  for (let i = 0; i < N; i++) {
    if (Number.isNaN(z[i])) continue;
    const r = (i / nx) | 0;
    const c = i - r * nx;
    let best = 0;
    let bj = -1;
    for (let a = -1; a <= 1; a++) {
      for (let b = -1; b <= 1; b++) {
        if (!a && !b) continue;
        const rr = r + a;
        const cc = c + b;
        if (rr < 0 || cc < 0 || rr >= ny || cc >= nx) continue;
        const j = rr * nx + cc;
        if (Number.isNaN(z[j])) continue;
        const s = (f[i] - f[j]) / (a && b ? dd : a ? dy : dx);
        if (s > best) {
          best = s;
          bj = j;
        }
      }
    }
    dir[i] = bj;
  }

  const ind = new Int32Array(N);
  for (let i = 0; i < N; i++) if (dir[i] >= 0) ind[dir[i]]++;
  const ord = new Int32Array(N);
  let h = 0;
  let t = 0;
  for (let i = 0; i < N; i++) if (!Number.isNaN(z[i]) && ind[i] === 0) ord[t++] = i;
  const acc = new Float64Array(N).fill(1);
  while (h < t) {
    const i = ord[h++];
    const j = dir[i];
    if (j >= 0) {
      acc[j] += acc[i];
      if (--ind[j] === 0) ord[t++] = j;
    }
  }
  return { dir, acc, ord: ord.subarray(0, t) };
}

function stepLen(G: DemGrid, i: number, j: number): number {
  const r = (i / G.nx) | 0;
  const c = i - r * G.nx;
  const r2 = (j / G.nx) | 0;
  const c2 = j - r2 * G.nx;
  return Math.hypot((c2 - c) * G.dx, (r2 - r) * G.dy);
}

function dp(P: Point2D[], tol: number): Point2D[] {
  if (P.length < 3) return P;
  const keep = new Uint8Array(P.length);
  keep[0] = keep[P.length - 1] = 1;
  const st: Array<[number, number]> = [[0, P.length - 1]];
  while (st.length) {
    const [a, b] = st.pop()!;
    let mx = 0;
    let k = -1;
    const [x1, y1] = P[a];
    const [x2, y2] = P[b];
    const L = Math.hypot(x2 - x1, y2 - y1) || 1e-9;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((x2 - x1) * (y1 - P[i][1]) - (x1 - P[i][0]) * (y2 - y1)) / L;
      if (d > mx) {
        mx = d;
        k = i;
      }
    }
    if (mx > tol && k > 0) {
      keep[k] = 1;
      st.push([a, k], [k, b]);
    }
  }
  return P.filter((_p, i) => keep[i]);
}

function chaikin(P: Point2D[], n: number): Point2D[] {
  let Q = P.slice();
  if (Q.length > 2 && Q[0][0] === Q[Q.length - 1][0] && Q[0][1] === Q[Q.length - 1][1]) Q.pop();
  for (let k = 0; k < n; k++) {
    const R: Point2D[] = [];
    for (let i = 0; i < Q.length; i++) {
      const a = Q[i];
      const c = Q[(i + 1) % Q.length];
      R.push(
        [0.75 * a[0] + 0.25 * c[0], 0.75 * a[1] + 0.25 * c[1]],
        [0.25 * a[0] + 0.75 * c[0], 0.25 * a[1] + 0.75 * c[1]],
      );
    }
    Q = R;
  }
  return Q;
}

function outline(G: DemGrid, M: Uint8Array): Point2D[] {
  const { nx, ny } = G;
  const E = new Map<string, Array<[number, number, number, number]>>();
  const key = (x: number, y: number) => x + ',' + y;
  const inn = (r: number, c: number) =>
    r >= 0 && c >= 0 && r < ny && c < nx && M[r * nx + c] !== 0;

  const add = (x1: number, y1: number, x2: number, y2: number): void => {
    const k = key(x1, y1);
    if (!E.has(k)) E.set(k, []);
    E.get(k)!.push([x1, y1, x2, y2]);
  };

  for (let r = 0; r < ny; r++) {
    for (let c = 0; c < nx; c++) {
      if (!M[r * nx + c]) continue;
      if (!inn(r - 1, c)) add(c, r, c + 1, r);
      if (!inn(r, c + 1)) add(c + 1, r, c + 1, r + 1);
      if (!inn(r + 1, c)) add(c + 1, r + 1, c, r + 1);
      if (!inn(r, c - 1)) add(c, r + 1, c, r);
    }
  }

  let best: Point2D[] = [];
  let bestA = 0;
  for (;;) {
    let k0: string | null = null;
    for (const [k, a] of E) {
      if (a.length) {
        k0 = k;
        break;
      }
    }
    if (k0 === null) break;
    let e: [number, number, number, number] | undefined = E.get(k0)!.pop();
    const loop: Point2D[] = [];
    let guard = 0;
    while (e && guard++ < 4e6) {
      loop.push([e[0], e[1]]);
      const a = E.get(key(e[2], e[3]));
      if (!a || !a.length) break;
      const dx = e[2] - e[0];
      const dy = e[3] - e[1];
      let bi = 0;
      if (a.length > 1) {
        let bc = 1e9;
        a.forEach((f, ii) => {
          const cr = dx * (f[3] - f[1]) - dy * (f[2] - f[0]);
          if (cr < bc) {
            bc = cr;
            bi = ii;
          }
        });
      }
      e = a.splice(bi, 1)[0];
    }
    let A = 0;
    for (let t = 0; t < loop.length; t++) {
      const p = loop[t];
      const q = loop[(t + 1) % loop.length];
      A += p[0] * q[1] - q[0] * p[1];
    }
    A = Math.abs(A) / 2;
    if (A > bestA) {
      bestA = A;
      best = loop;
    }
  }
  return best;
}

interface NetBasinContext {
  G: DemGrid;
  f: Float64Array;
  F: D8FlowResult;
  M: Uint8Array;
  oi: number;
  cnt: number;
  cA: number;
  R: number;
  edge: boolean;
  nodata: boolean;
  lon: number;
  lat: number;
}

function net(b: NetBasinContext, o: HvdRunOptions, pick: number | null): HvdRunResult {
  const { G, f, F, M, oi, cnt, cA, R, edge, nodata, lon, lat } = b;
  const { nx, ny, z } = G;
  const N = nx * ny;
  const Fkm = (cnt * cA) / 1e6;
  const thr = Math.max(2, Math.round((o.thr * 1e6) / cA));

  const isS = (i: number): boolean => M[i] !== 0 && F.acc[i] >= thr;
  const up = new Float64Array(N);
  const upn = new Int32Array(N).fill(-1);

  for (let k = 0; k < F.ord.length; k++) {
    const i = F.ord[k];
    if (!isS(i)) continue;
    const j = F.dir[i];
    if (j >= 0 && isS(j)) {
      const L = up[i] + stepLen(G, i, j);
      if (L > up[j]) {
        up[j] = L;
        upn[j] = i;
      }
    }
  }

  const path = (s: number): number[] => {
    const P = [s];
    let i = s;
    while (upn[i] >= 0) {
      i = upn[i];
      P.push(i);
    }
    return P.reverse();
  };

  let main: number[] | null = null;
  if (pick != null && isS(pick)) {
    const dn: number[] = [];
    let i = pick;
    while (i >= 0 && i !== oi) {
      dn.push(i);
      i = F.dir[i];
    }
    if (i === oi) {
      const up0 = path(pick);
      main = [...up0.slice(0, -1), ...dn, oi];
    }
  }
  if (!main && o.mm === 'dt') {
    main = [oi];
    let i = oi;
    for (;;) {
      const r = (i / nx) | 0;
      const c = i - r * nx;
      let bj = -1;
      let bv = 0;
      for (let a = -1; a <= 1; a++) {
        for (let bb = -1; bb <= 1; bb++) {
          const rr = r + a;
          const cc = c + bb;
          if (rr < 0 || cc < 0 || rr >= ny || cc >= nx) continue;
          const j = rr * nx + cc;
          if (F.dir[j] === i && isS(j) && F.acc[j] > bv) {
            bv = F.acc[j];
            bj = j;
          }
        }
      }
      if (bj < 0) break;
      main.push(bj);
      i = bj;
    }
    main.reverse();
  }
  if (!main) main = path(oi);

  const asg = new Uint8Array(N);
  main.forEach((i) => (asg[i] = 1));
  const br: StreamBranch[] = [];
  let q = [...main];
  while (q.length) {
    const nq: number[] = [];
    for (const j of q) {
      const r = (j / nx) | 0;
      const c = j - r * nx;
      for (let a = -1; a <= 1; a++) {
        for (let bb = -1; bb <= 1; bb++) {
          const rr = r + a;
          const cc = c + bb;
          if (rr < 0 || cc < 0 || rr >= ny || cc >= nx) continue;
          const i = rr * nx + cc;
          if (asg[i] || !isS(i) || F.dir[i] !== j) continue;
          const P = path(i);
          P.forEach((k) => (asg[k] = 1));
          let L = stepLen(G, i, j);
          for (let k = 1; k < P.length; k++) L += stepLen(G, P[k - 1], P[k]);
          br.push({ P: [...P, j], L });
          nq.push(...P);
        }
      }
    }
    q = nq;
  }

  let Lm = 0;
  for (let k = 1; k < main.length; k++) Lm += stepLen(G, main[k - 1], main[k]);
  const L = Lm / 1000;
  const B = o.two ? Fkm / (2 * L) : Fkm / L;
  const brk = br.filter((brItem) => brItem.L / 1000 > 0.75 * B);
  const sl = brk.reduce((t, brItem) => t + brItem.L, 0) / 1000;

  let s = 0;
  const prof: Array<[number, number]> = [];
  for (let k = main.length - 1; k >= 0; k--) {
    if (k < main.length - 1) s += stepLen(G, main[k + 1], main[k]);
    prof.push([s / 1000, z[main[k]]]);
  }
  const zo = prof[0][1];
  let Js = 0;
  for (let k = 1; k < prof.length; k++) {
    Js += (prof[k - 1][1] - zo + (prof[k][1] - zo)) * (prof[k][0] - prof[k - 1][0]);
  }
  const Jls = L > 0 ? Js / (L * L) : NaN;

  // 3x3 Horn slope on hillslope cells (outside stream network)
  let sj = 0;
  let nj = 0;
  for (let i = 0; i < N; i++) {
    if (!M[i] || isS(i)) continue;
    const r = (i / nx) | 0;
    const c = i - r * nx;
    if (r < 1 || c < 1 || r >= ny - 1 || c >= nx - 1) continue;
    const Z = (a: number, bb: number): number => {
      const v = z[(r + a) * nx + c + bb];
      return Number.isNaN(v) ? z[i] : v;
    };
    const gx =
      (Z(-1, 1) + 2 * Z(0, 1) + Z(1, 1) - (Z(-1, -1) + 2 * Z(0, -1) + Z(1, -1))) / (8 * G.dx);
    const gy =
      (Z(1, -1) + 2 * Z(1, 0) + Z(1, 1) - (Z(-1, -1) + 2 * Z(-1, 0) + Z(-1, 1))) / (8 * G.dy);
    sj += Math.hypot(gx, gy);
    nj++;
  }
  const Jsd = nj ? (sj / nj) * 1000 : NaN;

  const ll = (c: number, r: number): Point2D => [G.w + c * G.rx, G.n - r * G.ry];
  const vn = (c: number, r: number): Point2D => {
    const [a, bb] = ll(c, r);
    return o.ll ? [a, bb] : toVN(o.lon0, a, bb);
  };
  const ctr = (i: number): Point2D => {
    const r = (i / nx) | 0;
    const c = i - r * nx;
    return vn(c + 0.5, r + 0.5);
  };

  const tol = o.ll ? 0.3 * G.rx : 0.5 * Math.min(G.dx, G.dy);
  const bnd = chaikin(
    dp(
      outline(G, M).map(([c, r]) => vn(c, r)),
      tol,
    ),
    2,
  );
  if (
    bnd.length &&
    (bnd[0][0] !== bnd[bnd.length - 1][0] || bnd[0][1] !== bnd[bnd.length - 1][1])
  ) {
    bnd.push(bnd[0]);
  }
  const mainP = dp(main.map(ctr), tol * 0.5);
  const brP = brk.map((brItem) => dp(brItem.P.map(ctr), tol * 0.5));
  const brO = br.filter((brItem) => !brk.includes(brItem)).map((brItem) => dp(brItem.P.map(ctr), tol * 0.5));

  return {
    src: o.src || 'user',
    G,
    f,
    F,
    M,
    oi,
    isS,
    main,
    br,
    brk,
    Fkm,
    L,
    B,
    sl,
    Jls,
    Jsd,
    prof,
    bnd,
    mainP,
    brP,
    brO,
    R,
    edge,
    nodata,
    thr,
    zo,
    cnt,
    cA,
    lon,
    lat,
    outVN: ctr(oi),
    pick,
  };
}

function repick(pick: number, o: HvdRunOptions): HvdRunResult | null {
  const r = S.res;
  if (!r) return null;
  S.res = net(r, o, pick);
  S.res.src = r.src;
  return S.res;
}

async function run(o: HvdRunOptions): Promise<HvdRunResult> {
  await libs();
  const src: DemSourceKind = o.src || 'user';
  if (!S.tiles.some((t) => t.src === src)) throw new Error('Chưa nạp DEM.');
  const [lon, lat] = o.ll ? [o.E, o.N] : fromVN(o.lon0, o.E, o.N);
  let R = o.R || 8;
  let out: HvdRunResult | null = null;

  for (let it = 0; it < 4; it++) {
    const G = await grid(lon, lat, R, src);
    const f = fill(G);
    const F = flow(G, f);
    const { nx, ny, z } = G;
    const N = nx * ny;
    const cA = G.dx * G.dy;

    const c0 = Math.floor((lon - G.w) / G.rx);
    const r0 = Math.floor((G.n - lat) / G.ry);
    const rs = Math.max(1, Math.round(o.snap / Math.min(G.dx, G.dy)));
    let oi = -1;
    let ov = 0;
    for (let a = -rs; a <= rs; a++) {
      for (let b = -rs; b <= rs; b++) {
        const r = r0 + a;
        const c = c0 + b;
        if (r < 0 || c < 0 || r >= ny || c >= nx) continue;
        if (Math.hypot(a * G.dy, b * G.dx) > o.snap) continue;
        const i = r * nx + c;
        if (F.acc[i] > ov && !Number.isNaN(z[i])) {
          ov = F.acc[i];
          oi = i;
        }
      }
    }
    if (oi < 0) throw new Error('Không tìm được cửa ra gần vị trí công trình.');

    const M = new Uint8Array(N);
    M[oi] = 1;
    const memo = new Int8Array(N);
    memo[oi] = 1;
    const inB = (i: number): boolean => {
      const st: number[] = [];
      let j = i;
      while (j >= 0 && memo[j] === 0) {
        st.push(j);
        j = F.dir[j];
      }
      const v: 1 | -1 = j >= 0 && memo[j] === 1 ? 1 : -1;
      for (let q = 0; q < st.length; q++) memo[st[q]] = v;
      return v === 1;
    };

    let cnt = 0;
    let edge = false;
    let nodata = false;
    for (let i = 0; i < N; i++) {
      if (Number.isNaN(z[i])) continue;
      if (inB(i)) {
        M[i] = 1;
        cnt++;
        const r = (i / nx) | 0;
        const c = i - r * nx;
        if (r === 0 || c === 0 || r === ny - 1 || c === nx - 1) edge = true;
        for (let a = -1; a <= 1; a++) {
          for (let b = -1; b <= 1; b++) {
            const rr = r + a;
            const cc = c + b;
            if (rr >= 0 && cc >= 0 && rr < ny && cc < nx && Number.isNaN(z[rr * nx + cc])) {
              nodata = true;
            }
          }
        }
      }
    }
    if (edge && it < 3) {
      R *= 1.6;
      continue;
    }
    out = net({ G, f, F, M, oi, cnt, cA, R, edge, nodata, lon, lat }, o, null);
    out.src = src;
    break;
  }

  if (!out) throw new Error('Không tìm được lưu vực.');
  S.res = out;
  return out;
}

const nf = (v: number): string => (Math.abs(v) < 1000 ? v.toFixed(7) : v.toFixed(3));

const plcmd = (pts: ReadonlyArray<Point2D>, close: boolean | number): string =>
  '_.PLINE\n' +
  pts.map((p) => '_non ' + nf(p[0]) + ',' + nf(p[1])).join('\n') +
  '\n' +
  (close ? '_C\n' : '\n');

function dxf(r: HvdRunResult): string {
  const L: string[] = [];
  const P = (ly: string, pts: ReadonlyArray<Point2D>, cl: number | boolean, col: number): void => {
    L.push(
      '0',
      'POLYLINE',
      '8',
      ly,
      '62',
      String(col),
      '66',
      '1',
      '70',
      cl ? '1' : '0',
      '10',
      '0',
      '20',
      '0',
      '30',
      '0',
    );
    pts.forEach((p) => L.push('0', 'VERTEX', '8', ly, '10', nf(p[0]), '20', nf(p[1]), '30', '0'));
    L.push('0', 'SEQEND', '8', ly);
  };
  const lay: Array<[string, number]> = [
    ['LUU_VUC', 6],
    ['SUOI_CHINH', 1],
    ['SUOI_NHANH', 5],
    ['SUOI_KHAC', 4],
    ['CUA_RA', 1],
    ['GHI_CHU', 1],
  ];
  const H: string[] = ['0', 'SECTION', '2', 'TABLES', '0', 'TABLE', '2', 'LAYER', '70', String(lay.length)];
  lay.forEach(([n, c]) =>
    H.push('0', 'LAYER', '2', n, '70', '0', '62', String(c), '6', 'CONTINUOUS'),
  );
  H.push('0', 'ENDTAB', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES');
  P('LUU_VUC', r.bnd.slice(0, -1), 1, 6);
  P('SUOI_CHINH', r.mainP, 0, 1);
  r.brP.forEach((p) => P('SUOI_NHANH', p, 0, 5));
  r.brO.forEach((p) => P('SUOI_KHAC', p, 0, 4));
  const o = r.outVN;
  L.push(
    '0',
    'CIRCLE',
    '8',
    'CUA_RA',
    '10',
    nf(o[0]),
    '20',
    nf(o[1]),
    '30',
    '0',
    '40',
    Math.abs(o[0]) < 1000 ? '0.0001' : '10',
  );
  if (Math.abs(o[0]) >= 1000) {
    const bx = r.bnd.map((p) => p[0]);
    const by = r.bnd.map((p) => p[1]);
    const x0 = Math.min(...bx);
    const x1 = Math.max(...bx);
    const y1 = Math.max(...by);
    const y0 = Math.min(...by);
    const th = Math.max(15, Math.round(Math.max(x1 - x0, y1 - y0) / 60));
    const cx = bx.reduce((a, b) => a + b, 0) / bx.length;
    const cy = by.reduce((a, b) => a + b, 0) / by.length;
    const T = (x: number, y: number, t: string, c?: number): void => {
      L.push(
        '0',
        'TEXT',
        '8',
        'GHI_CHU',
        '62',
        String(c || 1),
        '10',
        nf(x),
        '20',
        nf(y),
        '30',
        '0',
        '40',
        String(th),
        '1',
        t,
      );
    };
    T(o[0] + th, o[1] + th, r.ten || 'VI TRI CONG TRINH', 1);
    T(cx - th * 6, cy, 'F = ' + r.Fkm.toFixed(2) + ' km2', 6);
    T(x1 + th * 3, y1, 'Chieu dai suoi chinh L = ' + r.L.toFixed(2) + ' km', 1);
    T(x1 + th * 3, y1 - th * 2, 'Tong chieu dai suoi nhanh = ' + r.sl.toFixed(2) + ' km', 5);
  }
  return [...H, ...L, '0', 'ENDSEC', '0', 'EOF'].join('\r\n');
}

async function zAround(
  lon: number,
  lat: number,
  rkm: number,
  src: DemSourceKind,
): Promise<{ z: number | null; zm: number; zx: number; zn: number } | null> {
  const T = S.tiles.filter((t) => t.src === src);
  const t = T.find((q) => lon >= q.bb[0] && lon <= q.bb[2] && lat >= q.bb[1] && lat <= q.bb[3]);
  if (!t) return null;
  const dLat = rkm / 111.32;
  const dLon = rkm / (111.32 * Math.cos((lat * Math.PI) / 180));
  const st = Math.max(1, Math.round(dLat / t.ry / 60));
  const c0 = Math.max(0, Math.floor((lon - dLon - t.bb[0]) / t.rx));
  const c1 = Math.min(t.W, Math.ceil((lon + dLon - t.bb[0]) / t.rx));
  const r0 = Math.max(0, Math.floor((t.bb[3] - lat - dLat) / t.ry));
  const r1 = Math.min(t.H, Math.ceil((t.bb[3] - lat + dLat) / t.ry));
  const d = (await t.im.readRasters({
    window: [c0, r0, c1, r1],
    samples: [0],
    interleave: true,
  })) as unknown as ArrayLike<number>;
  const w = c1 - c0;
  let s = 0;
  let n = 0;
  let z0: number | null = null;
  let best = 1e18;
  let zx = -1e9;
  let zn = 1e9;
  for (let r = r0; r < r1; r += st) {
    for (let c = c0; c < c1; c += st) {
      const v = d[(r - r0) * w + (c - c0)];
      if (t.nd != null && v === t.nd) continue;
      const z = v * t.sc;
      if (z < -100 || z > 9000) continue;
      const x = (t.bb[0] + (c + 0.5) * t.rx - lon) * 111.32 * Math.cos((lat * Math.PI) / 180);
      const y = (t.bb[3] - (r + 0.5) * t.ry - lat) * 111.32;
      const dd = x * x + y * y;
      if (dd <= rkm * rkm) {
        s += z;
        n++;
        zx = Math.max(zx, z);
        zn = Math.min(zn, z);
      }
      if (dd < best) {
        best = dd;
        z0 = z;
      }
    }
  }
  return n ? { z: z0, zm: s / n, zx, zn } : null;
}

export const HVD = {
  S,
  libs,
  addBuffer,
  run,
  repick,
  dxf,
  plcmd,
  toVN,
  fromVN,
  zAround,
  grid,
  fill,
  flow,
  net,
  stepLen,
};

// ============================================================================
// 4. Clean Pure APIs for Node/Browser Tests & UI Stores
// ============================================================================

export async function loadDemFromBase64Chunks(
  chunks: string[],
  name: string,
  src: DemSourceKind,
  sc: number,
): Promise<DemTile> {
  const joined = chunks.map((s) => s.trim()).join('');
  const bytes = base64ToUint8Array(joined);
  return addBuffer(bytes, name, src, sc);
}

export async function loadBuiltinDem(
  src: 'cop' | 'srtm',
  readTextChunk?: (relPath: string) => Promise<string> | string,
): Promise<void> {
  if (S.tiles.some((t) => t.src === src)) return;
  const parts =
    src === 'cop' ? [STATIC_DEM_FILES[0], STATIC_DEM_FILES[1]] : [STATIC_DEM_FILES[2]];
  let t = '';
  for (const rel of parts) {
    if (readTextChunk) {
      t += String(await readTextChunk(rel)).trim();
    } else {
      const r = await fetch(resolveDemAssetUrl(rel));
      if (!r.ok) throw new Error('Không tải được DEM ' + HDSRC[src] + '.');
      t += (await r.text()).trim();
    }
  }
  const bytes = base64ToUint8Array(t);
  await addBuffer(bytes, HDSRC[src] + ' - Thanh Hóa', src, src === 'cop' ? 0.1 : 1);
}

export function toDemWatershedResult(r: HvdRunResult): DemWatershedResult {
  return {
    src: r.src,
    Fkm: r.Fkm,
    L: r.L,
    B: r.B,
    sl: r.sl,
    Jls: r.Jls,
    Jsd: r.Jsd,
    R: r.R,
    edge: r.edge,
    nodata: r.nodata,
    thr: r.thr,
    cnt: r.cnt,
    cA: r.cA,
    lon: r.lon,
    lat: r.lat,
    outVN: r.outVN,
    bnd: r.bnd,
    mainP: r.mainP,
    brP: r.brP,
    brO: r.brO,
    prof: r.prof,
  };
}

export async function runWatershed(options: HvdRunOptions): Promise<HvdRunResult> {
  return run(options);
}

// ============================================================================
// 5. DOM / Canvas Visualization, DXF Export & Report Formatting (`hd*`, `hvLV`)
// ============================================================================

const fx = (x: number | null | undefined, d = 1): string =>
  x == null || !Number.isFinite(x) ? '' : x.toFixed(d);
const hvF = (v: number | null | undefined, d = 2): string =>
  v == null || !Number.isFinite(v) ? '-' : fx(v, d);
const hvP = (t: string): string => `<p class="small">${t}</p>`;
const hvSel = (t: string): string => `<p><b>Chọn kết quả tính theo ${t}.</b></p>`;
const hvTab = (
  head: string[],
  rows: Array<Array<string> | { sel?: boolean; c: string[] }>,
): string =>
  '<table class="t dt"><tr>' +
  head.map((h) => `<th>${h}</th>`).join('') +
  '</tr>' +
  rows
    .map((r) => {
      const sel = !Array.isArray(r) && r.sel;
      const cells = Array.isArray(r) ? r : r.c;
      return (
        `<tr${sel ? ' style="background:#fff2cc"' : ''}>` +
        cells.map((c, i) => `<td${i === 0 ? ' class="l"' : ''}>${c}</td>`).join('') +
        '</tr>'
      );
    })
    .join('') +
  '</table>';

export function hdMsg(t: string, bad?: boolean | number): void {
  if (typeof document === 'undefined') return;
  const e = document.getElementById('hd_msg');
  if (e) {
    e.innerHTML = t;
    e.className = 'small' + (bad ? ' bad' : '');
  }
}

export function hdOpts(): HvdRunOptions {
  const g = (id: string): string => {
    if (typeof document === 'undefined') return '';
    const e = document.getElementById('hv_' + id) as
      | HTMLInputElement
      | HTMLSelectElement
      | null;
    return e ? e.value : '';
  };
  const n = (id: string): number => parseFloat(String(g(id)).replace(',', '.'));
  const srcRaw = g('dsrc') || 'cop';
  const src: DemSourceKind = srcRaw === 'srtm' || srcRaw === 'user' ? srcRaw : 'cop';
  return {
    ll: g('dcs') === 'll',
    lon0: n('dk0') || 105,
    E: n('dE'),
    N: n('dN'),
    R: n('dR') || 8,
    thr: n('dthr') || 0.05,
    snap: n('dsnap') || 150,
    two: g('two') !== '1',
    mm: g('dmain') || 'dai',
    src,
    cmp: g('dcmp') !== '0',
  };
}

export async function hdZst(): Promise<void> {
  try {
    const o = hdOpts();
    if (!Number.isFinite(o.E) || !Number.isFinite(o.N)) return;
    await libs();
    const src: DemSourceKind | null = S.tiles.some((t) => t.src === 'cop')
      ? 'cop'
      : S.tiles.some((t) => t.src === 'srtm')
        ? 'srtm'
        : null;
    if (!src) return;
    const Z: NonNullable<HvdState['zst']> = {};
    const [lo, la] = o.ll ? [o.E, o.N] : fromVN(o.lon0, o.E, o.N);
    Z._ct = await zAround(lo, la, 5, src);
    for (const s of HVSTL) {
      const [a, b] = fromVN(105, s.E, s.N);
      Z[s.n] = await zAround(a, b, 5, src);
    }
    S.zst = Z;
    S.zsrc = src;
    if (onStepHook) onStepHook();
  } catch (e) {
    console.error(e);
  }
}

export async function hdLoadFiles(fl: FileList | ReadonlyArray<File>): Promise<void> {
  try {
    hdMsg('Đang đọc DEM…');
    for (const f of Array.from(fl)) {
      await addBuffer(await f.arrayBuffer(), f.name, 'user', 1);
    }
    if (typeof document !== 'undefined') {
      const e = document.getElementById('hv_dsrc') as HTMLSelectElement | null;
      if (e) e.value = 'user';
    }
    hdMsg(
      'Đã nạp: ' +
        S.tiles
          .filter((t) => t.src === 'user')
          .map((t) => t.name)
          .join(', '),
    );
  } catch (e) {
    hdMsg(e instanceof Error ? e.message : String(e), 1);
  }
}

export async function hdLoad(src: DemSourceKind): Promise<void> {
  if (src === 'user' || S.tiles.some((t) => t.src === src)) return;
  hdMsg('Đang tải DEM ' + HDSRC[src] + ' tỉnh Thanh Hóa…');
  await loadBuiltinDem(src);
}

export async function hdRun(): Promise<void> {
  const o = hdOpts();
  const o2: HvdRunOptions | null = o.cmp
    ? { ...o, src: o.src === 'cop' ? 'srtm' : 'cop', mm: o.mm === 'chon' ? 'dai' : o.mm }
    : null;
  if (
    o.mm === 'chon' &&
    S.res &&
    S.res.pick != null &&
    S.lastKey === [o.E, o.N, o.thr, o.snap, o.src].join()
  ) {
    const rRepicked = repick(S.res.pick, o);
    if (rRepicked) hdShow(rRepicked, o);
    return;
  }
  S.lastKey = [o.E, o.N, o.thr, o.snap, o.src].join();
  if (!Number.isFinite(o.E) || !Number.isFinite(o.N)) {
    hdMsg('Nhập tọa độ vị trí công trình.', 1);
    return;
  }
  try {
    hdMsg('Đang tính…');
    await libs();
    await hdLoad(o.src || 'cop');
    if (!S.tiles.some((t) => t.src === (o.src || 'cop'))) {
      hdMsg('Chưa có DEM: chọn file GeoTIFF ở ô bên trên.', 1);
      return;
    }
    await new Promise((r) => setTimeout(r, 30));
    const t0 = performance.now();
    let r2: HvdRunResult | null = null;
    let e2 = '';
    if (o2) {
      try {
        await hdLoad(o2.src || 'srtm');
        r2 = await run(o2);
      } catch (e) {
        console.error(e);
        r2 = null;
        e2 =
          ' <b class="bad">Không tính được theo ' +
          HDSRC[o2.src || 'srtm'] +
          ': ' +
          (e instanceof Error ? e.message : String(e)) +
          '</b>';
      }
    }
    const r = await run(o);
    S.res2 = r2;
    S.o = o;
    hdShow(r, o);
    void hdZst();
    hdMsg(
      `Đã khoanh xong (${((performance.now() - t0) / 1000).toFixed(1)} s).` +
        e2 +
        (r.edge
          ? ' <b class="bad">Lưu vực chạm biên vùng tính: tăng bán kính vùng tính.</b>'
          : '') +
        (r.nodata
          ? ' <b class="bad">Lưu vực chạm vùng không có số liệu DEM (ngoài ranh giới tỉnh): diện tích có thể thiếu, kiểm tra trên bản đồ.</b>'
          : ''),
    );
  } catch (e) {
    console.error(e);
    hdMsg('Lỗi: ' + (e instanceof Error ? e.message : String(e)), 1);
  }
}

export function hdShow(r: HvdRunResult, o: HvdRunOptions): void {
  if (typeof document === 'undefined') return;
  const tb = document.getElementById('hd_res');
  const r2 = S.res2 && S.res2.src !== r.src ? S.res2 : null;
  const n1 = HDSRC[r.src] || '';
  const n2 = r2 ? HDSRC[r2.src] : '';
  const rows: Array<
    [
      string | ((x: HvdRunResult) => string),
      string,
      (x: HvdRunResult) => string,
      string,
      ((x: HvdRunResult) => number) | null,
    ]
  > = [
    [
      'Tọa độ cửa ra (dò về lòng suối)',
      '',
      (x) =>
        o.ll
          ? `${fx(x.outVN[0], 5)} ; ${fx(x.outVN[1], 5)}`
          : `x = ${fx(x.outVN[0], 2)} ; y = ${fx(x.outVN[1], 2)}`,
      o.ll ? 'độ' : 'm',
      null,
    ],
    ['Cao độ đáy tại cửa ra', '', (x) => fx(x.zo, 2), 'm', (x) => x.zo],
    ['Diện tích lưu vực', 'F', (x) => fx(x.Fkm, 3), 'km²', (x) => x.Fkm],
    [
      'Chiều dài lòng chính (từ chỗ hình thành lòng đến công trình)',
      'L',
      (x) => fx(x.L, 3),
      'km',
      (x) => x.L,
    ],
    ['Chiều rộng bình quân lưu vực', 'B', (x) => fx(x.B, 3), 'km', (x) => x.B],
    [
      (x) => `Tổng chiều dài lòng nhánh dài hơn 0,75B (${x.brk.length}/${x.br.length} nhánh)`,
      'Σl',
      (x) => fx(x.sl, 3),
      'km',
      (x) => x.sl,
    ],
    ['Độ dốc bình quân lòng chính (TCVN 9845 PT 4)', 'Jls', (x) => fx(x.Jls, 1), '‰', (x) => x.Jls],
    [
      'Độ dốc bình quân sườn dốc (trung bình các ô ngoài lòng suối)',
      'Jsd',
      (x) => fx(x.Jsd, 1),
      '‰',
      (x) => x.Jsd,
    ],
  ];
  if (tb) {
    tb.innerHTML =
      `<tr><th>Đại lượng</th><th>Ký hiệu</th><th>${n1}${r2 ? ' (dùng tính)' : ''}</th>${r2 ? `<th>${n2}</th><th>Chênh lệch</th>` : ''}<th>Đơn vị</th></tr>` +
      rows
        .map((a) => {
          const lb = typeof a[0] === 'function' ? a[0](r) : a[0];
          const d =
            r2 && a[4]
              ? (() => {
                  const u = a[4]!(r);
                  const v = a[4]!(r2);
                  return Number.isFinite(u) && Number.isFinite(v) && v
                    ? fx(((u - v) / v) * 100, 1) + ' %'
                    : '';
                })()
              : '';
          return `<tr><td class="l">${lb}</td><td class="c">${a[1]}</td><td>${a[2](r)}</td>${r2 ? `<td>${a[2](r2)}</td><td>${d}</td>` : ''}<td class="c">${a[3]}</td></tr>`;
        })
        .join('') +
      (r2
        ? `<tr><td class="l" colspan="6">Chênh lệch = (${n1} − ${n2}) / ${n2}. Số liệu điền vào bảng tính lấy theo ${n1}.</td></tr>`
        : '');
  }
  hdDraw(r);
  hdFill(1);
  const b = document.getElementById('hd_btns');
  if (b) b.hidden = false;
}

export function hdDraw(r: HvdRunResult): void {
  if (typeof document === 'undefined') return;
  const cv = document.getElementById('hd_cv') as HTMLCanvasElement | null;
  if (!cv) return;
  const ctx = cv.getContext('2d');
  if (!ctx) return;

  const { G, M, isS, main } = r;
  const { nx, ny, z } = G;
  let c0 = nx;
  let c1 = 0;
  let r0 = ny;
  let r1 = 0;
  for (let i = 0; i < nx * ny; i++) {
    if (M[i]) {
      const rr = (i / nx) | 0;
      const cc = i - rr * nx;
      c0 = Math.min(c0, cc);
      c1 = Math.max(c1, cc);
      r0 = Math.min(r0, rr);
      r1 = Math.max(r1, rr);
    }
  }
  const pad = Math.round(Math.max(c1 - c0, r1 - r0) * 0.28) + 12;
  c0 = Math.max(0, c0 - pad);
  r0 = Math.max(0, r0 - pad);
  c1 = Math.min(nx - 1, c1 + pad);
  r1 = Math.min(ny - 1, r1 + pad);
  const w = c1 - c0 + 1;
  const h = r1 - r0 + 1;
  const ar = (h * G.dy) / (w * G.dx);
  const W = 760;
  const H = Math.round(Math.min(700, W * ar));
  const W2 = Math.round(H / ar);
  cv.width = W2;
  cv.height = H;
  const img = ctx.createImageData(W2, H);

  let zmin = 1e9;
  let zmax = -1e9;
  for (let rr = r0; rr <= r1; rr++) {
    for (let cc = c0; cc <= c1; cc++) {
      const v = z[rr * nx + cc];
      if (!Number.isNaN(v)) {
        zmin = Math.min(zmin, v);
        zmax = Math.max(zmax, v);
      }
    }
  }

  const main1 = new Uint8Array(nx * ny);
  main.forEach((i) => (main1[i] = 1));
  const brkMask = new Uint8Array(nx * ny);
  r.brk.forEach((b) => b.P.forEach((i) => (brkMask[i] = 1)));

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W2; x++) {
      const cc = c0 + Math.floor((x / W2) * w);
      const rr = r0 + Math.floor((y / H) * h);
      const i = rr * nx + cc;
      const v = z[i];
      let R = 230;
      let Gc = 230;
      let B = 230;
      if (!Number.isNaN(v)) {
        const zl = (a: number, b: number): number => {
          const j = (rr + a) * nx + cc + b;
          const u = z[j];
          return Number.isNaN(u) ? v : u;
        };
        const gx = (zl(0, 1) - zl(0, -1)) / (2 * G.dx);
        const gy = (zl(1, 0) - zl(-1, 0)) / (2 * G.dy);
        const hs = Math.max(0, Math.min(1, 0.75 + (-gx * 0.7 + gy * 0.7) * 1.5));
        const t = (v - zmin) / (zmax - zmin || 1);
        R = (150 + 90 * t) * hs;
        Gc = (190 + 40 * (1 - t)) * hs;
        B = (140 + 60 * t) * hs;
        if (M[i]) {
          R = R * 0.8 + 40;
          Gc = Gc * 0.8 + 40;
          B = B * 0.8 + 60;
        }
      }
      if (isS(i) && !main1[i] && !brkMask[i]) {
        R = 110;
        Gc = 175;
        B = 225;
      }
      const k = (y * W2 + x) * 4;
      img.data[k] = R;
      img.data[k + 1] = Gc;
      img.data[k + 2] = B;
      img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const sx = W2 / w;
  const sy = H / h;
  S.view = { c0, r0, sx, sy };

  ctx.strokeStyle = '#e000e0';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < nx * ny; i++) {
    if (!M[i]) continue;
    const rr = (i / nx) | 0;
    const cc = i - rr * nx;
    const x = (cc - c0) * sx;
    const y = (rr - r0) * sy;
    const inn = (a: number, b: number): boolean => {
      const r2 = rr + a;
      const c2 = cc + b;
      return r2 >= 0 && c2 >= 0 && r2 < ny && c2 < nx && M[r2 * nx + c2] !== 0;
    };
    if (!inn(-1, 0)) {
      ctx.moveTo(x, y);
      ctx.lineTo(x + sx, y);
    }
    if (!inn(1, 0)) {
      ctx.moveTo(x, y + sy);
      ctx.lineTo(x + sx, y + sy);
    }
    if (!inn(0, -1)) {
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + sy);
    }
    if (!inn(0, 1)) {
      ctx.moveTo(x + sx, y);
      ctx.lineTo(x + sx, y + sy);
    }
  }
  ctx.stroke();

  const XY = (i: number): [number, number] => {
    const rr = (i / nx) | 0;
    const cc = i - rr * nx;
    return [(cc - c0 + 0.5) * sx, (rr - r0 + 0.5) * sy];
  };
  const pl = (P: number[], col: string, lw: number): void => {
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    P.forEach((i, k) => {
      const [x, y] = XY(i);
      if (k) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    });
    ctx.stroke();
  };
  r.brk.forEach((b) => pl(b.P, '#0028ff', 2.6));
  pl(main, '#ff0000', 3.2);

  const r2 = S.res2 && S.res2.src !== r.src ? S.res2 : null;
  const oo = S.o || hdOpts();
  if (r2) {
    const px = (p: Point2D): [number, number] => {
      const [lo, la] = oo.ll ? p : fromVN(oo.lon0, p[0], p[1]);
      return [((lo - G.w) / G.rx - c0) * sx, ((G.n - la) / G.ry - r0) * sy];
    };
    const pv = (P: Point2D[], col: string, lw: number, cl: number): void => {
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.setLineDash([9, 5]);
      ctx.beginPath();
      P.forEach((p, k) => {
        const [x, y] = px(p);
        if (k) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      if (cl) ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
    };
    pv(r2.bnd, '#ff9900', 2.4, 1);
    pv(r2.mainP, '#ff9900', 1.8, 0);
  }

  const [ox, oy] = XY(r.oi);
  ctx.fillStyle = '#ff0000';
  ctx.strokeStyle = '#800000';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(ox, oy, 6, 0, 7);
  ctx.fill();
  ctx.stroke();

  const box = (
    lines: Array<[string, string?, string?]>,
    x: number,
    y: number,
    opt: { sw?: number } = {},
  ): HdCanvasBox => {
    ctx.font = 'bold 14px Arial';
    const pd = 7;
    const lh = 20;
    const sw = opt.sw || 0;
    const tw = Math.max(...lines.map((t) => ctx.measureText(t[0]).width)) + sw;
    const bw = tw + 2 * pd;
    const bh = lines.length * lh + 2 * pd - 4;
    const bx = Math.max(4, Math.min(W2 - bw - 4, x));
    const by = Math.max(4, Math.min(H - bh - 4, y));
    return {
      x: bx,
      y: by,
      bw,
      bh,
      draw() {
        ctx.fillStyle = '#ffff70';
        ctx.strokeStyle = '#1030c0';
        ctx.lineWidth = 1.5;
        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeRect(bx, by, bw, bh);
        lines.forEach((t, k) => {
          const yy = by + pd + k * lh + 11;
          if (t[2]) {
            ctx.strokeStyle = t[2];
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(bx + pd, yy);
            ctx.lineTo(bx + pd + sw - 10, yy);
            ctx.stroke();
          }
          ctx.fillStyle = t[1] || '#e00000';
          ctx.textBaseline = 'middle';
          ctx.fillText(t[0], bx + pd + sw, yy);
        });
        ctx.textBaseline = 'alphabetic';
      },
    };
  };

  const cov = (x: number, y: number, bw: number, bh: number): number => {
    let n = 0;
    const a0 = c0 + Math.floor(x / sx);
    const a1 = c0 + Math.ceil((x + bw) / sx);
    const b0 = r0 + Math.floor(y / sy);
    const b1 = r0 + Math.ceil((y + bh) / sy);
    for (let rr = Math.max(0, b0); rr <= Math.min(ny - 1, b1); rr++) {
      for (let cc = Math.max(0, a0); cc <= Math.min(nx - 1, a1); cc++) {
        if (M[rr * nx + cc]) n++;
      }
    }
    return n;
  };

  const LGL: Array<[string, string?, string?]> = [
    ['Chiều dài suối chính L = ' + fx(r.L, 2) + ' km', '#e00000', '#ff0000'],
    ['Tổng chiều dài suối nhánh Σl = ' + fx(r.sl, 2) + ' km', '#0020d0', '#0028ff'],
    ['Ranh giới lưu vực' + (r2 ? ' (' + HDSRC[r.src] + ')' : ''), '#a000a0', '#e000e0'],
  ];
  if (r2) {
    LGL.push([
      'Ranh giới, suối chính theo ' +
        HDSRC[r2.src] +
        ': F = ' +
        fx(r2.Fkm, 2) +
        ' km², L = ' +
        fx(r2.L, 2) +
        ' km',
      '#c06000',
      '#ff9900',
    ]);
  }
  const lg = box(LGL, 0, 0, { sw: 46 });
  let best: { v: number; x: number; y: number } | null = null;
  (
    [
      [4, 4],
      [W2 - lg.bw - 4, 4],
      [4, H - lg.bh - 4],
      [W2 - lg.bw - 4, H - lg.bh - 4],
    ] as Array<[number, number]>
  ).forEach(([x, y]) => {
    const v = cov(x, y, lg.bw, lg.bh);
    if (!best || v < best.v) best = { v, x, y };
  });
  const LG = box(LGL, best!.x, best!.y, { sw: 46 });

  let gx = 0;
  let gy = 0;
  let gn = 0;
  for (let i = 0; i < nx * ny; i++) {
    if (M[i]) {
      const [x, y] = XY(i);
      gx += x;
      gy += y;
      gn++;
    }
  }
  gx /= gn;
  gy /= gn;
  let ai = -1;
  let ad = 1e18;
  for (let i = 0; i < nx * ny; i++) {
    if (M[i] && !isS(i)) {
      const [x, y] = XY(i);
      const d = (x - gx) ** 2 + (y - gy) ** 2;
      if (d < ad) {
        ad = d;
        ai = i;
      }
    }
  }
  const [ax, ay] = ai >= 0 ? XY(ai) : [gx, gy];
  const FL: Array<[string, string?]> = [['Diện tích lưu vực F = ' + fx(r.Fkm, 2) + ' km²', '#a000a0']];
  const FB = box(FL, 0, 0);
  const ov = (a: HdCanvasBox, b: HdCanvasBox): boolean =>
    !(a.x + a.bw < b.x || b.x + b.bw < a.x || a.y + a.bh < b.y || b.y + b.bh < a.y);

  let fb: HdCanvasBox | null = null;
  let fv = 1e18;
  for (let y = 4; y < H - FB.bh; y += 12) {
    for (let x = 4; x < W2 - FB.bw; x += 12) {
      const c = box(FL, x, y);
      const v =
        cov(c.x, c.y, c.bw, c.bh) * 1e4 +
        (ov(c, LG) ? 1e12 : 0) +
        Math.hypot(x + c.bw / 2 - ax, y + c.bh / 2 - ay) +
        (Math.hypot(x + c.bw / 2 - ox, y + c.bh / 2 - oy) < 120 ? 1e6 : 0);
      if (v < fv) {
        fv = v;
        fb = c;
      }
    }
  }
  const fbBox = fb || FB;

  const lead = (b: HdCanvasBox, px: number, py: number): void => {
    const cx = Math.max(b.x, Math.min(b.x + b.bw, px));
    const cy = Math.max(b.y, Math.min(b.y + b.bh, py));
    ctx.strokeStyle = '#1030c0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(cx, cy);
    ctx.stroke();
  };
  lead(fbBox, ax, ay);
  ctx.fillStyle = '#a000a0';
  ctx.beginPath();
  ctx.arc(ax, ay, 3.5, 0, 7);
  ctx.fill();

  const dtenEl = document.getElementById('hv_dten') as HTMLInputElement | null;
  const tn = ((dtenEl || {}).value || 'VỊ TRÍ CÔNG TRÌNH').trim() || 'VỊ TRÍ CÔNG TRÌNH';
  const VB = box([[tn]], 0, 0);
  let vb: HdCanvasBox | null = null;
  let bv = 1e18;
  for (const [dx, dy] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ]) {
    const d = dx && dy ? 60 : 80;
    const x = ox + dx * d - (dx < 0 ? VB.bw : dx === 0 ? VB.bw / 2 : 0);
    const y = oy + dy * d - (dy < 0 ? VB.bh : dy === 0 ? VB.bh / 2 : 0);
    const c = box([[tn]], x, y);
    const v = cov(c.x, c.y, c.bw, c.bh) + (ov(c, LG) ? 1e9 : 0) + (ov(c, fbBox) ? 1e9 : 0);
    if (v < bv) {
      bv = v;
      vb = c;
    }
  }
  const vbBox = vb || VB;
  ctx.strokeStyle = '#1030c0';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(ox, oy);
  const cx =
    Math.abs(vbBox.x - ox) < Math.abs(vbBox.x + vbBox.bw - ox) ? vbBox.x : vbBox.x + vbBox.bw;
  const cy =
    Math.abs(vbBox.y - oy) < Math.abs(vbBox.y + vbBox.bh - oy) ? vbBox.y : vbBox.y + vbBox.bh;
  ctx.lineTo(cx, cy);
  ctx.stroke();

  vbBox.draw();
  fbBox.draw();
  LG.draw();

  const nx0 = W2 - 22;
  const ny0 = best!.y < 10 && best!.x > W2 / 2 ? H - 50 : 14;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.moveTo(nx0, ny0);
  ctx.lineTo(nx0 - 7, ny0 + 22);
  ctx.lineTo(nx0, ny0 + 17);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(nx0, ny0);
  ctx.lineTo(nx0 + 7, ny0 + 22);
  ctx.lineTo(nx0, ny0 + 17);
  ctx.stroke();
  ctx.font = 'bold 13px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('B', nx0, ny0 + 36);
  ctx.textAlign = 'left';

  const fl: number[] = (() => {
    const fcx = Math.max(fbBox.x, Math.min(fbBox.x + fbBox.bw, ax));
    const fcy = Math.max(fbBox.y, Math.min(fbBox.y + fbBox.bh, ay));
    return [ax, ay, fcx, fcy];
  })();
  S.lay = {
    c0,
    r0,
    sx,
    sy,
    G,
    o: oo,
    boxes: [
      { b: vbBox, L: [[tn, '#e00000']], sw: 0 },
      { b: fbBox, L: FL, sw: 0 },
      { b: LG, L: LGL, sw: 46 },
    ],
    leads: [[ox, oy, cx, cy], fl],
    dot: [ax, ay],
    out: [ox, oy],
    north: [nx0, ny0],
    r2,
  };
}

export function hdFill(quiet?: number | boolean): void {
  if (typeof document === 'undefined') return;
  const r = S.res;
  if (!r) return;
  const set = (id: string, v: string): void => {
    const e = document.getElementById('hv_' + id) as
      | HTMLInputElement
      | HTMLTextAreaElement
      | HTMLSelectElement
      | null;
    if (!e) return;
    e.value = v;
    e.dispatchEvent(new Event('input', { bubbles: true }));
    e.dispatchEvent(new Event('change', { bubbles: true }));
  };
  set('F', r.Fkm.toFixed(3));
  set('L', r.L.toFixed(3));
  set('sl', r.sl.toFixed(3));
  set('Jls', r.Jls.toFixed(1));
  set('Jsd', r.Jsd.toFixed(1));
  const st = Math.max(1, Math.ceil(r.prof.length / 300));
  const pr = r.prof
    .filter((_p, k) => k % st === 0 || k === r.prof.length - 1)
    .map((p) => p[0].toFixed(3) + ' ' + p[1].toFixed(2))
    .join('\n');
  set('prof', pr);
  set('jm', 'p');
  if (!quiet) {
    hdMsg('Đã điền F, L, Σl, Jsd và trắc dọc lòng chính (Jls tính theo PT 4) vào số liệu thủy văn.');
  }
}

let hdZipTable: number[] | null = null;
export function hdZip(name: string, text: string): Blob {
  const enc = new TextEncoder();
  const d = enc.encode(text);
  const nm = enc.encode(name);
  const crcT =
    hdZipTable ||
    (hdZipTable = Array.from({ length: 256 }, (_, n) => {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      return c >>> 0;
    }));
  let crc = 0xffffffff;
  for (let i = 0; i < d.length; i++) crc = crcT[(crc ^ d[i]) & 255] ^ (crc >>> 8);
  crc = (crc ^ 0xffffffff) >>> 0;
  const lh = new DataView(new ArrayBuffer(30));
  const ch = new DataView(new ArrayBuffer(46));
  const ed = new DataView(new ArrayBuffer(22));
  (
    [
      [0, 0x04034b50, 4],
      [4, 20, 2],
      [6, 0x0800, 2],
      [8, 0, 2],
      [10, 0, 2],
      [12, 0x21, 2],
      [14, crc, 4],
      [18, d.length, 4],
      [22, d.length, 4],
      [26, nm.length, 2],
      [28, 0, 2],
    ] as Array<[number, number, 2 | 4]>
  ).forEach(([o, v, n]) => (n === 4 ? lh.setUint32(o, v, true) : lh.setUint16(o, v, true)));
  (
    [
      [0, 0x02014b50, 4],
      [4, 20, 2],
      [6, 20, 2],
      [8, 0x0800, 2],
      [10, 0, 2],
      [12, 0, 2],
      [14, 0x21, 2],
      [16, crc, 4],
      [20, d.length, 4],
      [24, d.length, 4],
      [28, nm.length, 2],
      [30, 0, 2],
      [32, 0, 2],
      [34, 0, 2],
      [36, 0, 2],
      [38, 0, 4],
      [42, 0, 4],
    ] as Array<[number, number, 2 | 4]>
  ).forEach(([o, v, n]) => (n === 4 ? ch.setUint32(o, v, true) : ch.setUint16(o, v, true)));
  const off = 30 + nm.length + d.length;
  const cs = 46 + nm.length;
  (
    [
      [0, 0x06054b50, 4],
      [4, 0, 2],
      [6, 0, 2],
      [8, 1, 2],
      [10, 1, 2],
      [12, cs, 4],
      [16, off, 4],
      [20, 0, 2],
    ] as Array<[number, number, 2 | 4]>
  ).forEach(([o, v, n]) => (n === 4 ? ed.setUint32(o, v, true) : ed.setUint16(o, v, true)));
  return new Blob([lh, nm, d, ch, nm, ed], { type: 'application/zip' });
}

export async function hdSave(name: string, text: string): Promise<void> {
  if (typeof document === 'undefined') return;
  const a = document.createElement('a');
  const url = URL.createObjectURL(new Blob([text], { type: 'application/dxf' }));
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  hdMsg('Đã lưu ' + name + '.');
}

export function hdDxfFig(r: HvdRunResult): string {
  const Y = S.lay;
  if (!Y) return dxf(r);
  const { c0, r0, sx, sy, G, o } = Y;
  const pv = (x: number, y: number): Point2D => {
    const c = c0 + x / sx;
    const rr = r0 + y / sy;
    const lo = G.w + c * G.rx;
    const la = G.n - rr * G.ry;
    return o.ll ? [lo, la] : toVN(o.lon0, lo, la);
  };
  const a0 = pv(0, 0);
  const a1 = pv(0, 10);
  const mpp = Math.hypot(a1[0] - a0[0], a1[1] - a0[1]) / 10;
  const aci = (c: string): number =>
    ({
      '#e00000': 1,
      '#ff0000': 1,
      '#0020d0': 5,
      '#0028ff': 5,
      '#a000a0': 6,
      '#e000e0': 6,
      '#c06000': 30,
      '#ff9900': 30,
    })[c] || 7;
  const uni = (t: string): string =>
    [...t]
      .map((ch) => {
        const k = ch.codePointAt(0)!;
        return k < 128 ? ch : '\\U+' + k.toString(16).toUpperCase().padStart(4, '0');
      })
      .join('');

  const L: string[] = [];
  const PL = (
    ly: string,
    pts: ReadonlyArray<Point2D>,
    cl: number | boolean,
    col: number,
    w?: number,
    lt?: string | 0,
  ): void => {
    if (pts.length < 2) return;
    L.push(
      '0',
      'POLYLINE',
      '8',
      ly,
      '62',
      String(col),
      ...(lt ? ['6', lt] : []),
      '66',
      '1',
      '70',
      cl ? '1' : '0',
      '10',
      '0',
      '20',
      '0',
      '30',
      '0',
      ...(w ? ['40', nf(w), '41', nf(w)] : []),
    );
    pts.forEach((p) => L.push('0', 'VERTEX', '8', ly, '10', nf(p[0]), '20', nf(p[1]), '30', '0'));
    L.push('0', 'SEQEND', '8', ly);
  };
  const SO = (ly: string, col: number, P: Point2D[]): void => {
    L.push('0', 'SOLID', '8', ly, '62', String(col));
    (
      [
        [10, 20],
        [11, 21],
        [12, 22],
        [13, 23],
      ] as Array<[number, number]>
    ).forEach((k, i) =>
      L.push(String(k[0]), nf(P[i][0]), String(k[1]), nf(P[i][1]), '3' + String(k[0])[1], '0'),
    );
  };
  const TX = (
    ly: string,
    col: number,
    x: number,
    y: number,
    h: number,
    t: string,
    al?: number,
  ): void => {
    const p = pv(x, y);
    L.push(
      '0',
      'TEXT',
      '8',
      ly,
      '62',
      String(col),
      '10',
      nf(p[0]),
      '20',
      nf(p[1]),
      '30',
      '0',
      '40',
      nf(h),
      '1',
      uni(t),
      '7',
      'ARIAL',
      '72',
      String(al || 0),
      '73',
      '2',
      '11',
      nf(p[0]),
      '21',
      nf(p[1]),
      '31',
      '0',
    );
  };
  const DOT = (ly: string, col: number, p: Point2D, rad: number): void => {
    L.push(
      '0',
      'POLYLINE',
      '8',
      ly,
      '62',
      String(col),
      '66',
      '1',
      '70',
      '1',
      '40',
      nf(rad),
      '41',
      nf(rad),
      '10',
      '0',
      '20',
      '0',
      '30',
      '0',
    );
    L.push(
      '0',
      'VERTEX',
      '8',
      ly,
      '10',
      nf(p[0] - rad / 2),
      '20',
      nf(p[1]),
      '30',
      '0',
      '42',
      '1',
      '0',
      'VERTEX',
      '8',
      ly,
      '10',
      nf(p[0] + rad / 2),
      '20',
      nf(p[1]),
      '30',
      '0',
      '42',
      '1',
      '0',
      'SEQEND',
      '8',
      ly,
    );
  };

  const bnd = r.bnd.slice(0, -1);
  if (Y.r2) {
    PL('SO_SANH_DEM', Y.r2.bnd.slice(0, -1), 1, 30, 1.6 * mpp, 'DASHED');
    PL('SO_SANH_DEM', Y.r2.mainP, 0, 30, 1.4 * mpp, 'DASHED');
  }
  PL('LUU_VUC', bnd, 1, 6, 2.5 * mpp);
  r.brP.forEach((p) => PL('SUOI_NHANH', p, 0, 5, 2 * mpp));
  PL('SUOI_CHINH', r.mainP, 0, 1, 2.6 * mpp);
  DOT('GHI_CHU', 1, pv(Y.out[0], Y.out[1]), 12 * mpp);
  DOT('GHI_CHU', 6, pv(Y.dot[0], Y.dot[1]), 7 * mpp);
  Y.leads.forEach((l) => PL('GHI_CHU', [pv(l[0], l[1]), pv(l[2], l[3])], 0, 5, 1.2 * mpp));

  const pd = 7;
  const lh = 20;
  const th = 10 * mpp;
  Y.boxes.forEach(({ b, L: lines, sw }) => {
    const P = [
      pv(b.x, b.y),
      pv(b.x + b.bw, b.y),
      pv(b.x + b.bw, b.y + b.bh),
      pv(b.x, b.y + b.bh),
    ];
    SO('GHI_CHU_NEN', 51, [P[0], P[1], P[3], P[2]]);
    PL('GHI_CHU', P, 1, 5);
    lines.forEach((t, k) => {
      const yy = b.y + pd + k * lh + 11;
      if (t[2]) {
        PL(
          'GHI_CHU',
          [pv(b.x + pd, yy), pv(b.x + pd + sw - 10, yy)],
          0,
          aci(t[2]),
          3 * mpp,
          t[2] === '#ff9900' && Y.r2 ? 'DASHED' : 0,
        );
      }
      TX('GHI_CHU', aci(t[1] || '#e00000'), b.x + pd + sw, yy, th, t[0], 0);
    });
  });

  const [nx0, ny0] = Y.north;
  const N1 = pv(nx0, ny0);
  const N2 = pv(nx0 - 7, ny0 + 22);
  const N3 = pv(nx0, ny0 + 17);
  const N4 = pv(nx0 + 7, ny0 + 22);
  SO('GHI_CHU', 7, [N1, N2, N3, N3]);
  PL('GHI_CHU', [N1, N4, N3], 0, 7);
  TX('GHI_CHU', 7, nx0 - 4, ny0 + 36, th, 'B', 0);

  const lay: Array<[string, number]> = [
    ['LUU_VUC', 6],
    ['SUOI_CHINH', 1],
    ['SUOI_NHANH', 5],
    ['SO_SANH_DEM', 30],
    ['GHI_CHU', 1],
    ['GHI_CHU_NEN', 51],
  ];
  const dl = 9 * mpp;
  const gp = 5 * mpp;
  const H: string[] = [
    '0',
    'SECTION',
    '2',
    'TABLES',
    '0',
    'TABLE',
    '2',
    'LTYPE',
    '70',
    '2',
    '0',
    'LTYPE',
    '2',
    'CONTINUOUS',
    '70',
    '0',
    '3',
    'Solid line',
    '72',
    '65',
    '73',
    '0',
    '40',
    '0.0',
    '0',
    'LTYPE',
    '2',
    'DASHED',
    '70',
    '0',
    '3',
    '__ __ __',
    '72',
    '65',
    '73',
    '2',
    '40',
    nf(dl + gp),
    '49',
    nf(dl),
    '49',
    nf(-gp),
    '0',
    'ENDTAB',
    '0',
    'TABLE',
    '2',
    'STYLE',
    '70',
    '1',
    '0',
    'STYLE',
    '2',
    'ARIAL',
    '70',
    '0',
    '40',
    '0.0',
    '41',
    '1.0',
    '50',
    '0.0',
    '71',
    '0',
    '42',
    nf(th),
    '3',
    'arial.ttf',
    '4',
    '',
    '0',
    'ENDTAB',
    '0',
    'TABLE',
    '2',
    'LAYER',
    '70',
    String(lay.length),
  ];
  lay.forEach(([n, c]) =>
    H.push(
      '0',
      'LAYER',
      '2',
      n,
      '70',
      '0',
      '62',
      String(c),
      '6',
      n === 'SO_SANH_DEM' ? 'DASHED' : 'CONTINUOUS',
    ),
  );
  H.push('0', 'ENDTAB', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES');
  return [...H, ...L, '0', 'ENDSEC', '0', 'EOF'].join('\r\n');
}

export function hdDxf(): void {
  const r = S.res;
  if (!r) return;
  void hdSave('Luu vuc.dxf', hdDxfFig(r));
}

export async function hdCopy(k: 'bnd' | 'main' | 'br'): Promise<void> {
  const r = S.res;
  if (!r) return;
  const t =
    k === 'bnd'
      ? plcmd(r.bnd.slice(0, -1), 1)
      : k === 'main'
        ? plcmd(r.mainP, 0)
        : r.brP.map((p) => plcmd(p, 0)).join('');
  try {
    await navigator.clipboard.writeText(t);
    hdMsg('Đã sao chép lệnh vẽ: dán (Ctrl+V) vào dòng lệnh CAD.');
  } catch {
    if (typeof document !== 'undefined') {
      const ta = document.getElementById('hd_txt') as HTMLTextAreaElement | null;
      if (ta) {
        ta.hidden = false;
        ta.value = t;
        ta.select();
      }
    }
    hdMsg('Trình duyệt không cho sao chép tự động: chọn toàn bộ nội dung ô bên dưới và sao chép.');
  }
}

export function hvLVok(I: { F: number }): boolean {
  const r = S.res;
  return Boolean(
    r &&
      typeof document !== 'undefined' &&
      document.getElementById('hd_cv') &&
      Math.abs(+r.Fkm.toFixed(3) - +I.F) < 1e-6,
  );
}

export function hvLV(I: { F: number; L: number; sl: number }): string {
  if (typeof document === 'undefined') return '';
  const cv = document.getElementById('hd_cv') as HTMLCanvasElement | null;
  if (!S.res || !cv) return '';
  const same = hvLVok(I);
  const r = S.res;
  const o = S.o || hdOpts();
  const r2 = S.res2 && S.res2.src !== r.src ? S.res2 : null;
  const n1 = HDSRC[r.src];
  const n2 = r2 ? HDSRC[r2.src] : '';
  const dg = (v: number): string => {
    const d = Math.floor(v + 1e-9);
    const m = Math.round((v - d) * 60);
    return d + '°' + String(m).padStart(2, '0') + '′';
  };
  const ms = document.getElementById('hv_dmain') as HTMLSelectElement | null;
  const mmT =
    ms && ms.selectedOptions && ms.selectedOptions[0]
      ? (ms.selectedOptions[0].textContent || '').toLowerCase()
      : '';
  const xy = (p: Point2D): string =>
    o.ll
      ? `kinh độ ${hvF(p[0], 5)}° ; vĩ độ ${hvF(p[1], 5)}°`
      : `x = ${hvF(p[0], 2)} m ; y = ${hvF(p[1], 2)} m`;
  let h = `<p><b>1.3.1. Xác định các đặc trưng lưu vực</b></p>`;
  h += hvP(
    `Lưu vực và mạng suối xác định trên mô hình số độ cao ${n1} (lưới 30 m)${o.ll ? '' : `, hệ tọa độ VN-2000 kinh tuyến trục ${dg(o.lon0)}, múi chiếu 3°`}. Vị trí công trình: ${xy([o.E, o.N])}; cửa ra lưu vực tại lòng suối: ${xy(r.outVN)}, cao độ đáy ${hvF(r.zo, 2)} m.`,
  );
  h += hvP(
    `Ranh giới lưu vực xác định theo hướng dòng chảy trên mô hình độ cao đã lấp các ô trũng. Lòng suối tính từ vị trí có diện tích tập trung nước từ ${hvF(o.thr, 2)} km² trở lên; suối chính chọn theo ${mmT || 'đường dòng dài nhất'}. Tổng chiều dài suối nhánh Σl chỉ tính các nhánh dài hơn 0,75B ([TCVN 9845] Điều 4.5). Độ dốc lòng suối chính tính theo [TCVN 9845] PT 4 từ trắc dọc lòng suối; độ dốc sườn dốc lấy trung bình độ dốc các ô lưới ngoài lòng suối.`,
  );
  h += `<img src="${cv.toDataURL('image/png')}" width="${Math.round(cv.width * Math.min(1, 520 / cv.height))}" height="${Math.round(cv.height * Math.min(1, 520 / cv.height))}" style="display:block;margin:6px auto;max-width:100%;height:auto"><p class="cap">Hình 2 - Lưu vực và mạng suối tính đến vị trí công trình</p>`;
  const R1: Array<[string, string, (x: HvdRunResult) => number, number, string]> = [
    ['Diện tích lưu vực', 'F', (x) => x.Fkm, 3, 'km²'],
    ['Chiều dài suối chính', 'L', (x) => x.L, 3, 'km'],
    ['Chiều rộng bình quân lưu vực', 'B', (x) => x.B, 3, 'km'],
    ['Tổng chiều dài suối nhánh dài hơn 0,75B', 'Σl', (x) => x.sl, 3, 'km'],
    ['Số suối nhánh tính vào Σl', '', (x) => x.brk.length, 0, 'nhánh'],
    ['Độ dốc bình quân lòng suối chính', 'Jls', (x) => x.Jls, 1, '‰'],
    ['Độ dốc bình quân sườn dốc', 'Jsd', (x) => x.Jsd, 1, '‰'],
  ];
  if (r2) {
    h +=
      hvP(`Bảng so sánh đặc trưng lưu vực xác định trên hai mô hình số độ cao:`) +
      hvTab(
        ['Đặc trưng', n1, n2, 'Chênh lệch (%)', 'Đơn vị'],
        R1.map((a) => {
          const u = a[2](r);
          const v = a[2](r2);
          return [
            a[0] + (a[1] ? ', ' + a[1] : ''),
            hvF(u, a[3]),
            hvF(v, a[3]),
            a[3] && v ? hvF(((u - v) / v) * 100, 1) : '',
            a[4],
          ];
        }),
      );
    h += hvP(
      `Chênh lệch = (${n1} − ${n2}) / ${n2} × 100 %. Trên Hình 2, ranh giới lưu vực và suối chính theo ${n2} vẽ nét đứt.`,
    );
  } else {
    h += hvTab(
      ['Đặc trưng', 'Giá trị', 'Đơn vị'],
      R1.map((a) => [a[0] + (a[1] ? ', ' + a[1] : ''), hvF(a[2](r), a[3]), a[4]]),
    );
  }
  h += same
    ? hvSel(`mô hình số độ cao ${n1}`)
    : hvP(
        `Số liệu dùng tính lấy theo đo đạc trên bản đồ địa hình: F = ${hvF(+I.F, 3)} km² ; L = ${hvF(+I.L, 3)} km ; Σl = ${hvF(+I.sl, 3)} km (chênh lệch so với ${n1}: F ${hvF(((I.F - r.Fkm) / r.Fkm) * 100, 1)} % ; L ${hvF(((I.L - r.L) / r.L) * 100, 1)} %).`,
      );
  return h + `<p><b>1.3.2. Lưu lượng đỉnh lũ</b></p>`;
}

export function initDemWatershedDom(): () => void {
  if (typeof document === 'undefined') return () => {};
  const onClick = (e: MouseEvent): void => {
    const cv = e.target as HTMLCanvasElement | null;
    if (!cv || cv.id !== 'hd_cv' || !S.res || !S.view) return;
    const rc = cv.getBoundingClientRect();
    const x = ((e.clientX - rc.left) * cv.width) / rc.width;
    const y = ((e.clientY - rc.top) * cv.height) / rc.height;
    const v = S.view;
    const r = S.res;
    const nx = r.G.nx;
    const ny = r.G.ny;
    const c = Math.floor(v.c0 + x / v.sx);
    const rr = Math.floor(v.r0 + y / v.sy);
    let best = -1;
    let bd = 1e9;
    for (let a = -5; a <= 5; a++) {
      for (let b = -5; b <= 5; b++) {
        const R2 = rr + a;
        const C2 = c + b;
        if (R2 < 0 || C2 < 0 || R2 >= ny || C2 >= nx) continue;
        const i = R2 * nx + C2;
        if (!r.isS(i)) continue;
        const d = a * a + b * b;
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
    }
    if (best < 0) {
      hdMsg('Bấm gần lòng suối hơn để chọn suối chính.', 1);
      return;
    }
    const o = hdOpts();
    const sel = document.getElementById('hv_dmain') as HTMLSelectElement | null;
    if (sel) sel.value = 'chon';
    const r2 = repick(best, o);
    if (r2) hdShow(r2, o);
    hdMsg('Đã chọn suối chính theo điểm bấm trên hình.');
  };
  document.addEventListener('click', onClick);
  return () => document.removeEventListener('click', onClick);
}
