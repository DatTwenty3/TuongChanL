import { createDefaultRigidProjectData } from '../engine/rigid';
import type { ProjectState } from '../types/project';
import { createBlankProject } from './sampleVd';

/**
 * Ví dụ B.1 — Phụ lục B, TCCS 39:2022/TCĐBVN: đường cấp IV, tấm BTXM 23 cm (4,5 × 3,5 m),
 * móng CPĐD 300 MPa dày 20 cm trên nền E0 = 40 MPa; Pmax = 150 kN, Ne = 2,8·10⁴.
 */
export function createRigidSampleProject(variant: 'B1' | 'B2' = 'B1'): ProjectState {
  if (variant === 'B2') return createRigidSampleB2();
  const base = createBlankProject();
  const rigid = createDefaultRigidProjectData();
  rigid.roadClass = 'CAP_IV';
  rigid.region = 'BAC';
  rigid.aggregate = 'GRANIT';
  rigid.shoulder = 'MEM';
  rigid.input = {
    ...rigid.input,
    cap: 'Đường cấp IV',
    model: 1,
    hc: 0.23,
    L: 4.5,
    B: 3.5,
    fr: 4.5,
    Ec: 29000,
    muc: 0.15,
    ac: 1e-5,
    Tg: 86,
    Ps: 100,
    Pmax: 150,
    Ne: 2.8e4,
    kr: 1.0,
    kc: 1.0,
    gr: 1.04,
    E0: 40,
    Eb: 0,
    hb: 0,
    layers: [{ name: 'Cấp phối đá dăm (móng trên)', E: 300, h: 0.2 }],
  };
  rigid.joint = { h: 23, kc: '3.50', mong: 'hat', cap: 'thap', L: 4.5 };
  return {
    ...base,
    projectInfo: {
      congTrinh: 'Ví dụ B.1 — Phụ lục B (TCCS 39:2022/TCĐBVN)',
      diaDiem: 'Tỉnh Hưng Yên',
      kySuThietKe: '',
      doiTuongTK: 'KCAD',
      loaiTK: 'TK_MOI',
      loaiMatDuong: 'CUNG',
    },
    roadScale: { ...base.roadScale, capDuong: 'Đường cấp IV', soLanXe: 2 },
    rigid,
  };
}

/**
 * Ví dụ B.2 — Phụ lục B, TCCS 39:2022/TCĐBVN: đường cấp III (Long An), tấm 26 cm (4,8 × 3,5 m) trên móng
 * trên CPĐD gia cố xi măng 20 cm (Eb = 1300 MPa) và móng dưới CPĐD 18 cm (300 MPa), nền E0 = 45 MPa;
 * Pmax = 180 kN, Ne = 17,07·10⁶, Tg = 92 °C/m. Sách tính σtmax với αc = 10⁻⁵ nên giữ nguyên để khớp số.
 */
function createRigidSampleB2(): ProjectState {
  const base = createBlankProject();
  const rigid = createDefaultRigidProjectData();
  rigid.roadClass = 'CAP_III';
  rigid.region = 'NAM';
  rigid.aggregate = 'CUOI_SOI';
  rigid.shoulder = 'BTXM_BANG';
  rigid.input = {
    ...rigid.input,
    cap: 'Đường cấp III',
    model: 2,
    caly: 0,
    hc: 0.26,
    L: 4.8,
    B: 3.5,
    fr: 5.0,
    Ec: 31000,
    muc: 0.15,
    ac: 1e-5,
    Tg: 92,
    Ps: 100,
    Pmax: 180,
    Ne: 17.07e6,
    kr: 0.87,
    kc: 1.05,
    gr: 1.13,
    E0: 45,
    matBound: 'CPĐD gia cố xi măng',
    Eb: 1300,
    hb: 0.2,
    mub: 0.2,
    fbr: 0,
    layers: [{ name: 'Cấp phối đá dăm (móng dưới)', E: 300, h: 0.18 }],
  };
  rigid.joint = { h: 26, kc: '3.50', mong: 'gc', cap: 'thap', L: 4.8 };
  return {
    ...base,
    projectInfo: {
      congTrinh: 'Ví dụ B.2 — Phụ lục B (TCCS 39:2022/TCĐBVN)',
      diaDiem: 'Tỉnh Long An',
      kySuThietKe: '',
      doiTuongTK: 'KCAD',
      loaiTK: 'TK_MOI',
      loaiMatDuong: 'CUNG',
    },
    roadScale: { ...base.roadScale, capDuong: 'Đường cấp III', soLanXe: 2 },
    rigid,
  };
}
