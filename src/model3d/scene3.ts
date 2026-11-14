/**
 * Lõi vẽ 3D bằng three.js (vật liệu PBR, bầu trời, ánh sáng môi trường, bóng đổ).
 * `V3` (viewer3d.ts) vẫn giữ camera, chọn thanh, sự kiện chuột; file này chỉ lo dựng cảnh và vẽ.
 * Đơn vị mô hình: cm. Trục y hướng lên.
 */
import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import type {
  M3BarGroup,
  Model3DData,
  Point3D,
  V3ColorMode,
  V3HoverHit,
  V3Visibility,
} from '../types/project';

/** Thời tiết mô phỏng (chỉ có tác dụng ở kiểu xem chân thực). */
export type V3Weather = 'sunny' | 'cloudy' | 'rain' | 'sunset' | 'fog';

export const V3_WEATHER_LABEL: Record<V3Weather, string> = {
  sunny: 'Nắng đẹp',
  cloudy: 'Nhiều mây',
  rain: 'Mưa',
  sunset: 'Hoàng hôn',
  fog: 'Sương mù',
};

/** Kiểu hiển thị: `real` = chân thực (bê tông đặc, trời, bóng đổ); `xray` = nhìn xuyên để xem cốt thép. */
export type V3Look = 'real' | 'xray';

export interface Scene3TubeChunk {
  v: Float32Array;
  i: Uint16Array;
}

export interface Scene3Frame {
  cssW: number;
  cssH: number;
  dpr: number;
  eye: Point3D;
  target: Point3D;
  fov: number;
  ortho: boolean;
  dist: number;
  near: number;
  far: number;
  /** Độ dịch khung nhìn (px CSS) để mô hình nằm giữa vùng không bị bảng nổi che: + = cảnh dịch sang trái / lên trên. */
  offX: number;
  offY: number;
  pxK: number;
  clip: [number, number, number, number];
  vis: V3Visibility;
  hidden: Set<string>;
  hiddenGround: Set<string>;
  focus: string | null;
  hover: V3HoverHit | null;
  /** Độ trong suốt bề mặt hiệu dụng 0..1. */
  surf: number;
  kd: number;
  look: V3Look;
  weather?: V3Weather;
  colorOf: (gr: M3BarGroup, gi: number) => [number, number, number];
  colorMode: V3ColorMode;
}

export interface Scene3Like {
  gl: WebGLRenderingContext | WebGL2RenderingContext | null;
  /** Gọi khi vật liệu ảnh / bầu trời HDRI vừa nạp xong và cảnh cần vẽ lại. */
  onAssets?: (() => void) | null;
  /** true khi cảnh có chuyển động (mưa rơi) và cần vẽ liên tục. */
  animating?: boolean;
  setModel(model: Model3DData, tubes: Map<M3BarGroup, Scene3TubeChunk[]>): void;
  render(f: Scene3Frame): void;
  dispose(): void;
}

const GLSL_VARY_VS = `
varying vec3 vWPos;
varying vec3 vWNrm;
`;

const GLSL_NOISE = `
varying vec3 vWPos;
varying vec3 vWNrm;
float tcHeight = 0.0;
float tcRough = 0.0;
float tcH(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
float tcVn(vec3 p){ vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float a = tcH(i), b = tcH(i + vec3(1.0, 0.0, 0.0)), c = tcH(i + vec3(0.0, 1.0, 0.0)), d = tcH(i + vec3(1.0, 1.0, 0.0));
  float e = tcH(i + vec3(0.0, 0.0, 1.0)), g = tcH(i + vec3(1.0, 0.0, 1.0)), k = tcH(i + vec3(0.0, 1.0, 1.0)), l = tcH(i + vec3(1.0, 1.0, 1.0));
  return mix(mix(mix(a, b, f.x), mix(c, d, f.x), f.y), mix(mix(e, g, f.x), mix(k, l, f.x), f.y), f.z); }
float tcNz(vec3 p, float s, float fw){ return mix(0.5, tcVn(p / s), 1.0 - smoothstep(0.35 * s, 1.1 * s, fw)); }
float tcRidge(vec3 p, float s, float fw){ return mix(0.7, abs(tcVn(p / s) * 2.0 - 1.0), 1.0 - smoothstep(0.35 * s, 1.1 * s, fw)); }
`;

/** Bê tông: đốm cốt liệu, lỗ rỗng, mối nối ván khuôn, lỗ ty. uMode: 0 tường/bản, 1 bê tông lót, 2 cọc. */
const GLSL_CONC = `
{
  vec3 an = abs(normalize(vWNrm));
  float fw = length(fwidth(vWPos));
  float mott = tcNz(vWPos, 46.0, fw) * 0.45 + tcNz(vWPos, 13.0, fw) * 0.35 + tcNz(vWPos, 3.6, fw) * 0.2;
  float fine = tcNz(vWPos, 0.8, fw);
  float pore = smoothstep(0.80, 0.92, tcNz(vWPos + 11.3, 1.5, fw)) * (uMode > 1.5 ? 0.35 : 1.0);
  float rough = uMode > 0.5 && uMode < 1.5 ? 1.6 : 1.0;
  float tone = (0.84 + 0.30 * mott + 0.10 * rough * (fine - 0.5)) * (1.0 - 0.34 * pore);
  float h = 0.10 * rough * fine - 0.35 * pore;
  // vệt nước chảy dọc mặt đứng
  if (an.y < 0.6) {
    float hc = an.x > an.z ? vWPos.z : vWPos.x;
    float streak = tcNz(vec3(hc, vWPos.y * 0.06, 3.0), 9.0, fw);
    tone *= 1.0 - 0.10 * smoothstep(0.55, 0.9, streak);
  }
  if (uMode < 0.5 && an.y < 0.6) {
    float hc = an.x > an.z ? vWPos.z : vWPos.x;
    float sy = abs(fract(vWPos.y / 120.0 + 0.5) - 0.5) * 120.0;
    float sh = abs(fract(hc / 240.0 + 0.5) - 0.5) * 240.0;
    float lw = 0.3 + fw * 0.7;
    float seam = 1.0 - smoothstep(lw, lw * 2.4, min(sy, sh));
    vec2 g = vec2(fract(hc / 60.0) - 0.5, fract(vWPos.y / 60.0) - 0.5) * 60.0;
    float hole = 1.0 - smoothstep(1.2, 2.2 + fw, length(g));
    float fadeF = 1.0 - smoothstep(4.0, 14.0, fw);
    tone *= 1.0 - fadeF * (0.15 * seam + 0.30 * hole);
    h -= fadeF * (0.18 * seam + 0.6 * hole);
  }
  diffuseColor.rgb *= tone;
  tcHeight = h;
  tcRough = 0.10 * (mott - 0.5) + 0.12 * pore;
}
`;

/** Đất theo loại — uKind: 0 cát, 1 sét, 2 bùn, 3 đá, 4 đất đắp; mặt trên (uTopK) phủ cỏ. */
const GLSL_SOIL = `
{
  vec3 n0 = normalize(vWNrm);
  float fw = length(fwidth(vWPos));
  float m = tcNz(vWPos, 60.0, fw) * 0.45 + tcNz(vWPos, 20.0, fw) * 0.35 + tcNz(vWPos, 6.0, fw) * 0.2;
  float g1 = tcNz(vWPos, 1.1, fw); float g2 = tcNz(vWPos, 0.45, fw);
  float bed = sin(vWPos.y * 0.20 + tcNz(vWPos, 90.0, fw) * 7.0) * 0.5 + 0.5;
  vec3 col = diffuseColor.rgb; float tone = 0.80 + 0.40 * m; float h = 0.5 * g1;
  if (uKind < 0.5) {
    tone *= 0.88 + 0.24 * g1 + 0.12 * (g2 - 0.5);
    float lam = smoothstep(0.7, 0.95, sin(vWPos.y * 1.3 + tcNz(vWPos, 30.0, fw) * 9.0) * 0.5 + 0.5);
    tone *= 1.0 - 0.10 * lam - 0.30 * smoothstep(0.78, 0.9, g2);
  } else if (uKind < 1.5) {
    float cr = 1.0 - smoothstep(0.02, 0.06 + fw * 0.02, tcRidge(vWPos, 9.0, fw));
    tone *= (0.92 + 0.14 * g1) * (0.94 + 0.12 * bed) * (1.0 - 0.38 * cr);
    h -= 0.8 * cr;
  } else if (uKind < 2.5) {
    tone *= (0.85 + 0.30 * tcNz(vWPos, 14.0, fw)) * (0.95 + 0.10 * bed);
    col = mix(col, vec3(0.52, 0.48, 0.34), 0.55 * smoothstep(0.88, 0.97, tcNz(vWPos + 5.0, 0.9, fw)));
    tcRough = -0.35;
  } else if (uKind < 3.5) {
    float cr = 1.0 - smoothstep(0.03, 0.09 + fw * 0.02, tcRidge(vWPos, 22.0, fw));
    tone *= (0.80 + 0.30 * g1 + 0.10 * tcNz(vWPos, 3.0, fw)) * (1.0 - 0.45 * cr);
    h -= 1.4 * cr;
  } else {
    tone *= 0.80 + 0.30 * tcNz(vWPos, 8.0, fw) + 0.25 * (g1 - 0.5);
    vec3 q = vWPos / 3.0; vec3 id = floor(q); vec3 f = fract(q) - 0.5;
    float rr = 0.16 + 0.16 * tcH(id + 1.7);
    float blob = step(0.82, tcH(id)) * (1.0 - smoothstep(rr * 0.75, rr, length(f))) * (1.0 - smoothstep(2.0, 6.0, fw));
    col = mix(col, vec3(0.34, 0.30, 0.24) * (0.8 + 0.4 * tcH(id + 9.0)), blob);
    h += 0.9 * blob;
  }
  col *= tone;
  float top = smoothstep(0.6, 0.92, n0.y) * uTopK;
  if (top > 0.0) {
    float blade = tcNz(vec3(vWPos.x * 2.5, vWPos.y, vWPos.z * 2.5), 1.0, fw) * 0.5 + tcNz(vWPos, 0.5, fw) * 0.5;
    vec3 gc = mix(uTop * 0.7, uTop * 1.25, tcNz(vWPos, 30.0, fw)) * (0.75 + 0.5 * blade);
    gc = mix(gc, vec3(0.26, 0.21, 0.06), 0.35 * smoothstep(0.55, 0.8, tcNz(vWPos + 3.0, 18.0, fw)));
    col = mix(col, gc, top);
    h = mix(h, 1.6 * blade, top);
  }
  diffuseColor.rgb = col;
  tcHeight = h;
}
`;

/** Gỗ tràm: vỏ nâu xám có thớ dọc thân, đốm sẫm, phần dưới ẩm sẫm hơn. */
const GLSL_WOOD = `
{
  float fw = length(fwidth(vWPos));
  vec3 q = vec3(vWPos.x * 1.6, vWPos.y * 0.07, vWPos.z * 1.6);
  float grain = tcNz(q, 1.0, fw);
  float fibre = tcNz(vec3(vWPos.x * 6.0, vWPos.y * 0.25, vWPos.z * 6.0), 1.0, fw);
  float knot = smoothstep(0.80, 0.93, tcNz(vWPos + 7.7, 4.0, fw));
  float damp = smoothstep(0.0, -220.0, vWPos.y);
  float tone = (0.72 + 0.45 * grain + 0.18 * (fibre - 0.5)) * (1.0 - 0.35 * knot) * (1.0 - 0.22 * damp);
  // mặt cắt đầu cừ: gỗ sáng màu
  float cut = smoothstep(0.75, 0.95, normalize(vWNrm).y);
  diffuseColor.rgb = mix(diffuseColor.rgb * tone, vec3(0.62, 0.45, 0.25) * (0.85 + 0.3 * grain), cut);
  tcHeight = 0.5 * fibre + 0.6 * grain - 0.8 * knot;
  tcRough = 0.05 * (grain - 0.5);
}
`;

/** Làm lệch pháp tuyến theo độ cao thủ tục (bump) – cùng công thức với bump map của three.js. */
const GLSL_BUMP = `
{
  vec3 tcSp = -vViewPosition;
  vec3 tcDx = dFdx(tcSp), tcDy = dFdy(tcSp);
  float tcHx = dFdx(tcHeight), tcHy = dFdy(tcHeight);
  vec3 tcR1 = cross(tcDy, normal), tcR2 = cross(normal, tcDx);
  float tcDet = dot(tcDx, tcR1);
  vec3 tcGrad = sign(tcDet) * (tcHx * tcR1 + tcHy * tcR2);
  normal = normalize(abs(tcDet) * normal - uBump * tcGrad);
}
`;

type Uni = { value: number | THREE.Color | THREE.Vector3 };

function proceduralMaterial(
  base: THREE.MeshStandardMaterialParameters,
  body: string,
  uniforms: Record<string, Uni>,
  decl: string,
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial(base);
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + GLSL_VARY_VS)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = transformed; vWNrm = normal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + GLSL_NOISE + decl)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + body)
      .replace(
        '#include <roughnessmap_fragment>',
        '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor + tcRough, 0.05, 1.0);',
      )
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + GLSL_BUMP);
  };
  // các biến thể (mode / kind) dùng chung một chương trình; giá trị đi qua uniform
  mat.customProgramCacheKey = () => 'tc-proc-' + decl.length + '-' + body.length;
  return mat;
}

function srgb(r: number, g: number, b: number): THREE.Color {
  return new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
}

function meshGeometry(M: { p: number[]; n: number[]; i: number[] }): THREE.BufferGeometry | null {
  if (!M.p.length || !M.i.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(M.p, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(M.n, 3));
  g.setIndex(M.p.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(M.i, 1) : new THREE.Uint16BufferAttribute(M.i, 1));
  return g;
}

/** Bộ ảnh vật liệu chụp thật (CC0, Poly Haven): màu, pháp tuyến, và ảnh gộp AO (R) / độ nhám (G). */
interface TexSet {
  d: THREE.Texture;
  n: THREE.Texture;
  arm: THREE.Texture;
}

type TexName = 'conc' | 'mud' | 'sand' | 'grass' | 'bark';
const TEX_NAMES: TexName[] = ['conc', 'mud', 'sand', 'grass', 'bark'];
/** Màu trung bình (tuyến tính) của từng ảnh màu – dùng để nhuộm vật liệu về đúng màu lớp đất / bê tông. */
const TEX_MEAN: Record<TexName, [number, number, number]> = {
  conc: [0.2659, 0.2365, 0.1613],
  mud: [0.0749, 0.0588, 0.0387],
  sand: [0.2229, 0.1701, 0.1061],
  grass: [0.3099, 0.2287, 0.1005],
  bark: [0.1174, 0.0958, 0.056],
};
/** Kích thước một ô ảnh ngoài thực tế (cm). */
const TEX_SIZE: Record<TexName, number> = { conc: 420, mud: 220, sand: 200, grass: 260, bark: 70 };

/** Màu nhân với ảnh để trung bình của bề mặt ra đúng `target` (tuyến tính); `k` < 1 giữ lại một phần sắc độ gốc của ảnh. */
export function tintTo(target: THREE.Color, name: TexName, k = 1): THREE.Color {
  const m = TEX_MEAN[name];
  const f = (t: number, mean: number) => Math.min(4, Math.pow(Math.max(1e-3, t) / mean, k));
  return new THREE.Color(f(target.r, m[0]), f(target.g, m[1]), f(target.b, m[2]));
}

interface TexGeo {
  geo: THREE.BufferGeometry;
  /** Các mặt hướng lên, tách thành lưới riêng khi `splitTop` (mỗi lưới một vật liệu). */
  top: THREE.BufferGeometry | null;
}

/**
 * Dựng lưới cho vật liệu ảnh: tách tam giác (không dùng chỉ số), gán UV theo phép chiếu hộp (mặt phẳng
 * chiếu theo trục trội của pháp tuyến mặt, 1 đơn vị UV = `size` cm) và – khi `bevel` – dữ liệu bo cạnh:
 * với mỗi cạnh "gãy" của tam giác, khoảng cách tới cạnh (aEd) và pháp tuyến trung bình của hai mặt kề (aB0..2).
 * `splitTop` xếp các mặt hướng lên ra cuối để gán vật liệu riêng (cỏ).
 */
export function texGeometry(
  M: { p: number[]; n: number[]; i: number[] },
  size: number,
  opt: { bevel?: boolean; splitTop?: boolean } = {},
): TexGeo | null {
  const P = M.p;
  const N = M.n;
  const I = M.i;
  const nt = Math.floor(I.length / 3);
  if (!nt || !P.length) return null;
  const fn = new Float32Array(nt * 3);
  const area2 = new Float32Array(nt);
  for (let t = 0; t < nt; t++) {
    const a = I[t * 3] * 3;
    const b = I[t * 3 + 1] * 3;
    const c = I[t * 3 + 2] * 3;
    const ux = P[b] - P[a];
    const uy = P[b + 1] - P[a + 1];
    const uz = P[b + 2] - P[a + 2];
    const vx = P[c] - P[a];
    const vy = P[c + 1] - P[a + 1];
    const vz = P[c + 2] - P[a + 2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    area2[t] = len;
    if (len > 1e-12) {
      nx /= len;
      ny /= len;
      nz /= len;
    }
    fn[t * 3] = nx;
    fn[t * 3 + 1] = ny;
    fn[t * 3 + 2] = nz;
  }

  // cạnh dùng chung giữa các tam giác (so theo vị trí đã làm tròn)
  const edges = new Map<string, number[]>();
  const vk = (i: number) => `${Math.round(P[i * 3] * 20)},${Math.round(P[i * 3 + 1] * 20)},${Math.round(P[i * 3 + 2] * 20)}`;
  const ek = (a: number, b: number) => {
    const ka = vk(a);
    const kb = vk(b);
    return ka < kb ? ka + '|' + kb : kb + '|' + ka;
  };
  if (opt.bevel) {
    for (let t = 0; t < nt; t++) {
      for (let k = 0; k < 3; k++) {
        const key = ek(I[t * 3 + ((k + 1) % 3)], I[t * 3 + ((k + 2) % 3)]);
        const arr = edges.get(key);
        if (arr) arr.push(t);
        else edges.set(key, [t]);
      }
    }
  }

  const order: number[] = [];
  const tops: number[] = [];
  for (let t = 0; t < nt; t++) {
    if (opt.splitTop && fn[t * 3 + 1] > 0.6) tops.push(t);
    else order.push(t);
  }
  const all = order.concat(tops);
  const pos = new Float32Array(nt * 9);
  const nor = new Float32Array(nt * 9);
  const uv = new Float32Array(nt * 6);
  const ed = opt.bevel ? new Float32Array(nt * 9) : null;
  const bn = opt.bevel ? [new Float32Array(nt * 9), new Float32Array(nt * 9), new Float32Array(nt * 9)] : null;

  all.forEach((t, o) => {
    const fx = fn[t * 3];
    const fy = fn[t * 3 + 1];
    const fz = fn[t * 3 + 2];
    const ax = Math.abs(fx);
    const ay = Math.abs(fy);
    const az = Math.abs(fz);
    for (let k = 0; k < 3; k++) {
      const vi = I[t * 3 + k] * 3;
      const x = P[vi];
      const y = P[vi + 1];
      const z = P[vi + 2];
      pos.set([x, y, z], o * 9 + k * 3);
      nor.set([N[vi], N[vi + 1], N[vi + 2]], o * 9 + k * 3);
      if (ay >= ax && ay >= az) uv.set([x / size, z / size], o * 6 + k * 2);
      else if (ax >= az) uv.set([z / size, y / size], o * 6 + k * 2);
      else uv.set([x / size, y / size], o * 6 + k * 2);
    }
    if (ed && bn) {
      for (let k = 0; k < 3; k++) {
        const a = I[t * 3 + ((k + 1) % 3)];
        const b = I[t * 3 + ((k + 2) % 3)];
        const other = (edges.get(ek(a, b)) || []).filter((x) => x !== t);
        let hard = false;
        let bx = fx;
        let by = fy;
        let bz = fz;
        if (other.length === 1) {
          const u = other[0];
          const dot = fx * fn[u * 3] + fy * fn[u * 3 + 1] + fz * fn[u * 3 + 2];
          if (dot < 0.94 && dot > -0.2) {
            hard = true;
            bx = fx + fn[u * 3];
            by = fy + fn[u * 3 + 1];
            bz = fz + fn[u * 3 + 2];
            const l = Math.hypot(bx, by, bz) || 1;
            bx /= l;
            by /= l;
            bz /= l;
          }
        }
        const el = Math.hypot(P[a * 3] - P[b * 3], P[a * 3 + 1] - P[b * 3 + 1], P[a * 3 + 2] - P[b * 3 + 2]);
        const h = el > 1e-9 ? area2[t] / el : 0;
        for (let j = 0; j < 3; j++) {
          // thành phần k của aEd = khoảng cách tới cạnh đối diện đỉnh k (đỉnh k: chiều cao; hai đỉnh còn lại: 0)
          ed[o * 9 + j * 3 + k] = hard ? (j === k ? h : 0) : 1e4;
          bn[k].set([bx, by, bz], o * 9 + j * 3);
        }
      }
    }
  });

  // cắt các mảng theo khoảng tam giác [t0, t1) thành một lưới
  const part = (t0: number, t1: number): THREE.BufferGeometry | null => {
    if (t1 <= t0) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos.slice(t0 * 9, t1 * 9), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor.slice(t0 * 9, t1 * 9), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv.slice(t0 * 6, t1 * 6), 2));
    if (ed && bn) {
      geo.setAttribute('aEd', new THREE.BufferAttribute(ed.slice(t0 * 9, t1 * 9), 3));
      geo.setAttribute('aB0', new THREE.BufferAttribute(bn[0].slice(t0 * 9, t1 * 9), 3));
      geo.setAttribute('aB1', new THREE.BufferAttribute(bn[1].slice(t0 * 9, t1 * 9), 3));
      geo.setAttribute('aB2', new THREE.BufferAttribute(bn[2].slice(t0 * 9, t1 * 9), 3));
    }
    return geo;
  };
  const geo = part(0, order.length);
  const top = part(order.length, nt);
  if (!geo) return top ? { geo: top, top: null } : null;
  return { geo, top };
}

/** Lưới thân tròn (cừ tràm): giữ chỉ số, UV quấn quanh thân theo hướng pháp tuyến và chạy dọc theo cao độ. */
function cylGeometry(M: { p: number[]; n: number[]; i: number[] }, size: number): THREE.BufferGeometry | null {
  const g = meshGeometry(M);
  if (!g) return null;
  const nv = M.p.length / 3;
  const uv = new Float32Array(nv * 2);
  for (let i = 0; i < nv; i++) {
    const nx = M.n[i * 3];
    const ny = M.n[i * 3 + 1];
    const nz = M.n[i * 3 + 2];
    if (Math.abs(ny) > 0.8) {
      uv[i * 2] = M.p[i * 3] / (size * 0.4);
      uv[i * 2 + 1] = M.p[i * 3 + 2] / (size * 0.4);
    } else {
      uv[i * 2] = Math.atan2(nz, nx) / (2 * Math.PI) + 0.5;
      uv[i * 2 + 1] = M.p[i * 3 + 1] / size;
    }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

const GLSL_BEVEL_VS_DECL = `
attribute vec3 aEd; attribute vec3 aB0; attribute vec3 aB1; attribute vec3 aB2;
varying vec3 vEd; varying vec3 vB0; varying vec3 vB1; varying vec3 vB2;
`;
const GLSL_BEVEL_FS_DECL = `
varying vec3 vEd; varying vec3 vB0; varying vec3 vB1; varying vec3 vB2;
uniform float uBevR;
`;
/** Bo cạnh bằng pháp tuyến: gần cạnh gãy, pháp tuyến nghiêng dần về pháp tuyến trung bình của hai mặt kề. */
const GLSL_BEVEL_FS = `
{
  vec3 tcT = 1.0 - smoothstep(vec3(0.0), vec3(uBevR), vEd);
  float tcM = max(tcT.x, max(tcT.y, tcT.z));
  if (tcM > 0.001) {
    vec3 tcE = (vB0 * tcT.x + vB1 * tcT.y + vB2 * tcT.z) / max(1e-4, tcT.x + tcT.y + tcT.z);
    vec3 tcA = normalize(vWNrm) * (1.0 - tcM) + normalize(tcE) * tcM;
    normal = normalize(mat3(viewMatrix) * tcA) * faceDirection;
  }
}
`;

/**
 * Vật liệu PBR từ ảnh chụp thật (màu, pháp tuyến, AO + độ nhám) – chuẩn three.js, dùng UV có sẵn của lưới.
 * Thêm: biến thiên màu tần số thấp theo vị trí (đỡ lặp ô ảnh) và bo cạnh bằng pháp tuyến khi `bevelR` > 0.
 */
function texturedMaterial(
  set: TexSet,
  tint: THREE.Color,
  o: { side?: THREE.Side; bevelR?: number; normalScale?: number; envI?: number; macro?: number; detile?: boolean } = {},
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    map: set.d,
    normalMap: set.n,
    roughnessMap: set.arm,
    aoMap: set.arm,
    aoMapIntensity: 0.85,
    color: tint,
    roughness: 1,
    metalness: 0,
    side: o.side ?? THREE.FrontSide,
    envMapIntensity: o.envI ?? 0.9,
  });
  const ns = o.normalScale ?? 1;
  mat.normalScale.set(ns, ns);
  const bevel = (o.bevelR ?? 0) > 0;
  const uBevR = { value: o.bevelR ?? 0 };
  const uMacro = { value: o.macro ?? 0.26 };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uBevR = uBevR;
    sh.uniforms.uMacro = uMacro;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + GLSL_VARY_VS + (bevel ? GLSL_BEVEL_VS_DECL : ''))
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvWPos = transformed; vWNrm = normal;' +
          (bevel ? '\nvEd = aEd; vB0 = aB0; vB1 = aB1; vB2 = aB2;' : ''),
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\n' + GLSL_NOISE + 'uniform float uMacro;\n' + (bevel ? GLSL_BEVEL_FS_DECL : ''),
      )
      .replace(
        '#include <color_fragment>',
        '#include <color_fragment>\n{ float tcFw = length(fwidth(vWPos));\n' +
          '  float tcV = tcNz(vWPos, 310.0, tcFw) * 0.6 + tcNz(vWPos + 41.0, 90.0, tcFw) * 0.4;\n' +
          '  diffuseColor.rgb *= 1.0 + uMacro * (tcV - 0.5) * 2.0; }',
      );
    if (o.detile) {
      // phá hiện tượng lặp ô ảnh: trộn thêm một lần lấy mẫu ở tỉ lệ / vị trí khác theo vùng nhiễu lớn
      sh.fragmentShader = sh.fragmentShader.replace(
        '#include <map_fragment>',
        [
          '#include <map_fragment>',
          '#ifdef USE_MAP',
          '{ vec4 tcS2 = texture2D(map, vMapUv * 0.37 + vec2(0.31, 0.17));',
          '  float tcBl = smoothstep(0.38, 0.62, tcVn(vWPos / 470.0)) * 0.8;',
          '  diffuseColor.rgb *= mix(vec3(1.0), tcS2.rgb / max(sampledDiffuseColor.rgb, vec3(0.02)), tcBl); }',
          '#endif',
        ].join('\n'),
      );
    }
    if (bevel) {
      sh.fragmentShader = sh.fragmentShader.replace(
        '#include <normal_fragment_begin>',
        '#include <normal_fragment_begin>\n' + GLSL_BEVEL_FS,
      );
    }
  };
  mat.customProgramCacheKey = () => 'tc-tex-' + (bevel ? 'b' : 'p') + (o.detile ? 'd' : '');
  return mat;
}

function matsOf(mesh: THREE.Mesh): THREE.MeshStandardMaterial[] {
  const m = mesh.material;
  return (Array.isArray(m) ? m : [m]) as THREE.MeshStandardMaterial[];
}

function lineGeometry(l: number[]): THREE.BufferGeometry | null {
  if (!l.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(l, 3));
  return g;
}

interface ConcItem {
  key: 'lean' | 'conc' | 'pile';
  mode: number;
  col: THREE.Color;
  aK: number;
  back: THREE.Mesh;
  front: THREE.Mesh;
  pre: THREE.Mesh;
  edges: THREE.LineSegments | null;
  edgeCol: [THREE.Color, THREE.Color];
}

interface SoilItem {
  id: string | null;
  cover: boolean;
  mesh: THREE.Mesh;
  /** Mặt trên phủ cỏ (lưới riêng) – chỉ có ở chế độ vật liệu ảnh. */
  top: THREE.Mesh | null;
  edges: THREE.LineSegments | null;
}

interface GroupItem {
  gr: M3BarGroup;
  meshes: THREE.Mesh[];
  mat: THREE.MeshStandardMaterial;
  uScale: { value: number };
}

const KIND: Record<string, number> = { sand: 0, clay: 1, mud: 2, rock: 3, fill: 4 };
const BG_XRAY = srgb(0.129, 0.157, 0.188);
/** Màu trời (tuyến tính, trước tone mapping): thiên đỉnh → lưng chừng → chân trời. */
const SKY_TOP = new THREE.Color(0.07, 0.24, 0.82);
const SKY_MID = new THREE.Color(0.27, 0.52, 1.1);
const SKY_HOR = new THREE.Color(0.66, 0.84, 1.08);
interface WeatherPreset {
  sun: number;
  sunCol: number;
  /** Góc cao mặt trời (rad); null = theo ảnh HDRI. */
  el: number | null;
  env: number;
  expo: number;
  /** Sương: bắt đầu tại dist·nd + R·nr, đặc hẳn tại dist + R·fr. */
  nd: number;
  nr: number;
  fr: number;
  /** Mức ướt của bề mặt 0…1 và có mưa rơi không. */
  wet: number;
  rain: boolean;
  /** Màu vòm trời (tuyến tính): thiên đỉnh, lưng chừng, chân trời; null = dùng ảnh HDRI. */
  sky: [[number, number, number], [number, number, number], [number, number, number]] | null;
  glow: number;
}

const WEATHER: Record<V3Weather, WeatherPreset> = {
  sunny: { sun: 3.4, sunCol: 0xfff0dd, el: null, env: 1, expo: 1.05, nd: 1, nr: 4, fr: 13, wet: 0, rain: false, sky: null, glow: 0.55 },
  cloudy: {
    sun: 0.8, sunCol: 0xe8ecf2, el: null, env: 0.8, expo: 0.95, nd: 1, nr: 2.5, fr: 10, wet: 0, rain: false,
    sky: [[0.3, 0.34, 0.4], [0.5, 0.54, 0.6], [0.7, 0.73, 0.77]], glow: 0.12,
  },
  rain: {
    sun: 0.3, sunCol: 0xd5dde8, el: null, env: 0.55, expo: 0.92, nd: 1, nr: 1, fr: 7, wet: 1, rain: true,
    sky: [[0.15, 0.17, 0.21], [0.27, 0.3, 0.35], [0.42, 0.45, 0.49]], glow: 0,
  },
  sunset: {
    sun: 2.8, sunCol: 0xff9a4a, el: 0.16, env: 0.42, expo: 1.0, nd: 1, nr: 3, fr: 12, wet: 0, rain: false,
    sky: [[0.05, 0.09, 0.3], [0.5, 0.3, 0.3], [1.45, 0.72, 0.3]], glow: 1.6,
  },
  fog: {
    sun: 0.45, sunCol: 0xe9eef2, el: null, env: 0.9, expo: 1.0, nd: 0.5, nr: 0, fr: 2.6, wet: 0.35, rain: false,
    sky: [[0.6, 0.64, 0.68], [0.66, 0.69, 0.72], [0.7, 0.73, 0.75]], glow: 0,
  },
};
const RAIN_N = 1800;

const SUN_DIR = new THREE.Vector3(-0.58, 0.56, 0.6).normalize();

export class Scene3 implements Scene3Like {
  gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;

  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private persp = new THREE.PerspectiveCamera(35, 1, 1, 1e5);
  private orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 1e5);
  private sun = new THREE.DirectionalLight(0xffe9cc, 2.4);
  private hemi = new THREE.HemisphereLight(0xd6e6ff, 0x7a6f5c, 0.6);
  private fill = new THREE.DirectionalLight(0xffffff, 0);
  private skyTex: THREE.Texture | null = null;
  private envTex: THREE.Texture | null = null;
  private skyRT: THREE.WebGLCubeRenderTarget | null = null;
  private envRT: THREE.WebGLRenderTarget | null = null;
  private root = new THREE.Group();
  private floor: THREE.Mesh | null = null;
  private dome: THREE.Mesh | null = null;
  private grid: THREE.LineSegments | null = null;
  private conc: ConcItem[] = [];
  private soils: SoilItem[] = [];
  private groups: GroupItem[] = [];
  private cuMesh: THREE.Mesh | null = null;
  private hoverMesh: THREE.Mesh | null = null;
  private hoverScale = { value: 2 };
  private clipPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 1e9);
  private planes: THREE.Plane[];
  private uPxK = { value: 1 };
  private uPersp = { value: 1 };
  private uMinPx = { value: 0.9 };
  private lastShadow: boolean | null = null;
  /** Hậu kỳ (đổ bóng tiếp xúc GTAO) – chỉ dùng ở chế độ chân thực, phối cảnh, không cắt lát. */
  private composer: EffectComposer | null = null;
  private aoOk = true;
  private compSize = '';
  private model: Model3DData | null = null;
  private lastTubes: Map<M3BarGroup, Scene3TubeChunk[]> = new Map();
  onAssets: (() => void) | null = null;
  /** Bộ ảnh vật liệu – null cho tới khi nạp đủ (khi đó cảnh dùng vật liệu thủ tục). */
  private tex: Record<TexName, TexSet> | null = null;
  /** Bầu trời HDRI (nền + ánh sáng môi trường) – null cho tới khi nạp xong. */
  private hdrTex: THREE.Texture | null = null;
  private sunDir = SUN_DIR.clone();
  /** Góc xoay bầu trời HDRI quanh trục đứng (rad) để mặt trời trong ảnh trùng hướng nắng của cảnh. */
  private skyRot = 0;
  private fogCol = SKY_HOR.clone();
  private disposed = false;
  /** Trạng thái thời tiết đã áp vào cảnh (để chỉ cập nhật khi đổi). */
  private wxKey = '';
  private wetMats: Array<{ mat: THREE.MeshStandardMaterial; col: THREE.Color; rough: number }> = [];
  private rain: THREE.LineSegments | null = null;
  private rainSeed: Float32Array | null = null;
  animating = false;
  private R = 1000;
  private center = new THREE.Vector3();

  constructor(cv: HTMLCanvasElement) {
    // Tự xin ngữ cảnh WebGL2 trước: máy không hỗ trợ thì báo lỗi gọn (three.js sẽ ghi console.error nếu tự xin thất bại).
    const attrs: WebGLContextAttributes = {
      antialias: true,
      alpha: false,
      depth: true,
      stencil: false,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    };
    let ctx: WebGL2RenderingContext | null = null;
    try {
      ctx = cv.getContext('webgl2', attrs) as WebGL2RenderingContext | null;
    } catch {
      ctx = null;
    }
    if (!ctx) throw new Error('WebGL2 context unavailable');
    this.renderer = new THREE.WebGLRenderer({ canvas: cv, context: ctx, ...attrs });
    const r = this.renderer;
    this.gl = r.getContext();
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = 0.62;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.VSMShadowMap;
    r.localClippingEnabled = true;
    this.planes = [this.clipPlane];

    this.buildSky();
    this.loadAssets();

    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0002;
    this.sun.shadow.normalBias = 1.5;
    // bóng mềm: làm nhoè bản đồ bóng (VSM)
    this.sun.shadow.radius = 7;
    this.sun.shadow.blurSamples = 16;
    this.scene.add(this.sun, this.sun.target, this.hemi, this.fill, this.root);

    // vòm trời chuyển màu (đi theo camera, không ghi độ sâu)
    const dg = new THREE.SphereGeometry(1, 48, 24);
    dg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(dg.getAttribute('position').count * 3), 3));
    this.dome = new THREE.Mesh(
      dg,
      new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false, fog: false }),
    );
    this.dome.renderOrder = -100;
    this.dome.frustumCulled = false;
    this.scene.add(this.dome);
    this.paintDome(SKY_TOP, SKY_MID, SKY_HOR, SUN_DIR, 0.55, new THREE.Color(1.2, 1, 0.7));

    // mưa: các vệt ngắn rơi quanh mô hình (chỉ hiện khi thời tiết là mưa)
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RAIN_N * 6), 3));
    this.rainSeed = new Float32Array(RAIN_N * 4);
    for (let i = 0; i < RAIN_N * 4; i++) this.rainSeed[i] = Math.random();
    this.rain = new THREE.LineSegments(
      rg,
      new THREE.LineBasicMaterial({ color: 0xcfd8e3, transparent: true, opacity: 0.42, depthWrite: false }),
    );
    this.rain.frustumCulled = false;
    this.rain.renderOrder = 20;
    this.rain.visible = false;
    this.scene.add(this.rain);
  }

  /** Tô vòm trời chuyển màu: thiên đỉnh → lưng chừng → chân trời, kèm quầng sáng quanh hướng mặt trời. */
  private paintDome(top: THREE.Color, mid: THREE.Color, hor: THREE.Color, sun: THREE.Vector3, glowK: number, glowCol: THREE.Color): void {
    if (!this.dome) return;
    const g = this.dome.geometry;
    const pos = g.getAttribute('position');
    const col = g.getAttribute('color') as THREE.BufferAttribute;
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y <= 0) c.copy(hor);
      else if (y < 0.22) c.copy(hor).lerp(mid, Math.pow(y / 0.22, 0.7));
      else c.copy(mid).lerp(top, Math.min(1, (y - 0.22) / 0.6));
      const d = Math.max(0, pos.getX(i) * sun.x + y * sun.y + pos.getZ(i) * sun.z);
      const glow = Math.pow(d, 10) * glowK;
      col.setXYZ(i, c.r + glow * glowCol.r, c.g + glow * glowCol.g, c.b + glow * glowCol.b);
    }
    col.needsUpdate = true;
  }

  /** Áp thời tiết vào đèn, trời, sương, độ ướt bề mặt. Trả về preset đang dùng. */
  private applyWeather(wx: V3Weather, real: boolean): WeatherPreset {
    const w = WEATHER[real ? wx : 'sunny'];
    const key = `${real ? wx : 'x'}|${this.hdrTex ? 1 : 0}|${this.wetMats.length}|${this.sunDir.x.toFixed(3)}`;
    if (key === this.wxKey) return w;
    this.wxKey = key;
    // hướng nắng: giữ phương vị của cảnh, đổi góc cao nếu preset yêu cầu (hoàng hôn)
    const dir = this.sunDir.clone();
    if (w.el !== null) {
      const az = Math.atan2(this.sunDir.z, this.sunDir.x);
      dir.set(Math.cos(w.el) * Math.cos(az), Math.sin(w.el), Math.cos(w.el) * Math.sin(az));
    }
    this.placeSun(dir);
    this.sun.color.setHex(w.sunCol);
    if (w.sky) {
      const [t, m, h] = w.sky;
      this.paintDome(new THREE.Color(...t), new THREE.Color(...m), new THREE.Color(...h), dir, w.glow, new THREE.Color().setHex(w.sunCol));
    } else {
      this.paintDome(SKY_TOP, SKY_MID, SKY_HOR, dir, w.glow, new THREE.Color(1.2, 1, 0.7));
    }
    // bề mặt ướt: sẫm màu hơn và bóng hơn
    const dark = 1 - 0.3 * w.wet;
    this.wetMats.forEach((x) => {
      x.mat.color.copy(x.col).multiplyScalar(dark);
      x.mat.roughness = x.rough * (1 - 0.6 * w.wet);
    });
    return w;
  }

  private updateRain(f: Scene3Frame, on: boolean): void {
    const rain = this.rain;
    if (!rain || !this.rainSeed) return;
    rain.visible = on;
    this.animating = on;
    if (!on) return;
    const p = rain.geometry.getAttribute('position') as THREE.BufferAttribute;
    const a = p.array as Float32Array;
    const s = this.rainSeed;
    const R = this.R;
    const t = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
    const H = R * 3.2;
    const speed = 1500; // cm/s
    const len = Math.max(18, R * 0.035);
    const wx = 0.16;
    const wz = 0.07;
    for (let i = 0; i < RAIN_N; i++) {
      const x = f.target[0] + (s[i * 4] - 0.5) * R * 4.4;
      const z = f.target[2] + (s[i * 4 + 1] - 0.5) * R * 4.4;
      const fall = (s[i * 4 + 2] * H + t * speed * (0.8 + 0.4 * s[i * 4 + 3])) % H;
      const y = f.target[1] + R * 1.7 - fall;
      a[i * 6] = x - fall * wx;
      a[i * 6 + 1] = y;
      a[i * 6 + 2] = z - fall * wz;
      a[i * 6 + 3] = x - (fall + len) * wx;
      a[i * 6 + 4] = y - len;
      a[i * 6 + 5] = z - (fall + len) * wz;
    }
    p.needsUpdate = true;
  }

  /** Bầu trời tán xạ khí quyển dựng bằng mã: vừa làm nền, vừa làm ánh sáng môi trường (không cần file HDRI). */
  private buildSky(): void {
    const r = this.renderer;
    const sky = new Sky();
    sky.scale.setScalar(10000);
    const u = sky.material.uniforms;
    u.turbidity.value = 2.4;
    u.rayleigh.value = 1.9;
    u.mieCoefficient.value = 0.003;
    u.mieDirectionalG.value = 0.82;
    (u.sunPosition.value as THREE.Vector3).copy(SUN_DIR);
    const skyScene = new THREE.Scene();
    skyScene.add(sky);
    const tm = r.toneMapping;
    r.toneMapping = THREE.NoToneMapping;
    this.skyRT = new THREE.WebGLCubeRenderTarget(512, { type: THREE.HalfFloatType });
    const cube = new THREE.CubeCamera(1, 20000, this.skyRT);
    cube.update(r, skyScene);
    const pm = new THREE.PMREMGenerator(r);
    this.envRT = pm.fromCubemap(this.skyRT.texture);
    pm.dispose();
    r.toneMapping = tm;
    this.skyTex = this.skyRT.texture;
    this.envTex = this.envRT.texture;
    sky.geometry.dispose();
    sky.material.dispose();
  }

  /** Nạp ảnh vật liệu và bầu trời HDRI (không đồng bộ). Thiếu file / ngoại tuyến: giữ vật liệu thủ tục và vòm trời vẽ bằng mã. */
  private loadAssets(): void {
    if (typeof document === 'undefined') return;
    // Tài nguyên ở gốc site (`public/tex/`), KHÔNG tính từ đường dẫn trang: trang này nằm ở `/tuong-chan/`
    // nên `document.baseURI` + 'tex/' sẽ trỏ nhầm sang `/tuong-chan/tex/` (404 → HTML thay vì ảnh).
    const siteRoot = (import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
    const url = (f: string) => new URL(siteRoot.replace(/\/?$/, '/') + 'tex/' + f, document.baseURI).href;
    const aniso = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    const L = new THREE.TextureLoader();
    const out = {} as Record<TexName, TexSet>;
    let left = TEX_NAMES.length * 3;
    let failed = false;
    const done = () => {
      if (--left > 0 || failed || this.disposed) return;
      this.tex = out;
      this.rebuild();
    };
    TEX_NAMES.forEach((nm) => {
      const one = (suffix: string, color: boolean): THREE.Texture => {
        const t = L.load(url(`${nm}_${suffix}.jpg`), done, undefined, () => {
          failed = true;
        });
        t.wrapS = THREE.RepeatWrapping;
        t.wrapT = THREE.RepeatWrapping;
        t.anisotropy = aniso;
        if (color) t.colorSpace = THREE.SRGBColorSpace;
        return t;
      };
      out[nm] = { d: one('d', true), n: one('n', false), arm: one('arm', false) };
    });

    new RGBELoader().setDataType(THREE.FloatType).load(
      url('sky_1k.hdr'),
      (t) => {
        if (this.disposed) {
          t.dispose();
          return;
        }
        this.applyHdr(t);
        this.onAssets?.();
      },
      undefined,
      () => undefined,
    );
  }

  private rebuild(): void {
    if (this.model) this.setModel(this.model, this.lastTubes);
    this.onAssets?.();
  }

  /** Dùng ảnh HDRI làm nền + ánh sáng môi trường; dò điểm sáng nhất để đặt hướng mặt trời (bóng đổ khớp với trời). */
  private applyHdr(t: THREE.Texture): void {
    t.mapping = THREE.EquirectangularReflectionMapping;
    const pm = new THREE.PMREMGenerator(this.renderer);
    const rt = pm.fromEquirectangular(t);
    pm.dispose();
    this.envRT?.dispose();
    this.envRT = rt;
    this.envTex = rt.texture;
    this.hdrTex = t;

    const img = t.image as { data?: Float32Array; width: number; height: number };
    const d = img.data;
    if (d && img.width > 0 && img.height > 0) {
      const W = img.width;
      const H = img.height;
      const ch = Math.round(d.length / (W * H));
      let best = -1;
      let bi = 0;
      for (let i = 0; i < W * H; i++) {
        const lum = 0.2126 * d[i * ch] + 0.7152 * d[i * ch + 1] + 0.0722 * d[i * ch + 2];
        if (lum > best) {
          best = lum;
          bi = i;
        }
      }
      const row = Math.floor(bi / W);
      const col = bi % W;
      const topFirst = row < H / 2;
      // độ cao mặt trời lấy theo ảnh; phương vị thì xoay cả bầu trời quanh trục đứng để nắng tới từ hướng
      // đã chọn cho cảnh (SUN_DIR) – mặt trước tường được chiếu sáng, bóng đổ khớp với mặt trời trên nền trời
      const el = Math.min(1.2, Math.max(0.3, Math.abs((0.5 - (row + 0.5) / H) * Math.PI)));
      const azHdr = ((col + 0.5) / W - 0.5) * 2 * Math.PI;
      const azWant = Math.atan2(SUN_DIR.z, SUN_DIR.x);
      this.skyRot = azWant - azHdr;
      this.sunDir.set(Math.cos(el) * Math.cos(azWant), Math.sin(el), Math.cos(el) * Math.sin(azWant)).normalize();
      // màu sương = màu trời ngay trên đường chân trời
      const acc = [0, 0, 0];
      let n = 0;
      const band = Math.max(2, Math.round(H * 0.035));
      const r0 = topFirst ? Math.floor(H / 2) - band - 1 : Math.floor(H / 2) + 1;
      for (let r = Math.max(0, r0); r < Math.min(H, r0 + band); r++) {
        for (let c = 0; c < W; c += 4) {
          const k = (r * W + c) * ch;
          acc[0] += Math.min(3, d[k]);
          acc[1] += Math.min(3, d[k + 1]);
          acc[2] += Math.min(3, d[k + 2]);
          n++;
        }
      }
      if (n) this.fogCol.setRGB(acc[0] / n, acc[1] / n, acc[2] / n);
    }
    this.placeSun();
  }

  private placeSun(dir: THREE.Vector3 = this.sunDir): void {
    const R = this.R * 1.25;
    this.sun.target.position.copy(this.center);
    this.sun.position.copy(this.center).addScaledVector(dir, R * 3);
    const sc = this.sun.shadow.camera;
    sc.left = -R;
    sc.right = R;
    sc.top = R;
    sc.bottom = -R;
    sc.near = R * 0.5;
    sc.far = R * 6;
    sc.updateProjectionMatrix();
    this.sun.shadow.needsUpdate = true;
  }

  private clearModel(): void {
    const geos = new Set<THREE.BufferGeometry>();
    const mats = new Set<THREE.Material>();
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) geos.add(m.geometry);
      const mm = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mm)) mm.forEach((x) => mats.add(x));
      else if (mm) mats.add(mm);
    });
    geos.forEach((g) => g.dispose());
    mats.forEach((m) => m.dispose());
    this.root.clear();
    this.conc = [];
    this.soils = [];
    this.groups = [];
    this.floor = null;
    this.cuMesh = null;
    this.grid = null;
    this.hoverMesh = null;
  }

  private concMaterial(mode: number, col: THREE.Color, side: THREE.Side): THREE.MeshStandardMaterial {
    const mat = proceduralMaterial(
      { color: col, roughness: mode === 1 ? 0.95 : 0.86, metalness: 0, side, envMapIntensity: 0.9 },
      GLSL_CONC,
      { uMode: { value: mode }, uBump: { value: 1.0 } },
      'uniform float uMode; uniform float uBump;\n',
    );
    mat.clippingPlanes = this.planes;
    mat.clipShadows = true;
    return mat;
  }

  private soilMaterial(kind: number, col: THREE.Color, topK: number): THREE.MeshStandardMaterial {
    const mat = proceduralMaterial(
      { color: col, roughness: 0.97, metalness: 0, side: THREE.FrontSide, envMapIntensity: 0.6 },
      GLSL_SOIL,
      {
        uKind: { value: kind },
        uTopK: { value: topK },
        uTop: { value: srgb(0.3, 0.46, 0.17) },
        uBump: { value: 1.2 },
      },
      'uniform float uKind; uniform float uTopK; uniform vec3 uTop; uniform float uBump;\n',
    );
    mat.clippingPlanes = this.planes;
    mat.clipShadows = true;
    mat.polygonOffset = true;
    mat.polygonOffsetFactor = 1;
    mat.polygonOffsetUnits = 1;
    return mat;
  }

  private lineMaterial(): THREE.LineBasicMaterial {
    const m = new THREE.LineBasicMaterial({ transparent: true, depthWrite: false });
    m.clippingPlanes = this.planes;
    return m;
  }

  private tubeInject(mat: THREE.Material, uScale: { value: number }): void {
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uScale = uScale;
      sh.uniforms.uPxK = this.uPxK;
      sh.uniforms.uPersp = this.uPersp;
      sh.uniforms.uMinPx = this.uMinPx;
      sh.vertexShader = sh.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nattribute vec3 aO; attribute float aR;\nuniform float uScale; uniform float uPxK; uniform float uPersp; uniform float uMinPx;',
        )
        .replace(
          '#include <begin_vertex>',
          'vec4 tcC = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n' +
            'float tcPx = uPersp > 0.5 ? abs(tcC.w) * uPxK : uPxK;\n' +
            'float tcK = max(uScale, uMinPx * tcPx / aR);\n' +
            'vec3 transformed = position + aO * tcK;',
        );
    };
    mat.customProgramCacheKey = () => 'tc-tube';
  }

  setModel(model: Model3DData, tubes: Map<M3BarGroup, Scene3TubeChunk[]>): void {
    this.clearModel();
    this.model = model;
    this.lastTubes = tubes;
    const T = this.tex;
    const bb = model.bbox;
    const gY = model.ground && model.ground.length ? Math.min(...model.ground.map((g) => g.y0)) : bb.y0;
    const yMin = Math.min(bb.y0, gY) - 0.6;
    this.center.set((bb.x0 + bb.x1) / 2, (bb.y0 + bb.y1) / 2, (bb.z0 + bb.z1) / 2);
    this.R = 0.5 * Math.hypot(bb.x1 - bb.x0, bb.y1 - bb.y0, bb.z1 - bb.z0);

    // --- bê tông: mặt sau, mặt trước, lượt ghi độ sâu (dùng khi trong mờ) ---
    const concDefs: Array<[ConcItem['key'], number, THREE.Color, number, [THREE.Color, THREE.Color]]> = [
      ['lean', 1, srgb(0.66, 0.64, 0.58), 1.15, [srgb(0.62, 0.64, 0.66), srgb(0.2, 0.2, 0.2)]],
      ['conc', 0, srgb(0.64, 0.635, 0.61), 1, [srgb(0.78, 0.88, 0.98), srgb(0.16, 0.17, 0.19)]],
      ['pile', 2, srgb(0.6, 0.6, 0.58), 1.1, [srgb(0.86, 0.78, 0.6), srgb(0.18, 0.18, 0.18)]],
    ];
    concDefs.forEach(([key, mode, col, aK, edgeCol]) => {
      const src = model[key];
      if (!src) return;
      // có ảnh vật liệu: lưới có UV + bo cạnh (cọc tròn không bo); chưa có: vật liệu thủ tục như trước
      const tg = T ? texGeometry(src, TEX_SIZE.conc, { bevel: key !== 'pile' }) : null;
      const g = tg ? tg.geo : meshGeometry(src);
      if (!g) return;
      const mk = (side: THREE.Side): THREE.MeshStandardMaterial => {
        if (!T || !tg) return this.concMaterial(mode, col, side);
        const target = key === 'lean' ? new THREE.Color(0.34, 0.32, 0.27) : new THREE.Color(0.46, 0.445, 0.4);
        const m = texturedMaterial(T.conc, tintTo(target, 'conc', 0.8), {
          side,
          bevelR: key === 'pile' ? 0 : key === 'lean' ? 1.5 : 2.5,
          normalScale: key === 'lean' ? 1.6 : 1.1,
          macro: 0.16,
        });
        m.clippingPlanes = this.planes;
        m.clipShadows = true;
        return m;
      };
      const back = new THREE.Mesh(g, mk(THREE.BackSide));
      const front = new THREE.Mesh(g, mk(THREE.FrontSide));
      const preMat = new THREE.MeshBasicMaterial({ colorWrite: false, transparent: true, side: THREE.FrontSide });
      preMat.clippingPlanes = this.planes;
      const pre = new THREE.Mesh(g, preMat);
      back.renderOrder = 3;
      front.renderOrder = 4;
      pre.renderOrder = 5;
      front.castShadow = true;
      front.receiveShadow = true;
      back.receiveShadow = true;
      const lg = lineGeometry(src.l);
      const edges = lg ? new THREE.LineSegments(lg, this.lineMaterial()) : null;
      if (edges) edges.renderOrder = 2;
      this.root.add(back, front, pre);
      if (edges) this.root.add(edges);
      this.conc.push({ key, mode, col, aK, back, front, pre, edges, edgeCol });
    });

    // --- đất nền theo lớp + đất đắp ---
    const addSoil = (
      src: { p: number[]; n: number[]; i: number[]; l: number[] },
      col: THREE.Color,
      kind: number,
      topK: number,
      id: string | null,
      cover: boolean,
    ) => {
      let mesh: THREE.Mesh;
      let top: THREE.Mesh | null = null;
      const tg = T ? texGeometry(src, kind === 0 ? TEX_SIZE.sand : TEX_SIZE.mud, { bevel: true, splitTop: topK > 0 }) : null;
      if (T && tg) {
        const nm: TexName = kind === 0 ? 'sand' : 'mud';
        const soilMat = (set: TexSet, tint: THREE.Color, normalScale: number): THREE.MeshStandardMaterial => {
          const m = texturedMaterial(set, tint, { bevelR: 5, normalScale, envI: 0.55, macro: 0.3, detile: true });
          m.clippingPlanes = this.planes;
          m.clipShadows = true;
          m.polygonOffset = true;
          m.polygonOffsetFactor = 1;
          m.polygonOffsetUnits = 1;
          return m;
        };
        const side = soilMat(T[nm], tintTo(col, nm, 0.85), kind === 3 ? 2 : 1.2);
        mesh = new THREE.Mesh(tg.geo, side);
        if (tg.top) {
          top = new THREE.Mesh(tg.top, soilMat(T.grass, new THREE.Color(0.8, 1.02, 0.72), 1.4));
          top.renderOrder = 6;
          top.castShadow = true;
          top.receiveShadow = true;
          this.root.add(top);
        }
      } else {
        const g = meshGeometry(src);
        if (!g) return;
        mesh = new THREE.Mesh(g, this.soilMaterial(kind, col, topK));
      }
      mesh.renderOrder = 6;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const lg = lineGeometry(src.l);
      const edges = lg ? new THREE.LineSegments(lg, this.lineMaterial()) : null;
      if (edges) {
        edges.renderOrder = 7;
        (edges.material as THREE.LineBasicMaterial).depthWrite = false;
        (edges.material as THREE.LineBasicMaterial).color.copy(col).multiplyScalar(0.5);
        this.root.add(edges);
      }
      this.root.add(mesh);
      this.soils.push({ id, cover, mesh, top, edges });
    };
    (model.ground || []).forEach((gp) => {
      addSoil(gp.mesh, srgb(gp.color[0], gp.color[1], gp.color[2]), KIND[gp.look] ?? 1, gp.kind === 'cover' ? 1 : 0, gp.id, gp.kind === 'cover');
    });
    addSoil(model.soil, srgb(0.58, 0.43, 0.26), 4, 1, null, false);

    // --- cừ tràm: gỗ thủ tục, luôn đặc (thấy được khi đất trong mờ) ---
    if (model.cu) {
      const cg = T ? cylGeometry(model.cu, TEX_SIZE.bark) : meshGeometry(model.cu);
      if (cg) {
        const wm = T
          ? texturedMaterial(T.bark, new THREE.Color(1.5, 1.35, 1.2), { normalScale: 1.8, envI: 0.6, macro: 0.2 })
          : proceduralMaterial(
              { color: srgb(0.36, 0.25, 0.16), roughness: 0.9, metalness: 0, side: THREE.FrontSide, envMapIntensity: 0.6 },
              GLSL_WOOD,
              { uBump: { value: 0.9 } },
              'uniform float uBump;\n',
            );
        wm.clippingPlanes = this.planes;
        wm.clipShadows = true;
        this.cuMesh = new THREE.Mesh(cg, wm);
        this.cuMesh.castShadow = true;
        this.cuMesh.receiveShadow = true;
        this.cuMesh.frustumCulled = false;
        this.root.add(this.cuMesh);
      }
    }

    // --- cốt thép: ống có bán kính tối thiểu theo điểm ảnh, vật liệu thép có ánh kim ---
    model.groups.forEach((gr) => {
      const uScale = { value: 1 };
      const mat = new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0.55, envMapIntensity: 1.1 });
      mat.clippingPlanes = this.planes;
      this.tubeInject(mat, uScale);
      const meshes: THREE.Mesh[] = [];
      (tubes.get(gr) || []).forEach((c) => {
        if (!c.i.length) return;
        const ib = new THREE.InterleavedBuffer(c.v, 10);
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.InterleavedBufferAttribute(ib, 3, 0));
        g.setAttribute('aO', new THREE.InterleavedBufferAttribute(ib, 3, 3));
        g.setAttribute('normal', new THREE.InterleavedBufferAttribute(ib, 3, 6));
        g.setAttribute('aR', new THREE.InterleavedBufferAttribute(ib, 1, 9));
        g.setIndex(new THREE.BufferAttribute(c.i, 1));
        const mesh = new THREE.Mesh(g, mat);
        mesh.frustumCulled = false;
        mesh.receiveShadow = true;
        this.root.add(mesh);
        meshes.push(mesh);
      });
      this.groups.push({ gr, meshes, mat, uScale });
    });

    // --- thanh đang rê chuột: vẽ đè, không kiểm tra độ sâu ---
    const hMat = new THREE.MeshBasicMaterial({ color: srgb(1, 1, 0.85), depthTest: false, depthWrite: false, transparent: true });
    hMat.clippingPlanes = this.planes;
    this.tubeInject(hMat, this.hoverScale);
    this.hoverMesh = new THREE.Mesh(new THREE.BufferGeometry(), hMat);
    this.hoverMesh.frustumCulled = false;
    this.hoverMesh.renderOrder = 10;
    this.hoverMesh.visible = false;
    this.root.add(this.hoverMesh);

    // --- lưới nền ---
    const st = 100;
    const l: number[] = [];
    const xa = Math.floor((bb.x0 - 250) / st) * st;
    const xb = Math.ceil((bb.x1 + 250) / st) * st;
    const za = Math.floor((bb.z0 - 250) / st) * st;
    const zb = Math.ceil((bb.z1 + 250) / st) * st;
    for (let x = xa; x <= xb; x += st) l.push(x, yMin + 0.3, za, x, yMin + 0.3, zb);
    for (let z = za; z <= zb; z += st) l.push(xa, yMin + 0.3, z, xb, yMin + 0.3, z);
    const gg = lineGeometry(l);
    if (gg) {
      this.grid = new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ transparent: true, depthWrite: false }));
      this.grid.renderOrder = 1;
      this.root.add(this.grid);
    }

    // --- mặt sàn hứng bóng (chế độ chân thực) ---
    const fg = new THREE.CircleGeometry(this.R * 14, 96);
    fg.rotateX(-Math.PI / 2);
    // bãi cỏ trải rộng tới chân trời (mờ dần trong sương) thay cho sàn phẳng một màu
    let fm: THREE.MeshStandardMaterial;
    if (T) {
      // UV theo toạ độ thật (1 ô ảnh = TEX_SIZE.grass cm) thay cho UV 0…1 của hình tròn
      const fp = fg.getAttribute('position');
      const fuv = fg.getAttribute('uv');
      for (let i = 0; i < fp.count; i++) fuv.setXY(i, fp.getX(i) / TEX_SIZE.grass, fp.getZ(i) / TEX_SIZE.grass);
      fm = texturedMaterial(T.grass, new THREE.Color(0.8, 1.02, 0.72), { normalScale: 1.4, envI: 0.55, macro: 0.34, detile: true });
    } else {
      fm = this.soilMaterial(4, srgb(0.42, 0.33, 0.2), 1);
      fm.clippingPlanes = null;
      fm.polygonOffset = false;
    }
    this.floor = new THREE.Mesh(fg, fm);
    this.floor.position.set(this.center.x, yMin, this.center.z);
    this.floor.receiveShadow = true;
    this.root.add(this.floor);

    // --- mặt trời + khung bóng đổ ôm vừa mô hình (thời tiết sẽ đặt lại hướng nắng ở lần vẽ tới) ---
    this.placeSun();
    this.wxKey = '';
    this.wetMats = [];
    this.root.traverse((o) => {
      const me = o as THREE.Mesh;
      if (!me.isMesh || this.groups.some((g) => g.meshes.includes(me))) return;
      matsOf(me).forEach((mat) => {
        if (!(mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) return;
        if (this.wetMats.some((x) => x.mat === mat)) return;
        this.wetMats.push({ mat, col: mat.color.clone(), rough: mat.roughness });
      });
    });
  }

  render(f: Scene3Frame): void {
    const r = this.renderer;
    const m = this.model;
    if (!m) return;
    r.setPixelRatio(f.dpr);
    r.setSize(f.cssW, f.cssH, false);

    // camera (khớp ma trận v3m của V3 để chọn thanh / nhãn trùng với hình vẽ)
    const asp = f.cssW / Math.max(1, f.cssH);
    let cam: THREE.Camera;
    if (f.ortho) {
      const hh = f.dist * Math.tan(f.fov / 2);
      const c = this.orthoCam;
      c.left = -hh * asp;
      c.right = hh * asp;
      c.top = hh;
      c.bottom = -hh;
      c.near = f.near;
      c.far = f.far;
      if (f.offX || f.offY) c.setViewOffset(f.cssW, f.cssH, f.offX, f.offY, f.cssW, f.cssH);
      else c.clearViewOffset();
      c.updateProjectionMatrix();
      cam = c;
    } else {
      const c = this.persp;
      c.fov = (f.fov * 180) / Math.PI;
      c.aspect = asp;
      c.near = f.near;
      c.far = f.far;
      if (f.offX || f.offY) c.setViewOffset(f.cssW, f.cssH, f.offX, f.offY, f.cssW, f.cssH);
      else c.clearViewOffset();
      c.updateProjectionMatrix();
      cam = c;
    }
    cam.position.set(f.eye[0], f.eye[1], f.eye[2]);
    cam.up.set(0, 1, 0);
    cam.lookAt(f.target[0], f.target[1], f.target[2]);

    // mặt cắt
    this.clipPlane.normal.set(-f.clip[0], -f.clip[1], -f.clip[2]);
    this.clipPlane.constant = f.clip[3];
    if (this.clipPlane.normal.lengthSq() < 1e-12) {
      this.clipPlane.normal.set(0, 0, -1);
      this.clipPlane.constant = 1e9;
    }

    const real = f.look === 'real';
    const shadow = real;
    if (this.lastShadow !== shadow) {
      this.lastShadow = shadow;
      this.sun.castShadow = shadow;
    }
    const wx = this.applyWeather(f.weather ?? 'sunny', real);
    const skyOn = real && !f.ortho;
    const hdr = skyOn && !wx.sky ? this.hdrTex : null;
    const fogCol = wx.sky ? new THREE.Color(...wx.sky[2]) : this.fogCol;
    const domeOn = skyOn && !hdr;
    this.scene.background = hdr ?? (domeOn ? null : real ? fogCol : BG_XRAY);
    this.scene.backgroundIntensity = 1;
    // three.js xoay hướng tra cứu theo ma trận nghịch → góc dương ở đây quay bầu trời ngược chiều kim đồng hồ nhìn từ trên
    this.scene.backgroundRotation.set(0, hdr ? -this.skyRot : 0, 0);
    this.scene.environmentRotation.set(0, this.hdrTex ? -this.skyRot : 0, 0);
    if (this.dome) {
      this.dome.visible = domeOn;
      this.dome.position.set(f.eye[0], f.eye[1], f.eye[2]);
      this.dome.scale.setScalar(this.R * 24);
    }
    this.scene.environment = this.envTex;
    this.scene.environmentIntensity = real ? wx.env : 0.55;
    this.sun.intensity = real ? (this.hdrTex ? wx.sun : wx.sun * 0.85) : 1.6;
    this.hemi.intensity = real ? (this.hdrTex ? 0.15 : 0.5) : 0.9;
    // chế độ nhìn xuyên: thêm đèn theo camera để cốt thép luôn rõ
    this.fill.intensity = real ? 0 : 1.4;
    this.fill.position.set(f.eye[0], f.eye[1], f.eye[2]);
    r.toneMappingExposure = real ? (this.hdrTex ? wx.expo : wx.expo * 0.6) : 0.8;
    if (real && !f.ortho) {
      if (!(this.scene.fog instanceof THREE.Fog)) this.scene.fog = new THREE.Fog(0xffffff, 1, 2);
      const fog = this.scene.fog as THREE.Fog;
      fog.color.copy(fogCol);
      fog.near = f.dist * wx.nd + this.R * wx.nr;
      fog.far = f.dist + this.R * wx.fr;
    } else {
      this.scene.fog = null;
    }

    const a1 = 1 - f.surf;
    const opaque = a1 >= 0.98;

    this.conc.forEach((it) => {
      const on = it.key === 'lean' ? f.vis.blind : f.vis.conc;
      const a = Math.min(1, a1 * it.aK);
      const show = on && a > 0.003;
      const solid = opaque || a >= 0.98;
      const fm = it.front.material as THREE.MeshStandardMaterial;
      const bm = it.back.material as THREE.MeshStandardMaterial;
      it.front.visible = show;
      it.back.visible = show;
      it.pre.visible = show && !solid && a > 0.05;
      const side = solid ? THREE.DoubleSide : THREE.FrontSide;
      if (fm.transparent !== !solid || fm.side !== side) {
        fm.transparent = !solid;
        fm.depthWrite = solid;
        fm.side = side;
        fm.needsUpdate = true;
      }
      fm.opacity = solid ? 1 : a;
      if (!bm.transparent) {
        bm.transparent = true;
        bm.depthWrite = false;
        bm.needsUpdate = true;
      }
      bm.opacity = a;
      if (solid) it.back.visible = false;
      it.front.castShadow = shadow;
      if (it.edges) {
        const em = it.edges.material as THREE.LineBasicMaterial;
        // nét viền kiểu CAD chỉ hiện ở chế độ xem cốt thép; chế độ chân thực để khối tự lên hình bằng ánh sáng
        it.edges.visible = on && f.vis.edges && !real;
        em.color.copy(it.edgeCol[0]);
        em.opacity = 0.95;
      }
    });

    const oS = a1;
    this.soils.forEach((it) => {
      const on = it.id === null ? f.vis.soil : f.vis.strata && !f.hiddenGround.has(it.id);
      const a = it.cover ? Math.min(1, oS + 0.1) : oS;
      const solid = a >= 0.98;
      [it.mesh, it.top].forEach((me) => {
        if (!me) return;
        me.visible = on && a > 0.003;
        me.castShadow = shadow;
        matsOf(me).forEach((mat) => {
          if (mat.transparent !== !solid) {
            mat.transparent = !solid;
            mat.needsUpdate = true;
          }
          mat.opacity = solid ? 1 : a;
        });
      });
      it.mesh.castShadow = shadow;
      if (it.edges) {
        it.edges.visible = on && f.vis.edges && !real;
        (it.edges.material as THREE.LineBasicMaterial).opacity = 0.55;
      }
    });

    if (this.cuMesh) this.cuMesh.visible = f.vis.cu !== false;

    // cốt thép
    this.uPxK.value = f.pxK;
    this.uPersp.value = f.ortho ? 0 : 1;
    this.groups.forEach((it, gi) => {
      const id = it.gr.id || '';
      const dim = !!(f.focus && it.gr.id !== f.focus);
      const on = f.vis.rebar && !f.hidden.has(id);
      const c = f.colorOf(it.gr, gi);
      it.mat.color.setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace);
      if (it.mat.transparent !== dim) {
        it.mat.transparent = dim;
        it.mat.depthWrite = !dim;
        it.mat.needsUpdate = true;
      }
      it.mat.opacity = dim ? 0.16 : 1;
      it.uScale.value = dim ? f.kd : f.kd * (f.focus ? 1.5 : 1);
      it.meshes.forEach((me) => {
        me.visible = on;
        me.renderOrder = dim ? 9 : 0;
      });
    });

    // thanh đang rê chuột
    const hm = this.hoverMesh;
    if (hm) {
      hm.visible = false;
      const h = f.hover;
      if (h && f.vis.rebar && !f.hidden.has(h.gr.id || '')) {
        const it = this.groups.find((g) => g.gr === h.gr);
        const rg = h.gr.ranges?.[h.bi];
        const src = it && rg ? it.meshes[rg.ci] : undefined;
        if (src && rg) {
          const g = hm.geometry;
          if (g.index !== src.geometry.index) {
            g.setIndex(src.geometry.index);
            g.attributes = src.geometry.attributes;
          }
          g.setDrawRange(rg.i0, rg.n);
          this.hoverScale.value = Math.max(2, f.kd * 2.2);
          hm.visible = true;
        }
      }
    }

    if (this.grid) {
      const gm = this.grid.material as THREE.LineBasicMaterial;
      this.grid.visible = f.vis.grid && !real;
      gm.color.copy(srgb(0.3, 0.37, 0.44));
      gm.opacity = 0.55;
    }
    if (this.floor) this.floor.visible = real;

    this.updateRain(f, real && wx.rain && !f.ortho);

    const clipOn = this.clipPlane.constant < 1e8;
    // chế độ chân thực luôn đi qua bộ hậu kỳ (màu nhất quán); riêng đổ bóng tiếp xúc tắt khi cắt lát / trong mờ
    if (real && !f.ortho && this.aoOk) {
      try {
        this.renderAo(f, opaque && !clipOn && !f.focus);
        return;
      } catch (e) {
        // máy không đủ khả năng (thiếu float render target…): bỏ hậu kỳ, vẽ thẳng
        this.aoOk = false;
        this.composer = null;
        r.setRenderTarget(null);
        console.warn('3D: tắt hậu kỳ đổ bóng tiếp xúc –', e);
      }
    }
    r.render(this.scene, cam);
  }

  private gtao: GTAOPass | null = null;

  private renderAo(f: Scene3Frame, ao: boolean): void {
    const r = this.renderer;
    if (!this.composer) {
      const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
      const comp = new EffectComposer(r, rt);
      comp.addPass(new RenderPass(this.scene, this.persp));
      const gtao = new GTAOPass(this.scene, this.persp, 4, 4);
      // bán kính theo đơn vị mô hình (cm): bóng tiếp xúc ở chân tường, góc bản đáy, mép đất
      gtao.updateGtaoMaterial({ radius: 75, distanceExponent: 1.3, thickness: 1.4, scale: 1.15, samples: 12, screenSpaceRadius: false });
      gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
      gtao.blendIntensity = 0.85;
      comp.addPass(gtao);
      this.gtao = gtao;
      comp.addPass(new OutputPass());
      this.composer = comp;
      this.compSize = '';
    }
    const key = `${f.cssW}x${f.cssH}@${f.dpr}`;
    if (key !== this.compSize) {
      this.compSize = key;
      this.composer.setPixelRatio(f.dpr);
      this.composer.setSize(f.cssW, f.cssH);
    }
    if (this.gtao) this.gtao.enabled = ao;
    this.composer.render();
  }

  dispose(): void {
    this.disposed = true;
    this.clearModel();
    this.hdrTex?.dispose();
    if (this.tex) TEX_NAMES.forEach((k) => [this.tex![k].d, this.tex![k].n, this.tex![k].arm].forEach((t) => t.dispose()));
    this.composer?.dispose();
    this.composer = null;
    this.skyRT?.dispose();
    this.envRT?.dispose();
    this.renderer.dispose();
    this.model = null;
    this.gl = null;
  }
}
