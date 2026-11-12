import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { M3Mesh } from '../../src/model3d/index';
import { texGeometry, tintTo, V3_WEATHER_LABEL } from '../../src/model3d/scene3';
import { V3 } from '../../src/model3d/viewer3d';

/** Khối hộp 200 × 100 × 300 cm dựng bằng `M3Mesh.prism` (mặt phẳng, pháp tuyến theo từng mặt). */
function box(): M3Mesh {
  const m = new M3Mesh();
  m.prism(
    [
      [0, 0],
      [200, 0],
      [200, 100],
      [0, 100],
    ],
    0,
    300,
  );
  return m;
}

describe('scene3 – lưới cho vật liệu ảnh: UV chiếu hộp, bo cạnh, tách mặt trên', () => {
  it('UV = toạ độ thật / kích thước ô ảnh, theo trục trội của pháp tuyến mặt', () => {
    const tg = texGeometry(box(), 100)!;
    const pos = tg.geo.getAttribute('position');
    const nor = tg.geo.getAttribute('normal');
    const uv = tg.geo.getAttribute('uv');
    expect(pos.count % 3).toBe(0);
    expect(pos.count).toBe(36); // 12 tam giác, không dùng chỉ số
    for (let i = 0; i < pos.count; i++) {
      const [x, y, z] = [pos.getX(i), pos.getY(i), pos.getZ(i)];
      const [nx, ny, nz] = [Math.abs(nor.getX(i)), Math.abs(nor.getY(i)), Math.abs(nor.getZ(i))];
      const want = ny >= nx && ny >= nz ? [x / 100, z / 100] : nx >= nz ? [z / 100, y / 100] : [x / 100, y / 100];
      expect(uv.getX(i)).toBeCloseTo(want[0], 6);
      expect(uv.getY(i)).toBeCloseTo(want[1], 6);
    }
  });

  it('bo cạnh: cạnh gãy có khoảng cách 0 tại cạnh và pháp tuyến bo = trung bình hai mặt kề; đường chéo trong mặt thì không', () => {
    const tg = texGeometry(box(), 100, { bevel: true })!;
    const ed = tg.geo.getAttribute('aEd');
    const nor = tg.geo.getAttribute('normal');
    const b = [tg.geo.getAttribute('aB0'), tg.geo.getAttribute('aB1'), tg.geo.getAttribute('aB2')];
    let hard = 0;
    let soft = 0;
    for (let t = 0; t < ed.count / 3; t++) {
      for (let k = 0; k < 3; k++) {
        const d = [0, 1, 2].map((j) => ed.getComponent(t * 3 + j, k));
        if (d.every((v) => v > 9e3)) {
          soft++;
          continue;
        }
        hard++;
        // đỉnh đối diện cạnh k mang chiều cao tam giác, hai đỉnh nằm trên cạnh mang 0
        expect(d[k]).toBeGreaterThan(1);
        expect(d[(k + 1) % 3]).toBe(0);
        expect(d[(k + 2) % 3]).toBe(0);
        const bn = new THREE.Vector3(b[k].getX(t * 3), b[k].getY(t * 3), b[k].getZ(t * 3));
        const fn = new THREE.Vector3(nor.getX(t * 3), nor.getY(t * 3), nor.getZ(t * 3));
        expect(bn.length()).toBeCloseTo(1, 5);
        // hai mặt vuông góc → pháp tuyến bo lệch 45° so với pháp tuyến mặt
        expect(bn.dot(fn)).toBeCloseTo(Math.SQRT1_2, 5);
      }
    }
    // hộp: mỗi tam giác có 2 cạnh gãy + 1 đường chéo
    expect(hard).toBe(24);
    expect(soft).toBe(12);
  });

  it('tách mặt trên thành lưới riêng (mỗi lưới một vật liệu)', () => {
    const tg = texGeometry(box(), 100, { bevel: true, splitTop: true })!;
    expect(tg.top).not.toBeNull();
    const top = tg.top!.getAttribute('normal');
    expect(top.count).toBe(6);
    for (let i = 0; i < top.count; i++) expect(top.getY(i)).toBeGreaterThan(0.9);
    expect(tg.geo.getAttribute('position').count).toBe(30);
    expect(tg.geo.groups.length).toBe(0);
    expect(texGeometry({ p: [], n: [], i: [] }, 100)).toBeNull();
  });

  it('nhuộm màu: trung bình ảnh × màu nhân = màu đích (kẹp ≤ 4)', () => {
    const target = new THREE.Color(0.2, 0.2, 0.1);
    const c = tintTo(target, 'mud');
    expect(c.r * 0.0749).toBeCloseTo(0.2, 6);
    expect(c.g * 0.0588).toBeCloseTo(0.2, 6);
    expect(c.b * 0.0387).toBeCloseTo(0.1, 6);
    expect(tintTo(new THREE.Color(5, 5, 5), 'mud').r).toBe(4);
  });
});

describe('V3 – thời tiết (trạng thái)', () => {
  it('mặc định nắng đẹp; đổi thời tiết được truyền xuống lõi vẽ ở lần vẽ kế tiếp', async () => {
    expect(Object.keys(V3_WEATHER_LABEL)).toEqual(['sunny', 'cloudy', 'rain', 'sunset', 'fog']);
    const cv = document.createElement('canvas');
    const frames: Array<{ weather?: string }> = [];
    const fake = {
      gl: {} as WebGL2RenderingContext,
      animating: false,
      setModel: () => undefined,
      render: (f: { weather?: string }) => {
        frames.push(f);
      },
      dispose: () => undefined,
    };
    const orig = V3.sceneFactory;
    V3.sceneFactory = () => fake;
    try {
      const v = new V3();
      expect(v.weather).toBe('sunny');
      expect(v.attach(cv)).toBe(true);
      const { presetCanti, buildBars } = await import('../../src/engine/index');
      const p = presetCanti(500);
      v.setModel(p, buildBars(p));
      v.draw();
      expect(frames[frames.length - 1].weather).toBe('sunny');
      v.setWeather('rain');
      v.draw();
      expect(frames[frames.length - 1].weather).toBe('rain');
      v.setWeather('fog');
      v.draw();
      expect(frames[frames.length - 1].weather).toBe('fog');
      v.dispose();
    } finally {
      V3.sceneFactory = orig;
    }
  });
});
