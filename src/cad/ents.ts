import type {
  CadArrowEntity,
  CadBBox,
  CadCircleEntity,
  CadEntity,
  CadEntsBuffer,
  CadLayerId,
  CadLineEntity,
  CadPolylineEntity,
  CadTextEntity,
  Point2D,
} from '../types/project';
import { capFirst, textW } from './layers';

export interface CadBox4 {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  w?: number;
  h?: number;
  s?: number;
  o?: 'h' | 'v';
  dg?: number;
}

export interface CadBoxMeta extends CadBBox {
  s?: number;
  o?: 'h' | 'v';
  dg?: number;
}

export function mkBox(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  extra?: { s?: number; o?: 'h' | 'v'; dg?: number },
): CadBoxMeta {
  const b: CadBoxMeta = {
    x0,
    y0,
    x1,
    y1,
    w: x1 - x0,
    h: y1 - y0,
  };
  if (extra?.s !== undefined) b.s = extra.s;
  if (extra?.o !== undefined) b.o = extra.o;
  if (extra?.dg !== undefined) b.dg = extra.dg;
  return b;
}

export interface TextOpts {
  al?: 'l' | 'c' | 'r';
  va?: 'b' | 'm' | 't';
  rot?: number;
  bold?: boolean;
  halo?: boolean;
  wf?: number;
  raw?: boolean;
  col?: number;
}

export interface PolyOpts {
  closed?: boolean;
  w?: number;
}

export interface CircOpts {
  fill?: boolean;
  rMin?: number;
}

export function bbox(entities: readonly CadEntity[]): CadBBox {
  let x0 = 1e18;
  let y0 = 1e18;
  let x1 = -1e18;
  let y1 = -1e18;
  const P = (x: number, y: number): void => {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  };
  for (const e of entities) {
    if (e.k === 'L') {
      P(e.x1, e.y1);
      P(e.x2, e.y2);
    } else if (e.k === 'P') {
      e.pts.forEach((q) => P(q[0], q[1]));
    } else if (e.k === 'C') {
      P(e.x - e.r, e.y - e.r);
      P(e.x + e.r, e.y + e.r);
    } else if (e.k === 'DM') {
      // Excluded per TuongChanL parity (`02_cad_2d.js#L198-199`)
    } else if (e.k === 'A') {
      P(e.x, e.y);
      P(e.x + e.ux * e.len, e.y + e.uy * e.len);
    } else if (e.k === 'T') {
      const w = textW(e.s, e.h, e.bold) * (e.wf || 1);
      const a = e.al === 'l' ? 0 : e.al === 'c' ? -w / 2 : -w;
      const b = a + w;
      const r = (e.rot * Math.PI) / 180;
      const cs = Math.cos(r);
      const sn = Math.sin(r);
      for (const [px, py] of [
        [a, 0],
        [b, 0],
        [a, e.h],
        [b, e.h],
      ] as const) {
        P(e.x + px * cs - py * sn, e.y + px * sn + py * cs);
      }
    }
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

export class Ents implements CadEntsBuffer {
  a: CadEntity[] = [];
  lbl: CadBoxMeta[] = [];
  dz?: CadBoxMeta[];
  chn?: CadBoxMeta[];
  tbx?: CadBoxMeta[];
  lgsSegs?: Array<[Point2D, Point2D]>;
  env?: { x0: number; y0: number; x1: number; y1: number };
  _sd?: number;

  line(x1: number, y1: number, x2: number, y2: number, ly: CadLayerId = 'THIN'): this {
    const ent: CadLineEntity = { k: 'L', x1, y1, x2, y2, ly };
    this.a.push(ent);
    return this;
  }

  poly(pts: readonly Point2D[], ly: CadLayerId = 'OUT', o: PolyOpts = {}): this {
    const ent: CadPolylineEntity = {
      k: 'P',
      pts: pts.map((q) => [q[0], q[1]] as Point2D),
      ly,
      closed: !!o.closed,
      w: o.w || 0,
    };
    this.a.push(ent);
    return this;
  }

  rect(x0: number, y0: number, x1: number, y1: number, ly: CadLayerId = 'OUT'): this {
    return this.poly(
      [
        [x0, y0],
        [x1, y0],
        [x1, y1],
        [x0, y1],
      ],
      ly,
      { closed: true },
    );
  }

  circ(x: number, y: number, r: number, ly: CadLayerId = 'THIN', o: CircOpts = {}): this {
    const e: CadCircleEntity = { k: 'C', x, y, r, ly, fill: !!o.fill };
    if (o.rMin) e.rMin = o.rMin;
    this.a.push(e);
    return this;
  }

  arrow(
    x: number,
    y: number,
    ux: number,
    uy: number,
    len: number,
    wid: number,
    ly: CadLayerId = 'DIM',
  ): this {
    const ent: CadArrowEntity = { k: 'A', x, y, ux, uy, len, wid, ly };
    this.a.push(ent);
    return this;
  }

  text(
    x: number,
    y: number,
    s: string | number,
    h: number,
    ly: CadLayerId = 'NOTE',
    o: TextOpts = {},
  ): this {
    let txt = String(s);
    if ((ly === 'NOTE' || ly === 'CDO') && !o.raw) txt = capFirst(txt);
    const ent: CadTextEntity = {
      k: 'T',
      x,
      y,
      s: txt,
      h,
      ly,
      al: o.al || 'l',
      va: o.va || 'b',
      rot: o.rot || 0,
      bold: !!o.bold,
      halo: !!o.halo,
      wf: o.wf || 1,
      col: o.col ?? 3,
    };
    this.a.push(ent);
    return this;
  }

  add(o: CadEntsBuffer, dx = 0, dy = 0): this {
    for (const e of o.a) {
      if (e.k === 'L') {
        this.a.push({
          ...e,
          x1: e.x1 + dx,
          x2: e.x2 + dx,
          y1: e.y1 + dy,
          y2: e.y2 + dy,
        });
      } else if (e.k === 'P') {
        this.a.push({
          ...e,
          pts: e.pts.map((q) => [q[0] + dx, q[1] + dy] as Point2D),
        });
      } else if (e.k === 'DM') {
        this.a.push({
          ...e,
          a: [e.a[0] + dx, e.a[1] + dy],
          b: [e.b[0] + dx, e.b[1] + dy],
          dl: [e.dl[0] + dx, e.dl[1] + dy],
          tm: [e.tm[0] + dx, e.tm[1] + dy],
        });
      } else {
        this.a.push({
          ...e,
          x: e.x + dx,
          y: e.y + dy,
        });
      }
    }
    return this;
  }

  bbox(): CadBBox {
    return bbox(this.a);
  }
}
