/**
 * Clean-room AutoCAD ASCII DXF Parser, TCVN3 (ABC) Decoder, Bridge Profile Extractor & Culvert Catchment Mapper
 *
 * Verbatim TypeScript port of:
 * - `analysis-cau-cong/modules/16_dem_watershed_ocr_dxf_import.js`: `TCV3`, `DXS`, `dxsTxt`, `dxsKey`, `dxsNum`, `dxsParse`, `dxsFind`, `dxsBridge`, `dxsShow`, `dxsFile`
 * - `analysis-cau-cong/modules/17_culvert_hydrology_and_dxftools.js`: `tvxArea`, `tvxIn`, `tvxKm`, `tvxLen`, `tvxGap`, `tvxDseg`, `tvxDpoly`, `analyzeCulvertDxfText`
 */

import type { DxfImportResult, Point2D } from '../../types/project';

// ============================================================================
// 1. TCVN3 (ABC) Character Map & Text Decoding
// ============================================================================

export const TCV3: Readonly<Record<number, string>> = {
  0xb5: 'à',
  0xb6: 'ả',
  0xb7: 'ã',
  0xb8: 'á',
  0xb9: 'ạ',
  0xa8: 'ă',
  0xbb: 'ằ',
  0xbc: 'ẳ',
  0xbd: 'ẵ',
  0xbe: 'ắ',
  0xc6: 'ặ',
  0xa9: 'â',
  0xc7: 'ầ',
  0xc8: 'ẩ',
  0xc9: 'ẫ',
  0xca: 'ấ',
  0xcb: 'ậ',
  0xae: 'đ',
  0xcc: 'è',
  0xce: 'ẻ',
  0xcf: 'ẽ',
  0xd0: 'é',
  0xd1: 'ẹ',
  0xaa: 'ê',
  0xd2: 'ề',
  0xd3: 'ể',
  0xd4: 'ễ',
  0xd5: 'ế',
  0xd6: 'ệ',
  0xd7: 'ì',
  0xd8: 'ỉ',
  0xdc: 'ĩ',
  0xdd: 'í',
  0xde: 'ị',
  0xdf: 'ò',
  0xe1: 'ỏ',
  0xe2: 'õ',
  0xe3: 'ó',
  0xe4: 'ọ',
  0xab: 'ô',
  0xe5: 'ồ',
  0xe6: 'ổ',
  0xe7: 'ỗ',
  0xe8: 'ố',
  0xe9: 'ộ',
  0xac: 'ơ',
  0xea: 'ờ',
  0xeb: 'ở',
  0xec: 'ỡ',
  0xed: 'ớ',
  0xee: 'ợ',
  0xef: 'ù',
  0xf1: 'ủ',
  0xf2: 'ũ',
  0xf3: 'ú',
  0xf4: 'ụ',
  0xad: 'ư',
  0xf5: 'ừ',
  0xf6: 'ử',
  0xf7: 'ữ',
  0xf8: 'ứ',
  0xf9: 'ự',
  0xfa: 'ỳ',
  0xfb: 'ỷ',
  0xfc: 'ỹ',
  0xfd: 'ý',
  0xfe: 'ỵ',
  0xa1: 'Ă',
  0xa2: 'Â',
  0xa3: 'Ê',
  0xa4: 'Ô',
  0xa5: 'Ơ',
  0xa6: 'Ư',
  0xa7: 'Đ',
};

export function hasTcvn3Bytes(s: string): boolean {
  const str = String(s);
  if (/[\u0100-\uFFFF]/.test(str)) return false;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code >= 0xa1 && code <= 0xfe && TCV3[code]) return true;
  }
  return false;
}

/**
 * Decodes TCVN3 bytes (if no pre-existing Unicode >= U+0100), AutoCAD `\U+XXXX` escapes,
 * `%%nnn` codes, and strips MTEXT formatting codes.
 */
export function dxsTxt(s: string): string {
  const raw = String(s);
  return (
    /[\u0100-\uFFFF]/.test(raw)
      ? raw
      : raw.replace(/[\u00A1-\u00FE]/g, (c) => TCV3[c.charCodeAt(0)] || c)
  )
    .replace(/\\U\+([0-9A-Fa-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/%%(\d{3})/g, (_, n) => TCV3[+n] || String.fromCharCode(+n))
    .replace(/%%[cCdDpP]/g, '')
    .replace(/\\[PpNn]/g, ' ')
    .replace(/\\[A-Za-z][^;\\{}]*;/g, '')
    .replace(/\\[LlOoKk]/g, '')
    .replace(/[{}]/g, '')
    .trim();
}

export function dxsKey(s: string): string {
  return dxsTxt(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ');
}

export function dxsNum(s: string): number {
  const t = dxsTxt(s).replace(/,/g, '.').replace(/\s+/g, '');
  return /^[-+]?\d+(\.\d+)?$/.test(t) ? +t : NaN;
}

/** Parses chainage strings such as `Km1+234.56`, `1+234,56`, or numeric m. */
export function dxsKm(v: string | number | null | undefined): number {
  const t = String(v == null ? '' : v)
    .trim()
    .replace(/,/g, '.');
  const m = t.match(/^(?:km\s*)?(\d+)\s*\+\s*(\d+(?:\.\d+)?)$/i);
  if (m) return +m[1] * 1000 + +m[2];
  const x = parseFloat(t.replace(/^km\s*/i, ''));
  return Number.isFinite(x) ? x : NaN;
}

/** Formats numeric meters into `KmX+XXX.XX`. */
export function dxsKmF(x: number): string {
  if (!Number.isFinite(x)) return '';
  const k = Math.floor(x / 1000 + 1e-9);
  const r = x - 1000 * k;
  return 'Km' + k + '+' + (r < 10 ? '00' : r < 100 ? '0' : '') + r.toFixed(2);
}

/** Parses whitespace/semicolon/tab delimited numeric pairs/tuples (supports KmX+XXX notation). */
export function dxsPairs(txt: string): number[][] {
  return String(txt || '')
    .split(/\r?\n/)
    .map((line) => {
      let l = line
        .trim()
        .replace(/(?<![\d.])(?:km\s*)?(\d+)\+(\d+(?:[.,]\d+)?)/gi, (_m, a, b) =>
          String(+a * 1000 + +b.replace(',', '.')),
        );
      l = /\d\.\d/.test(l) ? l.replace(/,/g, ' ') : l.replace(/,/g, '.');
      return l
        .split(/[\s;\t]+/)
        .filter(Boolean)
        .map(Number);
    })
    .filter((a) => a.length >= 2 && a.every(Number.isFinite));
}

// ============================================================================
// 2. Buffer Decoding (`$ACADVER >= AC1021` UTF-8 vs Latin1) & ASCII DXF Parser
// ============================================================================

export interface DecodedDxfBuffer {
  text: string;
  acadVersion: string;
  isBinary: boolean;
}

export function decodeDxfBuffer(buf: ArrayBuffer | ArrayBufferView): DecodedDxfBuffer {
  const view =
    buf instanceof ArrayBuffer
      ? new Uint8Array(buf)
      : new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  let text = new TextDecoder('latin1').decode(view);
  const acadVersion = (text.match(/\$ACADVER\s*\r?\n\s*1\s*\r?\n\s*(AC\d+)/) || [])[1] || '';
  if (acadVersion >= 'AC1021') {
    text = new TextDecoder('utf-8').decode(view);
  }
  const isBinary = /^AutoCAD Binary DXF/.test(text);
  return { text, acadVersion, isBinary };
}

export interface DxfTextItem {
  x: number;
  y: number;
  s: string;
  h: number;
  r: number;
  ly: string;
}

export interface DxfPolyline extends Array<Point2D> {
  ly?: string;
}

export interface DxfCircle {
  x: number;
  y: number;
  r: number;
  ly: string;
}

export interface DxfParseResult extends Array<DxfTextItem> {
  S: DxfPolyline[];
  C: DxfCircle[];
}

interface RawDxfEntity {
  t: string;
  x: number;
  y: number;
  x2: number;
  y2: number;
  h: number;
  r: number;
  s: string;
  n: string;
  sx: number;
  sy: number;
  ha: number;
  va: number;
  ap: number;
  w: number;
  pts: Point2D[];
  fp?: Point2D[];
  fl: number;
  ly?: string;
}

interface DxfBlockDef {
  name: string;
  bx: number;
  by: number;
  e: RawDxfEntity[];
}

type TransformFn = ((x: number, y: number) => Point2D) & { k?: number; r?: number };

export function dxsParse(txt: string): DxfParseResult {
  const L = txt.split(/\r?\n/);
  const P: Array<[number, string]> = [];
  for (let i = 0; i + 1 < L.length; i += 2) {
    P.push([+L[i].trim(), L[i + 1].replace(/\s+$/, '')]);
  }
  const blocks: Record<string, DxfBlockDef> = {};
  const ents: RawDxfEntity[] = [];
  let sec = '';
  let cur: RawDxfEntity | null = null;
  let blk: DxfBlockDef | null = null;

  const flush = (): void => {
    if (!cur) return;
    const tg = blk ? blk.e : ents;
    if (cur.t === 'VERTEX') {
      const pl = tg[tg.length - 1];
      if (pl && pl.t === 'POLYLINE') pl.pts.push([cur.x, cur.y]);
    } else if (cur.t !== 'SEQEND') {
      tg.push(cur);
    }
    cur = null;
  };

  for (let k = 0; k < P.length; k++) {
    const [c, v] = P[k];
    if (c === 0) {
      flush();
      if (v === 'SECTION') {
        sec = (P[k + 1] || [])[1] || '';
        continue;
      }
      if (v === 'ENDSEC') {
        sec = '';
        continue;
      }
      if (sec === 'BLOCKS' && v === 'BLOCK') {
        blk = { name: '', bx: 0, by: 0, e: [] };
        cur = {
          t: 'BLOCKHDR',
          x: 0,
          y: 0,
          x2: NaN,
          y2: NaN,
          h: 2.5,
          r: 0,
          s: '',
          n: '',
          sx: 1,
          sy: 1,
          ha: 0,
          va: 0,
          ap: 1,
          w: 0,
          pts: [],
          fl: 0,
        };
        continue;
      }
      if (sec === 'BLOCKS' && v === 'ENDBLK') {
        if (blk) blocks[blk.name] = blk;
        blk = null;
        continue;
      }
      if (sec === 'ENTITIES' || sec === 'BLOCKS') {
        cur = {
          t: v,
          x: 0,
          y: 0,
          x2: NaN,
          y2: NaN,
          h: 2.5,
          r: 0,
          s: '',
          n: '',
          sx: 1,
          sy: 1,
          ha: 0,
          va: 0,
          ap: 1,
          w: 0,
          pts: [],
          fl: 0,
        };
      }
      continue;
    }
    if (!cur) continue;
    if (c === 8 && cur.t !== 'BLOCKHDR') cur.ly = v;
    if (cur.t === 'BLOCKHDR') {
      if (c === 2 && blk) blk.name = v;
      if (c === 10 && blk) blk.bx = +v;
      if (c === 20 && blk) blk.by = +v;
      continue;
    }
    if (cur.t === 'SPLINE') {
      if (c === 10) cur.pts.push([+v, 0]);
      else if (c === 20 && cur.pts.length) cur.pts[cur.pts.length - 1][1] = +v;
      else if (c === 11) {
        (cur.fp = cur.fp || []).push([+v, 0]);
      } else if (c === 21 && cur.fp && cur.fp.length) {
        cur.fp[cur.fp.length - 1][1] = +v;
      } else if (c === 70) cur.fl = +v;
      continue;
    }
    if (cur.t === 'LWPOLYLINE') {
      if (c === 10) cur.pts.push([+v, 0]);
      else if (c === 20 && cur.pts.length) cur.pts[cur.pts.length - 1][1] = +v;
      else if (c === 70) cur.fl = +v;
      continue;
    }
    if (cur.t === 'POLYLINE' && c === 70) {
      cur.fl = +v;
      continue;
    }
    switch (c) {
      case 10:
        cur.x = +v;
        break;
      case 20:
        cur.y = +v;
        break;
      case 11:
        cur.x2 = +v;
        break;
      case 21:
        cur.y2 = +v;
        break;
      case 40:
        cur.h = +v;
        break;
      case 50:
        cur.r = +v;
        break;
      case 41:
        cur.sx = +v;
        cur.w = +v;
        break;
      case 42:
        cur.sy = +v;
        break;
      case 72:
        cur.ha = +v;
        break;
      case 73:
      case 74:
        cur.va = +v;
        break;
      case 71:
        cur.ap = +v;
        break;
      case 1:
        cur.s += v;
        break;
      case 3:
        cur.s = v + cur.s;
        break;
      case 2:
        cur.n = v;
        break;
    }
  }
  flush();

  const out: DxfTextItem[] = [];
  const cen = (e: RawDxfEntity, s: string): { x: number; y: number } => {
    const H = e.h;
    const len = Math.max(1, s.length) * H * 0.62;
    const a = ((e.r || 0) * Math.PI) / 180;
    let ux = 0;
    let uy = 0;
    if (e.t === 'MTEXT') {
      const ap = e.ap || 1;
      const col = (ap - 1) % 3;
      const row = Math.floor((ap - 1) / 3);
      ux = len * (0.5 - col / 2);
      uy = H * (row - 1) * 0.5 * -1;
    } else {
      const al = e.ha > 0 && Number.isFinite(e.x2);
      const bx = al ? e.x2 : e.x;
      const by = al ? e.y2 : e.y;
      ux = e.ha === 1 || e.ha === 4 ? 0 : e.ha === 2 ? -len / 2 : len / 2;
      uy = e.va === 2 ? 0 : e.va === 3 ? -H / 2 : H / 2;
      return {
        x: bx + ux * Math.cos(a) - uy * Math.sin(a),
        y: by + ux * Math.sin(a) + uy * Math.cos(a),
      };
    }
    return {
      x: e.x + ux * Math.cos(a) - uy * Math.sin(a),
      y: e.y + ux * Math.sin(a) + uy * Math.cos(a),
    };
  };

  const S: DxfPolyline[] = [];
  const CI: DxfCircle[] = [];
  const tr = (M: TransformFn | null, p: Point2D): Point2D => (M ? M(p[0], p[1]) : p);

  const put = (e: RawDxfEntity, M: TransformFn | null, depth: number): void => {
    if (e.t === 'CIRCLE' || e.t === 'POINT') {
      const q = tr(M, [e.x, e.y]);
      CI.push({
        x: q[0],
        y: q[1],
        r: e.t === 'CIRCLE' ? e.h * ((M && M.k) || 1) : 0,
        ly: e.ly || '0',
      });
      return;
    }
    if (e.t === 'LINE') {
      S.push([tr(M, [e.x, e.y]), tr(M, [e.x2, e.y2])]);
      return;
    }
    if (e.t === 'SPLINE') {
      const src = e.fp && e.fp.length >= 2 ? e.fp : e.pts;
      if (src.length < 2) return;
      const q: DxfPolyline = src.map((p) => tr(M, p));
      if (e.fl & 1) q.push(q[0]);
      q.ly = e.ly || '0';
      S.push(q);
      return;
    }
    if (e.t === 'LWPOLYLINE' || e.t === 'POLYLINE') {
      if (e.pts.length < 2) return;
      const q: DxfPolyline = e.pts.map((p) => tr(M, p));
      if (e.fl & 1) q.push(q[0]);
      q.ly = e.ly || '0';
      S.push(q);
      return;
    }
    if (e.t === 'TEXT' || e.t === 'MTEXT' || e.t === 'ATTRIB') {
      const s = e.s;
      const c = cen(e, dxsTxt(s));
      const p = M ? M(c.x, c.y) : ([c.x, c.y] as Point2D);
      out.push({
        x: p[0],
        y: p[1],
        s,
        h: e.h * ((M && M.k) || 1),
        r: (e.r || 0) + ((M && M.r) || 0),
        ly: e.ly || '0',
      });
    } else if (e.t === 'INSERT' && depth < 6) {
      const B = blocks[e.n];
      if (!B) return;
      const a = ((e.r || 0) * Math.PI) / 180;
      const sx = e.sx || 1;
      const sy = e.sy || 1;
      const M2: TransformFn = (x: number, y: number): Point2D => {
        const X = (x - B.bx) * sx;
        const Y = (y - B.by) * sy;
        const q: Point2D = [
          e.x + X * Math.cos(a) - Y * Math.sin(a),
          e.y + X * Math.sin(a) + Y * Math.cos(a),
        ];
        return M ? M(q[0], q[1]) : q;
      };
      M2.k = Math.abs(sy) * ((M && M.k) || 1);
      M2.r = (e.r || 0) + ((M && M.r) || 0);
      B.e.forEach((q) => put(q, M2, depth + 1));
    }
  };

  ents.forEach((e) => put(e, null, 0));
  return Object.assign(out, { S, C: CI }) as DxfParseResult;
}

// ============================================================================
// 3. Cross-Section Band Finder & Bridge Profile Extractor (`dxsFind`, `dxsBridge`)
// ============================================================================

export interface DxfProfileBand {
  x: number;
  y: number;
  nE: number;
  nD: number;
  pts: Point2D[];
  warn: number;
  x0d: number;
  name: string;
  E: Array<{ x: number; v: number }>;
  h: number;
  rh: number;
  lx: number;
  names: Array<{ x: number; s: string }>;
}

export interface DxfFoundBands extends Array<DxfProfileBand> {
  T?: DxfParseResult;
}

export function dxsFind(T: DxfParseResult): DxfFoundBands {
  const lab = T.filter((t) => /[a-z]/.test(dxsKey(t.s)));
  const res: DxfProfileBand[] = [];
  const nat = lab.filter(
    (t) =>
      (/tu nhien/.test(dxsKey(t.s)) && /cao do|cd/.test(dxsKey(t.s))) ||
      /^cao do tu nhien|^cdtn|^cao do tn/.test(dxsKey(t.s)),
  );
  const cly = lab.filter(
    (t) => /cu ly|khoang cach/.test(dxsKey(t.s)) && !/cong don|tich luy/.test(dxsKey(t.s)),
  );

  for (const n of nat) {
    const c = cly
      .filter((q) => Math.abs(q.x - n.x) < 20 * n.h)
      .sort((a, b) => Math.abs(a.y - n.y) - Math.abs(b.y - n.y))[0];
    if (!c) continue;

    const col = lab
      .filter((q) => Math.abs(q.x - n.x) < 20 * n.h)
      .map((q) => q.y)
      .sort((a, b) => a - b);
    const dy: number[] = [];
    for (let i = 1; i < col.length; i++) {
      if (col[i] - col[i - 1] > n.h * 0.8) dy.push(col[i] - col[i - 1]);
    }
    dy.sort((a, b) => a - b);
    const rh = dy.length ? dy[dy.length >> 1] : Math.abs(c.y - n.y) || n.h * 4;
    const x0 = Math.max(n.x, c.x) + n.h;
    const labs = lab.filter(
      (q) => Math.abs(q.x - n.x) < 20 * n.h && !Number.isFinite(dxsNum(q.s)),
    );

    const HZ = (T.S || [])
      .flatMap((P) => P.slice(1).map((q, i) => [P[i], q] as [Point2D, Point2D]))
      .filter(
        ([a, b]) =>
          Math.abs(a[1] - b[1]) < 1e-6 * Math.max(1, Math.abs(a[1])) + 1e-4 &&
          Math.abs(a[0] - b[0]) >= 10 * n.h &&
          Math.min(a[0], b[0]) <= n.x + n.h &&
          Math.max(a[0], b[0]) >= x0,
      )
      .map(([a]) => a[1]);

    const lim = (y: number): [number, number] | null => {
      const up = HZ.filter((v) => v > y).sort((a, b) => a - b)[0];
      const dn = HZ.filter((v) => v < y).sort((a, b) => b - a)[0];
      return up != null && dn != null && up - dn <= 3 * rh ? [dn, up] : null;
    };

    const row = (y: number): Array<{ x: number; v: number }> => {
      const B = lim(y);
      return T.filter(
        (t) =>
          t.x > x0 &&
          Number.isFinite(dxsNum(t.s)) &&
          (B
            ? t.y > B[0] && t.y < B[1]
            : Math.abs(t.y - y) <= rh * 0.75 &&
              labs.every((q) => Math.abs(t.y - q.y) >= Math.abs(t.y - y) - 1e-9)),
      )
        .map((t) => ({ x: t.x, v: dxsNum(t.s) }))
        .sort((a, b) => a.x - b.x);
    };

    let E = row(n.y);
    let D = row(c.y);
    if (E.length < 2) continue;

    E = E.filter((e, i) => !i || Math.abs(e.x - E[i - 1].x) > n.h * 0.2 || e.v !== E[i - 1].v);
    D = D.filter((e, i) => !i || Math.abs(e.x - D[i - 1].x) > n.h * 0.2 || e.v !== D[i - 1].v);

    const pts: Point2D[] = [];
    let L = 0;
    let warn = 0;
    for (let i = 0; i < E.length; i++) {
      pts.push([+L.toFixed(3), E[i].v]);
      if (i + 1 < E.length) {
        const dd = D.filter((q) => q.x > E[i].x - n.h * 0.5 && q.x < E[i + 1].x + n.h * 0.5);
        const d =
          dd.length === 1
            ? dd[0].v
            : dd.length
              ? dd.sort(
                  (a, b) =>
                    Math.abs(a.x - (E[i].x + E[i + 1].x) / 2) -
                    Math.abs(b.x - (E[i].x + E[i + 1].x) / 2),
                )[0].v
              : NaN;
        if (!Number.isFinite(d)) warn++;
        L += Number.isFinite(d) ? d : 0;
      }
    }
    if (D.length === E.length - 1) {
      L = 0;
      pts.length = 0;
      E.forEach((e, i) => {
        pts.push([+L.toFixed(3), e.v]);
        if (i < D.length) L += D[i].v;
      });
      warn = 0;
    }

    let x0d = NaN;
    {
      const cdl = lab.filter(
        (q) => Math.abs(q.x - n.x) < 20 * n.h && /cong don|tich luy|^ly trinh/.test(dxsKey(q.s)),
      )[0];
      if (cdl) {
        const C = row(cdl.y);
        if (C.length && Math.abs(C[0].x - E[0].x) <= n.h * 1.5) x0d = C[0].v;
      }
      if (!Number.isFinite(x0d)) {
        const km = T.filter(
          (t) =>
            t.x > x0 && Math.abs(t.y - n.y) < 20 * rh && /km\s*\d+\s*\+\s*\d/i.test(dxsTxt(t.s)),
        )
          .map((t) => {
            const match = dxsTxt(t.s).match(/km\s*\d+\s*\+\s*\d+(?:[.,]\d+)?/i);
            return {
              x: t.x,
              v: match ? dxsKm(match[0]) : NaN,
            };
          })
          .filter((q) => Number.isFinite(q.v));
        if (km.length) {
          const q = km.sort((a, b) => Math.abs(a.x - E[0].x) - Math.abs(b.x - E[0].x))[0];
          const j = E.reduce(
            (b, e, k) => (Math.abs(e.x - q.x) < Math.abs(E[b].x - q.x) ? k : b),
            0,
          );
          if (Math.abs(E[j].x - q.x) <= n.h * 2) x0d = q.v - pts[j][0];
        }
      }
    }

    const tl = lab.filter(
      (q) => Math.abs(q.x - n.x) < 20 * n.h && /ten coc|ten cot|^coc/.test(dxsKey(q.s)),
    )[0];

    res.push({
      x: n.x,
      y: n.y,
      nE: E.length,
      nD: D.length,
      pts,
      warn,
      x0d,
      name: dxsTxt(n.s),
      E,
      h: n.h,
      rh,
      lx: n.x,
      names: tl
        ? T.filter((t) => Math.abs(t.y - tl.y) <= rh * 0.5 && t.x > x0).map((t) => ({
            x: t.x,
            s: dxsTxt(t.s).toUpperCase(),
          }))
        : [],
    });
  }

  return res.sort((a, b) => b.y - a.y || a.x - b.x) as DxfFoundBands;
}

export interface DxfBridgeLayout {
  mnAll: Array<{ n: string; v: number; t: string }>;
  nms: number;
  lo: number;
  hi: number;
  MNTK: number;
  MNHT: number;
  hist: Array<[number, number]>;
  Hw: number;
  fit: { k: number; r: number };
  xA1?: number;
  xA2?: number;
  piers?: Array<{ x: number; a: number }>;
  est?: string;
}

export function dxsBridge(
  T: DxfParseResult,
  S: DxfPolyline[],
  b: DxfProfileBand,
): DxfBridgeLayout | null {
  const E = b.E;
  const Ls = b.pts.map((p) => p[0]);
  const zs = b.pts.map((p) => p[1]);
  const n = E.length;
  const x0 = E[0].x;
  const x1 = E[n - 1].x;
  const tol = Math.max(1.5 * b.h, ((x1 - x0) / n) * 0.4);

  const yAt = (P: Point2D[], x: number): number => {
    for (let i = 0; i + 1 < P.length; i++) {
      const a = P[i];
      const c = P[i + 1];
      if ((x - a[0]) * (x - c[0]) <= 0 && Math.abs(c[0] - a[0]) > 1e-9) {
        return a[1] + ((x - a[0]) * (c[1] - a[1])) / (c[0] - a[0]);
      }
    }
    return NaN;
  };

  const fit = (X: number[], Y: number[]): { k: number; c: number; r: number } => {
    const m = X.length;
    const mx = X.reduce((a, v) => a + v, 0) / m;
    const my = Y.reduce((a, v) => a + v, 0) / m;
    let sxy = 0;
    let sxx = 0;
    let syy = 0;
    for (let i = 0; i < m; i++) {
      sxy += (X[i] - mx) * (Y[i] - my);
      sxx += (X[i] - mx) ** 2;
      syy += (Y[i] - my) ** 2;
    }
    const k = sxy / sxx;
    return { k, c: my - k * mx, r: sxy / Math.sqrt(sxx * syy) };
  };

  let G: { P: DxfPolyline; f: { k: number; c: number; r: number }; pr?: Point2D[] } | null = null;
  for (const P of S) {
    if (P.length < 4) continue;
    const xs = P.map((p) => p[0]);
    if (Math.min(...xs) > x0 + tol || Math.max(...xs) < x1 - tol) continue;
    const ys = E.map((e) => yAt(P, e.x));
    if (ys.some((v) => !Number.isFinite(v))) continue;
    const f = fit(zs, ys);
    if (f.r > 0.995 && f.k > 0 && (!G || f.r > G.f.r)) G = { P, f };
  }

  if (G) {
    const sp = Math.min(
      ...E.slice(1)
        .map((e, i) => e.x - E[i].x)
        .filter((v) => v > 1e-6),
    );
    G.pr = [];
    E.forEach((e, i) => {
      let bv: Point2D | null = null;
      G!.P.forEach((p) => {
        if (
          Math.abs(p[0] - e.x) <= Math.max(sp * 0.45, 1e-3) &&
          (!bv || Math.abs(p[0] - e.x) < Math.abs(bv[0] - e.x))
        ) {
          bv = p;
        }
      });
      if (bv) G!.pr!.push([bv[0], Ls[i]]);
    });
    if (G.pr.length < 3) G.pr = E.map((e, i) => [e.x, Ls[i]]);
  }
  if (!G) return null;

  const fx = fit(
    G.pr!.map((v) => v[0]),
    G.pr!.map((v) => v[1]),
  );
  const L = (x: number): number => fx.c + fx.k * x;
  const Hh = (y: number): number => (y - G!.f.c) / G!.f.k;
  const xL = (l: number): number => (l - fx.c) / fx.k;

  const tx = T.map((t) => dxsTxt(t.s));
  const matchNum = (r: RegExp): number => {
    for (const t of tx) {
      const m = t.replace(/%%%/g, '%').match(r);
      if (m) return +m[1].replace(',', '.');
    }
    return NaN;
  };

  const MNTK = matchNum(/MNTK[^=]*=\s*\+?([\d.,]+)/i);
  const MNHT = matchNum(/MNHT[^=]*=\s*\+?([\d.,]+)/i);
  const hist: Array<[number, number]> = [];
  tx.forEach((t) => {
    const m = t.match(/MNL\s*(\d{4})[^=]*=\s*\+?([\d.,]+)/i);
    if (m && !hist.some((q) => q[0] === +m[1])) {
      hist.push([+m[1], +m[2].replace(',', '.')]);
    }
  });
  hist.sort((a, b) => a[0] - b[0]);

  const mnAll: Array<{ n: string; v: number; t: string }> = [];
  tx.forEach((t) => {
    const u = t.replace(/%%%/g, '%').trim();
    if (!/^MN/i.test(u)) return;
    const vm = u.match(/=\s*\+?(-?\d+(?:[.,]\d+)?)/) || u.match(/(-?\d+[.,]\d+)\s*m?\s*$/);
    if (!vm) return;
    const nm = (u.includes(':') ? u.split(':')[0] : u.split(/\s+H\b|\s*=/)[0])
      .replace(/\s+/g, ' ')
      .trim();
    const v = +vm[1].replace(',', '.');
    if (!mnAll.some((q) => q.n === nm)) mnAll.push({ n: nm, v, t: u });
  });

  const zmin = Math.min(...zs);
  const Hw = Number.isFinite(MNTK)
    ? MNTK
    : hist.length
      ? Math.max(...hist.map((q) => q[1]))
      : zmin + 2;

  const ms = b.names
    .filter((q) => /^(Đ|D)?M\d/.test(q.s))
    .map((q) => q.x)
    .sort((a, c) => a - c);
  const lo = ms.length >= 2 ? ms[0] : x0;
  const hi = ms.length >= 2 ? ms[ms.length - 1] : x1;

  interface VertSeg {
    x: number;
    zb: number;
    zt: number;
  }
  const V: VertSeg[] = [];
  S.forEach((P) => {
    for (let i = 0; i + 1 < P.length; i++) {
      const a = P[i];
      const c = P[i + 1];
      if (
        Math.abs(a[0] - c[0]) > 0.02 * Math.abs(G!.f.k) ||
        Math.abs(a[1] - c[1]) < 1.2 * G!.f.k
      ) {
        continue;
      }
      const x = (a[0] + c[0]) / 2;
      if (x < lo || x > hi) continue;
      const zb = Hh(Math.min(a[1], c[1]));
      const zt = Hh(Math.max(a[1], c[1]));
      const zg = Hh(yAt(G!.P, x));
      if (Number.isFinite(zg) && zb <= zg + 0.5 && zt >= zg + 1.5 && zt <= zg + 15) {
        V.push({ x, zb, zt });
      }
    }
  });
  V.sort((a, c) => a.x - c.x);

  const cl: Array<{ x0: number; x1: number; n: number; v: VertSeg[] }> = [];
  V.forEach((v) => {
    const g = cl[cl.length - 1];
    if (g && v.x - g.x1 <= 2.0) {
      g.x1 = v.x;
      g.n++;
      g.v.push(v);
    } else {
      cl.push({ x0: v.x, x1: v.x, n: 1, v: [v] });
    }
  });

  const r: DxfBridgeLayout = {
    mnAll,
    nms: ms.length,
    lo,
    hi,
    MNTK,
    MNHT,
    hist,
    Hw,
    fit: { k: fx.k, r: G.f.r },
  };
  const tw = xL(Ls[zs.indexOf(zmin)]);
  const left = cl.filter((g) => g.x1 < tw);
  const right = cl.filter((g) => g.x0 > tw);

  if (left.length && right.length) {
    const A1 = left[0];
    const A2 = right[right.length - 1];
    r.xA1 = L(A1.x1);
    r.xA2 = L(A2.x0);
    r.piers = cl
      .filter((g) => g !== A1 && g !== A2 && g.x0 > A1.x1 && g.x1 < A2.x0)
      .map((g) => {
        const v2 = g.v.filter((v) => v.zt - v.zb >= 2);
        let vv: VertSeg[] = [];
        v2.forEach((a) => {
          const q = v2.filter((v) => Math.abs(v.zt - a.zt) < 0.3 && Math.abs(v.zb - a.zb) < 1.0);
          if (q.length > vv.length) vv = q;
        });
        return vv.length >= 2
          ? { x0: Math.min(...vv.map((v) => v.x)), x1: Math.max(...vv.map((v) => v.x)) }
          : null;
      })
      .filter((g): g is { x0: number; x1: number } => Boolean(g && g.x1 - g.x0 >= 0.5))
      .map((g) => ({ x: L((g.x0 + g.x1) / 2), a: (g.x1 - g.x0) / Math.abs(fx.k) }));
  }

  if (!Number.isFinite(r.xA1)) {
    const tL = tx.map((t) => t.match(/(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*m/i)).find(Boolean);
    const tc = tx.map((t) => t.match(/^C[ọo]c\s+(\S+)/i)).find(Boolean);
    if (tL && tc) {
      const st = b.names.find((q) => q.s === tc[1].toUpperCase());
      if (st) {
        const Lt = +tL[1] * +tL[2].replace(',', '.');
        const c = L(st.x);
        r.xA1 = c - Lt / 2;
        r.xA2 = c + Lt / 2;
        r.est = `ước theo ghi chú "${tL[0]}" và cọc tim cầu ${tc[1]} (lý trình ${c.toFixed(2)} m): mép mố = tim ± chiều dài nhịp/2, cần hiệu chỉnh theo bố trí mố thực tế`;
        r.piers = [];
      }
    }
  }

  return r;
}

// ============================================================================
// 4. Pure High-Level Bridge DXF Analysis & Culvert Batch DXF Mapper (`tvx`)
// ============================================================================

export interface BridgeDxfAnalysis {
  result: DxfImportResult;
  decoded: DecodedDxfBuffer;
  parseResult: DxfParseResult;
  bands: DxfFoundBands;
  selectedBand: DxfProfileBand | null;
  bridge: DxfBridgeLayout | null;
  error?: string;
}

export function analyzeBridgeDxfBuffer(
  buf: ArrayBuffer | ArrayBufferView,
  bandIndex = 0,
  manualStartKm?: string,
): BridgeDxfAnalysis {
  const decoded = decodeDxfBuffer(buf);
  if (decoded.isBinary) {
    const empty = Object.assign([] as DxfTextItem[], { S: [], C: [] }) as DxfParseResult;
    return {
      result: {
        acadVersion: decoded.acadVersion,
        usedTcvn3: false,
        entityCount: 0,
      },
      decoded,
      parseResult: empty,
      bands: [] as unknown as DxfFoundBands,
      selectedBand: null,
      bridge: null,
      error: 'DXF dạng nhị phân: lưu lại DXF dạng chữ (ASCII, mặc định của SAVEAS).',
    };
  }

  const T = dxsParse(decoded.text);
  const usedTcvn3 = decoded.acadVersion < 'AC1021' && T.some((t) => hasTcvn3Bytes(t.s));
  const bands = dxsFind(T);
  bands.T = T;

  const selectedBand = bands[bandIndex] ?? bands[0] ?? null;
  let bridge: DxfBridgeLayout | null = null;
  if (selectedBand) {
    bridge = dxsBridge(T, T.S, selectedBand);
  }

  let off = manualStartKm != null ? dxsKm(manualStartKm) : NaN;
  if (!Number.isFinite(off) && selectedBand && Number.isFinite(selectedBand.x0d)) {
    off = selectedBand.x0d;
  }
  if (!Number.isFinite(off)) off = 0;

  const result: DxfImportResult = {
    acadVersion: decoded.acadVersion,
    usedTcvn3,
    entityCount: T.length + T.S.length + T.C.length,
    section: selectedBand
      ? {
          name: selectedBand.name,
          x0: off,
          points: selectedBand.pts.map((p): Point2D => [+(p[0] + off).toFixed(2), +p[1].toFixed(2)]),
        }
      : undefined,
    bridge: bridge
      ? {
          xA1: Number.isFinite(bridge.xA1) ? bridge.xA1! + off : undefined,
          xA2: Number.isFinite(bridge.xA2) ? bridge.xA2! + off : undefined,
          piers: (bridge.piers || []).map((p) => ({ x: p.x + off, a: p.a, width: p.a })),
          waterLevels: bridge.mnAll.map((q) => ({ label: q.n, z: q.v })),
          pearsonR: bridge.fit.r,
        }
      : undefined,
  };

  return {
    result,
    decoded,
    parseResult: T,
    bands,
    selectedBand,
    bridge,
  };
}

// ============================================================================
// 5. Culvert Batch DXF Geometry Helpers (`TVX` from Module 17)
// ============================================================================

export function tvxArea(P: ReadonlyArray<Point2D>): number {
  let a = 0;
  for (let i = 1; i < P.length; i++) {
    a += P[i - 1][0] * P[i][1] - P[i][0] * P[i - 1][1];
  }
  return Math.abs(a) / 2;
}

export function tvxIn(P: ReadonlyArray<Point2D>, x: number, y: number): boolean {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, yi] = P[i];
    const [xj, yj] = P[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      c = !c;
    }
  }
  return c;
}

export function tvxKm(s: string): { v: number; t: string } | null {
  const m = String(s)
    .toUpperCase()
    .replace(/\s/g, '')
    .match(/KM(\d+)\+(\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const k = +m[1];
  const d = +m[2].replace(',', '.');
  return {
    v: k * 1000 + d,
    t: 'Km' + k + '+' + (d < 100 ? (d < 10 ? '00' : '0') : '') + (+d.toFixed(2)).toString(),
  };
}

export function tvxLen(q: ReadonlyArray<Point2D>): number {
  let L = 0;
  for (let i = 1; i < q.length; i++) {
    L += Math.hypot(q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1]);
  }
  return L;
}

export function tvxGap(q: ReadonlyArray<Point2D>): number {
  return Math.hypot(q[0][0] - q[q.length - 1][0], q[0][1] - q[q.length - 1][1]);
}

export function tvxDseg(p: Point2D, a: Point2D, b: Point2D): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = dx * dx + dy * dy;
  const t = l ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

export function tvxDpoly(P: ReadonlyArray<Point2D>, p: Point2D): number {
  if (tvxIn(P, p[0], p[1])) return 0;
  let d = Infinity;
  for (let i = 1; i < P.length; i++) d = Math.min(d, tvxDseg(p, P[i - 1], P[i]));
  return d;
}

export interface CulvertDxfEndMarker {
  dau: boolean;
  km: { v: number; t: string } | null;
  tip: Point2D;
  txt: string;
  p?: Point2D;
}

export interface CulvertDxfParsedState {
  T: DxfParseResult;
  bas: Array<{ P: DxfPolyline; ly: string; A: number }>;
  kms: Array<{ v: number; t: string; tip: Point2D; x: number; y: number }>;
  FL: Array<{ v: number; tip: Point2D }>;
  dots: Array<{ x: number; y: number; r: number }>;
  opens: DxfPolyline[];
  routes: Array<{ q: DxfPolyline; L: number }>;
  tim: DxfPolyline | null;
  E0: CulvertDxfEndMarker | undefined;
  E1: CulvertDxfEndMarker | undefined;
  layers: string[];
  autoLayer: string | null;
}

export function parseCulvertDxfText(txt: string): CulvertDxfParsedState {
  const T = dxsParse(txt);
  const TX = T.map((t) => ({ ...t, u: dxsTxt(t.s) }));

  const dots = [
    ...(T.C || []).map((c) => ({ x: c.x, y: c.y, r: c.r })),
    ...T.S.filter((q) => q.length >= 2 && q.length <= 3 && tvxGap(q) < 1e-6).map((q) => ({
      x: (q[0][0] + q[1][0]) / 2,
      y: (q[0][1] + q[1][1]) / 2,
      r: Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]) / 2,
    })),
  ];

  const closed = T.S.filter(
    (q) => q.length >= 4 && tvxGap(q) < Math.max(30, 0.03 * tvxLen(q)),
  ).map((q) => {
    const P: DxfPolyline = tvxGap(q) < 0.01 ? q : ([...q, q[0]] as DxfPolyline);
    P.ly = q.ly;
    return P;
  });

  const boxes: Array<{ P: DxfPolyline | null; t: (typeof TX)[number]; txt: string; tip: Point2D }> =
    [];
  const bas: Array<{ P: DxfPolyline; ly: string; A: number }> = [];

  closed.forEach((P) => {
    const A = tvxArea(P);
    const inT = TX.filter((t) => tvxIn(P, t.x, t.y));
    const lab = inT.find((t) => A < 8 * Math.max(1, t.u.length) * 0.62 * t.h * t.h);
    if (lab) {
      const tip = P.reduce(
        (b, p) =>
          Math.hypot(p[0] - lab.x, p[1] - lab.y) > Math.hypot(b[0] - lab.x, b[1] - lab.y) ? p : b,
        P[0],
      );
      boxes.push({ P, t: lab, txt: inT.map((t) => t.u).join(' '), tip });
    } else if (A >= 2000 && A <= 1e8 && P.length >= 5) {
      bas.push({ P, ly: P.ly || '0', A });
    }
  });

  TX.filter((t) => !boxes.some((b) => b.t === t || (b.P && tvxIn(b.P, t.x, t.y)))).forEach((t) =>
    boxes.push({ P: null, t, txt: t.u, tip: [t.x, t.y] }),
  );

  const nrm = (t: string) =>
    String(t)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[đĐ]/g, 'D')
      .toUpperCase();
  const isEnd = (t: string) => /(DAU|CUOI)\s*TUYEN/.test(nrm(t));
  const dauT = (t: string) => /DAU\s*TUYEN/.test(nrm(t));

  const ends: CulvertDxfEndMarker[] = boxes
    .filter((b) => isEnd(b.txt))
    .map((b) => ({ dau: dauT(b.txt), km: tvxKm(b.txt), tip: b.tip, txt: b.txt }));
  const kms = boxes
    .filter((b) => !isEnd(b.txt))
    .map((b) => {
      const k = tvxKm(b.txt);
      return k ? { ...k, tip: b.tip, x: b.t.x, y: b.t.y } : null;
    })
    .filter((x): x is { v: number; t: string; tip: Point2D; x: number; y: number } => x !== null);

  const FL = boxes
    .map((b) => {
      const m = b.txt
        .toUpperCase()
        .replace(/\s/g, '')
        .match(/(?:S|F)[^=]*=([\d.,]+)KM/);
      return m ? { v: +m[1].replace(',', '.'), tip: b.tip } : null;
    })
    .filter((x): x is { v: number; tip: Point2D } => x !== null);

  const opens = T.S.filter((q) => q.length >= 2 && tvxGap(q) >= Math.max(30, 0.03 * tvxLen(q)));
  const layers = [...new Set(bas.map((o) => o.ly))];
  const autoLayer = layers.find((l) => /l[uư]u.?v[uự]c|^lv|luuvuc/i.test(dxsTxt(l))) || null;

  const used = new Set<number>();
  ends.forEach((e) => {
    let bi = -1;
    let bd = Infinity;
    dots.forEach((d, i) => {
      if (used.has(i)) return;
      const v = Math.hypot(d.x - e.tip[0], d.y - e.tip[1]);
      if (v < bd) {
        bd = v;
        bi = i;
      }
    });
    if (bi >= 0 && bd < 300) {
      used.add(bi);
      e.p = [dots[bi].x, dots[bi].y];
    } else {
      e.p = e.tip;
    }
  });

  const cdots = dots.filter((_d, i) => !used.has(i));
  const E0 = ends.find((e) => e.dau);
  const E1 = ends.find((e) => !e.dau);

  let tim: DxfPolyline | null = null;
  if (E0 && E1 && E0.p && E1.p) {
    let bd = Infinity;
    opens.forEach((q) => {
      const a = q[0];
      const b = q[q.length - 1];
      const v = Math.min(
        Math.hypot(a[0] - E0.p![0], a[1] - E0.p![1]) +
          Math.hypot(b[0] - E1.p![0], b[1] - E1.p![1]),
        Math.hypot(b[0] - E0.p![0], b[1] - E0.p![1]) +
          Math.hypot(a[0] - E1.p![0], a[1] - E1.p![1]),
      );
      if (v < bd) {
        bd = v;
        tim = q;
      }
    });
    if (bd > 200) tim = null;
  }

  const inBas = (q: DxfPolyline): boolean =>
    bas.some((o) => {
      let a = 0;
      let b2 = 0;
      for (let i = 1; i < q.length; i++) {
        const m: Point2D = [(q[i][0] + q[i - 1][0]) / 2, (q[i][1] + q[i - 1][1]) / 2];
        const l = Math.hypot(q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1]);
        b2 += l;
        if (tvxIn(o.P, m[0], m[1])) a += l;
      }
      return b2 > 0 && a >= 0.7 * b2;
    });

  if (!tim) {
    const cand = opens.filter((q) => !inBas(q));
    if (cand.length) {
      tim = cand.reduce<DxfPolyline | null>(
        (b, q) => (!b || tvxLen(q) > tvxLen(b) ? q : b),
        null,
      );
    }
  }
  if (
    tim &&
    E0?.p &&
    Math.hypot(tim[tim.length - 1][0] - E0.p[0], tim[tim.length - 1][1] - E0.p[1]) <
      Math.hypot(tim[0][0] - E0.p[0], tim[0][1] - E0.p[1])
  ) {
    const rev = tim.slice().reverse() as DxfPolyline;
    rev.ly = tim.ly;
    tim = rev;
  }

  return {
    T,
    bas,
    kms,
    FL,
    dots: cdots,
    opens: opens.filter((q) => q !== tim),
    routes: opens.map((q) => ({ q, L: tvxLen(q) })),
    tim,
    E0,
    E1,
    layers,
    autoLayer,
  };
}

// ============================================================================
// 6. DOM Adapters (`DXS`, `dxsSet`, `dxsShow`, `dxsFile`, `initDxfDom`)
// ============================================================================

export const DXS: { cs: unknown; list: DxfFoundBands | null } = { cs: null, list: null };

function ensureDxsStat(ta: HTMLElement): HTMLElement {
  let s = ta.nextElementSibling as HTMLElement | null;
  if (!s || !s.classList || !s.classList.contains('ocrSt')) {
    s = document.createElement('div');
    s.className = 'ocrSt small noprint';
    ta.after(s);
  }
  return s;
}

export function dxsSet(id: string, v: string): [string, string] | null {
  if (typeof document === 'undefined') return null;
  const e = document.getElementById('hv_' + id) as
    | HTMLInputElement
    | HTMLTextAreaElement
    | HTMLSelectElement
    | null;
  if (!e) return null;
  const o = e.value;
  e.value = v;
  e.dispatchEvent(new Event('input', { bubbles: true }));
  e.dispatchEvent(new Event('change', { bubbles: true }));
  return [id, o];
}

export function dxsShow(
  ta: HTMLTextAreaElement,
  st: HTMLElement,
  list: DxfFoundBands,
  i: number,
): void {
  const r = list[i];
  const old = ta.value;
  const undo: Array<[string, string] | null> = [];
  const sxe =
    typeof document !== 'undefined'
      ? (document.getElementById('hv_sx0') as HTMLInputElement | null)
      : null;
  let off = sxe ? dxsKm(sxe.value) : NaN;
  let offA = '';
  if (!Number.isFinite(off) && Number.isFinite(r.x0d)) {
    off = r.x0d;
    offA = ' (lấy theo bản vẽ)';
    if (sxe) undo.push(dxsSet('sx0', dxsKmF(off)));
  }
  if (!Number.isFinite(off)) off = 0;
  const ox = (v: number): number => v + off;

  ta.value = r.pts.map((p) => `${+(p[0] + off).toFixed(2)} ${+p[1].toFixed(2)}`).join('\n');
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  ta.dispatchEvent(new Event('change', { bubbles: true }));

  let B: DxfBridgeLayout | null = null;
  try {
    B = list.T ? dxsBridge(list.T, list.T.S, r) : null;
  } catch (e) {
    console.error(e);
  }

  const got: string[] = [];
  const f = (v: number): string => (+v).toFixed(2);
  if (B) {
    if (B.xA1 != null && B.xA2 != null && Number.isFinite(B.xA1) && Number.isFinite(B.xA2)) {
      undo.push(dxsSet('xA1', f(ox(B.xA1))), dxsSet('xA2', f(ox(B.xA2))));
      got.push(
        `mép trong mố xA1 = ${f(ox(B.xA1))} m, xA2 = ${f(ox(B.xA2))} m` +
          (B.est ? ` (<b style="color:#c00000">${B.est}</b>)` : ''),
      );
      const piersEl =
        typeof document !== 'undefined'
          ? (document.getElementById('hv_piers') as HTMLTextAreaElement | null)
          : null;
      const op = dxsPairs((piersEl || {}).value || '');
      const piers = B.piers || [];
      undo.push(
        dxsSet(
          'piers',
          piers
            .map(
              (q, k) =>
                `${f(ox(q.x))} ${f(q.a)} ${op.length === piers.length && op[k][2] ? op[k][2] : f(q.a)}`,
            )
            .join('\n'),
        ),
      );
      const curPiers = dxsPairs((piersEl || {}).value || '');
      got.push(
        piers.length
          ? `${piers.length} trụ: ` +
              piers.map((q) => `lý trình ${f(ox(q.x))} m, a = ${f(q.a)} m`).join('; ') +
              (curPiers.some((q) => q[2] === q[1])
                ? ' (chiều dài trụ L theo phương dòng chảy không có trên hình chính diện, kiểm tra lại)'
                : '')
          : 'không có trụ (cầu một nhịp)',
      );
    } else {
      got.push(
        '<b style="color:#c00000">bản vẽ không có hình mố, trụ (hoặc không nhận ra), nhập tay xA1, xA2</b>',
      );
    }
    if (Number.isFinite(B.MNHT)) {
      undo.push(dxsSet('MNHT', f(B.MNHT)));
      got.push(`MNHT = ${f(B.MNHT)} m`);
    }
    if (B.hist.length) {
      undo.push(dxsSet('hist', B.hist.map((q) => q[0] + ' ' + f(q[1])).join('\n')));
      got.push('lũ lịch sử ' + B.hist.map((q) => q[0] + ': ' + f(q[1]) + ' m').join(', '));
    }
    const oth = B.mnAll.filter((q) => !/^MNHT\b/i.test(q.n) && !/^MNL\s*\d{4}/i.test(q.n));
    if (oth.length) {
      undo.push(dxsSet('mnk', oth.map((q) => q.n + ' ' + f(q.v)).join('\n')));
      got.push('các mực nước khác: ' + oth.map((q) => q.n + ' = ' + f(q.v) + ' m').join(', '));
    }
  }

  {
    const P = r.pts;
    const zs = P.map((p) => p[1]);
    let it = -1;
    if (B && B.xA1 != null && B.xA2 != null && Number.isFinite(B.xA1) && B.xA2 > B.xA1) {
      P.forEach((p, j) => {
        if (p[0] >= B!.xA1! && p[0] <= B!.xA2! && (it < 0 || p[1] < P[it][1])) it = j;
      });
    }
    if (it < 0) it = zs.indexOf(Math.min(...zs));
    const mn = B ? B.mnAll : [];
    const lv =
      mn.find((q) => /^MNLTBHN/i.test(q.n.replace(/\s/g, ''))) ||
      mn.find((q) => /^MNTX/i.test(q.n.replace(/\s/g, '')));

    const cut = (dir: -1 | 1, Z: number): number => {
      for (let j = it; j + dir >= 0 && j + dir < P.length; j += dir) {
        const a = P[j];
        const b = P[j + dir];
        if (b[1] >= Z) return a[0] + ((Z - a[1]) * (b[0] - a[0])) / (b[1] - a[1]);
      }
      return P[dir < 0 ? 0 : P.length - 1][0];
    };

    const bank = (dir: -1 | 1): number => {
      for (let j = it + dir; j + dir >= 0 && j + dir < P.length; j += dir) {
        const a = P[j - dir];
        const b = P[j];
        const c = P[j + dir];
        const s1 = (b[1] - a[1]) / Math.abs(b[0] - a[0] || 1e-9);
        const s2 = (c[1] - b[1]) / Math.abs(c[0] - b[0] || 1e-9);
        if (s1 > 0 && s2 < 0.85 * s1) return b[0];
      }
      return P[dir < 0 ? 0 : P.length - 1][0];
    };

    const xl = bank(-1);
    const xr = bank(1);
    let why =
      'Mép bờ lòng suối (điểm gãy độ dốc đầu tiên hai bên lạch sâu) trên mặt cắt ngang tự nhiên';
    if (lv) {
      why += `; tham khảo: giao điểm ${lv.n} = ${f(lv.v)} m với mặt cắt cho lòng chủ ${f(ox(cut(-1, lv.v)))} - ${f(ox(cut(1, lv.v)))} m`;
    }
    undo.push(dxsSet('xL', f(ox(xl))), dxsSet('xR', f(ox(xr))));
    got.push(`lòng chủ từ ${f(ox(xl))} đến ${f(ox(xr))} m (${why[0].toLowerCase() + why.slice(1)})`);
  }

  st.innerHTML =
    `Đã đọc từ bản vẽ: ${r.nE} cọc, ${r.nD} cự ly lẻ, lý trình điểm đầu ${dxsKmF(off)}${offA}${r.nD !== r.nE - 1 || r.warn ? ' - <b style="color:#c00000">số cự ly không khớp số cọc, kiểm tra lại</b>' : ''}. ` +
    (got.length ? 'Đã lấy thêm: ' + got.join('; ') + '. ' : '') +
    (list.length > 1
      ? `Bản vẽ có ${list.length} băng số liệu, chọn: <select class="dxsSel">${list.map((q, k) => `<option value="${k}"${k === i ? ' selected' : ''}>Băng ${k + 1}: ${q.nE} cọc, cao độ ${q.pts[0][1]} ... ${q.pts[q.pts.length - 1][1]}</option>`).join('')}</select> `
      : '') +
    `<a href="#" class="ocrUndo">Hoàn tác</a>`;
  st.style.color = '#006100';

  const undoBtn = st.querySelector('.ocrUndo') as HTMLAnchorElement | null;
  if (undoBtn) {
    undoBtn.onclick = (e) => {
      e.preventDefault();
      undo
        .filter((x): x is [string, string] => x !== null)
        .reverse()
        .forEach(([id, o]) => dxsSet(id, o));
      ta.value = old;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      ta.dispatchEvent(new Event('change', { bubbles: true }));
      st.textContent = 'Đã hoàn tác.';
    };
  }
  const sl = st.querySelector('.dxsSel') as HTMLSelectElement | null;
  if (sl) {
    sl.onchange = () => {
      undo
        .filter((x): x is [string, string] => x !== null)
        .reverse()
        .forEach(([id, o]) => dxsSet(id, o));
      ta.value = old;
      dxsShow(ta, st, list, +sl.value);
    };
  }
}

export async function dxsFile(f: File | null | undefined): Promise<void> {
  if (typeof document === 'undefined' || !f) return;
  const ta = document.getElementById('hv_sec') as HTMLTextAreaElement | null;
  if (!ta) return;
  const st = ensureDxsStat(ta);
  st.style.color = '#555';
  st.textContent = 'Đang đọc bản vẽ...';
  if (/\.dwg$/i.test(f.name)) {
    st.innerHTML =
      '<b style="color:#c00000">Tệp DWG không đọc trực tiếp được trên trình duyệt</b>: trong CAD dùng lệnh SAVEAS, chọn kiểu tệp DXF (bản nào cũng được) rồi chọn lại tệp .dxf.';
    return;
  }
  try {
    const buf = await f.arrayBuffer();
    const decoded = decodeDxfBuffer(buf);
    if (decoded.isBinary) {
      st.innerHTML =
        '<b style="color:#c00000">DXF dạng nhị phân</b>: lưu lại DXF dạng chữ (ASCII, mặc định của SAVEAS).';
      return;
    }
    const T = dxsParse(decoded.text);
    const list = dxsFind(T);
    list.T = T;
    DXS.list = list;
    if (!list.length) {
      st.innerHTML = `<b style="color:#c00000">Không tìm thấy băng số liệu</b> có nhãn "CAO ĐỘ TỰ NHIÊN" và "CỰ LY LẺ" trong bản vẽ (đọc được ${T.length} chữ). Nên lưu riêng phần trắc ngang cần dùng (WBLOCK) thành DXF.`;
      return;
    }
    dxsShow(ta, st, list, 0);
  } catch (e) {
    st.innerHTML =
      '<b style="color:#c00000">Lỗi đọc bản vẽ: ' +
      ((e instanceof Error ? e.message : String(e)) || '') +
      '</b>';
  }
}

export function initDxfDom(): void {
  if (typeof document === 'undefined') return;
  const ta = document.getElementById('hv_sec');
  if (!ta || document.getElementById('hv_secDxf')) return;
  const b = document.createElement('div');
  b.className = 'noprint';
  b.style.margin = '2px 0';
  b.innerHTML =
    '<label class="btn2" style="cursor:pointer">Đọc từ bản vẽ DXF: mặt cắt, mép mố, trụ, mực nước<input type="file" id="hv_secDxf" accept=".dxf,.dwg" style="display:none"></label> <span class="small">Lưu bản vẽ bố trí chung cầu (hoặc trắc ngang) thành DXF (lệnh SAVEAS), chọn tệp: phần mềm lấy mặt cắt từ hàng cự ly lẻ, cao độ tự nhiên; lý trình mép trong mố, tim và bề rộng trụ từ hình chính diện; MNHT, lũ lịch sử từ các ghi chú mực nước.</span>';
  ta.before(b);
  const inp = document.getElementById('hv_secDxf') as HTMLInputElement | null;
  if (inp) {
    inp.onchange = () => {
      if (inp.files && inp.files[0]) dxsFile(inp.files[0]);
      inp.value = '';
    };
  }
}
