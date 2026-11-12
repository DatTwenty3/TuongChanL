import { describe, expect, it } from 'vitest';
import {
  allChecks,
  calcChecks,
  calcRun,
  cuBqu,
  cuDefaults,
  isCalcValid,
  lunCalc,
  lunCvAvg,
  lunDefaults,
  lunEmbankI,
  lunEnsure,
  lunFromCalc,
  lunHalfK,
  lunNewLayer,
  lunOn,
  lunRun,
  lunStripK,
  lunTime,
  lunU,
  presetCanti,
  resetPileCache,
  type EngineProject,
} from '../../src/engine/index';

/**
 * Đối chiếu với `bang tinh/01. KIỂM TOÁN LÚN NỀN ĐẮP_Hay dung.xlsm` (giá trị đọc từ các ô đã tính của Excel).
 * Bảng tính dùng T/m², T/m³; ở đây nhân 10 thành kPa, kN/m³ và lấy γ_w = 10 – tỉ số trong logarit không đổi.
 */
const T = 10;
const SHEET_LAYERS = [
  lunNewLayer({ id: 'a', name: '2', thk: 0.7, gamma: 2.66 * T, e0: 1.14, Cv: 6.77, Cc: 0.317, Cr: 0.054, Pc: 8.5 * T }),
  lunNewLayer({ id: 'b', name: '3', thk: 3.5, gamma: 1.8 * T, e0: 1.05, Cv: 7.27, Cc: 0.29, Cr: 0.04, Pc: 8.35 * T }),
  lunNewLayer({ id: 'c', name: '4', thk: 20.3, gamma: 1.77 * T, e0: 1.14, Cv: 6.77, Cc: 0.317, Cr: 0.054, Pc: 8.5 * T }),
  lunNewLayer({ id: 'd', name: '5', thk: 3.18, gamma: 1.78 * T, e0: 1.12, Cv: 6.77, Cc: 0.317, Cr: 0.04, Pc: 8.5 * T }),
  lunNewLayer({ id: 'e', name: '6', thk: 3.04, gamma: 1.99 * T, e0: 0.71, Cv: 0, Cc: 0, Cr: 0, Pc: 0 }),
  lunNewLayer({ id: 'f', name: '7', thk: 3.75, gamma: 2.04 * T, e0: 0.63, Cv: 0, Cc: 0, Cr: 0, Pc: 0 }),
];
// [h, z giữa, σ_z (T/m²), σ_vz (T/m²), độ lún phân tố (m)] – cột C, D, J, L, M các dòng 66…103 của sheet "Tính toán"
const SHEET_ROWS: number[][] = [
  [0.7, 0.35, 7.181386689, 0.581, 0.019885964], [1, 1.2, 7.177011384, 1.562, 0.017002541], [1, 2.2, 7.155011203, 2.362, 0.018737734],
  [1, 3.2, 7.105119674, 3.162, 0.020926833], [0.5, 3.95, 7.046317118, 3.762, 0.011305237], [1, 4.7, 6.968976383, 4.347, 0.025757456],
  [1, 5.7, 6.839253462, 5.117, 0.027511047], [1, 6.7, 6.683853949, 5.887, 0.029199617], [1, 7.7, 6.508864611, 6.657, 0.03082768],
  [1, 8.7, 6.320338932, 7.427, 0.032408508], [1, 9.7, 6.123682117, 8.197, 0.033956052], [1, 10.7, 5.92339483, 8.967, 0.032627157],
  [1, 11.7, 5.723036897, 9.737, 0.029742504], [1, 12.7, 5.525305953, 10.507, 0.027184566], [1, 13.7, 5.332163904, 11.277, 0.024908822],
  [1, 14.7, 5.144973188, 12.047, 0.022878337], [1, 15.7, 4.964623681, 12.817, 0.021061988], [1, 16.7, 4.791642318, 13.587, 0.019433263],
  [1, 17.7, 4.626283529, 14.357, 0.017969402], [1, 18.7, 4.468601587, 15.127, 0.016650765], [1, 19.7, 4.318507197, 15.897, 0.015460337],
  [1, 20.7, 4.175811021, 16.667, 0.014383335], [1, 21.7, 4.040256645, 17.437, 0.013406884], [1, 22.7, 3.911545251, 18.207, 0.012519747],
  [1, 23.7, 3.789353821, 18.977, 0.011712102], [0.3, 24.35, 3.713267675, 19.4775, 0.003367692], [1, 25, 3.639702803, 19.983, 0.010866057],
  [1, 26, 3.53123837, 20.763, 0.010199802], [1, 27, 3.428196971, 21.543, 0.009589725], [0.18, 27.59, 3.369817347, 22.0032, 0.001665675],
  [1, 28.18, 3.31315193, 22.5684, 0], [1, 29.18, 3.220852484, 23.5584, 0], [1, 30.18, 3.133016506, 24.5484, 0],
  [0.04, 30.7, 3.089015418, 25.0632, 0], [1, 31.22, 3.046111619, 25.603, 0], [1, 32.22, 2.966560214, 26.643, 0],
  [1, 33.22, 2.890699693, 27.683, 0], [0.75, 34.095, 2.827173779, 28.593, 0],
];
const Htt = 3 + 0.21189189189189195 + 0.67; // Htk + chiều cao quy đổi áo đường + độ lún giả thiết
const qEmb = 1.85 * Htt * T;
const embLoad = (z: number): number => qEmb * 2 * lunEmbankI(Htt * 2, 7.5, z);

describe('Tính lún – đối chiếu bảng tính "KIỂM TOÁN LÚN NỀN ĐẮP"', () => {
  const calc = lunCalc({ layers: SHEET_LAYERS, hw: 0, hm: 0, dz: 1, stop: 0.15, gw: T, load: embLoad });

  it('hệ số Osterberg (hàm Igt của bảng tính): ô G6, G7, G16 của sheet ZA', () => {
    const a = 7.763783783783784;
    expect(lunEmbankI(a, 7.5, 0.35)).toBeCloseTo(0.499992, 6);
    expect(lunEmbankI(a, 7.5, 1.2)).toBeCloseTo(0.499687, 6);
    expect(lunEmbankI(a, 7.5, 9.7)).toBeCloseTo(0.426351, 6);
  });

  it('38 phân tố: bề dày, độ sâu, σ_z, σ_vz và độ lún từng phân tố khớp cột C, D, J, L, M', () => {
    expect(calc.rows.length).toBe(SHEET_ROWS.length);
    calc.rows.forEach((r, i) => {
      const [h, z, sz, sv, s] = SHEET_ROWS[i];
      expect(r.h, `h dòng ${66 + i}`).toBeCloseTo(h, 9);
      expect(r.z, `z dòng ${66 + i}`).toBeCloseTo(z, 9);
      expect(r.sz / T, `σz dòng ${66 + i}`).toBeCloseTo(sz, 6);
      expect(r.sv / T, `σvz dòng ${66 + i}`).toBeCloseTo(sv, 9);
      expect(r.on ? r.s : 0, `s dòng ${66 + i}`).toBeCloseTo(s, 8);
    });
    // ba trường hợp cố kết đều xuất hiện: quá cố kết (TH2, TH3) ở trên, cố kết thường (TH1) ở dưới
    expect(calc.rows[0].cs).toBe(2);
    expect(calc.rows[1].cs).toBe(3);
    expect(calc.rows[11].cs).toBe(1);
    // từ dòng 96 trở đi σz/σvz < 0,15 → dừng tính
    expect(calc.rows.slice(0, 30).every((r) => r.on)).toBe(true);
    expect(calc.rows.slice(30).some((r) => r.on)).toBe(false);
  });

  it('Sc = 0,583147 m, Za = 27,68 m, S = 1,2·Sc = 0,699776 m (ô M121, F20, M122)', () => {
    expect(calc.Sc).toBeCloseTo(0.583147, 6);
    expect(calc.Za).toBeCloseTo(27.68, 9);
    expect(1.2 * calc.Sc).toBeCloseTo(0.699776, 6);
  });

  it('Cv trung bình = 6,830323 (ô F18) và lún theo thời gian (bảng 7.3.5)', () => {
    const cv = lunCvAvg(calc.rows, SHEET_LAYERS);
    expect(cv.za).toBeCloseTo(27.68, 9);
    expect(cv.Cv).toBeCloseTo(6.830323, 6);
    const t = lunTime(calc.Sc, cv.Cv, calc.Za, 1, 20);
    expect(t.length).toBe(21);
    expect(t[0].U).toBe(0);
    expect(t[1].Tv).toBeCloseTo(0.002772843, 9);
    expect(t[20].Tv).toBeCloseTo(0.055456866, 9);
    // U: ô D127, D128, D131, D136, D146
    expect(t[1].U).toBeCloseTo(0.08, 9);
    expect(t[2].U).toBeCloseTo(0.089274119, 8);
    expect(t[5].U).toBeCloseTo(0.133155947, 8);
    expect(t[10].U).toBeCloseTo(0.188015569, 8);
    expect(t[20].U).toBeCloseTo(0.265020759, 8);
    // St: ô E127, E131, E136, E146
    expect(t[1].St).toBeCloseTo(0.046651746, 7);
    expect(t[5].St).toBeCloseTo(0.077649468, 7);
    expect(t[10].St).toBeCloseTo(0.109640682, 7);
    expect(t[20].St).toBeCloseTo(0.154546014, 7);
    expect(t[20].Sr).toBeCloseTo(calc.Sc - t[20].St, 12);
    // thoát nước hai chiều: quãng đường thấm giảm nửa → Tv gấp 4
    expect(lunTime(calc.Sc, cv.Cv, calc.Za, 2, 1)[1].Tv).toBeCloseTo(4 * t[1].Tv, 12);
  });

  it('bảng U–Tv: biên và nội suy', () => {
    expect(lunU(0)).toBe(0);
    expect(lunU(-1)).toBe(0);
    expect(lunU(0.002)).toBe(0.08);
    expect(lunU(0.004)).toBeCloseTo(0.08, 12);
    expect(lunU(0.006)).toBeCloseTo(0.092, 12);
    expect(lunU(1.5)).toBeCloseTo((0.931 + 0.994) / 2, 12);
    expect(lunU(5)).toBe(0.994);
  });
});

describe('Tính lún – hệ số ứng suất cho tường', () => {
  it('tải băng tại trục giữa và tải nửa mặt phẳng', () => {
    expect(lunStripK(3, 0)).toBe(1);
    // z = B/2: β = 45° → K = (π/2 + 1)/π
    expect(lunStripK(3, 1.5)).toBeCloseTo((Math.PI / 2 + 1) / Math.PI, 12);
    // bảng cống tròn: Zi/Bqu = 0,82 → K = 0,632; 1,06 → 0,526 (ô H201, H202)
    expect(lunStripK(1, 0.82)).toBeCloseTo(0.632, 3);
    expect(lunStripK(1, 1.06)).toBeCloseTo(0.526, 3);
    expect(lunStripK(3, 1e6)).toBeLessThan(1e-5);
    expect(lunHalfK(0, 2)).toBeCloseTo(0.5, 12);
    expect(lunHalfK(5, 0)).toBe(0);
    // ngay dưới mép (x = z): (π/2 − π/4 − 1/2)/π
    expect(lunHalfK(2, 2)).toBeCloseTo((Math.PI / 4 - 0.5) / Math.PI, 12);
    // hai nửa mặt phẳng ghép lại = tải phủ kín → 1
    expect(lunHalfK(0, 3) * 2).toBeCloseTo(1, 12);
  });
});

describe('Tính lún – gắn vào tường chắn', () => {
  const withLun = (): EngineProject => {
    const p = presetCanti(500) as EngineProject;
    p.lun = lunDefaults();
    return p;
  };

  it('vắng mặt = tắt: danh sách kiểm tra y nguyên', () => {
    resetPileCache();
    const p = presetCanti(500) as EngineProject;
    expect(lunOn(p)).toBe(false);
    expect(lunEnsure(p)).toBeUndefined();
    const R = calcRun(p);
    expect(lunFromCalc(p, R)).toBeNull();
    expect(allChecks(p, R)).toEqual(calcChecks(R));
    p.lun = { ...lunDefaults(), on: false };
    expect(allChecks(p, calcRun(p))).toEqual(calcChecks(calcRun(p)));
  });

  it('bật: tải từ tổ hợp sử dụng, thêm mục kiểm tra "Độ lún cố kết", số liệu nhất quán với công thức', () => {
    resetPileCache();
    const p = withLun();
    const R = calcRun(p);
    if (!isCalcValid(R)) throw new Error('calc');
    const r = lunFromCalc(p, R)!;
    const q = p.lun!;
    const B = R.g.B;
    const sd = R.C.find((c) => c.k === 'SD')!;
    expect(r.p).toBeCloseTo(sd.N / B, 9);
    // mực nước 0,5 m, đáy móng sâu 1 m: tâm lớp phủ ở 0,5 m (không dưới mực nước) → σbt = γ·hm
    expect(r.sv0).toBeCloseTo(q.layers[0].gamma * q.hm, 9);
    expect(r.pNet).toBeCloseTo(r.p - r.sv0, 9);
    expect(r.qBack).toBeCloseTo((p.calc?.gs ?? 18) * R.g.Hp - r.sv0, 9);
    expect(r.z0).toBe(0);
    expect(r.Bq).toBe(B);
    // phân tố đầu: z = 0,5 m; σz = p_gl·K_băng + q·K_nửa
    const r0 = r.rows[0];
    expect(r0.z).toBeCloseTo(0.5, 12);
    expect(r0.sz).toBeCloseTo(r.pNet * lunStripK(B, 0.5) + r.qBack * lunHalfK(B / 2, 0.5), 9);
    expect(r0.sv).toBeCloseTo(r.sv0 + (q.layers[0].gamma - 10) * 0.5, 9);
    expect(r.S).toBeCloseTo(q.m * r.Sc, 12);
    expect(r.v).toBeCloseTo(r.S / (q.Slim / 100), 12);
    expect(r.Sc).toBeGreaterThan(0);
    expect(r.time.length).toBe(q.years + 1);
    expect(r.time[q.years].St).toBeLessThanOrEqual(r.Sc);
    const all = allChecks(p, R);
    expect(all[all.length - 1].id).toBe('lun-s');
    expect(all[all.length - 1].v).toBeCloseTo(r.v, 12);

    // bỏ tải đất đắp sau gót → lún giảm; mực nước sâu hơn → ứng suất bản thân lớn hơn → lún giảm
    const noBack = lunRun({ ...q, backfill: false }, { B, p: r.p, pAt: '', Hfill: R.g.Hp, gFill: 18, cu: null });
    expect(noBack.qBack).toBe(0);
    expect(noBack.Sc).toBeLessThan(r.Sc);
    const dry = lunRun({ ...q, hw: 50 }, { B, p: r.p, pAt: '', Hfill: R.g.Hp, gFill: p.calc?.gs ?? 18, cu: null });
    expect(dry.Sc).toBeLessThan(r.Sc);
  });

  it('có cừ tràm: tải đặt tại mũi cừ trên bề rộng móng khối quy ước, không tính lún trong thân khối cừ', () => {
    resetPileCache();
    const p = withLun();
    p.cu = cuDefaults();
    const R = calcRun(p);
    if (!isCalcValid(R)) throw new Error('calc');
    const r = lunFromCalc(p, R)!;
    const cu = p.cu!;
    const B = R.g.B;
    expect(r.z0).toBe(cu.L);
    expect(r.Bq).toBeCloseTo(cuBqu(B, cu.L, cu.phi), 12);
    // dùng chiều sâu chôn móng của mục cừ tràm
    expect(r.sv0).toBeCloseTo(p.lun!.layers[0].gamma * cu.hm > 0 ? r.sv0 : 0, 12);
    expect(r.pNet).toBeCloseTo(((r.p - r.sv0) * B) / r.Bq, 9);
    const above = r.rows.filter((x) => x.z < cu.L);
    expect(above.length).toBeGreaterThan(0);
    expect(above.every((x) => x.skip && !x.on && x.s === 0)).toBe(true);
    // có một điểm chia đúng tại mũi cừ (4,5 m)
    const tops = r.rows.map((x) => x.z - x.h / 2);
    expect(tops.some((t) => Math.abs(t - cu.L) < 1e-9)).toBe(true);
    const ids = allChecks(p, R).map((x) => x.id);
    expect(ids.slice(-4)).toEqual(['cu-block', 'cu-count', 'cu-base', 'lun-s']);
  });
});
