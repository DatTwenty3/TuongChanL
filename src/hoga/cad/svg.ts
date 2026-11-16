import { expandEnts, LAYERS, type Ent } from './ents';
import type { Sheet } from './sheets';

export type CadTheme = 'light' | 'dark';

/** Bảng màu theo ACI của bản vẽ mẫu VHGpro (nền đen của AutoCAD → `dark`; nền giấy trắng → các tông đậm hơn để đọc được). */
const PALETTE: Record<CadTheme, Record<string, string>> = {
  dark: { KC: '#00e5f0', LOT: '#4d7cff', CONG: '#1e8fff', THEP: '#ff3b30', THEP2: '#ffe600', THEP3: '#ff4dff', THEP4: '#a0a0a0', KT: '#00bfff', TEXT: '#f0f4f8', TIEUDE: '#2cff4f', HATCH: '#8c8c8c', TIM: '#ff4dff', NET: '#00bfff', KHUNG: '#00bfff', paper: '#0b1425' },
  light: { KC: '#00909e', LOT: '#2a4fd6', CONG: '#0a63c7', THEP: '#d62a1d', THEP2: '#c9a800', THEP3: '#c21fc2', THEP4: '#707070', KT: '#0090c2', TEXT: '#1c242d', TIEUDE: '#0a9a2a', HATCH: '#6c6c6c', TIM: '#c21fc2', NET: '#0090c2', KHUNG: '#0090c2', paper: '#ffffff' },
};

export function svgStyle(theme: CadTheme): string {
  const p = PALETTE[theme];
  const css = LAYERS.map((l) => {
    const dash = l.linetype === 'DASHED' ? 'stroke-dasharray:6 4;' : l.linetype === 'CENTER' ? 'stroke-dasharray:14 3 3 3;' : '';
    return `.l-${l.name}{stroke:${p[l.name]};stroke-width:${l.weight}px;${dash}fill:none;vector-effect:non-scaling-stroke}.t-${l.name}{fill:${p[l.name]};stroke:none}.f-${l.name}{fill:${p[l.name]};stroke:${p[l.name]};stroke-width:0.6px;vector-effect:non-scaling-stroke}`;
  }).join('');
  return `${css}.l-HATCH{stroke-linecap:round}text{font-family:Arial,Helvetica,sans-serif}`;
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
