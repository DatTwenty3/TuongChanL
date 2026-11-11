import { fmt } from '../cad/layers';
import { layoutSoilLabels, type SoilLabelInput } from '../model3d/labels3d';
import type { V3 } from '../model3d/viewer3d';
import type { Model3DGroundPart } from '../types/project';

/**
 * Lớp nhãn chú thích các lớp đất chĩa ra từ mô hình 3D: ô thông tin + đường chĩa gấp khúc, phủ lên canvas.
 * Cập nhật trực tiếp DOM sau mỗi lần vẽ (không qua React) để theo kịp khi xoay / thu phóng.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

interface LabelEl {
  gp: Model3DGroundPart;
  box: HTMLDivElement;
  g: SVGGElement;
  line: SVGPolylineElement;
  dot: SVGCircleElement;
  w: number;
  h: number;
}

interface HostState {
  sig: string;
  narrow: boolean;
  svg: SVGSVGElement;
  els: LabelEl[];
}

const states = new WeakMap<HTMLElement, HostState>();
const xRange = new WeakMap<Model3DGroundPart, [number, number]>();

function ranges(gp: Model3DGroundPart): [number, number] {
  let r = xRange.get(gp);
  if (!r) {
    let lo = Infinity;
    let hi = -Infinity;
    const p = gp.mesh.p;
    for (let i = 0; i < p.length; i += 3) {
      if (p[i] < lo) lo = p[i];
      if (p[i] > hi) hi = p[i];
    }
    r = [lo, hi];
    xRange.set(gp, r);
  }
  return r;
}

function rgb(c: readonly number[], k = 1): string {
  return `rgb(${c.map((v) => Math.round(Math.min(1, v * k) * 255)).join(',')})`;
}

function depthText(gp: Model3DGroundPart): string {
  return gp.kind === 'cover'
    ? `cao +${fmt(gp.y1 / 100, 1)} m so với đáy bản đáy`
    : `${fmt(-gp.y1 / 100, 1)} → ${fmt(-gp.y0 / 100, 1)} m dưới đáy bản đáy`;
}

function build(host: HTMLElement, parts: Model3DGroundPart[], narrow: boolean, sig: string): HostState {
  host.textContent = '';
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'sl-lines');
  host.appendChild(svg);
  const els: LabelEl[] = parts.map((gp) => {
    const g = document.createElementNS(SVG_NS, 'g');
    const line = document.createElementNS(SVG_NS, 'polyline');
    line.setAttribute('fill', 'none');
    line.setAttribute('stroke', rgb(gp.color, 1.25));
    line.setAttribute('stroke-width', '1.4');
    const dot = document.createElementNS(SVG_NS, 'circle');
    dot.setAttribute('r', '3.2');
    dot.setAttribute('fill', rgb(gp.color, 1.15));
    dot.setAttribute('stroke', '#0f1722');
    dot.setAttribute('stroke-width', '1');
    g.append(line, dot);
    svg.appendChild(g);

    const box = document.createElement('div');
    box.className = 'sl-box';
    box.style.borderLeftColor = rgb(gp.color, 1.15);
    const t = document.createElement('b');
    t.textContent = gp.name;
    const k = document.createElement('span');
    k.textContent = gp.kindText;
    const d = document.createElement('em');
    d.textContent = depthText(gp);
    box.append(t, k, d);
    if (!narrow && gp.props.length) {
      const pr = document.createElement('small');
      pr.textContent = gp.props.join(' · ');
      box.appendChild(pr);
    }
    host.appendChild(box);
    return { gp, box, g, line, dot, w: 0, h: 0 };
  });
  // đo kích thước thật của ô nhãn một lần
  els.forEach((e) => {
    e.w = e.box.offsetWidth;
    e.h = e.box.offsetHeight;
  });
  const st: HostState = { sig, narrow, svg, els };
  states.set(host, st);
  return st;
}

/** Vẽ lại vị trí các nhãn cho khung hình hiện tại; xóa nhãn nếu tắt / không có địa tầng. */
export function renderSoilLabels(v3: V3, host: HTMLElement | null, reserveRight: number): void {
  if (!host) return;
  const m = v3.model;
  const on = !!m && !!m.ground && m.ground.length > 0 && v3.vis.strata && v3.vis.labels;
  if (!on || !m || !m.ground) {
    if (host.firstChild) host.textContent = '';
    states.delete(host);
    return;
  }
  const parts = m.ground.filter((gp) => !v3.hiddenGround.has(gp.id));
  if (!parts.length) {
    if (host.firstChild) host.textContent = '';
    states.delete(host);
    return;
  }
  const narrow = typeof window !== 'undefined' && !!window.matchMedia?.('(max-width: 900px)').matches;
  const sig = parts.map((gp) => `${gp.id}|${gp.name}|${gp.kindText}|${gp.props.join(',')}|${gp.y0}|${gp.y1}`).join(';');
  let st = states.get(host);
  if (!st || st.sig !== sig || st.narrow !== narrow) st = build(host, parts, narrow, sig);

  const zmax = m.bbox.z1;
  const inputs: SoilLabelInput[] = [];
  const hide = new Set<string>();
  st.els.forEach((e) => {
    const [x0, x1] = ranges(e.gp);
    const ym = (e.gp.y0 + e.gp.y1) / 2;
    const pts = [
      v3.toScreen(x0, ym, 0),
      v3.toScreen(x0, ym, zmax),
      v3.toScreen(x1, ym, 0),
      v3.toScreen(x1, ym, zmax),
    ].filter((p): p is { x: number; y: number } => !!p);
    if (!pts.length) {
      hide.add(e.gp.id);
      return;
    }
    const side = e.gp.kind === 'cover' ? 'L' : 'R';
    const a = pts.reduce((best, p) => (side === 'R' ? (p.x > best.x ? p : best) : p.x < best.x ? p : best));
    inputs.push({ id: e.gp.id, ax: a.x, ay: a.y, side, w: e.w, h: e.h });
  });

  const pos = layoutSoilLabels(inputs, v3.W, v3.H, { reserveRight, offset: 44 });
  const byId = new Map(pos.map((p) => [p.id, p]));
  st.svg.setAttribute('width', String(v3.W));
  st.svg.setAttribute('height', String(v3.H));
  st.els.forEach((e) => {
    const p = byId.get(e.gp.id);
    if (!p) {
      e.box.style.display = 'none';
      e.g.setAttribute('display', 'none');
      return;
    }
    e.box.style.display = '';
    e.g.removeAttribute('display');
    e.box.style.left = `${Math.round(p.x)}px`;
    e.box.style.top = `${Math.round(p.y)}px`;
    e.line.setAttribute(
      'points',
      p.bx === p.ax
        ? `${p.ax.toFixed(1)},${p.ay.toFixed(1)} ${p.ex.toFixed(1)},${p.ey.toFixed(1)}`
        : `${p.ax.toFixed(1)},${p.ay.toFixed(1)} ${p.bx.toFixed(1)},${p.by.toFixed(1)} ${p.ex.toFixed(1)},${p.ey.toFixed(1)}`,
    );
    e.dot.setAttribute('cx', p.ax.toFixed(1));
    e.dot.setAttribute('cy', p.ay.toFixed(1));
  });
}
