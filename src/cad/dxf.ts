import type { CadEntity, CadSheet, ToDxfOptions } from '../types/project';
import { DIMSTY, LAYERS } from './layers';

export function dxfText(s: string): string {
  let r = '';
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    r += c > 126 ? '\\U+' + c.toString(16).toUpperCase().padStart(4, '0') : ch;
  }
  return r;
}

export function toDXF(sheets: readonly CadSheet[], opts: ToDxfOptions = {}): string {
  const o: string[] = [];
  const g = (c: number, v: string | number): void => {
    o.push(String(c), String(v));
  };
  const S0 = sheets[0]?.S ?? 50;
  const DST = sheets[0]?.dst || DIMSTY.B;
  const gapMm = opts.gapMm ?? 50;
  const mm = (v: number): number => v * S0;
  const nf = (v: number): string => (+v.toFixed(4)).toString();
  const nk = (v: number): string => nf(v * 10);

  g(0, 'SECTION');
  g(2, 'HEADER');
  g(9, '$ACADVER');
  g(1, 'AC1009');
  g(9, '$INSUNITS');
  g(70, 4);
  g(9, '$LTSCALE');
  g(40, 1);
  g(9, '$DWGCODEPAGE');
  g(3, 'ANSI_1252');
  g(9, '$LUNITS');
  g(70, 2);
  g(9, '$LUPREC');
  g(70, 2);
  (
    [
      ['$DIMSCALE', 40, 1],
      ['$DIMASZ', 40, mm(DST.asz)],
      ['$DIMEXO', 40, mm(DST.exo)],
      ['$DIMEXE', 40, mm(DST.exe)],
      ['$DIMGAP', 40, mm(DST.gap)],
      ['$DIMTXT', 40, mm(DST.txt)],
      ['$DIMCEN', 40, 0],
      ['$DIMTAD', 70, 1],
      ['$DIMTIH', 70, 0],
      ['$DIMTOH', 70, 0],
      ['$DIMZIN', 70, 8],
      ['$DIMTOFL', 70, 1],
      ['$DIMLFAC', 40, 1],
      ['$DIMCLRD', 70, 8],
      ['$DIMCLRE', 70, 8],
      ['$DIMCLRT', 70, 3],
    ] as const
  ).forEach(([k, c, v]) => {
    g(9, k);
    g(c, typeof v === 'number' ? nf(v) : v);
  });
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
  const dsh = (n: string, desc: string, arr: number[]): void => {
    g(0, 'LTYPE');
    g(2, n);
    g(70, 0);
    g(3, desc);
    g(72, 65);
    g(73, arr.length);
    g(
      40,
      arr.reduce((s, v) => s + Math.abs(v), 0),
    );
    arr.forEach((v) => g(49, v));
  };
  dsh('DASHED', 'Dashed', [mm(3), -mm(1.5)]);
  dsh('CENTER', 'Center', [mm(8), -mm(1.5), mm(1.5), -mm(1.5)]);
  g(0, 'ENDTAB');

  const lys = Object.values(LAYERS);
  g(0, 'TABLE');
  g(2, 'LAYER');
  g(70, lys.length);
  lys.forEach((l) => {
    g(0, 'LAYER');
    g(2, l.n);
    g(70, 0);
    g(62, l.ac);
    g(6, l.lt === 'D' ? 'DASHED' : l.lt === 'X' ? 'CENTER' : 'CONTINUOUS');
  });
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
  g(3, 'arial.ttf');
  g(4, '');
  g(0, 'ENDTAB');
  g(0, 'ENDSEC');

  const emit = (e: CadEntity, yoff: number): void => {
    const L = LAYERS[e.ly].n;
    if (e.k === 'L') {
      g(0, 'LINE');
      g(8, L);
      g(10, nk(e.x1));
      g(20, nk(e.y1 + yoff));
      g(30, 0);
      g(11, nk(e.x2));
      g(21, nk(e.y2 + yoff));
      g(31, 0);
    } else if (e.k === 'P') {
      g(0, 'POLYLINE');
      g(8, L);
      g(66, 1);
      g(10, 0);
      g(20, 0);
      g(30, 0);
      g(70, e.closed ? 1 : 0);
      if (e.w) {
        g(40, nk(e.w));
        g(41, nk(e.w));
      }
      e.pts.forEach((q) => {
        g(0, 'VERTEX');
        g(8, L);
        g(10, nk(q[0]));
        g(20, nk(q[1] + yoff));
        g(30, 0);
      });
      g(0, 'SEQEND');
      g(8, L);
    } else if (e.k === 'C') {
      if (e.fill) {
        const r = e.r / 2;
        g(0, 'POLYLINE');
        g(8, L);
        g(66, 1);
        g(10, 0);
        g(20, 0);
        g(30, 0);
        g(70, 1);
        g(40, nk(e.r));
        g(41, nk(e.r));
        g(0, 'VERTEX');
        g(8, L);
        g(10, nk(e.x - r));
        g(20, nk(e.y + yoff));
        g(30, 0);
        g(42, 1);
        g(0, 'VERTEX');
        g(8, L);
        g(10, nk(e.x + r));
        g(20, nk(e.y + yoff));
        g(30, 0);
        g(42, 1);
        g(0, 'SEQEND');
        g(8, L);
      } else {
        g(0, 'CIRCLE');
        g(8, L);
        g(10, nk(e.x));
        g(20, nk(e.y + yoff));
        g(30, 0);
        g(40, nk(e.r));
      }
    } else if (e.k === 'A') {
      const nx = -e.uy;
      const ny = e.ux;
      const w = e.wid / 2;
      const bx = e.x + e.ux * e.len;
      const by = e.y + e.uy * e.len;
      g(0, 'SOLID');
      g(8, L);
      [
        [e.x, e.y],
        [bx + nx * w, by + ny * w],
        [e.x, e.y],
        [bx - nx * w, by - ny * w],
      ].forEach((q, i) => {
        g(10 + i, nk(q[0]));
        g(20 + i, nk(q[1] + yoff));
        g(30 + i, 0);
      });
    } else if (e.k === 'T' && e.s) {
      const hj = e.al === 'l' ? 0 : e.al === 'c' ? 1 : 2;
      const vj = e.va === 'b' ? 0 : e.va === 'm' ? 2 : 3;
      g(0, 'TEXT');
      g(8, L);
      if (e.col) g(62, e.col);
      g(10, nk(e.x));
      g(20, nk(e.y + yoff));
      g(30, 0);
      g(40, nk(e.h));
      g(1, dxfText(e.s));
      if (e.rot) g(50, nf(e.rot));
      if (e.wf && e.wf !== 1) g(41, nf(e.wf));
      g(72, hj);
      g(11, nk(e.x));
      g(21, nk(e.y + yoff));
      g(31, 0);
      g(73, vj === 0 ? 0 : vj === 2 ? 2 : 3);
      g(7, 'STANDARD');
    }
  };

  g(0, 'SECTION');
  g(2, 'BLOCKS');
  let yoff = 0;
  const offs: number[] = [];
  sheets.forEach((sh) => {
    offs.push(yoff);
    const by: Record<number, CadEntity[]> = {};
    for (const e of sh.E.a) {
      if (e.k !== 'DM' && e.dm) {
        (by[e.dm] = by[e.dm] || []).push(e);
      }
    }
    for (const id of Object.keys(by)) {
      g(0, 'BLOCK');
      g(8, 0);
      g(2, '*D' + id);
      g(70, 1);
      g(10, 0);
      g(20, 0);
      g(30, 0);
      g(3, '*D' + id);
      by[Number(id)].forEach((e) => emit(e, yoff));
      g(0, 'ENDBLK');
      g(8, 0);
    }
    yoff -= sh.H + (gapMm * sh.S) / 10;
  });
  g(0, 'ENDSEC');

  g(0, 'SECTION');
  g(2, 'ENTITIES');
  sheets.forEach((sh, si) => {
    const yo = offs[si];
    for (const e of sh.E.a) {
      if (e.k !== 'DM' && e.dm) continue;
      if (e.k === 'DM') {
        g(0, 'DIMENSION');
        g(8, LAYERS.DIM.n);
        g(2, '*D' + e.id);
        g(10, nk(e.dl[0]));
        g(20, nk(e.dl[1] + yo));
        g(30, 0);
        g(11, nk(e.tm[0]));
        g(21, nk(e.tm[1] + yo));
        g(31, 0);
        g(70, e.typ);
        if (e.txt) g(1, dxfText(e.txt));
        g(13, nk(e.a[0]));
        g(23, nk(e.a[1] + yo));
        g(33, 0);
        g(14, nk(e.b[0]));
        g(24, nk(e.b[1] + yo));
        g(34, 0);
        if (e.typ === 0) g(50, e.ang);
      } else {
        emit(e, yo);
      }
    }
  });
  g(0, 'ENDSEC');
  g(0, 'EOF');
  return o.join('\r\n');
}
