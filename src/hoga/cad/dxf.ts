/**
 * Xuất DXF.
 *  - `R2000` (AC1015, mặc định): LWPOLYLINE, HATCH thật (mẫu ANSI31 / ANSI37), DIMENSION thật kèm khối ẩn *D, BLOCK + INSERT
 *    cho nốt thép, TEXT; mỗi tỷ lệ bản vẽ có một DIMSTYLE riêng. Đã mở và AUDIT bằng AutoCAD (accoreconsole) khi phát triển.
 *  - `R12` (AC1009): LINE, CIRCLE, POLYLINE, TEXT – HATCH/DIMENSION được khai triển thành đoạn thẳng, để tương thích bản cũ.
 */
import { expandEnts, LAYERS, translate, type DimEnt, type Ent, type HatchEnt } from './ents';
import type { Sheet } from './sheets';

export interface Placed {
  sheet: Sheet;
  ox: number;
  oy: number;
}

export type DxfVersion = 'R2000' | 'R12';

/**
 * Xếp các nhóm tờ (mỗi nhóm = một ga) thành các hàng, mỗi hàng nằm ngang, các hàng chồng xuống dưới.
 * Các tờ trong hàng chung đáy; hàng sau đặt NGAY DƯỚI hàng trước (cạnh trên của hàng sau thấp hơn đáy hàng trước
 * một khoảng hở) nên không bao giờ đè nhau dù tờ của các ga có tỷ lệ — tức kích thước mô hình — khác nhau.
 * (Bản cũ đặt hàng sau cách hàng trước 1,1 × chiều cao hàng TRƯỚC: ga sau có tờ cao hơn thì chồng lên hàng trên.)
 */
export function layoutSheets(groups: Sheet[][]): Placed[] {
  const out: Placed[] = [];
  let top: number | null = null; // cạnh trên của hàng sắp đặt (hàng đầu có đáy ở y = 0 như trước)
  for (const g of groups) {
    if (!g.length) continue;
    const rowH = g.reduce((m, sh) => Math.max(m, sh.h), 0);
    const oy: number = top === null ? 0 : top - rowH;
    let x = 0;
    for (const sh of g) {
      out.push({ sheet: sh, ox: x, oy });
      x += sh.w * 1.08;
    }
    top = oy - rowH * 0.1;
  }
  return out;
}

const esc = (s: string): string => {
  let o = '';
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (c < 128) o += ch;
    else o += `\\U+${c.toString(16).toUpperCase().padStart(4, '0')}`;
  }
  return o;
};
const f = (x: number): string => (Math.round(x * 1e4) / 1e4).toString();

function extents(placed: Placed[]): { x0: number; y0: number; x1: number; y1: number } {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of placed) {
    x0 = Math.min(x0, p.ox);
    y0 = Math.min(y0, p.oy);
    x1 = Math.max(x1, p.ox + p.sheet.w);
    y1 = Math.max(y1, p.oy + p.sheet.h);
  }
  if (!Number.isFinite(x0)) return { x0: 0, y0: 0, x1: 100, y1: 100 };
  return { x0, y0, x1, y1 };
}

export function toDXF(placed: Placed[], version: DxfVersion = 'R2000'): string {
  return version === 'R12' ? toDXF12(placed) : toDXF2000(placed);
}

/* ------------------------------------------------------------------ R12 */

function toDXF12(placed: Placed[]): string {
  const L: string[] = [];
  const g = (code: number, v: string | number) => L.push(String(code), String(v));
  const ents: Ent[] = expandEnts(placed.flatMap((p) => translate(p.sheet.ents, p.ox, p.oy)));
  const { x0, y0, x1, y1 } = extents(placed);
  const refScale = placed.length ? placed[0].sheet.scale : 20;

  g(0, 'SECTION');
  g(2, 'HEADER');
  g(9, '$ACADVER');
  g(1, 'AC1009');
  g(9, '$LTSCALE');
  g(40, f(Math.max(1, refScale / 4)));
  g(9, '$EXTMIN');
  g(10, f(x0));
  g(20, f(y0));
  g(30, 0);
  g(9, '$EXTMAX');
  g(10, f(x1));
  g(20, f(y1));
  g(30, 0);
  g(0, 'ENDSEC');

  g(0, 'SECTION');
  g(2, 'TABLES');
  g(0, 'TABLE');
  g(2, 'LTYPE');
  g(70, 3);
  g(0, 'LTYPE');
  g(2, 'CONTINUOUS');
  g(70, 0);
  g(3, 'Solid line');
  g(72, 65);
  g(73, 0);
  g(40, 0);
  g(0, 'LTYPE');
  g(2, 'DASHED');
  g(70, 0);
  g(3, 'Dashed');
  g(72, 65);
  g(73, 2);
  g(40, 1.0);
  g(49, 0.6);
  g(49, -0.4);
  g(0, 'LTYPE');
  g(2, 'CENTER');
  g(70, 0);
  g(3, 'Center');
  g(72, 65);
  g(73, 4);
  g(40, 2.0);
  g(49, 1.25);
  g(49, -0.25);
  g(49, 0.25);
  g(49, -0.25);
  g(0, 'ENDTAB');
  g(0, 'TABLE');
  g(2, 'LAYER');
  g(70, LAYERS.length);
  for (const l of LAYERS) {
    g(0, 'LAYER');
    g(2, l.name);
    g(70, 0);
    g(62, l.aci);
    g(6, l.linetype);
  }
  g(0, 'ENDTAB');
  g(0, 'TABLE');
  g(2, 'STYLE');
  g(70, 1);
  g(0, 'STYLE');
  g(2, 'STANDARD');
  g(70, 0);
  g(40, 0);
  g(41, 1);
  g(50, 0);
  g(71, 0);
  g(42, 2.5);
  g(3, 'txt');
  g(4, '');
  g(0, 'ENDTAB');
  g(0, 'ENDSEC');

  g(0, 'SECTION');
  g(2, 'ENTITIES');
  for (const e of ents) {
    switch (e.t) {
      case 'line':
        g(0, 'LINE');
        g(8, e.layer);
        g(10, f(e.x1));
        g(20, f(e.y1));
        g(30, 0);
        g(11, f(e.x2));
        g(21, f(e.y2));
        g(31, 0);
        break;
      case 'circle':
        if (e.fill) {
          // vòng tròn đặc: polyline kín 2 đỉnh, bulge = 1, bề rộng = bán kính
          g(0, 'POLYLINE');
          g(8, e.layer);
          g(66, 1);
          g(70, 1);
          g(40, f(e.r));
          g(41, f(e.r));
          for (const sx of [-1, 1]) {
            g(0, 'VERTEX');
            g(8, e.layer);
            g(10, f(e.cx + (sx * e.r) / 2));
            g(20, f(e.cy));
            g(30, 0);
            g(42, 1);
          }
          g(0, 'SEQEND');
          g(8, e.layer);
        } else {
          g(0, 'CIRCLE');
          g(8, e.layer);
          g(10, f(e.cx));
          g(20, f(e.cy));
          g(30, 0);
          g(40, f(e.r));
        }
        break;
      case 'poly':
        g(0, 'POLYLINE');
        g(8, e.layer);
        g(66, 1);
        g(70, e.closed ? 1 : 0);
        for (const [x, y] of e.pts) {
          g(0, 'VERTEX');
          g(8, e.layer);
          g(10, f(x));
          g(20, f(y));
          g(30, 0);
        }
        g(0, 'SEQEND');
        g(8, e.layer);
        break;
      case 'text': {
        g(0, 'TEXT');
        g(8, e.layer);
        g(10, f(e.x));
        g(20, f(e.y));
        g(30, 0);
        g(40, f(e.h));
        g(1, esc(e.s));
        if (e.rot) g(50, f(e.rot));
        g(7, 'STANDARD');
        if (e.align === 'c' || e.align === 'r') {
          g(72, e.align === 'c' ? 1 : 2);
          g(11, f(e.x));
          g(21, f(e.y));
          g(31, 0);
        }
        break;
      }
    }
  }
  g(0, 'ENDSEC');
  g(0, 'EOF');
  return L.join('\r\n') + '\r\n';
}

/* ------------------------------------------------------------------ R2000 */

class Writer2000 {
  private lines: string[] = [];
  private nextH = 0x30;
  handle(): string {
    return (this.nextH++).toString(16).toUpperCase();
  }
  seed(): string {
    return this.nextH.toString(16).toUpperCase();
  }
  g(code: number, v: string | number): void {
    this.lines.push(String(code), String(v));
  }
  out(): string[] {
    return this.lines;
  }
}

function toDXF2000(placed: Placed[]): string {
  const w = new Writer2000();
  const all: Ent[] = placed.flatMap((p) => translate(p.sheet.ents, p.ox, p.oy));
  const { x0, y0, x1, y1 } = extents(placed);
  const g = w.g.bind(w);

  // ---- các đối tượng cần đăng ký trước: DIMSTYLE theo tỷ lệ, khối *D, khối nốt thép
  const scales = new Set<number>();
  for (const e of all) if (e.t === 'dim') scales.add(e.s);
  const dimBlocks: { name: string; ent: DimEnt; handle: string; recHandle: string }[] = [];
  let dimN = 0;
  for (const e of all) {
    if (e.t === 'dim') {
      dimN++;
      dimBlocks.push({ name: `*D${dimN}`, ent: e, handle: w.handle(), recHandle: w.handle() });
    }
  }
  const rootDict = w.handle();
  const plotDict = w.handle();
  const placeholder = w.handle();
  const dotRec = w.handle();
  const msRec = w.handle();
  const psRec = w.handle();
  const tblHandles = { vport: w.handle(), ltype: w.handle(), layer: w.handle(), style: w.handle(), appid: w.handle(), dimstyle: w.handle(), brec: w.handle() };

  // ================= TABLES
  const tables: string[] = [];
  const t = new Writer2000();
  const tg = t.g.bind(t);
  const table = (name: string, handle: string, count: number, sub?: string) => {
    tg(0, 'TABLE');
    tg(2, name);
    tg(5, handle);
    tg(330, 0);
    tg(100, 'AcDbSymbolTable');
    tg(70, count);
    if (sub) tg(100, sub);
  };
  const rec = (kind: string, owner: string, sub: string, handle = w.handle()) => {
    tg(0, kind);
    tg(5, handle);
    tg(330, owner);
    tg(100, 'AcDbSymbolTableRecord');
    tg(100, sub);
  };

  table('VPORT', tblHandles.vport, 1);
  rec('VPORT', tblHandles.vport, 'AcDbViewportTableRecord');
  tg(2, '*Active');
  tg(70, 0);
  tg(10, 0);
  tg(20, 0);
  tg(11, 1);
  tg(21, 1);
  tg(12, f((x0 + x1) / 2));
  tg(22, f((y0 + y1) / 2));
  tg(13, 0);
  tg(23, 0);
  tg(14, 10);
  tg(24, 10);
  tg(15, 10);
  tg(25, 10);
  tg(16, 0);
  tg(26, 0);
  tg(36, 1);
  tg(17, 0);
  tg(27, 0);
  tg(37, 0);
  tg(40, f(Math.max(y1 - y0, (x1 - x0) / 1.6)));
  tg(41, 1.6);
  tg(42, 50);
  tg(0, 'ENDTAB');

  table('LTYPE', tblHandles.ltype, 5);
  const ltype = (name: string, desc: string, pattern: number[]) => {
    rec('LTYPE', tblHandles.ltype, 'AcDbLinetypeTableRecord');
    tg(2, name);
    tg(70, 0);
    tg(3, desc);
    tg(72, 65);
    tg(73, pattern.length);
    tg(40, f(pattern.reduce((a, b) => a + Math.abs(b), 0)));
    for (const p of pattern) {
      tg(49, p);
      tg(74, 0);
    }
  };
  ltype('ByBlock', '', []);
  ltype('ByLayer', '', []);
  ltype('CONTINUOUS', 'Solid line', []);
  ltype('DASHED', 'Dashed', [0.6, -0.4]);
  ltype('CENTER', 'Center', [1.25, -0.25, 0.25, -0.25]);
  tg(0, 'ENDTAB');

  table('LAYER', tblHandles.layer, LAYERS.length + 1);
  rec('LAYER', tblHandles.layer, 'AcDbLayerTableRecord');
  tg(2, '0');
  tg(70, 0);
  tg(62, 7);
  tg(6, 'CONTINUOUS');
  tg(390, placeholder);
  for (const l of LAYERS) {
    rec('LAYER', tblHandles.layer, 'AcDbLayerTableRecord');
    tg(2, l.name);
    tg(70, 0);
    tg(62, l.aci);
    tg(6, l.linetype);
    tg(390, placeholder);
  }
  tg(0, 'ENDTAB');

  table('STYLE', tblHandles.style, 1);
  rec('STYLE', tblHandles.style, 'AcDbTextStyleTableRecord');
  tg(2, 'STANDARD');
  tg(70, 0);
  tg(40, 0);
  tg(41, 1);
  tg(50, 0);
  tg(71, 0);
  tg(42, 2.5);
  tg(3, 'arial.ttf');
  tg(4, '');
  tg(0, 'ENDTAB');

  table('VIEW', w.handle(), 0);
  tg(0, 'ENDTAB');
  table('UCS', w.handle(), 0);
  tg(0, 'ENDTAB');

  table('APPID', tblHandles.appid, 1);
  rec('APPID', tblHandles.appid, 'AcDbRegAppTableRecord');
  tg(2, 'ACAD');
  tg(70, 0);
  tg(0, 'ENDTAB');

  const sc = [...scales].sort((a, b) => a - b);
  table('DIMSTYLE', tblHandles.dimstyle, sc.length + 1, 'AcDbDimStyleTable');
  const dimstyle = (name: string, s: number) => {
    tg(0, 'DIMSTYLE');
    tg(105, w.handle());
    tg(330, tblHandles.dimstyle);
    tg(100, 'AcDbSymbolTableRecord');
    tg(100, 'AcDbDimStyleTableRecord');
    tg(2, name);
    tg(70, 0);
    tg(3, '');
    tg(4, '');
    tg(40, 1);
    tg(41, f(2.5 * s));
    tg(42, f(1 * s));
    tg(43, f(3.75 * s));
    tg(44, f(1.2 * s));
    tg(45, 0);
    tg(46, 0);
    tg(47, 0);
    tg(48, 0);
    tg(140, f(2.2 * s));
    tg(141, f(2.5 * s));
    tg(142, f(1 * s));
    tg(143, 25.4);
    tg(144, 1);
    tg(145, 0);
    tg(146, 1);
    tg(147, f(0.8 * s));
    tg(71, 0);
    tg(72, 0);
    tg(73, 0);
    tg(74, 0);
    tg(75, 0);
    tg(76, 0);
    tg(77, 1);
    tg(78, 0);
    tg(170, 0);
    tg(171, 3);
    tg(172, 0);
    tg(173, 0);
    tg(174, 0);
    tg(175, 0);
    tg(176, 0);
    tg(177, 0);
    tg(178, 0);
  };
  dimstyle('STANDARD', 1);
  for (const s of sc) dimstyle(`HG${s}`, s);
  tg(0, 'ENDTAB');

  const blockNames = ['*Model_Space', '*Paper_Space', 'NOT', ...dimBlocks.map((d) => d.name)];
  const blockRecHandles = [msRec, psRec, dotRec, ...dimBlocks.map((d) => d.recHandle)];
  table('BLOCK_RECORD', tblHandles.brec, blockNames.length);
  blockNames.forEach((n, i) => {
    rec('BLOCK_RECORD', tblHandles.brec, 'AcDbBlockTableRecord', blockRecHandles[i]);
    tg(2, n);
    tg(340, 0);
  });
  tg(0, 'ENDTAB');
  for (const x of t.out()) tables.push(x);

  // ================= BLOCKS
  const b = new Writer2000();
  const bg = b.g.bind(b);
  const block = (name: string, rec: string, anon: boolean, body: () => void) => {
    bg(0, 'BLOCK');
    bg(5, w.handle());
    bg(330, rec);
    bg(100, 'AcDbEntity');
    bg(8, '0');
    bg(100, 'AcDbBlockBegin');
    bg(2, name);
    bg(70, anon ? 1 : 0);
    bg(10, 0);
    bg(20, 0);
    bg(30, 0);
    bg(3, name);
    bg(1, '');
    body();
    bg(0, 'ENDBLK');
    bg(5, w.handle());
    bg(330, rec);
    bg(100, 'AcDbEntity');
    bg(8, '0');
    bg(100, 'AcDbBlockEnd');
  };
  const entity = (out: Writer2000, kind: string, owner: string, layer: string, sub: string) => {
    out.g(0, kind);
    out.g(5, w.handle());
    out.g(330, owner);
    out.g(100, 'AcDbEntity');
    out.g(8, layer);
    out.g(100, sub);
  };
  block('*Model_Space', msRec, false, () => undefined);
  block('*Paper_Space', psRec, false, () => undefined);
  // nốt thép: hình tròn đặc bán kính 1 (INSERT với tỷ lệ = bán kính)
  block('NOT', dotRec, false, () => {
    entity(b, 'HATCH', dotRec, '0', 'AcDbHatch');
    bg(10, 0);
    bg(20, 0);
    bg(30, 0);
    bg(210, 0);
    bg(220, 0);
    bg(230, 1);
    bg(2, 'SOLID');
    bg(70, 1);
    bg(71, 0);
    bg(91, 1);
    bg(92, 1);
    bg(93, 1);
    bg(72, 2);
    bg(10, 0);
    bg(20, 0);
    bg(40, 1);
    bg(50, 0);
    bg(51, 360);
    bg(73, 1);
    bg(97, 0);
    bg(75, 0);
    bg(76, 1);
    bg(98, 0);
  });
  const writeText = (out: Writer2000, e: Extract<Ent, { t: 'text' }>, owner: string) => {
    entity(out, 'TEXT', owner, e.layer, 'AcDbText');
    out.g(10, f(e.x));
    out.g(20, f(e.y));
    out.g(30, 0);
    out.g(40, f(e.h));
    out.g(1, esc(e.s));
    if (e.rot) out.g(50, f(e.rot));
    out.g(7, 'STANDARD');
    if (e.align === 'c' || e.align === 'r') {
      out.g(72, e.align === 'c' ? 1 : 2);
      out.g(11, f(e.x));
      out.g(21, f(e.y));
      out.g(31, 0);
    }
    out.g(100, 'AcDbText');
    out.g(73, 0);
  };
  for (const d of dimBlocks) {
    block(d.name, d.recHandle, true, () => {
      for (const e of expandEnts([d.ent])) {
        if (e.t === 'line') {
          entity(b, 'LINE', d.recHandle, e.layer, 'AcDbLine');
          bg(10, f(e.x1));
          bg(20, f(e.y1));
          bg(30, 0);
          bg(11, f(e.x2));
          bg(21, f(e.y2));
          bg(31, 0);
        } else if (e.t === 'text') writeText(b, e, d.recHandle);
      }
    });
  }

  // ================= ENTITIES
  const en = new Writer2000();
  const eg = en.g.bind(en);
  let di = 0;
  for (const e of all) {
    switch (e.t) {
      case 'line':
        entity(en, 'LINE', msRec, e.layer, 'AcDbLine');
        eg(10, f(e.x1));
        eg(20, f(e.y1));
        eg(30, 0);
        eg(11, f(e.x2));
        eg(21, f(e.y2));
        eg(31, 0);
        break;
      case 'circle':
        if (e.fill) {
          entity(en, 'INSERT', msRec, e.layer, 'AcDbBlockReference');
          eg(2, 'NOT');
          eg(10, f(e.cx));
          eg(20, f(e.cy));
          eg(30, 0);
          eg(41, f(e.r));
          eg(42, f(e.r));
          eg(43, f(e.r));
        } else {
          entity(en, 'CIRCLE', msRec, e.layer, 'AcDbCircle');
          eg(10, f(e.cx));
          eg(20, f(e.cy));
          eg(30, 0);
          eg(40, f(e.r));
        }
        break;
      case 'poly':
        entity(en, 'LWPOLYLINE', msRec, e.layer, 'AcDbPolyline');
        eg(90, e.pts.length);
        eg(70, e.closed ? 1 : 0);
        for (const [x, y] of e.pts) {
          eg(10, f(x));
          eg(20, f(y));
        }
        break;
      case 'text':
        writeText(en, e, msRec);
        break;
      case 'hatch': {
        const h = e as HatchEnt;
        // mẫu tô một họ đường song song: góc h.angle, khoảng cách vuông góc = h.gap (mm mô hình) – nhúng sẵn trong thực thể
        const ang = (h.angle * Math.PI) / 180;
        entity(en, 'HATCH', msRec, h.layer, 'AcDbHatch');
        eg(10, 0);
        eg(20, 0);
        eg(30, 0);
        eg(210, 0);
        eg(220, 0);
        eg(230, 1);
        eg(2, 'ANSI31');
        eg(70, 0);
        eg(71, 0);
        eg(91, h.loops.length);
        for (const loop of h.loops) {
          eg(92, 3);
          eg(72, 0);
          eg(73, 1);
          eg(93, loop.length);
          for (const [x, y] of loop) {
            eg(10, f(x));
            eg(20, f(y));
          }
          eg(97, 0);
        }
        eg(75, 0);
        eg(76, 1);
        eg(52, 0);
        eg(41, 1);
        eg(77, 0);
        eg(78, 1);
        eg(53, f(h.angle));
        eg(43, 0);
        eg(44, 0);
        eg(45, f(-Math.sin(ang) * h.gap));
        eg(46, f(Math.cos(ang) * h.gap));
        eg(79, 0);
        eg(98, 0);
        break;
      }
      case 'dim': {
        const d = dimBlocks[di++];
        entity(en, 'DIMENSION', msRec, e.layer, 'AcDbDimension');
        eg(2, d.name);
        const cx = e.kind === 'h' ? (e.a + e.b) / 2 : e.pos;
        const cy = e.kind === 'h' ? e.pos : (e.a + e.b) / 2;
        eg(10, f(e.kind === 'h' ? e.a : e.pos));
        eg(20, f(e.kind === 'h' ? e.pos : e.a));
        eg(30, 0);
        eg(11, f(cx));
        eg(21, f(cy));
        eg(31, 0);
        eg(70, 0);
        eg(1, e.text);
        eg(3, `HG${e.s}`);
        eg(100, 'AcDbAlignedDimension');
        eg(13, f(e.kind === 'h' ? e.a : e.ref));
        eg(23, f(e.kind === 'h' ? e.ref : e.a));
        eg(33, 0);
        eg(14, f(e.kind === 'h' ? e.b : e.ref));
        eg(24, f(e.kind === 'h' ? e.ref : e.b));
        eg(34, 0);
        eg(50, e.kind === 'h' ? 0 : 90);
        eg(100, 'AcDbRotatedDimension');
        break;
      }
    }
  }

  // ================= OBJECTS: từ điển gốc tối thiểu
  const o = new Writer2000();
  const og = o.g.bind(o);
  og(0, 'DICTIONARY');
  og(5, rootDict);
  og(330, 0);
  og(100, 'AcDbDictionary');
  og(281, 1);
  og(3, 'ACAD_PLOTSTYLENAME');
  og(350, plotDict);
  og(0, 'ACDBDICTIONARYWDFLT');
  og(5, plotDict);
  og(330, rootDict);
  og(100, 'AcDbDictionary');
  og(281, 1);
  og(3, 'Normal');
  og(350, placeholder);
  og(100, 'AcDbDictionaryWithDefault');
  og(340, placeholder);
  og(0, 'ACDBPLACEHOLDER');
  og(5, placeholder);
  og(330, plotDict);

  // ================= ghép
  const out = new Writer2000();
  const G = out.g.bind(out);
  G(0, 'SECTION');
  G(2, 'HEADER');
  G(9, '$ACADVER');
  G(1, 'AC1015');
  G(9, '$HANDSEED');
  G(5, w.seed());
  G(9, '$INSUNITS');
  G(70, 4);
  G(9, '$LTSCALE');
  G(40, f(Math.max(1, (placed[0]?.sheet.scale ?? 20) / 4)));
  G(9, '$DIMSTYLE');
  G(2, 'STANDARD');
  G(9, '$EXTMIN');
  G(10, f(x0));
  G(20, f(y0));
  G(30, 0);
  G(9, '$EXTMAX');
  G(10, f(x1));
  G(20, f(y1));
  G(30, 0);
  G(0, 'ENDSEC');
  // lưu ý: không dùng push(...mảng lớn) – với bản vẽ nhiều ga mảng có hàng trăm nghìn phần tử làm tràn ngăn xếp
  const raw: string[] = out.out();
  const add = (...parts: (string[] | string)[]) => {
    for (const part of parts) {
      if (typeof part === 'string') raw.push(part);
      else for (const x of part) raw.push(x);
    }
  };
  add('0', 'SECTION', '2', 'TABLES', tables, '0', 'ENDSEC');
  add('0', 'SECTION', '2', 'BLOCKS', b.out(), '0', 'ENDSEC');
  add('0', 'SECTION', '2', 'ENTITIES', en.out(), '0', 'ENDSEC');
  add('0', 'SECTION', '2', 'OBJECTS', o.out(), '0', 'ENDSEC');
  add('0', 'EOF');
  void blockRecHandles;
  return raw.join('\r\n') + '\r\n';
}
