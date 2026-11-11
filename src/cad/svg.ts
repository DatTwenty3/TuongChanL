import type { CadLayerId, CadSheet, CadViewBox, ToSvgOptions } from '../types/project';
import { BG_DARK, LAYERS } from './layers';

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function toSVG(sh: CadSheet, o: ToSvgOptions = {}): string {
  const { E, W, H, S } = sh;
  const f = (v: number): number => +v.toFixed(3);
  const mm = (v: number): number => (v * S) / 10;
  const dark = o.theme !== 'light';
  const col = (ly: CadLayerId): string => LAYERS[ly][dark ? 'c' : 'cl'];
  const BG = dark ? BG_DARK : '#ffffff';
  const TXT = dark ? '#00ff00' : '#008000';
  const lwOf = (ly: CadLayerId): number => mm(LAYERS[ly].lw);
  const dash = (ly: CadLayerId): string =>
    LAYERS[ly].lt === 'D'
      ? `${f(mm(3))} ${f(mm(1.5))}`
      : LAYERS[ly].lt === 'X'
        ? `${f(mm(8))} ${f(mm(1.5))} ${f(mm(1.5))} ${f(mm(1.5))}`
        : '';
  const st = (ly: CadLayerId, w?: number): string =>
    `stroke="${col(ly)}" stroke-width="${f(w !== undefined ? w : lwOf(ly))}" fill="none"${dash(ly) ? ` stroke-dasharray="${dash(ly)}"` : ''} stroke-linejoin="round" stroke-linecap="round"`;

  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(W)} ${f(H)}" width="${o.w || '100%'}" height="${o.h || '100%'}" font-family="Arial, Helvetica, sans-serif">`,
    `<rect x="0" y="0" width="${f(W)}" height="${f(H)}" fill="${BG}"/>`,
  ];

  for (const e of E.a) {
    if (e.k === 'L') {
      out.push(
        `<line x1="${f(e.x1)}" y1="${f(H - e.y1)}" x2="${f(e.x2)}" y2="${f(H - e.y2)}" ${st(e.ly)}/>`,
      );
    } else if (e.k === 'P') {
      const pts = e.pts.map((q) => `${f(q[0])},${f(H - q[1])}`).join(' ');
      out.push(
        `<${e.closed ? 'polygon' : 'polyline'} points="${pts}" ${st(e.ly, e.w ? Math.max(e.w, lwOf(e.ly)) : undefined)}/>`,
      );
    } else if (e.k === 'C') {
      out.push(
        `<circle cx="${f(e.x)}" cy="${f(H - e.y)}" r="${f(e.r)}" ${e.fill ? `fill="${col(e.ly)}" stroke="none"` : st(e.ly)}/>`,
      );
    } else if (e.k === 'A') {
      const nx = -e.uy;
      const ny = e.ux;
      const w = e.wid / 2;
      const bx = e.x + e.ux * e.len;
      const by = e.y + e.uy * e.len;
      out.push(
        `<polygon points="${f(e.x)},${f(H - e.y)} ${f(bx + nx * w)},${f(H - by - ny * w)} ${f(bx - nx * w)},${f(H - by + ny * w)}" fill="${col(e.ly)}" stroke="none"/>`,
      );
    } else if (e.k === 'T') {
      if (!e.s) continue;
      const anc = e.al === 'l' ? 'start' : e.al === 'c' ? 'middle' : 'end';
      const db = e.va === 'b' ? 'auto' : e.va === 't' ? 'hanging' : 'central';
      const tx = f(e.x);
      const ty = f(H - e.y);
      const trs: string[] = [];
      if (e.rot) trs.push(`rotate(${f(-e.rot)} ${tx} ${ty})`);
      if (e.wf && e.wf !== 1) {
        trs.push(`translate(${tx} ${ty}) scale(${e.wf} 1) translate(${-tx} ${-ty})`);
      }
      const rot = trs.length ? ` transform="${trs.join(' ')}"` : '';
      out.push(
        `<text xml:space="preserve" x="${f(e.x)}" y="${f(H - e.y)}" font-size="${f(e.h * 1.4)}" fill="${e.col === 3 ? TXT : col(e.ly)}" text-anchor="${anc}" dominant-baseline="${db}"${e.bold ? ' font-weight="700"' : ''}${e.halo ? ` stroke="${BG}" stroke-width="${f(e.h * 0.35)}" paint-order="stroke" stroke-linejoin="round"` : ''}${rot}>${esc(e.s)}</text>`,
      );
    }
  }
  out.push('</svg>');
  return out.join('\n');
}

export interface ViewportRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function fitViewBox(sh: Pick<CadSheet, 'W' | 'H'>): CadViewBox {
  return { x: 0, y: 0, w: sh.W, h: sh.H };
}

export function zoomViewBox(
  vb: CadViewBox,
  rect: ViewportRect,
  clientX: number,
  clientY: number,
  deltaY: number,
): CadViewBox {
  if (rect.width <= 0 || rect.height <= 0 || vb.w <= 0 || vb.h <= 0) return vb;
  const k = deltaY < 0 ? 0.85 : 1 / 0.85;
  const ar = rect.width / rect.height;
  const sar = vb.w / vb.h;
  let scale: number;
  let ox: number;
  let oy: number;
  if (ar > sar) {
    scale = vb.h / rect.height;
    ox = (rect.width - vb.w / scale) / 2;
    oy = 0;
  } else {
    scale = vb.w / rect.width;
    ox = 0;
    oy = (rect.height - vb.h / scale) / 2;
  }
  const mx = vb.x + (clientX - rect.left - ox) * scale;
  const my = vb.y + (clientY - rect.top - oy) * scale;
  return {
    x: mx - (mx - vb.x) * k,
    y: my - (my - vb.y) * k,
    w: vb.w * k,
    h: vb.h * k,
  };
}

export function panViewBox(
  startVb: CadViewBox,
  rect: Pick<ViewportRect, 'width' | 'height'>,
  dx: number,
  dy: number,
): CadViewBox {
  if (rect.width <= 0 || rect.height <= 0) return startVb;
  const k = Math.max(startVb.w / rect.width, startVb.h / rect.height);
  return {
    ...startVb,
    x: startVb.x - dx * k,
    y: startVb.y - dy * k,
  };
}

export interface CadViewportController {
  getViewBox: () => CadViewBox | null;
  setViewBox: (vb: CadViewBox) => void;
  fit: () => CadViewBox | null;
  dispose: () => void;
}

/**
 * Attaches CAD wheel-zoom, pointer drag pan, and double-click fit-to-frame
 * onto a stage element containing an rendered `<svg>` sheet child.
 */
export function attachCadViewport(
  stageEl: HTMLElement,
  getSheet: () => Pick<CadSheet, 'W' | 'H'> | null,
  onViewBoxChange?: (vb: CadViewBox) => void,
): CadViewportController {
  let vb: CadViewBox | null = null;
  let drag: { x: number; y: number; vb: CadViewBox } | null = null;

  const apply = (next: CadViewBox) => {
    vb = next;
    const svg = stageEl.firstElementChild;
    if (svg) svg.setAttribute('viewBox', `${next.x} ${next.y} ${next.w} ${next.h}`);
    onViewBoxChange?.(next);
  };

  const fit = (): CadViewBox | null => {
    const sh = getSheet();
    if (!sh) return null;
    const next = fitViewBox(sh);
    apply(next);
    return next;
  };

  const ensureVb = (): CadViewBox | null => {
    if (vb) return vb;
    const sh = getSheet();
    if (!sh) return null;
    vb = fitViewBox(sh);
    return vb;
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const cur = ensureVb();
    if (!cur) return;
    apply(zoomViewBox(cur, stageEl.getBoundingClientRect(), e.clientX, e.clientY, e.deltaY));
  };

  const onPointerDown = (e: PointerEvent) => {
    const cur = ensureVb();
    if (!cur) return;
    drag = { x: e.clientX, y: e.clientY, vb: { ...cur } };
    stageEl.setPointerCapture?.(e.pointerId);
    stageEl.classList.add('grab');
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!drag) return;
    apply(
      panViewBox(
        drag.vb,
        stageEl.getBoundingClientRect(),
        e.clientX - drag.x,
        e.clientY - drag.y,
      ),
    );
  };

  const onPointerUp = () => {
    drag = null;
    stageEl.classList.remove('grab');
  };

  const onDblClick = () => {
    fit();
  };

  stageEl.addEventListener('wheel', onWheel, { passive: false });
  stageEl.addEventListener('pointerdown', onPointerDown);
  stageEl.addEventListener('pointermove', onPointerMove);
  stageEl.addEventListener('pointerup', onPointerUp);
  stageEl.addEventListener('pointercancel', onPointerUp);
  stageEl.addEventListener('dblclick', onDblClick);

  fit();

  return {
    getViewBox: () => vb,
    setViewBox: (next: CadViewBox) => apply(next),
    fit,
    dispose: () => {
      stageEl.removeEventListener('wheel', onWheel);
      stageEl.removeEventListener('pointerdown', onPointerDown);
      stageEl.removeEventListener('pointermove', onPointerMove);
      stageEl.removeEventListener('pointerup', onPointerUp);
      stageEl.removeEventListener('pointercancel', onPointerUp);
      stageEl.removeEventListener('dblclick', onDblClick);
    },
  };
}
