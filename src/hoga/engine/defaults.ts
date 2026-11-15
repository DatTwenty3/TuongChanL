import type { GaConfig, GaKind, GaRow, HoGaProject } from './types';
import { DEFAULT_ANGLES, DEFAULT_CATALOG } from './catalog-data';
import { SAMPLE_ROWS } from './samples';

/** Cấu hình mặc định = các giá trị mẫu trong sheet CF.Ga của từng tệp Excel (HDSD §2.3). */
export function defaultConfig(kind: GaKind): GaConfig {
  const base: GaConfig = {
    liner: { l1Ext: 100, l1T: 100, l2Ext: 100, l2T: 0 },
    bottom: { ext: 100, chamfer: 100, chamferDia: 12, hook: 250 },
    wall: {
      horizAdj: 0,
      dRed: 0,
      prefix: 'Htb=',
      topChamfer: { on: false, size: '75x50', angle: 'V50x50x3', pos: '123', anchor: 'D6A150L100' },
    },
    roof: { chamfer: 100, chamferDia: 14, hook: 200 },
    precast: { pin: true, pinSpec: 'D18A500', pinLen: 500, pinHole: 25, mortar: 15, lift: '2D12', liftSize: '100x150x80' },
    neck: {
      structure: 'BTCT',
      pos: 'Góc T1-T2',
      size: '700x700',
      chamfer: false,
      chamferSize: '75x50',
      angle: 'V30x30x3',
      anglePos: '123',
      anchor: 'D6A150L100',
      prefix: 'Ctb=',
      horizAdj: 0,
      dRed: 0,
    },
    lid: {
      type: 'Gang',
      height: 150,
      block: 'VIN.TNM.LD.700x700',
      recess: true,
      recessSize: '50x63',
      hatch: 'AR-CONC',
      nSlabs: 2,
      gap: 5,
      dir: 'Ngang',
      dLow: 10,
      dUp: 8,
      density: 100,
      tie: 'D6A400',
      tieShape: 'Chữ Z',
      angle: 'V50x50x3',
      angleCount: 2,
      anchor: 'D6A200L100',
      lift: '2D8',
      liftSize: '100x100x80',
      scale: 20,
    },
    inlet: {
      place: 'Thân ga',
      side: 'Giữa T4',
      hole: '550x250',
      clear: '500x250',
      thick: '125x150',
      liner: '100x50',
      beam: '150x100',
      structure: 'BTCT',
      mesh: 'D10A150',
      beamMain: '4D12',
      beamStirrup: 'D6A150',
    },
    cover: { bottom: 20, wall: 25, roof: 30, neck: 30, lid: 15, pipe: 15, inlet: 25, notch: 30 },
    fmt: {
      bottomLow: '0M',
      bottomUp: '2M',
      wallOut: '2M',
      wallIn: '0M',
      roofUp: '0M',
      roofLow: '2M',
      neckOut: '2M',
      neckIn: '0M',
      prefixes: { bottom: 'D', wall: 'T', roof: 'N', neck: 'C', lid: 'M' },
      mesh: 'Chia đều',
      hook: 'Theo KC',
      hookN: 10,
      densSym: '@',
      showCount: false,
    },
    ties: { stagger: 'Lệch', bottom: 'Chữ U', wall: 'Chữ C', roof: 'Chữ U', neck: 'Chữ C', spec: 'D6A300', lap: 30, hookC: 50, hookZU: 100, hookMid: 200 },
    ladder: { pos: 'Theo vị trí cổ', dia: 18, dens: '500x300', size: '150x250x300', depth: 100, prefix: 'Th' },
    pipeHole: { plaster: 50, dia: 10, form: 'Bo+Xiên', count: 2, ext: 250, prefix: 'GC', offsets: [0, 0, 0, 0] },
    manHole: { dia: 10, form: 'Bo+Vuông', count: 2, ext: 250, prefix: 'GC' },
    levels: { mode: 'Tuyệt đối', labels: ['Z1', 'Z2', 'ZT1', 'ZT2', 'ZT3', 'ZT4'] },
    materials: {
      liner1: 'BT lót M100 đá 2x4',
      liner2: 'Dăm lót 1x2',
      body: 'BTCT M200 đá 1x2',
      neck: 'BTCT M200 đá 1x2',
      plaster: 'Vữa XM M100',
      mortar: 'Vữa XM M75',
    },
    excavation: { sandT: 100, baseExt: 400, slope: 0.5, h0Dig: 500, h0Fill: 500 },
  };

  switch (kind) {
    case 'lienKhoi':
      break;
    case 'napRoi':
      base.bottom = { ext: 0, chamfer: 0, chamferDia: 12, hook: 200 };
      base.neck.pos = 'Góc T3-T4';
      base.neck.size = '570x820';
      base.lid = { ...base.lid, type: 'BTCT', height: 100, block: 'VIN.TNM.LD.570x820' };
      base.fmt.wallOut = '1M';
      break;
    case 'thamThuNapRoi':
      base.bottom = { ext: 100, chamfer: 0, chamferDia: 10, hook: 200 };
      base.neck.pos = 'Giữa T1';
      base.neck.size = '820x570';
      base.lid = { ...base.lid, type: 'Gang', height: 100, block: 'VIN.TNM.LD.820x570' };
      base.cover = { ...base.cover, bottom: 25, roof: 25, neck: 25 };
      base.fmt.wallOut = '1M';
      break;
    case 'thamThuLienKhoi':
      base.bottom = { ext: 0, chamfer: 100, chamferDia: 10, hook: 200 };
      base.roof = { chamfer: 0, chamferDia: 10, hook: 200 };
      base.neck = { ...base.neck, chamfer: true, chamferSize: '50x63' };
      base.lid = { ...base.lid, height: 0, block: 'VIN.TNT.VH.700x700', recessSize: '50x63' };
      base.cover = { ...base.cover, bottom: 25, roof: 25, neck: 25 };
      base.fmt.wallOut = '1M';
      break;
    case 'khongCo':
      base.wall.topChamfer = { on: true, size: '75x120', angle: 'V50x50x3', pos: '1', anchor: 'D6A150L100' };
      base.lid = { ...base.lid, type: 'BTCT', block: 'VIN.TNT.VH.700x700', nSlabs: 2, dir: 'Dọc', lift: '2D10', scale: 15 };
      base.cover = { ...base.cover, bottom: 30, wall: 30, lid: 20 };
      base.fmt.roofUp = '2M';
      base.fmt.roofLow = '2M';
      base.fmt.wallOut = '2M';
      base.fmt.wallIn = '2M';
      base.fmt.bottomLow = '2M';
      break;
  }
  return base;
}

export function sampleRows(kind: GaKind): GaRow[] {
  return JSON.parse(JSON.stringify(SAMPLE_ROWS[kind])) as GaRow[];
}

export function defaultProject(kind: GaKind): HoGaProject {
  return {
    kind,
    title: 'Dự án hố ga',
    rows: sampleRows(kind),
    config: defaultConfig(kind),
    catalog: JSON.parse(JSON.stringify(DEFAULT_CATALOG)),
    angles: { ...DEFAULT_ANGLES },
  };
}

export function emptyRow(name = 'G-new'): GaRow {
  return {
    name,
    count: 1,
    L: 1000,
    B: 1000,
    H: 1200,
    bottom: { t: 150, low: 'D10A150', up: 'D10A150' },
    wall: { t: 150, out: 'D10A150', in: 'D10A150' },
    roof: { t: 150, up: 'D10A150', low: 'D10A150' },
    pipes: [
      { spec: '', depth: 0 },
      { spec: '', depth: 0 },
      { spec: '', depth: 0 },
      { spec: '', depth: 0 },
    ],
    neck: { h: 400, t: 150, out: 'D10A150', in: 'D10A150' },
    level: null,
  };
}
