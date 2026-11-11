import type { EngineBarsResult, EngineProject } from '../engine';
import { fmt, fmt2 } from '../cad/layers';
import type {
  BarsResult,
  M3BarGroup,
  M3TubeChunk,
  M3TubeRange,
  Model3DData,
  Point3D,
  Project,
  QuantitiesResult,
  TemplateId,
  V3CameraState,
  V3ClipState,
  V3ColorMode,
  V3HoverHit,
  V3State,
  V3ViewPresetId,
  V3Visibility,
} from '../types/project';
import { model3D } from './bars3d';
import { M3Mesh, M3Tubes, m3cross, m3dot, m3norm, m3sub } from './mesh';

export const V3_PAL: [number, number, number][] = [
  [255, 99, 99],
  [255, 179, 64],
  [255, 230, 90],
  [130, 222, 100],
  [60, 214, 200],
  [90, 172, 255],
  [150, 135, 255],
  [255, 130, 220],
  [255, 140, 70],
  [190, 232, 100],
  [100, 230, 170],
  [100, 205, 255],
  [205, 165, 255],
  [255, 160, 170],
  [230, 198, 112],
  [160, 214, 214],
  [215, 170, 230],
].map((c): [number, number, number] => [c[0] / 255, c[1] / 255, c[2] / 255]);

export const V3_VIEWS: Record<V3ViewPresetId, [string, number, number, 0 | 1]> = {
  back: ['Phối cảnh sau', 1.05, 0.45, 0],
  front: ['Phối cảnh trước', -0.95, 0.38, 0],
  sect: ['Mặt cắt ngang', 0, 0, 1],
  elev: ['Mặt đứng (trước)', -Math.PI / 2, 0, 1],
  rear: ['Mặt đứng (sau)', Math.PI / 2, 0, 1],
  top: ['Mặt bằng', 0, Math.PI / 2 - 0.001, 1],
};

export const v3m = {
  persp(f: number, a: number, n: number, fa: number): number[] {
    const t = 1 / Math.tan(f / 2);
    const nf = 1 / (n - fa);
    return [t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) * nf, -1, 0, 0, 2 * fa * n * nf, 0];
  },
  ortho(hw: number, hh: number, n: number, fa: number): number[] {
    return [1 / hw, 0, 0, 0, 0, 1 / hh, 0, 0, 0, 0, 2 / (n - fa), 0, 0, 0, (fa + n) / (n - fa), 1];
  },
  look(e: Point3D, c: Point3D, up: Point3D): number[] {
    const z = m3norm(m3sub(e, c));
    const x = m3norm(m3cross(up, z));
    const y = m3cross(z, x);
    return [
      x[0],
      y[0],
      z[0],
      0,
      x[1],
      y[1],
      z[1],
      0,
      x[2],
      y[2],
      z[2],
      0,
      -m3dot(x, e),
      -m3dot(y, e),
      -m3dot(z, e),
      1,
    ];
  },
  mul(a: readonly number[], b: readonly number[]): number[] {
    const o = new Array<number>(16);
    for (let j = 0; j < 4; j++) {
      for (let i = 0; i < 4; i++) {
        o[i + j * 4] =
          a[i] * b[j * 4] +
          a[i + 4] * b[j * 4 + 1] +
          a[i + 8] * b[j * 4 + 2] +
          a[i + 12] * b[j * 4 + 3];
      }
    }
    return o;
  },
};

export const V3_VS_TUBE =
  'attribute vec3 aC; attribute vec3 aO; attribute vec3 aN; attribute float aR;\nuniform mat4 uVP; uniform float uScale; uniform float uMinPx; uniform float uPxK; uniform float uPersp;\nvarying vec3 vN; varying vec3 vW;\nvoid main(){ vec4 cc = uVP * vec4(aC, 1.0); float px = uPersp > 0.5 ? abs(cc.w) * uPxK : uPxK; float k = max(uScale, uMinPx * px / aR);\n  vec3 w = aC + aO * k; vW = w; vN = aN; gl_Position = uVP * vec4(w, 1.0); }';

export const V3_FS_HEAD =
  '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\nuniform vec3 uCol; uniform float uA; uniform vec3 uL; uniform vec4 uClip; varying vec3 vW;';

export const V3_FS_TUBE =
  V3_FS_HEAD +
  'varying vec3 vN;\nvoid main(){ if (dot(uClip.xyz, vW) > uClip.w) discard; float d = max(dot(normalize(vN), uL), 0.0); float s = 0.42 + 0.68 * d;\n  gl_FragColor = vec4(uCol * s + vec3(0.16) * pow(d, 12.0), uA); }';

export const V3_VS_MESH =
  'attribute vec3 aP; attribute vec3 aN; uniform mat4 uVP; varying vec3 vN; varying vec3 vW;\nvoid main(){ vW = aP; vN = aN; gl_Position = uVP * vec4(aP, 1.0); }';

export const V3_FS_MESH =
  V3_FS_HEAD +
  'varying vec3 vN;\nvoid main(){ if (dot(uClip.xyz, vW) > uClip.w) discard; float d = abs(dot(normalize(vN), uL)); gl_FragColor = vec4(uCol * (0.6 + 0.4 * d), uA); }';

/** Hàm nhiễu dùng chung cho shader bề mặt vật liệu (bê tông, đất). Mờ dần các tầng nhiễu nhỏ hơn điểm ảnh để không lấp lánh. */
const V3_GLSL_NOISE = `varying vec3 vN;
#ifdef GL_OES_standard_derivatives
float pxw(){ return length(fwidth(vW)); }
#else
float pxw(){ return 0.8; }
#endif
float hh(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
float vn(vec3 p){ vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float a = hh(i), b = hh(i + vec3(1.0, 0.0, 0.0)), c = hh(i + vec3(0.0, 1.0, 0.0)), d = hh(i + vec3(1.0, 1.0, 0.0));
  float e = hh(i + vec3(0.0, 0.0, 1.0)), g = hh(i + vec3(1.0, 0.0, 1.0)), k = hh(i + vec3(0.0, 1.0, 1.0)), l = hh(i + vec3(1.0, 1.0, 1.0));
  return mix(mix(mix(a, b, f.x), mix(c, d, f.x), f.y), mix(mix(e, g, f.x), mix(k, l, f.x), f.y), f.z); }
float nz(vec3 p, float s, float fw){ return mix(0.5, vn(p / s), 1.0 - smoothstep(0.35 * s, 1.1 * s, fw)); }
float ridge(vec3 p, float s, float fw){ return mix(0.7, abs(vn(p / s) * 2.0 - 1.0), 1.0 - smoothstep(0.35 * s, 1.1 * s, fw)); }
`;

/**
 * Bê tông (mở rộng): xám xi măng, đốm cốt liệu, lỗ rỗng, mối nối ván khuôn và lỗ ty xuyên.
 * uMode: 0 = bê tông tường / bản (có ván khuôn), 1 = bê tông lót (nhám), 2 = cọc (nhẵn, không ván khuôn).
 * Tách khỏi `V3_FS_MESH` (giữ nguyên để đối chiếu bản gốc).
 */
export const V3_FS_CONC =
  '#extension GL_OES_standard_derivatives : enable\n' +
  V3_FS_HEAD +
  V3_GLSL_NOISE +
  `uniform float uMode;
void main(){ if (dot(uClip.xyz, vW) > uClip.w) discard;
  vec3 n = normalize(vN); vec3 an = abs(n); float fw = pxw();
  float d = abs(dot(n, uL));
  float mott = nz(vW, 46.0, fw) * 0.45 + nz(vW, 13.0, fw) * 0.35 + nz(vW, 3.6, fw) * 0.2;
  float fine = nz(vW, 0.8, fw);
  float pore = smoothstep(0.80, 0.92, nz(vW + 11.3, 1.5, fw)) * (uMode > 1.5 ? 0.35 : 1.0);
  float rough = uMode > 0.5 && uMode < 1.5 ? 1.6 : 1.0;
  vec3 col = uCol * (0.80 + 0.36 * mott + 0.12 * rough * (fine - 0.5)) * (1.0 - 0.40 * pore);
  if (uMode < 0.5 && an.y < 0.6) {
    float h = an.x > an.z ? vW.z : vW.x;
    float sy = abs(fract(vW.y / 120.0 + 0.5) - 0.5) * 120.0;
    float sh = abs(fract(h / 240.0 + 0.5) - 0.5) * 240.0;
    float lw = 0.3 + fw * 0.7;
    float seam = 1.0 - smoothstep(lw, lw * 2.4, min(sy, sh));
    vec2 g = vec2(fract(h / 60.0) - 0.5, fract(vW.y / 60.0) - 0.5) * 60.0;
    float hole = 1.0 - smoothstep(1.2, 2.2 + fw, length(g));
    float fadeF = 1.0 - smoothstep(4.0, 14.0, fw);
    col *= 1.0 - fadeF * (0.32 * seam + 0.45 * hole);
  }
  float sp = pow(d, 18.0) * 0.05;
  gl_FragColor = vec4(col * (0.52 + 0.58 * d) + vec3(sp), uA); }`;

/**
 * Đất (mở rộng): vật liệu theo loại — uKind: 0 cát, 1 sét, 2 bùn, 3 đá, 4 đất đắp.
 * Mặt trên (uTopK > 0) phủ cỏ. Tách khỏi `V3_FS_MESH`; dùng chung `V3_VS_MESH`.
 */
export const V3_FS_SOIL =
  '#extension GL_OES_standard_derivatives : enable\n' +
  V3_FS_HEAD +
  V3_GLSL_NOISE +
  `uniform vec3 uTop; uniform float uTopK; uniform float uKind;
void main(){ if (dot(uClip.xyz, vW) > uClip.w) discard;
  vec3 n = normalize(vN); float fw = pxw(); float d = abs(dot(n, uL));
  float m = nz(vW, 60.0, fw) * 0.45 + nz(vW, 20.0, fw) * 0.35 + nz(vW, 6.0, fw) * 0.2;
  float g1 = nz(vW, 1.1, fw); float g2 = nz(vW, 0.45, fw);
  float bed = sin(vW.y * 0.20 + nz(vW, 90.0, fw) * 7.0) * 0.5 + 0.5;
  vec3 col = uCol; float tone = 0.80 + 0.40 * m;
  if (uKind < 0.5) {
    tone *= 0.88 + 0.24 * g1 + 0.12 * (g2 - 0.5);
    float lam = smoothstep(0.7, 0.95, sin(vW.y * 1.3 + nz(vW, 30.0, fw) * 9.0) * 0.5 + 0.5);
    tone *= 1.0 - 0.10 * lam - 0.30 * smoothstep(0.78, 0.9, g2);
  } else if (uKind < 1.5) {
    float cr = 1.0 - smoothstep(0.02, 0.06 + fw * 0.02, ridge(vW, 9.0, fw));
    tone *= (0.92 + 0.14 * g1) * (0.94 + 0.12 * bed) * (1.0 - 0.38 * cr);
  } else if (uKind < 2.5) {
    tone *= (0.85 + 0.30 * nz(vW, 14.0, fw)) * (0.95 + 0.10 * bed);
    col = mix(col, vec3(0.75, 0.72, 0.62), 0.55 * smoothstep(0.88, 0.97, nz(vW + 5.0, 0.9, fw)));
  } else if (uKind < 3.5) {
    float cr = 1.0 - smoothstep(0.03, 0.09 + fw * 0.02, ridge(vW, 22.0, fw));
    tone *= (0.80 + 0.30 * g1 + 0.10 * nz(vW, 3.0, fw)) * (1.0 - 0.45 * cr);
  } else {
    tone *= 0.80 + 0.30 * nz(vW, 8.0, fw) + 0.25 * (g1 - 0.5);
    vec3 q = vW / 3.0; vec3 id = floor(q); vec3 f = fract(q) - 0.5;
    float rr = 0.16 + 0.16 * hh(id + 1.7);
    float blob = step(0.82, hh(id)) * (1.0 - smoothstep(rr * 0.75, rr, length(f))) * (1.0 - smoothstep(2.0, 6.0, fw));
    col = mix(col, vec3(0.62, 0.58, 0.52) * (0.8 + 0.4 * hh(id + 9.0)), blob);
  }
  col *= tone;
  float top = smoothstep(0.6, 0.92, n.y) * uTopK;
  if (top > 0.0) {
    float blade = nz(vec3(vW.x * 2.5, vW.y, vW.z * 2.5), 1.0, fw) * 0.5 + nz(vW, 0.5, fw) * 0.5;
    vec3 gc = mix(uTop * 0.7, uTop * 1.25, nz(vW, 30.0, fw)) * (0.75 + 0.5 * blade);
    gc = mix(gc, vec3(0.55, 0.50, 0.26), 0.35 * smoothstep(0.55, 0.8, nz(vW + 3.0, 18.0, fw)));
    col = mix(col, gc, top);
  }
  gl_FragColor = vec4(col * (0.5 + 0.5 * d), uA); }`;

export const V3_VS_LINE =
  'attribute vec3 aP; uniform mat4 uVP; varying vec3 vW; void main(){ vW = aP; gl_Position = uVP * vec4(aP, 1.0); }';

export const V3_FS_LINE =
  V3_FS_HEAD +
  'void main(){ if (dot(uClip.xyz, vW) > uClip.w) discard; gl_FragColor = vec4(uCol, uA); }';

export interface V3ShaderProgram {
  pr: WebGLProgram;
  u: Record<string, WebGLUniformLocation | null>;
  na: number;
}

export interface V3GroupRuntimeMeta {
  col: [number, number, number];
  minL: number;
  maxL: number;
  segs: Float32Array;
  segBar: Int32Array;
}

const V3_GROUP_META = new WeakMap<M3BarGroup, V3GroupRuntimeMeta>();

export function v3GetGroupMeta(gr: M3BarGroup): V3GroupRuntimeMeta | undefined {
  return V3_GROUP_META.get(gr);
}

export function v3Prog(
  gl: WebGLRenderingContext,
  vs: string,
  fs: string,
  attrs: string[],
): V3ShaderProgram {
  const mk = (t: number, s: string) => {
    const sh = gl.createShader(t);
    if (!sh) throw new Error('Unable to create WebGL shader');
    gl.shaderSource(sh, s);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(sh) || 'Shader compile error');
    }
    return sh;
  };
  const pr = gl.createProgram();
  if (!pr) throw new Error('Unable to create WebGL program');
  gl.attachShader(pr, mk(gl.VERTEX_SHADER, vs));
  gl.attachShader(pr, mk(gl.FRAGMENT_SHADER, fs));
  attrs.forEach((a, i) => gl.bindAttribLocation(pr, i, a));
  gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(pr) || 'Program link error');
  }
  const u: Record<string, WebGLUniformLocation | null> = {};
  const n = gl.getProgramParameter(pr, gl.ACTIVE_UNIFORMS) as number;
  for (let i = 0; i < n; i++) {
    const inf = gl.getActiveUniform(pr, i);
    if (inf) u[inf.name] = gl.getUniformLocation(pr, inf.name);
  }
  return { pr, u, na: attrs.length };
}

export function v3ClipVec(
  model: Model3DData | null,
  clip: V3ClipState,
): [number, number, number, number] {
  if (!model || !clip.axis) return [0, 0, 0, 1];
  const b = model.bbox;
  const lo = clip.axis === 'x' ? b.x0 : clip.axis === 'y' ? b.y0 : b.z0;
  const hi = clip.axis === 'x' ? b.x1 : clip.axis === 'y' ? b.y1 : b.z1;
  const pos = lo + (hi - lo) * clip.t;
  const a: Point3D =
    clip.axis === 'x' ? [1, 0, 0] : clip.axis === 'y' ? [0, 1, 0] : [0, 0, 1];
  return clip.flip ? [-a[0], -a[1], -a[2], -pos] : [a[0], a[1], a[2], pos];
}

export function v3GroupColor(
  gr: M3BarGroup & { col?: [number, number, number] },
  colorMode: V3ColorMode,
  index = 0,
): [number, number, number] {
  if (colorMode === 'cad') return [1, 0.2, 0.2];
  return V3_GROUP_META.get(gr)?.col ?? gr.col ?? V3_PAL[index % V3_PAL.length];
}

export const v3Drawn = (gr: Pick<M3BarGroup, 'per' | 'bars'>): number =>
  gr.per ? gr.bars.length * gr.per : gr.bars.length;

export const v3Diff = (gr: Pick<M3BarGroup, 'bs' | 'count' | 'per' | 'bars'>): boolean =>
  !!(gr.bs && gr.bs.length && v3Drawn(gr) !== gr.count);

export interface V3TipData {
  title: string;
  subtitle: string;
  summary: string;
  is2dOnly: boolean;
}

export function v3FormatTip(gr: M3BarGroup): V3TipData {
  const meta = V3_GROUP_META.get(gr);
  const bs = gr.bs || [];
  const minL = meta ? meta.minL : bs.length ? Math.min(...bs.map((b) => b.minL || 0)) : 0;
  const maxL = meta ? meta.maxL : bs.length ? Math.max(...bs.map((b) => b.maxL || 0)) : 0;
  const kg = gr.kg ?? bs.reduce((s, b) => s + (b.kg || 0), 0);
  const m2 = (v: number) => fmt(v / 1e3, 2) + ' m';
  const len = bs.length ? (minL === maxL ? m2(minL) : m2(minL) + ' – ' + m2(maxL)) : '';
  const per = gr.per ? ` · mỗi đai kín = ${gr.per} thanh` : '';
  const is2dOnly = !bs.length;
  const summary = is2dOnly
    ? `${gr.bars.length} thanh (vẽ theo hình 2D)`
    : `${gr.count} thanh${v3Diff(gr) ? ` (bảng) · vẽ ${v3Drawn(gr)} thanh theo hình 2D` : ''}${per}${len ? ' · dài ' + len : ''} · ${fmt(kg, 1)} kg`;
  return {
    title: `Mác ${gr.mark} · Ø${gr.d}`,
    subtitle: gr.name,
    summary,
    is2dOnly,
  };
}

export function v3FormatInfo(
  p: Project | EngineProject,
  res: BarsResult | EngineBarsResult,
  q?: Pick<QuantitiesResult, 'vol' | 'totKg'> | null,
): string {
  const g = res.g;
  const fmtm = (v: number) => fmt2(v / 100);
  const parts = [`B = ${fmtm(g.B)} m`, `cao tổng = ${fmtm(g.yTop)} m`, `L = ${fmtm(p.Lu)} m`];
  if (q) {
    parts.push(`BT ${fmt2(q.vol)} m³`, `thép ${fmt(q.totKg, 0)} kg`);
  }
  return parts.join(' · ');
}

export interface V3PickState {
  model: Model3DData | null;
  vp: readonly number[] | null;
  W: number;
  H: number;
  pxK: number;
  dpr: number;
  kd: number;
  vis: Pick<V3Visibility, 'rebar'>;
  hidden: Set<string>;
  focus: string | null;
  cam: Pick<V3CameraState, 'ortho'>;
  clip: V3ClipState;
}

export function v3Pick(state: V3PickState, mx: number, my: number): V3HoverHit | null {
  const m = state.model;
  const vp = state.vp;
  if (!m || !vp || !state.vis.rebar) return null;
  const W = state.W;
  const H = state.H;
  if (W <= 0 || H <= 0 || !state.pxK || !state.dpr) return null;
  const clip = v3ClipVec(m, state.clip);
  const persp = !state.cam.ortho;
  let best: (V3HoverHit & { score: number }) | null = null;

  for (const gr of m.groups) {
    const id = gr.id || '';
    if (state.hidden.has(id) || (state.focus && id !== state.focus)) continue;
    const meta = V3_GROUP_META.get(gr);
    const S: ArrayLike<number> | undefined = meta?.segs ?? gr.segs;
    const segBar: ArrayLike<number> | undefined = meta?.segBar ?? gr.segBar;
    if (!S || !segBar || S.length < 6) continue;
    const R = gr.R ?? gr.d / 20;
    const n = Math.floor(S.length / 6);

    for (let s = 0; s < n; s++) {
      const o = s * 6;
      const ax = S[o];
      const ay = S[o + 1];
      const az = S[o + 2];
      const bx = S[o + 3];
      const by = S[o + 4];
      const bz = S[o + 5];
      if (
        (clip[0] * (ax + bx)) / 2 +
          (clip[1] * (ay + by)) / 2 +
          (clip[2] * (az + bz)) / 2 >
        clip[3]
      ) {
        continue;
      }
      const wa = vp[3] * ax + vp[7] * ay + vp[11] * az + vp[15];
      const wb = vp[3] * bx + vp[7] * by + vp[11] * bz + vp[15];
      if (persp && (wa <= 0.01 || wb <= 0.01)) continue;
      const xa = (((vp[0] * ax + vp[4] * ay + vp[8] * az + vp[12]) / wa) * 0.5 + 0.5) * W;
      const ya = (1 - (((vp[1] * ax + vp[5] * ay + vp[9] * az + vp[13]) / wa) * 0.5 + 0.5)) * H;
      const xb = (((vp[0] * bx + vp[4] * by + vp[8] * bz + vp[12]) / wb) * 0.5 + 0.5) * W;
      const yb = (1 - (((vp[1] * bx + vp[5] * by + vp[9] * bz + vp[13]) / wb) * 0.5 + 0.5)) * H;
      if (
        mx < Math.min(xa, xb) - 8 ||
        mx > Math.max(xa, xb) + 8 ||
        my < Math.min(ya, yb) - 8 ||
        my > Math.max(ya, yb) + 8
      ) {
        continue;
      }
      const dx = xb - xa;
      const dy = yb - ya;
      const L2 = dx * dx + dy * dy;
      const t = L2 > 1e-9 ? Math.max(0, Math.min(1, ((mx - xa) * dx + (my - ya) * dy) / L2)) : 0;
      const d = Math.hypot(xa + dx * t - mx, ya + dy * t - my);
      const dep = wa + (wb - wa) * t;
      const rpx =
        (persp
          ? (R * Math.max(state.kd, 1)) / (dep * state.pxK)
          : (R * Math.max(state.kd, 1)) / state.pxK) / state.dpr;
      const thr = Math.max(4.5, rpx + 1.5);
      if (d > thr) continue;
      const score =
        (d <= rpx + 1 ? 0 : 1e6) +
        (persp
          ? dep
          : (vp[2] * ax + vp[6] * ay + vp[10] * az + vp[14]) * (1 - t) +
            (vp[2] * bx + vp[6] * by + vp[10] * bz + vp[14]) * t) +
        d * 0.001;
      if (!best || score < best.score) {
        const bi = segBar[s];
        best = {
          id,
          gr,
          bi,
          r: gr.ranges && gr.ranges[bi] !== undefined ? gr.ranges[bi] : null,
          z: score,
          score,
        };
      }
    }
  }

  return best ? { id: best.id, gr: best.gr, bi: best.bi, r: best.r, z: best.z } : null;
}

export function v3AxisDraw(ax: HTMLCanvasElement | null, v: readonly number[]): void {
  if (!ax) return;
  const ctx = ax.getContext('2d');
  if (!ctx) return;
  const S = ax.width;
  ctx.clearRect(0, 0, S, S);
  const axes: [number, number, number, string, string][] = [
    [1, 0, 0, '#ff6b6b', 'X'],
    [0, 1, 0, '#7ee07e', 'Y'],
    [0, 0, 1, '#6ba6ff', 'Z'],
  ];
  const proj = (a: [number, number, number, string, string]): Point3D => [
    v[0] * a[0] + v[4] * a[1] + v[8] * a[2],
    v[1] * a[0] + v[5] * a[1] + v[9] * a[2],
    v[2] * a[0] + v[6] * a[1] + v[10] * a[2],
  ];
  const cx = S / 2;
  const cy = S / 2;
  const L = S * 0.34;
  ctx.lineWidth = 2;
  ctx.font = 'bold 12px system-ui,sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  axes
    .map((a) => ({ a, p: proj(a) }))
    .sort((u, w) => u.p[2] - w.p[2])
    .forEach(({ a, p }) => {
      ctx.strokeStyle = a[3];
      ctx.fillStyle = a[3];
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + p[0] * L, cy - p[1] * L);
      ctx.stroke();
      ctx.fillText(a[4], cx + p[0] * (L + 10), cy - p[1] * (L + 10));
    });
}

export const v3Overlay = v3AxisDraw;

export function v3TemplateTitle(tpl: TemplateId): string {
  return tpl === 'A'
    ? 'Mẫu 2 – tường có sườn'
    : tpl === 'C'
      ? 'Mẫu 3 – khối kè có sườn'
      : tpl === 'D'
        ? 'Mẫu 4 – tường chữ T ngược neo đá'
        : 'Mẫu 1 – tường chữ T ngược';
}

export interface V3PngOptions {
  cv: HTMLCanvasElement;
  tpl: TemplateId;
  infoText: string;
  axisCanvas?: HTMLCanvasElement | null;
}

export async function v3Png(opts: V3PngOptions): Promise<Blob | null> {
  const { cv, tpl, infoText, axisCanvas } = opts;
  const c2 = document.createElement('canvas');
  c2.width = cv.width;
  c2.height = cv.height;
  const x = c2.getContext('2d');
  if (!x) return null;
  x.drawImage(cv, 0, 0);
  const s = c2.width / Math.max(1, cv.clientWidth || cv.width);
  x.font = `${Math.round(13 * s)}px system-ui,"Segoe UI",Arial,sans-serif`;
  x.fillStyle = 'rgba(230,238,246,.95)';
  x.textBaseline = 'bottom';
  x.fillText(`${v3TemplateTitle(tpl)} · ${infoText}`, 12 * s, c2.height - 10 * s);
  if (axisCanvas) {
    x.drawImage(
      axisCanvas,
      8 * s,
      c2.height - 28 * s - axisCanvas.height * s * 0.9,
      axisCanvas.width * s * 0.9,
      axisCanvas.height * s * 0.9,
    );
  }
  return await new Promise<Blob | null>((ok) => c2.toBlob(ok, 'image/png'));
}

export interface V3AttachOptions {
  axisCanvas?: HTMLCanvasElement | null;
  getLegOffsetPx?: () => number;
  isHidden?: () => boolean;
  onChange?: () => void;
  /** Gọi sau mỗi lần vẽ xong (dùng cập nhật lớp nhãn phủ lên canvas). */
  onDraw?: () => void;
  onHover?: (hit: V3HoverHit | null, mouse: { x: number; y: number } | null) => void;
}

export class V3 implements V3State {
  ok = false;
  inited = false;
  vis: V3Visibility = {
    conc: true,
    edges: true,
    blind: true,
    soil: true,
    strata: true,
    labels: true,
    grid: true,
    rebar: true,
  };
  hidden: Set<string> = new Set();
  /** Id khối đất (Model3DGroundPart.id) đang bị ẩn trong chú giải. */
  hiddenGround: Set<string> = new Set();
  focus: string | null = null;
  hover: V3HoverHit | null = null;
  cam: V3CameraState = { tx: 0, ty: 0, tz: 0, dist: 1e3, yaw: 1, pitch: 0.42, ortho: false };
  fov = (35 * Math.PI) / 180;
  /** Độ mờ bề mặt 0..1 (0 = đặc, 1 = trong suốt hoàn toàn); `alpha` (độ đặc bê tông) suy ra từ đây. */
  surf = 0.5;
  alpha = 0.5;
  kd = 1;
  colorMode: V3ColorMode = 'mark';
  clip: V3ClipState = { axis: '', t: 1, flip: false };
  model: Model3DData | null = null;
  sig = '';
  raf = 0;
  mouse: { x: number; y: number } | null = null;
  stale = true;

  gl: WebGLRenderingContext | null = null;
  cv: HTMLCanvasElement | null = null;
  ax: HTMLCanvasElement | null = null;
  R = 1e3;
  vp: number[] | null = null;
  W = 0;
  H = 0;
  pxK = 0;
  dpr = 1;
  errMsg = '';
  infoText = '';

  private pTube: V3ShaderProgram | null = null;
  private pMesh: V3ShaderProgram | null = null;
  private pLine: V3ShaderProgram | null = null;
  private pSoil: V3ShaderProgram | null = null;
  private pConc: V3ShaderProgram | null = null;
  private animRaf = 0;
  private resizeObs: ResizeObserver | null = null;
  private unbindEvents: (() => void) | null = null;
  private unbindContextEvents: (() => void) | null = null;
  private pendingModelInput: {
    p: Project | EngineProject;
    res: BarsResult | EngineBarsResult;
    q?: Pick<QuantitiesResult, 'vol' | 'totKg'> | null;
  } | null = null;
  private opts: V3AttachOptions = {};

  constructor(opts: V3AttachOptions = {}) {
    this.opts = opts;
    if (opts.axisCanvas) this.ax = opts.axisCanvas;
  }

  private notify(): void {
    this.opts.onChange?.();
  }

  private initGl(cv: HTMLCanvasElement): boolean {
    let gl: WebGLRenderingContext | null = null;
    try {
      gl =
        (cv.getContext('webgl', {
          antialias: true,
          alpha: false,
          preserveDrawingBuffer: true,
        }) as WebGLRenderingContext | null) ||
        (cv.getContext('experimental-webgl', {
          antialias: true,
          alpha: false,
          preserveDrawingBuffer: true,
        }) as WebGLRenderingContext | null);
    } catch {
      gl = null;
    }

    if (!gl) {
      this.ok = false;
      this.gl = null;
      this.pTube = null;
      this.pMesh = null;
      this.pLine = null;
      this.pSoil = null;
      this.pConc = null;
      this.errMsg =
        'Trình duyệt / máy này không hỗ trợ WebGL nên không xem được 3D. Bản vẽ 2D vẫn dùng bình thường.';
      this.notify();
      return false;
    }

    try {
      this.gl = gl;
      this.pTube = v3Prog(gl, V3_VS_TUBE, V3_FS_TUBE, ['aC', 'aO', 'aN', 'aR']);
      this.pMesh = v3Prog(gl, V3_VS_MESH, V3_FS_MESH, ['aP', 'aN']);
      this.pLine = v3Prog(gl, V3_VS_LINE, V3_FS_LINE, ['aP']);
      if (typeof gl.getExtension === 'function') gl.getExtension('OES_standard_derivatives');
      this.pSoil = v3Prog(gl, V3_VS_MESH, V3_FS_SOIL, ['aP', 'aN']);
      this.pConc = v3Prog(gl, V3_VS_MESH, V3_FS_CONC, ['aP', 'aN']);
    } catch (e) {
      this.ok = false;
      this.gl = null;
      this.pTube = null;
      this.pMesh = null;
      this.pLine = null;
      this.pSoil = null;
      this.pConc = null;
      this.errMsg = 'Lỗi khởi tạo WebGL: ' + (e instanceof Error ? e.message : String(e));
      this.notify();
      return false;
    }

    this.ok = true;
    this.errMsg = '';
    return true;
  }

  private bindContextEvents(cv: HTMLCanvasElement): void {
    const onContextLost = (e: Event) => {
      e.preventDefault();
      if (this.raf) {
        cancelAnimationFrame(this.raf);
        this.raf = 0;
      }
      if (this.animRaf) {
        cancelAnimationFrame(this.animRaf);
        this.animRaf = 0;
      }
      this.ok = false;
      this.gl = null;
      this.pTube = null;
      this.pMesh = null;
      this.pLine = null;
      this.pSoil = null;
      this.pConc = null;
      if (this.model) this.model.gpu = undefined;
      this.errMsg = 'Ngữ cảnh đồ họa 3D (WebGL) đã bị mất. Đang chờ khôi phục…';
      this.notify();
    };

    const onContextRestored = () => {
      if (!this.cv || !this.initGl(this.cv)) return;
      if (this.pendingModelInput) {
        const { p, res, q } = this.pendingModelInput;
        this.pendingModelInput = null;
        this.setModel(p, res, q);
        return;
      }
      if (this.model) {
        this.upload(this.model);
        this.notify();
        this.draw();
      } else {
        this.notify();
      }
    };

    cv.addEventListener('webglcontextlost', onContextLost);
    cv.addEventListener('webglcontextrestored', onContextRestored);

    this.unbindContextEvents = () => {
      cv.removeEventListener('webglcontextlost', onContextLost);
      cv.removeEventListener('webglcontextrestored', onContextRestored);
    };
  }

  attach(cv: HTMLCanvasElement, opts: V3AttachOptions = {}): boolean {
    this.opts = Object.assign({}, this.opts, opts);
    if (this.opts.axisCanvas !== undefined) this.ax = this.opts.axisCanvas;
    if (this.inited && this.cv === cv) return this.ok;
    if (this.inited) this.dispose();

    this.inited = true;
    this.cv = cv;
    if (!this.initGl(cv)) return false;

    this.bindContextEvents(cv);
    this.bindEvents(cv);
    if (typeof ResizeObserver !== 'undefined') {
      const target = cv.parentElement || cv;
      this.resizeObs = new ResizeObserver(() => {
        if (this.model) this.redraw();
      });
      this.resizeObs.observe(target);
    }
    this.notify();
    return true;
  }

  setAxisCanvas(ax: HTMLCanvasElement | null): void {
    this.ax = ax;
    if (this.model && this.ok) this.redraw();
  }

  dispose(): void {
    if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
    if (this.animRaf) {
      cancelAnimationFrame(this.animRaf);
      this.animRaf = 0;
    }
    if (this.resizeObs) {
      this.resizeObs.disconnect();
      this.resizeObs = null;
    }
    if (this.unbindEvents) {
      this.unbindEvents();
      this.unbindEvents = null;
    }
    if (this.unbindContextEvents) {
      this.unbindContextEvents();
      this.unbindContextEvents = null;
    }
    this.free();
    this.pendingModelInput = null;
    this.model = null;
    this.gl = null;
    this.cv = null;
    this.pTube = null;
    this.pMesh = null;
    this.pLine = null;
    this.pSoil = null;
    this.pConc = null;
    this.inited = false;
    this.ok = false;
  }

  destroy(): void {
    this.dispose();
  }

  free(): void {
    const gl = this.gl;
    const m = this.model;
    if (!m || !gl || !m.gpu) return;
    const del = (o?: { vb?: WebGLBuffer | null; ib?: WebGLBuffer | null } | null) => {
      if (o) {
        if (o.vb) gl.deleteBuffer(o.vb);
        if (o.ib) gl.deleteBuffer(o.ib);
      }
    };
    (['conc', 'lean', 'soil'] as const).forEach((k) => {
      const mesh = m.gpu![k];
      del(mesh);
      if (mesh.lb) gl.deleteBuffer(mesh.lb);
    });
    if (m.gpu.pile) {
      del(m.gpu.pile);
      if (m.gpu.pile.lb) gl.deleteBuffer(m.gpu.pile.lb);
    }
    (m.gpu.ground || []).forEach((gm) => {
      del(gm);
      if (gm.lb) gl.deleteBuffer(gm.lb);
    });
    if (m.gpu.grid && m.gpu.grid.lb) gl.deleteBuffer(m.gpu.grid.lb);
    m.groups.forEach((gr) => (gr.chunks || []).forEach(del));
  }

  private upload(model: Model3DData): void {
    const gl = this.gl;
    if (!gl) return;
    const buf = (type: number, data: ArrayBufferView) => {
      const b = gl.createBuffer();
      gl.bindBuffer(type, b);
      gl.bufferData(type, data, gl.STATIC_DRAW);
      return b;
    };
    const mesh = (M: M3Mesh | { p: number[]; n: number[]; i: number[]; l: number[] }) => {
      const n = M.p.length / 3;
      const d = new Float32Array(n * 6);
      for (let i = 0; i < n; i++) {
        d.set(M.p.slice(i * 3, i * 3 + 3), i * 6);
        d.set(M.n.slice(i * 3, i * 3 + 3), i * 6 + 3);
      }
      return {
        vb: n ? buf(gl.ARRAY_BUFFER, d) : null,
        ib: M.i.length ? buf(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(M.i)) : null,
        n: M.i.length,
        lb: M.l.length ? buf(gl.ARRAY_BUFFER, new Float32Array(M.l)) : null,
        nl: M.l.length / 3,
      };
    };

    const bb = model.bbox;
    const gY = model.ground && model.ground.length ? Math.min(...model.ground.map((gp) => gp.y0)) : bb.y0;
    const y = Math.min(bb.y0, gY) - 0.5;
    const st = 100;
    const l: number[] = [];
    const xa = Math.floor((bb.x0 - 250) / st) * st;
    const xb = Math.ceil((bb.x1 + 250) / st) * st;
    const za = Math.floor((bb.z0 - 250) / st) * st;
    const zb = Math.ceil((bb.z1 + 250) / st) * st;
    for (let x = xa; x <= xb; x += st) l.push(x, y, za, x, y, zb);
    for (let z = za; z <= zb; z += st) l.push(xa, y, z, xb, y, z);

    model.gpu = {
      conc: mesh(model.conc),
      lean: mesh(model.lean),
      soil: mesh(model.soil),
      ...(model.pile ? { pile: mesh(model.pile) } : {}),
      ...(model.ground && model.ground.length ? { ground: model.ground.map((gp) => mesh(gp.mesh)) } : {}),
      grid: { lb: l.length ? buf(gl.ARRAY_BUFFER, new Float32Array(l)) : null, nl: l.length / 3 },
    };

    const nSeg = model.groups.reduce(
      (s, gr) => s + gr.bars.reduce((t, pl) => t + Math.max(0, pl.length - 1), 0),
      0,
    );
    const sides = nSeg < 2500 ? 8 : 6;

    model.groups.forEach((gr, gi) => {
      const T = new M3Tubes(sides);
      const ranges: (M3TubeRange | null)[] = [];
      const segs: number[] = [];
      const segBar: number[] = [];
      const R = gr.R ?? gr.d / 20;
      gr.bars.forEach((pl, bi) => {
        ranges.push(T.add(pl, R));
        for (let i = 1; i < pl.length; i++) {
          segs.push(pl[i - 1][0], pl[i - 1][1], pl[i - 1][2], pl[i][0], pl[i][1], pl[i][2]);
          segBar.push(bi);
        }
      });
      gr.chunks = T.finish().map(
        (c): M3TubeChunk => ({
          v: [],
          i: [],
          nv: c.nv,
          vb: buf(gl.ARRAY_BUFFER, c.v),
          ib: buf(gl.ELEMENT_ARRAY_BUFFER, c.i),
          n: c.i.length,
        }),
      );
      gr.ranges = ranges;
      const col = V3_PAL[gi % V3_PAL.length];
      const bs = gr.bs || [];
      gr.kg = bs.reduce((s, b) => s + (b.kg || 0), 0);
      const minL = bs.length ? Math.min(...bs.map((b) => b.minL || 0)) : 0;
      const maxL = bs.length ? Math.max(...bs.map((b) => b.maxL || 0)) : 0;
      V3_GROUP_META.set(gr, {
        col,
        minL,
        maxL,
        segs: new Float32Array(segs),
        segBar: new Int32Array(segBar),
      });
    });
  }

  private eye(): Point3D {
    const c = this.cam;
    const cp = Math.cos(c.pitch);
    return [
      c.tx + c.dist * cp * Math.sin(c.yaw),
      c.ty + c.dist * Math.sin(c.pitch),
      c.tz + c.dist * cp * Math.cos(c.yaw),
    ];
  }

  private legW(): number {
    return this.opts.getLegOffsetPx ? this.opts.getLegOffsetPx() : 0;
  }

  fitDist(yaw: number, pitch: number): number {
    if (!this.model || !this.cv) return 1e3;
    const b = this.model.bbox;
    const cp = Math.cos(pitch);
    const z: Point3D = [cp * Math.sin(yaw), Math.sin(pitch), cp * Math.cos(yaw)];
    const x = m3norm(m3cross([0, 1, 0], z));
    const y = m3cross(z, x);
    const cx = (b.x0 + b.x1) / 2;
    const cy = (b.y0 + b.y1) / 2;
    const cz = (b.z0 + b.z1) / 2;
    const W = this.cv.clientWidth || this.cv.width;
    const H = Math.max(1, this.cv.clientHeight || this.cv.height);
    const asp = Math.max(0.3, (W - this.legW()) / H);
    const tv = Math.tan(this.fov / 2);
    const th = tv * asp;
    let need = 0;
    for (let i = 0; i < 8; i++) {
      const d: Point3D = [
        (i & 1 ? b.x1 : b.x0) - cx,
        (i & 2 ? b.y1 : b.y0) - cy,
        (i & 4 ? b.z1 : b.z0) - cz,
      ];
      const pz = this.cam.ortho ? 0 : m3dot(d, z);
      need = Math.max(need, Math.abs(m3dot(d, x)) / th + pz, Math.abs(m3dot(d, y)) / tv + pz);
    }
    return need * 1.07;
  }

  fit(keepAngle = false): void {
    const m = this.model;
    if (!m) return;
    const b = m.bbox;
    const c = this.cam;
    c.tx = (b.x0 + b.x1) / 2;
    c.ty = (b.y0 + b.y1) / 2;
    c.tz = (b.z0 + b.z1) / 2;
    this.R = 0.5 * Math.hypot(b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0);
    if (!keepAngle) {
      c.yaw = V3_VIEWS.back[1];
      c.pitch = V3_VIEWS.back[2];
      c.ortho = false;
    }
    c.dist = this.fitDist(c.yaw, c.pitch);
  }

  setOrtho(on: boolean): void {
    this.cam.ortho = !!on;
    this.notify();
  }

  setView(k: V3ViewPresetId): void {
    const w = V3_VIEWS[k];
    if (!this.model || !w) return;
    this.cam.ortho = !!w[3];
    this.notify();
    this.go(w[1], w[2], true);
  }

  go(yaw: number, pitch: number, fit = true): void {
    if (!this.model) return;
    if (this.animRaf) {
      cancelAnimationFrame(this.animRaf);
      this.animRaf = 0;
    }
    const c = this.cam;
    const f = { yaw: c.yaw, pitch: c.pitch, dist: c.dist, tx: c.tx, ty: c.ty, tz: c.tz };
    const b = this.model.bbox;
    const t = {
      yaw,
      pitch,
      dist: fit ? this.fitDist(yaw, pitch) : c.dist,
      tx: fit ? (b.x0 + b.x1) / 2 : c.tx,
      ty: fit ? (b.y0 + b.y1) / 2 : c.ty,
      tz: fit ? (b.z0 + b.z1) / 2 : c.tz,
    };
    const t0 = performance.now();
    const ms = 360;
    let dy = t.yaw - f.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      c.yaw = f.yaw + dy * e;
      c.pitch = f.pitch + (t.pitch - f.pitch) * e;
      c.dist = f.dist + (t.dist - f.dist) * e;
      c.tx = f.tx + (t.tx - f.tx) * e;
      c.ty = f.ty + (t.ty - f.ty) * e;
      c.tz = f.tz + (t.tz - f.tz) * e;
      this.draw();
      if (k < 1) {
        this.animRaf = requestAnimationFrame(step);
      } else {
        this.animRaf = 0;
      }
    };
    this.animRaf = requestAnimationFrame(step);
  }

  redraw(): void {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.draw();
    });
  }

  private attribs(gl: WebGLRenderingContext, n: number): void {
    for (let i = 0; i < 4; i++) {
      if (i < n) gl.enableVertexAttribArray(i);
      else gl.disableVertexAttribArray(i);
    }
  }

  private matrices(): { vp: number[]; pxK: number; L: Point3D; view: number[]; e: Point3D } {
    const cv = this.cv!;
    const c = this.cam;
    const W = cv.width;
    const H = cv.height;
    const asp = W / Math.max(1, H);
    const e = this.eye();
    const view = v3m.look(e, [c.tx, c.ty, c.tz], [0, 1, 0]);
    const R = this.R || 1e3;
    let proj: number[];
    let pxK: number;
    if (c.ortho) {
      const hh = c.dist * Math.tan(this.fov / 2);
      const hw = hh * asp;
      proj = v3m.ortho(hw, hh, -R * 4, c.dist + R * 4);
      pxK = (2 * hh) / Math.max(1, H);
    } else {
      proj = v3m.persp(this.fov, asp, Math.max(0.5, c.dist * 0.01), c.dist + R * 6);
      pxK = (2 * Math.tan(this.fov / 2)) / Math.max(1, H);
    }
    const sx = -this.legW() / Math.max(1, cv.clientWidth || cv.width);
    const vp = v3m.mul([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, sx, 0, 0, 1], v3m.mul(proj, view));
    const z = m3norm(m3sub(e, [c.tx, c.ty, c.tz]));
    const x = m3norm(m3cross([0, 1, 0], z));
    const y = m3cross(z, x);
    const L = m3norm([
      z[0] * 0.8 + y[0] * 0.55 - x[0] * 0.4,
      z[1] * 0.8 + y[1] * 0.55 - x[1] * 0.4,
      z[2] * 0.8 + y[2] * 0.55 - x[2] * 0.4,
    ]);
    return { vp, pxK, L, view, e };
  }

  draw(): void {
    if (!this.ok || !this.model || !this.gl || !this.cv || !this.pTube || !this.pMesh || !this.pLine) {
      return;
    }
    if (this.opts.isHidden?.()) return;

    const gl = this.gl;
    const cv = this.cv;
    const dpr = Math.min((typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1, 2);
    const cw = cv.clientWidth || cv.width;
    const ch = cv.clientHeight || cv.height;
    const W = Math.max(2, Math.round(cw * dpr));
    const H = Math.max(2, Math.round(ch * dpr));
    if (cv.width !== W || cv.height !== H) {
      cv.width = W;
      cv.height = H;
    }

    const m = this.model;
    const M = this.matrices();
    const clip = v3ClipVec(m, this.clip);
    this.vp = M.vp;
    this.W = cw;
    this.H = ch;
    this.pxK = M.pxK;
    this.dpr = W / Math.max(1, cw);

    gl.viewport(0, 0, W, H);
    gl.clearColor(0.129, 0.157, 0.188, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.CULL_FACE);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const focus = this.focus;
    const dimmed = (gr: M3BarGroup) => !!(focus && gr.id !== focus);

    const tubeUse = () => {
      const P = this.pTube!;
      gl.useProgram(P.pr);
      gl.uniformMatrix4fv(P.u.uVP, false, M.vp);
      gl.uniform1f(P.u.uPxK, M.pxK);
      gl.uniform1f(P.u.uPersp, this.cam.ortho ? 0 : 1);
      gl.uniform1f(P.u.uMinPx, 0.9);
      gl.uniform3fv(P.u.uL, M.L);
      gl.uniform4fv(P.u.uClip, clip);
      this.attribs(gl, 4);
      return P;
    };

    const tubeDraw = (
      P: V3ShaderProgram,
      gr: M3BarGroup,
      scale: number,
      col: [number, number, number],
      a: number,
    ) => {
      gl.uniform1f(P.u.uScale, scale);
      gl.uniform3fv(P.u.uCol, col);
      gl.uniform1f(P.u.uA, a);
      (gr.chunks || []).forEach((ch) => {
        if (!ch.vb || !ch.ib || !ch.n) return;
        gl.bindBuffer(gl.ARRAY_BUFFER, ch.vb);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 40, 0);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 40, 12);
        gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 40, 24);
        gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 40, 36);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ch.ib);
        gl.drawElements(gl.TRIANGLES, ch.n, gl.UNSIGNED_SHORT, 0);
      });
    };

    if (this.vis.rebar) {
      gl.disable(gl.BLEND);
      gl.depthMask(true);
      const P = tubeUse();
      m.groups.forEach((gr, gi) => {
        if (this.hidden.has(gr.id || '') || dimmed(gr)) return;
        tubeDraw(P, gr, this.kd * (focus ? 1.5 : 1), v3GroupColor(gr, this.colorMode, gi), 1);
      });
      const h = this.hover;
      if (h && !this.hidden.has(h.gr.id || '')) {
        const gr = h.gr;
        const r = gr.ranges?.[h.bi];
        const ch = r ? gr.chunks?.[r.ci] : undefined;
        if (r && ch && ch.vb && ch.ib) {
          gl.depthFunc(gl.ALWAYS);
          gl.uniform1f(P.u.uScale, Math.max(2, this.kd * 2.2));
          gl.uniform3fv(P.u.uCol, [1, 1, 0.85]);
          gl.uniform1f(P.u.uA, 1);
          gl.bindBuffer(gl.ARRAY_BUFFER, ch.vb);
          gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 40, 0);
          gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 40, 12);
          gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 40, 24);
          gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 40, 36);
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ch.ib);
          gl.drawElements(gl.TRIANGLES, r.n, gl.UNSIGNED_SHORT, r.i0 * 2);
          gl.depthFunc(gl.LEQUAL);
        }
      }
    }

    if (m.gpu) {
      const P = this.pLine;
      gl.useProgram(P.pr);
      gl.uniformMatrix4fv(P.u.uVP, false, M.vp);
      this.attribs(gl, 1);
      gl.enable(gl.BLEND);
      gl.depthMask(false);
      const lines = (
        o: { lb: WebGLBuffer | null; nl: number } | undefined,
        col: [number, number, number],
        a: number,
        cl?: [number, number, number, number],
      ) => {
        if (!o || !o.lb || !o.nl) return;
        gl.uniform3fv(P.u.uCol, col);
        gl.uniform1f(P.u.uA, a);
        gl.uniform4fv(P.u.uClip, cl || clip);
        gl.bindBuffer(gl.ARRAY_BUFFER, o.lb);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0);
        gl.drawArrays(gl.LINES, 0, o.nl);
      };
      if (this.vis.grid) lines(m.gpu.grid, [0.3, 0.37, 0.44], 0.55, [0, 0, 0, 1]);
      if (this.vis.edges) {
        if (this.vis.conc) lines(m.gpu.conc, [0.78, 0.88, 0.98], 0.95);
        if (this.vis.conc) lines(m.gpu.pile, [0.86, 0.78, 0.6], 0.9);
        if (this.vis.blind) lines(m.gpu.lean, [0.62, 0.64, 0.66], 0.8);
      }

      type GMesh = { vb: WebGLBuffer | null; ib: WebGLBuffer | null; n: number } | undefined;
      const bindMesh = (o: NonNullable<GMesh>) => {
        gl.bindBuffer(gl.ARRAY_BUFFER, o.vb);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, o.ib);
        gl.drawElements(gl.TRIANGLES, o.n, gl.UNSIGNED_SHORT, 0);
      };

      // --- 1) bê tông (tường / bản, lót, cọc): trong mờ, màu xám xi măng, vẽ trước đất ---
      const PC = this.pConc;
      const PM = this.pMesh;
      const a1 = this.alpha;
      const concItems: Array<{ o: GMesh; col: [number, number, number]; a: number; mode: number }> = [];
      if (this.vis.blind) concItems.push({ o: m.gpu.lean, col: [0.72, 0.7, 0.64], a: Math.min(1, a1 * 1.15), mode: 1 });
      if (this.vis.conc) concItems.push({ o: m.gpu.conc, col: [0.68, 0.68, 0.66], a: a1, mode: 0 });
      if (this.vis.conc && m.gpu.pile) concItems.push({ o: m.gpu.pile, col: [0.62, 0.62, 0.6], a: Math.min(1, a1 * 1.1), mode: 2 });
      gl.enable(gl.BLEND);
      gl.depthMask(false);
      gl.enable(gl.CULL_FACE);
      if (PC && concItems.length) {
        gl.useProgram(PC.pr);
        gl.uniformMatrix4fv(PC.u.uVP, false, M.vp);
        gl.uniform3fv(PC.u.uL, M.L);
        gl.uniform4fv(PC.u.uClip, clip);
        this.attribs(gl, 2);
        const drawConc = (it: (typeof concItems)[number]) => {
          if (!it.o || !it.o.vb || !it.o.ib || !it.o.n || it.a <= 0.003) return;
          gl.uniform3fv(PC.u.uCol, it.col);
          gl.uniform1f(PC.u.uA, it.a);
          gl.uniform1f(PC.u.uMode, it.mode);
          bindMesh(it.o);
        };
        gl.cullFace(gl.FRONT);
        concItems.forEach(drawConc);
        gl.cullFace(gl.BACK);
        concItems.forEach(drawConc);
      }

      // --- 2) ghi độ sâu của mặt trước bê tông (không ghi màu) để đất nằm SAU bê tông bị che đúng ---
      const solidItems = concItems.filter((it) => it.a > 0.05);
      if (solidItems.length) {
        gl.useProgram(PM.pr);
        gl.uniformMatrix4fv(PM.u.uVP, false, M.vp);
        gl.uniform4fv(PM.u.uClip, clip);
        this.attribs(gl, 2);
        gl.colorMask(false, false, false, false);
        gl.depthMask(true);
        gl.cullFace(gl.BACK);
        solidItems.forEach((it) => {
          if (it.o && it.o.vb && it.o.ib && it.o.n) bindMesh(it.o);
        });
        gl.colorMask(true, true, true, true);
        gl.depthMask(false);
      }

      // --- 3) đất (nền theo lớp + đất đắp): chỉ vẽ mặt trước và GHI độ sâu → không bị lỗi xuyên thấu ---
      const PS = this.pSoil;
      const grass: [number, number, number] = [0.34, 0.5, 0.2];
      const KIND: Record<string, number> = { sand: 0, clay: 1, mud: 2, rock: 3, fill: 4 };
      const oS = 1 - this.surf;
      const soilItems: Array<{ o: GMesh; col: [number, number, number]; a: number; topK: number; kind: number }> = [];
      if (this.vis.strata && m.ground) {
        m.ground.forEach((gp, gi) => {
          if (this.hiddenGround.has(gp.id)) return;
          soilItems.push({
            o: m.gpu?.ground?.[gi],
            col: gp.color,
            a: gp.kind === 'cover' ? Math.min(1, oS + 0.1) : oS,
            topK: gp.kind === 'cover' ? 1 : 0,
            kind: KIND[gp.look] ?? 1,
          });
        });
      }
      if (this.vis.soil) {
        soilItems.push({ o: m.gpu.soil, col: [0.6, 0.44, 0.26], a: oS, topK: 1, kind: 4 });
      }
      if (PS && soilItems.length) {
        gl.useProgram(PS.pr);
        gl.uniformMatrix4fv(PS.u.uVP, false, M.vp);
        gl.uniform3fv(PS.u.uL, M.L);
        gl.uniform4fv(PS.u.uClip, clip);
        gl.uniform3fv(PS.u.uTop, grass);
        this.attribs(gl, 2);
        gl.depthMask(true);
        gl.enable(gl.POLYGON_OFFSET_FILL);
        gl.polygonOffset(1, 1);
        gl.cullFace(gl.BACK);
        soilItems.forEach((it) => {
          if (!it.o || !it.o.vb || !it.o.ib || !it.o.n || it.a <= 0.003) return;
          gl.uniform3fv(PS.u.uCol, it.col);
          gl.uniform1f(PS.u.uA, it.a);
          gl.uniform1f(PS.u.uTopK, it.topK);
          gl.uniform1f(PS.u.uKind, it.kind);
          bindMesh(it.o);
        });
        gl.disable(gl.POLYGON_OFFSET_FILL);
        gl.depthMask(false);
      }
      gl.disable(gl.CULL_FACE);

      // --- 4) nét viền đất (sau khi vẽ đất, có kiểm tra độ sâu) ---
      if (this.vis.edges) {
        gl.useProgram(P.pr);
        gl.uniformMatrix4fv(P.u.uVP, false, M.vp);
        this.attribs(gl, 1);
        if (this.vis.soil) lines(m.gpu.soil, [0.72, 0.55, 0.36], 0.55);
        if (this.vis.strata && m.ground) {
          m.gpu.ground?.forEach((gm, gi) => {
            if (this.hiddenGround.has(m.ground![gi].id)) return;
            const c = m.ground![gi].color;
            lines(gm, [c[0] * 0.6, c[1] * 0.6, c[2] * 0.6], 0.55);
          });
        }
      }
    }

    if (this.vis.rebar && focus) {
      gl.enable(gl.BLEND);
      gl.depthMask(false);
      const P = tubeUse();
      m.groups.forEach((gr, gi) => {
        if (this.hidden.has(gr.id || '') || !dimmed(gr)) return;
        tubeDraw(P, gr, this.kd, v3GroupColor(gr, this.colorMode, gi), 0.16);
      });
    }

    gl.depthMask(true);
    v3AxisDraw(this.ax, M.view);
    this.opts.onDraw?.();
  }

  pick(mx: number, my: number): V3HoverHit | null {
    return v3Pick(this, mx, my);
  }

  setFocus(id: string | null): void {
    this.focus = id || null;
    this.notify();
    this.redraw();
  }

  toggleFocus(id: string): void {
    this.setFocus(this.focus === id ? null : id);
  }

  setGroupVisible(id: string, visible: boolean): void {
    if (visible) this.hidden.delete(id);
    else this.hidden.add(id);
    this.notify();
    this.redraw();
  }

  /** Chiếu điểm mô hình (cm) ra toạ độ px CSS của canvas; null khi chưa vẽ hoặc ở sau camera / bị mặt cắt cắt mất. */
  toScreen(x: number, y: number, z: number): { x: number; y: number } | null {
    const vp = this.vp;
    if (!vp || this.W <= 0 || this.H <= 0) return null;
    const cl = v3ClipVec(this.model, this.clip);
    if (cl[0] * x + cl[1] * y + cl[2] * z > cl[3]) return null;
    const w = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
    if (!(w > 1e-6)) return null;
    return {
      x: (((vp[0] * x + vp[4] * y + vp[8] * z + vp[12]) / w) * 0.5 + 0.5) * this.W,
      y: (1 - (((vp[1] * x + vp[5] * y + vp[9] * z + vp[13]) / w) * 0.5 + 0.5)) * this.H,
    };
  }

  setGroundVisible(id: string, visible: boolean): void {
    if (visible) this.hiddenGround.delete(id);
    else this.hiddenGround.add(id);
    this.notify();
    this.redraw();
  }

  setAllVisible(on: boolean): void {
    this.hidden.clear();
    if (!on && this.model) {
      this.model.groups.forEach((g) => {
        if (g.id) this.hidden.add(g.id);
      });
    }
    this.notify();
    this.redraw();
  }

  setVis(key: keyof V3Visibility, on: boolean): void {
    this.vis[key] = !!on;
    this.notify();
    this.redraw();
  }

  setClip(patch: Partial<V3ClipState>): void {
    Object.assign(this.clip, patch);
    this.notify();
    this.redraw();
  }

  setColorMode(mode: V3ColorMode): void {
    this.colorMode = mode;
    this.notify();
    this.redraw();
  }

  setSurf(s: number): void {
    this.surf = Math.max(0, Math.min(1, s));
    this.alpha = 1 - this.surf;
    this.notify();
    this.redraw();
  }

  setAlpha(a: number): void {
    this.alpha = a;
    this.notify();
    this.redraw();
  }

  setKd(kd: number): void {
    this.kd = kd;
    this.notify();
    this.redraw();
  }

  setModel(
    p: Project | EngineProject,
    res: BarsResult | EngineBarsResult,
    q?: Pick<QuantitiesResult, 'vol' | 'totKg'> | null,
  ): Model3DData | null {
    this.stale = false;
    if (!this.ok) {
      this.pendingModelInput = { p, res, q };
      return null;
    }
    this.pendingModelInput = null;
    const keepFocus = this.focus;
    if (this.model) this.free();
    const model = model3D(p, res);
    this.upload(model);
    this.model = model;
    this.infoText = v3FormatInfo(p, res, q);
    if (model.sig !== this.sig) {
      this.sig = model.sig;
      this.fit(false);
      this.hidden.clear();
      this.focus = null;
    } else {
      this.fit(true);
    }
    if (keepFocus && !model.groups.some((x) => x.id === keepFocus)) this.focus = null;
    this.notify();
    this.redraw();
    return model;
  }

  update(
    p: Project | EngineProject,
    res: BarsResult | EngineBarsResult,
    q?: Pick<QuantitiesResult, 'vol' | 'totKg'> | null,
  ): Model3DData | null {
    return this.setModel(p, res, q);
  }

  async toPngBlob(
    p: Project | EngineProject,
    infoText?: string,
    axisCanvas?: HTMLCanvasElement | null,
  ): Promise<Blob | null> {
    if (!this.ok || !this.model || !this.cv) return null;
    this.draw();
    return v3Png({
      cv: this.cv,
      tpl: p.tpl,
      infoText: infoText ?? this.infoText,
      axisCanvas: axisCanvas !== undefined ? axisCanvas : this.ax,
    });
  }

  private bindEvents(cv: HTMLCanvasElement): void {
    const ptrs = new Map<number, { x: number; y: number }>();
    let drag: { x0: number; y0: number; btn: number; moved: number } | null = null;
    let pinch: { d: number; cx: number; cy: number } | null = null;
    let pend = false;

    const rect = () => cv.getBoundingClientRect();
    const orbit = (dx: number, dy: number) => {
      this.cam.yaw -= dx * 0.0075;
      this.cam.pitch = Math.max(-1.5, Math.min(1.5, this.cam.pitch + dy * 0.0075));
      this.redraw();
    };
    const pan = (dx: number, dy: number) => {
      const c = this.cam;
      const e = this.eye();
      const z = m3norm(m3sub(e, [c.tx, c.ty, c.tz]));
      const x = m3norm(m3cross([0, 1, 0], z));
      const y = m3cross(z, x);
      const k = (2 * c.dist * Math.tan(this.fov / 2)) / Math.max(1, cv.clientHeight || cv.height);
      c.tx += (-dx * x[0] + dy * y[0]) * k;
      c.ty += (-dx * x[1] + dy * y[1]) * k;
      c.tz += (-dx * x[2] + dy * y[2]) * k;
      this.redraw();
    };
    const zoom = (f: number) => {
      this.cam.dist = Math.max(20, Math.min((this.R || 1e3) * 12, this.cam.dist * f));
      this.redraw();
    };
    const hover = () => {
      pend = false;
      if (!this.mouse || drag) return;
      const h = this.pick(this.mouse.x, this.mouse.y);
      const o = this.hover;
      if ((h && o && h.gr === o.gr && h.bi === o.bi) || (!h && !o)) {
        this.opts.onHover?.(h, this.mouse);
        return;
      }
      this.hover = h;
      cv.style.cursor = h ? 'pointer' : 'grab';
      this.opts.onHover?.(h, this.mouse);
      this.notify();
      this.redraw();
    };

    const onPointerDown = (e: PointerEvent) => {
      cv.setPointerCapture?.(e.pointerId);
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      drag = { x0: e.clientX, y0: e.clientY, btn: e.button, moved: 0 };
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        pinch = {
          d: Math.hypot(a.x - b.x, a.y - b.y),
          cx: (a.x + b.x) / 2,
          cy: (a.y + b.y) / 2,
        };
      }
      cv.style.cursor = 'grabbing';
      this.opts.onHover?.(null, this.mouse);
    };

    const onPointerMove = (e: PointerEvent) => {
      const r = rect();
      const pt = ptrs.get(e.pointerId);
      if (!pt) {
        this.mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
        if (!pend) {
          pend = true;
          requestAnimationFrame(hover);
        }
        return;
      }
      const dx = e.clientX - pt.x;
      const dy = e.clientY - pt.y;
      pt.x = e.clientX;
      pt.y = e.clientY;
      if (ptrs.size === 1 && drag) {
        drag.moved += Math.abs(dx) + Math.abs(dy);
        if (drag.btn === 2 || drag.btn === 1 || e.shiftKey || e.ctrlKey) pan(dx, dy);
        else orbit(dx, dy);
      } else if (ptrs.size === 2 && pinch) {
        const [a, b] = [...ptrs.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const cx = (a.x + b.x) / 2;
        const cy = (a.y + b.y) / 2;
        if (d > 5 && pinch.d > 5) zoom(pinch.d / d);
        pan(cx - pinch.cx, cy - pinch.cy);
        pinch = { d, cx, cy };
        if (drag) drag.moved += 99;
      }
    };

    const up = (e: PointerEvent) => {
      const had = ptrs.delete(e.pointerId);
      if (!had) return;
      cv.style.cursor = 'grab';
      if (drag && drag.moved < 5 && ptrs.size === 0 && e.type === 'pointerup' && drag.btn === 0) {
        const r = rect();
        const h = this.pick(e.clientX - r.left, e.clientY - r.top);
        this.hover = h;
        if (h && h.gr.id) this.toggleFocus(h.gr.id);
        else this.setFocus(null);
      }
      if (ptrs.size === 0) drag = null;
      pinch = null;
    };

    const onPointerLeave = () => {
      this.mouse = null;
      if (this.hover) {
        this.hover = null;
        this.redraw();
      }
      this.opts.onHover?.(null, null);
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoom(Math.exp(Math.max(-120, Math.min(120, e.deltaY)) * 0.0016));
    };

    const onContextMenu = (e: MouseEvent) => e.preventDefault();
    const onDblClick = () => this.go(this.cam.yaw, this.cam.pitch, true);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !this.opts.isHidden?.()) this.setFocus(null);
    };

    cv.addEventListener('pointerdown', onPointerDown);
    cv.addEventListener('pointermove', onPointerMove);
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', onPointerLeave);
    cv.addEventListener('wheel', onWheel, { passive: false });
    cv.addEventListener('contextmenu', onContextMenu);
    cv.addEventListener('dblclick', onDblClick);
    if (typeof document !== 'undefined') document.addEventListener('keydown', onKeyDown);

    this.unbindEvents = () => {
      cv.removeEventListener('pointerdown', onPointerDown);
      cv.removeEventListener('pointermove', onPointerMove);
      cv.removeEventListener('pointerup', up);
      cv.removeEventListener('pointercancel', up);
      cv.removeEventListener('pointerleave', onPointerLeave);
      cv.removeEventListener('wheel', onWheel);
      cv.removeEventListener('contextmenu', onContextMenu);
      cv.removeEventListener('dblclick', onDblClick);
      if (typeof document !== 'undefined') document.removeEventListener('keydown', onKeyDown);
    };
  }
}
