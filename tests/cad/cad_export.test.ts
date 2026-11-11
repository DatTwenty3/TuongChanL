import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  barList,
  buildBars,
  presetCanti,
  presetKe,
  presetRib,
  presetWall4,
  quantities,
} from '../../src/engine';
import type { EngineProject } from '../../src/engine';
import {
  BG_DARK,
  DIMSTY,
  Ents,
  LAYERS,
  PAPER,
  SCALES,
  SHEET_DEFS,
  attachCadViewport,
  autoScale,
  buildAllSheets,
  buildSheet,
  dimRaw,
  dxfText,
  fitViewBox,
  panViewBox,
  resetDimId,
  settleDots,
  textW,
  toDXF,
  toSVG,
  zoomViewBox,
} from '../../src/cad';
import { buildCsvContent } from '../../src/export/csv';
import {
  M3Mesh,
  M3Tubes,
  V3,
  V3_FS_HEAD,
  V3_FS_LINE,
  V3_FS_MESH,
  V3_FS_TUBE,
  V3_PAL,
  V3_VIEWS,
  V3_VS_LINE,
  V3_VS_MESH,
  V3_VS_TUBE,
  m3Clean,
  m3Tri,
  model3D,
  v3ClipVec,
  v3Diff,
  v3Drawn,
  v3FormatInfo,
  v3FormatTip,
  v3GroupColor,
  v3Pick,
  v3m,
} from '../../src/model3d';
import type {
  BarsResult,
  CadCircleEntity,
  CadContext,
  CadSheet,
  M3BarGroup,
  Model3DData,
  QuantitiesResult,
} from '../../src/types/project';

describe('2D CAD Core Constants & Ents', () => {
  it('defines all 17 CAD layers with expected AutoCAD ACI codes and linetypes', () => {
    const keys = Object.keys(LAYERS);
    expect(keys).toHaveLength(17);
    expect(LAYERS.OUT).toMatchObject({ n: 'BT_CHUNG', ac: 7, lw: 0.35 });
    expect(LAYERS.HID).toMatchObject({ n: 'DUONG_KHUAT', ac: 160, lt: 'D' });
    expect(LAYERS.AXIS).toMatchObject({ n: 'TRUC', ac: 1, lt: 'X' });
    expect(LAYERS.REB).toMatchObject({ n: 'THEP', ac: 1, lw: 0.25 });
    expect(LAYERS.DIM).toMatchObject({ n: 'KICH_THUOC', ac: 8 });
    expect(LAYERS.NOTE).toMatchObject({ n: 'GHI_CHU', ac: 3 });
    expect(PAPER.A1).toEqual([841, 594]);
    expect(SCALES).toContain(50);
    expect(DIMSTY.B.wf).toBe(0.75);
    expect(DIMSTY.A.txt).toBe(2);
    expect(textW('Đà neo', 10)).toBeGreaterThan(0);
  });

  it('tracks geometry entities, excludes DM from bbox, and accounts for rotated text', () => {
    resetDimId(0);
    const E = new Ents();
    E.rect(10, 20, 100, 50, 'OUT');
    E.circ(60, 45, 5, 'RDOT', { fill: true, rMin: 1 });
    E.arrow(0, 0, 1, 0, 10, 3, 'DIM');
    E.text(120, 40, 'MẶT CẮT', 10, 'NOTE', { al: 'l', rot: 90 });

    const ctx: CadContext = {
      S: 50,
      mm: (v) => v * 5,
      dst: DIMSTY.B,
      legFull: false,
      geoHit: true,
      tplA: false,
      tang: true,
      dotLy: 'RDOTW',
      rDot: 0.6,
      rCap: 6,
    };
    dimRaw(E, [10, 20], [110, 20], [10, 5], [110, 5], '1000', ctx);
    expect(E.a.some((e) => e.k === 'DM' && e.id === 1)).toBe(true);
    expect(E.a.some((e) => e.k !== 'DM' && e.dm === 1)).toBe(true);

    const bb = E.bbox();
    expect(bb.x0).toBeLessThanOrEqual(0);
    expect(bb.x1).toBeGreaterThanOrEqual(120);
    expect(bb.y1).toBeGreaterThan(45);
  });

  it('separates overlapping rebar dots in settleDots away from REB/OUT walls', () => {
    const E = new Ents();
    E.rect(0, 0, 100, 100, 'OUT');
    E.poly(
      [
        [5, 5],
        [95, 5],
      ],
      'REB',
      { w: 2 },
    );
    // Overlapping dots resting too close to the REB bar center y=5
    E.circ(50, 5.2, 1.5, 'RDOTW', { fill: true, rMin: 0.8 });
    E.circ(50.3, 5.2, 1.5, 'RDOTW', { fill: true, rMin: 0.8 });
    const ctx: CadContext = {
      S: 50,
      mm: (v) => v * 5,
      dst: DIMSTY.B,
      legFull: false,
      geoHit: true,
      tplA: false,
      tang: true,
      dotLy: 'RDOTW',
      rDot: 0.6,
      rCap: 6,
    };
    settleDots(E, ctx);

    const dots = E.a.filter((e): e is CadCircleEntity => e.k === 'C' && e.fill);
    expect(dots).toHaveLength(2);
    const d = Math.hypot(dots[0].x - dots[1].x, dots[0].y - dots[1].y);
    expect(d).toBeGreaterThan(0.3);
    dots.forEach((dot) => {
      // Should be pushed clear of REB centerline y=5
      expect(Math.abs(dot.y - 5)).toBeGreaterThanOrEqual(1.8);
    });
  });
});

describe('5-Sheet CAD Engine & SVG/DXF/CSV Exporters Across All 4 Templates', () => {
  const templates = [
    { name: 'Template B (cantilever)', make: () => presetCanti(500) },
    { name: 'Template A (rib + beam)', make: () => presetRib() },
    { name: 'Template C (ke block)', make: () => presetKe({}, 0) },
    { name: 'Template D (anchored wall)', make: () => presetWall4({}, 1) },
  ] as const;

  it('defines 5 CAD sheets with noScale on sheets 4 and 5', () => {
    expect(SHEET_DEFS).toHaveLength(5);
    expect(SHEET_DEFS.map((d) => d.name)).toEqual([
      'CHI TIẾT TƯỜNG CHẮN',
      'BỐ TRÍ THÉP TƯỜNG CHẮN (1)',
      'BỐ TRÍ THÉP TƯỜNG CHẮN (2)',
      'CHI TIẾT CÁC THANH THÉP',
      'BẢNG THỐNG KÊ KHỐI LƯỢNG',
    ]);
    expect(SHEET_DEFS[0].noScale).toBeFalsy();
    expect(SHEET_DEFS[3].noScale).toBe(true);
    expect(SHEET_DEFS[4].noScale).toBe(true);
  });

  for (const tpl of templates) {
    it(`builds all 5 CAD sheets and exports SVG/DXF/CSV cleanly for ${tpl.name}`, () => {
      const p = tpl.make();
      const res = buildBars(p);
      const q = quantities(p, res);
      const sheets = buildAllSheets(p, res, q);

      expect(sheets).toHaveLength(5);
      sheets.forEach((sh) => {
        expect(sh.W).toBeGreaterThan(0);
        expect(sh.H).toBeGreaterThan(0);
        expect(sh.S).toBeGreaterThan(0);
        expect(sh.E.a.length).toBeGreaterThan(15);
      });

      const s1 = buildSheet(p, res, q, 0, sheets[0].S);
      expect(s1.E.a.some((e) => e.k === 'DM')).toBe(true);
      expect(s1.E.a.length).toBe(sheets[0].E.a.length);

      const darkSvg = toSVG(sheets[0], { theme: 'dark' });
      const lightSvg = toSVG(sheets[0], { theme: 'light' });
      expect(darkSvg.startsWith('<svg ')).toBe(true);
      expect(darkSvg.endsWith('</svg>')).toBe(true);
      expect(darkSvg).toContain(BG_DARK);
      expect(darkSvg).toContain('fill="#00ff00"');
      expect(lightSvg).toContain('#ffffff');
      expect(lightSvg).toContain('fill="#008000"');
      expect(lightSvg).toContain('stroke-dasharray');

      const singleDxf = toDXF([sheets[0]]);
      expect(singleDxf).toContain('$ACADVER\r\n1\r\nAC1009');
      expect(singleDxf).toContain('$INSUNITS\r\n70\r\n4');
      expect(singleDxf).toContain('BT_CHUNG');
      expect(singleDxf).toContain('THEP');
      expect(singleDxf).toContain('*D1');
      expect(singleDxf).toContain('DIMENSION');
      expect(singleDxf).toContain('SOLID');
      expect(singleDxf.trimEnd().endsWith('EOF')).toBe(true);

      const rebarSheetDxf = toDXF([sheets[1]]);
      expect(rebarSheetDxf).toContain('\r\n42\r\n1\r\n');

      const allDxf = toDXF(sheets, { gapMm: 50 });
      expect(allDxf).toContain('AC1009');
      expect(allDxf).toContain('BLOCKS');
      expect(allDxf).toContain('ENTITIES');
      expect(allDxf).toContain('*D1');
      expect(allDxf.length).toBeGreaterThan(singleDxf.length);

      const csv = buildCsvContent(res, q);
      expect(csv.startsWith('\ufeff')).toBe(true);
      expect(csv).toContain('\r\n');
      const lines = csv.slice(1).split('\r\n');
      expect(lines[0]).toContain('"Mac","Ten","D(mm)"');
      // 1 header + res.bars.length + 14 trailing summary/blank rows
      expect(lines.length).toBe(1 + res.bars.length + 14);
      expect(csv).toContain('"Tong"');
      expect(csv).toContain('"Van khuon (m2)"');
    });
  }

  it('escapes Vietnamese Unicode characters in DXF text', () => {
    expect(dxfText('MẶT CẮT Đ')).toContain('\\U+1EB6');
    expect(dxfText('MẶT CẮT Đ')).toContain('\\U+0110');
  });

  it('escapes double quotes in CSV fields and computes pan/zoom/fit CAD viewBox transitions', () => {
    const p = presetCanti(500);
    const res = buildBars(p);
    res.bars[0].name = 'Thep "chu" 1';
    const q = quantities(p, res);
    const csv = buildCsvContent(res, q);
    expect(csv).toContain('"Thep ""chu"" 1"');

    const vb0 = fitViewBox({ W: 1000, H: 600 });
    expect(vb0).toEqual({ x: 0, y: 0, w: 1000, h: 600 });
    const rect = { left: 0, top: 0, width: 1000, height: 600 };
    const zoomed = zoomViewBox(vb0, rect, 500, 300, -100);
    expect(zoomed.w).toBeCloseTo(850, 6);
    expect(zoomed.h).toBeCloseTo(510, 6);
    // Zooming around center keeps center fixed at (500, 300)
    expect(zoomed.x + zoomed.w / 2).toBeCloseTo(500, 6);
    expect(zoomed.y + zoomed.h / 2).toBeCloseTo(300, 6);

    const panned = panViewBox(zoomed, rect, 100, -50);
    expect(panned.x).toBeLessThan(zoomed.x);
    expect(panned.y).toBeGreaterThan(zoomed.y);

    const stage = document.createElement('div');
    stage.innerHTML = '<svg viewBox="0 0 1000 600"></svg>';
    vi.spyOn(stage, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 1000,
      bottom: 600,
      width: 1000,
      height: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    const ctrl = attachCadViewport(stage, () => ({ W: 1000, H: 600 }));
    stage.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, clientX: 500, clientY: 300, cancelable: true }));
    expect(ctrl.getViewBox()!.w).toBeCloseTo(850, 6);
    stage.dispatchEvent(new MouseEvent('dblclick'));
    expect(ctrl.getViewBox()).toEqual({ x: 0, y: 0, w: 1000, h: 600 });
    ctrl.dispose();
  });
});

describe('3D Structural & Rebar Engine + WebGL Pure Helpers', () => {
  it('triangulates clean polygons and extrudes prisms with optional edge filtering', () => {
    const cleaned = m3Clean([
      [0, 0],
      [5, 0],
      [10, 0],
      [10, 10],
      [10, 10],
      [0, 10],
    ]);
    expect(cleaned).toHaveLength(4);
    const tris = m3Tri(cleaned);
    expect(tris).toHaveLength(2);

    const m = new M3Mesh();
    m.prism(
      [
        [0, 0],
        [10, 0],
        [10, 5],
        [0, 5],
      ],
      0,
      20,
      { keep: (a, b) => a[1] === 5 || b[1] === 5 },
    );
    expect(m.p.length % 3).toBe(0);
    expect(m.n.length).toBe(m.p.length);
    expect(m.i.length).toBeGreaterThan(0);
    expect(m.l.length).toBe(4 * 3 * 6);
  });

  it('builds mitered tubes, splits sharp bends (< -0.85), and splits chunks on maxV', () => {
    const tubes = new M3Tubes(6, 60);
    const r1 = tubes.add(
      [
        [0, 0, 0],
        [10, 0, 0],
        [10, 20, 0],
        [0, 20, 0],
      ],
      0.8,
    );
    expect(r1).not.toBeNull();
    expect(r1!.ci).toBe(0);
    expect(r1!.n).toBeGreaterThan(0);

    // Sharp hairpin bend triggers part split cleanly without degenerate miter
    const rSharp = tubes.add(
      [
        [0, 0, 0],
        [20, 0, 0],
        [0, 0.1, 0],
      ],
      0.6,
    );
    expect(rSharp).not.toBeNull();

    // Force chunk overflow
    tubes.add(
      [
        [0, 5, 0],
        [10, 5, 0],
        [20, 5, 0],
        [30, 5, 0],
      ],
      0.8,
    );
    const chunks = tubes.finish();
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    chunks.forEach((ch) => {
      expect(ch.v).toBeInstanceOf(Float32Array);
      expect(ch.i).toBeInstanceOf(Uint16Array);
      expect(ch.v.length).toBe(ch.nv * 10);
      for (let k = 0; k < ch.i.length; k++) {
        expect(ch.i[k]).toBeLessThan(ch.nv);
      }
    });
  });

  it('generates full 3D concrete + rebar cage across Templates B, A, C, and D', () => {
    const cases = [presetCanti(500), presetRib(), presetKe({}, 0), presetWall4({}, 1)];
    for (const p of cases) {
      const res = buildBars(p);
      const m = model3D(p, res);
      expect(m.conc.p.length).toBeGreaterThan(0);
      expect(m.conc.i.length).toBeGreaterThan(0);
      expect(m.bbox.x1).toBe(res.g.B);
      expect(m.bbox.z1).toBe(p.Lu);
      expect(m.groups.length).toBeGreaterThan(3);
      m.groups.forEach((gr) => {
        expect(gr.id).toMatch(/^g\d+$/);
        expect(gr.R).toBeCloseTo(gr.d / 20, 6);
        expect(gr.bars.length).toBeGreaterThan(0);
      });
    }
  });

  it('computes clip vectors, view matrices, drawn diffs, tip formatting, and CPU ray picking', () => {
    const model: Model3DData = {
      conc: new M3Mesh(),
      lean: new M3Mesh(),
      soil: new M3Mesh(),
      bbox: { x0: 0, x1: 200, y0: -20, y1: 400, z0: 0, z1: 600 },
      sig: 'B|canti|400|600|200',
      groups: [
        {
          id: 'g0',
          key: 's1',
          mark: 1,
          name: 'Thép đứng sau',
          d: 16,
          R: 0.8,
          count: 10,
          bars: [
            [
              [100, 200, 300],
              [100, 350, 300],
            ],
          ],
          bs: [],
          segs: [100, 200, 300, 100, 350, 300],
          segBar: [0],
          ranges: [{ ci: 0, i0: 0, n: 24 }],
        },
        {
          id: 'g1',
          key: 'r2',
          mark: 9,
          name: 'Đai sườn',
          d: 12,
          R: 0.6,
          count: 4,
          per: 2,
          bars: [
            [
              [20, 20, 20],
              [40, 20, 20],
            ],
          ],
          bs: [{ key: 'r2', mark: 9, name: 'Đai sườn', d: 12, path: [], items: [1, 1, 1, 1], count: 4, minL: 1200, maxL: 1600, kg: 8.5 }],
          segs: [20, 20, 20, 40, 20, 20],
          segBar: [0],
        },
      ],
    };

    expect(v3ClipVec(model, { axis: '', t: 0.5, flip: false })).toEqual([0, 0, 0, 1]);
    expect(v3ClipVec(model, { axis: 'z', t: 0.5, flip: false })).toEqual([0, 0, 1, 300]);
    expect(v3ClipVec(model, { axis: 'y', t: 0.5, flip: true })).toEqual([-0, -1, -0, -190]);

    const gr0 = model.groups[0] as M3BarGroup;
    const gr1 = model.groups[1];
    expect(v3Drawn(gr1)).toBe(2);
    expect(v3Diff(gr1)).toBe(true);
    expect(v3FormatTip(gr1).summary).toContain('mỗi đai kín = 2 thanh');
    expect(v3GroupColor(gr0, 'cad')).toEqual([1, 0.2, 0.2]);
    expect(v3GroupColor(gr0, 'mark', 2)).toEqual(V3_PAL[2]);

    const proj = v3m.ortho(300, 300, -1000, 2000);
    const view = v3m.look([100, 275, 900], [100, 275, 300], [0, 1, 0]);
    const vp = v3m.mul(proj, view);
    const hit = v3Pick(
      {
        model,
        vp,
        W: 600,
        H: 600,
        pxK: 1,
        dpr: 1,
        kd: 1,
        vis: { rebar: true },
        hidden: new Set(),
        focus: null,
        cam: { ortho: true },
        clip: { axis: '', t: 1, flip: false },
      },
      300,
      300,
    );
    expect(hit).not.toBeNull();
    expect(hit!.id).toBe('g0');
    expect(hit!.bi).toBe(0);
    expect(hit!.r).toEqual({ ci: 0, i0: 0, n: 24 });

    // Clipped out when Z <= 250
    const clippedHit = v3Pick(
      {
        model,
        vp,
        W: 600,
        H: 600,
        pxK: 1,
        dpr: 1,
        kd: 1,
        vis: { rebar: true },
        hidden: new Set(),
        focus: null,
        cam: { ortho: true },
        clip: { axis: 'z', t: 250 / 600, flip: false },
      },
      300,
      300,
    );
    expect(clippedHit).toBeNull();

    const p = presetCanti(500);
    const res = buildBars(p);
    const q = quantities(p, res);
    expect(v3FormatInfo(p, res, q)).toContain('m³');
    expect(Object.keys(V3_VIEWS)).toHaveLength(6);

    const v3 = new V3();
    const cv = document.createElement('canvas');
    const getCtxSpy = vi.spyOn(cv, 'getContext').mockReturnValue(null);
    // Canvas without WebGL returns false gracefully with Vietnamese fallback message
    expect(v3.attach(cv)).toBe(false);
    expect(v3.errMsg).toContain('WebGL');
    getCtxSpy.mockRestore();
    v3.dispose();
  });

  it('handles webglcontextlost and webglcontextrestored cleanly and removes listeners on destroy()', () => {
    const cv = document.createElement('canvas');
    cv.width = 400;
    cv.height = 300;
    const removed: string[] = [];
    const origRemove = cv.removeEventListener.bind(cv);
    vi.spyOn(cv, 'removeEventListener').mockImplementation((type, listener, options) => {
      removed.push(type);
      return origRemove(type, listener, options);
    });

    const mockGl = {
      VERTEX_SHADER: 0x8b31,
      FRAGMENT_SHADER: 0x8b30,
      COMPILE_STATUS: 0x8b81,
      LINK_STATUS: 0x8b82,
      ACTIVE_UNIFORMS: 0x8b86,
      ARRAY_BUFFER: 0x8892,
      ELEMENT_ARRAY_BUFFER: 0x8893,
      STATIC_DRAW: 0x88e4,
      COLOR_BUFFER_BIT: 0x4000,
      DEPTH_BUFFER_BIT: 0x0100,
      DEPTH_TEST: 0x0b71,
      LEQUAL: 0x0203,
      CULL_FACE: 0x0b44,
      BLEND: 0x0be2,
      SRC_ALPHA: 0x0302,
      ONE_MINUS_SRC_ALPHA: 0x0303,
      FLOAT: 0x1406,
      UNSIGNED_SHORT: 0x1403,
      TRIANGLES: 0x0004,
      LINES: 0x0001,
      FRONT: 0x0404,
      BACK: 0x0405,
      createShader: () => ({}),
      shaderSource: () => undefined,
      compileShader: () => undefined,
      getShaderParameter: () => true,
      getShaderInfoLog: () => '',
      createProgram: () => ({}),
      attachShader: () => undefined,
      bindAttribLocation: () => undefined,
      linkProgram: () => undefined,
      getProgramParameter: (_p: unknown, pname: number) => (pname === 0x8b86 ? 0 : true),
      getProgramInfoLog: () => '',
      getActiveUniform: () => null,
      getUniformLocation: () => null,
      createBuffer: vi.fn(() => ({})),
      bindBuffer: () => undefined,
      bufferData: () => undefined,
      deleteBuffer: () => undefined,
      viewport: () => undefined,
      clearColor: () => undefined,
      clear: vi.fn(),
      enable: () => undefined,
      disable: () => undefined,
      depthFunc: () => undefined,
      depthMask: () => undefined,
      blendFunc: () => undefined,
      cullFace: () => undefined,
      colorMask: () => undefined,
      polygonOffset: () => undefined,
      useProgram: () => undefined,
      enableVertexAttribArray: () => undefined,
      disableVertexAttribArray: () => undefined,
      vertexAttribPointer: () => undefined,
      uniform1f: () => undefined,
      uniform3fv: () => undefined,
      uniform4fv: () => undefined,
      uniformMatrix4fv: () => undefined,
      drawElements: () => undefined,
      drawArrays: () => undefined,
    } as unknown as WebGLRenderingContext;

    const getCtxSpy = vi
      .spyOn(cv, 'getContext')
      .mockImplementation((kind) => (kind === 'webgl' ? mockGl : null) as never);

    const onChange = vi.fn();
    const v3 = new V3({ onChange });
    expect(v3.attach(cv)).toBe(true);
    expect(v3.ok).toBe(true);

    const p = presetCanti(500);
    const res = buildBars(p);
    const q = quantities(p, res);
    v3.setModel(p, res, q);
    const uploadsBeforeLoss = (mockGl.createBuffer as ReturnType<typeof vi.fn>).mock.calls.length;
    expect(uploadsBeforeLoss).toBeGreaterThan(0);

    const lostEv = new Event('webglcontextlost', { cancelable: true });
    cv.dispatchEvent(lostEv);
    expect(lostEv.defaultPrevented).toBe(true);
    expect(v3.ok).toBe(false);
    expect(v3.gl).toBeNull();
    expect(v3.errMsg).toContain('WebGL');
    expect(onChange).toHaveBeenCalled();

    const clearsBeforeRestore = (mockGl.clear as ReturnType<typeof vi.fn>).mock.calls.length;
    cv.dispatchEvent(new Event('webglcontextrestored'));
    expect(v3.ok).toBe(true);
    expect(v3.errMsg).toBe('');
    expect(v3.gl).toBe(mockGl);
    expect((mockGl.createBuffer as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(
      uploadsBeforeLoss,
    );
    expect((mockGl.clear as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(
      clearsBeforeRestore,
    );

    v3.destroy();
    expect(removed).toContain('webglcontextlost');
    expect(removed).toContain('webglcontextrestored');
    expect(v3.inited).toBe(false);
    getCtxSpy.mockRestore();
  });
});

interface RefCad3d {
  presetCanti: (H: number, keep?: Record<string, unknown>) => EngineProject;
  presetRib: (keep?: Record<string, unknown>) => EngineProject;
  presetKe: (keep?: Record<string, unknown>, idx?: number) => EngineProject;
  presetWall4: (keep?: Record<string, unknown>, idx?: number) => EngineProject;
  geom: (p: EngineProject) => Record<string, unknown>;
  buildBars: (p: EngineProject) => Record<string, unknown>;
  barList: (res: unknown) => Array<Record<string, unknown>>;
  quantities: (p: EngineProject, bars?: unknown) => QuantitiesResult;
  SHEET_DEFS: Array<{ name: string; noScale?: boolean }>;
  autoScale: (p: EngineProject, res: unknown, q: unknown) => number;
  buildCluster: (p: EngineProject, res: unknown, q: unknown, idx: number, S: number) => CadSheet;
  buildSheet: (p: EngineProject, res: unknown, q: unknown, idx: number, S?: number) => CadSheet;
  buildAllSheets: (p: EngineProject, res: unknown, q: unknown, S?: number) => CadSheet[];
  resetDimId: (n?: number) => void;
  toSVG: (sh: CadSheet, o?: Record<string, unknown>) => string;
  toDXF: (sheets: CadSheet[]) => string;
  exportCsvString: (res: unknown, q: unknown) => string;
  M3Tubes: new (
    sides?: number,
    maxV?: number,
  ) => {
    add: (pts: number[][], R: number) => { ci: number; i0: number; n: number } | null;
    finish: () => Array<{ v: Float32Array; i: Uint16Array; nv: number }>;
  };
  model3D: (p: EngineProject, res: unknown) => Model3DData;
  V3_PAL: number[][];
  V3_VIEWS: Record<string, [string, number, number, 0 | 1]>;
  V3_VS_TUBE: string;
  V3_FS_HEAD: string;
  V3_FS_TUBE: string;
  V3_VS_MESH: string;
  V3_FS_MESH: string;
  V3_VS_LINE: string;
  V3_FS_LINE: string;
  v3m: {
    persp: (f: number, a: number, n: number, fa: number) => number[];
    ortho: (hw: number, hh: number, n: number, fa: number) => number[];
    look: (e: number[], c: number[], up: number[]) => number[];
    mul: (a: number[], b: number[]) => number[];
  };
  v3ClipVecRef: (m: Model3DData, clip: { axis: string; t: number; flip: boolean }) => number[];
  v3GroupColorRef: (gr: M3BarGroup, mode: string) => number[];
  v3Drawn: (gr: M3BarGroup) => number;
  v3Diff: (gr: M3BarGroup) => boolean;
  v3TipHtmlRef: (
    model: Model3DData,
    grIdx: number,
    mouse: { x: number; y: number },
    W: number,
  ) => { html: string; left: string; top: string };
  v3PickRef: (
    state: {
      model: Model3DData;
      vp: number[];
      W: number;
      H: number;
      pxK: number;
      dpr: number;
      kd: number;
      vis: { rebar: boolean };
      hidden: Set<string>;
      focus: string | null;
      cam: { ortho: boolean };
      clip: { axis: string; t: number; flip: boolean };
    },
    mx: number,
    my: number,
  ) => { gr: M3BarGroup; bi: number; score: number } | null;
  v3InfoRef: (p: EngineProject, res: unknown, q: QuantitiesResult) => string;
}

function loadRefCad3d(): RefCad3d {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const modulesDir = path.resolve(here, '../../../analysis/modules');
  const readMod = (name: string) => fs.readFileSync(path.join(modulesDir, name), 'utf8');
  const linesSlice = (name: string, start: number, end: number) =>
    readMod(name)
      .split(/\r?\n/)
      .slice(start - 1, end)
      .join('\n');

  const ctxObj: Record<string, unknown> = {
    Math,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Map,
    Set,
    JSON,
    Date,
    RegExp,
    Error,
    Int32Array,
    Uint8Array,
    Uint16Array,
    Uint32Array,
    Float64Array,
    Float32Array,
    isFinite,
    isNaN,
    parseFloat,
    parseInt,
    console,
  };
  const context = vm.createContext(ctxObj);
  const run = (code: string, filename: string) => vm.runInContext(code, context, { filename });

  run(readMod('01_project_geom.js'), '01_project_geom.js');
  run(readMod('02_cad_2d.js'), '02_cad_2d.js');
  run(readMod('03_template_b_canti.js'), '03_template_b_canti.js');
  run(readMod('04_template_c_ke.js'), '04_template_c_ke.js');
  run(readMod('05_template_d_anchor_rebar.js'), '05_template_d_anchor_rebar.js');
  run(readMod('06_template_d_cad.js'), '06_template_d_cad.js');
  run(readMod('23_model_3d.js'), '23_model_3d.js');

  // Pure slices from 24_webgl_viewer.js with a minimal headless DOM stub for v3Tip
  run(
    `
    const _domStubs = {
      "#v3tip": { hidden: true, innerHTML: "", offsetWidth: 160, offsetHeight: 42, style: { left: "", top: "" } },
      "#v3wrap": { clientWidth: 800, clientHeight: 600 },
    };
    const $ = (sel) => _domStubs[sel] || null;
    const V3 = {
      vis: { conc: true, edges: true, blind: true, soil: false, grid: true, rebar: true },
      hidden: new Set(),
      focus: null,
      hover: null,
      cam: { tx: 0, ty: 0, tz: 0, dist: 1e3, yaw: 1, pitch: 0.42, ortho: false },
      fov: (35 * Math.PI) / 180,
      alpha: 0.2,
      kd: 1,
      colorMode: "mark",
      clip: { axis: "", t: 1, flip: false },
      model: null,
      vp: null,
      W: 0,
      H: 0,
      pxK: 1,
      dpr: 1,
      mouse: null,
    };
    `,
    '24_v3_stub.js',
  );
  run(linesSlice('24_webgl_viewer.js', 21, 118), '24_v3_math_shaders.js');
  run(linesSlice('24_webgl_viewer.js', 297, 304), '24_v3_views.js');
  run(linesSlice('24_webgl_viewer.js', 390, 403), '24_v3_clip_color.js');
  run(linesSlice('24_webgl_viewer.js', 589, 652), '24_v3_pick.js');
  run(linesSlice('24_webgl_viewer.js', 779, 807), '24_v3_tip.js');

  run(
    `
    function resetDimIdRef(n = 0) { DIM_ID = n; }
    function buildAllSheetsRef(p, res, q, S) {
      const sc = S || autoScale(p, res, q);
      DIM_ID = 0;
      return SHEET_DEFS.map((_, i) => buildCluster(p, res, q, i, sc));
    }
    function exportCsvStringRef(res, q) {
      const rows = [
        ["Mac","Ten","D(mm)","Dai 1 thanh min (mm)","Dai 1 thanh max (mm)","So luong","Tong dai (m)","kg/m","Khoi luong (kg)"]
      ];
      res.bars.forEach((b) =>
        rows.push([b.mark, b.name, b.d, b.minL, b.maxL, b.count, b.totLen.toFixed(2), unitW(b.d).toFixed(3), b.kg.toFixed(2)])
      );
      rows.push(
        [],
        ["Tong", "", "", "", "", "", "", "", q.totKg.toFixed(2)],
        ["Ham luong (kg/m3)", q.ratio.toFixed(1)],
        [],
        ["Be tong (m3)", "Mong/ban day", q.conc.foot.toFixed(2)],
        ["", "Than", q.conc.stem.toFixed(2)],
        ["", "Chan khoa/khay", q.conc.key.toFixed(2)],
        ["", "Suon", q.conc.rib.toFixed(2)],
        ["", "Cong", q.vol.toFixed(2)],
        ["Be tong lot (m3)", "", q.blind.toFixed(2)],
        ["Van khuon (m2)", "Mong/ban day", q.form.foot.toFixed(2)],
        ["", "Than", q.form.stem.toFixed(2)],
        ["", "Suon", q.form.rib.toFixed(2)],
        ["", "Cong", q.form.tot.toFixed(2)],
      );
      return "\\ufeff" + rows.map((r) => r.map((v) => '"' + String(v === undefined ? "" : v).replace(/"/g, '""') + '"').join(",")).join("\\r\\n");
    }
    function v3ClipVecRef(m, clip) {
      V3.model = m;
      V3.clip = clip;
      return v3ClipVec();
    }
    function v3GroupColorRef(gr, mode) {
      V3.colorMode = mode;
      return v3GroupColor(gr);
    }
    function v3PickRef(st, mx, my) {
      const prev = { model: V3.model, vp: V3.vp, W: V3.W, H: V3.H, pxK: V3.pxK, dpr: V3.dpr, kd: V3.kd, vis: V3.vis, hidden: V3.hidden, focus: V3.focus, cam: V3.cam, clip: V3.clip };
      Object.assign(V3, st);
      try { return v3Pick(mx, my); } finally { Object.assign(V3, prev); }
    }
    function v3TipHtmlRef(m, grIdx, mouse, W) {
      const gr = Object.assign({}, m.groups[grIdx]);
      const bs = gr.bs || [];
      gr.kg = bs.reduce((s, b) => s + (b.kg || 0), 0);
      gr.minL = bs.length ? Math.min(...bs.map((b) => b.minL)) : 0;
      gr.maxL = bs.length ? Math.max(...bs.map((b) => b.maxL)) : 0;
      _domStubs["#v3wrap"].clientWidth = W;
      V3.mouse = mouse;
      v3Tip({ gr });
      return {
        html: _domStubs["#v3tip"].innerHTML,
        left: _domStubs["#v3tip"].style.left,
        top: _domStubs["#v3tip"].style.top,
      };
    }
    function v3InfoRef(p, res, q) {
      const g = res.g, fmtm = (v) => fmt2(v / 100);
      return \`B = \${fmtm(g.B)} m · cao tổng = \${fmtm(g.yTop)} m · L = \${fmtm(p.Lu)} m · BT \${fmt2(q.vol)} m³ · thép \${fmt(q.totKg, 0)} kg\`;
    }
    globalThis.__REF_CAD_3D__ = {
      presetCanti, presetRib, presetKe, presetWall4, geom, buildBars, barList, quantities,
      SHEET_DEFS, autoScale, buildCluster, buildSheet, buildAllSheets: buildAllSheetsRef,
      resetDimId: resetDimIdRef, toSVG, toDXF, exportCsvString: exportCsvStringRef,
      M3Tubes, model3D,
      V3_PAL, V3_VIEWS, V3_VS_TUBE, V3_FS_HEAD, V3_FS_TUBE, V3_VS_MESH, V3_FS_MESH, V3_VS_LINE, V3_FS_LINE, v3m,
      v3ClipVecRef, v3GroupColorRef, v3Drawn, v3Diff, v3TipHtmlRef, v3PickRef, v3InfoRef,
    };
    `,
    '24_export_cad_3d.js',
  );

  return ctxObj.__REF_CAD_3D__ as RefCad3d;
}

function assertNumericParity(actual: unknown, expected: unknown, loc = 'root', tol = 1e-8): void {
  if (typeof expected === 'number') {
    if (typeof actual !== 'number') {
      throw new Error(`${loc}: expected number, got ${typeof actual}`);
    }
    if (Number.isNaN(expected)) {
      if (!Number.isNaN(actual)) throw new Error(`${loc}: expected NaN, got ${actual}`);
    } else if (!Number.isFinite(expected)) {
      if (actual !== expected) throw new Error(`${loc}: expected ${expected}, got ${actual}`);
    } else {
      const diff = Math.abs(actual - expected);
      const allow = tol * Math.max(1, Math.abs(expected));
      if (diff > allow) {
        throw new Error(`${loc}: numeric mismatch actual=${actual} expected=${expected} (diff=${diff})`);
      }
    }
    return;
  }
  if (expected === null || expected === undefined || typeof expected !== 'object') {
    if (actual !== expected) {
      throw new Error(`${loc}: mismatch actual=${String(actual)} expected=${String(expected)}`);
    }
    return;
  }
  if (actual === null || actual === undefined || typeof actual !== 'object') {
    throw new Error(`${loc}: expected object, got ${String(actual)}`);
  }
  if (ArrayBuffer.isView(expected)) {
    if (!ArrayBuffer.isView(actual)) {
      throw new Error(`${loc}: expected TypedArray`);
    }
    const aArr = actual as unknown as ArrayLike<number>;
    const eArr = expected as unknown as ArrayLike<number>;
    if (aArr.length !== eArr.length) {
      throw new Error(`${loc}.length mismatch actual=${aArr.length} expected=${eArr.length}`);
    }
    for (let i = 0; i < eArr.length; i++) {
      const av = aArr[i];
      const ev = eArr[i];
      const diff = Math.abs(av - ev);
      const allow = tol * Math.max(1, Math.abs(ev));
      if (diff > allow || Number.isNaN(av) !== Number.isNaN(ev)) {
        throw new Error(`${loc}[${i}]: mismatch actual=${av} expected=${ev} (diff=${diff})`);
      }
    }
    return;
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) {
      throw new Error(`${loc}: expected Array`);
    }
    if (actual.length !== expected.length) {
      throw new Error(`${loc}.length mismatch actual=${actual.length} expected=${expected.length}`);
    }
    for (let i = 0; i < expected.length; i++) {
      assertNumericParity(actual[i], expected[i], `${loc}[${i}]`, tol);
    }
    return;
  }
  const aRec = actual as Record<string, unknown>;
  const eRec = expected as Record<string, unknown>;
  for (const k of new Set([...Object.keys(aRec), ...Object.keys(eRec)])) {
    if (aRec[k] === undefined && eRec[k] === undefined) continue;
    assertNumericParity(aRec[k], eRec[k], `${loc}.${k}`, tol);
  }
}

interface ParsedDxfSummary {
  header: Record<string, string | number>;
  layers: Array<{ name: string; aci: number; ltype: string }>;
  blocks: Array<{ name: string; count: number }>;
  dimensions: Array<{ block: string; x10: number; y10: number }>;
  bulgePolylines: number;
  solids: number;
  texts: string[];
  minY: number;
  maxY: number;
}

function parseDxfSummary(dxf: string): ParsedDxfSummary {
  const lines = dxf.split(/\r\n/);
  const header: Record<string, string | number> = {};
  const layers: Array<{ name: string; aci: number; ltype: string }> = [];
  const blocks: Array<{ name: string; count: number }> = [];
  const dimensions: Array<{ block: string; x10: number; y10: number }> = [];
  const texts: string[] = [];
  let bulgePolylines = 0;
  let solids = 0;
  let minY = Infinity;
  let maxY = -Infinity;

  let section = '';
  let table = '';
  let inLayer = false;
  let curLayer = { name: '', aci: 0, ltype: '' };
  let curHeaderVar = '';
  let curBlock: { name: string; count: number } | null = null;
  let curEntityType = '';
  let curDim: { block: string; x10: number; y10: number } | null = null;
  let inPolyBulge = false;

  for (let idx = 0; idx + 1 < lines.length; idx += 2) {
    const code = Number(lines[idx]);
    const val = lines[idx + 1];
    if (code === 0 && val === 'SECTION') {
      section = lines[idx + 3] || '';
      continue;
    }
    if (code === 0 && val === 'ENDSEC') {
      if (curDim) {
        dimensions.push(curDim);
        curDim = null;
      }
      section = '';
      table = '';
      inLayer = false;
      curBlock = null;
      curEntityType = '';
      continue;
    }
    if (section === 'HEADER') {
      if (code === 9) curHeaderVar = val;
      else if (curHeaderVar) {
        header[curHeaderVar] = code === 40 || code === 70 ? Number(val) : val;
        curHeaderVar = '';
      }
    } else if (section === 'TABLES') {
      if (code === 0 && val === 'TABLE') {
        table = lines[idx + 3] || '';
        inLayer = false;
      } else if (code === 0 && val === 'ENDTAB') {
        if (inLayer && curLayer.name) layers.push(curLayer);
        inLayer = false;
        table = '';
      } else if (table === 'LAYER') {
        if (code === 0 && val === 'LAYER') {
          if (inLayer && curLayer.name) layers.push(curLayer);
          curLayer = { name: '', aci: 0, ltype: '' };
          inLayer = true;
        } else if (inLayer) {
          if (code === 2) curLayer.name = val;
          else if (code === 62) curLayer.aci = Number(val);
          else if (code === 6) curLayer.ltype = val;
        }
      }
    } else if (section === 'BLOCKS') {
      if (code === 0 && val === 'BLOCK') {
        curBlock = { name: '', count: 0 };
      } else if (code === 0 && val === 'ENDBLK') {
        if (curBlock) blocks.push(curBlock);
        curBlock = null;
      } else if (curBlock) {
        if (code === 2 && !curBlock.name) curBlock.name = val;
        else if (code === 0) curBlock.count += 1;
      }
    } else if (section === 'ENTITIES') {
      if (code === 0) {
        if (curDim) {
          dimensions.push(curDim);
          curDim = null;
        }
        curEntityType = val;
        inPolyBulge = false;
        if (val === 'DIMENSION') curDim = { block: '', x10: 0, y10: 0 };
        else if (val === 'SOLID') solids += 1;
      } else if (curEntityType === 'DIMENSION' && curDim) {
        if (code === 2) curDim.block = val;
        else if (code === 10) curDim.x10 = Number(val);
        else if (code === 20) curDim.y10 = Number(val);
      } else if (curEntityType === 'VERTEX' && code === 42 && Number(val) === 1 && !inPolyBulge) {
        bulgePolylines += 1;
        inPolyBulge = true;
      } else if (curEntityType === 'TEXT' && code === 1) {
        texts.push(val);
      }
      if (code === 20 || code === 21 || code === 23 || code === 24) {
        const yv = Number(val);
        if (Number.isFinite(yv)) {
          minY = Math.min(minY, yv);
          maxY = Math.max(maxY, yv);
        }
      }
    }
  }

  return { header, layers, blocks, dimensions, bulgePolylines, solids, texts, minY, maxY };
}

describe('Differential Parity Suite (Node VM vs TS CAD/3D/CSV: Easy -> Medium -> Hard -> Special)', () => {
  let ref: RefCad3d;

  beforeAll(() => {
    ref = loadRefCad3d();
  });

  interface ScenarioSpec {
    tier: 'Easy' | 'Medium' | 'Hard' | 'Special';
    id: string;
    build: () => EngineProject;
    testDxf?: boolean;
    testTubesAllGroups?: boolean;
  }

  function makeScenarios(): ScenarioSpec[] {
    return [
      // --- Tier 1: Easy ---
      { tier: 'Easy', id: 'B_H500_default', build: () => presetCanti(500), testDxf: true },
      { tier: 'Easy', id: 'A_rib_default', build: () => presetRib(), testDxf: true },
      { tier: 'Easy', id: 'C_ke_idx0', build: () => presetKe({}, 0) },
      { tier: 'Easy', id: 'D_wall4_idx1_D65', build: () => presetWall4({}, 1) },

      // --- Tier 2: Medium ---
      {
        tier: 'Medium',
        id: 'B_H700_vertical_front_fill1_fullLeg_phi',
        build: () => {
          const p = presetCanti(700);
          p.slopeFront = false;
          p.blindOn = false;
          p.key = { on: false, w: 50, d: 50, dx: 50 };
          p.fillMode = '1';
          p.fillH = 250;
          p.dimLeg = 'full';
          p.labelUnit = 'Ø';
          p.labelFmt = 'std';
          p.formEnds = false;
          return p;
        },
        testDxf: true,
      },
      {
        tier: 'Medium',
        id: 'A_no_beam_with_key_no_cap_flatFill',
        build: () => {
          const p = presetRib();
          p.beam = { on: false, w: 0, d: 0 };
          p.key = { on: true, w: 70, d: 45, dx: 20 };
          p.cap = { w: 0, hv: 0, hs: 0 };
          p.fil = 0;
          p.fillMode = 'flat';
          p.fillH = 180;
          p.concrete = 'M350';
          return p;
        },
      },
      {
        tier: 'Medium',
        id: 'C_ke_idx13_slope15_fullLeg',
        build: () => {
          const p = presetKe({}, 13);
          p.fillMode = '1.5';
          p.fillH = 160;
          p.dimLeg = 'full';
          p.labelUnit = 'Ø';
          p.labelFmt = 'std';
          return p;
        },
      },

      // --- Tier 3: Hard ---
      {
        tier: 'Hard',
        id: 'B_H1300_ribbed_tall_slope15',
        build: () => {
          const p = presetCanti(1300);
          p.type = 'rib';
          p.rib = { t: 45, gap: 260, edge: 90, drop: 0 };
          p.Lu = 900;
          p.fillMode = '1.5';
          p.fillH = 300;
          return p;
        },
        testDxf: true,
        testTubesAllGroups: true,
      },
      {
        tier: 'Hard',
        id: 'B_H700_rock_anchor_drill',
        build: () => {
          const p = presetCanti(700);
          p.anc = { on: true, d: 32, a: 70, L: 160 };
          p.fillMode = 'flat';
          p.fillH = 200;
          return p;
        },
        testDxf: true,
        testTubesAllGroups: true,
      },
      {
        tier: 'Hard',
        id: 'A_tall_1300_full_features',
        build: () => {
          const p = presetRib();
          p.H = 1300;
          p.Lu = 1200;
          p.heel = 900;
          p.toe = 80;
          p.tsb = 100;
          p.tst = 50;
          p.tBase = 110;
          p.tTip = 90;
          p.cap = { w: 100, hv: 35, hs: 20 };
          p.beam = { on: true, w: 60, d: 60 };
          p.fil = 25;
          p.rib = { t: 45, gap: 280, edge: 95, drop: 60 };
          p.rb.r1 = { d: 25, n: 3, on: true, ng: 5 };
          p.fillMode = '1';
          p.fillH = 240;
          return p;
        },
        testDxf: true,
        testTubesAllGroups: true,
      },
      {
        tier: 'Hard',
        id: 'C_ke_idx26_tall_anchor_toeFlat',
        build: () => {
          const p = presetKe({}, 26);
          p.anc = { on: true, d: 28, a: 80, L: 140 };
          p.toeFlat = 40;
          p.fillMode = '1';
          p.fillH = 200;
          return p;
        },
        testDxf: true,
        testTubesAllGroups: true,
      },
      {
        tier: 'Hard',
        id: 'D_idx0_D80_rib',
        build: () => presetWall4({}, 0),
        testDxf: true,
        testTubesAllGroups: true,
      },
      {
        tier: 'Hard',
        id: 'D_idx0_D80_canti_override',
        build: () => {
          const p = presetWall4({}, 0);
          p.type = 'canti';
          p.fillMode = 'flat';
          p.fillH = 150;
          return p;
        },
      },
      {
        tier: 'Hard',
        id: 'D_idx3_D60b_thick80cm',
        build: () => {
          const p = presetWall4({}, 3);
          p.blindOn = true;
          return p;
        },
        testTubesAllGroups: true,
      },
      {
        tier: 'Hard',
        id: 'D_idx5_D30_small',
        build: () => presetWall4({}, 5),
      },

      // --- Tier 4: Special ---
      {
        tier: 'Special',
        id: 'A3_manual_scale_100_fits',
        build: () => {
          const p = presetCanti(800);
          p.paper = 'A3';
          p.scale = 100;
          return p;
        },
      },
      {
        tier: 'Special',
        id: 'A3_manual_scale_20_overflow',
        build: () => {
          const p = presetCanti(800);
          p.paper = 'A3';
          p.scale = 20;
          return p;
        },
      },
      {
        tier: 'Special',
        id: 'custom_rb_unmerged_csv_vs_merged_sheet',
        build: () => {
          const p = presetRib();
          p.rb.r3 = { d: 12, a: 20, on: false };
          p.rb.t1 = { d: 12, a: 100, ah: 100, on: true };
          p.rb.h1 = { d: 12, a: 20, on: true };
          p.rb.l1 = { d: 12, a: 20, on: true };
          return p;
        },
        testDxf: true,
      },
    ];
  }

  for (const sc of makeScenarios()) {
    it(
      `[${sc.tier}] ${sc.id}: matches 5 CAD sheets, SVG, DXF, CSV, model3D & all-groups M3Tubes`,
      () => {
        const tag = `[${sc.tier}/${sc.id}]`;
        const pTs = sc.build();
        const pRef = JSON.parse(JSON.stringify(pTs)) as EngineProject;

        const resTs = buildBars(pTs);
        const qTs = quantities(pTs, resTs);
        const resRef = ref.buildBars(pRef);
        const qRef = ref.quantities(pRef, resRef);

        // 1. Scale + 5-sheet entity parity
        const tsScale = autoScale(pTs, resTs, qTs);
        const refScale = ref.autoScale(pRef, resRef, qRef);
        expect(tsScale, `${tag} autoScale`).toBe(refScale);

        const sheetsTs = buildAllSheets(pTs, resTs, qTs);
        const sheetsRef = ref.buildAllSheets(pRef, resRef, qRef);
        expect(sheetsTs, `${tag} sheets.length`).toHaveLength(5);

        for (let i = 0; i < 5; i++) {
          const sTs = sheetsTs[i];
          const sRef = sheetsRef[i];
          expect(sTs.name, `${tag} sheet[${i}].name`).toBe(sRef.name);
          expect(sTs.noScale, `${tag} sheet[${i}].noScale`).toBe(sRef.noScale);
          expect(sTs.S, `${tag} sheet[${i}].S`).toBe(sRef.S);
          expect(sTs.fits, `${tag} sheet[${i}].fits`).toBe(sRef.fits);
          assertNumericParity(sTs.W, sRef.W, `${tag} sheet[${i}].W`, 1e-8);
          assertNumericParity(sTs.H, sRef.H, `${tag} sheet[${i}].H`, 1e-8);
          assertNumericParity(sTs.E.a, sRef.E.a, `${tag} sheet[${i}].E.a`, 1e-8);

          // SVG parity on representative sheets (0: details, 1: rebar, 3: shapes, 4: schedule)
          if (i === 0 || i === 1 || i === 3 || i === 4) {
            expect(toSVG(sTs, { theme: 'dark' }), `${tag} SVG dark [${i}]`).toBe(
              ref.toSVG(sRef, { theme: 'dark' }),
            );
            expect(toSVG(sTs, { theme: 'light', w: '100mm', h: '80mm' }), `${tag} SVG light [${i}]`).toBe(
              ref.toSVG(sRef, { theme: 'light', w: '100mm', h: '80mm' }),
            );
          }
        }

        // 2. DXF exact string parity on tagged scenarios
        if (sc.testDxf) {
          expect(toDXF([sheetsTs[0]]), `${tag} single sheet DXF`).toBe(ref.toDXF([sheetsRef[0]]));
          expect(toDXF(sheetsTs), `${tag} all 5 sheets DXF`).toBe(ref.toDXF(sheetsRef));
        }

        // 3. CSV exact string parity
        const csvTs = buildCsvContent(resTs, qTs);
        const csvRef = ref.exportCsvString(resRef, qRef);
        expect(csvTs, `${tag} CSV`).toBe(csvRef);

        // 4. 3D model concrete/lean/soil meshes, bbox, sig & rebar groups parity
        const mTs = model3D(pTs, resTs);
        const mRef = ref.model3D(pRef, resRef);
        expect(mTs.sig, `${tag} 3D sig`).toBe(mRef.sig);
        assertNumericParity(mTs.bbox, mRef.bbox, `${tag} 3D bbox`, 1e-8);
        assertNumericParity(mTs.conc.p, mRef.conc.p, `${tag} 3D conc.p`, 1e-7);
        assertNumericParity(mTs.conc.n, mRef.conc.n, `${tag} 3D conc.n`, 1e-7);
        expect(mTs.conc.i, `${tag} 3D conc.i`).toEqual(mRef.conc.i);
        assertNumericParity(mTs.conc.l, mRef.conc.l, `${tag} 3D conc.l`, 1e-7);
        // Verify 16-bit index safety for WebGL Uint16Array upload
        expect(mTs.conc.p.length / 3, `${tag} conc vertex count <= 65535`).toBeLessThanOrEqual(65535);
        assertNumericParity(mTs.lean.p, mRef.lean.p, `${tag} 3D lean.p`, 1e-7);
        expect(mTs.lean.i, `${tag} 3D lean.i`).toEqual(mRef.lean.i);
        assertNumericParity(mTs.soil.p, mRef.soil.p, `${tag} 3D soil.p`, 1e-7);
        expect(mTs.soil.i, `${tag} 3D soil.i`).toEqual(mRef.soil.i);

        expect(mTs.groups.length, `${tag} 3D groups.length`).toBe(mRef.groups.length);
        for (let gi = 0; gi < mRef.groups.length; gi++) {
          const gTs = mTs.groups[gi];
          const gRef = mRef.groups[gi];
          expect(gTs.id, `${tag} group[${gi}].id`).toBe(gRef.id);
          expect(gTs.key, `${tag} group[${gi}].key`).toBe(gRef.key);
          expect(gTs.mark, `${tag} group[${gi}].mark`).toBe(gRef.mark);
          expect(gTs.d, `${tag} group[${gi}].d`).toBe(gRef.d);
          expect(gTs.count, `${tag} group[${gi}].count`).toBe(gRef.count);
          expect(gTs.per, `${tag} group[${gi}].per`).toBe(gRef.per);
          assertNumericParity(gTs.R, gRef.R, `${tag} group[${gi}].R`, 1e-8);
          assertNumericParity(gTs.bars, gRef.bars, `${tag} group[${gi}].bars`, 1e-7);
        }

        // 5. All-groups M3Tubes buffer parity (matching V3.upload sides selection rule)
        if (sc.testTubesAllGroups) {
          const nSeg = mTs.groups.reduce(
            (s, gr) => s + gr.bars.reduce((t, pl) => t + Math.max(0, pl.length - 1), 0),
            0,
          );
          const sides = nSeg < 2500 ? 8 : 6;
          for (let gi = 0; gi < mTs.groups.length; gi++) {
            const gTs = mTs.groups[gi];
            const gRef = mRef.groups[gi];
            const tTs = new M3Tubes(sides);
            const tRef = new ref.M3Tubes(sides);
            const rangesTs = gTs.bars.map((pl) => tTs.add(pl, gTs.R ?? gTs.d / 20));
            const rangesRef = gRef.bars.map((pl) => tRef.add(pl, gRef.R ?? gRef.d / 20));
            expect(rangesTs, `${tag} tube ranges[${gi}]`).toEqual(rangesRef);
            const chunksTs = tTs.finish();
            const chunksRef = tRef.finish();
            expect(chunksTs.length, `${tag} tube chunks[${gi}].length`).toBe(chunksRef.length);
            for (let ci = 0; ci < chunksRef.length; ci++) {
              expect(chunksTs[ci].nv, `${tag} tube chunk[${gi}][${ci}].nv`).toBe(chunksRef[ci].nv);
              expect(chunksTs[ci].i, `${tag} tube chunk[${gi}][${ci}].i`).toEqual(chunksRef[ci].i);
              assertNumericParity(chunksTs[ci].v, chunksRef[ci].v, `${tag} tube chunk[${gi}][${ci}].v`, 1e-5);
            }
          }
        }
      },
      15_000,
    );
  }

  it('preserves unmerged CSV rows vs consolidated barList Sheet 4/5 when marks share diameter', () => {
    const p = presetRib();
    // Force h1 and l1 to share mark 5 + diameter 12 on Template A
    p.rb.h1 = { d: 12, a: 20, on: true };
    p.rb.l1 = { d: 12, a: 20, on: true };
    const res = buildBars(p);
    const q = quantities(p, res);

    const merged = barList(res as BarsResult);
    expect(res.bars.length).toBeGreaterThan(merged.length);

    const csv = buildCsvContent(res, q);
    const csvLines = csv.slice(1).split('\r\n');
    expect(csvLines.length).toBe(1 + res.bars.length + 14);
    expect(csv).toBe(ref.exportCsvString(res, q));

    const sheets = buildAllSheets(p, res, q);
    const sh4CircleCount = sheets[3].E.a.filter((e) => e.k === 'C' && !e.fill).length;
    expect(sh4CircleCount).toBe(merged.length);
  });

  it('validates AutoCAD R12 DXF structure, *D* anonymous DIMENSION blocks, filled bulges, and multi-sheet stacking gapMm', () => {
    const p = presetRib();
    const res = buildBars(p);
    const q = quantities(p, res);
    const sheets = buildAllSheets(p, res, q);

    const dxfAll = toDXF(sheets);
    const parsed = parseDxfSummary(dxfAll);
    expect(parsed.header.$ACADVER).toBe('AC1009');
    expect(parsed.header.$INSUNITS).toBe(4);
    expect(parsed.header.$DWGCODEPAGE).toBe('ANSI_1252');
    expect(parsed.layers).toHaveLength(17);
    expect(parsed.layers.map((l) => l.name)).toEqual(Object.values(LAYERS).map((l) => l.n));

    const anonBlocks = new Set(parsed.blocks.map((b) => b.name).filter((n) => /^\*D\d+$/.test(n)));
    expect(parsed.dimensions.length).toBeGreaterThan(10);
    expect(parsed.dimensions.length).toBe(anonBlocks.size);
    for (const dim of parsed.dimensions) {
      expect(anonBlocks.has(dim.block)).toBe(true);
    }
    expect(parsed.bulgePolylines).toBeGreaterThan(0);
    expect(parsed.solids).toBeGreaterThan(0);
    expect(parsed.texts.some((t) => t.includes('\\U+'))).toBe(true);

    // Custom gapMm expands vertical stack downwards
    const dxfWideGap = toDXF(sheets, { gapMm: 150 });
    const parsedWide = parseDxfSummary(dxfWideGap);
    expect(parsedWide.minY).toBeLessThan(parsed.minY);
    expect(parsedWide.maxY).toBeCloseTo(parsed.maxY, 3);
  });

  it('matches 24_webgl_viewer.js pure constants, GLSL shaders, matrices, clip, drawn/diff, tip formatting, and CPU picking across persp/ortho/clip/focus', () => {
    expect(V3_PAL).toEqual(ref.V3_PAL);
    expect(V3_VIEWS).toEqual(ref.V3_VIEWS);
    expect(V3_VS_TUBE).toBe(ref.V3_VS_TUBE);
    expect(V3_FS_HEAD).toBe(ref.V3_FS_HEAD);
    expect(V3_FS_TUBE).toBe(ref.V3_FS_TUBE);
    expect(V3_VS_MESH).toBe(ref.V3_VS_MESH);
    expect(V3_FS_MESH).toBe(ref.V3_FS_MESH);
    expect(V3_VS_LINE).toBe(ref.V3_VS_LINE);
    expect(V3_FS_LINE).toBe(ref.V3_FS_LINE);

    // Matrix helpers parity
    const projPerspTs = v3m.persp((35 * Math.PI) / 180, 1.6, 5, 5000);
    const projPerspRef = ref.v3m.persp((35 * Math.PI) / 180, 1.6, 5, 5000);
    assertNumericParity(projPerspTs, projPerspRef, 'v3m.persp', 1e-12);

    const projOrthoTs = v3m.ortho(480, 300, -4000, 5000);
    const projOrthoRef = ref.v3m.ortho(480, 300, -4000, 5000);
    assertNumericParity(projOrthoTs, projOrthoRef, 'v3m.ortho', 1e-12);

    const viewTs = v3m.look([600, 500, 900], [100, 200, 250], [0, 1, 0]);
    const viewRef = ref.v3m.look([600, 500, 900], [100, 200, 250], [0, 1, 0]);
    assertNumericParity(viewTs, viewRef, 'v3m.look', 1e-12);

    const vpPersp = v3m.mul(projPerspTs, viewTs);
    const vpPerspRef = ref.v3m.mul(projPerspRef, viewRef);
    assertNumericParity(vpPersp, vpPerspRef, 'v3m.mul', 1e-12);

    // Real model test: Template A (has both diff rebar counts like đai kín + normal bars + 2D-only if any)
    const p = presetRib();
    const res = buildBars(p);
    const q = quantities(p, res);
    const model = model3D(p, res);

    // Populate segments/segBar metadata on model groups just as V3.upload does
    model.groups.forEach((gr, gi) => {
      const segs: number[] = [];
      const segBar: number[] = [];
      gr.bars.forEach((pl, bi) => {
        for (let i = 1; i < pl.length; i++) {
          segs.push(
            Math.fround(pl[i - 1][0]),
            Math.fround(pl[i - 1][1]),
            Math.fround(pl[i - 1][2]),
            Math.fround(pl[i][0]),
            Math.fround(pl[i][1]),
            Math.fround(pl[i][2]),
          );
          segBar.push(bi);
        }
      });
      gr.segs = segs;
      gr.segBar = segBar;
      Object.assign(gr, { col: V3_PAL[gi % V3_PAL.length] });
    });

    expect(v3FormatInfo(p, res, q)).toBe(ref.v3InfoRef(p, res, q));

    for (const clip of [
      { axis: '' as const, t: 1, flip: false },
      { axis: 'x' as const, t: 0.4, flip: false },
      { axis: 'y' as const, t: 0.65, flip: true },
      { axis: 'z' as const, t: 0.25, flip: true },
    ]) {
      assertNumericParity(
        v3ClipVec(model, clip),
        ref.v3ClipVecRef(model, clip),
        `v3ClipVec(${clip.axis},${clip.t},${clip.flip})`,
        1e-12,
      );
    }

    for (let gi = 0; gi < model.groups.length; gi++) {
      const gr = model.groups[gi];
      expect(v3Drawn(gr)).toBe(ref.v3Drawn(gr));
      expect(v3Diff(gr)).toBe(ref.v3Diff(gr));
      assertNumericParity(v3GroupColor(gr, 'cad', gi), ref.v3GroupColorRef(gr, 'cad'));
      assertNumericParity(v3GroupColor(gr, 'mark', gi), ref.v3GroupColorRef(gr, 'mark'));

      const tipTs = v3FormatTip(gr);
      const htmlTs = `<b>${tipTs.title}</b><span>${tipTs.subtitle}</span><em>${tipTs.summary}</em>`;
      const tipRef = ref.v3TipHtmlRef(model, gi, { x: 200, y: 200 }, 800);
      expect(htmlTs, `tip HTML group[${gi}]`).toBe(tipRef.html);
    }

    // CPU picking parity across perspective & ortho & clip & focus modes
    const cx = (model.bbox.x0 + model.bbox.x1) / 2;
    const cy = (model.bbox.y0 + model.bbox.y1) / 2;
    const cz = (model.bbox.z0 + model.bbox.z1) / 2;
    const camView = v3m.look([cx + 700, cy + 400, cz + 900], [cx, cy, cz], [0, 1, 0]);
    const vpTestPersp = v3m.mul(v3m.persp((35 * Math.PI) / 180, 800 / 600, 10, 8000), camView);
    const vpTestOrtho = v3m.mul(v3m.ortho(700, 525, -4000, 6000), camView);

    // Find a screen coordinate that lands directly on the midpoint of group[0]'s first segment
    const s0 = model.groups[0].segs!;
    const mx3 = (s0[0] + s0[3]) / 2;
    const my3 = (s0[1] + s0[4]) / 2;
    const mz3 = (s0[2] + s0[5]) / 2;
    const wClip =
      vpTestPersp[3] * mx3 + vpTestPersp[7] * my3 + vpTestPersp[11] * mz3 + vpTestPersp[15];
    const pxHit =
      (((vpTestPersp[0] * mx3 + vpTestPersp[4] * my3 + vpTestPersp[8] * mz3 + vpTestPersp[12]) /
        wClip) *
        0.5 +
        0.5) *
      800;
    const pyHit =
      (1 -
        (((vpTestPersp[1] * mx3 + vpTestPersp[5] * my3 + vpTestPersp[9] * mz3 + vpTestPersp[13]) /
          wClip) *
          0.5 +
          0.5)) *
      600;

    const pickCases = [
      { ortho: false, clip: { axis: '' as const, t: 1, flip: false }, hidden: new Set<string>(), focus: null },
      { ortho: false, clip: { axis: 'y' as const, t: 0.3, flip: false }, hidden: new Set<string>(), focus: null },
      { ortho: false, clip: { axis: '' as const, t: 1, flip: false }, hidden: new Set(['g0']), focus: null },
      { ortho: false, clip: { axis: '' as const, t: 1, flip: false }, hidden: new Set<string>(), focus: 'g2' },
      { ortho: true, clip: { axis: '' as const, t: 1, flip: false }, hidden: new Set<string>(), focus: null },
    ];

    for (const pc of pickCases) {
      const vp = pc.ortho ? vpTestOrtho : vpTestPersp;
      const pxK = pc.ortho ? 1050 / 600 : (2 * Math.tan((35 * Math.PI) / 360)) / 600;
      const st = {
        model,
        vp,
        W: 800,
        H: 600,
        pxK,
        dpr: 1,
        kd: 1.5,
        vis: { rebar: true },
        hidden: pc.hidden,
        focus: pc.focus,
        cam: { ortho: pc.ortho },
        clip: pc.clip,
      };
      const tsHit = v3Pick(st, pxHit, pyHit);
      const refHit = ref.v3PickRef(st, pxHit, pyHit);
      if (refHit === null) {
        expect(tsHit).toBeNull();
      } else {
        expect(tsHit).not.toBeNull();
        expect(tsHit!.gr.id).toBe(refHit.gr.id);
        expect(tsHit!.bi).toBe(refHit.bi);
        assertNumericParity(tsHit!.z, refHit.score, 'v3Pick.score', 1e-9);
      }
    }
  });
});
