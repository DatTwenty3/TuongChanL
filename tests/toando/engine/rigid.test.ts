import { describe, expect, it } from 'vitest';
import { createBlankProject } from '../../../src/toando/data/sampleVd';
import {
  createDefaultRigidDrainData,
  createDefaultRigidProjectData,
  drainRequirement,
  ecFromFr,
  ensureRigidState,
  resolveRigidInput,
  runRigidVerification,
} from '../../../src/toando/engine';
import { createRigidSampleProject } from '../../../src/toando/data/sampleRigid';
import type { ProjectState } from '../../../src/toando/types/project';

/** Ví dụ B.1 — Phụ lục B, TCCS 39:2022/TCĐBVN (đường cấp IV, tấm 23 cm, móng CPĐD 300 MPa dày 20 cm). */
function exampleB1(): ProjectState {
  const base = createBlankProject();
  const rigid = createDefaultRigidProjectData();
  rigid.roadClass = 'CAP_IV';
  rigid.input = {
    ...rigid.input,
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
    layers: [{ name: 'CPĐD', E: 300, h: 0.2 }],
  };
  return ensureRigidState({
    ...base,
    projectInfo: { ...base.projectInfo, loaiMatDuong: 'CUNG' },
    rigid,
  });
}

describe('TCCS 39:2022 — kiểm toán mặt đường cứng (toan-do)', () => {
  it('khớp từng số của ví dụ B.1 (Phụ lục B)', () => {
    const v = runRigidVerification(exampleB1());
    // Ví dụ làm tròn α = 0,442 nên Et = 97,46; tính chính xác α = 0,4415 cho 97,37.
    expect(v.res.alpha).toBeCloseTo(0.442, 3);
    expect(v.res.Et).toBeCloseTo(97.46, 0);
    expect(v.res.Dc).toBeCloseTo(30.1, 1);
    expect(v.res.r).toBeCloseTo(0.818, 3);
    expect(v.res.sps).toBeCloseTo(1.831, 3);
    expect(v.res.spm).toBeCloseTo(2.681, 3);
    expect(v.res.spr).toBeCloseTo(3.282, 2); // ví dụ làm tròn các hệ số trung gian
    expect(v.res.spmax).toBeCloseTo(2.681, 3);
    expect(v.res.t).toBeCloseTo(1.833, 2);
    expect(v.res.CL).toBeCloseTo(0.758, 2);
    expect(v.res.BL).toBeCloseTo(0.447, 2);
    expect(v.res.stmax).toBeCloseTo(1.282, 2);
    expect(v.res.kt).toBeCloseTo(0.357, 2);
    expect(v.res.str).toBeCloseTo(0.458, 2);
    // Điều kiện (6), (7): 1,04·(3,282+0,458) = 3,889 ; 1,04·(2,681+1,282) = 4,121
    expect(v.checks[0].lhs).toBeCloseTo(3.889, 2);
    expect(v.checks[1].lhs).toBeCloseTo(4.121, 2);
    expect(v.checks[0].passed).toBe(true);
    expect(v.checks[1].passed).toBe(true);
    expect(v.checks[2].applicable).toBe(false);
    expect(v.allPassed).toBe(true);
  });

  it('khớp ví dụ B.2 (Mô hình 2, móng gia cố xi măng, γr = 1,13)', () => {
    const v = runRigidVerification(createRigidSampleProject('B2'));
    expect(v.res.Dc).toBeCloseTo(46.45, 1);
    expect(v.res.Db).toBeCloseTo(0.903, 2);
    expect(v.res.Et).toBeCloseTo(98.7, 0);
    expect(v.res.rg).toBeCloseTo(0.947, 2);
    expect(v.res.sps).toBeCloseTo(1.541, 2);
    expect(v.res.spm).toBeCloseTo(2.677, 2);
    expect(v.res.spr).toBeCloseTo(3.637, 2);
    expect(v.res.spmax).toBeCloseTo(2.445, 2);
    expect(v.res.kn).toBeCloseTo(3081.98, 1);
    expect(v.res.CL).toBeCloseTo(0.699, 2);
    expect(v.res.BL).toBeCloseTo(0.347, 2);
    expect(v.res.stmax).toBeCloseTo(1.287, 2);
    expect(v.res.kt).toBeCloseTo(0.317, 2);
    expect(v.res.str).toBeCloseTo(0.408, 2);
    expect(v.checks[0].lhs).toBeCloseTo(4.571, 1);
    expect(v.checks[1].lhs).toBeCloseTo(4.217, 1);
    expect(v.allPassed).toBe(true);
    // sách nêu: móng gia cố xi măng không cần kiểm tra (8) → fbr = 0 nên điều kiện (8) không áp dụng
    expect(v.checks[2].applicable).toBe(false);
  });

  it('thoát nước Điều 7 — móng thoát nước: công thức (1)–(5) tính tay', () => {
    const p = exampleB1();
    // Ic 0,36; N 2; nh 1; B 7,5; id 0,5 %; in 2 %; kb 300; ne 0,15; hbt 0,15
    p.rigid!.drain = { ...createDefaultRigidDrainData(), type: 'THAM' };
    const v = runRigidVerification(p);
    const d = v.drain!;
    const L = 4.5; // chiều dài tấm của ví dụ B.1
    const Qi = 0.36 * (3 + (1 * 7.5) / L); // (1)
    const Ls = 7.5 * Math.sqrt(1 + 0.5 ** 2 / 2 ** 2); // (3)
    const vs = (1 / 0.15) * (300 / 86400) * Math.sqrt(0.005 ** 2 + 0.02 ** 2); // (4), m/s
    const t = Ls / (3600 * vs); // (2), giờ
    const cap = 0.15 * 1.0 * (vs * 86400); // (5)
    expect(d.calc.Qi).toBeCloseTo(Qi, 9);
    expect(d.calc.Ls).toBeCloseTo(Ls, 9);
    expect(d.calc.vs).toBeCloseTo(vs, 12);
    expect(d.calc.t).toBeCloseTo(t, 6);
    expect(d.calc.cap).toBeCloseTo(cap, 6);
    expect(Qi).toBeCloseTo(1.68, 2);
    expect(t).toBeGreaterThan(2); // 4,5 h > 2 h → không đạt thời gian thấm
    const byId = Object.fromEntries(d.checks.map((c) => [c.id, c]));
    expect(byId.ls.passed).toBe(true);
    expect(byId.t.passed).toBe(false);
    expect(byId.hbt.passed).toBe(true);
    expect(d.passed).toBe(false);
    expect(v.slabPassed).toBe(true);
    expect(v.allPassed).toBe(false); // thoát nước không đạt kéo theo kết luận chung
    // độ dốc lớn hơn, vật liệu thấm tốt hơn thì đạt
    p.rigid!.drain = { ...p.rigid!.drain!, id: 3, kb: 1000 };
    expect(runRigidVerification(p).drain!.passed).toBe(true);
  });

  it('thoát nước Điều 7.2 — ống dọc/ngang và điều kiện bắt buộc Điều 7.1.2', () => {
    const p = exampleB1();
    p.rigid!.drain = { ...createDefaultRigidDrainData(), type: 'KHONG_THAM' };
    let d = runRigidVerification(p).drain!;
    expect(d.checks.map((c) => c.id)).toEqual(['ls', 'dia', 'slopeLong', 'slopeCross', 'spacing']);
    expect(d.passed).toBe(true);
    p.rigid!.drain = { ...p.rigid!.drain!, pipeSlopeLong: 0.2, pipeDia: 150 };
    d = runRigidVerification(p).drain!;
    expect(d.checks.find((c) => c.id === 'slopeLong')!.passed).toBe(false);
    expect(d.checks.find((c) => c.id === 'dia')!.passed).toBe(false);
    expect(d.passed).toBe(false);

    const base = createDefaultRigidDrainData();
    // khoản 2: cấp nặng + nền sét k < 3 → bắt buộc
    expect(drainRequirement('CAP_III', { ...base, trafficScale: 'NANG', subgradeSoil: 'SET', subgradeK: 1 }).required).toBe(true);
    // khoản 1: cao tốc + mưa > 600 mm + nền hạt mịn k < 85 → bắt buộc
    expect(
      drainRequirement('CAO_TOC', { ...base, trafficScale: 'THUONG', subgradeSoil: 'HAT_MIN', subgradeK: 50, rain: 1200 }).required,
    ).toBe(true);
    // mưa ít hoặc nền thấm tốt → không bắt buộc
    expect(
      drainRequirement('CAO_TOC', { ...base, trafficScale: 'THUONG', subgradeSoil: 'HAT_MIN', subgradeK: 50, rain: 500 }).required,
    ).toBe(false);
    expect(drainRequirement('CAP_III', { ...base, trafficScale: 'NANG', subgradeSoil: 'SET', subgradeK: 5 }).required).toBe(false);
  });

  it('chưa bật thoát nước: kết luận chung chỉ phụ thuộc tấm (không đổi so với trước)', () => {
    const v = runRigidVerification(exampleB1());
    expect(v.drain).toBeNull();
    expect(v.allPassed).toBe(v.slabPassed);
  });

  it('tấm mỏng thì KHÔNG đạt và tìm được chiều dày nhỏ nhất đạt', () => {
    const p = exampleB1();
    p.rigid!.input.hc = 0.16;
    const v = runRigidVerification(p);
    expect(v.allPassed).toBe(false);
    expect(v.minHc).not.toBeNull();
    expect(v.minHc!).toBeGreaterThan(0.16);
  });

  it('tra Bảng 11 nội suy Ec theo fr', () => {
    expect(ecFromFr(4.5)).toBe(29000);
    expect(ecFromFr(5.0)).toBe(31000);
    expect(ecFromFr(4.75)).toBeCloseTo(30000, 6);
    expect(ecFromFr(0.5)).toBe(10000);
    expect(ecFromFr(9)).toBe(33000);
  });

  it('E0 lấy từ mục Đất nền và Ne tự tính từ phổ tải khi bật tuỳ chọn', () => {
    const p = exampleB1();
    p.rigid!.e0FromSubgrade = true;
    p.rigid!.neAuto = true;
    const { input, ne } = resolveRigidInput(p);
    expect(input.E0).toBeCloseTo(p.subgrade.E0_MPa, 6);
    expect(input.Ne).toBeCloseTo(ne.Ne, 6);
    expect(ne.Ne).toBeGreaterThan(0);
  });

  it('dự án mềm (mặc định) không có dữ liệu mặt đường cứng', () => {
    const base = createBlankProject();
    expect(base.projectInfo.loaiMatDuong).toBeUndefined();
    expect(base.rigid).toBeUndefined();
    expect(ensureRigidState(base)).toBe(base);
  });
});
