import { expandEnts, LAYERS, type Ent } from './ents';
import type { Sheet } from './sheets';

export type CadTheme = 'light' | 'dark';

const PALETTE: Record<CadTheme, Record<string, string>> = {
  dark: { KC: '#4fd8ee', LOT: '#c78bd9', CONG: '#6aa3ff', THEP: '#ff5a4d', KT: '#58d68d', TEXT: '#e8edf2', HATCH: '#7c8794', TIM: '#ff7a6b', NET: '#8a94a0', KHUNG: '#e8edf2', paper: '#0b1425' },
  light: { KC: '#0a7a8f', LOT: '#8a3fa0', CONG: '#1f5fd1', THEP: '#d62a1d', KT: '#16803c', TEXT: '#1c242d', HATCH: '#7a8590', TIM: '#d62a1d', NET: '#6c7782', KHUNG: '#1c242d', paper: '#ffffff' },
};

export function svgStyle(theme: CadTheme): string {
  const p = PALETTE[theme];
  const css = LAYERS.map((l) => {
    const dash = l.linetype === 'DASHED' ? 'stroke-dasharray:6 4;' : l.linetype === 'CENTER' ? 'stroke-dasharray:14 3 3 3;' : '';
    return `.l-${l.name}{stroke:${p[l.name]};stroke-width:${l.weight}px;${dash}fill:none;vector-effect:non-scaling-stroke}.t-${l.name}{fill:${p[l.name]};stroke:none}.f-${l.name}{fill:${p[l.name]};stroke:${p[l.name]};stroke-width:0.6px;vector-effect:non-scaling-stroke}`;
  }).join('');
  return `${css}text{font-family:Arial,Helvetica,sans-serif}`;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const n = (x: number) => (Math.abs(x) < 1e-9 ? '0' : String(Math.round(x * 1000) / 1000));

export function entsToSvgBody(ents: Ent[], h: number): string {
  const Y = (y: number) => n(h - y);
  const out: string[] = [];
  for (const e of expandEnts(ents)) {
    switch (e.t) {
      case 'line':
        out.push(`<line class="l-${e.layer}" x1="${n(e.x1)}" y1="${Y(e.y1)}" x2="${n(e.x2)}" y2="${Y(e.y2)}"/>`);
        break;
      case 'poly': {
        const pts = e.pts.map(([x, y]) => `${n(x)},${Y(y)}`).join(' ');
        out.push(`<${e.closed ? 'polygon' : 'polyline'} class="l-${e.layer}" points="${pts}"/>`);
        break;
      }
      case 'circle':
        out.push(`<circle class="${e.fill ? 'f' : 'l'}-${e.layer}" cx="${n(e.cx)}" cy="${Y(e.cy)}" r="${n(e.r)}"/>`);
        break;
      case 'text': {
        const anchor = e.align === 'c' ? 'middle' : e.align === 'r' ? 'end' : 'start';
        const rot = e.rot ? ` transform="rotate(${-e.rot} ${n(e.x)} ${Y(e.y)})"` : '';
        out.push(`<text class="t-${e.layer}" x="${n(e.x)}" y="${Y(e.y)}" font-size="${n(e.h)}" text-anchor="${anchor}"${e.bold ? ' font-weight="700"' : ''}${rot}>${esc(e.s)}</text>`);
        break;
      }
    }
  }
  return out.join('');
}

/** SVG độc lập (có style nhúng) của một tờ bản vẽ; đơn vị viewBox = mm mô hình. */
export function sheetToSvg(sheet: Sheet, theme: CadTheme = 'light', opts: { responsive?: boolean } = {}): string {
  const p = PALETTE[theme];
  const size = opts.responsive ? 'width="100%" height="100%"' : `width="${sheet.w / sheet.scale}mm" height="${sheet.h / sheet.scale}mm"`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(sheet.w)} ${n(sheet.h)}" ${size} preserveAspectRatio="xMidYMid meet" class="cad">` +
    `<style>${svgStyle(theme)}</style><rect x="0" y="0" width="${n(sheet.w)}" height="${n(sheet.h)}" fill="${p.paper}"/>` +
    entsToSvgBody(sheet.ents, sheet.h) +
    `</svg>`
  );
}
