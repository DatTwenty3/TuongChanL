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
  return zoomViewBoxBy(vb, rect, clientX, clientY, deltaY < 0 ? 0.85 : 1 / 0.85);
}

/** Zoom quanh điểm (clientX, clientY) với hệ số k trên kích thước viewBox (k < 1: phóng to). */
export function zoomViewBoxBy(
  vb: CadViewBox,
  rect: ViewportRect,
  clientX: number,
  clientY: number,
  k: number,
): CadViewBox {
  if (rect.width <= 0 || rect.height <= 0 || vb.w <= 0 || vb.h <= 0) return vb;
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
  /** Phóng to / thu nhỏ quanh tâm khung (k < 1: phóng to). */
  zoomBy: (k: number) => void;
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

  // Con trỏ đang chạm (hỗ trợ kéo 1 ngón = di chuyển, 2 ngón = phóng to/thu nhỏ + di chuyển).
  const ptrs = new Map<number, { x: number; y: number }>();
  let pinch: { d: number; cx: number; cy: number } | null = null;
  let lastTap: { t: number; x: number; y: number } | null = null;

  const startDrag = (x: number, y: number) => {
    const cur = ensureVb();
    if (cur) drag = { x, y, vb: { ...cur } };
  };

  const onPointerDown = (e: PointerEvent) => {
    const cur = ensureVb();
    if (!cur) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try {
      stageEl.setPointerCapture?.(e.pointerId);
    } catch {
      /* con trỏ không còn hoạt động – bỏ qua */
    }
    stageEl.classList.add('grab');
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
      drag = null;
    } else if (ptrs.size === 1) {
      drag = { x: e.clientX, y: e.clientY, vb: { ...cur } };
    }
  };

  const onPointerMove = (e: PointerEvent) => {
    const pt = ptrs.get(e.pointerId);
    if (pt) {
      pt.x = e.clientX;
      pt.y = e.clientY;
    }
    if (ptrs.size >= 2 && pinch) {
      const cur = ensureVb();
      if (!cur) return;
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      const rect = stageEl.getBoundingClientRect();
      let next = cur;
      if (d > 4 && pinch.d > 4) next = zoomViewBoxBy(next, rect, cx, cy, pinch.d / d);
      next = panViewBox(next, rect, cx - pinch.cx, cy - pinch.cy);
      pinch = { d, cx, cy };
      apply(next);
      return;
    }
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

  const onPointerUp = (e: PointerEvent) => {
    const wasTwo = ptrs.size >= 2;
    ptrs.delete(e.pointerId);
    pinch = null;
    if (ptrs.size === 1) {
      // còn 1 ngón: tiếp tục kéo từ vị trí hiện tại, không bị giật
      const [rest] = [...ptrs.values()];
      startDrag(rest.x, rest.y);
      return;
    }
    drag = null;
    stageEl.classList.remove('grab');
    // chạm đúp (cảm ứng / bút) = vừa khung
    if (!wasTwo && e.type === 'pointerup' && e.pointerType !== 'mouse') {
      const now = Date.now();
      if (
        lastTap &&
        now - lastTap.t < 320 &&
        Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 28
      ) {
        lastTap = null;
        fit();
      } else {
        lastTap = { t: now, x: e.clientX, y: e.clientY };
      }
    }
  };

  const onDblClick = () => {
    fit();
  };

  const zoomBy = (k: number) => {
    const cur = ensureVb();
    if (!cur) return;
    const r = stageEl.getBoundingClientRect();
    apply(zoomViewBoxBy(cur, r, r.left + r.width / 2, r.top + r.height / 2, k));
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
    zoomBy,
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
