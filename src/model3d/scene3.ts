/**
 * Lõi vẽ 3D bằng three.js (vật liệu PBR, bầu trời, ánh sáng môi trường, bóng đổ).
 * `V3` (viewer3d.ts) vẫn giữ camera, chọn thanh, sự kiện chuột; file này chỉ lo dựng cảnh và vẽ.
 * Đơn vị mô hình: cm. Trục y hướng lên.
 */
import * as THREE from 'three';
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
  colorOf: (gr: M3BarGroup, gi: number) => [number, number, number];
  colorMode: V3ColorMode;
}

export interface Scene3Like {
  gl: WebGLRenderingContext | WebGL2RenderingContext | null;
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
    const pos = dg.getAttribute('position');
    const col = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y <= 0) c.copy(SKY_HOR);
      else if (y < 0.22) c.copy(SKY_HOR).lerp(SKY_MID, Math.pow(y / 0.22, 0.7));
      else c.copy(SKY_MID).lerp(SKY_TOP, Math.min(1, (y - 0.22) / 0.6));
      // quầng sáng quanh hướng mặt trời
      const d = Math.max(0, pos.getX(i) * SUN_DIR.x + y * SUN_DIR.y + pos.getZ(i) * SUN_DIR.z);
      const glow = Math.pow(d, 10) * 0.55;
      col[i * 3] = c.r + glow * 1.2;
      col[i * 3 + 1] = c.g + glow;
      col[i * 3 + 2] = c.b + glow * 0.7;
    }
    dg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.dome = new THREE.Mesh(
      dg,
      new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false, fog: false }),
    );
    this.dome.renderOrder = -100;
    this.dome.frustumCulled = false;
    this.scene.add(this.dome);
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
      const g = meshGeometry(src);
      if (!g) return;
      const back = new THREE.Mesh(g, this.concMaterial(mode, col, THREE.BackSide));
      const front = new THREE.Mesh(g, this.concMaterial(mode, col, THREE.FrontSide));
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
      const g = meshGeometry(src);
      if (!g) return;
      const mesh = new THREE.Mesh(g, this.soilMaterial(kind, col, topK));
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
      this.soils.push({ id, cover, mesh, edges });
    };
    (model.ground || []).forEach((gp) => {
      addSoil(gp.mesh, srgb(gp.color[0], gp.color[1], gp.color[2]), KIND[gp.look] ?? 1, gp.kind === 'cover' ? 1 : 0, gp.id, gp.kind === 'cover');
    });
    addSoil(model.soil, srgb(0.58, 0.43, 0.26), 4, 1, null, false);

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
    const fm = this.soilMaterial(4, srgb(0.42, 0.33, 0.2), 1);
    fm.clippingPlanes = null;
    fm.polygonOffset = false;
    this.floor = new THREE.Mesh(fg, fm);
    this.floor.position.set(this.center.x, yMin, this.center.z);
    this.floor.receiveShadow = true;
    this.root.add(this.floor);

    // --- mặt trời + khung bóng đổ ôm vừa mô hình ---
    const R = this.R * 1.25;
    this.sun.target.position.copy(this.center);
    this.sun.position.copy(this.center).addScaledVector(SUN_DIR, R * 3);
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
    const domeOn = real && !f.ortho;
    this.scene.background = domeOn ? null : real ? SKY_HOR : BG_XRAY;
    if (this.dome) {
      this.dome.visible = domeOn;
      this.dome.position.set(f.eye[0], f.eye[1], f.eye[2]);
      this.dome.scale.setScalar(this.R * 24);
    }
    this.scene.environment = this.envTex;
    this.scene.environmentIntensity = real ? 1 : 0.55;
    this.sun.intensity = real ? 2.9 : 1.6;
    this.hemi.intensity = real ? 0.5 : 0.9;
    // chế độ nhìn xuyên: thêm đèn theo camera để cốt thép luôn rõ
    this.fill.intensity = real ? 0 : 1.4;
    this.fill.position.set(f.eye[0], f.eye[1], f.eye[2]);
    r.toneMappingExposure = real ? 0.62 : 0.8;
    if (real && !f.ortho) {
      if (!(this.scene.fog instanceof THREE.Fog)) this.scene.fog = new THREE.Fog(SKY_HOR, 1, 2);
      const fog = this.scene.fog as THREE.Fog;
      fog.near = f.dist + this.R * 4;
      fog.far = f.dist + this.R * 13;
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
      const mat = it.mesh.material as THREE.MeshStandardMaterial;
      it.mesh.visible = on && a > 0.003;
      const solid = a >= 0.98;
      if (mat.transparent !== !solid) {
        mat.transparent = !solid;
        mat.needsUpdate = true;
      }
      mat.opacity = solid ? 1 : a;
      it.mesh.castShadow = shadow;
      if (it.edges) {
        it.edges.visible = on && f.vis.edges && !real;
        (it.edges.material as THREE.LineBasicMaterial).opacity = 0.55;
      }
    });

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
    this.clearModel();
    this.composer?.dispose();
    this.composer = null;
    this.skyRT?.dispose();
    this.envRT?.dispose();
    this.renderer.dispose();
    this.model = null;
    this.gl = null;
  }
}
