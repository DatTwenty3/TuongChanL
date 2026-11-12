import { describe, expect, it } from 'vitest';
import {
  allChecks,
  badgeStatusAll,
  buildBars,
  calcChecks,
  calcRun,
  cuABD,
  cuBlock,
  cuBqu,
  cuDefaults,
  cuEnsure,
  cuFromCalc,
  cuGrid,
  cuOn,
  cuRBlock,
  cuRtc,
  cuRun,
  cuSegments,
  cuSingle,
  cuTerzaghi,
  isCalcValid,
  presetCanti,
  quantities,
  resetPileCache,
  type EngineProject,
} from '../../src/engine/index';
import { model3D } from '../../src/model3d/index';

/**
 * Đối chiếu với hai bảng tính tham khảo trong thư mục `bang tinh/` (giá trị đọc từ ô đã tính của Excel):
 *  (1) 01.MÓNG CỪ TRÀM.xls – sheet "Cừ tràm"
 *  (2) tinh_nen_mong_cong tron60.xls – sheet "NENMONG H30" (đơn vị T, T/m²; 1 T/m² = 10 kPa)
 */
describe('Cừ tràm – đối chiếu bảng tính (1) "01.MÓNG CỪ TRÀM"', () => {
  const inp = { Bm: 1, Lm: 1, hm: 1.5, L: 4.5, phi: 2, gamma: 4.5, c: 6.5, fsTip: 1.5, fsSide: 1.5 };

  it('hệ số A, B (ô O20, O21) và N’c, N’q, N’γ (ô O23–O25)', () => {
    const abd = cuABD(2);
    expect(abd.A).toBeCloseTo(0.028981093268530114, 12);
    expect(abd.B).toBeCloseTo(1.1159243730741204, 12);
    expect(cuTerzaghi(2)).toEqual({ Nc: 6.1, Nq: 1.14, Ng: 0.02 });
    // nội suy giữa hai dòng và kẹp biên
    expect(cuTerzaghi(2.5).Nc).toBeCloseTo(6.2, 10);
    expect(cuTerzaghi(-3)).toEqual({ Nc: 5.7, Nq: 1, Ng: 0 });
    expect(cuTerzaghi(80).Nc).toBe(81.31);
  });

  it('Fxq = 18 m², Qm = 70 kN, Qf = 117 kN, tổng 187 kN, Qtk = 125 kN (ô O29–O35)', () => {
    const r = cuBlock(inp);
    expect(r.Am).toBe(1);
    expect(Math.round(r.Fxq * 10) / 10).toBe(18);
    expect(Math.round(r.Qm)).toBe(70);
    expect(Math.round(r.Qf)).toBe(117);
    expect(Math.round(r.Qm) + Math.round(r.Qf)).toBe(187);
    // bảng tính: ROUND(70/1,5 + 117/1,5) = 125; không làm tròn trung gian cũng ra 125
    expect(Math.round(Math.round(r.Qm) / 1.5 + Math.round(r.Qf) / 1.5)).toBe(125);
    expect(Math.round(r.Qtk)).toBe(125);
    expect(r.qtk).toBeCloseTo(r.Qtk, 12);
  });

  it('Rtc (ô O16 = 24,8539): bảng tính bỏ số hạng B·h·γ’ (ô AA5 trống) và lấy D = 3,14 (ô F21 trống)', () => {
    const abd = cuABD(2);
    const sheet = cuRtc({ A: abd.A, B: abd.B, D: 3.14, b: 1, h: 1.5, gamma: 4.5, gammaAbove: 0, c: 6.5, m1: 1.1, m2: 1.1, ktc: 1 });
    expect(sheet).toBeCloseTo(24.85390205284715, 10);
    // công thức đầy đủ (ứng dụng dùng): có số hạng B·h·γ’ và D = π·cotgφ/(cotgφ + φ − π/2)
    expect(abd.D).toBeCloseTo(abd.A / (0.25 * Math.tan((2 * Math.PI) / 180)), 10);
    const full = cuRtc({ ...abd, b: 1, h: 1.5, gamma: 4.5, gammaAbove: 4.5, c: 6.5, m1: 1.1, m2: 1.1, ktc: 1 });
    expect(full).toBeCloseTo(1.21 * (abd.A * 4.5 + abd.B * 1.5 * 4.5 + abd.D * 6.5), 10);
    expect(full).toBeGreaterThan(sheet);
    // φ = 0: A = 0, B = 1, D = π
    expect(cuABD(0)).toEqual({ A: 0, B: 1, D: Math.PI });
  });
});

describe('Cừ tràm – đối chiếu bảng tính (2) "tinh_nen_mong_cong tron60"', () => {
  it('một cây cừ Ø6 dài 2,8 m: F, u, Σf·l và Qc = 0,43981 T (ô H151, H152, I159, G162)', () => {
    const r = cuSingle({ d: 6, L: 2.8, Rtip: 875, m: 1, mR: 0.9, mf: 1 });
    expect(r.F).toBeCloseTo(0.00283, 5);
    expect(r.u).toBeCloseTo(0.1885, 4);
    expect(cuSegments(2.8).map((s) => [s.l, +s.f.toFixed(6)])).toEqual([
      [2, 4],
      [+(0.8).toFixed(10), 4.4],
    ].map(([l, f]) => [expect.closeTo(l as number, 9), f]));
    expect(r.sumFl / 10).toBeCloseTo(1.152, 9);
    expect(r.Qc / 10).toBeCloseTo(0.43981, 5);
  });

  it('số cây cần trên 1 m² với tải 10,80002 T/m²: n = 25 (ô G164)', () => {
    const r = cuSingle({ d: 6, L: 2.8, Rtip: 875, m: 1, mR: 0.9, mf: 1 });
    const raw = 108.0002 / r.Qc;
    expect(raw).toBeCloseTo(24.556, 2);
    expect(Math.ceil(raw)).toBe(25);
  });

  it('bề rộng móng khối quy ước Bqu = 1,01579 m (ô F228)', () => {
    expect(cuBqu(0.92, 2.8, 3.92)).toBeCloseTo(1.01579, 5);
  });

  it('sức chịu tải đất dưới đáy khối quy ước R = 18,50153 T/m² với A, B, D của bảng tra (ô E297)', () => {
    const R = cuRBlock({ A: 0.0584, B: 1.2452, D: 3.502, BM: cuBqu(0.92, 2.8, 3.92), HM: 4.54, gamma: 16.5, gammaAbove: 16.5, c: 5.1, m1m2: 1, ktc: 0.85 });
    expect(R / 10).toBeCloseTo(18.50153, 3);
    // A, B, D tính bằng công thức (ứng dụng dùng) lệch bảng tra nội suy không quá 3 %
    const abd = cuABD(3.92);
    expect(abd.D).toBeCloseTo(3.502, 2);
    expect(Math.abs(abd.A - 0.0584) / 0.0584).toBeLessThan(0.03);
    expect(Math.abs(abd.B - 1.2452) / 1.2452).toBeLessThan(0.01);
    const R2 = cuRBlock({ ...abd, BM: 1.01579, HM: 4.54, gamma: 16.5, gammaAbove: 16.5, c: 5.1, m1m2: 1, ktc: 0.85 });
    expect(Math.abs(R2 - R) / R).toBeLessThan(0.01);
  });
});

describe('Cừ tràm – gắn vào tường chắn', () => {
  const withCu = (): EngineProject => {
    const p = presetCanti(500) as EngineProject;
    p.cu = cuDefaults();
    return p;
  };

  it('vắng mặt = tắt: kiểm tra, khối lượng và mô hình 3D y nguyên', () => {
    resetPileCache();
    const p = presetCanti(500) as EngineProject;
    expect(cuOn(p)).toBe(false);
    expect(cuEnsure(p)).toBeUndefined();
    const R = calcRun(p);
    expect(cuFromCalc(p, R)).toBeNull();
    expect(allChecks(p, R)).toEqual(calcChecks(R));
    const res = buildBars(p);
    expect(quantities(p, res).cu).toBeUndefined();
    const m = model3D(p, res);
    expect(m.cu).toBeUndefined();
    expect(m.sig).not.toContain('cu');
    // bật rồi tắt: vẫn như chưa có
    p.cu = { ...cuDefaults(), on: false };
    expect(allChecks(p, calcRun(p))).toEqual(calcChecks(calcRun(p)));
    expect(model3D(p, buildBars(p)).cu).toBeUndefined();
  });

  it('bật cừ tràm: thêm 3 mục kiểm tra, sức kháng nền móng nông thành tham khảo, số liệu nhất quán', () => {
    resetPileCache();
    const p = withCu();
    const R = calcRun(p);
    expect(isCalcValid(R)).toBe(true);
    const r = cuFromCalc(p, R)!;
    expect(r).not.toBeNull();
    const q = p.cu!;
    if (!isCalcValid(R)) throw new Error('calc');
    const B = R.g.B;
    const Lu = p.Lu / 100;

    // tính tay lại từ công thức
    const sd = R.C.find((c) => c.k === 'SD')!;
    expect(r.pSd).toBeCloseTo(sd.N / (B - 2 * Math.abs(sd.s)), 9);
    const pTt = Math.max(...R.C.filter((c) => c.k !== 'SD').map((c) => c.N / Math.max(0.1 * B, B - 2 * Math.abs(c.s))));
    expect(r.pTt).toBeCloseTo(pTt, 9);
    const blk = cuBlock({ Bm: B, Lm: Lu, hm: q.hm, L: q.L, phi: q.phi, gamma: q.gamma, c: q.c, fsTip: q.fsTip, fsSide: q.fsSide });
    expect(r.block.qtk).toBeCloseTo(blk.Qtk / (B * Lu), 9);
    expect(r.vBlock).toBeCloseTo(r.pSd / r.block.qtk, 9);
    expect(r.vCount).toBeCloseTo(r.pTt / r.single.Qc / q.n, 9);
    expect(r.nReq).toBe(Math.ceil(r.pTt / r.single.Qc - 1e-9));
    expect(r.sigBase).toBeCloseTo(q.gamma * (q.hm + q.L) + r.pTt, 9);
    expect(r.vBase).toBeCloseTo(r.sigBase / r.RBase, 9);
    expect(r.Bqu).toBeCloseTo(cuBqu(B, q.L, q.phi), 12);

    const all = allChecks(p, R);
    const ids = all.map((x) => x.id);
    expect(ids.slice(-3)).toEqual(['cu-block', 'cu-count', 'cu-base']);
    expect(all.find((x) => x.id === 'br')?.info).toBe(true);
    const bad = all.filter((x) => !x.ok && !x.info).length;
    expect(badgeStatusAll(R, p).count).toBe(bad);

    // đổi đầu vào thì kết quả đổi đúng chiều: tăng mật độ → hệ số sử dụng theo số cây giảm
    const p2 = withCu();
    p2.cu!.n = 36;
    const r2 = cuRun(p2.cu!, R.C.map((c) => ({ k: c.k, nm: c.nm, N: c.N, s: c.s })), B, Lu);
    expect(r2.vCount).toBeCloseTo((r.vCount * 25) / 36, 9);
  });

  it('khối lượng và mô hình 3D: số cây theo lưới, mũi cừ sâu đúng chiều dài, có khối đất yếu bao quanh', () => {
    const p = withCu();
    const res = buildBars(p);
    const B = res.g.B / 100;
    const Lu = p.Lu / 100;
    const g = cuGrid(p.cu!, B, Lu);
    expect(g.nx).toBe(Math.round(B * 5));
    expect(g.nz).toBe(Math.round(Lu * 5));
    expect(g.n / (B * Lu)).toBeCloseTo(25, 0);
    const q = quantities(p, res);
    expect(q.cu).toEqual({ n: g.n, totLen: g.n * p.cu!.L });
    // bê tông / thép của tường không đổi
    const q0 = quantities(presetCanti(500), buildBars(presetCanti(500)));
    expect(q.vol).toBe(q0.vol);
    expect(q.totKg).toBe(q0.totKg);

    const m = model3D(p, res);
    expect(m.cu).toBeDefined();
    const ys = m.cu!.p.filter((_, i) => i % 3 === 1);
    const top = Math.max(...ys);
    const tip = Math.min(...ys);
    expect(top - tip).toBeCloseTo(p.cu!.L * 100, 6);
    expect(top).toBeLessThanOrEqual(0);
    expect(m.bbox.y0).toBeLessThanOrEqual(tip);
    expect(m.sig).toContain('cu');
    // mỗi tam giác hợp lệ
    expect(m.cu!.i.length % 3).toBe(0);
    expect(Math.max(...m.cu!.i)).toBeLessThan(m.cu!.p.length / 3);
    // khối đất yếu phủ hết chiều dài cừ
    const strata = m.ground!.filter((gp) => gp.kind === 'strata');
    expect(Math.min(...strata.map((gp) => gp.y0))).toBeLessThan(tip);
    expect(m.ground!.some((gp) => gp.kind === 'cover')).toBe(true);
  });
});
